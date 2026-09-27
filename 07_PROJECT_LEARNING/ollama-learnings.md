# Project Learning Record — Ollama (Full-Spectrum Harvest)

This document records the empirical project learnings, forensic defect investigations, and architectural invariant extractions derived from the **Ollama** repository (`c:\Users\Admin\Desktop\Learning extracted done\ollama\ollama` — High-performance, production-grade local LLM runner and model serving architecture, coordinating out-of-process C++ inference backends (`llama-server`), native Apple Silicon MLX engines (`mlxrunner`), multi-GPU hardware discovery across CUDA/ROCm/Vulkan/Metal, continuous batching, speculative decoding, prefix caching trie state machines, structured output grammar generation, and OCI model distribution).

---

## 1. Executive Summary & Verification Coverage

* **Project**: `ollama/ollama` (Production LLM Inference Runtime, Orchestrator, Hardware Discovery, and Distribution Platform)
* **Harvest Scope**: Full-Spectrum Multi-Dimensional Harvest across all 8 Dimensions (D1–D8).
* **Total Confirmed Real Incidents Analyzed**: 16 Production Defect Fixes & Architectural Invariants.
* **Promoted Reusable Engineering Patterns**:
  * **Rule 59**: Subprocess Teardown & Reap Barrier prior to Shared Resource Re-Allocation
  * **Rule 60**: Overlap-Scan Across All Subsequent Writes Following Monotonic Buffer Rewind (Anti-Lazy Snapshot Corruption)
  * **Rule 61**: Non-Blocking TryLock with Volatile Attribute Omission for Diagnostic Introspection / Structured Logging
  * **Rule 62**: Upstream Context Cancellation and Pipeline Draining on Mid-Stream Callback Parsing Failure
  * **Rule 63**: Boundary-Crossing Integer Division over Exact Modulo in Multi-Token / Variable-Stride Batch Pipelines
  * **Rule 64**: Non-Colliding Monotonic Security Flag Accumulation across Shared Multi-Part Deserialization (Anti-SSRF Verification Bypass)
  * **Rule 65**: Associative Name-Based Hardware Matching over Positional Index Mapping across Heterogeneous Driver Layers
  * **Rule 66**: Same-Host Redirection Containment with Sibling CDN Allowlisting in Distributed Asset Fetchers
  * **Rule 67**: Hierarchical Prefix Canonicalization over Disjoint Field Matching in Multi-Part Composite Identifiers
  * **Rule 68**: Single-Pass Delayed-Grammar Activation on Thinking & Reasoning Model Generations
* **Brain Refinements Codified**:
  * **Rule 2 Refinement**: Subprocess Lifecycles & Termination Barriers: When an external process is terminated, callers must not return or initiate successor allocations until process death and resource unmapping are fully reaped.
  * **Rule 5 Refinement**: Double-Counting Prevention on Mmap-Backed Spans: When reporting memory allocations of memory-mapped files spanning multi-layer models, the overlap between mapped file spans and device buffers must be trimmed to avoid double-counting.
  * **Rule 7 Refinement**: Scope-Based Array Lifetime Management: Replacing global unpinned sweeping with lexical/function scope lifetime objects (`Scoped`, `ScopedEval`) for accelerator memory.
* **Domain-Specific Patterns Retained in Learning Record**:
  * Metal GPU Command Buffer Timeout during Heavy Cold-Storage Tensor Materialization
  * Active-Path Intermediate Turn Checkpoint Eviction under Fixed Prefix Cache Budgets
  * Resumed Prefill Snapshot Preservation and Whole Child Node Extension across Client Timeouts
  * Synchronous Background Goroutine Draining before Returning to Callers Mutating Globals
  * Multi-Modal Media Identity Hashing inside Prefix Cache Trie Keys
* **Excluded / Discarded Candidates**:
  * Documentation typo corrections and link fixes
  * Third-party vendor version bumps without architectural impact
  * Cosmetic CLI command spacing adjustments

---

## 2. Forensic Incident & Learning Records

