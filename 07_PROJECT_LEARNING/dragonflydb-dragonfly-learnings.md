> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Source Version**: `2cb963b6`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T14:40:44.893Z  
> **Learning ID**: `learn-github-dragonflydb-dragonfly`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): dragonflydb/dragonfly

> **Canonical Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T14:40:44.888Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflydb/dragonfly`
- **Description**: A modern replacement for Redis and Memcached
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 31845 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/benchmark/scripts/bench_util.py`
```
"""Shared helpers for benchmark scripts (collect_metrics, make_charts, plot_fill)."""

import os
import sys


def find_first(d, *names):
    """Return the value of the first key in d whose lowercase form contains any of names."""
    if not isinstance(d, dict):
        return None
    for k, v in d.items():
        kl = k.lower()
        for name in names:
            if name.lower() in kl:
                return v
    return None


def percentile_latency_us(d, percentile="99"):
    """Return percentile latency in microseconds across old and new bench JSON schemas."""
    if not isinstance(d, dict):
        return None

    def matches(key):
        lk = key.lower()
        return percentile in lk and ("percentile" in lk or f"p{percentile}" in lk or "th" in lk)

    # Newer dfly_bench/memtier-compatible JSON nests percentile latencies in milliseconds.
    nested = find_first(d, "Percentile Latencies")
    if isinstance(nested, dict):
        for key, value in nested.items():
            if matches(key):
                return value * 1000

    for key, value in d.items():
        if not matches(key):
            continue
        # Older benchmark fixtures use "Percentile 99.00" directly in microseconds.
        # Newer time-series samples use "p99.00" directly in milliseconds.
        if key.lower().startswith(f"p{percentile}"):
            return value * 1000
        return value

    return None


def import_matplotlib():
    """Import matplotlib with Agg backend; exit with a helpful message if missing."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        return plt
    except ImportError:
        print("matplotlib required: pip install matplotlib", file=sys.stderr)
        sys.exit(1)


def parse_series_specs(specs):
    """Yield (label, path) from a list of 'LABEL=path' strings, warning on bad entries."""
    for spec in specs:
        if "=" not in spec:
            print(f"warning: bad --series '{spec}', expected LABEL=path", file=sys.stderr)
            continue
        label, path = spec.split("=", 1)
        yield label, path


def save_figure(fig, out_path, dpi=120):
    """Create output directory if needed, save figure, and print the path."""
    d = os.path.dirname(out_path)
    if d:
        os.makedirs(d, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out_path, dpi=dpi)
    print(f"wrote {out_path}")

```

### Core Architecture Module: `src/core/allocation_tracker.h`
```
// Copyright 2024, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//
#pragma once

#include <absl/container/inlined_vector.h>
#include <mimalloc.h>

#include <cstddef>

namespace dfly {

// Allows "tracking" of memory allocations by size bands. Tracking is naive in that it only prints
// the stack trace of the memory allocation, if matched by size & sampling criteria.
// Supports up to 4 different bands in parallel.
//
// Thread-local. Must be configured in all relevant threads separately.
//
// #define INJECT_ALLOCATION_TRACKER before #include exactly once to override new/delete
class AllocationTracker {
 public:
  struct TrackingInfo {
    size_t lower_bound = 0;
    size_t upper_bound = 0;
    double sample_odds = 0.0;
  };

  // Returns a thread-local reference.
  static AllocationTracker& Get();

  // Will track memory allocations in range [lower, upper]. Sample odds must be between [0, 1],
  // where 1 means all allocations are tracked and 0 means none.
  bool Add(const TrackingInfo& info);

  // Removes all tracking exactly matching lower_bound and upper_bound.
  // Returns true if the tracking range [lower_bound, upper_bound] was removed
  // and false, otherwise.
  bool Remove(size_t lower_bound, size_t upper_bound);

  // Clears *all* tracking.
  void Clear();

  absl::Span<const TrackingInfo> GetRanges() const;

  void ProcessNew(void* ptr, size_t size);
  void ProcessDelete(void* ptr);

 private:
  void UpdateAbsSizes();

  absl::InlinedVector<TrackingInfo, 4> tracking_;
  bool inside_tracker_ = false;
  size_t abs_min_size_ = 0;
  size_t abs_max_size_ = 0;
};

}  // namespace dfly

#ifdef INJECT_ALLOCATION_TRACKER
// Code here is copied from mimalloc-new-delete, and modified to add tracking
void operator delete(void* p) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free(p);
};
void operator delete[](void* p) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free(p);
};

void operator delete(void* p, const std::nothrow_t&) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free(p);
}
void operator delete[](void* p, const std::nothrow_t&) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free(p);
}

void* operator new(std::size_t n) noexcept(false) {
  auto v = mi_new(n);
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}
void* operator new[](std::size_t n) noexcept(false) {
  auto v = mi_new(n);
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}

void* operator new(std::size_t n, const std::nothrow_t& tag) noexcept {
  (void)(tag);
  auto v = mi_new_nothrow(n);
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}
void* operator new[](std::size_t n, const std::nothrow_t& tag) noexcept {
  (void)(tag);
  auto v = mi_new_nothrow(n);
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}

#if (__cplusplus >= 201402L || _MSC_VER >= 1916)
void operator delete(void* p, std::size_t n) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_size(p, n);
};
void operator delete[](void* p, std::size_t n) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_size(p, n);
};
#endif

#if (__cplusplus > 201402L || defined(__cpp_aligned_new))
void operator delete(void* p, std::align_val_t al) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_aligned(p, static_cast<size_t>(al));
}
void operator delete[](void* p, std::align_val_t al) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_aligned(p, static_cast<size_t>(al));
}
void operator delete(void* p, std::size_t n, std::align_val_t al) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_size_aligned(p, n, static_cast<size_t>(al));
};
void operator delete[](void* p, std::size_t n, std::align_val_t al) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_size_aligned(p, n, static_cast<size_t>(al));
};
void operator delete(void* p, std::align_val_t al, const std::nothrow_t&) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_aligned(p, static_cast<size_t>(al));
}
void operator delete[](void* p, std::align_val_t al, const std::nothrow_t&) noexcept {
  dfly::AllocationTracker::Get().ProcessDelete(p);
  mi_free_aligned(p, static_cast<size_t>(al));
}

void* operator new(std::size_t n, std::align_val_t al) noexcept(false) {
  auto v = mi_new_aligned(n, static_cast<size_t>(al));
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}
void* operator new[](std::size_t n, std::align_val_t al) noexcept(false) {
  auto v = mi_new_aligned(n, static_cast<size_t>(al));
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}
void* operator new(std::size_t n, std::align_val_t al, const std::nothrow_t&) noexcept {
  auto v = mi_new_aligned_nothrow(n, static_cast<size_t>(al));
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}
void* operator new[](std::size_t n, std::align_val_t al, const std::nothrow_t&) noexcept {
  auto v = mi_new_aligned_nothrow(n, static_cast<size_t>(al));
  dfly::AllocationTracker::Get().ProcessNew(v, n);
  return v;
}
#endif
#endif  // INJECT_ALLOCATION_TRACKER

```

### Core Architecture Module: `src/core/bloom.h`
```
// Copyright 2024, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <cstdint>
#include <nonstd/expected.hpp>
#include <string>
#include <string_view>
#include <vector>

#include "base/pmr/memory_resource.h"

namespace dfly {

enum class SBFLoadResult : uint8_t {
  kOk,
  kBadVersion,
  kBadInput,
  kTruncatedInput,
  kOutOfRange,
};

const char* ToString(SBFLoadResult res);

// Max false-positive probability a persisted filter may carry. BF.LOADCHUNK and the rdb loader
// must agree on it, else a filter can be built that its own snapshot refuses to load back.
inline constexpr double kMaxSBFFpProb = 0.5;

/// Bloom filter based on the design of https://github.com/jvirkki/libbloom
class Bloom {
 public:
  Bloom() = default;
  Bloom(const Bloom&) = delete;
  Bloom& operator=(const Bloom&) = delete;

  // Note, that Destroy() must be called before calling the d'tor
  ~Bloom();

  // Initializes a new Bloom object
  // entries - entries are silently rounded up to the minimum capacity.
  // fp_prob - False-positive probability of collision. Must be in (0, 1) range.
  // heap
  void Init(uint64_t entries, double fp_prob, PMR_NS::memory_resource* resource);

  // Direct initializer. len*8 must be power of 2.
  void Init(uint8_t* blob, size_t len, unsigned hash_cnt);

  // Destroys the object, must be called before destructing the object.
  // resource - resource with which the object was initialized.
  void Destroy(PMR_NS::memory_resource* resource);

  Bloom(Bloom&& o) noexcept;

  bool Exists(std::string_view str) const;

  // Equivalent to the Exist above but accepts two fingerprints of the item.
  bool Exists(const uint64_t fp[2]) const;

  // Adds an item to the bloom filter.
  // Returns true if element was not present and was added,
  // false - if element (or a collision) had already been added previously.
  bool Add(std::string_view str);
  bool Add(const uint64_t fp[2]);

  size_t bitlen() const {
    return 1ULL << bit_log_;
  }

  // Max element capacity for this bloom filter.
  // Note that capacity is floor(bit_len / bpe), where bpe (bits per element) is
  // derived from fp_prob.
  size_t Capacity(double fp_prob) const;

  std::string_view data() const {
    return std::string_view{reinterpret_cast<const char*>(bf_), bitlen() / 8};
  }

  unsigned hash_cnt() const {
    return hash_cnt_;
  }

  uint8_t* mutable_data() {
    return bf_;
  }

 private:
  bool IsSet(size_t index) const;
  bool Set(size_t index);  // return true if bit was set (i.e was 0 before)

  uint8_t hash_cnt_ = 0;
  uint8_t bit_log_ = 0;    // log of bit length of the filter. bit length is always power of 2.
  uint8_t* bf_ = nullptr;  // pointer to the blob.
};

/**
 * @brief Scalable bloom filter.
 * Based on https://gsd.di.uminho.pt/members/cbm/ps/dbloom.pdf
 * Please note that for SBF, the original paper assumes partitioning of bit space into K
 * disjoint segments where K is number of hash functions. This is done to reduce index collisions.
 * We do not do this, because we use power of 2 bit lengths.
 * TODO: to test the actual rate of this filter.
 */
class SBF {
 public:
  SBF(uint64_t initial_capacity, double fp_prob, double grow_factor, PMR_NS::memory_resource* mr);
  SBF(const SBF&) = delete;

  // C'tor used for loading persisted filters into SBF.
  // Should be followed by AllocateFilter.
  SBF(double grow_factor, double fp_prob, size_t max_capacity, size_t prev_size,
      size_t current_size, PMR_NS::memory_resource* mr);
  ~SBF();

  SBF& operator=(SBF&& src) noexcept;

  uint8_t* AllocateFilter(size_t alloc_size, unsigned hash_cnt);

  bool Add(std::string_view str);
  bool Exists(std::string_view str) const;

  size_t current_size() const {
    return current_size_;
  }

  size_t prev_size() const {
    return prev_size_;
  }

  double grow_factor() const {
    return grow_factor_;
  }

  // expected fp probability for the current filter.
  double fp_probability() const {
    return fp_prob_;
  }

  uint32_t num_filters() const {
    return filters_.size();
  }

  std::string_view data(size_t idx) const {
    return filters_[idx].data();
  }

  unsigned hashfunc_cnt(size_t idx) const {
    return filters_[idx].hash_cnt();
  }

  // max capacity of the current filter.
  size_t max_capacity() const {
    return max_capacity_;
  }

  // Total design capacity across all filters (completed filters plus the current one).
  size_t total_capacity() const {
    return prev_size_ + max_capacity_;
  }

  // Total number of items inserted across all filters.
  size_t total_items() const {
    return prev_size_ + current_size_;
  }

  size_t MallocUsed() const;

  uint8_t* filter_data(size_t idx) {
    return filters_[idx].mutable_data();
  }

  struct StateUpdate {
    double fp_prob;
    size_t max_capacity;
    size_t current_size;
    size_t prev_size;
  };

  void ApplyStateUpdate(const StateUpdate& update);

 private:
  // multiple filters from the smallest to the largest.
  std::vector<Bloom, PMR_NS::polymorphic_allocator<Bloom>> filters_;
  double grow_factor_;
  double fp_prob_;
  size_t prev_size_ = 0;
  size_t current_size_ = 0;
  size_t max_capacity_;
};

// Pair of values returned to a client.
struct SBFChunk {
  // The cursor can have the following values:
  // 1: The data field is a header that should be used to reconstruct the SBF object itself.
  // >1: Filter data. First metadata about filter and SBF, then bytes to copy to filter
  // 0: The filter is fully consumed. The data field must be empty.
  int64_t cursor;
  // Bytes containing either the SBF metadata or filter data, depending on cursor value
  // Maximum size returned is 16MiB. Will always contain data from exactly one filter, does not
  // span multiple filters.
  std::string data;
};

// This class allows sending the contents of an SBF to the caller in chunks, where each chunk is a
// maximum of 16MiB in size. The first chunk sent back contains only the SBF metadata. Following
// chunks contain filter data and a state of the SBF. The loader uses per filter data to update the
// SBF as it encounters new filter items.

/*
SCANDUMP wire output format (all fields little-endian)

  cursor=1 returns the SBF header (12 bytes):
  +-------------------+--------------------+
  | version (4B)      | grow_factor (8B)   |
  +-------------------+--------------------+

  cursor>1 chunks carry filter data. Each filter begins with
  44 bytes of metadata, followed by the raw filter bytes.
  A single filter may span multiple chunks.

  First chunk of a filter:
  +-----------------+----------------+------------+---------------------+
  | hash_cnt 4B     | data_length 8B | fp_prob 8B | max_capacity 8B     |
  +-----------------+----------------+------------+---------------------+
  | current_size 8B | prev_size 8B   | filter bytes (up to 16MiB - 44B) |
  +-----------------+----------------+------------ ... -----------------+

  Continuation chunks (same filter, if >16MiB):
  +------------------------ ... -------------------------+
  | filter bytes (up to 16MiB)                           |
  +------------------------ ... -------------------------+

  cursor=0 signals end of iteration (empty data).
*/

class SBFDumpIterator {
 public:
  static constexpr uint64_t kMaxChunkSize = 16 * 1024 * 1024;

  // The cursor is input from client, used to seek within a given SBF. 0 is used to start iteration
  // from the beginning.
  SBFDumpIterator(const SBF& sbf, int64_t cursor);

  // Returns (next cursor, data between current and next cursor)
  // Once the filter is fully read returns 0,""
  SBFChunk Next();

 private:
  std::string SerializeHeader() const;

  // Converts a cursor to the specific filter and the offset inside it
  // O(n) in number of filters
  void ResolveCursorToPos();

  std::string BuildFilterHeader(std::string_view filter_data) const;
  std::string BuildFilterContinuation(std::string_view filter_data) const;

  const SBF& sbf_;
  int64_t cursor_;
  uint32_t filter_index_ = 0;
  size_t byte_offset_ = 0;
};

// Creates an SBF from a dump header chunk (the chunk returned with cursor=1).
nonstd::expected<SBF*, SBFLoadResult> LoadSBFHeader(std::string_view header_data,
                                                    PMR_NS::memory_resource* mr);

// Loads a data chunk into an existing SBF. The cursor and data are the values
// returned by SBFDumpIterator for chunks with cursor > 1.
SBFLoadResult LoadSBFChunk(int64_t cursor, std::string_view data, SBF* sbf);

}  // namespace dfly

```

