# Project Learning Record — llama.cpp (Full-Spectrum Harvest)

This document records the empirical project learnings, forensic defect investigations, and architectural invariant extractions derived from the **llama.cpp** repository (`c:\Users\Admin\Desktop\Learning extracted done\ollma.cpp\llama.cpp` — The foundational C/C++ LLM inference framework, GGML tensor execution engine, GGUF binary format, continuous batching, speculative decoding, multi-GPU split compute, RoPE embeddings, quantized GEMM/GEMV matrix math across CUDA, Metal, Vulkan, SYCL, OpenCL, and CPU AVX/NEON/SVE, grammar-constrained sampling, and high-concurrency HTTP server).

---

## 1. Executive Summary & Verification Coverage

* **Project**: `ggml-org/llama.cpp` (Foundational High-Performance Large Language Model Inference Framework and GGML Tensor Subsystem)
* **Harvest Scope**: Full-Spectrum Multi-Dimensional Harvest across all 8 Dimensions (D1–D8).
* **Total Confirmed Real Incidents Analyzed**: 16 Production Defect Fixes & Architectural Invariants.
* **Promoted Reusable Engineering Patterns**:
  * **Rule 50**: Cached Computation Graph Invalidation upon Underlying Buffer Release (Anti-Use-After-Free & RCE)
  * **Rule 51**: By-Value Command Functor Capture to Preempt Host Stack Frame Use-After-Return in Asynchronous Queues
  * **Rule 52**: Elimination of In-Place Buffer Aliasing in Multi-Pass / Double-Buffered Device Radix Sorting
  * **Rule 53**: Multi-Segment Granularity-Lockstep Tensor Splitting for Asymmetric Multi-Head Geometries ($d_k \neq d_v$)
  * **Rule 54**: Include-Order Independent Constant Guarantees and Cross-Language PCH ABI Boundary Segregation
  * **Rule 55**: GPU Thread-Block Barrier Scope Non-Divergence (`__syncthreads()` Control Flow Unification)
  * **Rule 56**: Centralized State Machine Advance over Peer Eviction Flags in High-Concurrency Resource Pools
  * **Rule 57**: Universal Checkpointing via Pre-Terminal Token State Stashing & Logit Replay across Non-Deletable Recurrent State Runtimes
* **Brain Refinements Codified**:
  * **Rule 2 Refinement**: Scoped RAII Memory Pool Allocation over Persistent Hash-Map Retainers in Monotonic/LIFO Allocators
  * **Rule 5 Refinement**: 64-Bit Stride/Dimension Promotion (`size_t nb`, `int64_t ne`) & Multiplicative Overflow Defense on Model Deserialization
  * **Rule 11 Refinement**: Adaptive Hybrid Busy-Spin with Deferred Event Channel Sleeping for Low-Latency Distributed RPC
* **Domain-Specific Patterns Retained in Learning Record**:
  * Pre-Masked Bounds Clamping and Directional Pairing (`if (ixj > col)`) in GPU Bitonic Sorting Shaders
  * Hardware Graph Capture Early-Return on Degenerate / Empty Computation Subgraphs (`gf->n_nodes == 0`)
  * Dynamic Device Capability Probing for Heterogeneous Memory Access (Automated Lazy `mmap` fallback on iGPUs)
  * Graceful Schema Constraint Degradation with Partial Grammar Rule Rollback in GBNF Parsers
  * Cross-Platform Unicode Path Traversal via `std::filesystem::create_directories` with `std::error_code`
  * Process-Preserving Exception Propagation over Abrupt Process Abort (`GGML_ABORT`) in Shared Inference Libraries
* **Excluded / Discarded Candidates**:
  * Ty spelling fixes and documentation typo corrections
  * Synthetic benchmark CI runner tolerance adjustments
  * Third-party vendor library version bumps (`cpp-httplib 0.58.0`) without architectural change

---

## 2. Forensic Incident & Learning Records

