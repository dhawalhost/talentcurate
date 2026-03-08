package question

import (
	"encoding/json"
	"time"
)

type TestCase struct {
	Input          string `json:"input"`
	ExpectedOutput string `json:"expected_output"`
	Description    string `json:"description,omitempty"`
}

type Question struct {
	ID              string          `json:"id"`
	Title           string          `json:"title"`
	Description     string          `json:"description"`
	DefaultLanguage string          `json:"default_language"`
	StarterCode     string          `json:"starter_code"`
	TestCases       json.RawMessage `json:"test_cases"` // stores raw JSON array of TestCase
	QuestionType    string          `json:"question_type"`
	CreatedAt       time.Time       `json:"created_at"`
}
