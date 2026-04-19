package callback

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"time"
)

// MS4Notifier handles sending status callbacks to MS4.
type MS4Notifier struct {
	callbackURL string
	apiKey      string
	httpClient  *http.Client
	maxRetries  int
}

// NewMS4Notifier creates a new MS4 callback notifier.
func NewMS4Notifier(callbackURL, apiKey string) *MS4Notifier {
	return &MS4Notifier{
		callbackURL: callbackURL,
		apiKey:      apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		maxRetries: 5,
	}
}

// Notify sends a callback payload to MS4. Retries up to maxRetries times
// with exponential backoff. Returns an error only if all attempts fail.
func (n *MS4Notifier) Notify(ctx context.Context, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal callback payload: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= n.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
			wait := backoff + jitter
			log.Printf("[callback] Retry %d/%d (waiting %v)", attempt, n.maxRetries, wait)
			time.Sleep(wait)
		}

		err := n.sendOnce(ctx, data)
		if err == nil {
			log.Printf("[callback] Successfully notified MS4")
			return nil
		}
		lastErr = err
		log.Printf("[callback] Attempt %d/%d failed: %v", attempt+1, n.maxRetries+1, err)
	}

	return fmt.Errorf("failed to notify MS4 after %d attempts: %w", n.maxRetries+1, lastErr)
}

func (n *MS4Notifier) sendOnce(ctx context.Context, data []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, n.callbackURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-API-Key", n.apiKey)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	return fmt.Errorf("MS4 returned status %d", resp.StatusCode)
}
