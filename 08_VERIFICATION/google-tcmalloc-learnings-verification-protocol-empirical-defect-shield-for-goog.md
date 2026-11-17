# Verification Protocol: Verification Protocol: Empirical Defect Shield for google-tcmalloc-learnings

<!-- PROVENANCE_START
{
  "source_repository": "google-tcmalloc-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T22:40:07.126Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-google-tcmalloc-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [google-tcmalloc-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T22:40:07.126Z`  
> **Learning ID**: `LEARN-EVO-google-tcmalloc-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `google-tcmalloc-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/google-tcmalloc-learnings.md`  
> **Source**: github ([https://github.com/google/tcmalloc](https://github.com/google/tcmalloc))  
> **Source Version**: `01b9fd85`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T22:39:50.311Z  
> **Learning ID**: `learn-github-google-tcmalloc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): google/tcmalloc

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-tcmalloc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/tcmalloc](https://github.com/google/tcmalloc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T22:39:50.306Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/tcmalloc`
- **Description**: 
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5402 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tcmalloc/internal/central_freelist_hooks.h`
```
// Copyright 2026 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_CENTRAL_FREELIST_HOOKS_H_
#define TCMALLOC_INTERNAL_CENTRAL_FREELIST_HOOKS_H_

#include <cstddef>

#include "absl/types/span.h"
#include "tcmalloc/internal/hook_list.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

using CentralFreelistInsertRangeHook = void (*)(size_t size_class,
                                                absl::Span<void*> batch);
using CentralFreelistRemoveRangeHook = void (*)(size_t size_class,
                                                absl::Span<void*> batch);

extern HookList<CentralFreelistInsertRangeHook>
    central_freelist_insert_range_hooks;
extern HookList<CentralFreelistRemoveRangeHook>
    central_freelist_remove_range_hooks;

}  // namespace tcmalloc_internal
}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_CENTRAL_FREELIST_HOOKS_H_

```

### Core Architecture Module: `tcmalloc/internal/cpu_utils.h`
```
// Copyright 2023 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_CPU_UTILS_H_
#define TCMALLOC_INTERNAL_CPU_UTILS_H_

#include <sched.h>

#include <array>

#include "absl/base/attributes.h"
#include "tcmalloc/internal/config.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

// The maximum number of CPUs supported by TCMalloc.
static constexpr int kMaxCpus = 2048;
// The size of the CPU set in bytes.
static constexpr int kCpuSetBytes = CPU_ALLOC_SIZE(kMaxCpus);

class CpuSet {
 public:
  void Zero() { CPU_ZERO_S(kCpuSetBytes, cpu_set_.data()); }
  void Set(int cpu) { CPU_SET_S(cpu, kCpuSetBytes, cpu_set_.data()); }
  [[nodiscard]] bool IsSet(int cpu) const {
    return CPU_ISSET_S(cpu, kCpuSetBytes, cpu_set_.data());
  }
  void CLR(int cpu) { CPU_CLR_S(cpu, kCpuSetBytes, cpu_set_.data()); }
  [[nodiscard]] int Count() const {
    return CPU_COUNT_S(kCpuSetBytes, cpu_set_.data());
  }

  // Find the index of the first set CPU. Returns -1 if none are set.
  [[nodiscard]] int FindFirstSet() const {
    if (Count() == 0) {
      return -1;
    }
    int cpu = 0;
    while (!IsSet(cpu)) {
      ++cpu;
    }
    return cpu;
  }

  // Sets the CPU affinity of the process with the given pid. Returns true if
  // successful. If returns false, please check the global 'errno' variable to
  // determine the specific error that occurred.
  [[nodiscard]] bool SetAffinity(pid_t pid) {
    return sched_setaffinity(pid, kCpuSetBytes, cpu_set_.data()) == 0;
  }

  // Gets the CPU affinity of the process with the given pid. Return trues if
  // successful. If returns false, please check the global 'errno' variable to
  // determine the specific error that occurred.
  [[nodiscard]] bool GetAffinity(pid_t pid) {
    return sched_getaffinity(pid, kCpuSetBytes, cpu_set_.data()) == 0;
  }

  [[nodiscard]] const cpu_set_t* data() const { return cpu_set_.data(); }

 private:
  // In the sched.h, each CPU occupies one bit.
  // Declare a bit array with a size that is an integer multiple of cpu_set_t:
  std::array<cpu_set_t,
             (kCpuSetBytes + sizeof(cpu_set_t) - 1) / sizeof(cpu_set_t)>
      cpu_set_;
};

}  // namespace tcmalloc_internal
}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_CPU_UTILS_H_

```

### Core Architecture Module: `tcmalloc/internal/gwp_asan_state.h`
```
// Copyright 2024 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_GWP_ASAN_STATE_H_
#define TCMALLOC_INTERNAL_GWP_ASAN_STATE_H_

#include <algorithm>
#include <cstddef>
#include <cstring>
#include <new>
#include <optional>

#include "absl/types/span.h"
#include "tcmalloc/internal/config.h"
#include "tcmalloc/internal/logging.h"
#include "tcmalloc/malloc_extension.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

class GwpAsanState {
 public:
  constexpr GwpAsanState() = default;

  enum class Type {
    kNone,
    kMismatchedDelete,
    kDoubleFree,
    kInvalidFree,
    kMismatchedFree,
  };

  [[nodiscard]] Type type() const { return type_; }

  [[nodiscard]] const void* ptr() const { return ptr_; }

  [[nodiscard]] bool triggered() const { return type_ != Type::kNone; }

  [[nodiscard]] std::optional<absl::Span<void* const>> AllocationStack() const {
    TC_ASSERT_NE(type_, Type::kNone);

    if (!allocation_stack_depth_.has_value()) {
      return std::nullopt;
    }

    return absl::MakeSpan(allocation_stack_, *allocation_stack_depth_);
  }

  [[nodiscard]] std::optional<absl::Span<void* const>> DeallocationStack()
      const {
    TC_ASSERT_NE(type_, Type::kNone);
    if (!deallocation_stack_depth_.has_value()) {
      return std::nullopt;
    }

    return absl::MakeSpan(deallocation_stack_, *deallocation_stack_depth_);
  }

  [[nodiscard]] size_t provided_min() const {
    TC_ASSERT_EQ(type_, Type::kMismatchedDelete);
    return provided_min_;
  }
  [[nodiscard]] size_t provided_max() const {
    TC_ASSERT_EQ(type_, Type::kMismatchedDelete);
    return provided_max_;
  }

  [[nodiscard]] size_t minimum_size() const {
    TC_ASSERT_EQ(type_, Type::kMismatchedDelete);
    return minimum_;
  }

  [[nodiscard]] size_t maximum_size() const {
    TC_ASSERT_EQ(type_, Type::kMismatchedDelete);
    return maximum_;
  }

  [[nodiscard]] std::optional<std::align_val_t> actual_alignment() const {
    TC_ASSERT_EQ(type_, Type::kInvalidFree);
    return actual_alignment_;
  }

  [[nodiscard]] std::optional<std::align_val_t> expected_alignment() const {
    TC_ASSERT_EQ(type_, Type::kInvalidFree);
    return expected_alignment_;
  }

  [[nodiscard]] AllocationType alloc_type() const {
    TC_ASSERT_EQ(type_, Type::kMismatchedFree);
    return *alloc_type_;
  }

