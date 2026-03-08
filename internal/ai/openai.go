package ai

import (
	"context"
	"fmt"
	"log"

	"github.com/sashabaranov/go-openai"
)

type OpenAIProvider struct {
	client *openai.Client
}

func NewOpenAIProvider(apiKey string) *OpenAIProvider {
	return &OpenAIProvider{
		client: openai.NewClient(apiKey),
	}
}

func (p *OpenAIProvider) Name() string {
	return "openai"
}

func (p *OpenAIProvider) Analyze(ctx context.Context, prompt string, audioPath string) (string, error) {
	transcription := ""

	// 1. If audio is provided, transcribe it using Whisper
	if audioPath != "" {
		log.Printf("[OPENAI] Transcribing audio with Whisper: %s", audioPath)
		req := openai.AudioRequest{
			Model:    openai.Whisper1,
			FilePath: audioPath,
		}

		resp, err := p.client.CreateTranscription(ctx, req)
		if err != nil {
			log.Printf("[OPENAI] Whisper transcription failed: %v", err)
			transcription = "\n\n[Note: Audio transcription failed or was not possible.]"
		} else {
			transcription = fmt.Sprintf("\n\n## Interview Audio Transcription:\n%s", resp.Text)
		}
	}

	// 2. Combine the prompt and transcription
	finalPrompt := prompt + transcription

	// 3. Generate the summary using GPT-4o
	log.Printf("[OPENAI] Generating analysis with GPT-4o...")
	resp, err := p.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4o,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are an expert technical and behavioral interview analyst.",
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: finalPrompt,
				},
			},
		},
	)

	if err != nil {
		return "", fmt.Errorf("openai generation error: %w", err)
	}

	if len(resp.Choices) > 0 {
		return resp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("no content returned from openai")
}
