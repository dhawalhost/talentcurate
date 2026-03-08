package sandbox

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
)

// ResourceLimits defines bounds for the Docker container natively via cgroups
type ResourceLimits struct {
	CPURestriction string // e.g. "0.5"
	MemoryLimitMB  int    // e.g. 256
	PidsLimit      int    // e.g. 64
	NetworkDisable bool   // e.g. true
}

// PoolManager maintains pre-warmed Docker containers for fast execution.
type PoolManager struct {
	pools  map[string]chan string
	limits ResourceLimits
	wg     sync.WaitGroup
}

// NewPoolManager initializes and pre-warms containers
func NewPoolManager(limits ResourceLimits, poolSize int) *PoolManager {
	langs := []string{"python3", "javascript", "go", "cpp"}
	pools := make(map[string]chan string)

	for _, lang := range langs {
		pools[lang] = make(chan string, poolSize)
	}

	pm := &PoolManager{
		pools:  pools,
		limits: limits,
	}

	// Initial Pre-warm
	log.Printf("Initializing sandbox pool (size %d per language)...", poolSize)
	for _, lang := range langs {
		for i := 0; i < poolSize; i++ {
			pm.spawnAsync(lang)
		}
	}
	return pm
}

func (pm *PoolManager) spawnAsync(lang string) {
	pm.wg.Add(1)
	go func() {
		defer pm.wg.Done()
		cid, err := pm.spawn(lang)
		if err != nil {
			log.Printf("Failed to spawn %s container: %v", lang, err)
			return
		}
		pm.pools[lang] <- cid
	}()
}

func (pm *PoolManager) spawn(lang string) (string, error) {
	var imageURI string
	switch lang {
	case "python3":
		imageURI = "python:3.11-alpine"
	case "javascript":
		imageURI = "node:20-alpine"
	case "go":
		imageURI = "golang:1.24-alpine"
	case "cpp":
		imageURI = "gcc:latest"
	default:
		return "", fmt.Errorf("unsupported language: %s", lang)
	}

	args := []string{
		"run", "-d", "--rm",
	}

	if pm.limits.CPURestriction != "" {
		args = append(args, "--cpus", pm.limits.CPURestriction)
	}
	if pm.limits.MemoryLimitMB > 0 {
		args = append(args, "-m", fmt.Sprintf("%dm", pm.limits.MemoryLimitMB))
	}
	if pm.limits.PidsLimit > 0 {
		args = append(args, "--pids-limit", fmt.Sprintf("%d", pm.limits.PidsLimit))
	}
	if pm.limits.NetworkDisable {
		args = append(args, "--network", "none")
	}

	// Add persistent volume caching for Go compilation
	if lang == "go" {
		args = append(args, "-v", "spinvel-go-build-cache:/root/.cache/go-build")
		args = append(args, "-v", "spinvel-go-mod-cache:/go/pkg/mod")
	}

	// Idle entrypoint
	args = append(args, imageURI, "tail", "-f", "/dev/null")

	cmd := exec.Command("docker", args...)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}

	cid := strings.TrimSpace(string(out))
	// Ensure /code directory exists inside warm container
	exec.Command("docker", "exec", cid, "mkdir", "-p", "/code").Run()

	return cid, nil
}

// GetContainer returns a warm container ID, or creates one on demand if pool is empty
func (pm *PoolManager) GetContainer(ctx context.Context, lang string) (string, error) {
	pool, ok := pm.pools[lang]
	if !ok {
		return "", fmt.Errorf("no pool for %s", lang)
	}

	select {
	case cid := <-pool:
		return cid, nil
	default:
		// Pool empty, fallback to on-demand sync allocation while refilling pool
		pm.spawnAsync(lang)
		log.Printf("Pool empty for %s, spawning on-demand...", lang)
		return pm.spawn(lang)
	}
}

// ReplaceContainer destroys the used container and spins up a fresh idle replacement
func (pm *PoolManager) ReplaceContainer(lang string, oldCid string) {
	go func() {
		// Asynchronous teardown
		exec.Command("docker", "rm", "-f", oldCid).Run()
		// Replenish
		pm.spawnAsync(lang)
	}()
}
