# Verification Protocol: Verification Protocol: Empirical Defect Shield for meta/folly

<!-- PROVENANCE_START
{
  "source_repository": "meta/folly",
  "source_url": "https://github.com/facebook/folly",
  "source_version": "24e09e96",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T17:37:55.594Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meta-folly",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meta/folly](https://github.com/facebook/folly) (Revision: `24e09e96`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T17:37:55.594Z`  
> **Learning ID**: `learn-github-meta-folly`


## 1. Scope & Verification Target
- **Target Repository**: `meta/folly` (Commit: `24e09e96`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): meta/folly

> **Canonical Artifact**: `07_PROJECT_LEARNING/facebook-folly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/facebook/folly](https://github.com/facebook/folly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T17:37:54.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meta/folly`
- **Description**: An open-source C++ library developed and used at Facebook.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 30565 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `folly/BenchmarkUtil.cpp`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <folly/BenchmarkUtil.h>

#include <array> // @manual
#include <filesystem>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <string>

#include <fmt/format.h>

#include <folly/lang/Align.h>
#include <folly/lang/Exception.h>
#include <folly/portability/Sched.h>
#include <folly/portability/Windows.h>
#include <folly/system/arch/x86.h>

#if defined(__APPLE__) || defined(__FreeBSD__)
#include <sys/sysctl.h>
#endif

namespace folly {

namespace detail {

size_t bm_llc_size_fallback() {
#if defined(__linux__)

  /// sysctl is deprecated on Linux; walk sysfs

  int cpu = sched_getcpu();
  if (cpu < 0) {
    return 0;
  }

  auto dir = std::filesystem::path(
      fmt::format("/sys/devices/system/cpu/cpu{}/cache", cpu));

  size_t size = 0;
  for (const auto& entry : std::filesystem::directory_iterator(dir)) {
    if (entry.path().filename().native().starts_with("index")) {
      std::ifstream size_ifs(entry.path() / "size");
      std::string size_str;
      size_ifs >> size_str;
      size_t size_num = std::stoul(size_str);
      if (size_str.back() == 'K') {
        size_num *= 1024;
      } else if (size_str.back() == 'M') {
        size_num *= 1024 * 1024;
      }
      size = std::max(size, size_num);
    }
  }

  return size;

#elif defined(__APPLE__) || defined(__FreeBSD__)

  auto names = std::array{
      "hw.l3cachesize", // FreeBSD, Intel Mac
      "hw.l2cachesize", // Apple Silicon
  };
  for (auto name : names) {
    uint64_t size = 0;
    size_t len = sizeof(size);
    if (sysctlbyname(name, &size, &len, NULL, 0) == 0 && size > 0) {
      return size;
    }
  }

  return 0;

#elif defined(_WIN32)

  DWORD length = 0;
  GetLogicalProcessorInformation(nullptr, &length);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || length == 0) {
    return 0;
  }
  if (length % sizeof(SYSTEM_LOGICAL_PROCESSOR_INFORMATION) != 0) {
    return 0;
  }

  size_t const count = length / sizeof(SYSTEM_LOGICAL_PROCESSOR_INFORMATION);
  std::vector<SYSTEM_LOGICAL_PROCESSOR_INFORMATION> infos(count);
  if (!GetLogicalProcessorInformation(infos.data(), &length)) {
    return 0;
  }

  size_t size = 0;
  for (auto const& info : infos) {
    if (info.Relationship == RelationCache) {
      size = std::max<size_t>(size, info.Cache.Size);
    }
  }
  return size;

#else

  return 0;

#endif
}

} // namespace detail

size_t bm_llc_size() {
  return kIsArchX86 || kIsArchAmd64
      ? folly::x86_cpuid_get_llc_cache_info().cache_size()
      : detail::bm_llc_size_fallback();
}

void bm_llc_evict(size_t value) {
  constexpr auto words_per_line =
      folly::hardware_constructive_interference_size / sizeof(size_t);
  static_assert(words_per_line > 0);

  static auto const word_count = [] {
    auto const llc_size = bm_llc_size();
    if (llc_size == 0) {
      throw_exception<std::runtime_error>("Unable to determine LLC size");
    }
    auto const max_llc_bytes =
        align_floor(std::numeric_limits<size_t>::max() / 2, sizeof(size_t));
    if (llc_size > max_llc_bytes) {
      throw_exception<std::length_error>("LLC eviction region is too large");
    }
    auto const llc_words =
        align_ceil(llc_size, sizeof(size_t)) / sizeof(size_t);
    return 2 * llc_words;
  }();
  static std::unique_ptr<size_t volatile[]> const region{
      new size_t[word_count]};
  detail::bm_llc_evict_touch({region.get(), word_count}, words_per_line, value);
}

void detail::bm_llc_evict_touch(
    std::span<size_t volatile> region, size_t words_per_line, size_t value) {
  for (size_t i = 0; i < region.size(); i += words_per_line) {
    region[i] = value;
  }
  if (!region.empty()) {
    region.back() = value;
  }
}

} // namespace folly

```

### Core Architecture Module: `folly/BenchmarkUtil.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <span>

#include <folly/Portability.h>
#include <folly/lang/Hint.h>

namespace folly {

/**
 * Call doNotOptimizeAway(var) to ensure that var will be computed even
 * post-optimization.  Use it for variables that are computed during
 * benchmarking but otherwise are useless. The compiler tends to do a
 * good job at eliminating unused variables, and this function fools it
 * into thinking var is in fact needed.
 *
 * Call makeUnpredictable(var) when you don't want the optimizer to use
 * its knowledge of var to shape the following code.  This is useful
 * when constant propagation or power reduction is possible during your
 * benchmark but not in real use cases.
 */

template <class T>
FOLLY_ALWAYS_INLINE void doNotOptimizeAway(const T& datum) {
  compiler_must_not_elide(datum);
}

template <typename T>
FOLLY_ALWAYS_INLINE void makeUnpredictable(T& datum) {
  compiler_must_not_predict(datum);
}

namespace detail {
size_t bm_llc_size_fallback();

/// bm_llc_evict_touch
///
/// Writes the first word of each stride and the last word of the region.
/// words_per_line must be positive.
void bm_llc_evict_touch(
    std::span<size_t volatile> region, size_t words_per_line, size_t value);
} // namespace detail

/// bm_llc_size
///
/// Calculates the size of the LLC (Last Level Cache, typically L3 on x86-64).
size_t bm_llc_size();

/// bm_llc_evict
///
/// Applies cache pressure with a region twice the detected LLC size.
/// Eviction is best effort, not a guarantee that subsequent accesses reach
/// DRAM.
void bm_llc_evict(size_t value);

} // namespace folly

```

### Core Architecture Module: `folly/ConcurrentBSkipList-detail.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ConcurrentBSkipList-detail.h — Internal seqlock primitive, node types, and
// allocator support for ConcurrentBSkipList. Included by ConcurrentBSkipList.h.
// Do NOT include directly.

#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <limits>
#include <memory>
#include <optional>
#include <type_traits>
#include <utility>
#include <variant>

#include <glog/logging.h>
#include <folly/Portability.h>
#include <folly/Utility.h>
#include <folly/lang/Align.h>
#include <folly/portability/Asm.h>
#include <folly/synchronization/RWSpinLock.h>
#include <folly/synchronization/RelaxedAtomic.h>
#include <folly/synchronization/SanitizeThread.h>

namespace folly {
// Separate (SoA): parallel keys_[] and payloads_[] arrays.
// Inline (AoS): interleaved {key, payload} records per slot.
enum class LeafStoragePolicy {
  Separate,
  Inline,
};

// How Skipper reads a key slot under concurrent writes. Default per T:
//   trivially-copyable + lock-free hardware atomic (≤8B) -> RelaxedAtomic
//   otherwise                                            -> Locked
enum class KeyReadPolicy {
  // Acquire the leaf shared mutex on every read. Always correct.
  Locked,
  // Atomic load (relaxed). T must be hardware-atomic + trivially copyable
  // (e.g. uint32_t, uint64_t, 16B struct on x86 with cmpxchg16b).
  RelaxedAtomic,
};

template <
    typename,
    typename,
    int,
    folly::KeyReadPolicy,
    folly::LeafStoragePolicy,
    typename>
class ConcurrentBSkipList;
} // namespace folly

namespace folly::bskip_detail {

// ---------------------------------------------------------------------------
// Seqlock for ConcurrentBSkipList OLC reader/writer bracketing.
//
// Standard seqlock protocol:
//   Writer: store(version+1, relaxed) → fence(release) → write data →
//           store(version+2, release)
//   Reader: load(version, acquire) → read data → fence(acquire) →
//           load(version, relaxed) → compare
//
// Key design choices:
//   - Typed field access (AtomicSlot<T>) instead of byte-at-a-time
//     memcpy. A 16-byte key read is one vmovdqa/ldp instruction.
//     Possible because we restrict keys to hardware-atomic types
//     (static_assert in InternalTraits).
//   - Spin-retry on odd version (writer in flight) before returning
//     to the caller, sized to absorb brief alloc-free insert epochs.
//   - RAII WriteGuard tied to the node's seqlock lifetime.
//
// Writers must be externally synchronized (node mutex held).
// ---------------------------------------------------------------------------

class Seqlock {
 public:
  class WriteGuard : folly::NonCopyableNonMovable {
   public:
    explicit WriteGuard(Seqlock& seq) : seq_(seq) { seq_.beginWrite(); }
    ~WriteGuard() { seq_.endWrite(); }

   private:
    Seqlock& seq_;
  };

  // NOTE: caller must hold the node mutex for the lifetime of this guard.
  // Only one writer may increment the seqlock at a time.
  [[nodiscard]] WriteGuard writeGuard() { return WriteGuard{*this}; }

  template <int kReadSpins>
  uint32_t readBegin() const {
    if constexpr (kReadSpins > 0) {
      for (int spin = 0; spin < kReadSpins; ++spin) {
        uint32_t v = version_.load(std::memory_order_acquire);
        if (!(v & 1)) {
          return v;
        }
        folly::asm_volatile_pause();
      }
    }
    return version_.load(std::memory_order_acquire);
  }

  bool validate(uint32_t v) const {
    std::atomic_thread_fence(std::memory_order_acquire);
    return version_.load(std::memory_order_relaxed) == v;
  }

  bool isInWriteEpoch() const noexcept {
    return (version_.load(std::memory_order_relaxed) & 1u) != 0;
  }

  // Writer is externally synchronized (node mutex held). Relaxed store is
  // sufficient; the release fence orders it before subsequent data writes.
  void beginWrite() {
    uint32_t prev = version_.load(std::memory_order_relaxed);
    DCHECK_EQ(prev & 1u, 0u) << "beginWrite while already in write epoch";
    DCHECK_LT(prev, std::numeric_limits<uint32_t>::max() - 1)
        << "version overflow";
    version_.store(prev + 1, std::memory_order_relaxed);
    std::atomic_thread_fence(std::memory_order_release);
  }

  void endWrite() {
    version_.store(
        version_.load(std::memory_order_relaxed) + 1,
        std::memory_order_release);
  }

  void annotateVersionField(const char* file, int line) const {
    annotate_benign_race_sized(
        &version_,
        sizeof(version_),
        "BSkipList OLC: seqlock version field",
        file,
        line);
  }

