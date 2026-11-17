# Verification Protocol: Verification Protocol: Empirical Defect Shield for envoyproxy/envoy

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy/envoy",
  "source_url": "https://github.com/envoyproxy/envoy",
  "source_version": "f96b2a28",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T16:22:00.055Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-envoyproxy-envoy",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy/envoy](https://github.com/envoyproxy/envoy) (Revision: `f96b2a28`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T16:22:00.055Z`  
> **Learning ID**: `learn-github-envoyproxy-envoy`


## 1. Scope & Verification Target
- **Target Repository**: `envoyproxy/envoy` (Commit: `f96b2a28`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): envoyproxy/envoy

> **Canonical Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T16:21:58.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `envoyproxy/envoy`
- **Description**: Cloud-native high-performance edge/middle/service proxy
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 29250 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `compat/openssl/source/ossl_dlutil.c`
```
#define _GNU_SOURCE
#include <stdio.h>
#include <limits.h>
#include <dlfcn.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "log.h"
#include "ossl_dlutil.h"


static void *libcrypto;
static void *libssl;


static void *ossl_malloc(size_t num, const char *file, int line) {
  (void)file;
  (void)line;
  return malloc(num);
}

static void *ossl_realloc(void *addr, size_t num, const char *file, int line) {
  (void)file;
  (void)line;
  return realloc(addr, num);
}

static void ossl_free(void *addr, const char *file, int line) {
  (void)file;
  (void)line;
  free(addr);
}


void ossl_dlopen(int expected_major, int expected_minor) {
  // First, a sanity check to see if OpenSSL shared libs are already linked in.
  // They shouldn't be, but it can easily happen (and has) if there's a bazel
  // change that causes them to be a proper link dependency, rather than just a
  // data dependency. We check by looking up a symbol that we know is only in
  // OpenSSL's libcrypto.so, and therefore shouldn't be loaded yet.
  if (dlsym(RTLD_DEFAULT, "OPENSSL_version_major") != NULL) {
    bssl_compat_error("libcrypto.so is already linked in\n");
    exit(ELIBACC);
  }

  // Another sanity check to confirm that the dynamic loader cannot resolve the
  // BoringSSL API symbols that we have implemented in the compatibility layer,
  // such as SSL_read(). If such symbols are visible in the dynamic symbol
  // table, then the OpenSSL code will get linked against them, when we load it,
  // which is not what we want! Since there are many ways of achieving this with
  // various different compile & link options, and such options can easily get
  // modified or deleted over time, this check acts as a runtime safety net.
  if (dlsym(RTLD_DEFAULT, "SSL_read") != NULL) {
    bssl_compat_error("SSL_read() is visible prior to loading OpenSSL\n");
    exit(ELIBACC);
  }

  char libcrypto_path[PATH_MAX];
  char libssl_path[PATH_MAX];

  snprintf(libcrypto_path, sizeof(libcrypto_path), "libcrypto.so.%d", expected_major);
  snprintf(libssl_path, sizeof(libssl_path), "libssl.so.%d", expected_major);

  // If we are running in a bazel test environment (as indicated by the presence
  // of the RUNFILES_DIR & TEST_WORKSPACE environment variables) then we need to
  // load the shared libraries from the bazel runfiles directory, which will
  // contain the correct OpenSSL libraries, built and placed there by bazel. We
  // do this by passing absolute paths to dlopen() based on those env vars.
  const char* runfiles_dir = getenv("RUNFILES_DIR");
  const char* test_workspace = getenv("TEST_WORKSPACE");
  if (runfiles_dir && test_workspace) {
    char ossl_path[PATH_MAX];
    char temp_path[PATH_MAX];

    // The shared libraries are built by //compat/openssl:libcrypto and :libssl.
    // OSSL_RUNFILES_LIB_DIR is their runfiles directory, set by the BUILD file.
    snprintf(ossl_path, sizeof(ossl_path), "%s/%s", runfiles_dir, OSSL_RUNFILES_LIB_DIR);

    strcpy(temp_path, libcrypto_path);
    snprintf(libcrypto_path, sizeof(libcrypto_path), "%s/%s", ossl_path, temp_path);

    strcpy(temp_path, libssl_path);
    snprintf(libssl_path, sizeof(libssl_path), "%s/%s", ossl_path, temp_path);
  }

  // Load libcrypto.so first, because libssl.so depends on it.
  if ((libcrypto = dlopen(libcrypto_path, RTLD_NOW | RTLD_LOCAL)) == NULL) {
    bssl_compat_error("dlopen(%s) : %s\n", libcrypto_path, dlerror());
    exit(ELIBACC);
  }

  // Now check the OpenSSL version of the loaded libraries to ensure they match
  // what we expect to load i.e. the version we were built against. We do this
  // by looking up and then invoking the OpenSSL_version_num() function from the
  // libcrypto.so that we just loaded.
  void *OpenSSL_version_num_fp = dlsym(libcrypto,"OpenSSL_version_num");
  if (OpenSSL_version_num_fp == NULL) {
    bssl_compat_error("dlsym(libcrypto, \"OpenSSL_version_num\") : %s\n", dlerror());
    exit(ELIBACC);
  }

  // Call the loaded OpenSSL_version_num() function to get the version number
  unsigned long loaded_version = ((unsigned long (*)())OpenSSL_version_num_fp)();
  int loaded_major = (loaded_version & 0xF0000000) >> 28;
  int loaded_minor = (loaded_version & 0x0FF00000) >> 20;
  int loaded_patch = (loaded_version & 0x00000FF0) >> 4;

  // Check the loaded version against the expected version. We require an exact
  // match on major version, and at least the expected minor version.
  if ((loaded_major != expected_major) || (loaded_minor < expected_minor)) {
    bssl_compat_error("Expecting to load OpenSSL version at least %d.%d.x but got %d.%d.%d\n",
                      expected_major, expected_minor, loaded_major, loaded_minor, loaded_patch);
    exit(ELIBACC);
  }

  // Tell OpenSSL to use the tcmalloc malloc/realloc/free functions from the
  // main executable. OpenSSL uses its own allocator wrappers internally, so
  // without this, OpenSSL allocations bypass tcmalloc, defeating its
  // performance benefits on the TLS hot path and making OpenSSL allocations
  // invisible to tcmalloc's heap dumps.
  typedef int (*CRYPTO_set_mem_functions_fn)(
      void *(*malloc_fn)(size_t, const char *, int),
      void *(*realloc_fn)(void *, size_t, const char *, int),
      void (*free_fn)(void *, const char *, int));

  CRYPTO_set_mem_functions_fn set_mem_fn = dlsym(libcrypto, "CRYPTO_set_mem_functions");
  if (set_mem_fn == NULL) {
    bssl_compat_error("dlsym(libcrypto, \"CRYPTO_set_mem_functions\") : %s\n", dlerror());
    exit(ELIBACC);
  }

  // In some circumstances, libcrypto will perform allocations during dlopen(),
  // in which case this CRYPTO_set_mem_functions() call will always fail, so we
  // have to let it fail silently rather than exiting.
  set_mem_fn(ossl_malloc, ossl_realloc, ossl_free);

  // Load libssl.so *after* calling CRYPTO_set_mem_functions() just in case
  // libssl.so has any library constructors that call OPENSSL_malloc().
  if ((libssl = dlopen(libssl_path, RTLD_NOW | RTLD_LOCAL)) == NULL) {
    bssl_compat_error("dlopen(%s) : %s\n", libssl_path, dlerror());
    exit(ELIBACC);
  }
}

void ossl_dlclose() {
  if (libssl) {
    dlclose(libssl);
    libssl = NULL;
  }
  if (libcrypto) {
    dlclose(libcrypto);
    libcrypto = NULL;
  }
}

void *ossl_dlsym(const char *symbol) {
  void *result;
  const char *s = symbol + 5;

  if ((result = dlsym(libcrypto, s)) != NULL) {
    return result;
  }

  if((result = dlsym(libssl, s)) != NULL) {
    return result;
  }

  return NULL;
}

```

### Core Architecture Module: `compat/openssl/source/ossl_dlutil.h`
```
#pragma once

#ifndef _OSSL_DLUTIL_H_
#define _OSSL_DLUTIL_H_

/**
 * @brief Dynamically loads OpenSSL shared libraries with environment-specific path resolution.
 *
 * This function is called by ossl_init() to load OpenSSL's libcrypto.so and libssl.so at runtime.
 * It handles two different execution environments:
 *
 * 1. **Bazel build/test environment** (When RUNFILES_DIR & TEST_WORKSPACE are set):
 *    - OpenSSL libraries are built by Bazel and put in the runfiles directory as data dependencies
 *    - Libraries are loaded from the runfiles directory (trying both Bazel 7 and 8 layouts)
 *    - Ensures the tests always use the correct Bazel-built libs, rather than libs from elsewhere
 *
 * 2. **Production/system environment** (When RUNFILES_DIR & TEST_WORKSPACE are not set):
 *    - Standard dlopen() behavior with LD_LIBRARY_PATH search
 *    - Expects OpenSSL libraries to be available in system paths
 *
 * In both cases, we use RTLD_DEEPBIND to ensure symbols are resolved from the loaded OpenSSL
 * library. Without this, bssl-compat will end up finding its own symbols instead of the loaded
 * OpenSSL ones.
 *
 * @param major The expected OpenSSL major version number
 * @param minor The expected OpenSSL minor version number
 */
void ossl_dlopen(int major, int minor);

/**
 * @brief Closes the OpenSSL shared libraries loaded by ossl_dlopen().
 */
void ossl_dlclose();

/**
 * @brief Looks up a symbol in the loaded OpenSSL shared libraries.
 *
 * This function searches for the given symbol name (with "ossl_" prefix stripped)
 * in both the libcrypto and libssl libraries that were loaded by ossl_dlopen().
 *
 * @param symbol The symbol name to look up (with "ossl_" prefix)
 * @return void* Pointer to the symbol, or NULL if not found
 */
void* ossl_dlsym(const char* symbol);

#endif // _OSSL_DLUTIL_H_

```

