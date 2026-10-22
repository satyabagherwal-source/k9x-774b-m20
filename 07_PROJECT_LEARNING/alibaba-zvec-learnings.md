> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source**: github ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Source Version**: `8d499692`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T21:28:57.617Z  
> **Learning ID**: `learn-github-alibaba-zvec`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): alibaba/zvec

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T21:28:57.164Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/zvec`
- **Description**: A lightweight, lightning-fast, in-process vector database
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 16138 stars

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
  //! `alignment` must be a power of two; it defaults to the target cache line.
  //!
  //! `zero_fill` follows the same contract as AllocateHugePage: true guarantees
  //! zeroed memory; false does not require zeroing but the implementation may
  //! still return zeroed memory (it does on the huge-page mmap path). Never
  //! assume non-zero contents.
  //!
  //! Blocks returned here MUST be released with FreeAligned, passing the same
  //! `size`, because the chosen allocator (and therefore the matching free) is
  //! derived from `size`.
  static void *AllocateAligned(size_t size,
                               size_t alignment = AILEGO_CACHE_LINE_SIZE,
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #836** (2026-10-22): **[Bug]:**
  *Symptoms*: ### Description  [zvec_deadlock_bug_report.md](https://github.com/user-attachments/files/33753801/zvec_deadlock_bug_report.md)  ### Steps to Reproduce  ```python import zvec, numpy as np, threading, time  DIM, N, PATH = 768, 20000, "/tmp/zvec_ro_repro"  # 1) create + insert + build index schema = zvec.CollectionSchema(     name="repro",     vectors=zvec.VectorSchema("embedding", zvec.DataType.VECTOR_FP32, DIM), ) col = zvec.create_and_open(PATH, schema) rng = np.random.default_rng(0) for i in range(0, N, 1000):     docs = [         zvec.Doc(id=str(j), vectors={"embedding": rng.standard_normal(DIM).astype("float32")})         for j in range(i, min(i + 1000, N))     ]     col.insert(docs) col.optimize() col.close()  # 2) reopen READ-ONLY and hammer concurrent queries ro = zvec.open(PATH, zvec.CollectionOption(read_only=True, enable_mmap=False)) vq = lambda: zvec.VectorQuery("embedding", vector=rng.standard_normal(DIM).astype("float32"), topk=10)  stop = threading.Event() def worker():     while not stop.is_set():         try:             ro.query(vq(), topk=10)         except Exception:             pass  threads = [threading.Thread(target=worker, daemon=True) for _ in range(32)] [t.start() for t in threads] time.sleep(120)   # in our environment the process deadlocks within seconds~minutes;                   # if it is still alive after 120s the trigger threshold was not reached print("survived") ```  ### Logs / Stack Trace  ```shell  ```  ### Operating System  WSL2  ### Build 

- **Issue #815** (2026-10-21): **[Bug]: read_only=True close() modifies persisted Flat index bytes in v0.7.0**
  *Symptoms*: ## Description  In zvec 0.7.0, opening a persisted FP32 Flat/COSINE collection with `CollectionOption(read_only=True)` and then calling `close()` changes bytes in its vector-index file.  A snapshot taken immediately after `open()` is unchanged; the snapshot after `close()` differs. There are no queries, inserts, updates, deletes, or flushes between the read-only open and close. This reproduces with only two 4-dimensional vectors; no scalar indexes, FTS, application adapters, or external data are needed.  ## Steps to reproduce  Install the published package with `python -m pip install zvec==0.7.0`, save the following as `repro.py`, and run `python repro.py`.  ```python import hashlib import tempfile import time from pathlib import Path  import zvec   def snapshot(path):     return {str(p.relative_to(path)): p.read_bytes()             for p in path.rglob("*") if p.is_file()}   with tempfile.TemporaryDirectory(prefix="zvec-readonly-") as tmp:     path = Path(tmp) / "collection"     schema = zvec.CollectionSchema(         name="readonly_repro",         vectors=zvec.VectorSchema(             "embedding", zvec.DataType.VECTOR_FP32, 4,             index_param=zvec.FlatIndexParam(metric_type=zvec.MetricType.COSINE),         ),     )     collection = zvec.create_and_open(str(path), schema)     collection.insert([         zvec.Doc(id="a", vectors={"embedding": [1.0, 0.0, 0.0, 0.0]}),         zvec.Doc(id="b", vectors={"embedding": [0.0, 1.0, 0.0, 0.0]}),     ])     collection.flush()   

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