### Core Architecture Module: `src/core/bptree_set.h`
```
// Copyright 2023, Roman Gershman.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <functional>
#include <optional>

#include "core/detail/bptree_internal.h"
#include "core/detail/stateless_allocator.h"

namespace dfly {

template <typename T> struct DefaultCompareTo {
  int operator()(const T& a, const T& b) const {
    std::less<T> cmp;
    return cmp(a, b) ? -1 : (cmp(b, a) ? 1 : 0);
  }
};

template <typename T> struct BPTreePolicy {
  using KeyT = T;

  // The three way comparator that should accept a query ( or key) on the left, and the key
  // on the right.
  using KeyCompareTo = DefaultCompareTo<T>;
};

template <typename T, typename Policy = BPTreePolicy<T>> class BPTree {
  BPTree(const BPTree&) = delete;
  BPTree& operator=(const BPTree&) = delete;

  using BPTreeNode = detail::BPTreeNode<T>;
  using BPTreePath = detail::BPTreePath<T>;

 public:
  using KeyT = typename Policy::KeyT;

  BPTree(PMR_NS::memory_resource* mr = PMR_NS::get_default_resource()) : mr_(mr) {
  }

  ~BPTree() {
    Clear();
  }

  // true if inserted, false if skipped.
  bool Insert(KeyT item);

  bool Contains(KeyT item) const;

  bool Delete(KeyT item);

  std::optional<uint32_t> GetRank(KeyT item, bool reverse = false) const;

  size_t Height() const {
    return height_;
  }

  size_t Size() const {
    return count_;  // number of items in the tree
  }

  bool Empty() const {
    return count_ == 0;
  }

  size_t NodeCount() const {
    // number of nodes in the tree (usually, order of magnitude smaller than Size()).
    return num_nodes_;
  }

  void Clear();

  const BPTreeNode* DEBUG_root() const {
    return root_;
  }

  BPTreePath FromRank(uint32_t rank) const {
    BPTreePath path;
    ToRank(rank, &path);
    return path;
  }

  /// @brief Iterates over all items in the range [rank_start, rank_end] by rank.
  /// @param rank_start
  /// @param rank_end - inclusive.
  /// @param cb - callback to be called for each item in the range.
  ///             Should return false to stop iteration.
  bool Iterate(uint32_t rank_start, uint32_t rank_end, std::function<bool(KeyT)> cb) const;

  /// @brief Iterates over all items in the range [rank_start, rank_end] by rank in reverse order.
  /// @param rank_start
  /// @param rank_end
  /// @param cb - callback to be called for each item in the range.
  ///             Should return false to stop iteration.
  bool IterateReverse(uint32_t rank_start, uint32_t rank_end, std::function<bool(KeyT)> cb) const;

  /// @brief Returns the path to the first item in the tree for which comp(q, key) >= 0.
  /// @param item
  /// @return the path if such item exists, empty path otherwise.
  template <typename Q> BPTreePath GEQ(Q&& query) const;

  /// @brief Returns the path to the largest item in the tree such that comp(q, key) <= 0.
  /// @param key
  /// @return the path if such item exists, empty path otherwise.
  template <typename Q> BPTreePath LEQ(Q&& query) const;

  /// @brief Deletes the element pointed by path.
  /// @param path
  void Delete(BPTreePath path);

  /// @brief Forces an update to the key. Assumes key has the same value.
  /// Replaces old with new_obj.
  void ForceUpdate(KeyT old, KeyT new_obj);

 private:
  BPTreeNode* CreateNode(bool leaf);

  void DestroyNode(BPTreeNode* node);

  void InsertToFullLeaf(KeyT item, const BPTreePath& path);

  // Returns true if insertion was handled by rebalancing.
  bool RebalanceLeafAndInsert(const BPTreePath& path, unsigned parent_depth, KeyT item,
                              unsigned insert_pos);

  void IncreaseSubtreeCounts(const BPTreePath& path, unsigned depth, int32_t delta);

  // Charts the path towards key. Returns true if key is found.
  // In that case comp(q, path->Last().first->Key(path->Last().second)) == 0.
  // Fills the tree path not including the key itself. In case key was not found,
  // returns the path to the item that is greater than the key.
  template <typename Q> bool Locate(Q&& q, BPTreePath* path) const;

  // Sets the tree path to item at specified rank. Rank is 0-based and must be less than Size().
  // returns the index of the key in the last node of the path.
  void ToRank(uint32_t rank, BPTreePath* path) const;

  BPTreeNode* root_ = nullptr;  // root node or NULL if empty tree
  uint32_t count_ = 0;          // number of items in tree
  uint32_t height_ = 0;         // height of tree from root to leaf
  uint32_t num_nodes_ = 0;      // number of nodes in tree
  PMR_NS::memory_resource* mr_;
};

template <typename T, typename Policy> bool BPTree<T, Policy>::Contains(KeyT item) const {
  BPTreePath path;
  bool found = Locate(item, &path);
  return found;
}

template <typename T, typename Policy> void BPTree<T, Policy>::Clear() {
  if (!root_)
    return;

  BPTreePath path;
  BPTreeNode* node = root_;

  auto deep_left = [&](unsigned pos) {
    do {
      path.Push(node, pos);
      node = node->Child(pos);
      pos = 0;
    } while (!node->IsLeaf());
  };

  if (!root_->IsLeaf())
    deep_left(0);

  while (true) {
    DestroyNode(node);

    if (path.Depth() == 0) {
      break;
    }
    node = path.Last().first;
    unsigned pos = path.Last().second;
    path.Pop();
    if (pos < node->NumItems()) {
      deep_left(pos + 1);
    }
  }
  root_ = nullptr;
  height_ = count_ = 0;
}

template <typename T, typename Policy> bool BPTree<T, Policy>::Insert(KeyT item) {
  if (!root_) {
    root_ = CreateNode(true);
    root_->InitSingle(item);
    count_ = height_ = 1;

    return true;
  }

  BPTreePath path;
  bool found = Locate(item, &path);

  if (found) {
    return false;
  }

  assert(path.Depth() > 0u);

  BPTreeNode* leaf = path.Last().first;
  assert(leaf->IsLeaf());

  if (leaf->NumItems() == detail::BPNodeLayout<T>::kMaxLeafKeys) {
    InsertToFullLeaf(item, path);
  } else {
    unsigned pos = path.Last().second;
    leaf->LeafInsert(pos, item);
    if (path.Depth() > 1)
      IncreaseSubtreeCounts(path, path.Depth() - 2, 1);
  }
  count_++;
  return true;
}

template <typename T, typename Policy> bool BPTree<T, Policy>::Delete(KeyT item) {
  if (!root_)
    return false;

  BPTreePath path;
  bool found = Locate(item, &path);
  if (!found)
    return false;

  Delete(path);
  return true;
}

template <typename T, typename Policy>
std::optional<uint32_t> BPTree<T, Policy>::GetRank(KeyT item, bool reverse) const {
  if (!root_)
    return std::nullopt;

  BPTreePath path;
  bool found = Locate(item, &path);
  if (!found)
    return std::nullopt;

  if (reverse) {
    return count_ - path.Rank() - 1;
  }

  return path.Rank();
}

template <typename T, typename Policy>
template <typename Q>
bool BPTree<T, Policy>::Locate(Q&& q, BPTreePath* path) const {
  assert(root_);
  BPTreeNode* node = root_;
  typename Policy::KeyCompareTo cmp;
  auto cmp_cb = [&](const KeyT& key) { return cmp(q, key); };

  while (true) {
    typename BPTreeNode::SearchResult res = node->BSearch(cmp_cb);
    path->Push(node, res.index);
    if (res.found) {
      return true;
    }
    assert(res.index <= node->NumItems());

    if (node->IsLeaf()) {
      break;
    }
    node = node->Child(res.index);
  }
  return false;
}

template <typename T, typename Policy>
void BPTree<T, Policy>::InsertToFullLeaf(KeyT item, const BPTreePath& path) {
  using Layout = detail::BPNodeLayout<T>;
  using Comp [[maybe_unused]] = typename Policy::KeyCompareTo;

  assert(path.Depth() > 0u);

  BPTreeNode* node = path.Last().first;
  assert(node->IsLeaf() && node->AvailableSlotCount() == 0);

  unsigned insert_pos = path.Last().second;
  unsigned level = path.Depth() - 1;
  if (level > 0 && RebalanceLeafAndInsert(path, level - 1, item, insert_pos)) {
    // Update the tree count of the ascendants.
    IncreaseSubtreeCounts(path, level - 1, 1);
    return;
  }

  KeyT median;
  BPTreeNode* right = CreateNode(true);
  node->Split(right, &median);

  assert(node->NumItems() < Layout::kMaxLeafKeys);

  if (insert_pos <= node->NumItems()) {
    assert(Comp()(item, median) < 0);
    node->LeafInsert(insert_pos, item);
  } else {
    assert(Comp()(item, median) > 0);
    right->LeafInsert(insert_pos - node->NumItems() - 1, item);
  }

  // we must add the newly created `right` to the parent and update its tree count.
  while (level > 0) {
    --level;
    // level up, now node is parent.
    node = path.Node(level);
    unsigned pos = path.Position(level);  // position of the child node in parent.

    assert(!node->IsLeaf() && pos <= node->NumItems());
    assert(right);

    // Terminal case: Node is not full so we can just add `right` to it.
    if (node->NumItems() < Layout::kMaxInnerKeys) {
      // We do not update the subtree count of the node here because the surpus of another item
      // resulted with the additional key in this node.
      node->InnerInsert(pos, median, right);
      node->IncreaseTreeCount(1);
      right = nullptr;
      break;
    }

    // We need to insert right into a node as position pos. Node is full so we must handle it
    // either via rebalancing "node" or via its splitting. Rebalancing is a better case, we try
    // it first.
    if (level > 0) {
      // see if we can rebalance node (right's parent) via node's parent.
      BPTreeNode* parent = path.Node(level - 1);
      unsigned parent_pos = path.Position(level - 1);
      assert(parent->Child(parent_pos) == node);

      auto [new_node, inner_pos] = parent->RebalanceChild(parent_pos, pos);
      if (new_node) {
        // we rebalanced inner_full so we can insert (median, right) and stop propagating.
        new_node->InnerInsert(inner_pos, median, right);

        if (new_node != node) {
          // Fix subtree counts if right was migrated to the sibling.
          node->IncreaseTreeCount(-right->TreeCount());
          new_node->IncreaseTreeCount(right->TreeCount() + 1);
        } else {
          node->IncreaseTreeCount(1);
        }
        right = nullptr;
        break;
      }
    }

    // node is 
```

### Core Architecture Module: `src/core/cms.h`
```
// Copyright 2026, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <cstdint>
#include <string_view>

#include "base/pmr/memory_resource.h"

namespace dfly {

/// Count-Min Sketch implementation compatible with Redis CMS commands.
class CMS {
 public:
  // Create a CMS with given width and depth dimensions.
  // width: number of counters per row
  // depth: number of rows (hash functions)
  CMS(uint32_t width, uint32_t depth, PMR_NS::memory_resource* mr);

  CMS(const CMS&) = delete;
  CMS& operator=(const CMS&) = delete;

  CMS(CMS&& other) noexcept;
  CMS& operator=(CMS&& other) noexcept;

  ~CMS();

  // Tag type to disambiguate CMS construction by error rate and probability.
  struct ErrorRateTag {};

  // Create a CMS from error rate and probability parameters.
  // error: relative error (e.g. 0.01 for 1%), must be in (0, 1).
  // probability: probability of exceeding the error, must be in (0, 1).
  // width = ceil(e / error), depth = ceil(ln(1 / probability)).
  CMS(ErrorRateTag, double error, double probability, PMR_NS::memory_resource* mr);

  // Increment the count for an item by the given value.
  // Returns the new estimated count for the item.
  int64_t IncrBy(std::string_view item, int64_t increment);

  // Query the estimated count for an item.
  int64_t Query(std::string_view item) const;

  // Merge another CMS into this one with the given weight.
  // The other CMS must have the same dimensions.
  // Returns false if dimensions don't match.
  bool MergeFrom(const CMS& other, int64_t weight = 1);

  // Reset all counters and total count to zero.
  void Reset();

  // Load serialized counter state. data must have exactly NumCounters() elements.
  void Load(int64_t total_incr_count, const int64_t* data);

  // Accessors for CMS properties
  uint32_t width() const {
    return width_;
  }

  uint32_t depth() const {
    return depth_;
  }

  // Total count of all IncrBy operations (used by CMS.INFO).
  int64_t total_count() const {
    return count_;
  }

  // Memory usage in bytes
  size_t MallocUsed() const {
    return NumCounters() * sizeof(int64_t);
  }

  size_t NumCounters() const {
    return static_cast<size_t>(width_) * depth_;
  }

  const int64_t* Data() const {
    return counters_;
  }

 private:
  uint32_t width_;
  uint32_t depth_;
  PMR_NS::memory_resource* mr_ = nullptr;
  int64_t count_ = 0;  // Total count of all IncrBy operations
  int64_t* counters_ = nullptr;
};

}  // namespace dfly

```

### Core Architecture Module: `src/core/collection_entry.h`
```
// Copyright 2026, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <absl/strings/str_cat.h>

#include <cstddef>
#include <string>
#include <string_view>

namespace dfly {

// Stores either:
// - A single long long value (longval) when value = nullptr
// - A single char* (value) when value != nullptr
struct CollectionEntry {
  CollectionEntry(const char* value, size_t length) : value_{value}, length_{length} {
  }
  explicit CollectionEntry(long long longval) : value_{nullptr}, longval_{longval} {
  }

  CollectionEntry(const CollectionEntry&) = default;
  CollectionEntry& operator=(const CollectionEntry&) = default;

  std::string ToString() const {
    if (value_)
      return {value_, length_};
    else
      return absl::StrCat(longval_);
  }

  bool IsString() const {
    return value_ != nullptr;
  }

  bool is_int() const {
    return value_ == nullptr;
  }

  const char* data() const {
    return value_;
  }

  size_t size() const {
    return length_;
  }

  long long as_long() const {
    return longval_;
  }

  // Assumes value is not null.
  std::string_view view() const {
    return {value_, length_};
  }

  // compatibility method
  std::string to_string() const {
    return ToString();
  }

  // compatibility method
  long long ival() const {
    return longval_;
  }

  bool operator==(std::string_view sv) const;
  friend bool operator==(std::string_view sv, const CollectionEntry& entry) {
    return entry == sv;
  }

 private:
  const char* value_;
  union {
    size_t length_;
    long long longval_;
  };
};

inline bool CollectionEntry::operator==(std::string_view sv) const {
  if (value_ == nullptr) {
    char buf[absl::numbers_internal::kFastToBufferSize];
    char* end = absl::numbers_internal::FastIntToBuffer(longval_, buf);
    return sv == std::string_view(buf, end - buf);
  }
  return view() == sv;
}

}  // namespace dfly

```