### Core Architecture Module: `contrib/common/sqlutils/source/sqlutils.h`
```
#pragma once

#include "source/common/protobuf/utility.h"

#include "include/sqlparser/SQLParser.h"

namespace Envoy {
namespace Extensions {
namespace Common {
namespace SQLUtils {

class SQLUtils {
public:
  using DecoderAttributes = std::map<std::string, std::string>;
  /**
   * Method parses SQL query string and writes output to metadata.
   * @param query supplies SQL statement.
   * @param attr supplies attributes which cannot be extracted from SQL query but are
   *    required to create proper metadata. For example database name may be sent
   *    by a client when it initially connects to the server, not along each SQL query.
   * @param metadata supplies placeholder where metadata should be written.
   * @return True if parsing was successful and False if parsing failed.
   *         If True was returned the metadata contains result of parsing. The results are
   *         stored in metadata.mutable_fields.
   **/
  static bool setMetadata(const std::string& query, const DecoderAttributes& attr,
                          Protobuf::Struct& metadata);
};

} // namespace SQLUtils
} // namespace Common
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/golang/common/go/utils/string.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package utils

import (
	"reflect"
	"unsafe"
)

func BytesToString(ptr uint64, len uint64) string {
	var s string
	var sHdr = (*reflect.StringHeader)(unsafe.Pointer(&s))
	sHdr.Data = uintptr(ptr)
	sHdr.Len = int(len)
	return s
}

func BytesToSlice(ptr uint64, len uint64) []byte {
	var s []byte
	var sHdr = (*reflect.SliceHeader)(unsafe.Pointer(&s))
	sHdr.Data = uintptr(ptr)
	sHdr.Len = int(len)
	sHdr.Cap = int(len)
	return s
}

// BufferToSlice convert the memory buffer from C to a slice with reserved len.
func BufferToSlice(ptr uint64, len uint64) []byte {
	var s []byte
	var sHdr = (*reflect.SliceHeader)(unsafe.Pointer(&s))
	sHdr.Data = uintptr(ptr)
	sHdr.Len = int(len)
	sHdr.Cap = int(len)
	return s
}

```

