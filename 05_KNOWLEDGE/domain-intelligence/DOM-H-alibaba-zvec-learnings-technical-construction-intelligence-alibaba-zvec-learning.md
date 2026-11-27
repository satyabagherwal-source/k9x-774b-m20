# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: alibaba-zvec-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "alibaba-zvec-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T13:36:58.555Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-alibaba-zvec-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba-zvec-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T13:36:58.555Z`  
> **Learning ID**: `LEARN-EVO-alibaba-zvec-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence)
- **Confidence Rating**: 80%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from alibaba-zvec-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source**: github ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Source Version**: `2b1e274d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T13:36:52.582Z  
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
> **Harvest Timestamp**: 2026-11-27T13:36:52.577Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/zvec`
- **Description**: A lightweight, lightning-fast, in-process vector database
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 16298 stars

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

### Incident Patch 1: `2b1e274d` (2026-11-27)
**Commit Message**: fix(diskann): separate read workspace from the page cache budget (#936)

**File**: `src/ailego/buffer/block_eviction_queue.cc` (modified, +25/-8)
```diff
@@ -1540,7 +1540,11 @@ size_t BlockEvictionQueue::cleanup_dead_entries(size_t max_attempts) {
 bool BlockEvictionQueue::add_single_block(const BlockType &block,
                                           int queue_index) {
   if (queue_index < 0 || queue_index >= static_cast<int>(kQueueCount)) {
-    LOG_ERROR("invalid eviction priority: %d", queue_index);
+    try {
+      LOG_ERROR("invalid eviction priority: %d", queue_index);
+    } catch (...) {
+      // A diagnostic must not interrupt the caller's queue recovery.
+    }
     return false;
   }
   BlockType queued = block;
@@ -1552,7 +1556,8 @@ bool BlockEvictionQueue::add_single_block(const BlockType &block,
   if (!ok) {
     approximate_queue_sizes_[queue_index].fetch_sub(1,
                                                     std::memory_order_relaxed);
-    LOG_DEBUG("Eviction queue enqueue rejected under allocation pressure.");
+    // Queue admission failed under memory pressure. Return that failure
+    // without allocating again to log it.
     return false;
   }
   return true;
@@ -1833,7 +1838,11 @@ MemoryLimitPool::PageAllocation MemoryLimitPool::acquire_slab_buffer(
   AlignedSlabMapping mapping = reserve_aligned_slab(page_size);
   if (mapping.base == nullptr) {
     release_fixed(page_size, &metadata_used_size_, Backing::kPending);
-    LOG_ERROR("MemoryLimitPool: failed to reserve an aligned slab");
+    try {
+      LOG_ERROR("MemoryLimitPool: failed to reserve an aligned slab");
+    } catch (...) {
+      // The caller must still cancel its payload reservation.
+    }
     return {nullptr, true};
   }
   ReclaimableSlab *slab = new (mapping.base) ReclaimableSlab(
@@ -2384,6 +2393,16 @@ bool MemoryLimitPool::try_acquire_buffer(size_t buffer_size, char *&buffer,
     return false;
   }
 
+  bool backing_reserved = false;
+  bool attempted_backing = true;
+  const auto rollback = ScopeGuard::Make([&] {
+    if (buffer) return;
+    if (backing_reserved) {
+      cancel_buffer_reservation(buffer_size, attempted_backing);
+    } else {
+      release_buffer(nullptr, buffer_size);
+    }
+  });
   if (cacheable) {
     buffer = pop_reusable_buffer(pick_shard(), buffer_size);
     if (buffer) {
@@ -2397,21 +2416,19 @@ bool MemoryLimitPool::try_acquire_buffer(size_t buffer_size, char *&buffer,
     // size, all currently visible free buffers were already checked above.
     trim_free_buffers(buffer_size);
     if (!try_reserve_committed(buffer_size, Backing::kPending)) {
-      release_buffer(nullptr, buffer_size);
       high_watermark_hits_.fetch_add(1, std::memory_order_relaxed);
       return false;
     }
   }
+  backing_reserved = true;
   const auto allocation =
       cacheable ? acquire_slab_buffer()
                 : PageAllocation{static_cast<char *>(ailego_aligned_malloc(
                                      buffer_size, kMinimumPageBytes)),
                                  true};
+  attempted_backing = allocation.attempted_backing;
   buffer = allocation.buffer;
-  if (!buffer) {
-    cancel_buffer_reservation(buffer_size, allocation.attempted_backing);
-    return false;
-  }
+  if (!buffer) return false;
   if (!cacheable) process_rss_.finish_reservation(buffer_size, true);
   alloc_from_slab_.fetch_add(1, std::memory_order_relaxed);
   return true;
```

**File**: `src/ailego/buffer/vector_page_table.cc` (modified, +54/-43)
```diff
@@ -21,6 +21,7 @@
 #include <cstring>
 #include <iterator>
 #include <thread>
+#include <utility>
 #include <ailego/pattern/defer.h>
 #include <ailego/pattern/scope_guard.h>
 #include <ailego/utility/memory_helper.h>
@@ -713,12 +714,12 @@ char *VectorPageTable::publish_claimed_block(block_id_t block_id, char *buffer,
   assert(buffer != nullptr);
   Entry &entry = entry_at(block_id);
   if (entry.ref_count.load(std::memory_order_acquire) != kLoadingRefCount) {
+    MemoryLimitPool::get_instance().release_buffer(buffer, kVectorPageSize);
     LOG_ERROR(
         "publish_claimed_block: block_id=%zu is not owned by a loader, "
         "state=%d",
         static_cast<size_t>(block_id),
         entry.ref_count.load(std::memory_order_relaxed));
-    MemoryLimitPool::get_instance().release_buffer(buffer, kVectorPageSize);
     return nullptr;
   }
 
@@ -2190,15 +2191,17 @@ VecBufferPool::ReadPageClaim VecBufferPool::claim_read_page(block_id_t id,
   const auto claim = page_table_.try_claim_block_load(id);
   if (claim != VectorPageTable::LoadClaimResult::kClaimed)
     return ReadPageClaim::kJoin;
+  bool claimed = false;
+  const auto rollback = ScopeGuard::Make([&] {
+    if (!claimed) cancel_read_page(id, std::exchange(buffer, nullptr));
+  });
   auto &memory = MemoryLimitPool::get_instance();
   if (!memory.try_acquire_buffer(kVectorPageSize, buffer)) {
     BlockEvictionQueue::get_instance().batch_recycle(1);
     (void)memory.try_acquire_buffer(kVectorPageSize, buffer);
   }
-  if (!buffer) {
-    (void)page_table_.cancel_block_load(id);
-    return ReadPageClaim::kBypass;
-  }
+  if (!buffer) return ReadPageClaim::kBypass;
+  claimed = true;
   miss_count_.fetch_add(1, std::memory_order_relaxed);
   return ReadPageClaim::kClaimed;
 }
@@ -2214,10 +2217,7 @@ void VecBufferPool::complete_read_page(block_id_t id, char *buffer,
   std::memcpy(buffer, data, kVectorPageSize);
   char *page =
       page_table_.publish_claimed_block(id, buffer, id * kVectorPageSize);
-  if (page)
-    page_table_.release_block(id);
-  else
-    cancel_read_page(id, buffer);
+  if (page) page_table_.release_block(id);
 }
 
 bool VecBufferPool::acquire_pages_impl(const block_id_t *page_ids, size_t count,
@@ -2227,20 +2227,20 @@ bool VecBufferPool::acquire_pages_impl(const block_id_t *page_ids, size_t count,
   if (!page_ids || !pages) return false;
 
   std::fill_n(pages, count, nullptr);
+  bool acquired_all = false;
+  const auto release_on_failure = ScopeGuard::Make([&] {
+    if (acquired_all) return;
+    for (size_t i = 0; i < count; ++i) {
+      if (std::exchange(pages[i], nullptr))
+        page_table_.release_block(page_ids[i]);
+    }
+  });
   std::array<block_id_t, kBlockingAioBatchSize> miss_batch{};
   size_t miss_count = 0;
 
   // Pin hits before I/O so eviction cannot reclaim them before delivery.
   for (size_t i = 0; i < count; ++i) {
-    if (page_ids[i] >= page_table_.entry_num()) {
-      for (size_t j = 0; j < i; ++j) {
-        if (pages[j]) {
-          page_table_.release_block(page_ids[j]);
-          pages[j] = nullptr;
-        }
-      }
-      return false;
-    }
+    if (page_ids[i] >= page_table_.entry_num()) return false;
     pages[i] = try_acquire_buffer(page_ids[i]);
     if (!pages[i]) {
       miss_batch[miss_count++] = page_ids[i];
@@ -2265,16 +2265,9 @@ bool VecBufferPool::acquire_pages_impl(const block_id_t *page_ids, size_t count,
     // leave the page in kLoadingRefCount while scanning the global queue.
     pages[i] = acquire_buffer(page_ids[i], retry, /*record_reuse=*/false,
                               allocation_failed);
-    if (!pages[i]) {
-      for (size_t j = 0; j < count; ++j) {
-        if (pages[j]) {
-          page_table_.release_block(page_ids[j]);
-          pages[j] = nullptr;
-        }
-      }
-      return false;
-    }
+    if (!pages[i]) return false;
   }
+  acquired_all = true;
   return true;
 }
 
@@ -3409,14 +3402,24 @@ VecBufferPool::PrepareResult VecBufferPool::prepare_pages_if_fits(
           VectorPageTable::LoadClaimResult::kClaimed)
         continue;
       char *buffer = nullptr;
-      if (!budget.try_acquire_buffer(kVectorPageSize, buffer)) {
-        (void)page_table_.cancel_block_load(id);
+      bool owns_claim = true;
+      const auto rollback = ScopeGuard::Make([&] {
+        if (owns_claim) cancel_read_page(id, buffer);
+      });
+      bool acquired = false;
+      try {
+        acquired = budget.try_acquire_buffer(kVectorPageSize, buffer);
+      } catch (const std::bad_alloc &) {
+        // Optional preparation can fall back to foreground reads.
+      }
+      if (!acquired) {
         result.status = PrepareStatus::kPressure;
         break;
       }
       std::memcpy(buffer, scratch.data() + (id - first) * kVectorPageSize,
                   kVectorPageSize);
       page_table_.promote_evict_priority(id, priority);
+      owns_claim = false;
       if (!page_table_.publish_claimed_block(id, buffer,
                           
```

**File**: `src/ailego/io/iouring_loader.cc` (modified, +171/-1)
```diff
@@ -26,6 +26,7 @@
 #include <ailego/io/iouring_loader.h>
 #include <ailego/pattern/scope_guard.h>
 #include <zvec/ailego/buffer/block_eviction_queue.h>
+#include <zvec/ailego/buffer/budgeted_buffer.h>
 #include <zvec/ailego/buffer/budgeted_mapped_buffer.h>
 #include <zvec/ailego/logger/logger.h>
 
@@ -36,6 +37,18 @@ namespace ailego {
 // returning EAGAIN/EBUSY (100 us sleep per retry, about one second total).
 static constexpr size_t kIoUringDrainRetries = 10000;
 
+struct IoUringRing::AsyncReads {
+  MemoryReservation memory;
+  struct Slot {
+    IoUringRead request;
+    size_t offset;
+    bool seen{false};
+  };
+  OptionalBudgetedVector<Slot> slots;
+  size_t submitted{0};
+  size_t completed{0};
+};
+
 IoUringRing::IoUringRing() = default;
 
 int IoUringRing::enter(unsigned submit, unsigned minimum, unsigned flags) {
@@ -44,6 +57,160 @@ int IoUringRing::enter(unsigned submit, unsigned minimum, unsigned flags) {
                                   minimum, flags, nullptr, size_t{0}));
 }
 
+bool IoUringRing::has_pending_reads() const {
+  return async_reads_ != nullptr;
+}
+
+int IoUringRing::submit_reads(int fd, const IoUringRead *reads, size_t count) {
+  if (async_reads_ || !is_valid() || !reads || count == 0 ||
+      count > std::min<size_t>(sq_entries_, kIoUringMaxBatch))
+    return -1;
+  try {
+    MemoryReservation memory;
+    std::unique_ptr<AsyncReads> state;
+    memory.add_for_allocation<false>(
+        sizeof(AsyncReads), [&] { state = std::make_unique<AsyncReads>(); });
+    state->memory.swap(memory);
+    state->slots.reserve(count);
+    size_t bytes = 0;
+    for (size_t i = 0; i < count; ++i) {
+      const auto &read = reads[i];
+      if (!read.buf || !read.len || read.offset % 512 || read.len % 512 ||
+          reinterpret_cast<uintptr_t>(read.buf) % 512 ||
+          read.len > std::numeric_limits<uint32_t>::max() ||
+          read.expected_len > read.len)
+        return -1;
+      const size_t size =
+          (read.len + kIoUringStagingAlign - 1) & ~(kIoUringStagingAlign - 1);
+      if (bytes > SIZE_MAX - size) return -1;
+      state->slots.push_back({read, bytes, false});
+      bytes += size;
+    }
+    if (!ensure_staging(bytes)) return -1;
+    const unsigned tail = __atomic_load_n(sq_tail_, __ATOMIC_ACQUIRE);
+    const unsigned mask = *sq_ring_mask_;
+    for (size_t i = 0; i < count; ++i) {
+      auto *sqe = &sqes_[sq_array_[(tail + i) & mask]];
+      io_uring_prep_read(sqe, fd, staging_ + state->slots[i].offset,
+                         static_cast<uint32_t>(reads[i].len), reads[i].offset);
+      sqe->user_data = i;
+    }
+    async_reads_ = std::move(state);
+    __atomic_store_n(sq_tail_, tail + static_cast<unsigned>(count),
+                     __ATOMIC_RELEASE);
+    size_t retries = 0;
+    while (async_reads_->submitted < count) {
+      const unsigned remaining = count - async_reads_->submitted;
+      const int ret = enter(remaining, 0, 0);
+      if (ret > 0 && static_cast<unsigned>(ret) <= remaining) {
+        async_reads_->submitted += ret;
+        retries = 0;
+        continue;
+      }
+      if ((ret == 0 || errno == EINTR || errno == EAGAIN || errno == EBUSY) &&
+          retries++ < 8)
+        continue;
+      // Remove the unsubmitted suffix before retiring accepted requests.
+      __atomic_store_n(sq_tail_, tail + async_reads_->submitted,
+                       __ATOMIC_RELEASE);
+      if (ret > 0) {
+        abandon_staging();
+        async_reads_.reset();
+        teardown();
+      } else {
+        cancel_reads();
+      }
+      return -1;
+    }
+    return 0;
+  } catch (const std::bad_alloc &) {
+    return -1;
+  }
+}
+
+int IoUringRing::reap_reads(size_t minimum, uint32_t *indices, size_t capacity,
+                            bool deliver) {
+  if (!async_reads_ || (capacity && !indices)) return -1;
+  auto &state = *async_reads_;
+  minimum = std::min({minimum, capacity, state.submitted - state.completed});
+  size_t count = 0;
+  for (;;) {
+    unsigned head = __atomic_load_n(cq_head_, __ATOMIC_ACQUIRE);
+    const unsigned tail = __atomic_load_n(cq_tail_, __ATOMIC_ACQUIRE);
+    while (head != tail && count < capacity) {
+      const auto event = cqes_[head & *cq_ring_mask_];
+      const size_t id = event.user_data;
+      if (id >= state.submitted || state.slots[id].seen) {
+        abandon_staging();
+        async_reads_.reset();
+        teardown();
+        return -1;
+      }
+      auto &slot = state.slots[id];
+      slot.seen = true;
+      ++state.completed;
+      ++head;
+      __atomic_store_n(cq_head_, head, __ATOMIC_RELEASE);
+      const auto &request = slot.request;
+      const size_t expected =
+          request.expected_len ? request.expected_len : request.len;
+      if (deliver &&
+          (event.res < 0 || static_cast<size_t>(event.res) != expected)) {
+        cancel_reads();
+        return -1;
+      }
+      if (deliver) {
+        std::memcpy(request.buf, staging_ + slot.offset, 
```

**File**: `src/ailego/io/iouring_loader.h` (modified, +13/-0)
```diff
@@ -31,6 +31,7 @@
 #include <cstddef>
 #include <cstdint>
 #include <cstdlib>
+#include <memory>
 #include <vector>
 #include <ailego/io/iouring_def.h>
 #include <zvec/ailego/buffer/process_rss_budget.h>
@@ -140,6 +141,14 @@ class IoUringRing {
     return execute(fd, read_reqs.data(), read_reqs.size());
   }
 
+  // One bounded batch may remain in flight while the caller computes.
+  // Requests are copied and the kernel only sees charged ring-owned staging.
+  // Destinations must remain alive until completion or cancel_reads().
+  int submit_reads(int fd, const IoUringRead *reads, size_t count);
+  int get_completed_reads(size_t minimum, uint32_t *indices, size_t capacity);
+  void cancel_reads();
+  bool has_pending_reads() const;
+
   // Execute a batch of aligned writes via io_uring. The call blocks until all
   // accepted requests have completed, but the requests execute concurrently
   // in the kernel. A quarantined write can still modify the file after return.
@@ -156,6 +165,10 @@ class IoUringRing {
   bool release_staging();
   int execute_impl(int fd, const IoUringRead *read_reqs,
                    const IoUringWrite *write_reqs, size_t count);
+  struct AsyncReads;
+  std::unique_ptr<AsyncReads> async_reads_;
+  int reap_reads(size_t minimum, uint32_t *indices, size_t capacity,
+                 bool deliver);
   int enter(unsigned submit, unsigned minimum, unsigned flags);
   int (*enter_override_)(int, unsigned, unsigned, unsigned){nullptr};
 
```

**File**: `src/core/algorithm/diskann/diskann_context.cc` (modified, +191/-48)
```diff
@@ -16,6 +16,7 @@
 #include <chrono>
 #include <new>
 #include "diskann_params.h"
+#include "diskann_result_payloads.h"
 #include "diskann_util.h"
 
 namespace zvec {
@@ -29,20 +30,182 @@ DiskAnnContext::DiskAnnContext(const IndexMeta &meta,
       dc_(entity.get(), meta, measure, data_quantizer),
       entity_{entity} {}
 
+DiskAnnContext::SearchResults::SearchResults(DiskAnnContext &context)
+    : context_(context) {
+  context_.clear_scratch();
+  context_.staged_results_ = this;
+}
+
+DiskAnnContext::SearchResults::~SearchResults() {
+  context_.staged_results_ = nullptr;
+  if (committed_) {
+    context_.release_result_scratch();
+  } else {
+    context_.clear_scratch(/*discard_slots=*/true);
+  }
+}
+
+void DiskAnnContext::SearchResults::commit() {
+  const auto publish = [](auto &current, auto &staged) {
+    // Grow before publishing any document. Swap individual lists so a caller
+    // that holds result(i) across searches can still use that reference.
+    current.resize(staged.size());
+    for (size_t i = 0; i < staged.size(); ++i) current[i].swap(staged[i]);
+  };
+  if (context_.group_by_search()) {
+    publish(context_.group_results_, group_results_);
+    for (auto &result : context_.results_) result.clear();
+  } else {
+    publish(context_.results_, results_);
+    for (auto &result : context_.group_results_) result.clear();
+  }
+  committed_ = true;
+}
+
+void DiskAnnContext::clear_scratch(bool discard_slots) {
+  const size_t capacity = candidate_vectors_.capacity();
+  release_result_scratch(
+      discard_slots ||
+      (capacity &&
+       (capacity / 2 > topk_ ||
+        ailego::MemoryLimitPool::get_instance().under_process_rss_pressure())));
+  best_list_nodes_.clear();
+  expanded_nodes_.clear();
+  visit_filter_.clear();
+  error_code_ = 0;
+}
+
+void DiskAnnContext::release_result_scratch(bool discard_slots) {
+  release_candidates();
+  topk_heap_.clear();
+  // Keep small allocations for reuse when the context returns to the pool.
+  constexpr size_t kRetainedEntries = 256;
+  auto &entries = topk_heap_.mutable_container();
+  if (entries.capacity() > kRetainedEntries) {
+    std::decay_t<decltype(entries)>{}.swap(entries);
+  }
+  if (discard_slots || candidate_vectors_.capacity() > kRetainedEntries) {
+    decltype(candidate_vectors_){}.swap(candidate_vectors_);
+  }
+  group_topk_heaps_.clear();
+}
+
+void DiskAnnContext::prepare_vector_candidates() {
+  // Prepay at most one sector of small result vectors. Under RSS pressure,
+  // or if the batch does not fit, allocate each slot only when needed.
+  const size_t bytes_per_slot = size_t{element_size_} + 1;
+  const size_t count =
+      std::min<size_t>(topk_, DiskAnnUtil::kSectorSize / bytes_per_slot);
+  auto &pool = ailego::MemoryLimitPool::get_instance();
+  if (count < 2 || element_size_ <= std::string{}.capacity() ||
+      pool.under_process_rss_pressure())
+    return;
+
+  const size_t maximum = 2 * count * bytes_per_slot;
+  if (!pool.try_reserve_process_backing(maximum)) return;
+  size_t bytes = 0;
+  try {
+    candidate_vectors_.resize(count);
+    for (auto &candidate : candidate_vectors_) {
+      candidate.bytes.resize(element_size_);
+      const size_t allocated = candidate.bytes.capacity() + 1;
+      if (allocated > maximum - bytes) throw std::bad_alloc();
+      bytes += allocated;
+    }
+  } catch (const std::bad_alloc &) {
+    candidate_vectors_.clear();
+    pool.finish_process_backing(maximum, false);
+    return;
+  }
+  const auto stamp = pool.finish_reserved_process_backing(maximum, bytes);
+  for (auto &candidate : candidate_vectors_) {
+    candidate.memory.adopt(candidate.bytes.capacity() + 1, stamp);
+  }
+}
+
+void DiskAnnContext::emplace_vector_candidate(diskann_id_t id, float score,
+                                              const void *src) {
+  if (topk_heap_.full() && !(score < topk_heap_.front().second.dist_)) return;
+  diskann_id_t slot =
+      topk_heap_.full() ? topk_heap_.front().second.vector_slot_ : kInvalidId;
+  if (slot == kInvalidId) {
+    if (candidate_vectors_.empty()) prepare_vector_candidates();
+    slot = candidate_slots_used_;
+    if (slot == candidate_vectors_.size()) {
+      auto &candidate = candidate_vectors_.emplace_back();
+      candidate.memory.resize(candidate.bytes, element_size_);
+    }
+    ++candidate_slots_used_;
+  }
+  std::memcpy(candidate_vectors_[slot].bytes.data(), src, element_size_);
+  topk_heap_.emplace(id, VectorInfo(score, slot));
+}
+
+void DiskAnnContext::topk_to_result(uint32_t idx) {
+  using Builder = TopkResultBuilder<DiskAnnContext, TopkHeap>;
+  if (!use_vector_candidates()) {
+    Builder::topk_to_result(idx);
+    return;
+  }
+  auto release = ailego::ScopeGuard::Make([&] { release_candidates(); });
+  candidate_vectors_.resize(candidate_slots_used_);
+  Builder::topk_to_single_result(
+      idx, [&](IndexDocumentList &docs, TopkHeap &heap, uint32_t size) {
+        uint32_t accepted = 0;
+        while (acc
```

**File**: `src/core/algorithm/diskann/diskann_context.h` (modified, +101/-45)
```diff
@@ -13,6 +13,7 @@
 // limitations under the License.
 #pragma once
 
+#include <zvec/ailego/buffer/budgeted_buffer.h>
 #include <zvec/core/framework/index_context.h>
 #include "utility/topk_result_builder.h"
 #include "diskann_dist_calculator.h"
@@ -62,7 +63,8 @@ class DiskAnnContext : public IndexContext,
   //! Create a lightweight context for reading vectors by id.
   static Pointer create_fetch_context(const IndexMeta &meta,
                                       const IndexMetric::Pointer &measure,
-                                      const DiskAnnEntity::Pointer &entity);
+                                      const DiskAnnEntity::Pointer &entity,
+                                      int *status = nullptr);
 
  public:
   //! Init
@@ -75,14 +77,37 @@ class DiskAnnContext : public IndexContext,
                      const DiskAnnEntity::Pointer &entity, uint32_t magic_num,
                      const turbo::Quantizer::Pointer &data_quantizer = nullptr);
 
+  class SearchResults {
+   public:
+    explicit SearchResults(DiskAnnContext &context);
+    ~SearchResults();
+    SearchResults(const SearchResults &) = delete;
+    SearchResults &operator=(const SearchResults &) = delete;
+
+    void commit();
+
+   private:
+    friend class DiskAnnContext;
+    DiskAnnContext &context_;
+    std::vector<IndexDocumentList> results_;
+    std::vector<IndexGroupDocumentList> group_results_;
+    bool committed_{false};
+  };
+
+  void swap_results(DiskAnnContext &other) noexcept {
+    results_.swap(other.results_);
+    group_results_.swap(other.group_results_);
+  }
+
   //! Retrieve search result
   const IndexDocumentList &result() const override {
-    return results_[0];
+    return result(0);
   }
 
   //! Retrieve search result
   const IndexDocumentList &result(size_t idx) const override {
-    return results_[idx];
+    static const IndexDocumentList empty;
+    return idx < results_.size() ? results_[idx] : empty;
   }
 
   //! Retrieve result object for output
@@ -93,12 +118,13 @@ class DiskAnnContext : public IndexContext,
 
   //! Retrieve search group result with index
   const IndexGroupDocumentList &group_result() const override {
-    return group_results_[0];
+    return group_result(0);
   }
 
   //! Retrieve search group result with index
   const IndexGroupDocumentList &group_result(size_t idx) const override {
-    return group_results_[idx];
+    static const IndexGroupDocumentList empty;
+    return idx < group_results_.size() ? group_results_[idx] : empty;
   }
 
   IndexGroupDocumentList *mutable_group_result() override {
@@ -143,7 +169,8 @@ class DiskAnnContext : public IndexContext,
   //! Set topk of search result
   void set_topk(uint32_t val) override {
     topk_ = val;
-    topk_heap_.limit(val);
+    topk_heap_.clear();
+    topk_heap_.limit_on_demand(val);
   }
 
   void set_list_size(uint32_t list_size) {
@@ -154,6 +181,10 @@ class DiskAnnContext : public IndexContext,
     fetch_vector_ = v;
   }
 
+  bool fetch_vector() const override {
+    return fetch_vector_;
+  }
+
   //! Get topk
   inline uint32_t topk() const override {
     return topk_;
@@ -186,12 +217,14 @@ class DiskAnnContext : public IndexContext,
     return coord_buffer_;
   }
 
+  int ensure_sector_buffer(size_t sectors);
+
   inline void *sector_buffer() {
-    return sector_buffer_;
+    return sector_buffer_.data();
   }
 
   inline size_t sector_buffer_size() const {
-    return sector_buffer_size_;
+    return sector_buffer_.size();
   }
 
   inline IOContext &io_ctx() {
@@ -204,43 +237,39 @@ class DiskAnnContext : public IndexContext,
 
   inline void resize_results(size_t size) {
     if (group_by_search()) {
-      group_results_.resize(size);
+      mutable_group_results().resize(size);
     } else {
-      results_.resize(size);
+      mutable_results().resize(size);
     }
   }
 
   inline bool error() const {
-    return has_error_;
+    return error_code_ != 0;
   }
 
   inline void set_error(bool err) {
-    has_error_ = err;
+    error_code_ = err ? IndexError_Runtime : 0;
   }
 
-  inline void clear() {
-    for (auto &it : results_) {
-      it.clear();
-    }
-    for (auto &it : group_results_) {
-      it.clear();
-    }
+  int error_code() const {
+    return error_code_;
+  }
 
-    best_list_nodes_.clear();
-    expanded_nodes_.clear();
-    visit_filter_.clear();
-    group_topk_heaps_.clear();
-    has_error_ = false;
+  void set_error_code(int status) {
+    error_code_ = status;
+  }
+
+  inline void clear() {
+    clear_scratch();
+    for (auto &it : results_) it.clear();
+    for (auto &it : group_results_) it.clear();
   }
 
   //! Preserve query-time options when replacing an incompatible pooled
-  //! context. Search scratch space and previous results are intentionally not
-  //! copied.
+  //! context. Search scratch space is always owned by the original context.
   void copy_query_options_from(const DiskAnnContext &rhs) {
     copy_common_query_options_from(rhs);
-    
```

**File**: `src/core/algorithm/diskann/diskann_dist_calculator.h` (modified, +61/-8)
```diff
@@ -15,12 +15,16 @@
 
 #include <memory>
 #include <vector>
+#include <ailego/pattern/scope_guard.h>
 #include <turbo/quantizer/quantizer.h>
 #include <zvec/ailego/utility/float_helper.h>
 #include <zvec/core/framework/index_context.h>
 #include <zvec/core/framework/index_factory.h>
 #include <zvec/core/framework/index_meta.h>
 #include "diskann_entity.h"
+#include "diskann_pq_read_batch.h"
+#include "diskann_resident_pq_batch.h"
+#include "diskann_visit_filter.h"
 
 namespace zvec {
 namespace core {
@@ -118,29 +122,74 @@ class DistCalculator {
     return dist(vec);
   }
 
-  inline void bind_quantizer(const turbo::Quantizer *quantizer,
-                             const uint8_t *codes, uint32_t code_size) {
+  void bind_quantizer(const turbo::Quantizer *quantizer, const uint8_t *codes,
+                      uint32_t code_size,
+                      IndexStorage::Segment::Pointer paged_codes = nullptr,
+                      ailego::VecBufferPool *pool = nullptr) {
     quantizer_ = quantizer;
     quant_codes_ = codes;
     quant_code_size_ = code_size;
+    paged_codes_ = std::move(paged_codes);
+    pq_pool_ = pool;
   }
 
-  int quantize_query(const void *query_rotated) {
+  int quantize_query(const void *query_rotated) try {
     if (!quantizer_ || !query_rotated) return IndexError_InvalidArgument;
     quant_query_scratch_.resize(quantizer_->quantized_query_vector_length());
     quantizer_->quantize_query(query_rotated, quant_query_scratch_.data());
     quant_dist_impl_ = quantizer_->distance(quant_query_scratch_.data(),
                                             quantizer_->quantized_query_meta());
     return quant_dist_impl_.valid() ? 0 : IndexError_Unsupported;
+  } catch (const std::bad_alloc &) {
+    return IndexError_NoMemory;
   }
 
-  void quantized_dist(const diskann_id_t *ids, uint32_t n, float *dists) {
+  int quantized_dist(const diskann_id_t *ids, uint32_t n, float *dists) try {
+    if (n == 0) return 0;
+    auto release =
+        ailego::ScopeGuard::Make([&] { resident_pq_batch_.release(); });
     quant_dp_list_.resize(n);
     for (uint32_t i = 0; i < n; ++i) {
-      quant_dp_list_[i] =
-          quant_codes_ + static_cast<size_t>(ids[i]) * quant_code_size_;
+      if (entity_ && ids[i] >= entity_->doc_cnt())
+        return IndexError_InvalidFormat;
+      if (!paged_codes_) {
+        if (!quant_codes_) return IndexError_NoReady;
+        quant_dp_list_[i] =
+            quant_codes_ + static_cast<size_t>(ids[i]) * quant_code_size_;
+      }
+    }
+    if (paged_codes_ &&
+        !(pq_pool_ && pq_pool_->cache_enabled() &&
+          resident_pq_batch_.read(*pq_pool_, *paged_codes_, ids, n,
+                                  quant_code_size_, quant_dp_list_, true))) {
+      const int status =
+          ReadPagedQuantizedCodes(*paged_codes_, ids, n, quant_code_size_,
+                                  quant_code_scratch_, quant_dp_list_.data());
+      if (status != 0) return status;
     }
     quant_dist_impl_.batch(quant_dp_list_.data(), n, dists);
+    return 0;
+  } catch (const std::bad_alloc &) {
+    return IndexError_NoMemory;
+  }
+
+  int quantized_dist_unvisited(const diskann_id_t *ids, uint32_t n,
+                               DiskAnnSearchVisitFilter &visited,
+                               DiskAnnReadVector<diskann_id_t> &unvisited,
+                               DiskAnnReadVector<float> &distances) try {
+    unvisited.clear();
+    for (uint32_t i = 0; i < n; ++i) {
+      if (entity_ && ids[i] >= entity_->doc_cnt())
+        return IndexError_InvalidFormat;
+      if (!visited.visited(ids[i])) {
+        visited.set_visited(ids[i]);
+        unvisited.push_back(ids[i]);
+      }
+    }
+    distances.resize(unvisited.size());
+    return quantized_dist(unvisited.data(), unvisited.size(), distances.data());
+  } catch (const std::bad_alloc &) {
+    return IndexError_NoMemory;
   }
 
   inline void clear() {
@@ -248,8 +297,12 @@ class DistCalculator {
 
   turbo::DistanceImpl quant_dist_impl_{};
 
-  std::vector<const void *> quant_dp_list_;
-  std::vector<uint8_t> quant_query_scratch_;
+  DiskAnnReadVector<const void *> quant_dp_list_;
+  DiskAnnReadVector<uint8_t> quant_query_scratch_;
+  DiskAnnReadVector<uint8_t> quant_code_scratch_;
+  IndexStorage::Segment::Pointer paged_codes_;
+  ailego::VecBufferPool *pq_pool_{nullptr};
+  ResidentPqBatch resident_pq_batch_;
 };
 
 }  // namespace core
```

**File**: `src/core/algorithm/diskann/diskann_entity.h` (modified, +20/-2)
```diff
@@ -15,6 +15,7 @@
 
 #include <utility>
 #include <zvec/core/framework/index_framework.h>
+#include "diskann_read_memory.h"
 
 namespace zvec {
 namespace core {
@@ -28,9 +29,11 @@ constexpr diskann_key_t kInvalidKey = static_cast<diskann_key_t>(-1);
 
 struct VectorInfo {
   float dist_;
+  diskann_id_t vector_slot_{kInvalidId};
   std::string vec_;
 
   VectorInfo() = default;
+  VectorInfo(float dist, diskann_id_t slot) : dist_{dist}, vector_slot_{slot} {}
   VectorInfo(float dist, const std::string &vec) : dist_{dist}, vec_{vec} {}
   VectorInfo(float dist, std::string &&vec)
       : dist_{dist}, vec_{std::move(vec)} {}
@@ -51,8 +54,10 @@ struct KeyValueVectorHeapComparer {
 
 /*! Key Value Vector Heap
  */
-using TopkHeap = ailego::Heap<std::pair<diskann_id_t, VectorInfo>,
-                              KeyValueVectorHeapComparer>;
+using TopkHeap =
+    ailego::Heap<std::pair<diskann_id_t, VectorInfo>,
+                 KeyValueVectorHeapComparer,
+                 DiskAnnReadVector<std::pair<diskann_id_t, VectorInfo>>>;
 
 struct DiskAnnMetaHeader {
  public:
@@ -173,6 +178,19 @@ class DiskAnnEntity {
   //! Get primary key of the node id
   virtual diskann_key_t get_key(diskann_id_t id) const = 0;
 
+  virtual int read_key(diskann_id_t id, diskann_key_t *key) const {
+    if (!key || id >= doc_cnt()) return IndexError_InvalidArgument;
+    *key = get_key(id);
+    return 0;
+  }
+
+  virtual int find_id(diskann_key_t key, diskann_id_t *id) const {
+    if (!id) return IndexError_InvalidArgument;
+    *id = get_id(key);
+    return 0;
+  }
+
+
  public:
   uint64_t max_node_size() const {
     return meta_header_.max_node_size;
```

#### Recent Merged Pull Requests:
- **PR #936** (2026-11-27): fix(diskann): separate read workspace from the page cache budget (@iaojnh)
- **PR #935** (2026-11-26): fix(pq): normalize inner-product scores and thresholds (@JalinWang)
- **PR #932** (2026-11-25): perf(vamana): pass query parameters directly and compact neighbor candidates (@JalinWang)
- **PR #931** (2026-11-24): perf(flat): skip key tables for contiguous identity layouts (@luoxiaojian)
- **PR #930** (2026-11-24): perf(turbo): fold four UINT4 distance sums in AVX-512 lanes (@luoxiaojian)
- **PR #929** (2026-11-26): perf(fts): reduce embedded Jieba startup time and memory use (@egolearner)

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

## X. diskann): separate read workspace from the page cache budget

**RULE**:
When implementing operations in `src/ailego/buffer/block_eviction_queue.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2b1e274d`: diskann): separate read workspace from the page cache budget. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/ailego/buffer/block_eviction_queue.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    try {
      LOG_ERROR("invalid eviction priority: %d", queue_index);
    } catch (...) {
      // A diagnostic must not interrupt the caller's queue recovery.
    }
    // Queue admission failed under memory pressure. Return that failure
    // without allocating again to log it.
    try {
      LOG_ERROR("MemoryLimitPool: failed to reserve an aligned slab");
    } catch (...) {
      // The caller must still cancel its payload reservation.
    }
  bool backing_reserved = false;
  bool attempted_backing = true;
  const auto rollback = ScopeGuard::Make([&] {
    if (buffer) return;
    if (backing_reserved) {
      cancel_buffer_reservation(buffer_size, attempted_backing);
    } else {
      release_buffer(nullptr, buffer_size);
    }
  });
  backing_reserved = true;
  attempted_backing = allocation.attempted_backing;
  if (!buffer) return false;
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    LOG_ERROR("invalid eviction priority: %d", queue_index);
    LOG_DEBUG("Eviction queue enqueue rejected under allocation pressure.");
    LOG_ERROR("MemoryLimitPool: failed to reserve an aligned slab");
      release_buffer(nullptr, buffer_size);
  if (!buffer) {
    cancel_buffer_reservation(buffer_size, allocation.attempted_backing);
    return false;
  }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2b1e274d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