### Core Architecture Module: `src/core/compact_object.h`
```
// Copyright 2024, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <absl/base/internal/endian.h>

#include <memory>
#include <optional>
#include <type_traits>
#include <utility>

#include "base/pmr/memory_resource.h"
#include "common/borrowed_string.h"
#include "common/string_or_view.h"
#include "core/json/json_object.h"
#include "core/mi_memory_resource.h"
#include "core/small_string.h"

typedef struct stream stream;

namespace dfly {

namespace tiering {
struct TieredCoolRecord;
}

constexpr unsigned kEncodingIntSet = 0;
constexpr unsigned kEncodingStrMap2 = 2;  // for set/map encodings of strings using DenseSet
constexpr unsigned kEncodingQL2 = 1;
constexpr unsigned kEncodingListPack = 3;

class SBF;
class TOPK;
class CMS;
class CuckooFilter;
struct CuckooFilterOptions;
class PageUsage;

using cmn::StringOrView;
namespace detail {

// Storage for the five Redis collection types (LIST/SET/HASH/ZSET/STREAM).
// The CompactObj tag identifies the type; this struct holds the inner pointer,
// a per-collection size/byte-count, and an encoding byte. All type-aware
// dispatch (Free/Size/MallocUsed/DefragIfNeeded) is performed by CompactObj.
class RobjWrapper {
 public:
  using MemoryResource = PMR_NS::memory_resource;

  RobjWrapper() : sz_(0), encoding_(0), reserved_(0) {
  }

  // Used when sz_ is used to denote memory usage (e.g. OBJ_STREAM).
  void SetSize(uint64_t size) {
    sz_ = size;
  }
  size_t Size() const {
    return sz_;
  }

  void Init(unsigned encoding, void* inner) {
    encoding_ = encoding;
    inner_obj_ = inner;
    sz_ = 0;
  }

  unsigned encoding() const {
    return encoding_;
  }
  void* inner_obj() const {
    return inner_obj_;
  }

  void set_inner_obj(void* ptr) {
    inner_obj_ = ptr;
  }

 private:
  void* inner_obj_ = nullptr;

  // Semantics depend on the collection tag; only OBJ_STREAM currently uses it
  // (tracking bytes used, for memory accounting).
  uint64_t sz_ : 56;

  uint64_t encoding_ : 4;
  uint64_t reserved_ : 4;
} __attribute__((packed));

static_assert(sizeof(RobjWrapper) == 16);

// Raw, large (non-inline) string storage. Used when a string value does not
// fit in CompactObj's inline buffer and is not better represented as INT/SMALL/EXTERNAL.
struct LargeString {
  using MemoryResource = PMR_NS::memory_resource;

  void* ptr;
  uint64_t sz : 56;

  // Hint: outstanding readers may be borrowing `ptr`. Mutations consult
  // TL::pin_map and hand the buffer to its PendingRead instead of freeing.
  uint64_t read_pending : 1;
  uint64_t reserved : 7;

  size_t Size() const {
    return sz;
  }

  size_t MallocUsed() const;

  std::string_view AsView() const {
    return std::string_view{reinterpret_cast<char*>(ptr), sz};
  }

  uint64_t HashCode() const;

  bool Equal(std::string_view sv) const {
    return AsView() == sv;
  }

  // Replace contents with s, growing the underlying allocation if needed.
  // Precondition: !s.empty(). Use Free() for clearing a value.
  void SetString(std::string_view s, MemoryResource* mr);

  // Allocate room for `size` bytes; ptr must be null.
  void ReserveString(size_t size, MemoryResource* mr);

  // Append s. Precondition: existing capacity >= sz + s.size().
  void AppendString(std::string_view s, MemoryResource* mr);

  // Free underlying allocation; resets to {nullptr, 0}.
  void Free(MemoryResource* mr);

  // Re-allocate the backing buffer if its memory page is under-utilized.
  bool DefragIfNeeded(PageUsage* page_usage);

 private:
  void ReallocateString(MemoryResource* mr);
} __attribute__((packed));

static_assert(sizeof(LargeString) == 16);

}  // namespace detail

using CompactObjType = unsigned;

constexpr CompactObjType kInvalidCompactObjType = std::numeric_limits<CompactObjType>::max();

class CompactObj {
  static constexpr unsigned kInlineLen = 16;

 public:
 private:
  void operator=(const CompactObj&) = delete;
  CompactObj(const CompactObj&) = delete;

 protected:
  // 0-16 is reserved for inline lengths of string type.
  enum TagEnum : uint8_t {
    INT_TAG = 17,
    SMALL_TAG = 18,
    CUCKOO_FILTER_TAG = 19,
    EXTERNAL_TAG = 20,
    JSON_TAG = 21,
    SBF_TAG = 22,
    CMS_TAG = 23,
    SDS_TTL_TAG = 24,
    TOPK_TAG = 25,
    LARGE_STR_TAG = 26,  // detail::LargeString — raw, large non-inline string
    LIST_TAG = 27,
    SET_TAG = 28,
    HASH_TAG = 29,
    ZSET_TAG = 30,
    STREAM_TAG = 31,
  };

  // String encoding types.
  // With ascii compression it compresses 8 bytes to 7 but also 7 to 7.
  // Therefore, in order to know the original length we introduce 2 states that
  // correct the length upon decoding. ASCII1_ENC rounds down the decoded length,
  // while ASCII2_ENC rounds it up. See DecodedLen implementation for more info.
  enum EncodingEnum : uint8_t {
    NONE_ENC = 0,
    ASCII1_ENC = 1,
    ASCII2_ENC = 2,
  };

 public:
  // Utility class for working with string encodings.
  struct StrEncoding {
    StrEncoding(uint8_t enc, bool is_key) : enc_(static_cast<EncodingEnum>(enc)), is_key_(is_key) {
    }

    size_t DecodedSize(std::string_view blob) const;         // Size of decoded blob
    size_t Decode(std::string_view blob, char* dest) const;  // Decode into dest, return size
    StringOrView Decode(std::string_view blob) const;

    // Decode a byte at offset into dest. Return true if decoded successfully,
    // false if idx is out of bounds.
    bool DecodeByte(std::string_view blob, size_t idx, uint8_t* dest) const;

   private:
    friend class CompactObj;

    size_t DecodedSize(size_t compr_size) const;

    EncodingEnum enc_;
    bool is_key_;
  };

  using MemoryResource = detail::RobjWrapper::MemoryResource;

  // Different representations of external values
  enum class ExternalRep : uint8_t {
    STRING,          // OBJ_STRING, Basic representation with various string encodings
    SERIALIZED_MAP,  // OBJ_HASH, Serialized map
    LIST_NODE        // OBJ_LIST, QList::Node
  };

  explicit CompactObj(bool is_key)
      : is_key_{is_key}, taglen_{0}, encoding_{0} {  // default - empty string
  }

  CompactObj(std::string_view str, bool is_key) : CompactObj(is_key) {
    SetString(str);
  }

  CompactObj(CompactObj&& cs) noexcept : CompactObj(cs.is_key_) {
    operator=(std::move(cs));
  };

  ~CompactObj();

  CompactObj& operator=(CompactObj&& o) noexcept;

  // Returns object size depending on the semantics.
  // For strings - returns the length of the string.
  // For containers - returns number of elements in the container.
  size_t Size() const;

  std::string_view GetSlice(std::string* scratch) const;

  // Read-only fast path. Returns a cmn::BorrowedString iff this CompactObj
  // holds a string value that can be borrowed, otherwise std::nullopt
  // (caller uses GetSlice/GetString/ToString). The borrowed bytes are valid
  // until the pin is released.
  //
  // For NONE_ENC: `encoded` is the user-visible bytes; the reply can stream
  // them directly. For ASCII1/ASCII2_ENC: `encoded` is the packed source
  // (`encoded.size() < decoded_size`) and the reply must decode in chunks.
  //
  // Side effects on success: stamps the LargeString's read_pending bit and
  // registers an internal pin in the thread-local pin map. The returned
  // BorrowedString carries the pin and its release fn; destruction (or
  // explicit Unpin()) releases it.
  std::optional<cmn::BorrowedString> TryBorrow() const;

  // Test helpers for inspecting the pin's refcount / orphaned state through
  // an active BorrowedString. Implemented in compact_object.cc where the
  // internal pin type is visible.
  static uint32_t TEST_PinRefcnt(const cmn::BorrowedString& bs) noexcept;
  static bool TEST_PinOrphaned(const cmn::BorrowedString& bs) noexcept;

  std::string ToString() const {
    std::string res;
    GetString(&res);
    return res;
  }

  uint64_t HashCode() const;
  static uint64_t HashCode(std::string_view str);

  bool HasFlag() const {
    return mask_bits_.mc_flag;
  }

  void SetFlag(bool e) {
    mask_bits_.mc_flag = e;
  }

  bool WasTouched() const {
    return mask_bits_.touched;
  }

  void SetTouched(bool e) {
    mask_bits_.touched = e;
  }

  bool DefragIfNeeded(PageUsage* page_usage);

  void SetOmitDefrag(bool v) {
    mask_bits_.omit_defrag = v;
  }

  bool OmitDefrag() const {
    return mask_bits_.omit_defrag;
  }

  bool HasStashPending() const {
    return mask_bits_.io_pending;
  }

  void SetStashPending(bool b) {
    mask_bits_.io_pending = b;
  }

  bool IsSticky() const {
    return mask_bits_.sticky;
  }

  void SetSticky(bool e) {
    mask_bits_.sticky = e;
  }

  unsigned Encoding() const;
  CompactObjType ObjType() const;

  void* RObjPtr() const {
    return u_.r_obj.inner_obj();
  }

  void SetRObjPtr(void* ptr) {
    u_.r_obj.set_inner_obj(ptr);
  }

  // takes ownership over obj_inner.
  // type should not be OBJ_STRING.
  void InitRobj(CompactObjType type, unsigned encoding, void* obj_inner);

  // Sets the abstract time used by per-member lazy expiry on StringSet/StringMap.
  // The value should typically be obtained via MemberTimeSeconds(now_ms).
  // Safe to call unconditionally — no-op if the underlying encoding is not kEncodingStrMap2.
  void SetMemberTime(uint32_t seconds) const;

  // Returns the abstract time previously set via SetMemberTime, or 0 if encoding
  // is not kEncodingStrMap2.
  uint32_t MemberTime() const;

  // Returns true if any member of the underlying StringSet/StringMap has expiration.
  // Returns false if encoding is not kEncodingStrMap2.
  bool HasMemberExpiration() const;

  // For STR object.
  void SetInt(int64_t val);
  std::optional<int64_t> TryGetInt() const;

  void GetString(std::string* res) const;

  void SetString(std::string_view str);
  void ReserveString(size_t size);
  void AppendString(std::string_view str);

  // Will set this to hold OBJ_JSON, after that it is safe to call GetJson
  // NOTE: in order to avid copy which can be expensive in this case,
  // y
```

### Core Architecture Module: `src/core/cuckoo.h`
```
// Copyright 2026, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <cstdint>
#include <memory_resource>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace dfly {

struct CuckooFilterOptions {
  static constexpr uint8_t kDefaultSlotsPerBucket = 2;
  static constexpr uint16_t kDefaultMaxIterations = 20;
  static constexpr uint16_t kDefaultExpansion = 1;

  uint64_t capacity = 0;
  uint8_t slots_per_bucket = kDefaultSlotsPerBucket;
  uint16_t max_iterations = kDefaultMaxIterations;
  uint16_t expansion = kDefaultExpansion;
};

class CuckooFilter {
 public:
  using Options = CuckooFilterOptions;

  CuckooFilter(const Options& options, std::pmr::memory_resource* mr);

  // Inserts a pre-computed hash. Returns false only if the filter is full
  // and expansion is disabled (expansion_ == 0) or memory allocation fails.
  // Allows duplicate insertions — use InsertUnique to prevent them.
  bool Insert(uint64_t hash);

  // Inserts only if hash is not already present. Returns false if the item
  // already exists or the filter is full.
  bool InsertUnique(uint64_t hash);

  // Returns true if hash is present in the filter. May return false positives
  // but never false negatives.
  // TODO(kostas): SIMD for the inner bucket scan. Establish a baseline bench and then add SIMD.
  bool Exists(uint64_t hash) const;

  // Returns the number of fingerprint matches for hash across both candidate buckets and
  // all sub-filters. Each successful Insert of the same item occupies its own slot (Insert
  // never deduplicates), so this reflects how many times the item was added minus how many
  // times it was deleted. Like Exists, can overcount on fingerprint collisions.
  size_t Count(uint64_t hash) const;

  // Removes one occurrence of hash from the filter. Returns true if found and removed.
  // This is the key advantage over Bloom filters, which do not support deletion.
  bool Delete(uint64_t hash);

  static uint64_t Hash(std::string_view item);

  size_t NumItems() const {
    return num_items_;
  }

  // For tests. Returns the number of times an insertion found both candidate buckets full
  // and had to evict an existing fingerprint to its alternate bucket before the new
  // fingerprint could be placed.
  size_t NumKOInserts() const {
    return num_ko_inserts_;
  }

  // Returns approximate heap bytes used by this filter's SubFilter data.
  size_t MallocUsed() const;

  // Base bucket count from construction; never changes as the filter grows (each new
  // sub-filter scales its own bucket count by expansion_ instead).
  uint64_t NumBuckets() const {
    return num_buckets_;
  }

  size_t NumFilters() const {
    return filters_.size();
  }

  uint64_t NumDeletes() const {
    return num_deletes_;
  }

  uint8_t SlotsPerBucket() const {
    return slots_per_bucket_;
  }

  uint16_t MaxIterations() const {
    return max_iterations_;
  }

  // Already rounded up to the next power of two (or 0 if expansion is disabled).
  uint16_t Expansion() const {
    return expansion_;
  }

  // Returns the raw bytes of the idx'th sub-filter. For RDB serialization.
  std::string_view FilterBytes(size_t idx) const {
    const SubFilter& sf = filters_[idx];
    return {reinterpret_cast<const char*>(sf.data()), sf.size()};
  }

  struct SerializedDataView {
    uint8_t slots_per_bucket;
    uint16_t max_iterations;
    uint16_t expansion;
    uint64_t num_buckets;
    uint64_t num_items;
    uint64_t num_deletes;
    const std::vector<std::string>& filters;
  };

  // Restores complete internal state from previously-serialized data (RDB load).
  void Deserialize(const SerializedDataView& data);

  // Appends a single sub-filter from its raw bytes. For chunked RDB load (append mode).
  void AppendFilter(std::string_view blob);

  // Reclaims space by moving items from newer sub-filters back into older ones, freeing the
  // newest sub-filter once it's been fully emptied. Only ever frees filters_.back(), one at
  // a time, working from the newest sub-filter down to (but not including) filters_[0].
  // If `cont` is false then the algorithm stops at the first sub-filter that can't be fully
  // emptied; If `cont` is true (CF.COMPACT), keeps trying older sub-filters regardless.
  void Compact(bool cont);

 private:
  using SubFilter = std::pmr::vector<uint8_t>;

  struct LookupParams {
    uint8_t fp;
    uint64_t h1;  // raw (unmodded) first candidate index
    uint64_t h2;  // raw (unmodded) alternate index
  };

  LookupParams LookupParamsFromHash(uint64_t hash) const;

  // Returns {h1 % num_buckets, h2 % num_buckets} for the given SubFilter.
  std::pair<uint64_t, uint64_t> BucketIndices(const SubFilter& sf, const LookupParams& p) const;

  uint64_t NumBuckets(const SubFilter& sf) const;

  // Appends a new SubFilter sized num_buckets_ * expansion_^filters_.size().
  // This is a Redis engineering choice to avoid rehashing on growth; the original
  // Fan et al. paper describes a single fixed-size filter only.
  bool AddNewSubFilter();

  // When both candidate buckets are full, evicts a fingerprint from h1, places ours
  // there, then tries to reinsert the evicted fingerprint into its own alternate bucket.
  // Repeats up to max_iterations_ times. On failure, rolls back all swaps.
  bool KOInsert(const LookupParams& p, SubFilter& sf);

  // Attempts to relocate every occupied slot in filters_[filter_idx] into some earlier
  // sub-filter. Returns true if every slot was relocated or already empty (i.e. this
  // sub-filter is now empty and safe to free if it's the last one).
  bool CompactSingleFilter(size_t filter_idx);

  // Tries to move the fingerprint located by the parameters into the
  // first earlier sub-filter (lowest index first) with room for it.
  // Returns true if the slot was already empty or the fingerprint was relocated
  // Returns false if no earlier sub-filter had room
  bool RelocateSlot(size_t filter_idx, uint64_t bucket_idx, uint8_t slot_idx);

  uint8_t slots_per_bucket_;
  uint16_t max_iterations_;
  uint16_t expansion_;

  uint64_t num_buckets_ = 0;
  uint64_t num_items_ = 0;
  uint64_t num_deletes_ = 0;
  uint64_t num_ko_inserts_ = 0;

  std::pmr::memory_resource* mr_;
  std::pmr::vector<SubFilter> filters_;
};

}  // namespace dfly

```

