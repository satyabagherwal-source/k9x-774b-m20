# Forensic Learning Record (Deep Inspection): apple/foundationdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/apple-foundationdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apple/foundationdb](https://github.com/apple/foundationdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:29:11.815Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apple/foundationdb`
- **Description**: FoundationDB - the open source, distributed, transactional key-value store
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 16743 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bindings/__init__.py`
```
#
# __init__.py
#
# This source file is part of the FoundationDB open source project
#
# Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
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
#

```

### Core Architecture Module: `bindings/c/fdb_c.cpp`
```
/*
 * fdb_c.cpp
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "fdbclient/FDBTypes.h"
#include "flow/ProtocolVersion.h"
#include <cstdint>
#define FDB_USE_LATEST_API_VERSION
#define FDB_INCLUDE_LEGACY_TYPES

#include "fdbclient/CommitTransaction.h"
#include "fdbclient/MultiVersionTransaction.h"
#include "fdbclient/MultiVersionAssignmentVars.h"
#include "fdbclient/NativeCdcClient.h"
#include "foundationdb/fdb_c.h"
#include "foundationdb/fdb_c_internal.h"

int g_api_version = 0;

/*
 * Our clients might share these ThreadSafe types between threads. It is therefore
 * unsafe to call addRef on them.
 *
 * type mapping:
 *   FDBFuture -> ThreadSingleAssignmentVarBase
 *   FDBResult -> ThreadSingleAssignmentVarBase
 *   FDBDatabase -> IDatabase
 *   FDBTransaction -> ITransaction
 *   FDBCdcConsumer -> INativeCdcConsumer
 */
#define TSAVB(f) ((ThreadSingleAssignmentVarBase*)(f))
#define TSAV(T, f) ((ThreadSingleAssignmentVar<T>*)(f))

#define DB(d) ((IDatabase*)d)
#define TXN(t) ((ITransaction*)t)
#define NATIVE_CDC_CONSUMER(c) ((INativeCdcConsumer*)c)

// Legacy (pre API version 610)
#define CLUSTER(c) ((char*)c)

/*
 * While we could just use the MultiVersionApi instance directly, this #define allows us to swap in any other IClientApi
 * instance (e.g. from ThreadSafeApi)
 */
#define API ((IClientApi*)MultiVersionApi::api)

/* This must be true so that we can return the data pointer of a
   Standalone<RangeResultRef> as an array of FDBKeyValue. */
static_assert(sizeof(FDBKeyValue) == sizeof(KeyValueRef), "FDBKeyValue / KeyValueRef size mismatch");
static_assert(static_cast<int>(FDB_BG_MUTATION_TYPE_SET_VALUE) == static_cast<int>(MutationRef::Type::SetValue),
              "FDB_BG_MUTATION_TYPE_SET_VALUE enum value mismatch");
static_assert(static_cast<int>(FDB_BG_MUTATION_TYPE_CLEAR_RANGE) == static_cast<int>(MutationRef::Type::ClearRange),
              "FDB_BG_MUTATION_TYPE_CLEAR_RANGE enum value mismatch");

namespace {

// These wrappers own the C-shaped arrays returned by the corresponding future
// getters. The mapped ThreadFuture keeps their arenas alive until the public
// FDBFuture is destroyed or releases its result memory.
struct CNativeCdcStreamInfoArray {
	Arena arena;
	VectorRef<FDBCdcStreamInfo> streams;
};

struct CNativeCdcConsumeResult {
	Arena arena;
	VectorRef<FDBCdcVersionedMutations> mutations;
	Version lastConsumedVersion = invalidVersion;
};

FDBKey copyNativeCdcKey(Arena& arena, KeyRef source) {
	StringRef copy(arena, source);
	return FDBKey{ copy.begin(), copy.size() };
}

FDBKeyRange copyNativeCdcKeyRange(Arena& arena, KeyRangeRef source) {
	StringRef begin(arena, source.begin);
	StringRef end(arena, source.end);
	return FDBKeyRange{ begin.begin(), begin.size(), end.begin(), end.size() };
}

std::vector<Key> copyNativeCdcSplitPoints(FDBKey const* splitPoints, int splitPointCount) {
	if (splitPointCount < 0 || splitPointCount >= NATIVE_CDC_MAX_ORDERED_PARTITIONS ||
	    (splitPointCount > 0 && splitPoints == nullptr)) {
		throw client_invalid_operation();
	}
	std::vector<Key> result;
	result.reserve(splitPointCount);
	for (int i = 0; i < splitPointCount; ++i) {
		const auto& splitPoint = splitPoints[i];
		if (splitPoint.key_length < 0 || (splitPoint.key_length > 0 && splitPoint.key == nullptr)) {
			throw client_invalid_operation();
		}
		result.emplace_back(KeyRef(splitPoint.key, splitPoint.key_length));
	}
	return result;
}

std::vector<KeyRange> copyNativeCdcRanges(FDBKeyRange const* ranges, int rangeCount) {
	if (rangeCount <= 0 || rangeCount > NATIVE_CDC_MAX_RANGES || ranges == nullptr) {
		throw client_invalid_operation();
	}
	std::vector<KeyRange> result;
	result.reserve(rangeCount);
	for (int i = 0; i < rangeCount; ++i) {
		auto const& range = ranges[i];
		if (range.begin_key_length < 0 || range.end_key_length < 0 ||
		    (range.begin_key_length > 0 && range.begin_key == nullptr) ||
		    (range.end_key_length > 0 && range.end_key == nullptr)) {
			throw client_invalid_operation();
		}
		KeyRef begin(range.begin_key, range.begin_key_length);
		KeyRef end(range.end_key, range.end_key_length);
		if (begin >= end) {
			throw client_invalid_operation();
		}
		result.emplace_back(KeyRangeRef(begin, end));
	}
	return result;
}

CNativeCdcStreamInfoArray makeCNativeCdcStreamInfoArray(std::vector<NativeCdcStreamInfo> const& source) {
	CNativeCdcStreamInfoArray result;
	result.streams.reserve(result.arena, source.size());
	for (auto const& stream : source) {
		FDBCdcStreamInfo cStream;
		cStream.name = copyNativeCdcKey(result.arena, stream.name);
		cStream.stream_id = stream.streamId;
		cStream.range_count = stream.ranges.size();
		auto* ranges = new (result.arena) FDBKeyRange[stream.ranges.size()];
		for (int i = 0; i < cStream.range_count; ++i) {
			ranges[i] = copyNativeCdcKeyRange(result.arena, stream.ranges[i]);
		}
		cStream.ranges = ranges;
		cStream.min_version = stream.minVersion;
		result.streams.push_back(result.arena, cStream);
	}
	return result;
}

CNativeCdcConsumeResult makeCNativeCdcConsumeResult(NativeCdcConsumeResult const& source) {
	CNativeCdcConsumeResult result;
	result.lastConsumedVersion = source.cursor.lastConsumedVersion;
	result.mutations.reserve(result.arena, source.mutations.size());
	for (auto const& versioned : source.mutations) {
		FDBCdcVersionedMutations cVersioned;
		cVersioned.version = versioned.version;
		cVersioned.mutation_count = versioned.mutations.size();
		cVersioned.mutations = nullptr;
		if (!versioned.mutations.empty()) {
			auto* cMutations = new (result.arena) FDBCdcMutation[versioned.mutations.size()];
			for (int i = 0; i < versioned.mutations.size(); ++i) {
				auto const& mutation = versioned.mutations[i];
				StringRef param1(result.arena, mutation.param1);
				StringRef param2(result.arena, mutation.param2);
				cMutations[i] =
				    FDBCdcMutation{ mutation.type, param1.begin(), param1.size(), param2.begin(), param2.size() };
			}
			cVersioned.mutations = cMutations;
		}
		result.mutations.push_back(result.arena, cVersioned);
	}
	return result;
}

FDBFuture* mapNativeCdcStreamInfoFuture(ThreadFuture<std::vector<NativeCdcStreamInfo>> source) {
	auto result = mapThreadFuture<std::vector<NativeCdcStreamInfo>, CNativeCdcStreamInfoArray>(
	    source, [](ErrorOr<std::vector<NativeCdcStreamInfo>> source) -> ErrorOr<CNativeCdcStreamInfoArray> {
		    if (source.isError()) {
			    return ErrorOr<CNativeCdcStreamInfoArray>(source.getError());
		    }
		    return makeCNativeCdcStreamInfoArray(source.get());
	    });
	return (FDBFuture*)result.extractPtr();
}

FDBFuture* mapNativeCdcConsumeFuture(ThreadFuture<NativeCdcConsumeResult> source) {
	auto result = mapThreadFuture<NativeCdcConsumeResult, CNativeCdcConsumeResult>(
	    source, [](ErrorOr<NativeCdcConsumeResult> source) -> ErrorOr<CNativeCdcConsumeResult> {
		    if (source.isError()) {
			    return ErrorOr<CNativeCdcConsumeResult>(source.getError());
		    }
		    return makeCNativeCdcConsumeResult(source.get());
	    });
	return (FDBFuture*)result.extractPtr();
}

} // namespace

#define TSAV_ERROR(type, error) ((FDBFuture*)(ThreadFuture<type>(error())).extractPtr())

extern "C" DLLEXPORT const char* fdb_get_error(fdb_error_t code) {
	return Error::fromUnvalidatedCode(code).what();
}

