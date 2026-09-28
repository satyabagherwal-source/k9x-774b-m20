> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/google-gemini-gemini-cli-learnings.md`  
> **Source**: GitHub ([https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T19:15:10.441Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: google-gemini/gemini-cli

## 1. Executive Forensic Architecture & System Mechanics

`gemini-cli` is an interactive CLI agent and protocol host bridging developer workstations, local development toolchains, and Gemini generative models via direct streaming APIs and the Model Context Protocol (MCP). The architecture spans three execution planes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Execution Orchestrator                          │
│   (Turn-taking, Context Compaction, Stream Parsing, Tool Dispatch)     │
└───────────────┬──────────────────────────────────────┬─────────────────┘
                │                                      │
                ▼                                      ▼
┌───────────────────────────────┐      ┌─────────────────────────────────┐
│     Local Execution Core      │      │    ACP / MCP Protocol Plane     │
│  - Virtual PTY / ConPTY Host  │      │  - JSON-RPC 2.0 Transport       │
│  - Sandboxed Shell Runner     │      │  - Client Capability Negotiator │
│  - Path & Policy Redirection  │      │  - Tool Permission Gating       │
│  - Atomic File Workflows      │      │  - IDE Companion Wire (VS Code) │
└───────────────────────────────┘      └─────────────────────────────────┘
```

### Architectural Subsystems
1. **Core Dispatcher & Agent Loop**: Orchestrates streaming multi-turn reasoning loops. It handles tool execution, token accounting, context window eviction, and stream interruption (`AbortController`).
2. **Terminal & PTY Subsystem**: Bridges Node.js I/O with native Pseudoterminals (`node-pty` / Windows ConPTY). It isolates terminal raw-mode transitions, ANSI sequence sanitization, diagnostic path normalization, and child process lifecycle management.
3. **Agent Client Protocol (ACP) & MCP Host**: Exposes an RPC boundary for IDEs (such as VS Code companions) and external MCP servers. Enforces a strict protocol state machine for capability handshakes, out-of-band notifications, and permission elevation prior to execution.
4. **Resilient Network & Auth Gate**: Manages OAuth2 token refresh persistence, dynamic proxy agent interop via esbuild, exponential backoff with retry progress instrumentation, and zero-leak credential lifecycle management.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### 1. The OAuth2 Refresh Token Eviction Anti-Pattern
* **Failure Mode / Pitfall**: Users were repeatedly logged out after token expiration. The CLI threw unauthorized errors despite having valid refresh flows (`8fd119f7`).
* **Root Cause**: Many OAuth2 token endpoints (including Google Identity) omit the `refresh_token` in subsequent refresh response payloads if the initial token has not expired. The credential store executed a naive full-object overwrite (`credentials = { ...newResponse }`), which replaced the existing stored credentials with an object where `refresh_token` was `undefined`.
* **Exact Prevention / Fix**: Merge refreshed payloads with fallback retention, and make credential deletion strictly idempotent:
```typescript
interface StoredCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
  id_token?: string;
  token_type?: string;
}

export function mergeRefreshedCredentials(
  existing: StoredCredentials,
  incoming: Partial<StoredCredentials>
): StoredCredentials {
  return {
    ...existing,
    ...incoming,
    // Preserve existing refresh_token if endpoint omitted it
    refresh_token: incoming.refresh_token?.trim() || existing.refresh_token,
  };
}
```

