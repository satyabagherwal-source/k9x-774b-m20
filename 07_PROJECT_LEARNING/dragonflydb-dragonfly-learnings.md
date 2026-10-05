# Forensic Learning Record (Deep Inspection): dragonflydb/dragonfly

> **Canonical Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:44:27.238Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflydb/dragonfly`
- **Description**: A modern replacement for Redis and Memcached
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 31747 stars

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
    for (size_t i = buddy_start; i < buddy_start + buddy_chunk_size; ++i) {
      segment_[i] = keep;
    }

    // Free buddy segment
    PMR_NS::polymorphic_allocator<SegmentType> pa(segment_.get_allocator());
    using alloc_traits = std::allocator_traits<decltype(pa)>;
    alloc
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

### Core Architecture Module: `src/core/dense_set.h`
```
// Copyright 2022, DragonflyDB authors.  All rights reserved.
// See LICENSE for licensing terms.
//
#pragma once

#include <cassert>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <type_traits>
#include <vector>

#include "core/detail/stateless_allocator.h"

namespace dfly {

// DenseSet is a nice but over-optimized data-structure. Probably is not worth it in the first
// place but sometimes the OCD kicks in and one can not resist.
// The advantage of it over redis-dict is smaller meta-data waste.
// dictEntry is 24 bytes, i.e it uses at least 32N bytes where N is the expected length.
// dict requires to allocate dictEntry per each addition in addition to the supplied key.
// It also wastes space in case of a set because it stores a value pointer inside dictEntry.
// To summarize:
// 100% utilized dict uses N*24 + N*8 = 32N bytes not including the key space.
// for 75% utilization (1/0.75 buckets): N*1.33*8 + N*24 = 35N
//
// This class uses 8 bytes per bucket (similarly to dictEntry*) but it used it for both
// links and keys. For most cases, we remove the need for another redirection layer
// and just store the key, so no "dictEntry" allocations occur.
// For those cells that require chaining, the bucket is
// changed in run-time to represent a linked chain.
// Additional feature - in order to to reduce collisions, we insert items into
// neighbour cells but only if they are empty (not chains). This way we reduce the number of
// empty (unused) spaces at full utilization from 36% to ~21%.
// 100% utilized table requires: N*8 + 0.2N*16 = 11.2N bytes or ~20 bytes savings.
// 75% utilization: N*1.33*8 + 0.12N*16 = 13N or ~22 bytes savings per record.
// with potential replacements of hset/zset data structures.
// static_assert(sizeof(dictEntry) == 24);

class DenseSet {
  struct DenseLinkKey;
  // we can assume that high 12 bits of user address space
  // can be used for tagging. At most 52 bits of address are reserved for
  // some configurations, and usually it's 48 bits.
  // https://docs.kernel.org/arch/arm64/memory.html
  static constexpr size_t kLinkBit = 1ULL << 52;
  static constexpr size_t kDisplaceBit = 1ULL << 53;
  static constexpr size_t kDisplaceDirectionBit = 1ULL << 54;
  static constexpr size_t kTtlBit = 1ULL << 55;
  static constexpr size_t kTagMask = 4095ULL << 52;  // we reserve 12 high bits.

  class DensePtr {
   public:
    explicit DensePtr(void* p = nullptr) : ptr_(p) {
    }

    // Imports the object with its metadata except the link bit that is reset.
    static DensePtr From(DenseLinkKey* o) {
      DensePtr res;
      res.ptr_ = (void*)(o->uptr() & (~kLinkBit));
      return res;
    }

    uint64_t uptr() const {
      return uint64_t(ptr_);
    }

    bool IsObject() const {
      return (uptr() & kLinkBit) == 0;
    }

    bool IsLink() const {
      return (uptr() & kLinkBit) != 0;
    }

    bool HasTtl() const {
      return (uptr() & kTtlBit) != 0;
    }

    bool IsEmpty() const {
      return ptr_ == nullptr;
    }

    void* Raw() const {
      return (void*)(uptr() & ~kTagMask);
    }

    bool IsDisplaced() const {
      return (uptr() & kDisplaceBit) == kDisplaceBit;
    }

    void SetLink(DenseLinkKey* lk) {
      ptr_ = (void*)(uintptr_t(lk) | kLinkBit);
    }

    void SetDisplaced(int direction) {
      ptr_ = (void*)(uptr() | kDisplaceBit);
      if (direction == 1) {
        ptr_ = (void*)(uptr() | kDisplaceDirectionBit);
      }
    }

    void ClearDisplaced() {
      ptr_ = (void*)(uptr() & ~(kDisplaceBit | kDisplaceDirectionBit));
    }

    // returns 1 if the displaced node is right of the correct bucket and -1 if it is left
    int GetDisplacedDirection() const {
      return (uptr() & kDisplaceDirectionBit) == kDisplaceDirectionBit ? 1 : -1;
    }

    void SetTtl(bool b) {
      if (b)
        ptr_ = (void*)(uptr() | kTtlBit);
      else
        ptr_ = (void*)(uptr() & (~kTtlBit));
    }

    void Reset() {
      ptr_ = nullptr;
    }

    void* GetObject() const {
      if (IsObject()) {
        return Raw();
      }

      return AsLink()->Raw();
    }

    // Sets pointer but preserves tagging info
    void SetObject(void* obj) {
      assert(IsObject());
      ptr_ = (void*)((uptr() & kTagMask) | (uintptr_t(obj) & ~kTagMask));
    }

    DenseLinkKey* AsLink() {
      return (DenseLinkKey*)Raw();
    }

    const DenseLinkKey* AsLink() const {
      return (const DenseLinkKey*)Raw();
    }

    DensePtr* Next() {
      if (!IsLink()) {
        return nullptr;
      }

      return &AsLink()->next;
    }

    const DensePtr* Next() const {
      if (!IsLink()) {
        return nullptr;
      }

      return &AsLink()->next;
    }

   private:
    void* ptr_ = nullptr;
  };

  struct DenseLinkKey : public DensePtr {
    DensePtr next;  // could be LinkKey* or Object *.
  };

  static_assert(sizeof(DensePtr) == sizeof(uintptr_t));
  static_assert(sizeof(DenseLinkKey) == 2 * sizeof(uintptr_t));

 protected:
  using DensePtrAllocator = StatelessAllocator<DensePtr>;
  using ChainVectorIterator = std::vector<DensePtr, DensePtrAllocator>::iterator;
  using ChainVectorConstIterator = std::vector<DensePtr, DensePtrAllocator>::const_iterator;

  class IteratorBase {
    friend class DenseSet;

   public:
    IteratorBase(DenseSet* owner, ChainVectorIterator list_it, DensePtr* e)
        : owner_(owner), curr_list_(list_it), curr_entry_(e) {
    }

    // returns the expiry time of the current entry or UINT32_MAX if no ttl is set.
    uint32_t ExpiryTime() const {
      return curr_entry_->HasTtl() ? owner_->ObjExpireTime(curr_entry_->GetObject()) : UINT32_MAX;
    }

    void SetExpiryTime(uint32_t ttl_sec);

    bool HasExpiry() const {
      return curr_entry_->HasTtl();
    }

   protected:
    IteratorBase() : owner_(nullptr), curr_entry_(nullptr) {
    }

    IteratorBase(const DenseSet* owner, bool is_end);

    void Advance();

    DenseSet* owner_;
    ChainVectorIterator curr_list_;
    DensePtr* curr_entry_;
  };

 public:
  static constexpr uint32_t kMaxBatchLen = 32;

  explicit DenseSet();
  virtual ~DenseSet();

  void Clear() {
    ClearStep(0, entries_.size());
  }

  // Returns the next bucket index that should be cleared.
  // Returns BucketCount when all objects are erased.
  uint32_t ClearStep(uint32_t start, uint32_t count);

  // Returns the number of elements in the map. Note that it might be that some of these elements
  // have expired and can't be accessed.
  size_t UpperBoundSize() const {
    return size_;
  }

  // Returns an accurate size, post-expiration. O(n).
  size_t SizeSlow();

  bool Empty() const {
    return size_ == 0;
  }

  size_t BucketCount() const {
    return entries_.size();
  }

  size_t ObjMallocUsed() const {
    return obj_malloc_used_;
  }

  size_t SetMallocUsed() const {
    return entries_.capacity() * sizeof(DensePtr) + num_links_ * sizeof(DenseLinkKey);
  }

  using ItemCb = std::function<void(const void*)>;

  uint32_t Scan(uint32_t cursor, const ItemCb& cb) const;
  void Reserve(size_t sz);

  // Shrinks the table to the specified size. The size must be a power of 2,
  // >= kMinSize, and >= current number of elements.
  // This method should be called explicitly when memory reclamation is needed.
  void Shrink(size_t new_size);

  void Fill(DenseSet* other) const;

  // set an abstract time that allows expiry.
  void set_time(uint32_t val) {
    time_now_ = val;
  }

  uint32_t time_now() const {
    return time_now_;
  }

  bool ExpirationUsed() const {
    return expiration_used_;
  }

 protected:
  // Virtual functions to be implemented for generic data
  virtual uint64_t Hash(const void* obj, uint32_t cookie) const = 0;
  virtual bool ObjEqual(const void* left, const void* right, uint32_t right_cookie) const = 0;
  virtual size_t ObjectAllocSize(const void* obj) const = 0;
  virtual uint32_t ObjExpireTime(const void* obj) const = 0;
  virtual void ObjUpdateExpireTime(const void* obj, uint32_t ttl_sec) = 0;
  virtual void ObjDelete(void* obj) const = 0;
  virtual void* ObjectClone(const void* obj, bool has_ttl, bool add_ttl) const = 0;

  void CollectExpired();

  bool EraseInternal(void* obj, uint32_t cookie) {
    auto [prev, found] = Find(obj, BucketId(obj, cookie), cookie);
    if (found) {
      Delete(prev, found);
      return true;
    }
    return false;
  }

  // Like EraseInternal but returns the detached object instead of deleting it.
  // Returns nullptr if the object was not found.
  void* DetachInternal(void* obj, uint32_t cookie) {
    auto [prev, found] = Find(obj, BucketId(obj, cookie), cookie);
    if (found) {
      return Delete(prev, found, true);
    }
    return nullptr;
  }

  void* FindInternal(const void* obj, uint64_t hashcode, uint32_t cookie) const;

  IteratorBase FindIt(const void* ptr, uint32_t cookie) {
    if (Empty())
      return IteratorBase{};

    auto [bid, _, curr] = Find2(ptr, BucketId(ptr, cookie), cookie);
    if (curr) {
      return IteratorBase(this, entries_.begin() + bid, curr);
    }
    return IteratorBase{};
  }

  // Get iterator to start of random non-empty chain (bucket)
  ChainVectorIterator GetRandomChain();

  // Wrap RandomChain() into iterator and advance with reservoir sampling
  IteratorBase GetRandomIterator();

  void* PopInternal();

  void IncreaseMallocUsed(size_t delta) {
    obj_malloc_used_ += delta;
  }

  void DecreaseMallocUsed(size_t delta) {
    obj_malloc_used_ -= delta;
  }

  // Returns the previous object if it has been replaced.
  // nullptr, if obj was added.
  void* AddOrReplaceObj(void* obj, bool has_ttl);

  // Assumes that the object does not exist in the set.
  void AddUnique(void* obj, bool has_ttl, uint64_t hashcode);

  void Prefetch(uint64_t hash);

 private:
  DenseSet(const DenseSet&) = delete;
  DenseSet& operator=(DenseSet&) = delete;

  bool Equal(DensePtr dptr, const void* ptr, uint32_t cookie) const;

