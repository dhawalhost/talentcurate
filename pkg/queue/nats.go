package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/dhawalhost/talentcurate/internal/execution/models"
)

const (
	ExecutionStreamName  = "EXECUTIONS"
	PendingSubject       = "executions.pending"
	CompletedSubjectBase = "executions.completed"
	WorkerConsumerGroup  = "execution-workers"
)

// ExecutionQueue defines the interface for publishing and subscribing to execution jobs
type ExecutionQueue interface {
	PublishRequest(ctx context.Context, req models.ExecutionRequest) error
	PublishResult(ctx context.Context, res models.ExecutionResult) error
	SubscribeToRequests(ctx context.Context, handler func(ctx context.Context, req models.ExecutionRequest, ack func() error, nack func() error)) error
	SubscribeToResults(ctx context.Context, handler func(ctx context.Context, res models.ExecutionResult)) error
	Close()
}

type NATSQueue struct {
	nc *nats.Conn
	js jetstream.JetStream
}

// NewNATSQueue initializes a connection to NATS JetStream and creates the required stream if it doesn't exist
func NewNATSQueue(url string) (*NATSQueue, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize JetStream: %w", err)
	}

	// Create or update the stream
	ctx := context.Background()
	_, err = js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:     ExecutionStreamName,
		Subjects: []string{PendingSubject, CompletedSubjectBase + ".>"},
		Storage:  jetstream.FileStorage,
	})
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to create/update stream: %w", err)
	}

	return &NATSQueue{
		nc: nc,
		js: js,
	}, nil
}

func (q *NATSQueue) PublishRequest(ctx context.Context, req models.ExecutionRequest) error {
	payload, err := json.Marshal(req)
	if err != nil {
		return err
	}
	_, err = q.js.Publish(ctx, PendingSubject, payload)
	return err
}

func (q *NATSQueue) PublishResult(ctx context.Context, res models.ExecutionResult) error {
	payload, err := json.Marshal(res)
	if err != nil {
		return err
	}
	subject := fmt.Sprintf("%s.%s", CompletedSubjectBase, res.SessionID)
	_, err = q.js.Publish(ctx, subject, payload)
	return err
}

func (q *NATSQueue) SubscribeToRequests(ctx context.Context, handler func(ctx context.Context, req models.ExecutionRequest, ack func() error, nack func() error)) error {
	consumer, err := q.js.CreateOrUpdateConsumer(ctx, ExecutionStreamName, jetstream.ConsumerConfig{
		Durable:       WorkerConsumerGroup,
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       2 * time.Minute,
		FilterSubject: PendingSubject,
	})
	if err != nil {
		return fmt.Errorf("failed to create consumer: %w", err)
	}

	iter, err := consumer.Messages()
	if err != nil {
		return fmt.Errorf("failed to get messages iter: %w", err)
	}

	go func() {
		for {
			msg, err := iter.Next()
			if err != nil {
				// Handle context cancellation or connection issues
				if ctx.Err() != nil {
					return
				}
				continue
			}

			var req models.ExecutionRequest
			if err := json.Unmarshal(msg.Data(), &req); err != nil {
				// Log error, drop malformed message
				msg.Term()
				continue
			}

			// Pass message to handler
			handler(ctx, req, func() error { return msg.Ack() }, func() error { return msg.Nak() })
		}
	}()

	return nil
}

func (q *NATSQueue) SubscribeToResults(ctx context.Context, handler func(ctx context.Context, res models.ExecutionResult)) error {
	consumer, err := q.js.CreateOrUpdateConsumer(ctx, ExecutionStreamName, jetstream.ConsumerConfig{
		Durable:       "gateway-results-listener",
		AckPolicy:     jetstream.AckNonePolicy, // Fire and forget for results
		FilterSubject: CompletedSubjectBase + ".>",
	})
	if err != nil {
		return fmt.Errorf("failed to create results consumer: %w", err)
	}

	iter, err := consumer.Messages()
	if err != nil {
		return fmt.Errorf("failed to get messages iter: %w", err)
	}

	go func() {
		for {
			msg, err := iter.Next()
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				continue
			}

			var res models.ExecutionResult
			if err := json.Unmarshal(msg.Data(), &res); err != nil {
				continue
			}

			handler(ctx, res)
		}
	}()

	return nil
}

func (q *NATSQueue) Close() {
	if q.nc != nil {
		q.nc.Close()
	}
}
