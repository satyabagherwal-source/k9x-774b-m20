# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: dragonflydb-dragonfly-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "dragonflydb-dragonfly-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T17:23:16.840Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dragonflydb-dragonfly-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dragonflydb-dragonfly-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T17:23:16.840Z`  
> **Learning ID**: `LEARN-EVO-dragonflydb-dragonfly-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from dragonflydb-dragonfly-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Source Version**: `c0b9d750`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T17:23:09.415Z  
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
> **Harvest Timestamp**: 2026-11-24T17:23:09.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflydb/dragonfly`
- **Description**: A modern replacement for Redis and Memcached
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 31920 stars

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

### Incident Patch 1: `9602dd5e` (2026-11-24)
**Commit Message**: fix(server): bound RDB loader allocations by the source size (#8282)

* fix(server): bound RDB loader allocations by the source size

File-based loads never set source_limit_, so every RemainingBytes()
guard was dead code: a crafted snapshot with a huge declared length
caused an uncaught bad_alloc in the load fiber. Take the size from the
opened file; cloud readers resolve it only during the first read and
are sequential, so the loader pulls the limit in right after the RDB
header instead of reading ahead.

Add the missing bounds to FetchGenericString, FetchLzfStringObject
(ratio-bounded, no absolute cap: legit snapshots carry LZF blobs
beyond 512MB, see #5313) and the stream consumer group/PEL/consumer
counts, sized by the minimum wire bytes per entry per RDB type, so
valid files - including legacy streams - are never rejected. Also
return rdb_file_corrupted instead of tripping a ReadAtLeast DCHECK
when a bounded source ends mid-entry.

* fix(server): bound remaining RDB loader allocations

Address review: bound the zstd/LZ4 frame content size by the protocol's
largest segment (kMaxCompressedBlobSize, rdb_extensions.h) before
Reserve(), reject nested/stray compressed blob opcodes 

**File**: `src/server/detail/decompress.cc` (modified, +64/-39)
```diff
@@ -19,6 +19,8 @@ using io::IoBuf;
 using rdb::errc;
 using namespace std;
 
+constexpr size_t kInitialDecompressBuffer = 64 * 1024;
+
 inline auto Unexpected(errc ev) {
   return nonstd::make_unexpected(RdbError(ev));
 }
@@ -32,13 +34,13 @@ class ZstdDecompress : public DecompressImpl {
     ZSTD_freeDCtx(dctx_);
   }
 
-  io::Result<io::IoBuf*> Decompress(std::string_view str);
+  io::Result<io::IoBuf*> Decompress(std::string_view str, size_t max_uncomp_size);
 
  private:
   ZSTD_DCtx* dctx_;
 };
 
-io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str) {
+io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str, size_t max_uncomp_size) {
   // Prepare membuf memory to uncompressed string.
   auto uncomp_size = ZSTD_getFrameContentSize(str.data(), str.size());
   if (uncomp_size == ZSTD_CONTENTSIZE_UNKNOWN) {
@@ -49,31 +51,52 @@ io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str) {
     LOG(ERROR) << "Invalid ZSTD compressed string";
     return Unexpected(errc::invalid_encoding);
   }
-
-  uncompressed_mem_buf_.Reserve(uncomp_size + 1);
-
-  // Uncompress string to membuf
-  IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
-  if (dest.size() < uncomp_size) {
-    return Unexpected(errc::out_of_memory);
+  if (uncomp_size > max_uncomp_size) {
+    LOG(ERROR) << "Zstd frame content size " << uncomp_size << " exceeds the allowed maximum";
+    return Unexpected(errc::rdb_file_corrupted);
   }
-  size_t const d_size =
-      ZSTD_decompressDCtx(dctx_, dest.data(), dest.size(), str.data(), str.size());
-  if (d_size == 0 || d_size != uncomp_size) {
+  if (uncomp_size == 0) {
     LOG(ERROR) << "Invalid ZSTD compressed string";
     return Unexpected(errc::rdb_file_corrupted);
   }
-  uncompressed_mem_buf_.CommitWrite(d_size);
 
-  // Add opcode of compressed blob end to membuf.
-  dest = uncompressed_mem_buf_.AppendBuffer();
-  if (dest.size() < 1) {
-    return Unexpected(errc::out_of_memory);
+  uncompressed_mem_buf_.Reserve(std::min<size_t>(uncomp_size + 1, kInitialDecompressBuffer));
+
+  ZSTD_inBuffer in{str.data(), str.size(), 0};
+  while (true) {
+    IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
+    if (dest.empty()) {
+      if (!GrowBuffer(uncomp_size)) {
+        LOG(ERROR) << "Zstd frame decoded past the declared content size";
+        return Unexpected(errc::rdb_file_corrupted);
+      }
+      continue;
+    }
+
+    ZSTD_outBuffer out{dest.data(), dest.size(), 0};
+    size_t prev_in = in.pos;
+    size_t ret = ZSTD_decompressStream(dctx_, &out, &in);
+    if (ZSTD_isError(ret)) {
+      LOG(ERROR) << "Invalid ZSTD compressed string: " << ZSTD_getErrorName(ret);
+      return Unexpected(errc::rdb_file_corrupted);
+    }
+    uncompressed_mem_buf_.CommitWrite(out.pos);
+
+    if (out.pos == 0 && in.pos == prev_in) {
+      LOG(ERROR) << "Zstd decompression stalled";
+      return Unexpected(errc::rdb_file_corrupted);
+    }
+
+    if (ret == 0)
+      break;
+  }
+
+  if (in.pos != in.size || uncompressed_mem_buf_.InputLen() != uncomp_size) {
+    LOG(ERROR) << "Invalid ZSTD compressed string";
+    return Unexpected(errc::rdb_file_corrupted);
   }
-  dest[0] = RDB_OPCODE_COMPRESSED_BLOB_END;
-  uncompressed_mem_buf_.CommitWrite(1);
 
-  return &uncompressed_mem_buf_;
+  return AppendEndOpcode();
 }
 
 class Lz4Decompress : public DecompressImpl {
@@ -87,13 +110,13 @@ class Lz4Decompress : public DecompressImpl {
     CHECK(!LZ4F_isError(result));
   }
 
-  io::Result<base::IoBuf*> Decompress(std::string_view str);
+  io::Result<base::IoBuf*> Decompress(std::string_view str, size_t max_uncomp_size);
 
  private:
   LZ4F_dctx* dctx_;
 };
 
-io::Result<base::IoBuf*> Lz4Decompress::Decompress(std::string_view data) {
+io::Result<base::IoBuf*> Lz4Decompress::Decompress(std::string_view data, size_t max_uncomp_size) {
   LZ4F_frameInfo_t frame_info;
   size_t frame_size = data.size();
 
@@ -103,29 +126,35 @@ io::Result<base::IoBuf*> Lz4Decompress::Decompress(std::string_view data) {
   if (LZ4F_isError(res)) {
     LOG(ERROR) << "LZ4F_getFrameInfo failed with error " << LZ4F_getErrorName(res);
     return Unexpected(errc::rdb_file_corrupted);
-    ;
   }
 
   if (frame_info.contentSize == 0) {
     LOG(ERROR) << "Missing frame content size";
     return Unexpected(errc::rdb_file_corrupted);
   }
-
-  // reserve place for uncompressed data and end opcode
-  size_t reserve = frame_info.contentSize + 1;
-  uncompressed_mem_buf_.Reserve(reserve);
-  IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
-  if (dest.size() < reserve) {
-    return Unexpected(errc::out_of_memory);
+  if (frame_info.contentSize > max_uncomp_size) {
+    LOG(ERROR) << "LZ4 frame content size " << frame_info.contentSize
+               << " exceeds the allowed maximum";
+    return Unexpected(errc::rdb_file_corrupted);
   }
 
+  uncompressed_mem_buf_.Reserve(
+      std::min<size_t>(frame_info.contentSize + 1, kInitialDecompressBuffer));
+
   // Un
```

**File**: `src/server/detail/decompress.h` (modified, +16/-1)
```diff
@@ -3,10 +3,12 @@
 //
 #pragma once
 
+#include <algorithm>
 #include <memory>
 
 #include "io/io.h"
 #include "io/io_buf.h"
+#include "server/rdb_extensions.h"
 
 namespace dfly {
 
@@ -22,10 +24,23 @@ class DecompressImpl {
   virtual ~DecompressImpl() {
   }
 
-  virtual io::Result<io::IoBuf*> Decompress(std::string_view str) = 0;
+  virtual io::Result<io::IoBuf*> Decompress(std::string_view str, size_t max_uncomp_size) = 0;
 
  protected:
   io::IoBuf uncompressed_mem_buf_;
+
+  bool GrowBuffer(size_t declared_size) {
+    if (uncompressed_mem_buf_.InputLen() >= declared_size)
+      return false;
+    uncompressed_mem_buf_.Reserve(uncompressed_mem_buf_.InputLen() + 1);
+    return !uncompressed_mem_buf_.AppendBuffer().empty();
+  }
+
+  io::IoBuf* AppendEndOpcode() {
+    uint8_t op = RDB_OPCODE_COMPRESSED_BLOB_END;
+    uncompressed_mem_buf_.WriteAndCommit(&op, 1);
+    return &uncompressed_mem_buf_;
+  }
 };
 
 }  // namespace detail
```

**File**: `src/server/rdb_extensions.h` (modified, +2/-0)
```diff
@@ -52,6 +52,8 @@ constexpr uint8_t RDB_OPCODE_COMPRESSED_ZSTD_BLOB_START = 201;
 constexpr uint8_t RDB_OPCODE_COMPRESSED_LZ4_BLOB_START = 202;
 constexpr uint8_t RDB_OPCODE_COMPRESSED_BLOB_END = 203;
 
+constexpr size_t kMaxCompressedBlobSize = 2ULL << 30;
+
 constexpr uint8_t RDB_OPCODE_JOURNAL_BLOB = 210;
 
 // A full sync will continue to send information in journal blobs until the replica
```

**File**: `src/server/rdb_load.cc` (modified, +105/-11)
```diff
@@ -1255,6 +1255,9 @@ auto RdbLoaderBase::FetchBuf(size_t size, void* dest) -> Error {
 
   next += to_copy;
 
+  if (mem_buf_ != &origin_mem_buf_)
+    return RdbError(errc::rdb_file_corrupted);
+
   if (size + bytes_read_ > source_limit_) {
     return Fail(errc::rdb_file_corrupted)
            << "out of bound read " << size + bytes_read_ << " > " << source_limit_;
@@ -1318,6 +1321,19 @@ size_t RdbLoaderBase::StrLen(const RdbVariant& tset) {
   return 0;
 }
 
+bool RdbLoaderBase::ExceedsRemainingInput(uint64_t n, std::string_view what,
+                                          size_t min_entry_bytes) {
+  DCHECK_GT(min_entry_bytes, 0u);
+  size_t remaining = RemainingBytes();
+  if (remaining == SIZE_MAX)
+    return false;
+  if (n > remaining / min_entry_bytes) {
+    LOG(ERROR) << "Bad " << what << " " << n << ", exceeds remaining input " << remaining;
+    return true;
+  }
+  return false;
+}
+
 auto RdbLoaderBase::FetchGenericString() -> io::Result<string> {
   bool isencoded;
   size_t len;
@@ -1338,6 +1354,10 @@ auto RdbLoaderBase::FetchGenericString() -> io::Result<string> {
     }
   }
 
+  if (ExceedsRemainingInput(len, "string length")) {
+    return Unexpected(errc::rdb_file_corrupted);
+  }
+
   string res;
 
   if (len > 0) {
@@ -1360,11 +1380,18 @@ auto RdbLoaderBase::FetchLzfStringObject() -> io::Result<string> {
   SET_OR_UNEXPECT(LoadLen(NULL), clen);
   SET_OR_UNEXPECT(LoadLen(NULL), len);
 
-  // TODO serialization and deserialization for data > 512 MB should be done via chunks
   if (len <= clen || clen == 0) {
     LOG(ERROR) << "Bad compressed string";
     return Unexpected(rdb::rdb_file_corrupted);
   }
+  constexpr uint64_t kMaxLzfExpansion = 128;
+  if (len / kMaxLzfExpansion > clen) {
+    LOG(ERROR) << "Bad uncompressed length " << len << " for compressed length " << clen;
+    return Unexpected(errc::rdb_file_corrupted);
+  }
+  if (ExceedsRemainingInput(clen, "compressed length")) {
+    return Unexpected(errc::rdb_file_corrupted);
+  }
 
   if (mem_buf_->InputLen() >= clen) {
     cbuf = mem_buf_->InputBuffer().data();
@@ -2042,8 +2069,16 @@ auto RdbLoaderBase::ReadStreams(int rdbtype) -> io::Result<OpaqueObj> {
   }
 
   /* Consumer groups loading */
+  constexpr size_t kMinCgroupWireBytes = 5;
+  constexpr size_t kMinPelWireBytes = 25;
+  constexpr size_t kMinConsumerWireBytes = 10;
+  constexpr size_t kMinNackWireBytes = 16;
+
   uint64_t cgroups_count;
   SET_OR_UNEXPECT(LoadLen(nullptr), cgroups_count);
+  if (ExceedsRemainingInput(cgroups_count, "stream cgroups count", kMinCgroupWireBytes)) {
+    return Unexpected(errc::rdb_file_corrupted);
+  }
   load_trace->stream_trace->cgroup.resize(cgroups_count);
 
   for (size_t i = 0; i < cgroups_count; ++i) {
@@ -2075,6 +2110,9 @@ auto RdbLoaderBase::ReadStreams(int rdbtype) -> io::Result<OpaqueObj> {
     uint64_t pel_size;
     SET_OR_UNEXPECT(LoadLen(nullptr), pel_size);
 
+    if (ExceedsRemainingInput(pel_size, "stream pel count", kMinPelWireBytes)) {
+      return Unexpected(errc::rdb_file_corrupted);
+    }
     cgroup.pel_arr.resize(pel_size);
 
     for (size_t j = 0; j < pel_size; ++j) {
@@ -2093,6 +2131,9 @@ auto RdbLoaderBase::ReadStreams(int rdbtype) -> io::Result<OpaqueObj> {
      * consumers and their local PELs. */
     uint64_t consumers_num;
     SET_OR_UNEXPECT(LoadLen(nullptr), consumers_num);
+    if (ExceedsRemainingInput(consumers_num, "stream consumers count", kMinConsumerWireBytes)) {
+      return Unexpected(errc::rdb_file_corrupted);
+    }
     cgroup.cons_arr.resize(consumers_num);
 
     for (size_t j = 0; j < consumers_num; ++j) {
@@ -2113,6 +2154,9 @@ auto RdbLoaderBase::ReadStreams(int rdbtype) -> io::Result<OpaqueObj> {
       /* Load the PEL about entries owned by this specific
        * consumer. */
       SET_OR_UNEXPECT(LoadLen(nullptr), pel_size);
+      if (ExceedsRemainingInput(pel_size, "stream consumer pel count", kMinNackWireBytes)) {
+        return Unexpected(errc::rdb_file_corrupted);
+      }
       consumer.nack_arr.resize(pel_size);
       for (size_t k = 0; k < pel_size; ++k) {
         auto& nack = consumer.nack_arr[k];
@@ -2286,6 +2330,9 @@ auto RdbLoaderBase::ReadSBFImpl(bool filter_is_chunked) -> io::Result<OpaqueObj>
       SET_OR_UNEXPECT(LoadLen(nullptr), total_size);
       if (total_size == 0)
         return Unexpected(errc::rdb_file_corrupted);
+      if (ExceedsRemainingInput(total_size, "sbf filter size")) {
+        return Unexpected(errc::rdb_file_corrupted);
+      }
 
       // This size is fixed and never changes. It acts as a limit of how much to read.
       filter_data.resize(total_size);
@@ -2361,6 +2408,8 @@ auto RdbLoaderBase::ReadTOPK() -> io::Result<OpaqueObj> {
   // Validate heap size doesn't exceed k (max items we track)
   if (heap_size > k)
     return Unexpected(errc::rdb_file_corrupted);
+  if (ExceedsRemainingInput(heap_size, "topk heap size", 2))
+    return Unexpected(errc::rdb_file_corrupted);
 
   res.heap_items.reserve(heap_size);

```

**File**: `src/server/rdb_load.h` (modified, +9/-1)
```diff
@@ -3,6 +3,7 @@
 //
 #pragma once
 
+#include <functional>
 #include <source_location>
 #include <system_error>
 
@@ -286,7 +287,9 @@ class RdbLoaderBase {
 
   Error EnsureReadInternal(size_t min_to_read);
 
-  // Upper bound on bytes a bounded source can still supply; SIZE_MAX when unbounded (file load).
+  bool ExceedsRemainingInput(uint64_t n, std::string_view what, size_t min_entry_bytes = 1);
+
+  // Upper bound on bytes a bounded source can still supply; SIZE_MAX when no limit is set.
   // Used to reject a declared length/count before allocating for it (a crafted RESTORE OOM).
   size_t RemainingBytes() const {
     if (source_limit_ == SIZE_MAX)
@@ -325,6 +328,7 @@ class RdbLoaderBase {
 
   size_t bytes_read_ = 0;
   size_t source_limit_ = SIZE_MAX;
+  std::function<size_t()> size_provider_;
   base::PODArray<uint8_t> compr_buf_;
   std::unique_ptr<detail::DecompressImpl> decompress_impl_;
   std::optional<uint64_t> journal_offset_ = std::nullopt;
@@ -374,6 +378,10 @@ class RdbLoader : protected RdbLoaderBase {
     source_limit_ = n;
   }
 
+  void set_source_size_provider(std::function<size_t()> provider) {
+    size_provider_ = std::move(provider);
+  }
+
   ::io::Bytes Leftover() const {
     return mem_buf_->InputBuffer();
   }
```

**File**: `src/server/rdb_test.cc` (modified, +484/-9)
```diff
@@ -11,15 +11,19 @@ extern "C" {
 #include "redis/zmalloc.h"
 }
 
+#include <absl/cleanup/cleanup.h>
 #include <absl/flags/reflection.h>
+#include <lz4frame.h>
 #include <mimalloc.h>
 #include <sys/resource.h>
+#include <zstd.h>
 
 #include <filesystem>
 #include <fstream>
 
 #include "base/flags.h"
 #include "base/gtest.h"
+#include "base/hash.h"
 #include "base/logging.h"
 #include "core/bloom.h"
 #include "core/cuckoo.h"
@@ -127,6 +131,16 @@ class RdbTest : public BaseFamilyTest {
       return loader.Load(&src);
     });
   }
+
+  std::error_code LoadRdbBounded(const std::string& rdb) {
+    return pp_->at(0)->Await([&] {
+      io::BytesSource src{io::Buffer(rdb)};
+      RdbLoadContext load_context;
+      RdbLoader loader(service_.get(), &load_context);
+      loader.set_source_limit(rdb.size());
+      return loader.Load(&src);
+    });
+  }
 };
 
 void RdbTest::SetUp() {
@@ -2207,6 +2221,476 @@ void AddKV(std::string* out, std::string_view key, std::string_view val) {
   AppendString(out, val);
 }
 
+void AppendDbHeader(std::string* body) {
+  body->push_back(static_cast<char>(RDB_OPCODE_SELECTDB));
+  AppendLen(body, 0);
+  body->push_back(static_cast<char>(RDB_OPCODE_RESIZEDB));
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+}
+
+void AppendBinaryDouble(std::string* out, double val) {
+  uint64_t bits;
+  memcpy(&bits, &val, sizeof(bits));
+
+  uint8_t buf[8];
+  absl::little_endian::Store64(buf, bits);
+  out->append(reinterpret_cast<const char*>(buf), sizeof(buf));
+}
+
+TEST_F(RdbTest, LoadRejectsHugeDeclaredLength) {
+  string body;
+  AppendDbHeader(&body);
+  body.push_back(static_cast<char>(RDB_TYPE_STRING));
+  AppendLen(&body, 1ULL << 60);
+
+  const string rdb_file = absl::StrCat("rdb_sourcelimit_", getpid(), ".rdb");
+  io::WriteStringToFileOrDie(WrapInRdb(body), rdb_file);
+  auto cleanup = absl::MakeCleanup([&] { unlink(rdb_file.c_str()); });
+
+  auto fut = service_->server_family().Load(rdb_file, ServerFamily::LoadExistingKeys::kFail);
+  ASSERT_TRUE(fut.has_value());
+  auto err = static_cast<std::error_code>(fut->Get());
+
+  EXPECT_EQ(err, RdbError(rdb::errc::rdb_file_corrupted));
+}
+
+TEST_F(RdbTest, LoadRejectsTruncatedFile) {
+  string body;
+  body.push_back(static_cast<char>(RDB_OPCODE_SELECTDB));
+  AppendLen(&body, 0);
+  string rdb = WrapInRdb(body);
+  rdb.resize(rdb.size() - 9);
+
+  EXPECT_EQ(LoadRdbBounded(rdb), RdbError(rdb::errc::rdb_file_corrupted));
+}
+
+TEST_F(RdbTest, LoadRejectsHugeLzfKey) {
+  string body;
+  AppendDbHeader(&body);
+  body.push_back(static_cast<char>(RDB_TYPE_STRING));
+  body.push_back(static_cast<char>((RDB_ENCVAL << 6) | RDB_ENC_LZF));
+  AppendLen(&body, 1);
+  AppendLen(&body, 1ULL << 60);
+  body.push_back('\x00');
+
+  EXPECT_EQ(LoadRdbBounded(WrapInRdb(body)), RdbError(rdb::errc::rdb_file_corrupted));
+}
+
+TEST_F(RdbTest, LoadRejectsHugeLzfCompressedLength) {
+  string body;
+  AppendDbHeader(&body);
+  body.push_back(static_cast<char>(RDB_TYPE_STRING));
+  body.push_back(static_cast<char>((RDB_ENCVAL << 6) | RDB_ENC_LZF));
+  AppendLen(&body, 500);
+  AppendLen(&body, 1000);
+
+  EXPECT_EQ(LoadRdbBounded(WrapInRdb(body)), RdbError(rdb::errc::rdb_file_corrupted));
+}
+
+void AppendEmptyStreamValue(std::string* body) {
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+  AppendLen(body, 0);
+}
+
+TEST_F(RdbTest, LoadRejectsHugeStreamCgroupsCount) {
+  string body;
+  AppendDbHeader(&body);
+  body.push_back(static_cast<char>(RDB_TYPE_STREAM_LISTPACKS_3));
+  AppendString(&body, "k");
+  AppendEmptyStreamValue(&body);
+  AppendLen(&body, 1ULL << 60);
+
+  EXPECT_EQ(LoadRdbBounded(WrapInRdb(body)), RdbError(rdb::errc::rdb_file_corrupted));
+}
+
+TEST_F(RdbTest, LoadRejectsHugeStreamPelCount) {
+  string body;
+  AppendDbHeader(&body);
+  body.push_back(static_cast<char>(RDB_TYPE_STREAM_LISTPACKS_3));
+  AppendString(&body, "k");
+  AppendEmptyStreamValue(&body);
+  AppendLen(&body, 1);
+  AppendString(&body, "");
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 1ULL << 60);
+
+  EXPECT_EQ(LoadRdbBounded(WrapInRdb(body)), RdbError(rdb::errc::rdb_file_corrupted));
+}
+
+void AppendInt64(std::string* out, int64_t val) {
+  uint8_t buf[8];
+  absl::little_endian::Store64(buf, static_cast<uint64_t>(val));
+  out->append(reinterpret_cast<const char*>(buf), sizeof(buf));
+}
+
+TEST_F(RdbTest, LoadAcceptsLegacyStream) {
+  string body;
+  AppendDbHeader(&body);
+  body.push_back(static_cast<char>(RDB_TYPE_STREAM_LISTPACKS));
+  AppendString(&body, "k");
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 1);
+  AppendString(&body, "g");
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 0);
+  AppendLen(&body, 2);
+  AppendString(&body, "a");
+  AppendInt64(&body, 0);
+  AppendLen(&body, 0
```

**File**: `src/server/server_family.cc` (modified, +1/-0)
```diff
@@ -2188,6 +2188,7 @@ std::error_code ServerFamily::LoadRdb(const std::string& rdb_file, LoadExistingK
 
     RdbLoader loader{&service_, load_context, filt_snapshot_id};
     loader.SetShardCount(load_opts->shard_count);
+    loader.set_source_size_provider([file = res.value()] { return file->Size(); });
     if (existing_keys == LoadExistingKeys::kOverride) {
       loader.SetOverrideExistingKeys(true);
     }
```

---

### Incident Patch 2: `a26b5651` (2026-11-24)
**Commit Message**: fix: bump helio (#8873)

Signed-off-by: Volodymyr Yavdoshenko <[REDACTED_EMAIL]>

**File**: `helio` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 59a4e2562c6a616e46c09c3342faeba3eeea44b8
+Subproject commit 4a76e32aadc606344d37faa77f1b25bc0a593e0f
```

---

### Incident Patch 3: `101047d3` (2026-11-24)
**Commit Message**: fix(lua): clear redis.call callback after EVAL and protect error handler (#8866)

* fix(lua): clear redis.call callback after EVAL and protect error handler

Clear the stale redis.call callback (which captures the request's
CommandContext) when EVAL finishes, so __gc finalizers run later by
SCRIPT FLUSH cannot reach a dead context. Move __redis__err__handler
into the Lua registry so scripts can not replace it, and guard against
a non-string error result in RunFunction.

Signed-off-by: Vladislav Oleshko <[REDACTED_EMAIL]>

**File**: `src/core/interpreter.cc` (modified, +11/-4)
```diff
@@ -290,6 +290,8 @@ bool RedisTranslator::HasError() {
   return has_error_;
 }
 
+constexpr const char kErrHandlerKey[] = "__dfly_err_handler";
+
 void RunSafe(lua_State* lua, string_view buf, const char* name) {
   CHECK_EQ(0, luaL_loadbuffer(lua, buf.data(), buf.size(), name));
   int err = lua_pcall(lua, 0, 0, 0);
@@ -420,7 +422,7 @@ void InitLua(lua_State* lua) {
   {
     constexpr char errh_func[] =
         "local dbg = debug\n"
-        "function __redis__err__handler(err)\n"
+        "return function(err)\n"
         "  local i = dbg.getinfo(2,'nSl')\n"
         "  if i and i.what == 'C' then\n"
         "    i = dbg.getinfo(3,'nSl')\n"
@@ -431,7 +433,10 @@ void InitLua(lua_State* lua) {
         "    return err\n"
         "  end\n"
         "end\n";
-    RunSafe(lua, errh_func, "@err_handler_def");
+    // Keep the handler in the registry so scripts can not replace it.
+    CHECK_EQ(0, luaL_loadbuffer(lua, errh_func, sizeof(errh_func) - 1, "@err_handler_def"));
+    CHECK_EQ(0, lua_pcall(lua, 0, 1, 0));
+    lua_setfield(lua, LUA_REGISTRYINDEX, kErrHandlerKey);
   }
 
   {
@@ -869,7 +874,7 @@ auto Interpreter::RunFunction(string_view sha, std::string* error) -> RunResult
 
   DCHECK_EQ(40u, sha.size());
 
-  lua_getglobal(lua_, "__redis__err__handler");
+  lua_getfield(lua_, LUA_REGISTRYINDEX, kErrHandlerKey);
   char fname[43];
   fname[0] = 'f';
   fname[1] = '_';
@@ -903,7 +908,8 @@ auto Interpreter::RunFunction(string_view sha, std::string* error) -> RunResult
   }
 
   if (err) {
-    *error = lua_tostring(lua_, -1);
+    const char* msg = lua_isstring(lua_, -1) ? lua_tostring(lua_, -1) : nullptr;
+    *error = msg ? msg : "unknown script error";
   }
 
   return err == 0 ? RUN_OK : RUN_ERR;
@@ -1324,6 +1330,7 @@ inline __attribute__((always_inline)) auto Interpreter::SerializeResultInternal(
 
 void Interpreter::ResetStack() {
   lua_settop(lua_, 0);
+  redis_func_ = nullptr;
 }
 
 int64_t Interpreter::RunGC() {
```

**File**: `src/core/interpreter.h` (modified, +2/-0)
```diff
@@ -155,6 +155,8 @@ class Interpreter {
   // Same as above with a budget of max_elements.
   void SerializeResult(ObjectExplorer* serializer, size_t max_elements);
 
+  // Resets the stack and drops the redis.call callback, which captures per-request state
+  // and must not outlive the script run (e.g. be invoked from __gc finalizers).
   void ResetStack();
 
   // run gc and returns size of freed memory in bytes
```

**File**: `src/core/interpreter_test.cc` (modified, +14/-1)
```diff
@@ -1266,6 +1266,19 @@ TEST_F(InterpreterTest, ResetRetiresOnlyBorrowed) {
   EXPECT_EQ(InterpreterManager::tl_stats().interpreter_cnt, before);
 }
 
+TEST_F(InterpreterTest, ErrorHandlerNotReplaceable) {
+  EXPECT_FALSE(Execute("__redis__err__handler = function() return {} end return 1"));
+  EXPECT_FALSE(Execute("error('boom')"));
+  EXPECT_THAT(error_, testing::HasSubstr("boom"));
+}
+
+TEST_F(InterpreterTest, ClearedRedisFunc) {
+  intptr_.SetRedisFunc([](auto ca) { ca.translator->OnStatus("OK"); });
+  intptr_.ResetStack();
+  EXPECT_FALSE(Execute("return redis.call('get', 'x')"));
+  EXPECT_THAT(error_, testing::HasSubstr("redis function not defined"));
+}
+
 TEST_F(InterpreterTest, UsedBytesDropsWithInterpreter) {
   const uint64_t before = InterpreterManager::tl_stats().used_bytes;
   InterpreterManager im(2);
@@ -1367,7 +1380,6 @@ static void BM_LuaXReadReply(benchmark::State& state) {
   script += ")";
 
   Interpreter intptr;
-  intptr.SetRedisFunc([&](Interpreter::CallArgs ca) { emit_reply(ca.translator); });
   auto sha_buf = Interpreter::FuncSha1(script);
   string_view sha{sha_buf.data(), sha_buf.size()};
   string error;
@@ -1376,6 +1388,7 @@ static void BM_LuaXReadReply(benchmark::State& state) {
   CountingSerializer reply_size, ser;
   emit_reply(&reply_size);
   for (auto _ : state) {
+    intptr.SetRedisFunc([&](Interpreter::CallArgs ca) { emit_reply(ca.translator); });
     CHECK_EQ(Interpreter::RUN_OK, intptr.RunFunction(sha, &error)) << error;
     intptr.SerializeResult(&ser);
     intptr.ResetStack();  // RunFunction leaves the error handler on the stack
```

#### Recent Merged Pull Requests:
- **PR #8873** (2026-11-24): fix: bump helio (@vyavdoshenko)
- **PR #8871** (2026-11-23): chore: update helio to abseil 20260817.0 (@vyavdoshenko)
- **PR #8870** (2026-11-23): fix(zset): handle lex sentinel bounds and unchanged scores in SortedMap (@romange)
- **PR #8866** (2026-11-24): fix(lua): clear redis.call callback after EVAL and protect error handler (@dranikpg)
- **PR #8865** (2026-11-23): fix(lua): port Valkey security fixes and lock the global environment (@romange)
- **PR #8862** (2026-11-22): fix(tests): expect the bare user name from ACL WHOAMI in ExternalAuth (@vyavdoshenko)

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

## X. server): bound RDB loader allocations by the source size

**RULE**:
When implementing operations in `src/server/detail/decompress.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflydb/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9602dd5e`: server): bound RDB loader allocations by the source size. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/server/detail/decompress.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
constexpr size_t kInitialDecompressBuffer = 64 * 1024;

  io::Result<io::IoBuf*> Decompress(std::string_view str, size_t max_uncomp_size);
io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str, size_t max_uncomp_size) {
  if (uncomp_size > max_uncomp_size) {
    LOG(ERROR) << "Zstd frame content size " << uncomp_size << " exceeds the allowed maximum";
    return Unexpected(errc::rdb_file_corrupted);
  if (uncomp_size == 0) {
  uncompressed_mem_buf_.Reserve(std::min<size_t>(uncomp_size + 1, kInitialDecompressBuffer));

  ZSTD_inBuffer in{str.data(), str.size(), 0};
  while (true) {
    IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
    if (dest.empty()) {
      if (!GrowBuffer(uncomp_size)) {
        LOG(ERROR) << "Zstd frame decoded past the declared content size";
        return Unexpected(errc::rdb_file_corrupted);
      }
      continue;
    }

    ZSTD_outBuffer out{dest.data(), dest.size(), 0};
    size_t prev_in = in.pos;
    size_t ret = ZSTD_decompressStream(dctx_, &out, &in);
    if (ZSTD_isError(ret)) {
      LOG(ERROR) << "Invalid ZSTD compressed string: " << ZSTD_getErrorName(ret);
      return Unexpected(errc::rdb_file_corrupted);
    }
    
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  io::Result<io::IoBuf*> Decompress(std::string_view str);
io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str) {

  uncompressed_mem_buf_.Reserve(uncomp_size + 1);

  // Uncompress string to membuf
  IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
  if (dest.size() < uncomp_size) {
    return Unexpected(errc::out_of_memory);
  size_t const d_size =
      ZSTD_decompressDCtx(dctx_, dest.data(), dest.size(), str.data(), str.size());
  if (d_size == 0 || d_size != uncomp_size) {
  uncompressed_mem_buf_.CommitWrite(d_size);
  // Add opcode of compressed blob end to membuf.
  dest = uncompressed_mem_buf_.AppendBuffer();
  if (dest.size() < 1) {
    return Unexpected(errc::out_of_memory);
  dest[0] = RDB_OPCODE_COMPRESSED_BLOB_END;
  uncompressed_mem_buf_.CommitWrite(1);
  return &uncompressed_mem_buf_;
  io::Result<base::IoBuf*> Decompress(std::string_view str);
io::Result<base::IoBuf*> Lz4Decompress::Decompress(std::string_view data) {
    ;

  // reserve place for uncompressed data and end opcode
  size_t reserve = frame_info.contentSize + 1;
  uncompressed_mem_buf_.Reserve(reserve);
  IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
  if (dest.s
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9602dd5e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