  struct CloneItem {
    DensePtr ptr;
    void* obj = nullptr;
    bool has_t
```

### Core Architecture Module: `src/core/detail/bitpacking.h`
```
// Copyright 2022, Roman Gershman.  All rights reserved.
// See LICENSE for licensing terms.
//

#pragma once

#include <cstddef>
#include <cstdint>

namespace dfly {

namespace detail {

bool validate_ascii_fast(const char* src, size_t len);

// unpacks 8->7 encoded blob back to ascii.
// generally, we can not unpack inplace because ascii (dest) buffer is 8/7 bigger than
// the source buffer.
// however, if binary data is positioned on the right of the ascii buffer with empty space on the
// left than we can unpack inplace.
void ascii_unpack(const uint8_t* bin, size_t ascii_len, char* ascii);
void ascii_unpack_simd(const uint8_t* bin, size_t ascii_len, char* ascii);

// Access a single byte in a 7-bit ASCII-packed string without unpacking the entire buffer.
// These helpers read/write the ASCII byte at logical position `idx` in the unpacked string
// directly from/into the packed `bin` representation.
// It's up to caller to verify:
// `1. idx` must be less than `ascii_len` to avoid out-of-bounds access.
// 2. `ascii` must be less than 128 (7-bit ASCII) for packing.
uint8_t ascii_unpack_byte(const uint8_t* bin, size_t ascii_len, size_t idx);
void ascii_pack_byte(uint8_t* bin, size_t ascii_len, size_t idx, uint8_t ascii);

// packs ascii string (does not verify) into binary form saving 1 bit per byte on average (12.5%).
void ascii_pack(const char* ascii, size_t len, uint8_t* bin);
void ascii_pack2(const char* ascii, size_t len, uint8_t* bin);

// SIMD implementation 1 of ascii_pack.
void ascii_pack_simd(const char* ascii, size_t len, uint8_t* bin);

// SIMD implementation 2 of ascii_pack.
void ascii_pack_simd2(const char* ascii, size_t len, uint8_t* bin);

bool compare_packed(const uint8_t* packed, const char* ascii, size_t ascii_len);

// maps ascii len to 7-bit packed length. Each 8 bytes are converted to 7 bytes.
inline constexpr size_t binpacked_len(size_t ascii_len) {
  // Avoid multiplication overflow.
  return ascii_len - ascii_len / 8;
}

// converts 7-bit packed length back to ascii length. Note that this conversion
// is not accurate since it maps 7 bytes to 8 bytes (rounds up), while we may have
// 7 byte strings converted to 7 byte as well.
inline constexpr size_t ascii_len(size_t bin_len) {
  return (bin_len * 8) / 7;
}

// ---------------------------------------------------------------------------
// ascii_try_pack / ascii_unpack_fast performance
//
// Throughput in GiB/s (see BM_AsciiCodec in compact_object_test.cc, run with
// `--bench --benchmark_filter=AsciiCodec` to reproduce). ascii_pack* neither validate nor report
// failure; "validate + X" adds a separate validate_ascii_fast() pass to match what ascii_try_pack
// does in a single pass.
//
// Release build, x86-64 AVX2/BMI2 dispatch, AMD Ryzen AI 7 350:
//                       32     64   1024   4096
//   ascii_pack            4.1    4.9    5.8    6.0
//   ascii_pack2           5.6    6.9    8.7    8.6
//   ascii_pack_simd       4.8    9.4   19.1   18.5
//   ascii_pack_simd2      5.3   10.2   32.5   32.8
//   validate + pack2      5.0    6.4    7.8    7.3
//   validate + simd2      4.8    8.8   20.4   18.2
//   ascii_try_pack       12.9   17.9   47.3   51.9
//
//   ascii_unpack          3.6    3.9    4.1    4.1
//   ascii_unpack_simd     4.3    8.4   18.4   18.1
//   ascii_unpack_fast    19.2   28.6   49.8   44.3
//
// Release build, aarch64 NEON dispatch, AWS Graviton2 / Neoverse-N1:
//                       32     64   1024   4096
//   ascii_pack            1.7    1.9    2.2    2.2
//   ascii_pack2           2.3    2.7    3.3    3.3
//   ascii_pack_simd       2.0    2.8    3.9    4.0
//   ascii_pack_simd2      2.0    2.8    4.0    4.1
//   validate + pack2      1.6    1.9    2.4    2.4
//   validate + simd2      1.4    2.0    2.8    2.8
//   ascii_try_pack        2.8    3.9    6.0    6.1
//
//   ascii_unpack          1.7    1.8    1.9    1.9
//   ascii_unpack_simd     2.1    2.6    3.6    3.6
//   ascii_unpack_fast     3.8    4.0    4.9    4.9
//
// Why it's faster:
//  - ascii_try_pack validates and packs in one pass (each loaded vector is OR'ed into an error
//    accumulator right where it is already being packed), instead of two full passes over memory
//    like the "validate + X" rows above.
//  - x86: AVX2 packs 32 ascii bytes (28 packed) per iteration, twice the legacy SSE3 path's 16
//    (14 packed), and merges the 7-bit fields with a multiply-based trick (2 ops replace 2
//    mask+shift+or stages). The scalar fallback uses a single BMI2 pext/pdep instruction in place
//    of a multi-step manual bit-scatter.
//  - aarch64: the block width is unchanged (NEON is 128-bit in both the legacy and the new code).
//    The gain instead comes from vsli's fused shift-and-insert, which merges the 7-bit fields in 3
//    instructions with no masks needed, versus the mask+shift+or chain that ascii_pack_simd/_simd2
//    also use on this architecture; and from an exact 14-byte NEON store that keeps lengths that
//    are 0 or 1 modulo 16 on that path, where x86 (lacking a cheap exact-14-byte store) drops to
//    the scalar tail.
//  - Leftover bytes (any length not a multiple of the block size) are copied by a small helper
//    doing at most two overlapping loads and stores sized to the remainder, instead of the
//    byte-at-a-time loop the legacy functions fall back to above.
// ---------------------------------------------------------------------------

// The two functions below only ever run the widest kernel this build targets, so a caller can
// never reach the others and they would go untested. Every kernel therefore also gets its own
// entry point here. They all honour the contract of the function they implement, for any length,
// so they are interchangeable and tests can drive them side by side over the same input.
namespace impl {

#if defined(__SSE3__) || defined(__aarch64__)
#define DFLY_ASCII_TRY_PACK_HAS_SIMD 1
#endif
#if defined(__AVX2__) && defined(__x86_64__)
#define DFLY_ASCII_TRY_PACK_HAS_AVX2 1
#endif

size_t ascii_try_pack_scalar(const char* ascii, size_t len, uint8_t* bin);
#ifdef DFLY_ASCII_TRY_PACK_HAS_SIMD
size_t ascii_try_pack_simd(const char* ascii, size_t len, uint8_t* bin);  // sse3 or neon
#endif
#ifdef DFLY_ASCII_TRY_PACK_HAS_AVX2
size_t ascii_try_pack_avx2(const char* ascii, size_t len, uint8_t* bin);
#endif

#if defined(__AVX2__) && defined(__x86_64__)
#define DFLY_ASCII_UNPACK_FAST_HAS_AVX2 1
#elif defined(__aarch64__)
#define DFLY_ASCII_UNPACK_FAST_HAS_NEON 1
#endif

void ascii_unpack_fast_scalar(const uint8_t* bin, size_t ascii_len, char* ascii);
#ifdef DFLY_ASCII_UNPACK_FAST_HAS_AVX2
void ascii_unpack_fast_avx2(const uint8_t* bin, size_t ascii_len, char* ascii);
#endif
#ifdef DFLY_ASCII_UNPACK_FAST_HAS_NEON
void ascii_unpack_fast_neon(const uint8_t* bin, size_t ascii_len, char* ascii);
#endif

}  // namespace impl

// Validates and packs a string of any length. Returns binpacked_len(len), or 0 if any byte is not
// 7-bit ASCII. `bin` must not overlap `ascii`, needs binpacked_len(len) bytes, and is written even
// on failure. Prefer this over ascii_pack when validation is needed; empty input also returns 0.
// Inline, so that a caller reaches the widest kernel this build targets with a single direct call
// instead of bouncing through an out of line dispatcher.
inline size_t ascii_try_pack(const char* ascii, size_t len, uint8_t* bin) {
#if defined(DFLY_ASCII_TRY_PACK_HAS_AVX2)
  return impl::ascii_try_pack_avx2(ascii, len, bin);
#elif defined(DFLY_ASCII_TRY_PACK_HAS_SIMD)
  return impl::ascii_try_pack_simd(ascii, len, bin);
#else
  return impl::ascii_try_pack_scalar(ascii, len, bin);
#endif
}

// Preferred unpack implementation, for a string of any length. Buffers need
// binpacked_len(ascii_len) readable and ascii_len writable bytes. In-place input must be
// right-aligned.
inline void ascii_unpack_fast(const uint8_t* bin, size_t ascii_len, char* ascii) {
#if defined(DFLY_ASCII_UNPACK_FAST_HAS_AVX2)
  impl::ascii_unpack_fast_avx2(bin, ascii_len, ascii);
#elif defined(DFLY_ASCII_UNPACK_FAST_HAS_NEON)
  impl::ascii_unpack_fast_neon(bin, ascii_len, ascii);
#else
  impl::ascii_unpack_fast_scalar(bin, ascii_len, ascii);
#endif
}

}  // namespace detail
}  // namespace dfly

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8366** (2026-09-23): **dragonfly/replication_test.py::test_client_pause_with_replica[df_seeder_factory0-df_factory0]**
  *Symptoms*: <!-- cppfly-ci:run/35655139657/attempt/1 -->  CI regression failure for `dragonfly/replication_test.py::test_client_pause_with_replica[df_seeder_factory0-df_factory0]`.  - Workflow: `.github/workflows/regression-tests.yml` - Commit: 3aa4e02551bbb80d4d6863c9e01d3c6ea21f9568 - Run: https://github.com/dragonflydb/dragonfly/actions/runs/35655139657 - Failed job: https://github.com/dragonflydb/dragonfly/actions/runs/35655139657/job/106516709863  The Release ARM64 io_uring job completed with an assertion at `tests/dragonfly/replication_test.py:1171`: after CLIENT PAUSE and seeding, `await seeder.compare(capture, port=replica.port)` returned false. This indicates master/replica data divergence, not infrastructure failure.
  **Post-Mortem & Fix Analysis**:
  > <!-- cppfly-ci:run/35693822668/attempt/1 -->  CI regression failure recurred for `dragonfly/replication_test.py::test_client_pause_with_replica[df_seeder_factory0-df_factory0]`.  - Workflow: `.github/workflows/regression-tests.yml` - Commit: 3aa4e02551bbb80d4d6863c9e01d3c6ea21f9568 - Run: https://github.com/dragonflydb/dragonfly/actions/runs/35693822668 - Failed job: https://github.com/dragonflydb/dragonfly/actions/runs/35693822668/job/106636242932  The Release x64 io_uring job (RESP I/O loop v2, three shards) completed with an assertion at `tests/dragonfly/replication_test.py:1171`: after `CLIENT PAUSE 4000 WRITE` and seeding, `await seeder.compare(capture, port=replica.port)` returned false. The captured diff shows replica key `k10974` missing the final three characters of the master string, confirming master/replica data divergence rather than infrastructure failure.
  > I had an idea about the sleeps in this test not being enough, but as it is running it on repeat doesn't catch any errors
  > there is still a potential fix we can try with `check_all_replicas_done` or similar

- **Issue #8365** (2026-09-22): **regression test fails test_dash_gc.py::test_gc_concurrent_with_seeding**
  *Symptoms*: https://github.com/dragonflydb/dragonfly/actions/runs/35636045881/job/106453591524
  **Post-Mortem & Fix Analysis**:
  > duplicate

- **Issue #8361** (2026-10-02): **Cannot replicate from / load RDB of Redis 8.10 (RDB Version 15): full-sync drops stream in a loop, file load fails and loader SIGSEGVs**
  *Symptoms*: ## Describe the bug  Dragonfly cannot consume RDB version 15 produced by Redis 8.10.2, in both modes:  **1. Live replication (full sync) never completes.** `--replicaof <redis-8.10-host>:6380` connects and authenticates fine, the master starts a diskless BGSAVE for SYNC, but the replica drops the RDB stream ~0.5s in and retries forever. Master (redis 8.10.2) logs this cycle every ~5s:  ``` * Starting BGSAVE for SYNC with target: replicas sockets * Background RDB transfer started by pid 761779 to parent process pipe * Connection with replica client id #3217 lost. # Diskless rdb transfer, last replica dropped, killing fork child. 761779:signal-handler Received SIGUSR1 in child, exiting now. ```  **2. Direct RDB file load fails, then the loader crashes.** Loading the same master's dump.rdb:  ``` E rdb_load.cc:2494] RDB Version 15 is not supported E server_family.cc:1551] Rdb load failed: Internal error when loading RDB file 2 *** SIGSEGV received at time=1789929171 on cpu 3 *** ```  The version gate at `rdb_load.cc` (`rdb_version_ < 5 || rdb_version_ > RDB_VERSION`, observed identical at master line 2494) rejects v15 via `errc::bad_version` — which is graceful — but a SIGSEGV follows during teardown of the failed load, which also poisons the replication retry loop with a crashing child.  ## To reproduce  1. `redis-server` 8.10.2 (standalone), add a few keys (plain SET + EXPIRE), run `BGSAVE`. 2. `dragonfly --port 6381 --dir <dir-with-dump> --dbfilename=dump.rdb --nodf_snapshot_f
  **Post-Mortem & Fix Analysis**:
  > Hi @Danceiny ,   We support Redis format up to version 7, so I think for now we can add a clear error and fix the crash.

- **Issue #8329** (2026-09-16): **list_familt_test failed**
  *Symptoms*: ``` 2026-09-16T09:06:50.8835537Z       Start  76: list_family_test 2026-09-16T09:06:50.8835689Z  2026-09-16T09:06:50.8835837Z 76: Test command: /__w/dragonfly/dragonfly/build/list_family_test 2026-09-16T09:06:50.8836155Z 76: Working Directory: /__w/dragonfly/dragonfly/build/src/server 2026-09-16T09:06:50.8836443Z 76: Test timeout computed to be: 10000000 2026-09-16T09:06:52.1142639Z 76: /__w/dragonfly/dragonfly/src/server/list_family_test.cc:175: Failure 2026-09-16T09:06:52.1143307Z 76: Value of: IsLocked(0, kKey1) 2026-09-16T09:06:52.1143603Z 76:   Actual: false 2026-09-16T09:06:52.1143947Z 76: Expected: true 2026-09-16T09:06:52.1144237Z 76:  2026-09-16T09:06:52.1144662Z 76: F0916 09:06:52.113715    4185 fibers.cc:15] Check failed: !impl_ Fiber destructor called on a joinable fiber DflyConn_6 2026-09-16T09:06:52.2529629Z 76: *** Check failure stack trace: *** 2026-09-16T09:06:52.2530076Z 76:     @     0x56231df2dc26  absl::lts_20250512::log_internal::LogMessage::PrepareToDie() 2026-09-16T09:06:52.2530462Z 76:     @     0x56231df2c394  absl::lts_20250512::log_internal::LogMessage::SendToLog() 2026-09-16T09:06:52.2530862Z 76:     @     0x56231df2c213  absl::lts_20250512::log_internal::LogMessage::Flush() 2026-09-16T09:06:52.2531207Z 76:     @     0x562319d60919  absl::lts_20250512::log_internal::Voidify::operator&&<>() 2026-09-16T09:06:52.2531522Z 76:     @     0x56231dbb67f1  util::fb2::Fiber::~Fiber() 2026-09-16T09:06:52.2531831Z 76:     @     0x562319a5e5bd  dfly::ListFamil

- **Issue #8303** (2026-09-23): **CI improvements - no scrambling (demultiplex) and core dumps**
  *Symptoms*: # General issue  Currently the CI output is `multiplexed` by different dragonfly (master/replica/cluster etc) processes. Each dragonfly instance also `multiplexes` its output from multiple shards. All of this end up in a single output stream (the ci).   This unfortunately causes `cluttered` ci output where stack traces are scrambled, log messages and output is also scrambled or eaten out completely.   It's common that we can't know what happened just by looking at the CI output and we need to manually download the artifacts/logs.  This is a) cumbersome for us who want to quickly look logs and b) an agent would also need to pull those logs and inspect them manually.  Furthermore, we don't upload core dumps.  # Tasks  [ ] demultiplex process output by redirecting to a file and on failure serialize and print what was captured. This will give a consistent word view instead of a scrambled mess. [ ] upload core dumps.  I prototyped both while working on one shot flushes. I will follow up with separate PR's and I opened this issue for tracking.  
  **Post-Mortem & Fix Analysis**:
  > Completed! 

- **Issue #8299** (2026-10-01): **Accept "user <name> on|off" ACL rule**
  *Symptoms*: **Describe the bug** Dragonfly's ACL file parser rejects lines with fewer than 4 whitespace-separated tokens, including minimal lines like `user default off` that Redis and Valkey accept.  **To Reproduce** Create an ACL file containing:  ``` user default off ```  Start Dragonfly with --aclfile=/path/to/file or run ACL LOAD.  **Expected behavior** Matching Redis/Valkey, the file loads successfully, creating/updating the default user with no additional category/key/pubsub changes beyond.  **Actual behavior** ``` ERR Error loading: /path/users.acl Error materializing acl file ```  **Root cause** In acl_family.cc, MaterializeFileContents requires at least 4 tokens per line:  ``` std::vector<std::string_view> cmds = absl::StrSplit(command, ' ', absl::SkipEmpty()); if (!absl::EqualsIgnoreCase(cmds[0], "USER") || cmds.size() < 4) {   return {}; } ```  user default off produces only 3 tokens (USER, default, off), so it's rejected outright.     

- **Issue #8288** (2026-09-10): **CL.THROTTLE over-reports whole-second retry_after and reset_after values by one second**
  *Symptoms*: **Describe the bug**  `CmdClThrottle` converts positive `retry_after` and `reset_after` durations from milliseconds to seconds by truncating and adding one (`src/server/string_family.cc`):  ```cpp int64_t retry_after_s = array[3] / 1000; if (array[3] > 0) {   retry_after_s += 1; } array[3] = retry_after_s; ```  This over-reports exact whole-second durations by one second: 2,000 ms becomes 3 seconds. Fractional durations round correctly. Common configurations such as 30 requests per 60 seconds have whole-second emission intervals, so clients using these values for `Retry-After` can wait longer than necessary.  **To Reproduce**  1. Start the server: `dragonfly --dbfilename=`. 2. On a fresh key, run `redis-cli CL.THROTTLE demo 0 1 2` (no burst, one request per two seconds). 3. Observe that the fifth reply element, `reset_after`, is `3` instead of `2`. 4. Repeat immediately to inspect `retry_after` on a rejected request. The same over-reporting occurs when its remaining duration is an exact whole second; elapsed time can make this timing-dependent.  **Expected behavior**  Round durations up to whole seconds without increasing exact whole-second values, matching `brandur/redis-cell`.  | Duration | Expected seconds | Dragonfly seconds | |---|---:|---:| | 1.0 s | 1 | 2 | | 2.0 s | 2 | 3 | | 7.0 s | 7 | 8 | | 1.5 s | 2 | 2 | | 2.5 s | 3 | 3 |  **Screenshots**  N/A. Command-line output is included below.  **Environment (please complete the following information):**  - OS: Ubuntu 24.04
  **Post-Mortem & Fix Analysis**:
  > I'm preparing a PR that addresses #8287 and #8288. I did some pretty extensive load testing on arm64 and AMD on Azure to make sure the performance was comparable to `redis-cell` in Valkey/Redis.
  > @dranikpg - will you be able to review the reply rendering changes?

- **Issue #8287** (2026-09-10): **CL.THROTTLE emits six reply-sink writes per request instead of one**
  *Symptoms*: **Describe the bug**  `CmdClThrottle` builds its five-integer reply with `StartArray` and five unscoped `SendLong` calls in `src/server/string_family.cc`. Each call opens a `ReplyScope`, whose destructor flushes the reply when batching is disabled. A client with one request in flight never enables batching, so each request produces six reply-sink writes instead of one.  | Command | Reply-sink writes/request | |---|---:| | `CL.THROTTLE` | 6.00 | | `SET` | 1.00 | | Equivalent GCRA Lua script | 1.00 |  The Lua path uses `SinkReplyBuilder::ReplyAggregator`. These measurements use `total_writes_processed`, which counts reply-sink writes, not necessarily syscalls or TCP packets.  **To Reproduce**  1. Start the server with `dragonfly --proactor_threads=4 --dbfilename=`. 2. Record `total_writes_processed` from `redis-cli INFO stats`. 3. Issue 300 sequential `CL.THROTTLE w 100000000 1 60 1` requests without pipelining. 4. Record the counter again: the delta is approximately 1,800 writes (6/request). 5. Repeat with `SET w 1`: the delta is approximately 300 writes (1/request).  **Expected behavior**  One reply-sink write per request, as with `SET` and the equivalent Lua script.  **Screenshots**  N/A. Measurements and a command-line reproduction are included here.  **Environment (please complete the following information):**  - OS: Ubuntu 24.04 - Kernel: `6.8.0-1065-azure` - Containerized?: Kubernetes pod on a dedicated node without a CPU quota - Dragonfly Version: `v1.40.2` and `main` a
  **Post-Mortem & Fix Analysis**:
  > I'm preparing a PR that addresses #8287 and #8288. I did some pretty extensive load testing on arm64 and AMD on Azure to make sure the performance was comparable to `redis-cell` in Valkey/Redis.

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

### Incident Patch 1: `8d483a1d` (2026-10-05)
**Commit Message**: feat(aof): add aof on-disk format and block builder (#8439)

Signed-off-by: Kostas Kyrimis <[REDACTED_EMAIL]>

**File**: `docs/aof.md` (modified, +39/-21)
```diff
@@ -282,34 +282,51 @@ requires a local `--dir`; with a remote one (`s3://...`) it refuses to start. A
 
 ### Segment header
 
-Written and synced when the segment is prepared as a spare, before any block:
-- magic `DFAOF1` (includes format version)
-- `shard_id`, `shard_count`, segment `seq`
-- `segment_uid`: a random 64-bit id per prepared file. It seeds the block CRCs, so a block
+Written and synced when the segment is prepared as a spare, before any block. It is 64 bytes,
+fixed-width little-endian:
+- magic `DFAOF1` (6 bytes, includes format version)
+- `shard_id` (u32), `shard_count` (u32), segment `seq` (u64)
+- `segment_uid` (u64): a random id per prepared file. It seeds the block CRCs, so a block
   validates only in the segment it was written to.
-- `reserved` (64 bits, always 0), for a later field such as a per-run id
-- header CRC32C
+- `reserved` (30 bytes, always 0), for later fields such as a per-run id
+- header CRC32C (u32) over the first 60 bytes
 
 The start LSN is not in the header, because it is unknown when the spare is prepared. The first
 block's `first_lsn` gives it.
 
 ### Blocks
 