### Incident Patch 1: `8b531d17` (2026-10-21)
**Commit Message**: fix(core): preserve index bytes on read-only close (#834)

**File**: `src/core/algorithm/flat/flat_streamer.cc` (modified, +5/-2)
```diff
@@ -212,11 +212,14 @@ template <size_t BATCH_SIZE>
 int FlatStreamer<BATCH_SIZE>::close() {
   LOG_DEBUG("FlatStreamer close");
 
-  entity_->flush_linear_meta();
+  int ret = entity_->flush_linear_meta();
+  if (ret != 0) {
+    return ret;
+  }
 
   stats_.clear();
 
-  int ret = entity_->close();
+  ret = entity_->close();
   if (ailego_unlikely(ret != 0)) {
     return ret;
   }
```

**File**: `src/core/algorithm/flat/flat_streamer_entity.cc` (modified, +9/-1)
```diff
@@ -228,12 +228,14 @@ int FlatStreamerEntity::close() {
   meta_.header.linear_body_size = 0;
   batch_query_preprocess_ = nullptr;
   extra_values_size_ = 0;
+  meta_dirty_ = false;
 
   return 0;
 }
 
 int FlatStreamerEntity::flush_linear_meta() {
-  if (!storage_) {
+  std::lock_guard<std::mutex> lock(mutex_);
+  if (!storage_ || !meta_dirty_) {
     return 0;
   }
 
@@ -250,6 +252,8 @@ int FlatStreamerEntity::flush_linear_meta() {
     return IndexError_WriteData;
   }
 
+  meta_dirty_ = false;
+
   return 0;
 }
 
@@ -308,6 +312,7 @@ int FlatStreamerEntity::add(uint64_t key, const void *vec, size_t size) {
   // function (alloc_block / add_to_block may compete for the same memory).
   head_block.reset(nullptr);
 
+  meta_dirty_ = true;
   if (!this->is_valid_block(block)) {
     int ret = this->alloc_block(block, &block);
     if (ailego_unlikely(ret != 0)) {
@@ -939,6 +944,7 @@ void FlatStreamerEntity::Iterator::read_next_block() {
 }
 
 int FlatStreamerEntity::init_storage(IndexStorage::Pointer storage) {
+  meta_dirty_ = true;
   // Init Linear Meta Segment
   meta_.create_time = ailego::Realtime::Seconds();
   stats_.set_create_time(meta_.create_time);
@@ -1154,6 +1160,7 @@ int FlatStreamerEntity::load_segment_keys_to_vector() {
 }
 
 int FlatStreamerEntity::load_storage(IndexStorage::Pointer storage) {
+  meta_dirty_ = false;
   int ret = this->load_linear_meta(storage);
   if (ailego_unlikely(ret != 0)) {
     return ret;
@@ -1424,6 +1431,7 @@ int FlatStreamerEntity::add_vector_with_id(const uint32_t id, const void *query,
   }
 
 
+  meta_dirty_ = true;
   if (id >= vector_count()) {
     IndexStorage::MemoryBlock head_block;
     this->get_head_block(head_block);
```

**File**: `src/core/algorithm/flat/flat_streamer_entity.h` (modified, +2/-0)
```diff
@@ -502,6 +502,8 @@ class FlatStreamerEntity {
   std::vector<uint32_t> withid_key_map_{};
   std::vector<uint64_t> id_key_vector_{};
   bool filter_same_key_{false};
+  // Linear metadata only needs rewriting after creation or vector writes.
+  bool meta_dirty_{false};
   bool use_key_info_map_{true};
   uint32_t vec_unit_size_{0};
   uint32_t vec_cols_{0};
```

**File**: `src/core/algorithm/hnsw/hnsw_chunk.cc` (modified, +4/-2)
```diff
@@ -129,13 +129,15 @@ int ChunkBroker::open(IndexStorage::Pointer stg, uint32_t &chunk_size,
 }
 
 int ChunkBroker::close() {
-  flush(0UL);
+  // A loaded, unmodified index must not acquire a new timestamp on close.
+  // Storage can still be dirty for a newly created index with no vectors.
+  int ret = stg_ && (dirty_ || stg_->is_dirty()) ? flush(0UL) : 0;
 
   stg_.reset();
   check_crc_ = false;
   dirty_ = false;
 
-  return 0;
+  return ret;
 }
 
 int ChunkBroker::flush(uint64_t checkpoint) {
```

**File**: `src/core/algorithm/hnsw/hnsw_streamer.cc` (modified, +4/-1)
```diff
@@ -589,7 +589,10 @@ int HnswStreamer::close() {
   if (metric_) {
     meta_.set_metric(metric_->name(), 0, metric_->params());
   }
-  entity_->set_index_meta(meta_);
+  if (entity_->dirty()) {
+    int ret = entity_->set_index_meta(meta_);
+    if (ret != 0) return ret;
+  }
   int ret = entity_->close();
   if (ret != 0) {
     return ret;
```

**File**: `src/core/algorithm/hnsw/hnsw_streamer_entity.h` (modified, +5/-0)
```diff
@@ -148,6 +148,11 @@ class HnswStreamerEntity : public HnswEntity {
   //! return 0 on success, or errCode in failure
   int close();
 
+  //! Whether vectors have been modified since opening the entity.
+  bool dirty() const {
+    return broker_->dirty();
+  }
+
   //! Set meta information from entity
   int set_index_meta(const IndexMeta &meta) const {
     return IndexHelper::SerializeToStorage(meta, broker_->storage().get());
```

**File**: `src/core/algorithm/hnsw_rabitq/hnsw_rabitq_chunk.cc` (modified, +4/-2)
```diff
@@ -131,13 +131,15 @@ int HnswRabitqChunkBroker::open(IndexStorage::Pointer stg,
 }
 
 int HnswRabitqChunkBroker::close() {
-  flush(0UL);
+  // A loaded, unmodified index must not acquire a new timestamp on close.
+  // Storage can still be dirty for a newly created index with no vectors.
+  int ret = stg_ && (dirty_ || stg_->is_dirty()) ? flush(0UL) : 0;
 
   stg_.reset();
   check_crc_ = false;
   dirty_ = false;
 
-  return 0;
+  return ret;
 }
 
 int HnswRabitqChunkBroker::flush(uint64_t checkpoint) {
```

**File**: `src/core/algorithm/hnsw_rabitq/hnsw_rabitq_streamer.cc` (modified, +4/-1)
```diff
@@ -419,7 +419,10 @@ int HnswRabitqStreamer::close() {
 
   stats_.clear();
   meta_.set_metric(metric_->name(), 0, metric_->params());
-  entity_.set_index_meta(meta_);
+  if (entity_.dirty()) {
+    int ret = entity_.set_index_meta(meta_);
+    if (ret != 0) return ret;
+  }
   int ret = entity_.close();
   if (ret != 0) {
     return ret;
```

---

### Incident Patch 2: `a8e6ae35` (2026-10-21)
**Commit Message**: Enable RaBitQ on Linux/macOS/Android/iOS ARM64 and macOS x86_64 (#832)

**File**: `.github/workflows/04-android-build.yml` (modified, +3/-2)
```diff
@@ -116,9 +116,10 @@ jobs:
             -DCMAKE_CXX_COMPILER_LAUNCHER=ccache
 
           if [ "${{ matrix.abi }}" = "arm64-v8a" ]; then
-            echo "Building focused DiskAnn tests and public C++ examples for arm64-v8a..."
+            echo "Building focused ARM64 index tests and public C++ examples..."
             cmake --build "$BUILD_DIR" \
-              --target diskann_mobile_compat_test diskann_mobile_collection_test zvec_cpp_examples \
+              --target diskann_mobile_compat_test diskann_mobile_collection_test \
+                hnsw_rabitq_streamer_test ivf_rabitq_streamer_test zvec_cpp_examples \
               --parallel
             exit 0
           fi
```

**File**: `.github/workflows/06-ios-build.yml` (modified, +5/-3)
```diff
@@ -80,18 +80,20 @@ jobs:
             fi
           done
 
-      - name: Build required DiskAnn test targets
+      - name: Build required ARM64 index test targets
         run: |
           NPROC=$(sysctl -n hw.ncpu)
           BUILD_DIR=build_ios_${{ matrix.platform }}
           cmake --build "$BUILD_DIR" \
             --target diskann_mobile_compat_test diskann_mobile_collection_test \
+              hnsw_rabitq_streamer_test ivf_rabitq_streamer_test \
             --parallel "$NPROC"
 
-          for test_name in diskann_mobile_compat_test diskann_mobile_collection_test; do
+          for test_name in diskann_mobile_compat_test diskann_mobile_collection_test \
+            hnsw_rabitq_streamer_test ivf_rabitq_streamer_test; do
             test_app="$BUILD_DIR/bin/${test_name}.app"
             if [ ! -d "$test_app" ]; then
-              echo "::error::Missing required iOS DiskAnn test app: $test_app"
+              echo "::error::Missing required iOS index test app: $test_app"
               exit 1
             fi
           done
```

**File**: `CMakeLists.txt` (modified, +28/-12)
```diff
@@ -145,14 +145,30 @@ message(STATUS "BUILD_C_BINDINGS:${BUILD_C_BINDINGS}")
 message(STATUS "BUILD_TOOLS:${BUILD_TOOLS}")
 message(STATUS "BUILD_CPP_EXAMPLES:${BUILD_CPP_EXAMPLES}")
 
-# RaBitQ support (rabitqlib ships x86-64 AVX2/AVX-512 kernels with runtime dispatch):
-#   - Linux x86_64 with GCC/Clang
-#   - Windows x86_64 with MSVC (added upstream in v0.3.8)
-# Everything else (ARM, Android, iOS, 32-bit) falls back to the stub libraries.
+# RaBitQ support:
+#   - Linux x86_64 and ARM64 with GCC/Clang
+#   - macOS x86_64 and ARM64 with AppleClang
+#   - Windows x86_64 with MSVC
+#   - Android ARM64 and iOS ARM64 with Clang
+# ARM64 uses NEON; x86-64 uses runtime AVX2/AVX-512 dispatch.
+# Other targets, including Android x86_64, iOS x86_64, Windows ARM64, and
+# 32-bit platforms, use stub libraries.
+set(RABITQ_TARGET_PROCESSOR "${CMAKE_SYSTEM_PROCESSOR}")
+if(APPLE AND CMAKE_OSX_ARCHITECTURES)
+  set(RABITQ_TARGET_PROCESSOR "${CMAKE_OSX_ARCHITECTURES}")
+endif()
+string(TOLOWER "${RABITQ_TARGET_PROCESSOR}" RABITQ_TARGET_PROCESSOR)
 set(RABITQ_SUPPORTED OFF)
-if(NOT ANDROID AND NOT IOS AND CMAKE_SIZEOF_VOID_P EQUAL 8
-   AND CMAKE_SYSTEM_PROCESSOR MATCHES "^(x86_64|amd64|AMD64)$"
-   AND (CMAKE_SYSTEM_NAME STREQUAL "Linux" OR (WIN32 AND MSVC)))
+if(CMAKE_SIZEOF_VOID_P EQUAL 8
+   AND RABITQ_TARGET_PROCESSOR MATCHES "^(arm64|aarch64)$"
+   AND (CMAKE_SYSTEM_NAME STREQUAL "Linux" OR
+        CMAKE_SYSTEM_NAME STREQUAL "Darwin" OR
+        (ANDROID AND ANDROID_ABI STREQUAL "arm64-v8a") OR IOS))
+  set(RABITQ_SUPPORTED ON)
+elseif(NOT ANDROID AND NOT IOS AND CMAKE_SIZEOF_VOID_P EQUAL 8
+   AND RABITQ_TARGET_PROCESSOR MATCHES "^(x86_64|amd64)$"
+   AND (CMAKE_SYSTEM_NAME STREQUAL "Linux" OR
+        CMAKE_SYSTEM_NAME STREQUAL "Darwin" OR (WIN32 AND MSVC)))
   if(MSVC)
     # /arch:AVX512 turns on the complete F/CD/VL/BW/DQ group. MSVC has no
     # separate switch for VPOPCNTDQ, so the popcount backend is compiled with
@@ -181,15 +197,15 @@ if(NOT ANDROID AND NOT IOS AND CMAKE_SIZEOF_VOID_P EQUAL 8
   endforeach()
   unset(_rabitq_probe)
 
-  if(RABITQ_SUPPORTED)
-    add_definitions(-DRABITQ_SUPPORTED=1)
-  else()
-    add_definitions(-DRABITQ_SUPPORTED=0)
+  if(NOT RABITQ_SUPPORTED)
     message(STATUS "RaBitQ support disabled - compiler cannot build all runtime dispatch variants")
   endif()
+endif()
+if(RABITQ_SUPPORTED)
+  add_definitions(-DRABITQ_SUPPORTED=1)
 else()
   add_definitions(-DRABITQ_SUPPORTED=0)
-  message(STATUS "RaBitQ support disabled - only supported on Linux x86_64 and Windows x86_64 (MSVC)")
+  message(STATUS "RaBitQ support disabled - unsupported platform or compiler")
 endif()
 message(STATUS "RABITQ_SUPPORTED: ${RABITQ_SUPPORTED}")
 
```

**File**: `src/core/algorithm/CMakeLists.txt` (modified, +5/-5)
```diff
@@ -56,10 +56,10 @@ if(RABITQ_SUPPORTED)
   cc_directory(ivf_rabitq)
 else()
   message(STATUS "NOT BUILD RABITQ")
-  # Empty stub library for unsupported platforms
+  # Empty stub library when RaBitQ is disabled for this build
   file(WRITE ${CMAKE_CURRENT_BINARY_DIR}/rabitq_stub.cc
-    "// Stub implementation for unsupported platforms\n"
-    "// RaBitQ only supports Linux x86_64 and Windows x86_64\n"
+    "// Stub implementation for build compatibility\n"
+    "// RaBitQ is disabled for this build\n"
     "namespace zvec { namespace core { /* empty namespace for compatibility */ } }\n"
   )
 
@@ -73,8 +73,8 @@ else()
     )
 
   file(WRITE ${CMAKE_CURRENT_BINARY_DIR}/ivf_rabitq_stub.cc
-    "// Stub implementation for unsupported platforms\n"
-    "// IVF RaBitQ only supports Linux x86_64 and Windows x86_64\n"
+    "// Stub implementation for build compatibility\n"
+    "// IVF RaBitQ is disabled for this build\n"
     "namespace zvec { namespace core { /* empty namespace for compatibility */ } }\n"
   )
 
```

**File**: `src/core/algorithm/hnsw_rabitq/rabitq_params.h` (modified, +3/-2)
```diff
@@ -45,9 +45,10 @@ constexpr int kMinRabitqDimSize = 64;
 constexpr int kMaxRabitqDimSize = 4095;
 
 // Reported wherever RaBitQ is compiled out. Keep in sync with RABITQ_SUPPORTED
-// in the top-level CMakeLists.txt; this is the only place naming the platforms.
+// in the top-level CMakeLists.txt.
 constexpr char kRabitqUnsupportedPlatform[] =
-    "RaBitQ is not supported on this platform (Linux/Windows x86_64)";
+    "RaBitQ is not supported on this platform (supported: Linux "
+    "x86_64/ARM64, macOS x86_64/ARM64, Windows x86_64, Android/iOS ARM64)";
 
 // Original vector dimension before converter (e.g., CosineNormalizeConverter)
 // modifies it. Used by IVF-RaBitQ to ignore extra dimensions from converter.
```

**File**: `src/db/index/common/schema.cc` (modified, +3/-2)
```diff
@@ -180,9 +180,10 @@ Status FieldSchema::validate() const {
         const bool supports_rabitq_avx2 = flags.AVX2 && flags.FMA;
         const bool supports_rabitq_avx512 =
             flags.AVX512F && flags.AVX512BW && flags.AVX512DQ;
-        if (!supports_rabitq_avx2 && !supports_rabitq_avx512) {
+        if (!supports_rabitq_avx2 && !supports_rabitq_avx512 && !flags.NEON) {
           return Status::NotSupported(
-              "RabitQ requires AVX2/FMA or AVX512F/BW/DQ to be supported");
+              "RabitQ requires AVX2/FMA, AVX512F/BW/DQ, or NEON to be "
+              "supported");
         }
       }
 
```

**File**: `tests/core/algorithm/hnsw_rabitq/hnsw_rabitq_streamer_test.cc` (modified, +3/-2)
```diff
@@ -46,8 +46,9 @@ std::string HnswRabitqStreamerTest::dir_("hnswRabitqStreamerTest");
 shared_ptr<IndexMeta> HnswRabitqStreamerTest::index_meta_ptr_;
 
 void HnswRabitqStreamerTest::SetUp() {
-  if (!rabitqlib::cpu::has_avx512_core() && !rabitqlib::cpu::has_avx2()) {
-    GTEST_SKIP() << "CPU does not support AVX2/FMA or AVX512F/BW/DQ";
+  if (!rabitqlib::cpu::has_avx512_core() && !rabitqlib::cpu::has_avx2() &&
+      !rabitqlib::cpu::has_neon()) {
+    GTEST_SKIP() << "CPU does not support AVX2/FMA, AVX512F/BW/DQ, or NEON";
   }
 
   index_meta_ptr_.reset(new (nothrow)
```

**File**: `tests/db/CMakeLists.txt` (modified, +16/-13)
```diff
@@ -1,6 +1,20 @@
 include(${PROJECT_ROOT_DIR}/cmake/bazel.cmake)
 include(${PROJECT_ROOT_DIR}/cmake/option.cmake)
 
+function(db_test_force_load_core TARGET)
+  # Include core registries and keep their RTTI in the test executable.
+  if(MSVC)
+    target_link_options(${TARGET} PRIVATE
+      "/WHOLEARCHIVE:$<TARGET_FILE:zvec_core>")
+  elseif(APPLE)
+    target_link_options(${TARGET} PRIVATE
+      "-Wl,-force_load,$<TARGET_FILE:zvec_core>")
+  else()
+    target_link_options(${TARGET} PRIVATE
+      "-Wl,--whole-archive,$<TARGET_FILE:zvec_core>,--no-whole-archive")
+  endif()
+endfunction()
+
 cc_directory(common)
 cc_directories(crash_recovery)
 cc_directory(sqlengine)
@@ -38,24 +52,13 @@ foreach(CC_SRCS ${ALL_TEST_SRCS})
   cc_gmock(
     NAME ${CC_TARGET} STRICT
     DEFS DISKANN_STRESS_TESTS=${DISKANN_STRESS_TESTS}
-    LIBS zvec
-    core_knn_flat
-    core_knn_flat_sparse
-    core_knn_hnsw
-    core_knn_hnsw_rabitq
-    core_knn_ivf_rabitq
-    core_knn_hnsw_sparse
-    core_knn_ivf
-    core_knn_diskann
-    core_mix_reducer
-    core_metric
-    core_utility
-    core_quantizer
+    LIBS zvec zvec_core
     ${CMAKE_THREAD_LIBS_INIT}
     ${CMAKE_DL_LIBS}
     SRCS ${CC_SRCS} index/utils/utils.cc
     INCS . .. ../../src
     LDFLAGS ${APPLE_FRAMEWORK_LIBS}
   )
+  db_test_force_load_core(${CC_TARGET})
   cc_test_suite(zvec ${CC_TARGET})
 endforeach()
```

---

### Incident Patch 3: `00d8e027` (2026-10-21)
**Commit Message**: fix(platform): centralize cache-line sizing (#831)

**File**: `python/zvec/model/param/__init__.pyi` (modified, +16/-8)
```diff
@@ -426,9 +426,11 @@ class HnswQueryParam(QueryParam):
         prefetch_offset (int, optional): Graph prefetch offset (PO) used by the
             HNSW fast path. ``0`` disables prefetching. Default is ``8``.
             Values are clamped to ``256``.
-        prefetch_lines (int, optional): Number of 64B cache lines to prefetch
-            per neighbour vector (PL). ``0`` (default) uses the auto-derived
-            value ``ceil(vector_size/64)``. Values are clamped to ``256``.
+        prefetch_lines (int, optional): Number of cache lines to prefetch per
+            neighbour vector (PL). Cache-line size follows the build target:
+            normally 128 bytes on Apple ARM64 and 64 bytes elsewhere.
+            ``0`` (default) uses ``ceil(vector_size/cache_line_size)``.
+            Values are clamped to ``256``.
 
     Examples:
         >>> params = HnswQueryParam(ef=300)
@@ -461,8 +463,10 @@ class HnswQueryParam(QueryParam):
             extra_params (dict, optional): Additional search parameters. Supported keys:
                 - ``prefetch_offset`` (int): Graph prefetch offset (PO).
                   ``0`` disables prefetching. Default is ``8``.
-                - ``prefetch_lines`` (int): Number of 64B cache lines to prefetch
-                  per neighbour vector (PL). ``0`` (default) means auto-derive from vector size.
+                - ``prefetch_lines`` (int): Number of cache lines to prefetch
+                  per neighbour vector (PL), normally 128 bytes on Apple ARM64
+                  and 64 bytes elsewhere. ``0`` (default) uses
+                  ``ceil(vector_size/cache_line_size)``.
         """
 
     def __repr__(self) -> str: ...
@@ -909,8 +913,10 @@ class VamanaQueryParam(QueryParam):
         prefetch_offset (int): Pool-phase vector-prefetch prefix size (PO).
             The shared default 8 is resolved using a nominal 6 KiB budget
             for this phase only; this is not a global prefetch limit.
-        prefetch_lines (int): Cache lines to prefetch per vector (PL). The
-            shared default value 0 makes Vamana use at most two lines.
+        prefetch_lines (int): Cache lines to prefetch per vector (PL), normally
+            128 bytes on Apple ARM64 and 64 bytes elsewhere. The shared default
+            value 0 makes Vamana use at most two lines. The nominal 6 KiB
+            prefix budget uses the build target's cache-line size.
 
     Examples:
         >>> params = VamanaQueryParam(ef_search=200)
@@ -944,7 +950,9 @@ class VamanaQueryParam(QueryParam):
                   a nominal 6 KiB budget for this phase only. ``0`` disables this
                   prefix, not local-descent, graph-row, or kernel prefetching.
                 - ``prefetch_lines`` (int): Cache lines to prefetch per vector (PL).
-                  The default ``0`` makes Vamana use at most two lines.
+                  Normally each line is 128 bytes on Apple ARM64 and 64 bytes
+                  elsewhere. The default ``0`` makes Vamana use at most two
+                  lines, counted at this size against the nominal 6 KiB budget.
         """
 
     def __repr__(self) -> str: ...
```

**File**: `src/ailego/math/distance_utility.h` (modified, +3/-2)
```diff
@@ -21,7 +21,8 @@ namespace ailego {
 
 /*! Four-bits Squared Difference Table
  */
-static const AILEGO_ALIGNED(64) uint8_t Int4SquaredDiffTable[256] = {
+static const AILEGO_ALIGNED(
+    AILEGO_CACHE_LINE_SIZE) uint8_t Int4SquaredDiffTable[256] = {
     0,  1,  4,   9,   16,  25,  36,  49,  64,  49,  36,  25,  16,  9,   4,  1,
     1,  0,  1,   4,   9,   16,  25,  36,  81,  64,  49,  36,  25,  16,  9,  4,
     4,  1,  0,   1,   4,   9,   16,  25,  100, 81,  64,  49,  36,  25,  16, 9,
@@ -42,7 +43,7 @@ static const AILEGO_ALIGNED(64) uint8_t Int4SquaredDiffTable[256] = {
 
 /*! Four-bits Integer Multiplication Table
  */
-static const AILEGO_ALIGNED(64) int8_t Int4MulTable[256] = {
+static const AILEGO_ALIGNED(AILEGO_CACHE_LINE_SIZE) int8_t Int4MulTable[256] = {
     0, 0,  0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
     0, 1,  2,   3,   4,   5,   6,   7,   -8,  -7,  -6,  -5,  -4,  -3,  -2,  -1,
     0, 2,  4,   6,   8,   10,  12,  14,  -16, -14, -12, -10, -8,  -6,  -4,  -2,
```

**File**: `src/ailego/utility/memory_helper.h` (modified, +3/-2)
```diff
@@ -68,7 +68,7 @@ struct MemoryHelper {
   //! `alignment`-aligned allocation is used, which avoids wasting a full huge
   //! page on small buffers. Returns nullptr on failure.
   //!
-  //! `alignment` must be a power of two.
+  //! `alignment` must be a power of two; it defaults to the target cache line.
   //!
   //! `zero_fill` follows the same contract as AllocateHugePage: true guarantees
   //! zeroed memory; false does not require zeroing but the implementation may
@@ -78,7 +78,8 @@ struct MemoryHelper {
   //! Blocks returned here MUST be released with FreeAligned, passing the same
   //! `size`, because the chosen allocator (and therefore the matching free) is
   //! derived from `size`.
-  static void *AllocateAligned(size_t size, size_t alignment = 64,
+  static void *AllocateAligned(size_t size,
+                               size_t alignment = AILEGO_CACHE_LINE_SIZE,
                                bool zero_fill = true);
 
   //! Release a block previously returned by AllocateAligned.
```

**File**: `src/binding/python/model/param/python_param.cc` (modified, +12/-7)
```diff
@@ -1498,9 +1498,11 @@ Constructs an HnswQueryParam instance.
         - ``prefetch_offset`` (int): Graph prefetch offset (PO).
           ``0`` disables prefetching. Default is ``8``.
           Values are clamped to ``256``.
-        - ``prefetch_lines`` (int): Number of 64B cache lines to prefetch
-          per neighbour vector (PL). ``0`` (default) uses the auto-derived
-          value ``ceil(vector_size/64)``. Values are clamped to ``256``.
+        - ``prefetch_lines`` (int): Number of cache lines to prefetch per
+          neighbour vector (PL). Cache-line size follows the build target:
+          normally 128 bytes on Apple ARM64 and 64 bytes elsewhere.
+          ``0`` (default) uses ``ceil(vector_size/cache_line_size)``.
+          Values are clamped to ``256``.
 )pbdoc")
       .def_property_readonly(
           "ef", [](const HnswQueryParams &self) -> int { return self.ef(); },
@@ -1903,10 +1905,13 @@ Constructs a VamanaQueryParam instance.
           for this phase only. ``0`` disables this prefix, not local-descent,
           graph-row, or distance-kernel prefetching.
           Values are clamped to ``256``.
-        - ``prefetch_lines`` (int): Number of 64B cache lines to prefetch
-          per neighbour vector (PL). The shared default ``0`` makes Vamana use
-          at most two lines, further clamped to the stored vector size. Values
-          are clamped to ``256`` and to the stored vector size.
+        - ``prefetch_lines`` (int): Number of cache lines to prefetch per
+          neighbour vector (PL). Cache-line size follows the build target:
+          normally 128 bytes on Apple ARM64 and 64 bytes elsewhere.
+          The shared default ``0`` makes Vamana use at most two lines, further
+          clamped to the stored vector size. The nominal 6 KiB prefix budget
+          uses this cache-line size. Values are clamped to ``256`` and to the
+          stored vector size.
 )pbdoc")
       .def_property_readonly(
           "ef_search",
```

**File**: `src/core/algorithm/flat/flat_streamer_entity.h` (modified, +3/-2)
```diff
@@ -487,7 +487,7 @@ class FlatStreamerEntity {
   mutable std::mutex segments_mutex_{};
   // Distance loops repeatedly read this metadata. Keep it off the cache line
   // written by segment-cache locking in concurrent queries.
-  alignas(64) IndexMeta index_meta_{};
+  alignas(AILEGO_CACHE_LINE_SIZE) IndexMeta index_meta_{};
   IndexStorage::Pointer storage_{};
   IndexMetric::MatrixDistance row_distance_{}, column_distance_{};
   IndexMetric::MatrixBatchDistance batch_distance_{};
@@ -577,7 +577,8 @@ class FlatContiguousStreamerEntity : public FlatStreamerEntity {
   const void *get_vector_ptr_by_key(const ContiguousStorage &storage,
                                     uint64_t key) const;
 
-  static constexpr size_t kVectorAlignment = 64;
+  // Padding is only for the rebuilt in-memory copy, not the index format.
+  static constexpr size_t kVectorAlignment = AILEGO_CACHE_LINE_SIZE;
   std::shared_ptr<const ContiguousStorage> contiguous_storage_{};
 };
 
```

**File**: `src/core/algorithm/hnsw/hnsw_algorithm.cc` (modified, +7/-14)
```diff
@@ -262,10 +262,7 @@ void fast_search_neighbors(const EntityType &entity, HeapType &pool,
       if (visit.visited(node)) continue;
       visit.set_visited(node);
       const void *vec_ptr = entity.get_vector_ptr(node);
-      const char *p = reinterpret_cast<const char *>(vec_ptr);
-      for (uint32_t cl = 0; cl < prefetch_lines; ++cl) {
-        ailego_prefetch(p + cl * 64);
-      }
+      ailego_prefetch_lines(vec_ptr, prefetch_lines);
       neighbor_ids[unvisited_count] = node;
       neighbor_vecs[unvisited_count] = vec_ptr;
       if (has_extra_values) {
@@ -363,10 +360,7 @@ void fast_search_neighbors_buffer(const EntityType &entity, HeapType &pool,
     }
     const uint32_t po = std::min(prefetch_offset, unvisited_count);
     for (uint32_t i = 0; i < po; ++i) {
-      const char *p = static_cast<const char *>(neighbor_vecs[i]);
-      for (uint32_t cl = 0; cl < prefetch_lines; ++cl) {
-        ailego_prefetch(p + cl * 64);
-      }
+      ailego_prefetch_lines(neighbor_vecs[i], prefetch_lines);
     }
 
     dc.batch_dist(neighbor_vecs.data(), unvisited_count, dists.data(),
@@ -389,8 +383,9 @@ void dual_heap_search_neighbors(const EntityType &entity, level_t level,
                                 TopkHeap &topk, HnswContext *ctx,
                                 HnswDistCalculator &dc, FilterFn &&filter) {
   const uint32_t prefetch_offset = ctx->po();
+  const size_t vector_lines = ailego_cache_line_count(entity.vector_size());
   const uint32_t prefetch_lines =
-      ctx->pl() > 0 ? ctx->pl() : (entity.vector_size() + 63) / 64;
+      ctx->pl() > 0 ? std::min<size_t>(ctx->pl(), vector_lines) : vector_lines;
 
   uint32_t buf_capacity = entity.max_degree(level);
   std::vector<node_id_t> neighbor_ids(buf_capacity);
@@ -496,10 +491,7 @@ void dual_heap_search_neighbors(const EntityType &entity, level_t level,
 
     // do prefetch
     for (uint32_t i = 0; i < std::min(prefetch_offset, size); ++i) {
-      const char *base = static_cast<const char *>(neighbor_vecs[i]);
-      for (uint32_t cl = 0; cl < prefetch_lines; ++cl) {
-        ailego_prefetch(base + cl * 64);
-      }
+      ailego_prefetch_lines(neighbor_vecs[i], prefetch_lines);
     }
 
     dc.batch_dist(neighbor_vecs.data(), size, dists.data(),
@@ -556,8 +548,9 @@ template <typename EntityType>
 int HnswAlgorithm<EntityType>::dispatch_search_neighbors(
     node_id_t entry_point, dist_t entry_dist, HnswContext *ctx) const {
   const auto &entity = static_cast<const EntityType &>(ctx->get_entity());
+  const size_t vector_lines = ailego_cache_line_count(entity.vector_size());
   const uint32_t prefetch_lines =
-      ctx->pl() > 0 ? ctx->pl() : (entity.vector_size() + 63) / 64;
+      ctx->pl() > 0 ? std::min<size_t>(ctx->pl(), vector_lines) : vector_lines;
   const bool dispatched =
       dispatch_visit_filter(ctx->visit_filter(), [&](auto visit) {
         visit.clear();
```

**File**: `src/core/algorithm/vamana/vamana_algorithm.cc` (modified, +12/-17)
```diff
@@ -162,13 +162,13 @@ int VamanaAlgorithm<EntityType>::search(VamanaContext *ctx) const {
 // Prefetch all cache lines covering a packed contiguous graph row.
 ailego_force_inline void prefetch_graph_row(
     const VamanaContiguousStreamerEntity &entity, node_id_t node) {
-  constexpr uintptr_t kCacheLineMask = ~uintptr_t{63};
+  constexpr uintptr_t kCacheLineMask = ~uintptr_t{AILEGO_CACHE_LINE_SIZE - 1};
   const char *data = entity.graph_prefetch_data(node);
   if (ailego_unlikely(data == nullptr)) return;
   const uintptr_t begin = reinterpret_cast<uintptr_t>(data) & kCacheLineMask;
   const uintptr_t end =
       reinterpret_cast<uintptr_t>(data) + entity.graph_prefetch_size();
-  const size_t lines = (end - begin + 63) / 64;
+  const size_t lines = ailego_cache_line_count(end - begin);
   ailego_prefetch_lines(reinterpret_cast<const void *>(begin), lines);
 }
 
@@ -392,11 +392,10 @@ void dual_heap_greedy_search(const EntityType &entity, VamanaContext *ctx,
                              VamanaDistCalculator &dc, node_id_t entry_point,
                              FilterFn &&filter) {
   const uint32_t prefetch_offset = ctx->po();
-  const uint32_t vector_body_lines =
-      static_cast<uint32_t>((entity.vector_data_size() + 63) / 64);
-  const uint32_t prefetch_lines = ctx->pl() > 0
-                                      ? std::min(ctx->pl(), vector_body_lines)
-                                      : vector_body_lines;
+  const size_t vector_lines =
+      ailego_cache_line_count(entity.vector_data_size());
+  const uint32_t prefetch_lines =
+      ctx->pl() > 0 ? std::min<size_t>(ctx->pl(), vector_lines) : vector_lines;
 
   uint32_t buf_capacity = entity.max_degree();
   std::vector<node_id_t> neighbor_ids(buf_capacity);
@@ -474,11 +473,8 @@ void dual_heap_greedy_search(const EntityType &entity, VamanaContext *ctx,
     if (ailego_unlikely(ret != 0)) break;
 
     for (uint32_t i = 0; i < std::min(prefetch_offset, unvisited_count); ++i) {
-      const char *base =
-          static_cast<const char *>(neighbor_vec_blocks[i].data());
-      for (uint32_t cl = 0; cl < prefetch_lines; ++cl) {
-        ailego_prefetch(base + cl * 64);
-      }
+      const void *vector = neighbor_vec_blocks[i].data();
+      ailego_prefetch_lines(vector, prefetch_lines);
     }
 
     // Batch distance computation (reuse pre-allocated buffers).
@@ -522,11 +518,10 @@ int VamanaAlgorithm<EntityType>::greedy_search(node_id_t entry_point,
   const IndexFilter &index_filter =
       static_cast<const IndexContext *>(ctx)->filter();
 
-  const uint32_t vector_body_lines =
-      static_cast<uint32_t>((entity.vector_data_size() + 63) / 64);
-  const uint32_t prefetch_lines = ctx->pl() > 0
-                                      ? std::min(ctx->pl(), vector_body_lines)
-                                      : vector_body_lines;
+  const size_t vector_lines =
+      ailego_cache_line_count(entity.vector_data_size());
+  const uint32_t prefetch_lines =
+      ctx->pl() > 0 ? std::min<size_t>(ctx->pl(), vector_lines) : vector_lines;
 
   if (!use_pool || index_filter.is_valid()) {
     // Fallback path used by add_node (use_pool=false) and filtered search.
```

**File**: `src/core/algorithm/vamana/vamana_context.cc` (modified, +2/-4)
```diff
@@ -24,7 +24,6 @@ namespace {
 // Vamana resolves the shared query defaults against the loaded graph layout.
 // Keep this policy local to Vamana rather than exposing algorithm-tuning
 // constants through the public interface.
-constexpr uint32_t kPrefetchCacheLineBytes = 64;
 constexpr uint32_t kPrefetchBudgetBytes = 6 * 1024;
 constexpr uint32_t kPrefetchTargetLines = 2;
 constexpr uint32_t kPrefetchMaxValue = 256;
@@ -171,8 +170,7 @@ std::pair<uint32_t, uint32_t> VamanaContext::resolve_query_prefetch(
   }
 
   const uint32_t body_lines =
-      static_cast<uint32_t>((vector_data_size + kPrefetchCacheLineBytes - 1) /
-                            kPrefetchCacheLineBytes);
+      static_cast<uint32_t>(ailego_cache_line_count(vector_data_size));
 
   uint32_t resolved_lines;
   if (requested_lines == kDefaultPrefetchLines) {
@@ -184,7 +182,7 @@ std::pair<uint32_t, uint32_t> VamanaContext::resolve_query_prefetch(
   uint32_t resolved_offset;
   if (requested_offset == kDefaultPrefetchOffset) {
     const uint64_t bytes_per_neighbor =
-        static_cast<uint64_t>(kPrefetchCacheLineBytes) * resolved_lines;
+        static_cast<uint64_t>(AILEGO_CACHE_LINE_SIZE) * resolved_lines;
     const uint32_t budget_offset = static_cast<uint32_t>(
         std::max<uint64_t>(1, kPrefetchBudgetBytes / bytes_per_neighbor));
     resolved_offset = std::min({budget_offset, max_degree, kPrefetchMaxValue});
```

#### Recent Merged Pull Requests:
- **PR #835** (2026-10-21): docs: clarify README platforms and Python example (@zhourrr)
- **PR #834** (2026-10-21): fix(core): preserve index bytes on read-only close (@iaojnh)
- **PR #832** (2026-10-21): Enable RaBitQ on Linux/macOS/Android/iOS ARM64 and macOS x86_64 (@egolearner)
- **PR #831** (2026-10-21): fix(platform): centralize cache-line sizing (@luoxiaojian)
- **PR #829** (2026-10-21): docs: update README highlights for v0.8.0 (@JalinWang)
- **PR #825** (2026-10-20): perf(flat): isolate query metadata from segment cache locking (@egolearner)

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

## X. core): preserve index bytes on read-only close (#834)

**RULE**:
When implementing operations in `src/core/algorithm/flat/flat_streamer.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8b531d17`: core): preserve index bytes on read-only close (#834). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/core/algorithm/flat/flat_streamer.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  int ret = entity_->flush_linear_meta();
  if (ret != 0) {
    return ret;
  }
  ret = entity_->close();
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
  entity_->flush_linear_meta();
  int ret = entity_->close();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8b531d17` are properly handled with clean fallback behavior.
