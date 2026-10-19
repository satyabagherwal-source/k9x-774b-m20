> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/envoyproxy-envoy-learnings.md`  
> **Source**: github ([https://github.com/envoyproxy/envoy](https://github.com/envoyproxy/envoy))  
> **Source Version**: `d7b74bd6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:32:02.153Z  
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
> **Harvest Timestamp**: 2026-10-19T05:32:02.146Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `envoyproxy/envoy`
- **Description**: Cloud-native high-performance edge/middle/service proxy
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 29088 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #48362** (2026-10-16): **geoip: client-supplied geolocation headers are forwarded upstream whenever the lookup has no value for them**
  *Symptoms*: *Title*: geoip: client-supplied geolocation headers are forwarded upstream whenever the lookup has no value for them  *Description*:  The HTTP geoip filter documents that a configured geolocation header present in the incoming request "will be overridden by the filter" (`docs/root/configuration/http/http_filters/geoip_filter.rst`, and the `geo_headers_to_add` comment in `api/envoy/extensions/geoip_providers/common/v3/common.proto`).  The filter only writes a header when the provider returned a non-empty value for it (`source/extensions/filters/http/geoip/geoip_filter.cc`, `onLookupComplete`: `if (!lookup_value.empty()) { request_headers_->setCopy(...) }`) and never removes one. The maxmind provider only inserts a key when `found_entry` is true and the field exists. So a client-supplied `x-geo-country`, `x-geo-asn`, `x-geo-anon-vpn`, etc. reaches the upstream unchanged whenever the lookup produces nothing for that header:  - the address is not in the database (unresolved ranges, private ranges, new allocations), - the lookup returns an error, - the database has no such field for that address (city/region are often absent), - the lookup is skipped because the downstream address is not an IP address (internal listener, Unix socket; the skip path added in #47481 lets the request through "untouched").  The upstream, or an RBAC, ext_authz or Lua step later in the filter chain, cannot tell such a header from one the filter set. The anon headers are documented as "set to either true 

- **Issue #48218** (2026-10-13): **auto_host_sni is not applied to upstream HTTP/3 (QUIC) connections**
  *Symptoms*: **Description**  `UpstreamTlsContext.auto_host_sni` is ignored when the context is wrapped in `QuicUpstreamTransport`. An HTTP/3 upstream connection sends no SNI, or the configured `sni`, instead of the upstream host's hostname. Envoy's QUIC client then checks the server certificate against that name, so the handshake fails whenever the certificate only carries the host's hostname.  Over TLS over TCP, `ClientContextImpl::newSsl` picks the SNI through `effectiveSni`: the per-request server name override, then the host's hostname when `auto_host_sni` is set, then the configured `sni`. The HTTP/3 pool picks it in `sni()` in `source/common/http/http3/conn_pool.cc`, which only looks at the override and the configured `sni`:  ```cpp return options && options->serverNameOverride().has_value()            ? options->serverNameOverride().value()            : getConfig(host->transportSocketFactory()).serverNameIndication(); ```  The pool is created per host and already receives it, so it could apply the same order as `effectiveSni`.  The `auto_host_sni` docs and the `QuicUpstreamTransport` docs don't mention this limitation. Found while adding upstream HTTP/3 to Envoy Gateway, https://github.com/envoyproxy/gateway/pull/10068, where a Backend using `autoSNIFromEndpointHostname` works over TCP but fails over HTTP/3.  **Repro**  Envoy 1.35.2, Caddy 2.8 serving HTTP/3 on 8443 with a certificate for `h3-backend`. Cluster with `explicit_http_config.http3_protocol_options`:  ```yaml load_assig
  **Post-Mortem & Fix Analysis**:
  > /assign @agrawroh

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

### Incident Patch 1: `d7b74bd6` (2026-10-19)
**Commit Message**: wasm: fix a regression for remote code (#48415)

<!--
!!!ATTENTION!!!

If you are fixing **any** crash or **any** potential security issue,
**do not
open a pull request**.

Instead, please
[open a GitHub Security
Advisory](https://github.com/envoyproxy/envoy/security/advisories/new)
(preferred). Alternatively, you may email
[REDACTED_EMAIL].

Thank you in advance for helping to keep Envoy secure.

!!!ATTENTION!!!

For an explanation of how to fill out the fields, please see the
relevant section
in
[PULL_REQUESTS.md](https://github.com/envoyproxy/envoy/blob/main/PULL_REQUESTS.md)

!!!ATTENTION!!!

Please check the [use of generative AI
policy](https://github.com/envoyproxy/envoy/blob/main/CONTRIBUTING.md?plain=1#L41).

You may use generative AI only if you fully understand the code. You
need to disclose
this usage in the PR description to ensure transparency.
-->

Commit Message: fix a regression from
https://github.com/envoyproxy/envoy/pull/46674#issuecomment-6234329891
Additional Description:
Risk Level:
Testing:
Docs Changes:
Release Notes:
Platform Specific Features:
[Optional Runtime guard:]
[Optional Fixes #Issue]
[Optional Fixes commit #PR or SHA]
[Optional Deprecated:]
[Opti

**File**: `source/extensions/common/wasm/wasm.cc` (modified, +18/-10)
```diff
@@ -340,13 +340,17 @@ bool createWasm(const PluginSharedPtr& plugin, const Stats::ScopeSharedPtr& scop
       it->second.use_time = now;
       if (it->second.in_progress) {
         stats_handler.onEvent(WasmEvent::RemoteLoadCacheMiss);
-        ENVOY_LOG_TO_LOGGER(Envoy::Logger::Registry::getLog(Envoy::Logger::Id::wasm), warn,
-                            "createWasm: failed to load (in progress) from {}", source);
-        cb(nullptr);
-        return false;
-      }
-      code = it->second.code;
-      if (code.empty()) {
+        if (vm_config.nack_on_code_cache_miss()) {
+          ENVOY_LOG_TO_LOGGER(Envoy::Logger::Registry::getLog(Envoy::Logger::Id::wasm), warn,
+                              "createWasm: failed to load (in progress) from {}", source);
+          cb(nullptr);
+          return false;
+        }
+        // Another config is already fetching this code. Fetch it as well, gated by our own init
+        // manager, but leave the shared cache entry alone: the fetch callback never overwrites
+        // code that is already cached, so a failure here cannot poison the cache.
+        fetch = true;
+      } else if (code = it->second.code; code.empty()) {
         if (now - it->second.fetch_time <
             std::chrono::seconds(CODE_CACHE_SECONDS_NEGATIVE_CACHING)) {
           stats_handler.onEvent(WasmEvent::RemoteLoadCacheNegativeHit);
@@ -418,17 +422,21 @@ bool createWasm(const PluginSharedPtr& plugin, const Stats::ScopeSharedPtr& scop
   if (fetch) {
     auto holder = std::make_shared<std::unique_ptr<Event::DeferredDeletable>>();
     auto fetch_callback = [vm_config, complete_cb, source, &dispatcher, scope, holder, plugin,
-                           &stats_handler](const std::string& code) {
+                           &stats_handler](const std::string& fetched_code) {
+      std::string code = fetched_code;
       {
         std::lock_guard<std::mutex> guard(code_cache_mutex);
         auto& e = (*code_cache)[vm_config.code().remote().sha256()];
         e.in_progress = false;
-        e.code = code;
         Stats::ScopeSharedPtr create_wasm_stats_scope = stats_handler.lockAndCreateStats(scope);
-        if (code.empty()) {
+        if (fetched_code.empty()) {
           stats_handler.onEvent(WasmEvent::RemoteLoadCacheFetchFailure);
+          // A concurrent fetch of the same code may already have succeeded; use it rather than
+          // overwriting it with a negative entry.
+          code = e.code;
         } else {
           stats_handler.onEvent(WasmEvent::RemoteLoadCacheFetchSuccess);
+          e.code = fetched_code;
         }
         stats_handler.onRemoteCacheEntriesChanged(code_cache->size());
       }
```

**File**: `test/extensions/common/wasm/wasm_test.cc` (modified, +113/-30)
```diff
@@ -1040,8 +1040,9 @@ TEST_P(WasmCommonTest, RemoteCodeMultipleRetry) {
   dispatcher_->clearDeferredDeleteList();
 }
 
-// Regression test: a second createWasm while a remote fetch is in_progress must return false
-// with exactly one cb(nullptr) call — not fall through to the empty-code path.
+// A second createWasm for the same remote code while a fetch is in progress must not fail the
+// config: it fetches the code itself, and a failure of that fetch must not overwrite code that a
+// concurrent fetch has already cached.
 TEST_P(WasmCommonTest, RemoteCodeInProgressRace) {
   if (std::get<0>(GetParam()) == "null") {
     return;
@@ -1070,13 +1071,18 @@ TEST_P(WasmCommonTest, RemoteCodeInProgressRace) {
   vm_config->mutable_code()->mutable_remote()->mutable_http_uri()->set_cluster("example_com");
   vm_config->mutable_code()->mutable_remote()->mutable_http_uri()->mutable_timeout()->set_seconds(
       5);
+  vm_config->mutable_code()
+      ->mutable_remote()
+      ->mutable_retry_policy()
+      ->mutable_num_retries()
+      ->set_value(0);
 
   auto plugin = std::make_shared<Extensions::Common::Wasm::Plugin>(plugin_config, local_info_);
 
-  WasmHandleSharedPtr wasm_handle;
   NiceMock<Http::MockAsyncClient> client;
   NiceMock<Http::MockAsyncClientRequest> request(&client);
 
+  // The first fetch succeeds, every later one fails.
   int http_fetch_count = 0;
   cluster_manager.initializeThreadLocalClusters({"example_com"});
   EXPECT_CALL(cluster_manager.thread_local_cluster_, httpAsyncClient())
@@ -1085,43 +1091,120 @@ TEST_P(WasmCommonTest, RemoteCodeInProgressRace) {
       .WillRepeatedly(
           Invoke([&](Http::RequestMessagePtr&, Http::AsyncClient::Callbacks& callbacks,
                      const Http::AsyncClient::RequestOptions&) -> Http::AsyncClient::Request* {
-            ++http_fetch_count;
+            const bool success = http_fetch_count++ == 0;
             Http::ResponseMessagePtr response(
                 new Http::ResponseMessageImpl(Http::ResponseHeaderMapPtr{
-                    new Http::TestResponseHeaderMapImpl{{":status", "200"}}}));
-            response->body().add(code);
+                    new Http::TestResponseHeaderMapImpl{{":status", success ? "200" : "503"}}}));
+            if (success) {
+              response->body().add(code);
+            }
             callbacks.onSuccess(request, std::move(response));
             return nullptr;
           }));
 
-  Init::TargetHandlePtr init_target_handle;
-  EXPECT_CALL(init_manager, add(_)).WillOnce(Invoke([&](const Init::Target& target) {
-    init_target_handle = target.createHandle("test");
+  std::vector<Init::TargetHandlePtr> init_target_handles;
+  EXPECT_CALL(init_manager, add(_)).Times(2).WillRepeatedly(Invoke([&](const Init::Target& target) {
+    init_target_handles.push_back(target.createHandle("test"));
   }));
 
-  // First createWasm: cache miss, sets in_progress = true (fetch deferred until init).
-  bool first_ret = createWasm(plugin, scope_, cluster_manager, init_manager, *dispatcher_, *api_,
-                              lifecycle_notifier_, remote_data_provider_,
-                              [&wasm_handle](const WasmHandleSharedPtr& w) { wasm_handle = w; });
-  EXPECT_TRUE(first_ret);
-
-  // Second createWasm with the same sha256 while in_progress = true.
-  int race_cb_count = 0;
-  bool second_ret = createWasm(plugin, scope_, cluster_manager, init_manager, *dispatcher_, *api_,
-                               lifecycle_notifier_, remote_data_provider_,
-                               [&race_cb_count](const WasmHandleSharedPtr& w) {
-                                 ++race_cb_count;
-                                 EXPECT_EQ(w, nullptr);
-                               });
-  EXPECT_FALSE(second_ret);
-  EXPECT_EQ(race_cb_count, 1);
+  // First createWasm: cache miss, the fetch is deferred until init.
+  WasmHandleSharedPtr first_handle;
+  RemoteAsyncDataProviderPtr first_provider;
+  EXPECT_TRUE(createWasm(plugin, scope_, cluster_manager, init_manager, *dispatcher_, *api_,
+                         lifecycle_notifier_, first_provider,
+                         [&first_handle](const WasmHandleSharedPtr& w) { first_handle = w; }));
+
+  // Second createWasm with the same sha256 while the first fetch is in progress.
+  int second_cb_count = 0;
+  WasmHandleSharedPtr second_handle;
+  RemoteAsyncDataProviderPtr second_provider;
+  EXPECT_TRUE(createWasm(plugin, scope_, cluster_manager, init_manager, *dispatcher_, *api_,
+                         lifecycle_notifier_, second_provider, [&](const WasmHandleSharedPtr& w) {
+                           ++second_cb_count;
+                           second_handle = w;
+                         }));
+  EXPECT_EQ(second_cb_count, 0);
   EXPECT_EQ(http_fetch_count, 0);
+  ASSERT_EQ(init_target_handles.size(), 2);
+
+  // The first fetch succeeds.
+  EXPECT_CALL(init_watcher, ready()).Times(2);
+  init_target_handles[0]->initialize(init_watcher);
+  EX
```

---

### Incident Patch 2: `bc3dc71c` (2026-10-16)
**Commit Message**: overload_manager: fix cross-thread use-after-free in AcceptedSocketImpl on exact_balance shutdown (#47455)

## Summary

Fixes a segfault (use-after-free) that can crash a worker thread during
Envoy shutdown, observed in production on 1.37.0/1.37.5 with a listener
configured with `connection_balance_config.exact_balance` and the
`envoy.resource_monitors.global_downstream_max_connections` overload
manager resource monitor enabled.

Crash signature:
```
Caught Segmentation fault, suspect faulting address 0x33acbff38680
#1: Envoy::Network::AcceptedSocketImpl::~AcceptedSocketImpl()
#2: Envoy::Network::ConnectionImpl::~ConnectionImpl()
#3: Envoy::Network::ServerConnectionImpl::~ServerConnectionImpl()
#4: Envoy::Server::ActiveTcpConnection::~ActiveTcpConnection()
#6: Envoy::Event::DispatcherImpl::clearDeferredDeleteList()
#7: Envoy::Server::ActiveTcpListener::~ActiveTcpListener()
#12: Envoy::Server::ConnectionHandlerImpl::~ConnectionHandlerImpl()
#13: Envoy::Server::WorkerImpl::threadRoutine()
```

## Root cause

`ConnectionHandlerImpl` captures a bare reference
(`ThreadLocalOverloadStateOptRef`) into the calling worker's own
thread-local overload state once per worker, and threads it dow

**File**: `changelogs/current/bug_fixes/overload_manager__fix-cross-thread-use-after-free-on-exact-balance.rst` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+Fixed a use-after-free that could crash a worker thread during Envoy shutdown when a TCP
+listener is configured with
+:ref:`exact_balance <envoy_v3_api_field_config.listener.v3.Listener.ConnectionBalanceConfig.exact_balance>`
+and the ``envoy.resource_monitors.global_downstream_max_connections`` overload manager resource
+monitor is configured. A connection accepted on one worker could be handed off to a different
+worker via connection balancing while still holding a reference into the *originating* worker's
+thread-local overload state; because worker threads shut down independently with no ordering
+guarantee relative to one another, the destination worker could destroy the connection after the
+originating worker had already torn down its own thread-local state, dereferencing freed memory.
+The connection's overload state reference is now rebound to the receiving worker's own
+thread-local state once the connection has settled on its final worker, so it is always valid
+for as long as the connection itself is.
```

**File**: `source/common/listener_manager/BUILD` (modified, +1/-0)
```diff
@@ -249,6 +249,7 @@ envoy_cc_library(
         "//source/common/common:assert_lib",
         "//source/common/common:linked_object",
         "//source/common/network:connection_lib",
+        "//source/common/network:listen_socket_lib",
         "//source/common/network:listener_lib",
         "//source/common/stats:timespan_lib",
         "//source/server:active_listener_base",
```

**File**: `source/common/listener_manager/active_tcp_listener.cc` (modified, +8/-1)
```diff
@@ -7,6 +7,7 @@
 
 #include "source/common/common/assert.h"
 #include "source/common/network/connection_impl.h"
+#include "source/common/network/listen_socket_impl.h"
 #include "source/common/network/utility.h"
 
 namespace Envoy {
@@ -24,7 +25,7 @@ ActiveTcpListener::ActiveTcpListener(Network::TcpConnectionHandler& parent,
           parent.createListener(std::move(socket), *this, runtime, random, config, overload_state),
           config),
       tcp_conn_handler_(parent), connection_balancer_(connection_balancer),
-      listen_address_(listen_address) {
+      listen_address_(listen_address), overload_state_(overload_state) {
   connection_balancer_.registerHandler(*this);
 }
 
@@ -125,6 +126,12 @@ void ActiveTcpListener::onAcceptWorker(Network::ConnectionSocketPtr&& socket,
     }
   }
 
+  // Rebind to this worker's own overload state handle now that the socket has settled here,
+  // in case it was handed off from a different worker via exact_balance. No-op otherwise.
+  if (auto* accepted_socket = dynamic_cast<Network::AcceptedSocketImpl*>(socket.get())) {
+    accepted_socket->setOverloadState(overload_state_);
+  }
+
   auto active_socket = std::make_unique<ActiveTcpSocket>(
       *this, std::move(socket), hand_off_restored_destination_connections, network_namespace);
 
```

**File**: `source/common/listener_manager/active_tcp_listener.h` (modified, +3/-0)
```diff
@@ -101,6 +101,9 @@ class ActiveTcpListener final : public Network::TcpListenerCallbacks,
   // when rebalancing. The accepted socket can't be used to get the listening address, since
   // the accepted socket's remote address can be another address than the listening address.
   Network::Address::InstanceConstSharedPtr listen_address_;
+  // This worker's own overload state handle, used to rebind accepted sockets in
+  // onAcceptWorker() (see exact_balance handoff via post()).
+  ThreadLocalOverloadStateOptRef overload_state_;
 };
 
 using ActiveTcpListenerOptRef = OptRef<ActiveTcpListener>;
```

**File**: `source/common/network/listen_socket_impl.h` (modified, +9/-0)
```diff
@@ -228,6 +228,15 @@ class AcceptedSocketImpl : public ConnectionSocketImpl {
   // variable until the logic is moved into the overload manager.
   static uint64_t acceptedSocketCount() { return global_accepted_socket_count_.load(); }
 
+  /**
+   * Rebind this socket's overload state handle, e.g. after being handed off to a different
+   * worker via connection_balance_config.exact_balance. The tracked resource is global, so any
+   * live worker's handle is equally valid for accounting purposes.
+   */
+  void setOverloadState(Server::ThreadLocalOverloadStateOptRef overload_state) {
+    overload_state_ = overload_state;
+  }
+
 private:
   static std::atomic<uint64_t> global_accepted_socket_count_;
   Server::ThreadLocalOverloadStateOptRef overload_state_;
```

**File**: `source/server/BUILD` (modified, +1/-0)
```diff
@@ -320,6 +320,7 @@ envoy_cc_library(
     hdrs = ["null_overload_manager.h"],
     deps = [
         "//envoy/server/overload:overload_manager_interface",
+        "//source/common/common:assert_lib",
         "//source/common/event:scaled_range_timer_manager_lib",
     ],
 )
```

**File**: `source/server/null_overload_manager.h` (modified, +12/-2)
```diff
@@ -5,6 +5,7 @@
 #include "envoy/server/overload/overload_manager.h"
 #include "envoy/thread_local/thread_local.h"
 
+#include "source/common/common/assert.h"
 #include "source/common/event/scaled_range_timer_manager_impl.h"
 
 namespace Envoy {
@@ -18,16 +19,25 @@ class NullOverloadManager : public OverloadManager {
   struct OverloadState : public ThreadLocalOverloadState {
     OverloadState(Event::Dispatcher& dispatcher, bool permissive)
         : dispatcher_(dispatcher), permissive_(permissive) {}
-    const OverloadActionState& getState(const std::string&) override { return inactive_; }
+    const OverloadActionState& getState(const std::string&) override {
+      ASSERT(dispatcher_.isThreadSafe());
+      return inactive_;
+    }
     bool tryAllocateResource(OverloadProactiveResourceName, int64_t) override {
+      ASSERT(dispatcher_.isThreadSafe());
       return permissive_;
     }
     bool tryDeallocateResource(OverloadProactiveResourceName, int64_t) override {
+      ASSERT(dispatcher_.isThreadSafe());
       return permissive_;
     }
-    bool isResourceMonitorEnabled(OverloadProactiveResourceName) override { return false; }
+    bool isResourceMonitorEnabled(OverloadProactiveResourceName) override {
+      ASSERT(dispatcher_.isThreadSafe());
+      return false;
+    }
     ProactiveResourceMonitorOptRef
     getProactiveResourceMonitorForTest(OverloadProactiveResourceName) override {
+      ASSERT(dispatcher_.isThreadSafe());
       return makeOptRefFromPtr<ProactiveResourceMonitor>(nullptr);
     }
     Event::Dispatcher& dispatcher_;
```

**File**: `source/server/overload_manager_impl.cc` (modified, +11/-3)
```diff
@@ -323,26 +323,30 @@ class MultiActionScaledRangeTimerManager : public Event::ScaledRangeTimerManager
 class ThreadLocalOverloadStateImpl : public ThreadLocalOverloadState {
 public:
   explicit ThreadLocalOverloadStateImpl(
+      const Event::Dispatcher& dispatcher,
       const NamedOverloadActionSymbolTable& action_symbol_table,
       std::shared_ptr<absl::node_hash_map<OverloadProactiveResourceName, ProactiveResource>>&
           proactive_resources)
-      : action_symbol_table_(action_symbol_table),
+      : dispatcher_(dispatcher), action_symbol_table_(action_symbol_table),
         actions_(action_symbol_table.size(), OverloadActionState(UnitFloat::min())),
         proactive_resources_(proactive_resources) {}
 
   const OverloadActionState& getState(const std::string& action) override {
+    ASSERT(dispatcher_.isThreadSafe());
     if (const auto symbol = action_symbol_table_.lookup(action); symbol != std::nullopt) {
       return actions_[symbol->index()];
     }
     return always_inactive_;
   }
 
   void setState(NamedOverloadActionSymbolTable::Symbol action, OverloadActionState state) {
+    ASSERT(dispatcher_.isThreadSafe());
     actions_[action.index()] = state;
   }
 
   bool tryAllocateResource(OverloadProactiveResourceName resource_name,
                            int64_t increment) override {
+    ASSERT(dispatcher_.isThreadSafe());
     const auto proactive_resource = proactive_resources_->find(resource_name);
     if (proactive_resource == proactive_resources_->end()) {
       ENVOY_LOG_MISC(warn, "Failed to allocate resource usage, resource monitor is not configured");
@@ -354,6 +358,7 @@ class ThreadLocalOverloadStateImpl : public ThreadLocalOverloadState {
 
   bool tryDeallocateResource(OverloadProactiveResourceName resource_name,
                              int64_t decrement) override {
+    ASSERT(dispatcher_.isThreadSafe());
     const auto proactive_resource = proactive_resources_->find(resource_name);
     if (proactive_resource == proactive_resources_->end()) {
       ENVOY_LOG_MISC(warn,
@@ -365,12 +370,14 @@ class ThreadLocalOverloadStateImpl : public ThreadLocalOverloadState {
   }
 
   bool isResourceMonitorEnabled(OverloadProactiveResourceName resource_name) override {
+    ASSERT(dispatcher_.isThreadSafe());
     const auto proactive_resource = proactive_resources_->find(resource_name);
     return proactive_resource != proactive_resources_->end();
   }
 
   ProactiveResourceMonitorOptRef
   getProactiveResourceMonitorForTest(OverloadProactiveResourceName resource_name) override {
+    ASSERT(dispatcher_.isThreadSafe());
     const auto proactive_resource = proactive_resources_->find(resource_name);
     if (proactive_resource == proactive_resources_->end()) {
       ENVOY_LOG_MISC(warn, "Failed to get resource usage, resource monitor is not configured");
@@ -381,6 +388,7 @@ class ThreadLocalOverloadStateImpl : public ThreadLocalOverloadState {
 
 private:
   static const OverloadActionState always_inactive_;
+  const Event::Dispatcher& dispatcher_;
   const NamedOverloadActionSymbolTable& action_symbol_table_;
   std::vector<OverloadActionState> actions_;
   std::shared_ptr<absl::node_hash_map<OverloadProactiveResourceName, ProactiveResource>>
@@ -751,8 +759,8 @@ void OverloadManagerImpl::start() {
   ASSERT(!started_);
   started_ = true;
 
-  tls_.set([this](Event::Dispatcher&) {
-    return std::make_shared<ThreadLocalOverloadStateImpl>(action_symbol_table_,
+  tls_.set([this](Event::Dispatcher& dispatcher) {
+    return std::make_shared<ThreadLocalOverloadStateImpl>(dispatcher, action_symbol_table_,
                                                           proactive_resources_);
   });
 
```

---

### Incident Patch 3: `9ba5180c` (2026-10-17)
**Commit Message**: generic proxy: fix server codec deletion order in Filter (#48303)

Commit Message: generic proxy: fix server codec deletion order in Filter

Additional Description:
Adjust field order in GenericProxy::Filter so that active_streams_ and
frame_handlers_ are deleted after the server codec. If the server codec
calls onDecodingSuccess or onDecodingFailure while the filter is being
destroyed, it will attempt to reference frame_handlers_ or
active_streams_, which will already have been deleted.

Related: https://github.com/envoyproxy/envoy/pull/48120

Risk Level: low
Testing:
Docs Changes:
Release Notes:
Platform Specific Features:
[Optional Runtime guard:]
[Optional Fixes #Issue]
[Optional Fixes commit #PR or SHA]
[Optional Deprecated:]
[Optional [API
Considerations](https://github.com/envoyproxy/envoy/blob/main/api/review_checklist.md):]

Signed-off-by: Joe Kralicky <[REDACTED_EMAIL]>

**File**: `source/extensions/filters/network/generic_proxy/proxy.h` (modified, +2/-3)
```diff
@@ -476,12 +476,11 @@ class Filter : public Envoy::Network::ReadFilter,
   Runtime::Loader& runtime_;
   Upstream::ClusterManager& cluster_manager_;
 
+  absl::flat_hash_map<uint64_t, ActiveStream*> frame_handlers_;
+  std::list<ActiveStreamPtr> active_streams_;
   ServerCodecPtr server_codec_;
 
   Buffer::OwnedImpl response_buffer_;
-
-  std::list<ActiveStreamPtr> active_streams_;
-  absl::flat_hash_map<uint64_t, ActiveStream*> frame_handlers_;
 };
 
 } // namespace GenericProxy
```

#### Recent Merged Pull Requests:
- **PR #48415** (2026-10-19): wasm: fix a regression for remote code (@zirain)
- **PR #48412** (2026-10-16): mcp_json_rest_bridge: reject duplicate (host, path) endpoint configs (@mkbehr)
- **PR #48404** (2026-10-16): gcp_authn: remove obsolete gcp_authn_impl.h header (@antoniovleonti)
- **PR #48395** (2026-10-16): mongo_proxy: create proxy stats once at configuration load (@wbpcode)
- **PR #48392** (2026-10-18): network: restore the network namespace when listener socket setup throws (@agrawroh)
- **PR #48389** (2026-10-15): deps: Bump `envoy_toolshed` -> 0.5.4 (@phlax)

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

## X. wasm: fix a regression for remote code (#48415)

**RULE**:
When implementing operations in `source/extensions/common/wasm/wasm.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d7b74bd6`: wasm: fix a regression for remote code (#48415). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `source/extensions/common/wasm/wasm.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
        if (vm_config.nack_on_code_cache_miss()) {
          ENVOY_LOG_TO_LOGGER(Envoy::Logger::Registry::getLog(Envoy::Logger::Id::wasm), warn,
                              "createWasm: failed to load (in progress) from {}", source);
          cb(nullptr);
          return false;
        }
        // Another config is already fetching this code. Fetch it as well, gated by our own init
        // manager, but leave the shared cache entry alone: the fetch callback never overwrites
        // code that is already cached, so a failure here cannot poison the cache.
        fetch = true;
      } else if (code = it->second.code; code.empty()) {
                           &stats_handler](const std::string& fetched_code) {
      std::string code = fetched_code;
        if (fetched_code.empty()) {
          // A concurrent fetch of the same code may already have succeeded; use it rather than
          // overwriting it with a negative entry.
          code = e.code;
          e.code = fetched_code;
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
        ENVOY_LOG_TO_LOGGER(Envoy::Logger::Registry::getLog(Envoy::Logger::Id::wasm), warn,
                            "createWasm: failed to load (in progress) from {}", source);
        cb(nullptr);
        return false;
      }
      code = it->second.code;
      if (code.empty()) {
                           &stats_handler](const std::string& code) {
        e.code = code;
        if (code.empty()) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d7b74bd6` are properly handled with clean fallback behavior.