 ```
-[u64 len][u32 crc32c][u64 first_lsn][u32 n_records][u8 flags][payload]
+[u64 total_block_bytes][u32 crc32c][u64 first_lsn][u32 n_records][u8 flags][payload]
 ```
 
-- The header is 25 bytes, fixed-width little-endian. `len` covers the whole block, header
-  included.
-- `payload` is the concatenated `JournalItem::data` of the block's records. Each record is
-  self-contained (a `SELECT` prefix where needed, then its opcode; a PING is the opcode alone),
-  so replay decodes records one by one and counts LSNs from `first_lsn`.
+- The header is 25 bytes, fixed-width little-endian. `total_block_bytes` covers the whole
+  block, header included. The payload is capped at 8KB (`kAofBlockBytes`).
+- `payload` is the journal records' bytes (`JournalItem::data`) back to back, with no
+  per-record framing. Records are self-delimiting (a `SELECT` prefix where needed, then its
+  opcode; a PING is the opcode alone, and every field is length-prefixed).
+- A record can span blocks: when it does not fit, the block is filled, sealed, and the record
+  continues in the next one, so a huge record spans many blocks. Replay therefore joins the
+  payloads of consecutive blocks and decodes them as one stream, like a socket.
+- `first_lsn` is the LSN of the first record with any bytes in the block, a continued one
+  included. `n_records` counts the records that end in the block; a middle block of a huge
+  record has `n_records = 0`. For consecutive blocks, `next.first_lsn == prev.first_lsn +
+  prev.n_records` always holds.
 - With the logical-time option for [Time-based commands](#time-based-commands), each record
   also carries its original time. How the block encodes it is an open edge case below.
-- `crc32c` covers `segment_uid`, then `len`, `first_lsn`, `n_records`, `flags` and `payload`.
-- `flags` is 0 in the MVP. Atomic groups use one bit later.
-- A block is valid only if `len >= 25`, it fits in the rest of the file, its CRC matches, and
-  `first_lsn` is the expected next LSN. A zero `len` (a hole or unwritten space) is invalid.
+- `crc32c` covers, in this order, `segment_uid`, `payload`, then `total_block_bytes`, `first_lsn`,
+  `n_records` and `flags`, each integer in its little-endian on-disk encoding. The CRC field
+  itself is not covered. The payload comes before the header fields so the CRC can be computed
+  incrementally: `segment_uid` seeds it when the block opens, each appended record extends it,
+  and the fields known only when the block is sealed are fed last. The on-disk layout is
+  unchanged; only the order of the CRC input differs from the layout.
+- `flags`: bit 0 (starts with continuation) means the payload begins with the rest of a record
+  from the previous block; bit 1 (ends with partial) means the payload ends with a record that
+  continues in the next block. A record that exactly fills a block is not partial. Atomic groups
+  use another bit later.
+- A block is valid only if `total_block_bytes >= 25`, it fits in the rest of the file, its CRC
+  matches, and `first_lsn` is the expected next LSN (by the rule above). A zero
+  `total_block_bytes` (a hole or unwritten space) is invalid.
   Replay checks the bounds before reading or allocating.
 
 ### Manifest
@@ -342,9 +359,8 @@ is never paired with the wrong cuts:
   plus a varint delta per record (which requires per-record framing in the payload), or a time
   field in the journal record itself (which also changes the replication format).
 - Very large records. A single journal record can be gigabytes (`max_bulk_len` bounds each
-  argument, not the record). A candidate design, not needed for the MVP: let a record span
-  blocks, and batch many blocks into one write, so a 1GB record does not cost about 125k ring
-  submissions. Alternatives: replay streams a block, or the AOF caps record size.
+  argument, not the record). Records a
```

**File**: `src/server/CMakeLists.txt` (modified, +2/-1)
```diff
@@ -158,6 +158,7 @@ helio_cxx_test(transaction_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(json_family_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(json_family_memory_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(journal/journal_test dfly_test_lib LABELS DFLY)
+helio_cxx_test(journal/aof_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(hll_family_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(string_stats_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(bloom_family_test dfly_test_lib LABELS DFLY)
@@ -173,7 +174,7 @@ helio_cxx_test(serializer_base_test dfly_test_lib LABELS DFLY)
 helio_cxx_test(detail/egress_throttle_test dfly_test_lib LABELS DFLY)
 
 add_dependencies(check_dfly dragonfly_test json_family_test list_family_test
-                 generic_family_test memcache_parser_test rdb_test journal_test
+                 generic_family_test memcache_parser_test rdb_test journal_test aof_test
                  resp_parser_test resp_srv_parser_test memory_test
                  stream_family_test string_family_test
                  bitops_family_test set_family_test zset_family_test geo_family_test
```

**File**: `src/server/journal/CMakeLists.txt` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ SET(DF_JOURNAL_SRCS
     journal/cmd_serializer.cc journal/tx_executor.cc namespaces.cc
     journal/journal.cc journal/types.cc journal/journal_slice.cc
     journal/serializer.cc journal/executor.cc journal/streamer.cc
-    journal/buffered_socket_writer.cc
+    journal/buffered_socket_writer.cc journal/aof.cc
     PARENT_SCOPE)
```

**File**: `src/server/journal/aof.cc` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+// Copyright 2026, DragonflyDB authors.  All rights reserved.
+// See LICENSE for licensing terms.
+//
+
+#include "server/journal/aof.h"
+
+#include <absl/base/internal/endian.h>
+
+#include <algorithm>
+#include <utility>
+
+#include "base/logging.h"
+#include "util/fibers/fibers.h"
+
+namespace dfly {
+
+using absl::little_endian::Load32;
+using absl::little_endian::Load64;
+using absl::little_endian::Store32;
+using absl::little_endian::Store64;
+
+namespace {
+
+// Segment header offsets.
+constexpr size_t kSegmentShardIdOffset = 6;
+constexpr size_t kSegmentShardCountOffset = 10;
+constexpr size_t kSegmentSeqOffset = 14;
+constexpr size_t kSegmentUidOffset = 22;
+constexpr size_t kSegmentCrcOffset = 60;
+static_assert(kSegmentShardIdOffset == kAofMagic.size());
+static_assert(kSegmentCrcOffset + 4 == kAofSegmentHeaderSize);
+
+// Block header offsets.
+constexpr size_t kBlockTotalBytesOffset = 0;
+constexpr size_t kBlockCrcOffset = 8;
+constexpr size_t kBlockFirstLsnOffset = 12;
+constexpr size_t kBlockNRecordsOffset = 20;
+constexpr size_t kBlockFlagsOffset = 24;
+static_assert(kBlockFlagsOffset + 1 == kAofBlockHeaderSize);
+
+void EncodeBlockHeader(const AofBlockHeader& hdr, char* dst) {
+  Store64(dst + kBlockTotalBytesOffset, hdr.total_block_bytes);
+  Store32(dst + kBlockCrcOffset, hdr.crc);
+  Store64(dst + kBlockFirstLsnOffset, hdr.first_lsn);
+  Store32(dst + kBlockNRecordsOffset, hdr.n_records);
+  dst[kBlockFlagsOffset] = hdr.flags;
+}
+
+AofBlockHeader DecodeBlockHeader(const char* src) {
+  return {Load64(src + kBlockTotalBytesOffset), Load32(src + kBlockCrcOffset),
+          Load64(src + kBlockFirstLsnOffset), Load32(src + kBlockNRecordsOffset),
+          static_cast<uint8_t>(src[kBlockFlagsOffset])};
+}
+
+absl::crc32c_t SeedCrc(uint64_t segment_uid) {
+  char buf[8];
+  Store64(buf, segment_uid);
+  return absl::ComputeCrc32c({buf, sizeof(buf)});
+}
+
+// Extends crc with the header fields except the CRC itself, in on-disk order.
+uint32_t FinishCrc(absl::crc32c_t crc, const AofBlockHeader& hdr) {
+  char buf[kAofBlockHeaderSize];
+  EncodeBlockHeader(hdr, buf);
+  crc = absl::ExtendCrc32c(crc, {buf, kBlockCrcOffset});
+  crc = absl::ExtendCrc32c(
+      crc, {buf + kBlockFirstLsnOffset, kAofBlockHeaderSize - kBlockFirstLsnOffset});
+  return static_cast<uint32_t>(crc);
+}
+
+}  // namespace
+
+std::string EncodeAofSegmentHeader(const AofSegmentHeader& hdr) {
+  std::string res(kAofSegmentHeaderSize, '\0');
+  char* p = res.data();
+  kAofMagic.copy(p, kAofMagic.size());
+  Store32(p + kSegmentShardIdOffset, hdr.shard_id);
+  Store32(p + kSegmentShardCountOffset, hdr.shard_count);
+  Store64(p + kSegmentSeqOffset, hdr.seq);
+  Store64(p + kSegmentUidOffset, hdr.segment_uid);
+  Store32(p + kSegmentCrcOffset,
+          static_cast<uint32_t>(absl::ComputeCrc32c({p, kSegmentCrcOffset})));
+  return res;
+}
+
+std::optional<AofSegmentHeader> DecodeAofSegmentHeader(std::string_view src) {
+  if (src.size() < kAofSegmentHeaderSize || !src.starts_with(kAofMagic))
+    return std::nullopt;
+  const char* p = src.data();
+  uint32_t crc = static_cast<uint32_t>(absl::ComputeCrc32c({p, kSegmentCrcOffset}));
+  if (crc != Load32(p + kSegmentCrcOffset))
+    return std::nullopt;
+  return AofSegmentHeader{Load32(p + kSegmentShardIdOffset), Load32(p + kSegmentShardCountOffset),
+                          Load64(p + kSegmentSeqOffset), Load64(p + kSegmentUidOffset)};
+}
+
+std::optional<AofBlockHeader> DecodeAofBlock(std::string_view src, uint64_t segment_uid) {
+  if (src.size() < kAofBlockHeaderSize)
+    return std::nullopt;
+  AofBlockHeader hdr = DecodeBlockHeader(src.data());
+  if (hdr.total_block_bytes < kAofBlockHeaderSize || hdr.total_block_bytes > src.size())
+    return std::nullopt;
+  std::string_view payload =
+      src.substr(kAofBlockHeaderSize, hdr.total_block_bytes - kAofBlockHeaderSize);
+  if (FinishCrc(absl::ExtendCrc32c(SeedCrc(segment_uid), payload), hdr) != hdr.crc)
+    return std::nullopt;
+  return hdr;
+}
+
+AofBlockBuilder::AofBlockBuilder(uint64_t segment_uid, SealCb seal_cb)
+    : segment_uid_(segment_uid), seal_cb_(std::move(seal_cb)) {
+  ResetOpen();
+}
+
+void AofBlockBuilder::Append(std::string_view record, uint64_t lsn) {
+  DCHECK(!record.empty());
+
+  uint8_t start_flags = 0;
+  while (true) {
+    if (PayloadSize() == 0) {
+      first_lsn_ = lsn;
+      flags_ = start_flags;
+    }
+    size_t n = std::min(record.size(), kAofBlockBytes - PayloadSize());
+    std::string_view chunk = record.substr(0, n);
+    buf_.append(chunk);
+    crc_ = absl::ExtendCrc32c(crc_, chunk);
+    record.remove_prefix(n);
+    if (record.empty())
+      break;
+    flags_ |= kEndsWithPartial;
+    SealOpen();
+    start_flags = kStartsWithContinuation;
+  }
+
+  ++n_records_;
+  if (PayloadSize() == kAofBlockBytes)
+    SealOpen();
+}
+
+void AofBlockBuilder::Seal() {
+  if (PayloadSize() > 0)
+    SealOpen();
+}
+
+void AofBlockBuilder::SealOpen() {
+  ut
```

**File**: `src/server/journal/aof.h` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+// Copyright 2026, DragonflyDB authors.  All rights reserved.
+// See LICENSE for licensing terms.
+//
+
+#pragma once
+
+#include <absl/crc/crc32c.h>
+
+#include <cstdint>
+#include <functional>
+#include <optional>
+#include <string>
+#include <string_view>
+
+namespace dfly {
+
+// On-disk AOF format: a segment is a fixed header followed by blocks of journal records.
+constexpr std::string_view kAofMagic = "DFAOF1";
+// 30 bytes of fields + 30 reserved (zero, for future fields) + 4 CRC.
+constexpr size_t kAofSegmentHeaderSize = 64;
+constexpr size_t kAofBlockHeaderSize = 25;
+// Payload cap
+constexpr size_t kAofBlockBytes = 8192;
+
+struct AofSegmentHeader {
+  uint32_t shard_id = 0;
+  uint32_t shard_count = 0;
+  uint64_t seq = 0;
+  uint64_t segment_uid = 0;
+};
+
+std::string EncodeAofSegmentHeader(const AofSegmentHeader& hdr);
+
+// Returns nullopt on short input, bad magic or bad CRC.
+std::optional<AofSegmentHeader> DecodeAofSegmentHeader(std::string_view src);
+
+enum AofBlockFlags : uint8_t {
+  kStartsWithContinuation = 1,
+  kEndsWithPartial = 2,
+};
+
+struct AofBlockHeader {
+  // kAofBlockHeaderSize + payload bytes
+  uint64_t total_block_bytes = 0;
+  uint32_t crc = 0;
+  uint64_t first_lsn = 0;
+  uint32_t n_records = 0;
+  uint8_t flags = 0;
+};
+
+// Decodes the block at the start of src and verifies its CRC. nullopt if corrupt.
+std::optional<AofBlockHeader> DecodeAofBlock(std::string_view src, uint64_t segment_uid);
+
+struct AofSealedBlock {
+  std::string bytes;  // header + payload, ready to write as-is
+  uint64_t first_lsn;
+  uint32_t n_records;
+  uint8_t flags;
+};
+
+// Packs journal records into blocks of at most kAofBlockBytes payload. Never yields.
+class AofBlockBuilder {
+ public:
+  // Gets sealed blocks in order, the writer queues them. Must not preempt: it runs inside
+  // Append and Seal, which callers use from atomic sections (enforced by a FiberAtomicGuard).
+  using SealCb = std::function<void(AofSealedBlock)>;
+
+  AofBlockBuilder(uint64_t segment_uid, SealCb seal_cb);
+
+  // Copies the record, splitting it across blocks if needed. Calls seal_cb_ zero or more times,
+  // once per block the record fills. Non-preemptive: never yields.
+  void Append(std::string_view record, uint64_t lsn);
+
+  // Seals the open block if non-empty.
+  void Seal();
+
+ private:
+  size_t PayloadSize() const {
+    return buf_.size() - kAofBlockHeaderSize;
+  }
+
+  void SealOpen();
+  void ResetOpen();
+
+  uint64_t segment_uid_;
+  absl::crc32c_t crc_;
+  // header placeholder + payload of the open block
+  std::string buf_;
+  uint64_t first_lsn_ = 0;
+  uint32_t n_records_ = 0;
+  uint8_t flags_ = 0;
+  SealCb seal_cb_;
+};
+
+}  // namespace dfly
```

**File**: `src/server/journal/aof_test.cc` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+// Copyright 2026, DragonflyDB authors.  All rights reserved.
+// See LICENSE for licensing terms.
+//
+
+#include "server/journal/aof.h"
+
+#include <absl/base/internal/endian.h>
+
+#include "base/gtest.h"
+
+namespace dfly {
+
+using namespace std;
+
+class AofTest : public ::testing::Test {
+ protected:
+  static constexpr uint64_t kUid = 0x1122334455667788;
+
+  // Concatenated payloads of blocks, each verified against kUid.
+  static string Payloads(const vector<AofSealedBlock>& blocks) {
+    string res;
+    for (const auto& b : blocks) {
+      auto hdr = DecodeAofBlock(b.bytes, kUid);
+      EXPECT_TRUE(hdr);
+      EXPECT_EQ(hdr->total_block_bytes, b.bytes.size());
+      res += b.bytes.substr(kAofBlockHeaderSize);
+    }
+    return res;
+  }
+
+  vector<AofSealedBlock> TakeSealed() {
+    return exchange(sealed_, {});
+  }
+
+  vector<AofSealedBlock> sealed_;
+  AofBlockBuilder builder_{kUid, [this](AofSealedBlock b) { sealed_.push_back(std::move(b)); }};
+};
+
+TEST_F(AofTest, SegmentHeader) {
+  AofSegmentHeader hdr{3, 8, 42, kUid};
+  string bytes = EncodeAofSegmentHeader(hdr);
+  ASSERT_EQ(bytes.size(), kAofSegmentHeaderSize);
+
+  auto decoded = DecodeAofSegmentHeader(bytes);
+  ASSERT_TRUE(decoded);
+  EXPECT_EQ(decoded->shard_id, 3u);
+  EXPECT_EQ(decoded->shard_count, 8u);
+  EXPECT_EQ(decoded->seq, 42u);
+  EXPECT_EQ(decoded->segment_uid, kUid);
+
+  string bad_magic = bytes;
+  bad_magic[0] = 'X';
+  EXPECT_FALSE(DecodeAofSegmentHeader(bad_magic));
+
+  string bad_crc = bytes;
+  bad_crc[20] ^= 1;
+  EXPECT_FALSE(DecodeAofSegmentHeader(bad_crc));
+  EXPECT_FALSE(DecodeAofSegmentHeader(bytes.substr(0, 63)));
+}
+
+TEST_F(AofTest, BlockCrc) {
+  string rec = "some record";
+  builder_.Append(rec, 7);
+  builder_.Seal();
+  auto blocks = TakeSealed();
+  ASSERT_EQ(blocks.size(), 1u);
+  const string& bytes = blocks[0].bytes;
+
+  // crc32c(segment_uid | payload | total_block_bytes | first_lsn | n_records | flags)
+  string input(8, '\0');
+  absl::little_endian::Store64(input.data(), kUid);
+  input += rec;
+  input += bytes.substr(0, 8);    // total_block_bytes
+  input += bytes.substr(12, 12);  // first_lsn, n_records
+  input += bytes[24];             // flags
+  uint32_t expected = static_cast<uint32_t>(absl::ComputeCrc32c(input));
+  EXPECT_EQ(absl::little_endian::Load32(bytes.data() + 8), expected);
+
+  EXPECT_TRUE(DecodeAofBlock(bytes, kUid));
+  EXPECT_FALSE(DecodeAofBlock(bytes, kUid + 1));
+}
+
+TEST_F(AofTest, SmallRecords) {
+  builder_.Append("a", 10);
+  builder_.Seal();
+  auto blocks = TakeSealed();
+  ASSERT_EQ(blocks.size(), 1u);
+  EXPECT_EQ(blocks[0].flags, 0);
+  EXPECT_EQ(blocks[0].first_lsn, 10u);
+  EXPECT_EQ(blocks[0].n_records, 1u);
+  EXPECT_EQ(blocks[0].bytes.size(), kAofBlockHeaderSize + 1);
+
+  builder_.Append("bb", 11);
+  builder_.Append("ccc", 12);
+  builder_.Append("dddd", 13);
+  EXPECT_TRUE(TakeSealed().empty());  // no seal per record
+  builder_.Seal();
+  blocks = TakeSealed();
+  ASSERT_EQ(blocks.size(), 1u);
+  EXPECT_EQ(blocks[0].first_lsn, 11u);
+  EXPECT_EQ(blocks[0].n_records, 3u);
+  EXPECT_EQ(Payloads(blocks), "bbcccdddd");
+}
+
+TEST_F(AofTest, ExactFill) {
+  builder_.Append(string(100, 'x'), 1);
+  builder_.Append(string(kAofBlockBytes - 100, 'y'), 2);
+  auto blocks = TakeSealed();
+  ASSERT_EQ(blocks.size(), 1u);
+  EXPECT_EQ(blocks[0].flags, 0);
+  EXPECT_EQ(blocks[0].n_records, 2u);
+
+  builder_.Append("z", 3);
+  builder_.Seal();
+  blocks = TakeSealed();
+  ASSERT_EQ(blocks.size(), 1u);
+  EXPECT_EQ(blocks[0].flags, 0);
+  EXPECT_EQ(blocks[0].first_lsn, 3u);
+  EXPECT_EQ(Payloads(blocks), "z");
+}
+
+TEST_F(AofTest, SpanningRecord) {
+  string small(100, 's');
+  string huge(2 * kAofBlockBytes + 50, '\0');
+  for (size_t i = 0; i < huge.size(); ++i)
+    huge[i] = 'a' + i % 26;
+
+  builder_.Append(small, 1);
+  builder_.Append(huge, 2);
+  builder_.Seal();
+  auto blocks = TakeSealed();
+  ASSERT_EQ(blocks.size(), 3u);
+
+  EXPECT_EQ(blocks[0].flags, kEndsWithPartial);
+  EXPECT_EQ(blocks[1].flags, kEndsWithPartial | kStartsWithContinuation);
+  EXPECT_EQ(blocks[2].flags, kStartsWithContinuation);
+  EXPECT_EQ(blocks[0].n_records, 1u);
+  EXPECT_EQ(blocks[1].n_records, 0u);
+  EXPECT_EQ(blocks[2].n_records, 1u);
+  EXPECT_EQ(blocks[0].first_lsn, 1u);
+  for (size_t i = 1; i < blocks.size(); ++i)
+    EXPECT_EQ(blocks[i].first_lsn, blocks[i - 1].first_lsn + blocks[i - 1].n_records);
+
+  EXPECT_EQ(Payloads(blocks), small + huge);
+}
+
+TEST_F(AofTest, SealEmpty) {
+  builder_.Seal();
+  EXPECT_TRUE(TakeSealed().empty());
+}
+
+}  // namespace dfly
```

---

### Incident Patch 2: `661a8fe9` (2026-10-05)
**Commit Message**: fix: SlotMigrationStreamer::Cancel() waits for Run finish (#8473)

Signed-off-by: Borys <[REDACTED_EMAIL]>

**File**: `src/server/journal/streamer.cc` (modified, +6/-1)
```diff
@@ -199,6 +199,7 @@ void SlotMigrationStreamer::Start(util::FiberSocketBase* dest) {
 }
 
 void SlotMigrationStreamer::Run() {
+  lock_guard traversal_lock{traversal_latch_};
   VLOG(1) << "SlotMigrationStreamer run";
 
   // Returns false if cancelled, including before Start() ran (see SlotMigrationStreamer::Start).
@@ -292,13 +293,17 @@ bool SlotMigrationStreamer::Cancel() {
   // early when the context is cancelled, which prevents the streamer from being registered (and
   // leaked) after cancellation.
   base_cntx_->Cancel();
+  writer_.WakeWaiters();
+
+  // Run() may be suspended while serializing an entry. Keep the listener and its snapshot version
+  // alive until traversal finishes; UnregisterOnChange only waits for OnChange callbacks.
+  traversal_latch_.Wait();
 
   // UnregisterOnChange is idempotent and returns true only for the caller that actually removed the
   // listener, so racing Cancel() calls (e.g. Finish() vs ~SliceSlotMigration) can't double-erase.
   if (!db_slice_->UnregisterOnChange(this))
     return false;
 
-  writer_.WakeWaiters();
   if (journal_cb_id_) {
     auto cb_id = journal_cb_id_;
     journal_cb_id_ = 0;  // Reset to prevent double unregistration in another fiber
```

**File**: `src/server/journal/streamer.h` (modified, +3/-1)
```diff
@@ -74,7 +74,8 @@ class SlotMigrationStreamer : public journal::JournalConsumerInterface, public S
 
   void Run();
 
-  // Cancel() must be called if Start() is called
+  // Cancels the flow and waits for traversal before unregistering its listeners.
+  // Must be called if Start() is called.
   bool Cancel();
 
   void SendFinalize(long attempt);
@@ -111,6 +112,7 @@ class SlotMigrationStreamer : public journal::JournalConsumerInterface, public S
   std::unique_ptr<CmdSerializer> cmd_serializer_;
 
   MigrationStats migration_stats_;
+  LocalLatch traversal_latch_;
 
   // Scratch buffer for decoding keys in ShouldSerialize. Reused to avoid allocating per key; safe
   // to share across fibers because ShouldSerialize does not preempt.
```

**File**: `src/server/serializer_base_test.cc` (modified, +51/-14)
```diff
@@ -30,6 +30,7 @@
 #include "server/execution_state.h"
 #include "server/journal/journal.h"
 #include "server/journal/serializer.h"
+#include "server/journal/streamer.h"
 #include "server/journal/types.h"
 #include "server/table.h"
 #include "server/test_utils.h"
@@ -332,6 +333,16 @@ class SerializerBaseTest : public BaseFamilyTest {
     pp_->at(0)->Await([this] { cntx_.ReportCancelError(); });
   }
 
+  void WithShardLock(auto cb) {
+    auto* reg = service_->mutable_registry();
+    boost::intrusive_ptr<Transaction> tx = new Transaction{reg->Find("SAVE")};
+    tx->InitByArgs(&namespaces->GetDefaultNamespace(), 0, {});
+    tx->ScheduleSingleHop([&](Transaction* t, EngineShard* es) {
+      cb(t->GetDbSlice(es->shard_id()), reg);
+      return OpStatus::OK;
+    });
+  }
+
   // #1: two offloaded entries both fail to read; the error path must release both bucket latches.
   bool DelayedErrorLeavesBlocked() {
     return pp_->at(0)->Await([this] {
@@ -364,27 +375,17 @@ class SerializerBaseTest : public BaseFamilyTest {
  private:
   // Construct the driver (no snapshot fiber); optionally register it as a db_slice change listener.
   void EmplaceDriverOnThread(bool register_cb) {
-    auto* reg = service_->mutable_registry();
-    boost::intrusive_ptr<Transaction> tx = new Transaction{reg->Find("SAVE")};
-    tx->InitByArgs(&namespaces->GetDefaultNamespace(), 0, {});
-    tx->ScheduleSingleHop([this, reg, register_cb](Transaction* t, EngineShard* es) {
-      driver_.emplace(driver_params, &t->GetDbSlice(es->shard_id()), &cntx_, reg);
+    WithShardLock([&](DbSlice& slice, CommandRegistry* reg) {
+      driver_.emplace(driver_params, &slice, &cntx_, reg);
       if (register_cb)
         driver_->RegisterChangeListener(false);
-      return OpStatus::OK;
     });
   }
 
   void StartOnThread() {
-    auto* reg = service_->mutable_registry();
-
-    boost::intrusive_ptr<Transaction> tx = new Transaction{reg->Find("SAVE")};
-    tx->InitByArgs(&namespaces->GetDefaultNamespace(), 0, {});
-
-    tx->ScheduleSingleHop([this, reg](Transaction* t, EngineShard* es) {
-      driver_.emplace(driver_params, &t->GetDbSlice(es->shard_id()), &cntx_, reg);
+    WithShardLock([this](DbSlice& slice, CommandRegistry* reg) {
+      driver_.emplace(driver_params, &slice, &cntx_, reg);
       driver_->Start();
-      return OpStatus::OK;
     });
   }
 
@@ -652,6 +653,42 @@ TEST_F(SerializerBaseTest, UnregisterWaitsForInflightOnChange) {
   Finish();
 }
 
+// SlotMigrationStreamer::Run() is driven by an external fiber, so Cancel() must wait for it:
+// unregistering resets snapshot_version_, which a traversal suspended mid-bucket still uses.
+TEST_F(SerializerBaseTest, MigrationCancellationWaitsForTraversal) {
+  struct PausingStreamer : SlotMigrationStreamer {
+    using SlotMigrationStreamer::SlotMigrationStreamer;
+
+    unsigned SerializeBucket(DbIndex db_index, PrimeTable::bucket_iterator it,
+                             bool on_update) override {
+      entered.Notify();
+      release.Wait();
+      return SlotMigrationStreamer::SerializeBucket(db_index, it, on_update);
+    }
+
+    util::fb2::Done entered, release;
+  };
+
+  Run({"SET", "key", "value"});
+  pp_->at(0)->Await([this] {
+    ExecutionState cntx;
+    // Owns no slots, so nothing is written and the streamer needs no socket.
+    PausingStreamer streamer{&namespaces->GetDefaultNamespace().GetCurrentDbSlice(),
+                             cluster::SlotSet{}, &cntx};
+    WithShardLock([&](DbSlice&, CommandRegistry*) { streamer.RegisterChangeListener(true); });
+
+    util::fb2::Fiber traversal{[&] { streamer.Run(); }};
+    streamer.entered.Wait();
+
+    util::fb2::Fiber cancel{util::fb2::Launch::dispatch, [&] { EXPECT_TRUE(streamer.Cancel()); }};
+    EXPECT_GT(streamer.snapshot_version_, 0u);  // Cancel() is blocked until the traversal ends
+
+    streamer.release.Notify();
+    traversal.Join();
+    cancel.Join();
+  });
+}
+
 // A failed tiered read must not leak the other extracted entries' bucket latches.
 TEST_F(SerializerBaseTest, DelayedEntriesErrorReleasesLatches) {
   Run({"DEBUG", "POPULATE", "1"});
```

---

### Incident Patch 3: `7a6e7d17` (2026-10-05)
**Commit Message**: fix(facade): track partial-send progress in SinkReplyBuilder (#7536)

* fix(facade): track partial-send progress in SinkReplyBuilder

SinkReplyBuilder::Send() called Write(), which hides the partial-write loop, and stamped the send
timestamp only once. On slow or throttled links a send that was still progressing looked stuck:
send_delay_seconds and send-wait-time kept growing, and --send_timeout closed live connections.

Narrow the builder's sink to util::FiberSocketBase* and drive WriteSome() directly, so every
partial write refreshes the send timestamp and moves the pending pin to the tail of pending_list,
keeping it sorted. A zero-byte write is treated as io_error, matching io::Sink::Write().

Rename ReplyStats::io_write_cnt to io_write_calls; it now counts socket write calls, and
io_write_bytes counts bytes actually written, including when a send fails midway.

Add StringSocket, a FiberSocketBase test double that replaces io::StringSink/io::NullSink (including
in ServerFamily::Replicate) and can simulate partial writes and write errors.
---------

Signed-off-by: Roman Gershman <[REDACTED_EMAIL]>

**File**: `docs/pub-sub.md` (modified, +2/-1)
```diff
@@ -467,7 +467,8 @@ For diagnosis, use:
   slow-subscriber events by type — `soft_limit` (soft-limit crossings),
   `hard_limit` (publisher throttle episodes), `forced_disconnect` (subscribers
   closed by the policy), and `messages_discarded`;
-- `send_delay_ms` / `send_delay_seconds`: age of the oldest pending send;
+- `send_delay_ms` / `send_delay_seconds`: longest time an in-flight send has
+  made no progress (no bytes accepted by the socket);
 - `total_net_output_bytes` and `total_writes_processed`: output progress; and
 - `cmdstat_publish`: indirect evidence of publisher waiting.
 
```

**File**: `src/facade/facade.cc` (modified, +2/-2)
```diff
@@ -73,7 +73,7 @@ ReplyStats::ReplyStats(ReplyStats&& other) noexcept {
 
 ReplyStats& ReplyStats::operator+=(const ReplyStats& o) {
   static_assert(sizeof(ReplyStats) == 88u + kSanitizerOverhead);
-  ADD(io_write_cnt);
+  ADD(io_write_calls);
   ADD(io_write_bytes);
 
   for (const auto& k_v : o.err_count) {
@@ -99,7 +99,7 @@ ReplyStats& ReplyStats::operator=(const ReplyStats& o) {
   }
 
   send_stats = o.send_stats;
-  io_write_cnt = o.io_write_cnt;
+  io_write_calls = o.io_write_calls;
   io_write_bytes = o.io_write_bytes;
   err_count = o.err_count;
   script_error_count = o.script_error_count;
```

**File**: `src/facade/facade_stats.h` (modified, +2/-2)
```diff
@@ -127,8 +127,8 @@ struct ReplyStats {
   // Send() operations that are written to sockets
   SendStats send_stats;
 
-  size_t io_write_cnt = 0;
-  size_t io_write_bytes = 0;
+  size_t io_write_calls = 0;  // number of successful socket write calls
+  size_t io_write_bytes = 0;  // bytes actually written to sockets
   uint64_t borrowed_string_sent_cnt = 0;
 
   absl::flat_hash_map<std::string, uint64_t> err_count;
```

**File**: `src/facade/ok_main.cc` (modified, +1/-1)
```diff
@@ -645,7 +645,7 @@ void HandleMetrics(ProactorPool* pool, const util::http::QueryArgs&, util::HttpC
   APPEND_BODY("dragonfly_net_input_recv_total ", conn.io_read_cnt, "\n");
 
   APPEND_BODY("# TYPE dragonfly_net_output_send_total counter\n");
-  APPEND_BODY("dragonfly_net_output_send_total ", reply.io_write_cnt, "\n");
+  APPEND_BODY("dragonfly_net_output_send_total ", reply.io_write_calls, "\n");
 
   APPEND_BODY("# TYPE dragonfly_net_read_yields_total counter\n");
   APPEND_BODY("dragonfly_net_read_yields_total ", conn.num_read_yields, "\n");
```

**File**: `src/facade/reply_builder.cc` (modified, +59/-12)
```diff
@@ -17,6 +17,7 @@
 #include "common/borrowed_string.h"
 #include "common/dtoa.h"
 #include "facade/error.h"
+#include "util/fiber_socket_base.h"
 #include "util/fibers/proactor_base.h"
 
 #ifdef __APPLE__
@@ -192,29 +193,75 @@ uint64_t SinkReplyBuilder::GetLastSendTimeCycles() const {
 }
 
 void SinkReplyBuilder::Send() {
-  DCHECK(sink_ != nullptr);
+  DCHECK(socket_ != nullptr);
   DCHECK(!vecs_.empty());
   auto& reply_stats = tl_facade_stats->reply_stats;
 
-  send_time_cycles_ = base::CycleClock::Now();
-  PendingPin pin(send_time_cycles_);
+  const uint64_t start_cycles = base::CycleClock::Now();
+  send_time_cycles_ = start_cycles;
+  PendingPin pin(start_cycles);
+
+  DVLOG(2) << "Writing " << total_size_ << " bytes";
+
+  // We drive partial writes ourselves instead of calling socket_->Write() so that every bit of
+  // progress refreshes the send timestamps. This way slow-but-progressing sends are not
+  // reported as stuck. vecs_ is consumed in place - Flush() clears it right after Send().
+  iovec* v = vecs_.data();
+  iovec* const end = v + vecs_.size();
+  size_t remaining = total_size_;
 
   pending_list.push_back(pin);
+  while (true) {
+    io::Result<size_t> res = socket_->WriteSome(v, end - v);
+    if (!res) {
+      if (res.error() == errc::interrupted)
+        continue;
+      ec_ = res.error();
+      break;
+    }
 
-  reply_stats.io_write_cnt++;
-  reply_stats.io_write_bytes += total_size_;
-  DVLOG(2) << "Writing " << total_size_ << " bytes";
-  if (auto ec = sink_->Write(vecs_.data(), vecs_.size()); ec)
-    ec_ = ec;
+    // We always pass at least one byte, so 0 means no progress is possible. Treat it as an
+    // error, like io::Sink::Write() does, instead of spinning.
+    if (*res == 0) {
+      LOG(DFATAL) << "Invalid vector write result: 0 bytes written, expected at least 1, iov_len="
+                  << v->iov_len;
+      ec_ = make_error_code(errc::io_error);
+      break;
+    }
+
+    reply_stats.io_write_calls++;
+    reply_stats.io_write_bytes += *res;
+
+    DCHECK_LE(*res, remaining);
+    remaining -= *res;
+    if (remaining == 0)
+      break;
+
+    // Skip fully written iovecs and trim the partially written one. Since some bytes remain,
+    // the written prefix ends strictly inside vecs_, so v never reaches end here.
+    size_t done = *res;
+    while (done >= v->iov_len) {
+      done -= v->iov_len;
+      ++v;
+    }
+    v->iov_base = reinterpret_cast<char*>(v->iov_base) + done;
+    v->iov_len -= done;
+
+    // Restart the stall clock. Moving the pin to the tail keeps pending_list sorted.
+    send_time_cycles_ = pin.timestamp_cycles = base::CycleClock::Now();
+    if (&pending_list.back() != &pin) {
+      pending_list.erase(PendingList::s_iterator_to(pin));
+      pending_list.push_back(pin);
+    }
+  }
 
-  auto it = PendingList::s_iterator_to(pin);
-  pending_list.erase(it);
+  pending_list.erase(PendingList::s_iterator_to(pin));
 
   send_time_cycles_ = 0;
 
   uint64_t after_cycles = base::CycleClock::Now();
   reply_stats.send_stats.count++;
-  reply_stats.send_stats.total_duration += (after_cycles - pin.timestamp_cycles);
+  reply_stats.send_stats.total_duration += (after_cycles - start_cycles);
   DVLOG(2) << "Finished writing " << total_size_ << " bytes";
 }
 
@@ -244,7 +291,7 @@ void SinkReplyBuilder::FinishScope() {
   guaranteed_pieces_ = vecs_.size();  // all vecs are pieces
 }
 
-MCReplyBuilder::MCReplyBuilder(::io::Sink* sink) : SinkReplyBuilder(sink) {
+MCReplyBuilder::MCReplyBuilder(util::FiberSocketBase* socket) : SinkReplyBuilder(socket) {
 }
 
 void MCReplyBuilder::SendValue(MemcacheCmdFlags cmd_flags, std::string_view key,
```

**File**: `src/facade/reply_builder.h` (modified, +16/-8)
```diff
@@ -20,6 +20,10 @@ namespace cmn {
 class BorrowedString;
 }  // namespace cmn
 
+namespace util {
+class FiberSocketBase;
+}  // namespace util
+
 namespace facade {
 
 enum class RespVersion { kResp2, kResp3 };
@@ -41,7 +45,9 @@ class SinkReplyBuilder {
 
   struct PendingPin : public boost::intrusive::list_base_hook<
                           ::boost::intrusive::link_mode<::boost::intrusive::normal_link>> {
-    uint64_t timestamp_cycles;  // base::CycleClock::Now() value
+    // base::CycleClock::Now() at Send() entry or at the last write progress.
+    // pending_list is kept sorted by this value.
+    uint64_t timestamp_cycles;
 
     PendingPin(uint64_t v = 0) : timestamp_cycles(v) {
     }
@@ -53,7 +59,7 @@ class SinkReplyBuilder {
 
   static thread_local PendingList pending_list;
 
-  explicit SinkReplyBuilder(io::Sink* sink) : sink_(sink) {
+  explicit SinkReplyBuilder(util::FiberSocketBase* socket) : socket_(socket) {
   }
 
   virtual ~SinkReplyBuilder() = default;
@@ -165,7 +171,7 @@ class SinkReplyBuilder {
   std::string last_error_;
 
  private:
-  io::Sink* sink_;
+  util::FiberSocketBase* socket_;
   std::error_code ec_;
 
   bool scoped_ = false, batched_ = false;
@@ -177,13 +183,15 @@ class SinkReplyBuilder {
   // external data (WriteRef). Validity is ensured by FinishScope that either flushes before ref
   // lifetime ends or copies refs to the buffer.
   absl::InlinedVector<iovec, 16> vecs_;
-  size_t guaranteed_pieces_ = 0;   // length of prefix of vecs_ that are guaranteed to be pieces
-  uint64_t send_time_cycles_ = 0;  // base::CycleClock::Now() at Send() entry, 0 when idle
+  size_t guaranteed_pieces_ = 0;  // length of prefix of vecs_ that are guaranteed to be pieces
+
+  // base::CycleClock::Now() at Send() entry or at the last write progress, 0 when idle.
+  uint64_t send_time_cycles_ = 0;
 };
 
 class MCReplyBuilder : public SinkReplyBuilder {
  public:
-  explicit MCReplyBuilder(::io::Sink* sink);
+  explicit MCReplyBuilder(util::FiberSocketBase* socket);
 
   ~MCReplyBuilder() override = default;
 
@@ -209,7 +217,7 @@ class RedisReplyBuilderBase : public SinkReplyBuilder {
  public:
   enum VerbatimFormat : uint8_t { TXT, MARKDOWN };
 
-  explicit RedisReplyBuilderBase(io::Sink* sink) : SinkReplyBuilder(sink) {
+  explicit RedisReplyBuilderBase(util::FiberSocketBase* socket) : SinkReplyBuilder(socket) {
   }
 
   ~RedisReplyBuilderBase() override = default;
@@ -275,7 +283,7 @@ class RedisReplyBuilder : public RedisReplyBuilderBase {
  public:
   using ScoredArray = absl::Span<const std::pair<std::string, double>>;
 
-  RedisReplyBuilder(io::Sink* sink) : RedisReplyBuilderBase(sink) {
+  RedisReplyBuilder(util::FiberSocketBase* socket) : RedisReplyBuilderBase(socket) {
   }
 
   ~RedisReplyBuilder() override = default;
```

**File**: `src/facade/reply_builder_test.cc` (modified, +51/-5)
```diff
@@ -15,6 +15,7 @@
 #include "facade/facade_test.h"
 #include "facade/reply_capture.h"
 #include "facade/resp_expr_test_utils.h"
+#include "facade/string_socket.h"
 
 using namespace testing;
 using namespace std;
@@ -161,7 +162,7 @@ class RedisReplyBuilderTest : public testing::Test {
   // Parse the data in the sink with RESPParser.
   ParsingResults Parse();
 
-  io::StringSink sink_;
+  StringSocket sink_;
   std::unique_ptr<RedisReplyBuilder> builder_;
   std::unique_ptr<std::uint8_t[]> parser_buffer_;
 };
@@ -734,15 +735,15 @@ TEST_F(RedisReplyBuilderTest, BatchMode) {
     builder_->SendBulkString(val);
     ASSERT_EQ(SinkSize(), 0) << " sink is not empty at iteration number " << count;
     ASSERT_EQ(GetReplyStats().io_write_bytes, 0);
-    ASSERT_EQ(GetReplyStats().io_write_cnt, 0);
+    ASSERT_EQ(GetReplyStats().io_write_calls, 0);
     total_bytes += val.size();
     ++count;
   }
   // in order to actually see the message, we need to disable the batching, then
   // write something
   builder_->SetBatchMode(false);
   builder_->SendBulkString(std::string_view{});
-  ASSERT_EQ(GetReplyStats().io_write_cnt, 1);
+  ASSERT_EQ(GetReplyStats().io_write_calls, 1);
   // We expecting to have more than the total bytes we count,
   // since we are not counting the \r\n and the type char as well
   // as length entries
@@ -771,7 +772,7 @@ TEST_F(RedisReplyBuilderTest, BatchGrowsBuffer) {
     builder_->SendBulkString(value);
 
   EXPECT_EQ(builder_->UsedMemory(), SinkReplyBuilder::kMaxBufferSize);
-  EXPECT_LT(GetReplyStats().io_write_cnt, size_t(kReplies) / 2);
+  EXPECT_LT(GetReplyStats().io_write_calls, size_t(kReplies) / 2);
 
   builder_->SetBatchMode(false);
   builder_->Flush();
@@ -1028,7 +1029,7 @@ TEST_F(RedisReplyBuilderTest, Issue4424) {
 }
 
 TEST_F(RedisReplyBuilderTest, MCMetaGetLargeValue) {
-  io::StringSink mc_sink;
+  StringSocket mc_sink;
   MCReplyBuilder mc_builder(&mc_sink);
 
   MemcacheCmdFlags flags;
@@ -1043,4 +1044,49 @@ TEST_F(RedisReplyBuilderTest, MCMetaGetLargeValue) {
   EXPECT_THAT(output, HasSubstr(large_val));
 }
 
+TEST_F(RedisReplyBuilderTest, PartialWrites) {
+  const string large_value(10000, 'x');
+  const std::vector<std::string_view> values = {"a", "bb", large_value, "ccc"};
+
+  builder_->SendBulkStrArr(values);
+  const string expected = TakePayload();
+  ResetStats();
+
+  constexpr size_t kMaxWrite = 7;
+  sink_.set_max_write(kMaxWrite);
+  builder_->SendBulkStrArr(values);
+
+  EXPECT_EQ(str(), expected);
+  EXPECT_FALSE(builder_->GetError());
+  EXPECT_FALSE(builder_->IsSendActive());
+  EXPECT_TRUE(SinkReplyBuilder::pending_list.empty());
+
+  const auto& stats = GetReplyStats();
+  EXPECT_EQ(stats.io_write_bytes, expected.size());
+  EXPECT_EQ(stats.io_write_calls, (expected.size() + kMaxWrite - 1) / kMaxWrite);
+  EXPECT_EQ(stats.send_stats.count, 1);
+}
+
+TEST_F(RedisReplyBuilderTest, PartialWriteError) {
+  const string large_value(10000, 'x');
+  const std::vector<std::string_view> values = {"a", "bb", large_value, "ccc"};
+
+  constexpr size_t kMaxWrite = 7;
+  constexpr unsigned kFailOn = 3;
+  sink_.set_max_write(kMaxWrite);
+  sink_.set_fail_after(kFailOn, make_error_code(errc::connection_reset));
+  builder_->SendBulkStrArr(values);
+
+  EXPECT_EQ(builder_->GetError(), make_error_code(errc::connection_reset));
+  EXPECT_FALSE(builder_->IsSendActive());
+  EXPECT_TRUE(SinkReplyBuilder::pending_list.empty());
+
+  // Only the writes before the failure are accounted for.
+  const auto& stats = GetReplyStats();
+  EXPECT_EQ(str().size(), (kFailOn - 1) * kMaxWrite);
+  EXPECT_EQ(stats.io_write_bytes, str().size());
+  EXPECT_EQ(stats.io_write_calls, kFailOn - 1);
+  EXPECT_EQ(stats.send_stats.count, 1);
+}
+
 }  // namespace facade
```

**File**: `src/facade/string_socket.h` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+// Copyright 2026, DragonflyDB authors.  All rights reserved.
+// See LICENSE for licensing terms.
+//
+#pragma once
+
+#include <algorithm>
+#include <limits>
+#include <string>
+#include <system_error>
+
+#include "util/fiber_socket_base.h"
+
+namespace facade {
+
+// Minimal FiberSocketBase subclass that captures writes to a string buffer, or discards them
+// in null mode. Used to construct reply builders that are not backed by a real connection,
+// mostly in tests. It has no proactor and supports only writes, so it must not be used where socket
+// I/O beyond WriteSome/AsyncWriteSome is expected.
+class StringSocket : public util::FiberSocketBase {
+ public:
+  StringSocket() : FiberSocketBase(nullptr) {
+  }
+
+  const std::string& str() const {
+    return str_;
+  }
+
+  void Clear() {
+    str_.clear();
+  }
+
+  // Limits the number of bytes accepted by a single WriteSome call to simulate partial writes.
+  void set_max_write(size_t max_write) {
+    max_write_ = max_write;
+  }
+
+  // When set, written data is discarded instead of captured, like io::NullSink.
+  void set_null(bool null) {
+    null_ = null;
+  }
+
+  // Makes the n-th WriteSome call from now (1-based) and all calls after it fail with ec.
+  void set_fail_after(unsigned n, std::error_code ec) {
+    writes_until_failure_ = n;
+    fail_ec_ = ec;
+  }
+
+  // io::Sink
+  io::Result<size_t> WriteSome(const iovec* v, uint32_t len) override {
+    if (writes_until_failure_ > 0 && --writes_until_failure_ == 0) {
+      writes_until_failure_ = 1;  // keep failing
+      return nonstd::make_unexpected(fail_ec_);
+    }
+
+    size_t total = 0;
+    for (uint32_t i = 0; i < len && total < max_write_; ++i) {
+      size_t n = std::min(v[i].iov_len, max_write_ - total);
+      if (!null_)
+        str_.append(reinterpret_cast<const char*>(v[i].iov_base), n);
+      total += n;
+    }
+    return total;
+  }
+
+  // io::AsyncSink
+  void AsyncWriteSome(const iovec* v, uint32_t len, io::AsyncProgressCb cb) override {
+    auto res = WriteSome(v, len);
+    cb(res);
+  }
+
+  // io::AsyncSource
+  void AsyncReadSome(const iovec* v, uint32_t len, io::AsyncProgressCb cb) override {
+    cb(nonstd::make_unexpected(std::make_error_code(std::errc::not_supported)));
+  }
+
+  error_code Shutdown(int) override {
+    return {};
+  }
+
+  AcceptResult Accept() override {
+    return nonstd::make_unexpected(std::make_error_code(std::errc::not_supported));
+  }
+
+  error_code Connect(const endpoint_type&, std::function<void(int)>) override {
+    return std::make_error_code(std::errc::not_supported);
+  }
+
+  error_code Close() override {
+    return {};
+  }
+
+  bool IsOpen() const override {
+    return true;
+  }
+
+  io::Result<size_t> RecvMsg(const msghdr&, int) override {
+    return nonstd::make_unexpected(std::make_error_code(std::errc::not_supported));
+  }
+
+  io::Result<size_t> Recv(const io::MutableBytes&, int) override {
+    return nonstd::make_unexpected(std::make_error_code(std::errc::not_supported));
+  }
+
+  void set_timeout(uint32_t) override {
+  }
+
+  uint32_t timeout() const override {
+    return UINT32_MAX;
+  }
+
+  endpoint_type LocalEndpoint() const override {
+    return {};
+  }
+
+  endpoint_type RemoteEndpoint() const override {
+    return {};
+  }
+
+  void RegisterOnErrorCb(std::function<void(uint32_t)>) override {
+  }
+
+  void CancelOnErrorCb() override {
+  }
+
+  void RegisterOnRecv(OnRecvCb) override {
+  }
+
+  void ResetOnRecvHook() override {
+  }
+
+  bool IsUDS() const override {
+    return false;
+  }
+
+  native_handle_type native_handle() const override {
+    return -1;
+  }
+
+  error_code Create(unsigned short) override {
+    return std::make_error_code(std::errc::not_supported);
+  }
+
+  error_code Bind(const struct sockaddr*, unsigned) override {
+    return std::make_error_code(std::errc::not_supported);
+  }
+
+  error_code Listen(unsigned) override {
+    return std::make_error_code(std::errc::not_supported);
+  }
+
+  error_code Listen(uint16_t, unsigned) override {
+    return std::make_error_code(std::errc::not_supported);
+  }
+
+  error_code ListenUDS(const char*, mode_t, unsigned) override {
+    return std::make_error_code(std::errc::not_supported);
+  }
+
+  io::Result<size_t> TrySend(io::Bytes) override {
+    return nonstd::make_unexpected(std::make_error_code(std::errc::not_supported));
+  }
+
+  io::Result<size_t> TrySend(const iovec*, uint32_t) override {
+    return nonstd::make_unexpected(std::make_error_code(std::errc::not_supported));
+  }
+
+  io::Result<size_t> TryRecv(io::MutableBytes) override {
+    return nonstd::make_unexpected(std::make_error_code(std::errc::not_supported));
+  }
+
+ private:
+  std::string str_;
+  size_t max_write_ = std::numeric_limits<size_t>::max();
+  unsigned writes_until_failure_ = 0;  // 0 - never fail
+  std::error_code fail_ec_;
+  bool null_ = false;
+};
+
+}  // namespace facade
```

---

### Incident Patch 4: `7696c6d4` (2026-10-05)
**Commit Message**: fix: HSNW index restoration crash (#8466)

**File**: `src/server/search/doc_index.cc` (modified, +10/-2)
```diff
@@ -674,14 +674,15 @@ void ShardDocIndex::RestoreGlobalVectorIndices(std::string_view index_name, cons
   // flat_hash_map iterators.
   auto doc_keys_snapshot = key_index_.GetDocKeysMap();
 
-  for (const auto& [key, local_id] : doc_keys_snapshot) {
+  // Scope the mutable lookup and accessor to one document so cleanup finishes before yielding.
+  auto restore_doc = [&](std::string_view key, DocId local_id) {
     auto it = db_slice.FindMutable(op_args.db_cntx, key, base_->GetObjCode());
     if (!it || !IsValid(it->it)) {
       ++missing_documents;
       GlobalDocId global_id =
           search::CreateGlobalDocId(EngineShard::tlocal()->shard_id(), local_id);
       missing_doc_ids.push_back({std::string(key), local_id, global_id});
-      continue;
+      return false;
     }
 
     PrimeValue& pv = it->it->second;
@@ -708,6 +709,13 @@ void ShardDocIndex::RestoreGlobalVectorIndices(std::string_view index_name, cons
       ++deferred_updates;
     }
 
+    return true;
+  };
+
+  for (const auto& [key, local_id] : doc_keys_snapshot) {
+    if (!restore_doc(key, local_id))
+      continue;
+
     // Yield periodically to avoid blocking the fiber
     if (++processed % 1000 == 0) {
       util::ThisFiber::Yield();
```

**File**: `src/server/search/search_family_test.cc` (modified, +48/-0)
```diff
@@ -22,6 +22,8 @@
 #include "facade/error.h"
 #include "facade/facade_test.h"
 #include "facade/resp_parser.h"
+#include "server/db_slice.h"
+#include "server/engine_shard_set.h"
 #include "server/search/doc_index.h"
 #include "server/test_utils.h"
 
@@ -5169,6 +5171,52 @@ TEST_F(SearchFamilyTest, KnnHnsw) {
   EXPECT_THAT(resp, kNoResults);
 }
 
+TEST_F(SearchFamilyTest, RestoreHnswVectorsWithConcurrentDeletion) {
+  absl::FlagSaver fs;
+  SetTestFlag("num_shards", "1");
+  ResetService();
+
+  CreateHnswHashIdx();
+  constexpr size_t kNumDocs = 1000;
+  for (size_t i = 0; i < kNumDocs; ++i) {
+    EXPECT_THAT(Run({"HSET", absl::StrCat("h:", i), "title", "document", "vec", FloatVec(i)}),
+                IntArg(2));
+  }
+  WaitForIndexReady("idx");
+
+  pp_->at(0)->Await([&] {
+    auto* shard = EngineShard::tlocal();
+    auto* index = shard->search_indices()->GetIndex("idx");
+    ASSERT_NE(index, nullptr);
+    ASSERT_EQ(index->key_index().Size(), kNumDocs);
+    DbContext db_cntx{&namespaces->GetDefaultNamespace(), 0, GetCurrentTimeMs()};
+    auto& db_slice = db_cntx.GetDbSlice(shard->shard_id());
+
+    // The posted fiber runs at restoration's periodic yield. Delete every document so the
+    // current document is removed regardless of the key snapshot's iteration order.
+    bool deleted = false;
+    Fiber deleter{[&] {
+      for (size_t i = 0; i < kNumDocs; ++i) {
+        string key = absl::StrCat("h:", i);
+        auto it = db_slice.FindMutable(db_cntx, key, OBJ_HASH);
+        ASSERT_TRUE(it.ok());
+        it->post_updater.Run();
+        db_slice.Del(db_cntx, it->it);
+      }
+      deleted = true;
+    }};
+
+    index->RestoreGlobalVectorIndices("idx", OpArgs{shard, nullptr, db_cntx});
+    EXPECT_TRUE(deleted);
+    deleter.Join();
+    EXPECT_EQ(index->key_index().Size(), 0u);
+  });
+
+  EXPECT_THAT(Run({"DBSIZE"}), IntArg(0));
+  EXPECT_THAT(Run({"FT.SEARCH", "idx", "*=>[KNN 1 @vec $vec]", "PARAMS", "2", "vec", FloatVec(0)}),
+              kNoResults);
+}
+
 // EF_RUNTIME widens the HNSW candidate list at query time: a large value explores enough of the
 // graph to return the exact nearest neighbor, while ef=1 is greedy and provably misses many. The
 // gap proves the per-query EF_RUNTIME override actually reaches and steers the search instead of
```

---

### Incident Patch 5: `611ea528` (2026-10-05)
**Commit Message**: fix(snapshot): wait for delayed entries taken over by writers before the final flush (#8457)

With tiering, a writer's OnChange extracts delayed entries from the serializer queue (its own
bucket plus every resolved entry) and may suspend while holding them. The traversal's forced
drain only sees queued entries, so TraverseAllBuckets returned and the final push ran while
baselines were still being written by another fiber.

Debug builds aborted on DCHECK(!IsAnyBucketBlocked()) in SliceSnapshot::IterateBucketsFb.
Release builds silently dropped those keys from SAVE/BGSAVE files, because nothing flushes the
serializer after the final push.

TraverseAllBuckets now waits until no bucket dependency is pending before it reports success.

Also sync docs/shard-serialization.md with the code: traversal end, delayed-entry ownership,
tagged chunks, stream_mu_ and the journal path.

**File**: `docs/shard-serialization.md` (modified, +62/-49)
```diff
@@ -44,7 +44,7 @@ subclasses implement only how a single bucket/entry is turned into bytes:
 | `DbSlice::ChangeConsumerInterface` | `src/server/db_slice.h` | Change-listener interface implemented by `SerializerBase` |
 | `BucketDependencies` | `src/server/serializer_base.h` | Per-bucket dependency counter for in-flight async work |
 | `DelayedEntryHandler` | `src/server/serializer_base.h` | Owns delayed tiered entries, keyed by bucket |
-| `ThreadLocalMutex` | `src/server/synchronization.h` | Fiber-aware mutex guarding the serializer buffer (`stream_mu_`) |
+| `ThreadLocalMutex` | `src/server/synchronization.h` | Fiber-aware mutex guarding the serializer buffer (`stream_mu_`); active only without tagged chunks |
 | `ChangeReq` | `src/server/table.h` | `PrimeTable::BucketSet` — the set of buckets about to be mutated |
 | `BucketIdentity` | `src/server/serializer_base.h` | `uintptr_t` bucket address, stable bucket key |
 
@@ -181,8 +181,9 @@ IterateBucketsFb(send_full_sync_cut)         // snapshot.cc
                    /*include empty buckets=*/true)
       PushSerialized(false)                  // explicit flush between buckets
       yield if background mode, or if CPU time > ~15us
-    ProcessDelayedEntries(force=true, ...)   // drain outstanding tiered reads
-    PushSerialized(true)                     // force-flush after each database
+    ProcessDelayedEntries(force=true, ...)   // drain the queued tiered reads
+  BucketDependencies::WaitEmpty()            // entries taken over by OnChange fibers
+  PushSerialized(true)                       // force-flush after the traversal
   if send_full_sync_cut:                     // replication only
     serializer_->SendFullSyncCut()
     PushSerialized(true)
@@ -272,11 +273,15 @@ Tiered (on-disk, external) string values are not read synchronously. `SerializeE
 `ProcessDelayedEntries(force, flush_bucket, cntx)` drains entries:
 
 - If `flush_bucket` is set, all entries for that bucket are extracted and serialized.
-- Otherwise, entries whose futures are already resolved are serialized (or **all** entries if
+- In addition, entries whose futures are already resolved are serialized (or **all** entries if
   `force` is true, or if the queue exceeds `kMaxDelayedEntries == 512`).
 - Each drained entry is serialized via `SerializeFetchedEntry` (which takes `stream_mu_` and calls
   `SerializeEntryLocked`), then its bucket dependency is decremented.
 
+The calling fiber extracts the entries first and may suspend while it holds them (tiered read,
+chunk flush). Entries taken by an `OnChange` fiber are therefore invisible to the traversal's own
+drain, so `TraverseAllBuckets` reports success only after `BucketDependencies::WaitEmpty()`.
+
 Because delayed entries are **keyed by bucket** and hold a `BucketDependencies` reference, a bucket
 is not considered free of in-flight work until all its tiered reads have been serialized. This is
 what makes the ordering invariant hold for tiered values: a mutation or deletion of a tiered key
@@ -316,22 +321,26 @@ preempting) bucket serialization, replacing the older single `db_slice_->GetLatc
 
 ```
 ConsumeJournalChange(item):                  // snapshot.cc
-  lock_guard(stream_mu_)
-  LOG_IF(DFATAL, serialize_bucket_running_)  // interleaving not yet supported
+  lock_guard(stream_mu_)                     // no-op with tagged chunks
   serializer_->WriteJournalEntry(item.journal_item.data)
   ++stats_.jounal_changes
 ```
 
-Active only when streaming the journal (replication / migration). It acquires `stream_mu_` so the
-journal write cannot interleave with an in-progress entry serialization that shares the same
-`serializer_` buffer. It only appends to the buffer; flushing happens later via `ThrottleIfNeeded`
-→ `PushSerialized(false)`, called by `JournalSlice` after the journal callback returns.
+Active only when streaming the journal (replication / migration). It only appends to the buffer;
+flushing happens later via `ThrottleIfNeeded` → `PushSerialized(false)`, called by `JournalSlice`
+after the journal callback returns.
+
+A journal write can arrive while a large entry is suspended in a mid-entry flush:
+
+- **Tagged chunks (default).** `stream_mu_` is inactive. The journal blob is written between the
+  tagged chunks of the split entry and the loader reassembles the entry by stream id (see
+  [Tagged Chunks](#tagged-chunks)).
+- **Untagged stream (`--serialization_tagged_chunks=false`).** `stream_mu_` is active and keeps the
+  journal blob out of the middle of an entry, which would otherwise corrupt the wire format.
 
-The `DFATAL` guard asserts that a journal write never lands in the middle of a bucket
-serialization. This holds because the bucket being serialized has an outstanding
-`BucketDependencies` entry, and the deletion/journal paths that could race are gated on it (next
-section). The guard's comment notes it can be removed once the wire format supports interleaved
-(tagged) chunks for journal vs bucket st
```

**File**: `src/server/serializer_base.cc` (modified, +3/-0)
```diff
@@ -278,6 +278,9 @@ bool SerializerBase::TraverseAllBuckets(bool visit_empty) {
     ProcessDelayedEntries(true, 0, base_cntx_);
   }
 
+  // Other fibers may still hold delayed entries they took over in OnChange.
+  BucketDependencies::WaitEmpty();
+
   return base_cntx_->IsRunning();
 }
 
```

**File**: `src/server/serializer_base.h` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ class SerializerBase : public BucketDependencies,
   // Traversal flow: goes over all buckets of every database in db_array_ and processes them with
   // ProcessBucket, serializing the delayed entries after each database. Pending delayed entries
   // are discarded on cancellation. visit_empty controls whether empty buckets are processed.
-  // Returns false if the traversal was cancelled.
+  // Returns false if the traversal was cancelled, true only once no bucket dependency is pending.
   bool TraverseAllBuckets(bool visit_empty);
 
   // Called by TraverseAllBuckets before processing each bucket.
```

**File**: `src/server/serializer_base_test.cc` (modified, +90/-0)
```diff
@@ -8,12 +8,15 @@
 #include <absl/random/distributions.h>
 #include <absl/random/random.h>
 #include <gtest/gtest.h>
+#include <unistd.h>
 
 #include <atomic>
 #include <boost/smart_ptr/intrusive_ptr.hpp>
 #include <chrono>
 #include <queue>
+#include <utility>
 
+#include "base/flags.h"
 #include "base/logging.h"
 #include "facade/facade_test.h"
 #include "facade/resp_expr.h"
@@ -36,6 +39,9 @@
 
 using namespace std::chrono_literals;
 
+ABSL_DECLARE_FLAG(bool, force_epoll);
+ABSL_DECLARE_FLAG(std::string, tiered_prefix);
+
 namespace dfly {
 
 // Driver for "artificially" resolving delayed entries with some delay
@@ -108,6 +114,7 @@ struct TestDriver : public SerializerBase, journal::JournalConsumerInterface {
     bool start_paused = false;
     bool block_on_update = false;
     bool eventually_consistent = false;
+    bool park_after_delayed = false;  // park the traversal once after its first delayed entry
   };
 
   TestDriver(Params params, DbSlice* slice, ExecutionState* cntx, CommandRegistry* reg)
@@ -163,6 +170,10 @@ struct TestDriver : public SerializerBase, journal::JournalConsumerInterface {
     return DelayedEntryHandler::deps_.HasAny();
   }
 
+  bool HasQueuedDelayed() const {
+    return !DelayedEntryHandler::delayed_entries_.empty();
+  }
+
   void RecordSerialized(std::string key) {
     // Simulate occasional yields due to big value flushes
     while (absl::Bernoulli(bg_, 0.4)) {
@@ -214,6 +225,10 @@ struct TestDriver : public SerializerBase, journal::JournalConsumerInterface {
   TestDelayDriver delay_driver_;
 
   util::fb2::Done on_update_entered_, on_update_release_, resume_traversal_;
+  util::fb2::Done traversal_parked_, traversal_release_, traversal_done_;
+
+  bool parked_ = false;
+  bool blocked_after_traversal_ = false;  // IsAnyBucketBlocked() right after the traversal
 
   // Number of delayed entries currently enqueued.
   unsigned delayed_enqueued_ = 0;
@@ -227,9 +242,16 @@ void TestDriver::Loop() {
     resume_traversal_.Wait();
 
   TraverseAllBuckets(false);
+  blocked_after_traversal_ = IsAnyBucketBlocked();
+  traversal_done_.Notify();
 }
 
 void TestDriver::PaceTraversal(bool done) {
+  if (params_.park_after_delayed && delayed_enqueued_ > 0 && !std::exchange(parked_, true)) {
+    traversal_parked_.Notify();
+    traversal_release_.Wait();
+  }
+
   // Simualte yield due to socket flushes
   for (unsigned i = 0; i < 2; ++i)
     util::ThisFiber::Yield();
@@ -370,6 +392,35 @@ class SerializerBaseTest : public BaseFamilyTest {
   std::optional<TestDriver> driver_;
 };
 
+// With tiered storage enabled, OnChange also flushes the delayed entries of the changed bucket.
+class SerializerBaseTieredTest : public SerializerBaseTest {
+ public:
+  void SetUp() override {
+#if defined(__linux__) && defined(WITH_TIERING)
+    bool supported = !absl::GetFlag(FLAGS_force_epoll);
+#else
+    bool supported = false;
+#endif
+    if (!supported)
+      GTEST_SKIP() << "Requires tiered storage on io_uring";
+
+    prev_prefix_ = absl::GetFlag(FLAGS_tiered_prefix);
+    absl::SetFlag(&FLAGS_tiered_prefix,
+                  absl::StrCat(testing::TempDir(), "serializer_base_test_", getpid()));
+    SerializerBaseTest::SetUp();
+  }
+
+  void TearDown() override {
+    if (!prev_prefix_)
+      return;
+    SerializerBaseTest::TearDown();
+    absl::SetFlag(&FLAGS_tiered_prefix, *prev_prefix_);
+  }
+
+ private:
+  std::optional<std::string> prev_prefix_;  // set once SetUp ran
+};
+
 class SerializerBaseParamTest : public SerializerBaseTest,
                                 public testing::WithParamInterface<bool> {};
 
@@ -613,4 +664,43 @@ TEST_F(SerializerBaseTest, CancelledTraversalDiscardsDelayed) {
   EXPECT_FALSE(CancelledTraversalLeaksDelayed());
 }
 
+// A writer's OnChange takes the delayed entry of an already traversed bucket and suspends on its
+// unresolved read. A successful traversal must not end while that entry is still pending.
+TEST_F(SerializerBaseTieredTest, TraversalWaitsForDelayedEntryTakenByOnChange) {
+  driver_params = {.delay_prob = 1.0, .park_after_delayed = true};
+
+  Run({"DEBUG", "POPULATE", "1"});
+  Start();
+  Change([](TestDriver& d) { d.traversal_parked_.Wait(); });
+
+  auto writer = pp_->at(0)->LaunchFiber([&] { Run("W1", {"APPEND", "key:0", "D"}); });
+
+  bool taken = false;
+  Change([&taken](TestDriver& d) {
+    for (unsigned i = 0; i < 2000 && d.HasQueuedDelayed(); ++i)
+      util::ThisFiber::SleepFor(1ms);
+    taken = !d.HasQueuedDelayed() && d.delayed_enqueued_ == 1;
+  });
+
+  // Give the traversal time to reach its end while the writer still holds the entry.
+  Change([](TestDriver& d) {
+    d.traversal_release_.Notify();
+    d.traversal_done_.WaitFor(20ms);
+  });
+
+  Change([](TestDriver& d) { d.delay_driver_.Resume(); });
+  writer.Join();
+
+  bool blocked = true;
+  Change([&blocked](TestDriver& d) {
+    d.traversal_done_.Wait();
+    blocked = d.blocked_after_traversal_;
+  });
+  auto [stats, baselines, journal_writes] = 
```

**File**: `src/server/snapshot.cc` (modified, +1/-2)
```diff
@@ -161,8 +161,7 @@ void SliceSnapshot::IterateBucketsFb(bool send_full_sync_cut) {
 
   PushSerialized(true);
 
-  // The traversal waits for in-flight OnChange serializations of every bucket it visits, so no
-  // bucket serialization or delayed entry may be pending when the full sync cut is sent.
+  // A successful traversal leaves no bucket dependency pending.
   DCHECK(!IsAnyBucketBlocked());
   if (send_full_sync_cut) {
     CHECK(!serializer_->SendFullSyncCut());
```

---

### Incident Patch 6: `36f511b1` (2026-10-04)
**Commit Message**: fuzz: pair a crash with its RECORD set by content, not by number (#8467)

package_crash.sh bundled RECORD:${CRASH_ID}, the set of the same number as the
crash. AFL numbers RECORD sets by crash event (unsaved calibration/trim aborts
included), while the crash file's id: counts only saved crashes, so the archive
carried another crash's history and could not reproduce (runs 267, 273).

Pick the set whose newest record is byte-identical to the crash input (the ring
saves every testcase before running it) and copy it renamed to RECORD:${CRASH_ID}
so the bundled replay still finds it. Drop that newest record, since it equals the
crash input replay already appends, so the crashing input is not replayed twice.
When several sets share the crash's final input the pairing is ambiguous, so record
HISTORY_AMBIGUOUS in the archive; triage then reports INCONCLUSIVE, not a false
positive. Package the crash input alone when no set matches.

**File**: `fuzz/package_crash.sh` (modified, +58/-6)
```diff
@@ -47,8 +47,30 @@ if [[ -z "$CRASH_FILE" ]]; then
     exit 1
 fi
 
-# Count RECORD files
-RECORD_COUNT=$(find "$CRASHES_DIR" -maxdepth 1 -name "RECORD:${CRASH_ID},cnt:*" | wc -l)
+# AFL numbers RECORD sets by crash event, counting unsaved calibration/trim aborts too, while the
+# crash file's id: counts only saved crashes — so RECORD:${CRASH_ID} is usually another crash's
+# history. The ring saves every testcase before running it, so the crash's own set is the one whose
+# newest (highest-cnt) record is byte-identical to the crash input; pair by that.
+declare -A NEWEST_REC
+while IFS= read -r f; do
+    base=${f##*/}
+    ev=${base#RECORD:}; ev=${ev%%,*}
+    cur=${NEWEST_REC[$ev]:-}
+    if [[ -z "$cur" ]] || (( 10#${base##*,cnt:} > 10#${cur##*,cnt:} )); then
+        NEWEST_REC[$ev]=$base
+    fi
+done < <(find "$CRASHES_DIR" -maxdepth 1 -name 'RECORD:*,cnt:*')
+
+RECORD_EVENT=""
+MATCHES=0
+for ev in $(printf '%s\n' "${!NEWEST_REC[@]}" | sort -n); do
+    if cmp -s "$CRASHES_DIR/${NEWEST_REC[$ev]}" "$CRASH_FILE"; then
+        MATCHES=$((MATCHES + 1))
+        if [[ -z "$RECORD_EVENT" ]]; then
+            RECORD_EVENT="$ev"
+        fi
+    fi
+done
 
 ARCHIVE_NAME="crash-${CRASH_ID}"
 TMPDIR=$(mktemp -d)
@@ -57,12 +79,32 @@ mkdir -p "$DEST/crashes"
 
 print_info "Packaging crash ${CRASH_ID}..."
 print_info "Crash input: $(basename "$CRASH_FILE")"
-print_info "RECORD files: ${RECORD_COUNT}"
 
-# Copy crash input and RECORD files into crashes/ subdirectory
+# Copy the crash input, then this crash's RECORD history renamed to RECORD:${CRASH_ID} so the
+# bundled replay (which keys off the crash id) finds it; the cnt suffix is kept so replay order is
+# unchanged. The set's newest record is byte-identical to the crash input, and replay sends the
+# crash input on its own after the records, so drop that newest record to avoid replaying it twice.
 cp "$CRASH_FILE" "$DEST/crashes/"
-if [[ $RECORD_COUNT -gt 0 ]]; then
-    find "$CRASHES_DIR" -maxdepth 1 -name "RECORD:${CRASH_ID},cnt:*" -exec cp {} "$DEST/crashes/" \;
+RECORD_COUNT=0
+if [[ -n "$RECORD_EVENT" ]]; then
+    if [[ $MATCHES -gt 1 ]]; then
+        print_warn "The crash input is the newest record of ${MATCHES} sets whose earlier inputs"
+        print_warn "differ; their histories cannot be told apart. Using set ${RECORD_EVENT} — replay"
+        print_warn "may rebuild a different state than the fuzz run."
+    fi
+    NEWEST_BASE="${NEWEST_REC[$RECORD_EVENT]}"
+    while IFS= read -r rec; do
+        base=${rec##*/}
+        if [[ "$base" == "$NEWEST_BASE" ]]; then
+            continue
+        fi
+        cp "$rec" "$DEST/crashes/RECORD:${CRASH_ID},${base#*,}"
+        RECORD_COUNT=$((RECORD_COUNT + 1))
+    done < <(find "$CRASHES_DIR" -maxdepth 1 -name "RECORD:${RECORD_EVENT},cnt:*")
+    print_info "RECORD files: ${RECORD_COUNT} (from set ${RECORD_EVENT}; crash input sent separately)"
+else
+    print_warn "No RECORD set matches the crash input by content; its true history was not saved"
+    print_warn "(an unsaved abort reused its number). Packaging the crash input alone."
 fi
 
 # Copy replay_crash.py
@@ -125,6 +167,16 @@ else
     } > "$DEST/repro.env"
 fi
 
+# A surviving replay proves a false positive only if it rebuilt the fuzz-run state. Record in the
+# archive when that cannot be guaranteed — the history is missing (no set matched) or ambiguous
+# (several sets share this crash's final input but differ earlier) — so the recipient's triage
+# reports INCONCLUSIVE instead of a confident false positive (the stdout warnings above are not shipped).
+if [[ -z "$RECORD_EVENT" ]]; then
+    echo "HISTORY_MISSING=1" >> "$DEST/repro.env"
+elif [[ $MATCHES -gt 1 ]]; then
+    echo "HISTORY_AMBIGUOUS=${MATCHES}" >> "$DEST/repro.env"
+fi
+
 REPLAY_PORT=6379
 MODE_HINT="resp"
 if [[ -f "$DEST/repro.env" ]]; then
```

**File**: `fuzz/triage_crashes.sh` (modified, +14/-0)
```diff
@@ -323,6 +323,8 @@ for CRASH_ARCHIVE in "${CRASH_ARCHIVES[@]}"; do
     # repro.env is written by run_fuzzer.sh so flags stay in sync with the fuzz run.
     # Fallback to safe defaults for older archives that don't include repro.env.
     REPRO_ENV="$EXTRACT_DIR/${CRASH_NAME}/repro.env"
+    AMBIG=""
+    MISSING=""
     if [[ -f "$REPRO_ENV" ]]; then
         # The archive knows its protocol (PROTOCOL=, or --memcached_port in older archives);
         # replaying it under the wrong one would silently produce a false positive.
@@ -340,6 +342,9 @@ for CRASH_ARCHIVE in "${CRASH_ARCHIVES[@]}"; do
         # flags are defaults, so survival proves nothing about the real configuration.
         GUESSED=0
         grep -q '^GUESSED=1' "$REPRO_ENV" && GUESSED=1
+        # package_crash.sh sets these when the crash's history is ambiguous or missing entirely.
+        AMBIG=$(grep '^HISTORY_AMBIGUOUS=' "$REPRO_ENV" | cut -d= -f2 || true)
+        MISSING=$(grep '^HISTORY_MISSING=' "$REPRO_ENV" | cut -d= -f2 || true)
         MEM_LIMIT_KB=$(grep '^MEM_LIMIT_KB=' "$REPRO_ENV" | cut -d= -f2 || true)
         MEM_LIMIT_KB="${MEM_LIMIT_KB:-$((4 * 1024 * 1024))}"
         # Only flags go to the server; PROTOCOL=, GUESSED= and MEM_LIMIT_KB= are metadata.
@@ -372,6 +377,15 @@ for CRASH_ARCHIVE in "${CRASH_ARCHIVES[@]}"; do
         CONFIG_CHANGED+="memory limit ${MEM_LIMIT_KB} KB overridden to ${TRIAGE_MEM_LIMIT_KB}; "
         MEM_LIMIT_KB="$TRIAGE_MEM_LIMIT_KB"
     fi
+    # Missing or ambiguous RECORD history: the archive carries none, or possibly another crash's, so a
+    # surviving server is INCONCLUSIVE and a death is a crash under a possibly-different state, not a
+    # clean confirm.
+    if [[ -n "$MISSING" ]]; then
+        CONFIG_CHANGED+="crash history missing (no RECORD set matched the crash input); "
+    fi
+    if [[ -n "$AMBIG" ]]; then
+        CONFIG_CHANGED+="crash history ambiguous (the crash input is the newest record of ${AMBIG} sets); "
+    fi
 
     # Both ports must be free before starting: a foreign service already listening there would
     # pass the readiness check and receive the fuzz input if Dragonfly failed to bind.
```

---

### Incident Patch 7: `82253357` (2026-10-02)
**Commit Message**: fix(server): clear rdb_bgsave_in_progress when BGSAVE finishes (#8459)

SaveStagesController declared its own is_bg_save_ member that shadowed the one inherited
from SaveStagesInputs, so IsBgSave() was always false. WaitUntilSaveFinished therefore never
cleared bgsave_in_progress and never updated last_bgsave_status: INFO persistence reported
rdb_bgsave_in_progress:1 forever after the first BGSAVE.

Remove the shadowing member. Also keep save_mu_ held until the save info is stored, so a
finishing save cannot overwrite the flag of a BGSAVE that starts right after it.

**File**: `src/server/detail/save_stages_controller.h` (modified, +0/-1)
```diff
@@ -139,7 +139,6 @@ struct SaveStagesController : public SaveStagesInputs {
 
   absl::flat_hash_map<string_view, size_t> rdb_name_map_;
   util::fb2::Mutex rdb_name_map_mu_;
-  bool is_bg_save_ = false;
 };
 
 GenericError ValidateFilename(const std::filesystem::path& filename, bool new_version);
```

**File**: `src/server/generic_family_test.cc` (modified, +7/-0)
```diff
@@ -1742,6 +1742,13 @@ TEST_F(GenericFamilyTest, Info) {
       },
       500ms);
   EXPECT_TRUE(cond);
+  cond = WaitUntilCondition(
+      [&]() {
+        resp = Run({"info", "persistence"});
+        return resp.GetString().find("rdb_bgsave_in_progress:0") != string::npos;
+      },
+      500ms);
+  EXPECT_TRUE(cond) << resp.GetString();
 
   EXPECT_EQ(Run({"set", "k3", "3"}), "OK");
   resp = Run({"info", "persistence"});
```

**File**: `src/server/server_family.cc` (modified, +12/-13)
```diff
@@ -1897,21 +1897,20 @@ GenericError ServerFamily::WaitUntilSaveFinished(Transaction* trans, bool ignore
 
   VLOG(1) << "Before WaitUntilSaveFinished::Finalize";
   bool is_bg_save;
-  {
-    util::fb2::LockGuard lk(save_mu_);
-    // It's possible that another save was initiated and the controller has changed.
-    // We only finalize and reset if it's still the same one we were waiting for.
-    if (save_controller_ == controller) {
-      save_info = save_controller_->Finalize();
-      is_bg_save = save_controller_->IsBgSave();
-      save_controller_.reset();
-    } else {
-      // Another save has started. The old one is already finalized by the new one.
-      // We just need to get the info.
-      return GenericError("Save operation was superseded by another save");
-    }
+  util::fb2::LockGuard lk(save_mu_);
+  // It's possible that another save was initiated and the controller has changed.
+  // We only finalize and reset if it's still the same one we were waiting for.
+  if (save_controller_ == controller) {
+    save_info = save_controller_->Finalize();
+    is_bg_save = save_controller_->IsBgSave();
+    save_controller_.reset();
+  } else {
+    // Another save has started. The old one is already finalized by the new one.
+    // We just need to get the info.
+    return GenericError("Save operation was superseded by another save");
   }
 
+  // Still under save_mu_, so the next save cannot start before its predecessor's state is stored.
   thread_safe_save_info_.Update([&](SaveInfoData* data) {
     if (is_bg_save) {
       data->bgsave_in_progress = false;
```

---

### Incident Patch 8: `ec31cce3` (2026-10-02)
**Commit Message**: fix(tests): pin redis-py below 8 (#8453)

**File**: `tests/dragonfly/requirements.txt` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ pluggy>=1.0.0
 py>=1.11.0
 pyparsing>=3.0.9
 pytest>=7.1.2
-redis>=5.2.1
+redis>=5.2.1,<8.0.0
 tomli>=2.0.1
 wrapt>=1.14.1
 pytest-asyncio==0.20.1
```

---

### Incident Patch 9: `f799bf39` (2026-10-02)
**Commit Message**: fix(tiering): Disable cooling during load (#8144)

**File**: `src/server/tiered_storage.cc` (modified, +7/-1)
```diff
@@ -24,6 +24,7 @@
 #include "server/db_slice.h"
 #include "server/engine_shard_set.h"
 #include "server/search/doc_index.h"
+#include "server/server_state.h"
 #include "server/snapshot.h"
 #include "server/table.h"
 #include "server/tiering/common.h"
@@ -270,7 +271,7 @@ class TieredStorage::ShardOpManager : public tiering::OpManager {
       StashDescriptor blobs{FragmentRef{*pv}.GetSerializationDescr()};
       // The value's bytes leave the RAM ledger; a cool copy is tracked by the cool cache only.
       AccountObjectMemory(key.second, pv->ObjType(), -int64_t(pv->MallocUsed()), table);
-      if (ts_->config_.experimental_cooling) {
+      if (ts_->ShouldCool()) {
         RetireColdEntries(pv->MallocUsed());
         ts_->CoolDown(key.first, key.second, segment, blobs.rep, pv);
       } else {
@@ -889,6 +890,11 @@ auto TieredStorage::ShouldStash(const tiering::FragmentRef& fragment_ref,
   return nullopt;
 }
 
+bool TieredStorage::ShouldCool() const {
+  // Don't cool while loading lots of values into memory as those are not client writes
+  return config_.experimental_cooling && ServerState::tlocal()->gstate() != GlobalState::LOADING;
+}
+
 void TieredStorage::CoolDown(DbIndex db_ind, std::string_view str,
                              const tiering::DiskSegment& segment, CompactObj::ExternalRep rep,
                              PrimeValue* pv) {
```

**File**: `src/server/tiered_storage.h` (modified, +3/-0)
```diff
@@ -151,6 +151,9 @@ class TieredStorage : public TieredStorageBase {
                     std::function<void(io::Result<tiering::Decoder*>)> cb,
                     tiering::ReadOptions options = {});
 
+  // Whether newly offloaded values should be cooled (added to cool queue) now
+  bool ShouldCool() const;
+
   // Moves pv contents to the cool storage and updates pv to point to it.
   void CoolDown(DbIndex db_ind, std::string_view str, const tiering::DiskSegment& segment,
                 CompactObj::ExternalRep rep, PrimeValue* pv);
```

---

### Incident Patch 10: `4d859640` (2026-10-02)
**Commit Message**: feat(search): report real index build progress in FT.INFO percent_indexed (#8428)

percent_indexed was a fixed 0.5 while an index was building. It now follows the build:

- DashTable::TraverseProgress() turns a Traverse cursor into the share of the table already
  visited. It only grows, also while the table splits or loses keys.
- IndexBuilder weighs three phases by their usual cost: key scan (1), HNSW graph fill (8, only
  with HNSW fields) and the numeric finalize step (1, only when a RangeTree builder exists).
  Progress stays below 1 while the builder exists.
- FieldIndices::FinalizeWork() and FinalizeInitialization(size_t* done) let
  RangeTree::Builder::Populate() report how many sorted values it has inserted.
- FT.INFO takes the minimum over shards and rounds down to 4 decimals. It is exactly 1 when
  indexing is done; reply types are unchanged.

**File**: `src/core/dash.h` (modified, +5/-0)
```diff
@@ -360,6 +360,11 @@ class DashTable : public detail::DashTableBase {
   // shrinks or grows. Returns: cursor that is guaranteed to be less than 2^40.
   template <typename Cb> Cursor Traverse(Cursor curs, Cb&& cb);
 
+  // Share of the table already traversed when Traverse() returned `curs`, 0 for end().
+  static double TraverseProgress(Cursor curs) {
+    return (curs.bucket_id() + curs.segment_fraction()) / kBucketNum;
+  }
+
   // Traverses over physical buckets. It calls cb once for each bucket by passing a bucket iterator.
   // if cursor=0 starts traversing from the beginning, otherwise continues from where
   // it stopped. returns 0 if the supplied cursor reached end of traversal.
```

**File**: `src/core/dash_internal.h` (modified, +5/-0)
```diff
@@ -740,6 +740,11 @@ class DashCursor {
     return val_ >> (40 - depth);
   }
 
+  // segment_id as a fraction of the segment id space, independent of depth.
+  double segment_fraction() const {
+    return double(val_ >> 8) / (uint64_t(1) << 32);
+  }
+
   uint64_t token() const {
     return val_;
   }
```

**File**: `src/core/dash_test.cc` (modified, +54/-0)
```diff
@@ -1411,6 +1411,60 @@ TEST_F(DashTest, Traverse) {
   EXPECT_EQ(kNumItems - 1, nums.back());
 }
 
+TEST_F(DashTest, TraverseProgress) {
+  EXPECT_EQ(Dash64::TraverseProgress(Dash64::Cursor::end()), 0);
+
+  constexpr size_t kNumItems = 20000;
+  for (size_t i = 0; i < kNumItems; ++i) {
+    dt_.Insert(i, i);
+  }
+
+  size_t visited = 0;
+  double prev = 0;
+  Dash64::Cursor cursor;
+  while ((cursor = dt_.Traverse(cursor, [&](Dash64::iterator) { ++visited; }))) {
+    double progress = Dash64::TraverseProgress(cursor);
+    ASSERT_GT(progress, prev);
+    ASSERT_LT(progress, 1);
+    ASSERT_NEAR(progress, double(visited) / kNumItems, 0.02);
+    prev = progress;
+  }
+  EXPECT_EQ(visited, kNumItems);
+}
+
+// Progress keeps growing while the table splits or loses keys under the cursor.
+TEST_F(DashTest, TraverseProgressMutations) {
+  constexpr size_t kInitial = 1000, kMax = 20000;
+  for (size_t i = 0; i < kInitial; ++i) {
+    dt_.Insert(i, i);
+  }
+  const size_t segments = dt_.unique_segments();
+
+  set<uint64_t> visited;
+  uint64_t next_key = kInitial;
+  double prev = 0;
+  Dash64::Cursor cursor;
+  do {
+    cursor = dt_.Traverse(cursor, [&](Dash64::iterator it) { visited.insert(it->first); });
+    for (unsigned i = 0; i < 20 && next_key < kMax; ++i, ++next_key) {
+      dt_.Insert(next_key, next_key);
+      if (next_key % 2)
+        dt_.Erase(next_key - kInitial / 2);
+    }
+    if (cursor) {
+      double progress = Dash64::TraverseProgress(cursor);
+      ASSERT_GT(progress, prev);
+      ASSERT_LT(progress, 1);
+      prev = progress;
+    }
+  } while (cursor);
+
+  EXPECT_GT(dt_.unique_segments(), segments);
+  for (uint64_t i = 0; i < kInitial / 2; ++i) {
+    EXPECT_TRUE(visited.contains(i)) << i;
+  }
+}
+
 TEST_F(DashTest, TraverseSegmentOrder) {
   constexpr auto kNumItems = 50;
   for (size_t i = 0; i < kNumItems; ++i) {
```

**File**: `src/core/search/base.h` (modified, +9/-2)
```diff
@@ -11,6 +11,7 @@
 #include <cstddef>
 #include <cstdint>
 #include <memory>
+#include <optional>
 #include <string>
 #include <string_view>
 #include <vector>
@@ -130,8 +131,14 @@ struct BaseIndex {
   virtual std::vector<DocId> GetAllDocsWithNonNullValues() const = 0;
 
   /* Called at the end of indexes rebuilding after all initial Add calls are done.
-     Some indices may need to finalize internal structures. See RangeTree for example. */
-  virtual void FinalizeInitialization() {
+     Some indices may need to finalize internal structures. See RangeTree for example.
+     Adds the amount of FinalizeWork() done to `*done` as it goes, if set. */
+  virtual void FinalizeInitialization(size_t* done) {
+  }
+
+  // Values FinalizeInitialization() would process if called now, nullopt if no finalize step.
+  virtual std::optional<size_t> FinalizeWork() const {
+    return std::nullopt;
   }
 
   // Defragments the index by moving objects in underutilized pages to the current malloc page.
```

**File**: `src/core/search/indices.cc` (modified, +12/-4)
```diff
@@ -340,11 +340,15 @@ class RangeTreeAdapter : public NumericIndex::RangeTreeBase {
     return range_tree_.GetAllDocIds().Take();
   }
 
-  void FinalizeInitialization() override {
-    builder_->Populate(&range_tree_, {500});
+  void FinalizeInitialization(size_t* done) override {
+    builder_->Populate(&range_tree_, {500}, done);
     builder_.reset();
   }
 
+  std::optional<size_t> FinalizeWork() const override {
+    return builder_ ? std::optional{builder_->Size()} : std::nullopt;
+  }
+
  private:
   RangeTree range_tree_;
   std::optional<RangeTree::Builder> builder_;
@@ -443,8 +447,12 @@ void NumericIndex::Remove(DocId id, const DocumentAccessor& doc, string_view fie
   range_tree_->Remove(id, absl::MakeSpan(numbers));
 }
 
-void NumericIndex::FinalizeInitialization() {
-  range_tree_->FinalizeInitialization();
+void NumericIndex::FinalizeInitialization(size_t* done) {
+  range_tree_->FinalizeInitialization(done);
+}
+
+optional<size_t> NumericIndex::FinalizeWork() const {
+  return range_tree_->FinalizeWork();
 }
 
 RangeResult NumericIndex::Range(double l, double r) const {
```

**File**: `src/core/search/indices.h` (modified, +7/-2)
```diff
@@ -63,7 +63,11 @@ struct NumericIndex : public BaseIndex {
     // Returns all DocIds that have non-null values in the index.
     virtual std::vector<DocId> GetAllDocIds() const = 0;
 
-    virtual void FinalizeInitialization(){};
+    virtual void FinalizeInitialization(size_t* done){};
+
+    virtual std::optional<size_t> FinalizeWork() const {
+      return std::nullopt;
+    }
 
     virtual ~RangeTreeBase() = default;
   };
@@ -75,7 +79,8 @@ struct NumericIndex : public BaseIndex {
   bool Add(DocId id, const DocumentAccessor& doc, std::string_view field) override;
   void Remove(DocId id, const DocumentAccessor& doc, std::string_view field) override;
 
-  void FinalizeInitialization() override;
+  void FinalizeInitialization(size_t* done) override;
+  std::optional<size_t> FinalizeWork() const override;
 
   RangeResult Range(double l, double r) const;
 
```

**File**: `src/core/search/range_tree.cc` (modified, +12/-2)
```diff
@@ -306,7 +306,7 @@ void RangeTree::Builder::Remove(DocId id, double value) {
     delayed_erased_.emplace(id, value);
 }
 
-void RangeTree::Builder::Populate(RangeTree* tree, const RenewableQuota& quota) {
+void RangeTree::Builder::Populate(RangeTree* tree, const RenewableQuota& quota, size_t* done) {
   // Sort all elements by value
   std::vector<Entry> sorted_entries(updates_.begin(), updates_.end());
   rng::sort(sorted_entries, {}, &Entry::second);
@@ -317,6 +317,13 @@ void RangeTree::Builder::Populate(RangeTree* tree, const RenewableQuota& quota)
   // Add sorted elements in batches
   size_t max_size = tree->max_range_block_size_;
   RangeBlock* block = &tree->entries_.begin()->second;
+  size_t reported = 0;
+  auto report = [&](size_t idx) {
+    if (done) {
+      *done += idx - reported;
+      reported = idx;
+    }
+  };
   for (size_t idx = 0; idx < sorted_entries.size();) {
     // Create new block for each insertion batch (first goes into only first block)
     if (idx)
@@ -331,10 +338,13 @@ void RangeTree::Builder::Populate(RangeTree* tree, const RenewableQuota& quota)
       idx++;
 
       // If we filled a new multiple of the block size due to equal entries, check quota
-      if ((block->Size() - 1) / max_size != block->Size() / max_size)
+      if ((block->Size() - 1) / max_size != block->Size() / max_size) {
+        report(idx);
         quota.Check();
+      }
     }
 
+    report(idx);
     quota.Check();  // Yield if needed
   }
 
```

**File**: `src/core/search/range_tree.h` (modified, +7/-1)
```diff
@@ -42,8 +42,14 @@ class RangeTree {
     void Add(DocId id, double value);
     void Remove(DocId id, double value);
 
+    // Number of batched updates Populate() would sort and insert if called now.
+    size_t Size() const {
+      return updates_.size();
+    }
+
     // Build tree from batched updates. Accepts new updates during suspensions.
-    void Populate(RangeTree* tree, const RenewableQuota& quota);
+    // Adds the number of sorted updates inserted so far to `*done`, if set.
+    void Populate(RangeTree* tree, const RenewableQuota& quota, size_t* done = nullptr);
 
    private:
     absl::flat_hash_set<Entry> updates_, delayed_erased_;
```

---

### Incident Patch 11: `152d953a` (2026-10-02)
**Commit Message**: fix(server): read offloaded strings in SORT BY/GET instead of aborting (#8436)

SORT ... BY <pattern> and SORT ... GET <pattern> looked up the referenced keys with ToString()
on a possibly offloaded value and tripped CHECK(!IsExternal()) in Debug and Release once tiering
had moved that string to disk.

**File**: `src/server/bitops_family.cc` (modified, +8/-28)
```diff
@@ -59,12 +59,6 @@ OpResult<std::size_t> CountBitsForValue(const OpArgs& op_args, string_view key,
                                         int64_t end, bool bit_value);
 OpResult<int64_t> FindFirstBitWithValue(const OpArgs& op_args, string_view key, bool value,
                                         int64_t start, int64_t end, bool as_bit);
-string GetString(const PrimeValue& pv);
-// Materializes the full string value, reading it back from tiered storage if it
-// was offloaded. bitops must never touch an external value directly - the
-// CompactObj accessors CHECK(!IsExternal()).
-OpResult<string> ReadStringValue(DbIndex dbid, string_view key, const PrimeValue& pv,
-                                 EngineShard* shard);
 bool SetBitValue(uint32_t offset, bool bit_value, string* entry);
 std::size_t CountBitSetByByteIndices(string_view at, std::size_t start, std::size_t end);
 std::size_t CountBitSet(string_view str, int64_t start, int64_t end, bool bits);
@@ -324,7 +318,8 @@ OpResult<string> ElementAccess::Value() const {
   if (IsNewEntry())
     return OpResult<string>{string{}};
 
-  auto res = ReadStringValue(context_.db_index, key_, updater_.it->second, EngineShard::tlocal());
+  auto res = ReadStringValue(context_.db_index, key_, updater_.it->second,
+                             EngineShard::tlocal()->tiered_storage());
   updater_.post_updater.ResyncBaseline();  // the read may have uploaded the value
   return res;
 }
@@ -488,7 +483,8 @@ OpResult<string> RunBitOpNot(const OpArgs& op_args, string_view key) {
   DbSlice& db_slice = op_args.GetDbSlice();
   auto find_res = db_slice.FindReadOnly(op_args.db_cntx, key, OBJ_STRING);
   if (find_res) {
-    return ReadStringValue(op_args.db_cntx.db_index, key, find_res.value()->second, op_args.shard);
+    return ReadStringValue(op_args.db_cntx.db_index, key, find_res.value()->second,
+                           op_args.shard->tiered_storage());
   } else {
     return find_res.status();
   }
@@ -511,7 +507,7 @@ OpResult<string> RunBitOpOnShard(string_view op, const OpArgs& op_args, ShardArg
     auto find_res = db_slice.FindReadOnly(op_args.db_cntx, *start, OBJ_STRING);
     if (find_res) {
       auto value = ReadStringValue(op_args.db_cntx.db_index, *start, find_res.value()->second,
-                                   op_args.shard);
+                                   op_args.shard->tiered_storage());
       if (!value)
         return value.status();
       values.emplace_back(std::move(*value));
@@ -1313,23 +1309,6 @@ void SetBit(facade::CmdArgParser parser, CommandContext* cmd_cntx) {
 
 // ------------------------------------------------------------------------- //
 // This are the "callbacks" that we're using from above
-string GetString(const PrimeValue& pv) {
-  string res;
-  pv.GetString(&res);
-  return res;
-}
-
-OpResult<string> ReadStringValue(DbIndex dbid, string_view key, const PrimeValue& pv,
-                                 EngineShard* shard) {
-  if (!pv.IsExternal())
-    return GetString(pv);
-
-  auto res = ReadTieredString(dbid, key, pv, shard->tiered_storage()).Get();
-  if (!res)
-    return OpStatus::IO_ERROR;
-  return std::move(res).value();
-}
-
 OpResult<bool> ReadValueBitsetAt(const OpArgs& op_args, string_view key, uint32_t offset) {
   DbSlice& db_slice = op_args.GetDbSlice();
   auto it_res = db_slice.FindReadOnly(op_args.db_cntx, key, OBJ_STRING);
@@ -1343,7 +1322,8 @@ OpResult<bool> ReadValueBitsetAt(const OpArgs& op_args, string_view key, uint32_
 
   uint8_t byte_value = 0;
   if (pv.IsExternal()) {
-    auto value = ReadStringValue(op_args.db_cntx.db_index, key, pv, op_args.shard);
+    auto value =
+        ReadStringValue(op_args.db_cntx.db_index, key, pv, op_args.shard->tiered_storage());
     if (!value)
       return value.status();
     if (byte_index >= value->size())
@@ -1364,7 +1344,7 @@ OpResult<string> ReadValue(const DbContext& context, string_view key, EngineShar
     return it_res.status();
   }
 
-  return ReadStringValue(context.db_index, key, it_res.value()->second, shard);
+  return ReadStringValue(context.db_index, key, it_res.value()->second, shard->tiered_storage());
 }
 
 OpResult<std::size_t> CountBitsForValue(const OpArgs& op_args, string_view key, int64_t start,
```

**File**: `src/server/debugcmd.cc` (modified, +5/-13)
```diff
@@ -347,19 +347,11 @@ OpResult<ValueCompressInfo> EstimateCompression(ConnectionContext* cntx, string_
     return info;
   }
 
-  string scratch, materialized;
-  string_view value;
-  if (it->second.IsExternal()) {
-    auto res =
-        ReadTieredString(db_index, key, it->second, EngineShard::tlocal()->tiered_storage()).Get();
-    if (!res) {
-      return OpStatus::IO_ERROR;
-    }
-    materialized = std::move(res).value();
-    value = materialized;
-  } else {
-    value = it->second.GetSlice(&scratch);
-  }
+  string scratch;
+  auto slice =
+      ReadStringSlice(db_index, key, it->second, EngineShard::tlocal()->tiered_storage(), &scratch);
+  RETURN_ON_BAD_STATUS(slice);
+  string_view value = *slice;
 
   info.raw_size = value.size();
   info.compressed_size = info.raw_size;
```

**File**: `src/server/generic_family.cc` (modified, +47/-35)
```diff
@@ -1824,15 +1824,30 @@ OpResult<pair<vector<string>, CompactObjType>> OpFetchContainerElements(const Op
   return std::make_pair(std::move(elements), obj_type);
 }
 
-// Fetch a string value from a key (for BY pattern lookups)
-// TODO: does not support tiering.
-string OpFetchStringValue(const OpArgs& op_args, std::string_view key) {
+// Fetch a string value from a key (for BY and GET pattern lookups)
+OpResult<string> OpFetchStringValue(const OpArgs& op_args, std::string_view key) {
   auto it = op_args.GetDbSlice().FindReadOnly(op_args.db_cntx, key);
   if (!IsValid(it) || it->second.ObjType() != OBJ_STRING) {
-    return {};  // Missing key defaults to empty string
+    return string{};  // Missing key defaults to empty string
   }
 
-  return it->second.ToString();
+  return ReadStringValue(op_args.db_cntx.db_index, key, it->second,
+                         op_args.shard->tiered_storage());
+}
+
+// Runs `cb` on every shard in parallel fibers (it may block) and returns the first non-OK status.
+template <typename F> OpStatus RunOnShards(F&& cb) {
+  vector<OpStatus> statuses(shard_set->size(), OpStatus::OK);
+  shard_set->RunBlockingInParallel(
+      [&](EngineShard* shard) { statuses[shard->shard_id()] = cb(shard); });
+  auto it = rng::find_if(statuses, [](OpStatus s) { return s != OpStatus::OK; });
+  return it == statuses.end() ? OpStatus::OK : *it;
+}
+
+// A failed GET lookup aborts the command; the STORE hop may still be open.
+void ConcludeWithError(CommandContext* cmd_cntx, OpStatus status) {
+  cmd_cntx->tx()->Conclude();
+  cmd_cntx->SendError(status);
 }
 
 template <typename IteratorBegin, typename IteratorEnd>
@@ -1946,11 +1961,11 @@ template <typename C> auto GetSortRange(const C& entries, const optional<SortBou
 //   string_view ResultSetter: Callable that stores fetched value: (size_t elem_idx, size_t
 //   pattern_idx, string value) -> void
 template <typename ElementContainer, typename ElementAccessor, typename ResultSetter>
-void FetchGetPatternValues(const SortParams& params, const DbContext& db_cntx,
-                           const ElementContainer& elements, ElementAccessor get_element_key,
-                           ResultSetter set_result) {
+OpStatus FetchGetPatternValues(const SortParams& params, const DbContext& db_cntx,
+                               const ElementContainer& elements, ElementAccessor get_element_key,
+                               ResultSetter set_result) {
   if (params.get_patterns.empty())
-    return;
+    return OpStatus::OK;
 
   // Build a list of all external keys to fetch, organized by shard
   // Structure: keys_by_shard[shard_id] = [(elem_idx, pattern_idx, ext_key), ...]
@@ -1984,12 +1999,15 @@ void FetchGetPatternValues(const SortParams& params, const DbContext& db_cntx,
   }
 
   // Fetch all external keys in parallel across shards
-  shard_set->RunBlockingInParallel([&](EngineShard* shard) {
+  return RunOnShards([&](EngineShard* shard) {
     ShardId sid = shard->shard_id();
     for (const auto& [elem_idx, pattern_idx, ext_key] : keys_by_shard[sid]) {
-      string value = OpFetchStringValue({shard, nullptr, db_cntx}, ext_key);
-      set_result(elem_idx, pattern_idx, std::move(value));
+      auto value = OpFetchStringValue({shard, nullptr, db_cntx}, ext_key);
+      if (!value)
+        return value.status();
+      set_result(elem_idx, pattern_idx, std::move(*value));
     }
+    return OpStatus::OK;
   });
 }
 
@@ -2008,14 +2026,12 @@ OpStatus PopulateGetPatternValues(const SortParams& params, const DbContext& db_
   }
 
   // Use generic fetcher with lambdas to access ResultKey() and store in entry.get_values
-  FetchGetPatternValues(
+  return FetchGetPatternValues(
       params, db_cntx, *entries,
       [&](size_t idx) -> std::string_view { return (*entries)[idx].ResultKey(); },
       [&](size_t entry_idx, size_t pattern_idx, string value) {
         (*entries)[entry_idx].get_values[pattern_idx] = std::move(value);
       });
-
-  return OpStatus::OK;
 }
 
 // Visitor to handle the actual sorting and reply generation
@@ -2047,7 +2063,9 @@ struct SortVisitor {
     if (!params.get_patterns.empty()) {
       ConnectionContext* cntx = cmd_cntx->server_conn_cntx();
       DbContext db_cntx{cntx->ns, cntx->db_index(), GetCurrentTimeMs()};
-      PopulateGetPatternValues(params, db_cntx, &entries);
+      OpStatus status = PopulateGetPatternValues(params, db_cntx, &entries);
+      if (status != OpStatus::OK)
+        return ConcludeWithError(cmd_cntx, status);
     }
 
     if (!params.store_key) {
@@ -2125,31 +2143,23 @@ OpStatus PopulateSortEntriesFromByPattern(const SortParams& params,
   }
 
   std::visit([&](auto& entries) { entries.resize(raw_elements.size()); }, *sorted_entries);
-  atomic_bool parse_error{false};
-  shard_set->RunBlockingInParallel([&](EngineShard* shard) {
+  return RunOnShards([&](EngineShard* shard) {
     ShardId sid = shard->shard_id();
-    bool success = std::visit(
-        [&](auto& dest) {
+    
```

**File**: `src/server/hll_family.cc` (modified, +6/-17)
```diff
@@ -80,20 +80,6 @@ bool ConvertToDenseIfNeeded(string* hll) {
   return hll_validity == HLL_VALID_DENSE;
 }
 
-// Reads an HLL value, materializing it from tiered storage if offloaded.
-OpResult<string> ReadHll(const OpArgs& op_args, string_view key, const PrimeValue& pv) {
-  if (pv.IsExternal()) {
-    auto res =
-        ReadTieredString(op_args.db_cntx.db_index, key, pv, op_args.shard->tiered_storage()).Get();
-    if (!res)
-      return OpStatus::IO_ERROR;
-    return std::move(res).value();
-  }
-  string hll;
-  pv.GetString(&hll);
-  return hll;
-}
-
 OpResult<int> AddToHll(const OpArgs& op_args, string_view key, CmdArgList values) {
   auto& db_slice = op_args.GetDbSlice();
 
@@ -106,7 +92,8 @@ OpResult<int> AddToHll(const OpArgs& op_args, string_view key, CmdArgList values
     hll.resize(getSparseHllInitSize());
     initSparseHll(StringToHllPtr(hll));
   } else {
-    auto val = ReadHll(op_args, key, res.it->second);
+    auto val = ReadStringValue(op_args.db_cntx.db_index, key, res.it->second,
+                               op_args.shard->tiered_storage());
     res.post_updater.ResyncBaseline();  // the read may have uploaded the value
     RETURN_ON_BAD_STATUS(val);
     hll = std::move(val).value();
@@ -173,7 +160,8 @@ OpResult<int64_t> CountHllsSingle(const OpArgs& op_args, string_view key) {
 
   auto it = db_slice.FindReadOnly(op_args.db_cntx, key, OBJ_STRING);
   if (it.ok()) {
-    auto hll_res = ReadHll(op_args, key, it.value()->second);
+    auto hll_res = ReadStringValue(op_args.db_cntx.db_index, key, it.value()->second,
+                                   op_args.shard->tiered_storage());
     RETURN_ON_BAD_STATUS(hll_res);
     string hll = std::move(hll_res).value();
 
@@ -206,7 +194,8 @@ OpResult<vector<string>> ReadValues(const OpArgs& op_args, const ShardArgs& keys
     for (string_view key : keys) {
       auto it = op_args.GetDbSlice().FindReadOnly(op_args.db_cntx, key, OBJ_STRING);
       if (it.ok()) {
-        auto hll_res = ReadHll(op_args, key, it.value()->second);
+        auto hll_res = ReadStringValue(op_args.db_cntx.db_index, key, it.value()->second,
+                                       op_args.shard->tiered_storage());
         RETURN_ON_BAD_STATUS(hll_res);
         string hll = std::move(hll_res).value();
         if (!ConvertToDenseIfNeeded(&hll)) {
```

**File**: `src/server/json_family.cc` (modified, +4/-12)
```diff
@@ -874,18 +874,10 @@ OpResult<std::string> OpJsonGet(const OpArgs& op_args, string_view key,
   if (it->second.ObjType() == OBJ_JSON) {
     json_ptr = it->second.GetJson();
   } else if (it->second.ObjType() == OBJ_STRING) {
-    string tmp;
-    if (it->second.IsExternal()) {
-      auto res = ReadTieredString(op_args.db_cntx.db_index, key, it->second,
-                                  op_args.shard->tiered_storage())
-                     .Get();
-      if (!res)
-        return OpStatus::IO_ERROR;
-      tmp = std::move(res).value();
-    } else {
-      it->second.GetString(&tmp);
-    }
-    auto parsed_json = ShardJsonFromString(tmp);
+    auto str =
+        ReadStringValue(op_args.db_cntx.db_index, key, it->second, op_args.shard->tiered_storage());
+    RETURN_ON_BAD_STATUS(str);
+    auto parsed_json = ShardJsonFromString(*str);
     if (!parsed_json) {
       return OpStatus::WRONG_TYPE;
     }
```

**File**: `src/server/string_family.cc` (modified, +12/-35)
```diff
@@ -286,14 +286,11 @@ OpResult<bool> ExtendOrSkip(const OpArgs& op_args, string_view key, string_view
 
   auto& res = *it_res;
   if (res.it->second.IsExternal()) {
-    auto tier = ReadTieredString(op_args.db_cntx.db_index, key, res.it->second,
-                                 op_args.shard->tiered_storage())
-                    .Get();
+    auto slice = ReadStringValue(op_args.db_cntx.db_index, key, res.it->second,
+                                 op_args.shard->tiered_storage());
     res.post_updater.ResyncBaseline();  // the read may have uploaded the value
-    if (!tier)
-      return OpStatus::IO_ERROR;
-    string slice = std::move(tier).value();
-    string new_val = prepend ? absl::StrCat(val, slice) : absl::StrCat(slice, val);
+    RETURN_ON_BAD_STATUS(slice);
+    string new_val = prepend ? absl::StrCat(val, *slice) : absl::StrCat(*slice, val);
     res.post_updater.ReduceHeapUsage();
     if (res.it->second.IsExternal()) {
       op_args.shard->tiered_storage()->Delete(op_args.db_cntx.db_index, key, &res.it->second);
@@ -327,19 +324,12 @@ OpResult<double> OpIncrFloat(const OpArgs& op_args, string_view key, double val)
 
   const bool was_external = add_res.it->second.IsExternal();
   string tmp;
-  string_view slice;
-  if (was_external) {
-    auto res = ReadTieredString(op_args.db_cntx.db_index, key, add_res.it->second,
-                                op_args.shard->tiered_storage())
-                   .Get();
+  auto cur = ReadStringSlice(op_args.db_cntx.db_index, key, add_res.it->second,
+                             op_args.shard->tiered_storage(), &tmp);
+  if (was_external)
     add_res.post_updater.ResyncBaseline();  // the read may have uploaded the value
-    if (!res)
-      return OpStatus::IO_ERROR;
-    tmp = std::move(res).value();
-    slice = tmp;
-  } else {
-    slice = add_res.it->second.GetSlice(&tmp);
-  }
+  RETURN_ON_BAD_STATUS(cur);
+  string_view slice = *cur;
 
   double base = 0;
   if (!ParseDouble(slice, &base)) {
@@ -1352,24 +1342,11 @@ void CmdDigest(CmdArgParser parser, CommandContext* cmd_cntx) {
       return it_res.status();
     }
 
-    // Read string value (handles tiered storage if needed)
-    StringResult str_result = ReadString(tx->GetDbIndex(), key, (*it_res)->second, es);
-
-    // Handle both immediate value and tiered storage future
-    string value;
-    if (holds_alternative<string>(str_result)) {
-      value = std::move(get<string>(str_result));
-    } else {
-      auto& future = get<TieredStorage::TResult<string>>(str_result);
-      io::Result<string> io_res = future.Get();
-      if (!io_res) {
-        return OpStatus::IO_ERROR;
-      }
-      value = std::move(*io_res);
-    }
+    auto value = ReadStringValue(tx->GetDbIndex(), key, (*it_res)->second, es->tiered_storage());
+    RETURN_ON_BAD_STATUS(value);
 
     // Compute XXH3 hash and return as 16-char hex string
-    return XXH3_Digest(value);
+    return XXH3_Digest(*value);
   };
 
   OpResult<string> result = cmd_cntx->tx()->ScheduleSingleHopT(cb);
```

**File**: `src/server/tiered_storage.h` (modified, +28/-0)
```diff
@@ -12,6 +12,7 @@
 
 #include "core/dash_internal.h"
 #include "core/tiering_types.h"
+#include "facade/op_status.h"
 #include "io/io.h"  // for io::Result (TODO: replace with nonstd/expected)
 #include "server/stats.h"
 #include "server/table.h"
@@ -418,4 +419,31 @@ inline bool StashListNode(DbIndex dbid, QList* ql, QList::Node* node, TieredStor
 
 #endif  // WITH_TIERING
 
+// Materializes a string value, reading it back from tiered storage if it was offloaded: the
+// CompactObj accessors CHECK(!IsExternal()). Blocks the calling fiber while the read is in flight.
+inline facade::OpResult<std::string> ReadStringValue(DbIndex dbid, std::string_view key,
+                                                     const PrimeValue& pv, TieredStorage* ts) {
+  if (!pv.IsExternal())
+    return pv.ToString();
+
+  auto res = ReadTieredString(dbid, key, pv, ts).Get();
+  if (!res)
+    return facade::OpStatus::IO_ERROR;
+  return std::move(res).value();
+}
+
+// Like ReadStringValue, but borrows an in-memory value; `scratch` backs the view otherwise.
+inline facade::OpResult<std::string_view> ReadStringSlice(DbIndex dbid, std::string_view key,
+                                                          const PrimeValue& pv, TieredStorage* ts,
+                                                          std::string* scratch) {
+  if (!pv.IsExternal())
+    return pv.GetSlice(scratch);
+
+  auto res = ReadStringValue(dbid, key, pv, ts);
+  if (!res)
+    return res.status();
+  *scratch = std::move(*res);
+  return std::string_view{*scratch};
+}
+
 }  // namespace dfly
```

**File**: `src/server/tiered_storage_test.cc` (modified, +64/-1)
```diff
@@ -83,7 +83,32 @@ class TieredStorageTest : public BaseFamilyTest {
   }
 
   void UpdateFromFlags() {
-    pp_->at(0)->AwaitBrief([] { EngineShard::tlocal()->tiered_storage()->UpdateFromFlags(); });
+    shard_set->RunBriefInParallel(
+        [](EngineShard* shard) { shard->tiered_storage()->UpdateFromFlags(); });
+  }
+
+  // src=[1,2] with offloaded BY weights (w_2 < w_1) and GET targets; uploads are disabled so every
+  // later lookup reads from disk. Returns the GET values.
+  pair<string, string> OffloadSortOperands() {
+    SetFlag(&FLAGS_tiered_upload_threshold, 1.0f);
+    UpdateFromFlags();
+    // The budget turns negative once the heartbeat's CacheStats() has run on every shard.
+    ExpectConditionWithinTimeout([] {
+      vector<int64_t> budgets(shard_set->size());
+      shard_set->RunBriefInParallel([&](EngineShard* shard) {
+        budgets[shard->shard_id()] = shard->tiered_storage()->UploadBudget();
+      });
+      return *std::ranges::max_element(budgets) < 0;
+    });
+
+    string o1 = BuildString(3000, 'a'), o2 = BuildString(3000, 'b');
+    Run({"RPUSH", "src", "1", "2"});
+    Run({"SET", "w_1", absl::StrCat("2.5", string(2997, '0'))});
+    Run({"SET", "w_2", absl::StrCat("1.5", string(2997, '0'))});
+    Run({"SET", "o_1", o1});
+    Run({"SET", "o_2", o2});
+    ExpectConditionWithinTimeout([&] { return GetMetrics().db_stats[0].tiered_entries == 4; });
+    return {o1, o2};
   }
 
   // A single huge PFADD stays sparse and too small to offload; batch to force dense.
@@ -652,6 +677,44 @@ TEST_F(PureDiskTSTest, SortStoreOverOffloadedDestination) {
   EXPECT_EQ(GetMetrics().db_stats[0].tiered_entries, 0u);
 }
 
+// BY weights and GET targets are read through OpFetchStringValue, which must materialize offloaded
+// strings instead of tripping CHECK(!IsExternal()).
+TEST_F(PureDiskTSTest, SortByGetOffloaded) {
+  auto [o1, o2] = OffloadSortOperands();
+
+  EXPECT_THAT(Run({"SORT", "src", "BY", "w_*"}), RespElementsAre("2", "1"));
+  EXPECT_THAT(Run({"SORT_RO", "src", "BY", "w_*", "GET", "o_*"}), RespElementsAre(o2, o1));
+  EXPECT_THAT(Run({"SORT", "src", "BY", "nosort", "GET", "#", "GET", "o_*"}),
+              RespElementsAre("1", o1, "2", o2));
+  EXPECT_THAT(Run({"SORT", "src", "ALPHA", "GET", "o_1"}), RespElementsAre(o1, o1));
+  EXPECT_THAT(Run({"SORT", "src", "BY", "w_*", "DESC", "GET", "o_*", "STORE", "dst"}), IntArg(2));
+  EXPECT_THAT(Run({"LRANGE", "dst", "0", "-1"}), RespElementsAre(o1, o2));
+  EXPECT_THAT(Run({"SORT", "src", "BY", "nosort", "GET", "o_*", "STORE", "dst"}), IntArg(2));
+  EXPECT_THAT(Run({"LRANGE", "dst", "0", "-1"}), RespElementsAre(o1, o2));
+
+  // The weight is parsed only after it was read back.
+  Run({"SET", "w_1", BuildString(3000, 'x')});
+  ExpectConditionWithinTimeout([&] { return GetMetrics().db_stats[0].tiered_entries == 4; });
+  EXPECT_THAT(Run({"SORT", "src", "BY", "w_*"}), ErrArg("can't be converted into double"));
+
+  EXPECT_EQ(GetMetrics().db_stats[0].tiered_entries, 4u);  // nothing was uploaded
+}
+
+// The lookups block inside RunBlockingInParallel fibers while the operands live on other shards;
+// a pipeline (the single-key SORTs are squashed, the two-key STORE runs standalone) must neither
+// hang nor crash.
+TEST_F(PureDiskTSMTTest, SortByGetOffloadedSquashed) {
+  auto [o1, o2] = OffloadSortOperands();
+
+  RunMany({{"SORT", "src", "BY", "w_*", "GET", "o_*"},
+           {"SORT_RO", "src", "BY", "w_*"},
+           {"SORT", "src", "BY", "nosort", "GET", "o_*", "STORE", "dst"}});
+
+  EXPECT_TRUE(GetMetrics().facade_stats.reply_stats.err_count.empty());  // RunMany drops replies
+  EXPECT_THAT(Run({"LRANGE", "dst", "0", "-1"}), RespElementsAre(o1, o2));
+  EXPECT_EQ(GetMetrics().db_stats[0].tiered_entries, 4u);
+}
+
 // The remaining in-place overwrite paths reach the value through DbSlice::AddOrFind and retype it,
 // which drops the external reference silently: CompactObj::HasAllocated() is false for an external
 // value, so Init*()/Reset() free nothing.
```

---

### Incident Patch 12: `f47d73d8` (2026-10-01)
**Commit Message**: chore(build): link helio/build-dbg to the build dir for clangd (#8438)

* chore(build): link helio/build-dbg to the build dir for clangd

helio/.clangd looks for compile_commands.json in helio/build-dbg/, which does not exist when
helio is built as a Dragonfly submodule. When CMAKE_EXPORT_COMPILE_COMMANDS is on, create a
helio/build-dbg symlink pointing at the Dragonfly build directory so clangd resolves helio
sources. An existing non-symlink path is left untouched; a stale symlink is replaced.
helio/.gitignore already ignores build-*, so the submodule stays clean.

Signed-off-by: Roman Gershman <[REDACTED_EMAIL]>

* chore(build): link only compile_commands.json into helio/build-dbg

Linking the whole helio/build-dbg directory to the Dragonfly build dir made helio's own
blaze.sh reuse Dragonfly's CMake cache. Keep helio/build-dbg a real directory and symlink
just compile_commands.json into it, which is all helio/.clangd needs. Skip it when the
directory already holds a standalone helio build, and replace a directory link left by the
previous version.

Signed-off-by: Roman Gershman <[REDACTED_EMAIL]>

* Revert "chore(build): link only compile_commands.json into helio/build-dbg"

Bui

**File**: `CMakeLists.txt` (modified, +19/-0)
```diff
@@ -155,5 +155,24 @@ endif()
 include_directories(src)
 include_directories(helio)
 
+if(CMAKE_EXPORT_COMPILE_COMMANDS)
+  set(_helio_clangd_build_dir "${CMAKE_CURRENT_SOURCE_DIR}/helio/build-dbg")
+  file(RELATIVE_PATH _dragonfly_build_dir "${CMAKE_CURRENT_SOURCE_DIR}/helio" "${CMAKE_BINARY_DIR}")
+
+  if(IS_SYMLINK "${_helio_clangd_build_dir}")
+    file(READ_SYMLINK "${_helio_clangd_build_dir}" _existing_build_dir)
+    if(NOT _existing_build_dir STREQUAL _dragonfly_build_dir)
+      file(REMOVE "${_helio_clangd_build_dir}")
+    endif()
+  elseif(EXISTS "${_helio_clangd_build_dir}")
+    message(WARNING "Not creating ${_helio_clangd_build_dir}: path already exists and is not a symlink")
+  endif()
+
+  if(NOT EXISTS "${_helio_clangd_build_dir}" AND NOT IS_SYMLINK "${_helio_clangd_build_dir}")
+    # helio/.clangd resolves its compilation database relative to the Helio source directory.
+    file(CREATE_LINK "${_dragonfly_build_dir}" "${_helio_clangd_build_dir}" SYMBOLIC)
+  endif()
+endif()
+
 add_subdirectory(helio)
 add_subdirectory(src)
```

---

### Incident Patch 13: `2c564594` (2026-10-01)
**Commit Message**: fix(server): zero-pad the microseconds in MONITOR timestamps (#8437)

CreateMonitorTimestamp() passed absl::kZeroPad6 to StrCat as a plain argument, so the PadSpec
enum was printed as a literal 6 and the microseconds were never padded: the fraction had 2-7
digits, values below 100000 us came out 10x too large and stamps within one second went backwards.
Format the microseconds with absl::Dec(tv.tv_usec, absl::kZeroPad6).

Test: DflyEngineTest.MonitorTimestamp checks six fraction digits and that every stamp lies inside
the command's wall-clock window.

**File**: `src/server/dragonfly_test.cc` (modified, +33/-0)
```diff
@@ -11,6 +11,7 @@ extern "C" {
 #include <absl/strings/ascii.h>
 #include <absl/strings/str_join.h>
 #include <absl/strings/strip.h>
+#include <absl/time/clock.h>
 #include <gmock/gmock.h>
 #include <reflex/matcher.h>
 
@@ -714,6 +715,38 @@ TEST_F(DflyEngineTest, MonitorSubscriptionsAccounting) {
   EXPECT_EQ(0u, NumSubscriptions("IO0"));
 }
 
+// MONITOR stamps every line with "<seconds>.<microseconds>", exactly six fraction digits.
+TEST_F(DflyEngineTest, MonitorTimestamp) {
+  EXPECT_EQ(Run({"monitor"}), "OK");
+
+  constexpr int kCommands = 20;
+  vector<pair<int64_t, int64_t>> windows;  // unix microseconds before and after each command
+  for (int i = 0; i < kCommands; ++i) {
+    int64_t before = absl::ToUnixMicros(absl::Now());
+    Run("cl", {"SET", "k", absl::StrCat(i)});
+    windows.emplace_back(before, absl::ToUnixMicros(absl::Now()));
+  }
+
+  auto messages = pp_->at(0)->Await([&] { return GetConnection("IO0")->monitor_messages; });
+  ASSERT_EQ(messages.size(), size_t(kCommands));
+  for (int i = 0; i < kCommands; ++i) {
+    const string& msg = messages[i];
+    EXPECT_THAT(msg, HasSubstr(absl::StrCat("\"SET\" \"k\" \"", i, "\"")));
+
+    string_view timestamp = string_view(msg).substr(0, msg.find(' '));
+    size_t dot = timestamp.find('.');
+    ASSERT_NE(dot, string_view::npos) << msg;
+    EXPECT_EQ(timestamp.size() - dot - 1, 6u) << msg;
+
+    int64_t sec = 0, usec = 0;
+    ASSERT_TRUE(absl::SimpleAtoi(timestamp.substr(0, dot), &sec)) << msg;
+    ASSERT_TRUE(absl::SimpleAtoi(timestamp.substr(dot + 1), &usec)) << msg;
+    int64_t stamp = sec * 1'000'000 + usec;
+    EXPECT_LE(windows[i].first, stamp) << msg;
+    EXPECT_LE(stamp, windows[i].second) << msg;
+  }
+}
+
 TEST_F(DflyEngineTest, Bug468) {
   RespExpr resp = Run({"multi"});
   ASSERT_EQ(resp, "OK");
```

**File**: `src/server/main_service.cc` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ std::string CreateMonitorTimestamp() {
   timeval tv;
 
   gettimeofday(&tv, nullptr);
-  return absl::StrCat(tv.tv_sec, ".", tv.tv_usec, absl::kZeroPad6);
+  return absl::StrCat(tv.tv_sec, ".", absl::Dec(tv.tv_usec, absl::kZeroPad6));
 }
 
 auto CmdEntryToMonitorFormat(std::string_view str) -> std::string {
```

---

### Incident Patch 14: `5dca05e1` (2026-10-01)
**Commit Message**: fix(facade): reply after V2 pipeline squash (#8431)

Break after a successful pipeline squash so the caller can process
completed replies. This lets bounded-pipeline clients replenish requests
without stalling the client or connection fiber while commands remain ready.

Benchmarks show better throughput and less connection-fiber idle time
for both default V2 and the provided-buffer POC receive paths. Returning
replies after each squash lets bounded client pipelines replenish requests
sooner, preventing multiple squash rounds before reply handling.

Signed-off-by: Gil Levkovich <[REDACTED_EMAIL]>

**File**: `src/facade/dragonfly_connection.cc` (modified, +10/-9)
```diff
@@ -1834,7 +1834,7 @@ auto Connection::ParseLoop() -> ParserStatus {
 
     // Execute/reply the commands parsed so far first, so a trailing protocol error still flushes
     // earlier replies in order before we report it.
-    ExecuteBatchResult execute_result = ExecuteBatch();
+    ExecuteBatchResult execute_result = ExecuteBatch(/*parser_error=*/parse_status == ERROR);
     if (execute_result == ExecuteBatchResult::kFailure)
       return ERROR;
 
@@ -3189,7 +3189,7 @@ bool Connection::SquashPipelineV2() {
   return true;
 }
 
-Connection::ExecuteBatchResult Connection::ExecuteBatch() {
+Connection::ExecuteBatchResult Connection::ExecuteBatch(bool parser_error) {
   // Invariant: batched_ must be false on entry.
   // Both ReplyBatch() and ExecuteBatch() reset it via absl::Cleanup guards on all return paths.
   DCHECK(!reply_builder_->IsBatchMode());
@@ -3248,12 +3248,13 @@ Connection::ExecuteBatchResult Connection::ExecuteBatch() {
                << pending_input_ << " " << GetUnreadInputLen();
 
       if (SquashPipelineV2()) {
-        // - This helps with throughput. Explanation:
-        //   when we suspend the thread calls io-callbacks that fill up the input buffer.
-        //   By breaking now we give the io-loop a chance to add more commands to the pipeline.
-        // - Skip the break when parse-in-proactor is on: the proactor already parsed those bytes
-        //   into the queue during the squash wait, so keep squashing in place instead.
-        if (!pipeline_parse_in_proactor_cached && (pending_input_ || GetUnreadInputLen() > 0))
+        // - Normally: return after a successful squash so the caller can process replies. A client
+        // with a bounded pipeline needs completed replies to replenish requests - delaying them can
+        // stall both it and this connection fiber.
+        // - Continue instead when parsing found an error (on conenction fiber or
+        // parse-in-proactor), so commands parsed before the bad input can execute before the
+        // connection closes.
+        if (!parser_error && !proactor_parse_error_)
           break;
         continue;
       }
@@ -4143,7 +4144,7 @@ void Connection::DrainQueuedCommands() {
 
   if (parsed_head_) {
     if (HasCommandToExecute()) {
-      ExecuteBatchResult execute_result = ExecuteBatch();
+      ExecuteBatchResult execute_result = ExecuteBatch(/*parser_error*/ false);
       if (execute_result == ExecuteBatchResult::kFailure)
         return;  // IoLoopV2 observes the reply-builder error.
       if (execute_result == ExecuteBatchResult::kDeferToControlPath)
```

**File**: `src/facade/dragonfly_connection.h` (modified, +1/-1)
```diff
@@ -603,7 +603,7 @@ class Connection : public util::Connection {
   // Returns kDeferToControlPath only when V2 stops to let IoLoopV2 drain control messages that
   // precede the next parsed command.
   enum class ExecuteBatchResult : uint8_t { kSuccess, kFailure, kDeferToControlPath };
-  ExecuteBatchResult ExecuteBatch();
+  ExecuteBatchResult ExecuteBatch(bool parser_error);
 
   // V2: Returns true if the connection is currently logging traffic to a file.
   bool ShouldLogTrafficV2() const;
```

---

### Incident Patch 15: `3ec82116` (2026-10-01)
**Commit Message**: fix(acl): accept 3-token user rules in aclfile parser (#8299) (#8399)

Signed-off-by: Tyagiquamar <[REDACTED_EMAIL]>

**File**: `src/server/acl/acl_family.cc` (modified, +1/-1)
```diff
@@ -746,7 +746,7 @@ MaterializedContents MaterializeFileContents(std::vector<std::string>* usernames
     if (command.empty())
       continue;
     std::vector<std::string_view> cmds = absl::StrSplit(command, ' ', absl::SkipEmpty());
-    if (!absl::EqualsIgnoreCase(cmds[0], "USER") || cmds.size() < 4) {
+    if (!absl::EqualsIgnoreCase(cmds[0], "USER") || cmds.size() < 3) {
       return {};
     }
 
```

**File**: `src/server/acl/acl_family_test.cc` (modified, +21/-0)
```diff
@@ -8,17 +8,21 @@
 #include <absl/strings/ascii.h>
 #include <absl/strings/str_cat.h>
 
+#include <filesystem>
+
 #include "base/flags.h"
 #include "base/gtest.h"
 #include "base/logging.h"
 #include "facade/facade_test.h"
+#include "io/file_util.h"
 #include "server/acl/acl_commands_def.h"
 #include "server/command_registry.h"
 #include "server/test_utils.h"
 
 using namespace testing;
 
 ABSL_DECLARE_FLAG(std::vector<std::string>, command_alias);
+ABSL_DECLARE_FLAG(std::string, aclfile);
 ABSL_DECLARE_FLAG(std::string, requirepass);
 
 namespace dfly {
@@ -911,4 +915,21 @@ TEST_F(AclFamilyTest, AclInfoMetrics) {
   EXPECT_GT(stats.TotalBytes(), 0u);
 }
 
+TEST_F(AclFamilyTest, AclLoadMinimalUserRule) {
+  TestInitAclFam();
+  std::string path = (std::filesystem::temp_directory_path() / "dfly_minimal_rule.acl").string();
+  io::WriteStringToFileOrDie("user default off\nuser worker on nopass ~* &* +@all\n", path);
+
+  absl::SetFlag(&FLAGS_aclfile, path);
+  auto resp = Run("ACL LOAD");
+  EXPECT_THAT(resp, "OK");
+
+  resp = Run("ACL LIST");
+  auto vec = resp.GetVec();
+  EXPECT_THAT(vec, UnorderedElementsAre("user default off resetchannels -@all $all",
+                                        "user worker on nopass ~* &* +@all $all"));
+
+  std::filesystem::remove(path);
+}
+
 }  // namespace dfly
```

#### Recent Merged Pull Requests:
- **PR #8473** (2026-10-05): fix: SlotMigrationStreamer::Cancel() waits for Run finish (@BorysTheDev)
- **PR #8469** (2026-10-05): Report anonymous deployment info with the version check (@romange)
- **PR #8467** (2026-10-04): fuzz: pair a crash with its RECORD set by content, not by number (@vyavdoshenko)
- **PR #8466** (2026-10-05): fix: HSNW index restoration crash (@BorysTheDev)
- **PR #8465** (2026-10-03): refactor: complete remove RedisParser (@BorysTheDev)
- **PR #8461** (2026-10-03): Replace double-conversion with dragonbox for double formatting (@romange)
- **PR #8460** (2026-10-03): Update compatible external dependencies (@romange)
- **PR #8459** (2026-10-02): fix(server): clear rdb_bgsave_in_progress when BGSAVE finishes (@vyavdoshenko)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