### Incident 1: Subprocess Teardown Racing Successor Model Load Permitting Resource Over-Allocation & OOM (`BUG-OLLAMA-01`)
* **Context**: Subprocess lifecycle management in `mlxrunner/client.go`.
* **What Was Expected**: Calling `Close()` terminates the model runner subprocess and frees its VRAM before the scheduler starts loading the next model.
* **What Actually Happened**: The MLX client sent `SIGINT`, waited up to 5 seconds, sent `SIGKILL`, and returned immediately without waiting for process exit (`waitpid` / reap). Because the runner process had no custom signal handler, `SIGINT` was already fatal, but process termination and kernel resource unmapping take finite time. Returning early meant the scheduler immediately launched the next model while the previous runner was still exiting with its memory mapped in the OS kernel! This caused subsequent loads to fail with Out-Of-Memory (OOM) errors or collide on listening ports. Furthermore, `Load()` started and recorded the process without acquiring the client's mutex, allowing a `Close()` call racing with server shutdown to miss the process and leave an orphaned daemon running indefinitely!
* **Evidence in Repo**:
  * Commit: `f09d55d0` — `mlxrunner: wait for a killed runner to exit before the scheduler loads the next model`
  * Source: `mlxrunner/client.go#L140-L154`, `mlxrunner/client.go#L430-L445`
* **Root Cause**: Premature return from process termination routines without awaiting the process reap barrier (`<-c.done`), combined with un-synchronized process initialization.
* **Remediation**: Force `Close()` to kill and synchronously await process death via `<-c.done`, and serialize `Load()` under the mutex while checking a permanent `closed` boolean flag:
  ```go
  func (c *Client) Close() error {
      c.mu.Lock()
      defer c.mu.Unlock()

      c.closed = true
      if c.cmd != nil && c.cmd.Process != nil {
          slog.Info("stopping mlx runner subprocess", "pid", c.cmd.Process.Pid)
          c.cmd.Process.Kill()
          <-c.done // Synchronously await process termination and reap
          c.cmd = nil
      }
      return nil
  }
  ```
* **Lesson**: *Subprocess Teardown & Reap Barrier prior to Shared Resource Re-Allocation*. When terminating an external daemon or subprocess managing bounded hardware resources, the lifecycle manager MUST NOT return until the process has completely exited and been reaped by the operating system kernel.
* **Promotion Decision**: Promoted as **Rule 59** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 2: In-Place Buffer Rewind Refill Corrupting Deferred Lazy Snapshots (`BUG-OLLAMA-02`)
* **Context**: Key-Value (KV) cache snapshot management in `mlxrunner/cache/kvcache.go`.
* **What Was Expected**: Lazy zero-copy snapshots pointing into the live KV buffer can be safely restored when branching conversations rewind to earlier prompt prefixes.
* **What Actually Happened**: A lazy snapshot indexes into the cache's live buffer instead of owning an expensive private copy; it must be copied out before an append overwrites its memory range. `appendKV` checked for overlapping lazy snapshots only on the *first* append after a rewind, clearing the `rewound` flag immediately (`c.rewound = false`). However, if a request reused a short prefix and prefills multiple chunks past the rewind point, subsequent appends advanced further along the buffer. Any still-lazy snapshot located ahead of the first chunk was overwritten without being copied out! Restoring that snapshot later silently returned foreign data from the subsequent request instead of the original conversation's KV state!
* **Evidence in Repo**:
  * Commit: `14489385` — `mlxrunner: stop cache rewind refills from corrupting later lazy snapshots`
  * Source: `mlxrunner/cache/kvcache.go#L50-L66`
  * Test: `mlxrunner/cache/lazy_test.go`
* **Root Cause**: Gating safety range-overlap checks behind an ephemeral single-turn flag (`rewound = false`) rather than continuously scanning write ranges against live lazy snapshots.
* **Remediation**: Remove the `rewound` boolean flag entirely; scan every write range against all active lazy snapshots:
  ```go
  // Copy out any still-lazy snapshot whose slots it would overwrite —
  // only appends refilling after a rewind find any, since ordinary appends stay above every snapshot.
  for _, s := range slices.Clone(c.lazySnapshots) {
      if s.fromOffset < prev+L && s.toOffset > prev {
          s.copyOut()
      }
  }
  ```
