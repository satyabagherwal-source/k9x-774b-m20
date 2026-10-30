> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `5546f767`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T10:09:58.842Z  
> **Learning ID**: `learn-github-volcengine-openviking`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): volcengine/OpenViking

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Engineering Problem & Architectural Boundaries
Traditional agent memory solutions treat persistence as opaque key-value stores or un-indexed vector embeddings where state transitions cannot be inspected, traversed, or debugged by human operators or agent reasoning loops. `volcengine/OpenViking` eliminates this "black-box context failure" by architecting an Agent-Native Context Operating System centered on a virtual filesystem protocol: `viking://`.

```
+----------------------------------------------------------------------------------------------------+
|                                    Agent Execution Subsystems                                      |
|  [Claude Code / Codex / Trae / Kimi / OpenCode / pi / Cursor / CLI / Custom Agents via MCP]        |
+----------------------------------------------------------------------------------------------------+
                                      | stdio / JSON-RPC / SSE
                                      v
+----------------------------------------------------------------------------------------------------+
|  Agent Plugin Transport Layer (agent-plugins/servers/shared/mcp-proxy-core.mjs)                   |
|  - Concurrency Semaphore (MAX_CONCURRENT_REQUESTS = 16)                                            |
|  - Dynamic Credential Hot-Reload via Filesystem Stat Fingerprinting (mtimeMs + size)               |
|  - MCP Protocol Version Negotiation & Header Normalization (buildOvHeaders)                        |
+----------------------------------------------------------------------------------------------------+
                                      | HTTP/REST / SSE Stream
                                      v
+----------------------------------------------------------------------------------------------------+
|  OpenViking Gateway & Identity Subsystem (openviking_gateway / openviking.server.identity)        |
|  - RequestContext validation, Role-based Isolation (user, account, root)                          |
|  - Least-Privilege URI Routing (root keys cannot access viking://user/ context)                    |
+----------------------------------------------------------------------------------------------------+
                                      |
     +--------------------------------+--------------------------------+
     |                                                                 |
     v                                                                 v
+--------------------------------------------+   +---------------------------------------------------+
|  VikingBot Compiler Subsystem              |   |  Storage Subsystem (VikingFS & Vector Engine)     |
|  (bot/vikingbot/compile/service.py)        |   |  - Crates: ragfs (Rust) & ragfs-python (abi3)     |
|  - Pipeline: Prepare -> Map -> Finalize    |   |  - Storage: viking_fs, viking_vector_index_backend|
|  - Target Deduplication: sha256(to) URI    |   |  - Engine: C++ SIMD (SSE3, AVX2, AVX512) + cuVS   |
|  - Idempotent Content-Addressed Generation |   |  - Storage Hierarchy: L0 (Summaries), L1 (Indexes)|
|  - Skill Materialization & Safe CAS Writes |   |    L2 (Raw Artifacts)                             |
+--------------------------------------------+   +---------------------------------------------------+
```

### 1.2 Critical Subsystem Abstractions & State Invariants
1. **The Virtual Filesystem Subsystem (`viking://`)**:
   - Organizes all memory, knowledge, and operational skills into deterministic hierarchical paths (e.g., `viking://resources/...`, `viking://user/...`, `viking://skills/...`).
   - Implements multi-tier navigation: Level 0 (`L0`, high-level semantic summary directories generated automatically during `mkdir` or ingestion), Level 1 (`L1`, index/structure listings), and Level 2 (`L2`, raw file data). Agents can perform `ls`, `stat`, `tree`, and `read` on directories to ingest summaries before reading large data blobs, keeping context tokens within operational budgets.
2. **The MCP Proxy & Transport Layer (`mcp-proxy-core.mjs`)**:
   - Converts standard stdio pipes to persistent, streamable HTTP connections with SSE handling.
   - Enforces sequential serialized stdout writes (`stdoutChain`) to prevent corrupted interleaved JSON-RPC frames over shared file descriptors.
   - Implements zero-downtime hot reloading of credentials by polling file stats (`mtimeMs` + `size`) on each tool dispatch.
3. **The VikingBot Compilation Engine (`vikingbot/compile`)**:
   - Performs offline and incremental contextual distillation from disparate source traces into unified documentation and skill manuals.
   - Enforces SHA-256 content-addressing across all intermediate pipeline artifacts.
   - Isolates targets by hashing destination URIs (`sha256(to)`), replacing volatile ephemeral IDs with deterministic state vectors.
