> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/google-tcmalloc-learnings.md`  
> **Source**: github ([https://github.com/google/tcmalloc](https://github.com/google/tcmalloc))  
> **Source Version**: `54de7997`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T04:31:04.601Z  
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
> **Harvest Timestamp**: 2026-11-13T04:31:04.596Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/tcmalloc`
- **Description**: 
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5400 stars

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
- **Issue #1918** (2026-11-12): **No public description**
  *Symptoms*: No public description 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1918/checks?check_run_id=131074588720) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #1917** (2026-11-12): **No public description**
  *Symptoms*: No public description 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1917/checks?check_run_id=131056780267) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

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

### Incident Patch 1: `83ee14af` (2026-11-11)
**Commit Message**: Check for page-rounding overflow in pvalloc.

Overflows fail with ENOMEM.

Co-authored-by: Chris Kennelly <[REDACTED_EMAIL]>
PiperOrigin-RevId: 1019379450

**File**: `tcmalloc/tcmalloc.cc` (modified, +6/-0)
```diff
@@ -2014,6 +2014,9 @@ extern "C" TCMALLOC_INTERNAL_CACHELINE_ALIGNED void* TCMallocInternalPvalloc(
     size = page_size;  // http://man.free4web.biz/man3/libmpatrol.3.html
   }
   size = (size + page_size - 1) & ~(page_size - 1);
+  if (ABSL_PREDICT_FALSE(size == 0)) {
+    return MallocPolicy::handle_oom(std::numeric_limits<size_t>::max());
+  }
   return fast_alloc(size, MallocPolicy().AlignAs(page_size));
 }
 
@@ -2372,6 +2375,9 @@ TCMALLOC_INTERNAL_CACHELINE_ALIGNED void* operator new[](
       size = page_size;                                                        \
     }                                                                          \
     size = (size + page_size - 1) & ~(page_size - 1);                          \
+    if (ABSL_PREDICT_FALSE(size == 0)) {                                       \
+      return MallocPolicy::handle_oom(std::numeric_limits<size_t>::max());     \
+    }                                                                          \
     return fast_alloc(                                                         \
         size,                                                                  \
         MallocPolicy().WithSecurityToken<TokenId{id}>().AlignAs(page_size));   \
```

**File**: `tcmalloc/testing/tcmalloc_fuzzer.cc` (modified, +25/-5)
```diff
@@ -433,19 +433,39 @@ FUZZ_TEST(TCMalloc, VallocFree)
 
 void PvallocFree(size_t size) {
   const size_t page_size = GetSystemPageSize();
-  void* ptr = TCMallocInternalPvalloc(size);
-  ASSERT_TRUE(ptr != nullptr);
-  ASSERT_TRUE(IsAligned(ptr, page_size));
   // pvalloc rounds the request up to a whole page, and pvalloc(0) is one page.
   const size_t rounded =
       std::max(size + page_size - 1, page_size) & ~(page_size - 1);
-  ASSERT_GE(TCMallocInternalMallocSize(ptr), rounded);
-  TCMallocInternalFree(ptr);
+  for (auto fn :
+       {TCMallocInternalPvalloc, TCMallocInternal_alloc_token_0_pvalloc,
+        TCMallocInternal_alloc_token_1_pvalloc}) {
+    void* ptr = fn(size);
+    ASSERT_TRUE(ptr != nullptr);
+    ASSERT_TRUE(IsAligned(ptr, page_size));
+    ASSERT_GE(TCMallocInternalMallocSize(ptr), rounded);
+    TCMallocInternalFree(ptr);
+  }
 }
 
 FUZZ_TEST(TCMalloc, PvallocFree)
     .WithDomains(fuzztest::InRange(size_t{0}, kFuzzingMaxSize));
 
+void EnormousAllocationsFail(size_t size) {
+  for (auto fn :
+       {TCMallocInternalPvalloc, TCMallocInternal_alloc_token_0_pvalloc,
+        TCMallocInternal_alloc_token_1_pvalloc}) {
+    errno = 0;
+    void* ptr = fn(size);
+    EXPECT_EQ(ptr, nullptr);
+    EXPECT_EQ(errno, ENOMEM);
+    TCMallocInternalFree(ptr);
+  }
+}
+
+FUZZ_TEST(TCMalloc, EnormousAllocationsFail)
+    .WithDomains(fuzztest::InRange<size_t>(std::numeric_limits<ssize_t>::max(),
+                                           std::numeric_limits<size_t>::max()));
+
 void CallocCfree(size_t n, size_t elem_size) {
   void* ptr = TCMallocInternalCalloc(n, elem_size);
   ASSERT_TRUE(ptr != nullptr);
```

