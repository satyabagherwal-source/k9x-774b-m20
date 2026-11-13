> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/arangodb-arangodb-learnings.md`  
> **Source**: github ([https://github.com/arangodb/arangodb](https://github.com/arangodb/arangodb))  
> **Source Version**: `5f9867e0`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T09:57:01.183Z  
> **Learning ID**: `learn-github-arangodb-arangodb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): arangodb/arangodb

> **Canonical Artifact**: `07_PROJECT_LEARNING/arangodb-arangodb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arangodb/arangodb](https://github.com/arangodb/arangodb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T09:57:01.171Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arangodb/arangodb`
- **Description**: 🥑 ArangoDB is a native multi-model database with flexible data models for documents, graphs, and key-values. Build high performance applications using a convenient SQL-like query language or JavaScript extensions.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 14297 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `3rdParty/fastText/src/utils.h`
```
/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include "real.h"

#include <algorithm>
#include <chrono>
#include <fstream>
#include <ostream>
#include <vector>

#if defined(__clang__) || defined(__GNUC__)
#define FASTTEXT_DEPRECATED(msg) __attribute__((__deprecated__(msg)))
#elif defined(_MSC_VER)
#define FASTTEXT_DEPRECATED(msg) __declspec(deprecated(msg))
#else
#define FASTTEXT_DEPRECATED(msg)
#endif

namespace fasttext {

using Predictions = std::vector<std::pair<real, int32_t>>;

namespace utils {

int64_t size(std::ifstream&);

void seek(std::ifstream&, int64_t);

template <typename T>
bool contains(const std::vector<T>& container, const T& value) {
  return std::find(container.begin(), container.end(), value) !=
      container.end();
}

template <typename T1, typename T2>
bool containsSecond(
    const std::vector<std::pair<T1, T2>>& container,
    const T2& value) {
  return std::find_if(
             container.begin(),
             container.end(),
             [&value](const std::pair<T1, T2>& item) {
               return item.second == value;
             }) != container.end();
}

double getDuration(
    const std::chrono::steady_clock::time_point& start,
    const std::chrono::steady_clock::time_point& end);

class ClockPrint {
 public:
  explicit ClockPrint(int32_t duration);
  friend std::ostream& operator<<(std::ostream& out, const ClockPrint& me);

 private:
  int32_t duration_;
};

bool compareFirstLess(const std::pair<double, double>& l, const double& r);

} // namespace utils

} // namespace fasttext

```

### Core Architecture Module: `3rdParty/fuerte/include/fuerte/loop.h`
```
////////////////////////////////////////////////////////////////////////////////
/// DISCLAIMER
///
/// Copyright 2016 ArangoDB GmbH, Cologne, Germany
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///
/// Copyright holder is ArangoDB GmbH, Cologne, Germany
///
/// @author Jan Christoph Uhde
/// @author Ewout Prangsma
////////////////////////////////////////////////////////////////////////////////
#pragma once

#ifndef ARANGO_CXX_DRIVER_SERVER
#define ARANGO_CXX_DRIVER_SERVER

#include <fuerte/asio_ns.h>

#include <memory>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>

// run / runWithWork / poll for Loop mapping to ioservice
// free function run with threads / with thread group barrier and work

namespace arangodb { namespace fuerte { inline namespace v1 {

// need partial rewrite so it can be better integrated in client applications

using asio_work_guard = asio_ns::executor_work_guard<asio_ns::io_context::executor_type>;

/// @brief EventLoopService implements single-threaded event loops
/// Idea is to shard connections across io context's to avoid
/// unnecessary synchronization overhead. Please note that on
/// linux epoll has max 64 instances, so there is a limit on the
/// number of io_context instances.
class EventLoopService {
 public:
  // Initialize an EventLoopService with a given number of threads
  //  and a given number of io_contexts
  explicit EventLoopService(unsigned int threadCount = 1,
                            char const* name = "");
  virtual ~EventLoopService();

  // Prevent copying
  EventLoopService(EventLoopService const& other) = delete;
  EventLoopService& operator=(EventLoopService const& other) = delete;

  // io_service returns a reference to the boost io_service.
  std::shared_ptr<asio_ns::io_context>& nextIOContext();

  asio_ns::ssl::context& sslContext();

  // stop and join threads
  void stop();

 private:
  /// number of last used io_context
  std::atomic<uint32_t> _lastUsed;

  /// protect ssl context creation
  std::mutex _sslContextMutex;
  /// global SSL context to use here
  std::unique_ptr<asio_ns::ssl::context> _sslContext;

  /// io contexts
  std::vector<std::shared_ptr<asio_ns::io_context>> _ioContexts;
  /// Threads powering each io_context
  std::vector<std::thread> _threads;
  /// Used to keep the io-context alive.
  std::vector<asio_work_guard> _guards;
};
}}}  // namespace arangodb::fuerte::v1
#endif

```

### Core Architecture Module: `3rdParty/fuerte/src/loop.cpp`
```
////////////////////////////////////////////////////////////////////////////////
/// DISCLAIMER
///
/// Copyright 2016 ArangoDB GmbH, Cologne, Germany
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///
/// Copyright holder is ArangoDB GmbH, Cologne, Germany
///
/// @author Jan Christoph Uhde
////////////////////////////////////////////////////////////////////////////////

#include <fuerte/loop.h>
#include <fuerte/types.h>

#include "debugging.h"

#include <memory>

#ifdef __linux__
#include <sys/prctl.h>
#endif

namespace arangodb { namespace fuerte { inline namespace v1 {

EventLoopService::EventLoopService(unsigned int threadCount, char const* name)
    : _lastUsed(0) {
  _ioContexts.reserve(threadCount);
  _guards.reserve(threadCount);
  _threads.reserve(threadCount);
  for (unsigned i = 0; i < threadCount; i++) {
    _ioContexts.emplace_back(std::make_shared<asio_ns::io_context>(1));
    _guards.emplace_back(asio_ns::make_work_guard(*_ioContexts.back()));
    asio_ns::io_context* ctx = _ioContexts.back().get();
    _threads.emplace_back([=]() {
#ifdef __linux__
      // set name of threadpool thread, so threads can be distinguished from
      // each other
      if (name != nullptr && *name != '\0') {
        prctl(PR_SET_NAME, name, 0, 0, 0);
      }
#endif
      ctx->run();
    });
  }
}

EventLoopService::~EventLoopService() { stop(); }
  
// io_service returns a reference to the boost io_service.
std::shared_ptr<asio_ns::io_context>& EventLoopService::nextIOContext() {
  FUERTE_ASSERT(!_ioContexts.empty());
  return _ioContexts[_lastUsed.fetch_add(1, std::memory_order_relaxed) %
                     _ioContexts.size()];
}

asio_ns::ssl::context& EventLoopService::sslContext() {
  std::lock_guard<std::mutex> guard(_sslContextMutex);
  if (!_sslContext) {
#if (OPENSSL_VERSION_NUMBER >= 0x10100000L)
    _sslContext = std::make_unique<asio_ns::ssl::context>(asio_ns::ssl::context::tls);
#else
    _sslContext = std::make_unique<asio_ns::ssl::context>(asio_ns::ssl::context::sslv23);
#endif
    _sslContext->set_default_verify_paths();
  }
  return *_sslContext;
}

void EventLoopService::stop() {
  // allow run() to exit, wait for threads to finish only then stop the context
  std::for_each(_guards.begin(), _guards.end(), [](auto& g) { g.reset(); });
  std::this_thread::sleep_for(std::chrono::milliseconds(50));
  std::for_each(_ioContexts.begin(), _ioContexts.end(),
                [](auto& c) { c->stop(); });
  std::this_thread::sleep_for(std::chrono::milliseconds(50));
  std::for_each(_threads.begin(), _threads.end(), [](auto& t) {
    if (t.joinable()) {
      t.join();
    }
  });
  _threads.clear();
  _ioContexts.clear();
  _guards.clear();
}

}}}  // namespace arangodb::fuerte::v1

```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/bytesinkutil.cpp`
```
// © 2017 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html

// bytesinkutil.cpp
// created: 2017sep14 Markus W. Scherer

#include "unicode/utypes.h"
#include "unicode/bytestream.h"
#include "unicode/edits.h"
#include "unicode/stringoptions.h"
#include "unicode/utf8.h"
#include "unicode/utf16.h"
#include "bytesinkutil.h"
#include "charstr.h"
#include "cmemory.h"
#include "uassert.h"

U_NAMESPACE_BEGIN

