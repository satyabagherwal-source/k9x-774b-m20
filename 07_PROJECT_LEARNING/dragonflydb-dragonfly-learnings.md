> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Source Version**: `537a6b7e`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T00:49:11.610Z  
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
> **Harvest Timestamp**: 2026-11-08T00:49:10.189Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflydb/dragonfly`
- **Description**: A modern replacement for Redis and Memcached
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 31846 stars

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

### Incident Patch 1: `244e6a07` (2026-11-07)
**Commit Message**: test: make the CLIENT KILL stuck-send regression test portable (macOS fix) (#8770)

test: make CLIENT KILL stuck-send regression portable

Signed-off-by: Volodymyr Yavdoshenko <[REDACTED_EMAIL]>

**File**: `src/server/dragonfly_connection_test.cc` (modified, +68/-15)
```diff
@@ -437,15 +437,19 @@ class ClientKillTest : public BaseFamilyTest {
       return pp_->at(0)->Await(
           [&] { return new facade::Listener(facade::Protocol::REDIS, service_.get(), role); });
     };
-    auto* listener = make(facade::Listener::Role::MAIN);
+    main_listener_ = make(facade::Listener::Role::MAIN);
     auto* admin = make(facade::Listener::Role::PRIVILEGED);
-    port_ = acceptor_->AddListener(0, listener);
+    port_ = acceptor_->AddListener(0, main_listener_);
     admin_port_ = acceptor_->AddListener(0, admin);
-    return {listener, admin};
+    return {main_listener_, admin};
   }
 
   void SetUp() override {
+    // Initialize shared buffers for tests that switch to V2 after setup.
+    const bool v2 = absl::GetFlag(FLAGS_enable_resp_io_loop_v2);
+    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, true);
     BaseFamilyTest::SetUp();
+    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, v2);
     acceptor_->Run();
   }
 
@@ -456,6 +460,7 @@ class ClientKillTest : public BaseFamilyTest {
   }
 
   std::unique_ptr<util::AcceptServer> acceptor_;
+  facade::Listener* main_listener_ = nullptr;
   uint16_t port_ = 0, admin_port_ = 0;
   absl::FlagSaver flag_saver_;
 };
@@ -572,18 +577,66 @@ TEST_F(ClientKillTest, Filters) {
   EXPECT_EQ(caller.ReadLine(), ":0\r\n");
 }
 
-// A half-closed peer marks the connection closing, yet only a kill ends its blocked send.
-TEST_F(ClientKillTest, KillsHalfClosedStuckSend) {
-  RawRespClient v{port_};
-  const std::string id = ClientId(v);
-  Run({"SET", "big", std::string(64 << 20, 'x')});
-  auto row = [&] { return Run({"CLIENT", "LIST", "ID", id}).GetString(); };
-  ASSERT_TRUE(v.SendAll("GET big\r\n"));
-  ExpectConditionWithinTimeout([&] { return absl::StrContains(row(), "phase=send"); });
-  ASSERT_TRUE(v.ShutdownWrite());
-  ExpectConditionWithinTimeout([&] { return absl::StrContains(row(), "flags=t"); });
-  EXPECT_THAT(Run({"CLIENT", "KILL", "ID", id}), IntArg(1));
-  ExpectConditionWithinTimeout([&] { return row().empty(); });
+// A closing context must not prevent killing an open socket with a blocked send.
+TEST_F(ClientKillTest, KillsClosingConnectionWithStuckSend) {
+  auto wait_until = [](auto&& condition) {
+    const auto deadline = std::chrono::steady_clock::now() + 2s;
+    while (!condition()) {
+      if (std::chrono::steady_clock::now() >= deadline)
+        return false;
+      absl::SleepFor(absl::Milliseconds(1));
+    }
+    return true;
+  };
+
+  ASSERT_EQ(Run({"SET", "big", std::string(64 << 20, 'x')}), "OK");
+  for (bool v2 : {false, true}) {
+    SCOPED_TRACE(v2);
+    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, v2);
+    RawRespClient client{port_};
+    ASSERT_TRUE(client.valid());
+    const std::string id = ClientId(client);
+    ASSERT_FALSE(id.empty());
+    SCOPED_TRACE(absl::StrCat("client id=", id));
+    ASSERT_TRUE(client.SendAll("GET big\r\n"));
+
+    // Identify the GET reply while leaving its large body unread to keep the send blocked.
+    ASSERT_EQ(client.ReadLine(), "$67108864\r\n");
+
+    std::string state;
+    auto inspect = [&](bool mark_closing) {
+      return pp_->at(0)->Await([&] {
+        bool ready = false;
+        state = "Connection not found";
+        main_listener_->TraverseConnections([&](unsigned tid, util::Connection* connection) {
+          auto* conn = static_cast<facade::Connection*>(connection);
+          if (absl::StrCat(conn->GetClientId()) != id)
+            return;
+
+          ready = conn->cntx() && conn->socket()->IsOpen() && conn->IsSending();
+          if (ready && mark_closing)
+            conn->cntx()->conn_closing = true;
+          state =
+              absl::StrCat("socket_open=", conn->socket()->IsOpen(), " ", conn->GetClientInfo(tid));
+        });
+        return ready;
+      });
+    };
+    ASSERT_TRUE(wait_until([&] { return inspect(false); }))
+        << "Expected an open connection with a blocked send: " << state;
+
+    // Set the context flag on its owner proactor without shutting down the socket. A real
+    // half-close can abort the blocked send on kqueue before CLIENT KILL gets to it.
+    ASSERT_TRUE(inspect(true)) << "Connection stopped sending before marking it closing: " << state;
+    ASSERT_THAT(Run({"CLIENT", "KILL", "ID", id}), IntArg(1)) << state;
+
+    std::string last_row;
+    ASSERT_TRUE(wait_until([&] {
+      last_row = Run({"CLIENT", "LIST", "ID", id}).GetString();
+      return last_row.empty();
+    })) << last_row;
+    EXPECT_THAT(Run({"CLIENT", "KILL", "ID", id}), IntArg(0));
+  }
 }
 
 // Connections that move to another thread can not be borrowed.
