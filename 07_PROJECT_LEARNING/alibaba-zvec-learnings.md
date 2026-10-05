# Forensic Learning Record (Deep Inspection): alibaba/zvec

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:54.566Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/zvec`
- **Description**: A lightweight, lightning-fast, in-process vector database
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 16063 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/zvec/tool/util.py`
```
# Copyright 2025-present the zvec project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
from __future__ import annotations

import importlib
from typing import Any, Optional


def require_module(module: str, mitigation: Optional[str] = None) -> Any:
    """Import a Python module and raise a user-friendly error if it is not available.

    This utility helps provide actionable error messages when optional dependencies
    are missing. It attempts to import the given module and, on failure, suggests
    a `pip install` command based on either the module name or an optional
    mitigation package name.

    Args:
        module (str): The full module name to import (e.g., ``"numpy"``, ``"pandas.io.parquet"``).
        mitigation (Optional[str], optional): The package name to suggest for installation
            if the import fails. If not provided, the top-level package of `module`
            will be used (e.g., ``"pandas"`` for ``"pandas.io.parquet"``).

    Returns:
        Any: The imported module object.

    Raises:
        ImportError: If the module cannot be imported, with a clear installation hint.

    Examples:
        >>> import zvec
        >>> np = zvec.require_module("numpy")
        >>> pq = zvec.require_module("pyarrow.parquet", mitigation="pyarrow")

    Note:
        This function is intended for lazy-loading optional dependencies
        with helpful error messages, not for core dependencies.
    """
    try:
        return importlib.import_module(module)
    except ImportError as e:
        package = mitigation or module
        msg = f"Required package '{package}' is not installed. "
        if "." in module:
            top_level = module.split(".", maxsplit=1)[0]
            msg += f"Module '{module}' is part of '{top_level}', "
            if mitigation:
                msg += f"please pip install '{mitigation}'."
            else:
                msg += f"please pip install '{top_level}'."
        else:
            msg += f"Please pip install '{package}'."
        raise ImportError(msg) from e

```

### Core Architecture Module: `src/ailego/utility/bit_string_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <vector>
#include <zvec/ailego/internal/platform.h>

namespace zvec {

namespace ailego {

class BitStringWriter {
 public:
  BitStringWriter(uint8_t *buffer, size_t buffer_size)
      : buffer_(buffer), buffer_size_(buffer_size), offset_(0) {
    ::memset(buffer_, 0, buffer_size_);
  }

  bool write(uint64_t data, int nbit) {
    if (buffer_size_ * 8 < nbit + offset_) {
      return false;
    }

    int bits_remain = 8 - (offset_ & 7);

    if (nbit <= bits_remain) {
      buffer_[offset_ >> 3] |= data << (offset_ & 7);
      offset_ += nbit;
    } else {
      size_t j = offset_ >> 3;
      buffer_[j++] |= data << (offset_ & 7);
      offset_ += nbit;
      data >>= bits_remain;
      while (data != 0) {
        buffer_[j++] |= data;
        data >>= 8;
      }
    }

    return true;
  }

  size_t offset() {
    return offset_;
  }

 private:
  uint8_t *buffer_;
  size_t buffer_size_;
  size_t offset_;
};

class BitStringReader {
 public:
  BitStringReader(const uint8_t *buffer, size_t buffer_size)
      : buffer_(buffer), buffer_size_(buffer_size), offset_(0) {}

  bool read(uint64_t &data, int nbit) {
    if (buffer_size_ * 8 < nbit + offset_) {
      return false;
    }

    int bits_remain = 8 - (offset_ & 7);

    uint64_t result = buffer_[offset_ >> 3] >> (offset_ & 7);
    if (nbit <= bits_remain) {
      result &= (1 << nbit) - 1;
      offset_ += nbit;

      data = result;
    } else {
      int temp = bits_remain;
      size_t i = (offset_ >> 3) + 1;
      offset_ += nbit;
      nbit -= bits_remain;

      while (nbit > 8) {
        result |= ((uint64_t)buffer_[i++]) << temp;
        temp += 8;
        nbit -= 8;
      }

      uint64_t last_byte = buffer_[i];

      last_byte &= (1 << nbit) - 1;
      result |= last_byte << temp;

      data = result;
    }

    return true;
  }

  size_t offset() {
    return offset_;
  }

 private:
  const uint8_t *buffer_;
  size_t buffer_size_;
  size_t offset_;
};

}  // namespace ailego

}  // namespace zvec

```

### Core Architecture Module: `src/ailego/utility/bitset_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <vector>
#include <zvec/ailego/internal/platform.h>

namespace zvec {

namespace ailego {

/*! Bitset Helper
 */
class BitsetHelper {
 public:
  //! Constructor
  BitsetHelper() = default;

  //! Constructor
  BitsetHelper(void *buf, size_t len)
      : array_(reinterpret_cast<uint32_t *>(buf)),
        size_(len / sizeof(uint32_t)) {}

  //! Mount a buffer as bitset
  void mount(void *buf, size_t len) {
    array_ = reinterpret_cast<uint32_t *>(buf);
    size_ = len / sizeof(uint32_t);
  }

  //! Umount the buffer
  void umount() {
    array_ = nullptr;
    size_ = 0u;
  }

  // ！Clear the bitset
  void clear() {
    memset(array_, 0, sizeof(uint32_t) * size_);
  }

  //! Test a bit in bitset
  bool test(size_t num) const {
    ailego_assert_with((size_ << 5) > num, "overflow argument");
    return ((array_[num >> 5] & (1u << (num & 0x1f))) != 0);
  }

  //! Set a bit in bitset
  void set(size_t num) {
    ailego_assert_with((size_ << 5) > num, "overflow argument");
    uint32_t mask = (1u << (num & 0x1f));
    array_[num >> 5] |= mask;
  }

  //! Reset a bit in bitset
  void reset(size_t num) {
    ailego_assert_with((size_ << 5) > num, "overflow argument");
    uint32_t mask = (1u << (num & 0x1f));
    array_[num >> 5] &= ~mask;
  }

  //! Toggle a bit in bitset
  void flip(size_t num) {
    ailego_assert_with((size_ << 5) > num, "overflow argument");
    uint32_t mask = (1u << (num & 0x1f));
    array_[num >> 5] ^= mask;
  }

  //! Extract the bitset to an array
  void extract(size_t base, std::vector<size_t> *out) const {
    const uint32_t *iter = array_;
    const uint32_t *last = array_ + size_;

    for (; iter != last; ++iter) {
      uint32_t w = *iter;

      while (w != 0) {
        uint32_t c = ailego_ctz32(w);
        w &= ~(1u << c);
        out->push_back(base + c);
      }
      base += 32u;
    }
  }

  //! Extract the bitset to an array
  void extract(std::vector<size_t> *out) const {
    this->extract(0, out);
  }

  //! Check if all bits are set to true
  bool test_all() const;

  //! Check if any bits are set to true
  bool test_any() const;

  //! Check if none of the bits are set to true
  bool test_none() const;

  //! Compute the cardinality of a bitset
  size_t cardinality() const;

  //! Calculate the size of buffer if it contains N bits
  static size_t BufferSize(size_t n) {
    return (((n + 0x1f) >> 5) << 2);
  }

  //! Calculate the count of bits can be contained
  static size_t BitsCount(size_t len) {
    return ((len >> 2) << 2);
  }

  //! Check if all bits are set to true
  static bool TestAll(const uint32_t *arr, size_t size);

  //! Check if cube bits are set to true
  static bool TestAny(const uint32_t *arr, size_t size);

  //! Check if none of the bits are set to true
  static bool TestNone(const uint32_t *arr, size_t size);

  //! Compute the AND cardinality between two bitsets
  static size_t BitwiseAndCardinality(const uint32_t *lhs, const uint32_t *rhs,
                                      size_t size);

  //! Compute the OR cardinality between two bitsets
  static size_t BitwiseOrCardinality(const uint32_t *lhs, const uint32_t *rhs,
                                     size_t size);

  //! Compute the ANDNOT cardinality between two bitsets
  static size_t BitwiseAndnotCardinality(const uint32_t *lhs,
                                         const uint32_t *rhs, size_t size);

  //! Compute the XOR cardinality between two bitsets
  static size_t BitwiseXorCardinality(const uint32_t *lhs, const uint32_t *rhs,
                                      size_t size);

  //! Compute the cardinality of a bitset
  static size_t Cardinality(const uint32_t *arr, size_t size);

  //! Perform binary AND
  static void BitwiseAnd(uint32_t *lhs, const uint32_t *rhs, size_t size);

  //! Perform binary AND_NOT
  static void BitwiseAndnot(uint32_t *lhs, const uint32_t *rhs, size_t size);

  //! Perform binary OR
  static void BitwiseOr(uint32_t *lhs, const uint32_t *rhs, size_t size);

  //! Perform binary XOR
  static void BitwiseXor(uint32_t *lhs, const uint32_t *rhs, size_t size);

  //! Perform binary NOT
  static void BitwiseNot(uint32_t *arr, size_t size);

 private:
  uint32_t *array_{nullptr};
  size_t size_{0u};
};

}  // namespace ailego

}  // namespace zvec

```

### Core Architecture Module: `src/ailego/utility/concurrency_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <cstdint>

namespace zvec {
namespace ailego {

class ConcurrencyHelper {
 public:
  ConcurrencyHelper();

  //! get hardware concurrency from either vm or container
  static uint32_t container_aware_concurrency();

 private:
  uint32_t concurrency_{0};
};

}  // namespace ailego
}  // namespace zvec
```

### Core Architecture Module: `src/ailego/utility/dl_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <string>
#include <zvec/ailego/internal/platform.h>

namespace zvec {
namespace ailego {

/*! Dynamic Library Helper
 */
struct DLHelper {
  //! Load library from path
  static void *Load(const char *path, std::string *err);

  //! Unload a library
  static void Unload(void *handle);

  //! Retrieve a symbol from a library handle
  static void *Symbol(void *handle, const char *symbol);

  //! Load library from path
  static void *Load(const std::string &path, std::string *err) {
    return DLHelper::Load(path.c_str(), err);
  }

  //! Retrieve a symbol from a library handle
  static void *Symbol(void *handle, const std::string &symbol) {
    return DLHelper::Symbol(handle, symbol.c_str());
  }
};

}  // namespace ailego
}  // namespace zvec

```

### Core Architecture Module: `src/ailego/utility/math_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <array>
#include <cmath>
#include <limits>
#include <type_traits>
#include <zvec/ailego/utility/float_helper.h>
namespace zvec {
namespace ailego {

/*! Math Helper
 */
struct MathHelper {
  //! Calculate the absolute value
  template <typename T, typename R = float>
  static inline auto Absolute(const T &x) ->
      typename std::enable_if<std::is_arithmetic<T>::value, R>::type {
    return static_cast<R>(std::abs(x));
  }

  //! Calculate the absolute value
  template <typename R = float>
  static inline R Absolute(const Float16 &x) {
    return static_cast<R>(Float16::Absolute(x));
  }

  //! Calculate the absolute difference
  template <typename T, typename R = float>
  static inline auto AbsoluteDifference(const T &x, const T &y) ->
      typename std::enable_if<std::is_integral<T>::value, R>::type {
    auto m = ((x ^ y) & -(x < y));
    auto d =
        static_cast<typename std::make_unsigned<T>::type>((x ^ m) - (y ^ m));
    return static_cast<R>(d);
  }

  //! Calculate the absolute difference
  template <typename T, typename R = float>
  static inline auto AbsoluteDifference(const T &x, const T &y) ->
      typename std::enable_if<std::is_floating_point<T>::value, R>::type {
    return static_cast<R>(std::abs(x - y));
  }

  //! Calculate the absolute difference
  template <typename R = float>
  static inline R AbsoluteDifference(const Float16 &x, const Float16 &y) {
    return static_cast<R>(std::abs(x - y));
  }

  //! Calculate the squared difference
  template <typename T, typename R = float>
  static inline auto SquaredDifference(const T &x, const T &y) ->
      typename std::enable_if<std::is_integral<T>::value, R>::type {
    auto m = ((x ^ y) & -(x < y));
    auto d =
        static_cast<typename std::make_unsigned<T>::type>((x ^ m) - (y ^ m));
    return static_cast<R>(d * d);
  }

  //! Calculate the squared difference
  template <typename T, typename R = float>
  static inline auto SquaredDifference(const T &x, const T &y) ->
      typename std::enable_if<std::is_floating_point<T>::value, R>::type {
    auto d = x - y;
    return static_cast<R>(d * d);
  }

  //! Calculate the squared difference
  template <typename R = float>
  static inline R SquaredDifference(const Float16 &x, const Float16 &y) {
    auto d = x - y;
    return static_cast<R>(d * d);
  }

  //! Test whether two integral numbers are equal
  template <class T>
  static inline auto IsAlmostEqual(const T &x, const T &y, int) ->
      typename std::enable_if<std::is_integral<T>::value, bool>::type {
    return (x == y);
  }

  //! Test whether two floating point numbers are equal
  template <class T>
  static inline auto IsAlmostEqual(const T &x, const T &y, int ulp) ->
      typename std::enable_if<std::is_floating_point<T>::value, bool>::type {
    // the machine epsilon has to be scaled to the magnitude of the values used
    // and multiplied by the desired precision in ULPs (units in the last place)
    return ((std::fabs(x - y) <=
             std::numeric_limits<T>::epsilon() * std::fabs(x + y) * ulp) ||
            (std::fabs(x - y) < std::numeric_limits<T>::min()));
  }
};

}  // namespace ailego
}  // namespace zvec

```

### Core Architecture Module: `src/ailego/utility/matrix_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <zvec/ailego/internal/platform.h>

namespace zvec {
namespace ailego {

struct MatrixHelper {
  //! Transpose a matrix
  template <typename T, size_t M>
  static inline void Transpose(const void *src, size_t n, void *dst) {
    for (size_t i = 0; i < M; ++i) {
      for (size_t j = 0; j < n; ++j) {
        *(reinterpret_cast<T *>(dst) + (j * M + i)) =
            *(reinterpret_cast<const T *>(src) + (i * n + j));
      }
    }
  }

  //! Reverse transpose a matrix
  template <typename T, size_t M>
  static inline void ReverseTranspose(const void *src, size_t n, void *dst) {
    for (size_t i = 0; i < n; ++i) {
      for (size_t j = 0; j < M; ++j) {
        *(reinterpret_cast<T *>(dst) + (j * n + i)) =
            *(reinterpret_cast<const T *>(src) + (i * M + j));
      }
    }
  }

  //! Transpose a matrix
  template <typename T>
  static inline void Transpose(const void *src, size_t m, size_t n, void *dst) {
    for (size_t i = 0; i < m; ++i) {
      for (size_t j = 0; j < n; ++j) {
        *(reinterpret_cast<T *>(dst) + (j * m + i)) =
            *(reinterpret_cast<const T *>(src) + (i * n + j));
      }
    }
  }

  //! Reverse transpose a matrix
  template <typename T>
  static inline void ReverseTranspose(const void *src, size_t m, size_t n,
                                      void *dst) {
    for (size_t i = 0; i < n; ++i) {
      for (size_t j = 0; j < m; ++j) {
        *(reinterpret_cast<T *>(dst) + (j * n + i)) =
            *(reinterpret_cast<const T *>(src) + (i * m + j));
      }
    }
  }
};

}  // namespace ailego
}  // namespace zvec

```

### Core Architecture Module: `src/ailego/utility/memory_helper.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <zvec/ailego/internal/platform.h>

namespace zvec {
namespace ailego {

/*! Memory Helper
 */
struct MemoryHelper {
  //! Retrieve the page size of memory
  static size_t PageSize();

  //! Retrieve the huge page size of memory
  static size_t HugePageSize();

  //! Round `size` up to a multiple of the huge page size.
  static size_t AlignHugePageSize(size_t size);

  //! Allocate a large, page-aligned block that prefers transparent huge pages.
  //!
  //! On Linux the block is obtained via anonymous mmap and hinted with
  //! MADV_HUGEPAGE; on other platforms it falls back to a page-aligned
  //! allocation without the huge-page hint (which is a performance hint, not a
  //! correctness requirement).  Returns nullptr on failure.
  //!
  //! `size` is rounded up to the huge page size internally, and the same
  //! rounded value is what the corresponding FreeHugePage call expects, so
  //! callers should treat the returned block as exactly AlignHugePageSize(size)
  //! bytes.
  //!
  //! `zero_fill` requests zeroed memory: when true the returned block is
  //! guaranteed to be zero-initialized. When false the caller does not require
  //! zeroing, but the implementation is still free to return zeroed memory and
  //! does so on the anonymous-mmap path (MAP_ANONYMOUS pages are always zero),
  //! where an explicit memset is skipped to preserve lazy paging. In other
  //! words, true => always zeroed; false => zeroing is not guaranteed either
  //! way. Never assume non-zero contents.
  //!
  //! Blocks returned here MUST be released with FreeHugePage (never free()),
  //! because the underlying allocator differs per platform.
  static void *AllocateHugePage(size_t size, bool zero_fill = true);

  //! Release a block previously returned by AllocateHugePage.
  //!
  //! `size` must be the same value originally passed to AllocateHugePage; it is
  //! required because the Linux mmap path needs the length for munmap.
  static void FreeHugePage(void *ptr, size_t size);

  //! Allocate an aligned block, choosing the backing allocator by size.
  //!
  //! When `size` is at least the huge page size, the block is obtained via
  //! AllocateHugePage (huge-page-backed, page-aligned). Otherwise a regular
  //! `alignment`-aligned allocation is used, which avoids wasting a full huge
  //! page on small buffers. Returns nullptr on failure.
  //!
  //! `alignment` must be a power of two.
  //!
  //! `zero_fill` follows the same contract as AllocateHugePage: true guarantees
  //! zeroed memory; false does not require zeroing but the implementation may
  //! still return zeroed memory (it does on the huge-page mmap path). Never
  //! assume non-zero contents.
  //!
  //! Blocks returned here MUST be released with FreeAligned, passing the same
  //! `size`, because the chosen allocator (and therefore the matching free) is
  //! derived from `size`.
  static void *AllocateAligned(size_t size, size_t alignment = 64,
                               bool zero_fill = true);

  //! Release a block previously returned by AllocateAligned.
  //!
  //! `size` must be the same value originally passed to AllocateAligned so the
  //! same allocator path is selected for releasing the block.
  static void FreeAligned(void *ptr, size_t size);

  //! Retrieve the VSZ and RSS of self process in bytes
  static bool SelfUsage(size_t *vsz, size_t *rss);

  //! Retrieve the RSS of self process in bytes
  static size_t SelfRSS();

  //! Retrieve the peak RSS of self process in bytes
  static size_t SelfPeakRSS();

  //! Retrieve the total size of physical memory (RAM) in bytes
  static size_t TotalRamSize();

  //! Retrieve the available size of physical memory (RAM) in bytes
  static size_t AvailableRamSize();

  //! Retrieve the used size of physical memory (RAM) in bytes
  static size_t UsedRamSize();

  //! Retrieve the total size of physical memory (RAM) in bytes in container
  static size_t ContainerAwareTotalRamSize();
};

}  // namespace ailego
}  // namespace zvec

```

### Core Architecture Module: `src/core/algorithm/cluster/cluster_params.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#pragma once

#include <string>

namespace zvec {
namespace core {

//! General
static const std::string GENERAL_CLUSTER_COUNT = "zvec.general.cluster.count";
static const std::string GENERAL_THREAD_COUNT =
    "zvec.general.cluster.thread_count";

//! Optimize K-means
static const std::string OPTKMEANS_CLUSTER_COUNT =
    "zvec.optkmeans.cluster.count";
static const std::string OPTKMEANS_CLUSTER_MAX_ITERATIONS =
    "zvec.optkmeans.cluster.max_iterations";
static const std::string OPTKMEANS_CLUSTER_EPSILON =
    "zvec.optkmeans.cluster.epsilon";
static const std::string OPTKMEANS_CLUSTER_SHARD_FACTOR =
    "zvec.optkmeans.cluster.shard_factor";
static const std::string OPTKMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.optkmeans.cluster.purge_empty";
static const std::string OPTKMEANS_CLUSTER_MARKOV_CHAIN_LENGTH =
    "zvec.optkmeans.cluster.markov_chain_length";
static const std::string OPTKMEANS_CLUSTER_ASSUMPTION_FREE =
    "zvec.optkmeans.cluster.assumption_free";

//! K-means
static const std::string KMEANS_CLUSTER_COUNT = "zvec.kmeans.cluster.count";
static const std::string KMEANS_CLUSTER_SHARD_FACTOR =
    "zvec.kmeans.cluster.shard_factor";
static const std::string KMEANS_CLUSTER_EPSILON = "zvec.kmeans.cluster.epsilon";
static const std::string KMEANS_CLUSTER_MAX_ITERATIONS =
    "zvec.kmeans.cluster.max_iterations";
static const std::string KMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.kmeans.cluster.purge_empty";
static const std::string KMEANS_CLUSTER_BATCH = "zvec.kmeans.cluster.batch";
static const std::string KMEANS_CLUSTER_SEEKER_CLASS =
    "zvec.kmeans.cluster.seeker_class";
static const std::string KMEANS_CLUSTER_SEEKER_PARAMS =
    "zvec.kmeans.cluster.seeker_params";

//! Mini Batch K-means
static const std::string MINIBATCHKMEANS_CLUSTER_COUNT =
    "zvec.minibatchkmeans.cluster.count";
static const std::string MINIBATCHKMEANS_CLUSTER_SHARD_FACTOR =
    "zvec.minibatchkmeans.cluster.shard_factor";
static const std::string MINIBATCHKMEANS_CLUSTER_EPSILON =
    "zvec.minibatchkmeans.cluster.epsilon";
static const std::string MINIBATCHKMEANS_CLUSTER_MAX_ITERATIONS =
    "zvec.minibatchkmeans.cluster.max_iterations";
static const std::string MINIBATCHKMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.minibatchkmeans.cluster.purge_empty";
static const std::string MINIBATCHKMEANS_CLUSTER_TRY_COUNT =
    "zvec.minibatchkmeans.cluster.try_count";
static const std::string MINIBATCHKMEANS_CLUSTER_BATCH_COUNT =
    "zvec.minibatchkmeans.cluster.batch_count";
static const std::string MINIBATCHKMEANS_CLUSTER_SEEKER_CLASS =
    "zvec.minibatchkmeans.cluster.seeker_class";
static const std::string MINIBATCHKMEANS_CLUSTER_SEEKER_PARAMS =
    "zvec.minibatchkmeans.cluster.seeker_params";

//! K-means++
static const std::string KMEANSPP_CLUSTER_COUNT = "zvec.kmeanspp.cluster.count";
static const std::string KMEANSPP_CLUSTER_SHARD_FACTOR =
    "zvec.kmeanspp.cluster.shard_factor";
static const std::string KMEANSPP_CLUSTER_CLASS = "zvec.kmeanspp.cluster.class";
static const std::string KMEANSPP_CLUSTER_PARAMS =
    "zvec.kmeanspp.cluster.params";

//! K-MC2
static const std::string KMC2_CLUSTER_COUNT = "zvec.kmc2.cluster.count";
static const std::string KMC2_CLUSTER_SHARD_FACTOR =
    "zvec.kmc2.cluster.shard_factor";
static const std::string KMC2_CLUSTER_MARKOV_CHAIN_LENGTH =
    "zvec.kmc2.cluster.markov_chain_length";
static const std::string KMC2_CLUSTER_ASSUMPTION_FREE =
    "zvec.kmc2.cluster.assumption_free";
static const std::string KMC2_CLUSTER_CLASS = "zvec.kmc2.cluster.class";
static const std::string KMC2_CLUSTER_PARAMS = "zvec.kmc2.cluster.params";

//! Bisecting K-means
static const std::string BIKMEANS_CLUSTER_COUNT = "zvec.bikmeans.cluster.count";
static const std::string BIKMEANS_CLUSTER_INIT_COUNT =
    "zvec.bikmeans.cluster.init_count";
static const std::string BIKMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.bikmeans.cluster.purge_empty";
static const std::string BIKMEANS_CLUSTER_FIRST_CLASS =
    "zvec.bikmeans.cluster.first_class";
static const std::string BIKMEANS_CLUSTER_SECOND_CLASS =
    "zvec.bikmeans.cluster.second_class";
static const std::string BIKMEANS_CLUSTER_FIRST_PARAMS =
    "zvec.bikmeans.cluster.first_params";
static const std::string BIKMEANS_CLUSTER_SECOND_PARAMS =
    "zvec.bikmeans.cluster.second_params";

//! K-medoids
static const std::string KMEDOIDS_CLUSTER_COUNT = "zvec.kmedoids.cluster.count";
static const std::string KMEDOIDS_CLUSTER_SHARD_FACTOR =
    "zvec.kmedoids.cluster.shard_factor";
static const std::string KMEDOIDS_CLUSTER_EPSILON =
    "zvec.kmedoids.cluster.epsilon";
static const std::string KMEDOIDS_CLUSTER_MAX_ITERATIONS =
    "zvec.kmedoids.cluster.max_iterations";
static const std::string KMEDOIDS_CLUSTER_PURGE_EMPTY =
    "zvec.kmedoids.cluster.purge_empty";
static const std::string KMEDOIDS_CLUSTER_BENCH_RATIO =
    "zvec.kmedoids.cluster.bench_ratio";
static const std::string KMEDOIDS_CLUSTER_ONLY_MEANS =
    "zvec.kmedoids.cluster.only_means";
static const std::string KMEDOIDS_CLUSTER_WITHOUT_MEANS =
    "zvec.kmedoids.cluster.without_means";
static const std::string KMEDOIDS_CLUSTER_SEEKER_CLASS =
    "zvec.kmedoids.cluster.seeker_class";
static const std::string KMEDOIDS_CLUSTER_SEEKER_PARAMS =
    "zvec.kmedoids.cluster.seeker_params";

//! Stratified
static const std::string STRATIFIED_CLUSTER_COUNT =
    "zvec.stratified.cluster.count";
static const std::string STRATIFIED_CLUSTER_FIRST_CLASS =
    "zvec.stratified.cluster.first_class";
static const std::string STRATIFIED_CLUSTER_SECOND_CLASS =
    "zvec.stratified.cluster.second_class";
static const std::string STRATIFIED_CLUSTER_FIRST_COUNT =
    "zvec.stratified.cluster.first_count";
static const std::string STRATIFIED_CLUSTER_SECOND_COUNT =
    "zvec.stratified.cluster.second_count";
static const std::string STRATIFIED_CLUSTER_FIRST_PARAMS =
    "zvec.stratified.cluster.first_params";
static const std::string STRATIFIED_CLUSTER_SECOND_PARAMS =
    "zvec.stratified.cluster.second_params";
static const std::string STRATIFIED_CLUSTER_AUTO_TUNING =
    "zvec.stratified.cluster.auto_tuning";
static const std::string STRATIFIED_CLUSTER_SECOND_POOL_COUNT =
    "zvec.stratified.cluster.second_pool_count";

//! Gap Statistics
static const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MIN =
    "zvec.gapstats.cluster_estimater.k_min";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MAX =
    "zvec.gapstats.cluster_estimater.k_max";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MIN_STEP =
    "zvec.gapstats.cluster_estimater.k_min_step";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MAX_STEP =
    "zvec.gapstats.cluster_estimater.k_max_step";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_TRY_COUNT =
    "zvec.gapstats.cluster_estimater.try_count";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_SHARD_FACTOR =
    "zvec.gapstats.cluster_estimater.shard_factor";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_ENABLE_MC2 =
    "zvec.gapstats.cluster_estimater.enable_mc2";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_MARKOV_CHAIN_LENGTH =
    "zvec.gapstats.cluster_estimater.markov_chain_length";
static const std::string GAPSTATS_CLUSTER_ESTIMATER_CLUSTER_CLASS =
    "zvec.gapstats.cluster_estimater.cluster_class";

static const std::string CLUSTER_TRAINER_SAMPLE_COUNT =
    "zvec.cluster.trainer.sample_count";
static const std::string CLUSTER_TRAINER_SAMPLE_RATIO =
    "zvec.cluster.trainer.sample_ratio";
static const std::string CLUSTER_TRAINER_THREAD_COUNT =
    "zvec.cluster.trainer.thread_count";
static const std::string CLUSTER_TRAINER_FILE_NAME =
    "zvec.cluster.trainer.file_name";
static const std::string CLUSTER_TRAINER_CLASS_NAME =
    "zvec.cluster.trainer.class_name";

static const std::string STRATIFIED_TRAINER_SAMPLE_COUNT =
    "zvec.stratified.trainer.sample_count";
static const std::string STRATIFIED_TRAINER_SAMPLE_RATIO =
    "zvec.stratified.trainer.sample_ratio";
static const std::string STRATIFIED_TRAINER_THREAD_COUNT =
    "zvec.stratified.trainer.thread_count";
static const std::string STRATIFIED_TRAINER_FILE_NAME =
    "zvec.stratified.trainer.file_name";
static const std::string STRATIFIED_TRAINER_CLASS_NAME =
    "zvec.stratified.trainer.class_name";
static const std::string STRATIFIED_TRAINER_CLUSTER_COUNT =
    "zvec.stratified.trainer.cluster_count";
static const std::string STRATIFIED_TRAINER_AUTOAUNE =
    "zvec.stratified.trainer.autotune";
static const std::string STRATIFIED_TRAINER_PARAMS_IN_LEVEL_PREFIX =
    "zvec.stratified.trainer.cluster_params_in_level_";

static const std::string MULTI_CHUNK_CLUSTER_COUNT =
    "zvec.cluster.multi_chunk_cluster.count";
static const std::string MULTI_CHUNK_CLUSTER_CHUNK_COUNT =
    "zvec.cluster.multi_chunk_cluster.chunk_count";
static const std::string MULTI_CHUNK_CLUSTER_THREAD_COUNT =
    "zvec.cluster.multi_chunk_cluster.thread_count";
static const std::string MULTI_CHUNK_CLUSTER_EPSILON =
    "zvec.cluster.multi_chunk_cluster.epsilon";
static const std::string MULTI_CHUNK_CLUSTER_MAX_ITERATIONS =
    "zvec.cluster.multi_chunk_cluster.max_iterations";
static const std::string MULTI_CHUNK_CLUSTER_MARKOV_CHAIN_LENGTH =
    "zvec.cluster.multi_chunk_cluster.markov_chain_length";
}  // namespace core
}  // namespace zvec

```

### Core Architecture Module: `src/core/algorithm/cluster/holder_cluster.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#pragma once

#include <zvec/core/framework/index_cluster.h>
#include <zvec/core/framework/index_holder.h>

namespace zvec {
namespace core {

// Optional, internal capability for clustering a holder without materializing
// intermediate IndexFeatures. The holder is consumed only for this call; it is
// not mounted for later cluster/classify/label calls. NotImplemented must be
// returned before creating an iterator or changing centroids so callers can
// safely fall back to the ordinary IndexFeatures path.
class HolderCluster {
 public:
  virtual ~HolderCluster() = default;

  virtual int cluster_holder(IndexThreads::Pointer threads,
                             IndexHolder::Pointer holder,
                             IndexCluster::CentroidList &cents) = 0;
};

}  // namespace core
}  // namespace zvec

```

### Core Architecture Module: `src/core/algorithm/cluster/linear_seeker.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#pragma once

#include "seeker.h"

namespace zvec {
namespace core {

/*! Linear Seeker
 */
class LinearSeeker : public Seeker {
 public:
  typedef std::shared_ptr<LinearSeeker> Pointer;

  //! Constructor
  LinearSeeker() : meta_(), metric_(), features_() {}

  //! Destructor
  ~LinearSeeker() override = default;

  //! Initialize Seeker
  int init(const IndexMeta &meta) override {
    meta_ = meta;

    metric_ = IndexFactory::CreateMetric(meta_.metric_name());
    if (!metric_) {
      LOG_ERROR("Create Metric %s failed.", meta_.metric_name().c_str());

      return IndexError_Unsupported;
    }
    int ret = metric_->init(meta_, meta_.metric_params());
    if (ret != 0) {
      LOG_ERROR("IndexMetric init failed wit ret %d.", ret);

      return ret;
    }
    distance_func_ = metric_->distance_matrix(1, 1);
    if (!distance_func_) {
      LOG_ERROR("DistanceMatrix function is nullptr.");

      return IndexError_Unsupported;
    }
    return 0;
  }

  //! Cleanup Seeker
  int cleanup() override {
    features_.reset();
    return 0;
  }

  //! Reset Seeker
  int reset() override {
    features_.reset();
    return 0;
  }

  //! Mount features
  int mount(IndexFeatures::Pointer feats) override {
    if (!feats) {
      return IndexError_InvalidArgument;
    }
    if (!feats->is_matched(meta_)) {
      return IndexError_Mismatch;
    }
    features_ = std::move(feats);
    return 0;
  }

  //! Seek (TOP 1 Document)
  int seek(const void *query, size_t len, Document *out) override;

  //! Retrieve the original features
  IndexFeatures::Pointer original() const override {
    return features_;
  }

 private:
  IndexMeta meta_{};
  IndexMetric::Pointer metric_{};
  IndexFeatures::Pointer features_{};
  IndexMetric::MatrixDistance distance_func_{nullptr};
};

}  // namespace core
}  // namespace zvec

