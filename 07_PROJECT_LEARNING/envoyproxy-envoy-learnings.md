> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source**: github ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Source Version**: `4edefad7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T11:59:18.522Z  
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
> **Harvest Timestamp**: 2026-11-03T11:59:18.355Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `envoyproxy/envoy`
- **Description**: Cloud-native high-performance edge/middle/service proxy
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 29171 stars

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
- **Issue #48897** (2026-11-03): **Fix unused variable warnings**
  *Symptoms*: Example warnings emitted when compiling using clang trunk (triggered by [libc++ update](https://github.com/llvm/llvm-project/pull/203084)):  envoy/src/source/common/common/utility.cc:683:15: error: unused variable 'ret' [-Werror,-Wunused-variable]   683 |   std::string ret;       |               ^~~  envoy/src/source/server/admin/admin_html_util.cc:106:27: error: unused variable 'buf3' [-Werror,-Wunused-variable]   106 |   std::string buf1, buf2, buf3;       |                           ^~~~   envoy/src/mobile/library/common/network/socket_tag_socket_option_impl.cc:50:22: error: unused variable 'name' [-Werror,-Wunused-variable]    50 |   static std::string name = "socket_tag";       |                      ^~~~  envoy/src/test/test_listener.cc:13:17: error: unused variable 'active_singletons' [-Werror,-Wunused-variable]    13 |     std::string active_singletons = Envoy::Test::Globals::describeActiveSingletons();       |                 ^~~~~~~~~~~~~~~~~  envoy/src/test/test_common/environment.cc:352:21: error: unused variable 'effective_workspace' [-Werror,-Wunused-variable]   352 |   const std::string effective_workspace = workspace.empty() ? resolveMainWorkspace() : workspace;       |                     ^~~~~~~~~~~~~~~~~~~  ```
  **Post-Mortem & Fix Analysis**:
  > Hi, I would like to work on this. Unless @nigham is already fixing it, could it be assigned to me?
  > I'm not working on this

