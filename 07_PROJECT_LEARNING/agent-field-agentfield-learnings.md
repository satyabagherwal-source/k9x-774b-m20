> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source**: github ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Source Version**: `a31ceb62`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T01:56:30.637Z  
> **Learning ID**: `learn-github-agent-field-agentfield`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Agent-Field/agentfield

---

## 1. Executive Forensic Architecture & System Mechanics

AgentField is an open-source control plane and orchestration fabric designed to operate heterogeneous AI agents (written in Go, Python, or TypeScript) as managed microservices. It bridges the gap between raw LLM scripts and high-concurrency microservice architectures by providing lifecycle management, process isolation, deterministic port assignment, rate-limiting HTTP gateways, structured output recovery, and distributed execution tracing.

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                 |
+---------------------------------------------------------------------------------------+
        |                                       |                                   |
        | (Go SDK)                              | (Python SDK)                      | (TypeScript SDK)
        v                                       v                                   v
+-----------------------+               +-----------------------+           +-----------------------+
|  Rate-Limited Client  |               |  Harness / Agent AI   |           |  AgentField Client    |
| - Header-scoped timer |               | - Dual-token retry    |           | - Scoped PauseClock   |
| - SSE retry boundary  |               | - Structured recovery |           | - Polling wait engine |
+-----------------------+               +-----------------------+           +-----------------------+
        |                                       |                                   |
        +---------------------------------------+-----------------------------------+
                                                |
                                                v  HTTP / REST / SSE
