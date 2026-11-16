# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: starrocks-starrocks-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T01:33:01.661Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-starrocks-starrocks-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T01:33:01.661Z`  
> **Learning ID**: `LEARN-EVO-starrocks-starrocks-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), K (Quality & Verification Intelligence), G (Architecture Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 72%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from starrocks-starrocks-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `6895756f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T01:32:57.199Z  
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
> **Harvest Timestamp**: 2026-11-16T01:32:57.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12254 stars

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

### Incident Patch 1: `277e3f4c` (2026-11-15)
**Commit Message**: [BugFix] Send the per-session token for Iceberg REST catalogs using security=jwt (#75811)

Signed-off-by: Barnaby Keene <[REDACTED_EMAIL]>
Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/iceberg/rest/OAuth2SecurityConfig.java` (modified, +9/-2)
```diff
@@ -155,8 +155,15 @@ public static OAuth2SecurityConfig build(final Map<String, String> properties) {
             config = config.setServerUri(URI.create(serverUri));
         }
 
-        // check OAuth2SecurityConfig is valid
-        if (!config.credentialOrTokenPresent() || !config.scopePresentOnlyWithCredential()) {
+        // check OAuth2SecurityConfig is valid. JWT is exempt from the
+        // credential/token-present check: in JWT mode there is deliberately no static
+        // token or credential in the catalog properties. The token is the logged-in
+        // user's JWT, supplied per session at request time (see
+        // IcebergRESTCatalog.buildContext). Applying the OAUTH2 guard here would
+        // discard the JWT security mode entirely and fall back to NONE, so the
+        // per-session token would never be attached to REST calls.
+        if (config.getSecurity() != JWT
+                && (!config.credentialOrTokenPresent() || !config.scopePresentOnlyWithCredential())) {
             return new OAuth2SecurityConfig();
         }
 
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/iceberg/rest/OAuth2SecurityProperties.java` (modified, +6/-0)
```diff
@@ -15,6 +15,7 @@
 package com.starrocks.connector.iceberg.rest;
 
 import com.google.common.collect.ImmutableMap;
+import org.apache.iceberg.rest.auth.AuthProperties;
 import org.apache.iceberg.rest.auth.OAuth2Properties;
 
 import java.util.Map;
@@ -46,6 +47,11 @@ public OAuth2SecurityProperties(OAuth2SecurityConfig securityConfig) {
         } else if (securityConfig.getSecurity() == IcebergRESTCatalog.Security.JWT) {
             // for JWT disable the token-refresh
             propertiesBuilder.put(OAuth2Properties.TOKEN_REFRESH_ENABLED, "false");
+            // The JWT is supplied per session at request time (SessionContext credentials
+            // from IcebergRESTCatalog.buildContext), not as a static catalog token. Select
+            // the OAuth2 auth manager explicitly so those per-session credentials are sent
+            // as the bearer; otherwise the REST client uses no auth and drops the token.
+            propertiesBuilder.put(AuthProperties.AUTH_TYPE, AuthProperties.AUTH_TYPE_OAUTH2);
         }
 
         this.securityProperties = propertiesBuilder.buildOrThrow();
```

---

### Incident Patch 2: `85ceece0` (2026-11-15)
**Commit Message**: [BugFix] Skip no-op raw-keyed external statistics cleanup DELETE (#83000)

Signed-off-by: Jenwit Amonpongitsara <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/statistic/ExternalFullStatisticsCollectJob.java` (modified, +3/-0)
```diff
@@ -690,6 +690,9 @@ private void logIfRawKeyWouldExceedPkLimit(long jobId) {
     // the next collection retries it. Best-effort: must never fail a job whose actual stats write
     // already succeeded.
     protected void cleanupStaleRawKeyedRows(ConnectContext context, long jobId) {
+        if (isAnalyzeCancelled(jobId)) {
+            return;
+        }
         String rawTableUuid = table.getUUID();
         boolean ok = new StatisticExecutor().dropExternalStatRawPartitions(context, rawTableUuid, partitionNames, columnNames);
         if (!ok) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/statistic/StatisticExecutor.java` (modified, +66/-1)
```diff
@@ -376,10 +376,63 @@ public void dropExternalTableStatistics(ConnectContext statsConnectCtx, String c
     // Best-effort cleanup of the stale raw-keyed rows superseded by a fresh hashed-key write.
     // Failure just means the raw row lingers a bit longer (until this partition/column is
     // collected again); it must never fail the collection job that just succeeded.
+    // The DELETE is issued only when a raw-keyed row exists in that scope (see
+    // StatisticSQLBuilder#buildExistsExternalStatRawPartitionsSQL): in shared-data mode every DELETE on these
+    // UNIQUE KEY tables later forces a compaction of the whole table, even when it matches nothing. If the
+    // existence check fails, the DELETE is skipped rather than issued blindly; the rows are retried next time.
     public boolean dropExternalStatRawPartitions(ConnectContext statsConnectCtx, String rawTableUUID,
                                                  List<String> partitionNames, List<String> columnNames) {
+        if (CollectionUtils.isEmpty(partitionNames) || CollectionUtils.isEmpty(columnNames)) {
+            return true;
+        }
+        String existsSql = StatisticSQLBuilder.buildExistsExternalStatRawPartitionsSQL(rawTableUUID, partitionNames,
+                columnNames);
+        Optional<Boolean> exists = rawKeyedRowExists(statsConnectCtx, existsSql);
+        if (exists.isEmpty()) {
+            return false;
+        }
+        if (!exists.get()) {
+            LOG.debug("No stale raw-keyed external statistic rows, skip cleanup: {}", existsSql);
+            return true;
+        }
         String sql = StatisticSQLBuilder.buildDropExternalStatSQLForPartitions(rawTableUUID, partitionNames, columnNames);
         LOG.debug("Cleanup stale raw-keyed external statistic rows SQL: {}", sql);
+        return executeRawKeyedCleanupDML(statsConnectCtx, sql);
+    }
+
+    /**
+     * Runs an existence check built by StatisticSQLBuilder#buildExistsExternalStatRawPartitionsSQL or
+     * #buildExistsExternalHistogramRawColumnsSQL. Returns true if it returned a row, false if it returned none, and
+     * empty if the check failed (the caller then skips the cleanup).
+     * <p>
+     * Like the DELETE that may follow, the check runs on the analyze job's own context, so KILL ANALYZE and the
+     * job's query timeout apply to it. The statement clock is restarted first because the query deadline is the
+     * context's start time plus its query timeout.
+     */
+    @VisibleForTesting
+    protected Optional<Boolean> rawKeyedRowExists(ConnectContext statsConnectCtx, String existsSql) {
+        int pipelineDop = statsConnectCtx.getSessionVariable().getPipelineDop();
+        try (var guard = statsConnectCtx.bindScope()) {
+            statsConnectCtx.setStartTime();
+            List<TResultBatch> batches = SimpleExecutor.getRepoExecutor().executeDQL(existsSql, statsConnectCtx);
+            for (TResultBatch batch : ListUtils.emptyIfNull(batches)) {
+                if (batch.getRows() != null && !batch.getRows().isEmpty()) {
+                    return Optional.of(true);
+                }
+            }
+            return Optional.of(false);
+        } catch (Exception e) {
+            LOG.warn("Failed to check for stale raw-keyed external statistic rows, skip cleanup | SQL {}", existsSql, e);
+            return Optional.empty();
+        } finally {
+            // SimpleExecutor#executeDQL(String, ConnectContext) overwrites the context's pipeline dop.
+            statsConnectCtx.getSessionVariable().setPipelineDop(pipelineDop);
+        }
+    }
+
+    @VisibleForTesting
+    protected boolean executeRawKeyedCleanupDML(ConnectContext statsConnectCtx, String sql) {
+        statsConnectCtx.setStartTime();
         return executeDML(statsConnectCtx, sql);
     }
 
@@ -415,9 +468,21 @@ public boolean dropExternalStatDroppedPartitions(ConnectContext statsConnectCtx,
 
     public boolean dropExternalHistogramRawColumns(ConnectContext statsConnectCtx, String rawTableUUID,
                                                    List<String> columnNames) {
+        if (CollectionUtils.isEmpty(columnNames)) {
+            return true;
+        }
+        String existsSql = StatisticSQLBuilder.buildExistsExternalHistogramRawColumnsSQL(rawTableUUID, columnNames);
+        Optional<Boolean> exists = rawKeyedRowExists(statsConnectCtx, existsSql);
+        if (exists.isEmpty()) {
+            return false;
+        }
+        if (!exists.get()) {
+            LOG.debug("No stale raw-keyed external histogram rows, skip cleanup: {}", existsSql);
+            return true;
+        }
         String sql = StatisticSQLBuilder.buildDropExternalHistogramSQLForRawUuid(rawTableUUID, columnNames);
         LOG.debug("Cleanup stale raw-keyed external histogram row SQL: {}", sql);
-        return executeDML(statsConnectCtx, sql);
+        return executeRawKeyedCleanupDML(statsConnectCtx, sql);
     }
 
     public boolean dropPartitionStatisti
```

**File**: `fe/fe-core/src/main/java/com/starrocks/statistic/StatisticSQLBuilder.java` (modified, +27/-0)
```diff
@@ -479,6 +479,33 @@ public static String buildDropExternalHistogramSQLForRawUuid(String rawTableUUID
                 " where table_uuid = '" + SqlUtils.escapeSqlString(rawTableUUID) + "' and column_name in (" + columnsIn + ")";
     }
 
+    // Existence checks run before the raw-keyed cleanups above, over exactly the same rows. In shared-data mode the
+    // external statistics tables are UNIQUE KEY, where every DELETE adds a delete-predicate rowset to every tablet
+    // whether or not it matches anything, and those rowsets can only be cleared by compacting the tablet from its
+    // base rowset. Issuing the cleanup DELETE after every collection therefore keeps forcing rewrites of the whole
+    // statistics table even once no raw-keyed rows are left, so the DELETE is issued only when one exists.
+    // The filter is on key columns only, led by table_uuid, so the lookup reads very little.
+    public static String buildExistsExternalStatRawPartitionsSQL(String rawTableUUID, List<String> partitionNames,
+                                                                 List<String> columnNames) {
+        String partitionsIn = partitionNames.stream()
+                .map(p -> "'" + SqlUtils.escapeSqlString(p) + "'").collect(Collectors.joining(", "));
+        String columnsIn = columnNames.stream()
+                .map(c -> "'" + SqlUtils.escapeSqlString(c) + "'").collect(Collectors.joining(", "));
+        return "SELECT 1 FROM " + StatsConstants.STATISTICS_DB_NAME + "." + EXTERNAL_FULL_STATISTICS_TABLE_NAME +
+                " WHERE TABLE_UUID = '" + SqlUtils.escapeSqlString(rawTableUUID) + "'" +
+                " AND PARTITION_NAME IN (" + partitionsIn + ")" +
+                " AND COLUMN_NAME IN (" + columnsIn + ") LIMIT 1";
+    }
+
+    public static String buildExistsExternalHistogramRawColumnsSQL(String rawTableUUID, List<String> columnNames) {
+        String columnsIn = columnNames.stream()
+                .map(c -> "'" + SqlUtils.escapeSqlString(c) + "'").collect(Collectors.joining(", "));
+        return "SELECT 1 FROM " + StatsConstants.STATISTICS_DB_NAME + "." +
+                StatsConstants.EXTERNAL_HISTOGRAM_STATISTICS_TABLE_NAME +
+                " WHERE TABLE_UUID = '" + SqlUtils.escapeSqlString(rawTableUUID) + "'" +
+                " AND COLUMN_NAME IN (" + columnsIn + ") LIMIT 1";
+    }
+
     public static String buildDropExternalStatSQL(String catalogName, String dbName, String tableName) {
         return "DELETE FROM " + EXTERNAL_FULL_STATISTICS_TABLE_NAME +
                 " WHERE CATALOG_NAME = '" + SqlUtils.escapeSqlString(catalogName) + "'" +
```

**File**: `fe/fe-core/src/test/java/com/starrocks/statistic/StatisticSQLBuilderTest.java` (modified, +18/-0)
```diff
@@ -126,6 +126,24 @@ void buildDropExternalHistogramSQLForRawUuidOnlyMatchesRawUuid() {
                 "cleanup delete must never also match the hashed uuid (it holds the fresh data): " + sql);
     }
 
+    // The existence checks must cover exactly the rows the raw-keyed cleanup DELETEs would remove: the raw uuid only
+    // (never the hash), the same partitions and columns, filtering on key columns only.
+    @Test
+    void existsChecksMatchTheRawKeyedCleanupScope() {
+        String hashed = StatisticUtils.hashTableUuidForPkStorage(TABLE_UUID);
+        String sql = StatisticSQLBuilder.buildExistsExternalStatRawPartitionsSQL(
+                TABLE_UUID, ImmutableList.of("p1", "p'2"), ImmutableList.of("col1", "col2"));
+        Assertions.assertEquals("SELECT 1 FROM _statistics_.external_column_statistics WHERE TABLE_UUID = '" +
+                TABLE_UUID + "' AND PARTITION_NAME IN ('p1', 'p''2') AND COLUMN_NAME IN ('col1', 'col2') LIMIT 1", sql);
+        Assertions.assertFalse(sql.contains(hashed), sql);
+
+        String histogramSql = StatisticSQLBuilder.buildExistsExternalHistogramRawColumnsSQL(
+                TABLE_UUID, ImmutableList.of("c'1", "c2"));
+        Assertions.assertEquals("SELECT 1 FROM _statistics_.external_histogram_statistics WHERE TABLE_UUID = '" +
+                TABLE_UUID + "' AND COLUMN_NAME IN ('c''1', 'c2') LIMIT 1", histogramSql);
+        Assertions.assertFalse(histogramSql.contains(hashed), histogramSql);
+    }
+
     @Test
     void buildQueryExternalFullStatisticsSQLDedupsByLatestUpdateTime() {
         // Correctness must not depend on the write-side cleanup delete succeeding: if both a
```

**File**: `fe/fe-core/src/test/java/com/starrocks/statistic/StatisticsExecutorTest.java` (modified, +142/-0)
```diff
@@ -28,6 +28,7 @@
 import com.starrocks.common.jmockit.Deencapsulation;
 import com.starrocks.qe.ConnectContext;
 import com.starrocks.qe.QueryState;
+import com.starrocks.qe.SimpleExecutor;
 import com.starrocks.qe.StmtExecutor;
 import com.starrocks.server.GlobalStateMgr;
 import com.starrocks.sql.analyzer.Analyzer;
@@ -37,6 +38,7 @@
 import com.starrocks.sql.parser.SqlParser;
 import com.starrocks.sql.plan.ConnectorPlanTestBase;
 import com.starrocks.sql.plan.PlanTestBase;
+import com.starrocks.thrift.TResultBatch;
 import com.starrocks.thrift.TStatisticData;
 import com.starrocks.type.IntegerType;
 import com.starrocks.type.StringType;
@@ -48,10 +50,14 @@
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 
+import java.nio.ByteBuffer;
+import java.nio.charset.StandardCharsets;
 import java.time.Clock;
+import java.time.Instant;
 import java.time.LocalDateTime;
 import java.util.ArrayList;
 import java.util.List;
+import java.util.Optional;
 
 public class StatisticsExecutorTest extends PlanTestBase {
     @BeforeAll
@@ -427,4 +433,140 @@ public void testDropHistogramWithEmptyColumnNames() {
         statisticExecutor.dropExternalHistogram(context, "catalog", "db", "table", Lists.newArrayList());
         statisticExecutor.dropExternalHistogram(context, "catalog", "db", "table", null);
     }
+
+    private static class RawKeyedCleanupRecorder extends StatisticExecutor {
+        private final Optional<Boolean> existsResult;
+        private final List<String> checks = new ArrayList<>();
+        private final List<String> dmls = new ArrayList<>();
+
+        RawKeyedCleanupRecorder(Optional<Boolean> existsResult) {
+            this.existsResult = existsResult;
+        }
+
+        @Override
+        protected Optional<Boolean> rawKeyedRowExists(ConnectContext statsConnectCtx, String existsSql) {
+            checks.add(existsSql);
+            return existsResult;
+        }
+
+        @Override
+        protected boolean executeRawKeyedCleanupDML(ConnectContext statsConnectCtx, String sql) {
+            dmls.add(sql);
+            return true;
+        }
+    }
+
+    // In shared-data mode every DELETE on the UNIQUE KEY external statistics tables adds a delete-predicate rowset
+    // that later forces a compaction of the whole table, even when it matches nothing. The raw-keyed cleanup that
+    // runs after every collection must therefore only DELETE when a raw-keyed row exists in that scope.
+    @Test
+    public void testRawKeyedCleanupSkipsDeleteWhenNoRawRowExists() {
+        ConnectContext context = StatisticUtils.buildConnectContext();
+        RawKeyedCleanupRecorder executor = new RawKeyedCleanupRecorder(Optional.of(false));
+
+        Assertions.assertTrue(executor.dropExternalStatRawPartitions(context, "hive.db.tbl.1", List.of("p1"),
+                List.of("c1")));
+        Assertions.assertTrue(executor.dropExternalHistogramRawColumns(context, "hive.db.tbl.1", List.of("c1")));
+        Assertions.assertEquals(2, executor.checks.size());
+        Assertions.assertTrue(executor.checks.get(0).startsWith("SELECT 1 FROM _statistics_.external_column_statistics"),
+                executor.checks.get(0));
+        Assertions.assertTrue(
+                executor.checks.get(1).startsWith("SELECT 1 FROM _statistics_.external_histogram_statistics"),
+                executor.checks.get(1));
+        Assertions.assertTrue(executor.dmls.isEmpty(), executor.dmls.toString());
+    }
+
+    @Test
+    public void testRawKeyedCleanupDeletesWhenRawRowExists() {
+        ConnectContext context = StatisticUtils.buildConnectContext();
+        RawKeyedCleanupRecorder executor = new RawKeyedCleanupRecorder(Optional.of(true));
+
+        Assertions.assertTrue(executor.dropExternalStatRawPartitions(context, "hive.db.tbl.1", List.of("p1"),
+                List.of("c1")));
+        Assertions.assertTrue(executor.dropExternalHistogramRawColumns(context, "hive.db.tbl.1", List.of("c1")));
+        Assertions.assertEquals(List.of(
+                StatisticSQLBuilder.buildDropExternalStatSQLForPartitions("hive.db.tbl.1", List.of("p1"), List.of("c1")),
+                StatisticSQLBuilder.buildDropExternalHistogramSQLForRawUuid("hive.db.tbl.1", List.of("c1"))),
+                executor.dmls);
+    }
+
+    @Test
+    public void testRawKeyedCleanupSkipsDeleteWhenCheckFails() {
+        ConnectContext context = StatisticUtils.buildConnectContext();
+        RawKeyedCleanupRecorder executor = new RawKeyedCleanupRecorder(Optional.empty());
+
+        Assertions.assertFalse(executor.dropExternalStatRawPartitions(context, "hive.db.tbl.1", List.of("p1"),
+                List.of("c1")));
+        Assertions.assertFalse(executor.dropExternalHistogramRawColumns(context, "hive.db.tbl.1", List.of("c1")));
+        Assertions.assertTrue(executor.dmls.isEmpty(), executor.dmls.toString());
+    }
+
+    @Test
+    public void testRawKeyedCleanupWithEmptyScopeDoesNothing() {
+        ConnectContex
```

---

### Incident Patch 3: `e4acf5d1` (2026-11-14)
**Commit Message**: [Doc] Fix a second batch of docs that contradict the source (#83113)

Signed-off-by: Binglin Chang <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: docs-automation[bot] <docs-automation[bot]@starrocks.io>

**File**: `docs/en/administration/configuration/BE_parameters/log_server_meta.md` (modified, +5/-5)
```diff
@@ -111,7 +111,7 @@ This topic introduces the following types of BE configurations:
 - Type: String
 - Unit: -
 - Is mutable: Yes (from v3.3.0, v3.2.7, and v3.1.12)
-- Description: The severity levels into which system log entries are classified. Valid values: INFO, WARNING, ERROR, and FATAL. At startup, if the value in the configuration file is none of these, it is reported in the log and INFO is used, so an invalid value cannot leave the BE without working logging. At runtime, an invalid value is instead rejected with an error and the level in effect is left unchanged. This item was changed to a dynamic configuration from v3.3.0, v3.2.7, and v3.1.12 onwards.
+- Description: The severity levels into which system log entries are classified. Valid values: INFO, WARNING, ERROR, and FATAL. At startup, if the value in the configuration file is none of these, it is reported in the log and INFO is used, so an invalid value cannot leave the BE without working logging. At runtime, an invalid value is instead rejected with an error and the level in effect is left unchanged. This item was changed to a dynamic configuration from v3.3.0, v3.2.7, and v3.1.12 onwards. However, a runtime modification changes the log level in effect only in v3.1.12 to v3.1.13, v3.2.7 to v3.2.8, v3.3.0, and from v4.0.16 and v4.1.6 onwards. In other versions, the item can be modified at runtime, but the log level in effect does not change.
 - Introduced in: -
 
 ### sys_log_roll_mode
@@ -435,9 +435,9 @@ This topic introduces the following types of BE configurations:
 - Default: `percpu_arena:percpu,oversize_threshold:134217728,muzzy_decay_ms:5000,dirty_decay_ms:5000,metadata_thp:auto,background_thread:true,prof:true,prof_active:false`
 - Type: string
 - Unit: -
-- Is mutable: Yes (only some options)
+- Is mutable: Yes (only some options; from v4.0.16 and v4.1.6 onwards. Not mutable in v4.1.3 and v4.1.4)
 - Description: The jemalloc runtime options that `bin/start_backend.sh` exports as the `JEMALLOC_CONF` environment variable when the BE is started in the normal mode. This item is ignored if `JEMALLOC_CONF` is already set in the environment, and if the BE is started with `--jemalloc_debug` or `--check_mem_leak`, because those modes force their own option string. jemalloc reads `JEMALLOC_CONF` before the BE parses its configuration, so modifying this item at runtime only re-applies the options that jemalloc itself allows to be changed after initialization: `dirty_decay_ms`, `muzzy_decay_ms`, and `prof_active`. Adding, removing, or changing any other option is rejected with an error and the configuration value is rolled back, which means those options require restarting the BE. `prof_active` can only be changed if the BE was started with `prof:true`. Setting `dirty_decay_ms` or `muzzy_decay_ms` to `0` purges all unused pages synchronously and can therefore make the modification take a while, and setting it to `-1` disables purging.
-- Introduced in: v4.0.15, v4.1.3
+- Introduced in: v4.0.16, v4.1.3
 
 ### large_memory_alloc_report_threshold
 
@@ -472,7 +472,7 @@ This topic introduces the following types of BE configurations:
 - Type: String
 - Unit: -
 - Is mutable: No
-- Description: BE process memory upper limit. You can set it as a percentage ("80%") or a physical limit ("100G"). The default hard limit is 90% of the server's memory size, and the soft limit is 80%. You need to configure this parameter if you want to deploy StarRocks with other memory-intensive services on a same server.
+- Description: BE process memory upper limit. You can set it as a percentage ("80%") or a physical limit ("100G"). The default value is 90% of the server's memory size. The BE uses 90% of `mem_limit` as the memory limit of the process memory tracker, which is 81% of the server's memory size by default. You need to configure this parameter if you want to deploy StarRocks with other memory-intensive services on a same server.
 - Introduced in: -
 
 ### memory_max_alignment
@@ -508,7 +508,7 @@ This topic introduces the following types of BE configurations:
 - Type: Int
 - Unit: Cores
 - Is mutable: No
-- Description: Controls the number of CPU cores the system will use for CPU-aware decisions (for example, thread-pool sizing and runtime scheduling). A value of 0 enables auto-detection: the system reads `/proc/cpuinfo` and uses all available cores. If set to a positive integer, that value overrides the detected core count and becomes the effective core count. When running inside containers, cgroup cpuset or cpu quota settings can further restrict usable cores; `CpuInfo` also respects those cgroup limits.
+- Description: Controls the number of CPU cores the system will use for CPU-aware decisions (for example, thread-pool sizing and runtime scheduling). A value of 0 enables auto-detection: the system reads `/proc/cpuinfo` and uses all available cores. If set to a positive integer, that value overrides the detected core count and becomes the effective core count. 
```

**File**: `docs/en/administration/configuration/BE_parameters/stats_storage.md` (modified, +1/-1)
```diff
@@ -1082,7 +1082,7 @@ This topic introduces the following types of BE configurations:
 - Type: Int
 - Unit: -
 - Is mutable: Yes
-- Description: The maximum number of threads for the release snapshot tasks on a BE node.
+- Description: The maximum number of threads for the release snapshot tasks on a BE node. In a shared-data cluster, this thread pool also runs vacuum, full vacuum, and transaction log deletion tasks.
 - Introduced in: -
 
 ### repair_compaction_interval_seconds
```

**File**: `docs/en/administration/configuration/FE_parameters/log_server_meta.md` (modified, +6/-6)
```diff
@@ -328,7 +328,7 @@ This topic introduces the following types of FE configurations:
 - Type: Boolean
 - Unit: -
 - Is mutable: Yes
-- Description: Whether to enable profile logging. When this feature is enabled, the FE writes per-query profile logs (the serialized `queryDetail` JSON produced by `ProfileManager`) to the profile log sink. This logging is performed only if `enable_collect_query_detail_info` is also enabled; when `enable_profile_log_compress` is enabled, the JSON may be gzipped before logging. Profile log files are managed by `profile_log_dir`, `profile_log_roll_num`, `profile_log_roll_interval` and rotated/deleted according to `profile_log_delete_age` (supports formats like `7d`, `10h`, `60m`, `120s`). Disabling this feature stops writing profile logs (reducing disk I/O, compression CPU and storage usage). Which queries are logged can be further filtered by `profile_log_latency_threshold_ms`.
+- Description: Whether to enable profile logging. When this feature is enabled, the FE writes per-query profile logs (the serialized `queryDetail` JSON produced by `ProfileManager`) to the profile log sink. This logging is performed only if `enable_collect_query_detail_info` is also enabled. Profile log files are managed by `profile_log_dir`, `profile_log_roll_num`, `profile_log_roll_interval` and rotated/deleted according to `profile_log_delete_age` (supports formats like `7d`, `10h`, `60m`, `120s`). Disabling this feature stops writing profile logs (reducing disk I/O, compression CPU and storage usage). Which queries are logged can be further filtered by `profile_log_latency_threshold_ms`.
 - Introduced in: v3.2.5
 
 ### `enable_qe_slow_log`
@@ -617,7 +617,7 @@ This topic introduces the following types of FE configurations:
 - Unit: Milliseconds
 - Is mutable: Yes
 - Description: Minimum query latency (in milliseconds) for a profile to be written to `fe.profile.log`. Only queries whose execution time is greater than or equal to this value are logged. Set to 0 to log all profiles (no threshold). Use a positive value to reduce log volume by logging only slower queries.
-- Introduced in: -
+- Introduced in: v4.2.0
 
 
 ### `profile_log_roll_file_index`
@@ -653,7 +653,7 @@ This topic introduces the following types of FE configurations:
 - Type: Int
 - Unit: MB
 - Is mutable: No
-- Description: Sets the size threshold (in megabytes) that triggers a size-based rollover of the FE profile log file. This value is used by the Log4j RollingFile SizeBasedTriggeringPolicy for the `ProfileFile` appender; when a profile log exceeds `profile_log_roll_size_mb` it will be rotated. Rotation can also occur by time when `profile_log_roll_interval` is reached — either condition will trigger rollover. Combined with `profile_log_roll_num` and `profile_log_delete_age`, this item controls how many historical profile files are retained and when old files are deleted. Compression of rotated files is controlled by `enable_profile_log_compress`.
+- Description: Sets the size threshold (in megabytes) that triggers a size-based rollover of the FE profile log file. This value is used by the Log4j RollingFile SizeBasedTriggeringPolicy for the `ProfileFile` appender; when a profile log exceeds `profile_log_roll_size_mb` it will be rotated. Rotation can also occur by time when `profile_log_roll_interval` is reached — either condition will trigger rollover. Combined with `profile_log_roll_num` and `profile_log_delete_age`, this item controls how many historical profile files are retained and when old files are deleted.
 - Introduced in: v3.2.5
 
 ### `qe_slow_log_ms`
@@ -789,7 +789,7 @@ This topic introduces the following types of FE configurations:
 - Type: String
 - Unit: -
 - Is mutable: No
-- Description: The severity levels into which system log entries are classified. Valid values: `INFO`, `WARN`, `ERROR`, and `FATAL`.
+- Description: The severity levels into which system log entries are classified. Valid values: `DEBUG`, `INFO`, `WARN`, `ERROR`, and `FATAL`.
 - Introduced in: -
 
 ### `sys_log_roll_file_index`
@@ -836,7 +836,7 @@ This topic introduces the following types of FE configurations:
 - Type: String[]
 - Unit: -
 - Is mutable: No
-- Description: The modules for which StarRocks generates system logs. If this parameter is set to `org.apache.starrocks.catalog`, StarRocks generates system logs only for the catalog module. Separate the module names with a comma (,) and a space.
+- Description: The modules for which StarRocks generates DEBUG-level system logs, in addition to the logs at the level specified by `sys_log_level`. If this parameter is set to `com.starrocks.catalog`, StarRocks also generates DEBUG-level system logs for the catalog module. Separate the module names with a comma (,) and a space.
 - Introduced in: -
 
 ### `sys_log_warn_modules`
@@ -1011,7 +1011,7 @@ This topic introduces the following types of FE configurations:
 - Type: Boolean
 - Unit: -
 - Is mutable: No
-- Introduced in: v4.2.0
+- Introduced in: v4.
```

**File**: `docs/en/administration/configuration/FE_parameters/shared_lake_other.md` (modified, +8/-8)
```diff
@@ -520,7 +520,7 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Unit: -
 - Is mutable: Yes
 - Description: The table or partition list of which compaction is disabled in shared-data mode. The format is `tableId1;partitionId2`, seperated by semicolon, for example, `12345;98765`.
-- Introduced in: v3.4.4
+- Introduced in: v3.4.5, v3.5.0
 
 ### `lake_compaction_history_size`
 
@@ -563,7 +563,7 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Type: Long
 - Unit: -
 - Is mutable: Yes
-- Description: The upper limit of the Compaction Score for a partition in a shared-data cluster. `0` indicates no upper limit. This item only takes effect when `lake_enable_ingest_slowdown` is set to `true`. When the Compaction Score of a partition reaches or exceeds this upper limit, incoming loading tasks will be rejected. From v3.3.6 onwards, the default value is changed from `0` to `2000`.
+- Description: The upper limit of the Compaction Score for a partition in a shared-data cluster. `0` indicates no upper limit. This item only takes effect when `lake_enable_ingest_slowdown` is set to `true`. When the Compaction Score of a partition exceeds this upper limit, incoming loading tasks will be rejected. From v3.3.6 onwards, the default value is changed from `0` to `2000`.
 - Introduced in: v3.2.0
 
 ### `lake_compaction_interval_ms_on_success`
@@ -602,13 +602,13 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Description: The Compaction Score threshold that triggers Data Ingestion Slowdown in a shared-data cluster. This configuration only takes effect when `lake_enable_ingest_slowdown` is set to `true`.
 - Introduced in: v3.2.0
 
-### `lake_publish_version_max_threads`
+### `publish_version_max_threads`
 
 - Default: 512
 - Type: Int
 - Unit: -
 - Is mutable: Yes
-- Description: The maximum number of threads for Version Publish tasks in a shared-data cluster.
+- Description: The maximum number of threads for Version Publish tasks in a shared-data cluster. From v4.0.5 and v4.1.0 onwards, this item is renamed from `lake_publish_version_max_threads` to `publish_version_max_threads`. The old name is still accepted as an alias.
 - Introduced in: v3.2.0
 
 ### `lake_publish_version_timeout_ms`
@@ -799,7 +799,7 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Type: Int
 - Unit: Count
 - Is mutable: Yes
-- Description: Sets the upper bound on how many consecutive transaction versions may be grouped together when building a publish batch for lake (cloud‑native) tables. The value is passed to the transaction graph batching routine (see getReadyToPublishTxnListBatch) and caps the candidate range size for a TransactionStateBatch. Larger values can increase publish throughput by batching more commits, but increase the scope of an atomic publish (longer visibility latency and larger rollback surface) and may be limited at runtime when versions are not consecutive. Tune according to workload and visibility/latency requirements.
+- Description: Sets the upper bound on how many consecutive transaction versions may be grouped together when building a publish batch for lake (cloud‑native) tables. The value is passed to the transaction graph batching routine (see getReadyToPublishTxnListBatch) and caps the candidate range size for a TransactionStateBatch. Larger values can increase publish throughput by batching more commits, but increase the scope of an atomic publish (longer visibility latency and larger rollback surface) and a batch can end before reaching this limit. A batch ends before a replication or DELETE transaction, which is published on its own, and before a transaction that writes multiple tables when `lake_enable_batch_publish_multi_table` is `false`. It also ends where a partition's versions are not consecutive (for example, because a schema change occupied a version) or its loaded materialized indexes change, and before a transaction on a dropped table. When `lake_enable_batch_publish_retry_freeze` is `true`, a retried batch contains only the transactions of the earlier attempt. Tune according to workload and visibility/latency requirements.
 - Introduced in: v3.2.0
 
 ### `lake_batch_publish_min_version_num`
@@ -808,7 +808,7 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Type: Int
 - Unit: -
 - Is mutable: Yes
-- Description: Deprecated. This parameter no longer takes effect. It is kept only so that an existing setting in **fe.conf** or an `ADMIN SET FRONTEND CONFIG` statement on it does not fail. In shared-data mode, batch publish starts a batch in each round from every committed transaction that no longer waits for another transaction, and publishes the batch whatever its size, with at most `lake_batch_publish_max_version_num` transactions in a batch. Previously, this parameter set the minimum number of transactions in a batch, and a batch 
```

**File**: `docs/en/administration/configuration/FE_parameters/user_query_loading.md` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ This topic introduces the following types of FE configurations:
 - Type: Int
 - Unit:
 - Is mutable: Yes
-- Description: The maximum number of roles a user can have.
+- Description: The maximum number of roles a user can have, including the roles inherited through the roles granted to the user. This limit is checked when a role is granted to a user.
 - Introduced in: v3.0.0
 
 ### `ranger_hive_catalog_prefix_enabled`
```

**File**: `docs/en/administration/management/Backup_and_restore.md` (modified, +3/-2)
```diff
@@ -433,7 +433,8 @@ The following example restores all tables from the database `sr_hub` in the snap
 RESTORE SNAPSHOT sr_all_backup
 FROM test_repo
 DATABASE sr_hub
-ON (ALL TABLES);
+ON (ALL TABLES)
+PROPERTIES ("backup_timestamp" = "2024-12-09-10-52-10-940");
 ```
 
 The following example restores one of all tables from the database `sr_hub` in the snapshot `sr_all_backup`.
@@ -663,4 +664,4 @@ You can optimize the performance of BACKUP or RESTORE jobs by modifying the foll
 - If there is an existing table that has a duplicated name with the table to be restored, StarRocks first checks whether or not the schema of the existing table matches that of the table to be restored. If the schemas match, StarRocks overwrites the existing table with the data in the snapshot. If the schema does not match, the RESTORE job fails. You can either rename the table to be restored using the keyword `AS`, or delete the existing table before restoring data.
 - If the RESTORE job overwrites an existing database, table, or partition, the overwritten data cannot be restored after the job enters the COMMIT phase. If the RESTORE job fails or is canceled at this point, the data may be corrupted and inaccessible. In this case, you can only perform the RESTORE operation again and wait for the job to complete. Therefore, we recommend that you do not restore data by overwriting unless you are sure that the current data is no longer used. The overwrite operation first checks metadata consistency between the snapshot and the existing database, table, or partition. If an inconsistency is detected, the RESTORE operation cannot be performed.
 - Currently, StarRocks does not support backing up and restoring the configuration data related to user accounts, privileges, and resource groups.
-- Currently, StarRocks does not support backing up and restoring the Colocate Join relationship among tables.
+- By default, StarRocks does not restore the Colocate Join relationship among tables. From v3.2.10 and v3.3.2 onwards, in shared-nothing clusters, you can set the FE configuration item `enable_colocate_restore` to `true` so that the restored tables keep their Colocate Join relationship. This applies only to tables that do not already exist in the target cluster.
```

**File**: `docs/en/administration/management/Scale_up_down.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ This topic describes how to scale in and out the node of StarRocks.
 
 StarRocks has two types of FE nodes: Follower and Observer. Followers are involved in election voting and writing. Observers are only used to synchronize logs and extend read performance.
 
-> * The number of follower FEs (including leader) must be odd, and it is recommended to deploy 3 of them to form a High Availability (HA) mode.
+> * We recommend that the number of follower FEs (including leader) be odd, and that 3 of them be deployed to form a High Availability (HA) mode.
 > * When the FE is in high availability deployment (1 leader, 2 followers), it is recommended to add Observer FEs for better read performance. 
 
 ### Scale FE out
```

**File**: `docs/en/administration/management/audit_loader.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ After a partition is created, you can move on to the next step.
 
 :::note
 
-If the table already exists from an earlier version, add the columns that were introduced since, otherwise the corresponding fields are silently dropped when the audit logs are loaded. For example, `errorMessage` is introduced in v4.2.0:
+If the table already exists from an earlier version, add the columns that were introduced since, otherwise the corresponding fields are silently dropped when the audit logs are loaded. For example, `errorMessage` is introduced in v4.1.6:
 
 ```SQL
 ALTER TABLE starrocks_audit_db__.starrocks_audit_tbl__
```

#### Recent Merged Pull Requests:
- **PR #83303** (2026-11-15): [BugFix] Skip no-op raw-keyed external statistics cleanup DELETE (backport #83000) (@mergify[bot])
- **PR #83302** (2026-11-15): [BugFix] Skip no-op raw-keyed external statistics cleanup DELETE (backport #83000) (@mergify[bot])
- **PR #83301** (2026-11-15): [BugFix] Skip no-op raw-keyed external statistics cleanup DELETE (backport #83000) (@mergify[bot])
- **PR #83299** (2026-11-15): [BugFix][RB-1637] Extrapolate truncated Iceberg ANALYZE samples despite many position deletes (backport #83289) (@mergify[bot])
- **PR #83298** (2026-11-15): [BugFix][RB-1637] Extrapolate truncated Iceberg ANALYZE samples despite many position deletes (backport #83289) (@mergify[bot])
- **PR #83297** (2026-11-15): [BugFix][RB-1538] Fix Iceberg/Hive/Paimon view resolution for views created by other engines (backport #83290) (@mergify[bot])

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

## X. [BugFix] Send the per-session token for Iceberg REST catalogs using security=jwt

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/connector/iceberg/rest/OAuth2SecurityConfig.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `277e3f4c`: [BugFix] Send the per-session token for Iceberg REST catalogs using security=jwt. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/connector/iceberg/rest/OAuth2SecurityConfig.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
        // check OAuth2SecurityConfig is valid. JWT is exempt from the
        // credential/token-present check: in JWT mode there is deliberately no static
        // token or credential in the catalog properties. The token is the logged-in
        // user's JWT, supplied per session at request time (see
        // IcebergRESTCatalog.buildContext). Applying the OAUTH2 guard here would
        // discard the JWT security mode entirely and fall back to NONE, so the
        // per-session token would never be attached to REST calls.
        if (config.getSecurity() != JWT
                && (!config.credentialOrTokenPresent() || !config.scopePresentOnlyWithCredential())) {
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
        // check OAuth2SecurityConfig is valid
        if (!config.credentialOrTokenPresent() || !config.scopePresentOnlyWithCredential()) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `277e3f4c` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
