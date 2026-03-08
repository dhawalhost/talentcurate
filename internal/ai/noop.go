package ai

import (
	"context"
	"log"
)

type NoOpProvider struct{}

func NewNoOpProvider() *NoOpProvider {
	return &NoOpProvider{}
}

func (p *NoOpProvider) Name() string {
	return "noop (disabled)"
}

func (p *NoOpProvider) Analyze(ctx context.Context, prompt string, audioPath string) (string, error) {
	log.Printf("[NOOP] AI Analysis bypassed because no valid API key was provided.")
	return "AI Analysis Disabled: No API key configured. The session recording has been saved successfully.", nil
}