```

### Core Architecture Module: `src/core/algorithm/cluster/multi_chunk_cluster.h`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#pragma once

#include <ailego/algorithm/kmeans.h>
#include <ailego/parallel/multi_thread_list.h>
#include <zvec/ailego/internal/platform.h>
#include <zvec/core/framework/index_cluster.h>
#include <zvec/core/framework/index_error.h>
#include <zvec/core/framework/index_factory.h>
#include "cluster_params.h"

namespace zvec {
namespace core {

//! MultiChunkClusterAlgorithm
class MultiChunkClusterAlgorithm {
 public:
  typedef std::shared_ptr<MultiChunkClusterAlgorithm> Pointer;

  //! Constructor
  MultiChunkClusterAlgorithm() = default;

  //! Destructor
  virtual ~MultiChunkClusterAlgorithm() = default;

  //! Initialize Cluster
  int init(const IndexMeta &meta, const ailego::Params &params);

  //! Cleanup Cluster
  int cleanup();

  //! Reset Cluster
  int reset();

  //! Update Cluster
  int update(const ailego::Params &params);

  //! Suggest dividing to K clusters
  void suggest(uint32_t k);

  //! Mount features
  int mount(IndexFeatures::Pointer feats);

  //! Cluster
  int cluster(IndexThreads::Pointer threads, IndexCluster::CentroidList &cents);

  //! Classify
  int classify(IndexThreads::Pointer threads,
               IndexCluster::CentroidList &cents);

  //! Label
  int label(IndexThreads::Pointer threads,
            const IndexCluster::CentroidList &cents,
            std::vector<uint32_t> *out);


  const std::vector<uint32_t> &chunk_dims() const {
    return chunk_dims_;
  }

  const std::vector<uint32_t> &chunk_dim_offsets() const {
    return chunk_dim_offsets_;
  }

 protected:
  //! Check Centroids
  bool check_centroids(const IndexCluster::CentroidList &cents);

  //! Test if it is valid
  bool is_valid() const;

  //! Do chunk
  int do_chunk();

  //! Update parameters
  int update_params(const ailego::Params &params);

  int init_distance_func();

  //! cluster thread
  virtual void do_cluster(size_t idx, size_t chunk_step,
                          IndexCluster::CentroidList *cents,
                          std::atomic<size_t> *finished) = 0;

  //! label thread
  virtual void do_label(size_t idx, size_t step,
                        const IndexCluster::CentroidList &cents,
                        std::vector<uint32_t> *out,
                        std::atomic<size_t> *finished) = 0;

  //! Initialize Centroids
  void init_centroids(size_t count, IndexCluster::CentroidList *out);

 private:
  constexpr static uint32_t kDefaultLogIntervalSecs = 15U;

 protected:
  uint32_t cluster_count_{0u};
  uint32_t thread_count_{0u};
  uint32_t chunk_count_{0u};
  uint32_t max_iterations_{20u};
  bool assumption_free_{false};
  uint32_t markov_chain_length_{32};
  double epsilon_{std::numeric_limits<float>::epsilon()};

  int errcode_{0};
  std::atomic_bool error_{false};
  uint32_t check_interval_secs_{kDefaultLogIntervalSecs};
  std::mutex mutex_{};
  std::condition_variable cond_{};

  IndexMeta meta_{};
  IndexFeatures::Pointer features_{};

  std::vector<uint32_t> chunk_dims_;
  std::vector<uint32_t> chunk_dim_offsets_;

  IndexMetric::MatrixDistance distance_func_{nullptr};
};

/*! Numerical cluster algorithm
 */
template <typename T>
class MultiChunkNumericalAlgorithm : public MultiChunkClusterAlgorithm {
 public:
  //! Type of value
  using ValueType = typename std::remove_cv<T>::type;

  // Check supporting type
  static_assert(ailego::IsArithmetic<ValueType>::value,
                "ValueType must be arithmetic");

  //! Constructor
  MultiChunkNumericalAlgorithm() = default;

  //! Destructor
  ~MultiChunkNumericalAlgorithm() override = default;

 protected:
  //! cluster thread
  void do_cluster(size_t idx, size_t chunk_step,
                  IndexCluster::CentroidList *cents,
                  std::atomic<size_t> *finished) override;

  //! label thread
  void do_label(size_t idx, size_t step,
                const IndexCluster::CentroidList &cents,
                std::vector<uint32_t> *out,
                std::atomic<size_t> *finished) override;
};

//! cluster thread
template <typename T>
void MultiChunkNumericalAlgorithm<T>::do_cluster(
    size_t idx, size_t chunk_step, IndexCluster::CentroidList *cents,
    std::atomic<size_t> *finished) {
  for (size_t chunk = idx; chunk < chunk_count_; chunk += chunk_step) {
    auto chunk_dim = chunk_dims_[chunk];

    ailego::NumericalKmeans<T, IndexThreads> algorithm(cluster_count_,
                                                       chunk_dim);

    // mount features into algorithm
    auto features_count = features_->count();

    algorithm.feature_matrix_reserve(features_count);

    for (size_t i = 0; i < features_count; ++i) {
      auto vec = reinterpret_cast<const T *>(features_->element(i));
      algorithm.append(vec + chunk_dim_offsets_[chunk], chunk_dim);
    }

    IndexThreads::Pointer local_threads =
        std::make_shared<SingleQueueIndexThreads>(1, false);
    if (!local_threads) {
      error_ = IndexError_NoMemory;
      return;
    }

    ailego::Kmc2CentroidsGenerator<ailego::NumericalKmeans<T, IndexThreads>,
                                   IndexThreads>
        cent_gen;
    cent_gen.set_chain_length(markov_chain_length_);
    cent_gen.set_assumption_free(assumption_free_);
    cent_gen(&algorithm, *local_threads);

    double cost = 0.0;

    for (uint32_t i = 0; i < max_iterations_; ++i) {
      double old_cost, new_epsilon;
      old_cost = cost;

      bool result = algorithm.cluster_once(*local_threads, &cost);
      if (result != true) {
        LOG_ERROR("(%u) Failed to cluster.", i + 1);
        errcode_ = -1;

        return;
      }

      new_epsilon = std::abs(cost - old_cost);
      if (new_epsilon < epsilon_) {
        break;
      }
    }

    auto &chunk_cents = algorithm.centroids();

    for (size_t i = 0; i < chunk_cents.count(); ++i) {
      size_t global_cent_idx = chunk * cluster_count_ + i;

      IndexCluster::Centroid *centroid = &(cents->at(global_cent_idx));
      centroid->set_score(algorithm.context().clusters()[i].cost());
      centroid->set_follows(algorithm.context().clusters()[i].count());
      centroid->set_feature(algorithm.centroids()[i],
                            chunk_dim * meta_.unit_size());
    }

    LOG_INFO("(%zu) Chunk Done. Clusters Count: %zu, Features: %zu, Cost: %f",
             chunk, algorithm.centroids().count(), features_->count(), cost);

    (*finished)++;
    {
      std::lock_guard<std::mutex> lk(mutex_);
      cond_.notify_one();
    }
  }

  return;
}

//! label thread
template <typename T>
void MultiChunkNumericalAlgorithm<T>::do_label(
    size_t idx, size_t step, const IndexCluster::CentroidList &cents,
    std::vector<uint32_t> *out, std::atomic<size_t> *finished) {
  for (size_t id = idx; id < features_->count(); id += step) {
    const T *feat = reinterpret_cast<const T *>(features_->element(id));

    for (size_t chunk = 0; chunk < chunk_count_; ++chunk) {
      size_t chunk_dim_offset = chunk_dim_offsets_[chunk];
      size_t chunk_dim = chunk_dims_[chunk];

      uint32_t sel_index = 0;
      float sel_score = std::numeric_limits<float>::max();

      for (uint32_t cluster = 0; cluster < cluster_count_; ++cluster) {
        float score{0.0};

        distance_func_(cents[chunk * cluster_count_ + cluster].feature(),
                       feat + chunk_dim_offset, chunk_dim, &score);

        if (score < sel_score) {
          sel_score = score;
          sel_index = cluster;
        }
      }

      (*out)[id * chunk_count_ + chunk] = static_cast<uint32_t>(sel_index);
    }

    (*finished)++;
    {
      std::lock_guard<std::mutex> lk(mutex_);
      cond_.notify_one();
    }
  }
}

/*! Inner Product Cluster Algorithm
 */
template <typename T>
class MultiChunkNumericalInnerProductAlgorithm
    : public MultiChunkClusterAlgorithm {
 public:
  //! Type of value
  using ValueType = typename std::remove_cv<T>::type;

  // Check supporting type
  static_assert(ailego::IsArithmetic<ValueType>::value,
                "ValueType must be arithmetic");

  //! Constructor
  MultiChunkNumericalInnerProductAlgorithm() = default;

  //! Destructor
  ~MultiChunkNumericalInnerProductAlgorithm() override = default;

 protected:
  //! cluster thread
  void do_cluster(size_t idx, size_t chunk_step,
                  IndexCluster::CentroidList *cents,
                  std::atomic<size_t> *finished) override;

  //! label thread
  void do_label(size_t idx, size_t chunk_step,
                const IndexCluster::CentroidList &cents,
                std::vector<uint32_t> *out,
                std::atomic<size_t> *finished) override;
};

//! cluster thread
template <typename T>
void MultiChunkNumericalInnerProductAlgorithm<T>::do_cluster(
    size_t idx, size_t chunk_step, IndexCluster::CentroidList *cents,
    std::atomic<size_t> *finished) {
  for (size_t chunk = idx; chunk < chunk_count_; chunk += chunk_step) {
    auto chunk_dim = chunk_dims_[chunk];

    ailego::NumericalInnerProductKmeans<T, IndexThreads> algorithm(
        cluster_count_, chunk_dim);

    // mount features into algorithm
    auto features_count = features_->count();

    algorithm.feature_matrix_reserve(features_count);

    for (size_t i = 0; i < features_count; ++i) {
      auto vec = reinterpret_cast<const T *>(features_->element(i));
      algorithm.append(vec + chunk_dim_offsets_[chunk], chunk_dim);
    }

    IndexThreads::Pointer local_threads =
        std::make_shared<SingleQueueIndexThre
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #747** (2026-09-11): **[Bug]: SIGSEGV (native stack overflow) in sqlengine QueryNode parsing when a filter expands to ~15k `file_id = … OR …` predicates**
  *Symptoms*: ### Description  A read-only `context()` query against a workspace collection with ~16,000 files crashes the whole Node process with SIGSEGV on **Linux x64**, deterministically, whenever the query passes `excludedFileTypes` (zvec-grep). The same index and the same query run fine on **macOS arm64**.  Two independent problems stack on top of each other:  1. **zvec-grep (TS layer)**: `searchPlanToStorageFilter` expands a file-type exclusion into the **full list of fileIds**, and `buildInFilter` turns that into `(file_id = 'a' OR file_id = 'b' OR …)` — one predicate per file in the collection. For our index that is ~15k predicates in a single expression. 2. **zvec native (sqlengine)**: the query-expression parser (RTTI shows `zvec::sqlengine::QueryNode`) processes this chain **recursively with no depth limit**, so the expression length is effectively bounded only by the process stack.  ### Steps to Reproduce  ```python ## Environment  - `@zvec/zvec@0.7.0` + `@zvec/bindings-linux-x64@0.7.0` (official npm prebuilt), `@zvec/zvec-grep@0.2.1` - Node v22.22.1, Linux x64, glibc 2.34 - macOS control: Node v22.23.2, `@zvec/bindings-darwin-arm64@0.7.0` — no crash - Workspace: 14 rootPaths, 16,188 files, 127,685 indexed entities (~777 MB index)  ## What happens  Read session opens fine; the first `context()` call (any query text, `limit: 1`) kills the process:   const session = await openWorkspaceReadSession(root, model);   // OK await session.context({ query: "warmup", limit: 1, excludedFi
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! The native stack overflow caused by long OR expressions has been fixed in #694. The fix has been merged and will be included in the next release.  Please upgrade once the release is available and retry your original scenario. Let us know if the issue persists.

- **Issue #714** (2026-09-10): **[Bug]: SIGSEGV under concurrent fetch + insert when the writer crosses a segment switch**
  *Symptoms*: ### Description  One writer thread running `insert()` concurrently with reader threads running `fetch()` / `query()` / `group_by_query()` crashes the process with SIGSEGV on Linux when the writer crosses a segment-switch boundary. Reproduced **3/3 on `main` .  **Root cause.** Readers snapshot the segment list via `get_all_segments()` with **no lock**, while writers mutate that state under exclusive `write_mtx_` ,`doc_ids_` grows per insert , and `writing_segment_` is reassigned per switch. Worse, `dump()`/`flush()` tear down the old segment's in-memory store (`memory_store_.reset()`) **without taking `seg_mtx_` at all** , so a reader mid-`Fetch` — even holding `seg_mtx_` — reads a store that is being destroyed.  gdb captures both threads in the same instant (full stacks below):  - **Reader**: `fetch` → `SegmentImpl::Fetch` → `MemForwardStore::convertToTable` → `arrow::Table::FromRecordBatches` → SIGSEGV - **Writer**: `write_impl` → `switch_to_new_segment_for_writing` → `dump()` → `flush()` → `LocalWalFile::remove()`  On macOS the same race does not crash; a probe (150µs widened reader window) measured **99.7%** of `doc_ids_` push_backs and **99.4%** of segment-switch reassignments executing while a reader was inside `get_all_segments()`. The unsynchronized shape dates to the initial commit.  **Why rarely hit**: only the doc-count-threshold switch is exposed — the other seven switch call sites (optimize, DDL, iterator creation) hold the schema lock exclusively and drain in-fli

- **Issue #699** (2026-08-26): **[Bug]: mmap_forward_store.cc:393 : Failed to find target chunk for index x**
  *Symptoms*: ### Description  Hello,  I ran into the following issue with the latest zvec 0.6.0:  ```python import zvec import numpy as np  col = zvec.create_and_open("demo", zvec.CollectionSchema(name="demo", vectors=[     zvec.VectorSchema("embedding", zvec.DataType.VECTOR_FP16, 128, index_param=zvec.HnswIndexParam()) ])) for i in range(16112):     col.insert([zvec.Doc(id=str(i), vectors={"embedding": np.random.randn(128)})]) col.optimize() res = col.query(queries=zvec.Query("embedding", vector=np.random.randn(128)), topk=1024) print("IDs:", {d.id for d in res}) # Output: #   [ERROR ... mmap_forward_store.cc:393] Failed to find target chunk for index 16068 #   IDs: {''} ```  The error and the reported index are nondeterministic. The error probability seems to increase with topk. For this specific configuration, I had a 100% error probability so far.  ### Steps to Reproduce  Install e.g. python 3.12.3 and zvec 0.6.0. Then run:  ```python import zvec import numpy as np  col = zvec.create_and_open("demo", zvec.CollectionSchema(name="demo", vectors=[     zvec.VectorSchema("embedding", zvec.DataType.VECTOR_FP16, 128, index_param=zvec.HnswIndexParam()) ])) for i in range(16112):     col.insert([zvec.Doc(id=str(i), vectors={"embedding": np.random.randn(128)})]) col.optimize() res = col.query(queries=zvec.Query("embedding", vector=np.random.randn(128)), topk=1024) print("IDs:", {d.id for d in res}) ```  ### Logs / Stack Trace  ```shell [ERROR ... mmap_forward_store.cc:393] Failed to find target
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. The issue was caused by incorrect row lookup when the final IPC chunk was larger than the preceding chunks. It has been fixed in #645 and will be included in v0.7.0, which will be released soon.

- **Issue #673** (2026-08-18): **Crash during Optimize can leak an orphaned segment dir and fail the next segment allocation after recovery**
  *Symptoms*: ### Description  Since #614, Optimize moves the compacted output to its final numeric directory and opens it in the lock-free phase, before the manifest is persisted in the exclusive commit phase:  1. `allocate_segment_id()` returns N (in-memory fetch_add, not persisted) 2. `MoveDirectory(tmp -> <collection>/N)` — numeric dir now exists on disk 3. `Segment::Open(<collection>/N)` — heavy I/O (reads files, builds mmaps) 4. Optimize then waits for the exclusive schema lock; only the commit    phase persists `next_segment_id = N+1` via version flush  If the process crashes between step 2 and the commit-phase flush, recovery restores `segment_id_allocator_` from the old manifest (back to N) and neither opens nor removes the unreferenced directory `<collection>/N`. After recovery, the first operation that allocates segment id N fails:  - an Insert that switches the writing segment hits   `Segment::CreateAndOpen`'s existence check and returns   "Segment create failed: segment path already exists" to the user; - a schema DDL switching the writing segment fails the same way; - the next Optimize fails at `MoveDirectory` (rename onto a non-empty   directory, ENOTEMPTY).  Since `allocate_segment_id()` is fetch_add, the failure is one-shot (a retry allocates N+1 and succeeds), but the orphaned directory — a full compacted segment — is never referenced and never removed, i.e. a permanent disk leak, and the first user operation after recovery can spuriously fail.  The pre-#614 code had the 

- **Issue #665** (2026-08-11): **[Bug]: Node binding — insertSync hard-kills the process with 0xC0000409 (STATUS_STACK_BUFFER_OVERRUN) on some non-ASCII Windows collection paths**
  *Symptoms*: ### Summary  On Windows, `insertSync` through the Node binding (`@zvec/zvec`) terminates the **entire process** with `0xC0000409` (`STATUS_STACK_BUFFER_OVERRUN`) when the collection path contains certain non-ASCII segments. `create` and index build both succeed first; the kill happens at insert.  This is a native fail-fast, not a JavaScript exception. JS never regains control, so `try/catch` cannot observe it and an application cannot degrade gracefully — the process is gone.  > Possibly related: #626. **It is not the same failure**, and I would rather not > bury this under it. #626 is the Python binding raising a *catchable* `RuntimeError` > ("No mapping for the Unicode character exists in the target multi-byte code page"). > Here the Node binding takes the process down with `0xC0000409` and nothing is > catchable. Same neighbourhood (Windows + Unicode path), materially different > failure mode and blast radius.  ### Environment  ``` @zvec/zvec   0.6.0  (and 0.5.0 — see below) node         v22.22.2 os           Windows NT 10.0.26200 (Windows 11 Pro), x64 locale       zh-CN, console encoding utf-8 ```  ### Not introduced by 0.6  The same paths were measured on **0.5.0 and 0.6.0**, and the verdicts are identical row for row:  ``` path segment              0.5.0        0.6.0 中文-日本語-한국어          0xC0000409   0xC0000409 日本語-한국어               0xC0000409   0xC0000409 中文語-中文語               0xC0000409   0xC0000409 日本語 한국어               0xC0000409   0xC0000409 日本語.한국어               0x
  **Post-Mortem & Fix Analysis**:
  > Thanks for providing such a detailed report, we've reproduced it and it will be fixed in the next release

- **Issue #644** (2026-08-21): **[Bug]: 磁盘随optimize次数线性膨胀**
  *Symptoms*: ### Description  我在本地试验的时候发现一个奇怪的现象： 假设有3w条数据，全部插入后再进行optmize，则空间是正常的 如果每1w条数据插入一次后进行optmize（之后线上会这么操作，降低锁延迟），则会导致空间膨胀  [cleanup_orphans.py](https://github.com/user-attachments/files/30642346/cleanup_orphans.py) [parse_manifest.py](https://github.com/user-attachments/files/30642347/parse_manifest.py) [disk_test.py](https://github.com/user-attachments/files/30642348/disk_test.py)  文件说明： disk_test.py 是测试用脚本，用于复现 cleanup_orphans.py 是临时用修复脚本，负责移除孤儿段内容（正是导致空间膨胀的主要原因）  **注意，这三个脚本是由AI生成的，但是已经由人工进行核验和检查实际功能，目前测试下来移除孤儿段不会对现有数据造成影响（但不确定是否会有索引未能加载等其他问题）**  ## 以下是AI定位的原因：  zvec 是 LSM 式段存储：数据先进内存 writing segment → 攒够后刷成 persist segment → optimize 把 ≥2 个 persist 段合并成 1 个新段。关键问题出在合并后的清理环节：  CollectionImpl::Optimize() 合并后调用 segment_manager_->destroy_segment() 删除旧段。 SegmentImpl::destroy() 只把 need_destroyed_ 置 true，不删任何文件；真正的物理删除在 ~SegmentImpl() 析构函数里才执行（cleanup() → RemoveDirectory）。 实测：被合并的旧段对象析构从未发生（引用生命周期缺陷），旧段目录（含大体积的 .proxima 索引文件）永久残留。 证据链完整：  manifest 版本清单只引用新段 → 逻辑状态完全正确：doc_count=30000、查询正常，只有磁盘被浪费； 残留文件进程退出后依然在、且全程未被占用（可用 DELETE 权限打开）→ 排除了文件锁，锁定"清理从未执行"； 关掉 INT8 量化、关掉 mmap 均复现 → 与量化/mmap 无关，是基础 compact 路径的 bug。 另外两个附加发现：① INT8 量化路径每个段还会额外存一份 FP32 原始向量副本（3 万条 768 维 ≈ 92MB），孤儿段的这份是浪费大头；② Windows 下 coll.destroy() 也偶发清不干净（我测到残留 91~132MB），所以指望 destroy 回收不可靠。  ### Steps to Reproduce  ```python 1. 运行disk_test.py 即可复现此问题，版本0.6.0 ```  ### Logs / Stack Trace  ```shell  ```  ### Operating System  Windows 11 25H2  ### Build & Runtime Environment  python 3.13,zvec == 0.6.0  ### Additional Context
  **Post-Mortem & Fix Analysis**:
  > @xiaofeng-ling 感谢报告issue! 复现脚本很有用！ 😃   已在 Windows 和 Linux 上进行对比，确认该问题主要由两种系统不同的文件删除语义导致。 原实现会在 segment 析构期间先调用 `close()`，再通过 `std::filesystem::remove_all()` 删除目录，但 `close()` 没有提前释放 persist store、WAL 等文件句柄或 mmap。 Linux 允许仍被打开或 mmap 的文件被 unlink：目录项会立即消失，实际空间在最后一个引用关闭后释放。因此相同代码在 Linux 上通常能正常清理；Windows 默认不允许删除仍被占用的文件，导致 `remove_all()` 失败，而原实现没有处理该结果，所以旧 segment 目录永久残留。  #676 修复了该问题。 修复后还有遗留一个低概率的外部句柄场景：例如备份或杀毒工具以不包含 `FILE_SHARE_DELETE` 的方式打开 segment 文件，此时 Windows 仍无法立即删除旧目录。所以当外部句柄释放后，遗留目录将在后续重新打开时清理（依赖 #674 的合入）。

