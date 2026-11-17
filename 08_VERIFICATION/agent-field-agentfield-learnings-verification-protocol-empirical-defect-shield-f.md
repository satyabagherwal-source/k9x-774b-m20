# Verification Protocol: Verification Protocol: Empirical Defect Shield for agent-field-agentfield-learnings

<!-- PROVENANCE_START
{
  "source_repository": "agent-field-agentfield-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:20:45.459Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-field-agentfield-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-field-agentfield-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:20:45.459Z`  
> **Learning ID**: `LEARN-EVO-agent-field-agentfield-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `agent-field-agentfield-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source**: github ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Source Version**: `161cab6a`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T06:20:36.056Z  
> **Learning ID**: `learn-github-agent-field-agentfield`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Agent-Field/agentfield

---

## 1. Executive Forensic Architecture & System Mechanics

AgentField is a distributed runtime and control plane designed to execute, scale, and orchestrate heterogeneous AI agents (written in Go, Python, or TypeScript) as first-class, authenticated microservices. Rather than treating agents as short-lived CLI scripts or unmanaged background jobs, AgentField models each agent as a long-lived RPC node capable of participating in large-scale DAG workflows, real-time memory synchronization, and cryptographic identity federation.

```
+-----------------------------------------------------------------------------------+
|                            AGENTFIELD CONTROL PLANE                               |
|                                                                                   |
|  +------------------------+   +-----------------------+   +--------------------+  |
|  |  DID / Key Derivation  |   | Memory Pub/Sub Engine |   |  Workflow Engine   |  |
|  |   Identity Service     |   |  (Sync Pub / Drop)    |   |  DAG Orchestrator  |  |
|  +-----------+------------+   +-----------+-----------+   +---------+----------+  |
+--------------|----------------------------|-------------------------|-------------+
               |                            | (WS / SSE Streams)      |
               | (mTLS / DID / Ed25519)     v                         | (HTTP / RPC)
+--------------v------------------------------------------------------v-------------+
|                          AGENT NODE HOST / RUNTIME                                |
|                                                                                   |
|  +------------------------+   +-----------------------+   +--------------------+  |
|  | Subprocess / Supervisor|   | Port Reservation Gate |   | Memory Watch Cache |  |
|  |  (PID / OS Signal Grp) |   | (Probe & Fast-Retry)  |   | (Backfill & Gap)   |  |
|  +------------------------+   +-----------------------+   +--------------------+  |
+-----------------------------------------------------------------------------------+
```

### Subsystem Boundaries & Invariant Contracts

1. **Control Plane / Event Dispatch Subsystem**:
   - Manages stateful memory event pub/sub.
   - Enforces *synchronous publisher handoff* into bounded subscriber channels.
   - Converts unhandled slow consumers into fast-failing disconnects with explicit protocol frames (`WS CloseTryAgainLater 1013` or SSE `event: error`), rejecting silent event loss.
2. **DID (Decentralized Identifier) Cryptographic Federation Subsystem**:
   - Generates and persists identity packages (agent DIDs, reasoner DIDs, skill DIDs) backed by hierarchical derivation paths and JSON Web Keys (JWKs).
   - Manages atomic differential analysis across concurrent replicas to prevent clobbering or reissuing keys for existing subcomponents.
3. **Process Supervision & Lifecycle Management**:
   - Supervises external Python, Go, and TypeScript processes.
   - Enforces process group isolation (`syscall.Kill(-PID, SIGINT)`) to prevent zombie leaf processes.
   - Manages port allocation, TOCTOU-safe port reservation, and runtime registry state reconciliation.

---

## 2. Universal Engineering Rules

### 1. Zero Silent Event Dropping in Real-Time Pub/Sub Streams
**RULE**:
A message broker or pub/sub distribution loop MUST NOT silently drop messages when downstream consumer buffers overflow. If a consumer's bounded buffer fills, the server MUST immediately evict that consumer, close its transport channel, and signal an explicit stream interruption code (`WS CloseTryAgainLater (1013)` or SSE `event: error`). Concurrently, event publication MUST execute synchronously across subscribers to guarantee deterministic intra-stream ordering.

**WHY**:
Silent drops (`default: // drop message`) produce silent divergence between publisher state and subscriber memory. AI agents acting on partial state histories execute hallucinated or corrupt branch logic. Closing the stream forces the agent SDK to enter an explicit reconnect-and-backfill sequence.

**WHEN TO APPLY**:
Apply to any real-time WebSocket, SSE, or gRPC streaming pipeline that dispatches domain events, state diffs, or cache invalidation events to remote worker nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package pubsub

import (
	"context"
	"slices"
	"sync"
)

type MemorySubscriber struct {
	Ch              chan Event
	CloseOnOverflow bool
}

type EventBroker struct {
	mu          sync.RWMutex
	subscribers map[string][]*MemorySubscriber
}

func (b *EventBroker) Publish(ctx context.Context, targetKey string, ev Event) {
	type overflowEntry struct {
		key string
		sub *MemorySubscriber
	}
	var overflowed []overflowEntry

	b.mu.RLock()
	subs := b.subscribers[targetKey]
	for _, sub := range subs {
		select {
		case sub.Ch <- ev:
			// Message accepted into bounded buffer in publication order.
		default:
			// Buffer is saturated.
			if sub.CloseOnOverflow {
				overflowed = append(overflowed, overflowEntry{key: targetKey, sub: sub})
			}
		}
	}
	b.mu.RUnlock()

	// Evict slow subscribers and signal gap failure
	if len(overflowed) > 0 {
		b.mu.Lock()
		for _, o := range overflowed {
			idx := slices.Index(b.subscribers[o.key], o.sub)
			if idx != -1 {
				b.subscribers[o.key] = slices.Delete(b.subscribers[o.key], idx, idx+1)
				close(o.sub.Ch) // Reading goroutine immediately detects stream truncation
			}
		}
		b.mu.Unlock()
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Silent event drop causes state corruption downstream
select {
case sub.Ch <- ev:
default:
    // Bug: Event is lost forever; consumer believes it has full state
    log.Warn("Subscriber buffer full, dropping event silently")
}
```

**VERIFICATION METHOD**:
Run an integration test where a subscriber stops reading from `sub.Ch`. Publish `buffer_capacity + 1` events. Assert that the subscriber channel closes, `sub.Events()` terminates, and the consumer detects a non-nil gap error requiring a historical replay.

---

### 2. Single-Snapshot Invariant on Multi-Replica Idempotent Mutations
**RULE**:
When performing differential operations (such as detecting whether child resources need to be generated or allocated) against an existing entity, the differential analysis MUST run against the identical entity snapshot used to formulate the base response. The orchestrator MUST NOT perform a secondary read from the database between diffing and responding, and MUST preserve concurrently issued sub-components without re-allocating or discarding cryptographic keys.

**WHY**:
In multi-replica distributed systems, reading state at $T_1$, analyzing at $T_2$, and querying again at $T_3$ introduces a Time-Of-Check to Time-Of-Use (TOCTOU) race condition. A concurrent worker issuing a sub-resource will cause the secondary read to diverge from the primary diff, resulting in partial registration drops, key overwrites, or duplicate identity minting.

**WHEN TO APPLY**:
All idempotent registration handlers, resource allocation engines, and identity-derivation services managing nested child collections (e.g., agent sub-skills, reasoner keys, dynamic endpoints).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Pure functional differential analysis: accepts an immutable snapshot
func (s *IdentityService) PerformDifferentialAnalysis(
	existing *AgentSnapshot,
	requestedReasoners []string,
	requestedSkills []string,
) *DiffResult {
	existingReasoners := make(map[string]struct{}, len(existing.Reasoners))
	for _, r := range existing.Reasoners {
		existingReasoners[r.ID] = struct{}{}
	}

	diff := &DiffResult{
		NewReasonerIDs: setDifference(requestedReasoners, existingReasoners),
		RequiresUpdate: false,
	}
	if len(diff.NewReasonerIDs) > 0 {
		diff.RequiresUpdate = true
	}
	return diff
}

func (s *IdentityService) RegisterAgentOnce(ctx context.Context, req *RegistrationRequest) (*RegistrationResponse, error) {
	existingAgent, err := s.storage.GetAgent(ctx, req.AgentNodeID)
	if err != nil {
		return nil, err
	}

	// CRITICAL: Diff directly against the retrieved snapshot
	diff := s.PerformDifferentialAnalysis(existingAgent, req.Reasoners, req.Skills)
	if !diff.RequiresUpdate {
		// Return package strictly mapped from the exact snapshot verified
		return &RegistrationResponse{
			Success:         true,
			IdentityPackage: s.buildExistingPackage(existingAgent),
		}, nil
	}

	// Handle partial additions, merging newly allocated and existing child keys
	return s.handlePartialRegistration(ctx, req, existingAgent, diff)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Double-reading the database invites TOCTOU race bugs
func (s *IdentityService) Register(ctx context.Context, req *RegistrationRequest) (*Response, error) {
    existingAgent, _ := s.storage.GetAgent(ctx, req.ID)
    // Secondary database read inside helper introduces divergence
    diff, _ := s.performDiffByQueryingDBAgain(ctx, req.ID, req.Skills)
    ...
}
```

**VERIFICATION METHOD**:
Inject a synchronization barrier (`store.afterRead`) immediately following the first database read in an integration test. Run a competing thread that registers a new skill during this pause. Assert that both threads complete without clobbering keys and that both client responses contain valid, non-colliding key material.

---

### 3. Cross-Platform Lexicographic Key Sequencing Invariant
**RULE**:
When sequential or time-series events are indexed using string keys (such as BoltDB/bbolt, BadgerDB, or RocksDB key paths), integer identifiers MUST be formatted with zero-padding to their maximum width (e.g., `%020d`), or sort orders MUST be restored via explicit numerical parsing (`slices.SortStableFunc` with `strconv.ParseUint`) before serving. Key glob matching MUST use deterministic POSIX path rules (`path.Match`) rather than host-dependent filesystem rules (`filepath.Match`).

**WHY**:
Embedded KV engines order keys lexicographically: the string `"10"` sorts before `"2"`. If database cursors scan range segments relying on string sorting, consumers receive chronological events out of order, corrupting time-series stream reconstitutions. On Windows, `filepath.Match` interprets `\` as a directory separator, breaking glob patterns designed for cross-platform event keys.

**WHEN TO APPLY**:
Storage engines, cursor-based pagination, LSM-tree key designs, and pattern-matching routers handling structured event keys (e.g., `scope/scopeID/sequence`).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package storage

import (
	"cmp"
	"path"
	"slices"
	"strconv"
)

// Ensure POSIX cross-platform semantics regardless of host OS
func MatchKeyPatterns(patterns []string, key string) bool {
	if len(patterns) == 0 {
		return true
	}
	for _, pattern := range patterns {
		// MUST use path.Match, NEVER filepath.Match
		if matched, err := path.Match(pattern, key); err == nil && matched {
			return true
		}
	}
	return false
}

func RestoreSequenceOrder(events []*MemoryChangeEvent) {
	// Re-establish numerical order against lexicographically scanned keys
	slices.SortStableFunc(events, func(a, b *MemoryChangeEvent) int {
		ai, _ := strconv.ParseUint(a.ID, 10, 64)
		bi, _ := strconv.ParseUint(b.ID, 10, 64)
		return cmp.Compare(ai, bi)
	})
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Host-dependent globbing and raw lexicographic return
import "path/filepath"

func IsMatch(pattern, key string) bool {
    // FAILS ON WINDOWS: Treats '/' as invalid or non-separator, behaves differently than Linux CI
    matched, _ := filepath.Match(pattern, key)
    return matched
}
```

**VERIFICATION METHOD**:
Store 12 events numbered `1` through `12` in an embedded BoltDB instance. Query the event history using a limit of 1. Assert that the returned event is strictly key `12` (highest sequence) and not `9`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Memory Event Pub/Sub Channel Leak & Out-of-Order Delivery (BUG-AF-01)
- **Context**: `control-plane/internal/handlers/memory_events.go`, `control-plane/internal/storage/local.go`
- **What Was Expected**: Memory events should be delivered in exact sequence to connected clients; disconnected WebSocket/SSE connections should immediately free resources; slow clients should not block the server.
- **What Actually Happened**: The server spawned an unbounded asynchronous goroutine on each publication (`go func() { ... }`), leading to race conditions where later events overtook earlier ones. Dropped connections left active channels in `ls.subscribers`, leaking memory. Full channels silently discarded individual events, creating hidden state gaps in downstream agents.
- **Evidence in Repo**: Commit `6b09e655`, PR `#1207`.
- **Root Cause**: `Publish` spun off a separate goroutine per message without synchronization. Subscriber map maintenance lacked lifecycle binding to HTTP request contexts.
- **Remediation Code Diff**:
```go
// In control-plane/internal/storage/local.go:
- func (ls *LocalStorage) publishMemoryChange(event types.MemoryChangeEvent) {
- 	go func() {
- 		ls.mu.RLock()
- 		defer ls.mu.RUnlock()
- 		for key := range targets {
- 			if subscribers, ok := ls.subscribers[key]; ok {
- 				for _, subChannel := range subscribers {
- 					select {
- 					case subChannel <- event:
- 					default:
- 						fmt.Printf("Warning: Memory change subscriber channel for '%s' is full, dropping event.\n", key)
- 					}
- 				}
- 			}
- 		}
- 	}()
- }
+ func (ls *LocalStorage) publishMemoryChange(event types.MemoryChangeEvent) {
+ 	var overflowed []overflow
+ 	ls.mu.RLock()
+ 	for _, sub := range ls.subscribers[key] {
+ 		select {
+ 		case sub.ch <- event:
+ 		default:
+ 			if sub.closeOnOverflow {
+ 				overflowed = append(overflowed, overflow{key: key, sub: sub})
+ 			}
+ 		}
+ 	}
+ 	ls.mu.RUnlock()
+ 	if len(overflowed) > 0 {
+ 		ls.mu.Lock()
+ 		// Evict overflowing subscribers and close their channels
+ 		for _, o := range overflowed {
+ 			// Remove from subscriber slice and close(o.sub.ch)
+ 		}
+ 		ls.mu.Unlock()
+ 	}
+ }
```
- **Lesson**: Never perform non-deterministic async fan-out when downstream ordering is an invariant. Use synchronous enqueue with overflow eviction.

---

### Incident 2: In-Place Package Migration Identity Erasure under Concurrent Registration (BUG-AF-02)
- **Context**: `control-plane/internal/services/did_service.go`
- **What Was Expected**: Multiple agent instances registering skills/reasoners simultaneously must maintain key continuity; already-issued sub-components must be returned intact.
- **What Actually Happened**: When two replicas registered concurrently, the second read of the agent state via `performDifferentialAnalysis` saw newly committed skills from replica A, calculated `RequiresUpdate = false`, and returned an empty or outdated identity package that omitted private keys.
- **Evidence in Repo**: Commit `10fabe30`, PR `#1209`, Issue `#1205`.
- **Root Cause**: Differential analysis re-queried the database instead of computing diffs against the existing verified state snapshot.
- **Remediation Code Diff**:
```go
// In control-plane/internal/services/did_service.go:
- diffResult, err := s.performDifferentialAnalysis(ctx, req.AgentNodeID, newReasonerIDs, newSkillIDs)
+ diffResult := s.performDifferentialAnalysis(existingAgent, newReasonerIDs, newSkillIDs)
  if !diffResult.RequiresUpdate {
      return &types.DIDRegistrationResponse{
          Success:         true,
          IdentityPackage: s.buildExistingIdentityPackage(existingAgent),
      }, nil
  }
```
- **Lesson**: Do not query the persistence tier twice within the same state machine transition. State transitions must evaluate over pure, immutable in-memory snapshots.

---

### Incident 3: Lexicographic Sequence Inversion in Local BoltDB Event History (BUG-AF-03)
- **Context**: `control-plane/internal/storage/events.go`
- **What Was Expected**: Requesting event history sorted by publication time should return chronological events.
- **What Actually Happened**: BoltDB keys stored sequence IDs as decimal strings without fixed padding. When traversing forward, the cursor read key `"10"` before key `"2"`, causing the control plane to return backwards timelines.
- **Evidence in Repo**: Commit `6b09e655`.
- **Root Cause**: Reliance on key-value store cursor scan order for numerical values stored as raw ASCII strings.
- **Remediation Code Diff**:
```go
// In control-plane/internal/storage/events.go:
+ slices.SortStableFunc(events, func(a, b *types.MemoryChangeEvent) int {
+ 	ai, _ := strconv.ParseUint(a.ID, 10, 64)
+ 	bi, _ := strconv.ParseUint(b.ID, 10, 64)
+ 	return cmp.Compare(ai, bi)
+ })
```
- **Lesson**: Storage engine collation sequences must match domain types. If storing variable-length ASCII numbers in lexically ordered KV stores, you must either zero-pad keys at write time or explicitly sort records after read.

---

### Incident 4: Windows Subprocess Invocation Command Injection and Escaping Flaw (BUG-AF-04)
- **Context**: `sdk/typescript/src/harness_doctor.ts`
- **What Was Expected**: Executing child processes via shims on Windows with space-containing paths should execute reliably without escaping shell characters.
- **What Actually Happened**: Batch files (`.cmd`) executed via `cmd.exe /c` stripped surrounding quotation marks, interpreting spaces as argument delimiters or failing completely on special shell characters.
- **Evidence in Repo**: Issue `#1094`.
- **Root Cause**: Unsafe argument formatting passed to `cmd.exe`.
- **Remediation Code Diff**:
```typescript
// Explicit invocation using environment-token passing rather than command string interpolation
// Enforce execution flags:
const cmdArgs = ['/d', '/v:off', '/s', '/c'];
// Set arguments via specific indexed environment variables to bypass cmd command line re-parsing:
env['AGENTFIELD_PROBE_ARG_0'] = targetPath;
```
- **Lesson**: Never execute `.cmd` or `.bat` scripts on Windows through standard shell concatenation. Pass parameters out-of-band via environment variables or sanitize with `cmd.exe /s /c` token conventions.

---

### Incident 5: Python SDK Strict Boolean Parsing Regression (BUG-AF-05)
- **Context**: `sdk/python/agentfield/logger.py`, `agent.py`, `agent_server.py`
- **What Was Expected**: System environment variables like `AGENTFIELD_LOG_PAYLOADS=1` should parse as boolean `True`.
- **What Actually Happened**: Code evaluated `os.getenv("AGENTFIELD_LOG_PAYLOADS") == "true"`, evaluating `"1"`, `"True"`, `"yes"`, and `"on"` as `False`.
- **Evidence in Repo**: Issue `#1089`, PR `#1082`.
- **Root Cause**: Inconsistent parsing patterns across SDK modules.
- **Remediation Code Diff**:
```python
# In sdk/python/agentfield/utils.py:
TRUTHY_SET = {"1", "true", "yes", "on"}
FALSY_SET = {"0", "false", "no", "off"}

def parse_bool_env(val: str | None, default: bool) -> bool:
    if val is None:
        return default
    v = val.strip().lower()
    if v in TRUTHY_SET:
        return True
    if v in FALSY_SET:
        return False
    raise ValueError(f"Unrecognized boolean value {val!r}")
```
- **Lesson**: Do not use direct string equality checks (`== "true"`) for environment variables. Centralize configuration flag coercion with strict truthy/falsy validation.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Timestamp Filtering**:
  ```go
  // DEFECT:
  if filter.Since != nil && event.Timestamp.Before(*filter.Since)
  // PROBLEM: If event.Timestamp == *filter.Since, it evaluates to false, including the boundary record twice.
  // REMEDY: Use inverted condition with After() to ensure strict exclusivity:
  if filter.Since != nil && !event.Timestamp.After(*filter.Since) {
      continue
  }
  ```
- **Type Coercion Traps**: In Go's `strconv.ParseUint`, failure to handle error values defaults numbers to `0`. If event IDs contain non-numeric characters, `strconv.ParseUint(a.ID, 10, 64)` returns an error and defaults to `0`, distorting sort order.
- **Shallow Copy Mutation Leaks**:
  ```go
  // DEFECT:
  subscribers := ls.subscribers[key]
  // Mutation of the slice header does not update underlying allocations safely when accessed concurrently.
  // REMEDY: Use slices.Clone or maintain pointers:
  type memorySubscriber struct {
      ch chan types.MemoryChangeEvent
      closeOnOverflow bool
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Circular Dependency Break in Node Orchestration**:
  ```go
  func (as *DefaultAgentService) runAgentGuarded(name string, options domain.RunOptions, inProgress map[string]bool) (*domain.RunningAgent, error) {
      if inProgress[name] {
          return nil, fmt.Errorf("circular dependency detected in agent startup chain: %s", name)
      }
      inProgress[name] = true
      // Recurse to dependencies safely
  }
  ```
- **Event Loop Starvation in Dev Mode Port Scanning**:
  `DefaultDevService.discoverAgentPort` scans ports from `8001` to `8999`. A naive loop over 1,000 closed ports with standard TCP connection timeouts can block execution for 20+ seconds.
  *Invariant*: Set individual connection timeouts to `min(2 * time.Second, totalRemainingTimeout)` and sleep `500ms` between full cycles to allow the OS event loop to breathe.

### 3. UI & UX Micro-Mechanics (CLI & Desktop Tray)
- **Menu Bar Slot Alignment Mechanics**:
  To prevent erratic menu rendering when switching between icons, charts, and text items in `af-tray`, the geometry engine enforces a uniform pixel slot constraint:
  ```go
  const (
      usageSlotWidthPt  = 64
      usageSlotHeightPt = 12
      usageBarWidthPt   = 56
      usageBarHeightPt  = 8
  )
  ```
  Every row without a visualization renders a transparent spacer of dimensions `usageSlotWidthPt x usageSlotHeightPt`. This eliminates native OS layout reflows and text misalignment when dynamic statistics load.

### 4. Backend Concurrency & Memory Safety
- **Process Group Termination (`syscall.Kill`)**:
  Terminating an agent runner via its direct PID leaves orphaned background subprocesses running.
  *Invariant*: Always pass a negated PID: `syscall.Kill(-cmd.Process.Pid, syscall.SIGINT)`. This signals the entire OS process group instead of just the entry point shell.
- **Port TOCTOU Race Condition Handling**:
  Checking if a port is open and then binding to it is vulnerable to race conditions:
  ```go
  func (as *DefaultAgentService) startWithPortRetry(...) {
      pid, port, conflict := attemptFn(port)
      if conflict && retryOnConflict {
          retryPort, _ := as.freshRetryPort(port)
          pid, port, _ = attemptFn(retryPort)
      }
  }
  ```
  When an ephemeral collision occurs, reserve the conflicting port locally so `FindFreePort` cannot return it again during the retry attempt.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Malformed Glob Rejection**:
  ```go
  // In parsePatterns():
  for _, p := range patterns {
      if _, err := path.Match(p, ""); err != nil {
          // Reject invalid patterns immediately with HTTP 400
          c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid pattern %q: %v", p, err)})
          return nil, false
      }
  }
  ```
  Failing to pre-validate patterns causes downstream evaluators to fail silently, resulting in zero matched messages without returning an error.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
AgentField implements a decoupled Control Plane / Agent Node architecture:
- **Control Plane**: Manages state, routes messages, issues identity certificates, and orchestrates multi-agent DAGs.
- **Agent Node**: Runs locally or in a container, hosting user agent logic behind standard REST/WebSocket bindings.
- **Storage Layer**: Uses an interface-driven engine (`StorageProvider`) with two primary backends:
  - `LocalStorage`: Leverages SQLite, GORM, and BoltDB for local deployments.
  - `PostgresStorage`: Targets multi-node cloud environments.

### Dimension 2: Core Abstractions
- `AgentNode`: Domain model tracking PID, port, status, lifecycle health, and process paths.
- `MemoryChangeEvent`: Immutable notification packet representing key-level memory mutations (`set`, `delete`).
- `ProcessManager`: OS-agnostic interface abstracting process spawning, health monitoring, and graceful termination.
- `PortManager`: Logical port reservation layer preventing ephemeral race conditions during startup cascades.

### Dimension 3: Error Handling
- **Defensive Eviction**: Subscribers that fail to keep pace are dropped with explicit error frames, preserving upstream stability.
- **Diagnostic Log Reflection**: If an agent process fails its health check, the supervisor reads the trailing 40 lines of the process's standard output/standard error to return root causes directly in the CLI error message.
- **Graceful Degradation**: If an agent fails to shut down gracefully after `timeoutSeconds`, the supervisor escalates from `SIGINT` to `SIGKILL`.

### Dimension 4: Testing
- **Deterministic Multi-Replica Testing**: Rather than relying on `time.Sleep`, the test harness uses execution hooks (`registrationSnapshotStore.afterRead`) to interleave concurrent registrations deterministically.
- **Loopback WebSocket Testing**: Integration harnesses stand up real ephemeral HTTP/WS test servers (`httptest.NewServer`) to test protocol negotiation, upgrade failures, and ping/pong deadlines end-to-end.

### Dimension 5: Security
- **Decentralized Identifiers (DIDs)**: Agents are assigned identities derived cryptographically via HD derivation paths and asymmetric key pairs (JWKs).
- **Scope Isolation**: Memory access is divided into four distinct scopes: `global`, `workflow`, `session`, and `user` (actor). Authorization filters prevent cross-scope access.

### Dimension 6: Performance
- **Zero-Allocation Rendering**: The desktop status monitor compiles text-free charts directly to PNGs in memory using integer math downsampling (`downsample(hi, wPx, hPx, ss)`), bypassing external graphics libraries.
- **Synchronous In-Memory Broadcast**: The pub/sub system uses read-write locks (`sync.RWMutex`) and pre-allocated arrays (`[...]string`) to avoid heap allocations during message fan-out.

### Dimension 7: Deployment
- **Single Static Artifact**: The control plane builds as a self-contained Go binary.
- **Persistent Root Layout**: Standardizes filesystem paths around `~/.agentfield`:
  ```
  ~/.agentfield/
  ├── packages/
  ├── logs/
  └── config/
  ```

### Dimension 8: Agent Patterns
- **Harness Membrane**: Wraps third-party coding agents (Claude Code, Gemini CLI, OpenCode) in standardized lifecycle wrappers.
- **Memory Watchers**: Agents register reactive hooks (`Memory().Watch`) that trigger callbacks when specific memory keys change, enabling reactive multi-agent collaboration without continuous polling.

### Dimension 9: Data Flow
```
Agent Write -> Control Plane REST API -> Storage Write (Postgres/BoltDB)
  -> publishMemoryChange() (Synchronous) -> Subscriber Channels
  -> WebSocket / SSE Transport -> Agent SDK Watcher -> Handler Execution
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Bounded Buffer with Fast-Fail Eviction
```go
select {
case sub.ch <- event:
    // Success
default:
    // Handle saturation: mark for eviction and close channel
    sub.markEvicted()
}
```

### 2. Rule
A distributed memory stream MUST NOT drop events silently under load. Saturated consumer buffers MUST result in channel closure accompanied by an explicit gap notification code.

### 3. Architecture Principle
**Snapshots Outrank Secondary Queries**: A multi-step mutation must operate on an immutable state snapshot taken at the start of the transaction. Never re-query the persistence tier mid-transaction to make differential decisions.

### 4. Failure Mode
Lexicographical string sorting of unsigned decimal sequence keys in embedded KV stores causes message delivery order to invert once sequences pass numerical powers of 10.

### 5. Reusable Skill
**TOCTOU-Safe Process Initialization**:
1. Reserve the desired port in the logical port manager.
2. Launch the child process targeting that port.
3. Monitor log output and HTTP healthcheck simultaneously.
4. If a port collision occurs, record the port as unavailable and retry with a fresh port.
5. Release the logical port lock only after process health is confirmed.

### 6. Decision
**POSIX `path.Match` over OS-Specific `filepath.Match`**:
Memory event keys use `/` as their universal namespace delimiter. The project rejected `filepath.Match` because its behavior varies across host operating systems (e.g., treating `\` as a separator on Windows), which caused cross-platform pattern failures.

### 7. Anti-Pattern
Spawning an un-tracked, un-bounded goroutine for every published message to prevent blocking the publish path (`go func() { subscriber <- event }()`).

### 8. Verification Method
Verify that subscriptions close cleanly by canceling an attached `context.Context`. Assert using `waitForCondition` that `storage.ActiveSubscriptions()` returns to zero without deadlocks or lingering goroutines.

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### AI Coding Agent Invariant Checklist

- [ ] **Memory & Stream Subscriptions**
  - [ ] Does your publish loop run synchronously over active subscribers?
  - [ ] When a subscriber buffer fills, do you drop the subscriber and close its channel instead of silently dropping the event?
  - [ ] Are WebSocket control loops configured with ping/pong timeouts (e.g., 25s ping, 60s dead connection threshold)?
  - [ ] Does your teardown logic tie the pub/sub subscription lifetime directly to the request's `context.Context`?

- [ ] **State Machine & Identity Registration**
  - [ ] Does differential analysis execute against the primary read snapshot without triggering a second database read?
  - [ ] Are existing cryptographic subkeys preserved across partial or idempotent re-registration calls?

- [ ] **Process Supervision**
  - [ ] Are subprocesses managed as process groups so child trees terminate cleanly upon shutdown (`syscall.Kill(-PID, SIGINT)`)?
  - [ ] Does process startup capture log output to diagnose port collisions and startup crashes immediately?
  - [ ] Is port discovery bounded by a strict global deadline?

- [ ] **Cross-Platform Compatibility**
  - [ ] Do pattern-matching utilities rely on `path.Match` instead of `filepath.Match` for URI/key operations?
  - [ ] Are sequence IDs padded or parsed as integers before sorting to prevent lexicographic ordering bugs?
  - [ ] Are boolean environment variables parsed using an explicit truthy/falsy set rather than a simple equality check?
```

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
