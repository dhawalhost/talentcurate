package main

import (
	"log"
	"os"

	"github.com/dhawalhost/talentcurate/internal/execution/worker"
)

func main() {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	log.Printf("Starting TalentCurate Worker Node. Connecting to NATS at %s", natsURL)
	worker.RunDaemon(natsURL)
}
