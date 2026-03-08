package worker

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dhawalhost/talentcurate/internal/execution/models"
	"github.com/dhawalhost/talentcurate/pkg/queue"
	"github.com/dhawalhost/talentcurate/pkg/sandbox"
)

type Worker struct {
	queue queue.ExecutionQueue
	pool  *sandbox.PoolManager
}

func NewWorker(q queue.ExecutionQueue, pm *sandbox.PoolManager) *Worker {
	return &Worker{
		queue: q,
		pool:  pm,
	}
}

func (w *Worker) Start(ctx context.Context) error {
	err := w.queue.SubscribeToRequests(ctx, func(handlerCtx context.Context, req models.ExecutionRequest, ack func() error, nack func() error) {
		log.Printf("Received execution job: %s, language: %s", req.ExecutionID, req.Language)

		// 1. Acknowledge immediately to avoid redelivery by NATS (we take ownership)
		// Alternatively, we could delay Ack until completion to ensure reliability across worker crashes.
		// For MVP, we ack at the end, handling worker crashes cleanly.

		// 2. Perform Execution
		start := time.Now()
		res := w.executeJob(handlerCtx, req)
		res.RuntimeMs = int(time.Since(start).Milliseconds())

		// 3. Publish Result
		if err := w.queue.PublishResult(handlerCtx, res); err != nil {
			log.Printf("Failed to publish result for job %s: %v", req.ExecutionID, err)
			nack()
			return
		}

		// 4. Ack the job successfully
		if err := ack(); err != nil {
			log.Printf("Failed to ack job %s: %v", req.ExecutionID, err)
		}

		log.Printf("Successfully completed job %s in %d ms", req.ExecutionID, res.RuntimeMs)
	})

	if err != nil {
		return fmt.Errorf("failed to subscribe to requests: %w", err)
	}

	log.Println("Worker successfully subscribed to execution requests queue. Waiting for jobs...")

	// Block until context cancellation
	<-ctx.Done()
	log.Println("Worker shutting down...")
	return nil
}

// executeJob invokes the given language Sandbox to run code.
func (w *Worker) executeJob(ctx context.Context, req models.ExecutionRequest) models.ExecutionResult {
	// 1. Get a pre-warmed background container from the Pool
	cid, err := w.pool.GetContainer(ctx, req.Language)
	if err != nil {
		return models.ExecutionResult{
			ExecutionID: req.ExecutionID,
			SessionID:   req.SessionID,
			Status:      "ERROR",
			GlobalError: fmt.Sprintf("sandbox pooling failed: %v", err),
			CompletedAt: time.Now(),
		}
	}

	// Ensure auto-replacement & destruction when job finishes
	defer w.pool.ReplaceContainer(req.Language, cid)

	// 2. Setup Sandbox interface
	sb := sandbox.NewDockerSandbox(req.Language)

	// 3. Execute with extended 60s timeout inside warm container
	res, err := sb.Exec(ctx, cid, req.SourceCode, req.Stdin, 60*time.Second)

	// 4. Transform Result
	execResult := models.ExecutionResult{
		ExecutionID: req.ExecutionID,
		SessionID:   req.SessionID,
		CompletedAt: time.Now(),
	}

	if err != nil {
		execResult.Status = "ERROR"
		execResult.GlobalError = fmt.Sprintf("execution failed: %v", err)
		return execResult
	}

	if res.TimedOut {
		execResult.Status = "TIMEOUT"
	} else if res.ExitCode != 0 {
		execResult.Status = "ERROR"
	} else {
		execResult.Status = "COMPLETED"
	}

	// TODO: Handle Multiple Test Cases. MVP: 1 test case wrapper
	execResult.Results = []models.TestCaseResult{
		{
			TestCaseID: "run",
			Passed:     res.ExitCode == 0,
			Stdout:     res.Stdout,
			Stderr:     res.Stderr,
			ExitCode:   res.ExitCode,
		},
	}

	return execResult
}

func RunDaemon(natsURL string) {
	q, err := queue.NewNATSQueue(natsURL)
	if err != nil {
		log.Fatalf("Failed to initialize queue: %v", err)
	}
	defer q.Close()

	limits := sandbox.ResourceLimits{
		CPURestriction: "0.5",
		MemoryLimitMB:  256,
		PidsLimit:      64,
		NetworkDisable: true,
	}
	pm := sandbox.NewPoolManager(limits, 2) // Cache 2 warm containers per language

	w := NewWorker(q, pm)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh
		log.Println("Interrupt received, cancelling worker context...")
		cancel()
	}()

	if err := w.Start(ctx); err != nil {
		log.Fatalf("Worker encountered error: %v", err)
	}
}
