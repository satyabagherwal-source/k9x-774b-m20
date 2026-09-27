# Project Learning Record — pytorch (Full-Spectrum Harvest)

This document records the empirical project learnings, forensic defect investigations, and architectural invariant extractions derived from the **PyTorch** repository (`c:\Users\Admin\pytourch\pytorch` — Official PyTorch: C10 Runtime, ATen Tensor Kernels, Torch Dynamo/Inductor Compilers, CUDA Caching Allocator, Autograd Engine, and Distributed Systems).

---

## 1. Executive Summary & Verification Coverage

* **Project**: `pytorch/pytorch` (The foundational deep learning and tensor compiler framework)
* **Harvest Scope**: Full-Spectrum Multi-Dimensional Harvest across all 8 Dimensions (D1–D8).
* **Total Confirmed Real Incidents Analyzed**: 7 Production Defect Fixes & Architectural Invariants
* **Promoted Reusable Engineering Patterns**:
  * **Rule 23**: Telemetry & Diagnostic Retention Gating (Preventing Global Node Pinning)
  * **Rule 24**: Device-Context Affined Synchronization for Polymorphic Null Handles
  * **Rule 25**: Read-Only Const-Data Pointer Preservation for Copy-On-Write (COW) Invariants
  * **Rule 26**: 64-Bit Promotion at First Multiply for Multi-Dimensional Stride Arithmetic
  * **Rule 27**: Semantic Assertion Preservation over Optimization-Vulnerable Primitives (Anti-S101 & NaN Awareness)
  * **Rule 28**: Exact-Extent Virtual Address Space Reservation for Immutable Imported Buffers
  * **Rule 2 Refinement**: Self-Referential Cycle Elimination in Object Destroy Hooks & Finalizers
* **Domain-Specific Patterns Retained in Learning Record**:
  * Dynamic Guard Source Path Lookup Isolation (`on_error` callbacks during recompile checks)
  * Cache Wrapper Replacement on Invalidation under Concurrent Misses (`_CachedResolver`)
  * Hardware Memory Barrier (`mbarrier`) Polling Spin-Loops & TMA Non-Aliasing Isolation
  * Non-Paging CI Matrix Status Queries (`gh pr checks`)
* **Excluded / Discarded Candidates**:
  * Meta-internal CI infrastructure specifics (`[OSDC]`, `Metamates merge rule`)
  * Pinned submodule hash bumps (`pinned audio hash`, `torchtitan hash update`)
  * Hardware-specific micro-benchmark tuning numbers without architectural invariants

---

## 2. Forensic Incident & Learning Records

