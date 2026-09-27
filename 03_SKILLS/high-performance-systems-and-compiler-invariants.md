# High-Performance Systems & Compiler Invariants Playbook

This skill codifies essential rules for high-performance computing, Python C-extensions, CUDA/GPU kernel development, dynamic compiler tracing, memory allocators, and cross-device synchronization.

---

## 1. Zero-Cost Telemetry & Diagnostic Gating

* **The Problem**: Diagnostic structures (such as leak detection registries, node-to-proxy maps, or execution step tracers) that are populated unconditionally will hold strong references to AST nodes, graphs, modules, and model weights.
* **The Rule**:
  1. Never populate global or module-level tracking dictionaries during normal runtime passes.
  2. Always gate population behind an explicit configuration check:
     ```python
     if config.enable_diagnostic_tracking:
         _GLOBAL_TRACKER[id(obj)] = obj.node
     ```
  3. Use localized, function-level lazy imports when referencing configuration modules inside tracing hooks to prevent circular module initialization deadlocks.

---

## 2. Multi-Device Null-Handle Context Switching

* **The Problem**: In GPU APIs (e.g. CUDA), default streams (stream 0) are represented by `nullptr`. Calling `streamSynchronize(nullptr)` synchronizes the default stream of the *calling thread's currently active device*, not necessarily the device that owns the allocated memory.
* **The Rule**:
  Whenever synchronizing, deallocating, or unmapping physical memory associated with a device handle, always establish the device context explicitly:
  ```cpp
  // C++ RAII Device Guard
  cuda::CUDAGuard device_guard(segment.device_id());
  if (stream) {
      cudaStreamSynchronize(*stream);
  } else {
      cudaDeviceSynchronize();
  }
  ```

---

## 3. Copy-On-Write (COW) Zero-Copy Integrity

* **The Problem**: Invoking `data_ptr()` on a Copy-On-Write or lazy shared tensor triggers immediate de-virtualization and deep-copying of the buffer, even if the downstream kernel or BLAS call only performs read operations.
* **The Rule**:
  In native operator wrappers and C++ dispatches:
  1. Default to `const_data_ptr()` for all input tensors and matrix views that are read-only.
  2. Reserve `data_ptr()` exclusively for mutable destination outputs or explicit in-place operations.

---

## 4. 64-Bit Promotion at First Multiply for Multi-Dimensional Stride Arithmetic

* **The Problem**: Intermediate products of 32-bit dimension variables (e.g., $B \times R \times M$) can exceed $2^{31}-1$ even when each individual parameter is small ($< 10^5$). In 32-bit signed math, the product overflows and wraps negative, bypassing non-negative bounds checks and corrupting memory.
* **The Rule**:
  In CUDA kernels and C++ stride calculators:
  ```cpp
  // BAD: Multiplies in 32-bit int before storing in 64-bit int
  int64_t offset = (blockIdx.y * gridDim.z + blockIdx.z) * blockDim.y + threadIdx.y;

  // GOOD: Casts to int64_t at the very first multiplication
  int64_t offset = (static_cast<int64_t>(blockIdx.y) * gridDim.z + blockIdx.z) * blockDim.y + threadIdx.y;
  ```

---

## 5. Non-Suppressed Semantic Assertions (Anti-S101 & NaN Safety)

* **The Problem**: `assert` statements are stripped in Python when running with optimization flags (`python -O`). Suppressing linters with `# noqa: S101` creates silent production bugs. Furthermore, inverting float comparisons (`assert a < b` -> `if a >= b`) fails on `NaN`.
* **The Rule**:
  1. Write explicit exceptions instead of bare `assert`:
     ```python
     if not isinstance(x, ExpectedType):
         raise AssertionError(f"Expected ExpectedType, got {type(x).__name__}")
     ```
  2. For float comparisons, wrap the original condition in `not (...)` to preserve IEEE-754 NaN handling:
     ```python
     # Correct NaN-safe check:
     if not (val < threshold):
         raise AssertionError(f"val must be strictly less than {threshold}, got {val}")
     ```

---

## 6. Self-Referential Cycle Elimination in Destroy Hooks

* **The Problem**: Registering a destroy callback or finalizer lambda that captures `self` binds `self` to its own lifecycle cleaner, creating an uncollectable cycle that leaks GPU memory, graphs, and persistent handles.
* **The Rule**:
  Capture only detached ID sets, handle values, or weak references in finalizer closures:
  ```python
  # BAD: Captures self
  self.register_destroy_callback(lambda: cleanup(self._ids))

  # GOOD: Captures mutable id set, never self
  ids = self._ids
  self.register_destroy_callback(lambda: cleanup(ids))
  ```

---

## 7. Exact-Extent Virtual Address Space Sizing

* **The Problem**: Applying speculative growth sizing ($1\frac{1}{8} \times \text{VRAM}$) to non-growable IPC segments or shared imported buffers exhausts the 128 TiB virtual memory space.
* **The Rule**:
  For imported, external, or immutable shared buffers, reserve address space strictly matching the producer's exact shared handle count:
  $$\text{ReserveBytes} = \text{shared\_handles} \times \text{segment\_size}$$