+---------------------------------------------------------------------------------------+
|                             AGENTFIELD CONTROL PLANE                                  |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | DefaultAgentService (Lifecycle Coordinator)                                  |   |
|   | - Dependency DAG Walker (Cycle Detection via `inProgress` bitset)             |   |
|   | - Transactional Port Allocator (Two-phase reserve -> probe -> fresh fallback)  |   |
|   | - Process Registration Boundary (Rollback PID on registry persistence fail)   |   |
|   +-------------------------------------------------------------------------------+   |
|             |                                 |                               |       |
|             v                                 v                               v       |
|   +-------------------+             +-------------------+           +-----------------+
|   |  ProcessManager   |             |    PortManager    |           | RegistryStorage |
|   |  - OS Exec / Fork |             |  - 8001-8999 Pool |           | - ~/.agentfield |
|   |  - Group Signals  |             |  - Ephemeral Lock |           | - packages.json |
|   +-------------------+             +-------------------+           +-----------------+
|             |                                                                         |
|             v                                                                         |
|   +-------------------------------------------------------------------------------+   |
|   | Agent Node Process (Python venv / Go binary / Node.js)                        |   |
|   | - Exposes /health, /shutdown, /capabilities                                  |   |
|   | - Trapped in process group: Kill(-PID, SIGINT)                                |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
```

### Critical Architectural Boundaries
1. **Host Orchestration & Port Lease Barrier**: Node processes are spawned as independent operating system child processes. To avoid Time-of-Check to Time-of-Use (TOCTOU) port collisions between the host's allocation logic and internal agent dependencies, the `PortManager` implements an atomic reservation lease pattern. Automatic allocations support single-shot fallback retry upon encountering runtime strict-bind collisions.
2. **Transport Header vs. Stream Payload Decoupling**: For streaming completions (Server-Sent Events), the client decouples HTTP header acquisition from response body streaming. Rate-limiting backoff loops encompass only the initial connection and header receipt phase; once a `200 OK` status and `text/event-stream` header are established, the rate-limiter context relinquishes control to an unbounded streaming channel reader.
3. **Execution State Drift & Invariant Reconciliation**: The control plane treats process registries on disk (`~/.agentfield/packages`) as state caches. The `reconcileLifecycleProcessState` engine cross-references registered PIDs against OS process tables and port listeners, pruning orphan records and cleaning stale lock states before attempting launches.
4. **Isolated Process-Group Signaling**: Node processes running within virtual environments spawn sub-interpreters or worker threads. Dev mode and shutdown operations dispatch signals to the negative Process ID (`-cmd.Process.Pid`), terminating the entire process group rather than leaving orphan background threads bound to listening sockets.

---

## 2. Net-New Universal Engineering Rules

### 1. Decoupled Transport Header Deadlines from Stream Body Lifecycles in Rate-Limited HTTP Clients

**RULE**:
When wrapping streaming HTTP requests (such as Server-Sent Events or chunked transfer encoding) in automatic rate-limiting and retry wrappers, the retry loop and HTTP client timeouts MUST ONLY govern the handshake and header receipt phase. The underlying HTTP client's `Timeout` MUST be cleared to zero for the duration of the body consumption, and cancellation MUST be delegated to an independent explicit `context.CancelFunc` invoked only when stream reading terminates or encounters an I/O fault.

**WHY**:
Standard HTTP client timeouts (`http.Client.Timeout` in Go, standard request timeouts in Node/Python) govern the *entire* duration from request transmission until the response body EOF is reached. If an agent is processing a long-running LLM stream (e.g., a 60-second generation), a client-level timeout will violently sever the connection mid-stream. Conversely, failing to route the streaming request through the rate limiter causes upstream `429 Too Many Requests` or `503 Service Unavailable` status codes to bypass the retry backoff entirely, immediately breaking client code on transient load spikes.

**WHEN TO APPLY**:
- Any Go, Rust, TypeScript, or Python client consuming chunked HTTP or SSE streams behind API gateways that enforce rate limits (OpenAI, Anthropic, OpenRouter, AWS Bedrock).
- When HTTP client instances are shared between non-streaming unary calls and streaming endpoints.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from sdk/go/ai/client.go: openStream & StreamComplete
func (c *Client) openStream(ctx context.Context, req *Request, body []byte) (*http.Response, context.CancelFunc, error) {
	url := strings.TrimSuffix(c.config.BaseURL, "/") + "/chat/completions"

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	// Clone the client and ZERO OUT the client-level timeout so that reading
	// the unbounded streaming body is never prematurely truncated by the client.
	streamClient := c.httpClient
	cancel := context.CancelFunc(func() {})
	var headerTimer *time.Timer

	if headerTimeout := c.httpClient.Timeout; headerTimeout > 0 {
		clone := *c.httpClient
		clone.Timeout = 0 // Invariant: Body stream must not be bounded by header timeout
		streamClient = &clone

		// Create a separate cancellation context specifically for header resolution
		var reqCtx context.Context
		reqCtx, cancel = context.WithCancel(ctx)
		headerTimer = time.AfterFunc(headerTimeout, cancel)
		httpReq = httpReq.WithContext(reqCtx)
	}

	httpResp, err := streamClient.Do(httpReq)
	if headerTimer != nil {
		// Invariant: Header arrived within timeout; disarm header timer immediately
		headerTimer.Stop()
	}
	if err != nil {
		cancel()
		return nil, nil, fmt.Errorf("execute request: %w", err)
	}

	// Non-2xx responses must drain and close body immediately, then fail fast
	// to allow the outer rate-limiter to retry.
	if httpResp.StatusCode < http.StatusOK || httpResp.StatusCode >= http.StatusMultipleChoices {
		respBody, _ := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		cancel()
		return nil, nil, newAPIError(httpResp.StatusCode, respBody)
	}

	// Return the live response and the cancel function to be deferred by consumer
	return httpResp, cancel, nil
}

// In the streaming caller:
var httpResp *http.Response
var cancel context.CancelFunc
open := func() error {
    var openErr error
    httpResp, cancel, openErr = c.openStream(ctx, req, body)
    return openErr
}

// The header phase is executed within the RateLimiter boundary
if c.rateLimiter == nil {
    err = open()
} else {
    err = c.rateLimiter.Execute(ctx, open)
}
if err != nil {
    errCh <- err
    return
}
defer cancel()
defer httpResp.Body.Close()
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Direct stream execution without header-timeout decoupling
// 1. 429/503 errors trigger immediate fatal errors instead of limiter retries.
// 2. c.httpClient.Timeout will abort long-lived generations mid-payload.
func (c *Client) BadStreamComplete(ctx context.Context, body []byte) (<-chan StreamChunk, <-chan error) {
    httpReq, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
    // BUG: If httpClient.Timeout is 30s, any stream longer than 30s is killed.
    // BUG: No rate-limiter wrapping Do(), meaning transient 429s crash callers.
    httpResp, err := c.httpClient.Do(httpReq)
    if err != nil { ... }
    // ...
}
```

**VERIFICATION METHOD**:
Run an integration unit test with a mock server configured to return two consecutive `HTTP 429 Too Many Requests` responses followed by a continuous, slow SSE stream delivering 1 chunk every 500ms for 3 seconds. Assert that:
1. Exactly 3 HTTP requests are dispatched (2 retried, 1 connected).
2. The client timeout (configured to 1 second) does not trigger an EOF or `context deadline exceeded` error while the stream body is delivering chunks.

---

### 2. Monotonic Relative Offsets for Shared Execution Pause Clocks

