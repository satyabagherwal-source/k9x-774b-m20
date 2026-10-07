# Forensic Learning Record (Deep Inspection): google/tcmalloc

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-tcmalloc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/tcmalloc](https://github.com/google/tcmalloc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:32:50.735Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/tcmalloc`
- **Description**: 
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5370 stars

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

    if (allocation_stack.has_value()) {
      size_t allocation_stack_depth =
          std::min<size_t>(kMaxStackDepth, allocation_stack->size());
      memcpy(allocation_stack_, allocation_stack->data(),
             sizeof(void*) * allocation_stack_depth);
      allocation_stack_depth_ = allocation_stack_depth;
    } else {
      allocation_stack_depth_ = std::nullopt;
    }

    if (deallocation_stack.has_value()) {
      size_t deallocation_stack_depth =
          std::min<size_t>(kMaxStackDepth, deallocation_stack->size());
      memcpy(deallocation_stack_, deallocation_stack->data(),
             sizeof(void*) * deallocation_stack_depth);
      deallocation_stack_depth_ = deallocation_stack_depth;
    } else {
      deallocation_stack_depth_ = std::nullopt;
    }
  }

  void RecordDoubleFree(const void* ptr,
                        absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kDoubleFree;

    size_t deallocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, deallocation_stack.size());
    memcpy(deallocation_stack_, deallocation_stack.data(),
           sizeof(void*) * deallocation_stack_depth);
    deallocation_stack_depth_ = deallocation_stack_depth;
  }

  void RecordInvalidFree(const void* ptr,
                         absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kInvalidFree;

    size_t deallocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, deallocation_stack.size());
    memcpy(deallocation_stack_, deallocation_stack.data(),
           sizeof(void*) * deallocation_stack_depth);
    deallocation_stack_depth_ = deallocation_stack_depth;
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

    if (allocation_stack.has_value()) {
      size_t allocation_stack_depth =
          std::min<size_t>(kMaxStackDepth, allocation_stack->size());
      memcpy(allocation_stack_, allocation_stack->data(),
             sizeof(void*) * allocation_stack_depth);
      allocation_stack_depth_ = allocation_stack_depth;
    } else {
      allocation_stack_depth_ = std::nullopt;
    }

    size_t deallocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, deallocation_stack.size());
    memcpy(deallocation_stack_, deallocation_stack.data(),
           sizeof(void*) * deallocation_stack_depth);
    deallocation_stack_depth_ = deallocation_stack_depth;
  }

  void RecordInvalidFree(const void* ptr, std::align_val_t actual_alignment,
                         std::align_val_t expected_alignment,
                         absl::Span<void* const> allocation_stack,
                         absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kInvalidFree;

    actual_alignment_ = actual_alignment;
    expected_alignment_ = expected_alignment;

    size_t allocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, allocation_stack.size());
    memcpy(allocation_stack_, allocation_stack.data(),
           sizeof(void*) * allocation_stack_depth);
    allocation_stack_depth_ = allocation_stack_depth;

    size_t deallocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, deallocation_stack.size());
    memcpy(deallocation_stack_, deallocation_stack.data(),
           sizeof(void*) * deallocation_stack_depth);
    deallocation_stack_depth_ = deallocation_stack_depth;
  }

  void RecordMismatchedFree(const void* ptr, AllocationType alloc_type,
                            AllocationType dealloc_type,
                            absl::Span<void* const> allocation_stack,
                            absl::Span<void* const> deallocation_stack) {
    ptr_ = ptr;
    type_ = Type::kMismatchedFree;

    alloc_type_ = alloc_type;
    dealloc_type_ = dealloc_type;

    const size_t allocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, allocation_stack.size());
    memcpy(allocation_stack_, allocation_stack.data(),
           sizeof(void*) * allocation_stack_depth);
    allocation_stack_depth_ = allocation_stack_depth;

    const size_t deallocation_stack_depth =
        std::min<size_t>(kMaxStackDepth, deallocation_stack.size());
    memcpy(deallocation_stack_, deallocation_stack.data(),
           sizeof(void*) * deallocation_stack_depth);
    deallocation_stack_depth_ = deallocation_stack_depth;
  }

 private:
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
  [[nodiscard]] int Traverse(T* output_array, int n) const;

  // Fast inline implementation for fast path of Invoke*Hook.
  [[nodiscard]] bool empty() const {
    // empty() is only used as an optimization to determine if we should call
    // Traverse which has proper acquire loads.  Memory reordering around a
    // call to empty will either lead to an unnecessary Traverse call, or will
    // miss invoking hooks, neither of which is a problem.
    return priv_end.load(std::memory_order_relaxed) == 0;
  }

  [[nodiscard]] int size() const {
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
  ABSL_ATTRIBUTE_COLD ABSL_ATTRIBUTE_NOINLINE void InvokeSlow(
      Args&&... args) const;

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
  Setmask(SIG_SETMASK, &set, &old_set_);
}

inline ScopedSigmask::~ScopedSigmask() noexcept {
  Setmask(SIG_SETMASK, &old_set_, nullptr);
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

### Core Architecture Module: `tcmalloc/alloc_at_least.h`
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

#ifndef TCMALLOC_ALLOC_AT_LEAST_H_
#define TCMALLOC_ALLOC_AT_LEAST_H_

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(__cplusplus) && defined(__GLIBC__)
#define ALLOC_AT_LEAST_NOEXCEPT noexcept
#else
#define ALLOC_AT_LEAST_NOEXCEPT
#endif

typedef struct {
  void* ptr;
  size_t size;
} alloc_result_t;

alloc_result_t alloc_at_least(size_t min_size) ALLOC_AT_LEAST_NOEXCEPT;

alloc_result_t aligned_alloc_at_least(size_t alignment,
                                      size_t min_size) ALLOC_AT_LEAST_NOEXCEPT;

#ifdef __cplusplus
}
#endif

#endif  // TCMALLOC_ALLOC_AT_LEAST_H_

```

### Core Architecture Module: `tcmalloc/allocation_sample.h`
```
// Copyright 2022 The TCMalloc Authors
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

#ifndef TCMALLOC_ALLOCATION_SAMPLE_H_
#define TCMALLOC_ALLOCATION_SAMPLE_H_

#include <memory>