- **Issue #626** (2026-08-11): **[Bug]: windows unicode path bug**
  *Symptoms*: ### Description  您好，我这边发现在 Windows 环境下测试 zvec 的 Unicode 路径支持时，发现部分 Unicode 路径可以正常使用，但部分路径在调用 collection.insert() 时失败。  测试结果： C:\temp\zvec_unicode_test\测试中文\rag_zvec ✅ C:\temp\zvec_unicode_test\テストパス\rag_zvec ✅ C:\temp\zvec_unicode_test\中文_テスト_테스트\rag_zvec ✅ C:\temp\zvec_unicode_test\테스트 경로\rag_zvec ❌ C:\temp\zvec_unicode_test\di22222ci。。-cmy\rag_zvec ❌  对于失败的路径： create_and_open() 成功 create_index() 成功 collection.insert() 失败  ### Steps to Reproduce  ```python 使用部分路径创建zvec库，插入报错 ```  ### Logs / Stack Trace  ```shell Traceback (most recent call last):   File "C:\xxx\1.py", line 59, in <module>     result = collection.insert(docs)   File "C:\Users\xxx\miniforge3\envs\database\lib\site-packages\zvec\model\collection.py", line 265, in insert     results = self._obj.Insert( RuntimeError: No mapping for the Unicode character exists in the target multi-byte code page. ```  ### Operating System  windows 11  ### Build & Runtime Environment  zvec 0.6.0  ### Additional Context  - [ ] I've checked `git status` — no uncommitted submodule changes - [ ] I built with `CMAKE_BUILD_TYPE=Debug` - [ ] This occurs with or without `COVERAGE=ON` - [ ] The issue involves Python ↔ C++ integration (pybind11)
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈！ 这确实是个bug，但在acp(ANSI Code Page) =1252的机器上不会出现，一直没发现 :(  我们已经在 #666 修复，将会随着下一个版本（初步预计下周）发布~ 🌹  

- **Issue #619** (2026-07-27): **[Bug]: Linux SIGSEGV (exit 139) on zvec_collection_close / zvec_shutdown after successful create_and_open**
  *Symptoms*: ### Description  On linux-x64, after a successful zvec_collection_create_and_open (C API), calling zvec_collection_close and/or zvec_shutdown can SIGSEGV. Process exit code 139 (128+11).  Expected: clean close/shutdown, exit 0. Actual: native segfault during teardown; create/open themselves succeed.  This is not a catchable managed exception. Observed via the community .NET binding AdamSystems.ZVec.NET (wraps the official C API / native builds of zvec 0.5.1). Until fixed, that binding will suppress native close/shutdown on Linux so deployed apps do not crash on host stop — we want a proper C++ fix and a release/commit we can pin.  ### Steps to Reproduce  ```python 1. zvec_initialize(...) 2. Create a small schema (e.g. one FP32 vector field, dim 8, flat index) 3. zvec_collection_create_and_open(path, schema, options, &collection) → OK 4. zvec_collection_close(collection) and/or zvec_shutdown() 5. Process receives SIGSEGV, exit 139  Equivalent .NET shape:   factory.Initialize(...);   var col = factory.CreateAndOpen(path, schema); // OK   col.Dispose();       // may SIGSEGV on linux-x64   factory.Shutdown();  // may SIGSEGV on linux-x64  Happy to add a pure-C repro / gdb backtrace if helpful. ```  ### Logs / Stack Trace  ```shell (Process exit 139 — SIGSEGV. Full gdb backtrace TBD if needed; happy to capture on request.) Consumer smoke previously had to Environment.Exit(0) before Dispose/Shutdown to avoid the crash after a successful create/open. ```  ### Operating System  Linux
  **Post-Mortem & Fix Analysis**:
  > Hi @ahmedSamir50, thanks for the report. I investigated at the pure C API level — **the crash is not in `zvec_collection_close`/`zvec_shutdown`, but a log-config ownership bug in the ZVec.NET binding's init path.**  ## Findings  **1. The reported sequence does NOT reproduce with correct C API usage.** A minimal pure-C repro (initialize → FP32 dim=8 flat schema → create_and_open → close → shutdown) exits cleanly on linux-x64 Debug, 50/50 runs. Also clean: shutdown-before-close, close-only, shutdown-only with leaked collection, and dlopen/dlclose (host-stop simulation).  **2. The binding's native call sequence reproduces exit 139 — 5/5 runs.** `ZVecNativeLifecycle.ApplyNativeConfig` does:  ```csharp NativeMethods.zvec_config_data_set_log_config(cfg, logCfg); // ownership transferred NativeMethods.zvec_initialize(cfg); // finally: NativeMethods.zvec_config_log_destroy(logCfg);              // BUG: double free ```  But `c_api.h` says: *"ownership is transferred to config, do not free separ
  > @chinaux — sincere thanks for the careful investigation and for the precious time you spent on this. The pure-C isolation, the binding-side repro, and the gdb ownership analysis made the root cause unambiguous and saved us chasing the wrong layer. We really appreciate that work and the depth of debugging you put into it.  Confirmed on our side: the crash was a ZVec.NET binding bug — destroying `logCfg` after a successful `zvec_config_data_set_log_config` (ownership already transferred). Fixed in AdamSystems.ZVec.NET: https://github.com/ahmedSamir50/AdamSystems.ZVec.NET/pull/20  Linux Auto suppress and HardExit workarounds are removed; local Pack-parity sim is green (Noble managed + linux consumer exit 0).  We will ship the resolution in **ZVec.NET 1.0.0-beta.3.2**. Closing this issue from the binding side; thank you again.
  > Closing: binding-side fix landed in https://github.com/ahmedSamir50/AdamSystems.ZVec.NET/pull/20; will ship in ZVec.NET 1.0.0-beta.3.2. Thanks again @chinaux.

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

### Incident Patch 1: `98aa126b` (2026-09-28)
**Commit Message**: fix(core): honor optimize threads in nested training(rabitQ/DiskANN) (#775)

**File**: `src/core/algorithm/diskann/diskann_builder.cc` (modified, +5/-2)
```diff
@@ -375,7 +375,7 @@ int DiskAnnBuilder::prune_internal(IndexThreads::Pointer threads) {
   return 0;
 }
 
-int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer /*threads*/) {
+int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer threads) {
   LOG_INFO("Starting Train: Chunk Num: %u", pq_chunk_num_);
 
   ailego::ElapsedTime timer;
@@ -388,7 +388,10 @@ int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer /*threads*/) {
 
   ailego::Params qp;
   qp.set("num_chunk", pq_chunk_num_);
-  qp.set("thread_count", build_thread_count_);
+  // The quantizer creates its own pool, so bound it by the caller's pool.
+  const auto pq_thread_count = static_cast<uint32_t>(std::max<size_t>(
+      1, std::min<size_t>(build_thread_count_, threads->count())));
+  qp.set("thread_count", pq_thread_count);
   qp.set("use_zero_mean", false);
   int ret = quantizer_->init(build_meta_, qp);
   if (ret != 0) {
```

**File**: `src/core/algorithm/hnsw_rabitq/rabitq_converter.h` (modified, +2/-1)
```diff
@@ -50,7 +50,8 @@ class RabitqConverter : public IndexConverter {
   using IndexConverter::train;
 
   //! Train the data with the specified thread resources
-  int train(IndexHolder::Pointer holder, IndexThreads::Pointer threads);
+  int train(IndexHolder::Pointer holder,
+            IndexThreads::Pointer threads) override;
 
   //! Transform the data - quantize vectors using RaBitQ
   int transform(IndexHolder::Pointer holder) override;
```

**File**: `src/core/framework/index_converter.cc` (modified, +7/-1)
```diff
@@ -21,8 +21,14 @@ namespace core {
 
 int IndexConverter::TrainAndTransform(const IndexConverter::Pointer &converter,
                                       IndexHolder::Pointer holder) {
+  return TrainAndTransform(converter, std::move(holder), nullptr);
+}
+
+int IndexConverter::TrainAndTransform(const IndexConverter::Pointer &converter,
+                                      IndexHolder::Pointer holder,
+                                      IndexThreads::Pointer threads) {
   auto two_pass_holder = IndexHelper::MakeTwoPassHolder(std::move(holder));
-  int ret = converter->train(two_pass_holder);
+  int ret = converter->train(two_pass_holder, std::move(threads));
   if (ret == 0) {
     ret = converter->transform(std::move(two_pass_holder));
   }
```

**File**: `src/core/mixed_reducer/mixed_streamer_reducer.cc` (modified, +3/-3)
```diff
@@ -725,9 +725,11 @@ int MixedStreamerReducer::reduce_with_builder(const IndexFilter &filter) {
 }
 
 int MixedStreamerReducer::index_build(IndexHolder::Pointer target_holder) {
+  auto threads =
+      std::make_shared<BorrowedSingleQueueIndexThreads>(*thread_pool_);
   if (target_builder_converter_) {
     int ret = core::IndexConverter::TrainAndTransform(target_builder_converter_,
-                                                      target_holder);
+                                                      target_holder, threads);
     if (ret != 0) {
       LOG_ERROR("Failed to convert target holder, ret=%d", ret);
       return merged_holder_ && merged_holder_->status() != 0
@@ -740,8 +742,6 @@ int MixedStreamerReducer::index_build(IndexHolder::Pointer target_holder) {
       return core::IndexError_Runtime;
     }
   }
-  auto threads =
-      std::make_shared<BorrowedSingleQueueIndexThreads>(*thread_pool_);
   int ret = target_builder_->train(threads, target_holder);
   if (merged_holder_ && merged_holder_->status() != 0) {
     return merged_holder_->status();
```

**File**: `src/include/zvec/core/framework/index_converter.h` (modified, +14/-0)
```diff
@@ -14,11 +14,13 @@
 #pragma once
 
 #include <atomic>
+#include <utility>
 #include <zvec/core/framework/index_dumper.h>
 #include <zvec/core/framework/index_holder.h>
 #include <zvec/core/framework/index_meta.h>
 #include <zvec/core/framework/index_stats.h>
 #include <zvec/core/framework/index_storage.h>
+#include <zvec/core/framework/index_threads.h>
 #include "zvec/core/framework/index_reformer.h"
 
 namespace zvec {
@@ -179,6 +181,13 @@ class IndexConverter : public IndexModule {
     return IndexError_NotImplemented;
   }
 
+  //! Train the data with caller-provided thread resources when supported
+  virtual int train(IndexHolder::Pointer holder,
+                    IndexThreads::Pointer threads) {
+    (void)threads;
+    return train(std::move(holder));
+  }
+
   //! Train the data
   virtual int train(IndexSparseHolder::Pointer) {
     return IndexError_NotImplemented;
@@ -224,6 +233,11 @@ class IndexConverter : public IndexModule {
   static int TrainAndTransform(const IndexConverter::Pointer &converter,
                                IndexHolder::Pointer holder);
 
+  //! Train and transform with caller-provided thread resources
+  static int TrainAndTransform(const IndexConverter::Pointer &converter,
+                               IndexHolder::Pointer holder,
+                               IndexThreads::Pointer threads);
+
   //! Train, transform and dump the index
   static int TrainTransformAndDump(const IndexConverter::Pointer &converter,
                                    IndexHolder::Pointer holder,
```

**File**: `tests/core/mixed_reducer/merged_provider_index_holder_test.cc` (modified, +82/-6)
```diff
@@ -567,9 +567,8 @@ class ReadFailureReformer : public IndexReformer {
 
 class RetainingTestBuilder : public IndexBuilder {
  public:
-  explicit RetainingTestBuilder(
-      const std::string &name = "SnapshotTestBuilder",
-      ailego::ThreadPool *expected_pool = nullptr)
+  explicit RetainingTestBuilder(const std::string &name = "SnapshotTestBuilder",
+                                ailego::ThreadPool *expected_pool = nullptr)
       : expected_pool_(expected_pool) {
     set_name(name);
   }
@@ -579,7 +578,8 @@ class RetainingTestBuilder : public IndexBuilder {
     train_used_expected_pool = uses_expected_pool(threads);
     return 0;
   }
-  int build(IndexThreads::Pointer threads, IndexHolder::Pointer input) override {
+  int build(IndexThreads::Pointer threads,
+            IndexHolder::Pointer input) override {
     build_thread_count = threads ? threads->count() : 0;
     build_used_expected_pool = uses_expected_pool(threads);
     holder = std::move(input);
@@ -619,6 +619,60 @@ class RetainingTestBuilder : public IndexBuilder {
   Stats stats_;
 };
 
+class ThreadRecordingConverter : public IndexConverter {
+ public:
+  ThreadRecordingConverter(IndexMeta meta, ailego::ThreadPool *expected_pool)
+      : meta_(std::move(meta)), expected_pool_(expected_pool) {}
+
+  int init(const IndexMeta &, const ailego::Params &) override {
+    return 0;
+  }
+  int cleanup() override {
+    result_.reset();
+    return 0;
+  }
+  int train(IndexHolder::Pointer) override {
+    legacy_train_called = true;
+    return IndexError_Runtime;
+  }
+  int train(IndexHolder::Pointer, IndexThreads::Pointer threads) override {
+    train_thread_count = threads->count();
+    auto group = threads->make_group();
+    group->submit(ailego::Closure::New([this]() {
+      used_expected_pool.store(expected_pool_->indexof_this() >= 0,
+                               std::memory_order_relaxed);
+    }));
+    group->wait_finish();
+    return 0;
+  }
+  int transform(IndexHolder::Pointer holder) override {
+    result_ = std::move(holder);
+    return 0;
+  }
+  int dump(const IndexDumper::Pointer &) override {
+    return 0;
+  }
+  const Stats &stats() const override {
+    return stats_;
+  }
+  IndexHolder::Pointer result() const override {
+    return result_;
+  }
+  const IndexMeta &meta() const override {
+    return meta_;
+  }
+
+  size_t train_thread_count{0};
+  std::atomic<bool> used_expected_pool{false};
+  bool legacy_train_called{false};
+
+ private:
+  IndexMeta meta_;
+  ailego::ThreadPool *expected_pool_;
+  IndexHolder::Pointer result_;
+  Stats stats_;
+};
+
 TEST(MergedProviderIndexHolderTest, NonIvfBuildersRetainOwnedInput) {
   for (auto type : {IndexMeta::DataType::DT_FP32, IndexMeta::DataType::DT_FP16,
                     IndexMeta::DataType::DT_INT8}) {
@@ -726,8 +780,7 @@ TEST(MergedProviderIndexHolderTest,
      IvfBuilderUsesProviderBackedInputAndReducerThreadPool) {
   auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
   ailego::ThreadPool pool(2, false);
-  auto builder =
-      std::make_shared<RetainingTestBuilder>("IVFBuilder", &pool);
+  auto builder = std::make_shared<RetainingTestBuilder>("IVFBuilder", &pool);
   MixedStreamerReducer reducer;
   ailego::Params params;
   params.set(PARAM_MIXED_STREAMER_REDUCER_NUM_OF_ADD_THREADS, 1);
@@ -750,6 +803,29 @@ TEST(MergedProviderIndexHolderTest,
             ReadAll(merged));
 }
 
+TEST(MergedProviderIndexHolderTest, ConverterUsesReducerThreadPool) {
+  auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
+  ailego::ThreadPool pool(2, false);
+  auto converter =
+      std::make_shared<ThreadRecordingConverter>(source->meta(), &pool);
+  auto builder = std::make_shared<RetainingTestBuilder>("IVFBuilder", &pool);
+  MixedStreamerReducer reducer;
+  ailego::Params params;
+  params.set(PARAM_MIXED_STREAMER_REDUCER_NUM_OF_ADD_THREADS, 1);
+  ASSERT_EQ(0, reducer.init(params));
+  reducer.set_thread_pool(&pool);
+  ASSERT_EQ(0, reducer.set_target_streamer_wiht_info(
+                   builder, source, converter, nullptr,
+                   IndexQueryMeta(IndexMeta::DataType::DT_FP32, kDimension)));
+  ASSERT_EQ(0, reducer.feed_streamer_with_reformer(source, nullptr));
+  ASSERT_EQ(0, reducer.reduce({}));
+  EXPECT_EQ(pool.count(), converter->train_thread_count);
+  EXPECT_TRUE(converter->used_expected_pool);
+  EXPECT_FALSE(converter->legacy_train_called);
+  EXPECT_TRUE(builder->train_used_expected_pool);
+  EXPECT_TRUE(builder->build_used_expected_pool);
+}
+
 TEST(MergedProviderIndexHolderTest, PlainTurboFp32KeepsOrdinalReads) {
   auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
   auto quantizer = std::make_shared<turbo::Fp32Quantizer>();
```

---

### Incident Patch 2: `53c1bb60` (2026-09-24)
**Commit Message**: fix(quantizer): use rounded INT4 values for scoring metadata (#777)

**File**: `src/core/quantizer/record_quantizer.h` (modified, +7/-4)
```diff
@@ -54,16 +54,19 @@ class RecordQuantizer {
       } else {
         scale = 15 / std::max(max - min, epsilon);
         bias = -min * scale - 8;
+        // Accumulate the rounded codes: the stored sum must match the packed
+        // nibbles, otherwise QuantizedInteger scoring (which reconstructs
+        // scores from sum) ranks with a per-record error.
         for (size_t i = 0; i < dim; i += 2) {
-          float lo = vec[i] * scale + bias;
-          float hi = vec[i + 1] * scale + bias;
+          float lo = std::round(vec[i] * scale + bias);
+          float hi = std::round(vec[i + 1] * scale + bias);
           squared_sum += lo * lo;
           sum += lo;
           squared_sum += hi * hi;
           sum += hi;
           (reinterpret_cast<uint8_t *>(out))[i / 2] =
-              (static_cast_from_float_to_uint8(std::round(hi)) << 4) |
-              (static_cast_from_float_to_uint8(std::round(lo)) & 0xF);
+              (static_cast_from_float_to_uint8(hi) << 4) |
+              (static_cast_from_float_to_uint8(lo) & 0xF);
         }
         extras =
             reinterpret_cast<float *>(static_cast<uint8_t *>(out) + dim / 2);
```

**File**: `tests/core/interface/index_interface_test.cc` (modified, +16/-11)
```diff
@@ -787,11 +787,13 @@ TEST(IndexInterface, BufferGeneral) {
 
   auto func = [&](const BaseIndexParam::Pointer &param,
                   const BaseIndexQueryParam::Pointer &query_param) {
-    const float value_tolerance =
-        param->quantizer_param &&
-                param->quantizer_param->type == QuantizerType::kInt4
-            ? 0.1f
-            : 1e-6f;
+    const bool is_int4 = param->quantizer_param &&
+                         param->quantizer_param->type == QuantizerType::kInt4;
+    const float value_tolerance = is_int4 ? 0.1f : 1e-6f;
+    // INT4 reconstructs 1.0 as 14/15 for this vector.
+    const float expected_score =
+        is_int4 ? 4.0f + (14.0f / 15.0f) * (14.0f / 15.0f) : 5.0f;
+    const float score_tolerance = is_int4 ? 1e-5f : 1e-6f;
     std::string real_index_name = index_name;
     zvec::test_util::RemoveTestFiles(index_name + "*");
     auto write_index = IndexFactory::CreateAndInitIndex(*param);
@@ -811,16 +813,21 @@ TEST(IndexInterface, BufferGeneral) {
 
     auto read_index = IndexFactory::CreateAndInitIndex(*param);
     ASSERT_NE(nullptr, read_index);
-    read_index->open(real_index_name,
-                     {StorageOptions::StorageType::kBufferPool, false});
+    ASSERT_EQ(
+        0, read_index->open(real_index_name,
+                            {StorageOptions::StorageType::kBufferPool, false}));
+    auto cleanup = zvec::ailego::ScopeGuard::Make([&]() {
+      EXPECT_EQ(0, read_index->close());
+      zvec::test_util::RemoveTestFiles(index_name + "*");
+    });
 
     SearchResult result;
     VectorData query;
     query.vector = DenseVector{vector.data()};
-    read_index->search(query, query_param, &result);
+    ASSERT_EQ(0, read_index->search(query, query_param, &result));
     ASSERT_EQ(1, result.doc_list_.size());
     ASSERT_EQ(233, result.doc_list_[0].key());
-    ASSERT_NEAR(5.0f, result.doc_list_[0].score(), value_tolerance);
+    ASSERT_NEAR(expected_score, result.doc_list_[0].score(), score_tolerance);
     if (query_param->fetch_vector) {
       auto &doc = result.doc_list_[0];
       if (result.reverted_vector_list_.size() != 0) {
@@ -847,8 +854,6 @@ TEST(IndexInterface, BufferGeneral) {
     ASSERT_NEAR(1.0f, fetched_vector[1], value_tolerance);
     ASSERT_NEAR(2.0f, fetched_vector[2], value_tolerance);
     result.doc_list_.clear();
-    read_index->close();
-    zvec::test_util::RemoveTestFiles(index_name + "*");
   };
 
 
```

**File**: `tools/core/flow.h` (modified, +14/-0)
```diff
@@ -317,6 +317,13 @@ class Flow {
             return IndexError_NoExist;
           }
           reformer_->init(meta.reformer_params());
+          // Load converter state (e.g. rotator) so queries are transformed
+          // into the same space as the stored codes.
+          ret = reformer_->load(stg_);
+          if (ret != 0) {
+            LOG_ERROR("Failed to load reformer state from storage");
+            return ret;
+          }
         }
       }
 
@@ -486,6 +493,13 @@ class SparseFlow {
             return IndexError_NoExist;
           }
           reformer_->init(meta.reformer_params());
+          // Load converter state (e.g. rotator) so queries are transformed
+          // into the same space as the stored codes.
+          ret = reformer_->load(stg_);
+          if (ret != 0) {
+            LOG_ERROR("Failed to load reformer state from storage");
+            return ret;
+          }
         }
       }
 
```

---

### Incident Patch 3: `d88357bf` (2026-09-21)
**Commit Message**: perf(diskann): reduce peak memory usage during index build and merge (#762)

Co-authored-by: Jalin Wang <[REDACTED_EMAIL]>

**File**: `src/core/algorithm/diskann/diskann_builder.cc` (modified, +29/-29)
```diff
@@ -27,6 +27,7 @@
 #include <zvec/core/framework/index_holder.h>
 #include <zvec/core/interface/index_factory.h>
 #include "algorithm/cluster/vector_mean.h"
+#include "utility/prefix_index_holder.h"
 #include "diskann_context.h"
 #include "diskann_params.h"
 #include "diskann_util.h"
@@ -395,27 +396,10 @@ int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer /*threads*/) {
     return ret;
   }
 
-  // Preserve the legacy trainer's bounded prefix sample. The turbo trainer
-  // collects its entire input before subsampling, so cap that input first.
-  IndexHolder::Pointer training_holder = holder_;
-  if (holder_->count() > max_train_sample_count_) {
-    auto iter = holder_->create_iterator();
-    if (!iter) {
-      LOG_ERROR("Create training iterator failed");
-      return IndexError_Runtime;
-    }
-    auto sample = std::make_shared<RandomAccessIndexHolder>(build_meta_);
-    sample->reserve(max_train_sample_count_);
-    for (; iter->is_valid() && sample->count() < max_train_sample_count_;
-         iter->next()) {
-      sample->emplace(iter->key(), iter->data());
-    }
-    if (sample->count() != max_train_sample_count_) {
-      LOG_ERROR("Training holder ended before the requested sample count");
-      return IndexError_Runtime;
-    }
-    training_holder = std::move(sample);
-  }
+  // Keep the legacy prefix and sample order without materializing a second
+  // training holder. The quantizer copies only its selected training rows.
+  IndexHolder::Pointer training_holder = std::make_shared<PrefixIndexHolder>(
+      holder_, max_train_sample_count_, build_meta_);
   ret = quantizer_->train(std::move(training_holder));
   if (ret != 0) {
     LOG_ERROR("PqInt8Quantizer train failed, ret=%d", ret);
@@ -463,16 +447,21 @@ int DiskAnnBuilder::generate_quantized_data(IndexThreads::Pointer threads) {
   const size_t elem_size = build_meta_.element_size();
   const size_t thread_count =
       threads ? std::max<size_t>(1, threads->count()) : 1;
-  constexpr size_t kEncodeBatchSize = 65536;
-  std::vector<uint8_t> block(kEncodeBatchSize * elem_size);
+  constexpr size_t kEncodeMemoryBudget = 4u * 1024u * 1024u;
+  const size_t batch_size =
+      std::min(num_vecs, std::max<size_t>(1, kEncodeMemoryBudget / elem_size));
+  std::vector<uint8_t> block(batch_size * elem_size);
 
   size_t id = 0;
   while (id < num_vecs) {
     size_t cur = 0;
-    for (; cur < kEncodeBatchSize && id + cur < num_vecs && iter->is_valid();
+    for (; cur < batch_size && id + cur < num_vecs && iter->is_valid();
          iter->next(), ++cur) {
       // The quantizer widens FP16 input internally — pass raw data directly.
-      std::memcpy(block.data() + cur * elem_size, iter->data(), elem_size);
+      const void *data = iter->data();
+      if (!data) return IndexError_ReadData;
+      if (iter->key() != entity_.get_key(id + cur)) return IndexError_Mismatch;
+      std::memcpy(block.data() + cur * elem_size, data, elem_size);
     }
     if (cur == 0) {
       break;
@@ -504,7 +493,7 @@ int DiskAnnBuilder::generate_quantized_data(IndexThreads::Pointer threads) {
     id += cur;
   }
 
-  if (id != num_vecs) {
+  if (id != num_vecs || iter->is_valid()) {
     LOG_ERROR("PQ generate: iterated %zu vectors, expected %zu", id, num_vecs);
     return IndexError_Runtime;
   }
@@ -649,6 +638,7 @@ int DiskAnnBuilder::train(IndexThreads::Pointer threads,
     return IndexError_InvalidArgument;
   }
 
+  if (!holder->is_matched(raw_meta_)) return IndexError_Mismatch;
   LOG_INFO("Begin DiskAnnBuilder::train");
 
   auto start_time = ailego::Monotime::MilliSeconds();
@@ -732,15 +722,21 @@ int DiskAnnBuilder::build(IndexThreads::Pointer threads,
     return IndexError_Runtime;
   }
 
+  if (!holder->is_matched(raw_meta_) || !holder->multipass() ||
+      holder->count() > std::numeric_limits<uint32_t>::max()) {
+    return IndexError_Mismatch;
+  }
   if (ailego_unlikely(holder->count() == 0)) {
     LOG_ERROR("Holder is empty");
     return IndexError_Runtime;
   }
 
   int ret = entity_.reserve_space(holder->count());
+  if (ret != 0) return ret;
 
   error_ = false;
   while (iter->is_valid()) {
+    if (entity_.doc_cnt() >= holder->count()) return IndexError_Mismatch;
     ret = entity_.add_vector(iter->key(), iter->data());
     if (ailego_unlikely(ret != 0)) {
       return ret;
@@ -749,6 +745,8 @@ int DiskAnnBuilder::build(IndexThreads::Pointer threads,
     iter->next();
   }
 
+  if (entity_.doc_cnt() != holder->count()) return IndexError_Mismatch;
+  iter.reset();
   LOG_INFO("Finished saving vector");
 
   LOG_INFO("Start to calculate entrypoint");
@@ -769,6 +767,9 @@ int DiskAnnBuilder::build(IndexThreads::Pointer threads,
     return ret;
   }
 
+  // All graph workers have joined. Subsequent stages consume holder_, so
+  // release the full vector copy before allocating PQ buffers.
+  entity_.release_vectors();
   LOG_INFO("Start to generate quantized data");
   ret = generate_quantized_data(threads);
   if (ail
```

**File**: `src/core/algorithm/diskann/diskann_builder_entity.cc` (modified, +55/-31)
```diff
@@ -15,6 +15,8 @@
 #include "diskann_builder_entity.h"
 #include <iostream>
 #include <numeric>
+#include <ailego/pattern/defer.h>
+#include "utility/ordinal_access_holder.h"
 #include "diskann_algorithm.h"
 #include "diskann_util.h"
 
@@ -31,13 +33,13 @@ void DiskAnnBuilderEntity::clear() {
   neighbor_size_ = 0;
   mem_index_file_.clear();
   index_path_prefix_.clear();
-  vectors_buffer_.clear();
-  keys_buffer_.clear();
-  neighbors_buffer_.clear();
+  release_vectors();
+  std::string().swap(keys_buffer_);
+  std::string().swap(neighbors_buffer_);
   entrypoints_.clear();
   meta_.clear();
-  pq_quantizer_meta_buffer_.clear();
-  block_compressed_data_.clear();
+  std::string().swap(pq_quantizer_meta_buffer_);
+  std::vector<uint8_t>().swap(block_compressed_data_);
   meta_header_.clear();
   pq_meta_.clear();
 }
@@ -62,27 +64,28 @@ int DiskAnnBuilderEntity::init(const IndexMeta &meta, uint32_t max_degree,
   return 0;
 }
 
+void DiskAnnBuilderEntity::release_vectors() {
+  std::string().swap(vectors_buffer_);
+}
+
 int DiskAnnBuilderEntity::reserve_space(uint32_t docs) {
   vectors_buffer_.reserve(meta_.element_size() * docs);
   keys_buffer_.reserve(sizeof(diskann_key_t) * docs);
-  neighbors_buffer_.reserve(neighbor_size_ * docs);
+  neighbors_buffer_.reserve(static_cast<size_t>(neighbor_size_) * docs);
 
   return 0;
 }
 
 int DiskAnnBuilderEntity::add_vector(diskann_key_t key, const void *vec) {
+  if (!vec) return IndexError_ReadData;
   vectors_buffer_.append(reinterpret_cast<const char *>(vec),
                          meta_.element_size());
   keys_buffer_.append(reinterpret_cast<const char *>(&key), sizeof(key));
 
   uint32_t neighbor_cnt = 0;
-  // Parentheses select the size/value constructor.
-  std::vector<diskann_id_t> neighbor(max_build_degree_, 0);
-
   neighbors_buffer_.append(reinterpret_cast<const char *>(&neighbor_cnt),
                            sizeof(uint32_t));
-  neighbors_buffer_.append(reinterpret_cast<const char *>(neighbor.data()),
-                           sizeof(diskann_id_t) * max_build_degree_);
+  neighbors_buffer_.append(sizeof(diskann_id_t) * max_build_degree_, '\0');
 
   (*mutable_doc_cnt())++;
 
@@ -375,6 +378,10 @@ int DiskAnnBuilderEntity::dump_entrypoint_segment(
 
 int DiskAnnBuilderEntity::dump(IndexHolder::Pointer holder, IndexMeta &meta,
                                const IndexDumper::Pointer &dumper) {
+  if (!holder || holder->count() != this->doc_cnt() ||
+      holder->element_size() != meta_.element_size()) {
+    return IndexError_Mismatch;
+  }
   uint64_t doc_cnt = holder->count();
   uint64_t max_node_size =
       (uint64_t)max_observed_degree_ * sizeof(diskann_id_t) + sizeof(uint32_t) +
@@ -410,11 +417,40 @@ int DiskAnnBuilderEntity::dump(IndexHolder::Pointer holder, IndexMeta &meta,
   size_t len = 0;
 
   // no need to write first sector
-  auto iter = holder->create_iterator();
-  if (!iter) {
-    LOG_ERROR("Create iterator for holder failed");
-    return IndexError_Runtime;
+  OrdinalAccessHolder::Reader::Pointer reader;
+  if (auto *source = dynamic_cast<OrdinalAccessHolder *>(holder.get())) {
+    ret = source->create_ordinal_reader(&reader);
+    if (ret != 0 && ret != IndexError_NotImplemented) return ret;
+    if (ret == 0 && !reader) return IndexError_Runtime;
   }
+  auto iter = reader ? nullptr : holder->create_iterator();
+  if (!reader && !iter) return IndexError_Runtime;
+  AILEGO_DEFER([&]() {
+    if (reader) reader->reset();
+  });
+  auto read_vector = [&](size_t id, void *output) -> int {
+    uint64_t key = 0;
+    const void *data = nullptr;
+    if (reader) {
+      int result = reader->read(id, &key, &data);
+      if (result != 0) return result;
+    } else {
+      if (!iter->is_valid()) return IndexError_Mismatch;
+      key = iter->key();
+      data = iter->data();
+      // A deferred read failure can return a non-null placeholder and
+      // invalidate the iterator. Reject it before copying, even on the last
+      // vector where no subsequent iteration would detect the error.
+      if (!iter->is_valid()) {
+        return IndexError_ReadData;
+      }
+    }
+    if (!data) return IndexError_ReadData;
+    if (key != get_key(id)) return IndexError_Mismatch;
+    memcpy(output, data, meta.element_size());
+    if (iter) iter->next();
+    return 0;
+  };
 
   uint64_t index_size = 0;
   uint32_t neighbor_num;
@@ -448,14 +484,8 @@ int DiskAnnBuilderEntity::dump(IndexHolder::Pointer holder, IndexMeta &meta,
         memcpy(&(neighbor_buf[0]), neighbors.second,
                neighbors.first * sizeof(diskann_id_t));
 
-        if (iter->is_valid()) {
-          const void *vec = iter->data();
-          memcpy(&(node_buf[0]), vec, meta.element_size());
-
-          iter->next();
-        } else {
-          return IndexError_Runtime;
-        }
+        ret = read_vector(cur_node_id, &node_buf[0]);
+        if (ret != 0) return ret;
 
         // write neighbor num
         *(uint32_t *)(node_buf.data()
```

**File**: `src/core/algorithm/diskann/diskann_builder_entity.h` (modified, +4/-0)
```diff
@@ -64,6 +64,10 @@ class DiskAnnBuilderEntity : public DiskAnnEntity {
 
   int reserve_space(uint32_t docs);
 
+  // Graph construction is the only consumer of these vectors. PQ encoding
+  // and dump read the retained source holder instead.
+  void release_vectors();
+
   std::string &pq_quantizer_meta_buffer() {
     return pq_quantizer_meta_buffer_;
   }
```

**File**: `src/core/interface/indexes/diskann_index.cc` (modified, +89/-74)
```diff
@@ -15,6 +15,7 @@
 #include <memory>
 #include <mutex>
 #include <string>
+#include <ailego/pattern/defer.h>
 #include <zvec/core/interface/index.h>
 #if DISKANN_SUPPORTED
 #include "algorithm/diskann/diskann_params.h"
@@ -199,8 +200,8 @@ int DiskAnnIndex::generate_holder() {
 }
 
 int DiskAnnIndex::add(const VectorData &vector, uint32_t doc_id) {
-  if (is_trained_) {
-    LOG_ERROR("this diskann index is trained");
+  if (is_trained_ || build_stage_ != BuildStage::kCollecting) {
+    LOG_ERROR("this diskann index is trained or has a pending build");
     return core::IndexError_Runtime;
   }
   if (!std::holds_alternative<DenseVector>(vector.vector)) {
@@ -214,61 +215,89 @@ int DiskAnnIndex::add(const VectorData &vector, uint32_t doc_id) {
 
   std::lock_guard<std::mutex> lock(mutex_);
   if (doc_cache_.size() <= doc_id) {
-    std::string fake_data(
-        input_vector_meta_.dimension() * input_vector_meta_.unit_size(), 0);
-    doc_cache_.resize(doc_id + 1, std::make_pair(kInvalidKey, fake_data));
+    doc_cache_.resize(doc_id + 1, std::make_pair(kInvalidKey, std::string{}));
   }
-  doc_cache_[doc_id] = std::make_pair(doc_id, out_vector_buffer);
+  doc_cache_[doc_id] = std::make_pair(doc_id, std::move(out_vector_buffer));
   return 0;
 }
 
 int DiskAnnIndex::train() {
-  int ret = generate_holder();
-  if (ret != 0) {
-    LOG_ERROR("Failed to generate holder, err: %s",
-              core::IndexError::What(ret));
-    return ret;
-  }
-  ret = builder_->train(holder_);
-  if (ret != 0) {
-    LOG_ERROR("Failed to train builder, err: %s", core::IndexError::What(ret));
-    return ret;
+  if (is_trained_) return 0;
+  if (build_stage_ == BuildStage::kCollecting) {
+    int ret = reset_builder();
+    if (ret != 0) return ret;
+    ret = generate_holder();
+    if (ret != 0) return ret;
+    ret = builder_->train(holder_);
+    if (ret != 0) return ret;
+    build_stage_ = BuildStage::kTrained;
   }
-  ret = builder_->build(holder_);
-  if (ret != 0) {
-    LOG_ERROR("Failed to build index, err: %s", core::IndexError::What(ret));
-    return ret;
-  }
-  auto dumper = core::IndexFactory::CreateDumper("FileDumper");
-  if (dumper == nullptr) {
-    LOG_ERROR("Failed to create FileDumper");
-    return core::IndexError_Runtime;
+  if (build_stage_ == BuildStage::kTrained) {
+    int ret = builder_->build(holder_);
+    if (ret != 0) {
+      // A partial graph cannot be resumed. Recreate it on the next attempt
+      // from the retained input cache.
+      build_stage_ = BuildStage::kCollecting;
+      return ret;
+    }
+    build_stage_ = BuildStage::kBuilt;
   }
+  return dump_and_open();
+}
 
-  ret = dumper->create(file_path_);
-  if (ret != 0) {
-    LOG_ERROR("Failed to create dumper, path: %s, err: %s", file_path_.c_str(),
-              core::IndexError::What(ret));
-    return core::IndexError_Runtime;
-  }
-  ret = builder_->dump(dumper);
-  if (ret != 0) {
-    LOG_ERROR("Failed to dump index, path: %s, err: %s", file_path_.c_str(),
-              core::IndexError::What(ret));
-    return core::IndexError_Runtime;
-  }
-  dumper->close();
-  ret = storage_->open(file_path_, false);
-  if (ret != 0) {
-    LOG_ERROR("Failed to open storage, path: %s, err: %s", file_path_.c_str(),
-              core::IndexError::What(ret));
-    return core::IndexError_Runtime;
+int DiskAnnIndex::reset_builder() {
+  auto next = core::IndexFactory::CreateBuilder("DiskAnnBuilder");
+  if (!next) return core::IndexError_NoExist;
+  int ret = next->init(converter_ ? converter_->meta() : proxima_index_meta_,
+                       proxima_index_params_);
+  if (ret != 0) return ret;
+  builder_ = std::move(next);
+  return 0;
+}
+
+int DiskAnnIndex::dump_and_open() {
+  if (build_stage_ == BuildStage::kBuilt) {
+    auto dumper = core::IndexFactory::CreateDumper("FileDumper");
+    if (!dumper) return core::IndexError_NoExist;
+    int ret = dumper->create(file_path_);
+    if (ret != 0) return ret;
+    AILEGO_DEFER([&]() {
+      if (dumper) dumper->close();
+    });
+    ret = builder_->dump(dumper);
+    if (ret != 0) return ret;
+    if (converter_) {
+      ret = converter_->dump(dumper);
+      if (ret != 0) return ret;
+    }
+    ret = dumper->close();
+    if (ret != 0) return ret;
+    dumper.reset();
+    ret = reset_builder();
+    if (ret != 0) return ret;
+    build_stage_ = BuildStage::kDumped;
+  } else if (build_stage_ != BuildStage::kDumped) {
+    return core::IndexError_NoReady;
   }
-  if (streamer_ == nullptr || streamer_->open(storage_) != 0) {
-    LOG_ERROR("Failed to open streamer, path: %s", file_path_.c_str());
-    return core::IndexError_Runtime;
+  AILEGO_DEFER([&]() {
+    if (!is_trained_) {
+      if (streamer_) streamer_->close();
+      storage_->close();
+    }
+  });
+  int ret = storage_->open(file_path_, false);
+  if (ret != 0) return ret;
+  if (!streamer_) return core::IndexError_NoReady;
+  ret = streamer_->open(storage_);
+  if (ret != 0) return ret;
+  if (reformer_
```

**File**: `src/core/mixed_reducer/mixed_streamer_reducer.cc` (modified, +3/-2)
```diff
@@ -693,10 +693,11 @@ int MixedStreamerReducer::reduce_with_builder(const IndexFilter &filter) {
 
   AILEGO_DEFER([&]() { holder->set_stop_flag(nullptr); });
   IndexHolder::Pointer target_holder = holder;
-  // Only IVF has been adapted to propagate source read failures during dump.
+  // IVF and DiskAnn propagate source read failures during dump.
   // Other builders retain an owned multipass snapshot, as before, so their
   // dump paths never depend on a source provider or its deferred error state.
-  if (target_builder_->name() != "IVFBuilder") {
+  if (target_builder_->name() != "IVFBuilder" &&
+      target_builder_->name() != "DiskAnnBuilder") {
     switch (holder->data_type()) {
       case IndexMeta::DataType::DT_FP32:
         ret = MaterializeMergedInput<IndexMeta::DataType::DT_FP32, float>(
```

**File**: `src/core/utility/prefix_index_holder.h` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+#pragma once
+
+#include <algorithm>
+#include <zvec/core/framework/index_holder.h>
+
+namespace zvec {
+namespace core {
+
+// A bounded view, preserving the source's iteration order and pointer lifetime.
+// Training must copy each selected vector before advancing its iterator.
+class PrefixIndexHolder : public IndexHolder {
+ public:
+  PrefixIndexHolder(IndexHolder::Pointer source, size_t limit, IndexMeta meta)
+      : source_(std::move(source)),
+        count_(std::min(source_->count(), limit)),
+        meta_(std::move(meta)) {}
+
+  size_t count() const override {
+    return count_;
+  }
+  size_t dimension() const override {
+    return meta_.dimension();
+  }
+  IndexMeta::DataType data_type() const override {
+    return meta_.data_type();
+  }
+  size_t element_size() const override {
+    return meta_.element_size();
+  }
+  bool multipass() const override {
+    return source_->multipass();
+  }
+
+  IndexHolder::Iterator::Pointer create_iterator() override {
+    auto iter = source_->create_iterator();
+    if (!iter) return nullptr;
+    return std::make_unique<Iterator>(source_, std::move(iter), count_);
+  }
+
+ private:
+  class Iterator : public IndexHolder::Iterator {
+   public:
+    Iterator(IndexHolder::Pointer source, IndexHolder::Iterator::Pointer iter,
+             size_t count)
+        : source_(std::move(source)),
+          iter_(std::move(iter)),
+          remaining_(count) {}
+    const void *data() const override {
+      return iter_->data();
+    }
+    bool is_valid() const override {
+      return remaining_ && iter_->is_valid();
+    }
+    uint64_t key() const override {
+      return iter_->key();
+    }
+    void next() override {
+      if (remaining_ && --remaining_) iter_->next();
+    }
+
+   private:
+    IndexHolder::Pointer source_;
+    IndexHolder::Iterator::Pointer iter_;
+    size_t remaining_;
+  };
+  IndexHolder::Pointer source_;
+  size_t count_;
+  IndexMeta meta_;
+};
+
+}  // namespace core
+}  // namespace zvec
```

**File**: `src/include/zvec/core/interface/index.h` (modified, +4/-0)
```diff
@@ -465,6 +465,10 @@ class ZVEC_CORE_API DiskAnnIndex : public Index {
   int generate_holder();
 
  private:
+  enum class BuildStage { kCollecting, kTrained, kBuilt, kDumped };
+  int reset_builder();
+  int dump_and_open();
+  BuildStage build_stage_{BuildStage::kCollecting};
   DiskAnnIndexParam param_{};
   std::mutex mutex_{};
   std::vector<std::pair<uint64_t, std::string>> doc_cache_;
```

**File**: `src/turbo/quantizer/common/pq_training_samples.h` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+#pragma once
+
+#include <algorithm>
+#include <cstdint>
+#include <cstring>
+#include <limits>
+#include <random>
+#include <unordered_map>
+#include <vector>
+#include <zvec/core/framework/index_holder.h>
+
+namespace zvec::turbo {
+
+// Preserve legacy sampling order with O(limit * vector_size) copied data.
+// Iterators may reuse their buffers. Leave output unchanged on read failure.
+inline bool CollectPqTrainingSamples(const core::IndexHolder::Pointer &holder,
+                                     size_t limit, size_t vec_bytes,
+                                     std::vector<uint8_t> *output) {
+  if (!holder || !output || !limit || !vec_bytes) return false;
+  if (vec_bytes > holder->element_size()) return false;
+  const size_t input_count = holder->count();
+  const size_t num = std::min(input_count, limit);
+  if (!num || num > std::numeric_limits<size_t>::max() / vec_bytes)
+    return false;
+  // Perform the same seeded partial Fisher-Yates shuffle on row ordinals,
+  // then stream only selected rows into their original training slots. The
+  // sparse permutation and data buffer are bounded by the training limit.
+  std::vector<std::pair<size_t, size_t>> selected;
+  if (input_count > num) {
+    selected.reserve(num);
+    std::unordered_map<size_t, size_t> permutation;
+    permutation.reserve(num);
+    auto at = [&](size_t position) {
+      auto entry = permutation.find(position);
+      return entry == permutation.end() ? position : entry->second;
+    };
+    std::mt19937 rng(42);
+    for (size_t i = 0; i < num; ++i) {
+      std::uniform_int_distribution<size_t> dist(i, input_count - 1);
+      size_t j = dist(rng);
+      selected.emplace_back(at(j), i);
+      if (i != j) permutation[j] = at(i);
+      permutation.erase(i);
+    }
+    std::sort(selected.begin(), selected.end());
+  }
+  std::vector<uint8_t> all_data(num * vec_bytes);
+  auto iter = holder->create_iterator();
+  if (!iter) return false;
+  size_t row = 0, copied = 0;
+  for (; iter->is_valid(); iter->next(), ++row) {
+    if (row >= input_count) return false;
+    if (!selected.empty() && (copied == num || selected[copied].first != row))
+      continue;
+    const void *data = iter->data();
+    if (!data) return false;
+    size_t slot = selected.empty() ? row : selected[copied].second;
+    std::memcpy(all_data.data() + slot * vec_bytes, data, vec_bytes);
+    ++copied;
+  }
+  if (row != input_count || copied != num) return false;
+  iter.reset();
+
+  *output = std::move(all_data);
+  return true;
+}
+
+}  // namespace zvec::turbo
```

---

### Incident Patch 4: `7bd50f8a` (2026-09-21)
**Commit Message**: perf(hnsw-rabitq): optimize HNSW RaBitQ index building (#755)

**File**: `src/core/algorithm/flat/flat_streamer_entity.cc` (modified, +39/-0)
```diff
@@ -775,6 +775,45 @@ int FlatStreamerEntity::get_vector_by_key(
   return 0;
 }
 
+int FlatStreamerEntity::get_vectors_by_key(
+    const uint64_t *keys, uint32_t count,
+    std::vector<IndexStorage::MemoryBlock> &blocks) const {
+  std::vector<VectorLocation> locations(count);
+  key_info_map_lock_->lock_shared();
+  if (use_key_info_map_) {
+    for (uint32_t i = 0; i < count; ++i) {
+      auto iterator = key_info_map_.find(keys[i]);
+      if (iterator == key_info_map_.end()) {
+        key_info_map_lock_->unlock_shared();
+        return -1;
+      }
+      locations[i] = iterator->second;
+    }
+  } else {
+    for (uint32_t i = 0; i < count; ++i) {
+      if (keys[i] >= withid_key_info_map_.size()) {
+        key_info_map_lock_->unlock_shared();
+        return -1;
+      }
+      locations[i] = withid_key_info_map_[keys[i]];
+    }
+  }
+  key_info_map_lock_->unlock_shared();
+
+  blocks.resize(count);
+  for (uint32_t i = 0; i < count; ++i) {
+    const VectorLocation &loc = locations[i];
+    auto segment = this->get_segment(loc.segment_id);
+    if (!segment ||
+        segment->read(loc.offset, blocks[i], index_meta_.element_size()) !=
+            index_meta_.element_size()) {
+      LOG_ERROR("Failed to read segment, size=%u", index_meta_.element_size());
+      return -1;
+    }
+  }
+  return 0;
+}
+
 IndexProvider::Iterator::Pointer FlatStreamerEntity::creater_iterator() const {
   auto entity = this->clone();
   if (!entity) {
```

**File**: `src/core/algorithm/flat/flat_streamer_entity.h` (modified, +3/-0)
```diff
@@ -140,6 +140,9 @@ class FlatStreamerEntity {
   virtual int get_vector_by_key(const uint64_t key,
                                 IndexStorage::MemoryBlock &block) const;
 
+  int get_vectors_by_key(const uint64_t *keys, uint32_t count,
+                         std::vector<IndexStorage::MemoryBlock> &blocks) const;
+
   //! Create a new iterator
   IndexProvider::Iterator::Pointer creater_iterator() const;
 
```

**File**: `src/core/algorithm/flat/flat_streamer_provider.h` (modified, +6/-0)
```diff
@@ -71,6 +71,12 @@ class FlatStreamerProvider : public IndexProvider {
     return this->get_vector_by_key(key, block);
   }
 
+  int get_vectors(
+      const uint64_t *keys, uint32_t count,
+      std::vector<IndexStorage::MemoryBlock> &blocks) const override {
+    return owner_->entity().get_vectors_by_key(keys, count, blocks);
+  }
+
   //! Retrieve the owner class
   const std::string &owner_class() const override {
     return owner_->name();
```

**File**: `src/core/algorithm/hnsw_rabitq/hnsw_rabitq_algorithm.cc` (modified, +98/-49)
```diff
@@ -98,7 +98,7 @@ void HnswRabitqAlgorithm::select_entry_point(level_t level,
     }
 
     std::vector<IndexStorage::MemoryBlock> neighbor_vec_blocks;
-    int ret = dc.get_vector(&neighbors[0], size, neighbor_vec_blocks);
+    int ret = dc.get_vectors(&neighbors[0], size, neighbor_vec_blocks);
     if (ailego_unlikely(ctx->debugging())) {
       (*ctx->mutable_stats_get_vector())++;
     }
@@ -209,7 +209,7 @@ void HnswRabitqAlgorithm::search_neighbors(level_t level,
     }
 
     std::vector<IndexStorage::MemoryBlock> neighbor_vec_blocks;
-    int ret = dc.get_vector(neighbor_ids.data(), size, neighbor_vec_blocks);
+    int ret = dc.get_vectors(neighbor_ids.data(), size, neighbor_vec_blocks);
     if (ailego_unlikely(ctx->debugging())) {
       (*ctx->mutable_stats_get_vector())++;
     }
@@ -268,28 +268,7 @@ void HnswRabitqAlgorithm::update_neighbors(HnswRabitqAddDistCalculator &dc,
     }
   }
 
-  uint32_t cur_size = 0;
-  for (size_t i = 0; i < topk_heap.size(); ++i) {
-    node_id_t cur_node = topk_heap[i].first;
-    ResultRecord cur_node_dist = topk_heap[i].second;
-    bool good = true;
-    for (uint32_t j = 0; j < cur_size; ++j) {
-      ResultRecord tmp_dist = dc.dist(cur_node, topk_heap[j].first);
-      if (tmp_dist <= cur_node_dist) {
-        good = false;
-        break;
-      }
-    }
-
-    if (good) {
-      topk_heap.mutable_at(cur_size).first = cur_node;
-      topk_heap.mutable_at(cur_size).second = cur_node_dist;
-      cur_size++;
-      if (cur_size >= max_neighbor_cnt) {
-        break;
-      }
-    }
-  }
+  uint32_t cur_size = prune_neighbors(dc, topk_heap, max_neighbor_cnt);
 
   // when after-prune neighbor count is too seldom,
   // we use this strategy to make-up enough edges
@@ -318,6 +297,78 @@ void HnswRabitqAlgorithm::update_neighbors(HnswRabitqAddDistCalculator &dc,
   return;
 }
 
+size_t HnswRabitqAlgorithm::prune_neighbors(HnswRabitqAddDistCalculator &dc,
+                                            TopkHeap &topk_heap,
+                                            size_t max_neighbor_cnt) {
+  std::vector<node_id_t> candidate_ids(topk_heap.size());
+  for (size_t i = 0; i < topk_heap.size(); ++i) {
+    candidate_ids[i] = topk_heap[i].first;
+  }
+
+  std::vector<IndexStorage::MemoryBlock> candidate_blocks;
+  int ret = dc.get_vectors(candidate_ids.data(),
+                           static_cast<uint32_t>(candidate_ids.size()),
+                           candidate_blocks);
+
+  size_t cur_size = 0;
+  if (ailego_likely(ret == 0)) {
+    std::vector<const void *> candidate_vectors(candidate_blocks.size());
+    for (size_t i = 0; i < candidate_blocks.size(); ++i) {
+      candidate_vectors[i] = candidate_blocks[i].data();
+    }
+
+    for (size_t i = 0; i < topk_heap.size(); ++i) {
+      node_id_t cur_node = topk_heap[i].first;
+      ResultRecord cur_node_dist = topk_heap[i].second;
+      const void *cur_vector = candidate_vectors[i];
+      bool good = true;
+      for (size_t j = 0; j < cur_size; ++j) {
+        ResultRecord tmp_dist =
+            dc.dist_cached(cur_vector, candidate_vectors[j]);
+        if (tmp_dist <= cur_node_dist) {
+          good = false;
+          break;
+        }
+      }
+
+      if (good) {
+        topk_heap.mutable_at(cur_size).first = cur_node;
+        topk_heap.mutable_at(cur_size).second = cur_node_dist;
+        candidate_vectors[cur_size] = cur_vector;
+        cur_size++;
+        if (cur_size >= max_neighbor_cnt) {
+          break;
+        }
+      }
+    }
+    return cur_size;
+  }
+
+  // Preserve the previous error behavior for malformed providers.
+  for (size_t i = 0; i < topk_heap.size(); ++i) {
+    node_id_t cur_node = topk_heap[i].first;
+    ResultRecord cur_node_dist = topk_heap[i].second;
+    bool good = true;
+    for (size_t j = 0; j < cur_size; ++j) {
+      ResultRecord tmp_dist = dc.dist(cur_node, topk_heap[j].first);
+      if (tmp_dist <= cur_node_dist) {
+        good = false;
+        break;
+      }
+    }
+
+    if (good) {
+      topk_heap.mutable_at(cur_size).first = cur_node;
+      topk_heap.mutable_at(cur_size).second = cur_node_dist;
+      cur_size++;
+      if (cur_size >= max_neighbor_cnt) {
+        break;
+      }
+    }
+  }
+  return cur_size;
+}
+
 void HnswRabitqAlgorithm::reverse_update_neighbors(
     HnswRabitqAddDistCalculator &dc, node_id_t id, level_t level,
     node_id_t link_id, ResultRecord dist, TopkHeap &update_heap) {
@@ -336,38 +387,36 @@ void HnswRabitqAlgorithm::reverse_update_neighbors(
 
   update_heap.emplace(link_id, dist);
 
+  std::vector<node_id_t> neighbor_ids(size);
   for (size_t i = 0; i < size; ++i) {
-    node_id_t node = neighbors[i];
-    ResultRecord cur_dist = dc.dist(id, node);
-    update_heap.emplace(node, cur_dist);
+    neighbor_ids[i] = neighbors[i];
+  }
+  IndexStorage::MemoryBlock center_block;
+  std::vector<IndexStorage::MemoryBlock> neighbor_blocks;
+  int ret = dc.get_vector(id, center_block);
+  if (ailego_likely(ret == 0)) {
+   
```

**File**: `src/core/algorithm/hnsw_rabitq/hnsw_rabitq_algorithm.h` (modified, +5/-1)
```diff
@@ -95,6 +95,10 @@ class HnswRabitqAlgorithm {
   void update_neighbors(HnswRabitqAddDistCalculator &dc, node_id_t id,
                         level_t level, TopkHeap &topk_heap);
 
+  //! Prune a sorted candidate heap, reusing each fetched raw vector.
+  size_t prune_neighbors(HnswRabitqAddDistCalculator &dc, TopkHeap &topk_heap,
+                         size_t max_neighbor_cnt);
+
   //! Checking linkId could be id's new neighbor, and add as neighbor if true
   //! @dc         distance calculator
   //! @updateHeap temporary heap in updating neighbors
@@ -121,4 +125,4 @@ class HnswRabitqAlgorithm {
 };
 
 }  // namespace core
-}  // namespace zvec
\ No newline at end of file
+}  // namespace zvec
```

**File**: `src/core/algorithm/hnsw_rabitq/hnsw_rabitq_dist_calculator.cc` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-// Copyright 2025-present the centaurdb project
-//
-// Licensed under the Apache License, Version 2.0 (the "License");
-// you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at
-//
-//     http://www.apache.org/licenses/LICENSE-2.0
-//
-// Unless required by applicable law or agreed to in writing, software
-// distributed under the License is distributed on an "AS IS" BASIS,
-// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-// See the License for the specific language governing permissions and
-// limitations under the License
-
-#include "core/algorithm/hnsw_rabitq/hnsw_rabitq_dist_calculator.h"
-#include "zvec/core/framework/index_error.h"
-
-namespace zvec::core {
-
-int HnswRabitqAddDistCalculator::get_vector(
-    const node_id_t *ids, uint32_t count,
-    std::vector<IndexStorage::MemoryBlock> &vec_blocks) const {
-  for (uint32_t i = 0; i < count; ++i) {
-    const node_id_t id = ids[i];
-    key_t key = entity_->get_key(id);
-    if (key == kInvalidKey) {
-      return IndexError_NoExist;
-    }
-    IndexStorage::MemoryBlock block;
-    int ret = provider_->get_vector(key, block);
-    if (ret != 0) {
-      return ret;
-    }
-    vec_blocks.push_back(std::move(block));
-  }
-  return 0;
-}
-
-}  // namespace zvec::core
```

**File**: `src/core/algorithm/hnsw_rabitq/hnsw_rabitq_dist_calculator.h` (modified, +25/-2)
```diff
@@ -109,6 +109,12 @@ class HnswRabitqAddDistCalculator {
     return score;
   }
 
+  //! Returns distance between two already-fetched vectors.
+  inline dist_t dist_cached(const void *vec_lhs, const void *vec_rhs) {
+    compare_cnt_++;
+    return dist(vec_lhs, vec_rhs);
+  }
+
   //! Returns distance between query and vec.
   inline dist_t dist(const void *vec) {
     compare_cnt_++;
@@ -207,8 +213,25 @@ class HnswRabitqAddDistCalculator {
     provider_ = std::move(provider);
   }
 
-  int get_vector(const node_id_t *ids, uint32_t count,
-                 std::vector<IndexStorage::MemoryBlock> &vec_blocks) const;
+  int get_vectors(const node_id_t *ids, uint32_t count,
+                  std::vector<IndexStorage::MemoryBlock> &vec_blocks) const {
+    std::vector<key_t> keys(count);
+    for (uint32_t i = 0; i < count; ++i) {
+      keys[i] = entity_->get_key(ids[i]);
+      if (keys[i] == kInvalidKey) {
+        return IndexError_NoExist;
+      }
+    }
+    return provider_->get_vectors(keys.data(), count, vec_blocks);
+  }
+
+  int get_vector(node_id_t id, IndexStorage::MemoryBlock &vec_block) const {
+    key_t key = entity_->get_key(id);
+    if (key == kInvalidKey) {
+      return IndexError_NoExist;
+    }
+    return provider_->get_vector(key, vec_block);
+  }
 
   const void *get_vector(node_id_t id) const {
     key_t key = entity_->get_key(id);
```

**File**: `src/include/zvec/core/framework/index_provider.h` (modified, +14/-0)
```diff
@@ -45,6 +45,20 @@ struct IndexProvider : public IndexHolder {
     return IndexError_NotImplemented;
   }
 
+  //! Retrieve vectors using primary keys.
+  virtual int get_vectors(
+      const uint64_t *keys, uint32_t count,
+      std::vector<IndexStorage::MemoryBlock> &blocks) const {
+    blocks.resize(count);
+    for (uint32_t i = 0; i < count; ++i) {
+      int ret = get_vector(keys[i], blocks[i]);
+      if (ret != 0) {
+        return ret;
+      }
+    }
+    return 0;
+  }
+
   //! Retrieve the owner class
   virtual const std::string &owner_class() const = 0;
 };
```

---

### Incident Patch 5: `1ab7975d` (2026-09-20)
**Commit Message**: fix(fts): persist sealed postings before dropping side column families (#759)

**File**: `src/db/index/column/fts_column/fts_column_indexer.cc` (modified, +63/-36)
```diff
@@ -22,6 +22,7 @@
 #include <rocksdb/write_batch.h>
 #include <zvec/ailego/logger/logger.h>
 #include <zvec/db/status.h>
+#include "db/common/constants.h"
 #include "db/common/typedef.h"
 #include "iterator/fts_candidate_iterator.h"
 #include "iterator/fts_conjunction_iterator.h"
@@ -611,6 +612,11 @@ Result<void> FtsColumnIndexer::insert(uint64_t seg_doc_id,
         "FtsColumnIndexer::insert: not opened. field=", field_name_));
   }
 
+  if (cf_dropped_.load(std::memory_order_acquire)) {
+    return tl::make_unexpected(Status::InternalError(
+        "FtsColumnIndexer::insert: field is sealed. field=", field_name_));
+  }
+
   // Tokenize
   std::vector<Token> tokens = tokenizer_pipeline_->process(text);
   const uint32_t doc_len = static_cast<uint32_t>(tokens.size());
@@ -731,13 +737,46 @@ Result<void> FtsColumnIndexer::flush() {
 // ============================================================
 
 Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
-  // safe access check
-
-  if (!postings_cf_ || !term_freq_cf_ || !doc_len_cf_ || !scorer_) {
+  if (!ctx_) {
+    return tl::make_unexpected(Status::InternalError(
+        "FtsColumnIndexer: not opened. field=", field_name_));
+  }
+  // Read actual CF handles: a previous failed seal may have reset the reader's
+  // side pointers while leaving the column families available for retry.
+  auto *term_freq_cf = term_freq_cf_.load();
+  auto *doc_len_cf = doc_len_cf_.load();
+  if (!term_freq_cf) term_freq_cf = ctx_->get_cf(field_name_ + kFtsTfSuffix);
+  if (!doc_len_cf) doc_len_cf = ctx_->get_cf(field_name_ + kFtsDocLenSuffix);
+  if (!postings_cf_ || !stat_cf_ || !scorer_) {
     return tl::make_unexpected(Status::InternalError(
         "FtsColumnIndexer::convert_postings_to_bitpacked: not opened. field=",
         field_name_));
   }
+  if (!term_freq_cf) {
+    // $TF is dropped first, after postings and statistics are durable.
+    // Older versions did not guarantee this ordering; reject leftover Roaring
+    // postings instead of accepting an already damaged index as sealed.
+    std::unique_ptr<rocksdb::Iterator> iter(
+        ctx_->db_->NewIterator(ctx_->read_opts_, postings_cf_));
+    for (iter->SeekToFirst(); iter->Valid(); iter->Next()) {
+      if (!BitPackedPostingList::is_bitpacked_format(iter->value().data(),
+                                                     iter->value().size())) {
+        return tl::make_unexpected(Status::InternalError(
+            "FtsColumnIndexer: missing $TF with non-BitPacked postings. field=",
+            field_name_));
+      }
+    }
+    if (!iter->status().ok()) {
+      return tl::make_unexpected(
+          Status::InternalError(iter->status().ToString()));
+    }
+    return {};
+  }
+  if (!doc_len_cf) {
+    return tl::make_unexpected(Status::InternalError(
+        "FtsColumnIndexer: missing $DOC_LEN before conversion. field=",
+        field_name_));
+  }
 
   // ---------------------------------------------------------------
   // 1) Load doc_len_cf into an in-memory vector indexed by local doc_id.
@@ -747,7 +786,7 @@ Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
   std::vector<uint32_t> doc_lens;
   {
     std::unique_ptr<rocksdb::Iterator> iter(
-        ctx_->db_->NewIterator(ctx_->read_opts_, doc_len_cf_.load()));
+        ctx_->db_->NewIterator(ctx_->read_opts_, doc_len_cf));
     iter->SeekToFirst();
     while (iter->Valid()) {
       const std::string key = iter->key().ToString();
@@ -822,7 +861,7 @@ Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
 
   {
     std::unique_ptr<rocksdb::Iterator> iter(
-        ctx_->db_->NewIterator(ctx_->read_opts_, term_freq_cf_.load()));
+        ctx_->db_->NewIterator(ctx_->read_opts_, term_freq_cf));
     iter->SeekToFirst();
     while (iter->Valid()) {
       const std::string key = iter->key().ToString();
@@ -861,37 +900,25 @@ Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
     return ret;
   }
 
-  // ---------------------------------------------------------------
-  // 3) Clear $TF / $DOC_LEN / $MAX_TF CFs via DeleteRange.
-  //
-  // All payloads (tf, doc_len, max_score) have been inlined into the
-  // BitPacked postings in step 2.  Wiping them here ensures the SST files
-  // are cleaned up during the dump-side compaction, so the dumped immutable
-  // segment is significantly smaller.  MutableSegment then drops the CFs
-  // entirely after all indexers finish conversion.
-  //
-  // DeleteRange uses [begin, end) semantics; an empty begin and a 256-byte
-  // 0xFF end together cover every possible key in these CFs.
-  // ---------------------------------------------------------------
-  static const std::string kClearBegin{};
-  static const std::string kClearEnd(256, '\xFF');
-
-  const std::pair<const char *, rocksdb::ColumnFamilyHandle *> cfs_to_clear[] =
-      {
-          {"$TF", term_freq_cf_.load()},
-          {"$DOC_LEN", doc_len_cf_.load()},
-          {"$MAX_TF", max_
```

**File**: `src/db/index/column/fts_column/fts_column_indexer.h` (modified, +8/-6)
```diff
@@ -147,17 +147,19 @@ class FtsColumnIndexer {
   Result<void> flush();
 
   /*! Convert all Roaring-format postings in postings_cf to BitPacked format
-   *  with inline tf/doc_len/max_score payloads, then DeleteRange-clear the
-   *  $TF, $DOC_LEN, and $MAX_TF CFs.
+   *  with inline tf/doc_len/max_score payloads and synchronously flush them
+   *  along with segment statistics. Preserve auxiliary data until CF removal.
    *
    *  Called by MutableSegment::dump_fts_column_indexers() right before the
-   *  SST dump.  After all indexers finish conversion, MutableSegment drops
-   *  the $TF/$MAX_TF/$DOC_LEN CFs entirely (via reset_side_cfs() +
-   *  RocksdbStore::drop_column_family()), so the dumped immutable segment
+   *  SST dump. After conversion, FtsIndexer drops the $TF/$MAX_TF/$DOC_LEN
+   *  CFs entirely (via reset_side_cfs() + RocksdbContext::drop_cf()),
+   *  so the dumped immutable segment
    *  no longer contains these CFs at all.
    *
    *  Idempotent: terms whose postings are already in BitPacked format are
-   *  skipped, so re-running after a partial-failure dump is safe.
+   *  skipped, so re-running after a partial-failure dump is safe. $TF is
+   *  dropped first after conversion is durable, allowing cleanup to resume
+   *  after reopening the index.
    *
    *  Must be called after flush() so that the BM25 scorer used by encode()
    *  sees the up-to-date segment statistics.
```

**File**: `src/db/index/column/fts_column/fts_indexer.cc` (modified, +18/-7)
```diff
@@ -104,6 +104,10 @@ Status FtsIndexer::open(const FieldSchemaPtrList &fts_fields, bool create,
                                    ret.error().message());
     }
 
+    if (!term_freq_cf) {
+      // $TF is removed first when sealing; this field cannot accept writes.
+      indexer->reset_side_cfs();
+    }
     indexers_[name] = indexer;
   }
 
@@ -288,10 +292,13 @@ Status FtsIndexer::seal(const std::string &field_name) {
                                  field_name, " ", ret.error().message());
   }
 
+  // Drop $TF first: its absence identifies completed conversion on recovery.
   indexer->reset_side_cfs();
-  fts_ctx_->drop_cf(field_name + kFtsTfSuffix);
-  fts_ctx_->drop_cf(field_name + kFtsMaxTfSuffix);
-  fts_ctx_->drop_cf(field_name + kFtsDocLenSuffix);
+  for (const auto &suffix : {kFtsTfSuffix, kFtsMaxTfSuffix, kFtsDocLenSuffix}) {
+    if (auto status = fts_ctx_->drop_cf(field_name + suffix); !status.ok()) {
+      return status;
+    }
+  }
 
   return Status::OK();
 }
@@ -315,14 +322,18 @@ Status FtsIndexer::seal_all() {
     }
   }
 
-  // Reset side CFs and drop them.
+  // Reset side CFs and drop them. For each field, $TF must be dropped first
+  // and any failure must stop cleanup, preserving the recovery invariant.
   for (const auto &[name, indexer] : indexers_) {
     indexer->reset_side_cfs();
   }
   for (const auto &[name, _] : indexers_) {
-    fts_ctx_->drop_cf(name + kFtsTfSuffix);
-    fts_ctx_->drop_cf(name + kFtsMaxTfSuffix);
-    fts_ctx_->drop_cf(name + kFtsDocLenSuffix);
+    for (const auto &suffix :
+         {kFtsTfSuffix, kFtsMaxTfSuffix, kFtsDocLenSuffix}) {
+      if (auto status = fts_ctx_->drop_cf(name + suffix); !status.ok()) {
+        return status;
+      }
+    }
   }
 
   return Status::OK();
```

**File**: `src/db/index/column/fts_column/fts_indexer.h` (modified, +2/-0)
```diff
@@ -82,6 +82,8 @@ class FtsIndexer {
   }
 
  private:
+  friend class FtsSealRetryTest;
+
   Status open(const FieldSchemaPtrList &fts_fields, bool create,
               bool read_only);
 
```

**File**: `tests/db/index/column/fts_column/fts_column_indexer_test.cc` (modified, +385/-8)
```diff
@@ -14,21 +14,25 @@
 
 #include "db/index/column/fts_column/fts_column_indexer.h"
 #include <algorithm>
+#include <cstdlib>
 #include <fstream>
 #include <memory>
 #include <string>
 #include <unordered_map>
 #include <unordered_set>
 #include <vector>
 #include <gtest/gtest.h>
+#include <rocksdb/utilities/stackable_db.h>
 #include <zvec/db/config.h>
 #include <zvec/db/index_params.h>
 #include "db/common/file_helper.h"
 #include "db/index/common/index_filter.h"
 // FtsQueryParams defined below
 #include "db/index/column/fts_column/fts_ast_rewriter.h"
+#include "db/index/column/fts_column/fts_indexer.h"
 #include "db/index/column/fts_column/fts_rocksdb_merge.h"
 #include "db/index/column/fts_column/parser/fts_query_parser.h"
+#include "db/index/column/fts_column/posting/bitpacked_posting_list.h"
 #include "db/index/column/fts_column/tokenizer/tokenizer_factory.h"
 // meta.h not needed in zvec
 #include "db/common/constants.h"
@@ -1147,10 +1151,9 @@ TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedBasic) {
   EXPECT_EQ(std::get<2>(decoded[2]), 3u);
 }
 
-// After conversion the $TF / $DOC_LEN / $MAX_TF side CFs must be EMPTY: the
-// indexer DeleteRange's them once their content has been inlined into the
-// BitPacked posting list.  MutableSegment then drops the CFs entirely.
-TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedClearsSideCfs) {
+// Conversion preserves $TF / $DOC_LEN / $MAX_TF until FtsIndexer drops them.
+// A failed first drop must leave the inputs intact for another conversion.
+TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedPreservesSideCfs) {
   auto indexer = make_indexer("content");
   for (uint64_t doc_id = 0; doc_id < 5; ++doc_id) {
     EXPECT_TRUE(indexer->insert(doc_id, "alpha beta gamma").has_value());
@@ -1164,10 +1167,10 @@ TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedClearsSideCfs) {
 
   EXPECT_TRUE(indexer->convert_postings_to_bitpacked().has_value());
 
-  // Side CFs must be empty after conversion (DeleteRange'd by the indexer).
-  EXPECT_EQ(count_cf_entries(db_, term_freq_cf_), 0u);
-  EXPECT_EQ(count_cf_entries(db_, doc_len_cf_), 0u);
-  EXPECT_EQ(count_cf_entries(db_, max_tf_cf_), 0u);
+  // All auxiliary entries remain available until explicit CF removal.
+  EXPECT_EQ(count_cf_entries(db_, term_freq_cf_), 15u);
+  EXPECT_EQ(count_cf_entries(db_, doc_len_cf_), 5u);
+  EXPECT_EQ(count_cf_entries(db_, max_tf_cf_), 3u);
 
   // After reset_side_cfs, search should still work (BitPacked path).
   indexer->reset_side_cfs();
@@ -1918,3 +1921,377 @@ TEST_F(FtsStemmerIndexerTest, StemmerNoMatchAfterStemming) {
   EXPECT_TRUE(search_ok(*indexer, "nonexistent", 10, &results, pipeline));
   EXPECT_TRUE(results.empty());
 }
+
+#if GTEST_HAS_DEATH_TEST
+
+class FtsSealRecoveryDeathTest : public ::testing::TestWithParam<bool> {
+ protected:
+  void SetUp() override {
+    path_ = "./test_fts_seal_recovery_" + std::to_string(GetParam());
+    FileHelper::RemoveDirectory(path_);
+  }
+
+  void TearDown() override {
+    FileHelper::RemoveDirectory(path_);
+  }
+
+  std::string path_;
+};
+
+TEST_P(FtsSealRecoveryDeathTest, PostingsSurviveExitWithoutClose) {
+  ::testing::FLAGS_gtest_death_test_style = "threadsafe";
+  const bool seal_all = GetParam();
+  const std::vector<std::string> names =
+      seal_all ? std::vector<std::string>{"text", "title"}
+               : std::vector<std::string>{"text"};
+  FieldSchemaPtrList fields;
+  std::unordered_map<std::string, std::shared_ptr<rocksdb::MergeOperator>>
+      merge_ops;
+  for (const auto &name : names) {
+    auto params = std::make_shared<zvec::FtsIndexParams>("whitespace");
+    fields.push_back(make_test_field_meta(name, params));
+    merge_ops[name] = std::make_shared<FtsPostingsMerge>();
+  }
+
+  // Re-exec the child instead of forking an initialized RocksDB thread pool.
+  // Exit after sealing, without destructors that would hide missing flushes.
+  ASSERT_EXIT(
+      {
+        auto indexer = FtsIndexer::CreateAndOpen(path_, fields, true);
+        if (!indexer) {
+          std::_Exit(1);
+        }
+        for (const auto &name : names) {
+          if (!indexer->insert(name, 0, "shared shared").ok() ||
+              !indexer->insert(name, 1, "shared").ok()) {
+            std::_Exit(2);
+          }
+        }
+        // Match SegmentImpl::dump(): flush the mutable representation first.
+        if (!indexer->flush().ok()) {
+          std::_Exit(3);
+        }
+        auto status = seal_all ? indexer->seal_all() : indexer->seal("text");
+        if (!status.ok()) {
+          std::_Exit(4);
+        }
+        std::_Exit(0);
+      },
+      ::testing::ExitedWithCode(0), "");
+
+  RocksdbContext recovered;
+  ASSERT_TRUE(
+      recovered
+          .open(RocksdbContext::Args{path_, {}, nullptr, merge_ops, true}, true)
+          .ok());
+  for (const auto &name : names) {
+    auto *postings_cf = recovered.get_cf(name);
+    ASSERT_NE(postings_cf, nullptr);
+    EXPECT_EQ(recovered.ge
```

**File**: `tests/db/index/column/fts_column/fts_rocksdb_reducer_test.cc` (modified, +18/-37)
```diff
@@ -882,22 +882,12 @@ TEST_F(FtsRocksdbReducerTest, MergeTwoBitPackedSegments) {
 // time), so this scenario is no longer reachable in production.
 
 // ============================================================
-// Reducer over BitPacked-converted source segments with EMPTY side CFs
+// Reducer over BitPacked-converted source segments with retained side CFs
 // ============================================================
 //
-// After the post-2026 indexer change,
-// MutableSegment::dump_fts_column_indexers() invokes
-// FtsColumnIndexer::convert_postings_to_bitpacked(), which inlines
-// tf/doc_len/max_tf into the BitPacked posting list AND DeleteRange's the
-// $TF / $MAX_TF / $DOC_LEN side CFs.  By the time the reducer sees the
-// segment:
-//   - postings_cf : every value is BitPacked (magic 'BPKD')
-//   - term_freq_cf / max_tf_cf / doc_len_cf : empty (DeleteRange tombstones)
-//
-// The new reducer never reads the side CFs at all, so this test verifies
-// the end-to-end pipeline produces a queryable destination index whose
-// posting set matches the expected union — and that the empty side CFs
-// cause no errors or stat under-counts.
+// Conversion inlines tf/doc_len/max_tf into BitPacked postings and preserves
+// auxiliary data until FtsIndexer drops the CFs. The reducer never reads these
+// side CFs, so retained auxiliary entries must not affect merged results.
 
 TEST_F(FtsRocksdbReducerTest, ReducerHandlesBitpackedConvertedSrcSegments) {
   // ----- src0: insert + flush + convert (the helper already calls convert)
@@ -909,8 +899,7 @@ TEST_F(FtsRocksdbReducerTest, ReducerHandlesBitpackedConvertedSrcSegments) {
                                  {2, "bar baz"},
                              });
 
-  // Sanity: src0 postings are BitPacked AND the side CFs are empty (the
-  // indexer DeleteRange'd them as part of convert_postings_to_bitpacked()).
+  // Sanity: conversion produces BitPacked postings and retains side data.
   {
     std::string raw;
     ASSERT_TRUE(
@@ -921,15 +910,15 @@ TEST_F(FtsRocksdbReducerTest, ReducerHandlesBitpackedConvertedSrcSegments) {
     auto it = std::unique_ptr<rocksdb::Iterator>(
         src0_db_.db_->NewIterator(src0_db_.read_opts_, src0_term_freq_));
     it->SeekToFirst();
-    EXPECT_FALSE(it->Valid());
+    EXPECT_TRUE(it->Valid());
     auto it2 = std::unique_ptr<rocksdb::Iterator>(
         src0_db_.db_->NewIterator(src0_db_.read_opts_, src0_doc_len_));
     it2->SeekToFirst();
-    EXPECT_FALSE(it2->Valid());
+    EXPECT_TRUE(it2->Valid());
     auto it3 = std::unique_ptr<rocksdb::Iterator>(
         src0_db_.db_->NewIterator(src0_db_.read_opts_, src0_max_tf_));
     it3->SeekToFirst();
-    EXPECT_FALSE(it3->Valid());
+    EXPECT_TRUE(it3->Valid());
   }
 
   // ----- src1: insert + flush + convert -----
@@ -982,35 +971,27 @@ TEST_F(FtsRocksdbReducerTest, ReducerHandlesBitpackedConvertedSrcSegments) {
 }
 
 // ============================================================
-// Single-segment reduce when the source side CFs are completely empty:
+// Single-segment reduce when the source side CFs have been dropped:
 // the reducer must rely only on the BitPacked inline payloads (tf, doc_len)
 // for both the merged posting list and the destination stat_cf.  Any
 // regression that re-introduces a side-CF read would surface here as a
 // missing tf / doc_len / score.
 // ============================================================
 
-TEST_F(FtsRocksdbReducerTest, ReduceWithEmptySideCFsProducesBitPacked) {
-  // InsertDocs() already calls convert_postings_to_bitpacked(), so by the
-  // time we reach reduce() the src $TF / $MAX_TF / $DOC_LEN CFs are empty.
+TEST_F(FtsRocksdbReducerTest, ReduceWithDroppedSideCFsProducesBitPacked) {
+  // InsertDocs() converts postings. Explicitly drop side CFs afterward,
+  // matching the sealing path before reduction.
   auto indexer0 = make_src0_indexer();
   InsertDocs(indexer0.get(), {{0, "alpha beta gamma"},
                               {1, "alpha alpha gamma"},
                               {2, "delta epsilon"}});
 
-  // Sanity: side CFs are empty after convert (DeleteRange'd by the indexer).
-  {
-    auto it = std::unique_ptr<rocksdb::Iterator>(
-        src0_db_.db_->NewIterator(src0_db_.read_opts_, src0_term_freq_));
-    it->SeekToFirst();
-    EXPECT_FALSE(it->Valid());
-    auto it2 = std::unique_ptr<rocksdb::Iterator>(
-        src0_db_.db_->NewIterator(src0_db_.read_opts_, src0_doc_len_));
-    it2->SeekToFirst();
-    EXPECT_FALSE(it2->Valid());
-    auto it3 = std::unique_ptr<rocksdb::Iterator>(
-        src0_db_.db_->NewIterator(src0_db_.read_opts_, src0_max_tf_));
-    it3->SeekToFirst();
-    EXPECT_FALSE(it3->Valid());
+  // Auxiliary payloads must no longer be available to the reducer.
+  indexer0->reset_side_cfs();
+  for (auto *cf : {src0_term_freq_, src0_max_tf_, src0_doc_len_}) {
+    const auto name = cf->GetName();
+    ASSERT_TRUE(src0_db_.drop_cf(name).ok());
+    EXPECT_EQ(src0_db_.get_cf
```

---

### Incident Patch 6: `d2f1891f` (2026-09-18)
**Commit Message**: chore: enable readability-identifier-naming check and fix violations (#764)

**File**: `.clang-tidy` (modified, +48/-1)
```diff
@@ -7,7 +7,54 @@ Checks: >
   modernize-use-equals-default,
   modernize-use-equals-delete,
   modernize-redundant-void-arg,
+  readability-identifier-naming,
 WarningsAsErrors: "*"
-HeaderFilterRegex: "^(src|tests|tools)/(?!db/sqlengine/antlr/gen/|db/index/column/fts_column/gen/|include/zvec/ailego/encoding/json/mod_json\\.h).*"
+HeaderFilterRegex: "(^|/)(src|tests|tools)/"
 FormatStyle: none
 SystemHeaders: false
+CheckOptions:
+  # Type-like identifiers use CamelCase (Google style). STL-compatible
+  # container aliases (iterator, value_type, *_t ...) are exempted.
+  readability-identifier-naming.NamespaceCase: lower_case
+  readability-identifier-naming.ClassCase: CamelCase
+  readability-identifier-naming.ClassIgnoredRegexp: '(const_)?(iterator|reverse_iterator)'
+  readability-identifier-naming.StructCase: CamelCase
+  readability-identifier-naming.StructIgnoredRegexp: '(const_)?(iterator|reverse_iterator)'
+  readability-identifier-naming.UnionCase: CamelCase
+  readability-identifier-naming.EnumCase: CamelCase
+  readability-identifier-naming.TypedefCase: CamelCase
+  readability-identifier-naming.TypedefIgnoredRegexp: '(_.*|[a-z][a-z0-9_]*|.*_t|.*_type|(const_)?(iterator|reverse_iterator|pointer|reference))'
+  readability-identifier-naming.TypeAliasCase: CamelCase
+  readability-identifier-naming.TypeAliasIgnoredRegexp: '(_.*|[a-z][a-z0-9_]*|.*_t|.*_type|(const_)?(iterator|reverse_iterator|pointer|reference))'
+  # Member functions use snake_case. Static/free/global functions may use
+  # snake_case or CamelCase. A leading underscore (private-method convention)
+  # or trailing underscore (keyword avoidance, e.g. delete_) is allowed.
+  readability-identifier-naming.MethodCase: lower_case
+  readability-identifier-naming.MethodIgnoredRegexp: '_*[a-z][a-z0-9_]*'
+  readability-identifier-naming.ClassMethodCase: lower_case
+  readability-identifier-naming.ClassMethodIgnoredRegexp: '(_*[a-z][a-z0-9_]*|[A-Z][A-Za-z0-9]*)'
+  readability-identifier-naming.FunctionCase: lower_case
+  readability-identifier-naming.FunctionIgnoredRegexp: '(_*[a-z][a-z0-9_]*|[A-Z][A-Za-z0-9]*)'
+  readability-identifier-naming.GlobalFunctionCase: lower_case
+  readability-identifier-naming.GlobalFunctionIgnoredRegexp: '(_*[a-z][a-z0-9_]*|[A-Z][A-Za-z0-9]*)'
+  # Data members use snake_case; a trailing underscore is allowed but not required.
+  readability-identifier-naming.MemberCase: lower_case
+  readability-identifier-naming.MemberIgnoredRegexp: '_*[a-z][a-z0-9]*(_[a-z0-9]+)*_*'
+  readability-identifier-naming.ConstantMemberCase: lower_case
+  readability-identifier-naming.ConstantMemberIgnoredRegexp: '_*[a-z][a-z0-9]*(_[a-z0-9]+)*_*'
+  # Static data members follow the same snake_case rule as non-static members.
+  readability-identifier-naming.ClassMemberCase: lower_case
+  readability-identifier-naming.ClassMemberIgnoredRegexp: '_*[a-z][a-z0-9]*(_[a-z0-9]+)*_*'
+  # Local variables and parameters use snake_case.
+  readability-identifier-naming.LocalVariableCase: lower_case
+  readability-identifier-naming.ParameterCase: lower_case
+  # Constants keep the existing mixed conventions (kCamelCase / UPPER_CASE /
+  # snake_case) and are intentionally not enforced.
+  readability-identifier-naming.ConstantCase: aNy_CasE
+  readability-identifier-naming.LocalConstantCase: aNy_CasE
+  readability-identifier-naming.StaticConstantCase: aNy_CasE
+  readability-identifier-naming.ClassConstantCase: aNy_CasE
+  readability-identifier-naming.GlobalConstantCase: aNy_CasE
+  readability-identifier-naming.ConstexprVariableCase: aNy_CasE
+  readability-identifier-naming.GlobalVariableCase: aNy_CasE
+  readability-identifier-naming.StaticVariableCase: aNy_CasE
```

**File**: `.github/workflows/clang_tidy.yml` (modified, +29/-5)
```diff
@@ -91,7 +91,17 @@ jobs:
           selected = []
           skipped = []
 
+          # Auto-generated code is exempt from clang-tidy and must not be edited.
+          generated_dir_markers = (
+              "src/db/sqlengine/antlr/gen/",
+              "src/db/index/column/fts_column/gen/",
+          )
+
           for rel_path in changed:
+              norm_rel = rel_path.replace(os.sep, "/")
+              if any(marker in norm_rel for marker in generated_dir_markers):
+                  skipped.append(f"{rel_path} (generated file, exempt from clang-tidy)")
+                  continue
               abs_path = os.path.normpath(str((cwd / rel_path).resolve()))
               if abs_path in compile_entries:
                   selected.append(rel_path)
@@ -176,12 +186,26 @@ jobs:
           failed=0
           for f in "$log_dir"/*.log; do
             [ -e "$f" ] || break
-            failed=1
             src=$(head -1 "$f")
-            echo ""
-            echo "::group::clang-tidy errors: $src"
-            tail -n +2 "$f"
-            echo "::endgroup::"
+            # Diagnostics originating in generated headers (antlr/gen,
+            # fts_column/gen) can leak in via #include from non-generated main
+            # files. Those files are exempt and must not be edited, so drop such
+            # blocks; a log only counts as a failure if real diagnostics remain.
+            body=$(tail -n +2 "$f" | awk '
+              /^[^[:space:]].*:[0-9]+:[0-9]+: (warning|error|note):/ {
+                path = $0
+                sub(/:[0-9]+:[0-9]+:.*/, "", path)
+                skip = (path ~ /(antlr\/gen\/|fts_column\/gen\/)/) ? 1 : 0
+              }
+              { if (!skip) print }
+            ')
+            if printf '%s\n' "$body" | grep -qE ': (warning|error):'; then
+              failed=1
+              echo ""
+              echo "::group::clang-tidy errors: $src"
+              printf '%s\n' "$body"
+              echo "::endgroup::"
+            fi
           done
 
           rm -rf "$log_dir"
```

**File**: `src/ailego/algorithm/integer_quantizer.cc` (modified, +16/-16)
```diff
@@ -129,7 +129,7 @@ static inline void ExpandCandidateDistribution(
  */
 static inline size_t ComputeThreshold(const std::vector<uint32_t> &hist,
                                       const size_t target_bins) {
-  std::vector<float> P_distribution(hist.size());
+  std::vector<float> p_distribution(hist.size());
   size_t zero_point_index = hist.size() / 2;
 
   size_t start_bin = target_bins / 2;
@@ -147,19 +147,19 @@ static inline size_t ComputeThreshold(const std::vector<uint32_t> &hist,
   //! for each zero-axised quantization range: [-threshold, threshold], search
   //! the best solution
   for (size_t threshold = start_bin; threshold <= end_bin; ++threshold) {
-    P_distribution.resize(threshold * 2);
+    p_distribution.resize(threshold * 2);
     auto p_hist = &hist[zero_point_index - threshold];
-    for (size_t i = 0; i != P_distribution.size(); ++i) {
-      P_distribution[i] = static_cast<float>(p_hist[i]);
+    for (size_t i = 0; i != p_distribution.size(); ++i) {
+      p_distribution[i] = static_cast<float>(p_hist[i]);
     }
 
     negative_outliers_count -= hist[zero_point_index - threshold];
     positive_outliers_count -= hist[zero_point_index + threshold - 1];
-    P_distribution[0] += negative_outliers_count;
-    P_distribution[P_distribution.size() - 1] += positive_outliers_count;
+    p_distribution[0] += negative_outliers_count;
+    p_distribution[p_distribution.size() - 1] += positive_outliers_count;
 
     //! Quantize the bins in range [-threshold, threshold] to target_bins
-    std::vector<float> Q_distribution(target_bins, 0);
+    std::vector<float> q_distribution(target_bins, 0);
     float merged_cnt = static_cast<float>(threshold * 2) / target_bins;
     size_t left_boundary = zero_point_index - threshold;
     for (size_t i = 0; i < target_bins; ++i) {
@@ -168,28 +168,28 @@ static inline size_t ComputeThreshold(const std::vector<uint32_t> &hist,
       const size_t start_ceil = static_cast<size_t>(std::ceil(start));
       const size_t end_floor = static_cast<size_t>(std::floor(end));
       if (left_boundary + start_ceil > 0) {
-        Q_distribution[i] +=
+        q_distribution[i] +=
             ((float)start_ceil - start) * hist[left_boundary + start_ceil - 1];
       }
       if (left_boundary + end_floor < hist.size()) {
-        Q_distribution[i] +=
+        q_distribution[i] +=
             (end - (float)end_floor) * hist[left_boundary + end_floor];
       }
 
       for (size_t j = start_ceil; j < end_floor; j++) {
-        Q_distribution[i] += hist[left_boundary + j];
+        q_distribution[i] += hist[left_boundary + j];
       }
     }
-    std::vector<float> Q_expand_distribution;
-    ExpandCandidateDistribution(hist, Q_distribution, threshold,
-                                &Q_expand_distribution);
+    std::vector<float> q_expand_distribution;
+    ExpandCandidateDistribution(hist, q_distribution, threshold,
+                                &q_expand_distribution);
 
     //! Compute Kullback-Leibler Divergence, normalize the smooth the data
     //! first. Ref: http://hanj.cs.illinois.edu/cs412/bk3/KL-divergence.pdf
-    MakeSmooth(P_distribution);
-    MakeSmooth(Q_expand_distribution);
+    MakeSmooth(p_distribution);
+    MakeSmooth(q_expand_distribution);
     double divergence =
-        ComputeKlDivergence(P_distribution, Q_expand_distribution);
+        ComputeKlDivergence(p_distribution, q_expand_distribution);
 
     if (divergence < min_divergence) {
       min_divergence = divergence;
```

**File**: `src/ailego/encoding/json/mod_json.c` (modified, +4/-0)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+// NOLINTBEGIN
+
 #include <float.h>
 #include <stdio.h>
 #include <stdlib.h>
@@ -3589,3 +3591,5 @@ mod_json_string_t *mod_json_dump(mod_json_value_t *val) {
   }
   return str;
 }
+
+// NOLINTEND
```

**File**: `src/ailego/internal/cpu_features.h` (modified, +3/-0)
```diff
@@ -21,6 +21,8 @@ namespace internal {
 
 /*! Cpu Features
  */
+// NOLINTBEGIN(readability-identifier-naming): identifiers mirror CPUID feature
+// mnemonics (SSE4_1, AVX512_VNNI, L1_ECX ...) and stay in hardware casing.
 class CpuFeatures {
  public:
   //! 16-bit FP conversions
@@ -376,6 +378,7 @@ class CpuFeatures {
   };
   static StaticFlags static_flags_;
 };
+// NOLINTEND(readability-identifier-naming)
 
 }  // namespace internal
 }  // namespace ailego
```

**File**: `src/ailego/io/iouring_def.h` (modified, +5/-0)
```diff
@@ -99,6 +99,9 @@
 // Struct definitions (copied verbatim from <linux/io_uring.h>)
 // ---------------------------------------------------------------------------
 
+// NOLINTBEGIN(readability-identifier-naming): types below are copied verbatim
+// from the Linux kernel ABI (<linux/io_uring.h>) and must keep their names.
+
 // Submission queue entry — 64 bytes.
 struct io_uring_sqe {
   uint8_t opcode;   // type of operation for this sqe
@@ -219,4 +222,6 @@ static inline void io_uring_prep_write(struct io_uring_sqe *sqe, int fd,
 // End: struct and constant definitions from <linux/io_uring.h>
 // ---------------------------------------------------------------------------
 
+// NOLINTEND(readability-identifier-naming)
+
 #endif  // __linux__
```

**File**: `src/ailego/io/libaio_def.h` (modified, +5/-0)
```diff
@@ -34,6 +34,9 @@
 
 #if (defined(__linux) || defined(__linux__)) && !defined(__ANDROID__)
 
+// NOLINTBEGIN(readability-identifier-naming): types below are copied verbatim
+// from the Linux kernel ABI (<libaio.h>) and must keep their upstream names.
+
 struct sockaddr;
 struct iovec;
 
@@ -187,4 +190,6 @@ static inline void io_prep_pread(struct iocb *iocb, int fd, void *buf,
 // End: type and struct definitions from <libaio.h>
 // ---------------------------------------------------------------------------
 
+// NOLINTEND(readability-identifier-naming)
+
 #endif  // __linux__
```

**File**: `src/ailego/io/libaio_loader.h` (modified, +3/-3)
```diff
@@ -78,6 +78,9 @@ class LibAioLoader {
   aio_submit_fn io_submit;
   aio_getevents_fn io_getevents;
 
+  LibAioLoader(const LibAioLoader &) = delete;
+  LibAioLoader &operator=(const LibAioLoader &) = delete;
+
  private:
   LibAioLoader()
       : io_setup(nullptr),
@@ -91,9 +94,6 @@ class LibAioLoader {
     }
   }
 
-  LibAioLoader(const LibAioLoader &) = delete;
-  LibAioLoader &operator=(const LibAioLoader &) = delete;
-
   void try_load() {
     // On Ubuntu 24.04 the libaio package was renamed with the t64 suffix
     // (64-bit time_t transition), so probe both spellings.
```

---

### Incident Patch 7: `9b3da891` (2026-09-17)
**Commit Message**: fix(reducer): reuse optimize thread pool for builders (#757)

**File**: `src/core/mixed_reducer/mixed_streamer_reducer.cc` (modified, +4/-2)
```diff
@@ -715,15 +715,17 @@ int MixedStreamerReducer::IndexBuild(IndexHolder::Pointer target_holder) {
       return core::IndexError_Runtime;
     }
   }
-  int ret = target_builder_->train(target_holder);
+  auto threads =
+      std::make_shared<BorrowedSingleQueueIndexThreads>(*thread_pool_);
+  int ret = target_builder_->train(threads, target_holder);
   if (merged_holder_ && merged_holder_->status() != 0) {
     return merged_holder_->status();
   }
   if (ret != 0) {
     LOG_ERROR("Failed to train target builder, ret=%d", ret);
     return ret;
   }
-  ret = target_builder_->build(target_holder);
+  ret = target_builder_->build(std::move(threads), target_holder);
   if (merged_holder_ && merged_holder_->status() != 0) {
     return merged_holder_->status();
   }
```

**File**: `src/include/zvec/core/framework/index_threads.h` (modified, +58/-0)
```diff
@@ -166,5 +166,63 @@ class SingleQueueIndexThreads : public IndexThreads {
   ailego::ThreadPool pool_{};
 };
 
+/*! Borrowed Single Queue Index Threads
+ *
+ *  Adapts an existing thread pool to IndexThreads. The caller must keep the
+ *  pool alive for the lifetime of this object.
+ */
+class BorrowedSingleQueueIndexThreads : public IndexThreads {
+ public:
+  //! Constructor
+  explicit BorrowedSingleQueueIndexThreads(ailego::ThreadPool &pool)
+      : pool_(pool) {}
+
+  //! Destructor
+  ~BorrowedSingleQueueIndexThreads() override = default;
+
+  //! Retrieve thread count in pool
+  size_t count() const override {
+    return pool_.count();
+  }
+
+  //! Stop all threads
+  void stop() override {
+    pool_.stop();
+  }
+
+  //! Submit a task to be executed asynchronous
+  void submit(ailego::ClosureHandler &&task) override {
+    while (pool_.pending_count() >= kMaxQueueSize) {
+      std::this_thread::sleep_for(std::chrono::milliseconds(1));
+    }
+    pool_.enqueue_and_wake(std::move(task));
+  }
+
+  //! Make a task group
+  TaskGroup::Pointer make_group() override {
+    return std::make_shared<SingleQueueIndexThreads::SingleQueueTaskGroup>(
+        pool_.make_group());
+  }
+
+  //! Get the current work thread index
+  int indexof_this() const override {
+    return pool_.indexof_this();
+  }
+
+ public:
+  //! Disable them
+  BorrowedSingleQueueIndexThreads(const BorrowedSingleQueueIndexThreads &) =
+      delete;
+  BorrowedSingleQueueIndexThreads(BorrowedSingleQueueIndexThreads &&) = delete;
+  BorrowedSingleQueueIndexThreads &operator=(
+      const BorrowedSingleQueueIndexThreads &) = delete;
+
+ private:
+  static constexpr size_t kMaxQueueSize = 4096u;
+
+  //! Members
+  ailego::ThreadPool &pool_;
+};
+
 }  // namespace core
 }  // namespace zvec
```

**File**: `tests/core/mixed_reducer/merged_provider_index_holder_test.cc` (modified, +56/-3)
```diff
@@ -353,14 +353,20 @@ class ReadFailureReformer : public IndexReformer {
 class RetainingTestBuilder : public IndexBuilder {
  public:
   explicit RetainingTestBuilder(
-      const std::string &name = "SnapshotTestBuilder") {
+      const std::string &name = "SnapshotTestBuilder",
+      ailego::ThreadPool *expected_pool = nullptr)
+      : expected_pool_(expected_pool) {
     set_name(name);
   }
-  int train(IndexThreads::Pointer, IndexHolder::Pointer) override {
+  int train(IndexThreads::Pointer threads, IndexHolder::Pointer) override {
     ++train_calls;
+    train_thread_count = threads ? threads->count() : 0;
+    train_used_expected_pool = UsesExpectedPool(threads);
     return 0;
   }
-  int build(IndexThreads::Pointer, IndexHolder::Pointer input) override {
+  int build(IndexThreads::Pointer threads, IndexHolder::Pointer input) override {
+    build_thread_count = threads ? threads->count() : 0;
+    build_used_expected_pool = UsesExpectedPool(threads);
     holder = std::move(input);
     return 0;
   }
@@ -373,9 +379,28 @@ class RetainingTestBuilder : public IndexBuilder {
   }
 
   size_t train_calls{0};
+  size_t train_thread_count{0};
+  size_t build_thread_count{0};
+  bool train_used_expected_pool{false};
+  bool build_used_expected_pool{false};
   IndexHolder::Pointer holder;
 
  private:
+  bool UsesExpectedPool(const IndexThreads::Pointer &threads) const {
+    if (!threads || !expected_pool_) {
+      return false;
+    }
+    std::atomic<bool> used{false};
+    auto group = threads->make_group();
+    group->submit(ailego::Closure::New([&]() {
+      used.store(expected_pool_->indexof_this() >= 0,
+                 std::memory_order_relaxed);
+    }));
+    group->wait_finish();
+    return used.load(std::memory_order_relaxed);
+  }
+
+  ailego::ThreadPool *expected_pool_{nullptr};
   Stats stats_;
 };
 
@@ -482,6 +507,34 @@ TEST(MergedProviderIndexHolderTest,
   EXPECT_EQ(nullptr, builder->holder);
 }
 
+TEST(MergedProviderIndexHolderTest,
+     IvfBuilderUsesProviderBackedInputAndReducerThreadPool) {
+  auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
+  ailego::ThreadPool pool(2, false);
+  auto builder =
+      std::make_shared<RetainingTestBuilder>("IVFBuilder", &pool);
+  MixedStreamerReducer reducer;
+  ailego::Params params;
+  params.set(PARAM_MIXED_STREAMER_REDUCER_NUM_OF_ADD_THREADS, 1);
+  ASSERT_EQ(0, reducer.init(params));
+  reducer.set_thread_pool(&pool);
+  ASSERT_EQ(0, reducer.set_target_streamer_wiht_info(
+                   builder, source, nullptr, nullptr,
+                   IndexQueryMeta(IndexMeta::DataType::DT_FP32, kDimension)));
+  ASSERT_EQ(0, reducer.feed_streamer_with_reformer(source, nullptr));
+  ASSERT_EQ(0, reducer.reduce({}));
+  EXPECT_EQ(pool.count(), builder->train_thread_count);
+  EXPECT_EQ(pool.count(), builder->build_thread_count);
+  EXPECT_TRUE(builder->train_used_expected_pool);
+  EXPECT_TRUE(builder->build_used_expected_pool);
+  ASSERT_NE(nullptr, builder->holder);
+  auto *merged =
+      dynamic_cast<MergedProviderIndexHolder *>(builder->holder.get());
+  ASSERT_NE(nullptr, merged);
+  EXPECT_EQ((std::vector<std::pair<uint64_t, float>>{{0, 0.0F}, {1, 1.0F}}),
+            ReadAll(merged));
+}
+
 TEST(MergedProviderIndexHolderTest, PlainTurboFp32KeepsOrdinalReads) {
   auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
   auto quantizer = std::make_shared<turbo::Fp32Quantizer>();
```

---

### Incident Patch 8: `bb94aa4c` (2026-09-16)
**Commit Message**: fix(quantization): decode turbo sources during merge training (#763)

**File**: `python/tests/test_uniform_quantization.py` (modified, +6/-3)
```diff
@@ -341,6 +341,9 @@ def test_uniform_quantization_survives_reopen(tmp_path, quantize_type, index_typ
     assert all(np.isfinite(doc.score) for doc in after)
 
 
+@pytest.mark.parametrize(
+    "use_flat_contiguous_memory", [False, True], ids=["regular", "contiguous"]
+)
 @pytest.mark.parametrize(
     "quantize_type",
     [
@@ -356,7 +359,7 @@ def test_uniform_quantization_survives_reopen(tmp_path, quantize_type, index_typ
     ids=["flat_fp16", "flat_uint8"],
 )
 def test_uniform_quantizer_uses_flat_storage_vectors(
-    tmp_path, quantize_type, index_type, flat_data_type
+    tmp_path, quantize_type, index_type, flat_data_type, use_flat_contiguous_memory
 ):
     """Uniform training and encoding must consume the configured Flat type."""
     dimension = 32
@@ -383,7 +386,7 @@ def build_and_search(label, vectors, flat_data_type):
                 search_list_size=64,
                 quantize_type=quantize_type,
                 use_contiguous_memory=True,
-                use_flat_contiguous_memory=True,
+                use_flat_contiguous_memory=use_flat_contiguous_memory,
                 flat_data_type=flat_data_type,
             )
             query_param = VamanaQueryParam(
@@ -396,7 +399,7 @@ def build_and_search(label, vectors, flat_data_type):
                 m=16,
                 ef_construction=64,
                 quantize_type=quantize_type,
-                use_flat_contiguous_memory=True,
+                use_flat_contiguous_memory=use_flat_contiguous_memory,
                 flat_data_type=flat_data_type,
             )
             query_param = HnswQueryParam(ef=doc_count, is_linear=True)
```

**File**: `src/core/interface/index.cc` (modified, +24/-12)
```diff
@@ -34,14 +34,15 @@ bool has_group_by_search(const BaseIndexQueryParam::Pointer &search_param) {
 }
 
 // A multipass training view over merge sources. Decode through each source's
-// existing reformer, just as the merge reducer does. This lets global
-// quantizers train from FP16/UINT8 Flat references without materializing an
-// additional full-dataset FP32 copy or adding input types to the quantizers.
+// existing quantizer or reformer, just as the merge reducer does. This lets
+// global quantizers train from FP16/UINT8 Flat references without materializing
+// an additional full-dataset FP32 copy or adding input types to the quantizers.
 class MergeSourceIndexHolder final : public core::IndexHolder {
  public:
   struct Source {
     core::IndexHolder::Pointer holder;
     core::IndexReformer::Pointer reformer;
+    std::shared_ptr<turbo::Quantizer> quantizer;
     core::IndexQueryMeta stored_meta;
   };
 
@@ -87,9 +88,12 @@ class MergeSourceIndexHolder final : public core::IndexHolder {
         owner_->error_ = core::IndexError_ReadData;
         return;
       }
-      if (source_->reformer) {
-        const int ret =
-            source_->reformer->revert(data_, source_->stored_meta, &decoded_);
+      if (source_->quantizer || source_->reformer) {
+        const int ret = source_->quantizer
+                            ? source_->quantizer->dequantize(
+                                  data_, source_->stored_meta, &decoded_)
+                            : source_->reformer->revert(
+                                  data_, source_->stored_meta, &decoded_);
         if (ret != 0) {
           owner_->error_ = ret;
           return;
@@ -1422,18 +1426,26 @@ int Index::merge(const std::vector<Index::Pointer> &indexes,
               input_vector_meta_.data_type() ||
           index->input_vector_meta_.dimension() !=
               input_vector_meta_.dimension() ||
-          (!index->reformer_ &&
+          (!index->reformer_ && !index->turbo_quantizer_ &&
            (provider->data_type() != input_vector_meta_.data_type() ||
             provider->dimension() != input_vector_meta_.dimension() ||
             provider->element_size() != input_vector_meta_.element_size()))) {
         LOG_ERROR("Merge-source vector type mismatch");
         return core::IndexError_Mismatch;
       }
-      // Use the actual stored metadata, including packed quantizer dimensions.
-      core::IndexQueryMeta stored_meta(provider->data_type(),
-                                       provider->dimension());
-      sources.push_back(
-          {std::move(provider), index->reformer_, std::move(stored_meta)});
+      // Preserve the stored layout, including packed dimensions and norm tails.
+      const auto &meta = index->streamer_->meta();
+      core::IndexQueryMeta stored_meta{
+          meta.meta_type(),
+          provider->data_type(),
+          meta.unit_size(),
+          static_cast<uint32_t>(provider->dimension()),
+          index->turbo_quantizer_
+              ? static_cast<uint32_t>(index->turbo_quantizer_->type())
+              : 0,
+          meta.extra_meta_size()};
+      sources.push_back({std::move(provider), index->reformer_,
+                         index->turbo_quantizer_, std::move(stored_meta)});
     }
     auto holder = std::make_shared<MergeSourceIndexHolder>(std::move(sources),
                                                            input_vector_meta_);
```

---

### Incident Patch 9: `a9e1e0e2` (2026-09-15)
**Commit Message**: perf(ivf): reduce peak memory usage during index build and merge (#733)

Co-authored-by: Jalin Wang <[REDACTED_EMAIL]>

**File**: `src/core/algorithm/cluster/holder_cluster.h` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+#pragma once
+
+#include <zvec/core/framework/index_cluster.h>
+#include <zvec/core/framework/index_holder.h>
+
+namespace zvec {
+namespace core {
+
+// Optional, internal capability for clustering a holder without materializing
+// intermediate IndexFeatures. The holder is consumed only for this call; it is
+// not mounted for later cluster/classify/label calls. NotImplemented must be
+// returned before creating an iterator or changing centroids so callers can
+// safely fall back to the ordinary IndexFeatures path.
+class HolderCluster {
+ public:
+  virtual ~HolderCluster() = default;
+
+  virtual int cluster_holder(IndexThreads::Pointer threads,
+                             IndexHolder::Pointer holder,
+                             IndexCluster::CentroidList &cents) = 0;
+};
+
+}  // namespace core
+}  // namespace zvec
```

**File**: `src/core/algorithm/cluster/opt_kmeans_cluster.cc` (modified, +172/-77)
```diff
@@ -11,12 +11,15 @@
 // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 // See the License for the specific language governing permissions and
 // limitations under the License.
+#include <cstdint>
+#include <cstring>
 #include <ailego/algorithm/kmeans.h>
 #include <ailego/container/reservoir.h>
 #include <zvec/core/framework/index_cluster.h>
 #include <zvec/core/framework/index_error.h>
 #include <zvec/core/framework/index_factory.h>
 #include "cluster_params.h"
+#include "holder_cluster.h"
 
 namespace zvec {
 namespace core {
@@ -51,7 +54,12 @@ class OptKmeansAlgorithm : public IndexCluster {
 
   //! Cluster
   int cluster(IndexThreads::Pointer threads,
-              IndexCluster::CentroidList &cents) override = 0;
+              IndexCluster::CentroidList &cents) override {
+    return cluster_impl(std::move(threads), nullptr, cents);
+  }
+
+  int cluster_holder(IndexThreads::Pointer threads, IndexHolder::Pointer holder,
+                     IndexCluster::CentroidList &cents);
 
   //! Cleanup Cluster
   int cleanup() override;
@@ -63,6 +71,66 @@ class OptKmeansAlgorithm : public IndexCluster {
   int update(const ailego::Params &params) override;
 
  protected:
+  virtual int cluster_impl(IndexThreads::Pointer threads,
+                           IndexHolder::Pointer holder,
+                           IndexCluster::CentroidList &cents) = 0;
+
+  int check_dimension() const;
+
+  // All kernels own their training matrix. Consume each input before advancing
+  // its iterator; never materialize a second, full IndexFeatures corpus.
+  template <typename Algorithm>
+  int load_features(Algorithm &algorithm, const IndexHolder::Pointer &holder) {
+    using StoreType = typename Algorithm::StoreType;
+    const size_t count = holder ? holder->count() : features_->count();
+    const size_t bytes = meta_.element_size();
+    std::vector<StoreType> aligned;
+    auto append = [&](const void *data) -> int {
+      if (!data) {
+        return IndexError_InvalidArgument;
+      }
+      // Providers may return packed or unaligned, reusable storage. At most one
+      // row of scratch is needed; preserve the kernel's physical
+      // representation.
+      if (reinterpret_cast<uintptr_t>(data) % alignof(StoreType) != 0) {
+        aligned.resize(bytes / sizeof(StoreType) +
+                       (bytes % sizeof(StoreType) != 0));
+        std::memcpy(aligned.data(), data, bytes);
+        data = aligned.data();
+      }
+      algorithm.append(reinterpret_cast<const StoreType *>(data),
+                       meta_.dimension());
+      return 0;
+    };
+
+    algorithm.feature_matrix_reserve(count);
+    if (holder) {
+      auto iter = holder->create_iterator();
+      if (!iter) {
+        return IndexError_Runtime;
+      }
+      size_t loaded = 0;
+      for (; iter->is_valid(); iter->next()) {
+        if (loaded == count) {
+          return IndexError_InvalidArgument;
+        }
+        int ret = append(iter->data());
+        if (ret != 0) {
+          return ret;
+        }
+        ++loaded;
+      }
+      return loaded == count ? 0 : IndexError_InvalidArgument;
+    }
+    for (size_t i = 0; i < count; ++i) {
+      int ret = append(features_->element(i));
+      if (ret != 0) {
+        return ret;
+      }
+    }
+    return 0;
+  }
+
   //! Update parameters
   void update_params(const ailego::Params &params);
 
@@ -372,35 +440,67 @@ int OptKmeansAlgorithm::mount(IndexFeatures::Pointer feats) {
     return IndexError_Mismatch;
   }
 
-  // Check dimension
+  int ret = check_dimension();
+  if (ret != 0) {
+    return ret;
+  }
+  features_ = std::move(feats);
+  return 0;
+}
+
+int OptKmeansAlgorithm::check_dimension() const {
   auto type_ = meta_.data_type();
   switch (type_) {
     case IndexMeta::DataType::DT_INT4:
-      if (feats->dimension() % 8 != 0) {
+      if (meta_.dimension() % 8 != 0) {
         LOG_ERROR(
             "Unsupported feature dimension %zu (dimension of int4 "
             "must be an integer multiple of 8).",
-            feats->dimension());
+            static_cast<size_t>(meta_.dimension()));
         return IndexError_Mismatch;
       }
       break;
     case IndexMeta::DataType::DT_INT8:
-      if (feats->dimension() % 4 != 0) {
+      if (meta_.dimension() % 4 != 0) {
         LOG_ERROR(
             "Unsupported feature dimension %zu (dimension of int8 "
             "must be an integer multiple of 4).",
-            feats->dimension());
+            static_cast<size_t>(meta_.dimension()));
         return IndexError_Mismatch;
       }
       break;
     default:
       break;
   }
 
-  features_ = std::move(feats);
   return 0;
 }
 
+int OptKmeansAlgorithm::cluster_holder(IndexThreads::Pointer threads,
+                                       IndexHolder::Pointer holder,
+                                       IndexCluster::CentroidList &cents) {
+  if (!holder || !holder->count() || !meta_.dimension()) {
+    return IndexEr
```

**File**: `src/core/algorithm/cluster/stratified_cluster_trainer.cc` (modified, +94/-44)
```diff
@@ -12,12 +12,14 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 #include "stratified_cluster_trainer.h"
+#include <cmath>
 #include <zvec/ailego/utility/string_helper.h>
 #include <zvec/ailego/utility/time_helper.h>
 #include <zvec/core/framework/index_error.h>
 #include <zvec/core/framework/index_factory.h>
 #include <zvec/core/framework/index_helper.h>
 #include "cluster_params.h"
+#include "holder_cluster.h"
 
 namespace zvec {
 namespace core {
@@ -153,62 +155,110 @@ int StratifiedClusterTrainer::train(IndexThreads::Pointer threads,
     }
   }
 
-  size_t train_sample_count = std::max(
-      sample_count_, static_cast<uint32_t>(sample_ratio_ * holder->count()));
-
-  IndexFeatures::Pointer features;
-  if (train_sample_count > 0) {
-    LOG_INFO(
-        "Train sampling, SampleCount=%u, SampleRatio=%f, HolderCount=%lu, "
-        "TrainCount=%lu",
-        sample_count_, sample_ratio_, holder->count(), train_sample_count);
-
-    auto sampler = std::make_shared<SampleIndexFeatures<CompactIndexFeatures>>(
-        meta_, train_sample_count);
-    size_t pre_reserve = train_sample_count < holder->count()
-                             ? train_sample_count
-                             : holder->count();
-    sampler->reserve(pre_reserve);
-    for (auto iter = holder->create_iterator(); iter && iter->is_valid();
-         iter->next()) {
-      sampler->emplace(iter->data());
-    }
-    features = sampler;
-    stats_.set_trained_count(train_sample_count);
-  } else {
-    LOG_INFO(
-        "Do no sampling, SampleCount=%u, SampleRatio=%f, "
-        "HolderCount=%lu, TrainCount=%lu",
-        sample_count_, sample_ratio_, holder->count(), holder->count());
-
-    auto no_sampler = std::make_shared<CompactIndexFeatures>(meta_);
-    for (auto iter = holder->create_iterator(); iter && iter->is_valid();
-         iter->next()) {
-      no_sampler->emplace(iter->data());
+  const size_t holder_count = holder->count();
+  const bool has_known_count = holder_count != static_cast<size_t>(-1);
+  if (!std::isfinite(sample_ratio_) || sample_ratio_ < 0.0f ||
+      (!has_known_count && sample_ratio_ > 0.0f)) {
+    return IndexError_InvalidArgument;
+  }
+  size_t train_sample_count = sample_count_;
+  if (has_known_count && sample_ratio_ > 0.0f) {
+    size_t ratio_sample_count = holder_count;
+    if (sample_ratio_ < 1.0f) {
+      const float requested = sample_ratio_ * holder_count;
+      // Preserve the existing sampling calculation, but clamp before converting
+      // to an integer: rounded counts and ratios above one must not overflow.
+      if (requested < static_cast<float>(holder_count)) {
+        ratio_sample_count = static_cast<size_t>(requested);
+      }
     }
+    train_sample_count = std::max(train_sample_count, ratio_sample_count);
+  }
 
-    features = no_sampler;
-    stats_.set_trained_count(holder->count());
+  centroids_.clear();
+  int result = IndexError_NotImplemented;
+  // Reservoir sampling preserves every row in input order when its capacity
+  // covers the known corpus. Such a request is full training, too.
+  if (has_known_count &&
+      (train_sample_count == 0 || train_sample_count >= holder_count)) {
+    auto streaming_cluster = dynamic_cast<HolderCluster *>(cluster_.get());
+    if (streaming_cluster) {
+      // A previous fallback train may still have features mounted. They are
+      // not needed by a new one-shot train and must not overlap its matrix.
+      result = cluster_->reset();
+      if (result != 0) {
+        return result;
+      }
+      result = streaming_cluster->cluster_holder(threads, holder, centroids_);
+      if (result == 0) {
+        stats_.set_trained_count(holder_count);
+        LOG_INFO("Trained directly from holder, HolderCount=%lu", holder_count);
+      }
+    }
   }
-  stats_.set_discarded_count(0);
 
-  // Holder is not needed, cleanup it.
-  holder.reset();
+  // Only an unsupported capability may fall back. Real read/validation errors
+  // must propagate, rather than retrying an already consumed holder.
+  if (result == IndexError_NotImplemented) {
+    IndexFeatures::Pointer features;
+    if (train_sample_count > 0) {
+      LOG_INFO(
+          "Train sampling, SampleCount=%u, SampleRatio=%f, HolderCount=%lu, "
+          "TrainCount=%lu",
+          sample_count_, sample_ratio_, holder->count(), train_sample_count);
+
+      auto sampler =
+          std::make_shared<SampleIndexFeatures<CompactIndexFeatures>>(
+              meta_, train_sample_count);
+      size_t pre_reserve = train_sample_count < holder->count()
+                               ? train_sample_count
+                               : holder->count();
+      sampler->reserve(pre_reserve);
+      for (auto iter = holder->create_iterator(); iter && iter->is_valid();
+           iter->next()) {
+        sampler->emplace(iter->data());
+      }
+      features = sampler;
+    } else {
+      LOG_IN
```

**File**: `src/core/algorithm/ivf/ivf_builder.cc` (modified, +107/-22)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 #include "ivf_builder.h"
+#include <algorithm>
+#include <limits>
 #include <ailego/pattern/defer.h>
 #include <zvec/ailego/utility/string_helper.h>
 #include "algorithm/cluster/cluster_params.h"
@@ -190,6 +192,8 @@ int IVFBuilder::cleanup() {
   labels_.clear();
   centroid_index_.reset();
   holder_.reset();
+  source_reader_.reset();
+  source_holder_.reset();
   converted_meta_ = meta_;
   converter_.reset();
   quantized_meta_ = meta_;
@@ -363,22 +367,49 @@ int IVFBuilder::build(IndexThreads::Pointer threads,
     }
   }
 
-  holder_ = std::make_shared<RandomAccessIndexHolder>(meta_);
-  if (!holder_) {
-    return IndexError_NoMemory;
-  }
-  if (holder->count() > 0) {
-    holder_->reserve(holder->count());
+  holder_.reset();
+  source_reader_.reset();
+  source_holder_.reset();
+  labels_.clear();
+  quantizers_.clear();
+  error_ = false;
+  err_code_ = 0;
+
+  // Borrow only a holder with explicit ordinal-read semantics. Sequential
+  // iterator pointers may be transient, so merely retaining them is unsafe.
+  auto *ordinal_holder = dynamic_cast<OrdinalAccessHolder *>(holder.get());
+  if (ordinal_holder && !converter_ &&
+      params_.get_as_string(PARAM_IVF_BUILDER_QUANTIZER_CLASS).empty() &&
+      holder->count() <= std::numeric_limits<uint32_t>::max()) {
+    int ret = ordinal_holder->create_ordinal_reader(&source_reader_);
+    if (ret != 0 && ret != IndexError_NotImplemented) {
+      return ret;
+    }
+    if (ret == 0) {
+      if (!source_reader_) {
+        return IndexError_Runtime;
+      }
+      source_holder_ = holder;
+    }
   }
-  for (auto iter = holder->create_iterator(); iter && iter->is_valid();
-       iter->next()) {
-    holder_->emplace(iter->key(), iter->data());
+
+  IndexHolder::Pointer converted_holder = source_holder_;
+  if (!source_holder_) {
+    holder_ = std::make_shared<RandomAccessIndexHolder>(meta_);
+    if (!holder_) {
+      return IndexError_NoMemory;
+    }
+    if (holder->count() > 0) {
+      holder_->reserve(holder->count());
+    }
+    for (auto iter = holder->create_iterator(); iter && iter->is_valid();
+         iter->next()) {
+      holder_->emplace(iter->key(), iter->data());
+    }
+    converted_holder = holder_;
   }
 
-  // Holder is not needed, cleanup it.
   holder.reset();
-
-  IndexHolder::Pointer converted_holder = holder_;
   if (converter_) {
     int ret = converter_->transform(holder_);
     ivf_check_with_msg(ret, "Failed to transform by converter %s",
@@ -391,6 +422,15 @@ int IVFBuilder::build(IndexThreads::Pointer threads,
   ivf_check_with_msg(ret, "Failed to build index for %s",
                      IndexError::What(ret));
 
+  if (source_reader_) {
+    // Label workers finish out of order. Restore ordinal order within each
+    // bucket so dump opens each source at most once per bucket, rather than
+    // bouncing between providers for individual vectors.
+    for (auto &label : labels_) {
+      std::sort(label.begin(), label.end());
+    }
+  }
+
   ret = this->prepare_quantizer(threads.get());
   ivf_check_error_code(ret);
 
@@ -416,7 +456,7 @@ int IVFBuilder::dump(const IndexDumper::Pointer &dumper) {
 
   // the fitting function for the follow points: 1000000(0.02) 10000000(0.01)
   // 50000000(0.005) 100000000(0.001)
-  float scan_ratio = -0.004 * std::log(holder_->count()) + 0.0751;
+  float scan_ratio = -0.004 * std::log(stats_.built_count()) + 0.0751;
   scan_ratio = std::max(scan_ratio, 0.0001f);
 
   // Set Searcher Params
@@ -626,30 +666,69 @@ int IVFBuilder::build_label_index(IndexThreads *threads,
   });
 
   size_t elem_size = holder->element_size();
+  if (elem_size == 0) {
+    return IndexError_InvalidArgument;
+  }
+  // Bound copied vectors by bytes, including queued and running batches.
+  // A single vector larger than the budget is still allowed to make progress.
+  const size_t window_size =
+      std::max<size_t>(1, kLabelMemoryBudget / elem_size);
+  size_t window_count = 0;
   std::shared_ptr<VectorList> vectors = std::make_shared<VectorList>();
   ivf_assert(vectors, IndexError_NoMemory);
+  vectors->reserve(std::min(kBatchSize, window_size));
   for (; iter && iter->is_valid(); iter->next()) {
     ivf_assert(!error_, err_code_);
-    vectors->emplace_back(iter->data(), elem_size, id);
+    if (id >= holder->count() || id >= std::numeric_limits<uint32_t>::max()) {
+      return IndexError_Mismatch;
+    }
+    const void *data = iter->data();
+    if (!data) {
+      return IndexError_Runtime;
+    }
+    vectors->emplace_back(data, elem_size, id);
     id++;
-    if (vectors->size() == kBatchSize || id == holder_->count()) {
+    ++window_count;
+    if (vectors->size() == kBatchSize || window_count == window_size ||
+        id == holder->count()) {
       auto task = ailego::Closure ::New(const_cast<IVFBuilder *>(this),
                                        
```

**File**: `src/core/algorithm/ivf/ivf_builder.h` (modified, +9/-1)
```diff
@@ -15,6 +15,7 @@
 
 #include <zvec/core/framework/index_builder.h>
 #include <zvec/core/framework/index_meta.h>
+#include "utility/ordinal_access_holder.h"
 #include "ivf_centroid_index.h"
 
 namespace zvec {
@@ -225,6 +226,9 @@ class IVFBuilder : public IndexBuilder {
   //! Dump the index to dumper
   int dump_index(const IndexDumper::Pointer &dumper);
 
+  //! Read one original vector; the returned data is consumed before next read.
+  int read_vector(size_t id, uint64_t *key, const void **data);
+
   //! Prepare the quantizer for inverted index
   int prepare_quantizer(IndexThreads *threads);
 
@@ -273,7 +277,7 @@ class IVFBuilder : public IndexBuilder {
 
  private:
   //! Constants
-  static constexpr size_t kThreadPoolQueueSize = 300u;
+  static constexpr size_t kLabelMemoryBudget = 4u * 1024u * 1024u;
   static constexpr size_t kBatchSize = 10u;
   static constexpr size_t kDefaultBlockCount = 32u;
 
@@ -295,6 +299,10 @@ class IVFBuilder : public IndexBuilder {
   IVFCentroidIndex::Pointer centroid_index_{};
   IVFCentroidIndex::Pointer searcher_centroid_index_{};
   RandomAccessIndexHolder::Pointer holder_{};
+  // Keep the immutable source alive through dump, including repeated dumps.
+  // The reader owns only a key map and at most one provider, never all vectors.
+  IndexHolder::Pointer source_holder_{};
+  OrdinalAccessHolder::Reader::Pointer source_reader_{};
   IndexMeta converted_meta_{};
   IndexConverter::Pointer converter_{};
   IndexMeta quantized_meta_{};
```

**File**: `src/core/interface/indexes/ivf_index.cc` (modified, +120/-39)
```diff
@@ -14,6 +14,7 @@
 
 #include <memory>
 #include <string>
+#include <ailego/pattern/defer.h>
 #include <zvec/core/interface/index.h>
 #include "algorithm/cluster/cluster_params.h"
 #include "algorithm/ivf/ivf_params.h"
@@ -146,8 +147,8 @@ int IVFIndex::GenerateHolder() {
 }
 
 int IVFIndex::add(const VectorData &vector, uint32_t doc_id) {
-  if (is_trained_) {
-    LOG_ERROR("this IVF index is trained");
+  if (is_trained_ || build_stage_ != BuildStage::kCollecting) {
+    LOG_ERROR("this IVF index is trained or has a pending build");
     return core::IndexError_Runtime;
   }
   if (!std::holds_alternative<DenseVector>(vector.vector)) {
@@ -170,19 +171,91 @@ int IVFIndex::add(const VectorData &vector, uint32_t doc_id) {
 }
 
 int IVFIndex::train() {
-  GenerateHolder();
-  builder_->train(holder_);
-  builder_->build(holder_);
-  auto dumper = core::IndexFactory::CreateDumper("FileDumper");
+  if (is_trained_) {
+    return 0;
+  }
+  if (build_stage_ == BuildStage::kCollecting) {
+    int ret = GenerateHolder();
+    if (ret != 0) {
+      return ret;
+    }
+    ret = builder_->train(holder_);
+    if (ret != 0) {
+      return ret;
+    }
+    build_stage_ = BuildStage::kTrained;
+  }
+  if (build_stage_ == BuildStage::kTrained) {
+    int ret = builder_->build(holder_);
+    if (ret != 0) {
+      return ret;
+    }
+    build_stage_ = BuildStage::kBuilt;
+  }
+  return DumpAndOpen();
+}
 
-  dumper->create(file_path_);
-  builder_->dump(dumper);
-  // Dump converter state (e.g., rotator for INT8+rotate) to dumper
-  if (converter_ && converter_->dump(dumper) != 0) {
-    LOG_ERROR("Failed to dump converter, path: %s", file_path_.c_str());
-    return core::IndexError_Runtime;
+int IVFIndex::ResetBuilder() {
+  auto next_builder = core::IndexFactory::CreateBuilder("IVFBuilder");
+  if (!next_builder) {
+    return core::IndexError_NoExist;
+  }
+  int ret =
+      next_builder->init(converter_ ? converter_->meta() : proxima_index_meta_,
+                         proxima_index_params_);
+  if (ret != 0) {
+    return ret;
+  }
+  builder_ = std::move(next_builder);
+  return 0;
+}
+
+int IVFIndex::DumpAndOpen() {
+  if (build_stage_ == BuildStage::kBuilt) {
+    auto dumper = core::IndexFactory::CreateDumper("FileDumper");
+    if (!dumper) {
+      return core::IndexError_NoExist;
+    }
+
+    int ret = dumper->create(file_path_);
+    if (ret != 0) {
+      return ret;
+    }
+    AILEGO_DEFER([&]() {
+      if (dumper) dumper->close();
+    });
+    ret = builder_->dump(dumper);
+    if (ret != 0) {
+      return ret;
+    }
+    // Dump converter state (e.g., rotator for INT8+rotate) to dumper
+    if (converter_ && converter_->dump(dumper) != 0) {
+      LOG_ERROR("Failed to dump converter, path: %s", file_path_.c_str());
+      return core::IndexError_Runtime;
+    }
+    ret = dumper->close();
+    if (ret != 0) {
+      return ret;
+    }
+    dumper.reset();
+
+    // Release the full builder state before opening the persisted index.
+    // If opening fails, retry only open: the replacement builder is empty.
+    ret = ResetBuilder();
+    if (ret != 0) {
+      return ret;
+    }
+    build_stage_ = BuildStage::kDumped;
+  } else if (build_stage_ != BuildStage::kDumped) {
+    return core::IndexError_NoReady;
   }
-  dumper->close();
+
+  AILEGO_DEFER([&]() {
+    if (!is_trained_) {
+      if (streamer_) streamer_->close();
+      storage_->close();
+    }
+  });
   int ret = storage_->open(file_path_, false);
   if (ret != 0) {
     LOG_ERROR("Failed to open storage, path: %s, err: %s", file_path_.c_str(),
@@ -199,6 +272,12 @@ int IVFIndex::train() {
     return core::IndexError_Runtime;
   }
   is_trained_ = true;
+  // Only the reformer is needed after the persisted index is ready. Destroy
+  // the build-only converter and its input ownership chain, but keep it on
+  // every failure path so dump/open can be retried with the trained state.
+  converter_.reset();
+  holder_.reset();
+  decltype(doc_cache_)().swap(doc_cache_);
   return 0;
 }
 
@@ -207,6 +286,14 @@ int IVFIndex::_dense_fetch(const uint32_t doc_id,
   if (is_trained_) {
     return Index::_dense_fetch(doc_id, vector_data_buffer);
   } else {
+    std::lock_guard<std::mutex> lock(mutex_);
+    // A failed merge has no cached input; sparse doc IDs also leave holes.
+    if (doc_id >= doc_cache_.size()) {
+      return core::IndexError_OutOfRange;
+    }
+    if (doc_cache_[doc_id].first == kInvalidKey) {
+      return core::IndexError_NoExist;
+    }
     DenseVectorBuffer dense_vector_buffer;
     std::string &out_vector_buffer = dense_vector_buffer.data;
     out_vector_buffer = doc_cache_[doc_id].second;
@@ -248,36 +335,30 @@ int IVFIndex::_prepare_for_search(
 
 int IVFIndex::merge(const std::vector<Index::Pointer> &indexes,
                     const IndexFilter &filter, const MergeOptions &options) {
-  int pre_ret = Index::merge(indexes, filter, options);
-  if (pre_ret != 0) {
-    return pre_ret;
+  if (indexes.empt
```

**File**: `src/core/metric/quantized_integer_metric.cc` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ class QuantizedIntegerMetric : public IndexMetric {
           auto turbo_ret = turbo::get_distance_func(
               turbo::MetricType::kCosine, turbo::DataType::kInt8,
               turbo::QuantizeType::kRecord, turbo::CpuArchType::kAVX512VNNI);
-          if (turbo_ret) {
+          if (turbo_ret && m == 1 && n == 1) {
             return turbo_ret;
           }
           return DistanceMatrixCompute<CosineMinusInnerProduct, int8_t>(m, n);
```

**File**: `src/core/mixed_reducer/merged_provider_index_holder.cc` (added, +572/-0)
```diff
@@ -0,0 +1,572 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#include "merged_provider_index_holder.h"
+#include <algorithm>
+#include <limits>
+#include <new>
+#include <utility>
+#include <zvec/ailego/logger/logger.h>
+#include <zvec/core/framework/index_error.h>
+
+namespace zvec {
+namespace core {
+
+namespace {
+
+constexpr size_t kBitsPerWord = sizeof(uint64_t) * 8;
+
+void AppendBit(std::vector<uint64_t> *bits, size_t ordinal, bool value) {
+  if (ordinal % kBitsPerWord == 0) {
+    bits->push_back(0);
+  }
+  if (value) {
+    bits->back() |= uint64_t{1} << (ordinal % kBitsPerWord);
+  }
+}
+
+}  // namespace
+
+class MergedProviderIndexHolder::Iterator final : public IndexHolder::Iterator {
+ public:
+  explicit Iterator(MergedProviderIndexHolder *owner) : owner_(owner) {
+    this->seek_to_kept();
+  }
+
+  const void *data() const override {
+    // Consumers may read one record more than once before next(). Keep the
+    // failure placeholder stable too, even though fail() invalidates us.
+    if (data_prepared_) {
+      return data_;
+    }
+    if (!this->is_valid()) {
+      return nullptr;
+    }
+    if (owner_->canceled()) {
+      return this->fail(IndexError_Canceled, "Read vector canceled");
+    }
+
+    const auto &source = owner_->sources_[source_index_];
+    const void *source_data = source_iter_->data();
+    if (source_data == nullptr) {
+      return this->fail(IndexError_Runtime,
+                        "Source provider returned a null vector");
+    }
+
+    if (!source.need_revert) {
+      data_ = source_data;
+      data_prepared_ = true;
+      return data_;
+    }
+
+    revert_buffer_.clear();
+    int ret = source.reformer->revert(source_data, source.provider_meta,
+                                      &revert_buffer_);
+    if (ret != 0) {
+      return this->fail(ret, "Failed to revert source vector");
+    }
+    if (revert_buffer_.size() != owner_->element_size()) {
+      return this->fail(IndexError_Mismatch,
+                        "Reverted vector size does not match output meta");
+    }
+
+    data_ = revert_buffer_.data();
+    data_prepared_ = true;
+    return data_;
+  }
+
+  bool is_valid() const override {
+    return owner_->status() == 0 && source_index_ < owner_->sources_.size() &&
+           source_iter_ && source_iter_->is_valid();
+  }
+
+  uint64_t key() const override {
+    return output_key_;
+  }
+
+  void next() override {
+    if (!this->is_valid()) {
+      return;
+    }
+    source_iter_->next();
+    ++source_ordinal_;
+    ++output_key_;
+    data_ = nullptr;
+    data_prepared_ = false;
+    revert_buffer_.clear();
+    this->seek_to_kept();
+  }
+
+ private:
+  void seek_to_kept() {
+    while (owner_->status() == 0 && source_index_ < owner_->sources_.size()) {
+      if (owner_->canceled()) {
+        owner_->set_status(IndexError_Canceled);
+        return;
+      }
+
+      const auto &source = owner_->sources_[source_index_];
+      if (!source_iter_) {
+        source_provider_ = owner_->acquire_provider(source_index_, true);
+        if (!source_provider_) {
+          return;
+        }
+        source_iter_ = source_provider_->create_iterator();
+        source_ordinal_ = 0;
+        if (!source_iter_) {
+          LOG_ERROR("Failed to create source provider iterator, source=%zu",
+                    source_index_);
+          source_provider_.reset();
+          owner_->set_status(IndexError_Runtime);
+          return;
+        }
+      }
+
+      while (source_iter_->is_valid()) {
+        if (source_ordinal_ >= source.iterated_count) {
+          LOG_ERROR(
+              "Source provider iteration grew after filter planning, "
+              "source=%zu",
+              source_index_);
+          owner_->set_status(IndexError_Mismatch);
+          return;
+        }
+        if (owner_->keep(source_index_, source_ordinal_)) {
+          return;
+        }
+        source_iter_->next();
+        ++source_ordinal_;
+      }
+
+      if (source_ordinal_ != source.iterated_count) {
+        LOG_ERROR(
+            "Source provider iteration changed after filter planning, "
+            "source=%zu expected=%zu actual=%zu",
+            source_index_, source.iterated_count, source_ordinal_);
+        owner_->set_status(IndexError_Mismatch);
+        return;
+      }
+      source_iter_.reset();
+      source_provider_.reset();
+      ++source_index_;
+    
```

---

### Incident Patch 10: `be9edda0` (2026-09-15)
**Commit Message**: fix: correct inverted-index LIKE suffix and empty-array queries (#752)

**File**: `src/db/index/column/inverted_column/inverted_column_indexer_search.cc` (modified, +9/-29)
```diff
@@ -177,39 +177,17 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_not_contain(
     return tl::make_unexpected(Status::InvalidArgument());
   }
 
-  roaring_bitmap_t *non_null_bitmap{nullptr};
+  auto non_null_result = get_bitmap_non_null();
+  if (!non_null_result) {
+    return non_null_result;
+  }
+  auto *non_null_bitmap = non_null_result.value();
   AILEGO_DEFER([&]() {
     if (non_null_bitmap) {
       roaring_bitmap_free(non_null_bitmap);
     }
   });
 
-  if (sealed_) {
-    non_null_bitmap = null_bitmap_.copy();
-    roaring_bitmap_flip_inplace(non_null_bitmap, 0, max_id_ + 1);
-  } else {
-    Status s;
-    non_null_bitmap = roaring_bitmap_create();
-    if (!non_null_bitmap) {
-      LOG_ERROR("Failed to create bitmap");
-      return tl::make_unexpected(Status::InternalError());
-    }
-    auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf_terms_);
-    AILEGO_DEFER([&]() { delete iter; });
-    iter->SeekToFirst();
-    while (iter->Valid()) {
-      s = InvertedIndexCodec::Merge_OR(
-          iter->value().data(), iter->value().size(), true, non_null_bitmap);
-      if (s.ok()) {
-        iter->Next();
-      } else {
-        LOG_ERROR("Failed to merge bitmap from %s", ID().c_str());
-        return tl::make_unexpected(s);
-      }
-    }
-    roaring_bitmap_repair_after_lazy(non_null_bitmap);
-  }
-
   auto ret = get_bitmap_contain(terms, is_any);
   if (ret) {
     if (ret.value() == nullptr) {
@@ -620,7 +598,7 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_like(
         "like should have exactly one percent, unescaped:", term));
   }
   if (percent_loc == 0) {
-    return get_bitmap_suffix(term);
+    return get_bitmap_suffix(term.substr(1));
   } else if (percent_loc == size - 1) {
     return get_bitmap_prefix(term.substr(0, percent_loc));
   } else {
@@ -723,7 +701,9 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_non_null() const {
     return bitmap;
   } else {
     Status s = Status::OK();
-    auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf_terms_);
+    // Empty arrays have a length entry but no term entries.
+    auto *cf = field_.is_array_type() ? cf_array_len_ : cf_terms_;
+    auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf);
     AILEGO_DEFER([&]() { delete iter; });
     roaring_bitmap_t *bitmap = roaring_bitmap_create();
     if (!bitmap) {
```

**File**: `tests/db/index/column/inverted_column/inverted_column_indexer_empty_array_test.cc` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#include <gtest/gtest.h>
+#include "db/index/column/inverted_column/inverted_indexer.h"
+#include "tests/test_util.h"
+
+namespace zvec {
+namespace {
+
+class EmptyArrayIndexTest : public testing::TestWithParam<DataType> {
+ protected:
+  void SetUp() override {
+    test_util::RemoveTestPath(path_);
+  }
+
+  void TearDown() override {
+    indexer_.reset();
+    test_util::RemoveTestPath(path_);
+  }
+
+  void expect_ids(const InvertedSearchResult::Ptr &result,
+                  const std::vector<uint32_t> &expected) {
+    ASSERT_TRUE(result);
+    ASSERT_EQ(result->count(), expected.size());
+    std::vector<uint32_t> actual;
+    result->extract_ids(&actual);
+    EXPECT_EQ(actual, expected);
+  }
+
+  void verify(const std::string &term) {
+    auto column = (*indexer_)["values"];
+    ASSERT_TRUE(column);
+    expect_ids(column->search_non_null(), {0, 1, 2});
+    expect_ids(column->search_null(), {3});
+    expect_ids(column->search_array_len(0, CompareOp::EQ), {0});
+    expect_ids(column->multi_search({term}, CompareOp::CONTAIN_ANY), {1});
+    expect_ids(column->multi_search({term}, CompareOp::CONTAIN_ALL), {1});
+    expect_ids(column->multi_search({term}, CompareOp::NOT_CONTAIN_ANY),
+               {0, 2});
+    expect_ids(column->multi_search({term}, CompareOp::NOT_CONTAIN_ALL),
+               {0, 2});
+  }
+
+  const std::string path_{"./empty_array_index"};
+  InvertedIndexer::Ptr indexer_;
+};
+
+TEST_P(EmptyArrayIndexTest, NonNullAndNegatedContainAcrossReopenAndSeal) {
+  const FieldSchema field{"values", GetParam(), true,
+                          std::make_shared<InvertIndexParams>()};
+  indexer_ =
+      InvertedIndexer::CreateAndOpen("test", path_, true, {field}, false);
+  ASSERT_TRUE(indexer_);
+  auto column = (*indexer_)["values"];
+  ASSERT_TRUE(column);
+  std::string term;
+  if (GetParam() == DataType::ARRAY_STRING) {
+    ASSERT_TRUE(column->insert(0, std::vector<std::string>{}).ok());
+    ASSERT_TRUE(column->insert(1, std::vector<std::string>{"a"}).ok());
+    ASSERT_TRUE(column->insert(2, std::vector<std::string>{"b"}).ok());
+    term = "a";
+  } else if (GetParam() == DataType::ARRAY_BOOL) {
+    ASSERT_TRUE(column->insert(0, std::vector<bool>{}).ok());
+    ASSERT_TRUE(column->insert(1, std::vector<bool>{true}).ok());
+    ASSERT_TRUE(column->insert(2, std::vector<bool>{false}).ok());
+    term = "true";
+  } else {
+    const int32_t match = 1, other = 2;
+    term.assign(reinterpret_cast<const char *>(&match), sizeof(match));
+    ASSERT_TRUE(column->insert(0, std::string{}).ok());
+    ASSERT_TRUE(column->insert(1, term).ok());
+    ASSERT_TRUE(
+        column
+            ->insert(2, std::string(reinterpret_cast<const char *>(&other),
+                                    sizeof(other)))
+            .ok());
+  }
+  ASSERT_TRUE(column->insert_null(3).ok());
+  column.reset();
+
+  {
+    SCOPED_TRACE("streaming");
+    verify(term);
+  }
+  ASSERT_TRUE(indexer_->flush().ok());
+  indexer_.reset();
+  indexer_ =
+      InvertedIndexer::CreateAndOpen("test", path_, false, {field}, false);
+  ASSERT_TRUE(indexer_);
+  {
+    SCOPED_TRACE("reopened streaming");
+    verify(term);
+  }
+  ASSERT_TRUE(indexer_->seal().ok());
+  ASSERT_TRUE((*indexer_)["values"]->is_sealed());
+  {
+    SCOPED_TRACE("sealed");
+    verify(term);
+  }
+  indexer_.reset();
+  indexer_ =
+      InvertedIndexer::CreateAndOpen("test", path_, false, {field}, true);
+  ASSERT_TRUE(indexer_);
+  {
+    SCOPED_TRACE("reopened sealed");
+    verify(term);
+  }
+}
+
+INSTANTIATE_TEST_SUITE_P(ArrayTypes, EmptyArrayIndexTest,
+                         testing::Values(DataType::ARRAY_STRING,
+                                         DataType::ARRAY_INT32,
+                                         DataType::ARRAY_BOOL));
+
+}  // namespace
+}  // namespace zvec
```

**File**: `tests/db/index/column/inverted_column/inverted_column_indexer_string_test.cc` (modified, +29/-0)
```diff
@@ -346,6 +346,35 @@ TEST_F(InvertedIndexTest, STRINGS) {
 }
 
 
+TEST_F(InvertedIndexTest, LikeSuffixStripsWildcard) {
+  ASSERT_TRUE(indexer_);
+  FieldSchema field{"like_suffix", DataType::STRING, true, params_};
+  ASSERT_TRUE(indexer_->create_column_indexer(field).ok());
+  auto column = (*indexer_)["like_suffix"];
+  ASSERT_TRUE(column);
+  const std::vector<std::string> values = {
+      "index.ts",     "src/app.ts", ".ts",         "index.tsx",
+      "index.ts.bak", "README",     "literal%.ts", "literal_.ts"};
+  for (uint32_t i = 0; i < values.size(); ++i) {
+    ASSERT_TRUE(column->insert(i, values[i]).ok());
+  }
+  const std::vector<std::pair<std::string, std::vector<uint32_t>>> cases = {
+      {"%.ts", {0, 1, 2, 6, 7}},
+      {R"(%\%.ts)", {6}},
+      {R"(%\_.ts)", {7}},
+      {"%.js", {}}};
+  for (const auto &[pattern, expected] : cases) {
+    SCOPED_TRACE(pattern);
+    auto result = column->search(pattern, CompareOp::LIKE);
+    ASSERT_TRUE(result);
+    ASSERT_EQ(result->count(), expected.size());
+    for (auto id : expected) {
+      EXPECT_TRUE(result->contains(id)) << values[id];
+    }
+  }
+}
+
+
 TEST_F(InvertedIndexTest, LikePrefixSuffixMustNotOverlap) {
   ASSERT_TRUE(indexer_);
   FieldSchema field{"like_overlap", DataType::STRING, true, params_};
```

**File**: `tests/db/sqlengine/like_test.cc` (modified, +3/-0)
```diff
@@ -171,6 +171,7 @@ TEST_F(LikeTest, ForwardSuffixLike) {
   auto ret = engine->execute(collection_schema_, query, segments_);
   ASSERT_TRUE(ret.has_value()) << ret.error();
   auto docs = std::move(ret.value());
+  ASSERT_EQ(docs.size(), 50u);
   for (size_t i = 0; i < docs.size(); i++) {
     auto doc = docs[i];
     int doc_id = i * 100 + 22;
@@ -188,6 +189,7 @@ TEST_F(LikeTest, NotExtendedInvertSuffixLikeRunAsForward) {
   auto ret = engine->execute(collection_schema_, query, segments_);
   ASSERT_TRUE(ret.has_value()) << ret.error();
   auto docs = std::move(ret.value());
+  ASSERT_EQ(docs.size(), 50u);
   for (size_t i = 0; i < docs.size(); i++) {
     auto doc = docs[i];
     int doc_id = i * 100 + 22;
@@ -205,6 +207,7 @@ TEST_F(LikeTest, ExtendedInvertSuffixLike) {
   auto ret = engine->execute(collection_schema_, query, segments_);
   ASSERT_TRUE(ret.has_value()) << ret.error();
   auto docs = std::move(ret.value());
+  ASSERT_EQ(docs.size(), 50u);
   for (size_t i = 0; i < docs.size(); i++) {
     auto doc = docs[i];
     int doc_id = i * 100 + 22;
```

---

### Incident Patch 11: `0fd01cf5` (2026-09-15)
**Commit Message**: fix(ci): skip unavailable legacy Android SDK tools package (#753)

**File**: `.github/workflows/04-android-build.yml` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ jobs:
 
       - name: Setup Android SDK
         uses: android-actions/setup-android@v4
+        with:
+          packages: 'platform-tools'
 
       - name: Enable KVM
         if: matrix.abi == 'x86_64'
```

---

### Incident Patch 12: `fb3c7605` (2026-09-15)
**Commit Message**: chore: enable modernize-redundant-void-arg check and fix existing violations (#751)

**File**: `.clang-tidy` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ Checks: >
   modernize-use-override,
   modernize-use-equals-default,
   modernize-use-equals-delete,
+  modernize-redundant-void-arg,
 WarningsAsErrors: "*"
 HeaderFilterRegex: "^(src|tests|tools)/(?!db/sqlengine/antlr/gen/|db/index/column/fts_column/gen/|include/zvec/ailego/encoding/json/mod_json\\.h).*"
 FormatStyle: none
```

**File**: `src/ailego/algorithm/binary_quantizer.cc` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ bool BinaryQuantizer::feed(const float *vec, size_t dim) {
 }
 
 //! Train the quantizer
-bool BinaryQuantizer::train(void) {
+bool BinaryQuantizer::train() {
   return true;
 }
 
```

**File**: `src/ailego/algorithm/binary_quantizer.h` (modified, +3/-3)
```diff
@@ -25,13 +25,13 @@ namespace ailego {
 class BinaryQuantizer {
  public:
   //! Constructor
-  BinaryQuantizer(void) = default;
+  BinaryQuantizer() = default;
 
   //! Feed the training data
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Quantize data: encode the float input to uint32_t output
   void encode(const float *in, size_t dim, uint32_t *out) const;
@@ -50,7 +50,7 @@ class BinaryQuantizer {
   }
 
   //! Get quantization threshold
-  float threshold(void) const {
+  float threshold() const {
     return threshold_;
   }
 
```

**File**: `src/ailego/algorithm/integer_quantizer.cc` (modified, +6/-6)
```diff
@@ -286,7 +286,7 @@ bool EntropyInt16Quantizer::feed(const float *vec, size_t dim) {
 }
 
 // Train the INT16 quantizer
-bool EntropyInt16Quantizer::train(void) {
+bool EntropyInt16Quantizer::train() {
   TRAIN_QUANTIZER()
 }
 
@@ -313,7 +313,7 @@ bool EntropyUInt16Quantizer::feed(const float *vec, size_t dim) {
 }
 
 // Train the UINT16 quantizer
-bool EntropyUInt16Quantizer::train(void) {
+bool EntropyUInt16Quantizer::train() {
   TRAIN_QUANTIZER()
 }
 
@@ -340,7 +340,7 @@ bool EntropyInt8Quantizer::feed(const float *vec, size_t dim) {
 }
 
 // Train the INT8 quantizer
-bool EntropyInt8Quantizer::train(void) {
+bool EntropyInt8Quantizer::train() {
   TRAIN_QUANTIZER()
 }
 
@@ -367,7 +367,7 @@ bool EntropyUInt8Quantizer::feed(const float *vec, size_t dim) {
 }
 
 // Train the UINT8 quantizer
-bool EntropyUInt8Quantizer::train(void) {
+bool EntropyUInt8Quantizer::train() {
   TRAIN_QUANTIZER()
 }
 
@@ -394,7 +394,7 @@ bool EntropyInt4Quantizer::feed(const float *vec, size_t dim) {
 }
 
 // Train the INT4 quantizer
-bool EntropyInt4Quantizer::train(void) {
+bool EntropyInt4Quantizer::train() {
   TRAIN_QUANTIZER()
 }
 
@@ -432,7 +432,7 @@ bool EntropyUInt4Quantizer::feed(const float *vec, size_t dim) {
 }
 
 // Train the UINT4 quantizer
-bool EntropyUInt4Quantizer::train(void) {
+bool EntropyUInt4Quantizer::train() {
   TRAIN_QUANTIZER()
 }
 
```

**File**: `src/ailego/algorithm/integer_quantizer.h` (modified, +14/-14)
```diff
@@ -40,7 +40,7 @@ class EntropyIntegerQuantizer {
   static_assert(RANGE_MIN < RANGE_MAX, "Invalid value range");
 
   //! Constructor
-  EntropyIntegerQuantizer(void) = default;
+  EntropyIntegerQuantizer() = default;
 
   //! Set histogram bins in train
   void set_histogram_bins(size_t bins) {
@@ -78,37 +78,37 @@ class EntropyIntegerQuantizer {
   }
 
   //! Get histogram bins in train
-  size_t histogram_bins(void) const {
+  size_t histogram_bins() const {
     return histogram_bins_;
   }
 
   //! Get quantization params scale
-  float scale(void) const {
+  float scale() const {
     return scale_;
   }
 
   //! Get quantization params bias
-  float bias(void) const {
+  float bias() const {
     return bias_;
   }
 
   //! Get quantization params max
-  float max(void) const {
+  float max() const {
     return max_;
   }
 
   //! Get quantization params min
-  float min(void) const {
+  float min() const {
     return min_;
   }
 
   //! Get quantization params non bias
-  bool non_bias(void) const {
+  bool non_bias() const {
     return non_bias_;
   }
 
   //! Retrieve the scale reciprocal for decoding
-  float scale_reciprocal(void) const {
+  float scale_reciprocal() const {
     return scale_reciprocal_;
   }
 
@@ -139,7 +139,7 @@ class EntropyInt16Quantizer
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Encode float vector to int16
   void encode(const float *in, size_t dim, ValueType *out) const;
@@ -157,7 +157,7 @@ class EntropyUInt16Quantizer
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Encode float vector to uint16
   void encode(const float *in, size_t dim, ValueType *out) const;
@@ -174,7 +174,7 @@ class EntropyInt8Quantizer : public EntropyIntegerQuantizer<int8_t, -127, 127> {
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Encode float vector to int8
   void encode(const float *in, size_t dim, ValueType *out) const;
@@ -191,7 +191,7 @@ class EntropyUInt8Quantizer : public EntropyIntegerQuantizer<uint8_t, 0, 255> {
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Encode float vector to uint8
   void encode(const float *in, size_t dim, ValueType *out) const;
@@ -208,7 +208,7 @@ class EntropyInt4Quantizer : public EntropyIntegerQuantizer<uint8_t, -8, 7> {
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Encode float vector to int4
   void encode(const float *in, size_t dim, ValueType *out) const;
@@ -225,7 +225,7 @@ class EntropyUInt4Quantizer : public EntropyIntegerQuantizer<uint8_t, 0, 15> {
   bool feed(const float *vec, size_t dim);
 
   //! Train the quantizer
-  bool train(void);
+  bool train();
 
   //! Encode float vector to uint4
   void encode(const float *in, size_t dim, ValueType *out) const;
```

**File**: `src/ailego/algorithm/kmeans.h` (modified, +18/-18)
```diff
@@ -62,7 +62,7 @@ class Kmc2CentroidsGenerator {
   }
 
   //! Retrieve the markov chain length
-  size_t chain_length(void) const {
+  size_t chain_length() const {
     return chain_length_;
   }
 
@@ -72,7 +72,7 @@ class Kmc2CentroidsGenerator {
   }
 
   //! Retrieve assumption free option
-  bool assumption_free(void) const {
+  bool assumption_free() const {
     return assumption_free_;
   }
 
@@ -482,12 +482,12 @@ class NumericalKmeansContext {
     }
 
     //! Retrieve squared error
-    double cost(void) const {
+    double cost() const {
       return cost_;
     }
 
     //! Retrieve feature count
-    size_t count(void) const {
+    size_t count() const {
       return count_;
     }
 
@@ -524,7 +524,7 @@ class NumericalKmeansContext {
   }
 
   //! Clear the context
-  void clear(void) {
+  void clear() {
     clusters_.clear();
   }
 
@@ -535,7 +535,7 @@ class NumericalKmeansContext {
   }
 
   //! Retrieve context of clusters
-  const std::vector<Cluster> &clusters(void) const {
+  const std::vector<Cluster> &clusters() const {
     return clusters_;
   }
 
@@ -681,12 +681,12 @@ class NibbleKmeansContext {
     }
 
     //! Retrieve squared error
-    double cost(void) const {
+    double cost() const {
       return cost_;
     }
 
     //! Retrieve feature count
-    size_t count(void) const {
+    size_t count() const {
       return count_;
     }
 
@@ -708,7 +708,7 @@ class NibbleKmeansContext {
   }
 
   //! Clear the context
-  void clear(void) {
+  void clear() {
     clusters_.clear();
   }
 
@@ -719,7 +719,7 @@ class NibbleKmeansContext {
   }
 
   //! Retrieve context of clusters
-  const std::vector<Cluster> &clusters(void) const {
+  const std::vector<Cluster> &clusters() const {
     return clusters_;
   }
 
@@ -836,12 +836,12 @@ class NumericalInnerProductKmeansContext {
     }
 
     //! Retrieve squared error
-    double cost(void) const {
+    double cost() const {
       return cost_;
     }
 
     //! Retrieve feature count
-    size_t count(void) const {
+    size_t count() const {
       return count_;
     }
 
@@ -878,7 +878,7 @@ class NumericalInnerProductKmeansContext {
   }
 
   //! Clear the context
-  void clear(void) {
+  void clear() {
     clusters_.clear();
   }
 
@@ -889,7 +889,7 @@ class NumericalInnerProductKmeansContext {
   }
 
   //! Retrieve context of clusters
-  const std::vector<Cluster> &clusters(void) const {
+  const std::vector<Cluster> &clusters() const {
     return clusters_;
   }
 
@@ -1054,12 +1054,12 @@ class NibbleInnerProductKmeansContext {
     }
 
     //! Retrieve squared error
-    double cost(void) const {
+    double cost() const {
       return cost_;
     }
 
     //! Retrieve feature count
-    size_t count(void) const {
+    size_t count() const {
       return count_;
     }
 
@@ -1081,7 +1081,7 @@ class NibbleInnerProductKmeansContext {
   }
 
   //! Clear the context
-  void clear(void) {
+  void clear() {
     clusters_.clear();
   }
 
@@ -1092,7 +1092,7 @@ class NibbleInnerProductKmeansContext {
   }
 
   //! Retrieve context of clusters
-  const std::vector<Cluster> &clusters(void) const {
+  const std::vector<Cluster> &clusters() const {
     return clusters_;
   }
 
```

**File**: `src/ailego/algorithm/lloyd_cluster.h` (modified, +10/-10)
```diff
@@ -103,10 +103,10 @@ class LloydCluster {
         spherical_{spherical} {}
 
   //! Constructor
-  LloydCluster(void) = default;
+  LloydCluster() = default;
 
   //! Destructor
-  ~LloydCluster(void) = default;
+  ~LloydCluster() = default;
 
   //! Append a feature
   void append(const StoreType *arr, size_t dim) {
@@ -211,37 +211,37 @@ class LloydCluster {
   }
 
   //! Retrieve the controids
-  ContainerType *mutable_centroids(void) {
+  ContainerType *mutable_centroids() {
     return &centroids_;
   }
 
   //! Retrieve the controids
-  const ContainerType &centroids(void) const {
+  const ContainerType &centroids() const {
     return centroids_;
   }
 
   //! Retrieve the K value
-  size_t k_value(void) const {
+  size_t k_value() const {
     return k_value_;
   }
 
   //! Retrieve spherical option
-  bool spherical(void) const {
+  bool spherical() const {
     return spherical_;
   }
 
   //! Retrieve context
-  const ContextType &context(void) const {
+  const ContextType &context() const {
     return context_;
   }
 
   //! Retrieve the feature cache
-  const ContainerType &feature_cache(void) const {
+  const ContainerType &feature_cache() const {
     return feature_cache_;
   }
 
   //! Retrieve the feature matrix
-  const ContainerType &feature_matrix(void) const {
+  const ContainerType &feature_matrix() const {
     return feature_matrix_;
   }
 
@@ -252,7 +252,7 @@ class LloydCluster {
 
  protected:
   //! Cluster the cache features
-  void cluster_cache_features(void) {
+  void cluster_cache_features() {
     std::array<float, BatchCount> scores;
 
     for (size_t i = 0, n = feature_cache_.count(); i != n; ++i) {
```

**File**: `src/ailego/container/bitmap.cc` (modified, +7/-7)
```diff
@@ -75,7 +75,7 @@ size_t Bitset::BitwiseOrCardinality(const Bitset &lhs, const Bitset &rhs) {
                                             rhs.array_.data(), lsize);
 }
 
-void Bitmap::clear(void) {
+void Bitmap::clear() {
   for (std::vector<Bucket *>::iterator iter = array_.begin();
        iter != array_.end(); ++iter) {
     delete (*iter);
@@ -96,7 +96,7 @@ void Bitmap::copy(const Bitmap &rhs) {
   }
 }
 
-void Bitmap::shrink_to_fit(void) {
+void Bitmap::shrink_to_fit() {
   size_t shrink_count = 0;
   std::vector<Bucket *>::reverse_iterator iter;
 
@@ -273,7 +273,7 @@ void Bitmap::bitwise_xor(const Bitmap &rhs) {
   }
 }
 
-void Bitmap::bitwise_not(void) {
+void Bitmap::bitwise_not() {
   for (std::vector<Bucket *>::iterator iter = array_.begin();
        iter != array_.end(); ++iter) {
     Bucket *&bucket = *iter;
@@ -284,7 +284,7 @@ void Bitmap::bitwise_not(void) {
   }
 }
 
-bool Bitmap::test_all(void) const {
+bool Bitmap::test_all() const {
   if (array_.empty()) {
     return false;
   }
@@ -297,7 +297,7 @@ bool Bitmap::test_all(void) const {
   return true;
 }
 
-bool Bitmap::test_any(void) const {
+bool Bitmap::test_any() const {
   for (std::vector<Bucket *>::const_iterator iter = array_.begin();
        iter != array_.end(); ++iter) {
     if (*iter && (*iter)->test_any()) {
@@ -307,7 +307,7 @@ bool Bitmap::test_any(void) const {
   return false;
 }
 
-bool Bitmap::test_none(void) const {
+bool Bitmap::test_none() const {
   for (std::vector<Bucket *>::const_iterator iter = array_.begin();
        iter != array_.end(); ++iter) {
     if (*iter && !(*iter)->test_none()) {
@@ -317,7 +317,7 @@ bool Bitmap::test_none(void) const {
   return true;
 }
 
-size_t Bitmap::cardinality(void) const {
+size_t Bitmap::cardinality() const {
   size_t result = 0;
   for (std::vector<Bucket *>::const_iterator iter = array_.begin();
        iter != array_.end(); ++iter) {
```

---

### Incident Patch 13: `c540d71f` (2026-09-14)
**Commit Message**: perf(uint4): optimize AVX-512 distance and fix Vamana medoid (#749)

**File**: `src/core/algorithm/vamana/vamana_entity.h` (modified, +4/-1)
```diff
@@ -212,9 +212,12 @@ class VamanaEntity {
   //   dimension: vector dimension (number of elements per vector)
   //   data_type: IndexMeta::DataType value (e.g. DT_FP32=2, DT_INT8=4,
   //   DT_FP16=1)
+  //   packed_uint4: decode DT_INT8 storage as unsigned nibbles; dimension
+  //   then counts unpacked coordinates, including any zero padding.
   // Returns the medoid node ID, or kInvalidNodeId if no valid data.
   virtual node_id_t calculate_medoid(uint32_t /*dimension*/,
-                                     uint32_t /*data_type*/) {
+                                     uint32_t /*data_type*/,
+                                     bool /*packed_uint4*/ = false) {
     return kInvalidNodeId;
   }
 
```

**File**: `src/core/algorithm/vamana/vamana_streamer.cc` (modified, +12/-1)
```diff
@@ -13,6 +13,7 @@
 // limitations under the License.
 #include "vamana_streamer.h"
 #include <iostream>
+#include <limits>
 #include <ailego/pattern/defer.h>
 #include <ailego/utility/memory_helper.h>
 #include "vamana_algorithm.h"
@@ -391,15 +392,25 @@ void VamanaStreamer::update_entry_point_to_medoid() {
   // At dump time, data_type and dimension are fully known from meta_.
   if (entity_->doc_cnt() > 0) {
     uint32_t medoid_dim = meta_.dimension();
+    const bool packed_uint4 = meta_.metric_name() == "UniformUint4";
     // UniformUint8 appends a squared norm to the encoded coordinates. It is
     // distance metadata, not another four dimensions of the centroid.
     constexpr uint32_t kUniformUint8TailBytes = sizeof(uint32_t);
     if (meta_.metric_name() == "UniformUint8" &&
         medoid_dim > kUniformUint8TailBytes) {
       medoid_dim -= kUniformUint8TailBytes;
     }
+    if (packed_uint4) {
+      if (medoid_dim > (std::numeric_limits<uint32_t>::max)() / 2U) {
+        LOG_ERROR("UniformUint4 medoid dimension overflow: %u", medoid_dim);
+        return;
+      }
+      // Each stored byte holds two coordinates. Zero-padded coordinates
+      // contribute zero to both the centroid and its squared distances.
+      medoid_dim *= 2U;
+    }
     node_id_t medoid = entity_->calculate_medoid(
-        medoid_dim, static_cast<uint32_t>(meta_.data_type()));
+        medoid_dim, static_cast<uint32_t>(meta_.data_type()), packed_uint4);
     if (medoid != kInvalidNodeId && medoid != entity_->entry_point()) {
       LOG_INFO("Updating entry point from %u to medoid %u",
                entity_->entry_point(), medoid);
```

**File**: `src/core/algorithm/vamana/vamana_streamer_entity.cc` (modified, +37/-8)
```diff
@@ -909,7 +909,8 @@ void VamanaStreamerEntity::set_neighbor_dist(node_id_t id, uint32_t idx,
 // data_type uses IndexMeta::DataType values: DT_FP16=1, DT_FP32=2, DT_INT8=4.
 // ============================================================================
 node_id_t VamanaStreamerEntity::calculate_medoid(uint32_t dimension,
-                                                 uint32_t data_type) {
+                                                 uint32_t data_type,
+                                                 bool packed_uint4) {
   uint32_t n = doc_cnt();
   if (n == 0) return kInvalidNodeId;
   if (dimension == 0) return kInvalidNodeId;
@@ -924,6 +925,13 @@ node_id_t VamanaStreamerEntity::calculate_medoid(uint32_t dimension,
     return entry_point();
   }
 
+  if (packed_uint4 && (data_type != DT_INT8 ||
+                       dimension / 2U + dimension % 2U > vector_size())) {
+    LOG_ERROR("Invalid packed uint4 medoid layout: dim=%u type=%u bytes=%zu",
+              dimension, data_type, vector_size());
+    return kInvalidNodeId;
+  }
+
   // Step 1: Compute centroid (mean) of all vectors in float space.
   std::vector<float> centroid(dimension, 0.0f);
   uint32_t valid_count = 0;
@@ -940,9 +948,19 @@ node_id_t VamanaStreamerEntity::calculate_medoid(uint32_t dimension,
         break;
       }
       case DT_INT8: {
-        const int8_t *iv = static_cast<const int8_t *>(vec);
-        for (uint32_t d = 0; d < dimension; ++d)
-          centroid[d] += static_cast<float>(iv[d]);
+        if (packed_uint4) {
+          const auto *packed = static_cast<const uint8_t *>(vec);
+          for (uint32_t d = 0; d < dimension; ++d) {
+            const uint8_t byte = packed[d >> 1U];
+            const uint8_t code =
+                (d & 1U) == 0 ? byte & 0x0fU : (byte >> 4U) & 0x0fU;
+            centroid[d] += static_cast<float>(code);
+          }
+        } else {
+          const int8_t *iv = static_cast<const int8_t *>(vec);
+          for (uint32_t d = 0; d < dimension; ++d)
+            centroid[d] += static_cast<float>(iv[d]);
+        }
         break;
       }
       case DT_FP16: {
@@ -986,10 +1004,21 @@ node_id_t VamanaStreamerEntity::calculate_medoid(uint32_t dimension,
         break;
       }
       case DT_INT8: {
-        const int8_t *iv = static_cast<const int8_t *>(vec);
-        for (uint32_t d = 0; d < dimension; ++d) {
-          float diff = static_cast<float>(iv[d]) - centroid[d];
-          dist += diff * diff;
+        if (packed_uint4) {
+          const auto *packed = static_cast<const uint8_t *>(vec);
+          for (uint32_t d = 0; d < dimension; ++d) {
+            const uint8_t byte = packed[d >> 1U];
+            const uint8_t code =
+                (d & 1U) == 0 ? byte & 0x0fU : (byte >> 4U) & 0x0fU;
+            const float diff = static_cast<float>(code) - centroid[d];
+            dist += diff * diff;
+          }
+        } else {
+          const int8_t *iv = static_cast<const int8_t *>(vec);
+          for (uint32_t d = 0; d < dimension; ++d) {
+            float diff = static_cast<float>(iv[d]) - centroid[d];
+            dist += diff * diff;
+          }
         }
         break;
       }
```

**File**: `src/core/algorithm/vamana/vamana_streamer_entity.h` (modified, +2/-1)
```diff
@@ -69,7 +69,8 @@ class VamanaStreamerEntity : public VamanaEntity {
 
   // Calculate medoid: find the data point closest to the centroid
   // of all vectors (DiskANN standard entry point selection).
-  node_id_t calculate_medoid(uint32_t dimension, uint32_t data_type) override;
+  node_id_t calculate_medoid(uint32_t dimension, uint32_t data_type,
+                             bool packed_uint4 = false) override;
 
   // --- Neighbor distance storage ---
   int ensure_dist_storage() override;
```

**File**: `src/turbo/distance/avx512_vnni/uniform_uint4/squared_euclidean.cc` (modified, +101/-3)
```diff
@@ -15,6 +15,46 @@ inline int32_t Reduce(__m512i value) {
   return _mm512_reduce_add_epi32(value);
 }
 
+// Horizontally reduce four independent ZMM accumulators into four int32
+// results.  Reducing each accumulator separately makes the compiler extract
+// scalar lanes and rebuild an XMM result; transposing the four partial sums
+// keeps the entire reduction in SIMD registers.
+static ailego_force_inline __m128i ReduceFour(__m512i a, __m512i b, __m512i c,
+                                              __m512i d) {
+  const __m256i a8 = _mm256_add_epi32(_mm512_castsi512_si256(a),
+                                      _mm512_extracti64x4_epi64(a, 1));
+  const __m256i b8 = _mm256_add_epi32(_mm512_castsi512_si256(b),
+                                      _mm512_extracti64x4_epi64(b, 1));
+  const __m256i c8 = _mm256_add_epi32(_mm512_castsi512_si256(c),
+                                      _mm512_extracti64x4_epi64(c, 1));
+  const __m256i d8 = _mm256_add_epi32(_mm512_castsi512_si256(d),
+                                      _mm512_extracti64x4_epi64(d, 1));
+
+  const __m128i a4 = _mm_add_epi32(_mm256_castsi256_si128(a8),
+                                   _mm256_extracti128_si256(a8, 1));
+  const __m128i b4 = _mm_add_epi32(_mm256_castsi256_si128(b8),
+                                   _mm256_extracti128_si256(b8, 1));
+  const __m128i c4 = _mm_add_epi32(_mm256_castsi256_si128(c8),
+                                   _mm256_extracti128_si256(c8, 1));
+  const __m128i d4 = _mm_add_epi32(_mm256_castsi256_si128(d8),
+                                   _mm256_extracti128_si256(d8, 1));
+
+  const __m128i ab_low = _mm_unpacklo_epi32(a4, b4);
+  const __m128i cd_low = _mm_unpacklo_epi32(c4, d4);
+  const __m128i ab_high = _mm_unpackhi_epi32(a4, b4);
+  const __m128i cd_high = _mm_unpackhi_epi32(c4, d4);
+  return _mm_add_epi32(_mm_add_epi32(_mm_unpacklo_epi64(ab_low, cd_low),
+                                     _mm_unpackhi_epi64(ab_low, cd_low)),
+                       _mm_add_epi32(_mm_unpacklo_epi64(ab_high, cd_high),
+                                     _mm_unpackhi_epi64(ab_high, cd_high)));
+}
+
+static ailego_force_inline void StoreFour(const __m512i *sums,
+                                          float *distances) {
+  _mm_storeu_ps(distances, _mm_cvtepi32_ps(
+                               ReduceFour(sums[0], sums[1], sums[2], sums[3])));
+}
+
 inline __m512i Accumulate(__m512i sum, __m512i packed, __m512i query_low,
                           __m512i query_high, __m512i nibble_mask) {
   const __m512i low = _mm512_and_si512(packed, nibble_mask);
@@ -26,6 +66,33 @@ inline __m512i Accumulate(__m512i sum, __m512i packed, __m512i query_low,
   return _mm512_dpbusd_epi32(sum, high_delta, high_delta);
 }
 
+// SIFT's 128 dimensions occupy exactly one 64-byte packed record.  Hoist the
+// query unpacking out of the candidate loop and avoid the general dimension
+// loop.  Batches of two and three also share the decoded query instead of
+// falling back to independent pairwise calls.
+template <size_t BatchSize>
+static ailego_force_inline void DistanceFixed64(const void *const *vectors,
+                                                __m512i query_low,
+                                                __m512i query_high,
+                                                __m512i nibble_mask,
+                                                float *distances) {
+  static_assert(BatchSize >= 1 && BatchSize <= 4,
+                "uniform uint4 fixed batch must contain 1-4 vectors");
+  __m512i sums[BatchSize];
+  for (size_t lane = 0; lane < BatchSize; ++lane) {
+    sums[lane] =
+        Accumulate(_mm512_setzero_si512(), _mm512_loadu_si512(vectors[lane]),
+                   query_low, query_high, nibble_mask);
+  }
+  if constexpr (BatchSize == 4) {
+    StoreFour(sums, distances);
+  } else {
+    for (size_t lane = 0; lane < BatchSize; ++lane) {
+      distances[lane] = static_cast<float>(Reduce(sums[lane]));
+    }
+  }
+}
+
 static ailego_force_inline void Distance(const uint8_t *lhs, const uint8_t *rhs,
                                          size_t encoded_dimension,
                                          float *distance) {
@@ -70,9 +137,7 @@ static ailego_force_inline void DistanceFour(const void *const *vectors,
                               query_low, query_high, mask);
     }
   }
-  for (size_t lane = 0; lane < 4; ++lane) {
-    distances[lane] = static_cast<float>(Reduce(sums[lane]));
-  }
+  StoreFour(sums, distances);
   if (offset < encoded_dimension) {
     for (size_t lane = 0; lane < 4; ++lane) {
       float tail = 0.0f;
@@ -96,7 +161,40 @@ void uniform_squared_euclidean_uint4_batch_distance(
     const void *const *vectors, const void *query, size_t count,
     size_t encoded_dimension, float *distances,
     const void *const * /*extra_values*/) {
+  if (count == 0) {
+    return;
+  }
   const auto *packed_query = static_cast<const uint8_t *>(query);
+  if (encoded_di
```

**File**: `tests/core/algorithm/vamana/vamana_streamer_test.cc` (modified, +81/-0)
```diff
@@ -748,6 +748,87 @@ TEST_F(VamanaStreamerTest, TestContiguousMemory) {
   EXPECT_GT(recall, 0.90f);
 }
 
+TEST_F(VamanaStreamerTest, UniformUint4MedoidUsesUnpackedCoordinates) {
+  constexpr uint32_t kEncodedDimension = 64;
+  ailego::Params metric_params;
+  metric_params.set("proxima.uniform_uint4.metric.origin_metric_name",
+                    std::string("SquaredEuclidean"));
+  IndexMeta meta(IndexMeta::DataType::DT_INT8, kEncodedDimension);
+  meta.set_metric("UniformUint4", 0, metric_params);
+  IndexQueryMeta query_meta(IndexMeta::DataType::DT_INT8, kEncodedDimension);
+
+  // Both inputs have node 1 as their nearest point to the nibble centroid.
+  // Treating bytes as signed or unsigned coordinates instead selects node 0
+  // in the first input. The second additionally exercises a set sign bit.
+  const std::array<std::array<uint8_t, 3>, 2> inputs{
+      {{{0x0f, 0x00, 0x10}}, {{0x00, 0x44, 0x88}}}};
+  for (size_t input = 0; input < inputs.size(); ++input) {
+    for (bool two_pass : {false, true}) {
+      SCOPED_TRACE(input);
+      SCOPED_TRACE(two_pass);
+      ailego::Params params;
+      params.set(PARAM_VAMANA_STREAMER_MAX_DEGREE, 8U);
+      params.set(PARAM_VAMANA_STREAMER_TWO_PASS_BUILD_ENABLE, two_pass);
+      auto streamer = IndexFactory::CreateStreamer("VamanaStreamer");
+      ASSERT_TRUE(streamer);
+      ASSERT_EQ(0, streamer->init(meta, params));
+      auto storage = IndexFactory::CreateStorage("MMapFileStorage");
+      ASSERT_TRUE(storage);
+      ASSERT_EQ(0, storage->init(ailego::Params()));
+      const std::string path = dir_ + "uint4_medoid_" + std::to_string(input) +
+                               (two_pass ? "_two" : "_one");
+      ASSERT_EQ(0, storage->open(path, true));
+      ASSERT_EQ(0, streamer->open(storage));
+      auto context = streamer->create_context();
+      ASSERT_TRUE(context);
+      std::vector<std::string> records;
+      for (uint32_t i = 0; i < 3; ++i) {
+        std::string record(kEncodedDimension,
+                           static_cast<char>(inputs[input][i]));
+        ASSERT_EQ(0, streamer->add_impl(i, record.data(), query_meta, context));
+        records.push_back(std::move(record));
+      }
+      auto *vamana_streamer = dynamic_cast<VamanaStreamer *>(streamer.get());
+      ASSERT_NE(nullptr, vamana_streamer);
+      ASSERT_EQ(0, vamana_streamer->finalize_build());
+      context = streamer->create_context();
+      auto *vamana_context = dynamic_cast<VamanaContext *>(context.get());
+      ASSERT_NE(nullptr, vamana_context);
+      if (two_pass) {
+        EXPECT_EQ(1U, vamana_context->get_entity().entry_point());
+      }
+      auto dumper = IndexFactory::CreateDumper("FileDumper");
+      ASSERT_TRUE(dumper);
+      ASSERT_EQ(0, dumper->create(path + ".dump"));
+      ASSERT_EQ(0, streamer->dump(dumper));
+      ASSERT_EQ(0, dumper->close());
+      context = streamer->create_context();
+      vamana_context = dynamic_cast<VamanaContext *>(context.get());
+      ASSERT_NE(nullptr, vamana_context);
+      EXPECT_EQ(1U, vamana_context->get_entity().entry_point());
+      for (uint32_t i = 0; i < records.size(); ++i) {
+        EXPECT_EQ(0, std::memcmp(records[i].data(),
+                                 vamana_context->get_entity().get_vector(i),
+                                 kEncodedDimension));
+      }
+      ASSERT_EQ(0, streamer->flush(0));
+      ASSERT_EQ(0, streamer->close());
+
+      params.set(PARAM_VAMANA_STREAMER_USE_CONTIGUOUS_MEMORY, true);
+      auto searcher = IndexFactory::CreateStreamer("VamanaStreamer");
+      ASSERT_TRUE(searcher);
+      ASSERT_EQ(0, searcher->init(meta, params));
+      ASSERT_EQ(0, searcher->open(storage));
+      auto search_context = searcher->create_context();
+      auto *contiguous_context =
+          dynamic_cast<VamanaContext *>(search_context.get());
+      ASSERT_NE(nullptr, contiguous_context);
+      EXPECT_EQ(1U, contiguous_context->get_entity().entry_point());
+      ASSERT_EQ(0, searcher->close());
+    }
+  }
+}
+
 TEST_F(VamanaStreamerTest, UniformUint8MedoidExcludesNormTail) {
   constexpr uint32_t kDimension = 128;
   constexpr uint32_t kEncodedDimension = kDimension + sizeof(uint32_t);
```

**File**: `tests/core/metric/uniform_uint4_metric_test.cc` (modified, +16/-4)
```diff
@@ -47,7 +47,7 @@ TEST(UniformUint4Metric, PairAndBatchMatchScalarExactly) {
     ASSERT_TRUE(static_cast<bool>(distance));
     ASSERT_TRUE(static_cast<bool>(batch_distance));
 
-    constexpr size_t count = 7;
+    constexpr size_t count = 17;
     std::vector<uint8_t> query(encoded_dimension);
     std::vector<std::vector<uint8_t>> rows(
         count, std::vector<uint8_t>(encoded_dimension));
@@ -65,9 +65,21 @@ TEST(UniformUint4Metric, PairAndBatchMatchScalarExactly) {
       distance(rows[i].data(), query.data(), encoded_dimension, &pair);
       EXPECT_EQ(expected[i], pair);
     }
-    batch_distance(pointers.data(), query.data(), count, encoded_dimension,
-                   actual.data(), nullptr);
-    EXPECT_EQ(expected, actual) << "logical_dimension=" << logical_dimension;
+    for (size_t batch_count = 0; batch_count <= count; ++batch_count) {
+      std::fill(actual.begin(), actual.end(), -1.0f);
+      batch_distance(pointers.data(), query.data(), batch_count,
+                     encoded_dimension, actual.data(), nullptr);
+      for (size_t i = 0; i < batch_count; ++i) {
+        EXPECT_EQ(expected[i], actual[i])
+            << "logical_dimension=" << logical_dimension
+            << " batch_count=" << batch_count << " lane=" << i;
+      }
+      for (size_t i = batch_count; i < count; ++i) {
+        EXPECT_EQ(-1.0f, actual[i]) << "batch wrote past its output range";
+      }
+    }
+    // An empty batch must not dereference input or output pointers.
+    batch_distance(nullptr, nullptr, 0, encoded_dimension, nullptr, nullptr);
   }
 }
 
```

---

### Incident Patch 14: `572fa3e4` (2026-09-12)
**Commit Message**: fix: prevent overlapping prefix and suffix matches in LIKE (#745)

**File**: `src/db/index/column/inverted_column/inverted_column_indexer.h` (modified, +3/-2)
```diff
@@ -336,7 +336,8 @@ class InvertedColumnIndexer {
 
   Result<roaring_bitmap_t *> get_bitmap_like(std::string term) const;
 
-  Result<roaring_bitmap_t *> get_bitmap_prefix(const std::string &term) const;
+  Result<roaring_bitmap_t *> get_bitmap_prefix(
+      const std::string &term, const std::string &suffix = "") const;
 
   Result<roaring_bitmap_t *> get_bitmap_suffix(const std::string &term) const;
 
@@ -431,4 +432,4 @@ class InvertedColumnIndexer {
 };
 
 
-};  // namespace zvec
\ No newline at end of file
+};  // namespace zvec
```

**File**: `src/db/index/column/inverted_column/inverted_column_indexer_search.cc` (modified, +12/-17)
```diff
@@ -624,28 +624,15 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_like(
   } else if (percent_loc == size - 1) {
     return get_bitmap_prefix(term.substr(0, percent_loc));
   } else {
-    std::string prefix = term.substr(0, percent_loc - 1);
+    std::string prefix = term.substr(0, percent_loc);
     std::string suffix = term.substr(percent_loc + 1, size - percent_loc - 1);
-    auto prefix_bitmap = get_bitmap_prefix(prefix);
-    if (!prefix_bitmap.has_value()) {
-      return tl::make_unexpected(
-          Status::InternalError("Get bitmap prefix failed, unescaped:", term));
-    }
-    auto suffix_bitmap = get_bitmap_suffix(suffix);
-    if (!suffix_bitmap.has_value()) {
-      return tl::make_unexpected(
-          Status::InternalError("Get bitmap suffix failed, unescaped:", term));
-    }
-    auto *result = prefix_bitmap.value();
-    roaring_bitmap_and_inplace(result, suffix_bitmap.value());
-    roaring_bitmap_free(suffix_bitmap.value());
-    return result;
+    return get_bitmap_prefix(prefix, suffix);
   }
 }
 
 
 Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_prefix(
-    const std::string &term) const {
+    const std::string &term, const std::string &suffix) const {
   auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf_terms_);
   AILEGO_DEFER([&]() { delete iter; });
 
@@ -662,6 +649,14 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_prefix(
                     term.size())) {
       break;
     }
+    // Validate both literals on the same term; LIKE cannot overlap them.
+    if (!suffix.empty() &&
+        (iter->key().size() < term.size() + suffix.size() ||
+         memcmp(iter->key().data() + iter->key().size() - suffix.size(),
+                suffix.data(), suffix.size()) != 0)) {
+      iter->Next();
+      continue;
+    }
     s = InvertedIndexCodec::Merge_OR(iter->value().data(), iter->value().size(),
                                      true, bitmap);
     if (!s.ok()) {
@@ -1012,4 +1007,4 @@ inline roaring_bitmap_t *InvertedColumnIndexer::flip_bitmap(
 }
 
 
-}  // namespace zvec
\ No newline at end of file
+}  // namespace zvec
```

**File**: `tests/db/index/column/inverted_column/inverted_column_indexer_string_test.cc` (modified, +29/-1)
```diff
@@ -346,6 +346,34 @@ TEST_F(InvertedIndexTest, STRINGS) {
 }
 
 
+TEST_F(InvertedIndexTest, LikePrefixSuffixMustNotOverlap) {
+  ASSERT_TRUE(indexer_);
+  FieldSchema field{"like_overlap", DataType::STRING, true, params_};
+  ASSERT_TRUE(indexer_->create_column_indexer(field).ok());
+  auto column = (*indexer_)["like_overlap"];
+  ASSERT_TRUE(column);
+  const std::vector<std::string> values = {"aba", "abba", "abXba", "axba",
+                                           "a",   "aa",   "a%a",   "a_a"};
+  for (uint32_t i = 0; i < values.size(); ++i) {
+    ASSERT_TRUE(column->insert(i, values[i]).ok());
+  }
+  const std::vector<std::pair<std::string, std::vector<uint32_t>>> cases = {
+      {"ab%ba", {1, 2}},
+      {"a%a", {0, 1, 2, 3, 5, 6, 7}},
+      {"aba%aba", {}},
+      {R"(a\%%a)", {6}},
+      {R"(a\_%a)", {7}}};
+  for (const auto &[pattern, expected] : cases) {
+    SCOPED_TRACE(pattern);
+    auto result = column->search(pattern, CompareOp::LIKE);
+    ASSERT_TRUE(result);
+    EXPECT_EQ(result->count(), expected.size());
+    for (auto id : expected) {
+      EXPECT_TRUE(result->contains(id)) << id;
+    }
+  }
+}
+
 TEST_F(InvertedIndexTest, STRING_ARRAYS) {
   ASSERT_TRUE(indexer_);
 
@@ -375,4 +403,4 @@ TEST_F(InvertedIndexTest, SEALED) {
 
 #if defined(__GNUC__) || defined(__GNUG__)
 #pragma GCC diagnostic pop
-#endif
\ No newline at end of file
+#endif
```

**File**: `tests/db/sqlengine/like_test.cc` (modified, +31/-1)
```diff
@@ -250,6 +250,36 @@ TEST_F(LikeTest, ExtendedInvertMiddleLike) {
   }
 }
 
+TEST_F(LikeTest, PrefixSuffixMustNotOverlap) {
+  struct TestCase {
+    const char *pattern;
+    size_t expected_count;
+  };
+  const TestCase cases[] = {
+      {"user-2%2", 50},      {"user-%-22", 0}, {"user-22%user-22", 0},
+      {"user-X%2", 0},       {"u%2", 1000},    {R"(user-\%%2)", 300},
+      {R"(user-\_%2)", 200},
+  };
+  for (const auto &test : cases) {
+    for (const auto *field : {"name", "invert_name", "extended_invert_name"}) {
+      SearchQuery query;
+      query.output_fields_ = {"name"};
+      query.topk_ = 10000;
+      query.filter_ = std::string(field) + " like '" + test.pattern + "'";
+      SCOPED_TRACE(query.filter_);
+      auto engine = SQLEngine::create(std::make_shared<Profiler>());
+      auto ret = engine->execute(collection_schema_, query, segments_);
+      ASSERT_TRUE(ret.has_value()) << ret.error();
+      EXPECT_EQ(ret.value().size(), test.expected_count);
+      if (std::string(test.pattern) == "user-2%2") {
+        for (size_t i = 0; i < ret.value().size(); ++i) {
+          EXPECT_EQ(ret.value()[i]->pk(), "pk_" + std::to_string(i * 100 + 22));
+        }
+      }
+    }
+  }
+}
+
 TEST_F(LikeTest, UnderScore) {
   SearchQuery query;
   query.output_fields_ = {"name"};
@@ -369,4 +399,4 @@ TEST_F(LikeTest, NoPercentRunAsEqual) {
   }
 }
 
-}  // namespace zvec::sqlengine
\ No newline at end of file
+}  // namespace zvec::sqlengine
```

---

### Incident Patch 15: `e63e147c` (2026-09-11)
**Commit Message**: fix(arm): enable neon fp16 kernels via march auto-detect and runtime dispatch (#723)

**File**: `src/ailego/internal/cpu_features.cc` (modified, +18/-0)
```diff
@@ -27,6 +27,9 @@
 #ifndef HWCAP_ASIMD
 #define HWCAP_ASIMD (1 << 1)
 #endif
+#ifndef HWCAP_ASIMDHP
+#define HWCAP_ASIMDHP (1 << 10)
+#endif
 #endif
 
 namespace zvec {
@@ -357,6 +360,21 @@ bool CpuFeatures::NEON(void) {
 #endif
 }
 
+//! ARM half-precision vector arithmetic (FEAT_FP16) support
+bool CpuFeatures::FP16(void) {
+#if defined(__aarch64__) && defined(__linux__)
+  return !!(getauxval(AT_HWCAP) & HWCAP_ASIMDHP);
+#elif defined(__aarch64__) && defined(__APPLE__)
+  // FEAT_FP16 is present on all Apple Silicon (A11 and later).
+  return true;
+#elif defined(AILEGO_HAVE_NEON) && defined(__ARM_FEATURE_FP16_VECTOR_ARITHMETIC)
+  // No runtime probe available; trust the compile-time target features.
+  return true;
+#else
+  return false;
+#endif
+}
+
 const char *CpuFeatures::Intrinsics(void) {
   return ""
 #if defined(AILEGO_HAVE_NEON)
```

**File**: `src/ailego/internal/cpu_features.h` (modified, +6/-0)
```diff
@@ -185,6 +185,9 @@ class CpuFeatures {
   //! ARM NEON (ASIMD) support
   static bool NEON(void);
 
+  //! ARM half-precision vector arithmetic (FEAT_FP16) support
+  static bool FP16(void);
+
   //! Intrinsics of compiling
   static const char *Intrinsics(void);
 
@@ -367,6 +370,9 @@ class CpuFeatures {
 
     //! ARM NEON (ASIMD) support
     bool NEON = CpuFeatures::NEON();
+
+    //! ARM half-precision vector arithmetic (FEAT_FP16) support
+    bool FP16 = CpuFeatures::FP16();
   };
   static StaticFlags static_flags_;
 };
```

**File**: `src/turbo/CMakeLists.txt` (modified, +132/-56)
```diff
@@ -1,26 +1,86 @@
 include(${PROJECT_ROOT_DIR}/cmake/bazel.cmake)
 include(${PROJECT_ROOT_DIR}/cmake/option.cmake)
+include(CheckCXXSourceCompiles)
 
-if(NOT ANDROID AND AUTO_DETECT_ARCH)
-    if (HOST_ARCH MATCHES "^(x86|x64)$")
-        setup_compiler_march_for_x86(TURBO_MARCH_FLAG_SSE2 TURBO_MARCH_FLAG_AVX2 TURBO_MARCH_FLAG_AVX512 TURBO_MARCH_FLAG_AVX512FP16)
-        # kSSE2 is gated by SSE2 at runtime. Keep these translation units at
-        # that exact baseline so auto-vectorized scalar tails cannot acquire
-        # instructions from the broader corei7 profile returned above.
-        if(MSVC AND HOST_ARCH STREQUAL "x86")
-            set(TURBO_MARCH_FLAG_SSE2 "/arch:SSE2")
-        elseif(NOT MSVC)
-            if(HOST_ARCH STREQUAL "x64")
-                set(TURBO_MARCH_FLAG_SSE2 "-march=x86-64")
-            else()
-                set(TURBO_MARCH_FLAG_SSE2 "-march=i686 -msse2")
-            endif()
-        endif()
-    elseif (HOST_ARCH MATCHES "^(arm|arm64)$")
-        # ARM64 architecture - NEON is enabled by default on aarch64,
-        # no special march flags needed.
-        message(STATUS "turbo: ARM64 detected, NEON enabled by default")
+# HOST_ARCH is only populated by the shared AUTO_DETECT_ARCH path. Resolve the
+# CMake target locally as well so Turbo's ARM dispatch also works for Android
+# cross builds and explicitly selected architectures.
+set(_TURBO_TARGET_ARCH "${HOST_ARCH}")
+if(NOT _TURBO_TARGET_ARCH)
+  string(TOLOWER "${CMAKE_SYSTEM_PROCESSOR}" _TURBO_SYSTEM_PROCESSOR)
+  if(_TURBO_SYSTEM_PROCESSOR MATCHES "^(x86_64|amd64|x64)$")
+    set(_TURBO_TARGET_ARCH x64)
+  elseif(_TURBO_SYSTEM_PROCESSOR MATCHES "^(i[3-6]86|x86)$")
+    set(_TURBO_TARGET_ARCH x86)
+  elseif(_TURBO_SYSTEM_PROCESSOR MATCHES "^(aarch64|arm64)$")
+    set(_TURBO_TARGET_ARCH arm64)
+  elseif(_TURBO_SYSTEM_PROCESSOR MATCHES "^(arm|armv7|armv7-a|armv7l)$")
+    set(_TURBO_TARGET_ARCH arm)
+  else()
+    set(_TURBO_TARGET_ARCH unknown)
+  endif()
+endif()
+
+if(NOT ANDROID AND AUTO_DETECT_ARCH AND
+   _TURBO_TARGET_ARCH MATCHES "^(x86|x64)$")
+  setup_compiler_march_for_x86(
+    TURBO_MARCH_FLAG_SSE2
+    TURBO_MARCH_FLAG_AVX2
+    TURBO_MARCH_FLAG_AVX512
+    TURBO_MARCH_FLAG_AVX512FP16)
+  # kSSE2 is gated by SSE2 at runtime. Keep these translation units at
+  # that exact baseline so auto-vectorized scalar tails cannot acquire
+  # instructions from the broader corei7 profile returned above.
+  if(MSVC AND _TURBO_TARGET_ARCH STREQUAL "x86")
+    set(TURBO_MARCH_FLAG_SSE2 "/arch:SSE2")
+  elseif(NOT MSVC)
+    if(_TURBO_TARGET_ARCH STREQUAL "x64")
+      set(TURBO_MARCH_FLAG_SSE2 "-march=x86-64")
+    else()
+      set(TURBO_MARCH_FLAG_SSE2 "-march=i686 -msse2")
     endif()
+  endif()
+endif()
+
+set(ZVEC_TURBO_ARM_FP16_SUPPORTED OFF)
+set(TURBO_MARCH_FLAG_NEON_FP16 "")
+if(NOT IOS AND NOT MSVC AND (AUTO_DETECT_ARCH OR ANDROID) AND
+   _TURBO_TARGET_ARCH MATCHES "^(arm|arm64)$")
+  # Keep this probe local to Turbo: only its neon_fp16 distance kernels need
+  # FEAT_FP16, while the plain NEON kernels (which widen to FP32) and the
+  # existing Ailego distance implementations stay untouched.
+  # Android is kept even though build_android.sh sets AUTO_DETECT_ARCH=OFF:
+  # that switch guards the host-oriented march detection, while this probe
+  # runs against the actual (cross) target toolchain.
+  # No fallback march is injected on probe failure: armv8-a is already the
+  # aarch64 default, and forcing it onto 32-bit arm targets would be wrong.
+  set(_TURBO_SAVED_CMAKE_REQUIRED_FLAGS "${CMAKE_REQUIRED_FLAGS}")
+  set(CMAKE_REQUIRED_FLAGS
+    "${_TURBO_SAVED_CMAKE_REQUIRED_FLAGS} -march=armv8.2-a+fp16")
+  check_cxx_source_compiles([=[
+    #include <arm_neon.h>
+    #if !defined(__aarch64__)
+    #error "AArch64 target required"
+    #endif
+    #if !defined(__ARM_FEATURE_FP16_VECTOR_ARITHMETIC)
+    #error "ARM FP16 vector arithmetic macro missing"
+    #endif
+    int main() {
+      float16x8_t value = vdupq_n_f16(1.0f);
+      value = vfmaq_f16(value, value, value);
+      return vgetq_lane_u16(vreinterpretq_u16_f16(value), 0) == 0;
+    }
+  ]=] ZVEC_TURBO_COMPILER_SUPPORTS_ARM_FP16)
+  set(CMAKE_REQUIRED_FLAGS "${_TURBO_SAVED_CMAKE_REQUIRED_FLAGS}")
+
+  if(ZVEC_TURBO_COMPILER_SUPPORTS_ARM_FP16)
+    set(TURBO_MARCH_FLAG_NEON_FP16 "-march=armv8.2-a+fp16")
+    set(ZVEC_TURBO_ARM_FP16_SUPPORTED ON)
+  endif()
+
+  message(STATUS
+    "turbo: NEON FP16 march flag: ${TURBO_MARCH_FLAG_NEON_FP16}, "
+    "native kernels: ${ZVEC_TURBO_ARM_FP16_SUPPORTED}")
 endif()
 
 file(GLOB_RECURSE ALL_SRCS *.cc *.c *.h)
@@ -29,46 +89,61 @@ file(GLOB_RECURSE ALL_SRCS *.cc *.c *.h)
 # set_source_files_properties is directory-scoped, so it must be called in the
 # same directory that adds the sources to a target (i.e. here, not in a
 # subdirectory).
-if(NOT ANDROID AND AUTO_DETECT_ARCH)
-    if (HOST_ARCH MATCHES "^(x86|x64)$")
-        # SSE2
-        file(GLOB_RECURSE SSE2_SRCS ${CMAKE_CURRENT_SOURCE_DIR}/dist
```

**File**: `src/turbo/distance/neon_fp16/fp16/cosine.cc` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#include "neon_fp16/fp16/cosine.h"
+#include "common/fp16_common.h"
+#if ZVEC_TURBO_FP16_NEON
+#include <arm_neon.h>
+#else
+#include "scalar/fp16/cosine.h"
+#endif
+
+namespace zvec::turbo::neon_fp16 {
+
+#if ZVEC_TURBO_FP16_NEON
+namespace {
+
+// Cosine receives normalized FP16 vectors and deliberately retains native
+// FP16 products and accumulation for throughput. This is approximate: long
+// sums can lose small contributions even for normalized inputs. Keep this
+// separate from inner product, whose unrestricted inputs need FP32 arithmetic.
+inline float cosine_fp16_dot(const float16_t *lhs, const float16_t *rhs,
+                             size_t dim) {
+  float16x8_t sum0 = vdupq_n_f16(0.0f);
+  float16x8_t sum1 = vdupq_n_f16(0.0f);
+  float16x8_t sum2 = vdupq_n_f16(0.0f);
+  float16x8_t sum3 = vdupq_n_f16(0.0f);
+  size_t i = 0;
+  for (; i + 32 <= dim; i += 32) {
+    sum0 = vfmaq_f16(sum0, vld1q_f16(lhs + i), vld1q_f16(rhs + i));
+    sum1 = vfmaq_f16(sum1, vld1q_f16(lhs + i + 8), vld1q_f16(rhs + i + 8));
+    sum2 = vfmaq_f16(sum2, vld1q_f16(lhs + i + 16), vld1q_f16(rhs + i + 16));
+    sum3 = vfmaq_f16(sum3, vld1q_f16(lhs + i + 24), vld1q_f16(rhs + i + 24));
+  }
+  for (; i + 8 <= dim; i += 8) {
+    sum0 = vfmaq_f16(sum0, vld1q_f16(lhs + i), vld1q_f16(rhs + i));
+  }
+  const float16x8_t sum =
+      vaddq_f16(vaddq_f16(sum0, sum1), vaddq_f16(sum2, sum3));
+  const float32x4_t sum_f32 = vaddq_f32(vcvt_f32_f16(vget_low_f16(sum)),
+                                        vcvt_f32_f16(vget_high_f16(sum)));
+  float total = vaddvq_f32(sum_f32);
+  for (; i < dim; ++i) {
+    total += static_cast<float>(lhs[i]) * static_cast<float>(rhs[i]);
+  }
+  return total;
+}
+
+// Compute four candidates together so each query load is shared. Keep the
+// four accumulators and reduction order of cosine_fp16_dot for every row:
+// reassociating native FP16 sums would change the approximation.
+inline void cosine_fp16_distance_x4(const void *const *vectors,
+                                    const float16_t *query, size_t dim,
+                                    float *distances) {
+  const float16_t *rows[4] = {reinterpret_cast<const float16_t *>(vectors[0]),
+                              reinterpret_cast<const float16_t *>(vectors[1]),
+                              reinterpret_cast<const float16_t *>(vectors[2]),
+                              reinterpret_cast<const float16_t *>(vectors[3])};
+  float16x8_t sum0[4] = {};
+  float16x8_t sum1[4] = {};
+  float16x8_t sum2[4] = {};
+  float16x8_t sum3[4] = {};
+  size_t i = 0;
+  for (; i + 32 <= dim; i += 32) {
+    const float16x8_t query0 = vld1q_f16(query + i);
+    const float16x8_t query1 = vld1q_f16(query + i + 8);
+    const float16x8_t query2 = vld1q_f16(query + i + 16);
+    const float16x8_t query3 = vld1q_f16(query + i + 24);
+    for (size_t row = 0; row < 4; ++row) {
+      sum0[row] = vfmaq_f16(sum0[row], vld1q_f16(rows[row] + i), query0);
+      sum1[row] = vfmaq_f16(sum1[row], vld1q_f16(rows[row] + i + 8), query1);
+      sum2[row] = vfmaq_f16(sum2[row], vld1q_f16(rows[row] + i + 16), query2);
+      sum3[row] = vfmaq_f16(sum3[row], vld1q_f16(rows[row] + i + 24), query3);
+    }
+  }
+  for (; i + 8 <= dim; i += 8) {
+    const float16x8_t query0 = vld1q_f16(query + i);
+    for (size_t row = 0; row < 4; ++row) {
+      sum0[row] = vfmaq_f16(sum0[row], vld1q_f16(rows[row] + i), query0);
+    }
+  }
+  float totals[4];
+  for (size_t row = 0; row < 4; ++row) {
+    const float16x8_t sum = vaddq_f16(vaddq_f16(sum0[row], sum1[row]),
+                                      vaddq_f16(sum2[row], sum3[row]));
+    const float32x4_t sum_f32 = vaddq_f32(vcvt_f32_f16(vget_low_f16(sum)),
+                                          vcvt_f32_f16(vget_high_f16(sum)));
+    totals[row] = vaddvq_f32(sum_f32);
+  }
+  for (; i < dim; ++i) {
+    const float query_value = static_cast<float>(query[i]);
+    for (size_t row = 0; row < 4; ++row) {
+      totals[row] += static_cast<float>(rows[row][i]) * query_value;
+    }
+  }
+  for (size_t row = 0; row < 4; ++row) {
+    distances[row] = 1.0f - totals[row];
+  }
+}
+
+}  // namespace
+#endif
+
+void cosine_fp16_distance_neon_fp16(const void *a, const void *b, size_t dim,
+                                    float *distance) {
+#if ZVEC_TURBO_FP16_NEON
+  *distance =
+      1.0f - c
```

**File**: `src/turbo/distance/neon_fp16/fp16/cosine.h` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#pragma once
+
+#include <cstddef>
+
+namespace zvec::turbo::neon_fp16 {
+
+// Compute cosine distance between normalized FP16 vectors using native FP16
+// products and accumulation, widening only for the final reduction and tail.
+// Accumulation is approximate, especially for long vectors.
+void cosine_fp16_distance_neon_fp16(const void *a, const void *b, size_t dim,
+                                    float *distance);
+
+// Batch version of cosine_fp16_distance_neon_fp16. Native NEON processes four
+// candidates together, sharing query loads without changing accumulation order.
+void cosine_fp16_batch_distance_neon_fp16(const void *const *vectors,
+                                          const void *query, size_t n,
+                                          size_t dim, float *distances,
+                                          const void *const *extra_values);
+
+}  // namespace zvec::turbo::neon_fp16
```

**File**: `src/turbo/distance/neon_fp16/fp16/fp32_batch.h` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#pragma once
+
+#include <cstddef>
+#include <arm_neon.h>
+
+namespace zvec::turbo::neon_fp16 {
+namespace detail {
+
+// Each row keeps the same four FP32 accumulators and reduction order as the
+// single-distance kernels. Only query loads/conversions are shared across rows.
+template <bool SquaredEuclidean>
+struct Fp32DistanceAccumulator {
+  float32x4_t sum0 = vdupq_n_f32(0.0f);
+  float32x4_t sum1 = vdupq_n_f32(0.0f);
+  float32x4_t sum2 = vdupq_n_f32(0.0f);
+  float32x4_t sum3 = vdupq_n_f32(0.0f);
+
+  static inline void accumulate(float32x4_t &sum, float32x4_t row,
+                                float32x4_t query) {
+    if constexpr (SquaredEuclidean) {
+      const float32x4_t diff = vsubq_f32(row, query);
+      sum = vfmaq_f32(sum, diff, diff);
+    } else {
+      sum = vfmaq_f32(sum, row, query);
+    }
+  }
+
+  inline void add16(const float16_t *row, float32x4_t q0, float32x4_t q1,
+                    float32x4_t q2, float32x4_t q3) {
+    const float16x8_t r0 = vld1q_f16(row);
+    const float16x8_t r1 = vld1q_f16(row + 8);
+    accumulate(sum0, vcvt_f32_f16(vget_low_f16(r0)), q0);
+    accumulate(sum1, vcvt_high_f32_f16(r0), q1);
+    accumulate(sum2, vcvt_f32_f16(vget_low_f16(r1)), q2);
+    accumulate(sum3, vcvt_high_f32_f16(r1), q3);
+  }
+
+  inline void add8(const float16_t *row, float32x4_t q0, float32x4_t q1) {
+    const float16x8_t r0 = vld1q_f16(row);
+    accumulate(sum0, vcvt_f32_f16(vget_low_f16(r0)), q0);
+    accumulate(sum1, vcvt_high_f32_f16(r0), q1);
+  }
+
+  inline float reduce() const {
+    return vaddvq_f32(vaddq_f32(vaddq_f32(sum0, sum1), vaddq_f32(sum2, sum3)));
+  }
+
+  static inline void add_tail(float &sum, float row, float query) {
+    if constexpr (SquaredEuclidean) {
+      const float diff = row - query;
+      sum += diff * diff;
+    } else {
+      sum += row * query;
+    }
+  }
+};
+
+// Fuse four candidates without staging a converted query or requiring the
+// candidate vectors to be contiguous. At each dimension block, the query is
+// loaded and widened once, then reused by all four independent accumulators.
+template <bool SquaredEuclidean>
+inline void fp32_distance_batch4(const void *const *vectors,
+                                 const float16_t *query, size_t dim,
+                                 float *distances) {
+  const float16_t *row0 = reinterpret_cast<const float16_t *>(vectors[0]);
+  const float16_t *row1 = reinterpret_cast<const float16_t *>(vectors[1]);
+  const float16_t *row2 = reinterpret_cast<const float16_t *>(vectors[2]);
+  const float16_t *row3 = reinterpret_cast<const float16_t *>(vectors[3]);
+  using Accumulator = Fp32DistanceAccumulator<SquaredEuclidean>;
+  Accumulator a0, a1, a2, a3;
+
+  size_t d = 0;
+  for (; d + 16 <= dim; d += 16) {
+    const float16x8_t query0 = vld1q_f16(query + d);
+    const float16x8_t query1 = vld1q_f16(query + d + 8);
+    const float32x4_t q0 = vcvt_f32_f16(vget_low_f16(query0));
+    const float32x4_t q1 = vcvt_high_f32_f16(query0);
+    const float32x4_t q2 = vcvt_f32_f16(vget_low_f16(query1));
+    const float32x4_t q3 = vcvt_high_f32_f16(query1);
+    a0.add16(row0 + d, q0, q1, q2, q3);
+    a1.add16(row1 + d, q0, q1, q2, q3);
+    a2.add16(row2 + d, q0, q1, q2, q3);
+    a3.add16(row3 + d, q0, q1, q2, q3);
+  }
+  if (d + 8 <= dim) {
+    const float16x8_t query0 = vld1q_f16(query + d);
+    const float32x4_t q0 = vcvt_f32_f16(vget_low_f16(query0));
+    const float32x4_t q1 = vcvt_high_f32_f16(query0);
+    a0.add8(row0 + d, q0, q1);
+    a1.add8(row1 + d, q0, q1);
+    a2.add8(row2 + d, q0, q1);
+    a3.add8(row3 + d, q0, q1);
+    d += 8;
+  }
+
+  float total0 = a0.reduce();
+  float total1 = a1.reduce();
+  float total2 = a2.reduce();
+  float total3 = a3.reduce();
+  for (; d < dim; ++d) {
+    const float q = static_cast<float>(query[d]);
+    Accumulator::add_tail(total0, static_cast<float>(row0[d]), q);
+    Accumulator::add_tail(total1, static_cast<float>(row1[d]), q);
+    Accumulator::add_tail(total2, static_cast<float>(row2[d]), q);
+    Accumulator::add_tail(total3, static_cast<float>(row3[d]), q);
+  }
+  // Inner product uses the distance convention -dot(row, query).
+  distances[0] = SquaredEuclidean ? total0 : -total0;
+  distances[1] = SquaredEuclidean ? total1 : -total1;
+  distances[2] = SquaredEuclidean ? total2 : -total2;
+  dista
```

**File**: `src/turbo/distance/neon_fp16/fp16/inner_product.cc` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#include "neon_fp16/fp16/inner_product.h"
+#include "common/fp16_common.h"
+#if ZVEC_TURBO_FP16_NEON
+#include <arm_neon.h>
+#include "neon_fp16/fp16/fp32_batch.h"
+#else
+#include "scalar/fp16/inner_product.h"
+#endif
+
+namespace zvec::turbo::neon_fp16 {
+
+#if ZVEC_TURBO_FP16_NEON
+namespace {
+
+// Widen before multiplying: unrestricted finite FP16 inputs can overflow
+// FP16 products, and long sums can lose small contributions. Four FP32
+// accumulators hide FMA latency without sacrificing the range or precision
+// of the distance arithmetic. Cosine has its own native FP16 implementation.
+inline float inner_product_fp16_accum(const float16_t *lhs,
+                                      const float16_t *rhs, size_t dim) {
+  float32x4_t sum0 = vdupq_n_f32(0.0f);
+  float32x4_t sum1 = vdupq_n_f32(0.0f);
+  float32x4_t sum2 = vdupq_n_f32(0.0f);
+  float32x4_t sum3 = vdupq_n_f32(0.0f);
+  size_t i = 0;
+  for (; i + 16 <= dim; i += 16) {
+    const float16x8_t lhs0 = vld1q_f16(lhs + i);
+    const float16x8_t rhs0 = vld1q_f16(rhs + i);
+    const float16x8_t lhs1 = vld1q_f16(lhs + i + 8);
+    const float16x8_t rhs1 = vld1q_f16(rhs + i + 8);
+    sum0 = vfmaq_f32(sum0, vcvt_f32_f16(vget_low_f16(lhs0)),
+                     vcvt_f32_f16(vget_low_f16(rhs0)));
+    sum1 = vfmaq_f32(sum1, vcvt_high_f32_f16(lhs0), vcvt_high_f32_f16(rhs0));
+    sum2 = vfmaq_f32(sum2, vcvt_f32_f16(vget_low_f16(lhs1)),
+                     vcvt_f32_f16(vget_low_f16(rhs1)));
+    sum3 = vfmaq_f32(sum3, vcvt_high_f32_f16(lhs1), vcvt_high_f32_f16(rhs1));
+  }
+  if (i + 8 <= dim) {
+    const float16x8_t lhs0 = vld1q_f16(lhs + i);
+    const float16x8_t rhs0 = vld1q_f16(rhs + i);
+    sum0 = vfmaq_f32(sum0, vcvt_f32_f16(vget_low_f16(lhs0)),
+                     vcvt_f32_f16(vget_low_f16(rhs0)));
+    sum1 = vfmaq_f32(sum1, vcvt_high_f32_f16(lhs0), vcvt_high_f32_f16(rhs0));
+    i += 8;
+  }
+  float total =
+      vaddvq_f32(vaddq_f32(vaddq_f32(sum0, sum1), vaddq_f32(sum2, sum3)));
+  for (; i < dim; ++i) {
+    total += static_cast<float>(lhs[i]) * static_cast<float>(rhs[i]);
+  }
+  return total;
+}
+
+}  // namespace
+#endif
+
+// Compute negated inner product between a single FP16 vector pair.
+void inner_product_fp16_distance_neon_fp16(const void *a, const void *b,
+                                           size_t dim, float *distance) {
+#if ZVEC_TURBO_FP16_NEON
+  *distance =
+      -inner_product_fp16_accum(reinterpret_cast<const float16_t *>(a),
+                                reinterpret_cast<const float16_t *>(b), dim);
+#else
+  // Compiled without FEAT_FP16 (e.g. no -march=armv8.2-a+fp16), so delegate
+  // to the scalar kernel. Never leave `distance` unwritten: turbo.cc selects
+  // these entry points from CpuFeatures flags, and a no-op here would
+  // silently return whatever the caller's buffer already held.
+  scalar::inner_product_fp16_distance(a, b, dim, distance);
+#endif
+}
+
+// Batch version of inner_product_fp16_distance_neon_fp16.
+void inner_product_fp16_batch_distance_neon_fp16(
+    const void *const *vectors, const void *query, size_t n, size_t dim,
+    float *distances, const void *const *extra_values) {
+#if ZVEC_TURBO_FP16_NEON
+  (void)extra_values;
+  const float16_t *typed_query = reinterpret_cast<const float16_t *>(query);
+  size_t i = 0;
+  for (; n - i >= 4; i += 4) {
+    detail::fp32_distance_batch4<false>(vectors + i, typed_query, dim,
+                                        distances + i);
+  }
+  for (; i < n; ++i) {
+    distances[i] = -inner_product_fp16_accum(
+        reinterpret_cast<const float16_t *>(vectors[i]), typed_query, dim);
+  }
+#else
+  scalar::inner_product_fp16_batch_distance(vectors, query, n, dim, distances,
+                                            extra_values);
+#endif
+}
+
+}  // namespace zvec::turbo::neon_fp16
```

**File**: `src/turbo/distance/neon_fp16/fp16/inner_product.h` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#pragma once
+
+#include <cstddef>
+
+namespace zvec::turbo::neon_fp16 {
+
+// Compute negated inner product between a single FP16 vector pair using
+// NEON vector arithmetic with FP32 products and accumulation.
+void inner_product_fp16_distance_neon_fp16(const void *a, const void *b,
+                                           size_t dim, float *distance);
+
+// Batch version of inner_product_fp16_distance_neon_fp16.
+// Four candidates share each query load/conversion; remaining rows use the
+// single-distance arithmetic. Candidate vectors need not be contiguous.
+void inner_product_fp16_batch_distance_neon_fp16(
+    const void *const *vectors, const void *query, size_t n, size_t dim,
+    float *distances, const void *const *extra_values);
+
+}  // namespace zvec::turbo::neon_fp16
```

#### Recent Merged Pull Requests:
- **PR #792** (closed): Feat/sqlite derived indexing (@ilike314272)
- **PR #780** (2026-09-29): feat(rabitq): upgrade RaBitQ-Library to v0.3.8 and enable Windows x86_64 (@egolearner)
- **PR #777** (2026-09-24): fix(quantizer): use rounded INT4 values for scoring metadata (@richyreachy)
- **PR #775** (2026-09-28): fix(core): honor optimize threads in nested training(rabitQ/DiskANN) (@JalinWang)
- **PR #769** (2026-09-22): refactor(sqlengine): separate filter validation and execution binding (@egolearner)
- **PR #766** (2026-09-18): feat(buffer): integrate IVF and DiskANN with shared page cache (@iaojnh)
- **PR #765** (2026-09-17): refactor(turbo): share implementation across pq quantizers (@richyreachy)
- **PR #764** (2026-09-18): chore: enable readability-identifier-naming check and fix violations (@egolearner)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
