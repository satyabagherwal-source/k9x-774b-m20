# Forensic Learning Record (Deep Inspection): StarRocks/starrocks

> **Canonical Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:33:40.724Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12150 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `be/extension/python-udf/src/flight_server.py`
```
# encoding: utf-8

# Copyright 2021-present StarRocks, Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import argparse
import base64
import json
import os
import sys
import time
import zipimport
import ast
import hashlib
import shutil
import tempfile
import threading
import urllib.request

import pyarrow as pa
import pyarrow.flight as flight

# Cache of already-downloaded UDF zips, keyed by their source URL -> local file path.
# In external-worker mode the BE hands us the original download URL (e.g. an http(s) URL)
# instead of a BE-local path, so we fetch the zip ourselves and zipimport it from local disk.
_DOWNLOAD_CACHE = {}
_DOWNLOAD_LOCK = threading.Lock()
# Socket timeout (seconds) for downloading a UDF package, so a slow/hung `file` URL cannot hang the
# worker (and thus the BE call) forever. Override with the SR_PY_UDF_DOWNLOAD_TIMEOUT env var.
_DOWNLOAD_TIMEOUT_SECONDS = float(os.environ.get("SR_PY_UDF_DOWNLOAD_TIMEOUT", "60"))


def _file_md5(path):
    digest = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_zip_location(location, checksum=""):
    if not (location.startswith("http://") or location.startswith("https://")):
        # spawn mode: already a local path
        return location
    with _DOWNLOAD_LOCK:
        cached = _DOWNLOAD_CACHE.get(location)
        if cached and os.path.exists(cached):
            return cached
        key = hashlib.md5(location.encode("utf-8")).hexdigest()
        local_path = os.path.join(tempfile.gettempdir(), "sr_udf_" + key + ".zip")
        need_download = True
        if os.path.exists(local_path) and checksum and _file_md5(local_path).lower() == checksum.lower():
            need_download = False
        if need_download:
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip", prefix="sr_udf_dl_")
            os.close(tmp_fd)
            try:
                with urllib.request.urlopen(location, timeout=_DOWNLOAD_TIMEOUT_SECONDS) as resp, \
                        open(tmp_path, "wb") as out:
                    shutil.copyfileobj(resp, out)
                # Verify integrity against the BE-provided md5 (matches FE computeMd5 / the
                # BE UserFunctionCache check). Empty checksum means "not provided" -> skip.
                if checksum:
                    actual = _file_md5(tmp_path)
                    if actual.lower() != checksum.lower():
                        raise ValueError(
                            f"UDF zip checksum mismatch for {location}: "
                            f"expected {checksum}, got {actual}")
                os.replace(tmp_path, local_path)
            except Exception:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                raise
        _DOWNLOAD_CACHE[location] = local_path
        return local_path


class CallStub(object):
    def __init__(self, symbol, output_type, location, content, checksum=""):
        self.symbol = symbol
        self.output_type = output_type
        self.location = location
        self.content = content
        self.checksum = checksum
        self.exec_env = {}
        self.eval_func = None
        # extract function object
        if location == "inline":
            try:
                exec(content, self.exec_env)
            except Exception as e:
                raise ValueError(f"Failed to evaluate UDF: {content} with error: {e}")
            if self.symbol not in self.exec_env:
                raise ValueError(f"Function {self.symbol} not found in UDF: {content}")
            self.eval_func = self.exec_env[self.symbol]
        else:
            try:
                module_with_symbol = self.symbol.split(".")
                module = self.load_module(location, module_with_symbol[0])
                self.eval_func = getattr(module, module_with_symbol[1])
            except Exception as e:
                raise ValueError(f"Failed to load UDF module: {location} symbol {symbol} with error: {e}")

    def cvt(self, py_list):
        return pa.array(py_list, self.output_type)

    def get_imported_packages_ast(self, importer, module_name):
        # acquire source
        source = importer.get_source(module_name)
        imported_packages = []
        if source is None:
            return imported_packages
        # parse source
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported_packages.append(alias.name.split('.')[0])
            elif isinstance(node, ast.ImportFrom):
                imported_packages.append(node.module.split('.')[0])
        return imported_packages

    def load_module(self, location, module_name):
        location = _resolve_zip_location(location, self.checksum)
        importer = zipimport.zipimporter(location)
        dependencies = self.get_imported_packages_ast(importer, module_name)
        for dep in dependencies:
            if importer.find_module(dep):
                importer.load_module(dep)
        module = importer.load_module(module_name)
        return module

def _normalize_scalar(value, arrow_type):
    # Recursively coerce the result of pa.Scalar.as_py() into idiomatic Python
    # values for nested types. The default pyarrow behavior returns a list of
    # (key, value) tuples for MapArray, which is awkward for UDF authors and
    # breaks when maps appear inside arrays, structs, or other maps.
    if value is None:
        return None
    if pa.types.is_map(arrow_type):
        key_type = arrow_type.key_type
        item_type = arrow_type.item_type
        return {_normalize_scalar(k, key_type): _normalize_scalar(v, item_type)
                for k, v in value}
    if (pa.types.is_list(arrow_type)
            or pa.types.is_large_list(arrow_type)
            or pa.types.is_fixed_size_list(arrow_type)):
        elem_type = arrow_type.value_type
        return [_normalize_scalar(item, elem_type) for item in value]
    if pa.types.is_struct(arrow_type):
        return {arrow_type.field(i).name:
                _normalize_scalar(value[arrow_type.field(i).name],
                                  arrow_type.field(i).type)
                for i in range(arrow_type.num_fields)}
    return value


class ScalarCallStub(CallStub):
    """
    Python Scalar Call stub
    """
    def __init__(self, symbol, output_type, location, content, checksum=""):
        CallStub.__init__(self, symbol, output_type, location, content, checksum)

    def evaluate(self, batch: pa.RecordBatch) -> pa.Array:
        num_rows = batch.num_rows
        num_cols = len(batch.columns)
        col_types = [batch.columns[j].type for j in range(num_cols)]
        result_list = []
        for i in range(num_rows):
            params = [_normalize_scalar(batch.columns[j][i].as_py(), col_types[j])
                      for j in range(num_cols)]
            res = self.eval_func(*params)
            result_list.append(res)
        # set result to output column
        return self.cvt(result_list)

class VectorizeArrowCallStub(CallStub):
    """
    Python Vectorized Call stub
    """
    def __init__(self, symbol, output_type, location, content, checksum=""):
        CallStub.__init__(self, symbol, output_type, location, content, checksum)

    def evaluate(self, batch: pa.RecordBatch) -> pa.Array:
```

### Core Architecture Module: `be/src/agent/agent_common.h`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include "gen_cpp/AgentService_types.h"

namespace starrocks {

enum class TaskWorkerType {
    CREATE_TABLE,
    DROP_TABLE,
    PUSH,
    REALTIME_PUSH,
    PUBLISH_VERSION,
    CLEAR_ALTER_TASK, // Deprecated
    CLEAR_TRANSACTION_TASK,
    DELETE,
    ALTER_TABLE,
    QUERY_SPLIT_KEY, // Deprecated
    CLONE,
    STORAGE_MEDIUM_MIGRATE,
    CHECK_CONSISTENCY,
    REPORT_TASK,
    REPORT_DISK_STATE,
    REPORT_OLAP_TABLE,
    REPORT_WORKGROUP,
    REPORT_DATACACHE_METRICS,
    UPLOAD,
    DOWNLOAD,
    MAKE_SNAPSHOT,
    RELEASE_SNAPSHOT,
    MOVE,
    RECOVER_TABLET,
    UPDATE_TABLET_META_INFO
};

template <class TReq>
struct AgentTaskRequestWithReqBody {
    AgentTaskRequestWithReqBody(const TAgentTaskRequest& task, const TReq& t_req, time_t ts) {
        isset = task.__isset;
        protocol_version = task.protocol_version;
        task_type = task.task_type;
        signature = task.signature;
        priority = task.priority;
        recv_time = ts;
        isset.recv_time = true;
        task_req = t_req;
    }

    _TAgentTaskRequest__isset isset;
    TAgentServiceVersion::type protocol_version;
    TTaskType::type task_type;
    int64_t signature;
    TPriority::type priority;
    int64_t recv_time;
    TReq task_req;
};

struct AgentTaskRequestWithoutReqBody {
    explicit AgentTaskRequestWithoutReqBody(const TAgentTaskRequest& task, time_t ts) {
        isset = task.__isset;
        protocol_version = task.protocol_version;
        task_type = task.task_type;
        signature = task.signature;
        priority = task.priority;
        recv_time = ts;
        isset.recv_time = true;
    }

    _TAgentTaskRequest__isset isset;
    TAgentServiceVersion::type protocol_version;
    TTaskType::type task_type;
    int64_t signature;
    TPriority::type priority;
    int64_t recv_time;
};

const int MIN_TRANSACTION_PUBLISH_WORKER_COUNT = 1;

using CreateTabletAgentTaskRequest = AgentTaskRequestWithReqBody<TCreateTabletReq>;
using DropTabletAgentTaskRequest = AgentTaskRequestWithReqBody<TDropTabletReq>;
using PushReqAgentTaskRequest = AgentTaskRequestWithReqBody<TPushReq>;
using PublishVersionAgentTaskRequest = AgentTaskRequestWithReqBody<TPublishVersionRequest>;
using ClearTransactionAgentTaskRequest = AgentTaskRequestWithReqBody<TClearTransactionTaskRequest>;
using AlterTabletAgentTaskRequest = AgentTaskRequestWithReqBody<TAlterTabletReqV2>;
using CloneAgentTaskRequest = AgentTaskRequestWithReqBody<TCloneReq>;
using StorageMediumMigrateTaskRequest = AgentTaskRequestWithReqBody<TStorageMediumMigrateReq>;
using CheckConsistencyTaskRequest = AgentTaskRequestWithReqBody<TCheckConsistencyReq>;
using CompactionTaskRequest = AgentTaskRequestWithReqBody<TCompactionReq>;
using CompactionControlTaskRequest = AgentTaskRequestWithReqBody<TCompactionControlReq>;
using UploadAgentTaskRequest = AgentTaskRequestWithReqBody<TUploadReq>;
using DownloadAgentTaskRequest = AgentTaskRequestWithReqBody<TDownloadReq>;
using SnapshotAgentTaskRequest = AgentTaskRequestWithReqBody<TSnapshotRequest>;
using ReleaseSnapshotAgentTaskRequest = AgentTaskRequestWithReqBody<TReleaseSnapshotRequest>;
using MoveDirAgentTaskRequest = AgentTaskRequestWithReqBody<TMoveDirReq>;
using UpdateTabletMetaInfoAgentTaskRequest = AgentTaskRequestWithReqBody<TUpdateTabletMetaInfoReq>;
using DropAutoIncrementMapAgentTaskRequest = AgentTaskRequestWithReqBody<TDropAutoIncrementMapReq>;
using RemoteSnapshotAgentTaskRequest = AgentTaskRequestWithReqBody<TRemoteSnapshotRequest>;
using ReplicateSnapshotAgentTaskRequest = AgentTaskRequestWithReqBody<TReplicateSnapshotRequest>;
using UpdateSchemaTaskRequest = AgentTaskRequestWithReqBody<TUpdateSchemaReq>;

} // namespace starrocks

```

### Core Architecture Module: `be/src/agent/agent_metrics.cpp`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "agent/agent_metrics.h"

#include "common/thread/threadpool.h"
#include "gutil/macros.h"

namespace starrocks {

void AgentIntGaugeMetricsMap::set_metric(const std::string& key, int64_t val) {
    auto metric = _metrics.find(key);
    if (metric != _metrics.end()) {
        metric->second->set_value(val);
    }
}

IntGauge* AgentIntGaugeMetricsMap::add_metric(const std::string& key, MetricUnit unit) {
    auto [it, inserted] = _metrics.emplace(key, nullptr);
    if (inserted) {
        it->second = std::make_unique<IntGauge>(unit);
    }
    return it->second.get();
}

AgentMetrics* AgentMetrics::instance() {
    // Process-lifetime singleton: registered Metric objects keep back-pointers
    // to MetricRegistry, so avoid exit-time destruction after registry teardown.
    static auto* instance = new AgentMetrics();
    return instance;
}

void AgentMetrics::install(MetricRegistry* registry) {
    if (_registry != nullptr) {
        DCHECK_EQ(_registry, registry);
        return;
    }
    _registry = registry;

#define REGISTER_ENGINE_REQUEST_METRIC(type, status, metric)                                                     \
    registry->register_metric("engine_requests_total", MetricLabels().add("type", #type).add("status", #status), \
                              &metric)

    REGISTER_ENGINE_REQUEST_METRIC(report_all_tablets, failed, report_all_tablets_requests_failed);
    REGISTER_ENGINE_REQUEST_METRIC(report_tablet, failed, report_tablet_requests_failed);
    REGISTER_ENGINE_REQUEST_METRIC(report_disk, total, report_disk_requests_total);
    REGISTER_ENGINE_REQUEST_METRIC(report_disk, failed, report_disk_requests_failed);
    REGISTER_ENGINE_REQUEST_METRIC(report_task, total, report_task_requests_total);
    REGISTER_ENGINE_REQUEST_METRIC(report_task, failed, report_task_requests_failed);

    REGISTER_ENGINE_REQUEST_METRIC(schema_change, total, schema_change_requests_total);
    REGISTER_ENGINE_REQUEST_METRIC(schema_change, failed, schema_change_requests_failed);
    REGISTER_ENGINE_REQUEST_METRIC(clone, total, clone_requests_total);
    REGISTER_ENGINE_REQUEST_METRIC(clone, failed, clone_requests_failed);

    REGISTER_ENGINE_REQUEST_METRIC(finish_task, total, finish_task_requests_total);
    REGISTER_ENGINE_REQUEST_METRIC(finish_task, failed, finish_task_requests_failed);

    REGISTER_ENGINE_REQUEST_METRIC(publish, total, publish_task_request_total);
    REGISTER_ENGINE_REQUEST_METRIC(publish, failed, publish_task_failed_total);

#undef REGISTER_ENGINE_REQUEST_METRIC

    registry->register_metric("clone_task_copy_bytes", MetricLabels().add("type", "INTER_NODE"),
                              &clone_task_inter_node_copy_bytes);
    registry->register_metric("clone_task_copy_bytes", MetricLabels().add("type", "INTRA_NODE"),
                              &clone_task_intra_node_copy_bytes);
    registry->register_metric("clone_task_copy_duration_ms", MetricLabels().add("type", "INTER_NODE"),
                              &clone_task_inter_node_copy_duration_ms);
    registry->register_metric("clone_task_copy_duration_ms", MetricLabels().add("type", "INTRA_NODE"),
                              &clone_task_intra_node_copy_duration_ms);

    for (const auto& pending : _pending_thread_pool_metrics) {
        _register_thread_pool_metrics(pending.name, pending.metric_group, pending.threadpool);
    }
    _pending_thread_pool_metrics.clear();
}

void AgentMetrics::install_disk_path_metrics(MetricRegistry* registry, const std::vector<std::string>& paths) {
    DCHECK_EQ(_registry, registry);
    for (auto& path : paths) {
        IntGauge* gauge = _disks_total_capacity.add_metric(path, MetricUnit::BYTES);
        registry->register_metric("disks_total_capacity", MetricLabels().add("path", path), gauge);
        gauge = _disks_avail_capacity.add_metric(path, MetricUnit::BYTES);
        registry->register_metric("disks_avail_capacity", MetricLabels().add("path", path), gauge);
        gauge = _disks_data_used_capacity.add_metric(path, MetricUnit::BYTES);
        registry->register_metric("disks_data_used_capacity", MetricLabels().add("path", path), gauge);
        gauge = _disks_state.add_metric(path, MetricUnit::NOUNIT);
        registry->register_metric("disks_state", MetricLabels().add("path", path), gauge);
    }
}

void AgentMetrics::set_disk_metrics(const std::string& path, int64_t total_capacity, int64_t available_capacity,
                                    int64_t data_used_capacity, int64_t state) {
    _disks_total_capacity.set_metric(path, total_capacity);
    _disks_avail_capacity.set_metric(path, available_capacity);
    _disks_data_used_capacity.set_metric(path, data_used_capacity);
    _disks_state.set_metric(path, state);
}

void AgentMetrics::register_thread_pool_metrics(const std::string& name, ThreadPoolMetricGroup* metric_group,
                                                ThreadPool* threadpool) {
    DCHECK(metric_group != nullptr);
    DCHECK(threadpool != nullptr);
    if (_registry == nullptr) {
        _pending_thread_pool_metrics.emplace_back(PendingThreadPoolMetrics{name, metric_group, threadpool});
        return;
    }
    _register_thread_pool_metrics(name, metric_group, threadpool);
}

void AgentMetrics::_register_thread_pool_metrics(const std::string& name, ThreadPoolMetricGroup* metric_group,
                                                 ThreadPool* threadpool) {
    DCHECK(_registry != nullptr);
    DCHECK(metric_group != nullptr);
    DCHECK(threadpool != nullptr);

    metric_group->register_metrics(_registry, name, threadpool);
}

} // namespace starrocks

```

