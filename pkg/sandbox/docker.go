package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ExecutionResult from the sandbox run
type SandboxResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
	TimedOut bool
}

// DockerSandbox manages execution inside a pre-warmed Docker container
type DockerSandbox struct {
	Language string
}

// NewDockerSandbox creates a configured docker sandbox runner
func NewDockerSandbox(language string) *DockerSandbox {
	return &DockerSandbox{
		Language: language,
	}
}

// Run executes the given code inside an isolated container
// Exec runs the given code inside a pre-warmed isolated container via docker exec
func (s *DockerSandbox) Exec(ctx context.Context, cid string, sourceCode string, stdin string, timeout time.Duration) (SandboxResult, error) {
	// Create a temporary directory for the code locally
	os.MkdirAll("/tmp/sandbox", 0755)
	tmpDir, err := os.MkdirTemp("/tmp/sandbox", "job-*")
	if err != nil {
		return SandboxResult{}, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Determine filename and exec command dynamically based on language
	var filename string
	var runCmd []string
	switch s.Language {
	case "python3":
		filename = "main.py"
		runCmd = []string{"python3", "/code/main.py"}
	case "javascript":
		filename = "main.js"
		runCmd = []string{"node", "/code/main.js"}
	case "go":
		filename = "main.go"
		runCmd = []string{"sh", "-c", "cd /code && go build -o main main.go && ./main"}
	case "cpp":
		filename = "main.cpp"
		runCmd = []string{"sh", "-c", "g++ /code/main.cpp -o /code/a.out && /code/a.out"}
	default:
		return SandboxResult{}, fmt.Errorf("unsupported language: %s", s.Language)
	}

	codePath := filepath.Join(tmpDir, filename)
	if err := os.WriteFile(codePath, []byte(sourceCode), 0644); err != nil {
		return SandboxResult{}, fmt.Errorf("failed to write source file: %w", err)
	}

	// Rapidly inject the test file into the warm container's /code directory
	cpCmd := exec.Command("docker", "cp", codePath, fmt.Sprintf("%s:/code/%s", cid, filename))
	if err := cpCmd.Run(); err != nil {
		return SandboxResult{}, fmt.Errorf("docker cp failed: %w", err)
	}

	// Create context with timeout to kill exec if it hangs
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Prepare Docker exec command
	args := append([]string{"exec", "-i", cid}, runCmd...)
	cmd := exec.CommandContext(runCtx, "docker", args...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	err = cmd.Run()

	result := SandboxResult{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
	}

	if runCtx.Err() == context.DeadlineExceeded {
		result.TimedOut = true
		result.ExitCode = 128 // Custom timeout code
		return result, nil
	}

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitError.ExitCode()
		} else {
			return result, fmt.Errorf("docker exec error: %w", err)
		}
	}

	return result, nil
}