extern "C" DLLEXPORT fdb_bool_t fdb_error_predicate(int predicate_test, fdb_e
```

### Core Architecture Module: `bindings/c/fdb_c_shim.cpp`
```
/*
 * fdb_c_shim.cpp
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#if (defined(__linux__) || defined(__APPLE__) || defined(__FreeBSD__))

#define DLLEXPORT __attribute__((visibility("default")))

#include "foundationdb/fdb_c_shim.h"

#include <dlfcn.h>
#include <string>

namespace {

const char* FDB_LOCAL_CLIENT_LIBRARY_PATH_ENVVAR = "FDB_LOCAL_CLIENT_LIBRARY_PATH";
std::string g_fdbLocalClientLibraryPath;

} // namespace

extern "C" DLLEXPORT void fdb_shim_set_local_client_library_path(const char* filePath) {
	g_fdbLocalClientLibraryPath = filePath;
}

/* The callback of the fdb_c_shim layer that determines the path
   of the fdb_c library to be dynamically loaded
 */
extern "C" void* fdb_shim_dlopen_callback(const char* libName) {
	std::string libPath;
	if (!g_fdbLocalClientLibraryPath.empty()) {
		libPath = g_fdbLocalClientLibraryPath;
	} else {
		char* val = getenv(FDB_LOCAL_CLIENT_LIBRARY_PATH_ENVVAR);
		if (val) {
			libPath = val;
		} else {
			libPath = libName;
		}
	}
	return dlopen(libPath.c_str(), RTLD_LAZY | RTLD_GLOBAL);
}

#else
#error Port me!
#endif

```

### Core Architecture Module: `bindings/c/foundationdb/CWorkload.h`
```
/*
 * CWorkload.h
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once
#ifndef C_WORKLOAD_H
#define C_WORKLOAD_H

#include <stdint.h>
#include <stdbool.h>

#define FDB_WORKLOAD_API_VERSION 1

typedef struct FDB_future FDBFuture;
typedef struct FDB_database FDBDatabase;

typedef struct Opaque_promise OpaquePromise;
typedef struct Opaque_workload OpaqueWorkload;
typedef struct Opaque_workloadContext OpaqueWorkloadContext;
typedef struct Opaque_metrics OpaqueMetrics;

// Pure C bindings, equivalent to the C++ bindings in `CppWorkload.h`
// documented here: https://apple.github.io/foundationdb/client-testing.html.

// API changes may add pointers at the end of the virtual tables (_VT)
// It is advised to never dereference or copy these structures, only using them through a pointer.

// Log severity levels.
// FDBSeverity_Error automatically stops the simulation.
typedef enum FDBSeverity {
	FDBSeverity_Debug,
	FDBSeverity_Info,
	FDBSeverity_Warn,
	FDBSeverity_WarnAlways,
	FDBSeverity_Error,
} FDBSeverity;

// Key-value pair for logging additional details.
typedef struct FDBStringPair {
	const char* key;
	const char* val;
} FDBStringPair;

// Metric entry for simulation statistics.
// Values are either averaged or summed across clients based on the `avg` flag.
// `fmt` is used to format the value, defaults to "%.3g" if null.
typedef struct FDBMetric {
	const char* key;
	const char* fmt;
	double val;
	bool avg;
} FDBMetric;

// Wrapper around an owned C++ `string`.
// The `free` function must be called on `inner` before releasing the string.
typedef struct FDBString {
	const char* inner;
	struct FDBString_VT {
		void (*free)(const char* inner);
	}* vt;
} FDBString;

// Wrapper around a borrowed C++ `vector<FDBMetric>`.
typedef struct FDBMetrics {
	OpaqueMetrics* inner;
	struct FDBMetrics_VT {
		void (*reserve)(OpaqueMetrics* inner, int n);
		void (*push)(OpaqueMetrics* inner, FDBMetric val);
	}* vt;
} FDBMetrics;

// Wrapper around an owned C++ `GenericPromise<bool>`.
// Calling `send` resolves the promise (the value is meaningless).
// Calling `free` before resolving the promise triggers a "broken promise" error.
typedef struct FDBPromise {
	OpaquePromise* inner;
	struct FDBPromise_VT {
		void (*free)(OpaquePromise* inner);
		void (*send)(OpaquePromise* inner, bool val);
	}* vt;
} FDBPromise;

// Wrapper around a borrowed `ExternalWorkload`'s context.
// All pointer-based arguments are borrowed and managed by the workload.
typedef struct FDBWorkloadContext {
	int api_version;
	OpaqueWorkloadContext* inner;
	struct FDBWorkloadContext_VT {
		// Log a message with severity and optional details.
		// `details` is an array of key-value pairs, and `n` specifies the array size.
		void (*trace)(OpaqueWorkloadContext* inner,
		              FDBSeverity sev,
		              const char* name,
		              const FDBStringPair* details,
		              int n);
		uint64_t (*getProcessID)(OpaqueWorkloadContext* inner);
		void (*setProcessID)(OpaqueWorkloadContext* inner, uint64_t processID);
		// Return the current simulated time in seconds (starts at zero).
		double (*now)(OpaqueWorkloadContext* inner);
		// Return a random number (different each time and for all clients).
		uint32_t (*rnd)(OpaqueWorkloadContext* inner);
		// Return an option by name, returning `defaultValue` if the option is not found.
		// Return an option, consumming it, querying it again returns the empty string.
		FDBString (*getOption)(OpaqueWorkloadContext* inner, const char* name, const char* defaultValue);
		int (*clientId)(OpaqueWorkloadContext* inner);
		int (*clientCount)(OpaqueWorkloadContext* inner);
		// Return a random seed (same each time and for all clients).
		int64_t (*sharedRandomNumber)(OpaqueWorkloadContext* inner);
		// Return a future that will be ready after a given time. This internally uses TaskPriority::DefaultDelay.
		FDBFuture* (*delay)(OpaqueWorkloadContext* inner, double seconds);
	}* vt;
} FDBWorkloadContext;

// Interface for a workload implementation in C.
//
// Simulation stages (setup, start, and check) are executed sequentially.
// A stage finishes when its associated promise is resolved. If a promise
// is not resolved or freed, the simulation hangs.
//
// Workload functions should not block. If an operation must wait for database interaction,
// it should initiate the action, register a callback, and return.
typedef struct FDBWorkload {
	int api_version;
	OpaqueWorkload* inner;
	struct FDBWorkload_VT {
		void (*free)(OpaqueWorkload* inner);
		void (*setup)(OpaqueWorkload* inner, FDBDatabase* db, FDBPromise done);
		void (*start)(OpaqueWorkload* inner, FDBDatabase* db, FDBPromise done);
		void (*check)(OpaqueWorkload* inner, FDBDatabase* db, FDBPromise done);
		void (*getMetrics)(OpaqueWorkload* inner, FDBMetrics out);
		// The timeout in simulated seconds for the check stage
		double (*getCheckTimeout)(OpaqueWorkload* inner);
	}* vt;
} FDBWorkload;

// The C workload entrypoint.
// This function must return a valid instance of the `FDBWorkload` struct.
// A specific implementation can be chosen based on the name passed.
// The client C workload must be allocated, initialized and passed as pointer
// in `inner`. It is advised to store the context alongside the workload as
// it can't be retrieved later. No function pointer can be left null.
FDBWorkload workloadCFactory(const char* name, FDBWorkloadContext context);

#endif

```

### Core Architecture Module: `bindings/c/foundationdb/CppWorkload.h`
```
/*
 * CppWorkload.h
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once
#ifndef CPP_WORKLOAD_H
#define CPP_WORKLOAD_H
#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <type_traits>

#ifndef DLLEXPORT
#if defined(_MSC_VER)
#define DLLEXPORT __declspec(dllexport)
#elif defined(__GNUG__)
#define DLLEXPORT __attribute__((visibility("default")))
#else
#error Missing symbol export
#endif
#endif

struct FDB_future;
struct FDB_result;
struct FDB_database;
struct FDB_transaction;
using FDBFuture = FDB_future;
using FDBResult = FDB_result;
using FDBDatabase = FDB_database;
using FDBTransaction = FDB_transaction;

enum class FDBSeverity { Debug, Info, Warn, WarnAlways, Error };

class FDBLogger {
public:
	virtual void trace(FDBSeverity sev,
	                   const std::string& name,
	                   const std::vector<std::pair<std::string, std::string>>& details) = 0;
};

class FDBWorkloadContext : public FDBLogger {
public:
	virtual uint64_t getProcessID() const = 0;
	virtual void setProcessID(uint64_t processID) = 0;
	virtual double now() const = 0;
	virtual uint32_t rnd() const = 0;
	virtual bool getOption(const std::string& name, bool defaultValue) = 0;
	virtual long getOption(const std::string& name, long defaultValue) = 0;
	virtual unsigned long getOption(const std::string& name, unsigned long defaultValue) = 0;
	virtual double getOption(const std::string& name, double defaultValue) = 0;
	virtual std::string getOption(const std::string& name, std::string defaultValue) = 0;
	virtual int clientId() const = 0;
	virtual int clientCount() const = 0;
	virtual int64_t sharedRandomNumber() const = 0;
	virtual FDBFuture* delay(double seconds) const = 0;
};

struct FDBPromise {
	virtual ~FDBPromise() = default;
	virtual void send(void*) = 0;
};

template <class T>
class GenericPromise {
	std::shared_ptr<FDBPromise> impl;

public:
	template <class Ptr,
	          typename std::enable_if<std::is_constructible<std::shared_ptr<FDBPromise>, Ptr&&>::value, int>::type = 0>
	explicit GenericPromise(Ptr&& impl) : impl(std::forward<Ptr>(impl)) {}
	void send(T val) { impl->send(&val); }
};

struct FDBPerfMetric {
	std::string name;
	double value;
	bool averaged;
	std::string format_code = "%.3g";
};

class DLLEXPORT FDBWorkload {
public:
	// virtual std::string description() const = 0;
	virtual bool init(FDBWorkloadContext* context) = 0;
	virtual void setup(FDBDatabase* db, GenericPromise<bool> done) = 0;
	virtual void start(FDBDatabase* db, GenericPromise<bool> done) = 0;
	virtual void check(FDBDatabase* db, GenericPromise<bool> done) = 0;
	virtual void getMetrics(std::vector<FDBPerfMetric>& out) const = 0;
	virtual double getCheckTimeout() { return 3000; }
};

class DLLEXPORT FDBWorkloadFactory {
public:
	virtual std::shared_ptr<FDBWorkload> create(const std::string& name) = 0;
};

#endif

```

### Core Architecture Module: `bindings/c/foundationdb/fdb_c.h`
```
/*
 * fdb_c.h
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef FDB_C_H
#define FDB_C_H
#pragma once

#ifndef DLLEXPORT
#define DLLEXPORT
#endif

#include "fdb_c_apiversion.g.h"
#if (defined FDB_USE_LATEST_API_VERSION)
#define FDB_API_VERSION FDB_LATEST_API_VERSION
#elif (defined FDB_USE_LATEST_BINDINGS_API_VERSION)
#define FDB_API_VERSION FDB_LATEST_BINDINGS_API_VERSION
#endif

#if !defined(FDB_API_VERSION)
#error You must #define FDB_API_VERSION prior to including fdb_c.h (the latest version is defined as FDB_LATEST_API_VERSION)
#elif FDB_API_VERSION < 13
#error API version no longer supported (upgrade to 13)
#elif FDB_API_VERSION > FDB_LATEST_API_VERSION
#error Requested API version requires a newer version of this header
#endif

#if FDB_API_VERSION >= 23 && !defined(WARN_UNUSED_RESULT)
#ifdef __GNUG__
#define WARN_UNUSED_RESULT __attribute__((warn_unused_result))
#else
#define WARN_UNUSED_RESULT
#endif
#else
#define WARN_UNUSED_RESULT
#endif

/*
 * With default settings, gcc will not warn about unprototyped functions being
 * called, so it is easy to erroneously call a function which is not available
 * at FDB_API_VERSION and then get an error only at runtime.  These macros
 * ensure a compile error in such cases, and attempt to make the compile error
 * slightly informative.
 */
#define This_FoundationDB_API_function_is_removed_at_this_FDB_API_VERSION() { == == = }
#define FDB_REMOVED_FUNCTION This_FoundationDB_API_function_is_removed_at_this_FDB_API_VERSION(0)

#include <stdint.h>

#include "fdb_c_options.g.h"
#include "fdb_c_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Keep typedef syntax in this public C header. */

DLLEXPORT const char* fdb_get_error(fdb_error_t code);

DLLEXPORT fdb_bool_t fdb_error_predicate(int predicate_test, fdb_error_t code);

#define /* fdb_error_t */ fdb_select_api_version(v) fdb_select_api_version_impl(v, FDB_API_VERSION)

/*
 * A variant of fdb_select_api_version that caps the header API version by the maximum API version
 * supported by the client library. It is intended mainly for use in combination with the shim
 * layer, which loads the client library dynamically.
 */
#define /* fdb_error_t */ fdb_select_api_version_capped(v)                                                             \
	fdb_select_api_version_impl(                                                                                       \
	    v, FDB_API_VERSION < fdb_get_max_api_version() ? FDB_API_VERSION : fdb_get_max_api_version())

DLLEXPORT WARN_UNUSED_RESULT fdb_error_t fdb_network_set_option(FDBNetworkOption option,
                                                                uint8_t const* value,
                                                                int value_length);

#if FDB_API_VERSION >= 14
DLLEXPORT WARN_UNUSED_RESULT fdb_error_t fdb_setup_network(void);
#endif

DLLEXPORT WARN_UNUSED_RESULT fdb_error_t fdb_run_network(void);

DLLEXPORT WARN_UNUSED_RESULT fdb_error_t fdb_stop_network(void);

DLLEXPORT WARN_UNUSED_RESULT fdb_error_t fdb_add_network_thread_completion_hook(void (*hook)(void*),
                                                                                void* hook_parameter);

#pragma pack(push, 4)
typedef struct key {
	const uint8_t* key;
	int key_length;
} FDBKey;
#if FDB_API_VERSION >= 630
typedef struct keyvalue {
	const uint8_t* key;
	int key_length;
	const uint8_t* value;
	int value_length;
} FDBKeyValue;
#else
typedef struct keyvalue {
	const void* key;
	int key_length;
	const void* value;
	int value_length;
} FDBKeyValue;
#endif

#pragma pack(pop)

/* Memory layout of KeySelectorRef. */
typedef struct keyselector {
	FDBKey key;
	/* orEqual and offset have not be tested in C binding. Just a placeholder. */
	fdb_bool_t orEqual;
	int offset;
} FDBKeySelector;

/* Memory layout of GetRangeReqAndResultRef. */
typedef struct getrangereqandresult {
	FDBKeySelector begin;
	FDBKeySelector end;
	FDBKeyValue* data;
	int m_size, m_capacity;
} FDBGetRangeReqAndResult;

/* Memory layout of MappedKeyValueRef.

Total 112 bytes
- key (12 bytes)
:74:8F:8E:5F:AE:7F:00:00
:4A:00:00:00
- value (12 bytes)
:70:8F:8E:5F:AE:7F:00:00
:00:00:00:00
- begin selector (20 bytes)
:30:8F:8E:5F:AE:7F:00:00
:2D:00:00:00
:00:7F:00:00
:01:00:00:00
- end selector (20 bytes)
:EC:8E:8E:5F:AE:7F:00:00
:2D:00:00:00
:00:2B:3C:60
:01:00:00:00
- vector (16 bytes)
:74:94:8E:5F:AE:7F:00:00
:01:00:00:00
:01:00:00:00
- buffer (32 bytes)
:00:20:D1:61:00:00:00:00
:00:00:00:00:00:00:00:00
:00:00:00:00:00:00:00:00
:01:00:00:00:AE:7F:00:00
*/
typedef struct mappedkeyvalue {
	FDBKey key;
	FDBKey value;
	/* It's complicated to map a std::variant to C. For now we assume the underlying requests are always getRange and
	 * take the shortcut. */
	FDBGetRangeReqAndResult getRange;
	unsigned char buffer[32];
} FDBMappedKeyValue;

#pragma pack(push, 4)
typedef struct keyrange {
	const uint8_t* begin_key;
	int begin_key_length;
	const uint8_t* end_key;
	int end_key_length;
} FDBKeyRange;

/*
 * Raw mutation types returned by CDC. The numeric values match
 * MutationRef::Type and, for atomic operations, FDBMutationType.
 */
typedef enum {
	FDB_CDC_MUTATION_TYPE_SET_VALUE = 0,
	FDB_CDC_MUTATION_TYPE_CLEAR_RANGE = 1,
	FDB_CDC_MUTATION_TYPE_ADD = 2,
	FDB_CDC_MUTATION_TYPE_AND = 6,
	FDB_CDC_MUTATION_TYPE_OR = 7,
	FDB_CDC_MUTATION_TYPE_XOR = 8,
	FDB_CDC_MUTATION_TYPE_APPEND_IF_FITS = 9,
	FDB_CDC_MUTATION_TYPE_MAX = 12,
	FDB_CDC_MUTATION_TYPE_MIN = 13,
	FDB_CDC_MUTATION_TYPE_SET_VERSIONSTAMPED_KEY = 14,
	FDB_CDC_MUTATION_TYPE_SET_VERSIONSTAMPED_VALUE = 15,
	FDB_CDC_MUTATION_TYPE_BYTE_MIN = 16,
	FDB_CDC_MUTATION_TYPE_BYTE_MAX = 17,
	FDB_CDC_MUTATION_TYPE_MIN_V2 = 18,
	FDB_CDC_MUTATION_TYPE_AND_V2 = 19,
	FDB_CDC_MUTATION_TYPE_COMPARE_AND_CLEAR = 20
} FDBCdcMutationType;

typedef struct cdc_stream_info {
	FDBKey name;
	uint64_t stream_id;
	const FDBKeyRange* ranges;
	int range_count;
	int64_t min_version;
} FDBCdcStreamInfo;

typedef struct cdc_mutation {
	/* FDBCdcMutationType */ uint8_t type;
	const uint8_t* param1;
	int param1_length;
	const uint8_t* param2;
	int param2_length;
} FDBCdcMutation;

typedef struct cdc_versioned_mutations {
	int64_t version;
	const FDBCdcMutation* mutations;
	int mutation_count;
} FDBCdcVersionedMutations;

/*
 * TODO: delete the following "blob granule" and "tenant" related data types
 * when we are sure it's safe to do so.
 *
 * These features were always experimental and have now been removed, so probably
 * the data structures can be done away with also for the FDB 8.0.0 release.
 */
typedef struct granulesummary {
	FDBKeyRange key_range;
	int64_t snapshot_version;
	int64_t snapshot_size;
	int64_t delta_version;
	int64_t delta_size;
} FDBGranuleSummary;

#pragma pack(pop)

typedef struct readgranulecontext {
	/* User context to pass along to functions */
	void* userContext;

	/* Returns a unique id for the load. Asynchronous to support queueing multiple in parallel. */
	int64_t (*start_load_f)(const char* filename,
	                        int filenameLength,
	                        int64_t offset,
	                        int64_t length,
	                        int64_t fullFileLength,
	                        void* context);

	/* Returns data for the load. Pass the loadId returned by start_load_f */
	uint8_t* (*get_load_f)(int64_t loadId, void* context);

	/* Frees dat
```

### Core Architecture Module: `bindings/c/foundationdb/fdb_c_internal.h`
```
/*
 * fdb_c_internal.h
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef FDB_C_INTERNAL_H
#define FDB_C_INTERNAL_H
#include "flow/ProtocolVersion.h"
#pragma once

#ifndef DLLEXPORT
#define DLLEXPORT
#endif

#ifndef WARN_UNUSED_RESULT
#define WARN_UNUSED_RESULT
#endif

#include "fdb_c_types.h"

#ifdef __cplusplus
extern "C" {
#endif

// Keep typedef syntax because this header is shared with C API implementation code.
typedef struct DatabaseSharedState DatabaseSharedState;

DLLEXPORT FDBFuture* fdb_database_create_shared_state(FDBDatabase* db);

DLLEXPORT void fdb_database_set_shared_state(FDBDatabase* db, DatabaseSharedState* p);

DLLEXPORT WARN_UNUSED_RESULT fdb_error_t fdb_future_get_shared_state(FDBFuture* f, DatabaseSharedState** outPtr);

DLLEXPORT void fdb_use_future_protocol_version();

#ifdef __cplusplus
}
#endif
#endif

```

### Core Architecture Module: `bindings/c/foundationdb/fdb_c_shim.h`
```
/*
 * fdb_shim_c.h
 *
 * This source file is part of the FoundationDB open source project
 *
 * Copyright 2013-2026 Apple Inc. and the FoundationDB project authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef FDB_SHIM_C_H
#define FDB_SHIM_C_H
#pragma once

#ifndef DLLEXPORT
#define DLLEXPORT
#endif

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Specify the path of the local libfdb_c.so library to be dynamically loaded by the shim layer
 *
 * This enables running the same application code with different client library versions,
 * e.g. using the latest development build for testing new features, but still using the latest
 * stable release in production deployments.
 *
 * The given path overrides the environment variable FDB_LOCAL_CLIENT_LIBRARY_PATH
 */
DLLEXPORT void fdb_shim_set_local_client_library_path(const char* filePath);

#ifdef __cplusplus
}
#endif
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12037** (2025-03-17): **Fix a restore bug due to a race**
  *Symptoms*: Found by simulation: seed:  -f tests/slow/ApiCorrectnessAtomicRestore.toml -s 177856328 -b on Commit: 51ad8428e0fbe1d82bc76cf42b1579f51ecf2773 Compiler: clang++ Env: Rhel9 okteto  applyMutations() has processed version 801400000-803141392, and before calling sendCommitTransactionRequest(), which was going to update apply begin version to 803141392. But DID NOT wait for the transaction commit.  Then there is an update on the apply end version to 845345760, which picks up the PREVIOUS apply begin version 801400000. Thus started another applyMutation() with version range 801400000-845345760. Note because previous applyMutation() has finished and didn't wait for the transaction commit, thus the starting version is wrong. As a result, this applyMutation() re-processed version range 801400000-803141392.  The test failed during re-processing, because mutations are missing for the overlapped range.  The fix is to wait for the transaction to commit in sendCommitTransactionRequest().  This bug probably affects DR as well.  See rdar://146877552  20250317-162835-jzhou-ff4c4d6d7c51bfed             compressed=True data_size=35839754 duration=5691175 ended=100000 fail_fast=10 max_runs=100000 pass=100000 priority=100 remaining=0 runtime=1:04:00 sanity=False started=100000 stopped=20250317-173235 submitted=20250317-162835 timeout=5400 username=jzhou   # Code-Reviewer Section  The general pull request guidelines can be found [here](https://github.com/apple/foundationdb/wi
  **Post-Mortem & Fix Analysis**:
  >  ### Result of foundationdb-pr-clang-ide on Linux CentOS 7  * Commit ID: c0c66e624d9fc143469e26b29e3a704b09a258d9 * Duration 0:22:23 * Result: :white_check_mark: **SUCCEEDED** * Error: `N/A` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-clang-ide/8fcb2320-95f2-4a25-a6cf-be05a9116a6e.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb-pr-clang-ide/8fcb2320-95f2-4a25-a6cf-be05a9116a6e/workspace.zip) zip file of the working directory (available for 30 days) 
  >  ### Result of foundationdb-pr-macos-m1 on macOS Ventura 13.x  * Commit ID: c0c66e624d9fc143469e26b29e3a704b09a258d9 * Duration 0:41:05 * Result: :white_check_mark: **SUCCEEDED** * Error: `N/A` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-macos-m1/c37c5599-2285-4ca8-a0ec-53ac8be57442.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb-pr-macos-m1/c37c5599-2285-4ca8-a0ec-53ac8be57442/workspace.zip) zip file of the working directory (available for 30 days) 
  >  ### Result of foundationdb-pr-clang-arm on Linux CentOS 7  * Commit ID: c0c66e624d9fc143469e26b29e3a704b09a258d9 * Duration 0:49:06 * Result: :white_check_mark: **SUCCEEDED** * Error: `N/A` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-clang-arm/c02305d0-166b-40e3-8703-5b2aecdc7c90.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb-pr-clang-arm/c02305d0-166b-40e3-8703-5b2aecdc7c90/workspace.zip) zip file of the working directory (available for 30 days) 

- **Issue #11775** (2024-12-02): **fdbmonitor restart-delay unclear documentation**
  *Symptoms*: fdbmonitor has a field [restart-delay](https://apple.github.io/foundationdb/configuration.html#general-section). Based on the documentation: `The maximum number of seconds (subject to jitter) that fdbmonitor will delay before restarting a failed process.`. I would assume that `failed process` means a process that exits with an exit code other than 0. But the actual implementation doesn't look at the exit code: https://github.com/apple/foundationdb/blob/main/fdbmonitor/fdbmonitor.h#L395-L405 + https://github.com/apple/foundationdb/blob/main/fdbmonitor/fdbmonitor.cpp#L646. So we either have to correct the documentation or fix the behaviour in fdbmonitor.   I saw this when I looked into https://github.com/apple/foundationdb/issues/11764.
  **Post-Mortem & Fix Analysis**:
  > CC @spraza 
  > I don't have a strong opinion on either but I think using the exit code and only delaying processes that have an exit code different than  0 should be delayed. My understanding of this setting is to prevent a process to crash loop directly in a short amount of time.
  > For completeness: In the fdb-kubernetes-monitor we are only delaying the restart when the process exit code was not `0`: https://github.com/apple/foundationdb/blob/main/fdbkubernetesmonitor/monitor.go#L453-L459

- **Issue #11222** (2024-03-05): **Using DNS entries in cluster file can cause SIGSEV**
  *Symptoms*: As part of this PR: https://github.com/FoundationDB/fdb-kubernetes-operator/pull/1932 I was looking into a failure that looked like a race condition on the first glance but it's not. When I run the same test without using DNS entries everything behaves correct. I can reproduce this issue with the following steps:  1. Create a cluster that uses DNS entries in the cluster file 2. Stop the operator 3. Delete all Pods of the cluster 4. Restart the operator  Now the operator is in a crash loop and cannot recover. It seems the issue is that none of the DNS entries can be resolved, which causes the following line to throw an error: https://github.com/apple/foundationdb/blob/release-7.1/fdbclient/AutoPublicAddress.cpp#L51. The method is called in the `createDatabase` method of the NativeAPI: https://github.com/apple/foundationdb/blob/release-7.1/fdbclient/NativeAPI.actor.cpp#L2213. In the go bindings the createDatabase is called here: https://github.com/apple/foundationdb/blob/release-7.1/bindings/go/src/fdb/fdb.go#L332-L338 but it seems like the error is not correctly passed up all layers.  I only checked the go bindings for this error, but it might be the case that other bindings are also affected.  Stack trace:  ```text Error determining public address. fatal error: unexpected signal during runtime execution Error determining public address. [signal SIGSEGV: segmentation violation code=0x1 addr=0x40 pc=0x7f8c78ded03a]   goroutine 338 [syscall]: runtime.cgocall
  **Post-Mortem & Fix Analysis**:
  > I did a bit more debugging and it seems like the error code is not returned by the create database method and instead of a nil/null pointer an empty struct is returned, logged the value of `outdb` before and after the `fdb_create_database` method was called.  ```text Before fdb_create_database outdb: <nil> After fdb_create_database outdb: &{{{}}} error 0 ```  I have to make some changes to the code next week as I currently don't have any trace events as the code throws the error before creating the trace file here: https://github.com/apple/foundationdb/blob/release-7.1/fdbclient/NativeAPI.actor.cpp#L2213. It seems like the error is swallowed here: https://github.com/apple/foundationdb/blob/release-7.1/fdbclient/ThreadSafeTransaction.cpp#L145-L164
  > > If you observed an issue and used DNS entries in the cluster file you might have hit: [apple/foundationdb#11222](https://github.com/apple/foundationdb/issues/11222). Especially in the case when the coordinators are not reachable.  Commenting in reply from https://github.com/FoundationDB/fdb-kubernetes-operator/pull/1949#issuecomment-1963836243 The issue was happening also without the DNS names feature, and even when using a single-process in-memory FDB. It is fairly reproducible on my end; I mitigated it by adding logic to use a wait group to track all the `C.fdb_run_network()` goroutines created, and then in the Go finalizer for the client connection wait for such wait group after calling `C.fdb_stop_network()`, but I do not exclude that better/more elegant solutions can be found.
  > > > If you observed an issue and used DNS entries in the cluster file you might have hit: [apple/foundationdb#11222](https://github.com/apple/foundationdb/issues/11222). Especially in the case when the coordinators are not reachable. >  > Commenting in reply from [FoundationDB/fdb-kubernetes-operator#1949 (comment)](https://github.com/FoundationDB/fdb-kubernetes-operator/pull/1949#issuecomment-1963836243) The issue was happening also without the DNS names feature, and even when using a single-process in-memory FDB. It is fairly reproducible on my end; I mitigated it by adding logic to use a wait group to track all the `C.fdb_run_network()` goroutines created, and then in the Go finalizer for the client connection wait for such wait group after calling `C.fdb_stop_network()`, but I do not exclude that better/more elegant solutions can be found.  Do you mind to share the code? From what I see `fdb_stop_network` is not actively called in the FBD go bindings.

- **Issue #11151** (2024-01-30): **Fix a minor compile issue (release-7.1)**
  *Symptoms*: Fix the compile problem in release-7.1  # Code-Reviewer Section  The general pull request guidelines can be found [here](https://github.com/apple/foundationdb/wiki/FoundationDB-Commit-Process).  Please check each of the following things and check *all* boxes before accepting a PR.  - [ ] The PR has a description, explaining both the problem and the solution. - [ ] The description mentions which forms of testing were done and the testing seems reasonable. - [ ] Every function/class/actor that was touched is reasonably well documented.  ## For Release-Branches  If this PR is made against a release-branch, please also check the following:  - [ ] This change/bugfix is a cherry-pick from the next younger branch (younger `release-branch` or `main` if this is the youngest branch) - [ ] There is a good reason why this PR needs to go into a release branch and this reason is documented (either in the description above or in a linked GitHub issue) 
  **Post-Mortem & Fix Analysis**:
  >  ### Result of foundationdb-pr-cluster-tests on Linux CentOS 7  * Commit ID: da7e5ef063993814b550271c20cdb875d515c00e * Duration 0:07:57 * Result: :x: **FAILED** * Error: `Error while executing command: ninja -v -C build_output -j ${NPROC} all packages strip_targets. Reason: exit status 1` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-cluster-tests/25fe3e29-64ae-484d-bcdb-4756a9f3848b.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/error.html) zip file of the working directory (available for 30 days) * [Cluster Test Logs](https://d1e0l78xbkh3xa.cloudfront.net/error.html) zip file of the test logs (available for 30 days) 
  >  ### Result of foundationdb-pr on Linux CentOS 7  * Commit ID: da7e5ef063993814b550271c20cdb875d515c00e * Duration 0:08:13 * Result: :x: **FAILED** * Error: `Error while executing command: ninja -v -C build_output -j ${NPROC} all packages strip_targets. Reason: exit status 1` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr/be9b7c60-718b-4c77-b48a-d7062459577e.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb-pr/be9b7c60-718b-4c77-b48a-d7062459577e/workspace.zip) zip file of the working directory (available for 30 days) 
  >  ### Result of foundationdb-pr-macos-m1 on macOS Ventura 13.x  * Commit ID: da7e5ef063993814b550271c20cdb875d515c00e * Duration 0:16:09 * Result: :x: **FAILED** * Error: `Error while executing command: ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${HOME}/.ssh_key ec2-user@${MAC_EC2_HOST} /opt/homebrew/bin/bash --login -c ./build_pr_macos.sh. Reason: exit status 1` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-macos-m1/975f6ea2-e71c-4cbf-9841-dc612e145e6a.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/error.html) zip file of the working directory (available for 30 days) 

- **Issue #10736** (2023-08-07): **Fix the go tuple tests for new go version**
  *Symptoms*: Recently we updated the default go version in the builder image to go 1.20.6. In go 1.20 there was a change that the random generator from the math package will automatically be seeded: https://pkg.go.dev/math/rand@go1.20.7#Seed. This breaks the current go tuple tests for numerics, as those tests make use of the random generator.  In general I'm not sure how useful the random number generator is for those tests, given that we compare against a static set of values and there a specific seed is required.  # Code-Reviewer Section  The general pull request guidelines can be found [here](https://github.com/apple/foundationdb/wiki/FoundationDB-Commit-Process).  Please check each of the following things and check *all* boxes before accepting a PR.  - [x] The PR has a description, explaining both the problem and the solution. - [x] The description mentions which forms of testing were done and the testing seems reasonable. - [x] Every function/class/actor that was touched is reasonably well documented.  ## For Release-Branches  If this PR is made against a release-branch, please also check the following:  - [ ] This change/bugfix is a cherry-pick from the next younger branch (younger `release-branch` or `main` if this is the youngest branch) - [ ] There is a good reason why this PR needs to go into a release branch and this reason is documented (either in the description above or in a linked GitHub issue) 
  **Post-Mortem & Fix Analysis**:
  >  ### Result of foundationdb-pr-macos on macOS Ventura 13.x  * Commit ID: c9a04d799d08d62cf969c83731db42be8e7d2b9c * Duration 0:05:43 * Result: :x: **FAILED** * Error: `Error while executing command: ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${HOME}/.ssh_key ec2-user@${MAC_EC2_HOST} /usr/local/bin/bash --login -c ./build_pr_macos.sh. Reason: exit status 1` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-macos/d3148dd9-8dba-4a6e-ab23-0e734eddebdf.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net) zip file of the working directory (available for 30 days) 
  >  ### Result of foundationdb-pr-macos-m1 on macOS Ventura 13.x  * Commit ID: c9a04d799d08d62cf969c83731db42be8e7d2b9c * Duration 0:06:31 * Result: :x: **FAILED** * Error: `Error while executing command: ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${HOME}/.ssh_key ec2-user@${MAC_EC2_HOST} /opt/homebrew/bin/bash --login -c ./build_pr_macos.sh. Reason: exit status 1` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-macos-m1/3ff001dd-e082-40a2-b075-bf6a19f8e9ed.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net) zip file of the working directory (available for 30 days) 
  >  ### Result of foundationdb-pr-clang-ide on Linux CentOS 7  * Commit ID: c9a04d799d08d62cf969c83731db42be8e7d2b9c * Duration 0:19:01 * Result: :white_check_mark: **SUCCEEDED** * Error: `N/A` * [Build Log](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb/foundationdb-pr-clang-ide/76e63765-031b-49bf-858d-8970a8a4bd6d.gz) terminal output (available for 30 days) * [Build Workspace](https://d1e0l78xbkh3xa.cloudfront.net/foundationdb-pr-clang-ide/76e63765-031b-49bf-858d-8970a8a4bd6d/workspace.zip) zip file of the working directory (available for 30 days) 

- **Issue #10260** (2023-07-24): **GRV latency spikes due to GetHealthMetricsReply::update**
  *Symptoms*: In one 7.1.31 cluster, we saw GRV proxy becomes CPU-hot: ![grv](https://github.com/apple/foundationdb/assets/9602186/8d280619-3edd-4d0b-af4b-bb74a92fbcf0)  The flamegraph suggested `GetHealthMetricsReply::update` is copying a lot of data, which leads to https://github.com/apple/foundationdb/blob/14859f33ca597e73400f7b98925613f3c06e6c35/fdbclient/include/fdbclient/FDBTypes.h#L1299-L1301.  We solved this by kill the Ratekeeper. But it seems the problem is that Ratekeeper is sending back `GetRateInfoReply` that is large.  cc: @sfc-gh-tclinkenbeard @sfc-gh-etschannen 
  **Post-Mortem & Fix Analysis**:
  > This seems to be caused by DD, which recruited over 118k storage servers and removed roughly the same amount in a 24 hour period. I guess Ratekeeper doesn't have proper TTL for its entries.
  > This is highly likely caused by DD server tracker. Suppose that a new SS does not receive any mutation in 6 mins. During the 6 mins, SS does not receive any mutation and doe not update its `lastUpdate`. When DD server tracker updates the metric for this SS, the tracker gets the `lastUpdate` from SS. The tracker see that this `lastUpdate` is more than 5 mins ago. Thus, the tracker marks this SS is `undesired`, leading to data moves in the`undesired server` priority and the removal of the SS. This process can repeatedly occur if no mutation accesses to new SSes in a short period.  We observed that DD team tracker triggers significant amount of data moves of the`undesired server` priority. In the past 24 hour, there were 100k StorageServerStuck events. When StorageServerStuck, server->ssVersionTooFarBehind is set, which can result in data relocation request with the priority of `undesired server`.   A StorageServerStuck event is triggered if `server->metrics.get().lastUpdate` is more 
  > I think there are two bugs here:  1. `HealthMetrics` doesn't have TTL for its entries. In the pathologic cases we found (DD keep recruiting and removing SSes), the leads to unbounded size. 2. DD's poor behavior: recruits a SS and doesn't assign any shard to it. After 5 minutes, DD considers the SS stuck and removes it.

- **Issue #8882** (2023-08-23): **`S3BlobStoreEndpoint::fromString` cannot guess region from S3 URL**
  *Symptoms*: When attempting to backup to S3 on `release-7.2`, we're seeing the following issue:  ``` fdbbackup start -C <cluster_file> -d blobstore://s3.us-west-2.amazonaws.com/<name>?bucket=<bucket_name>&sa=1  ERROR: 'Backup Container URL invalid' on URL 'blobstore://s3.us-west-2.amazonaws.com/<name>?bucket=<bucket_name>&sa=1': Failed to get region from host or parameter in url, region is required for aws v4 signature ```  This can be fixed by adding `&region=us-west-2` to the URL string, but this is a regression from `release-7.1`. `guessRegionFromDomain` should be able to detect the region automatically, but it looks like that is not the case.

- **Issue #8321** (2024-05-27): **Undestructed `Database` object after Cluster Recovery completed**
  *Symptoms*:  When a Cluster Recovery process completed, it is expected that the `ACTOR` `clusterRecoveryCore` run forever until the next recovery starts. After then, the running `clusterRecoveryCore` should be cancelled and the corresponding resources are then released. However, there are evidences show that even `clusterRecoveryCore` is cancelled, the opening `Database` object, constructed by `openDBOnServer`, will still exist for uncertain long time.  The first evidence is that, on certain FDB clusters, there are multiple `databaseLogger` `ACTOR`s running. The number of simultaneously running `ACTOR`s might cause `TraceEventThrottle` , which originated from the `TraceEvent`s of the `ACTOR`. The `ACTOR` will only be constructed when a new `DatabaseContext` object is constructed, which happens when `openDBOnServer` is called.  The second evidence is that, when the construction/destruction of `Database` objects, which wrap the corresponding`DatabaseContext` with a reference count, are logged if the object is either created by `clusterRecoveryCore`, or copied from the `clusterRecoveryCore` generated object, the log is showing that a certain amount of `Database` objects are not being destructed. These `Database` objects are constructed/copy-constructed at:  * `TransactionState` object construction. * `watchStorageServerResp` `ACTOR` creation. * `watchValue` `ACTOR` creation.  And for the `watch` related `ACTOR`s, it can be shown that they are watching these following keys:  * `
  **Post-Mortem & Fix Analysis**:
  > This hopefully relieve the `TraceEventThrottled_TransactionMetrics` problem. Yet this might *NOT* be the only cause of the issue.
  > `watchStorageServerResp` is assigned to `metadata->watchFutureSS`. So for it to be cancelled, the `metadata` has to be removed. Or, we may explicitly cancel it in the catch block of `watch(Reference<Watch> watch, ...)` function or `watchValueMap(Future<Version> version, ...)` with a try-catch.

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

### Incident Patch 1: `94bf9007` (2026-09-29)
**Commit Message**: Merge pull request #14167 from sburkule1/fdbdecode-empty-prefix-matches-all

fdbdecode: decode all range files when no key prefix is given

**File**: `fdbbackup/FileDecoder.cpp` (modified, +8/-1)
```diff
@@ -87,12 +87,13 @@ void printDecodeUsage() {
 	             "  --build-flags  Print build information and exit.\n"
 	             "  --list-only    Print file list and exit.\n"
 	             "  --validate-filters Validate the default RangeMap filtering logic with a slower one.\n"
-	             "  -k KEY_PREFIX  Use a single prefix for filtering mutations.\n"
+	             "  -k KEY_PREFIX  Use a single prefix for filtering mutations and range files.\n"
 	             "  --filters PREFIX_FILTER_FILE\n"
 	             "                 A file containing a list of prefix filters in HEX format separated by \";\",\n"
 	             "                 e.g., \"\\x05\\x01;\\x15\\x2b\"\n"
 	             "  --hex-prefix   HEX_PREFIX\n"
 	             "                 The prefix specified in HEX format, e.g., --hex-prefix \"\\\\x05\\\\x01\".\n"
+	             "                 With none of -k, --filters or --hex-prefix, everything is decoded.\n"
 	             "  --begin-version-filter BEGIN_VERSION\n"
 	             "                 The version range's begin version (inclusive) for filtering.\n"
 	             "  --end-version-filter END_VERSION\n"
@@ -791,6 +792,12 @@ Future<std::vector<RangeFile>> getRangeFiles(Reference<IBackupContainer> bc, Ref
 			std::pair<std::vector<RangeFile>, std::map<std::string, KeyRange>> results =
 			    co_await (dynamic_cast<BackupContainerFileSystem*>(bc.getPtr()))->readKeyspaceSnapshot(snapshots[i]);
 			for (const auto& rangeFile : results.first) {
+				// No prefix filter, or a manifest with no per-file key ranges (encrypted backups), selects
+				// every file. An empty RangeMapFilters matches nothing, so it cannot answer this.
+				if (params->prefixes.empty() || results.second.empty()) {
+					files.push_back(rangeFile);
+					continue;
+				}
 				const auto& keyRange = results.second.at(rangeFile.fileName);
 				if (params->matchFilters(keyRange)) {
 					files.push_back(rangeFile);
```

**File**: `fdbclient/BackupContainerFileSystem.cpp` (modified, +25/-0)
```diff
@@ -2956,4 +2956,29 @@ TEST_CASE("/backup/containers/localdir/listKeyspaceSnapshots/versionFilter") {
 	co_await c->deleteContainer();
 }
 
+// A RangeMapFilters with no prefixes matches nothing, so callers wanting "no filter means everything" must
+// check for an empty prefix list themselves instead of consulting the filter.
+TEST_CASE("/backup/rangeMapFilters/emptyMatchesNothing") {
+	fileBackup::RangeMapFilters empty;
+	ASSERT(!empty.match(KeyRangeRef(""_sr, "\xff"_sr))); // not even the whole keyspace
+	ASSERT(!empty.match(KeyRangeRef("a"_sr, "b"_sr)));
+	ASSERT(!empty.match(KeyValueRef("a"_sr, "v"_sr)));
+
+	std::vector<std::string> prefixes = { "ab" };
+	fileBackup::RangeMapFilters filters;
+	filters.updateFilters(prefixes);
+	ASSERT(filters.match(KeyRangeRef("ab"_sr, "ac"_sr)));
+	ASSERT(filters.match(KeyRangeRef("aa"_sr, "az"_sr)));
+	ASSERT(filters.match(KeyValueRef("abc"_sr, "v"_sr)));
+	ASSERT(!filters.match(KeyRangeRef("b"_sr, "c"_sr)));
+	ASSERT(!filters.match(KeyValueRef("b"_sr, "v"_sr)));
+
+	std::vector<KeyRange> ranges = { KeyRangeRef("m"_sr, "n"_sr) };
+	fileBackup::RangeMapFilters fromRanges(ranges);
+	ASSERT(fromRanges.match(KeyRangeRef("m"_sr, "mz"_sr)));
+	ASSERT(!fromRanges.match(KeyRangeRef("x"_sr, "y"_sr)));
+
+	return Void();
+}
+
 } // namespace backup_test
```

---

### Incident Patch 2: `c540f0a9` (2026-09-29)
**Commit Message**: Merge pull request #14160 from tclinkenbeard-oai/dev/tclinkenbeard/validate-trusted-subnet-prefix

**File**: `fdbrpc/IPAllowList.cpp` (modified, +36/-1)
```diff
@@ -28,6 +28,7 @@
 #include <fmt/printf.h>
 #include <fmt/ranges.h>
 #include <bitset>
+#include <charconv>
 
 namespace {
 
@@ -89,8 +90,20 @@ AuthAllowedSubnet AuthAllowedSubnet::fromString(std::string_view addressString)
 		throw invalid_option();
 	}
 	auto address = addressString.substr(0, pos);
-	auto netmaskWeight = std::stoi(std::string(addressString.substr(pos + 1)));
+	auto prefix = addressString.substr(pos + 1);
+	unsigned int netmaskWeight = 0;
+	auto [end, error] = std::from_chars(prefix.data(), prefix.data() + prefix.size(), netmaskWeight);
+	auto invalidPrefix = [&]() {
+		fmt::println("ERROR: {} has an invalid subnet prefix length", addressString);
+		throw invalid_option();
+	};
+	if (error != std::errc{} || end != prefix.data() + prefix.size()) {
+		invalidPrefix();
+	}
 	auto addr = boost::asio::ip::make_address(address);
+	if (netmaskWeight > (addr.is_v4() ? 32u : 128u)) {
+		invalidPrefix();
+	}
 	if (addr.is_v4()) {
 		auto bM = createBitMask(addr.to_v4().to_bytes(), netmaskWeight);
 		// we typically would expect a base address has been passed, but to be safe we still
@@ -312,6 +325,28 @@ TEST_CASE("/fdbrpc/allow_list") {
 		auto subnet = AuthAllowedSubnet::fromString(fmt::format("0::/{}", i));
 		ASSERT_EQ(i, subnet.netmaskWeight());
 	}
+	for (std::string_view invalid : { "0.0.0.0/-1",
+	                                  "0.0.0.0/-0",
+	                                  "0.0.0.0/+1",
+	                                  "0.0.0.0/33",
+	                                  "0.0.0.0/40",
+	                                  "0.0.0.0/128",
+	                                  "0.0.0.0/",
+	                                  "0.0.0.0/8junk",
+	                                  "0.0.0.0/4294967296",
+	                                  "::/-1",
+	                                  "::/129",
+	                                  "::/136",
+	                                  "::/128junk" }) {
+		bool rejected = false;
+		try {
+			AuthAllowedSubnet::fromString(invalid);
+		} catch (Error& e) {
+			ASSERT_EQ(e.code(), error_code_invalid_option);
+			rejected = true;
+		}
+		ASSERT(rejected);
+	}
 	IPAllowList allowList;
 	// Simulated v4 addresses
 	allowList.addTrustedSubnet("1.0.0.0/8");
```

---

### Incident Patch 3: `5d12f316` (2026-09-28)
**Commit Message**: fdbdecode: decode all range files when no key prefix is given

An empty RangeMapFilters matches nothing, so getRangeFiles() discarded every
range file unless -k, --filters or --hex-prefix was passed: --file-type range
reported "0 total" and exited 0 regardless of the version filter.

Treat an empty prefix list, and a manifest with no per-file key ranges, as
selecting everything. This matches getRestoreSet(), which guards both cases with
keyRangesFilter.empty() || results.second.empty(). The second guard also avoids
results.second.at() throwing std::out_of_range on 7.4 encrypted backups, which
omit keyRanges while still listing files.

**File**: `fdbbackup/FileDecoder.cpp` (modified, +8/-1)
```diff
@@ -87,12 +87,13 @@ void printDecodeUsage() {
 	             "  --build-flags  Print build information and exit.\n"
 	             "  --list-only    Print file list and exit.\n"
 	             "  --validate-filters Validate the default RangeMap filtering logic with a slower one.\n"
-	             "  -k KEY_PREFIX  Use a single prefix for filtering mutations.\n"
+	             "  -k KEY_PREFIX  Use a single prefix for filtering mutations and range files.\n"
 	             "  --filters PREFIX_FILTER_FILE\n"
 	             "                 A file containing a list of prefix filters in HEX format separated by \";\",\n"
 	             "                 e.g., \"\\x05\\x01;\\x15\\x2b\"\n"
 	             "  --hex-prefix   HEX_PREFIX\n"
 	             "                 The prefix specified in HEX format, e.g., --hex-prefix \"\\\\x05\\\\x01\".\n"
+	             "                 With none of -k, --filters or --hex-prefix, everything is decoded.\n"
 	             "  --begin-version-filter BEGIN_VERSION\n"
 	             "                 The version range's begin version (inclusive) for filtering.\n"
 	             "  --end-version-filter END_VERSION\n"
@@ -791,6 +792,12 @@ Future<std::vector<RangeFile>> getRangeFiles(Reference<IBackupContainer> bc, Ref
 			std::pair<std::vector<RangeFile>, std::map<std::string, KeyRange>> results =
 			    co_await (dynamic_cast<BackupContainerFileSystem*>(bc.getPtr()))->readKeyspaceSnapshot(snapshots[i]);
 			for (const auto& rangeFile : results.first) {
+				// No prefix filter, or a manifest with no per-file key ranges (encrypted backups), selects
+				// every file. An empty RangeMapFilters matches nothing, so it cannot answer this.
+				if (params->prefixes.empty() || results.second.empty()) {
+					files.push_back(rangeFile);
+					continue;
+				}
 				const auto& keyRange = results.second.at(rangeFile.fileName);
 				if (params->matchFilters(keyRange)) {
 					files.push_back(rangeFile);
```

**File**: `fdbclient/BackupContainerFileSystem.cpp` (modified, +25/-0)
```diff
@@ -2956,4 +2956,29 @@ TEST_CASE("/backup/containers/localdir/listKeyspaceSnapshots/versionFilter") {
 	co_await c->deleteContainer();
 }
 
+// A RangeMapFilters with no prefixes matches nothing, so callers wanting "no filter means everything" must
+// check for an empty prefix list themselves instead of consulting the filter.
+TEST_CASE("/backup/rangeMapFilters/emptyMatchesNothing") {
+	fileBackup::RangeMapFilters empty;
+	ASSERT(!empty.match(KeyRangeRef(""_sr, "\xff"_sr))); // not even the whole keyspace
+	ASSERT(!empty.match(KeyRangeRef("a"_sr, "b"_sr)));
+	ASSERT(!empty.match(KeyValueRef("a"_sr, "v"_sr)));
+
+	std::vector<std::string> prefixes = { "ab" };
+	fileBackup::RangeMapFilters filters;
+	filters.updateFilters(prefixes);
+	ASSERT(filters.match(KeyRangeRef("ab"_sr, "ac"_sr)));
+	ASSERT(filters.match(KeyRangeRef("aa"_sr, "az"_sr)));
+	ASSERT(filters.match(KeyValueRef("abc"_sr, "v"_sr)));
+	ASSERT(!filters.match(KeyRangeRef("b"_sr, "c"_sr)));
+	ASSERT(!filters.match(KeyValueRef("b"_sr, "v"_sr)));
+
+	std::vector<KeyRange> ranges = { KeyRangeRef("m"_sr, "n"_sr) };
+	fileBackup::RangeMapFilters fromRanges(ranges);
+	ASSERT(fromRanges.match(KeyRangeRef("m"_sr, "mz"_sr)));
+	ASSERT(!fromRanges.match(KeyRangeRef("x"_sr, "y"_sr)));
+
+	return Void();
+}
+
 } // namespace backup_test
```

---

### Incident Patch 4: `2e45482a` (2026-09-28)
**Commit Message**: Merge remote-tracking branch 'origin/main' into dev/tclinkenbeard/validate-trusted-subnet-prefix

**File**: `cmake/CompileBoost.cmake` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ function(compile_boost)
                        --with-toolset=${BOOST_TOOLSET}
     BUILD_COMMAND      ${B2_COMMAND}
                        link=static ${B2_ADDTTIONAL_BUILD_ARGS}
-                       -s NO_BZIP2=1 -s NO_LZMA=1 -s NO_ZSTD=1
+                       -s NO_BZIP2=1 -s NO_LZMA=1 -s NO_ZSTD=1 --disable-icu
                        ${COMPILE_BOOST_BUILD_ARGS}
                        --prefix=${BOOST_INSTALL_DIR}
                        ${USER_CONFIG_FLAG} install
```

---

### Incident Patch 5: `be737227` (2026-09-26)
**Commit Message**: Validate trusted subnet prefix lengths

**File**: `fdbrpc/IPAllowList.cpp` (modified, +36/-1)
```diff
@@ -28,6 +28,7 @@
 #include <fmt/printf.h>
 #include <fmt/ranges.h>
 #include <bitset>
+#include <charconv>
 
 namespace {
 
@@ -89,8 +90,20 @@ AuthAllowedSubnet AuthAllowedSubnet::fromString(std::string_view addressString)
 		throw invalid_option();
 	}
 	auto address = addressString.substr(0, pos);
-	auto netmaskWeight = std::stoi(std::string(addressString.substr(pos + 1)));
+	auto prefix = addressString.substr(pos + 1);
+	unsigned int netmaskWeight = 0;
+	auto [end, error] = std::from_chars(prefix.data(), prefix.data() + prefix.size(), netmaskWeight);
+	auto invalidPrefix = [&]() {
+		fmt::print("ERROR: {} has an invalid subnet prefix length\n", addressString);
+		throw invalid_option();
+	};
+	if (error != std::errc{} || end != prefix.data() + prefix.size()) {
+		invalidPrefix();
+	}
 	auto addr = boost::asio::ip::make_address(address);
+	if (netmaskWeight > (addr.is_v4() ? 32u : 128u)) {
+		invalidPrefix();
+	}
 	if (addr.is_v4()) {
 		auto bM = createBitMask(addr.to_v4().to_bytes(), netmaskWeight);
 		// we typically would expect a base address has been passed, but to be safe we still
@@ -312,6 +325,28 @@ TEST_CASE("/fdbrpc/allow_list") {
 		auto subnet = AuthAllowedSubnet::fromString(fmt::format("0::/{}", i));
 		ASSERT_EQ(i, subnet.netmaskWeight());
 	}
+	for (std::string_view invalid : { "0.0.0.0/-1",
+	                                  "0.0.0.0/-0",
+	                                  "0.0.0.0/+1",
+	                                  "0.0.0.0/33",
+	                                  "0.0.0.0/40",
+	                                  "0.0.0.0/128",
+	                                  "0.0.0.0/",
+	                                  "0.0.0.0/8junk",
+	                                  "0.0.0.0/4294967296",
+	                                  "::/-1",
+	                                  "::/129",
+	                                  "::/136",
+	                                  "::/128junk" }) {
+		bool rejected = false;
+		try {
+			AuthAllowedSubnet::fromString(invalid);
+		} catch (Error& e) {
+			ASSERT_EQ(e.code(), error_code_invalid_option);
+			rejected = true;
+		}
+		ASSERT(rejected);
+	}
 	IPAllowList allowList;
 	// Simulated v4 addresses
 	allowList.addTrustedSubnet("1.0.0.0/8");
```

---

### Incident Patch 6: `3eb77ab2` (2026-09-25)
**Commit Message**: Fix audit status argument validation

**File**: `fdbcli/GetAuditStatusCommand.cpp` (modified, +5/-1)
```diff
@@ -207,7 +207,7 @@ Future<Void> getAuditProgress(Database cx, AuditType auditType, UID auditId, Key
 }
 
 Future<bool> getAuditStatusCommandActor(Database cx, std::vector<StringRef> tokens) {
-	if (tokens.size() < 2 || tokens.size() > 5) {
+	if (tokens.size() < 3 || tokens.size() > 5) {
 		printUsage(tokens[0]);
 		co_return false;
 	}
@@ -270,6 +270,10 @@ Future<bool> getAuditStatusCommandActor(Database cx, std::vector<StringRef> toke
 			fmt::println("Audit result is:\n{}", it.toString());
 		}
 	} else if (tokencmp(tokens[2], "phase")) {
+		if (tokens.size() < 4) {
+			printUsage(tokens[0]);
+			co_return false;
+		}
 		AuditPhase phase = stringToAuditPhase(tokens[3].toString());
 		if (phase == AuditPhase::Invalid) {
 			printUsage(tokens[0]);
```

**File**: `fdbcli/tests/fdbcli_tests.py` (modified, +32/-0)
```diff
@@ -937,6 +937,37 @@ def cdc_operator_commands():
     assert b"Retired cleanup may still be pending" in result.stdout, result.stdout
 
 
+def audit_status_arguments():
+    invalid_commands = [
+        "get_audit_status",
+        "get_audit_status ha",
+        "get_audit_status ha id",
+        "get_audit_status ha progress",
+        "get_audit_status ha phase",
+    ]
+    for command in invalid_commands:
+        result = subprocess.run(
+            command_template + [command], capture_output=True, env=fdbcli_env
+        )
+        assert result.returncode != 0, (command, result.stdout, result.stderr)
+        assert result.stdout.startswith(b"Usage: get_audit_status "), (
+            command,
+            result.stdout,
+            result.stderr,
+        )
+
+    for command in [
+        "get_audit_status ha recent",
+        "get_audit_status ha recent 0",
+        "get_audit_status ha phase running",
+        "get_audit_status ha phase running 0",
+    ]:
+        result = subprocess.run(
+            command_template + [command], capture_output=True, env=fdbcli_env
+        )
+        assert result.returncode == 0, (command, result.stdout, result.stderr)
+
+
 def client_threads_per_version_env_ignored():
     test_env = fdbcli_env.copy()
     test_env["FDB_NETWORK_OPTION_CLIENT_THREADS_PER_VERSION"] = "not_an_integer"
@@ -1055,6 +1086,7 @@ def tls_address_suffix():
         status_json_file_region_failover_message()
         idempotency_ids()
         cdc_operator_commands()
+        audit_status_arguments()
         client_threads_per_version_env_ignored()
     else:
         assert args.process_number > 1, "Process number should be positive"
```

---

### Incident Patch 7: `b49c7a0e` (2026-09-25)
**Commit Message**: Fix clang-tidy after Boost upgrade

**File**: `.github/workflows/tidy.yml` (modified, +5/-0)
```diff
@@ -41,6 +41,11 @@ jobs:
             CXXFLAGS=-I${PWD}/fdbclient/include/fdbclient \
             cmake -S .. -G Ninja -D BUILD_AWS_BACKUP=ON -D BUILD_MAKO=ON -D CMAKE_EXPORT_COMPILE_COMMANDS=ON
 
+          # Source-built Boost installs its headers during the external-project build.
+          if ninja -t query boost_targetProject >/dev/null 2>&1; then
+            ninja -v boost_targetProject
+          fi
+
           ninja -v                      \
             processed_compile_commands  \
             fdboptions                  \
```

**File**: `flow/TLSTest.cpp` (modified, +7/-7)
```diff
@@ -31,25 +31,25 @@
 std::FILE* outp = stdout;
 
 template <class... Args>
-void log(Args&&... args) {
+void log(fmt::format_string<Args...> format, Args&&... args) {
 	auto buf = fmt::memory_buffer{};
-	fmt::format_to(std::back_inserter(buf), std::forward<Args>(args)...);
+	fmt::format_to(std::back_inserter(buf), format, std::forward<Args>(args)...);
 	fmt::print(outp, "{}\n", std::string_view(buf.data(), buf.size()));
 }
 
 template <class... Args>
-void logc(Args&&... args) {
+void logc(fmt::format_string<Args...> format, Args&&... args) {
 	auto buf = fmt::memory_buffer{};
 	fmt::format_to(std::back_inserter(buf), "[CLIENT] ");
-	fmt::format_to(std::back_inserter(buf), std::forward<Args>(args)...);
+	fmt::format_to(std::back_inserter(buf), format, std::forward<Args>(args)...);
 	fmt::print(outp, "{}\n", std::string_view(buf.data(), buf.size()));
 }
 
 template <class... Args>
-void logs(Args&&... args) {
+void logs(fmt::format_string<Args...> format, Args&&... args) {
 	auto buf = fmt::memory_buffer{};
 	fmt::format_to(std::back_inserter(buf), "[SERVER] ");
-	fmt::format_to(std::back_inserter(buf), std::forward<Args>(args)...);
+	fmt::format_to(std::back_inserter(buf), format, std::forward<Args>(args)...);
 	fmt::print(outp, "{}\n", std::string_view(buf.data(), buf.size()));
 }
 
@@ -104,7 +104,7 @@ struct fmt::formatter<tcp::endpoint> {
 	constexpr auto parse(format_parse_context& ctx) -> decltype(ctx.begin()) { return ctx.begin(); }
 
 	template <class FormatContext>
-	auto format(const tcp::endpoint& ep, FormatContext& ctx) -> decltype(ctx.out()) {
+	auto format(const tcp::endpoint& ep, FormatContext& ctx) const -> decltype(ctx.out()) {
 		return fmt::format_to(ctx.out(), "{}:{}", ep.address().to_string(), ep.port());
 	}
 };
```

---

### Incident Patch 8: `6149cf3e` (2026-09-24)
**Commit Message**: release notes 7.4.8 update - debug artifact changes

**File**: `documentation/sphinx/source/release-notes/release-notes-740.rst` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ AVX enabled release.
 
 * Reconciled uncertain S3 multipart upload completions: a 200 response that embeds an error is now treated as a failure, and a completion that returns NoSuchUpload or a transport error is verified against the committed object with a HEAD request before being reported as successful. `(PR #14089) <https://github.com/apple/foundationdb/pull/14089>`_, `(PR #14093) <https://github.com/apple/foundationdb/pull/14093>`_
 * Fixed RPM build-id link conflicts that prevented installing versioned client packages alongside the main client package. `(PR #14103) <https://github.com/apple/foundationdb/pull/14103>`_
+* Changed debug level to "-g1" and enabled compression for "\*.debug" release artifacts, to make them much smaller. Also changed to include the main executable in the "\*.debug" release artifact so it can optionally be run directly, on its own. `(PR #14103) <https://github.com/apple/foundationdb/pull/14103>`_, `(PR #14131) <https://github.com/apple/foundationdb/pull/14131>`_
 
 7.4.7
 =====
```

---

### Incident Patch 9: `731df191` (2026-09-24)
**Commit Message**: build: use executable-with-debug instead of split debuginfo

This replaces the split debuginfo files with the original un-stripped binaries, in order to set the gnu-debuglink in the stripped executable to point to these instead.

The benefit is just the convenience of using the "fdbserver.debug" (etc) release artifact as the main executable to run, and have debuginfo trivially available for profiling, crash analysis, etc.

The ".debug" release artifacts will still be smaller than in previous releases due to new debuginfo compression enabled in #13904

**File**: `cmake/FlowCommands.cmake` (modified, +4/-4)
```diff
@@ -131,13 +131,13 @@ function(strip_debug_symbols target)
   list(APPEND strip_command -o "${out_file}")
   if(is_exec AND NOT APPLE)
     # The debuglink command rewrites out_file, so it must finish before consumers copy it.
+    # Use entire original as .debug, instead of split debuginfo (only), for convenience.
     add_custom_command(
       OUTPUT "${out_file}" "${out_file}.debug"
       COMMAND ${strip_command} $<TARGET_FILE:${target}>
-      COMMAND objcopy --verbose --only-keep-debug $<TARGET_FILE:${target}>
-              "${out_file}.debug"
-      COMMAND objcopy --verbose --add-gnu-debuglink="${out_file}.debug"
-              "${out_file}"
+      # COMMAND objcopy --verbose --only-keep-debug $<TARGET_FILE:${target}> "${out_file}.debug"
+      COMMAND "${CMAKE_COMMAND}" -E copy $<TARGET_FILE:${target}> "${out_file}.debug"
+      COMMAND objcopy --verbose --add-gnu-debuglink="${out_file}.debug" "${out_file}"
       DEPENDS ${target}
       COMMENT "Stripping symbols and copying debug symbols from ${target}")
   else()
```

---

### Incident Patch 10: `3aa45a19` (2026-09-24)
**Commit Message**: Fix trailing comma in generated Java ProtocolVersion (#14130)

**File**: `flow/protocolversion/ProtocolVersion.java.template` (modified, +1/-2)
```diff
@@ -37,8 +37,7 @@ class ProtocolVersion implements Comparable<ProtocolVersion> {
 			protocolVersionSevenOne,
 			protocolVersionSevenThree,
 			protocolVersionSevenFour,
-			protocolVersionEightZero,
-	);
+			protocolVersionEightZero);
 
 	private static final long compatibleProtocolVersionMask = 0xFFFFFFFFFFFF0000L;
 	private final long protocolVersion;
```

#### Recent Merged Pull Requests:
- **PR #14182** (2026-09-30): docs: correct Joshua README's description of Joshua and Flow (@VanshBhardwaj24)
- **PR #14181** (2026-09-30): build: always include stripped main binaries in default ALL target (@ploxiln)
- **PR #14177** (2026-09-30): [release-8.0] build: java: set OUTPUT and DEPENDS for javadoc targets (@ploxiln)
- **PR #14176** (closed): Fix several issues in fdbdecode. (@sburkule1)
- **PR #14175** (2026-09-30): Removing call-site aware memory tracking code (@neethuhaneesha)
- **PR #14172** (2026-09-29): [release-7.3] Reconciled uncertain S3 multipart upload completions (@neethuhaneesha)
- **PR #14171** (2026-09-29): build: java: set OUTPUT and DEPENDS for javadoc targets (@ploxiln)
- **PR #14170** (2026-09-29): Give each simulated process its own global cipher key (@saintstack)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