#include "absl/base/const_init.h"
#include "absl/base/internal/spinlock.h"
#include "absl/base/thread_annotations.h"
#include "absl/time/time.h"
#include "tcmalloc/internal/config.h"
#include "tcmalloc/internal/logging.h"
#include "tcmalloc/malloc_extension.h"
#include "tcmalloc/stack_trace_table.h"

GOOGLE_MALLOC_SECTION_BEGIN
namespace tcmalloc::tcmalloc_internal {

class AllocationSampleList;

class AllocationSample final : public AllocationProfilingTokenBase {
 public:
  AllocationSample(AllocationSampleList* absl_nonnull list
                       TCMALLOC_CAPTURED_BY_THIS,
                   absl::Time start);
  ~AllocationSample() override;

  [[nodiscard]] Profile Stop() && override;

 private:
  AllocationSampleList* absl_nonnull list_;
  std::unique_ptr<StackTraceTable> mallocs_;
  absl::Time start_;
  AllocationSample* absl_nullable next_ = nullptr;
  friend class AllocationSampleList;
};

class AllocationSampleList {
 public:
  constexpr AllocationSampleList() = default;

  void Add(AllocationSample* absl_nonnull as TCMALLOC_CAPTURED_BY_THIS) {
    AllocationGuardSpinLockHolder h(lock_);
    as->next_ = first_;
    first_ = as;
  }

  // This list is very short and we're nowhere near a hot path, just walk
  void Remove(AllocationSample* absl_nonnull as) {
    AllocationGuardSpinLockHolder h(lock_);
    AllocationSample** link = &first_;
    AllocationSample* cur = first_;
    while (cur != as) {
      TC_CHECK_NE(cur, nullptr);
      link = &cur->next_;
      cur = cur->next_;
    }
    *link = as->next_;
  }

  void ReportMalloc(const struct StackTrace& sample) {
    // Check that StackTrace was zero-initialized so we don't leak uninitialized
    // memory (potentially holding cryptographic material) into core dumps.
    TC_CHECK(sample.depth == kMaxStackDepth ||
             sample.stack[sample.depth] == nullptr);
    AllocationGuardSpinLockHolder h(lock_);
    AllocationSample* cur = first_;
    while (cur != nullptr) {
      cur->mallocs_->AddTrace(1.0, sample);
      cur = cur->next_;
    }
  }

 private:
  // Guard against any concurrent modifications on the list of allocation
  // samples. Invoking `new` while holding this lock can lead to deadlock.
  absl::base_internal::SpinLock lock_{
      absl::base_internal::SCHEDULE_KERNEL_ONLY};
  AllocationSample* absl_nullable first_ ABSL_GUARDED_BY(lock_) = nullptr;
};

}  // namespace tcmalloc::tcmalloc_internal
GOOGLE_MALLOC_SECTION_END

#endif  // TCMALLOC_ALLOCATION_SAMPLE_H_

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1324** (2026-10-07): **Clean up test only experiment label for release stale pages.**
  *Symptoms*: Clean up test only experiment label for release stale pages. 

- **Issue #1323** (2026-10-07): **Currently page allocators return Span* as the result of allocation,**
  *Symptoms*: Currently page allocators return Span* as the result of allocation, and allocate/deallocate/register these spans. This bit of logic has low cohesion (has nothing to do) with page allocation.  Make page allocators return AllocationState, which is already used by deallocation functions (which makes the interface symmetric).  This is a preparation for removing Span, and minimizing subsequent diffs. 

- **Issue #1319** (2026-10-07): **No public description**
  *Symptoms*: No public description 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1319/checks?check_run_id=112639022802) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #1317** (2026-10-07): **Include unallocated and unavailable arena bytes in tcmalloc.metadata_bytes**
  *Symptoms*: Include unallocated and unavailable arena bytes in tcmalloc.metadata_bytes 

- **Issue #1316** (2026-10-07): **tcmalloc: Remove `TCMALLOC_SHARDED_TC_ABLATION` experiment**
  *Symptoms*: tcmalloc: Remove `TCMALLOC_SHARDED_TC_ABLATION` experiment 

- **Issue #1314** (2026-10-07): **Roll out sharded transfer cache ablation experiment.**
  *Symptoms*: Roll out sharded transfer cache ablation experiment. 

- **Issue #1313** (2026-10-07): **Expose arena unavailable and unallocated bytes in MallocExtension properties**
  *Symptoms*: Expose arena unavailable and unallocated bytes in MallocExtension properties  Expose `stats.arena.bytes_unavailable` and `stats.arena.bytes_unallocated` as `tcmalloc.metadata_arena_unavailable_bytes` and `tcmalloc.metadata_arena_unallocated_bytes` in `MallocExtension::GetProperties` and `MallocExtension::GetNumericProperty` (matching `malloc_metadata_arena_unavailable` and `malloc_metadata_arena_unallocated` in `DumpStatsInPbtxt`). 

- **Issue #1312** (2026-10-07): **Remove HugePageAwareAllocator::FinalizeType and Unspanify.**
  *Symptoms*: Remove HugePageAwareAllocator::FinalizeType and Unspanify. 

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

### Incident Patch 1: `05815ee4` (2026-10-05)
**Commit Message**: Fix per_size_class_counts accounting leak in SampleifyAllocation.

Update per_size_class_counts only after guarded or page allocation succeeds in SampleifyAllocation so failed allocations do not leak size class counts.

PiperOrigin-RevId: 993747501

**File**: `tcmalloc/allocation_sampling.h` (modified, +2/-2)
```diff
@@ -124,8 +124,6 @@ ABSL_ATTRIBUTE_NOINLINE sized_ptr_t SampleifyAllocation(
           : MemoryTag::kSampled;
   size_t capacity = 0;
   if (size_class != 0) {
-    state.per_size_class_counts()[size_class].Add(allocation_estimate);
-
     stack_trace.allocated_size = state.sizemap().class_to_size(size_class);
     stack_trace.cold_allocated = IsColdSizeClass(size_class);
 
@@ -157,6 +155,8 @@ ABSL_ATTRIBUTE_NOINLINE sized_ptr_t SampleifyAllocation(
     } else {
       return {};
     }
+
+    state.per_size_class_counts()[size_class].Add(allocation_estimate);
   } else {
     // Set stack_trace.allocated_size to the exact size for a page allocation.
     // NOTE: if we introduce gwp-asan sampling / guarded allocations
```

---

### Incident Patch 2: `0aff5d04` (2026-10-05)
**Commit Message**: Use suite for central_freelist_benchmark

