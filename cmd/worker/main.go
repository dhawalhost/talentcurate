package main

import (
	"log"
	"os"

	"github.com/spinvel/interview-system/internal/execution/worker"
)

func main() {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	log.Printf("Starting Spinvel Worker Node. Connecting to NATS at %s", natsURL)
	worker.RunDaemon(natsURL)
}