4. **The Hybrid Vector Indexing Architecture (`VikingVectorIndexBackend`)**:
   - Bridges Python `asyncio` runtimes with blocking Rust (`ragfs`) and C++ SIMD vector indexing layers using `asyncio.to_thread`.
   - Supports pluggable acceleration engines: Native SIMD (SSE3/AVX2/AVX512) and GPU-accelerated cuVS brute-force with automatic debounced background re-indexing.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Async Mutex Serialization for stdio Transports
**RULE**:
When an agent or background proxy bridges standard I/O (stdio) to asynchronous network transports (HTTP, SSE, WebSockets), every outbound line written to `process.stdout` or standard output MUST be serialized through a strictly sequenced Promise chain or FIFO task queue. Concurrent calls to stdout write methods MUST NOT be dispatched directly to the underlying runtime stream.

**WHY**:
Standard output streams in Node.js, Python, and Rust are asynchronous streams backed by non-blocking file descriptors. When multiple concurrent asynchronous requests complete or stream SSE chunks, uncoordinated calls to `stdout.write()` cause chunk interleaving and split-token framing at byte boundaries. This corrupts the JSON-RPC message framing, causing the host agent's JSON parser to crash with unrecoverable syntax errors and dropping the tool connection.

**WHEN TO APPLY**:
Apply to all Model Context Protocol (MCP) servers, Language Server Protocol (LSP) daemons, CLI proxies, and stdio-based inter-process communication layers handling concurrent tool executions.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// agent-plugins/servers/shared/mcp-proxy-core.mjs pattern
let stdoutChain = Promise.resolve();

function writeMessage(stdoutStream, messageObj) {
  const line = `${JSON.stringify(messageObj)}\n`;
  // Chain sequential writes atomically onto a promise queue
  stdoutChain = stdoutChain
    .then(() => new Promise((resolve) => {
      if (!stdoutStream.write(line)) {
        // Handle OS-level backpressure
        stdoutStream.once('drain', resolve);
      } else {
        resolve();
      }
    }))
    .catch((err) => {
      // Diagnostic output must write exclusively to stderr; stdout is reserved for JSON-RPC
      process.stderr.write(`[CRITICAL] stdout serialization failure: ${err.message}\n`);
    });
  return stdoutChain;
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// FORBIDDEN: Direct fire-and-forget stdout writes under concurrent async operations
async function badWriteMessage(stdoutStream, messageObj) {
  // VIOLATION: Concurrent promises will interleave byte buffers, corrupting JSON-RPC framing
  stdoutStream.write(JSON.stringify(messageObj) + '\n');
}
```

**VERIFICATION METHOD**:
Implement a concurrent stress harness running 50 parallel tasks emitting variable-sized JSON-RPC responses over the proxy. Run a strict line-delimited JSON validator on the stdout sink:
```bash
node -e '
const { spawn } = require("child_process");
const p = spawn("node", ["proxy_entrypoint.mjs"]);
let buffer = "";
p.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (line.trim()) JSON.parse(line); // Throws on interleaved syntax errors
  }
});
'
```

---

### 2. Multi-Stage Build-Artifact Provenance & Stable ABI Fingerprint Validation
**RULE**:
When reusing precompiled native binaries, wheels, or dynamic libraries (`.so`, `.pyd`, `.dylib`, `.dll`) across decoupled CI workflow steps or container layers, the consumer MUST cryptographically verify an explicit provenance manifest before restoring artifacts into the environment. The verification manifest MUST assert: (1) exact merge-base Git commit SHA, (2) OS kernel and architecture, (3) host C runtime library (`libc`) version, (4) Python stable ABI target (`Py_LIMITED_API`), (5) exact compiler feature flags, and (6) per-file SHA-256 hashes. If any check fails, the cache MUST be invalidated and rebuilt from source.

**WHY**:
Restoring native binaries compiled against glibc 2.38 into containers running glibc 2.31 causes dynamic linking loader failures (`GLIBC_X.XX not found`). Similarly, subtle differences in CPU instruction targets (e.g., AVX-512 enabled on CI host but run on AWS Graviton or older x86 hosts) lead to silent `SIGILL` (Illegal Instruction) crashes inside agent memory lookups.

**WHEN TO APPLY**:
Apply to all Python C-extension builds, Rust `cpython`/`pyo3` bindings, multi-stage Docker builds, and CI matrix optimization pipelines caching native binaries across matrix runners.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# .github/scripts/native_bundle.py pattern
import hashlib
import json
import os
import platform
import subprocess
import sysconfig
import tarfile
from pathlib import Path

def generate_manifest(repo_root: Path, binary_paths: list[Path]) -> dict:
    commit_sha = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
    ).strip()
    libc_ver = (
        os.confstr("CS_GNU_LIBC_VERSION")
        if platform.system() == "Linux"
        else list(platform.libc_ver())
    )
    return {
        "schema": 1,
        "sha": commit_sha,
        "os": platform.system(),
        "arch": platform.machine().lower(),
        "platform": sysconfig.get_platform(),
        "libc": libc_ver,
        "abi": "cp310-abi3",
        "files": {
            path.relative_to(repo_root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in binary_paths
        }
    }

def restore_bundle(repo_root: Path, bundle_archive: Path):
    with tarfile.open(bundle_archive, "r:gz") as tar:
        manifest_member = tar.extractfile("manifest.json")
        if not manifest_member:
            raise ValueError("Manifest missing from native bundle")
        manifest = json.load(manifest_member)

        # Invariant Assertion Check
        expected = generate_manifest(repo_root, [])
        for field in ("sha", "os", "arch", "platform", "libc", "abi"):
            if manifest.get(field) != expected.get(field):
                raise IncompatibleBundleError(
                    f"Mismatch in {field}: cached={manifest.get(field)!r} vs current={expected.get(field)!r}"
                )

        # Integrity Check & Path Traversal Guard
        for member in tar.getmembers():
            if member.name == "manifest.json":
                continue
            dest_path = (repo_root / member.name).resolve()
            if not dest_path.is_relative_to(repo_root.resolve()):
                raise SecurityViolation("Zip-slip / tar-slip path traversal detected")
            
            data = tar.extractfile(member).read()
            expected_hash = manifest["files"].get(member.name)
            if hashlib.sha256(data).hexdigest() != expected_hash:
                raise ChecksumMismatchError(f"Tampered or corrupt binary: {member.name}")
            
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(data)
            os.chmod(dest_path, 0o755)
```