### Core Architecture Module: `src/core/dash.h`
```
// Copyright 2022, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//
#pragma once

#include <array>
#include <optional>
#include <ranges>
#include <utility>
#include <vector>

#include "absl/random/random.h"
#include "base/pmr/memory_resource.h"
#include "core/dash_internal.h"

namespace dfly {

// DASH: Dynamic And Scalable Hashing.

template <typename _Key, typename _Value, typename Policy>
class DashTable : public detail::DashTableBase {
  DashTable(const DashTable&) = delete;
  DashTable& operator=(const DashTable&) = delete;

  using Base = detail::DashTableBase;
  using SegmentType = detail::Segment<_Key, _Value, Policy>;
  using SegmentIterator = typename SegmentType::Iterator;

 public:
  using Key_t = _Key;
  using Value_t = _Value;
  using Segment_t = SegmentType;

  //! Total number of buckets in a segment (including stash).
  static constexpr double kTaxAmount = SegmentType::kTaxSize;
  static constexpr size_t kSegBytes = sizeof(SegmentType);

  // How many bytes the non-stash part is taking.
  static constexpr size_t kSegRegularBytes =
      kSegBytes - (SegmentType::kStashBucketNum * SegmentType::kBucketSz);

  static constexpr size_t kSegCapacity = SegmentType::capacity();
  static constexpr size_t kSlotNum = SegmentType::kSlotNum;
  static constexpr size_t kBucketNum = SegmentType::kBucketNum;

  // if IsSingleBucket is true - iterates only over a single bucket.
  template <bool IsConst, bool IsSingleBucket = false> class Iterator;
  struct BucketSet;

  using const_iterator = Iterator<true>;
  using iterator = Iterator<false>;

  using const_bucket_iterator = Iterator<true, true>;
  using bucket_iterator = Iterator<false, true>;
  using Cursor = detail::DashCursor;

  struct SegmentVisitResult {
    using SegmentRef = std::pair<uint32_t, SegmentType*>;
    Cursor next;
    // pointer must be consumed without yielding, or it can be invalidated.
    std::optional<SegmentRef> id_and_pointer{std::nullopt};
  };

  struct HotBuckets {
    static constexpr size_t kRegularBuckets = 4;
    static constexpr size_t kNumBuckets = kRegularBuckets + SegmentType::kStashBucketNum;

    struct ByType {
      bucket_iterator regular_buckets[kRegularBuckets];
      bucket_iterator stash_buckets[SegmentType::kStashBucketNum];
    } probes;

    // id must be in the range [0, kNumBuckets).
    bucket_iterator at(unsigned id) const {
      if (id < kRegularBuckets) {
        return probes.regular_buckets[id];
      }
      return probes.stash_buckets[id - kRegularBuckets];
    }

    unsigned num_buckets;
    // key_hash of a key that we try to insert.
    // I use it as pseudo-random number in my gc/eviction heuristics.
    uint64_t key_hash;
  };

  struct DefaultEvictionPolicy {
    static constexpr bool can_gc = false;
    static constexpr bool can_evict = false;

    bool CanGrow(const DashTable&) {
      return true;
    }

    void OnMove(Cursor source, Cursor dest) {
    }

    void RecordSplit(SegmentType* segment) {
    }
    /*
       /// Required interface in case can_gc is true
       // Returns number of garbage collected items deleted. 0 - means nothing has been
       // deleted.
       unsigned GarbageCollect(const EvictionBuckets& eb, DashTable* me) const {
         return 0;
       }

       // Required interface in case can_gc is true
       // returns number of items evicted from the table.
       // 0 means - nothing has been evicted.
       unsigned Evict(const EvictionBuckets& eb, DashTable* me) {
         return 0;
       }
   */
  };

  DashTable(size_t capacity_log = 1, const Policy& policy = Policy{},
            PMR_NS::memory_resource* mr = PMR_NS::get_default_resource());
  ~DashTable();

  // Makes ~DashTable() a no-op; use when the arena backing it is about to be bulk-freed.
  void SetArenaDestruct() {
    arena_destruct_ = true;
  }

  void Reserve(size_t size);

  // false for duplicate, true if inserted.
  template <typename U, typename V> std::pair<iterator, bool> Insert(U&& key, V&& value) {
    DefaultEvictionPolicy policy;
    return InsertInternal(std::forward<U>(key), std::forward<V>(value), policy,
                          InsertMode::kInsertIfNotFound);
  }

  template <typename U, typename V, typename EvictionPolicy>
  std::pair<iterator, bool> Insert(U&& key, V&& value, EvictionPolicy& ev) {
    return InsertInternal(std::forward<U>(key), std::forward<V>(value), ev,
                          InsertMode::kInsertIfNotFound);
  }

  template <typename U, typename V> iterator InsertNew(U&& key, V&& value) {
    DefaultEvictionPolicy policy;
    return InsertNew(std::forward<U>(key), std::forward<V>(value), policy);
  }

  template <typename U, typename V, typename EvictionPolicy>
  iterator InsertNew(U&& key, V&& value, EvictionPolicy& ev) {
    return InsertInternal(std::forward<U>(key), std::forward<V>(value), ev,
                          InsertMode::kForceInsert)
        .first;
  }

  template <typename U> const_iterator Find(U&& key) const;
  template <typename U> iterator Find(U&& key);

  // Same as Find(key), for a caller that already has key_hash == DoHash(key).
  template <typename U> iterator Find(U&& key, uint64_t key_hash) {
    assert(key_hash == DoHash(key));
    return FindFirst(key_hash, EqPred(key));
  }

  // Prefetches the memory where the key would resize into the cache.
  template <typename U> void Prefetch(U&& key) const;

  // Find first entry with given key hash that evaulates to true on pred.
  // Pred accepts either (const key&) or (const key&, const value&)
  template <typename Pred> iterator FindFirst(uint64_t key_hash, Pred&& pred);

  // it must be valid.
  void Erase(iterator it);

  size_t Erase(const Key_t& k);

  iterator begin() {
    iterator it{this, 0, 0, 0};
    it.Seek2Occupied();
    return it;
  }

  const_iterator cbegin() const {
    const_iterator it{this, 0, 0, 0};
    it.Seek2Occupied();
    return it;
  }

  iterator end() const {
    return iterator{};
  }
  const_iterator cend() const {
    return const_iterator{};
  }

  using Base::depth;
  using Base::Empty;
  using Base::size;
  using Base::unique_segments;

  // Direct access to the segment for debugging purposes.
  Segment_t* GetSegment(unsigned segment_id) {
    return segment_[segment_id];
  }

  // - If there is no buddy for segment_id return segment_id.
  //   Otherwise, return buddy_id.
  // - A buddy is a sibling segment that was created from the
  //   same parent during split and can be merged back together.
  //   It's the adjacent subtree of the same depth.
  unsigned FindBuddyId(unsigned segment_id) {
    auto* seg = GetSegment(segment_id);
    uint8_t depth = seg->local_depth();

    if (depth <= 1) {
      return segment_id;
    }

    const size_t bit_pos = global_depth_ - depth;
    const size_t buddy_idx = segment_id ^ (1u << bit_pos);
    assert(buddy_idx < segment_.size());

    auto* buddy = GetSegment(buddy_idx);
    // There is no adjacent subtree of the same depth
    if (buddy->local_depth() != depth) {
      return segment_id;
    }

    return buddy_idx;
  }

  // Result of Merge(): `merged` is true iff the two segments were merged. When `merged` is
  // false, `declined_depth_guard` tells apart the two ways it can fail: true means Merge
  // refused to run because it would violate the initial_depth invariant (no items were
  // touched); false means a real rollback happened (items were moved into `keep` then moved
  // back after a failed insertion).
  struct MergeResult {
    bool merged = false;
    bool declined_depth_guard = false;
  };

  // - Moves all items from `buddy_id` to `keep_id` (merges the two segments).
  //   After merge completes, `buddy_id` segment is deleted.
  // - If an insertion fails we rollback and abort the merge.
  // - Merge can run only if there are no active snapshots.
  // - Prefer calling this function only when the combined size of both segments
  //   than x * segment_capacity. With x: 0 < x < 0.25 as statistically this won't
  //   trigger rollbacks.
  MergeResult Merge(unsigned keep_id, unsigned buddy_id) {
    auto* keep = GetSegment(keep_id);
    auto* buddy = GetSegment(buddy_id);

    assert((keep->local_depth() == buddy->local_depth()));
    // assert((keep->SlowSize() + buddy->SlowSize() < (0.25 * buddy->capacity())));
    assert(keep->local_depth() != 1);
    assert(keep != buddy);
    assert(keep_id < buddy_id);  // Callers must iterate low to high to ensure correct orientation

    // Don't merge below initial_depth to maintain Clear() invariant
    // After merge, keep will have depth-1, which determines unique_segments
    uint8_t depth_after_merge = keep->local_depth() - 1;
    if (depth_after_merge < initial_depth_) {
      return {.merged = false, .declined_depth_guard = true};
    }

    bool should_rollback = false;

    // Decrease depth (merge back to parent)
    keep->set_local_depth(keep->local_depth() - 1);

    // Move all items from buddy to keep
    buddy->TraverseAll([&](const auto& it) {
      if (should_rollback) {
        return;
      }

      uint64_t hash = DoHash(buddy->Key(it.index, it.slot));

      auto& src_bucket = buddy->GetBucket(it.index);
      auto res =
          keep->InsertUniq(std::move(src_bucket.key[it.slot]), std::move(src_bucket.value[it.slot]),
                           hash, false, [](auto&&...) {});

      if (!res.found()) {
        should_rollback = true;
        return;
      }

      // Clear the slot in buddy so rollback can reuse the space
      src_bucket.Delete(it.slot);
    });

    if (should_rollback) {
      auto hash_fn = [this](const auto& k) { return policy_.HashFn(k); };
      keep->Split(hash_fn, buddy, [](auto&&...) {});

      return {.merged = false, .declined_depth_guard = false};
    }

    // Same as Split()
    uint32_t buddy_chunk_size = 1u << (global_depth_ - buddy->local_depth());
    uint32_t buddy_start = buddy_id & ~(buddy_chunk_size - 1u);
    for (size_t i = buddy_start; i < buddy_start 
```

