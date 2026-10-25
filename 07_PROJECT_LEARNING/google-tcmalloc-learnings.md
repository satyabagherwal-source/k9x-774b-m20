> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/google-tcmalloc-learnings.md`  
> **Source**: github ([https://github.com/google/tcmalloc](https://github.com/google/tcmalloc))  
> **Source Version**: `de96aa9f`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T06:25:21.122Z  
> **Learning ID**: `learn-github-google-tcmalloc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): google/tcmalloc

---

## 1. Executive Forensic Architecture & System Mechanics

TCMalloc (Thread-Caching Malloc) is a high-performance, concurrent, scale-invariant memory allocator designed to eliminate multi-threaded synchronization contention in modern C/C++ applications while optimizing virtual memory footprint and hardware cache line utilization.

```
+---------------------------------------------------------------------------------------------------+
|                                        APPLICATION LAYER                                          |
|  malloc() / free() / operator new() / operator delete() / sized delete / aligned_alloc            |
+---------------------------------------------------------------------------------------------------+
                                            |
       +------------------------------------+-----------------------------------+
       | Fast Path (Per-CPU / Per-Thread Cache)                                  | Sampling / GWP-ASan
       v                                                                        v
+-------------------------------+                                      +--------------------+
|  Per-CPU Slab / ThreadCache   |<--- RSEQ / TLS Fast Allocation       | GWP-ASan Guarded   |
|  (Size-Class Segregated Freelists)                                   | Allocations        |
+-------------------------------+                                      +--------------------+
       | Underflow / Overflow
       v
+---------------------------------------------------------------------------------------------------+
|                                     CENTRAL FREELIST (CFL)                                        |
|  Thread-safe, fine-grained spinlocked size-class free lists, Span batching, hook dispatch        |
+---------------------------------------------------------------------------------------------------+
       | Fetch / Return Spans
       v
+---------------------------------------------------------------------------------------------------+
|                                         PAGE ALLOCATOR                                            |
|  PageMap (Radix Tree / Array tracking PageId -> Span mappings, BITS-constrained virtual space)    |
|  Huge Page Filler / Page Heap (Manages 2MB/1GB hugepages, cold memory subreleases)                |
+---------------------------------------------------------------------------------------------------+
       | System Syscalls
       v
+---------------------------------------------------------------------------------------------------+
|                       OPERATING SYSTEM VIRTUAL MEMORY (mmap / madvise / mincore)                  |
+---------------------------------------------------------------------------------------------------+
```

### Critical Subsystem Boundaries & Abstractions
1. **Front-End (Per-CPU / Thread-Cache)**:
   - Fast paths execute without global locks. Modern Linux deployments leverage Restartable Sequences (`rseq`) to access per-CPU memory slabs. If `rseq` is unavailable, TCMalloc falls back to TLS-backed `ThreadCache` objects registered through a zero-allocation `pthread_key_t` lifecycle managed by `PerCpuState`.
2. **Middle-End (CentralFreeList & Spans)**:
   - Serves size classes by decomposing 4KB–32KB OS pages (`Span`) into discrete object allocations. Manages lock-free hook dispatch via `HookList<T>` to avoid lock inversion during heap profiling.
3. **Back-End (PageMap, PageAllocator & HugePageFiller)**:
   - Tracks every virtual page allocated to the process using a multi-level radix tree or flat array (`PageMap<BITS>`). Converts byte addresses into `PageId` primitives.
   - Manages large allocations and backs physical pages with hugepages (e.g., 2MB on x86_64), tracking residency via `mincore` abstractions (`MInCoreInterface`), and aggressively sub-releasing idle pages using `madvise(MADV_DONTNEED)`.
4. **Safety & Diagnostic Isolation Boundary**:
   - `SafeCopyMemory` executes cross-memory inspections via `process_vm_readv` to eliminate SIGSEGV faults when examining heap metadata across unmapped boundaries.
   - `GwpAsanState` and `AllocationGuard` decouple diagnostic memory state recording from recursive re-entrancy into the allocator.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Integer Wrap Proofing in Virtual Range Calculations
