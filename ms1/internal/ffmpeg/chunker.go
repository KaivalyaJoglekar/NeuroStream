package ffmpeg

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// ChunkResult holds information about a single output chunk.
type ChunkResult struct {
	Index    int
	FilePath string
}

// ChunkVideo splits a video file into segments of the given duration.
// Returns a sorted list of chunk file paths.
func ChunkVideo(inputPath, outputDir string, chunkDurationSec int) ([]ChunkResult, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create chunk output dir: %w", err)
	}

	outputPattern := filepath.Join(outputDir, "chunk_%03d.mp4")

	args := []string{
		"-i", inputPath,
		"-c", "copy",
		"-map", "0",
		"-segment_time", fmt.Sprintf("%d", chunkDurationSec),
		"-f", "segment",
		"-reset_timestamps", "1",
		outputPattern,
	}

	if err := runFFmpeg(args, "chunk_video"); err != nil {
		return nil, err
	}

	// Discover output chunks
	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read chunk output dir: %w", err)
	}

	var chunks []ChunkResult
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "chunk_") && strings.HasSuffix(name, ".mp4") {
			var index int
			if _, err := fmt.Sscanf(name, "chunk_%03d.mp4", &index); err != nil {
				continue
			}
			chunks = append(chunks, ChunkResult{
				Index:    index,
				FilePath: filepath.Join(outputDir, name),
			})
		}
	}

	sort.Slice(chunks, func(i, j int) bool {
		return chunks[i].Index < chunks[j].Index
	})

	if len(chunks) == 0 {
		return nil, fmt.Errorf("ffmpeg produced no output chunks")
	}

	log.Printf("[ffmpeg] Chunked video into %d segments", len(chunks))
	return chunks, nil
}

// GetVideoDuration returns the total duration of a video file in seconds.
func GetVideoDuration(inputPath string) (float64, error) {
	args := []string{
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		inputPath,
	}

	cmd := exec.Command("ffprobe", args...)
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe failed: %w", err)
	}

	var duration float64
	if _, err := fmt.Sscanf(strings.TrimSpace(string(output)), "%f", &duration); err != nil {
		return 0, fmt.Errorf("failed to parse duration: %w", err)
	}

	return duration, nil
}

// runFFmpeg executes an ffmpeg command and captures stderr for logging.
func runFFmpeg(args []string, operation string) error {
	cmd := exec.Command("ffmpeg", args...)

	// Capture stderr for debugging
	var stderrBuf strings.Builder
	cmd.Stderr = &stderrBuf

	log.Printf("[ffmpeg:%s] Running: ffmpeg %s", operation, strings.Join(args, " "))

	if err := cmd.Run(); err != nil {
		stderr := stderrBuf.String()
		log.Printf("[ffmpeg:%s] STDERR:\n%s", operation, stderr)
		return fmt.Errorf("ffmpeg %s failed (exit code): %w\nstderr: %s", operation, err, stderr)
	}

	return nil
}
