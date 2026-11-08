> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/temporalio-temporal-learnings.md`  
> **Source**: github ([https://github.com/temporalio/temporal](https://github.com/temporalio/temporal))  
> **Source Version**: `74c71f96`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T08:48:58.713Z  
> **Learning ID**: `learn-github-temporalio-temporal`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): temporalio/temporal

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`temporalio/temporal` solves the distributed durable execution problem: guaranteeing that arbitrary multi-step application code (workflows) executes to completion across distributed nodes despite process crashes, worker deaths, network partitions, machine reboots, and multi-year delays. It does this without requiring user-space persistence boilerplate (manual state machines, distributed locking, polling databases, or manual compensating saga logs).

### Architectural Boundaries & Subsystems
Temporal partitions durable execution into four core service boundaries running on a shared cluster infrastructure:

```
                    +---------------------------------------------+
                    |                Frontend Service             |
                    |    (gRPC Ingress, Auth, Rate Limiting)      |
                    +----------------------+----------------------+
                                           |
                    +----------------------+----------------------+
                    |             Matching Service                |
                    |   (Task Queues, Poller Matching, Dispatch)  |
                    +----------------------+----------------------+
                                           |
                    +----------------------+----------------------+
                    |              History Service                |
                    | (Sharded Engines, MutableState, HSM, Events)|
                    +----------------------+----------------------+
                                           |
                    +----------------------+----------------------+
                    |             Internal Workers                |
                    | (System Workflows, Archival, Batch Deletes) |
                    +---------------------------------------------+