### Incident 1: Cached Computation Graph Retaining Freed Buffer Pointers Permitting Remote Use-After-Free & Hijacking (`BUG-LLAMA-01`)
* **Context**: Remote Procedure Call (RPC) server computation graph caching in `ggml/src/ggml-rpc/ggml-rpc.cpp`.
* **What Was Expected**: Caching the compiled execution graph across requests avoids redundant tensor layout serialization during re-execution (`GRAPH_RECOMPUTE`).
* **What Actually Happened**: Cached graph nodes stored direct raw pointers to backend buffers that were live during the initial `graph_compute()`. When an unauthenticated remote client invoked `FREE_BUFFER`, the backend freed the memory chunk, but the server's `stored_graphs` cache retained the dangling graph nodes pointing into the freed memory! Subsequent `GRAPH_RECOMPUTE` calls executed directly through the dangling pointers (Use-After-Free). An attacker could reshape the memory via `ALLOC_BUFFER` / `SET_TENSOR` commands, leak `libc` addresses, and overwrite the `buffer iface` vtable in `BUFFER_CLEAR`, achieving arbitrary remote code execution (RCE)!
* **Evidence in Repo**:
  * Commit: `60199339b` (PR [#24292](https://github.com/ggml-org/llama.cpp/pull/24292)) — `rpc : invalidate cached compute graph when a referenced buffer is freed`
  * Source: `ggml/src/ggml-rpc/ggml-rpc.cpp#L1301-L1308`
* **Root Cause**: Retaining compiled computation graphs containing raw memory addresses across buffer deallocation lifecycles without an invalidation barrier.
* **Remediation**: Force immediate invalidation and clearing of all cached computation graphs whenever any backend buffer is released:
  ```cpp
  // Discard all cached graphs to avoid use-after-free in graph_recompute,
  // since their nodes may hold pointers to the buffer being freed.
  for (auto & sg : stored_graphs) {
      sg.graph = nullptr;
  }
  ggml_backend_buffer_free(buffer);
  buffers.erase(buffer);
  ```
* **Lesson**: *Cached Computation Graph Invalidation upon Underlying Buffer Release (Anti-Use-After-Free & RCE)*. Any system that caches compiled execution graphs, intermediate plans, or ASTs holding raw buffer/hardware memory pointers MUST proactively invalidate all cached graphs when any constituent memory buffer is deallocated.
* **Promotion Decision**: Promoted as **Rule 50** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 2: Host Stack Frame Use-After-Return in Asynchronous Queued Kernel Dispatch (`BUG-LLAMA-02`)
* **Context**: SYCL / oneDNN Flash Attention execution in `ggml/src/ggml-sycl/fattn-onednn.cpp`.
* **What Was Expected**: Scaling constant $1/\text{scale}$ is passed to the device Flash Attention primitive asynchronously without blocking the host CPU thread.
* **What Actually Happened**: The attention scale was uploaded using an asynchronous DMA copy pointing to a stack-local variable: `stream->memcpy(scbuf.get(), &scale_h, sizeof(scale_h))`. On the asynchronous in-order command queue, this copy waited behind preceding K/V staging kernels. In long-context inference ($KV \ge 26k$), the staging kernels took enough time that the host C++ function exited and its stack frame was overwritten before the DMA transfer executed! The device copied garbage bytes from recycled stack memory as the attention scale factor, causing model output to catastrophically collapse into repeated characters ("GGGGG...")!
* **Evidence in Repo**:
  * Commit: `d6b61ac0d` (PR [#25880](https://github.com/ggml-org/llama.cpp/pull/25880)) — `sycl: fix use-after-return of the SDPA scale in the oneDNN flash-attention path`
  * Source: `ggml/src/ggml-sycl/fattn-onednn.cpp#L214-L230`
  * Test: `tests/test-backend-ops.cpp` (Large-KV F16 cases with $KV \in \{4096, 16384\}$)
* **Root Cause**: Queuing an asynchronous device memory transfer referencing a stack-allocated host pointer whose lifetime expires upon function return.
* **Remediation**: Discard the host pointer DMA copy; instead, capture the scalar value directly by value into a single-task device kernel command functor:
  ```cpp
  const sycl::half scale_h = (sycl::half) (1.0f / kq_scale);
  ggml_sycl_pool_alloc<sycl::half> scbuf(ctx.pool(), 1);
  sycl::half * const scale_dev = scbuf.get();
  // Value is captured into the command functor; no host memory outlives the call
  stream->single_task([=]() { *scale_dev = scale_h; });
  ```
* **Lesson**: *By-Value Command Functor Capture to Preempt Host Stack Frame Use-After-Return in Asynchronous Queues*. When passing scalar constants or configuration values to an asynchronous execution queue, code must capture parameters by value into the queue command functor rather than passing host stack addresses via asynchronous memory copies.
* **Promotion Decision**: Promoted as **Rule 51** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 3: In-Place Key Buffer Aliasing in CUB Device Radix Sort Corrupting Permutation Permitting Garbage Index Gathers (`BUG-LLAMA-03`)
* **Context**: GPU top-k sampling and argsort across large vocabularies in `ggml/src/ggml-cuda/argsort.cu`.
* **What Was Expected**: Calling `DeviceRadixSort::SortPairs` returns sorted indices matching descending logit order.
* **What Actually Happened**: The implementation invoked CUB's one-shot `DeviceRadixSort::SortPairs` with aliased input/output key buffers: `d_keys_in == d_keys_out == temp_keys`. CUB's internal double-buffer ping-pong algorithm requires strictly distinct key buffers. Aliasing the buffers caused the sort passes to partially overwrite their own input mid-pass, generating corrupted permutations! On large vocabularies (e.g. 248k columns on Maxwell / CUDA 12.5), this emitted out-of-bounds index garbage that subsequently crashed downstream `get_rows` kernels with memory faults.
* **Evidence in Repo**:
  * Commit: `b23701f77` (PR [#28389](https://github.com/ggml-org/llama.cpp/pull/28389)) — `cuda : fix CUB argsort corruption caused by in-place keys`
  * Source: `ggml/src/ggml-cuda/argsort.cu#L51-L135`
* **Root Cause**: Violating double-buffering algorithm preconditions by passing aliased in-place input/output pointers to a multi-pass radix sort.
* **Remediation**: Allocate a dedicated, distinct `temp_keys_out` buffer for all radix and segmented sort invocations:
  ```cpp
  ggml_cuda_pool_alloc<float> temp_keys_alloc(pool, ncols * nrows);
  // Device*Sort algorithms currently do not allow for in-place sorting/aliasing of input/outputs
  ggml_cuda_pool_alloc<float> temp_keys_out_alloc(pool, ncols * nrows);
  float * temp_keys     = temp_keys_alloc.get();
  float * temp_keys_out = temp_keys_out_alloc.get();
  CUDA_CHECK(DeviceRadixSort::SortPairs(d_temp_storage, temp_storage_bytes,
                                        temp_keys, temp_keys_out,
                                        temp_indices, dst, ...));
  ```
* **Lesson**: *Elimination of In-Place Buffer Aliasing in Multi-Pass / Double-Buffered Device Radix Sorting*. In parallel radix sort or ping-pong sorting algorithms, input and output key buffers must never be aliased. In-place aliasing corrupts intermediate passes and produces invalid permutation indices.
* **Promotion Decision**: Promoted as **Rule 52** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 4: Multi-Device Tensor Splitting Across Asymmetric Head Geometries ($d_k \neq d_v$) (`BUG-LLAMA-04`)
* **Context**: Multi-GPU tensor parallelism for models with asymmetric attention heads (e.g. MiMo where $d_k=192$ and $d_v=128$) in `src/llama-model.cpp`.
* **What Was Expected**: Fused QKV weight tensors and KV caches split across multiple GPUs evenly such that each GPU receives integer multiples of complete attention heads.
* **What Actually Happened**: The tensor split subsystem assumed symmetric K and V head dimensions, packing them into 2 segments: `{{n_embd_q, 1}, {n_embd_k, 2}}`. When $d_k \neq d_v$, treating K and V with a shared granularity split across head boundaries, placing fractional parts of heads on different GPUs and causing severe numerical corruption and projection misalignment!
* **Evidence in Repo**:
  * Commit: `f805c57a2` (PR [#29294](https://github.com/ggml-org/llama.cpp/pull/29294)) — `llama : fix tensor split for fused qkv with uneven K/V head sizes`
  * Source: `src/llama-model.cpp#L666-L795`
* **Root Cause**: Hardcoding 2-segment symmetric granularity assumptions when partitioning fused multi-head projection tensors.
* **Remediation**: Split asymmetric fused QKV into 3 distinct segments `{{n_embd_q, 1}, {n_embd_k, 1}, {n_embd_v, 1}}` with distinct head-aligned modular granularities:
  ```cpp
  const int64_t granularity_kv = granularity_q / n_gqa;
  // Align V tensors to whole V heads at the same head-index scale as Q and K:
  const int64_t granularity_v  = (granularity_kv / hparams.n_embd_head_k(il)) * hparams.n_embd_head_v(il);
  if (segments.size() == 3) {
      return {granularity_q, granularity_kv, granularity_v};
  }
  ```
* **Lesson**: *Multi-Segment Granularity-Lockstep Tensor Splitting for Asymmetric Multi-Head Geometries*. When distributing multi-component fused matrices (such as fused QKV) across parallel devices, architectures with differing sub-vector or head dimensions must segment each component independently and compute individual head-aligned granularities to guarantee whole-head device allocation.
* **Promotion Decision**: Promoted as **Rule 53** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 5: Precompiled Header (PCH) Macro Divergence Undersizing Work Buffers & Heap Corruption (`BUG-LLAMA-05`)
* **Context**: CPU backend build configuration and work-buffer sizing in `ggml/src/ggml-cpu/ops.h` and `CMakeLists.txt`.
* **What Was Expected**: RoPE work buffers sized in C allocate enough memory for all CPU execution threads without overflowing the heap.
* **What Actually Happened**: The build enabled precompiled headers (PCH) that force-included `ggml-impl.h`, pulling in C++ `<new>` via `<array>/<vector>` and defining `__cpp_lib_hardware_interference_size`. This caused C++ kernel translation units to define `CACHE_LINE_SIZE = 256`, while pure C sizing code in `ggml-cpu.c` (unable to include C++ headers) defaulted to `64`! Because the buffer was sized using 64-byte strides but accessed using 256-byte cache line strides, the buffer was undersized by $(256/4 - 16) \times n_\text{threads} \times 4$ bytes, triggering heap-buffer overflows and memory corruption during RoPE execution!
* **Evidence in Repo**:
  * Commit: `2f539596c` (PR [#28882](https://github.com/ggml-org/llama.cpp/pull/28882), Issue [#28858](https://github.com/ggml-org/llama.cpp/issues/28858)) — `ggml-cpu : disable PCH and fix CACHE_LINE_SIZE ambiguity to fix heap corruption`
  * Source: `ggml/src/ggml-cpu/ops.h#L5-L25`, `ggml/src/ggml-cpu/CMakeLists.txt#L675-L685`
* **Root Cause**: Macro definitions conditional on feature-test macros varying across C and C++ translation units due to PCH include-order pollution.
* **Remediation**: Disable PCH on affected targets and remove the header-dependent macro branch, making constants strictly deterministic and include-order independent:
  ```cpp
  #if defined(__POWER9_VECTOR__)
  #define CACHE_LINE_SIZE 128
  #elif defined(__VXE__) || defined(__VXE2__)
  #define CACHE_LINE_SIZE 256
  #else
  #define CACHE_LINE_SIZE 64
  #endif
  ```
* **Lesson**: *Include-Order Independent Constant Guarantees and Cross-Language PCH ABI Boundary Segregation*. Sizing constants and layout macros shared between C and C++ translation units or across precompiled header boundaries must NEVER depend on header-conditional feature macros (`__cpp_lib_*`). Memory sizing and stride calculations must be compile-unit deterministic.
* **Promotion Decision**: Promoted as **Rule 54** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 6: Thread Block Divergent Barrier in CUDA Flash Attention (`__syncthreads()`) (`BUG-LLAMA-06`)
* **Context**: CUDA Flash Attention half-precision tensor core MMA kernels in `ggml/src/ggml-cuda/fattn-mma-f16.cuh`.
* **What Was Expected**: Warp tile reductions synchronize across parallel warps using shared memory without GPU deadlocks.
* **What Actually Happened**: The kernel placed a block synchronization barrier `__syncthreads()` inside an `if (np > 1 && threadIdx.y % np == 0)` conditional block, and added an `else if (np > 1)` branch with another `__syncthreads()`. In CUDA, all threads in a thread block must reach the exact same barrier instruction. Calling `__syncthreads()` conditionally across distinct diverging branches creates barrier divergence and hardware execution stalls.
* **Evidence in Repo**:
  * Commit: `b74f590ea` (PR [#27870](https://github.com/ggml-org/llama.cpp/pull/27870)) — `ggml-cuda: fix divergent barrier in f16 flash attention`
  * Source: `ggml/src/ggml-cuda/fattn-mma-f16.cuh#L1545-L1615`
* **Root Cause**: Calling `__syncthreads()` within divergent branch blocks rather than at unified thread-block scope.
* **Remediation**: Move `__syncthreads()` outside the conditional branch into the shared outer block scope (`if (np > 1)`), scoping thread-specific reductions and metadata write-backs to conditional checks before and after the barrier:
  ```cuda
  if (np > 1) {
      if (threadIdx.y % np == 0) {
          // Pre-barrier warp combination in shared memory
      }
      __syncthreads(); // Unconditional barrier across all threads in block
      if (threadIdx.y % np == 0) {
          // Post-barrier writeback
      }
  }
  ```
* **Lesson**: *GPU Thread-Block Barrier Scope Non-Divergence (`__syncthreads()` Control Flow Unification)*. Hardware thread-block synchronization barriers in GPU kernels must execute under uniform control flow. Code must never place barriers inside mutually exclusive conditional branches; reductions and data transfers should be scoped before and after an unbranched barrier.
* **Promotion Decision**: Promoted as **Rule 55** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 7: Concurrency Deadlock & Slot Starvation in Multi-Model Eviction Queue (`BUG-LLAMA-07`)
* **Context**: High-concurrency multi-model HTTP router in `tools/server/server-models.cpp`.
* **What Was Expected**: When multiple concurrent requests arrive for different models while model capacity is full (`models_max`), idle models are evicted LRU-style and pending requests are served in FIFO arrival order.
* **What Actually Happened**: Individual requests attempted to coordinate eviction via ad-hoc per-entry flags (`slot_pending`, `victim = pick_victim()`). When two concurrent requests arrived for unloaded models while an idle model existed, both waiters raced to mark the same slot or picked the same victim. Once one request unloaded the model, the second waiter hung indefinitely waiting for a slot that was never assigned!
* **Evidence in Repo**:
  * Commit: `160bd031b` (PR [#28539](https://github.com/ggml-org/llama.cpp/pull/28539)) — `server: fix LRU hang on multiple requests same model`
  * Source: `tools/server/server-models.cpp#L946-L1515`
  * Test: `tools/server/tests/unit/test_router.py::test_router_queue_two_waiters_share_one_eviction`
* **Root Cause**: Distributed state tracking and decentralized peer eviction flags in concurrent resource allocators.
* **Remediation**: Eliminate peer flags (`slot_pending`). Drive all resource allocation and eviction through a centralized state machine tick method (`sched->tick(lk)`), invoked on every status transition (idle, unload, load completion, waiter departure):
  ```cpp
  // Any event that alters pool capacity or waiter count triggers a centralized scheduler tick
  sched->tick(lk);
  ```
* **Lesson**: *Centralized State Machine Advance over Peer Eviction Flags in High-Concurrency Resource Pools*. Resource management systems managing constrained execution slots or pools under concurrency must coordinate through a centralized scheduler state machine. All state transitions (allocation, deallocation, timeout, client disconnect) must advance the scheduler loop rather than relying on distributed peer flags.
* **Promotion Decision**: Promoted as **Rule 56** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 8: KV & Recurrent State Deserialization Rollback / Cache Discard Failure (`BUG-LLAMA-08`)
* **Context**: Sequence session state saving and restoration in `src/llama-context.cpp` and `src/llama-kv-cache.cpp`.
* **What Was Expected**: If loading a serialized session or sequence state fails (e.g. corrupted input data, truncated file, abnormal cell counts), the failed sequence is emptied and existing active sequences remain completely unaffected.
* **What Actually Happened**: When `state_set_data` encountered corrupted bytes or abnormal cell counts mid-read, it returned an error code but left the partially written data in the unified KV cache and recurrent SSM/Mamba state buffers! Because unified KV memory is shared across sequences, these unzeroed garbage/NaN values bled into concurrent sequences, causing subsequent decodes on unrelated sequences to produce NaN logits!
* **Evidence in Repo**:
  * Commit: `08618ff8e` (PR [#27530](https://github.com/ggml-org/llama.cpp/pull/27530)) — `llama : fix K/V and recurrent state cleanup after failed restores`
  * Source: `src/llama-kv-cache.cpp#L117-L230`, `src/llama-context.cpp`
  * Test: `tests/test-save-load-state.cpp::test_state_restore_failure`
* **Root Cause**: Non-atomic state deserialization lacking cleanup and rollback guarantees on read failure.
* **Remediation**: Implement explicit discard/zeroing semantics on partial or failed restores across all memory backends (KV cache, recurrent state, DSA, hybrid):
  ```cpp
  if (!state_read_data(io, cell_count)) {
      state_clear(dest_seq_id, cell_head, cell_count);
      return false;
  }
  ```
* **Lesson**: *Universal Checkpointing via Pre-Terminal Token State Stashing & Logit Replay across Non-Deletable Recurrent State Runtimes*. State deserialization routines operating over shared multi-sequence memory pools must provide atomic all-or-nothing rollback semantics; on failure, staged buffers must be explicitly purged/zeroed. Furthermore, checkpointing non-deletable recurrent architectures requires saving state before the final token and replaying upon restoration.
* **Promotion Decision**: Promoted as **Rule 57** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 9: 32-Bit Integer Truncation in Multi-Dimensional Strides and Dimensions (`BUG-LLAMA-09`)
* **Context**: Multi-dimensional tensor permutation and view indexing in `ggml/src/ggml.c`.
* **What Was Expected**: `ggml_permute` computes arbitrary dimensional views across large models and long contexts.
* **What Actually Happened**: The permutation helper stored dimensions (`ne`) and byte strides (`nb`) in signed 32-bit `int` arrays: `int ne[GGML_MAX_DIMS]; int nb[GGML_MAX_DIMS];`. In long-context inference or large multi-billion parameter models, tensor byte strides regularly exceed $2^{31}-1$ bytes (2GB). The 32-bit signed integer overflowed into negative numbers, leading to corrupted pointer arithmetic, out-of-bounds gathers, and segmentation faults!
* **Evidence in Repo**:
  * Commit: `c21284cdf` (PR [#29227](https://github.com/ggml-org/llama.cpp/pull/29227)) — `ggml : fix dimension and stride truncation in ggml_permute`
  * Source: `ggml/src/ggml.c#L3897-L3910`
* **Root Cause**: Truncating 64-bit tensor dimensions and byte offsets into signed 32-bit integer arrays.
* **Remediation**: Use `int64_t` for element dimensions and `size_t` for byte strides across all tensor view operations:
  ```c
  int64_t ne[GGML_MAX_DIMS];
  size_t  nb[GGML_MAX_DIMS];
  ```
* **Lesson**: Formulated as a crucial refinement to **Rule 5**: Tensor dimensions (`ne`) and byte strides (`nb`) must strictly use `int64_t` and `size_t`. Signed 32-bit types are strictly prohibited in stride mathematics.
* **Promotion Decision**: Refinement to **Rule 5** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 10: Scratchpad Cache Breaking LIFO Memory Pool Deallocation Order (`BUG-LLAMA-10`)
* **Context**: SYCL / oneDNN operator execution in `ggml/src/ggml-sycl/gemm.hpp` and `common.hpp`.
* **What Was Expected**: Temporary scratchpads allocate fast memory from backend pools without fragmentation.
* **What Actually Happened**: The context stored scratchpad allocations inside a long-lived hash map: `std::unordered_map<sycl::queue *, std::unique_ptr<ggml_sycl_pool_alloc<uint8_t>>> scratchpad_map`. Because the underlying memory pool was an ordered bump/stack allocator requiring LIFO allocation/free pairs, retaining persistent scratchpad allocations across varying subsequent operators broke the pool free order, causing pool corruption and memory leaks.
* **Evidence in Repo**:
  * Commit: `661643e43` (PR [#28704](https://github.com/ggml-org/llama.cpp/pull/28704)) — `sycl : fix oneDNN scratchpad breaking the pool free order`
  * Source: `ggml/src/ggml-sycl/gemm.hpp#L66-L75`, `common.hpp`
* **Root Cause**: Retaining heap-cached allocations from an ordered/LIFO memory pool across unrelated operator scopes.
* **Remediation**: Allocate scratchpads using scoped local RAII pool objects freed immediately upon operator completion:
  ```cpp
  const auto scratchpad_md = matmul_pd.scratchpad_desc();
  ggml_sycl_pool_alloc<uint8_t> scratchpad(ctx.pool());
  void * scratchpad_ptr = scratchpad_md.get_size() > 0 ? scratchpad.alloc(scratchpad_md.get_size()) : nullptr;
  ```
* **Lesson**: Formulated as a crucial refinement to **Rule 2**: Ordered and LIFO memory pools must only be allocated via scoped RAII lifetime guards; persisting pool allocations in dynamic dictionaries breaks allocation order.
* **Promotion Decision**: Refinement to **Rule 2** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 11: Adaptive Hybrid Busy-Spin with Deferred Event Channel Sleeping for Low-Latency RPC (`BUG-LLAMA-11`)
* **Context**: Distributed RDMA networking transport in `ggml/src/ggml-rpc/transport.cpp`.
* **What Was Expected**: Low-latency tensor communication between distributed cluster nodes.
* **What Actually Happened**: Busy-polling the completion queue (`ibv_poll_cq`) pinned 100% of a CPU core per connection even when completely idle, starving other system threads and draining power. Conversely, purely blocking event-driven calls added intolerable latency during high-throughput tensor streaming.
* **Evidence in Repo**:
  * Commit: `d7fb90e8e` (PR [#29440](https://github.com/ggml-org/llama.cpp/pull/29440)) — `RPC: use RDMA completion channel to not spin`
  * Source: `ggml/src/ggml-rpc/transport.cpp#L54-L455`
* **Root Cause**: Binary choice between wasteful 100% CPU busy-spinning and high-latency blocking event notifications.
* **Remediation**: Implement an adaptive hybrid polling architecture: spin during active packet bursts; if idle for a threshold (`RDMA_SPIN_TIME = 100ms`), arm the completion queue (`ibv_req_notify_cq`) and block on the event file descriptor via `poll()` alongside TCP connection health monitoring (`POLLRDHUP`):
  ```cpp
  if (c->ch && (s & 0x3FF) == 0 && std::chrono::steady_clock::now() - c->last_active > RDMA_SPIN_TIME) {
      if (ibv_req_notify_cq(cq, 0) != 0) return false;
      armed = true;
      continue;
  }
  ```
* **Lesson**: Formulated as a crucial refinement to **Rule 11**: High-performance network and IPC polling must use adaptive hybrid spinning with deferred event sleeping rather than infinite busy-loops or pure blocking waits.
* **Promotion Decision**: Refinement to **Rule 11** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 12: Silent `uint64` Multiplication Wraparound & Unbounded Deserialization in Binary Parser (`BUG-LLAMA-12`)
* **Context**: GGUF file format reader in `gguf-py/gguf/gguf_reader.py`.
* **What Was Expected**: Binary GGUF tensor headers are deserialized safely.
* **What Actually Happened**: The Python reader read `n_dims` without bounding against framework limits (`GGML_MAX_DIMS = 4`), allowing malicious files to trigger giant allocations. Additionally, computing total elements via `np.prod(dims)` on `uint64` arrays silently wrapped around on overflow! A crafted tensor with dimensions `[4194305, 4194305, 211106198978564]` mathematically overflows $2^{64}$, wrapping around to 4! The reader allocated an undersized 4-element buffer and passed the read through, permitting severe out-of-bounds corruption!
* **Evidence in Repo**:
  * Commit: `5788b510a` (PR [#25401](https://github.com/ggml-org/llama.cpp/pull/25401), Issue [#25378](https://github.com/ggml-org/llama.cpp/issues/25378)) — `gguf-py: validate n_dims and guard against uint64 overflow in reader`
  * Source: `gguf-py/gguf/gguf_reader.py#L266-L335`
  * Test: `gguf-py/tests/test_gguf_reader_validation.py`
* **Root Cause**: Naive fixed-width integer multiplication wrapping around silently on multi-dimensional products.
* **Remediation**: Validate `n_dims <= GGML_MAX_DIMS` and accumulate element products using arbitrary-precision Python integers:
  ```python
  if n_dims[0] > GGML_MAX_DIMS:
      raise ValueError(f'Tensor dimensions count {n_dims[0]} exceeds GGML_MAX_DIMS ({GGML_MAX_DIMS})')
  n_elems = 1
  for dim in dims.tolist():
      n_elems *= int(dim)
  ```

---

### Incident 13: Intra-Workgroup Read/Write Data Race & Padded OOB Access in GPU Bitonic Sort (`BUG-LLAMA-13`)
* **Context**: Vulkan compute shaders for Bitonic sorting in `ggml/src/ggml-vulkan/vulkan-shaders/argsort.comp`.
* **What Was Expected**: GPU Bitonic sorting shader permutes elements in-place without race conditions.
* **What Actually Happened**: In the inner comparison swap loop, threads evaluated `int idx_0 = (col & k) == 0 ? col : ixj; int idx_1 = (col & k) == 0 ? ixj : col;`. Both thread `col` and thread `ixj` read and wrote `dst_row[idx_0]` and `dst_row[idx_1]` concurrently in the same workgroup, creating a write-after-read data race! Additionally, accessing arrays padded to powers of 2 without bounds checks read unmapped memory out of bounds.
* **Evidence in Repo**:
  * Commit: `481c65f09` (PR [#28705](https://github.com/ggml-org/llama.cpp/pull/28705)) — `vulkan: fix data race and OOB access in argsort(large)`
  * Source: `ggml/src/ggml-vulkan/vulkan-shaders/argsort.comp#L33-L70`
* **Root Cause**: Missing directional condition guard (`if (ixj > col)`) before shared memory swap and unmasked power-of-two padding reads.
* **Remediation**: Guard the swap so only one thread of the pair executes the exchange (`if (ixj > col)`), and clamp padded reads to zero:
  ```glsl
  if (ixj > col) {
      // Execute pairwise comparison and swap
  }
  ```

---

### Incident 14: Degenerate / Empty Graph Early Return in Hardware Graph Capture (`BUG-LLAMA-14`)
* **Context**: Metal computation graph capture and execution in `ggml/src/ggml-metal/ggml-metal-context.m`.
* **What Was Expected**: Executing or capturing computation subgraphs on Apple Silicon Metal completes safely.
* **What Actually Happened**: When speculative decoding, prompt evaluation, or conditional graph evaluation produced an empty subgraph (`gf->n_nodes == 0`), `ggml_metal_graph_compute` proceeded to issue stream waits and configure Metal capture managers (`MTLCaptureManager`). This caused capture assertion failures and GPU synchronization overhead on zero-node graphs.
* **Evidence in Repo**:
  * Commit: `84e76d8a2` (PR [#29390](https://github.com/ggml-org/llama.cpp/pull/29390)) — `metal : fix graph capture and handle empty graphs`
  * Source: `ggml/src/ggml-metal/ggml-metal-context.m#L477-L545`
* **Root Cause**: Graph capture engines assuming all computation graphs contain at least one node.
* **Remediation**: Check `gf->n_nodes == 0` at the very threshold of graph compute and return immediate success before initiating command queues or capture scopes:
  ```objc
  if (gf->n_nodes == 0) {
      return GGML_STATUS_SUCCESS;
  }
  ```

---

### Incident 15: Schema Constraint Graceful Degradation with Grammar Rule Rollback (`BUG-LLAMA-15`)
* **Context**: JSON schema to GBNF grammar conversion in `common/json-schema-to-grammar.cpp`.
* **What Was Expected**: Structured sampling grammars generated from JSON schema enforce constraints without crashing.
* **What Actually Happened**: Complex regex patterns containing features unsupported by GBNF (e.g. shorthand escapes `\w`, lookaheads, unanchored regexes) failed mid-conversion. The parser aborted or leaked partial grammar rules (e.g. orphan rule `root-0`), corrupting the grammar state machine.
* **Evidence in Repo**:
  * Commit: `dc64a1620` (PR [#26939](https://github.com/ggml-org/llama.cpp/pull/26939)) — `common : gracefully fallback on unsupported regex patterns in JSON schema`
  * Source: `common/json-schema-to-grammar.cpp#L465-L625`
  * Test: `tests/test-json-schema-to-grammar.cpp`
* **Root Cause**: Conflating recoverable feature mismatches with fatal syntax errors and failing to roll back partial rule definitions.
* **Remediation**: Distinguish `unsupported_pattern` from `invalid_pattern`. When an unsupported feature is detected, roll back partially emitted rules for that property (`_rules.resize(old_count)`) and gracefully degrade that property to an unconstrained string match (`string ::= "\"" char* "\""`).

---

### Incident 16: Device Capability Dynamic Probing for Heterogeneous Memory (`BUG-LLAMA-16`)
* **Context**: Unified memory and tensor memory mapping in `src/llama-model.cpp`.
* **What Was Expected**: Lazy tensor loading (`mmap`) operates automatically across all supported hardware platforms.
* **What Actually Happened**: Integrated GPUs (iGPUs), Apple Silicon unified memory, and specific hardware accelerators lack driver support for memory mapping (`mmap_support`). Enabling lazy loading by default on these devices caused driver crashes and initialization aborts.
* **Evidence in Repo**:
  * Commit: `f3f1a8f27` (PR [#28326](https://github.com/ggml-org/llama.cpp/pull/28326)) — `llama: disable lazy tensor loading by default on iGPUs`
  * Source: `src/llama-model.cpp#L1422-L1435`
* **Root Cause**: Assuming uniform OS/hardware capabilities across heterogeneous accelerator architectures.
* **Remediation**: Query device properties (`ggml_backend_dev_get_props`) dynamically. If any device reports `props.caps.mmap_support == false`, automatically downgrade `LLAMA_LAZY_MODE_AUTO` to `LLAMA_LAZY_MODE_OFF`.

---

## 3. Differential Brain Comparison Matrix

| Candidate Pattern | Category | Existing Brain Mapping | Promotion Action |
| :--- | :--- | :--- | :--- |
| Cached Graph Invalidation on Buffer Free | Net-New Reusable | None | **Rule 50** in `05_KNOWLEDGE` |
| By-Value Functor Capture for Stack Scalars | Net-New Reusable | None | **Rule 51** in `05_KNOWLEDGE` |
| Elimination of In-Place Radix Sort Aliasing | Net-New Reusable | None | **Rule 52** in `05_KNOWLEDGE` |
| Multi-Segment Asymmetric Head Splitting | Net-New Reusable | None | **Rule 53** in `05_KNOWLEDGE` |
| Include-Order PCH ABI Boundary Segregation | Net-New Reusable | None | **Rule 54** in `05_KNOWLEDGE` |
| GPU Thread-Block Barrier Scope Non-Divergence | Net-New Reusable | None | **Rule 55** in `05_KNOWLEDGE` |
| Centralized Scheduler Tick vs Peer Flags | Net-New Reusable | None | **Rule 56** in `05_KNOWLEDGE` |
| Pre-Terminal Token Stashing & Logit Replay | Net-New Reusable | None | **Rule 57** in `05_KNOWLEDGE` |
| 64-Bit Stride Promotion (`size_t nb`) | Refinement | Rule 5 (Defensive Boundary) | Append to **Rule 5** |
| Scoped RAII Memory Pool vs HashMap Cache | Refinement | Rule 2 (Cascade Cleanup) | Append to **Rule 2** |
| Adaptive Hybrid Busy-Spin with Event Sleep | Refinement | Rule 11 (Non-Blocking Handlers)| Append to **Rule 11** |
| Bitonic Sort Workgroup Directional Pairing | Domain Pattern | `03_SKILLS/high-performance` | Codified in Section 27 |
| Empty Graph Capture Early Return | Domain Pattern | `03_SKILLS/high-performance` | Codified in Section 28 |
| Heterogeneous Memory Probing (mmap) | Domain Pattern | `03_SKILLS/high-performance` | Codified in Section 29 |
| Schema Degradation with Rule Rollback | Domain Pattern | `03_SKILLS/high-performance` | Codified in Section 30 |
| Process-Preserving Exception Propagation | Domain Pattern | `03_SKILLS/high-performance` | Codified in Section 31 |
| Cross-Platform Unicode Path Normalization | Domain Pattern | `03_SKILLS/high-performance` | Codified in Section 32 |
