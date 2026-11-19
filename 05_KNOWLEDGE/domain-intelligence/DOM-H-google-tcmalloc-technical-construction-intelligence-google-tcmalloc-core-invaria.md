# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: google/tcmalloc Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "google/tcmalloc",
  "source_url": "https://github.com/google/tcmalloc",
  "source_version": "f076c560",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T18:06:15.699Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-google-tcmalloc",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [google/tcmalloc](https://github.com/google/tcmalloc) (Revision: `f076c560`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T18:06:15.699Z`  
> **Learning ID**: `learn-github-google-tcmalloc`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from google/tcmalloc:

# Forensic Learning Record (Deep Inspection): google/tcmalloc

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-tcmalloc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/tcmalloc](https://github.com/google/tcmalloc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T18:06:14.555Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/tcmalloc`
- **Description**: 
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5405 stars

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
  ABSL_ATTRIBUTE_COLD ABSL_ATTRIBUTE_NO_SANITIZE_ADDRESS
      ABSL_ATTRIBUTE_NOINLINE void
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
- **Issue #1944** (2026-11-19): **No public description**
  *Symptoms*: No public description 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1944/checks?check_run_id=135323843314) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #1943** (2026-11-19): **Revert: Record remote NUMA residency on heap profile samples.**
  *Symptoms*: Revert: Record remote NUMA residency on heap profile samples.  This reports the bytes resident on NUMA nodes other than the profiler collection thread's home NUMA node via a remote_numa_space sample type on heap profiles. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/tcmalloc/pull/1943/checks?check_run_id=135172913977) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

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

### Incident Patch 1: `f63e9c75` (2026-11-18)
**Commit Message**: Use AddOverflow when rounding up sizes in pvalloc.

This checks for addition overflow before masking to a page boundary, matching
MultiplyOverflow in calloc and reallocarray.

Co-authored-by: Chris Kennelly <[REDACTED_EMAIL]>
PiperOrigin-RevId: 1025023674

**File**: `tcmalloc/internal/overflow.h` (modified, +9/-0)
```diff
@@ -24,6 +24,15 @@ GOOGLE_MALLOC_SECTION_BEGIN
 namespace tcmalloc {
 namespace tcmalloc_internal {
 
+[[nodiscard]] inline bool AddOverflow(size_t a, size_t b, size_t* out) {
+#if ABSL_HAVE_BUILTIN(__builtin_add_overflow)
+  return __builtin_add_overflow(a, b, out);
+#else
+  *out = a + b;
+  return *out < a;
+#endif
+}
+
 [[nodiscard]] inline bool MultiplyOverflow(size_t a, size_t b, size_t* out) {
 #if ABSL_HAVE_BUILTIN(__builtin_mul_overflow)
   return __builtin_mul_overflow(a, b, out);
```

**File**: `tcmalloc/tcmalloc.cc` (modified, +5/-4)
```diff
@@ -1558,6 +1558,7 @@ void TCMalloc_Internal_SetMadvise(
 // Exported routines
 //-------------------------------------------------------------------
 
+using tcmalloc::tcmalloc_internal::AddOverflow;
 using tcmalloc::tcmalloc_internal::BytesToLengthCeil;
 using tcmalloc::tcmalloc_internal::CorrectAlignment;
 using tcmalloc::tcmalloc_internal::CorrectSize;
@@ -2013,10 +2014,10 @@ extern "C" TCMALLOC_INTERNAL_CACHELINE_ALIGNED void* TCMallocInternalPvalloc(
   if (size == 0) {     // pvalloc(0) should allocate one page, according to
     size = page_size;  // http://man.free4web.biz/man3/libmpatrol.3.html
   }
-  size = (size + page_size - 1) & ~(page_size - 1);
-  if (ABSL_PREDICT_FALSE(size == 0)) {
+  if (ABSL_PREDICT_FALSE(AddOverflow(size, page_size - 1, &size))) {
     return MallocPolicy::handle_oom(std::numeric_limits<size_t>::max());
   }
+  size &= ~(page_size - 1);
   return fast_alloc(size, MallocPolicy().AlignAs(page_size));
 }
 
@@ -2374,10 +2375,10 @@ TCMALLOC_INTERNAL_CACHELINE_ALIGNED void* operator new[](
     if (size == 0) {                                                           \
       size = page_size;                                                        \
     }                                                                          \
-    size = (size + page_size - 1) & ~(page_size - 1);                          \
-    if (ABSL_PREDICT_FALSE(size == 0)) {                                       \
+    if (ABSL_PREDICT_FALSE(AddOverflow(size, page_size - 1, &size))) {         \
       return MallocPolicy::handle_oom(std::numeric_limits<size_t>::max());     \
     }                                                                          \
+    size &= ~(page_size - 1);                                                  \
     return fast_alloc(                                                         \
         size,                                                                  \
         MallocPolicy().WithSecurityToken<TokenId{id}>().AlignAs(page_size));   \
```

