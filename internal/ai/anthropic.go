package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

const anthropicAPIURL = "https://api.anthropic.com/v1/messages"

type AnthropicProvider struct {
	apiKey string
	client *http.Client
}

func NewAnthropicProvider(apiKey string) *AnthropicProvider {
	return &AnthropicProvider{
		apiKey: apiKey,
		client: &http.Client{},
	}
}

func (p *AnthropicProvider) Name() string {
	return "anthropic"
}

func (p *AnthropicProvider) Analyze(ctx context.Context, prompt string, audioPath string) (string, error) {
	// Anthropic's Claude currently focuses on text.
	if audioPath != "" {
		log.Printf("[ANTHROPIC] Note: Audio path provided (%s), but Anthropic provider currently only analyzes code submissions.", audioPath)
	}

	log.Printf("[ANTHROPIC] Generating analysis with Claude 3.5 Sonnet...")

	reqBody := map[string]interface{}{
		"model":      "claude-3-5-sonnet-20241022",
		"max_tokens": 1024,
		"system":     "You are an expert technical and behavioral interview analyst.",
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": prompt,
			},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal anthropic request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", anthropicAPIURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create anthropic request: %w", err)
	}

	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("anthropic api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode anthropic response: %w", err)
	}

	if len(result.Content) > 0 && result.Content[0].Type == "text" {
		return result.Content[0].Text, nil
	}

	return "", fmt.Errorf("no text content returned from anthropic")
}