  [[nodiscard]] AllocationType dealloc_type() const {
    TC_ASSERT_EQ(type_, Type::kMismatchedFree);
    return *dealloc_type_;
  }

  void RecordMismatch(
      const void* ptr, size_t provided_min, size_t provided_max, size_t minimum,
      size_t maximum, std::optional<absl::Span<void* const>> allocation_stack,
      std::optional<absl::Span<void* const>> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kMismatchedDelete;

    provided_min_ = provided_min;
    provided_max_ = provided_max;
    minimum_ = minimum;
    maximum_ = maximum;

    CopyStack(allocation_stack, allocation_stack_, allocation_stack_depth_);
    CopyStack(deallocation_stack, deallocation_stack_,
              deallocation_stack_depth_);
  }

  void RecordDoubleFree(const void* ptr,
                        absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kDoubleFree;
    allocation_stack_depth_ = std::nullopt;
    CopyStack(deallocation_stack, deallocation_stack_,
              deallocation_stack_depth_);
  }

  void RecordInvalidFree(const void* ptr,
                         absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kInvalidFree;
    actual_alignment_ = std::nullopt;
    expected_alignment_ = std::nullopt;
    allocation_stack_depth_ = std::nullopt;
    CopyStack(deallocation_stack, deallocation_stack_,
              deallocation_stack_depth_);
  }

  void RecordInvalidFree(
      const void* ptr, std::optional<std::align_val_t> actual_alignment,
      std::optional<std::align_val_t> expected_alignment,
      std::optional<absl::Span<void* const>> allocation_stack,
      absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kInvalidFree;
    actual_alignment_ = actual_alignment;
    expected_alignment_ = expected_alignment;

    CopyStack(allocation_stack, allocation_stack_, allocation_stack_depth_);
    CopyStack(deallocation_stack, deallocation_stack_,
              deallocation_stack_depth_);
  }

  void RecordInvalidFree(const void* ptr, std::align_val_t actual_alignment,
                         std::align_val_t expected_alignment,
                         absl::Span<void* const> allocation_stack,
                         absl::Span<void* const> deallocation_stack) {
    RecordInvalidFree(ptr, std::optional<std::align_val_t>(actual_alignment),
                      std::optional<std::align_val_t>(expected_alignment),
                      std::optional<absl::Span<void* const>>(allocation_stack),
                      deallocation_stack);
  }

  void RecordMismatchedFree(const void* ptr, AllocationType alloc_type,
                            AllocationType dealloc_type,
                            absl::Span<void* const> allocation_stack,
                            absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kMismatchedFree;
    alloc_type_ = alloc_type;
    dealloc_type_ = dealloc_type;

    CopyStack(allocation_stack, allocation_stack_, allocation_stack_depth_);
    CopyStack(deallocation_stack, deallocation_stack_,
              deallocation_stack_depth_);
  }

 private:
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

  Type type_ = Type::kNone;
  const void* ptr_ = nullptr;
  size_t provided_min_ = 0, provided_max_ = 0, minimum_ = 0, maximum_ = 0;
  std::optional<std::align_val_t> actual_alignment_, expected_alignment_;

  std::optional<AllocationType> alloc_type_, dealloc_type_;

  void* allocation_stack_[kMaxStackDepth] = {};
  std::optional<size_t> allocation_stack_depth_ = std::nullopt;
  void* deallocation_stack_[kMaxStackDepth] = {};
  std::optional<size_t> deallocation_stack_depth_ = std::nullopt;
};

}  // namespace tcmalloc_internal
}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_GWP_ASAN_STATE_H_

```

### Core Architecture Module: `tcmalloc/internal/hook_list.h`
```
// Copyright 2017 The Abseil Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///

// This has the implementation details of malloc_hook that are needed
// to use malloc-hook inside the tcmalloc system.  It does not hold
// any of the client-facing calls that are used to add new hooks.
//
// IWYU pragma: private, include "base/malloc_hook_invoke.h"

#ifndef TCMALLOC_INTERNAL_HOOK_LIST_H_
#define TCMALLOC_INTERNAL_HOOK_LIST_H_

#include <atomic>
#include <cstddef>
#include <utility>

#include "absl/base/attributes.h"
#include "absl/base/internal/spinlock.h"
#include "absl/base/optimization.h"
#include "tcmalloc/internal/config.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc::tcmalloc_internal {

// Maximum of 7 hooks means that HookList is 8 words.
static constexpr int kHookListMaxValues = 7;

class HookListBase {
 protected:
  constexpr HookListBase() = default;

  ABSL_CONST_INIT static absl::base_internal::SpinLock hooklist_spinlock_;
};

// HookList: a class that provides synchronized insertions and removals and
// lockless traversal.  Most of the implementation is in malloc_hook.cc.
template <typename T>
class HookList final : HookListBase {
 public:
  constexpr HookList() = default;
  constexpr explicit HookList(T initial_hook)
      : priv_end{1}, priv_data{{initial_hook}} {}

  // Adds value to the list.  Note that duplicates are allowed.  Thread-safe and
  // blocking (acquires hooklist_spinlock_).  Returns true on success; false
  // otherwise (failures include invalid value and no space left).
  [[nodiscard]] bool Add(T value) ABSL_LOCKS_EXCLUDED(hooklist_spinlock_);

  // Removes the first entry matching value from the list.  Thread-safe and
  // blocking (acquires hooklist_spinlock).  Returns true on success; false
  // otherwise (failures include invalid value and no value found).
  [[nodiscard]] bool Remove(T value) ABSL_LOCKS_EXCLUDED(hooklist_spinlock_);

  // Store up to n values of the list in output_array, and return the number of
  // elements stored.  Thread-safe and non-blocking.  This is fast (one memory
  // access) if the list is empty.
  [[nodiscard]] ABSL_ATTRIBUTE_NO_SANITIZE_ADDRESS int Traverse(T* output_array,
                                                                int n) const;

  // Fast inline implementation for fast path of Invoke*Hook.
  [[nodiscard]] ABSL_ATTRIBUTE_NO_SANITIZE_ADDRESS bool empty() const {
    // empty() is only used as an optimization to determine if we should call
    // Traverse which has proper acquire loads.  Memory reordering around a
    // call to empty will either lead to an unnecessary Traverse call, or will
    // miss invoking hooks, neither of which is a problem.
    return priv_end.load(std::memory_order_relaxed) == 0;
  }

  [[nodiscard]] ABSL_ATTRIBUTE_NO_SANITIZE_ADDRESS int size() const {
    return priv_end.load(std::memory_order_relaxed);
  }

  template <typename... Args>
  ABSL_ATTRIBUTE_ALWAYS_INLINE void Invoke(Args&&... args) const {
    if (ABSL_PREDICT_FALSE(!empty())) {
      InvokeSlow(std::forward<Args>(args)...);
    }
  }

 private:
  template <typename... Args>
  ABSL_ATTRIBUTE_COLD ABSL_ATTRIBUTE_NOINLINE
      ABSL_ATTRIBUTE_NO_SANITIZE_ADDRESS void
      InvokeSlow(Args&&... args) const;

  // One more than the index of the last valid element in priv_data.  During
  // 'Remove' this may be past the last valid element in priv_data, but
  // subsequent values will be 0.
  std::atomic<int> priv_end = {};
  std::atomic<T> priv_data[kHookListMaxValues] = {};
};

