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

---

## 8. Workload-Segregated Thread Pool Isolation

* **The Problem**: Sharing a single thread pool across dependent pipeline stages (e.g. compilation, dispatch, D2H/H2D I/O transfer) causes deadlocks and starvation when multi-device collective kernels fill all workers and block waiting for input transfers stuck in the same pool queue.
* **The Rule**:
  In high-performance runtimes and async executors (such as PJRT / XLA), separate workloads into bounded, dedicated thread pools:
  ```cpp
  compile_thread_pool_ = std::make_unique<ThreadPool>("XLACompile", num_threads);
  execute_work_runner_ = std::make_unique<ThreadPoolAsyncWorkRunner>("XLAExecute", num_threads);
  async_work_runner_   = std::make_unique<ThreadPoolAsyncWorkRunner>("XLATransfers", num_threads);
  ```

---

## 9. Asynchronous Buffer Liveness Extension Across Start/Done Barriers

* **The Problem**: In optimizing compilers and buffer assignment allocators, ending buffer live ranges at synchronous scheduling points rather than asynchronous completion barriers (`async-done`) allows allocators to recycle active scratch buffers for parallel tasks, causing silent data corruption.
* **The Rule**:
  Extend buffer liveness explicitly across the entire asynchronous execution window:
  - `start_time = min(first_bound_callers)`
  - `end_time = async_done_time`
  Intermediate allocations must remain locked until the async completion barrier retires.

---

## 10. Stream Capture Synchronization Deferral Queueing

* **The Problem**: Invoking operations that perform context synchronization (such as `cuMemUnmap`, `cuCtxSynchronize`) while a CUDA stream is actively being captured into a CUDA Graph triggers `CUDA_ERROR_STREAM_CAPTURE_UNSUPPORTED` and invalidates the capture.
* **The Rule**:
  Track active stream capture sessions (`active_stream_captures`). When active:
  ```cpp
  if (state->active_stream_captures > 0) {
      state->pending_deallocations.push_back({ptr, size, handle});
  } else {
      DrainPendingVmmDeallocations(executor, state);
  }
  ```
  Drain and free queued deallocations only after the capture session exits.

---

## 11. Python 3.13+ Free-Threading (No-GIL) Critical Section Guards

* **The Problem**: Under Python 3.13+ Free-Threading (`Py_GIL_DISABLED`), reading or mutating Python object attributes from C extensions without the GIL causes concurrent data races.
* **The Rule**:
  In C/C++ Python extension bindings, protect object attribute accesses with `Py_BEGIN_CRITICAL_SECTION`:
  ```cpp
  #ifdef Py_GIL_DISABLED
  Py_BEGIN_CRITICAL_SECTION(handle.ptr());
  res = data->shape_val;
  Py_END_CRITICAL_SECTION();
  return res;
  #else
  return data->shape_val;
  #endif
  ```

---

## 12. Zero-Sized Input Early-Return Guards for GPU / cuDNN Kernels

* **The Problem**: Vendor libraries (cuDNN, cuBLAS) and GPU kernel launch configurations crash with illegal memory accesses or hardware traps when invoked on zero-element inputs.
* **The Rule**:
  Place an early-return guard before kernel launching:
  ```cpp
  if (in.NumElements() == 0) {
      return;
  }
  LaunchGPUKernel(in, output);
  ```

---

## 13. Volatile TOCTOU Buffer Copy (`SubtleMustCopy`) in Multi-Threaded Kernels

* **The Problem**: In multi-threaded execution where memory is shared, reading scalar parameters directly from shared tensor buffers allows Time-of-Check to Time-of-Use (TOCTOU) race conditions if another thread mutates the shared buffer after boundary validation.
* **The Rule**:
  Force a copy through a volatile pointer directly to a stack variable before validation and use:
  ```cpp
  const int64_t num_segments_val = static_cast<int64_t>(
      internal::SubtleMustCopy(num_segments.scalar<int32_t>()()));
  OP_REQUIRES(context, num_segments_val >= 0, ...);
  ```
  Ensure casts are positioned *outside* the volatile copy helper so it binds directly to the memory address rather than a compiler temporary.

---

## 14. 32-Bit Length Field Chunking for Legacy C Interfaces (e.g. zlib)

* **The Problem**: C libraries (such as `zlib`) with 32-bit integer length fields (`uInt avail_in`) silently truncate input sizes modulo $2^{32}$ when passed payloads larger than 4 GiB, corrupting compressed data.
* **The Rule**:
  When interfacing with 32-bit C APIs from 64-bit systems, slice streaming payloads into chunks bounded by `std::numeric_limits<uInt>::max()`:
  ```cpp
  while (bytes_deflated < bytes_to_write) {
      const uInt chunk = static_cast<uInt>(std::min<size_t>(
          bytes_to_write - bytes_deflated, std::numeric_limits<uInt>::max()));
      z_stream->next_in = data + bytes_deflated;
      z_stream->avail_in = chunk;
      Deflate();
      bytes_deflated += chunk;
  }
  ```