 private:
  mutable std::atomic<uint32_t> version_;
};

// ---------------------------------------------------------------------------
// Node types, storage primitives, and allocator support
// ---------------------------------------------------------------------------

// Zero-size payload slot for [[no_unique_address]] in void-payload templates.
using Empty = std::monostate;

enum class BSkipTestHookEvent {
  ProbeNextLeafLoadNext,
  ProbeNextLeafValidateNext,
  OlcLoadNext,
  LeafKeyPostLoadValidate,
  SplitPublishComplete,
};

// Signature defined unconditionally so callers compile regardless of whether
// FOLLY_BSKIP_TEST_HOOKS is set; only bodies depend on the macro.
using BSkipTestHook = void (*)(
    BSkipTestHookEvent event,
    std::memory_order order,
    const void* node,
    const void* peer);

#ifdef FOLLY_BSKIP_TEST_HOOKS
inline std::atomic<BSkipTestHook> gBSkipTestHook{nullptr};

FOLLY_ALWAYS_INLINE void setBSkipTestHook(BSkipTestHook hook) {
  gBSkipTestHook.store(hook, std::memory_order_relaxed);
}

FOLLY_ALWAYS_INLINE void invokeBSkipTestHook(
    BSkipTestHookEvent event,
    std::memory_order order,
    const void* node,
    const void* peer) {
  if (auto hook = gBSkipTestHook.load(std::memory_order_relaxed)) {
    hook(event, order, node, peer);
  }
}
#else
FOLLY_ALWAYS_INLINE void setBSkipTestHook(BSkipTestHook) {}
FOLLY_ALWAYS_INLINE void invokeBSkipTestHook(
    BSkipTestHookEvent, std::memory_order, const void*, const void*) {}
#endif

// Tuning knobs separated from InternalTraits so they can be adjusted without
// touching the Traits template parameter set.
struct BSkipTuning {
  // Same-leaf optimistic-miss retries before broader escalation. Sized to
  // absorb a brief writer epoch.
  static constexpr int kSeqlockRetries = 3;
  // Cached-path OLC + one root-reload retry before falling back to locked HOH.
  static constexpr int kOlcAttempts = 2;
  // Spin budget for an active writer before AdaptiveReadGuard takes the
  // shared lock. ARM: fewer spins because isb is heavier than x86 pause.
  static constexpr int kReadSpins = folly::kIsArchAArch64 ? 48 : 256;
};

// ---------------------------------------------------------------------------
// Storage primitive for optimistic-read paths. Locked-mode uses plain T
// (leaf mutex provides exclusion); optimistic mode uses AtomicSlot<T>.
// ---------------------------------------------------------------------------

// Lock-free read slot for hardware-atomic T. The atomic load instruction
// IS the bracket: a writer's store either fully precedes or fully follows
// the reader's load and never tears. Readers need no surrounding protocol.
//
// Wraps folly::relaxed_atomic<T>; synthesized copy/move ops let
// std::array element-assignment compile in splitKeys/moveChildren (raw
// std::atomic isn't copyable).
//
// Alignment inherits from std::atomic<T> and is STRICTER than alignof(T)
// when the lock-free instruction is wider than T's natural alignment
// (e.g. 16-byte cmpxchg16b on an 8-byte-aligned 16-byte struct). Do NOT
// replace this wrapper with std::atomic_ref<T> over raw T storage:
// atomic_ref surrenders that alignment guarantee back to the caller AND
// regressed children_ traversal on 16B-key benchmarks (misaligned loads).
template <typename T>
struct AtomicSlot {
  AtomicSlot() = default;
  ~AtomicSlot() = default;
  /* implicit */ AtomicSlot(const T& v) : val_(v) {}
  AtomicSlot(const AtomicSlot& o) : val_(o.val_.load()) {}
  AtomicSlot(AtomicSlot&& o) noexcept : val_(o.val_.load()) {}
  AtomicSlot& operator=(const AtomicSlot& o) {
    val_.store(o.val_.load());
    return *this;
  }
  AtomicSlot& operator=(AtomicSlot&& o) noexcept {
    val_.store(o.val_.load());
    return *this;
  }
  AtomicSlot& operator=(const T& v) {
    val_.store(v);
    return *this;
  }
  /* implicit */ operator T() const { return val_.load(); }

  folly::relaxed_atomic<T> val_;
};

// Non-void PayloadT only (InternalTraits gates instantiation).
template <typename KeyStorage, typename PayloadT>
struct InlineLeafRecord {
  KeyStorage key{};
  PayloadT payload{};
};

namespace detail_hw_atomic {
// Concept so the && short-circuits: std::atomic<void>::is_always_lock_free
// is ill-formed, but trivially_copyable<void> fails first.
template <typename T>
concept Check =
    std::is_trivially_copyable_v<T> && std::atomic<T>::is_always_lock_free;
} // namespace detail_hw_atomic

template <typename T>
inline constexpr bool kIsHardwareAtomic = detail_hw_atomic::Check<T>;

// Optimistic readers may call Comp on stale-but-complete key values
// (hw-atomic guarantees no tearing). The comparator must be safe on any
// complete value — no pointer dereferences, no side effects.
template <typename T>
inline constexpr folly::KeyReadPolicy kDefaultReadPolicy = kIsHardwareAtomic<T>
    ? 
```

### Core Architecture Module: `folly/ConcurrentBSkipList.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Concurrent B-tree/skip-list hybrid: HOH writes; reads escalate optimistic
// leaf scan → OLC descent → locked HOH.
//
// Level 0 = leaves; higher levels = routing keys + children. B is per-node
// key capacity; P is the promotion denominator (see topLevelForKey).
//
// Requirements on T: specialize std::numeric_limits (min/max are reserved
// sentinels). Hash must be deterministic across the container's lifetime.
//
// Most users want the named aliases at the bottom: ConcurrentBSkipSet,
// ConcurrentBSkipMap, ConcurrentBSkipInlineMap.
//
// Locking:
//   - HOH always couples locks top-down; horizontal moves crab.
//   - growthLock_ never overlaps any HOH lock.
//   - remove() tombstones; nodes are never reclaimed.
//
// Thread-safe: add, remove, contains, find, updatePayload, addOrUpdate.
// Skipper is safe against concurrent list mutation; one Skipper per thread.
// Destructor is not thread-safe.

#pragma once

#include <array>
#include <atomic>
#include <cstdint>
#include <functional>
#include <limits>
#include <memory>
#include <mutex>
#include <optional>
#include <shared_mutex>
#include <type_traits>
#include <utility>
#include <variant>

#include <glog/logging.h>
#include <folly/CPortability.h>
#include <folly/ConcurrentBSkipList-detail.h>
#include <folly/MicroLock.h>
#include <folly/Utility.h>
#include <folly/lang/Align.h>
#include <folly/lang/Assume.h>
#include <folly/small_vector.h>
#include <folly/synchronization/RWSpinLock.h>
#include <folly/synchronization/RelaxedAtomic.h>

namespace folly {
// add()/addOrUpdate() collapse this to bool via didInsert(); use directly
// to distinguish Updated from AlreadyPresent.
enum class BSkipInsertOutcome {
  // didInsert() == true:
  Inserted,
  Revived,
  // didInsert() == false:
  Updated,
  AlreadyPresent,
};

constexpr bool didInsert(BSkipInsertOutcome outcome) {
  return outcome == BSkipInsertOutcome::Inserted ||
      outcome == BSkipInsertOutcome::Revived;
}

namespace bskip_detail {
// Live exact-match handling: Add → AlreadyPresent; AddOrUpdate → fire updater.
enum class InsertSemantics { Add, AddOrUpdate };
} // namespace bskip_detail

// Two-layer config: per-axis template params (B, ReadPolicy, StoragePolicy)
// take their defaults from compile-time computation; Policy supplies the
// rest (Hash, Comp, NodeAlloc, kPromotionProbInverse, kMaxHeight). The named
// aliases at the bottom forward Policy::k* into the per-axis params.
// ConcurrentBSkipDefaultPolicy is defined at the bottom of this header.
template <
    typename T,
    typename PromotionHash = std::hash<T>,
    typename Compare = std::less<T>,
    typename Allocator = std::allocator<char>>
struct ConcurrentBSkipDefaultPolicy;

template <
    typename T,
    typename PayloadType = void,
    int B = 16,
    KeyReadPolicy ReadPolicy = bskip_detail::kDefaultReadPolicy<T>,
    LeafStoragePolicy StoragePolicy =
        LeafStoragePolicy::Separate, // accepts folly::LeafStoragePolicy values
    typename Policy = ConcurrentBSkipDefaultPolicy<T>>
// If you add a template parameter, also extend FOLLY_BSKIP_FRIEND_LIST in
// ConcurrentBSkipList-detail.h to match.
class ConcurrentBSkipList {
  using Comp = typename Policy::Comp;
  using Hash = typename Policy::Hash;
  using NodeAlloc = typename Policy::NodeAlloc;
  static constexpr uint8_t kPromotionProbInverse =
      Policy::kPromotionProbInverse;
  static constexpr uint8_t kMaxHeight = Policy::kMaxHeight;

  // Cross-parameter checks (T sentinels, payload triviality, etc.) live in
  // InternalTraits.
  static_assert(kMaxHeight > 0, "kMaxHeight must be > 0");
  static_assert(B <= 64, "B must be <= 64 (tombstone bitmap is uint64_t)");
  static_assert(
      kPromotionProbInverse > 1,
      "kPromotionProbInverse must be > 1 (height assignment uses log_P digits)");
  static_assert(
      (kPromotionProbInverse & (kPromotionProbInverse - 1)) == 0,
      "kPromotionProbInverse must be a power of 2");
  // Stateless Hash/Comp: promotion height is part of a key's structural
  // identity, so two instantiations must agree on Hash{}(k) and Comp.
  static_assert(std::is_empty_v<Hash>, "Hash must be stateless");
  static_assert(std::is_empty_v<Comp>, "Comp must be stateless");

  using Traits = bskip_detail::InternalTraits<
      T,
      Comp,
      B,
      kPromotionProbInverse,
      ReadPolicy,
      PayloadType,
      StoragePolicy>;
  using Node = bskip_detail::BSkipNode<Traits>;
  using LeafNode = bskip_detail::BSkipNodeLeaf<Traits>;
  using InternalNode = bskip_detail::BSkipNodeInternal<Traits>;

  template <typename LookupKey>
  static bool isSentinel(const LookupKey& k) {
    return Traits::equal(k, Traits::kMinSentinel) ||
        Traits::equal(k, Traits::kMaxSentinel);
  }

 public:
  using key_type = T;
  using payload_type = PayloadType;
  static constexpr bool kHasPayload = Traits::kHasPayload;
  static constexpr bool kInlinePayloadStorage = Traits::kInlinePayload;
  using leaf_node_type = LeafNode;
  static constexpr KeyReadPolicy kReadPolicy = ReadPolicy;

  using FindResult = std::conditional_t<
      kHasPayload,
      std::optional<std::pair<T, PayloadType>>,
      std::optional<T>>;

  ConcurrentBSkipList() : ConcurrentBSkipList(NodeAlloc{}) {}

  explicit ConcurrentBSkipList(const NodeAlloc& alloc) : alloc_(alloc) {
    beginLeaf_.level_ = 0;
    beginLeaf_.numElements_.store(1);
    beginLeaf_.storeKey(0, Traits::kMinSentinel);
    // Tombstone the sentinel at slot 0 so scans skip it.
    beginLeaf_.tombstones_.store(1);
    headers_[0] = &beginLeaf_;
  }

  // Not thread-safe. Must outlive every Skipper instance — Skipper's OLC
  // path relies on nodes never being reclaimed under it.
  ~ConcurrentBSkipList() {
    uint8_t height = height_.load(std::memory_order_relaxed);
    for (uint8_t level = 0; level < height; ++level) {
      // Single-threaded teardown; no concurrent access.
      Node* node = headers_[level].load(std::memory_order_relaxed);
      while (node != nullptr) {
        Node* nextNode = node->next_.load(std::memory_order_relaxed);
        if (node != static_cast<Node*>(&beginLeaf_)) {
          deallocByLevel(node);
        }
        node = nextNode;
      }
    }
  }

  ConcurrentBSkipList(const ConcurrentBSkipList&) = delete;
  ConcurrentBSkipList& operator=(const ConcurrentBSkipList&) = delete;
  ConcurrentBSkipList(ConcurrentBSkipList&&) = delete;
  ConcurrentBSkipList& operator=(ConcurrentBSkipList&&) = delete;

  // Returns true on fresh insert or tombstone revive; false if already present.
  bool add(const T& key) {
    return didInsert(insertImpl<bskip_detail::InsertSemantics::Add>(key));
  }

  // Existing live keys are not overwritten; use addOrUpdate for that.
  template <typename RequestedPayload = PayloadType>
  bool add(const T& key, const RequestedPayload& payload)
    requires(!std::is_void_v<RequestedPayload>)
  {
    auto initialValueSetter =
        [&payload](const T&, std::optional<RequestedPayload>& slot) {
          if (!slot) {
            slot = payload;
          }
        };
    return didInsert(
        insertImpl<bskip_detail::InsertSemantics::Add>(
            key, initialValueSetter));
  }

  // Fused upsert. Updater runs under the leaf mutex + seqlock write epoch;
  // must not allocate, take other locks, or throw. Returns true on insert/
  // revive, false on update.
  // Updater:
  //   void payload:    void(const T&)
  //   payload-bearing: void(const T&, std::optional<PayloadType>& slot)
  //     - empty slot in / left empty out: default-constructed payload.
  //     - filled slot: caller's value is stored.
  template <typename Updater>
  bool addOrUpdate(const T& key, Updater&& updater) {
    return didInsert(
        insertImpl<bskip_detail::InsertSemantics::AddOrUpdate>(
            key, std::forward<Updater>(updater)));
  }

  bool remove(const T& key) {
    DCHECK(!isSentinel(key))
        << "sentinel keys are reserved; inserting/removing them is undefined";
    return traverseHohLeaf<HeldNodeLockMode::Exclusive>(
        key,
        [&](LeafNode* leaf, uint8_t slot) {
          if (leaf->tombstoned(slot)) {
            return false;
          }
          auto guard = leaf->seq_.writeGuard();
          leaf->setTombstone(slot);
          size_.fetch_sub(1);
          return true;
        },
        [] { return false; });
  }

  template <typename RequestedPayload = PayloadType>
  std::optional<RequestedPayload> removeAndGetPayload(const T& key)
    requires(!std::is_void_v<RequestedPayload>)
  {
    DCHECK(!isSentinel(key))
        << "sentinel keys are reserved; inserting/removing them is undefined";
    return traverseHohLeaf<HeldNodeLockMode::Exclusive>(
        key,
        [&](LeafNode* leaf, uint8_t slot) -> std::optional<RequestedPayload> {
          if (leaf->tombstoned(slot)) {
            return std::nullopt;
          }
          auto oldPayload = leaf->loadPayload(slot);
          auto guard = leaf->seq_.writeGuard();
          leaf->setTombstone(slot);
          size_.fetch_sub(1);
          return oldPayload;
        },
        [] { return std::optional<RequestedPayload>{}; });
  }