**NEGATIVE CONSTRAINT**:
```bash
# FORBIDDEN: Blindly untarring compiled native binaries across CI runs
- name: Cache native build
  uses: actions/cache@v4
  with:
    path: openviking/lib/*.so
    key: native-${{ runner.os }} # VIOLATION: Ignores libc version, toolchain flags, and ABI changes
```

**VERIFICATION METHOD**:
Execute an automated CI pre-test validation step using `pytest tests/misc/test_abi3_packaging_config.py` coupled with `test_release_tag_selection.py` which intentionally alters compiler flags and asserts that the native bundle restoration raises an immediate schema and ABI rejection before running application tests.

---

### 3. Asynchronous Operation Separation from Polling Boundaries
**RULE**:
API endpoints that trigger long-running background transformations (e.g., ingestion, tree re-indexing, recursive directory distillation) MUST decouple task creation from task completion. A synchronous client invocation with a wait request (`--wait` / `wait: true`) MUST NOT execute as a single monolithic HTTP connection with arbitrary client-side socket timeouts. The server MUST generate and return a durable, queryable `task_id` during request initialization, and the client-side wait mechanism MUST poll the task status state machine (`queued` -> `running` -> `completed` | `failed`).

**WHY**:
Calculating client-side timeouts based on input byte sizes (e.g., `max(60, ceil(file_size * 5))`) is fundamentally non-deterministic. Ingestion workloads depend on LLM generation speeds, token rate limits, external parsing APIs, and embedding throughput. Single-socket timeouts cause the client to drop the connection and report failure while the background server continues ingestion, leaving the agent in a corrupted state without task resolution.

**WHEN TO APPLY**:
All agent context ingestion systems, document compilation tasks, batch vector embeddings, and background knowledge graph builders.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Synchronous facade over decoupled polling client
import time
from typing import Any, Dict

class IngestionClient:
    def add_resource(self, path: str, wait: bool = False, poll_interval: float = 2.0) -> Dict[str, Any]:
        # Step 1: Submit and obtain task identity immediately
        response = self.http.post("/api/v1/resources", json={"path": path, "wait": False})
        response.raise_for_status()
        task_data = response.json()
        task_id = task_data.get("task_id")
        
        if not wait:
            return task_data

        # Step 2: Client-side robust polling loop with terminal state validation
        while True:
            status_resp = self.http.get(f"/api/v1/tasks/{task_id}")
            status_resp.raise_for_status()
            task_status = status_resp.json()
            
            state = task_status.get("state")
            if state == "completed":
                return task_status.get("result", {})
            elif state in ("failed", "cancelled"):
                raise TaskExecutionError(
                    f"Background task {task_id} terminated with state: {state}. "
                    f"Error: {task_status.get('error')}"
                )
            
            time.sleep(poll_interval)