4/8/32/256K page configs differ a lots number of objects per span,
which affects CFL performance. Create a suite to benchmark
all of these variants.

PiperOrigin-RevId: 993675006

**File**: `tcmalloc/BUILD` (modified, +8/-4)
```diff
@@ -22,7 +22,13 @@ load("@rules_cc//cc:cc_binary.bzl", "cc_binary")
 load("@rules_cc//cc:cc_library.bzl", "cc_library")
 load("@rules_cc//cc:cc_test.bzl", "cc_test")
 load("//tcmalloc:copts.bzl", "TCMALLOC_DEFAULT_COPTS", "TCMALLOC_DEFAULT_CXXOPTS")
-load("//tcmalloc:variants.bzl", "create_tcmalloc_benchmark", "create_tcmalloc_libraries", "create_tcmalloc_testsuite")
+load(
+    "//tcmalloc:variants.bzl",
+    "create_tcmalloc_benchmark",
+    "create_tcmalloc_benchmark_suite",
+    "create_tcmalloc_libraries",
+    "create_tcmalloc_testsuite",
+)
 
 package(default_visibility = ["//visibility:private"])
 
@@ -1638,13 +1644,11 @@ create_tcmalloc_testsuite(
     ],
 )
 
-create_tcmalloc_benchmark(
+create_tcmalloc_benchmark_suite(
     name = "central_freelist_benchmark",
     srcs = ["central_freelist_benchmark.cc"],
     copts = TCMALLOC_DEFAULT_COPTS,
-    malloc = "//tcmalloc",
     deps = [
-        ":common_8k_pages",
         "//tcmalloc/internal:bytes",
         "//tcmalloc/internal:config",
         "//tcmalloc/internal:logging",
```

**File**: `tcmalloc/CMakeLists.txt` (modified, +1/-3)
```diff
@@ -1874,7 +1874,7 @@ tcmalloc_cc_test_variants(
     "tcmalloc::testing_thread_manager"
 )
 
-tcmalloc_cc_binary(
+tcmalloc_cc_binary_variants(
   NAME
     tcmalloc_central_freelist_benchmark
   SRCS
@@ -1892,11 +1892,9 @@ tcmalloc_cc_binary(
     "absl::time"
     "benchmark::benchmark"
     "benchmark::benchmark_main"
-    "tcmalloc::common_8k_pages"
     "tcmalloc::internal_bytes"
     "tcmalloc::internal_config"
     "tcmalloc::internal_logging"
-    "tcmalloc::tcmalloc"
 )
 
 tcmalloc_cc_library(
```

---

### Incident Patch 3: `206c07db` (2026-10-05)
**Commit Message**: Skip hugepage fragmentation stats in the OOM crash report.

Crash() dumps malloc stats when operator new fails.  The dump reads
/sys/devices/system/node/node*/hugepage_fragmentation_ratio for every NUMA
node, which takes hundreds of milliseconds per node on production kernels and
describes the machine rather than the allocation that failed.  Make the read
an explicit include_hugepage_fragmentation argument of DumpStats and
TCMalloc_Internal_GetStats: MallocExtension::GetStats and malloc_stats keep
it, the crash path and drain_test (which parses only per-CPU cache lines)
drop it.
PiperOrigin-RevId: 993411318

**File**: `tcmalloc/global_stats.cc` (modified, +11/-9)
```diff
@@ -310,7 +310,7 @@ static absl::string_view PerCpuTypeString(RseqVcpuMode mode) {
   return "NONE";
 }
 
-void DumpStats(Printer& out, int level) {
+void DumpStats(Printer& out, int level, bool include_hugepage_fragmentation) {
   TCMallocStats stats;
   uint64_t class_count[kNumClasses];
   SpanStats span_stats[kNumClasses];
@@ -467,14 +467,16 @@ void DumpStats(Printer& out, int level) {
     // clang-format on
   }
 
-  out.printf("\nMachine-level hugepage fragmentation stats:\n");
-  const size_t num_nodes = tc_globals.numa_topology().num_nodes();
-  for (size_t node = 0; node < num_nodes; node++) {
-    std::optional<double> hugepage_frag_ratio =
-        GetHugepageFragmentationRatio(node);
-    if (hugepage_frag_ratio.has_value()) {
-      out.printf("TOTAL: %12.3f Hugepage fragmentation ratio (node%zu)\n",
-                 *hugepage_frag_ratio, node);
+  if (include_hugepage_fragmentation) {
+    out.printf("\nMachine-level hugepage fragmentation stats:\n");
+    const size_t num_nodes = tc_globals.numa_topology().num_nodes();
+    for (size_t node = 0; node < num_nodes; node++) {
+      std::optional<double> hugepage_frag_ratio =
+          GetHugepageFragmentationRatio(node);
+      if (hugepage_frag_ratio.has_value()) {
+        out.printf("TOTAL: %12.3f Hugepage fragmentation ratio (node%zu)\n",
+                   *hugepage_frag_ratio, node);
+      }
     }
   }
 
```

**File**: `tcmalloc/global_stats.h` (modified, +5/-1)
```diff
@@ -76,7 +76,11 @@ size_t LocalBytes(const TCMallocStats& stats);
 size_t SlackBytes(const BackingStats& stats);
 
 // WRITE stats to "out"
-void DumpStats(Printer& out, int level);
+//
+// The machine-level hugepage fragmentation ratio is one sysfs read per NUMA
+// node, which takes hundreds of milliseconds each on production kernels, so
+// callers that are crashing skip it.
+void DumpStats(Printer& out, int level, bool include_hugepage_fragmentation);
 void DumpStatsInPbtxt(Printer& out, int level);
 
 bool GetNumericProperty(const char* name_data, size_t name_size,
```

**File**: `tcmalloc/internal/logging.cc` (modified, +5/-1)
```diff
@@ -173,7 +173,11 @@ void RecordCrash(absl::string_view detector, absl::string_view error) {
   if (first_crash && oom) {
 #ifndef __APPLE__
     if (&TCMalloc_Internal_GetStats != nullptr) {
-      size_t n = TCMalloc_Internal_GetStats(stats_buffer, kStatsBufferSize);
+      // Machine-level hugepage fragmentation says nothing about why this
+      // process ran out of memory and costs a sysfs read per NUMA node.
+      size_t n =
+          TCMalloc_Internal_GetStats(stats_buffer, kStatsBufferSize,
+                                     /*include_hugepage_fragmentation=*/false);
       (*log_message_writer)(stats_buffer, std::min(n, kStatsBufferSize));
     }
 #endif  // __APPLE__
```