**RULE**:
When tracking active compute or execution timeouts in systems supporting pauses (such as waiting for human-in-the-loop validation, external tasks, or child agent completion), elapsed time calculations MUST capture the baseline pause accumulator value at the local function entry point and subtract ONLY the differential paused duration accumulated during that specific execution window:
$$\text{ActiveElapsed} = (T_{\text{current}} - T_{\text{start}}) - (P_{\text{current}} - P_{\text{baseline}})$$
Code MUST NOT subtract the absolute accumulated pause duration ($P_{\text{current}}$) directly from the loop's wall-clock duration.

**WHY**:
In long-running workflow engines or multi-agent orchestrators, a single `PauseClock` instance is often bound to a parent context or shared across multiple sequential steps. If Step 1 pauses for 10 minutes and finishes, and Step 2 starts with a 5-second polling timeout, subtracting the total pause duration ($P_{\text{current}} = 600\text{s}$) will yield a negative or near-zero active elapsed duration ($5\text{s} - 600\text{s} = -595\text{s}$). Step 2's timeout boundary will be extended artificially by the entire historical pause duration of Step 1, preventing the polling loop from failing on stuck network conditions or deadlocks.

**WHEN TO APPLY**:
- Task polling loops, HTTP retry monitors, and heartbeat supervisors in multi-agent orchestration systems.
- Any language environment (Go, TypeScript, Python) implementing human-in-the-loop or workflow suspend/resume primitives.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Extracted from sdk/typescript/src/client/AgentFieldClient.ts
export class AgentFieldClient {
  public async waitForExecutionResult(
    executionId: string,
    opts: PollingOptions
  ): Promise<ExecutionResult> {
    const pollInterval = opts.pollIntervalMs ?? 1000;
    const timeoutMs = opts.timeoutMs ?? 60000;
    const pauseClock = opts.pauseClock;

    const start = Date.now();
    // Invariant: Capture baseline pause accumulation prior to entering this loop
    const pausedAtStart = pauseClock?.totalPaused() ?? 0;
    let interval = pollInterval;

    // Correct: Exclude only the pause duration that accrued during THIS wait cycle
    const activeElapsed = () =>
      (Date.now() - start) - ((pauseClock?.totalPaused() ?? 0) - pausedAtStart);

    while (true) {
      if (activeElapsed() > timeoutMs) {
        throw new Error(`Execution ${executionId} timed out after ${timeoutMs}ms of active time`);
      }

      const response = await this.pollStatus(executionId);
      if (response.isTerminal()) {
        return response.result;
      }

      await this.sleep(interval);
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Using global absolute paused duration in local timeout math
export class BadAgentFieldClient {
  public async waitForExecutionResult(executionId: string, opts: PollingOptions): Promise<ExecutionResult> {
    const start = Date.now();
    const pauseClock = opts.pauseClock;

    // BUG: If pauseClock was already paused for 5000ms by an earlier sub-agent,
    // (Date.now() - start) - 5000ms creates an enormous negative deficit.
    // A 200ms timeout will take 5200ms to trip!
    const activeElapsed = () => (Date.now() - start) - (pauseClock?.totalPaused() ?? 0);

    while (true) {
      if (activeElapsed() > opts.timeoutMs) {
        throw new Error('Timed out');
      }
      // ...
    }
  }
}
```

**VERIFICATION METHOD**:
Using fake timers (e.g., `vitest` or `jest`):
1. Initialize `clock = new PauseClock()`.
2. Advance system time by 4,000ms during an active pause, then close the pause (`clock.totalPaused() === 4000`).
3. Invoke `waitForExecutionResult` with `timeoutMs: 200`.
4. Configure the mocked polling target to return HTTP 503 repeatedly.
5. Assert that the client throws a timeout error after exactly 200ms of simulated wall time, NOT 4,200ms.

---

### 3. Atomic Process Registration Rollback Invariant

**RULE**:
When an orchestration service spawns a long-lived OS-level process and subsequently commits its identity and socket metadata to an external persistent store (disk registry, database, or KV store), the service MUST treat the persistent storage write as a mandatory transaction boundary. If the registry write fails for any reason (disk full, write lock, permissions, schema error), the orchestrator MUST explicitly kill the newly spawned process via its PID before returning the error.

**WHY**:
Failing to terminate the running process on a failed registry write creates an unmanaged zombie background process. The process retains ownership of its allocated TCP port, but because its metadata was never committed to the control plane's registry, the orchestrator cannot discover, track, or stop it via subsequent commands. When the system subsequently attempts to restore or run that node again, it will trigger perpetual port conflicts or instantiate duplicate running instances competing for shared data directories.

**WHEN TO APPLY**:
- Local daemon runners, agent CLI tooling, process supervisors, and container/pod management sidecars.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from control-plane/internal/core/services/agent_service.go
// 4-5. Start the process and wait for readiness.
pid, port, startErr := as.startWithPortRetry(port, retryOnConflict, func(p int) (int, error, bool) {
    return as.attemptStart(agentNode, name, p)
})
if startErr != nil {
    as.printStartupFailureDiagnostics(agentNode, name)
    return nil, startErr
}

// 6. Update registry with runtime info.
// Invariant: A node that cannot be recorded in the persistent registry MUST NOT
// be left running. It must be rolled back immediately.
if err := as.updateRuntimeInfo(name, port, pid); err != nil {
    if stopErr := as.processManager.Stop(pid); stopErr != nil {
        fmt.Printf("CRITICAL: failed to stop unrecorded node %s (pid %d): %v\n", name, pid, stopErr)
    }
    return nil, fmt.Errorf("failed to update runtime info: %w", err)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Ignoring storage persistence errors after process execution
func (as *BadAgentService) RunAgent(name string) error {
    pid, port, err := as.launchProcess(name)
    if err != nil { return err }

    // BUG: If disk is full, the process is already running in background,
    // listening on the TCP port, but is now completely orphaned from the supervisor.
    err = as.registryStorage.SavePID(name, pid, port)
    if err != nil {
        return fmt.Errorf("could not save registry: %w", err) // Orphaned leak!
    }
    return nil
}
```

**VERIFICATION METHOD**:
Implement a mock `RegistryStorage` whose `SaveRegistry` or `SavePackage` returns an I/O error (e.g., `os.ErrPermission`). Execute `RunAgent`. Verify via OS signal inspections or process manager mocks that `processManager.Stop(pid)` was called with the exact PID returned by the OS launcher, and that no process with that PID remains active on the host.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unretried 429/503 Failures on Streaming Completions (`BUG-SDKGO-STREAM-01`)

- **Context**: Subsystem: Go SDK client (`sdk/go/ai/client.go`). Handles unary and streaming LLM chat completions against OpenAI/Anthropic-compatible APIs.
- **What Was Expected**: When configuring an AI client with a `RateLimiter`, all completion requests—including streaming requests via `StreamComplete`—must respect the rate-limiter, catching upstream `429 Too Many Requests` or `503 Service Unavailable` status codes and executing configured exponential backoffs before giving up.
- **What Actually Happened**: Unary calls (`Complete`) properly routed through `c.rateLimiter.Execute`, but `StreamComplete` bypassed the rate limiter and invoked `streamClient.Do(httpReq)` directly. Any transient rate limit on a stream failed instantly, aborting downstream workflows. Furthermore, `http.Client.Timeout` was terminating healthy streams that took longer to stream than the initial client connection timeout.
- **Evidence in Repo**: Commit SHA `d5323ccb`. PR #1165. Tests added in `sdk/go/ai/rate_limiter_client_test.go` (`TestStreamCompleteRetriesOn429ThenSucceeds`).
- **Root Cause**: Streaming was implemented by dispatching an asynchronous goroutine that performed the full HTTP execution inline without extracting the handshake/header phase into an actionable retry closure.
- **Remediation Code Diff**:
```go
--- a/sdk/go/ai/client.go
+++ b/sdk/go/ai/client.go
@@ -257,67 +320,27 @@ func (c *Client) StreamComplete(ctx context.Context, prompt string, opts ...Opti
-		// Execute request
-		httpResp, err := streamClient.Do(httpReq)
-		if headerTimer != nil {
-			headerTimer.Stop()
+		// Open the stream. The header phase goes through the rate limiter so
+		// 429/503 responses are retried like in Complete.
+		var httpResp *http.Response
+		var cancel context.CancelFunc
+		open := func() error {
+			var openErr error
+			httpResp, cancel, openErr = c.openStream(ctx, req, body)
+			return openErr
 		}
+		if c.rateLimiter == nil {
+			err = open()
+		} else {
+			err = c.rateLimiter.Execute(ctx, open)
+		}
 		if err != nil {
-			errCh <- fmt.Errorf("execute request: %w", err)
+			errCh <- err
 			return
 		}
```
- **Lesson**: Do not execute streaming requests as atomic blocks. Decouple header negotiation (retryable, rate-limitable, strictly timed) from body transfer (non-retryable, unbounded timer, context-canceled).

---

### Incident 2: Token Starvation in Structured Output Retries (`BUG-SDKPY-TOKENS-02`)

- **Context**: Subsystem: Python SDK Agent Core (`sdk/python/agentfield/agent_ai.py`). Manages reasoning model retries for structured outputs.
- **What Was Expected**: When a structured output call returns an empty result because the model spent its entire token quota on internal chain-of-thought/reasoning tokens, the retry mechanism should double the completion budget via `_increase_retry_max_tokens` to allow room for the final JSON payload.
- **What Actually Happened**: The retry function checked only `params["max_tokens"]`. When targeting modern OpenAI reasoning models (e.g., `o1`, `o3-mini`, `gpt-4o` with reasoning), the underlying client library (or LiteLLM) transforms the parameter to `max_completion_tokens`. Because `max_tokens` was absent, the retry ran with the exact same token ceiling, triggering deterministic consecutive failures.
- **Evidence in Repo**: Commit SHA `bfcb004e`. PR #1164. Unit tests in `sdk/python/tests/test_agent_ai.py` (`test_increase_retry_max_tokens_handles_max_completion_tokens`).
- **Root Cause**: Upstream provider API migration introduced parameter divergence (`max_tokens` vs `max_completion_tokens`). The sanitization and inflation function only checked the legacy key.
- **Remediation Code Diff**:
```python
--- a/sdk/python/agentfield/agent_ai.py
+++ b/sdk/python/agentfield/agent_ai.py
@@ -87,12 +87,16 @@ def _is_empty_structured_result(parsed: BaseModel) -> bool:
 def _increase_retry_max_tokens(params: Dict[str, Any]) -> None:
-    current = params.get("max_tokens")
-    if current is None:
-        params.pop("max_tokens", None)
-        return
-    if isinstance(current, int) and current > 0:
-        params["max_tokens"] = current * 2
+    # Some providers (e.g. OpenAI) get ``max_tokens`` renamed to
+    # ``max_completion_tokens`` before the call, so handle both keys.
+    for key in ("max_tokens", "max_completion_tokens"):
+        if key not in params:
+            continue
+        current = params[key]
+        if current is None:
+            params.pop(key, None)
+        elif isinstance(current, int) and current > 0:
+            params[key] = current * 2
```
- **Lesson**: When mutating protocol dictionaries for AI providers, account for schema aliasing across vendor endpoints. Always iterate over known synonym sets rather than targeting hardcoded single keys.

---

### Incident 3: Premature Polling Timeout from Shared PauseClock Contamination (`BUG-SDKTS-PAUSE-03`)

- **Context**: Subsystem: TypeScript SDK Client (`sdk/typescript/src/client/AgentFieldClient.ts`). Executes long-polling queries against agent execution tasks.
- **What Was Expected**: If an execution wait loop is supplied with a `PauseClock`, only pause time occurring *during that specific wait operation* should extend the timeout. Prior pause time from parent tasks should not alter the timeout duration.
- **What Actually Happened**: `activeElapsed` was calculated as `(Date.now() - start) - (pauseClock?.totalPaused() ?? 0)`. Because `pauseClock` is persistent and passed across chained operations, any pause time accrued by previous child agents was subtracted from the *new* call's elapsed time, causing massive negative values and extending local short timeouts by hours.
- **Evidence in Repo**: Commit SHA `62a8c6e5`. PR #1163. Tests in `sdk/typescript/tests/agentfield_client_async.test.ts`.
- **Root Cause**: Absolute state consumption of a mutable accumulator instead of snapshotting a baseline and calculating differential deltas.
- **Remediation Code Diff**:
```typescript
--- a/sdk/typescript/src/client/AgentFieldClient.ts
+++ b/sdk/typescript/src/client/AgentFieldClient.ts
@@ -519,10 +519,12 @@ export class AgentFieldClient {
     const maxInterval = opts.maxIntervalMs ?? 5000;
     const pauseClock = opts.pauseClock;
     const start = Date.now();
+    const pausedAtStart = pauseClock?.totalPaused() ?? 0;
     let interval = pollInterval;
     let childWaiting = false;

-    const activeElapsed = () => (Date.now() - start) - (pauseClock?.totalPaused() ?? 0);
+    // The clock belongs to the parent execution; exclude only pauses during this wait.
+    const activeElapsed = () => (Date.now() - start) - ((pauseClock?.totalPaused() ?? 0) - pausedAtStart);
```
- **Lesson**: When sharing stateful clocks or accumulators across asynchronous phases, always compute windowed intervals using a local baseline offset: $\Delta = P_t - P_0$.

---

### Incident 4: Argument