**RULE**:
When calculating the upper bound (`last`) of an inclusive interval `[p, p + n - 1]` over an unsigned address or coordinate domain, implementations **MUST** group the offset decrement before the base addition: `last = p + (n - 1)`. Implementations **MUST NOT** evaluate `(p + n) - 1`, and **MUST** explicitly validate both unsigned wrap-around (`last < p`) and virtual hardware address space exhaustion (`(last.index() >> BITS) != 0`) prior to triggering any structural tree or leaf allocation.

**WHY**:
If `n = 0`, an early exit is mandatory. If `n = std::numeric_limits<uintptr_t>::max()`, the un-parenthesized expression `r.p + r.n` wraps around the address space modulo $2^W$. Subtracting 1 afterward yields a large positive index that passes naive checks, or causes underflow when `r.p + r.n == 0`. Furthermore, when allocating multi-level interior radix nodes in structures like `PageMap`, failing to validate that the upper bound fits within the active bit-width `BITS` results in partial tree allocations that leak persistent memory and leave tree invariants corrupted when child allocations subsequently fail.

**WHEN TO APPLY**:
Apply to any virtual page map, radix tree, physical memory allocator, buffer range tracker, or hardware address translation layer managing bounded virtual address spaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Production Invariant: Verified Range Bounding for Multi-Level Radix Maps
#include <cstddef>
#include <cstdint>
#include <limits>

template <size_t BITS>
class RadixRangeTracker {
 public:
  struct Range {
    uintptr_t page_id;
    size_t num_pages;
  };

  [[nodiscard]] bool Ensure(Range r) {
    // Invariant 1: Zero length is a no-op success.
    if (r.num_pages == 0) {
      return true;
    }

    // Invariant 2: Group (r.num_pages - 1) to prevent p + n wrapping before the decrement.
    const uintptr_t last = r.page_id + (r.num_pages - 1);

    // Invariant 3: Detect arithmetic overflow AND address-width boundary overflow.
    // If BITS < 64, shifting by BITS verifies that the index does not exceed 2^BITS - 1.
    if (last < r.page_id || ((BITS < 64) && (last >> BITS) != 0)) {
      return false; // Reject upfront without allocating internal radix nodes.
    }

    // Safe to mutate interior nodes / leaf structures
    return AllocateNodes(r.page_id, last);
  }