**File**: `tcmalloc/internal/parameter_accessors.h` (modified, +2/-2)
```diff
@@ -67,8 +67,8 @@ TCMalloc_Internal_GetPrioritizeSpansEnabled();
 TCMalloc_Internal_GetPeakSamplingHeapGrowthFraction();
 [[nodiscard]] ABSL_ATTRIBUTE_WEAK bool
 TCMalloc_Internal_GetPerCpuCachesEnabled();
-[[nodiscard]] ABSL_ATTRIBUTE_WEAK size_t
-TCMalloc_Internal_GetStats(char* buffer, size_t buffer_length);
+[[nodiscard]] ABSL_ATTRIBUTE_WEAK size_t TCMalloc_Internal_GetStats(
+    char* buffer, size_t buffer_length, bool include_hugepage_fragmentation);
 ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_SetGuardedSamplingInterval(
     int64_t v);
 ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_SetHeapSizeHardLimit(uint64_t v);
```

**File**: `tcmalloc/tcmalloc.cc` (modified, +15/-14)
```diff
@@ -223,7 +223,7 @@ static void PrintStats(int level) {
   const int kBufferSize = 64 << 10;
   char* buffer = new char[kBufferSize];
   Printer printer(buffer, kBufferSize);
-  DumpStats(printer, level);
+  DumpStats(printer, level, /*include_hugepage_fragmentation=*/true);
   (void)write(STDERR_FILENO, buffer, strlen(buffer));
   delete[] buffer;
 }
@@ -237,28 +237,29 @@ extern "C" void MallocExtension_Internal_GetStats(std::string* ret) {
     bool success = false;
     absl::StringResizeAndOverwrite(
         *ret, size - 1,
-        [&](char* buffer,
-            size_t buffer_size) ABSL_ATTRIBUTE_ALWAYS_INLINE -> size_t {
-          size_t written_size = TCMalloc_Internal_GetStats(buffer, buffer_size);
-          if (written_size < buffer_size) {
-            success = true;
-            return written_size;
-          }
-          return 0;
-        });
+        [&](char* buffer, size_t buffer_size)
+            ABSL_ATTRIBUTE_ALWAYS_INLINE -> size_t {
+              size_t written_size = TCMalloc_Internal_GetStats(
+                  buffer, buffer_size, /*include_hugepage_fragmentation=*/true);
+              if (written_size < buffer_size) {
+                success = true;
+                return written_size;
+              }
+              return 0;
+            });
     if (success) {
       return;
     }
   }
 }
 
-extern "C" size_t TCMalloc_Internal_GetStats(char* buffer,
-                                             size_t buffer_length) {
+extern "C" size_t TCMalloc_Internal_GetStats(
+    char* buffer, size_t buffer_length, bool include_hugepage_fragmentation) {
   Printer printer(buffer, buffer_length);
   if (buffer_length < 10000) {
-    DumpStats(printer, 1);
+    DumpStats(printer, 1, include_hugepage_fragmentation);
   } else {
-    DumpStats(printer, 2);
+    DumpStats(printer, 2, include_hugepage_fragmentation);
   }
 
   printer.printf("\nLow-level allocator stats:\n");
```

**File**: `tcmalloc/testing/drain_test.cc` (modified, +2/-1)
```diff
@@ -75,7 +75,8 @@ void GetMallocStats(std::string* buffer) {
   buffer->resize(buffer->capacity());
 
   TC_CHECK(&TCMalloc_Internal_GetStats != nullptr);
-  size_t required = TCMalloc_Internal_GetStats(buffer->data(), buffer->size());
+  size_t required = TCMalloc_Internal_GetStats(
+      buffer->data(), buffer->size(), /*include_hugepage_fragmentation=*/false);
   EXPECT_LE(required, buffer->size());
 
   buffer->resize(std::min(required, buffer->size()));
```

---

### Incident Patch 4: `a1d0caf5` (2026-10-02)
**Commit Message**: Revert: Turn on per-CPU metadata slab releasing per default.

PiperOrigin-RevId: 992238022

**File**: `tcmalloc/parameters.cc` (modified, +1/-1)
```diff
@@ -248,7 +248,7 @@ ABSL_CONST_INIT std::atomic<MadviseSampledAllocations>
 ABSL_CONST_INIT std::atomic<int64_t> Parameters::event_trace_memory_limit_(
     16 << 20);
 ABSL_CONST_INIT
-std::atomic<bool> Parameters::release_drained_slab_metadata_(true);
+std::atomic<bool> Parameters::release_drained_slab_metadata_(false);
 ABSL_CONST_INIT std::atomic<bool> Parameters::huge_region_adaptive_release_(
     true);
 
```

**File**: `tcmalloc/testing/get_stats_test.cc` (modified, +2/-2)
```diff
@@ -171,7 +171,7 @@ TEST_F(GetStatsTest, Pbtxt) {
     EXPECT_THAT(buf, HasSubstr("tcmalloc_release_stale_pages: false"));
   }
 
-  EXPECT_THAT(buf, HasSubstr("tcmalloc_release_drained_slab_metadata: true"));
+  EXPECT_THAT(buf, HasSubstr("tcmalloc_release_drained_slab_metadata: false"));
 
   EXPECT_THAT(buf, HasSubstr("tcmalloc_cfl_subbucket_prioritization: true"));
 
@@ -331,7 +331,7 @@ TEST_F(GetStatsTest, Parameters) {
 
     EXPECT_THAT(
         buf,
-        HasSubstr(R"(PARAMETER tcmalloc_release_drained_slab_metadata 1)"));
+        HasSubstr(R"(PARAMETER tcmalloc_release_drained_slab_metadata 0)"));
 
     EXPECT_THAT(
         buf, HasSubstr(R"(PARAMETER tcmalloc_cfl_subbucket_prioritization 1)"));
```

---

### Incident Patch 5: `968eb668` (2026-10-01)
**Commit Message**: Fix the default flag value of tcmalloc_release_drained_slab_metadata.

PiperOrigin-RevId: 991918191