* **Lesson**: *Overlap-Scan Across All Subsequent Writes Following Monotonic Buffer Rewind (Anti-Lazy Snapshot Corruption)*. When a write pointer rewinds in a buffer with deferred lazy snapshots, all subsequent writes advancing toward higher offsets MUST check and copy out overlapping views until the pointer passes all existing snapshot boundaries.
* **Promotion Decision**: Promoted as **Rule 60** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 3: Structured Logging Deadlock & Data Race in Diagnostic Introspection (`BUG-OLLAMA-03`)
* **Context**: Scheduler runner status introspection in `server/sched.go` and progress rendering in `progress/progress.go`.
* **What Was Expected**: Emitting structured logs with `slog.Value` safely formats runner state without blocking scheduler execution.
* **What Actually Happened**: `runnerRef.LogValue()` was called by `slog` from background goroutines as well as goroutines that already held `refMu` (e.g. inside scheduler debug logs). If `LogValue` acquired `refMu.Lock()`, it caused recursive self-deadlocks on the holding goroutine! If it omitted locking entirely, concurrent mutations during runner unloading created fatal data races on `runner.gpus` and `runner.pid`.
* **Evidence in Repo**:
  * Commit: `b5d373f3` (PR [#18319](https://github.com/ollama/ollama/pull/18319)) — `fix data races in progress and sched`
  * Source: `server/sched.go#L1510-L1544`
* **Root Cause**: Using blocking locks or unprotected reads inside dynamic logging/formatting hooks that can be invoked recursively from arbitrary execution contexts.
* **Remediation**: Use non-blocking `refMu.TryLock()`; clone mutable slices when the lock is acquired, and cleanly omit volatile fields when the lock is contended:
  ```go
  func (runner *runnerRef) LogValue() slog.Value {
      if runner == nil {
          return slog.StringValue("nil")
      }
      attrs := []slog.Attr{}
      if runner.refMu.TryLock() {
          if runner.model != nil {
              attrs = append(attrs, slog.String("name", runner.model.Name))
          }
          if len(runner.gpus) > 0 {
              attrs = append(attrs, slog.Any("inference", slices.Clone(runner.gpus)))
          }
          attrs = append(attrs, slog.Int("pid", runner.pid))
          runner.refMu.Unlock()
      }
      // Non-volatile fields appended unconditionally
      return slog.GroupValue(attrs...)
  }
  ```
* **Lesson**: *Non-Blocking TryLock with Volatile Attribute Omission for Diagnostic Introspection / Structured Logging*. Introspection and structured logging methods must never acquire blocking locks on structures that may be held by callers. Use non-blocking `TryLock()` with field omission when contended.
* **Promotion Decision**: Promoted as **Rule 61** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 4: Mid-Stream Streaming Parser Failure Wedging Runner and Goroutines (`BUG-OLLAMA-04`)
* **Context**: Server streaming request handling in `server/routes.go`.
* **What Was Expected**: A tool-call or thinking parser syntax error mid-stream cleanly aborts the HTTP request and frees the backend runner.
* **What Actually Happened**: When a parser encountered malformed syntax on a mid-stream token chunk, the completion callback sent that error to an unbuffered Go channel and returned. However, the callback lacked an error return mechanism to stop the runner's generation loop! The runner emitted the next chunk, re-entered the callback, encountered the same error, and attempted to write again to the unbuffered channel. But the consumer HTTP handler had already exited after emitting an HTTP 500! The second channel send blocked forever, leaking the goroutine and stranding the runner request, causing all subsequent prompts to hang indefinitely.
* **Evidence in Repo**:
  * Commit: `e0c95a5f` (PR [#17883](https://github.com/ollama/ollama/pull/17883)) — `server: don't wedge chat and generate on a mid-stream parser error`
  * Source: `server/routes.go#L650-L745`, `server/routes_parse_error_test.go`
* **Root Cause**: Exiting consumer routines on unrecoverable errors without canceling the upstream context and draining in-flight callbacks.
* **Remediation**: Bind generation to a cancelable context (`context.WithCancel`); when a parser error occurs, record the error, cancel the context to stop generation, and report the error only after the completion call returns:
  ```go
  ctx, cancel := context.WithCancel(c.Request.Context())
  defer cancel()
  var parserErr error

  err := r.Completion(ctx, req, func(r llm.CompletionResponse) {
      content, thinking, toolCalls, err := builtinParser.Add(r.Content, r.Done)
      if err != nil {
          parserErr = err
          cancel() // Upstream context canceled; stops generation
          return
      }
      ch <- res
  })
  if parserErr != nil {
      ch <- gin.H{"error": parserErr.Error()}
  }
  ```
* **Lesson**: *Upstream Context Cancellation and Pipeline Draining on Mid-Stream Callback Parsing Failure*. In callback-driven streaming generators, unrecoverable chunk processing errors must cancel the upstream context and drain the pipeline before reporting errors, avoiding blocked channel writes and permanent goroutine leaks.
* **Promotion Decision**: Promoted as **Rule 62** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 5: Speculative Decoding Skipping Buffer Sweeps via Exact-Modulo Polling (`BUG-OLLAMA-05`)
* **Context**: Native MLX execution pipeline in `mlxrunner/pipeline.go`.
* **What Was Expected**: The decode loop invokes `mlx.ClearCache()` every 256 tokens to release MLX's internal allocator buffer pool and prevent memory growth.
* **What Actually Happened**: The maintenance check evaluated exact modulo equality: `if generated % clearCacheInterval == 0`. In single-token autoregressive decoding, token counts advance by $+1$, hitting every boundary. But in speculative decoding, each round verifies a draft candidate chain and emits multiple tokens at once (e.g. $+3, +5$). Almost every speculative round stepped clean over the multiple of 256! As a result, `mlx.ClearCache()` was never called. Over long contexts ($98k$ tokens), the caching allocator accumulated tens of gigabytes of dropped KV buffers, ballooning process resident memory from 30 GB to 90 GB and crashing the OS kernel!
* **Evidence in Repo**:
  * Commit: `ec3cc230` — `mlxrunner: Release freed KV buffers during speculative decode`
  * Source: `mlxrunner/pipeline.go#L278-L352`
* **Root Cause**: Testing exact modulo equality (`x % N == 0`) in batched or variable-stride loops where step size $\Delta > 1$.
* **Remediation**: Test integer division epoch crossing (`generated / interval != before / interval`):
  ```go
  before := generated
  // ... speculative round emits variable number of tokens ...
  generated += len(results)

  // Fires whenever the step crossed any multiple of clearCacheInterval
  if generated/clearCacheInterval != before/clearCacheInterval {
      mlx.ClearCache()
  }
  ```
* **Lesson**: *Boundary-Crossing Integer Division over Exact Modulo in Multi-Token / Variable-Stride Batch Pipelines*. When polling maintenance intervals in loops with variable progress strides ($\Delta \ge 1$), never use exact modulo. Always evaluate integer division boundary transitions.
* **Promotion Decision**: Promoted as **Rule 63** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 6: Manifest Digest Collision Bypassing Verification and Permitting SSRF (`BUG-OLLAMA-06`)
* **Context**: OCI model pull and layer validation in `server/images.go`.
* **What Was Expected**: Every downloaded model layer is cryptographically verified against its expected SHA-256 digest before being stored on disk.
* **What Actually Happened**: When an image manifest contained a configuration object and a model layer sharing the exact same digest, the `skipVerify[digest]` map was overwritten by the config's cache-hit value (`true`), replacing the layer's non-cache-hit value (`false`). This bypassed `verifyBlob` for the freshly downloaded blob. A rogue registry could serve a manifest with duplicate digests and redirect blob downloads via HTTP 302 to an internal endpoint (e.g. cloud metadata `169.254.169.254`). The SSRF response was written to disk, verification was skipped, and the unverified blob was permanently stored as a valid model layer!
* **Evidence in Repo**:
  * Commit: `4138e853` (PR [#15504](https://github.com/ollama/ollama/pull/15504)) — `server/images: prevent skipVerify map collision with duplicate digests`
  * Source: `server/images.go#L1064-L1075`, `server/images_test.go#L800-L850`
* **Root Cause**: Overwriting security verification state maps unconditionally during multi-component manifest processing.
* **Remediation**: Accumulate verification flags using logical AND: once any download of a digest requires verification, verification is mandatory:
  ```go
  if existing, ok := skipVerify[layer.Digest]; !ok {
      skipVerify[layer.Digest] = cacheHit
  } else {
      skipVerify[layer.Digest] = existing && cacheHit
  }
  ```
* **Lesson**: *Non-Colliding Monotonic Security Flag Accumulation across Shared Multi-Part Deserialization (Anti-SSRF Verification Bypass)*. Security verification flags must accumulate monotonically via logical conjunction across shared identifier collisions. A cache hit on metadata must never bypass cryptographic verification of payload layers.
* **Promotion Decision**: Promoted as **Rule 64** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 7: Inverted Vulkan iGPU/dGPU Classification on Hybrid Graphics Systems (`BUG-OLLAMA-07`)
* **Context**: Hardware accelerator discovery in `discover/vulkan.go`.
* **What Was Expected**: Accurate classification of integrated vs. discrete graphics adapters on hybrid laptops (e.g. Intel/AMD CPU + NVIDIA GPU).
* **What Actually Happened**: Device classification refined `llama-server` device lists by cross-referencing native Vulkan probe enumerations. The refinement assumed that `llama-server` and the native probe enumerate devices in identical index order with identical device counts. However, on Windows hybrid laptops, `llama-server` enumerated `[Intel iGPU, NVIDIA dGPU]` while the native probe enumerated `[NVIDIA dGPU, Intel iGPU]`! Positional index mapping inverted the classification: the Intel iGPU was tagged as discrete and the NVIDIA RTX 4080 as integrated! Models attempted to offload heavy layers onto the underpowered iGPU, crashing inference.
* **Evidence in Repo**:
  * Commit: `fc585444` (PR [#16669](https://github.com/ollama/ollama/pull/16669)) — `discover: fix inverted iGPU/dGPU Vulkan classification on Windows hybrid graphics`
  * Source: `discover/vulkan.go#L95-L140`, `discover/llama_server_test.go#L410-L440`
* **Root Cause**: Correlating hardware capabilities across distinct driver abstractions using array indices instead of associative descriptor matching.
* **Remediation**: Eliminate positional index assumptions; match devices associatively by normalized hardware description and name, verify uniqueness, and skip refinement if ambiguous:
  ```go
  for i, deviceIndex := range vulkanIndexes {
      description := devices[deviceIndex].Description
      for j, probedDevice := range probed {
          if used[j] || !sameVulkanDeviceName(description, probedDevice.Name) {
              continue
          }
          matches[i] = j
          used[j] = true
          break
      }
  }
  ```
* **Lesson**: *Associative Name-Based Hardware Matching over Positional Index Mapping across Heterogeneous Driver Layers*. Hardware discovery correlation between distinct runtime libraries must never rely on enumeration index order. Correlation must use associative, normalized identifier matching.
* **Promotion Decision**: Promoted as **Rule 65** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 8: Unrestricted Registry Redirection Permitting SSRF against Intranet / Metadata Endpoints (`BUG-OLLAMA-08`)
* **Context**: Model registry network client in `server/images.go`.
* **What Was Expected**: Model pull requests follow HTTP redirects to download layers hosted on external CDNs.
* **What Actually Happened**: `http.Client` followed arbitrary HTTP redirects by default. A malicious or compromised model registry could respond to a manifest or blob request with a redirect to `http://169.254.169.254/latest/meta-data/` or internal database servers (`http://10.0.0.5/`), turning the Ollama daemon into an SSRF proxy to exfiltrate cloud credentials and internal infrastructure data.
* **Evidence in Repo**:
  * Commits: `6383a0fa` (PR [#18533](https://github.com/ollama/ollama/pull/18533)) & `dfabde45` (PR [#18512](https://github.com/ollama/ollama/pull/18512))
  * Source: `server/images.go#L1425-L1450`, `server/images_test.go#L920-L980`
* **Root Cause**: Permitting cross-host HTTP redirects without domain boundary containment.
* **Remediation**: Enforce strict same-host redirection by default; permit cross-host redirects only when both source and target match an explicit, allowlisted CDN domain list:
  ```go
  checkRedirect = func(req *http.Request, via []*http.Request) error {
      if len(via) > 10 {
          return errMaxRedirectsExceeded
      }
      if insecure || req.URL.Host == via[0].URL.Host {
          return nil
      }
      if isAllowedHost(via[0].URL.Hostname()) && isAllowedHost(req.URL.Hostname()) {
          return nil
      }
      return errBlockedRedirect
  }
  ```
* **Lesson**: *Same-Host Redirection Containment with Sibling CDN Allowlisting in Distributed Asset Fetchers*. Remote asset fetchers must restrict HTTP redirection to the origin host by default, permitting cross-host redirects only among verified, allowlisted CDN siblings.
* **Promotion Decision**: Promoted as **Rule 66** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 9: Randomized Map Traversal Corrupting Composite Model Identifiers (`BUG-OLLAMA-09`)
* **Context**: Model naming and manifest resolution in `server/routes.go`.
* **What Was Expected**: Case-insensitive model lookups canonicalize requested model names against existing on-disk manifests deterministically.
* **What Actually Happened**: `getExistingName` matched each component of a 4-part composite identifier (`Host`, `Namespace`, `Model`, `Tag`) independently across existing manifests. A tracking variable intended to prevent re-writes was never updated. When thousands of models were installed, if an unrelated manifest had a matching tag (e.g. `OtherOrg/OtherModel:Q8`), its tag casing overwrote the requested model's tag (`MyOrg/MyModel:q4`). Because Go map iteration is randomized, the last matching manifest won, causing intermittent, non-reproducible "model not found" errors that succeeded on retry!
* **Evidence in Repo**:
  * Commit: `6ae5088c` (PR [#18438](https://github.com/ollama/ollama/pull/18438)) — `server: fix getExistingName canonicalizing model name parts independently`
  * Source: `server/routes.go#L1255-L1305`
* **Root Cause**: Disjoint independent component matching across randomized collection iterations.
* **Remediation**: Two-pass hierarchical matching: first check for an exact 4-part case-insensitive match; second, find the single manifest with the longest contiguous hierarchical prefix match (Host $\to$ Namespace $\to$ Model), leaving the tag untouched:
  ```go
  // First pass: exact 4-part match
  for e := range existing {
      if strings.EqualFold(e.Host, n.Host) && strings.EqualFold(e.Namespace, n.Namespace) &&
         strings.EqualFold(e.Model, n.Model) && strings.EqualFold(e.Tag, n.Tag) {
          return e, nil
      }
  }
  // Second pass: longest consecutive prefix match
  ```
* **Lesson**: *Hierarchical Prefix Canonicalization over Disjoint Field Matching in Multi-Part Composite Identifiers*. Multi-part composite keys must be matched hierarchically along prefix boundaries rather than independently per field across unordered collections.
* **Promotion Decision**: Promoted as **Rule 67** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 10: Two-Pass Structured Output Wedging Thinking Models (`BUG-OLLAMA-10`)
* **Context**: Structured output formatting for reasoning models in `server/routes.go`, `llm/llama_server.go`, and `mlxrunner/pipeline.go`.
* **What Was Expected**: Formatting constraints (JSON schemas) apply to the final message without corrupting or suppressing the model's chain-of-thought thinking trace.
* **What Actually Happened**: When applying JSON formatting to thinking models, the server ran two separate generation passes: an unconstrained pass, cancelled once the parser reported thought completion, followed by a re-prompted second pass under grammar constraints. This restart cost a full second prefill, dropped boundary chunks, corrupted prompt evaluation duration metrics, and on MLX leaked stray tokens into the JSON payload.
* **Evidence in Repo**:
  * Commits: `5a0ff311` (PR [#18441](https://github.com/ollama/ollama/pull/18441)), `2ff052b7`, `1ce2b680`
  * Source: `server/routes.go#L2850-L2860`
* **Root Cause**: Deferring grammar constraints via generation restarts rather than dynamic in-stream grammar activation.
* **Remediation**: Unified single-pass generation: pass the thinking termination strings (`ThinkingClose`) directly to the backend runner, and activate the grammar constraint dynamically on the first token generated immediately following the thinking sentinel:
  ```go
  r.Completion(ctx, llm.CompletionRequest{
      Prompt:        prompt,
      Format:        req.Format,
      ThinkingClose: thinkingCloseForCompletion(builtinParser, thinkTagParser),
      // Grammar applied in-stream after thinking close
  }, callback)
  ```
* **Lesson**: *Single-Pass Delayed-Grammar Activation on Thinking & Reasoning Model Generations*. Do not restart generations to apply grammars after reasoning traces. Pass reasoning sentinel boundaries to the runner and dynamically activate constraints in a single pass.
* **Promotion Decision**: Promoted as **Rule 68** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 11: Unbounded Prefix Cache Leak from Global Pin-and-Sweep Memory Management (`BUG-OLLAMA-11`)
* **Context**: MLX memory management in `mlx/scope.go`.
* **What Was Expected**: Memory allocations created during prefix cache lookups and evaluations are reclaimed when no longer needed.
* **What Actually Happened**: The native bindings freed arrays by sweeping everything not pinned. Freeing any array required knowing what every other caller held, and code that never swept accumulated arrays until physical RAM was exhausted. During multi-turn conversations, prefix cache merges copied KV snapshots without freeing consumed copies until request completion, driving secondary requests past available RAM.
* **Evidence in Repo**:
  * Commit: `13037ecb` — `mlx: scope array lifetimes instead of pinning and sweeping`
  * Source: `mlx/scope.go#L1-L75`
* **Root Cause**: Global pin-and-sweep memory tracking lacking lexical or function-scoped lifetime boundaries.
* **Remediation**: Scope-based lifetime management: every array belongs to a lexical function scope (`Scoped`, `ScopedEval`) or held scope (`NewScope`); arrays are freed deterministically when their scope exits unless explicitly escaped:
  ```go
  func Scoped(fn func()) {
      s := enterScope()
      defer exitScope(s)
      fn()
  }
  ```
* **Lesson**: *Scope-Based Array Lifetime Management over Global Pinning and Sweeping*. In high-throughput accelerator bindings, replace global pin-and-sweep tracking with deterministic scoped lifetimes.
* **Promotion Decision**: Codified as **Refinement to Rule 7** and in `03_SKILLS/high-performance-systems-and-compiler-invariants.md`.

---

### Incident 12: Memory-Mapped Tensor Double Counting on Partial Layer Offload (`BUG-OLLAMA-012`)
* **Context**: Memory accounting in `llm/llama_server.go`.
* **What Was Expected**: `ollama ps` accurately reports process memory and VRAM usage.
* **What Actually Happened**: With memory mapping (`mmap`), `CPU_Mapped` model buffers span the entire file on disk because first and last tensors reside on CPU. Summing `CUDA0` buffer size and `CPU_Mapped` buffer size double-counted weights that were already offloaded to GPU, reporting 26.6 GiB total memory for a 13.2 GiB model!
* **Evidence in Repo**:
  * Commit: `04639403` (PR [#16709](https://github.com/ollama/ollama/pull/16709)) — `llm: fix ollama ps double-counting mmap'd weights on partial offload`
  * Source: `llm/llama_server.go#L2756-L2775`
* **Root Cause**: Summing virtual address spans of memory-mapped files and physical device buffers without subtracting file overlap.
* **Remediation**: Calculate file-backed overlap and trim it from the reclaimable page cache estimate:
  ```go
  if memCPUMappedModel > 0 {
      if modelSize := modelFileSize(s.modelPath, s.metadata); modelSize > 0 && memModelFileBacked > modelSize {
          total -= min(memCPUMappedModel, memModelFileBacked-modelSize)
      }
  }
  ```
* **Lesson**: *Model Weight Double-Counting Mitigation on Partial GPU Offload with Memory-Mapped Tensors*. Memory accounting must subtract mapped file overlaps when computing composite host/device memory footprints.
* **Promotion Decision**: Codified as **Refinement to Rule 5**.

---

### Incident 13: Metal GPU Watchdog Timeouts during Heavy Cold-Storage Model Loading (`BUG-OLLAMA-13`)
* **Context**: MLX runner model weight loading in `x/mlxrunner/runner.go`.
* **What Was Expected**: Models load reliably from all storage media, including external drives and network mounts.
* **What Actually Happened**: On Apple Silicon Metal, queued command buffers that trigger page-ins from slow storage stall on disk I/O. If I/O exceeds the macOS 5-second Metal watchdog timeout, the OS kills the command buffer with a GPU timeout error!
* **Evidence in Repo**:
  * Commit: `77e3b0ac` — `mlxrunner: avoid Metal GPU timeouts when loading models from slow storage`
  * Source: `x/mlxrunner/runner.go#L73-L82`
* **Root Cause**: Committing GPU command buffers dependent on unmaterialized cold file storage.
* **Remediation**: Explicitly materialize loaded tensors via CPU reads before constructing execution graphs:
  ```go
  if mlx.MetalIsAvailable() {
      mlx.Eval(slices.Collect(maps.Values(tensors))...)
  }
  ```
* **Lesson**: *Metal Storage I/O Decoupling from Hardware Command Buffer Queues*. Cold tensor weights must be paged in and materialized on CPU prior to submitting hardware GPU command buffers.
* **Promotion Decision**: Codified in `03_SKILLS/high-performance-systems-and-compiler-invariants.md`.

---

### Incident 14: Unbounded Multi-Turn Conversation Memory Growth via Active-Path Checkpoint Retention (`BUG-OLLAMA-14`)
* **Context**: Conversation prefix cache management in `mlxrunner/prefix_cache.go`.
* **What Was Expected**: Multi-turn chat conversations operate within a fixed prefix cache memory budget.
* **What Actually Happened**: The prefix cache evictor skipped all nodes on the active conversation path. On models with sliding-window or recurrent layers (e.g. Gemma 4, Qwen 4), each turn checkpoint stored full layer state (800 MiB per turn). Long chats grew memory without bound until the scheduler evicted the entire model!
* **Evidence in Repo**:
  * Commits: `6137793a` (PR [#17783](https://github.com/ollama/ollama/pull/17783)) & `b859a945`
  * Source: `mlxrunner/prefix_cache.go#L605-L655`
* **Root Cause**: Exempting all active-path nodes from LRU eviction.
* **Remediation**: Protect only frontiers and branch points; evict intermediate turn nodes by merging them into children and splitting reused heads at live offsets.
* **Lesson**: *Active-Path Intermediate Turn Checkpoint Eviction under Fixed Prefix Cache Budgets*. Conversation caches must allow intermediate checkpoints on active paths to be merged and reclaimed under memory pressure.
* **Promotion Decision**: Codified in `03_SKILLS/high-performance-systems-and-compiler-invariants.md`.

---

### Incident 15: Client Cancellation Dropping Long-Prompt Prefill Progress (`BUG-OLLAMA-15`)
* **Context**: Prompt prefill caching in `mlxrunner/prefix_cache.go`.
* **What Was Expected**: Client timeouts during long prompt evaluations do not force retries to restart from zero.
* **What Actually Happened**: Prefill restore points only reached the prefix trie when prefill completed. When clients timed out on 40k-token prompts, `close()` discarded all captured snapshots. Every retry started from zero and timed out again, hanging the client permanently!
* **Evidence in Repo**:
  * Commits: `c44575ef` (PR [#17839](https://github.com/ollama/ollama/pull/17839)) & `81f9a394`
  * Source: `mlxrunner/prefix_cache.go#L555-L565`
* **Root Cause**: Discarding intermediate progress captures upon session cancellation.
* **Remediation**: Attach all crossed snapshots upon session close, and grow the trie by whole child nodes so restore points survive across canceled attempts:
  ```go
  func (s *cacheSession) close() {
      s.attachPrefillSnapshots() // Preserves crossed captures on abort
      // ...
  }
  ```
* **Lesson**: *Resumed Prefill Snapshot Preservation and Whole Child Node Extension across Client Timeouts*. Asynchronous prefill pipelines must preserve progress snapshots upon cancellation, allowing retries to resume from intermediate checkpoints.
* **Promotion Decision**: Codified in `03_SKILLS/high-performance-systems-and-compiler-invariants.md`.

---

### Incident 16: Background Goroutine Leaks Racing Test Cleanup & Package Globals (`BUG-OLLAMA-16`)
* **Context**: Background update checks in `app/updater/updater.go` and progress animation in `progress/progress.go`.
* **What Was Expected**: Operations with background tasks exit cleanly without leaving orphaned goroutines reading global variables.
* **What Actually Happened**: `DownloadNewRelease` spawned a background update-check loop reading package-level configuration (`UpdateCheckInterval`) and returned without waiting. Under `-race`, subsequent tests mutated globals while the orphaned goroutine was reading them, causing data races. Similarly, terminal spinners leaked one goroutine per progress bar.
* **Evidence in Repo**:
  * Commits: `b63eed94` (PR [#17446](https://github.com/ollama/ollama/pull/17446)) & `43983edf` (PR [#17445](https://github.com/ollama/ollama/pull/17445))
  * Source: `app/updater/updater.go#L155-L175`, `progress/progress.go#L45-L70`
* **Root Cause**: Returning from functions before draining background worker goroutines.
* **Remediation**: Use `sync.WaitGroup` to synchronously drain background worker goroutines before function return:
  ```go
  bgctx, bgcancel := context.WithCancel(downloadCtx)
  var bgwg sync.WaitGroup
  bgwg.Go(func() {
      for {
          select {
          case <-bgctx.Done():
              return
          case <-time.After(UpdateCheckInterval):
              u.checkForUpdate(bgctx)
          }
      }
  })
  defer func() {
      bgcancel()
      bgwg.Wait() // Synchronous drain barrier
  }()
  ```
* **Lesson**: *Synchronous Background Goroutine Draining before Returning to Callers Mutating Globals*. Any function initiating background goroutines that access shared configuration MUST cancel and drain those goroutines before returning.
* **Promotion Decision**: Codified in `03_SKILLS/high-performance-systems-and-compiler-invariants.md`.

---

## 3. Dimension Coverage Audit

| Dimension | Title | Status | Incident References |
|---|---|---|---|
| **D1** | Core Architecture / Graph & Subprocess Execution | **Verified** | `BUG-OLLAMA-01`, `BUG-OLLAMA-10`, `BUG-OLLAMA-13` |
| **D2** | Concurrency / Lifecycle / Schedulers | **Verified** | `BUG-OLLAMA-01`, `BUG-OLLAMA-03`, `BUG-OLLAMA-16` |
| **D3** | State Machines / Parsing / Error Recovery | **Verified** | `BUG-OLLAMA-04`, `BUG-OLLAMA-10`, `BUG-OLLAMA-15` |
| **D4** | Memory / Pointers / Safety / UAF | **Verified** | `BUG-OLLAMA-02`, `BUG-OLLAMA-11`, `BUG-OLLAMA-14` |
| **D5** | Numeric / Strides / Arithmetic / Overflow | **Verified** | `BUG-OLLAMA-05`, `BUG-OLLAMA-12` |
| **D6** | Cross-Platform / OS / Hardware Discovery | **Verified** | `BUG-OLLAMA-07`, `BUG-OLLAMA-09` |
| **D7** | Testing / CI / Invariant Verification | **Verified** | `BUG-OLLAMA-03`, `BUG-OLLAMA-16` |
| **D8** | Security & Trust Boundaries | **Verified** | `BUG-OLLAMA-06`, `BUG-OLLAMA-08` |