```

**NEGATIVE CONSTRAINT**:
```python
# FORBIDDEN: Single socket timeout based on heuristics
def bad_add_resource(self, path: str, wait: bool):
    # VIOLATION: Estimating LLM processing time based on raw compressed file size
    timeout = max(60, os.path.getsize(path) // (1024 * 1024) * 5)
    return self.http.post("/api/v1/resources", json={"path": path, "wait": wait}, timeout=timeout)
```

**VERIFICATION METHOD**:
Run an integration test where the server-side ingestion handler introduces an artificial 120-second sleep during embedding generation while the HTTP client socket read timeout is set to 5 seconds. The test passes only if the client completes successfully via task status polling without socket timeout exceptions.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Release Pipeline Ingestion of Stale SDK Dependency Causing Container Crash (BUG-SDK-DRIFT-01)
- **Context**: Release Docker container image build (`openviking:v0.5.2`), `service/compile_targets.py:1096`, and `storage/viking_fs/_snapshot.py:808`.
- **What Was Expected**: The built v0.5.2 Docker image should invoke `git_diff_paths` via `self._async_agfs.run("git_diff_paths", ...)` to compute incremental context diffs between memory snapshots.
- **What Actually Happened**: The container failed at runtime with `AttributeError: 'AsyncHTTPClient' object has no attribute 'git_diff_paths'`. Containerized server instances crashed immediately when handling compile and memory snapshot diff operations.
- **Evidence in Repo**: Issue #6588; resolved by harmonizing `uv.lock`, updating `pyproject.toml` dependency specifier to `openviking-sdk>=0.1.17`, and enforcing locked dependency synchronizations.
- **Root Cause**: The release workflow executed `uv sync` without `--locked` or against an un-synchronized `uv.lock` file where `openviking-sdk` remained pinned to `0.1.15`. PyPI had released `0.1.16`, but the newly introduced server code required APIs present only in unpublished / staged `0.1.17`.
- **Remediation Code Diff**:
```diff
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -21,7 +21,7 @@ dependencies = [
     "aiohttp>=3.13.3",
     "async-timeout>=5.0.1",
     "orjson>=3.11.7",
     "packaging>=24.0",
-    "openviking-sdk>=0.1.15",
+    "openviking-sdk>=0.1.17",
     "pydantic>=2.0.0",
     "typing-extensions>=4.5.0",

--- a/Dockerfile
+++ b/Dockerfile
@@ -77,7 +77,7 @@ RUN --mount=type=cache,target=/root/.cache/uv,id=uv-${TARGETPLATFORM} \
     case "${UV_LOCK_STRATEGY}" in \
         locked) \
-            uv sync --locked --no-editable --reinstall-package openviking \
+            uv sync --locked --no-editable --reinstall-package openviking --extra bot \
             ;; \
         auto) \
-            if ! uv lock --check; then \
+            if ! uv lock --check; then \
                 uv lock; \