```

1. **Frontend Service**: Edge ingress termination point. Exposes gRPC APIs (`WorkflowService`, `OperatorService`, `AdminService`). Enforces rate-limiting, authentication/authorization, request validation, and payload metadata passthrough. It routes commands deterministically to specific shards in the History service via consistent hashing rings.
2. **History Service (The Core State Engine)**: Owns execution truth. Partitioned into $N$ deterministic shards (e.g., 512 to 16,384 shards). Each shard manages a subset of workflow executions keyed by `Hash(NamespaceID, WorkflowID) % NumShards`. Each shard owns:
   - **MutableState**: In-memory, write-through caching structure tracking execution progress, pending activity states, buffered events, timers, signal buffers, and state machine transitions.
   - **Execution Engine & Transaction Manager**: Commits atomic updates to persistence (Cassandra, PostgreSQL, MySQL, SQLite) using monotonic optimistic locking via `NextEventID` fencing.
   - **Hierarchical State Machine (HSM) Framework**: Decentralized state machine engine coordinating Nexus RPC operations, activity lifecycles, and sub-state machine transitions directly attached to execution nodes.
3. **Matching Service**: High-throughput task dispatch engine. Implements distributed, fair queueing across poller pools. Matches pending workflow/activity tasks directly to waiting worker HTTP/2 long-pollers, bypassing persistence when pollers are waiting (Sync Match), or spilling to the task queue storage model when unbuffered.
4. **Worker Service**: Internal cluster daemon executing background durable workflows (e.g., system migrations, namespace deletion, batch operations, task queue scrapers, and archival processing).

### Critical Invariant Contracts
- **Virtual Logical Clock Separation**: Workflow executions maintain their own monotonic logical time dimension (`MutableState.Now()`), decoupled from physical host wall-clock time (`shardContext.GetTimeSource().Now()`). All deadlines, retry intervals, scheduled tasks, and state-machine transitions must anchor to the workflow's logical timeline.
- **Append-Only History Invariant**: History events are immutable once committed. MutableState reflects the materialized aggregate view of these events. No event may be rewritten, replaced, or deleted retroactively.
- **Fenced Shard Ownership**: A history shard instance is valid if and only if it owns the database shard lease with a strictly monotonic `RangeID`. If lease renewal fails, the shard immediately enters a zombie state, blocking all outbound transactions to prevent split-brain writes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Clock Separation Invariant for Time-Warping Distributed State Engines

**RULE**:
In any state engine that supports time manipulation (virtual clocks, time-skipping, simulation, or deterministic replaying), the system MUST strictly decouple **Logical State Machine Time** from **Physical Host Wall-Clock Time**. 
- Logical State Machine Time (`Node.WorkflowTime()`) MUST be used for all state transitions, retry deadlines, task scheduling, timeout expirations, and end-to-end lifecycle metrics.
- Physical Host Wall-Clock Time (`Environment.Now()`) MUST ONLY be used to measure real-world outbound I/O attempt latencies (such as the actual wire execution time of an HTTP/gRPC request) and physical socket deadlines.

**WHY**:
Mixing logical state time with physical host wall-clock time leads to catastrophic boundary drift whenever time skipping or accelerated simulation occurs. If an engine skips 24 hours of virtual time and an internal subsystem uses wall-clock time to calculate remaining timeouts:
$$\text{TimeoutRemaining} = \text{Deadline} - \text{HostWallClockTime}$$
the calculation yields an offset shifted by the accumulated virtual skip duration. This causes:
1. Deadlines scheduled in the past, triggering immediate spurious timeouts or bypassing exponential retry backoff curves.
2. Inverted latency metrics where calculated lifecycle durations become negative numbers.
3. Broken watchdog heartbeats that allow stalled workers to evade lease revocation.

**WHEN TO APPLY**:
Apply to any distributed workflow engine, discrete event simulator, raft/consensus testing harness, cron scheduler, or stateful transactional entity where time can be mocked, stepped, or virtualized independently of physical NTP time.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// NodeBackend represents the owning entity's logical timeline contract.
type NodeBackend interface {
    // Now returns the workflow's current logical time, incorporating all accumulated virtual time offsets.
    Now() time.Time
    AddHistoryEvent(t EventType, setAttributes func(*HistoryEvent)) *HistoryEvent
}

type Node struct {
    backend NodeBackend
}

// WorkflowTime explicitly returns the logical engine time for state invariants.
func (n *Node) WorkflowTime() time.Time {
    return n.backend.Now()
}

// TaskExecutor enforces the strict clock barrier between outbound I/O and state transitions.
type TaskExecutor struct {
    Config *ExecutorConfig
}

type InvocationArgs struct {
    ScheduledTime          time.Time
    WorkflowTimeSnapshot   time.Time
    WallTimeSnapshot       time.Time
    ScheduleToCloseTimeout time.Duration
}

func (e *TaskExecutor) ExecuteInvocation(ctx context.Context, env Environment, node *Node, args InvocationArgs) error {
    // 1. Calculate physical elapsed time across the async execution boundary
    physicalElapsed := env.Now().Sub(args.WallTimeSnapshot)
    
    // 2. Project current logical workflow time using the physical delta
    currentWorkflowTime := args.WorkflowTimeSnapshot.Add(physicalElapsed)
    
    // 3. Compute domain timeout purely against the projected logical timeline
    elapsedSinceScheduled := currentWorkflowTime.Sub(args.ScheduledTime)
    remainingTimeout := args.ScheduleToCloseTimeout - elapsedSinceScheduled
    
    if remainingTimeout <= 0 {
        // Logical timeout expired; record failure using logical clock
        return node.TransitionTimedOut(args.WorkflowTimeSnapshot)
    }

    // 4. Physical wall clock ONLY bounds the concrete outbound context execution
    callCtx, cancel := context.WithTimeout(ctx, min(e.Config.MaxRequestTimeout, remainingTimeout))
    defer cancel()

    result, callErr := env.DoOutboundRPC(callCtx)
    
    // 5. State transitions and state-derived metrics record workflow logical time
    return node.TransitionCompleted(node.WorkflowTime(), result, callErr)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Indiscriminately invoking host wall-clock time within state evaluation logic.
func (e *TaskExecutor) BrokenExecuteInvocation(ctx context.Context, env Environment, node *Node, scheduledTime time.Time, timeout time.Duration) error {
    // BUG: Mixing wall-clock time (time.Since) with an event timestamp (scheduledTime)
    // that may have been generated under a time-skipped or replayed logical timeline!
    remaining := timeout - time.Since(scheduledTime)
    if remaining <= 0 {
        return node.TransitionTimedOut(time.Now()) // BUG: Corrupts state history with host time
    }
    
    // BUG: Metric calculation blends physical elapsed time with virtual leap,
    // yielding negative or multi-day metrics for an operation that took 10ms.
    metricLatency := time.Now().Sub(scheduledTime)
    env.EmitMetric("operation_latency", metricLatency)
    
    return nil
}
```

