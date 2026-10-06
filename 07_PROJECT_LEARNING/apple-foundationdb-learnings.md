# Forensic Learning Record (Deep Inspection): apple/foundationdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/apple-foundationdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apple/foundationdb](https://github.com/apple/foundationdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:03:12.258Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apple/foundationdb`
- **Description**: FoundationDB - the open source, distributed, transactional key-value store
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 16755 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contrib/metadata_audit/fdb_metadata_utils.py`
```
#!/usr/bin/env python3
"""
Shared utilities for FDB metadata manipulation scripts.

Provides:
- MoveKeysLock management (required for writing to serverKeys/keyServers)
- Common key prefixes
- Helper functions
"""

import fdb
import struct
import uuid

# Try API versions from newest to oldest
_api_version_set = False
for _api_version in [740, 730, 720, 710, 700]:
    try:
        fdb.api_version(_api_version)
        _api_version_set = True
        break
    except:
        continue

if not _api_version_set:
    raise RuntimeError("Could not set any FDB API version")

# Key prefixes
SERVER_KEYS_PREFIX = b'\xff/serverKeys/'
SERVER_LIST_PREFIX = b'\xff/serverList/'
KEY_SERVERS_PREFIX = b'\xff/keyServers/'

# MoveKeysLock keys - required for writing to serverKeys/keyServers
DD_MODE_KEY = b'\xff/dataDistributionMode'
MOVEKEYS_LOCK_OWNER_KEY = b'\xff/moveKeysLock/Owner'
MOVEKEYS_LOCK_WRITE_KEY = b'\xff/moveKeysLock/Write'

# serverKeys values
SERVER_KEYS_TRUE = b'\x01'
SERVER_KEYS_FALSE = b'\x00'


def _encode_dd_mode(mode):
    """Encode DD mode as little-endian int32 (matches BinaryWriter<int>(Unversioned()))."""
    return struct.pack('<i', mode)


def _decode_dd_mode(value):
    """Decode DD mode from little-endian int32."""
    if value is None or len(value) == 0:
        return 1  # default mode
    return struct.unpack('<i', value)[0]


def _encode_uid():
    """Generate a random UID encoded as two little-endian uint64s (matches FDB UID serialization)."""
    return struct.pack('<QQ', *struct.unpack('>QQ', uuid.uuid4().bytes))


def strinc(key):
    """Return the first key greater than the given key that doesn't have key as a prefix.

    Note: duplicates fdb.impl.strinc() but is needed here because this runs
    at module load time before fdb.api_version() has been called.
    """
    if not key:
        return b'\x00'
    for i in range(len(key) - 1, -1, -1):
        if key[i] != 0xff:
            return key[:i] + bytes([key[i] + 1])
    return key + b'\x00'


# Precomputed end keys
SERVER_KEYS_END = strinc(SERVER_KEYS_PREFIX)
SERVER_LIST_END = strinc(SERVER_LIST_PREFIX)
KEY_SERVERS_END = strinc(KEY_SERVERS_PREFIX)


def take_movekeys_lock(db):
    """
    Disable DD and take ownership of MoveKeysLock.

    Required before writing to serverKeys/keyServers. This is exactly what
    FDB's internal code does (see fdbserver/core/MoveKeys.cpp).

    Returns (our_owner_uid_bytes, previous_dd_mode_value) so the caller can
    restore the prior mode on release.
    """
    our_owner_uid = _encode_uid()
    prev_mode = [None]

    @fdb.transactional
    def do_take_lock(tr):
        tr.options.set_access_system_keys()
        tr.options.set_lock_aware()
        tr.options.set_timeout(30000)
        tr.options.set_priority_system_immediate()
        # Read current DD mode so we can restore it later
        prev_mode[0] = tr[DD_MODE_KEY].wait()
        # Disable DD (mode=0)
        tr[DD_MODE_KEY] = _encode_dd_mode(0)
        # Take ownership of MoveKeysLock
        tr[MOVEKEYS_LOCK_OWNER_KEY] = our_owner_uid
        # Set initial write key
        tr[MOVEKEYS_LOCK_WRITE_KEY] = _encode_uid()

    do_take_lock(db)
    return our_owner_uid, prev_mode[0]


def release_movekeys_lock(db, prev_dd_mode_value=None):
    """
    Restore DD mode and release MoveKeysLock.

    Call this after finishing writes to serverKeys/keyServers.
    If prev_dd_mode_value is provided, restores that exact value.
    Otherwise defaults to mode=1 (enabled).
    """
    if prev_dd_mode_value is None:
        restore_value = _encode_dd_mode(1)
    else:
        restore_value = bytes(prev_dd_mode_value)

    @fdb.transactional
    def do_release_lock(tr):
        tr.options.set_access_system_keys()
        tr.options.set_lock_aware()
        tr.options.set_timeout(30000)
        tr.options.set_priority_system_immediate()
        # Release lock by setting new random owner (DD will reclaim)
        tr[MOVEKEYS_LOCK_OWNER_KEY] = _encode_uid()
        tr[MOVEKEYS_LOCK_WRITE_KEY] = _encode_uid()
        # Restore DD mode
        tr[DD_MODE_KEY] = restore_value

    do_release_lock(db)


def update_movekeys_lock_write(tr):
    """
    Update the MoveKeysLock write key within a transaction.

    Call this in each transaction that writes to serverKeys/keyServers
    to prevent conflicts with DD.
    """
    tr[MOVEKEYS_LOCK_WRITE_KEY] = _encode_uid()


def set_write_transaction_options(tr, timeout_ms=60000):
    """
    Set standard options for a transaction that writes to system keys.
    """
    tr.options.set_access_system_keys()
    tr.options.set_lock_aware()
    tr.options.set_timeout(timeout_ms)
    tr.options.set_priority_system_immediate()


def set_read_transaction_options(tr, timeout_ms=60000):
    """
    Set standard options for a transaction that reads system keys.
    """
    tr.options.set_read_system_keys()
    tr.options.set_lock_aware()
    tr.options.set_timeout(timeout_ms)

