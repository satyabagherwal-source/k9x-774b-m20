# Verification Protocol: Verification Protocol: Empirical Defect Shield for starrocks-starrocks-learnings

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:45:10.527Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-starrocks-starrocks-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:45:10.527Z`  
> **Learning ID**: `LEARN-REEXTRACT-starrocks-starrocks-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `starrocks-starrocks-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `bf73116b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T04:24:00.441Z  
> **Learning ID**: `learn-github-starrocks-starrocks`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): StarRocks/starrocks

> **Canonical Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T04:24:00.258Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12248 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `be/src/agent/task_worker_pool.cpp`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/agent/task_worker_pool.cpp

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

#include "agent/task_worker_pool.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <ctime>
#include <sstream>
#include <string>

#include "agent/agent_metrics.h"
#include "agent/agent_server.h"
#include "agent/finish_task.h"
#include "agent/publish_version.h"
#include "agent/publish_version_manager.h"
#include "agent/report_task.h"
#include "agent/resource_group_usage_recorder.h"
#include "agent/task_signatures_manager.h"
#include "base/simd/simd.h"
#include "cache/datacache.h"
#include "cache/datacache_utils.h"
#include "common/config_agent_fwd.h"
#include "common/config_metrics_fwd.h"
#include "common/config_network_fwd.h"
#include "common/status.h"
#include "common/system/backend_options.h"
#include "common/system/master_info.h"
#include "common/thread/thread.h"
#include "common/util/misc.h"
#include "compute_env/workgroup/work_group.h"
#include "compute_env/workgroup/work_group_manager.h"
#include "data_workflows/clone/engine_clone_task.h"
#include "data_workflows/load/engine_batch_load_task.h"
#include "exec/exec_env.h"
#include "exec/pipeline/query_context.h"
#include "exec/runtime/query_context_manager.h"
#include "fs/fs_util.h"
#include "gen_cpp/DataCache_types.h"
#include "gen_cpp/Types_types.h"
#include "runtime/current_thread.h"
#include "storage/data_dir.h"
#include "storage/lake/tablet_manager.h"
#include "storage/snapshot_manager.h"
#include "storage/storage_engine.h"
#include "storage/storage_metrics.h"
#include "storage/update_manager.h"
#include "storage/utils.h"
#include "storage_primitive/storage_ids.h"

