package ffmpeg

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// SampleFrames extracts frames from a video chunk at the specified FPS rate.
// Returns the list of frame file paths in order.
func SampleFrames(chunkPath, outputDir string, chunkIndex int, fps int) ([]string, error) {
	// Create chunk-specific frame directory: frames/chunk_000/
	frameDir := filepath.Join(outputDir, fmt.Sprintf("chunk_%03d", chunkIndex))
	if err := os.MkdirAll(frameDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create frame output dir: %w", err)
	}

	outputPattern := filepath.Join(frameDir, "frame_%04d.jpg")

	args := []string{
		"-i", chunkPath,
		"-vf", fmt.Sprintf("fps=%d", fps),
		"-q:v", "2",
		"-y",
		outputPattern,
	}

	if err := runFFmpeg(args, fmt.Sprintf("frame_sample_chunk_%03d", chunkIndex)); err != nil {
		return nil, err
	}

	// Discover output frames
	entries, err := os.ReadDir(frameDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read frame output dir: %w", err)
	}

	var framePaths []string
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "frame_") && strings.HasSuffix(name, ".jpg") {
			framePaths = append(framePaths, filepath.Join(frameDir, name))
		}
	}

	sort.Strings(framePaths)

	log.Printf("[ffmpeg] Sampled %d frames from chunk %03d at %d fps", len(framePaths), chunkIndex, fps)
	return framePaths, nil
}