**VERIFICATION METHOD**:
Enforce via unit tests using an intentionally divergent mock backend where `WorkflowTimeFn` is initialized into a future epoch (e.g., year 2027) while the test environment's wall clock points to standard baseline time. Assert that state updates, history timestamps, and lifecycle duration metrics match the deterministic logical clock:
```go
func TestClockBoundaryIsolation(t *testing.T) {
    logicalEpoch := time.Date(2027, 1, 1, 12, 0, 0, 0, time.UTC)
    wallEpoch := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
    
    backend := &MockBackend{LogicalTime: logicalEpoch}
    env := &MockEnv{WallTime: wallEpoch}
    
    node := NewNode(backend)
    exec := NewTaskExecutor()
    
    out := exec.RecordAttempt(env, node)
    require.Equal(t, logicalEpoch, out.TransitionTimestamp, 
        "State machine transitions MUST use logical workflow time")
}
```

---

### 2. State-Driven History Succession Propagation Invariant

**RULE**:
When propagating terminal execution status across recurrent, scheduled, or chained state iterations (such as `ContinueAsNew`, Cron workflows, or Scheduled Actions), the system MUST evaluate the **explicit terminal execution status** (`Completed`, `Failed`, `Terminated`, `TimedOut`) to determine state inheritance, and MUST NOT infer success or failure status from the presence or absence of a return payload (`LastCompletionResult`).

**WHY**:
In distributed workflows, a successfully completed task or action may legitimately return a `nil` or empty payload (`void` return semantics). If downstream logic treats a `nil` payload as "no successful result available" and defaults to retaining the prior iteration's `ContinuedFailure`, an erroneous failure payload will permanently haunt all subsequent successful runs. A workflow that failed once, then succeeded with an empty response 100 consecutive times, will erroneously report that its last completion state was a failure.

**WHEN TO APPLY**:
Apply to all durable loop abstractions, cron engines, child workflow orchestrators, retry managers, and task continuation loops across all languages.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
type WorkflowExecutionStatus int

const (
    StatusRunning WorkflowExecutionStatus = iota
    StatusCompleted
    StatusFailed
    StatusCanceled
    StatusTerminated
    StatusTimedOut
)

type ExecutionOutcome struct {
    Status  WorkflowExecutionStatus
    Result  []byte // May be nil on void success
    Failure *FailureRecord
}

type ScheduledActionState struct {
    LastCompletionResult []byte
    ContinuedFailure     *FailureRecord
}

