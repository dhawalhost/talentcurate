package main

import (
	"log"
	"os"

	"github.com/spinvel/interview-system/internal/db"
	"github.com/spinvel/interview-system/internal/gateway"
	"github.com/spinvel/interview-system/pkg/queue"
)

func main() {
	if err := db.Initialize(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	log.Printf("Connecting to NATS at %s", natsURL)
	q, err := queue.NewNATSQueue(natsURL)
	if err != nil {
		log.Fatalf("Failed to initialize queue: %v", err)
	}
	defer q.Close()

	gw := gateway.NewGateway(addr, q)
	log.Printf("Starting Spinvel API Gateway on port %s", port)
	if err := gw.Start(); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
