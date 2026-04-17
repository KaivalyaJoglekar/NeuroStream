package s3

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// UploadFile uploads a local file to S3 at the given key.
// Retries up to maxRetries times with exponential backoff.
func (sc *S3Client) UploadFile(ctx context.Context, localPath, s3Key string, maxRetries int) error {
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			wait := time.Duration(1<<uint(attempt-1)) * time.Second
			log.Printf("[s3] Upload retry %d/%d for %s (waiting %v)", attempt, maxRetries, s3Key, wait)
			time.Sleep(wait)
		}

		err := sc.uploadOnce(ctx, localPath, s3Key)
		if err == nil {
			return nil
		}
		lastErr = err
		log.Printf("[s3] Upload attempt %d failed for %s: %v", attempt+1, s3Key, err)
	}

	return fmt.Errorf("failed to upload %s after %d attempts: %w", s3Key, maxRetries+1, lastErr)
}

func (sc *S3Client) uploadOnce(ctx context.Context, localPath, s3Key string) error {
	file, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("failed to open file %s: %w", localPath, err)
	}
	defer file.Close()

	contentType := inferContentType(localPath)

	_, err = sc.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(sc.bucketName),
		Key:         aws.String(s3Key),
		Body:        file,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("PutObject failed: %w", err)
	}

	return nil
}

// UploadDirectory uploads all files in a local directory to S3 under the given prefix.
// Preserves the relative directory structure.
func (sc *S3Client) UploadDirectory(ctx context.Context, localDir, s3Prefix string, maxRetries int) ([]string, error) {
	var uploadedKeys []string

	err := filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(localDir, path)
		if err != nil {
			return fmt.Errorf("failed to compute relative path: %w", err)
		}

		// Normalize path separators for S3
		s3Key := s3Prefix + "/" + strings.ReplaceAll(relPath, "\\", "/")

		if err := sc.UploadFile(ctx, path, s3Key, maxRetries); err != nil {
			return fmt.Errorf("failed to upload %s: %w", path, err)
		}

		uploadedKeys = append(uploadedKeys, s3Key)
		log.Printf("[s3] Uploaded %s → s3://%s/%s", path, sc.bucketName, s3Key)
		return nil
	})

	if err != nil {
		return uploadedKeys, err
	}

	log.Printf("[s3] Uploaded %d files to s3://%s/%s/", len(uploadedKeys), sc.bucketName, s3Prefix)
	return uploadedKeys, nil
}

// inferContentType returns a MIME type based on file extension.
func inferContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".wav":
		return "audio/wav"
	case ".mp3":
		return "audio/mpeg"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	default:
		return "application/octet-stream"
	}
}