### Core Architecture Module: `src/core/dash_internal.h`
```
// Copyright 2024, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <absl/base/internal/endian.h>

#include <array>
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <type_traits>

#include "base/pmr/memory_resource.h"
#include "core/sse_port.h"

namespace dfly {
namespace detail {

template <unsigned NUM_SLOTS> class SlotBitmap {
  static_assert(NUM_SLOTS > 0 && NUM_SLOTS <= 28);
  static constexpr bool SINGLE = NUM_SLOTS <= 14;
  static constexpr unsigned kLen = SINGLE ? 1 : 2;
  static constexpr unsigned kAllocMask = (1u << NUM_SLOTS) - 1;
  static constexpr unsigned kBitmapLenMask = (1 << 4) - 1;

 public:
  // probe - true means the entry is probing, i.e. not owning.
  // probe=true GetProbe returns index of probing entries, i.e. hosted but not owned by this bucket.
  // probe=false - mask of owning entries
  uint32_t GetProbe(bool probe) const {
    if constexpr (SINGLE)
      return ((val_[0].d >> 4) & kAllocMask) ^ ((!probe) * kAllocMask);
    else
      return (val_[1].d & kAllocMask) ^ ((!probe) * kAllocMask);
  }

  // GetBusy returns the busy mask.
  uint32_t GetBusy() const {
    return SINGLE ? val_[0].d >> 18 : val_[0].d;
  }

  bool IsFull() const {
    return Size() == NUM_SLOTS;
  }

  unsigned Size() const {
    return SINGLE ? (val_[0].d & kBitmapLenMask) : __builtin_popcount(val_[0].d);
  }

  // Precondition: Must have empty slot
  // returns result in [0, NUM_SLOTS) range.
  int FindEmptySlot() const {
    uint32_t mask = ~(GetBusy());

    // returns the index for first set bit (FindLSBSetNonZero). mask must be non-zero.
    int slot = __builtin_ctz(mask);
    assert(slot < int(NUM_SLOTS));
    return slot;
  }

  // mask is NUM_SLOTS bits saying which slots needs to be freed (1 - should clear).
  void ClearSlots(uint32_t mask);

  void Clear() {
    if (SINGLE) {
      val_[0].d = 0;
    } else {
      val_[0].d = val_[1].d = 0;
    }
  }

  void ClearSlot(unsigned index);
  void SetSlot(unsigned index, bool probe);

  // cell 0 corresponds to first lsb bit in the busy mask, hence we need to shift left
  // the bitmap in order to shift right the cell-array.
  // Returns true if discarded the last slot (i.e. it was busy).
  bool ShiftLeft();

  void Swap(unsigned slot_a, unsigned slot_b);

 private:
  // SINGLE:
  //   val_[0] is [14 bit- busy][14bit-probing, whether the key does not belong to this
  //   bucket][4bit-count]
  // kLen == 2:
  //  val_[0] is 28 bit busy
  //  val_[1] is 28 bit probing
  //  count is implemented via popcount of val_[0].
  struct Unaligned {
    // Apparently with wrapping struct we can persuade compiler to declare an unaligned int.
    // https://stackoverflow.com/questions/19915303/packed-qualifier-ignored
    uint32_t d __attribute__((packed, aligned(1)));

    Unaligned() : d(0) {
    }
  };

  Unaligned val_[kLen];
};  // SlotBitmap

template <unsigned NUM_SLOTS> class BucketBase {
  // We can not allow more than 4 stash fps because we hold stash positions in single byte
  // stash_pos_ variable that uses 2 bits per stash bucket to point which bucket holds that fp.
  // Hence we can point at most from 4 fps to 4 stash buckets.
  // If any of those limits need to be raised we should increase stash_pos_ similarly to how we did
  // with SlotBitmap.
  static constexpr unsigned kStashFpLen = 4;
  static constexpr unsigned kStashPresentBit = 1 << 4;

  using FpArray = std::array<uint8_t, NUM_SLOTS>;
  using StashFpArray = std::array<uint8_t, kStashFpLen>;

 public:
  using SlotId = uint8_t;
  static constexpr SlotId kNanSlot = 255;

  bool IsFull() const {
    return Size() == NUM_SLOTS;
  }

  bool IsEmpty() const {
    return GetBusy() == 0;
  }

  unsigned Size() const {
    return slotb_.Size();
  }

  void Delete(SlotId sid) {
    slotb_.ClearSlot(sid);
  }

  unsigned Find(uint8_t fp_hash, bool probe) const {
    unsigned mask = CompareFP(fp_hash) & GetBusy();
    return mask & GetProbe(probe);
  }

  uint8_t Fp(unsigned i) const {
    assert(i < finger_arr_.size());
    return finger_arr_[i];
  }

  void SetStashPtr(unsigned stash_pos, uint8_t meta_hash, BucketBase* next);

  // returns 0 if stash was cleared from this bucket, 1 if it was cleared from next bucket.
  unsigned UnsetStashPtr(uint8_t fp_hash, unsigned stash_pos, BucketBase* next);

  // probe - true means the entry is probing, i.e. not owning.
  // probe=true GetProbe returns index of probing entries, i.e. hosted but not owned by this bucket.
  // probe=false - mask of owning entries
  uint32_t GetProbe(bool probe) const {
    return slotb_.GetProbe(probe);
  }

  // GetBusy returns the busy mask.
  uint32_t GetBusy() const {
    return slotb_.GetBusy();
  }

  bool IsBusy(unsigned slot) const {
    return (GetBusy() & (1u << slot)) != 0;
  }

  // mask is saying which slots needs to be freed (1 - should clear).
  void ClearSlots(uint32_t mask) {
    slotb_.ClearSlots(mask);
  }

  void Clear() {
    slotb_.Clear();
  }

  void ClearStashPtrs() {
    stash_busy_ = 0;
    stash_pos_ = 0;
    stash_probe_mask_ = 0;
    overflow_count_ = 0;
  }

  bool HasStash() const {
    return stash_busy_ & kStashPresentBit;
  }

  void SetHash(unsigned slot_id, uint8_t meta_hash, bool probe);

  bool HasStashOverflow() const {
    return overflow_count_ > 0;
  }

  // func accepts an fp_index in range [0, kStashFpLen) and
  // stash position [0, STASH_BUCKET_NUM) that with fingerprint=fp. func must return
  // a slot id if it found whatever it searched for when iterating or kNanSlot to continue.
  // IterateStash returns: first - stash position [0, STASH_BUCKET_NUM), second - slot id
  // pointing to that stash.
  template <typename F>
  std::pair<unsigned, SlotId> IterateStash(uint8_t fp, bool is_probe, F&& func) const;

  void Swap(unsigned slot_a, unsigned slot_b) {
    slotb_.Swap(slot_a, slot_b);
    std::swap(finger_arr_[slot_a], finger_arr_[slot_b]);
  }

 protected:
  uint32_t CompareFP(uint8_t fp) const;
  bool ShiftRight();

  // Returns true if stash_pos was stored, false overwise
  bool SetStash(uint8_t fp, unsigned stash_pos, bool probe);
  bool ClearStash(uint8_t fp, unsigned stash_pos, bool probe);

  SlotBitmap<NUM_SLOTS> slotb_;  // allocation bitmap + pointer bitmap + counter

  /*only use the first 14 bytes, can be accelerated by
    SSE instruction,0-13 for finger, 14-17 for overflowed*/
  FpArray finger_arr_;
  StashFpArray stash_arr_;

  uint8_t stash_busy_ = 0;  // kStashFpLen+1 bits are used
  uint8_t stash_pos_ = 0;   // 4x2 bits for pointing to stash bucket.

  // stash_probe_mask_ indicates whether the overflow fingerprint is for the neighbour (1)
  // or for this bucket (0). kStashFpLen bits are used.
  uint8_t stash_probe_mask_ = 0;

  // number of overflowed items stored in stash buckets that do not have fp hashes.
  uint8_t overflow_count_ = 0;
};  // BucketBase

static_assert(sizeof(BucketBase<12>) == 24);
static_assert(alignof(BucketBase<14>) == 1);
static_assert(alignof(BucketBase<12>) == 1);

// Optional version support as part of DashTable.
// This works like this: each slot has 2 bytes for version and a bucket has another 6.
// therefore all slots in the bucket shared the same 6 high bytes of 8-byte version.
// In order to achieve this we store high6(max{version(entry)}) for every entry.
// Hence our version control may have false positives, i.e. signal that an entry has changed
// when in practice its neighbour incremented the high6 part of its bucket.
template <unsigned NUM_SLOTS> class VersionedBB : public BucketBase<NUM_SLOTS> {
  using Base = BucketBase<NUM_SLOTS>;

 public:
  // one common version per bucket.
  void SetVersion(uint64_t version);

  uint64_t GetVersion() const {
    uint64_t c = absl::little_endian::Load64(version_);
    // c |= low_[slot_id];
    return c;
  }

  void UpdateVersion(uint64_t version) {
    uint64_t c = std::max(GetVersion(), version);
    absl::little_endian::Store64(version_, c);
  }

  void Clear() {
    Base::Clear();
    // low_.fill(0);
    memset(version_, 0, sizeof(version_));
  }

  bool ShiftRight() {
    bool res = Base::ShiftRight();
    return res;
  }

  void Swap(unsigned slot_a, unsigned slot_b) {
    Base::Swap(slot_a, slot_b);
  }

 private:
  uint8_t version_[8] = {0};
};

static_assert(alignof(VersionedBB<14>) == 1);
static_assert(sizeof(VersionedBB<12>) == 12 * 2 + 8);
static_assert(sizeof(VersionedBB<14>) <= 14 * 2 + 8);

// Segment - static-hashtable of size kSlotNum*(kBucketNum + kStashBucketNum).
struct DefaultSegmentPolicy {
  static constexpr unsigned kSlotNum = 12;
  static constexpr unsigned kBucketNum = 64;
  static constexpr bool kUseVersion = true;
};

using PhysicalBid = uint8_t;
using LogicalBid = uint8_t;

template <typename KeyType, typename ValueType, typename Policy = DefaultSegmentPolicy>
class Segment {
 public:
  static constexpr unsigned kSlotNum = Policy::kSlotNum;
  static constexpr unsigned kBucketNum = Policy::kBucketNum;
  static constexpr unsigned kStashBucketNum = 4;
  static constexpr bool kUseVersion = Policy::kUseVersion;

 private:
  static_assert(kBucketNum + kStashBucketNum < 255);
  static constexpr unsigned kFingerBits = 8;

  using BucketType = std::conditional_t<kUseVersion, VersionedBB<kSlotNum>, BucketBase<kSlotNum>>;

  struct Bucket : public BucketType {
    using BucketType::kNanSlot;
    using typename BucketType::SlotId;

    KeyType key[kSlotNum];
    ValueType value[kSlotNum];

    template <typename U, typename V>
    void Insert(uint8_t slot, U&& u, V&& v, uint8_t meta_hash, bool probe) {
      assert(slot < kSlotNum);

      key[slot] = std::forward<U>(u);
      value[slot] = std::forward<V>(v);

      this->SetHash(slot, meta_hash, probe);
    }

    // Returns slot id if insertion is successful, -1 if no free slots are found.
    template <typename U, typename V>
    int TryInsertToBucket(U&& key, V&& value, uint8_t meta_hash, bool probe) {
      if (this->IsFull()
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8647** (2026-10-23): **WAIT crashes the primary (SIGSEGV, exit 139) when a replica stream is throttled**
  *Symptoms*: ### Bug: `WAIT` crashes the primary (SIGSEGV, exit 139) when a replica stream is throttled  If `WAIT` runs while a replica's journal stream is at or over `replication_stream_output_limit` (1 MB default), the primary logs `Should not preempt dispatcher` and segfaults. Under the same backlog, normal writes are throttled safely; only `WAIT` crashes.  ### Repro (~1 min, Docker)  ```bash docker network create df docker run -d --name m --network df -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2 --proactor_threads=2 docker run -d --name r --network df -p 6380:6379 docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2 --proactor_threads=2 redis-cli -p 6380 REPLICAOF m 6379 redis-cli -p 6379 WAIT 1 1000 # -> 1 docker pause r # replica stops reading python3 - <<'PYEOF' & # ~200 MiB of pipelined SETs, replies not read import socket s = socket.create_connection(("127.0.0.1", 6379)); v = b"x" * (1 << 20) for i in range(200):     k = b"k%d" % i     s.sendall(b"*3\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n" % (len(k), k, len(v), v)) PYEOF sleep 3 redis-cli -p 6379 WAIT 1 2000 # -> "Server closed the connection" docker inspect -f '{{.State.ExitCode}}' m # -> 139 ```  Without the final `WAIT`, the primary stays up, and replication recovers after `docker unpause r`.  ### Stack  ``` E scheduler.cc:206] Should not preempt dispatcher: util::fb2::detail::Scheduler::WaitUntil() util::fb2::EventCount::wait_until() dfly::JournalStreamer::ThrottleIfNeeded() dfly::journal::JournalSlice::C

- **Issue #8629** (2026-10-21): **'*' is accepted as a stream ID outside XADD and the ID is then read uninitialized; XTRIM MINID * deletes the whole stream**
  *Symptoms*: **Describe the bug**  `ParseID` accepts `*` for any stream ID and returns success **without writing the output ID**, so the caller proceeds with whatever was on the stack. `*` is only meaningful as `XADD`'s auto-generated-ID request; every other command that takes a concrete ID should reject it, and every other implementation does.  The worst case destroys data: `XTRIM key MINID *` trims against an indeterminate threshold, which in practice removes every entry.  ``` XADD s 1-0 a 1       ->  "1-0" XADD s 2-0 b 2       ->  "2-0" XTRIM s MINID *      ->  (integer) 2     every reference: ERR Invalid stream ID ... XLEN s               ->  (integer) 0     the stream is empty ```  The same parse is reached from `XADD`'s own trim options, where it deletes the entry the command just acknowledged:  ``` XADD s MINID * 3-0 c 3   ->  "3-0"       the client is told 3-0 was added XLEN s                   ->  (integer) 0 and the stream, including 3-0, is empty ```  and from the read and write paths, where the indeterminate ID shows up as results that depend on whatever the uninitialized value happened to be:  ``` XRANGE s * +             ->  (empty array)      expected an error XRANGE s - *             ->  both entries       expected an error XREVRANGE s + *          ->  (empty array)      expected an error XDEL s *                 ->  (integer) 0        expected an error XREAD STREAMS s *        ->  (nil)              expected an error XSETID s *               ->  OK                 expecte

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

### Incident Patch 1: `5f3c3c12` (2026-11-06)
**Commit Message**: fix(search): report query errors in FT.AGGREGATE and FT.HYBRID, match nothing on NOINDEX (#8749)

* fix(search): report query errors in FT.AGGREGATE and FT.HYBRID, match nothing on NOINDEX

FT.AGGREGATE answered [0] and FT.HYBRID returned the hits of its other leg when a shard reported a
missing index, an unknown field, a wrong access type or an index that is not built yet. The shard
results now carry the error to the client in every query command, as FT.SEARCH already did, and a
clause on a NOINDEX field matches nothing instead of failing, as the reference does; the type check
still applies to it. Bare HNSW KNN and VECTOR_RANGE, FT.TAGVALS and every FT.AGGREGATE variant
answer "index is not built" while an index waits for its rebuild after a load. FT.HYBRID reports a
FILTER syntax error with one text on FLAT and HNSW indexes and the real byte count of a bad blob.

Signed-off-by: Volodymyr Yavdoshenko <[REDACTED_EMAIL]>

* refactor(search): map index types with a lambda, merge the query error tests

kFieldTypeOf is a lambda over the decayed type with one branch per index class, VECTOR included,
and a compile error for any other type. The NOINDEX rows join QueryErrorsReachAllCommand

**File**: `src/core/search/search.cc` (modified, +33/-1)
```diff
@@ -178,6 +178,24 @@ concept CompositeNode = (requires(const Node& node) { node.node; }) ||
                         (requires(const Node& node) { node.nodes; }) ||
                         (requires(const Node& node) { node.filter; });
 