**File**: `tcmalloc/testing/tcmalloc_test.cc` (modified, +32/-0)
```diff
@@ -94,6 +94,8 @@
 const int kLogMaxMemalign = 18;
 
 extern "C" void* reallocarray(void* ptr, size_t nmemb, size_t size);
+extern "C" void* __alloc_token_0_pvalloc(size_t size) noexcept;
+extern "C" void* __alloc_token_1_pvalloc(size_t size) noexcept;
 
 #if !defined(__GLIBC__)
 extern "C" int malloc_trim(size_t pad);
@@ -398,6 +400,24 @@ TEST(TCMallocTest, EnormousAllocations) {
     ASSERT_EQ(nullptr, p);
     EXPECT_EQ(ENOMEM, errno);
 
+    errno = 0;
+    p = pvalloc(size);
+    EXPECT_EQ(nullptr, p);
+    EXPECT_EQ(ENOMEM, errno);
+    free(p);
+
+    errno = 0;
+    p = __alloc_token_0_pvalloc(size);
+    EXPECT_EQ(nullptr, p);
+    EXPECT_EQ(ENOMEM, errno);
+    free(p);
+
+    errno = 0;
+    p = __alloc_token_1_pvalloc(size);
+    EXPECT_EQ(nullptr, p);
+    EXPECT_EQ(ENOMEM, errno);
+    free(p);
+
     p = ::operator new(size, std::nothrow);
     ASSERT_EQ(nullptr, p);
     p = ::operator new(size, static_cast<std::align_val_t>(16), std::nothrow);
@@ -419,6 +439,18 @@ TEST(TCMallocTest, EnormousAllocations) {
     free(p);
     p = malloc(kMaxSignedSize - i);
     free(p);
+    p = pvalloc(kMaxSignedSize + i);
+    free(p);
+    p = pvalloc(kMaxSignedSize - i);
+    free(p);
+    p = __alloc_token_0_pvalloc(kMaxSignedSize + i);
+    free(p);
+    p = __alloc_token_0_pvalloc(kMaxSignedSize - i);
+    free(p);
+    p = __alloc_token_1_pvalloc(kMaxSignedSize + i);
+    free(p);
+    p = __alloc_token_1_pvalloc(kMaxSignedSize - i);
+    free(p);
   }
 
   for (size_t i = 0; i < 100; i++) {
```

---

### Incident Patch 2: `e9acca27` (2026-11-11)
**Commit Message**: Separate `Span::first_page_` from the inline second-level bitmap to fix a data race.

When returning objects to the central freelist, `CentralFreeList::InsertRange` converts object pointers to span indices outside the central freelist lock by reading the span's starting page number. Concurrently under that lock, pushing or popping objects in 65-to-256-object inline bitmap mode performs a 64-bit non-atomic read-modify-write on `level2_bitmap_word_`, which shares the same 64-bit word as the starting page number.

Store `first_page_` as a standalone member instead of a bitfield. Union the 1-byte second-level bitmap with `cache_size_`, which is only used when bitmaps are disabled, so the 64-byte span size is unchanged.

Co-authored-by: Chris Kennelly <[REDACTED_EMAIL]>
PiperOrigin-RevId: 1019078117