 private:
  bool AllocateNodes(uintptr_t start, uintptr_t end) {
    // Node allocation logic guaranteed to stay in [0, (1 << BITS) - 1]
    return true;
  }
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Prone to integer overflow wrapping and radix leaf memory leaks.
bool UnsafeEnsure(uintptr_t start_page, size_t count) {
  // CRITICAL DEFECT: If start_page + count wraps around 0, subtracting 1 yields
  // uintptr_t max, falsely representing an enormous address range.
  uintptr_t last = start_page + count - 1; 

  // Partial allocations occur here; if 'p' later exceeds hardware bounds,
  // previous allocations are orphaned and leaked forever.
  for (uintptr_t p = start_page; p <= last; ++p) {
    AllocateLeafNode(p); 
  }
  return true;
}
```

**VERIFICATION METHOD**:
Enforce unit tests parameterized with `kLimit = 1ULL << BITS` and `std::numeric_limits<uintptr_t>::max()`. Ensure that `Ensure(Range(PageId(kLimit - 1), Length(2)))` and `Ensure(Range(PageId(1), Length(max)))` return `false` without modifying tree depth or allocating interior nodes.

---

### 2. Lock-Free Non-Allocating Hook Dispatch via Atomic Slot Compaction
**RULE**:
Diagnostics, tracing, and allocation lifecycle hooks invoked during allocator fast paths **MUST NOT** allocate heap memory, **MUST NOT** acquire contended read-write locks or mutexes on the fast path, and **MUST** execute via lockless memory-ordered atomic snapshots (`memory_order_acquire`) over bounded, statically allocated hook vectors. Mutations to hook arrays **MUST** be serialized with a spinlock and perform right-compaction to preserve monotonic iteration limits (`priv_end`).

**WHY**:
Invoking dynamic memory allocations (`std::vector`, dynamic closures) or standard OS synchronization primitives inside `malloc`/`free` hooks produces immediate recursive deadlocks (heap re-entrancy). Using reader-writer locks introduces lock contention on hot multi-threaded fast paths. Storing hooks in a bounded static array with atomic acquire/release synchronization allows fast paths to execute with a single relaxed atomic load when hooks are absent, and zero mutex acquisitions when present.

**WHEN TO APPLY**:
Logging, metrics collection, GWP-ASan monitoring, profiling, or tracing frameworks hooking into low-level runtime engines, kernel interceptors, signal handlers, or custom allocators.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
#include <atomic>
#include <cstddef>
#include <utility>

template <typename HookFn, size_t MaxHooks = 7>
class LockFreeHookTable {
 public:
  constexpr LockFreeHookTable() = default;

  [[nodiscard]] bool empty() const noexcept {
    // Fast path: 1 memory access, zero branch stalls on the common case.
    return active_count_.load(std::memory_order_relaxed) == 0;
  }

  template <typename... Args>
  void Invoke(Args&&... args) const noexcept {
    if (__builtin_expect(!empty(), 0)) {
      InvokeSlow(std::forward<Args>(args)...);
    }
  }

  // Blocking, thread-safe registration (low-frequency administrative path)
  bool Add(HookFn hook) noexcept {
    if (!hook) return false;
    LockSpinlock();
    int idx = 0;
    while (idx < MaxHooks && slots_[idx].load(std::memory_order_relaxed) != nullptr) {
      ++idx;
    }
    if (idx == MaxHooks) {
      UnlockSpinlock();
      return false;
    }
    int prev_end = active_count_.load(std::memory_order_acquire);
    slots_[idx].store(hook, std::memory_order_release);
    if (prev_end <= idx) {
      active_count_.store(idx + 1, std::memory_order_release);
    }
    UnlockSpinlock();
    return true;
  }

  bool Remove(HookFn hook) noexcept {
    if (!hook) return false;
    LockSpinlock();
    int end = active_count_.load(std::memory_order_acquire);
    int idx = 0;
    while (idx < end && slots_[idx].load(std::memory_order_acquire) != hook) {
      ++idx;
    }
    if (idx == end) {
      UnlockSpinlock();
      return false;
    }
    slots_[idx].store(nullptr, std::memory_order_release);
    if (end == idx + 1) {
      // Compact active_count_ backward past null slots
      while (end > 0 && slots_[end - 1].load(std::memory_order_acquire) == nullptr) {
        --end;
      }
      active_count_.store(end, std::memory_order_release);
    }
    UnlockSpinlock();
    return true;
  }

 private:
  template <typename... Args>
  void InvokeSlow(Args&&... args) const noexcept {
    HookFn local_copy[MaxHooks];
    int count = 0;
    const int end = active_count_.load(std::memory_order_acquire);
    for (int i = 0; i < end; ++i) {
      HookFn fn = slots_[i].load(std::memory_order_acquire);
      if (fn != nullptr) {
        local_copy[count++] = fn;
      }
    }
    for (int i = 0; i < count; ++i) {
      (*local_copy[i])(args...);
    }
  }

  void LockSpinlock() noexcept {
    while (lock_.test_and_set(std::memory_order_acquire)) {
      #if defined(__x86_64__) || defined(_M_X64)
      __builtin_ia32_pause();
      #endif
    }
  }

  void UnlockSpinlock() noexcept {
    lock_.clear(std::memory_order_release);
  }

  alignas(64) std::atomic_flag lock_ = ATOMIC_FLAG_INIT;
  std::atomic<int> active_count_{0};
  std::atomic<HookFn> slots_[MaxHooks] = {};
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Heap allocation and standard mutexes inside instrumentation hooks.
class ContendedDynamicHooks {
  std::mutex mu_;
  std::vector<void(*)(void*)> hooks_; // RE-ENTRANT DEADLOCK: vector::push_back calls malloc!

 public:
  void Add(void(*fn)(void*)) {
    std::lock_guard<std::mutex> l(mu_); // Mutex allocation or priority inversion
    hooks_.push_back(fn);
  }

  void Invoke(void* ptr) {
    std::lock_guard<std::mutex> l(mu_); // Contends globally on every single allocation/free!
    for (auto* fn : hooks_) fn(ptr);
  }
};
```

**VERIFICATION METHOD**:
Run multi-threaded benchmarks under ThreadSanitizer (`tsan`) verifying zero allocation calls during `Invoke` executions, and verify via assembly inspections that `empty()` resolves to a single atomic load and test instruction without function calls on the fast path.

---

### 3. Fault-Tolerant Unmapped Memory Probing via `process_vm_readv`
**RULE**:
When reading arbitrary pointers from potentially corrupted, racing, or unmapped memory regions (e.g., during heap inspection, telemetry collection, or GWP-ASan crash analysis), code **MUST NOT** directly dereference the raw pointer. Code **MUST** inspect the memory using a fault-isolated kernel memory transfer API (e.g., `process_vm_readv` on Linux) to guarantee that reads from freed, protected (`PROT_NONE`), or unmapped addresses fail gracefully with an error code rather than generating an uncatchable `SIGSEGV`.

**WHY**:
In concurrent allocators and diagnostics, an address recorded by a background thread or crash handler may be concurrently unmapped via `munmap()` or transitioned to inaccessible pages by `mprotect()`. A direct memory dereference (`*ptr`) triggers an unrecoverable segmentation fault that crashes the entire process. Kernel-assisted cross-address-space reads transparently validate virtual page tables without modifying signal masks or relying on fragile, non-reentrant `SIGSEGV` signal handlers.

**WHEN TO APPLY**:
Diagnostic loggers, heap profilers, crash unwinders, post-mortem analyzers, and sanitizers inspecting user-provided memory addresses.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
#include <sys/uio.h>
#include <unistd.h>
#include <cstddef>
#include <cstdint>

namespace safe_memory {

[[nodiscard]] bool SafeCopyMemory(const void* src, void* dst, size_t size) noexcept {
  if (size == 0) return true;
  if (src == nullptr || dst == nullptr) return false;

  struct iovec local_iov;
  local_iov.iov_base = dst;
  local_iov.iov_len = size;

  struct iovec remote_iov;
  remote_iov.iov_base = const_cast<void*>(src);
  remote_iov.iov_len = size;

  // Use process_vm_readv on Linux: read memory from self (getpid())
  // Returns -1 with EFAULT if src points to unmapped/inaccessible memory.
  const ssize_t bytes_read = ::process_vm_readv(
      ::getpid(), &local_iov, 1, &remote_iov, 1, 0);

  return bytes_read == static_cast<ssize_t>(size);
}

}  // namespace safe_memory
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Direct dereference of unknown/unverified memory in diagnostics.
bool UnsafeMemoryDump(const void* untrusted_heap_ptr, void* out, size_t len) {
  // CRITICAL FAILURE: If untrusted_heap_ptr was freed and released via madvise(MADV_DONTNEED)
  // or munmap, this immediately triggers a terminal SIGSEGV.
  std::memcpy(out, untrusted_heap_ptr, len);
  return true;
}
```

**VERIFICATION METHOD**:
Implement a test that allocates a page with `mmap`, sets `mprotect(p, PAGE_SIZE, PROT_NONE)`, passes `p` to `SafeCopyMemory`, and asserts that the call returns `false` without terminating the test process with `SIGSEGV`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: PageMap Radix Tree Boundary Wrap and Interior Node Leak
- **Context**: `tcmalloc/pagemap.h`, `PageMap<BITS>::Ensure`
- **What Was Expected**: Calling `Ensure(Range(PageId(p), Length(n)))` on a `PageMap` must ensure that all interior and leaf nodes covering the page range `[p, p + n - 1]` are allocated. If the range exceeds the valid address space ($2^{\text{BITS}}$ pages) or wraps around arithmetic limits, `Ensure` must reject the call immediately, return `false`, and make no changes to internal leaf structures.
- **What Actually Happened**:
  `PageMap::Ensure` computed the last page as:
  ```cpp
  const PageId last = r.p + r.n - Length(1);
  ```
  When `r.p + r.n` caused an arithmetic overflow (e.g., when `r.n` is near `SIZE_MAX`), the addition wrapped around zero *before* subtracting 1. This calculation failed to properly detect the overflow. The subsequent loop began allocating interior radix nodes and intermediate leaves for valid lower indices before hitting index limits on upper levels, resulting in partial tree allocations that were leaked. Furthermore, invalid ranges covering non-existent bit addresses returned `true` or corrupted interior radix pointers.
- **Evidence in Repo**: Commit `79ecffb8`, Issue/PR PiperOrigin-RevId: 1005082253. Tested in `tcmalloc/pagemap_test.cc`.
- **Root Cause**:
  1. Operator precedence and associative arithmetic ordering: `(r.p + r.n) - 1` wrapped around uint domain before subtracting 1, masking underflows and overflows.
  2. Missing upfront validation: The loop allocated tree levels dynamically without confirming `last >= r.p` and `(last.index() >> BITS) == 0`.
- **Remediation Code Diff**:
```cpp
--- a/tcmalloc/pagemap.h
+++ b/tcmalloc/pagemap.h
@@ -341,7 +341,10 @@ class PageMap {
 
   [[nodiscard]] bool Ensure(Range r) {
     if (r.n == Length(0)) return true;
-    const PageId last = r.p + r.n - Length(1);
+    const PageId last = r.p + (r.n - Length(1));
+    if (last < r.p || (last.index() >> BITS) != 0) {
+      return false;
+    }
     for (PageId p = r.p; p <= last;) {
```
- **Lesson**: Calculate inclusive ranges using `p + (n - 1)`. Always perform boundary and wrap-around checks before beginning incremental resource allocations to prevent state leakage on partial failure.

---

### Incident 2: Circular Dependency on Dynamic Runtime Experiments in Heap Metrics
- **Context**: `tcmalloc/testing/get_stats_test.cc`, `Parameters` subsystem
- **What Was Expected**: Verification tests for telemetry statistics (`MallocExtension::GetStats()`) must provide deterministic assertions of system state across all execution environments, independent of external continuous experiment rollouts.
- **What Actually Happened**: `get_stats_test` was verifying its reported statistics by querying `IsExperimentActive()`. In continuous deployment environments where dynamic experiments alter allocator parameters at runtime, tests suffered from nondeterministic assertions, circular test dependencies, and brittle mocking setups.
- **Evidence in Repo**: Issue #1686, closed 2026-10-23. "Assert stats against Parameters getters in get_stats_test."
- **Root Cause**: The test coupled diagnostic validation to the dynamic experiment dispatch engine rather than testing against the authoritative source of truth: the concrete `Parameters` getter methods.
- **Remediation Code Diff**:
```cpp
--- a/tcmalloc/testing/get_stats_test.cc
+++ b/tcmalloc/testing/get_stats_test.cc
@@ -112,5 +112,5 @@ TEST(GetStatsTest, ParameterConsistency) {
-  EXPECT_EQ(ExtractStat("tcmalloc.experiment_active"), IsExperimentActive("huge_region"));
+  EXPECT_EQ(ExtractStat("tcmalloc.huge_region_active"), Parameters::huge_region_more_often());
```
- **Lesson**: Never validate observability outputs against dynamic runtime feature flags; validate directly against authoritative, immutable state getters.

---

### Incident 3: Test Redundancy and Helper Leaks in Open Source Distributions
- **Context**: Test infrastructure across `want_disable_*_test.cc` and open-source Bazel/CMake packaging.
- **What Was Expected**: Open-source distributions must maintain identical testing fidelity without leaking proprietary Google internal test harness sources or duplicating identical verification binaries.
- **What Actually Happened**: Three separate testing suites (`want_disable_huge_region_more_often_test`, `want_disable_cfl_subbucket_prioritization_test`, and `want_disable_subrelease_unbacked_hugepages_test`) each maintained duplicate helper harnesses (`*_helper.cc`) executing identical operations (dumping `MallocExtension::GetStats()` to stdout). These helper binaries were inadvertently exported into the open-source release manifests.
- **Evidence in Repo**: Issue #1687, closed 2026-10-23. "Consolidate want_disable_* tests into want_disable_test."
- **Root Cause**: Fragmented, copy-pasted test harnesses lacking parameterization.
- **Remediation Code Diff**:
```diff
--- a/tcmalloc/BUILD
+++ b/tcmalloc/BUILD
-cc_test(name = "want_disable_huge_region_more_often_test", ...)
-cc_test(name = "want_disable_cfl_subbucket_prioritization_test", ...)
-cc_test(name = "want_disable_subrelease_unbacked_hugepages_test", ...)
+cc_test(
+    name = "want_disable_test",
+    srcs = ["want_disable_test.cc"],
+    data = [":want_disable_test_helper"],
+)
```
- **Lesson**: Consolidate repetitive configuration-invalidation tests into parameterized drivers. Isolate internal test helper binaries from open-source export targets.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence Hazard in Index Offsets**:
  - *Hazard*: `r.p + r.n - Length(1)` vs `r.p + (r.n - Length(1))`. In C++, `+` and `-` have left-to-right associativity. Without explicit parentheses, `(r.p + r.n)` evaluates first. If `r.n` is `kMaxLen`, this triggers an immediate unsigned overflow wrap before subtracting 1.
  - *Precision Rule*: When converting `[base, length)` to `[base, inclusive_last]`, always evaluate `inclusive_last = base + (length - 1)`.
- **Bitwise Bit-Shift Overflow Protection**:
  ```cpp
  // INVARIANT: When checking if an index fits within BITS:
  // If BITS == 64 on a 64-bit platform, 'last.index() >> 64' is UNDEFINED BEHAVIOR.
  // Must guard bit-shifts where shift amount == type width:
  static constexpr size_t kBits = BITS;
  bool InBounds(uintptr_t index) {
    if constexpr (kBits < sizeof(uintptr_t) * 8) {
      return (index >> kBits) == 0;
    }
    return true; // Whole uintptr_t fits when kBits == 64
  }
  ```
- **Bit Array Sizing Rounding Math**:
  In `tcmalloc/internal/cpu_utils.h`:
  ```cpp
  std::array<cpu_set_t, (kCpuSetBytes + sizeof(cpu_set_t) - 1) / sizeof(cpu_set_t)> cpu_set_;
  ```
  Calculating buffer requirements across platform types requires ceiling division: `(N + D - 1) / D`. Omitting `- 1` over-allocates; omitting `+ D - 1` truncates and causes buffer overruns in `sched_getaffinity`.

---

### 2. Infinite Loop & Recursion Guards
- **Termination Invariants in Hook Compaction**:
  In `tcmalloc/internal/hook_list.h`, the removal compaction loop relies on a strictly decremented boundary condition:
  ```cpp
  if (hooks_end == index + 1) {
    hooks_end = index;
    while ((hooks_end > 0) &&
           (priv_data[hooks_end - 1].load(std::memory_order_acquire) == 0)) {
      --hooks_end; // Strict monotonically decreasing progress towards 0
    }
    priv_end.store(hooks_end, std::memory_order_release);
  }
  ```
  *Termination Proof*: `hooks_end` is bounded in `[0, MaxHooks]`. Each iteration decreases `hooks_end` by exactly 1. The loop predicate strictly checks `hooks_end > 0`, making termination guaranteed in at most 7 iterations without starvation.
- **Signal-Safe Loop Interruption Shields**:
  In `tcmalloc/internal/util.h`, `TCMALLOC_RETRY_ON_TEMP_FAILURE`:
  ```cpp
  #define TCMALLOC_RETRY_ON_TEMP_FAILURE(expression) \
    (__extension__({ \
      long int _res; \
      do _res = (long int)(expression); \
      while (_res == -1L && errno == EINTR); \
      _res; \
    }))
  ```
  Guards system calls (`poll`, `read`, `write`) against premature termination from external POSIX signals without spinning on fatal errors (`EFAULT`, `EBADF`).

---

### 3. UI & UX / Diagnostic Observability Mechanics
*(In TCMalloc, "UI/UX" corresponds to telemetry output formatting, developer metrics reporting, and terminal diagnostic traces.)*
- **Signal-Safe Terminal Writing**:
  Traditional I/O (`printf`, `std::cout`) acquires internal `FILE*` locks and invokes `malloc()`, causing deadlocks if called from crash handlers or hooks.
  TCMalloc mandates `signal_safe_write(STDERR_FILENO, buf, count, &written)` which:
  1. Calls direct kernel syscalls (`SYS_write`).
  2. Tracks cumulative bytes written across signal interruptions (`EINTR`).
  3. Never performs dynamic memory allocation or library buffering.

---

### 4. Backend Concurrency & Memory Safety
- **Zero-Allocation Sentinel Registration in TLS/Per-CPU State**:
  In `tcmalloc/internal/percpu_state.h`:
  ```cpp
  inline void PerCpuState::RegisterThreadCache(ThreadCache* cache) {
    if (cache == nullptr) {
      // Use static address &g as sentinel to force a cleanup callback
      // without requiring a dynamic heap allocation.
      pthread_setspecific(key_, &g);
    } else {
      pthread_setspecific(key_, cache);
    }
  }
  ```
  *Forensic Detail*: Calling `pthread_setspecific` with a non-null pointer ensures that the POSIX threads subsystem registers this thread for exit callbacks. Passing `&g` (a statically allocated singleton in `.bss`) guarantees that uninitialized or clearing threads trigger `HandleThreadExit` without invoking heap allocators during early runtime startup.
- **Thread Signal Mask Isolation (RAII `ScopedSigmask`)**:
  Before acquiring any internal spinlocks that could be interrupted by an application signal handler attempting another `malloc()`, TCMalloc applies `ScopedSigmask`:
  ```cpp
  inline ScopedSigmask::ScopedSigmask() noexcept {
    sigset_t set;
    sigfillset(&set);
    pthread_sigmask(SIG_SETMASK, &set, &old_set_); // Block all signals
  }
  inline ScopedSigmask::~ScopedSigmask() noexcept {
    pthread_sigmask(SIG_SETMASK, &old_set_, nullptr); // Atomically restore
  }
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Copying over Corrupted / Unmapped Stacks**:
  In `tcmalloc/internal/gwp_asan_state.h`:
  ```cpp
  static void CopyStack(std::optional<absl::Span<void* const>> src,
                        void* (&dst)[kMaxStackDepth],
                        std::optional<size_t>& dst_depth) {
    if (!src.has_value()) {
      dst_depth = std::nullopt;
      return;
    }
    const size_t depth = std::min<size_t>(kMaxStackDepth, src->size());
    if (depth > 0) {
      memcpy(dst, src->data(), sizeof(void*) * depth);
    }
    dst_depth = depth;
  }
  ```
  - *Invariant*: Hard cap at `kMaxStackDepth` (typically 64 frames). Protects against buffer overflows in crash diagnostic