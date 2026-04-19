package s3

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Client wraps the AWS S3 client with NeuroStream-specific operations.
type S3Client struct {
	client     *s3.Client
	bucketName string
}

// NewS3Client creates a new S3 client. If endpoint is non-empty, it configures
// the client for MinIO/LocalStack compatibility.
func NewS3Client(region, accessKeyID, secretAccessKey, bucketName, endpoint string) (*S3Client, error) {
	ctx := context.Background()

	var opts []func(*awsconfig.LoadOptions) error

	opts = append(opts, awsconfig.WithRegion(region))

	if accessKeyID != "" && secretAccessKey != "" {
		opts = append(opts, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
		))
	}

	cfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	var s3Opts []func(*s3.Options)
	if endpoint != "" {
		usePathStyle := shouldUsePathStyle(endpoint)
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = usePathStyle
		})
	}

	client := s3.NewFromConfig(cfg, s3Opts...)

	log.Printf("[s3] Initialized S3 client (bucket=%s, region=%s, endpoint=%s)", bucketName, region, endpoint)

	return &S3Client{
		client:     client,
		bucketName: bucketName,
	}, nil
}

func shouldUsePathStyle(endpoint string) bool {
	host := endpoint
	if parsed, err := url.Parse(endpoint); err == nil && parsed.Host != "" {
		host = parsed.Host
	}

	host = strings.ToLower(host)
	return strings.Contains(host, "localhost") ||
		strings.Contains(host, "127.0.0.1") ||
		strings.Contains(host, "minio") ||
		strings.Contains(host, "localstack")
}

// DownloadFile downloads an object from S3 to a local file path.
// Retries up to maxRetries times with exponential backoff.
func (sc *S3Client) DownloadFile(ctx context.Context, s3Key, localPath string, maxRetries int) error {
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory for download: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			wait := time.Duration(1<<uint(attempt-1)) * time.Second
			log.Printf("[s3] Download retry %d/%d for %s (waiting %v)", attempt, maxRetries, s3Key, wait)
			time.Sleep(wait)
		}

		err := sc.downloadOnce(ctx, s3Key, localPath)
		if err == nil {
			log.Printf("[s3] Downloaded s3://%s/%s → %s", sc.bucketName, s3Key, localPath)
			return nil
		}
		lastErr = err
		log.Printf("[s3] Download attempt %d failed for %s: %v", attempt+1, s3Key, err)
	}

	return fmt.Errorf("failed to download %s after %d attempts: %w", s3Key, maxRetries+1, lastErr)
}

func (sc *S3Client) downloadOnce(ctx context.Context, s3Key, localPath string) error {
	output, err := sc.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(sc.bucketName),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return fmt.Errorf("GetObject failed: %w", err)
	}
	defer output.Body.Close()

	file, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, output.Body); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}