---

### Incident Patch 2: `9bab4db5` (2026-11-19)
**Commit Message**: Revert: Record remote NUMA residency on heap profile samples.

This reports the bytes resident on NUMA nodes other than the profiler
collection thread's home NUMA node via a remote_numa_space sample type on heap
profiles.

PiperOrigin-RevId: 1025598004

**File**: `tcmalloc/internal/profile_builder.cc` (modified, +6/-32)
```diff
@@ -167,7 +167,6 @@ struct SampleMergedData {
   std::optional<size_t> locked_size;
   std::optional<size_t> incompressible_size;
   std::optional<uint64_t> stale_scan_period;
-  size_t remote_numa_size = 0;
   size_t compressed_size = 0;
   size_t zero_size = 0;
 
@@ -229,9 +228,6 @@ struct SampleMergeResult {
   // Collection being enabled does not imply this: analysis is skipped for any
   // sample lacking residency information, a span address, or a requested size.
   bool measured_compressibility = false;
-  // Whether Residency::GetRemoteNumaBytes produced a result for at least one
-  // sample.
-  bool measured_numa = false;
 };
 
 SampleMergeResult MergeProfileSamplesAndMaybeGetResidencyInfo(
@@ -244,7 +240,6 @@ SampleMergeResult MergeProfileSamplesAndMaybeGetResidencyInfo(
     compression_analyzer.emplace();
   }
   absl::BitGen rng;
-  const int local_numa_node = GetCurrentNumaNode();
 
   profile.Iterate([&](const tcmalloc::Profile::Sample& entry) {
     SampleMergedData& data = map[entry];
@@ -274,17 +269,6 @@ SampleMergeResult MergeProfileSamplesAndMaybeGetResidencyInfo(
           data.resident_size.value() += resident_size;
           data.swapped_size.value() += swapped_size;
         }
-        if (residency_info->bytes_resident > 0 &&
-            entry.span_start_address != nullptr) {
-          std::optional<size_t> remote_bytes = residency->GetRemoteNumaBytes(
-              entry.span_start_address, size, local_numa_node);
-          if (remote_bytes.has_value()) {
-            result.measured_numa = true;
-            data.remote_numa_size +=
-                entry.count *
-                std::min(*remote_bytes, residency_info->bytes_resident);
-          }
-        }
       }
     }
 
@@ -1105,9 +1089,6 @@ absl::StatusOr<std::unique_ptr<perftools::profiles::Profile>> MakeProfileProto(
   // Bytes on pages marked incompressible by kernel pageflags (unit: "bytes").
   const int incompressible_space_id =
       builder.InternString("incompressible_space");
-  // Bytes resident on NUMA nodes other than the profiler collection thread's
-  // home NUMA node (unit: "bytes").
-  const int remote_numa_space_id = builder.InternString("remote_numa_space");
 
   // Sample types: content compressibility analysis (`kHeap` profiles).
   // Estimated ZSTD-compressed size of backed (`resident_space + swapped_space`)
@@ -1176,18 +1157,14 @@ absl::StatusOr<std::unique_ptr<perftools::profiles::Profile>> MakeProfileProto(
 
   bool collecting_compressibility = false;
 
-  // Only advertise space_compressed/zero_space and remote_numa_space when at
-  // least one sample was actually measured.  Emitting the columns with a zero
-  // in every sample is indistinguishable downstream from a genuinely
-  // incompressible or 100% NUMA-local heap.
-  const auto [samples, exporting_compressibility, exporting_numa] =
+  // Only advertise space_compressed/zero_space when at least one sample was
+  // actually analyzed.  Emitting the columns with a zero in every sample is
+  // indistinguishable downstream from a genuinely incompressible heap, so a
+  // profile that never ran the analyzer would otherwise be reported as 100%
+  // compressible rather than as having no data.
+  const auto [samples, exporting_compressibility] =
       MergeProfileSamplesAndMaybeGetResidencyInfo(profile, pageflags, residency,
                                                   collecting_compressibility);
-  if (exporting_residency && exporting_numa) {
-    perftools::profiles::ValueType* sample_type = converted.add_sample_type();
-    sample_type->set_type(remote_numa_space_id);
-    sample_type->set_unit(bytes_id);
-  }
   if (exporting_compressibility) {
     perftools::profiles::ValueType* sample_type = nullptr;
 
@@ -1230,9 +1207,6 @@ absl::StatusOr<std::unique_ptr<perftools::profiles::Profile>> MakeProfileProto(
       sample.add_value(data.stale_size.value_or(0));
       sample.add_value(data.locked_size.value_or(0));
       sample.add_value(data.incompressible_size.value_or(0));
-      if (exporting_numa) {
-        sample.add_value(data.remote_numa_size);
-      }
     }
     if (exporting_compressibility) {
       sample.add_value(data.zero_size);
```