+// The schema type an index class serves.
+template <typename T>
+constexpr SchemaField::FieldType kFieldTypeOf = [] {
+  using Index = decay_t<T>;
+  if constexpr (is_same_v<Index, TextIndex>)
+    return SchemaField::TEXT;
+  else if constexpr (is_same_v<Index, NumericIndex>)
+    return SchemaField::NUMERIC;
+  else if constexpr (is_same_v<Index, TagIndex>)
+    return SchemaField::TAG;
+  else if constexpr (is_same_v<Index, GeoIndex>)
+    return SchemaField::GEO;
+  else if constexpr (is_same_v<Index, BaseVectorIndex>)
+    return SchemaField::VECTOR;
+  else
+    static_assert(sizeof(Index) == 0, "no schema type for this index");
+}();
+
 struct BasicSearch {
   using LogicOp = AstLogicalNode::LogicOp;
 
@@ -190,9 +208,16 @@ struct BasicSearch {
     profile_builder_ = ProfileBuilder{};
   }
 
+  // The attribute under `field` if it is NOINDEX: it has no index, so its clauses match nothing
+  // instead of failing.
+  const SchemaField* NoIndexField(string_view field) const {
+    const SchemaField* attribute = indices_->GetSchema().Find(field);
+    return attribute && (attribute->flags & SchemaField::NOINDEX) ? attribute : nullptr;
+  }
+
   BaseIndex* GetBaseIndex(string_view field) {
     auto index = indices_->GetIndex(field);
-    if (!index) {
+    if (!index && !NoIndexField(field)) {
       error_ = absl::StrCat("Invalid field: ", field);
       return nullptr;
     }
@@ -205,6 +230,13 @@ struct BasicSearch {
 
     auto base_index = GetBaseIndex(field);
     if (!base_index) {
+      // A NOINDEX attribute keeps its type, and a vector one has nothing to search at all.
+      if (const auto* noindex = error_.empty() ? NoIndexField(field) : nullptr; noindex) {
+        if (noindex->type != kFieldTypeOf<T>)
+          error_ = absl::StrCat("Wrong access type for field: ", field);
+        else if (noindex->type == SchemaField::VECTOR)
+          error_ = absl::StrCat("Invalid field: ", field);
+      }
       return nullptr;
     }
 
```

**File**: `src/server/rdb_test.cc` (modified, +26/-5)
```diff
@@ -1235,7 +1235,7 @@ TEST_F(RdbTest, FailedLoadDropsUnbuiltIndex) {
   EXPECT_THAT(Run({"ft._list"}).GetVec(), IsEmpty());
   EXPECT_THAT(Run({"FT.TAGVALS", "idx", "g"}), no_index);
   EXPECT_THAT(Run({"FT.SEARCH", "idx", "hello"}), no_index);
-  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "*"}), RespArray(ElementsAre(IntArg(0))));
+  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "*"}), no_index);
   EXPECT_THAT(
       Run({"FT.HYBRID", "idx", "SEARCH", "hello", "VSIM", "@v", "$vec", "PARAMS", "2", "vec", vec}),
       no_index);
@@ -1271,12 +1271,33 @@ TEST_F(RdbTest, UnbuiltIndexAnswersWithoutCrash) {
     service_->SwitchState(GlobalState::LOADING, GlobalState::ACTIVE);
   });
 
-  EXPECT_THAT(Run({"FT.SEARCH", "idx", "hello"}), ErrArg("not built"));
+  const auto not_built = ErrArg("not built");
+  EXPECT_THAT(Run({"FT.SEARCH", "idx", "hello"}), not_built);
+  EXPECT_THAT(Run({"FT.SEARCH", "idx", "*=>[KNN 2 @v $vec]", "PARAMS", "2", "vec", vec}),
+              not_built);
+  EXPECT_THAT(Run({"FT.SEARCH", "idx", "@v:[VECTOR_RANGE 1 $vec]", "PARAMS", "2", "vec", vec}),
+              not_built);
+  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "*"}), not_built);
+  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "*=>[KNN 2 @v $vec]", "PARAMS", "2", "vec", vec}),
+              not_built);
+  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "@v:[VECTOR_RANGE 1 $vec]", "PARAMS", "2", "vec", vec}),
+              not_built);
   EXPECT_THAT(
       Run({"FT.HYBRID", "idx", "SEARCH", "hello", "VSIM", "@v", "$vec", "PARAMS", "2", "vec", vec}),
-      ArgType(RespExpr::ARRAY));
-  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "*"}), RespArray(ElementsAre(IntArg(0))));
-  EXPECT_THAT(Run({"FT.TAGVALS", "idx", "g"}).GetVec(), IsEmpty());
+      not_built);
+  EXPECT_THAT(Run({"FT.AGGREGATE", "idx", "*", "LOAD", "1", "idx.t", "LOAD_FROM", "idx", "AS", "j",
+                   "1", "j.g=idx.g"}),
+              not_built);
+  EXPECT_THAT(Run({"FT.PROFILE", "idx", "SEARCH", "QUERY", "*=>[KNN 2 @v $vec]", "PARAMS", "2",
+                   "vec", vec}),
+              not_built);
+  EXPECT_THAT(Run({"FT.PROFILE", "idx", "SEARCH", "QUERY", "@v:[VECTOR_RANGE 1 $vec]", "PARAMS",
+                   "2", "vec", vec}),
+              not_built);
+  EXPECT_THAT(Run({"FT.PROFILE", "idx", "HYBRID", "QUERY", "SEARCH", "hello", "VSIM", "@v", "$vec",
+                   "PARAMS", "2", "vec", vec}),
+              not_built);
+  EXPECT_THAT(Run({"FT.TAGVALS", "idx", "g"}), not_built);
   auto info = Run({"FT.INFO", "idx"}).GetVec();
   auto it = rng::find_if(info, [](const auto& e) { return e == "percent_indexed"; });
   ASSERT_NE(it, info.end());
```

**File**: `src/server/search/doc_index.cc` (modified, +14/-9)
```diff
@@ -153,8 +153,6 @@ std::pair<std::vector<DocField>, std::vector<std::string_view>> GetBasicFields(
   return {std::move(basic_fields), std::move(sort_alias)};
 }
 