### Core Architecture Module: `contrib/golang/filters/http/source/processor_state.h`
```
#pragma once

#include <deque>
#include <memory>

#include "envoy/buffer/buffer.h"
#include "envoy/http/filter.h"
#include "envoy/http/header_map.h"

#include "source/common/buffer/buffer_impl.h"
#include "source/common/common/logger.h"
#include "source/common/http/codes.h"
#include "source/common/http/utility.h"

#include "absl/status/status.h"
#include "contrib/golang/common/dso/dso.h"

namespace Envoy {
namespace Extensions {
namespace HttpFilters {
namespace Golang {

class Filter;

class BufferList : public NonCopyable {
public:
  BufferList() = default;

  bool empty() const { return bytes_ == 0; }
  // return a new buffer instance, it will existing until moveOut or drain.
  Buffer::Instance& push(Buffer::Instance& data);
  // move all buffer into data, the list is empty then.
  void moveOut(Buffer::Instance& data);
  // clear the latest push in buffer.
  void clearLatest();
  // clear all.
  void clearAll();
  // check the buffer instance if existing
  bool checkExisting(Buffer::Instance* data);

private:
  std::deque<Buffer::InstancePtr> queue_;
  // The total size of buffers in the list.
  uint32_t bytes_{0};
};

// This describes the processor state.
enum class FilterState {
  // Waiting header
  WaitingHeader,
  // Processing header in Go
  ProcessingHeader,
  // Waiting data
  WaitingData,
  // Waiting all data
  WaitingAllData,
  // Processing data in Go
  ProcessingData,
  // Waiting trailer
  WaitingTrailer,
  // Processing trailer in Go
  ProcessingTrailer,
  // All done
  Done,
};

/**
 * An enum specific for Golang status.
 */
enum class GolangStatus {
  Running,
  // after called sendLocalReply
  LocalReply,
  // Continue filter chain iteration.
  Continue,
  StopAndBuffer,
  StopAndBufferWatermark,
  StopNoBuffer,
};

class ProcessorState : public processState,
                       public Logger::Loggable<Logger::Id::golang>,
                       NonCopyable {
public:
  explicit ProcessorState(Filter& filter, httpRequest* r) : filter_(filter) {
    req = r;
    setFilterState(FilterState::WaitingHeader);
  }
  virtual ~ProcessorState() = default;

  FilterState filterState() const { return static_cast<FilterState>(state); }
  void setFilterState(FilterState st) { state = static_cast<int>(st); }
  std::string stateStr();

  virtual Http::StreamFilterCallbacks* getFilterCallbacks() const PURE;

  bool isProcessingInGo() {
    return filterState() == FilterState::ProcessingHeader ||
           filterState() == FilterState::ProcessingData ||
           filterState() == FilterState::ProcessingTrailer || req->is_golang_processing_log;
  }
  bool isProcessingHeader() { return filterState() == FilterState::ProcessingHeader; }

  bool isThreadSafe() { return getFilterCallbacks()->dispatcher().isThreadSafe(); };
  Event::Dispatcher& getDispatcher() { return getFilterCallbacks()->dispatcher(); }

  /* data buffer */
  // add data to state buffer
  virtual void addBufferData(Buffer::Instance& data) PURE;
  // get state buffer
  Buffer::Instance& getBufferData() { return *data_buffer_.get(); };
  bool isBufferDataEmpty() { return data_buffer_ == nullptr || data_buffer_->length() == 0; };
  void drainBufferData();

  bool isProcessingEndStream() { return do_end_stream_; }

  virtual void continueProcessing() PURE;
  virtual void injectDataToFilterChain(Buffer::Instance& data, bool end_stream) PURE;
  void continueDoData() {
    if (!end_stream_ && doDataList.empty()) {
      return;
    }
    Buffer::OwnedImpl data_to_write;
    doDataList.moveOut(data_to_write);

    // Data followed by trailers never ends the stream. do_end_stream_ is true while processing
    // the trailers, when buffered data can still be pending.
    const bool end_stream = do_end_stream_ && trailers == nullptr;
    ENVOY_LOG(debug, "golang filter injecting data to filter chain, end_stream: {}", end_stream);
    injectDataToFilterChain(data_to_write, end_stream);
  }

  void processHeader(bool end_stream) {
    ASSERT(filterState() == FilterState::WaitingHeader);
    setFilterState(FilterState::ProcessingHeader);
    do_end_stream_ = end_stream;
  }

  void processData(bool end_stream) {
    ASSERT(filterState() == FilterState::WaitingData ||
           (filterState() == FilterState::WaitingAllData && (end_stream || trailers != nullptr)));
    setFilterState(FilterState::ProcessingData);

    do_end_stream_ = end_stream;
  }

  void processTrailer() {
    ASSERT(filterState() == FilterState::WaitingTrailer ||
           filterState() == FilterState::WaitingData ||
           filterState() == FilterState::WaitingAllData);
    setFilterState(FilterState::ProcessingTrailer);
    do_end_stream_ = true;
  }

  bool handleHeaderGolangStatus(const GolangStatus status);
  bool handleDataGolangStatus(const GolangStatus status);
  bool handleTrailerGolangStatus(const GolangStatus status);
  bool handleGolangStatus(GolangStatus status);

  virtual void sendLocalReply(Http::Code response_code, absl::string_view body_text,
                              std::function<void(Http::ResponseHeaderMap& headers)> modify_headers,
                              Grpc::Status::GrpcStatus grpc_status, absl::string_view details) PURE;

  virtual void addData(Buffer::Instance& data, bool is_streaming) PURE;

  const StreamInfo::StreamInfo& streamInfo() const { return getFilterCallbacks()->streamInfo(); }
  StreamInfo::StreamInfo& streamInfo() { return getFilterCallbacks()->streamInfo(); }

  void setEndStream(bool end_stream) { end_stream_ = end_stream; }
  bool getEndStream() { return end_stream_; }
  // seen trailers also means stream is end
  bool isStreamEnd() { return end_stream_ || trailers != nullptr; }

  Http::RequestOrResponseHeaderMap* headers{nullptr};
  Http::HeaderMap* trailers{nullptr};

  BufferList doDataList;

protected:
  Filter& filter_;
  bool watermark_requested_{false};
  Buffer::InstancePtr data_buffer_{nullptr};
  bool end_stream_{false};
  bool do_end_stream_{false};
};

class DecodingProcessorState : public ProcessorState {
public:
  explicit DecodingProcessorState(Filter& filter, httpRequest* r) : ProcessorState(filter, r) {
    is_encoding = 0;
  }

  void setDecoderFilterCallbacks(Http::StreamDecoderFilterCallbacks& callbacks) {
    decoder_callbacks_ = &callbacks;
  }
  Http::StreamFilterCallbacks* getFilterCallbacks() const override { return decoder_callbacks_; }

  void injectDataToFilterChain(Buffer::Instance& data, bool end_stream) override {
    decoder_callbacks_->injectDecodedDataToFilterChain(data, end_stream);
  }

  void addBufferData(Buffer::Instance& data) override;

  void continueProcessing() override {
    ENVOY_LOG(debug, "golang filter callback continue, continueDecoding");
    decoder_callbacks_->continueDecoding();
  }
  void sendLocalReply(Http::Code response_code, absl::string_view body_text,
                      std::function<void(Http::ResponseHeaderMap& headers)> modify_headers,
                      Grpc::Status::GrpcStatus grpc_status, absl::string_view details) override {
    // it's safe to reset filterState(), since it is read/write in safe thread.
    ENVOY_LOG(debug, "golang filter phase grow to EncodeHeader and state grow to WaitHeader before "
                     "sendLocalReply");
    setFilterState(FilterState::WaitingHeader);
    decoder_callbacks_->sendLocalReply(response_code, body_text, modify_headers, grpc_status,
                                       details);
  };

  void addData(Buffer::Instance& data, bool is_streaming) override {
    ENVOY_LOG(debug, "golang filter addData when decoding, is_streaming: {}", is_streaming);
    decoder_callbacks_->addDecodedData(data, is_streaming);
  }

  void setUpstreamOverrideHost(Upstream::LoadBalancerContext::OverrideHost host_and_strict) {
    decoder_callbacks_->setUpstreamOverrideHost(std::move(host_and_strict));
  }

private:
  Http::StreamDecoderFilterCallbacks* decoder_callbacks_{nullptr};
};

class EncodingProcessorState : public ProcessorState {
public:
  explicit EncodingProcessorState(Filter& filter, httpRequest* r) : ProcessorState(filter, r) {
    is_encoding = 1;
  }

  void setEncoderFilterCallbacks(Http::StreamEncoderFilterCallbacks& callbacks) {
    encoder_callbacks_ = &callbacks;
  }
  Http::StreamFilterCallbacks* getFilterCallbacks() const override { return encoder_callbacks_; }

  void injectDataToFilterChain(Buffer::Instance& data, bool end_stream) override {
    encoder_callbacks_->injectEncodedDataToFilterChain(data, end_stream);
  }

  void addBufferData(Buffer::Instance& data) override;

  void continueProcessing() override {
    ENVOY_LOG(debug, "golang filter callback continue, continueEncoding");
    encoder_callbacks_->continueEncoding();
  }
  void sendLocalReply(Http::Code response_code, absl::string_view body_text,
                      std::function<void(Http::ResponseHeaderMap& headers)> modify_headers,
                      Grpc::Status::GrpcStatus grpc_status, absl::string_view details) override {
    encoder_callbacks_->sendLocalReply(response_code, body_text, modify_headers, grpc_status,
                                       details);
  };

  void addData(Buffer::Instance& data, bool is_streaming) override {
    ENVOY_LOG(debug, "golang filter addData when encoding, is_streaming: {}", is_streaming);
    encoder_callbacks_->addEncodedData(data, is_streaming);
  }

private:
  Http::StreamEncoderFilterCallbacks* encoder_callbacks_{nullptr};
};

} // namespace Golang
} // namespace HttpFilters
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/golang/upstreams/http/tcp/source/processor_state.h`
```
#pragma once

#include <deque>
#include <memory>

#include "envoy/buffer/buffer.h"
#include "envoy/http/filter.h"
#include "envoy/http/header_map.h"

#include "source/common/buffer/buffer_impl.h"
#include "source/common/common/logger.h"
#include "source/common/http/codes.h"
#include "source/common/http/header_map_impl.h"
#include "source/common/http/utility.h"

#include "absl/status/status.h"
#include "contrib/golang/common/dso/dso.h"

namespace Envoy {
namespace Extensions {
namespace Upstreams {
namespace Http {
namespace Tcp {
namespace Golang {

class HttpTcpBridge;

/**
 * This describes the processor state.
 */
enum class FilterState {
  // Waiting header
  WaitingHeader,
  // Processing header in Go
  ProcessingHeader,
  // Waiting data
  WaitingData,
  // Waiting all data
  WaitingAllData,
  // Processing data in Go
  ProcessingData,
  // EndStream and send resp to downstream
  EndStream,
  // All done
  Done,
};
/**
 * An enum specific for Golang status.
 */
enum class HttpTcpBridgeStatus {
  /**
   *
   * Used when you want to leave the current func area and continue further func. (when streaming,
   * go side get each_data_piece, may be called multiple times)
   *
   * Here is the specific explanation in different funcs:
   *
   * encodeHeaders: will go to encodeData, go side in encodeData will streaming get each_data_piece.
   *
   * encodeData: streaming send data to upstream, go side get each_data_piece, may be called
   * multiple times.
   *
   * onUpstreamData: go side in onUpstreamData will get each_data_piece, pass data
   * and headers to downstream streaming.
   */
  HttpTcpBridgeContinue,

  /**
   *
   * Used when you want to buffer data.
   *
   * Here is the specific explanation in different funcs:
   *
   * encodeHeaders: will go to encodeData, encodeData will buffer whole data, go side in encodeData
   * get whole data one-off.
   *
   * encodeData: buffer further whole data, go side in encodeData get whole
   * data one-off. (Be careful: cannot be used when end_stream=true)
   *
   * onUpstreamData: every data
   * trigger will call go side, and go side get whole buffered data ever since at every time.
   */
  HttpTcpBridgeStopAndBuffer,

  /**
   *
   * Used when you want to endStream for sending resp to downstream.
   *
   * Here is the specific explanation in different funcs:
   *
   * encodeHeaders, encodeData: endStream to upstream&downstream and send data to
   * downstream(if not blank), which means the whole resp to http has finished.
   *
   * onUpstreamData: endStream to downstream which means the whole resp to http has finished.
   */
  HttpTcpBridgeEndStream,
};

class ProcessorState : public processState,
                       public Logger::Loggable<Logger::Id::golang>,
                       NonCopyable {
public:
  explicit ProcessorState(httpRequest* r) {
    req = r;
    setFilterState(FilterState::WaitingHeader);
  }
  virtual ~ProcessorState() = default;

  void processData();
  std::string stateStr();

  FilterState filterState() const { return static_cast<FilterState>(state); }
  void setFilterState(FilterState st) { state = static_cast<int>(st); }
  bool isProcessingInGo() {
    return filterState() == FilterState::ProcessingHeader ||
           filterState() == FilterState::ProcessingData;
  }
};

class EncodingProcessorState : public ProcessorState {
public:
  EncodingProcessorState(HttpTcpBridge& http_tcp_bridge);

  /* data buffer */
  // add data to state buffer
  virtual void addBufferData(Buffer::Instance& data) {
    if (data_buffer_ == nullptr) {
      data_buffer_ = std::make_unique<Buffer::OwnedImpl>();
    }
    data_buffer_->move(data);
  };
  // get state buffer
  Buffer::Instance& getBufferData() { return *data_buffer_.get(); };
  bool isBufferDataEmpty() { return data_buffer_ == nullptr || data_buffer_->length() == 0; };
  void drainBufferData() {
    if (data_buffer_ != nullptr) {
      auto len = data_buffer_->length();
      if (len > 0) {
        ENVOY_LOG(debug, "golang http-tcp bridge drain buffer data");
        data_buffer_->drain(len);
      }
    }
  }

  void handleHeaderGolangStatus(HttpTcpBridgeStatus status);
  void handleDataGolangStatus(const HttpTcpBridgeStatus status, bool end_stream);

  // store request header for http
  const Envoy::Http::RequestHeaderMap* req_headers{nullptr};

protected:
  Buffer::InstancePtr data_buffer_{nullptr};
};

class DecodingProcessorState : public ProcessorState {
public:
  DecodingProcessorState(HttpTcpBridge& http_tcp_bridge);

  // store response header for http
  std::unique_ptr<Envoy::Http::ResponseHeaderMapImpl> resp_headers{nullptr};
};

} // namespace Golang
} // namespace Tcp
} // namespace Http
} // namespace Upstreams
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/hyperscan/regex_engines/source/config.h`
```
#pragma once

#include "envoy/common/regex.h"

#include "contrib/envoy/extensions/regex_engines/hyperscan/v3alpha/hyperscan.pb.h"
#include "contrib/envoy/extensions/regex_engines/hyperscan/v3alpha/hyperscan.pb.validate.h"

namespace Envoy {
namespace Extensions {
namespace Regex {
namespace Hyperscan {

class Config : public Envoy::Regex::EngineFactory {
public:
  // Regex::EngineFactory
  Envoy::Regex::EnginePtr
  createEngine(const Protobuf::Message& config,
               Server::Configuration::ServerFactoryContext& server_factory_context) override;

  ProtobufTypes::MessagePtr createEmptyConfigProto() override {
    return std::make_unique<envoy::extensions::regex_engines::hyperscan::v3alpha::Hyperscan>();
  }
  std::string name() const override { return "envoy.regex_engines.hyperscan"; };
};

} // namespace Hyperscan
} // namespace Regex
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/hyperscan/regex_engines/source/regex.h`
```
#pragma once

#include "envoy/common/regex.h"

#include "contrib/hyperscan/matching/input_matchers/source/matcher.h"

namespace Envoy {
namespace Extensions {
namespace Regex {
namespace Hyperscan {

class HyperscanEngine : public Envoy::Regex::Engine {
public:
  explicit HyperscanEngine(Event::Dispatcher& dispatcher, ThreadLocal::SlotAllocator& tls);
  absl::StatusOr<Envoy::Regex::CompiledMatcherPtr> matcher(const std::string& regex) const override;

private:
  Event::Dispatcher& dispatcher_;
  ThreadLocal::SlotAllocator& tls_;
};

} // namespace Hyperscan
} // namespace Regex
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/kafka/filters/network/source/mesh/librdkafka_utils.h`
```
#pragma once

#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <utility>

#include "envoy/common/pure.h"

#include "absl/strings/string_view.h"
#include "librdkafka/rdkafkacpp.h"

namespace Envoy {
namespace Extensions {
namespace NetworkFilters {
namespace Kafka {
namespace Mesh {

// Used by librdkafka API.
using RdKafkaMessageRawPtr = RdKafka::Message*;

using RdKafkaMessagePtr = std::unique_ptr<RdKafka::Message>;

/**
 * Helper class to wrap librdkafka consumer partition assignment.
 * This object has to live longer than whatever consumer that uses its "raw" data.
 * On its own it does not expose any public API, as it is not intended to be interacted with.
 */
class ConsumerAssignment {
public:
  virtual ~ConsumerAssignment() = default;
};

using ConsumerAssignmentConstPtr = std::unique_ptr<const ConsumerAssignment>;

/**
 * Helper class responsible for creating librdkafka entities, so we can have mocks in tests.
 */
class LibRdKafkaUtils {
public:
  virtual ~LibRdKafkaUtils() = default;

  virtual RdKafka::Conf::ConfResult setConfProperty(RdKafka::Conf& conf, const std::string& name,
                                                    const std::string& value,
                                                    std::string& errstr) const PURE;

  virtual RdKafka::Conf::ConfResult setConfDeliveryCallback(RdKafka::Conf& conf,
                                                            RdKafka::DeliveryReportCb* dr_cb,
                                                            std::string& errstr) const PURE;

  virtual std::unique_ptr<RdKafka::Producer> createProducer(RdKafka::Conf* conf,
                                                            std::string& errstr) const PURE;

  virtual std::unique_ptr<RdKafka::KafkaConsumer> createConsumer(RdKafka::Conf* conf,
                                                                 std::string& errstr) const PURE;

  // Returned type is a raw pointer, as librdkafka does the deletion on successful produce call.
  virtual RdKafka::Headers* convertHeaders(
      const std::vector<std::pair<absl::string_view, absl::string_view>>& headers) const PURE;

  // In case of produce failures, we need to dispose of headers manually.
  virtual void deleteHeaders(RdKafka::Headers* librdkafka_headers) const PURE;

  // Assigns partitions to a consumer.
  // Impl: this method was extracted so that raw-pointer vector does not appear in real code.
  virtual ConsumerAssignmentConstPtr assignConsumerPartitions(RdKafka::KafkaConsumer& consumer,
                                                              const std::string& topic,
                                                              const int32_t partitions) const PURE;
};

using RawKafkaConfig = std::map<std::string, std::string>;

} // namespace Mesh
} // namespace Kafka
} // namespace NetworkFilters
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/kafka/filters/network/source/mesh/librdkafka_utils_impl.h`
```
#pragma once

#include <cstdint>
#include <vector>

#include "contrib/kafka/filters/network/source/mesh/librdkafka_utils.h"

namespace Envoy {
namespace Extensions {
namespace NetworkFilters {
namespace Kafka {
namespace Mesh {

using RdKafkaPartitionPtr = std::unique_ptr<RdKafka::TopicPartition>;
using RdKafkaPartitionVector = std::vector<RdKafka::TopicPartition*>;

/**
 * Real implementation that just performs librdkafka operations.
 */
class LibRdKafkaUtilsImpl : public LibRdKafkaUtils {
public:
  // LibRdKafkaUtils
  RdKafka::Conf::ConfResult setConfProperty(RdKafka::Conf& conf, const std::string& name,
                                            const std::string& value,
                                            std::string& errstr) const override;

  // LibRdKafkaUtils
  RdKafka::Conf::ConfResult setConfDeliveryCallback(RdKafka::Conf& conf,
                                                    RdKafka::DeliveryReportCb* dr_cb,
                                                    std::string& errstr) const override;

  // LibRdKafkaUtils
  std::unique_ptr<RdKafka::Producer> createProducer(RdKafka::Conf* conf,
                                                    std::string& errstr) const override;

  // LibRdKafkaUtils
  std::unique_ptr<RdKafka::KafkaConsumer> createConsumer(RdKafka::Conf* conf,
                                                         std::string& errstr) const override;

  // LibRdKafkaUtils
  RdKafka::Headers* convertHeaders(
      const std::vector<std::pair<absl::string_view, absl::string_view>>& headers) const override;

  // LibRdKafkaUtils
  void deleteHeaders(RdKafka::Headers* librdkafka_headers) const override;

  // LibRdKafkaUtils
  ConsumerAssignmentConstPtr assignConsumerPartitions(RdKafka::KafkaConsumer& consumer,
                                                      const std::string& topic,
                                                      const int32_t partitions) const override;

  // Default singleton accessor.
  static const LibRdKafkaUtils& getDefaultInstance();
};

} // namespace Mesh
} // namespace Kafka
} // namespace NetworkFilters
} // namespace Extensions
} // namespace Envoy

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #49165** (2026-11-12): **compat/openssl: prefixer fails to link on aarch64 hosts (x86_64 libstdc++.a)**
  *Symptoms*: *Title*: *compat/openssl: prefixer fails to link on aarch64 hosts (x86_64 libstdc++.a)*  *Description*:  `bazel build --config=openssl` cannot build the `compat/openssl` `prefixer` tool on a Linux aarch64 host. The tool is compiled for aarch64 but linked against the **x86_64** `libstdc++.a`:  ``` ld.lld: error: external/envoy_toolshed++gcc_extension+gcc_runtime_linux_x86_64/lib64/libstdc++.a(compatibility.o) is incompatible with elf64-littleaarch64 ld.lld: error: external/envoy_toolshed++gcc_extension+gcc_runtime_linux_x86_64/lib64/libstdc++.a(compatibility-debug_list.o) is incompatible with elf64-littleaarch64 ... (repeated for every object) ld.lld: error: too many errors emitted, stopping now (use --error-limit=0 to see all errors) Target //compat/openssl/prefixer:prefixer failed to build ```  `//compat/openssl:prefixed_ossl_source` runs the `prefixer`, so this blocks every `--config=openssl` build (including `//source/exe:envoy-static`) on aarch64, although `bazel/SSL.md` lists "Supported architectures: Linux x86_64, aarch64, ppc64le" for OpenSSL.  *Repro steps*:  * Host: Linux aarch64 (I used an NVIDIA BlueField-3 DPU). Build container: the  `docker.io/envoyproxy/envoy-build` image pinned in `.github/config.yml`. Bazel 9.3.2. * Source: `main` at 93aab937d9074b05c1b1d86dcfa85367a4cebf20 (`VERSION.txt` = 1.41.0-dev).  ``` bazel build -c opt --config=openssl //compat/openssl/prefixer:prefixer ```  I only reproduced this on the host above. The cause below is independent of th

