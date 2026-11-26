# Verification Protocol: Verification Protocol: Empirical Defect Shield for envoyproxy/envoy

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy/envoy",
  "source_url": "https://github.com/envoyproxy/envoy",
  "source_version": "baf651b8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T05:57:10.461Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-envoyproxy-envoy",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy/envoy](https://github.com/envoyproxy/envoy) (Revision: `baf651b8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T05:57:10.461Z`  
> **Learning ID**: `learn-github-envoyproxy-envoy`


## 1. Scope & Verification Target
- **Target Repository**: `envoyproxy/envoy` (Commit: `baf651b8`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): envoyproxy/envoy

> **Canonical Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T05:57:09.125Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `envoyproxy/envoy`
- **Description**: Cloud-native high-performance edge/middle/service proxy
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 29297 stars

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

### Incident Patch 1: `baf651b8` (2026-11-26)
**Commit Message**: dynamic_modules: fix cluster async host selection threading and handle lifetime (#49634)

**File**: `changelogs/current/bug_fixes/dynamic_modules__cluster-async-host-selection-module-lifetime.rst` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+Fixed the dynamic module cluster calling
+``envoy_dynamic_module_on_cluster_lb_cancel_host_selection``, which runs the Rust SDK's
+``AsyncHostSelectionHandle::cancel``, after its module was unloaded, when a request held an async
+host selection past the removal of its cluster. A pending selection now keeps the module loaded
+until that hook has run. The hook can still run after ``envoy_dynamic_module_on_cluster_lb_destroy``
+and ``envoy_dynamic_module_on_cluster_destroy``, though always before
+``envoy_dynamic_module_on_cluster_config_destroy``, so a module must not read load balancer or
+cluster state through ``lb_module_ptr`` in it. The cluster configuration, with its
+``envoy_dynamic_module_on_cluster_config_destroy`` hook, is now always destroyed on the main thread,
+also when a worker releases it last. The ABI documentation now states that Envoy calls the cancel
+hook once for every async handle, after a delivered result as well as on a cancellation, as every
+release with the hook has done, so a module releases the handle there rather than when it calls the
+completion callback.
```

**File**: `changelogs/current/bug_fixes/dynamic_modules__cluster-async-host-selection-thread.rst` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+Fixed the dynamic module cluster delivering an async host selection inline, on the thread that
+called ``envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete``, which the Rust
+SDK's ``EnvoyAsyncHostSelectionComplete::complete`` calls, when its load balancer had not yet served
+a request with a downstream connection, such as the main thread's load balancer or a worker's that
+only served async client streams. The router then ran on a module thread, and a completion made
+inside ``envoy_dynamic_module_on_cluster_lb_choose_host`` reached the router before it was ready.
+Envoy now delivers the result later, never inline, on the thread that owns the load balancer. It
+drops a completion made inside ``envoy_dynamic_module_on_cluster_lb_choose_host`` when that call
+answers synchronously, a second completion of a selection whose result it already delivered, unless
+another selection with the same context pointer has started on the same load balancer by then, and
+a completion for a load balancer that is already gone.
```

**File**: `source/extensions/clusters/dynamic_modules/BUILD` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ envoy_cc_library(
     ],
     deps = [
         ":persistent_host_set_lib",
+        "//envoy/event:dispatcher_interface",
         "//envoy/event:dispatcher_thread_deletable",
         "//envoy/http:async_client_interface",
         "//envoy/stats:stats_interface",
```

**File**: `source/extensions/clusters/dynamic_modules/abi_impl.cc` (modified, +41/-38)
```diff
@@ -1730,7 +1730,7 @@ void envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete(
     envoy_dynamic_module_type_cluster_lb_context_envoy_ptr context_envoy_ptr,
     envoy_dynamic_module_type_cluster_host_envoy_ptr host,
     envoy_dynamic_module_type_module_buffer details) {
-  using Envoy::Extensions::Clusters::DynamicModules::DynamicModuleClusterHandleSharedPtr;
+  using Envoy::Extensions::Clusters::DynamicModules::DynamicModuleCluster;
   using Envoy::Extensions::Clusters::DynamicModules::DynamicModuleLoadBalancer;
   auto* lb_raw = static_cast<DynamicModuleLoadBalancer*>(lb_envoy_ptr);
 
@@ -1740,60 +1740,63 @@ void envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete(
     details_str.assign(details.ptr, details.length);
   }
 
-  // The module may invoke this callback on any thread and race the load balancer destructor.
-  // Validate the raw pointer against the live registry and snapshot the state we need under the
-  // registry lock.
+  // The module may invoke this callback on any thread and race the load balancer destructor, so
+  // the raw pointer is validated against the live registry before anything is read through it.
   Envoy::Extensions::Clusters::DynamicModules::DynamicModuleAsyncHostSelectionRegistrySharedPtr
       selections;
-  Envoy::Event::Dispatcher* dispatcher = nullptr;
-  DynamicModuleClusterHandleSharedPtr handle;
+  std::weak_ptr<DynamicModuleCluster> cluster;
   const bool found = DynamicModuleLoadBalancer::withActiveInstance(
       lb_raw, [&](const DynamicModuleLoadBalancer& lb) {
         selections = lb.asyncSelections();
-        dispatcher = lb.workerDispatcher();
-        handle = lb.handle();
+        cluster = lb.handle()->cluster()->weak_from_this();
       });
   if (!found) {
+    ENVOY_LOG_TO_LOGGER(Envoy::Logger::Registry::getLog(Envoy::Logger::Id::dynamic_modules), debug,
+                        "async host selection for context {} completed after its load balancer "
+                        "was destroyed, dropped",
+                        context_envoy_ptr);
     return;
   }
 
   // Look the completing selection up by its own context. A load balancer serves many concurrent
-  // selections, so reading a single shared flag here would let a cancellation on one selection drop
-  // the completion of another. An absent entry means this selection was already completed or
+  // selections, so reading a single shared flag here would let a cancellation on one selection
+  // drop the completion of another. An absent entry means this selection was already completed or
   // cancelled and its `cancelable` destroyed, so the context must not be touched.
   std::shared_ptr<std::atomic<bool>> cancelled = selections->find(context_envoy_ptr);
   if (cancelled == nullptr) {
+    ENVOY_LOG_TO_LOGGER(Envoy::Logger::Registry::getLog(Envoy::Logger::Id::dynamic_modules), debug,
+                        "async host selection for context {} completed with no selection in "
+                        "flight, dropped",
+                        context_envoy_ptr);
     return;
   }
 
-  if (dispatcher != nullptr) {
-    // Post to the worker thread. The handle keeps the cluster alive until the callback runs. The
-    // flag is re-read inside the post because the router may cancel between the post and the run.
-    dispatcher->post([context_envoy_ptr, host, details_str = std::move(details_str),
-                      cancelled = std::move(cancelled), handle = std::move(handle)]() {
-      if (cancelled->load(std::memory_order_acquire)) {
-        return;
-      }
-      auto* context = getContext(context_envoy_ptr);
-      Envoy::Upstream::HostConstSharedPtr host_shared;
-      if (host != nullptr) {
-        host_shared = handle->cluster()->findHost(host);
-      }
-      context->onAsyncHostSelection(std::move(host_shared), std::string(details_str));
-    });
-    return;
-  }
-
-  // No worker dispatcher. Complete inline on the calling thread.
-  if (cancelled->load(std::memory_order_acquire)) {
-    return;
-  }
-  auto* context = getContext(context_envoy_ptr);
-  Envoy::Upstream::HostConstSharedPtr host_shared;
-  if (host != nullptr) {
-    host_shared = handle->cluster()->findHost(host);
-  }
-  context->onAsyncHostSelection(std::move(host_shared), std::move(details_str));
+  // Post even when the module completes on the load balancer's thread, so the router never runs on
+  // a module thread or inside choose_host. The post claims the selection when it runs, since the
+  // router may cancel first and the module may complete twice, and the cluster is held weakly, so a
+  // post destroyed unrun at server teardown cannot tear it down.
+  selections->postToLoadBalancerThread(
+      [context_envoy_ptr, host, details_str = std::move(details_str),
+       cancelled = std::move(cancelled), cluster = std::move(cluster)]() mutable {
+        if (cancelled->exchange(true, std::memory_order_acq_rel)) {
+          ENVOY_LOG_TO_LOGGER(
+             
```

**File**: `source/extensions/clusters/dynamic_modules/cluster.cc` (modified, +47/-27)
```diff
@@ -70,10 +70,22 @@ class MainThreadCleanup : public Event::DispatcherThreadDeletable, public Cleanu
 absl::StatusOr<std::shared_ptr<DynamicModuleClusterConfig>> DynamicModuleClusterConfig::create(
     const std::string& cluster_name, const std::string& cluster_config,
     Envoy::Extensions::DynamicModules::DynamicModulePtr module, Stats::Scope& stats_scope,
-    bool persistent_host_partitions_allowed) {
+    bool persistent_host_partitions_allowed, Event::Dispatcher& main_thread_dispatcher) {
+  // A worker slot payload or a pending async host selection can release the last reference on a
+  // worker, after the cluster is gone. The config's destroy hook and the module's unload then run
+  // on the main thread, where the config was created. The main dispatcher outlives every config,
+  // since the server stops its workers and destroys its cluster manager before the dispatcher.
   auto config = std::shared_ptr<DynamicModuleClusterConfig>(
       new DynamicModuleClusterConfig(cluster_name, cluster_config, std::move(module), stats_scope,
-                                     persistent_host_partitions_allowed));
+                                     persistent_host_partitions_allowed),
+      [&main_thread_dispatcher](DynamicModuleClusterConfig* config) {
+        if (Thread::MainThread::isMainOrTestThread()) {
+          delete config;
+          return;
+        }
+        main_thread_dispatcher.deleteInDispatcherThread(
+            std::make_unique<MainThreadCleanup>([config]() { delete config; }));
+      });
 
   // Resolve all required function pointers from the dynamic module.
 #define RESOLVE_SYMBOL(name, type, member)                                                         \
@@ -949,7 +961,9 @@ bool DynamicModuleLoadBalancer::withActiveInstance(
 
 DynamicModuleLoadBalancer::DynamicModuleLoadBalancer(
     const DynamicModuleClusterHandleSharedPtr& handle, const Upstream::PrioritySet& priority_set)
-    : handle_(handle), priority_set_(priority_set) {
+    : handle_(handle), priority_set_(priority_set),
+      async_selections_(std::make_shared<DynamicModuleAsyncHostSelectionRegistry>(
+          handle->cluster_->server_context_.threadLocal().dispatcher())) {
   // Register before invoking any module hook so a concurrent async host selection completion can
   // validate its raw pointer against a live instance.
   registerActiveDynamicModuleLoadBalancer(this);
@@ -1008,6 +1022,7 @@ DynamicModuleLoadBalancer::~DynamicModuleLoadBalancer() {
   // Unregister before tearing down module-side state so any concurrent async host selection
   // completion observes the instance as gone and drops the event.
   unregisterActiveDynamicModuleLoadBalancer(this);
+  async_selections_->onLoadBalancerDestroyed();
   if (in_module_lb_ != nullptr && handle_->cluster_->config()->on_cluster_lb_destroy_ != nullptr) {
     handle_->cluster_->config()->on_cluster_lb_destroy_(in_module_lb_);
   }
@@ -1019,20 +1034,21 @@ DynamicModuleLoadBalancer::chooseHost(Upstream::LoadBalancerContext* context) {
     return {nullptr};
   }
 
-  // Pre-capture the worker dispatcher and register the per-selection cancellation flag before
-  // calling into the module. The module's choose_host may spawn a background thread that calls
-  // async_host_selection_complete, which reads both. Publishing them beforehand establishes a
-  // happens-before relationship via the thread::spawn synchronization in the module.
-  //
-  // The flag and the registry entry are keyed by `context`, not held in a single slot on this load
-  // balancer, because a worker serves many concurrent async selections. A single slot would let a
-  // cancellation on one selection suppress the completion of an unrelated one.
+  // Capture the worker dispatcher for the worker timer callbacks. Sticky: keep any previously
+  // captured dispatcher when this call has no connection, since the worker dispatcher is stable for
+  // the worker's life.
   const auto* connection = context != nullptr ? context->downstreamConnection() : nullptr;
-  // Sticky: keep any previously captured dispatcher when this call has no connection, since the
-  // worker dispatcher is stable for the worker's life.
   if (connection != nullptr) {
     worker_dispatcher_.store(&connection->dispatcher(), std::memory_order_release);
   }
+  // Register the per-selection cancellation flag before calling into the module. The module's
+  // choose_host may spawn a background thread that calls async_host_selection_complete, which reads
+  // it. Publishing it beforehand establishes a happens-before relationship via the thread::spawn
+  // synchronization in the module.
+  //
+  // The flag and the registry entry are keyed by `context`, not held in a single slot on this load
+  // balancer, because a worker serves many concurrent async selections. A single slot would let a
+  // cancellation on one selection suppress the completion of an unrelated one.
   auto cancelled = std::make_shared<std::atomic
```

**File**: `source/extensions/clusters/dynamic_modules/cluster.h` (modified, +50/-19)
```diff
@@ -8,6 +8,7 @@
 #include "envoy/common/callback.h"
 #include "envoy/common/optref.h"
 #include "envoy/config/cluster/v3/cluster.pb.h"
+#include "envoy/event/dispatcher.h"
 #include "envoy/event/dispatcher_thread_deletable.h"
 #include "envoy/event/timer.h"
 #include "envoy/extensions/clusters/dynamic_modules/v3/cluster.pb.h"
@@ -82,12 +83,14 @@ class DynamicModuleClusterConfig {
    * @param stats_scope the stats scope for creating custom metrics.
    * @param persistent_host_partitions_allowed whether the module may opt the cluster into
    * persistent host partitions, which requires lb_policy CLUSTER_PROVIDED.
+   * @param main_thread_dispatcher the main thread's dispatcher, which destroys the config when its
+   * last reference is released on another thread.
    * @return a shared pointer to the config, or an error status.
    */
   static absl::StatusOr<std::shared_ptr<DynamicModuleClusterConfig>>
   create(const std::string& cluster_name, const std::string& cluster_config,
          Envoy::Extensions::DynamicModules::DynamicModulePtr module, Stats::Scope& stats_scope,
-         bool persistent_host_partitions_allowed);
+         bool persistent_host_partitions_allowed, Event::Dispatcher& main_thread_dispatcher);
 
   ~DynamicModuleClusterConfig();
 
@@ -452,6 +455,12 @@ class DynamicModuleClusterWorkerTimer {
  */
 class DynamicModuleAsyncHostSelectionRegistry {
 public:
+  // `dispatcher` belongs to the load balancer's thread. The registry holds no reference to the
+  // cluster, its handle or its config, since a module thread can hold it for a whole completion
+  // call. A `cancelable` pins only the config.
+  explicit DynamicModuleAsyncHostSelectionRegistry(Event::Dispatcher& dispatcher)
+      : dispatcher_(&dispatcher) {}
+
   /**
    * Records a new in-flight selection. The caller keeps a copy of `cancelled` in the `cancelable`
    * it returns to the router, so cancellation state outlives this entry.
@@ -480,13 +489,33 @@ class DynamicModuleAsyncHostSelectionRegistry {
     return it == entries_.end() ? nullptr : it->second;
   }
 
+  /**
+   * Posts `callback` to the load balancer's thread, or drops it once the load balancer is gone,
+   * since that thread may destroy its dispatcher next.
+   */
+  void postToLoadBalancerThread(Event::PostCb callback) {
+    absl::MutexLock lock(&dispatcher_mutex_);
+    if (dispatcher_ != nullptr) {
+      dispatcher_->post(std::move(callback));
+    }
+  }
+
+  /** Called by the load balancer's destructor, after which nothing is posted to its thread. */
+  void onLoadBalancerDestroyed() {
+    absl::MutexLock lock(&dispatcher_mutex_);
+    dispatcher_ = nullptr;
+  }
+
   /** Number of in-flight selections. */
   size_t sizeForTest() const {
     absl::MutexLock lock(&mutex_);
     return entries_.size();
   }
 
 private:
+  // Separate from `mutex_`, so the entry updates every chooseHost makes never wait behind a post.
+  absl::Mutex dispatcher_mutex_;
+  Event::Dispatcher* dispatcher_ ABSL_GUARDED_BY(dispatcher_mutex_);
   mutable absl::Mutex mutex_;
   absl::flat_hash_map<envoy_dynamic_module_type_cluster_lb_context_envoy_ptr,
                       std::shared_ptr<std::atomic<bool>>>
@@ -499,20 +528,21 @@ using DynamicModuleAsyncHostSelectionRegistrySharedPtr =
 /**
  * Async host selection handle that bridges the dynamic module's async host selection to Envoy's
  * LoadBalancerContext::onAsyncHostSelection. This is created when the module returns an async
- * pending result from choose_host, and destroyed after the module delivers the result or the
- * selection is canceled.
+ * pending result from choose_host, and destroyed after Envoy delivers the result or the selection
+ * is canceled.
  */
 class DynamicModuleAsyncHostSelectionHandle : public Upstream::AsyncHostSelectionHandle {
 public:
-  // `registry` and `context` drop this selection's entry on destruction. Both may be null or unset
-  // in unit tests that exercise cancellation without a registry.
+  // `config` supplies the module's cancel hook. `registry` and `context` drop this selection's
+  // entry on destruction. Each may be null or unset in unit tests that exercise cancellation
+  // without a module or a registry.
   DynamicModuleAsyncHostSelectionHandle(
       envoy_dynamic_module_type_cluster_lb_async_handle_module_ptr async_handle,
       envoy_dynamic_module_type_cluster_lb_module_ptr in_module_lb,
-      OnClusterLbCancelHostSelectionType cancel_fn, std::shared_ptr<std::atomic<bool>> cancelled,
+      DynamicModuleClusterConfigSharedPtr config, std::shared_ptr<std::atomic<bool>> cancelled,
       DynamicModuleAsyncHostSelectionRegistrySharedPtr registry = nullptr,
       envoy_dynamic_module_type_cluster_lb_context_envoy_ptr context = nullptr)
-      : async_handle_(async_handle), in_module_lb_(in_module_lb), cancel_fn_(cancel_fn),
+      : async_handle_(async_handle), in_module_lb_(in_module_lb), config_(std::move(config)),
         cancelled_(std::move(cancelled)), registr
```

**File**: `source/extensions/dynamic_modules/abi/abi.h` (modified, +53/-15)
```diff
@@ -11694,7 +11694,10 @@ typedef void* envoy_dynamic_module_type_cluster_host_envoy_ptr;
  * OWNERSHIP: Envoy owns the pointer. The pointer is valid only during the
  * envoy_dynamic_module_on_cluster_lb_choose_host call, unless async host selection is used. When
  * async host selection is used, the context remains valid until the async completion callback is
- * called or the selection is canceled.
+ * called or the selection is canceled. Envoy tells a module of a cancellation only when it calls
+ * envoy_dynamic_module_on_cluster_lb_cancel_host_selection, so a module that completes from another
+ * thread copies what it needs from the context inside
+ * envoy_dynamic_module_on_cluster_lb_choose_host.
  */
 typedef void* envoy_dynamic_module_type_cluster_lb_context_envoy_ptr;
 
@@ -11719,10 +11722,12 @@ typedef void* envoy_dynamic_module_type_cluster_scheduler_module_ptr;
  * envoy_dynamic_module_on_cluster_lb_choose_host when the module needs to perform asynchronous
  * work (e.g., DNS resolution) before selecting a host.
  *
- * OWNERSHIP: The module owns the pointer. The module must keep it valid until either
- * envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete is called or
- * envoy_dynamic_module_on_cluster_lb_cancel_host_selection is called. After either event, the
- * module may release the handle.
+ * OWNERSHIP: The module owns the pointer. The module must keep it valid until Envoy calls
+ * envoy_dynamic_module_on_cluster_lb_cancel_host_selection for it. Envoy calls that hook once for
+ * every handle, after it has delivered the result the module passed to
+ * envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete as well as when the
+ * request gives the selection up first, so the module releases the handle in that hook and not
+ * when it calls the completion callback.
  */
 typedef void* envoy_dynamic_module_type_cluster_lb_async_handle_module_ptr;
 
@@ -11773,7 +11778,9 @@ envoy_dynamic_module_type_cluster_config_module_ptr envoy_dynamic_module_on_clus
 
 /**
  * envoy_dynamic_module_on_cluster_config_destroy is called when the cluster configuration is
- * destroyed. The module should release any resources associated with the configuration.
+ * destroyed. The module should release any resources associated with the configuration. Envoy
+ * calls this on the main thread, once nothing that uses the configuration remains, which can be
+ * after the cluster when a worker slot payload or a pending async host selection outlives it.
  *
  * @param config_module_ptr is the pointer to the in-module cluster configuration.
  */
@@ -11869,13 +11876,30 @@ void envoy_dynamic_module_on_cluster_lb_choose_host(
     envoy_dynamic_module_type_cluster_lb_async_handle_module_ptr* async_handle_out);
 
 /**
- * envoy_dynamic_module_on_cluster_lb_cancel_host_selection is called when the stream is destroyed
- * before async host selection completes (e.g., stream timeout). After this call, the module must
- * not call envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete for this handle.
+ * envoy_dynamic_module_on_cluster_lb_cancel_host_selection is called once for every async handle
+ * that envoy_dynamic_module_on_cluster_lb_choose_host returned, when Envoy is done with the
+ * selection. That happens when the request gives the selection up before the result arrives, such
+ * as on a stream timeout, and also after Envoy has delivered the result the module passed to
+ * envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete. The module releases the
+ * handle here, and a module that must know whether it already completed the selection records
+ * whether it called the completion callback for the handle. After this call, the module must not
+ * call envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete for this handle.
+ *
+ * Envoy calls this on the thread that called envoy_dynamic_module_on_cluster_lb_choose_host for
+ * the selection, and a module thread can be inside
+ * envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete for the same handle at
+ * that moment. A request can hold the selection after its cluster was removed or replaced, so
+ * Envoy can call this after envoy_dynamic_module_on_cluster_lb_destroy and
+ * envoy_dynamic_module_on_cluster_destroy, though always before
+ * envoy_dynamic_module_on_cluster_config_destroy. The module therefore releases the handle here
+ * and touches only state it owns. It uses neither the load balancer nor the cluster through
+ * ``lb_module_ptr`` or any Envoy pointer it kept, and it does not read the selection's context,
+ * which may already be gone.
  *
  * This is optional. Only modules that use asynchronous host selection need to implement this.
  *
- * @param lb_module_ptr is the pointer to the in-module load balancer.
+ * @param lb_module_ptr is the pointer to the in-module load balancer, which
+ * envoy_dynamic_module_on_cluster_lb_destroy may already have de
```

**File**: `source/extensions/dynamic_modules/sdk/rust/src/abi.rs` (modified, +53/-15)
```diff
@@ -12027,7 +12027,10 @@ pub type envoy_dynamic_module_type_cluster_host_envoy_ptr = *mut ::std::os::raw:
  OWNERSHIP: Envoy owns the pointer. The pointer is valid only during the
  envoy_dynamic_module_on_cluster_lb_choose_host call, unless async host selection is used. When
  async host selection is used, the context remains valid until the async completion callback is
- called or the selection is canceled.*/
+ called or the selection is canceled. Envoy tells a module of a cancellation only when it calls
+ envoy_dynamic_module_on_cluster_lb_cancel_host_selection, so a module that completes from another
+ thread copies what it needs from the context inside
+ envoy_dynamic_module_on_cluster_lb_choose_host.*/
 pub type envoy_dynamic_module_type_cluster_lb_context_envoy_ptr = *mut ::std::os::raw::c_void;
 /** envoy_dynamic_module_type_cluster_scheduler_envoy_ptr is a raw pointer to the
  DynamicModuleClusterScheduler class in Envoy. This is used to schedule events to the main thread
@@ -12046,10 +12049,12 @@ pub type envoy_dynamic_module_type_cluster_scheduler_module_ptr = *mut ::std::os
  envoy_dynamic_module_on_cluster_lb_choose_host when the module needs to perform asynchronous
  work (e.g., DNS resolution) before selecting a host.
 
- OWNERSHIP: The module owns the pointer. The module must keep it valid until either
- envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete is called or
- envoy_dynamic_module_on_cluster_lb_cancel_host_selection is called. After either event, the
- module may release the handle.*/
+ OWNERSHIP: The module owns the pointer. The module must keep it valid until Envoy calls
+ envoy_dynamic_module_on_cluster_lb_cancel_host_selection for it. Envoy calls that hook once for
+ every handle, after it has delivered the result the module passed to
+ envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete as well as when the
+ request gives the selection up first, so the module releases the handle in that hook and not
+ when it calls the completion callback.*/
 pub type envoy_dynamic_module_type_cluster_lb_async_handle_module_ptr = *mut ::std::os::raw::c_void;
 /** envoy_dynamic_module_type_cluster_worker_slot_data_module_ptr is a module-owned opaque pointer
  stored in the cluster's worker thread-local slot. Envoy treats the value as opaque and never
@@ -12091,7 +12096,9 @@ unsafe extern "C" {
 #[cfg_attr(envoy_dynamic_module_dll, link(name = "envoy", kind = "raw-dylib"))]
 unsafe extern "C" {
     /** envoy_dynamic_module_on_cluster_config_destroy is called when the cluster configuration is
- destroyed. The module should release any resources associated with the configuration.
+ destroyed. The module should release any resources associated with the configuration. Envoy
+ calls this on the main thread, once nothing that uses the configuration remains, which can be
+ after the cluster when a worker slot payload or a pending async host selection outlives it.
 
  @param config_module_ptr is the pointer to the in-module cluster configuration.*/
     pub fn envoy_dynamic_module_on_cluster_config_destroy(
@@ -12194,13 +12201,30 @@ unsafe extern "C" {
 }
 #[cfg_attr(envoy_dynamic_module_dll, link(name = "envoy", kind = "raw-dylib"))]
 unsafe extern "C" {
-    /** envoy_dynamic_module_on_cluster_lb_cancel_host_selection is called when the stream is destroyed
- before async host selection completes (e.g., stream timeout). After this call, the module must
- not call envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete for this handle.
+    /** envoy_dynamic_module_on_cluster_lb_cancel_host_selection is called once for every async handle
+ that envoy_dynamic_module_on_cluster_lb_choose_host returned, when Envoy is done with the
+ selection. That happens when the request gives the selection up before the result arrives, such
+ as on a stream timeout, and also after Envoy has delivered the result the module passed to
+ envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete. The module releases the
+ handle here, and a module that must know whether it already completed the selection records
+ whether it called the completion callback for the handle. After this call, the module must not
+ call envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete for this handle.
+
+ Envoy calls this on the thread that called envoy_dynamic_module_on_cluster_lb_choose_host for
+ the selection, and a module thread can be inside
+ envoy_dynamic_module_callback_cluster_lb_async_host_selection_complete for the same handle at
+ that moment. A request can hold the selection after its cluster was removed or replaced, so
+ Envoy can call this after envoy_dynamic_module_on_cluster_lb_destroy and
+ envoy_dynamic_module_on_cluster_destroy, though always before
+ envoy_dynamic_module_on_cluster_config_destroy. The module therefore releases the handle here
+ and touches only state it owns. It uses neither the load balancer nor the cluster through
+ ``l
```

---

### Incident Patch 2: `e9ebe070` (2026-11-25)
**Commit Message**: quic: honor upstream network namespace for HTTP/3 (#48950)

Commit Message: quic: honor upstream network namespace for HTTP/3
Create QUIC sockets in the configured source network namespace, return a
closed socket if namespace entry fails, and preserve namespace metadata
for port migration.
Additional Description: Support Linux NNS
Risk Level: Medium
Testing: Added coverage for NNS entry/socket creation/restore ordering,
failed namespace entry, and IPv4/IPv6 metadata preservation.
Docs Changes: N/A
Release Notes: Added a QUIC bug-fix fragment.
Platform Specific Features: Network namespace switching is Linux-only.


## What changed

```mermaid
flowchart TD
    A["createConnectionSocket()<br/>(envoy_quic_utils.cc)"] --> B{"local_addr has<br/>networkNamespace()?"}
    B -- "yes" --> C["execInNetworkNamespace()<br/>create socket inside upstream netns"]
    B -- "no" --> D["create socket normally"]
    C -- "success" --> E["socket created in netns"]
    C -- "failure" --> F["closed IoSocketHandleImpl fallback<br/>+ error log with status"]
    E --> G["apply options, bind, connect"]
    F --> G
    D --> G
    G --> H["getAddressWithPort()<br/>updates port after getsockname()"]
    H --> 

**File**: `changelogs/current/bug_fixes/quic__upstream_network_namespace.rst` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+Fixed HTTP/3 upstream sockets ignoring the configured source address network namespace, including
+port migration.
```

**File**: `source/common/network/utility.cc` (modified, +4/-2)
```diff
@@ -321,14 +321,16 @@ Address::InstanceConstSharedPtr Utility::getAddressWithPort(const Address::Insta
     // Copy the sockaddr and update the port to preserve all address properties.
     sockaddr_in addr = *reinterpret_cast<const sockaddr_in*>(address.sockAddr());
     addr.sin_port = htons(static_cast<uint16_t>(port));
-    return std::make_shared<Address::Ipv4Instance>(&addr, &address.socketInterface());
+    return std::make_shared<Address::Ipv4Instance>(&addr, &address.socketInterface(),
+                                                   address.networkNamespace());
   }
   case Address::IpVersion::v6: {
     // Copy the sockaddr and update the port to preserve all address properties including scope ID.
     sockaddr_in6 addr = *reinterpret_cast<const sockaddr_in6*>(address.sockAddr());
     addr.sin6_port = htons(static_cast<uint16_t>(port));
     return std::make_shared<Address::Ipv6Instance>(addr, address.ip()->ipv6()->v6only(),
-                                                   &address.socketInterface());
+                                                   &address.socketInterface(),
+                                                   address.networkNamespace());
   }
   }
   PANIC("not handled");
```

**File**: `source/common/quic/BUILD` (modified, +2/-0)
```diff
@@ -547,7 +547,9 @@ envoy_cc_library(
         "//source/common/http:header_utility_lib",
         "//source/common/network:address_lib",
         "//source/common/network:connection_socket_lib",
+        "//source/common/network:default_socket_interface_lib",
         "//source/common/network:socket_option_factory_lib",
+        "//source/common/network:utility_lib",
         "//source/common/protobuf:utility_lib",
         "//source/common/quic:quic_io_handle_wrapper_lib",
         "//source/common/runtime:runtime_lib",
```

**File**: `source/common/quic/envoy_quic_utils.cc` (modified, +35/-3)
```diff
@@ -23,7 +23,9 @@
 #include "source/common/http/http_option_limits.h"
 #include "source/common/network/address_impl.h"
 #include "source/common/network/connection_socket_impl.h"
+#include "source/common/network/io_socket_handle_impl.h"
 #include "source/common/network/socket_option_factory.h"
+#include "source/common/network/utility.h"
 #include "source/common/protobuf/utility.h"
 #include "source/common/quic/quic_io_handle_wrapper.h"
 #include "source/common/runtime/runtime_features.h"
@@ -65,6 +67,31 @@ getLoopbackAddress(Network::Address::InstanceConstSharedPtr peer_address) {
                                                           &peer_address->socketInterface());
 }
 
+Network::ConnectionSocketPtr
+createDatagramSocket(const Network::Address::InstanceConstSharedPtr& local_addr,
+                     const Network::Address::InstanceConstSharedPtr& peer_addr,
+                     [[maybe_unused]] const std::optional<std::string>& netns,
+                     const Network::SocketCreationOptions& options) {
+  auto create_socket = [&]() {
+    return std::make_unique<Network::ConnectionSocketImpl>(Network::Socket::Type::Datagram,
+                                                           local_addr, peer_addr, options);
+  };
+#if defined(__linux__)
+  if (netns.has_value()) {
+    auto result = Network::Utility::execInNetworkNamespace(create_socket, netns->c_str());
+    if (!result.ok()) {
+      ENVOY_LOG_MISC(error, "Failed to create quic socket in network namespace {}: {}", *netns,
+                     result.status().ToString());
+      // The packet writer requires a non-null socket even on namespace failure.
+      return std::make_unique<Network::ConnectionSocketImpl>(
+          std::make_unique<Network::IoSocketHandleImpl>(), local_addr, peer_addr);
+    }
+    return *std::move(result);
+  }
+#endif
+  return create_socket();
+}
+
 } // namespace
 
 // TODO(danzh): this is called on each write. Consider to return an address instance on the stack if
@@ -226,18 +253,18 @@ Network::ConnectionSocketPtr createConnectionSocket(
     const Network::ConnectionSocket::OptionsSharedPtr& options, quic::QuicNetworkHandle network,
     std::function<void(Network::ConnectionSocket&, quic::QuicNetworkHandle)> custom_bind_func) {
   ASSERT(peer_addr != nullptr);
+  const auto netns = local_addr ? local_addr->networkNamespace() : std::nullopt;
   // NOTE: If changing the default cache size from 4 entries, make sure to profile it using
   // the benchmark test: //test/common/network:io_socket_handle_impl_benchmark
   //
   // If setting a higher cache size, try profiling std::deque instead of std::vector for the
   // `recent_received_addresses_` cache in
   // https://github.com/envoyproxy/envoy/blob/main/source/common/network/io_socket_handle_impl.h.
   constexpr size_t max_addresses_cache_size = 4u;
-  auto connection_socket = std::make_unique<Network::ConnectionSocketImpl>(
-      Network::Socket::Type::Datagram,
+  auto connection_socket = createDatagramSocket(
       // Use the loopback address if `local_addr` is null, to pass in the socket interface used to
       // create the IoHandle, without having to make the more expensive `getifaddrs` call.
-      local_addr ? local_addr : getLoopbackAddress(peer_addr), peer_addr,
+      local_addr ? local_addr : getLoopbackAddress(peer_addr), peer_addr, netns,
       Network::SocketCreationOptions{false, max_addresses_cache_size});
   connection_socket->setDetectedTransportProtocol("quic");
   if (!connection_socket->isOpen()) {
@@ -304,6 +331,11 @@ Network::ConnectionSocketPtr createConnectionSocket(
   }
 
   local_addr = connection_socket->connectionInfoProvider().localAddress();
+  if (local_addr && netns.has_value()) {
+    // Port migration creates new sockets from this address and must retain the namespace.
+    local_addr = local_addr->withNetworkNamespace(netns.value());
+    connection_socket->connectionInfoProvider().setLocalAddress(local_addr);
+  }
   ENVOY_LOG_MISC(trace, "connected to local address: {}",
                  local_addr != nullptr ? local_addr->asString() : "<none>");
   if (!Network::Socket::applyOptions(connection_socket->options(), *connection_socket,
```

**File**: `test/common/network/utility_test.cc` (modified, +5/-0)
```diff
@@ -391,6 +391,11 @@ TEST(NetworkUtility, GetAddressWithPort) {
       std::make_shared<Address::Ipv6Instance>("::1", 80, &custom_socket_interface);
   auto addr_v6_custom_sock_new_port = Utility::getAddressWithPort(*addr_v6_custom_sock, 8080);
   EXPECT_EQ(&custom_socket_interface, &addr_v6_custom_sock_new_port->socketInterface());
+
+  for (const auto& address : {addr_v4_custom_sock->withNetworkNamespace("/test/netns"),
+                              addr_v6_custom_sock->withNetworkNamespace("/test/netns")}) {
+    EXPECT_EQ("/test/netns", Utility::getAddressWithPort(*address, 0)->networkNamespace());
+  }
 }
 
 class NetworkUtilityGetLocalAddress : public testing::TestWithParam<Address::IpVersion> {};
```

**File**: `test/common/quic/BUILD` (modified, +1/-0)
```diff
@@ -502,6 +502,7 @@ envoy_cc_test(
         "//source/common/quic:envoy_quic_utils_lib",
         "//source/common/runtime:runtime_lib",
         "//test/mocks/api:api_mocks",
+        "//test/mocks/network:network_mocks",
         "//test/test_common:threadsafe_singleton_injector_lib",
         "@quiche//:quic_test_tools_test_utils_lib",
     ]),
```

**File**: `test/common/quic/envoy_quic_utils_test.cc` (modified, +35/-0)
```diff
@@ -2,6 +2,7 @@
 #include "source/common/runtime/runtime_features.h"
 
 #include "test/mocks/api/mocks.h"
+#include "test/mocks/network/mocks.h"
 #include "test/test_common/threadsafe_singleton_injector.h"
 #include "test/test_common/utility.h"
 
@@ -343,6 +344,40 @@ TEST(EnvoyQuicUtilsTest, QuicResetErrorToEnvoyResetReason) {
             Http::StreamResetReason::RemoteReset);
 }
 
+#if defined(__linux__)
+TEST(EnvoyQuicUtilsTest, CreateConnectionSocketInNetworkNamespace) {
+  testing::StrictMock<Network::MockSocketInterface> socket_interface(
+      std::vector<Network::Address::IpVersion>{Network::Address::IpVersion::v4});
+  Network::Address::InstanceConstSharedPtr local_addr =
+      std::make_shared<Network::Address::Ipv4Instance>("127.0.0.1", &socket_interface,
+                                                       "/proc/thread-self/ns/net");
+  const auto bind_addr = local_addr;
+  const auto peer_addr = std::make_shared<Network::Address::Ipv4Instance>("127.0.0.1", 54321);
+  testing::StrictMock<Api::MockLinuxOsSysCalls> netns_syscalls;
+  TestThreadsafeSingletonInjector<Api::LinuxOsSysCallsImpl> netns_injector{&netns_syscalls};
+  testing::InSequence sequence;
+  EXPECT_CALL(netns_syscalls, setns(_, CLONE_NEWNET)).WillOnce(Return(Api::SysCallIntResult{0, 0}));
+  EXPECT_CALL(socket_interface, socket(Network::Socket::Type::Datagram, local_addr, _))
+      .WillOnce([&](Network::Socket::Type type, Network::Address::InstanceConstSharedPtr address,
+                    const Network::SocketCreationOptions& options) {
+        return socket_interface.SocketInterfaceImpl::socket(type, address, options);
+      });
+  EXPECT_CALL(netns_syscalls, setns(_, CLONE_NEWNET)).WillOnce(Return(Api::SysCallIntResult{0, 0}));
+
+  auto connection_socket = createConnectionSocket(peer_addr, local_addr, nullptr);
+  EXPECT_TRUE(connection_socket->isOpen());
+  EXPECT_EQ(bind_addr->networkNamespace(), local_addr->networkNamespace());
+  EXPECT_EQ(local_addr, connection_socket->connectionInfoProvider().localAddress());
+  EXPECT_NE(0, local_addr->ip()->port());
+
+  local_addr = bind_addr;
+  EXPECT_CALL(netns_syscalls, setns(_, CLONE_NEWNET))
+      .WillOnce(Return(Api::SysCallIntResult{-1, EPERM}));
+  connection_socket = createConnectionSocket(peer_addr, local_addr, nullptr);
+  EXPECT_FALSE(connection_socket->isOpen());
+}
+#endif
+
 TEST(EnvoyQuicUtilsTest, CreateConnectionSocket) {
   Network::Address::InstanceConstSharedPtr local_addr =
       std::make_shared<Network::Address::Ipv4Instance>("127.0.0.1");
```

**File**: `test/integration/protocol_integration_test.cc` (modified, +0/-7)
```diff
@@ -249,13 +249,6 @@ TEST_P(ProtocolIntegrationTest, UpstreamRequestsPerConnectionMetricHandshakeFail
 // configured network namespace fails at connection time (the namespace file cannot be opened),
 // the request fails gracefully with a 503 instead of crashing on a null connection.
 TEST_P(ProtocolIntegrationTest, UpstreamConnectionCreationFailure) {
-  if (upstreamProtocol() == Http::CodecType::HTTP3) {
-    // QUIC upstream connections are created through a different code path which does not support
-    // binding to a network namespace, so the connection-time failure exercised here does not
-    // apply.
-    return;
-  }
-
   // This test intentionally fails to create the upstream connection, so bypass the check that
   // the test used upstream connections.
   testing_upstream_intentionally_ = true;
```

---

### Incident Patch 3: `d2d5ae33` (2026-11-25)
**Commit Message**: stats: extract Google gRPC client prefixes from xDS subscription counters (#49461)

## Problem

Google gRPC creates `grpc.<stat_prefix>` inside the subscription's stats
scope. The top-level extractor misses client counters under LDS, SDS and
ECDS. A dotted client prefix can also end up partly embedded in a
Prometheus metric family. Part of #21595.

## Solution

| Field | Change |
|---|---|
| Commit Message | stats: extract Google gRPC client prefixes from xDS
subscription counters |
| Additional Description | Match `google_grpc_client_creation`,
`streams_total` and `streams_closed_<code>` under the three subscription
scopes. Each rule is indexed by its first component and captures the
full prefix. The four xDS fixtures exercise extraction, including the
same dotted SDS client in both store modes. |
| Risk Level | Low. Tagged sinks use the extracted family name. The raw
counter can still be looked up by its full path. |
| Docs Changes / Release Notes |
`changelogs/current/minor_behavior_changes/stats__grpc-stat-prefix-tag-extraction.rst`
describes the counters and legacy name ambiguity. |

The LDS test that rejects an unknown protobuf Any still verifies the
rejection counter. It ski

**File**: `changelogs/current/minor_behavior_changes/stats__grpc-stat-prefix-tag-extraction.rst` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+The default tag extractor now uses the full Google gRPC client stat prefix as
+``envoy.google_grpc_client_prefix`` for LDS, SDS and ECDS ``google_grpc_client_creation``, ``streams_total`` and
+``streams_closed_<code>`` counters. In legacy tag extraction, SDS and ECDS flat names with
+two possible ``.grpc.`` separators are left without a client tag. Flat counter names are preserved.
```

**File**: `source/common/config/well_known_names.cc` (modified, +15/-0)
```diff
@@ -9,6 +9,10 @@ namespace {
 
 const absl::string_view TAG_VALUE_REGEX = R"([^\.]+)";
 
+// Counters created by Grpc::GoogleAsyncClientImpl in the client scope.
+constexpr absl::string_view GOOGLE_GRPC_STAT_REGEX =
+    R"((?:google_grpc_client_creation|streams_(?:total|closed_[0-9]+)))";
+
 // To allow for more readable regular expressions to be declared below, and to
 // reduce duplication, define a few common pattern substitutions for regex
 // segments.
@@ -23,6 +27,10 @@ std::string expandRegex(const std::string& regex) {
               {"<TLS_VERSION>", R"(TLSv\d\.\d)"},
               // A generic name can contain any character except dots.
               {"<TAG_VALUE>", TAG_VALUE_REGEX},
+              {"<GOOGLE_GRPC_STAT>", GOOGLE_GRPC_STAT_REGEX},
+              // Both the resource and client names may contain ".grpc.". If a second delimiter
+              // could also introduce a client, the first alternative leaves the capture empty.
+              {"<RESOURCE_GRPC_CLIENT>", R"(.+?\.grpc\.(?:(?:.*\.)?grpc\..+\.|((.+)\.)))"},
               // Route names may contain dots and slashes in addition to
               // alphanumerics, underscores, and dashes.
               {"<ROUTE_CONFIG_NAME>", R"([\w-\./]+)"},
@@ -257,6 +265,13 @@ TagNameValues::TagNameValues() {
 
   // grpc.(<stat_prefix>).**
   addTokenized(GOOGLE_GRPC_CLIENT_PREFIX, "grpc.$.**");
+  // Capture the full client prefix before the counter in a subscription scope.
+  addRe2(GOOGLE_GRPC_CLIENT_PREFIX, R"(^listener_manager\.lds\.grpc\.((.+)\.)<GOOGLE_GRPC_STAT>$)",
+         ".grpc.");
+  addRe2(GOOGLE_GRPC_CLIENT_PREFIX, R"(^sds\.<RESOURCE_GRPC_CLIENT><GOOGLE_GRPC_STAT>$)", ".grpc.");
+  addRe2(GOOGLE_GRPC_CLIENT_PREFIX,
+         R"(^extension_config_discovery\.<TAG_VALUE>\.<RESOURCE_GRPC_CLIENT><GOOGLE_GRPC_STAT>$)",
+         ".grpc.");
 
   // listener.[<address>.]ssl.certificate.(<cert_name>).<metric_name> or
   // cluster.[<cluster_name>.]ssl.certificate.(<cert_name>).<metric_name>
```

**File**: `test/common/stats/tag_extractor_impl_test.cc` (modified, +36/-0)
```diff
@@ -636,6 +636,42 @@ TEST(TagExtractorTest, ExtAuthzTagExtractors) {
                          {grpc_cluster, ext_authz_prefix});
 }
 
+TEST(TagExtractorTest, GoogleGrpcClientPrefixTagExtractors) {
+  DefaultTagRegexTester tester;
+  const auto& names = Config::TagNames::get();
+  const Tag client{names.GOOGLE_GRPC_CLIENT_PREFIX, "control.example"};
+  const Tag secret{names.XDS_RESOURCE_NAME, "cert"};
+
+  tester.testRegex("grpc.accesslog.streams_closed_14", "grpc.streams_closed_14",
+                   {{names.GOOGLE_GRPC_CLIENT_PREFIX, "accesslog"}});
+  tester.testRegex("listener_manager.lds.grpc.control.example.streams_total",
+                   "listener_manager.lds.grpc.streams_total", {client});
+  tester.testRegex("sds.cert.grpc.control.example.streams_closed_12", "sds.grpc.streams_closed_12",
+                   {secret, client});
+  tester.testRegex(
+      "extension_config_discovery.http_filter.payments.v1.grpc.control.example.streams_total",
+      "extension_config_discovery.http_filter.payments.v1.grpc.streams_total", {client});
+
+  tester.testRegex("listener_manager.lds.grpc.control.example.google_grpc_client_creation",
+                   "listener_manager.lds.grpc.google_grpc_client_creation", {client});
+
+  // A resource can contain ".grpc." even when the metric is unrelated to the gRPC client.
+  tester.testRegex("sds.cert.grpc.prod.key_rotation_failed", "sds.grpc.prod.key_rotation_failed",
+                   {secret});
+  tester.testRegex("extension_config_discovery.http_filter.payments.grpc.prod.config_reload",
+                   "extension_config_discovery.http_filter.payments.grpc.prod.config_reload", {});
+  tester.testRegex("listener_manager.lds.grpc.control.example.streams_closed_invalid",
+                   "listener_manager.lds.grpc.control.example.streams_closed_invalid", {});
+
+  // The flat name cannot distinguish resource "cert" / client "prod.grpc.control" from
+  // resource "cert.grpc.prod" / client "control".
+  tester.testRegex("sds.cert.grpc.prod.grpc.control.streams_total",
+                   "sds.grpc.prod.grpc.control.streams_total", {secret});
+  tester.testRegex(
+      "extension_config_discovery.http_filter.payments.grpc.grpc.control.streams_closed_0",
+      "extension_config_discovery.http_filter.payments.grpc.grpc.control.streams_closed_0", {});
+}
+
 TEST(TagExtractorTest, ExtractRegexPrefix) {
   TagExtractorPtr tag_extractor; // Keep tag_extractor in this scope to prolong prefix lifetime.
   auto extractRegexPrefix = [&tag_extractor](const std::string& regex) -> absl::string_view {
```

**File**: `test/integration/BUILD` (modified, +2/-0)
```diff
@@ -2684,7 +2684,9 @@ envoy_cc_test(
         "//source/common/event:dispatcher_lib",
         "//source/common/network:connection_lib",
         "//source/common/network:utility_lib",
+        "//source/common/runtime:runtime_features_lib",
         "//source/common/ssl:ssl_lib",
+        "//source/common/stats:thread_local_store_lib",
         "//source/common/tls:context_config_lib",
         "//source/common/tls:context_lib",
         "//source/common/tls:utility_lib",
```

**File**: `test/integration/extension_discovery_integration_test.cc` (modified, +1/-4)
```diff
@@ -61,10 +61,7 @@ class ExtensionDiscoveryIntegrationTest : public Grpc::GrpcClientIntegrationPara
                                           public HttpIntegrationTest {
 public:
   ExtensionDiscoveryIntegrationTest() : HttpIntegrationTest(Http::CodecType::HTTP1, ipVersion()) {
-    // TODO(ggreenway): add tag extraction rules.
-    // Missing stat tag-extraction rule for stat
-    // 'listener_manager.lds.grpc.lds_cluster.streams_closed_10' and stat_prefix 'lds_cluster'.
-    skip_tag_extraction_rule_check_ = true;
+    skip_tag_extraction_rule_check_ = false;
   }
 
   void addDynamicFilter(const std::string& name, bool apply_without_warming,
```

**File**: `test/integration/listener_extension_discovery_integration_test.cc` (modified, +1/-5)
```diff
@@ -30,11 +30,7 @@ class ListenerExtensionDiscoveryIntegrationTestBase : public Grpc::GrpcClientInt
                                                 const std::string& listener_filter_name)
       : HttpIntegrationTest(downstream_type, ipVersion(), config),
         filter_name_(listener_filter_name), port_name_("http") {
-    // TODO(ggreenway): add tag extraction rules.
-    // Missing stat tag-extraction rule for stat
-    // 'extension_config_discovery.tcp_listener_filter.foo.grpc.ecds_cluster.streams_closed_7' and
-    // stat_prefix 'ecds_cluster'.
-    skip_tag_extraction_rule_check_ = true;
+    skip_tag_extraction_rule_check_ = false;
   }
 
   void addDynamicFilterWithType(const std::string& filter_name,
```

**File**: `test/integration/listener_lds_integration_test.cc` (modified, +5/-8)
```diff
@@ -40,10 +40,7 @@ class ListenerIntegrationTestBase : public HttpIntegrationTest {
 
   ListenerIntegrationTestBase(Network::Address::IpVersion version, const std::string& config)
       : HttpIntegrationTest(Http::CodecType::HTTP1, version, config) {
-    // TODO(ggreenway): add tag extraction rules.
-    // Missing stat tag-extraction rule for stat
-    // 'listener_manager.lds.grpc.lds_cluster.streams_closed_1' and stat_prefix 'lds_cluster'.
-    skip_tag_extraction_rule_check_ = true;
+    skip_tag_extraction_rule_check_ = false;
   }
 
   ~ListenerIntegrationTestBase() override { resetConnections(); }
@@ -379,6 +376,9 @@ INSTANTIATE_TEST_SUITE_P(IpVersionsAndGrpcTypes, ListenerMultiAddressesIntegrati
 
 // Tests that an update with an unknown filter config proto is rejected.
 TEST_P(ListenerIntegrationTest, CleanlyRejectsUnknownFilterConfigProto) {
+  // The rejected listener contains an unknown Any. The fixture's tag check reads /config_dump,
+  // which cannot serialize that Any to JSON.
+  skip_tag_extraction_rule_check_ = true;
   on_server_init_function_ = [&]() {
     createLdsStream();
     envoy::config::listener::v3::Listener listener =
@@ -1618,10 +1618,7 @@ class ListenerFilterIntegrationTest : public BaseIntegrationTest,
           stat_prefix: tcp_stats
           cluster: cluster_0
 )EOF") {
-    // TODO(ggreenway): add tag extraction rules.
-    // Missing stat tag-extraction rule for stat
-    // 'listener_manager.lds.grpc.lds_cluster.streams_closed_1' and stat_prefix 'lds_cluster'.
-    skip_tag_extraction_rule_check_ = true;
+    skip_tag_extraction_rule_check_ = false;
   }
 
   ~ListenerFilterIntegrationTest() override {
```

**File**: `test/integration/sds_dynamic_integration_test.cc` (modified, +24/-11)
```diff
@@ -14,6 +14,8 @@
 #include "source/common/http/utility.h"
 #include "source/common/network/connection_impl.h"
 #include "source/common/network/utility.h"
+#include "source/common/runtime/runtime_features.h"
+#include "source/common/stats/thread_local_store.h"
 
 #ifdef ENVOY_ENABLE_QUIC
 #include "source/common/quic/client_connection_factory_impl.h"
@@ -96,22 +98,14 @@ class SdsDynamicIntegrationBaseTest : public Grpc::BaseGrpcClientIntegrationPara
   SdsDynamicIntegrationBaseTest()
       : HttpIntegrationTest(Http::CodecType::HTTP1, GetParam().ip_version),
         test_quic_(GetParam().test_quic) {
-    // TODO(ggreenway): add tag extraction rules.
-    // Missing stat tag-extraction rule for stat
-    // 'sds.client_cert.grpc.sds_cluster.lyft.com.streams_closed_12' and stat_prefix
-    // 'sds_cluster.lyft.com'.
-    skip_tag_extraction_rule_check_ = true;
+    skip_tag_extraction_rule_check_ = false;
   }
 
   SdsDynamicIntegrationBaseTest(Http::CodecType downstream_protocol,
                                 Network::Address::IpVersion version, const std::string& config)
       : HttpIntegrationTest(downstream_protocol, version, config),
         test_quic_(GetParam().test_quic) {
-    // TODO(ggreenway): add tag extraction rules.
-    // Missing stat tag-extraction rule for stat
-    // 'sds.client_cert.grpc.sds_cluster.lyft.com.streams_closed_12' and stat_prefix
-    // 'sds_cluster.lyft.com'.
-    skip_tag_extraction_rule_check_ = true;
+    skip_tag_extraction_rule_check_ = false;
   }
 
   Network::Address::IpVersion ipVersion() const override { return GetParam().ip_version; }
@@ -756,6 +750,9 @@ TEST_P(SdsDynamicDownstreamIntegrationTest, RotatedCertificateReleasedByLastConn
 // A test that SDS server send a good server secret for a static listener.
 // The first ssl request should be OK.
 TEST_P(SdsDynamicDownstreamIntegrationTest, BasicSuccess) {
+  // The mode is selected at startup. Exercise both paths using the existing IP-version matrix.
+  Runtime::maybeSetRuntimeGuard("envoy.reloadable_features.enable_stats_explicit_tags",
+                                useExplicitStatsTags());
   on_server_init_function_ = [this]() {
     createSdsStream(*sdsUpstream());
     sendSdsResponse(getServerSecretRsa());
@@ -767,6 +764,19 @@ TEST_P(SdsDynamicDownstreamIntegrationTest, BasicSuccess) {
   };
   testRouterHeaderOnlyRequestAndResponse(&creator, dataPlaneUpstreamIndex());
 
+  if (clientType() == Grpc::ClientType::GoogleGrpc) {
+    auto* store = dynamic_cast<Stats::ThreadLocalStoreImpl*>(&test_server_->statStore());
+    ASSERT_NE(nullptr, store);
+    EXPECT_EQ(useExplicitStatsTags(), store->useExplicitTags());
+    for (const auto* counter :
+         {"google_grpc_client_creation", "streams_total", "streams_closed_12"}) {
+      expectStatTags(fmt::format("sds.server_cert_rsa.grpc.sds_cluster.lyft.com.{}", counter),
+                     fmt::format("sds.grpc.{}", counter),
+                     {{"envoy.xds_resource_name", server_cert_rsa_},
+                      {"envoy.google_grpc_client_prefix", "sds_cluster.lyft.com"}});
+    }
+  }
+
   // Success
   EXPECT_EQ(1, test_server_->counter("sds.server_cert_rsa.update_success")->value());
   EXPECT_EQ(0, test_server_->counter("sds.server_cert_rsa.update_rejected")->value());
@@ -1804,6 +1814,9 @@ TEST_P(SdsDynamicClusterIntegrationTest, ClusterRefersNonExistentSdsCluster) {
 // Validate that Envoy starts fine with a cyclic dependency between CDS and SDS clusters
 // i.e. CDS cluster refers to dynamic SDS cluster and SDS cluster refers to the same CDS cluster.
 TEST_P(SdsDynamicClusterIntegrationTest, CdsSdsCyclicDependency) {
+  // Google gRPC also uses this name as a stat prefix. Distinguish it from
+  // server.dynamic_unknown_fields.
+  sds_cluster_name_ = "cyclic_sds_cluster";
   on_server_init_function_ = [this]() {
     {
       // CDS.
@@ -1812,10 +1825,10 @@ TEST_P(SdsDynamicClusterIntegrationTest, CdsSdsCyclicDependency) {
       result = xds_connection_->waitForNewStream(*dispatcher_, xds_stream_);
       RELEASE_ASSERT(result, result.message());
       xds_stream_->startGrpcStream();
+      dynamic_cluster_.set_name(sds_cluster_name_);
       sendCdsResponse(true);
     }
   };
-  sds_cluster_name_ = "dynamic";
   valid_sds_cluster_ = false;
   // The secret can never be fetched: the dynamic cluster warms once the SDS initial fetch times
   // out, which is what lets the server start. Keep that short.
```

#### Recent Merged Pull Requests:
- **PR #49634** (2026-11-26): dynamic_modules: fix cluster async host selection threading and handle lifetime (@agrawroh)
- **PR #49617** (2026-11-25): [bp/v1.40] Dynamic modules fixes (@dcillera)
- **PR #49614** (2026-11-25): deps: Bump toolshed actions -> actions-v0.4.34 (@dependency-envoy[bot])
- **PR #49610** (closed): rust: use the sysroot directory consistently as a bazel input (@dcillera)
- **PR #49608** (closed): quic: Report a zero stream limit before sending 0-RTT early data (@phlax)
- **PR #49605** (2026-11-25): [bp/1.40] flakes: Stack (@phlax)

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

## X. dynamic_modules: fix cluster async host selection threading and handle lifetime

**RULE**:
When implementing operations in `changelogs/current/bug_fixes/dynamic_modules__cluster-async-host-selection-module-lifetime.rst`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `baf651b8`: dynamic_modules: fix cluster async host selection threading and handle lifetime. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelogs/current/bug_fixes/dynamic_modules__cluster-async-host-selection-module-lifetime.rst`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
Fixed the dynamic module cluster calling
``envoy_dynamic_module_on_cluster_lb_cancel_host_selection``, which runs the Rust SDK's
``AsyncHostSelectionHandle::cancel``, after its module was unloaded, when a request held an async
host selection past the removal of its cluster. A pending selection now keeps the module loaded
until that hook has run. The hook can still run after ``envoy_dynamic_module_on_cluster_lb_destroy``
and ``envoy_dynamic_module_on_cluster_destroy``, though always before
``envoy_dynamic_module_on_cluster_config_destroy``, so a module must not read load balancer or
cluster state through ``lb_module_ptr`` in it. The cluster configuration, with its
``envoy_dynamic_module_on_cluster_config_destroy`` hook, is now always destroyed on the main thread,
also when a worker releases it last. The ABI documentation now states that Envoy calls the cancel
hook once for every async handle, after a delivered result as well as on a cancellation, as every
release with the hook has done, so a module releases the handle there rather than when it calls the
completion callback.
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `baf651b8` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