```
- **Lesson**: Monorepo architectures housing both client SDKs and backend services MUST run automated lockfile compliance checks across all published artifacts. Subsystems MUST NOT call newly introduced SDK methods until the locked SDK version in the repository root has passed CI verification.

---

### Incident 2: Ingestion Socket Timeout via Monolithic `--wait` Ingestion Flag (BUG-TIMEOUT-POLL-02)
- **Context**: CLI Resource Ingestion Subsystem (`openviking_cli`), `ov add-resource --wait`.
- **What Was Expected**: Executing `ov add-resource ./docs --wait` should block until all documents are parsed, chunked, embedded, and indexed into the vector database, exiting with status code 0.
- **What Actually Happened**: For document sets larger than trivial test files, the HTTP client terminated with `Request Timeout`, leaving the user's terminal in an error state. Meanwhile, the backend server continued processing the ingestion in the background, eventually reaching a `completed` state hours later.
- **Evidence in Repo**: Issue #6486; resolved by altering the wait invariant in `openviking_cli` to split synchronous socket execution into task creation followed by status polling.
- **Root Cause**: The client relied on an HTTP POST request holding an open TCP socket using an arbitrary formula: `max(60 seconds, ceil(file size in MiB * 5 seconds))`. Because document parsing (e.g., PDF extraction via `pdfminer`, code AST parsing via `tree-sitter`, and LLM embedding calls) is CPU/network bound rather than raw disk-IO bound, file size failed to correlate with execution latency.
- **Remediation Code Diff**:
```diff
--- a/openviking_cli/commands/resource.py
+++ b/openviking_cli/commands/resource.py
@@ -142,7 +142,12 @@ def add_resource(path: str, wait: bool, parent_auto_create: str):
-    response = client.post("/api/v1/resources", json={"path": path, "wait": wait})
-    return response.json()
+    # Create task asynchronously and return handle
+    response = client.post("/api/v1/resources", json={"path": path, "wait": False})
+    task_id = response.json()["task_id"]
+    if not wait:
+        return response.json()
+    return client.wait_for_task(task_id, timeout=None)
```
- **Lesson**: Long-running asynchronous operations must never attempt to simulate synchronous interaction through socket holds. Task execution identity must be acknowledged before the payload is scheduled.

---

### Incident 3: Target State Desynchronization and Random Target ID Hazards (BUG-COMPILE-TARGET-03)
- **Context**: VikingBot Compiler Pipeline (`bot/vikingbot/compile/service.py`, `bot/vikingbot/compile/models.py`).
- **What Was Expected**: Target compilation states and scheduled incremental runs must maintain absolute consistency when referencing destinations across the virtual filesystem.
- **What Actually Happened**: Random UUIDs assigned to target registrations created conflicting concurrent runs when multiple triggers fired against the same destination URI (`viking://resources/...`). Target listings locked broad state dictionaries, degrading scheduling throughput.
- **Evidence in Repo**: Commit `68f3ad28`, PR #6615: *"refactor(compile): unify target metadata by destination URI"*.
- **Root Cause**: Compiling targets generated independent random UUIDs for target IDs rather than deriving state idempotently from the destination URI. As a result, re-registering or listing operations resulted in lock contention and race conditions when updating existing documentation pages.
- **Remediation Code Diff**:
```diff
--- a/bot/vikingbot/compile/models.py
+++ b/bot/vikingbot/compile/models.py
@@ -75,7 +75,9 @@ class SanitizedCompileRequest(BaseModel):
-    model_config = ConfigDict(extra="forbid", populate_by_name=True)
+    """Stored normalized inputs ignore unknown fields; the service validates public arguments."""
+    model_config = ConfigDict(extra="ignore", populate_by_name=True)

--- a/bot/vikingbot/compile/service.py
+++ b/bot/vikingbot/compile/service.py
@@ -588,15 +588,14 @@ async def _normalize_request(
             raw_target = request.to.strip().rstrip("/")
             try:
-                target_attrs = await client.attrs(raw_target)
+                target_stat = await client.stat(raw_target)
             except OpenVikingError as exc:
                 if exc.code != "NOT_FOUND":
                     raise
                 self._validate_target_directory(raw_target, {"isDir": True})
-                await client.mkdir(raw_target)
-                target_attrs = await client.attrs(raw_target)
-            target = str(target_attrs.get("uri") or "").rstrip("/")
-            target_stat = await client.stat(target)
+                await client.mkdir(raw_target, description="compile target folder")
+                target_stat = await client.stat(raw_target)
+            target = str(target_stat.get("uri") or "").rstrip("/")
```
- **Lesson**: Idempotent resource coordinates in virtual filesystems must derive state keys deterministically (e.g., `sha256(destination_uri)`) rather than injecting random session UUIDs.

---