---

## 15. PyTorch Dynamo / JIT Tracing Guard Decoupling

* **The Problem**: Checking tensor values (e.g. `padding_mask.all()`) during compilation causes dynamic control-flow graph breaks under `torch.compile`. Conflating compiler tracing with strict export tracing forces JIT engines to materialize unnecessary multi-megabyte masks on every forward pass.
* **The Rule**:
  Decouple static reference presence checks from data-dependent tensor inspections:
  ```python
  # Under torch.compile we can skip mask creation if padding_mask is None
  # Data-dependent value checks are only executed when NOT compiling/tracing
  if is_torchdynamo_exporting() or (padding_mask is not None and is_tracing(padding_mask)):
      return False
  ```
  Only materialize masks when data-dependent padding is statically indicated.

---

## 16. Checkpoint Deserialization on OS Memory-Commit Boundaries (Windows & MPS)

* **The Problem**: Memory-mapping (`mmap`) multi-shard checkpoints (tens to hundreds of gigabytes) on Windows reserves copy-on-write pagefile commit charge for the full mapped extent, triggering immediate `WinError 1455` (out of virtual memory commit) even on machines with plenty of physical RAM. Additionally, Apple Silicon Metal (MPS) device buffers do not support shared `mmap` backing.
* **The Rule**:
  Inspect platform and accelerator targets and dynamically select sequential/positioned file reads (`pread`) on commit-charge sensitive or non-mmap platforms:
  ```python
  if is_mps:
      backend, device = "pread", "mps"
  elif sys.platform == "win32":
      backend, device = "pread", "cpu"
  else:
      backend, device = "mmap", "cpu"
  file_pointer = safe_open(file, framework="pt", device=device, backend=backend)
  ```

---

## 17. Symlink-Preserving Lexical Containment for Distributed Storage Caches

* **The Problem**: Validating path traversal (`..` escapes) using `os.path.realpath` or `Path.resolve` breaks repositories that utilize symlinks to external blob stores (such as Hugging Face Hub cache where `snapshots/<hash>/model.safetensors` symlinks into sibling `blobs/<sha256>`). Dereferencing realpaths resolves outside the snapshot directory.
* **The Rule**:
  Use purely lexical path normalization combined with common prefix containment:
  ```python
  absolute_base_dir = os.path.abspath(base_dir)
  absolute_archive_file = os.path.abspath(archive_file)
  contained = os.path.commonpath([absolute_base_dir, absolute_archive_file]) == absolute_base_dir
  if not contained:
      raise ValueError(f"Path traversal detected: {archive_file} escapes {base_dir}")
  ```

---

## 18. Additive Logit Mask Degeneracy Clamping

* **The Problem**: When enforcing constrained token generation via additive penalties (`scores + mask` where disallowed tokens are `-inf`), if upstream filters or model logits have already set all allowed tokens to `-inf`, `(-inf) + 0 = -inf`. The entire sequence distribution collapses to `-inf`, causing greedy search to pick illegal tokens, sampling to produce `NaN`s, and beam search to collapse.
* **The Rule**:
  Detect total domain annihilation across the distribution row and fall back directly to the constraint mask:
  ```python
  scores_processed = scores + mask
  unsatisfiable = scores_processed.amax(dim=-1).isneginf().view(batch_size, -1).all(dim=-1, keepdim=True)
  scores_processed = torch.where(unsatisfiable.repeat_interleave(num_beams, dim=0), mask, scores_processed)
  ```

---

## 19. Test Session Heavy Allocation Sweeping (Pytest Memory Leaks)

* **The Problem**: Test runners like Pytest retain test instance fixtures (`self`) across the entire test session. Attributes attached to `self` or `cls` (e.g. 10–17 GB model checkpoints, `@cached_property` caches) cannot be freed by `gc.collect()`, producing cascading OOM crashes across subsequent tests.
* **The Rule**:
  Snapshot class and instance namespaces during setup, sweep/`delattr()` all newly created attributes at teardown, run methods under `torch.no_grad()`, and enforce memory leak assertions:
  ```python
  class MemoryCleanupMixin:
      def __init_subclass__(cls, **kwargs):
          super().__init_subclass__(**kwargs)
          cls._memory_cleanup_class_attrs = set(vars(cls))

      def setUp(self):
          super().setUp()
          self._memory_cleanup_instance_attrs = set(vars(self))

      def tearDown(self):
          try:
              super().tearDown()
          finally:
              known = getattr(self, "_memory_cleanup_instance_attrs", None)
              if known is not None:
                  for name in list(vars(self)):
                      if name not in known:
                          try: delattr(self, name)
                          except AttributeError: pass
              cleanup(torch_device, gc_collect=True)
  ```