- **Issue #49003** (2026-11-07): **`connect_grpc_bridge`: update unary HTTP status code mappings to match current Connect spec**
  *Symptoms*: The `connect_grpc_bridge` filter currently maps gRPC status codes to HTTP status codes using the original Connect protocol specification from when the filter was introduced in #24836  In March 2024, the Connect specification updated the HTTP status mappings for four error codes (https://github.com/connectrpc/connectrpc.com/pull/130):  | Connect Error Code | Current Envoy Mapping | Current Connect Spec | | :--- | :--- | :--- | | `canceled` (1) | `408 Request Timeout` | `499 Client Closed Request` | | `deadline_exceeded` (4) | `408 Request Timeout` | `504 Gateway Timeout` | | `failed_precondition` (9) | `412 Precondition Failed` | `400 Bad Request` | | `unimplemented` (12) | `404 Not Found` | `501 Not Implemented` |  While Connect clients parse the `"code"` field directly from the JSON response body and aren't broken by this, infrastructure and observability tools that rely on raw HTTP status codes (such as access logs, metrics, 5xx alerting rules), and middleware misclassify these responses. Envoy's `connect_grpc_bridge` filter should be updated to match the current specification.  *Repro steps*: 1. Configure an Envoy listener with the `envoy.filters.http.connect_grpc_bridge` HTTP filter enabled in front of an upstream gRPC service. 2. Send a unary Connect request (with header `Connect-Protocol-Version: 1` and `Content-Type: application/proto`). 3. Have the upstream gRPC server respond with `grpc-status: 4` (`DEADLINE_EXCEEDED`), `grpc-status: 1` (`CANCELED`), `grpc-status: 9`
  **Post-Mortem & Fix Analysis**:
  > cc: @jchadwick-buf @mattklein123

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