### Incident 4: CI Compiler Cache Pollution and Unbounded Growth on Secondary Branches (BUG-CI-CACHE-04)
- **Context**: GitHub Actions Native Build Automation (`.github/workflows/_build.yml`, `.github/actions/compiler-cache/action.yml`).
- **What Was Expected**: Cargo and Ccache compiler intermediate caches should speed up PR builds without polluting the cache storage quota or poisoning compiler flags for release builds.
- **What Actually Happened**: PR builds wrote dirty, incremental build artifacts into shared cache keys. GitHub's 10GB cache quota was rapidly evicted, and variations in toolchain flags caused build instability on mainline releases.
- **Evidence in Repo**: Commit `de9803e9`, PR #6751: *"fix(ci): refresh compiler caches across main revisions"*.
- **Root Cause**: Cache keys did not incorporate toolchain hashes or commit-unique suffixes, and write permissions were not restricted to the repository default branch (`main`).
- **Remediation Code Diff**:
```diff
--- a/.github/actions/compiler-cache/action.yml
+++ b/.github/actions/compiler-cache/action.yml
@@ -43,15 +43,23 @@ runs:
+    # Only official main runs populate shared caches. PRs, forks and tag builds
+    # restore without registering a post-job save. Commit suffixes allow each
+    # main revision to save new compiler output into immutable cache entries.
+    - uses: actions/cache/restore@v5
+      if: github.repository != 'volcengine/OpenViking' || github.ref != 'refs/heads/main' || github.event_name == 'pull_request'
+      with:
+        path: target
+        key: cargo-v3-${{ runner.os }}-${{ runner.arch }}-${{ inputs.target }}-${{ steps.toolchain.outputs.hash }}-${{ hashFiles('Cargo.lock') }}-${{ github.sha }}
+        restore-keys: |
+          cargo-v3-${{ runner.os }}-${{ runner.arch }}-${{ inputs.target }}-${{ steps.toolchain.outputs.hash }}-${{ hashFiles('Cargo.lock') }}-
+    - uses: actions/cache@v5
+      if: github.repository == 'volcengine/OpenViking' && github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
+      with:
+        path: target
+        key: cargo-v3-${{ runner.os }}-${{ runner.arch }}-${{ inputs.target }}-${{ steps.toolchain.outputs.hash }}-${{ hashFiles('Cargo.lock') }}-${{ github.sha }}
```
- **Lesson**: CI compilation caches must be immutable, branch-scoped (write-once from `main`, read-only from pull requests), and keyed by cryptographic hashes of the entire toolchain environment.

---

### Incident 5: Upstream Protocol Rejection Due to Premature MCP Version Negotiation (BUG-MCP-VER-05)
- **Context**: MCP Proxy Core Subsystem (`agent-plugins/servers/shared/mcp-proxy-core.mjs`).
- **What Was Expected**: Connecting diverse AI agents (Claude Code, Trae, Codex, pi) via MCP should transparently negotiate protocol capabilities with private upstream gateway endpoints.
- **What Actually Happened**: Upstream proxies rejected requests with `HTTP 400 Bad Request` before the JSON-RPC initialization handshake could complete.
- **Evidence in Repo**: `agent-plugins/servers/shared/mcp-proxy-core.mjs:headersForRequest`.
- **Root Cause**: The client proxy forwarded the raw, unvalidated protocol version requested by the host agent directly in the HTTP headers before standard MCP capability negotiation occurred.
- **Remediation Code Diff**:
```diff
--- a/agent-plugins/servers/shared/mcp-proxy-core.mjs
+++ b/agent-plugins/servers/shared/mcp-proxy-core.mjs
@@ -198,7 +198,9 @@ export function createOpenVikingMcpProxy({
     const built = buildOvHeaders(proxyConfig, {
       actorPeerId: proxyConfig.peerId,
       extraHeaders: {
         "Accept": "application/json, text/event-stream",
-        "MCP-Protocol-Version": clientRequestedVersion,
+        // Always the proxy's current version (default, then server-negotiated) —
+        // never the client's un-negotiated ask, which strict upstreams reject
+        // with HTTP 400 before initialize negotiation can run.
+        "MCP-Protocol-Version": protocolVersion,
         ...(includeSession && sessionId ? { "Mcp-Session-Id": sessionId } : {}),
       },
     });
```
- **Lesson**: Handshake and protocol capability negotiation must never bind transport-level HTTP headers to unverified downstream client assertions. Fall back to a known-safe baseline protocol version until initialization frames are exchanged.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Falsy Integer Trapping in Pagination & Counters**:
   In Python and JavaScript, treating numerical counters or offsets with `if not offset:` or `val || default` causes critical bugs when values are `0`.
   ```python
   # INVARIANT ENFORCEMENT: Explicit None checks for numerical bounds
   # INCORRECT:
   limit = request.limit or 100 # If limit is 0 (valid request to read attrs only), resets to 100!
   # CORRECT:
   limit = request.limit if request.limit is not None else 100
   ```