template <typename T>
bool HookList<T>::Add(T value_as_t) {
  if (value_as_t == T()) {
    return false;
  }
  absl::base_internal::SpinLockHolder l(hooklist_spinlock_);
  // Find the first slot in data that is 0.
  int index = 0;
  while ((index < kHookListMaxValues) &&
         (priv_data[index].load(std::memory_order_relaxed) != 0)) {
    ++index;
  }
  if (index == kHookListMaxValues) {
    return false;
  }
  int prev_num_hooks = priv_end.load(std::memory_order_acquire);
  priv_data[index].store(value_as_t, std::memory_order_release);
  if (prev_num_hooks <= index) {
    priv_end.store(index + 1, std::memory_order_release);
  }
  return true;
}

template <typename T>
bool HookList<T>::Remove(T value_as_t) {
  if (value_as_t == T()) {
    return false;
  }
  absl::base_internal::SpinLockHolder l(hooklist_spinlock_);
  int hooks_end = priv_end.load(std::memory_order_acquire);
  int index = 0;
  while (index < hooks_end &&
         value_as_t != priv_data[index].load(std::memory_order_acquire)) {
    ++index;
  }
  if (index == hooks_end) {
    return false;
  }
  priv_data[index].store(0, std::memory_order_release);
  if (hooks_end == index + 1) {
    // Adjust hooks_end down to the lowest possible value.
    hooks_end = index;
    while ((hooks_end > 0) &&
           (priv_data[hooks_end - 1].load(std::memory_order_acquire) == 0)) {
      --hooks_end;
    }
    priv_end.store(hooks_end, std::memory_order_release);
  }
  return true;
}

template <typename T>
int HookList<T>::Traverse(T* output_array, int n) const {
  int hooks_end = priv_end.load(std::memory_order_acquire);
  int actual_hooks_end = 0;
  for (int i = 0; i < hooks_end && n > 0; ++i) {
    T data = priv_data[i].load(std::memory_order_acquire);
    if (data != T()) {
      *output_array++ = data;
      ++actual_hooks_end;
      --n;
    }
  }
  return actual_hooks_end;
}

template <typename T>
template <typename... Args>
void HookList<T>::InvokeSlow(Args&&... args) const {
  T hooks[kHookListMaxValues];
  int num_hooks = Traverse(hooks, kHookListMaxValues);
  for (int i = 0; i < num_hooks; ++i) {
    (*hooks[i])(args...);
  }
}

}  // namespace tcmalloc::tcmalloc_internal
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_HOOK_LIST_H_

```

### Core Architecture Module: `tcmalloc/internal/mincore.h`
```
// Copyright 2019 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_MINCORE_H_
#define TCMALLOC_INTERNAL_MINCORE_H_

#include <stddef.h>

#include "tcmalloc/internal/config.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

// Class to wrap mincore so that we can replace it for testing.
class MInCoreInterface {
 public:
  MInCoreInterface() = default;
  virtual ~MInCoreInterface() = default;
  [[nodiscard]] virtual int mincore(void* addr, size_t length,
                                    unsigned char* result) = 0;

 private:
  MInCoreInterface(const MInCoreInterface&) = delete;
  MInCoreInterface& operator=(const MInCoreInterface&) = delete;
};

// The MInCore class through the function residence(addr, size) provides
// a convenient way to report the residence of an arbitrary memory region.
// This is a wrapper for the ::mincore() function. The ::mincore() function has
// the constraint of requiring the base address to be page aligned.
class MInCore {
 public:
  MInCore() = default;
  // For a region of memory return the number of bytes that are
  // actually resident in memory. Note that the address and size
  // do not need to be a multiple of the system page size.
  [[nodiscard]] static size_t residence(void* addr, size_t size);

 private:
  // Separate out the implementation to make the code easier to test.
  [[nodiscard]] static size_t residence_impl(void* addr, size_t size,
                                             MInCoreInterface* mincore);

  // Size of the array used to gather results from mincore().
  static constexpr int kArrayLength = 4096;
  // Friends required for testing
  friend class MInCoreTest;
};

}  // namespace tcmalloc_internal
}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_MINCORE_H_

```

### Core Architecture Module: `tcmalloc/internal/page_allocator_hooks.h`
```
// Copyright 2026 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_PAGE_ALLOCATOR_HOOKS_H_
#define TCMALLOC_INTERNAL_PAGE_ALLOCATOR_HOOKS_H_

#include <cstddef>
#include <cstdint>

#include "tcmalloc/internal/config.h"
#include "tcmalloc/internal/hook_list.h"
#include "tcmalloc/internal/memory_tag.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

enum class PageReleaseReason : uint8_t;

// Hook invoked after Span allocation attempts in PageAllocator::New and
// PageAllocator::NewAligned.
// - start_page_index is 0 if allocation returned nullptr.
// - n is the requested size in pages.
// - align is the requested alignment in pages (1 for standard unaligned New,
//   or e.g. kPagesPerHugePage for NewAligned).
// - objects_per_span and density are from SpanAllocInfo.
//
using PageAllocatorNewHook = void (*)(size_t start_page_index, size_t n,
                                      size_t align, size_t objects_per_span,
                                      uint8_t density, MemoryTag tag);

// Hook invoked before a Span or allocation state is deleted in
// PageAllocator::Delete.
using PageAllocatorDeleteHook = void (*)(size_t start_page_index, size_t n,
                                         size_t objects_per_span,
                                         uint8_t density, MemoryTag tag);

// Hook invoked after memory release attempts in
// PageAllocator::ReleaseAtLeastNPages.
// - num_pages is the requested number of pages to release.
// - released is the actual number of pages released.
// - reason is the PageReleaseReason of the release attempt.
using PageAllocatorReleaseHook = void (*)(size_t num_pages, size_t released,
                                          PageReleaseReason reason);

extern HookList<PageAllocatorNewHook> page_allocator_new_hooks;
extern HookList<PageAllocatorDeleteHook> page_allocator_delete_hooks;
extern HookList<PageAllocatorReleaseHook> page_allocator_release_hooks;

}  // namespace tcmalloc_internal
}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_PAGE_ALLOCATOR_HOOKS_H_

```

### Core Architecture Module: `tcmalloc/internal/percpu_state.h`
```
// Copyright 2026 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_PERCPU_STATE_H_
#define TCMALLOC_INTERNAL_PERCPU_STATE_H_

#include <pthread.h>

#include "absl/base/attributes.h"
#include "absl/base/call_once.h"
#include "absl/base/nullability.h"
#include "tcmalloc/internal/allocation_guard.h"
#include "tcmalloc/internal/config.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc::tcmalloc_internal {

class ThreadCache;

extern "C" ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_DestroyThreadCache(
    ThreadCache* absl_nullable);

// PerCpuState receives thread creation/destruction notifications, managing the
// registration with the pthread library using a single pthread_key_t
// registration.
//
// TODO(b/478927694): Include actual per-core state.
class PerCpuState {
 public:
  [[nodiscard]] static constexpr PerCpuState& state() { return g; }

  void Init();

  // Registers an instance for destruction.  `nullptr` unregisters.
  void RegisterThreadCache(ThreadCache* absl_nullable);

 private:
  constexpr PerCpuState() = default;

  ABSL_CONST_INIT static PerCpuState g;

  static void HandleThreadExit(void* ptr);

  absl::once_flag f_;
  pthread_key_t key_{};
};