**File**: `tcmalloc/internal/parameter_accessors.h` (modified, +1/-0)
```diff
@@ -137,6 +137,7 @@ ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_GetSizeClasses(
     std::vector<tcmalloc::tcmalloc_internal::TracerSizeClassInfo>* absl_nonnull
         size_classes);
 ABSL_ATTRIBUTE_WEAK size_t TCMalloc_Internal_GetPageSize();
+ABSL_ATTRIBUTE_WEAK bool TCMalloc_Internal_GetReleaseDrainedSlabMetadata();
 ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_SetReleaseDrainedSlabMetadata(
     bool v);
 ABSL_ATTRIBUTE_WEAK bool TCMalloc_Internal_GetPageAllocationStatus(
```

**File**: `tcmalloc/parameters.cc` (modified, +5/-0)
```diff
@@ -737,6 +737,11 @@ void TCMalloc_Internal_SetEventTraceMemoryLimit(int64_t v) {
   Parameters::event_trace_memory_limit_.store(v, std::memory_order_relaxed);
 }
 
+bool TCMalloc_Internal_GetReleaseDrainedSlabMetadata() {
+  return Parameters::release_drained_slab_metadata_.load(
+      std::memory_order_relaxed);
+}
+
 void TCMalloc_Internal_SetReleaseDrainedSlabMetadata(bool v) {
   Parameters::release_drained_slab_metadata_.store(v,
                                                    std::memory_order_relaxed);
```

**File**: `tcmalloc/parameters.h` (modified, +1/-0)
```diff
@@ -292,6 +292,7 @@ class Parameters {
   friend void ::TCMalloc_Internal_SetMadviseSampledAllocations(
       tcmalloc::tcmalloc_internal::MadviseSampledAllocations v);
   friend void ::TCMalloc_Internal_SetEventTraceMemoryLimit(int64_t v);
+  friend bool ::TCMalloc_Internal_GetReleaseDrainedSlabMetadata();
   friend void ::TCMalloc_Internal_SetReleaseDrainedSlabMetadata(bool v);
 
   static std::atomic<int64_t> guarded_sampling_interval_;
```

---

### Incident Patch 6: `fc702b13` (2026-10-01)
**Commit Message**: Use `MemoryTag::kNormal` in `HugePageAwareAllocatorTest.ReleaseMaxFillerPages`.

PiperOrigin-RevId: 991696108

**File**: `tcmalloc/huge_page_aware_allocator_test.cc` (modified, +1/-1)
```diff
@@ -2343,7 +2343,7 @@ TEST(HugePageAwareAllocatorTest, ReleaseMaxFillerPages) {
   };
 
   for (const auto& test_case : kTestCases) {
-    FakeHugePageAwareAllocator allocator({});
+    FakeHugePageAwareAllocator allocator({.tag = MemoryTag::kNormal});
     allocator.forwarder().set_filler_skip_subrelease_short_interval(
         test_case.enable_smoothing ? absl::Minutes(1) : absl::ZeroDuration());
     allocator.forwarder().set_filler_skip_subrelease_long_interval(
```

---

### Incident Patch 7: `eb4f7c44` (2026-10-01)
**Commit Message**: Re-enable the four disabled memory_errors_fuzz tests.

Each FUZZ_TEST had been disabled for a distinct harness defect:

*   MismatchedSizedDelete crashed with rip=0: this binary links
    tcmalloc_internal_methods_only, so the weak
    MallocExtension_Internal_Get{Estimated,}AllocatedSize declarations resolve
    to nullptr.  Use the always-defined TCMalloc_Internal_* entry points.  The
    oracle also assumed a size-class estimate for every allocation; sampled
    (including GWP-ASan guarded) allocations record and compare the requested
    size, while unsampled large spans accept any size that rounds to the same
    page count.
*   MismatchedAlignedDelete and MismatchedAlignedFree expected every alignment
    mismatch to be reported.  Only sampled allocations record their requested
    alignment; the unsampled sized-delete fast path recomputes the size class
    from the caller's size and alignment.  Expect an error only for sampled
    memory, and treat malloc/free_sized as carrying alignof(std::max_align_t),
    which is what TCMalloc records.
*   MisalignedPointer expected every misaligned pointer to be caught.  An
    unsampled size-classful object misaligned by a multiple of