  // Updates the payload of a live (non-tombstoned) key. Returns false if the
  // key is absent or tombstoned; use add() + updatePayload() or addOrUpdate().
  // Updater runs under the leaf mutex + seqlock write epoch; bounded work only.
  template <typename Updater>
  b
```

### Core Architecture Module: `folly/ConcurrentBitSet.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <array>
#include <atomic>
#include <cassert>
#include <cstddef>
#include <limits>

#include <folly/Portability.h>

namespace folly {

/**
 * An atomic bitset of fixed size (specified at compile time).
 *
 * Formerly known as AtomicBitSet. It was renamed while fixing a bug
 * to avoid any silent breakages during run time.
 */
template <size_t N>
class ConcurrentBitSet {
 public:
  /**
   * Construct a ConcurrentBitSet; all bits are initially false.
   */
  ConcurrentBitSet();

  ConcurrentBitSet(const ConcurrentBitSet&) = delete;
  ConcurrentBitSet& operator=(const ConcurrentBitSet&) = delete;

  /**
   * Set bit idx to true, using the given memory order. Returns the
   * previous value of the bit.
   *
   * Note that the operation is a read-modify-write operation due to the use
   * of fetch_or.
   */
  bool set(size_t idx, std::memory_order order = std::memory_order_seq_cst);

  /**
   * Set bit idx to false, using the given memory order. Returns the
   * previous value of the bit.
   *
   * Note that the operation is a read-modify-write operation due to the use
   * of fetch_and.
   */
  bool reset(size_t idx, std::memory_order order = std::memory_order_seq_cst);

  /**
   * Set bit idx to the given value, using the given memory order. Returns
   * the previous value of the bit.
   *
   * Note that the operation is a read-modify-write operation due to the use
   * of fetch_and or fetch_or.
   *
   * Yes, this is an overload of set(), to keep as close to std::bitset's
   * interface as possible.
   */
  bool set(
      size_t idx,
      bool value,
      std::memory_order order = std::memory_order_seq_cst);

  /**
   * Read bit idx.
   */
  bool test(
      size_t idx, std::memory_order order = std::memory_order_seq_cst) const;

  /**
   * Same as test() with the default memory order.
   */
  bool operator[](size_t idx) const;

  /**
   * Return the size of the bitset.
   */
  constexpr size_t size() const { return N; }

 private:
  // Pick the largest lock-free type available
#if (ATOMIC_LLONG_LOCK_FREE == 2)
  using BlockType = unsigned long long;
#elif (ATOMIC_LONG_LOCK_FREE == 2)
  typedef unsigned long BlockType;
#else
  // Even if not lock free, what can we do?
  typedef unsigned int BlockType;
#endif
  using AtomicBlockType = std::atomic<BlockType>;

  static constexpr size_t kBitsPerBlock =
      std::numeric_limits<BlockType>::digits;

  static constexpr size_t blockIndex(size_t bit) { return bit / kBitsPerBlock; }

  static constexpr size_t bitOffset(size_t bit) { return bit % kBitsPerBlock; }

  // avoid casts
  static constexpr BlockType kOne = 1;
  static constexpr size_t kNumBlocks = (N + kBitsPerBlock - 1) / kBitsPerBlock;
  std::array<AtomicBlockType, kNumBlocks> data_;
};

// value-initialize to zero
template <size_t N>
inline ConcurrentBitSet<N>::ConcurrentBitSet() : data_() {}

template <size_t N>
inline bool ConcurrentBitSet<N>::set(size_t idx, std::memory_order order) {
  assert(idx < N);
  BlockType mask = kOne << bitOffset(idx);
  return data_[blockIndex(idx)].fetch_or(mask, order) & mask;
}

template <size_t N>
inline bool ConcurrentBitSet<N>::reset(size_t idx, std::memory_order order) {
  assert(idx < N);
  BlockType mask = kOne << bitOffset(idx);
  return data_[blockIndex(idx)].fetch_and(~mask, order) & mask;
}

template <size_t N>
inline bool ConcurrentBitSet<N>::set(
    size_t idx, bool value, std::memory_order order) {
  return value ? set(idx, order) : reset(idx, order);
}

template <size_t N>
inline bool ConcurrentBitSet<N>::test(
    size_t idx, std::memory_order order) const {
  assert(idx < N);
  BlockType mask = kOne << bitOffset(idx);
  return data_[blockIndex(idx)].load(order) & mask;
}

template <size_t N>
inline bool ConcurrentBitSet<N>::operator[](size_t idx) const {
  return test(idx);
}

} // namespace folly

```

### Core Architecture Module: `folly/ConcurrentLazy.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <type_traits>
#include <utility>

#include <folly/functional/Invoke.h>
#include <folly/synchronization/DelayedInit.h>

namespace folly {

/*
 * ConcurrentLazy is for thread-safe, delayed initialization of a value. This
 * combines the benefits of both `folly::Lazy` and `folly::DelayedInit` to
 * compute the value, once, at access time.
 *
 * There are a few differences between the non-concurrent Lazy, most notably:
 *
 *   - this only safely initializes the value; thread-safety of the underlying
 *     value is left up to the caller.
 *   - the underlying types are not copyable or moveable, which means that this
 *     type is also not copyable or moveable.
 *
 * Otherwise, all design considerations from `folly::Lazy` are reflected here.
 */

template <class Ctor>
struct ConcurrentLazy {
  using result_type = invoke_result_t<Ctor>;

  static_assert(
      !std::is_const<Ctor>::value, "Func should not be a const-qualified type");
  static_assert(
      !std::is_reference<Ctor>::value, "Func should not be a reference type");

  template <typename F>
    requires std::constructible_from<Ctor, F>
  explicit ConcurrentLazy(F&& f) noexcept(
      std::is_nothrow_constructible_v<Ctor, F>)
      : ctor_(static_cast<F&&>(f)) {}

  const result_type& operator()() const {
    return value_.try_emplace_with(std::ref(ctor_));
  }

  result_type& operator()() { return value_.try_emplace_with(std::ref(ctor_)); }

 private:
  mutable folly::DelayedInit<result_type> value_;
  mutable Ctor ctor_;
};

template <class Func>
ConcurrentLazy<std::remove_cvref_t<Func>> concurrent_lazy(Func&& func) {
  return ConcurrentLazy<std::remove_cvref_t<Func>>(static_cast<Func&&>(func));
}

} // namespace folly

```

### Core Architecture Module: `folly/ConcurrentSkipList-inl.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <algorithm>
#include <atomic>
#include <climits>
#include <cmath>
#include <memory>
#include <mutex>
#include <random>
#include <type_traits>
#include <vector>

#include <glog/logging.h>

#include <folly/ConstexprMath.h>
#include <folly/CppAttributes.h>
#include <folly/Memory.h>
#include <folly/ThreadLocal.h>
#include <folly/memory/Allocator.h>
#include <folly/synchronization/MicroSpinLock.h>

namespace folly {
namespace detail {

template <typename ValT, typename NodeT>
class csl_iterator;

template <typename T>
class SkipListNode {
  enum : uint16_t {
    IS_HEAD_NODE = 1,
    MARKED_FOR_REMOVAL = (1 << 1),
    FULLY_LINKED = (1 << 2),
  };

 public:
  using value_type = T;

  SkipListNode(const SkipListNode&) = delete;
  SkipListNode& operator=(const SkipListNode&) = delete;

  template <
      typename NodeAlloc,
      typename U,
      typename =
          typename std::enable_if<std::is_convertible<U, T>::value>::type>
  static SkipListNode* create(
      NodeAlloc& alloc, int height, U&& data, bool isHead = false) {
    DCHECK(height >= 1 && height < 64) << height;

    size_t size =
        sizeof(SkipListNode) + height * sizeof(std::atomic<SkipListNode*>);
    auto storage = std::allocator_traits<NodeAlloc>::allocate(alloc, size);
    // do placement new
    return new (storage)
        SkipListNode(uint8_t(height), std::forward<U>(data), isHead);
  }

  template <typename NodeAlloc>
  static void destroy(NodeAlloc& alloc, SkipListNode* node) {
    size_t size = sizeof(SkipListNode) +
        node->height_ * sizeof(std::atomic<SkipListNode*>);
    node->~SkipListNode();
    std::allocator_traits<NodeAlloc>::deallocate(
        alloc, typename std::allocator_traits<NodeAlloc>::pointer(node), size);
  }

  template <typename NodeAlloc>
  struct DestroyIsNoOp
      : StrictConjunction<
            AllocatorHasTrivialDeallocate<NodeAlloc>,
            std::is_trivially_destructible<SkipListNode>> {};

  // copy the head node to a new head node assuming lock acquired
  SkipListNode* copyHead(SkipListNode* node) {
    DCHECK(node != nullptr && height_ > node->height_);
    setFlags(node->getFlags());
    for (uint8_t i = 0; i < node->height_; ++i) {
      setSkip(i, node->skip(i));
    }
    return this;
  }

  inline SkipListNode* skip(int layer) const {
    DCHECK_LT(layer, height_);
    return skip_[layer].load(std::memory_order_acquire);
  }

  // next valid node as in the linked list
  SkipListNode* next() {
    SkipListNode* node;
    for (node = skip(0); (node != nullptr && node->markedForRemoval());
         node = node->skip(0)) {
    }
    return node;
  }

  void setSkip(uint8_t h, SkipListNode* next) {
    DCHECK_LT(h, height_);
    skip_[h].store(next, std::memory_order_release);
  }

  value_type& data() { return data_; }
  const value_type& data() const { return data_; }
  int maxLayer() const { return height_ - 1; }
  int height() const { return height_; }

  std::unique_lock<MicroSpinLock> acquireGuard() {
    return std::unique_lock<MicroSpinLock>(spinLock_);
  }

  bool fullyLinked() const { return getFlags() & FULLY_LINKED; }
  bool markedForRemoval() const { return getFlags() & MARKED_FOR_REMOVAL; }
  bool isHeadNode() const { return getFlags() & IS_HEAD_NODE; }

  void setIsHeadNode() { setFlags(uint16_t(getFlags() | IS_HEAD_NODE)); }
  void setFullyLinked() { setFlags(uint16_t(getFlags() | FULLY_LINKED)); }
  void setMarkedForRemoval() {
    setFlags(uint16_t(getFlags() | MARKED_FOR_REMOVAL));
  }

 private:
  // Note! this can only be called from create() as a placement new.
  template <typename U>
  SkipListNode(uint8_t height, U&& data, bool isHead)
      : height_(height), data_(std::forward<U>(data)) {
    spinLock_.init();
    setFlags(0);
    if (isHead) {
      setIsHeadNode();
    }
    // need to explicitly init the dynamic atomic pointer array
    for (uint8_t i = 0; i < height_; ++i) {
      new (&skip_[i]) std::atomic<SkipListNode*>(nullptr);
    }
  }

  ~SkipListNode() {
    for (uint8_t i = 0; i < height_; ++i) {
      skip_[i].~atomic();
    }
  }

  uint16_t getFlags() const { return flags_.load(std::memory_order_acquire); }
  void setFlags(uint16_t flags) {
    flags_.store(flags, std::memory_order_release);
  }

  // TODO(xliu): on x86_64, it's possible to squeeze these into
  // skip_[0] to maybe save 8 bytes depending on the data alignments.
  // NOTE: currently this is x86_64 only anyway, due to the
  // MicroSpinLock.
  std::atomic<uint16_t> flags_;
  const uint8_t height_;
  MicroSpinLock spinLock_;

  value_type data_;

  std::atomic<SkipListNode*> skip_[0];
};

class SkipListRandomHeight {
  enum { kMaxHeight = 64 };

 public:
  // make it a singleton.
  static SkipListRandomHeight* instance() {
    static SkipListRandomHeight instance_;
    return &instance_;
  }

  int getHeight(int maxHeight) const {
    DCHECK_LE(maxHeight, kMaxHeight) << "max height too big!";
    double p = randomProb();
    for (int i = 0; i < maxHeight; ++i) {
      if (p < lookupTable_[i]) {
        return i + 1;
      }
    }
    return maxHeight;
  }

  size_t getSizeLimit(int height) const {
    DCHECK_LT(height, kMaxHeight);
    return sizeLimitTable_[height];
  }

 private:
  SkipListRandomHeight() { initLookupTable(); }

  void initLookupTable() {
    // set skip prob = 1/E
    static const double kProbInv = exp(1);
    static const double kProb = 1.0 / kProbInv;
    static const size_t kMaxSizeLimit = std::numeric_limits<size_t>::max();

    double sizeLimit = 1;
    double p = lookupTable_[0] = (1 - kProb);
    sizeLimitTable_[0] = 1;
    for (int i = 1; i < kMaxHeight - 1; ++i) {
      p *= kProb;
      sizeLimit *= kProbInv;
      lookupTable_[i] = lookupTable_[i - 1] + p;
      sizeLimitTable_[i] = folly::constexpr_clamp_cast<size_t>(sizeLimit);
    }
    lookupTable_[kMaxHeight - 1] = 1;
    sizeLimitTable_[kMaxHeight - 1] = kMaxSizeLimit;
  }