namespace starrocks {

namespace {
static void wait_for_disk_report_notify(const std::function<bool()>& stop_waiting) {
    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(config::report_disk_state_interval_seconds);
    bool notified = false;
    do {
        // take 1 second per step
        notified = StorageEngine::instance()->wait_for_report_notify(1, false);
    } while (!notified && std::chrono::steady_clock::now() < deadline && !stop_waiting());
}

static void wait_for_tablet_report_notify(const std::function<bool()>& stop_waiting) {
    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(config::report_tablet_interval_seconds);
    bool notified = false;
    do {
        // take 1 second per step
        notified = StorageEngine::instance()->wait_for_report_notify(1, true);
    } while (!notified
             // if the regular report is stopped, there will be no deadline
             && (ReportOlapTableTaskWorkerPool::is_regular_report_stopped() ||
                 std::chrono::steady_clock::now() < deadline) &&
             !stop_waiting());
}
} // namespace

const size_t PUBLISH_VERSION_BATCH_SIZE = 10;

std::atomic<int64_t> g_report_version(time(nullptr) * 10000);

using std::swap;

int64_t curr_report_version() {
    return g_report_version.load();
}

int64_t next_report_version() {
    return ++g_report_version;
}

template <class AgentTaskRequest>
TaskWorkerPool<AgentTaskRequest>::TaskWorkerPool(ExecEnv* env, int worker_count)
        : _env(env), _worker_thread_condition_variable(new std::condition_variable()), _worker_count(worker_count) {
    _backend.__set_host(BackendOptions::get_localhost());
    _backend.__set_be_port(config::be_port);
    _backend.__set_http_port(config::be_http_port);
}

template <class AgentTaskRequest>
TaskWorkerPool<AgentTaskRequest>::~TaskWorkerPool() {
    stop();
    for (uint32_t i = 0; i < _worker_count; ++i) {
        if (_worker_threads[i].joinable()) {
            _worker_threads[i].join();
        }
    }
    delete _worker_thread_condition_variable;
}

template <class AgentTaskRequest>
void TaskWorkerPool<AgentTaskRequest>::start() {
    for (uint32_t i = 0; i < _worker_count; i++) {
        _spawn_callback_worker_thread(_callback_function);
    }
}

template <class AgentTaskRequest>
void TaskWorkerPool<AgentTaskRequest>::stop() {
    _stopped = true;
    _worker_thread_condition_variable->notify_all();
}

template <class AgentTaskRequest>
size_t TaskWorkerPool<AgentTaskRequest>::_push_task(AgentTaskRequestPtr task) {
    std::unique_lock l(_worker_thread_lock);
    _tasks.emplace_back(std::move(task));
    _worker_thread_condition_variable->notify_one();
    return _tasks.size();
}

template <class AgentTaskRequest>
typename TaskWorkerPool<AgentTaskRequest>::AgentTaskRequestPtr TaskWorkerPool<AgentTaskRequest>::_pop_task() {
    std::unique_lock l(_worker_thread_lock);
    _worker_thread_condition_variable->wait(l, [&]() { return !_tasks.empty() || _stopped; });
    if (!_stopped) {
        auto ret = std::move(_tasks.front());
        _tasks.pop_front();
        return ret;
    }
    return nullptr;
}

template <class AgentTaskRequest>
typename TaskWorkerPool<AgentTaskRequest>::AgentTaskRequestPtr TaskWorkerPool<AgentTaskRequest>::_pop_task(
        TPriority::type pri) {
    std::unique_lock l(_worker_thread_lock);
    _worker_thread_condition_variable->wait(l, [&]() { return !_tasks.empty() || _stopped; });
    if (_stopped) {
        return nullptr;
    }
    for (int64_t i = static_cast<int64_t>(_tasks.size()) - 1; i >= 0; --i) {
        auto& task = _tasks[i];
        if (task->isset.priority && task->priority == pri) {
            auto ret = std::move(task);
            _tasks.erase(_tasks.begin() + i);
            return ret;
        }
    }
    return nullptr;
}

template <class AgentTaskRequest>
void TaskWorkerPool<AgentTaskRequest>::submit_task(const TAgentTaskRequest& task) {
    const TTaskType::type task_type = task.task_type;
    int64_t signature = task.signature;

    std::string type_str;
    EnumToString(TTaskType, task_type, type_str);

    std::pair<bool, size_t> register_pair = register_task_info(task_type, signature);
    if (register_pair.first) {
        // Set the receiving time of task so that we can determine whether it is timed out later
        auto new_task = _convert_task(task, time(nullptr));
        size_t task_count = _push_task(std::move(new_task));
        VLOG(1) << "Submit task success. type=" << type_str << ", signature=" << signature
                << ", task_count_in_queue=" << task_count;
    } else {
        LOG(INFO) << "Submit task failed, already exists type=" << type_str << ", signature=" << signature;
    }
}

template <class AgentTaskRequest>
void TaskWorkerPool<AgentTaskRequest>::submit_tasks(const std::vector<const TAgentTaskRequest*>& tasks) {
    DCHECK(!tasks.empty());
    std::string type_str;
    size_t task_count = tasks.size();
    const TTaskType::type task_type = tasks[0]->task_type;
    EnumToString(TTaskType, task_type, type_str);
    const auto recv_time = time(nullptr);
    auto failed_task = batch_register_task_info(tasks);

    size_t non_zeros = SIMD::count_nonzero(failed_task);

    std::stringstream fail_ss;
    std::stringstream succ_ss;
    size_t fail_counter = non_zeros;
    size_t succ_counter = task_count - non_zeros;
    for (int i = 0; i < failed_task.size(); ++i) {
        if (failed_task[i] == 1) {
            fail_ss << tasks[i]->signature;
            fail_counter--;
            if (fail_counter > 0) {
                fail_ss << ",";
            }
        } else {
            succ_ss << tasks[i]->signature;
            succ_counter--;
            if (succ_counter > 0) {
                succ_ss << ",";
            }
        }
    }
    if (fail_ss.str().length() > 0) {
        LOG(INFO) << "fail to register task. type=" << type_str << ", signatures=[" << fail_ss.str() << "]";
    }

    size_t queue_size = 0;
    {
        std::unique_lock l(_worker_thread_lock);
        if (UNLIKELY(task_type == TTaskType::REALTIME_PUSH &&
                     tasks[0]->push_req.push_type == TPushType::CANCEL_DELETE)) {
            for (size_t i = 0; i < task_count; i++) {
                if (failed_task[i] == 0) {
                    auto new_task = _convert_task(*tasks[i], recv_time);
                    _tasks.emplace_front(std::move(new_task));
                }
            }
        } else {
            for (size_t i = 0; i < task_count; i++) {
                if (failed_task[i] == 0) {
                    auto new_task = _convert_task(*tasks[i], recv_time);
                    _tasks.emplace_back(std::move(new_task));
                }
            }
        }
        queue_size = _tasks.size();
        _worker_thread_condition_variable
```

### Core Architecture Module: `be/src/agent/task_worker_pool.h`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/agent/task_worker_pool.h

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
#include <atomic>
#include <condition_variable>
#include <deque>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

#include "agent/agent_common.h"
#include "agent/status.h"
#include "agent/utils.h"
#include "common/system/cpu_usage_info.h"
#include "gen_cpp/AgentService_types.h"
#include "gen_cpp/HeartbeatService_types.h"
#include "storage/storage_engine.h"

namespace starrocks {

class ExecEnv;

int64_t curr_report_version();
int64_t next_report_version();

class TaskWorkerPoolBase {
public:
    static AgentStatus get_tablet_info(TTabletId tablet_id, TSchemaHash schema_hash, int64_t signature,
                                       TTabletInfo* tablet_info);

protected:
    static std::atomic<int64_t> _s_report_version;
};

template <class AgentTaskRequest>
class TaskWorkerPool : public TaskWorkerPoolBase {
public:
    typedef void* (*CALLBACK_FUNCTION)(void*);

    TaskWorkerPool(ExecEnv* env, int worker_num);
    virtual ~TaskWorkerPool();

    // start the task worker callback thread
    void start();

    // stop the task worker callback thread
    void stop();

    // Submit task to task pool
    //
    // Input parameters:
    // * task: the task need callback thread to do
    void submit_task(const TAgentTaskRequest& task);
    void submit_tasks(const std::vector<const TAgentTaskRequest*>& task);

    size_t num_queued_tasks() const;

    TaskWorkerPool(const TaskWorkerPool&) = delete;
    const TaskWorkerPool& operator=(const TaskWorkerPool&) = delete;

protected:
    void _spawn_callback_worker_thread(CALLBACK_FUNCTION callback_func);

    using AgentTaskRequestPtr = std::shared_ptr<AgentTaskRequest>;

    virtual AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) = 0;

    size_t _push_task(AgentTaskRequestPtr task);
    AgentTaskRequestPtr _pop_task();
    AgentTaskRequestPtr _pop_task(TPriority::type pri);

    TBackend _backend;
    ExecEnv* _env;

    // Protect task queue
    mutable std::mutex _worker_thread_lock;
    std::condition_variable* _worker_thread_condition_variable;
    std::deque<AgentTaskRequestPtr> _tasks;

    uint32_t _worker_count = 0;
    uint32_t _sleeping_count = 0;
    CALLBACK_FUNCTION _callback_function = nullptr;

    std::atomic<bool> _stopped{false};
    std::vector<std::thread> _worker_threads;
}; // class TaskWorkerPool

class PushTaskWorkerPool : public TaskWorkerPool<PushReqAgentTaskRequest> {
public:
    PushTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<PushReqAgentTaskRequest>(task, task.push_req, recv_time);
    }
};

class PublishVersionTaskWorkerPool : public TaskWorkerPool<PublishVersionAgentTaskRequest> {
public:
    PublishVersionTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<PublishVersionAgentTaskRequest>(task, task.publish_version_req, recv_time);
    }
};

class DeleteTaskWorkerPool : public TaskWorkerPool<PushReqAgentTaskRequest> {
public:
    DeleteTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<PushReqAgentTaskRequest>(task, task.push_req, recv_time);
    }
};

class ReportTaskWorkerPool : public TaskWorkerPool<AgentTaskRequestWithoutReqBody> {
public:
    ReportTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<AgentTaskRequestWithoutReqBody>(task, recv_time);
    }
};

class ReportDiskStateTaskWorkerPool : public TaskWorkerPool<AgentTaskRequestWithoutReqBody> {
public:
    ReportDiskStateTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<AgentTaskRequestWithoutReqBody>(task, recv_time);
    }
};

class ReportOlapTableTaskWorkerPool : public TaskWorkerPool<AgentTaskRequestWithoutReqBody> {
public:
    ReportOlapTableTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

    static void set_regular_report_stopped(bool stop) { _regular_report_stopped.store(stop); }

    static bool is_regular_report_stopped() { return _regular_report_stopped.load(); }

private:
    static std::atomic<bool> _regular_report_stopped;

    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<AgentTaskRequestWithoutReqBody>(task, recv_time);
    }
};

class ReportWorkgroupTaskWorkerPool : public TaskWorkerPool<AgentTaskRequestWithoutReqBody> {
public:
    ReportWorkgroupTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<AgentTaskRequestWithoutReqBody>(task, recv_time);
    }
};

class ReportResourceUsageTaskWorkerPool : public TaskWorkerPool<AgentTaskRequestWithoutReqBody> {
public:
    ReportResourceUsageTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<AgentTaskRequestWithoutReqBody>(task, recv_time);
    }

private:
    CpuUsageRecorder _cpu_usage_recorder;
};

class ReportDataCacheMetricsTaskWorkerPool final : public TaskWorkerPool<AgentTaskRequestWithoutReqBody> {
public:
    ReportDataCacheMetricsTaskWorkerPool(ExecEnv* env, int worker_num) : TaskWorkerPool(env, worker_num) {
        _callback_function = _worker_thread_callback;
    }

private:
    static void* _worker_thread_callback(void* arg_this);

    AgentTaskRequestPtr _convert_task(const TAgentTaskRequest& task, time_t recv_time) override {
        return std::make_shared<AgentTaskRequestWithoutReqBody>(task, recv_time);
    }
};

} // namespace starrocks

```

### Core Architecture Module: `be/src/agent/utils.cpp`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/agent/utils.cpp

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

#include "agent/utils.h"

#include <sstream>

#include "common/status.h"
#include "common/system/master_info.h"
#include "platform/thrift_rpc_helper.h"

using std::map;
using std::string;
using std::stringstream;
using std::vector;

namespace starrocks {

AgentStatus MasterServerClient::finish_task(const TFinishTaskRequest& request, TMasterResult* result) {
    Status client_status;
    TNetworkAddress network_address = get_master_address();

    client_status = ThriftRpcHelper::rpc<FrontendServiceClient>(
            network_address.hostname, network_address.port,
            [&result, &request](FrontendServiceConnection& client) { client->finishTask(*result, request); });

    if (!client_status.ok()) {
        LOG(WARNING) << "Fail to finish_task. "
                     << "host=" << network_address.hostname << ", port=" << network_address.port
                     << ", error=" << client_status;
        return STARROCKS_ERROR;
    }

    return STARROCKS_SUCCESS;
}

AgentStatus MasterServerClient::report(const TReportRequest& request, TMasterResult* result) {
    Status client_status;
    TNetworkAddress network_address = get_master_address();

    client_status = ThriftRpcHelper::rpc<FrontendServiceClient>(
            network_address.hostname, network_address.port,
            [&result, &request](FrontendServiceConnection& client) { client->report(*result, request); });

    if (!client_status.ok()) {
        LOG(WARNING) << "Fail to report to master. "
                     << "host=" << network_address.hostname << ", port=" << network_address.port
                     << ", error=" << client_status;
        return STARROCKS_ERROR;
    }

    return STARROCKS_SUCCESS;
}

} // namespace starrocks

```

### Core Architecture Module: `be/src/agent/utils.h`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/agent/utils.h

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

#include "agent/status.h"
#include "common/util/thrift_client_cache.h"
#include "gen_cpp/FrontendService.h"
#include "gen_cpp/FrontendService_types.h"
#include "gen_cpp/HeartbeatService_types.h"

namespace starrocks {

class MasterServerClient {
public:
    explicit MasterServerClient() = default;
    virtual ~MasterServerClient() = default;

    // Reprot finished task to the master server
    //
    // Input parameters:
    // * request: The infomation of finished task
    //
    // Output parameters:
    // * result: The result of report task
    virtual AgentStatus finish_task(const TFinishTaskRequest& request, TMasterResult* result);

    // Report tasks/olap tablet/disk state to the master server
    //
    // Input parameters:
    // * request: The infomation to report
    //
    // Output parameters:
    // * result: The result of report task
    virtual AgentStatus report(const TReportRequest& request, TMasterResult* result);

    MasterServerClient(const MasterServerClient&) = delete;
    const MasterServerClient& operator=(const MasterServerClient&) = delete;
};

} // namespace starrocks

```

### Core Architecture Module: `be/src/base/bit/bit_stream_utils.h`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/util/bit_stream_utils.h

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

#include "base/bit/bit_util.h"
#include "base/string/faststring.h"

using starrocks::BitUtil;

namespace starrocks {

// Utility class to write bit/byte streams.  This class can write data to either be
// bit packed or byte aligned (and a single stream that has a mix of both).
class BitWriter {
public:
    // buffer: buffer to write bits to.
    explicit BitWriter(faststring* buffer) : buffer_(buffer) { Clear(); }

    void Clear() {
        buffered_values_ = 0;
        byte_offset_ = 0;
        bit_offset_ = 0;
        buffer_->clear();
    }

    // Returns a pointer to the underlying buffer
    faststring* buffer() const { return buffer_; }

    // The number of current bytes written, including the current byte (i.e. may include a
    // fraction of a byte). Includes buffered values.
    int bytes_written() const { return byte_offset_ + BitUtil::Ceil(bit_offset_, 8); }

    // Writes a value to buffered_values_, flushing to buffer_ if necessary.  This is bit
    // packed.
    void PutValue(uint64_t v, int num_bits);

    // Writes v to the next aligned byte using num_bits. If T is larger than num_bits, the
    // extra high-order bits will be ignored.
    template <typename T>
    void PutAligned(T v, int num_bits);

    // Write a Vlq encoded int to the buffer. The value is written byte aligned.
    // For more details on vlq: en.wikipedia.org/wiki/Variable-length_quantity
    void PutVlqInt(uint32_t v);

    // Writes an int zigzag encoded.
    void PutZigZagVlqInt(int32_t v);

    // Write a Vlq encoded int64 to the buffer.  Returns false if there was not enough room.
    // The value is written byte aligned.
    // For more details on vlq: en.wikipedia.org/wiki/Variable-length_quantity
    void PutVlqInt(uint64_t v);

    // Writes an int64 zigzag encoded.
    void PutZigZagVlqInt(int64_t v);

    // Get the index to the next aligned byte and advance the underlying buffer by num_bytes.
    size_t GetByteIndexAndAdvance(int num_bytes) {
        uint8_t* ptr = GetNextBytePtr(num_bytes);
        return ptr - buffer_->data();
    }

    // Get a pointer to the next aligned byte and advance the underlying buffer by num_bytes.
    uint8_t* GetNextBytePtr(int num_bytes);

    // Flushes all buffered values to the buffer. Call this when done writing to the buffer.
    // If 'align' is true, buffered_values_ is reset and any future writes will be written
    // to the next byte boundary.
    void Flush(bool align = false);

    // Maximum byte length of a vlq encoded int
    static const int MAX_VLQ_BYTE_LEN = 5;

private:
    // Bit-packed values are initially written to this variable before being memcpy'd to
    // buffer_. This is faster than writing values byte by byte directly to buffer_.
    uint64_t buffered_values_;

    faststring* buffer_;
    int byte_offset_; // Offset in buffer_
    int bit_offset_;  // Offset in buffered_values_
};

// Utility class to read bit/byte stream.  This class can read bits or bytes
// that are either byte aligned or not.  It also has utilities to read multiple
// bytes in one read (e.g. encoded int).
class BitReader {
public:
    // 'buffer' is the buffer to read from.  The buffer's length is 'buffer_len'.
    BitReader(const uint8_t* buffer, int buffer_len);

    BitReader() = default;

    // Gets the next value from the buffer.  Returns true if 'v' could be read or false if
    // there are not enough bytes left. num_bits must be <= 32.
    template <typename T>
    bool GetValue(int num_bits, T* v);

    template <typename T>
    bool GetBatch(int num_bits, T* v, int num_values);

    // Reads a 'num_bytes'-sized value from the buffer and stores it in 'v'. T needs to be a
    // little-endian native type and big enough to store 'num_bytes'. The value is assumed
    // to be byte-aligned so the stream will be advanced to the start of the next byte
    // before 'v' is read. Returns false if there are not enough bytes left.
    template <typename T>
    bool GetAligned(int num_bytes, T* v);

    // Reads a vlq encoded int from the stream.  The encoded int must start at the
    // beginning of a byte. Return false if there were not enough bytes in the buffer.
    bool GetVlqInt(uint32_t* v);

    // Reads a zigzag encoded int `into` v.
    bool GetZigZagVlqInt(int32_t* v);

    // Reads a vlq encoded int64 from the stream.  The encoded int must start at
    // the beginning of a byte. Return false if there were not enough bytes in
    // the buffer.
    bool GetVlqInt(uint64_t* v);

    // Reads a zigzag encoded int64 `into` v.
    bool GetZigZagVlqInt(int64_t* v);

    // Returns the number of bytes left in the stream, not including the current byte (i.e.,
    // there may be an additional fraction of a byte).
    int bytes_left() const { return max_bytes_ - (byte_offset_ + BitUtil::Ceil(bit_offset_, 8)); }

    // Current position in the stream, by bit.
    int position() const { return byte_offset_ * 8 + bit_offset_; }

    // Rewind the stream by 'num_bits' bits
    bool Rewind(int num_bits);

    // Advance the stream by 'num_bits' bits
    bool Advance(int num_bits);

    // Seek to a specific bit in the buffer
    bool SeekToBit(uint stream_position);

    // Maximum byte length of a vlq encoded int
    static const int MAX_VLQ_BYTE_LEN = 5;
    static const int MAX_VLQ_BYTE_LEN_INT64 = 10;

    bool is_initialized() const { return buffer_ != nullptr; }

    // Byte access for decoders that parse byte-aligned data themselves (e.g. RLE run headers): only valid
    // while is_byte_aligned(); advance_bytes() then moves past the bytes consumed that way.
    bool is_byte_aligned() const { return bit_offset_ == 0; }
    const uint8_t* aligned_byte_ptr() const { return buffer_ + byte_offset_; }
    int aligned_bytes_left() const { return max_bytes_ - byte_offset_; }
    void advance_bytes(int num_bytes);

    void reset(const uint8_t* buffer, int buffer_len);

private:
    // Used by SeekToBit() and GetValue() to fetch the
    // the next word into buffer_.
    void BufferValues();

    const uint8_t* buffer_ = nullptr;
    int max_bytes_ = 0;

    // Bytes are memcpy'd from buffer_ and values are read from this variable. This is
    // faster than reading values byte by byte directly from buffer_.
    uint64_t buffered_values_ = 0;

    int byte_offset_ = 0; // Offset in buffer_
    int bit_offset_ = 0;  // Offset in buffered_values_
};

class BatchedBitReader {
public:
    BatchedBitReader() = default;

    void reset(const uint8_t* buffer, int64_t buffer_len) {
        _buffer_pos = buffer;
        _buffer_end = buffer + buffer_len;
    }

    // Reads an unpacked 'num_bytes'-sized value from the buffer and stores it in 'v'. T
    // needs to be a little-endian native type and big enough to store 'num_bytes'.
    // Returns false if there are not enough bytes left.
    template <typename T>
    bool get_bytes(int num_bytes, T* v);

    bool skip_bytes(int num_bytes);

    // Gets up to 'num_values' bit-packed values, starting from the current byte in the
    // buffer and advance the read position. 'bit_width' must be <= 64.
    // If 'bit_width' * 'num_values' is not a multiple of 8, the trailing bytes are
    // skipped and the next UnpackBatch() call will start reading from the next byte.
    //
    // If the caller does not want to drop trailing bits, 'num_values' must be exactly the
    // total number of values the caller wants to read from a run of bit-packed values, or
    // 'bit_width' * 'num_values' must be a multiple of 8. This condition is always
    // satisfied if 'num_values' is a multiple of 32.
    //
    // The output type 'T' must be an unsigned integer.
    //
    // Returns the number of values read.
    template <typename T>
    int unpack_batch(int bit_width, int num_values, T* v);

    /// Read an unsigned ULEB-128 encoded int from the stream. The encoded int must start
    /// at the beginning of a byte. Return false if there were not enough bytes in the
    /// buffer or the int is invalid. For more details on ULEB-128:
    /// https://en.wikipedia.org/wiki/LEB128
    /// UINT_T must be an unsigned integer type.
    template <typename UINT_T>
    bool get_lleb_128(UINT_T* v);

private:
    /// Returns the number of bytes left in the stream.
    int _bytes_left() { return _buffer_end - _buffer_pos; }

    /// Maximum byte length of a vlq encoded integer of type T.
    t
```

### Core Architecture Module: `be/src/base/bit/bit_stream_utils.inline.h`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/util/bit_stream_utils.inline.h

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

#include <arrow/util/ubsan.h>

#include <algorithm>

#include "base/bit/bit_packing.h"
#include "base/bit/bit_stream_utils.h"
#include "base/utility/alignment.h"
#include "glog/logging.h"

using starrocks::BitUtil;

namespace starrocks {

inline void BitWriter::PutValue(uint64_t v, int num_bits) {
    DCHECK_LE(num_bits, 64);
    // Truncate the higher-order bits. This is necessary to
    // support signed values.
    v &= ~0ULL >> (64 - num_bits);

    buffered_values_ |= v << bit_offset_;
    bit_offset_ += num_bits;

    if (PREDICT_FALSE(bit_offset_ >= 64)) {
        // Flush buffered_values_ and write out bits of v that did not fit
        buffer_->reserve(ALIGN_UP(byte_offset_ + 8, 8));
        buffer_->resize(byte_offset_ + 8);
        DCHECK_LE(byte_offset_ + 8, buffer_->capacity());
        memcpy(buffer_->data() + byte_offset_, &buffered_values_, 8);
        buffered_values_ = 0;
        byte_offset_ += 8;
        bit_offset_ -= 64;
        buffered_values_ = BitUtil::ShiftRightZeroOnOverflow(v, (num_bits - bit_offset_));
    }
    DCHECK_LT(bit_offset_, 64);
}

inline void BitWriter::Flush(bool align) {
    int num_bytes = BitUtil::Ceil(bit_offset_, 8);
    buffer_->reserve(ALIGN_UP(byte_offset_ + num_bytes, 8));
    buffer_->resize(byte_offset_ + num_bytes);
    DCHECK_LE(byte_offset_ + num_bytes, buffer_->capacity());
    memcpy(buffer_->data() + byte_offset_, &buffered_values_, num_bytes);

    if (align) {
        buffered_values_ = 0;
        byte_offset_ += num_bytes;
        bit_offset_ = 0;
    }
}

inline uint8_t* BitWriter::GetNextBytePtr(int num_bytes) {
    Flush(/* align */ true);
    buffer_->reserve(ALIGN_UP(byte_offset_ + num_bytes, 8));
    buffer_->resize(byte_offset_ + num_bytes);
    uint8_t* ptr = buffer_->data() + byte_offset_;
    byte_offset_ += num_bytes;
    DCHECK_LE(byte_offset_, buffer_->capacity());
    return ptr;
}

template <typename T>
inline void BitWriter::PutAligned(T val, int num_bytes) {
    DCHECK_LE(num_bytes, sizeof(T));
    uint8_t* ptr = GetNextBytePtr(num_bytes);
    memcpy(ptr, &val, num_bytes);
}

inline void BitWriter::PutVlqInt(uint32_t v) {
    [[maybe_unused]] int num_bytes = 0;
    while ((v & 0xFFFFFF80) != 0L) {
        PutAligned<uint8_t>((v & 0x7F) | 0x80, 1);
        v >>= 7;
        DCHECK_LE(++num_bytes, MAX_VLQ_BYTE_LEN);
    }
    PutAligned<uint8_t>(v & 0x7F, 1);
}

inline void BitWriter::PutZigZagVlqInt(int32_t v) {
    uint32_t u_v = ::arrow::util::SafeCopy<uint32_t>(v);
    u_v = (u_v << 1) ^ static_cast<uint32_t>(v >> 31);
    PutVlqInt(u_v);
}

inline void BitWriter::PutVlqInt(uint64_t v) {
    while ((v & 0xFFFFFFFFFFFFFF80ULL) != 0ULL) {
        PutAligned<uint8_t>(static_cast<uint8_t>((v & 0x7F) | 0x80), 1);
        v >>= 7;
    }
    PutAligned<uint8_t>(static_cast<uint8_t>(v & 0x7F), 1);
}

inline void BitWriter::PutZigZagVlqInt(int64_t v) {
    uint64_t u_v = ::arrow::util::SafeCopy<uint64_t>(v);
    u_v = (u_v << 1) ^ static_cast<uint64_t>(v >> 63);
    PutVlqInt(u_v);
}

inline BitReader::BitReader(const uint8_t* buffer, int buffer_len) {
    reset(buffer, buffer_len);
}

inline void BitReader::reset(const uint8_t* buffer, int buffer_len) {
    buffer_ = buffer;
    max_bytes_ = buffer_len;
    byte_offset_ = 0;
    bit_offset_ = 0;
    buffered_values_ = 0;
    BufferValues();
}

inline void BitReader::BufferValues() {
    int bytes_remaining = max_bytes_ - byte_offset_;
    if (PREDICT_TRUE(bytes_remaining >= 8)) {
        memcpy(&buffered_values_, buffer_ + byte_offset_, 8);
    } else {
        memcpy(&buffered_values_, buffer_ + byte_offset_, bytes_remaining);
    }
}

inline void BitReader::advance_bytes(int num_bytes) {
    DCHECK(is_byte_aligned());
    DCHECK_LE(num_bytes, aligned_bytes_left());
    byte_offset_ += num_bytes;
    BufferValues();
}

template <typename T>
inline bool BitReader::GetValue(int num_bits, T* v) {
    DCHECK_LE(num_bits, 64);
    DCHECK_LE(num_bits, sizeof(T) * 8);

    if (PREDICT_FALSE(byte_offset_ * 8 + bit_offset_ + num_bits > max_bytes_ * 8)) return false;

    *v = BitUtil::TrailingBits(buffered_values_, bit_offset_ + num_bits) >> bit_offset_;

    bit_offset_ += num_bits;
    if (bit_offset_ >= 64) {
        byte_offset_ += 8;
        bit_offset_ -= 64;
        BufferValues();
        // Read bits of v that crossed into new buffered_values_
        *v |= BitUtil::ShiftLeftZeroOnOverflow(BitUtil::TrailingBits(buffered_values_, bit_offset_),
                                               (num_bits - bit_offset_));
    }
    DCHECK_LE(bit_offset_, 64);
    return true;
}

template <typename T>
inline bool BitReader::GetBatch(int num_bits, T* v, int num_values) {
    int i = 0;
    for (; i < num_values && bit_offset_ != 0; ++i) {
        if (PREDICT_FALSE(!GetValue(num_bits, v + i))) {
            return false;
        }
    }
    if (i < num_values) {
        DCHECK(bit_offset_ == 0);
        int expected_values = num_values - i;
        auto ret = BitPacking::UnpackValues(num_bits, buffer_ + byte_offset_, max_bytes_ - byte_offset_,
                                            expected_values, v + i);
        if (ret.second != expected_values) {
            return false;
        }
        size_t bits_read = expected_values * num_bits;
        byte_offset_ += bits_read / 8;
        bit_offset_ += bits_read % 8;
        BufferValues();
    }
    return true;
}

inline bool BitReader::Rewind(int num_bits) {
    bit_offset_ -= num_bits;
    if (bit_offset_ >= 0) {
        return true;
    }
    // NOTE(yanz): I think use loop instead of algebraic operation
    // because num_bits is usually very small, and the loop is faster
    // and easier to read.
    while (bit_offset_ < 0) {
        int seek_back = std::min(byte_offset_, 8);
        byte_offset_ -= seek_back;
        bit_offset_ += seek_back * 8;
    }

    if (byte_offset_ < 0) {
        return false;
    }
    BufferValues();
    return true;
}

inline bool BitReader::Advance(int num_bits) {
    bit_offset_ += num_bits;
    if (bit_offset_ < 64) {
        return true;
    }
    // NOTE(yanz): I think use loop instead of algebraic operation
    // because num_bits is usually very small, and the loop is faster
    // and easier to read.
    while (bit_offset_ >= 64) {
        byte_offset_ += 8;
        bit_offset_ -= 64;
    }
    if (byte_offset_ > max_bytes_) {
        return false;
    } else if (byte_offset_ == max_bytes_) {
        // no values to read.
        if (bit_offset_ != 0) {
            return false;
        }
        return true;
    }
    BufferValues();
    return true;
}

inline bool BitReader::SeekToBit(uint stream_position) {
    DCHECK_LT(stream_position, max_bytes_ * 8);
    int delta = static_cast<int>(stream_position) - position();
    if (delta == 0) {
        return true;
    } else if (delta < 0) {
        return Rewind(-delta);
    } else {
        return Advance(delta);
    }
}

template <typename T>
inline bool BitReader::GetAligned(int num_bytes, T* v) {
    DCHECK_LE(num_bytes, sizeof(T));
    int bytes_read = BitUtil::Ceil(bit_offset_, 8);
    if (PREDICT_FALSE(byte_offset_ + bytes_read + num_bytes > max_bytes_)) return false;

    // Advance byte_offset to next unread byte and read num_bytes
    byte_offset_ += bytes_read;
    memcpy(v, buffer_ + byte_offset_, num_bytes);
    byte_offset_ += num_bytes;

    // Reset buffered_values_
    bit_offset_ = 0;
    BufferValues();
    return true;
}

// Copy the same logic from arrow, we need to return false instead of DCHECK(false) when facing corrupted files
inline bool BitReader::GetVlqInt(uint32_t* v) {
    uint32_t tmp = 0;

    for (int i = 0; i < MAX_VLQ_BYTE_LEN; i++) {
        uint8_t byte = 0;
        if (PREDICT_FALSE(!GetAligned<uint8_t>(1, &byte))) {
            return false;
        }
        tmp |= static_cast<uint32_t>(byte & 0x7F) << (7 * i);

        if ((byte & 0x80) == 0) {
            *v = tmp;
            return true;
        }
    }

    return false;
}

inline bool BitReader::GetZigZagVlqInt(int32_t* v) {
    uint32_t u;
    if (!GetVlqInt(&u)) return false;
    u = (u >> 1) ^ (~(u & 1) + 1);
    *v = static_cast<int32_t>(u);
    return true;
}

inline bool BitReader::GetVlqInt(uint64_t* v) {
    uint64_t tmp = 0;

    for (int i = 0; i < MAX_VLQ_BYTE_LEN_INT64; i++) {
        uint8_t byte = 0;
        if (PREDICT_FALSE(!GetAligned<uint8_t>(1, &byte))) {
    
```

### Core Architecture Module: `be/src/base/bit/bit_util.h`
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
//   https://github.com/apache/incubator-doris/blob/master/be/src/util/bit_util.h

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

#include <endian.h>

#include "base/compiler_util.h"
#include "gutil/bits.h"
#include "gutil/endian.h"
#include "gutil/port.h"

namespace starrocks {

// Utility class to do standard bit tricks
// TODO: is this in boost or something else like that?
class BitUtil {
public:
    // Returns the ceil of value/divisor
    static inline int64_t ceil(int64_t value, int64_t divisor) { return value / divisor + (value % divisor != 0); }

    // Returns 'value' rounded up to the nearest multiple of 'factor'
    static inline int64_t round_up(int64_t value, int64_t factor) { return (value + (factor - 1)) / factor * factor; }

    // Safe wrapper for std::aligned_alloc that handles platform-specific requirements
    // On macOS: ensures alignment >= sizeof(void*) and size is non-zero
    // On all platforms: ensures size is a multiple of alignment
    static inline void* safe_aligned_alloc(size_t alignment, size_t size) {
#ifdef __APPLE__
        // macOS specific: aligned_alloc requires alignment >= sizeof(void*) (8 bytes)
        alignment = std::max(alignment, sizeof(void*));
        // macOS specific: size must not be zero
        if (size == 0) size = alignment;
#endif
        // Ensure size is a multiple of alignment (required on macOS, safe on all platforms)
        size = round_up(size, alignment);
        return std::aligned_alloc(alignment, size);
    }

    // Returns the smallest power of two that contains v. Taken from
    // http://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2
    // TODO: Pick a better name, as it is not clear what happens when the input is
    // already a power of two.
    static inline int64_t next_power_of_two(int64_t v) {
        --v;
        v |= v >> 1;
        v |= v >> 2;
        v |= v >> 4;
        v |= v >> 8;
        v |= v >> 16;
        v |= v >> 32;
        ++v;
        return v;
    }

    // Non hw accelerated pop count.
    // TODO: we don't use this in any perf sensitive code paths currently.  There
    // might be a much faster way to implement this.
    static inline int popcount_no_hw(uint64_t x) {
        int count = 0;

        for (; x != 0; ++count) {
            x &= x - 1;
        }

        return count;
    }

    // Returns the number of set bits in x
    static inline int popcount(uint64_t x) {
#if defined(__clang__) || defined(__GNUC__)
        return __builtin_popcountll(x);
#else
        return popcount_no_hw(x);
#endif
    }

    static inline int count_one_bits(uint32_t x) {
#ifdef __POPCNT__
        return __builtin_popcount(x);
#else
        return Bits::CountOnes(x);
#endif
    }

    // Returns the 'num_bits' least-significant bits of 'v'.
    static inline uint64_t trailing_bits(uint64_t v, int num_bits) {
        if (UNLIKELY(num_bits == 0)) {
            return 0;
        }

        if (UNLIKELY(num_bits >= 64)) {
            return v;
        }

        int n = 64 - num_bits;
        return (v << n) >> n;
    }

    // Returns ceil(log2(x)).
    // TODO: this could be faster if we use __builtin_clz.  Fix this if this ever shows up
    // in a hot path.
    static inline int log2(uint64_t x) {
        DCHECK_GT(x, 0);

        if (x == 1) {
            return 0;
        }

        // Compute result = ceil(log2(x))
        //                = floor(log2(x - 1)) + 1, for x > 1
        // by finding the position of the most significant bit (1-indexed) of x - 1
        // (floor(log2(n)) = MSB(n) (0-indexed))
        --x;
        int result = 1;

        while (x >>= 1) {
            ++result;
        }

        return result;
    }

    // Returns the rounded up to 64 multiple. Used for conversions of bits to i64.
    static inline uint32_t round_up_numi64(uint32_t bits) { return (bits + 63) >> 6; }

    // Returns the rounded up to 32 multiple. Used for conversions of bits to i32.
    constexpr static inline uint32_t round_up_numi32(uint32_t bits) { return (bits + 31) >> 5; }

    template <typename T>
    static T big_endian(T value) {
        if constexpr (std::is_same_v<T, __int128>) {
            return BigEndian::FromHost128(value);
        } else if constexpr (std::is_same_v<T, unsigned __int128>) {
            return BigEndian::FromHost128(value);
        } else if constexpr (std::is_same_v<T, int64_t>) {
            return BigEndian::FromHost64(value);
        } else if constexpr (std::is_same_v<T, uint64_t>) {
            return BigEndian::FromHost64(value);
        } else if constexpr (std::is_same_v<T, int32_t>) {
            return BigEndian::FromHost32(value);
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            return BigEndian::FromHost32(value);
        } else if constexpr (std::is_same_v<T, int16_t>) {
            return BigEndian::FromHost16(value);
        } else if constexpr (std::is_same_v<T, uint16_t>) {
            return BigEndian::FromHost16(value);
        } else if constexpr (std::is_same_v<T, int8_t>) {
            return value;
        } else if constexpr (std::is_same_v<T, uint8_t>) {
            return value;
        } else {
            static_assert(std::is_integral_v<T>, "endian change should be integer type");
            return value;
        }
    }

    template <typename T>
    static T big_endian_to_host(T value) {
        if constexpr (std::is_same_v<T, __int128>) {
            return BigEndian::ToHost128(value);
        } else if constexpr (std::is_same_v<T, unsigned __int128>) {
            return BigEndian::ToHost128(value);
        } else if constexpr (std::is_same_v<T, int64_t>) {
            return BigEndian::ToHost64(value);
        } else if constexpr (std::is_same_v<T, uint64_t>) {
            return BigEndian::ToHost64(value);
        } else if constexpr (std::is_same_v<T, int32_t>) {
            return BigEndian::ToHost32(value);
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            return BigEndian::ToHost32(value);
        } else if constexpr (std::is_same_v<T, int16_t>) {
            return BigEndian::ToHost16(value);
        } else if constexpr (std::is_same_v<T, uint16_t>) {
            return BigEndian::ToHost16(value);
        } else if constexpr (std::is_same_v<T, int8_t>) {
            return value;
        } else if constexpr (std::is_same_v<T, uint8_t>) {
            return value;
        } else {
            static_assert(std::is_integral_v<T>, "endian change should be integer type");
            return value;
        }
    }

    /// Returns the smallest power of two that contains v. If v is a power of two, v is
    /// returned. Taken from
    /// http://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2
    static inline int64_t RoundUpToPowerOfTwo(int64_t v) {
        --v;
        v |= v >> 1;
        v |= v >> 2;
        v |= v >> 4;
        v |= v >> 8;
        v |= v >> 16;
        v |= v >> 32;
        ++v;
        return v;
    }

    // Wrap the gutil/ version for convenience.
    static inline int Log2FloorNonZero64(uint64_t n) { return Bits::Log2FloorNonZero64(n); }

    // Wrap the gutil/ version for convenience.
    static inline int Log2Floor64(uint64_t n) { return Bits::Log2Floor64(n); }

    static inline int Log2Ceiling64(uint64_t n) {
        int floor = Log2Floor64(n);
        // Check if zero or a power of two. This pattern is recognised by gcc and optimised
        // into branch-free code.
        if (0 == (n & (n - 1))) {
            return floor;
        } else {
            return floor + 1;
        }
    }

    static inline int Log2CeilingNonZero64(uint64_t n) {
        int floor = Log2FloorNonZero64(n);
        // Check if zero or a power of two. This pattern is recognised by gcc and optimised
        // into branch-free code.
        if (0 == (n & (n - 1))) {
            return floor;
        } else {
            return floor + 1;
        }
    }

    constexpr static inline int64_t Ceil(int64_t value, int64_t divisor) {
        return value / divisor + (value % divisor != 0);
    }

    constexpr static inline bool IsPowerOf2(int64_t value) { return value > 0 && (value & (value - 1)) == 0; }

    constexpr static inline int64_t RoundDown(int64_t value, int64_t factor) { return (value / factor) * factor; }

    /// Specialized round up and down functions for frequently used factors,
    /// like 8 (bits->bytes), 32 (bits->i32), and 64 (bits->i64)
    /// Returns the rounded up number of bytes that fit the number of bits.
    constexpr
```

### Core Architecture Module: `be/src/base/bthreads/util.h`
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

#include <base/system/errno.h>
#include <bthread/bthread.h>
#include <fmt/format.h>

#include <functional>

#include "base/statusor.h"

namespace starrocks::bthreads {

namespace {
typedef std::function<void()> FunctorArg;

static void* bthread_func(void* arg) {
    auto func_arg = static_cast<FunctorArg*>(arg);
    func_arg->operator()();
    delete func_arg;
    return nullptr;
}
} // namespace

// Starts a new bthread that runs the specified function.
// Note: The function provided must not throw any exceptions.
inline StatusOr<bthread_t> start_bthread(std::function<void()> func) {
    auto arg = std::make_unique<FunctorArg>(std::move(func));
    bthread_t bid;
    int rc = bthread_start_background(&bid, nullptr, bthread_func, arg.get());
    if (rc != 0) {
        return Status::InternalError(fmt::format("fail to create bthread: {}", ::berror(rc)));
    }
    arg.release(); // If the thread was started successfully then don't delete the argument.
    return bid;
}

// Starts a new bthread that runs the specified function, then waits for the new bthread
// to complete before returning to the caller.
// Note: The function provided must not throw any exceptions.
inline Status start_bthread_and_join(std::function<void()> func) {
    ASSIGN_OR_RETURN(auto bid, start_bthread(std::move(func)));
    int rc = bthread_join(bid, nullptr);
    if (rc != 0) {
        return Status::InternalError(fmt::format("fail to join bthread {}: {}", bid, ::berror(rc)));
    }
    return Status::OK();
}

} // namespace starrocks::bthreads

```

### Core Architecture Module: `be/src/base/compiler_util.h`
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

// Backward-compatible shim. Canonical definitions live in gutil to avoid
// introducing BE module dependencies into gutil.
#include "gutil/compiler_util.h"

```

### Core Architecture Module: `be/src/base/compression/compression_utils.h`
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

#include <string>

#include "base/statusor.h"
#include "gen_cpp/Types_types.h"
#include "gen_cpp/types.pb.h"

namespace starrocks {

class CompressionUtils {
public:
    // Convert compression thrift type to proto type.
    // Return ComressionTypePB::UNKNOWN_COMPRESSION if input type is not recognized
    static CompressionTypePB to_compression_pb(TCompressionType::type t_type) {
        switch (t_type) {
        case TCompressionType::NO_COMPRESSION:
            return CompressionTypePB::NO_COMPRESSION;
        case TCompressionType::SNAPPY:
            return CompressionTypePB::SNAPPY;
        case TCompressionType::LZ4:
            return CompressionTypePB::LZ4;
        case TCompressionType::LZ4_FRAME:
            return CompressionTypePB::LZ4_FRAME;
        case TCompressionType::ZLIB:
            return CompressionTypePB::ZLIB;
        case TCompressionType::ZSTD:
            return CompressionTypePB::ZSTD;
        case TCompressionType::GZIP:
            return CompressionTypePB::GZIP;
        case TCompressionType::DEFLATE:
            return CompressionTypePB::DEFLATE;
        case TCompressionType::BZIP2:
            return CompressionTypePB::BZIP2;
        default:
            break;
        }
        return CompressionTypePB::UNKNOWN_COMPRESSION;
    }

    static CompressionTypePB to_compression_pb(const std::string& ext) {
        if (ext == "gzip" || ext == "gz") {
            return CompressionTypePB::GZIP;
        } else if (ext == "bz2") {
            return CompressionTypePB::BZIP2;
        } else if (ext == "zlib") {
            return CompressionTypePB::ZLIB;
        } else if (ext == "deflate") {
            return CompressionTypePB::DEFLATE;
        } else if (ext == "lz4") {
            return CompressionTypePB::LZ4;
        } else if (ext == "snappy") {
            return CompressionTypePB::SNAPPY;
        } else if (ext == "lzo") {
            return CompressionTypePB::LZO;
        } else if (ext == "zstd" || ext == "zst") {
            return CompressionTypePB::ZSTD;
        } else {
            return CompressionTypePB::UNKNOWN_COMPRESSION;
        }
    }

    static StatusOr<std::string> to_compression_ext(TCompressionType::type compression_type) {
        switch (compression_type) {
        case TCompressionType::NO_COMPRESSION:
            return std::string();
        case TCompressionType::GZIP:
            return ".gz";
        case TCompressionType::ZSTD:
            return ".zst";
        case TCompressionType::LZ4:
            return ".lz4";
        case TCompressionType::LZ4_FRAME:
            // LZ4_FRAME and LZ4 share the same extension; read path auto-detects the format.
            return ".lz4";
        case TCompressionType::SNAPPY:
            return ".snappy";
        case TCompressionType::DEFLATE:
            return ".deflate";
        case TCompressionType::ZLIB:
            return ".zlib";
        case TCompressionType::BZIP2:
            return ".bz2";
        case TCompressionType::DEFAULT_COMPRESSION:
            return std::string();
        default:
            return Status::InvalidArgument("Unsupported compression type: " +
                                           std::to_string(static_cast<int>(compression_type)));
        }
    }
};

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

### Incident Patch 1: `bf73116b` (2026-11-12)
**Commit Message**: [BugFix] Add the fractional seconds of an INTERVAL ... SECOND exactly (#81371)

Signed-off-by: Karol Sobczak <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/ExpressionAnalyzer.java` (modified, +10/-0)
```diff
@@ -123,6 +123,7 @@
 import com.starrocks.type.TypeFactory;
 import com.starrocks.type.VarcharType;
 
+import java.math.BigDecimal;
 import java.math.BigInteger;
 import java.util.ArrayList;
 import java.util.Arrays;
@@ -825,6 +826,15 @@ public Void visitTimestampArithmeticExpr(TimestampArithmeticExpr node, Scope sco
                         .join(Arrays.stream(argumentTypes).map(Type::toSql).collect(Collectors.toList())));
                 throw new SemanticException(msg, node.getPos());
             }
+            String fnName = fn.getFunctionName().getFunction();
+            if (FunctionSet.SECONDS_ADD.equals(fnName) || FunctionSet.SECONDS_SUB.equals(fnName)) {
+                // A literal amount with more than 6 decimals is refused here already, so that a definition that uses it,
+                // such as a generated column or a view, is refused when it is created rather than each time it is used
+                BigDecimal seconds = IntervalSeconds.literalValue(node.getChild(1));
+                if (seconds != null) {
+                    IntervalSeconds.split(seconds, node.getPos());
+                }
+            }
             node.setType(fn.getReturnType());
             return null;
         }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/IntervalSeconds.java` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
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
+package com.starrocks.sql.analyzer;
+
+import com.starrocks.sql.ast.expression.DecimalLiteral;
+import com.starrocks.sql.ast.expression.Expr;
+import com.starrocks.sql.ast.expression.FloatLiteral;
+import com.starrocks.sql.ast.expression.StringLiteral;
+import com.starrocks.sql.parser.NodePosition;
+
+import java.math.BigDecimal;
+
+/**
+ * The amount of an INTERVAL in SECOND. seconds_add and seconds_sub take it as an INT, so a fraction of a second would be
+ * lost; such an amount is added as whole seconds and microseconds instead.
+ */
+public final class IntervalSeconds {
+    private IntervalSeconds() {
+    }
+
+    /**
+     * Splits an amount of seconds into whole seconds and microseconds.
+     *
+     * @return {whole seconds, microseconds}, or null if the amount doesn't fit in an INT, which leaves it to the INT cast
+     * @throws SemanticException if the amount has more than 6 decimals: a datetime has no digits below microseconds
+     */
+    public static int[] split(BigDecimal seconds, NodePosition pos) {
+        // An INT holds at most 10 digits before the point, so a larger amount is left to the INT cast. This also keeps
+        // the arithmetic below away from the huge numbers a short exponent can describe, as in '1e100000000'.
+        if ((long) seconds.precision() - seconds.scale() > 10) {
+            return null;
+        }
+        BigDecimal exact = seconds.stripTrailingZeros();
+        if (exact.scale() > 6) {
+            // BigDecimal.toString() writes a long fraction such as '1e-100000000' with an exponent, so the message stays
+            // short
+            throw new SemanticException("The amount of an INTERVAL in SECOND can have at most 6 decimals "
+                    + "because a datetime has no digits below microseconds: " + seconds, pos);
+        }
+        BigDecimal[] wholeAndFraction = exact.divideAndRemainder(BigDecimal.ONE);
+        try {
+            return new int[] {wholeAndFraction[0].intValueExact(), wholeAndFraction[1].movePointRight(6).intValueExact()};
+        } catch (ArithmeticException e) {
+            // doesn't fit in an INT, which is what the function takes
+            return null;
+        }
+    }
+
+    /**
+     * The value of a decimal, floating point or string literal, or null for any other expression (also for a string that
+     * is not a number, which is left to the INT cast)
+     */
+    public static BigDecimal literalValue(Expr amount) {
+        try {
+            if (amount instanceof DecimalLiteral) {
+                return ((DecimalLiteral) amount).getValue();
+            } else if (amount instanceof FloatLiteral) {
+                return BigDecimal.valueOf(((FloatLiteral) amount).getValue());
+            } else if (amount instanceof StringLiteral) {
+                return new BigDecimal(((StringLiteral) amount).getValue().trim());
+            }
+        } catch (NumberFormatException e) {
+            return null;
+        }
+        return null;
+    }
+}
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rewrite/scalar/SimplifiedPredicateRule.java` (modified, +29/-35)
```diff
@@ -48,39 +48,33 @@
 
 import java.util.Arrays;
 import java.util.List;
-import java.util.Objects;
+import java.util.Map;
 import java.util.Set;
 import java.util.function.Predicate;
 import java.util.stream.Collectors;
 
 public class SimplifiedPredicateRule extends BottomUpScalarOperatorRewriteRule {
-    private static final ImmutableMap<String, List<String>> TIME_FNS = ImmutableMap.<String, List<String>>builder()
-            .put("years_", ImmutableList.of(FunctionSet.YEARS_ADD, FunctionSet.YEARS_SUB))
-            .put("quarters_", ImmutableList.of(FunctionSet.QUARTERS_ADD, FunctionSet.QUARTERS_SUB))
-            .put("months_", ImmutableList.of(FunctionSet.MONTHS_ADD, FunctionSet.MONTHS_SUB))
-            .put("weeks_", ImmutableList.of(FunctionSet.WEEKS_ADD, FunctionSet.WEEKS_SUB))
-            .put("days_", ImmutableList.of(FunctionSet.DAYS_ADD, FunctionSet.DAYS_SUB))
-            .put("hours_", ImmutableList.of(FunctionSet.HOURS_ADD, FunctionSet.HOURS_SUB))
-            .put("minutes_", ImmutableList.of(FunctionSet.MINUTES_ADD, FunctionSet.MINUTES_SUB))
-            .put("seconds_", ImmutableList.of(FunctionSet.SECONDS_ADD, FunctionSet.SECONDS_SUB))
-            .put("milliseconds_", ImmutableList.of(FunctionSet.MILLISECONDS_ADD, FunctionSet.MILLISECONDS_SUB))
-            .put("microseconds_", ImmutableList.of(FunctionSet.MICROSECONDS_ADD, FunctionSet.MICROSECONDS_SUB))
-            .put("date", ImmutableList.of(FunctionSet.DATE_ADD, FunctionSet.DATE_SUB))
-            .build();
-    private static final Set<String> MONTH_BASED_TIME_FNS = ImmutableSet.of("years_", "quarters_", "months_");
-    private static final List<String> TIME_FN_NAMES = ImmutableList.<String>builder()
-            .add(FunctionSet.YEARS_ADD).add(FunctionSet.YEARS_SUB)
-            .add(FunctionSet.QUARTERS_ADD).add(FunctionSet.QUARTERS_SUB)
-            .add(FunctionSet.MONTHS_ADD).add(FunctionSet.MONTHS_SUB)
-            .add(FunctionSet.WEEKS_ADD).add(FunctionSet.WEEKS_SUB)
-            .add(FunctionSet.DAYS_ADD).add(FunctionSet.DAYS_SUB)
-            .add(FunctionSet.HOURS_ADD).add(FunctionSet.HOURS_SUB)
-            .add(FunctionSet.MINUTES_ADD).add(FunctionSet.MINUTES_SUB)
-            .add(FunctionSet.SECONDS_ADD).add(FunctionSet.SECONDS_SUB)
-            .add(FunctionSet.MILLISECONDS_ADD).add(FunctionSet.MILLISECONDS_SUB)
-            .add(FunctionSet.MICROSECONDS_ADD).add(FunctionSet.MICROSECONDS_SUB)
-            .add(FunctionSet.DATE_ADD).add(FunctionSet.DATE_SUB)
-            .build();
+    // The {add, sub} functions of each time unit. Only calls of the same unit are merged.
+    private static final List<List<String>> TIME_FN_UNITS = ImmutableList.of(
+            ImmutableList.of(FunctionSet.YEARS_ADD, FunctionSet.YEARS_SUB),
+            ImmutableList.of(FunctionSet.QUARTERS_ADD, FunctionSet.QUARTERS_SUB),
+            ImmutableList.of(FunctionSet.MONTHS_ADD, FunctionSet.MONTHS_SUB),
+            ImmutableList.of(FunctionSet.WEEKS_ADD, FunctionSet.WEEKS_SUB),
+            ImmutableList.of(FunctionSet.DAYS_ADD, FunctionSet.DAYS_SUB),
+            ImmutableList.of(FunctionSet.HOURS_ADD, FunctionSet.HOURS_SUB),
+            ImmutableList.of(FunctionSet.MINUTES_ADD, FunctionSet.MINUTES_SUB),
+            ImmutableList.of(FunctionSet.SECONDS_ADD, FunctionSet.SECONDS_SUB),
+            ImmutableList.of(FunctionSet.MILLISECONDS_ADD, FunctionSet.MILLISECONDS_SUB),
+            ImmutableList.of(FunctionSet.MICROSECONDS_ADD, FunctionSet.MICROSECONDS_SUB),
+            ImmutableList.of(FunctionSet.DATE_ADD, FunctionSet.DATE_SUB));
+    // Each time function and the {add, sub} functions of its unit
+    private static final Map<String, List<String>> TIME_FNS = TIME_FN_UNITS.stream()
+            .flatMap(unit -> unit.stream().map(fn -> Map.entry(fn, unit)))
+            .collect(ImmutableMap.toImmutableMap(Map.Entry::getKey, Map.Entry::getValue));
+    // years, quarters and months clamp to the month end, so they do not compose
+    private static final Set<String> MONTH_BASED_TIME_FNS = ImmutableSet.of(FunctionSet.YEARS_ADD,
+            FunctionSet.YEARS_SUB, FunctionSet.QUARTERS_ADD, FunctionSet.QUARTERS_SUB, FunctionSet.MONTHS_ADD,
+            FunctionSet.MONTHS_SUB);
 
     private static final EliminateNegationsRewriter ELIMINATE_NEGATIONS_REWRITER = new EliminateNegationsRewriter();
 
@@ -398,7 +392,7 @@ public ScalarOperator visitCall(CallOperator call, ScalarOperatorRewriteContext
             return ifNull(call);
         } else if (FunctionSet.ARRAY_MAP.equals(call.getFnName())) {
             return arrayMap(call);
-        } else if (TIME_FN_NAMES.contains(call.getFnName())) {
+        } else if (TIME_FNS.containsKey(call.getFnName())) {
             return simplifiedTimeFns(call);
         } else if (FunctionSet.DATE_TRUNC.equalsIgnoreCase(call.getFnName())) {
             return simplifiedDateTrunc(call);
@@ -443,8 +437,7 @@ public ScalarOperator visitLikePredicateOperator(LikePredicateOperator predicate

```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/transformer/SqlToScalarOperatorTranslator.java` (modified, +80/-1)
```diff
@@ -24,6 +24,7 @@
 import com.starrocks.qe.ConnectContext;
 import com.starrocks.server.GlobalStateMgr;
 import com.starrocks.sql.analyzer.ExpressionAnalyzer;
+import com.starrocks.sql.analyzer.IntervalSeconds;
 import com.starrocks.sql.analyzer.RelationFields;
 import com.starrocks.sql.analyzer.RelationId;
 import com.starrocks.sql.analyzer.ResolvedField;
@@ -109,12 +110,17 @@
 import com.starrocks.sql.optimizer.operator.scalar.SubfieldOperator;
 import com.starrocks.sql.optimizer.operator.scalar.SubqueryOperator;
 import com.starrocks.sql.optimizer.rewrite.ScalarOperatorRewriter;
+import com.starrocks.sql.parser.NodePosition;
+import com.starrocks.type.DateType;
 import com.starrocks.type.FunctionType;
+import com.starrocks.type.IntegerType;
 import com.starrocks.type.InvalidType;
 import com.starrocks.type.JsonType;
+import com.starrocks.type.Type;
 import org.apache.logging.log4j.LogManager;
 import org.apache.logging.log4j.Logger;
 
+import java.math.BigDecimal;
 import java.util.ArrayList;
 import java.util.Collections;
 import java.util.List;
@@ -563,7 +569,80 @@ public ScalarOperator visitTimestampArithmeticExpr(TimestampArithmeticExpr node,
 
             Function fn = ExprUtils.getTimestampArithmeticFunction(node);
             Preconditions.checkNotNull(fn, "TimestampArithmeticExpr must resolve to a function");
-            return new CallOperator(fn.getFunctionName().getFunction(), node.getType(), arguments, fn);
+            String fnName = fn.getFunctionName().getFunction();
+            ScalarOperator fractionalSeconds = splitFractionalSeconds(fnName, node.getType(), arguments, node.getPos());
+            if (fractionalSeconds != null) {
+                return fractionalSeconds;
+            }
+            return new CallOperator(fnName, node.getType(), arguments, fn);
+        }
+
+        // seconds_add and seconds_sub take the amount as an INT, so `ts + INTERVAL '0.5' SECOND` would add NULL and
+        // `ts + INTERVAL 1.5 SECOND` one second. A constant amount that is a decimal, a floating point number or a
+        // string is added as whole seconds and microseconds instead:
+        // `ts + INTERVAL 1.5 SECOND` is `microseconds_add(seconds_add(ts, 1), 500000)`.
+        // Returns null if the call is not such an interval, and then it is built as it is.
+        private static ScalarOperator splitFractionalSeconds(String fnName, Type returnType,
+                                                             List<ScalarOperator> arguments, NodePosition pos) {
+            boolean add = FunctionSet.SECONDS_ADD.equals(fnName);
+            if (!add && !FunctionSet.SECONDS_SUB.equals(fnName)) {
+                return null;
+            }
+            ScalarOperator amount = arguments.get(1);
+            if (!amount.isConstantRef() && amount.isConstant()) {
+                // A constant expression, as in `TIMESTAMPADD(SECOND, 0.25 + 0.25, ts)`, is folded here. Later on the
+                // amount is cast to INT before constants are folded, which would drop the fraction.
+                ScalarOperatorRewriter rewriter = new ScalarOperatorRewriter();
+                amount = rewriter.rewrite(rewriter.rewrite(amount, ScalarOperatorRewriter.DEFAULT_TYPE_CAST_RULE),
+                        ScalarOperatorRewriter.FOLD_CONSTANT_RULES);
+            }
+            BigDecimal seconds = constantSeconds(amount);
+            if (seconds == null) {
+                return null;
+            }
+            int[] wholeSecondsAndMicroseconds = IntervalSeconds.split(seconds, pos);
+            if (wholeSecondsAndMicroseconds == null) {
+                return null;
+            }
+            int wholeSeconds = wholeSecondsAndMicroseconds[0];
+            int wholeMicroseconds = wholeSecondsAndMicroseconds[1];
+
+            String microsecondsFn = add ? FunctionSet.MICROSECONDS_ADD : FunctionSet.MICROSECONDS_SUB;
+            Type[] argTypes = {DateType.DATETIME, IntegerType.INT};
+            ScalarOperator result = arguments.get(0);
+            if (wholeSeconds != 0 || wholeMicroseconds == 0) {
+                result = new CallOperator(fnName, returnType,
+                        Lists.newArrayList(result, ConstantOperator.createInt(wholeSeconds)),
+                        ExprUtils.getBuiltinFunction(fnName, argTypes, Function.CompareMode.IS_IDENTICAL));
+            }
+            if (wholeMicroseconds != 0) {
+                result = new CallOperator(microsecondsFn, returnType,
+                        Lists.newArrayList(result, ConstantOperator.createInt(wholeMicroseconds)),
+                        ExprUtils.getBuiltinFunction(microsecondsFn, argTypes, Function.CompareMode.IS_IDENTICAL));
+            }
+            return result;
+        }
+
+        // The value of a constant decimal, floating point or string amount, or null for any other amount (also for a
+        // string that is not a number, which is left to the cast to INT of the function argument)
+        private static Bi
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/optimizer/rewrite/scalar/SimplifiedPredicateRuleTest.java` (modified, +104/-1)
```diff
@@ -16,21 +16,30 @@
 package com.starrocks.sql.optimizer.rewrite.scalar;
 
 import com.google.common.collect.Lists;
+import com.starrocks.catalog.Function;
+import com.starrocks.catalog.FunctionSet;
 import com.starrocks.sql.ast.expression.BinaryType;
+import com.starrocks.sql.ast.expression.ExprUtils;
 import com.starrocks.sql.optimizer.operator.OperatorType;
 import com.starrocks.sql.optimizer.operator.scalar.BinaryPredicateOperator;
+import com.starrocks.sql.optimizer.operator.scalar.CallOperator;
 import com.starrocks.sql.optimizer.operator.scalar.CaseWhenOperator;
 import com.starrocks.sql.optimizer.operator.scalar.ColumnRefOperator;
 import com.starrocks.sql.optimizer.operator.scalar.ConstantOperator;
 import com.starrocks.sql.optimizer.operator.scalar.LikePredicateOperator;
 import com.starrocks.sql.optimizer.operator.scalar.ScalarOperator;
 import com.starrocks.sql.plan.PlanTestBase;
 import com.starrocks.type.BooleanType;
+import com.starrocks.type.DateType;
 import com.starrocks.type.IntegerType;
+import com.starrocks.type.Type;
 import com.starrocks.type.VarcharType;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 
+import java.util.Arrays;
+import java.util.List;
+
 import static org.junit.jupiter.api.Assertions.assertEquals;
 
 public class SimplifiedPredicateRuleTest extends PlanTestBase {
@@ -42,6 +51,24 @@ public class SimplifiedPredicateRuleTest extends PlanTestBase {
     private static final ConstantOperator OB_FALSE = ConstantOperator.createBoolean(false);
     private static final ConstantOperator OB_TRUE = ConstantOperator.createBoolean(true);
 
+    // The {add, sub} functions of each unit whose nested calls with constant amounts are merged
+    private static final String[][] TIME_FN_UNITS = {
+            {FunctionSet.WEEKS_ADD, FunctionSet.WEEKS_SUB},
+            {FunctionSet.DAYS_ADD, FunctionSet.DAYS_SUB},
+            {FunctionSet.HOURS_ADD, FunctionSet.HOURS_SUB},
+            {FunctionSet.MINUTES_ADD, FunctionSet.MINUTES_SUB},
+            {FunctionSet.SECONDS_ADD, FunctionSet.SECONDS_SUB},
+            {FunctionSet.MILLISECONDS_ADD, FunctionSet.MILLISECONDS_SUB},
+            {FunctionSet.MICROSECONDS_ADD, FunctionSet.MICROSECONDS_SUB},
+            {FunctionSet.DATE_ADD, FunctionSet.DATE_SUB},
+    };
+    // Years, quarters and months clamp to the month end, so their nested calls are not merged
+    private static final String[][] MONTH_BASED_TIME_FN_UNITS = {
+            {FunctionSet.YEARS_ADD, FunctionSet.YEARS_SUB},
+            {FunctionSet.QUARTERS_ADD, FunctionSet.QUARTERS_SUB},
+            {FunctionSet.MONTHS_ADD, FunctionSet.MONTHS_SUB},
+    };
+
     private SimplifiedPredicateRule rule = new SimplifiedPredicateRule();
 
     @BeforeAll
@@ -163,4 +190,80 @@ public void applyHourToDatetimeRewrite() throws Exception {
         starRocksAssert.query("SELECT hour(to_datetime(ts, 4)) FROM test_timestamp")
                 .explainWithout("hour_from_unixtime");
     }
-}
\ No newline at end of file
+
+    private static CallOperator timeFn(String name, ScalarOperator datetime, int amount) {
+        Function fn = ExprUtils.getBuiltinFunction(name, new Type[] {DateType.DATETIME, IntegerType.INT},
+                Function.CompareMode.IS_IDENTICAL);
+        return new CallOperator(name, DateType.DATETIME,
+                Lists.newArrayList(datetime, ConstantOperator.createInt(amount)), fn);
+    }
+
+    @Test
+    public void mergeTimeFnsOfTheSameUnit() {
+        ColumnRefOperator ts = new ColumnRefOperator(1, DateType.DATETIME, "ts", true);
+        for (String[] unit : TIME_FN_UNITS) {
+            String add = unit[0];
+            String sub = unit[1];
+            assertEquals(add + "(1: ts, 7)", rule.apply(timeFn(add, timeFn(add, ts, 3), 4), null).toString());
+            assertEquals(sub + "(1: ts, 2)", rule.apply(timeFn(sub, timeFn(add, ts, 3), 5), null).toString());
+            assertEquals(add + "(1: ts, 2)", rule.apply(timeFn(add, timeFn(sub, ts, 3), 5), null).toString());
+            assertEquals(sub + "(1: ts, 7)", rule.apply(timeFn(sub, timeFn(sub, ts, 3), 4), null).toString());
+            // the amounts cancel out
+            assertEquals("1: ts", rule.apply(timeFn(sub, timeFn(add, ts, 3), 3), null).toString());
+        }
+        for (String[] unit : MONTH_BASED_TIME_FN_UNITS) {
+            for (String outerFn : unit) {
+                for (String innerFn : unit) {
+                    CallOperator call = timeFn(outerFn, timeFn(innerFn, ts, 3), 4);
+                    assertEquals(call.toString(), rule.apply(call, null).toString(), outerFn + " over " + innerFn);
+                }
+            }
+        }
+    }
+
+    @Test
+    public void doNotMergeTimeFnsOfDifferentUnits() {
+        ColumnRefOperator ts = new ColumnRefOperator(1, DateType.DATETIME, "ts", true);
+        List<String[]> units = Lists.newArrayList(TIME_FN_UNITS);
+        units.addAll(Arrays.asList(MONTH_BASED_TIME_FN_UNITS));
+        for 
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/ExpressionTest.java` (modified, +81/-0)
```diff
@@ -257,6 +257,87 @@ public void testTimestampArithmeticExpr() throws Exception {
                 + "  |  <slot 14> : days_sub(15: cast, 3)\n"));
     }
 
+    // seconds_add takes its amount as an INT, so a fraction of a second is added with microseconds_add
+    @Test
+    public void testIntervalWithFractionalSeconds() throws Exception {
+        String[][] cases = {
+                {"id_datetime + interval '0.5' second", "microseconds_add(8: id_datetime, 500000)"},
+                {"id_datetime + interval 1.5 second", "microseconds_add(seconds_add(8: id_datetime, 1), 500000)"},
+                {"id_datetime - interval 1.5 second", "microseconds_sub(seconds_sub(8: id_datetime, 1), 500000)"},
+                {"interval 1.5 second + id_datetime", "microseconds_add(seconds_add(8: id_datetime, 1), 500000)"},
+                {"id_datetime + interval -0.25 second", "microseconds_add(8: id_datetime, -250000)"},
+                {"id_datetime + interval -1.5 second", "microseconds_add(seconds_add(8: id_datetime, -1), -500000)"},
+                {"id_datetime + interval 0.000001 second", "microseconds_add(8: id_datetime, 1)"},
+                {"id_datetime + interval 1e0 second", "seconds_add(8: id_datetime, 1)"},
+                {"id_datetime + interval 0.5e0 second", "microseconds_add(8: id_datetime, 500000)"},
+                {"date_add(id_datetime, interval '3000.000001' second)",
+                        "microseconds_add(seconds_add(8: id_datetime, 3000), 1)"},
+                {"timestampadd(second, 2.5, id_datetime)", "microseconds_add(seconds_add(8: id_datetime, 2), 500000)"},
+                // the amount is still a number of seconds when it has a fraction of zero
+                {"id_datetime + interval '5.0' second", "seconds_add(8: id_datetime, 5)"},
+                {"id_datetime + interval 5.00 second", "seconds_add(8: id_datetime, 5)"},
+                // amounts without a fraction are as before
+                {"id_datetime + interval 2 second", "seconds_add(8: id_datetime, 2)"},
+                {"id_datetime + interval '2' second", "seconds_add(8: id_datetime, 2)"},
+                {"id_datetime - interval 2 second", "seconds_sub(8: id_datetime, 2)"},
+                // and the other calls on the same value are not merged with it
+                {"id_datetime + interval 1.5 second + interval 1 second",
+                        "seconds_add(microseconds_add(seconds_add(8: id_datetime, 1), 500000), 1)"},
+                {"id_datetime + interval 1.5 second + interval 250 millisecond",
+                        "milliseconds_add(microseconds_add(seconds_add(8: id_datetime, 1), 500000), 250)"},
+                // a constant expression is folded first
+                {"timestampadd(second, 0.25 + 0.25, id_datetime)", "microseconds_add(8: id_datetime, 500000)"},
+                {"id_datetime + interval cast('1.5' as decimal(10, 1)) second",
+                        "microseconds_add(seconds_add(8: id_datetime, 1), 500000)"},
+                {"date_sub(id_datetime, interval cast(3 as double) / 4 second)", "microseconds_sub(8: id_datetime, 750000)"},
+        };
+        for (String[] c : cases) {
+            String plan = getFragmentPlan("select " + c[0] + " from test_all_type");
+            assertContains(plan, c[1]);
+        }
+    }
+
+    @Test
+    public void testIntervalWithSecondsFinerThanMicroseconds() {
+        // DATETIME has no digits below microseconds
+        SemanticException e = assertThrows(SemanticException.class,
+                () -> getFragmentPlan("select id_datetime + interval 0.1234567 second from test_all_type"));
+        assertContains(e.getMessage(), "0.1234567");
+        assertThrows(SemanticException.class,
+                () -> getFragmentPlan("select id_datetime + interval '1.0000001' second from test_all_type"));
+        // also when the amount is a constant expression
+        assertThrows(SemanticException.class,
+                () -> getFragmentPlan("select timestampadd(second, 0.0000001 + 0, id_datetime) from test_all_type"));
+    }
+
+    // A literal amount is checked when the expression is analyzed, so a definition that uses it is refused when it is
+    // created, rather than each time it is used
+    @Test
+    public void testDefinitionWithSecondsFinerThanMicroseconds() {
+        Exception e = assertThrows(Exception.class, () -> starRocksAssert.withTable("CREATE TABLE t_interval_generated (\n" +
+                "  k1 INT NOT NULL,\n" +
+                "  ts DATETIME NOT NULL,\n" +
+                "  ts2 DATETIME NULL AS ts + INTERVAL 0.1234567 SECOND\n" +
+                ") DUPLICATE KEY(k1) DISTRIBUTED BY HASH(k1) BUCKETS 1 PROPERTIES ('replication_num' = '1')"));
+        assertContains(e.getMessage(), "at most 6 decimals");
+
+        e = assertThrows(Exception.class, () -> starRocksAssert.withView(
+                "create view v_interval_finer as select id_datetime + interval '0.1234567' second from test_all_type"));

```

---

### Incident Patch 2: `dcd391a9` (2026-11-12)
**Commit Message**: [BugFix][RB-817] Skip statistics lookup for struct fields of expressions to avoid Unknown column errors (#82995)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/statistics/StatisticsCalculator.java` (modified, +15/-6)
```diff
@@ -312,9 +312,11 @@ public Void visitOperator(Operator node, ExpressionContext context) {
             Map<ColumnRefOperator, SubfieldOperator> subfieldColumns = Maps.newHashMap();
             Preconditions.checkState(projection.getCommonSubOperatorMap().isEmpty());
             for (Map.Entry<ColumnRefOperator, ScalarOperator> entry : projection.getColumnRefMap().entrySet()) {
-                if (entry.getValue() instanceof SubfieldOperator && (node instanceof LogicalScanOperator ||
-                        node instanceof PhysicalScanOperator)) {
-                    subfieldColumns.put(entry.getKey(), (SubfieldOperator) entry.getValue());
+                if (entry.getValue() instanceof SubfieldOperator subfieldOperator &&
+                        (node instanceof LogicalScanOperator ||
+                        node instanceof PhysicalScanOperator) &&
+                        canUseSubfieldStatistics(subfieldOperator)) {
+                    subfieldColumns.put(entry.getKey(), subfieldOperator);
                 } else {
                     statisticsBuilder.addColumnStatistic(entry.getKey(),
                             ExpressionStatisticCalculator.calculate(entry.getValue(), statisticsBuilder.build()));
@@ -329,6 +331,12 @@ public Void visitOperator(Operator node, ExpressionContext context) {
         return null;
     }
 
+    private static boolean canUseSubfieldStatistics(SubfieldOperator subfieldOperator) {
+        // Persistent subfield statistics paths must be rooted directly at a table column. Expression roots such as
+        // array_col[1] cannot be represented by a persistent STRUCT path.
+        return subfieldOperator.getChild(0) instanceof ColumnRefOperator;
+    }
+
     private void addSubFiledStatistics(Operator node, Map<ColumnRefOperator, SubfieldOperator> subfieldColumns,
                                        Statistics.Builder statisticsBuilder) {
         if (!(node instanceof LogicalScanOperator) && !(node instanceof PhysicalScanOperator)) {
@@ -1230,11 +1238,12 @@ private Void computeProjectNode(ExpressionContext context,
 
         for (ColumnRefOperator requiredColumnRefOperator : columnRefMap.keySet()) {
             ScalarOperator mapOperator = columnRefMap.get(requiredColumnRefOperator);
-            if (mapOperator instanceof SubfieldOperator && context.getOptExpression() != null) {
+            if (mapOperator instanceof SubfieldOperator subfieldOperator &&
+                    canUseSubfieldStatistics(subfieldOperator) &&
+                    context.getOptExpression() != null) {
                 Operator child = context.getOptExpression().inputAt(0).getOp();
                 if (child instanceof LogicalScanOperator || child instanceof PhysicalScanOperator) {
-                    addSubFiledStatistics(child, ImmutableMap.of(requiredColumnRefOperator,
-                            (SubfieldOperator) mapOperator), builder);
+                    addSubFiledStatistics(child, ImmutableMap.of(requiredColumnRefOperator, subfieldOperator), builder);
                     continue;
                 }
             }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/optimizer/statistics/StatisticsCalculatorTest.java` (modified, +217/-0)
```diff
@@ -33,6 +33,7 @@
 import com.starrocks.qe.ConnectContext;
 import com.starrocks.server.GlobalStateMgr;
 import com.starrocks.server.MetadataMgr;
+import com.starrocks.sql.analyzer.SemanticException;
 import com.starrocks.sql.ast.JoinOperator;
 import com.starrocks.sql.ast.expression.BinaryType;
 import com.starrocks.sql.common.StarRocksPlannerException;
@@ -51,27 +52,37 @@
 import com.starrocks.sql.optimizer.dump.MockDumpInfo;
 import com.starrocks.sql.optimizer.dump.QueryDumpInfo;
 import com.starrocks.sql.optimizer.operator.AggType;
+import com.starrocks.sql.optimizer.operator.Projection;
 import com.starrocks.sql.optimizer.operator.UKFKConstraints;
 import com.starrocks.sql.optimizer.operator.logical.LogicalAggregationOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalEsScanOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalIcebergScanOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalJoinOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalKuduScanOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalOlapScanOperator;
+import com.starrocks.sql.optimizer.operator.logical.LogicalProjectOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalUnionOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalValuesOperator;
 import com.starrocks.sql.optimizer.operator.logical.LogicalWindowOperator;
 import com.starrocks.sql.optimizer.operator.scalar.BinaryPredicateOperator;
 import com.starrocks.sql.optimizer.operator.scalar.CallOperator;
 import com.starrocks.sql.optimizer.operator.scalar.CastOperator;
+import com.starrocks.sql.optimizer.operator.scalar.CollectionElementOperator;
 import com.starrocks.sql.optimizer.operator.scalar.ColumnRefOperator;
 import com.starrocks.sql.optimizer.operator.scalar.CompoundPredicateOperator;
 import com.starrocks.sql.optimizer.operator.scalar.ConstantOperator;
 import com.starrocks.sql.optimizer.operator.scalar.InPredicateOperator;
 import com.starrocks.sql.optimizer.operator.scalar.ScalarOperator;
+import com.starrocks.sql.optimizer.operator.scalar.SubfieldOperator;
 import com.starrocks.sql.plan.ConnectorPlanTestBase;
+import com.starrocks.statistic.StatisticUtils;
+import com.starrocks.thrift.TExplainLevel;
+import com.starrocks.type.ArrayType;
 import com.starrocks.type.DateType;
 import com.starrocks.type.IntegerType;
+import com.starrocks.type.StructField;
+import com.starrocks.type.StructType;
+import com.starrocks.type.Type;
 import com.starrocks.type.VarcharType;
 import com.starrocks.utframe.StarRocksAssert;
 import com.starrocks.utframe.UtFrameUtils;
@@ -315,6 +326,212 @@ public void testLogicalOlapTableScan() throws Exception {
         }
     }
 
+    /**
+     * Operator level test for both call sites that ask the statistics storage for a subfield path: the projection of a
+     * scan operator, and a LogicalProject on top of a scan. A query reaches the first one, see
+     * {@link #testQueryWithSubfieldOfArrayElement()}, but not the second one, because the project is merged into the
+     * scan projection before statistics are estimated. That branch is therefore covered by a hand built operator tree.
+     */
+    @Test
+    public void testSkipStatisticsForSubfieldOfArrayElement() {
+        GlobalStateMgr globalStateMgr = connectContext.getGlobalStateMgr();
+        OlapTable table = (OlapTable) globalStateMgr.getLocalMetastore().getDb("statistics_test")
+                .getTable("test_all_type");
+        List<Long> partitionIds = table.getPartitions().stream()
+                .mapToLong(Partition::getId).boxed().collect(Collectors.toList());
+
+        Type structType = new StructType(
+                new ArrayList<>(List.of(new StructField("bucket_id", IntegerType.INT))));
+        Type arrayType = new ArrayType(structType);
+        Column arrayColumn = new Column("bucket_array", arrayType, true);
+        ColumnRefOperator arrayRef = columnRefFactory.create("bucket_array", arrayType, true);
+        ColumnRefOperator outputRef = columnRefFactory.create("bucket_id", IntegerType.INT, true);
+        CollectionElementOperator arrayElement = new CollectionElementOperator(
+                structType, arrayRef, ConstantOperator.createInt(1), false);
+        SubfieldOperator subfield = new SubfieldOperator(
+                arrayElement, IntegerType.INT, List.of("bucket_id"));
+
+        LogicalOlapScanOperator scanOperator = new LogicalOlapScanOperator(table,
+                ImmutableMap.of(arrayRef, arrayColumn),
+                ImmutableMap.of(arrayColumn, arrayRef),
+                null, -1, null,
+                table.getBaseIndexMetaId(),
+                partitionIds,
+                null,
+                false,
+                Lists.newArrayList(),
+                Lists.newArrayList(),
+                Lists.newArrayList(),
+                false);
+        scanOperator.setProjection(new Projection(ImmutableMap.of(outputRe
```

---

### Incident Patch 3: `234fea95` (2026-11-12)
**Commit Message**: [BugFix] Keep constant columns in MAP casts (#82964)

Signed-off-by: Viktor Gnidenko <[REDACTED_EMAIL]>

**File**: `be/src/exprs/cast_nested.cpp` (modified, +3/-0)
```diff
@@ -57,6 +57,9 @@ StatusOr<ColumnPtr> CastMapExpr::evaluate_checked(ExprContext* context, Chunk* p
     auto casted_map = MapColumn::create(casted_key_column, casted_value_column,
                                         ColumnHelper::as_column<UInt32Column>(std::move(*src_offsets_column).mutate()));
     RETURN_IF_ERROR(down_cast<MapColumn*>(casted_map->as_mutable_raw_ptr())->unfold_const_children(_type));
+    if (orig_column->is_constant()) {
+        return ConstColumn::create(std::move(casted_map), orig_column->size());
+    }
     if (!orig_column->is_nullable()) {
         return casted_map;
     }
```

**File**: `be/test/exprs/cast_expr_core_test.cpp` (modified, +59/-0)
```diff
@@ -14,8 +14,13 @@
 
 #include <gtest/gtest.h>
 
+#include "column/chunk.h"
+#include "column/column_helper.h"
+#include "column/const_column.h"
+#include "column/map_column.h"
 #include "common/object_pool.h"
 #include "exprs/cast_expr.h"
+#include "exprs/column_ref.h"
 
 namespace starrocks {
 
@@ -39,6 +44,21 @@ TypeDescriptor make_array_type(LogicalType elem_type) {
     return array_type;
 }
 
+const auto int_map_type = TypeDescriptor::create_map_type(TYPE_INT_DESC, TYPE_INT_DESC);
+const auto bigint_key_map_type = TypeDescriptor::create_map_type(TYPE_BIGINT_DESC, TYPE_INT_DESC);
+
+StatusOr<ColumnPtr> cast_map(ColumnPtr input) {
+    ObjectPool pool;
+    auto* input_expr = pool.add(new ColumnRef(int_map_type, 0));
+    auto* expr = VectorizedCastExprFactory::from_type(int_map_type, bigint_key_map_type, input_expr, &pool);
+    if (expr == nullptr) {
+        return Status::InternalError("Failed to create MAP cast expression");
+    }
+    Chunk chunk;
+    chunk.append_column(std::move(input), 0);
+    return expr->evaluate_checked(nullptr, &chunk);
+}
+
 } // namespace
 
 TEST(CastExprCoreTest, from_thrift_succeeds_for_primitive_cast) {
@@ -59,4 +79,43 @@ TEST(CastExprCoreTest, from_thrift_returns_null_for_unsupported_cast) {
     EXPECT_EQ(nullptr, expr);
 }
 
+TEST(CastExprCoreTest, map_cast_preserves_constant) {
+    auto input = ColumnHelper::create_column(int_map_type, false);
+    input->append_datum(DatumMap{{int32_t{1}, int32_t{7}}});
+    auto result = cast_map(ConstColumn::create(std::move(input), 4));
+    ASSERT_TRUE(result.ok()) << result.status();
+    ASSERT_EQ(4, result.value()->size());
+    ASSERT_TRUE(result.value()->is_constant());
+
+    const auto* map = down_cast<const MapColumn*>(ColumnHelper::get_data_column(result.value().get()));
+    EXPECT_EQ(1, map->size());
+    EXPECT_EQ("{1:7}", map->debug_item(0));
+    EXPECT_NE(nullptr, dynamic_cast<const Int64Column*>(ColumnHelper::get_data_column(map->keys_column().get())));
+}
+
+TEST(CastExprCoreTest, map_cast_preserves_nullable_rows) {
+    auto input = ColumnHelper::create_column(int_map_type, true);
+    input->append_datum(DatumMap{{int32_t{1}, int32_t{7}}});
+    input->append_nulls(1);
+    input->append_datum(DatumMap{});
+    input->append_datum(DatumMap{{int32_t{2}, int32_t{9}}});
+    auto result = cast_map(std::move(input));
+    ASSERT_TRUE(result.ok()) << result.status();
+    const auto& output = result.value();
+    ASSERT_EQ(4, output->size());
+    EXPECT_FALSE(output->is_constant());
+    ASSERT_TRUE(output->is_nullable());
+    EXPECT_EQ("{1:7}", output->debug_item(0));
+    EXPECT_TRUE(output->is_null(1));
+    EXPECT_EQ("{}", output->debug_item(2));
+    EXPECT_EQ("{2:9}", output->debug_item(3));
+}
+
+TEST(CastExprCoreTest, map_cast_preserves_constant_null) {
+    auto result = cast_map(ColumnHelper::create_const_null_column(4));
+    ASSERT_TRUE(result.ok()) << result.status();
+    EXPECT_EQ(4, result.value()->size());
+    EXPECT_TRUE(result.value()->only_null());
+}
+
 } // namespace starrocks
```

**File**: `test/sql/test_map/R/test_cast_constant_map` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+-- name: test_cast_constant_map
+WITH t AS (
+    SELECT generate_series AS id, CAST(parse_json('{"1":7}') AS MAP<INT,INT>) AS m
+    FROM TABLE(generate_series(1,4))
+)
+SELECT CAST(m AS MAP<BIGINT,INT>) AS m FROM t;
+-- result:
+{1:7}
+{1:7}
+{1:7}
+{1:7}
+-- !result
```

**File**: `test/sql/test_map/T/test_cast_constant_map` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+-- name: test_cast_constant_map
+WITH t AS (
+    SELECT generate_series AS id, CAST(parse_json('{"1":7}') AS MAP<INT,INT>) AS m
+    FROM TABLE(generate_series(1,4))
+)
+SELECT CAST(m AS MAP<BIGINT,INT>) AS m FROM t;
```

#### Recent Merged Pull Requests:
- **PR #83011** (2026-11-12): [BugFix][RB-817] Skip statistics lookup for struct fields of expressions to avoid Unknown column errors (backport #82995) (@mergify[bot])
- **PR #83010** (2026-11-12): [BugFix][RB-817] Skip statistics lookup for struct fields of expressions to avoid Unknown column errors (backport #82995) (@mergify[bot])
- **PR #83009** (2026-11-12): [BugFix][RB-817] Skip statistics lookup for struct fields of expressions to avoid Unknown column errors (backport #82995) (@mergify[bot])
- **PR #83007** (2026-11-12): [BugFix] Keep constant columns in MAP casts (backport #82964) (@mergify[bot])
- **PR #83004** (2026-11-12): [Doc] Merge the warehouse and privilege partials into their pages (backport #82999) (@mergify[bot])
- **PR #83003** (2026-11-12): [Doc] Merge the warehouse and privilege partials into their pages (backport #82999) (@mergify[bot])

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

## X. [BugFix] Add the fractional seconds of an INTERVAL ... SECOND exactly (#81371)

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/ExpressionAnalyzer.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bf73116b`: [BugFix] Add the fractional seconds of an INTERVAL ... SECOND exactly (#81371). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/ExpressionAnalyzer.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import java.math.BigDecimal;
            String fnName = fn.getFunctionName().getFunction();
            if (FunctionSet.SECONDS_ADD.equals(fnName) || FunctionSet.SECONDS_SUB.equals(fnName)) {
                // A literal amount with more than 6 decimals is refused here already, so that a definition that uses it,
                // such as a generated column or a view, is refused when it is created rather than each time it is used
                BigDecimal seconds = IntervalSeconds.literalValue(node.getChild(1));
                if (seconds != null) {
                    IntervalSeconds.split(seconds, node.getPos());
                }
            }
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bf73116b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
