# Verification Protocol: Verification Protocol: Empirical Defect Shield for envoyproxy-envoy-learnings

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy-envoy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T15:09:20.033Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-envoyproxy-envoy-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy-envoy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T15:09:20.033Z`  
> **Learning ID**: `LEARN-EVO-envoyproxy-envoy-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `envoyproxy-envoy-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source**: github ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Source Version**: `a8595edc`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T15:09:14.189Z  
> **Learning ID**: `learn-github-envoyproxy-envoy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): envoyproxy/envoy

> **Canonical Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T15:09:14.184Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `envoyproxy/envoy`
- **Description**: Cloud-native high-performance edge/middle/service proxy
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 29276 stars

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

### Incident Patch 1: `a8595edc` (2026-11-22)
**Commit Message**: http: close idle HTTP/1 downstream connections without delayed close (#48884)

Commit Message: http: close idle HTTP/1 downstream connections without
delayed close

When the drain timer fires on an HTTP/1 connection that carried no
request since the drain sequence started, close it with `FlushWrite`
instead of `FlushWriteAndDelay`. That's the connection idle timeout
path, and also max connection duration or a listener drain on a
connection that happens to be idle.

Additional Description:
Delayed close exists so a client that is still sending can read a
response Envoy wrote early before it gets an RST. An idle connection has
no response to read, so the delay only holds the socket open for
`delayed_close_timeout` with reads disabled and no FIN sent. A pooling
client that keeps no idle timeout of its own will happily reuse the
socket in that window, and its request is never answered. We hit this
with a pooling L7 proxy in front of Envoy that surfaced those as 503s.
nginx's `keepalive_timeout` sends the FIN right away, so it never showed
up there.

The delay is kept whenever a request came in after the drain started,
since its response (with `Connection: close`) may have just gone out

**File**: `changelogs/current/minor_behavior_changes/http__http1-skip-delayed-close-on-idle-drain.rst` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+An HTTP/1 downstream connection that carries no request between the start of a drain sequence and
+its :ref:`drain timeout
+<envoy_v3_api_field_extensions.filters.network.http_connection_manager.v3.HttpConnectionManager.drain_timeout>`,
+such as one closed by the connection idle timeout, is now closed without waiting for the
+:ref:`delayed close timeout
+<envoy_v3_api_field_extensions.filters.network.http_connection_manager.v3.HttpConnectionManager.delayed_close_timeout>`.
+There is no response on such a connection for the client to read, and while the delayed close was
+pending Envoy ignored any request a pooling client sent on it, so that request was never answered.
+This change can be reverted by setting the runtime guard
+``envoy.reloadable_features.http1_skip_delayed_close_on_idle_drain`` to ``false``.
```

**File**: `source/common/http/conn_manager_impl.cc` (modified, +8/-1)
```diff
@@ -527,6 +527,7 @@ RequestDecoder& ConnectionManagerImpl::newStream(ResponseEncoder& response_encod
       *this, response_encoder.getStream().bufferLimit(), std::move(downstream_stream_account));
 
   accumulated_requests_++;
+  idle_since_drain_start_ = false;
   if (config_->maxRequestsPerConnection() > 0 &&
       accumulated_requests_ >= config_->maxRequestsPerConnection()) {
     if (codec_->protocol() < Protocol::Http2) {
@@ -980,7 +981,12 @@ void ConnectionManagerImpl::onDrainTimeout() {
   ASSERT(drain_state_ != DrainState::NotDraining);
   codec_->goAway();
   drain_state_ = DrainState::Closing;
-  checkForDeferredClose(false);
+  // An HTTP/1 connection that carried no request while draining has no response for the client to
+  // read, so delaying the close would only hold the socket open and ignore any request sent on it.
+  checkForDeferredClose(
+      /*skip_delay_close=*/idle_since_drain_start_ && codec_->protocol() < Protocol::Http2 &&
+      Runtime::runtimeFeatureEnabled(
+          "envoy.reloadable_features.http1_skip_delayed_close_on_idle_drain"));
   // Only once the end of the drain window is near: a drain sequence started earlier (e.g. by a
   // response) must not cut the tunneling streams short while other traffic on the connection can
   // still complete normally.
@@ -1936,6 +1942,7 @@ void ConnectionManagerImpl::ActiveStream::disarmRequestTimeout() {
 void ConnectionManagerImpl::startDrainSequence() {
   ASSERT(drain_state_ == DrainState::NotDraining);
   drain_state_ = DrainState::Draining;
+  idle_since_drain_start_ = streams_.empty();
   codec_->shutdownNotice();
   drain_timer_ = dispatcher_->createTimer([this]() -> void { onDrainTimeout(); });
   drain_timer_->enableTimer(config_->drainTimeout());
```

**File**: `source/common/http/conn_manager_impl.h` (modified, +2/-0)
```diff
@@ -702,6 +702,8 @@ class ConnectionManagerImpl : Logger::Loggable<Logger::Id::http>,
   bool proactive_drain_{false};
   // When set to true, add Connection:close response header to nudge downstream client to reconnect.
   bool soft_drain_http1_{false};
+  // Whether the connection has carried no stream since the drain sequence started.
+  bool idle_since_drain_start_{false};
   Random::RandomGenerator& random_generator_;
   Runtime::Loader& runtime_;
   const LocalInfo::LocalInfo& local_info_;
```

**File**: `source/common/runtime/runtime_features.cc` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ RUNTIME_GUARD(envoy_reloadable_features_health_check_after_cluster_warming);
 RUNTIME_GUARD(envoy_reloadable_features_hide_transport_failure_reason_in_response_body);
 RUNTIME_GUARD(envoy_reloadable_features_hot_restart_propagate_stat_tags);
 RUNTIME_GUARD(envoy_reloadable_features_http1_allow_query_method);
+RUNTIME_GUARD(envoy_reloadable_features_http1_skip_delayed_close_on_idle_drain);
 RUNTIME_GUARD(envoy_reloadable_features_http2_discard_host_header);
 RUNTIME_GUARD(envoy_reloadable_features_http2_fix_goaway_loadshed_point);
 RUNTIME_GUARD(envoy_reloadable_features_http2_flood_protection_active_streams);
```

**File**: `test/common/http/conn_manager_impl_test_2.cc` (modified, +76/-10)
```diff
@@ -433,15 +433,85 @@ TEST_F(HttpConnectionManagerImplTest, IdleTimeout) {
   idle_timer->invokeCallback();
 
   EXPECT_CALL(*codec_, goAway());
-  EXPECT_CALL(filter_callbacks_.connection_,
-              close(Network::ConnectionCloseType::FlushWriteAndDelay, _));
+  EXPECT_CALL(filter_callbacks_.connection_, close(Network::ConnectionCloseType::FlushWrite, _));
   EXPECT_CALL(*idle_timer, disableTimer());
   EXPECT_CALL(*drain_timer, disableTimer());
   drain_timer->invokeCallback();
 
   EXPECT_EQ(1U, stats_.named_.downstream_cx_idle_timeout_.value());
 }
 
+class HttpConnectionManagerIdleDrainTest : public HttpConnectionManagerImplTest {
+protected:
+  // Sends one request, then fires the connection idle timer, which starts the drain sequence.
+  void startIdleDrain() {
+    idle_timeout_ = std::chrono::milliseconds(10);
+    idle_timer_ = setUpTimer();
+    EXPECT_CALL(*idle_timer_, enableTimer(_, _)).Times(testing::AnyNumber());
+    EXPECT_CALL(*idle_timer_, disableTimer()).Times(testing::AnyNumber());
+    setup();
+    sendRequestAndResponse();
+
+    drain_timer_ = setUpTimer();
+    EXPECT_CALL(*drain_timer_, enableTimer(_, _));
+    EXPECT_CALL(*drain_timer_, disableTimer()).Times(testing::AnyNumber());
+    idle_timer_->invokeCallback();
+  }
+
+  void sendRequestAndResponse() {
+    auto* filter = new NiceMock<MockStreamDecoderFilter>();
+    EXPECT_CALL(filter_factory_, createFilterChain(_))
+        .WillOnce([this, filter](FilterChainFactoryCallbacks& callbacks) -> bool {
+          auto factory = createDecoderFilterFactoryCb(StreamDecoderFilterSharedPtr{filter});
+          callbacks.setFilterConfigName("");
+          factory(callbacks);
+          return true;
+        });
+    EXPECT_CALL(*filter, decodeHeaders(_, true))
+        .WillOnce(Return(FilterHeadersStatus::StopIteration));
+    startRequest(true);
+
+    filter->callbacks_->streamInfo().setResponseCodeDetails("");
+    filter->callbacks_->encodeHeaders(
+        ResponseHeaderMapPtr{new TestResponseHeaderMapImpl{{":status", "200"}}}, true, "details");
+    response_encoder_.stream_.codec_callbacks_->onCodecEncodeComplete();
+  }
+
+  void expectCloseOnDrainTimeout(Network::ConnectionCloseType close_type) {
+    EXPECT_CALL(*codec_, goAway());
+    EXPECT_CALL(filter_callbacks_.connection_, close(close_type, _));
+    drain_timer_->invokeCallback();
+  }
+
+  Event::MockTimer* idle_timer_{};
+  Event::MockTimer* drain_timer_{};
+};
+
+TEST_F(HttpConnectionManagerIdleDrainTest, KeepsDelayedCloseWithRuntimeGuardDisabled) {
+  TestScopedRuntime scoped_runtime;
+  scoped_runtime.mergeValues(
+      {{"envoy.reloadable_features.http1_skip_delayed_close_on_idle_drain", "false"}});
+  startIdleDrain();
+  expectCloseOnDrainTimeout(Network::ConnectionCloseType::FlushWriteAndDelay);
+}
+
+// The drain timeout writes the final GOAWAY, which the client should get to read.
+TEST_F(HttpConnectionManagerIdleDrainTest, KeepsDelayedCloseForHttp2) {
+  EXPECT_CALL(*codec_, protocol()).WillRepeatedly(Return(Protocol::Http2));
+  startIdleDrain();
+  expectCloseOnDrainTimeout(Network::ConnectionCloseType::FlushWriteAndDelay);
+}
+
+TEST_F(HttpConnectionManagerIdleDrainTest, KeepsDelayedCloseAfterResponseWhileDraining) {
+  startIdleDrain();
+  EXPECT_CALL(response_encoder_, encodeHeaders(_, true))
+      .WillOnce([](const ResponseHeaderMap& headers, bool) -> void {
+        EXPECT_EQ("close", headers.getConnectionValue());
+      });
+  sendRequestAndResponse();
+  expectCloseOnDrainTimeout(Network::ConnectionCloseType::FlushWriteAndDelay);
+}
+
 TEST_F(HttpConnectionManagerImplTest, ConnectionDurationResponseFlag) {
   // Not used in the test.
   delete codec_;
@@ -664,8 +734,7 @@ TEST_F(HttpConnectionManagerImplTest, ConnectionDuration) {
   connection_duration_timer->invokeCallback();
 
   EXPECT_CALL(*codec_, goAway());
-  EXPECT_CALL(filter_callbacks_.connection_,
-              close(Network::ConnectionCloseType::FlushWriteAndDelay, _));
+  EXPECT_CALL(filter_callbacks_.connection_, close(Network::ConnectionCloseType::FlushWrite, _));
   EXPECT_CALL(*connection_duration_timer, disableTimer());
   EXPECT_CALL(*drain_timer, disableTimer());
   drain_timer->invokeCallback();
@@ -2340,8 +2409,7 @@ TEST_F(HttpConnectionManagerImplTest, DrainTimeoutJitter) {
   connection_duration_timer->invokeCallback();
 
   EXPECT_CALL(*codec_, goAway());
-  EXPECT_CALL(filter_callbacks_.connection_,
-              close(Network::ConnectionCloseType::FlushWriteAndDelay, _));
+  EXPECT_CALL(filter_callbacks_.connection_, close(Network::ConnectionCloseType::FlushWrite, _));
   EXPECT_CALL(*connection_duration_timer, disableTimer());
   EXPECT_CALL(*drain_timer, disableTimer());
   drain_timer->invokeCallback();
@@ -2380,8 +2448,7 @@ TEST_F(HttpConnectionManagerImplTest, DrainTimeoutJitterZeroPercent) {
   connection_duration_timer->invokeCallback();
 
   EXPECT_CALL(*codec_, goAway());
-  EXPECT_CALL(filter_callbacks_.connection_,
-              close(Network:
```

**File**: `test/common/http/conn_manager_impl_test_3.cc` (modified, +1/-2)
```diff
@@ -3638,8 +3638,7 @@ TEST_F(HttpConnectionManagerImplTest, ProactiveDrainIdleConnection) {
   EXPECT_EQ(1U, stats_.named_.downstream_cx_drain_close_.value());
 
   EXPECT_CALL(*codec_, goAway());
-  EXPECT_CALL(filter_callbacks_.connection_,
-              close(Network::ConnectionCloseType::FlushWriteAndDelay, _));
+  EXPECT_CALL(filter_callbacks_.connection_, close(Network::ConnectionCloseType::FlushWrite, _));
   EXPECT_CALL(*proactive_drain_timer, disableTimer());
   EXPECT_CALL(*drain_timer, disableTimer());
   drain_timer->invokeCallback();
```

**File**: `test/integration/BUILD` (modified, +1/-0)
```diff
@@ -2174,6 +2174,7 @@ envoy_cc_test(
         "//test/integration/filters:stop_iteration_and_continue",
         "//test/mocks/http:http_mocks",
         "//test/test_common:registry_lib",
+        "//test/test_common:simulated_time_system_lib",
         "//test/test_common:threadsafe_singleton_injector_lib",
         "//test/test_common:utility_lib",
         "@envoy_api//envoy/config/bootstrap/v3:pkg_cc_proto",
```

**File**: `test/integration/integration_test.cc` (modified, +59/-0)
```diff
@@ -27,6 +27,7 @@
 #include "test/test_common/network_utility.h"
 #include "test/test_common/printers.h"
 #include "test/test_common/registry.h"
+#include "test/test_common/simulated_time_system.h"
 #include "test/test_common/threadsafe_singleton_injector.h"
 #include "test/test_common/utility.h"
 
@@ -2017,6 +2018,64 @@ TEST_P(IntegrationTest, TestDelayedConnectionTeardownConfig) {
   EXPECT_EQ(codec_client_->lastConnectionEvent(), Network::ConnectionEvent::RemoteClose);
 }
 
+class IntegrationTestWithSimulatedTime : public Event::TestUsingSimulatedTime,
+                                         public IntegrationTest {
+protected:
+  static constexpr std::chrono::seconds kIdleTimeout{1};
+  static constexpr std::chrono::seconds kDrainTimeout{1};
+  static constexpr std::chrono::seconds kDelayedCloseTimeout{100};
+
+  // Serves one request, then lets the idle timeout start a drain sequence and runs it to its end.
+  void idleTimeoutThroughDrain() {
+    autonomous_upstream_ = true;
+    config_helper_.addConfigModifier(
+        [](envoy::extensions::filters::network::http_connection_manager::v3::HttpConnectionManager&
+               hcm) {
+          hcm.mutable_common_http_protocol_options()->mutable_idle_timeout()->set_seconds(
+              kIdleTimeout.count());
+          hcm.mutable_drain_timeout()->set_seconds(kDrainTimeout.count());
+          hcm.mutable_delayed_close_timeout()->set_seconds(kDelayedCloseTimeout.count());
+        });
+    initialize();
+
+    codec_client_ = makeHttpConnection(lookupPort("http"));
+    auto response = codec_client_->makeHeaderOnlyRequest(default_request_headers_);
+    ASSERT_TRUE(response->waitForEndStream());
+    EXPECT_THAT(response->headers(), HttpStatusIs("200"));
+    test_server_->waitForCounter("http.config_test.downstream_rq_completed", Eq(1));
+
+    timeSystem().advanceTimeWait(kIdleTimeout);
+    test_server_->waitForCounter("http.config_test.downstream_cx_idle_timeout", Eq(1));
+    timeSystem().advanceTimeWait(kDrainTimeout);
+  }
+};
+
+INSTANTIATE_TEST_SUITE_P(IpVersions, IntegrationTestWithSimulatedTime,
+                         ValuesIn(TestEnvironment::getIpVersionsForTest()), testParamToString);
+
+// A connection closed by the idle timeout has no response in flight, so it is closed as soon as the
+// drain sequence ends rather than after the delayed close timeout.
+TEST_P(IntegrationTestWithSimulatedTime, IdleTimeoutSkipsDelayedClose) {
+  idleTimeoutThroughDrain();
+
+  // Waiting on a counter advances simulated time, so a delayed close would eventually fire too.
+  test_server_->waitForCounter("http.config_test.downstream_cx_destroy_local", Eq(1));
+  EXPECT_EQ(0,
+            test_server_->counter("http.config_test.downstream_cx_delayed_close_timeout")->value());
+  ASSERT_TRUE(codec_client_->waitForDisconnect());
+  EXPECT_EQ(codec_client_->lastConnectionEvent(), Network::ConnectionEvent::RemoteClose);
+}
+
+TEST_P(IntegrationTestWithSimulatedTime, IdleTimeoutDelayedCloseWithRuntimeGuardOff) {
+  config_helper_.addRuntimeOverride(
+      "envoy.reloadable_features.http1_skip_delayed_close_on_idle_drain", "false");
+  idleTimeoutThroughDrain();
+
+  timeSystem().advanceTimeWait(kDelayedCloseTimeout);
+  test_server_->waitForCounter("http.config_test.downstream_cx_delayed_close_timeout", Eq(1));
+  ASSERT_TRUE(codec_client_->waitForDisconnect());
+}
+
 // Test that if the route cache is cleared, it doesn't cause problems.
 TEST_P(IntegrationTest, TestClearingRouteCacheFilter) {
   config_helper_.prependFilter(R"EOF(
```

---

### Incident Patch 2: `ae6dd24c` (2026-11-22)
**Commit Message**: reverse_tunnel: rebalance new sockets by idle count, not sockets ever accepted (#49410)

**File**: `changelogs/current/bug_fixes/reverse_tunnel__rebalance-by-idle-sockets.rst` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+Fixed the reverse tunnel responder spreading a node's new sockets across workers by the number of sockets
+each worker had ever accepted for it, a count that never went down. As sockets were used or closed, a worker
+could be left with no idle socket for a node while others held several, and requests on that worker failed with
+``fallback_no_reverse_socket``. New sockets now go to the worker holding the fewest idle sockets for the node.
```

**File**: `source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/upstream_socket_manager.cc` (modified, +49/-34)
```diff
@@ -64,44 +64,48 @@ UpstreamSocketManager::UpstreamSocketManager(Event::Dispatcher& dispatcher,
 UpstreamSocketManager&
 UpstreamSocketManager::pickLeastLoadedSocketManager(const std::string& node_id,
                                                     const std::string& cluster_id) {
-  absl::WriterMutexLock wlock(UpstreamSocketManager::socket_manager_lock);
-
-  // Assume that this worker is the best candidate for sending the reverse.
-  // connection socket.
   UpstreamSocketManager* target_socket_manager = this;
   const std::string source_worker = this->dispatcher_.name();
-
-  // Contains the value that we assume to be the minimum value so far.
-  int min_node_count = target_socket_manager->node_to_conn_count_map_[node_id];
-
-  // Iterate over UpstreamSocketManager instances of all threads to check.
-  // if any of them have a lower number of accepted reverse tunnels for.
-  // the node 'node_id'.
-  for (UpstreamSocketManager* socket_manager : socket_managers_) {
-    int node_count = socket_manager->node_to_conn_count_map_[node_id];
-
-    if (node_count < min_node_count) {
-      target_socket_manager = socket_manager;
-      min_node_count = node_count;
+  std::string dest_worker;
+  int min_node_count;
+  {
+    absl::WriterMutexLock lock(UpstreamSocketManager::socket_manager_lock);
+    const auto count_for_node = [&node_id](const UpstreamSocketManager& manager) {
+      auto it = manager.node_to_conn_count_map_.find(node_id);
+      return it == manager.node_to_conn_count_map_.end() ? 0 : it->second;
+    };
+    min_node_count = count_for_node(*this);
+    for (UpstreamSocketManager* socket_manager : socket_managers_) {
+      const int node_count = count_for_node(*socket_manager);
+      if (node_count < min_node_count) {
+        target_socket_manager = socket_manager;
+        min_node_count = node_count;
+      }
     }
+    target_socket_manager->node_to_conn_count_map_[node_id] = min_node_count + 1;
+    dest_worker = target_socket_manager->dispatcher_.name();
   }
 
-  const std::string dest_worker = target_socket_manager->dispatcher_.name();
-
-  // Increment the reverse connection count of the chosen handler.
   if (source_worker != dest_worker) {
     ENVOY_LOG(info,
               "reverse_tunnel: Rebalancing socket from worker {} to worker {} with min "
               "count {} for node {} cluster {}",
-              source_worker, dest_worker, target_socket_manager->node_to_conn_count_map_[node_id],
-              node_id, cluster_id);
+              source_worker, dest_worker, min_node_count, node_id, cluster_id);
   }
-  target_socket_manager->node_to_conn_count_map_[node_id]++;
   ENVOY_LOG(debug, "reverse_tunnel: Incremented count for node {}: {}", node_id,
-            target_socket_manager->node_to_conn_count_map_[node_id]);
+            min_node_count + 1);
   return *target_socket_manager;
 }
 
+void UpstreamSocketManager::decrementIdleCount(const std::string& node_id) {
+  absl::WriterMutexLock wlock(UpstreamSocketManager::socket_manager_lock);
+  auto it = node_to_conn_count_map_.find(node_id);
+  ASSERT(it != node_to_conn_count_map_.end() && it->second > 0);
+  if (--it->second == 0) {
+    node_to_conn_count_map_.erase(it);
+  }
+}
+
 void UpstreamSocketManager::onGoAway(int fd) {
   auto node_it = fd_to_node_map_.find(fd);
   if (node_it == fd_to_node_map_.end()) {
@@ -129,14 +133,23 @@ void UpstreamSocketManager::handoffSocketToWorker(
                     socket = std::move(socket)]() mutable -> void {
     this->addConnectionSocket(node_id, cluster_id, std::move(socket), ping_interval,
                               true /* rebalanced */, tenant_id, initiator_worker_id,
-                              initiator_connection_id);
+                              initiator_connection_id, true /* counted_for_rebalancing */);
   });
 }
 
 void UpstreamSocketManager::addConnectionSocket(
     const std::string& node_id, const std::string& cluster_id, Network::ConnectionSocketPtr socket,
     const std::chrono::seconds& ping_interval, bool rebalanced, absl::string_view tenant_id,
-    absl::string_view initiator_worker_id, absl::string_view initiator_connection_id) {
+    absl::string_view initiator_worker_id, absl::string_view initiator_connection_id,
+    bool counted_for_rebalancing) {
+  // Both node_id and cluster_id are mandatory for consistent state management and stats tracking.
+  if (node_id.empty() || cluster_id.empty()) {
+    ENVOY_LOG(error,
+              "reverse_tunnel: node_id or cluster_id cannot be empty. node: '{}', cluster: '{}'.",
+              node_id, cluster_id);
+    return;
+  }
+
   const std::string scoped_node_id =
       maybeBuildTenantScopedIdentifier(tenant_isolation_enabled_, tenant_id, node_id);
   const std::string scoped_cluster_id =
@@ -155,19 +168,12 @@ void UpstreamSocketManager::addConnectionSocket(
                                            tenant_id, initiator_worker_id, initiator_connection_id);
       return;
     }
+    coun
```

**File**: `source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/upstream_socket_manager.h` (modified, +17/-4)
```diff
@@ -14,6 +14,7 @@
 #include "source/common/common/random_generator.h"
 #include "source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/reverse_tunnel_lifecycle_info.h"
 
+#include "absl/container/flat_hash_set.h"
 #include "absl/strings/string_view.h"
 #include "absl/synchronization/mutex.h"
 
@@ -50,13 +51,15 @@ class UpstreamSocketManager : public ThreadLocal::ThreadLocalObject,
    * @param tenant_id tenant identifier supplied by the peer.
    * @param initiator_worker_id the initiator worker (dispatcher name) that opened the tunnel.
    * @param initiator_connection_id the initiator's per-connection identifier.
+   * @param counted_for_rebalancing true if the picker already reserved a count for this socket.
    */
   void addConnectionSocket(const std::string& node_id, const std::string& cluster_id,
                            Network::ConnectionSocketPtr socket,
                            const std::chrono::seconds& ping_interval, bool rebalanced = true,
                            absl::string_view tenant_id = {},
                            absl::string_view initiator_worker_id = {},
-                           absl::string_view initiator_connection_id = {});
+                           absl::string_view initiator_connection_id = {},
+                           bool counted_for_rebalancing = false);
 
   /**
    * Returns true if a new reverse connection can be accepted for the given node, scoped by tenant
@@ -217,6 +220,12 @@ class UpstreamSocketManager : public ThreadLocal::ThreadLocalObject,
 
   OptRef<const MonotonicTime> findStartTime(int fd) const;
 
+  /**
+   * Drop one idle socket of the node from node_to_conn_count_map_ under socket_manager_lock.
+   * @param node_id the node ID whose socket left the idle pool.
+   */
+  void decrementIdleCount(const std::string& node_id);
+
   // Thread local dispatcher instance.
   Event::Dispatcher& dispatcher_;
   Random::RandomGeneratorPtr random_generator_;
@@ -232,6 +241,9 @@ class UpstreamSocketManager : public ThreadLocal::ThreadLocalObject,
   // Map from FD to its iterator in accepted_reverse_connections_, used to avoid linear scans.
   absl::flat_hash_map<int, std::list<Network::ConnectionSocketPtr>::iterator> fd_to_socket_it_map_;
 
+  // Idle sockets included in node_to_conn_count_map_. Listeners that skip rebalancing bypass it.
+  absl::flat_hash_set<int> counted_idle_fds_;
+
   // Map from file descriptor to cluster ID. An entry is added when a reverse tunnel is accepted
   // from a node and is removed when the socket dies.
   absl::flat_hash_map<int, std::string> fd_to_cluster_map_;
@@ -281,9 +293,10 @@ class UpstreamSocketManager : public ThreadLocal::ThreadLocalObject,
   // Upstream extension for stats integration.
   ReverseTunnelAcceptorExtension* extension_;
 
-  // Map of node IDs to the number of total accepted reverse connections
-  // for the node. This is used to rebalance a request to accept reverse
-  // connections to a different worker thread.
+  // Map of node IDs to the number of idle sockets this worker holds for the node in
+  // accepted_reverse_connections_, plus sockets already picked for it and in flight to its
+  // dispatcher. Requests only take idle sockets from their own worker, so new sockets go to the
+  // worker with the fewest. Guarded by socket_manager_lock since other workers read and write it.
   absl::flat_hash_map<std::string, int> node_to_conn_count_map_;
 
   bool tenant_isolation_enabled_{false};
```

**File**: `test/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/BUILD` (modified, +1/-0)
```diff
@@ -104,6 +104,7 @@ envoy_extension_cc_test(
         "//envoy/router:string_accessor_interface",
         "//envoy/stream_info:uint64_accessor_interface",
         "//source/common/network:utility_lib",
+        "//source/extensions/bootstrap/reverse_tunnel/common:reverse_connection_utility_lib",
         "//source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface:reverse_tunnel_acceptor_lib",
         "//test/mocks/access_log:access_log_mocks",
         "//test/mocks/event:event_mocks",
```

**File**: `test/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/upstream_socket_manager_test.cc` (modified, +121/-0)
```diff
@@ -5,6 +5,7 @@
 
 #include "source/common/network/utility.h"
 #include "source/common/protobuf/protobuf.h"
+#include "source/extensions/bootstrap/reverse_tunnel/common/reverse_connection_utility.h"
 #include "source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/reverse_tunnel_acceptor.h"
 #include "source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/reverse_tunnel_acceptor_extension.h"
 #include "source/extensions/bootstrap/reverse_tunnel/upstream_socket_interface/upstream_socket_manager.h"
@@ -1635,6 +1636,10 @@ class TestUpstreamSocketManagerRebalancing : public testing::Test {
     return (it != manager->node_to_conn_count_map_.end()) ? it->second : 0;
   }
 
+  bool hasNodeConnCount(UpstreamSocketManager* manager, const std::string& node_id) {
+    return manager->node_to_conn_count_map_.contains(node_id);
+  }
+
   size_t verifyAcceptedReverseConnectionsMap(UpstreamSocketManager* manager,
                                              const std::string& node_id) {
     auto it = manager->accepted_reverse_connections_.find(node_id);
@@ -1819,6 +1824,8 @@ TEST_F(TestUpstreamSocketManagerRebalancing, RebalancingWithNewNode) {
   EXPECT_EQ(getNodeConnCount(socket_manager1_.get(), node_id), 1);
   EXPECT_EQ(getNodeConnCount(socket_manager2_.get(), node_id), 0);
   EXPECT_EQ(getNodeConnCount(socket_manager3_.get(), node_id), 0);
+  EXPECT_FALSE(hasNodeConnCount(socket_manager2_.get(), node_id));
+  EXPECT_FALSE(hasNodeConnCount(socket_manager3_.get(), node_id));
 }
 
 TEST_F(TestUpstreamSocketManagerRebalancing, RebalancingSkippedWhenAlreadyRebalanced) {
@@ -1893,6 +1900,120 @@ TEST_F(TestUpstreamSocketManagerRebalancing, MainThreadExcludedFromRebalancing)
   EXPECT_EQ(getNodeConnCount(main_socket_manager.get(), node_id), 0);
 }
 
+TEST_F(TestUpstreamSocketManagerRebalancing, RebalanceToWorkerWithFewestIdleSockets) {
+  const std::string node_id = "test-node";
+  const std::string cluster_id = "test-cluster";
+  const std::chrono::seconds ping_interval(30);
+  for (auto* dispatcher : {&dispatcher1_, &dispatcher2_, &dispatcher3_}) {
+    EXPECT_CALL(*dispatcher, post(_)).WillRepeatedly(Invoke([](Event::PostCb cb) { cb(); }));
+  }
+
+  // One idle socket per worker.
+  socket_manager1_->addConnectionSocket(node_id, cluster_id, createMockSocket(1001), ping_interval,
+                                        false /* rebalanced */);
+  socket_manager1_->addConnectionSocket(node_id, cluster_id, createMockSocket(1002), ping_interval,
+                                        false /* rebalanced */);
+  socket_manager1_->addConnectionSocket(node_id, cluster_id, createMockSocket(1003), ping_interval,
+                                        false /* rebalanced */);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager1_.get(), node_id), 1);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager2_.get(), node_id), 1);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager3_.get(), node_id), 1);
+
+  // Worker 1 hands its socket to a request; the replacement goes back to worker 1.
+  ASSERT_NE(socket_manager1_->getConnectionSocket(node_id), nullptr);
+  socket_manager2_->addConnectionSocket(node_id, cluster_id, createMockSocket(1004), ping_interval,
+                                        false /* rebalanced */);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager1_.get(), node_id), 1);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager2_.get(), node_id), 1);
+
+  // Worker 3's idle socket dies; the replacement goes back to worker 3.
+  socket_manager3_->markSocketDead(1003);
+  socket_manager2_->addConnectionSocket(node_id, cluster_id, createMockSocket(1005), ping_interval,
+                                        false /* rebalanced */);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager2_.get(), node_id), 1);
+  EXPECT_EQ(verifyAcceptedReverseConnectionsMap(socket_manager3_.get(), node_id), 1);
+
+  EXPECT_EQ(getNodeConnCount(socket_manager1_.get(), node_id), 1);
+  EXPECT_EQ(getNodeConnCount(socket_manager2_.get(), node_id), 1);
+  EXPECT_EQ(getNodeConnCount(socket_manager3_.get(), node_id), 1);
+
+  socket_manager1_->markSocketDead(1001);
+  EXPECT_EQ(getNodeConnCount(socket_manager1_.get(), node_id), 1);
+
+  socket_manager1_->addConnectionSocket(node_id, "", createMockSocket(1006), ping_interval,
+                                        false /* rebalanced */);
+  EXPECT_EQ(getNodeConnCount(socket_manager1_.get(), node_id), 1);
+}
+
+TEST_F(TestUpstreamSocketManagerRebalancing, SkippedSocketsDoNotChangeRebalancingCounts) {
+  const std::string node_id = "test-node";
+  const std::string cluster_id = "test-cluster";
+  const std::chrono::seconds ping_interval(30);
+
+  socket_manager1_->addConnectionSocket(node_id, cluster_id, createMockSocket(1101), ping_interval,
+                                        true /* rebalanced */);
+  EXPECT_FALSE(hasNodeConnCount(socket_manager1_.get(), node_id));
+
+  ASSERT_NE(sock
```

#### Recent Merged Pull Requests:
- **PR #49516** (2026-11-21): [bp/1.37] mcp: fix an issue and use the watermark to buffer (#43173) (@derekargueta)
- **PR #49508** (2026-11-20): [bp/1.37] test/ext_proc: Fix spinning loop (and hang) in serverReceiveBodyDuplexStreamed (#44583) (@phlax)
- **PR #49507** (2026-11-20): deps: Bump `bazel-registry` -> d72a252 (+envoy-examples) (@dependency-envoy[bot])
- **PR #49505** (2026-11-21): docs: fix propogated typo in headers and flow control docs (@sundeep8967)
- **PR #49494** (2026-11-20): ai_protocol_manager: move watermark echo suppression to FilterChainBridge (@paul-r-gall)
- **PR #49493** (2026-11-20): ci: Remove the docker-ci workflow input (@phlax)

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

## X. http: close idle HTTP/1 downstream connections without delayed close

**RULE**:
When implementing operations in `changelogs/current/minor_behavior_changes/http__http1-skip-delayed-close-on-idle-drain.rst`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a8595edc`: http: close idle HTTP/1 downstream connections without delayed close. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelogs/current/minor_behavior_changes/http__http1-skip-delayed-close-on-idle-drain.rst`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
An HTTP/1 downstream connection that carries no request between the start of a drain sequence and
its :ref:`drain timeout
<envoy_v3_api_field_extensions.filters.network.http_connection_manager.v3.HttpConnectionManager.drain_timeout>`,
such as one closed by the connection idle timeout, is now closed without waiting for the
:ref:`delayed close timeout
<envoy_v3_api_field_extensions.filters.network.http_connection_manager.v3.HttpConnectionManager.delayed_close_timeout>`.
There is no response on such a connection for the client to read, and while the delayed close was
pending Envoy ignored any request a pooling client sent on it, so that request was never answered.
This change can be reverted by setting the runtime guard
``envoy.reloadable_features.http1_skip_delayed_close_on_idle_drain`` to ``false``.
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a8595edc` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