### Core Architecture Module: `be/src/agent/agent_metrics.h`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "base/metrics.h"
#include "common/metrics/thread_pool_metric_group.h"

namespace starrocks {

class ThreadPool;

class AgentIntGaugeMetricsMap {
public:
    void set_metric(const std::string& key, int64_t val);
    IntGauge* add_metric(const std::string& key, MetricUnit unit);

private:
    std::unordered_map<std::string, std::unique_ptr<IntGauge>> _metrics;
};

class AgentMetrics {
public:
    AgentMetrics() = default;
    explicit AgentMetrics(MetricRegistry* registry) { install(registry); }
    ~AgentMetrics() = default;

    static AgentMetrics* instance();

    void install(MetricRegistry* registry);
    void install_disk_path_metrics(MetricRegistry* registry, const std::vector<std::string>& paths);
    void set_disk_metrics(const std::string& path, int64_t total_capacity, int64_t available_capacity,
                          int64_t data_used_capacity, int64_t state);
    void register_thread_pool_metrics(const std::string& name, ThreadPoolMetricGroup* metric_group,
                                      ThreadPool* threadpool);

    METRIC_DEFINE_INT_COUNTER(report_all_tablets_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_tablet_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_disk_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_disk_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_task_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_task_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_workgroup_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_workgroup_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_resource_usage_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_resource_usage_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_datacache_metrics_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(report_datacache_metrics_requests_failed, MetricUnit::REQUESTS);

    METRIC_DEFINE_INT_COUNTER(schema_change_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(schema_change_requests_failed, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(clone_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(clone_requests_failed, MetricUnit::REQUESTS);

    METRIC_DEFINE_INT_COUNTER(finish_task_requests_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(finish_task_requests_failed, MetricUnit::REQUESTS);

    METRIC_DEFINE_INT_COUNTER(clone_task_inter_node_copy_bytes, MetricUnit::BYTES);
    METRIC_DEFINE_INT_COUNTER(clone_task_intra_node_copy_bytes, MetricUnit::BYTES);
    METRIC_DEFINE_INT_COUNTER(clone_task_inter_node_copy_duration_ms, MetricUnit::MILLISECONDS);
    METRIC_DEFINE_INT_COUNTER(clone_task_intra_node_copy_duration_ms, MetricUnit::MILLISECONDS);

    METRIC_DEFINE_INT_COUNTER(publish_task_request_total, MetricUnit::REQUESTS);
    METRIC_DEFINE_INT_COUNTER(publish_task_failed_total, MetricUnit::REQUESTS);

    METRICS_DEFINE_THREAD_POOL(publish_version);
    METRICS_DEFINE_THREAD_POOL(drop);
    METRICS_DEFINE_THREAD_POOL(create_tablet);
    METRICS_DEFINE_THREAD_POOL(alter_tablet);
    METRICS_DEFINE_THREAD_POOL(clear_transaction);
    METRICS_DEFINE_THREAD_POOL(storage_medium_migrate);
    METRICS_DEFINE_THREAD_POOL(check_consistency);
    METRICS_DEFINE_THREAD_POOL(manual_compaction);
    METRICS_DEFINE_THREAD_POOL(compaction_control);
    METRICS_DEFINE_THREAD_POOL(update_schema);
    METRICS_DEFINE_THREAD_POOL(upload);
    METRICS_DEFINE_THREAD_POOL(download);
    METRICS_DEFINE_THREAD_POOL(make_snapshot);
    METRICS_DEFINE_THREAD_POOL(release_snapshot);
    METRICS_DEFINE_THREAD_POOL(move_dir);
    METRICS_DEFINE_THREAD_POOL(update_tablet_meta_info);
    METRICS_DEFINE_THREAD_POOL(drop_auto_increment_map_dir);
    METRICS_DEFINE_THREAD_POOL(clone);
    METRICS_DEFINE_THREAD_POOL(remote_snapshot);
    METRICS_DEFINE_THREAD_POOL(replicate_snapshot);
    METRICS_DEFINE_THREAD_POOL(replicate_file);

private:
    struct PendingThreadPoolMetrics {
        std::string name;
        ThreadPoolMetricGroup* metric_group;
        ThreadPool* threadpool;
    };

    void _register_thread_pool_metrics(const std::string& name, ThreadPoolMetricGroup* metric_group,
                                       ThreadPool* threadpool);

    MetricRegistry* _registry = nullptr;
    std::vector<PendingThreadPoolMetrics> _pending_thread_pool_metrics;

    AgentIntGaugeMetricsMap _disks_total_capacity;
    AgentIntGaugeMetricsMap _disks_avail_capacity;
    AgentIntGaugeMetricsMap _disks_data_used_capacity;
    AgentIntGaugeMetricsMap _disks_state;
};

} // namespace starrocks

#define REGISTER_AGENT_THREAD_POOL_METRICS(agent_metrics, metric_name, threadpool)                          \
    do {                                                                                                    \
        auto* metric_owner = (agent_metrics);                                                               \
        metric_owner->register_thread_pool_metrics(#metric_name, &metric_owner->metric_name, (threadpool)); \
    } while (false)

```

### Core Architecture Module: `be/src/agent/agent_server.cpp`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file is based on code available under the Apache license here:
//   https://github.com/apache/incubator-doris/blob/master/be/src/agent/agent_server.cpp

// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#include "agent/agent_server.h"

#include <thrift/protocol/TDebugProtocol.h>

#include <filesystem>
#include <string>
#include <vector>

#include "agent/agent_metrics.h"
#include "agent/agent_task.h"
#include "agent/publish_version_manager.h"
#include "agent/task_signatures_manager.h"
#include "agent/task_worker_pool.h"
#include "base/phmap/phmap.h"
#include "base/testutil/sync_point.h"
#include "common/config_agent_fwd.h"
#include "common/config_primary_key_fwd.h"
#include "common/config_storage_fwd.h"
#include "common/logging.h"
#include "common/status.h"
#include "common/system/cpu_info.h"
#include "common/system/master_info.h"
#include "common/thread/threadpool.h"
#include "exec/exec_env.h"
#include "gutil/strings/substitute.h"
#include "platform/store_path.h"
#include "storage/snapshot_manager.h"

namespace starrocks {

namespace {
constexpr size_t DEFAULT_DYNAMIC_THREAD_POOL_QUEUE_SIZE = 2048;
constexpr size_t MIN_CLONE_TASK_THREADS_IN_POOL = 2;
constexpr int32_t REPLICATION_CPU_CORES_MULTIPLIER = 4;
constexpr size_t MAX_LOGGED_TASK_SIGNATURES = 100;
constexpr size_t MAX_INT64_STRING_SIZE = 20;
} // namespace

using TTaskTypeHash = std::hash<std::underlying_type<TTaskType::type>::type>;

#ifndef BE_TEST
const uint32_t REPORT_TASK_WORKER_COUNT = 1;
const uint32_t REPORT_DISK_STATE_WORKER_COUNT = 1;
const uint32_t REPORT_OLAP_TABLE_WORKER_COUNT = 1;
const uint32_t REPORT_WORKGROUP_WORKER_COUNT = 1;
const uint32_t REPORT_RESOURCE_USAGE_WORKER_COUNT = 1;
const uint32_t REPORT_DATACACHE_METRICS_WORKER_COUNT = 1;
#endif

/* calculate real num threads
 * if num_threads > 0, return num_threads
 * if num_threads < 0, return -num_threads * cpu_cores
 * if num_threads == 0, return cpu_cores_multiplier * cpu_cores
*/
static int32_t calc_real_num_threads(int32_t num_threads, int32_t cpu_cores_multiplier = 1) {
    if (num_threads == 0) {
        num_threads = -cpu_cores_multiplier;
    }
    if (num_threads < 0) {
        num_threads = -num_threads;
        num_threads *= CpuInfo::num_cores();
    }
    if (num_threads < 1) {
        num_threads = 1;
    }
    return num_threads;
}

static int32_t calc_clone_thread_pool_size(size_t num_store_paths, int32_t parallel_clone_task_per_path) {
    return std::max(static_cast<int32_t>(num_store_paths) * parallel_clone_task_per_path,
                    static_cast<int32_t>(MIN_CLONE_TASK_THREADS_IN_POOL));
}

class AgentServer::Impl {
public:
    explicit Impl(ExecEnv* exec_env, bool is_compute_node) : _exec_env(exec_env), _is_compute_node(is_compute_node) {}

    ~Impl();

    Status start();

    void stop();

    void submit_tasks(TAgentResult& agent_result, const std::vector<TAgentTaskRequest>& tasks);

    void make_snapshot(TAgentResult& agent_result, const TSnapshotRequest& snapshot_request);

    void release_snapshot(TAgentResult& agent_result, const std::string& snapshot_path);

    void publish_cluster_state(TAgentResult& agent_result, const TAgentPublishRequest& request);

    void update_max_thread_by_type(int type, int new_val);

    ThreadPool* get_thread_pool(int type) const;

    PublishVersionManager* publish_version_manager() const { return _publish_version_manager.get(); }

    ThreadPool* get_lake_replicate_file_thread_pool() const { return _thread_pool_replicate_file.get(); }

    void stop_task_worker_pool(TaskWorkerType type) const;

    DISALLOW_COPY_AND_MOVE(Impl);

private:
    enum class ThreadPoolResizePolicy {
        RAW,
        CPU_SCALED,
        REPLICATION_CPU_SCALED,
        CLONE_PER_STORE_PATH,
    };

    using ThreadPoolMember = std::unique_ptr<ThreadPool> Impl::*;

    struct ThreadPoolSpec {
        ThreadPoolMember pool = nullptr;
        ThreadPoolResizePolicy resize_policy = ThreadPoolResizePolicy::RAW;
    };

    const ThreadPoolSpec* get_thread_pool_spec(int type) const;
    ThreadPool* thread_pool_from_spec(const ThreadPoolSpec& spec) const;
    int32_t calc_max_threads_by_policy(const ThreadPoolSpec& spec, int32_t new_val) const;

    template <typename AgentTaskRequest, typename TaskRequest, typename TaskFunc, typename... TaskFuncArgs>
    void submit_task_batch(TTaskType::type task_type, const std::vector<const TAgentTaskRequest*>& all_tasks,
                           ThreadPool* pool, TaskRequest TAgentTaskRequest::*request, TaskFunc task_func,
                           Status* submit_status, TaskFuncArgs... task_func_args);

    ExecEnv* _exec_env;

    std::unique_ptr<ThreadPool> _thread_pool_publish_version;
    std::unique_ptr<ThreadPool> _thread_pool_clone;
    std::unique_ptr<ThreadPool> _thread_pool_drop;
    std::unique_ptr<ThreadPool> _thread_pool_create_tablet;
    std::unique_ptr<ThreadPool> _thread_pool_alter_tablet;
    std::unique_ptr<ThreadPool> _thread_pool_clear_transaction;
    std::unique_ptr<ThreadPool> _thread_pool_storage_medium_migrate;
    std::unique_ptr<ThreadPool> _thread_pool_check_consistency;
    std::unique_ptr<ThreadPool> _thread_pool_compaction;
    std::unique_ptr<ThreadPool> _thread_pool_compaction_control;
    std::unique_ptr<ThreadPool> _thread_pool_update_schema;

    std::unique_ptr<ThreadPool> _thread_pool_upload;
    std::unique_ptr<ThreadPool> _thread_pool_download;
    std::unique_ptr<ThreadPool> _thread_pool_make_snapshot;
    std::unique_ptr<ThreadPool> _thread_pool_release_snapshot;
    std::unique_ptr<ThreadPool> _thread_pool_move_dir;
    std::unique_ptr<ThreadPool> _thread_pool_update_tablet_meta_info;
    std::unique_ptr<ThreadPool> _thread_pool_drop_auto_increment_map;
    std::unique_ptr<ThreadPool> _thread_pool_remote_snapshot;
    std::unique_ptr<ThreadPool> _thread_pool_replicate_snapshot;
    // Dedicated pool for per-file copy in lake-to-lake replication, sized by
    // `lake_replication_file_copy_threads`. Kept distinct from `_thread_pool_replicate_snapshot`
    // so that the outer agent task can wait on per-file sub-tasks without self-deadlock.
    std::unique_ptr<ThreadPool> _thread_pool_replicate_file;

    std::unique_ptr<PublishVersionManager> _publish_version_manager;

    std::unique_ptr<PushTaskWorkerPool> _push_workers;
    std::unique_ptr<PublishVersionTaskWorkerPool> _publish_version_workers;
    std::unique_ptr<DeleteTaskWorkerPool> _delete_workers;

    // These 3 worker-pool do not accept tasks from FE.
    // It is self triggered periodically and reports to Fe master
    std::unique_ptr<ReportTaskWorkerPool> _report_task_workers
```

### Core Architecture Module: `be/src/agent/agent_server.h`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file is based on code available under the Apache license here:
//   https://github.com/apache/incubator-doris/blob/master/be/src/agent/agent_server.h

// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <memory>
#include <string>
#include <vector>

#include "agent/agent_common.h"
#include "gutil/macros.h"

namespace starrocks {

class ExecEnv;
class PublishVersionManager;
class Status;
class TAgentTaskRequest;
class TAgentResult;
class TAgentPublishRequest;
class TSnapshotRequest;
class ThreadPool;

// Each method corresponds to one RPC from FE Master, see BackendService.
class AgentServer {
public:
    explicit AgentServer(ExecEnv* exec_env, bool is_compute_node);

    ~AgentServer();

    Status start();

    void stop();

    void submit_tasks(TAgentResult& agent_result, const std::vector<TAgentTaskRequest>& tasks);

    void make_snapshot(TAgentResult& agent_result, const TSnapshotRequest& snapshot_request);

    void release_snapshot(TAgentResult& agent_result, const std::string& snapshot_path);

    void publish_cluster_state(TAgentResult& agent_result, const TAgentPublishRequest& request);

    void update_max_thread_by_type(int type, int new_val);

    // |type| should be one of `TTaskType::type`, didn't define type as  `TTaskType::type` because
    // I don't want to include the header file `gen_cpp/Types_types.h` here.
    //
    // Returns nullptr if `type` is not a valid value of `TTaskType::type`.
    ThreadPool* get_thread_pool(int type) const;

    PublishVersionManager* publish_version_manager() const;

    // Dedicated pool for per-file copy in lake-to-lake replication. Returned pool is distinct
    // from `get_thread_pool(TTaskType::REPLICATE_SNAPSHOT)` so that the outer agent task can
    // submit per-file sub-tasks and call ThreadPoolToken::wait() on them without tripping the
    // thread-pool self-deadlock guard.
    ThreadPool* get_lake_replicate_file_thread_pool() const;

    void stop_task_worker_pool(TaskWorkerType type) const;

    DISALLOW_COPY_AND_MOVE(AgentServer);

private:
    class Impl;
    std::unique_ptr<Impl> _impl;
};

} // end namespace starrocks

```

### Core Architecture Module: `be/src/agent/agent_task.cpp`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "agent/agent_task.h"

#include <fmt/format.h>

#include "agent/agent_common.h"
#include "agent/agent_metrics.h"
#include "agent/finish_task.h"
#include "agent/task_signatures_manager.h"
#include "base/testutil/sync_point.h"
#include "boost/lexical_cast.hpp"
#include "common/config_agent_fwd.h"
#include "common/status.h"
#include "common/system/backend_options.h"
#include "data_workflows/clone/engine_clone_task.h"
#include "data_workflows/compaction/engine_compaction_control_task.h"
#include "data_workflows/compaction/engine_manual_compaction_task.h"
#include "data_workflows/consistency/engine_checksum_task.h"
#include "data_workflows/migration/engine_storage_migration_task.h"
#include "data_workflows/schema_change/engine_alter_tablet_task.h"
#include "data_workflows/snapshot/snapshot_loader.h"
#include "exec/exec_env.h"
#include "gutil/strings/join.h"
#include "io/io_profiler.h"
#include "runtime/current_thread.h"
#include "storage/lake/replication_txn_manager.h"
#include "storage/lake/schema_change.h"
#include "storage/lake/tablet_manager.h"
#include "storage/metadata_util.h"
#include "storage/replication_txn_manager.h"
#include "storage/snapshot_manager.h"
#include "storage/storage_env.h"
#include "storage/tablet_manager.h"
#include "storage/txn_manager.h"
#include "storage/update_manager.h"
#include "storage_primitive/flat_json_config.h"

namespace starrocks {

extern std::atomic<int64_t> g_report_version;

static AgentStatus get_tablet_info(TTabletId tablet_id, TSchemaHash schema_hash, int64_t signature,
                                   TTabletInfo* tablet_info) {
    AgentStatus status = STARROCKS_SUCCESS;

    tablet_info->__set_tablet_id(tablet_id);
    tablet_info->__set_schema_hash(schema_hash);
    Status st = StorageEngine::instance()->tablet_manager()->report_tablet_info(tablet_info);
    if (!st.ok()) {
        LOG(WARNING) << "Fail to get tablet info, status=" << st.to_string() << " signature=" << signature;
        status = STARROCKS_ERROR;
    }
    return status;
}

static void alter_tablet(const TAlterTabletReqV2& agent_task_req, int64_t signature, ExecEnv* exec_env,
                         TFinishTaskRequest* finish_task_request) {
    TStatus task_status;
    std::vector<std::string> error_msgs;

    // Check last schema change status, if failed delete tablet file
    // Do not need to adjust delete success or not
    // Because if delete failed create rollup will failed
    TTabletId new_tablet_id;
    TSchemaHash new_schema_hash = 0;
    new_tablet_id = agent_task_req.new_tablet_id;
    new_schema_hash = agent_task_req.new_schema_hash;
    EngineAlterTabletTask engine_task(RuntimeEnv::GetInstance()->schema_change_mem_tracker(), agent_task_req, exec_env);
    Status sc_status = StorageEngine::instance()->execute_task(&engine_task);
    AgentStatus status;
    if (!sc_status.ok()) {
        status = STARROCKS_ERROR;
    } else {
        status = STARROCKS_SUCCESS;
    }

    std::string alter_msg_head =
            strings::Substitute("[Alter Job:$0, tablet:$1]: ", agent_task_req.job_id, agent_task_req.base_tablet_id);
    if (status == STARROCKS_SUCCESS) {
        g_report_version.fetch_add(1, std::memory_order_relaxed);
        VLOG(1) << alter_msg_head << "alter finished. signature: " << signature;
    }

    // Return result to fe
    finish_task_request->__set_backend(BackendOptions::get_localBackend());
    finish_task_request->__set_report_version(g_report_version.load(std::memory_order_relaxed));
    finish_task_request->__set_task_type(TTaskType::ALTER);
    finish_task_request->__set_signature(signature);

    std::vector<TTabletInfo> finish_tablet_infos;
    if (status == STARROCKS_SUCCESS) {
        TTabletInfo& tablet_info = finish_tablet_infos.emplace_back();
        if (agent_task_req.tablet_type != TTabletType::TABLET_TYPE_LAKE) {
            status = get_tablet_info(new_tablet_id, new_schema_hash, signature, &tablet_info);
        } else {
            tablet_info.__set_tablet_id(new_tablet_id);
            // Following are unused for LakeTablet but they are defined as required thrift fields, have to init them.
            tablet_info.__set_schema_hash(0);
            tablet_info.__set_version(0);
            tablet_info.__set_row_count(0);
            tablet_info.__set_data_size(0);
            tablet_info.__set_version_count(1);
        }

        LOG_IF(WARNING, status != STARROCKS_SUCCESS)
                << alter_msg_head << "alter success, but get new tablet info failed."
                << "tablet_id: " << new_tablet_id << ", schema_hash: " << new_schema_hash
                << ", signature: " << signature;
    }

    if (status == STARROCKS_SUCCESS) {
        swap(finish_tablet_infos, finish_task_request->finish_tablet_infos);
        finish_task_request->__isset.finish_tablet_infos = true;
        VLOG(2) << alter_msg_head << "alter success. signature: " << signature;
        error_msgs.emplace_back("alter success");
        task_status.__set_status_code(TStatusCode::OK);
    } else if (status == STARROCKS_TASK_REQUEST_ERROR) {
        LOG(WARNING) << alter_msg_head << "alter table request task type invalid. "
                     << "signature:" << signature;
        error_msgs.emplace_back("alter table request new tablet id or schema count invalid.");
        task_status.__set_status_code(TStatusCode::ANALYSIS_ERROR);
    } else {
        LOG(WARNING) << alter_msg_head << "alter failed. signature: " << signature;
        error_msgs.emplace_back("alter failed");
        error_msgs.emplace_back("status: " + print_agent_status(status));
        error_msgs.emplace_back(sc_status.message());
        task_status.__set_status_code(TStatusCode::RUNTIME_ERROR);
    }

    task_status.__set_error_msgs(error_msgs);
    finish_task_request->__set_task_status(task_status);
}

static void unify_finish_agent_task(TStatusCode::type status_code, const std::vector<std::string>& error_msgs,
                                    const TTaskType::type task_type, int64_t signature, bool report_version = false) {
    TStatus task_status;
    task_status.__set_status_code(status_code);
    task_status.__set_error_msgs(error_msgs);

    TFinishTaskRequest finish_task_request;
    finish_task_request.__set_backend(BackendOptions::get_localBackend());
    finish_task_request.__set_task_type(task_type);
    finish_task_request.__set_signature(signature);
    if (report_version) {
        finish_task_request.__set_report_version(g_report_version.load(std::memory_order_relaxed));
    }
    finish_task_request.__set_task_status(task_status);

    finish_task(finish_task_request);
    size_t task_queue_size = remove_task_info(task_type, signature);
    VLOG(1) << "Remove task success. type=" << task_type << ", signature=" << signature
            << ", task_count_in_queue=" << task_queue_size;
}

void run_drop_tablet_task(const std::shared_ptr<DropTabletAgentTaskRequest>& agent_task_req, ExecEnv* exec_env) {
    const TDropTabletReq& drop_tablet_req = agent_task_req->task_req;

    bool force_drop = drop_tablet_req.__isset.force && drop_tablet_req.force;
    TStatusCode::type status_code = TStatusCode::OK;
    std::vector<std::string> error_msgs;

    auto dropped_tablet = StorageEngine::instance()->tablet_manager()->get_tablet(drop_tablet_req.tablet_id);
    if (dropped_tablet != nullptr) {
        if (!config::
```

### Core Architecture Module: `be/src/agent/agent_task.h`
```
// Copyright 2021-present StarRocks, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include "agent/task_worker_pool.h"
#include "common/storage_define.h"
#include "gen_cpp/AgentService_types.h"
#include "runtime/runtime_fwd.h"

namespace starrocks {

class ThreadPool;

void run_drop_tablet_task(const std::shared_ptr<DropTabletAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_create_tablet_task(const std::shared_ptr<CreateTabletAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_alter_tablet_task(const std::shared_ptr<AlterTabletAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_clear_transaction_task(const std::shared_ptr<ClearTransactionAgentTaskRequest>& agent_task_req,
                                ExecEnv* exec_env);
void run_clone_task(const std::shared_ptr<CloneAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_storage_medium_migrate_task(const std::shared_ptr<StorageMediumMigrateTaskRequest>& agent_task_req,
                                     ExecEnv* exec_env);
void run_check_consistency_task(const std::shared_ptr<CheckConsistencyTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_compaction_task(const std::shared_ptr<CompactionTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_compaction_control_task(const std::shared_ptr<CompactionControlTaskRequest>& agent_task_req,
                                 ExecEnv* exec_env);
void run_update_schema_task(const std::shared_ptr<UpdateSchemaTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_upload_task(const std::shared_ptr<UploadAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_download_task(const std::shared_ptr<DownloadAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_make_snapshot_task(const std::shared_ptr<SnapshotAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_release_snapshot_task(const std::shared_ptr<ReleaseSnapshotAgentTaskRequest>& agent_task_req,
                               ExecEnv* exec_env);
void run_move_dir_task(const std::shared_ptr<MoveDirAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_update_meta_info_task(const std::shared_ptr<UpdateTabletMetaInfoAgentTaskRequest>& agent_task_req,
                               ExecEnv* exec_env);
void run_drop_auto_increment_map_task(const std::shared_ptr<DropAutoIncrementMapAgentTaskRequest>& agent_task_req,
                                      ExecEnv* exec_env);
void run_remote_snapshot_task(const std::shared_ptr<RemoteSnapshotAgentTaskRequest>& agent_task_req, ExecEnv* exec_env);
void run_replicate_snapshot_task(const std::shared_ptr<ReplicateSnapshotAgentTaskRequest>& agent_task_req,
                                 ExecEnv* exec_env, ThreadPool* replicate_file_pool);
} // namespace starrocks

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39507** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query94 case#0**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0004, _ca0005, _ca0006, web_company_name, ca_state, d_date) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (count(DISTINCT _ta0001.ws_order_number)) AS _ca0004   ,(sum(_ta0001.ws_ext_ship_cost)) AS _ca0005   ,(sum(_ta0001.ws_net_profit)) AS _ca0006   ,_ta0001.web_company_name   ,_ta0001.ca_state   ,_ta0001.d_date FROM   (     SELECT       web_sales.ws_order_number       ,web_sales.ws_net_profit       ,web_sales.ws_ext_ship_cost       ,web_site.web_company_name       ,customer_address.ca_state       ,date_dim.d_date     FROM       web_sales       INNER JOIN       date_dim       ON (web_sales.ws_ship_date_sk = date_dim.d_date_sk)       INNER JOIN       customer_address       ON (web_sales.ws_ship_addr_sk = customer_address.ca_address_sk)       INNER JOIN       web_site       ON (web_sales.ws_web_site_sk = web_site.web_site_sk)     WHERE       (date_dim.d_date <= "1999-04-02")       AND (customer_address.ca_state = "IL")       AND ("1999-02-01" <= date_dim.d_date)       AND (web_site.web_company_name = "pri")   ) _ta0001 GROUP BY   _ta0001.web_company_name   , _ta0001.ca_state   , _ta0001.d_date; ``` ```sql REFRESH MATERIALIZED VIEW __mv WITH

- **Issue #39506** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query49 case#1**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0008, _ca0009, _ca0010, _ca0011, d_year, d_moy, cr_return_amount, cs_quantity, cs_net_paid, cs_net_profit, cs_item_sk) DISTRIBUTED BY HASH (d_year, d_moy, cr_return_amount, cs_quantity, cs_net_paid, cs_net_profit, cs_item_sk) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0001._ca0005)) AS _ca0008   ,(sum(_ta0001._ca0002)) AS _ca0009   ,(sum(_ta0001._ca0003)) AS _ca0010   ,(sum(_ta0001._ca0004)) AS _ca0011   ,_ta0001.d_year   ,_ta0001.d_moy   ,_ta0001.cr_return_amount   ,_ta0001.cs_quantity   ,_ta0001.cs_net_paid   ,_ta0001.cs_net_profit   ,_ta0001.cs_item_sk FROM   (     SELECT       catalog_sales.cs_item_sk       ,catalog_sales.cs_net_profit       ,catalog_sales.cs_quantity       ,date_dim.d_year       ,catalog_returns.cr_return_amount       ,date_dim.d_moy       ,(coalesce(catalog_returns.cr_return_quantity, 0)) AS _ca0002       ,(coalesce(catalog_sales.cs_quantity, 0)) AS _ca0003       ,(coalesce(catalog_returns.cr_return_amount, 0.00)) AS _ca0004       ,(coalesce(catalog_sales.cs_net_paid, 0.00)) AS _ca0005       ,catalog_sales.cs_net_paid     FROM       catalog_sales       INNER JOIN       catalog_returns       ON (catalog_sa

- **Issue #39505** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query04 case#2**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0005, d_year, c_customer_id, c_first_name, c_last_name, c_preferred_cust_flag, c_birth_country, c_login, c_email_address) DISTRIBUTED BY HASH (d_year, c_customer_id, c_first_name, c_last_name, c_preferred_cust_flag, c_birth_country, c_login, c_email_address) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0001._ca0002)) AS _ca0005   ,_ta0001.d_year   ,_ta0001.c_customer_id   ,_ta0001.c_first_name   ,_ta0001.c_last_name   ,_ta0001.c_preferred_cust_flag   ,_ta0001.c_birth_country   ,_ta0001.c_login   ,_ta0001.c_email_address FROM   (     SELECT       customer.c_email_address       ,(((((catalog_sales.cs_ext_list_price - catalog_sales.cs_ext_wholesale_cost) - catalog_sales.cs_ext_discount_amt) + catalog_sales.cs_ext_sales_price) / 2)) AS _ca0002       ,customer.c_customer_id       ,customer.c_first_name       ,customer.c_last_name       ,date_dim.d_year       ,customer.c_preferred_cust_flag       ,customer.c_birth_country       ,customer.c_login     FROM       customer       INNER JOIN       catalog_sales       ON (customer.c_customer_sk = catalog_sales.cs_bill_customer_sk)       INNER JOIN       date_dim       ON (catalog_sales.cs_sol

- **Issue #39504** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query60 case#2**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0003, ca_gmt_offset, d_year, d_moy, i_item_id) DISTRIBUTED BY HASH (ca_gmt_offset, d_year, d_moy, i_item_id) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0000.ws_ext_sales_price)) AS _ca0003   ,_ta0000.ca_gmt_offset   ,_ta0000.d_year   ,_ta0000.d_moy   ,_ta0000.i_item_id FROM   (     SELECT       web_sales.ws_ext_sales_price       ,date_dim.d_year       ,customer_address.ca_gmt_offset       ,date_dim.d_moy       ,item.i_item_id     FROM       web_sales       INNER JOIN       date_dim       ON (web_sales.ws_sold_date_sk = date_dim.d_date_sk)       INNER JOIN       customer_address       ON (web_sales.ws_bill_addr_sk = customer_address.ca_address_sk)       INNER JOIN       item       ON (web_sales.ws_item_sk = item.i_item_sk)   ) _ta0000 GROUP BY   _ta0000.ca_gmt_offset   , _ta0000.d_year   , _ta0000.d_moy   , _ta0000.i_item_id; ``` ```sql REFRESH MATERIALIZED VIEW __mv WITH SYNC MODE; ``` ```sql show materialized views like '__mv'; ``` ```sql select * from information_schema.task_runs where task_name ='mv-1972475'; ``` ```sql show materialized views like '__mv'; ``` ```sql ANALYZE FULL TABLE __mv; ``` ## 1.Execute Explain Costs on

- **Issue #39503** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query60 case#1**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0003, ca_gmt_offset, d_year, d_moy, i_item_id) DISTRIBUTED BY HASH (ca_gmt_offset, d_year, d_moy, i_item_id) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0000.cs_ext_sales_price)) AS _ca0003   ,_ta0000.ca_gmt_offset   ,_ta0000.d_year   ,_ta0000.d_moy   ,_ta0000.i_item_id FROM   (     SELECT       catalog_sales.cs_ext_sales_price       ,date_dim.d_year       ,customer_address.ca_gmt_offset       ,date_dim.d_moy       ,item.i_item_id     FROM       catalog_sales       INNER JOIN       date_dim       ON (catalog_sales.cs_sold_date_sk = date_dim.d_date_sk)       INNER JOIN       customer_address       ON (catalog_sales.cs_bill_addr_sk = customer_address.ca_address_sk)       INNER JOIN       item       ON (catalog_sales.cs_item_sk = item.i_item_sk)   ) _ta0000 GROUP BY   _ta0000.ca_gmt_offset   , _ta0000.d_year   , _ta0000.d_moy   , _ta0000.i_item_id; ``` ```sql REFRESH MATERIALIZED VIEW __mv WITH SYNC MODE; ``` ```sql show materialized views like '__mv'; ``` ```sql select * from information_schema.task_runs where task_name ='mv-1971700'; ``` ```sql show materialized views like '__mv'; ``` ```sql ANALYZE FULL TABLE __mv; ``` ## 1.Exec

- **Issue #39502** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query04 case#5**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0005, d_year, c_customer_id, c_first_name, c_last_name, c_preferred_cust_flag, c_birth_country, c_login, c_email_address) DISTRIBUTED BY HASH (d_year, c_customer_id, c_first_name, c_last_name, c_preferred_cust_flag, c_birth_country, c_login, c_email_address) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0001._ca0002)) AS _ca0005   ,_ta0001.d_year   ,_ta0001.c_customer_id   ,_ta0001.c_first_name   ,_ta0001.c_last_name   ,_ta0001.c_preferred_cust_flag   ,_ta0001.c_birth_country   ,_ta0001.c_login   ,_ta0001.c_email_address FROM   (     SELECT       customer.c_email_address       ,(((((web_sales.ws_ext_list_price - web_sales.ws_ext_wholesale_cost) - web_sales.ws_ext_discount_amt) + web_sales.ws_ext_sales_price) / 2)) AS _ca0002       ,customer.c_customer_id       ,customer.c_first_name       ,customer.c_last_name       ,date_dim.d_year       ,customer.c_preferred_cust_flag       ,customer.c_birth_country       ,customer.c_login     FROM       customer       INNER JOIN       web_sales       ON (customer.c_customer_sk = web_sales.ws_bill_customer_sk)       INNER JOIN       date_dim       ON (web_sales.ws_sold_date_sk = date_dim.d_date_

- **Issue #39501** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query11 case#1**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0005, d_year, c_customer_id, c_first_name, c_last_name, c_preferred_cust_flag, c_birth_country, c_login, c_email_address) DISTRIBUTED BY HASH (d_year, c_customer_id, c_first_name, c_last_name, c_preferred_cust_flag, c_birth_country, c_login, c_email_address) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0001._ca0002)) AS _ca0005   ,_ta0001.d_year   ,_ta0001.c_customer_id   ,_ta0001.c_first_name   ,_ta0001.c_last_name   ,_ta0001.c_preferred_cust_flag   ,_ta0001.c_birth_country   ,_ta0001.c_login   ,_ta0001.c_email_address FROM   (     SELECT       customer.c_email_address       ,((web_sales.ws_ext_list_price - web_sales.ws_ext_discount_amt)) AS _ca0002       ,customer.c_customer_id       ,customer.c_first_name       ,customer.c_last_name       ,date_dim.d_year       ,customer.c_preferred_cust_flag       ,customer.c_birth_country       ,customer.c_login     FROM       customer       INNER JOIN       web_sales       ON (customer.c_customer_sk = web_sales.ws_bill_customer_sk)       INNER JOIN       date_dim       ON (web_sales.ws_sold_date_sk = date_dim.d_date_sk)   ) _ta0001 GROUP BY   _ta0001.d_year   , _ta0001.c_customer_id   , _ta

- **Issue #39500** (2024-01-18): **[BUG] (MV_REWRITE_FAIL) TPCDS-query80 case#0**
  *Symptoms*: # Version 	main(c898f4735c443735075c46c6c6312fca3adb3af6) # Bug Reproduce Steps ## 0.Prepare MV(create/refresh/analyze) ```sql DROP MATERIALIZED VIEW IF EXISTS __mv; ``` ```sql CREATE MATERIALIZED VIEW __mv (_ca0006, _ca0007, _ca0008, p_channel_tv, i_current_price, d_date, s_store_id) DISTRIBUTED BY HASH (p_channel_tv, i_current_price, d_date, s_store_id) REFRESH ASYNC START("2023-12-01 10:00:00") EVERY(INTERVAL 1 DAY) PROPERTIES (   "replicated_storage" = "true",   "replication_num" = "1",   "storage_medium" = "HDD" ) AS SELECT   (sum(_ta0001._ca0003)) AS _ca0006   ,(sum(_ta0001.ss_ext_sales_price)) AS _ca0007   ,(sum(_ta0001._ca0002)) AS _ca0008   ,_ta0001.p_channel_tv   ,_ta0001.i_current_price   ,_ta0001.d_date   ,_ta0001.s_store_id FROM   (     SELECT       promotion.p_channel_tv       ,store.s_store_id       ,item.i_current_price       ,date_dim.d_date       ,(coalesce(store_returns.sr_return_amt, 0.00)) AS _ca0002       ,((store_sales.ss_net_profit - coalesce(store_returns.sr_net_loss, 0.00))) AS _ca0003       ,store_sales.ss_ext_sales_price     FROM       store_sales       LEFT OUTER JOIN       store_returns       ON (store_sales.ss_item_sk = store_returns.sr_item_sk)          AND (store_sales.ss_ticket_number = store_returns.sr_ticket_number)       INNER JOIN       date_dim       ON (store_sales.ss_sold_date_sk = date_dim.d_date_sk)       INNER JOIN       store       ON (store_sales.ss_store_sk = store.s_store_sk)       INNER JOIN       item       ON (store_sales.ss_

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

### Incident Patch 1: `1a6d1d07` (2026-09-30)
**Commit Message**: [BugFix] Preserve native GEOMETRY containment after coordinate translation (#79944)

Signed-off-by: Viktor Gnidenko <gvv.86@mail.ru>

**File**: `be/test/exprs/geography_functions_test.cpp` (modified, +53/-0)
```diff
@@ -1060,6 +1060,59 @@ TEST_F(geographyFunctionsTest, nativeGeoContainmentPredicates) {
     EXPECT_TRUE(boundary_covers.value(0));
 }
 
+TEST_F(geographyFunctionsTest, nativeGeometryContainmentIsTranslationInvariant) {
+    constexpr const char* polygon = "POLYGON ((0 0, 1 1, 0 1, 0 0))";
+    constexpr const char* translated_polygon =
+            "POLYGON ((10000000 10000000, 10000001 10000001, 10000000 10000001, 10000000 10000000))";
+    auto polygons = geometry({polygon, polygon, polygon, translated_polygon, translated_polygon, translated_polygon});
+    // Interior, exterior, and boundary points, before and after the same EPSG:3857 translation.
+    auto points = geometry({"POINT (0.4 0.5)", "POINT (0.5 0.4)", "POINT (0.5 0.5)", "POINT (10000000.4 10000000.5)",
+                            "POINT (10000000.5 10000000.4)", "POINT (10000000.5 10000000.5)"});
+
+    ColumnViewer<TYPE_BOOLEAN> contains(GeoFunctions::st_geometry_contains(nullptr, {polygons, points}).value());
+    ColumnViewer<TYPE_BOOLEAN> within(GeoFunctions::st_geometry_within(nullptr, {points, polygons}).value());
+    ColumnViewer<TYPE_BOOLEAN> covers(GeoFunctions::st_geometry_covers(nullptr, {polygons, points}).value());
+    ColumnViewer<TYPE_BOOLEAN> covered_by(GeoFunctions::st_geometry_covered_by(nullptr, {points, polygons}).value());
+    const bool strict_expected[] = {true, false, false, true, false, false};
+    const bool inclusive_expected[] = {true, false, true, true, false, true};
+    for (size_t row = 0; row < std::size(strict_expected); ++row) {
+        EXPECT_EQ(strict_expected[row], contains.value(row)) << row;
+        EXPECT_EQ(strict_expected[row], within.value(row)) << row;
+        EXPECT_EQ(inclusive_expected[row], covers.value(row)) << row;
+        EXPECT_EQ(inclusive_expected[row], covered_by.value(row)) << row;
+    }
+}
+
+TEST_F(geographyFunctionsTest, nativeGeometryContainmentPreparedTranslationInvariant) {
+    const auto type = geometry_type();
+    auto polygon = ConstColumn::create(
+            geometry({"POLYGON ((10000000 10000000, 10000001 10000001, 10000000 10000001, 10000000 10000000))"}), 3);
+    auto points = geometry(
+            {"POINT (10000000.4 10000000.5)", "POINT (10000000.5 10000000.4)", "POINT (10000000.5 10000000.5)"});
+    const bool strict_expected[] = {true, false, false};
+    const bool inclusive_expected[] = {true, false, true};
+    for (bool polygon_first : {true, false}) {
+        std::unique_ptr<FunctionContext> context(
+                FunctionContext::create_test_context({type, type}, TypeDescriptor(TYPE_BOOLEAN)));
+        context->set_constant_columns(polygon_first ? Columns{polygon, nullptr} : Columns{nullptr, polygon});
+        ASSERT_TRUE(GeoFunctions::native_geo_containment_prepare(context.get(), FunctionContext::FRAGMENT_LOCAL).ok());
+        auto strict_result = polygon_first ? GeoFunctions::st_geometry_contains(context.get(), {polygon, points})
+                                           : GeoFunctions::st_geometry_within(context.get(), {points, polygon});
+        auto inclusive_result = polygon_first ? GeoFunctions::st_geometry_covers(context.get(), {polygon, points})
+                                              : GeoFunctions::st_geometry_covered_by(context.get(), {points, polygon});
+        ASSERT_TRUE(strict_result.ok()) << strict_result.status();
+        ASSERT_TRUE(inclusive_result.ok()) << inclusive_result.status();
+        ColumnViewer<TYPE_BOOLEAN> strict(*strict_result);
+        ColumnViewer<TYPE_BOOLEAN> inclusive(*inclusive_result);
+        for (size_t row = 0; row < std::size(strict_expected); ++row) {
+            EXPECT_EQ(strict_expected[row], strict.value(row)) << "row=" << row << " polygon_first=" << polygon_first;
+            EXPECT_EQ(inclusive_expected[row], inclusive.value(row))
+                    << "row=" << row << " polygon_first=" << polygon_first;
+        }
+        ASSERT_TRUE(GeoFunctions::native_geo_containment_close(context.get()
```

---

### Incident Patch 2: `3c413318` (2026-09-30)
**Commit Message**: [BugFix] Run lookup_string internal query with the caller's identity (#79959)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/SimpleExecutor.java` (modified, +46/-2)
```diff
@@ -143,8 +143,8 @@ public List<TResultBatch> executeDQL(String sql) {
     /**
      * Same as {@link #executeDQL(String)} but bounds the internal query with an explicit
      * {@code query_timeout} (seconds) instead of the default {@code statistic_collect_query_timeout}.
-     * Used by serving-path internal queries (e.g. filling {@code information_schema.materialized_views}
-     * or {@code lookup_string}) so they never outlive the outer user query.
+     * Used by serving-path internal queries (e.g. filling {@code information_schema.materialized_views})
+     * so they never outlive the outer user query.
      */
     public List<TResultBatch> executeDQL(String sql, int queryTimeoutSeconds) {
         ConnectContext prev = ConnectContext.get();
@@ -161,6 +161,50 @@ public List<TResultBatch> executeDQL(String sql, int queryTimeoutSeconds) {
         }
     }
 
+    /**
+     * Same as {@link #executeDQL(String, int)} but runs the internal query with the identity of
+     * {@code caller} instead of ROOT, so the caller's table/column privileges and the row filter /
+     * column masking policies of an external access controller (e.g. Ranger) apply to it. Must be
+     * used by internal queries that read user data on behalf of a user (e.g. {@code lookup_string}),
+     * otherwise any user could read tables it has no privilege on.
+     */
+    public List<TResultBatch> executeDQLAsCaller(String sql, int queryTimeoutSeconds, ConnectContext caller) {
+        Preconditions.checkNotNull(caller, "caller context is required");
+        ConnectContext prev = ConnectContext.get();
+        try {
+            ConnectContext context = createConnectContext();
+            inheritIdentity(context, caller);
+            context.getSessionVariable().setQueryTimeoutS(queryTimeoutSeconds);
+            context.getSessionVariable().setInsertTimeoutS(queryTimeoutSeconds);
+            return executeDQL(sql, context);
+        } finally {
+            ConnectContext.remove();
+            if (prev != null) {
+                prev.setThreadLocalInfo();
+            }
+        }
+    }
+
+    /**
+     * Replace the ROOT identity set by {@link #createConnectContext()} with the caller's.
+     * Copies identity only: user, roles, groups, DN and remote IP. The remote IP matters
+     * because USER()/SESSION_USER() are folded from qualifiedUser plus remoteIP, and Ranger
+     * row-filter / masking expressions are analyzed in this context, so dropping it would make
+     * such policies see 'user'@% rather than the caller's actual host. The caller's
+     * {@code bypassAuthorizerCheck} is deliberately NOT copied: it is a transient control-flow
+     * flag that makes {@link StatementPlanner} skip {@code Authorizer.check}, so inheriting it
+     * would let a lookup triggered inside an existing bypass scope skip the SELECT / Ranger
+     * checks this method exists to enforce. The internal context keeps its default (false).
+     */
+    private static void inheritIdentity(ConnectContext context, ConnectContext caller) {
+        context.setQualifiedUser(caller.getQualifiedUser());
+        context.setCurrentUserIdentity(caller.getCurrentUserIdentity());
+        context.setCurrentRoleIds(caller.getCurrentRoleIds());
+        context.setGroups(caller.getGroups());
+        context.setDistinguishedName(caller.getDistinguishedName());
+        context.setRemoteIP(caller.getRemoteIP());
+    }
+
     /**
      * Remaining time budget (in seconds) derived from the outer (triggering) user query's
      * {@code query_timeout}: {@code query_timeout - elapsed}. Serving-path internal queries should be
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/function/MetaFunctions.java` (modified, +17/-3)
```diff
@@ -42,6 +42,7 @@
 import com.starrocks.common.Config;
 import com.starrocks.common.ErrorCode;
 import com.starrocks.common.ErrorReport;
+import com.starrocks.common.ErrorReportException;
 import com.starrocks.common.util.concurrent.lock.LockType;
 import com.starrocks.common.util.concurrent.lock.Locker;
 import com.starrocks.connector.ConnectorPartitionTraits;
@@ -808,9 +809,17 @@ private static ConstantOperator deserializeLookupResult(List<TResultBatch> batch
     public static ConstantOperator lookupString(ConstantOperator tableName,
                                                  ConstantOperator lookupKey,
                                                  ConstantOperator returnColumn) {
+        // Fetch and validate the caller before parsing the table name: TableName.fromString()
+        // dereferences ConnectContext.get() to resolve one- and two-part names, so a missing
+        // thread-local context must be rejected here rather than surfacing as a NullPointerException.
+        ConnectContext caller = ConnectContext.get();
+        if (caller == null) {
+            ErrorReport.reportSemanticException(ErrorCode.ERR_INVALID_PARAMETER,
+                    "lookup_string must be called within a user session");
+        }
         TableName tableNameValue = TableName.fromString(tableName.getVarchar());
         Optional<Table> maybeTable = GlobalStateMgr.getCurrentState().getMetadataMgr()
-                .getTable(new ConnectContext(), tableNameValue);
+                .getTable(caller, tableNameValue);
         maybeTable.orElseThrow(() -> ErrorReport.buildSemanticException(ErrorCode.ERR_BAD_TABLE_ERROR, tableNameValue));
         if (!(maybeTable.get() instanceof OlapTable)) {
             ErrorReport.reportSemanticException(ErrorCode.ERR_INVALID_PARAMETER, "must be OLAP_TABLE");
@@ -830,7 +839,10 @@ public static ConstantOperator lookupString(ConstantOperator tableName,
             // lookup_string is folded in the optimizer during the outer query's planning; bound the
             // internal point-lookup by the outer query's remaining query_timeout (not the 1h default).
             int remaining = SimpleExecutor.outerRemainingQueryTimeoutS();
-            List<TResultBatch> result = SimpleExecutor.getRepoExecutor().executeDQL(sql, Math.max(1, remaining));
+            // Run the lookup as the caller rather than ROOT, so the caller's privileges and access
+            // control policies apply to the table being read.
+            List<TResultBatch> result = SimpleExecutor.getRepoExecutor()
+                    .executeDQLAsCaller(sql, Math.max(1, remaining), caller);
             return deserializeLookupResult(result);
         } catch (Throwable e) {
             final String notFoundMessage = "query failed if record not exist in dict table";
@@ -840,7 +852,9 @@ public static ConstantOperator lookupString(ConstantOperator tableName,
                     root != null && root.getMessage().contains(notFoundMessage)) {
                 return ConstantOperator.NULL;
             }
-            if (root instanceof StarRocksPlannerException) {
+            // Surface planner errors and access denied from the caller's privilege check as is,
+            // instead of the generic "execute sql failed" wrapper.
+            if (root instanceof StarRocksPlannerException || root instanceof ErrorReportException) {
                 throw new SemanticException("lookup failed: " + root.getMessage(), root);
             } else {
                 throw new SemanticException("lookup failed: " + e.getMessage(), e);
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/optimizer/rewrite/MetaFunctionsTest.java` (modified, +98/-2)
```diff
@@ -21,6 +21,7 @@
 import com.starrocks.leader.ReportHandler;
 import com.starrocks.memory.MemoryUsageTracker;
 import com.starrocks.persist.gson.GsonUtils;
+import com.starrocks.qe.ConnectContext;
 import com.starrocks.qe.QueryDetail;
 import com.starrocks.qe.QueryDetailQueue;
 import com.starrocks.qe.SimpleExecutor;
@@ -204,7 +205,8 @@ public void testLookupString() throws Exception {
             // normal
             new MockUp<SimpleExecutor>() {
                 @Mock
-                public List<TResultBatch> executeDQL(String sql, int queryTimeoutSeconds) {
+                public List<TResultBatch> executeDQLAsCaller(String sql, int queryTimeoutSeconds,
+                                                              ConnectContext caller) {
                     MetaFunctions.LookupRecord record = new MetaFunctions.LookupRecord();
                     record.data = Lists.newArrayList("v1");
                     String json = GsonUtils.GSON.toJson(record);
@@ -220,14 +222,108 @@ public List<TResultBatch> executeDQL(String sql, int queryTimeoutSeconds) {
             // record not found
             new MockUp<SimpleExecutor>() {
                 @Mock
-                public List<TResultBatch> executeDQL(String sql, int queryTimeoutSeconds) {
+                public List<TResultBatch> executeDQLAsCaller(String sql, int queryTimeoutSeconds,
+                                                              ConnectContext caller) {
                     throw new RuntimeException("query failed if record not exist in dict table");
                 }
             };
             Assertions.assertNull(lookupString("t1", "v1", "c1"));
         }
     }
 
+    @Test
+    public void testLookupStringRunsAsCaller() throws Exception {
+        starRocksAssert.withTable("create table t_lookup_caller(c1 string, c2 string) primary key(c1) " +
+                "properties('replication_num'='1')");
+        UserIdentity currentUserIdentity = connectContext.getCurrentUserIdentity();
+        Set<Long> currentRoleIds = connectContext.getCurrentRoleIds();
+        Set<String> currentGroups = connectContext.getGroups();
+        String currentRemoteIP = connectContext.getRemoteIP();
+        UserIdentity[] innerUser = new UserIdentity[1];
+        Set<String>[] innerGroups = new Set[1];
+        String[] innerRemoteIP = new String[1];
+        new MockUp<SimpleExecutor>() {
+            @Mock
+            public List<TResultBatch> executeDQL(String sql, ConnectContext context) {
+                innerUser[0] = context.getCurrentUserIdentity();
+                innerGroups[0] = context.getGroups();
+                innerRemoteIP[0] = context.getRemoteIP();
+                return Lists.newArrayList();
+            }
+        };
+        Set<String> callerGroups = Set.of("g_ranger");
+        String callerRemoteIP = "10.1.2.3";
+        try {
+            connectContext.setCurrentUserIdentity(testUser);
+            connectContext.setCurrentRoleIds(testUser);
+            connectContext.setGroups(callerGroups);
+            connectContext.setRemoteIP(callerRemoteIP);
+            connectContext.setThreadLocalInfo();
+            Assertions.assertNull(lookupString("t_lookup_caller", "k", "c2"));
+            // The internal lookup query must run as the caller, never as ROOT
+            Assertions.assertEquals(testUser, innerUser[0]);
+            // Groups must be propagated: Ranger authorization and row/column policies read
+            // context.getGroups(), so dropping them would silently bypass group-based policies.
+            Assertions.assertEquals(callerGroups, innerGroups[0]);
+            // Remote IP must be propagated: USER()/SESSION_USER() are folded from qualifiedUser
+            // plus remoteIP, and Ranger row-filter/masking expressions are analyzed here.
+            Assertions.assertEquals(callerRemoteIP, innerRemoteIP[0]);
+            Assertions.assertSame(connectContext, ConnectContext.get());
+        } finally {
+      
```

**File**: `test/sql/test_lookup_string/R/test_lookup_string_privilege` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+-- name: test_lookup_string_privilege
+create database db_${uuid0};
+-- result:
+-- !result
+use db_${uuid0};
+-- result:
+-- !result
+create table t_dict(k string, v string) primary key(k) distributed by hash(k) buckets 1 properties('replication_num'='1');
+-- result:
+-- !result
+insert into t_dict values ('k1', 'v1'), ('k2', 'v2');
+-- result:
+-- !result
+select lookup_string('db_${uuid0}.t_dict', 'k1', 'v');
+-- result:
+v1
+-- !result
+create user if not exists u1_${uuid0};
+-- result:
+-- !result
+grant impersonate on user root to u1_${uuid0};
+-- result:
+-- !result
+create role if not exists r_${uuid0};
+-- result:
+-- !result
+grant select on table db_${uuid0}.t_dict to role r_${uuid0};
+-- result:
+-- !result
+create user if not exists u2_${uuid0};
+-- result:
+-- !result
+grant impersonate on user root to u2_${uuid0};
+-- result:
+-- !result
+grant r_${uuid0} to user u2_${uuid0};
+-- result:
+-- !result
+execute as u1_${uuid0} with no revert;
+-- result:
+-- !result
+function: assert_query_error_contains("select lookup_string('db_${uuid0}.t_dict', 'k1', 'v')", "Access denied", "SELECT privilege(s) on TABLE t_dict")
+-- result:
+None
+-- !result
+execute as root with no revert;
+-- result:
+-- !result
+grant select on table db_${uuid0}.t_dict to user u1_${uuid0};
+-- result:
+-- !result
+execute as u1_${uuid0} with no revert;
+-- result:
+-- !result
+select lookup_string('db_${uuid0}.t_dict', 'k1', 'v');
+-- result:
+v1
+-- !result
+execute as root with no revert;
+-- result:
+-- !result
+execute as u2_${uuid0} with no revert;
+-- result:
+-- !result
+function: assert_query_error_contains("select lookup_string('db_${uuid0}.t_dict', 'k2', 'v')", "Access denied", "SELECT privilege(s) on TABLE t_dict")
+-- result:
+None
+-- !result
+set role r_${uuid0};
+-- result:
+-- !result
+select lookup_string('db_${uuid0}.t_dict', 'k2', 'v');
+-- result:
+v2
+-- !result
+execute as root with no revert;
+-- result:
+-- !result
+drop user u1_${uuid0};
+-- result:
+-- !result
+drop user u2_${uuid0};
+-- result:
+-- !result
+drop role r_${uuid0};
+-- result:
+-- !result
+drop database db_${uuid0} force;
+-- result:
+-- !result
```

**File**: `test/sql/test_lookup_string/T/test_lookup_string_privilege` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+-- name: test_lookup_string_privilege
+create database db_${uuid0};
+use db_${uuid0};
+create table t_dict(k string, v string) primary key(k) distributed by hash(k) buckets 1 properties('replication_num'='1');
+insert into t_dict values ('k1', 'v1'), ('k2', 'v2');
+
+select lookup_string('db_${uuid0}.t_dict', 'k1', 'v');
+
+create user if not exists u1_${uuid0};
+grant impersonate on user root to u1_${uuid0};
+create role if not exists r_${uuid0};
+grant select on table db_${uuid0}.t_dict to role r_${uuid0};
+create user if not exists u2_${uuid0};
+grant impersonate on user root to u2_${uuid0};
+grant r_${uuid0} to user u2_${uuid0};
+
+-- no privilege on the table: the internal lookup query is authorized as the caller, not ROOT
+execute as u1_${uuid0} with no revert;
+function: assert_query_error_contains("select lookup_string('db_${uuid0}.t_dict', 'k1', 'v')", "Access denied", "SELECT privilege(s) on TABLE t_dict")
+execute as root with no revert;
+
+grant select on table db_${uuid0}.t_dict to user u1_${uuid0};
+execute as u1_${uuid0} with no revert;
+select lookup_string('db_${uuid0}.t_dict', 'k1', 'v');
+execute as root with no revert;
+
+-- privilege granted through a role takes effect only after the role is activated
+execute as u2_${uuid0} with no revert;
+function: assert_query_error_contains("select lookup_string('db_${uuid0}.t_dict', 'k2', 'v')", "Access denied", "SELECT privilege(s) on TABLE t_dict")
+set role r_${uuid0};
+select lookup_string('db_${uuid0}.t_dict', 'k2', 'v');
+execute as root with no revert;
+
+drop user u1_${uuid0};
+drop user u2_${uuid0};
+drop role r_${uuid0};
+drop database db_${uuid0} force;
```

---

### Incident Patch 3: `75ebe385` (2026-09-30)
**Commit Message**: [BugFix] Stop pruning generated-column partitions on a NOT IN over their source column (#79954)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rule/transformation/ListPartitionPruner.java` (modified, +9/-0)
```diff
@@ -466,6 +466,15 @@ public ScalarOperator visitBinaryPredicate(BinaryPredicateOperator operator, Voi
 
             @Override
             public ScalarOperator visitInPredicate(InPredicateOperator operator, Void context) {
+                // The deduced conjunct may only widen the rows it keeps: c1 IN (a, b) implies
+                // f(c1) IN (f(a), f(b)), but c1 NOT IN (a, b) does not imply f(c1) NOT IN (f(a), f(b))
+                // unless f is one-to-one. With f = date_trunc('day', c1), '2024-01-02 13:00' is not in
+                // ('2024-01-02 12:00'), yet its partition value is, and that partition would be pruned
+                // with the row still in it. NOT EQUAL is refused for the same reason in
+                // normalizeNonStrictMonotonic().
+                if (operator.isNotIn()) {
+                    return null;
+                }
                 ScalarOperator result = operator.clone();
                 result.setChild(0, generatedColumn);
                 for (int i = 1; i < operator.getChildren().size(); i++) {
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/PartitionPruneTest.java` (modified, +27/-0)
```diff
@@ -494,6 +494,33 @@ public void testGeneratedColumnPruneSkipsNonOrderPreservingCast() throws Excepti
                 .explainContains("partitions=1/3");
     }
 
+    @Test
+    public void testGeneratedColumnPruneSkipsNotIn() throws Exception {
+        // date_trunc() maps many source values onto one partition value, so NOT IN on the source column
+        // says nothing about the partition value: '2024-01-02 13:00:00' is not in the list below, yet
+        // its partition value '2024-01-02' is the image of a listed value. Deducing c2 NOT IN (...)
+        // pruned p0102 and p0103 with matching rows still in them. A single-value NOT IN is rewritten
+        // to NOT EQUAL, which was never deduced, so it takes two values to reach the IN branch.
+        starRocksAssert.withTable("CREATE TABLE t_gen_not_in (" +
+                " c1 datetime NOT NULL," +
+                " c2 datetime NULL AS date_trunc('day', c1) " +
+                " ) " +
+                " DUPLICATE KEY(c1) " +
+                " PARTITION BY (c2) " +
+                " PROPERTIES('replication_num'='1')");
+        starRocksAssert.ddl("ALTER TABLE t_gen_not_in ADD PARTITION p0101 VALUES IN ('2024-01-01 00:00:00')");
+        starRocksAssert.ddl("ALTER TABLE t_gen_not_in ADD PARTITION p0102 VALUES IN ('2024-01-02 00:00:00')");
+        starRocksAssert.ddl("ALTER TABLE t_gen_not_in ADD PARTITION p0103 VALUES IN ('2024-01-03 00:00:00')");
+
+        starRocksAssert.query("select * from t_gen_not_in " +
+                        "where c1 not in ('2024-01-02 12:00:00', '2024-01-03 12:00:00')")
+                .explainContains("partitions=3/3");
+        // IN still maps through the function and prunes
+        starRocksAssert.query("select * from t_gen_not_in " +
+                        "where c1 in ('2024-01-02 12:00:00', '2024-01-03 12:00:00')")
+                .explainContains("partitions=2/3");
+    }
+
     @Test
     public void testGeneratedColumnPruneSkipsCaseWhen() throws Exception {
         // A guard, not a regression test: nothing here is known to be broken today.
```

**File**: `test/sql/test_list_partition/R/test_list_partition_gencol_not_in_prune` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+-- name: test_list_partition_gencol_not_in_prune
+create database test_db_${uuid0};
+-- result:
+-- !result
+use test_db_${uuid0};
+-- result:
+-- !result
+CREATE TABLE t_multi (c1 datetime NOT NULL, v int NOT NULL)
+DUPLICATE KEY(c1)
+PARTITION BY v, date_trunc('day', c1)
+DISTRIBUTED BY HASH(c1) BUCKETS 1
+PROPERTIES ("replication_num" = "1");
+-- result:
+-- !result
+insert into t_multi values ('2024-01-01 10:00:00', 1), ('2024-01-02 13:00:00', 1), ('2024-01-03 09:00:00', 1);
+-- result:
+-- !result
+select c1 from t_multi where c1 not in ('2024-01-02 12:00:00', '2024-01-03 12:00:00') order by c1;
+-- result:
+2024-01-01 10:00:00
+2024-01-02 13:00:00
+2024-01-03 09:00:00
+-- !result
+select c1 from t_multi where c1 in ('2024-01-02 13:00:00', '2024-01-03 12:00:00') order by c1;
+-- result:
+2024-01-02 13:00:00
+-- !result
+CREATE TABLE t_gen (c1 datetime NOT NULL, c2 datetime NULL AS date_trunc('day', c1))
+DUPLICATE KEY(c1)
+PARTITION BY (c2)
+DISTRIBUTED BY HASH(c1) BUCKETS 1
+PROPERTIES ("replication_num" = "1");
+-- result:
+-- !result
+insert into t_gen (c1) values ('2024-01-01 10:00:00'), ('2024-01-02 13:00:00'), ('2024-01-03 09:00:00');
+-- result:
+-- !result
+select c1 from t_gen where c1 not in ('2024-01-02 12:00:00', '2024-01-03 12:00:00') order by c1;
+-- result:
+2024-01-01 10:00:00
+2024-01-02 13:00:00
+2024-01-03 09:00:00
+-- !result
+select c1 from t_gen where c1 in ('2024-01-02 13:00:00', '2024-01-03 12:00:00') order by c1;
+-- result:
+2024-01-02 13:00:00
+-- !result
+drop database test_db_${uuid0} force;
+-- result:
+-- !result
\ No newline at end of file
```

**File**: `test/sql/test_list_partition/T/test_list_partition_gencol_not_in_prune` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+-- name: test_list_partition_gencol_not_in_prune
+create database test_db_${uuid0};
+use test_db_${uuid0};
+
+-- The partition value is date_trunc('day', c1), which maps many values of c1 onto one partition.
+-- c1 NOT IN (...) says nothing about the partition value, so it must not prune.
+CREATE TABLE t_multi (c1 datetime NOT NULL, v int NOT NULL)
+DUPLICATE KEY(c1)
+PARTITION BY v, date_trunc('day', c1)
+DISTRIBUTED BY HASH(c1) BUCKETS 1
+PROPERTIES ("replication_num" = "1");
+insert into t_multi values ('2024-01-01 10:00:00', 1), ('2024-01-02 13:00:00', 1), ('2024-01-03 09:00:00', 1);
+
+select c1 from t_multi where c1 not in ('2024-01-02 12:00:00', '2024-01-03 12:00:00') order by c1;
+select c1 from t_multi where c1 in ('2024-01-02 13:00:00', '2024-01-03 12:00:00') order by c1;
+
+CREATE TABLE t_gen (c1 datetime NOT NULL, c2 datetime NULL AS date_trunc('day', c1))
+DUPLICATE KEY(c1)
+PARTITION BY (c2)
+DISTRIBUTED BY HASH(c1) BUCKETS 1
+PROPERTIES ("replication_num" = "1");
+insert into t_gen (c1) values ('2024-01-01 10:00:00'), ('2024-01-02 13:00:00'), ('2024-01-03 09:00:00');
+
+select c1 from t_gen where c1 not in ('2024-01-02 12:00:00', '2024-01-03 12:00:00') order by c1;
+select c1 from t_gen where c1 in ('2024-01-02 13:00:00', '2024-01-03 12:00:00') order by c1;
+
+drop database test_db_${uuid0} force;
```

---

### Incident Patch 4: `a898ad39` (2026-09-30)
**Commit Message**: [BugFix] Allocate the stream load body buffer in on_chunk_data (#79712)

Signed-off-by: Eason <1569163626@qq.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `be/src/http/action/stream_load.cpp` (modified, +17/-11)
```diff
@@ -227,6 +227,10 @@ Status StreamLoadAction::_handle_batch_write(starrocks::HttpRequest* http_req, S
     }
     ctx->mc_read_data_cost_nanos = MonotonicNanos() - ctx->start_nanos;
     ctx->load_parameters = get_load_parameters_from_http(http_req);
+    if (ctx->buffer == nullptr) {
+        // no data is received, e.g. the body is empty
+        ASSIGN_OR_RETURN(ctx->buffer, ByteBuffer::allocate_with_tracker(0));
+    }
     ctx->buffer->flip_to_read();
     return _batch_write_mgr->append_data(ctx);
 }
@@ -348,13 +352,6 @@ Status StreamLoadAction::_on_header(HttpRequest* http_req, StreamLoadContext* ct
                    << " ]. Set ignore_json_size to skip the check, although it may lead huge memory consuming.";
                 return Status::InternalError(ss.str());
             }
-            // Allocate buffer in advance, since the json payload cannot be parsed in stream mode.
-            // For efficiency reasons, simdjson requires a string with a few bytes (simdjson::SIMDJSON_PADDING) at the end.
-            ASSIGN_OR_RETURN(ctx->buffer,
-                             ByteBuffer::allocate_with_tracker(ctx->body_bytes, simdjson::SIMDJSON_PADDING));
-        } else if (ctx->enable_batch_write) {
-            // batch write does not support parsing data in stream mode
-            ASSIGN_OR_RETURN(ctx->buffer, ByteBuffer::allocate_with_tracker(ctx->body_bytes));
         }
     } else {
 #ifndef BE_TEST
@@ -410,10 +407,19 @@ void StreamLoadAction::on_chunk_data(HttpRequest* req) {
     while ((len = evbuffer_get_length(evbuf)) > 0) {
         if (ctx->buffer == nullptr) {
             // Initialize buffer.
-            ASSIGN_OR_SET_STATUS_AND_RETURN_IF_ERROR(
-                    ctx->status, ctx->buffer,
-                    ByteBuffer::allocate_with_tracker(processInBatchMode ? std::max(len, ctx->kDefaultBufferSize)
-                                                                         : len));
+            if (processInBatchMode && ctx->body_bytes > 0) {
+                // For json format or batch write, the data cannot be parsed in stream mode, so allocate the whole
+                // body at once. For efficiency reasons, simdjson requires a string with a few bytes
+                // (simdjson::SIMDJSON_PADDING) at the end.
+                size_t padding = ctx->format == TFileFormatType::FORMAT_JSON ? simdjson::SIMDJSON_PADDING : 0;
+                ASSIGN_OR_SET_STATUS_AND_RETURN_IF_ERROR(ctx->status, ctx->buffer,
+                                                         ByteBuffer::allocate_with_tracker(ctx->body_bytes, padding));
+            } else {
+                ASSIGN_OR_SET_STATUS_AND_RETURN_IF_ERROR(
+                        ctx->status, ctx->buffer,
+                        ByteBuffer::allocate_with_tracker(processInBatchMode ? std::max(len, ctx->kDefaultBufferSize)
+                                                                             : len));
+            }
         } else if (ctx->buffer->remaining() < len) {
             if (processInBatchMode) {
                 // For json format or batch write, we need build a complete data before we push the buffer to the pipe.
```

**File**: `be/test/http/stream_load_test.cpp` (modified, +161/-8)
```diff
@@ -71,6 +71,8 @@
 #include "platform/http/http_channel.h"
 #include "platform/http/http_request.h"
 #include "platform/platform_env.h"
+#include "runtime/byte_buffer.h"
+#include "runtime/mem_tracker.h"
 #include "runtime/runtime_env.h"
 #include "simdjson.h"
 
@@ -510,13 +512,15 @@ TEST_F(StreamLoadActionTest, batch_write_csv) {
     ASSERT_NE(nullptr, ctx);
     ASSERT_TRUE(ctx->status.ok());
     ASSERT_TRUE(ctx->enable_batch_write);
-    ASSERT_NE(nullptr, ctx->buffer);
-    ASSERT_EQ(content.length(), ctx->buffer->limit);
+    ASSERT_EQ(nullptr, ctx->buffer);
 
     evbuffer_add(evb, content.data(), content.size());
     ctx->status = Status::OK();
     action.on_chunk_data(&request);
     ASSERT_TRUE(ctx->status.ok());
+    ASSERT_NE(nullptr, ctx->buffer);
+    ASSERT_EQ(content.length(), ctx->buffer->limit);
+    ASSERT_EQ(0, ctx->buffer->padding);
     ASSERT_EQ(content.length(), ctx->buffer->pos);
 
     SyncPoint::GetInstance()->SetCallBack("BatchWriteMgr::append_data::cb",
@@ -569,14 +573,15 @@ TEST_F(StreamLoadActionTest, batch_write_json) {
     ASSERT_NE(nullptr, ctx);
     ASSERT_TRUE(ctx->status.ok());
     ASSERT_TRUE(ctx->enable_batch_write);
-    ASSERT_NE(nullptr, ctx->buffer);
-    ASSERT_EQ(content.length(), ctx->buffer->limit);
-    ASSERT_EQ(simdjson::SIMDJSON_PADDING, ctx->buffer->padding);
+    ASSERT_EQ(nullptr, ctx->buffer);
 
     evbuffer_add(evb, content.data(), content.size());
     ctx->status = Status::OK();
     action.on_chunk_data(&request);
     ASSERT_TRUE(ctx->status.ok());
+    ASSERT_NE(nullptr, ctx->buffer);
+    ASSERT_EQ(content.length(), ctx->buffer->limit);
+    ASSERT_EQ(simdjson::SIMDJSON_PADDING, ctx->buffer->padding);
     ASSERT_EQ(content.length(), ctx->buffer->pos);
 
     SyncPoint::GetInstance()->SetCallBack("BatchWriteMgr::append_data::cb",
@@ -597,11 +602,50 @@ TEST_F(StreamLoadActionTest, batch_write_json) {
     ASSERT_STREQ("Success", doc["Status"].GetString());
 }
 
-TEST_F(StreamLoadActionTest, json_buffer_allocated_on_header) {
+TEST_F(StreamLoadActionTest, batch_write_empty_body) {
+    SyncPoint::GetInstance()->EnableProcessing();
+    DeferOp defer([]() {
+        SyncPoint::GetInstance()->ClearCallBack("BatchWriteMgr::append_data::success");
+        SyncPoint::GetInstance()->DisableProcessing();
+    });
+
     StreamLoadAction action(&_env, &_stream_load_orchestrator, _stream_load_executor.get(), _limiter.get(),
                             _batch_write_mgr.get());
     HttpRequest request(_evhttp_req);
 
+    request._headers.emplace(HttpHeaders::AUTHORIZATION, "Basic cm9vdDo=");
+    request._params.emplace(HTTP_DB_KEY, "db");
+    request._params.emplace(HTTP_TABLE_KEY, "tbl");
+    request._headers.emplace(HTTP_LABEL_KEY, "batch_write_empty_body");
+    request._headers.emplace(HTTP_ENABLE_MERGE_COMMIT, "true");
+    request._headers.emplace(HTTP_FORMAT_KEY, "json");
+    request._headers.emplace(HttpHeaders::CONTENT_LENGTH, "0");
+    request.set_handler(&action);
+
+    ASSERT_EQ(0, action.on_header(&request));
+    StreamLoadContext* ctx = static_cast<StreamLoadContext*>(request._handler_ctx);
+    ASSERT_NE(nullptr, ctx);
+    ASSERT_TRUE(ctx->enable_batch_write);
+    ASSERT_EQ(nullptr, ctx->buffer);
+
+    SyncPoint::GetInstance()->SetCallBack("BatchWriteMgr::append_data::success",
+                                          [](void* arg) { *(Status*)arg = Status::OK(); });
+    action.handle(&request);
+    ASSERT_TRUE(ctx->status.ok());
+    ASSERT_NE(nullptr, ctx->buffer);
+    ASSERT_EQ(0, ctx->buffer->limit);
+
+    rapidjson::Document doc;
+    doc.Parse(k_response_str.c_str());
+    ASSERT_STREQ("Success", doc["Status"].GetString());
+}
+
+TEST_F(StreamLoadActionTest, json_buffer_allocated_on_chunk_data) {
+    StreamLoadAction action(&_env, &_stream_load_orchestrator, _stream_load_executor.get(), _limiter.get(),
+                            _batch_write_mgr.get());
+    auto load_mem_tracker = std::make_shared<MemTracker>(-1, "json_buffer_a
```

---

### Incident Patch 5: `c6ca06ae` (2026-09-30)
**Commit Message**: [BugFix] Re-plan a query whose range-colocate bucket assignment went stale (#79927)

Co-authored-by: xiangguangyxg <110401425+xiangguangyxg@users.noreply.github.com>
Co-authored-by: xiangguangyxg <xiangguangyxg@gmail.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `fe/fe-core/src/main/java/com/starrocks/planner/RangeColocateScanDispatch.java` (modified, +5/-4)
```diff
@@ -120,8 +120,9 @@ public int bucketCount() {
     /**
      * Fails closed unless every {@link MaterializedIndex} actually scanned in the supplied physical
      * partitions is aligned with the colocate group AND {@code builtBucketSeq} — the bucket assignment
-     * the scan actually built — contains the current aligned mapping. Throws {@link IllegalStateException}
-     * on the first index that is unaligned, or whose built assignment does not match.
+     * the scan actually built — contains the current aligned mapping. Throws
+     * {@link RangeColocateUnalignedException} on the first index that is unaligned, or whose built
+     * assignment does not match.
      *
      * <p>The containment check closes a fill→dispatch TOCTOU without any sticky per-scan state: the bucketSeq
      * fill falls back to a position-based assignment when the group is momentarily unaligned (so a
@@ -142,7 +143,7 @@ public void requireAligned(Iterable<PhysicalPartition> physicalPartitions, long
             MaterializedIndex selectedIndex = physicalPartition.getQueryableIndex(indexMetaId);
             Map<Long, Integer> aligned = computeBucketSeq(selectedIndex);
             if (aligned == null) {
-                throw new IllegalStateException(String.format(
+                throw new RangeColocateUnalignedException(String.format(
                         "range colocate group %d is in an unaligned state in physical partition %d; "
                                 + "cannot dispatch colocate join until alignment is restored",
                         colocateGroupId, physicalPartition.getId()));
@@ -153,7 +154,7 @@ public void requireAligned(Iterable<PhysicalPartition> physicalPartitions, long
             // rather than the two maps being equal. A stale/position assignment fails a value comparison; a
             // reshard that replaced tablets fails because the new tablet ids are absent from builtBucketSeq.
             if (!builtBucketSeq.entrySet().containsAll(aligned.entrySet())) {
-                throw new IllegalStateException(String.format(
+                throw new RangeColocateUnalignedException(String.format(
                         "range colocate group %d has a stale bucket assignment in physical partition %d "
                                 + "(the scan's built bucketSeq does not match the aligned mapping); cannot "
                                 + "dispatch colocate join until the assignment is rebuilt",
```

**File**: `fe/fe-core/src/main/java/com/starrocks/planner/RangeColocateUnalignedException.java` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+// Copyright 2021-present StarRocks, Inc. All rights reserved.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package com.starrocks.planner;
+
+/**
+ * Raised at scheduling time when a range-colocate scan's tablet-to-bucket assignment, built while planning, no longer
+ * matches the colocate group's current layout: a tablet split or merge published between planning and scheduling, or
+ * the group is mid-realignment. Planning the statement again yields a plan that either uses the current tablets or
+ * falls back to a shuffle; when the initial scheduling pass raises it, nothing has been deployed yet, so the query
+ * retry loop re-plans instead of failing (see DefaultCoordinator#startScheduling and ExecuteExceptionHandler). If
+ * the layout is still unaligned when the statement is re-planned, the retries fail with the same error.
+ */
+public class RangeColocateUnalignedException extends IllegalStateException {
+    public RangeColocateUnalignedException(String message) {
+        super(message);
+    }
+}
```

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/DefaultCoordinator.java` (modified, +18/-4)
```diff
@@ -70,6 +70,7 @@
 import com.starrocks.planner.OlapTableSink;
 import com.starrocks.planner.PlanFragment;
 import com.starrocks.planner.PlanFragmentId;
+import com.starrocks.planner.RangeColocateUnalignedException;
 import com.starrocks.planner.ResultSink;
 import com.starrocks.planner.RuntimeFilterDescription;
 import com.starrocks.planner.ScanNode;
@@ -627,13 +628,26 @@ public void startScheduling(ScheduleOption option) throws StarRocksException, In
 
         try (Timer timer = Tracers.watchScope(Tracers.Module.SCHEDULER, "Prepare")) {
             prepareExec();
+        } catch (RangeColocateUnalignedException e) {
+            // Nothing is deployed yet. Give the query-queue slot back now rather than after the statement is re-planned
+            // (the retry loop releases it again when it unregisters this coordinator, which is harmless), and close any
+            // external scan sources this attempt opened: the retry loop does not clear them.
+            onReleaseSlots();
+            clearExternalResources();
+            throw e;
         }
 
-        try (Timer timer = Tracers.watchScope(Tracers.Module.SCHEDULER, "Deploy")) {
-            deliverExecFragments(option);
-        }
+        try {
+            try (Timer timer = Tracers.watchScope(Tracers.Module.SCHEDULER, "Deploy")) {
+                deliverExecFragments(option);
+            }
 
-        scheduler.continueSchedule(option);
+            scheduler.continueSchedule(option);
+        } catch (RangeColocateUnalignedException e) {
+            // Fragments may already be running here (phased scheduling assigns more scan ranges after deploying the
+            // first ones), so this attempt must not be re-planned: fail it as the plain scheduling error it was.
+            throw new IllegalStateException(e.getMessage(), e);
+        }
 
         // Prevent `explain scheduler` from waiting until the profile timeout.
         if (!option.doDeploy) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/ExecuteExceptionHandler.java` (modified, +18/-0)
```diff
@@ -36,6 +36,7 @@
 import com.starrocks.planner.HudiScanNode;
 import com.starrocks.planner.IcebergScanNode;
 import com.starrocks.planner.OlapScanNode;
+import com.starrocks.planner.RangeColocateUnalignedException;
 import com.starrocks.planner.ScanNode;
 import com.starrocks.planner.SlotId;
 import com.starrocks.rpc.RpcException;
@@ -80,6 +81,8 @@ public static void handle(Exception e, RetryContext context) throws Exception {
             handleGlobalDictNotMatchException((GlobalDictNotMatchException) e, context);
         } else if (e instanceof LakeMetaVersionNotFoundException) {
             handleLakeMetaVersionNotFound((LakeMetaVersionNotFoundException) e, context);
+        } else if (e instanceof RangeColocateUnalignedException) {
+            handleRangeColocateUnaligned((RangeColocateUnalignedException) e, context);
         } else {
             throw e;
         }
@@ -356,6 +359,21 @@ private static String describe(OptionalLong value) {
         return value.isPresent() ? String.valueOf(value.getAsLong()) : "unknown";
     }
 
+    /**
+     * A range-colocate scan's tablet-to-bucket assignment went stale between planning and scheduling (a tablet split
+     * or merge published in between). The attempt failed before anything was deployed; a new plan uses the current
+     * tablets, or a shuffle while the group is realigned. If the layout is still unaligned when the statement is
+     * re-planned, the retries fail with the same error.
+     */
+    private static void handleRangeColocateUnaligned(RangeColocateUnalignedException e, RetryContext context)
+            throws Exception {
+        rebuildExecPlan(e, context);
+        LOG.warn("Range colocate bucket assignment is stale, replanned. queryId={}, attempt={}, error={}",
+                DebugUtil.printId(context.connectContext.getExecutionId()), context.retryTime + 1, e.getMessage());
+        Tracers.record(Tracers.Module.SCHEDULER, "RangeColocate.REPLAN",
+                String.format("attempt=%d, error=%s", context.retryTime + 1, e.getMessage()));
+    }
+
     private static void handleRpcException(RpcException e, RetryContext context) throws Exception {
         ConnectContext connectContext = context.connectContext;
         // Log only on the first attempt to avoid duplicate entries during retries.
```

**File**: `fe/fe-core/src/test/java/com/starrocks/planner/RangeColocateScanRangeDispatchTest.java` (modified, +69/-0)
```diff
@@ -25,12 +25,18 @@
 import com.starrocks.common.Config;
 import com.starrocks.common.Range;
 import com.starrocks.qe.ConnectContext;
+import com.starrocks.qe.DefaultCoordinator;
+import com.starrocks.qe.scheduler.Deployer;
+import com.starrocks.qe.scheduler.slot.DeployState;
 import com.starrocks.server.GlobalStateMgr;
 import com.starrocks.server.RunMode;
 import com.starrocks.thrift.TScanRangeLocations;
 import com.starrocks.type.IntegerType;
 import com.starrocks.utframe.StarRocksAssert;
 import com.starrocks.utframe.UtFrameUtils;
+import mockit.Invocation;
+import mockit.Mock;
+import mockit.MockUp;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
@@ -40,6 +46,7 @@
 import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
+import java.util.concurrent.atomic.AtomicInteger;
 
 /**
  * End-to-end coordinator-side scan-range dispatch tests for range-distribution
@@ -260,6 +267,7 @@ public void testGetBucketNumsFailsClosedOnStaleAssignment() throws Exception {
         scanNode.setTabletId2BucketSeq(stale);
         IllegalStateException exception = Assertions.assertThrows(IllegalStateException.class,
                 scanNode::getBucketNums);
+        Assertions.assertInstanceOf(RangeColocateUnalignedException.class, exception);
         Assertions.assertTrue(exception.getMessage().contains("stale bucket assignment"),
                 "actual: " + exception.getMessage());
     }
@@ -298,7 +306,68 @@ public void testPlanFragmentBuilderUnalignedScanFailsClosed() throws Exception {
         // the colocate-dispatch path must fail closed rather than pairing by the position fallback.
         IllegalStateException exception = Assertions.assertThrows(IllegalStateException.class,
                 scan::getBucketNums);
+        Assertions.assertInstanceOf(RangeColocateUnalignedException.class, exception);
         Assertions.assertTrue(exception.getMessage().contains("unaligned state"),
                 "actual: " + exception.getMessage());
     }
+
+    @Test
+    public void testStaleAssignmentFailsSchedulingAndReleasesSlots() throws Exception {
+        // Two tables of one stable group whose ColocateRanges no longer match their single tablets: the colocate
+        // join is planned, then fails closed at scheduling, before anything is deployed.
+        starRocksAssert.withTable("create table t_stale_l (k1 int, k2 int, v1 int) order by(k1, k2) "
+                + "properties('replication_num' = '1', 'colocate_with' = 'rg_stale:k1');");
+        starRocksAssert.withTable("create table t_stale_r (k1 int, k2 int, v2 int) order by(k1, k2) "
+                + "properties('replication_num' = '1', 'colocate_with' = 'rg_stale:k1');");
+        OlapTable table = (OlapTable) GlobalStateMgr.getCurrentState().getLocalMetastore()
+                .getTable(db.getFullName(), "t_stale_l");
+        ColocateTableIndex colocateTableIndex = GlobalStateMgr.getCurrentState().getColocateTableIndex();
+        long grpId = colocateTableIndex.getGroup(table.getId()).grpId;
+        colocateTableIndex.getColocateRangeMgr().setColocateRanges(grpId, Arrays.asList(
+                new ColocateRange(Range.lt(makeTuple(100)), 9201L),
+                new ColocateRange(Range.gelt(makeTuple(100), makeTuple(200)), 9202L),
+                new ColocateRange(Range.ge(makeTuple(200)), 9203L)));
+
+        AtomicInteger releases = new AtomicInteger();
+        new MockUp<DefaultCoordinator>() {
+            @Mock
+            public void onReleaseSlots(Invocation invocation) {
+                releases.incrementAndGet();
+                invocation.proceed();
+            }
+        };
+
+        String sql = "select l.v1, r.v2 from t_stale_l l join t_stale_r r on l.k1 = r.k1";
+        RangeColocateUnalignedException exception = Assertions.assertThrows(RangeColocateUnalignedException.class,
+                () -> UtFrameUtils.getPlanAndStartScheduling(connectContext, sql));
+
```

---

### Incident Patch 6: `575772f1` (2026-09-30)
**Commit Message**: [BugFix] Stop registering JSON extended columns on the shared catalog table (#78611)

Signed-off-by: stephen <stephen.li@celerdata.com>
Signed-off-by: stephen <stephen5217@163.com>
Co-authored-by: stephen <91597003+stephen-shelby@users.noreply.github.com>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rule/tree/JsonPathRewriteRule.java` (modified, +19/-37)
```diff
@@ -208,23 +208,14 @@ public Pair<Boolean, ColumnRefOperator> getOrCreateColumn(ColumnRefOperator json
         }
 
         private Column createExtendedColumn(Table table, String path, ColumnAccessPath jsonPath) {
-            if (!table.containColumn(path)) {
-                Preconditions.checkState(table instanceof OlapTable, "Only support OlapTable");
-                // NOTE: The safety of adding a column dynamically is ensured by the fact that
-                // this rule is only applied during query planning, thus the Table here is already copied for the
-                // query. So this change would not affect the original table schema.
-                Column extendedColumn = new Column(path, jsonPath.getValueType(), true);
-
-                // Allocate the unique id for extended column
-                OlapTable olapTable = (OlapTable) table;
-                int nextUniqueId = olapTable.incAndGetMaxColUniqueId();
-                extendedColumn.setUniqueId(nextUniqueId);
-
-                table.addColumn(extendedColumn);
-                return extendedColumn;
-            } else {
-                return table.getColumn(path);
-            }
+            Preconditions.checkState(table instanceof OlapTable, "Only support OlapTable");
+            // The extended column is a per-query artifact: it only ever travels through the scan operator's
+            // colRefToColumnMetaMap and the ColumnAccessPath list, both of which are rebuilt for every scan.
+            // It must NOT be registered on the Table object. Doing so mutates the shared catalog instance for
+            // any statement whose source table is not copied (INSERT ... SELECT and MV refresh both reuse the
+            // live OlapTable), which leaks the column into InsertPlanner's sink schema and pins the path to
+            // whichever type happened to be resolved first.
+            return new Column(path, jsonPath.getValueType(), true);
         }
 
         public static ColumnAccessPath pathFromColumn(Column column) {
@@ -273,8 +264,7 @@ private OptExpression rewriteMetaScan(OptExpression optExpr, Void v) {
 
             // Skip the JSON-path pushdown when two subfields of the same JSON column collide
             // case-insensitively (e.g. 'Campaign' vs 'campaign'); see hasCaseCollidingJsonSubfields.
-            if (hasCaseCollidingJsonSubfields(new ArrayList<>(project.getColumnRefMap().values()), columnRefFactory,
-                    null)) {
+            if (hasCaseCollidingJsonSubfields(new ArrayList<>(project.getColumnRefMap().values()), columnRefFactory)) {
                 return optExpr;
             }
 
@@ -348,7 +338,7 @@ private OptExpression rewriteLogicalScan(OptExpression optExpr, Void v) {
             if (scanOperator.getProjection() != null) {
                 jsonRoots.addAll(scanOperator.getProjection().getColumnRefMap().values());
             }
-            if (hasCaseCollidingJsonSubfields(jsonRoots, columnRefFactory, scanOperator.getTable())) {
+            if (hasCaseCollidingJsonSubfields(jsonRoots, columnRefFactory)) {
                 return optExpr;
             }
 
@@ -427,20 +417,18 @@ private OptExpression rewriteLogicalScan(OptExpression optExpr, Void v) {
      *
      * <p>JSON object keys are case-sensitive, so these are two distinct fields with distinct values.
      * The pushdown, however, materializes each as an extended {@link Column} whose name is the
-     * subfield path; those names collide in {@code Table.nameToColumn} (a case-insensitive map) and
-     * in every downstream name-keyed lookup (global-dict, min/max statistics). The result is a scan
-     * chunk with mismatched column row counts (BE crash) or a wrong global-dict mapping ("Dict Decode
-     * failed"). When such a collision is present we skip the rewrite for that scan entirely and let
+     * subfield path; those names collide in every downstream name-keyed lookup (global-dict, min/max
+     * statistics). The result is a sca
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rule/tree/lowcardinality/DecodeCollector.java` (modified, +9/-1)
```diff
@@ -1236,7 +1236,15 @@ public DecodeInfo visitPhysicalOlapScan(OptExpression optExpression, DecodeInfo
             }
 
             // Condition 3: the varchar column has collected global dict
-            Column columnObj = table.getColumn(column.getName());
+            // Extended json subfield columns are per-query artifacts and are not part of the table schema,
+            // so resolve them through the scan's own map first -- the same source checkExtendedColumn() uses.
+            Column columnObj = scan.getColRefToColumnMetaMap().get(column);
+            if (columnObj == null) {
+                columnObj = table.getColumn(column.getName());
+            }
+            if (columnObj == null) {
+                continue;
+            }
             if (!IDictManager.getInstance().hasGlobalDict(table.getId(), columnObj.getColumnId(), version)) {
                 LOG.debug("{} doesn't have global dict", column.getName());
                 continue;
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/JsonPathRewriteTest.java` (modified, +130/-1)
```diff
@@ -14,7 +14,9 @@
 
 package com.starrocks.sql.plan;
 
+import com.starrocks.catalog.OlapTable;
 import com.starrocks.common.FeConstants;
+import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.params.ParameterizedTest;
@@ -455,5 +457,132 @@ public void testCaseCollidingJsonSubfieldsFallBack() throws Exception {
         }
     }
 
-}
+    /**
+     * The extended column synthesized for a JSON subfield is a per-query artifact: it only ever travels
+     * through the scan's colRefToColumnMetaMap and the ColumnAccessPath list. It must not be registered on
+     * the OlapTable, because statements whose source table is not copied (INSERT ... SELECT and MV refresh
+     * both reuse the live catalog instance) would then mutate the shared table -- that is POST-1773.
+     */
+    @Test
+    public void testExtendedColumnNotRegisteredOnTable() throws Exception {
+        connectContext.getSessionVariable().setEnableJSONV2Rewrite(true);
+        starRocksAssert.withTable(
+                "create table json_no_pollute (k int, j json) properties('replication_num'='1')");
+        try {
+            OlapTable table = (OlapTable) starRocksAssert.getTable("test", "json_no_pollute");
+            int schemaSizeBefore = table.getFullSchema().size();
+            int maxColUniqueIdBefore = table.getMaxColUniqueId();
+
+            // A plain SELECT plans against AnalyzerUtils.copyTable's copy, so it cannot show the leak.
+            // DML does not copy its source table -- that is the path that mutates the live catalog object.
+            String plan = getFragmentPlan(
+                    "insert into json_no_pollute select k, j from json_no_pollute "
+                            + "where get_json_int(j, '$.a') = 1");
+            // the rewrite did happen ...
+            assertContains(plan, "j.a");
+
+            // ... and yet the shared catalog object is untouched.
+            Assertions.assertEquals(schemaSizeBefore, table.getFullSchema().size(),
+                    "json path rewrite must not grow the shared table schema");
+            Assertions.assertNull(table.getColumn("j.a"),
+                    "extended column must not be resolvable through the table");
+            Assertions.assertEquals(maxColUniqueIdBefore, table.getMaxColUniqueId(),
+                    "json path rewrite must not consume column unique ids (maxColUniqueId is persisted)");
+
+            // Planning it again must not accumulate anything either.
+            getFragmentPlan("insert into json_no_pollute select k, j from json_no_pollute "
+                    + "where get_json_string(j, '$.b') = 'x'");
+            Assertions.assertEquals(schemaSizeBefore, table.getFullSchema().size(),
+                    "repeated planning must not accumulate extended columns");
+            Assertions.assertEquals(maxColUniqueIdBefore, table.getMaxColUniqueId(),
+                    "repeated planning must not consume column unique ids");
+        } finally {
+            starRocksAssert.dropTable("json_no_pollute");
+        }
+    }
+
+    /**
+     * POST-1773: `insert into t select ... from t where <json subfield predicate>` used to fail with
+     * "number of exprs is not same with slots". InsertPlanner takes outputFullSchema from
+     * targetTable.getFullSchema() (a live reference) before optimizing; the rewrite then grew that list
+     * mid-flight, so the sink tuple got one more slot than there were output exprs. On the second attempt
+     * the counts matched again -- at the cost of shipping a phantom always-NULL column on every load.
+     */
+    @Test
+    public void testSelfReferencingInsertHasNoPhantomColumn() throws Exception {
+        connectContext.getSessionVariable().setEnableJSONV2Rewrite(true);
+        starRocksAssert.withTable(
+                "create table json_self_insert (k int, j json) properties('replication_num'='1')");
+        try {
+     
```

**File**: `test/sql/test_json/R/test_json_subfield_cross_scan_type_hijack` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+-- name: test_json_subfield_cross_scan_type_hijack
+create table t (k int, j json) duplicate key(k)
+  distributed by hash(k) buckets 1 properties("replication_num"="1");
+-- result:
+-- !result
+insert into t values
+  (1, parse_json('{"v":3.75,"c":"str1"}')),
+  (2, parse_json('{"v":9.25,"c":5}')),
+  (3, parse_json('{"v":1.5,"c":"str3"}'));
+-- result:
+-- !result
+set cbo_json_v2_rewrite = true;
+-- result:
+-- !result
+select a.k, get_json_int(a.j, '$.v') as ai, get_json_double(b.j, '$.v') as bd
+  from t a join t b on a.k = b.k order by a.k;
+-- result:
+1	3	3.75
+2	9	9.25
+3	1	1.5
+-- !result
+select a.k, length(get_json_string(a.j, '$.v')) as len_s, get_json_int(b.j, '$.v') as bi
+  from t a join t b on a.k = b.k order by a.k;
+-- result:
+1	4	3
+2	4	9
+3	3	1
+-- !result
+select src, x from (
+  select 'int' as src, cast(get_json_int(j, '$.v') as string) as x from t
+  union all
+  select 'dbl' as src, cast(get_json_double(j, '$.v') as string) as x from t) u
+  order by src, x;
+-- result:
+dbl	1.5
+dbl	3.75
+dbl	9.25
+int	1
+int	3
+int	9
+-- !result
+select a.k from t a join t b on a.k + 1 = b.k
+  where get_json_string(a.j, '$.c') like 'str%' and get_json_int(b.j, '$.c') > 3
+  order by a.k;
+-- result:
+1
+-- !result
+set cbo_json_v2_rewrite = false;
+-- result:
+-- !result
+select a.k, get_json_int(a.j, '$.v') as ai, get_json_double(b.j, '$.v') as bd
+  from t a join t b on a.k = b.k order by a.k;
+-- result:
+1	3	3.75
+2	9	9.25
+3	1	1.5
+-- !result
+select a.k, length(get_json_string(a.j, '$.v')) as len_s, get_json_int(b.j, '$.v') as bi
+  from t a join t b on a.k = b.k order by a.k;
+-- result:
+1	4	3
+2	4	9
+3	3	1
+-- !result
+select src, x from (
+  select 'int' as src, cast(get_json_int(j, '$.v') as string) as x from t
+  union all
+  select 'dbl' as src, cast(get_json_double(j, '$.v') as string) as x from t) u
+  order by src, x;
+-- result:
+dbl	1.5
+dbl	3.75
+dbl	9.25
+int	1
+int	3
+int	9
+-- !result
+select a.k from t a join t b on a.k + 1 = b.k
+  where get_json_string(a.j, '$.c') like 'str%' and get_json_int(b.j, '$.c') > 3
+  order by a.k;
+-- result:
+1
+-- !result
```

**File**: `test/sql/test_json/R/test_json_subfield_mv_catalog_poisoning` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+-- name: test_json_subfield_mv_catalog_poisoning
+create table base (k int, j json) duplicate key(k)
+  distributed by hash(k) buckets 1 properties("replication_num"="1");
+-- result:
+-- !result
+insert into base values
+  (1, parse_json('{"a":1}')),
+  (2, parse_json('{"a":"str"}')),
+  (3, parse_json('{"a":3}'));
+-- result:
+-- !result
+set cbo_json_v2_rewrite = true;
+-- result:
+-- !result
+select k, get_json_string(j, '$.a') as as_str from base order by k;
+-- result:
+1	1
+2	str
+3	3
+-- !result
+select count(*) as str_cnt from base where get_json_string(j, '$.a') = 'str';
+-- result:
+1
+-- !result
+create materialized view mv1 distributed by hash(k) buckets 1 refresh manual
+  properties("replication_num"="1") as select k, cast(j->'$.a' as bigint) as a from base;
+-- result:
+-- !result
+refresh materialized view mv1 with sync mode;
+select k, get_json_string(j, '$.a') as as_str from base order by k;
+-- result:
+1	1
+2	str
+3	3
+-- !result
+select count(*) as str_cnt from base where get_json_string(j, '$.a') = 'str';
+-- result:
+1
+-- !result
+set cbo_json_v2_rewrite = false;
+-- result:
+-- !result
+select k, get_json_string(j, '$.a') as as_str from base order by k;
+-- result:
+1	1
+2	str
+3	3
+-- !result
+select count(*) as str_cnt from base where get_json_string(j, '$.a') = 'str';
+-- result:
+1
+-- !result
+set cbo_json_v2_rewrite = true;
+-- result:
+-- !result
+drop materialized view mv1;
+-- result:
+-- !result
+select k, get_json_string(j, '$.a') as as_str from base order by k;
+-- result:
+1	1
+2	str
+3	3
+-- !result
+set cbo_json_v2_rewrite = false;
+-- result:
+-- !result
+select k, get_json_string(j, '$.a') as as_str from base order by k;
+-- result:
+1	1
+2	str
+3	3
+-- !result
+set cbo_json_v2_rewrite = true;
+-- result:
+-- !result
+create materialized view mv2 distributed by hash(k) buckets 1 refresh manual
+  properties("replication_num"="1") as select k, get_json_string(j, '$.a') as a from base;
+-- result:
+-- !result
+refresh materialized view mv2 with sync mode;
+select k, a from mv2 order by k;
+-- result:
+1	1
+2	str
+3	3
+-- !result
```

---

### Incident Patch 7: `3c6c11a0` (2026-09-30)
**Commit Message**: [BugFix] Release metadata result queue scan resources (#79936)

Co-authored-by: Yixin Luo <18810541851@163.com>
Co-authored-by: code-factory <333128126+code-factory-bot@users.noreply.github.com>

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/StmtExecutor.java` (modified, +16/-2)
```diff
@@ -4198,6 +4198,7 @@ private boolean canExecuteInFe(ConnectContext context, OptExpression optExpressi
     }
 
     public void executeStmtWithResultQueue(ConnectContext context, ExecPlan plan, Queue<TResultBatch> sqlResult) {
+        coord = null;
         try {
             UUID uuid = context.getQueryId();
             context.setExecutionId(UUIDUtil.toTUniqueId(uuid));
@@ -4226,10 +4227,12 @@ public void executeStmtWithResultQueue(ConnectContext context, ExecPlan plan, Qu
             processQueryStatisticsFromResult(batch, plan, false);
         } catch (Exception e) {
             LOG.error("Failed to execute metadata collection job", e);
-            if (coord.getExecStatus().ok()) {
+            if (coord == null || coord.getExecStatus().ok()) {
                 context.getState().setError(e.getMessage());
             }
-            coord.getExecStatus().setInternalErrorStatus(e.getMessage());
+            if (coord != null) {
+                coord.getExecStatus().setInternalErrorStatus(e.getMessage());
+            }
         } finally {
             try {
                 if (context.isProfileEnabled()) {
@@ -4243,6 +4246,17 @@ public void executeStmtWithResultQueue(ConnectContext context, ExecPlan plan, Qu
             } catch (Exception e) {
                 LOG.warn("Failed to unregister query", e);
             }
+            if (coord != null) {
+                coord.clearExternalResources();
+            } else {
+                for (ScanNode scanNode : plan.getScanNodes()) {
+                    try {
+                        scanNode.clear();
+                    } catch (Exception e) {
+                        LOG.warn("Failed to clear scan resources for {}", scanNode.getClass().getSimpleName(), e);
+                    }
+                }
+            }
         }
     }
 
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/MetadataResultQueueScanReleaseTest.java` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+// Copyright 2021-present StarRocks, Inc. All rights reserved.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package com.starrocks.sql.plan;
+
+import com.starrocks.common.StarRocksException;
+import com.starrocks.connector.exception.StarRocksConnectorException;
+import com.starrocks.planner.DescriptorTable;
+import com.starrocks.planner.HdfsScanNode;
+import com.starrocks.qe.DefaultCoordinator;
+import com.starrocks.qe.RowBatch;
+import com.starrocks.qe.StmtExecutor;
+import com.starrocks.thrift.TDescriptorTable;
+import com.starrocks.thrift.TResultBatch;
+import com.starrocks.utframe.UtFrameUtils;
+import mockit.Mock;
+import mockit.MockUp;
+import org.junit.jupiter.api.BeforeEach;
+import org.junit.jupiter.api.Test;
+
+import java.util.Queue;
+import java.util.concurrent.ConcurrentLinkedQueue;
+import java.util.concurrent.atomic.AtomicInteger;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertNull;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+public class MetadataResultQueueScanReleaseTest extends ConnectorPlanTestBase {
+    private static final String HIVE_QUERY = "select * from hive0.partitioned_db.t1";
+
+    @BeforeEach
+    public void resetQueryState() {
+        connectContext.getState().reset();
+    }
+
+    @Test
+    public void testSuccessfulExecutionReleasesScansThroughCoordinator() throws Exception {
+        ExecPlan plan = getExecPlan(HIVE_QUERY);
+        AtomicInteger cleared = new AtomicInteger();
+        new MockUp<DefaultCoordinator>() {
+            @Mock
+            public void exec() {
+            }
+
+            @Mock
+            public RowBatch getNext() {
+                return new RowBatch();
+            }
+
+            @Mock
+            public void clearExternalResources() {
+                cleared.incrementAndGet();
+            }
+        };
+
+        execute(plan);
+
+        assertEquals(1, cleared.get());
+        assertFalse(connectContext.getState().isError());
+    }
+
+    @Test
+    public void testExecutionFailureReleasesScansThroughCoordinator() throws Exception {
+        ExecPlan plan = getExecPlan(HIVE_QUERY);
+        AtomicInteger cleared = new AtomicInteger();
+        new MockUp<DefaultCoordinator>() {
+            @Mock
+            public void exec() throws StarRocksException {
+                throw new StarRocksException("backend unavailable");
+            }
+
+            @Mock
+            public void clearExternalResources() {
+                cleared.incrementAndGet();
+            }
+        };
+
+        execute(plan);
+
+        assertEquals(1, cleared.get());
+        assertTrue(connectContext.getState().isError());
+        assertTrue(connectContext.getState().getErrorMessage().contains("backend unavailable"));
+    }
+
+    @Test
+    public void testFailureBeforeSchedulingReleasesScansAndKeepsCause() throws Exception {
+        ExecPlan plan = getExecPlan(HIVE_QUERY);
+        AtomicInteger cleared = new AtomicInteger();
+        new MockUp<DescriptorTable>() {
+            @Mock
+            public TDescriptorTable toThrift() {
+                throw new StarRocksConnectorException("metastore unavailable");
+            }
+        };
+        new MockUp<HdfsScanNode>() {
+            @Mock
+            public void clear() {
+                cleared.incrementAndGet();

```

---

### Incident Patch 8: `b7186897` (2026-09-29)
**Commit Message**: [BugFix] Preserve other aggregates in primary-key distinct rewrite (#79895)

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rule/transformation/GroupByCountDistinctRewriteRule.java` (modified, +1/-0)
```diff
@@ -184,6 +184,7 @@ public List<OptExpression> transform(OptExpression input, OptimizerContext conte
         LogicalOlapScanOperator scan = (LogicalOlapScanOperator) input.getInputs().get(0).getOp();
         if (isPrimaryKey(distinctColumn.get(), scan)) {
             Map<ColumnRefOperator, CallOperator> newAggregations = Maps.newHashMap();
+            newAggregations.putAll(otherMap);
             distinctMap.forEach((k, v) -> {
                 CallOperator newAgg = transformDistinctAgg(v);
                 newAggregations.put(k, newAgg);
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/DistinctAggTest.java` (modified, +13/-0)
```diff
@@ -55,6 +55,19 @@ void testGroupByCountDistinctArrayWithSkewHint() throws Exception {
                 "  3:EXCHANGE");
     }
 
+    @Test
+    void testCountDistinctPrimaryKeyWithOtherAggregation() throws Exception {
+        String sql = "select v1, count(1), count(distinct pk) from tprimary group by v1 order by v1 desc";
+        String plan = getFragmentPlan(sql);
+        assertContains(plan, "output: count(1), count(1: pk)");
+    }
+
+    @Test
+    void testCountDistinctPrimaryKeyWithoutOtherAggregation() throws Exception {
+        String plan = getFragmentPlan("select v1, count(distinct pk) from tprimary group by v1");
+        assertContains(plan, "count(1: pk)");
+    }
+
     @Test
     void testDistinctConstant() throws Exception {
         String sql = "select b1, count(distinct [skew] a1) as cnt from (select split('a,b,c', ',') as a1, 'aaa' as b1) " +
```

---

### Incident Patch 9: `6fdd160f` (2026-09-29)
**Commit Message**: [BugFix] Keep MV spill IO alive until multicast exchange finishes (#79899)

**File**: `be/src/exec/pipeline/exchange/mem_limited_chunk_queue.cpp` (modified, +18/-6)
```diff
@@ -471,10 +471,11 @@ Status MemLimitedChunkQueue::_flush() {
 
 Status MemLimitedChunkQueue::_submit_flush_task() {
     auto flush_task = [this, guard = RESOURCE_TLS_MEMTRACER_GUARD(_state)](auto& yield_ctx) {
-        SCOPED_SET_TRACE_INFO(0, _state->query_id(), _state->fragment_instance_id());
-        TEST_SYNC_POINT("MemLimitedChunkQueue::before_execute_flush_task");
+        auto pending = DeferOp([this]() { _pending_io_tasks.fetch_sub(1); });
         RETURN_IF(!guard.scoped_begin(), (void)0);
         DEFER_GUARD_END(guard);
+        SCOPED_SET_TRACE_INFO(0, _state->query_id(), _state->fragment_instance_id());
+        TEST_SYNC_POINT("MemLimitedChunkQueue::before_execute_flush_task");
         auto defer = DeferOp([&]() {
             TEST_SYNC_POINT("MemLimitedChunkQueue::after_execute_flush_task");
             _has_flush_io_task.store(false);
@@ -489,7 +490,12 @@ Status MemLimitedChunkQueue::_submit_flush_task() {
 
     auto io_task = workgroup::ScanTask(_state->fragment_runtime_state()->workgroup(), std::move(flush_task));
     io_task.set_query_type(_state->query_options().query_type);
-    RETURN_IF_ERROR(spill::IOTaskExecutor::submit(std::move(io_task)));
+    _pending_io_tasks.fetch_add(1);
+    auto status = spill::IOTaskExecutor::submit(std::move(io_task));
+    if (!status.ok()) {
+        _pending_io_tasks.fetch_sub(1);
+        return status;
+    }
     return Status::OK();
 }
 
@@ -554,18 +560,24 @@ Status MemLimitedChunkQueue::_load(Block* block) {
 
 Status MemLimitedChunkQueue::_submit_load_task(Block* block) {
     auto load_task = [this, block, guard = RESOURCE_TLS_MEMTRACER_GUARD(_state)](auto& yield_ctx) {
-        SCOPED_SET_TRACE_INFO(0, _state->query_id(), _state->fragment_instance_id());
-        TEST_SYNC_POINT_CALLBACK("MemLimitedChunkQueue::before_execute_load_task", block);
+        auto pending = DeferOp([this]() { _pending_io_tasks.fetch_sub(1); });
         RETURN_IF(!guard.scoped_begin(), (void)0);
         DEFER_GUARD_END(guard);
+        SCOPED_SET_TRACE_INFO(0, _state->query_id(), _state->fragment_instance_id());
+        TEST_SYNC_POINT_CALLBACK("MemLimitedChunkQueue::before_execute_load_task", block);
         auto status = _load(block);
         if (!status.ok()) {
             _update_io_task_status(status);
         }
     };
     auto io_task = workgroup::ScanTask(_state->fragment_runtime_state()->workgroup(), std::move(load_task));
     io_task.set_query_type(_state->query_options().query_type);
-    RETURN_IF_ERROR(spill::IOTaskExecutor::submit(std::move(io_task)));
+    _pending_io_tasks.fetch_add(1);
+    auto status = spill::IOTaskExecutor::submit(std::move(io_task));
+    if (!status.ok()) {
+        _pending_io_tasks.fetch_sub(1);
+        return status;
+    }
     return Status::OK();
 }
 
```

**File**: `be/src/exec/pipeline/exchange/mem_limited_chunk_queue.h` (modified, +4/-0)
```diff
@@ -14,6 +14,7 @@
 
 #pragma once
 
+#include <atomic>
 #include <mutex>
 #include <queue>
 
@@ -157,6 +158,8 @@ class MemLimitedChunkQueue {
 
     void enter_release_memory_mode();
 
+    bool has_pending_io_tasks() const { return _pending_io_tasks.load() != 0; }
+
 private:
     void _update_progress(Iterator* iter = nullptr);
 
@@ -226,6 +229,7 @@ class MemLimitedChunkQueue {
     Status _status;
 
     std::atomic_bool _has_flush_io_task = false;
+    std::atomic<size_t> _pending_io_tasks = 0;
     phmap::flat_hash_set<Block*> _loaded_blocks;
 
     RuntimeProfile::HighWaterMarkCounter* _peak_memory_bytes_counter = nullptr;
```

**File**: `be/src/exec/pipeline/exchange/multi_cast_local_exchange.h` (modified, +2/-0)
```diff
@@ -72,6 +72,7 @@ class MultiCastLocalExchanger {
 
     virtual bool releaseable() const { return false; }
     virtual void enter_release_memory_mode() {}
+    virtual bool has_pending_io_tasks() const { return false; }
 
     PipeObservable& observable() { return _observable; }
 
@@ -148,6 +149,7 @@ class SpillableMultiCastLocalExchanger : public MultiCastLocalExchanger {
     bool is_all_sources_finished() const override;
     bool releaseable() const override { return true; }
     void enter_release_memory_mode() override;
+    bool has_pending_io_tasks() const override;
 
 private:
     std::shared_ptr<MemLimitedChunkQueue> _queue;
```

**File**: `be/src/exec/pipeline/exchange/multi_cast_local_exchange_sink_operator.h` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ class MultiCastLocalExchangeSinkOperator : public Operator {
 
     bool is_finished() const override { return _is_finished || _exchanger->is_all_sources_finished(); }
 
+    bool pending_finish() const override { return _exchanger->has_pending_io_tasks(); }
+
     Status set_finishing(RuntimeState* state) override;
 
     StatusOr<ChunkPtr> pull_chunk(RuntimeState* state) override;
```

**File**: `be/src/exec/pipeline/exchange/multi_cast_local_exchange_source_operator.h` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ class MultiCastLocalExchangeSourceOperator final : public SourceOperator {
 
     bool is_finished() const override { return _is_finished; }
 
+    bool pending_finish() const override { return _exchanger->has_pending_io_tasks(); }
+
     Status set_finishing(RuntimeState* state) override;
 
     StatusOr<ChunkPtr> pull_chunk(RuntimeState* state) override;
```

---

### Incident Patch 10: `357c8980` (2026-09-29)
**Commit Message**: [BugFix] Fix prepared statement leak on COM_STMT_CLOSE (#79860)

Signed-off-by: Yaqi Zhang <y.zhang@celonis.com>

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/ConnectProcessor.java` (modified, +1/-1)
```diff
@@ -1062,7 +1062,7 @@ private void handleStmtReset() {
     }
 
     private void handleStmtClose() {
-        int stmtId = packetBuf.getInt();
+        int stmtId = MysqlCodec.readInt4(packetBuf);
         ctx.removePreparedStmt(String.valueOf(stmtId));
         ctx.getState().setStateType(QueryState.MysqlStateType.NOOP);
     }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/qe/ConnectProcessorTest.java` (modified, +111/-0)
```diff
@@ -52,13 +52,16 @@
 import com.starrocks.common.util.UUIDUtil;
 import com.starrocks.mysql.MysqlCapability;
 import com.starrocks.mysql.MysqlChannel;
+import com.starrocks.mysql.MysqlColType;
 import com.starrocks.mysql.MysqlCommand;
 import com.starrocks.mysql.MysqlEofPacket;
 import com.starrocks.mysql.MysqlErrPacket;
 import com.starrocks.mysql.MysqlOkPacket;
+import com.starrocks.mysql.MysqlPackageDecoder;
 import com.starrocks.mysql.MysqlPassword;
 import com.starrocks.mysql.MysqlProto;
 import com.starrocks.mysql.MysqlSerializer;
+import com.starrocks.mysql.RequestPackage;
 import com.starrocks.plugin.AuditEvent;
 import com.starrocks.plugin.AuditEvent.AuditEventBuilder;
 import com.starrocks.proto.PQueryStatistics;
@@ -300,6 +303,114 @@ public void setCommand(MysqlCommand command) {
         return context;
     }
 
+    @Test
+    public void testStmtCloseUsesLittleEndianStatementId() throws Exception {
+        int stmtId = 0x01020304;
+        for (ByteOrder byteOrder : new ByteOrder[] {ByteOrder.BIG_ENDIAN, ByteOrder.LITTLE_ENDIAN}) {
+            MysqlSerializer serializer = MysqlSerializer.newInstance();
+            serializer.writeInt1(MysqlCommand.COM_STMT_CLOSE.getCommandCode());
+            serializer.writeInt4(stmtId);
+            MysqlChannel channel = mockChannel(serializer.toByteBuffer().order(byteOrder));
+            ConnectContext ctx = initMockContext(channel, GlobalStateMgr.getCurrentState());
+            PrepareStmtContext preparedStmt = new PrepareStmtContext(createMockPrepareStmt("SELECT 1"), ctx, null);
+            ctx.putPreparedStmt(String.valueOf(stmtId), preparedStmt);
+            ctx.putPreparedStmt(String.valueOf(Integer.reverseBytes(stmtId)), preparedStmt);
+
+            ConnectProcessor processor = new ConnectProcessor(ctx);
+            processor.processOnce();
+
+            Assertions.assertNull(ctx.getPreparedStmt(String.valueOf(stmtId)), byteOrder.toString());
+            Assertions.assertSame(preparedStmt, ctx.getPreparedStmt(String.valueOf(Integer.reverseBytes(stmtId))));
+            Assertions.assertEquals(QueryState.MysqlStateType.NOOP, ctx.getState().getStateType());
+            Mockito.verify(channel, Mockito.never()).sendAndFlush(Mockito.any(ByteBuffer.class));
+        }
+    }
+
+    @Test
+    public void testStmtCloseFromPackageDecoder() throws Exception {
+        MysqlSerializer serializer = MysqlSerializer.newInstance();
+        serializer.writeInt4(5); // three-byte payload length followed by sequence ID 0
+        serializer.writeInt1(MysqlCommand.COM_STMT_CLOSE.getCommandCode());
+        serializer.writeInt4(1);
+        MysqlPackageDecoder decoder = new MysqlPackageDecoder();
+        decoder.consume(serializer.toByteBuffer());
+        RequestPackage request = decoder.poll();
+        Assertions.assertNotNull(request);
+
+        MysqlChannel channel = mockChannel(request.byteBuffer());
+        ConnectContext ctx = initMockContext(channel, GlobalStateMgr.getCurrentState());
+        ctx.putPreparedStmt("1", new PrepareStmtContext(createMockPrepareStmt("SELECT 1"), ctx, null));
+
+        new ConnectProcessor(ctx).processOnce(request);
+
+        Assertions.assertNull(ctx.getPreparedStmt("1"));
+        Assertions.assertEquals(QueryState.MysqlStateType.NOOP, ctx.getState().getStateType());
+        Mockito.verify(channel, Mockito.never()).sendAndFlush(Mockito.any(ByteBuffer.class));
+    }
+
+    @Test
+    public void testStmtCloseAfterLargeExecutePacket() throws Exception {
+        int stmtId = 1;
+        String value = "x".repeat(16 * 1024);
+        MysqlSerializer execute = MysqlSerializer.newInstance();
+        execute.writeInt1(MysqlCommand.COM_STMT_EXECUTE.getCommandCode());
+        execute.writeInt4(stmtId);
+        execute.writeInt1(0); // flags
+        execute.writeInt4(1); // iteration count
+        execute.writeInt1(0); // null bitmap
+        execute.writeInt1(1); // new parameter types
+        execute.writeInt2(MysqlColType.MYSQL_
```

#### Recent Merged Pull Requests:
- **PR #79975** (closed): [BugFix] Run lookup_string internal query with the caller's identity (backport #79959) (@mergify[bot])
- **PR #79964** (2026-09-30): [Enhancement] Add native GEO measurements and properties (Contract 5.2) (@ViktorGo86)
- **PR #79963** (2026-09-30): [Enhancement] Enable zone-map pruning for date_trunc predicates (backport #79021) (@mergify[bot])
- **PR #79959** (2026-09-30): [BugFix] Run lookup_string internal query with the caller's identity (@trueeyu)
- **PR #79957** (2026-09-30): [Enhancement] Plan colocate aggregation and window on range-colocate tables (backport #79946) (@mergify[bot])
- **PR #79955** (2026-09-30): [BugFix] Re-plan a query whose range-colocate bucket assignment went stale (backport #79927) (@mergify[bot])
- **PR #79954** (2026-09-30): [BugFix] Stop pruning generated-column partitions on a NOT IN over their source column (@Hyper-FF)
- **PR #79953** (2026-09-30): [Enhancement] Reserve TVectorSearchOptions fields 15 and 16 for vector search options (@sevev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
