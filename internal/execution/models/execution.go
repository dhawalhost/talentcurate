package models

import "time"

// ExecutionRequest represents a job submitted by the gateway to the queue
type ExecutionRequest struct {
	ExecutionID string     `json:"execution_id"`
	SessionID   string     `json:"session_id"`
	Language    string     `json:"language"`
	SourceCode  string     `json:"source_code"`
	Stdin       string     `json:"stdin,omitempty"`
	TestCases   []TestCase `json:"test_cases,omitempty"`
	SubmittedAt time.Time  `json:"submitted_at"`
}

// TestCase represents a single input/expected output pair
type TestCase struct {
	ID             string `json:"id"`
	Input          string `json:"input"`
	ExpectedOutput string `json:"expected_output"`
	IsHidden       bool   `json:"is_hidden"`
}

// ExecutionResult represents the final status published back to the gateway
type ExecutionResult struct {
	ExecutionID string           `json:"execution_id"`
	SessionID   string           `json:"session_id"`
	Status      string           `json:"status"` // COMPLETED, ERROR, TIMEOUT
	RuntimeMs   int              `json:"runtime_ms"`
	MemoryKb    int              `json:"memory_kb"`
	Results     []TestCaseResult `json:"results"`
	GlobalError string           `json:"global_error,omitempty"`
	CompletedAt time.Time        `json:"completed_at"`
}

// TestCaseResult represents the outcome of running a single test case
type TestCaseResult struct {
	TestCaseID string `json:"test_case_id"`
	Passed     bool   `json:"passed"`
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   int    `json:"exit_code"`
}
