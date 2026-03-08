package ai

import (
	"os"
)

func GetProvider() (AIProvider, error) {
	providerName := os.Getenv("AI_PROVIDER")
	if providerName == "" {
		providerName = "gemini" // Default
	}

	switch providerName {
	case "gemini":
		apiKey := os.Getenv("GEMINI_API_KEY")
		if apiKey == "" {
			return NewNoOpProvider(), nil
		}
		return NewGeminiProvider(apiKey), nil
	case "openai":
		apiKey := os.Getenv("OPENAI_API_KEY")
		if apiKey == "" {
			return NewNoOpProvider(), nil
		}
		return NewOpenAIProvider(apiKey), nil
	case "anthropic":
		apiKey := os.Getenv("ANTHROPIC_API_KEY")
		if apiKey == "" {
			return NewNoOpProvider(), nil
		}
		return NewAnthropicProvider(apiKey), nil
	case "none":
		return NewNoOpProvider(), nil
	default:
		return NewNoOpProvider(), nil
	}
}
