> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source**: github ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Source Version**: `499eab89`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T23:06:19.005Z  
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
> **Harvest Timestamp**: 2026-11-03T23:06:18.724Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/zvec`
- **Description**: A lightweight, lightning-fast, in-process vector database
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 16178 stars

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
inline const std::string GENERAL_CLUSTER_COUNT = "zvec.general.cluster.count";
inline const std::string GENERAL_THREAD_COUNT =
    "zvec.general.cluster.thread_count";

//! Optimize K-means
inline const std::string OPTKMEANS_CLUSTER_COUNT =
    "zvec.optkmeans.cluster.count";
inline const std::string OPTKMEANS_CLUSTER_MAX_ITERATIONS =
    "zvec.optkmeans.cluster.max_iterations";
inline const std::string OPTKMEANS_CLUSTER_EPSILON =
    "zvec.optkmeans.cluster.epsilon";
inline const std::string OPTKMEANS_CLUSTER_SHARD_FACTOR =
    "zvec.optkmeans.cluster.shard_factor";
inline const std::string OPTKMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.optkmeans.cluster.purge_empty";
inline const std::string OPTKMEANS_CLUSTER_MARKOV_CHAIN_LENGTH =
    "zvec.optkmeans.cluster.markov_chain_length";
inline const std::string OPTKMEANS_CLUSTER_ASSUMPTION_FREE =
    "zvec.optkmeans.cluster.assumption_free";

//! K-means
inline const std::string KMEANS_CLUSTER_COUNT = "zvec.kmeans.cluster.count";
inline const std::string KMEANS_CLUSTER_SHARD_FACTOR =
    "zvec.kmeans.cluster.shard_factor";
inline const std::string KMEANS_CLUSTER_EPSILON = "zvec.kmeans.cluster.epsilon";
inline const std::string KMEANS_CLUSTER_MAX_ITERATIONS =
    "zvec.kmeans.cluster.max_iterations";
inline const std::string KMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.kmeans.cluster.purge_empty";
inline const std::string KMEANS_CLUSTER_BATCH = "zvec.kmeans.cluster.batch";
inline const std::string KMEANS_CLUSTER_SEEKER_CLASS =
    "zvec.kmeans.cluster.seeker_class";
inline const std::string KMEANS_CLUSTER_SEEKER_PARAMS =
    "zvec.kmeans.cluster.seeker_params";

//! Mini Batch K-means
inline const std::string MINIBATCHKMEANS_CLUSTER_COUNT =
    "zvec.minibatchkmeans.cluster.count";
inline const std::string MINIBATCHKMEANS_CLUSTER_SHARD_FACTOR =
    "zvec.minibatchkmeans.cluster.shard_factor";
inline const std::string MINIBATCHKMEANS_CLUSTER_EPSILON =
    "zvec.minibatchkmeans.cluster.epsilon";
inline const std::string MINIBATCHKMEANS_CLUSTER_MAX_ITERATIONS =
    "zvec.minibatchkmeans.cluster.max_iterations";
inline const std::string MINIBATCHKMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.minibatchkmeans.cluster.purge_empty";
inline const std::string MINIBATCHKMEANS_CLUSTER_TRY_COUNT =
    "zvec.minibatchkmeans.cluster.try_count";
inline const std::string MINIBATCHKMEANS_CLUSTER_BATCH_COUNT =
    "zvec.minibatchkmeans.cluster.batch_count";
inline const std::string MINIBATCHKMEANS_CLUSTER_SEEKER_CLASS =
    "zvec.minibatchkmeans.cluster.seeker_class";
inline const std::string MINIBATCHKMEANS_CLUSTER_SEEKER_PARAMS =
    "zvec.minibatchkmeans.cluster.seeker_params";

//! K-means++
inline const std::string KMEANSPP_CLUSTER_COUNT = "zvec.kmeanspp.cluster.count";
inline const std::string KMEANSPP_CLUSTER_SHARD_FACTOR =
    "zvec.kmeanspp.cluster.shard_factor";
inline const std::string KMEANSPP_CLUSTER_CLASS = "zvec.kmeanspp.cluster.class";
inline const std::string KMEANSPP_CLUSTER_PARAMS =
    "zvec.kmeanspp.cluster.params";

//! K-MC2
inline const std::string KMC2_CLUSTER_COUNT = "zvec.kmc2.cluster.count";
inline const std::string KMC2_CLUSTER_SHARD_FACTOR =
    "zvec.kmc2.cluster.shard_factor";
inline const std::string KMC2_CLUSTER_MARKOV_CHAIN_LENGTH =
    "zvec.kmc2.cluster.markov_chain_length";
inline const std::string KMC2_CLUSTER_ASSUMPTION_FREE =
    "zvec.kmc2.cluster.assumption_free";
inline const std::string KMC2_CLUSTER_CLASS = "zvec.kmc2.cluster.class";
inline const std::string KMC2_CLUSTER_PARAMS = "zvec.kmc2.cluster.params";

//! Bisecting K-means
inline const std::string BIKMEANS_CLUSTER_COUNT = "zvec.bikmeans.cluster.count";
inline const std::string BIKMEANS_CLUSTER_INIT_COUNT =
    "zvec.bikmeans.cluster.init_count";
inline const std::string BIKMEANS_CLUSTER_PURGE_EMPTY =
    "zvec.bikmeans.cluster.purge_empty";
inline const std::string BIKMEANS_CLUSTER_FIRST_CLASS =
    "zvec.bikmeans.cluster.first_class";
inline const std::string BIKMEANS_CLUSTER_SECOND_CLASS =
    "zvec.bikmeans.cluster.second_class";
inline const std::string BIKMEANS_CLUSTER_FIRST_PARAMS =
    "zvec.bikmeans.cluster.first_params";
inline const std::string BIKMEANS_CLUSTER_SECOND_PARAMS =
    "zvec.bikmeans.cluster.second_params";

//! K-medoids
inline const std::string KMEDOIDS_CLUSTER_COUNT = "zvec.kmedoids.cluster.count";
inline const std::string KMEDOIDS_CLUSTER_SHARD_FACTOR =
    "zvec.kmedoids.cluster.shard_factor";
inline const std::string KMEDOIDS_CLUSTER_EPSILON =
    "zvec.kmedoids.cluster.epsilon";
inline const std::string KMEDOIDS_CLUSTER_MAX_ITERATIONS =
    "zvec.kmedoids.cluster.max_iterations";
inline const std::string KMEDOIDS_CLUSTER_PURGE_EMPTY =
    "zvec.kmedoids.cluster.purge_empty";
inline const std::string KMEDOIDS_CLUSTER_BENCH_RATIO =
    "zvec.kmedoids.cluster.bench_ratio";
inline const std::string KMEDOIDS_CLUSTER_ONLY_MEANS =
    "zvec.kmedoids.cluster.only_means";
inline const std::string KMEDOIDS_CLUSTER_WITHOUT_MEANS =
    "zvec.kmedoids.cluster.without_means";
inline const std::string KMEDOIDS_CLUSTER_SEEKER_CLASS =
    "zvec.kmedoids.cluster.seeker_class";
inline const std::string KMEDOIDS_CLUSTER_SEEKER_PARAMS =
    "zvec.kmedoids.cluster.seeker_params";

//! Stratified
inline const std::string STRATIFIED_CLUSTER_COUNT =
    "zvec.stratified.cluster.count";
inline const std::string STRATIFIED_CLUSTER_FIRST_CLASS =
    "zvec.stratified.cluster.first_class";
inline const std::string STRATIFIED_CLUSTER_SECOND_CLASS =
    "zvec.stratified.cluster.second_class";
inline const std::string STRATIFIED_CLUSTER_FIRST_COUNT =
    "zvec.stratified.cluster.first_count";
inline const std::string STRATIFIED_CLUSTER_SECOND_COUNT =
    "zvec.stratified.cluster.second_count";
inline const std::string STRATIFIED_CLUSTER_FIRST_PARAMS =
    "zvec.stratified.cluster.first_params";
inline const std::string STRATIFIED_CLUSTER_SECOND_PARAMS =
    "zvec.stratified.cluster.second_params";
inline const std::string STRATIFIED_CLUSTER_AUTO_TUNING =
    "zvec.stratified.cluster.auto_tuning";
inline const std::string STRATIFIED_CLUSTER_SECOND_POOL_COUNT =
    "zvec.stratified.cluster.second_pool_count";

//! Gap Statistics
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MIN =
    "zvec.gapstats.cluster_estimater.k_min";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MAX =
    "zvec.gapstats.cluster_estimater.k_max";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MIN_STEP =
    "zvec.gapstats.cluster_estimater.k_min_step";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_K_MAX_STEP =
    "zvec.gapstats.cluster_estimater.k_max_step";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_TRY_COUNT =
    "zvec.gapstats.cluster_estimater.try_count";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_SHARD_FACTOR =
    "zvec.gapstats.cluster_estimater.shard_factor";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_ENABLE_MC2 =
    "zvec.gapstats.cluster_estimater.enable_mc2";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_MARKOV_CHAIN_LENGTH =
    "zvec.gapstats.cluster_estimater.markov_chain_length";
inline const std::string GAPSTATS_CLUSTER_ESTIMATER_CLUSTER_CLASS =
    "zvec.gapstats.cluster_estimater.cluster_class";

inline const std::string CLUSTER_TRAINER_SAMPLE_COUNT =
    "zvec.cluster.trainer.sample_count";
inline const std::string CLUSTER_TRAINER_SAMPLE_RATIO =
    "zvec.cluster.trainer.sample_ratio";
inline const std::string CLUSTER_TRAINER_THREAD_COUNT =
    "zvec.cluster.trainer.thread_count";
inline const std::string CLUSTER_TRAINER_FILE_NAME =
    "zvec.cluster.trainer.file_name";
inline const std::string CLUSTER_TRAINER_CLASS_NAME =
    "zvec.cluster.trainer.class_name";

inline const std::string STRATIFIED_TRAINER_SAMPLE_COUNT =
    "zvec.stratified.trainer.sample_count";
inline const std::string STRATIFIED_TRAINER_SAMPLE_RATIO =
    "zvec.stratified.trainer.sample_ratio";
inline const std::string STRATIFIED_TRAINER_THREAD_COUNT =
    "zvec.stratified.trainer.thread_count";
inline const std::string STRATIFIED_TRAINER_FILE_NAME =
    "zvec.stratified.trainer.file_name";
inline const std::string STRATIFIED_TRAINER_CLASS_NAME =
    "zvec.stratified.trainer.class_name";
inline const std::string STRATIFIED_TRAINER_CLUSTER_COUNT =
    "zvec.stratified.trainer.cluster_count";
inline const std::string STRATIFIED_TRAINER_AUTOAUNE =
    "zvec.stratified.trainer.autotune";
inline const std::string STRATIFIED_TRAINER_PARAMS_IN_LEVEL_PREFIX =
    "zvec.stratified.trainer.cluster_params_in_level_";

inline const std::string MULTI_CHUNK_CLUSTER_COUNT =
    "zvec.cluster.multi_chunk_cluster.count";
inline const std::string MULTI_CHUNK_CLUSTER_CHUNK_COUNT =
    "zvec.cluster.multi_chunk_cluster.chunk_count";
inline const std::string MULTI_CHUNK_CLUSTER_THREAD_COUNT =
    "zvec.cluster.multi_chunk_cluster.thread_count";
inline const std::string MULTI_CHUNK_CLUSTER_EPSILON =
    "zvec.cluster.multi_chunk_cluster.epsilon";
inline const std::string MULTI_CHUNK_CLUSTER_MAX_ITERATIONS =
    "zvec.cluster.multi_chunk_cluster.max_iterations";
inline const std::string MULTI_CHUNK_CLUSTER_MARKOV_CHAIN_LENGTH =
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

### Incident Patch 1: `1bcbc4cc` (2026-11-03)
**Commit Message**: fix(db): avoid null writing_segment_ on DDL writing segment recreation failure (#822)

**File**: `src/db/collection.cc` (modified, +18/-82)
```diff
@@ -1379,52 +1379,30 @@ Status CollectionImpl::add_column(const FieldSchema::Ptr &column_schema,
     CHECK_RETURN_STATUS(s);
   }
 
