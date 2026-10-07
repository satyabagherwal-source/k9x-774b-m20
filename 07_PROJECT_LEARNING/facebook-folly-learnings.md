# Forensic Learning Record (Deep Inspection): facebook/folly

> **Canonical Artifact**: `07_PROJECT_LEARNING/facebook-folly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/facebook/folly](https://github.com/facebook/folly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:32:48.205Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `facebook/folly`
- **Description**: An open-source C++ library developed and used at Facebook.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 30553 stars

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
#include <string>

#include <fmt/format.h>

#include <folly/lang/Align.h>
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
  constexpr auto step =
      folly::hardware_constructive_interference_size / sizeof(size_t);

  constexpr auto words_per_line =
      folly::hardware_constructive_interference_size / step;

  static auto const llc_size = bm_llc_size();

  auto const llc_lines =
      llc_size / folly::hardware_constructive_interference_size;

  static std::unique_ptr<size_t volatile[]> const vec{
      new size_t[llc_lines * words_per_line]};

  // do N passes over the region, each time touching one word per line
  for (size_t j = 0; j < step; ++j) {
    for (size_t i = 0; i < llc_lines; i += step) {
      vec[i * words_per_line + j] = value;
    }
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
}

/// bm_llc_size
///
/// Calculates the size of the LLC (Last Level Cache, typically L3 on x86-64).
size_t bm_llc_size();

/// bm_llc_evict
///
/// Write to a large block of memory and evict whatever cache lines might
/// currently be resident in any levels of cache.
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
ConcurrentLazy<remove_cvref_t<Func>> concurrent_lazy(Func&& func) {
  return ConcurrentLazy<remove_cvref_t<Func>>(static_cast<Func&&>(func));
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
#include <type_traits>
#include <vector>

#include <boost/random.hpp>
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
    static ThreadLocal<boost::lagged_fibonacci2281> rng_;
    return (*rng_)();
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
  void releaseRef() {}

  void add(NodeType* /* node */) {}

  NodeAlloc& alloc() { return alloc_; }

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
    StringPiece function, StringPiece filename, std::int64_t rc) {
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
    StringPiece filename,
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
    StringPiece filename,
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
    StringPiece filename,
    StringPiece data,
    const WriteFileAtomicOptions& options) {
  auto iov = getIOVecFor(ByteRange{data});
  return writeFileAtomicNoThrowImpl(filename, &iov, 1, options);
}

void writeFileAtomic(
    StringPiece filename,
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
    StringPiece filename,
    ByteRange data,
    mode_t permissions,
    SyncType syncType) {
  auto iov = getIOVecFor(data);
  writeFileAtomic(filename, &iov, 1, permissions, syncType);

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
  WriteFileAtomicOptions& setS
```

### Core Architecture Module: `folly/FmtUtility.cpp`
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

#include <folly/FmtUtility.h>

#include <folly/Range.h>
#include <folly/String.h>
#include <folly/ssl/OpenSSLHash.h>

namespace folly {

std::string fmt_vformat_mangle_name_fn::operator()(
    std::string_view const key) const {
  auto& self = *this;
  std::string out;
  self(out, key);
  return out;
}

void fmt_vformat_mangle_name_fn::operator()(
    std::string& out, std::string_view const key) const {
  auto const keyr = folly::ByteRange(folly::StringPiece(key));
  uint8_t enc[32];
  auto const encr = folly::MutableByteRange{std::begin(enc), std::end(enc)};
#if FOLLY_OPENSSL_HAS_BLAKE2B
  folly::ssl::OpenSSLHash::blake2s256(encr, keyr);
#else
  folly::ssl::OpenSSLHash::sha256(encr, keyr);
#endif
  out.push_back('_');
  folly::hexlify(encr, out, true);
}

std::string fmt_vformat_mangle_format_string_fn::operator()(
    std::string_view const str) const {
  return operator()(options{}, str);
}

std::string fmt_vformat_mangle_format_string_fn::operator()(
    options const& opts, std::string_view const str) const {
  auto const fe_opts =
      format_string_for_each_named_arg_options{} //
          .set_numeric_args_as_named(opts.numeric_args_as_named);
  std::string out;
  char const* pos = str.data();
  format_string_for_each_named_arg(fe_opts, str, [&](auto const arg) {
    out.append(pos, arg.data());
    fmt_vformat_mangle_name(out, arg);
    pos = arg.data() + arg.size();
  });
  out.append(pos, str.data() + str.size());
  return out;
}

} // namespace folly

```

### Core Architecture Module: `folly/FmtUtility.h`
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

#include <fmt/args.h>

#include <folly/CppAttributes.h>

namespace folly {

/// fmt_make_format_args_from_map_fn
/// fmt_make_format_args_from_map
///
/// A helper function-object type and variable for making a format-args object
/// from a map.
///
/// May be useful for transitioning from legacy folly::svformat to fmt::vformat.
struct fmt_make_format_args_from_map_fn {
  template <typename Map>
  fmt::dynamic_format_arg_store<fmt::format_context> operator()(
      [[FOLLY_ATTR_CLANG_LIFETIMEBOUND]] Map const& map) const {
    fmt::dynamic_format_arg_store<fmt::format_context> ret;
    ret.reserve(map.size(), map.size());
    for (auto const& [key, val] : map) {
      ret.push_back(fmt::arg(key.c_str(), std::cref(val)));
    }
    return ret;
  }
};
inline constexpr fmt_make_format_args_from_map_fn
    fmt_make_format_args_from_map{};

/// fmt_vformat_mangle_name_fn
/// fmt_vformat_mangle_name
///
/// A helper function-object type and variable for mangling vformat named-arg
/// names which fmt::vformat might not otherwise permit.
struct fmt_vformat_mangle_name_fn {
  std::string operator()(std::string_view const str) const;
  void operator()(std::string& out, std::string_view const str) const;
};
inline constexpr fmt_vformat_mangle_name_fn fmt_vformat_mangle_name{};

/// fmt_vformat_mangle_format_string_fn
/// fmt_vformat_mangle_format_string
///
/// A helper function-object type and variable for mangling the content of
/// vformat format-strings containing named-arg names which fmt::vformat might
/// not otherwise permit.
struct fmt_vformat_mangle_format_string_fn {
  struct options {
    bool numeric_args_as_named = false;

    options& set_numeric_args_as_named(bool value) noexcept {
      numeric_args_as_named = value;
      return *this;
    }
  };

  std::string operator()(std::string_view const str) const;
  std::string operator()(options const& opts, std::string_view const str) const;
};
inline constexpr fmt_vformat_mangle_format_string_fn
    fmt_vformat_mangle_format_string{};

using fmt_vformat_mangle_format_string_options =
    fmt_vformat_mangle_format_string_fn::options;

} // namespace folly

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

### Incident Patch 1: `0c515a40` (2026-10-07)
**Commit Message**: right-size fixed provided-buffer ring tests

Summary:
Give the fixed provided-buffer-ring suite one checked two-entry io_uring per test and reduce its concurrency workload from 16,384 buffers to 1,024. Move the real 32,768-entry acceptance check into a dedicated heavyweight8 target so ordinary TestPilot subruns cannot contend for the shared memlock budget, while retaining invalid-boundary checks in the normal suite.

___

Differential Revision: D123783963

fbshipit-source-id: 1856691ade6c18589d17eafc29b6b147210e02dd

**File**: `folly/io/async/test/BUCK` (modified, +13/-0)
```diff
@@ -1352,6 +1352,19 @@ fbcode_target(
     ],
 )
 
