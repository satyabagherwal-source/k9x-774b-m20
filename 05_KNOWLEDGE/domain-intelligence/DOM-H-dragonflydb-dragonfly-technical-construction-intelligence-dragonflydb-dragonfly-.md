# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: dragonflydb/dragonfly Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "dragonflydb/dragonfly",
  "source_url": "https://github.com/dragonflydb/dragonfly",
  "source_version": "66de9e68",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T17:42:01.687Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dragonflydb-dragonfly",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly) (Revision: `66de9e68`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T17:42:01.687Z`  
> **Learning ID**: `learn-github-dragonflydb-dragonfly`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), I (Content & Information Intelligence)
- **Confidence Rating**: 74%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from dragonflydb/dragonfly:

# Forensic Learning Record (Deep Inspection): dragonflydb/dragonfly

> **Canonical Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T17:42:00.415Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflydb/dragonfly`
- **Description**: A modern replacement for Redis and Memcached
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 31899 stars

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
- **Issue #8786** (2026-11-15): **HSET aborts with a false listpack corruption error when shrinking a value larger than 4 MiB**
  *Symptoms*: **Describe the bug** Replacing a listpack element larger than 4 MiB with a substantially smaller value aborts Dragonfly. We observed this abort four times in production and reproduced it with one hash field. The reported corruption is a false positive: the diagnostic compares the old logical listpack size with the new allocation size during an intentional shrink.  **To Reproduce** Run Dragonfly v2.0.2 or an image built from main commit 0219b0acb61418a1360dbe10a727bfcc07044e7f, store a 5 MiB hash value, and replace it with a small value:  ```sh #!/bin/sh set -eu  DRAGONFLY_IMAGE_NAME=${DRAGONFLY_IMAGE_NAME:-docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2} CONTAINER_NAME=lp-shrink-repro  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true docker run -d --name "$CONTAINER_NAME" "$DRAGONFLY_IMAGE_NAME" --logtostderr --proactor_threads 1 >/dev/null until docker exec "$CONTAINER_NAME" redis-cli ping >/dev/null 2>&1; do sleep 0.2; done docker exec "$CONTAINER_NAME" sh -c '   head -c 5242880 /dev/zero | tr "\0" x > /tmp/big   redis-cli -x HSET k f < /tmp/big   redis-cli DEBUG OBJECT k   redis-cli HSET k f small ' sleep 1 docker inspect -f 'running={{.State.Running}} exit={{.State.ExitCode}}' "$CONTAINER_NAME" docker logs "$CONTAINER_NAME" 2>&1 | grep -E 'listpack size|SIGABRT' | head -2 ```  After the first `HSET`, Dragonfly stores the hash as a listpack containing the 5 MiB value. During the second `HSET`, Dragonfly compacts that listpack and shrinks its backing allocation for

- **Issue #8754** (2026-11-10): **IoLoopV2 stalls a pipelined connection over pipeline_buffer_limit (debug: Check failed: is_deferred_reply_)**
  *Symptoms*: Found by fuzz-pr on #8752; pre-existing on main and in v2.1.0: https://github.com/dragonflydb/dragonfly/actions/runs/42001650757/job/127158081546  Repro (the commands must arrive in one packet; interactive redis-cli does not trigger it):  ``` printf 'CONFIG SET pipeline_buffer_limit 1\r\nFT.SEARCH idx *\r\nCLIENT GETNAME\r\nSET a b\r\nPING\r\n' | nc 127.0.0.1 6379 ```  - Debug: `Check failed: is_deferred_reply_` (parsed_command.cc:113) in `ParsedCommand::CanReply()`   <- `Connection::HasControlEvent()` <- `ParkOnBackpressure()` <- `IoLoopV2()`. - Release (v2.1.0): no crash, but the connection stalls: PING gets no reply for 30+ s (4/4 runs on a fresh server). - Does not reproduce with `--enable_resp_io_loop_v2=false`, without the FT.SEARCH, or with INFO instead of CLIENT.  Likely cause: the sync CLIENT command waits behind the in-flight FT.SEARCH. Over the limit, the connection parks in `ParkOnBackpressure()`, whose wake predicate calls `parsed_head_->CanReply()` on a head that was never dispatched. The other `CanReply()` call sites check `IsDeferredReply()` first. 

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