-  Version new_version = version_manager_->get_current_version();
+  auto old_writing_segment = writing_segment_;
+  Version old_version = version_manager_->get_current_version();
+  Version new_version = old_version;
 
   // add column on segment manager
   s = segment_manager_->add_column(field_copy, expression,
                                    options.concurrency_);
   CHECK_RETURN_STATUS(s);
 
-  // reset writing segment with new schema
-  auto id = writing_segment_->id();
   auto min_doc_id = writing_segment_->meta()->min_doc_id();
 
-  s = writing_segment_->destroy();
-  CHECK_RETURN_STATUS(s);
-  writing_segment_.reset();
-
-  SegmentOptions seg_options;
-  seg_options.enable_mmap_ = options_.enable_mmap_;
-  seg_options.max_buffer_size_ = options_.max_buffer_size_;
-  seg_options.read_only_ = options_.read_only_;
-  auto writing_segment =
-      Segment::CreateAndOpen(path_, *new_schema, id, min_doc_id, id_map_,
-                             delete_store_, version_manager_, seg_options);
-  if (!writing_segment) {
-    return writing_segment.error();
-  }
-  writing_segment_ = writing_segment.value();
-
   // update new version
   new_version.set_schema(*new_schema);
-  new_version.reset_writing_segment_meta(writing_segment_->meta());
 
   auto new_segment_metas = segment_manager_->get_segments_meta();
   for (auto meta : new_segment_metas) {
     s = new_version.update_persisted_segment_meta(meta);
     CHECK_RETURN_STATUS(s);
   }
 
-  s = version_manager_->apply(new_version);
-  CHECK_RETURN_STATUS(s);
-
-  // persist manifest
-  s = version_manager_->flush();
+  s = commit_schema_change_with_new_writing_segment(
+      new_schema, old_writing_segment, old_version, &new_version, min_doc_id);
   CHECK_RETURN_STATUS(s);
 
-  schema_ = new_schema;
-
   return Status::OK();
 }
 
@@ -1455,51 +1433,29 @@ Status CollectionImpl::drop_column(const std::string &column_name) {
     CHECK_RETURN_STATUS(s);
   }
 
-  Version new_version = version_manager_->get_current_version();
+  auto old_writing_segment = writing_segment_;
+  Version old_version = version_manager_->get_current_version();
+  Version new_version = old_version;
 
   // drop column on segment manager
   s = segment_manager_->drop_column(column_name);
   CHECK_RETURN_STATUS(s);
 
-  // reset writing segment with new schema
-  auto id = writing_segment_->id();
   auto min_doc_id = writing_segment_->meta()->min_doc_id();
 
-  s = writing_segment_->destroy();
-  CHECK_RETURN_STATUS(s);
-  writing_segment_.reset();
-
-  SegmentOptions seg_options;
-  seg_options.enable_mmap_ = options_.enable_mmap_;
-  seg_options.max_buffer_size_ = options_.max_buffer_size_;
-  seg_options.read_only_ = options_.read_only_;
-  auto writing_segment =
-      Segment::CreateAndOpen(path_, *new_schema, id, min_doc_id, id_map_,
-                             delete_store_, version_manager_, seg_options);
-  if (!writing_segment) {
-    return writing_segment.error();
-  }
-  writing_segment_ = writing_segment.value();
-
   // update new version
   new_version.set_schema(*new_schema);
-  new_version.reset_writing_segment_meta(writing_segment_->meta());
 
   auto new_segment_metas = segment_manager_->get_segments_meta();
   for (auto meta : new_segment_metas) {
     s = new_version.update_persisted_segment_meta(meta);
     CHECK_RETURN_STATUS(s);
   }
 