**File**: `tcmalloc/central_freelist_test.cc` (modified, +48/-0)
```diff
@@ -943,6 +943,54 @@ TEST_P(CentralFreeListTest, PassSpanDensityToPageheap) {
   test_function(1, AccessDensityPrediction::kDense);
   test_function(e.objects_per_span(), AccessDensityPrediction::kDense);
 }
+
+// Concurrently removes and inserts objects from several threads so that spans
+// are shared between threads. InsertRange maps objects to indices outside of
+// the CentralFreeList lock, which reads Span metadata (first_page_) while other
+// threads mutate the span's freelist under the lock. Under TSan this checks
+// that the unlocked reads never share a memory location with locked writes
+// (b/582305627).
+TEST_P(CentralFreeListTest, ConcurrentRemoveAndInsert) {
+#if ABSL_HAVE_HWADDRESS_SANITIZER
+  GTEST_SKIP()
+      << "Skipping under HWASan, which uses the top bits of the pointer.";
+#endif
+
+  TypeParam e(std::get<0>(GetParam()).size, std::get<0>(GetParam()).bytes,
+              std::get<0>(GetParam()).num_to_move, std::get<1>(GetParam()));
+  constexpr int kThreads = 4;
+  constexpr int kIterations = 200;
+
+  std::atomic<int> failed_removes{0};
+  std::vector<std::thread> threads;
+  threads.reserve(kThreads);
+  for (int t = 0; t < kThreads; ++t) {
+    threads.emplace_back([&e, &failed_removes]() {
+      void* batch[kMaxObjectsToMove];
+      for (int i = 0; i < kIterations; ++i) {
+        const int got = e.central_freelist().RemoveRange(
+            absl::MakeSpan(batch, e.batch_size()));
+        if (got <= 0) {
+          failed_removes.fetch_add(1, std::memory_order_relaxed);
+          continue;
+        }
+        e.central_freelist().InsertRange(
+            absl::MakeSpan(batch, static_cast<size_t>(got)));
+      }
+    });
+  }
+  for (std::thread& t : threads) {
+    t.join();
+  }
+
+  EXPECT_EQ(failed_removes.load(std::memory_order_relaxed), 0);
+  // Single-object spans skip most of the central freelist's logic.
+  if (e.objects_per_span() != 1) {
+    const SpanStats stats = e.central_freelist().GetSpanStats();
+    EXPECT_EQ(stats.num_spans_requested, stats.num_spans_returned);
+    EXPECT_EQ(stats.obj_capacity, 0);
+  }
+}
 INSTANTIATE_TEST_SUITE_P(
     CentralFreeList, CentralFreeListTest,
     testing::Combine(
```

**File**: `tcmalloc/span.cc` (modified, +4/-1)
```diff
@@ -251,7 +251,10 @@ int Span::DynamicBitmapBuild(size_t size, size_t count, absl::Span<void*> batch,
       break;
     case BitmapMode::kInline256:
       TC_ASSERT_LE(l1_words, kRawBitmapSize);
-      level2_bitmap_ = result == count ? 0 : BitmapWordInit(l1_start, l1_words);
+      level2_bitmap_ =
+          result == count
+              ? 0
+              : static_cast<uint8_t>(BitmapWordInit(l1_start, l1_words));
       break;
     case BitmapMode::kOutlineL2_1:
       TC_ASSERT_LE(l1_words, kBitsPerWord);
```