### Incident 1: Unconditional Debug Map Population Leaking 268 MB Per Compile (`BUG-TORCH-01`)
* **Context**: `_ModuleStackTracer` in `torch.fx.experimental.proxy_tensor` tracking fake tensors during Ahead-of-Time (AOT) inductor compilation.
* **What Was Expected**: Debug maps for detecting non-strict fake tensor leaks should track graph nodes only when the debug configuration (`detect_non_strict_fake_tensor_leaks`) is explicitly enabled.
* **What Actually Happened**: The tracer populated the global module dictionary `_FAKE_TENSOR_ID_TO_PROXY_MAP_FOR_EXPORT` on every trace unconditionally. Storing `val.proxy.node` in the global dictionary pinned the AST `Node`, which pinned the entire `Graph`, which pinned the owning `Module`, which pinned all model weights/parameters in memory for the life of the process. In a modest model (8 x 4096 Linear layers), this leaked 268.5 MB per compile, accumulating without bound across repeated compilations.
* **Evidence in Repo**:
  * Commit: `4aefab0c58c` (PR [#198295](https://github.com/pytorch/pytorch/pull/198295)) — `[Lowering Memory] Don't retain the traced graph in the export leak-detection map`
  * Source: `torch/fx/experimental/proxy_tensor.py#L2777-L2795`
  * Tests: `test/inductor/test_aot_inductor_memory.py` (`ExportLeakDetectionMapTest`, `AOTInductorMemoryTest`)
* **Root Cause**: Diagnostic telemetry maps held strong references to heavy runtime structures without checking if any consumer was active.
* **Remediation**: Explicitly gate map population behind `if _export_config.detect_non_strict_fake_tensor_leaks:`, and use lazy inside-function imports to break cyclic module imports.
* **Lesson**: *Telemetry & Diagnostic Retention Gating*. Diagnostic collections must be gated strictly on active debug flags. Storing runtime entity references in unguarded global structures pins entire resource graphs indefinitely.
* **Promotion Decision**: Promoted as **Rule 23** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 2: Cross-Device Stream 0 Null-Handle Disambiguation Failure (`BUG-TORCH-02`)
* **Context**: `ExpandableSegment` in `c10/cuda/CUDACachingAllocator.cpp` releasing and unmapping memory pages across devices during `empty_cache()`.
* **What Was Expected**: Releasing cached memory segments owned by Device 1 should synchronize work on Device 1 before unmapping physical memory.
* **What Actually Happened**: CUDA stream 0 is represented by a null handle (`nullptr`). The same `nullptr` value represents stream 0 across all physical devices. When a caller executing on Device 0 called `empty_cache()`, the allocator unmapped segments owned by Device 1. Because it called `cudaStreamSynchronize(*stream_)` (where `*stream_ == nullptr`) without first switching the thread's active device to Device 1, the driver synchronized Device 0's stream 0 instead! Device 1's memory was unmapped while Device 1 kernels were still actively computing on it, causing corrupted outputs or GPU crashes.
* **Evidence in Repo**:
  * Commit: `3fda5993c25` (PR [#197159](https://github.com/pytorch/pytorch/pull/197159)) — `[CUDA] Synchronize expandable segment unmaps on their owning device`
  * Source: `c10/cuda/CUDACachingAllocator.cpp#L1013-L1022`
  * Tests: `test/test_cuda.py#L6644-L6700` (`test_expandable_segments_empty_cache_wrong_device`)
* **Root Cause**: Polymorphic null handle ambiguity across multi-device hardware execution contexts.
* **Remediation**: Always instantiate an explicit RAII device guard (`cuda::CUDAGuard device_guard(device_)`) before issuing device or stream synchronization for an owned resource.
* **Lesson**: *Device-Context Affined Synchronization for Polymorphic Null Handles*. When null handles represent device-local default streams, synchronization routines must bind explicitly to the owning device context.
* **Promotion Decision**: Promoted as **Rule 24** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 3: Mutable Data Pointer Invocations Breaking Copy-On-Write (COW) Semantics (`BUG-TORCH-03`)
* **Context**: OneDNN / MKLDNN matrix multiplication (`addmm`, `rmatmul`, Cholesky solver) in `aten/src/ATen/native/mkldnn/Matmul.cpp`.
* **What Was Expected**: Computing matrix multiplication over read-only input tensors should not mutate or allocate extra copies of shared input buffers.
* **What Actually Happened**: The tensor view conversion helper `itensor_view_from_dense(mat1_)` defaulted to requesting a mutable data pointer (`mat1_.data_ptr()`). In PyTorch's Copy-On-Write (COW) architecture, calling `data_ptr()` on a shared, read-only tensor forces immediate de-virtualization and deep copying of the buffer to protect against potential mutation, even though the downstream BLAS kernel only performs read operations (`const ideep::tensor x`).
* **Evidence in Repo**:
  * Commit: `33fcafb5606` (PR [#198625](https://github.com/pytorch/pytorch/pull/198625)) — `Fix to make AddMM, rmatmul & Cholesky Inverse/Solve on aarch64 preserve COW input tensor`
  * Source: `aten/src/ATen/native/mkldnn/Matmul.cpp#L418-L425`
  * Tests: `torch/testing/_internal/opinfo/definitions/linalg.py` (`test_cow_input`)
* **Root Cause**: Inadvertent invocation of mutable data accessors on read-only shared buffers.
* **Remediation**: Pass `from_const_data_ptr: true` (`mat.const_data_ptr()`) to native view constructors, ensuring zero-copy read-only operations preserve COW invariants without memory materialization.
* **Lesson**: *Read-Only Const-Data Pointer Preservation for Copy-On-Write Invariants*. In zero-copy or COW architectures, read-only dispatchers must strictly invoke const pointer accessors.
* **Promotion Decision**: Promoted as **Rule 25** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 4: 32-Bit Integer Index Wrap Causing Out-of-Bounds CUDA Memory Access (`BUG-TORCH-04`)
* **Context**: High-dimensional pairwise distance backward kernel in `aten/src/ATen/native/cuda/DistanceKernel.cu`.
* **What Was Expected**: Computing backward gradients for `torch.cdist(x1, x2, p=1)` on large batch sizes should reliably compute distance gradients without memory faults.
* **What Actually Happened**: The forward kernel computed index terms in 64-bit integers (`int64_t`), but the backward kernel computed thread indices and batch scratch buffer strides using 32-bit signed `int`: `int y = (blockIdx.y * gridDim.z + blockIdx.z) * blockDim.y + threadIdx.y;` and `int l_size = r_size * m;`. When $r_1 \times r_2 \times m \ge 2^{31}$ or total elements reached $2^{31}$, the 32-bit integer wrapped negative, bypassed the non-negative boundary guard (`y >= count`), and indexed before or past the allocated CUDA memory buffer, causing hard `CUDA error: an illegal memory access was encountered`.
* **Evidence in Repo**:
  * Commit: `d5b1941b02d` (PR [#198452](https://github.com/pytorch/pytorch/pull/198452)) — `Fix int32 overflow in cdist CUDA backward kernel`
  * Source: `aten/src/ATen/native/cuda/DistanceKernel.cu#L143-L158`
  * Tests: `test/test_torch.py#L4234-L4255` (`test_cdist_backward_large_index`)
* **Root Cause**: Stride and induction arithmetic using 32-bit signed integers in high-dimensional tensor kernels.
* **Remediation**: Cast block indices and dimension terms to `int64_t` at the very first multiplication step (`(static_cast<int64_t>(blockIdx.y) * gridDim.z + ...)`) before any multiplication occurs.
* **Lesson**: *64-Bit Promotion at First Multiply for Multi-Dimensional Stride Arithmetic*. Loop induction, thread coordinates, and grid stride arithmetic must be promoted to 64-bit at the initial multiplication.
* **Promotion Decision**: Promoted as **Rule 26** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 5: Linter Silence (`# noqa: S101`) Stripping Invariants under Optimized Python (`BUG-TORCH-05`)
* **Context**: PyTorch coding standards and runtime validation across compiler backends (`CLAUDE.md`).
* **What Was Expected**: Critical type and domain checks must execute consistently across all Python runtime environments.
* **What Actually Happened**: Engineers using automated linters (e.g. Ruff's S101 "Use of assert detected") were silencing the warning with `# noqa: S101`. However, Python's runtime optimization flag (`python -O`) completely strips all `assert` bytecode statements. Suppressing the linter left assertions that silently disappeared in production deployments, allowing invalid types and corrupted state to escalate into memory corruptions. Additionally, developers inverting float assertions (`assert a < b`) often wrote `if a >= b: raise ...`, which fails completely when `a` or `b` is `NaN`, because all comparisons with `NaN` evaluate to false!
* **Evidence in Repo**:
  * Policy: `c:\Users\Admin\pytourch\pytorch\CLAUDE.md#L79-L105` (`Never silence S101 with a noqa`)
* **Root Cause**: Relying on bytecode instructions that are removed under optimization, combined with improper inversion of floating-point comparison semantics.
* **Remediation**: Explicitly rewrite assertions as `if not condition: raise AssertionError(...)`. Strictly preserve `not (a < b)` rather than inverting to `>=` when floats are involved.
* **Lesson**: *Semantic Assertion Preservation over Optimization-Vulnerable Primitives*. Do not use bare asserts or silence linters for critical invariants. Use explicit exceptions and NaN-safe conditionals.
* **Promotion Decision**: Promoted as **Rule 27** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 6: Speculative Growth Headroom on Imported Memory Stranding 128 TiB Virtual Address Space (`BUG-TORCH-06`)
* **Context**: Inter-process memory sharing (`fromShared` / IPC) in `c10/cuda/CUDACachingAllocator.cpp`.
* **What Was Expected**: Importing an expandable memory segment from another process should map the shared GPU memory buffers without exhausting system virtual address (VA) space.
* **What Actually Happened**: The allocator's `ExpandableSegment` constructor reserved address space sized to $1\frac{1}{8}$ of the entire GPU physical memory (to allow for future dynamic growth). However, IPC-imported segments are fixed at the producer's exact handle count and cannot grow dynamically. Reserving full device growth headroom on each imported segment stranded gigabytes of virtual address space apiece, causing the entire 128 TiB user virtual address space to be completely exhausted after only a few hundred IPC transfers.
* **Evidence in Repo**:
  * Commit: `f7ab0d03f45` (PR [#198129](https://github.com/pytorch/pytorch/pull/198129)) — `Reserve only the shared extent when importing an expandable segment`
  * Source: `c10/cuda/CUDACachingAllocator.cpp#L420-L485`, `L779-L788`
  * Tests: `c10/cuda/test/impl/CUDACachingAllocatorIpcReserveTest.cpp` (`ImportReservesOnlyWhatWasShared`)
* **Root Cause**: Applying speculative dynamic growth sizing to non-growable, immutable imported handles.
* **Remediation**: Pass `imported_handles: header.num_handles` from `fromShared()` and cap address reservation to the exact shared extent ($N \times \text{segment\_size}$).
* **Lesson**: *Exact-Extent Virtual Address Space Reservation for Immutable Imported Buffers*. Non-growable or external shared buffers must reserve only their exact extent, never speculative device-scale headroom.
* **Promotion Decision**: Promoted as **Rule 28** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 7: Strong Cycle Memory Leaks via `self` Captures in Destroy Callbacks & Finalizers (`BUG-TORCH-07`)
* **Context**: `CUDAGraph` execution tracking and profiler observer registries in `torch/cuda/graphs.py` and `torch/profiler/_cuspy/observers/base.py`.
* **What Was Expected**: Destroy callbacks registered with CUDA graph finalizers should purge annotation registries when graphs are garbage-collected without preventing the graph from being reclaimed.
* **What Actually Happened**: Destroy callbacks registered closures that referenced `self` (`self.register_destroy_callback(lambda: _run_graph_destroy_hooks(self._recorded_exec_ids))`). In Python, capturing `self` inside a finalizer or object destroy callback creates an uncollectable circular reference between the object and its own finalizer registry, preventing the garbage collector from freeing the graph and its associated CUDA allocations.
* **Evidence in Repo**:
  * Commit: `fdbb719fcef` (PR [#198418](https://github.com/pytorch/pytorch/pull/198418)) — `[CUDA] Make graphs own annotation registry cleanup`
  * Source: `torch/cuda/graphs.py#L550-L575`, `torch/profiler/_cuspy/observers/base.py#L70-L84`
* **Root Cause**: Binding `self` in cleanup closures registered on object destruction.
* **Remediation**: Extract the mutable ID set by reference (`graph_ids = self._recorded_exec_ids`) and bind only the ID set inside the closure, never `self`. In addition, create `_CachedResolver` to swap the underlying cache wrapper on invalidation, ensuring in-flight misses populate retired caches rather than revived ones.
* **Lesson**: *Self-Referential Cycle Elimination in Object Destroy Hooks & Finalizers*. Finalizers and destruction hooks must close over identifier collections, never the owning instance.
* **Promotion Decision**: Promoted as a refinement to **Rule 2** in `05_KNOWLEDGE/engineering-patterns.md`.

---

## 3. Promoted Engineering Patterns Mapping

| Pattern Number | Engineering Pattern Name | Primary Destination |
|---|---|---|
| **Rule 23** | **Telemetry & Diagnostic Retention Gating** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 24** | **Device-Context Affined Synchronization for Polymorphic Null Handles** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 25** | **Read-Only Const-Data Pointer Preservation for Copy-On-Write Invariants** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 26** | **64-Bit Promotion at First Multiply for Multi-Dimensional Stride Arithmetic** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 27** | **Semantic Assertion Preservation over Optimization-Vulnerable Primitives** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 28** | **Exact-Extent Virtual Address Space Reservation for Immutable Imported Buffers** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Refinement to Rule 2** | **Self-Referential Cycle Elimination in Object Destroy Hooks & Finalizers** | `05_KNOWLEDGE/engineering-patterns.md` |

---

## 4. Multi-Dimensional Investigation Summary (D1–D8)

* **D1 (Architecture & System Boundaries)**: AOT lowering memory analysis (`4aefab0c58c`) proved that diagnostic instrumentation maps must never be populated unless diagnostic consumers are active.
* **D2 (Asynchronous State, Concurrency & Parallel Execution)**: Multi-device stream synchronization (`3fda5993c25`) established that polymorphic null handles (e.g. stream 0) require explicit execution device context guards before synchronization.
* **D3 (Error Boundaries, Resiliency & Recovery)**: Dynamic compiler guard evaluation (`51a2cca1483`) established that changes in object structures must be isolated via explicit `on_error` callbacks rather than crashing recompile checks.
* **D4 (Resource Lifecycle, Memory Management & Cleanup)**: Graph finalizers (`fdbb719fcef`) and IPC expandable segments (`f7ab0d03f45`) established cycle-free finalizer closures and exact-extent VA reservations.
* **D5 (Deserialization, Type Safety & Encoding Boundaries)**: MKLDNN tensor view dispatches (`33fcafb5606`) proved that read-only accessors must invoke `const_data_ptr()` to prevent breaking Copy-On-Write zero-copy invariants.
* **D6 (Cross-Platform, OS & Hardware/Runtime Invariants)**: CUDA PTX memory barrier instructions (`CLAUDE.md#L323-L344`) require non-blocking polling loops and physical separation between synchronization barriers and asynchronous TMA transfer memory.
* **D7 (Build, CI/CD, Metaprogramming & Tooling Infrastructure)**: Type stub generator templates (`.pyi.in`) and non-paginated CI status queries (`gh pr checks`) prevent developer drift and false-green CI matrix reports.
* **D8 (Forensic Bug Fixes, Security & Invariant Defenses)**: 64-bit promotion in GPU distance kernels (`d5b1941b02d`) eliminates integer overflow and illegal memory access on large tensors.