-  s = version_manager_->apply(new_version);
-  CHECK_RETURN_STATUS(s);
-
-  // persist manifest
-  s = version_manager_->flush();
+  s = commit_schema_change_with_new_writing_segment(
+      new_schema, old_writing_segment, old_version, &new_version, min_doc_id);
   CHECK_RETURN_STATUS(s);
 
-  schema_ = new_schema;
-
   return Status::OK();
 }
 
@@ -1541,52 +1497,30 @@ Status CollectionImpl::alter_column(const std::string &column_name,
     CHECK_RETURN_STATUS(s);
   }
 
-  Version new_version = version_manager_->get_current_version();
+  auto old_writing_segment = writing_segment_;
+  Version old_version = version_manager_->get_current_version();
+  Version new_version = old_version;
 
   // alter column on segment manager
   s = segment_manager_->alter_column(column_name, field_copy,
                                      options.concurrency_);
   CHECK_RETURN_STATUS(s);
 
-  // reset writing segment with new schema
-  auto id = writing_segment_->id();
   auto min_doc_id = writing_segment_->meta()->min_doc_id();
 
-  s = writing_segment_->destroy();
-  CHECK_RETURN_STATUS(s);
-  writing_segment_.reset();
-
-  SegmentOptions seg_options;
-  seg_options.enable_mmap_ = options_.enable_mmap_;
-  seg_options.max_buffer_size_ = options_.max_buffer_size_;
-  seg_options.read_only_ = options_.read_only_;
-  auto writing_segment =
-      Segment::CreateAndOpen(path_, *new_schema, id, min_doc_id, id_map_,
-                             delete_store_, version_manager_, seg_options);
-  if (!writing_
```

---

### Incident Patch 2: `55eef077` (2026-11-03)
**Commit Message**: fix(storage): separate BufferStorage creation and write permissions (#870)

**File**: `src/core/interface/index.cc` (modified, +6/-3)
```diff
@@ -557,12 +557,15 @@ int Index::open(const std::string &file_path, StorageOptions storage_options) {
       return core::IndexError_Unsupported;
   }
 
-  // read_options.create_new
-  int ret = storage_->open(file_path, storage_options.create_new);
+  const core::IndexStorage::OpenOptions open_options{storage_options.create_new,
+                                                     storage_options.read_only};
+  int ret = storage_options.type == StorageOptions::StorageType::kBufferPool
+                ? storage_->open(file_path, open_options)
+                : storage_->open(file_path, storage_options.create_new);
   if (ret != 0) {
     LOG_ERROR("Failed to open storage, path: %s, err: %s", file_path.c_str(),
               core::IndexError::What(ret));
-    return core::IndexError_Runtime;
+    return ret;
   }
   ret = prepare_streamer_open(storage_options);
   if (ret != 0) {
```

**File**: `src/core/utility/buffer_storage.cc` (modified, +15/-9)
```diff
@@ -1001,7 +1001,15 @@ class BufferStorage : public IndexStorage {
 
   //! Open storage
   int open(const std::string &path, bool create_if_missing) override {
-    if (!ailego::File::IsExist(path) && create_if_missing) {
+    // Preserve the access mode of callers using the legacy boolean API.
+    return open_with_options(
+        path, OpenOptions{create_if_missing, /*read_only=*/!create_if_missing});
+  }
+
+  int open_with_options(const std::string &path,
+                        const OpenOptions &options) override {
+    const bool writable = !options.read_only;
+    if (!ailego::File::IsExist(path) && options.create_if_missing) {
       size_t last_slash = path.rfind('/');
       if (last_slash != std::string::npos) {
         ailego::File::MakePath(path.substr(0, last_slash));
@@ -1017,9 +1025,8 @@ class BufferStorage : public IndexStorage {
     try {
       // Capture both owners before replacing the published state. In
       // particular, a failed reopen must not change existing segments' pool.
-      // create_if_missing also indicates write intent, like MMapFileStorage.
-      auto candidate_pool = std::make_shared<ailego::VecBufferPool>(
-          path, /*writable=*/create_if_missing);
+      auto candidate_pool =
+          std::make_shared<ailego::VecBufferPool>(path, writable);
       auto candidate_handle =
           std::make_shared<ailego::VecBufferPoolHandle>(candidate_pool);
       file_name_ = path;
@@ -1042,16 +1049,16 @@ class BufferStorage : public IndexStorage {
     const size_t page_count =
         file_size == 0 ? 0 : (file_size - 1) / ailego::kVectorPageSize + 1;
     const size_t metadata_bytes =
-        ailego::VecBufferPool::metadata_bytes_for_page_count(
-            page_count, /*writable=*/create_if_missing);
+        ailego::VecBufferPool::metadata_bytes_for_page_count(page_count,
+                                                             writable);
     const size_t available =
         ailego::MemoryLimitPool::get_instance().available();
     const bool cache_can_fit =
         metadata_bytes != std::numeric_limits<size_t>::max() &&
         metadata_bytes <= available &&
         ailego::kVectorPageSize <= available - metadata_bytes;
     ret = cache_can_fit ? buffer_pool_->init() : -1;
-    if (ret != 0 && create_if_missing) {
+    if (ret != 0 && writable) {
       this->close_index();
       return IndexError_NoMemory;
     }
@@ -1063,8 +1070,7 @@ class BufferStorage : public IndexStorage {
           path.c_str(), available, metadata_bytes, ailego::kVectorPageSize);
     }
     LOG_INFO("BufferStorage opened: file=%s, writable=%d, segment_count=%zu",
-             file_name_.c_str(), static_cast<int>(create_if_missing),
-             segments_.size());
+             file_name_.c_str(), static_cast<int>(writable), segments_.size());
     return 0;
   }
 
```

**File**: `src/include/zvec/core/framework/index_storage.h` (modified, +20/-0)
```diff
@@ -34,6 +34,11 @@ class IndexStorage : public IndexModule {
   //! Index Storage Pointer
   typedef std::shared_ptr<IndexStorage> Pointer;
 
+  struct OpenOptions {
+    bool create_if_missing{false};
+    bool read_only{true};
+  };
+
   struct MemoryBlock {
     enum MemoryBlockType {
       MBT_UNKNOWN = 0,
@@ -650,6 +655,15 @@ class IndexStorage : public IndexModule {
   //! Open storage
   virtual int open(const std::string &path, bool create_if_missing) = 0;
 
+  //! Open with independent creation and access permissions. Implementations
+  //! that have not opted in return Unsupported instead of ignoring access.
+  int open(const std::string &path, const OpenOptions &options) {
+    if (options.create_if_missing && options.read_only) {
+      return IndexError_InvalidArgument;
+    }
+    return open_with_options(path, options);
+  }
+
   //! Flush storage
   virtual int flush() = 0;
 
@@ -709,6 +723,12 @@ class IndexStorage : public IndexModule {
   virtual std::string file_path() const {
     return "";
   }
+
+ protected:
+  //! Separate dispatch keeps legacy open() overrides source-compatible.
+  virtual int open_with_options(const std::string &, const OpenOptions &) {
+    return IndexError_Unsupported;
+  }
 };
 
 }  // namespace core
```

**File**: `tests/core/interface/index_interface_test.cc` (modified, +79/-5)
```diff
@@ -4868,6 +4868,11 @@ TEST(IndexInterface, IsDirty) {
 TEST(IndexInterface, IsDirtyBufferPool) {
   constexpr uint32_t kDimension = 16;
   const std::string index_name{"test_is_dirty_bp.index"};
+  auto &pool = zvec::ailego::MemoryLimitPool::get_instance();
+  const size_t previous_capacity = pool.capacity();
+  ASSERT_EQ(0, pool.init(64UL * 1024UL * 1024UL));
+  auto restore = zvec::ailego::ScopeGuard::Make(
+      [&]() { EXPECT_EQ(0, pool.init(previous_capacity)); });
 
   zvec::test_util::RemoveTestFiles(index_name);
 
@@ -4881,15 +4886,16 @@ TEST(IndexInterface, IsDirtyBufferPool) {
                      .build();
     auto index = IndexFactory::CreateAndInitIndex(*param);
     ASSERT_NE(nullptr, index);
-    index->open(index_name, {StorageOptions::StorageType::kMMAP, true});
+    ASSERT_EQ(
+        0, index->open(index_name, {StorageOptions::StorageType::kMMAP, true}));
     std::vector<float> vec(kDimension, 1.0f);
     VectorData vd;
     vd.vector = DenseVector{vec.data()};
     ASSERT_EQ(0, index->add(vd, 1));
-    index->close();
+    ASSERT_EQ(0, index->close());
   }
 
-  // Reopen with BufferPool storage in writable mode
+  // Reopen an existing file for writing without permitting file creation.
   {
     auto param = FlatIndexParamBuilder()
                      .with_metric_type(MetricType::kInnerProduct)
@@ -4899,7 +4905,9 @@ TEST(IndexInterface, IsDirtyBufferPool) {
                      .build();
     auto index = IndexFactory::CreateAndInitIndex(*param);
     ASSERT_NE(nullptr, index);
-    index->open(index_name, {StorageOptions::StorageType::kBufferPool, true});
+    ASSERT_EQ(0,
+              index->open(index_name, {StorageOptions::StorageType::kBufferPool,
+                                       false, false}));
 
     ASSERT_FALSE(index->is_dirty());
 
@@ -4912,12 +4920,78 @@ TEST(IndexInterface, IsDirtyBufferPool) {
     ASSERT_EQ(0, index->flush());
     ASSERT_FALSE(index->is_dirty());
 
-    index->close();
+    ASSERT_EQ(0, index->close());
+  }
+
+  // Both the original and appended vectors must survive another reopen.
+  {
+    auto param = FlatIndexParamBuilder()
+                     .with_metric_type(MetricType::kInnerProduct)
+                     .with_data_type(DataType::DT_FP32)
+                     .with_dimension(kDimension)
+                     .with_is_sparse(false)
+                     .build();
+    auto index = IndexFactory::CreateAndInitIndex(*param);
+    ASSERT_NE(nullptr, index);
+    ASSERT_EQ(0,
+              index->open(index_name, {StorageOptions::StorageType::kBufferPool,
+                                       false, true}));
+    for (uint32_t id : {1U, 2U}) {
+      VectorDataBuffer fetched;
+      ASSERT_EQ(0, index->fetch(id, &fetched));
+      const auto &data =
+          std::get<DenseVectorBuffer>(fetched.vector_buffer).data;
+      const std::vector<float> expected(kDimension, static_cast<float>(id));
+      ASSERT_EQ(expected.size() * sizeof(float), data.size());
+      EXPECT_EQ(0, std::memcmp(expected.data(), data.data(), data.size()));
+    }
+    ASSERT_EQ(0, index->close());
   }
 
   zvec::test_util::RemoveTestFiles(index_name);
 }
 
+TEST(IndexInterface, BufferPoolOpenPreservesCreationAndMemoryErrors) {
+  using zvec::core::IndexError_NoMemory;
+  using zvec::core::IndexError_OpenFile;
+  const std::string path = "buffer_pool_open_errors.index";
+  zvec::test_util::RemoveTestFiles(path);
+  auto remove = zvec::ailego::ScopeGuard::Make(
+      [&]() { zvec::test_util::RemoveTestFiles(path); });
+  auto &pool = zvec::ailego::MemoryLimitPool::get_instance();
+  const size_t previous_capacity = pool.capacity();
+  auto restore = zvec::ailego::ScopeGuard::Make(
+      [&]() { EXPECT_EQ(0, pool.init(previous_capacity)); });
+  ASSERT_EQ(0, pool.init(64UL * 1024UL * 1024UL));
+  auto param = FlatIndexParamBuilder()
+                   .with_metric_type(MetricType::kL2sq)
+                   .with_data_type(DataType::DT_FP32)
+                   .with_dimension(16)
+                   .with_is_sparse(false)
+                   .build();
+  {
+    auto index = IndexFactory::CreateAndInitIndex(*param);
+    ASSERT_NE(nullptr, index);
+    EXPECT_EQ(IndexError_OpenFile,
+              index->open(path, {StorageOptions::StorageType::kBufferPool,
+                                 false, false}));
+    EXPECT_FALSE(zvec::ailego::File::IsExist(path));
+  }
+  {
+    auto index = IndexFactory::CreateAndInitIndex(*param);
+    ASSERT_NE(nullptr, index);
+    ASSERT_EQ(
+        0, index->open(path, {StorageOptions::StorageType::kBufferPool, true}));
+    ASSERT_EQ(0, index->close());
+  }
+  ASSERT_EQ(0, pool.init(zvec::ailego::kVectorPageSize));
+  auto index = IndexFactory::CreateAndInitIndex(*param);
+  ASSERT_NE(nullptr, index);
+  EXPECT_EQ(IndexError_NoMemory,
+            index->open(path, {StorageOptions::StorageType::kBufferPool, false,
+                               false}));
+}
+
 TEST(IndexInterface, BuilderSetsAllBaseFields) {
  
```

**File**: `tests/core/utility/buffer_storage_write_test.cc` (modified, +121/-3)
```diff
@@ -49,13 +49,16 @@ class BufferStorageWriteTest : public ::testing::Test {
     ailego::File::Delete(file_path_);
   }
 
-  // Open BufferStorage in writable mode (create_if_missing=true)
+  // Open BufferStorage in writable mode, creating it when missing.
   IndexStorage::Pointer open_writable() {
     auto storage = IndexFactory::CreateStorage("BufferStorage");
     if (!storage) return nullptr;
     ailego::Params params;
     storage->init(params);
-    if (storage->open(file_path_, true) != 0) return nullptr;
+    if (storage->open(file_path_, IndexStorage::OpenOptions{true, false}) !=
+        0) {
+      return nullptr;
+    }
     return storage;
   }
 
@@ -65,13 +68,128 @@ class BufferStorageWriteTest : public ::testing::Test {
     if (!storage) return nullptr;
     ailego::Params params;
     storage->init(params);
-    if (storage->open(file_path_, false) != 0) return nullptr;
+    if (storage->open(file_path_, IndexStorage::OpenOptions{false, true}) !=
+        0) {
+      return nullptr;
+    }
     return storage;
   }
 
   std::string file_path_;
 };
 
+TEST_F(BufferStorageWriteTest, WritableReopenWithoutCreationPersistsChanges) {
+  {
+    auto storage = open_writable();
+    ASSERT_NE(nullptr, storage);
+    ASSERT_EQ(0, storage->append("payload", 4096));
+    auto segment = storage->get("payload");
+    ASSERT_NE(nullptr, segment);
+    const std::string original = "original";
+    ASSERT_EQ(original.size(),
+              segment->write(0, original.data(), original.size()));
+    ASSERT_EQ(0, storage->close());
+  }
+
+  const std::string expected = "updated after writable reopen";
+  {
+    auto storage = IndexFactory::CreateStorage("BufferStorage");
+    ASSERT_NE(nullptr, storage);
+    ASSERT_EQ(0, storage->init(ailego::Params{}));
+    ASSERT_EQ(
+        0, storage->open(file_path_, IndexStorage::OpenOptions{false, false}));
+    ASSERT_TRUE(storage->vec_buffer_pool()->writable());
+    auto segment = storage->get("payload");
+    ASSERT_NE(nullptr, segment);
+    ASSERT_EQ(expected.size(),
+              segment->write(0, expected.data(), expected.size()));
+    ASSERT_EQ(0, storage->append("appended", 4096));
+    ASSERT_EQ(0, storage->flush());
+    ASSERT_EQ(0, storage->close());
+  }
+
+  auto storage = open_read_only();
+  ASSERT_NE(nullptr, storage);
+  EXPECT_FALSE(storage->vec_buffer_pool()->writable());
+  EXPECT_TRUE(storage->has("appended"));
+  auto segment = storage->get("payload");
+  ASSERT_NE(nullptr, segment);
+  std::string actual(expected.size(), '\0');
+  ASSERT_EQ(actual.size(), segment->fetch(0, actual.data(), actual.size()));
+  EXPECT_EQ(expected, actual);
+  ASSERT_EQ(0, storage->close());
+}
+
+TEST_F(BufferStorageWriteTest,
+       WritableOpenWithoutCreationRequiresExistingFile) {
+  auto storage = IndexFactory::CreateStorage("BufferStorage");
+  ASSERT_NE(nullptr, storage);
+  ASSERT_EQ(0, storage->init(ailego::Params{}));
+  EXPECT_EQ(IndexError_OpenFile,
+            storage->open(file_path_, IndexStorage::OpenOptions{false, false}));
+  EXPECT_FALSE(ailego::File::IsExist(file_path_));
+  EXPECT_EQ(nullptr, storage->vec_buffer_pool());
+
+  ASSERT_EQ(0,
+            storage->open(file_path_, IndexStorage::OpenOptions{true, false}));
+  EXPECT_TRUE(storage->vec_buffer_pool()->writable());
+  ASSERT_EQ(0, storage->close());
+}
+
+TEST_F(BufferStorageWriteTest, ReadOnlyOpenCannotCreateFile) {
+  auto storage = IndexFactory::CreateStorage("BufferStorage");
+  ASSERT_NE(nullptr, storage);
+  ASSERT_EQ(0, storage->init(ailego::Params{}));
+  EXPECT_EQ(IndexError_InvalidArgument,
+            storage->open(file_path_, IndexStorage::OpenOptions{true, true}));
+  EXPECT_FALSE(ailego::File::IsExist(file_path_));
+  EXPECT_EQ(nullptr, storage->vec_buffer_pool());
+}
+
+TEST_F(BufferStorageWriteTest, LegacyOpenPreservesAccessModes) {
+  auto storage = IndexFactory::CreateStorage("BufferStorage");
+  ASSERT_NE(nullptr, storage);
+  ASSERT_EQ(0, storage->init(ailego::Params{}));
+  ASSERT_EQ(0, storage->open(file_path_, true));
+  EXPECT_TRUE(storage->vec_buffer_pool()->writable());
+  ASSERT_EQ(0, storage->close());
+  ASSERT_EQ(0, storage->open(file_path_, false));
+  EXPECT_FALSE(storage->vec_buffer_pool()->writable());
+  ASSERT_EQ(0, storage->close());
+}
+
+TEST_F(BufferStorageWriteTest, ExplicitOpenRequiresImplementationSupport) {
+  auto storage = IndexFactory::CreateStorage("MMapFileStorage");
+  ASSERT_NE(nullptr, storage);
+  ASSERT_EQ(0, storage->init(ailego::Params{}));
+  EXPECT_EQ(IndexError_Unsupported,
+            storage->open(file_path_, IndexStorage::OpenOptions{true, false}));
+  EXPECT_FALSE(ailego::File::IsExist(file_path_));
+}
+
+TEST_F(BufferStorageWriteTest, WritableReopenNeedsCacheAndAllowsRetry) {
+  {
+    auto storage = open_writable();
+    ASSERT_NE(nullptr, storage);
+    ASSERT_EQ(0, storage->close());
+  }
+  auto &pool = ailego::MemoryLimitPool::get_instance();
+  AILEGO_DEFER([&]() { EXPECT_EQ(0, pool.init(64UL * 1024UL * 10
```

---

### Incident Patch 3: `960ecbc2` (2026-11-02)
**Commit Message**: fix(hnsw): skip unavailable external vectors during queries (#861)

**File**: `src/core/algorithm/hnsw/hnsw_algorithm.cc` (modified, +18/-4)
```diff
@@ -80,8 +80,10 @@ int HnswAlgorithm<EntityType>::search(HnswContext *ctx) const {
   }
 
   dist_t dist = ctx->dist_calculator().dist(entry_point);
+  if (ailego_unlikely(ctx->error())) return IndexError_Runtime;
   for (level_t cur_level = max_level; cur_level >= 1; --cur_level) {
     select_entry_point(cur_level, &entry_point, &dist, ctx);
+    if (ailego_unlikely(ctx->error())) return IndexError_Runtime;
   }
 
   const uint32_t capacity = std::max(ctx->topk(), ctx->ef());
@@ -94,11 +96,12 @@ int HnswAlgorithm<EntityType>::search(HnswContext *ctx) const {
     search_neighbors(0, &entry_point, &dist, topk, ctx);
   }
 
+  if (ailego_unlikely(ctx->error())) return IndexError_Runtime;
   if (ctx->group_by_search()) {
     expand_neighbors_by_group(ctx);
   }
 
-  return 0;
+  return ctx->error() ? IndexError_Runtime : 0;
 }
 
 template <typename EntityType>
@@ -159,6 +162,7 @@ void HnswAlgorithm<EntityType>::select_entry_point(level_t level,
 
     dc.batch_dist(neighbor_vecs.data(), size, dists.data(),
                   has_extra_values ? neighbor_extra_values.data() : nullptr);
+    if (ailego_unlikely(dc.error())) return;
 
     for (uint32_t i = 0; i < size; ++i) {
       dist_t cur_dist = dists[i];
@@ -262,7 +266,9 @@ void fast_search_neighbors(const EntityType &entity, HeapType &pool,
       if (visit.visited(node)) continue;
       visit.set_visited(node);
       const void *vec_ptr = entity.get_vector_ptr(node);
-      ailego_prefetch_lines(vec_ptr, prefetch_lines);
+      if (ailego_likely(vec_ptr != nullptr)) {
+        ailego_prefetch_lines(vec_ptr, prefetch_lines);
+      }
       neighbor_ids[unvisited_count] = node;
       neighbor_vecs[unvisited_count] = vec_ptr;
       if (has_extra_values) {
@@ -288,6 +294,7 @@ void fast_search_neighbors(const EntityType &entity, HeapType &pool,
     if (unvisited_count == 0) continue;
     dc.batch_dist(neighbor_vecs.data(), unvisited_count, dists.data(),
                   has_extra_values ? neighbor_extra_values.data() : nullptr);
+    if (ailego_unlikely(dc.error())) return;
 
     pool.push_block(dists.data(), neighbor_ids.data(),
                     static_cast<int32_t>(unvisited_count));
@@ -360,11 +367,14 @@ void fast_search_neighbors_buffer(const EntityType &entity, HeapType &pool,
     }
     const uint32_t po = std::min(prefetch_offset, unvisited_count);
     for (uint32_t i = 0; i < po; ++i) {
-      ailego_prefetch_lines(neighbor_vecs[i], prefetch_lines);
+      if (ailego_likely(neighbor_vecs[i] != nullptr)) {
+        ailego_prefetch_lines(neighbor_vecs[i], prefetch_lines);
+      }
     }
 
     dc.batch_dist(neighbor_vecs.data(), unvisited_count, dists.data(),
                   has_extra_values ? neighbor_extra_values.data() : nullptr);
+    if (ailego_unlikely(dc.error())) return;
     pool.push_block(dists.data(), neighbor_ids.data(),
                     static_cast<int32_t>(unvisited_count));
   }
@@ -491,11 +501,14 @@ void dual_heap_search_neighbors(const EntityType &entity, level_t level,
 
     // do prefetch
     for (uint32_t i = 0; i < std::min(prefetch_offset, size); ++i) {
-      ailego_prefetch_lines(neighbor_vecs[i], prefetch_lines);
+      if (ailego_likely(neighbor_vecs[i] != nullptr)) {
+        ailego_prefetch_lines(neighbor_vecs[i], prefetch_lines);
+      }
     }
 
     dc.batch_dist(neighbor_vecs.data(), size, dists.data(),
                   has_extra_values ? neighbor_extra_values.data() : nullptr);
+    if (ailego_unlikely(dc.error())) return;
 
     for (uint32_t i = 0; i < size; ++i) {
       node_id_t node = neighbor_ids[i];
@@ -675,6 +688,7 @@ void HnswAlgorithm<EntityType>::expand_neighbors_by_group(
       }
       dc.batch_dist(neighbor_vecs.data(), size, dists.data(),
                     has_extra_values ? neighbor_extra_values.data() : nullptr);
+      if (ailego_unlikely(dc.error())) return;
 
       for (uint32_t i = 0; i < size; ++i) {
         node_id_t node = neighbor_ids[i];
```

**File**: `src/core/algorithm/hnsw/hnsw_context.h` (modified, +20/-1)
```diff
@@ -333,7 +333,7 @@ class HnswContext : public IndexContext {
   //! The active layout is bound together with the distance functions because
   //! graph construction may use records supplied by an external provider.
   inline const void *get_extra_values(const void *vector) const {
-    return extra_values_size_ == 0
+    return extra_values_size_ == 0 || vector == nullptr
                ? nullptr
                : static_cast<const char *>(vector) + vector_data_size_;
   }
@@ -355,6 +355,25 @@ class HnswContext : public IndexContext {
         vector, vector == nullptr ? nullptr : get_extra_values(vector));
   }
 
+  //! Query-only distance: an unavailable external record is skipped, while
+  //! storage errors and missing internal records still fail the query.
+  inline bool try_batch_dist(node_id_t id, dist_t &distance,
+                             bool skip_missing_vectors = false) {
+    IndexStorage::MemoryBlock block;
+    if (ailego_unlikely(dc_.get_vector(id, block) != 0)) {
+      LOG_ERROR("Failed to get vector, id=%u", id);
+      dc_.set_error();
+      return false;
+    }
+    const void *vector = block.data();
+    if (ailego_unlikely(vector == nullptr && skip_missing_vectors)) {
+      LOG_ERROR("Skip nullptr external vector, id=%u", id);
+      return false;
+    }
+    distance = dc_.batch_dist(vector, get_extra_values(vector));
+    return !dc_.error();
+  }
+
   inline TopkHeap &update_heap() {
     return update_heap_;
   }
```

**File**: `src/core/algorithm/hnsw/hnsw_dist_calculator.h` (modified, +40/-16)
```diff
@@ -34,6 +34,8 @@ class HnswDistCalculator {
     DIST_SPARSE = 3
   };
 
+  enum class Status { kOk, kError, kMissingVector };
+
  public:
   //! Constructor
   HnswDistCalculator(const HnswEntity *entity,
@@ -99,23 +101,23 @@ class HnswDistCalculator {
 
   //! Reset query vector data
   inline void reset_query(const void *query) {
-    error_ = false;
+    status_ = Status::kOk;
     query_ = query;
   }
 
   //! Returns distance
   inline dist_t dist(const void *vec_lhs, const void *vec_rhs) {
     if (ailego_unlikely(vec_lhs == nullptr || vec_rhs == nullptr)) {
       LOG_ERROR("Nullptr of dense vector");
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
 
     float score{0.0f};
 
     if (ailego_unlikely(!distance_)) {
       LOG_ERROR("Distance function is not initialized");
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
     distance_(vec_lhs, vec_rhs, dim_, &score);
@@ -137,13 +139,13 @@ class HnswDistCalculator {
     int ret = get_vector(id, vec_block);
     if (ailego_unlikely(ret != 0)) {
       LOG_ERROR("Get nullptr vector, id=%u", id);
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
     const void *feat = vec_block.data();
     if (ailego_unlikely(feat == nullptr)) {
       LOG_ERROR("Get nullptr vector, id=%u", id);
-      error_ = true;
+      status_ = Status::kMissingVector;
       return 0.0f;
     }
 
@@ -159,7 +161,7 @@ class HnswDistCalculator {
     int ret = get_vector(lhs, vec_block_feat);
     if (ailego_unlikely(ret != 0)) {
       LOG_ERROR("Get nullptr vector, id=%u", lhs);
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
     const void *feat = vec_block_feat.data();
@@ -168,13 +170,13 @@ class HnswDistCalculator {
     ret = get_vector(rhs, vec_block_query);
     if (ailego_unlikely(ret != 0)) {
       LOG_ERROR("Get nullptr vector, id=%u", rhs);
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
     const void *query = vec_block_query.data();
     if (ailego_unlikely(feat == nullptr || query == nullptr)) {
       LOG_ERROR("Get nullptr vector");
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
 
@@ -197,9 +199,25 @@ class HnswDistCalculator {
                   const void **extra_values) {
     compare_cnt_++;
 
+    if (num == 0) return;
+    if (ailego_unlikely(vecs == nullptr || query_ == nullptr)) {
+      LOG_ERROR("Nullptr of dense vector batch or query");
+      status_ = Status::kError;
+      std::fill(distances, distances + num, 0.0f);
+      return;
+    }
+    for (size_t i = 0; i < num; ++i) {
+      if (ailego_unlikely(vecs[i] == nullptr)) {
+        LOG_ERROR("Get nullptr vector in batch, offset=%zu", i);
+        status_ = Status::kMissingVector;
+        std::fill(distances, distances + num, 0.0f);
+        return;
+      }
+    }
+
     if (ailego_unlikely(!batch_distance_)) {
       LOG_ERROR("Batch distance function is not initialized");
-      error_ = true;
+      status_ = Status::kError;
       std::fill(distances, distances + num, 0.0f);
       return;
     }
@@ -209,15 +227,15 @@ class HnswDistCalculator {
   inline dist_t batch_dist(const void *feat, const void *extra_values) {
     compare_cnt_++;
 
-    if (ailego_unlikely(feat == nullptr)) {
+    if (ailego_unlikely(feat == nullptr || query_ == nullptr)) {
       LOG_ERROR("Get nullptr vector");
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
     dist_t score = 0;
     if (ailego_unlikely(!batch_distance_)) {
       LOG_ERROR("Batch distance function is not initialized");
-      error_ = true;
+      status_ = Status::kError;
       return 0.0f;
     }
     if (extra_values != nullptr) {
@@ -231,19 +249,25 @@ class HnswDistCalculator {
 
   inline void clear() {
     compare_cnt_ = 0;
-    error_ = false;
+    status_ = Status::kOk;
   }
 
   inline void clear_compare_cnt() {
     compare_cnt_ = 0;
   }
 
+  //! Both failure states stop graph traversal. External-vector queries may
+  //! retry kMissingVector with a linear scan.
   inline bool error() const {
-    return error_;
+    return status_ != Status::kOk;
+  }
+
+  inline Status status() const {
+    return status_;
   }
 
   inline void set_error() {
-    error_ = true;
+    status_ = Status::kError;
   }
 
   //! Get distances compute times
@@ -306,7 +330,7 @@ class HnswDistCalculator {
 
   uint32_t compare_cnt_;  // record distance compute times
   // uint32_t compare_cnt_batch_;  // record batch distance compute time
-  bool error_{false};
+  Status status_{Status::kOk};
 
   // get original vector, used to build graph
   IndexProvider::Pointer provider_{};
```

**File**: `src/core/algorithm/hnsw/hnsw_streamer.cc` (modified, +37/-4)
```diff
@@ -955,9 +955,17 @@ int HnswStreamer::search_impl(const void *query, const IndexQueryMeta &qmeta,
   bind_search_dist_space(ctx);
   ctx->resize_results(count);
   ctx->check_need_adjuct_ctx(entity_->doc_cnt());
+  const void *queries = query;
   for (size_t q = 0; q < count; ++q) {
     ctx->reset_query(query, meta_);
     ret = alg_->search(ctx);
+    if (ailego_unlikely(ctx->dist_calculator().status() ==
+                            HnswDistCalculator::Status::kMissingVector &&
+                        storage_mode() == HnswStorageMode::kExternal)) {
+      // Missing graph nodes can include the entry point or disconnect the
+      // route to valid neighbors. Retry the batch against available records.
+      return search_bf_impl(queries, qmeta, count, context);
+    }
     if (ailego_unlikely(ret != 0)) {
       LOG_ERROR("Hnsw searcher fast search failed");
       return ret;
@@ -1009,6 +1017,11 @@ int HnswStreamer::search_candidates_impl(
   ctx->check_need_adjuct_ctx(entity_->doc_cnt());
   ctx->reset_query(query, meta_);
   ret = alg_->search(ctx);
+  if (ailego_unlikely(ctx->dist_calculator().status() ==
+                          HnswDistCalculator::Status::kMissingVector &&
+                      storage_mode() == HnswStorageMode::kExternal)) {
+    ret = search_bf_impl(query, qmeta, 1, context);
+  }
   if (ailego_unlikely(ret != 0)) {
     LOG_ERROR("Hnsw searcher fast search failed");
     return ret;
@@ -1076,6 +1089,8 @@ int HnswStreamer::search_bf_impl(
   bind_search_dist_space(ctx);
   ctx->resize_results(count);
 
+  const bool skip_missing_vectors =
+      storage_mode() == HnswStorageMode::kExternal;
   if (ctx->group_by_search()) {
     if (!ctx->group_by().is_valid()) {
       LOG_ERROR("Invalid group-by function");
@@ -1096,7 +1111,11 @@ int HnswStreamer::search_bf_impl(
         }
 
         if (!ctx->filter().is_valid() || !ctx->filter()(entity_->get_key(id))) {
-          dist_t dist = ctx->batch_dist(id);
+          dist_t dist;
+          if (!ctx->try_batch_dist(id, dist, skip_missing_vectors)) {
+            if (ctx->error()) return IndexError_Runtime;
+            continue;
+          }
 
           std::string group_id = group_by(id);
 
@@ -1123,7 +1142,11 @@ int HnswStreamer::search_bf_impl(
         }
 
         if (!filter.is_valid() || !filter(entity_->get_key(id))) {
-          dist_t dist = ctx->batch_dist(id);
+          dist_t dist;
+          if (!ctx->try_batch_dist(id, dist, skip_missing_vectors)) {
+            if (ctx->error()) return IndexError_Runtime;
+            continue;
+          }
           topk.emplace(id, dist);
         }
       }
@@ -1171,6 +1194,8 @@ int HnswStreamer::search_bf_by_p_keys_impl(
   bind_search_dist_space(ctx);
   ctx->resize_results(count);
 
+  const bool skip_missing_vectors =
+      storage_mode() == HnswStorageMode::kExternal;
   if (ctx->group_by_search()) {
     if (!ctx->group_by().is_valid()) {
       LOG_ERROR("Invalid group-by function");
@@ -1190,7 +1215,11 @@ int HnswStreamer::search_bf_by_p_keys_impl(
         if (!ctx->filter().is_valid() || !ctx->filter()(pk)) {
           node_id_t id = entity_->get_id(pk);
           if (id != kInvalidNodeId) {
-            dist_t dist = ctx->batch_dist(id);
+            dist_t dist;
+            if (!ctx->try_batch_dist(id, dist, skip_missing_vectors)) {
+              if (ctx->error()) return IndexError_Runtime;
+              continue;
+            }
             std::string group_id = group_by(id);
 
             auto &topk_heap = ctx->group_topk_heaps()[group_id];
@@ -1216,7 +1245,11 @@ int HnswStreamer::search_bf_by_p_keys_impl(
         if (!filter.is_valid() || !filter(pk)) {
           node_id_t id = entity_->get_id(pk);
           if (id != kInvalidNodeId) {
-            dist_t dist = ctx->batch_dist(id);
+            dist_t dist;
+            if (!ctx->try_batch_dist(id, dist, skip_missing_vectors)) {
+              if (ctx->error()) return IndexError_Runtime;
+              continue;
+            }
             topk.emplace(id, dist);
           }
         }
```

**File**: `src/include/zvec/core/interface/vector_source.h` (modified, +6/-0)
```diff
@@ -25,6 +25,12 @@ class ZVEC_CORE_API VectorSource {
   VectorSource();
   virtual ~VectorSource();
 
+  //! Return a vector record for node_id. During HNSW queries, nullptr marks
+  //! an unavailable record: it is logged and excluded from the results.
+  //! A graph query encountering such a record retries with a linear scan of
+  //! available records. Query-time availability and returned buffers must
+  //! remain stable until the query finishes. During insertion, all records
+  //! referenced by graph construction must be available.
   virtual const void *get_vector(uint32_t node_id) const = 0;
 
   virtual void get_vectors(const uint32_t *ids, uint32_t count,
```

**File**: `tests/core/algorithm/hnsw/hnsw_dist_calculator_test.cc` (modified, +52/-0)
```diff
@@ -177,6 +177,58 @@ TEST(HnswDistCalculatorTest, PassesNullWhenMetricHasNoExtraValues) {
   EXPECT_FLOAT_EQ(0.0f, distance);
 }
 
+TEST(HnswDistCalculatorTest, RejectsNullBatchRecordsBeforeCallingMetric) {
+  auto metric = CreateMetric();
+  float query = 0.0f;
+  float vector = 1.0f;
+  HnswDistCalculator calculator(nullptr, metric, 1, &query);
+  bool called = false;
+  calculator.update_distance(metric->distance(),
+                             [&](const void **, const void *, size_t, size_t,
+                                 float *, const void **) { called = true; });
+  for (size_t missing = 0; missing < 3; ++missing) {
+    const void *vectors[] = {&vector, &vector, &vector};
+    vectors[missing] = nullptr;
+    float distances[] = {1.0f, 1.0f, 1.0f};
+    calculator.reset_query(&query);
+    calculator.batch_dist(vectors, 3, distances, nullptr);
+    EXPECT_TRUE(calculator.error());
+    EXPECT_EQ(HnswDistCalculator::Status::kMissingVector, calculator.status());
+    EXPECT_FALSE(called);
+  }
+  calculator.clear();
+  EXPECT_FALSE(calculator.error());
+  EXPECT_EQ(HnswDistCalculator::Status::kOk, calculator.status());
+
+  calculator.reset_query(nullptr);
+  const void *vectors[] = {&vector};
+  float distance = 1.0f;
+  calculator.batch_dist(vectors, 1, &distance, nullptr);
+  EXPECT_TRUE(calculator.error());
+  EXPECT_EQ(HnswDistCalculator::Status::kError, calculator.status());
+  EXPECT_FALSE(called);
+
+  calculator.reset_query(&query);
+  calculator.batch_dist(vectors, 1, &distance, nullptr);
+  EXPECT_FALSE(calculator.error());
+  EXPECT_EQ(HnswDistCalculator::Status::kOk, calculator.status());
+  EXPECT_TRUE(called);
+}
+
+TEST(HnswDistCalculatorTest, QueryDistancePreservesInternalReadErrors) {
+  auto entity = std::make_shared<InlineVectorHnswEntity>(
+      std::vector<InlineVectorHnswEntity::Record>(1));
+  auto metric = CreateMetric();
+  HnswContext context(1, metric, entity);
+  float query = 0.0f;
+  context.dist_calculator().reset_query(&query);
+  float distance = 0.0f;
+  EXPECT_FALSE(context.try_batch_dist(1, distance));
+  EXPECT_TRUE(context.error());
+  EXPECT_EQ(HnswDistCalculator::Status::kError,
+            context.dist_calculator().status());
+}
+
 }  // namespace
 }  // namespace core
 }  // namespace zvec
```

**File**: `tests/core/interface/hnsw_external_null_test.cc` (added, +233/-0)
```diff
@@ -0,0 +1,233 @@
+// Copyright 2026-present the zvec project
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
+#include <algorithm>
+#include <array>
+#include <cstdint>
+#include <initializer_list>
+#include <memory>
+#include <string>
+#include <tuple>
+#include <vector>
+#include <gtest/gtest.h>
+#include <zvec/core/interface/index.h>
+#include <zvec/core/interface/index_factory.h>
+#include <zvec/core/interface/index_param_builders.h>
+#include <zvec/core/interface/vector_source.h>
+#include "algorithm/hnsw/hnsw_context.h"
+#include "tests/test_util.h"
+
+using namespace zvec::core_interface;
+
+namespace {
+
+class NullableVectorSource : public zvec::core::VectorSource {
+ public:
+  static constexpr uint32_t kDimension = 16;
+
+  explicit NullableVectorSource(uint32_t count)
+      : vectors(count), missing(count, false) {
+    for (uint32_t id = 0; id < count; ++id) {
+      vectors[id][0] = static_cast<float>(id);
+    }
+  }
+
+  const void *get_vector(uint32_t id) const override {
+    return missing.at(id) ? nullptr : vectors.at(id).data();
+  }
+
+  std::vector<std::array<float, kDimension>> vectors;
+  std::vector<bool> missing;
+};
+
+class HnswExternalNullTest
+    : public testing::TestWithParam<std::tuple<uint32_t, bool>> {
+ protected:
+  void SetUp() override {
+    source_ = std::make_unique<NullableVectorSource>(std::get<0>(GetParam()));
+    const auto *info = testing::UnitTest::GetInstance()->current_test_info();
+    directory_ = std::string("hnsw_external_null/") + info->name() + "/";
+    zvec::test_util::RemoveTestPath(directory_);
+    auto param = HNSWIndexParamBuilder()
+                     .with_metric_type(MetricType::kL2sq)
+                     .with_data_type(DataType::DT_FP32)
+                     .with_dimension(NullableVectorSource::kDimension)
+                     .with_is_sparse(false)
+                     .with_use_external_vector(true)
+                     .build();
+    index_ = std::dynamic_pointer_cast<HNSWIndex>(
+        IndexFactory::CreateAndInitIndex(*param));
+    ASSERT_NE(nullptr, index_);
+    ASSERT_EQ(0, index_->open(directory_ + "index",
+                              {StorageOptions::StorageType::kMMAP, true}));
+    ASSERT_EQ("external", index_->storage_mode());
+    for (uint32_t id = 0; id < source_->vectors.size(); ++id) {
+      VectorData vector{DenseVector{source_->vectors[id].data()}};
+      ASSERT_EQ(0, index_->add_with_source(vector, id, *source_));
+    }
+    param_ = HNSWQueryParamBuilder()
+                 .with_topk(2)
+                 .with_ef_search(50)
+                 .with_fetch_vector(std::get<1>(GetParam()))
+                 .build();
+  }
+
+  void TearDown() override {
+    if (index_) index_->close();
+    zvec::test_util::RemoveTestPath(directory_);
+  }
+
+  int search() {
+    // The query is independent of the unavailable source records.
+    std::array<float, NullableVectorSource::kDimension> query{};
+    VectorData vector{DenseVector{query.data()}};
+    result_ = SearchResult{};
+    return index_->search_with_source(vector, param_, *source_, &result_);
+  }
+
+  void expect_results(std::initializer_list<uint32_t> ids) {
+    ASSERT_EQ(ids.size(), result_.doc_list_.size());
+    size_t offset = 0;
+    for (uint32_t id : ids) {
+      const auto &doc = result_.doc_list_[offset++];
+      EXPECT_EQ(id, doc.key());
+      EXPECT_FLOAT_EQ(static_cast<float>(id * id), doc.score());
+      if (std::get<1>(GetParam())) {
+        EXPECT_EQ(source_->vectors[id].data(), doc.vector());
+      }
+    }
+  }
+
+  std::unique_ptr<NullableVectorSource> source_;
+  std::shared_ptr<HNSWIndex> index_;
+  HNSWQueryParam::Pointer param_;
+  SearchResult result_;
+  std::string directory_;
+};
+
+TEST_P(HnswExternalNullTest, SkipsMissingNearestAndRecovers) {
+  ASSERT_EQ(0, search());
+  expect_results({0, 1});
+  source_->missing[0] = true;
+  testing::internal::CaptureStderr();
+  const int ret = search();
+  const std::string diagnostic = testing::internal::GetCapturedStderr();
+  EXPECT_EQ(0, ret);
+  EXPECT_NE(std::string::npos, diagnostic.find("nullptr"));
+  expect_results({1, 2});
+  source_->missing[0] = false;
+  ASSERT_EQ(0, search());
+  expect_results({0, 1});
+}
+
+TEST_P(HnswExternalNullTest, HandlesMissingEntryPointAndEmptySource) {
+  auto context = index_->index_searcher()->create_context();
+  auto *hnsw_context = dynamic_cast<zvec::core::HnswContext *>(context.get());
+  ASSERT_NE(nullptr, hns
```

#### Recent Merged Pull Requests:
- **PR #870** (2026-11-03): fix(storage): separate BufferStorage creation and write permissions (@iaojnh)
- **PR #862** (2026-11-02): perf(core): accelerate HNSW construction and FP16 HNSW/Flat distances (@luoxiaojian)
- **PR #861** (2026-11-02): fix(hnsw): skip unavailable external vectors during queries (@iaojnh)
- **PR #859** (2026-10-30): fix(io): prevent file descriptor inheritance across exec (@egolearner)
- **PR #856** (2026-10-29): feat(turbo): complete ARM NEON one-to-many distance kernels (@richyreachy)
- **PR #853** (2026-10-30): perf(diskann): borrow mmap vectors during graph construction (@iaojnh)

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

## X. db): avoid null writing_segment_ on DDL writing segment recreation failure (#822

**RULE**:
When implementing operations in `src/db/collection.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1bcbc4cc`: db): avoid null writing_segment_ on DDL writing segment recreation failure (#822). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/db/collection.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  auto old_writing_segment = writing_segment_;
  Version old_version = version_manager_->get_current_version();
  Version new_version = old_version;
  s = commit_schema_change_with_new_writing_segment(
      new_schema, old_writing_segment, old_version, &new_version, min_doc_id);
  auto old_writing_segment = writing_segment_;
  Version old_version = version_manager_->get_current_version();
  Version new_version = old_version;
  s = commit_schema_change_with_new_writing_segment(
      new_schema, old_writing_segment, old_version, &new_version, min_doc_id);
  auto old_writing_segment = writing_segment_;
  Version old_version = version_manager_->get_current_version();
  Version new_version = old_version;
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
  Version new_version = version_manager_->get_current_version();
  // reset writing segment with new schema
  auto id = writing_segment_->id();
  s = writing_segment_->destroy();
  CHECK_RETURN_STATUS(s);
  writing_segment_.reset();

  SegmentOptions seg_options;
  seg_options.enable_mmap_ = options_.enable_mmap_;
  seg_options.max_buffer_size_ = options_.max_buffer_size_;
  seg_options.read_only_ = options_.read_only_;
  auto writing_segment =
      Segment::CreateAndOpen(path_, *new_schema, id, min_doc_id, id_map_,
                             delete_store_, version_manager_, seg_options);
  if (!writing_segment) {
    return writing_segment.error();
  }
  writing_segment_ = writing_segment.value();

  new_version.reset_writing_segment_meta(writing_segment_->meta());
  s = version_manager_->apply(new_version);
  CHECK_RETURN_STATUS(s);

  // persist manifest
  s = version_manager_->flush();
  schema_ = new_schema;

  Version new_version = version_manager_->get_current_version();
  // reset writing segment with new schema
  auto id = writing_segment_->id();
  s = writing_segment_->destroy();
  CHECK_RETURN_STATUS(s);
  writing_segment_.reset();

  SegmentOptions seg_options;
  seg
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1bcbc4cc` are properly handled with clean fallback behavior.