inline void PerCpuState::Init() {
  absl::base_internal::LowLevelCallOnce(&f_, [&]() {
    pthread_key_create(&key_, HandleThreadExit);

    // Invoke `pthread_setspecific` now to ensure that we have one of the
    // early `pthread_key_t`'s that does not require allocating when use it.
    AllocationGuard g;
    RegisterThreadCache(nullptr);
  });
}

inline void PerCpuState::RegisterThreadCache(ThreadCache* absl_nullable cache) {
  if (cache == nullptr) {
    // Use &g as a sentinel so that we always get a callback.
    pthread_setspecific(key_, &g);
  } else {
    pthread_setspecific(key_, cache);
  }
}

inline void PerCpuState::HandleThreadExit(void* ptr) {
  if (ptr == &g) {
    // TODO(b/478927694): Take advantage of this callback.
    return;
  }

  if (&TCMalloc_Internal_DestroyThreadCache != nullptr) {
    ThreadCache* cache = static_cast<ThreadCache*>(ptr);
    TCMalloc_Internal_DestroyThreadCache(cache);
  }
}

}  // namespace tcmalloc::tcmalloc_internal
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_PERCPU_STATE_H_

```

### Core Architecture Module: `tcmalloc/internal/util.h`
```
// Copyright 2019 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_INTERNAL_UTIL_H_
#define TCMALLOC_INTERNAL_UTIL_H_

#include <errno.h>
#include <poll.h>  // IWYU pragma: keep
#include <sched.h>
#include <signal.h>
#include <stddef.h>
#include <string.h>
#include <sys/types.h>
#include <time.h>

#include "absl/base/nullability.h"
#include "absl/strings/string_view.h"
#include "absl/time/time.h"
#include "absl/types/span.h"
#include "tcmalloc/internal/config.h"
#include "tcmalloc/internal/logging.h"

#define TCMALLOC_RETRY_ON_TEMP_FAILURE(expression)               \
  (__extension__({                                               \
    long int _temp_failure_retry_result;                         \
    do _temp_failure_retry_result = (long int)(expression);      \
    while (_temp_failure_retry_result == -1L && errno == EINTR); \
    _temp_failure_retry_result;                                  \
  }))

// Useful internal utility functions.  These calls are async-signal safe
// provided the signal handler saves errno at entry and restores it before
// return.
GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

// signal_safe_open() - a wrapper for open(2) which ignores signals
// Semantics equivalent to open(2):
//   returns a file-descriptor (>=0) on success, -1 on failure, error in errno
[[nodiscard]] int signal_safe_open(const char* path, int flags, ...);

// signal_safe_close() - a wrapper for close(2) which ignores signals
// Semantics equivalent to close(2):
//   returns 0 on success, -1 on failure, error in errno
int signal_safe_close(int fd);

// signal_safe_write() - a wrapper for write(2) which ignores signals
// Semantics equivalent to write(2):
//   returns number of bytes written, -1 on failure, error in errno
//   additionally, (if not NULL) total bytes written in *bytes_written
//
// In the interrupted (EINTR) case, signal_safe_write will continue attempting
// to write out buf.  This means that in the:
//   write->interrupted by signal->write->error case
// That it is possible for signal_safe_write to return -1 when there were bytes
// flushed from the buffer in the first write.  To handle this case the optional
// bytes_written parameter is provided, when not-NULL, it will always return the
// total bytes written before any error.
ssize_t signal_safe_write(int fd, const char* buf, size_t count,
                          size_t* bytes_written);

// signal_safe_read() - a wrapper for read(2) which ignores signals
// Semantics equivalent to read(2):
//   returns number of bytes written, -1 on failure, error in errno
//   additionally, (if not NULL) total bytes written in *bytes_written
//
// In the interrupted (EINTR) case, signal_safe_read will continue attempting
// to read into buf.  This means that in the:
//   read->interrupted by signal->read->error case
// That it is possible for signal_safe_read to return -1 when there were bytes
// read by a previous read.  To handle this case the optional bytes_written
// parameter is provided, when not-NULL, it will always return the total bytes
// read before any error.
[[nodiscard]] ssize_t signal_safe_read(int fd, char* buf, size_t count,
                                       size_t* bytes_read);

// signal_safe_pread() - a wrapper for pread(2) which ignores signals
// Semantics equivalent to pread(2):
//   returns number of bytes read, -1 on failure, error in errno
//   additionally, (if not nullptr) total bytes read in *bytes_read
//
// In the interrupted (EINTR) or partial-read case, signal_safe_pread will
// continue attempting to read into buf from offset + total_bytes without
// modifying fd's file offset.  If an error occurs after a partial read,
// signal_safe_pread returns -1 and (when bytes_read is non-null) stores the
// total bytes read before the error in *bytes_read.
[[nodiscard]] ssize_t signal_safe_pread(int fd, char* absl_nonnull buf,
                                        size_t count, off_t offset,
                                        size_t* absl_nullable bytes_read);

// signal_safe_poll() - a wrapper for poll(2) which ignores signals
// Semantics equivalent to poll(2):
//   Returns number of structures with non-zero revent fields.
//
// In the interrupted (EINTR) case, signal_safe_poll will continue attempting to
// poll for data.  Unlike ppoll/pselect, signal_safe_poll is *ignoring* signals
// not attempting to re-enable them.  Protecting us from the traditional races
// involved with the latter.
[[nodiscard]] int signal_safe_poll(struct ::pollfd* fds, int nfds,
                                   absl::Duration timeout);

// Copies memory from multiple source memory chunks (`src_chunks`) to `dst`
// safely using process_vm_readv. If any source chunk points to unmapped or
// concurrently freed/mprotected memory, this function returns false without
// triggering a SIGSEGV crash. Returns true if all chunks were successfully
// copied.
[[nodiscard]] bool SafeCopyMemory(
    absl::Span<const absl::string_view> src_chunks, void* dst);

// Copies `size` bytes from `src` to `dst` safely using process_vm_readv.
// If `src` points to unmapped or concurrently freed/mprotected memory, this
// function returns false without triggering a SIGSEGV crash. Returns true if
// exactly `size` bytes were successfully copied.
[[nodiscard]] bool SafeCopyMemory(const void* src, void* dst, size_t size);

class ScopedSigmask {
 public:
  // Masks all signal handlers. (SIG_SETMASK, All)
  ScopedSigmask() noexcept;

  // No copy, move or assign
  ScopedSigmask(const ScopedSigmask&) = delete;
  ScopedSigmask& operator=(const ScopedSigmask&) = delete;

  // Restores the masked signal handlers to its former state.
  ~ScopedSigmask() noexcept;

 private:
  void Setmask(int how, sigset_t* set, sigset_t* old);

  sigset_t old_set_;
};

inline ScopedSigmask::ScopedSigmask() noexcept {
  sigset_t set;
  sigfillset(&set);
  Setmask(SIG_BLOCK, &set, &old_set_);
}

inline ScopedSigmask::~ScopedSigmask() noexcept {
  // pthread_sigmask filters libc-internal signals (such as glibc's SIGTIMER)
  // out of the new mask, so SIG_SETMASK would unblock them on threads that
  // blocked them with a raw syscall.  Unblock only what was unblocked on entry.
  sigset_t unblock;
  sigemptyset(&unblock);
  for (int sig = 1; sig < NSIG; ++sig) {
    if (sigismember(&old_set_, sig) == 0) sigaddset(&unblock, sig);
  }
  Setmask(SIG_UNBLOCK, &unblock, nullptr);
}