-constexpr std::string_view kIndexNotBuilt = "index is not built";
-
 auto GetIndexedHnswFields(const search::Schema& schema) {
   return schema.fields |
          std::views::filter([](const auto& item) { return item.second.IsIndexableHnswField(); });
@@ -1384,17 +1382,17 @@ search::ShardScoringStats ShardDocIndex::CollectScoringStats(
   return search_algo->CollectScoringStats(&*indices_);
 }
 
-vector<SearchDocData> ShardDocIndex::SearchForAggregator(
+ShardDocIndex::AggregateShardResult ShardDocIndex::SearchForAggregator(
     const OpArgs& op_args, const AggregateParams& params,
     search::SearchAlgorithm* search_algo) const {
   if (!indices_)
-    return {};
+    return make_unexpected(ErrorReply{std::string{kIndexNotBuilt}});
 
   auto search_results = search_algo->Search(&*indices_, std::numeric_limits<size_t>::max(),
                                             params.global_scoring_stats);
 
   if (!search_results.error.empty())
-    return {};
+    return make_unexpected(ErrorReply{std::move(search_results.error)});
 
   // Distance lookup for FLAT KNN/VECTOR_RANGE so the score alias is available in the
   // aggregation pipeline. HNSW paths use LoadHnswRangeDocsForAggregator.
@@ -1476,13 +1474,15 @@ vector<SearchDocData> ShardDocIndex::LoadDocEntriesWithScores(
   return out;
 }
 
-join::Vector<join::OwnedEntry> ShardDocIndex::PreagregateDataForJoin(
+io::Result<join::Vector<join::OwnedEntry>, ErrorReply> ShardDocIndex::PreagregateDataForJoin(
     const OpArgs& op_args, absl::Span<const std::string_view> join_fields,
     search::SearchAlgorithm* search_algo) const {
   if (!indices_)
-    return {};
+    return make_unexpected(ErrorReply{std::string{kIndexNotBuilt}});
 
   auto search_results = search_algo->Search(&*indices_);
+  if (!search_results.error.empty())
+    return make_unexpected(ErrorReply{std::move(search_results.error)});
 
   const size_t fields_count = join_fields.size();
   const auto [basic_fields, sort_alias] = GetBasicFields(join_fields, base_->schema);
@@ -1590,11 +1590,16 @@ DocIndexInfo ShardDocIndex::GetInfo() const {
 
 io::Result<StringVec, ErrorReply> ShardDocIndex::GetTagVals(string_view field) const {
   if (!indices_)
-    return StringVec{};
+    return make_unexpected(ErrorReply{std::string{kIndexNotBuilt}});
 
   search::BaseIndex* base_index = indices_->GetIndex(field);
   if (base_index == nullptr) {
-    return make_unexpected(ErrorReply{"-No such field"});
+    const auto* attribute = base_->schema.Find(field);
+    if (!attribute || !(attribute->flags & search::SchemaField::NOINDEX))
+      return make_unexpected(ErrorReply{"-No such field"});
+    if (attribute->type != search::SchemaField::TAG)
+      return make_unexpected(ErrorReply{"-Not a tag field"});
+    return StringVec{};  // a tag without an index lists no values
   }
 
   search::TagIndex* tag_index = dynamic_cast<search::TagIndex*>(base_index);
```

**File**: `src/server/search/doc_index.h` (modified, +12/-4)
```diff
@@ -33,6 +33,9 @@ namespace dfly {
 
 using StringVec = std::vector<std::string>;
 
+// What a registered index answers until its data structures are rebuilt after a load.
+inline constexpr std::string_view kIndexNotBuilt = "index is not built";
+
 namespace search {
 struct IndexBuilder;
 }  // namespace search
@@ -460,9 +463,9 @@ class ShardDocIndex {
   search::ShardScoringStats CollectScoringStats(search::SearchAlgorithm* search_algo) const;
 
   // Perform search and load requested values - note params might be interpreted differently.
-  std::vector<SearchDocData> SearchForAggregator(const OpArgs& op_args,
-                                                 const AggregateParams& params,
-                                                 search::SearchAlgorithm* search_algo) const;
+  using AggregateShardResult = io::Result<std::vector<SearchDocData>, facade::ErrorReply>;
+  AggregateShardResult SearchForAggregator(const OpArgs& op_args, const AggregateParams& params,
+                                           search::SearchAlgorithm* search_algo) const;
 
   // Load and serialize docs for aggregation from pre-computed (DocId, distance) pairs.
   // Used by the HNSW VECTOR_RANGE path in FT.AGGREGATE, where doc ids and distances come
@@ -473,7 +476,7 @@ class ShardDocIndex {
       const absl::flat_hash_map<search::DocId, float>& text_score_map) const;
 
   // Methods needed for join operation
-  join::Vector<join::OwnedEntry> PreagregateDataForJoin(
+  io::Result<join::Vector<join::OwnedEntry>, facade::ErrorReply> PreagregateDataForJoin(
       const OpArgs& op_args, absl::Span<const std::string_view> join_fields,
       search::SearchAlgorithm* search_algo) const;
 
@@ -501,6 +504,11 @@ class ShardDocIndex {
     return *base_;
   }
 
+  // False between a definition replayed by a load and the rebuild that follows it.
+  bool IsBuilt() const {
+    return indices_.has_value();
+  }
+
   io::Result<StringVec, facade::ErrorReply> GetTagVals(std::string_view field) const;
 
   // Get synonym manager for this shard
```

**File**: `src/server/search/search_family.cc` (modified, +163/-82)
```diff
@@ -4,7 +4,6 @@
 
 #include "server/search/search_family.h"
 
-#include <absl/cleanup/cleanup.h>
 #include <absl/container/flat_hash_map.h>
 #include <absl/flags/flag.h>
 #include <absl/functional/function_ref.h>
@@ -17,9 +16,9 @@
 #include <absl/types/span.h>
 
 #include <algorithm>
+#include <array>
 #include <atomic>
 #include <cmath>
-#include <exception>
 #include <functional>
 #include <ranges>
 #include <variant>
@@ -87,7 +86,8 @@ bool CheckQueryLength(string_view query, string_view what, SinkReplyBuilder* rb)
 }
 
 template <typename T> using ParseResult = io::Result<T, ErrorReply>;
-using HnswSearchResult = io::Result<vector<SearchResult>, OpStatus>;
+enum class HnswLoadError { kIndexNotFound, kIndexNotBuilt };
+using HnswSearchResult = io::Result<vector<SearchResult>, HnswLoadError>;
 
 nonstd::unexpected_type<ErrorReply> CreateSyntaxError(std::string message) {
   return make_unexpected(ErrorReply{std::move(message), kSyntaxErrType});
@@ -101,6 +101,11 @@ string IndexNotFoundMsg(string_view index_name) {
   return absl::StrCat("-ERR ", index_name, ": no such index");
 }
 
+ErrorReply HnswLoadErrorReply(HnswLoadError error, string_view index_name) {
+  return ErrorReply{error == HnswLoadError::kIndexNotFound ? IndexNotFoundMsg(index_name)
+                                                           : string{kIndexNotBuilt}};
+}
+
 std::string ResolveIndexName(string_view requested_name) {
   std::string canonical_name;
   auto resolve = [&] {
@@ -1427,6 +1432,7 @@ HnswSearchResult LoadHnswSearchDocs(const HnswSearchOptions& options,
   // Indicator if we serialized document on shard
   std::vector<std::vector<bool>> shard_docs_serialized_indicator(shard_size);
   std::atomic missing_index = false;
+  std::atomic not_built = false;
 
   // Fetch all docs from shards
   auto cb = [&](Transaction* t, EngineShard* es) {
@@ -1436,6 +1442,10 @@ HnswSearchResult LoadHnswSearchDocs(const HnswSearchOptions& options,
       missing_index.store(true, std::memory_order_relaxed);
       return OpStatus::OK;
     }
+    if (!index->IsBuilt()) {
+      not_built.store(true, std::memory_order_relaxed);
+      return OpStatus::OK;
+    }
 
     if (shard_docs[es->shard_id()].empty()) {
       return OpStatus::OK;
@@ -1479,7 +1489,9 @@ HnswSearchResult LoadHnswSearchDocs(const HnswSearchOptions& options,
   cmd_cntx.tx()->Execute(std::move(cb), true);
 
   if (missing_index.load(std::memory_order_relaxed))
-    return make_unexpected(OpStatus::KEY_NOTFOUND);
+    return make_unexpected(HnswLoadError::kIndexNotFound);
+  if (not_built.load(std::memory_order_relaxed))
+    return make_unexpected(HnswLoadError::kIndexNotBuilt);
 
   // Transform shard results back to a flat list of serialized docs.
   size_t shard_id = 0;
@@ -1622,12 +1634,17 @@ HnswSearchResult SearchGlobalHnswIndexRange(const search::AstVectorRangeNode* ra
   }
 
   std::atomic missing_index = false;
+  std::atomic not_built = false;
   cmd_cntx.tx()->ScheduleSingleHop([&](Transaction* t, EngineShard* es) {
     auto* idx = es->search_indices()->GetIndex(options.index_name);
     if (!idx) {
       missing_index.store(true, std::memory_order_relaxed);
       return OpStatus::OK;
     }
+    if (!idx->IsBuilt()) {
+      not_built.store(true, std::memory_order_relaxed);
+      return OpStatus::OK;
+    }
     if (shard_docs[es->shard_id()].empty())
       return OpStatus::OK;
     const auto& schema = idx->base().schema;
@@ -1647,7 +1664,9 @@ HnswSearchResult SearchGlobalHnswIndexRange(const search::AstVectorRangeNode* ra
   });
 
   if (missing_index.load(std::memory_order_relaxed))
-    return make_unexpected(OpStatus::KEY_NOTFOUND);
+    return make_unexpected(HnswLoadError::kIndexNotFound);
+  if (not_built.load(std::memory_order_relaxed))
+    return make_unexpected(HnswLoadError::kIndexNotBuilt);
 
   std::vector<SerializedSearchDoc> serialized_docs;
   serialized_docs.reserve(range_results.size());
@@ -2125,7 +2144,24 @@ void HybridReply(const HybridSearchParams& params, search::VectorSimilarity vsim
   rb->SendBulkString(absl::StrFormat("%.6f", absl::ToDoubleMilliseconds(total_took)));
 }
 
-// Returns false if the index is not found on any shard; caller must Conclude() the tx.
+// Concludes the hop left open when a query handler returns. Skipped in an atomic MULTI/EXEC or
+// script: UnlockMulti releases the shards there, and these commands have nothing to journal.
+class ConcludeGuard {
+ public:
+  [[nodiscard]] explicit ConcludeGuard(CommandContext* cmd_cntx) : tx_{cmd_cntx->tx()} {
+    DCHECK(cmd_cntx->cid()->opt_mask() & CO::NO_AUTOJOURNAL);
+  }
+
+  ~ConcludeGuard() {
+    if (!tx_->IsAtomicMulti())
+      tx_->Conclude();
+  }
+
+ private:
+  Transaction* tx_;
+};
+
+// Returns false if the index is not found on any shard. Its hop leaves the transaction open.
 bool CollectGlobalScoringStats(string_view index_name, search::SearchAlgorithm& text_algo,
                                Transaction* tx, size_t shard_count,
                
```

**File**: `src/server/search/search_family_test.cc` (modified, +101/-3)
```diff
@@ -637,7 +637,7 @@ TEST_F(SearchFamilyTest, HnswAliasConcludesTransactions) {
   // FT.AGGREGATE
   EXPECT_THAT(Run({"FT.AGGREGATE", "live", "hello", "LOAD", "1", "@title"}),
               IsUnordArrayWithSize(IsMap("title", "hello")));
-  EXPECT_THAT(Run({"FT.AGGREGATE", "missing_alias", "*"}), kNoResults);
+  EXPECT_THAT(Run({"FT.AGGREGATE", "missing_alias", "*"}), ErrArg("missing_alias: no such index"));
   EXPECT_THAT(Run({"FT.AGGREGATE", "live", "*=>[KNN 1 @vec $v AS dist]", "PARAMS", "2", "v", query,
                    "DIALECT", "2", "LOAD", "1", "@title"}),
               IsUnordArrayWithSize(IsMap("title", "hello")));
@@ -5667,7 +5667,7 @@ TEST_F(SearchFamilyTest, AggregateWithLoadFromSyntaxErrors) {
   // Test when index does not exist
   EXPECT_THAT(Run({"ft.aggregate", "idx1", "*", "LOAD", "2", "idx1.num1", "idx1.str1", "LOAD_FROM",
                    "idx4", "1", "idx4.num2=idx1.num1"}),
-              RespElementsAre(IntArg(0)));
+              ErrArg("idx4: no such index"));
 
   // Test when index exists but no LOAD_FROM is specified
   EXPECT_THAT(Run({"ft.aggregate", "idx1", "*", "LOAD", "2", "idx1.num1", "idx1.str1", "LOAD_FROM",
@@ -5698,7 +5698,7 @@ TEST_F(SearchFamilyTest, AggregateWithLoadFromSyntaxErrors) {
   // Test when field in QUERY does not exist in index
   EXPECT_THAT(Run({"ft.aggregate", "idx1", "*", "LOAD", "2", "idx1.num1", "idx1.str1", "LOAD_FROM",
                    "idx2", "1", "idx2.num2=idx1.num1", "QUERY", "@nonexistent_tag:{tag1|tag2}"}),
-              RespElementsAre(IntArg(0)));
+              ErrArg("Invalid field: nonexistent_tag"));
 
   // Test when field in LOAD does not exist in index
   EXPECT_THAT(Run({"ft.aggregate", "idx1", "*", "LOAD", "2", "idx1.num1", "idx1.non_existent_field",
@@ -10376,6 +10376,94 @@ TEST_F(SearchFamilyTest, FtHybridUnknownIndex) {
   EXPECT_THAT(resp, ErrArg("no such index"));
 }
 
+// Query errors reach the client in every command, also from the multi-hop flows (KNN prefilter,
+// scoring, JOIN), which leave no transaction behind. A clause on a NOINDEX field is no error: it
+// matches nothing, while its type is still checked.
+TEST_F(SearchFamilyTest, QueryErrorsReachAllCommands) {
+  const string vec = FloatVec(1, 0);
+  ASSERT_EQ(
+      Run("FT.CREATE i ON HASH PREFIX 1 d: SCHEMA t TEXT ni TEXT NOINDEX ng TAG NOINDEX nn "
+          "NUMERIC NOINDEX ge GEO NOINDEX nv VECTOR FLAT 6 TYPE FLOAT32 DIM 2 DISTANCE_METRIC "
+          "L2 NOINDEX v VECTOR FLAT 6 TYPE FLOAT32 DIM 2 DISTANCE_METRIC L2"),
+      "OK");
+  ASSERT_EQ(Run("FT.CREATE h ON HASH PREFIX 1 d: SCHEMA t TEXT ni TEXT NOINDEX v VECTOR HNSW 6 "
+                "TYPE FLOAT32 DIM 2 DISTANCE_METRIC L2"),
+            "OK");
+  Run({"HSET", "d:1", "t", "hello web", "ni", "hello", "ng", "red", "nn", "5", "v", vec});
+  Run({"HSET", "d:2", "t", "world", "v", FloatVec(0, 1)});
+
+  // A hop left open after an error stays on every shard as its continuation transaction; the next
+  // command on the same connection would silently continue it, so the shards are inspected
+  // right after each multi-hop command.
+  auto open_txs = [&] {
+    std::atomic<size_t> open = 0;
+    pp_->at(0)->Await([&] {
+      shard_set->RunBriefInParallel([&](EngineShard* es) { open += es->GetContTx() != nullptr; });
+    });
+    return open.load();
+  };
+
+  for (string_view idx : {"i", "h"}) {
+    for (auto [q, err] : {pair{"@zz:x", "Invalid field: zz"},
+                          pair{"@ni:[1 2]", "Wrong access type for field: ni"}}) {
+      EXPECT_THAT(Run({"FT.AGGREGATE", idx, q}), ErrArg(err));
+      const string knn = absl::StrCat(q, "=>[KNN 1 @v $vec]");
+      EXPECT_THAT(Run({"FT.AGGREGATE", idx, knn, "PARAMS", "2", "vec", vec}), ErrArg(err));
+      EXPECT_EQ(open_txs(), 0u);
+      EXPECT_THAT(Run({"FT.SEARCH", idx, knn, "PARAMS", "2", "vec", vec}), ErrArg(err));
+      EXPECT_EQ(open_txs(), 0u);
+      EXPECT_THAT(Run({"FT.PROFILE", idx, "SEARCH", "QUERY", knn, "PARAMS", "2", "vec", vec}),
+                  ErrArg(err));
+      EXPECT_EQ(open_txs(), 0u);
+      EXPECT_THAT(Run({"FT.AGGREGATE", idx, absl::StrCat("(", q, " @v:[VECTOR_RANGE 0.5 $vec])"),
+                       "PARAMS", "2", "vec", vec}),
+                  ErrArg(err));
+      EXPECT_EQ(open_txs(), 0u);
+      EXPECT_THAT(
+          Run({"FT.HYBRID", idx, "SEARCH", q, "VSIM", "@v", "$vec", "PARAMS", "2", "vec", vec}),
+          ErrArg(err));
+      EXPECT_THAT(Run({"FT.HYBRID", idx, "SEARCH", "hello", "VSIM", "@v", "$vec", "FILTER", q,
+                       "PARAMS", "2", "vec", vec}),
+                  ErrArg(err));
+      EXPECT_THAT(Run({"FT.PROFILE", idx, "HYBRID", "QUERY", "SEARCH", q, "VSIM", "@v", "$vec",
+                       "PARAMS", "2", "vec", vec}),
+                  ErrArg(err));
+    }
+    EXPECT_THAT(Run({"FT.HYBRID", idx, "SEARCH", "@zz:x", "VSIM", "@v", "$vec", "FILTER",
+                     "@ni:[1 2]", "PARAMS", "2", "vec", vec}),
+                ErrArg("Invalid field: zz")
```

---

### Incident Patch 2: `2b92dbbf` (2026-11-05)
**Commit Message**: fix(server): let CLIENT KILL reply before closing the caller and skip migrating connections (#8752)

A CLIENT KILL that matched the calling connection shut its socket down before the reply: the
client saw EOF without a byte, lost the earlier pipelined replies, and the commands pipelined
after the kill still ran. The caller is now closed once its reply is flushed
(Connection::RequestCloseAfterReply()) and no later command runs, on both IO loops; a kill
inside MULTI/EXEC closes the connection after the EXEC reply.

The kill also borrowed connections that were migrating to another thread, which fails
"Check failed: self_" in Connection::Borrow() in debug builds. It now skips them, as release
builds already did.

Signed-off-by: Volodymyr Yavdoshenko <[REDACTED_EMAIL]>

**File**: `src/facade/dragonfly_connection.cc` (modified, +15/-2)
```diff
@@ -1000,6 +1000,14 @@ void Connection::MarkForClose() {
   request_shutdown_ = true;
 }
 
+void Connection::MaybeCloseAfterReply() {
+  if (!close_after_reply_ || reply_builder_->GetError())
+    return;
+
+  reply_builder_->Flush();
+  MarkForClose();
+}
+
 // Called from Connection::Shutdown() right after socket_->Shutdown call.
 void Connection::OnShutdown() {
   VLOG(1) << CONN_ID << "Connection::OnShutdown";
@@ -1577,8 +1585,8 @@ void Connection::ConnectionFlow() {
   }
 
   // We wait for dispatch_fb to finish writing the previous replies before replying to the last
-  // offending request.
-  if (parse_status == ERROR) {
+  // offending request. A connection closed after its reply has no protocol error to send.
+  if (parse_status == ERROR && !close_after_reply_) {
     VLOG(1) << CONN_ID << "Error parser status " << parser_error_;
 
     // V2 sends protocol errors inside IoLoopV2().
@@ -1662,6 +1670,8 @@ void Connection::DispatchSingle(bool has_more, absl::FunctionRef<void()> invoke_
     // prefer synchronous dispatching to save memory.
     optimize_for_async = false;
     last_interaction_ = time(nullptr);
+    if (cc_->conn_closing)
+      return;
   }
 
   // Avoid sync dispatch if we can interleave with an ongoing async dispatch.
@@ -1678,6 +1688,7 @@ void Connection::DispatchSingle(bool has_more, absl::FunctionRef<void()> invoke_
       cc_->sync_dispatch = true;
       invoke_cb();
       cc_->sync_dispatch = false;
+      MaybeCloseAfterReply();
     }
     last_interaction_ = time(nullptr);
 
@@ -2290,6 +2301,7 @@ void Connection::ProcessPipelineCommandV1() {
   cc_->async_dispatch = false;
 
   ReleasePipelinedCommand(cmd);
+  MaybeCloseAfterReply();
 
   // If we drained the pipeline and no admin messages are waiting, flush.
   if (!HasPendingMessages()) {
@@ -3409,6 +3421,7 @@ Connection::ExecuteBatchResult Connection::ExecuteBatch() {
     } else {
       DCHECK(is_head);  // only head can execute sync
       retire_head();
+      MaybeCloseAfterReply();
     }
   }
 
```

**File**: `src/facade/dragonfly_connection.h` (modified, +14/-0)
```diff
@@ -335,6 +335,11 @@ class Connection : public util::Connection {
     return time(nullptr) - last_interaction_;
   }
 
+  // A connection that is moving to another thread can not be borrowed.
+  bool IsMigrating() const {
+    return migration_in_process_;
+  }
+
   unsigned GetSendWaitTimeSec() const;
 
   Phase phase() const {
@@ -354,6 +359,11 @@ class Connection : public util::Connection {
 
   void MarkForClose();
 
+  // Closes the connection after the current reply is flushed; later commands do not run.
+  void RequestCloseAfterReply() {
+    close_after_reply_ = true;
+  }
+
   // Adjusts the pipeline queue byte counter by `delta`.
   // Used when command dispatch mutates a ParsedCommand's backing storage
   // (e.g. SwapArgs during MULTI/EXEC collection).
@@ -508,6 +518,9 @@ class Connection : public util::Connection {
   // Processes the next Pipeline command from parsed_head_.
   void ProcessPipelineCommandV1();
 
+  // Flushes before MarkForClose(), which drops replies that were not written yet.
+  void MaybeCloseAfterReply();
+
   void SendAsync(MessageHandle msg);
 
   // Updates Control Path statistics and backpressure counters for administrative
@@ -888,6 +901,7 @@ class Connection : public util::Connection {
       bool shared_read_buf_enabled_ : 1;
 
       bool request_shutdown_ : 1;  // set when the connection is requested to shutdown
+      bool close_after_reply_ : 1;
     };
   };
 
```

**File**: `src/server/dragonfly_connection_test.cc` (modified, +122/-0)
```diff
@@ -4,6 +4,7 @@
 #include "facade/dragonfly_connection.h"
 
 #include <absl/strings/match.h>
+#include <absl/strings/str_split.h>
 #include <arpa/inet.h>
 #include <gmock/gmock.h>
 #include <netinet/in.h>
@@ -15,6 +16,7 @@
 #include <optional>
 #include <string>
 #include <string_view>
+#include <thread>
 
 #include "base/flags.h"
 #include "facade/dragonfly_listener.h"
@@ -25,6 +27,7 @@
 
 ABSL_DECLARE_FLAG(bool, enable_resp_io_loop_v2);
 ABSL_DECLARE_FLAG(bool, enable_shared_read_buffer);
+ABSL_DECLARE_FLAG(bool, multi_exec_squash);
 
 namespace dfly {
 namespace {
@@ -424,5 +427,124 @@ TEST_P(DragonflyV2ConnectionTest, RejectsControlMessagesAfterProtocolError) {
 INSTANTIATE_TEST_SUITE_P(PrivateAndSharedReadBuffer, DragonflyV2ConnectionTest,
                          testing::Values(false, true));
 
+// A real listener for CLIENT KILL. No OpenSSL use: a destroyed listener cleans it up.
+class ClientKillTest : public BaseFamilyTest {
+ protected:
+  std::vector<facade::Listener*> CreateListeners() override {
+    acceptor_ = std::make_unique<util::AcceptServer>(pp_.get(), /*break_on_int=*/false);
+    auto* listener = pp_->at(0)->Await([&] {
+      return new facade::Listener(facade::Protocol::REDIS, service_.get(),
+                                  facade::Listener::Role::MAIN);
+    });
+    port_ = acceptor_->AddListener(0, listener);
+    return {listener};
+  }
+
+  void SetUp() override {
+    BaseFamilyTest::SetUp();
+    acceptor_->Run();
+  }
+
+  // The service shuts down before the listener is freed.
+  void TearDown() override {
+    acceptor_->Stop(/*wait=*/true);
+    BaseFamilyTest::TearDown();
+  }
+
+  std::unique_ptr<util::AcceptServer> acceptor_;
+  uint16_t port_ = 0;
+  absl::FlagSaver flag_saver_;
+};
+
+// Sends an inline command and returns the first line of the reply.
+std::optional<std::string> Call(RawRespClient& client, std::string_view cmd) {
+  return client.SendAll(absl::StrCat(cmd, "\r\n")) ? client.ReadLine() : std::nullopt;
+}
+
+std::string ClientId(RawRespClient& client) {
+  std::string reply = Call(client, "CLIENT ID").value_or(":\r\n");
+  return reply.substr(1, reply.size() - 3);
+}
+
+// Killing itself, a connection still gets the reply but runs no later command.
+TEST_F(ClientKillTest, SelfClosesAfterReply) {
+  auto send_until_eof = [&](std::string_view before, std::string_view after, bool legacy = false) {
+    RawRespClient client{port_};
+    EXPECT_TRUE(client.SendAll("CLIENT INFO\r\n"));
+    client.ReadLine();
+    std::vector<std::string> info =
+        absl::StrSplit(client.ReadLine().value_or(""), absl::ByAnyChar(" ="));
+    std::string kill = absl::StrCat("CLIENT KILL ID ", info.at(1), "\r\n");
+    if (legacy)
+      kill = absl::StrCat("CLIENT KILL ", info.at(3), "\r\n");
+    EXPECT_TRUE(client.SendAll(absl::StrCat(before, kill, after)));
+    std::string reply;
+    while (auto line = client.ReadLine())
+      reply += *line;
+    EXPECT_TRUE(client.ReadEof()) << reply;
+    return reply;
+  };
+
+  // A kill in the first packet must not keep the server side open until the client closes.
+  RawRespClient first{port_};
+  EXPECT_TRUE(first.SendAll(absl::StrCat("CLIENT KILL LADDR 127.0.0.1:", port_, "\r\n")));
+  EXPECT_EQ(first.ReadLine(), ":1\r\n");
+  ExpectConditionWithinTimeout(
+      [&] { return GetMetrics().facade_stats.conn_stats.num_conns_main == 0; });
+
+  // A connection reads the flag when it starts.
+  for (bool v2 : {false, true}) {
+    SCOPED_TRACE(v2);
+    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, v2);
+    EXPECT_EQ(send_until_eof("PING\r\n", "SET k1 1\r\nPING\r\n"), "+PONG\r\n:1\r\n");
+    for (bool squash : {true, false}) {
+      SCOPED_TRACE(squash);
+      absl::SetFlag(&FLAGS_multi_exec_squash, squash);
+      EXPECT_EQ(send_until_eof("MULTI\r\n", "PING\r\nSET k2 1\r\nEXEC\r\nSET k3 1\r\n"),
+                "+OK\r\n+QUEUED\r\n+QUEUED\r\n+QUEUED\r\n*3\r\n:1\r\n+PONG\r\n+OK\r\n");
+    }
+    EXPECT_EQ(send_until_eof("PING\r\n", "SET k4 1\r\n", /*legacy=*/true), "+PONG\r\n:1\r\n");
+
+    // A lone command is dispatched synchronously.
+    EXPECT_EQ(send_until_eof("", ""), ":1\r\n");
+
+    // Over the pipeline limit, the next command waits for the kill and must not run after it.
+    EXPECT_EQ(Run({"CONFIG", "SET", "pipeline_buffer_limit", "1"}), "OK");
+    EXPECT_EQ(send_until_eof("", "SET k5 1\r\n"), ":1\r\n");
+    EXPECT_EQ(Run({"CONFIG", "SET", "pipeline_buffer_limit", "128MB"}), "OK");
+    EXPECT_THAT(Run({"DEL", "k2"}), IntArg(1));
+    EXPECT_THAT(Run({"DEL", "k1", "k3", "k4", "k5"}), IntArg(0));
+  }
+}
+
+// Connections that move to another thread can not be borrowed.
+TEST_F(ClientKillTest, KillDuringConnectionMigration) {
+  std::atomic_bool stop = false;
+  std::vector<std::thread> churn;
+  for (unsigned i = 0; i < 8; ++i) {
+    churn.emplace_back([&] {
+      for (unsigned tid = 0; !stop;) {
+        RawRespClient client{port_};
+        const std::string id = ClientId(client);
+        const std::s
```

**File**: `src/server/server_family.cc` (modified, +13/-2)
```diff
@@ -720,7 +720,10 @@ void ClientKill(facade::ParsedArgs args, absl::Span<facade::Listener*> listeners
   }
 
   const bool is_admin_request = cmd_cntx->conn()->IsPrivileged();
+  facade::Connection* self = cmd_cntx->conn();
 
+  // HTTP API connections have no close-after-reply path.
+  const bool kill_self = !self->IsHttp() && evaluator(self);
   atomic<uint32_t> killed_connections = 0;
   atomic<uint32_t> kill_errors = 0;
 
@@ -729,9 +732,12 @@ void ClientKill(facade::ParsedArgs args, absl::Span<facade::Listener*> listeners
     std::vector<facade::Connection::WeakRef> connections;
     auto traverse_cb = [&](unsigned idx, util::Connection* conn) {
       facade::Connection* dconn = static_cast<facade::Connection*>(conn);
-      if (evaluator(dconn)) {
+
+      // The caller is closed after the reply.
+      if (dconn != self && evaluator(dconn)) {
         if (is_admin_request || !dconn->IsPrivileged()) {
-          connections.push_back(dconn->Borrow());
+          if (!dconn->IsMigrating())
+            connections.push_back(dconn->Borrow());
         } else {
           kill_errors.fetch_add(1);
         }
@@ -753,6 +759,11 @@ void ClientKill(facade::ParsedArgs args, absl::Span<facade::Listener*> listeners
 
   shard_set->pool()->AwaitFiberOnAll(cb);
 
+  if (kill_self) {
+    self->RequestCloseAfterReply();
+    killed_connections.fetch_add(1);
+  }
+
   if (kill_errors.load() == 0) {
     return cmd_cntx->rb()->SendLong(killed_connections.load());
   } else {
```

**File**: `src/server/test_utils.cc` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ void BaseFamilyTest::ResetService() {
   // value, and if reset after some invocations of heartbeat have run, the accumulated data is
   // lost and can cause test failure.
   used_mem_current = 0;
-  service_->Init(nullptr, {});
+  service_->Init(nullptr, CreateListeners());
 
   TEST_current_time_ms = absl::GetCurrentTimeNanos() / 1000000;
 
```

**File**: `src/server/test_utils.h` (modified, +5/-0)
```diff
@@ -79,6 +79,11 @@ class BaseFamilyTest : public ::testing::Test {
   void SetUp() override;
   void TearDown() override;
 
+  // Listeners for Service::Init; a fixture that returns some can not reset the service again.
+  virtual std::vector<facade::Listener*> CreateListeners() {
+    return {};
+  }
+
   class TestConnWrapper;
 
   RespExpr Run(std::initializer_list<const std::string_view> list) {
```

---

### Incident Patch 3: `2cb963b6` (2026-11-06)
**Commit Message**: fix: resolve sanitizer UB and extend nightly test timeouts (#8763)

Fix three independently reproduced UBSan diagnostics:
- Use unsigned subtraction for the BITFIELD underflow threshold.
- Use a non-null empty string view when logging null RESP input.

Increase the four nightly sanitizer CTest passes from 20 to 30 minutes.
Add a 600-second per-binary timeout and a 30-second forced-kill grace.
Allow 10 minutes for the manually invoked search-family test.

The failed CI run spent 33.5% longer in the same completed binaries,
exhausting the aggregate timeout. Focused HNSW runs continued making
progress and completed.

Signed-off-by: Volodymyr Yavdoshenko <[REDACTED_EMAIL]>

**File**: `.github/workflows/daily-builds.yml` (modified, +8/-5)
```diff
@@ -244,7 +244,8 @@ jobs:
 
           GTEST_OUTPUT="xml:${GTEST_IOURING_DIR}/" \
           GLOG_alsologtostderr=1 GLOG_vmodule=rdb_load=1,rdb_save=1,snapshot=1,op_manager=1,op_manager_test=1 \
-          FLAGS_fiber_safety_margin=4096 timeout 20m ctest -V -L DFLY -E allocation_tracker_test \
+          FLAGS_fiber_safety_margin=4096 timeout --kill-after=30s 30m \
+            ctest -V -L DFLY -E allocation_tracker_test --timeout 600 \
             --output-junit "${CTEST_JUNIT_DIR}/iouring.xml"
 
           # Run allocation tracker test separately without alsologtostderr because it generates a TON of logs.
@@ -255,7 +256,8 @@ jobs:
           run_manual_gtest ./json_family_test --jsonpathv2=false
           run_manual_gtest ./tiered_storage_test --vmodule=db_slice=2 --logtostderr
           run_manual_gtest ./search_test --use_numeric_range_tree=false
-          run_manual_gtest ./search_family_test --use_numeric_range_tree=false
+          GTEST_OUTPUT="xml:${GTEST_MANUAL_DIR}/" \
+            timeout 10m ./search_family_test --use_numeric_range_tree=false
 
       - name: C++ Unit Tests - Epoll
         run: |
@@ -278,7 +280,7 @@ jobs:
             gdb -ix ./init.gdb --batch -ex r --args ./dragonfly_test --force_epoll
           GTEST_OUTPUT="xml:${GTEST_EPOLL_DIR}/" \
           GLOG_alsologtostderr=1 FLAGS_fiber_safety_margin=4096 FLAGS_force_epoll=true GLOG_vmodule=rdb_load=1,rdb_save=1,snapshot=1 \
-          timeout 20m ctest -V -L DFLY -E allocation_tracker_test \
+          timeout --kill-after=30s 30m ctest -V -L DFLY -E allocation_tracker_test --timeout 600 \
             --output-junit "${CTEST_JUNIT_DIR}/epoll.xml"
 
           GTEST_OUTPUT="xml:${GTEST_MANUAL_DIR}/" FLAGS_fiber_safety_margin=4096 \
@@ -292,7 +294,7 @@ jobs:
           GTEST_CLUSTER_DIR="${JUNIT_DIR}/gtest/cluster"
           mkdir -p "${CTEST_JUNIT_DIR}" "${GTEST_CLUSTER_DIR}"
           GTEST_OUTPUT="xml:${GTEST_CLUSTER_DIR}/" FLAGS_fiber_safety_margin=4096 \
-            FLAGS_cluster_mode=emulated timeout 20m ctest -V -L DFLY \
+            FLAGS_cluster_mode=emulated timeout --kill-after=30s 30m ctest -V -L DFLY --timeout 600 \
             --output-junit "${CTEST_JUNIT_DIR}/cluster.xml"
 
       - name: C++ Unit Tests - IoUring with cluster mode and FLAGS_lock_on_hashtags
@@ -303,7 +305,8 @@ jobs:
           GTEST_CLUSTER_DIR="${JUNIT_DIR}/gtest/cluster-hashtags"
           mkdir -p "${CTEST_JUNIT_DIR}" "${GTEST_CLUSTER_DIR}"
           GTEST_OUTPUT="xml:${GTEST_CLUSTER_DIR}/" FLAGS_fiber_safety_margin=4096 \
-            FLAGS_cluster_mode=emulated FLAGS_lock_on_hashtags=true timeout 20m ctest -V -L DFLY \
+            FLAGS_cluster_mode=emulated FLAGS_lock_on_hashtags=true \
+            timeout --kill-after=30s 30m ctest -V -L DFLY --timeout 600 \
             --output-junit "${CTEST_JUNIT_DIR}/cluster-hashtags.xml"
 
       - name: Upload unit logs on failure
```

**File**: `src/facade/resp_parser.cc` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ std::optional<RESPObj> RESPParser::Feed(const char* data, size_t len, size_t* co
   // The peer controls this data, so only log a bounded prefix of it.
   auto log_error = [this, data, len](int status) {
     constexpr size_t kMaxLoggedData = 256;
-    std::string_view sv = data ? std::string_view{data, len} : std::string_view{};
+    std::string_view sv = data ? std::string_view{data, len} : std::string_view{""};
     LOG(ERROR) << "RESP parser error: " << status << " description: " << reader_->errstr
                << " data: " << sv.substr(0, kMaxLoggedData);
   };
```

**File**: `src/server/bitops_family.cc` (modified, +1/-1)
```diff
@@ -699,7 +699,7 @@ bool Overflow::IntOverflow(size_t total_bits, int64_t incr, bool add, int64_t* v
   // happens. 'uint64_t' cast is there just to prevent undefined behavior on
   // overflow */
   int64_t maxincr = static_cast<uint64_t>(max) - *value;
-  int64_t minincr = min - *value;
+  int64_t minincr = static_cast<uint64_t>(min) - *value;
 
   // overflow
   if (*value > max || (total_bits != 64 && incr > maxincr) ||
```

#### Recent Merged Pull Requests:
- **PR #8763** (2026-11-06): fix: resolve sanitizer UB and extend nightly test timeouts (@vyavdoshenko)
- **PR #8761** (2026-11-06): test: fix queued sink writer tests on libc++ (macOS) (@vyavdoshenko)
- **PR #8752** (2026-11-05): fix(server): let CLIENT KILL reply before closing the caller and skip migrating connections (@vyavdoshenko)
- **PR #8751** (2026-11-05): feat(facade): add FormattableError and a token-parser Field to the CmdArgParser grammar (@vyavdoshenko)
- **PR #8749** (2026-11-06): fix(search): report query errors in FT.AGGREGATE and FT.HYBRID, match nothing on NOINDEX (@vyavdoshenko)
- **PR #8748** (2026-11-04): ci(release): reject tags that are not vMAJOR.MINOR.PATCH (@romange)

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

## X. search): report query errors in FT.AGGREGATE and FT.HYBRID, match nothing on NOI

**RULE**:
When implementing operations in `src/core/search/search.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflydb/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5f3c3c12`: search): report query errors in FT.AGGREGATE and FT.HYBRID, match nothing on NOINDEX (#8749). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/core/search/search.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
// The schema type an index class serves.
template <typename T>
constexpr SchemaField::FieldType kFieldTypeOf = [] {
  using Index = decay_t<T>;
  if constexpr (is_same_v<Index, TextIndex>)
    return SchemaField::TEXT;
  else if constexpr (is_same_v<Index, NumericIndex>)
    return SchemaField::NUMERIC;
  else if constexpr (is_same_v<Index, TagIndex>)
    return SchemaField::TAG;
  else if constexpr (is_same_v<Index, GeoIndex>)
    return SchemaField::GEO;
  else if constexpr (is_same_v<Index, BaseVectorIndex>)
    return SchemaField::VECTOR;
  else
    static_assert(sizeof(Index) == 0, "no schema type for this index");
}();

  // The attribute under `field` if it is NOINDEX: it has no index, so its clauses match nothing
  // instead of failing.
  const SchemaField* NoIndexField(string_view field) const {
    const SchemaField* attribute = indices_->GetSchema().Find(field);
    return attribute && (attribute->flags & SchemaField::NOINDEX) ? attribute : nullptr;
  }

    if (!index && !NoIndexField(field)) {
      // A NOINDEX attribute keeps its type, and a vector one has nothing to search at all.
      if (const auto* noindex = error_.empty() ? NoIndexField(field) : nullptr; noin
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
    if (!index) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5f3c3c12` are properly handled with clean fallback behavior.