+fbcode_target(
+    _kind = cpp_unittest,
+    name = "io_uring_provided_buffer_ring_max_capacity_test",
+    srcs = ["IoUringProvidedBufferRingMaxCapacityTest.cpp"],
+    labels = [
+        tpx_labels.heavyweight8,
+        tpx_labels.serialize_test_cases,
+    ],
+    deps = [
+        "//folly/io/async:io_uring_provided_buffer_ring",
+    ],
+)
+
 fbcode_target(
     _kind = cpp_unittest,
     name = "io_uring_dynamic_provided_buffer_ring_test",
```

**File**: `folly/io/async/test/IoUringProvidedBufferRingMaxCapacityTest.cpp` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+#include <folly/io/async/IoUringProvidedBufferRing.h>
+
+#include <gtest/gtest.h>
+
+#if FOLLY_HAS_LIBURING
+
+namespace folly {
+namespace {
+
+TEST(IoUringProvidedBufferRingMaxCapacityTest, Create) {
+  io_uring ring{};
+  ASSERT_EQ(0, ::io_uring_queue_init(2, &ring, 0));
+
+  IoUringProvidedBufferRing::Options options = {
+      .gid = 0,
+      .bufferCount = 32768,
+      .bufferSize = 32,
+  };
+  auto maxRing = IoUringProvidedBufferRing::create(&ring, options);
+
+  EXPECT_EQ(maxRing->count(), 32768);
+  maxRing.reset();
+  ::io_uring_queue_exit(&ring);
+}
+
+} // namespace
+} // namespace folly
+
+#endif
```

**File**: `folly/io/async/test/IoUringProvidedBufferRingTest.cpp` (modified, +30/-30)
```diff
@@ -28,7 +28,24 @@ using namespace ::testing;
 using namespace ::std;
 using namespace ::folly;
 
-struct IoUringProvidedBufferRingTest : testing::Test {};
+struct IoUringProvidedBufferRingTest : testing::Test {
+  void SetUp() override {
+    const auto ret = ::io_uring_queue_init(2, &ring_, 0);
+    ASSERT_EQ(0, ret);
+    ringInitialized_ = true;
+  }
+
+  void TearDown() override {
+    if (ringInitialized_) {
+      ::io_uring_queue_exit(&ring_);
+    }
+  }
+
+  io_uring ring_{};
+
+ private:
+  bool ringInitialized_{false};
+};
 
 namespace folly {
 class IoUringProvidedBufferRingTestHelper {
@@ -44,14 +61,12 @@ class IoUringProvidedBufferRingTestHelper {
 } // namespace folly
 
 TEST_F(IoUringProvidedBufferRingTest, Create) {
-  io_uring ring{};
-  io_uring_queue_init(512, &ring, 0);
   IoUringProvidedBufferRing::Options options = {
       .gid = 1,
       .bufferCount = 1024,
       .bufferSize = 4096,
   };
-  auto bufRing = IoUringProvidedBufferRing::create(&ring, options);
+  auto bufRing = IoUringProvidedBufferRing::create(&ring_, options);
   EXPECT_EQ(bufRing->count(), 1024);
   EXPECT_TRUE(bufRing->available());
   EXPECT_EQ(bufRing->sizePerBuffer(), 4096);
@@ -60,14 +75,12 @@ TEST_F(IoUringProvidedBufferRingTest, Create) {
 }
 
 TEST_F(IoUringProvidedBufferRingTest, CreateNoHugepages) {
-  io_uring ring{};
-  io_uring_queue_init(512, &ring, 0);
   IoUringProvidedBufferRing::Options options = {
       .gid = 1,
       .bufferCount = 2048,
       .bufferSize = 4096,
   };
-  auto bufRing = IoUringProvidedBufferRing::create(&ring, options);
+  auto bufRing = IoUringProvidedBufferRing::create(&ring_, options);
   EXPECT_EQ(bufRing->count(), 2048);
   EXPECT_TRUE(bufRing->available());
   EXPECT_EQ(bufRing->sizePerBuffer(), 4096);
@@ -76,14 +89,12 @@ TEST_F(IoUringProvidedBufferRingTest, CreateNoHugepages) {
 }
 
 TEST_F(IoUringProvidedBufferRingTest, BufferMinSize) {
-  io_uring ring{};
-  io_uring_queue_init(512, &ring, 0);
   IoUringProvidedBufferRing::Options options = {
       .gid = 1,
       .bufferCount = 16,
       .bufferSize = 8,
   };
-  auto bufRing = IoUringProvidedBufferRing::create(&ring, options);
+  auto bufRing = IoUringProvidedBufferRing::create(&ring_, options);
   EXPECT_EQ(bufRing->count(), 16);
   EXPECT_TRUE(bufRing->available());
   // constexpr size_t kMinBufferSize = 32;
@@ -93,8 +104,6 @@ TEST_F(IoUringProvidedBufferRingTest, BufferMinSize) {
 }
 
 TEST_F(IoUringProvidedBufferRingTest, BufferCountCheck) {
-  io_uring ring{};
-  io_uring_queue_init(512, &ring, 0);
   uint16_t bgid = 0;
 
   auto makeOptions = [&bgid](uint32_t bufferCount) {
@@ -105,36 +114,31 @@ TEST_F(IoUringProvidedBufferRingTest, BufferCountCheck) {
     };
   };
 
-  auto minRing = IoUringProvidedBufferRing::create(&ring, makeOptions(2));
+  auto minRing = IoUringProvidedBufferRing::create(&ring_, makeOptions(2));
   EXPECT_EQ(minRing->count(), 2);
 
-  auto maxRing = IoUringProvidedBufferRing::create(&ring, makeOptions(32768));
-  EXPECT_EQ(maxRing->count(), 32768);
-
-  auto bufRing = IoUringProvidedBufferRing::create(&ring, makeOptions(1000));
+  auto bufRing = IoUringProvidedBufferRing::create(&ring_, makeOptions(1000));
   EXPECT_EQ(bufRing->count(), 1024);
 
-  auto roundedRing = IoUringProvidedBufferRing::create(&ring, makeOptions(1));
+  auto roundedRing = IoUringProvidedBufferRing::create(&ring_, makeOptions(1));
   EXPECT_EQ(roundedRing->count(), 2);
 
   EXPECT_THROW(
-      IoUringProvidedBufferRing::create(&ring, makeOptions(0)),
+      IoUringProvidedBufferRing::create(&ring_, makeOptions(0)),
       std::runtime_error);
 
   EXPECT_THROW(
-      IoUringProvidedBufferRing::create(&ring, makeOptions(32769)),
+      IoUringProvidedBufferRing::create(&ring_, makeOptions(32769)),
       std::runtime_error);
 }
 
 TEST_F(IoUringProvidedBufferRingTest, DelayedDestruction) {
-  io_uring ring{};
-  io_uring_queue_init(512, &ring, 0);
   IoUringProvidedBufferRing::Options options = {
       .gid = 1,
       .bufferCount = 1024,
       .bufferSize = 4096,
   };
-  auto bufRing = IoUringProvidedBufferRing::create(&ring, options);
+  auto bufRing = IoUringProvidedBufferRing::create(&ring_, options);
   auto buf1 = bufRing->getIoBuf(0, 1024, false);
   auto buf2 = bufRing->getIoBuf(1, 1024, false);
   buf1.reset();
@@ -143,18 +147,16 @@ TEST_F(IoUringProvidedBufferRingTest, DelayedDestruction) {
 }
 
 TEST_F(IoUringProvidedBufferRingTest, ConcurrentDecBufferState) {
-  constexpr size_t kBufsPerThread = 1024;
+  constexpr size_t kBufsPerThread = 64;
   constexpr int kNumThreads = 16;
   constexpr uint32_t kBufferCount = kBufsPerThread * kNumThreads;
 
-  io_uring ring{};
-  io_uring_queue_init(512, &ring, 0);
   IoUringProvidedBufferRing::Options options = {
       .gid = 1,
       .bufferCount = kBufferCount,
       .bufferSize = 64,
   };
-  auto bufRing = IoUringProvidedBufferRing::create(&ring, options);
+  auto bufRing = IoUringProvidedBufferRing::create(&ring_, options);
 
   // Acquire all 
```

---

### Incident Patch 2: `eaf1e40d` (2026-10-07)
**Commit Message**: SimpleAsyncIO: register and unregister the completion handler on the loop thread

Summary:
`SimpleAsyncIO`'s constructor starts its `ScopedEventBaseThread` (whose loop is running once the constructor returns) and then calls `registerHandler()` for the AIO/io_uring poll fd from the constructing thread. The destructor calls `unregisterHandler()` from the destroying thread too. `event_add`/`event_del` mutate libevent state the loop thread uses with no locking, so both calls race the loop: the loop's first iteration re-registers its notification queue in `applyLoopKeepAlive()`, and the destructor's `event_del` can run while `handlerReady()` is still in flight.

What goes wrong when the race is lost:
- **Registration:** the poll fd ends up in the kernel epoll set with no handler. The kernel completes every op and posts its completion, nothing ever reaps it, and every op on the instance hangs forever. Each op waits on an uncancellable baton, so timeouts can't end it. The loop thread also spins at 100% CPU, because level-triggered epoll keeps reporting the fd as ready. Usually this is accompanied by `EventBase: failed to register event handler for fd N: No such file or directory`, but not

**File**: `folly/io/async/BUCK` (modified, +2/-0)
```diff
@@ -713,11 +713,13 @@ fb_dirsync_cpp_library(
     enable_static_variant = False,
     use_raw_headers = True,
     deps = [
+        "//folly:conv",
         "//folly:string",
         "//folly/coro:baton",
         "//folly/io/async:async_io",
         "//folly/io/async:io_uring",
         "//folly/io/async:liburing",
+        "//folly/lang:exception",
         "//folly/portability:sockets",
     ],
     exported_deps = [
```

**File**: `folly/io/async/CMakeLists.txt` (modified, +2/-0)
```diff
@@ -749,10 +749,12 @@ folly_add_library(
   SRCS SimpleAsyncIO.cpp
   HEADERS SimpleAsyncIO.h
   DEPS
+    folly_conv
     folly_coro_baton
     folly_io_async_async_io
     folly_io_async_io_uring
     folly_io_async_liburing
+    folly_lang_exception
     folly_portability_sockets
     folly_string
   EXPORTED_DEPS
```

**File**: `folly/io/async/SimpleAsyncIO.cpp` (modified, +34/-5)
```diff
@@ -16,11 +16,16 @@
 
 #include <folly/io/async/SimpleAsyncIO.h>
 
+#include <stdexcept>
+#include <string>
+
+#include <folly/Conv.h>
 #include <folly/String.h>
 #include <folly/coro/Baton.h>
 #include <folly/io/async/AsyncIO.h>
 #include <folly/io/async/IoUring.h>
 #include <folly/io/async/Liburing.h>
+#include <folly/lang/Exception.h>
 #include <folly/portability/Sockets.h>
 
 namespace folly {
@@ -83,13 +88,27 @@ SimpleAsyncIO::SimpleAsyncIO(Config cfg)
   }
 
   if (cfg.evb_) {
-    initHandler(cfg.evb_, NetworkSocket::fromFd(asyncIO_->pollFd()));
+    eventBase_ = cfg.evb_;
   } else {
     evb_ = std::make_unique<ScopedEventBaseThread>("SimpleAsyncIO");
-    initHandler(
-        evb_->getEventBase(), NetworkSocket::fromFd(asyncIO_->pollFd()));
+    eventBase_ = evb_->getEventBase();
+  }
+  initHandler(eventBase_, NetworkSocket::fromFd(asyncIO_->pollFd()));
+  // libevent is not thread-safe: registering from this thread while another
+  // thread runs the loop can corrupt its fd table and leave the poll fd
+  // unarmed, so no completion is ever delivered.
+  bool registered = false;
+  eventBase_->runImmediatelyOrRunInEventBaseThreadAndWait([this, &registered] {
+    registered = registerHandler(EventHandler::READ | EventHandler::PERSIST);
+  });
+  if (!registered) {
+    // Without a registered handler no completion is ever delivered, and every
+    // op would hang. Thrown here, not in the callback above: that may run on
+    // the loop thread, where an exception would terminate the process.
+    throw_exception<std::runtime_error>(to<std::string>(
+        "SimpleAsyncIO: failed to register the completion handler for fd ",
+        asyncIO_->pollFd()));
   }
-  registerHandler(EventHandler::READ | EventHandler::PERSIST);
 }
 
 SimpleAsyncIO::~SimpleAsyncIO() {
@@ -104,7 +123,17 @@ SimpleAsyncIO::~SimpleAsyncIO() {
 
   drainedBaton_.wait();
 
-  unregisterHandler();
+  // A destroyed EventBase has already unregistered the handler (libevent
+  // deletes every registered event when the base is freed), so check before
+  // touching eventBase_: some callers let a provided EventBase die first.
+  if (isHandlerRegistered()) {
+    // On the loop thread for the same reason as registration; this also waits
+    // out a handlerReady() that is still polling asyncIO_ after the last op
+    // was returned.
+    eventBase_->runImmediatelyOrRunInEventBaseThreadAndWait([this] {
+      unregisterHandler();
+    });
+  }
 }
 
 void SimpleAsyncIO::handlerReady(uint16_t events) noexcept {
```

**File**: `folly/io/async/SimpleAsyncIO.h` (modified, +5/-0)
```diff
@@ -123,6 +123,10 @@ class SimpleAsyncIO : public EventHandler {
     friend class SimpleAsyncIO;
   };
 
+  /**
+   * @throws std::runtime_error if the completion handler cannot be registered
+   * with the EventBase; such an instance could never complete an operation.
+   */
   explicit SimpleAsyncIO(Config cfg = Config());
   virtual ~SimpleAsyncIO() override;
 
@@ -207,6 +211,7 @@ class SimpleAsyncIO : public EventHandler {
   std::unique_ptr<AsyncBase> asyncIO_;
   Synchronized<std::queue<std::unique_ptr<AsyncBaseOp>>> opsFreeList_;
   std::unique_ptr<ScopedEventBaseThread> evb_;
+  EventBase* eventBase_{nullptr};
   bool terminating_;
   Baton<> drainedBaton_;
 };
```

**File**: `folly/io/async/test/BUCK` (modified, +2/-0)
```diff
@@ -1400,6 +1400,8 @@ fbcode_target(
         "//folly/coro:blocking_wait",
         "//folly/coro:collect",
         "//folly/io:iobuf",
+        "//folly/io/async:async_base",
+        "//folly/io/async:scoped_event_base_thread",
         "//folly/io/async:simple_async_io",
         "//folly/portability:gtest",
         "//folly/synchronization:baton",
```

**File**: `folly/io/async/test/SimpleAsyncIOTest.cpp` (modified, +140/-0)
```diff
@@ -16,13 +16,23 @@
 
 #include <folly/io/async/SimpleAsyncIO.h>
 
+#include <array>
+#include <atomic>
 #include <bitset>
+#include <memory>
+#include <set>
+#include <stdexcept>
+#include <thread>
+#include <vector>
 
 #include <folly/File.h>
 #include <folly/Random.h>
 #include <folly/coro/BlockingWait.h>
 #include <folly/coro/Collect.h>
 #include <folly/io/IOBuf.h>
+#include <folly/io/async/EventBase.h>
+#include <folly/io/async/EventBaseBackendBase.h>
+#include <folly/io/async/ScopedEventBaseThread.h>
 #include <folly/portability/GTest.h>
 #include <folly/synchronization/Baton.h>
 
@@ -160,6 +170,136 @@ TEST_P(SimpleAsyncIOTest, DestroyWithPendingIO) {
   ASSERT_EQ(completed, numWrites);
 }
 
+TEST_P(SimpleAsyncIOTest, FreshInstancesReapTheirFirstCompletion) {
+  // Each instance registers its completion fd on, and later unregisters it
+  // from, a freshly started event loop thread. Racing the loop from the
+  // calling thread used to leave the fd unarmed (the write's completion was
+  // never delivered) or corrupt libevent so the loop thread hung on exit.
+  auto tmpfile = File::temporary();
+  const int fd = tmpfile.fd();
+  constexpr int kThreads = 8;
+  constexpr int kInstancesPerThread = 250;
+  auto config = config_;
+  config.setMaxRequests(1);
+
+  std::atomic<int> lost = 0;
+  std::atomic<int> setupFailures = 0;
+  std::vector<std::thread> threads;
+  for (int t = 0; t < kThreads; ++t) {
+    threads.emplace_back([&] {
+      for (int i = 0; i < kInstancesPerThread; ++i) {
+        // An exception escaping this thread would abort the whole binary, so
+        // count setup failures and fail the test cleanly instead.
+        std::unique_ptr<SimpleAsyncIO> aio;
+        try {
+          aio = std::make_unique<SimpleAsyncIO>(config);
+        } catch (const std::exception& ex) {
+          LOG(ERROR) << "SimpleAsyncIO setup failed: " << ex.what();
+          ++setupFailures;
+          continue;
+        }
+        auto buffer = std::make_unique<std::array<uint8_t, 512>>();
+        auto done = std::make_unique<Baton<>>();
+        aio->pwrite(
+            fd, buffer->data(), buffer->size(), 0, [done = done.get()](int) {
+              done->post();
+            });
+        if (!done->try_wait_for(std::chrono::seconds(10))) {
+          // The kernel may still own the write: leak rather than free.
+          ++lost;
+          (void)aio.release();
+          (void)buffer.release();
+          (void)done.release();
+        }
+      }
+    });
+  }
+  for (auto& thread : threads) {
+    thread.join();
+  }
+  EXPECT_EQ(setupFailures, 0);
+  EXPECT_EQ(lost, 0);
+}
+
+namespace {
+// Delegates to the default backend, but once armed fails event_add for any
+// fd it has not registered before, so only a newly registered handler fails.
+class FailNewRegistrationsBackend : public EventBaseBackendBase {
+ public:
+  explicit FailNewRegistrationsBackend(const std::atomic<bool>& armed)
+      : inner_(EventBase::getDefaultBackend()), armed_(armed) {}
+
+  event_base* getEventBase() override { return inner_->getEventBase(); }
+  int eb_event_base_loop(int flags) override {
+    return inner_->eb_event_base_loop(flags);
+  }
+  int eb_event_base_loopbreak() override {
+    return inner_->eb_event_base_loopbreak();
+  }
+  int eb_event_add(Event& event, const struct timeval* timeout) override {
+    const auto fd = event.eb_ev_fd();
+    if (armed_.load() && !knownFds_.contains(fd)) {
+      errno = EINVAL;
+      return -1;
+    }
+    knownFds_.insert(fd);
+    return inner_->eb_event_add(event, timeout);
+  }
+  int eb_event_del(Event& event) override {
+    return inner_->eb_event_del(event);
+  }
+  bool eb_event_active(Event& event, int res) override {
+    return inner_->eb_event_active(event, res);
+  }
+
+ private:
+  std::unique_ptr<EventBaseBackendBase> inner_;
+  const std::atomic<bool>& armed_;
+  // Only touched on the loop thread.
+  std::set<libevent_fd_t> knownFds_;
+};
+} // namespace
+
+TEST_P(SimpleAsyncIOTest, ThrowsWhenTheHandlerCannotBeRegistered) {
+  std::atomic<bool> armed = false;
+  ScopedEventBaseThread evbThread(
+      EventBase::Options().setBackendFactory([&armed] {
+        return std::make_unique<FailNewRegistrationsBackend>(armed);
+      }),
+      nullptr,
+      "FailingBackend");
+  auto config = config_;
+  config.setEventBase(evbThread.getEventBase());
+
+  armed = true;
+  EXPECT_THROW(SimpleAsyncIO{config}, std::runtime_error);
+  armed = false;
+
+  SimpleAsyncIO aio(config);
+  EXPECT_TRUE(aio.isHandlerRegistered());
+}
+
+TEST_P(SimpleAsyncIOTest, OutlivesProvidedEventBase) {
+  // The header asks callers to keep a provided EventBase alive, but existing
+  // users (e.g. a thread-local instance bound to an IO executor's EventBase)
+  // destroy the EventBase first. Destruction must not touch it then.
+  auto tmpfile = File::temporary();
+  auto evbThread = std::make_unique<ScopedEventBaseThread>();
+  auto config = config_;
+  config.setEventBase(evbThread
```

---

### Incident Patch 3: `17e1261d` (2026-10-07)
**Commit Message**: Add swig3 getdeps manifest for vendor SDK builds

Summary:
Some vendor SAI SDKs generate Python wrappers as part of their build and require SWIG 3, while distributions only package SWIG 4. This pins upstream SWIG 3.0.12 and backports the Python 3 fixes upstream only shipped in SWIG 4, so an SDK build can take it from getdeps rather than a hand-built copy.

Nothing depends on it; FBOSS itself does not need SWIG.

Reviewed By: srikrishnagopu

Differential Revision: D123481792

fbshipit-source-id: c72667ef03c8c1918e65810e7aaea3d6f8b394da

**File**: `build/fbcode_builder/manifests/swig3` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+[manifest]
+name = swig3
+
+# Some vendor SAI SDKs generate Python wrappers that require SWIG 3; distro
+# packages are SWIG 4. No [rpms]/[debs] so this is always built from source.
+# The patch backports the Python 3 fixes upstream only shipped in SWIG 4.
+
+[download]
+url = https://downloads.sourceforge.net/project/swig/swig/swig-3.0.12/swig-3.0.12.tar.gz
+sha256 = 7cf9f447ae7ed1c51722efc45e7f14418d15d7a1e143ac9f09a668999f4fc94d
+
+[build]
+builder = autoconf
+subdir = swig-3.0.12
+patchfile = swig_3_0_12_python3.patch
+
+# PCRE only backs SWIG's regex renames; the language flags only affect which
+# languages SWIG's own test suite runs, not which wrappers it can generate.
+[autoconf.args]
+--without-pcre
+--without-alllang
```

**File**: `build/fbcode_builder/patches/swig_3_0_12_python3.patch` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+--- a/Lib/python/builtin.swg
++++ b/Lib/python/builtin.swg
+@@ -120,7 +120,7 @@
+ 
+ SWIGINTERN void
+ SwigPyStaticVar_dealloc(PyDescrObject *descr) {
+-  _PyObject_GC_UNTRACK(descr);
++  PyObject_GC_UnTrack(descr);
+   Py_XDECREF(PyDescr_TYPE(descr));
+   Py_XDECREF(PyDescr_NAME(descr));
+   PyObject_GC_Del(descr);
+--- a/Lib/python/pyinit.swg
++++ b/Lib/python/pyinit.swg
+@@ -155,7 +155,11 @@
+       sizeof(swig_varlinkobject),         /* tp_basicsize */
+       0,                                  /* tp_itemsize */
+       (destructor) swig_varlink_dealloc,  /* tp_dealloc */
++#if PY_VERSION_HEX >= 0x03000000
++      0,                                  /* tp_print */
++#else
+       (printfunc) swig_varlink_print,     /* tp_print */
++#endif
+       (getattrfunc) swig_varlink_getattr, /* tp_getattr */
+       (setattrfunc) swig_varlink_setattr, /* tp_setattr */
+       0,                                  /* tp_compare */
+--- a/Lib/python/pyrun.swg
++++ b/Lib/python/pyrun.swg
+@@ -959,7 +959,11 @@
+       sizeof(SwigPyPacked),                 /* tp_basicsize */
+       0,                                    /* tp_itemsize */
+       (destructor)SwigPyPacked_dealloc,     /* tp_dealloc */
++#if PY_VERSION_HEX>=0x03000000
++      0,                                    /* tp_print */
++#else
+       (printfunc)SwigPyPacked_print,        /* tp_print */
++#endif
+       (getattrfunc)0,                       /* tp_getattr */
+       (setattrfunc)0,                       /* tp_setattr */
+ #if PY_VERSION_HEX>=0x03000000
```

---

### Incident Patch 4: `d7850d06` (2026-10-06)
**Commit Message**: Opt-in io_uring batching timeout after the first completion

Summary:
Add `IoUringOptions::batchTimeoutAfterFirstCompletion`, off by default. When set together with request batching (`batchSize` and `timeout`), the backend waits without a deadline for the first CQE and only then waits up to `timeout` for the rest of the batch. Idle event loops then block instead of re-entering the kernel on an empty timeout every `timeout`.

This changes the latency/CPU trade-off of an existing option: a lone completion now waits the full `timeout` instead of whatever remained of the current wait. Maple, BigCache, ucache, graphstore, and Halcyon's busy-poll mode already tune `timeout` and `batchSize` against the current meaning, so the default keeps the existing wait code unchanged and only RevProxy request workers opt in.

In the opt-in mode:
- Only sends submitted since the last CQ reap are excluded from the batch target, not every in-flight send. Sends blocked on socket writability would otherwise inflate the target past the configured batch size and turn every wait into a full timeout.
- The timeout is normalized into seconds and nanoseconds, and an already-available CQE is processed if the bat

**File**: `folly/io/async/IoUringBackend.cpp` (modified, +58/-1)
```diff
@@ -1396,6 +1396,7 @@ void IoUringBackend::internalSubmit(IoSqeBase& ioSqe) noexcept {
   ioSqe.internalSubmit(sqe);
   if (ioSqe.type() == IoSqeBase::Type::Write) {
     numSendEvents_++;
+    numSendEventsSinceReap_++;
   }
   doneSubmitting();
 }
@@ -1439,7 +1440,41 @@ int IoUringBackend::cancelOne(IoSqe* ioSqe) {
   return ret;
 }
 
+int IoUringBackend::waitForRequestBatch(uint32_t numSendEvents) noexcept {
+  const auto timeoutSeconds =
+      std::chrono::duration_cast<std::chrono::seconds>(options_.timeout);
+  struct __kernel_timespec timeout{};
+  timeout.tv_sec = timeoutSeconds.count();
+  timeout.tv_nsec =
+      std::chrono::duration_cast<std::chrono::nanoseconds>(
+          options_.timeout - timeoutSeconds)
+          .count();
+
+  io_uring_cqe* batchCqe = nullptr;
+  const int res = ::io_uring_wait_cqes(
+      &ioRing_,
+      &batchCqe,
+      static_cast<uint32_t>(options_.batchSize) + numSendEvents,
+      &timeout,
+      nullptr);
+  FOLLY_SDT(
+      folly,
+      folly_io_uring_backend_pre_submit_and_wait_timeout,
+      options_.timeout,
+      options_.batchSize,
+      numSendEvents,
+      res);
+
+  // The first CQE is still available, so an interrupted batching wait should
+  // process it instead of restarting the timeout.
+  return res == -EINTR ? 0 : res;
+}
+
 int IoUringBackend::doInnerWait(io_uring_cqe*& cqe) noexcept {
+  if (options_.batchTimeoutAfterFirstCompletion) {
+    return waitForFirstCompletionThenBatch(cqe);
+  }
+
   if (waitingToSubmit_) {
     submitBusyCheck(waitingToSubmit_, WaitForEventsMode::WAIT);
     return ::io_uring_peek_cqe(&ioRing_, &cqe);
@@ -1454,6 +1489,27 @@ int IoUringBackend::doInnerWait(io_uring_cqe*& cqe) noexcept {
   }
 }
 
+int IoUringBackend::waitForFirstCompletionThenBatch(
+    io_uring_cqe*& cqe) noexcept {
+  const uint32_t numSendEvents = numSendEventsSinceReap_;
+  int ret;
+  if (waitingToSubmit_) {
+    ret = submitBusyCheck(waitingToSubmit_, WaitForEventsMode::WAIT);
+    if (ret < 0) {
+      return ret;
+    }
+    ret = ::io_uring_peek_cqe(&ioRing_, &cqe);
+  } else {
+    ret = ::io_uring_wait_cqe(&ioRing_, &cqe);
+  }
+
+  if (ret != 0 || !useReqBatching()) {
+    return ret;
+  }
+
+  return waitForRequestBatch(numSendEvents);
+}
+
 int IoUringBackend::doWait(io_uring_cqe*& cqe) {
   if (kIsDebug && VLOG_IS_ON(1)) {
     auto start = std::chrono::steady_clock::now();
@@ -1550,6 +1606,7 @@ unsigned int IoUringBackend::internalProcessCqe(
   unsigned int count = 0;
   unsigned int count_send = 0;
 
+  numSendEventsSinceReap_ = 0;
   checkLogOverflow(&ioRing_);
   do {
     unsigned int head;
@@ -1639,7 +1696,7 @@ int IoUringBackend::submitBusyCheck(
       if (options_.flags & Options::Flags::POLL_CQ) {
         res = ::io_uring_submit(&ioRing_);
       } else {
-        if (useReqBatching()) {
+        if (useReqBatching() && !options_.batchTimeoutAfterFirstCompletion) {
           io_uring_cqe* cqe;
           struct __kernel_timespec timeout{};
           timeout.tv_sec = 0;
```

**File**: `folly/io/async/IoUringBackend.h` (modified, +5/-0)
```diff
@@ -842,6 +842,8 @@ class IoUringBackend : public EventBaseBackendBase {
   io_uring_sqe* getSqe();
 
   // Wait helpers
+  int waitForRequestBatch(uint32_t numSendEvents) noexcept;
+  int waitForFirstCompletionThenBatch(io_uring_cqe*& cqe) noexcept;
   int doInnerWait(io_uring_cqe*& cqe) noexcept;
   int doWait(io_uring_cqe*& cqe);
   int doPeek(io_uring_cqe*& cqe) noexcept;
@@ -889,6 +891,9 @@ class IoUringBackend : public EventBaseBackendBase {
   uint32_t numInsertedEvents_{0};
   uint32_t numInternalEvents_{0};
   uint32_t numSendEvents_{0};
+  // Sends submitted since the last CQ reap. Older sends that are blocked on
+  // socket writability must not inflate the request batch target.
+  uint32_t numSendEventsSinceReap_{0};
 
   // io_uring related
   io_uring_params params_{};
```

**File**: `folly/io/async/IoUringOptions.h` (modified, +12/-0)
```diff
@@ -206,6 +206,12 @@ struct IoUringOptions {
     return *this;
   }
 
+  IoUringOptions& setBatchTimeoutAfterFirstCompletion(bool v) {
+    batchTimeoutAfterFirstCompletion = v;
+
+    return *this;
+  }
+
   IoUringOptions& setZeroCopyRx(bool v) {
     zeroCopyRx = v;
 
@@ -324,6 +330,12 @@ struct IoUringOptions {
   // Both timeout _and_ batchSize must be set for io_uring_enter wait_nr to be
   // set!
   std::chrono::microseconds timeout{0};
+
+  // Request batching only: wait without a deadline for the first completion,
+  // then up to `timeout` for the rest of the batch. Idle loops then sleep
+  // instead of waking every `timeout`, but a lone completion waits the full
+  // `timeout`. When false, `timeout` bounds each whole wait.
+  bool batchTimeoutAfterFirstCompletion{false};
   std::chrono::milliseconds sqIdle{0};
   std::chrono::milliseconds cqIdle{0};
 
```

**File**: `folly/io/async/test/IoUringBackendTest.cpp` (modified, +158/-0)
```diff
@@ -15,6 +15,7 @@
  */
 
 #include <sys/eventfd.h>
+#include <sys/timerfd.h>
 #include <numeric>
 
 #include <folly/FileUtil.h>
@@ -168,6 +169,82 @@ class EventFD : public folly::EventHandler {
   bool persist_;
 };
 
+class TimerFD : public folly::EventHandler {
+ public:
+  explicit TimerFD(folly::EventBase* eventBase)
+      : TimerFD(eventBase, createFd()) {}
+
+  ~TimerFD() override {
+    unregisterHandler();
+    folly::fileops::close(fd_);
+  }
+
+  void arm(std::chrono::microseconds delay) {
+    const auto seconds =
+        std::chrono::duration_cast<std::chrono::seconds>(delay);
+    itimerspec timer{};
+    timer.it_value.tv_sec = seconds.count();
+    timer.it_value.tv_nsec =
+        std::chrono::duration_cast<std::chrono::nanoseconds>(delay - seconds)
+            .count();
+    CHECK_EQ(::timerfd_settime(fd_, 0, &timer, nullptr), 0);
+  }
+
+  uint64_t getNum() const { return num_; }
+
+  void handlerReady(uint16_t /*events*/) noexcept override {
+    uint64_t expirations = 0;
+    CHECK_EQ(
+        folly::readNoInt(fd_, &expirations, sizeof(expirations)),
+        sizeof(expirations));
+    ++num_;
+  }
+
+ private:
+  static int createFd() {
+    const int fd = ::timerfd_create(CLOCK_MONOTONIC, TFD_CLOEXEC);
+    CHECK_GE(fd, 0);
+    return fd;
+  }
+
+  TimerFD(folly::EventBase* eventBase, int fd)
+      : EventHandler(eventBase, folly::NetworkSocket::fromFd(fd)), fd_(fd) {
+    registerHandler(folly::EventHandler::READ);
+  }
+
+  uint64_t num_{0};
+  int fd_;
+};
+
+struct PollLoopStats {
+  int preHookCalls{0};
+  int postHookCalls{0};
+  int lastEventCount{-1};
+  int emptyPollCount{0};
+  folly::Function<void()> firstPreLoop;
+};
+
+folly::EventBaseBackendBase::PollLoopHook makePollLoopHook(
+    PollLoopStats& stats) {
+  folly::EventBaseBackendBase::PollLoopHook hook;
+  hook.preLoopHook = [](void* ctx) {
+    auto& hookStats = *static_cast<PollLoopStats*>(ctx);
+    if (hookStats.preHookCalls++ == 0) {
+      hookStats.firstPreLoop();
+    }
+  };
+  hook.postLoopHook = [](void* ctx, int numEvents) {
+    auto& hookStats = *static_cast<PollLoopStats*>(ctx);
+    ++hookStats.postHookCalls;
+    hookStats.lastEventCount = numEvents;
+    if (numEvents == 0) {
+      ++hookStats.emptyPollCount;
+    }
+  };
+  hook.hookCtx = &stats;
+  return hook;
+}
+
 std::unique_ptr<folly::EventBase> getEventBase(folly::IoUringOptions opts) {
   try {
     auto optsPtr = std::make_shared<folly::IoUringOptions>(std::move(opts));
@@ -324,6 +401,87 @@ TEST(IoUringBackend, FailCreateOutOfMemory) {
   GTEST_SKIP() << "io_uring memory is not charged against RLIMIT_MEMLOCK";
 }
 
+TEST(IoUringBackend, RequestBatchTimeoutStartsAfterFirstCompletion) {
+  PollLoopStats stats;
+  folly::IoUringOptions options;
+  options.setBatchSize(4)
+      .setTimeout(std::chrono::milliseconds(5))
+      .setBatchTimeoutAfterFirstCompletion(true)
+      .setUseRegisteredFds(0);
+  auto evbPtr = getEventBase(std::move(options));
+  SKIP_IF(!evbPtr) << "Backend not available";
+
+  evbPtr->loopOnce(EVLOOP_NONBLOCK);
+  TimerFD timer(evbPtr.get());
+  evbPtr->loopOnce(EVLOOP_NONBLOCK);
+
+  stats.firstPreLoop = [&] { timer.arm(std::chrono::milliseconds(30)); };
+  evbPtr->getBackend()->setPollLoopHook(makePollLoopHook(stats));
+  evbPtr->loopOnce();
+
+  EXPECT_EQ(timer.getNum(), 1);
+  EXPECT_EQ(stats.preHookCalls, 1);
+  EXPECT_EQ(stats.postHookCalls, 1);
+  EXPECT_GE(stats.lastEventCount, 1);
+}
+
+TEST(IoUringBackend, RequestBatchTimeoutBoundsWholeWaitByDefault) {
+  PollLoopStats stats;
+  folly::IoUringOptions options;
+  options.setBatchSize(4)
+      .setTimeout(std::chrono::milliseconds(5))
+      .setUseRegisteredFds(0);
+  auto evbPtr = getEventBase(std::move(options));
+  SKIP_IF(!evbPtr) << "Backend not available";
+
+  evbPtr->loopOnce(EVLOOP_NONBLOCK);
+  TimerFD timer(evbPtr.get());
+  evbPtr->loopOnce(EVLOOP_NONBLOCK);
+
+  // Without the opt-in, each wait gives up after the timeout even when idle,
+  // so the loop polls empty several times before the 30ms timer fires.
+  stats.firstPreLoop = [&] { timer.arm(std::chrono::milliseconds(30)); };
+  evbPtr->getBackend()->setPollLoopHook(makePollLoopHook(stats));
+  evbPtr->loopOnce();
+
+  EXPECT_EQ(timer.getNum(), 1);
+  EXPECT_GE(stats.emptyPollCount, 2);
+}
+
+TEST(IoUringBackend, RequestBatchCompletesAtBatchSize) {
+  PollLoopStats stats;
+  folly::IoUringOptions options;
+  options.setBatchSize(4)
+      .setTimeout(std::chrono::milliseconds(100))
+      .setBatchTimeoutAfterFirstCompletion(true)
+      .setUseRegisteredFds(0);
+  auto evbPtr = getEventBase(std::move(options));
+  SKIP_IF(!evbPtr) << "Backend not available";
+
+  std::vector<std::unique_ptr<TimerFD>> timers;
+  timers.reserve(4);
+  for (size_t i = 0; i < 4; ++i) {
+    timers.push_back(std::make_unique<TimerFD>(evbPtr.get()));
+  }
+  evbPtr->loopOnce(EVLOOP_NONBLOCK);
+
+  stats.firstPreLoop = [&] {
+    timers.front()->arm(std::chrono::milliseconds(10));
+    for (size_t i = 1; i <
```

---

### Incident Patch 5: `7605e96f` (2026-10-06)
**Commit Message**: Add a fixed-region allocator

Summary: Add a reusable allocator over caller-owned memory.

Differential Revision: D122829641

fbshipit-source-id: d0fc58834ce2ae01c7cb8b449efd1f5bd4c47b71

**File**: `folly/memory/BUCK` (modified, +12/-0)
```diff
@@ -37,6 +37,18 @@ fb_dirsync_cpp_library(
     ],
 )
 
+fb_dirsync_cpp_library(
+    name = "fixed_region_allocator",
+    srcs = ["FixedRegionAllocator.cpp"],
+    headers = ["FixedRegionAllocator.h"],
+    use_raw_headers = True,
+    deps = [
+        ":sanitize_address",
+        "//folly:synchronized",
+        "//folly/lang:align",
+    ],
+)
+
 fb_dirsync_cpp_library(
     name = "not_null",
     srcs = [],
```

**File**: `folly/memory/CMakeLists.txt` (modified, +10/-0)
```diff
@@ -44,6 +44,16 @@ folly_add_library(
     folly_memory_malloc
 )
 
+folly_add_library(
+  NAME fixed_region_allocator
+  SRCS FixedRegionAllocator.cpp
+  HEADERS FixedRegionAllocator.h
+  DEPS
+    folly_lang_align
+    folly_memory_sanitize_address
+    folly_synchronized
+)
+
 folly_add_library(
   NAME io_uring_arena
   SRCS IoUringArena.cpp
```

**File**: `folly/memory/FixedRegionAllocator.cpp` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+#include <folly/memory/FixedRegionAllocator.h>
+
+#include <algorithm>
+#include <bit>
+#include <cstdint>
+#include <cstring>
+#include <map>
+#include <stdexcept>
+
+#include <folly/Synchronized.h>
+#include <folly/lang/Align.h>
+#include <folly/memory/SanitizeAddress.h>
+
+namespace folly {
+
+class FixedRegionAllocator::Impl {
+ public:
+  struct State {
+    std::map<std::byte*, size_t, std::less<>> freeRanges;
+    std::map<const std::byte*, size_t, std::less<>> allocations;
+    size_t freeSpace{0};
+  };
+
+  Impl(void* data, size_t size) {
+    auto state = state_.wlock();
+    state->freeRanges.emplace(static_cast<std::byte*>(data), size);
+    state->freeSpace = size;
+  }
+
+  void* allocate(State& state, size_t size, size_t alignment) {
+    for (auto range = state.freeRanges.begin(); range != state.freeRanges.end();
+         ++range) {
+      auto* const begin = range->first;
+      const auto rangeSize = range->second;
+      auto* const address = folly::align_ceil(begin, alignment);
+      const auto padding = static_cast<size_t>(address - begin);
+      if (padding > rangeSize || size > rangeSize - padding) {
+        continue;
+      }
+
+      const auto suffixSize = rangeSize - padding - size;
+      state.allocations.emplace(address, size);
+      if (padding == 0) {
+        auto node = state.freeRanges.extract(range);
+        if (suffixSize != 0) {
+          node.key() = address + size;
+          node.mapped() = suffixSize;
+          state.freeRanges.insert(std::move(node));
+        }
+      } else {
+        range->second = padding;
+        if (suffixSize != 0) {
+          state.freeRanges.emplace(address + size, suffixSize);
+        }
+      }
+      state.freeSpace -= size;
+      folly::asan_unpoison_memory_region(address, size);
+      return address;
+    }
+    return nullptr;
+  }
+
+  void releaseRange(State& state, std::byte* address, size_t size) {
+    auto next = state.freeRanges.lower_bound(address);
+    const auto hasPrevious = next != state.freeRanges.begin() &&
+        std::prev(next)->first + std::prev(next)->second == address;
+    const auto hasNext =
+        next != state.freeRanges.end() && address + size == next->first;
+
+    if (hasPrevious) {
+      auto previous = std::prev(next);
+      previous->second += size;
+      if (hasNext) {
+        previous->second += next->second;
+        state.freeRanges.erase(next);
+      }
+    } else if (hasNext) {
+      auto node = state.freeRanges.extract(next);
+      node.key() = address;
+      node.mapped() += size;
+      state.freeRanges.insert(std::move(node));
+    } else {
+      state.freeRanges.emplace(address, size);
+    }
+    state.freeSpace += size;
+    folly::asan_poison_memory_region(address, size);
+  }
+
+  void deallocate(State& state, std::byte* address) {
+    const auto allocation = state.allocations.find(address);
+    if (allocation == state.allocations.end()) {
+      throw std::invalid_argument(
+          "address was not allocated by this allocator");
+    }
+    releaseRange(state, address, allocation->second);
+    state.allocations.erase(allocation);
+  }
+
+  folly::Synchronized<State> state_;
+};
+
+size_t FixedRegionAllocator::minimumSize() noexcept {
+  return 1;
+}
+
+FixedRegionAllocator::FixedRegionAllocator(void* data, size_t size)
+    : data_(data), size_(size) {
+  if (data == nullptr || size < minimumSize() ||
+      reinterpret_cast<uintptr_t>(data) % alignof(std::max_align_t) != 0) {
+    throw std::invalid_argument("invalid fixed allocator region");
+  }
+  impl_ = std::make_unique<Impl>(data, size);
+  folly::asan_poison_memory_region(data_, size_);
+}
+
+FixedRegionAllocator::~FixedRegionAllocator() {
+  folly::asan_unpoison_memory_region(data_, size_);
+}
+
+void* FixedRegionAllocator::allocate(size_t size, size_t alignment) {
+  if (!std::has_single_bit(alignment)) {
+    throw std::invalid_argument("allocation alignment is not a power of two");
+  }
+  size = std::max(size, size_t{1});
+  alignment = std::max(alignment, alignof(std::max_align_t));
+  auto state = impl_->state_.wlock();
+  return impl_->allocate(*state, size, alignment);
+}
+
+void FixedRegionAllocator::deallocate(void* ptr) {
+  if (ptr == nullptr) {
+    return;
+  }
+  auto state = impl_->state_.wlock();
+  impl_->deallocate(*state, static_cast
```

**File**: `folly/memory/FixedRegionAllocator.h` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+#pragma once
+
+#include <cstddef>
+#include <memory>
+
+namespace folly {
+
+/**
+ * A thread-safe allocator over a fixed caller-owned memory region.
+ *
+ * The memory region must remain valid and must not be modified directly for
+ * the lifetime of the allocator. Bookkeeping is stored separately, so all of
+ * the supplied capacity is available for allocations, subject to alignment.
+ */
+class FixedRegionAllocator {
+ public:
+  static size_t minimumSize() noexcept;
+
+  FixedRegionAllocator(void* data, size_t size);
+  ~FixedRegionAllocator();
+
+  FixedRegionAllocator(const FixedRegionAllocator&) = delete;
+  FixedRegionAllocator& operator=(const FixedRegionAllocator&) = delete;
+  FixedRegionAllocator(FixedRegionAllocator&&) = delete;
+  FixedRegionAllocator& operator=(FixedRegionAllocator&&) = delete;
+
+  void* allocate(size_t size, size_t alignment = alignof(std::max_align_t));
+  void deallocate(void* ptr);
+
+  /**
+   * Resize an allocation while preserving its contents.
+   *
+   * On failure, returns nullptr and leaves the original allocation intact.
+   */
+  void* reallocate(
+      void* ptr, size_t size, size_t alignment = alignof(std::max_align_t));
+
+  size_t allocationSize(const void* ptr) const;
+  size_t freeSpace() const;
+  bool allMemoryDeallocated() const;
+
+  bool contains(const void* ptr) const noexcept;
+  void* data() const noexcept;
+  size_t size() const noexcept;
+
+ private:
+  class Impl;
+
+  void* const data_;
+  const size_t size_;
+  std::unique_ptr<Impl> impl_;
+};
+
+} // namespace folly
```

**File**: `folly/memory/test/BUCK` (modified, +10/-0)
```diff
@@ -19,6 +19,16 @@ fb_dirsync_cpp_unittest(
     ],
 )
 
+fb_dirsync_cpp_unittest(
+    name = "fixed_region_allocator_test",
+    srcs = ["FixedRegionAllocatorTest.cpp"],
+    deps = [
+        "//folly/memory:fixed_region_allocator",
+        "//folly/memory:sanitize_address",
+        "//folly/portability:gtest",
+    ],
+)
+
 fb_dirsync_cpp_unittest(
     name = "mallctl_helper_test",
     srcs = ["MallctlHelperTest.cpp"],
```

**File**: `folly/memory/test/FixedRegionAllocatorTest.cpp` (added, +417/-0)
```diff
@@ -0,0 +1,417 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+#include <folly/memory/FixedRegionAllocator.h>
+
+#include <algorithm>
+#include <array>
+#include <atomic>
+#include <cstddef>
+#include <cstdint>
+#include <cstring>
+#include <random>
+#include <stdexcept>
+#include <thread>
+#include <vector>
+
+#include <folly/memory/SanitizeAddress.h>
+#include <folly/portability/GTest.h>
+
+namespace {
+
+struct TrackedAllocation {
+  std::byte* ptr;
+  size_t size;
+  std::byte fill;
+};
+
+bool contentsMatch(const TrackedAllocation& allocation) {
+  return std::all_of(
+      allocation.ptr, allocation.ptr + allocation.size, [&](std::byte value) {
+        return value == allocation.fill;
+      });
+}
+
+void fill(TrackedAllocation& allocation, std::byte value) {
+  allocation.fill = value;
+  std::fill_n(allocation.ptr, allocation.size, value);
+}
+
+bool isAddressPoisoned(const void* address) {
+  return folly::asan_address_is_poisoned(address) != 0;
+}
+
+class FixedRegionAllocatorTest : public testing::Test {
+ protected:
+  static constexpr size_t kRegionSize = 1024 * 1024;
+  alignas(std::max_align_t) std::array<std::byte, kRegionSize> region_{};
+  folly::FixedRegionAllocator allocator_{region_.data(), region_.size()};
+};
+
+TEST_F(FixedRegionAllocatorTest, AllocateAndDeallocate) {
+  const auto initialFreeSpace = allocator_.freeSpace();
+  void* ptr = allocator_.allocate(1024);
+
+  ASSERT_NE(ptr, nullptr);
+  EXPECT_TRUE(allocator_.contains(ptr));
+  EXPECT_GE(allocator_.allocationSize(ptr), 1024);
+  EXPECT_LT(allocator_.freeSpace(), initialFreeSpace);
+  EXPECT_FALSE(allocator_.allMemoryDeallocated());
+
+  allocator_.deallocate(ptr);
+  EXPECT_EQ(allocator_.freeSpace(), initialFreeSpace);
+  EXPECT_TRUE(allocator_.allMemoryDeallocated());
+}
+
+TEST_F(FixedRegionAllocatorTest, HonorsAlignment) {
+  void* ptr = allocator_.allocate(1024, 256);
+
+  ASSERT_NE(ptr, nullptr);
+  EXPECT_EQ(reinterpret_cast<uintptr_t>(ptr) % 256, 0);
+  allocator_.deallocate(ptr);
+}
+
+TEST_F(FixedRegionAllocatorTest, ReturnsNullWhenExhausted) {
+  void* wholeRegion = allocator_.allocate(region_.size());
+  ASSERT_NE(wholeRegion, nullptr);
+  EXPECT_EQ(allocator_.allocate(1), nullptr);
+  allocator_.deallocate(wholeRegion);
+}
+
+TEST_F(FixedRegionAllocatorTest, CoalescesFreedRanges) {
+  void* first = allocator_.allocate(1024);
+  void* second = allocator_.allocate(1024);
+  void* third = allocator_.allocate(1024);
+  ASSERT_NE(first, nullptr);
+  ASSERT_NE(second, nullptr);
+  ASSERT_NE(third, nullptr);
+
+  allocator_.deallocate(second);
+  allocator_.deallocate(first);
+  allocator_.deallocate(third);
+
+  EXPECT_EQ(allocator_.freeSpace(), region_.size());
+  void* wholeRegion = allocator_.allocate(region_.size());
+  EXPECT_EQ(wholeRegion, region_.data());
+  allocator_.deallocate(wholeRegion);
+}
+
+TEST_F(FixedRegionAllocatorTest, ReallocatePreservesContents) {
+  auto* ptr = static_cast<std::byte*>(allocator_.allocate(128));
+  ASSERT_NE(ptr, nullptr);
+  std::memset(ptr, 0x5a, 128);
+
+  auto* grown = static_cast<std::byte*>(allocator_.reallocate(ptr, 4096));
+
+  ASSERT_NE(grown, nullptr);
+  EXPECT_EQ(grown, ptr);
+  for (size_t i = 0; i < 128; ++i) {
+    EXPECT_EQ(grown[i], std::byte{0x5a});
+  }
+  allocator_.deallocate(grown);
+}
+
+TEST_F(FixedRegionAllocatorTest, ShrinkingReallocateReleasesTail) {
+  constexpr size_t kOriginalSize = 1024;
+  constexpr size_t kShrunkSize = 128;
+  auto* ptr = static_cast<std::byte*>(allocator_.allocate(kOriginalSize));
+  ASSERT_NE(ptr, nullptr);
+
+  void* shrunk = allocator_.reallocate(ptr, kShrunkSize);
+
+  EXPECT_EQ(shrunk, ptr);
+  EXPECT_EQ(allocator_.allocationSize(ptr), kShrunkSize);
+  EXPECT_EQ(allocator_.freeSpace(), region_.size() - kShrunkSize);
+  void* tail = allocator_.allocate(kOriginalSize - kShrunkSize);
+  EXPECT_EQ(tail, ptr + kShrunkSize);
+
+  allocator_.deallocate(tail);
+  allocator_.deallocate(ptr);
+  EXPECT_TRUE(allocator_.allMemoryDeallocated());
+}
+
+TEST_F(FixedRegionAllocatorTest, FailedReallocatePreservesAllocation) {
+  auto* ptr = static_cast<std::byte*>(allocator_.allocate(128));
+  ASSERT_NE(ptr, nullptr);
+  std::memset(ptr, 0x5a, 128);
+
+  EXPECT_EQ(allocator_.reallocate(ptr, region_.size() + 1), nullptr);
+  EXPECT_EQ(allocator_.allocationSize(ptr), 128);
+  for (size_t i = 0; i < 128; ++i) {
+    EXPECT_EQ(ptr[i], std::byte{0x5a});
+  }
+ 
```

---

### Incident Patch 6: `e8059087` (2026-10-05)
**Commit Message**: Cap Windows CI build parallelism at 4 jobs

Summary:
The Windows workflow builds with `cmake --build _build -j`. With no number, CMake leaves the job count to Ninja, whose default is cores + 2. On the 4-vCPU, 16 GB `windows-2022` hosted runner, that means 6 concurrent MSVC processes. Some of folly's template-heavy translation units take 1–2 GB each, so a build with a cold sccache can approach the runner's memory limit. The runner then dies mid-build with "The hosted runner lost communication with the server", as in run 37371762457 (Oct 5 2026), which failed in the Build step.

This passes `-j 4`, one job per vCPU, and adds a comment explaining the cap. Nothing else in the workflow changes: the generator, build type and sccache setup stay as they are, and linux.yml and macos.yml are untouched.

___

Differential Revision: D123508826

fbshipit-source-id: 1d2971cd6d197ed990bf0992e9b7446c5a09847b

**File**: `.github/workflows/windows.yml` (modified, +5/-1)
```diff
@@ -68,8 +68,12 @@ jobs:
         -DCMAKE_POLICY_DEFAULT_CMP0141=NEW
         -DCMAKE_MSVC_DEBUG_INFORMATION_FORMAT=Embedded
 
+    # A bare -j leaves it to Ninja, which runs cores + 2 jobs. On this 4-vCPU,
+    # 16 GB runner that is 6 MSVC processes, some taking 1-2 GB on folly's
+    # template-heavy files, and a cold cache can exhaust memory and lose the
+    # runner.
     - name: Build
-      run: cmake --build _build -j
+      run: cmake --build _build -j 4
 
     - name: Test
       run: ctest --test-dir _build --output-on-failure
```

---

### Incident Patch 7: `2cccf163` (2026-10-05)
**Commit Message**: Move the wait for ready evbs into MuxIOThreadPoolExecutor worker threads

Summary:
`MuxIOThreadPoolExecutor` gets ready EventBases from a process-wide `EventBasePoller` singleton: a dedicated thread waits on the fds of all executors and pushes ready handles into the executor's queue through a `ReadyCallback`. So every wakeup hops through that thread before reaching a worker.

The idea was that if the rate of events is high enough throughout the process, the wake-ups of the poller threads would batch, mitigating the cost. In some IO-heavy services experiments verified this, but the typical service does not exhibit this behavior and pays double the wake-up cost.

Invert it into a pull model: each executor owns a poller, and the workers take turns calling `wait()`. A sentinel token in the ready queue grants the right to poll, so at most one thread is in `wait()` at any time. The holder enqueues the ready handles followed by the sentinel, then runs one of the EventBases itself. If all workers are busy, nobody polls, but then there would be no thread to run the ready EventBases anyway.

This removes the dedicated thread, `FdGroup` and `ReadyCallback`. The poller is configured through `M

**File**: `folly/io/async/BUCK` (modified, +2/-8)
```diff
@@ -767,22 +767,16 @@ fb_dirsync_cpp_library(
     headers = ["EventBasePoller.h"],
     use_raw_headers = True,
     deps = [
-        "fbsource//third-party/boost:boost",  # @manual
-        "fbsource//third-party/fmt:fmt",
         "fbsource//third-party/glog:glog",
         "//folly:file_util",
         "//folly:string",
         "//folly/io/async:epoll",
         "//folly/io/async:liburing",
         "//folly/lang:align",
-        "//folly/portability:gflags",
         "//folly/synchronization:baton",
-        "//folly/system:thread_name",
     ],
     exported_deps = [
-        "//folly:function",
-        "//folly:range",
-        "//folly:synchronized",
+        "//folly:small_vector",
     ],
 )
 
@@ -793,9 +787,9 @@ fb_dirsync_cpp_library(
     use_raw_headers = True,
     deps = [
         "fbsource//third-party/fmt:fmt",
-        "//folly/container:enumerate",
         "//folly/io/async:epoll_backend",
         "//folly/lang:align",
+        "//folly/portability:gflags",
         "//folly/synchronization:latch",
     ],
     exported_deps = [
```

**File**: `folly/io/async/CMakeLists.txt` (modified, +2/-9)
```diff
@@ -423,20 +423,13 @@ folly_add_library(
   HEADERS EventBasePoller.h
   DEPS
     ${GLOG_LIBRARIES}
-    Boost::headers
-    fmt::fmt
     folly_file_util
     folly_io_async_epoll
     folly_io_async_liburing
     folly_lang_align
-    folly_portability_gflags
     folly_string
     folly_synchronization_baton
-    folly_system_thread_name
-  EXPORTED_DEPS
-    folly_function
-    folly_range
-    folly_synchronized
+  EXPORTED_DEPS folly_small_vector
 )
 
 folly_add_library(
@@ -665,9 +658,9 @@ folly_add_library(
   HEADERS MuxIOThreadPoolExecutor.h
   DEPS
     fmt::fmt
-    folly_container_enumerate
     folly_io_async_epoll_backend
     folly_lang_align
+    folly_portability_gflags
     folly_synchronization_latch
   EXPORTED_DEPS
     folly_concurrency_unbounded_queue
```

**File**: `folly/io/async/EventBasePoller.cpp` (modified, +115/-274)
```diff
@@ -17,19 +17,21 @@
 #include <folly/io/async/EventBasePoller.h>
 
 #include <atomic>
+#include <cerrno>
+#include <cstring>
+#include <limits>
 #include <stdexcept>
+#include <thread>
+#include <utility>
+#include <vector>
 
-#include <boost/polymorphic_cast.hpp>
-#include <fmt/format.h>
 #include <glog/logging.h>
 #include <folly/FileUtil.h>
 #include <folly/String.h>
 #include <folly/io/async/Epoll.h>
 #include <folly/io/async/Liburing.h>
 #include <folly/lang/Align.h>
-#include <folly/portability/GFlags.h>
 #include <folly/synchronization/Baton.h>
-#include <folly/system/ThreadName.h>
 
 #if FOLLY_HAS_EPOLL
 // @lint-ignore CLANGTIDY facebook-hte-PortabilityInclude-poll.h
@@ -42,38 +44,6 @@
 #include <liburing.h> // @manual
 #endif
 
-FOLLY_GFLAGS_DEFINE_string(
-    folly_event_base_poller_backend,
-    "epoll",
-    "Available EventBasePoller backends: \"epoll\", \"io_uring\"");
-FOLLY_GFLAGS_DEFINE_uint64(
-    folly_event_base_poller_spin_us,
-    10,
-    "Spin-wait for events up to this amount before blocking wait");
-FOLLY_GFLAGS_DEFINE_uint64(
-    folly_event_base_poller_sleep_us,
-    0,
-    "Sleep for this amount before doing a blocking wait for events");
-
-// Epoll backend.
-FOLLY_GFLAGS_DEFINE_uint64(
-    folly_event_base_poller_epoll_max_events,
-    64,
-    "Maximum number of events to process in one iteration when "
-    "using the epoll EventBasePoller backend");
-FOLLY_GFLAGS_DEFINE_bool(
-    folly_event_base_poller_epoll_rearm_inline,
-    true,
-    "When using epoll backend, re-arm events inline in handoff() instead of "
-    "returning them to the poller thread");
-
-// io_uring backend.
-FOLLY_GFLAGS_DEFINE_uint64(
-    folly_event_base_poller_io_uring_sq_entries,
-    128,
-    "Minimum number of entries to allocate for the submission queue when "
-    "using the io_uring EventBasePoller backend");
-
 namespace folly::detail {
 
 namespace {
@@ -123,57 +93,59 @@ class Queue {
 #if FOLLY_HAS_EPOLL
 
 class EventBasePollerImpl : public EventBasePoller {
-  class FdGroupImpl;
-
  public:
-  explicit EventBasePollerImpl(bool rearmInline)
-      : rearmInline_(rearmInline),
+  EventBasePollerImpl(Options options, bool rearmInline)
+      : options_(options),
+        rearmInline_(rearmInline),
         notificationEv_(
             Event::NotificationFd{}, ::eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK)) {
     PCHECK(notificationEv_.fd >= 0);
   }
 
-  ~EventBasePollerImpl() override {
-    CHECK_EQ(numGroups_.load(), 0)
-        << "All groups must be destroyed before EventBasePoller";
-    fileops::close(notificationEv_.fd);
-  }
+  EventBasePollerImpl(const EventBasePollerImpl&) = delete;
+  EventBasePollerImpl& operator=(const EventBasePollerImpl&) = delete;
+  EventBasePollerImpl(EventBasePollerImpl&&) = delete;
+  EventBasePollerImpl& operator=(EventBasePollerImpl&&) = delete;
 
-  std::unique_ptr<FdGroup> makeFdGroup(ReadyCallback readyCallback) override;
+  ~EventBasePollerImpl() override { fileops::close(notificationEv_.fd); }
 
- protected:
-  void startLoop() {
-    Baton<> started;
-    loopThread_ = std::make_unique<std::thread>([this, &started]() {
-      loop(started);
-    });
-    started.wait();
+  std::unique_ptr<Handle> add(int fd, void* userData) override {
+    auto handle = std::make_unique<Event>(*this, fd, userData);
+    handle->handoff(false);
+    return handle;
   }
 
-  void stopLoop() {
+  void reclaim(std::unique_ptr<Handle> handle) override {
+    static_cast<Event*>(handle.get())->join();
+  }
+
+  small_vector<Handle*, 4> wait() final;
+
+  void shutdown() override {
     stop_ = true;
     notifyEvfd();
-    loopThread_->join();
   }
 
+ protected:
   struct Event final : public Handle {
     struct NotificationFd {};
 
-    Event(FdGroupImpl& group_, int fd_, void* userData)
-        : Handle(userData), group(&group_), fd(fd_) {}
+    Event(EventBasePollerImpl& parent_, int fd_, void* userData)
+        : Handle(userData), parent(&parent_), fd(fd_) {}
     // Special internal event to poll the notification eventfd.
-    Event(NotificationFd, int fd_) : Handle(nullptr), group(nullptr), fd(fd_) {}
+    Event(NotificationFd, int fd_)
+        : Handle(nullptr), parent(nullptr), fd(fd_) {}
 
     ~Event() override {
       CHECK(isNotificationFd() || joined_.ready())
           << "Handle must be reclaimed before destruction";
     }
 
-    bool isNotificationFd() const { return group == nullptr; }
+    bool isNotificationFd() const { return parent == nullptr; }
 
-    // TSAN is not able to recognize the happens-before relationship between
-    // rearming (epoll_ctl) and handling ready events, so use a fake mutex to
-    // introduce the expected relationships and at the same time check them.
+    // TSAN does not recognize the happens-before relationship between rearming
+    // (e.g. epoll_ctl(EPOLL_CTL_MOD)) and handling the ready event, so use a
+    // fake mutex to introduce it and at the same time check it.
     FOLLY_ALWAYS_INLINE void markRea
```

**File**: `folly/io/async/EventBasePoller.h` (modified, +36/-61)
```diff
@@ -19,56 +19,25 @@
 #include <chrono>
 #include <memory>
 
-#include <folly/Function.h>
-#include <folly/Range.h>
-#include <folly/Synchronized.h>
+#include <folly/small_vector.h>
 
 namespace folly::detail {
 
 /**
- * EventBasePoller centralizes the blocking wait for events across multiple
- * EventBases in a process. The singleton calls the provided ReadyCallback on
- * ready EventBases, so they can be driven without blocking. This enables
- * control over which threads drive the EventBases, as opposed to the standard
- * blocking loop that requires one thread per EventBase.
+ * EventBasePoller multiplexes the pollable fds of multiple EventBases, so that
+ * a pool of threads can drive them without one thread per EventBase.
  *
- * EventBases' pollable fds are registered in groups, so that the callback can
- * batch processing of ready EventBases that belong to the same group.
+ * wait() blocks until some fds are ready and returns their handles. A ready
+ * EventBase can be driven until it would block; then handoff() must be called
+ * to resume polling it.
  *
- * When the EventBase is ready it can be driven until it would block again, and
- * then handoff() must be called to resume polling the fd. Neither the driving
- * of the EventBase or the call to handoff() should happen inline in the
- * callback, but delegated to another thread without blocking; the callback must
- * return control quickly, as it executes in the main polling loop and can slow
- * down the handling of all other registered EventBases.
- *
- * Note that none of the implementation is specific to EventBases, in fact this
- * is a lightweight implementation of an event loop specialized on polling read
- * events, and which supports grouping of the fds for batch-handling. The class
- * could be easily generalized if other applications arise.
+ * At most one thread can be in wait() at any time; consecutive calls may come
+ * from different threads if ordered by happens-before. Other methods are
+ * thread-safe. With io_uring, a thread that has called wait() must not exit
+ * while handles are registered, as its in-flight polls would be cancelled.
  */
 class EventBasePoller {
  public:
-  struct Stats {
-    using Duration = std::chrono::steady_clock::duration;
-
-    // Track number of loop wake-ups and number of events returned.
-    int minNumEvents{std::numeric_limits<int>::max()};
-    int maxNumEvents{std::numeric_limits<int>::min()};
-    size_t totalNumEvents{0};
-    size_t totalWakeups{0};
-
-    Duration totalWait{0};
-    Duration minWait{Duration::max()};
-    Duration maxWait{Duration::min()};
-
-    Duration totalBusy{0};
-    Duration minBusy{Duration::max()};
-    Duration maxBusy{Duration::min()};
-
-    void update(int numEvents, Duration wait, Duration busy);
-  };
-
   class Handle {
    public:
     virtual ~Handle();
@@ -78,42 +47,48 @@ class EventBasePoller {
       return reinterpret_cast<T*>(userData_);
     }
 
-    // If done is set to true, the handle is not re-armed and can be reclaimed
-    // with reclaim().
+    // Re-arms the fd for polling (done=false) or marks the handle as finished
+    // so it can be reclaimed (done=true).
     virtual void handoff(bool done) = 0;
 
    protected:
-    friend class EventBasePoller;
-
     explicit Handle(void* userData) : userData_(userData) {}
 
     void* userData_;
   };
 
-  // FdGroup method invocations must be serialized.
-  class FdGroup {
-   public:
-    virtual ~FdGroup();
+  // epoll with inline rearm is the simplest configuration and the preferred
+  // one; the other backends and modes exist for experimentation.
+  struct Options {
+    enum class Backend { kEpoll, kIoUring };
 
-    // All added handles must be reclaimed before the group is destroyed.
-    virtual std::unique_ptr<Handle> add(int fd, void* userData) = 0;
-    // Blocks until handoff(true) is called on the handle.
-    virtual void reclaim(std::unique_ptr<Handle> handle) = 0;
-  };
+    // Must be user-provided for create()'s default argument to compile.
+    Options() {}
 
-  using ReadyCallback =
-      Function<void(Range<Handle**> readyHandles) const noexcept>;
+    Backend backend{Backend::kEpoll};
+    bool epollRearmInline{true};
+    std::chrono::microseconds spinTimeout{10};
+    std::chrono::microseconds sleepBeforeBlock{0};
+    size_t epollMaxEvents{64};
+    size_t ioUringSqEntries{128};
+  };
 
-  static EventBasePoller& get();
+  static std::unique_ptr<EventBasePoller> create(Options options = {});
 
   virtual ~EventBasePoller();
 
-  virtual std::unique_ptr<FdGroup> makeFdGroup(ReadyCallback readyCallback) = 0;
+  virtual std::unique_ptr<Handle> add(int fd, void* userData) = 0;
+
+  // Blocks until handoff(true) is called on the handle.
+  virtual void reclaim(std::unique_ptr<Handle> handle) = 0;
 
-  Stats getStats() { return stats_.copy(); }
+  // Blocks until at least one handle is ready. Returns ready handles.
+  // Returns empty only after shutdown().
+  virtual s
```

**File**: `folly/io/async/MuxIOThreadPoolExecutor.cpp` (modified, +99/-20)
```diff
@@ -19,11 +19,36 @@
 #include <stdexcept>
 
 #include <fmt/format.h>
-#include <folly/container/Enumerate.h>
 #include <folly/io/async/EpollBackend.h>
 #include <folly/lang/Align.h>
+#include <folly/portability/GFlags.h>
 #include <folly/synchronization/Latch.h>
 
+FOLLY_GFLAGS_DEFINE_string(
+    folly_mux_io_thread_pool_executor_poller_backend,
+    "epoll",
+    "Default EventBasePoller backend: \"epoll\", \"io_uring\"");
+FOLLY_GFLAGS_DEFINE_uint64(
+    folly_mux_io_thread_pool_executor_poller_spin_us,
+    10,
+    "Spin-wait for events up to this amount (us) before blocking wait");
+FOLLY_GFLAGS_DEFINE_uint64(
+    folly_mux_io_thread_pool_executor_poller_sleep_us,
+    0,
+    "Sleep for this amount (us) before doing a blocking wait for events");
+FOLLY_GFLAGS_DEFINE_uint64(
+    folly_mux_io_thread_pool_executor_poller_epoll_max_events,
+    64,
+    "Maximum number of events to process in one epoll_wait iteration");
+FOLLY_GFLAGS_DEFINE_bool(
+    folly_mux_io_thread_pool_executor_poller_epoll_rearm_inline,
+    true,
+    "When using epoll backend, re-arm events inline in handoff()");
+FOLLY_GFLAGS_DEFINE_uint64(
+    folly_mux_io_thread_pool_executor_poller_io_uring_sq_entries,
+    128,
+    "Minimum number of io_uring submission queue entries");
+
 namespace folly {
 
 namespace {
@@ -35,6 +60,30 @@ ThrottledLifoSem::Options throttledLifoSemOptions(
   return opts;
 }
 
+detail::EventBasePoller::Options pollerOptionsFromGFlags() {
+  detail::EventBasePoller::Options opts;
+  const auto& backend = FLAGS_folly_mux_io_thread_pool_executor_poller_backend;
+  if (backend == "epoll") {
+    opts.backend = detail::EventBasePoller::Options::Backend::kEpoll;
+  } else if (backend == "io_uring") {
+    opts.backend = detail::EventBasePoller::Options::Backend::kIoUring;
+  } else {
+    throw std::invalid_argument(
+        fmt::format("Unsupported EventBasePoller backend: {}", backend));
+  }
+  opts.epollRearmInline =
+      FLAGS_folly_mux_io_thread_pool_executor_poller_epoll_rearm_inline;
+  opts.spinTimeout = std::chrono::microseconds{
+      FLAGS_folly_mux_io_thread_pool_executor_poller_spin_us};
+  opts.sleepBeforeBlock = std::chrono::microseconds{
+      FLAGS_folly_mux_io_thread_pool_executor_poller_sleep_us};
+  opts.epollMaxEvents =
+      FLAGS_folly_mux_io_thread_pool_executor_poller_epoll_max_events;
+  opts.ioUringSqEntries =
+      FLAGS_folly_mux_io_thread_pool_executor_poller_io_uring_sq_entries;
+  return opts;
+}
+
 } // namespace
 
 struct MuxIOThreadPoolExecutor::EvbState {
@@ -69,16 +118,13 @@ MuxIOThreadPoolExecutor::MuxIOThreadPoolExecutor(
       numEventBases_(
           options_.numEventBases == 0 ? numThreads : options_.numEventBases),
       eventBaseManager_(ebm),
-      readyQueueSem_(throttledLifoSemOptions(options.wakeUpInterval)) {
-  setNumThreads(numThreads);
+      readyQueueSem_(throttledLifoSemOptions(options_.wakeUpInterval)) {
+  poller_ = EventBasePoller::create(
+      options_.pollerOptions
+          ? *options_.pollerOptions
+          : pollerOptionsFromGFlags());
 
-  fdGroup_ = EventBasePoller::get().makeFdGroup(
-      [this](Range<EventBasePoller::Handle**> readyHandles) noexcept {
-        for (auto* handle : readyHandles) {
-          readyQueue_.enqueue(handle);
-        }
-        readyQueueSem_.post(readyHandles.size());
-      });
+  setNumThreads(numThreads);
 
   evbStates_.reserve(numEventBases_);
   Latch allEvbsRunning(numEventBases_);
@@ -90,8 +136,14 @@ MuxIOThreadPoolExecutor::MuxIOThreadPoolExecutor(
     keepAlives_.emplace_back(&evbState->evb);
     auto fd = evbState->evb.getBackend()->getPollableFd();
     CHECK_GE(fd, 0);
-    evbState->handle = fdGroup_->add(fd, evbState.get());
+    evbState->handle = poller_->add(fd, evbState.get());
   }
+
+  // Must be posted before allEvbsRunning.wait(): no thread polls until the
+  // sentinel is dequeued.
+  readyQueue_.enqueue(kWaitSentinel());
+  readyQueueSem_.post();
+
   allEvbsRunning.wait();
 
   registerThreadPoolExecutor(this);
@@ -186,10 +238,29 @@ void MuxIOThreadPoolExecutor::threadRun(ThreadPtr thread) {
 
   while (true) {
     readyQueueSem_.wait(WaitOptions{}.spin_max(options_.idleSpinMax));
-    auto handle = readyQueue_.dequeue();
+    auto* handle = readyQueue_.dequeue();
+
     if (handle == nullptr) {
-      break;
+      break; // Shutdown poison.
+    }
+
+    if (handle == kWaitSentinel()) {
+      auto readyHandles = poller_->wait();
+      if (readyHandles.empty()) {
+        // Interrupted by shutdown. Don't re-enqueue sentinel.
+        continue;
+      }
+      // Process one handle (any would do) inline, after enqueuing the others
+      // and the sentinel.
+      handle = readyHandles.back();
+      readyHandles.pop_back();
+      for (auto* h : readyHandles) {
+        readyQueue_.enqueue(h);
+      }
+      readyQueue_.enqueue(kWaitSentinel());
+      readyQueueSem_.post(static_cast<uint32_t>(readyHandles.size() + 1));
     }
+
     auto* evbState = handle-
```

**File**: `folly/io/async/MuxIOThreadPoolExecutor.h` (modified, +17/-2)
```diff
@@ -18,6 +18,7 @@
 
 #include <chrono>
 #include <limits>
+#include <optional>
 
 #include <folly/Portability.h>
 #include <folly/concurrency/UnboundedQueue.h>
@@ -82,12 +83,19 @@ class MuxIOThreadPoolExecutor : public IOThreadPoolExecutorBase {
       return *this;
     }
 
+    Options& setPollerOptions(detail::EventBasePoller::Options opts) {
+      pollerOptions = opts;
+      return *this;
+    }
+
     bool enableThreadIdCollection{false};
     // If 0, the number of EventBases is set to the number of threads.
     size_t numEventBases{0};
     std::chrono::nanoseconds wakeUpInterval{std::chrono::microseconds{100}};
     // Max spin for an idle thread waiting for work before going to sleep.
     std::chrono::nanoseconds idleSpinMax = std::chrono::microseconds{10};
+    // If not set, defaults are read from gflags.
+    std::optional<detail::EventBasePoller::Options> pollerOptions;
   };
 
   explicit MuxIOThreadPoolExecutor(
@@ -135,6 +143,10 @@ class MuxIOThreadPoolExecutor : public IOThreadPoolExecutorBase {
     EvbState* curEvbState; // Only accessed inside the worker thread.
   };
 
+  static EventBasePoller::Handle* kWaitSentinel() {
+    return reinterpret_cast<EventBasePoller::Handle*>(1);
+  }
+
   void maybeUnregisterEventBases(Observer* o);
 
   void prepareSetNumThreads(size_t numThreads) override;
@@ -148,15 +160,18 @@ class MuxIOThreadPoolExecutor : public IOThreadPoolExecutorBase {
   const size_t numEventBases_;
   folly::EventBaseManager* eventBaseManager_;
 
-  std::unique_ptr<EventBasePoller::FdGroup> fdGroup_;
+  std::unique_ptr<EventBasePoller> poller_;
   std::vector<std::unique_ptr<EvbState>> evbStates_;
   std::vector<Executor::KeepAlive<EventBase>> keepAlives_;
 
   relaxed_atomic<size_t> nextEvb_{0};
   folly::ThreadLocal<std::shared_ptr<IOThread>> thisThread_;
   std::unique_ptr<ThreadIdWorkerProvider> threadIdCollector_;
-  std::atomic<size_t> pendingTasks_{0};
 
+  // Single producer: only the sentinel holder enqueues, and the sentinel is the
+  // last element it enqueues, so consecutive holders are ordered. Poison pills
+  // are only enqueued after all handles are reclaimed: from then on wait() only
+  // returns empty, so the sentinel holder no longer enqueues.
   USPMCQueue<EventBasePoller::Handle*, /* MayBlock */ false> readyQueue_;
   folly::ThrottledLifoSem readyQueueSem_;
 };
```

**File**: `folly/io/async/test/BUCK` (modified, +6/-5)
```diff
@@ -1447,6 +1447,7 @@ fbcode_target(
     srcs = ["MuxIOThreadPoolExecutorTest.cpp"],
     link_whole = True,
     deps = [
+        "//folly:function",
         "//folly/executors/test:IOThreadPoolExecutorBaseTestLib",
         "//folly/io/async:epoll",
         "//folly/io/async:mux_io_thread_pool_executor",
@@ -1459,8 +1460,8 @@ fbcode_target(
     _kind = cpp_unittest,
     name = "mux_io_thread_pool_executor_test_epoll",
     args = [
-        "--folly_event_base_poller_backend=epoll",
-        "--folly_event_base_poller_epoll_rearm_inline=false",
+        "--folly_mux_io_thread_pool_executor_poller_backend=epoll",
+        "--folly_mux_io_thread_pool_executor_poller_epoll_rearm_inline=false",
     ],
     supports_static_listing = False,
     deps = [
@@ -1472,8 +1473,8 @@ fbcode_target(
     _kind = cpp_unittest,
     name = "mux_io_thread_pool_executor_test_epoll_rearm_inline",
     args = [
-        "--folly_event_base_poller_backend=epoll",
-        "--folly_event_base_poller_epoll_rearm_inline=true",
+        "--folly_mux_io_thread_pool_executor_poller_backend=epoll",
+        "--folly_mux_io_thread_pool_executor_poller_epoll_rearm_inline=true",
     ],
     supports_static_listing = False,
     deps = [
@@ -1485,7 +1486,7 @@ fbcode_target(
     _kind = cpp_unittest,
     name = "mux_io_thread_pool_executor_test_io_uring",
     args = [
-        "--folly_event_base_poller_backend=io_uring",
+        "--folly_mux_io_thread_pool_executor_poller_backend=io_uring",
     ],
     supports_static_listing = False,
     deps = [
```

**File**: `folly/io/async/test/MuxIOThreadPoolExecutorTest.cpp` (modified, +32/-0)
```diff
@@ -19,7 +19,9 @@
 #if FOLLY_HAS_EPOLL
 
 #include <thread>
+#include <vector>
 
+#include <folly/Function.h>
 #include <folly/executors/test/IOThreadPoolExecutorBaseTestLib.h>
 #include <folly/io/async/MuxIOThreadPoolExecutor.h>
 #include <folly/portability/GTest.h>
@@ -68,6 +70,36 @@ TEST(MuxIOThreadPoolExecutor, SingleEpollLoopRun) {
   testEvbs();
 }
 
+TEST(MuxIOThreadPoolExecutor, PollerRingMigration) {
+  // Few threads and many EventBases with short timers, so polls armed on one
+  // thread are routinely completed on another.
+  static constexpr size_t kNumThreads = 2;
+  static constexpr size_t kNumEventBases = 64;
+  static constexpr size_t kIterationsPerEvb = 20;
+
+  folly::MuxIOThreadPoolExecutor::Options options;
+  options.setNumEventBases(kNumEventBases);
+  folly::MuxIOThreadPoolExecutor ex(kNumThreads, options);
+
+  const auto evbs = ex.getAllEventBases();
+  folly::Latch latch(kNumEventBases * kIterationsPerEvb);
+  std::vector<size_t> remaining(kNumEventBases, kIterationsPerEvb);
+
+  // Each EventBase's callbacks run serially on its own loop, so remaining[i]
+  // needs no extra synchronization. count_down() is the last shared access, so
+  // no worker touches these locals once latch.wait() returns.
+  folly::Function<void(size_t)> tick = [&](size_t i) {
+    if (--remaining[i] > 0) {
+      evbs[i]->runAfterDelay([&tick, i] { tick(i); }, /* milliseconds */ 1);
+    }
+    latch.count_down();
+  };
+  for (size_t i = 0; i < kNumEventBases; ++i) {
+    evbs[i]->runInEventBaseThread([&tick, i] { tick(i); });
+  }
+  latch.wait();
+}
+
 TEST(MuxIOThreadPoolExecutor, SingleEpollLoopTimers) {
   static constexpr size_t kNumThreads = 16;
   static constexpr uint32_t kMilliseconds = 500;
```

---

### Incident Patch 8: `88c50be8` (2026-10-05)
**Commit Message**: MuxIOThreadPoolExecutor: disallow reducing the thread count

Summary:
Shutting down threads is incompatible with `io_uring`: if a thread is shut down, any pending operations it submitted get cancelled. Worker threads submit to the poller's ring with the `io_uring` poller backend after the next diff, and would also submit to EventBase rings if we ever support `IoUringBackend` for the pool. So this diff disables downsizing.

There is probably a way to work around this, but there is no known valid use case for resizing IO pools outside of tests (especially since the number of EventBases is fixed), and this code is experimental. If the need arises, we can support resizing both later.

Make `setNumThreads()` throw on a reduction, and force `minThreads_ == maxThreads_` on every change so the pool's own timeout machinery cannot reduce the count either (the base only ever lowers `minThreads_`, so upsizing must set it explicitly).

Rename `ThreadPoolExecutor::validateNumThreads()` to `prepareSetNumThreads()`: it is non-const and now also pre-adjusts `minThreads_`, so "validate" no longer fits.

Reviewed By: cjhawley

Differential Revision: D113780924

fbshipit-source-id: 5d5ea6d8cf8d2aeeeb9

**File**: `folly/executors/ThreadPoolExecutor.cpp` (modified, +1/-1)
```diff
@@ -228,10 +228,10 @@ void ThreadPoolExecutor::setNumThreads(size_t numThreads) {
      all thread creation (see tests for an example of this)
   */
 
-  validateNumThreads(numThreads);
   size_t numThreadsToJoin = 0;
   {
     std::unique_lock w{threadListLock_};
+    prepareSetNumThreads(numThreads);
     auto pending = getPendingTaskCountImpl();
     auto active = activeThreads_.load(std::memory_order_relaxed);
 
```

**File**: `folly/executors/ThreadPoolExecutor.h` (modified, +5/-1)
```diff
@@ -325,7 +325,11 @@ class ThreadPoolExecutor : public DefaultKeepAliveExecutor {
 
   void runTask(const ThreadPtr& thread, Task&& task);
 
-  virtual void validateNumThreads(size_t /* numThreads */) {}
+  // Called by setNumThreads() while holding threadListLock_, before any
+  // thread-count state is modified. Subclasses may reject the new value (by
+  // throwing) and/or pre-adjust related state atomically with the update. Must
+  // not block or re-enter the executor.
+  virtual void prepareSetNumThreads(size_t /* numThreads */) {}
 
   // The function that will be bound to pool threads. It must call
   // thread->initBaton.post() once alive, then thread->readyBaton.wait()
```

**File**: `folly/io/async/MuxIOThreadPoolExecutor.cpp` (modified, +17/-1)
```diff
@@ -129,14 +129,30 @@ void MuxIOThreadPoolExecutor::add(
   evbState.evb.runInEventBaseThread(std::move(wrappedFunc));
 }
 
-void MuxIOThreadPoolExecutor::validateNumThreads(size_t numThreads) {
+void MuxIOThreadPoolExecutor::prepareSetNumThreads(size_t numThreads) {
   if (numThreads == 0 || numThreads > numEventBases_) {
     throw std::invalid_argument(
         fmt::format(
             "Unsupported number of threads: {} (with {} EventBases)",
             numThreads,
             numEventBases_));
   }
+  // Threads may only be stopped at shutdown: with io_uring, the pending
+  // operations a thread submitted are cancelled when it exits.
+  // This runs under threadListLock_, so the check and the minThreads_ update
+  // are atomic with setNumThreads()'s mutation: concurrent calls serialize, and
+  // any that would reduce the count throws.
+  const auto currentMax = maxThreads_.load(std::memory_order_relaxed);
+  if (numThreads < currentMax) {
+    throw std::invalid_argument(
+        fmt::format(
+            "Reducing the number of threads is not supported: {} < {}",
+            numThreads,
+            currentMax));
+  }
+  // Force minThreads_ == maxThreads_ so the pool's timeout machinery can never
+  // reduce the thread count on its own (the base only ever lowers minThreads_).
+  minThreads_.store(numThreads, std::memory_order_relaxed);
 }
 
 std::shared_ptr<ThreadPoolExecutor::Thread>
```

**File**: `folly/io/async/MuxIOThreadPoolExecutor.h` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ class MuxIOThreadPoolExecutor : public IOThreadPoolExecutorBase {
 
   void maybeUnregisterEventBases(Observer* o);
 
-  void validateNumThreads(size_t numThreads) override;
+  void prepareSetNumThreads(size_t numThreads) override;
   ThreadPtr makeThread() override;
   EvbState& pickEvbState();
   void threadRun(ThreadPtr thread) override;
```

**File**: `folly/io/async/test/MuxIOThreadPoolExecutorTest.cpp` (modified, +3/-5)
```diff
@@ -61,11 +61,8 @@ TEST(MuxIOThreadPoolExecutor, SingleEpollLoopRun) {
 
   testEvbs();
 
-  ex.setNumThreads(1);
-  EXPECT_EQ(ex.numThreads(), 1);
-  EXPECT_EQ(ex.numActiveThreads(), 1);
-  testEvbs();
-
+  // Downsizing is not supported; exercise upsizing from the many-EventBases,
+  // few-threads steady state.
   ex.setNumThreads(kNumEventBases);
   EXPECT_EQ(ex.numThreads(), kNumEventBases);
   testEvbs();
@@ -95,6 +92,7 @@ TEST(MuxIOThreadPoolExecutor, InvalidSetNumThreads) {
   ex.setNumThreads(16); // No-op.
   EXPECT_THROW(ex.setNumThreads(0), std::invalid_argument);
   EXPECT_THROW(ex.setNumThreads(17), std::invalid_argument);
+  EXPECT_THROW(ex.setNumThreads(8), std::invalid_argument); // No downsizing.
 
   EXPECT_THROW(folly::MuxIOThreadPoolExecutor(0), std::invalid_argument);
   folly::MuxIOThreadPoolExecutor::Options options;
```

---

### Incident Patch 9: `bfae630e` (2026-10-05)
**Commit Message**: folly: fix negative timeout handling and timing flakes

Summary:
Clamp non-positive TimerFDTimeoutManager durations to one microsecond before programming timerfd.

Previously, a negative duration reached timerfd_settime(), which rejects it with EINVAL. TimerFD::setTimer() converted that error to false, but TimerFD::schedule() ignored the return value and TimerFDTimeoutManager::scheduleTimeout() returns void, so the failure was not propagated. The previously armed timer remained unchanged, which made NegativeTimeout usually pass but become timing-dependent.

Also remove strict wall-clock checks from persistent EventHandler tests. Their ordering and byte-count assertions cover the behavior, while callback latency depends on host scheduling.

Reviewed By: yfeldblum

Differential Revision: D123128254

fbshipit-source-id: f84d4ca929e018c8e4a7f6efb686626738d4cc1d

**File**: `folly/io/async/TimerFDTimeoutManager.cpp` (modified, +3/-2)
```diff
@@ -34,8 +34,9 @@ void TimerFDTimeoutManager::onTimeout() noexcept {
 void TimerFDTimeoutManager::scheduleTimeout(
     Callback* callback, std::chrono::microseconds timeout) {
   cancelTimeout(callback);
-  // we cannot schedule a timeout of 0 - this will stop the timer
-  if (FOLLY_UNLIKELY(!timeout.count())) {
+  // Non-positive timeouts should fire as soon as possible. A zero timeout
+  // disarms timerfd, while a negative timeout is rejected with EINVAL.
+  if (FOLLY_UNLIKELY(timeout.count() <= 0)) {
     timeout = std::chrono::microseconds(1);
   }
   auto expirationTime = getCurTime() + timeout;
```

**File**: `folly/io/async/test/EventBaseTestLib.h` (modified, +0/-16)
```diff
@@ -502,32 +502,24 @@ TYPED_TEST_P(EventBaseTest, WritePersist) {
       {100, EventHandler::READ, 0, 0},
       {0, 0, 0, 0},
   };
-  TimePoint start;
   scheduleEvents(&eb, sp[1], events);
 
   // Schedule a timeout to unregister the handler after the third read
   eb.tryRunAfterDelay(std::bind(&TestHandler::unregisterHandler, &handler), 85);
 
   // Loop
   eb.loop();
-  TimePoint end;
 
   // The handler should have received the first 3 events,
   // then been unregistered after that.
   ASSERT_EQ(handler.log.size(), 3);
   ASSERT_EQ(events[0].result, initialBytesWritten);
   for (int n = 0; n < 3; ++n) {
     ASSERT_EQ(handler.log[n].events, EventHandler::WRITE);
-    T_CHECK_TIMEOUT(
-        start,
-        handler.log[n].timestamp,
-        std::chrono::milliseconds(events[n].milliseconds));
     ASSERT_EQ(handler.log[n].bytesRead, 0);
     ASSERT_GT(handler.log[n].bytesWritten, 0);
     ASSERT_EQ(handler.log[n].bytesWritten, events[n + 1].result);
   }
-  T_CHECK_TIMEOUT(
-      start, end, std::chrono::milliseconds(events[3].milliseconds));
 }
 
 /**
@@ -744,33 +736,25 @@ TYPED_TEST_P(EventBaseTest, ReadWritePersist) {
       {120, EventHandler::WRITE, 2345, 0},
       {0, 0, 0, 0},
   };
-  TimePoint start;
   scheduleEvents(&eb, sp[1], events);
 
   // Schedule a timeout to unregister the handler
   eb.tryRunAfterDelay(std::bind(&TestHandler::unregisterHandler, &handler), 80);
 
   // Loop
   eb.loop();
-  TimePoint end;
 
   ASSERT_EQ(handler.log.size(), 6);
 
   // Since we didn't fill up the write buffer immediately, there should
   // be an immediate event for writability.
   ASSERT_EQ(handler.log[0].events, EventHandler::WRITE);
-  T_CHECK_TIMEOUT(
-      start, handler.log[0].timestamp, std::chrono::milliseconds(0));
   ASSERT_EQ(handler.log[0].bytesRead, 0);
   ASSERT_GT(handler.log[0].bytesWritten, 0);
 
   // Events 1 through 5 should correspond to the scheduled events
   for (int n = 1; n < 6; ++n) {
     ScheduledEvent* event = &events[n - 1];
-    T_CHECK_TIMEOUT(
-        start,
-        handler.log[n].timestamp,
-        std::chrono::milliseconds(event->milliseconds));
     if (event->events == EventHandler::READ) {
       ASSERT_EQ(handler.log[n].events, EventHandler::WRITE);
       ASSERT_EQ(handler.log[n].bytesRead, 0);
```

---

### Incident Patch 10: `f4238317` (2026-10-05)
**Commit Message**: fix T291467750

Summary:
fixing broken tests in T291467750

___

landed-with-radar-review

Differential Revision: D123329323

fbshipit-source-id: 77e7c2a706eefb89b118ae04269cee5467783b5d

**File**: `folly/python/test/BUCK` (modified, +2/-0)
```diff
@@ -107,6 +107,7 @@ fb_dirsync_rule(
         "//folly:cancellation_token",
     ],
     fbcode_rule = cython_library,
+    package = "folly/python/test",
     types = ["simplebridgecoro.pyi"],
     deps = [
         "//folly/python:coro",
@@ -306,6 +307,7 @@ fb_dirsync_rule(
         "//folly/io/async:request_context",
     ],
     fbcode_rule = cython_library,
+    package = "folly/python/test",
     types = ["request_context_helper.pyi"],
     deps = [
         "//folly/python:request_context",
```

---

### Incident Patch 11: `68cabf06` (2026-10-04)
**Commit Message**: Fix broken fbsource//xplat/folly/logging/test:async_file_writer_test - AsyncFileWriter.

Differential Revision: D123206502

fbshipit-source-id: 29890ff608398590c03c87c845ff8b1377f1ea9d

**File**: `folly/logging/test/AsyncFileWriterTest.cpp` (modified, +1/-0)
```diff
@@ -600,6 +600,7 @@ TEST(AsyncFileWriter, discard) {
   std::thread reader(readThread, std::move(readPipe), &readStats);
   {
     AsyncFileWriter writer{std::move(writePipe)};
+    writer.setMaxBufferSize(16384);
 
     std::vector<std::thread> writeThreads;
     size_t numThreads = FLAGS_async_discard_num_normal_writers +
```

---

### Incident Patch 12: `a0719876` (2026-10-03)
**Commit Message**: Fix TimedRWMutex stranding readers when a writer times out

Summary:
`tsp_frc/ucache/c1-asserts` keeps aborting on this assertion: 28 aborts across 4 of its 5 tasks and 3 builds between 2026-09-27 19:22 and 2026-09-29 12:10 PDT, including a build that already contains D120614880:

```
folly/fibers/TimedMutex-inl.h: TimedRWMutexImpl<false, folly::fibers::Baton>::verify_unlocked_properties: Assertion `read_waiters_.empty()' failed.
```

The stack is always `UcMultiRangeFill` -> `RangeIndex::acquireExclusiveLock` -> `TimedRWMutexImpl<false, Baton>::try_lock_until` -> `try_lock_` -> `verify_unlocked_properties`. `RangeIndex` only takes this timed path when `range_index_exclusive_lock_timeout_ms` is non-zero.

In write-priority mode, readers queue in `read_waiters_` whenever `kHasWriteWaiters` is set, even while only readers hold the lock. When the last waiting writer times out in `try_lock_until`, it removes itself and clears `kHasWriteWaiters`, but it leaves the readers that queued behind it in `read_waiters_`. Nothing wakes them after that:
- The readers still holding the lock release through `try_unlock_shared_fast`, which only falls back to `unlock_()` while `kHasWriteWaiters` is s

**File**: `folly/fibers/TimedMutex-inl.h` (modified, +8/-8)
```diff
@@ -556,7 +556,11 @@ bool TimedRWMutexImpl<ReaderPriority, BatonType>::try_lock_until(
       if (write_waiters_.empty() && (slock2.state() & kHasWriteWaiters)) {
         slock2.state() &= ~kHasWriteWaiters;
       }
-      slock2.unlock();
+      if (write_waiters_.empty() && !(slock2.state() & kWriteLocked)) {
+        wake_readers_and_unlock(slock2);
+      } else {
+        slock2.unlock();
+      }
       waiter.wake(); // Ensure that destruction doesn't block.
       return false;
     }
@@ -594,7 +598,7 @@ void TimedRWMutexImpl<ReaderPriority, BatonType>::unlock_() {
         ((slock.state() >> kReadersShift) == 0) &&
         "read waiters can only accumulate while write locked");
     slock.state() &= ~kWriteLocked;
-    wake_readers_(slock);
+    wake_readers_and_unlock(slock);
     return;
   }
 
@@ -624,9 +628,8 @@ void TimedRWMutexImpl<ReaderPriority, BatonType>::unlock_() {
 }
 
 template <bool ReaderPriority, typename BatonType>
-void TimedRWMutexImpl<ReaderPriority, BatonType>::wake_readers_(
+void TimedRWMutexImpl<ReaderPriority, BatonType>::wake_readers_and_unlock(
     StateLock& slock) {
-  assert(!read_waiters_.empty());
   std::vector<MutexWaiter*> waiters_to_wake;
   waiters_to_wake.reserve(read_waiters_.size());
   slock.state() += read_waiters_.size() * kReadersInc;
@@ -652,10 +655,7 @@ void TimedRWMutexImpl<ReaderPriority, BatonType>::unlock_and_lock_shared() {
       ((slock.state() >> kReadersShift) == 0));
   slock.state() &= ~kWriteLocked;
   slock.state() += kReadersInc;
-
-  if (!read_waiters_.empty()) {
-    wake_readers_(slock);
-  }
+  wake_readers_and_unlock(slock);
 }
 } // namespace fibers
 } // namespace folly
```

**File**: `folly/fibers/TimedMutex.h` (modified, +1/-1)
```diff
@@ -244,7 +244,7 @@ class TimedRWMutexImpl {
 
   bool try_lock_(StateLock& slock);
   void unlock_();
-  void wake_readers_(StateLock& slock);
+  void wake_readers_and_unlock(StateLock& slock);
 
   using MutexWaiter = detail::MutexWaiter<BatonType>;
   using MutexWaiterList =
```

**File**: `folly/fibers/test/FibersTest.cpp` (modified, +127/-0)
```diff
@@ -3340,6 +3340,133 @@ TEST(TimedRWMutex, SharedTimeoutBeforeHandoffWritePriority) {
   testTimedRWMutexSharedTimeoutBeforeHandoff<false>();
 }
 
+TEST(TimedRWMutex, ExclusiveTimeoutWithQueuedReaderWritePriority) {
+  TimedRWMutexImpl<false, TimedRWMutexTestBaton> mutex;
+  TimedRWMutexWaitState writer;
+  TimedRWMutexWaitState reader;
+  bool writerAcquired = true;
+  bool readerAcquired = false;
+
+  mutex.lock_shared();
+  std::thread writerThread([&] {
+    timedRWMutexWaitState = &writer;
+    writerAcquired =
+        mutex.try_lock_until(std::chrono::steady_clock::time_point::min());
+  });
+  writer.waiting.wait();
+  std::thread readerThread([&] {
+    timedRWMutexWaitState = &reader;
+    readerAcquired = mutex.try_lock_shared_until(
+        std::chrono::steady_clock::time_point::min());
+    if (readerAcquired) {
+      mutex.unlock_shared();
+    }
+  });
+  reader.waiting.wait();
+  writer.expire.post();
+  writerThread.join();
+  mutex.unlock_shared();
+  {
+    std::unique_lock blocked(mutex, std::try_to_lock);
+    EXPECT_FALSE(blocked.owns_lock());
+  }
+  reader.expire.post();
+  readerThread.join();
+
+  EXPECT_FALSE(writerAcquired);
+  EXPECT_TRUE(readerAcquired);
+  std::unique_lock lock(mutex, std::try_to_lock);
+  ASSERT_TRUE(lock.owns_lock());
+}
+
+TEST(TimedRWMutex, ExclusiveTimeoutWithQueuedWriterAndReaderWritePriority) {
+  TimedRWMutexImpl<false, TimedRWMutexTestBaton> mutex;
+  TimedRWMutexWaitState timedOutWriter;
+  TimedRWMutexWaitState writer;
+  TimedRWMutexWaitState reader;
+  std::atomic<int> order = 0;
+  bool timedOutWriterAcquired = true;
+  int writerOrder = 0;
+  int readerOrder = 0;
+
+  mutex.lock_shared();
+  std::thread timedOutWriterThread([&] {
+    timedRWMutexWaitState = &timedOutWriter;
+    timedOutWriterAcquired =
+        mutex.try_lock_until(std::chrono::steady_clock::time_point::min());
+  });
+  timedOutWriter.waiting.wait();
+  std::thread writerThread([&] {
+    timedRWMutexWaitState = &writer;
+    std::unique_lock lock(mutex);
+    writerOrder = ++order;
+  });
+  writer.waiting.wait();
+  std::thread readerThread([&] {
+    timedRWMutexWaitState = &reader;
+    std::shared_lock lock(mutex);
+    readerOrder = ++order;
+  });
+  reader.waiting.wait();
+  timedOutWriter.expire.post();
+  timedOutWriterThread.join();
+  mutex.unlock_shared();
+  writerThread.join();
+  readerThread.join();
+
+  EXPECT_FALSE(timedOutWriterAcquired);
+  EXPECT_LT(writerOrder, readerOrder);
+  std::unique_lock lock(mutex, std::try_to_lock);
+  ASSERT_TRUE(lock.owns_lock());
+}
+
+namespace {
+
+template <bool ReaderPriority>
+void testTimedRWMutexExclusiveTimeoutWhileWriteLocked() {
+  TimedRWMutexImpl<ReaderPriority, TimedRWMutexTestBaton> mutex;
+  TimedRWMutexWaitState timedOutWriter;
+  TimedRWMutexWaitState reader;
+  std::atomic<int> order = 0;
+  bool timedOutWriterAcquired = true;
+  int unlockOrder = 0;
+  int readerWakeOrder = 0;
+
+  reader.onPost = [&] { readerWakeOrder = ++order; };
+  mutex.lock();
+  std::thread timedOutWriterThread([&] {
+    timedRWMutexWaitState = &timedOutWriter;
+    timedOutWriterAcquired =
+        mutex.try_lock_until(std::chrono::steady_clock::time_point::min());
+  });
+  timedOutWriter.waiting.wait();
+  std::thread readerThread([&] {
+    timedRWMutexWaitState = &reader;
+    std::shared_lock lock(mutex);
+  });
+  reader.waiting.wait();
+  timedOutWriter.expire.post();
+  timedOutWriterThread.join();
+  unlockOrder = ++order;
+  mutex.unlock();
+  readerThread.join();
+
+  EXPECT_FALSE(timedOutWriterAcquired);
+  EXPECT_LT(unlockOrder, readerWakeOrder);
+  std::unique_lock lock(mutex, std::try_to_lock);
+  ASSERT_TRUE(lock.owns_lock());
+}
+
+} // namespace
+
+TEST(TimedRWMutex, ExclusiveTimeoutWhileWriteLockedReadPriority) {
+  testTimedRWMutexExclusiveTimeoutWhileWriteLocked<true>();
+}
+
+TEST(TimedRWMutex, ExclusiveTimeoutWhileWriteLockedWritePriority) {
+  testTimedRWMutexExclusiveTimeoutWhileWriteLocked<false>();
+}
+
 namespace {
 // Checks whether stackHighWatermark is set for non-ASAN builds,
 // and not set for ASAN builds.
```

---

### Incident Patch 13: `0f8a62d0` (2026-10-03)
**Commit Message**: Fuse duplicate-key scan into insert probe loop in SingleWriterFixedHashMap

Summary:
This diff is created by PerfAICT to optimize `folly::RequestContext::overwriteContextData` in "fbcode/folly/io/async/Request.cpp", by reducing CPU cycles spent in this function.

### Optimization Details

`folly::SingleWriterFixedHashMap::insert` previously performed two full probe-sequence traversals: a separate `writer_find(key)` scan to reject duplicate keys, followed by a second walk to locate the insertion slot. These two passes are now fused into a single probe loop: a VALID slot whose key matches returns `false` (key already present), while EMPTY and matching-TOMBSTONE slots take the insertion branch exactly as before. This eliminates one redundant probe-chain walk per insert on the `overwriteContextData` hot path (and on the `expand` copy re-insert loop). Duplicate detection, tombstone reuse, `used_`/`size_` bookkeeping, store memory-ordering, and all DCHECK/CHECK invariants are unchanged — the only removed work is the duplicated slot-chain traversal.

Reviewed By: cnli87

Differential Revision: D123039220

fbshipit-source-id: 87f8e0b7a1005947eac58eeaf9c1472fbf039fd4

**File**: `folly/concurrency/container/SingleWriterFixedHashMap.h` (modified, +6/-4)
```diff
@@ -135,16 +135,18 @@ class SingleWriterFixedHashMap {
       elem_ = std::make_unique<Elem[]>(capacity_);
     }
     DCHECK_LT(used_, capacity_);
-    if (writer_find(key) < capacity_) {
-      return false;
-    }
     size_t index = hash(key);
     auto attempts = capacity_;
     size_t mask = capacity_ - 1;
     while (attempts--) {
       Elem& e = elem_[index];
       auto state = e.state();
-      if (state == State::EMPTY ||
+      if (state == State::VALID) {
+        if (e.key() == key) {
+          return false;
+        }
+      } else if (
+          state == State::EMPTY ||
           (state == State::TOMBSTONE && e.key() == key)) {
         if (state == State::EMPTY) {
           e.setKey(key);
```

---

### Incident Patch 14: `4916e4ef` (2026-10-03)
**Commit Message**: use requires instead of enable_if

Summary: att - this simplifies a bit, and is a nice cleanup before the next diff in the stack

Reviewed By: yfeldblum

Differential Revision: D122423567

fbshipit-source-id: 1c7912aaaa3129fb0743ee827bee303b4fc92e08

**File**: `folly/container/MapUtil.h` (modified, +26/-50)
```diff
@@ -47,8 +47,8 @@ typename Map::mapped_type get_default(const Map& map, const Key& key) {
 template <
     class Map,
     typename Key = typename Map::key_type,
-    typename Value = typename Map::mapped_type,
-    typename std::enable_if<!std::is_invocable_v<Value>>::type* = nullptr>
+    typename Value = typename Map::mapped_type>
+  requires(!std::is_invocable_v<Value>)
 typename Map::mapped_type get_default(
     const Map& map, const Key& key, Value&& dflt) {
   using M = typename Map::mapped_type;
@@ -62,12 +62,8 @@ typename Map::mapped_type get_default(
  * Give a map and a key, return the value corresponding to the key in the map,
  * or a given default value if the key doesn't exist in the map.
  */
-template <
-    class Map,
-    typename Key = typename Map::key_type,
-    typename Func,
-    typename = typename std::enable_if<
-        is_invocable_r_v<typename Map::mapped_type, Func>>::type>
+template <class Map, typename Key = typename Map::key_type, typename Func>
+  requires(is_invocable_r_v<typename Map::mapped_type, Func>)
 typename Map::mapped_type get_default(
     const Map& map, const Key& key, Func&& dflt) {
   auto pos = map.find(key);
@@ -191,27 +187,19 @@ const typename Map::mapped_type& get_ref_default(
  * key in the map, or the given default reference if the key doesn't exist in
  * the map.
  */
-template <
-    class Map,
-    typename Key = typename Map::key_type,
-    typename Func,
-    typename = typename std::enable_if<
-        is_invocable_r_v<const typename Map::mapped_type&, Func>>::type,
-    typename = typename std::enable_if<
-        std::is_reference<invoke_result_t<Func>>::value>::type>
+template <class Map, typename Key = typename Map::key_type, typename Func>
+  requires(
+      is_invocable_r_v<const typename Map::mapped_type&, Func> &&
+      std::is_reference_v<invoke_result_t<Func>>)
 const typename Map::mapped_type& get_ref_default(
     Map&& map, const Key& key, Func&& dflt)
   requires(!std::is_lvalue_reference_v<Map>)
 = delete; // disallow on temporary map to prevent dangling reference
 
-template <
-    class Map,
-    typename Key = typename Map::key_type,
-    typename Func,
-    typename = typename std::enable_if<
-        is_invocable_r_v<const typename Map::mapped_type&, Func>>::type,
-    typename = typename std::enable_if<
-        std::is_reference<invoke_result_t<Func>>::value>::type>
+template <class Map, typename Key = typename Map::key_type, typename Func>
+  requires(
+      is_invocable_r_v<const typename Map::mapped_type&, Func> &&
+      std::is_reference_v<invoke_result_t<Func>>)
 const typename Map::mapped_type& get_ref_default(
     const Map& map [[FOLLY_ATTR_CLANG_LIFETIMEBOUND]],
     const Key& key,
@@ -297,10 +285,8 @@ std::pair<typename Map::mapped_type*, typename Map::mapped_type*> get_ptr2(
 // TODO: Remove the return type computations when clang 3.5 and gcc 5.1 are
 // the minimum supported versions.
 namespace detail {
-template <
-    class T,
-    size_t pathLength,
-    class = typename std::enable_if<(pathLength > 0)>::type>
+template <class T, size_t pathLength>
+  requires(pathLength > 0)
 struct NestedMapType {
   using type =
       typename NestedMapType<std::remove_pointer_t<T>, pathLength - 1>::type::
@@ -412,12 +398,8 @@ auto get_ptr(
  * value, or a given default value if the path doesn't exist in the map.
  * The default value is the last parameter, and is copied when returned.
  */
-template <
-    class Map,
-    class Key1,
-    class Key2,
-    class... KeysDefault,
-    typename = typename std::enable_if<sizeof...(KeysDefault) != 0>::type>
+template <class Map, class Key1, class Key2, class... KeysDefault>
+  requires(sizeof...(KeysDefault) != 0)
 auto get_default(
     const Map& map,
     const Key1& key1,
@@ -436,27 +418,21 @@ auto get_default(
  * in the map.
  * The default value is the last parameter, and must be a lvalue reference.
  */
-template <
-    class Map,
-    class Key1,
-    class Key2,
-    class... KeysDefault,
-    typename = typename std::enable_if<sizeof...(KeysDefault) != 0>::type,
-    typename = typename std::enable_if<std::is_lvalue_reference<
-        typename detail::DefaultType<KeysDefault...>::type>::value>::type>
+template <class Map, class Key1, class Key2, class... KeysDefault>
+  requires(
+      sizeof...(KeysDefault) != 0 &&
+      std::is_lvalue_reference_v<
+          typename detail::DefaultType<KeysDefault...>::type>)
 auto get_ref_default(
     Map&& map, const Key1& key1, const Key2& key2, KeysDefault&&... keysDefault)
   requires(!std::is_lvalue_reference_v<Map>)
 = delete; // disallow on temporary map to prevent dangling reference
 
-template <
-    class Map,
-    class Key1,
-    class Key2,
-    class... KeysDefault,
-    typename = typename std::enable_if<sizeof...(KeysDefault) != 0>::type,
-    typename = typename std::enable_if<std::is_lvalue_reference<
-        typename detail::DefaultType<KeysDefault...>::type>::value>::type>
+template <class Map, c
```

---

### Incident Patch 15: `418a3a81` (2026-10-02)
**Commit Message**: Build bpftool from source

Summary: GitHub-hosted Ubuntu runners expose kernel-specific bpftool packaging that can lag the active Azure kernel. Follow the portable Katran approach by adding bpftool as a pinned getdeps source dependency, installing it into the getdeps bin directory, and removing distro-specific bpftool packages. Regenerate the socket-lb workflow so GitHub Actions explicitly fetches the new dependency.

Reviewed By: kainanpeace666

Differential Revision: D122838798

fbshipit-source-id: 5778f0621ce75c8ca237dfe306888b0f78950de3

**File**: `build/fbcode_builder/manifests/bpftool` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+[manifest]
+name = bpftool
+
+[git]
+repo_url = https://github.com/libbpf/bpftool.git
+rev = v7.4.0
+
+# BPF only builds on Linux, so make it a NOP on other platforms.
+[build.not(os=linux)]
+builder = nop
+
+[build.os=linux]
+builder = make
+subdir = src
+patchfile = bpftool_install_to_bin.patch
+
+[make.install_args]
+install-bin
+
+[dependencies]
+libelf
+zlib
```

**File**: `build/fbcode_builder/manifests/socket-lb` (modified, +1/-7)
```diff
@@ -21,6 +21,7 @@ BUILD_TESTING = ON
 BUILD_TESTING = OFF
 
 [dependencies]
+bpftool
 folly
 gflags
 glog
@@ -36,14 +37,7 @@ googletest
 [debs]
 clang
 
-[debs.not(distro=ubuntu)]
-bpftool
-
-[debs.distro=ubuntu]
-linux-tools-common
-
 [rpms]
-bpftool
 clang
 llvm
 
```

**File**: `build/fbcode_builder/patches/bpftool_install_to_bin.patch` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+diff --git a/src/Makefile b/src/Makefile
+--- a/src/Makefile
++++ b/src/Makefile
+@@ -284,7 +284,7 @@ clean: $(LIBBPF)-clean $(LIBBPF_BOOTSTRAP)-clean feature-detect-clean
+ 
+ install-bin: $(OUTPUT)bpftool
+ 	$(call QUIET_INSTALL, bpftool)
+-	$(Q)$(INSTALL) -m 0755 -d $(DESTDIR)$(prefix)/sbin
+-	$(Q)$(INSTALL) $(OUTPUT)bpftool $(DESTDIR)$(prefix)/sbin/bpftool
++	$(Q)$(INSTALL) -m 0755 -d $(DESTDIR)$(prefix)/bin
++	$(Q)$(INSTALL) $(OUTPUT)bpftool $(DESTDIR)$(prefix)/bin/bpftool
+ 
+ install: install-bin
```

#### Recent Merged Pull Requests:
- **PR #2718** (closed): Stop Wait.multipleWait racing a timer (@vitaut)
- **PR #2717** (closed): Fix the remaining Windows test failures (@vitaut)
- **PR #2715** (closed): reverse iterator (#2715) (@DenisYaroshevskiy)
- **PR #2714** (closed): Fix the args test on Windows (@vitaut)
- **PR #2712** (closed): Fix the Windows CMake build (@vitaut)
- **PR #2711** (closed): Fix the Windows CMake build (@vitaut)
- **PR #2710** (closed): Fix the shared CMake build aborting all tests on a duplicate gflags (@vitaut)
- **PR #2707** (closed): FindLibDwarf: search libdwarf-2 include suffix (@michel-slm)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