**File**: `tcmalloc/testing/memory_errors_fuzz.cc` (modified, +169/-19)
```diff
@@ -47,6 +47,14 @@ bool IsOwned(void* ptr) {
          MallocExtension::Ownership::kOwned;
 }
 
+// Upper bound on the sizes the fuzzer requests from the allocator.  It covers
+// the size-class, page heap, and hugepage-sized paths; anything larger only
+// adds address space and per-page metadata.  Unbounded sizes drive the fuzzer
+// out of memory: multi-TiB requests cost gigabytes of metadata, and an
+// iteration that provokes an error necessarily leaks its allocation because
+// the deallocation was interrupted mid-way.
+constexpr size_t kMaxFuzzAllocationSize = 2 * kHugePageSize;
+
 TEST(MemoryErrorsTest, IsOwnedTest) {
   // Ensure IsOwned is not tautologically true or false.
   void* ptr = TCMallocInternalNew(1);
@@ -110,7 +118,9 @@ TEST(MemoryErrorsFuzzTest, WildPointerReallocRegression) {
   WildPointerRealloc(4406726867650173363ull, 1);
 }
 
-FUZZ_TEST(MemoryErrorsFuzzTest, WildPointerRealloc);
+FUZZ_TEST(MemoryErrorsFuzzTest, WildPointerRealloc)
+    .WithDomains(fuzztest::Arbitrary<uintptr_t>(),
+                 fuzztest::InRange<size_t>(0, kMaxFuzzAllocationSize));
 
 void WildPointerSizedDelete(uintptr_t ptr, size_t size) {
   GTEST_SKIP() << "Skipping";
@@ -168,12 +178,16 @@ void MismatchedSizedDelete(size_t allocated, size_t deallocated) {
   }
 
   // The pointer needs to be sampled or large for us to detect the error.
-  if (!IsSampledMemory(ptr) && deallocated <= kMaxSize) {
+  const bool sampled = IsSampledMemory(ptr);
+  if (!sampled && deallocated <= kMaxSize) {
     TCMallocInternalDeleteSized(ptr, allocated);
     return;
   }
 
-  const size_t actual_size = MallocExtension_Internal_GetAllocatedSize(ptr);
+  // This binary links tcmalloc_internal_methods_only, which omits the
+  // MallocExtension_Internal_* entry points; the weak declarations resolve to
+  // nullptr.  Use the always-defined TCMalloc_Internal_* equivalents.
+  const size_t actual_size = TCMalloc_Internal_GetAllocatedSize(ptr);
 
   LongJmpScope scope;
   if (setjmp(scope.buf_)) {
@@ -183,21 +197,41 @@ void MismatchedSizedDelete(size_t allocated, size_t deallocated) {
   TCMallocInternalDeleteSized(ptr, deallocated);
   // We should have caught the error and not reached this point.  An error did
   // not occur only if the sizes match.
-  CHECK_EQ(MallocExtension_Internal_GetEstimatedAllocatedSize(deallocated),
-           actual_size);
+  //
+  // Sampled allocations (including GWP-ASan guarded ones) record the requested
+  // size and require an exact match.  Unsampled large allocations only know
+  // the page-rounded span size, so any size that rounds to the same number of
+  // pages is accepted.
+  if (sampled) {
+    CHECK_EQ(deallocated, allocated);
+  } else {
+    CHECK_EQ(TCMalloc_Internal_GetEstimatedAllocatedSize(deallocated),
+             actual_size);
+  }
 }
 
 TEST(MemoryErrorsFuzzTest, MismatchedSizedDeleteRegression) {
   MismatchedSizedDelete(7947537452012049129, 0);
 }
 
-// TODO: b/457842787 - Re-enable once the test is fixed.
-TEST(MemoryErrorsFuzzTest, DISABLED_MismatchedSizedDeleteRegression2) {
+TEST(MemoryErrorsFuzzTest, MismatchedSizedDeleteRegression2) {
   MismatchedSizedDelete(549755813888, 15561727408584254371ull);
 }
 
-// TODO: b/457842787 - Re-enable once the test is fixed.
-FUZZ_TEST(DISABLED_MemoryErrorsFuzzTest, MismatchedSizedDelete);
+TEST(MemoryErrorsFuzzTest, MismatchedSizedDeleteSampledRegression) {
+  // GWP-ASan reports the requested size (7) from GetAllocatedSize while the
+  // size-class estimate for 7 bytes is 8, so a matching sampled delete must be
+  // judged by the requested size rather than the estimate.
+  ScopedAlwaysSample always_sample;
+  for (int i = 0; i < 4; ++i) {
+    MismatchedSizedDelete(7, 7);
+    MismatchedSizedDelete(7, 8);
+  }
+}
+
+FUZZ_TEST(MemoryErrorsFuzzTest, MismatchedSizedDelete)
+    .WithDomains(fuzztest::InRange<size_t>(0, kMaxFuzzAllocationSize),
+                 fuzztest::Arbitrary<size_t>());
 
 void MismatchedAlignedDelete(
     size_t size, std::optional<std::align_val_t> allocated_alignment,
@@ -215,6 +249,19 @@ void MismatchedAlignedDelete(
     return;
   }
 
+  // Only sampled allocations record their requested alignment.  The sized
+  // delete fast path for unsampled memory recomputes the size class from the
+  // provided size and alignment without consulting metadata, so a mismatch is
+  // not detected (outside of debug assertions).
+  if (!IsSampledMemory(ptr)) {
+    if (allocated_alignment.has_value()) {
+      TCMallocInternalDeleteSizedAligned(ptr, size, *allocated_alignment);
+    } else {
+      TCMallocInternalDeleteSized(ptr, size);
+    }
+    return;
+  }
+
   LongJmpScope scope;
   if (setjmp(scope.buf_)) {
     return;
@@ -228,10 +275,23 @@ void MismatchedAlignedDelete(
   CHECK_EQ(allocated_alignment, deallocated_alignment);
 }
 
-// TODO: b/457842787 - Re-enable once the test is fixed.
-FUZZ_TEST(DISABLED_MemoryErrorsFuzzTest, MismatchedAlignedDelete)
+TEST(MemoryErrorsFuzzTest, MismatchedAlignedDeleteRe
```

---

### Incident Patch 8: `c59f9640` (2026-09-30)
**Commit Message**: Release as much memory as possible from sampled heap filler.

PiperOrigin-RevId: 991280689

**File**: `tcmalloc/global_stats.cc` (modified, +4/-0)
```diff
@@ -652,6 +652,8 @@ void DumpStats(Printer& out, int level) {
                Parameters::release_max_cold_pages() ? 1 : 0);
     out.printf("PARAMETER tcmalloc_release_max_filler_pages %d\n",
                Parameters::release_max_filler_pages() ? 1 : 0);
+    out.printf("PARAMETER tcmalloc_release_max_sampled_pages %d\n",
+               Parameters::release_max_sampled_pages() ? 1 : 0);
     out.printf("PARAMETER tcmalloc_madvise_sampled_allocations %d\n",
                Parameters::madvise_sampled_allocations() ==
                    MadviseSampledAllocations::kEnabled);
@@ -946,6 +948,8 @@ void DumpStatsInPbtxt(Printer& out, int level) {
                    Parameters::release_max_cold_pages());
   region.PrintBool("tcmalloc_release_max_filler_pages",
                    Parameters::release_max_filler_pages());
+  region.PrintBool("tcmalloc_release_max_sampled_pages",
+                   Parameters::release_max_sampled_pages());
   region.PrintI64("profile_sampling_interval",
                   Parameters::profile_sampling_interval());
   region.PrintRaw("percpu_vcpu_type",
```

**File**: `tcmalloc/huge_page_aware_allocator.h` (modified, +3/-0)
```diff
@@ -74,6 +74,7 @@ class StaticForwarder : private Parameters {
   using Parameters::madvise_cold_regions_nohugepage;
   using Parameters::release_max_cold_pages;
   using Parameters::release_max_filler_pages;
+  using Parameters::release_max_sampled_pages;
   using Parameters::release_partial_alloc_pages;
   using Parameters::release_stale_pages;
   using Parameters::subrelease_unbacked_hugepages;
@@ -1055,6 +1056,8 @@ inline Length HugePageAwareAllocator<Forwarder>::ReleaseAtLeastNPages(
   if (hpaa_subrelease()) {
     const bool release_max =
         (tag_ == MemoryTag::kCold && forwarder_.release_max_cold_pages()) ||
+        ((tag_ == MemoryTag::kSampled || tag_ == MemoryTag::kSampledP1) &&
+         forwarder_.release_max_sampled_pages()) ||
         (forwarder_.release_max_filler_pages() &&
          static_cast<size_t>(forwarder_.background_release_rate()) > 0);
     if (released < num_pages || release_max) {
```

