# Multi-Agent Concurrency & Distributed Coordination Protocol

> **Canonical Reference**: `AI-Builder-Brain/04_WORKFLOWS/multi-agent-concurrency-protocol.md`  
> **Coordinator Engine**: `04_WORKFLOWS/factory-engine/concurrency-coordinator.mjs`  
> **Lock Storage**: `.harvest-locks/` (Ignored in `.gitignore`)  
> **Control State**: `harvest-control.json` (`concurrencyMode`)  
> **Supported Policies**: `PARALLEL_MULTI_AGENT` (Default) & `SINGLE_AGENT_MUTEX`  

---

## 1. Executive Summary

AI-Builder-Brain supports **both concurrent multi-agent parallel harvesting AND strict single-agent serialized harvesting**.

You can have multiple AI agents (e.g. Agent A on laptop running Full Clone, Agent B on laptop running Zero-Clone, Agent C in GitHub Actions Cloud 24/7, and Agent D bridging a local SaaS project) running simultaneously without any collisions, lock inversions, or lost commits.

---

## 2. The Two Operating Concurrency Modes

### Mode 1: Safe Multi-Agent Parallel Execution (`PARALLEL_MULTI_AGENT`) — *Default & Recommended*
- **Behavior**: Multiple agents work concurrently on different repositories.
- **Work-Stealing & Non-Blocking**:
  - When Agent 1 picks `shadcn-ui/ui`, it acquires a lock `.harvest-locks/shadcn-ui-ui.lock`.
  - When Agent 2 or Cloud Runner inspects `repos.txt`, it sees `shadcn-ui/ui` is locked, skips it in 0.01 seconds, and claims `vllm-project/vllm`.
  - Both agents harvest at full speed in parallel!
- **Zero Token Waste**: No duplicate harvesting.

### Mode 2: Strict Single-Agent Mutex (`SINGLE_AGENT_MUTEX`)
- **Behavior**: Only **one agent** is permitted to harvest across the entire Brain at any given moment.
- **Global Mutex**:
  - First agent acquires `.harvest-locks/global-mutex.lock`.
  - Any subsequent agent attempting to harvest detects the global lock and gracefully backs off until the active agent finishes.

---

## 3. The 4 Multi-Agent Collision Protections

| Challenge | Concurrency Risk | Master Brain Solution |
|---|---|---|
| **Git Push Collisions** | Two agents finish at the same second and both push to `origin main`, causing non-fast-forward push rejection. | **Atomic Rebase-Retry Push Barrier (`pushWithRebaseRetry`)**: Automatically runs `git pull --rebase origin main` with random exponential jitter and retries push up to 5 times. 100% collision-free. |
| **Work Duplication** | Multiple agents pick the same repo and burn tokens doing redundant work. | **Distributed Target Locks (`.harvest-locks/<target>.lock`)**: Locks are atomic, process-aware, and include TTL expiration (30 minutes) to avoid deadlocks if an agent crashes. |
| **Rule Number Collisions** | Two agents promote new rules at the same time and both name their rule "Rule 72". | **Dynamic Rule Number Resolution (`resolveNextRuleNumber`)**: Dynamically parses the highest existing rule number from `05_KNOWLEDGE/engineering-patterns.md` at the exact millisecond of write. |
| **Registry Overwrites** | Concurrent writes to `sources-registry.json` clobbering metadata. | **Atomic Read-Merge-Write**: Each agent merges its specific repository key while preserving sibling entries. |

---

## 4. How to Switch Modes

### In Chat (Any AI Agent):
- *"Harvester ko parallel multi agent mode mein set karo"* -> Sets `concurrencyMode: "PARALLEL_MULTI_AGENT"`.
- *"Harvester ko single agent mode mein set karo"* -> Sets `concurrencyMode: "SINGLE_AGENT_MUTEX"`.

### In `harvest-control.json`:
```json
{
  "concurrencyMode": "PARALLEL_MULTI_AGENT"
}
```
