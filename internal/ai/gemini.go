package ai

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

type GeminiProvider struct {
	apiKey string
}

func NewGeminiProvider(apiKey string) *GeminiProvider {
	return &GeminiProvider{apiKey: apiKey}
}

func (p *GeminiProvider) Name() string {
	return "gemini"
}

func (p *GeminiProvider) Analyze(ctx context.Context, prompt string, audioPath string) (string, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(p.apiKey))
	if err != nil {
		return "", fmt.Errorf("failed to create gemini client: %w", err)
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-1.5-flash") // Updated to latest stable flash

	var parts []genai.Part

	if audioPath != "" {
		f, err := os.Open(audioPath)
		if err == nil {
			defer f.Close()
			uploadedFile, err := client.UploadFile(ctx, "", f, nil)
			if err == nil {
				log.Printf("[GEMINI] File upload successful: %s. Waiting for ACTIVE state...", uploadedFile.Name)
				maxPolls := 30
				fileActive := false

				for i := 0; i < maxPolls; i++ {
					fileInfo, err := client.GetFile(ctx, uploadedFile.Name)
					if err != nil {
						log.Printf("[GEMINI] Transient error getting file status: %v", err)
					} else if fileInfo.State == genai.FileStateActive {
						parts = append(parts, genai.FileData{URI: uploadedFile.URI})
						fileActive = true
						break
					} else if fileInfo.State == genai.FileStateFailed {
						return "", fmt.Errorf("gemini audio processing failed")
					}
					time.Sleep(3 * time.Second)
				}
				if !fileActive {
					log.Printf("[GEMINI] Warning: Polling timed out for audio processing")
				}
			} else {
				log.Printf("[GEMINI] Error uploading audio: %v", err)
			}
		}
	}

	parts = append(parts, genai.Text(prompt))
	resp, err := model.GenerateContent(ctx, parts...)
	if err != nil {
		return "", fmt.Errorf("gemini generation error: %w", err)
	}

	if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
		if text, ok := resp.Candidates[0].Content.Parts[0].(genai.Text); ok {
			return string(text), nil
		}
	}

	return "", fmt.Errorf("no content returned from gemini")
}
