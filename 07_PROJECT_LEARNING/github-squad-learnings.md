> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/github-squad-learnings.md`  
> **Source**: github ([https://github.com/github/squad](https://github.com/github/squad))  
> **Source Version**: `7b731ec9`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-06T23:04:48.423Z  
> **Learning ID**: `learn-github-github-squad`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): github/squad

---

## 1. Executive Forensic Architecture & System Mechanics

`github/squad` is an autonomous multi-agent software engineering coordination runtime embedded within repository working trees. It coordinates multi-agent systems via GitHub Copilot CLI and Model Context Protocol (MCP) servers, maintaining persistent role state, memory governance, and team consensus directly within Git version control.

```
                      +------------------------------------------+
                      |         Developer / CI / Copilot         |
                      +------------------------------------------+
                                           |
                    [CLI Entrypoint & Arg Router (Flags / Help Intercept)]
                                           |
                 +-------------------------+-------------------------+
                 |                                                   |
    [Local Orchestration Engine]                            [MCP Stdio Server Bridge]
   (squad loop / watch / triage)                                 (squad state-mcp)
                 |                                                   |
      +----------+----------+                           +------------+------------+
      |                     |                           |                         |
[Capability Registry] [Agent Subprocess]         [Tool Registry & Aliases]  [Backend MCP Adaptor]
(pre-scan/housekeep)  (copilot -p --mcp)         (squad_state_*, memory.*)  (Conversations/Transcripts)
      |                     |                           |                         |
      +----------+----------+                           +------------+------------+
                 |                                                   |
                 +-------------------------+-------------------------+
                                           |
                                [Storage Abstraction Layer]
                     +---------------------+---------------------+
                     |                                           |
          [FSStorageProvider]                        [Git State Backend]
        - Atomic 'wx' file creation                 - Orphan branch: `squad-state`
        - UUID/PID temp-file rename                 - Git Notes: `refs/notes/squad*`
        - Exponential backoff (Win32)               - Hook chaining (`SQUAD_SYNC_ACTIVE`)
                     |                                           |
                     +---------------------+---------------------+
                                           |
                                   [Target Disk Storage]
                         .squad/ (team.md, casting/, memory/, config.json)
                         .git/worktrees/* -> resolves to main checkout
```

### Architectural Subsystem Boundaries
1. **CLI Router & Option Interceptors (`packages/squad-cli/src/cli/`)**:
   - Manages top-level dispatch, argument sanitization, worktree-aware root resolution, and subcommand help-routing interception (preventing mutations during `--help` evaluations).
   - Projects client agent adapters across diverse AI development environments (Copilot, Claude Code, Cursor, OpenCode, Kiro, Codex, Antigravity) while restricting file access to prevent path traversal outside designated roots.
2. **State & Storage Abstraction Provider (`packages/squad-sdk/src/storage/`)**:
   - Decouples file manipulations behind the `StorageProvider` contract.
   - Enforces atomic file writes via exclusive creation flags (`'wx'`), randomized PID-scoped staging paths (`${indexPath}.${process.pid}.${randomUUID()}.tmp`), and platform-specific lock handling for cross-process synchronization.
3. **Local & Distributed State Backends (`packages/squad-sdk/src/backend/`)**:
   - Supports pluggable persistence models: `local` (working tree file storage), `orphan` (isolated `squad-state` git branch history), and `two-layer` (combining git notes `refs/notes/squad*` with working tree states).
   - Manages file-level locks under `.squad/backend/locks/` with self-healing stale-lock and crash-recovery semantics.
4. **Governed Long-Term Agent Memory Subsystem (`packages/squad-sdk/src/memory/`)**:
   - Implements multi-tier memory storage (`TRANSIENT`, `LOCAL`, `POLICY`, `SEMANTIC`) backed by append-only audits (`audit.jsonl`), tombstones, and transactional index reconciliations (`index.json`).
5. **Model Context Protocol (MCP) Interface (`packages/squad-cli/src/cli/commands/state-mcp.ts`)**:
   - Serves as the stdio RPC bridge over standard JSON-RPC 2.0. Exposes Squad runtime state tools (`squad_state_*`, `memory.*`, `squad_decide`) to AI host processes without requiring direct disk access by language models.

---

## 2. Universal Engineering Rules (Candidates for Master Brain)

### 1. Cross-Platform Atomic File Swapping & Sharing-Violation Backoff
**RULE**:
File operations intended to replace or write canonical configuration and index files MUST write to a process-unique, cryptographically randomized temporary filename in the target file's parent directory and execute an atomic rename (`renameSync` or `fs.promises.rename`). On Windows platforms (`win32`), callers MUST trap `EACCES`, `EBUSY`, and `EPERM` alongside `EEXIST` when opening or renaming files, and MUST execute bounded exponential backoff retries before bubbling errors.

**WHY**:
On POSIX platforms, `rename` atomically overwrites existing destination files regardless of whether another process has the file open for reading. On Windows (NTFS/ReFS), an active handle held by an indexer, anti-virus engine, or concurrent process holds a lock that causes `rename` or exclusive file creation (`'wx'`) to fail with a sharing violation (`EPERM` or `EACCES`) instead of returning `EEXIST`. Failing to catch these platform-specific errors results in dropped writes, uncoordinated lock races, and leftover orphaned staging files (`.tmp`).

**WHEN TO APPLY**:
Apply to any cross-platform filesystem layer in CLI tools, language runtimes, or database engines where multiple local processes or threads execute concurrent read-modify-write lifecycles on shared JSON/state indexes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { access, open, rename, unlink } from 'node:fs/promises';

export interface AtomicWriteOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

export async function writeAtomicWithRetry(
  targetPath: string,
  content: string,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const { maxRetries = 4, initialDelayMs = 10 } = options;
  const parentDir = path.dirname(targetPath);
  // Guarantee process and run uniqueness in the temporary staging file
  const tmpPath = path.join(
    parentDir,
    `${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
  );

  let fh: import('node:fs/promises').FileHandle | null = null;
  try {
    // Open exclusively with 'wx' to prevent symlink/inode race conditions
    fh = await open(tmpPath, 'wx');
    await fh.writeFile(content, 'utf8');
    await fh.sync(); // Flush disk cache to guarantee persistence
    await fh.close();
    fh = null;

    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmpPath, targetPath);
        return;
      } catch (error: unknown) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as NodeJS.ErrnoException).code)
          : undefined;

        // Windows NT reports sharing violations as EACCES, EPERM, or EBUSY
        const isWindowsSharingViolation =
          process.platform === 'win32' &&
          ['EACCES', 'EBUSY', 'EPERM'].includes(code ?? '') &&
          attempt < maxRetries;

        if (!isWindowsSharingViolation) {
          throw error;
        }

        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } finally {
    if (fh) {
      try { await fh.close(); } catch { /* ignore handle cleanup */ }
    }
    try {
      await unlink(tmpPath);
    } catch {
      // Best-effort cleanup if rename did not move it
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER write in-place or use static temporary file paths:
async function badWrite(targetPath: string, data: string) {
  // ANTI-PATTERN 1: In-place write corrupts data on process crash mid-write
  await fs.promises.writeFile(targetPath, data);

  // ANTI-PATTERN 2: Static temp path causes collision races between concurrent processes
  const tmp = targetPath + '.tmp';
  await fs.promises.writeFile(tmp, data);
  // ANTI-PATTERN 3: Unhandled Windows sharing violation crashes here
  await fs.promises.rename(tmp, targetPath);
}
```

**VERIFICATION METHOD**:
Mock the filesystem rename primitive to throw `Object.assign(new Error('file is busy'), { code: 'EPERM' })` twice before succeeding, and run the test under Vitest. Assert that the write resolves with zero residual `.tmp` files in the destination directory.

---

### 2. Recursive Synchronization Lock Bypass via Environment Guards
**RULE**:
Git hooks, CLI sync commands, or daemon scripts that execute nested VCS commands (`git push`, `git fetch`, `git update-ref`, `git commit`) MUST wrap their invocation within a strictly scoped, idempotent environment variable recursion guard (`<SUBSYSTEM>_SYNC_ACTIVE=1`). Scripts MUST check for the presence of this token, early-exit with status 0 if present, set it prior to spawning downstream VCS processes, and clear/unset it in a guaranteed exit trap or finally block.

**WHY**:
Git invokes hooks (`pre-push`, `post-merge`, `post-checkout`, `post-commit`) synchronously during lifecycle commands. When a hook invokes `git push` or `git fetch` to synchronize metadata branches (e.g., orphan state branches or `refs/notes/*`), Git spawns downstream hooks recursively. Without an environmental guard, this triggers an unbounded fork-bomb or terminal pipeline deadlock, hanging the user's terminal and corrupting local reflogs.

**WHEN TO APPLY**:
Apply to any workflow orchestration, developer tooling, or hook installer that interfaces with Git lifecycle hooks or performs programmatic Git syncs across sidecar branches.

**VERIFIED IMPLEMENTATION PATTERN**:
```bash
#!/bin/sh
# Shell implementation for .git/hooks/pre-push or post-merge
set -e

# Recurse barrier invariant
if [ -n "$SQUAD_SYNC_ACTIVE" ]; then
  exit 0
fi

export SQUAD_SYNC_ACTIVE=1
trap 'unset SQUAD_SYNC_ACTIVE' EXIT INT TERM

# Safely perform sidecar ref synchronizations without triggering hook cascade
git push --no-verify "$REMOTE" 'refs/notes/squad*:refs/notes/squad*' 2>/dev/null || true
```

```typescript
// TypeScript wrapper for child process spawning
import { execFileSync } from 'node:child_process';

export function runGuardedGitSync(repoDir: string, args: string[]): void {
  if (process.env.SQUAD_SYNC_ACTIVE === '1') {
    return; // Fast escape to break recursive execution loops
  }

  execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      SQUAD_SYNC_ACTIVE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
```

**NEGATIVE CONSTRAINT**:
```bash
#!/bin/sh
# ANTI-PATTERN: Blindly executing git commands inside hooks without recursion fences
REMOTE="$1"
# Spawning git push from pre-push re-triggers pre-push -> FORK BOMB / TERMINAL HANG
git push "$REMOTE" refs/heads/squad-state:refs/heads/squad-state
```

**VERIFICATION METHOD**:
Execute an integration test initializing a clean Git repository, configuring the chained hook, and triggering `git push` against a local bare repository remote. Validate that process execution terminates in under 2000ms with process exit code 0 and total Git process spawning count $\le 2$.

---

### 3. Subcommand Help Guard & Argument Dispatch Boundary
**RULE**:
CLI argument routing frameworks MUST evaluate global informational flags (`--help`, `-h`, `--version`) at the argument-lexer level *prior* to parsing command options or delegating to subcommand handlers. A router MUST NOT permit a subcommand handler to execute side effects when an informational flag is detected in `process.argv`.

**WHY**:
If help detection is deferred to leaf command executors or ignored by subcommands that implement custom option schemas, typing `squad init --help` or `squad triage --help` can be misinterpreted as an invocation of `init` with unrecognized options. This leads to destructive consequences: scaffolding unwanted directories into the working directory, launching unbounded network loops, or allocating unneeded server ports.

**WHEN TO APPLY**:
Apply to any command-line interface runtime, command dispatcher, or multi-tenant terminal application where subcommands perform state mutation, file creation, or background process daemonization.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface CommandDef {
  name: string;
  run: (args: string[]) => Promise<number | void>;
  help: () => void;
}

export async function routeCliExecution(
  argv: string[],
  commands: Map<string, CommandDef>,
  rootHelp: () => void
): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    if (args.length > 0 && args[0] && !args[0].startsWith('-')) {
      const command = commands.get(args[0]);
      if (command) {
        command.help();
        return 0; // Handled command help cleanly without execution
      }
    }
    rootHelp();
    return 0;
  }

  const [cmdName, ...subArgs] = args;
  // Intercept nested subcommand help: `cli <cmd> --help`
  if (subArgs.includes('--help') || subArgs.includes('-h')) {
    const command = commands.get(cmdName!);
    if (command) {
      command.help();
      return 0;
    }
  }

  const command = commands.get(cmdName!);
  if (!command) {
    console.error(`Unknown command: ${cmdName}`);
    return 1;
  }

  // Guaranteed safe to execute mutations now
  const result = await command.run(subArgs);
  return typeof result === 'number' ? result : 0;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Command router passes argv directly to executor, expecting it to handle help
async function badDispatch(cmdName: string, subArgs: string[]) {
  if (cmdName === 'init') {
    // BUG: If subArgs is ['--help'], it executes scaffolding before checking flags!
    await scaffoldProjectDirectory();
    if (subArgs.includes('--help')) {
      printInitHelp();
    }
  }
}
```

**VERIFICATION METHOD**:
Execute an automated test invoking `run(['init', '--help'])` against a transient directory fixture. Assert that the directory contents remain completely empty (zero filesystem mutations) and stdout contains the command usage signature.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Cross-Process Memory Index Corruption Under Concurrent Writes (BUG-SQUAD-01)
- **Context**: `packages/squad-sdk/src/memory/index.ts`, `packages/squad-sdk/src/backend/local-backend.ts`
- **What Was Expected**: Multiple concurrent node processes running agents or background tasks updating the long-term memory governance index (`.squad/memory/index.json`) must serialize index read-modify-write operations without dropping entries or leaving corrupted JSON files.
- **What Actually Happened**: The memory store previously used an in-memory asynchronous lock (`indexLockTail = Promise.resolve()`). While this serialized concurrent operations within a *single* Node.js event loop, it provided zero mutual exclusion between *separate* Node.js operating system processes. Concurrent writers simultaneously read `index.json`, staged entries locally, and executed atomic renames over a shared static temp path (`index.json.tmp`). This caused data clobbering, truncated JSON files, and Windows file-sharing crashes.
- **Evidence in Repo**: Commit `202f07e1`, Issue `#2334`, PR `#2356`.
- **Root Cause**: Reliance on process-memory async promise chains for concurrency control across shared disk assets, combined with deterministic temporary filenames causing rename races on Windows.
- **Remediation Code Diff**:
```typescript
// packages/squad-sdk/src/memory/index.ts
-  private indexLockTail: Promise<unknown> = Promise.resolve();
-
   private async withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
-    let unlock!: () => void;
-    const release = new Promise<void>(resolve => { unlock = resolve; });
-    const prev = this.indexLockTail;
-    this.indexLockTail = release;
-    await prev;
-    try {
-      return await fn();
-    } finally {
-      unlock();
-    }
+    const resolvedSquadDir = path.resolve(this.squadDir);
+    let lockRoot = resolvedSquadDir;
+    try {
+      lockRoot = await realpath(resolvedSquadDir);
+    } catch (error) {
+      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
+    }
+    const fileLock = createFileStateStore(lockRoot);
+    const releaseFileLock = await fileLock.lockAsync!('backend/locks/memory-index');
+    try {
+      return await fn();
+    } finally {
+      releaseFileLock();
+    }
   }

   private async writeIndex(index: MemoryIndexEntry[]): Promise<void> {
     const indexPath = path.join(this.squadDir, 'memory', 'index.json');
-    const tmpPath = `${indexPath}.tmp`;
-    await this.storage.write(tmpPath, JSON.stringify(index, null, 2) + '\n');
-    await this.storage.rename(tmpPath, indexPath);
+    const tmpPath = `${indexPath}.${process.pid}.${randomUUID()}.tmp`;
+    await this.storage.write(tmpPath, JSON.stringify(index, null, 2) + '\n');
+    try {
+      for (let attempt = 0; ; attempt++) {
+        try {
+          await this.storage.rename(tmpPath, indexPath);
+          return;
+        } catch (error) {
+          const code = typeof error === 'object' && error !== null && 'code' in error
+            ? String(error.code)
+            : undefined;
+          const retryable = process.platform === 'win32'
+            && ['EACCES', 'EBUSY', 'EPERM'].includes(code ?? '')
+            && attempt < 4;
+          if (!retryable) throw error;
+          await new Promise(resolve => setTimeout(resolve, 10 * 2 ** attempt));
+        }
+      }
+    } finally {
+      await this.storage.delete(tmpPath).catch(() => {});
+    }
   }
```
- **Lesson**: Node.js microtask/promise mutexes provide zero isolation across operating system processes. Disk-bound atomic state updates require OS-level advisory locks combined with PID- and UUID-unique temporary files and platform-aware retry loops.

---

### Incident 2: MCP Launch Wrapper Process Fork Explosion on Developer Hosts (BUG-SQUAD-02)
- **Context**: `packages/squad-cli/src/cli/commands/state-mcp.ts`, Issue `#2300`
- **What Was Expected**: Each Copilot or developer session hosting a Squad state bridge should spawn a lean, single-process stdio bridge that gracefully releases memory and exits immediately when the host client disconnects.
- **What Actually Happened**: Process inventories on developer workstations revealed up to 422 lingering `state-mcp` processes running under 107 nested launcher roots. When hosts configured duplicate or global MCP configuration entries alongside repo-local `.mcp.json` files, every bridge launch chained four nested processes:
  $$\text{cmd.exe} \longrightarrow \text{node npx-cli.js} \longrightarrow \text{cmd.exe "squad state-mcp"} \longrightarrow \text{node cli-entry.js}$$
  Because parent processes did not terminate child pipes on transport disconnection, dead processes accumulated indefinitely.
- **Evidence in Repo**: Issue `#2300`, Standalone Launcher Architecture in `scripts/build-standalone.mjs`.
- **Root Cause**: Launching CLI tools through indirect wrapper scripts (`npx`) on Windows platforms created multi-tier process wrappers. Coupled with unhandled stdio EOF semantics and missing lazy initialization, this multiplied zombie processes across IDE restarts.
- **Remediation Code Diff**:
```typescript
// scripts/build-standalone.mjs & state-mcp.ts
// Replaced npx shim with compiled single-binary execution wrapper and lazy-initialization
export async function runStateMcp(startDir = process.cwd(), options: StateMcpOptions = {}): Promise<void> {
-  // Eager initialization blocked stdio handshake and crashed parent timeouts
-  const registry = createStateMcpToolRegistry(startDir);
+  // Lazy initialization: resolve state on first tool call, not at startup (#1353)
+  let registry: ToolRegistry | undefined;
+  let initError: Error | undefined;
+  function getRegistry(): ToolRegistry {
+    if (initError) throw initError;
+    if (!registry) {
+      try {
+        registry = createStateMcpToolRegistry(startDir);
+      } catch (err) {
+        initError = err instanceof Error ? err : new Error(String(err));
+        throw initError;
+      }
+    }
+    return registry;
+  }

+  // Trap process stdin close to force immediate process teardown
+  process.stdin.on('close', () => {
+    process.exit(0);
+  });
}
```
- **Lesson**: Do not invoke developer tooling or background bridges via package runners (`npx`, `yarn run`, `npm exec`) in persistent IDE configurations. Provide native launcher binaries, implement lazy evaluation, and bind process lifecycles to stdio EOF.

---

### Incident 3: Unhandled Legacy Casting Migration Blocking Whole-Project Upgrades (BUG-SQUAD-03)
- **Context**: `packages/squad-cli/src/cli/core/upgrade.ts`, `packages/squad-sdk/src/casting/durable-registry.ts`
- **What Was Expected**: Running `squad upgrade` on a project with legacy 0.9.x metadata should migrate schema structures if valid, or report isolated diagnostic warnings while allowing unaffected subsystems (templates, workflows, bridges) to upgrade successfully.
- **What Actually Happened**: The upgrade pipeline executed strict casting preflight checks synchronously. When legacy format variants (`agents[]` or `entries[]` paired with `assignments[]`) contained missing charter identities or unmapped persistent names, the entire `squad upgrade` run threw an unhandled error and aborted before upgrading `.github/workflows/` or `.squad/templates/`.
- **Evidence in Repo**: Commit `c713a82d`, Issue `#2299`, PR `#2365`.
- **Root Cause**: Hard failure cascades across heterogeneous migration steps. Casting schema validation lacked schema detection discriminators and failed to isolate exceptions from the broader file-upgrade lifecycle.
- **Remediation Code Diff**:
```typescript
// packages/squad-cli/src/cli/core/upgrade.ts
+function detectLegacyCastingFiles(castingDir: string): ReturnType<typeof detectHistoricalCastingSchema> {
+  try {
+    const registry = JSON.parse(storage.readSync(path.join(castingDir, 'registry.json')) ?? '{}') as unknown;
+    const history = JSON.parse(storage.readSync(path.join(castingDir, 'history.json')) ?? '{}') as unknown;
+    return detectHistoricalCastingSchema(registry, history);
+  } catch {
+    return undefined;
+  }
+}

-  // Hard-failing preflight stopped the entire upgrade process
-  preflightCastingRegistryPair(castingDir);
-  await runEnsureChecks(dest, templatesDir, filesUpdated);
+  // Schema-aware detection with decoupled failure reporting
+  let skipCasting = false;
+  try {
+    preflightCastingRegistryPair(castingDir);
+  } catch (error) {
+    skipCasting = true;
+    reportCastingMigrationFailure(error instanceof Error ? error.message : String(error));
+  }
+  // Remaining upgrade continues unblocked
+  await runEnsureChecks(dest, templatesDir, filesUpdated, { skipCasting });
```
- **Lesson**: Migration frameworks must isolate modular state repairs. A corrupt or ambiguous historical record in one domain must not prevent operational upgrades or security patches in independent subsystems.

---

### Incident 4: Subcommand Argument Leaks Triggering Destructive Mutations During `--help` (BUG-SQUAD-04)
- **Context**: `packages/squad-cli/src/cli/core/command-help.ts`, Issue `#1201`
- **What Was Expected**: Executing `squad <command> --help` or `squad <command> -h` should only output command-specific documentation to stdout with exit code 0, without altering disk state or starting daemons.
- **What Actually Happened**: The CLI router only stripped `--help` when passed as the *first* argument (`squad --help`). When provided as a subcommand argument (e.g., `squad init --help`, `squad watch --help`), the router delegated control directly to the subcommand action handler. Subcommands that did not explicitly inspect arguments immediately executed their primary routines: `init` scaffolded files into the current working directory, and `watch` initiated an infinite polling loop.
- **Evidence in Repo**: PR resolving Issue `#1201`, `packages/squad-cli/src/cli/core/command-help.ts`.
- **Root Cause**: Naive positional argument checking in the root router that failed to prioritize universal terminal flags before dispatching commands.
- **Remediation Code Diff**:
```typescript
// packages/squad-cli/src/cli/core/command-help.ts
+/**
+ * Registry of per-command help printers. Intercepts `--help`/`-h` on subcommands
+ * before command action handlers can execute destructive side effects.
+ */
+export function printCommandHelp(cmd: string, version: string): boolean {
+  const printer = COMMAND_HELP[cmd];
+  if (!printer) return false;
+  printer(version);
+  return true;
+}

// packages/squad-cli/src/cli-entry.ts
+if (args.includes('--help') || args.includes('-h')) {
+  const cmd = args.find(a => !a.startsWith('-'));
+  if (cmd && printCommandHelp(cmd, getPackageVersion())) {
+    process.exit(0);
+  }
+}
```
- **Lesson**: Informational CLI flags (`--help`, `--version`) must be intercepted at the top-level lexer phase before handing off control to domain handlers.

---

### Incident 5: Upstream Brotli RCE Vulnerability in Vendored Bundles (BUG-SQUAD-05)
- **Context**: `.github/workflows/squad-standalone-release.yml`, `scripts/release/node-security-floor.json`, Commit `8d02663c`
- **What Was Expected**: Standalone CLI release bundles shipping vendored Node.js binaries must not distribute runtime versions subject to known remote code execution (RCE) vulnerabilities (e.g., Node.js Brotli memory corruption CVE-2026-111497).
- **What Actually Happened**: Standalone distribution bundles packaged whatever baseline Node.js version was pinned in build scripts (`22.20.0`). When critical security vulnerabilities were discovered in the upstream Node.js runtime, release pipelines lacked an automated verification floor to block publishing vulnerable bundles.
- **Evidence in Repo**: Commit `8d02663c`, `scripts/release/node-security-floor.mjs`, `scripts/release/policy-gates.mjs`.
- **Root Cause**: Decoupling release pipelines from a cryptographically anchored security gate that validates runtime binary versions against CVE advisory baselines.
- **Remediation Code Diff**:
```javascript
// scripts/release/node-security-floor.mjs
+export function assertNodeSecurityFloor(version, policy = loadNodeSecurityFloor()) {
+  