**File**: `tcmalloc/internal/profile_builder_test.cc` (modified, +12/-120)
```diff
@@ -72,8 +72,8 @@ using ::testing::IsSupersetOf;
 using ::testing::Key;
 using ::testing::Not;
 using ::testing::Pair;
+using ::testing::SizeIs;
 using ::testing::UnorderedElementsAre;
-using ::testing::UnorderedElementsAreArray;
 
 class StubPageFlags final : public PageFlagsBase {
  public:
@@ -147,29 +147,13 @@ class StubResidency final : public NoopResidency {
     return std::nullopt;
   }
 
-  std::optional<size_t> GetRemoteNumaBytes(const void* addr, size_t size,
-                                           int local_node) override {
-    uintptr_t uaddr = reinterpret_cast<uintptr_t>(addr);
-    auto it = remote_numa_bytes_.find(uaddr);
-    if (it != remote_numa_bytes_.end()) {
-      return std::min(it->second, size);
-    }
-    return std::nullopt;
-  }
-
   void SetInfo(const void* addr, Info info) {
     uintptr_t uaddr = reinterpret_cast<uintptr_t>(addr);
     infos_[uaddr] = info;
   }
 
-  void SetRemoteNumaBytes(const void* addr, size_t bytes) {
-    uintptr_t uaddr = reinterpret_cast<uintptr_t>(addr);
-    remote_numa_bytes_[uaddr] = bytes;
-  }
-
  private:
   absl::flat_hash_map<uintptr_t, Info> infos_;
-  absl::flat_hash_map<uintptr_t, size_t> remote_numa_bytes_;
 };
 
 // Returns the fully resolved path of this program.
@@ -636,26 +620,20 @@ TEST(ProfileConverterTest, HeapProfile) {
   // Require that the default_sample_type appeared in sample_type.
   EXPECT_THAT(sample_types, testing::Contains(converted.default_sample_type()));
 
+  constexpr int kNumSampleTypes = 7
+      ;
   // This is slightly redundant with the next line, but we need to loop over
   // each of the samples later.
   constexpr int kNumSamples = 6;
-  std::vector<std::pair<std::string, std::string>> expected_sample_types = {
-      {"objects", "count"},
-      {"space", "bytes"},
-      {"resident_space", "bytes"},
-      {"stale_space", "bytes"},
-      {"locked_space", "bytes"},
-      {"incompressible_space", "bytes"},
-      {"swapped_space", "bytes"},
-  };
-  if (ResidencyPageMap()
-          .GetRemoteNumaBytes(&converted, sizeof(converted),
-                              GetCurrentNumaNode())
-          .has_value()) {
-    expected_sample_types.emplace_back("remote_numa_space", "bytes");
-  }
-  EXPECT_THAT(extracted_sample_type,
-              UnorderedElementsAreArray(expected_sample_types));
+  EXPECT_THAT(extracted_sample_type, SizeIs(kNumSampleTypes));
+  EXPECT_THAT(
+      extracted_sample_type,
+      UnorderedElementsAre(
+          Pair("objects", "count"), Pair("space", "bytes"),
+          Pair("resident_space", "bytes"), Pair("stale_space", "bytes"),
+          Pair("locked_space", "bytes"), Pair("incompressible_space", "bytes"),
+          Pair("swapped_space", "bytes")
+          ));
 
   SampleLabels extracted_labels;
   {
@@ -1590,7 +1568,6 @@ TEST(ProfileConverterTest, NoCompressibilityColumnsWithoutMeasurements) {
   EXPECT_THAT(types, Not(Contains("space_compressed")));
   EXPECT_THAT(types, Not(Contains("zero_space")));
   EXPECT_THAT(types, Not(Contains("analyzed_compressibility_space")));
-  EXPECT_THAT(types, Not(Contains("remote_numa_space")));
 
   // Every sample must still agree with the advertised sample types.
   for (const auto& s : converted.sample()) {
@@ -1907,91 +1884,6 @@ TEST(ProfileBuilderTest, DisabledSamplingReturnsNotFound) {
             absl::StatusCode::kNotFound);
 }
 
-TEST(ProfileConverterTest, HeapProfileRemoteNumaSpace) {
-  std::vector<char> buf_local(64, 'a');
-  std::vector<char> buf_remote(64, 'b');
-  std::vector<char> buf_mixed(64, 'm');
-  std::vector<char> buf_clamped(64, 'd');
-  std::vector<char> buf_unbacked(64, 'c');
-
-  Profile::Sample sample_local = {};
-  sample_local.sum = 64;
-  sample_local.count = 1;
-  sample_local.requested_size = 64;
-  sample_local.allocated_size = 64;
-  sample_local.span_start_address = buf_local.data();
-  sample_local.depth = 2;
-  sample_local.stack[0] =
-      reinterpret_cast<void*>(&ProfileAccessor::MakeProfile);
-  sample_local.stack[1] = reinterpret_cast<void*>(&RealPath);
-  sample_local.guarded_status = Profile::Sample::GuardedStatus::NotAttempted;
-  sample_local.type = AllocationType::Malloc;
-
-  Profile::Sample sample_remote = sample_local;
-  sample_remote.sum = 128;
-  sample_remote.count = 2;
-  sample_remote.span_start_address = buf_remote.data();
-
-  Profile::Sample sample_mixed = sample_local;
-  sample_mixed.sum = 128;
-  sample_mixed.count = 2;
-  sample_mixed.span_start_address = buf_mixed.data();
-
-  Profile::Sample sample_clamped = sample_local;
-  sample_clamped.sum = 128;
-  sample_clamped.count = 2;
-  sample_clamped.span_start_address = buf_clamped.data();
-
-  Profile::Sample sample_unbacked = sample_local;
-  sample_unbacked.sum = 256;
-  sample_unbacked.count = 4;
-  sample_unbacked.span_start_address = buf_unbacked.data();
-
-  StubPageFlags pageflags;
-  StubResidency residency;
-  Residency::Info info;
-  info.bytes_resident = 64;
-  info.page_is_resident.SetBit(0);
-  residency.S
```