**File**: `tcmalloc/huge_page_aware_allocator_fuzz.cc` (modified, +20/-2)
```diff
@@ -506,6 +506,17 @@ struct SetReleaseMaxFillerPages {
   }
 };
 
+struct SetReleaseMaxSampledPages {
+  bool value;
+
+  void Perform(State& state) const;
+
+  template <typename Sink>
+  friend void AbslStringify(Sink& sink, const SetReleaseMaxSampledPages& s) {
+    absl::Format(&sink, "SetReleaseMaxSampledPages{.value=%v}", s.value);
+  }
+};
+
 struct SetEnableReleaseStalePages {
   bool value;
 
@@ -583,8 +594,9 @@ using ParamOp = std::variant<
     SetCollapseSucceeds, SetHugeRegionAdaptiveRelease, SetAllocateSucceeds,
     SetBackAllocations, SetBackSizeThresholdBytes, ReentrantSubprogram,
     SetEnableUnfilteredCollapse, SetReleaseMaxColdPages,
-    SetReleaseMaxFillerPages, SetEnableReleaseStalePages,
-    SetMadvNoHugepageHugeRegions, UpdateBitmaps, SetUsageLimitPressure>;
+    SetReleaseMaxFillerPages, SetReleaseMaxSampledPages,
+    SetEnableReleaseStalePages, SetMadvNoHugepageHugeRegions, UpdateBitmaps,
+    SetUsageLimitPressure>;
 
 template <typename Sink>
 void AbslStringify(Sink& sink, const ParamOp& p) {
@@ -1165,6 +1177,10 @@ void SetReleaseMaxFillerPages::Perform(State& state) const {
   state.allocator.forwarder().set_release_max_filler_pages(value);
 }
 
+void SetReleaseMaxSampledPages::Perform(State& state) const {
+  state.allocator.forwarder().set_release_max_sampled_pages(value);
+}
+
 void SetEnableReleaseStalePages::Perform(State& state) const {
   state.allocator.forwarder().set_release_stale_pages(
       value ? ReleaseStalePages::kEnabled : ReleaseStalePages::kDisabled);
@@ -1309,6 +1325,8 @@ fuzztest::Domain<ChangeParam> GetChangeParamDomain(int depth) {
                     fuzztest::Arbitrary<SetReleaseMaxColdPages>()),
       fuzztest::Map([](SetReleaseMaxFillerPages s) { return ChangeParam{s}; },
                     fuzztest::Arbitrary<SetReleaseMaxFillerPages>()),
+      fuzztest::Map([](SetReleaseMaxSampledPages s) { return ChangeParam{s}; },
+                    fuzztest::Arbitrary<SetReleaseMaxSampledPages>()),
       fuzztest::Map([](SetEnableReleaseStalePages s) { return ChangeParam{s}; },
                     fuzztest::Arbitrary<SetEnableReleaseStalePages>()),
       fuzztest::Map(
```

**File**: `tcmalloc/huge_page_aware_allocator_test.cc` (modified, +62/-0)
```diff
@@ -2228,6 +2228,68 @@ TEST(HugePageAwareAllocatorTest, ReleaseMaxColdPages) {
   }
 }
 
+TEST(HugePageAwareAllocatorTest, ReleaseMaxSampledPages) {
+  constexpr SpanAllocInfo kAllocInfo = {
+      .objects_per_span = 1,
+      .density = AccessDensityPrediction::kSparse,
+  };
+  constexpr Length kAllocPages = kPagesPerHugePage / 2;
+
+  for (MemoryTag tag :
+       {MemoryTag::kSampled, MemoryTag::kSampledP1, MemoryTag::kNormal}) {
+    // Under sanitizers the tag is narrower and kSampledP1 cannot be encoded in
+    // an address.
+    if (((static_cast<uintptr_t>(tag) << kTagShift) & kTagMask) >> kTagShift !=
+        static_cast<uintptr_t>(tag)) {
+      continue;
+    }
+    const bool is_sampled =
+        tag == MemoryTag::kSampled || tag == MemoryTag::kSampledP1;
+    for (bool release_max_sampled_pages : {false, true}) {
+      // PageAllocator releases from the sampled heap last, so it is commonly
+      // asked for zero pages.
+      for (Length requested : {Length(0), kAllocPages}) {
+        SCOPED_TRACE(absl::StrCat(
+            "tag=", static_cast<int>(tag), " release_max_sampled_pages=",
+            release_max_sampled_pages, " requested=", requested.raw_num()));
+        FakeHugePageAwareAllocator allocator({.tag = tag});
+        allocator.forwarder().set_filler_skip_subrelease_short_interval(
+            absl::ZeroDuration());
+        allocator.forwarder().set_filler_skip_subrelease_long_interval(
+            absl::ZeroDuration());
+        allocator.forwarder().set_release_max_filler_pages(false);
+        allocator.forwarder().set_release_max_sampled_pages(
+            release_max_sampled_pages);
+
+        Span* s1 = allocator.New(kAllocPages, kAllocInfo);
+        Span* s2 = allocator.New(kAllocPages, kAllocInfo);
+        Span* s3 = allocator.New(kAllocPages, kAllocInfo);
+        Span* s4 = allocator.New(kAllocPages, kAllocInfo);
+
+        SpanDeleter deleter(&allocator);
+        deleter(s1);
+        deleter(s3);
+
+        Length released;
+        {
+          PageHeapSpinLockHolder l;
+          released = allocator.ReleaseAtLeastNPages(
+              requested, PageReleaseReason::kReleaseMemoryToSystem);
+        }
+
+        if (is_sampled && release_max_sampled_pages) {
+          EXPECT_EQ(released, 2 * kAllocPages);
+        } else {
+          EXPECT_EQ(released, requested);
+        }
+
+        deleter(s2);
+        deleter(s4);
+      }
+    }
+  }
+}
+
 TEST(HugePageAwareAllocatorTest, ReleaseMaxFillerPages) {
   constexpr SpanAllocInfo kAllocInfo = {
       .objects_per_span = 1,
```