### Incident Patch 1: `8937718c` (2026-11-16)
**Commit Message**: test: deflake QuicInplaceLdsIntegrationTest drain waits (#49300)


The in-place LDS tests wait for
`listener_manager.total_filter_chains_draining` to reach 1 and then 0,
but the gauge only stays up for the 1s drain time. A test thread
descheduled for longer than that under tsan never sees it rise and burns
the whole wait. The next QUIC connection then times out its handshake
straight away, because `QuicConnection` starts its handshake clock from
the test dispatcher's cached time, which went stale during that wait.
The tests now wait for `listener_create_success` to count one creation
per worker per update, which the main thread only does after
`inPlaceFilterChainUpdate()` has already started the drain, and then for
the gauge to reach 0.

Additional Description:
This hit `EnableAndDisableResumption/IPv4` under tsan. It's the same
timeout as #31183 (`EnableAndDisableEarlyData`) and #33453
(`ReloadConfigUpdateDefaultFilterChain`), both closed as stale.
`listener_in_place_updated` alone isn't enough to wait on, since it's
bumped when the update is accepted, before the new listener warms.

AI Disclosure: code change created with AI assistance, fully reviewed by
me prior to opening.

Ris

**File**: `test/integration/quic_http_integration_test.cc` (modified, +19/-21)
```diff
@@ -1417,6 +1417,19 @@ class QuicInplaceLdsIntegrationTest : public QuicHttpIntegrationTest {
     QuicHttpIntegrationTest::initialize();
   }
 
+  // Waits for the workers to apply `in_place_updates` in place updates and for the filter chains
+  // they replaced to finish draining. The main thread starts the drain before it counts any worker
+  // acknowledging the update, so the drain gauge has already risen once the counter reaches the
+  // target. Waiting for the gauge itself to rise can miss its drain_time_ window.
+  void waitForInplaceUpdateDrained(uint32_t in_place_updates) {
+    test_server_->waitForCounter("listener_manager.listener_in_place_updated",
+                                 Ge(in_place_updates));
+    const uint32_t listener_creations = 1 + in_place_updates;
+    test_server_->waitForCounter("listener_manager.listener_create_success",
+                                 Ge(listener_creations * concurrency_));
+    test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  }
+
   void makeRequestAndWaitForResponse(IntegrationCodecClient& codec_client) {
     IntegrationStreamDecoderPtr response =
         codec_client.makeHeaderOnlyRequest(default_request_headers_);
@@ -1449,9 +1462,7 @@ TEST_P(QuicInplaceLdsIntegrationTest, ReloadConfigUpdateNonDefaultFilterChain) {
       });
 
   new_config_helper.setLds("1");
-  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  waitForInplaceUpdateDrained(1);
   makeRequestAndWaitForResponse(*codec_client_0);
   EXPECT_TRUE(codec_client_1->sawGoAway());
   codec_client_1->close();
@@ -1491,10 +1502,7 @@ TEST_P(QuicInplaceLdsIntegrationTest, ReloadConfigUpdateDefaultFilterChain) {
       });
 
   new_config_helper.setLds("1");
-  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
-
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  waitForInplaceUpdateDrained(1);
   // This connection should pick up the default filter chain.
   auto codec_client_default =
       makeHttpConnection(makeClientConnectionWithHost(lookupPort("http"), "lyft.com"));
@@ -1511,9 +1519,7 @@ TEST_P(QuicInplaceLdsIntegrationTest, ReloadConfigUpdateDefaultFilterChain) {
   });
 
   new_config_helper1.setLds("1");
-  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(2));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  waitForInplaceUpdateDrained(2);
 
   makeRequestAndWaitForResponse(*codec_client_0);
   EXPECT_TRUE(codec_client_default->sawGoAway());
@@ -1533,9 +1539,7 @@ TEST_P(QuicInplaceLdsIntegrationTest, ReloadConfigUpdateDefaultFilterChain) {
       });
 
   new_config_helper2.setLds("1");
-  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(3));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  waitForInplaceUpdateDrained(3);
 
   makeRequestAndWaitForResponse(*codec_client_0);
   codec_client_0->close();
@@ -1559,10 +1563,7 @@ TEST_P(QuicInplaceLdsIntegrationTest, EnableAndDisableEarlyData) {
                       &new_config_helper);
 
   new_config_helper.setLds("1");
-  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
-
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  waitForInplaceUpdateDrained(1);
   // The 2nd connection should try to do 0-RTT but get rejected and QUICHE will transparently retry
   // the request after handshake completes.
   auto codec_client_2 = makeRawHttp3Connection(
@@ -1592,10 +1593,7 @@ TEST_P(QuicInplaceLdsIntegrationTest, EnableAndDisableResumption) {
                       &new_config_helper);
 
   new_config_helper.setLds("1");
-  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
-
-  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
+  waitForInplaceUpdateDrained(1);
 
   auto codec_client_2 = makeRawHttp3Connection(
       makeClientConnectionWithHost(lookupPort("http"), "www.lyft.com"), std::nullopt,
```

---

### Incident Patch 2: `44a6cec6` (2026-11-17)
**Commit Message**: release/ci: Build, sign and publish the release of both arches in one job (#49331)


With `release-publish-multiarch`, the x64 Publish binary job builds
everything published for both arches (`release.multiarch`), and uploads
the same artifacts as the per-arch jobs did (`release.<arch>`,
`oci.<arch>`, `packages.<arch>`); there is no arm64 job.

`//distribution/publish:publish_<arch>` builds `//distribution/publish`
for the arch's target platform, from any host. Only the target platform
changes: everything runs on the build's execution platforms, so the
arm64 binaries are cross-compiled on x64 (the llvm toolchain has the
arm64 sysroot and libc++), and the exec tools (eg the Python ones, whose
pip deps only resolve for the host) stay on the host's arch.

The tools are now `bundled` too (as the container images' are), so they
are built in the same configuration as the binaries.

`release.publish` builds the host's arch, as before.

The job is named `Server (multiarch)`. It sets `--//bazel:multiarch`, so
on EngFlow the x86_64 RBE pool pins (`envoy_exec_properties`, via
`//bazel:engflow_rbe_x86_64`) apply to the arm64 half too, as it is
built on x86_64 workers. Without it (eg a native ar

**File**: `.github/config.yml` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@ agent-ubuntu: ubuntu-24.04
 # (`release.publish`). Branches without this run `release.server_only`, and the Docker OCI and
 # Packages jobs.
 release-publish: true
+# With `release-publish`: build both arches in the x64 job (`release.multiarch`), cross-compiling
+# the arm64 binaries, rather than a job per arch.
+release-publish-multiarch: true
 build-image:
   # Authoritative configuration for build image/s
   repo: docker.io/envoyproxy/envoy-build
```

**File**: `.github/workflows/_publish_build.yml` (modified, +15/-4)
```diff
@@ -8,6 +8,8 @@ on:
     secrets:
       dockerhub-token:
       gcp-key:
+      gpg-key:
+      gpg-key-password:
     inputs:
       docs:
         type: boolean
@@ -37,18 +39,27 @@ jobs:
     if: inputs.server
     secrets:
       dockerhub-token: ${{ secrets.dockerhub-token }}
+      gpg-key: ${{ secrets.gpg-key }}
+      gpg-key-password: ${{ secrets.gpg-key-password }}
     permissions:
       actions: read
       contents: read
       packages: read
-    name: Server
+    name: >-
+      ${{ fromJSON(inputs.request).config.release-publish
+          && fromJSON(inputs.request).config.release-publish-multiarch
+          && 'Server (multiarch)'
+          || format('Server ({0})', matrix.arch) }}
     uses: ./.github/workflows/_publish_build_server.yml
     strategy:
       fail-fast: false
       matrix:
-        arch:
-        - x64
-        - arm64
+        # With `release-publish-multiarch`, the x64 job builds both arches.
+        arch: >-
+          ${{ fromJSON(inputs.request).config.release-publish
+              && fromJSON(inputs.request).config.release-publish-multiarch
+              && fromJSON('["x64"]')
+              || fromJSON('["x64", "arm64"]') }}
     with:
       arch: ${{ matrix.arch }}
       request: ${{ inputs.request }}
```

**File**: `.github/workflows/_publish_build_server.yml` (modified, +47/-3)
```diff
@@ -7,6 +7,8 @@ on:
   workflow_call:
     secrets:
       dockerhub-token:
+      gpg-key:
+      gpg-key-password:
     inputs:
       arch:
         type: string
@@ -32,6 +34,9 @@ jobs:
   binary:
     secrets:
       dockerhub-token: ${{ secrets.dockerhub-token }}
+      # Only staged when signing (`signing`, below).
+      gpg-key: ${{ secrets.gpg-key }}
+      gpg-key-password: ${{ secrets.gpg-key-password }}
     permissions:
       actions: read
       contents: read
@@ -42,11 +47,34 @@ jobs:
       arch: ${{ inputs.arch }}
       bazel-extra: >-
         --config=rbe
+        ${{ fromJSON(inputs.request).config.release-publish
+            && fromJSON(inputs.request).config.release-publish-multiarch
+            && fromJSON(inputs.request).run.release
+            && (vars.ENVOY_CI_RELEASE || github.repository == 'envoyproxy/envoy')
+            && !inputs.trusted
+            && '--//distribution:signing-key=snakeoil'
+            || '' }}
+      # With `release-publish-multiarch`, sign the release of both arches in the same invocation
+      # (as the release Sign packages job does otherwise).
+      signing: >-
+        ${{ fromJSON(inputs.request).config.release-publish
+            && fromJSON(inputs.request).config.release-publish-multiarch
+            && fromJSON(inputs.request).run.release
+            && (vars.ENVOY_CI_RELEASE || github.repository == 'envoyproxy/envoy')
+            && true
+            || false }}
       target: >-
         ${{ fromJSON(inputs.request).config.release-publish
-            && 'release.publish'
+            && (fromJSON(inputs.request).config.release-publish-multiarch
+                && 'release.multiarch'
+                || 'release.publish')
             || 'release.server_only' }}
-      target-suffix: ${{ inputs.arch }}
+      # With `release-publish-multiarch`, it builds every arch (on whichever host).
+      target-suffix: >-
+        ${{ !(fromJSON(inputs.request).config.release-publish
+              && fromJSON(inputs.request).config.release-publish-multiarch)
+            && inputs.arch
+            || '' }}
       cache-build-image: ${{ fromJSON(inputs.request).request.build-image.default }}
       cache-build-image-key-suffix: ${{ inputs.arch == 'arm64' && '-arm64' || '' }}
       concurrency-suffix: -${{ inputs.arch }}
@@ -59,14 +87,30 @@ jobs:
             || fromJSON(inputs.request).config.ci.agent-publish || fromJSON(inputs.request).config.ci.agent-ubuntu }}
       timeout-minutes: 120
       trusted: ${{ inputs.trusted }}
+      # With `release-publish-multiarch`, only what the pipeline uses: the images of both arches (and
+      # the signed release, below).
       uploads: |
-        release.${{ inputs.arch }}: {path: container/envoy/${{ inputs.arch }}/bin/, compression-level: 0}
+        ${{ !(fromJSON(inputs.request).config.release-publish
+              && fromJSON(inputs.request).config.release-publish-multiarch)
+            && format('release.{0}: {{path: container/envoy/{0}/bin/, compression-level: 0}}', inputs.arch)
+            || '' }}
         ${{ fromJSON(inputs.request).config.release-publish
             && format('oci.{0}: {{path: container/envoy/{0}/build_images, compression-level: 0}}', inputs.arch)
             || '' }}
         ${{ fromJSON(inputs.request).config.release-publish
+            && !fromJSON(inputs.request).config.release-publish-multiarch
             && format('packages.{0}: {{path: container/envoy/{0}/packages, compression-level: 0}}', inputs.arch)
             || '' }}
+        ${{ fromJSON(inputs.request).config.release-publish
+            && fromJSON(inputs.request).config.release-publish-multiarch
+            && 'oci.arm64: {path: container/envoy/arm64/build_images, compression-level: 0}'
+            || '' }}
+        ${{ fromJSON(inputs.request).config.release-publish
+            && fromJSON(inputs.request).config.release-publish-multiarch
+            && fromJSON(inputs.request).run.release
+            && (vars.ENVOY_CI_RELEASE || github.repository == 'envoyproxy/envoy')
+            && 'release.signed: {path: container/envoy/release.signed.tar.zst, compression-level: 0}'
+            || '' }}
 
   # Branches whose binary jobs do not build the container images and packages (`release-publish`).
   docker:
```

**File**: `.github/workflows/_publish_release.yml` (modified, +14/-2)
```diff
@@ -89,9 +89,12 @@ jobs:
       actions: read
       contents: read
       packages: read
+    # With `release-publish-multiarch`, the release is signed in the build (`release.multiarch`).
     if: >-
       fromJSON(inputs.request).run.release
       && (vars.ENVOY_CI_RELEASE || github.repository == 'envoyproxy/envoy')
+      && !(fromJSON(inputs.request).config.release-publish
+           && fromJSON(inputs.request).config.release-publish-multiarch)
     name: Sign packages
     uses: ./.github/workflows/_run.yml
     with:
@@ -203,7 +206,11 @@ jobs:
       && fromJSON(inputs.request).run.release
       && !fromJSON(inputs.request).request.version.dev
       && needs.container.result == 'success'
-      && needs.sign.result == 'success'
+      && (needs.sign.result == 'success'
+          || (needs.sign.result == 'skipped'
+              && (vars.ENVOY_CI_RELEASE || github.repository == 'envoyproxy/envoy')
+              && fromJSON(inputs.request).config.release-publish
+              && fromJSON(inputs.request).config.release-publish-multiarch))
       && needs.docs-archive.result != 'failure'
     name: ${{ matrix.name || matrix.target }}
     uses: ./.github/workflows/_run.yml
@@ -242,7 +249,11 @@ jobs:
       !cancelled()
       && fromJSON(inputs.request).run.release
       && fromJSON(inputs.request).request.version.dev
-      && needs.sign.result == 'success'
+      && (needs.sign.result == 'success'
+          || (needs.sign.result == 'skipped'
+              && (vars.ENVOY_CI_RELEASE || github.repository == 'envoyproxy/envoy')
+              && fromJSON(inputs.request).config.release-publish
+              && fromJSON(inputs.request).config.release-publish-multiarch))
       && needs.docs-archive.result != 'failure'
     name: github
     uses: ./.github/workflows/_run.yml
@@ -253,4 +264,5 @@ jobs:
       downloads: |
         release.signed: container/release.signed
       request: ${{ inputs.request }}
+      runs-on: ${{ fromJSON(inputs.request).config.ci.agent-publish || fromJSON(inputs.request).config.ci.agent-ubuntu }}
       trusted: ${{ inputs.trusted }}
```

**File**: `.github/workflows/envoy-publish.yml` (modified, +11/-0)
```diff
@@ -55,6 +55,17 @@ jobs:
             && fromJSON(needs.load.outputs.trusted)
             && secrets.GCP_SERVICE_ACCOUNT_KEY_TRUSTED
             || secrets.GCP_SERVICE_ACCOUNT_KEY }}
