package ai

import (
	"context"
)

// AIProvider defines the interface for different LLM implementations.
type AIProvider interface {
	// Analyze processes the interview data (prompt + optional audio) and returns a summary.
	Analyze(ctx context.Context, prompt string, audioPath string) (string, error)
	// Name returns the provider identifier.
	Name() string
}