inline void ScopedSigmask::Setmask(int how, sigset_t* set, sigset_t* old) {
  const int result = pthread_sigmask(how, set, old);
  TC_CHECK_EQ(result, 0);
}

// RAII class that will restore errno to the value it has when created.
class ErrnoRestorer {
 public:
  ErrnoRestorer() : saved_errno_(errno) {}
  ~ErrnoRestorer() { errno = saved_errno_; }

  ErrnoRestorer(const ErrnoRestorer&) = delete;
  ErrnoRestorer& operator=(const ErrnoRestorer&) = delete;

 private:
  int saved_errno_;
};

}  // namespace tcmalloc_internal
}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_INTERNAL_UTIL_H_

```

### Core Architecture Module: `tcmalloc/malloc_hook.h`
```
// Copyright 2025 The TCMalloc Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_MALLOC_HOOK_H_
#define TCMALLOC_MALLOC_HOOK_H_

#include <optional>
#include <ostream>

#include "absl/time/time.h"
#include "absl/types/span.h"
#include "tcmalloc/internal/config.h"

GOOGLE_MALLOC_SECTION_BEGIN

namespace tcmalloc {

// Enum to control how a hook can access the memory.
enum class HookMemoryMutable : bool {
  kImmutable,
  kMutable,
};

class MallocHook final {
 public:
  struct NewInfo final {
    // Pointer to the allocated memory.
    void* ptr = nullptr;
    // Requested allocation size.
    size_t requested_size = 0;
    // Actual allocation size, if implemented by the allocator. Defaults to 0.
    size_t allocated_size = 0;
    // Allow a hook to modify the memory.
    HookMemoryMutable is_mutable;
  };

  // The NewHook is invoked whenever an object is being allocated.
  // Object pointer and size are passed in.
  // It may be passed null pointer if the allocator returned null.
  typedef void (*NewHook)(const NewInfo& info);

  [[nodiscard]] static bool AddNewHook(NewHook hook);
  [[nodiscard]] static bool RemoveNewHook(NewHook hook);
  static void InvokeNewHook(const NewInfo& info);

  struct DeleteInfo final {
    // Pointer to the deallocated memory.
    void* ptr = nullptr;
    // Size of the deallocated memory provided by the caller.  nullopt if
    // unknown.
    std::optional<size_t> deallocated_size;
    // Size of the allocated memory.
    size_t allocated_size = 0;
    // Allow a hook to modify the memory.
    HookMemoryMutable is_mutable;
  };

  // The DeleteHook is invoked whenever an object is being deallocated.
  // Object pointer is passed in.
  // It may be passed null pointer if the caller is trying to delete null.
  typedef void (*DeleteHook)(const DeleteInfo& info);

  [[nodiscard]] static bool AddDeleteHook(DeleteHook hook);
  [[nodiscard]] static bool RemoveDeleteHook(DeleteHook hook);
  static void InvokeDeleteHook(const DeleteInfo& info);

  // The SampledNewHook is invoked for some subset of object allocations
  // according to the sampling policy of an allocator such as tcmalloc.
  // SampledAlloc has the following fields:
  //
  //  * AllocHandle handle: to be set to an effectively unique value (in this
  //    process) by allocator.
  //
  //  * size_t allocated_size: space actually used by allocator to host the
  //    object. Not necessarily equal to the requested size due to alignment and
  //    other reasons.
  //
  //  * double weight: the expected number of allocations matching this profile
  //    that this sample represents. This weight does not need to be >= 1.0;
  //    tcmalloc routinely generates weights less than unity (typically in the
  //    case of larger allocations). The value is still expected to be
  //    non-negative.
  //
  //  * stack: invocation stack for the allocation.
  //
  //  * const void* ptr: the address of the allocated memory.
  //
  //  * uint8_t access_hint: the access frequency hint provided to TCMalloc.
  //    This is the raw value of hot_cold_t.
  //
  //  * Access access_allocated: the actual partition (Hot or Cold) where
  //    the memory was allocated.
  //
  // The allocator invoking the hook has all the fields in `SampledAlloc` stored
  // and later call InvokeSampledDeleteHook() with a `SampledAlloc` struct
  // populated by those fields.
  enum class AllocHandle : int64_t {};
  enum class Access : uint8_t {
    Hot,
    Cold,
  };
  struct SampledAlloc final {
    const AllocHandle handle;
    const size_t requested_size;
    const std::optional<std::align_val_t> requested_alignment;
    const size_t allocated_size;
    const double weight;
    const absl::Span<const void* const> stack;
    const absl::Time allocation_time;
    const void* ptr;
    const uint8_t access_hint;
    const Access access_allocated;
  };
  typedef void (*SampledNewHook)(const SampledAlloc& sampled_alloc);
  [[nodiscard]] static bool AddSampledNewHook(SampledNewHook hook);
  [[nodiscard]] static bool RemoveSampledNewHook(SampledNewHook hook);
  static void InvokeSampledNewHook(const SampledAlloc& sampled_alloc);

  // The SampledDeleteHook is invoked whenever an object previously chosen by an
  // allocator for sampling is being deallocated.
  //
  // A `SampledAlloc` struct identifying the object -- as all its fields have
  // been stored by the allocator -- is passed in.
  typedef void (*SampledDeleteHook)(
      const
      SampledAlloc& sampled_alloc);
  [[nodiscard]] static bool AddSampledDeleteHook(SampledDeleteHook hook);
  [[nodiscard]] static bool RemoveSampledDeleteHook(SampledDeleteHook hook);
  static void InvokeSampledDeleteHook(
      const
      SampledAlloc& sampled_alloc);
};

}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

inline std::ostream& operator<<(std::ostream& os,
                                const tcmalloc::MallocHook::AllocHandle& h) {
  return os << static_cast<int64_t>(h);
}

#endif  // TCMALLOC_MALLOC_HOOK_H_

```

### Core Architecture Module: `tcmalloc/malloc_hook_invoke.h`
```
// Copyright 2025 The TCMalloc Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef TCMALLOC_MALLOC_HOOK_INVOKE_H_
#define TCMALLOC_MALLOC_HOOK_INVOKE_H_

#include "absl/base/attributes.h"
#include "tcmalloc/internal/config.h"
#include "tcmalloc/internal/hook_list.h"
#include "tcmalloc/malloc_hook.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc {
namespace tcmalloc_internal {

extern HookList<MallocHook::NewHook> new_hooks_;
extern HookList<MallocHook::DeleteHook> delete_hooks_;

extern HookList<MallocHook::SampledNewHook> sampled_new_hooks_;
extern HookList<MallocHook::SampledDeleteHook> sampled_delete_hooks_;

void InitAtFirstAllocation();

}  // namespace tcmalloc_internal

inline ABSL_ATTRIBUTE_ALWAYS_INLINE void MallocHook::InvokeNewHook(
    const NewInfo& info) {
  tcmalloc_internal::new_hooks_.Invoke(info);
}

inline ABSL_ATTRIBUTE_ALWAYS_INLINE void MallocHook::InvokeDeleteHook(
    const DeleteInfo& info) {
  tcmalloc_internal::delete_hooks_.Invoke(info);
}

inline ABSL_ATTRIBUTE_ALWAYS_INLINE void MallocHook::InvokeSampledNewHook(
    const SampledAlloc& sampled_alloc) {
  tcmalloc_internal::sampled_new_hooks_.Invoke(sampled_alloc);
}

