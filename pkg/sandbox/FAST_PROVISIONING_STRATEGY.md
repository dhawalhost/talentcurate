# Fast Provisioning Strategy: Pre-Warmed Sandbox Pool

## Problem Statement
Cold-starting a Docker container takes ~600ms - 1500ms depending on the host daemon and image size. To achieve our Core Value Proposition of **<500ms compile latency**, we cannot cold-start execution environments on demand.

## Proposed Strategy: Sandbox Pre-Warming

Instead of running `docker run` synchronously when a job arrives, the Worker Node will manage a background **Pool Manager** for each supported language.

### State Machine of a Sandbox

1. **PRE_WARMING:** Worker creates a new container using `docker create --read-only --network none ...`.
2. **READY:** The container is running or paused (`docker start` -> `docker pause`), waiting for code.
3. **EXECUTING:** The code payload is injected, the container unpauses, and runs the script.
4. **CLEANING / DESTROYED:** The container is thrown away (we never reuse environments for security against data leaks).

### Code Injection without Volume Binding
Since we cannot attach volumes (`-v /tmp/code:/code`) *after* a container starts, we have two options to inject code into a pre-warmed container:

**Option A: STDIN Pumping**
- The container runs a lightweight init script (e.g., in Python or Go).
- It waits for code over STDIN.
- Worker pipes the candidate's code + test suite through `docker exec -i <container_id>`.
- The init script receives it, evals it, and returns the result to STDOUT.
- *Pros:* Extremely fast (~10ms injection latency).
- *Cons:* The init script must be carefully written to avoid language-level breakouts.

**Option B: `docker cp`**
- Container is paused.
- Worker runs `docker cp /tmp/user_code.py <container_id>:/tmp/main.py`.
- Worker unpauses via `docker unpause`.
- Worker issues `docker exec <container_id> python3 /tmp/main.py`.
- *Pros:* Standardized. No special init script.
- *Cons:* Slightly higher file I/O latency.

### Implementation Plan for Phase 3/4
For the current Phase 2 MVP, we execute synchronously using a cold-boot sequence (`docker run`) to validate the core architecture limits (cgroups, RAM, PIDs). 

Once stable, we will refactor the `sandbox.DockerSandbox` interface into a `PoolManager` using **Option A (STDIN Pumping)** for ultimate performance.