**File**: `tcmalloc/span.h` (modified, +35/-32)
```diff
@@ -97,8 +97,7 @@ class ABSL_CACHELINE_ALIGNED Span final : public SpanList::Elem {
         allocated_(0),
         cache_size_(0),
         nonempty_index_(0),
-        level2_bitmap_(0),
-        first_page_(first_page.index()),
+        first_page_(first_page),
         raw_bitmap_{} {
     TC_ASSERT_GT(first_page, PageId{0});
     TC_CHECK_LT(first_page.index(), static_cast<uint64_t>(1) << kMaxPageIdBits);
@@ -235,24 +234,25 @@ class ABSL_CACHELINE_ALIGNED Span final : public SpanList::Elem {
     uint16_t freelist_;
   };
   uint16_t allocated_;  // Number of non-free objects
-  uint8_t cache_size_;
+  union {
+    // Used only in BitmapMode::kDisabled (linked-list freelist).
+    uint8_t cache_size_;
+    // L2 summary bitmap, used only in BitmapMode::kInline256.
+    uint8_t level2_bitmap_;
+  };
+  static_assert(kRawBitmapSize <= CHAR_BIT * sizeof(level2_bitmap_));
   uint8_t nonempty_index_;  // The nonempty_ list index for this span.
 
   // The number of bits of the cache space that may be used for bitmap.
   static constexpr size_t kBitmapSize = 8 * sizeof(ObjIdx) * kCacheSize;
 
-  union {
-    struct {
-      uint64_t level2_bitmap_ : kRawBitmapSize;
-      uint64_t first_page_ : kMaxPageIdBits;  // Starting page number.
-      static_assert(kRawBitmapSize + kMaxPageIdBits <= 64);
-    };
-    // Used to pass level2_bitmap_ to DynamicBitmapPushImpl/DynamicBitmapPopWord
-    // as a BitmapElem* in kInline256 mode. Only the low kRawBitmapSize bits are
-    // ever set or cleared (since popped objects are capped at available),
-    // leaving first_page_ in the upper bits intact.
-    BitmapElem level2_bitmap_word_;
-  };
+  // Starting page number. Immutable after construction.
+  //
+  // first_page_ is read without CentralFreeList::lock_ (e.g. by
+  // CentralFreeList::InsertRange via ObjectsToIdx), so it must not share a
+  // memory location (e.g. a bitfield word) with any field that is mutated
+  // under the lock (b/582305627).
+  PageId first_page_;
 
   struct ListSpanState {
     // Embed cache of free objects.
@@ -294,16 +294,18 @@ class ABSL_CACHELINE_ALIGNED Span final : public SpanList::Elem {
   [[nodiscard]] BitmapElem* DynamicBitmap(BitmapMode mode);
   void DynamicBitmapPush(absl::Span<ObjIdx> batch,
                          BitmapMode mode) __restrict__;
-  template <BitmapMode kMode>
+  template <BitmapMode kMode, typename L2Elem = BitmapElem>
   GOOGLE_MALLOC_SECTION static void DynamicBitmapPushImpl(
-      absl::Span<const ObjIdx> batch, BitmapElem* bm, BitmapElem* bm2);
+      absl::Span<const ObjIdx> batch, BitmapElem* bm, L2Elem* bm2);
   [[nodiscard]] size_t DynamicBitmapPop(absl::Span<void* absl_nonnull> batch,
                                         size_t size, size_t objects_per_span,
                                         BitmapMode mode) __restrict__;
-  template <BitmapMode kMode>
-  GOOGLE_MALLOC_SECTION void DynamicBitmapPopWord(
-      char* span_start, void**& batch_pos, void** batch_end, size_t size,
-      size_t objects_per_span, BitmapElem* bm, BitmapElem* bm2);
+  template <BitmapMode kMode, typename L2Elem = BitmapElem>
+  GOOGLE_MALLOC_SECTION void DynamicBitmapPopWord(char* span_start,
+                                                  void**& batch_pos,
+                                                  void** batch_end, size_t size,
+                                                  size_t objects_per_span,
+                                                  BitmapElem* bm, L2Elem* bm2);
   template <BitmapMode kMode>
   [[nodiscard]] GOOGLE_MALLOC_SECTION BitmapElem DynamicBitmapPopBitmap(
       char* word_start, void**& batch_pos, void** batch_end, size_t size,
@@ -490,7 +492,7 @@ inline void Span::BitmapPushBatch(absl::Span<ObjIdx> batch,
   TC_ASSERT_EQ(before + batch.size(), bitmap_.CountBits());
 }
 
-inline PageId Span::first_page() const { return PageId(first_page_); }
+inline PageId Span::first_page() const { return first_page_; }
 
 inline void* Span::start_address() const {
   TC_ASSERT_GT(first_page(), PageId{0});
@@ -681,12 +683,12 @@ ABSL_ATTRIBUTE_ALWAYS_INLINE inline void Span::DynamicBitmapPush(
   TC_ASSERT(!batch.empty());
   switch (mode) {
     case BitmapMode::kInline64:
-      DynamicBitmapPushImpl<BitmapMode::kInline64>(batch, DynamicBitmap(mode),
-                                                   nullptr);
+      DynamicBitmapPushImpl<BitmapMode::kInline64, BitmapElem>(
+          batch, DynamicBitmap(mode), nullptr);
       break;
     case BitmapMode::kInline256:
       DynamicBitmapPushImpl<BitmapMode::kOutlineL2_1>(
-          batch, DynamicBitmap(mode), &level2_bitmap_word_);
+          batch, DynamicBitmap(mode), &level2_bitmap_);
       break;
     case BitmapMode::kOutlineL2_1:
       DynamicBitmapPushImpl<BitmapMode::kOutlineL2_1>(
@@ -705,9 +707,9 @@ ABSL_ATTRIBUTE_ALWAYS_INLINE inline void Span::DynamicBitmapPush(
   }
 }
 
-template <Span::BitmapMode kMode>
+template <Span::BitmapMode kMode, typename L2Elem
```