inline ABSL_ATTRIBUTE_ALWAYS_INLINE void MallocHook::InvokeSampledDeleteHook(
    const
    SampledAlloc& sampled_alloc) {
  tcmalloc_internal::sampled_delete_hooks_.Invoke(sampled_alloc);
}

}  // namespace tcmalloc
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_MALLOC_HOOK_INVOKE_H_

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1929** (2026-11-17): **Encode x86-64 rseq signature inside a 7-byte nopl instruction**
  *Symptoms*: Encode x86-64 rseq signature inside a 7-byte nopl instruction  On x86-64, prefix the 4-byte rseq signature with opcode bytes (`0x0f, 0x1f, 0x05`) to form a 7-byte `nopl disp32(%rip)` instruction, using the signature as the displacement. This prevents raw data bytes from desynchronizing linear disassembly across trampolines in `.text.unlikely`. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1929/checks?check_run_id=133030576615) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #1928** (2026-11-14): **Avoid KCFI typeid emission in TestAliasedFunctions.**
  *Symptoms*: Avoid KCFI typeid emission in TestAliasedFunctions.  Co-authored-by: Mike Kruskal <mkruskal@google.com> 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1928/checks?check_run_id=132481476045) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `01b9fd85` (2026-11-17)
**Commit Message**: Propagate DeletePolicy alignment to ReportCorruptedFree.

When a misaligned pointer into a small-object span is passed to aligned `operator delete`, `InvokeHooksAndFreePages` and `handle_sampled_or_illformed_ptrs` reported an expected alignment of `kAlignment` (8 bytes) even when the caller provided a larger alignment.

Pass `std::max(policy.align(), kAlignment)` to `ReportCorruptedFree` so the `InvalidFree` report reflects the caller's alignment.

PiperOrigin-RevId: 1024037018

**File**: `tcmalloc/tcmalloc.cc` (modified, +4/-2)
```diff
@@ -757,7 +757,8 @@ ABSL_ATTRIBUTE_NOINLINE static void InvokeHooksAndFreePages(
     // Spans with a size class are never sampled, guarded, or large, so any
     // pointer into one that reaches here is corrupted.
     if (absl::bit_cast<uintptr_t>(ptr) & kBadAlignmentMask) {
-      ReportCorruptedFree(tc_globals, kAlignment, ptr);
+      ReportCorruptedFree(tc_globals, std::max(policy.align(), kAlignment),
+                          ptr);
     }
     ReportCorruptedFree(tc_globals, ptr);
   }
@@ -976,7 +977,8 @@ ABSL_ATTRIBUTE_NOINLINE static void handle_sampled_or_illformed_ptrs(
   // If we get here, the object is small and this is the last line of defense
   // to report the error.
   TC_ASSERT_EQ((uptr & kBadAlignmentMask) != 0, true);
-  return ReportCorruptedFree(tc_globals, kAlignment, ptr);
+  return ReportCorruptedFree(tc_globals, std::max(policy.align(), kAlignment),
+                             ptr);
 }
 
 template <typename Policy>
```

**File**: `tcmalloc/testing/memory_errors_test.cc` (modified, +24/-0)
```diff
@@ -1061,6 +1061,30 @@ TEST_F(TcMallocTest, CorruptedPointerEdgeCases) {
   }
 }
 
+TEST_F(TcMallocTest, CorruptedPointerAlignedDelete) {
+#if defined(ABSL_HAVE_ADDRESS_SANITIZER) || \
+    defined(ABSL_HAVE_HWADDRESS_SANITIZER)
+  GTEST_SKIP() << "Skipping under address sanitizer";
+#endif
+  ScopedNeverSample never_sample;
+  constexpr std::align_val_t kAlign{64};
+  for (const bool sized : {false, true}) {
+    SCOPED_TRACE(absl::StrCat("sized=", sized));
+    EXPECT_DEATH(
+        {
+          char* ptr = static_cast<char*>(::operator new(8, kAlign));
+          if (sized) {
+            ::operator delete(ptr + 1, 8, kAlign);
+          } else {
+            ::operator delete(ptr + 1, kAlign);
+          }
+        },
+        absl::StrCat(
+            "Attempted to free corrupted pointer"
+            ));
+  }
+}
+
 TEST_F(TcMallocTest, AllocationDeallocationConfusion) {
 #if defined(ABSL_HAVE_HWADDRESS_SANITIZER)
   GTEST_SKIP() << "HWASan does not currently detect alloc-dealloc-mismatch.";
```

---

### Incident Patch 2: `6eb91762` (2026-11-17)
**Commit Message**: Add NUMA residency helpers to Residency.

This adds GetCurrentNumaNode, ForEachRemoteNumaPage, and
Residency::GetRemoteNumaBytes to query per-page remote NUMA residency via
move_pages(2).
PiperOrigin-RevId: 1024012371

**File**: `tcmalloc/internal/BUILD` (modified, +2/-0)
```diff
@@ -636,6 +636,8 @@ cc_library(
         ":page_size",
         ":range_tracker",
         ":util",
+        "@com_google_absl//absl/algorithm:container",
+        "@com_google_absl//absl/functional:function_ref",
         "@com_google_absl//absl/status",
     ],
 )
```

**File**: `tcmalloc/internal/CMakeLists.txt` (modified, +4/-0)
```diff
@@ -649,6 +649,10 @@ tcmalloc_cc_library(
   SRCS
     "residency.cc"
   DEPS
+    "absl::flat_hash_map"
+    "absl::flat_hash_set"
+    "absl::inlined_vector"
+    "absl::function_ref"
     "absl::status"
     "tcmalloc::internal_config"
     "tcmalloc::internal_logging"
```

**File**: `tcmalloc/internal/fake_residency.h` (modified, +5/-0)
```diff
@@ -39,6 +39,11 @@ class NoopResidency : public Residency {
     return kHugePageSize / GetPageSize();
   }
 
+  [[nodiscard]] std::optional<size_t> GetRemoteNumaBytes(
+      const void* addr, size_t size, int local_node) override {
+    return std::nullopt;
+  }
+
   [[nodiscard]] SinglePageBitmaps GetUnbackedAndSwappedBitmaps(
       const void* addr) override {
     return {{}, {}, absl::StatusCode::kOk};
```

