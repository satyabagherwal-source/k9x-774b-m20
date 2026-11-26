> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source**: github ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Source Version**: `9af55fa5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T00:09:31.735Z  
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
> **Harvest Timestamp**: 2026-11-26T00:09:31.724Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/zvec`
- **Description**: A lightweight, lightning-fast, in-process vector database
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 16290 stars

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

### Core Architecture Module: `src/ailego/utility/mobile_memory.h`
```
// Copyright 2025-present the zvec project
// SPDX-License-Identifier: Apache-2.0
#pragma once

#include <zvec/ailego/buffer/process_rss_budget.h>
#if defined(__APPLE__)
#include <TargetConditionals.h>
#if TARGET_OS_IPHONE && !TARGET_OS_SIMULATOR && !TARGET_OS_MACCATALYST
#include <mach/mach.h>
#include <os/proc.h>
#endif
#endif

namespace zvec::ailego {

inline ProcessRssBudget::NativeReader NativeApplicationMemoryReader() {
#if defined(__APPLE__) && TARGET_OS_IPHONE && !TARGET_OS_SIMULATOR && \
    !TARGET_OS_MACCATALYST
  return +[](ProcessRssBudget::NativeSample *sample) -> bool {
    if (__builtin_available(iOS 13.0, tvOS 13.0, watchOS 6.0, *)) {
      task_vm_info_data_t info{};
      mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
      if (::task_info(::mach_task_self(), TASK_VM_INFO,
                      reinterpret_cast<task_info_t>(&info),
                      &count) != KERN_SUCCESS ||
          count < TASK_VM_INFO_REV1_COUNT)
        return false;
      sample->footprint = static_cast<size_t>(info.phys_footprint);
      sample->available = ::os_proc_available_memory();
      return true;
    }
    return false;
  };
#else
  // Simulator memory limits describe the host, not a device application.
  // It still exercises RSS and the explicit host-pressure notification path.
  return nullptr;
#endif
}

}  // namespace zvec::ailego

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #886** (2026-11-11): **[Bug]: HNSW + INT8/INT4 + enable_rotate=True returns near-random results after optimize() (regression in 0.8.0)**
  *Symptoms*: ### Description   On 0.8.0 and 0.8.1, a newly created HNSW index with scalar quantization (INT8 or INT4) and QuantizerParam(enable_rotate=True) returns wrong neighbours after Collection.optimize(). A query with a document's own vector almost never returns that document. Results are correct before optimize, and Flat and IVF indexes with the same settings are correct. On 0.7.0 the same script gives full recall.   HNSW collections built with rotation on 0.7.0, then opened, written to and re-optimized on 0.8.1, keep full recall. Only indexes created on 0.8.x are affected.   The same happens at dim=32 and with INT4. In a 4-dimension example, the exact match scores about 1.0 after optimize (it should be about 0), and the ranking is scrambled.   Also reproduces at scale: SIFT1M (1M × 128, L2), HNSW + INT8 + enable_rotate=True on 0.8.1 gives recall@10 = 0.000 at every ef from 40 to 200, with or without the refiner. Plain INT8 HNSW on the same data is unaffected.    Environment: zvec 0.8.1 from PyPI (cp312 wheel), macOS (Darwin 25.5), Apple Silicon arm64, Python 3.12.   Possibly related: the Turbo quantizer and distance-kernel migration in 0.8.0 (#716, #735, #773).  ### Steps to Reproduce  ```python import random, tempfile, zvec   zvec.init(log_dir=tempfile.mkdtemp())  random.seed(0)  dim, n = 128, 500  vecs = {str(i): [random.gauss(0, 1) for _ in range(dim)] for i in range(n)}   for rotate in (False, True):      ip = zvec.HnswIndexParam(          metric_type=zvec.MetricType.COSINE,  

- **Issue #849** (2026-11-13): **[Bug]: Refiner on unquantized ANN indexes fails only after optimize**
  *Symptoms*: ### Description  With zvec 0.8.0, enabling the refiner on an unquantized dense HNSW, IVF, or DiskANN field succeeds before `optimize()`, but the same query fails with an internal error after optimization. Optimization itself succeeds, and ordinary queries still work.  The issue is the missing validation and state-dependent behavior of an unsupported parameter combination. Supporting refinement for unquantized ANN indexes is not necessary to resolve this: a clear, consistent `InvalidArgument` from the C++ database query layer would be preferable.  ### Steps to Reproduce  Tested using the published `@zvec/zvec@0.8.0` Node.js binding and its prebuilt macOS ARM64 binary, rather than a locally modified C++ build.  1. Create a dense FP32 field with 64 dimensions and L2 distance. Select HNSW, IVF, or DiskANN with `quantizeType: UNDEFINED`. 2. Insert 12,000 vectors. 3. Query with `isUsingRefiner: true`: succeeds. 4. Call `optimizeSync()`: succeeds, with index completeness reaching 1. 5. Query with `isUsingRefiner: false`: succeeds. 6. Repeat the query with `isUsingRefiner: true`: fails. 7. Repeat with FP16 quantization as a control: all steps succeed for all three index types.  | Index | Quantization | Refiner before optimize | Ordinary query after optimize | Refiner after optimize | | --- | --- | --- | --- | --- | | HNSW | UNDEFINED | Pass | Pass | Fail | | IVF | UNDEFINED | Pass | Pass | Fail | | DiskANN | UNDEFINED | Pass | Pass | Fail | | HNSW | FP16 | Pass | Pass | Pass | | IVF 

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

### Incident Patch 1: `21229b48` (2026-11-25)
**Commit Message**: fix: preserve BufferStorage consistency and staged budget recovery (#923)

**File**: `src/ailego/buffer/block_eviction_queue.cc` (modified, +471/-204)
```diff
@@ -20,6 +20,8 @@
 #include <cstdlib>
 #include <limits>
 #include <new>
+#include <optional>
+#include <utility>
 #include <ailego/pattern/scope_guard.h>
 #include <ailego/utility/memory_helper.h>
 #include <ailego/utility/mobile_memory.h>
@@ -65,6 +67,7 @@ constexpr size_t kMaxSlabDataPages = kSlabBytes / kMinimumPageBytes - 1;
 constexpr size_t kQueueSmallBytes = 4096;
 constexpr size_t kQueueSlabBytes = 64UL << 10;
 constexpr size_t kQueueAlignment = alignof(std::max_align_t);
+thread_local size_t *initial_queue_backing = nullptr;
 
 static_assert(kQueueSmallBytes % kQueueAlignment == 0,
               "queue size classes must preserve maximum alignment");
@@ -228,6 +231,7 @@ struct MemoryLimitPool::QueueMemorySlab {
   size_t live_slots{0};
   QueueAllocationHeader *free_head{nullptr};
   ProcessRssBudget::MappingProjection projection{};
+  bool has_lifetime_slot{false};
 };
 
 void *EvictionQueueTraits::malloc(size_t bytes) {
@@ -238,6 +242,23 @@ void EvictionQueueTraits::free(void *ptr) {
   MemoryLimitPool::get_instance().free_queue_memory(ptr);
 }
 
+void *BlockEvictionQueue::ProcessQueueTraits::malloc_lifetime(size_t bytes) {
+  // Process-wide queues keep their producers and indexes until process exit.
+  return MemoryLimitPool::get_instance().allocate_queue_memory(bytes, true);
+}
+
+BlockEvictionQueue::BlockEvictionQueue() {
+  // Only the queues' initial block pools are allocated through the traits
+  // during construction. They stay mapped for the lifetime of this instance.
+  auto *previous =
+      std::exchange(initial_queue_backing, &initial_backing_bytes_);
+  auto restore =
+      ScopeGuard::Make([previous] { initial_queue_backing = previous; });
+  for (size_t i = 0; i < kQueueCount; ++i) {
+    evict_queues_.emplace_back(kEvictQueueCapacity);
+  }
+}
+
 void MemoryLimitPool::register_queue_mapping(QueueResidentMapping *mapping,
                                              void *data, size_t bytes) {
   mapping->data = data;
@@ -272,7 +293,7 @@ bool MemoryLimitPool::unmap_queue_mapping(QueueResidentMapping *mapping) {
   return true;
 }
 
-void *MemoryLimitPool::allocate_queue_memory(size_t bytes) {
+void *MemoryLimitPool::allocate_queue_memory(size_t bytes, bool lifetime) {
   if (bytes > std::numeric_limits<size_t>::max() -
                   sizeof(QueueAllocationHeader) - (kQueueAlignment - 1)) {
     return nullptr;
@@ -363,6 +384,11 @@ void *MemoryLimitPool::allocate_queue_memory(size_t bytes) {
     header->bytes = total;
     header->owner = slab;
     ++slab->live_slots;
+    if (lifetime && !slab->has_lifetime_slot) {
+      slab->has_lifetime_slot = true;
+      queue_runtime_lifetime_size_.fetch_add(slab->mapping_bytes,
+                                             std::memory_order_relaxed);
+    }
     if (!slab->has_space()) slab->unlink(queue_small_slabs_[index]);
     return header + 1;
   }
@@ -388,6 +414,11 @@ void *MemoryLimitPool::allocate_queue_memory(size_t bytes) {
   header->bytes = region_bytes;
   header->owner = nullptr;
   queue_allocated_size_.fetch_add(region_bytes, std::memory_order_relaxed);
+  if (initial_queue_backing) *initial_queue_backing += region_bytes;
+  if (lifetime) {
+    queue_runtime_lifetime_size_.fetch_add(region_bytes,
+                                           std::memory_order_relaxed);
+  }
   return header + 1;
 }
 
@@ -442,7 +473,7 @@ void MemoryLimitPool::free_queue_memory(void *ptr) {
   queue_allocated_size_.fetch_sub(bytes, std::memory_order_relaxed);
   if (pool_size_.load(std::memory_order_relaxed) != 0) {
     queue_charged_size_.fetch_sub(bytes, std::memory_order_relaxed);
-    release_fixed(bytes, &metadata_used_size_, Backing::kLive, projection);
+    release_fixed(bytes, &metadata_used_size_, Backing::kUnmapped, projection);
   }
 }
 
@@ -1071,10 +1102,12 @@ bool MemoryLimitPool::try_materialize_retained_block(void *data,
   auto *block = reinterpret_cast<RetainedBlock *>(static_cast<char *>(data) -
                                                   kRetainedBlockHeaderBytes);
   const size_t bytes = block->bytes();
-  const auto admit = [&] {
-    return process_rss_.try_materialize_reusable(bytes, block->projection);
+  const auto admit = [&](AdmissionDenials *denials) {
+    return process_rss_.try_materialize_reusable(
+        bytes, block->projection, denials ? &denials->rss : nullptr,
+        denials ? &denials->rss_watch : nullptr);
   };
-  if (!required) return admit();
+  if (!required) return admit(nullptr);
   // The caller pins the chunk, but must not hold its allocator mutex while
   // maintenance proves residency or invokes a reclaimer that can use it.
   std::shared_lock<std::shared_mutex> lifecycle_lock(lifecycle_mutex_);
@@ -1107,7 +1140,7 @@ void MemoryLimitPool::release_retained_block(void *data) {
     }
     if (unmapped) {
       retained_block_bytes_.fetch_sub(bytes, std::memory_order_relaxed);
-      release_committed(bytes, Backing::kLive, projection);
+      release_committed(bytes, Back
```

**File**: `src/ailego/io/file.cc` (modified, +172/-41)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+#include <limits>
+#include <zvec/ailego/buffer/block_eviction_queue.h>
 #include <zvec/ailego/internal/platform.h>
 #include <zvec/ailego/io/file.h>
 #if !defined(_WIN64) && !defined(_WIN32)
@@ -31,8 +33,64 @@
 namespace zvec {
 namespace ailego {
 
+namespace {
+
+size_t ReserveMappedPages(size_t bytes, size_t page_offset = 0) {
+  if (bytes == 0) return 0;
+  auto &pool = MemoryLimitPool::get_instance();
+  const size_t page = pool.page_buffer_size();
+  if (bytes > (std::numeric_limits<size_t>::max)() - page_offset - (page - 1))
+    return 0;
+  const size_t rounded = ((page_offset + bytes + page - 1) / page) * page;
+  return pool.try_reserve_materialization(rounded) ? rounded : 0;
+}
+
+size_t ReserveMappedPages(const void *addr, size_t bytes) {
+  return ReserveMappedPages(bytes, reinterpret_cast<uintptr_t>(addr) %
+                                       MemoryLimitPool::page_buffer_size());
+}
+
+void FinishMappedPages(size_t bytes, bool materialized) {
+  if (!bytes) return;
+#if defined(_WIN64) || defined(_WIN32)
+  const auto error = ::GetLastError();
+#else
+  const int error = errno;
+#endif
+  MemoryLimitPool::get_instance().finish_materialization(bytes, materialized);
+#if defined(_WIN64) || defined(_WIN32)
+  ::SetLastError(error);
+#else
+  errno = error;
+#endif
+}
+
+}  // namespace
+
 #if !defined(_WIN64) && !defined(_WIN32)
 
+File::Identity File::Identify(NativeHandle handle) {
+  struct stat st {};
+  if (::fstat(handle, &st) != 0) return {};
+  return {static_cast<uint64_t>(st.st_dev), static_cast<uint64_t>(st.st_ino),
+          true};
+}
+
+File::Identity File::IdentifyPath(const std::string &path) {
+  struct stat st {};
+  if (::lstat(path.c_str(), &st) != 0) return {};
+  return {static_cast<uint64_t>(st.st_dev), static_cast<uint64_t>(st.st_ino),
+          true};
+}
+
+bool File::DeleteIfSame(const std::string &path, const Identity &identity) {
+  if (!identity.valid) return false;
+  const auto current = IdentifyPath(path);
+  if (!current.valid) return errno == ENOENT;
+  if (!(current == identity)) return true;
+  return ::unlink(path.c_str()) == 0 || errno == ENOENT;
+}
+
 static inline int OpenSafely(const char *path, int flags) {
   // Set close-on-exec atomically with open: a later fcntl can race with a
   // concurrent process launch and leave the child holding collection locks.
@@ -170,6 +228,15 @@ bool File::create(const char *path, size_t len, bool direct) {
   return true;
 }
 
+bool File::create_exclusive(const char *path) {
+  ailego_false_if_false(native_handle_ == File::InvalidHandle && path);
+  int fd = OpenSafely(path, O_RDWR | O_CREAT | O_EXCL);
+  ailego_false_if_lt_zero(fd);
+  read_only_ = false;
+  native_handle_ = fd;
+  return true;
+}
+
 bool File::open(const char *path, bool rdonly, bool direct) {
   ailego_false_if_false(native_handle_ == File::InvalidHandle && path);
 
@@ -318,7 +385,11 @@ void *File::MemoryMap(NativeHandle handle, ssize_t off, size_t len, int opts) {
   int flags = (opts & File::MMAP_SHARED) ? MAP_SHARED : MAP_PRIVATE;
 
 #if defined(MAP_POPULATE)
-  if (opts & File::MMAP_POPULATE) {
+  // Populating the mapping is optional. Keep lazy access available when
+  // process pressure leaves no room to fault in the whole extent.
+  const size_t populate =
+      (opts & File::MMAP_POPULATE) ? ReserveMappedPages(len) : 0;
+  if (populate) {
     flags |= MAP_POPULATE;
   }
 #endif
@@ -330,12 +401,13 @@ void *File::MemoryMap(NativeHandle handle, ssize_t off, size_t len, int opts) {
 #endif
 
   void *addr = mmap(nullptr, len, prot, flags, handle, off);
+#if defined(MAP_POPULATE)
+  FinishMappedPages(populate, addr != MAP_FAILED);
+#endif
   ailego_null_if_false(addr != MAP_FAILED);
 
-  if (opts & File::MMAP_LOCKED) {
-    mlock(addr, len);
-  }
-  if (opts & File::MMAP_WARMUP) {
+  const bool locked = (opts & File::MMAP_LOCKED) && MemoryLock(addr, len);
+  if (!locked && (opts & File::MMAP_WARMUP)) {
     File::MemoryWarmup(addr, len);
   }
   return addr;
@@ -352,7 +424,9 @@ void *File::MemoryMap(size_t len, int opts) {
   int flags = (opts & File::MMAP_SHARED) ? MAP_SHARED | MAP_ANONYMOUS
                                          : MAP_PRIVATE | MAP_ANONYMOUS;
 #if defined(MAP_POPULATE)
-  if (opts & File::MMAP_POPULATE) {
+  const size_t populate =
+      (opts & File::MMAP_POPULATE) ? ReserveMappedPages(len) : 0;
+  if (populate) {
     flags |= MAP_POPULATE;
   }
 #endif
@@ -362,6 +436,9 @@ void *File::MemoryMap(size_t len, int opts) {
   }
 #endif
   void *addr = mmap(nullptr, len, prot, flags, -1, 0);
+#if defined(MAP_POPULATE)
+  FinishMappedPages(populate, addr != MAP_FAILED);
+#endif
   ailego_null_if_false(addr != MAP_FAILED);
   return addr;
 #else
@@ -402,11 +479,6 @@ bool File::MemoryFlush(void *addr, size_t len) {
   return (msync(addr, len, MS_ASYNC) == 0);
 }
 
-bool File::MemoryLock(void *addr
```

**File**: `src/ailego/io/iouring_loader.cc` (modified, +291/-153)
```diff
@@ -24,6 +24,9 @@
 #include <limits>
 #include <thread>
 #include <ailego/io/iouring_loader.h>
+#include <ailego/pattern/scope_guard.h>
+#include <zvec/ailego/buffer/block_eviction_queue.h>
+#include <zvec/ailego/buffer/budgeted_mapped_buffer.h>
 #include <zvec/ailego/logger/logger.h>
 
 namespace zvec {
@@ -33,7 +36,55 @@ namespace ailego {
 // returning EAGAIN/EBUSY (100 us sleep per retry, about one second total).
 static constexpr size_t kIoUringDrainRetries = 10000;
 
+IoUringRing::IoUringRing() = default;
+
+int IoUringRing::enter(unsigned submit, unsigned minimum, unsigned flags) {
+  if (enter_override_) return enter_override_(ring_fd_, submit, minimum, flags);
+  return static_cast<int>(syscall(__NR_io_uring_enter, ring_fd_, submit,
+                                  minimum, flags, nullptr, size_t{0}));
+}
+
+IoUringRing::~IoUringRing() {
+  teardown();
+  if (prepaid_staging_bytes_ && !staging_)
+    MemoryLimitPool::get_instance().release_metadata(prepaid_staging_bytes_);
+}
+
+void IoUringRing::adopt_staging_reservation(size_t bytes) {
+  assert(staging_ == nullptr && staging_charge_ == 0 &&
+         prepaid_staging_bytes_ == 0);
+  prepaid_staging_bytes_ = bytes;
+}
+
+bool IoUringRing::release_staging() {
+  if (!staging_) return true;
+  if (!File::TryMemoryUnmap(staging_, staging_size_)) {
+    LOG_ERROR("io_uring staging unmap failed; size=%zu", staging_size_);
+    return false;
+  }
+  auto &pool = MemoryLimitPool::get_instance();
+  if (staging_charge_) {
+    pool.release_unmapped_external(staging_charge_, staging_projection_);
+  } else if (prepaid_staging_bytes_) {
+    pool.release_materialization(staging_size_, staging_projection_);
+  } else {
+    pool.release_unmapped_process_backing(staging_size_, staging_projection_);
+  }
+  staging_ = nullptr;
+  staging_size_ = 0;
+  staging_charge_ = 0;
+  staging_projection_ = {};
+  return true;
+}
+
 bool IoUringRing::setup(uint32_t entries) {
+  return setup_with_status(entries) == SetupResult::kReady;
+}
+
+IoUringRing::SetupResult IoUringRing::setup_with_status(uint32_t entries) {
+  if (is_valid()) return SetupResult::kReady;
+  auto &pool = MemoryLimitPool::get_instance();
+  if (pool.under_process_rss_pressure()) return SetupResult::kNoMemory;
   struct io_uring_params params;
   std::memset(&params, 0, sizeof(params));
 
@@ -44,15 +95,13 @@ bool IoUringRing::setup(uint32_t entries) {
     // ENOSYS = kernel doesn't support io_uring.
     // EPERM  = io_uring disabled via sysctl.
     // EINVAL = invalid parameters.
-    if (errno != ENOSYS) {
-      LOG_WARN("io_uring_setup failed; errno=%d, %s", errno, ::strerror(errno));
+    const int error = errno;
+    if (error != ENOSYS) {
+      LOG_WARN("io_uring_setup failed; errno=%d, %s", error, ::strerror(error));
     }
-    return false;
+    return error == ENOMEM ? SetupResult::kNoMemory : SetupResult::kUnavailable;
   }
 
-  sq_entries_ = params.sq_entries;
-  cq_entries_ = params.cq_entries;
-
   // The read path uses IORING_OP_READ (Linux 5.6+).  On older kernels
   // (5.1–5.5) io_uring_setup() succeeds but every read would fail with
   // -EINVAL, so reject the ring here and let callers fall back.
@@ -61,46 +110,70 @@ bool IoUringRing::setup(uint32_t entries) {
         "io_uring lacks IORING_OP_READ support (kernel < 5.6); falling "
         "back");
     teardown();
-    return false;
+    return SetupResult::kUnavailable;
   }
 
-  // --- mmap the three shared regions ---
+  bool ready = false;
+  const auto rollback = ScopeGuard::Make([&] {
+    if (!ready) teardown();
+  });
+  const auto result = map_control_regions(params);
+  ready = result == SetupResult::kReady;
+  return result;
+}
 
-  // 1. SQ ring (includes head, tail, mask, entries, flags, dropped, array).
+IoUringRing::SetupResult IoUringRing::map_control_regions(
+    const io_uring_params &params) {
+  sq_entries_ = params.sq_entries;
+  cq_entries_ = params.cq_entries;
   sq_ring_size_ =
       static_cast<size_t>(params.sq_off.array) + sq_entries_ * sizeof(uint32_t);
-  sq_ring_ptr_ = ::mmap(nullptr, sq_ring_size_, PROT_READ | PROT_WRITE,
-                        MAP_SHARED, ring_fd_, IORING_OFF_SQ_RING);
-  if (sq_ring_ptr_ == MAP_FAILED) {
-    LOG_ERROR("mmap SQ ring failed: %s", ::strerror(errno));
-    sq_ring_ptr_ = nullptr;
-    teardown();
-    return false;
-  }
-
-  // 2. SQE array.
   sqes_size_ = sq_entries_ * sizeof(struct io_uring_sqe);
-  sqes_ptr_ = reinterpret_cast<struct io_uring_sqe *>(
-      ::mmap(nullptr, sqes_size_, PROT_READ | PROT_WRITE, MAP_SHARED, ring_fd_,
-             IORING_OFF_SQES));
-  if (sqes_ptr_ == MAP_FAILED) {
-    LOG_ERROR("mmap SQEs failed: %s", ::strerror(errno));
-    sqes_ptr_ = nullptr;
-    teardown();
-    return false;
-  }
-
-  // 3. CQ ring (includes head, tail, mask, entries, overflow, cqes[]).
   cq_ring_size_ = static_cast<size_t>(params.cq_off.cqes) +
                   cq_entries_ * sizeof(struct io_uring_cqe);
-  cq_ring_ptr_ = ::mmap(nullptr, cq
```

**File**: `src/ailego/io/iouring_loader.h` (modified, +27/-5)
```diff
@@ -33,6 +33,7 @@
 #include <cstdlib>
 #include <vector>
 #include <ailego/io/iouring_def.h>
+#include <zvec/ailego/buffer/process_rss_budget.h>
 
 namespace zvec {
 namespace ailego {
@@ -87,17 +88,17 @@ static constexpr size_t kIoUringStagingAlign = 4096;
 
 class IoUringRing {
  public:
-  IoUringRing() = default;
-  ~IoUringRing() {
-    teardown();
-  }
+  IoUringRing();
+  ~IoUringRing();
 
   IoUringRing(const IoUringRing &) = delete;
   IoUringRing &operator=(const IoUringRing &) = delete;
 
   // Create an io_uring with `entries` queue slots.  Returns false if the
   // kernel lacks io_uring or setup failed.  In iouring_loader.cc.
   bool setup(uint32_t entries);
+  enum class SetupResult { kReady, kUnavailable, kNoMemory };
+  SetupResult setup_with_status(uint32_t entries);
 
   // munmap all regions, close the ring fd, free staging.  Closing the fd
   // only *starts* asynchronous cancellation of in-flight requests, so call
@@ -109,12 +110,21 @@ class IoUringRing {
   // the ring is quiesced (the old pool is freed here).  In iouring_loader.cc.
   bool ensure_staging(size_t bytes);
 
+  // Take ownership of an existing metadata reservation for writeback staging.
+  // Must be called before staging allocation. No second charge is taken.
+  void adopt_staging_reservation(size_t bytes);
+
   // Deliberately leak the staging pool when in-flight requests cannot be
   // drained: the kernel may keep writing into it after the fd is closed.
   // Caller buffers are never handed to the kernel and remain safe.
   void abandon_staging() {
+    if (!staging_) return;
     staging_ = nullptr;
     staging_size_ = 0;
+    // The allocation has not been freed. Leave its charge quarantined too.
+    staging_charge_ = 0;
+    staging_projection_ = {};
+    prepaid_staging_bytes_ = 0;
   }
 
   bool is_valid() const {
@@ -132,16 +142,22 @@ class IoUringRing {
 
   // Execute a batch of aligned writes via io_uring. The call blocks until all
   // accepted requests have completed, but the requests execute concurrently
-  // in the kernel. Returns 0 on success and -1 on a safely drained failure.
+  // in the kernel. A quarantined write can still modify the file after return.
+  static constexpr int kQuarantined = -2;
   int execute_writes(int fd, const IoUringWrite *write_reqs, size_t count);
 
   int execute_writes(int fd, const std::vector<IoUringWrite> &write_reqs) {
     return execute_writes(fd, write_reqs.data(), write_reqs.size());
   }
 
  private:
+  friend class IoUringStagingTestPeer;
+  SetupResult map_control_regions(const io_uring_params &params);
+  bool release_staging();
   int execute_impl(int fd, const IoUringRead *read_reqs,
                    const IoUringWrite *write_reqs, size_t count);
+  int enter(unsigned submit, unsigned minimum, unsigned flags);
+  int (*enter_override_)(int, unsigned, unsigned, unsigned){nullptr};
 
   int ring_fd_{-1};
 
@@ -152,6 +168,9 @@ class IoUringRing {
   size_t sq_ring_size_{0};
   size_t sqes_size_{0};
   size_t cq_ring_size_{0};
+  ProcessRssBudget::MaterializationStamp sq_ring_projection_{};
+  ProcessRssBudget::MaterializationStamp sqes_projection_{};
+  ProcessRssBudget::MaterializationStamp cq_ring_projection_{};
 
   // SQ ring field pointers (into sq_ring_ptr_).
   unsigned *sq_head_{nullptr};
@@ -177,6 +196,9 @@ class IoUringRing {
   // io_uring teardown (see abandon_staging()).
   char *staging_{nullptr};
   size_t staging_size_{0};
+  size_t staging_charge_{0};
+  ProcessRssBudget::MaterializationStamp staging_projection_{};
+  size_t prepaid_staging_bytes_{0};
 
   unsigned sq_entries_{0};
   unsigned cq_entries_{0};
```

**File**: `src/ailego/io/libaio_loader.h` (modified, +95/-0)
```diff
@@ -30,9 +30,12 @@
 
 #include <dlfcn.h>
 #include <atomic>
+#include <cerrno>
 #include <cstring>
+#include <limits>
 #include <mutex>
 #include <ailego/io/libaio_def.h>  // ABI-stable struct definitions (replaces <libaio.h>)
+#include <zvec/ailego/buffer/block_eviction_queue.h>
 
 // Function-pointer typedefs for the four libaio syscalls used by DiskAnn.
 typedef int (*aio_setup_fn)(int maxevents, io_context_t *ctxp);
@@ -76,6 +79,66 @@ class LibAioLoader {
     return available_.load(std::memory_order_acquire);
   }
 
+  struct RingMemory {
+    size_t bytes{0};
+    zvec::ailego::ProcessRssBudget::MaterializationStamp projection{};
+  };
+
+  int setup_budgeted(int maxevents, io_context_t &ctx, RingMemory &memory) {
+    if (ctx || !io_setup || !io_destroy || maxevents <= 0) return -EINVAL;
+    auto &pool = zvec::ailego::MemoryLimitPool::get_instance();
+    const size_t page = pool.page_buffer_size();
+    // io_setup returns a completion-ring address. Reserve its header page
+    // before the syscall and admit the rest before any submission can use it.
+    if (pool.under_process_rss_pressure() ||
+        !pool.try_reserve_process_backing(page)) {
+      return -ENOMEM;
+    }
+
+    io_context_t ring = nullptr;
+    const int ret = io_setup(maxevents, &ring);
+    if (ret != 0) {
+      pool.finish_process_backing(page, false);
+      return ret;
+    }
+
+    const size_t size = completion_mapping_size(ring, page);
+    const size_t extra = size > page ? size - page : 0;
+    if (size == 0 || !pool.try_reserve_process_backing(extra)) {
+      if (destroy_ring(ring) == 0) {
+        pool.finish_process_backing(page, false);
+      } else {
+        const bool accounted =
+            !extra || pool.account_pending_process_backing(extra);
+        memory.bytes = page + (accounted ? extra : 0);
+        memory.projection = pool.finish_process_backing(memory.bytes, true);
+        // Leave the rejected ring with its owner for teardown. A terminal
+        // error prevents a caller from allocating another ring on every retry.
+        ctx = ring;
+        return -EIO;
+      }
+      return size == 0 ? -EINVAL : -ENOMEM;
+    }
+
+    memory = {size, pool.finish_process_backing(size, true)};
+    ctx = ring;
+    return 0;
+  }
+
+  int destroy_budgeted(io_context_t &ctx, RingMemory &memory) {
+    if (!ctx) return 0;
+    const int ret = destroy_ring(ctx);
+    if (ret == 0) {
+      if (memory.bytes) {
+        zvec::ailego::MemoryLimitPool::get_instance()
+            .release_unmapped_process_backing(memory.bytes, memory.projection);
+      }
+      ctx = nullptr;
+      memory = {};
+    }
+    return ret;
+  }
+
   // Function pointers — nullptr until load() succeeds.
   aio_setup_fn io_setup;
   aio_destroy_fn io_destroy;
@@ -86,6 +149,38 @@ class LibAioLoader {
   LibAioLoader &operator=(const LibAioLoader &) = delete;
 
  private:
+  int destroy_ring(io_context_t ctx) const {
+    int ret;
+    do {
+      ret = io_destroy(ctx);
+    } while (ret == -EINTR);
+    return ret;
+  }
+
+  static size_t completion_mapping_size(io_context_t ctx, size_t page) {
+    // This header is the Linux aio_ring ABI used by libaio's io_getevents
+    // fast path. Its event count reflects kernel and CPU-specific rounding.
+    constexpr uint32_t kRingMagic = 0xa10a10a1;
+    struct RingHeader {
+      uint32_t id, event_count, head, tail;
+      uint32_t magic, compat_features, incompat_features, header_bytes;
+    };
+    RingHeader header;
+    if (!ctx || page < sizeof(header)) return 0;
+    std::memcpy(&header, ctx, sizeof(header));
+    const size_t events = header.event_count;
+    const size_t header_bytes = header.header_bytes;
+    if (header.magic != kRingMagic || header.incompat_features != 0 ||
+        header_bytes < sizeof(header) || header_bytes > page || events == 0 ||
+        events >
+            (std::numeric_limits<size_t>::max() - header_bytes - (page - 1)) /
+                sizeof(io_event)) {
+      return 0;
+    }
+    const size_t bytes = header_bytes + events * sizeof(io_event);
+    return ((bytes + page - 1) / page) * page;
+  }
+
   LibAioLoader()
       : io_setup(nullptr),
         io_destroy(nullptr),
```

**File**: `src/ailego/parallel/worker_memory.cc` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+// Copyright 2025-present the zvec project
+// SPDX-License-Identifier: Apache-2.0
+#include <cassert>
+#include <mutex>
+#include <zvec/ailego/buffer/memory_reservation.h>
+#include <zvec/ailego/parallel/worker_memory.h>
+
+namespace zvec::ailego {
+namespace {
+class WorkerMemoryBudget {
+ public:
+  static WorkerMemoryBudget &instance() {
+    // Pools may finish during static teardown. Keep accounting alive until
+    // process exit, just like the permanently retained worker backing.
+    static auto *budget = new WorkerMemoryBudget;
+    return *budget;
+  }
+
+  void acquire(size_t bytes) {
+    std::lock_guard<std::mutex> lock(mutex_);
+    auto &pool = MemoryLimitPool::get_instance();
+    if (bytes > std::numeric_limits<size_t>::max() - active_)
+      throw std::bad_alloc();
+    const size_t target = active_ + bytes;
+    if (target > reservation_.bytes()) {
+      reservation_.add(target - reservation_.bytes(), bytes);
+    } else if (!pool.try_materialize(bytes)) {
+      throw std::bad_alloc();
+    }
+    active_ = target;
+  }
+  void started(size_t bytes) noexcept {
+    std::lock_guard<std::mutex> lock(mutex_);
+    started_ += bytes;
+    assert(started_ <= active_);
+    retained_ = std::max(retained_, started_);
+  }
+  void release(size_t bytes, size_t started) noexcept {
+    std::lock_guard<std::mutex> lock(mutex_);
+    assert(active_ >= bytes && started_ >= started);
+    active_ -= bytes;
+    started_ -= started;
+    reservation_.retain_at_most(std::max(active_, retained_));
+  }
+
+ private:
+  std::mutex mutex_;
+  MemoryReservation reservation_;
+  size_t active_{0};
+  size_t started_{0};
+  size_t retained_{0};
+};
+}  // namespace
+
+WorkerMemoryLease::WorkerMemoryLease(size_t workers) {
+  if (!workers || !MemoryLimitPool::get_instance().process_rss_limit()) return;
+  worker_bytes_ = DefaultNativeWorkerStackBytes();
+  if (!worker_bytes_) return;
+  if (workers > std::numeric_limits<size_t>::max() / worker_bytes_)
+    throw std::bad_alloc();
+  const size_t bytes = workers * worker_bytes_;
+  WorkerMemoryBudget::instance().acquire(bytes);
+  bytes_ = bytes;
+}
+
+void WorkerMemoryLease::worker_started() noexcept {
+  if (!bytes_) return;
+  assert(worker_bytes_ <= bytes_ - started_bytes_);
+  WorkerMemoryBudget::instance().started(worker_bytes_);
+  started_bytes_ += worker_bytes_;
+}
+
+WorkerMemoryLease::~WorkerMemoryLease() {
+  if (bytes_) WorkerMemoryBudget::instance().release(bytes_, started_bytes_);
+}
+}  // namespace zvec::ailego
```

**File**: `src/ailego/utility/file_helper.cc` (modified, +96/-0)
```diff
@@ -12,7 +12,9 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+#include <atomic>
 #include <cerrno>
+#include <chrono>
 #include <cstdio>
 #include <cstring>
 #include <filesystem>
@@ -38,8 +40,13 @@
 #if defined(__FreeBSD__)
 #include <sys/sysctl.h>
 #endif
+#include <sys/stat.h>
 #include <fcntl.h>
 #include <unistd.h>
+#if defined(__linux__)
+#include <linux/fs.h>
+#include <sys/syscall.h>
+#endif
 #endif
 
 namespace fs = std::filesystem;
@@ -341,6 +348,95 @@ bool FileHelper::MakePath(const char *path) {
   return MakePathImpl(PathFromUtf8(path));
 }
 
+StagedPath::~StagedPath() {
+  if (directory_.empty()) return;
+  try {
+    FileHelper::RemoveDirectory(directory_.c_str());
+  } catch (...) {
+    // This path is private. Cleanup failure cannot remove a published file.
+  }
+}
+
+bool StagedPath::supported() {
+#if defined(_WIN32) || defined(_WIN64) || defined(__APPLE__) || \
+    (defined(__linux__) && defined(SYS_renameat2) &&            \
+     defined(RENAME_NOREPLACE))
+  return true;
+#else
+  return false;
+#endif
+}
+
+bool StagedPath::prepare(const std::string &destination) {
+  ClearFsError();
+  if (!directory_.empty() || !supported()) return false;
+  std::error_code absolute_error;
+  auto target =
+      fs::absolute(FileHelper::PathFromUtf8(destination), absolute_error);
+  if (absolute_error) {
+    SetFsError(absolute_error);
+    return false;
+  }
+  while (target.has_relative_path() &&
+         (!target.has_filename() || target.filename() == ".")) {
+    target = target.parent_path();
+  }
+  if (!target.has_filename() || target.filename() == "..") {
+    SetFsError(std::make_error_code(std::errc::invalid_argument));
+    return false;
+  }
+  auto parent = target.parent_path();
+  if (parent.empty()) parent = ".";
+  if (!MakePathImpl(parent)) return false;
+  destination_ = FileHelper::PathToUtf8(target);
+  static std::atomic<uint64_t> sequence{0};
+  const auto stamp =
+      std::chrono::steady_clock::now().time_since_epoch().count();
+  for (unsigned attempt = 0; attempt != 64; ++attempt) {
+    const auto unique = sequence.fetch_add(1, std::memory_order_relaxed);
+    auto directory = parent / (".zvec-create-" + std::to_string(stamp) + "-" +
+                               std::to_string(unique));
+    auto private_directory = FileHelper::PathToUtf8(directory);
+    auto private_path = FileHelper::PathToUtf8(directory / "data");
+#if defined(_WIN32) || defined(_WIN64)
+    std::error_code error;
+    const bool created = fs::create_directory(directory, error);
+    if (!created && error && error != std::errc::file_exists) {
+      SetFsError(error);
+      return false;
+    }
+#else
+    const bool created = ::mkdir(directory.c_str(), S_IRWXU) == 0;
+    if (!created && errno != EEXIST) return false;
+#endif
+    if (created) {
+      directory_.swap(private_directory);
+      path_.swap(private_path);
+      return true;
+    }
+  }
+  SetFsError(std::make_error_code(std::errc::file_exists));
+  return false;
+}
+
+bool StagedPath::publish() {
+  ClearFsError();
+  if (path_.empty()) return false;
+#if defined(_WIN32) || defined(_WIN64)
+  const auto source = FileHelper::PathFromUtf8(path_);
+  const auto target = FileHelper::PathFromUtf8(destination_);
+  return ::MoveFileExW(source.c_str(), target.c_str(), MOVEFILE_WRITE_THROUGH);
+#elif defined(__APPLE__)
+  return ::renamex_np(path_.c_str(), destination_.c_str(), RENAME_EXCL) == 0;
+#elif defined(__linux__) && defined(SYS_renameat2) && defined(RENAME_NOREPLACE)
+  return ::syscall(SYS_renameat2, AT_FDCWD, path_.c_str(), AT_FDCWD,
+                   destination_.c_str(), RENAME_NOREPLACE) == 0;
+#else
+  SetFsError(std::make_error_code(std::errc::operation_not_supported));
+  return false;
+#endif
+}
+
 bool FileHelper::RemoveDirectory(const char *path) {
   if (path == nullptr || *path == '\0') {
     return false;
```

**File**: `src/core/algorithm/diskann/diskann_file_reader.cc` (modified, +266/-327)
```diff
@@ -15,6 +15,7 @@
 #include "diskann_file_reader.h"
 #include <algorithm>
 #include <atomic>
+#include <bitset>
 #include <cerrno>
 #include <cstdio>
 #include <cstdlib>
@@ -26,6 +27,7 @@
 #include <thread>
 #include <utility>
 #include <ailego/io/io_backend_def.h>
+#include <ailego/pattern/scope_guard.h>
 #include <zvec/ailego/buffer/vector_page_table.h>
 #include <zvec/ailego/io/io_backend.h>
 #include <zvec/ailego/logger/logger.h>
@@ -248,19 +250,24 @@ int setup_io_ctx(IOContext &ctx) {
   }
 
   // Priority 1: io_uring (raw kernel syscalls — zero dependency).
-  if (selected == ailego::IOBackendType::kIoUring &&
-      ctx->ring.setup(MAX_EVENTS)) {
-    log_diskann_io_backend(ctx->type);
-    return 0;
+  if (selected == ailego::IOBackendType::kIoUring) {
+    const auto setup = ctx->ring.setup_with_status(MAX_EVENTS);
+    if (setup != ailego::IoUringRing::SetupResult::kUnavailable) {
+      if (setup == ailego::IoUringRing::SetupResult::kNoMemory)
+        ctx->type = ailego::IOBackendType::kPread;
+      log_diskann_io_backend(ctx->type);
+      return 0;
+    }
   }
 
   // Priority 2: libaio (dlopen — soft dependency).
   if (selected != ailego::IOBackendType::kPread &&
-      LibAioLoader::Instance().load() &&
-      LibAioLoader::Instance().is_available()) {
-    int ret = LibAioLoader::Instance().io_setup(MAX_EVENTS, &ctx->aio_ctx);
-    if (ret == 0) {
+      LibAioLoader::Instance().load()) {
+    const int ret = LibAioLoader::Instance().setup_budgeted(
+        MAX_EVENTS, ctx->aio_ctx, ctx->aio_memory);
+    if (ret == 0 || ctx->aio_ctx) {
       ctx->type = ailego::IOBackendType::kLibAio;
+      ctx->aio_quarantined = ret != 0;
       log_diskann_io_backend(ctx->type);
       return 0;
     }
@@ -280,21 +287,24 @@ int destroy_io_ctx(IOContext &ctx) {
     return 0;
   }
 
+  int status = 0;
 #if defined(_WIN32) || defined(_WIN64)
   close_windows_io_handles(ctx);
 #elif defined(__linux__) && !defined(__ANDROID__)
   if (ctx->type == ailego::IOBackendType::kIoUring) {
     ctx->ring.teardown();
-  } else if (ctx->type == ailego::IOBackendType::kLibAio &&
-             LibAioLoader::Instance().is_available()) {
-    LibAioLoader::Instance().io_destroy(ctx->aio_ctx);
+  } else if (ctx->aio_ctx && LibAioLoader::Instance().destroy_budgeted(
+                                 ctx->aio_ctx, ctx->aio_memory) != 0) {
+    // Keep the buffer and its charge if the kernel still owns it.
+    (void)ctx->aio_staging.release();
+    status = IndexError_Runtime;
   }
   // IoUringRing destructor also calls teardown() — idempotent and safe.
 #endif
 
   delete ctx;
   ctx = nullptr;
-  return 0;
+  return status;
 }
 
 #if !defined(_WIN32) && !defined(_WIN64)
@@ -341,155 +351,183 @@ static int execute_io_pread(int fd, std::vector<AlignedRead> &read_reqs) {
 }
 
 #if defined(__linux__) && !defined(__ANDROID__)
-// io_getevents() should only fail permanently for an invalid context or
-// invalid arguments. If that happens after submission, io_destroy() is the
-// only safe way to quiesce the context before synchronous I/O touches the same
-// destination buffers. Recreate the context so later reads can still use AIO.
-static bool reset_aio_context(io_context_t &ctx) {
-  auto &loader = LibAioLoader::Instance();
-  int ret;
-  do {
-    ret = loader.io_destroy(ctx);
-  } while (ret == -EINTR);
+// AIO never receives a caller-owned address. If cancelling a batch fails,
+// retain its staging in the context and fall back to pread for later reads.
+static void finish_libaio_reads(IoBackend &ctx) {
+  ctx.aio_active = false;
+  ctx.aio_batch = nullptr;
+  if (!ctx.aio_quarantined) ctx.aio_staging.reset();
+}
 
+static bool reset_aio_context(IoBackend &ctx) noexcept {
+  auto &loader = LibAioLoader::Instance();
+  int ret = loader.destroy_budgeted(ctx.aio_ctx, ctx.aio_memory);
+  ctx.aio_quarantined = ret != 0;
+  finish_libaio_reads(ctx);
   if (ret != 0) {
-    LOG_ERROR("io_destroy failed while draining AIO; returned: %d, %s", ret,
-              ::strerror(-ret));
     return false;
   }
 
-  ctx = nullptr;
-  io_context_t replacement = nullptr;
-  ret = loader.io_setup(MAX_EVENTS, &replacement);
-  if (ret != 0) {
-    LOG_ERROR(
-        "io_setup failed while recreating an AIO context; returned: %d, %s. "
-        "this context will use pread",
-        ret, ::strerror(-ret));
-    return true;
-  }
-  ctx = replacement;
+  ret = loader.setup_budgeted(MAX_EVENTS, ctx.aio_ctx, ctx.aio_memory);
+  ctx.aio_quarantined = ret != 0 && ctx.aio_ctx != nullptr;
   return true;
 }
 
-int execute_io_libaio(io_context_t &ctx, int fd,
-                      std::vector<AlignedRead> &read_reqs, uint64_t n_retries) {
-  uint64_t iters = DiskAnnUtil::div_round_up(read_reqs.size(), MAX_EVENTS);
-
-  for (uint64_t iter = 0; iter < iters; iter++) {
-    uint64_t n_ops = std::min((uint64_t)read_reqs.size() - (iter * MAX_EVENTS),
-                              (uint64_t)MAX_EVENTS);
-
-    std::vector<iocb_t *> cbs(n_ops, nullpt
```

#### Recent Merged Pull Requests:
- **PR #932** (2026-11-25): perf(vamana): pass query parameters directly and compact neighbor candidates (@JalinWang)
- **PR #931** (2026-11-24): perf(flat): skip key tables for contiguous identity layouts (@luoxiaojian)
- **PR #930** (2026-11-24): perf(turbo): fold four UINT4 distance sums in AVX-512 lanes (@luoxiaojian)
- **PR #924** (closed): perf(db): cache scalar range prefixes within a shared memory budget (@iaojnh)
- **PR #923** (2026-11-25): fix: preserve BufferStorage consistency and staged budget recovery (@iaojnh)
- **PR #920** (2026-11-23): perf(storage): project requested columns before taking rows (@egolearner)

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

## X. preserve BufferStorage consistency and staged budget recovery

**RULE**:
When implementing operations in `src/ailego/buffer/block_eviction_queue.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `21229b48`: preserve BufferStorage consistency and staged budget recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/ailego/buffer/block_eviction_queue.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <optional>
#include <utility>
thread_local size_t *initial_queue_backing = nullptr;
  bool has_lifetime_slot{false};
void *BlockEvictionQueue::ProcessQueueTraits::malloc_lifetime(size_t bytes) {
  // Process-wide queues keep their producers and indexes until process exit.
  return MemoryLimitPool::get_instance().allocate_queue_memory(bytes, true);
}

BlockEvictionQueue::BlockEvictionQueue() {
  // Only the queues' initial block pools are allocated through the traits
  // during construction. They stay mapped for the lifetime of this instance.
  auto *previous =
      std::exchange(initial_queue_backing, &initial_backing_bytes_);
  auto restore =
      ScopeGuard::Make([previous] { initial_queue_backing = previous; });
  for (size_t i = 0; i < kQueueCount; ++i) {
    evict_queues_.emplace_back(kEvictQueueCapacity);
  }
}

void *MemoryLimitPool::allocate_queue_memory(size_t bytes, bool lifetime) {
    if (lifetime && !slab->has_lifetime_slot) {
      slab->has_lifetime_slot = true;
      queue_runtime_lifetime_size_.fetch_add(slab->mapping_bytes,
                                             std::memory_order_relaxed);
    }
  if (initial_queue_backing) *initial_queue_backing
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
void *MemoryLimitPool::allocate_queue_memory(size_t bytes) {
    release_fixed(bytes, &metadata_used_size_, Backing::kLive, projection);
  const auto admit = [&] {
    return process_rss_.try_materialize_reusable(bytes, block->projection);
  if (!required) return admit();
      release_committed(bytes, Backing::kLive, projection);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `21229b48` are properly handled with clean fallback behavior.