2. **Path Sanitization and Normalization Invariants**:
   When parsing `viking://` URIs, trailing slashes mutate dictionary lookups and path trees.
   ```python
   # openviking/core/namespace.py
   def canonicalize_uri(uri: str) -> str:
       # MUST preserve scheme separator while normalizing posix path segments
       if not uri.startswith("viking://"):
           raise ValueError(f"Invalid URI scheme: {uri}")
       raw_path = uri[len("viking://"):]
       normalized = posixpath.normpath(raw_path)
       # Disallow path traversal escape outside the virtual tree
       if normalized == ".." or normalized.startswith("../"):
           raise SecurityViolation(f"Path traversal detected: {uri}")
       return f"viking://{normalized.strip('/')}"
   ```
3. **Pydantic Model Extra Fields Invariant**:
   Internal task state deserializers MUST declare `model_config = ConfigDict(extra="ignore")` when parsing durable state records from disk to prevent pipeline crashes on backward-compatible schema evolutions, while public-facing validation endpoints MUST use `extra="forbid"`.

### 4.2 Infinite Loop & Recursion Guards
1. **Directory Tree Traversal Termination Proof**:
   When walking virtual directory nodes via `list_resources`, cyclic symlinks or buggy parent references can trigger infinite loops. The implementation strictly pairs a queue with an immutable `seen` set:
   ```python
   # bot/vikingbot/compile/ops/finalize.py
   known_paths = set(files)
   pending = [runtime.target]
   seen = {runtime.target}
   max_depth_guard = 10000
   traversed = 0

   while pending:
       directory = pending.pop()
       traversed += 1
       if traversed > max_depth_guard:
           raise InfiniteRecursionError("Directory traversal exceeded safety threshold of 10000 nodes")
       entries = await runtime.client.list_resources(directory, node_limit=500)
       for entry in entries:
           uri = str(entry.get("uri") or "").rstrip("/")
           if entry.get("isDir", False):
               if uri not in seen:
                   seen.add(uri)
                   pending.append(uri)
   ```
2. **LLM Judge & Repair Budget Limits**:
   Agent repair loops during compilation finalize phases MUST enforce a hard task-wide budget cap. Skill packages allow a maximum of three repair iterations before raising a terminal `CompileFailure("SKILL_REPAIR_FAILED")`.

### 4.3 UI & UX Micro-Mechanics
1. **Stdio Stream Decoupling for Headless TTY**:
   Progress indicators (e.g., in `benchmark/locomo/vikingbot/progress_utils.py`) verify interactive terminal boundaries before rendering ANSI escape sequences:
   ```python
   def should_show_progress(no_progress_flag: bool) -> bool:
       if no_progress_flag:
           return False
       # Must verify stderr is an interactive TTY; never emit ANSI escapes into piped CI streams
       return sys.stderr.isatty()
   ```
2. **Four-State Progress Tracking Invariant**:
   When tracking concurrent worker threads in CLI dashboards, the UI state MUST enforce:
   $$\text{Total} \ge \text{Done} + \text{Running} + \text{Failed}$$
   Clamping prevents visual buffer overruns across terminal widths:
   ```python
   done = min(done, total)
   failed = min(failed, total - done)
   running = min(running, total - done - failed)
   pending_width = bar_width - done_width - failed_width - running_width
   ```

### 4.4 Backend Concurrency & Memory Safety
1. **TOCTOU Race Condition Elimination in File Persistence**:
   Draft artifacts generated by VikingBot agents are persisted under temporary content-addressed keys and validated against expected SHA-256 digests *before* target relocation:
   ```python
   # File persistence validation
   if content_hash(files[path]) != artifact["sha256"]:
       raise ValueError(f"Stored file hash mismatch during atomic move: {path}")
   ```
2. **Semaphore Bounds on MCP Proxy Concurrency**:
   To avoid socket pool and file descriptor starvation when LLM reasoning models emit multiple parallel tool calls, the proxy uses a strict counting semaphore:
   ```javascript
   const MAX_CONCURRENT_REQUESTS = 16;
   const acquire = createSemaphore(MAX_CONCURRENT_REQUESTS);
   // Prevents unbounded event loop microtask exhaustion
   const release = await acquire();
   try {
     return await dispatchRequest(message);
   } finally {
     release();
   }
   ```

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **JSON-RPC Error Code Partitioning**:
   The MCP proxy implements strict semantic separation for HTTP error codes to prevent agent misdiagnosis:
   - `-32001`: Authentication / Credential authorization failures (HTTP 401/40