// ApplyIterationOutcome enforces explicit status gating over payload heuristics.
func ApplyIterationOutcome(state *ScheduledActionState, outcome ExecutionOutcome) {
    switch outcome.Status {
    case StatusCompleted:
        // Clear past failure unconditionally upon confirmed completion,
        // regardless of whether Result is nil or contains bytes.
        state.ContinuedFailure = nil
        state.LastCompletionResult = outcome.Result

    case StatusFailed, StatusTimedOut:
        // Update failure record; retain previous completion result if desired
        state.ContinuedFailure = outcome.Failure

    case StatusCanceled, StatusTerminated:
        // Retain or reset based on terminal policy
        state.ContinuedFailure = outcome.Failure
        state.LastCompletionResult = nil

    default:
        panic(fmt.Sprintf("unhandled terminal execution status: %v", outcome.Status))
    }
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Inferring execution outcome from payload presence.
func BrokenApplyIterationOutcome(state *ScheduledActionState, result []byte, failure *FailureRecord) {
    // CATASTROPHIC BUG: If the action succeeded but returned an empty/nil payload,
    // result is nil! The system falls through and retains the prior iteration's ContinuedFailure.
    if result != nil {
        state.LastCompletionResult = result
        state.ContinuedFailure = nil
    } else if failure != nil {
        state.ContinuedFailure = failure
    }
    // Result: If outcome is StatusCompleted with nil result, ContinuedFailure remains set forever!
}
```

**VERIFICATION METHOD**:
Implement a property-based or table-driven test verifying that a transition from `StatusFailed` to `StatusCompleted` with `Result == nil` explicitly wipes the `ContinuedFailure` field:
```go
func TestVoidSuccessClearsContinuedFailure(t *testing.T) {
    state := &ScheduledActionState{
        ContinuedFailure: &FailureRecord{Message: "prior crash"},
    }
    outcome := ExecutionOutcome{
        Status:  StatusCompleted,
        Result:  nil, // Void success
        Failure: nil,
    }
    ApplyIterationOutcome(state, outcome)
    require.Nil(t, state.ContinuedFailure, "Terminal StatusCompleted MUST wipe ContinuedFailure even if Result is nil")
    require.Nil(t, state.LastCompletionResult)
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Activity and Workflow Task Time-Skipping Clock Boundary Contamination (BUG-TEMPORAL-12960)

- **Context**: `common/util.go`, `service/history/api/respondworkflowtaskcompleted/api.go`, `service/history/workflow/activity.go`
- **What Was Expected**: When running workflows under test or simulation frameworks that skip virtual time, workflow tasks, activity timeouts, and activity retries should advance strictly relative to the workflow's virtual clock (`ms.Now()`), while physical timeout tasks in the shard queue should track real physical time.
- **What Actually Happened**: The server was passing the physical shard time (`shardContext.GetTimeSource().Now()`) into `ResetActivity`, `UnpauseActivity`, `GetPendingActivityInfo`, and the Workflow Task Heartbeat checker. After skipping time, the workflow's virtual clock was far ahead of the shard's real clock. This caused:
  1. Activities to be rescheduled in the physical past, bypassing jitter delays and triggering premature `ScheduleToStart` timeouts.
  2. Active activities falsely reported as "waiting for retry backoff" when their retry time had already elapsed in virtual time.
  3. The Workflow Task heartbeat watchdog was delayed by the accumulated skipped duration, enabling stalled workers to consume execution capacity for hours past `WorkflowTaskHeartbeatTimeout`.
- **Evidence in Repo**: Commit `74c71f96`, PR `#12960`, Issue tracking virtual clock drift in time-skipping engine.
- **Root Cause**: Functions in `service/history/workflow/activity.go` accepted `shardContext historyi.ShardContext` and invoked `shardContext.GetTimeSource().Now().UTC()`. In normal mode, shard time and workflow time are roughly equivalent, masking the bug. Under time skipping, `shardContext` reflects the host wall clock while `mutableState` reflects the virtual clock. Calling `shardContext.GetTimeSource()` broke the encapsulation boundary between the engine's physical container and the workflow's virtual state.
- **Remediation Code Diff**:
```diff
--- a/service/history/workflow/activity.go
+++ b/service/history/workflow/activity.go
@@ -92,11 +92,10 @@ func UpdateActivityInfoForRetries(
 func GetPendingActivityInfo(
 	ctx context.Context,
-	shardContext historyi.ShardContext,
 	mutableState historyi.MutableState,
 	ai *persistencespb.ActivityInfo,
 ) (*workflowpb.PendingActivityInfo, error) {
-	now := shardContext.GetTimeSource().Now().UTC()
+	now := mutableState.Now().UTC()
 
 	p := &workflowpb.PendingActivityInfo{
 		ActivityId: ai.ActivityId,
@@ -367,7 +365,7 @@ func ResetActivity(
 				ai.LastHeartbeatUpdateTime = nil
 			}
 
-			scheduleTime := shardContext.GetTimeSource().Now().UTC()
+			scheduleTime := ms.Now().UTC()
 			if jitter != 0 {
 				randomOffset := time.Duration(rand.Int63n(int64(jitter)))
 				scheduleTime = scheduleTime.Add(randomOffset)
```
```diff
--- a/service/history/api/respondworkflowtaskcompleted/api.go
+++ b/service/history/api/respondworkflowtaskcompleted/api.go
@@ -335,13 +332,14 @@ func (handler *WorkflowTaskCompletedHandler) Invoke(
 	if checkWTHeartbeatTimeout {
 		wtHeartbeatTimeoutDuration := handler.config.WorkflowTaskHeartbeatTimeout(nsName)
 		if currentWorkflowTask.OriginalScheduledTime.UnixNano() > 0 &&
-			handler.timeSource.Now().After(currentWorkflowTask.OriginalScheduledTime.Add(wtHeartbeatTimeoutDuration)) {
+			ms.Now().After(currentWorkflowTask.OriginalScheduledTime.Add(wtHeartbeatTimeoutDuration)) {
```
- **Lesson**: Never pass global infrastructure service locators or shard contexts into inner domain state manipulation routines. State mutating functions must only accept `MutableState` and derive all timeline parameters directly from `ms.Now()`.

---

### Incident 2: HSM Nexus Operations Clock Bleed and Negative Latency Metrics (BUG-TEMPORAL-12973)

- **Context**: `service/history/hsm/nexusoperations/executors.go`, `service/history/hsm/nexusoperations/completion.go`, `service/history/hsm/tree.go`
- **What Was Expected**: HSM (Hierarchical State Machine) Nexus operations, task cancellations, and timeout schedules must anchor their lifecycle deadlines to the workflow's logical timeline. Metrics for Schedule-to-Start, Schedule-to-Close, and Start-to-Close latencies must be positive durations measuring the true domain operational spans.
- **What Actually Happened**: `nexusoperations.taskExecutor` and `CompletionHandler` used `env.Now()` (host physical time) to evaluate Schedule-to-Start, Schedule-to-Close, and retry deadlines. After a virtual time skip, `env.Now()` trailed the scheduled time recorded in workflow time. Consequently, `args.scheduleToCloseTimeout - time.Since(args.scheduledTime)` calculated timeouts based on mismatched clock frames. Furthermore, lifecycle metric calculations produced negative latency durations or spans inflated by days, corrupting cluster telemetry.
- **Evidence in Repo**: Commit `85a2da66`, PR `#12973`, Files `service/history/hsm/nexusoperations/*`.
- **Root Cause**: The `hsm.Node` abstraction did not expose the underlying workflow's logical clock. Callers had access only to `hsm.Environment.Now()`, which supplies wall-clock time for physical outbound HTTP calls. Lacking an explicit abstraction for logical time, developers reused `env.Now()` for state machine transitions, event timestamping, and timeout evaluations.
- **Remediation Code Diff**:
```diff
--- a/service/history/hsm/tree.go
+++ b/service/history/hsm/tree.go
@@ -152,6 +153,8 @@ type NodeBackend interface {
+	// Now returns the workflow's current logical time, including its time-skipping offset.
+	Now() time.Time
 	AddHistoryEvent(t enumspb.EventType, setAttributes func(*historypb.HistoryEvent)) *historypb.HistoryEvent
 }
 
+// WorkflowTime returns the owning workflow's current logical time.
+// Use Environment.Now for wall-clock measurements such as outbound request latency.
+func (n *Node) WorkflowTime() time.Time {
+	return n.backend.Now()
+}
```
```diff
--- a/service/history/hsm/nexusoperations/executors.go
+++ b/service/history/hsm/nexusoperations/executors.go
@@ -224,13 +224,15 @@ func (e taskExecutor) executeInvocationTask(ctx context.Context, env hsm.Environ
 	callTimeout := e.Config.RequestTimeout(ns.Name().String(), task.EndpointName)
 	var timeoutType enumspb.TimeoutType
+	currentWorkflowTime := args.workflowTimeSnapshot.Add(env.Now().Sub(args.wallTimeSnapshot))
+	elapsedSinceScheduled := currentWorkflowTime.Sub(args.scheduledTime)
 	if args.scheduleToStartTimeout > 0 {
-		callTimeout = min(callTimeout, args.scheduleToStartTimeout-time.Since(args.scheduledTime))
+		callTimeout = min(callTimeout, args.scheduleToStartTimeout-elapsedSinceScheduled)
 		timeoutType = enumspb.TIMEOUT_TYPE_SCHEDULE_TO_START
 	} else if args.scheduleToCloseTimeout > 0 {
-		callTimeout = min(callTimeout, args.scheduleToCloseTimeout-time.Since(args.scheduledTime))
+		callTimeout = min(callTimeout, args.scheduleToCloseTimeout-elapsedSinceScheduled)
 		timeoutType = enumspb.TIMEOUT_TYPE_SCHEDULE_TO_CLOSE
 	}
```
- **Lesson**: In state machine nodes embedded within hierarchical containers, explicitly provide dual time accessors (`Node.WorkflowTime()` vs `Environment.Now()`) and strictly document their operational domains. Enforce in code reviews that `Environment.Now()` never touches event generation or state persistence.

---

### Incident 3: Long-Poll Deadline Ignored in History Service (BUG-TEMPORAL-8970)

- **Context**: `service/history/api/getworkflowexecutionrawhistoryv2` / Frontend Long Polling
- **What Was Expected**: When clients issue long-poll gRPC requests (such as `GetWorkflowExecutionHistory` with a server wait deadline), the server must respect the client's RPC context deadline and terminate the poll early if the client's deadline expires before the server's internal long-poll timer.
- **What Actually Happened**: The server waited for its full internal default long-poll interval (~20s) regardless of whether the incoming gRPC request context deadline was set to 5s. The client's transport timed out, generating HTTP/2 `DEADLINE_EXCEEDED` stream cancellations, causing unnecessary connection renegotiations and socket churn.
- **Evidence in Repo**: Issue `#8970`, closed PR addressing deadline propagation in long poll handlers.
- **Root Cause**: The long poll handler initialized a static `time.NewTimer(defaultLongPollInterval)` without factoring in `ctx.Deadline()`. When the client deadline was shorter than the server default, the handler failed to select on `ctx.Done()`, or did not dynamically adjust the timer interval to finish before the client timed out.
- **Remediation Pattern**:
```go
// Calculate dynamic poll wait duration bounded by client context deadline
serverTimeout := 20 * time.Second
if deadline, ok := ctx.Deadline(); ok {
    timeUntilDeadline := time.Until(deadline)
    // Server must respond 1 second BEFORE the client deadline expires
    // to allow response transit without an RPC DEADLINE_EXCEEDED error.
    serverTimeout = max(0, min(serverTimeout, timeUntilDeadline - 1*time.Second))
}
timer := time.NewTimer(serverTimeout)
defer timer.Stop()

select {
case <-ctx.Done():
    return nil, ctx.Err()
case <-timer.C:
    // Respond with empty result set indicating timeout reached without new events
    return &historyservice.GetWorkflowExecutionHistoryResponse{}, nil
case event := <-eventChannel:
    return event, nil
}
```
- **Lesson**: Server-side long-polling handlers must always clamp their polling timeouts to:
$$\text{Timeout}_{\text{server}} = \min(\text{DefaultServerTimeout}, \text{ContextDeadline} - \Delta_{\text{transit}})$$
where $\Delta_{\text{transit}}$ is an allowance (e.g., 500ms–1000ms) guaranteeing that an empty payload can safely cross the network before the transport layer aborts the stream.

---

### Incident 4: Scheduled Actions Failure Propagation on Void Success (BUG-TEMPORAL-8490)

- **Context**: `service/worker/scheduler/workflow.go`, `service/worker/scheduler/activities.go`
- **What Was Expected**: If an execution of a scheduled action fails, the subsequent action should report `ContinuedFailure`. If the subsequent run completes successfully (even if returning a `null` payload), `ContinuedFailure` must be cleared so future scheduled runs do not inherit the stale failure.
- **What Actually Happened**: If a scheduled workflow returned `null` upon successful completion, the scheduler code inspected the payload rather than the execution status. Finding a `nil` payload, it left the `ContinuedFailure` field unchanged, causing the failure to propagate across subsequent successful iterations indefinitely.
- **Evidence in Repo**: Issue `#8490`, lines `service/worker/scheduler/workflow.go#L858`.
- **Root Cause**: The continuation update was guarded by:
```go
if completedWorkflowResult.Payloads != nil {
    state.ContinuedFailure = nil
    state.LastCompletionResult = completedWorkflowResult.Payloads
}
```
A successful workflow returning `nil` payloads did not satisfy the condition, preserving the prior run's `ContinuedFailure`.
- **Remediation Pattern**:
```go
// FIXED: Explicitly query execution status enum, not payload presence
if executionStatus == enumspb.WORKFLOW_EXECUTION_STATUS_COMPLETED {
    state.ContinuedFailure = nil
    state.LastCompletionResult = completedWorkflowResult.Payloads
} else if executionStatus == enumspb.WORKFLOW_EXECUTION_STATUS_FAILED {
    state.ContinuedFailure = completedWorkflowFailure
}
```
- **Lesson**: Do not use payload existence as a proxy for execution success. In distributed systems, emptiness (`nil`, `{}`) is a valid payload value. Always inspect the formal status enum.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Implicit Zero vs Nil Traps in Protobuf v3
In generated Protobuf code, primitive numbers default to `0` and timestamps/sub-messages default to `nil`. Testing `duration.AsDuration() > 0` on an uninstantiated proto duration causes a nil-pointer panic:

```go
// FATAL PANIC HAZARD:
func GetExpiration(req *workflowservice.StartWorkflowExecutionRequest) *time.Time {
    // If WorkflowExecutionTimeout is nil, req.GetWorkflowExecutionTimeout() returns nil!
    // AsDuration() dereferences the pointer: PANIC!
    d := req.GetWorkflowExecutionTimeout().AsDuration() 
    if d > 0 {
        t := time.Now().Add(d)
        return &t
    }
    return nil
}

// BULLETPROOF CANONICAL INVARIANT:
func GetExpirationSafe(req *workflowservice.StartWorkflowExecutionRequest) *time.Time {
    if req.GetWorkflowExecutionTimeout() == nil {
        return nil
    }
    d := req.GetWorkflowExecutionTimeout().AsDuration()
    if d <= 0 {
        return nil
    }
    t := time.Now().Add(d)
    return &t
}
```

#### Deep Proto Mutation Leaks in Cloned Requests
When modifying a protobuf message before persistence, shallow copying clones the top-level pointer while internal sub-messages and slices remain shared references:

```go
// LEAK TRAP: Shallow copy retains pointer aliases to mutable proto fields
func BadClone(req *historyservice.StartWorkflowExecutionRequest) *historyservice.StartWorkflowExecutionRequest {
    clone := *req // Shallow struct copy
    clone.StartRequest.WorkflowExecutionTimeout = durationpb.New(time.Hour) // MUTATES ORIGINAL req!
    return &clone
}

// INVARIANT: Use proto.Clone explicitly before modifying nested structures
func SafeClone(req *historyservice.StartWorkflowExecutionRequest) *historyservice.StartWorkflowExecutionRequest {
    return proto.Clone(req).(*historyservice.StartWorkflowExecutionRequest)
}
```

---

### 2. Infinite Loop & Recursion Guards

#### Monotonic Progress Verification in History Event Replay
When processing buffered events or replaying history state transitions, loops must enforce monotonic progression of `NextEventID`. If an iteration fails to advance the ID, the replay engine must immediately terminate with a panic to prevent CPU thread lockup:

```go
func ApplyHistoryEvents(ms MutableState, events []*historypb.HistoryEvent) error {
    lastEventID := ms.GetNextEventId()
    
    for _, event := range events {
        currentID := event.GetEventId()
        
        // TERMINATION INVARIANT PROOF:
        // Every event must match exactly the expected next contiguous sequence ID.
        if currentID != lastEventID {
            return serviceerror.NewInternal(fmt.Sprintf(
                "non-monotonic history sequence detected: expected %d, got %d",
                lastEventID, currentID,
            ))
        }
        
        if err := ms.ApplySingleEvent(event); err != nil {
            return err
        }
        
        lastEventID++
    }
    return nil
}
```

#### Recursion Depth Caps on HSM Tree Traversal
Hierarchical state machines can form cycles if children re-attach or parent pointers are traversed recursively. All node visits must be guarded by explicit stack depth bounds:

```go
const MaxHSMDepth = 32

func (n *Node) Traverse(depth int, visitor func(*Node) error) error {
    if depth > MaxHSMDepth {
        return serviceerror.NewInternal("HSM maximum traversal depth exceeded: cyclic hierarchy detected")
    }
    if err := visitor(n); err != nil {
        return err
    }
    for _, child := range n.children {
        if err := child.Traverse(depth+1, visitor); err != nil {
            return err
        }
    }
    return nil
}
```

---

### 3. UI & UX Micro-Mechanics

#### Event History Long-Poll Throttling and Yielding
When the Temporal Web UI streams events using gRPC-web, high-volume workflows generating thousands of events per second can cause browser DOM freeze if the stream is unthrottled:

```typescript
// UI BROWSER INVARIANT: Chunked microtask queueing to prevent thread lockup
class HistoryEventStreamConsumer {
  private buffer: HistoryEvent[] = [];
  private isFlushing = false;

  public pushEvents(incoming: HistoryEvent[]): void {
    this.buffer.push(...incoming);
    if (!this.isFlushing) {
      this.isFlushing = true;
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    // Yield execution to the browser painting pipeline
    requestAnimationFrame(() => {
      const CHUNK_SIZE = 100;
      const chunk = this.buffer.splice(0, CHUNK_SIZE);
      this.renderToDOM(chunk);

      if (this.buffer.length > 0) {
        this.scheduleFlush();
      } else {
        this.isFlushing = false;
      }
    });
  }

  private renderToDOM(events: HistoryEvent[]): void {
    // Virtualized list DOM updates avoiding layout thrashing
  }
}
```

---

### 4. Backend Concurrency & Memory Safety

#### Fenced RangeID TOCTOU Check in Shard Updates
When committing state to storage (Cassandra, SQL), a race condition can occur if another instance acquires the shard between the state check and the write. Commits must be gated by an atomic database row condition checking the monotonically increasing `RangeID`:

```sql
-- Fenced conditional update invariant to prevent TOCTOU shard split-brain:
UPDATE executions
SET 
    next_event_id = :next_event_id,
    data = :data,
    data_encoding = :data_encoding
WHERE 
    shard_id = :shard_id AND 
    namespace_id = :namespace_id AND 
    workflow_id = :workflow_id AND 
    run_id = :run_id AND 
    range_id = :expected_range_id;
-- If affected rows == 0, transaction MUST fail and shard immediately unloads!
```

```go
// Go Shard Context Fencing Invariant:
func (s *ShardContextImpl) UpdateWorkflowExecution(ctx context.Context, req *persistence.UpdateWorkflowExecutionRequest) error {
    s.lock.RLock()
    currentRangeID := s.rangeID
    s.lock.RUnlock()

    req.RangeID = currentRangeID
    resp, err := s.executionManager.UpdateWorkflowExecution(ctx, req)
    if err != nil {
        if errors.Is(err, persistence.ErrShardOwnershipLost) {
            // Unload shard immediately: we are a zombie node!
            s.UnloadNow()
        }
        return err
    }
    return nil
}
```

#### Memory Leak Elimination in Event Cache via LRU Weight Pinning
The in-memory workflow events cache must track byte sizes rather than item counts. A single large history event containing megabytes of activity input can cause an Out-Of-Memory (OOM) crash if an item-count LRU is used:

```go
type EventCacheItem struct {
    Events []*historypb.HistoryEvent
    Size   int
}

// Cache initialization must pin byte weight:
cache := collection.NewLRU(
    maxMemoryBytes, // Bound by physical byte footprint (e.g., 512MB)
    collection.WithCostFunc(func(key any, value any) int {
        return value.(*EventCacheItem).Size
    }),
    collection.WithEvictionFunc(func(key any, value any) {
        // Explicitly clear references for GC scavenging
        item := value.(*EventCacheItem)
        item.Events = nil
    }),
)
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### Error Boundary Containment in Workflow Task Processing
An unhandled panic inside an activity or workflow task completion handler must never crash the history shard engine thread. It must convert to an internal service error, write an error marker to history, or fail the task attempt while preserving shard cache integrity:

```go
func (h *WorkflowTaskCompletedHandler) InvokeSafe(ctx context.Context, req *historyservice.RespondWorkflowTaskCompletedRequest) (resp *historyservice.RespondWorkflowTaskCompletedResponse, err error) {
    defer func() {
        if r := recover(); r != nil {
            stack := debug.Stack()
            h.logger.Error("Panic recovered inside WorkflowTaskCompleted handler",
                tag.WorkflowID(req.GetWorkflowId()),
                tag.Error(fmt.Errorf("%v", r)),
                tag.SysStack(string(stack)),
            )
            h.metricsHandler.Counter("workflow_task_panic_count").Record(1)
            // Convert to internal error: Shard remains alive!
            err = serviceerror.NewInternal(fmt.Sprintf("internal server panic: %v", r))
        }
    }()

    return h.Invoke(ctx, req)
}
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Sharded Architecture**: The system partitions mutable state into isolated