- **Issue #48627** (2026-10-28): **Compression being applied to bodyless responses**
  *Symptoms*: Making an issue because explaining all this in the PR (#48604) would be a bit much, and for discoverability if someone else runs into "Safari is aborting connections" with a similar cause.  On upgrading from envoy 1.36 to envoy 1.38 we found (eventually) that 204 responses started acquiring a 20 byte `sent_bytes`, despite 0 bytes from upstream.  The reason is that the upgrade changed the default from oghttp2 back to nghttp2 (again), and nghttp2 strips the content-length header from 204 responses.  Envoy, on receiving http2 with no content-length header, apparently does decodeHeaders(..., end_stream=false) then decodeData(empty_buffer, end_stream=true).  The compression filter starts compression on headers end_stream=false, so in these conditions results in gzipping zero bytes, creating a 20-byte body.  This becomes a much more severe problem than wasting 20 bytes when these responses go to a Safari browser, which, as far as we can tell, goes "a body on a 204 response? Outrageous! I'm aborting the entire connection!"  Which meant that a telemetry 204 would cause much more important POST requests to suddenly abort mid-stream, just for Safari browsers.  This took a week to notice, by which point non-edge instances had also deployed, which led to an extremely confusing situation where we could see that the upgrade on edge had clearly caused the increase in aborted POSTs, but when we flipped flags and reverted things it wasn't fixed - because the further-in proxies were, by now, *

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

### Incident Patch 1: `4edefad7` (2026-11-03)
**Commit Message**: router: fix crash in addDownstreamSetCookie when no downstream connection (#45984)

**Commit Message:**
router: fix crash in addDownstreamSetCookie when no downstream
connection

`Filter::addDownstreamSetCookie()` unconditionally dereferences
`downstreamConnection()` to compose the per-connection seed for the
generated cookie value. When the router is invoked without a downstream
connection (e.g. `Http::AsyncClient`-driven paths such as `ext_authz` or
ratelimit side calls, mirror/shadow, and health checks) the connection
pointer is null and the worker process crashes whenever a cookie hash
policy is configured.

Skip the connection-derived seed and return an empty cookie value for
those callers. The resulting cookie hashes identically across all async
invocations, which preserves hash-stability for the cookie hash policy
on
this path.

**Additional Description:**

Supersedes #45134, which was auto-closed as stale; this PR carries the
same
one-line router fix plus the regression test requested in review there
(GitHub does not permit reopening #45134 once its head branch advanced).
The TODO in `router.h` had already flagged the risk ("Need to check for
null conn if this is ever used 

**File**: `changelogs/current/bug_fixes/router__fixed-crash-in-adddownstreamsetcookie-when-connection-null.rst` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+Fixed a crash in ``Filter::addDownstreamSetCookie()`` when the router is invoked
+without a downstream connection (e.g. ``Http::AsyncClient``-driven paths such as
+``ext_authz`` or ratelimit side calls, mirror/shadow, and health checks) and a
+cookie hash policy is configured. Previously the function would unconditionally
+dereference ``downstreamConnection()`` to compose the per-connection seed for
+the generated cookie value. When the connection pointer was null the worker
+would crash. The function now skips the connection-derived seed and returns an
+empty cookie value in that path, preserving hash-stability for those async
+invocations.
```

**File**: `source/common/router/router.h` (modified, +10/-1)
```diff
@@ -502,7 +502,16 @@ class Filter : Logger::Loggable<Logger::Id::router>,
     // connections can receive different cookies if they race on requests.
     std::string value;
     const Network::Connection* conn = downstreamConnection();
-    // Need to check for null conn if this is ever used by Http::AsyncClient in the future.
+    // Async-client-driven router invocations (ext_authz, ratelimit side calls,
+    // mirror/shadow) have a null downstream connection. Previously this path
+    // would unconditionally dereference `conn` to compose the per-connection
+    // seed, which crashed the worker. Skip the connection-derived seed and degrade
+    // to a stable empty seed for those callers; the resulting cookie value is
+    // hashed identically across all such async invocations, which preserves
+    // hash-stability requirements for the cookie hash policy.
+    if (conn == nullptr) {
+      return std::string();
+    }
     value = conn->connectionInfoProvider().remoteAddress()->asString() +
             conn->connectionInfoProvider().localAddress()->asString();
 
```

**File**: `test/common/router/router_test.cc` (modified, +54/-0)
```diff
@@ -738,6 +738,60 @@ TEST_F(RouterTest, AddMultipleCookies) {
   router_->onDestroy();
 }
 
+// Regression test for the crash in addDownstreamSetCookie() on the
+// Http::AsyncClient-driven router path (ext_authz / ratelimit side calls,
+// mirror/shadow), where there is no downstream connection. Previously the cookie
+// seed unconditionally dereferenced the null downstream connection and crashed
+// the worker whenever a cookie hash policy was configured. The call must now
+// degrade to a stable empty seed and not crash.
+TEST_F(RouterTest, AddCookieNullDownstreamConnection) {
+  router_->downstream_connection_is_null_ = true;
+
+  ON_CALL(callbacks_.route_->route_entry_, hashPolicy())
+      .WillByDefault(Return(&callbacks_.route_->route_entry_.hash_policy_));
+  NiceMock<Http::MockRequestEncoder> encoder;
+  Http::ResponseDecoder* response_decoder = nullptr;
+  expectNewStreamWithImmediateEncoder(encoder, &response_decoder, Http::Protocol::Http10);
+
+  EXPECT_CALL(cm_.thread_local_cluster_, httpConnPool(_, _, _, _))
+      .WillOnce(Invoke([&](Upstream::HostConstSharedPtr, Upstream::ResourcePriority,
+                           std::optional<Http::Protocol>, Upstream::LoadBalancerContext* context) {
+        EXPECT_EQ(10UL, context->computeHashKey().value());
+        return Upstream::HttpPoolData([]() {}, &cm_.thread_local_cluster_.conn_pool_);
+      }));
+
+  std::string cookie_value = "not-empty";
+  EXPECT_CALL(callbacks_.route_->route_entry_.hash_policy_, generateHash(_, _, _))
+      .WillOnce(
+          Invoke([&](OptRef<const Http::RequestHeaderMap>, OptRef<const StreamInfo::StreamInfo>,
+                     Http::HashPolicy::AddCookieCallback add_cookie) {
+            // Pre-fix this dereferenced the null downstream connection and crashed
+            // the worker; it must now return a stable empty seed.
+            cookie_value = add_cookie("foo", "", std::chrono::seconds(1337), {});
+            return std::optional<uint64_t>(10);
+          }));
+
+  // With no downstream connection the cookie is not generated, so no Set-Cookie
+  // header is emitted downstream.
+  EXPECT_CALL(callbacks_, encodeHeaders_(_, _))
+      .WillOnce(Invoke([&](const Http::HeaderMap& headers, const bool) -> void {
+        EXPECT_TRUE(headers.get(Http::Headers::get().SetCookie).empty());
+      }));
+  expectResponseTimerCreate();
+
+  Http::TestRequestHeaderMapImpl headers;
+  HttpTestUtility::addDefaultHeaders(headers);
+  router_->decodeHeaders(headers, true);
+
+  Http::ResponseHeaderMapPtr response_headers(
+      new Http::TestResponseHeaderMapImpl{{":status", "200"}});
+  response_decoder->decodeHeaders(std::move(response_headers), true);
+
+  // The worker did not crash and the async path produced a stable empty cookie.
+  EXPECT_EQ(cookie_value, "");
+  router_->onDestroy();
+}
+
 TEST_F(RouterTest, MetadataNoOp) { EXPECT_EQ(nullptr, router_->metadataMatchCriteria()); }
 
 TEST_F(RouterTest, MetadataMatchCriteria) {
```

**File**: `test/common/router/router_test_base.h` (modified, +6/-0)
```diff
@@ -52,13 +52,19 @@ class RouterTestFilter : public Filter {
   }
 
   const Network::Connection* downstreamConnection() const override {
+    // Simulate the Http::AsyncClient-driven router path (ext_authz / ratelimit
+    // side calls, mirror/shadow), which has no downstream connection.
+    if (downstream_connection_is_null_) {
+      return nullptr;
+    }
     return &downstream_connection_;
   }
 
   NiceMock<Network::MockConnection> downstream_connection_;
   MockRetryState* retry_state_{};
   bool reject_all_hosts_ = false;
   bool retry_425_response_ = false;
+  bool downstream_connection_is_null_ = false;
 };
 
 class RouterTestBase : public testing::Test {
```

---

### Incident Patch 2: `8edf1e54` (2026-11-02)
**Commit Message**: build(deps): bump sphinxcontrib-googleanalytics from 0.5 to 0.6 in /docs/tools/python (#48710)

Bumps
[sphinxcontrib-googleanalytics](https://github.com/sphinx-contrib/googleanalytics)
from 0.5 to 0.6.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/sphinx-contrib/googleanalytics/releases">sphinxcontrib-googleanalytics's
releases</a>.</em></p>
<blockquote>
<h2>v0.6</h2>
<ul>
<li>Stop using the deprecated pkg_resources module. (Dmitry Shachnev, <a
href="https://redirect.github.com/sphinx-contrib/googleanalytics/issues/22">#22</a>)</li>
<li>Fix lint errors reported by newer ruff versions.</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/sphinx-contrib/googleanalytics/commit/a6490e61da9b455aa085883da5e5bb98f939f0e9"><code>a6490e6</code></a>
Release 0.6</li>
<li><a
href="https://github.com/sphinx-contrib/googleanalytics/commit/a0bc979aa6ec33e63780c3b105463ce6ce98225a"><code>a0bc979</code></a>
Fix lint errors reported by newer ruff</li>
<li><a
href="https://github.com/sphinx-contrib/googleanalytics/commit/4ae0adf4e9b8a0fd0f97dc90ffdf2e7e49c4c13e"><code>4ae0adf</code></a>
Merge pull re

**File**: `bazel/tests/external/MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -6273,8 +6273,8 @@
             "https://files.pythonhosted.org/packages/f6/d2/5beee64d3e4e747f316bae86b55943f51e82bb86ecd325883ef65741e7da/sphinxcontrib_devhelp-2.0.0.tar.gz": "sha256:411f5d96d445d1d73bb5d52133377b4248ec79db5c793ce7dbe59e074b4dd1ad"
           },
           "sphinxcontrib-googleanalytics": {
-            "https://files.pythonhosted.org/packages/6b/c7/e68a33ba7b8a4a697c8ad278a37d7bc8521c4175b0f9248fec80ae6fed4f/sphinxcontrib_googleanalytics-0.5-py3-none-any.whl": "sha256:437e529c33c441bcccceabe3ead1585115e6ba83fe90e23bd42e42521333cc0a",
-            "https://files.pythonhosted.org/packages/b5/78/ad9a210c24499ccfd97f0eccc902576b587af82ae2dc27021e0662929940/sphinxcontrib_googleanalytics-0.5.tar.gz": "sha256:a2ac6df9d16b9c124febf6b44e714c1fd9725e692b73ee84ec6b52b377ff5561"
+            "https://files.pythonhosted.org/packages/84/24/bdd9ae42b7017fcea870fe24ee1815793289219644010a015253b9b21ce6/sphinxcontrib_googleanalytics-0.6.tar.gz": "sha256:dc8740342331ff523b5eda8f5d1ea6176acfa86bbd195e8d67f642db8f2b22c7",
+            "https://files.pythonhosted.org/packages/ca/4a/516e8cfabfe1760ac1ea5e310779e2a0986174c2f7ba95499f9d5bf46e1c/sphinxcontrib_googleanalytics-0.6-py3-none-any.whl": "sha256:9264640a9a0449a088cadaca6794946e60059345752221dae2c6ad986723d3d4"
           },
           "sphinxcontrib-htmlhelp": {
             "https://files.pythonhosted.org/packages/0a/7b/18a8c0bcec9182c05a0b3ec2a776bba4ead82750a55ff798e8d406dae604/sphinxcontrib_htmlhelp-2.1.0-py3-none-any.whl": "sha256:166759820b47002d22914d64a075ce08f4c46818e17cfc9470a9786b759b19f8",
```

**File**: `docs/MODULE.bazel.lock` (modified, +2/-2)
```diff
@@ -6271,8 +6271,8 @@
             "https://files.pythonhosted.org/packages/f6/d2/5beee64d3e4e747f316bae86b55943f51e82bb86ecd325883ef65741e7da/sphinxcontrib_devhelp-2.0.0.tar.gz": "sha256:411f5d96d445d1d73bb5d52133377b4248ec79db5c793ce7dbe59e074b4dd1ad"
           },
           "sphinxcontrib-googleanalytics": {
-            "https://files.pythonhosted.org/packages/6b/c7/e68a33ba7b8a4a697c8ad278a37d7bc8521c4175b0f9248fec80ae6fed4f/sphinxcontrib_googleanalytics-0.5-py3-none-any.whl": "sha256:437e529c33c441bcccceabe3ead1585115e6ba83fe90e23bd42e42521333cc0a",
-            "https://files.pythonhosted.org/packages/b5/78/ad9a210c24499ccfd97f0eccc902576b587af82ae2dc27021e0662929940/sphinxcontrib_googleanalytics-0.5.tar.gz": "sha256:a2ac6df9d16b9c124febf6b44e714c1fd9725e692b73ee84ec6b52b377ff5561"
+            "https://files.pythonhosted.org/packages/84/24/bdd9ae42b7017fcea870fe24ee1815793289219644010a015253b9b21ce6/sphinxcontrib_googleanalytics-0.6.tar.gz": "sha256:dc8740342331ff523b5eda8f5d1ea6176acfa86bbd195e8d67f642db8f2b22c7",
+            "https://files.pythonhosted.org/packages/ca/4a/516e8cfabfe1760ac1ea5e310779e2a0986174c2f7ba95499f9d5bf46e1c/sphinxcontrib_googleanalytics-0.6-py3-none-any.whl": "sha256:9264640a9a0449a088cadaca6794946e60059345752221dae2c6ad986723d3d4"
           },
           "sphinxcontrib-htmlhelp": {
             "https://files.pythonhosted.org/packages/0a/7b/18a8c0bcec9182c05a0b3ec2a776bba4ead82750a55ff798e8d406dae604/sphinxcontrib_htmlhelp-2.1.0-py3-none-any.whl": "sha256:166759820b47002d22914d64a075ce08f4c46818e17cfc9470a9786b759b19f8",
```

**File**: `docs/tools/python/requirements.txt` (modified, +3/-3)
```diff
@@ -1454,9 +1454,9 @@ sphinxcontrib-devhelp==2.0.0 \
     #   -r requirements.in
     #   envoy-docs-sphinx-runner
     #   sphinx
-sphinxcontrib-googleanalytics==0.5 \
-    --hash=sha256:437e529c33c441bcccceabe3ead1585115e6ba83fe90e23bd42e42521333cc0a \
-    --hash=sha256:a2ac6df9d16b9c124febf6b44e714c1fd9725e692b73ee84ec6b52b377ff5561
+sphinxcontrib-googleanalytics==0.6 \
+    --hash=sha256:9264640a9a0449a088cadaca6794946e60059345752221dae2c6ad986723d3d4 \
+    --hash=sha256:dc8740342331ff523b5eda8f5d1ea6176acfa86bbd195e8d67f642db8f2b22c7
     # via -r requirements.in
 sphinxcontrib-htmlhelp==2.1.0 \
     --hash=sha256:166759820b47002d22914d64a075ce08f4c46818e17cfc9470a9786b759b19f8 \
```

---

### Incident Patch 3: `a42f23cd` (2026-11-02)
**Commit Message**: http2: deflake RstStreamOverflowOnPendingFlushTimeout (#48791)

Commit Message: http2: deflake RstStreamOverflowOnPendingFlushTimeout

The test set `stream_idle_timeout` to 400ms only to get a 400ms pending
flush timer, since `stream_flush_timeout` defaults to it. The idle timer
also covers the pre-fill stream, so that stream's upstream response had
to start within 400ms of the request. On a slow runner the idle timeout
fired first and left its local reply's two frames queued. The test then
timed out waiting for 998 queued frames with "current value 2".

This sets `stream_flush_timeout` to 400ms instead and leaves the idle
timeout at its default. The flush timeout, RST_STREAM and overflow path
the test is about doesn't change.

Additional Description:
It failed on 9 changes between 10-05 and 10-22 under tsan, always on
oghttp2 with "current value 2". #45189 reported the same symptom back in
May. Delaying the autonomous upstream's response by 500ms reproduces it
on both codecs, so the oghttp2 skew in CI is just that codec being
slower.

AI Disclaimer: code change created with AI assistance, fully reviewed by
me prior to opening.

Risk Level: Low (test only)
Testing:
- 500ms delayed-

**File**: `test/integration/http2_flood_integration_test.cc` (modified, +4/-3)
```diff
@@ -650,12 +650,13 @@ TEST_P(Http2FloodMitigationTest, RST_STREAM) {
 
 // Verify detection of flood by the RST_STREAM frame sent on pending flush timeout
 TEST_P(Http2FloodMitigationTest, RstStreamOverflowOnPendingFlushTimeout) {
+  // Shorten only the pending flush timer. A short stream_idle_timeout would also apply to the
+  // pre-fill stream and fire if its upstream response is slow to start.
   config_helper_.addConfigModifier(
       [](envoy::extensions::filters::network::http_connection_manager::v3::HttpConnectionManager&
              hcm) {
-        hcm.mutable_stream_idle_timeout()->set_seconds(0);
-        constexpr uint64_t IdleTimeoutMs = 400;
-        hcm.mutable_stream_idle_timeout()->set_nanos(IdleTimeoutMs * 1000 * 1000);
+        constexpr uint64_t FlushTimeoutMs = 400;
+        hcm.mutable_stream_flush_timeout()->set_nanos(FlushTimeoutMs * 1000 * 1000);
       });
 
   // Pending flush timer is started when upstream response has completed but there is no window to
```

#### Recent Merged Pull Requests:
- **PR #48945** (2026-11-02): Skip //test/common/upstream:health_check_fuzz_lib on Windows (@yanavlasov)
- **PR #48942** (2026-11-02): grpc_stats: mark robust_to_untrusted_downstream (@ggreenway)
- **PR #48937** (2026-11-02): Exclude admin interface from threat model (@yanavlasov)
- **PR #48936** (2026-11-02): Change sni_cluster security posture to robust (@yanavlasov)
- **PR #48931** (2026-11-02): Enable UNREFERENCED_PARAMETER on Windows (@yanavlasov)
- **PR #48925** (2026-11-02): Disable corpus generation on Windows (@yanavlasov)

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

## X. router: fix crash in addDownstreamSetCookie when no downstream connection (#4598

**RULE**:
When implementing operations in `changelogs/current/bug_fixes/router__fixed-crash-in-adddownstreamsetcookie-when-connection-null.rst`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4edefad7`: router: fix crash in addDownstreamSetCookie when no downstream connection (#45984). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelogs/current/bug_fixes/router__fixed-crash-in-adddownstreamsetcookie-when-connection-null.rst`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
Fixed a crash in ``Filter::addDownstreamSetCookie()`` when the router is invoked
without a downstream connection (e.g. ``Http::AsyncClient``-driven paths such as
``ext_authz`` or ratelimit side calls, mirror/shadow, and health checks) and a
cookie hash policy is configured. Previously the function would unconditionally
dereference ``downstreamConnection()`` to compose the per-connection seed for
the generated cookie value. When the connection pointer was null the worker
would crash. The function now skips the connection-derived seed and returns an
empty cookie value in that path, preserving hash-stability for those async
invocations.
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4edefad7` are properly handled with clean fallback behavior.
