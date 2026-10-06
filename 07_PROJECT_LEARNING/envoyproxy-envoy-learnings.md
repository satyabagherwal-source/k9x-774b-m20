# Forensic Learning Record (Deep Inspection): envoyproxy/envoy

> **Canonical Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:02:40.079Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `envoyproxy/envoy`
- **Description**: Cloud-native high-performance edge/middle/service proxy
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 29042 stars

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

    // Locate the OpenSSL libraries in the runfiles tree. The repository
    // directory name and layout depend on the build/runtime:
    //  - WORKSPACE / Bazel 7 nests external repos under the workspace, using the
    //    apparent name (e.g. {RUNFILES_DIR}/{TEST_WORKSPACE}/external/openssl/...).
    //  - Bazel 8 places them directly under the runfiles root
    //    (e.g. {RUNFILES_DIR}/openssl/...).
    //  - bzlmod materialises them under their canonical name, which is the
    //    apparent name with a trailing '+' (e.g. .../openssl+/...).
    // Probe each candidate and use the first that exists, defaulting to the last
    // so dlopen() reports a sensible path if none are found.
    const char* repo_names[] = {"openssl", "openssl+"};
    const size_t num_repo_names = sizeof(repo_names) / sizeof(repo_names[0]);
    for (size_t i = 0; i < num_repo_names; i++) {
      snprintf(ossl_path, sizeof(ossl_path), "%s/%s/external/%s/openssl/lib",
                                              runfiles_dir, test_workspace, repo_names[i]);
      if (access(ossl_path, F_OK) == 0) {
        break;
      }
      snprintf(ossl_path, sizeof(ossl_path), "%s/%s/openssl/lib",
                                              runfiles_dir, repo_names[i]);
      if (access(ossl_path, F_OK) == 0) {
        break;
      }
    }

    strcpy(temp_path, libcrypto_path);
    snprintf(libcrypto_path, sizeof(libcrypto_path), "%s/%s", ossl_path, temp_path);

    strcpy(temp_path, libssl_path);
    snprintf(libssl_path, sizeof(libssl_path), "%s/%s", ossl_path, temp_path);

    // When running under bazel, we also need to set the OPENSSL_MODULES
    // environment variable, so that OpenSSL can find its modules at runtime,
    // This is needed by some tests that load the legacy provider.
    char ossl_modules_path[PATH_MAX];
    snprintf(ossl_modules_path, sizeof(ossl_modules_path), "%s/ossl-modules", ossl_path);
    setenv("OPENSSL_MODULES", ossl_modules_path, 1);
  }

  // Load libcrypto.so first, because libssl.so depends on it.
  if ((libcrypto = dlopen(libcrypto_path, RTLD_NOW | RTLD_LOCAL | RTLD_DEEPBIND)) == NULL) {
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
  // main executable. Without this, RTLD_DEEPBIND causes OpenSSL's allocations
  // to resolve to glibc's malloc/realloc/free instead, resulting in OpenSSL
  // using a completely separate heap. This defeats tcmalloc's performance
  // benefits on the TLS hot path, and also makes all OpenSSL allocations
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
  if ((libssl = dlopen(libssl_path, RTLD_NOW | RTLD_LOCAL | RTLD_DEEPBIND)) == NULL) {
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

    ENVOY_LOG(debug, "golang filter injecting data to filter chain, end_stream: {}",
              do_end_stream_);
    injectDataToFilterChain(data_to_write, do_end_stream_);
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

### Core Architecture Module: `contrib/mysql_proxy/filters/network/source/mysql_utils.h`
```
#pragma once

#include "envoy/buffer/buffer.h"
#include "envoy/common/platform.h"

#include "source/common/buffer/buffer_impl.h"
#include "source/common/common/byte_order.h"
#include "source/common/common/logger.h"

#include "contrib/mysql_proxy/filters/network/source/mysql_codec.h"
#include "openssl/crypto.h"

namespace Envoy {
namespace Extensions {
namespace NetworkFilters {
namespace MySQLProxy {

// Secure memory buffer that is guaranteed to be zeroed on destruction
// via OPENSSL_cleanse, preventing password leakage in memory.
class SecureBytes {
public:
  explicit SecureBytes(size_t len) : data_(new uint8_t[len]), len_(len) {}

  ~SecureBytes() {
    if (data_ != nullptr) {
      OPENSSL_cleanse(data_, len_);
      delete[] data_;
    }
  }

  SecureBytes(const SecureBytes&) = delete;
  SecureBytes& operator=(const SecureBytes&) = delete;

  SecureBytes(SecureBytes&& other) noexcept : data_(other.data_), len_(other.len_) {
    other.data_ = nullptr;
    other.len_ = 0;
  }

  uint8_t* data() { return data_; }
  const uint8_t* data() const { return data_; }
  size_t size() const { return len_; }

  uint8_t operator[](size_t i) const { return data_[i]; }
  uint8_t& operator[](size_t i) { return data_[i]; }

private:
  uint8_t* data_{nullptr};
  size_t len_{0};
};

/**
 * IO helpers for reading/writing MySQL data from/to a buffer.
 * MySQL uses unsigned integer values in Little Endian format only.
 */
class BufferHelper : public Logger::Loggable<Logger::Id::filter> {
public:
  static void addUint8(Buffer::Instance& buffer, uint8_t val);
  static void addUint16(Buffer::Instance& buffer, uint16_t val);
  static void addUint24(Buffer::Instance& buffer, uint32_t val);
  static void addUint32(Buffer::Instance& buffer, uint32_t val);
  static void addLengthEncodedInteger(Buffer::Instance& buffer, uint64_t val);
  static void addBytes(Buffer::Instance& buffer, const char* data, int size);
  static void addString(Buffer::Instance& buffer, const std::string& str) {
    addBytes(buffer, str.data(), str.size());
  }
  static void addVector(Buffer::Instance& buffer, const std::vector<uint8_t>& data) {
    addBytes(buffer, reinterpret_cast<const char*>(data.data()), data.size());
  }
  static void encodeHdr(Buffer::Instance& pkg, uint8_t seq);
  static bool endOfBuffer(Buffer::Instance& buffer);
  static DecodeStatus readUint8(Buffer::Instance& buffer, uint8_t& val);
  static DecodeStatus readUint16(Buffer::Instance& buffer, uint16_t& val);
  static DecodeStatus readUint24(Buffer::Instance& buffer, uint32_t& val);
  static DecodeStatus readUint32(Buffer::Instance& buffer, uint32_t& val);
  static DecodeStatus readLengthEncodedInteger(Buffer::Instance& buffer, uint64_t& val);
  static DecodeStatus skipBytes(Buffer::Instance& buffer, size_t skip_bytes);
  static DecodeStatus readString(Buffer::Instance& buffer, std::string& str);
  static DecodeStatus readVector(Buffer::Instance& buffer, std::vector<uint8_t>& data);
  static DecodeStatus readStringBySize(Buffer::Instance& buffer, size_t len, std::string& str);
  static DecodeStatus readVectorBySize(Buffer::Instance& buffer, size_t len,
                                       std::vector<uint8_t>& vec);
  static DecodeStatus readAll(Buffer::Instance& buffer, std::string& str);
  static DecodeStatus peekUint32(Buffer::Instance& buffer, uint32_t& val);
  static DecodeStatus peekUint8(Buffer::Instance& buffer, uint8_t& val);
  static void consumeHdr(Buffer::Instance& buffer);
  static DecodeStatus peekHdr(Buffer::Instance& buffer, uint32_t& len, uint8_t& seq);

  // Read `len` bytes from buffer into a SecureBytes object backed by guarded memory,
  // then zero the original data in the buffer to prevent password leakage.
  static DecodeStatus readSecureBytes(Buffer::Instance& buffer, size_t len,
                                      std::unique_ptr<SecureBytes>& out);
};

} // namespace MySQLProxy
} // namespace NetworkFilters
} // namespace Extensions
} // namespace Envoy

```

### Core Architecture Module: `contrib/per_worker_subset/load_balancing_policies/source/config.h`
```
#pragma once

#include <thread>

#include "envoy/upstream/load_balancer.h"

#include "source/common/common/logger.h"
#include "source/extensions/load_balancing_policies/common/factory_base.h"

#include "contrib/envoy/extensions/load_balancing_policies/per_worker_subset/v3alpha/per_worker_subset.pb.h"
#include "contrib/envoy/extensions/load_balancing_policies/per_worker_subset/v3alpha/per_worker_subset.pb.validate.h"
#include "contrib/per_worker_subset/load_balancing_policies/source/per_worker_subset_lb.h"

namespace Envoy {
namespace Extensions {
namespace LoadBalancingPolicies {
namespace PerWorkerSubset {

using ClusterProto = envoy::config::cluster::v3::Cluster;

struct PerWorkerSubsetCreator : public Logger::Loggable<Logger::Id::upstream> {
  Upstream::LoadBalancerPtr operator()(
      Upstream::LoadBalancerParams params, OptRef<const Upstream::LoadBalancerConfig> lb_config,
      const Upstream::ClusterInfo& cluster_info, const Upstream::PrioritySet& priority_set,
      Runtime::Loader& runtime, ::Envoy::Random::RandomGenerator& random, TimeSource& time_source);
};

class Factory : public Common::FactoryBase<PerWorkerSubsetLbProto, PerWorkerSubsetCreator> {
public:
  Factory() : FactoryBase("envoy.load_balancing_policies.per_worker_subset") {}

  absl::StatusOr<Upstream::LoadBalancerConfigPtr>
  loadConfig(Server::Configuration::ServerFactoryContext& context,
             const Protobuf::Message& config) override {
    const auto* typed = dynamic_cast<const PerWorkerSubsetLbProto*>(&config);
    if (typed == nullptr) {
      return absl::InvalidArgumentError("per_worker_subset: unexpected config proto type");
    }
    // RANDOM_PARTITIONS requires an explicit positive ``subset_size`` --
    // there is no auto-K for it. EQUAL_PARTITIONS accepts 0 (= auto
    // K = ceil(N/W)) and any positive value (>= N disables subsetting).
    if (typed->partitioning_strategy() == PerWorkerSubsetLbProto::RANDOM_PARTITIONS &&
        typed->subset_size() == 0) {
      return absl::InvalidArgumentError("per_worker_subset: subset_size must be > 0 when "
                                        "partitioning_strategy=RANDOM_PARTITIONS");
    }
    // ``host_selection_strategy`` must be explicit. ``UNSPECIFIED`` is the
    // proto3-default sentinel; reject it with a clear message at config-load
    // instead of letting it default silently.
    if (typed->host_selection_strategy() == PerWorkerSubsetLbProto::UNSPECIFIED) {
      return absl::InvalidArgumentError(
          "per_worker_subset: host_selection_strategy must be set (UNSPECIFIED is a sentinel "
          "default; pick SIMPLE_ROUND_ROBIN, ENVOY_ROUND_ROBIN, or ENVOY_P2C)");
    }
    // ``fallback_threshold`` is in percent points, ``[0, 100]``. The proto
    // ``lte: 100`` validation catches this too; the explicit check here gives
    // a clearer error path for tooling that bypasses PGV.
    if (typed->has_fallback_threshold() && typed->fallback_threshold().value() > 100) {
      return absl::InvalidArgumentError(
          "per_worker_subset: fallback_threshold must be in [0, 100]");
    }
    // Process-local random seed for EQUAL_PARTITIONS' starting-offset
    // rotation. Bootstrap node IDs are optional and therefore cannot provide
    // a reliable per-Envoy identity. Stability across restarts is unnecessary:
    // the seed only decorrelates worker-to-host assignments across processes.
    const uint64_t envoy_seed = context.api().randomGenerator().random();
    return Upstream::LoadBalancerConfigPtr{new TypedPerWorkerSubsetLbConfig(
        *typed, resolveTotalWorkers(context), envoy_seed, context.threadLocal())};
  }

  // Legacy ``lb_policy`` enum path -- not supported for this extension.
  // Users must opt in via ``load_balancing_policy`` with the typed config.
  absl::StatusOr<Upstream::LoadBalancerConfigPtr>
  loadLegacy(Server::Configuration::ServerFactoryContext&, const ClusterProto&) override {
    return absl::InvalidArgumentError("per_worker_subset: legacy lb_policy config path is not "
                                      "supported; use load_balancing_policy");
  }

private:
  // Resolve total worker count W for EQUAL_PARTITIONS' ``K = ceil(N/W)``.
  // Priority order:
  //
  //   1. ``context.options().concurrency()`` -- Envoy's resolved worker
  //      count, populated from the ``--concurrency`` CLI flag if set,
  //      otherwise from Envoy's own CPU detection. Canonical source:
  //      whatever Envoy decided to use, this LB will agree with.
  //   2. ``std::thread::hardware_concurrency()`` -- defensive fallback for
  //      the unlikely case that ``options().concurrency()`` returns 0
  //      (should not happen in practice, but ``uint32`` zero is a valid
  //      return per the interface).
  //   3. Hard fallback 1 -- if even ``hardware_concurrency()`` returns 0
  //      (spec-allowed per ``[thread.thread.static]``), coerce to 1 so the
  //      K formula stays valid: ``K = ceil((N + 0) / 1) = N`` -- each
  //      worker holds the entire cluster, behaviorally equivalent to plain
  //      round-robin. No divide-by-zero, no crash; just loses the
  //      connection-count optimization in this degraded case.
  //
  // For cgroup-limited environments (Kubernetes, etc.), set
  // ``--concurrency`` on the envoy command line to match the cgroup CPU
  // limit. Without an explicit ``--concurrency``, Envoy defaults to host
  // CPU count, which does NOT account for cgroup limits and would cause
  // this LB to size K too small.
  static uint32_t resolveTotalWorkers(Server::Configuration::ServerFactoryContext& context) {
    uint32_t w = context.options().concurrency();
    if (w == 0) {
      w = std::thread::hardware_concurrency();
    }
    if (w == 0) {
      w = 1;
    }
    return w;
  }
};

DECLARE_FACTORY(Factory);

} // namespace PerWorkerSubset
} // namespace LoadBalancingPolicies
} // namespace Extensions
} // namespace Envoy

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #47461** (2026-09-30): **Update distroless base image to fix CVE-2026-5450**
  *Symptoms*: *Title*: Update distroless base image to fix CVE-2026-5450  *Description*: To fix the recently patched libc6 package on debian can you please update the base image of [base-nossl-debian13:nonroot](https://github.com/envoyproxy/envoy/blob/main/distribution/docker/Dockerfile-envoy#L62) to the latest one which don't have CVE-2026-5450 anymore. The previous update was done by [dependabot](https://github.com/envoyproxy/envoy/commit/a61c8e1f47d03139e966f3ee6698579c9559e01c) but I don't see any opened PR.  Grype scan of the current used image :  ```text ➜  ~ grype gcr.io/distroless/base-nossl-debian13:nonroot@sha256:86554c46a420d507ff2d678fd261ab8691fba4875a20302f38a49e684b42a33f  ✔ Loaded image                                                        gcr.io/distroless/base-nossl-debian13:nonroot@sha256:86554c46a420d507ff2d678fd261ab8691fba4875a20302f38a49e684b42a33f  ✔ Parsed image                                                                                                      sha256:68ee68c0c58639e6a54e42356e64e0f5b9a2d54282196d7f5e16665d87323d40  ✔ Cataloged contents                                                                                                       1c8c6f260a19a61f32df2c7ca3da5279c4725524a02190afe5a6a9a9bde44ce9    ├── ✔ Packages                        [6 packages]      ├── ✔ File metadata                   [1,219 locations]      ├── ✔ Executables                     [273 executables]      └── ✔ File digests                    [1,219 files]    ✔ Scanned for v
  **Post-Mortem & Fix Analysis**:
  > https://github.com/envoyproxy/envoy/pull/47487
  > Fixed by https://github.com/envoyproxy/envoy/pull/47892  JFYI we usually bump the images close to release dates.

- **Issue #46947** (2026-10-02): **cache/cache_v2: Responses without a Date header are always treated as stale**
  *Symptoms*: Responses with max-age but no Date are revalidated or refetched on every request.  [RFC 9110 6.6.1 Date](https://www.rfc-editor.org/info/rfc9110/#section-6.6.1) ``` A recipient with a clock that receives a response message without a Date header field MUST record the time it was received and append a corresponding Date header field to the message's header section if it is cached or forwarded downstream. ```  Envoy already does this in [ConnectionManagerImpl::ActiveStream::encodeHeaders](https://github.com/envoyproxy/envoy/blob/v1.39.0/source/common/http/conn_manager_impl.cc#L1923), but that runs after the filter chain.  Envoy determines cacheability in [CacheabilityUtils::isCacheableResponse](https://github.com/envoyproxy/envoy/blob/v1.39.0/source/extensions/filters/http/cache_v2/cacheability_utils.cc#L75), either `no-cache`, `max-age or s-maxage`, or `Expires and Date`.  If a response without a Date header with `max-age or s-maxage` reaches either cache or cache_v2, [CacheHeadersUtils::httpTime](https://github.com/envoyproxy/envoy/blob/v1.39.0/source/extensions/filters/http/cache_v2/cache_headers_utils.cc#L188) returns a default SystemTime (epoch) for a missing or unparseable Date header and [CacheHeadersUtils::calculateAge](https://github.com/envoyproxy/envoy/blob/v1.39.0/source/extensions/filters/http/cache_v2/cache_headers_utils.cc#L223) effectively calculates the apparent age as response_time's time since epoch.  [RFC 9111 4.2.1-2.3](https://www.rfc-editor.org/rfc/rfc9111
  **Post-Mortem & Fix Analysis**:
  > cc @ravenblackx 
  > This issue has been automatically marked as stale because it has not had activity in the last 30 days. It will be closed in the next 7 days unless it is tagged "help wanted" or "no stalebot" or other activity occurs. Thank you for your contributions.
  > This issue has been automatically closed because it has not had activity in the last 37 days. If this issue is still valid, please ping a maintainer and ask them to label it as "help wanted" or "no stalebot". Thank you for your contributions.

- **Issue #46940** (2026-10-01): **Envoy's basic_auth filter defaults the WWW-Authenticate: Basic realm value to the full request URL**
  *Symptoms*: *Description*: Envoy's basic_auth filter defaults the WWW-Authenticate: Basic realm="..." value to the full request URL (scheme+host+path) when no realm is configured. Since SecurityPolicy.spec.basicAuth (v1alpha1) only exposes users and forwardUsernameHeader — no realm field — every distinct path under a protected route gets a different realm.   
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had activity in the last 30 days. It will be closed in the next 7 days unless it is tagged "help wanted" or "no stalebot" or other activity occurs. Thank you for your contributions.
  > This issue has been automatically closed because it has not had activity in the last 37 days. If this issue is still valid, please ping a maintainer and ask them to label it as "help wanted" or "no stalebot". Thank you for your contributions.

- **Issue #46877** (2026-08-27): **c-ares 1.34.8 QID reuse can permanently stall Envoy AUTO DNS refresh for a cluster**
  *Symptoms*: *Title*: *c-ares 1.34.8 QID reuse can permanently stall Envoy AUTO DNS refresh for a cluster*  *Description*: We are observing cases where STRICT_DNS clusters will stop resolving new addresses and effectively become stuck with endpoints that become increasingly stale.  Leading up to this issue in production we see healthy `proxyd.cluster.update_attempt` and `proxyd.cluster.update_success` metrics, then they collapse to 0 and stay there. Once the cluster update metrics fall to 0, `dns.cares.pending_resolutions` gets pinned with a min value of 1.   Based on these symptoms it appears to be related to the issue in the following open PR: [c-ares #1256](https://github.com/c-ares/c-ares/pull/1256).  ```mermaid sequenceDiagram     participant E as Envoy AUTO resolver     participant V6 as Completing AAAA query     participant Q as queries_by_qid     participant V4 as Reentrant A query      E->>V6: Resolve AAAA for IPv4-only hostname     V6->>Q: QID 42 points to AAAA query     V6-->>E: Return NODATA in callback     E->>V4: Start A fallback inline     V4->>Q: Randomly select the same QID 42 for A query     E-->>V6: Callback returns     V6->>Q: Remove QID 42 unconditionally     Note over V4,Q: A query loses its table entry     Note over E: Refresh loop stalls ```  *Repro steps*: We can observe this behavior in a minimal repro:  1. Run one STRICT_DNS cluster with dns_lookup_family: AUTO, dns_refresh_rate: 0.002s, dns_jitter: 0s, respect_dns_ttl: false, qcache_max_ttl: 0, and filter_unrou
  **Post-Mortem & Fix Analysis**:
  > cc @phlax @yanavlasov @yanjunxiang-google - this is the mentioned issue in the slack. Any objection against applying the patch (https://github.com/c-ares/c-ares/pull/1256) until the upstream takes it? We have tested it internally and it works 
  > patch looks good - but was hoping someone with c-ares-fu would sign it off
  > > but was hoping someone with c-ares-fu would sign it off  Mind pinging them in the PR? https://github.com/envoyproxy/envoy/pull/46880

- **Issue #46800** (2026-09-26): **Panic mode routes traffic to hosts that were excluded from the panic calculation (EDS `DRAINING`)**
  *Symptoms*: ## Title  Panic mode routes traffic to hosts that were excluded from the panic calculation (EDS `DRAINING`)  ---  ## Body  ### Description  Envoy subtracts "excluded" hosts from the panic *threshold* calculation, but once panic engages it selects from `host_set.hosts()` — the unfiltered membership — so those same excluded hosts do receive traffic. For `EDS_STATUS_DRAINING` this means an endpoint the control plane explicitly marked as draining receives **new** requests.  The two decisions contradict each other: if a host is not capacity for the purpose of deciding whether we are in panic, it should not become capacity once we are in panic.  **Code path** (paths/lines from `main` at time of writing):  1. `LoadBalancerBase::isHostSetInPanic` — excluded hosts are removed from the denominator:    ```cpp    const auto host_count = host_set.hosts().size() - host_set.excludedHosts().size();    ```    `source/extensions/load_balancing_policies/common/load_balancer_impl.cc`  2. `ZoneAwareLoadBalancerBase::hostSourceToUse` — on panic, selects `AllHosts`:    ```cpp    if (per_priority_panic_[hosts_source.priority_]) {      stats_.lb_healthy_panic_.inc();      if (fail_traffic_on_panic_) { return std::nullopt; }      else { hosts_source.source_type_ = HostsSource::SourceType::AllHosts; return hosts_source; }    }    ```  3. `ZoneAwareLoadBalancerBase::hostSourceToHosts` — `AllHosts` is the raw membership, **not**    filtered by `excludedHosts()`:    ```cpp    case HostsSource::SourceType:
  **Post-Mortem & Fix Analysis**:
  > cc  @wbpcode @tonya11en @nezdolik as load balancer codeowners
  > This issue has been automatically marked as stale because it has not had activity in the last 30 days. It will be closed in the next 7 days unless it is tagged "help wanted" or "no stalebot" or other activity occurs. Thank you for your contributions.
  > This issue has been automatically closed because it has not had activity in the last 37 days. If this issue is still valid, please ping a maintainer and ask them to label it as "help wanted" or "no stalebot". Thank you for your contributions.

- **Issue #46774** (2026-08-24): **postgres_proxy: partial initial message bytes forwarded to upstream before fully decoded**
  *Symptoms*: **Title**:    postgres_proxy: partial initial message forwarded to upstream  **Description**:  The postgres_proxy filter forwards partial bytes of the initial message (SSLRequest or Startup) to the upstream server when the message arrives split across multiple TCP segments, which causes PostgreSQL to log incomplete startup packet. The filter should hold partial bytes until the full message is decoded.  In practice, well behaving clients send the initial message in a single `write()` call, so splitting does not normally occur. It is reproducible with pgjdbc by setting `maxSendBufferSize=4` property, which causes multiple `write()` calls per message.  **Repro steps**:  See attached script below  **Config:**  See the script    <details> <summary>Reproduction script</summary>  ```bash #!/usr/bin/env bash # Reproduce: Envoy postgres_proxy leaks partial message bytes to upstream. # # A PostgreSQL client starts a connection by sending an SSLRequest (8 bytes). # If that message arrives at Envoy in two TCP segments (e.g., 4+4 bytes), # the filter forwards the first segment to PostgreSQL immediately, before # it has enough data to understand what the message is. PostgreSQL receives # unexpected bytes and logs "incomplete startup packet". # # Requirements: docker  set -euo pipefail  ENVOY_IMAGE=${ENVOY_IMAGE:-envoyproxy/envoy:contrib-v1.33-latest} POSTGRES_IMAGE=${POSTGRES_IMAGE:-postgres:17} NETWORK=envoy-pg-repro WORKDIR=$(mktemp -d /tmp/repro-pg-partial.XXXXXX)  cleanup() {   docker 
  **Post-Mortem & Fix Analysis**:
  > cc @fabriziomello @cpakulski
  > I was able to reproduce it locally and the PR #46776 fixes it.

- **Issue #46712** (2026-09-23): **Datadog tracer ignores Ingress/Egress — all spans get `span.kind:internal` (client/server metrics gone)**
  *Symptoms*: *Title*: Datadog tracer ignores Ingress/Egress — all spans get `span.kind:internal` (client/server metrics gone)  *Description*:  After upgrading from Istio 1.17 (OpenTracing-based Datadog tracer) to Istio 1.30.2 (Envoy 1.38.x / `envoy.tracers.datadog` via dd-trace-cpp), Datadog APM metrics for Envoy proxy spans stopped splitting on `span.kind:client` and `span.kind:server`. All volume moved to `span.kind:internal`.  Observed (prod, kube_cluster_name=prod-use1-eks1):  | Window | client | server | internal | |---|---|---|---| | Pre-cutover (Istio 1.17, older Datadog tracer) | ~half | ~half | none | | Post-cutover (Istio 1.30.2 / Envoy 1.38.3) | none | none | 100% |  Client/server series drop to zero at the cutover boundary; `internal` appears at the same time. Spans are still emitted correctly (`operation_name=envoy.proxy`, `component=proxy`, `language=cpp`), and direction is still visible via `upstream_cluster` (`inbound|…` vs `outbound|…`). Only the `span.kind` taxonomy is missing.  Expected: Envoy should set Datadog `span.kind` from traffic direction: - `Tracing::OperationName::Ingress` → `span.kind=server` - `Tracing::OperationName::Egress` → `span.kind=client`  Suspected root cause: in `source/extensions/tracers/datadog/tracer.cc` (`Tracer::startSpan`) and `span.cc` (`Span::spawnChild`), the driver explicitly ignores `Tracing::Config`:      // The OpenTracing implementation ignored the `Tracing::Config` argument,     // so we will as well.  `Tracing::Config::operationName
  **Post-Mortem & Fix Analysis**:
  > cc @xlamorlette-datadog @zacharycmontoya @mattklein123
  > This issue has been automatically marked as stale because it has not had activity in the last 30 days. It will be closed in the next 7 days unless it is tagged "help wanted" or "no stalebot" or other activity occurs. Thank you for your contributions.
  > This issue has been automatically closed because it has not had activity in the last 37 days. If this issue is still valid, please ping a maintainer and ask them to label it as "help wanted" or "no stalebot". Thank you for your contributions.

- **Issue #46694** (2026-08-31): **HTTP3/QUIC listeners do not support 384-bit EC certificates**
  *Symptoms*: *Title*: *QUIC listeners do not support 384-bit EC certificates*  *Description*: When configuring envoy with ECDSA-384 certificates and enabling http3, connection attempts using http3 fail, while http2 works as expected. Envoy logs a warning:  > [quic] [source/common/quic/envoy_quic_proof_source.cc:79] No certificate is configured in transport socket config.  The following error reason is returned in the quic response:  > Reason phrase […]: 28:TLS handshake failure (ENCRYPTION_INITIAL) 40: handshake failure. SSLErrorStack:[handshake_server.cc:611] error:10000085:SSL routines:OPENSSL_internal:CONNECTION_REJECTED. ExtraDetail:select_cert_error: proof_source  The culprit likely lies in this line [here](https://github.com/envoyproxy/envoy/blob/v1.39.0/source/common/quic/quic_server_transport_socket_factory.cc#L180).  *Repro steps*: Configure envoy with http3 enabled and an ECDSA-384 certificate, then try making a request over http3.   
  **Post-Mortem & Fix Analysis**:
  > I've submitted a fix in PR #46731.  **Root cause**: The QUIC transport socket path had two hardcoded P-256-only assumptions: 1. `getTlsCertificateAndKey` in `quic_server_transport_socket_factory.cc` passed `CurveNIDVector{NID_X9_62_prime256v1}` to `findTlsContext`, so the cert selector never matched P-384/P-521 EC certs. 2. `deduceSignatureAlgorithmFromPublicKey` in `envoy_quic_utils.cc` rejected all ECDSA keys that weren't P-256.  **Fix**: Extended the curve vector to include `NID_secp384r1`/`NID_secp521r1` (matching the regular TLS path in `server_context_impl.cc`), and mapped each curve to its correct signature algorithm (`SSL_SIGN_ECDSA_SECP384R1_SHA384` / `SSL_SIGN_ECDSA_SECP521R1_SHA512`).  Fixes #46694
  > cc @ggreenway 

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

### Incident Patch 1: `2723f778` (2026-10-05)
**Commit Message**: fix main format CI (#48026)


Signed-off-by: wbpcode <[REDACTED_EMAIL]>

**File**: `changelogs/changelogs.yaml` (modified, +2/-0)
```diff
@@ -52,6 +52,8 @@ areas:
     title: alts
   api:
     title: api
+  api_key_auth:
+    title: api_key_auth
   attributes:
     title: attributes
   aws:
```

---

### Incident Patch 2: `bce56722` (2026-10-05)
**Commit Message**: build(deps): bump urllib3 and gitpython (#48016)

Bumps the pip group with 2 updates in the /tools/base directory:
[gitpython](https://github.com/gitpython-developers/GitPython) and
[urllib3](https://github.com/urllib3/urllib3).


Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `MODULE.bazel.lock` (modified, +4/-2)
```diff
@@ -4378,8 +4378,8 @@
             "https://files.pythonhosted.org/packages/fd/5b/8f0c4a5bb9fd491c277c21eff7ccae71b47d43c4446c9d0c6cff2fe8c2c4/gitdb-4.0.11-py3-none-any.whl": "sha256:81a3407ddd2ee8df444cbacea00e2d038e40150acfa3001696fe0dcf1d3adfa4"
           },
           "gitpython": {
-            "https://files.pythonhosted.org/packages/ca/dc/126b28e76b24a9268ba931ad3e012f71ebdadf62fd9f17758f7074bb0b20/gitpython-3.1.59.tar.gz": "sha256:0a1475cfdc38a5bfba1a3e9a4a9da52a39749ecec322b772915c019f94e5b7e4",
-            "https://files.pythonhosted.org/packages/ef/ed/ae57eb7d344f43f87b74b3a281ead6ec7d6394eef72a7b1dcb28dd089550/gitpython-3.1.59-py3-none-any.whl": "sha256:67a82f537384578643624c8b2c531938a9b82be431663e575dcf638526631d4c"
+            "https://files.pythonhosted.org/packages/d6/0b/29d7965215f8ef830a7ca1f42997fe13e5693d85e9edb18f938d063ef5f2/gitpython-3.1.62-py3-none-any.whl": "sha256:7002251225e10e29d2e1f49e6532613fe5d5d9f0b6f1f02997a52b38fe56899e",
+            "https://files.pythonhosted.org/packages/e0/db/3ca813cbacb23ab6fe46ff38a9b5ef8e73e970c8051f2ce903aacafe0446/gitpython-3.1.62.tar.gz": "sha256:1791de66309bc0c7cfca40bf8d2e3de7ca091cbf94e6051be1ad0722c61062af"
           },
           "google-auth": {
             "https://files.pythonhosted.org/packages/9d/47/603554949a37bca5b7f894d51896a9c534b9eab808e2520a748e081669d0/google_auth-2.38.0-py2.py3-none-any.whl": "sha256:e7dae6694313f434a2727bf2906f27ad259bae090d7aa896590d86feec3d9d4a",
@@ -5350,7 +5350,9 @@
           "urllib3": {
             "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz": "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c",
             "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl": "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897",
+            "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl": "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3",
             "https://files.pythonhosted.org/packages/ce/d9/5f4c13cecde62396b0d3fe530a50ccea91e7dfc1ccf0e09c228841bb5ba8/urllib3-2.2.3-py3-none-any.whl": "sha256:ca899ca043dcb1bafa3e262d73aa25c465bfb49e0bd9dd5d59f1d0acba2f8fac",
+            "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz": "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63",
             "https://files.pythonhosted.org/packages/ed/63/22ba4ebfe7430b76388e7cd448d5478814d3032121827c12a2cc287e2260/urllib3-2.2.3.tar.gz": "sha256:e7d814a81dad81e6caf2ec9fdedb284ecc9c73076b62654547cc64ccdcae26e9"
           },
           "uvloop": {
```

**File**: `bazel/tests/codeql/MODULE.bazel.lock` (modified, +4/-2)
```diff
@@ -4296,8 +4296,8 @@
             "https://files.pythonhosted.org/packages/fd/5b/8f0c4a5bb9fd491c277c21eff7ccae71b47d43c4446c9d0c6cff2fe8c2c4/gitdb-4.0.11-py3-none-any.whl": "sha256:81a3407ddd2ee8df444cbacea00e2d038e40150acfa3001696fe0dcf1d3adfa4"
           },
           "gitpython": {
-            "https://files.pythonhosted.org/packages/ca/dc/126b28e76b24a9268ba931ad3e012f71ebdadf62fd9f17758f7074bb0b20/gitpython-3.1.59.tar.gz": "sha256:0a1475cfdc38a5bfba1a3e9a4a9da52a39749ecec322b772915c019f94e5b7e4",
-            "https://files.pythonhosted.org/packages/ef/ed/ae57eb7d344f43f87b74b3a281ead6ec7d6394eef72a7b1dcb28dd089550/gitpython-3.1.59-py3-none-any.whl": "sha256:67a82f537384578643624c8b2c531938a9b82be431663e575dcf638526631d4c"
+            "https://files.pythonhosted.org/packages/d6/0b/29d7965215f8ef830a7ca1f42997fe13e5693d85e9edb18f938d063ef5f2/gitpython-3.1.62-py3-none-any.whl": "sha256:7002251225e10e29d2e1f49e6532613fe5d5d9f0b6f1f02997a52b38fe56899e",
+            "https://files.pythonhosted.org/packages/e0/db/3ca813cbacb23ab6fe46ff38a9b5ef8e73e970c8051f2ce903aacafe0446/gitpython-3.1.62.tar.gz": "sha256:1791de66309bc0c7cfca40bf8d2e3de7ca091cbf94e6051be1ad0722c61062af"
           },
           "google-auth": {
             "https://files.pythonhosted.org/packages/9d/47/603554949a37bca5b7f894d51896a9c534b9eab808e2520a748e081669d0/google_auth-2.38.0-py2.py3-none-any.whl": "sha256:e7dae6694313f434a2727bf2906f27ad259bae090d7aa896590d86feec3d9d4a",
@@ -5268,7 +5268,9 @@
           "urllib3": {
             "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz": "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c",
             "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl": "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897",
+            "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl": "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3",
             "https://files.pythonhosted.org/packages/ce/d9/5f4c13cecde62396b0d3fe530a50ccea91e7dfc1ccf0e09c228841bb5ba8/urllib3-2.2.3-py3-none-any.whl": "sha256:ca899ca043dcb1bafa3e262d73aa25c465bfb49e0bd9dd5d59f1d0acba2f8fac",
+            "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz": "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63",
             "https://files.pythonhosted.org/packages/ed/63/22ba4ebfe7430b76388e7cd448d5478814d3032121827c12a2cc287e2260/urllib3-2.2.3.tar.gz": "sha256:e7d814a81dad81e6caf2ec9fdedb284ecc9c73076b62654547cc64ccdcae26e9"
           },
           "uvloop": {
```

**File**: `bazel/tests/external/MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -4574,8 +4574,8 @@
             "https://files.pythonhosted.org/packages/fd/5b/8f0c4a5bb9fd491c277c21eff7ccae71b47d43c4446c9d0c6cff2fe8c2c4/gitdb-4.0.11-py3-none-any.whl": "sha256:81a3407ddd2ee8df444cbacea00e2d038e40150acfa3001696fe0dcf1d3adfa4"
           },
           "gitpython": {
-            "https://files.pythonhosted.org/packages/ca/dc/126b28e76b24a9268ba931ad3e012f71ebdadf62fd9f17758f7074bb0b20/gitpython-3.1.59.tar.gz": "sha256:0a1475cfdc38a5bfba1a3e9a4a9da52a39749ecec322b772915c019f94e5b7e4",
-            "https://files.pythonhosted.org/packages/ef/ed/ae57eb7d344f43f87b74b3a281ead6ec7d6394eef72a7b1dcb28dd089550/gitpython-3.1.59-py3-none-any.whl": "sha256:67a82f537384578643624c8b2c531938a9b82be431663e575dcf638526631d4c"
+            "https://files.pythonhosted.org/packages/d6/0b/29d7965215f8ef830a7ca1f42997fe13e5693d85e9edb18f938d063ef5f2/gitpython-3.1.62-py3-none-any.whl": "sha256:7002251225e10e29d2e1f49e6532613fe5d5d9f0b6f1f02997a52b38fe56899e",
+            "https://files.pythonhosted.org/packages/e0/db/3ca813cbacb23ab6fe46ff38a9b5ef8e73e970c8051f2ce903aacafe0446/gitpython-3.1.62.tar.gz": "sha256:1791de66309bc0c7cfca40bf8d2e3de7ca091cbf94e6051be1ad0722c61062af"
           },
           "google-auth": {
             "https://files.pythonhosted.org/packages/9d/47/603554949a37bca5b7f894d51896a9c534b9eab808e2520a748e081669d0/google_auth-2.38.0-py2.py3-none-any.whl": "sha256:e7dae6694313f434a2727bf2906f27ad259bae090d7aa896590d86feec3d9d4a",
```

**File**: `docs/MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -4574,8 +4574,8 @@
             "https://files.pythonhosted.org/packages/fd/5b/8f0c4a5bb9fd491c277c21eff7ccae71b47d43c4446c9d0c6cff2fe8c2c4/gitdb-4.0.11-py3-none-any.whl": "sha256:81a3407ddd2ee8df444cbacea00e2d038e40150acfa3001696fe0dcf1d3adfa4"
           },
           "gitpython": {
-            "https://files.pythonhosted.org/packages/ca/dc/126b28e76b24a9268ba931ad3e012f71ebdadf62fd9f17758f7074bb0b20/gitpython-3.1.59.tar.gz": "sha256:0a1475cfdc38a5bfba1a3e9a4a9da52a39749ecec322b772915c019f94e5b7e4",
-            "https://files.pythonhosted.org/packages/ef/ed/ae57eb7d344f43f87b74b3a281ead6ec7d6394eef72a7b1dcb28dd089550/gitpython-3.1.59-py3-none-any.whl": "sha256:67a82f537384578643624c8b2c531938a9b82be431663e575dcf638526631d4c"
+            "https://files.pythonhosted.org/packages/d6/0b/29d7965215f8ef830a7ca1f42997fe13e5693d85e9edb18f938d063ef5f2/gitpython-3.1.62-py3-none-any.whl": "sha256:7002251225e10e29d2e1f49e6532613fe5d5d9f0b6f1f02997a52b38fe56899e",
+            "https://files.pythonhosted.org/packages/e0/db/3ca813cbacb23ab6fe46ff38a9b5ef8e73e970c8051f2ce903aacafe0446/gitpython-3.1.62.tar.gz": "sha256:1791de66309bc0c7cfca40bf8d2e3de7ca091cbf94e6051be1ad0722c61062af"
           },
           "google-auth": {
             "https://files.pythonhosted.org/packages/9d/47/603554949a37bca5b7f894d51896a9c534b9eab808e2520a748e081669d0/google_auth-2.38.0-py2.py3-none-any.whl": "sha256:e7dae6694313f434a2727bf2906f27ad259bae090d7aa896590d86feec3d9d4a",
```

**File**: `mobile/MODULE.bazel.lock` (modified, +4/-2)
```diff
@@ -4639,8 +4639,8 @@
             "https://files.pythonhosted.org/packages/fd/5b/8f0c4a5bb9fd491c277c21eff7ccae71b47d43c4446c9d0c6cff2fe8c2c4/gitdb-4.0.11-py3-none-any.whl": "sha256:81a3407ddd2ee8df444cbacea00e2d038e40150acfa3001696fe0dcf1d3adfa4"
           },
           "gitpython": {
-            "https://files.pythonhosted.org/packages/ca/dc/126b28e76b24a9268ba931ad3e012f71ebdadf62fd9f17758f7074bb0b20/gitpython-3.1.59.tar.gz": "sha256:0a1475cfdc38a5bfba1a3e9a4a9da52a39749ecec322b772915c019f94e5b7e4",
-            "https://files.pythonhosted.org/packages/ef/ed/ae57eb7d344f43f87b74b3a281ead6ec7d6394eef72a7b1dcb28dd089550/gitpython-3.1.59-py3-none-any.whl": "sha256:67a82f537384578643624c8b2c531938a9b82be431663e575dcf638526631d4c"
+            "https://files.pythonhosted.org/packages/d6/0b/29d7965215f8ef830a7ca1f42997fe13e5693d85e9edb18f938d063ef5f2/gitpython-3.1.62-py3-none-any.whl": "sha256:7002251225e10e29d2e1f49e6532613fe5d5d9f0b6f1f02997a52b38fe56899e",
+            "https://files.pythonhosted.org/packages/e0/db/3ca813cbacb23ab6fe46ff38a9b5ef8e73e970c8051f2ce903aacafe0446/gitpython-3.1.62.tar.gz": "sha256:1791de66309bc0c7cfca40bf8d2e3de7ca091cbf94e6051be1ad0722c61062af"
           },
           "google-auth": {
             "https://files.pythonhosted.org/packages/9d/47/603554949a37bca5b7f894d51896a9c534b9eab808e2520a748e081669d0/google_auth-2.38.0-py2.py3-none-any.whl": "sha256:e7dae6694313f434a2727bf2906f27ad259bae090d7aa896590d86feec3d9d4a",
@@ -5843,7 +5843,9 @@
           "urllib3": {
             "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz": "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c",
             "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl": "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897",
+            "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl": "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3",
             "https://files.pythonhosted.org/packages/ce/d9/5f4c13cecde62396b0d3fe530a50ccea91e7dfc1ccf0e09c228841bb5ba8/urllib3-2.2.3-py3-none-any.whl": "sha256:ca899ca043dcb1bafa3e262d73aa25c465bfb49e0bd9dd5d59f1d0acba2f8fac",
+            "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz": "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63",
             "https://files.pythonhosted.org/packages/ed/63/22ba4ebfe7430b76388e7cd448d5478814d3032121827c12a2cc287e2260/urllib3-2.2.3.tar.gz": "sha256:e7d814a81dad81e6caf2ec9fdedb284ecc9c73076b62654547cc64ccdcae26e9"
           },
           "uvloop": {
```

**File**: `tools/base/requirements.in` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ envoy.code.check>=0.6.9
 envoy.dependency.check>=0.2.1
 envoy.distribution.release>=0.1.2
 envoy.distribution.verify>=0.1.1
-gitpython>=3.1.59
+gitpython>=3.1.62
 icalendar>=7.3.0
 orjson>=3.10.15
 pep8-naming
```

**File**: `tools/base/requirements.txt` (modified, +30/-30)
```diff
@@ -23,15 +23,15 @@ aio-api-github==0.3.1 \
     --hash=sha256:04d2e3fb4fcb55927b75f9a3cefae7673cefabd2387dd2416848ff19326d719c \
     --hash=sha256:d083ca09e5577d0c4217138e45b18ea63d57d0cbb030eb336cc2a979f8b244b4
     # via
-    #   -r tools/base/requirements.in
+    #   -r requirements.in
     #   envoy-base-utils
     #   envoy-ci-report
     #   envoy-dependency-check
 aio-core==0.11.1 \
     --hash=sha256:03f1202029655c68d5d41c2fa1d18e344d61515b71080f770f8cf6f99fbc5f5a \
     --hash=sha256:76608a1dad3985866c1b3ffc81e0d08bd1a740e8e72125bfbf46d1ee6fc3abfe
     # via
-    #   -r tools/base/requirements.in
+    #   -r requirements.in
     #   aio-api-github
     #   aio-run-runner
     #   dependatool
@@ -193,7 +193,7 @@ aiohttp==3.14.3 \
     --hash=sha256:fa9467a8113aa69d3d7c55a70ef0b7c636010a40993f3df9d9d0d73b3eb7ef24 \
     --hash=sha256:fd51ebf9d3a00c074df4ede271023f4d2dba289bcc740b88191872716014e3c5
     # via
-    #   -r tools/base/requirements.in
+    #   -r requirements.in
     #   aio-api-github
     #   aiodocker
     #   envoy-base-utils
@@ -213,7 +213,7 @@ aioquic==1.3.0 \
     --hash=sha256:9d15a89213d38cbc4679990fa5151af8ea02655a1d6ce5ec972b0a6af74d5f1c \
     --hash=sha256:a8881239801279188e33ced6f9849cedf033325a48a6f44d7e55e583abc555a3 \
     --hash=sha256:ba30016244e45d9222fdd1fbd4e8b0e5f6811e81a5d0643475ad7024a537274a
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 aiosignal==1.4.0 \
     --hash=sha256:053243f8b92b990551949e63930a839ff0cf0b0ebbe0597b0f3fb19e1a0fe82e \
     --hash=sha256:f47eecd9468083c2029cc99945502cb7708b082c232f9aca65da147157b251c7
@@ -462,20 +462,20 @@ cryptography==50.0.0 \
     --hash=sha256:f89831ef99dd7dd169ab06d63a831adb9e20a87aac6d380266bbda5823349169 \
     --hash=sha256:fd9192b7b70c573d7f214eb1ae35e00d359f6f5e4b27c7e21e30de1fc6204645
     # via
-    #   -r tools/base/requirements.in
+    #   -r requirements.in
     #   aioquic
     #   pyjwt
     #   pyopenssl
     #   service-identity
 dependatool==0.3.1 \
     --hash=sha256:265fc69e8b1605edb8e33872a36d3a2c2cc055743bec8e58d1ed3c72a17a9431 \
     --hash=sha256:6be19ce9fbdffccf639bad0393e454080b7bba8510a98edc78855a6a93895020
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 envoy-base-utils==0.6.12 \
     --hash=sha256:8b860c9d88493f1eb1044cc48fa9ae953cd31d9da77102d05e9c6af65ff14eae \
     --hash=sha256:d2ab511a1f6f59f7319c6dc6b70088bad139be2165466ed9ce6932b0c96faa02
     # via
-    #   -r tools/base/requirements.in
+    #   -r requirements.in
     #   envoy-code-check
     #   envoy-dependency-check
     #   envoy-distribution-release
@@ -484,23 +484,23 @@ envoy-base-utils==0.6.12 \
 envoy-ci-report==0.1.1 \
     --hash=sha256:481115be4d05941b83ffbbd8fdac241f10e9823c076f850d8bef7f0308aa382d \
     --hash=sha256:a38da2e996b266b32ff80f2f404018d1887f156ad086e3fa8fd4233bb4cd6fe7
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 envoy-code-check==0.6.9 \
     --hash=sha256:9a212107476b4a36b3743fb550eacad3ede72b3cdbf825dc944c25e48e4e1eb6 \
     --hash=sha256:9ded56211e8e81ffc27c97b923e17dd7a6dd60e72454755f07bb1555ca019279
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 envoy-dependency-check==0.2.1 \
     --hash=sha256:a037ab34b7db9893ecf07247c8e9149481148de26f340f1c27e4adfa7a48e227 \
     --hash=sha256:d91134dc18d2a6a69694623b70a7cb0571647f141a493f0e1bff12d843ec9f7b
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 envoy-distribution-release==0.1.2 \
     --hash=sha256:0a784b46563d2611eb7c68a10c46dbe1821161f0b9fa0018220e5ec373a3b7f3 \
     --hash=sha256:c15873e88743970143d8ac9fd911bac8cbf34aef6b0315ab78c003a242ef60ef
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 envoy-distribution-verify==0.1.1 \
     --hash=sha256:21bf9cbb259c81d953ed768fca9b6d96e65b46c731cc406fe1d3cba5398591bc \
     --hash=sha256:f96840fd1c2f37f39e72f2a7e9d11d3076f67fe20f598ecc1d96153e19c7b09c
-    # via -r tools/base/requirements.in
+    # via -r requirements.in
 envoy-docker-utils==0.1.1 \
     --hash=sha256:2375ae633783c07652f42c86e2db190cb34f4d0486468b8a475cf3417a8d67b5 \
     --hash=sha256:9c3df7ca912972f17469661f56b29cd7785705bf2176606dbfded283dab85f4d
@@ -703,18 +703,18 @@ gitdb==4.0.11 \
     --hash=sha256:81a3407ddd2ee8df444cbacea00e2d038e40150acfa3001696fe0dcf1d3adfa4 \
     --hash=sha256:bf5421126136d6d0af55bc1e7c1af1c397a34f5b7bd79e776cd3e89785c2b04b
     # via gitpython
-gitpython==3.1.59 \
-    --hash=sha256:0a1475cfdc38a5bfba1a3e9a4a9da52a39749ecec322b772915c019f94e5b7e4 \
-    --hash=sha256:67a82f537384578643624c8b2c531938a9b82be431663e575dcf638526631d4c
-    # via -r tools/base/requirements.in
+gitpython==3.1.62 \
+    --hash=sha256:1791de66309bc0c7cfca40bf8d2e3de7ca091cbf94e6051be1ad0722c61062af \
+    --hash=sha256:7002251225e10e29d2e1f49e6532613fe5d5d9f0b6f1f02997a52b38fe56899e
+    # via -r requirements.in
 humanfriendly==10.0 \
     --hash=sha256:1697e1a8a8f550fd43c2865cd84542fc175a61dc
```

---

### Incident Patch 3: `951cf956` (2026-10-05)
**Commit Message**: [oauth2, api_key_auth] null deref fixes when :path is not present (#48010)

oauth2: reject a request with no :path (e.g. a plain CONNECT) with a 400
instead of dereferencing it.
api_key_auth: skip query-key stripping when :path is absent.

Prevents a crash on a path-less CONNECT request

Original report&fix: https://github.com/envoyproxy/envoy/pull/47941

---------

Signed-off-by: wbpcode <[REDACTED_EMAIL]>
Signed-off-by: Kateryna Nezdolii <[REDACTED_EMAIL]>
Co-authored-by: wbpcode <[REDACTED_EMAIL]>

**File**: `changelogs/current/bug_fixes/api_key_auth__crash-on-connect-missing-path.rst` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+Fixed a crash in the ``api_key_auth`` HTTP filter when ``hide_credentials`` is enabled with a query
+parameter key source and a request without a ``:path`` header (for example a CONNECT request) is
+authenticated via another key source. The filter now skips query-string rewriting when there is no
+``:path``.
```

**File**: `changelogs/current/bug_fixes/oauth2__crash-on-connect-missing-path.rst` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+Fixed a crash in the ``oauth2`` HTTP filter when a request without a ``:path`` header (for example a
+plain CONNECT tunnel request) reached the filter. The filter now rejects a request that has no
+``:path`` with a ``400`` (Bad Request) local reply.
```

**File**: `source/extensions/filters/http/api_key_auth/api_key_auth.cc` (modified, +4/-0)
```diff
@@ -91,6 +91,10 @@ void KeySources::Source::removeKey(Http::RequestHeaderMap& headers) const {
     const auto& header = absl::get<Http::LowerCaseString>(source_);
     headers.remove(header);
   } else if (query_source_) {
+    // No :path means there is no query string to strip the key from (for example CONNECT requests).
+    if (headers.Path() == nullptr) {
+      return;
+    }
     auto params =
         Http::Utility::QueryParamsMulti::parseAndDecodeQueryString(headers.getPathValue());
     absl::string_view key = absl::get<std::string>(source_);
```

**File**: `source/extensions/filters/http/oauth2/filter.cc` (modified, +12/-10)
```diff
@@ -809,7 +809,7 @@ void OAuth2CookieValidator::setParams(const Http::RequestHeaderMap& headers,
   id_token_ = findValue(cookies, cookie_names_.id_token_);
   refresh_token_ = findValue(cookies, cookie_names_.refresh_token_);
   hmac_ = findValue(cookies, cookie_names_.oauth_hmac_);
-  host_ = std::string(headers.Host()->value().getStringView());
+  host_ = std::string(headers.getHostValue());
 
   secret_ = std::string(secret);
 }
@@ -952,15 +952,17 @@ Http::FilterHeadersStatus OAuth2Filter::decodeHeaders(Http::RequestHeaderMap& he
     headers.removeInline(authorization_handle.handle());
   }
 
-  // The following 2 headers are guaranteed for regular requests. The asserts are helpful when
-  // writing test code to not forget these important variables in mock requests
-  const Http::HeaderEntry* host_header = headers.Host();
-  ASSERT(host_header != nullptr);
-  host_ = std::string(host_header->value().getStringView());
+  host_ = std::string(headers.getHostValue());
 
-  const Http::HeaderEntry* path_header = headers.Path();
-  ASSERT(path_header != nullptr);
-  const absl::string_view path_str = path_header->value().getStringView();
+  // A request without a :path header (for example a plain CONNECT tunnel request, which the
+  // connection manager does not reject) cannot be processed by this filter. Fail closed with a bad
+  // request response.
+  if (headers.Path() == nullptr) {
+    decoder_callbacks_->sendLocalReply(Http::Code::BadRequest, "", nullptr, std::nullopt,
+                                       "oauth_missing_path");
+    return Http::FilterHeadersStatus::StopIteration;
+  }
+  const absl::string_view path_str = headers.getPathValue();
   const bool redirect_from_auth_server = config_->redirectPathMatcher().match(path_str);
   // Remember the result so that the failure paths, which can run asynchronously, do not have to
   // run the path matcher again.
@@ -1290,7 +1292,7 @@ void OAuth2Filter::redirectToOAuthServer(Http::RequestHeaderMap& headers) {
     return;
   }
 
-  const std::string original_url = absl::StrCat(base_path, headers.Path()->value().getStringView());
+  const std::string original_url = absl::StrCat(base_path, headers.getPathValue());
 
   const CookieNames& cookie_names = config_->cookieNames();
 
```

**File**: `test/extensions/filters/http/api_key_auth/api_key_auth_test.cc` (modified, +30/-0)
```diff
@@ -757,6 +757,36 @@ TEST_F(FilterTest, RouteConfigOverrideForwarding) {
   EXPECT_FALSE(request_headers.has("authorization"));
 }
 
+TEST_F(FilterTest, HideCredentialsNoPathWithQueryKeySource) {
+  const std::string config_yaml = R"EOF(
+  credentials:
+  - key: key1
+    client: user1
+  key_sources:
+  - header: "Authorization"
+  - query: "api_key"
+  forwarding:
+    header: "x-client-id"
+    hide_credentials: true
+  )EOF";
+
+  setup(config_yaml, {});
+
+  // CONNECT request with no ":path". The key is supplied via the Authorization header, but the
+  // query key source is also configured and removeKey() iterates every source, including the query
+  // one, which must not dereference the (absent) path.
+  Http::TestRequestHeaderMapImpl request_headers{
+      {":method", "CONNECT"}, {":authority", "host"}, {"Authorization", "Bearer key1"}};
+
+  // Must not crash and the request should be authenticated.
+  EXPECT_EQ(Http::FilterHeadersStatus::Continue, filter_->decodeHeaders(request_headers, true));
+  EXPECT_EQ(stats_.counterFromString("stats.api_key_auth.allowed").value(), 1);
+  EXPECT_EQ(request_headers.get_("x-client-id"), "user1");
+  // The Authorization header should be removed and no path should have been added.
+  EXPECT_FALSE(request_headers.has("authorization"));
+  EXPECT_EQ(request_headers.Path(), nullptr);
+}
+
 } // namespace ApiKeyAuth
 } // namespace HttpFilters
 } // namespace Extensions
```

**File**: `test/extensions/filters/http/oauth2/filter_test.cc` (modified, +15/-0)
```diff
@@ -706,6 +706,21 @@ TEST_F(OAuth2Test, SecretsNotReadyReturnsServiceUnavailable) {
   EXPECT_EQ(1, config_->stats().oauth_failure_.value());
 }
 
+// A request with no :path header (for example a plain CONNECT tunnel request, which the connection
+// manager does not reject) must not cause a null dereference. The filter should fail closed with a
+// BadRequest local reply and stop iteration rather than dereferencing the null :path.
+TEST_F(OAuth2Test, MissingPathReturnsBadRequest) {
+  Http::TestRequestHeaderMapImpl request_headers{
+      {Http::Headers::get().Method.get(), Http::Headers::get().MethodValues.Connect},
+      {Http::Headers::get().Host.get(), "traffic.example.com"},
+  };
+
+  EXPECT_CALL(decoder_callbacks_,
+              sendLocalReply(Http::Code::BadRequest, "", _, _, "oauth_missing_path"));
+  EXPECT_EQ(Http::FilterHeadersStatus::StopIteration,
+            filter_->decodeHeaders(request_headers, false));
+}
+
 TEST_F(OAuth2Test, TlsClientAuthDoesNotRequireClientSecret) {
   auto secret_reader = std::make_shared<MockSecretReader>("", TEST_HMAC_SECRET);
   envoy::extensions::filters::http::oauth2::v3::OAuth2Config p;
```

---

### Incident Patch 4: `782ef708` (2026-10-05)
**Commit Message**: py/deps: Bump release utils to fix docs inventories (#47379)

Signed-off-by: Ryan Northey <[REDACTED_EMAIL]>

**File**: `MODULE.bazel.lock` (modified, +4/-4)
```diff
@@ -4113,16 +4113,16 @@
             "https://files.pythonhosted.org/packages/39/a4/5180d9afc57e8fca05601dd652bdff19604c218814037fe90ffc7625a50a/docutils-0.23.tar.gz": "sha256:746f5060322511280a1e50eb76846ed6bf2342984b2ac04dc42caa1a8d78799e"
           },
           "envoy-base-utils": {
-            "https://files.pythonhosted.org/packages/94/8b/aed2ee446b06c254de6d0b2a53959dd06916f7f059bc17e1e94b47cad45c/envoy_base_utils-0.6.9.tar.gz": "sha256:b088b7621b5075005c48cdbef5db5675827b7b63550be7d880d395261fdcdb20",
-            "https://files.pythonhosted.org/packages/c4/71/86288c14c8e557bbc3489d6bd2963caed7e54f478976b0c359f9b3597bf2/envoy_base_utils-0.6.9-py3-none-any.whl": "sha256:664dcc19ee12125398222a7628bdcbb40e265b3846e197e4014434fcd273fd61"
+            "https://files.pythonhosted.org/packages/bd/98/e3c1a16a299fe399092c45cb91e148c2f99a4a7a551d6729dd411ffc4c3d/envoy_base_utils-0.6.12.tar.gz": "sha256:d2ab511a1f6f59f7319c6dc6b70088bad139be2165466ed9ce6932b0c96faa02",
+            "https://files.pythonhosted.org/packages/d9/4d/275e6c7033b8b5d4f59216034d98c303feb2d99185da479963e458083699/envoy_base_utils-0.6.12-py3-none-any.whl": "sha256:8b860c9d88493f1eb1044cc48fa9ae953cd31d9da77102d05e9c6af65ff14eae"
           },
           "envoy-ci-report": {
             "https://files.pythonhosted.org/packages/43/c9/24aceda89afab59b701ea7f9f004c422a9e4adfb63003e086692a3c9a0dc/envoy_ci_report-0.1.1.tar.gz": "sha256:481115be4d05941b83ffbbd8fdac241f10e9823c076f850d8bef7f0308aa382d",
             "https://files.pythonhosted.org/packages/85/a8/d694c1b8d931b985f75146f8ac0168f7fe2ece7679a0cf66653efe1c0f22/envoy_ci_report-0.1.1-py3-none-any.whl": "sha256:a38da2e996b266b32ff80f2f404018d1887f156ad086e3fa8fd4233bb4cd6fe7"
           },
           "envoy-code-check": {
-            "https://files.pythonhosted.org/packages/c9/8b/340c8898dec2341b36d6fbc1cc93ee03d23061dd94d2af89834a8324f520/envoy_code_check-0.6.7-py3-none-any.whl": "sha256:7b7fbc99c114f663126be738095945d479e0b4c6f71d3d784bc234d9d9098a8d",
-            "https://files.pythonhosted.org/packages/de/0a/0850dc942e491cd40d3ab96bfc7c7e4a063307c4f2b93563dfa9ea333033/envoy_code_check-0.6.7.tar.gz": "sha256:76b0edf0b95d8a31b5d78481b3a7f5ae4a2925c04d2158e77cc3549653a4213e"
+            "https://files.pythonhosted.org/packages/0c/12/b36eed1f6c7402bba14d1567122919aea69beeed312d71b229465eb1826d/envoy_code_check-0.6.9.tar.gz": "sha256:9a212107476b4a36b3743fb550eacad3ede72b3cdbf825dc944c25e48e4e1eb6",
+            "https://files.pythonhosted.org/packages/7d/4f/c97a5be443f8a3f40cf56864f94d578cfb1b6d500c20e04946713251d347/envoy_code_check-0.6.9-py3-none-any.whl": "sha256:9ded56211e8e81ffc27c97b923e17dd7a6dd60e72454755f07bb1555ca019279"
           },
           "envoy-dependency-check": {
             "https://files.pythonhosted.org/packages/06/7c/afcea506f6d304321ce8deca1ff7e21e6fc4c34e6431e66409219afb49b3/envoy_dependency_check-0.2.1-py3-none-any.whl": "sha256:a037ab34b7db9893ecf07247c8e9149481148de26f340f1c27e4adfa7a48e227",
```

**File**: `bazel/tests/codeql/MODULE.bazel.lock` (modified, +4/-4)
```diff
@@ -4031,16 +4031,16 @@
             "https://files.pythonhosted.org/packages/39/a4/5180d9afc57e8fca05601dd652bdff19604c218814037fe90ffc7625a50a/docutils-0.23.tar.gz": "sha256:746f5060322511280a1e50eb76846ed6bf2342984b2ac04dc42caa1a8d78799e"
           },
           "envoy-base-utils": {
-            "https://files.pythonhosted.org/packages/94/8b/aed2ee446b06c254de6d0b2a53959dd06916f7f059bc17e1e94b47cad45c/envoy_base_utils-0.6.9.tar.gz": "sha256:b088b7621b5075005c48cdbef5db5675827b7b63550be7d880d395261fdcdb20",
-            "https://files.pythonhosted.org/packages/c4/71/86288c14c8e557bbc3489d6bd2963caed7e54f478976b0c359f9b3597bf2/envoy_base_utils-0.6.9-py3-none-any.whl": "sha256:664dcc19ee12125398222a7628bdcbb40e265b3846e197e4014434fcd273fd61"
+            "https://files.pythonhosted.org/packages/bd/98/e3c1a16a299fe399092c45cb91e148c2f99a4a7a551d6729dd411ffc4c3d/envoy_base_utils-0.6.12.tar.gz": "sha256:d2ab511a1f6f59f7319c6dc6b70088bad139be2165466ed9ce6932b0c96faa02",
+            "https://files.pythonhosted.org/packages/d9/4d/275e6c7033b8b5d4f59216034d98c303feb2d99185da479963e458083699/envoy_base_utils-0.6.12-py3-none-any.whl": "sha256:8b860c9d88493f1eb1044cc48fa9ae953cd31d9da77102d05e9c6af65ff14eae"
           },
           "envoy-ci-report": {
             "https://files.pythonhosted.org/packages/43/c9/24aceda89afab59b701ea7f9f004c422a9e4adfb63003e086692a3c9a0dc/envoy_ci_report-0.1.1.tar.gz": "sha256:481115be4d05941b83ffbbd8fdac241f10e9823c076f850d8bef7f0308aa382d",
             "https://files.pythonhosted.org/packages/85/a8/d694c1b8d931b985f75146f8ac0168f7fe2ece7679a0cf66653efe1c0f22/envoy_ci_report-0.1.1-py3-none-any.whl": "sha256:a38da2e996b266b32ff80f2f404018d1887f156ad086e3fa8fd4233bb4cd6fe7"
           },
           "envoy-code-check": {
-            "https://files.pythonhosted.org/packages/c9/8b/340c8898dec2341b36d6fbc1cc93ee03d23061dd94d2af89834a8324f520/envoy_code_check-0.6.7-py3-none-any.whl": "sha256:7b7fbc99c114f663126be738095945d479e0b4c6f71d3d784bc234d9d9098a8d",
-            "https://files.pythonhosted.org/packages/de/0a/0850dc942e491cd40d3ab96bfc7c7e4a063307c4f2b93563dfa9ea333033/envoy_code_check-0.6.7.tar.gz": "sha256:76b0edf0b95d8a31b5d78481b3a7f5ae4a2925c04d2158e77cc3549653a4213e"
+            "https://files.pythonhosted.org/packages/0c/12/b36eed1f6c7402bba14d1567122919aea69beeed312d71b229465eb1826d/envoy_code_check-0.6.9.tar.gz": "sha256:9a212107476b4a36b3743fb550eacad3ede72b3cdbf825dc944c25e48e4e1eb6",
+            "https://files.pythonhosted.org/packages/7d/4f/c97a5be443f8a3f40cf56864f94d578cfb1b6d500c20e04946713251d347/envoy_code_check-0.6.9-py3-none-any.whl": "sha256:9ded56211e8e81ffc27c97b923e17dd7a6dd60e72454755f07bb1555ca019279"
           },
           "envoy-dependency-check": {
             "https://files.pythonhosted.org/packages/06/7c/afcea506f6d304321ce8deca1ff7e21e6fc4c34e6431e66409219afb49b3/envoy_dependency_check-0.2.1-py3-none-any.whl": "sha256:a037ab34b7db9893ecf07247c8e9149481148de26f340f1c27e4adfa7a48e227",
```

**File**: `bazel/tests/external/MODULE.bazel.lock` (modified, +4/-4)
```diff
@@ -4175,16 +4175,16 @@
             "https://files.pythonhosted.org/packages/ae/ed/aefcc8cd0ba62a0560c3c18c33925362d46c6075480bfa4df87b28e169a9/docutils-0.21.2.tar.gz": "sha256:3a6b18732edf182daa3cd12775bbb338cf5691468f91eeeb109deff6ebfa986f"
           },
           "envoy-base-utils": {
-            "https://files.pythonhosted.org/packages/94/8b/aed2ee446b06c254de6d0b2a53959dd06916f7f059bc17e1e94b47cad45c/envoy_base_utils-0.6.9.tar.gz": "sha256:b088b7621b5075005c48cdbef5db5675827b7b63550be7d880d395261fdcdb20",
-            "https://files.pythonhosted.org/packages/c4/71/86288c14c8e557bbc3489d6bd2963caed7e54f478976b0c359f9b3597bf2/envoy_base_utils-0.6.9-py3-none-any.whl": "sha256:664dcc19ee12125398222a7628bdcbb40e265b3846e197e4014434fcd273fd61"
+            "https://files.pythonhosted.org/packages/bd/98/e3c1a16a299fe399092c45cb91e148c2f99a4a7a551d6729dd411ffc4c3d/envoy_base_utils-0.6.12.tar.gz": "sha256:d2ab511a1f6f59f7319c6dc6b70088bad139be2165466ed9ce6932b0c96faa02",
+            "https://files.pythonhosted.org/packages/d9/4d/275e6c7033b8b5d4f59216034d98c303feb2d99185da479963e458083699/envoy_base_utils-0.6.12-py3-none-any.whl": "sha256:8b860c9d88493f1eb1044cc48fa9ae953cd31d9da77102d05e9c6af65ff14eae"
           },
           "envoy-ci-report": {
             "https://files.pythonhosted.org/packages/43/c9/24aceda89afab59b701ea7f9f004c422a9e4adfb63003e086692a3c9a0dc/envoy_ci_report-0.1.1.tar.gz": "sha256:481115be4d05941b83ffbbd8fdac241f10e9823c076f850d8bef7f0308aa382d",
             "https://files.pythonhosted.org/packages/85/a8/d694c1b8d931b985f75146f8ac0168f7fe2ece7679a0cf66653efe1c0f22/envoy_ci_report-0.1.1-py3-none-any.whl": "sha256:a38da2e996b266b32ff80f2f404018d1887f156ad086e3fa8fd4233bb4cd6fe7"
           },
           "envoy-code-check": {
-            "https://files.pythonhosted.org/packages/c9/8b/340c8898dec2341b36d6fbc1cc93ee03d23061dd94d2af89834a8324f520/envoy_code_check-0.6.7-py3-none-any.whl": "sha256:7b7fbc99c114f663126be738095945d479e0b4c6f71d3d784bc234d9d9098a8d",
-            "https://files.pythonhosted.org/packages/de/0a/0850dc942e491cd40d3ab96bfc7c7e4a063307c4f2b93563dfa9ea333033/envoy_code_check-0.6.7.tar.gz": "sha256:76b0edf0b95d8a31b5d78481b3a7f5ae4a2925c04d2158e77cc3549653a4213e"
+            "https://files.pythonhosted.org/packages/0c/12/b36eed1f6c7402bba14d1567122919aea69beeed312d71b229465eb1826d/envoy_code_check-0.6.9.tar.gz": "sha256:9a212107476b4a36b3743fb550eacad3ede72b3cdbf825dc944c25e48e4e1eb6",
+            "https://files.pythonhosted.org/packages/7d/4f/c97a5be443f8a3f40cf56864f94d578cfb1b6d500c20e04946713251d347/envoy_code_check-0.6.9-py3-none-any.whl": "sha256:9ded56211e8e81ffc27c97b923e17dd7a6dd60e72454755f07bb1555ca019279"
           },
           "envoy-dependency-check": {
             "https://files.pythonhosted.org/packages/06/7c/afcea506f6d304321ce8deca1ff7e21e6fc4c34e6431e66409219afb49b3/envoy_dependency_check-0.2.1-py3-none-any.whl": "sha256:a037ab34b7db9893ecf07247c8e9149481148de26f340f1c27e4adfa7a48e227",
```

**File**: `changelogs/changelogs.yaml` (modified, +96/-10)
```diff
@@ -42,64 +42,138 @@ sections:
 areas:
   access_log:
     title: access_log
+  admin:
+    title: admin
+  aggregate_cluster:
+    title: aggregate_cluster
+  ai_protocol_manager:
+    title: ai_protocol_manager
   alts:
     title: alts
+  api:
+    title: api
   attributes:
     title: attributes
+  aws:
+    title: aws
   basic_auth:
     title: basic_auth
   build:
     title: build
+  cache:
+    title: cache
+  cares:
+    title: cares
   circuit_breaker:
     title: circuit_breaker
   composite:
     title: composite
+  composite_cluster:
+    title: composite_cluster
   compressor:
     title: compressor
+  config:
+    title: config
   contrib:
     title: contrib
   credential_injector:
     title: credential_injector
+  cpu_utilization:
+    title: cpu_utilization
+  dns:
+    title: dns
   dns_resolver:
     title: dns_resolver
+  drain:
+    title: drain
+  dynamic_forward_proxy:
+    title: dynamic_forward_proxy
   dynamic_modules:
     title: dynamic_modules
+  ext_authz:
+    title: ext_authz
+  ext_proc:
+    title: ext_proc
+  filter_chain:
+    title: filter_chain
+  formatter:
+    title: formatter
   gcp_authn:
     title: gcp_authn
   geoip:
     title: geoip
+  generic_proxy:
+    title: generic_proxy
   golang:
     title: golang
+  grpc_field_extraction:
+    title: grpc_field_extraction
+  grpc_http1_reverse_bridge:
+    title: grpc_http1_reverse_bridge
+  happy_eyeballs:
+    title: happy_eyeballs
   http:
     title: http
   http2:
     title: http2
+  http3:
+    title: http3
+  http_compressor:
+    title: http_compressor
   http_inspector:
     title: http_inspector
   ip_tagging:
     title: ip_tagging
   jwt_authn:
     title: jwt_authn
+  listener:
+    title: listener
   load_balancing:
     title: load_balancing
   load_report:
     title: load_report
+  local_ratelimit:
+    title: local_ratelimit
   logging:
     title: logging
+  lua:
+    title: lua
+  matching:
+    title: matching
+  mcp:
+    title: mcp
   mcp_json_rest_bridge:
     title: mcp_json_rest_bridge
   mcp_router:
     title: mcp_router
+  mcp_transcoder:
+    title: mcp_transcoder
   mysql_proxy:
     title: mysql_proxy
   network_ext_proc:
     title: network_ext_proc
   oauth2:
     title: oauth2
+  on_demand:
+    title: on_demand
+  opentelemetry:
+    title: opentelemetry
+  orca:
+    title: orca
+  original_dst:
+    title: original_dst
+  overload_manager:
+    title: overload_manager
+  postgres_proxy:
+    title: postgres_proxy
+  proxy_protocol:
+    title: proxy_protocol
   quic:
     title: quic
   ratelimit:
     title: ratelimit
+  ratelimit_descriptors:
+    title: ratelimit_descriptors
   rbac:
     title: rbac
   rds:
@@ -112,8 +186,12 @@ areas:
     title: reverse_tunnel
   router:
     title: router
+  safe_regex:
+    title: safe_regex
   sds:
     title: sds
+  server:
+    title: server
   set_metadata_filter:
     title: set_metadata_filter
   sockets:
@@ -130,21 +208,29 @@ areas:
     title: tcp_proxy
   tls:
     title: tls
+  tls_inspector:
+    title: tls_inspector
   tracing:
     title: tracing
+  thrift_proxy:
+    title: thrift_proxy
+  udp:
+    title: udp
+  upstream:
+    title: upstream
+  uri_template:
+    title: uri_template
+  url_normalization:
+    title: url_normalization
   vhds:
     title: vhds
-  wasm:
-    title: wasm
   watchdog:
     title: watchdog
-  dns:
-    title: dns
-  proxy_protocol:
-    title: proxy_protocol
+  wasm:
+    title: wasm
+  websocket:
+    title: websocket
+  zipkin:
+    title: zipkin
   zstd:
     title: zstd
-  server:
-    title: server
-  udp:
-    title: udp
```

**File**: `docs/MODULE.bazel.lock` (modified, +4/-4)
```diff
@@ -4175,16 +4175,16 @@
             "https://files.pythonhosted.org/packages/ae/ed/aefcc8cd0ba62a0560c3c18c33925362d46c6075480bfa4df87b28e169a9/docutils-0.21.2.tar.gz": "sha256:3a6b18732edf182daa3cd12775bbb338cf5691468f91eeeb109deff6ebfa986f"
           },
           "envoy-base-utils": {
-            "https://files.pythonhosted.org/packages/94/8b/aed2ee446b06c254de6d0b2a53959dd06916f7f059bc17e1e94b47cad45c/envoy_base_utils-0.6.9.tar.gz": "sha256:b088b7621b5075005c48cdbef5db5675827b7b63550be7d880d395261fdcdb20",
-            "https://files.pythonhosted.org/packages/c4/71/86288c14c8e557bbc3489d6bd2963caed7e54f478976b0c359f9b3597bf2/envoy_base_utils-0.6.9-py3-none-any.whl": "sha256:664dcc19ee12125398222a7628bdcbb40e265b3846e197e4014434fcd273fd61"
+            "https://files.pythonhosted.org/packages/bd/98/e3c1a16a299fe399092c45cb91e148c2f99a4a7a551d6729dd411ffc4c3d/envoy_base_utils-0.6.12.tar.gz": "sha256:d2ab511a1f6f59f7319c6dc6b70088bad139be2165466ed9ce6932b0c96faa02",
+            "https://files.pythonhosted.org/packages/d9/4d/275e6c7033b8b5d4f59216034d98c303feb2d99185da479963e458083699/envoy_base_utils-0.6.12-py3-none-any.whl": "sha256:8b860c9d88493f1eb1044cc48fa9ae953cd31d9da77102d05e9c6af65ff14eae"
           },
           "envoy-ci-report": {
             "https://files.pythonhosted.org/packages/43/c9/24aceda89afab59b701ea7f9f004c422a9e4adfb63003e086692a3c9a0dc/envoy_ci_report-0.1.1.tar.gz": "sha256:481115be4d05941b83ffbbd8fdac241f10e9823c076f850d8bef7f0308aa382d",
             "https://files.pythonhosted.org/packages/85/a8/d694c1b8d931b985f75146f8ac0168f7fe2ece7679a0cf66653efe1c0f22/envoy_ci_report-0.1.1-py3-none-any.whl": "sha256:a38da2e996b266b32ff80f2f404018d1887f156ad086e3fa8fd4233bb4cd6fe7"
           },
           "envoy-code-check": {
-            "https://files.pythonhosted.org/packages/c9/8b/340c8898dec2341b36d6fbc1cc93ee03d23061dd94d2af89834a8324f520/envoy_code_check-0.6.7-py3-none-any.whl": "sha256:7b7fbc99c114f663126be738095945d479e0b4c6f71d3d784bc234d9d9098a8d",
-            "https://files.pythonhosted.org/packages/de/0a/0850dc942e491cd40d3ab96bfc7c7e4a063307c4f2b93563dfa9ea333033/envoy_code_check-0.6.7.tar.gz": "sha256:76b0edf0b95d8a31b5d78481b3a7f5ae4a2925c04d2158e77cc3549653a4213e"
+            "https://files.pythonhosted.org/packages/0c/12/b36eed1f6c7402bba14d1567122919aea69beeed312d71b229465eb1826d/envoy_code_check-0.6.9.tar.gz": "sha256:9a212107476b4a36b3743fb550eacad3ede72b3cdbf825dc944c25e48e4e1eb6",
+            "https://files.pythonhosted.org/packages/7d/4f/c97a5be443f8a3f40cf56864f94d578cfb1b6d500c20e04946713251d347/envoy_code_check-0.6.9-py3-none-any.whl": "sha256:9ded56211e8e81ffc27c97b923e17dd7a6dd60e72454755f07bb1555ca019279"
           },
           "envoy-dependency-check": {
             "https://files.pythonhosted.org/packages/06/7c/afcea506f6d304321ce8deca1ff7e21e6fc4c34e6431e66409219afb49b3/envoy_dependency_check-0.2.1-py3-none-any.whl": "sha256:a037ab34b7db9893ecf07247c8e9149481148de26f340f1c27e4adfa7a48e227",
```

**File**: `docs/tools/python/requirements.in` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ sphinx-rtd-theme>=3.0.2
 
 # Shared dependencies (also in main workspace)
 aio.run.runner
-envoy.base.utils>=0.6.9
-envoy.code.check>=0.6.7
+envoy.base.utils>=0.6.12
+envoy.code.check>=0.6.9
 frozendict>=2.3.7
 jinja2
 packaging
```

**File**: `docs/tools/python/requirements.txt` (modified, +24/-189)
```diff
@@ -34,7 +34,7 @@ aio-run-runner==0.4.1 \
     --hash=sha256:03c2978e4c7e1d02a55e25b0c081603d7900387bcce4fe80b8e8af8f3284e05b \
     --hash=sha256:43c80688c50ba3a528d88635fee5653b9f0f40fc4a036e1aeaddf8ada3794d2e
     # via
-    #   -r requirements.in
+    #   -r tools/python/requirements.in
     #   aio-run-checker
     #   envoy-base-utils
     #   envoy-docs-sphinx-runner
@@ -44,242 +44,123 @@ aiohappyeyeballs==2.6.1 \
     # via aiohttp
 aiohttp==3.14.3 \
     --hash=sha256:03cd2bde3d7f085b64e549c985f4bb928cad7e8ecf5323bfca320db548d81b39 \
-    --hash=sha256:03cd2bde3d7f085b64e549c985f4bb928cad7e8ecf5323bfca320db548d81b39 \
-    --hash=sha256:041badb8f84396357c4d3ad26de6afd7a32b112f43d3c63045c0c8278cfd2043 \
     --hash=sha256:041badb8f84396357c4d3ad26de6afd7a32b112f43d3c63045c0c8278cfd2043 \
     --hash=sha256:0a5ff2dfbb9ce645fa5b8ef3e02c6c0b9cc3f6030ff863d0c51fffc50cb5541b \
-    --hash=sha256:0a5ff2dfbb9ce645fa5b8ef3e02c6c0b9cc3f6030ff863d0c51fffc50cb5541b \
     --hash=sha256:0fdea2281997af69da84c77ffa6f5938a0285f21fb3887c249d67419ca865b3d \
-    --hash=sha256:0fdea2281997af69da84c77ffa6f5938a0285f21fb3887c249d67419ca865b3d \
-    --hash=sha256:11fb37ef075669eee52ab1928fbf6e1741fada40409fa309ebde9607a962aebf \
     --hash=sha256:11fb37ef075669eee52ab1928fbf6e1741fada40409fa309ebde9607a962aebf \
     --hash=sha256:134ac5ddcf61c6fad984b9a5727d83492ada43d63471db20fb73042c13fca62f \
-    --hash=sha256:134ac5ddcf61c6fad984b9a5727d83492ada43d63471db20fb73042c13fca62f \
     --hash=sha256:152516815ef926786a0b6ae2b8f1fd2e0c71582dee0b435636865316fd4891b7 \
-    --hash=sha256:152516815ef926786a0b6ae2b8f1fd2e0c71582dee0b435636865316fd4891b7 \
-    --hash=sha256:1576145bdceeb92382d899751e12743a3a5b8e460a841e3e50543859e54864dc \
     --hash=sha256:1576145bdceeb92382d899751e12743a3a5b8e460a841e3e50543859e54864dc \
     --hash=sha256:16100ad3ab8d649fdfbee87602d9d2dcdca9df0b9eda8a1b5fdc0d41f96da559 \
-    --hash=sha256:16100ad3ab8d649fdfbee87602d9d2dcdca9df0b9eda8a1b5fdc0d41f96da559 \
     --hash=sha256:16ea7e24c309fb7c0bbd505d149abe4fe4dccfb8db911db7dbec0921bc889a6f \
-    --hash=sha256:16ea7e24c309fb7c0bbd505d149abe4fe4dccfb8db911db7dbec0921bc889a6f \
-    --hash=sha256:18c441d0a8fca6de8d1f546849b9f0ab20d435993e2c5b59562b2fae6be2f929 \
     --hash=sha256:18c441d0a8fca6de8d1f546849b9f0ab20d435993e2c5b59562b2fae6be2f929 \
     --hash=sha256:18cb43369747b2ae007bd2655fb8e63a099c2ff1d207962943636dac989b3147 \
-    --hash=sha256:18cb43369747b2ae007bd2655fb8e63a099c2ff1d207962943636dac989b3147 \
-    --hash=sha256:1b59533861b70a2185c8f4f350f791f39d64358ef6944ce71c5240c9ec0982c9 \
     --hash=sha256:1b59533861b70a2185c8f4f350f791f39d64358ef6944ce71c5240c9ec0982c9 \
     --hash=sha256:1c5281acc88b92396f88c7e1e2748f8466689df22b80170e4f51efa712fb47a8 \
-    --hash=sha256:1c5281acc88b92396f88c7e1e2748f8466689df22b80170e4f51efa712fb47a8 \
     --hash=sha256:1c5ec8fb1bcc31a8466f74aaf26c345d5c386fa4bd08a3f0eb9c7a4a3fe8b5bf \
-    --hash=sha256:1c5ec8fb1bcc31a8466f74aaf26c345d5c386fa4bd08a3f0eb9c7a4a3fe8b5bf \
-    --hash=sha256:1caa7b0d05f3e3a36f87788c59e970a7ee1cefcfcbb924a9f138c4a6551c9cb7 \
     --hash=sha256:1caa7b0d05f3e3a36f87788c59e970a7ee1cefcfcbb924a9f138c4a6551c9cb7 \
     --hash=sha256:21c016079415ed3fd676963e9793700a566d85dbbd6bfc564b9b2d209147dcc8 \
-    --hash=sha256:21c016079415ed3fd676963e9793700a566d85dbbd6bfc564b9b2d209147dcc8 \
-    --hash=sha256:2498f0fe69ead802f9675beca44a7c21c62fdaa4ec5145ea1c3ad6edbee29f85 \
     --hash=sha256:2498f0fe69ead802f9675beca44a7c21c62fdaa4ec5145ea1c3ad6edbee29f85 \
     --hash=sha256:25bd2708db6bdf6a6630dd37bdcdfcb47c4434d22ac69c64665b802910140b30 \
-    --hash=sha256:25bd2708db6bdf6a6630dd37bdcdfcb47c4434d22ac69c64665b802910140b30 \
     --hash=sha256:270d3dace9ca2f10f0da5d8ebe519b7a310fc6112ed916e32df5866df0888553 \
-    --hash=sha256:270d3dace9ca2f10f0da5d8ebe519b7a310fc6112ed916e32df5866df0888553 \
-    --hash=sha256:2e1161602f45a54de2ce0905243a95f58cb42dcd378402f3697f5e0b21e9d2e7 \
     --hash=sha256:2e1161602f45a54de2ce0905243a95f58cb42dcd378402f3697f5e0b21e9d2e7 \
     --hash=sha256:2e9878ae68e4a5f1c0abe4dd497dbc3d51946f5837b56759e2a02e78fa90ef86 \
-    --hash=sha256:2e9878ae68e4a5f1c0abe4dd497dbc3d51946f5837b56759e2a02e78fa90ef86 \
-    --hash=sha256:30402d03a7c0ff52bce290b57e564e9079fd9d0cb545c8aba73f86a103162d2e \
     --hash=sha256:30402d03a7c0ff52bce290b57e564e9079fd9d0cb545c8aba73f86a103162d2e \
     --hash=sha256:33a2d7c28d33797a2e99923dffa63f83d908a19b6bf26cfe80fa790aa5e1a75a \
-    --hash=sha256:33a2d7c28d33797a2e99923dffa63f83d908a19b6bf26cfe80fa790aa5e1a75a \
     --hash=sha256:362a3fd481769cac1a824514bcd86fda51c65e8fe6e051099e008fddde6db17c \
-    --hash=sha256:362a3fd481769cac1a824514bcd86fda51c65e8fe6e051099e008fddde6db17c \
-    --hash=sha256:38901a84da3ce22249f6e860bf8f90d141bcab7da090cc398f8bb58c0e44b7da \
     --hash=sha256:38901a84da3ce22249f6e860bf8f90d141bcab7da090cc398f8bb58c0e44b7da \
     --hash=sha256:39aded8c7f3b935b54aab1d8d73c70ec0ee2d3ec3b943e
```

**File**: `mobile/MODULE.bazel.lock` (modified, +4/-4)
```diff
@@ -4374,16 +4374,16 @@
             "https://files.pythonhosted.org/packages/39/a4/5180d9afc57e8fca05601dd652bdff19604c218814037fe90ffc7625a50a/docutils-0.23.tar.gz": "sha256:746f5060322511280a1e50eb76846ed6bf2342984b2ac04dc42caa1a8d78799e"
           },
           "envoy-base-utils": {
-            "https://files.pythonhosted.org/packages/94/8b/aed2ee446b06c254de6d0b2a53959dd06916f7f059bc17e1e94b47cad45c/envoy_base_utils-0.6.9.tar.gz": "sha256:b088b7621b5075005c48cdbef5db5675827b7b63550be7d880d395261fdcdb20",
-            "https://files.pythonhosted.org/packages/c4/71/86288c14c8e557bbc3489d6bd2963caed7e54f478976b0c359f9b3597bf2/envoy_base_utils-0.6.9-py3-none-any.whl": "sha256:664dcc19ee12125398222a7628bdcbb40e265b3846e197e4014434fcd273fd61"
+            "https://files.pythonhosted.org/packages/bd/98/e3c1a16a299fe399092c45cb91e148c2f99a4a7a551d6729dd411ffc4c3d/envoy_base_utils-0.6.12.tar.gz": "sha256:d2ab511a1f6f59f7319c6dc6b70088bad139be2165466ed9ce6932b0c96faa02",
+            "https://files.pythonhosted.org/packages/d9/4d/275e6c7033b8b5d4f59216034d98c303feb2d99185da479963e458083699/envoy_base_utils-0.6.12-py3-none-any.whl": "sha256:8b860c9d88493f1eb1044cc48fa9ae953cd31d9da77102d05e9c6af65ff14eae"
           },
           "envoy-ci-report": {
             "https://files.pythonhosted.org/packages/43/c9/24aceda89afab59b701ea7f9f004c422a9e4adfb63003e086692a3c9a0dc/envoy_ci_report-0.1.1.tar.gz": "sha256:481115be4d05941b83ffbbd8fdac241f10e9823c076f850d8bef7f0308aa382d",
             "https://files.pythonhosted.org/packages/85/a8/d694c1b8d931b985f75146f8ac0168f7fe2ece7679a0cf66653efe1c0f22/envoy_ci_report-0.1.1-py3-none-any.whl": "sha256:a38da2e996b266b32ff80f2f404018d1887f156ad086e3fa8fd4233bb4cd6fe7"
           },
           "envoy-code-check": {
-            "https://files.pythonhosted.org/packages/c9/8b/340c8898dec2341b36d6fbc1cc93ee03d23061dd94d2af89834a8324f520/envoy_code_check-0.6.7-py3-none-any.whl": "sha256:7b7fbc99c114f663126be738095945d479e0b4c6f71d3d784bc234d9d9098a8d",
-            "https://files.pythonhosted.org/packages/de/0a/0850dc942e491cd40d3ab96bfc7c7e4a063307c4f2b93563dfa9ea333033/envoy_code_check-0.6.7.tar.gz": "sha256:76b0edf0b95d8a31b5d78481b3a7f5ae4a2925c04d2158e77cc3549653a4213e"
+            "https://files.pythonhosted.org/packages/0c/12/b36eed1f6c7402bba14d1567122919aea69beeed312d71b229465eb1826d/envoy_code_check-0.6.9.tar.gz": "sha256:9a212107476b4a36b3743fb550eacad3ede72b3cdbf825dc944c25e48e4e1eb6",
+            "https://files.pythonhosted.org/packages/7d/4f/c97a5be443f8a3f40cf56864f94d578cfb1b6d500c20e04946713251d347/envoy_code_check-0.6.9-py3-none-any.whl": "sha256:9ded56211e8e81ffc27c97b923e17dd7a6dd60e72454755f07bb1555ca019279"
           },
           "envoy-dependency-check": {
             "https://files.pythonhosted.org/packages/06/7c/afcea506f6d304321ce8deca1ff7e21e6fc4c34e6431e66409219afb49b3/envoy_dependency_check-0.2.1-py3-none-any.whl": "sha256:a037ab34b7db9893ecf07247c8e9149481148de26f340f1c27e4adfa7a48e227",
```

---

### Incident Patch 5: `6573b935` (2026-10-05)
**Commit Message**: fix: expose realm field on BasicAuth filter to fix browser credential caching (#46941)

_Commit Message:_
Envoy's basic_auth HTTP filter defaulted the WWW-Authenticate: Basic
realm="..." value to the full request URI (scheme + host + path) when no
realm was configured. Because the realm changed on every distinct URL
path, browsers — which cache Basic Auth credentials keyed by (origin,
realm) per RFC 7617 — could not reuse credentials across different paths
of the same protected route and re-prompted for credentials on every new
page navigation.
The BasicAuth proto had no realm field, so operators had no way to set a
stable realm.

_Additional Description:_
basic_auth HTTP filter now supports a configurable realm field on both
BasicAuth and BasicAuthPerRoute. When set, the value is used verbatim in
the WWW-Authenticate response header, enabling browsers to correctly
cache credentials across paths. When not set, the previous behavior of
deriving the realm from the request URI is preserved.

_Risk Level:_
Low

_Testing:_
Test cases added.

Release Notes:
Added a realm field to the basic_auth HTTP filter, allowing browsers to
cache credentials correctly across paths. When unset, the pr

**File**: `api/envoy/extensions/filters/http/basic_auth/v3/basic_auth.proto` (modified, +18/-1)
```diff
@@ -29,7 +29,7 @@ option (udpa.annotations.file_status).package_version_status = ACTIVE;
 //       user1:{SHA}hashed_user1_password
 //       user2:{SHA}hashed_user2_password
 //
-// [#next-free-field: 6]
+// [#next-free-field: 7]
 message BasicAuth {
   // Username-password pairs used to verify user credentials in the "Authorization" header.
   // The value needs to be the htpasswd format.
@@ -71,6 +71,16 @@ message BasicAuth {
   // other authentication methods (e.g. JWT) and using a downstream RBAC filter to enforce
   // OR semantics.
   bool emit_dynamic_metadata = 5;
+
+  // The realm to use in the ``WWW-Authenticate`` response header when authentication fails.
+  // The value is placed verbatim into ``WWW-Authenticate: Basic realm="<value>"``.
+  //
+  // If not specified, Envoy falls back to using the full request URI
+  // (scheme + authority + path, truncated to 256 characters), which differs per path and
+  // prevents browsers from reusing cached credentials across paths on the same origin.
+  // Set a fixed realm to enable correct credential caching. The realm pattern dose not
+  // allow DEL, 32 C0 control chars including CRLF injection chars.
+  string realm = 6 [(validate.rules).string = {pattern: "^[^\\x00-\\x1f\\x7f]*$"}];
 }
 
 // Extra settings that may be added to per-route configuration for
@@ -79,4 +89,11 @@ message BasicAuthPerRoute {
   // Username-password pairs for this route.
   config.core.v3.DataSource users = 1
       [(validate.rules).message = {required: true}, (udpa.annotations.sensitive) = true];
+
+  // Per-route realm override for the ``WWW-Authenticate`` response header. If set, takes
+  // precedence over the filter-level ``BasicAuth.realm``. Same escaping semantics apply.
+  // If neither this nor the filter-level realm is set, the full request URI is used.
+  // Set a fixed realm to enable correct credential caching. The realm pattern dose not
+  // allow DEL, 32 C0 control chars including CRLF injection chars.
+  string realm = 2 [(validate.rules).string = {pattern: "^[^\\x00-\\x1f\\x7f]*$"}];
 }
```

**File**: `changelogs/current/bug_fixes/api__expose-realm-field-on-basicauth-filter.rst` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fixed incorrect realm value in BasicAuth filter. Added a realm field to the basic_auth HTTP filter, allowing browsers to correctly cache credentials across paths. When unset, the previous behavior is preserved, the realm is derived from the request URI.
```

**File**: `source/extensions/filters/http/basic_auth/basic_auth_filter.cc` (modified, +40/-15)
```diff
@@ -32,15 +32,28 @@ std::string computeSHA1(absl::string_view password) {
   return Base64::encode(reinterpret_cast<const char*>(hash), SHA_DIGEST_LENGTH);
 }
 
+// Escape `"` and `\` for use inside an quoted-string.
+std::string escapeForQuotedString(absl::string_view value) {
+  std::string result;
+  result.reserve(value.size());
+  for (char c : value) {
+    if (c == '\\' || c == '"') {
+      result.push_back('\\');
+    }
+    result.push_back(c);
+  }
+  return result;
+}
+
 } // namespace
 
 FilterConfig::FilterConfig(UserMap&& users, const std::string& forward_username_header,
                            const std::string& authentication_header, bool allow_missing,
-                           bool emit_dynamic_metadata, const std::string& stats_prefix,
-                           Stats::Scope& scope)
+                           bool emit_dynamic_metadata, const std::string& realm,
+                           const std::string& stats_prefix, Stats::Scope& scope)
     : users_(std::move(users)), forward_username_header_(forward_username_header),
       authentication_header_(Http::LowerCaseString(authentication_header)),
-      allow_missing_(allow_missing), emit_dynamic_metadata_(emit_dynamic_metadata),
+      allow_missing_(allow_missing), emit_dynamic_metadata_(emit_dynamic_metadata), realm_(realm),
       stats_(generateStats(stats_prefix + "basic_auth.", scope)) {}
 
 BasicAuthFilter::BasicAuthFilter(FilterConfigConstSharedPtr config) : config_(std::move(config)) {}
@@ -53,6 +66,14 @@ Http::FilterHeadersStatus BasicAuthFilter::decodeHeaders(Http::RequestHeaderMap&
     users = &route_specific_settings->users();
   }
 
+  // Resolve realm: per-route > filter-level > empty (triggers URI fallback in onDenied).
+  absl::string_view effective_realm;
+  if (route_specific_settings != nullptr && !route_specific_settings->realm().empty()) {
+    effective_realm = route_specific_settings->realm();
+  } else if (!config_->realm().empty()) {
+    effective_realm = config_->realm();
+  }
+
   Http::HeaderMap::GetResult auth_header;
   if (!config_->authenticationHeader().get().empty()) {
     auth_header = headers.get(config_->authenticationHeader());
@@ -65,7 +86,7 @@ Http::FilterHeadersStatus BasicAuthFilter::decodeHeaders(Http::RequestHeaderMap&
       return Http::FilterHeadersStatus::Continue;
     }
     return onDenied("User authentication failed. Missing username and password.",
-                    "no_credential_for_basic_auth");
+                    "no_credential_for_basic_auth", effective_realm);
   }
 
   absl::string_view auth_value = auth_header[0]->value().getStringView();
@@ -75,7 +96,7 @@ Http::FilterHeadersStatus BasicAuthFilter::decodeHeaders(Http::RequestHeaderMap&
       return Http::FilterHeadersStatus::Continue;
     }
     return onDenied("User authentication failed. Expected 'Basic' authentication scheme.",
-                    "invalid_scheme_for_basic_auth");
+                    "invalid_scheme_for_basic_auth", effective_realm);
   }
 
   // Extract and decode the Base64 part of the header.
@@ -86,7 +107,7 @@ Http::FilterHeadersStatus BasicAuthFilter::decodeHeaders(Http::RequestHeaderMap&
   const size_t colon_pos = decoded.find(':');
   if (colon_pos == std::string::npos) {
     return onDenied("User authentication failed. Invalid basic credential format.",
-                    "invalid_format_for_basic_auth");
+                    "invalid_format_for_basic_auth", effective_realm);
   }
 
   absl::string_view decoded_view = decoded;
@@ -95,7 +116,7 @@ Http::FilterHeadersStatus BasicAuthFilter::decodeHeaders(Http::RequestHeaderMap&
 
   if (!validateUser(*users, username, password)) {
     return onDenied("User authentication failed. Invalid username/password combination.",
-                    "invalid_credential_for_basic_auth");
+                    "invalid_credential_for_basic_auth", effective_realm);
   }
 
   if (!config_->forwardUsernameHeader().empty()) {
@@ -133,17 +154,21 @@ void BasicAuthFilter::setDynamicMetadata(absl::string_view username) {
 }
 
 Http::FilterHeadersStatus BasicAuthFilter::onDenied(absl::string_view body,
-                                                    absl::string_view response_code_details) {
+                                                    absl::string_view response_code_details,
+                                                    absl::string_view realm) {
   config_->stats().denied_.inc();
   decoder_callbacks_->sendLocalReply(
       Http::Code::Unauthorized, body,
-      [this](Http::ResponseHeaderMap& headers) {
-        // requestHeaders should always be non-null at this point since onDenied is only called by
-        // decodeHeaders.
-        const auto request_headers = this->decoder_callbacks_->requestHeaders();
-        const std::string uri = Http::Utility::buildOriginalUri(*request_headers, MaximumUriLength);
-        const std::string value = absl::StrCat("Basic realm=\"", uri, "\"");
-        headers.setReferenceKey(Ht
```

**File**: `source/extensions/filters/http/basic_auth/basic_auth_filter.h` (modified, +10/-3)
```diff
@@ -46,13 +46,15 @@ class FilterConfig {
 public:
   FilterConfig(UserMap&& users, const std::string& forward_username_header,
                const std::string& authentication_header, bool allow_missing,
-               bool emit_dynamic_metadata, const std::string& stats_prefix, Stats::Scope& scope);
+               bool emit_dynamic_metadata, const std::string& realm,
+               const std::string& stats_prefix, Stats::Scope& scope);
   const BasicAuthStats& stats() const { return stats_; }
   const std::string& forwardUsernameHeader() const { return forward_username_header_; }
   const UserMap& users() const { return users_; }
   const Http::LowerCaseString& authenticationHeader() const { return authentication_header_; }
   bool allowMissing() const { return allow_missing_; }
   bool emitDynamicMetadata() const { return emit_dynamic_metadata_; }
+  const std::string& realm() const { return realm_; }
 
 private:
   static BasicAuthStats generateStats(const std::string& prefix, Stats::Scope& scope) {
@@ -64,6 +66,7 @@ class FilterConfig {
   const Http::LowerCaseString authentication_header_;
   const bool allow_missing_{};
   const bool emit_dynamic_metadata_{};
+  const std::string realm_;
   BasicAuthStats stats_;
 };
 using FilterConfigConstSharedPtr = std::shared_ptr<const FilterConfig>;
@@ -75,11 +78,14 @@ using FilterConfigSharedPtr = std::shared_ptr<FilterConfig>;
  */
 class FilterConfigPerRoute : public Router::RouteSpecificFilterConfig {
 public:
-  FilterConfigPerRoute(UserMap&& users) : users_(std::move(users)) {}
+  FilterConfigPerRoute(UserMap&& users, const std::string& realm)
+      : users_(std::move(users)), realm_(realm) {}
   const UserMap& users() const { return users_; }
+  const std::string& realm() const { return realm_; }
 
 private:
   const UserMap users_;
+  const std::string realm_;
 };
 
 // The Envoy filter to process HTTP basic auth.
@@ -95,7 +101,8 @@ class BasicAuthFilter : public Http::PassThroughDecoderFilter,
 
 private:
   Http::FilterHeadersStatus onDenied(absl::string_view body,
-                                     absl::string_view response_code_details);
+                                     absl::string_view response_code_details,
+                                     absl::string_view realm);
   void setDynamicMetadata(absl::string_view username);
 
   // The callback function.
```

**File**: `source/extensions/filters/http/basic_auth/config.cc` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ absl::StatusOr<Http::FilterFactoryCb> BasicAuthFilterFactory::createHttpFilterFa
   FilterConfigConstSharedPtr config = std::make_unique<FilterConfig>(
       std::move(users_or.value()), proto_config.forward_username_header(),
       proto_config.authentication_header(), proto_config.allow_missing(),
-      proto_config.emit_dynamic_metadata(), extra_context.statsPrefixOr(),
+      proto_config.emit_dynamic_metadata(), proto_config.realm(), extra_context.statsPrefixOr(),
       extra_context.statsPrefixScopeOr(context));
   return [config](Http::FilterChainFactoryCallbacks& callbacks) -> void {
     callbacks.addStreamDecoderFilter(std::make_shared<BasicAuthFilter>(config));
@@ -89,7 +89,7 @@ BasicAuthFilterFactory::createRouteSpecificFilterConfigTyped(
   RETURN_IF_NOT_OK_REF(htpasswd_or.status());
   auto users_or = readHtpasswd(htpasswd_or.value());
   RETURN_IF_NOT_OK_REF(users_or.status());
-  return std::make_unique<FilterConfigPerRoute>(std::move(users_or.value()));
+  return std::make_unique<FilterConfigPerRoute>(std::move(users_or.value()), proto_config.realm());
 }
 
 REGISTER_FACTORY(BasicAuthFilterFactory, Server::Configuration::NamedHttpFilterConfigFactory);
```

**File**: `test/extensions/filters/http/basic_auth/basic_auth_integration_test.cc` (modified, +37/-0)
```diff
@@ -28,6 +28,17 @@ name: envoy.filters.http.basic_auth
   forward_username_header: x-username
 )EOF";
 
+const std::string BasicAuthFilterConfigWithRealm =
+    R"EOF(
+name: envoy.filters.http.basic_auth
+typed_config:
+  "@type": type.googleapis.com/envoy.extensions.filters.http.basic_auth.v3.BasicAuth
+  users:
+    inline_string: |-
+      user1:{SHA}tESsBmE/yNY3lb6a0L6vVQEZNqw=
+  realm: myapp
+)EOF";
+
 // admin, admin
 const std::string AdminUsers =
     R"EOF(
@@ -43,6 +54,11 @@ class BasicAuthIntegrationTest : public HttpProtocolIntegrationTest {
     initialize();
   }
 
+  void initializeFilterWithRealm() {
+    config_helper_.prependFilter(BasicAuthFilterConfigWithRealm);
+    initialize();
+  }
+
   void initializePerRouteFilter(const std::string& yaml_config) {
     config_helper_.addConfigModifier(
         [&yaml_config](
@@ -260,6 +276,27 @@ TEST_P(BasicAuthIntegrationTest, BasicAuthPerRouteEnabledInvalidCredentials) {
       response->headers().get(Http::Headers::get().WWWAuthenticate)[0]->value().getStringView());
 }
 
+// Verify that the proto-level realm field is wired through config.
+TEST_P(BasicAuthIntegrationTest, FixedRealmInWWWAuthenticate) {
+  initializeFilterWithRealm();
+  codec_client_ = makeHttpConnection(lookupPort("http"));
+
+  auto response = codec_client_->makeHeaderOnlyRequest(Http::TestRequestHeaderMapImpl{
+      {":method", "GET"},
+      {":path", "/some/deep/path"},
+      {":scheme", "http"},
+      {":authority", "host"},
+  });
+
+  ASSERT_TRUE(response->waitForEndStream());
+  ASSERT_TRUE(response->complete());
+  EXPECT_EQ("401", response->headers().getStatusValue());
+  EXPECT_EQ("User authentication failed. Missing username and password.", response->body());
+  EXPECT_EQ(
+      "Basic realm=\"myapp\"",
+      response->headers().get(Http::Headers::get().WWWAuthenticate)[0]->value().getStringView());
+}
+
 } // namespace
 } // namespace BasicAuth
 } // namespace HttpFilters
```

**File**: `test/extensions/filters/http/basic_auth/filter_test.cc` (modified, +162/-8)
```diff
@@ -23,7 +23,7 @@ class FilterTest : public testing::Test {
     users.insert({"user2", {"user2", "EJ9LPFDXsN9ynSmbxvjp75Bmlx8="}}); // user2:test2
     config_ = std::make_unique<FilterConfig>(std::move(users), "x-username", "",
                                              /*allow_missing=*/false,
-                                             /*emit_dynamic_metadata=*/false, "stats",
+                                             /*emit_dynamic_metadata=*/false, /*realm=*/"", "stats",
                                              *stats_.rootScope());
     filter_ = std::make_shared<BasicAuthFilter>(config_);
     filter_->setDecoderFilterCallbacks(decoder_filter_callbacks_);
@@ -62,9 +62,9 @@ TEST_F(FilterTest, BasicAuth) {
 TEST_F(FilterTest, BasicAuthSetsDynamicMetadataOnSuccessWhenEnabled) {
   UserMap users;
   users.insert({"user1", {"user1", "tESsBmE/yNY3lb6a0L6vVQEZNqw="}}); // user1:test1
-  FilterConfigConstSharedPtr config =
-      std::make_unique<FilterConfig>(std::move(users), "x-username", "", /*allow_missing=*/false,
-                                     /*emit_dynamic_metadata=*/true, "stats", *stats_.rootScope());
+  FilterConfigConstSharedPtr config = std::make_unique<FilterConfig>(
+      std::move(users), "x-username", "", /*allow_missing=*/false,
+      /*emit_dynamic_metadata=*/true, /*realm=*/"", "stats", *stats_.rootScope());
   std::shared_ptr<BasicAuthFilter> filter = std::make_shared<BasicAuthFilter>(config);
   filter->setDecoderFilterCallbacks(decoder_filter_callbacks_);
 
@@ -264,7 +264,7 @@ TEST_F(FilterTest, BasicAuthPerRouteDefaultSettings) {
   EXPECT_CALL(decoder_filter_callbacks_, requestHeaders())
       .WillOnce(testing::Return(makeOptRef(empty_request_headers)));
   UserMap empty_users;
-  FilterConfigPerRoute basic_auth_per_route(std::move(empty_users));
+  FilterConfigPerRoute basic_auth_per_route(std::move(empty_users), "");
 
   ON_CALL(*decoder_filter_callbacks_.route_, mostSpecificPerFilterConfig(_))
       .WillByDefault(testing::Return(&basic_auth_per_route));
@@ -294,7 +294,7 @@ TEST_F(FilterTest, BasicAuthPerRouteDefaultSettings) {
 TEST_F(FilterTest, BasicAuthPerRouteEnabled) {
   UserMap users_for_route;
   users_for_route.insert({"admin", {"admin", "0DPiKuNIrrVmD8IUCuw1hQxNqZc="}}); // admin:admin
-  FilterConfigPerRoute basic_auth_per_route(std::move(users_for_route));
+  FilterConfigPerRoute basic_auth_per_route(std::move(users_for_route), "");
 
   ON_CALL(*decoder_filter_callbacks_.route_, mostSpecificPerFilterConfig(_))
       .WillByDefault(testing::Return(&basic_auth_per_route));
@@ -323,7 +323,7 @@ TEST_F(FilterTest, OverrideAuthorizationHeaderProvided) {
 
   FilterConfigConstSharedPtr config = std::make_unique<FilterConfig>(
       std::move(users), "x-username", "x-authorization-override", /*allow_missing=*/false,
-      /*emit_dynamic_metadata=*/false, "stats", *stats_.rootScope());
+      /*emit_dynamic_metadata=*/false, /*realm=*/"", "stats", *stats_.rootScope());
   std::shared_ptr<BasicAuthFilter> filter = std::make_shared<BasicAuthFilter>(config);
   filter->setDecoderFilterCallbacks(decoder_filter_callbacks_);
 
@@ -338,6 +338,160 @@ TEST_F(FilterTest, OverrideAuthorizationHeaderProvided) {
   EXPECT_EQ("user1", request_headers_user1.get_("x-username"));
 }
 
+TEST_F(FilterTest, FixedRealmUsedInWWWAuthenticate) {
+  UserMap users;
+  users.insert({"user1", {"user1", "tESsBmE/yNY3lb6a0L6vVQEZNqw="}});
+  FilterConfigConstSharedPtr config = std::make_unique<FilterConfig>(
+      std::move(users), "", "", /*allow_missing=*/false, /*emit_dynamic_metadata=*/false,
+      /*realm=*/"myapp", "stats", *stats_.rootScope());
+  std::shared_ptr<BasicAuthFilter> filter = std::make_shared<BasicAuthFilter>(config);
+  filter->setDecoderFilterCallbacks(decoder_filter_callbacks_);
+
+  // Bad credentials to trigger onDenied.
+  Http::TestRequestHeaderMapImpl request_headers{{"Authorization", "Basic dXNlcjE6d3Jvbmc="}};
+  request_headers.setScheme("http");
+  request_headers.setHost("host");
+  request_headers.setPath("/some/deep/path");
+  EXPECT_CALL(decoder_filter_callbacks_, requestHeaders()).Times(0);
+
+  EXPECT_CALL(decoder_filter_callbacks_, sendLocalReply(_, _, _, _, _))
+      .WillOnce(Invoke([&](Http::Code code, absl::string_view,
+                           std::function<void(Http::ResponseHeaderMap & headers)> modify_headers,
+                           const std::optional<Grpc::Status::GrpcStatus>, absl::string_view) {
+        EXPECT_EQ(Http::Code::Unauthorized, code);
+        Http::TestResponseHeaderMapImpl response_headers{{":status", "401"}};
+        modify_headers(response_headers);
+        EXPECT_EQ(
+            "Basic realm=\"myapp\"",
+            response_headers.get(Http::Headers::get().WWWAuthenticate)[0]->value().getStringView());
+      }));
+  EXPECT_EQ(Http::FilterHeadersStatus::StopIteration, filter->decodeHeaders(request_headers, true));
+}
+
+TEST_F(FilterTest, EmptyRealmFallsBackToUri) {
+  // realm="" (default) →
```

---

### Incident Patch 6: `bd7991fb` (2026-10-04)
**Commit Message**: reverse_tunnel: run the data path integration suite in CI (#47995)

## Description

This PR runs the reverse connection cluster data path integration suite
in CI and makes it hermetic. It removes the manual tag, reserves free
loopback ports instead of a fixed range, asserts every status and the
response body, adds an egress retry policy, and fixes the HTTP/1 control
cluster ALPN and a stale comment.

---

**Commit Message:** reverse_tunnel: run the data path integration suite
in CI
**Risk Level**: Low
**Testing:** CI
**Docs Changes**: N/A
**Release Notes**: N/A

Signed-off-by: Rohit Agrawal <[REDACTED_EMAIL]>

**File**: `test/extensions/clusters/reverse_connection/BUILD` (modified, +1/-2)
```diff
@@ -54,8 +54,6 @@ envoy_extension_cc_test(
         "envoy.transport_sockets.tls",
     ],
     rbe_pool = "linux_x64_small",
-    # TODO(agrawroh): Temporarily disabled due to flakiness. Re-enable after stabilizing.
-    tags = ["manual"],
     deps = [
         "//source/common/protobuf:utility_lib",
         "//source/extensions/bootstrap/reverse_tunnel/downstream_socket_interface:reverse_connection_resolver_lib",
@@ -71,6 +69,7 @@ envoy_extension_cc_test(
         "//test/integration:integration_lib",
         "//test/test_common:environment_lib",
         "//test/test_common:logging_lib",
+        "//test/test_common:network_utility_lib",
         "//test/test_common:utility_lib",
         "@envoy_api//envoy/config/bootstrap/v3:pkg_cc_proto",
         "@envoy_api//envoy/extensions/clusters/reverse_connection/v3:pkg_cc_proto",
```

**File**: `test/extensions/clusters/reverse_connection/reverse_connection_cluster_integration_test.cc` (modified, +73/-42)
```diff
@@ -14,6 +14,7 @@
 #include "test/integration/utility.h"
 #include "test/test_common/environment.h"
 #include "test/test_common/logging.h"
+#include "test/test_common/network_utility.h"
 #include "test/test_common/utility.h"
 
 #include "gtest/gtest.h"
@@ -62,8 +63,21 @@ name: envoy.bootstrap.reverse_tunnel.downstream_socket_interface
 protected:
   LogLevelSetter log_level_setter_ = LogLevelSetter(spdlog::level::debug);
 
-  uint32_t tunnelListenerPort() const {
-    return GetParam() == Network::Address::IpVersion::v4 ? 15000 : 15001;
+  // Loopback ports reserved for reverse tunnel listeners, held open for the test lifetime.
+  std::vector<Network::SocketPtr> reserved_tunnel_sockets_;
+
+  // Reserve a free loopback port and hold the bound socket for the test lifetime. The responder
+  // tunnel listener and the initiator's static tunnel_cluster share this port, and the reservation
+  // keeps the OS from handing it to another test running in parallel. The socket is bound with
+  // SO_REUSEPORT and never listens, so the real listener binds the same port and the reservation
+  // never receives a connection.
+  uint32_t reserveTunnelListenerPort() {
+    auto addr_and_socket =
+        Network::Test::bindFreeLoopbackPort(version_, Network::Socket::Type::Stream,
+                                            /*reuse_port=*/true);
+    const uint32_t port = addr_and_socket.first->ip()->port();
+    reserved_tunnel_sockets_.push_back(std::move(addr_and_socket.second));
+    return port;
   }
 
   std::string loopbackAddress() const {
@@ -187,6 +201,12 @@ name: envoy.bootstrap.reverse_tunnel.downstream_socket_interface
     egress_route->mutable_match()->set_prefix("/");
     egress_route->mutable_route()->set_cluster("reverse_connection_cluster");
 
+    // Retry transient reverse tunnel checkout failures so data requests are deterministic while a
+    // freshly reconnected tunnel is still being registered.
+    auto* retry_policy = egress_route->mutable_route()->mutable_retry_policy();
+    retry_policy->set_retry_on("5xx,reset,connect-failure,refused-stream");
+    retry_policy->mutable_num_retries()->set_value(3);
+
     // Add Lua filter to compute x-computed-host-id from request headers.
     if (add_lua_host_id_filter) {
       auto* lua_filter = egress_hcm.add_http_filters();
@@ -327,7 +347,7 @@ INSTANTIATE_TEST_SUITE_P(IpVersions, ReverseConnectionClusterIntegrationTest,
 TEST_P(ReverseConnectionClusterIntegrationTest, EndToEndReverseTunnelTest) {
   DISABLE_IF_ADMIN_DISABLED; // Test requires admin interface for cleanup.
 
-  const uint32_t tunnel_listener_port = tunnelListenerPort();
+  const uint32_t tunnel_listener_port = reserveTunnelListenerPort();
   const std::string loopback_addr = loopbackAddress();
 
   // Configure the full reverse tunnel flow with cluster using helper.
@@ -389,13 +409,15 @@ TEST_P(ReverseConnectionClusterIntegrationTest, EndToEndReverseTunnelTest) {
   EXPECT_EQ(upstream_request_->headers().getPathValue(), "/test/long/url");
   EXPECT_EQ(upstream_request_->headers().getMethodValue(), "GET");
 
-  // Send response back through the tunnel.
-  upstream_request_->encodeHeaders(default_response_headers_, true);
+  // Send a response with a body back through the tunnel.
+  upstream_request_->encodeHeaders(default_response_headers_, false);
+  upstream_request_->encodeData("reverse-tunnel-body", true);
 
-  // Verify the response made it back to the client.
+  // Verify the response and its body made it back to the client over the HTTP/2 tunnel.
   ASSERT_TRUE(response->waitForEndStream());
   EXPECT_TRUE(response->complete());
   EXPECT_EQ("200", response->headers().getStatusValue());
+  EXPECT_EQ("reverse-tunnel-body", response->body());
 
   ENVOY_LOG_MISC(info, "End-to-end request/response through reverse tunnel successful.");
 
@@ -528,7 +550,7 @@ TEST_P(ReverseConnectionClusterIntegrationTest, EndToEndReverseTunnelTest) {
 TEST_P(ReverseConnectionClusterIntegrationTest, EndToEndReverseTunnelTestWithMutualTLS) {
   DISABLE_IF_ADMIN_DISABLED; // Test requires admin interface for cleanup.
 
-  const uint32_t tunnel_listener_port = tunnelListenerPort();
+  const uint32_t tunnel_listener_port = reserveTunnelListenerPort();
   const std::string loopback_addr = loopbackAddress();
 
   const std::string rundir = TestEnvironment::runfilesDirectory();
@@ -560,7 +582,7 @@ TEST_P(ReverseConnectionClusterIntegrationTest, EndToEndReverseTunnelTestWithMut
           ->mutable_trusted_ca()
           ->set_filename(rundir + "/test/config/integration/certs/cacert.pem");
 
-      tls_context.mutable_common_tls_context()->add_alpn_protocols("h2");
+      tls_context.mutable_common_tls_context()->add_alpn_protocols("http/1.1");
 
       std::ignore = transport_socket->mutable_typed_config()->PackFrom(tls_context);
     };
@@ -585,7 +607,7 @@ TEST_P(ReverseConnectionClusterIntegrationTest, EndToEndReverseTunnelTestWithMut
           ->mutable_trusted_ca()
           ->set_filename(rundir + "/
```

---

### Incident Patch 7: `57f7346d` (2026-10-03)
**Commit Message**: cpu_utilization: gracefully handle cgroup v2 CPU detection in CONTAINER mode (#47485)

Commit Message:
cpu_utilization: fix CONTAINER mode in the host cgroup namespace

In CONTAINER mode the cpu_utilization resource monitor read the cgroup
v2 files
straight from /sys/fs/cgroup, assuming it is the process's own cgroup,
and
required cpu.stat, cpu.max and cpuset.cpus.effective to all exist. When
Envoy
shares the host cgroup namespace, as privileged containers do,
/sys/fs/cgroup is
the cgroup v2 root: its cpu.stat covers the whole machine and it has no
cpu.max.
Detection failed and config initialization aborted the server.

Resolve the process's own cgroup from /proc/self/cgroup and
/proc/self/mountinfo,
reusing the parsing in CgroupCpuUtil, before probing the cgroup v2
files, so the
monitor reports container rather than host usage. Key cgroup v2
detection on
cpu.stat. An absent cpu.max means no CPU limit and an absent
cpuset.cpus.effective falls back to the CPU affinity count, while a file
that
exists but cannot be read fails the sample. When no supported cgroup CPU
implementation is found, config initialization still fails as before.
HOST mode
is unchanged.

Additional Description:
M

**File**: `changelogs/current/bug_fixes/cpu_utilization__cgroup-v2-graceful-detection.rst` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+Fixed the ``envoy.resource_monitors.cpu_utilization`` monitor in ``CONTAINER`` mode when Envoy shares
+the host cgroup namespace, for example in a privileged container. ``/sys/fs/cgroup`` is then the
+cgroup v2 root, which has no ``cpu.max``, so detection failed and config initialization aborted
+the server. The monitor now resolves its own cgroup from ``/proc/self/cgroup`` and
+``/proc/self/mountinfo`` and reports container rather than host usage. cgroup v2 detection is keyed
+on ``cpu.stat``: an absent ``cpu.max`` means no CPU limit and an absent ``cpuset.cpus.effective``
+falls back to the CPU affinity count, while a file that exists but cannot be read fails the sample.
```

**File**: `source/extensions/resource_monitors/cpu_utilization/BUILD` (modified, +2/-0)
```diff
@@ -51,6 +51,8 @@ envoy_cc_library(
         "//source/common/common:assert_lib",
         "//source/common/common:logger_lib",
         "//source/common/common:thread_lib",
+        "//source/server:cgroup_cpu_util_lib",
+        "//source/server:options_base",
         "@abseil-cpp//absl/strings",
         "@envoy_api//envoy/extensions/resource_monitors/cpu_utilization/v3:pkg_cc_proto",
     ],
```

**File**: `source/extensions/resource_monitors/cpu_utilization/cpu_paths.h` (modified, +16/-8)
```diff
@@ -5,6 +5,7 @@
 #include "envoy/filesystem/filesystem.h"
 
 #include "absl/strings/str_cat.h"
+#include "absl/strings/string_view.h"
 
 namespace Envoy {
 namespace Extensions {
@@ -39,15 +40,22 @@ struct CpuPaths {
   };
 
   struct V2 {
+    // Returns the cgroup v2 mount point, used when the process's own cgroup cannot be resolved.
+    static absl::string_view getBasePath() { return CGROUP_V2_BASE; }
+
     // Returns the full path to the CPU stat file (cpu.stat).
-    static std::string getStatPath() { return absl::StrCat(CGROUP_V2_BASE, STAT); }
+    static std::string getStatPath(absl::string_view base = CGROUP_V2_BASE) {
+      return absl::StrCat(base, STAT);
+    }
 
     // Returns the full path to the CPU max file (cpu.max).
-    static std::string getMaxPath() { return absl::StrCat(CGROUP_V2_BASE, MAX); }
+    static std::string getMaxPath(absl::string_view base = CGROUP_V2_BASE) {
+      return absl::StrCat(base, MAX);
+    }
 
     // Returns the full path to the effective CPUs file (cpuset.cpus.effective).
-    static std::string getEffectiveCpusPath() {
-      return absl::StrCat(CGROUP_V2_BASE, EFFECTIVE_CPUS);
+    static std::string getEffectiveCpusPath(absl::string_view base = CGROUP_V2_BASE) {
+      return absl::StrCat(base, EFFECTIVE_CPUS);
     }
 
   private:
@@ -57,10 +65,10 @@ struct CpuPaths {
     static constexpr const char* const EFFECTIVE_CPUS = "/cpuset.cpus.effective";
   };
 
-  // Returns whether cgroup v2 CPU subsystem is available.
-  static bool isV2(Filesystem::Instance& fs) {
-    return fs.fileExists(V2::getStatPath()) && fs.fileExists(V2::getMaxPath()) &&
-           fs.fileExists(V2::getEffectiveCpusPath());
+  // Keyed only on cpu.stat: cpu.max and cpuset.cpus.effective are optional (often
+  // absent on Kubernetes v2 pods) and handled with fallbacks by the reader.
+  static bool isV2(Filesystem::Instance& fs, absl::string_view base = V2::getBasePath()) {
+    return fs.fileExists(V2::getStatPath(base));
   }
 
   // Returns whether cgroup v1 CPU subsystem is available.
```

**File**: `source/extensions/resource_monitors/cpu_utilization/linux_cpu_stats_reader.cc` (modified, +99/-26)
```diff
@@ -1,8 +1,11 @@
 #include "source/extensions/resource_monitors/cpu_utilization/linux_cpu_stats_reader.h"
 
 #include <algorithm>
+#include <cerrno>
 #include <chrono>
+#include <optional>
 #include <sstream>
+#include <thread>
 #include <vector>
 
 #include "envoy/common/exception.h"
@@ -11,9 +14,16 @@
 #include "source/common/common/assert.h"
 #include "source/common/common/fmt.h"
 #include "source/common/common/thread.h"
+#include "source/server/cgroup_cpu_util.h"
+
+#ifdef __linux__
+#include "source/server/options_impl_platform_linux.h"
+#endif
 
 #include "absl/strings/numbers.h"
+#include "absl/strings/str_cat.h"
 #include "absl/strings/str_split.h"
+#include "absl/strings/string_view.h"
 #include "absl/strings/strip.h"
 
 namespace Envoy {
@@ -26,6 +36,37 @@ constexpr uint64_t NUMBER_OF_CPU_TIMES_TO_PARSE =
 
 namespace {
 
+// Fallback CPU count when cpuset.cpus.effective is absent. Honors the affinity mask
+// and floors at 1 to avoid divide-by-zero in downstream utilization math.
+int defaultCpuCount() {
+  const unsigned int hw_threads = std::max(1u, std::thread::hardware_concurrency());
+#ifdef __linux__
+  return static_cast<int>(OptionsImplPlatformLinux::getCpuAffinityCount(hw_threads));
+#else
+  return static_cast<int>(hw_threads);
+#endif
+}
+
+// Reads an optional cgroup interface file. std::nullopt means the file does not
+// exist; any other failure is an error, so that a permission problem is not
+// mistaken for an absent controller.
+absl::StatusOr<std::optional<std::string>> readOptionalFile(Filesystem::Instance& fs,
+                                                            const std::string& path) {
+  const Api::IoCallResult<Filesystem::FileInfo> info = fs.stat(path);
+  if (!info.ok()) {
+    if (info.err_->getSystemErrorCode() == ENOENT) {
+      return std::optional<std::string>();
+    }
+    return absl::UnavailableError(
+        absl::StrCat("unable to stat ", path, ": ", info.err_->getErrorDetails()));
+  }
+  absl::StatusOr<std::string> contents = fs.fileReadToEnd(path);
+  if (!contents.ok()) {
+    return contents.status();
+  }
+  return std::optional<std::string>(std::move(contents).value());
+}
+
 absl::StatusOr<int> parseEffectiveCpus(absl::string_view effective_cpu_list,
                                        const std::string& effective_path) {
   int cpu_count = 0;
@@ -165,6 +206,18 @@ absl::StatusOr<double> LinuxCpuStatsReader::getUtilization() {
 
 absl::StatusOr<LinuxContainerCpuStatsReader::ContainerStatsReaderPtr>
 LinuxContainerCpuStatsReader::create(Filesystem::Instance& fs, TimeSource& time_source) {
+  // Prefer the process's own cgroup: in the host cgroup namespace the mount point is
+  // the cgroup root, which reports whole-machine usage and has no cpu.max.
+  const std::optional<CgroupInfo> cgroup = CgroupCpuUtil::getCurrentCgroupInfo(fs);
+  if (cgroup.has_value() && cgroup->version == "v2") {
+    const std::string base(absl::StripSuffix(cgroup->full_path, "/"));
+    if (CpuPaths::isV2(fs, base)) {
+      return std::make_unique<CgroupV2CpuStatsReader>(fs, time_source, base);
+    }
+    ENVOY_LOG_MISC(debug, "No cpu.stat in cgroup {}, falling back to {}", base,
+                   CpuPaths::V2::getBasePath());
+  }
+
   if (CpuPaths::isV2(fs)) {
     return std::make_unique<CgroupV2CpuStatsReader>(fs, time_source);
   }
@@ -261,9 +314,14 @@ absl::StatusOr<double> CgroupV1CpuStatsReader::getUtilization() {
 }
 
 CgroupV2CpuStatsReader::CgroupV2CpuStatsReader(Filesystem::Instance& fs, TimeSource& time_source)
-    : LinuxContainerCpuStatsReader(fs, time_source), stat_path_(CpuPaths::V2::getStatPath()),
-      max_path_(CpuPaths::V2::getMaxPath()), effective_path_(CpuPaths::V2::getEffectiveCpusPath()) {
-}
+    : CgroupV2CpuStatsReader(fs, time_source, CpuPaths::V2::getBasePath()) {}
+
+CgroupV2CpuStatsReader::CgroupV2CpuStatsReader(Filesystem::Instance& fs, TimeSource& time_source,
+                                               absl::string_view base_path)
+    : LinuxContainerCpuStatsReader(fs, time_source),
+      stat_path_(CpuPaths::V2::getStatPath(base_path)),
+      max_path_(CpuPaths::V2::getMaxPath(base_path)),
+      effective_path_(CpuPaths::V2::getEffectiveCpusPath(base_path)) {}
 
 CgroupV2CpuStatsReader::CgroupV2CpuStatsReader(Filesystem::Instance& fs, TimeSource& time_source,
                                                const std::string& stat_path,
@@ -306,35 +364,50 @@ CpuTimesV2 CgroupV2CpuStatsReader::getCpuTimes() {
     return {false, 0, 0, 0};
   }
 
-  // Read cpuset.cpus.effective
-  auto effective_result = fs_.fileReadToEnd(effective_path_);
+  // CPU count from cpuset.cpus.effective, falling back to the affinity CPU count
+  // when absent. If present it must be readable and well-formed.
+  // Format can be: "0", "0-3", "0,2,4", "0-2,4", "0-3,5-7", etc.
+  int N = 0;
+  const absl::StatusOr<std::optional<std::string>> effective_result =
+      readOptionalFile(fs_, effective_path_);
   if (!effective_result.ok()) {

```

**File**: `source/extensions/resource_monitors/cpu_utilization/linux_cpu_stats_reader.h` (modified, +4/-0)
```diff
@@ -98,6 +98,10 @@ class CgroupV2CpuStatsReader : public LinuxContainerCpuStatsReader,
 public:
   explicit CgroupV2CpuStatsReader(Filesystem::Instance& fs, TimeSource& time_source);
 
+  // Reads the interface files of a specific cgroup directory.
+  CgroupV2CpuStatsReader(Filesystem::Instance& fs, TimeSource& time_source,
+                         absl::string_view base_path);
+
   // Test-friendly constructor that accepts custom file paths
   CgroupV2CpuStatsReader(Filesystem::Instance& fs, TimeSource& time_source,
                          const std::string& stat_path, const std::string& max_path,
```

**File**: `source/server/cgroup_cpu_util.cc` (modified, +8/-0)
```diff
@@ -225,6 +225,14 @@ std::optional<CgroupPathInfo> CgroupCpuUtil::getCurrentCgroupPath(Filesystem::In
   return CgroupPathInfo{v2_path, "v2"};
 }
 
+std::optional<CgroupInfo> CgroupCpuUtil::getCurrentCgroupInfo(Filesystem::Instance& fs) {
+  const std::optional<CgroupMount> mount = discoverCgroupMount(fs);
+  if (!mount.has_value()) {
+    return std::nullopt;
+  }
+  return constructCgroupPath(*mount, fs);
+}
+
 // Constructs complete cgroup path by combining mount metadata and process assignment.
 std::optional<CgroupInfo> CgroupCpuUtil::constructCgroupPath(const CgroupMount& mount,
                                                              Filesystem::Instance& fs) {
```

**File**: `source/server/cgroup_cpu_util.h` (modified, +9/-0)
```diff
@@ -117,6 +117,15 @@ class CgroupCpuUtil {
   static std::optional<uint32_t> getCpuLimit(Filesystem::Instance& fs,
                                              CgroupDetectionDiagnostic* diag = nullptr);
 
+  /**
+   * Resolves the calling process's own `cgroup` directory by combining the `cgroup` mount from
+   * `/proc/self/mountinfo` with the path from `/proc/self/cgroup`. The mount point alone is the
+   * `cgroup` root when the process shares the host `cgroup` namespace.
+   * @param fs Filesystem instance for file operations.
+   * @return CgroupInfo with the directory and version, nullopt if it cannot be determined.
+   */
+  static std::optional<CgroupInfo> getCurrentCgroupInfo(Filesystem::Instance& fs);
+
 private:
   /**
    * Reads CPU limit from specific `cgroup` `v1` paths.
```

**File**: `test/extensions/resource_monitors/cpu_utilization/BUILD` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ envoy_extension_cc_test(
         "//test/mocks/server:options_mocks",
         "//test/test_common:environment_lib",
         "//test/test_common:status_utility_lib",
+        "@abseil-cpp//absl/status",
+        "@abseil-cpp//absl/strings",
     ],
 )
 
```

---

### Incident Patch 8: `e07c881a` (2026-10-02)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif from 4.36.3 to 4.38.2 (#47973)


Signed-off-by: dependabot[bot] <shttps://github.com/envoyproxy/envoy-ci-staging/actions/runs/37017813902/job/[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -41,6 +41,6 @@ jobs:
         retention-days: 5
 
     - name: "Upload to code-scanning"
-      uses: github/codeql-action/upload-sarif@54f647b7e1bb85c95cddabcd46b0c578ec92bc1a  # v4.36.3
+      uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2  # v4.38.2
       with:
         sarif_file: results.sarif
```

---

### Incident Patch 9: `95b9fb06` (2026-10-02)
**Commit Message**: build(deps): bump urllib3 from 2.7.0 to 2.8.0 in /docs/tools/python in the pip group across 1 directory (#47971)


Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `bazel/tests/external/MODULE.bazel.lock` (modified, +2/-0)
```diff
@@ -5911,7 +5911,9 @@
           "urllib3": {
             "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz": "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c",
             "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl": "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897",
+            "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl": "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3",
             "https://files.pythonhosted.org/packages/ce/d9/5f4c13cecde62396b0d3fe530a50ccea91e7dfc1ccf0e09c228841bb5ba8/urllib3-2.2.3-py3-none-any.whl": "sha256:ca899ca043dcb1bafa3e262d73aa25c465bfb49e0bd9dd5d59f1d0acba2f8fac",
+            "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz": "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63",
             "https://files.pythonhosted.org/packages/ed/63/22ba4ebfe7430b76388e7cd448d5478814d3032121827c12a2cc287e2260/urllib3-2.2.3.tar.gz": "sha256:e7d814a81dad81e6caf2ec9fdedb284ecc9c73076b62654547cc64ccdcae26e9"
           },
           "uvloop": {
```

**File**: `docs/MODULE.bazel.lock` (modified, +2/-0)
```diff
@@ -5911,7 +5911,9 @@
           "urllib3": {
             "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz": "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c",
             "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl": "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897",
+            "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl": "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3",
             "https://files.pythonhosted.org/packages/ce/d9/5f4c13cecde62396b0d3fe530a50ccea91e7dfc1ccf0e09c228841bb5ba8/urllib3-2.2.3-py3-none-any.whl": "sha256:ca899ca043dcb1bafa3e262d73aa25c465bfb49e0bd9dd5d59f1d0acba2f8fac",
+            "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz": "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63",
             "https://files.pythonhosted.org/packages/ed/63/22ba4ebfe7430b76388e7cd448d5478814d3032121827c12a2cc287e2260/urllib3-2.2.3.tar.gz": "sha256:e7d814a81dad81e6caf2ec9fdedb284ecc9c73076b62654547cc64ccdcae26e9"
           },
           "uvloop": {
```

**File**: `docs/tools/python/requirements.txt` (modified, +3/-3)
```diff
@@ -1600,9 +1600,9 @@ uritemplate==4.2.0 \
     --hash=sha256:480c2ed180878955863323eea31b0ede668795de182617fef9c6ca09e6ec9d0e \
     --hash=sha256:962201ba1c4edcab02e60f9a0d3821e82dfc5d2d6662a21abd533879bdb8a686
     # via gidgethub
-urllib3==2.7.0 \
-    --hash=sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c \
-    --hash=sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897
+urllib3==2.8.0 \
+    --hash=sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3 \
+    --hash=sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63
     # via requests
 uvloop==0.20.0 \
     --hash=sha256:265a99a2ff41a0fd56c19c3838b29bf54d1d177964c300dad388b27e84fd7847 \
```

---

### Incident Patch 10: `fc6d2f4d` (2026-10-02)
**Commit Message**: build(deps): bump pyjwt from 2.13.0 to 2.15.1 in /tools/base (#47965)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -5078,8 +5078,8 @@
             "https://files.pythonhosted.org/packages/f4/7e/a72dd26f3b0f4f2bf1dd8923c85f7ceb43172af56d63c7383eb62b332364/pygments-2.20.0-py3-none-any.whl": "sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176"
           },
           "pyjwt": {
-            "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
-            "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
+            "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193"
           },
           "pylsqpack": {
             "https://files.pythonhosted.org/packages/04/30/dc13ed88ad762d9fbb8351064a4c1e137a2574155deb6f88e8ca9c90cf5e/pylsqpack-0.3.18-cp38-abi3-macosx_10_9_x86_64.whl": "sha256:1f415d2e03c779261ac7ed421a009a4c752eef6f1ef7b5a34c4a463a5e17fbad",
```

**File**: `bazel/tests/codeql/MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -4996,8 +4996,8 @@
             "https://files.pythonhosted.org/packages/f4/7e/a72dd26f3b0f4f2bf1dd8923c85f7ceb43172af56d63c7383eb62b332364/pygments-2.20.0-py3-none-any.whl": "sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176"
           },
           "pyjwt": {
-            "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
-            "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
+            "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193"
           },
           "pylsqpack": {
             "https://files.pythonhosted.org/packages/04/30/dc13ed88ad762d9fbb8351064a4c1e137a2574155deb6f88e8ca9c90cf5e/pylsqpack-0.3.18-cp38-abi3-macosx_10_9_x86_64.whl": "sha256:1f415d2e03c779261ac7ed421a009a4c752eef6f1ef7b5a34c4a463a5e17fbad",
```

**File**: `bazel/tests/external/MODULE.bazel.lock` (modified, +1/-3)
```diff
@@ -5567,10 +5567,8 @@
             "https://files.pythonhosted.org/packages/f4/7e/a72dd26f3b0f4f2bf1dd8923c85f7ceb43172af56d63c7383eb62b332364/pygments-2.20.0-py3-none-any.whl": "sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176"
           },
           "pyjwt": {
-            "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
             "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
-            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193",
-            "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193"
           },
           "pylsqpack": {
             "https://files.pythonhosted.org/packages/04/30/dc13ed88ad762d9fbb8351064a4c1e137a2574155deb6f88e8ca9c90cf5e/pylsqpack-0.3.18-cp38-abi3-macosx_10_9_x86_64.whl": "sha256:1f415d2e03c779261ac7ed421a009a4c752eef6f1ef7b5a34c4a463a5e17fbad",
```

**File**: `docs/MODULE.bazel.lock` (modified, +1/-3)
```diff
@@ -5567,10 +5567,8 @@
             "https://files.pythonhosted.org/packages/f4/7e/a72dd26f3b0f4f2bf1dd8923c85f7ceb43172af56d63c7383eb62b332364/pygments-2.20.0-py3-none-any.whl": "sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176"
           },
           "pyjwt": {
-            "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
             "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
-            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193",
-            "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193"
           },
           "pylsqpack": {
             "https://files.pythonhosted.org/packages/04/30/dc13ed88ad762d9fbb8351064a4c1e137a2574155deb6f88e8ca9c90cf5e/pylsqpack-0.3.18-cp38-abi3-macosx_10_9_x86_64.whl": "sha256:1f415d2e03c779261ac7ed421a009a4c752eef6f1ef7b5a34c4a463a5e17fbad",
```

**File**: `mobile/MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -5511,8 +5511,8 @@
             "https://files.pythonhosted.org/packages/f4/7e/a72dd26f3b0f4f2bf1dd8923c85f7ceb43172af56d63c7383eb62b332364/pygments-2.20.0-py3-none-any.whl": "sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176"
           },
           "pyjwt": {
-            "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
-            "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
+            "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193"
           },
           "pylsqpack": {
             "https://files.pythonhosted.org/packages/04/30/dc13ed88ad762d9fbb8351064a4c1e137a2574155deb6f88e8ca9c90cf5e/pylsqpack-0.3.18-cp38-abi3-macosx_10_9_x86_64.whl": "sha256:1f415d2e03c779261ac7ed421a009a4c752eef6f1ef7b5a34c4a463a5e17fbad",
```

**File**: `tools/base/requirements.in` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ pep8-naming
 protobuf<7.36.0
 ply
 pygithub
-pyjwt[crypto]>=2.13.0
+pyjwt[crypto]>=2.15.1
 cryptography>49.0.0
 pyopenssl>=26.3.0
 pyyaml
```

**File**: `tools/base/requirements.txt` (modified, +3/-3)
```diff
@@ -1190,9 +1190,9 @@ pygithub==2.10.0 \
     --hash=sha256:192ada2a76e4afc7d6b37e500c9bfeba1731e6506697445a5ba1c4af8bf0b924 \
     --hash=sha256:90ff24ef1cd1bd57124c2a3869cafee9d7b066909129ecdaba2c2d1903bc118d
     # via -r requirements.in
-pyjwt[crypto]==2.13.0 \
-    --hash=sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423 \
-    --hash=sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728
+pyjwt[crypto]==2.15.1 \
+    --hash=sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193 \
+    --hash=sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8
     # via
     #   -r requirements.in
     #   gidgethub
```

---

### Incident Patch 11: `ed8850c3` (2026-10-02)
**Commit Message**: build(deps): bump pyjwt from 2.13.0 to 2.15.1 in /docs/tools/python (#47966)


Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `bazel/tests/external/MODULE.bazel.lock` (modified, +2/-0)
```diff
@@ -5568,6 +5568,8 @@
           },
           "pyjwt": {
             "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
+            "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193",
             "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
           },
           "pylsqpack": {
```

**File**: `docs/MODULE.bazel.lock` (modified, +2/-0)
```diff
@@ -5568,6 +5568,8 @@
           },
           "pyjwt": {
             "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz": "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423",
+            "https://files.pythonhosted.org/packages/43/ea/5194e52748b0da83d71e082d75496eaec6e58f419f5e184786ded517e6a9/pyjwt-2.15.1.tar.gz": "sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8",
+            "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl": "sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193",
             "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl": "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"
           },
           "pylsqpack": {
```

**File**: `docs/tools/python/requirements.in` (modified, +1/-1)
```diff
@@ -16,6 +16,6 @@ envoy.code.check>=0.6.7
 frozendict>=2.3.7
 jinja2
 packaging
-pyjwt[crypto]==2.13.0
+pyjwt[crypto]==2.15.1
 cryptography==50.0.0
 pyyaml
```

**File**: `docs/tools/python/requirements.txt` (modified, +3/-3)
```diff
@@ -1394,9 +1394,9 @@ pygments==2.20.0 \
     #   envoy-docs-sphinx-runner
     #   sphinx
     #   sphinx-tabs
-pyjwt[crypto]==2.13.0 \
-    --hash=sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423 \
-    --hash=sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728
+pyjwt[crypto]==2.15.1 \
+    --hash=sha256:42d59d631f7768a1028a64c7ff581a9bf7519804daf91fc5b6c56e30eec5e193 \
+    --hash=sha256:4f259e80cdfb6b3fc18a7de51fd1ef9ec79652f25019bae68975ca2468a34df8
     # via
     #   -r requirements.in
     #   gidgethub
```

---

### Incident Patch 12: `633e0d33` (2026-10-02)
**Commit Message**: Fix typo in --config=compile-time-options. (#47957)

I had previously misspelled the Protobuf experiment flag. Fixing
`PROTOBUF_ENABLE_CUSTOM_VTABLE` -> `PROTOBUF_ENABLE_CUSTOM_VTABLES`

Risk Level: Low

Signed-off-by: Clayton Knittel <[REDACTED_EMAIL]>

**File**: `.bazelrc` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ build:compile-time-options --@envoy//bazel:http3=False
 build:compile-time-options --@envoy//source/extensions/filters/http/kill_request:enabled
 # This is a Protobuf feature which breaks dynamic casting of messages. Turn it
 # on here to prevent raw dynamic_casts from being added to Envoy.
-build:compile-time-options --copt=-DPROTOBUF_ENABLE_CUSTOM_VTABLE=1
+build:compile-time-options --copt=-DPROTOBUF_ENABLE_CUSTOM_VTABLES=1
 
 
 #############################################################################
```

---

### Incident Patch 13: `eb32f1f9` (2026-10-02)
**Commit Message**: mcp: validate required client capabilities metadata (#47915)

Commit Message: mcp: validate required client capabilities metadata
Additional Description: For MCP 2026-07-28 requests, validate that
`params._meta` contains the required
`io.modelcontextprotocol/clientCapabilities` field.
Requests missing the field are rejected with HTTP 400 and JSON-RPC
`-32602` (`Invalid params`).
For `REJECT_NO_MCP` requests using `attribute_source: HEADERS`, the
filter
now parses the request body for 2026-07-28 requests so the required
`clientCapabilities` metadata can be checked.
This change only validates the presence of the required field. It does
not
perform per-operation client capability checks or return
`MissingRequiredClientCapabilityError` (`-32021`).
Legacy MCP behavior, pass-through mode, and JSON-RPC notifications are
unchanged.
Risk Level: low
Testing:
- BODY mode accepts an empty `clientCapabilities` object.
- BODY mode rejects requests missing `clientCapabilities` with HTTP 400
/
  JSON-RPC `-32602`.
- HEADERS mode parses the body and rejects requests missing
  `clientCapabilities`.
- HEADERS mode accepts requests with `clientCapabilities` present.
- JSON-RPC notifications do not req

**File**: `changelogs/current/new_features/mcp__require_client_capabilities.rst` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+Added validation to the :ref:`MCP filter <config_http_filters_mcp>` that MCP ``2026-07-28`` requests
+include ``io.modelcontextprotocol/clientCapabilities`` in ``params._meta`` when ``traffic_mode`` is
+``REJECT_NO_MCP``. Requests missing the field are rejected with HTTP 400 and JSON-RPC error
+``-32602``. Only JSON-RPC requests are checked; notifications are exempt. In this mode,
+``attribute_source: HEADERS`` now parses the request body for ``2026-07-28`` requests.
```

**File**: `source/extensions/filters/common/mcp/constants.h` (modified, +3/-0)
```diff
@@ -37,6 +37,7 @@ constexpr absl::string_view RESULT_TYPE_COMPLETE = "complete";
 constexpr absl::string_view ERROR_FIELD = "error";
 
 constexpr int MCP_HEADER_MISMATCH_ERROR_CODE = -32020;
+constexpr int JSONRPC_INVALID_PARAMS_ERROR_CODE = -32602;
 
 // MCP Initialize constants
 constexpr absl::string_view MCP_VERSION_2024_11_05 = "2024-11-05";
@@ -49,6 +50,8 @@ constexpr absl::string_view META_FIELD = "_meta";
 constexpr absl::string_view MCP_META_PROTOCOL_VERSION_FIELD =
     "io.modelcontextprotocol/protocolVersion";
 constexpr absl::string_view MCP_META_SERVER_INFO_FIELD = "io.modelcontextprotocol/serverInfo";
+constexpr absl::string_view MCP_META_CLIENT_CAPABILITIES_FIELD =
+    "io.modelcontextprotocol/clientCapabilities";
 constexpr absl::string_view CAPABILITIES_FIELD = "capabilities";
 constexpr absl::string_view TOOLS_FIELD = "tools";
 constexpr absl::string_view LIST_CHANGED_FIELD = "listChanged";
```

**File**: `source/extensions/filters/http/mcp/mcp_filter.cc` (modified, +34/-2)
```diff
@@ -380,7 +380,7 @@ bool McpFilter::canEarlyTerminate() {
          !config_->propagateBaggage().has_value();
 }
 
-bool McpFilter::needsBody() const {
+bool McpFilter::needsBody() {
   if (config_->attributeSource() != envoy::extensions::filters::http::mcp::v3::Mcp::HEADERS) {
     return true;
   }
@@ -392,6 +392,12 @@ bool McpFilter::needsBody() const {
     return true;
   }
 
+  // 2026-07-28 requests must carry params._meta fields that are only visible in
+  // the body, so REJECT_NO_MCP always parses it to enforce them.
+  if (use_new_spec_semantics_ && shouldRejectRequest()) {
+    return true;
+  }
+
   if (!hasCompleteHeaderAttributes()) {
     return true;
   }
@@ -741,6 +747,11 @@ void McpFilter::sendUnsupportedProtocolVersionReply(absl::string_view requested_
 }
 
 void McpFilter::sendHeaderMismatchReply(absl::string_view error_msg) {
+  sendJsonRpcErrorReply(Filters::Common::Mcp::McpConstants::MCP_HEADER_MISMATCH_ERROR_CODE,
+                        error_msg);
+}
+
+void McpFilter::sendJsonRpcErrorReply(int error_code, absl::string_view error_msg) {
   const auto status = Filters::Common::Mcp::Status::NotJsonRpc;
   recordErrorState(error_msg, status);
 
@@ -763,7 +774,7 @@ void McpFilter::sendHeaderMismatchReply(absl::string_view error_msg) {
 
   auto* error = (*reply.mutable_fields())["error"].mutable_struct_value();
 
-  (*error->mutable_fields())["code"].set_number_value(-32020);
+  (*error->mutable_fields())["code"].set_number_value(error_code);
   (*error->mutable_fields())["message"].set_string_value(error_msg);
 
   const std::string body = MessageUtil::getJsonStringFromMessageOrError(reply);
@@ -816,6 +827,19 @@ bool McpFilter::verifyHeaderAttributes() const {
   return headerAttributesMatch();
 }
 
+bool McpFilter::hasRequiredClientCapabilities() const {
+  if (!use_new_spec_semantics_ || parser_->isResponse() ||
+      parser_->getNestedValue(Filters::Common::Mcp::McpConstants::ID_FIELD) == nullptr) {
+    return true;
+  }
+
+  const Protobuf::Value* meta =
+      parser_->getNestedValue(Filters::Common::Mcp::McpConstants::Paths::PARAMS_META);
+  return meta != nullptr && meta->kind_case() == Protobuf::Value::kStructValue &&
+         meta->struct_value().fields().contains(
+             std::string(Filters::Common::Mcp::McpConstants::MCP_META_CLIENT_CAPABILITIES_FIELD));
+}
+
 McpFilter::ProtocolVersionValidationResult McpFilter::validateProtocolVersion() const {
   if (!use_new_spec_semantics_) {
     return ProtocolVersionValidationResult::Ok;
@@ -896,6 +920,14 @@ Http::FilterDataStatus McpFilter::completeParsing() {
     }
   }
 
+  if (shouldRejectRequest() && !hasRequiredClientCapabilities()) {
+    sendJsonRpcErrorReply(
+        Filters::Common::Mcp::McpConstants::JSONRPC_INVALID_PARAMS_ERROR_CODE,
+        absl::StrCat("Missing required params._meta field: ",
+                     Filters::Common::Mcp::McpConstants::MCP_META_CLIENT_CAPABILITIES_FIELD));
+    return Http::FilterDataStatus::StopIterationNoBuffer;
+  }
+
   if (config_->attributeSource() == envoy::extensions::filters::http::mcp::v3::Mcp::HEADERS &&
       hasCompleteHeaderAttributes() && !headerAttributesMatch()) {
     config_->stats().header_mismatch_.inc();
```

**File**: `source/extensions/filters/http/mcp/mcp_filter.h` (modified, +3/-1)
```diff
@@ -192,12 +192,14 @@ class McpFilter : public Http::PassThroughFilter, public Logger::Loggable<Logger
   void recordErrorState(absl::string_view error_msg, Filters::Common::Mcp::Status status);
   void sendErrorReply(absl::string_view error_msg, Filters::Common::Mcp::Status status);
   void sendUnsupportedProtocolVersionReply(absl::string_view requested_version);
+  void sendJsonRpcErrorReply(int error_code, absl::string_view error_msg);
   void sendHeaderMismatchReply(absl::string_view error_msg);
   void sendMethodNotAllowedReply(absl::string_view error_msg);
-  bool needsBody() const;
+  bool needsBody();
   bool hasCompleteHeaderAttributes() const;
   bool headerAttributesMatch() const;
   bool verifyHeaderAttributes() const;
+  bool hasRequiredClientCapabilities() const;
   enum class ProtocolVersionValidationResult {
     Ok,
     Missing,
```

**File**: `test/extensions/filters/http/mcp/mcp_filter_test.cc` (modified, +116/-0)
```diff
@@ -1011,6 +1011,122 @@ TEST_F(McpFilterTest, NonStringProtocolVersionMetaRejects) {
   EXPECT_EQ(1u, config_->stats().header_mismatch_.value());
 }
 
+constexpr absl::string_view kTasksGetWithEmptyClientCapabilities =
+    R"({"jsonrpc":"2.0","id":1,"method":"tasks/get","params":{"taskId":"task-123","_meta":{"io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}})";
+constexpr absl::string_view kTasksGetWithoutClientCapabilities =
+    R"({"jsonrpc":"2.0","id":1,"method":"tasks/get","params":{"taskId":"task-123","_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}})";
+
+class McpFilterClientCapabilitiesTest : public McpFilterTest {
+protected:
+  void setupNewSpecRejectMode(
+      envoy::extensions::filters::http::mcp::v3::Mcp::AttributeSource attribute_source) {
+    envoy::extensions::filters::http::mcp::v3::Mcp proto_config;
+    proto_config.set_traffic_mode(envoy::extensions::filters::http::mcp::v3::Mcp::REJECT_NO_MCP);
+    proto_config.set_attribute_source(attribute_source);
+    proto_config.mutable_max_supported_protocol_version()->set_value("2026-07-28");
+    config_ = std::make_shared<McpFilterConfig>(proto_config, "test.", factory_context_.scope());
+    filter_ = std::make_unique<McpFilter>(config_);
+    filter_->setDecoderFilterCallbacks(decoder_callbacks_);
+    filter_->setEncoderFilterCallbacks(encoder_callbacks_);
+  }
+
+  static Http::TestRequestHeaderMapImpl newSpecHeaders(absl::string_view method,
+                                                       absl::string_view name = "") {
+    Http::TestRequestHeaderMapImpl headers{{":method", "POST"},
+                                           {"content-type", "application/json"},
+                                           {"accept", "application/json"},
+                                           {"accept", "text/event-stream"},
+                                           {"mcp-protocol-version", "2026-07-28"},
+                                           {"mcp-method", std::string(method)}};
+    if (!name.empty()) {
+      headers.addCopy("mcp-name", std::string(name));
+    }
+    return headers;
+  }
+
+  void expectMissingClientCapabilitiesReply() {
+    EXPECT_CALL(decoder_callbacks_, sendLocalReply(Http::Code::BadRequest, _, _, _, _))
+        .WillOnce([](Http::Code, absl::string_view body,
+                     std::function<void(Http::ResponseHeaderMap&)> modify_headers,
+                     const std::optional<Grpc::Status::GrpcStatus>, absl::string_view) {
+          EXPECT_THAT(body, HasSubstr("\"jsonrpc\":\"2.0\""));
+          EXPECT_THAT(body, HasSubstr("\"code\":-32602"));
+          EXPECT_THAT(body, HasSubstr("io.modelcontextprotocol/clientCapabilities"));
+          EXPECT_THAT(body, HasSubstr("\"id\":1"));
+
+          Http::TestResponseHeaderMapImpl response_headers;
+          modify_headers(response_headers);
+          EXPECT_EQ(Http::Headers::get().ContentTypeValues.Json,
+                    response_headers.getContentTypeValue());
+        });
+  }
+};
+
+TEST_F(McpFilterClientCapabilitiesTest, BodyModeAcceptsEmptyClientCapabilities) {
+  setupNewSpecRejectMode(envoy::extensions::filters::http::mcp::v3::Mcp::BODY);
+  auto headers = newSpecHeaders("tasks/get", "task-123");
+
+  EXPECT_CALL(decoder_callbacks_, sendLocalReply(_, _, _, _, _)).Times(0);
+  EXPECT_EQ(Http::FilterHeadersStatus::StopIteration, filter_->decodeHeaders(headers, false));
+
+  Buffer::OwnedImpl buffer(kTasksGetWithEmptyClientCapabilities);
+  EXPECT_EQ(Http::FilterDataStatus::Continue, filter_->decodeData(buffer, true));
+}
+
+TEST_F(McpFilterClientCapabilitiesTest, BodyModeRejectsMissingClientCapabilities) {
+  setupNewSpecRejectMode(envoy::extensions::filters::http::mcp::v3::Mcp::BODY);
+  auto headers = newSpecHeaders("tasks/get", "task-123");
+
+  EXPECT_EQ(Http::FilterHeadersStatus::StopIteration, filter_->decodeHeaders(headers, false));
+
+  expectMissingClientCapabilitiesReply();
+  Buffer::OwnedImpl buffer(kTasksGetWithoutClientCapabilities);
+  EXPECT_EQ(Http::FilterDataStatus::StopIterationNoBuffer, filter_->decodeData(buffer, true));
+  EXPECT_EQ(0u, config_->stats().header_mismatch_.value());
+}
+
+TEST_F(McpFilterClientCapabilitiesTest, HeadersModeRejectsMissingClientCapabilities) {
+  setupNewSpecRejectMode(envoy::extensions::filters::http::mcp::v3::Mcp::HEADERS);
+  auto headers = newSpecHeaders("tasks/get", "task-123");
+
+  EXPECT_EQ(Http::FilterHeadersStatus::StopIteration, filter_->decodeHeaders(headers, false));
+
+  expectMissingClientCapabilitiesReply();
+  Buffer::OwnedImpl buffer(kTasksGetWithoutClientCapabilities);
+  EXPECT_EQ(Http::FilterDataStatus::StopIterationNoBuffer, filter_->decodeData(buffer, true));
+}
+
+TEST_F(McpFilterClientCapabilitiesTest, HeadersModeAcceptsClientCapabilities) {
+  setupNewSpecRejectMode(envoy::extensions::filters::http::mcp::v3::Mcp::HEADERS);
+  auto headers = newSpecHeaders("tasks/get", "task-123");
+
+  EXPECT_C
```

---

### Incident Patch 14: `fad12d5c` (2026-10-01)
**Commit Message**: aggregate: fix use-after-free in load balancer factory (#47480)

AggregateLoadBalancerFactory holds reference to `Cluster` and uses it in
create(). The factory is shared with every worker thread, and a worker
may run that callback after a CDS update has already replaced or removed
the cluster on the main thread. This happens most often at startup:
worker dispatchers are registered before startWorkers(), so cluster-add
callbacks queue up, and a CDS update that arrives before the workers
begin draining them destroys the Cluster while the factory still points
at it. The worker then reads freed memory and crashes in
create()/onClusterAddOrUpdate. This PR addresses the issue by
initialisating fields that is required during create with dependency on
the server lifecycle rather the cluster.

Fixes #35157

Risk Level: Low
Testing: New unit test destroys the Cluster before calling the factory.
Docs Changes: N/A
Release Notes: Added

Signed-off-by: Ronak Jain <[REDACTED_EMAIL]>

**File**: `changelogs/current/bug_fixes/aggregate_cluster__lb-factory-use-after-free.rst` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+Fixed a use-after-free crash in the :ref:`aggregate cluster <arch_overview_aggregate_cluster>`
+load balancer factory. The factory is shared with every worker thread but held a raw reference to
+its ``Cluster``, which a CDS update can destroy on the main thread before a worker runs its queued
+cluster-add callback and dereferences it, typically at startup. The factory now copies the state it
+needs to create the load balancer instead of referencing the ``Cluster``.
```

**File**: `source/extensions/clusters/aggregate/cluster.h` (modified, +10/-5)
```diff
@@ -146,16 +146,21 @@ class AggregateClusterLoadBalancer : public Upstream::LoadBalancer,
 // create the thread local load balancer.
 class AggregateLoadBalancerFactory : public Upstream::LoadBalancerFactory {
 public:
-  AggregateLoadBalancerFactory(const Cluster& cluster) : cluster_(cluster) {}
+  AggregateLoadBalancerFactory(const Cluster& cluster)
+      : info_(cluster.info()), cluster_manager_(cluster.cluster_manager_),
+        runtime_(cluster.runtime()), random_(cluster.random()), clusters_(cluster.clusters_) {}
   // Upstream::LoadBalancerFactory
   Upstream::LoadBalancerPtr create(Upstream::LoadBalancerParams) override {
-    return std::make_unique<AggregateClusterLoadBalancer>(
-        cluster_.info(), cluster_.cluster_manager_, cluster_.runtime(), cluster_.random(),
-        cluster_.clusters_);
+    return std::make_unique<AggregateClusterLoadBalancer>(info_, cluster_manager_, runtime_,
+                                                          random_, clusters_);
   }
   bool recreateOnHostChangeDeprecated() const override { return false; }
 
-  const Cluster& cluster_;
+  const Upstream::ClusterInfoConstSharedPtr info_;
+  Upstream::ClusterManager& cluster_manager_;
+  Runtime::Loader& runtime_;
+  Random::RandomGenerator& random_;
+  const ClusterSetConstSharedPtr clusters_;
 };
 
 // Thread aware load balancer created by the main thread.
```

**File**: `test/extensions/clusters/aggregate/cluster_test.cc` (modified, +19/-0)
```diff
@@ -438,6 +438,25 @@ TEST_F(AggregateClusterTest, ContextDeterminePriorityLoad) {
   lb_->chooseHost(&lb_context);
 }
 
+// A worker may call the factory after a CDS update has already destroyed the Cluster.
+TEST_F(AggregateClusterTest, LoadBalancerFactoryOutlivesCluster) {
+  initialize(default_yaml_config_);
+
+  lb_.reset();
+  thread_aware_lb_.reset();
+  cluster_.reset();
+
+  lb_ = lb_factory_->create(lb_params_);
+  ASSERT_NE(nullptr, lb_);
+
+  Upstream::HostSharedPtr host = Upstream::makeTestHost(primary_info_, "tcp://127.0.0.1:80");
+  EXPECT_CALL(primary_load_balancer_, chooseHost(_)).WillRepeatedly(Invoke([host] {
+    return Upstream::HostSelectionResponse{host};
+  }));
+  EXPECT_CALL(random_, random()).WillRepeatedly(Return(0));
+  EXPECT_EQ(host.get(), lb_->chooseHost(nullptr).host.get());
+}
+
 } // namespace Aggregate
 } // namespace Clusters
 } // namespace Extensions
```

---

### Incident Patch 15: `797da005` (2026-10-01)
**Commit Message**: Revert "http2: log codec errors at error instead of debug (#47863)" (#47917)

This could be used to cause excessive logging by a malicous client.

This reverts commit 086451ed9dbd9031ac2af7e271d8082d0f25e173.

Signed-off-by: Greg Greenway <[REDACTED_EMAIL]>

**File**: `source/common/http/conn_manager_impl.cc` (modified, +1/-1)
```diff
@@ -555,7 +555,7 @@ RequestDecoder& ConnectionManagerImpl::newStream(ResponseEncoder& response_encod
 
 void ConnectionManagerImpl::handleCodecErrorImpl(absl::string_view error, absl::string_view details,
                                                  StreamInfo::CoreResponseFlag response_flag) {
-  ENVOY_CONN_LOG(error, "dispatch error: {}", read_callbacks_->connection(), error);
+  ENVOY_CONN_LOG(debug, "dispatch error: {}", read_callbacks_->connection(), error);
   read_callbacks_->connection().streamInfo().setResponseFlag(response_flag);
 
   // HTTP/1.1 codec has already sent a 400 response if possible. HTTP/2 codec has already sent
```

#### Recent Merged Pull Requests:
- **PR #48039** (2026-10-05): reverse_tunnel: override duplicate() on the initiator listen handle (@agrawroh)
- **PR #48032** (2026-10-05): reverse_tunnel: make initiator handshake attempts terminal (@agrawroh)
- **PR #48031** (2026-10-06): [v1.39] Update brotli to 42a2ed4 (@yanavlasov)
- **PR #48026** (2026-10-05): fix main format CI (@wbpcode)
- **PR #48023** (closed):  repo: Sync version histories (@publish-envoy[bot])
- **PR #48022** (2026-10-05): [bp/1.39] py/deps: Bump release utils to fix docs inventories (@phlax)
- **PR #48021** (2026-10-05): [bp/1.38] py/deps: Bump release utils to fix docs inventories (@phlax)
- **PR #48020** (2026-10-05): [bp/1.37] py/deps: Bump release utils to fix docs inventories (@phlax)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