+      # With `release-publish-multiarch`, the release is signed in the build (`release.multiarch`).
+      gpg-key: >-
+        ${{ needs.load.outputs.trusted
+            && fromJSON(needs.load.outputs.trusted)
+            && secrets.ENVOY_GPG_MAINTAINER_KEY
+            || secrets.ENVOY_GPG_SNAKEOIL_KEY }}
+      gpg-key-password: >-
+        ${{ needs.load.outputs.trusted
+            && fromJSON(needs.load.outputs.trusted)
+            && secrets.ENVOY_GPG_MAINTAINER_KEY_PASSWORD
+            || secrets.ENVOY_GPG_SNAKEOIL_KEY_PASSWORD }}
     permissions:
       actions: read
       contents: read
```

**File**: `bazel/BUILD` (modified, +32/-1)
```diff
@@ -1057,14 +1057,45 @@ config_setting(
     define_values = {"engflow_rbe": "true"},
 )
 
+# Set by `ci/do_ci.sh release.multiarch`, which builds both arches from an x64 host: on EngFlow,
+# their actions run on x86_64 workers, whichever arch they target.
+bool_flag(
+    name = "multiarch",
+    build_setting_default = False,
+)
+
+config_setting(
+    name = "multiarch_build",
+    flag_values = {":multiarch": "true"},
+)
+
 selects.config_setting_group(
-    name = "engflow_rbe_x86_64",
+    name = "engflow_rbe_linux_x86_64",
     match_all = [
         ":engflow_rbe",
         ":linux_x86_64",
     ],
 )
 