---

### Incident Patch 3: `b53ab954` (2026-11-12)
**Commit Message**: tcmalloc: fix tcmalloc_benchmark under sanitizers and test runs

- Skip stats/profile benchmarks when linked without TCMalloc (such as under
  sanitizers).
- Scale BM_random_malloc_pages and BM_malloc_pages allocation counts by
  kPageSize so 256K-page variants do not allocate 80 GiB of live heap.
- Reduce stats/profile and random-page allocation volume when running as a
  unit test (TEST_TMPDIR set) to avoid test OOMs and timeouts.

PiperOrigin-RevId: 1020239978

**File**: `tcmalloc/testing/tcmalloc_benchmark.cc` (modified, +44/-11)
```diff
@@ -14,6 +14,7 @@
 
 #include <malloc.h>
 
+#include <algorithm>
 #include <atomic>
 #include <cstddef>
 #include <cstdint>
@@ -258,11 +259,19 @@ BENCHMARK(BM_malloc_pages)
     ->Arg(511)
     ->Arg(513)
     ->Arg(1023)
-    ->Arg(1 + 20 * 1024 * 1024 / (8 * 1024))
+    ->Arg(1 + 20 * 1024 * 1024 / tcmalloc::tcmalloc_internal::kPageSize)
     ->Arg(256);
 
+// Returns true when running as a unit test (under blaze/bazel test, where
+// TEST_TMPDIR is set). Benchmarks use this to scale down working set sizes
+// so dry-run unit tests do not OOM or time out under sanitizers and debug
+// builds.
+static bool IsRunningInTestMode() { return getenv("TEST_TMPDIR") != nullptr; }
+
 static void BM_random_malloc_pages(benchmark::State& state) {
-  const int kMaxOnHeap = 5000;
+  const int kMaxOnHeap =
+      std::max<int>(16, (IsRunningInTestMode() ? 256 : 5000) * 8192 /
+                            tcmalloc::tcmalloc_internal::kPageSize);
   const int kMaxRequestSizePages = 127;
 
   // We don't want random number generation to be a large part of
@@ -276,8 +285,7 @@ static void BM_random_malloc_pages(benchmark::State& state) {
     random_request_size[i] =
         absl::Uniform<int32_t>(rand, 0, kMaxRequestSizePages) + 1;
   }
-  void* v[kMaxOnHeap];
-  memset(v, 0, sizeof(v));
+  std::vector<void*> v(kMaxOnHeap, nullptr);
   size_t r = 0;
   for (int i = 0; i < kMaxOnHeap; ++i) {
     v[i] = malloc_pages(random_request_size[r]);
@@ -335,7 +343,19 @@ static void BM_random_new_delete(benchmark::State& state) {
 }
 BENCHMARK(BM_random_new_delete);
 
+static int MaxStatsAllocations() {
+  return IsRunningInTestMode() ? 1 << 10 : 1 << 20;
+}
+
+static int MaxProfileAllocations() {
+  return IsRunningInTestMode() ? 1 << 10 : 1 << 18;
+}
+
 static void BM_get_stats(benchmark::State& state) {
+  if (&MallocExtension_Internal_GetStats == nullptr) {
+    // Sanitizer builds don't provide this function.
+    return;
+  }
   std::vector<std::unique_ptr<char[]>> allocations;
   const int num_allocations = state.range(0);
   allocations.reserve(num_allocations);
@@ -355,7 +375,7 @@ static void BM_get_stats(benchmark::State& state) {
     benchmark::DoNotOptimize(stats);
   }
 }
-BENCHMARK(BM_get_stats)->Range(1, 1 << 20);
+BENCHMARK(BM_get_stats)->Range(1, MaxStatsAllocations());
 
 static void BM_get_stats_internal(benchmark::State& state) {
   if (&MallocExtension_Internal_GetStats == nullptr) {
@@ -383,10 +403,14 @@ static void BM_get_stats_internal(benchmark::State& state) {
   }
 }
 BENCHMARK(BM_get_stats_internal)
-    ->Range(1, 1 << 20)
+    ->Range(1, MaxStatsAllocations())
     ->Unit(benchmark::kMillisecond);
 
 static void BM_get_stats_pageheap_lock(benchmark::State& state) {
+  if (&MallocExtension_Internal_GetStats == nullptr) {
+    // Sanitizer builds don't provide this function.
+    return;
+  }
   std::vector<std::unique_ptr<char[]>> allocations;
   const int num_allocations = state.range(0);
   allocations.reserve(num_allocations);
@@ -438,7 +462,7 @@ static void BM_get_stats_pageheap_lock(benchmark::State& state) {
   stats_thread.join();
 }
 BENCHMARK(BM_get_stats_pageheap_lock)
-    ->Range(1, 1 << 20)
+    ->Range(1, MaxStatsAllocations())
     ->UseRealTime()
     ->Unit(benchmark::kMillisecond);
 
@@ -469,7 +493,7 @@ static void BM_get_stats_pbtxt_internal(benchmark::State& state) {
   }
 }
 BENCHMARK(BM_get_stats_pbtxt_internal)
-    ->Range(1, 1 << 20)
+    ->Range(1, MaxStatsAllocations())
     ->Unit(benchmark::kMillisecond);
 
 static void BM_get_stats_pbtxt_pageheap_lock(benchmark::State& state) {
@@ -530,11 +554,15 @@ static void BM_get_stats_pbtxt_pageheap_lock(benchmark::State& state) {
   stats_thread.join();
 }
 BENCHMARK(BM_get_stats_pbtxt_pageheap_lock)
-    ->Range(1, 1 << 20)
+    ->Range(1, MaxStatsAllocations())
     ->UseRealTime()
     ->Unit(benchmark::kMillisecond);
 
 static void BM_get_heap_profile(benchmark::State& state) {
+  if (&MallocExtension_Internal_GetStats == nullptr) {
+    // Sanitizer builds don't provide this function.
+    return;
+  }
   std::vector<std::unique_ptr<char[]>> allocations;
   const int num_allocations = state.range(0);
   allocations.reserve(num_allocations);
@@ -552,9 +580,13 @@ static void BM_get_heap_profile(benchmark::State& state) {
         MallocExtension::SnapshotCurrent(ProfileType::kHeap));
   }
 }
-BENCHMARK(BM_get_heap_profile)->Range(1, 1 << 20);
+BENCHMARK(BM_get_heap_profile)->Range(1, MaxStatsAllocations());
 
 static void BM_get_heap_profile_while_allocating(benchmark::State& state) {
+  if (&MallocExtension_Internal_GetStats == nullptr) {
+    // Sanitizer builds don't provide this function.
+    return;
+  }
   std::vector<std::unique_ptr<char[]>> allocations;
   const int num_allocations = state.range(0);
   allocations.reserve(num_allocations);
@@ -592,7 +624,8 @@ static void BM_get_heap_profile_while_allocating(benchmark::State& state) {
   done.Notify();
   profile_thread.join();
 }
-BENCHMARK(BM_get_heap_profile_while_alloca
```

#### Recent Merged Pull Requests:
- **PR #1918** (closed): No public description (@copybara-service[bot])
- **PR #1917** (closed): No public description (@copybara-service[bot])
- **PR #1916** (2026-11-12): Revert: percpu helper change (@copybara-service[bot])
- **PR #1914** (2026-11-12): Use pread in PageFlags. (@copybara-service[bot])
- **PR #1910** (closed): Record remote NUMA residency on heap profile samples. (@copybara-service[bot])
- **PR #1909** (2026-11-12): Record the caller's stack in RecordCrash. (@copybara-service[bot])

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

## X. Check for page-rounding overflow in pvalloc.

**RULE**:
When implementing operations in `tcmalloc/tcmalloc.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in google/tcmalloc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `83ee14af`: Check for page-rounding overflow in pvalloc.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `tcmalloc/tcmalloc.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  if (ABSL_PREDICT_FALSE(size == 0)) {
    return MallocPolicy::handle_oom(std::numeric_limits<size_t>::max());
  }
    if (ABSL_PREDICT_FALSE(size == 0)) {                                       \
      return MallocPolicy::handle_oom(std::numeric_limits<size_t>::max());     \
    }                                                                          \
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `83ee14af` are properly handled with clean fallback behavior.