**File**: `tcmalloc/internal/parameter_accessors.h` (modified, +2/-0)
```diff
@@ -130,6 +130,8 @@ ABSL_ATTRIBUTE_WEAK bool TCMalloc_Internal_GetReleaseMaxColdPages();
 ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_SetReleaseMaxColdPages(bool v);
 ABSL_ATTRIBUTE_WEAK bool TCMalloc_Internal_GetReleaseMaxFillerPages();
 ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_SetReleaseMaxFillerPages(bool v);
+ABSL_ATTRIBUTE_WEAK bool TCMalloc_Internal_GetReleaseMaxSampledPages();
+ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_SetReleaseMaxSampledPages(bool v);
 
 ABSL_ATTRIBUTE_WEAK void TCMalloc_Internal_GetSizeClasses(
     std::vector<tcmalloc::tcmalloc_internal::TracerSizeClassInfo>* absl_nonnull
```

**File**: `tcmalloc/mock_huge_page_static_forwarder.h` (modified, +5/-0)
```diff
@@ -114,6 +114,10 @@ class FakeStaticForwarder : private Parameters {
   void set_release_max_filler_pages(bool value) {
     release_max_filler_pages_ = value;
   }
+  bool release_max_sampled_pages() const { return release_max_sampled_pages_; }
+  void set_release_max_sampled_pages(bool value) {
+    release_max_sampled_pages_ = value;
+  }
   ReleaseStalePages release_stale_pages() const { return release_stale_pages_; }
   void set_release_stale_pages(ReleaseStalePages value) {
     release_stale_pages_ = value;
@@ -307,6 +311,7 @@ class FakeStaticForwarder : private Parameters {
       Parameters::background_release_rate();
   bool release_max_cold_pages_ = Parameters::release_max_cold_pages();
   bool release_max_filler_pages_ = Parameters::release_max_filler_pages();
+  bool release_max_sampled_pages_ = Parameters::release_max_sampled_pages();
 
   bool back_allocations_ = Parameters::back_small_allocations();
   int32_t back_size_threshold_bytes_ = Parameters::back_size_threshold_bytes();
```

**File**: `tcmalloc/parameters.cc` (modified, +9/-0)
```diff
@@ -241,6 +241,7 @@ ABSL_CONST_INIT std::atomic<bool> Parameters::enable_unfiltered_collapse_(
     false);
 ABSL_CONST_INIT std::atomic<bool> Parameters::release_max_cold_pages_(true);
 ABSL_CONST_INIT std::atomic<bool> Parameters::release_max_filler_pages_(false);
+ABSL_CONST_INIT std::atomic<bool> Parameters::release_max_sampled_pages_(false);
 ABSL_CONST_INIT std::atomic<MadviseSampledAllocations>
     Parameters::madvise_sampled_allocations_(
         MadviseSampledAllocations::kDisabled);
@@ -696,6 +697,14 @@ void TCMalloc_Internal_SetReleaseMaxFillerPages(bool v) {
   Parameters::release_max_filler_pages_.store(v, std::memory_order_relaxed);
 }
 
+bool TCMalloc_Internal_GetReleaseMaxSampledPages() {
+  return Parameters::release_max_sampled_pages();
+}
+
+void TCMalloc_Internal_SetReleaseMaxSampledPages(bool v) {
+  Parameters::release_max_sampled_pages_.store(v, std::memory_order_relaxed);
+}
+
 bool TCMalloc_Internal_GetMadviseColdRegionsNoHugepage() {
   return Parameters::madvise_cold_regions_nohugepage() ==
          tcmalloc::tcmalloc_internal::MadviseRegionsNoHugepage::kEnabled;
```

**File**: `tcmalloc/parameters.h` (modified, +10/-0)
```diff
@@ -152,6 +152,14 @@ class Parameters {
     TCMalloc_Internal_SetReleaseMaxFillerPages(value);
   }
 
+  static bool release_max_sampled_pages() {
+    return release_max_sampled_pages_.load(std::memory_order_relaxed);
+  }
+
+  static void set_release_max_sampled_pages(bool value) {
+    TCMalloc_Internal_SetReleaseMaxSampledPages(value);
+  }
+
   static MadviseRegionsNoHugepage madvise_cold_regions_nohugepage();
 
   static void set_madvise_cold_regions_nohugepage(bool value) {
@@ -280,6 +288,7 @@ class Parameters {
   friend void ::TCMalloc_Internal_SetHugeRegionAdaptiveReleaseEnabled(bool v);
   friend void ::TCMalloc_Internal_SetReleaseMaxColdPages(bool v);
   friend void ::TCMalloc_Internal_SetReleaseMaxFillerPages(bool v);
+  friend void ::TCMalloc_Internal_SetReleaseMaxSampledPages(bool v);
   friend void ::TCMalloc_Internal_SetMadviseSampledAllocations(
       tcmalloc::tcmalloc_internal::MadviseSampledAllocations v);
   friend void ::TCMalloc_Internal_SetEventTraceMemoryLimit(int64_t v);
@@ -305,6 +314,7 @@ class Parameters {
   static std::atomic<bool> enable_unfiltered_collapse_;
   static std::atomic<bool> release_max_cold_pages_;
   static std::atomic<bool> release_max_filler_pages_;
+  static std::atomic<bool> release_max_sampled_pages_;
   static std::atomic<MadviseSampledAllocations> madvise_sampled_allocations_;
   static std::atomic<int64_t> event_trace_memory_limit_;
   static std::atomic<bool> release_drained_slab_metadata_;
```

#### Recent Merged Pull Requests:
- **PR #1324** (2026-10-07): Clean up test only experiment label for release stale pages. (@copybara-service[bot])
- **PR #1323** (2026-10-07): Currently page allocators return Span* as the result of allocation, (@copybara-service[bot])
- **PR #1319** (closed): No public description (@copybara-service[bot])
- **PR #1317** (2026-10-07): Include unallocated and unavailable arena bytes in tcmalloc.metadata_bytes (@copybara-service[bot])
- **PR #1316** (2026-10-07): tcmalloc: Remove `TCMALLOC_SHARDED_TC_ABLATION` experiment (@copybara-service[bot])
- **PR #1314** (2026-10-07): Roll out sharded transfer cache ablation experiment. (@copybara-service[bot])
- **PR #1313** (2026-10-07): Expose arena unavailable and unallocated bytes in MallocExtension properties (@copybara-service[bot])
- **PR #1312** (2026-10-07): Remove HugePageAwareAllocator::FinalizeType and Unspanify. (@copybara-service[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