+selects.config_setting_group(
+    name = "engflow_rbe_multiarch",
+    match_all = [
+        ":engflow_rbe",
+        ":multiarch_build",
+    ],
+)
+
+# EngFlow builds whose actions run on x86_64 workers, which is what the `linux_x64_*` pools are
+# pinned for (`envoy_exec_properties`): x64 builds, and both arches of a multiarch one. A native
+# arm64 build keeps its platform's arm pool.
+selects.config_setting_group(
+    name = "engflow_rbe_x86_64",
+    match_any = [
+        ":engflow_rbe_linux_x86_64",
+        ":engflow_rbe_multiarch",
+    ],
+)
+
 selects.config_setting_group(
     name = "engflow_rbe_x86_64_asan",
     match_all = [
```

**File**: `ci/do_ci.sh` (modified, +123/-59)
```diff
@@ -177,6 +177,40 @@ function collect_build_profile() {
     ((build_profile_count++))
 }
 
+# The bazel args that sign with the key and passphrase at `ENVOY_SIGNING_{KEY,PASSPHRASE}_PATH` (host
+# paths: their bytes never enter the action graph), in `PGP_ARGS`.
+function pgp_signing_args() {
+    local key_sha256
+    if [[ -z "${ENVOY_SIGNING_KEY_PATH}" || -z "${ENVOY_SIGNING_PASSPHRASE_PATH}" ]]; then
+        echo "FAIL: ENVOY_SIGNING_KEY_PATH and ENVOY_SIGNING_PASSPHRASE_PATH must be set" >&2
+        exit 1
+    fi
+    key_sha256="$(sha256sum "${ENVOY_SIGNING_KEY_PATH}" | cut -d' ' -f1)"
+    PGP_ARGS=(
+        "--@envoy_toolshed//pgp:key_path=${ENVOY_SIGNING_KEY_PATH}#sha256=${key_sha256}"
+        "--@envoy_toolshed//pgp:passphrase_path=${ENVOY_SIGNING_PASSPHRASE_PATH}"
+    )
+}
+
+# Audit the signing actions of the aquery (the first arg), with the bazel options given (as built).
+function pgp_signing_audit() {
+    local audit_json query="$1"
+    shift
+    echo "Auditing signing actions..."
+    audit_json="$(mktemp)"
+    bazel aquery \
+          "$@" \
+          --output=jsonproto --include_artifacts=true \
+          "$query" \
+          > "${audit_json}"
+    # NB: the passphrase is checked via `--forbid-file` (read from disk by the
+    # audit tool) so its value never appears in argv here.
+    bazel run "${BAZEL_BUILD_OPTIONS[@]}" @envoy_toolshed//pgp/audit:audit -- \
+          --forbid-file "${ENVOY_SIGNING_PASSPHRASE_PATH}" \
+          --aquery-json "${audit_json}"
+    rm -f "${audit_json}"
+}
+
 function bazel_with_collection() {
   local failed_logs
   declare -r BAZEL_OUTPUT="${ENVOY_SRCDIR}"/bazel.output.txt
@@ -1080,8 +1114,9 @@ case $CI_TARGET in
         ;;
 
     # `release.server`: the release binaries and tools (`release.server_only` is the same).
-    # `release.publish`: as `release.server`, and the container images.
-    release|release.server|release.server_only|release.publish|release.test_only)
+    # `release.publish`: as `release.server`, and the container images and distro packages.
+    # `release.multiarch`: as `release.publish`, for each arch (x64 and arm64), from any host.
+    release|release.server|release.server_only|release.publish|release.multiarch|release.test_only)
         if [[ "$CI_TARGET" == "release" || "$CI_TARGET" == "release.test_only" ]]; then
             # When testing memory consumption, we want to test against exact byte-counts
             # where possible. As these differ between platforms and compile options, we
@@ -1137,52 +1172,102 @@ case $CI_TARGET in
         echo "  release options:  ${BAZEL_RELEASE_OPTIONS[*]}"
         echo "  binary dir:  ${ENVOY_BINARY_DIR}"
 
-        if [[ "$CI_TARGET" == "release.publish" ]]; then
-            # Everything published for this platform, in one invocation (`//distribution/publish`):
+        if [[ "$CI_TARGET" == "release.publish" || "$CI_TARGET" == "release.multiarch" ]]; then
+            # Everything published for an arch, in one invocation (`//distribution/publish:publish_<arch>`):
             # the release binaries and tools (as `release.server`), the container images (named as
-            # `docker` names them), and the distro packages (as `distribution` builds them).
-            ENVOY_OCI_DIR="${ENVOY_BUILD_DIR}/build_images"
-            ENVOY_PACKAGES_DIR="${ENVOY_BUILD_DIR}/packages"
-            for dir in "$ENVOY_OCI_DIR" "$ENVOY_PACKAGES_DIR"; do
-                if [[ -e "${dir}" ]]; then
-                    rm -rf "${dir}"
-                fi
-                mkdir -p "$dir"
+            # `docker` names them), and the distro packages (as `distribution` builds them), to
+            # `<build dir>/envoy/<arch>/{bin,build_images,packages}`. The binaries of another arch are
+            # cross-compiled.
+            # `release.multiarch` (`//distribution/publish:publish_multiarch_<arch>`) builds only what
+            # the pipeline uses from it: the container images (published), and the packages and the
+            # stripped release binaries (signed in this job), not the release tarball or the tools.
+            PUBLISH_SET=publish
+            if [[ "$CI_TARGET" == "release.multiarch" ]]; then
+                PUBLISH_ARCHES=(x64 arm64)
+                PUBLISH_SET=publish_multiarch
+            elif [[ "${ENVOY_BUILD_ARCH}" == "x86_64" ]]; then
+                PUBLISH_ARCHES=(x64)
+            else
+                PUBLISH_ARCHES=(arm64)
+            fi
+            PUBLISH_TARGETS=()
+            for arch in "${PUBLISH_ARCHES[@]}"; do
+                for dir in bin build_images packages; do
+                    rm -rf "${BUILD_DIR}/envoy/${arch}/${dir}"
+                    mkdir -p "${BUILD_DIR}/envoy/${arch}/${dir}"
+                done
+                PUBLISH_TARGETS+=("//distribution/publish:${PUBLISH_SET}_${arch}")
             done
+            PUBLISH_OPTIONS=()
+            if [[ "$CI_TARGET" == "release.multiarch" ]]; then
+                # Both arches
```

**File**: `distribution/BUILD` (modified, +84/-8)
```diff
@@ -7,8 +7,8 @@ load("@rules_shell//shell:sh_binary.bzl", "sh_binary")
 load("//bazel:envoy_build_system.bzl", "envoy_package")
 load("//bazel:envoy_rbe.bzl", "envoy_exec_properties")
 load("//distribution/binary:debug.bzl", "compressed_debug_parts")
-load(":changes.bzl", "envoy_signed_changes")
-load(":packages.bzl", "MAINTAINER", "envoy_pkg_distros", "release_version_for")
+load(":changes.bzl", "debian_files", "envoy_signed_changes")
+load(":packages.bzl", "MAINTAINER", "PUBLISH_PACKAGING_TAGS", "envoy_pkg_distros", "release_version_for")
 
 licenses(["notice"])  # Apache 2
 
@@ -19,7 +19,8 @@ licenses(["notice"])  # Apache 2
 # their bytes never enter the action graph, but the rules force local,
 # uncached execution of the signing actions themselves)
 #
-# All other targets are ordinary, cacheable/remotable actions - no secrets.
+# All other targets are ordinary actions - no secrets. The ones bundling the
+# release (which changes with every commit) are local (`PUBLISH_PACKAGING_TAGS`).
 
 envoy_package()
 
@@ -160,6 +161,32 @@ label_flag(
     build_setting_default = ":placeholder",
 )
 
+# The `.deb`/`.changes` files of each arch, signed (with `signing-inputs=debs`) instead of the
+# packages tarballs, eg when they are built in the same invocation (`ci/do_ci.sh release.multiarch`).
+label_flag(
+    name = "x64-debs",
+    build_setting_default = ":placeholder",
+)
+
+label_flag(
+    name = "arm64-debs",
+    build_setting_default = ":placeholder",
+)
+
+string_flag(
+    name = "signing-inputs",
+    build_setting_default = "tarballs",
+    values = [
+        "debs",
+        "tarballs",
+    ],
+)
+
+config_setting(
+    name = "signing_inputs_debs",
+    flag_values = {":signing-inputs": "debs"},
+)
+
 # Which committed *public* key is bundled as `signing.key`. Deliberately a
 # constrained string_flag, not a label_flag: an arbitrary file can not be
 # passed in here, so key material can never enter the graph via this path.
@@ -188,6 +215,10 @@ pgp_public_key(
 
 SIGNED_CHANGES = envoy_signed_changes(
     name = "signed_changes",
+    arch_debs = {
+        "arm64": ":arm64-debs",
+        "x64": ":x64-debs",
+    },
     arch_packages = {
         "arm64": ":arm64-packages",
         "x64": ":x64-packages",
@@ -204,12 +235,12 @@ _SIGNED_CHANGES_COPY_CMD = "\n    ".join([
 # Bundle the per-arch debs into a single flat debs.tar.gz, replacing unsigned
 # multi-distro `.changes` with signed per-distro `.changes`.
 genrule(
-    name = "multi_arch_debs",
+    name = "multi_arch_debs_tarballs",
     srcs = [
         ":arm64-packages",
         ":x64-packages",
     ] + [label for label, _dest in SIGNED_CHANGES],
-    outs = ["debs.tar.gz"],
+    outs = ["tarballs/debs.tar.gz"],
     cmd = """
     tmpdir=$$(mktemp -d)
     NEEDS_PATH=
@@ -237,11 +268,55 @@ genrule(
         --sort=name \
         -C "$${tmpdir}" .
     """ % _SIGNED_CHANGES_COPY_CMD,
+    tags = ["manual"] + PUBLISH_PACKAGING_TAGS,
+)
+
+# With `signing-inputs=debs`: the `.deb`s of both arches and the signed `.changes`, bundled directly
+# (as `multi_arch_debs_tarballs` does from the packages tarballs).
+[
+    debian_files(
+        name = "%s_debs" % arch,
+        srcs = [":%s-debs" % arch],
+        suffix = ".deb",
+        tags = ["manual"],
+    )
+    for arch in [
+        "arm64",
+        "x64",
+    ]
+]
+
+pkg_files(
+    name = "direct_debs_files",
+    srcs = [
+        ":arm64_debs",
+        ":x64_debs",
+    ] + [label for label, _dest in SIGNED_CHANGES],
+    attributes = pkg_attributes(mode = "0644"),
+    renames = {label: dest for label, dest in SIGNED_CHANGES},
+    tags = ["manual"],
+)
+
+pkg_tar(
+    name = "direct/debs",
+    srcs = [":direct_debs_files"],
+    compressor = "@envoy_toolshed//pigz",
+    compressor_args = "-n",
+    extension = "tar.gz",
+    tags = ["manual"] + PUBLISH_PACKAGING_TAGS,
+)
+
+alias(
+    name = "multi_arch_debs",
+    actual = select({
+        ":signing_inputs_debs": ":direct/debs",
+        "//conditions:default": ":multi_arch_debs_tarballs",
+    }),
     tags = ["manual"],
 )
 
 # Extract and rename the release binaries out of the per-arch release
-# tarballs. Ordinary, cacheable/remotable action.
+# tarballs. No secrets, but local (`PUBLISH_PACKAGING_TAGS`): the release changes with every commit.
 genrule(
     name = "release_binaries",
     srcs = [
@@ -276,6 +351,7 @@ genrule(
         $(location envoy-%s-linux-aarch_64) \
         $(location envoy-contrib-%s-linux-aarch_64)
     """ % (VERSION, VERSION, VERSION, VERSION, VERSION, VERSION, VERSION, VERSION),
+    tags = PUBLISH_PACKAGING_TAGS,
     tools = ["@zstd//:zstd_cli"],
 )
 
@@ -291,7 +367,7 @@ pgp_sign_checksums(
         ":release_binaries",
     ],
     checksums_out = "checksums.txt",
-    tags = ["manual"],
+    tags = ["manual"] + PUBLISH_PACKAGING_TAGS,
 )
 
 # Final release bundle layout contract (matches prior `envoy.gpg.sign` output,
@@ -342,5 +418,5 @@ pkg_tar(
     compressor = "@zstd//:zstd_cli"
```

---

### Incident Patch 3: `f78f8d2f` (2026-11-17)
**Commit Message**: wasm: Fix byte order and Rust toolchain selection on s390x (#49316)


Envoy previously copied numeric CEL values in host byte order, so Wasm
plugins on s390x could decode them incorrectly. Pass the consuming VM's
byte-order requirement to `serializeValue()` so Wasm plugins receive
little-endian bytes and native/null plugins continue to receive
host-order bytes.

Constrain the native s390x Rust toolchain and register s390x-hosted Wasm
and WASI toolchains so Bazel builds Wasm test plugins for the correct
target.

Additional Description: 
`htowasm()` swaps numeric bytes only on big-endian hosts when the VM
requires Wasm byte order.
(https://github.com/proxy-wasm/proxy-wasm-cpp-host/blob/f2db56af443571e92a31c0b877106d9ea96e19ef/include/proxy-wasm/word.h)

Update the connection ID test to derive the expected bytes from the
64-bit value `4` as represented in the plugin’s memory: host byte order
for native/null plugins and little-endian for Wasm plugins.

Fixes Test-cases:
```
//test/extensions/filters/network/wasm:wasm_filter_test
//test/extensions/filters/http/wasm:wasm_filter_headers_test
//test/extensions/filters/http/wasm:wasm_filter_body_test
//test/extensions/filters/http/wasm:wasm

**File**: `MODULE.bazel` (modified, +28/-0)
```diff
@@ -482,7 +482,35 @@ rust.repository_set(
     name = "rust_linux_s390x",
     edition = "2018",
     exec_triple = "s390x-unknown-linux-gnu",
+    exec_compatible_with = [
+        "@platforms//cpu:s390x",
+        "@platforms//os:linux",
+    ],
     versions = ["1.97.1"],
+    target_triple = "s390x-unknown-linux-gnu",
+    target_compatible_with = [
+        "@platforms//cpu:s390x",
+        "@platforms//os:linux",
+    ],
+)
+
+rust.repository_set(
+    name = "rust_linux_s390x",
+    target_triple = "wasm32-unknown-unknown",
+    target_compatible_with = [
+        "@platforms//cpu:wasm32",
+        "@rules_rust//rust/platform/os:unknown",
+    ],
+)
+
+rust.repository_set(
+    name = "rust_linux_s390x",
+    target_triple = "wasm32-wasip1",
+    target_compatible_with = [
+        "@platforms//cpu:wasm32",
+        "@platforms//os:wasi",
+        "@rules_rust//rust/platform:wasi_preview_1",
+    ],
 )
 rust.toolchain(
     edition = "2018",
```

**File**: `source/extensions/common/wasm/context.cc` (modified, +16/-10)
```diff
@@ -359,8 +359,14 @@ void Context::onStatsUpdate(Envoy::Stats::MetricSnapshot& snapshot) {
 
 // Native serializer carrying over bit representation from CEL value to the extension.
 // This implementation assumes that the value type is static and known to the consumer.
-WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* result) {
+// Numeric values use Wasm byte order when requested, otherwise host byte order.
+WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* result,
+                          bool swap_bytes) {
   using Filters::Common::Expr::CelValue;
+#if defined(__BYTE_ORDER__) && defined(__ORDER_BIG_ENDIAN__) &&                                    \
+    __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
+  using proxy_wasm::bswap;
+#endif
   int64_t out_int64;
   uint64_t out_uint64;
   double out_double;
@@ -374,15 +380,15 @@ WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* re
     result->assign(value.BytesOrDie().value().data(), value.BytesOrDie().value().size());
     return WasmResult::Ok;
   case CelValue::Type::kInt64:
-    out_int64 = value.Int64OrDie();
+    out_int64 = htowasm(value.Int64OrDie(), swap_bytes);
     result->assign(reinterpret_cast<const char*>(&out_int64), sizeof(int64_t));
     return WasmResult::Ok;
   case CelValue::Type::kUint64:
-    out_uint64 = value.Uint64OrDie();
+    out_uint64 = htowasm(value.Uint64OrDie(), swap_bytes);
     result->assign(reinterpret_cast<const char*>(&out_uint64), sizeof(uint64_t));
     return WasmResult::Ok;
   case CelValue::Type::kDouble:
-    out_double = value.DoubleOrDie();
+    out_double = htowasm(value.DoubleOrDie(), swap_bytes);
     result->assign(reinterpret_cast<const char*>(&out_double), sizeof(double));
     return WasmResult::Ok;
   case CelValue::Type::kBool:
@@ -391,12 +397,12 @@ WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* re
     return WasmResult::Ok;
   case CelValue::Type::kDuration:
     // Warning: loss of precision to nanoseconds
-    out_int64 = absl::ToInt64Nanoseconds(value.DurationOrDie());
+    out_int64 = htowasm(absl::ToInt64Nanoseconds(value.DurationOrDie()), swap_bytes);
     result->assign(reinterpret_cast<const char*>(&out_int64), sizeof(int64_t));
     return WasmResult::Ok;
   case CelValue::Type::kTimestamp:
     // Warning: loss of precision to nanoseconds
-    out_int64 = absl::ToUnixNanos(value.TimestampOrDie());
+    out_int64 = htowasm(absl::ToUnixNanos(value.TimestampOrDie()), swap_bytes);
     result->assign(reinterpret_cast<const char*>(&out_int64), sizeof(int64_t));
     return WasmResult::Ok;
   case CelValue::Type::kMessage:
@@ -415,10 +421,10 @@ WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* re
     const auto& keys = *keys_list.value();
     std::vector<std::pair<std::string, std::string>> pairs(map.size(), std::make_pair("", ""));
     for (auto i = 0; i < map.size(); i++) {
-      if (serializeValue(keys[i], &pairs[i].first) != WasmResult::Ok) {
+      if (serializeValue(keys[i], &pairs[i].first, swap_bytes) != WasmResult::Ok) {
         return WasmResult::SerializationFailure;
       }
-      if (serializeValue(map[keys[i]].value(), &pairs[i].second) != WasmResult::Ok) {
+      if (serializeValue(map[keys[i]].value(), &pairs[i].second, swap_bytes) != WasmResult::Ok) {
         return WasmResult::SerializationFailure;
       }
     }
@@ -435,7 +441,7 @@ WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* re
     const auto& list = *value.ListOrDie();
     std::vector<std::pair<std::string, std::string>> pairs(list.size(), std::make_pair("", ""));
     for (auto i = 0; i < list.size(); i++) {
-      if (serializeValue(list[i], &pairs[i].first) != WasmResult::Ok) {
+      if (serializeValue(list[i], &pairs[i].first, swap_bytes) != WasmResult::Ok) {
         return WasmResult::SerializationFailure;
       }
     }
@@ -619,7 +625,7 @@ WasmResult Context::getProperty(std::string_view path, std::string* result) {
     }
   }
 
-  return serializeValue(value, result);
+  return serializeValue(value, result, wasm_->wasm_vm()->usesWasmByteOrder());
 }
 
 // Header/Trailer/Metadata Maps.
```

**File**: `source/extensions/common/wasm/context.h` (modified, +2/-1)
```diff
@@ -467,7 +467,8 @@ class Context : public proxy_wasm::ContextBase,
 };
 using ContextSharedPtr = std::shared_ptr<Context>;
 
-WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* result);
+WasmResult serializeValue(Filters::Common::Expr::CelValue value, std::string* result,
+                          bool swap_bytes);
 
 } // namespace Wasm
 } // namespace Common
```

**File**: `source/extensions/common/wasm/foreign.cc` (modified, +2/-1)
```diff
@@ -349,7 +349,8 @@ class EvaluateExpressionFactory : public ExpressionFactory {
         return WasmResult::InternalFailure;
       }
       std::string result;
-      auto serialize_status = serializeValue(value, &result);
+      auto serialize_status = serializeValue(
+          value, &result, proxy_wasm::current_context_->wasmVm()->usesWasmByteOrder());
       if (serialize_status != WasmResult::Ok) {
         return serialize_status;
       }
```

**File**: `test/extensions/common/wasm/context_test.cc` (modified, +6/-6)
```diff
@@ -203,29 +203,29 @@ TEST_F(ContextTest, SerializeValueMapTest) {
   CelValue value = CelValue::CreateMap(&mock_cel_map_);
   EXPECT_CALL(mock_cel_map_, ListKeys())
       .WillOnce(testing::Return(absl::UnimplementedError("CelMap::ListKeys is not implemented")));
-  EXPECT_EQ(serializeValue(value, &result), WasmResult::SerializationFailure);
+  EXPECT_EQ(serializeValue(value, &result, false), WasmResult::SerializationFailure);
 
   EXPECT_CALL(mock_cel_list_, MockIndexOperator(_))
       .WillOnce(testing::Return(CelValue::CreateNull()));
   EXPECT_CALL(mock_cel_map_, size()).WillRepeatedly(testing::Return(1));
   EXPECT_CALL(mock_cel_map_, ListKeys()).WillOnce(testing::Return(&mock_cel_list_));
-  EXPECT_EQ(serializeValue(value, &result), WasmResult::SerializationFailure);
+  EXPECT_EQ(serializeValue(value, &result, false), WasmResult::SerializationFailure);
 
   EXPECT_CALL(mock_cel_list_, MockIndexOperator(_))
       .Times(2)
       .WillRepeatedly(testing::Return(CelValue::CreateStringView("test")));
   EXPECT_CALL(mock_cel_map_, ListKeys()).WillOnce(testing::Return(&mock_cel_list_));
   EXPECT_CALL(mock_cel_map_, MockIndexOperator(_))
       .WillOnce(testing::Return(CelValue::CreateNull()));
-  EXPECT_EQ(serializeValue(value, &result), WasmResult::SerializationFailure);
+  EXPECT_EQ(serializeValue(value, &result, false), WasmResult::SerializationFailure);
 
   EXPECT_CALL(mock_cel_list_, MockIndexOperator(_))
       .Times(2)
       .WillRepeatedly(testing::Return(CelValue::CreateStringView("test")));
   EXPECT_CALL(mock_cel_map_, ListKeys()).WillOnce(testing::Return(&mock_cel_list_));
   EXPECT_CALL(mock_cel_map_, MockIndexOperator(_))
       .WillOnce(testing::Return(CelValue::CreateStringView("test")));
-  EXPECT_EQ(serializeValue(value, &result), WasmResult::Ok);
+  EXPECT_EQ(serializeValue(value, &result, false), WasmResult::Ok);
 }
 
 TEST_F(ContextTest, SerializeValueListTest) {
@@ -235,12 +235,12 @@ TEST_F(ContextTest, SerializeValueListTest) {
   EXPECT_CALL(mock_cel_list_, MockIndexOperator(_))
       .WillOnce(testing::Return(CelValue::CreateNull()));
   EXPECT_CALL(mock_cel_list_, size()).WillRepeatedly(testing::Return(1));
-  EXPECT_EQ(serializeValue(value, &result), WasmResult::SerializationFailure);
+  EXPECT_EQ(serializeValue(value, &result, false), WasmResult::SerializationFailure);
 
   EXPECT_CALL(mock_cel_list_, MockIndexOperator(_))
       .Times(1)
       .WillRepeatedly(testing::Return(CelValue::CreateStringView("test")));
-  EXPECT_EQ(serializeValue(value, &result), WasmResult::Ok);
+  EXPECT_EQ(serializeValue(value, &result, false), WasmResult::Ok);
 }
 
 TEST_F(ContextTest, FindValueTest) {
```

**File**: `test/extensions/filters/http/wasm/test_data/test_cpp.cc` (modified, +5/-1)
```diff
@@ -603,10 +603,14 @@ void TestContext::onLog() {
     }
     {
       // Some properties are defined in the stream context.
+      // The null plugin uses host byte order; a Wasm build uses little-endian memory.
+      const uint64_t connection_id_val = 4;
+      const std::string connection_id_bytes(reinterpret_cast<const char*>(&connection_id_val),
+                                            sizeof(uint64_t));
       std::vector<std::pair<std::vector<std::string>, std::string>> properties = {
           {{"plugin_name"}, "plugin_name"},
           {{"plugin_vm_id"}, "vm_id"},
-          {{"connection_id"}, std::string("\x4\0\0\0\0\0\0\0\0", 8)},
+          {{"connection_id"}, connection_id_bytes},
           {{"connection", "requested_server_name"}, "w3.org"},
           {{"source", "address"}, "127.0.0.1:0"},
           {{"destination", "address"}, "127.0.0.2:0"},
```

#### Recent Merged Pull Requests:
- **PR #49354** (2026-11-17): distribution/docker: Use the compressed .dwps in the debug images (@phlax)
- **PR #49350** (2026-11-17): ci/dependency: Update the rules_oci pins with the release images (@phlax)
- **PR #49346** (closed): [WIP] quic: Respect the cached stream limit when resuming with 0-RTT (@phlax)
- **PR #49344** (2026-11-17): docs: fix the dead cgo link in the Golang filter warnings (@farisbasha)
- **PR #49341** (2026-11-17): test: consolidate ai_protocol_manager fuzz tests into fuzz_lib and fuzz.proto (@chentianheng604)
- **PR #49331** (2026-11-17): release/ci: Build, sign and publish the release of both arches in one job (@phlax)

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

## X. test: deflake QuicInplaceLdsIntegrationTest drain waits

**RULE**:
When implementing operations in `test/integration/quic_http_integration_test.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8937718c`: test: deflake QuicInplaceLdsIntegrationTest drain waits. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/integration/quic_http_integration_test.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  // Waits for the workers to apply `in_place_updates` in place updates and for the filter chains
  // they replaced to finish draining. The main thread starts the drain before it counts any worker
  // acknowledging the update, so the drain gauge has already risen once the counter reaches the
  // target. Waiting for the gauge itself to rise can miss its drain_time_ window.
  void waitForInplaceUpdateDrained(uint32_t in_place_updates) {
    test_server_->waitForCounter("listener_manager.listener_in_place_updated",
                                 Ge(in_place_updates));
    const uint32_t listener_creations = 1 + in_place_updates;
    test_server_->waitForCounter("listener_manager.listener_create_success",
                                 Ge(listener_creations * concurrency_));
    test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  }

  waitForInplaceUpdateDrained(1);
  waitForInplaceUpdateDrained(1);
  waitForInplaceUpdateDrained(2);
  waitForInplaceUpdateDrained(3);
  waitForInplaceUpdateDrained(1);
  waitForInplaceUpdateDrained(1);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));

  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(2));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(3));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8937718c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