**File**: `tcmalloc/internal/residency.cc` (modified, +97/-0)
```diff
@@ -14,24 +14,88 @@
 
 #include "tcmalloc/internal/residency.h"
 
+#include <errno.h>
 #include <fcntl.h>
 #include <stddef.h>
+#if defined(__linux__)
+#include <sys/syscall.h>
+#endif
 #include <unistd.h>
 
 #include <algorithm>
 #include <cstdint>
 #include <cstdio>
+#include <limits>
 #include <optional>
 
+#include "absl/algorithm/container.h"
+#include "absl/functional/function_ref.h"
 #include "absl/status/status.h"
 #include "tcmalloc/internal/config.h"
 #include "tcmalloc/internal/logging.h"
+#include "tcmalloc/internal/page_size.h"
 #include "tcmalloc/internal/range_tracker.h"
 #include "tcmalloc/internal/util.h"
 
 GOOGLE_MALLOC_SECTION_BEGIN
 namespace tcmalloc {
 namespace tcmalloc_internal {
+
+// TODO(b/585745921): Move to internal/numa.h once :numa no longer pulls in
+// :percpu's initial-exec TLS globals.
+int GetCurrentNumaNode() {
+#if defined(__linux__) && defined(SYS_getcpu)
+  unsigned int node = 0;
+  if (syscall(SYS_getcpu, nullptr, &node, nullptr) == 0) {
+    return node;
+  }
+#endif
+  return 0;
+}
+
+bool ForEachRemoteNumaPage(
+    const uintptr_t base_page, const size_t num_pages, const int local_node,
+    const absl::FunctionRef<void(size_t page_index)> on_remote_page) {
+  const size_t kHardwarePageSize = GetPageSize();
+  if (local_node < 0 || (base_page % kHardwarePageSize) != 0) {
+    return false;
+  }
+  if (num_pages == 0) {
+    return true;
+  }
+  if (num_pages - 1 >
+      (std::numeric_limits<uintptr_t>::max() - base_page) / kHardwarePageSize) {
+    return false;
+  }
+#if defined(__linux__) && defined(SYS_move_pages)
+  constexpr size_t kBatchSize = 64;
+  const void* pages[kBatchSize];
+  int status[kBatchSize];
+
+  for (size_t page_idx = 0; page_idx < num_pages;) {
+    const size_t batch = std::min(kBatchSize, num_pages - page_idx);
+    for (size_t i = 0; i < batch; ++i) {
+      pages[i] = reinterpret_cast<const void*>(
+          base_page + static_cast<uintptr_t>(page_idx + i) * kHardwarePageSize);
+    }
+    absl::c_fill(status, -1);
+    if (TCMALLOC_RETRY_ON_TEMP_FAILURE(syscall(SYS_move_pages, 0, batch, pages,
+                                               nullptr, status, 0)) != 0) {
+      return false;
+    }
+    for (size_t i = 0; i < batch; ++i) {
+      if (status[i] >= 0 && status[i] != local_node) {
+        on_remote_page(page_idx + i);
+      }
+    }
+    page_idx += batch;
+  }
+  return true;
+#else
+  return false;
+#endif
+}
+
 namespace {
 
 // From fs/proc/task_mmu.c:
@@ -202,6 +266,39 @@ std::optional<Residency::Info> ResidencyPageMap::Get(const void* const addr,
   return info;
 }
 
+std::optional<size_t> ResidencyPageMap::GetRemoteNumaBytes(
+    const void* const addr, const size_t size, const int local_node) {
+  if (fd_ < 0 || addr == nullptr || local_node < 0) {
+    return std::nullopt;
+  }
+  if (size == 0) {
+    return 0;
+  }
+  const uintptr_t uaddr = reinterpret_cast<uintptr_t>(addr);
+  if (size > std::numeric_limits<uintptr_t>::max() - uaddr) {
+    return std::nullopt;
+  }
+  const uintptr_t end = uaddr + size;
+  const uintptr_t base_page = uaddr & ~(kHardwarePageSize - 1);
+  const uintptr_t last_page = (end - 1) & ~(kHardwarePageSize - 1);
+  const size_t total_pages = (last_page - base_page) / kHardwarePageSize + 1;
+
+  size_t remote_bytes = 0;
+  if (!ForEachRemoteNumaPage(
+          base_page, total_pages, local_node, [&](size_t page_index) {
+            const uintptr_t page_start =
+                base_page +
+                static_cast<uintptr_t>(page_index) * kHardwarePageSize;
+            const uintptr_t span_start = std::max(uaddr, page_start);
+            const size_t page_remaining =
+                kHardwarePageSize - (span_start - page_start);
+            remote_bytes += std::min<size_t>(end - span_start, page_remaining);
+          })) {
+    return std::nullopt;
+  }
+  return remote_bytes;
+}
+
 Residency::SinglePageBitmaps ResidencyPageMap::GetUnbackedAndSwappedBitmaps(
     const void* const addr) {
   Bitmap<kMaxResidencyBits> page_unbacked;
```

**File**: `tcmalloc/internal/residency.h` (modified, +26/-0)
```diff
@@ -21,6 +21,8 @@
 
 #include <optional>
 #include <ostream>
+
+#include "absl/functional/function_ref.h"
 #include "absl/status/status.h"
 #include "tcmalloc/internal/config.h"
 #include "tcmalloc/internal/page_size.h"
@@ -30,6 +32,21 @@ GOOGLE_MALLOC_SECTION_BEGIN
 namespace tcmalloc {
 namespace tcmalloc_internal {
 
+// Returns the NUMA node of the CPU on which the calling thread is currently
+// running, or 0 if unavailable.
+// TODO(b/585745921): Move to internal/numa.h once :numa no longer pulls in
+// :percpu's initial-exec TLS globals.
+[[nodiscard]] int GetCurrentNumaNode();
+
+// Invokes `on_remote_page(page_index)` for each page in
+// `[base_page, base_page + num_pages * GetPageSize())` that resides on a NUMA
+// node other than `local_node` according to move_pages(2). `base_page` must be
+// aligned to `GetPageSize()`. Returns true on success, or false if NUMA
+// residency information is unavailable.
+[[nodiscard]] bool ForEachRemoteNumaPage(
+    uintptr_t base_page, size_t num_pages, int local_node,
+    absl::FunctionRef<void(size_t page_index)> on_remote_page);
+
 // Abstract base class for Residency, which offers information about memory
 // residency: whether or not specific spans of memory are resident in core ("m
 // in core"), swapped, or not present.
@@ -50,6 +67,12 @@ class Residency {
                                                 size_t size) = 0;
   [[nodiscard]] virtual inline size_t GetHardwarePagesInHugePage() const = 0;
 
+  // Returns the number of resident bytes in `[addr, addr + size)` that reside
+  // on a NUMA node other than `local_node`, or std::nullopt if NUMA residency
+  // information is unavailable.
+  [[nodiscard]] virtual std::optional<size_t> GetRemoteNumaBytes(
+      const void* addr, size_t size, int local_node) = 0;
+
   // Struct is ordered with bitmaps first to optimize cacheline usage.
   struct SinglePageBitmaps {
     Bitmap<kMaxResidencyBits> unbacked;
@@ -95,6 +118,9 @@ class ResidencyPageMap : public Residency {
     return kHardwarePagesInHugePage;
   }
 
+  [[nodiscard]] std::optional<size_t> GetRemoteNumaBytes(
+      const void* addr, size_t size, int local_node) override;
+
   // Using a hugepage-aligned address, parse through /proc/self/pagemap
   // to output two bitmaps - one for pages that are unbacked and one for pages
   // that are swapped. Hugepage-sized regions are assumed to be 2MiB in size. A
```