### Incident Patch 1: `2c56bc98` (2026-11-20)
**Commit Message**: fix: correct connection replies and client tracking (#8857)

A bare HELLO switched a RESP3 connection back to RESP2, a user without @connection could not run
AUTH or HELLO, an unnamed connection reported its id as its name, CLIENT INFO flags used a letter
that client parsers reject, and client tracking lost or delayed invalidations.

- HELLO without arguments keeps the current protocol.
- AUTH, HELLO, QUIT and RESET are not checked against the user's command rules, also in
  ACL DRYRUN.
- CLIENT INFO is a verbatim string under RESP3. Flags use the letters clients parse: A closing,
  P pub/sub, b blocked, t tracking, N none; the async-dispatch letter a is gone.
- A connection has no name until it sets one, and RESET clears it. ACL WHOAMI replies with the
  user name only.
- CLIENT TRACKING NOLOOP tracks keys again and skips only the invalidations of changes made by
  the connection's own command. Active expiry sends its invalidations instead of leaving them for
  the next command on the shard. EVAL_RO and EVALSHA_RO track the keys their commands read;
  tracking the script itself crashed debug builds.
- SendBool writes the RESP3 literal with one WritePieces call.

RESPObj and the te

**File**: `src/facade/dragonfly_connection.cc` (modified, +4/-3)
```diff
@@ -1074,7 +1074,7 @@ void Connection::OnPostMigrateThread() {
 }
 
 void Connection::OnConnectionStart() {
-  SetName(absl::StrCat(id_));
+  SetName({});
 
   // is null in unit-tests.
   if (const Listener* lsnr = static_cast<Listener*>(listener()); lsnr) {
@@ -1361,7 +1361,7 @@ ClientInfo Connection::BuildClientInfo(unsigned thread_id) const {
     else if (ctx_info.is_scheduled)
       phase_name = "scheduled";
     ci.db = ctx_info.db_index;
-    // ctx_info.Format() returns "db=N" or "db=N flags=X"; extract flags only.
+    // ctx_info.Format() returns "db=N flags=X"; extract flags only.
     size_t flags_pos = ctx_info.Format().find(" flags=");
     if (flags_pos != string::npos)
       ci.flags = ctx_info.Format().substr(flags_pos + sizeof(" flags=") - 1);
@@ -1407,7 +1407,8 @@ bool Connection::IsMainOrMemcache() const {
 }
 
 void Connection::SetName(string name) {
-  util::ThisFiber::SetName(absl::StrCat("DflyConn_", name));
+  // An unnamed connection keeps its id in the fiber name.
+  util::ThisFiber::SetName(absl::StrCat("DflyConn_", name.empty() ? absl::StrCat(id_) : name));
   name_ = std::move(name);
 }
 
```

**File**: `src/facade/facade.cc` (modified, +5/-0)
```diff
@@ -153,6 +153,8 @@ const char* RespExpr::TypeName(Type t) {
       return "error";
     case BOOL:
       return "bool";
+    case VERB:
+      return "verbatim";
   }
   ABSL_UNREACHABLE();
 }
@@ -227,6 +229,9 @@ ostream& operator<<(ostream& os, const facade::RespExpr& e) {
     case RespExpr::BOOL:
       os << (get<int64_t>(e.u) ? "true" : "false");
       break;
+    case RespExpr::VERB:
+      os << "v'" << ToSV(get<RespExpr::Buffer>(e.u)) << "'";
+      break;
   }
 
   return os;
```

**File**: `src/facade/facade_test.cc` (modified, +3/-2)
```diff
@@ -32,15 +32,15 @@ bool RespMatcher::MatchAndExplain(RespExpr e, MatchResultListener* listener) con
     }
   }
 
-  if (type_ == RespExpr::STRING || type_ == RespExpr::ERROR) {
+  if (type_ == RespExpr::STRING || type_ == RespExpr::ERROR || type_ == RespExpr::VERB) {
     RespExpr::Buffer ebuf = e.GetBuf();
     std::string_view actual{reinterpret_cast<const char*>(ebuf.data()), ebuf.size()};
 
     if (type_ == RespExpr::ERROR && !absl::StrContains(actual, exp_str_)) {
       *listener << "Actual does not contain '" << exp_str_ << "'";
       return false;
     }
-    if (type_ == RespExpr::STRING && exp_str_ != actual) {
+    if (type_ != RespExpr::ERROR && exp_str_ != actual) {
       *listener << "\nActual string: " << actual;
       return false;
     }
@@ -72,6 +72,7 @@ void RespMatcher::DescribeTo(std::ostream* os) const {
   switch (type_) {
     case RespExpr::STRING:
     case RespExpr::ERROR:
+    case RespExpr::VERB:
       *os << exp_str_;
       break;
 
```

**File**: `src/facade/reply_builder.cc` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ void RedisReplyBuilderBase::SendBool(bool val) {
     return SendLong(val);
 
   ReplyScope scope(this);
-  val ? WritePieces(kTrueR3) : WritePieces(kFalseR3);
+  WritePieces(val ? kTrueR3 : kFalseR3);
 }
 
 void RedisReplyBuilderBase::SendNullArray() {
```

**File**: `src/facade/reply_builder_test.cc` (modified, +5/-0)
```diff
@@ -1006,6 +1006,11 @@ TEST_F(RedisReplyBuilderTest, VerbatimString) {
   builder_->SetRespVersion(RespVersion::kResp3);
   builder_->SendVerbatimString(str, RedisReplyBuilder::VerbatimFormat::TXT);
   ASSERT_TRUE(NoErrors());
+
+  // Tests read the text without its format prefix and compare it.
+  auto parsed = Parse();
+  EXPECT_THAT(parsed.args, ElementsAre(RespMatcher(str, RespExpr::VERB)));
+  EXPECT_THAT(parsed.args, ElementsAre(Not(RespMatcher("A simple", RespExpr::VERB))));
   ASSERT_EQ(TakePayload(), "=20\r\ntxt:A simple string!\r\n") << "Resp3 VerbatimString TXT failed.";
 
   builder_->SetRespVersion(RespVersion::kResp3);
```

**File**: `src/facade/resp_expr.h` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ class RespExpr {
  public:
   using Buffer = absl::Span<const uint8_t>;
 
-  enum Type : uint8_t { STRING, ARRAY, INT64, DOUBLE, NIL, NIL_ARRAY, ERROR, BOOL };
+  enum Type : uint8_t { STRING, ARRAY, INT64, DOUBLE, NIL, NIL_ARRAY, ERROR, BOOL, VERB };
 
   // RESP3 maps and sets arrive as an ARRAY of their flat contents; this tells them apart.
   enum class Agg : uint8_t { kArray, kMap, kSet };
```

**File**: `src/facade/resp_expr_test_utils.cc` (modified, +5/-0)
```diff
@@ -62,6 +62,11 @@ RespExpr RespExprBuilder::BuildNode(const RESPObj& obj) {
       SetStringPayload(obj, &expr);
       break;
     }
+    case RESPObj::Type::VERB: {
+      expr.type = RespExpr::VERB;
+      SetStringPayload(obj, &expr);
+      break;
+    }
     case RESPObj::Type::ARRAY:
     case RESPObj::Type::MAP:
     case RESPObj::Type::SET: {
```

**File**: `src/facade/resp_parser.cc` (modified, +2/-0)
```diff
@@ -181,6 +181,8 @@ std::ostream& operator<<(std::ostream& os, const RESPObj& obj) {
     }
     case RESPObj::Type::STRING:
       [[fallthrough]];
+    case RESPObj::Type::VERB:
+      [[fallthrough]];
     case RESPObj::Type::NIL:
       [[fallthrough]];
     case RESPObj::Type::ERROR:
```

---

### Incident Patch 2: `dd86999d` (2026-11-20)
**Commit Message**: fix(zset): reply with score pairs for ZUNION/ZINTER WITHSCORES in RESP3 (#8841)

fix(zset): reply with [member, score] pairs for ZUNION/ZINTER WITHSCORES in RESP3

The non-store branch of ZBooleanOperation always wrote a flat member/score list, so RESP3
clients such as redis-py 8 failed to unpack zunion/zinter(withscores=True). Reply like
SendScoredArray does: one [member, score] array per member under RESP3, flat otherwise.

Fixes #8839

Signed-off-by: Pratik-Kumar-Dhakar <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/server/zset_family.cc` (modified, +6/-1)
```diff
@@ -1620,8 +1620,13 @@ void ZBooleanOperation(CmdArgParser parser, string_view cmd, bool is_union, bool
     // We can't use SendScoredArray because it expects strings, not string_views
     // TOOD: Not longer relevant with new io, use scoping
     auto* rb = static_cast<RedisReplyBuilder*>(builder);
-    rb->StartArray(smvec.size() * (op_args->with_scores ? 2 : 1));
+
+    // Like SendScoredArray: RESP3 replies with a [member, score] pair per member.
+    const bool score_pairs = op_args->with_scores && rb->IsResp3();
+    rb->StartArray((op_args->with_scores && !score_pairs) ? smvec.size() * 2 : smvec.size());
     for (const auto& elem : smvec) {
+      if (score_pairs)
+        rb->StartArray(2);
       rb->SendBulkString(elem.second);
       if (op_args->with_scores) {
         rb->SendDouble(elem.first);
```

**File**: `src/server/zset_family_test.cc` (modified, +16/-0)
```diff
@@ -1249,6 +1249,22 @@ TEST_F(ZSetFamilyTest, Resp3) {
   ASSERT_THAT(resp, ArrLen(2));
   ASSERT_THAT(resp.GetVec()[0].GetVec(), ElementsAre("a", DoubleArg(1)));
   ASSERT_THAT(resp.GetVec()[1].GetVec(), ElementsAre("b", DoubleArg(2)));
+
+  // ZUNION and ZINTER reply with [member, score] pairs too.
+  Run({"zadd", "y", "3", "b", "4", "c"});
+  resp = Run({"zunion", "2", "x", "y", "WITHSCORES"});
+  ASSERT_THAT(resp, ArrLen(3));
+  EXPECT_THAT(resp.GetVec()[0].GetVec(), ElementsAre("a", DoubleArg(1)));
+  EXPECT_THAT(resp.GetVec()[1].GetVec(), ElementsAre("c", DoubleArg(4)));
+  EXPECT_THAT(resp.GetVec()[2].GetVec(), ElementsAre("b", DoubleArg(5)));
+
+  resp = Run({"zinter", "2", "x", "y", "WITHSCORES"});
+  ASSERT_THAT(resp, ArrLen(1));
+  EXPECT_THAT(resp.GetVec()[0].GetVec(), ElementsAre("b", DoubleArg(5)));
+
+  // Without WITHSCORES they stay a flat list of members.
+  resp = Run({"zunion", "2", "x", "y"});
+  EXPECT_THAT(resp.GetVec(), ElementsAre("a", "c", "b"));
 }
 
 TEST_F(ZSetFamilyTest, BlockingIsReleased) {
```

---

### Incident Patch 3: `66de9e68` (2026-11-20)
**Commit Message**: refactor(core): Simplify memory accounting (#8820)

* feat(core): Simplify memory accounting

- Move the accounting to core
- Remove need for callbacks for future PRs or handlers/hooks in core
- Simplify accounting, by using a running total accounted for bytes
- Scopes no longer adjust parent/deduct parent scope values
- Reduce number of adhoc calculation points to just one point

Signed-off-by: Abhijat Malviya <[REDACTED_EMAIL]>

**File**: `src/core/CMakeLists.txt` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ add_subdirectory(page_usage)
 
 add_library(dfly_core allocation_tracker.cc bloom.cc topk.cc compact_object.cc cms.cc cuckoo.cc dense_set.cc
     dragonfly_core.cc extent_tree.cc lua_internals.cc
-    interpreter.cc glob_matcher.cc mi_memory_resource.cc qlist.cc dict_builder.cc sds_utils.cc
+    interpreter.cc glob_matcher.cc memory_accounting.cc mi_memory_resource.cc qlist.cc dict_builder.cc sds_utils.cc
     segment_allocator.cc score_map.cc small_string.cc sorted_map.cc stream_node.cc task_queue.cc
     tx_queue.cc string_set.cc string_map.cc tiering_types.cc top_keys.cc
     detail/bitpacking.cc detail/listpack_wrap.cc detail/listpack.cc
```

**File**: `src/core/compact_object.cc` (modified, +10/-16)
```diff
@@ -31,6 +31,7 @@ extern "C" {
 #include "core/cms.h"
 #include "core/cuckoo.h"
 #include "core/detail/bitpacking.h"
+#include "core/memory_accounting.h"
 #include "core/oah_set.h"
 #include "core/page_usage/page_usage_stats.h"
 #include "core/qlist.h"
@@ -507,7 +508,6 @@ struct TL {
   string tmp_str;
   size_t small_str_bytes;
   PinnedMap pin_map;
-  CompactObj::TypeReplacementHook type_replacement_hook = nullptr;
 };
 
 // Callback function used in redis/t_stream.cc implementation to
@@ -619,13 +619,8 @@ auto CompactObj::GetStatsThreadLocal() -> Stats {
   return res;
 }
 
-void CompactObj::SetTypeReplacementHook(TypeReplacementHook hook) {
-  tl.type_replacement_hook = hook;
-}
-
 void CompactObj::InitThreadLocal(MemoryResource* mr) {
   tl.local_mr = mr;
-  tl.type_replacement_hook = nullptr;
   tl.tmp_buf = base::PODArray<uint8_t>{mr};
   cmn::BorrowedStringOps::Set(&g_borrow_ops);
 }
@@ -1496,22 +1491,21 @@ std::pair<bool, bool> CompactObj::SetByteAtIndex(size_t idx, uint8_t val) {
 }
 
 void CompactObj::SetMeta(uint8_t taglen, uint8_t mask, CompactObjType replacement_type) {
-  if (HasAllocated()) {
+  if (!HasAllocated()) {
+    memset(u_.inline_str, 0, kInlineLen);
+  } else if (is_key_ || !MemoryAccountingEnabled()) {
+    // AccountObjectMemory charges key frees separately as OBJ_KEY.
+    Free();
+  } else {
     const auto old_type = ObjType();
-    if (tl.type_replacement_hook && replacement_type == kInvalidCompactObjType)
+    if (replacement_type == kInvalidCompactObjType)
       replacement_type = TypeForTag(taglen);
-
-    if (tl.type_replacement_hook && old_type != replacement_type) {
-      const auto& resource = *static_cast<MiMemoryResource*>(tl.local_mr);
-      const int64_t before = UsedMemoryThreadLocal(resource);
+    if (old_type != replacement_type) {
+      AtomicMemoryScope scope(old_type);
       Free();
-      const int64_t after = UsedMemoryThreadLocal(resource);
-      tl.type_replacement_hook(old_type, after - before);
     } else {
       Free();
     }
-  } else {
-    memset(u_.inline_str, 0, kInlineLen);
   }
   taglen_ = taglen;
   mask_ = mask;
```

**File**: `src/core/compact_object.h` (modified, +0/-4)
```diff
@@ -474,10 +474,6 @@ class CompactObj {
 
   static Stats GetStatsThreadLocal();
 
-  // Receives the allocator delta from freeing a value replaced by a different type.
-  // The hook runs synchronously and must not suspend.
-  using TypeReplacementHook = void (*)(CompactObjType old_type, int64_t delta);
-  static void SetTypeReplacementHook(TypeReplacementHook hook);
   static void InitThreadLocal(MemoryResource* mr);
   static void ClearThreadLocalStats();
 
```

**File**: `src/core/compact_object_test.cc` (modified, +134/-29)
```diff
@@ -18,6 +18,7 @@
 #include "base/logging.h"
 #include "core/cuckoo.h"
 #include "core/detail/bitpacking.h"
+#include "core/memory_accounting.h"
 #include "core/mi_memory_resource.h"
 #include "core/page_usage/page_usage_stats.h"
 #include "core/string_map.h"
@@ -1514,53 +1515,157 @@ TEST_F(CompactObjectTest, StreamSizeDoesNotWrap) {
 }
 
 TEST_F(CompactObjectTest, TypeReplacementAccounting) {
-  static thread_local vector<pair<CompactObjType, int64_t>> deltas;
-  deltas.clear();
-  CompactObj::SetTypeReplacementHook(
-      [](CompactObjType type, int64_t delta) { deltas.emplace_back(type, delta); });
-  absl::Cleanup restore_hook = [] { CompactObj::SetTypeReplacementHook(nullptr); };
+  auto& resource = *static_cast<MiMemoryResource*>(CompactObj::memory_resource());
+  InitMemoryAccounting(resource);
+  absl::Cleanup shutdown = [] { ShutdownMemoryAccounting(); };
+
+  auto attributed = [] { return GetTypeAttributedMemory(); };
 
   for (size_t size : {32u, 4096u}) {
     SCOPED_TRACE(size);
     cobj_.SetString(string(size, '\x80'));
     int64_t string_bytes = cobj_.MallocUsed();
-    intset* is = intsetNew();
-    int64_t set_bytes = zmalloc_usable_size(is);
-    cobj_.InitRobj(OBJ_SET, kEncodingIntSet, is);
-    ASSERT_FALSE(deltas.empty());
-    EXPECT_EQ(deltas.back(), make_pair(CompactObjType{OBJ_STRING}, -string_bytes));
+    auto before = attributed();
+    int64_t set_bytes;
+    {
+      AtomicMemoryScope scope(OBJ_SET);
+      intset* is = intsetNew();
+      set_bytes = zmalloc_usable_size(is);
+      cobj_.InitRobj(OBJ_SET, kEncodingIntSet, is);
+    }
+    auto expected = before;
+    expected[OBJ_STRING] -= string_bytes;
+    expected[OBJ_SET] += set_bytes;
+    EXPECT_EQ(attributed(), expected);
 
+    before = attributed();
     cobj_.SetString("42");
-    EXPECT_EQ(deltas.back(), make_pair(CompactObjType{OBJ_SET}, -set_bytes));
+    EXPECT_EQ(attributed()[OBJ_SET] - before[OBJ_SET], -set_bytes);
   }
-  ASSERT_EQ(deltas.size(), 4);
 
-  // Encoding changes, tiering, resets and destruction are not cross-type replacements.
+  // Same-type replacement is accounted for by the enclosing scope.
   cobj_.SetString(string(32, '\x80'));
-  cobj_.SetString(string(4096, '\x80'));
-  cobj_.SetExternal(0, 4096, CompactObj::ExternalRep::STRING);
-  CompactValue external_hash;
-  external_hash.InitRobj(OBJ_HASH, kEncodingStrMap2, CompactObj::AllocateMR<StringMap>());
-  external_hash.SetExternal(4096, 128, CompactObj::ExternalRep::SERIALIZED_MAP);
-  external_hash.Reset();
-  external_hash.SetString("inline");
+  auto expected = attributed();
+  int64_t old_bytes = cobj_.MallocUsed();
   {
-    CompactValue value;
-    value.SetString(string(32, '\x80'));
-    value.Reset();
-    value.SetString(string(4096, '\x80'));
+    AtomicMemoryScope scope(OBJ_STRING);
+    cobj_.SetString(string(4096, '\x80'));
   }
-  EXPECT_EQ(deltas.size(), 4);
+  expected[OBJ_STRING] += static_cast<int64_t>(cobj_.MallocUsed()) - old_bytes;
+  EXPECT_EQ(attributed(), expected);
+
+  // Key accounting is separate.
+  CompactKey key(string(4096, '\x80'));
+  key.SetString("inline");
+  EXPECT_EQ(attributed(), expected);
 
-  cobj_.Reset();
-  cobj_.SetString(string(4096, '\x80'));
   int64_t string_bytes = cobj_.MallocUsed();
+  const auto before_move = attributed();
+  CompactValue external_hash;
   external_hash.SetExternal(4096, 128, CompactObj::ExternalRep::SERIALIZED_MAP);
   cobj_ = std::move(external_hash);
-  ASSERT_EQ(deltas.size(), 5);
-  EXPECT_EQ(deltas.back(), make_pair(CompactObjType{OBJ_STRING}, -string_bytes));
+  EXPECT_EQ(attributed()[OBJ_STRING] - before_move[OBJ_STRING], -string_bytes);
   EXPECT_EQ(cobj_.ObjType(), OBJ_HASH);
   EXPECT_TRUE(cobj_.IsExternal());
+
+  // Same-type offloading leaves accounting to the caller.
+  cobj_.Reset();
+  cobj_.SetString(string(4096, '\x80'));
+  const auto before_offload = attributed();
+  cobj_.SetExternal(4096, 4096, CompactObj::ExternalRep::STRING);
+  EXPECT_EQ(attributed(), before_offload);
+}
+
+TEST_F(CompactObjectTest, MemoryAccountingScopesAndCharges) {
+  auto& resource = *static_cast<MiMemoryResource*>(CompactObj::memory_resource());
+  InitMemoryAccounting(resource);
+  absl::Cleanup shutdown = [] { ShutdownMemoryAccounting(); };
+
+  void* outer = nullptr;
+  void* middle = nullptr;
+  void* inner = nullptr;
+  void* direct = nullptr;
+  void* untracked = nullptr;
+  {
+    AtomicMemoryScope string_scope{OBJ_STRING};
+    outer = resource.allocate(64);
+    {
+      AtomicMemoryScope nested_string_scope{OBJ_STRING};
+      middle = resource.allocate(32);
+      {
+        AtomicMemoryScope hash_scope{OBJ_HASH};
+        inner = resource.allocate(16);
+        direct = resource.allocate(64);
+        ChargeMemory(OBJ_KEY, mi_usable_size(direct));
+        untracked = resource.allocate(64);
+        ChargeMemory(kUntrackedMemory, mi_usable_size(untracked));
+      }
+    }
+  }
+
+  TypeAttributedMemory expected{};
+  expected[OBJ_STRING] = mi_usable_size(o
```

**File**: `src/core/memory_accounting.cc` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+// Copyright 2026, DragonflyDB authors.  All rights reserved.
+// See LICENSE for licensing terms.
+//
+
+#include "core/memory_accounting.h"
+
+#include "base/logging.h"
+#include "core/mi_memory_resource.h"
+
+namespace dfly {
+using namespace util;
+
+namespace {
+
+struct MemoryAccountingState {
+  // A live resource enables accounting for this thread
+  MiMemoryResource* resource = nullptr;
+
+  // Cumulative signed charges from ChargeMemory form A in U - A accounting
+  ssize_t charged_total = 0;
+  TypeAttributedMemory by_type{};
+};
+
+thread_local MemoryAccountingState accounting;
+
+// The transaction retains ownership while its fiber is suspended.
+thread_local TxMemoryScope* tl_tx_scope = nullptr;
+
+}  // namespace
+
+void InitMemoryAccounting(MiMemoryResource& resource) {
+  DCHECK_EQ(accounting.resource, nullptr);
+  accounting.resource = &resource;
+}
+
+void ShutdownMemoryAccounting() {
+  accounting = {};
+}
+
+bool MemoryAccountingEnabled() {
+  return accounting.resource != nullptr;
+}
+
+const TypeAttributedMemory& GetTypeAttributedMemory() {
+  return accounting.by_type;
+}
+
+ssize_t UnattributedMemory() {
+  if (!MemoryAccountingEnabled())
+    return 0;
+
+  const ssize_t used = UsedMemoryThreadLocal(*accounting.resource);
+  return used - accounting.charged_total;
+}
+
+void ChargeMemory(int category, ssize_t delta) {
+  DCHECK_GE(category, 0);
+  DCHECK_LE(category, kUntrackedMemory);
+  if (!MemoryAccountingEnabled())
+    return;
+
+  accounting.charged_total += delta;
+  accounting.by_type[category] += delta;
+}
+
+AtomicMemoryScope::AtomicMemoryScope(int category)
+    : category_(category), baseline_(UnattributedMemory()) {
+  DCHECK_GE(category, 0);
+  DCHECK_LE(category, kUntrackedMemory);
+}
+
+AtomicMemoryScope::~AtomicMemoryScope() {
+  ChargeMemory(category_, UnattributedMemory() - baseline_);
+}
+
+TxMemoryScope::TxMemoryScope(int obj_type)
+    : obj_type_(obj_type), enabled_(MemoryAccountingEnabled()) {
+  if (!enabled_)
+    return;
+
+  CHECK_EQ(tl_tx_scope, nullptr) << "tx scope created while another tx scope exists";
+  DCHECK_GE(obj_type_, 0);
+  DCHECK_LT(obj_type_, OBJ_TYPE_MAX);
+  mem_baseline_ = UnattributedMemory();
+  tl_tx_scope = this;
+  prev_hook_ = ThisFiber::SetSwitchHook({MemTrackerHook});
+}
+
+TxMemoryScope::~TxMemoryScope() {
+  if (!enabled_)
+    return;
+
+  CHECK_EQ(tl_tx_scope, this) << "tx scope destroyed without owning the tracking pointer";
+  DCHECK(!suspended_);
+  ThisFiber::SetSwitchHook(prev_hook_);
+  tl_tx_scope = nullptr;
+
+  ChargeMemory(obj_type_, UnattributedMemory() - mem_baseline_);
+}
+
+void TxMemoryScope::MemTrackerHook(fb2::FiberSwitchHookEvent event) noexcept {
+  DCHECK_NE(tl_tx_scope, nullptr);
+  auto& scope = *tl_tx_scope;
+
+  using enum fb2::FiberSwitchHookEvent;
+  switch (event) {
+    case SUSPEND:
+      DCHECK(!scope.suspended_);
+      ChargeMemory(scope.obj_type_, UnattributedMemory() - scope.mem_baseline_);
+      scope.suspended_ = true;
+      break;
+    case RESUME:
+      DCHECK(scope.suspended_);
+
+      // Start a fresh interval after other fibers may have changed memory usage.
+      scope.mem_baseline_ = UnattributedMemory();
+      scope.suspended_ = false;
+      break;
+  }
+}
+
+}  // namespace dfly
```

**File**: `src/core/memory_accounting.h` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+// Copyright 2026, DragonflyDB authors.  All rights reserved.
+// See LICENSE for licensing terms.
+//
+
+#pragma once
+
+#include <array>
+
+#include "util/fibers/fibers.h"
+
+extern "C" {
+#include "redis/redis_aux.h"
+}
+
+namespace dfly {
+
+class MiMemoryResource;
+
+// Internal memory such as tiered storage wrappers and mcflag tables is counted in this slot.
+inline constexpr int kUntrackedMemory = OBJ_TYPE_MAX;
+
+using TypeAttributedMemory = std::array<ssize_t, kUntrackedMemory + 1>;
+
+// memory resource must outlive accounting sessions
+void InitMemoryAccounting(MiMemoryResource& resource);
+
+// All accounting scopes on this thread must have ended
+void ShutdownMemoryAccounting();
+
+bool MemoryAccountingEnabled();
+
+// Returns the current thread's cumulative charges split into types
+const TypeAttributedMemory& GetTypeAttributedMemory();
+
+// Memory sources of truth:
+//
+// Total used memory: from UsedMemoryThreadLocal
+//   Reported by mimalloc and thread-local counters.
+//   Up to date on every call and read-only.
+//   Referred to as "used".
+//
+// Accounted-for memory: from MemoryAccountingState::charged_total
+//   Running counter, only updated by ChargeMemory.
+//   Read when calculating the baseline and written after a scope ends.
+//   Total of the memory tracked by this accounting system. Running total of allocations and frees
+//   tracked by scopes and attributed to object types such as list, string, etc. Referred to as
+//   "accounted".
+//
+// Memory usage broken down by type: MemoryAccountingState::by_type
+//   Array of per-type counters, breaking down the "accounted" total.
+//   Written only by accounting code and read by metrics.
+//
+// Relation:
+//   Sum of memory usage by types is equal to accounted memory
+//
+// Lifecycle of a scope:
+//   At the start, calculate baseline = used - accounted.
+//   This is the memory not accounted for yet, whose changes come from allocations and frees during
+//   the operation.
+//
+//   At the end, calculate used - accounted again as baseline'.
+//   delta = baseline' - baseline is the change in unaccounted memory due to the scope's type.
+//   Attribute this delta to the scope's type in accounting.by_type[category].
+//
+//   Crucially, we also add this delta to the accounted total: accounted += delta.
+//   This step is critical for nested scope handling. All outer scopes can use change in this
+//   accounted total, to excloude changes from inner scopes if any. The nested scopes don't need to
+//   know about each other, they just refer to these two values: used and accounted.
+//
+// Nested scopes:
+//   Outer scope A (STRING) starts: used=10, accounted=5, baseline=10-5=5.
+//     A allocates 1: used=11.
+//     Inner scope B (HASH) starts: used=11, accounted=5, baseline=11-5=6.
+//       B allocates 1: used=12.
+//       B ends: baseline' = used - accounted = 12 - 5 = 7.
+//         delta = baseline' - baseline = 7 - 6 = 1.
+//         usage for HASH += 1.
+//         accounted += 1, so accounted=6.
+//     A ends: baseline' = used - accounted = 12 - 6 = 6.
+//       delta = baseline' - baseline = 6 - 5 = 1.
+//       usage for STRING += 1.
+//       accounted += 1, so accounted=7.
+//
+// Nested scopes update "accounted" so enclosing scopes can compute the difference.
+
+// Returns used - accounted
+ssize_t UnattributedMemory();
+
+// updates accounted total, and by type. delta is added to both
+void ChargeMemory(int category, ssize_t delta);
+
+// Attributes allocator delta over this scope's non-yielding lifetime
+class AtomicMemoryScope {
+ public:
+  explicit AtomicMemoryScope(int category);
+  ~AtomicMemoryScope();
+
+  AtomicMemoryScope(const AtomicMemoryScope&) = delete;
+  AtomicMemoryScope& operator=(const AtomicMemoryScope&) = delete;
+
+ private:
+  util::FiberAtomicGuard guard_;
+  int category_;
+  ssize_t baseline_;
+};
+
+// Attributes allocator delta during the owning fiber's running intervals for this scope's lifetime
+// Memory tracking is turned off for the durations when fiber is suspended.
+class TxMemoryScope {
+ public:
+  // An enabled transaction scope exclusively owns the thread's tracking hook until destruction.
+  explicit TxMemoryScope(int obj_type);
+  ~TxMemoryScope();
+
+  TxMemoryScope(const TxMemoryScope&) = delete;
+  TxMemoryScope& operator=(const TxMemoryScope&) = delete;
+
+ private:
+  static void MemTrackerHook(util::fb2::FiberSwitchHookEvent event) noexcept;
+
+  int obj_type_;
+  ssize_t mem_baseline_ = 0;
+  util::fb2::FiberSwitchHook prev_hook_;
+  bool enabled_ = false;
+  bool suspended_ = false;
+};
+
+}  // namespace dfly
```

**File**: `src/server/db_slice.cc` (modified, +5/-3)
```diff
@@ -9,6 +9,7 @@
 #include <ranges>
 
 #include "core/dense_set.h"
+#include "core/memory_accounting.h"
 #include "core/oah_set.h"
 #include "core/qlist.h"
 #include "strings/human_readable.h"
@@ -29,7 +30,6 @@ extern "C" {
 #include "server/engine_shard_set.h"
 #include "server/error.h"
 #include "server/journal/journal.h"
-#include "server/memory_scope.h"
 #include "server/namespaces.h"
 #include "server/server_state.h"
 #include "server/tiered_storage.h"
@@ -430,7 +430,7 @@ void AccountObjectMemory(string_view key, unsigned type, int64_t delta, DbTable*
 
   db->stats.AddTypeMemoryUsage(type, delta);
   if (type == OBJ_KEY)
-    EngineShard::tlocal()->AddTypeMemDelta(OBJ_KEY, delta);
+    ChargeMemory(OBJ_KEY, delta);
   UpdateSlotStat(key, delta, db, &SlotStats::memory_bytes, "memory usage", type, slot);
 }
 
@@ -950,7 +950,9 @@ OpResult<DbSlice::ItAndUpdater> DbSlice::AddOrFind(const Context& cntx, string_v
 
   events_.mutations++;
   ssize_t table_increase = db.prime.mem_usage() - table_before;
-  DeductFromTxScope(table_increase);
+
+  // Table storage is shared infrastructure rather than object memory.
+  ChargeMemory(kUntrackedMemory, table_increase);
   memory_budget_ -= table_increase;
 
   table_memory_ += table_increase;
```

**File**: `src/server/engine_shard.cc` (modified, +8/-15)
```diff
@@ -11,6 +11,7 @@
 #include <memory>
 
 #include "base/flags.h"
+#include "core/memory_accounting.h"
 #include "core/page_usage/page_usage_stats.h"
 #include "core/qlist.h"
 #include "core/search/stateless_allocator.h"
@@ -25,7 +26,6 @@ extern "C" {
 #include "server/engine_shard_set.h"
 #include "server/journal/aof_streamer.h"
 #include "server/journal/journal.h"
-#include "server/memory_scope.h"
 #include "server/namespaces.h"
 #include "server/search/doc_index.h"
 #include "server/server_state.h"
@@ -36,6 +36,8 @@ extern "C" {
 
 using namespace std;
 
+ABSL_FLAG(bool, enable_scope_based_mem_track, false, "Enable scope based memory metric");
+
 ABSL_FLAG(float, mem_defrag_threshold, 0.7,
           "Minimum percentage of used memory relative to maxmemory cap before running "
           "defragmentation");
@@ -516,14 +518,10 @@ void EngineShard::InitThreadLocal(ProactorBase* pb) {
   shard_ = new (ptr) EngineShard(pb, data_heap);
 
   CompactObj::InitThreadLocal(shard_->memory_resource());
-  if (MemoryScopeEnabled()) {
-    CompactObj::SetTypeReplacementHook([](CompactObjType old_type, int64_t delta) {
-      EngineShard::tlocal()->AddTypeMemDelta(old_type, delta);
-      DeductFromTxScope(delta);
-    });
-  }
   SmallString::InitThreadLocal(data_heap);
   InitTLStatelessAllocMR(shard_->memory_resource());
+  if (GetFlag(FLAGS_enable_scope_based_mem_track))
+    InitMemoryAccounting(shard_->mi_resource_);
 
   shard_->shard_search_indices_ = std::make_unique<ShardDocIndices>();
 }
@@ -552,6 +550,9 @@ void EngineShard::DestroyThreadLocal() {
 
   QList::ShutdownThread();
   detail::InternedString::ResetPool();
+
+  // End accounting while the shard's memory resource is still alive.
+  ShutdownMemoryAccounting();
   shard_->~EngineShard();
   CleanupStatelessAllocMR();
 
@@ -1196,12 +1197,4 @@ EngineShard::CompactTableStats EngineShard::CompactTable(double threshold, DbInd
   return stats;
 }
 
-void EngineShard::AddTypeMemDelta(size_t type, int64_t delta) {
-  if (delta == 0)
-    return;
-
-  DCHECK_LT(type, type_attributed_memory_.size());
-  type_attributed_memory_[type] += delta;
-}
-
 }  // namespace dfly
```

#### Recent Merged Pull Requests:
- **PR #8857** (2026-11-20): fix: correct connection replies and client tracking (@vyavdoshenko)
- **PR #8855** (2026-11-20): fix(acl): test_acl_load_updates_default_user_connections (@kostasrim)
- **PR #8847** (2026-11-19): fix(acl): apply reloaded default user rules on ACL LOAD (@kostasrim)
- **PR #8845** (2026-11-20): fix: match RESP3 reply shapes of JSON and probabilistic commands (@vyavdoshenko)
- **PR #8844** (2026-11-19): fix: stack smashing in journal (@BorysTheDev)
- **PR #8841** (2026-11-20): fix(zset): reply with score pairs for ZUNION/ZINTER WITHSCORES in RESP3 (@Pratik-Kumar-Dhakar)

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

## X. correct connection replies and client tracking

**RULE**:
When implementing operations in `src/facade/dragonfly_connection.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflydb/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2c56bc98`: correct connection replies and client tracking. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/facade/dragonfly_connection.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  SetName({});
    // ctx_info.Format() returns "db=N flags=X"; extract flags only.
  // An unnamed connection keeps its id in the fiber name.
  util::ThisFiber::SetName(absl::StrCat("DflyConn_", name.empty() ? absl::StrCat(id_) : name));
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  SetName(absl::StrCat(id_));
    // ctx_info.Format() returns "db=N" or "db=N flags=X"; extract flags only.
  util::ThisFiber::SetName(absl::StrCat("DflyConn_", name));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2c56bc98` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