UBool
ByteSinkUtil::appendChange(int32_t length, const char16_t *s16, int32_t s16Length,
                           ByteSink &sink, Edits *edits, UErrorCode &errorCode) {
    if (U_FAILURE(errorCode)) { return FALSE; }
    char scratch[200];
    int32_t s8Length = 0;
    for (int32_t i = 0; i < s16Length;) {
        int32_t capacity;
        int32_t desiredCapacity = s16Length - i;
        if (desiredCapacity < (INT32_MAX / 3)) {
            desiredCapacity *= 3;  // max 3 UTF-8 bytes per UTF-16 code unit
        } else if (desiredCapacity < (INT32_MAX / 2)) {
            desiredCapacity *= 2;
        } else {
            desiredCapacity = INT32_MAX;
        }
        char *buffer = sink.GetAppendBuffer(U8_MAX_LENGTH, desiredCapacity,
                                            scratch, UPRV_LENGTHOF(scratch), &capacity);
        capacity -= U8_MAX_LENGTH - 1;
        int32_t j = 0;
        for (; i < s16Length && j < capacity;) {
            UChar32 c;
            U16_NEXT_UNSAFE(s16, i, c);
            U8_APPEND_UNSAFE(buffer, j, c);
        }
        if (j > (INT32_MAX - s8Length)) {
            errorCode = U_INDEX_OUTOFBOUNDS_ERROR;
            return FALSE;
        }
        sink.Append(buffer, j);
        s8Length += j;
    }
    if (edits != nullptr) {
        edits->addReplace(length, s8Length);
    }
    return TRUE;
}

UBool
ByteSinkUtil::appendChange(const uint8_t *s, const uint8_t *limit,
                           const char16_t *s16, int32_t s16Length,
                           ByteSink &sink, Edits *edits, UErrorCode &errorCode) {
    if (U_FAILURE(errorCode)) { return FALSE; }
    if ((limit - s) > INT32_MAX) {
        errorCode = U_INDEX_OUTOFBOUNDS_ERROR;
        return FALSE;
    }
    return appendChange((int32_t)(limit - s), s16, s16Length, sink, edits, errorCode);
}

void
ByteSinkUtil::appendCodePoint(int32_t length, UChar32 c, ByteSink &sink, Edits *edits) {
    char s8[U8_MAX_LENGTH];
    int32_t s8Length = 0;
    U8_APPEND_UNSAFE(s8, s8Length, c);
    if (edits != nullptr) {
        edits->addReplace(length, s8Length);
    }
    sink.Append(s8, s8Length);
}

namespace {

// See unicode/utf8.h U8_APPEND_UNSAFE().
inline uint8_t getTwoByteLead(UChar32 c) { return (uint8_t)((c >> 6) | 0xc0); }
inline uint8_t getTwoByteTrail(UChar32 c) { return (uint8_t)((c & 0x3f) | 0x80); }

}  // namespace

void
ByteSinkUtil::appendTwoBytes(UChar32 c, ByteSink &sink) {
    U_ASSERT(0x80 <= c && c <= 0x7ff);  // 2-byte UTF-8
    char s8[2] = { (char)getTwoByteLead(c), (char)getTwoByteTrail(c) };
    sink.Append(s8, 2);
}

void
ByteSinkUtil::appendNonEmptyUnchanged(const uint8_t *s, int32_t length,
                                      ByteSink &sink, uint32_t options, Edits *edits) {
    U_ASSERT(length > 0);
    if (edits != nullptr) {
        edits->addUnchanged(length);
    }
    if ((options & U_OMIT_UNCHANGED_TEXT) == 0) {
        sink.Append(reinterpret_cast<const char *>(s), length);
    }
}

UBool
ByteSinkUtil::appendUnchanged(const uint8_t *s, const uint8_t *limit,
                              ByteSink &sink, uint32_t options, Edits *edits,
                              UErrorCode &errorCode) {
    if (U_FAILURE(errorCode)) { return FALSE; }
    if ((limit - s) > INT32_MAX) {
        errorCode = U_INDEX_OUTOFBOUNDS_ERROR;
        return FALSE;
    }
    int32_t length = (int32_t)(limit - s);
    if (length > 0) {
        appendNonEmptyUnchanged(s, length, sink, options, edits);
    }
    return TRUE;
}

CharStringByteSink::CharStringByteSink(CharString* dest) : dest_(*dest) {
}

CharStringByteSink::~CharStringByteSink() = default;

void
CharStringByteSink::Append(const char* bytes, int32_t n) {
    UErrorCode status = U_ZERO_ERROR;
    dest_.append(bytes, n, status);
    // Any errors are silently ignored.
}

char*
CharStringByteSink::GetAppendBuffer(int32_t min_capacity,
                                    int32_t desired_capacity_hint,
                                    char* scratch,
                                    int32_t scratch_capacity,
                                    int32_t* result_capacity) {
    if (min_capacity < 1 || scratch_capacity < min_capacity) {
        *result_capacity = 0;
        return nullptr;
    }

    UErrorCode status = U_ZERO_ERROR;
    char* result = dest_.getAppendBuffer(
            min_capacity,
            desired_capacity_hint,
            *result_capacity,
            status);
    if (U_SUCCESS(status)) {
        return result;
    }

    *result_capacity = scratch_capacity;
    return scratch;
}

U_NAMESPACE_END

```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/bytesinkutil.h`
```
// © 2017 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html

// bytesinkutil.h
// created: 2017sep14 Markus W. Scherer

#include "unicode/utypes.h"
#include "unicode/bytestream.h"
#include "unicode/edits.h"
#include "cmemory.h"
#include "uassert.h"

U_NAMESPACE_BEGIN

class ByteSink;
class CharString;
class Edits;

class U_COMMON_API ByteSinkUtil {
public:
    ByteSinkUtil() = delete;  // all static

    /** (length) bytes were mapped to valid (s16, s16Length). */
    static UBool appendChange(int32_t length,
                              const char16_t *s16, int32_t s16Length,
                              ByteSink &sink, Edits *edits, UErrorCode &errorCode);

    /** The bytes at [s, limit[ were mapped to valid (s16, s16Length). */
    static UBool appendChange(const uint8_t *s, const uint8_t *limit,
                              const char16_t *s16, int32_t s16Length,
                              ByteSink &sink, Edits *edits, UErrorCode &errorCode);

    /** (length) bytes were mapped/changed to valid code point c. */
    static void appendCodePoint(int32_t length, UChar32 c, ByteSink &sink, Edits *edits = nullptr);

    /** The few bytes at [src, nextSrc[ were mapped/changed to valid code point c. */
    static inline void appendCodePoint(const uint8_t *src, const uint8_t *nextSrc, UChar32 c,
                                       ByteSink &sink, Edits *edits = nullptr) {
        appendCodePoint((int32_t)(nextSrc - src), c, sink, edits);
    }

    /** Append the two-byte character (U+0080..U+07FF). */
    static void appendTwoBytes(UChar32 c, ByteSink &sink);

    static UBool appendUnchanged(const uint8_t *s, int32_t length,
                                 ByteSink &sink, uint32_t options, Edits *edits,
                                 UErrorCode &errorCode) {
        if (U_FAILURE(errorCode)) { return FALSE; }
        if (length > 0) { appendNonEmptyUnchanged(s, length, sink, options, edits); }
        return TRUE;
    }

    static UBool appendUnchanged(const uint8_t *s, const uint8_t *limit,
                                 ByteSink &sink, uint32_t options, Edits *edits,
                                 UErrorCode &errorCode);

private:
    static void appendNonEmptyUnchanged(const uint8_t *s, int32_t length,
                                        ByteSink &sink, uint32_t options, Edits *edits);
};

class CharStringByteSink : public ByteSink {
public:
    CharStringByteSink(CharString* dest);
    ~CharStringByteSink() override;

    CharStringByteSink() = delete;
    CharStringByteSink(const CharStringByteSink&) = delete;
    CharStringByteSink& operator=(const CharStringByteSink&) = delete;

    void Append(const char* bytes, int32_t n) override;

    char* GetAppendBuffer(int32_t min_capacity,
                          int32_t desired_capacity_hint,
                          char* scratch,
                          int32_t scratch_capacity,
                          int32_t* result_capacity) override;

private:
    CharString& dest_;
};

U_NAMESPACE_END

```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/cpputils.h`
```
// © 2016 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html
/*
******************************************************************************
*
*   Copyright (C) 1997-2011, International Business Machines
*   Corporation and others.  All Rights Reserved.
*
******************************************************************************
*   file name:  cpputils.h
*   encoding:   UTF-8
*   tab size:   8 (not used)
*   indentation:4
*/

#ifndef CPPUTILS_H
#define CPPUTILS_H

#include "unicode/utypes.h"
#include "unicode/unistr.h"
#include "cmemory.h"