```

### Core Architecture Module: `fdbcli/Util.cpp`
```
/*
 * Util.cpp
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

#include "fdbcli/fdbcli.h"
#include "fdbclient/ManagementAPI.h"
#include "fdbclient/Schemas.h"
#include "fdbclient/Status.h"
#include "fdbclient/StatusSchema.h"
#include "fdbclient/BulkDumping.h"
#include "fdbclient/BulkLoading.h"
#include "flow/Arena.h"
#include "flow/ThreadHelper.h"
#include <fmt/core.h>

namespace fdb_cli {

bool tokencmp(StringRef token, const char* command) {
	if (token.size() != strlen(command))
		return false;

	return !memcmp(token.begin(), command, token.size());
}

void printUsage(StringRef command) {
	const auto& helpMap = CommandFactory::commands();
	auto i = helpMap.find(command.toString());
	if (i != helpMap.end())
		printf("Usage: %s\n", i->second.usage.c_str());
	else
		fprintf(stderr, "ERROR: Unknown command `%s'\n", command.toString().c_str());
}

void printLongDesc(StringRef command) {
	const auto& helpMap = CommandFactory::commands();
	auto i = helpMap.find(command.toString());
	if (i != helpMap.end())
		printf("%s\n", i->second.long_desc.c_str());
	else
		fprintf(stderr, "ERROR: Unknown command `%s'\n", command.toString().c_str());
}

Future<std::string> getSpecialKeysFailureErrorMessage(Reference<ITransaction> tr) {
	// hold the returned standalone object's memory
	ThreadFuture<Optional<Value>> errorMsgF = tr->get(fdb_cli::errorMsgSpecialKey);
	Optional<Value> errorMsg = co_await safeThreadFutureToFuture(errorMsgF);
	// Error message should be present
	ASSERT(errorMsg.present());
	// Read the json string
	auto valueObj = readJSONStrictly(errorMsg.get().toString()).get_obj();
	// verify schema
	auto schema = readJSONStrictly(JSONSchemas::managementApiErrorSchema.toString()).get_obj();
	std::string errorStr;
	ASSERT(schemaMatch(schema, valueObj, errorStr, SevError, true));
	// return the error message
	co_return valueObj["message"].get_str();
}

void addInterfacesFromKVs(RangeResult& kvs,
                          std::map<Key, std::pair<Value, ClientLeaderRegInterface>>* address_interface) {
	for (const auto& kv : kvs) {
		ClientWorkerInterface workerInterf;
		try {
			// the interface is back-ward compatible, thus if parsing failed, it needs to upgrade cli version
			workerInterf = BinaryReader::fromStringRef<ClientWorkerInterface>(kv.value, IncludeVersion());
		} catch (Error& e) {
			fprintf(stderr, "Error: %s; CLI version is too old, please update to use a newer version\n", e.what());
			return;
		}
		ClientLeaderRegInterface leaderInterf(workerInterf.address());
		StringRef ip_port = (kv.key.endsWith(":tls"_sr) ? kv.key.removeSuffix(":tls"_sr) : kv.key)
		                        .removePrefix("\xff\xff/worker_interfaces/"_sr);
		(*address_interface)[ip_port] = std::make_pair(kv.value, leaderInterf);

		if (workerInterf.reboot.getEndpoint().addresses.secondaryAddress.present()) {
			Key full_ip_port2 =
			    StringRef(workerInterf.reboot.getEndpoint().addresses.secondaryAddress.get().toString());
			StringRef ip_port2 =
			    full_ip_port2.endsWith(":tls"_sr) ? full_ip_port2.removeSuffix(":tls"_sr) : full_ip_port2;
			(*address_interface)[ip_port2] = std::make_pair(kv.value, leaderInterf);
		}
	}
}

Future<Void> getWorkerInterfaces(Reference<ITransaction> tr,
                                 std::map<Key, std::pair<Value, ClientLeaderRegInterface>>* address_interface,
                                 bool verify) {
	if (verify) {
		tr->setOption(FDBTransactionOptions::SPECIAL_KEY_SPACE_ENABLE_WRITES);
		tr->set(workerInterfacesVerifyOptionSpecialKey, ValueRef());
	}
	// Hold the reference to the standalone's memory
	ThreadFuture<RangeResult> kvsFuture = tr->getRange(
	    KeyRangeRef("\xff\xff/worker_interfaces/"_sr, "\xff\xff/worker_interfaces0"_sr), CLIENT_KNOBS->TOO_MANY);
	RangeResult kvs = co_await safeThreadFutureToFuture(kvsFuture);
	ASSERT(!kvs.more);
	if (verify) {
		// remove the option if set
		tr->clear(workerInterfacesVerifyOptionSpecialKey);
	}
	addInterfacesFromKVs(kvs, address_interface);
}

Future<bool> getWorkers(Reference<IDatabase> db, std::vector<ProcessData>* workers) {
	Reference<ITransaction> tr = db->createTransaction();
	while (true) {
		Error err;
		try {
			tr->setOption(FDBTransactionOptions::READ_SYSTEM_KEYS);
			tr->setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
			tr->setOption(FDBTransactionOptions::LOCK_AWARE);
			ThreadFuture<RangeResult> processClasses = tr->getRange(processClassKeys, CLIENT_KNOBS->TOO_MANY);
			ThreadFuture<RangeResult> processData = tr->getRange(workerListKeys, CLIENT_KNOBS->TOO_MANY);

			co_await (success(safeThreadFutureToFuture(processClasses)) &&
			          success(safeThreadFutureToFuture(processData)));
			ASSERT(!processClasses.get().more && processClasses.get().size() < CLIENT_KNOBS->TOO_MANY);
			ASSERT(!processData.get().more && processData.get().size() < CLIENT_KNOBS->TOO_MANY);

			std::map<Optional<Standalone<StringRef>>, ProcessClass> id_class;
			int i{ 0 };
			for (i = 0; i < processClasses.get().size(); i++) {
				try {
					id_class[decodeProcessClassKey(processClasses.get()[i].key)] =
					    decodeProcessClassValue(processClasses.get()[i].value);
				} catch (Error& e) {
					fprintf(stderr, "Error: %s; Client version is too old, please use a newer version\n", e.what());
					co_return false;
				}
			}

			for (i = 0; i < processData.get().size(); i++) {
				ProcessData data = decodeWorkerListValue(processData.get()[i].value);
				ProcessClass processClass = id_class[data.locality.processId()];

				if (processClass.classSource() == ProcessClass::DBSource ||
				    data.processClass.classType() == ProcessClass::UnsetClass)
					data.processClass = processClass;

				if (data.processClass.classType() != ProcessClass::TesterClass)
					workers->push_back(data);
			}

			co_return true;
		} catch (Error& e) {
			err = e;
		}
		TraceEvent(SevWarn, "GetWorkersError").error(err);
		co_await safeThreadFutureToFuture(tr->onError(err));
	}
}

Future<Void> getStorageServerInterfaces(Reference<IDatabase> db,
                                        std::map<std::string, StorageServerInterface>* interfaces) {
	Reference<ITransaction> tr = db->createTransaction();
	while (true) {
		interfaces->clear();
		Error err;
		try {
			tr->setOption(FDBTransactionOptions::READ_SYSTEM_KEYS);
			tr->setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
			tr->setOption(FDBTransactionOptions::LOCK_AWARE);
			ThreadFuture<RangeResult> serverListF = tr->getRange(serverListKeys, CLIENT_KNOBS->TOO_MANY);
			co_await safeThreadFutureToFuture(serverListF);
			ASSERT(!serverListF.get().more);
			ASSERT_LT(serverListF.get().size(), CLIENT_KNOBS->TOO_MANY);
			RangeResult serverList = serverListF.get();
			// decode server interfaces
			for (int i = 0; i < serverList.size(); i++) {
				auto ssi = decodeServerListValue(serverList[i].value);
				(*interfaces)[ssi.address().toString()] = ssi;
			}
			co_return;
		} catch (Error& e) {
			err = e;
		}
		TraceEvent(SevWarn, "GetStorageServerInterfacesError").error(err);
		co_await safeThreadFutureToFuture(tr->onError(err));
	}
}

// Shared UID validation for bulk operations (BulkDump/BulkLoad)
UID validateBulkJobId(StringRef token, const char* usage) {
	UID jobId;
	try {
		jobId = UID::fromStringThrowsOnFailure(token.toString());
	} catch (Error&) {
		fmt::println("ERROR: Invalid job id '{}' (expected 32 hex characters)", token.toString());
		fmt::println("{}", usage);
		throw operation_failed();
	}

	if (!jobId.isValid()) {
		fmt::println("ERROR: Invalid job id {}", token.toString());
		fmt::println("{}", usage);
		throw operation_failed();
	}

	return jobId;
}

Future<std::string> getBulkOwnerSuffix(Database cx, UID jobId, bool isDumpJob) {
	if (isDumpJob) {
		Optional<BulkDumpOwnerInfo> ownerInfo = co_await getBulkDumpOwner(cx, jobId);
		if (ownerInfo.present()) {
			co_return fmt::format(" (owned by {} '{}')", ownerInfo.get().ownerType, ownerInfo.get().ownerName);
		}
	} else {
		Optional<BulkDumpOwnerInfo> ownerInfo = co_await getBulkLoadOwner(cx, jobId);
		if (ownerInfo.present()) {
			co_return fmt::format(" (owned by {} '{}')", ownerInfo.get().ownerType, ownerInfo.get().ownerName);
		}
	}
	co_return std::string("");
}

// Format common progress metrics (throughput, ETA, elapsed time)
void printProgressMetrics(double avgBytesPerSecond, Optional<double> etaSeconds, double elapsedSeconds) {
	// Throughput
	if (avgBytesPerSecond > 0) {
		fmt::println(" Throughput - {:.1f} MB/s", avgBytesPerSecond / 1048576.0);
	}

	// ETA
	if (etaSeconds.present()) {
		fmt::println(" Estimated time remaining - {}", formatDurationHumanReadable((int)etaSeconds.get()));
	}

	// Elapsed time
	if (elapsedSeconds > 0) {
		fmt::println(" Elapsed time - {}", formatDurationHumanReadable((int)elapsedSeconds));
	}
}

// Print detailed task breakdown for bulk operations
void printTaskBreakdown(int submittedTasks, int triggeredTasks, int runningTasks, int completeTasks, int errorTasks) {
	int totalTasks = submittedTasks + triggeredTasks + runningTasks + completeTasks + errorTasks;
	if (totalTasks > 0) {
		fmt::println(" Task Status Breakdown:");
		if (submittedTasks > 0)
			fmt::println("   Submitted: {}", submittedTasks);
		if (triggeredTasks > 0)
			fmt::println("   Triggered: {}", triggeredTasks);
		if (runningTasks > 0)
			fmt::println("   Running: {}", runningTasks);
	
```

### Core Architecture Module: `fdbclient/AuditUtils.cpp`
```
/*
 * AuditUtils.cpp
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

#include "fdbclient/AuditUtils.h"

#include "fdbclient/Audit.h"
#include "fdbclient/FDBTypes.h"
#include "fdbclient/NativeAPI.h"
#include "fdbclient/ReadYourWrites.h"
#include "fdbclient/Knobs.h"
#include "flow/CoroUtils.h"
#include <fmt/format.h>

void clearAuditProgressMetadata(Transaction* tr, AuditType auditType, UID auditId) {
	// There are two possible places to store AuditProgressMetadata:
	// (1) auditServerBasedProgressRangeFor or (2) auditRangeBasedProgressRangeFor
	// Which place stores the progress metadata is decided by DDAudit design
	// This function enforces the DDAudit design when clear the progress metadata
	// Design: for replica/ha/locationMetadata, the audit always writes to RangeBased space
	// for SSShard, the audit always writes to ServerBased space
	// This function clears the progress metadata accordingly
	if (auditType == AuditType::ValidateStorageServerShard) {
		tr->clear(auditServerBasedProgressRangeFor(auditType, auditId));
	} else if (auditType == AuditType::ValidateHA || auditType == AuditType::ValidateReplica ||
	           auditType == AuditType::ValidateLocationMetadata || auditType == AuditType::ValidateRestore ||
	           auditType == AuditType::RangeDigest) {
		tr->clear(auditRangeBasedProgressRangeFor(auditType, auditId));
	} else {
		UNREACHABLE();
	}
	return;
}

Future<bool> checkStorageServerRemoved(Database cx, UID ssid) {
	bool res = false;
	Transaction tr(cx);
	TraceEvent(SevDebug, "AuditUtilStorageServerRemovedStart").detail("StorageServer", ssid);

	while (true) {
		Error err;
		try {
			tr.setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
			tr.setOption(FDBTransactionOptions::READ_SYSTEM_KEYS);
			tr.setOption(FDBTransactionOptions::LOCK_AWARE);
			Optional<Value> serverListValue = co_await tr.get(serverListKeyFor(ssid));
			if (!serverListValue.present()) {
				res = true; // SS is removed
			}
			break;
		} catch (Error& e) {
			err = e;
		}
		TraceEvent(SevDebug, "AuditUtilStorageServerRemovedError").errorUnsuppressed(err).detail("StorageServer", ssid);
		co_await tr.onError(err);
	}

	TraceEvent(SevDebug, "AuditUtilStorageServerRemovedEnd").detail("StorageServer", ssid).detail("Removed", res);
	co_return res;
}

Future<Void> cancelAuditMetadata(Database cx, AuditType auditType, UID auditId) {
	try {
		Transaction tr(cx);
		TraceEvent(SevInfo, "AuditUtilCancelAuditMetadataStart", auditId)
		    .detail("AuditKey", auditKey(auditType, auditId));
		while (true) {
			Error err;
			try {
				tr.setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
				tr.setOption(FDBTransactionOptions::ACCESS_SYSTEM_KEYS);
				tr.setOption(FDBTransactionOptions::LOCK_AWARE);
				Optional<Value> res_ = co_await tr.get(auditKey(auditType, auditId));
				if (!res_.present()) { // has been cancelled
					break; // Nothing to cancel
				}
				AuditStorageState toCancelState = decodeAuditStorageState(res_.get());
				// For a zombie audit, it is in running state
				ASSERT(toCancelState.id == auditId && toCancelState.getType() == auditType);
				toCancelState.setPhase(AuditPhase::Failed);
				tr.set(auditKey(toCancelState.getType(), toCancelState.id), auditStorageStateValue(toCancelState));
				clearAuditProgressMetadata(&tr, toCancelState.getType(), toCancelState.id);
				co_await tr.commit();
				TraceEvent(SevInfo, "AuditUtilCancelAuditMetadataEnd", auditId)
				    .detail("AuditKey", auditKey(auditType, auditId));
				break;
			} catch (Error& e) {
				err = e;
			}
			TraceEvent(SevWarn, "AuditUtilCancelAuditMetadataError", auditId)
			    .detail("AuditKey", auditKey(auditType, auditId));
			co_await tr.onError(err);
		}
	} catch (Error& e) {
		if (e.code() == error_code_actor_cancelled) {
			throw;
		}
		throw cancel_audit_storage_failed();
	}
}

AuditPhase stringToAuditPhase(std::string auditPhaseStr) {
	// Convert chars of auditPhaseStr to lower case
	std::transform(auditPhaseStr.begin(), auditPhaseStr.end(), auditPhaseStr.begin(), [](unsigned char c) {
		return std::tolower(c);
	});
	if (auditPhaseStr == "running") {
		return AuditPhase::Running;
	} else if (auditPhaseStr == "complete") {
		return AuditPhase::Complete;
	} else if (auditPhaseStr == "failed") {
		return AuditPhase::Failed;
	} else if (auditPhaseStr == "error") {
		return AuditPhase::Error;
	} else {
		return AuditPhase::Invalid;
	}
}

// This is not transactional
AsyncResult<std::vector<AuditStorageState>> getAuditStates(Database cx,
                                                           AuditType auditType,
                                                           bool newFirst,
                                                           Optional<int> num,
                                                           Optional<AuditPhase> phase) {
	Transaction tr(cx);
	std::vector<AuditStorageState> auditStates;
	Key readBegin;
	Key readEnd;
	Reverse reverse = newFirst ? Reverse::True : Reverse::False;
	if (num.present() && num.get() == 0) {
		co_return auditStates;
	}
	while (true) {
		Error err;
		try {
			readBegin = auditKeyRange(auditType).begin;
			readEnd = auditKeyRange(auditType).end;
			auditStates.clear();
			while (true) {
				tr.setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
				tr.setOption(FDBTransactionOptions::READ_SYSTEM_KEYS);
				tr.setOption(FDBTransactionOptions::LOCK_AWARE);
				KeyRangeRef rangeToRead(readBegin, readEnd);
				RangeResult res = co_await tr.getRange(rangeToRead,
				                                       num.present() ? GetRangeLimits(num.get()) : GetRangeLimits(),
				                                       Snapshot::False,
				                                       reverse);
				for (const auto& auditKeyValue : res) {
					const AuditStorageState auditState = decodeAuditStorageState(auditKeyValue.value);
					if (phase.present() && auditState.getPhase() != phase.get()) {
						continue;
					}
					auditStates.push_back(auditState);
					if (num.present() && auditStates.size() == num.get()) {
						co_return auditStates; // since res.more is not reliable when GetRangeLimits is set to 1
					}
				}
				if (!res.more) {
					break;
				}
				if (newFirst) {
					readEnd = res.front().key; // we are reversely reading the range
				} else {
					readBegin = keyAfter(res.back().key);
				}
				tr.reset();
			}
			break;
		} catch (Error& e) {
			err = e;
		}
		co_await tr.onError(err);
	}
	co_return auditStates;
}

Future<Void> clearAuditMetadataForType(Database cx,
                                       AuditType auditType,
                                       UID maxAuditIdToClear,
                                       int numFinishAuditToKeep) {
	Transaction tr(cx);
	int numFinishAuditCleaned = 0; // We regard "Complete" and "Failed" audits as finish audits
	TraceEvent(SevDebug, "AuditUtilClearAuditMetadataForTypeStart")
	    .detail("AuditType", auditType)
	    .detail("MaxAuditIdToClear", maxAuditIdToClear);

	try {
		while (true) { // Cleanup until succeed or facing unretriable error
			Error err;
			try {
				std::vector<AuditStorageState> auditStates = co_await getAuditStates(cx, auditType, /*newFirst=*/false);
				// auditStates has ascending order of auditIds

				// Read and clear are not atomic
				int numFinishAudit = 0;
				for (const auto& auditState : auditStates) {
					if (auditState.id.first() > maxAuditIdToClear.first()) {
						continue; // ignore any audit with a larger auditId than the input threshold
					}
					if (auditState.getPhase() == AuditPhase::Complete || auditState.getPhase() == AuditPhase::Failed) {
						numFinishAudit++;
					}
				}
				const int numFinishAuditToClean = numFinishAudit - numFinishAuditToKeep;
				numFinishAuditCleaned = 0;
				tr.setOption(FDBTransactionOptions::PRIORITY_SYSTEM_IMMEDIATE);
				tr.setOption(FDBTransactionOptions::ACCESS_SYSTEM_KEYS);
				tr.setOption(FDBTransactionOptions::LOCK_AWARE);
				for (const auto& auditState : auditStates) {
					if (auditState.id.first() > maxAuditIdToClear.first()) {
						continue; // ignore any audit with a larger auditId than the input threshold
					}
					ASSERT(auditState.getType() == auditType);
					if (auditState.getPhase() == AuditPhase::Complete &&
					    numFinishAuditCleaned < numFinishAuditToClean) {
						// Clear audit metadata
						tr.clear(auditKey(auditType, auditState.id));
						// No need to clear progress metadata of Complete audits
						// which has been done when Complete phase persistent
						numFinishAuditCleaned++;
					} else if (auditState.getPhase() == AuditPhase::Failed &&
					           numFinishAuditCleaned < numFinishAuditToClean) {
						// Clear audit metadata
						tr.clear(auditKey(auditType, auditState.id));
						// Clear progress metadata
						clearAuditProgressMetadata(&tr, auditType, auditState.id);
						numFinishAuditCleaned++;
					}
					// For a zombie audit, it is in running state
				}
				co_await tr.commit();
				TraceEvent(SevDebug, "AuditUtilClearAuditMetadataForTypeEnd")
				    .detail("AuditType", auditType)
				    .detail("NumCleanedFinishAudits", numFinishAuditCleaned);
				break;
			} catch (Error& e) {
				err = e;
			}
			co_await tr.onError(err);
		}
	} catch (Error& e) {
		if (e.code() == error_code_actor_cancelled) {
			throw;
		}
		TraceEvent(SevInf
```

### Core Architecture Module: `fdbclient/RESTUtils.cpp`
```
/*
 * RESTUtils.cpp
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

#include "RESTUtils.h"
#include "fdbclient/Knobs.h"

#include "flow/flat_buffers.h"
#include "flow/UnitTest.h"
#include "flow/IConnection.h"

#include <boost/algorithm/string.hpp>
#include <queue>

// RESTConnectionPool destructor implementation
RESTConnectionPool::~RESTConnectionPool() {
	// In simulation, explicitly close all pooled connections before destruction.
	// This satisfies Sim2Conn's assertion: !opened || closedByCaller
	// Without this, connections would be destroyed without being closed, causing assertion failures.
	if (g_network && g_network->isSimulated()) {
		for (auto& kv : connectionPoolMap) {
			while (!kv.second.empty()) {
				ReusableConnection& rconn = kv.second.front();
				if (rconn.conn.isValid()) {
					rconn.conn->close();
				}
				kv.second.pop();
			}
		}
	}
}

const std::unordered_map<std::string, RESTConnectionType> RESTConnectionType::supportedConnTypes = {
	{ "http", RESTConnectionType("http", RESTConnectionType::NOT_SECURE_CONNECTION) },
	{ "https", RESTConnectionType("https", RESTConnectionType::SECURE_CONNECTION) }
};

RESTConnectionType RESTConnectionType::getConnectionType(const std::string& protocol) {
	auto itr = RESTConnectionType::supportedConnTypes.find(protocol);
	if (itr == RESTConnectionType::supportedConnTypes.end()) {
		TraceEvent("RESTConnectionTypeUnsupportedPrototocol").detail("Protocol", protocol);
		CODE_PROBE(true, "REST URI unsupported protocol");
		throw rest_unsupported_protocol();
	}
	return itr->second;
}

bool RESTConnectionType::isProtocolSupported(const std::string& protocol) {
	auto itr = RESTConnectionType::supportedConnTypes.find(protocol);
	return itr != RESTConnectionType::supportedConnTypes.end();
}

bool RESTConnectionType::isSecure(const std::string& protocol) {
	auto itr = RESTConnectionType::supportedConnTypes.find(protocol);
	if (itr == RESTConnectionType::supportedConnTypes.end()) {
		TraceEvent("RESTConnectionTypeUnsupportedPrototocol").detail("Protocol", protocol);
		throw rest_unsupported_protocol();
	}
	return itr->second.secure == RESTConnectionType::SECURE_CONNECTION;
}

RESTClientKnobs::RESTClientKnobs() {
	connection_pool_size = FLOW_KNOBS->RESTCLIENT_MAX_CONNECTIONPOOL_SIZE;
	connect_tries = FLOW_KNOBS->RESTCLIENT_CONNECT_TRIES;
	connect_timeout = FLOW_KNOBS->RESTCLIENT_CONNECT_TIMEOUT;
	max_connection_life = FLOW_KNOBS->RESTCLIENT_MAX_CONNECTION_LIFE;
	request_tries = FLOW_KNOBS->RESTCLIENT_REQUEST_TRIES;
	request_timeout_secs = FLOW_KNOBS->RESTCLIENT_REQUEST_TIMEOUT_SEC;

	knobMap["connection_pool_size"] = std::addressof(connection_pool_size);
	knobMap["pz"] = std::addressof(connection_pool_size);
	knobMap["connect_tries"] = std::addressof(connect_tries);
	knobMap["ct"] = std::addressof(connect_tries);
	knobMap["connect_timeout"] = std::addressof(connect_timeout);
	knobMap["cto"] = std::addressof(connect_timeout);
	knobMap["max_connection_life"] = std::addressof(max_connection_life);
	knobMap["mcl"] = std::addressof(max_connection_life);
	knobMap["request_tries"] = std::addressof(request_tries);
	knobMap["rt"] = std::addressof(request_tries);
	knobMap["request_timeout_secs"] = std::addressof(request_timeout_secs);
	knobMap["rtom"] = std::addressof(request_timeout_secs);
}

void RESTClientKnobs::set(const std::unordered_map<std::string, int>& knobSettings) {

	for (const auto& itr : knobSettings) {
		const auto& kItr = RESTClientKnobs::knobMap.find(itr.first);
		if (kItr == RESTClientKnobs::knobMap.end()) {
			TraceEvent("RESTClientInvalidKnobName").detail("KnobName", itr.first);
			throw rest_invalid_rest_client_knob();
		}
		ASSERT_EQ(itr.first.compare(kItr->first), 0);
		*(kItr->second) = itr.second;
	}
}

std::unordered_map<std::string, int> RESTClientKnobs::get() const {
	std::unordered_map<std::string, int> details = {
		{ "connection_pool_size", connection_pool_size },
		{ "connect_tries", connect_tries },
		{ "connect_timeout", connect_timeout },
		{ "max_connection_life", max_connection_life },
		{ "request_tries", request_tries },
		{ "request_timeout_secs", request_timeout_secs },
	};

	return details;
}

Future<RESTConnectionPool::ReusableConnection> connect_impl(Reference<RESTConnectionPool> connectionPool,
                                                            RESTConnectionPoolKey connectKey,
                                                            bool isSecure,
                                                            int maxConnLife) {

	if (FLOW_KNOBS->REST_LOG_LEVEL >= RESTLogSeverity::VERBOSE) {
		TraceEvent("RESTUtilConnectStart")
		    .detail("Host", connectKey.first)
		    .detail("Service", connectKey.second)
		    .detail("IsSecure", isSecure)
		    .detail("ConnectPoolNumKeys", connectionPool->connectionPoolMap.size());
	}

	auto poolItr = connectionPool->connectionPoolMap.find(connectKey);
	while (poolItr != connectionPool->connectionPoolMap.end() && !poolItr->second.empty()) {
		RESTConnectionPool::ReusableConnection rconn = poolItr->second.front();
		poolItr->second.pop();

		if (rconn.expirationTime > now()) {
			if (FLOW_KNOBS->REST_LOG_LEVEL >= RESTLogSeverity::DEBUG) {
				TraceEvent("RESTUtilReuseConn")
				    .detail("Host", connectKey.first)
				    .detail("Service", connectKey.second)
				    .detail("RemoteEndpoint", rconn.conn->getPeerAddress())
				    .detail("ExpireIn", rconn.expirationTime - now())
				    .detail("NumConnsInPool", poolItr->second.size());
			}
			co_return rconn;
		}
	}

	ASSERT(poolItr == connectionPool->connectionPoolMap.end() || poolItr->second.empty());

	// No valid connection exists, create a new one
	Reference<IConnection> conn =
	    co_await INetworkConnections::net()->connect(connectKey.first, connectKey.second, isSecure);
	co_await conn->connectHandshake();

	TraceEvent("RESTTUilCreateNewConn")
	    .suppressFor(60)
	    .detail("Host", connectKey.first)
	    .detail("Service", connectKey.second)
	    .detail("RemoteEndpoint", conn->getPeerAddress())
	    .detail("ConnPoolSize", connectionPool->connectionPoolMap.size());

	co_return RESTConnectionPool::ReusableConnection({ conn, now() + maxConnLife });
}

Future<RESTConnectionPool::ReusableConnection> RESTConnectionPool::connect(RESTConnectionPoolKey connectKey,
                                                                           const bool isSecure,
                                                                           const int maxConnLife) {
	return connect_impl(Reference<RESTConnectionPool>::addRef(this), connectKey, isSecure, maxConnLife);
}

void RESTConnectionPool::returnConnection(RESTConnectionPoolKey connectKey,
                                          ReusableConnection& rconn,
                                          const int maxConnections) {
	if (FLOW_KNOBS->REST_LOG_LEVEL >= RESTLogSeverity::VERBOSE) {
		TraceEvent("RESTUtilReturnConnStart")
		    .detail("Host", connectKey.first)
		    .detail("Service", connectKey.second)
		    .detail("ConnectPoolNumKeys", connectionPoolMap.size());
	}

	auto poolItr = connectionPoolMap.find(connectKey);
	// If it expires in the future then add it to the pool in the front iff connection pool size is not maxed
	if (rconn.expirationTime > now()) {
		bool returned = true;
		if (poolItr == connectionPoolMap.end()) {
			connectionPoolMap.insert({ connectKey, std::queue<RESTConnectionPool::ReusableConnection>({ rconn }) });
		} else if (poolItr->second.size() < maxConnections) {
			poolItr->second.push(rconn);
		} else {
			// Connection pool at its capacity; do nothing
			returned = false;
		}

		if (FLOW_KNOBS->REST_LOG_LEVEL >= RESTLogSeverity::DEBUG && returned) {
			poolItr = connectionPoolMap.find(connectKey);
			TraceEvent("RESTUtilReturnConnToPool")
			    .detail("Host", connectKey.first)
			    .detail("Service", connectKey.second)
			    .detail("ConnPoolSize", connectionPoolMap.size())
			    .detail("CachedConns", poolItr->second.size())
			    .detail("TimeToExpire", rconn.expirationTime - now());
		}
	}
	rconn.conn = Reference<IConnection>();
}

RESTUrl::RESTUrl(const std::string& fUrl) {
	parseUrl(fUrl);
}

RESTUrl::RESTUrl(const std::string& fullUrl, const std::string& b) : body(b) {
	parseUrl(fullUrl);
}

void RESTUrl::parseUrl(const std::string& fullUrl) {
	// Sample valid URIs
	// 1. With 'host' & 'resource' := '<protocol>://<host>/<resource>'
	// 2. With 'host', 'service' & 'resource' := '<protocol>://<host>:port/<resource>'
	// 3. With 'host', 'service', 'resource' & 'reqParameters' := '<protocol>://<host>:port/<resource>?<parameter-list>'

	if (FLOW_KNOBS->REST_LOG_LEVEL >= RESTLogSeverity::VERBOSE) {
		TraceEvent("RESTParseURI").detail("URI", fullUrl);
	}

	try {
		StringRef t(fullUrl);
		StringRef p = t.eat("://");
		std::string protocol = p.toString();
		boost::algorithm::to_lower(protocol);
		this->connType = RESTConnectionType::getConnectionType(protocol);

		// extract 'resource' and optional 'parameter list' if supplied in the URL
		uint8_t foundSeparator = 0;
		StringRef hostPort = t.eatAny("/?", &foundSeparator);
		this->resource = "/";
		if (foundSeparator == '/') {
			this->resource += t.eat("?").toString();
			this->reqParameters = t.eat().toString();
		}

		// hostPort is at least a host or IP address, optionally followed by :portNumber or :serviceName
		StringRef hRef(hostPort);
		S
```

### Core Architecture Module: `fdbclient/RESTUtils.h`
```
/*
 * RESTUtils.h
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

#ifndef FDRPC_REST_UTILS_H
#define FDRPC_REST_UTILS_H

#pragma once

#include "flow/flow.h"
#include "flow/FastRef.h"
#include "flow/Net2Packet.h"

#include <boost/functional/hash.hpp>
#include <fmt/format.h>
#include <unordered_map>
#include <utility>

// Util interface managing REST active connection pool.
// The interface internally constructs and maintains map {"host:service" -> activeConnection}; any new connection
// request would first access cached connection if possible (not expired), if none exists, it would establish a new
// connection and return to the caller. Caller on accomplishing the task at-hand, should return the connection back to
// the pool.

using RESTConnectionPoolKey = std::pair<std::string, std::string>;

enum RESTLogSeverity { INFO = 1, DEBUG = 2, VERBOSE = 3 };

class IConnection;

class RESTConnectionPool : public ReferenceCounted<RESTConnectionPool> {
public:
	struct ReusableConnection {
		Reference<IConnection> conn;
		double expirationTime;

		ReusableConnection() : expirationTime(0) {}
		ReusableConnection(Reference<IConnection> c, double exp) : conn(c), expirationTime(exp) {}
	};

	// Maximum number of connections cached in the connection-pool.
	int maxConnPerConnectKey;
	std::unordered_map<RESTConnectionPoolKey, std::queue<ReusableConnection>, boost::hash<RESTConnectionPoolKey>>
	    connectionPoolMap;

	explicit RESTConnectionPool(const int maxConnsPerKey) : maxConnPerConnectKey(maxConnsPerKey) {}

	// Destructor implementation in RESTUtils.cpp
	// In simulation, explicitly closes all pooled connections before destruction
	~RESTConnectionPool();

	// Routine is responsible to provide an usable TCP connection object; it reuses an active connection from
	// connection-pool if available, otherwise, establish a new TCP connection
	Future<ReusableConnection> connect(RESTConnectionPoolKey connectKey, const bool isSecure, const int maxConnLife);
	void returnConnection(RESTConnectionPoolKey connectKey, ReusableConnection& conn, const int maxConnections);

	static RESTConnectionPoolKey getConnectionPoolKey(const std::string& host, const std::string& service) {
		return std::make_pair(host, service);
	}
};

struct RESTConnectionType {
	std::string protocol;
	int secure;

	constexpr static int SECURE_CONNECTION = 1;
	constexpr static int NOT_SECURE_CONNECTION = 0;

	RESTConnectionType() : protocol("https"), secure(RESTConnectionType::SECURE_CONNECTION) {}
	explicit RESTConnectionType(const std::string& p, const int s) : protocol(p), secure(s) {}
	std::string toString() const { return format("%s:%d", this->protocol.c_str(), this->secure); }

	static const std::unordered_map<std::string, RESTConnectionType> supportedConnTypes;
	static RESTConnectionType getConnectionType(const std::string&);
	static bool isProtocolSupported(const std::string&);
	static bool isSecure(const std::string&);
};

// Util interface facilitating management and update for RESTClient knob parameters
struct RESTClientKnobs {
	int connection_pool_size;
	int connect_timeout;
	int connect_tries;
	int max_connection_life; // Note: this knob is not implemented yet in RESTClient
	int request_tries;
	int request_timeout_secs;

	RESTClientKnobs();

	void set(const std::unordered_map<std::string, int>& knobSettings);
	std::unordered_map<std::string, int> get() const;
	std::unordered_map<std::string, int*> knobMap;

	static std::vector<std::string> getKnobDescriptions() {
		return {
			"connection_pool_size (pz)             Maximum numbers of active connections in the connection-pool",
			"connect_tries (or ct)                 Number of times to try to connect for each request.",
			"connect_timeout (or cto)              Number of seconds to wait for a connect request to succeed.",
			"max_connection_life (or mcl)          Maximum number of seconds to use a single TCP connection.",
			"request_tries (or rt)                 Number of times to try each request until a parsable HTTP "
			"response other than 429 is received.",
			"request_timeout_secs (or rtom)        Number of seconds to wait for a request to succeed after a "
			"connection is established.",
		};
	}
};

// Util interface facilitating parsing of an input REST 'full_url'
struct RESTUrl {
public:
	// Connection resources - host and port details
	std::string host;
	std::string service;
	// resource identified by URI
	std::string resource;
	// optional REST request parameters
	std::string reqParameters;
	// Request 'body' payload
	std::string body;
	// URL connection type
	RESTConnectionType connType;

	explicit RESTUrl(const std::string& fullUrl);
	explicit RESTUrl(const std::string& fullUrl, const std::string& body);

	std::string toString() const {
		return fmt::format(
		    "Host {} Service {} Resource {} ReqParams {} Body {}", host, service, resource, reqParameters, body);
	}

private:
	void parseUrl(const std::string& fullUrl);
};

double continuousTimeDecay(double initialValue, double decayRate, double time);

#endif
```

### Core Architecture Module: `fdbclient/RandomKeyValueUtils.cpp`
```
/*
 * RandomKeyValueUtils.cpp
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

#include "fdbclient/RandomKeyValueUtils.h"
#include "flow/UnitTest.h"

template <typename T>
void printNextN(T generator, int count = 10) {
	fmt::print("Generating from .next() on {}\n", generator.toString());
	for (int i = 0; i < count; ++i) {
		fmt::print("  {}\n", generator.next());
	}
	fmt::print("\n");
}

TEST_CASE("/randomKeyValueUtils/generate") {

	printNextN(RandomIntGenerator(3, 10, false), 5);
	printNextN(RandomIntGenerator("3..10"), 5);
	printNextN(RandomIntGenerator("a..z"), 5);
	// Works in reverse too
	printNextN(RandomIntGenerator("10..3"), 5);
	// Skewed low
	printNextN(RandomIntGenerator("^3..10"), 5);
	// Skewed high
	printNextN(RandomIntGenerator("^10..3"), 5);
	printNextN(RandomIntGenerator("5"), 5);

	printNextN(RandomStringGenerator(RandomIntGenerator(3, 10, false), RandomIntGenerator('d', 'g', false)), 10);
	printNextN(RandomStringGenerator("3..10", "d..g"), 10);
	printNextN(RandomStringGenerator("3..10/d..g"), 10);
	printNextN(RandomStringGenerator("5/a..c"), 5);
	printNextN(RandomStringGenerator("5/a..a"), 5);

	printNextN(RandomKeySetGenerator("0..5", "3..10/d..g"), 20);
	// Index generator will use a min of 0 so this is the same as 0:5
	printNextN(RandomKeySetGenerator("5", "3..10/d..g"), 20);

	std::vector<RandomKeySetGenerator> tupleParts{
		RandomKeySetGenerator(RandomIntGenerator(5),
		                      RandomStringGenerator(RandomIntGenerator(5), RandomIntGenerator('a', 'c', false))),
		RandomKeySetGenerator(
		    RandomIntGenerator(5),
		    RandomStringGenerator(RandomIntGenerator(3, 10, true), RandomIntGenerator('d', 'f', false)))
	};

	printNextN(RandomKeyTupleSetGenerator(RandomIntGenerator(10), RandomKeyTupleGenerator(tupleParts)), 10);

	// Same as above in string form
	printNextN(RandomKeyTupleSetGenerator("10::5::5/a..c,5::^3..10/d..f"), 10);

	// uniform random selection from 1000 pregenerated key tuples.  Tuples have 4 parts
	//    len 5 chars a-d with 2 choices
	//    len 10 chars k-t with 10000 choices
	//    len 5-8  chars z-z with 2 choices
	printNextN(RandomKeyTupleSetGenerator("1000::2::5/a..d,10000::10/k..t,2::5..8/z"), 100);

	printNextN(RandomValueGenerator("10..100/r..z"), 20);

	return Void();
}

void forceLinkRandomKeyValueUtilsTests() {}

```

### Core Architecture Module: `fdbclient/include/fdbclient/AuditUtils.h`
```
/*
 * AuditUtils.h
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

#ifndef FDBCLIENT_AUDITUTILS_H
#define FDBCLIENT_AUDITUTILS_H

#include "fdbclient/Audit.h"
#include "fdbclient/FDBTypes.h"
#include "fdbclient/NativeAPI.h"
#include "fdbclient/RangeDigest.h"
#include "fdbrpc/fdbrpc.h"

struct MoveKeyLockInfo {
	UID prevOwner, myOwner, prevWrite;
};

// Cancel an in-progress audit by setting its persisted state to Failed and clearing progress metadata.
Future<Void> cancelAuditMetadata(Database cx, AuditType auditType, UID auditId);

// Persist a new audit's initial state to the database. Returns the assigned audit ID.
Future<UID> persistNewAuditState(Database cx, AuditStorageState auditState, MoveKeyLockInfo lock, bool ddEnabled);

// Update an existing audit's persisted state (e.g. phase transitions).
Future<Void> persistAuditState(Database cx,
                               AuditStorageState auditState,
                               std::string context,
                               MoveKeyLockInfo lock,
                               bool ddEnabled);

// Read a single audit's state by type and ID.
Future<AuditStorageState> getAuditState(Database cx, AuditType type, UID id);

// List audit states for a given type, optionally filtered by phase, ordered by ID.
AsyncResult<std::vector<AuditStorageState>> getAuditStates(Database cx,
                                                           AuditType auditType,
                                                           bool newFirst,
                                                           Optional<int> num = Optional<int>(),
                                                           Optional<AuditPhase> phase = Optional<AuditPhase>());

// Persist per-range audit progress (which sub-ranges have been validated).
Future<Void> persistAuditStateByRange(Database cx, AuditStorageState auditState);

// Read per-range audit progress for the given audit within a key range.
Future<std::vector<AuditStorageState>> getAuditStateByRange(Database cx, AuditType type, UID auditId, KeyRange range);

// Persist per-server audit progress.
Future<Void> persistAuditStateByServer(Database cx, AuditStorageState auditState);

// Read per-server audit progress for a specific server within a key range.
Future<std::vector<AuditStorageState>> getAuditStateByServer(Database cx,
                                                             AuditType type,
                                                             UID auditId,
                                                             UID auditServerId,
                                                             KeyRange range);

// Clear persisted audit metadata for completed/failed audits older than maxAuditIdToClear,
// keeping the most recent numFinishAuditToKeep finished audits.
Future<Void> clearAuditMetadataForType(Database cx,
                                       AuditType auditType,
                                       UID maxAuditIdToClear,
                                       int numFinishAuditToKeep);

// Check whether a storage server has been removed from the server list.
Future<bool> checkStorageServerRemoved(Database cx, UID ssid);

// Parse a human-readable audit phase string (e.g. "running", "complete") into an AuditPhase enum.
AuditPhase stringToAuditPhase(std::string auditPhaseStr);

// Check whether all sub-ranges of auditRange have completed range-based audit progress.
Future<bool> checkAuditProgressCompleteByRange(Database cx, AuditType auditType, UID auditId, KeyRange auditRange);

// Combined result of a RangeDigest audit over a key range.
struct RangeDigestSummary {
	RangeDigest root; // sum (mod 2^256) of all persisted per-range digests
	int64_t kvCount = 0;
	int64_t byteCount = 0;
	bool complete = true; // false if some sub-range has no persisted digest yet
	KeyRange incompleteRange; // first sub-range lacking a digest, when !complete
};

// Read the persisted per-range RangeDigest progress for `auditId` over `range` and combine it
// into a single cluster root (plus kv/byte totals). Because the combine is additive, this is
// independent of how the ranges were partitioned across storage servers.
//
// Stops at the first range it cannot count, so on !complete the totals are partial by construction
// and only `incompleteRange` is meaningful.
Future<RangeDigestSummary> getRangeDigestSummary(Database cx, UID auditId, KeyRange range);

// One entry of the persisted per-range RangeDigest progress, as read at a krm boundary.
struct RangeDigestRangeEntry {
	KeyRange boundaryRange; // the range this row was read at
	AuditStorageState state; // decoded row; meaningful only when `present`
	bool present = false; // false when the progress map has no row covering `boundaryRange`
	const char* rejectReason = nullptr; // nullptr when the row may be counted into a root
};

// Per-range detail behind getRangeDigestSummary, for operator inspection while an audit is Running.
// Unlike the summary this reads every range, so a partially covered audit still reports what it has.
// The progress metadata is cleared once the audit reaches Complete, after which this reads empty and
// the per-range history survives only in the SSAuditRangeDigestComplete trace events.
Future<std::vector<RangeDigestRangeEntry>> getRangeDigestProgress(Database cx, UID auditId, KeyRange range);

// Countability rules for one persisted per-range row; nullptr means the row may be counted.
// Shared so the summary and the operator-facing progress view cannot disagree about what counts.
const char* rangeDigestRowRejectReason(const AuditStorageState& s, KeyRange boundaryRange);

// Check whether a specific server's audit progress is complete for the given range.
Future<bool> checkAuditProgressCompleteByServer(Database cx,
                                                AuditType auditType,
                                                UID auditId,
                                                KeyRange auditRange,
                                                UID serverId,
                                                std::shared_ptr<AsyncVar<int>> checkProgressBudget);

// Initialize audit metadata on DD startup: resume incomplete audits and clean up old ones.
Future<std::vector<AuditStorageState>> initAuditMetadata(Database cx,
                                                         MoveKeyLockInfo lock,
                                                         bool ddEnabled,
                                                         UID dataDistributorId,
                                                         int persistFinishAuditCount);

// Result of reading a single server's owned ranges from the ServerKeys system key space.
struct AuditGetServerKeysRes {
	KeyRange completeRange; // the sub-range that was fully read in this batch
	Version readAtVersion;
	UID serverId;
	std::vector<KeyRange> ownRanges; // ranges this server owns according to ServerKeys
	int64_t readBytes;
	AuditGetServerKeysRes() = default;
	AuditGetServerKeysRes(KeyRange completeRange,
	                      Version readAtVersion,
	                      UID serverId,
	                      std::vector<KeyRange> ownRanges,
	                      int64_t readBytes)
	  : completeRange(completeRange), readAtVersion(readAtVersion), serverId(serverId), ownRanges(ownRanges),
	    readBytes(readBytes) {}
};

// Result of reading the KeyServers system key space: maps each server to the ranges it owns.
struct AuditGetKeyServersRes {
	KeyRange completeRange; // the sub-range that was fully read in this batch
	Version readAtVersion;
	int64_t readBytes;
	std::unordered_map<UID, std::vector<KeyRange>> rangeOwnershipMap;
	AuditGetKeyServersRes() = default;
	AuditGetKeyServersRes(KeyRange completeRange,
	                      Version readAtVersion,
	                      std::unordered_map<UID, std::vector<KeyRange>> rangeOwnershipMap,
	                      int64_t readBytes)
	  : completeRange(completeRange), readAtVersion(readAtVersion), rangeOwnershipMap(rangeOwnershipMap),
	    readBytes(readBytes) {}
};

// Merge overlapping or adjacent ranges in the input list into a minimal set of non-overlapping
// ranges covering the same key space.
std::vector<KeyRange> coalesceRangeList(std::vector<KeyRange> ranges);

// Compare two sorted, non-overlapping range lists for equivalence. Handles different split
// points that cover the same total range. Returns the first mismatched pair, or empty if equal.
Optional<std::pair<KeyRange, KeyRange>> rangesSame(std::vector<KeyRange> rangesA, std::vector<KeyRange> rangesB);

// A single consistency error found by checkLocationMetadataConsistency.
struct LocationMetadataError {
	std::string message;
	UID serverId;
	Optional<KeyRange> mismatchedRangeByKeyServer;
	Optional<KeyRange> mismatchedRangeByServerKey;
};

// Bidirectional consistency check between the KeyServers and ServerKeys views of shard
// ownership. Returns an error for each server that is missing from one side or has
// mismatched range assignments. An empty result means the two views are consistent.
std::vector<LocationMetadataError> checkLocationMetadataConsistency(
    const std::unordered_map<UID, std::vector<KeyRange>>& mapFromKeyServers,
    const std::unordered_map<UID, std::vector<KeyRange>>& mapFromServerKeys,
    Key
```

### Core Architecture Module: `fdbclient/include/fdbclient/ClientWorkerInterface.h`
```
/*
 * ClientWorkerInterface.h
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

#ifndef FDBCLIENT_CLIENTWORKERINTERFACE_H
#define FDBCLIENT_CLIENTWORKERINTERFACE_H
#pragma once

#include "fdbrpc/FlowGrpc.h"
#include "fdbclient/FDBTypes.h"
#include "fdbrpc/FailureMonitor.h"
#include "fdbclient/Status.h"
#include "fdbclient/CommitProxyInterface.h"

// Streams from WorkerInterface that are safe and useful to call from a client.
// A ClientWorkerInterface is embedded as the first element of a WorkerInterface.
struct ClientWorkerInterface {
	constexpr static FileIdentifier file_identifier = 12418152;

	RequestStream<struct RebootRequest> reboot;
	RequestStream<struct ProfilerRequest> profiler;
	RequestStream<struct SetFailureInjection> setFailureInjection;
	Optional<NetworkAddress> grpcAddress;

	bool operator==(ClientWorkerInterface const& r) const { return id() == r.id(); }
	bool operator!=(ClientWorkerInterface const& r) const { return id() != r.id(); }
	UID id() const { return reboot.getEndpoint().token; }
	NetworkAddress address() const { return reboot.getEndpoint().getPrimaryAddress(); }

	void initEndpoints() {
		reboot.getEndpoint(TaskPriority::ReadSocket);
#ifdef FLOW_GRPC_ENABLED
		auto grpcInstance = FlowGrpc::instance();
		if (grpcInstance) {
			grpcAddress = grpcInstance->server()->getAddress();
		}
#endif
	}

	template <class Ar>
	void serialize(Ar& ar) {
		serializer(ar, reboot, profiler, setFailureInjection, grpcAddress);
	}
};

struct RebootRequest {
	constexpr static FileIdentifier file_identifier = 11913957;
	bool deleteData;
	bool checkData;
	uint32_t waitForDuration; // seconds

	explicit RebootRequest(bool deleteData = false, bool checkData = false, uint32_t waitForDuration = 0)
	  : deleteData(deleteData), checkData(checkData), waitForDuration(waitForDuration) {}

	template <class Ar>
	void serialize(Ar& ar) {
		serializer(ar, deleteData, checkData, waitForDuration);
	}
};

struct ProfilerRequest {
	constexpr static FileIdentifier file_identifier = 15437862;
	ReplyPromise<Void> reply;

	enum class Type : std::int8_t {
		GPROF = 1,
		FLOW = 2,
		GPROF_HEAP = 3,
	};

	enum class Action : std::int8_t { DISABLE = 0, ENABLE = 1, RUN = 2 };

	Type type;
	Action action;
	int duration;
	Standalone<StringRef> outputFile;

	ProfilerRequest() = default;
	explicit ProfilerRequest(Type t, Action a, int d) : type(t), action(a), duration(d) {}

	template <class Ar>
	void serialize(Ar& ar) {
		serializer(ar, reply, type, action, duration, outputFile);
	}
};

struct SetFailureInjection {
	constexpr static FileIdentifier file_identifier = 15439864;
	ReplyPromise<Void> reply;
	struct DiskFailureCommand {
		// how often should the disk be stalled (0 meaning once, 10 meaning every 10 secs)
		double stallInterval;
		// Period of time disk stalls will be injected for
		double stallPeriod;
		// Period of time the disk will be slowed down for
		double throttlePeriod;

		template <class Ar>
		void serialize(Ar& ar) {
			serializer(ar, stallInterval, stallPeriod, throttlePeriod);
		}
	};

	struct FlipBitsCommand {
		// percent of bits to flip in the given file
		double percentBitFlips;

		template <class Ar>
		void serialize(Ar& ar) {
			serializer(ar, percentBitFlips);
		}
	};

	Optional<DiskFailureCommand> diskFailure;
	Optional<FlipBitsCommand> flipBits;

	template <class Ar>
	void serialize(Ar& ar) {
		serializer(ar, reply, diskFailure, flipBits);
	}
};
#endif

```

### Core Architecture Module: `fdbclient/include/fdbclient/RandomKeyValueUtils.h`
```
/*
 * RandomKeyValueUtils.h
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

#include <string>
#include <set>
#include <vector>
#include <algorithm>

#include "flow/Arena.h"
#include "flow/Error.h"
#include "flow/IRandom.h"
#include "fdbclient/FDBTypes.h"

template <typename T>
struct IGenerator {
	virtual T next() = 0;
	virtual T last() const = 0;
	virtual std::string toString() const = 0;
	virtual T next(int distance, bool wrap = false) { throw unsupported_operation(); }
	virtual ~IGenerator() = default;
};

struct IKeyGenerator : public IGenerator<Key> {
	virtual int getMaxKeyLen() const = 0;
};

// Random unsigned int generator which generates integers between and including first and last
// Distribution can be uniform, skewed small, or skewed large
// String Definition Format:  [^]first[..last]
//   last is optional and defaults to first
//   If ^ is present, the generated numbers skew toward first, otherwise are uniform random
//   If either first or last begins with a letter character it will be interpreted as its ASCII byte value.
struct RandomIntGenerator : IGenerator<unsigned int> {
	enum Skew { LARGE, SMALL, NONE };

	unsigned int min;
	unsigned int max;
	unsigned int val;
	bool alpha = false;
	Skew skew = NONE;

	unsigned int parseInt(StringRef s) {
		if (s.empty()) {
			return 0;
		} else if (std::isalpha(s[0])) {
			alpha = true;
			return (unsigned int)s[0];
		} else {
			return atol(s.toString().c_str());
		}
	}

	explicit RandomIntGenerator(unsigned int only = 0) : min(only), max(only) {}
	RandomIntGenerator(unsigned int first, unsigned int last, bool skewTowardFirst = false) : min(first), max(last) {
		if (first != last && skewTowardFirst) {
			skew = (first < last) ? SMALL : LARGE;
		}
		if (min > max) {
			std::swap(min, max);
		}
	}
	explicit(false) RandomIntGenerator(const char* cstr) : RandomIntGenerator(std::string(cstr)) {}
	explicit(false) RandomIntGenerator(std::string str) : RandomIntGenerator(StringRef(str)) {}
	explicit(false) RandomIntGenerator(StringRef str) {
		bool skewTowardFirst = false;
		if (!str.empty() && str[0] == '^') {
			skewTowardFirst = true;
			str = str.substr(1);
		}

		StringRef first = str.eat("..");
		StringRef last = str;
		if (last.empty()) {
			last = first;
		}

		min = parseInt(first);
		max = parseInt(last);
		if (skewTowardFirst && min != max) {
			skew = (min < max) ? SMALL : LARGE;
		}
		if (min > max) {
			std::swap(min, max);
		}
	}

	// Generate and return a random number
	unsigned int next() override {
		switch (skew) {
		case SMALL:
			return val = deterministicRandom()->randomSkewedUInt32(min, max + 1);
		case LARGE:
			return val = max - deterministicRandom()->randomSkewedUInt32(min, max + 1);
		case NONE:
		default:
			return val = deterministicRandom()->randomInt(min, max + 1);
		}
	}
	// Return the last random number returned by next()
	unsigned int last() const override { return val; }

	std::string formatLimit(int x) const {
		return (alpha && std::isalpha(x)) ? fmt::format("{}", (char)x) : fmt::format("{}", x);
	}

	std::string toString() const override {
		if (min == max) {
			return fmt::format("{}", min);
		}
		if (skew == NONE || skew == SMALL) {
			return fmt::format("{}{}..{}", (skew == NONE) ? "" : "^", formatLimit(min), formatLimit(max));
		}
		ASSERT(skew == LARGE);
		return fmt::format("^{}..{}", formatLimit(max), formatLimit(min));
	}
};

// Random string generator
// Generates random strings of a random size from a size int generator and made of random chars
// from a random char int generator
//
// String Definition Format:  sizeRange[/byteRange]
// sizeRange and byteRange are RandomIntGenerators
// The default `byteRange` is 0:255
struct RandomStringGenerator : IKeyGenerator {
	RandomStringGenerator() = default;
	RandomStringGenerator(RandomIntGenerator size, RandomIntGenerator byteset) : size(size), bytes(byteset) {}
	explicit(false) RandomStringGenerator(const char* cstr) : RandomStringGenerator(std::string(cstr)) {}
	explicit(false) RandomStringGenerator(std::string str) : RandomStringGenerator(StringRef(str)) {}
	explicit(false) RandomStringGenerator(StringRef str) {
		StringRef sSize = str.eat("/");
		StringRef sBytes = str;
		if (sBytes.empty()) {
			sBytes = "0:255"_sr;
		}
		size = RandomIntGenerator(sSize.toString());
		bytes = RandomIntGenerator(sBytes);
	}

	RandomIntGenerator size;
	RandomIntGenerator bytes;
	Standalone<StringRef> val;

	Standalone<StringRef> next() override {
		val = makeString(size.next());
		for (int i = 0; i < val.size(); ++i) {
			mutateString(val)[i] = (uint8_t)bytes.next();
		}
		return val;
	}

	Standalone<StringRef> last() const override { return val; };

	std::string toString() const override { return fmt::format("{}/{}", size.toString(), bytes.toString()); }

	int getMaxKeyLen() const override { return size.max - 1; }
};

// Same construction, definition, and usage as RandomStringGenerator but sacrifices randomness
// and uniqueness for performance.
// It uses a large pre-generated string and generates random substrings from it.
struct RandomValueGenerator {
	template <typename... Args>
	explicit RandomValueGenerator(Args&&... args) : strings(std::forward<Args>(args)...) {
		// Make a similar RandomStringGenerator to generate the noise block from
		noise = RandomStringGenerator(RandomIntGenerator(std::max<int>(2e6, strings.size.max)), strings.bytes).next();
	}

	RandomStringGenerator strings;
	Standalone<StringRef> noise;
	Value val;

	Value next() {
		int len = strings.size.next();
		val = Value(noise.substr(deterministicRandom()->randomInt(0, noise.size() - len + 1), len), noise.arena());
		return val;
	}

	Value last() const { return val; };

	std::string toString() const { return fmt::format("{}", strings.toString()); }

	int getMaxValLen() const { return strings.size.max - 1; }
};

// Base class for randomly generated key sets
// Returns a random or nearby key at some distance from a vector of keys generated at init time.
// Requires a RandomIntGenerator as the index generator for selecting which random next key to return.  The given index
// generator should have a min of 0 and if it doesn't its min will be updated to 0.
struct RandomStringSetGeneratorBase : IKeyGenerator {
	Arena arena;
	std::vector<KeyRef> keys;
	RandomIntGenerator indexGenerator;
	int iVal;
	KeyRange rangeVal;
	int maxKeyLen;

	template <typename KeyGen>
	void init(RandomIntGenerator originalIndexGenerator, KeyGen& keyGen) {
		indexGenerator = originalIndexGenerator;
		indexGenerator.min = 0;
		maxKeyLen = keyGen.getMaxKeyLen();
		ASSERT(indexGenerator.max > 0);
		std::set<Key> uniqueKeys;
		int inserts = 0;
		// for smaller indexGenerator.max, give it more insert try, as it may not find enough unique keys with 3 * max.
		// It adds roughly log * 100. For example, even for max is 1, it will try at least 100 times.
		const uint maxInsertTry = 3 * indexGenerator.max + (((sizeof(uint) * 8) - clz(indexGenerator.max)) * 100);
		while (uniqueKeys.size() < indexGenerator.max) {
			auto k = keyGen.next();
			uniqueKeys.insert(k);
			if (++inserts > maxInsertTry) {
				// StringGenerator cardinality is too low, unable to find enough unique keys.
				ASSERT(false);
			}
		}
		// Adjust indexGenerator max down by 1 because indices are 0-based.
		--indexGenerator.max;

		for (auto& k : uniqueKeys) {
			keys.push_back(KeyRef(arena, k));
		}
		iVal = 0;
	}

	Key last() const override { return Key(keys[iVal], arena); };
	KeyRange lastRange() const { return rangeVal; }

	Key next() override {
		iVal = indexGenerator.next();
		return last();
	}

	// Next sequential with some jump distance and optional wrap-around which is false
	Key next(int distance, bool wrap = false) override {
		iVal += distance;
		if (wrap) {
			iVal %= keys.size();
		} else {
			iVal = std::clamp<int>(iVal, 0, keys.size() - 1);
		}

		return last();
	}

	KeyRange nextRange(int width) {
		int begin = indexGenerator.next();
		int end = (begin + width) % keys.size();
		if (begin > end) {
			std::swap(begin, end);
		}
		rangeVal = KeyRange(KeyRangeRef(keys[begin], keys[end]), arena);
		return rangeVal;
	}

	KeyRange nextRange() { return nextRange(deterministicRandom()->randomSkewedUInt32(0, keys.size())); }

	int getMaxKeyLen() const override { return maxKeyLen; }
};

template <typename StringGenT>
struct RandomStringSetGenerator : public RandomStringSetGeneratorBase {
	RandomStringSetGenerator(RandomIntGenerator indexGen, StringGenT stringGen)
	  : indexGen(indexGen), stringGen(stringGen) {
		init(indexGen, stringGen);
	}
	explicit(false) RandomStringSetGenerator(const char* cstr) : RandomStringSetGenerator(std::string(cstr)) {}
	explicit(false) RandomStringSetGenerator(std::string str) : RandomStringSetGenerator(StringRef(str)) {}
	explicit(false) RandomStringSetGenerator(StringRef str) {
		indexGen = str.eat("::");
		stringGen = StringGenT(str);
		init(indexGen, stringGen);
	}

	RandomIntGenerator indexGen;
	StringGenT stringGen;

	std::string toString() const override { return fmt::format("{}::{}", indexGen.toString(), stringGen.toString()); }
};

using RandomKeySetGenerator = RandomStringSetGenerator<RandomStringGenerator>;

// Generate random keys which are composed of tuple segments from a list of RandomKeySets
// String Definition Format: RandomKeySet[,RandomKeySet]...
struct RandomKeyTupl
```

### Core Architecture Module: `fdbclient/include/fdbclient/WaitState.h`
```
/*
 * WaitState.h
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

#include <string_view>

enum class WaitState { Disk, Network, Running };
// usually we shouldn't use `using namespace` in a header file, but literals should be safe as user defined literals
// need to be prefixed with `_`
using namespace std::literals;

constexpr std::string_view to_string(WaitState st) {
	switch (st) {
	case WaitState::Disk:
		return "Disk"sv;
	case WaitState::Network:
		return "Network"sv;
	case WaitState::Running:
		return "Running"sv;
	default:
		return ""sv;
	}
}

```

### Core Architecture Module: `fdbrpc/QueueModel.cpp`
```
/*
 * QueueModel.cpp
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

#include "fdbrpc/QueueModel.h"
#include "fdbrpc/LoadBalance.h"

void QueueModel::endRequest(uint64_t id, double latency, double penalty, double delta, bool clean, bool futureVersion) {
	auto& d = data[id];

	// Remove the penalty added when starting the request.
	d.smoothOutstanding.addDelta(-delta);

	if (clean) {
		d.latency = latency;
	} else {
		d.latency = std::max(d.latency, latency);
	}

	if (futureVersion) {
		if (now() > d.increaseBackoffTime) {
			d.futureVersionBackoff = std::min(d.futureVersionBackoff * FLOW_KNOBS->FUTURE_VERSION_BACKOFF_GROWTH,
			                                  FLOW_KNOBS->FUTURE_VERSION_MAX_BACKOFF);
			d.increaseBackoffTime = now() + d.futureVersionBackoff;
		}
		d.failedUntil = now() + d.futureVersionBackoff;
	} else if (clean) {
		d.futureVersionBackoff = FLOW_KNOBS->FUTURE_VERSION_INITIAL_BACKOFF;
		d.increaseBackoffTime = 0.0;
	}

	if (penalty > 0) {
		d.penalty = penalty;
	}
}

QueueData const& QueueModel::getMeasurement(uint64_t id) {
	return data[id]; // return smoothed penalty
}

double QueueModel::addRequest(uint64_t id) {
	auto& d = data[id];
	d.smoothOutstanding.addDelta(d.penalty);
	return d.penalty;
}

Optional<LoadBalancedReply> getLoadBalancedReply(const LoadBalancedReply* reply) {
	return *reply;
}

Optional<LoadBalancedReply> getLoadBalancedReply(const void*) {
	return Optional<LoadBalancedReply>();
}

Optional<BasicLoadBalancedReply> getBasicLoadBalancedReply(const BasicLoadBalancedReply* reply) {
	return *reply;
}

Optional<BasicLoadBalancedReply> getBasicLoadBalancedReply(const void*) {
	return Optional<BasicLoadBalancedReply>();
}

/*
void QueueModel::addMeasurement( uint64_t id, QueueDetails qd ){
    if (data[new_index].count(id))
        total_time[new_index] -= data[new_index][id].queryQueueSize;
    data[new_index][id] = qd;
    total_time[new_index] += qd.queryQueueSize;
}

TimeEstimate QueueModel::getTimeEstimate( uint64_t id ){
    if (data[new_index].count(id))          // give the current estimate
        return data[new_index][id].queryQueueSize;
    else if (data[1-new_index].count(id))   // if not, old estimate
        return data[1-new_index][id].queryQueueSize;
    else									// if not, the average?
        return getAverageTimeEstimate();
}

TimeEstimate QueueModel::getAverageTimeEstimate(){
    if(data[new_index].size() + data[1-new_index].size() > 0)
        return (total_time[new_index] + total_time[1-new_index]) / (data[new_index].size() + data[1-new_index].size());
    return 0;
}

void QueueModel::expire(){
    data[1-new_index].clear();
    total_time[1-new_index] = 0;

    new_index = 1-new_index;
}
*/

```

### Core Architecture Module: `fdbrpc/ReplicationUtils.cpp`
```
/*
 * ReplicationUtils.cpp
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

#include "fdbrpc/ReplicationUtils.h"
#include "flow/Hash3.h"
#include "flow/UnitTest.h"
#include "flow/Platform.h"
#include "fdbrpc/ReplicationPolicy.h"
#include "fdbrpc/Replication.h"

double ratePolicy(Reference<LocalitySet>& localitySet,
                  Reference<IReplicationPolicy> const& policy,
                  unsigned int nTestTotal) {
	double rating = -1.0;
	unsigned int uniqueResults = 0;
	int uniqueSet;
	std::map<std::set<LocalityEntry>, int> setMap;
	std::map<LocalityEntry, int> counterMap;
	std::vector<LocalityEntry> results;

	for (auto testIndex = 0u; testIndex < nTestTotal; testIndex++) {
		results.clear();
		if (!policy->selectReplicas(localitySet, results)) {
			printf("Failed to apply policy: %s to %d entries\n", policy->info().c_str(), localitySet->size());
			localitySet->DisplayEntries("rate");
			ASSERT(0);
			continue;
		}

		uniqueSet = setMap[std::set<LocalityEntry>(results.begin(), results.end())]++;

		if (!uniqueSet) {
			uniqueResults++;
			for (auto& result : results) {
				counterMap[result]++;
			}
		}
	}

	if (uniqueResults) {
		int largestMode = 0;
		LocalityEntry largestEntry;

		for (const auto& [entry, entryCount] : counterMap) {
			if (entryCount > largestMode) {
				largestMode = entryCount;
				largestEntry = entry;
			}
		}
		rating = (double)largestMode / (double)uniqueResults;
		if (g_replicationdebug > 4) {
			printf("Rate entries:\n");
			localitySet->DisplayEntries("rate");
		}
		if (g_replicationdebug > 3) {
			printf("  largest: (%5d) %7.5f  %7d of%7u  %s",
			       largestMode,
			       rating,
			       uniqueResults,
			       nTestTotal,
			       localitySet->getEntryInfo(largestEntry).c_str());
		}
	}

	return rating;
}

int mostUsedZoneCount(Reference<LocalitySet>& logServerSet, std::vector<LocalityEntry>& bestSet) {
	AttribKey indexKey = logServerSet->keyIndex("zoneid");
	std::map<AttribValue, int> entries;
	for (int i = 0; i < bestSet.size(); i++) {
		Optional<AttribValue> value = logServerSet->getRecordViaEntry(bestSet[i])->getValue(indexKey);
		entries[value.get()]++;
	}
	int maxEntries = 0;
	for (const auto& [_zoneId, entryCount] : entries) {
		maxEntries = std::max(maxEntries, entryCount);
	}
	return maxEntries;
}

bool findBestPolicySetSimple(int targetUniqueValueCount,
                             Reference<LocalitySet>& logServerSet,
                             std::vector<LocalityEntry>& bestSet,
                             int desired) {
	auto& mutableEntries = logServerSet->getMutableEntries();
	// First make sure the current localitySet is able to fulfuill the policy
	AttribKey indexKey = logServerSet->keyIndex("zoneid");
	int uniqueValueCount = logServerSet->getKeyValueArray()[indexKey._id].size();

	if (uniqueValueCount < targetUniqueValueCount) {
		// logServerSet won't be able to fulfill the policy
		return false;
	}

	std::map<AttribValue, std::vector<int>> entries;
	for (int i = 0; i < mutableEntries.size(); i++) {
		Optional<AttribValue> value = logServerSet->getRecord(mutableEntries[i]._id)->getValue(indexKey);
		if (value.present()) {
			entries[value.get()].push_back(i);
		}
	}

	ASSERT_WE_THINK(uniqueValueCount == entries.size());
	std::vector<std::vector<int>> randomizedEntries;
	randomizedEntries.resize(entries.size());
	for (const auto& [_zoneId, entryIndexes] : entries) {
		randomizedEntries.push_back(entryIndexes);
	}
	deterministicRandom()->randomShuffle(randomizedEntries);

	desired = std::max(desired, targetUniqueValueCount);
	auto it = randomizedEntries.begin();
	while (bestSet.size() < desired) {
		if (!it->empty()) {
			bestSet.push_back(mutableEntries[it->back()]);
			it->pop_back();
		}

		++it;
		if (it == randomizedEntries.end()) {
			it = randomizedEntries.begin();
		}
	}

	return true;
}

bool findBestPolicySetExpensive(std::vector<LocalityEntry>& bestResults,
                                Reference<LocalitySet>& localitySet,
                                Reference<IReplicationPolicy> const& policy,
                                unsigned int nMinItems,
                                unsigned int nSelectTests,
                                unsigned int nPolicyTests) {
	bool bSucceeded = true;
	Reference<LocalitySet> bestLocalitySet, testLocalitySet;
	std::vector<LocalityEntry> results;
	double testRate, bestRate = -1.0;

	if (g_replicationdebug > 3) {
		printf("Finding best from LocalitySet:\n");
		localitySet->DisplayEntries();
	}

	for (auto policyTest = 0u; policyTest < nPolicyTests; policyTest++) {
		results.clear();
		if (!policy->selectReplicas(localitySet, results)) {
			bSucceeded = false;
			break;
		}

		if (g_replicationdebug > 5) {
			printf("policy set #%5d:\n", policyTest);
			LocalitySet::staticDisplayEntries(localitySet, results, "result");
		}

		// Get some additional random items, if needed
		if ((nMinItems > results.size()) && (!localitySet->random(results, results, nMinItems - results.size()))) {
			bSucceeded = false;
			break;
		}

		if (g_replicationdebug > 4) {
			printf("policy with extras #%5d:\n", policyTest);
			LocalitySet::staticDisplayEntries(localitySet, results, "extra ");
		}

		// Create the test locality Set
		testLocalitySet = localitySet->restrict(results);

		// Get the test rate
		testRate = ratePolicy(testLocalitySet, policy, nSelectTests);

		if (g_replicationdebug > 3) {
			printf("   rate: %7.5f\n", testRate);
		}

		if (bestRate < 0.0) {
			bestResults = results;
			bestRate = testRate;
			bestLocalitySet = testLocalitySet;
		}
		// Allow the occasional bad comparison, if buggified
		else if (!buggify() ? (testRate < bestRate) : (testRate > bestRate)) {
			bestResults = results;
			bestRate = testRate;
			bestLocalitySet = testLocalitySet;
		}
	}

	if (g_replicationdebug > 2) {
		printf("BestSet: %7.5f\n", bestRate);
		if (bestRate >= 0.0)
			bestLocalitySet->DisplayEntries();
	}

	return bSucceeded;
}

bool findBestPolicySet(std::vector<LocalityEntry>& bestResults,
                       Reference<LocalitySet>& localitySet,
                       Reference<IReplicationPolicy> const& policy,
                       unsigned int nMinItems,
                       unsigned int nSelectTests,
                       unsigned int nPolicyTests) {

	bool bestFound = false;

	// Specialization for policies of shape:
	//    - PolicyOne()
	//    - PolicyAcross(,"zoneId",PolicyOne())
	//    - TODO: More specializations for common policies
	if (policy->name() == "One") {
		bestFound = true;
		int count = 0;
		auto& mutableEntries = localitySet->getMutableEntries();
		deterministicRandom()->randomShuffle(mutableEntries);
		for (auto const& entry : mutableEntries) {
			bestResults.push_back(entry);
			if (++count == nMinItems)
				break;
		}
	} else if (policy->name() == "Across") {
		auto* pa = (PolicyAcross*)policy.getPtr();
		std::set<std::string> attributeKeys;
		pa->attributeKeys(&attributeKeys);
		if (pa->embeddedPolicyName() == "One" && attributeKeys.size() == 1 &&
		    *attributeKeys.begin() == "zoneid" // This algorithm can actually apply to any field
		) {
			bestFound = findBestPolicySetSimple(pa->getCount(), localitySet, bestResults, nMinItems);
			if (bestFound && g_network->isSimulated()) {
				std::vector<LocalityEntry> oldBest;
				auto oldBestFound =
				    findBestPolicySetExpensive(oldBest, localitySet, policy, nMinItems, nSelectTests, nPolicyTests);
				if (!oldBestFound) {
					TraceEvent(SevError, "FBPSMissmatch").detail("Policy", policy->info());
				} else {
					ASSERT(mostUsedZoneCount(localitySet, bestResults) <= mostUsedZoneCount(localitySet, oldBest));
				}
			}
		} else {
			bestFound =
			    findBestPolicySetExpensive(bestResults, localitySet, policy, nMinItems, nSelectTests, nPolicyTests);
		}
	} else {
		bestFound = findBestPolicySetExpensive(bestResults, localitySet, policy, nMinItems, nSelectTests, nPolicyTests);
	}
	return bestFound;
}

bool validateAllCombinations(std::vector<LocalityData>& offendingCombo,
                             LocalityGroup const& localitySet,
                             Reference<IReplicationPolicy> const& policy,
                             std::vector<LocalityData> const& newItems,
                             unsigned int nCombinationSize,
                             bool bCheckIfValid) {
	bool bValid = true;

	// Check the current set's validity before adding combinations.
	if (newItems.size() < nCombinationSize || localitySet.validate(policy) != bCheckIfValid) {
		bValid = false;
	} else {
		bool bIsValidGroup;
		Reference<LocalitySet> localSet = makeReference<LocalityGroup>();
		auto* localGroup = (LocalityGroup*)localSet.getPtr();
		localGroup->deep_copy(localitySet);

		std::vector<LocalityEntry> localityGroupEntries = localGroup->getEntries();
		int originalSize = localityGroupEntries.size();

		for (int i = 0; i < newItems.size(); ++i) {
			localGroup->add(newItems[i]);
		}

		std::string bitmask(nCombinationSize, 1); // K leading 1's
		bitmask.resize(newItems.size(), 0); // N-K trailing 0's

		std::vector<LocalityEntry> resultEntries;
		do {
			localityGroupEntries.resize(originalSize);
			// [0..N-1] integers
			for (int i = 0; i < bitmask.size(); ++i) {
				if (bitmask[i]) {
					localityGroupEntries.push_back(localGroup->getEntry(originalSize + i));
				}
			}

			res
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

### Incident Patch 1: `4183094c` (2026-10-05)
**Commit Message**: documentation: remove msbuild version manifest parsing

this xml parsing is not needed, the cmake code does pass
version and release flags to sphinx-build

**File**: `documentation/sphinx/conf.py` (modified, +3/-28)
```diff
@@ -52,34 +52,9 @@
 project = "FoundationDB"
 copyright = "2013-2025 Apple, Inc and the FoundationDB project authors"
 
-version_path = os.path.join(
-    os.path.dirname(sys.executable), "..", "..", "..", "versions.target"
-)
-if os.path.exists(version_path):
-    # Load the version information from 'versions.target'
-    import xml.etree.ElementTree as ET
-
-    tree = ET.parse(version_path)
-    root = tree.getroot()
-
-    # The version info for the project you're documenting, acts as replacement for
-    # |version| and |release|, also used in various other places throughout the
-    # built documents.
-    #
-    # The short X.Y version.
-    version = root.find(
-        ".//{http://schemas.microsoft.com/developer/msbuild/2003}PackageName"
-    ).text
-    # The full version, including alpha/beta/rc tags.
-    # FoundationDB special note: also see guide-common.rst.inc and update the link to the EC2 template
-    release = root.find(
-        ".//{http://schemas.microsoft.com/developer/msbuild/2003}Version"
-    ).text
-else:
-    # Version and release will be overridden by sphinx command line
-    version = None
-    release = None
-
+# Version and release will be overridden by sphinx command line
+version = None
+release = None
 
 # The language for content autogenerated by Sphinx. Refer to documentation
 # for a list of supported languages.
```

---

### Incident Patch 2: `f8e1e90a` (2026-10-05)
**Commit Message**: Fix heap OOB read parsing globalConfigVersionKey in GRV proxy (#14196)

* Fix heap OOB read parsing globalConfigVersionKey in GRV proxy

Problem: globalConfigRefresh() memcpy'd sizeof(Version) (8) bytes out of
the value read back for the system key globalConfigVersionKey
("\xff/globalConfig/v") with no check that the value was actually that
long. This is an ordinary system key, not the specially restricted
"\xff\xff" range, so any client transaction that sets
FDBTransactionOptions::ACCESS_SYSTEM_KEYS -- a standard, public
transaction option, not an admin-gated one -- can commit an
undersized or empty value to it directly, bypassing the versionstamp
mechanism (GlobalConfig::trigger()) that normally produces a 10-byte
value.

Trigger: FDB's trust model treats any client with a live transaction as
already trusted -- ACCESS_SYSTEM_KEYS is a standard, public transaction
option, and a client with transaction access can already do essentially
anything to the data. This isn't a privilege-escalation issue; it's a
resilience issue. One transaction (tr->set with ACCESS_SYSTEM_KEYS, any
length including empty) -- whether from a buggy or misbehaving client, a
torn/partial write from a crash, or

**File**: `fdbserver/grvproxy/GrvProxyServer.cpp` (modified, +59/-16)
```diff
@@ -40,6 +40,7 @@
 #include "flow/Buggify.h"
 #include "flow/IRandom.h"
 #include "flow/Trace.h"
+#include "flow/UnitTest.h"
 #include "flow/flow.h"
 #include "flow/CoroUtils.h"
 #include "flow/genericactors.h"
@@ -302,26 +303,68 @@ Future<Void> globalConfigMigrate(GrvProxyData* grvProxyData) {
 // Periodically refresh local copy of global configuration.
 Future<Void> globalConfigRefresh(GrvProxyData* grvProxyData, Version* cachedVersion, RangeResult* cachedData) {
 	auto tr = makeReference<ReadYourWritesTransaction>(grvProxyData->cx);
-	while (true) {
-		Error err;
-		try {
-			tr->setOption(FDBTransactionOptions::READ_SYSTEM_KEYS);
-			Future<Optional<Value>> globalConfigVersionFuture = tr->get(globalConfigVersionKey);
-			Future<RangeResult> tmpCachedDataFuture = tr->getRange(globalConfigDataKeys, CLIENT_KNOBS->TOO_MANY);
-			Optional<Value> globalConfigVersion = co_await globalConfigVersionFuture;
-			RangeResult tmpCachedData = co_await tmpCachedDataFuture;
-			*cachedData = tmpCachedData;
-			if (globalConfigVersion.present()) {
-				Version parsedVersion;
-				memcpy(&parsedVersion, globalConfigVersion.get().begin(), sizeof(Version));
-				*cachedVersion = bigEndian64(parsedVersion);
+	try {
+		while (true) {
+			Error err;
+			try {
+				tr->setOption(FDBTransactionOptions::READ_SYSTEM_KEYS);
+				Future<Optional<Value>> globalConfigVersionFuture = tr->get(globalConfigVersionKey);
+				Future<RangeResult> tmpCachedDataFuture = tr->getRange(globalConfigDataKeys, CLIENT_KNOBS->TOO_MANY);
+				Optional<Value> globalConfigVersion = co_await globalConfigVersionFuture;
+				RangeResult tmpCachedData = co_await tmpCachedDataFuture;
+				// Update together: these are served to clients as a matched pair.
+				if (globalConfigVersion.present()) {
+					Version parsedVersion =
+					    BinaryReader::fromStringRef<Version>(globalConfigVersion.get(), Unversioned());
+					*cachedVersion = bigEndian64(parsedVersion);
+				}
+				*cachedData = tmpCachedData;
+				co_return;
+			} catch (Error& e) {
+				err = e;
 			}
-			co_return;
+			co_await tr->onError(err);
+		}
+	} catch (Error& e) {
+		if (e.code() == error_code_actor_cancelled) {
+			throw;
+		}
+		// Non-retryable error: keep the last-good cache and retry next refresh.
+		TraceEvent(SevWarnAlways, "GlobalConfigRefreshError").errorUnsuppressed(e).suppressFor(60.0);
+	}
+}
+
+TEST_CASE("/fdbserver/GrvProxyServer/GlobalConfigVersionKeyRejectsUndersizedValue") {
+	if (!g_network->isSimulated()) {
+		for (int size = 0; size < sizeof(Version); ++size) {
+			Standalone<StringRef> tooShort(std::string(size, '\x01'));
+			try {
+				BinaryReader::fromStringRef<Version>(tooShort, Unversioned());
+				ASSERT(false);
+			} catch (Error& e) {
+				ASSERT_EQ(e.code(), error_code_serialization_failed);
+			}
+		}
+
+		// StringRef's default constructor is data(nullptr), length(0) -- distinct
+		// from the size-0 case above, whose backing std::string::c_str() is a
+		// valid non-null pointer even when empty. A genuinely null data pointer
+		// must not be dereferenced before the length check rejects the read.
+		StringRef nullValue;
+		ASSERT(nullValue.begin() == nullptr);
+		try {
+			BinaryReader::fromStringRef<Version>(nullValue, Unversioned());
+			ASSERT(false);
 		} catch (Error& e) {
-			err = e;
+			ASSERT_EQ(e.code(), error_code_serialization_failed);
 		}
-		co_await tr->onError(err);
 	}
+
+	// A versionstamp is 10 bytes; only the leading sizeof(Version) are used.
+	Standalone<StringRef> versionstamp("\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00"_sr);
+	ASSERT_EQ(BinaryReader::fromStringRef<Version>(versionstamp, Unversioned()), bigEndian64(Version(1)));
+
+	return Void();
 }
 
 // Handle common GlobalConfig transactions on the server side, because not all
```

---

### Incident Patch 3: `ab17784b` (2026-10-02)
**Commit Message**: tests: fix fdb_test_runner fdb_version.py handling

This situation came about from 085f9a6a5458 and f95c3a464915

**File**: `tests/CMakeLists.txt` (modified, +18/-5)
```diff
@@ -1,13 +1,30 @@
 include(AddFdbTest)
 
+# Copy the fdb_test_runner package to the build dir, along with fdb_version.py
+# generated with this build's versions, for the venv to install from there.
+# "pyproject.toml" is used as proxy-marker for whether dir is up-to-date.
+set(test_runner_src_dir ${PROJECT_SOURCE_DIR}/tests/TestRunner)
+set(test_runner_pkg_dir ${PROJECT_BINARY_DIR}/tests/TestRunner)
+file(GLOB_RECURSE test_runner_srcs ${test_runner_src_dir}/*.py)
+add_custom_command(
+  OUTPUT  ${test_runner_pkg_dir}/pyproject.toml
+  DEPENDS ${test_runner_src_dir}/pyproject.toml ${test_runner_srcs}
+  COMMAND ${CMAKE_COMMAND} -E copy_directory ${test_runner_src_dir} ${test_runner_pkg_dir}
+  COMMENT "copy TestRunner")
+configure_file(${test_runner_src_dir}/fdb_version.py.cmake ${test_runner_pkg_dir}/fdb_test_runner/fdb_version.py)
+add_custom_target(test_runner_package ALL DEPENDS ${test_runner_pkg_dir}/pyproject.toml)
+
+# Used for ENABLE_SIMULATION_TESTS
+set(TestRunner "${test_runner_pkg_dir}/run_test_runner.py")
+
 # Test for setting up Python venv for client tests.
 # Adding this test as a fixture to another test allows the use of non-native Python packages within client test scripts
 # by installing dependencies from requirements.txt
 set(test_venv_cmd "")
 string(APPEND test_venv_cmd "${Python3_EXECUTABLE} -m venv ${test_venv_dir} ")
 string(APPEND test_venv_cmd "&& ${test_venv_activate} ")
 string(APPEND test_venv_cmd "&& pip install --retries 9 -r ${CMAKE_SOURCE_DIR}/tests/TestRunner/requirements.txt ")
-string(APPEND test_venv_cmd "&& pip install ${CMAKE_SOURCE_DIR}/tests/TestRunner ")
+string(APPEND test_venv_cmd "&& pip install ${test_runner_pkg_dir} ")
 string(APPEND test_venv_cmd "&& pip install ${CMAKE_BINARY_DIR}/bindings/python ")
 
 # The module is also included by fdbcli; register this shared fixture only once.
@@ -54,10 +71,6 @@ if(WITH_PYTHON)
   Or provide a path to another fdbserver")
   endif()
 
-  configure_file(${PROJECT_SOURCE_DIR}/tests/TestRunner/fdb_version.py.cmake ${PROJECT_BINARY_DIR}/tests/TestRunner/fdb_test_runner/fdb_version.py)
-
-  set(TestRunner "${PROJECT_SOURCE_DIR}/tests/TestRunner/run_test_runner.py")
-
   configure_file(${PROJECT_SOURCE_DIR}/tests/CTestCustom.ctest.cmake ${PROJECT_BINARY_DIR}/CTestCustom.ctest @ONLY)
 
   set(MULTIREGION_IGNORE_PATTERNS "")
```

**File**: `tests/TestRunner/fdb_test_runner.egg-info/PKG-INFO` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-Metadata-Version: 2.4
-Name: fdb-test-runner
-Version: 0.1.0
-Summary: FoundationDB Test Runner utilities
-Requires-Python: >=3.9
```

**File**: `tests/TestRunner/fdb_test_runner.egg-info/SOURCES.txt` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-pyproject.toml
-fdb_test_runner/TestDirectory.py
-fdb_test_runner/TestRunner.py
-fdb_test_runner/__init__.py
-fdb_test_runner/authz_util.py
-fdb_test_runner/binary_download.py
-fdb_test_runner/cluster_args.py
-fdb_test_runner/fake_cluster.py
-fdb_test_runner/fdb_version.py
-fdb_test_runner/local_cluster.py
-fdb_test_runner/test_util.py
-fdb_test_runner/tmp_cluster.py
-fdb_test_runner/tmp_multi_cluster.py
-fdb_test_runner/upgrade_test.py
-fdb_test_runner.egg-info/PKG-INFO
-fdb_test_runner.egg-info/SOURCES.txt
-fdb_test_runner.egg-info/dependency_links.txt
-fdb_test_runner.egg-info/top_level.txt
\ No newline at end of file
```

**File**: `tests/TestRunner/fdb_test_runner.egg-info/dependency_links.txt` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-
```

**File**: `tests/TestRunner/fdb_test_runner.egg-info/top_level.txt` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-fdb_test_runner
```

**File**: `tests/TestRunner/fdb_test_runner/fdb_version.py` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-CURRENT_VERSION = "8.0.0"
-FUTURE_VERSION = "8.1.0"
-PREV_RELEASE_VERSION = "7.4.5"
-PREV2_RELEASE_VERSION = "7.3.59"
```

---

### Incident Patch 4: `b7728cea` (2026-10-02)
**Commit Message**: Use clang-tidy 19 from the build toolchain

**File**: `.clang-tidy` (modified, +1/-4)
```diff
@@ -16,7 +16,6 @@ Checks: >
   bugprone-macro-repeated-side-effects,
   bugprone-misplaced-widening-cast,
   bugprone-move-forwarding-reference,
-  bugprone-nondeterministic-pointer-iteration-order,
   bugprone-posix-return,
   bugprone-redundant-branch-condition,
   bugprone-return-const-ref-from-parameter,
@@ -58,9 +57,7 @@ Checks: >
   readability-const-return-type,
   readability-container-size-empty,
   readability-delete-null-pointer,
-  readability-duplicate-include,
-  readability-inconsistent-ifelse-braces
-HeaderFilterRegex: ''
+  readability-duplicate-include
 CheckOptions:
   - key: bugprone-dangling-handle.HandleClasses
     value: 'std::basic_string_view;std::experimental::basic_string_view;std::span;StringRef'
```

**File**: `.github/workflows/tidy.yml` (modified, +3/-8)
```diff
@@ -29,17 +29,12 @@ jobs:
           # get history of all branches so we can find merge-base
           fetch-depth: 0
 
-      - name: Install clang-tidy
-        run: |
-          python3 -m venv "$RUNNER_TEMP/clang-tidy"
-          "$RUNNER_TEMP/clang-tidy/bin/python" -m pip install --disable-pip-version-check --only-binary=:all: --no-deps --require-hashes -r /dev/stdin <<'EOF'
-          clang-tidy==22.1.8 --hash=sha256:1a3de07ba82d4403d8b692ae63a5520d4db5c606014c92c24bbcef9259057bf1
-          EOF
-          echo "$RUNNER_TEMP/clang-tidy/bin" >> "$GITHUB_PATH"
-
       - name: Validate clang-tidy configuration
         run: |
+          clang --version
           clang-tidy --version
+          clang --version | grep -q '^clang version 19\.'
+          clang-tidy --version | grep -q 'LLVM version 19\.'
           clang-tidy --verify-config --config-file=.clang-tidy
 
       - name: Configure build
```

**File**: `documentation/sphinx/source/clang-tidy.rst` (modified, +13/-13)
```diff
@@ -10,21 +10,18 @@ This guide explains how to run ``clang-tidy`` locally so you can fix issues befo
 What clang-tidy checks
 ======================
 
-FoundationDB configures 59 named checks in the ``.clang-tidy`` file at the repository root.
-Use clang-tidy 22 or later for the complete check set; CI pins a checksum-verified
-clang-tidy 22.1.8 package. Inspect enabled checks with ``clang-tidy --list-checks``.
+FoundationDB configures 57 named checks in the ``.clang-tidy`` file at the repository root.
+Use clang-tidy 19 to match the Clang 19 build toolchain. CI uses the clang-tidy
+provided by the build image and verifies that both tools are version 19.
+Inspect enabled checks with ``clang-tidy --list-checks``.
 The intent is to enable more as we go forward. Here are some example rules:
 
-* **39 Bugprone rules** -- catch potential runtime errors, including unsafe self-assignment, forwarding constructors that hide copy or move constructors, narrow accumulation initializers, mismatched argument comments, obvious infinite loops, chained comparisons, swapped arguments, integer division in floating-point calculations, missed base-class copy construction, repeated macro argument evaluation, near-miss virtual overrides, dangling returned references, incorrect erase/remove calls, incorrect POSIX error checks, discarded return values, duplicate branches, and address-dependent pointer iteration
+* **38 Bugprone rules** -- catch potential runtime errors, including unsafe self-assignment, forwarding constructors that hide copy or move constructors, narrow accumulation initializers, mismatched argument comments, obvious infinite loops, chained comparisons, swapped arguments, integer division in floating-point calculations, missed base-class copy construction, repeated macro argument evaluation, near-miss virtual overrides, dangling returned references, incorrect erase/remove calls, incorrect POSIX error checks, discarded return values, and duplicate branches
 * **1 C++ Core Guidelines rule** -- catch unsafe captures in coroutine lambdas (``cppcoreguidelines-avoid-capturing-lambda-coroutines``)
 * **2 Misc rules** -- catch redundant expressions and RAII objects held across coroutine suspension points
 * **4 Modernize rules** -- encourage modern C++ practices (e.g., ``modernize-use-auto``, ``modernize-use-override``)
 * **6 Performance rules** -- avoid unnecessary copies, hidden range-loop conversions, repeated vector growth in simple loops, inefficient generic algorithms over associative containers, pointless moves, and move constructors that copy movable members (``performance-for-range-copy``, ``performance-implicit-conversion-in-loop``, ``performance-inefficient-vector-operation``, ``performance-inefficient-algorithm``, ``performance-move-const-arg``, ``performance-move-constructor-init``)
-* **7 Readability rules** -- improve code clarity (e.g., ``readability-container-contains``, ``readability-container-size-empty``)
-
-``HeaderFilterRegex: ''`` preserves the scope used before clang-tidy 22:
-included-header diagnostics remain filtered out, while a header checked directly
-is analyzed as the main file. This keeps CI focused on eligible touched files.
+* **6 Readability rules** -- improve code clarity (e.g., ``readability-container-contains``, ``readability-container-size-empty``)
 
 ``misc-coroutine-hostile-raii`` checks Flow's blocking ``MutexHolder`` and
 ``ThreadSpinLockHolder`` guards as well as ``std::lock_guard`` and
@@ -116,19 +113,22 @@ On macOS (with Homebrew LLVM):
 
 .. code-block:: shell
 
-   export TIDY_DIFF=$(find $(brew --prefix llvm)/share/clang -name "clang-tidy-diff.py")
+   export PATH="$(brew --prefix llvm@19)/bin:$PATH"
+   export TIDY_DIFF=$(find $(brew --prefix llvm@19)/share/clang -name "clang-tidy-diff.py")
 
 On Linux:
 
 .. code-block:: shell
 
-   export TIDY_DIFF=$(find /usr/lib/llvm-*/share/clang -name "clang-tidy-diff.py" | head -n 1)
+   export PATH="/usr/lib/llvm-19/bin:$PATH"
+   export TIDY_DIFF=$(find /usr/lib/llvm-19/share/clang -name "clang-tidy-diff.py")
 
-To make this permanent, add to your ``~/.bashrc`` or ``~/.zshrc``:
+To make this permanent, add the corresponding ``PATH`` and ``TIDY_DIFF`` exports
+above to your ``~/.bashrc`` or ``~/.zshrc``, followed by:
 
 .. code-block:: shell
 
-   alias fdb-tidy='python3 $(find $(brew --prefix llvm 2>/dev/null || echo "/usr/lib/llvm-*") -name "clang-tidy-diff.py" | head -n 1) -p 1 -path .'
+   alias fdb-tidy='python3 "$TIDY_DIFF" -p 1 -path .'
 
 Step 3: Run against your changes
 ---------------------------------
```

**File**: `fdbserver/kvstore/VersionedBTree.cpp` (modified, +0/-2)
```diff
@@ -11189,8 +11189,6 @@ struct KVSource {
 		for (auto& p : prefixes) {
 			prefixesSorted.push_back(&p);
 		}
-		// The comparator orders prefix bytes; pointee addresses never affect ordering.
-		// NOLINTNEXTLINE(bugprone-nondeterministic-pointer-iteration-order)
 		std::sort(prefixesSorted.begin(), prefixesSorted.end(), [](const Prefix* a, const Prefix* b) {
 			return KeyRef((uint8_t*)a->begin(), a->size()) < KeyRef((uint8_t*)b->begin(), b->size());
 		});
```

**File**: `fdbserver/tester/TesterServer.cpp` (modified, +0/-2)
```diff
@@ -141,8 +141,6 @@ void printSimulatedTopology() {
 		return;
 	}
 	auto processes = g_simulator->getAllProcesses();
-	// Locality fields and network addresses determine order, never ProcessInfo pointer values.
-	// NOLINTNEXTLINE(bugprone-nondeterministic-pointer-iteration-order)
 	std::sort(processes.begin(), processes.end(), [](ISimulator::ProcessInfo* lhs, ISimulator::ProcessInfo* rhs) {
 		auto l = lhs->locality;
 		auto r = rhs->locality;
```

**File**: `fdbserver/workloads/UnitTests.cpp` (modified, +0/-2)
```diff
@@ -198,8 +198,6 @@ struct UnitTestWorkload : TestWorkload {
 			}
 		}
 
-		// The comparator orders test-name bytes, never UnitTest pointer addresses.
-		// NOLINTNEXTLINE(bugprone-nondeterministic-pointer-iteration-order)
 		std::sort(tests.begin(), tests.end(), [](auto lhs, auto rhs) {
 			return std::string_view(lhs->name) < std::string_view(rhs->name);
 		});
```

**File**: `flow/UnitTestRunner.cpp` (modified, +0/-1)
```diff
@@ -284,7 +284,6 @@ std::vector<UnitTest*> collectTests(const UnitTestRunnerOptions& options, const
 		}
 	}
 
-	// NOLINTNEXTLINE(bugprone-nondeterministic-pointer-iteration-order): The comparator orders names, not addresses.
 	std::sort(tests.begin(), tests.end(), [](auto lhs, auto rhs) {
 		return std::string_view(lhs->name) < std::string_view(rhs->name);
 	});
```

---

### Incident Patch 5: `2f937694` (2026-10-02)
**Commit Message**: Fix LocalityData value presence checks

**File**: `fdbrpc/Locality.cpp` (modified, +30/-0)
```diff
@@ -19,6 +19,7 @@
  */
 
 #include "fdbrpc/Locality.h"
+#include "flow/UnitTest.h"
 
 const UID LocalityData::UNSET_ID = UID(0x0ccb4e0feddb5583, 0x010f6b77d9d10ece);
 alignas(8) const StringRef LocalityData::keyProcessId = "processid"_sr;
@@ -41,3 +42,32 @@ LBDistance::Type loadBalanceDistance(LocalityData const& loc1, LocalityData cons
 	}
 	return LBDistance::DISTANT;
 }
+
+TEST_CASE("/fdbrpc/LocalityData/isPresent") {
+	LocalityData locality;
+	const Standalone<StringRef> value = "value"_sr;
+	const Standalone<StringRef> otherValue = "other"_sr;
+	const Standalone<StringRef> emptyValue = ""_sr;
+	const Optional<Standalone<StringRef>> unset;
+
+	locality.set("key"_sr, value);
+	ASSERT(locality.isPresent("key"_sr, value));
+	ASSERT(!locality.isPresent("key"_sr, otherValue));
+	ASSERT(!locality.isPresent("key"_sr, unset));
+
+	locality.set("unset"_sr, unset);
+	ASSERT(locality.isPresent("unset"_sr, unset));
+	ASSERT(!locality.isPresent("unset"_sr, value));
+	ASSERT(!locality.isPresent("unset"_sr, emptyValue));
+
+	locality.set("empty"_sr, emptyValue);
+	ASSERT(locality.isPresent("empty"_sr, emptyValue));
+	ASSERT(!locality.isPresent("empty"_sr, unset));
+	ASSERT(!locality.isPresent("empty"_sr, value));
+
+	ASSERT(!locality.isPresent("missing"_sr, value));
+	ASSERT(!locality.isPresent("missing"_sr, unset));
+	ASSERT(!LocalityData().isPresent("missing"_sr, value));
+	ASSERT(!LocalityData().isPresent("missing"_sr, unset));
+	return Void();
+}
```

**File**: `fdbrpc/include/fdbrpc/Locality.h` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ struct LocalityData {
 	bool isPresent(StringRef key) const { return (_data.find(key) != _data.end()); }
 	bool isPresent(StringRef key, Optional<Standalone<StringRef>> value) const {
 		auto pos = _data.find(key);
-		return (pos != _data.end()) ? false : (pos->second == value);
+		return pos != _data.end() && pos->second == value;
 	}
 
 	std::string describeValue(StringRef key) const {
```

---

### Incident Patch 6: `a7e0a5ad` (2026-10-02)
**Commit Message**: Fix remaining shared-header clang-tidy warnings

**File**: `fdbclient/include/fdbclient/JSONDoc.h` (modified, +2/-2)
```diff
@@ -122,7 +122,7 @@ struct JSONDoc {
 			const json_spirit::mObject* curObj = curVal ? &curVal->get_obj() : pObj;
 
 			// Make sure key exists, if not then return false
-			if (!curObj->count(key))
+			if (!curObj->contains(key))
 				return false;
 
 			// Advance curVal
@@ -170,7 +170,7 @@ struct JSONDoc {
 			}
 
 			// Make sure key exists, if not then return false
-			if (!curObj->count(key))
+			if (!curObj->contains(key))
 				(*curObj)[key] = json_spirit::mValue();
 
 			// Advance curVal
```

**File**: `fdbclient/include/fdbclient/TaskBucket.h` (modified, +1/-3)
```diff
@@ -446,9 +446,7 @@ struct TaskFuncBase : IDispatched<TaskFuncBase, Standalone<StringRef>, std::func
 		return Reference<TaskFuncBase>(dispatch(taskFuncType)());
 	}
 
-	static bool isValidTaskType(StringRef type) {
-		return !type.empty() && (dispatches().find(type) != dispatches().end());
-	}
+	static bool isValidTaskType(StringRef type) { return !type.empty() && dispatches().contains(type); }
 
 	static bool isValidTask(Reference<Task> task) {
 		auto itor = task->params.find(Task::reservedTaskParamKeyType);
```

**File**: `fdbclient/include/fdbclient/VersionVector.h` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ struct VersionVector {
 
 	bool hasVersion(const Tag& tag) const {
 		ASSERT(tag != invalidTag);
-		return versions.find(tag) != versions.end();
+		return versions.contains(tag);
 	}
 
 	// @pre assumes that the given tag has an entry in the version vector.
```

**File**: `fdbrpc/include/fdbrpc/Locality.h` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ struct LocalityData {
 
 	void set(StringRef key, Optional<Standalone<StringRef>> value) { _data[key] = value; }
 
-	bool isPresent(StringRef key) const { return (_data.find(key) != _data.end()); }
+	bool isPresent(StringRef key) const { return _data.contains(key); }
 	bool isPresent(StringRef key, Optional<Standalone<StringRef>> value) const {
 		auto pos = _data.find(key);
 		return (pos != _data.end()) ? false : (pos->second == value);
```

**File**: `fdbrpc/include/fdbrpc/simulator.h` (modified, +3/-7)
```diff
@@ -230,13 +230,11 @@ class ISimulator : public INetwork {
 		clearedAddresses[address]++;
 		TraceEvent("ClearAddress").detail("Address", address).detail("Value", clearedAddresses[address]);
 	}
-	bool isCleared(NetworkAddress const& address) const {
-		return clearedAddresses.find(address) != clearedAddresses.end();
-	}
+	bool isCleared(NetworkAddress const& address) const { return clearedAddresses.contains(address); }
 
 	void switchCluster(NetworkAddress const& address) { switchedCluster[address] = !switchedCluster[address]; }
 	bool hasSwitchedCluster(NetworkAddress const& address) const {
-		return switchedCluster.find(address) != switchedCluster.end() ? switchedCluster.at(address) : false;
+		return switchedCluster.contains(address) ? switchedCluster.at(address) : false;
 	}
 	void toggleGlobalSwitchCluster() { globalSwitchedCluster = !globalSwitchedCluster; }
 	bool globalHasSwitchedCluster() const { return globalSwitchedCluster; }
@@ -267,9 +265,7 @@ class ISimulator : public INetwork {
 		TraceEvent("IncludeAddressAll").detail("AddressTotal", excludedAddresses.size());
 		excludedAddresses.clear();
 	}
-	bool isExcluded(NetworkAddress const& address) const {
-		return excludedAddresses.find(address) != excludedAddresses.end();
-	}
+	bool isExcluded(NetworkAddress const& address) const { return excludedAddresses.contains(address); }
 
 	void disableSwapToMachine(Optional<Standalone<StringRef>> zoneId) { swapsDisabled.insert(zoneId); }
 	void enableSwapToMachine(Optional<Standalone<StringRef>> zoneId) {
```

**File**: `flow/include/flow/IDispatched.h` (modified, +2/-2)
```diff
@@ -52,8 +52,8 @@ struct IDispatched {
 #define REGISTER_DISPATCHED_ALIAS(Type, Instance, Target, Alias)                                                       \
 	struct Type##Instance {                                                                                            \
 		Type##Instance() {                                                                                             \
-			ASSERT(Type::dispatches().find(Alias) == Type::dispatches().end());                                        \
-			ASSERT(Type::dispatches().find(Target) != Type::dispatches().end());                                       \
+			ASSERT(!Type::dispatches().contains(Alias));                                                               \
+			ASSERT(Type::dispatches().contains(Target));                                                               \
 			Type::dispatches()[Alias] = Type::dispatches()[Target];                                                    \
 		}                                                                                                              \
 	};                                                                                                                 \
```

**File**: `flow/include/flow/genericactors.h` (modified, +1/-1)
```diff
@@ -1616,7 +1616,7 @@ Future<T> reportErrorsExcept(Future<T> in,
 		T t = co_await in;
 		co_return t;
 	} catch (Error& e) {
-		if (e.code() != error_code_actor_cancelled && (!pExceptErrors || !pExceptErrors->count(e.code())))
+		if (e.code() != error_code_actor_cancelled && (!pExceptErrors || !pExceptErrors->contains(e.code())))
 			TraceEvent(SevError, context, id).error(e);
 		throw;
 	}
```

---

### Incident Patch 7: `5b137444` (2026-10-02)
**Commit Message**: Fix remaining configured clang-tidy findings

**File**: `bindings/flow/tester/Tester.cpp` (modified, +2/-2)
```diff
@@ -1516,7 +1516,7 @@ struct AtomicOPFunc : InstructionFunc {
 		Standalone<StringRef> s3 = co_await items[2].value;
 		Standalone<StringRef> value = Tuple::unpack(s3).getString(0);
 
-		ASSERT(optionInfo.find(op.toString()) != optionInfo.end());
+		ASSERT(optionInfo.contains(op.toString()));
 
 		FDBMutationType atomicOp = optionInfo[op.toString()];
 
@@ -1569,7 +1569,7 @@ struct UnitTestsFunc : InstructionFunc {
 
 		const uint64_t locationCacheSize = 100001;
 		const uint64_t maxWatches = 10001;
-		const uint64_t timeout = 60 * 1000;
+		const uint64_t timeout = 60ULL * 1000;
 		const uint64_t noTimeout = 0;
 		const uint64_t retryLimit = 50;
 		const uint64_t noRetryLimit = -1;
```

**File**: `fdbcli/ExcludeCommand.cpp` (modified, +2/-3)
```diff
@@ -193,8 +193,7 @@ Future<Void> checkForCoordinators(Reference<IDatabase> db, std::set<AddressExclu
 	}
 
 	for (const auto& c : coordinatorList) {
-		if (exclusions.find(AddressExclusion(c.ip, c.port)) != exclusions.end() ||
-		    exclusions.find(AddressExclusion(c.ip)) != exclusions.end()) {
+		if (exclusions.contains(AddressExclusion(c.ip, c.port)) || exclusions.contains(AddressExclusion(c.ip))) {
 			fprintf(stderr, "WARNING: %s is a coordinator!\n", c.toString().c_str());
 			foundCoordinator = true;
 		}
@@ -346,7 +345,7 @@ Future<bool> excludeCommandActor(Reference<IDatabase> db, std::vector<StringRef>
 		}
 
 		for (const auto& exclusion : exclusionSet) {
-			if (absentExclusions.find(exclusion) != absentExclusions.end()) {
+			if (absentExclusions.contains(exclusion)) {
 				if (exclusion.port == 0) {
 					fprintf(stderr,
 					        "  %s(Whole machine)  ---- WARNING: Missing from cluster!Be sure that you excluded the "
```

**File**: `fdbcli/fdbcli.cpp` (modified, +2/-2)
```diff
@@ -163,9 +163,9 @@ class FdbOptions {
 	               Optional<StringRef> arg,
 	               bool intrans) {
 		auto transactionItr = transactionOptions.legalOptions.find(optionStr.toString());
-		if (transactionItr != transactionOptions.legalOptions.end())
+		if (transactionItr != transactionOptions.legalOptions.end()) {
 			setTransactionOption(tr, transactionItr->second, enabled, arg, intrans);
-		else {
+		} else {
 			fprintf(stderr,
 			        "ERROR: invalid option '%s'. Try `help options' for a list of available options.\n",
 			        optionStr.toString().c_str());
```

**File**: `fdbclient/SpecialKeySpace.cpp` (modified, +4/-6)
```diff
@@ -729,7 +729,7 @@ Future<RangeResult> DDStatsRangeImpl::getRange(ReadYourWritesTransaction* ryw,
 Key SpecialKeySpace::getManagementApiCommandOptionSpecialKey(const std::string& command, const std::string& option) {
 	Key prefix = "options/"_sr.withPrefix(moduleToBoundary[MODULE::MANAGEMENT].begin);
 	auto pair = command + "/" + option;
-	ASSERT(options.find(pair) != options.end());
+	ASSERT(options.contains(pair));
 	return prefix.withSuffix(pair);
 }
 
@@ -755,8 +755,7 @@ Future<RangeResult> ManagementCommandsOptionsImpl::getRange(ReadYourWritesTransa
 void ManagementCommandsOptionsImpl::set(ReadYourWritesTransaction* ryw, const KeyRef& key, const ValueRef& value) {
 	std::string option = key.removePrefix(getKeyRange().begin).toString();
 	// ignore all invalid keys
-	if (SpecialKeySpace::getManagementApiOptionsSet().find(option) !=
-	    SpecialKeySpace::getManagementApiOptionsSet().end()) {
+	if (SpecialKeySpace::getManagementApiOptionsSet().contains(option)) {
 		TraceEvent(SevDebug, "ManagementApiOption").detail("Option", option).detail("Key", key);
 		ryw->getSpecialKeySpaceWriteMap().insert(key, std::make_pair(true, Optional<Value>(value)));
 	}
@@ -769,8 +768,7 @@ void ManagementCommandsOptionsImpl::clear(ReadYourWritesTransaction* ryw, const
 void ManagementCommandsOptionsImpl::clear(ReadYourWritesTransaction* ryw, const KeyRef& key) {
 	std::string option = key.removePrefix(getKeyRange().begin).toString();
 	// ignore all invalid keys
-	if (SpecialKeySpace::getManagementApiOptionsSet().find(option) !=
-	    SpecialKeySpace::getManagementApiOptionsSet().end()) {
+	if (SpecialKeySpace::getManagementApiOptionsSet().contains(option)) {
 		ryw->getSpecialKeySpaceWriteMap().rawErase(singleKeyRange(key));
 	}
 }
@@ -1052,7 +1050,7 @@ Future<bool> checkExclusion(Database db,
 					if (!excluded) {
 						totalKvStoreUsedBytesNotExcluded += used_bytes;
 
-						if (disk_id.empty() || diskLocalities.find(disk_id) == diskLocalities.end()) {
+						if (disk_id.empty() || !diskLocalities.contains(disk_id)) {
 							totalKvStoreFreeBytesNotExcluded += free_bytes;
 							if (!disk_id.empty()) {
 								diskLocalities.insert(disk_id);
```

**File**: `fdbrpc/ReplicationUtils.cpp` (modified, +1/-1)
```diff
@@ -869,7 +869,7 @@ void filterLocalityDataForPolicy(const std::set<std::string>& keys, LocalityData
 	for (auto iter = ld->_data.begin(); iter != ld->_data.end();) {
 		auto prev = iter;
 		iter++;
-		if (keys.find(prev->first.toString()) == keys.end()) {
+		if (!keys.contains(prev->first.toString())) {
 			ld->_data.erase(prev);
 		}
 	}
```

**File**: `fdbrpc/sim2.cpp` (modified, +4/-4)
```diff
@@ -218,7 +218,7 @@ struct SimClogging {
 
 	bool disconnected(const IPAddress& from, const IPAddress& to) {
 		auto pair = std::make_pair(from, to);
-		if (g_simulator->speedUpSimulation || disconnectPairUntil.find(pair) == disconnectPairUntil.end()) {
+		if (g_simulator->speedUpSimulation || !disconnectPairUntil.contains(pair)) {
 			return false;
 		}
 
@@ -2208,7 +2208,7 @@ class Sim2 final : public ISimulator, public INetworkConnections {
 				if (!getSimulationPolicy() || getSimulationPolicy()->shouldIncludeInAvailabilityCheck(*processInfo)) {
 					if (!processInfo->isExcluded() && !processInfo->isCleared() && processInfo->isAvailable() &&
 					    (isProtectedAddress(processInfo->address) ||
-					     datacenterMachines.find(processInfo->locality.machineId()) == datacenterMachines.end())) {
+					     !datacenterMachines.contains(processInfo->locality.machineId()))) {
 						processesLeft.push_back(processInfo);
 					} else {
 						processesDead.push_back(processInfo);
@@ -2689,7 +2689,7 @@ class UDPSimSocket : public IUDPSocket, ReferenceCounted<UDPSimSocket> {
 	  : id(deterministicRandom()->randomUniqueID()), process(g_simulator->getCurrentProcess()),
 	    peerAddress(peerAddress), actors(false), _localAddress(localAddress) {
 		g_sim2.addressMap.emplace(_localAddress, process);
-		ASSERT(process->boundUDPSockets.find(localAddress) == process->boundUDPSockets.end());
+		ASSERT(!process->boundUDPSockets.contains(localAddress));
 		process->boundUDPSockets.emplace(localAddress, Reference<IUDPSocket>::addRef(this));
 	}
 	~UDPSimSocket() override {
@@ -2800,7 +2800,7 @@ Future<Reference<IUDPSocket>> Sim2::createUDPSocket(NetworkAddress toAddr) {
 		localAddress.ip = IPAddress(process->address.ip.toV4() + deterministicRandom()->randomInt(0, 256));
 	}
 	localAddress.port = deterministicRandom()->randomInt(40000, 60000);
-	while (process->boundUDPSockets.find(localAddress) != process->boundUDPSockets.end()) {
+	while (process->boundUDPSockets.contains(localAddress)) {
 		localAddress.port = deterministicRandom()->randomInt(40000, 60000);
 	}
 	return Reference<IUDPSocket>(makeReference<UDPSimSocket>(localAddress, toAddr));
```

**File**: `fdbserver/datadistributor/DDRelocationQueue.cpp` (modified, +2/-2)
```diff
@@ -927,9 +927,9 @@ void DDQueue::queueRelocation(RelocateShard rs, std::set<UID>& serversToLaunchFr
 		}
 
 		if (rd.keys.contains(rrs.keys)) {
-			if (foundActiveFetching)
+			if (foundActiveFetching) {
 				fetchingSourcesQueue.erase(fetchingSourcesItr);
-			else if (foundActiveRelocation) {
+			} else if (foundActiveRelocation) {
 				firstQueue->erase(firstRelocationItr);
 				for (int i = 1; i < rrs.src.size(); i++)
 					queue[rrs.src[i]].erase(rrs);
```

**File**: `fdbserver/datadistributor/DataDistribution.cpp` (modified, +8/-9)
```diff
@@ -2263,8 +2263,7 @@ Future<Void> scheduleBulkLoadJob(Reference<DataDistributor> self, Promise<Void>
 						// No matter whether the task range is aligned with the manifest entry range, the task
 						// begin key must be in the manifestEntryMap. See manifestEntryMap definition for more
 						// details.
-						ASSERT(self->bulkLoadJobManager.get().manifestEntryMap->find(task.getRange().begin) !=
-						       self->bulkLoadJobManager.get().manifestEntryMap->end());
+						ASSERT(self->bulkLoadJobManager.get().manifestEntryMap->contains(task.getRange().begin));
 						if (task.onAnyPhase(
 						        { BulkLoadPhase::Complete, BulkLoadPhase::Acknowledged, BulkLoadPhase::Error })) {
 							ASSERT(task.getRange().end == res[i + 1].key);
@@ -3431,9 +3430,9 @@ Future<ErrorOr<Void>> trySendSnapReq(RequestStream<WorkerSnapRequest> stream, Wo
 			    .detail("PeerAddress", stream.getEndpoint().getPrimaryAddress())
 			    .detail("Retry", snapReqRetry);
 			if (reply.getError().code() != error_code_request_maybe_delivered ||
-			    ++snapReqRetry > SERVER_KNOBS->SNAP_NETWORK_FAILURE_RETRY_LIMIT)
+			    ++snapReqRetry > SERVER_KNOBS->SNAP_NETWORK_FAILURE_RETRY_LIMIT) {
 				co_return ErrorOr<Void>(reply.getError());
-			else {
+			} else {
 				// retry for network failures with same snap UID to avoid snapshot twice
 				req = WorkerSnapRequest(req.snapPayload, req.snapUID, req.role);
 				co_await delay(snapRetryBackoff);
@@ -3521,7 +3520,7 @@ Future<std::map<NetworkAddress, std::pair<WorkerInterface, std::string>>> getSta
 
 			for (const auto& tlog : *tlogs) {
 				TraceEvent(SevDebug, "GetStatefulWorkersTLog").detail("Addr", tlog.address());
-				if (workersMap.find(tlog.address()) == workersMap.end()) {
+				if (!workersMap.contains(tlog.address())) {
 					TraceEvent(SevWarn, "MissingTLogWorkerInterface").detail("TlogAddress", tlog.address());
 					throw snap_tlog_failed();
 				}
@@ -3546,8 +3545,8 @@ Future<std::map<NetworkAddress, std::pair<WorkerInterface, std::string>>> getSta
 				// as we use primary addresses from storage and tlog interfaces above
 				NetworkAddress primary = worker.interf.address();
 				Optional<NetworkAddress> secondary = worker.interf.tLog.getEndpoint().addresses.secondaryAddress;
-				if (coordinatorsAddrSet.find(primary) != coordinatorsAddrSet.end() ||
-				    (secondary.present() && (coordinatorsAddrSet.find(secondary.get()) != coordinatorsAddrSet.end()))) {
+				if (coordinatorsAddrSet.contains(primary) ||
+				    (secondary.present() && coordinatorsAddrSet.contains(secondary.get()))) {
 					if (result.contains(primary)) {
 						ASSERT(workersMap[primary].id() == result[primary].first.id());
 						result[primary].second.append(",coord");
@@ -3881,9 +3880,9 @@ Future<Void> ddGetMetrics(GetDataDistributorMetricsRequest req,
 			rep.storageMetricsList = result.get();
 		} else {
 			auto& metricVec = result.get();
-			if (metricVec.empty())
+			if (metricVec.empty()) {
 				rep.midShardSize = 0;
-			else {
+			} else {
 				rep.midShardSize = getMedianShardSize(metricVec.contents());
 			}
 		}
```

---

### Incident Patch 8: `05f20f61` (2026-10-02)
**Commit Message**: Limit clang-tidy policy to four checks and retain audited lifetime fixes

**File**: `.clang-tidy` (modified, +0/-2)
```diff
@@ -41,7 +41,6 @@ Checks: >
   bugprone-use-after-move,
   bugprone-virtual-near-miss,
   cppcoreguidelines-avoid-capturing-lambda-coroutines,
-  cppcoreguidelines-avoid-reference-coroutine-parameters,
   misc-coroutine-hostile-raii,
   misc-redundant-expression,
   modernize-use-auto,
@@ -65,7 +64,6 @@ WarningsAsErrors: >
   bugprone-branch-clone,
   bugprone-nondeterministic-pointer-iteration-order,
   bugprone-unused-return-value,
-  cppcoreguidelines-avoid-reference-coroutine-parameters,
   performance-inefficient-algorithm
 HeaderFilterRegex: ''
 CheckOptions:
```

**File**: `bindings/flow/tester/Tester.cpp` (modified, +6/-2)
```diff
@@ -43,7 +43,9 @@ std::map<Standalone<StringRef>, Reference<Transaction>> trMap;
 const int ITERATION_PROGRESSION[] = { 256, 1000, 4096, 6144, 9216, 13824, 20736, 31104, 46656, 69984, 80000 };
 const int MAX_ITERATION = sizeof(ITERATION_PROGRESSION) / sizeof(int);
 
-static Future<Void> runTest(Reference<FlowTesterData> data, Reference<Database> db, Standalone<StringRef> prefix);
+static Future<Void> runTest(Reference<FlowTesterData> data,
+                            Reference<Database> const& db,
+                            StringRef const& prefix);
 
 THREAD_FUNC networkThread(void* api) {
 	// This is the fdb_flow network we're running on a thread
@@ -1713,7 +1715,9 @@ static Future<Void> doInstructions(Reference<FlowTesterData> data) {
 	// printf("Total num instructions:%d\n", data->instructions.size());
 }
 
-static Future<Void> runTest(Reference<FlowTesterData> data, Reference<Database> db, Standalone<StringRef> prefix) {
+static Future<Void> runTest(Reference<FlowTesterData> data,
+                            Reference<Database> const& db,
+                            StringRef const& prefix) {
 	ASSERT(data);
 	try {
 		data->db = db;
```

**File**: `documentation/coro_tutorial/tutorial.cpp` (modified, +2/-2)
```diff
@@ -461,7 +461,7 @@ bool transaction_done(void) {
 }
 
 template <class DB, class Fun>
-Future<Void> runTransactionWhile(DB db, Fun f) {
+Future<Void> runTransactionWhile(DB const& db, Fun f) {
 	Transaction tr(db);
 	while (true) {
 		Future<Void> onError;
@@ -482,7 +482,7 @@ Future<Void> runTransaction(DB const& db, Fun f) {
 }
 
 template <class DB, class Fun>
-Future<Void> runRYWTransaction(DB db, Fun f) {
+Future<Void> runRYWTransaction(DB const& db, Fun f) {
 	Future<Void> onError;
 	ReadYourWritesTransaction tr(db);
 	while (true) {
```

**File**: `documentation/sphinx/source/clang-tidy.rst` (modified, +7/-10)
```diff
@@ -10,34 +10,31 @@ This guide explains how to run ``clang-tidy`` locally so you can fix issues befo
 What clang-tidy checks
 ======================
 
-FoundationDB configures 60 named checks in the ``.clang-tidy`` file at the repository root.
+FoundationDB configures 59 named checks in the ``.clang-tidy`` file at the repository root.
 Use clang-tidy 22 or later for the complete check set; CI pins a checksum-verified
 clang-tidy 22.1.8 package. Inspect enabled checks with ``clang-tidy --list-checks``.
 The intent is to enable more as we go forward. Here are some example rules:
 
 * **39 Bugprone rules** -- catch potential runtime errors, including unsafe self-assignment, forwarding constructors that hide copy or move constructors, narrow accumulation initializers, mismatched argument comments, obvious infinite loops, chained comparisons, swapped arguments, integer division in floating-point calculations, missed base-class copy construction, repeated macro argument evaluation, near-miss virtual overrides, dangling returned references, incorrect erase/remove calls, incorrect POSIX error checks, discarded return values, duplicate branches, and address-dependent pointer iteration
-* **2 C++ Core Guidelines rules** -- catch unsafe captures in coroutine lambdas and reference parameters in coroutines (``cppcoreguidelines-avoid-capturing-lambda-coroutines``, ``cppcoreguidelines-avoid-reference-coroutine-parameters``)
+* **1 C++ Core Guidelines rule** -- catch unsafe captures in coroutine lambdas (``cppcoreguidelines-avoid-capturing-lambda-coroutines``)
 * **2 Misc rules** -- catch redundant expressions and RAII objects held across coroutine suspension points
 * **4 Modernize rules** -- encourage modern C++ practices (e.g., ``modernize-use-auto``, ``modernize-use-override``)
 * **6 Performance rules** -- avoid unnecessary copies, hidden range-loop conversions, repeated vector growth in simple loops, inefficient generic algorithms over associative containers, pointless moves, and move constructors that copy movable members (``performance-for-range-copy``, ``performance-implicit-conversion-in-loop``, ``performance-inefficient-vector-operation``, ``performance-inefficient-algorithm``, ``performance-move-const-arg``, ``performance-move-constructor-init``)
 * **7 Readability rules** -- improve code clarity (e.g., ``readability-container-contains``, ``readability-container-size-empty``)
 
-The configuration's ``WarningsAsErrors`` policy makes these five checks fatal
+The configuration's ``WarningsAsErrors`` policy makes these four checks fatal
 for ordinary and CMake-integrated clang-tidy runs as well as CI:
 
 * ``bugprone-unused-return-value`` checks ignored results of selected standard-library functions, using its default function and return-type lists.
 * ``bugprone-branch-clone`` detects identical conditional branches.
 * ``bugprone-nondeterministic-pointer-iteration-order`` detects pointer iteration whose order depends on addresses.
-* ``cppcoreguidelines-avoid-reference-coroutine-parameters`` detects reference parameters that may outlive their referents when a coroutine suspends.
 * ``performance-inefficient-algorithm`` recommends associative-container member operations in place of slower generic algorithms.
 
 Review any intentional exception and use a check-specific ``NOLINT`` or
-``NOLINTNEXTLINE`` with its safety rationale. For coroutine reference parameters,
-establish that the referent outlives every use, or that the coroutine copies the
-value before it can suspend and never uses the reference afterward. For pointer
-iteration, establish that changing the traversal order cannot affect observable
-behavior or simulation determinism. Do not suppress either check across whole
-files to accommodate individual safe cases.
+``NOLINTNEXTLINE`` with its safety rationale. For pointer iteration, establish
+that changing the traversal order cannot affect observable behavior or
+simulation determinism. Do not suppress a check across whole files to
+accommodate individual safe cases.
 
 ``HeaderFilterRegex: ''`` preserves the scope used before clang-tidy 22:
 included-header diagnostics remain filtered out, while a header checked directly
```

**File**: `fdbcli/ConsistencyCheckCommand.cpp` (modified, +3/-1)
```diff
@@ -30,7 +30,9 @@ namespace fdb_cli {
 
 const KeyRef consistencyCheckSpecialKey = "\xff\xff/management/consistency_check_suspended"_sr;
 
-Future<bool> consistencyCheckCommandActor(Reference<ITransaction> tr, std::vector<StringRef> tokens, bool intrans) {
+Future<bool> consistencyCheckCommandActor(Reference<ITransaction> tr,
+                                          std::vector<StringRef> const& tokens,
+                                          bool intrans) {
 	// Here we do not proceed in a try-catch loop since the transaction is always supposed to succeed.
 	// If not, the outer loop catch block(fdbcli.cpp) will handle the error and print out the error message
 	tr->setOption(FDBTransactionOptions::SPECIAL_KEY_SPACE_ENABLE_WRITES);
```

**File**: `fdbcli/ConsistencyScanCommand.cpp` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ Future<Void> dumpStats(ConsistencyScanState* cs, Reference<ReadYourWritesTransac
 	co_return;
 }
 
-Future<bool> consistencyScanCommandActor(Database db, std::vector<StringRef> tokens) {
+Future<bool> consistencyScanCommandActor(Database db, std::vector<StringRef> const& tokens) {
 	// Skip the command token so start at begin+1
 	std::list<StringRef> args(tokens.begin() + 1, tokens.end());
 
```

**File**: `fdbcli/FileConfigureCommand.cpp` (modified, +4/-1)
```diff
@@ -33,7 +33,10 @@
 #include "flow/ThreadHelper.h"
 namespace fdb_cli {
 
-Future<bool> fileConfigureCommandActor(Reference<IDatabase> db, std::string filePath, bool isNewDatabase, bool force) {
+Future<bool> fileConfigureCommandActor(Reference<IDatabase> db,
+                                       std::string const& filePath,
+                                       bool isNewDatabase,
+                                       bool force) {
 	ConfigurationResult result;
 	std::string contents(readFileBytes(filePath, 100000));
 	json_spirit::mValue config;
```

**File**: `fdbcli/ForceRecoveryWithDataLossCommand.cpp` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
 #include "flow/ThreadHelper.h"
 namespace fdb_cli {
 
-Future<bool> forceRecoveryWithDataLossCommandActor(Reference<IDatabase> db, std::vector<StringRef> tokens) {
+Future<bool> forceRecoveryWithDataLossCommandActor(Reference<IDatabase> db, std::vector<StringRef> const& tokens) {
 	if (tokens.size() != 2) {
 		printUsage(tokens[0]);
 		co_return false;
```

---

### Incident Patch 9: `7f63d738` (2026-10-02)
**Commit Message**: Fix existing warnings from five clang-tidy checks

**File**: `bindings/c/test/mako/admin_server.hpp` (modified, +7/-6)
```diff
@@ -70,33 +70,34 @@ using Request = boost::variant<PingRequest, StopRequest>;
 class AdminServer {
 	const Arguments& args;
 	pid_t server_pid;
-	boost::process::pstream pipe_to_server;
-	boost::process::pstream pipe_to_client;
+	boost::process::v1::pstream pipe_to_server;
+	boost::process::v1::pstream pipe_to_client;
 	void start();
 	void configure();
 
 	template <class T>
-	static void sendObject(boost::process::pstream& pipe, T obj) {
+	static void sendObject(boost::process::v1::pstream& pipe, T obj) {
 		boost::archive::binary_oarchive oa(pipe);
 		oa << obj;
 	}
 
 	template <class T>
-	static T receiveObject(boost::process::pstream& pipe) {
+	static T receiveObject(boost::process::v1::pstream& pipe) {
 		boost::archive::binary_iarchive ia(pipe);
 		T obj;
 		ia >> obj;
 		return obj;
 	}
 
 	template <class RequestType>
-	static void sendResponse(boost::process::pstream& pipe, typename RequestType::ResponseType obj) {
+	static void sendResponse(boost::process::v1::pstream& pipe, typename RequestType::ResponseType obj) {
 		sendObject(pipe, std::move(obj));
 	}
 
 public:
 	explicit AdminServer(const Arguments& args)
-	  : args(args), server_pid(-1), pipe_to_server(boost::process::pipe()), pipe_to_client(boost::process::pipe()) {
+	  : args(args), server_pid(-1), pipe_to_server(boost::process::v1::pipe()),
+	    pipe_to_client(boost::process::v1::pipe()) {
 		start();
 	}
 	~AdminServer();
```

**File**: `bindings/flow/DirectoryLayer.cpp` (modified, +2/-3)
```diff
@@ -138,9 +138,8 @@ Future<Void> checkVersionInternal(const DirectoryLayer* dirLayer, Reference<Tran
 		if (versionBytes.get().size() != 12) {
 			throw invalid_directory_layer_metadata();
 		}
-		if (((uint32_t*)versionBytes.get().begin())[0] > DirectoryLayer::VERSION[0]) {
-			throw incompatible_directory_version();
-		} else if (((uint32_t*)versionBytes.get().begin())[1] > DirectoryLayer::VERSION[1] && writeAccess) {
+		if (((uint32_t*)versionBytes.get().begin())[0] > DirectoryLayer::VERSION[0] ||
+		    (((uint32_t*)versionBytes.get().begin())[1] > DirectoryLayer::VERSION[1] && writeAccess)) {
 			throw incompatible_directory_version();
 		}
 	}
```

**File**: `bindings/flow/tester/Tester.cpp` (modified, +3/-9)
```diff
@@ -43,9 +43,7 @@ std::map<Standalone<StringRef>, Reference<Transaction>> trMap;
 const int ITERATION_PROGRESSION[] = { 256, 1000, 4096, 6144, 9216, 13824, 20736, 31104, 46656, 69984, 80000 };
 const int MAX_ITERATION = sizeof(ITERATION_PROGRESSION) / sizeof(int);
 
-static Future<Void> runTest(Reference<FlowTesterData> const& data,
-                            Reference<Database> const& db,
-                            StringRef const& prefix);
+static Future<Void> runTest(Reference<FlowTesterData> data, Reference<Database> db, Standalone<StringRef> prefix);
 
 THREAD_FUNC networkThread(void* api) {
 	// This is the fdb_flow network we're running on a thread
@@ -1671,9 +1669,7 @@ static Future<Void> doInstructions(Reference<FlowTesterData> data) {
 				}
 			}
 
-			if (isDatabase)
-				op = op.substr(0, op.size() - 9);
-			else if (isSnapshot)
+			if (isDatabase || isSnapshot)
 				op = op.substr(0, op.size() - 9);
 
 			// printf("[==========]%ld/%ld:%s:%s: isDatabase:%d, isSnapshot:%d, stack count:%ld\n",
@@ -1717,9 +1713,7 @@ static Future<Void> doInstructions(Reference<FlowTesterData> data) {
 	// printf("Total num instructions:%d\n", data->instructions.size());
 }
 
-static Future<Void> runTest(Reference<FlowTesterData> const& data,
-                            Reference<Database> const& db,
-                            StringRef const& prefix) {
+static Future<Void> runTest(Reference<FlowTesterData> data, Reference<Database> db, Standalone<StringRef> prefix) {
 	ASSERT(data);
 	try {
 		data->db = db;
```

**File**: `bindings/java/JavaWorkload.cpp` (modified, +2/-0)
```diff
@@ -423,6 +423,8 @@ struct JVM {
 		auto clazz = getClass("com/apple/foundationdb/testing/Promise");
 		auto res = env->NewObject(clazz, getMethod(clazz, "<init>", "(J)V"), reinterpret_cast<jlong>(p.get()));
 		checkException();
+		// Java's nativePromise now owns p; JavaPromise::send deletes it after fulfillment.
+		// NOLINTNEXTLINE(bugprone-unused-return-value)
 		p.release();
 		return res;
 	}
```

**File**: `contrib/monitoring/actor_flamegraph.cpp` (modified, +1/-3)
```diff
@@ -148,15 +148,13 @@ int main(int argc, char* argv[]) {
 	bool endOfArgs = false;
 	for (int i = 1; i < argc; ++i) {
 		std::string arg(argv[i]);
-		if (endOfArgs) {
+		if (endOfArgs || arg[0] != '-') {
 			files.emplace_back(arg);
 		} else if (arg == "--") {
 			endOfArgs = true;
 		} else if (arg == "-h" || arg == "--") {
 			usage(argv[0], std::cout);
 			return 0;
-		} else if (arg[0] != '-') {
-			files.emplace_back(arg);
 		} else {
 			std::cerr << "Unknown argument \"" << arg << "\"" << std::endl;
 			usage(argv[0], std::cerr);
```

**File**: `documentation/coro_tutorial/tutorial.cpp` (modified, +2/-2)
```diff
@@ -461,7 +461,7 @@ bool transaction_done(void) {
 }
 
 template <class DB, class Fun>
-Future<Void> runTransactionWhile(DB const& db, Fun f) {
+Future<Void> runTransactionWhile(DB db, Fun f) {
 	Transaction tr(db);
 	while (true) {
 		Future<Void> onError;
@@ -482,7 +482,7 @@ Future<Void> runTransaction(DB const& db, Fun f) {
 }
 
 template <class DB, class Fun>
-Future<Void> runRYWTransaction(DB const& db, Fun f) {
+Future<Void> runRYWTransaction(DB db, Fun f) {
 	Future<Void> onError;
 	ReadYourWritesTransaction tr(db);
 	while (true) {
```

**File**: `fdbcli/ConsistencyCheckCommand.cpp` (modified, +1/-3)
```diff
@@ -30,9 +30,7 @@ namespace fdb_cli {
 
 const KeyRef consistencyCheckSpecialKey = "\xff\xff/management/consistency_check_suspended"_sr;
 
-Future<bool> consistencyCheckCommandActor(Reference<ITransaction> tr,
-                                          std::vector<StringRef> const& tokens,
-                                          bool intrans) {
+Future<bool> consistencyCheckCommandActor(Reference<ITransaction> tr, std::vector<StringRef> tokens, bool intrans) {
 	// Here we do not proceed in a try-catch loop since the transaction is always supposed to succeed.
 	// If not, the outer loop catch block(fdbcli.cpp) will handle the error and print out the error message
 	tr->setOption(FDBTransactionOptions::SPECIAL_KEY_SPACE_ENABLE_WRITES);
```

**File**: `fdbcli/ConsistencyScanCommand.cpp` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ Future<Void> dumpStats(ConsistencyScanState* cs, Reference<ReadYourWritesTransac
 	co_return;
 }
 
-Future<bool> consistencyScanCommandActor(Database db, std::vector<StringRef> const& tokens) {
+Future<bool> consistencyScanCommandActor(Database db, std::vector<StringRef> tokens) {
 	// Skip the command token so start at begin+1
 	std::list<StringRef> args(tokens.begin() + 1, tokens.end());
 
```

---

### Incident Patch 10: `4a693963` (2026-10-01)
**Commit Message**: ci: fix windows-boost-test branches list

I accidentally put release-* in the wrong list,
we don't need/want this check in "push" list

**File**: `.github/workflows/windows-boost-test.yml` (modified, +0/-3)
```diff
@@ -2,9 +2,6 @@ name: Windows Boost CONFIG Test
 
 on:
   pull_request:
-    branches:
-      - main
-  push:
     branches:
       - main
       - release-*
```

---

### Incident Patch 11: `5a4a4456` (2026-09-29)
**Commit Message**: build: download fmt tarball instead of using git

more efficient, noticeably so on some macOS or corporate systems

also, more quiet if exact version not found on local system

**File**: `cmake/GetFmt.cmake` (modified, +6/-4)
```diff
@@ -1,11 +1,13 @@
-find_package(fmt 11.1.4 EXACT CONFIG)
+find_package(fmt 11.1.4 EXACT CONFIG QUIET)
 
-if(NOT fmt_FOUND)
+if(fmt_FOUND)
+  message(STATUS "Found fmt ${fmt_VERSION} at ${fmt_DIR}")
+else()
   include(FetchContent)
   FetchContent_Declare(
     fmt
-    GIT_REPOSITORY https://github.com/fmtlib/fmt
-    GIT_TAG 11.1.4
+    URL      "https://github.com/fmtlib/fmt/archive/11.1.4.tar.gz"
+    URL_HASH SHA256=ac366b7b4c2e9f0dde63a59b3feb5ee59b67974b14ee5dc9ea8ad78aa2c1ee1e
   )
   FetchContent_MakeAvailable(fmt)
 endif()
```

---

### Incident Patch 12: `0c459d6b` (2026-09-30)
**Commit Message**: Widen connection-lifecycle trace event suppression from 1s to a shared 2s knob (#14179)

fdbrpc/FlowTransport.cpp rate-limited 12 connection lifecycle/error trace
events (ConnectingTo, ConnectionExchangingConnectPacket, ConnectionReset,
ConnectionClosed, IncompatibleConnectionClosed, PeerDestroy,
PeerUnavailableForLongTime, RedundantConnection, ConnectionEstablished,
ConnectedOutgoing, IncomingConnectionError, ConnectionFrom) with the same
hardcoded suppressFor(1.0), each keyed independently and duplicated across
13 call sites.

Replace the hardcoded literal with a single new knob,
FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR (default 2.0), so these events
stay in sync rather than drifting independently, and can be tuned as one
group. IncomingConnection also references this knob for consistency, though
it has no effect there: that event is tagged "IncomingConnection"_audit,
which forces it to Type::FORCED, and suppressFor() is a no-op for anything
that isn't Type::ENABLED (see AuditedEvent/State in flow/include/flow/Trace.h
and BaseTraceEvent::suppressFor in flow/Trace.cpp). Added a one-line comment
at that call site explaining why, since the code otherwise looks
contradictory (an _au

**File**: `fdbrpc/FlowTransport.cpp` (modified, +14/-13)
```diff
@@ -930,7 +930,7 @@ Future<Void> connectionKeeper(Reference<Peer> self,
 				self->lastConnectTime = now();
 
 				TraceEvent("ConnectingTo", conn ? conn->getDebugID() : UID())
-				    .suppressFor(1.0)
+				    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 				    .detail("PeerAddr", self->destination)
 				    .detail("PeerAddress", self->destination)
 				    .detail("PeerReferences", self->peerReferences)
@@ -969,7 +969,7 @@ Future<Void> connectionKeeper(Reference<Peer> self,
 						}
 
 						TraceEvent("ConnectionExchangingConnectPacket", conn->getDebugID())
-						    .suppressFor(1.0)
+						    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 						    .detail("PeerAddr", self->destination)
 						    .detail("PeerAddress", self->destination);
 						self->prependConnectPacket();
@@ -1047,7 +1047,7 @@ Future<Void> connectionKeeper(Reference<Peer> self,
 				co_await (connectionWriter(self, conn) || reader || connectionMonitor(self) ||
 				          self->resetConnection.onTrigger());
 				TraceEvent("ConnectionReset", conn ? conn->getDebugID() : UID())
-				    .suppressFor(1.0)
+				    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 				    .detail("PeerAddr", self->destination)
 				    .detail("PeerAddress", self->destination);
 				throw connection_failed();
@@ -1074,7 +1074,7 @@ Future<Void> connectionKeeper(Reference<Peer> self,
 			if (firstConnFailedTime.present()) {
 				if (now() - firstConnFailedTime.get() > FLOW_KNOBS->PEER_UNAVAILABLE_FOR_LONG_TIME_TIMEOUT) {
 					TraceEvent(SevWarnAlways, "PeerUnavailableForLongTime", conn ? conn->getDebugID() : UID())
-					    .suppressFor(1.0)
+					    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 					    .detail("PeerAddr", self->destination)
 					    .detail("PeerAddress", self->destination);
 					firstConnFailedTime = now() - FLOW_KNOBS->PEER_UNAVAILABLE_FOR_LONG_TIME_TIMEOUT / 2.0;
@@ -1104,14 +1104,14 @@ Future<Void> connectionKeeper(Reference<Peer> self,
 			if (self->compatible) {
 				TraceEvent(ok ? SevInfo : SevWarnAlways, "ConnectionClosed", conn ? conn->getDebugID() : UID())
 				    .errorUnsuppressed(e)
-				    .suppressFor(1.0)
+				    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 				    .detail("PeerAddr", self->destination)
 				    .detail("PeerAddress", self->destination);
 			} else {
 				TraceEvent(
 				    ok ? SevInfo : SevWarnAlways, "IncompatibleConnectionClosed", conn ? conn->getDebugID() : UID())
 				    .errorUnsuppressed(e)
-				    .suppressFor(1.0)
+				    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 				    .detail("PeerAddr", self->destination)
 				    .detail("PeerAddress", self->destination);
 
@@ -1175,7 +1175,7 @@ Future<Void> connectionKeeper(Reference<Peer> self,
 			    self->outstandingReplies == 0) {
 				TraceEvent("PeerDestroy")
 				    .errorUnsuppressed(e)
-				    .suppressFor(1.0)
+				    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 				    .detail("PeerAddr", self->destination)
 				    .detail("PeerAddress", self->destination)
 				    .detail("PeerReferences", self->peerReferences)
@@ -1278,7 +1278,8 @@ void Peer::onIncomingConnection(Reference<Peer> self, Reference<IConnection> con
 	    (lastConnectTime > 1.0 && now() - lastConnectTime > FLOW_KNOBS->ALWAYS_ACCEPT_DELAY)) {
 		// Keep the new connection
 		TraceEvent("IncomingConnection"_audit, conn->getDebugID())
-		    .suppressFor(1.0)
+		    // suppressFor is a no-op here: _audit events are forced-enabled and never suppressible.
+		    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 		    .detail("FromAddr", conn->getPeerAddress())
 		    .detail("CanonicalAddr", destination)
 		    .detail("IsPublic", destination.isPublic())
@@ -1290,7 +1291,7 @@ void Peer::onIncomingConnection(Reference<Peer> self, Reference<IConnection> con
 	} else {
 		// Keep our prior connection
 		TraceEvent("RedundantConnection", conn->getDebugID())
-		    .suppressFor(1.0)
+		    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 		    .detail("FromAddr", conn->getPeerAddress().toString())
 		    .detail("CanonicalAddr", destination)
 		    .detail("LocalAddr", compatibleAddr);
@@ -1740,7 +1741,7 @@ static Future<Void> connectionReader(TransportData* transport,
 						} else {
 							compatible = true;
 							TraceEvent("ConnectionEstablished", conn->getDebugID())
-							    .suppressFor(1.0)
+							    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 							    .detail("Peer", conn->getPeerAddress())
 							    .detail("PeerAddress", conn->getPeerAddress())
 							    .detail("ConnectionId", connectionId);
@@ -1757,7 +1758,7 @@ static Future<Void> connectionReader(TransportData* transport,
 							peerProtocolVersion = protocolVersion;
 							// Outgoing connection; port information should be what we expect
 							TraceEvent("ConnectedOutgoing")
-							    .suppressFor(1.0)
+							    .suppressFor(FLOW_KNOBS->CONNECTION_EVENT_SUPPRESS_FOR)
 		
```

**File**: `flow/Knobs.cpp` (modified, +1/-0)
```diff
@@ -124,6 +124,7 @@ void FlowKnobs::initialize(Randomize randomize, IsSimulated isSimulated) {
 	init( CONNECTION_MONITOR_UNREFERENCED_CLOSE_DELAY,         2.0 );
 
 	//FlowTransport
+	init( CONNECTION_EVENT_SUPPRESS_FOR,                       2.0 );
 	init( CONNECTION_REJECTED_MESSAGE_DELAY,                   1.0 );
 	init( CONNECTION_ID_TIMEOUT,                             600.0 ); if( randomize && buggify() ) CONNECTION_ID_TIMEOUT = 60.0;
 	init( CONNECTION_CLEANUP_DELAY,                          100.0 );
```

**File**: `flow/include/flow/Knobs.h` (modified, +1/-0)
```diff
@@ -203,6 +203,7 @@ class FlowKnobs : public KnobsImpl<FlowKnobs> {
 	double CONNECTION_MONITOR_UNREFERENCED_CLOSE_DELAY;
 
 	// FlowTransport
+	double CONNECTION_EVENT_SUPPRESS_FOR;
 	double CONNECTION_REJECTED_MESSAGE_DELAY;
 	double CONNECTION_ID_TIMEOUT;
 	double CONNECTION_CLEANUP_DELAY;
```

---

### Incident Patch 13: `d0f1c679` (2026-09-29)
**Commit Message**: build: fix aws-sdk-cpp "crypto" dep, for macOS and arm64

This fixes BUILD_AWS_BACKUP=ON for macOS, and linux on arm64.
The "BYO_CRYPTO" option was not properly being used, you are
supposed to set some crypto handler callbacks manually in that
case, which we did not do. We just happened to use extremely
little of aws-sdk-cpp so it didn't matter much. But the BYO_CRYPTO
option is also explicitly rejected in many cases, and generally
unsupported, so if we can avoid it, we can fix the build with
BUILD_AWS_BACKUP=ON in many more configurations.

**File**: `cmake/awssdk.cmake` (modified, +95/-47)
```diff
@@ -1,113 +1,161 @@
 project(awssdk-download NONE)
 
-# Compile the sdk with clang and libc++, since otherwise we get libc++ vs libstdc++ link errors when compiling fdb with clang
-set(AWSSDK_COMPILER_FLAGS "")
+### This whole aws-sdk-cpp is only used for Aws::Auth::AWSCredentials
+# to discover AWS credentials from environment variables, config files,
+# EC2 instance metadata (which requires an http client) etc.
+# The s3 client and even AWS request signing is re-implemented by FDB.
+
+set(AWSSDK_COMPILER_FLAGS "-fPIC")
 if(APPLE OR USE_LIBCXX)
-  set(AWSSDK_COMPILER_FLAGS "-stdlib=libc++ -nostdlib++")
+  string(APPEND AWSSDK_COMPILER_FLAGS " -stdlib=libc++ -nostdlib++")
+endif()
+
+if(APPLE)
+  set(AWSSDK_LIBDIR "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib")
+else()
+  set(AWSSDK_LIBDIR "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64")
 endif()
 
 include(ExternalProject)
 ExternalProject_Add(awssdk_project
   GIT_REPOSITORY https://github.com/aws/aws-sdk-cpp.git
   GIT_TAG c4b8cb01b0215f00740d9d72f7185ee056ced1f6 # v1.11.473
+  GIT_SHALLOW ON
   SOURCE_DIR "${CMAKE_CURRENT_BINARY_DIR}/awssdk-src"
   BINARY_DIR "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build"
-  GIT_CONFIG advice.detachedHead=false
   # it seems advice.detachedHead breaks something which causes aws sdk to always be rebuilt.
   # This option forces to cmake to build the aws sdk only once and never attempt to update it
   UPDATE_DISCONNECTED ON
-  CMAKE_ARGS -DBUILD_SHARED_LIBS=OFF        # SDK builds shared libs by default, we want static libs
+  PATCH_COMMAND # enable s2n for macOS too
+    sed -i.bak -e "s/UNIX AND NOT APPLE AND NOT BYO_CRYPTO/UNIX AND NOT BYO_CRYPTO/"
+    crt/aws-crt-cpp/CMakeLists.txt
+  COMMAND # patch cmake_minimum_required in s2n sub-sub-module
+    sed -i.bak -E -e "s/\\(VERSION 3.0\\)/\\(VERSION 3.10\\)/"
+    crt/aws-crt-cpp/crt/s2n/CMakeLists.txt
+  CMAKE_ARGS
+  -DBUILD_SHARED_LIBS=OFF        # SDK builds shared libs by default, we want static libs
   -DENABLE_TESTING=OFF
   -DBUILD_ONLY=core              # git repo contains SDK for every AWS product, we only want the core auth libraries
   -DSIMPLE_INSTALL=ON
-  -DCMAKE_INSTALL_PREFIX=install # need to specify an install prefix so it doesn't install in /usr/lib - FIXME: use absolute path
-  -DBYO_CRYPTO=ON                # we have our own crypto libraries that conflict if we let aws sdk build and link its own
-  -DBUILD_CURL=ON
-  -DBUILD_ZLIB=ON
-
+  -DCMAKE_INSTALL_PREFIX=install # need to specify an install prefix so it doesn't install in /usr/lib
   -DCMAKE_CXX_COMPILER=${CMAKE_CXX_COMPILER}
-  -DCMAKE_CXX_FLAGS=${AWSSDK_COMPILER_FLAGS}
+  "-DCMAKE_CXX_FLAGS=${AWSSDK_COMPILER_FLAGS}"
+  -DAWS_SDK_WARNINGS_ARE_ERRORS=OFF # newer compilers warn about code in this (older) sdk version
+  -DUSE_CRT_HTTP_CLIENT=ON
+  -DUSE_OPENSSL=ON
   TEST_COMMAND ""
   # the sdk build produces a ton of artifacts, with their own dependency tree, so there is a very specific dependency order they must be linked in
-  BUILD_BYPRODUCTS "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-cpp-sdk-core.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-crt-cpp.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-s3.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-auth.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-event-stream.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-http.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-mqtt.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-sdkutils.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-io.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-checksums.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-compression.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-cal.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/lib64/libaws-c-common.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/external-install/curl/lib/libcurl.a"
-  "${CMAKE_CURRENT_BINARY_DIR}/awssdk-build/install/external-install/zlib/lib/libz.a"
+  BUILD_BYPRODUCTS
+    "${AWSSDK_LIBDIR}/libaws-cpp-sdk-core.a"
+    "${AWSSDK_LIBDIR}/libaws-crt-cpp.a"
+    "${AWSSDK_LIBDIR}/libaws-c-s3.a"
+    "${AWSSDK_LIBDIR}/libaws-c-auth.a"
+    "${AWSSDK_LIBDIR}/libaws-c-event-stream.a"
+    "${AWSSDK_LIBDIR}/libaws-c-http.a"
+    "${AWSSDK_LIBDIR}/libaws-c-mqtt.a"
+    "${AWSSDK_LIBDIR}/libaws-c-sdkutils.a"
+    "${AWSSDK_LIBDIR}/libaws-c-io.a"
+    "${AWSSDK_LIBDIR}/libaws-checksums.a"
+    "${AWSSDK_LIBDIR}/libaws-c-compression.a"
+    "${AWSSDK_LIBDIR}/libaws-c-cal.a"
+    "${AWSSDK_LIBDIR}/libaws-c-common.a"
+    "${AWSSDK_LIBDIR}/libs2n.a"
   )
 
 add_library(awssdk_core STATIC IMPORTED)
 add_dependencies(awssdk_core awssdk_project)
-set_target_properties(awssdk_core PROPERTIES IMPORTED_LOCATION "${CMAKE_CURRENT_BINARY_D
```

---

### Incident Patch 14: `0a3aff60` (2026-09-30)
**Commit Message**: build: always include stripped main binaries in default ALL target

This used to depend on whether GENERATE_DEBUG_PACKAGES was enabled.
That was default OFF before #13904 / 776f3d95b485 but is now default
ON for dev (it was explicitly set ON for release builds).

The idea was, if GENERATE_DEBUG_PACKAGES=OFF then the `strip_only_*`
targets should be included in default ALL target, and then if RPM
or DEB packages were built they would use those stripped binary
targets. But if GENERATE_DEBUG_PACKAGES=ON then it would not add
those to default ALL target and just use original pre-stripped
binaries for RPM or DEB package generators to split.

But the `strip_only_*` targets were still built for the "packages"
target, which release builds use, they want both debug packages
and stripped binaries to upload as release artifacts individually.
That is honestly a bit confusing - building rpm/deb packages does
not need the "packages" target but has these side-effects on ALL.

This can be simplified:
 * Always include `strip_only_*` targets in default ALL target
   for the main binaries that devs expect.
 * RPM / DEB / TGZ packages always use original un-stripped binaries,
   and if GENERATE_DEBUG

**File**: `bindings/c/CMakeLists.txt` (modified, +2/-3)
```diff
@@ -55,6 +55,7 @@ if(OPEN_FOR_IDE)
 else()
   add_library(fdb_c SHARED ${FDB_C_SRCS} ${fdb_c_apiversion_file} ${asm_file})
   strip_debug_symbols(fdb_c)
+  add_custom_target(stripped_fdb_c ALL DEPENDS strip_only_fdb_c)
 endif()
 add_dependencies(fdb_c fdb_c_generated fdb_c_options)
 add_dependencies(fdbclient fdb_c_options)
@@ -237,9 +238,7 @@ if(NOT WIN32)
     target_link_libraries(mako PRIVATE fdb_c fdbclient fmt::fmt Threads::Threads fdb_cpp boost_target rapidjson)
     if(NOT OPEN_FOR_IDE)
       strip_debug_symbols(mako)
-      if(NOT GENERATE_DEBUG_PACKAGES)
-        add_custom_target(prepare_mako_install ALL DEPENDS strip_only_mako)
-      endif()
+      add_custom_target(prepare_mako_install ALL DEPENDS strip_only_mako)
     endif()
   endif()
 
```

**File**: `cmake/InstallLayout.cmake` (modified, +4/-0)
```diff
@@ -44,7 +44,11 @@ set(CPACK_PROJECT_CONFIG_FILE "${CMAKE_BINARY_DIR}/packaging/CPackConfig.cmake")
 # User config
 ################################################################################
 
+# For debug packages, do not strip before handing to RPM or DEB generator, which will split debuginfo.
 set(GENERATE_DEBUG_PACKAGES ON CACHE BOOL "Build debug rpm/deb packages")
+if(NOT GENERATE_DEBUG_PACKAGES)
+  set(CPACK_STRIP_FILES ON)
+endif()
 
 ################################################################################
 # Alternatives config
```

**File**: `fdbbackup/CMakeLists.txt` (modified, +6/-14)
```diff
@@ -20,20 +20,8 @@ target_include_directories(fdbdecode PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/includ
 target_link_libraries(fdbdecode PRIVATE fdbclient)
 
 if(NOT OPEN_FOR_IDE)
-  if(GENERATE_DEBUG_PACKAGES)
-    fdb_install(TARGETS fdbbackup DESTINATION bin COMPONENT clients)
-    fdb_install(PROGRAMS $<TARGET_FILE:fdbbackup> DESTINATION bin COMPONENT clients RENAME backup_agent)
-    fdb_install(PROGRAMS $<TARGET_FILE:fdbbackup> DESTINATION bin COMPONENT clients RENAME fdbrestore)
-    fdb_install(PROGRAMS $<TARGET_FILE:fdbbackup> DESTINATION bin COMPONENT clients RENAME dr_agent)
-    fdb_install(PROGRAMS $<TARGET_FILE:fdbbackup> DESTINATION bin COMPONENT clients RENAME fdbdr)
-  else()
-    add_custom_target(prepare_fdbbackup_install ALL DEPENDS strip_only_fdbbackup)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbbackup DESTINATION bin COMPONENT clients)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbbackup DESTINATION bin COMPONENT clients RENAME backup_agent)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbbackup DESTINATION bin COMPONENT clients RENAME fdbrestore)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbbackup DESTINATION bin COMPONENT clients RENAME dr_agent)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbbackup DESTINATION bin COMPONENT clients RENAME fdbdr)
-  endif()
+  add_custom_target(stripped_fdbbackup ALL DEPENDS strip_only_fdbbackup)
+  fdb_install(TARGETS fdbbackup DESTINATION bin COMPONENT clients)
   symlink_files(
     LOCATION packages/bin
     SOURCE fdbbackup
@@ -42,6 +30,10 @@ if(NOT OPEN_FOR_IDE)
     LOCATION bin
     SOURCE fdbbackup
     TARGETS fdbdr dr_agent backup_agent fdbrestore)
+  # Install the relative symlinks created above, so all names share one binary
+  foreach(alias IN ITEMS backup_agent fdbrestore dr_agent fdbdr)
+    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/bin/${alias} DESTINATION bin COMPONENT clients)
+  endforeach()
 
   # Test version of backup.cpp without main() function
   add_flow_target(EXECUTABLE NAME backup_tests SRCS backup.cpp)
```

**File**: `fdbcli/CMakeLists.txt` (modified, +2/-6)
```diff
@@ -18,12 +18,8 @@ if(NOT WIN32)
 endif()
 
 if(NOT OPEN_FOR_IDE)
-  if(GENERATE_DEBUG_PACKAGES)
-    fdb_install(TARGETS fdbcli DESTINATION bin COMPONENT clients)
-  else()
-    add_custom_target(prepare_fdbcli_install ALL DEPENDS strip_only_fdbcli)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbcli DESTINATION bin COMPONENT clients)
-  endif()
+  add_custom_target(stripped_fdbcli ALL DEPENDS strip_only_fdbcli)
+  fdb_install(TARGETS fdbcli DESTINATION bin COMPONENT clients)
 endif()
 
 if (NOT WIN32 AND NOT OPEN_FOR_IDE)
```

**File**: `fdbmonitor/CMakeLists.txt` (modified, +2/-6)
```diff
@@ -36,12 +36,8 @@ if(NOT "${fdbmonitor_options}" STREQUAL "fdbmonitor_options-NOTFOUND")
   set_property(TARGET fdbmonitor PROPERTY LINK_OPTIONS ${fdbmonitor_options})
 endif()
 
-if(GENERATE_DEBUG_PACKAGES)
-  fdb_install(TARGETS fdbmonitor DESTINATION sbin COMPONENT server)
-else()
-  add_custom_target(prepare_fdbmonitor_install ALL DEPENDS strip_only_fdbmonitor)
-  fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbmonitor DESTINATION sbin COMPONENT server)
-endif()
+add_custom_target(stripped_fdbmonitor ALL DEPENDS strip_only_fdbmonitor)
+fdb_install(TARGETS fdbmonitor DESTINATION sbin COMPONENT server)
 
 # Create a local sandbox for quick manual testing without simulator
 file(MAKE_DIRECTORY ${CMAKE_BINARY_DIR}/sandbox/data)
```

**File**: `fdbserver/CMakeLists.txt` (modified, +2/-6)
```diff
@@ -230,12 +230,8 @@ if(GPERFTOOLS_FOUND)
 endif()
 
 if(NOT OPEN_FOR_IDE)
-  if(GENERATE_DEBUG_PACKAGES)
-    fdb_install(TARGETS fdbserver DESTINATION sbin COMPONENT server)
-  else()
-    add_custom_target(prepare_fdbserver_install ALL DEPENDS strip_only_fdbserver)
-    fdb_install(PROGRAMS ${CMAKE_BINARY_DIR}/packages/bin/fdbserver DESTINATION sbin COMPONENT server)
-  endif()
+  add_custom_target(stripped_fdbserver ALL DEPENDS strip_only_fdbserver)
+  fdb_install(TARGETS fdbserver DESTINATION sbin COMPONENT server)
 endif()
 
 target_link_libraries(fdbserver PUBLIC fdbctl)
```

---

### Incident Patch 15: `723fa93e` (2026-09-29)
**Commit Message**: build: java: set OUTPUT and DEPENDS for javadoc targets (#14171)

... to avoid rebuilding javadoc when nothing changed.
(It is pretty fast, but causes a screen-full of build log output.)

The cmake UseJava provided create_javadoc() cannot be used
because it does not set, or enable setting, OUTPUT and DEPENDS.

**File**: `bindings/java/CMakeLists.txt` (modified, +25/-9)
```diff
@@ -210,16 +210,32 @@ add_jar(fdb-java ${JAVA_BINDING_SRCS} ${GENERATED_JAVA_FILES} ${CMAKE_SOURCE_DIR
   OUTPUT_DIR ${PROJECT_BINARY_DIR}/lib VERSION ${FDB_VERSION} MANIFEST ${MANIFEST_FILE} GENERATE_NATIVE_HEADERS fdb_java_native)
 add_dependencies(fdb-java fdb_java_options)
 
-create_javadoc(fdb
-               FILES ${JAVA_BINDING_SRCS} ${GENERATED_JAVA_FILES} ${GENERATED_JAVA_DIR}/ApiVersion.java
-               VERSION ${FDB_VERSION}
-               )
-add_dependencies(fdb_javadoc fdb_java_options) 
-
-add_custom_target(CopyJavadoc
-    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_BINARY_DIR}/javadoc/fdb ${CMAKE_CURRENT_BINARY_DIR}/../../documentation/html/javadoc
+# create_javadoc() from cmake UseJava does not set OUTPUT and DEPENDS properly
+# to avoid rebuilds when no files changed, so re-implement here
+set(FDB_JAVADOC_DIR ${CMAKE_CURRENT_BINARY_DIR}/javadoc/fdb)
+add_custom_command(
+    OUTPUT ${FDB_JAVADOC_DIR}/index.html
+    COMMAND ${Java_JAVADOC_EXECUTABLE} -d ${FDB_JAVADOC_DIR} -version
+            ${JAVA_BINDING_SRCS} ${GENERATED_JAVA_FILES} ${GENERATED_JAVA_DIR}/ApiVersion.java
+    DEPENDS ${JAVA_BINDING_SRCS} ${GENERATED_JAVA_FILES} ${GENERATED_JAVA_DIR}/ApiVersion.java fdb_java_options
+    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
+    COMMENT "Generating javadoc for fdb"
+)
+add_custom_target(fdb_javadoc ALL DEPENDS ${FDB_JAVADOC_DIR}/index.html)
+
+set(DOC_JAVADOC_DIR ${CMAKE_CURRENT_BINARY_DIR}/../../documentation/html/javadoc)
+add_custom_command(
+    OUTPUT ${DOC_JAVADOC_DIR}/index.html
+    COMMAND ${CMAKE_COMMAND} -E copy_directory ${FDB_JAVADOC_DIR} ${DOC_JAVADOC_DIR}
+    DEPENDS ${FDB_JAVADOC_DIR}/index.html
+    COMMENT "Copying javadoc to documentation directory"
+)
+add_custom_target(CopyJavadoc DEPENDS ${DOC_JAVADOC_DIR}/index.html)
+
+install(
+    DIRECTORY ${FDB_JAVADOC_DIR}
+    DESTINATION share/javadoc
 )
-add_dependencies(CopyJavadoc fdb_javadoc)
 
 if(NOT OPEN_FOR_IDE)
   set(FAT_JAR_BINARIES "NOTFOUND" CACHE STRING
```

#### Recent Merged Pull Requests:
- **PR #14222** (2026-10-06): tests: UnitTestRunner: list failed tests at the end (@ploxiln)
- **PR #14221** (closed): Enable SHARD_ENCODE_LOCATION_METADATA by default (@saintstack)
- **PR #14218** (2026-10-06): Use a numeric user in the Kubernetes monitor image (@arnav-ag)
- **PR #14214** (2026-10-03): tests: fix fdb_test_runner fdb_version.py handling (@ploxiln)
- **PR #14210** (2026-10-02): tests: fix fdb_test_runner fdb_version.py handling (@ploxiln)
- **PR #14206** (2026-10-05): documentation: change default release-notes page to 8.0.x (@ploxiln)
- **PR #14205** (2026-10-02): Fix LocalityData value presence checks (@tclinkenbeard-oai)
- **PR #14201** (2026-10-03): Enable two additional clang-tidy checks and fix existing findings (@tclinkenbeard-oai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