---

## 20. Model State-Dict Key Reconciliation and Prefix Namespace Invariants

* **The Problem**: In neural network libraries where layers initialize with random weights and missing keys are non-fatal warnings, prefix mismatches (e.g. `model.` vs flat layer names) cause 100% of checkpoint weights to fail to bind. Silencing missing key errors in tests (`test_missing_keys = False`) causes models to evaluate pure Gaussian random noise without throwing any runtime errors.
* **The Rule**:
  Never silence missing-key assertions without explicit prefix transformations. Always assert exact key reconciliation:
  ```python
  base_model, loading_info = Model.from_pretrained(checkpoint, output_loading_info=True)
  assert not loading_info["missing_keys"], f"Unbound weights detected: {loading_info['missing_keys']}"
  ```

---

## 21. Asynchronous Stream Memory Recycling Race Condition Defense

* **The Problem**: Host code dropping device tensor references returns their physical device memory to the framework caching allocator while an asynchronous compute stream is still executing. The caching allocator immediately reuses that device memory for the next layer or onload, overwriting weights mid-kernel and generating NaNs.
* **The Rule**:
  Synchronize the active compute stream before dropping tensor references on the host unless the allocator supports stream recording:
  ```python
  if self.stream is not None and not self.record_stream:
      self._torch_accelerator_module.current_stream().synchronize()
  ```

---

## 22. Preempting Device-to-Host (DtoH) Synchronizations in Compiled Iterative Loops

* **The Problem**: Calling `.item()` or extracting nonzero indices from device-resident tensors inside iterative generation loops (e.g. `(timesteps == t).nonzero().item()`) triggers synchronous DtoH memory copies. Under `torch.compile` / CUDA Graph capture, this crashes capture or creates catastrophic GPU pipeline stalls.
* **The Rule**:
  Pre-bind loop step counters on the host before entering the execution loop:
  ```python
  # Set index on host to completely avoid GPU-to-CPU synchronization barriers
  self.scheduler.set_begin_index(0)
  ```

---

## 23. Preventing In-Place Shared Model Downcasting in Mixed-Precision Training

* **The Problem**: Validation pipelines instantiated using live training model instances downcast trainable FP32 parameters to FP16 when calling `pipeline.to(device, dtype=torch.float16)`. Resuming training produces FP16 gradients, crashing PyTorch AMP `GradScaler.unscale_`.
* **The Rule**:
  Move shared pipelines using device-only placement without specifying `dtype`, and run validation passes inside scoped autocast contexts:
  ```python
  # Move device only; preserve master FP32 weights for optimizer AMP GradScaler
  pipeline = pipeline.to(accelerator.device)
  with torch.autocast(device_type=accelerator.device.type, dtype=torch_dtype):
      images = pipeline(prompt).images
  ```

---

## 24. Pre-PEP 709 Python Comprehension Frame Isolation and `locals()` Safety

* **The Problem**: In Python < 3.12, comprehensions execute in their own isolated function frame. Calling `locals()` inside a dict comprehension (e.g. `{k: locals()[k] for k in fields}`) inspects only the comprehension's scope, failing to see enclosing variables and raising `KeyError`.
* **The Rule**:
  Never query `locals()` inside comprehensions. Use an explicit, imperative `for` loop in the outer frame:
  ```python
  callback_kwargs = {}
  for k in callback_on_step_end_tensor_inputs:
      callback_kwargs[k] = locals()[k]
  ```

---

## 25. Context-Parallel Ring Attention Backward Autograd State Reconciliation

* **The Problem**: In distributed sequence parallelism (Ring CP), autograd functions run under `no_grad()` on intermediate inputs, causing forward ops to skip LSE computation (`compute_log_sumexp=False`). In the backward pass, executing every ring step against iteration-0 saved tensors produces silently corrupt gradients with zero runtime errors.
* **The Rule**:
  Force LSE computation whenever distributed context parallelism is enabled (`compute_log_sumexp = return_lse or grad_enabled or cp_enabled`), save tensors in model layout, and dynamically override Q, K, V, Out, and LSE per ring iteration:
  ```python
  out = out if out is not None else saved_out
  lse = lse if lse is not None else saved_lse
  ```

---

## 26. JIT Dynamic Shape Tracing & Symbolic Duck-Shaping De-conflation

* **The Problem**: When compiling models with dynamic inputs, if two distinct dimensions happen to share the same integer value in an initial trace (e.g. $4 \times 4 = 16$ and $C=16$), compiler duck-shaping assigns them the same symbolic variable. Specializing one dimension subsequently locks the other, triggering `RecompileError` when new resolutions arrive.
* **The Rule**:
  Explicitly disable coincidental integer duck-shaping during dynamic compilation:
  ```python
  torch.fx.experimental._config.use_duck_shape = False
  ```