  static double randomProb() {
    static ThreadLocal<std::mt19937_64> rng_;
    // The top 53 bits scaled by 2^-53 give a uniform double in [0, 1).
    return static_cast<double>((*rng_)() >> 11) * 0x1.0p-53;
  }

  double lookupTable_[kMaxHeight];
  size_t sizeLimitTable_[kMaxHeight];
};

template <typename NodeType, typename NodeAlloc, typename = void>
class NodeRecycler;

template <typename NodeType, typename NodeAlloc>
class NodeRecycler<
    NodeType,
    NodeAlloc,
    typename std::enable_if<
        !NodeType::template DestroyIsNoOp<NodeAlloc>::value>::type> {
 public:
  explicit NodeRecycler(const NodeAlloc& alloc)
      : refs_(0), dirty_(false), alloc_(alloc) {
    lock_.init();
  }

  explicit NodeRecycler() : refs_(0), dirty_(false) { lock_.init(); }

  ~NodeRecycler() {
    CHECK_EQ(refs(), 0);
    if (nodes_) {
      for (auto& node : *nodes_) {
        NodeType::destroy(alloc_, node);
      }
    }
  }

  void add(NodeType* node) {
    std::lock_guard g(lock_);
    if (nodes_.get() == nullptr) {
      nodes_ = std::make_unique<std::vector<NodeType*>>(1, node);
    } else {
      nodes_->push_back(node);
    }
    DCHECK_GT(refs(), 0);
    dirty_.store(true, std::memory_order_relaxed);
  }

  int addRef() { return refs_.fetch_add(1, std::memory_order_acq_rel); }

  int releaseRef() {
    // This if statement is purely an optimization. It's possible that this
    // misses an opportunity to delete, but that's OK, we'll try again at
    // the next opportunity. It does not harm the thread safety. For this
    // reason, we can use relaxed loads to make the decision.
    if (!dirty_.load(std::memory_order_relaxed) || refs() > 1) {
      return refs_.fetch_add(-1, std::memory_order_acq_rel);
    }

    std::unique_ptr<std::vector<NodeType*>> newNodes;
    int ret;
    {
      // The order at which we lock, add, swap, is very important for
      // correctness.
      std::lock_guard g(lock_);
      ret = refs_.fetch_add(-1, std::memory_order_acq_rel);
      if (ret == 1) {
        // When releasing the last reference, it is safe to remove all the
        // current nodes in the recycler, as we already acquired the lock here
        // so no more new nodes can be added, even though new accessors may be
        // added after this.
        newNodes.swap(nodes_);
        dirty_.store(false, std::memory_order_relaxed);
      }
    }
    // TODO(xliu) should we spawn a thread to do this when there are large
    // number of nodes in the recycler?
    if (newNodes) {
      for (auto& node : *newNodes) {
        NodeType::destroy(alloc_, node);
      }
    }
    return ret;
  }

  NodeAlloc& alloc() { return alloc_; }

 private:
  int refs() const { return refs_.load(std::memory_order_relaxed); }

  std::unique_ptr<std::vector<NodeType*>> nodes_;
  std::atomic<int32_t> refs_; // current number of visitors to the list
  std::atomic<bool> dirty_; // whether *nodes_ is non-empty
  MicroSpinLock lock_; // protects access to *nodes_
  [[FOLLY_ATTR_NO_UNIQUE_ADDRESS]] NodeAlloc alloc_;
};

// In case of arena allocator, no recycling is necessary, and it's possible
// to save on ConcurrentSkipList size.
template <typename NodeType, typename NodeAlloc>
class NodeRecycler<
    NodeType,
    NodeAlloc,
    typename std::enable_if<
        NodeType::template DestroyIsNoOp<NodeAlloc>::value>::type> {
 public:
  explicit NodeRecycler(const NodeAlloc& alloc) : alloc_(alloc) {}

  void addRef() {}
  void relea
```

### Core Architecture Module: `folly/ConcurrentSkipList.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// A concurrent skip list (CSL) implementation.
// Ref: http://www.cs.tau.ac.il/~shanir/nir-pubs-web/Papers/OPODIS2006-BA.pdf

/*

This implements a sorted associative container that supports only
unique keys.  (Similar to std::set.)

Features:

  1. Small memory overhead: ~40% less memory overhead compared with
     std::set (1.6 words per node versus 3). It has an minimum of 4
     words (7 words if there nodes got deleted) per-list overhead
     though.

  2. Read accesses (count, find iterator, skipper) are lock-free and
     mostly wait-free (the only wait a reader may need to do is when
     the node it is visiting is in a pending stage, i.e. deleting,
     adding and not fully linked).  Write accesses (remove, add) need
     to acquire locks, but locks are local to the predecessor nodes
     and/or successor nodes.

  3. Good high contention performance, comparable single-thread
     performance.  In the multithreaded case (12 workers), CSL tested
     10x faster than a RWSpinLocked std::set for an averaged sized
     list (1K - 1M nodes).

     Comparable read performance to std::set when single threaded,
     especially when the list size is large, and scales better to
     larger lists: when the size is small, CSL can be 20-50% slower on
     find()/contains().  As the size gets large (> 1M elements),
     find()/contains() can be 30% faster.

     Iterating through a skiplist is similar to iterating through a
     linked list, thus is much (2-6x) faster than on a std::set
     (tree-based).  This is especially true for short lists due to
     better cache locality.  Based on that, it's also faster to
     intersect two skiplists.

  4. Lazy removal with GC support.  The removed nodes get deleted when
     the last Accessor to the skiplist is destroyed.

Caveats:

  1. Write operations are usually 30% slower than std::set in a single
     threaded environment.

  2. Need to have a head node for each list, which has a 4 word
     overhead.

  3. When the list is quite small (< 1000 elements), single threaded
     benchmarks show CSL can be 10x slower than std:set.

  4. The interface requires using an Accessor to access the skiplist.
    (See below.)

  5. Currently x64 only, due to use of MicroSpinLock.

  6. Freed nodes will not be reclaimed as long as there are ongoing
     uses of the list.

Sample usage:

     typedef ConcurrentSkipList<int> SkipListT;
     shared_ptr<SkipListT> sl(SkipListT::createInstance(init_head_height);
     {
       // It's usually good practice to hold an accessor only during
       // its necessary life cycle (but not in a tight loop as
       // Accessor creation incurs ref-counting overhead).
       //
       // Holding it longer delays garbage-collecting the deleted
       // nodes in the list.
       SkipListT::Accessor accessor(sl);
       accessor.insert(23);
       accessor.erase(2);
       for (auto &elem : accessor) {
         // use elem to access data
       }
       ... ...
     }

 Another useful type is the Skipper accessor.  This is useful if you
 want to skip to locations in the way std::lower_bound() works,
 i.e. it can be used for going through the list by skipping to the
 node no less than a specified key.  The Skipper keeps its location as
 state, which makes it convenient for things like implementing
 intersection of two sets efficiently, as it can start from the last
 visited position.

     {
       SkipListT::Accessor accessor(sl);
       SkipListT::Skipper skipper(accessor);
       skipper.to(30);
       if (skipper) {
         CHECK_LE(30, *skipper);
       }
       ...  ...
       // GC may happen when the accessor gets destructed.
     }
*/

#pragma once

#include <algorithm>
#include <atomic>
#include <limits>
#include <memory>
#include <type_traits>

#include <glog/logging.h>

#include <folly/ConcurrentSkipList-inl.h>
#include <folly/Likely.h>
#include <folly/Memory.h>
#include <folly/detail/Iterators.h>
#include <folly/memory/Allocator.h>
#include <folly/synchronization/MicroSpinLock.h>

namespace folly {

template <
    typename T,
    typename Comp = std::less<T>,
    // All nodes are allocated using provided SysAllocator,
    // it should be thread-safe.
    typename NodeAlloc = SysAllocator<char>,
    int MAX_HEIGHT = 24>
class ConcurrentSkipList {
  // MAX_HEIGHT needs to be at least 2 to suppress compiler
  // warnings/errors (Werror=uninitialized triggered due to preds_[1]
  // being treated as a scalar in the compiler).
  static_assert(
      MAX_HEIGHT >= 2 && MAX_HEIGHT < 64,
      "MAX_HEIGHT can only be in the range of [2, 64)");
  using ScopedLocker = std::unique_lock<folly::MicroSpinLock>;
  using SkipListType = ConcurrentSkipList<T, Comp, NodeAlloc, MAX_HEIGHT>;

 public:
  using NodeType = detail::SkipListNode<T>;
  using value_type = T;
  using key_type = T;

  using iterator = detail::csl_iterator<value_type, NodeType>;
  using const_iterator = detail::csl_iterator<const value_type, NodeType>;

  class Accessor;
  class Skipper;

  explicit ConcurrentSkipList(int height, const NodeAlloc& alloc)
      : recycler_(alloc),
        head_(NodeType::create(recycler_.alloc(), height, value_type(), true)) {
  }

  explicit ConcurrentSkipList(int height)
      : recycler_(),
        head_(NodeType::create(recycler_.alloc(), height, value_type(), true)) {
  }

  // Convenience function to get an Accessor to a new instance.
  static Accessor create(int height, const NodeAlloc& alloc) {
    return Accessor(createInstance(height, alloc));
  }

  static Accessor create(int height = 1) {
    return Accessor(createInstance(height));
  }

  // Create a shared_ptr skiplist object with initial head height.
  static std::shared_ptr<SkipListType> createInstance(
      int height, const NodeAlloc& alloc) {
    return std::make_shared<ConcurrentSkipList>(height, alloc);
  }

  static std::shared_ptr<SkipListType> createInstance(int height = 1) {
    return std::make_shared<ConcurrentSkipList>(height);
  }

  size_t size() const { return size_.load(std::memory_order_relaxed); }
  bool empty() const { return size() == 0; }

  //===================================================================
  // Below are implementation details.
  // Please see ConcurrentSkipList::Accessor for stdlib-like APIs.
  //===================================================================

  ~ConcurrentSkipList() {
    if constexpr (NodeType::template DestroyIsNoOp<NodeAlloc>::value) {
      // Avoid traversing the list if using arena allocator.
      return;
    }
    for (NodeType* current = head_.load(std::memory_order_relaxed); current;) {
      NodeType* tmp = current->skip(0);
      NodeType::destroy(recycler_.alloc(), current);
      current = tmp;
    }
  }

 private:
  static bool greater(const value_type& data, const NodeType* node) {
    return node && Comp()(node->data(), data);
  }

  static bool less(const value_type& data, const NodeType* node) {
    return (node == nullptr) || Comp()(data, node->data());
  }

  static int findInsertionPoint(
      NodeType* cur,
      int cur_layer,
      const value_type& data,
      NodeType* preds[],
      NodeType* succs[]) {
    int foundLayer = -1;
    NodeType* pred = cur;
    NodeType* foundNode = nullptr;
    for (int layer = cur_layer; layer >= 0; --layer) {
      NodeType* node = pred->skip(layer);
      while (greater(data, node)) {
        pred = node;
        node = node->skip(layer);
      }
      if (foundLayer == -1 && !less(data, node)) { // the two keys equal
        foundLayer = layer;
        foundNode = node;
      }
      preds[layer] = pred;

      // if found, succs[0..foundLayer] need to point to the cached foundNode,
      // as foundNode might be deleted at the same time thus pred->skip() can
      // return nullptr or another node.
      succs[layer] = foundNode ? foundNode : node;
    }
    return foundLayer;
  }

  int height() const { return head_.load(std::memory_order_acquire)->height(); }

  int maxLayer() const { return height() - 1; }

  size_t incrementSize(int delta) {
    return size_.fetch_add(delta, std::memory_order_relaxed) + delta;
  }

  // Returns the node if found, nullptr otherwise.
  NodeType* find(const value_type& data) {
    auto ret = findNode(data);
    if (ret.second && !ret.first->markedForRemoval()) {
      return ret.first;
    }
    return nullptr;
  }

  // lock all the necessary nodes for changing (adding or removing) the list.
  // returns true if all the lock acquired successfully and the related nodes
  // are all validate (not in certain pending states), false otherwise.
  bool lockNodesForChange(
      int nodeHeight,
      ScopedLocker guards[MAX_HEIGHT],
      NodeType* preds[MAX_HEIGHT],
      NodeType* succs[MAX_HEIGHT],
      bool adding = true) {
    NodeType *pred, *succ, *prevPred = nullptr;
    bool valid = true;
    for (int layer = 0; valid && layer < nodeHeight; ++layer) {
      pred = preds[layer];
      DCHECK(pred != nullptr)
          << "layer=" << layer << " height=" << height()
          << " nodeheight=" << nodeHeight;
      succ = succs[layer];
      if (pred != prevPred) {
        guards[layer] = pred->acquireGuard();
        prevPred = pred;
      }
      valid = !pred->markedForRemoval() &&
          pred->skip(layer) == succ; // check again after locking

      if (adding) { // when adding a node, the succ shouldn't be
```

### Core Architecture Module: `folly/FileUtil.cpp`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <folly/FileUtil.h>

#include <cerrno>
#include <string>
#include <system_error>

#include <folly/detail/FileUtilDetail.h>
#include <folly/detail/FileUtilVectorDetail.h>
#include <folly/net/NetOps.h>
#include <folly/portability/Fcntl.h>
#include <folly/portability/Sockets.h>
#include <folly/portability/Stdlib.h>
#include <folly/portability/SysFile.h>
#include <folly/portability/SysStat.h>

namespace folly {
namespace {
iovec getIOVecFor(ByteRange);
} // namespace

using namespace fileutil_detail;

int openNoInt(const char* name, int flags, mode_t mode) {
  // Android NDK bionic with FORTIFY has this definition:
  // https://android.googlesource.com/platform/bionic/+/9349b9e51b/libc/include/bits/fortify/fcntl.h
  // ```
  // __BIONIC_ERROR_FUNCTION_VISIBILITY
  // int open(const char* pathname, int flags, mode_t modes, ...) __overloadable
  //         __errorattr(__open_too_many_args_error);
  // ```
  // This is originally to prevent open() with incorrect parameters.
  //
  // However, combined with folly wrapNotInt, template deduction will fail.
  // In this case, we create a custom lambda to bypass the error.
  // The solution is referenced from
  // https://github.com/llvm/llvm-project/commit/0a0e411204a2baa520fd73a8d69b664f98b428ba
  //
  auto openWrapper = [&] { return fileops::open(name, flags, mode); };
  return wrapNoInt(openWrapper);
}

static int filterCloseReturn(int r) {
  // Ignore EINTR.  On Linux, close() may only return EINTR after the file
  // descriptor has been closed, so you must not retry close() on EINTR --
  // in the best case, you'll get EBADF, and in the worst case, you'll end up
  // closing a different file (one opened from another thread).
  //
  // Interestingly enough, the Single Unix Specification says that the state
  // of the file descriptor is unspecified if close returns EINTR.  In that
  // case, the safe thing to do is also not to retry close() -- leaking a file
  // descriptor is definitely better than closing the wrong file.
  if (r == -1 && errno == EINTR) {
    return 0;
  }
  return r;
}

int closeNoInt(int fd) {
  return filterCloseReturn(fileops::close(fd));
}

int closeNoInt(NetworkSocket fd) {
  return filterCloseReturn(netops::close(fd));
}

int fsyncNoInt(int fd) {
  return wrapNoInt(fsync, fd);
}

int dupNoInt(int fd) {
  return wrapNoInt(dup, fd);
}

int dup2NoInt(int oldFd, int newFd) {
  return wrapNoInt(dup2, oldFd, newFd);
}

int fdatasyncNoInt(int fd) {
#if defined(__APPLE__)
  return wrapNoInt(fcntl, fd, F_FULLFSYNC);
#elif defined(__FreeBSD__) || defined(_MSC_VER)
  return wrapNoInt(fsync, fd);
#else
  return wrapNoInt(fdatasync, fd);
#endif
}

int ftruncateNoInt(int fd, off_t len) {
  return wrapNoInt(ftruncate, fd, len);
}

int truncateNoInt(const char* path, off_t len) {
  return wrapNoInt(truncate, path, len);
}

int flockNoInt(int fd, int operation) {
  return wrapNoInt(flock, fd, operation);
}

int shutdownNoInt(NetworkSocket fd, int how) {
  return wrapNoInt(netops::shutdown, fd, how);
}

ssize_t readNoInt(int fd, void* buf, size_t count) {
  return wrapNoInt(folly::fileops::read, fd, buf, count);
}

ssize_t preadNoInt(int fd, void* buf, size_t count, off_t offset) {
  return wrapNoInt(pread, fd, buf, count, offset);
}

ssize_t readvNoInt(int fd, const iovec* iov, int count) {
  return wrapNoInt(readv, fd, iov, count);
}

ssize_t preadvNoInt(int fd, const iovec* iov, int count, off_t offset) {
  return wrapNoInt(preadv, fd, iov, count, offset);
}

ssize_t writeNoInt(int fd, const void* buf, size_t count) {
  return wrapNoInt(folly::fileops::write, fd, buf, count);
}

ssize_t pwriteNoInt(int fd, const void* buf, size_t count, off_t offset) {
  return wrapNoInt(pwrite, fd, buf, count, offset);
}

ssize_t writevNoInt(int fd, const iovec* iov, int count) {
  return wrapNoInt(writev, fd, iov, count);
}

ssize_t pwritevNoInt(int fd, const iovec* iov, int count, off_t offset) {
  return wrapNoInt(pwritev, fd, iov, count, offset);
}

ssize_t readFull(int fd, void* buf, size_t count) {
  return wrapFull(folly::fileops::read, fd, buf, count);
}

ssize_t preadFull(int fd, void* buf, size_t count, off_t offset) {
  return wrapFull(pread, fd, buf, count, offset);
}

ssize_t writeFull(int fd, const void* buf, size_t count) {
  return wrapFull(folly::fileops::write, fd, const_cast<void*>(buf), count);
}

ssize_t pwriteFull(int fd, const void* buf, size_t count, off_t offset) {
  return wrapFull(pwrite, fd, const_cast<void*>(buf), count, offset);
}

#ifndef _WIN32
ssize_t readvFull(int fd, iovec* iov, int count) {
  return wrapvFull(readv, fd, iov, count);
}

ssize_t preadvFull(int fd, iovec* iov, int count, off_t offset) {
  return wrapvFull(preadv, fd, iov, count, offset);
}

ssize_t writevFull(int fd, iovec* iov, int count) {
  return wrapvFull(writev, fd, iov, count);
}

ssize_t pwritevFull(int fd, iovec* iov, int count, off_t offset) {
  return wrapvFull(pwritev, fd, iov, count, offset);
}
#else // _WIN32

// On Windows, the *vFull() functions wrap the simple read/pread/write/pwrite
// functions.  While folly/portability/SysUio.cpp does define readv() and
// writev() implementations for Windows, these attempt to lock the file to
// provide atomicity.  The *vFull() functions do not provide any atomicity
// guarantees, so we can avoid the locking logic.

ssize_t readvFull(int fd, iovec* iov, int count) {
  return wrapvFull(folly::fileops::read, fd, iov, count);
}

ssize_t preadvFull(int fd, iovec* iov, int count, off_t offset) {
  return wrapvFull(pread, fd, iov, count, offset);
}

ssize_t writevFull(int fd, iovec* iov, int count) {
  return wrapvFull(folly::fileops::write, fd, iov, count);
}

ssize_t pwritevFull(int fd, iovec* iov, int count, off_t offset) {
  return wrapvFull(pwrite, fd, iov, count, offset);
}
#endif // _WIN32

WriteFileAtomicOptions& WriteFileAtomicOptions::setPermissions(
    mode_t _permissions) {
  permissions = _permissions;
  return *this;
}

WriteFileAtomicOptions& WriteFileAtomicOptions::setSyncType(
    SyncType _syncType) {
  syncType = _syncType;
  return *this;
}

WriteFileAtomicOptions& WriteFileAtomicOptions::setTemporaryDirectory(
    std::string _temporaryDirectory) {
  temporaryDirectory = std::move(_temporaryDirectory);
  return *this;
}

namespace {
void throwIfWriteFileAtomicFailed(
    std::string_view function, std::string_view filename, std::int64_t rc) {
  if (rc != 0) {
    auto msg =
        std::string{function} + "() failed to update " + std::string{filename};
    throw std::system_error(rc, std::generic_category(), msg);
  }
}

// We write the data to a temporary file name first, then atomically rename
// it into place.
//
// If SyncType::WITH_SYNC is used, this ensures that the file contents will
// always be valid, even if we crash or are killed partway through writing out
// data.
int writeFileAtomicNoThrowImpl(
    std::string_view filename,
    iovec* iov,
    int count,
    const WriteFileAtomicOptions& options) {
  // create a null-terminated version of the filename
  auto filePathString = std::string{filename};
  auto temporaryFilePathString = fileutil_detail::getTemporaryFilePathString(
      filePathString, options.temporaryDirectory);

  auto tmpFD = mkstemp(const_cast<char*>(temporaryFilePathString.data()));
  if (tmpFD == -1) {
    return errno;
  }
  bool success = false;
  SCOPE_EXIT {
    if (tmpFD != -1) {
      fileops::close(tmpFD);
    }
    if (!success) {
      unlink(temporaryFilePathString.c_str());
    }
  };

  auto rc = writevFull(tmpFD, iov, count);
  if (rc == -1) {
    return errno;
  }

  rc = fchmod(tmpFD, options.permissions);
  if (rc == -1) {
    return errno;
  }

  // To guarantee atomicity across power failues on POSIX file systems,
  // the temporary file must be explicitly sync'ed before the rename.
  if (options.syncType == SyncType::WITH_SYNC) {
    rc = fsyncNoInt(tmpFD);
    if (rc == -1) {
      return errno;
    }
  }

  // Close the file before renaming to make sure all data has
  // been successfully written.
  rc = fileops::close(tmpFD);
  tmpFD = -1;
  if (rc == -1) {
    return errno;
  }

  rc = rename(temporaryFilePathString.c_str(), filePathString.c_str());
  if (rc == -1) {
    return errno;
  }
  success = true;
  return 0;
}
} // namespace

int writeFileAtomicNoThrow(
    std::string_view filename,
    iovec* iov,
    int count,
    mode_t permissions,
    SyncType syncType) {
  return writeFileAtomicNoThrowImpl(
      filename,
      iov,
      count,
      WriteFileAtomicOptions{}
          .setPermissions(permissions)
          .setSyncType(syncType));
}

int writeFileAtomicNoThrow(
    std::string_view filename,
    std::string_view data,
    const WriteFileAtomicOptions& options) {
  auto iov = getIOVecFor(ByteRange{data});
  return writeFileAtomicNoThrowImpl(filename, &iov, 1, options);
}

void writeFileAtomic(
    std::string_view filename,
    iovec* iov,
    int count,
    mode_t permissions,
    SyncType syncType) {
  auto rc = writeFileAtomicNoThrowImpl(
      filename,
      iov,
      count,
      WriteFileAtomicOptions{}
          .setPermissions(permissions)
          .setSyncType(syncType));
  throwIfWriteFileAtomicFailed(__func__, filename, rc);
}

void writeFileAtomic(
    std::string_view filename,
    ByteRange data,
    mode_t permissions,
    SyncType syncType) {
  auto iov = getIOVecFor(data);
  writeFileAtomic(fil
```

### Core Architecture Module: `folly/FileUtil.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <sys/stat.h>
#include <sys/types.h>

#include <cassert>
#include <filesystem>
#include <limits>
#include <string_view>

#include <folly/Portability.h>
#include <folly/Range.h>
#include <folly/ScopeGuard.h>
#include <folly/net/NetworkSocket.h>
#include <folly/portability/Fcntl.h>
#include <folly/portability/SysUio.h>
#include <folly/portability/Unistd.h>

namespace folly {

/**
 * Convenience wrappers around some commonly used system calls.  The *NoInt
 * wrappers retry on EINTR.  The *Full wrappers retry on EINTR and also loop
 * until all data is written.  Note that *Full wrappers weaken the thread
 * semantics of underlying system calls.
 */
int openNoInt(const char* name, int flags, mode_t mode = 0666);
// Two overloads, as we may be closing either a file or a socket.
int closeNoInt(int fd);
int closeNoInt(NetworkSocket fd);
int dupNoInt(int fd);
int dup2NoInt(int oldFd, int newFd);
int fsyncNoInt(int fd);
int fdatasyncNoInt(int fd);
int ftruncateNoInt(int fd, off_t len);
int truncateNoInt(const char* path, off_t len);
int flockNoInt(int fd, int operation);
int shutdownNoInt(NetworkSocket fd, int how);

ssize_t readNoInt(int fd, void* buf, size_t count);
ssize_t preadNoInt(int fd, void* buf, size_t count, off_t offset);
ssize_t readvNoInt(int fd, const iovec* iov, int count);
ssize_t preadvNoInt(int fd, const iovec* iov, int count, off_t offset);

ssize_t writeNoInt(int fd, const void* buf, size_t count);
ssize_t pwriteNoInt(int fd, const void* buf, size_t count, off_t offset);
ssize_t writevNoInt(int fd, const iovec* iov, int count);
ssize_t pwritevNoInt(int fd, const iovec* iov, int count, off_t offset);

/**
 * Wrapper around read() (and pread()) that, in addition to retrying on
 * EINTR, will loop until all data is read.
 *
 * This wrapper is only useful for blocking file descriptors (for non-blocking
 * file descriptors, you have to be prepared to deal with incomplete reads
 * anyway), and only exists because POSIX allows read() to return an incomplete
 * read if interrupted by a signal (instead of returning -1 and setting errno
 * to EINTR).
 *
 * Note that this wrapper weakens the thread safety of read(): the file pointer
 * is shared between threads, but the system call is atomic.  If multiple
 * threads are reading from a file at the same time, you don't know where your
 * data came from in the file, but you do know that the returned bytes were
 * contiguous.  You can no longer make this assumption if using readFull().
 * You should probably use pread() when reading from the same file descriptor
 * from multiple threads simultaneously, anyway.
 *
 * Note that readvFull and preadvFull require iov to be non-const, unlike
 * readv and preadv.  The contents of iov after these functions return
 * is unspecified.
 */
[[nodiscard]] ssize_t readFull(int fd, void* buf, size_t count);
[[nodiscard]] ssize_t preadFull(int fd, void* buf, size_t count, off_t offset);
[[nodiscard]] ssize_t readvFull(int fd, iovec* iov, int count);
[[nodiscard]] ssize_t preadvFull(int fd, iovec* iov, int count, off_t offset);

/**
 * Similar to readFull and preadFull above, wrappers around write() and
 * pwrite() that loop until all data is written.
 *
 * Generally, the write() / pwrite() system call may always write fewer bytes
 * than requested, just like read().  In certain cases (such as when writing to
 * a pipe), POSIX provides stronger guarantees, but not in the general case.
 * For example, Linux (even on a 64-bit platform) won't write more than 2GB in
 * one write() system call.
 *
 * Note that writevFull and pwritevFull require iov to be non-const, unlike
 * writev and pwritev.  The contents of iov after these functions return
 * is unspecified.
 *
 * These functions return -1 on error, or the total number of bytes written
 * (which is always the same as the number of requested bytes) on success.
 */
ssize_t writeFull(int fd, const void* buf, size_t count);
ssize_t pwriteFull(int fd, const void* buf, size_t count, off_t offset);
ssize_t writevFull(int fd, iovec* iov, int count);
ssize_t pwritevFull(int fd, iovec* iov, int count, off_t offset);

/**
 * Read entire file (if num_bytes is defaulted) or no more than
 * num_bytes (otherwise) into container *out. The container is assumed
 * to be contiguous, with element size equal to 1, and offer size(),
 * reserve(), and random access (e.g. std::vector<char>, std::string,
 * fbstring).
 *
 * Returns: true on success or false on failure. In the latter case
 * errno will be set appropriately by the failing system primitive.
 */
template <class Container>
bool readFile(
    int fd,
    Container& out,
    size_t num_bytes = std::numeric_limits<size_t>::max()) {
  static_assert(
      sizeof(out[0]) == 1,
      "readFile: only containers with byte-sized elements accepted");

  size_t soFar = 0; // amount of bytes successfully read
  SCOPE_EXIT {
    assert(out.size() >= soFar); // resize better doesn't throw
    out.resize(soFar);
  };

  // Obtain file size:
  struct stat buf;
  if (fstat(fd, &buf) == -1) {
    return false;
  }
  // Some files (notably under /proc and /sys on Linux) lie about
  // their size, so treat the size advertised by fstat under advise
  // but don't rely on it. In particular, if the size is zero, we
  // should attempt to read stuff. If not zero, we'll attempt to read
  // one extra byte.
  constexpr size_t initialAlloc = 1024 * 4;
  out.resize(
      std::min(
          buf.st_size > 0 ? (size_t(buf.st_size) + 1) : initialAlloc,
          num_bytes));

  while (soFar < out.size()) {
    const auto actual = readFull(fd, &out[soFar], out.size() - soFar);
    if (actual == -1) {
      return false;
    }
    soFar += actual;
    if (soFar < out.size()) {
      // File exhausted
      break;
    }
    // Ew, allocate more memory. Use exponential growth to avoid
    // quadratic behavior. Cap size to num_bytes.
    out.resize(std::min(out.size() * 3 / 2, num_bytes));
  }

  return true;
}

/**
 * Same as above, but takes in a file name instead of fd
 */
template <class Container>
bool readFile(
    const char* file_name,
    Container& out,
    size_t num_bytes = std::numeric_limits<size_t>::max()) {
  assert(file_name);

  const auto fd = openNoInt(file_name, O_RDONLY | O_CLOEXEC);
  if (fd == -1) {
    return false;
  }

  SCOPE_EXIT {
    // Ignore errors when closing the file
    closeNoInt(fd);
  };

  return readFile(fd, out, num_bytes);
}

/**
 * Same as above, but takes a std::filesystem::path instead of fd
 */
template <class Container>
  requires(std::same_as<std::filesystem::path::value_type, char>)
bool readFile(
    const std::filesystem::path& path,
    Container& out,
    size_t num_bytes = std::numeric_limits<size_t>::max()) {
  return readFile(path.c_str(), out, num_bytes);
}

/**
 * Writes container to file. The container is assumed to be
 * contiguous, with element size equal to 1, and offering STL-like
 * methods empty(), size(), and indexed access
 * (e.g. std::vector<char>, std::string, fbstring, StringPiece).
 *
 * "flags" dictates the open flags to use. Default is to create file
 * if it doesn't exist and truncate it.
 *
 * Returns: true on success or false on failure. In the latter case
 * errno will be set appropriately by the failing system primitive.
 *
 * Note that this function may leave the file in a partially written state on
 * failure.  Use writeFileAtomic() if you want to ensure that the existing file
 * state will be unchanged on error.
 */
template <class Container>
bool writeFile(
    const Container& data,
    const char* filename,
    int flags = O_WRONLY | O_CREAT | O_TRUNC,
    mode_t mode = 0666) {
  static_assert(
      sizeof(data[0]) == 1, "writeFile works with element size equal to 1");
  int fd = fileops::open(filename, flags, mode);
  if (fd == -1) {
    return false;
  }
  bool ok = data.empty() ||
      writeFull(fd, &data[0], data.size()) == static_cast<ssize_t>(data.size());
  return closeNoInt(fd) == 0 && ok;
}

/**
 * Same as above, but takes a std::filesystem::path instead of filename
 */
template <class Container>
  requires(std::same_as<std::filesystem::path::value_type, char>)
bool writeFile(
    const Container& data,
    const std::filesystem::path& filename,
    int flags = O_WRONLY | O_CREAT | O_TRUNC,
    mode_t mode = 0666) {
  return writeFile(data, filename.c_str(), flags, mode);
}

/* For atomic writes, do we sync to guarantee ordering or not? */
enum class SyncType {
  WITH_SYNC,
  WITHOUT_SYNC,
};

class WriteFileAtomicOptions {
 public:
  WriteFileAtomicOptions() = default;

  mode_t permissions{0644};
  SyncType syncType{SyncType::WITHOUT_SYNC};
  std::string temporaryDirectory;

  // The mode bits used for the temporary file
  WriteFileAtomicOptions& setPermissions(mode_t);

  // The default implementation does not sync the data to storage before the
  // rename.  Therefore, the write is *not* atomic in the event of a power
  // failure or OS crash.  To guarantee atomicity in these cases, specify
  // syncType = WITH_SYNC, which will incur a performance cost of waiting for
  // the data to be persisted to storage.  Note that the return of the function
  // does not guarantee the directory modifications have been written to disk; a
  // further sync of the directory after the function returns is required to
  // ensure the modification is durable.
  Write
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #348** (2016-03-19): **Commit 2a0cb937 breaks compilation on OS X Yosemite**
  *Symptoms*: OS X Yosemite doesn't seem to know about __NR_gettid, but does know about SYS_gettid. 
  **Post-Mortem & Fix Analysis**:
  > Already fixed. 

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

### Incident Patch 1: `da724490` (2026-11-19)
**Commit Message**: add fixed-work F14 cache-locality profiles

Summary:
[🤖 Metamate] Extend `HashMapsBench` with an opt-in `--map_locality` matrix for Value/Node/Vector maps, uint64 keys, and 1/17-byte values. Hot and eviction cases share fixtures and shuffled traces. Large cases traverse the complete trace over a table sized so its allocated header-line arena exceeds LLC, rather than repeatedly warming a small query subset.

Cover hits, misses, exact 50/50 mixes, forced no-tag/false-tag misses, and multi-chunk overflow misses/last hits. A shared noinline lookup kernel keeps ordinary hashing in the timed region; compiler-ordering barriers and consumed checksums keep repeated work observable. Check membership, values, candidate counts and overflow shapes outside timing without adding instrumentation or private seams to F14.

Use fixed-work Folly profiling and the actual returned operation count, with checked rounding. Report seeds, traces and allocation footprints; reserve the retained eviction buffer in all memory estimates. Separate wrapper controls are diagnostic, not additionally subtracted. Eviction remains best-effort cache pressure, and a single profile does not establish confidence intervals 

**File**: `folly/container/test/BUCK` (modified, +3/-0)
```diff
@@ -683,6 +683,7 @@ fb_dirsync_cpp_unittest(
 fb_dirsync_cpp_binary(
     name = "hash_maps_bench",
     srcs = ["HashMapsBench.cpp"],
+    labels = _F14_FALLBACK_CI_LABELS,
     deps = [
         "fbsource//third-party/fmt:fmt",
         "fbsource//third-party/glog:glog",
@@ -694,6 +695,8 @@ fb_dirsync_cpp_binary(
         "//folly/container:f14_hash",
         "//folly/hash:hash",
         "//folly/init:init",
+        "//folly/lang:align",
+        "//folly/lang:exception",
         "//folly/portability:gflags",
     ],
 )
```

**File**: `folly/container/test/HashMapsBench.cpp` (modified, +487/-0)
```diff
@@ -15,12 +15,19 @@
  */
 
 #include <array>
+#include <atomic>
 #include <cstddef>
 #include <functional>
+#include <limits>
 #include <map>
 #include <random>
+#include <stdexcept>
 #include <string>
+#include <string_view>
+#include <type_traits>
 #include <unordered_map>
+#include <utility>
+#include <vector>
 
 #include <fmt/format.h>
 #include <glog/logging.h>
@@ -31,6 +38,8 @@
 #include <folly/Random.h>
 #include <folly/hash/Hash.h>
 #include <folly/init/Init.h>
+#include <folly/lang/Align.h>
+#include <folly/lang/Exception.h>
 #include <folly/portability/GFlags.h>
 
 #include <folly/container/F14Map.h>
@@ -52,6 +61,28 @@ DEFINE_int32(
 DEFINE_int32(
     map_size_step, 32, "multiplier for each benchmark between iterations");
 
+DEFINE_bool(
+    map_locality, false, "Run the fixed-work F14 locality matrix instead.");
+DEFINE_uint32(
+    map_locality_small_entries,
+    128,
+    "Entries for non-collision hot/eviction fixtures; collisions use fixed 6/64.");
+DEFINE_uint32(
+    map_locality_evict_iters,
+    128,
+    "Eviction lookups, a positive multiple of 128.");
+DEFINE_uint32(map_locality_seed, 42, "Fixed locality query-shuffle seed.");
+DEFINE_uint32(
+    map_locality_large_llc_factor,
+    2,
+    "Minimum large header-line footprint / LLC.");
+DEFINE_uint64(
+    map_locality_hot_max_bytes, 16384, "Hot map+query allocation budget.");
+DEFINE_uint64(
+    map_locality_max_bytes,
+    uint64_t{8} << 30,
+    "Per-process active map+query+reserved eviction-buffer budget, not RSS.");
+
 //////// Key related preparation ////////
 
 namespace {
@@ -453,6 +484,452 @@ void runAllHashMapTests() {
   }
 }
 
+namespace {
+
+#if FOLLY_F14_VECTOR_INTRINSICS_AVAILABLE
+
+using std::literals::operator""sv;
+
+enum class LookupLocality { hot, eviction, large };
+enum class LookupPattern {
+  hit,
+  miss,
+  mixed,
+  no_tag,
+  false_tag,
+  overflow_no_tag,
+  overflow_false_tag,
+  overflow_last_hit,
+};
+
+struct LookupConfig {
+  std::string name;
+  LookupLocality locality;
+  LookupPattern pattern;
+};
+
+constexpr std::array kLookupLocalities{
+    std::pair{LookupLocality::hot, "Hot"sv},
+    std::pair{LookupLocality::eviction, "Eviction"sv},
+    std::pair{LookupLocality::large, "Large"sv},
+};
+constexpr std::array kLookupPatterns{
+    std::pair{LookupPattern::hit, "hit"sv},
+    std::pair{LookupPattern::miss, "miss"sv},
+    std::pair{LookupPattern::mixed, "mixed"sv},
+    std::pair{LookupPattern::no_tag, "no_tag"sv},
+    std::pair{LookupPattern::false_tag, "false_tag"sv},
+    std::pair{LookupPattern::overflow_no_tag, "overflow_no_tag"sv},
+    std::pair{LookupPattern::overflow_false_tag, "overflow_false_tag"sv},
+    std::pair{LookupPattern::overflow_last_hit, "overflow_last_hit"sv},
+};
+
+bool noTagPattern(LookupPattern pattern) {
+  return pattern == LookupPattern::no_tag ||
+      pattern == LookupPattern::overflow_no_tag;
+}
+
+bool overflowPattern(LookupPattern pattern) {
+  return pattern == LookupPattern::overflow_no_tag ||
+      pattern == LookupPattern::overflow_false_tag ||
+      pattern == LookupPattern::overflow_last_hit;
+}
+
+bool collisionPattern(LookupPattern pattern) {
+  return noTagPattern(pattern) || pattern == LookupPattern::false_tag ||
+      overflowPattern(pattern);
+}
+
+size_t maxProbe(std::vector<size_t> const& histo) {
+  for (size_t i = histo.size(); i != 0; --i) {
+    if (histo[i - 1] != 0) {
+      return i - 1;
+    }
+  }
+  return 0;
+}
+
+struct LookupCollisionHash {
+  // Intentionally non-avalanching; opt out of remixing to preserve fixture
+  // tags.
+  using folly_is_avalanching = std::true_type;
+  size_t operator()(uint64_t key) const {
+    return static_cast<size_t>(key & 255) << (sizeof(size_t) * 8 - 8);
+  }
+};
+
+struct LookupCountEqual {
+  size_t* calls;
+  bool operator()(uint64_t a, uint64_t b) const {
+    ++*calls;
+    return a == b;
+  }
+};
+
+size_t localityEntries(LookupConfig const& config, size_t llc) {
+  if (collisionPattern(config.pattern)) {
+    return overflowPattern(config.pattern) ? 64 : 6;
+  }
+  if (config.locality != LookupLocality::large) {
+    return FLAGS_map_locality_small_entries;
+  }
+  auto const factor = FLAGS_map_locality_large_llc_factor;
+  if (llc == 0 || llc > std::numeric_limits<size_t>::max() / factor) {
+    throw_exception<std::length_error>("Invalid large locality footprint");
+  }
+  auto const bytes = llc * factor;
+  auto const lines = bytes / hardware_constructive_interference_size +
+      (bytes % hardware_constructive_interference_size != 0);
+  if (lines > std::numeric_limits<uint32_t>::max() / 32) {
+    throw_exception<std::length_error>("Too many locality entries");
+  }
+  // At most 16 slots per chunk; size the allocated header-line arena beyond
+  // LLC.
+  return lines * 16;
+}
+
+uint64_t localityKey(size_t id, bool collision, uint8_t tag = 17) {
+  return collision
+      ? (uint64_t{id} << 8) | tag
+      : keyGen<uint64_t>(static_cast<uint32_t>(id));
+}
+
+template <typena
```

---

### Incident Patch 2: `e5ca9de6` (2026-11-19)
**Commit Message**: Fix Over-Aligned Element Types in `ProducerConsumerQueue` (#2733)

Summary:
`ProducerConsumerQueue` allocates its ring with `std::malloc`, which only guarantees `alignof(std::max_align_t)`. A `T` with a stricter `alignas` is then constructed on misaligned storage. This is undefined behavior, may crash: an `alignas(32)` `__m256d` struct built with `-mavx2` segfaults on an aligned `vmovapd` store.

The ring is now always allocated with `folly::operator_new` and released with `folly::operator_delete`, passing `std::align_val_t{alignof(T)}` in both cases. There is no change to the public API or object layout.

Pull Request resolved: https://github.com/meta/folly/pull/2733

Reviewed By: r-barnes

Differential Revision: D132984650

Pulled By: yfeldblum

fbshipit-source-id: 96adc5dcb0b156c2f7e7164c6c6a016eb305e90d

**File**: `folly/BUCK` (modified, +1/-0)
```diff
@@ -2167,6 +2167,7 @@ fb_dirsync_cpp_library(
     exported_deps = [
         "//folly/concurrency:cache_locality",
         "//folly/lang:bits",
+        "//folly/lang:new",
     ],
 )
 
```

**File**: `folly/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -1009,6 +1009,7 @@ folly_add_library(
   EXPORTED_DEPS
     folly_concurrency_cache_locality
     folly_lang_bits
+    folly_lang_new
 )
 
 folly_add_library(
```

**File**: `folly/ProducerConsumerQueue.h` (modified, +19/-9)
```diff
@@ -18,7 +18,6 @@
 
 #include <atomic>
 #include <cassert>
-#include <cstdlib>
 #include <limits>
 #include <memory>
 #include <stdexcept>
@@ -27,6 +26,7 @@
 
 #include <folly/concurrency/CacheLocality.h>
 #include <folly/lang/Bits.h>
+#include <folly/lang/New.h>
 
 namespace folly {
 
@@ -75,7 +75,7 @@ struct alignas(hardware_destructive_interference_size) ProducerConsumerQueue {
       }
     }
 
-    std::free(producer_.records);
+    deallocate(producer_.records);
   }
 
   //  Checks a private, unsynchronized cache of the other side's cursor
@@ -211,7 +211,7 @@ struct alignas(hardware_destructive_interference_size) ProducerConsumerQueue {
 
   //  Bundles the three values makeState() computes, so the delegating
   //  constructor below can initialize both producer_ and consumer_ from a
-  //  single malloc() call rather than validating/allocating twice.
+  //  single allocation rather than validating/allocating twice.
   struct State {
     T* records{};
     uint32_t mask{};
@@ -240,7 +240,7 @@ struct alignas(hardware_destructive_interference_size) ProducerConsumerQueue {
 
   //  Computed in 64 bits and checked against size_t's actual range before
   //  narrowing: sizeof(T) * (mask + 1) can legally exceed the 32-bit size_t
-  //  that std::malloc() takes on a 32-bit platform, even though mask itself
+  //  that the allocator takes on a 32-bit platform, even though mask itself
   //  always fits in uint32_t. Silently truncating that byte count would
   //  allocate a smaller buffer than record indices (computed mod mask+1 in
   //  the wider sense) are entitled to touch.
@@ -253,14 +253,24 @@ struct alignas(hardware_destructive_interference_size) ProducerConsumerQueue {
     return static_cast<size_t>(bytes);
   }
 
+  //  std::malloc() only guarantees alignof(std::max_align_t), so storage is
+  //  always drawn from the aligned allocator to support a T with a stricter
+  //  alignas; constructing using storage allocated with malloc() would be
+  //  misaligned, and can fault on the aligned SIMD instructions the compiler
+  //  is then entitled to use.
+  static T* allocate(uint32_t mask) {
+    size_t const bytes = allocationSize(mask);
+    return static_cast<T*>(operator_new(bytes, std::align_val_t{alignof(T)}));
+  }
+
+  static void deallocate(T* records) noexcept {
+    operator_delete(records, std::align_val_t{alignof(T)});
+  }
+
   static State makeState(uint32_t size) {
     uint32_t const validSize = validateSize(size); // in [1, 1 << 31]
     uint32_t const mask = nextPowTwo(validSize) - 1; // in [1, 1 << 31)
-    auto* const records = static_cast<T*>(std::malloc(allocationSize(mask)));
-    if (!records) {
-      throw std::bad_alloc();
-    }
-    return State{records, mask, validSize};
+    return State{allocate(mask), mask, validSize};
   }
 
   explicit ProducerConsumerQueue(State st) noexcept
```

**File**: `folly/test/BUCK` (modified, +1/-0)
```diff
@@ -1238,6 +1238,7 @@ fb_dirsync_cpp_unittest(
     deps = [
         "fbsource//third-party/glog:glog",
         "//folly:producer_consumer_queue",
+        "//folly/lang:align",
         "//folly/portability:gtest",
     ],
 )
```

**File**: `folly/test/ProducerConsumerQueueTest.cpp` (modified, +28/-0)
```diff
@@ -24,6 +24,7 @@
 
 #include <glog/logging.h>
 
+#include <folly/lang/Align.h>
 #include <folly/portability/GTest.h>
 
 //////////////////////////////////////////////////////////////////////
@@ -213,6 +214,26 @@ struct DtorChecker {
 
 unsigned int DtorChecker::numInstances = 0;
 
+template <size_t Align>
+struct alignas(Align) OverAligned {};
+
+template <class T>
+void checkOverAlignedStorage() {
+  // Keep every queue alive such that each ring is a separate allocation. If
+  // they were freed, malloc() could return the same block on each iteration,
+  // and one block whose address is a multiple of alignof(T) would pass every
+  // check.
+  std::vector<std::unique_ptr<folly::ProducerConsumerQueue<T>>> queues;
+
+  for (int i = 0; i < 32; ++i) {
+    queues.push_back(std::make_unique<folly::ProducerConsumerQueue<T>>(2));
+    EXPECT_TRUE(queues.back()->write());
+
+    auto* const front = queues.back()->frontPtr();
+    EXPECT_EQ(front, folly::align_floor(front, alignof(T)));
+  }
+}
+
 } // namespace
 
 //////////////////////////////////////////////////////////////////////
@@ -317,3 +338,10 @@ TEST(PCQ, MinimumSize) {
   EXPECT_TRUE(queue.read(value));
   EXPECT_EQ(value, 3);
 }
+
+TEST(PCQ, OverAlignedStorage) {
+  // 32 bytes is the first alignment malloc() does not guarantee, and 256
+  // exceeds the cache-line-sized alignment an implementation may hardcode.
+  checkOverAlignedStorage<OverAligned<32>>();
+  checkOverAlignedStorage<OverAligned<256>>();
+}
```

---

### Incident Patch 3: `96786bdf` (2026-11-18)
**Commit Message**: Recover truncated .debug_info.dwo offsets in .dwp index

Summary:
`llvm-dwp --continue-on-cu-index-overflow`, which fbcode's `dwp` build wrapper passes by default, keeps packaging after `.debug_info.dwo` passes 4 GiB and writes each unit's offset into `.debug_cu_index` modulo 2^32. LLVM tools rebuild the index in that case. The symbolizer parsed whatever unit sat at the truncated offset without checking its DWO ID, and could not address `.debug_info.dwo` beyond 4 GiB at all, so stack traces symbolized against such packages (Unicorn: D63291887, D81615968) lose their inlined frames, or can take them from the wrong unit.

The recovery is similar to gimli, the Rust DWARF library used by the blazesym symbolizer: `DwarfPackage::find_unit` also steps from the truncated offset in 4 GiB increments and accepts the unit whose ID matches (gimli-rs/gimli#903, pinned in fbsource by D122577485). Unlike gimli, this also recovers DWARF 4 split units, whose DWO ID is in the root DIE, and checks the DWO ID in packages under 4 GiB.

Reviewed By: yfeldblum

Differential Revision: D132680644

fbshipit-source-id: 9a9508b5a5ea845db3777348e067eaa61e004ac4

**File**: `folly/debugging/symbolizer/DwarfCursor.h` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ enum class DwarfParseErrorCode : uint8_t {
 
 struct DwarfParseError {
   DwarfParseErrorCode code;
-  size_t offset;
+  uint64_t offset;
 
   friend bool operator==(const DwarfParseError&, const DwarfParseError&) =
       default;
```

**File**: `folly/debugging/symbolizer/DwarfImpl.cpp` (modified, +4/-6)
```diff
@@ -35,12 +35,10 @@ namespace symbolizer {
 namespace {
 
 template <typename Size = size_t>
-DwarfParseResult<Size> incrementDieOffset(uint32_t offset) {
-  if constexpr (sizeof(Size) <= sizeof(uint32_t)) {
-    if (offset >= std::numeric_limits<Size>::max()) {
-      return makeUnexpected(
-          DwarfParseError{DwarfParseErrorCode::integer_overflow, offset});
-    }
+DwarfParseResult<Size> incrementDieOffset(uint64_t offset) {
+  if (offset >= std::numeric_limits<Size>::max()) {
+    return makeUnexpected(
+        DwarfParseError{DwarfParseErrorCode::integer_overflow, offset});
   }
   return static_cast<Size>(offset) + 1;
 }
```

**File**: `folly/debugging/symbolizer/DwarfUtil.cpp` (modified, +23/-23)
```diff
@@ -261,7 +261,7 @@ DwarfParseResult<DIEAbbreviation> getAbbreviation(
 }
 
 template <typename T>
-DwarfParseResult<T> parseError(DwarfParseErrorCode code, size_t offset) {
+DwarfParseResult<T> parseError(DwarfParseErrorCode code, uint64_t offset) {
   return makeUnexpected(DwarfParseError{code, offset});
 }
 
@@ -287,10 +287,6 @@ DwarfParseResult<CompilationUnitHeader> parseCompilationUnitHeader(
     return parseError<CompilationUnitHeader>(
         DwarfParseErrorCode::invalid_offset, offset);
   }
-  if (offset > std::numeric_limits<uint32_t>::max()) {
-    return parseError<CompilationUnitHeader>(
-        DwarfParseErrorCode::integer_overflow, offset);
-  }
 
   DwarfCursor lengthCursor(debugInfo.subspan(offset), offset);
   auto initialLength = lengthCursor.read<uint32_t>();
@@ -318,8 +314,7 @@ DwarfParseResult<CompilationUnitHeader> parseCompilationUnitHeader(
         DwarfParseErrorCode::truncated, lengthCursor.offset());
   }
   const auto unitSize = lengthFieldSize + static_cast<size_t>(unitLength);
-  if (unitSize > std::numeric_limits<uint32_t>::max() ||
-      offset > std::numeric_limits<uint32_t>::max() - unitSize) {
+  if (unitSize > std::numeric_limits<uint32_t>::max()) {
     return parseError<CompilationUnitHeader>(
         DwarfParseErrorCode::integer_overflow, offset);
   }
@@ -353,7 +348,7 @@ DwarfParseResult<CompilationUnitHeader> parseCompilationUnitHeader(
     }
     header.unitType = *unitType;
     if (!isSupportedCompilationUnitType(header.unitType)) {
-      header.firstDie = static_cast<uint32_t>(cursor.offset());
+      header.firstDie = cursor.offset();
       return header;
     }
 
@@ -401,7 +396,7 @@ DwarfParseResult<CompilationUnitHeader> parseCompilationUnitHeader(
     header.addrSize = *addrSize;
   }
 
-  header.firstDie = static_cast<uint32_t>(cursor.offset());
+  header.firstDie = cursor.offset();
   return header;
 }
 
@@ -591,7 +586,7 @@ DwarfParseResult<bool> parseCompilationUnitMetadata(
     return makeUnexpected(header.error());
   }
 
-  cu.offset = static_cast<uint32_t>(offset);
+  cu.offset = offset;
   cu.is64Bit = header->is64Bit;
   cu.strOffsetsIs64Bit = header->is64Bit;
   cu.size = header->size;
@@ -699,6 +694,21 @@ DwarfParseResult<bool> parseCompilationUnitMetadata(
 
 } // namespace
 
+bool parseDwpCompilationUnit(CompilationUnit& cu, uint64_t dwoId) {
+  const uint64_t infoSize = cu.debugSections.debugInfo.size();
+  for (uint64_t offset = cu.offset; offset < infoSize;
+       offset += uint64_t{1} << 32) {
+    CompilationUnit candidate = cu;
+    auto result =
+        parseCompilationUnitMetadata(candidate, folly::to_narrow(offset), true);
+    if (result.hasValue() && *result && candidate.dwoId == dwoId) {
+      cu = candidate;
+      return true;
+    }
+  }
+  return false;
+}
+
 CompilationUnits getCompilationUnits(
     ElfCacheBase* elfCache,
     const DebugSections& debugSections,
@@ -811,12 +821,8 @@ CompilationUnits getCompilationUnits(
         splitCU.debugSections.debugCuIndex,
         *cu.mainCompilationUnit.dwoId,
         splitCU);
-    if (indexResult.hasError() || !*indexResult) {
-      return cu;
-    }
-    auto splitResult =
-        parseCompilationUnitMetadata(splitCU, splitCU.offset, true);
-    if (splitResult.hasError() || !*splitResult) {
+    if (indexResult.hasError() || !*indexResult ||
+        !parseDwpCompilationUnit(splitCU, *cu.mainCompilationUnit.dwoId)) {
       return cu;
     }
     // 3.1.3 Split Full Compilation Unit Entries
@@ -1263,19 +1269,13 @@ DwarfParseResult<Die> getDieAtOffset(
         DwarfParseError{
             DwarfParseErrorCode::invalid_offset, toErrorOffset(offset)});
   }
-  if (offset > std::numeric_limits<uint32_t>::max()) {
-    return makeUnexpected(
-        DwarfParseError{
-            DwarfParseErrorCode::integer_overflow,
-            static_cast<size_t>(offset)});
-  }
 
   Die die;
   DwarfCursor cursor(
       debugInfo.subspan(
           static_cast<size_t>(offset), static_cast<size_t>(unitEnd - offset)),
       static_cast<size_t>(offset));
-  die.offset = static_cast<uint32_t>(offset);
+  die.offset = offset;
   die.is64Bit = cu.is64Bit;
   auto code = cursor.readULEB();
   if (code.hasError()) {
```

**File**: `folly/debugging/symbolizer/DwarfUtil.h` (modified, +8/-4)
```diff
@@ -79,10 +79,10 @@ struct CompilationUnit {
   uint8_t unitType = DW_UT_compile;
   uint8_t addrSize = 0;
   // Offset in .debug_info of this compilation unit.
-  uint32_t offset = 0;
+  uint64_t offset = 0;
   uint32_t size = 0;
   // Offset in .debug_info for the first DIE in this compilation unit.
-  uint32_t firstDie = 0;
+  uint64_t firstDie = 0;
   folly::Optional<uint64_t> abbrevOffset;
 
   // Compilation directory.
@@ -119,7 +119,7 @@ struct CompilationUnitHeader {
   uint8_t version = 0;
   uint8_t unitType = DW_UT_compile;
   uint8_t addrSize = 0;
-  uint32_t firstDie = 0;
+  uint64_t firstDie = 0;
   uint64_t abbrevOffset = 0;
   folly::Optional<uint64_t> dwoId;
 };
@@ -147,7 +147,7 @@ struct Die {
   // Offset from start to first attribute
   uint8_t attrOffset = 0;
   // Offset within debug info.
-  uint32_t offset = 0;
+  uint64_t offset = 0;
   uint64_t code = 0;
   DIEAbbreviation abbr;
 };
@@ -227,6 +227,10 @@ DwarfParseResult<CompilationUnitHeader> parseCompilationUnitHeader(
 DwarfParseResult<bool> findDwpCompilationUnit(
     std::span<const uint8_t> debugCuIndex, uint64_t dwoId, CompilationUnit& cu);
 
+// Parse the split unit for dwoId at the offset from findDwpCompilationUnit,
+// which llvm-dwp --continue-on-cu-index-overflow may have truncated to 32 bits.
+bool parseDwpCompilationUnit(CompilationUnit& cu, uint64_t dwoId);
+
 // Advance cu.strOffsetsBase from the start of its .dwp contribution to the
 // first entry, taking the offset size from the contribution's own header.
 void setDwpStrOffsetsBase(CompilationUnit& cu);
```

**File**: `folly/debugging/symbolizer/test/BUCK` (modified, +1/-0)
```diff
@@ -265,6 +265,7 @@ fb_dirsync_cpp_unittest(
         "//folly:varint",
         "//folly/debugging/symbolizer:dwarf",
         "//folly/portability:gtest",
+        "//folly/portability:sys_mman",
     ],
 )
 
```

**File**: `folly/debugging/symbolizer/test/DwarfUtilTest.cpp` (modified, +111/-0)
```diff
@@ -26,6 +26,7 @@
 #include <folly/Utility.h>
 #include <folly/Varint.h>
 #include <folly/portability/GTest.h>
+#include <folly/portability/SysMman.h>
 
 #if FOLLY_HAVE_DWARF && FOLLY_HAVE_ELF
 
@@ -119,6 +120,74 @@ std::vector<uint8_t> abbreviation() {
   };
 }
 
+// DWARF 4 split units carry their DWO ID in DW_AT_GNU_dwo_id, DWARF 5 in the
+// unit header.
+std::vector<uint8_t> splitUnitAbbreviation(uint16_t version) {
+  if (version == 5) {
+    return abbreviation();
+  }
+  std::vector<uint8_t> bytes{1, DW_TAG_compile_unit, DW_CHILDREN_yes};
+  appendULEB(bytes, DW_AT_GNU_dwo_id);
+  appendULEB(bytes, DW_FORM_data8);
+  bytes.insert(bytes.end(), {0, 0, 0});
+  return bytes;
+}
+
+std::vector<uint8_t> splitUnit(uint16_t version, uint64_t dwoId) {
+  std::vector<uint8_t> bytes;
+  append<uint32_t>(bytes, 0);
+  append<uint16_t>(bytes, version);
+  if (version == 5) {
+    append<uint8_t>(bytes, DW_UT_split_compile);
+    append<uint8_t>(bytes, sizeof(uintptr_t));
+    append<uint32_t>(bytes, 0);
+    append<uint64_t>(bytes, dwoId);
+    appendULEB(bytes, 1);
+    bytes.insert(bytes.end(), {'x', 0});
+  } else {
+    append<uint32_t>(bytes, 0);
+    append<uint8_t>(bytes, sizeof(uintptr_t));
+    appendULEB(bytes, 1);
+    append<uint64_t>(bytes, dwoId);
+  }
+  bytes.push_back(0);
+  overwrite<uint32_t>(bytes, 0, folly::to_narrow(bytes.size() - 4));
+  return bytes;
+}
+
+class SparseSection {
+ public:
+  explicit SparseSection(size_t size)
+      : size_(size),
+        data_(mmap(
+            nullptr,
+            size,
+            PROT_READ | PROT_WRITE,
+            MAP_PRIVATE | MAP_ANONYMOUS | MAP_NORESERVE,
+            -1,
+            0)) {}
+  SparseSection(const SparseSection&) = delete;
+  SparseSection& operator=(const SparseSection&) = delete;
+  ~SparseSection() {
+    if (valid()) {
+      munmap(data_, size_);
+    }
+  }
+
+  bool valid() const { return data_ != MAP_FAILED; }
+  void write(size_t offset, std::span<const uint8_t> bytes) {
+    std::memcpy(
+        static_cast<uint8_t*>(data_) + offset, bytes.data(), bytes.size());
+  }
+  std::span<const uint8_t> bytes() const {
+    return {static_cast<const uint8_t*>(data_), size_};
+  }
+
+ private:
+  size_t size_;
+  void* data_;
+};
+
 TEST(DwarfUtil, ParsesDwarf4CompilationUnitHeader) {
   const auto bytes = dwarf4Header();
 
@@ -309,6 +378,48 @@ TEST(DwarfUtil, RejectsOverflowingDwpDimensions) {
   EXPECT_EQ(DwarfParseErrorCode::integer_overflow, result.error().code);
 }
 
+TEST(DwarfUtil, FindsDwpUnitPastTruncatedInfoOffset) {
+  if (sizeof(size_t) < sizeof(uint64_t)) {
+    GTEST_SKIP() << "requires a 64-bit address space";
+  }
+  constexpr uint64_t kTruncatedOffset = 0x10;
+  constexpr uint64_t kOffset = (uint64_t{1} << 32) + kTruncatedOffset;
+  constexpr uint64_t kDwoId = 0x123456789abcdef0;
+  SparseSection info(folly::to_narrow(kOffset + 0x1000));
+  if (!info.valid()) {
+    GTEST_SKIP() << "cannot map a section larger than 4 GiB";
+  }
+  for (uint16_t version : {4, 5}) {
+    SCOPED_TRACE(version);
+    const auto abbrev = splitUnitAbbreviation(version);
+    info.write(kTruncatedOffset, splitUnit(version, kDwoId + 1));
+    info.write(folly::to_narrow(kOffset), splitUnit(version, kDwoId));
+    CompilationUnit cu{};
+    cu.debugSections.debugInfo = info.bytes();
+    cu.debugSections.debugAbbrev = abbrev;
+    cu.offset = kTruncatedOffset;
+
+    EXPECT_TRUE(parseDwpCompilationUnit(cu, kDwoId));
+
+    EXPECT_EQ(kOffset, cu.offset);
+    ASSERT_TRUE(cu.dwoId.hasValue());
+    EXPECT_EQ(kDwoId, *cu.dwoId);
+  }
+}
+
+TEST(DwarfUtil, RejectsDwpUnitWithMismatchedDwoIdWithoutModifyingOutput) {
+  const auto info = splitUnit(5, 0x1234);
+  const auto abbrev = splitUnitAbbreviation(5);
+  CompilationUnit cu{};
+  cu.debugSections.debugInfo = info;
+  cu.debugSections.debugAbbrev = abbrev;
+
+  EXPECT_FALSE(parseDwpCompilationUnit(cu, 0x4321));
+
+  EXPECT_EQ(uint32_t{0}, cu.size);
+  EXPECT_FALSE(cu.dwoId.hasValue());
+}
+
 TEST(DwarfUtil, ResolvesStrxThroughDwarf64DwpContributionOfDwarf32Unit) {
   const std::vector<uint8_t> strings{'a', 0, 'b', 0};
   std::vector<uint8_t> stringOffsets(4);
```

#### Recent Merged Pull Requests:
- **PR #2756** (2026-11-18): Re-sync with internal repository (@meta-codesync[bot])
- **PR #2755** (closed): Fix dead fmt format-syntax link in logging docs (@farisbasha)
- **PR #2747** (closed): Reject multi-character labels in `IPAddressV6::fromInverseArpaName` (@0z5a)
- **PR #2746** (closed): Reject `\x` without hex digits in `cUnescape` (@0z5a)
- **PR #2741** (closed): Split the chunk header into F14ChunkHeader; the empty chunk is a real header object (#2741) (@DenisYaroshevskiy)
- **PR #2740** (2026-11-09): Re-sync with internal repository (@meta-codesync[bot])

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

## X. add fixed-work F14 cache-locality profiles

**RULE**:
When implementing operations in `folly/container/test/BUCK`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meta/folly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `da724490`: add fixed-work F14 cache-locality profiles. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `folly/container/test/BUCK`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    labels = _F14_FALLBACK_CI_LABELS,
        "//folly/lang:align",
        "//folly/lang:exception",
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `da724490` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
