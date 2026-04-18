package ffmpeg

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
)

// ExtractAudio extracts the audio track from a video chunk as a mono 16kHz WAV file
// (optimal format for Whisper transcription).
func ExtractAudio(chunkPath, outputDir string, chunkIndex int, audioFormat string) (string, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create audio output dir: %w", err)
	}

	outputFile := filepath.Join(outputDir, fmt.Sprintf("chunk_%03d_audio.%s", chunkIndex, audioFormat))

	var args []string

	switch audioFormat {
	case "wav":
		args = []string{
			"-i", chunkPath,
			"-vn",
			"-acodec", "pcm_s16le",
			"-ar", "16000",
			"-ac", "1",
			"-y",
			outputFile,
		}
	case "mp3":
		args = []string{
			"-i", chunkPath,
			"-vn",
			"-acodec", "libmp3lame",
			"-ar", "16000",
			"-ac", "1",
			"-q:a", "2",
			"-y",
			outputFile,
		}
	default:
		return "", fmt.Errorf("unsupported audio format: %s (use wav or mp3)", audioFormat)
	}

	if err := runFFmpeg(args, fmt.Sprintf("audio_extract_chunk_%03d", chunkIndex)); err != nil {
		return "", err
	}

	log.Printf("[ffmpeg] Extracted audio from chunk %03d → %s", chunkIndex, outputFile)
	return outputFile, nil
}