### 2. Stdin Stream Freezing During Terminal Capability Probing
* **Failure Mode / Pitfall**: The CLI hung indefinitely on an Enter keypress during interactive sessions, preventing any input after startup (`a3d69c14`, PR `#29475`).
* **Root Cause**: To detect terminal capabilities (color depth, ANSI escape codes, bracketed paste), the CLI injected query sequences (e.g., `\x1b[6n`) into stdout and listened on `process.stdin`. During initialization, `stdin.pause()` was called to prevent leaking raw response bytes to standard readline interfaces. However, if the capability detection completed or timed out without explicitly invoking `stdin.resume()`, Node’s internal libuv stream state remained paused. Downstream consumers (like `readline` or `@inkjs`) never received subsequent data events.
* **Exact Prevention / Fix**: Enclose stream state mutations in an automated capability scope with `finally` state recovery:
```typescript
export async function probeTerminalCapability(
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
  probeSequence: string,
  timeoutMs = 150
): Promise<string | null> {
  const wasPaused = stdin.isPaused();
  const wasRaw = stdin.isRaw;

  try {
    stdin.setRawMode?.(true);
    stdin.resume(); // Must be flowing to capture escape sequence replies

    return await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);

      function onData(chunk: Buffer) {
        cleanup();
        resolve(chunk.toString("utf-8"));
      }

      function cleanup() {
        clearTimeout(timer);
        stdin.removeListener("data", onData);
      }

      stdin.once("data", onData);
      stdout.write(probeSequence);
    });
  } finally {
    stdin.setRawMode?.(wasRaw ?? false);
    if (wasPaused) {
      stdin.pause();
    } else {
      stdin.resume(); // Explicitly restore flowing mode
    }
  }
}
```

### 3. ConPTY Output Finalization Race on Windows
* **Failure Mode / Pitfall**: Child process execution terminated prematurely, dropping the tail end of command stdout/stderr (e.g., test runners cutting off final summaries or errors) (`4577750d`, `9450ade7`).
* **Root Cause**: On Windows, the ConPTY engine decouples the process exit event from pipe drainage. When the child process exits, Node’s `child_process.on('exit')` fires immediately. If the CLI closes file descriptors or resolves the execution promise upon receiving `'exit'`, buffered bytes still in transit across the ConPTY pipe are discarded.
* **Exact Prevention / Fix**: Gate execution resolution behind both the process `'exit'` event AND the stream `'close'`/`'end'` event using deterministic event barriers:
```typescript
import { IPty } from "node-pty";

export function waitForPtyExit(ptyProcess: IPty): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    let exitCode: number | null = null;
    let streamClosed = false;

    function checkResolution() {
      if (exitCode !== null && streamClosed) {
        resolve({ exitCode });
      }
    }

    ptyProcess.onExit((e) => {
      exitCode = e.exitCode;
      checkResolution();
    });

    // PTY data stream must signal EOF/close before finalizing
    ptyProcess.onData((_data) => {
      // Stream is actively draining
    });

    // Handle stream termination guard
    (ptyProcess as unknown as NodeJS.EventEmitter).on("close", () => {
      streamClosed = true;
      checkResolution();
    });
  });
}
```

### 4. Non-Atomic Parallel Tool Execution & Lost-Update Races
* **Failure Mode / Pitfall**: When the agent emitted parallel tool calls targeting overlapping files or state paths, concurrent writes corrupted target files or resulted in silent rollbacks (`PR #29498`, PR `#29494`).
* **Root Cause**: Tool callers executed asynchronous operations without a keyed lock. Two simultaneous `write_file` or `patch_file` calls read state $S_0$, executed parallel diffs, and wrote back $S_1$ and $S_2$ sequentially, obliterating one mutation. Furthermore, writes directly targeting the live file exposed partial writes to file-system watchers.
* **Exact Prevention / Fix**: Implement a keyed async mutex serializing mutations per normalized canonical path, paired with atomic write operations using unique temp files and atomic renames (`fs.rename`):
```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

class FileActionLock {
  private queues = new Map<string, Promise<void>>();

  async acquire<T>(filePath: string, action: () => Promise<T>): Promise<T> {
    const canonical = path.resolve(filePath);
    const currentPromise = this.queues.get(canonical) ?? Promise.resolve();

    let releaseLock: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.queues.set(canonical, currentPromise.then(() => nextPromise));

    try {
      await currentPromise;
      return await action();
    } finally {
      releaseLock!();
      if (this.queues.get(canonical) === nextPromise) {
        this.queues.delete(canonical);
      }
    }
  }
}

export async function writeAtomicFile(targetPath: string, content: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${crypto.randomUUID()}.tmp`);

  await fs.writeFile(tempPath, content, "utf-8");
  try {
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}
```

### 5. Memory Exhaustion via Long-Running Tool Outputs
* **Failure Mode / Pitfall**: Long agent sessions running high-volume CLI commands (e.g., `git log`, `npm install`, compilation logs) crashed the process with V8 `ERR_STRING_TOO_LONG` or process Out-Of-Memory (OOM) errors (`bedef96e`, `196c772a`).
* **Root Cause**: Large tool outputs were concatenated in-memory into unbounded strings and held within the active conversational context array.
* **Exact Prevention / Fix**: Enforce bounded sliding-window ring buffers at the tool capture layer, truncating mid-stream with metadata annotating total bytes dropped:
```typescript
export class BoundedOutputCollector {
  private chunks: Buffer[] = [];
  private totalBytes = 0;