**File**: `tcmalloc/internal/residency_test.cc` (modified, +114/-0)
```diff
@@ -31,6 +31,7 @@
 
 #include <array>
 #include <cstdint>
+#include <limits>
 #include <optional>
 #include <string>
 #include <utility>
@@ -71,6 +72,12 @@ class ResidencySpouse {
     return r_.GetUnbackedAndSwappedBitmaps(addr);
   }
 
+  decltype(auto) GetRemoteNumaBytes(const void* const addr, const size_t size,
+                                    const int local_node) {
+    AllocationGuard g;
+    return r_.GetRemoteNumaBytes(addr, size, local_node);
+  }
+
  private:
   ResidencyPageMap r_;
 };
@@ -634,6 +641,113 @@ TEST(PageMapIntegrationTest, GuardPages) {
   ASSERT_EQ(munmap(raw, 2 * kHugePageSize), 0) << errno;
 }
 
+TEST(ResidenceTest, GetRemoteNumaBytes) {
+  const size_t kHardwarePageSize = GetPageSize();
+  EXPECT_GE(GetCurrentNumaNode(), 0);
+  constexpr size_t kNumPages = 70;
+  constexpr size_t kResidentPages = 66;
+  void* ptr = mmap(nullptr, kNumPages * kHardwarePageSize,
+                   PROT_READ | PROT_WRITE, MAP_ANONYMOUS | MAP_PRIVATE, -1, 0);
+  ASSERT_NE(ptr, MAP_FAILED) << errno;
+
+  {
+    AllocationGuard g;
+    ResidencySpouse bad("/tmp/a667ba48-18ba-4523-a8a7-b49ece3a6c2b");
+    EXPECT_EQ(bad.GetRemoteNumaBytes(ptr, kHardwarePageSize, 0), std::nullopt);
+  }
+
+  ResidencySpouse r;
+  EXPECT_EQ(r.GetRemoteNumaBytes(nullptr, kHardwarePageSize, 0), std::nullopt);
+  EXPECT_EQ(r.GetRemoteNumaBytes(ptr, kHardwarePageSize, -1), std::nullopt);
+  EXPECT_THAT(r.GetRemoteNumaBytes(ptr, 0, 0), Optional(0));
+
+  // Unbacked pages are not resident on any NUMA node.
+  errno = 0;
+  std::optional<size_t> unbacked =
+      r.GetRemoteNumaBytes(ptr, kNumPages * kHardwarePageSize, 0);
+  if (!unbacked.has_value() && (errno == EPERM || errno == ENOSYS)) {
+    const int err = errno;
+    ASSERT_EQ(munmap(ptr, kNumPages * kHardwarePageSize), 0) << errno;
+    GTEST_SKIP() << "move_pages not supported: " << err;
+  }
+  EXPECT_THAT(unbacked, Optional(0));
+
+  // Fault in the first kResidentPages pages across multiple batches, leaving
+  // the remaining pages unbacked.
+  memset(ptr, 1, kResidentPages * kHardwarePageSize);
+  ::benchmark::DoNotOptimize(ptr);
+
+  int actual_node = -1;
+  for (int node = 0; node < 64; ++node) {
+    if (r.GetRemoteNumaBytes(ptr, kHardwarePageSize, node) == size_t{0}) {
+      actual_node = node;
+      break;
+    }
+  }
+  ASSERT_GE(actual_node, 0);
+  EXPECT_THAT(r.GetRemoteNumaBytes(ptr, kHardwarePageSize, actual_node + 1),
+              Optional(kHardwarePageSize));
+
+  // Querying against a node ID that holds none of the pages counts only the
+  // resident pages and respects sub-page start/end offsets.
+  constexpr int kOtherNode = 1000;
+  EXPECT_THAT(
+      r.GetRemoteNumaBytes(ptr, kNumPages * kHardwarePageSize, kOtherNode),
+      Optional(kResidentPages * kHardwarePageSize));
+  EXPECT_THAT(
+      r.GetRemoteNumaBytes(static_cast<char*>(ptr) + 7,
+                           kResidentPages * kHardwarePageSize, kOtherNode),
+      Optional(kResidentPages * kHardwarePageSize - 7));
+  EXPECT_THAT(r.GetRemoteNumaBytes(static_cast<char*>(ptr) + 7,
+                                   kHardwarePageSize - 11, kOtherNode),
+              Optional(kHardwarePageSize - 11));
+
+  const uintptr_t base_page = reinterpret_cast<uintptr_t>(ptr);
+  EXPECT_FALSE(ForEachRemoteNumaPage(base_page + 1, 1, 0, [](size_t) {}));
+  EXPECT_FALSE(ForEachRemoteNumaPage(base_page, 1, -1, [](size_t) {}));
+  std::vector<size_t> remote_indices;
+  ASSERT_TRUE(ForEachRemoteNumaPage(
+      base_page, kNumPages, kOtherNode,
+      [&](size_t page_index) { remote_indices.push_back(page_index); }));
+  ASSERT_EQ(remote_indices.size(), kResidentPages);
+  for (size_t i = 0; i < kResidentPages; ++i) {
+    EXPECT_EQ(remote_indices[i], i);
+  }
+
+  ASSERT_EQ(munmap(ptr, kNumPages * kHardwarePageSize), 0) << errno;
+}
+
+TEST(ResidenceTest, GetRemoteNumaBytesOverflow) {
+  const size_t kHardwarePageSize = GetPageSize();
+  const uintptr_t last_page =
+      std::numeric_limits<uintptr_t>::max() & ~(kHardwarePageSize - 1);
+
+  EXPECT_FALSE(ForEachRemoteNumaPage(last_page, 2, 0, [](size_t) {}));
+
+  ResidencySpouse r;
+  char c = 0;
+  const uintptr_t aligned_addr =
+      reinterpret_cast<uintptr_t>(&c) & ~(kHardwarePageSize - 1);
+  EXPECT_FALSE(ForEachRemoteNumaPage(
+      aligned_addr, std::numeric_limits<size_t>::max(), 0, [](size_t) {}));
+  EXPECT_EQ(r.GetRemoteNumaBytes(reinterpret_cast<const void*>(aligned_addr),
+                                 std::numeric_limits<size_t>::max(), 0),
+            std::nullopt);
+  EXPECT_EQ(r.GetRemoteNumaBytes(reinterpret_cast<const void*>(last_page),
+                                 kHardwarePageSize, 0),
+            std::nullopt);
+  EXPECT_EQ(r.GetRemoteNumaBytes(reinterpret_cast<const void*>(last_page + 1),
+                                 kHardwarePageSize - 1, 0),
+            std::nullopt);
+  errno = 0;
+  std::optional<size_t> last_page_res = r.GetRemoteNumaBytes(
+      reinterpret_cast<const void*>(last_page + 1), kH
```

#### Recent Merged Pull Requests:
- **PR #1929** (2026-11-17): Encode x86-64 rseq signature inside a 7-byte nopl instruction (@copybara-service[bot])
- **PR #1928** (2026-11-14): Avoid KCFI typeid emission in TestAliasedFunctions. (@copybara-service[bot])
- **PR #1925** (2026-11-17): Add NUMA residency helpers to Residency. (@copybara-service[bot])
- **PR #1921** (2026-11-13): Use small-model RIP-relative addressing for tc_globals on x86-64. (@copybara-service[bot])
- **PR #1920** (2026-11-13): Automated Code Change (@copybara-service[bot])
- **PR #1918** (closed): No public description (@copybara-service[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Propagate DeletePolicy alignment to ReportCorruptedFree.

**RULE**:
When implementing operations in `tcmalloc/tcmalloc.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in google/tcmalloc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `01b9fd85`: Propagate DeletePolicy alignment to ReportCorruptedFree.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `tcmalloc/tcmalloc.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
      ReportCorruptedFree(tc_globals, std::max(policy.align(), kAlignment),
                          ptr);
  return ReportCorruptedFree(tc_globals, std::max(policy.align(), kAlignment),
                             ptr);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
      ReportCorruptedFree(tc_globals, kAlignment, ptr);
  return ReportCorruptedFree(tc_globals, kAlignment, ptr);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `01b9fd85` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