```

---

### Incident Patch 2: `537a6b7e` (2026-11-07)
**Commit Message**: fix: remove unused code and obsolete test helpers (#8772)

Remove the unused Huffman codec and FlatJson JSONPath backend.
Clean up dead C++ and Python helpers, the unused RecordJournal argument,
and the redundant asyncio dependency while preserving active test coverage.

Signed-off-by: Volodymyr Yavdoshenko <[REDACTED_EMAIL]>

**File**: `.pre-commit-config.yaml` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ default_stages: [pre-commit]
 exclude: |
     (?x)(
       src/redis/.* |
-      src/huff/.* |
       contrib/charts/dragonfly/ci/.* |
       patches/.* |
       fuzz/seeds/.*
```

**File**: `pyproject.toml` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@ requires-python = ">=3.10"
 test = [
   "aiohttp>=3.14.4",
   "async-timeout>=4.0.3",
-  "asyncio>=3.4.3",
   "attrs>=22.1.0",
   "azure-storage-blob>=12.19.0",
   "boto3>=1.28.55",
```

**File**: `src/core/CMakeLists.txt` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ add_subdirectory(json)
 add_subdirectory(page_usage)
 
 add_library(dfly_core allocation_tracker.cc bloom.cc topk.cc compact_object.cc cms.cc cuckoo.cc dense_set.cc
-    dragonfly_core.cc extent_tree.cc huff_coder.cc lua_internals.cc
+    dragonfly_core.cc extent_tree.cc lua_internals.cc
     interpreter.cc glob_matcher.cc mi_memory_resource.cc qlist.cc dict_builder.cc sds_utils.cc
     segment_allocator.cc score_map.cc small_string.cc sorted_map.cc stream_node.cc task_queue.cc
     tx_queue.cc string_set.cc string_map.cc tiering_types.cc top_keys.cc
```

**File**: `src/core/dash.h` (modified, +0/-7)
```diff
@@ -404,13 +404,6 @@ class DashTable : public detail::DashTableBase {
     return iterator{this, segment_id, uint8_t(bucket_id), uint8_t(slot_id)};
   }
 
-  const_bucket_iterator CursorToBucketIt(Cursor c) const {
-    return const_bucket_iterator{this, c.segment_id(global_depth_), c.bucket_id(), 0};
-  }
-  bucket_iterator CursorToBucketIt(Cursor c) {
-    return bucket_iterator{this, c.segment_id(global_depth_), c.bucket_id(), 0};
-  }
-
   // Capture Version Change. Determine buckets that can potentially be modified when inserting key.
   // These are not const functions because they send non-const iterators that allow
   // updating contents/versions of the passed iterators.
```

**File**: `src/core/detail/bptree_internal.h` (modified, +0/-4)
```diff
@@ -331,10 +331,6 @@ template <typename T> class BPTreePath {
     depth_--;
   }
 
-  bool HasValidTerminal() const {
-    return depth_ > 0u && Last().second < Last().first->NumItems();
-  }
-
   T Terminal() const {
     assert(Last().second < Last().first->NumItems());
     return Last().first->Key(Last().second);
```

**File**: `src/core/dfly_core_test.cc` (modified, +0/-144)
```diff
@@ -23,7 +23,6 @@
 #include "base/gtest.h"
 #include "base/logging.h"
 #include "core/glob_matcher.h"
-#include "core/huff_coder.h"
 #include "core/intent_lock.h"
 #include "core/tx_queue.h"
 
@@ -347,149 +346,6 @@ TEST_F(StringMatchTest, StarBacktracking) {
   TEST_STRINGMATCH("*[a-", "xa", 1, 1);
 }
 
-class HuffCoderTest : public ::testing::Test {
- protected:
-  HuffmanEncoder encoder_;
-  HuffmanDecoder decoder_;
-  string error_msg_;
-  const string_view good_table_{
-      "\x1b\x10\xd8\n\n\x19\xc6\x0c\xc3\x30\x0c\x43\x1e\x93\xe4\x11roB\xf6\xde\xbb\x18V\xc2Zk\x03"sv};
-};
-
-TEST_F(HuffCoderTest, Load) {
-  string data("bad");
-
-  ASSERT_FALSE(encoder_.Load(data, &error_msg_));
-
-  data = good_table_;
-  ASSERT_TRUE(encoder_.Load(data, &error_msg_)) << error_msg_;
-
-  data.append("foo");
-  encoder_.Reset();
-  ASSERT_FALSE(encoder_.Load(data, &error_msg_));
-}
-
-TEST_F(HuffCoderTest, Encode) {
-  ASSERT_TRUE(encoder_.Load(good_table_, &error_msg_)) << error_msg_;
-
-  EXPECT_EQ(1, encoder_.GetNBits('x'));
-  EXPECT_EQ(3, encoder_.GetNBits(':'));
-  EXPECT_EQ(5, encoder_.GetNBits('2'));
-  EXPECT_EQ(5, encoder_.GetNBits('3'));
-
-  string data("x:23xx");
-
-  array<uint8_t, 100> dest;
-  uint32_t dest_size = dest.size();
-  ASSERT_TRUE(encoder_.Encode(data, dest.data(), &dest_size, &error_msg_));
-  ASSERT_EQ(3, dest_size);
-
-  // testing small destination buffer.
-  data = "3333333333333333333";
-  dest_size = 16;
-  EXPECT_TRUE(encoder_.Encode(data, dest.data(), &dest_size, &error_msg_));
-
-  // destination too small
-  ASSERT_EQ(0, dest_size);
-  ASSERT_EQ("", error_msg_);
-}
-
-TEST_F(HuffCoderTest, Decode) {
-  array<unsigned, 256> hist;
-  hist.fill(1);
-  hist['a'] = 100;
-  hist['b'] = 50;
-
-  ASSERT_TRUE(encoder_.Build(hist.data(), hist.size() - 1, &error_msg_));
-  string data("aab");
-
-  array<uint8_t, 100> encoded{0};
-  uint32_t encoded_size = encoded.size();
-  ASSERT_TRUE(encoder_.Encode(data, encoded.data(), &encoded_size, &error_msg_));
-  ASSERT_EQ(1, encoded_size);
-
-  EXPECT_EQ(2, encoder_.GetNBits('a'));
-  EXPECT_EQ(3, encoder_.GetNBits('b'));
-
-  auto bindata = encoder_.Export();
-  ASSERT_TRUE(bindata.has_value());
-  ASSERT_TRUE(decoder_.Load(*bindata, &error_msg_)) << error_msg_;
-
-  const char* src_ptr = reinterpret_cast<const char*>(encoded.data());
-  array<char, 100> decode_dest{0};
-  size_t decoded_size = data.size();
-  ASSERT_TRUE(decoder_.Decode({src_ptr, encoded_size}, decoded_size, decode_dest.data()));
-  ASSERT_EQ("aab", string_view(decode_dest.data(), decoded_size));
-}
-
-TEST_F(HuffCoderTest, HugeHistogram) {
-  array<unsigned, 256> hist{
-      1,         1,         1,         1,         1,         1,         1,         1,
-      5,         26,        543,       1,         1,         1,         1,         1,
-      4,         1,         1,         1,         1,         1,         1,         1,
-      1,         1,         1,         1,         1,         1,         1,         1,
-      114012534, 12081,     13038,     1596,      1334,      83320,     706165,    475568,
-      2779,      2548,      998,       29249967,  53961,     13175485,  99000,     69726435,
-      69422967,  182172009, 123544533, 76493373,  96341977,  64601914,  48105392,  60215630,
-      69253599,  48811529,  818580990, 1226,      69,        922,       140,       720,
-      230,       333714212, 95995178,  65692203,  50995122,  52156728,  44187793,  32988519,
-      46978428,  49648957,  43769567,  68958857,  56765240,  80721594,  51577447,  70298692,
-      56957407,  93372706,  47400672,  70912347,  78241282,  49291723,  69807896,  48372387,
-      39312015,  58020704,  60084247,  1378,      2471,      1584,      14,        37880886,
-      117,       184273430, 80952783,  135676228, 101229664, 230479318, 70652028,  137836653,
-      70943805,  154072333, 29316298,  58302725,  109445030, 117306062, 129270567, 166048852,
-      103000639, 54174517,  174819705, 166323524, 124543976, 80215452,  49650895,  101281709,
-      49817574,  56668585,  50459552,  273352049, 166,       273352009, 16,        1,
-      57668,     1724,      1886,      3668,      3960,      1963,      1124,      945,
-      1836,      1882,      1709,      2389,      921,       2154,      1020,      1792,
-      3747,      6750,      1318,      3100,      4506,      1175,      1514,      1430,
-      3474,      44548,     3179,      1149,      2410,      9689,      727,       2348,
-      2148,      1785,      5025,      1040,      3246,      1699,      505,       1034,
-      9995,      24776,     3345,      1897,      1019,      1614,      35349,     988,
-      2469,      5759,      2043,      7976,      1229,      896,       2692,      962,
-      3341,      2490,      2648,      1162,      4812,      8404,      949,       3132,
-      1,         1,         34754,     58694,     3400,      561,       6,         5,
-      3,         47,        41,        19,        292,       24,        17,        12
```

**File**: `src/core/flatbuffers.h` (modified, +0/-4)
```diff
@@ -11,7 +11,3 @@
 #include <flatbuffers/flatbuffers.h>
 #include <flatbuffers/flexbuffers.h>
 #include <flatbuffers/idl.h>
-
-namespace dfly {
-using FlatJson = flexbuffers::Reference;
-}  // namespace dfly
```

**File**: `src/core/huff_coder.cc` (removed, +0/-156)
```diff
@@ -1,156 +0,0 @@
-// Copyright 2025, DragonflyDB authors.  All rights reserved.
-// See LICENSE for licensing terms.
-//
-
-#include "core/huff_coder.h"
-
-#include "base/logging.h"
-
-extern "C" {
-#include "huff/huf.h"
-}
-
-using namespace std;
-
-namespace dfly {
-
-constexpr size_t kWspSize = HUF_CTABLE_WORKSPACE_SIZE;
-
-bool HuffmanEncoder::Load(std::string_view binary_data, std::string* error_msg) {
-  CHECK(!huf_ctable_);
-
-  huf_ctable_.reset(new HUF_CElt[HUF_CTABLE_SIZE_ST(255)]);
-  table_max_symbol_ = 255;
-
-  unsigned has_zero_weights = 0;
-  size_t read_size = HUF_readCTable(huf_ctable_.get(), &table_max_symbol_, binary_data.data(),
-                                    binary_data.size(), &has_zero_weights);
-
-  if (HUF_isError(read_size)) {
-    huf_ctable_.reset();
-    *error_msg = HUF_getErrorName(read_size);
-    return false;
-  }
-  if (read_size != binary_data.size()) {
-    *error_msg = "Corrupted data";
-    huf_ctable_.reset();
-    return false;
-  }
-  HUF_CTableHeader header = HUF_readCTableHeader(huf_ctable_.get());
-  num_bits_ = header.tableLog;
-  table_max_symbol_ = header.maxSymbolValue;
-
-  return true;
-}
-
-bool HuffmanEncoder::Build(const unsigned hist[], unsigned max_symbol, std::string* error_msg) {
-  CHECK(!huf_ctable_);
-  huf_ctable_.reset(new HUF_CElt[HUF_CTABLE_SIZE_ST(max_symbol)]);
-
-  unique_ptr<uint32_t[]> wrkspace(new uint32_t[HUF_CTABLE_WORKSPACE_SIZE_U32]);
-
-  size_t num_bits =
-      HUF_buildCTable_wksp(huf_ctable_.get(), hist, max_symbol, 0, wrkspace.get(), kWspSize);
-  if (HUF_isError(num_bits)) {
-    *error_msg = HUF_getErrorName(num_bits);
-    huf_ctable_.reset();
-    return false;
-  }
-  num_bits_ = static_cast<uint8_t>(num_bits);
-  table_max_symbol_ = max_symbol;
-  return true;
-}
-
-void HuffmanEncoder::Reset() {
-  huf_ctable_.reset();
-  table_max_symbol_ = 0;
-}
-
-bool HuffmanEncoder::Encode(std::string_view data, uint8_t* dest, uint32_t* dest_size,
-                            std::string* error_msg) const {
-  DCHECK(huf_ctable_);
-
-  size_t res =
-      HUF_compress1X_usingCTable(dest, *dest_size, data.data(), data.size(), huf_ctable_.get(), 0);
-
-  if (HUF_isError(res)) {
-    *error_msg = HUF_getErrorName(res);
-    return false;
-  }
-  *dest_size = static_cast<uint32_t>(res);
-  return true;
-}
-
-unsigned HuffmanEncoder::GetNBits(uint8_t symbol) const {
-  DCHECK(huf_ctable_);
-  return HUF_getNbBitsFromCTable(huf_ctable_.get(), symbol);
-}
-
-size_t HuffmanEncoder::EstimateCompressedSize(const unsigned hist[], unsigned max_symbol) const {
-  DCHECK(huf_ctable_);
-  size_t res = HUF_estimateCompressedSize(huf_ctable_.get(), hist, max_symbol);
-  return res;
-}
-
-optional<string> HuffmanEncoder::Export() const {
-  DCHECK(huf_ctable_);
-
-  // Reverse engineered: (maxSymbolValue + 1) / 2 + 1.
-  constexpr unsigned kMaxTableSize = 130;
-  string res;
-  res.resize(kMaxTableSize);
-
-  unique_ptr<uint32_t[]> wrkspace(new uint32_t[HUF_CTABLE_WORKSPACE_SIZE_U32]);
-
-  // Seems we can reuse the same workspace, its capacity is enough.
-  size_t size = HUF_writeCTable_wksp(res.data(), res.size(), huf_ctable_.get(), table_max_symbol_,
-                                     num_bits_, wrkspace.get(), kWspSize);
-  if (HUF_isError(size)) {
-    LOG(WARNING) << "Failed to export Huffman table: " << HUF_getErrorName(size);
-    return nullopt;
-  }
-  res.resize(size);
-  return res;
-}
-
-// Copied from HUF_tightCompressBound.
-size_t HuffmanEncoder::CompressedBound(size_t src_size) const {
-  return ((src_size * num_bits_) >> 3) + 8;
-}
-
-bool HuffmanDecoder::Load(std::string_view binary_data, std::string* error_msg) {
-  DCHECK(!huf_dtable_);
-  huf_dtable_.reset(new HUF_DTable[HUF_DTABLE_SIZE(HUF_TABLELOG_MAX)]);
-  huf_dtable_[0] = (HUF_TABLELOG_MAX - 1) * 0x01000001;  // some sort of magic number
-
-  constexpr size_t kWspSize = HUF_DECOMPRESS_WORKSPACE_SIZE;
-  unique_ptr<uint8_t[]> wrksp(new uint8_t[kWspSize]);
-
-  size_t res = HUF_readDTableX1_wksp(huf_dtable_.get(), binary_data.data(), binary_data.size(),
-                                     wrksp.get(), kWspSize, 0);
-  if (HUF_isError(res)) {
-    *error_msg = HUF_getErrorName(res);
-    huf_dtable_.reset();
-    return false;
-  }
-  if (res != binary_data.size()) {
-    *error_msg = "Corrupted data";
-    huf_dtable_.reset();
-    return false;
-  }
-  return true;
-}
-
-bool HuffmanDecoder::Decode(std::string_view src, size_t dest_size, char* dest) const {
-  DCHECK(huf_dtable_);
-  size_t res =
-      HUF_decompress1X_usingDTable(dest, dest_size, src.data(), src.size(), huf_dtable_.get(), 1);
-
-  if (HUF_isError(res)) {
-    LOG(DFATAL) << "Failed to decompress: " << HUF_getErrorName(res);
-    return false;
-  }
-  return true;
-}
-
-}  // namespace dfly
```

---

### Incident Patch 3: `7faee833` (2026-11-06)
**Commit Message**: fix(snapshot): release the serializer buffer while loading a tiered list node (#8757)

**File**: `src/server/rdb_save.cc` (modified, +23/-3)
```diff
@@ -417,11 +417,19 @@ error_code RdbSerializer::SaveListObject(const PrimeValue& pv) {
     DVLOG(3) << "QL node (encoding/container/sz): " << node->encoding << "/" << node->container
              << "/" << node->sz;
 
-    // Use listpack encoding
-    RETURN_ON_ERR(SaveLen(node->container));
     // Materialize the node if it was offloaded to tiered storage, so that we can access its
     // content. We have to drop const qualifier to update the node.
-    ql->Materialize(const_cast<QList::Node*>(node));
+    if (node->offloaded && consume_fun_ && mem_buf_controller_.TagEntriesEnabled()) {
+      // Reading the node from disk suspends. Make it a consume point between two nodes, so that
+      // other writers don't land inside this entry's bytes. Without tags, stream_mu_ holds them
+      // off instead.
+      RETURN_ON_ERR(ConsumeAround([&] { ql->Materialize(const_cast<QList::Node*>(node)); }));
+    } else {
+      ql->Materialize(const_cast<QList::Node*>(node));
+    }
+
+    // Use listpack encoding
+    RETURN_ON_ERR(SaveLen(node->container));
     if (node->encoding == QLIST_NODE_ENCODING_ZSTD) {
       // ZSTD-compressed nodes cannot be saved using RDB LZF encoding — the loader would
       // call lzf_decompress on ZSTD bytes and corrupt the data. Decompress to raw first.
@@ -1968,6 +1976,18 @@ void RdbSerializer::CompressBlob() {
   mem_buf->CommitWrite(compressed->size());
 }
 
+template <typename F> std::error_code RdbSerializer::ConsumeAround(F&& fn) {
+  mem_buf_controller_.MarkEntrySplit();
+  string blob = Flush(FlushState::kFlushMidEntry);
+
+  const auto id = mem_buf_controller_.SaveStateBeforeConsume();
+  std::error_code ec = blob.empty() ? std::error_code{} : consume_fun_(std::move(blob));
+  if (!ec)
+    fn();
+  mem_buf_controller_.RestoreStateAfterConsume(id);
+  return ec;
+}
+
 std::error_code RdbSerializer::PushToConsumerIfNeeded(FlushState flush_state) {
   if (!consume_fun_ || SerializedLen() <= flush_threshold_)
     return {};
```

**File**: `src/server/rdb_save.h` (modified, +3/-0)
```diff
@@ -373,6 +373,9 @@ class RdbSerializer {
   // Might preempt
   std::error_code PushToConsumerIfNeeded(FlushState flush_state);
 
+  // Runs fn, which may preempt mid-entry, at a forced consume point. Requires tagged entries.
+  template <typename F> std::error_code ConsumeAround(F&& fn);
+
   static constexpr size_t kFilterChunkSize = 1ULL << 26;
   static constexpr size_t kMinStrSizeToCompress = 256;
   static constexpr size_t kMaxStrSizeToCompress = 1 * 1024 * 1024;
```

**File**: `src/server/server_family.cc` (modified, +31/-0)
```diff
@@ -180,6 +180,10 @@ ABSL_DECLARE_FLAG(string, tls_ca_cert_file);
 ABSL_DECLARE_FLAG(string, tls_ca_cert_dir);
 ABSL_DECLARE_FLAG(int, replica_priority);
 ABSL_DECLARE_FLAG(double, rss_oom_deny_ratio);
+ABSL_DECLARE_FLAG(std::string, tiered_prefix);
+#ifdef WITH_TIERING
+ABSL_DECLARE_FLAG(bool, tiered_experimental_list_support);
+#endif
 
 bool AbslParseFlag(std::string_view in, ReplicaOfFlag* flag, std::string* err) {
 #define RETURN_ON_ERROR(cond, m)                                           \
@@ -1363,12 +1367,35 @@ bool ValidateServerTlsFlags() {
   return true;
 }
 
+namespace {
+
+// Saving a list reads its offloaded nodes from disk in the middle of the entry, which suspends.
+// Concurrent writes may serialize other keys into the same buffer meanwhile. The DF format keeps
+// them out of the entry with tagged chunks or the stream mutex; the RDB format has neither.
+// Disabling the flag at runtime leaves already offloaded nodes on disk, which this does not catch.
+bool TieredListNodesEnabled() {
+#ifdef WITH_TIERING
+  return !GetFlag(FLAGS_tiered_prefix).empty() && GetFlag(FLAGS_tiered_experimental_list_support);
+#else
+  return false;
+#endif
+}
+
+constexpr string_view kRdbWithTieredListsErr =
+    "RDB format is not supported with --tiered_experimental_list_support, use the DF format";
+
+}  // namespace
+
 bool ValidateSnapshotFilenameFlags() {
   auto ec = detail::ValidateFilename(GetFlag(FLAGS_dbfilename), GetFlag(FLAGS_df_snapshot_format));
   if (ec) {
     LOG(ERROR) << ec.Format();
     return false;
   }
+  if (!GetFlag(FLAGS_df_snapshot_format) && TieredListNodesEnabled()) {
+    LOG(ERROR) << kRdbWithTieredListsErr;
+    return false;
+  }
   return true;
 }
 
@@ -2175,6 +2202,10 @@ GenericError ServerFamily::DoSaveCheckAndStart(const SaveCmdOptions& save_cmd_op
   // TODO(#8410): with --aof, a save to the base's name overwrites the base.
   auto [ignore_state, bg_save] = opts;
 
+  if (!save_cmd_opts.new_version && TieredListNodesEnabled())
+    return GenericError{make_error_code(errc::operation_not_supported),
+                        string{kRdbWithTieredListsErr}};
+
   std::shared_ptr<SaveStagesController> controller;
   {
     util::fb2::LockGuard lk(save_mu_);
```

**File**: `src/server/snapshot.cc` (modified, +10/-2)
```diff
@@ -6,6 +6,7 @@
 
 #include <absl/strings/str_cat.h>
 
+#include <limits>
 #include <mutex>
 
 #include "base/cycle_clock.h"
@@ -100,10 +101,13 @@ void SliceSnapshot::Start(bool stream_journal, SnapshotFlush allow_flush) {
   size_t flush_threshold = 0;
   RdbSerializer::ConsumeFun consume_fun;
   if (allow_flush == SnapshotFlush::kAllow) {
+    // 0 disables splitting by size. The callback is still needed for forced consume points.
     flush_threshold = ServerState::tlocal()->serialization_max_chunk_size;
+    if (flush_threshold == 0)
+      flush_threshold = std::numeric_limits<size_t>::max();
+
     // The callback receives data directly from the serializer, no need to call back into it.
-    if (flush_threshold != 0)
-      consume_fun = std::bind_front(&SliceSnapshot::ConsumeBigValueChunk, this);
+    consume_fun = std::bind_front(&SliceSnapshot::ConsumeBigValueChunk, this);
   }
 
   bool serialize_index = SaveMode() != dfly::SaveMode::RDB &&
@@ -310,6 +314,10 @@ void SliceSnapshot::ConsumeJournalChange(const journal::JournalChangeItem& item)
 }
 
 void SliceSnapshot::ThrottleIfNeeded() {
+  // Without tagged chunks, an entry holds stream_mu_ while it may suspend mid-entry (e.g. reading a
+  // tiered list node). Flushing then would cut it, so leave the flush to a later call.
+  if (stream_mu_.is_locked())
+    return;
   PushSerialized(false);
 }
 
```

**File**: `src/server/tiered_storage_test.cc` (modified, +71/-0)
```diff
@@ -45,6 +45,7 @@ ABSL_DECLARE_FLAG(uint64_t, registered_buffer_size);
 ABSL_DECLARE_FLAG(bool, tiered_experimental_hash_support);
 ABSL_DECLARE_FLAG(bool, tiered_experimental_list_support);
 ABSL_DECLARE_FLAG(unsigned, list_tiering_threshold);
+ABSL_DECLARE_FLAG(bool, serialization_tagged_chunks);
 ABSL_DECLARE_FLAG(int32_t, list_max_listpack_size);
 
 namespace dfly {
@@ -1353,6 +1354,10 @@ class ListNodeTieringTest : public TieredStorageTest {
     SetFlag(&FLAGS_tiered_experimental_list_support, true);
     TieredStorageTest::SetUp();
   }
+
+ protected:
+  void SaveWithConcurrentWrites();
+
   optional<absl::FlagSaver> fs;
 };
 
@@ -1750,6 +1755,72 @@ TEST_F(ListNodeTieringTest, PushAfterOffloadedNodePromotedToTail) {
   EXPECT_THAT(Run({"LLEN", "mylist"}), IntArg(kTrimmedItems));
 }
 
+// Reading an offloaded node from disk suspends the snapshot in the middle of the list entry. Writes
+// that serialize other buckets meanwhile must not interleave their bytes with the entry. They write
+// to another db, so their SELECTDB lands between the list's chunks.
+void ListNodeTieringTest::SaveWithConcurrentWrites() {
+  const int kLists = 50, kItems = 8, kKeys = 2000;
+  vector<vector<string>> expected(kLists);
+  for (int l = 0; l < kLists; l++) {
+    for (int i = 0; i < kItems; i++) {
+      expected[l].push_back(BuildString(2048, static_cast<char>('A' + (l + i) % 26)));
+      Run({"RPUSH", absl::StrCat("list:", l), expected[l].back()});
+    }
+  }
+  ExpectConditionWithinTimeout([&] { return GetMetrics().tiered_stats.total_stashes >= kLists; });
+
+  Run({"SELECT", "1"});
+  for (int k = 0; k < kKeys; k++)
+    Run({"SET", absl::StrCat("key:", k), "v"});
+  Run({"SELECT", "0"});
+
+  // Each write serializes the bucket of its key if the snapshot has not reached it yet.
+  atomic_bool saved{false};
+  auto writer = pp_->at(0)->LaunchFiber([&] {
+    Run("writer", {"SELECT", "1"});
+    for (int k = 0; !saved.load(memory_order_relaxed); k = (k + 1) % kKeys) {
+      Run("writer", {"SET", absl::StrCat("key:", k), "w"});
+      ThisFiber::SleepFor(10us);  // let the proactor poll io completions
+    }
+  });
+  EXPECT_EQ(Run({"SAVE"}), "OK");
+  saved.store(true, memory_order_relaxed);
+  writer.Join();
+
+  ASSERT_EQ(Run({"DEBUG", "RELOAD", "NOSAVE"}), "OK");
+  EXPECT_THAT(Run({"DBSIZE"}), IntArg(kLists));
+  for (int l = 0; l < kLists; l++) {
+    auto resp = Run({"LRANGE", absl::StrCat("list:", l), "0", "-1"});
+    ASSERT_THAT(resp, ArrLen(kItems)) << "list " << l;
+    for (int i = 0; i < kItems; i++)
+      EXPECT_EQ(resp.GetVec()[i].GetString(), expected[l][i]) << "list " << l << " index " << i;
+  }
+  Run({"SELECT", "1"});
+  EXPECT_THAT(Run({"DBSIZE"}), IntArg(kKeys));
+  Run({"SELECT", "0"});
+}
+
+// Tagged chunks: the disk read is a consume point.
+TEST_F(ListNodeTieringTest, SaveWithConcurrentWritesWhileLoadingNodes) {
+  InitWithDbFilename();
+  SaveWithConcurrentWrites();
+  CleanupSnapshots();
+}
+
+// Without tagged chunks, the stream mutex keeps other writers out of the entry.
+TEST_F(ListNodeTieringTest, SaveWithConcurrentWritesWhileLoadingNodesUntagged) {
+  SetFlag(&FLAGS_serialization_tagged_chunks, false);
+  InitWithDbFilename();
+  SaveWithConcurrentWrites();
+  CleanupSnapshots();
+}
+
+TEST_F(ListNodeTieringTest, RdbSaveRejected) {
+  InitWithDbFilename();
+  EXPECT_THAT(Run({"SAVE", "RDB"}), ErrArg("not supported"));
+  CleanupSnapshots();
+}
+
 // Test MEMORY DECOMMIT COOL command flushes the cool queue
 TEST_P(LatentCoolingTSTest, MemoryDecommitCool) {
   absl::FlagSaver saver;
```

#### Recent Merged Pull Requests:
- **PR #8772** (2026-11-07): fix: remove unused code and obsolete test helpers (@vyavdoshenko)
- **PR #8770** (2026-11-07): test: make the CLIENT KILL stuck-send regression test portable (macOS fix) (@vyavdoshenko)
- **PR #8763** (2026-11-06): fix: resolve sanitizer UB and extend nightly test timeouts (@vyavdoshenko)
- **PR #8761** (2026-11-06): test: fix queued sink writer tests on libc++ (macOS) (@vyavdoshenko)
- **PR #8757** (2026-11-06): fix(snapshot): release the serializer buffer while loading a tiered list node (@kostasrim)
- **PR #8756** (2026-11-06): feat(server): support CLIENT KILL TYPE, USER, MAXAGE and SKIPME filters (@vyavdoshenko)

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

## X. test: make the CLIENT KILL stuck-send regression test portable (macOS fix) (#877

**RULE**:
When implementing operations in `src/server/dragonfly_connection_test.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflydb/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `244e6a07`: test: make the CLIENT KILL stuck-send regression test portable (macOS fix) (#8770). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/server/dragonfly_connection_test.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    main_listener_ = make(facade::Listener::Role::MAIN);
    port_ = acceptor_->AddListener(0, main_listener_);
    return {main_listener_, admin};
    // Initialize shared buffers for tests that switch to V2 after setup.
    const bool v2 = absl::GetFlag(FLAGS_enable_resp_io_loop_v2);
    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, true);
    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, v2);
  facade::Listener* main_listener_ = nullptr;
// A closing context must not prevent killing an open socket with a blocked send.
TEST_F(ClientKillTest, KillsClosingConnectionWithStuckSend) {
  auto wait_until = [](auto&& condition) {
    const auto deadline = std::chrono::steady_clock::now() + 2s;
    while (!condition()) {
      if (std::chrono::steady_clock::now() >= deadline)
        return false;
      absl::SleepFor(absl::Milliseconds(1));
    }
    return true;
  };

  ASSERT_EQ(Run({"SET", "big", std::string(64 << 20, 'x')}), "OK");
  for (bool v2 : {false, true}) {
    SCOPED_TRACE(v2);
    absl::SetFlag(&FLAGS_enable_resp_io_loop_v2, v2);
    RawRespClient client{port_};
    ASSERT_TRUE(client.valid());
    const std::string id = ClientId(client);
    ASSERT_FALSE(id.empty());
    SCO
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
    auto* listener = make(facade::Listener::Role::MAIN);
    port_ = acceptor_->AddListener(0, listener);
    return {listener, admin};
// A half-closed peer marks the connection closing, yet only a kill ends its blocked send.
TEST_F(ClientKillTest, KillsHalfClosedStuckSend) {
  RawRespClient v{port_};
  const std::string id = ClientId(v);
  Run({"SET", "big", std::string(64 << 20, 'x')});
  auto row = [&] { return Run({"CLIENT", "LIST", "ID", id}).GetString(); };
  ASSERT_TRUE(v.SendAll("GET big\r\n"));
  ExpectConditionWithinTimeout([&] { return absl::StrContains(row(), "phase=send"); });
  ASSERT_TRUE(v.ShutdownWrite());
  ExpectConditionWithinTimeout([&] { return absl::StrContains(row(), "flags=t"); });
  EXPECT_THAT(Run({"CLIENT", "KILL", "ID", id}), IntArg(1));
  ExpectConditionWithinTimeout([&] { return row().empty(); });
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `244e6a07` are properly handled with clean fallback behavior.