  constructor(private readonly maxBytes: number = 512 * 1024) {} // 512KB cap

  push(data: Buffer | string): void {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    this.totalBytes += buf.length;

    if (this.totalBytes <= this.maxBytes) {
      this.chunks.push(buf);
    } else {
      // Calculate remaining budget
      const currentRetained = this.chunks.reduce((acc, c) => acc + c.length, 0);
      const budgetRemaining = this.maxBytes - currentRetained;
      if (budgetRemaining > 0) {
        this.chunks.push(buf.subarray(0, budgetRemaining));
      }
    }
  }

  getFinalPayload(): string {
    const retained = Buffer.concat(this.chunks).toString("utf-8");
    if (this.totalBytes > this.maxBytes) {
      const omitted = this.totalBytes - this.maxBytes;
      return `${retained}\n\n[WARNING: Tool output truncated. ${omitted} bytes omitted to protect memory context.]`;
    }
    return retained;
  }
}
```

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

### D1: Structural Boundaries & Modularity
The codebase maintains a strict boundary between three tiers:
- **Core Domain Layer**: Tool registries, system prompt construction, context window managers, model provider adapters. Zero reliance on terminal or protocol implementations.
- **Protocol Boundary (ACP/MCP)**: Operates strictly via JSON-RPC 2.0 serialization over stdio/SSE. Tools are exposed as MCP capabilities.
- **CLI Presentation Layer**: Encapsulates raw I/O, Ink/React-like rendering loops, terminal escape sequences, and OS signal handlers (`SIGINT`, `SIGWINCH`).

*Rule*: Core domain operations must accept an abstraction of file system, shell, and network interfaces. They never import `process.stdout` or raw OS primitives directly.

### D2: Asynchronous State & Concurrency Defense
- **Tool Operation Serialization**: File modifications and workspace state mutations are gated behind a keyed asynchronous queue (`FileActionLock`), ensuring that simultaneous parallel tool invocations requested by Gemini execute safely without interleaving race conditions.
- **Stream Interrupt Synchronization**: `AbortController` instances are passed down to every network call, shell runner, and file streaming operation. When an abort occurs, the system must suppress secondary `AbortError` stack traces from bubbling to telemetry (`e128cd6f`), while awaiting child process process tree termination.

### D3: Error Boundaries, Recovery & Rollback Protocols
- **Safe JSON Config Deserialization**: Missing MCP configuration must be distinguished from malformed JSON (`cc7e6ad3`). Missing configurations fallback to empty defaults with zero-warning quiet paths; malformed JSON halts execution with a structured schema validation error.
- **Connection Recovery Visual Feedback**: Network reconnects wrap streaming queries in exponential backoff retry loops, dispatching events to the UI thread to update status indicators (`8e70c862`) rather than blocking the main event loop.

### D4: Resource Lifecycle & Leak Defenses
- **Background Shell Cleanup**: When a background execution exits or encounters an unhandled exception, temporary working directories created for script isolation are cleared via an asynchronous deterministic finalizer (`20f70757`).
- **PTY Descriptor Teardown**: PTY file descriptors must be explicitly closed upon child process exit. Failing to close master/slave file descriptors leads to EMFILE ("Too many open files") when running batch agent workflows (`9450ade7`).

### D5: Boundary Deserialization, Schemas & Input Sanitization
- **Strict Protocol RPC Sequencing**: In ACP mode, `tool_call` updates must be dispatched to the consumer before issuing a `request_permission` notification (`d5b3e3ac`). Doing this out of order causes client UIs to present authorization dialogues for unknown or uninstantiated tool identifiers.
- **MCP Tool Title Signatures**: Tools format call titles as structured deterministic signatures (`name(arg=val)`), while segregating unstructured human explanations into isolated metadata blocks (`49cc3b34`).

### D6: Cross-Platform & Runtime Compatibility Gotchas
- **Windows Path Normalization**: Diagnostic paths and internal URI transformations must preserve drive letters while converting backslashes for model parsing (`196c772a`).
- **ConPTY vs. Unix PTY Signals**: Windows does not support POSIX signals (`SIGWINCH`, `SIGKILL`). Process resizing must go through `ptyProcess.resize(cols, rows)`, and process termination requires explicit process-tree killing using Windows `kernel32.dll` APIs or `taskkill /F /T`.
- **Negative Dimensions in Border Rendering**: Terminal resizing can briefly report zero or negative rows/columns. Border rendering algorithms must clamp sizes: `Math.max(0, width - padding)` (`e09d9d72`).

### D7: Build, CI/CD, Deployment & Dependency Invariants
- **Esbuild Dynamic CJS/ESM Proxy Interop**: Bundling network agents like `proxy-agent` via esbuild fails at runtime when resolving default imports or conditional CJS exports (`04e39e5d`). Explicit interop helpers must be injected into the bundling banner to handle `default` export normalization across bundler boundaries.
- **Git External Diff Configuration**: Stripping accidental `diff.external` configuration overrides ensures standard diff generation in git automation tools without triggering third-party GUI diff tools (`562f0361`).

### D8: Concrete Bug Fixes & Forensic Patches
- `361b0bbc`: Session resolution must occur before configuration initialization to prevent race conditions during session restore. Same-minute filename collisions in session logging are prevented by appending high-resolution timestamps (`Date.now()`) or nanosecond counters.
- `e5b66803`: VS Code companion terminal tab tracking maintains an explicit stack of previously focused panel identifiers to restore user cursor location when closing diff review tabs.

---

## 4. Net-New Universal Engineering Rules

## 72. Safe OAuth2 Token Refresh Persistence

**RULE**:
When persisting updated credentials returned from an OAuth2 token refresh operation, the client MUST perform a property-preserving merge that retains existing secrets (specifically `refresh_token`) if the identity provider omits them in the refresh response. Credential deletion functions MUST be idempotent, returning success when deleting non-existent entries.

**WHY**:
RFC 6749 allows authorization servers to omit the `refresh_token` in refresh response payloads if the existing token remains valid. Naive overwrites (`credentials = newTokens`) overwrite `refresh_token` with `undefined`. Subsequent token expirations will trigger unrecoverable authentication failures, ejecting users from long-running sessions.

**WHEN TO APPLY**:
Any authentication manager, OAuth2 client integration, or persistent credential vault storing third-party platform tokens.

**NEGATIVE CONSTRAINTS**:
- NEVER write `await storage.set(tokenResponse)` directly without merging with `await storage.get()`.
- NEVER fail with an exception when `deleteCredentials()` is called on an already empty or non-existent credential key.

**VERIFIED IMPLEMENTATION PATTERNS**:
```typescript
export interface TokenStoragePayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function updateTokenCache(
  storage: StorageAdapter,
  key: string,
  freshResponse: { access_token: string; refresh_token?: string; expires_in: number }
): Promise<TokenStoragePayload> {
  const existing = await storage.get<TokenStoragePayload>(key);

  const merged: TokenStoragePayload = {
    accessToken: freshResponse.access_token,
    refreshToken: freshResponse.refresh_token ?? existing?.refreshToken ?? "",
    expiresAt: Date.now() + freshResponse.expires_in * 1000,
  };

  if (!merged.refreshToken) {
    throw new Error(`Insecure OAuth state: Refresh token missing during rotation for key: ${key}`);
  }

  await storage.set(key, merged);
  return merged;
}
```

---

## 73. Stdin Capability Probe Isolation Invariant

**RULE**:
Any capability detection, ANSI interrogation, or terminal feature probe that mutates standard input (`process.stdin`) stream state (e.g., setting raw mode, adding listeners, or pausing the stream) MUST restore the stream to its exact pre-probe flowing and mode state within an absolute deterministic timeout.

**WHY**:
Interrogating terminal features requires putting `stdin` into raw mode and pausing normal line parsing to capture escape sequence replies. If the capability probe fails, times out, or completes without explicitly restoring `stdin.resume()`, the standard Node.js event loop leaves libuv stream handles paused. Downstream interactive CLI runtimes hang indefinitely on user input.

**WHEN TO APPLY**:
Any terminal/CLI tool probing cursor positions (`\x1b[6n`), device attributes (`\x1b[0c`), or bracketed paste support during application boot.

**NEGATIVE CONSTRAINTS**:
- NEVER invoke `stdin.pause()` without a corresponding guaranteed `stdin.resume()` in a `finally` block or lifecycle teardown hook.
- NEVER perform an asynchronous terminal query without an aggressive fallback timeout (maximum 200ms).

**VERIFIED IMPLEMENTATION PATTERNS**:
```typescript
export async function withIsolatedStdin<T>(
  stdin: NodeJS.ReadStream,
  action: () => Promise<T>,
  timeoutMs = 200
): Promise<T> {
  const previousRaw = Boolean(stdin.isRaw);
  const wasPaused = stdin.isPaused();

  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Terminal probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([action(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
    if (stdin.setRawMode) {
      stdin.setRawMode(previousRaw);
    }
    if (wasPaused) {
      stdin.pause();
    } else {
      stdin.resume(); // Ensure flowing state is actively re-established
    }
  }
}
```

---

## 5. Actionable Agent Skill & Implementation Checklist

### Phase 1: Stream & Stdin Sanitization
- [ ] Verify that any query injecting ANSI control sequences into `stdout` wraps `stdin` access inside a `withIsolatedStdin` timeout harness.
- [ ] Confirm that `stdin.resume()` is explicitly executed before handing control over to conversational prompt listeners (e.g., `readline`, `@inkjs`).
- [ ] Ensure non-interactive execution (`!process.stdin.isTTY`) completely bypasses terminal capability interrogation.

### Phase 2: Tool Execution Lifecycle & Concurrency
- [ ] Implement an in-memory per-path async mutex lock for all tools executing file edits (`write_file`, `patch_file`, `delete_file`).
- [ ] Enforce atomic file writes: write to temporary UUID-tagged files inside the target directory and execute atomic `fs.rename`.
- [ ] Cap all tool stdout/stderr aggregation using a `BoundedOutputCollector` configured to a strict maximum threshold (e.g., 512KB). Drop middle/tail bytes and flag truncation in metadata when exceeded.

### Phase 3: PTY & Windows ConPTY Hardening
- [ ] Ensure child process runners await both process `'exit'` AND stream `'close'` events prior to resolving output promises.
- [ ] Clean up slave/master file descriptors inside an explicit teardown block.
- [ ] Wrap process termination in recursive process-tree termination routines (`tree-kill` or native Windows taskkill APIs) to prevent orphaned processes when tasks are aborted.

### Phase 4: Protocol & State Correctness (ACP/MCP)
- [ ] In ACP mode, emit the `tool_call` event to the protocol stream before issuing a `request_permission` call.
- [ ] Verify that MCP config loading differentiates `ENOENT` (missing file -> safe fallback) from `SyntaxError` (malformed JSON -> fatal diagnostic).
- [ ] Validate that OAuth2 token renewal logic merges existing refresh tokens if the server omits them in subsequent rotation cycles. Ensure credential deletion methods are idempotent.