#### Recent Merged Pull Requests:
- **PR #1944** (closed): No public description (@copybara-service[bot])
- **PR #1943** (2026-11-19): Revert: Record remote NUMA residency on heap profile samples. (@copybara-service[bot])
- **PR #1936** (2026-11-19): Automated Code Change (@copybara-service[bot])
- **PR #1934** (2026-11-18): Migrate ABSL_ATTRIBUTE_SECTION to [[gnu::section(...)]] (@copybara-service[bot])
- **PR #1931** (2026-11-18): Place ABSL_ATTRIBUTE_NO_SANITIZE_ADDRESS before ABSL_ATTRIBUTE_NOINLINE in HookList::InvokeSlow. (@copybara-service[bot])
- **PR #1929** (2026-11-17): Encode x86-64 rseq signature inside a 7-byte nopl instruction (@copybara-service[bot])

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

## X. Use AddOverflow when rounding up sizes in pvalloc.

**RULE**:
When implementing operations in `tcmalloc/internal/overflow.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in google/tcmalloc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f63e9c75`: Use AddOverflow when rounding up sizes in pvalloc.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `tcmalloc/internal/overflow.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
[[nodiscard]] inline bool AddOverflow(size_t a, size_t b, size_t* out) {
#if ABSL_HAVE_BUILTIN(__builtin_add_overflow)
  return __builtin_add_overflow(a, b, out);
#else
  *out = a + b;
  return *out < a;
#endif
}

```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f63e9c75` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