/*==========================================================================*/
/* Array copy utility functions */
/*==========================================================================*/

static
inline void uprv_arrayCopy(const double* src, double* dst, int32_t count)
{ uprv_memcpy(dst, src, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const double* src, int32_t srcStart,
              double* dst, int32_t dstStart, int32_t count)
{ uprv_memcpy(dst+dstStart, src+srcStart, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const int8_t* src, int8_t* dst, int32_t count)
    { uprv_memcpy(dst, src, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const int8_t* src, int32_t srcStart,
              int8_t* dst, int32_t dstStart, int32_t count)
{ uprv_memcpy(dst+dstStart, src+srcStart, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const int16_t* src, int16_t* dst, int32_t count)
{ uprv_memcpy(dst, src, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const int16_t* src, int32_t srcStart,
              int16_t* dst, int32_t dstStart, int32_t count)
{ uprv_memcpy(dst+dstStart, src+srcStart, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const int32_t* src, int32_t* dst, int32_t count)
{ uprv_memcpy(dst, src, (size_t)count * sizeof(*src)); }

static
inline void uprv_arrayCopy(const int32_t* src, int32_t srcStart,
              int32_t* dst, int32_t dstStart, int32_t count)
{ uprv_memcpy(dst+dstStart, src+srcStart, (size_t)count * sizeof(*src)); }

static
inline void
uprv_arrayCopy(const UChar *src, int32_t srcStart,
        UChar *dst, int32_t dstStart, int32_t count)
{ uprv_memcpy(dst+dstStart, src+srcStart, (size_t)count * sizeof(*src)); }

/**
 * Copy an array of UnicodeString OBJECTS (not pointers).
 * @internal
 */
static inline void
uprv_arrayCopy(const icu::UnicodeString *src, icu::UnicodeString *dst, int32_t count)
{ while(count-- > 0) *dst++ = *src++; }

/**
 * Copy an array of UnicodeString OBJECTS (not pointers).
 * @internal
 */
static inline void
uprv_arrayCopy(const icu::UnicodeString *src, int32_t srcStart,
               icu::UnicodeString *dst, int32_t dstStart, int32_t count)
{ uprv_arrayCopy(src+srcStart, dst+dstStart, count); }

/**
 * Checks that the string is readable and writable.
 * Sets U_ILLEGAL_ARGUMENT_ERROR if the string isBogus() or has an open getBuffer().
 */
inline void
uprv_checkCanGetBuffer(const icu::UnicodeString &s, UErrorCode &errorCode) {
    if(U_SUCCESS(errorCode) && s.isBogus()) {
        errorCode=U_ILLEGAL_ARGUMENT_ERROR;
    }
}

#endif /* _CPPUTILS */

```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/locutil.cpp`
```
// © 2016 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html
/*
 *******************************************************************************
 * Copyright (C) 2002-2014, International Business Machines Corporation and
 * others. All Rights Reserved.
 *******************************************************************************
 */
#include "unicode/utypes.h"

#if !UCONFIG_NO_SERVICE || !UCONFIG_NO_TRANSLITERATION

#include "unicode/resbund.h"
#include "unicode/uenum.h"
#include "cmemory.h"
#include "ustrfmt.h"
#include "locutil.h"
#include "charstr.h"
#include "ucln_cmn.h"
#include "uassert.h"
#include "umutex.h"

// see LocaleUtility::getAvailableLocaleNames
static icu::UInitOnce   LocaleUtilityInitOnce = U_INITONCE_INITIALIZER;
static icu::Hashtable * LocaleUtility_cache = NULL;

#define UNDERSCORE_CHAR ((UChar)0x005f)
#define AT_SIGN_CHAR    ((UChar)64)
#define PERIOD_CHAR     ((UChar)46)

/*
 ******************************************************************
 */

/**
 * Release all static memory held by Locale Utility.  
 */
U_CDECL_BEGIN
static UBool U_CALLCONV service_cleanup(void) {
    if (LocaleUtility_cache) {
        delete LocaleUtility_cache;
        LocaleUtility_cache = NULL;
    }
    return TRUE;
}


static void U_CALLCONV locale_utility_init(UErrorCode &status) {
    using namespace icu;
    U_ASSERT(LocaleUtility_cache == NULL);
    ucln_common_registerCleanup(UCLN_COMMON_SERVICE, service_cleanup);
    LocaleUtility_cache = new Hashtable(status);
    if (U_FAILURE(status)) {
        delete LocaleUtility_cache;
        LocaleUtility_cache = NULL;
        return;
    }
    if (LocaleUtility_cache == NULL) {
        status = U_MEMORY_ALLOCATION_ERROR;
        return;
    }
    LocaleUtility_cache->setValueDeleter(uhash_deleteHashtable);
}

U_CDECL_END

U_NAMESPACE_BEGIN

UnicodeString&
LocaleUtility::canonicalLocaleString(const UnicodeString* id, UnicodeString& result)
{
  if (id == NULL) {
    result.setToBogus();
  } else {
    // Fix case only (no other changes) up to the first '@' or '.' or
    // end of string, whichever comes first.  In 3.0 I changed this to
    // stop at first '@' or '.'.  It used to run out to the end of
    // string.  My fix makes the tests pass but is probably
    // structurally incorrect.  See below.  [alan 3.0]

    // TODO: Doug, you might want to revise this...
    result = *id;
    int32_t i = 0;
    int32_t end = result.indexOf(AT_SIGN_CHAR);
    int32_t n = result.indexOf(PERIOD_CHAR);
    if (n >= 0 && n < end) {
        end = n;
    }
    if (end < 0) {
        end = result.length();
    }
    n = result.indexOf(UNDERSCORE_CHAR);
    if (n < 0) {
      n = end;
    }
    for (; i < n; ++i) {
      UChar c = result.charAt(i);
      if (c >= 0x0041 && c <= 0x005a) {
        c += 0x20;
        result.setCharAt(i, c);
      }
    }
    for (n = end; i < n; ++i) {
      UChar c = result.charAt(i);
      if (c >= 0x0061 && c <= 0x007a) {
        c -= 0x20;
        result.setCharAt(i, c);
      }
    }
  }
  return result;

#if 0
    // This code does a proper full level 2 canonicalization of id.
    // It's nasty to go from UChar to char to char to UChar -- but
    // that's what you have to do to use the uloc_canonicalize
    // function on UnicodeStrings.

    // I ended up doing the alternate fix (see above) not for
    // performance reasons, although performance will certainly be
    // better, but because doing a full level 2 canonicalization
    // causes some tests to fail.  [alan 3.0]

    // TODO: Doug, you might want to revisit this...
    result.setToBogus();
    if (id != 0) {
        int32_t buflen = id->length() + 8; // space for NUL
        char* buf = (char*) uprv_malloc(buflen);
        char* canon = (buf == 0) ? 0 : (char*) uprv_malloc(buflen);
        if (buf != 0 && canon != 0) {
            U_ASSERT(id->extract(0, INT32_MAX, buf, buflen) < buflen);
            UErrorCode ec = U_ZERO_ERROR;
            uloc_canonicalize(buf, canon, buflen, &ec);
            if (U_SUCCESS(ec)) {
                result = UnicodeString(canon);
            }
        }
        uprv_free(buf);
        uprv_free(canon);
    }
    return result;
#endif
}

Locale&
LocaleUtility::initLocaleFromName(const UnicodeString& id, Locale& result)
{
    enum { BUFLEN = 128 }; // larger than ever needed

    if (id.isBogus() || id.length() >= BUFLEN) {
        result.setToBogus();
    } else {
        /*
         * We need to convert from a UnicodeString to char * in order to
         * create a Locale.
         *
         * Problem: Locale ID strings may contain '@' which is a variant
         * character and cannot be handled by invariant-character conversion.
         *
         * Hack: Since ICU code can handle locale IDs with multiple encodings
         * of '@' (at least for EBCDIC; it's not known to be a problem for
         * ASCII-based systems),
         * we use regular invariant-character conversion for everything else
         * and manually convert U+0040 into a compiler-char-constant '@'.
         * While this compilation-time constant may not match the runtime
         * encoding of '@', it should be one of the encodings which ICU
         * recognizes.
         *
         * There should be only at most one '@' in a locale ID.
         */
        char buffer[BUFLEN];
        int32_t prev, i;
        prev = 0;
        for(;;) {
            i = id.indexOf((UChar)0x40, prev);
            if(i < 0) {
                // no @ between prev and the rest of the string
                id.extract(prev, INT32_MAX, buffer + prev, BUFLEN - prev, US_INV);
                break; // done
            } else {
                // normal invariant-character conversion for text between @s
                id.extract(prev, i - prev, buffer + prev, BUFLEN - prev, US_INV);
                // manually "convert" U+0040 at id[i] into '@' at buffer[i]
                buffer[i] = '@';
                prev = i + 1;
            }
        }
        result = Locale::createFromName(buffer);
    }
    return result;
}

UnicodeString&
LocaleUtility::initNameFromLocale(const Locale& locale, UnicodeString& result)
{
    if (locale.isBogus()) {
        result.setToBogus();
    } else {
        result.append(UnicodeString(locale.getName(), -1, US_INV));
    }
    return result;
}

const Hashtable*
LocaleUtility::getAvailableLocaleNames(const UnicodeString& bundleID)
{
    // LocaleUtility_cache is a hash-of-hashes.  The top-level keys
    // are path strings ('bundleID') passed to
    // ures_openAvailableLocales.  The top-level values are
    // second-level hashes.  The second-level keys are result strings
    // from ures_openAvailableLocales.  The second-level values are
    // garbage ((void*)1 or other random pointer).

    UErrorCode status = U_ZERO_ERROR;
    umtx_initOnce(LocaleUtilityInitOnce, locale_utility_init, status);
    Hashtable *cache = LocaleUtility_cache;
    if (cache == NULL) {
        // Catastrophic failure.
        return NULL;
    }

    Hashtable* htp;
    umtx_lock(NULL);
    htp = (Hashtable*) cache->get(bundleID);
    umtx_unlock(NULL);

    if (htp == NULL) {
        htp = new Hashtable(status);
        if (htp && U_SUCCESS(status)) {
            CharString cbundleID;
            cbundleID.appendInvariantChars(bundleID, status);
            const char* path = cbundleID.isEmpty() ? NULL : cbundleID.data();
            icu::LocalUEnumerationPointer uenum(ures_openAvailableLocales(path, &status));
            for (;;) {
                const UChar* id = uenum_unext(uenum.getAlias(), NULL, &status);
                if (id == NULL) {
                    break;
                }
                htp->put(UnicodeString(id), (void*)htp, status);
            }
            if (U_FAILURE(status)) {
                delete htp;
                return NULL;
            }
            umtx_lock(NULL);
            Hashtable *t = static_cast<Hashtable *>(cache->get(bundleID));
            if (t != NULL) {
                // Another thread raced through this code, creating the cache entry first.
                // Discard ours and return theirs.
                umtx_unlock(NULL);
                delete htp;
                htp = t;
            } else {
                cache->put(bundleID, (void*)htp, status);
                umtx_unlock(NULL);
            }
        }
    }
    return htp;
}

UBool
LocaleUtility::isFallbackOf(const UnicodeString& root, const UnicodeString& child)
{
    return child.indexOf(root) == 0 &&
      (child.length() == root.length() ||
       child.charAt(root.length()) == UNDERSCORE_CHAR);
}

U_NAMESPACE_END

/* !UCONFIG_NO_SERVICE */
#endif



```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/locutil.h`
```
// © 2016 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html
/**
 *******************************************************************************
 * Copyright (C) 2002-2005, International Business Machines Corporation and    *
 * others. All Rights Reserved.                                                *
 *******************************************************************************
 *
 *******************************************************************************
 */
#ifndef LOCUTIL_H
#define LOCUTIL_H

#include "unicode/utypes.h"
#include "hash.h"

#if !UCONFIG_NO_SERVICE || !UCONFIG_NO_TRANSLITERATION


U_NAMESPACE_BEGIN

// temporary utility functions, till I know where to find them
// in header so tests can also access them

class U_COMMON_API LocaleUtility {
public:
  static UnicodeString& canonicalLocaleString(const UnicodeString* id, UnicodeString& result);
  static Locale& initLocaleFromName(const UnicodeString& id, Locale& result);
  static UnicodeString& initNameFromLocale(const Locale& locale, UnicodeString& result);
  static const Hashtable* getAvailableLocaleNames(const UnicodeString& bundleID);
  static UBool isFallbackOf(const UnicodeString& root, const UnicodeString& child);
};

U_NAMESPACE_END


#endif

#endif

```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/putil.cpp`
```
// © 2016 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html
/*
******************************************************************************
*
*   Copyright (C) 1997-2016, International Business Machines
*   Corporation and others.  All Rights Reserved.
*
******************************************************************************
*
*  FILE NAME : putil.c (previously putil.cpp and ptypes.cpp)
*
*   Date        Name        Description
*   04/14/97    aliu        Creation.
*   04/24/97    aliu        Added getDefaultDataDirectory() and
*                            getDefaultLocaleID().
*   04/28/97    aliu        Rewritten to assume Unix and apply general methods
*                            for assumed case.  Non-UNIX platforms must be
*                            special-cased.  Rewrote numeric methods dealing
*                            with NaN and Infinity to be platform independent
*                             over all IEEE 754 platforms.
*   05/13/97    aliu        Restored sign of timezone
*                            (semantics are hours West of GMT)
*   06/16/98    erm         Added IEEE_754 stuff, cleaned up isInfinite, isNan,
*                             nextDouble..
*   07/22/98    stephen     Added remainder, max, min, trunc
*   08/13/98    stephen     Added isNegativeInfinity, isPositiveInfinity
*   08/24/98    stephen     Added longBitsFromDouble
*   09/08/98    stephen     Minor changes for Mac Port
*   03/02/99    stephen     Removed openFile().  Added AS400 support.
*                            Fixed EBCDIC tables
*   04/15/99    stephen     Converted to C.
*   06/28/99    stephen     Removed mutex locking in u_isBigEndian().
*   08/04/99    jeffrey R.  Added OS/2 changes
*   11/15/99    helena      Integrated S/390 IEEE support.
*   04/26/01    Barry N.    OS/400 support for uprv_getDefaultLocaleID
*   08/15/01    Steven H.   OS/400 support for uprv_getDefaultCodepage
*   01/03/08    Steven L.   Fake Time Support
******************************************************************************
*/

// Defines _XOPEN_SOURCE for access to POSIX functions.
// Must be before any other #includes.
#include "uposixdefs.h"

// First, the platform type. Need this for U_PLATFORM.
#include "unicode/platform.h"

#if U_PLATFORM == U_PF_MINGW && defined __STRICT_ANSI__
/* tzset isn't defined in strict ANSI on MinGW. */
#undef __STRICT_ANSI__
#endif

/*
 * Cygwin with GCC requires inclusion of time.h after the above disabling strict asci mode statement.
 */
#include <time.h>

#if !U_PLATFORM_USES_ONLY_WIN32_API
#include <sys/time.h>
#endif

/* include the rest of the ICU headers */
#include "unicode/putil.h"
#include "unicode/ustring.h"
#include "putilimp.h"
#include "uassert.h"
#include "umutex.h"
#include "cmemory.h"
#include "cstring.h"
#include "locmap.h"
#include "ucln_cmn.h"
#include "charstr.h"

/* Include standard headers. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <locale.h>
#include <float.h>

#ifndef U_COMMON_IMPLEMENTATION
#error U_COMMON_IMPLEMENTATION not set - must be set for all ICU source files in common/ - see http://userguide.icu-project.org/howtouseicu
#endif


/* include system headers */
#if U_PLATFORM_USES_ONLY_WIN32_API
    /*
     * TODO: U_PLATFORM_USES_ONLY_WIN32_API includes MinGW.
     * Should Cygwin be included as well (U_PLATFORM_HAS_WIN32_API)
     * to use native APIs as much as possible?
     */
#ifndef WIN32_LEAN_AND_MEAN
#   define WIN32_LEAN_AND_MEAN
#endif
#   define VC_EXTRALEAN
#   define NOUSER
#   define NOSERVICE
#   define NOIME
#   define NOMCX
#   include <windows.h>
#   include "unicode/uloc.h"
#   include "wintz.h"
#elif U_PLATFORM == U_PF_OS400
#   include <float.h>
#   include <qusec.h>       /* error code structure */
#   include <qusrjobi.h>
#   include <qliept.h>      /* EPT_CALL macro  - this include must be after all other "QSYSINCs" */
#   include <mih/testptr.h> /* For uprv_maximumPtr */
#elif U_PLATFORM == U_PF_OS390
#   include "unicode/ucnv.h"   /* Needed for UCNV_SWAP_LFNL_OPTION_STRING */
#elif U_PLATFORM_IS_DARWIN_BASED || U_PLATFORM_IS_LINUX_BASED || U_PLATFORM == U_PF_BSD || U_PLATFORM == U_PF_SOLARIS
#   include <limits.h>
#   include <unistd.h>
#   if U_PLATFORM == U_PF_SOLARIS
#       ifndef _XPG4_2
#           define _XPG4_2
#       endif
#   endif
#elif U_PLATFORM == U_PF_QNX
#   include <sys/neutrino.h>
#endif

/*
 * Only include langinfo.h if we have a way to get the codeset. If we later
 * depend on more feature, we can test on U_HAVE_NL_LANGINFO.
 *
 */

#if U_HAVE_NL_LANGINFO_CODESET
#include <langinfo.h>
#endif

/**
 * Simple things (presence of functions, etc) should just go in configure.in and be added to
 * icucfg.h via autoheader.
 */
#if U_PLATFORM_IMPLEMENTS_POSIX
#   if U_PLATFORM == U_PF_OS400
#    define HAVE_DLFCN_H 0
#    define HAVE_DLOPEN 0
#   else
#   ifndef HAVE_DLFCN_H
#    define HAVE_DLFCN_H 1
#   endif
#   ifndef HAVE_DLOPEN
#    define HAVE_DLOPEN 1
#   endif
#   endif
#   ifndef HAVE_GETTIMEOFDAY
#    define HAVE_GETTIMEOFDAY 1
#   endif
#else
#   define HAVE_DLFCN_H 0
#   define HAVE_DLOPEN 0
#   define HAVE_GETTIMEOFDAY 0
#endif

U_NAMESPACE_USE

/* Define the extension for data files, again... */
#define DATA_TYPE "dat"

/* Leave this copyright notice here! */
static const char copyright[] = U_COPYRIGHT_STRING;

/* floating point implementations ------------------------------------------- */

/* We return QNAN rather than SNAN*/
#define SIGN 0x80000000U

/* Make it easy to define certain types of constants */
typedef union {
    int64_t i64; /* This must be defined first in order to allow the initialization to work. This is a C89 feature. */
    double d64;
} BitPatternConversion;
static const BitPatternConversion gNan = { (int64_t) INT64_C(0x7FF8000000000000) };
static const BitPatternConversion gInf = { (int64_t) INT64_C(0x7FF0000000000000) };

/*---------------------------------------------------------------------------
  Platform utilities
  Our general strategy is to assume we're on a POSIX platform.  Platforms which
  are non-POSIX must declare themselves so.  The default POSIX implementation
  will sometimes work for non-POSIX platforms as well (e.g., the NaN-related
  functions).
  ---------------------------------------------------------------------------*/

#if U_PLATFORM_USES_ONLY_WIN32_API || U_PLATFORM == U_PF_OS400
#   undef U_POSIX_LOCALE
#else
#   define U_POSIX_LOCALE    1
#endif

/*
    WARNING! u_topNBytesOfDouble and u_bottomNBytesOfDouble
    can't be properly optimized by the gcc compiler sometimes (i.e. gcc 3.2).
*/
#if !IEEE_754
static char*
u_topNBytesOfDouble(double* d, int n)
{
#if U_IS_BIG_ENDIAN
    return (char*)d;
#else
    return (char*)(d + 1) - n;
#endif
}

static char*
u_bottomNBytesOfDouble(double* d, int n)
{
#if U_IS_BIG_ENDIAN
    return (char*)(d + 1) - n;
#else
    return (char*)d;
#endif
}
#endif   /* !IEEE_754 */

#if IEEE_754
static UBool
u_signBit(double d) {
    uint8_t hiByte;
#if U_IS_BIG_ENDIAN
    hiByte = *(uint8_t *)&d;
#else
    hiByte = *(((uint8_t *)&d) + sizeof(double) - 1);
#endif
    return (hiByte & 0x80) != 0;
}
#endif



#if defined (U_DEBUG_FAKETIME)
/* Override the clock to test things without having to move the system clock.
 * Assumes POSIX gettimeofday() will function
 */
UDate fakeClock_t0 = 0; /** Time to start the clock from **/
UDate fakeClock_dt = 0; /** Offset (fake time - real time) **/
UBool fakeClock_set = FALSE; /** True if fake clock has spun up **/

static UDate getUTCtime_real() {
    struct timeval posixTime;
    gettimeofday(&posixTime, NULL);
    return (UDate)(((int64_t)posixTime.tv_sec * U_MILLIS_PER_SECOND) + (posixTime.tv_usec/1000));
}

static UDate getUTCtime_fake() {
    static UMutex fakeClockMutex = U_MUTEX_INTIALIZER;
    umtx_lock(&fakeClockMutex);
    if(!fakeClock_set) {
        UDate real = getUTCtime_real();
        const char *fake_start = getenv("U_FAKETIME_START");
        if((fake_start!=NULL) && (fake_start[0]!=0)) {
            sscanf(fake_start,"%lf",&fakeClock_t0);
            fakeClock_dt = fakeClock_t0 - real;
            fprintf(stderr,"U_DEBUG_FAKETIME was set at compile time, so the ICU clock will start at a preset value\n"
                    "env variable U_FAKETIME_START=%.0f (%s) for an offset of %.0f ms from the current time %.0f\n",
                    fakeClock_t0, fake_start, fakeClock_dt, real);
        } else {
          fakeClock_dt = 0;
            fprintf(stderr,"U_DEBUG_FAKETIME was set at compile time, but U_FAKETIME_START was not set.\n"
                    "Set U_FAKETIME_START to the number of milliseconds since 1/1/1970 to set the ICU clock.\n");
        }
        fakeClock_set = TRUE;
    }
    umtx_unlock(&fakeClockMutex);

    return getUTCtime_real() + fakeClock_dt;
}
#endif

#if U_PLATFORM_USES_ONLY_WIN32_API
typedef union {
    int64_t int64;
    FILETIME fileTime;
} FileTimeConversion;   /* This is like a ULARGE_INTEGER */

/* Number of 100 nanoseconds from 1/1/1601 to 1/1/1970 */
#define EPOCH_BIAS  INT64_C(116444736000000000)
#define HECTONANOSECOND_PER_MILLISECOND   10000

#endif

/*---------------------------------------------------------------------------
  Universal Implementations
  These are designed to work on all platforms.  Try these, and if they
  don't work on your platform, then special case your platform with new
  implementations.
---------------------------------------------------------------------------*/

U_CAPI UDate U_EXPORT2
uprv_getUTCtime()
{
#if defined(U_DEBUG_FAKETIME)
    return getUTCtime_fake(); /* Hook for overriding the clock */
#else
    return uprv_getRawUTCtime();
#endif
}

/* Return UTC (GMT) time measured in milliseconds since 0:00 on 1/1/70.*/
U_CAPI UDate U_EXPORT2
uprv_getRawUTCtime()
{
#if U_PLATFORM_USES_ONLY_WIN32_API

    FileTimeConversion winTime;
    GetSystemTimeAsFileTime(&winTime.fileTime);
    return (UDate)((winTime.int64 -
```

### Core Architecture Module: `3rdParty/icu-legacy/icu64/common/putilimp.h`
```
// © 2016 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html
/*
******************************************************************************
*
*   Copyright (C) 1997-2016, International Business Machines
*   Corporation and others.  All Rights Reserved.
*
******************************************************************************
*
*  FILE NAME : putilimp.h
*
*   Date        Name        Description
*   10/17/04    grhoten     Move internal functions from putil.h to this file.
******************************************************************************
*/

#ifndef PUTILIMP_H
#define PUTILIMP_H

#include "unicode/utypes.h"
#include "unicode/putil.h"

/**
 * \def U_SIGNED_RIGHT_SHIFT_IS_ARITHMETIC
 * Nearly all CPUs and compilers implement a right-shift of a signed integer
 * as an Arithmetic Shift Right which copies the sign bit (the Most Significant Bit (MSB))
 * into the vacated bits (sign extension).
 * For example, (int32_t)0xfff5fff3>>4 becomes 0xffff5fff and -1>>1=-1.
 *
 * This can be useful for storing a signed value in the upper bits
 * and another bit field in the lower bits.
 * The signed value can be retrieved by simple right-shifting.
 *
 * This is consistent with the Java language.
 *
 * However, the C standard allows compilers to implement a right-shift of a signed integer
 * as a Logical Shift Right which copies a 0 into the vacated bits.
 * For example, (int32_t)0xfff5fff3>>4 becomes 0x0fff5fff and -1>>1=0x7fffffff.
 *
 * Code that depends on the natural behavior should be guarded with this macro,
 * with an alternate path for unusual platforms.
 * @internal
 */
#ifdef U_SIGNED_RIGHT_SHIFT_IS_ARITHMETIC
    /* Use the predefined value. */
#else
    /*
     * Nearly all CPUs & compilers implement a right-shift of a signed integer
     * as an Arithmetic Shift Right (with sign extension).
     */
#   define U_SIGNED_RIGHT_SHIFT_IS_ARITHMETIC 1
#endif

/** Define this to 1 if your platform supports IEEE 754 floating point,
   to 0 if it does not. */
#ifndef IEEE_754
#   define IEEE_754 1
#endif

/**
 * uintptr_t is an optional part of the standard definitions in stdint.h.
 * The opengroup.org documentation for stdint.h says
 * "On XSI-conformant systems, the intptr_t and uintptr_t types are required;
 * otherwise, they are optional."
 * We assume that when uintptr_t is defined, UINTPTR_MAX is defined as well.
 *
 * Do not use ptrdiff_t since it is signed. size_t is unsigned.
 */
/* TODO: This check fails on some z environments. Filed a ticket #9357 for this. */
#if !defined(__intptr_t_defined) && !defined(UINTPTR_MAX) && (U_PLATFORM != U_PF_OS390)
typedef size_t uintptr_t;
#endif

/*===========================================================================*/
/** @{ Information about POSIX support                                       */
/*===========================================================================*/

#ifdef U_HAVE_NL_LANGINFO_CODESET
    /* Use the predefined value. */
#elif U_PLATFORM_USES_ONLY_WIN32_API || U_PLATFORM == U_PF_ANDROID || U_PLATFORM == U_PF_QNX
#   define U_HAVE_NL_LANGINFO_CODESET 0
#else
#   define U_HAVE_NL_LANGINFO_CODESET 1
#endif

#ifdef U_NL_LANGINFO_CODESET
    /* Use the predefined value. */
#elif !U_HAVE_NL_LANGINFO_CODESET
#   define U_NL_LANGINFO_CODESET -1
#elif U_PLATFORM == U_PF_OS400
   /* not defined */
#else
#   define U_NL_LANGINFO_CODESET CODESET
#endif

#if defined(U_TZSET) || defined(U_HAVE_TZSET)
    /* Use the predefined value. */
#elif U_PLATFORM_USES_ONLY_WIN32_API
    // UWP doesn't support tzset or environment variables for tz
#if U_PLATFORM_HAS_WINUWP_API == 0
#   define U_TZSET _tzset
#endif
#elif U_PLATFORM == U_PF_OS400
   /* not defined */
#else
#   define U_TZSET tzset
#endif

#if defined(U_TIMEZONE) || defined(U_HAVE_TIMEZONE)
    /* Use the predefined value. */
#elif U_PLATFORM == U_PF_ANDROID
#   define U_TIMEZONE timezone
#elif defined(__UCLIBC__)
    // uClibc does not have __timezone or _timezone.
#elif defined(_NEWLIB_VERSION)
#   define U_TIMEZONE _timezone
#elif defined(__GLIBC__)
    // glibc
#   define U_TIMEZONE __timezone
#elif U_PLATFORM_IS_LINUX_BASED
    // not defined
#elif U_PLATFORM_USES_ONLY_WIN32_API
#   define U_TIMEZONE _timezone
#elif U_PLATFORM == U_PF_BSD && !defined(__NetBSD__)
   /* not defined */
#elif U_PLATFORM == U_PF_OS400
   /* not defined */
#elif U_PLATFORM == U_PF_IPHONE
   /* not defined */
#else
#   define U_TIMEZONE timezone
#endif

#if defined(U_TZNAME) || defined(U_HAVE_TZNAME)
    /* Use the predefined value. */
#elif U_PLATFORM_USES_ONLY_WIN32_API
    /* not usable on all windows platforms */
#if U_PLATFORM_HAS_WINUWP_API == 0
#   define U_TZNAME _tzname
#endif
#elif U_PLATFORM == U_PF_OS400
   /* not defined */
#else
#   define U_TZNAME tzname
#endif

#ifdef U_HAVE_MMAP
    /* Use the predefined value. */
#elif U_PLATFORM_USES_ONLY_WIN32_API
#   define U_HAVE_MMAP 0
#else
#   define U_HAVE_MMAP 1
#endif

#ifdef U_HAVE_POPEN
    /* Use the predefined value. */
#elif U_PLATFORM_USES_ONLY_WIN32_API
#   define U_HAVE_POPEN 0
#elif U_PLATFORM == U_PF_OS400
#   define U_HAVE_POPEN 0
#else
#   define U_HAVE_POPEN 1
#endif

/**
 * \def U_HAVE_DIRENT_H
 * Defines whether dirent.h is available.
 * @internal
 */
#ifdef U_HAVE_DIRENT_H
    /* Use the predefined value. */
#elif U_PLATFORM_USES_ONLY_WIN32_API
#   define U_HAVE_DIRENT_H 0
#else
#   define U_HAVE_DIRENT_H 1
#endif

/** @} */

/*===========================================================================*/
/** @{ GCC built in functions for atomic memory operations                   */
/*===========================================================================*/

/**
 * \def U_HAVE_GCC_ATOMICS
 * @internal
 */
#ifdef U_HAVE_GCC_ATOMICS
    /* Use the predefined value. */
#elif U_PLATFORM == U_PF_MINGW
    #define U_HAVE_GCC_ATOMICS 0
#elif U_GCC_MAJOR_MINOR >= 404 || defined(__clang__)
    /* TODO: Intel icc and IBM xlc on AIX also support gcc atomics.  (Intel originated them.)
     *       Add them for these compilers.
     * Note: Clang sets __GNUC__ defines for version 4.2, so misses the 4.4 test here.
     */
#   define U_HAVE_GCC_ATOMICS 1
#else
#   define U_HAVE_GCC_ATOMICS 0
#endif

/** @} */

/**
 * \def U_HAVE_STD_ATOMICS
 * Defines whether to use the C++11 std::atomic functions.
 * If false, ICU will fall back to compiler or platform specific alternatives.
 * Note: support for these fall back options for atomics will be removed in a future version
 *       of ICU, and the use of C++ 11 atomics will be required.
 * @internal
 */
#ifdef U_HAVE_STD_ATOMICS
    /* Use the predefined value. */
#else
#    define U_HAVE_STD_ATOMICS 1
#endif

/**
 *  \def U_HAVE_CLANG_ATOMICS
 *  Defines whether Clang c11 style built-in atomics are available.
 *  These are used in preference to gcc atomics when both are available.
 */
#ifdef U_HAVE_CLANG_ATOMICS
    /* Use the predefined value. */
#elif __has_builtin(__c11_atomic_load) && \
    __has_builtin(__c11_atomic_store) && \
    __has_builtin(__c11_atomic_fetch_add) && \
    __has_builtin(__c11_atomic_fetch_sub)
#    define U_HAVE_CLANG_ATOMICS 1
#else
#    define U_HAVE_CLANG_ATOMICS 0
#endif


/**
 * \def U_HAVE_STD_MUTEX
 * Defines whether to use the C++11 std::mutex functions.
 * If false, ICU will fall back to compiler or platform specific alternatives.
 * std::mutex is preferred, and used by default unless this setting is overridden.
 * Note: support for other options for mutexes will be removed in a future version
 *       of ICU, and the use of std::mutex will be required.
 * @internal
 */
#ifdef U_HAVE_STD_MUTEX
    /* Use the predefined value. */
#else
#    define U_HAVE_STD_MUTEX 1
#endif

/*===========================================================================*/
/** @{ Programs used by ICU code                                             */
/*===========================================================================*/

/**
 * \def U_MAKE_IS_NMAKE
 * Defines whether the "make" program is Windows nmake.
 */
#ifdef U_MAKE_IS_NMAKE
    /* Use the predefined value. */
#elif U_PLATFORM == U_PF_WINDOWS
#   define U_MAKE_IS_NMAKE 1
#else
#   define U_MAKE_IS_NMAKE 0
#endif

/** @} */

/*==========================================================================*/
/* Platform utilities                                                       */
/*==========================================================================*/

/**
 * Platform utilities isolates the platform dependencies of the
 * library.  For each platform which this code is ported to, these
 * functions may have to be re-implemented.
 */

/**
 * Floating point utility to determine if a double is Not a Number (NaN).
 * @internal
 */
U_INTERNAL UBool   U_EXPORT2 uprv_isNaN(double d);
/**
 * Floating point utility to determine if a double has an infinite value.
 * @internal
 */
U_INTERNAL UBool   U_EXPORT2 uprv_isInfinite(double d);
/**
 * Floating point utility to determine if a double has a positive infinite value.
 * @internal
 */
U_INTERNAL UBool   U_EXPORT2 uprv_isPositiveInfinity(double d);
/**
 * Floating point utility to determine if a double has a negative infinite value.
 * @internal
 */
U_INTERNAL UBool   U_EXPORT2 uprv_isNegativeInfinity(double d);
/**
 * Floating point utility that returns a Not a Number (NaN) value.
 * @internal
 */
U_INTERNAL double  U_EXPORT2 uprv_getNaN(void);
/**
 * Floating point utility that returns an infinite value.
 * @internal
 */
U_INTERNAL double  U_EXPORT2 uprv_getInfinity(void);

/**
 * Floating point utility to truncate a double.
 * @internal
 */
U_INTERNAL double  U_EXPORT2 uprv_trunc(double d);
/**
 * Floating point utility to calculate the floor of a double.
 * @internal
 */
U_INTERNAL double  U_EXPORT2 uprv_floor(double d);
/**
 * Floating point utility to calculate the ceiling of a double.
 * @internal
 */
U_INTERNAL double  U_EXPORT2 uprv_ceil(double d);
/**
 * Floating point utility to calculate the absolute value of a
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23660** (2026-11-13): **Remove unused security-governance job from the lint workflow of testing pipeline**
  *Symptoms*: ### Scope & Purpose  Remove the `security-governance` job from the `lint` workflow of the testing pipeline. It ran the Trivy disposition check and checked `.circleci/required-checks.txt` against the live branch protection.  - `.circleci/base_config.yml`: drop the job, its `lint` workflow entry and the `trivy-scan` orb import, which only this job used. - `.circleci/required-checks.txt`: deleted, nothing else reads it.  Unaffected: the nightly-packages pipeline keeps its own `trivy-scan` orb and Trivy gates, and merge gating doesn't change (`lint` is not a required check).  - [x] :hammer: Refactoring/simplification  ### Checklist  - [x] Backports   - [x] Backport for 3.12: https://github.com/arangodb/arangodb/pull/23659

- **Issue #23659** (2026-11-13): **[3.12] Remove unused security-governance job from the lint workflow of testing pipeline**
  *Symptoms*: ### Scope & Purpose  Remove the `security-governance` job from the `lint` workflow of the testing pipeline. It ran the Trivy disposition check and checked `.circleci/required-checks.txt` against the live branch protection.  - `.circleci/base_config.yml`: drop the job, its `lint` workflow entry and the `trivy-scan` orb import, which only this job used. - `.circleci/required-checks.txt`: deleted, nothing else reads it.  Unaffected: the nightly-packages pipeline keeps its own `trivy-scan` orb and Trivy gates, and merge gating doesn't change (`lint` is not a required check).  - [x] :hammer: Refactoring/simplification

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

### Incident Patch 1: `204e1692` (2026-11-13)
**Commit Message**: Remove unused security-governance job from the lint workflow of testing pipeline (#23660)

**File**: `.circleci/base_config.yml` (modified, +0/-166)
```diff
@@ -3,9 +3,6 @@ version: 2.1
 orbs:
   aws-cli: circleci/aws-cli@4.1.1
   aws-ecr: circleci/aws-ecr@9.0.1
-  # Exact pin: a floating orb range silently changes what runs. Keep in
-  # sync with base_nightly_packages.yml.
-  trivy-scan: arangodb/trivy-scan@1
 
 parameters:
   enterprise-commit:
@@ -747,164 +744,6 @@ jobs:
               echo "Nothing to cancel"
             fi
 
-  # PR-time lint of what governs the nightly security gates: disposition
-  # hygiene and the required-status-check inventory.
-  security-governance:
-    docker:
-      - image: cimg/base:current
-    resource_class: small
-    steps:
-      - attach_workspace:
-          at: .
-      # No suppression files exist here today; this keeps any future one
-      # dated and in-window. poam-windows matches the trivy-gate-waivers
-      # table; nosem-exclude skips vendored trees.
-      - trivy-scan/disposition-check:
-          poam-windows: "critical=30,high=30,medium=90,low=180"
-          nosem-exclude: ":!:.circleci/* :!:3rdParty/* :!:*/node_modules/*"
-      - run:
-          name: Compare required checks against the live configuration
-          environment:
-            # "true" anywhere in here marks a variant pipeline, which renames
-            # the build workflows by design (generate_config.py appends the
-            # variant to the workflow name).
-            PIPELINE_VARIANTS: "<< pipeline.parameters.with-tsan >>,<< pipeline.parameters.with-alubsan >>,<< pipeline.parameters.full >>,<< pipeline.parameters.replication-two >>"
-          command: |
-            set -eu
-            set -o pipefail
-            LIST=.circleci/required-checks.txt
-            # PR pipelines run on the head branch, so the protected branch
-            # cannot be derived from CIRCLE_BRANCH.
-            PROTECTED=devel
-            DRIFT=0
-            if [ ! -s "${LIST}" ]; then
-              echo "ERROR: ${LIST} is missing or empty. Commit the required-check inventory." >&2
-              exit 1
-            fi
-            # || true: grep exits 1 on a comments-only list; that is reported
-            # as an error on the next line, not as a pipefail abort here.
-            grep -vE '^[[:space:]]*(#|$)' "${LIST}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | sort -u > /tmp/required-expected.txt || true
-            if [ ! -s /tmp/required-expected.txt ]; then
-              echo "ERROR: ${LIST} lists no contexts." >&2
-              exit 1
-            fi
-            echo "Committed required contexts (${LIST}):"
-            sed -e 's/^/  /' /tmp/required-expected.txt
-            # Live GitHub side. Branch protection needs an administration:read
-            # token, rulesets only a repo token, so both are consulted. No
-            # token means UNVERIFIED, never "no drift".
-            : > /tmp/required-live.txt
-            LIVE_SOURCE=""
-            PROT_OK=0
-            if [ -n "${GITHUB_TOKEN:-}" ]; then
-              GH_API="https://api.github.com/repos/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}"
-              for ENDPOINT in "branches/${PROTECTED}/protection" "rules/branches/${PROTECTED}"; do
-                if curl -sSfL --retry 3 --retry-delay 2 --max-time 60 \
-                     -H "Authorization: Bearer ${GITHUB_TOKEN}" \
-                     -H "Accept: application/vnd.github+json" \
-                     -H "X-GitHub-Api-Version: 2022-11-28" \
-                     -o /tmp/gh-rules.json "${GH_API}/${ENDPOINT}"; then
-                  # grep/sed: heredocs collide with CircleCI parameter
-                  # syntax; "context" only appears in required checks.
-                  grep -oE '"context":[[:space:]]*"[^"]*"' /tmp/gh-rules.json \
-                    | sed -e 's/.*"\([^"]*\)"$/\1/' | sort -u >> /tmp/required-live.txt || true
-                  LIVE_SOURCE="${LIVE_SOURCE}${LIVE_SOURCE:+, }${ENDPOINT}"
-                  if [ "${ENDPOINT}" = "branches/${PROTECTED}/protection" ]; then
-                    PROT_OK=1
-                  fi
-                else
-                  echo "NOTICE: could not read ${ENDPOINT} (token scope?), that surface is unverified on this run." >&2
-                fi
-              done
-            elif [ -n "${CIRCLE_PR_REPONAME:-}" ]; then
-              echo "NOTICE: forked PR, no GITHUB_TOKEN; the live GitHub configuration is unverified on this run." >&2
-            else
-              echo "NOTICE: GITHUB_TOKEN is not set; the live GitHub configuration stays UNVERIFIED until a context with a read-only administration:read token is attached." >&2
-            fi
-            # Compare only when a surface that can carry required contexts
-            # answered: an empty read off the rulesets endpoint alone is a
-            # token-scope gap, not proof that nothing is required.
-            if [ -n "${LIVE_SOURCE}" ] && { [ "${PROT_OK}" = "1" ] || [ -s /tmp/required-live.txt ]; }; then
-              sort -u /tmp/required-live.txt -o /tmp/required-live.tx
```

**File**: `.circleci/required-checks.txt` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-# Required status checks for merging into devel, one context per line.
-# security-governance compares this list against live branch protection and
-# against the workflows a real pipeline emits; drift in either direction is
-# a broken merge gate. Read off the live configuration, never hand-derived;
-# GitHub sees one check per CircleCI workflow, so these are workflow names.
-# The Trivy gates live in the nightly-packages pipeline. They fail that
-# workflow but block neither the merge nor the nightly publish.
-
-aarch64-pr
-x64-pr
```

---

### Incident Patch 2: `fbbdcbfe` (2026-11-12)
**Commit Message**: Merge pull request #23638 from arangodb/bug-fix/re-enable-tests-for-arm

BTS-2363: re-enable test



---

### Incident Patch 3: `5f4fcc20` (2026-11-10)
**Commit Message**: COR-1263: NGRAM_MATCH fix for extra counting issue

**File**: `arangod/Aql/Function/NGramFunctions.cpp` (modified, +7/-1)
```diff
@@ -220,9 +220,15 @@ AqlValue functions::NgramMatch(ExpressionContext* ctx, AstNode const&,
   if (!targetNgrams.empty() && !attrNgrams.empty()) {
     size_t thresholdMatches =
         (size_t)std::ceil((float_t)targetNgrams.size() * threshold);
-    size_t d = 0;  // will store upper-left cell value for current cache row
+    // cache[j] is the longest match using the first j attribute n-grams.
+    // cache[0] stays 0: a match cannot start before the first attribute n-gram.
     std::vector<size_t> cache(attrNgrams.size() + 1, 0);
     for (auto const& targetNgram : targetNgrams) {
+      // Diagonal of column 1 is cache[0] from the previous row. Reusing the
+      // value left in `d` would apply the previous row's last cell (saved
+      // before that cell was overwritten, so two rows back) and over-count
+      // a repeated token, e.g. ["quick"] vs ["quick","quick","quick"].
+      size_t d = 0;
       size_t s_ngram_idx = 1;
       for (; s_ngram_idx <= attrNgrams.size(); ++s_ngram_idx) {
         size_t curMatches =
```

**File**: `lib/iresearch/core/utils/ngram_match_utils.hpp` (modified, +4/-1)
```diff
@@ -86,12 +86,15 @@ float_t ngram_similarity(const T* target, size_t target_size, const T* src,
   const T* t_ngram_start_end = target + target_size - ngram_size +
                                1;  // end() analog for target ngram start
 
-  float_t d = 0;  // will store upper-left cell value for current cache row
   std::vector<float_t> cache(s_ngram_count + 1, 0);
 
   // here could be constructed source string with start characters affixing
 
   for (; t_ngram_start != t_ngram_start_end; ++t_ngram_start) {
+    // Upper-left cell of this row. Column 0 is always 0, so each target
+    // n-gram starts from a zero diagonal. Carrying `d` across rows leaks the
+    // previous row's last cell (the value from two rows earlier).
+    float_t d = 0;
     const T* t_ngram_end = t_ngram_start + ngram_size;
     const T* s_ngram_start = src;
     size_t s_ngram_idx = 1;
```

**File**: `lib/iresearch/tests/utils/ngram_match_utils_tests.cpp` (modified, +27/-0)
```diff
@@ -431,6 +431,33 @@ TEST(ngram_match_utils_test, test_similarity_shorter) {
   }
 }
 
+TEST(ngram_match_utils_test, test_similarity_repeated_ngram) {
+  // A single source n-gram must not be counted once per repeated target
+  // n-gram. The longest common sequence is 1.
+  const std::string_view one = "a";
+  const std::string_view three = "aaa";
+  ASSERT_DOUBLE_EQ(
+    1.f / 3.f, (irs::ngram_similarity<char, true>(three.data(), three.size(),
+                                                  one.data(), one.size(), 1)));
+  ASSERT_DOUBLE_EQ(1, (irs::ngram_similarity<char, true>(
+                        one.data(), one.size(), three.data(), three.size(),
+                        1)));
+
+  const std::string_view abc = "abc";
+  ASSERT_DOUBLE_EQ(
+    1.f / 3.f,
+    (irs::ngram_similarity<char, false>(three.data(), three.size(), abc.data(),
+                                        abc.size(), 1)));
+  ASSERT_DOUBLE_EQ(
+    1.f / 3.f,
+    (irs::ngram_similarity<char, false>(abc.data(), abc.size(), three.data(),
+                                        three.size(), 1)));
+  ASSERT_DOUBLE_EQ(
+    1.f / 3.f,
+    (irs::ngram_similarity<char, true>(three.data(), three.size(), abc.data(),
+                                       abc.size(), 1)));
+}
+
 TEST(ngram_match_utils_test, test_similarity_all_empty) {
   // strings are shorter than ngram length.
   const std::string_view lhs = "";
```

**File**: `tests/Aql/Function/NgramMatchFunctionTest.cpp` (modified, +32/-0)
```diff
@@ -317,5 +317,37 @@ TEST_F(NgramMatchFunctionTest, test) {
       assertNgramMatch(__LINE__, false, &Attribute, &Target2,
                        &ValidAnalyzerName);
     }
+    // One attribute bigram against the same bigram repeated on the target.
+    // Longest common sequence is 1 of 3, so similarity is 1/3.
+    {
+      AqlValue const Attribute{"aa"};
+      AqlValue const Target{"aaaa"};
+      assertNgramMatch(__LINE__, false, &Attribute, &Target, &ValidAnalyzerName,
+                       &Threshold05);
+      assertNgramMatch(__LINE__, true, &Attribute, &Target, &ValidAnalyzerName,
+                       &Threshold02);
+      assertNgramMatch(__LINE__, true, &Target, &Attribute, &ValidAnalyzerName,
+                       &Threshold05);
+    }
+  }
+  // text_en tokens: ["quick"] vs ["quick", "quick", "quick"] is 1/3.
+  // A stale diagonal from the previous row used to report a match at 0.5.
+  {
+    AqlValue const TextEn{"text_en"};
+    AqlValue const Attribute{"quick"};
+    AqlValue Repeated{"quick quick quick"};
+    AqlValueGuard RepeatedGuard(Repeated, true);
+
+    AqlValue const Pair{"quick quick"};
+    AqlValue const Threshold05{AqlValueHintDouble{0.5}};
+    AqlValue const Threshold03{AqlValueHintDouble{0.3}};
+    assertNgramMatch(__LINE__, false, &Attribute, &Repeated, &TextEn,
+                     &Threshold05);
+    assertNgramMatch(__LINE__, true, &Attribute, &Repeated, &TextEn,
+                     &Threshold03);
+    assertNgramMatch(__LINE__, true, &Repeated, &Attribute, &TextEn,
+                     &Threshold05);
+    // Two attribute tokens still form a sequence of length 2 (2/3 >= 0.5).
+    assertNgramMatch(__LINE__, true, &Pair, &Repeated, &TextEn, &Threshold05);
   }
 }
```

**File**: `tests/Aql/Function/NgramPosSimilarityFunctionTest.cpp` (modified, +11/-0)
```diff
@@ -245,6 +245,17 @@ TEST_F(NgramPosSimilarityFunctionTest, test) {
         assertNgramSimilarity(__LINE__, 0, &Target, &ValidString, &ValidInt);
       }
     }
+    // repeated character against a different string of the same length.
+    // Only the shared "a" counts, so positional similarity is 1/3.
+    {
+      AqlValue const Attribute{"abc"};
+      AqlValue const Target{"aaa"};
+      AqlValue const ValidInt{AqlValueHintInt{1}};
+      assertNgramSimilarity(__LINE__, 1.f / 3.f, &Attribute, &Target,
+                            &ValidInt);
+      assertNgramSimilarity(__LINE__, 1.f / 3.f, &Target, &Attribute,
+                            &ValidInt);
+    }
     // less than ngram size
     {
       AqlValue const Attribute{"a"};
```

**File**: `tests/Aql/Function/NgramSimilarityFunctionTest.cpp` (modified, +9/-0)
```diff
@@ -232,6 +232,15 @@ TEST_F(NgramSimilarityFunctionTest, test) {
         assertNgramSimilarity(__LINE__, 0, &Target, &ValidString, &ValidInt);
       }
     }
+    // repeated target character: one source char matches once, so 1/3
+    {
+      AqlValue const Attribute{"a"};
+      AqlValue const Target{"aaa"};
+      AqlValue const ValidInt{AqlValueHintInt{1}};
+      assertNgramSimilarity(__LINE__, 1.f / 3.f, &Attribute, &Target,
+                            &ValidInt);
+      assertNgramSimilarity(__LINE__, 1, &Target, &Attribute, &ValidInt);
+    }
     // less than ngram size
     {
       AqlValue const Attribute{"a"};
```

#### Recent Merged Pull Requests:
- **PR #23660** (2026-11-13): Remove unused security-governance job from the lint workflow of testing pipeline (@KVS85)
- **PR #23659** (2026-11-13): [3.12] Remove unused security-governance job from the lint workflow of testing pipeline (@KVS85)
- **PR #23649** (2026-11-12): Feature 3.12/makedata more useable (@dothebart)
- **PR #23648** (2026-11-12): let makedata be more appealing to developers (@dothebart)
- **PR #23646** (2026-11-12): add waitdata to make sure the vector index is seeded (#23643) (@dothebart)
- **PR #23643** (2026-11-12): BTS-2424: add waitdata to make sure the vector index is seeded (@dothebart)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
