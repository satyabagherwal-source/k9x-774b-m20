# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: starrocks-starrocks-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T04:54:12.519Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-starrocks-starrocks-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T04:54:12.519Z`  
> **Learning ID**: `LEARN-EVO-starrocks-starrocks-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), I (Content & Information Intelligence), G (Architecture Intelligence), B (Product Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 66%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from starrocks-starrocks-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `e183bb1f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T04:54:06.999Z  
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
> **Harvest Timestamp**: 2026-11-27T04:54:06.994Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12292 stars

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

### Incident Patch 1: `908f480d` (2026-11-27)
**Commit Message**: [BugFix] Resolve files() in expression subqueries before the planner lock (#84299)

Signed-off-by: trueeyu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/QueryAnalyzer.java` (modified, +10/-108)
```diff
@@ -171,7 +171,16 @@ public void analyze(StatementBase node) {
      * while deferring normal table analysis to the locked phase.
      */
     public void analyzeFilesOnly(StatementBase node) {
-        new FilesOnlyVisitor().process(node, new Scope(RelationId.anonymous(), new RelationFields()));
+        // The planner calls this when AnalyzerUtils#collectFileTableFunctionRelation finds a files() call; resolving
+        // what that same walk finds leaves none of them to the analyzer, which runs under the planner lock.
+        AnalyzerUtils.collectFileTableFunctionRelation(node).forEach(this::initializeFileTableIfAbsent);
+    }
+
+    private void initializeFileTableIfAbsent(FileTableFunctionRelation relation) {
+        if (relation.getTable() instanceof TableFunctionTable) {
+            return;
+        }
+        relation.setTable(resolveTableFunctionTable(relation.getProperties(), relation.getPushDownSchemaFunc()));
     }
 
     /**
@@ -2775,113 +2784,6 @@ private boolean isCteName(String name) {
         }
     }
 
-    /**
-     * A lightweight visitor that only resolves FileTableFunctionRelation so that
-     * files() schema can be inferred without acquiring DB/table locks. Normal tables/views are skipped.
-     */
-    private class FilesOnlyVisitor implements AstVisitorExtendInterface<Scope, Scope> {
-        public FilesOnlyVisitor() {}
-
-        public Scope process(ParseNode node, Scope scope) {
-            return node.accept(this, scope);
-        }
-
-        @Override
-        public Scope visitQueryStatement(QueryStatement node, Scope parent) {
-            QueryRelation queryRelation = node.getQueryRelation();
-            if (queryRelation != null && !queryRelation.getCteRelations().isEmpty()) {
-                for (CTERelation cteRelation : queryRelation.getCteRelations()) {
-                    process(cteRelation.getCteQueryStatement(), parent);
-                }
-            }
-            return process(queryRelation, parent);
-        }
-
-        @Override
-        public Scope visitQueryRelation(QueryRelation node, Scope parent) {
-            return process(node, parent);
-        }
-
-        @Override
-        public Scope visitSelect(SelectRelation selectRelation, Scope scope) {
-            Relation r = selectRelation.getRelation();
-            // Only touch files(); keep others intact
-            if (r instanceof FileTableFunctionRelation) {
-                FileTableFunctionRelation f = (FileTableFunctionRelation) r;
-                initializeFileTableIfAbsent(f);
-            } else if (r instanceof JoinRelation) {
-                visitJoin((JoinRelation) r, scope);
-            } else if (r instanceof SubqueryRelation) {
-                visitSubqueryRelation((SubqueryRelation) r, scope);
-            } else if (r instanceof SetOperationRelation) {
-                visitSetOp((SetOperationRelation) r, scope);
-            } else if (r instanceof PivotRelation) {
-                PivotRelation p = (PivotRelation) r;
-                process(p.getQuery(), scope);
-            }
-            return scope;
-        }
-
-        public Scope visitJoin(JoinRelation join, Scope scope) {
-            Relation l = join.getLeft();
-            Relation r = join.getRight();
-            // SubqueryRelation/SetOperationRelation/PivotRelation are intentionally skipped here, because
-            // pre-analyzing them would still require table metadata and locks; the full analyzer pass will
-            // revisit them after files() has been resolved where necessary.
-            if (l instanceof FileTableFunctionRelation) {
-                FileTableFunctionRelation f = (FileTableFunctionRelation) l;
-                initializeFileTableIfAbsent(f);
-            } else if (l instanceof JoinRelation) {
-                visitJoin((JoinRelation) l, scope);
-            } else if (l instanceof SelectRelation) {
-                visitSelect((SelectRelation) l, scope);
-            } else if (l instanceof SubqueryRelation) {
-                visitSubqueryRelation((SubqueryRelation) l, scope);
-            } else if (l instanceof SetOperationRelation) {
-                visitSetOp((SetOperationRelation) l, scope);
-            }
-
-            // Same as the left side. We continue to recurse into joins, subqueries and set operations to locate
-            // nested files() invocations, while still avoiding any metadata access for normal table relations.
-            if (r instanceof FileTableFunctionRelation) {
-                FileTableFunctionRelation f = (FileTableFunctionRelation) r;
-                initializeFileTableIfAbsent(f);
-                // Do NOT mark lateral here: the relation remains a FileTableFunctionRelation, and the main analyzer
-                // will decide whether lateral semantics are required once it has the final relation type.
-            } else if (r instanceof JoinRelation) {
-                visitJoin((JoinRelation) r, scope);
-            } el
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/StatementPlannerTest.java` (modified, +35/-0)
```diff
@@ -494,6 +494,41 @@ public void testQueryFilesJoinedWithNormalTableResolvedBeforeLock() throws Excep
         assertFilesResolvedBeforeLock(sql);
     }
 
+    /**
+     * The lock collection walks the select list before analysis and locks t0 there, so files() there has to be
+     * found and resolved before the lock as well.
+     */
+    @Test
+    public void testQueryFilesInSelectListSubqueryResolvedBeforeLock() throws Exception {
+        assertFilesResolvedBeforeLock("select (select count(*) from t0), "
+                + "(select count(*) from files(\"path\"=\"fake://select_list\", \"format\"=\"csv\"))");
+    }
+
+    @Test
+    public void testQueryFilesInWhereSubqueryResolvedBeforeLock() throws Exception {
+        assertFilesResolvedBeforeLock("select v1 from t0 where v1 in "
+                + "(select col_int from files(\"path\"=\"fake://where\", \"format\"=\"csv\"))");
+    }
+
+    @Test
+    public void testQueryFilesInJoinOnSubqueryResolvedBeforeLock() throws Exception {
+        assertFilesResolvedBeforeLock("select t0.v1 from t0 join t1 on t0.v1 = t1.v4 and t0.v2 in "
+                + "(select col_int from files(\"path\"=\"fake://join_on\", \"format\"=\"csv\"))");
+    }
+
+    @Test
+    public void testInsertFilesInSelectListSubqueryResolvedBeforeLock() throws Exception {
+        boolean originalRunningUnitTest = FeConstants.runningUnitTest;
+        try {
+            FeConstants.runningUnitTest = false;
+            assertFilesResolvedBeforeLock("insert into t0 select "
+                    + "(select count(*) from files(\"path\"=\"fake://insert_select_list\", \"format\"=\"csv\")), "
+                    + "v2, v3 from t0");
+        } finally {
+            FeConstants.runningUnitTest = originalRunningUnitTest;
+        }
+    }
+
     @Test
     public void testCreatePipeFilesResolvedBeforeLock() throws Exception {
         // CREATE PIPE analyzes its INSERT from inside PipeAnalyzer, i.e. after the lock of the outer
```

---

### Incident Patch 2: `9e9d9643` (2026-11-26)
**Commit Message**: [BugFix] Lock TimeWatcher readers against concurrent mergeFrom (#84703)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/common/profile/TimeWatcher.java` (modified, +4/-2)
```diff
@@ -47,7 +47,9 @@ public synchronized Timer scope(long time, String name) {
         return t;
     }
 
-    public Optional<Timer> getTimer(String name) {
+    // Readers take the same monitor as scope()/mergeFrom(): a forked tracer can be merged from a
+    // background thread (e.g. DeployScanRangesTask) while the query thread builds the profile.
+    public synchronized Optional<Timer> getTimer(String name) {
         if (!scopedTimers.containsRow(name)) {
             return Optional.empty();
         }
@@ -61,7 +63,7 @@ public Optional<Timer> getTimer(String name) {
                 .orElse(null));
     }
 
-    public List<Timer> getAllTimerWithOrder() {
+    public synchronized List<Timer> getAllTimerWithOrder() {
         return scopedTimers.values().stream().sorted(Comparator.comparingLong(o -> o.firstTimePointNanoSecond))
                 .collect(Collectors.toList());
     }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/TracerTest.java` (modified, +41/-0)
```diff
@@ -16,12 +16,14 @@
 
 import com.starrocks.common.profile.Timer;
 import com.starrocks.common.profile.Tracers;
+import com.starrocks.common.util.RuntimeProfile;
 import org.apache.commons.lang3.StringUtils;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.Test;
 
 import java.util.ArrayList;
 import java.util.List;
+import java.util.concurrent.CountDownLatch;
 import java.util.concurrent.ExecutorService;
 import java.util.concurrent.Executors;
 import java.util.concurrent.Future;
@@ -255,4 +257,43 @@ public void testTracerForkPrepareCollectMetaPattern() throws Exception {
         }
         Tracers.close();
     }
+
+    @Test
+    public void testReadProfileWhileMergingFromAnotherThread() throws Exception {
+        // A background thread (like DeployScanRangesTask) merges forks into the owner while the
+        // query thread builds the profile; the read side must not race with mergeFrom().
+        Tracers.register(connectContext);
+        Tracers.init(Tracers.Mode.TIMER, Tracers.Module.BASE, true, false);
+        Tracers owner = Tracers.get();
+
+        int numMerges = 2000;
+        CountDownLatch readerStarted = new CountDownLatch(1);
+        ExecutorService executor = Executors.newSingleThreadExecutor();
+        try {
+            Future<?> merger = executor.submit(() -> {
+                readerStarted.await();
+                for (int i = 0; i < numMerges; i++) {
+                    Tracers forked = owner.fork(true);
+                    // a new scope name per merge so that mergeFrom() inserts a new cell
+                    try (Timer ignored = Tracers.watchScope(forked, Tracers.Module.BASE, "BASE.deploy" + i)) {
+                        // simulate deploy work
+                    }
+                    owner.mergeFrom(forked);
+                }
+                return null;
+            });
+            readerStarted.countDown();
+            do {
+                Tracers.toRuntimeProfile(new RuntimeProfile("Planner"));
+                Tracers.getSpecifiedTimer("BASE.deploy0");
+            } while (!merger.isDone());
+            merger.get();
+        } finally {
+            executor.shutdown();
+        }
+
+        String output = Tracers.printScopeTimer();
+        Assertions.assertTrue(output.contains("BASE.deploy" + (numMerges - 1)), output);
+        Tracers.close();
+    }
 }
```

---

### Incident Patch 3: `e183bb1f` (2026-11-27)
**Commit Message**: [BugFix] Keep tablet range boundary values as raw bytes on FE (#84763)

Co-authored-by: xiangguangyxg <[REDACTED_EMAIL]>

**File**: `build-support/schema_compatibility_waivers.json` (modified, +22/-1)
```diff
@@ -9,5 +9,26 @@
     "reason": "Reviewed compatibility exception after a multi-release deprecation window.",
     "owner": "engprod"
   },
-  "waivers": []
+  "waivers": [
+    {
+      "path": "gensrc/proto/types.proto",
+      "container_or_method": "VariantPB",
+      "field_number": 2,
+      "field_name": "value",
+      "rule": "field_type_changed",
+      "base_signature": "optional string value = 2",
+      "reason": "The value is the raw bytes of a range boundary and need not be valid UTF-8; string and bytes (binary) encode identically on the wire and generate the same C++ API, and FE must stop decoding it as UTF-8. Remove this waiver once the comparison base has the new type.",
+      "owner": "xiangguangyxg"
+    },
+    {
+      "path": "gensrc/thrift/Types.thrift",
+      "container_or_method": "TVariant",
+      "field_number": 2,
+      "field_name": "value",
+      "rule": "field_type_changed",
+      "base_signature": "2: optional string value",
+      "reason": "The value is the raw bytes of a range boundary and need not be valid UTF-8; string and binary encode identically in the Thrift binary and compact protocols (Thrift JSON writes binary as base64) and generate the same C++ API, and FE must stop decoding it as UTF-8. Remove this waiver once the comparison base has the new type.",
+      "owner": "xiangguangyxg"
+    }
+  ]
 }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/StringVariant.java` (modified, +114/-24)
```diff
@@ -14,65 +14,155 @@
 
 package com.starrocks.catalog;
 
-import com.google.gson.annotations.SerializedName;
-import com.starrocks.common.util.StringUtils;
+import com.google.gson.JsonDeserializationContext;
+import com.google.gson.JsonDeserializer;
+import com.google.gson.JsonElement;
+import com.google.gson.JsonObject;
+import com.google.gson.JsonParseException;
+import com.google.gson.JsonSerializationContext;
+import com.google.gson.JsonSerializer;
+import com.google.gson.annotations.JsonAdapter;
 import com.starrocks.type.PrimitiveType;
 import com.starrocks.type.Type;
 
+import java.nio.ByteBuffer;
+import java.nio.charset.CharacterCodingException;
+import java.nio.charset.CodingErrorAction;
+import java.nio.charset.StandardCharsets;
+import java.util.Arrays;
+import java.util.Base64;
+
 /*
- * StringVariant is for type CHAR, VARCHAR, BINARY, VARBINARY and HLL
+ * StringVariant is for type CHAR, VARCHAR, BINARY, VARBINARY and HLL.
+ * It holds the exact bytes of the value: the BE stores raw bytes, so a value may not be valid UTF-8.
  */
+@JsonAdapter(StringVariant.GsonAdapter.class)
 public class StringVariant extends Variant {
 
-    @SerializedName(value = "value")
-    protected final String value;
+    private final byte[] bytes;
+
+    public StringVariant(Type type, byte[] bytes) {
+        this(type, bytes, false);
+    }
 
     public StringVariant(Type type, String value) {
+        this(type, value.getBytes(StandardCharsets.UTF_8), true);
+    }
+
+    // owned: the caller just created the array and keeps no reference, so it is used as is unless the CHAR rule cuts it.
+    private StringVariant(Type type, byte[] bytes, boolean owned) {
         super(type);
-        // CHAR is defined only up to its first NUL in StarRocks: the BE strnlen-truncates a CHAR
-        // value on every storage read and when parsing a routing boundary (datum_from_string), so
-        // the bytes at/after the first '\0' are not part of the value. Canonicalize a CHAR variant
-        // the same way, so FE ordering and pre-split boundaries match what the BE stores and routes.
-        // VARCHAR/BINARY keep their raw bytes (the BE does not strnlen them).
-        if (value != null && type != null && type.getPrimitiveType() == PrimitiveType.CHAR) {
-            int nul = value.indexOf('\0');
-            if (nul >= 0) {
-                value = value.substring(0, nul);
+        int length = valueLength(type, bytes);
+        this.bytes = owned && length == bytes.length ? bytes : Arrays.copyOf(bytes, length);
+    }
+
+    // CHAR is defined only up to its first NUL in StarRocks: the BE strnlen-truncates a CHAR value on
+    // every storage read and when parsing a routing boundary, so the bytes at/after the first 0x00 are
+    // not part of the value. Canonicalize a CHAR variant the same way, so FE ordering and pre-split
+    // boundaries match what the BE stores and routes. VARCHAR/BINARY/VARBINARY/HLL keep every byte.
+    private static int valueLength(Type type, byte[] bytes) {
+        if (type != null && type.getPrimitiveType() == PrimitiveType.CHAR) {
+            for (int i = 0; i < bytes.length; i++) {
+                if (bytes[i] == 0) {
+                    return i;
+                }
             }
         }
-        this.value = value;
+        return bytes.length;
     }
 
     @Override
-    public long getLongValue() {
-        return IntVariant.parseLong(value);
+    public byte[] getBytesValue() {
+        return bytes.clone();
     }
 
+    // Lossy for bytes that are not valid UTF-8: for display, messages and text conversions only.
     @Override
     public String getStringValue() {
-        return value;
+        return new String(bytes, StandardCharsets.UTF_8);
+    }
+
+    @Override
+    public long getLongValue() {
+        return IntVariant.parseLong(getStringValue());
     }
 
     @Override
     protected int compareToImpl(Variant other) {
-        // compare string with utf-8 byte array, same with DM,BE,StorageEngine
-        return StringUtils.compareStringWithUTF8ByteArray(value, other.getStringValue());
+        // compare as unsigned bytes, same with DM,BE,StorageEngine
+        byte[] otherBytes = other instanceof StringVariant ? ((StringVariant) other).bytes : other.getBytesValue();
+        return Arrays.compareUnsigned(bytes, otherBytes);
     }
 
     @Override
     public boolean equals(Object object) {
         if (this == object) {
             return true;
         }
-        if (object == null || !(object instanceof StringVariant)) {
+        if (!(object instanceof StringVariant)) {
             return false;
         }
-        StringVariant other = (StringVariant) object;
-        return this.value.equals(other.value);
+        return Arrays.equals(bytes, ((StringVariant) object).bytes);
     }
 
     @Override
     public int hashCode() {
-        return value.hashCode();
+        return Arrays.hashCode(bytes);
+    }
+
+    // Persisted as {"value": <text or {"by
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/Variant.java` (modified, +24/-4)
```diff
@@ -25,6 +25,7 @@
 import com.starrocks.type.TypeDeserializer;
 import com.starrocks.type.TypeSerializer;
 
+import java.nio.charset.StandardCharsets;
 import java.util.List;
 
 /*
@@ -55,6 +56,11 @@ public String toString() {
 
     public abstract long getLongValue();
 
+    // The value as raw bytes. Only StringVariant can hold bytes that are not valid UTF-8.
+    public byte[] getBytesValue() {
+        return getStringValue().getBytes(StandardCharsets.UTF_8);
+    }
+
     public TVariant toThrift() {
         TVariant variant = new TVariant();
         variant.setType(TypeSerializer.toThrift(type));
@@ -66,7 +72,7 @@ public TVariant toThrift() {
             variant.setVariant_type(TVariantType.MAXIMUM);
         } else {
             variant.setVariant_type(TVariantType.NORMAL_VALUE);
-            variant.setValue(getStringValue());
+            variant.setValue(getBytesValue());
         }
         return variant;
     }
@@ -82,7 +88,7 @@ public VariantPB toProto() {
             variant.variantType = VariantTypePB.MAXIMUM;
         } else {
             variant.variantType = VariantTypePB.NORMAL_VALUE;
-            variant.value = getStringValue();
+            variant.value = getBytesValue();
         }
         return variant;
     }
@@ -145,6 +151,20 @@ public static Variant of(Type type, String value) {
         }
     }
 
+    public static Variant of(Type type, byte[] bytes) {
+        Preconditions.checkArgument(type.isValid());
+        switch (type.getPrimitiveType()) {
+            case CHAR:
+            case VARCHAR:
+            case BINARY:
+            case VARBINARY:
+            case HLL:
+                return new StringVariant(type, bytes);
+            default:
+                return of(type, new String(bytes, StandardCharsets.UTF_8));
+        }
+    }
+
     public static Variant nullVariant(Type type) {
         Preconditions.checkArgument(type.isValid(), "Invalid type for Variant.nullVariant");
         return new NullVariant(type);
@@ -206,11 +226,11 @@ public static int compatibleCompare(Variant key1, Variant key2) {
         Preconditions.checkArgument(destType.isValid());
         Variant newKey1 = key1;
         if (key1.getType() != destType) {
-            newKey1 = Variant.of(destType, key1.getStringValue());
+            newKey1 = Variant.of(destType, key1.getBytesValue());
         }
         Variant newKey2 = key2;
         if (key2.getType() != destType) {
-            newKey2 = Variant.of(destType, key2.getStringValue());
+            newKey2 = Variant.of(destType, key2.getBytesValue());
         }
         return newKey1.compareTo(newKey2);
     }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/common/util/StringUtils.java` (modified, +0/-16)
```diff
@@ -36,9 +36,7 @@
 
 import com.starrocks.catalog.Table;
 
-import java.nio.charset.StandardCharsets;
 import java.security.SecureRandom;
-import java.util.Arrays;
 
 public class StringUtils {
     private static final String CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
@@ -82,18 +80,4 @@ public static boolean areColumnNamesEqual(String columName, String toCheck) {
 
         return columName.equalsIgnoreCase(toCheck);
     }
-
-    /*
-     * Compare two strings by their UTF-8 bytes in UNSIGNED byte order, matching how BE
-     * orders VARCHAR (memcmp on the raw bytes; see be/src/base/string/memcmp.h) and
-     * therefore how BE routes rows into range-distributed tablets. Bytes are masked to
-     * 0..255 (Java byte is signed); on a common prefix the shorter string is smaller (no
-     * trailing-NUL special case). A CHAR value that embeds a NUL is a separate, out-of-scope
-     * edge: the BE CHAR load strips at the first NUL (be/src/column/datum_convert.cpp), which
-     * this raw-byte compare does not model.
-     */
-    public static int compareStringWithUTF8ByteArray(String s1, String s2) {
-        return Arrays.compareUnsigned(
-                s1.getBytes(StandardCharsets.UTF_8), s2.getBytes(StandardCharsets.UTF_8));
-    }
 }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/reshard/SplitTabletJobTest.java` (modified, +96/-2)
```diff
@@ -45,6 +45,7 @@
 import com.starrocks.load.InsertOverwriteJob;
 import com.starrocks.persist.EditLog;
 import com.starrocks.persist.WALApplier;
+import com.starrocks.planner.RangeDistributionPrunerTest;
 import com.starrocks.proto.AggregatePublishVersionRequest;
 import com.starrocks.proto.PublishVersionRequest;
 import com.starrocks.proto.PublishVersionResponse;
@@ -66,6 +67,7 @@
 import com.starrocks.transaction.TransactionState;
 import com.starrocks.transaction.TransactionStatus;
 import com.starrocks.type.IntegerType;
+import com.starrocks.type.VarcharType;
 import com.starrocks.utframe.MockedBackend.MockLakeService;
 import com.starrocks.utframe.StarRocksAssert;
 import com.starrocks.utframe.UtFrameUtils;
@@ -78,6 +80,7 @@
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 
+import java.nio.charset.StandardCharsets;
 import java.util.ArrayList;
 import java.util.Arrays;
 import java.util.HashMap;
@@ -1490,8 +1493,10 @@ private Map<Long, TabletRangePB> createSplitTabletRanges(long oldTabletId, List<
                 && !oldRange.lowerBound.values.isEmpty();
         boolean hasUpper = oldRange.upperBound != null && oldRange.upperBound.values != null
                 && !oldRange.upperBound.values.isEmpty();
-        int upperIfBounded = hasUpper ? Integer.parseInt(oldRange.upperBound.values.get(0).value) : 0;
-        int lowerValue = hasLower ? Integer.parseInt(oldRange.lowerBound.values.get(0).value)
+        int upperIfBounded = hasUpper
+                ? Integer.parseInt(new String(oldRange.upperBound.values.get(0).value, StandardCharsets.UTF_8)) : 0;
+        int lowerValue = hasLower
+                ? Integer.parseInt(new String(oldRange.lowerBound.values.get(0).value, StandardCharsets.UTF_8))
                 : (hasUpper ? upperIfBounded - step * count : 0);
         int upperValue = hasUpper ? upperIfBounded : lowerValue + step * count;
         int width = Math.max(1, (upperValue - lowerValue) / count);
@@ -2063,6 +2068,95 @@ public void testCheckSplitTabletRangesRejectsAMissingFirstChild() {
         assertRejected(expected, Map.of(11L, tabletRange(100, 200), 12L, tabletRange(200, 300)), "returned");
     }
 
+    // A boundary that is not valid UTF-8: 'p' x 10, then the two bytes of U+00E9 followed by a stray 0xFF.
+    private static byte[] nonUtf8Boundary() {
+        byte[] prefix = "pppppppppp".getBytes(StandardCharsets.UTF_8);
+        byte[] bytes = Arrays.copyOf(prefix, prefix.length + 3);
+        bytes[prefix.length] = (byte) 0xC3;
+        bytes[prefix.length + 1] = (byte) 0xA9;
+        bytes[prefix.length + 2] = (byte) 0xFF;
+        return bytes;
+    }
+
+    private static Tuple varcharTuple(byte[] value) {
+        return new Tuple(List.of(Variant.of(VarcharType.VARCHAR, value)));
+    }
+
+    @Test
+    public void testSplitResultWithNonUtf8BoundaryIsInstalled() throws Exception {
+        starRocksAssert.withTable("create table split_non_utf8_boundary (k varchar(100), v int)\n"
+                + "order by(k)\n"
+                + "properties('replication_num' = '1', 'file_bundling' = 'true');");
+        OlapTable varcharTable = (OlapTable) GlobalStateMgr.getCurrentState().getLocalMetastore()
+                .getTable(db.getFullName(), "split_non_utf8_boundary");
+        PhysicalPartition physicalPartition = varcharTable.getAllPhysicalPartitions().iterator().next();
+        MaterializedIndex oldIndex = physicalPartition.getLatestBaseIndex();
+        Tablet oldTablet = oldIndex.getTablets().get(0);
+
+        byte[] boundary = nonUtf8Boundary();
+        // The compute node reports the children's shared boundary as raw bytes: (-inf, B) and [B, +inf).
+        installLakeServiceMock((info, out) -> {
+            if (info.splittingTabletInfo != null) {
+                List<Long> newTabletIds = info.splittingTabletInfo.newTabletIds;
+                Assertions.assertEquals(2, newTabletIds.size());
+                out.put(newTabletIds.get(0), new TabletRange(Range.lt(varcharTuple(boundary))).toProto());
+                out.put(newTabletIds.get(1), new TabletRange(Range.ge(varcharTuple(boundary))).toProto());
+            }
+        });
+
+        SplitTabletClause clause = new SplitTabletClause(null, new TabletList(List.of(oldTablet.getId())),
+                Map.of(PropertyAnalyzer.PROPERTIES_TABLET_RESHARD_TARGET_SIZE, "-2"));
+        clause.setTabletReshardTargetSize(-2);
+        SplitTabletJob splitJob = (SplitTabletJob) new SplitTabletJobFactory(db, varcharTable, clause)
+                .createTabletReshardJob();
+        splitJob.init();
+        for (int i = 0; i < 10 && !splitJob.isDone(); i++) {
+            splitJob.run();
+        }
+
+        Assertions.assertEquals(TabletReshardJob.JobState.FINISHED, splitJob.getJobState());
+        Assertions.assertEquals("", splitJob.getInfo().getError_message());
+        MaterializedIndex newIndex = physicalPartition.getLatestBaseIndex();
+        Assertions.assertNotSame(oldIndex, ne
```

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/reshard/SplittingTabletTest.java` (modified, +2/-1)
```diff
@@ -27,6 +27,7 @@
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.Test;
 
+import java.nio.charset.StandardCharsets;
 import java.util.ArrayList;
 import java.util.Arrays;
 import java.util.Collections;
@@ -173,6 +174,6 @@ public void testJsonRoundTripPreservesDecimalBoundaries() {
         Assertions.assertEquals(18, restoredType.getScalarPrecision());
         Assertions.assertEquals(2, restoredType.getScalarScale());
         // The restored boundary serializes the canonical decimal text the BE validator parses.
-        Assertions.assertEquals("10.00", restoredLower.toProto().value);
+        Assertions.assertEquals("10.00", new String(restoredLower.toProto().value, StandardCharsets.UTF_8));
     }
 }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/reshard/TabletRangeTest.java` (modified, +7/-6)
```diff
@@ -27,6 +27,7 @@
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.Test;
 
+import java.nio.charset.StandardCharsets;
 import java.util.List;
 
 class TabletRangeTest {
@@ -259,15 +260,15 @@ public void testFromThrift() {
         TTuple lowerTuple = new TTuple();
         TVariant lowerVariant = new TVariant();
         lowerVariant.setType(TypeSerializer.toThrift(IntegerType.INT));
-        lowerVariant.setValue("10");
+        lowerVariant.setValue("10".getBytes(StandardCharsets.UTF_8));
         lowerTuple.setValues(List.of(lowerVariant));
         tRange.setLower_bound(lowerTuple);
 
         // Create upper bound
         TTuple upperTuple = new TTuple();
         TVariant upperVariant = new TVariant();
         upperVariant.setType(TypeSerializer.toThrift(IntegerType.INT));
-        upperVariant.setValue("20");
+        upperVariant.setValue("20".getBytes(StandardCharsets.UTF_8));
         upperTuple.setValues(List.of(upperVariant));
         tRange.setUpper_bound(upperTuple);
 
@@ -290,14 +291,14 @@ public void testFromThriftClosedInterval() {
         TTuple lowerTuple = new TTuple();
         TVariant lowerVariant = new TVariant();
         lowerVariant.setType(TypeSerializer.toThrift(IntegerType.BIGINT));
-        lowerVariant.setValue("1000");
+        lowerVariant.setValue("1000".getBytes(StandardCharsets.UTF_8));
         lowerTuple.setValues(List.of(lowerVariant));
         tRange.setLower_bound(lowerTuple);
 
         TTuple upperTuple = new TTuple();
         TVariant upperVariant = new TVariant();
         upperVariant.setType(TypeSerializer.toThrift(IntegerType.BIGINT));
-        upperVariant.setValue("2000");
+        upperVariant.setValue("2000".getBytes(StandardCharsets.UTF_8));
         upperTuple.setValues(List.of(upperVariant));
         tRange.setUpper_bound(upperTuple);
 
@@ -317,14 +318,14 @@ public void testFromThriftWithVarchar() {
         TTuple lowerTuple = new TTuple();
         TVariant lowerVariant = new TVariant();
         lowerVariant.setType(TypeSerializer.toThrift(VarcharType.VARCHAR));
-        lowerVariant.setValue("aaa");
+        lowerVariant.setValue("aaa".getBytes(StandardCharsets.UTF_8));
         lowerTuple.setValues(List.of(lowerVariant));
         tRange.setLower_bound(lowerTuple);
 
         TTuple upperTuple = new TTuple();
         TVariant upperVariant = new TVariant();
         upperVariant.setType(TypeSerializer.toThrift(VarcharType.VARCHAR));
-        upperVariant.setValue("zzz");
+        upperVariant.setValue("zzz".getBytes(StandardCharsets.UTF_8));
         upperTuple.setValues(List.of(upperVariant));
         tRange.setUpper_bound(upperTuple);
 
```

**File**: `fe/fe-core/src/test/java/com/starrocks/catalog/TabletRangeTest.java` (modified, +114/-17)
```diff
@@ -14,7 +14,11 @@
 
 package com.starrocks.catalog;
 
+import com.google.gson.Gson;
+import com.starrocks.common.Config;
 import com.starrocks.common.Range;
+import com.starrocks.common.io.DeepCopy;
+import com.starrocks.persist.gson.DefaultGsonBuilderFactory;
 import com.starrocks.proto.TabletRangePB;
 import com.starrocks.proto.TuplePB;
 import com.starrocks.proto.VariantPB;
@@ -28,7 +32,9 @@
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.Test;
 
+import java.nio.charset.StandardCharsets;
 import java.util.Arrays;
+import java.util.List;
 
 public class TabletRangeTest {
 
@@ -90,14 +96,14 @@ public void testClosedRangeToThrift() {
 
         // All Variant values are encoded via the `value` field.
         Assertions.assertTrue(lowerInt.isSetValue());
-        Assertions.assertEquals("1", lowerInt.getValue());
+        Assertions.assertEquals("1", new String(lowerInt.getValue(), StandardCharsets.UTF_8));
         Assertions.assertTrue(lowerStr.isSetValue());
-        Assertions.assertEquals("a", lowerStr.getValue());
+        Assertions.assertEquals("a", new String(lowerStr.getValue(), StandardCharsets.UTF_8));
 
         Assertions.assertTrue(upperInt.isSetValue());
-        Assertions.assertEquals("5", upperInt.getValue());
+        Assertions.assertEquals("5", new String(upperInt.getValue(), StandardCharsets.UTF_8));
         Assertions.assertTrue(upperStr.isSetValue());
-        Assertions.assertEquals("z", upperStr.getValue());
+        Assertions.assertEquals("z", new String(upperStr.getValue(), StandardCharsets.UTF_8));
     }
 
     @Test
@@ -129,14 +135,14 @@ public void testClosedRangeToProto() {
         VariantPB upperStr = upperPB.values.get(1);
 
         Assertions.assertEquals(VariantTypePB.NORMAL_VALUE, lowerInt.variantType);
-        Assertions.assertEquals("1", lowerInt.value);
+        Assertions.assertEquals("1", new String(lowerInt.value, StandardCharsets.UTF_8));
         Assertions.assertEquals(VariantTypePB.NORMAL_VALUE, lowerStr.variantType);
-        Assertions.assertEquals("a", lowerStr.value);
+        Assertions.assertEquals("a", new String(lowerStr.value, StandardCharsets.UTF_8));
 
         Assertions.assertEquals(VariantTypePB.NORMAL_VALUE, upperInt.variantType);
-        Assertions.assertEquals("5", upperInt.value);
+        Assertions.assertEquals("5", new String(upperInt.value, StandardCharsets.UTF_8));
         Assertions.assertEquals(VariantTypePB.NORMAL_VALUE, upperStr.variantType);
-        Assertions.assertEquals("z", upperStr.value);
+        Assertions.assertEquals("z", new String(upperStr.value, StandardCharsets.UTF_8));
     }
 
     @Test
@@ -155,7 +161,7 @@ public void testLowerOnlyRangeToThrift() {
 
         TVariant tv = tRange.getLower_bound().getValues().get(0);
         Assertions.assertTrue(tv.isSetValue());
-        Assertions.assertEquals("10", tv.getValue());
+        Assertions.assertEquals("10", new String(tv.getValue(), StandardCharsets.UTF_8));
     }
 
     @Test
@@ -174,7 +180,7 @@ public void testUpperOnlyRangeToThrift() {
 
         TVariant tv = tRange.getUpper_bound().getValues().get(0);
         Assertions.assertTrue(tv.isSetValue());
-        Assertions.assertEquals("100", tv.getValue());
+        Assertions.assertEquals("100", new String(tv.getValue(), StandardCharsets.UTF_8));
     }
 
     @Test
@@ -197,9 +203,9 @@ public void testHalfOpenRangeToThrift() {
         TVariant lowerInt = tRange.getLower_bound().getValues().get(0);
         TVariant upperInt = tRange.getUpper_bound().getValues().get(0);
         Assertions.assertTrue(lowerInt.isSetValue());
-        Assertions.assertEquals("1", lowerInt.getValue());
+        Assertions.assertEquals("1", new String(lowerInt.getValue(), StandardCharsets.UTF_8));
         Assertions.assertTrue(upperInt.isSetValue());
-        Assertions.assertEquals("5", upperInt.getValue());
+        Assertions.assertEquals("5", new String(upperInt.getValue(), StandardCharsets.UTF_8));
     }
 
     @Test
@@ -222,9 +228,9 @@ public void testOpenRangeToThrift() {
         TVariant lowerInt = tRange.getLower_bound().getValues().get(0);
         TVariant upperInt = tRange.getUpper_bound().getValues().get(0);
         Assertions.assertTrue(lowerInt.isSetValue());
-        Assertions.assertEquals("1", lowerInt.getValue());
+        Assertions.assertEquals("1", new String(lowerInt.getValue(), StandardCharsets.UTF_8));
         Assertions.assertTrue(upperInt.isSetValue());
-        Assertions.assertEquals("5", upperInt.getValue());
+        Assertions.assertEquals("5", new String(upperInt.getValue(), StandardCharsets.UTF_8));
     }
 
     @Test
@@ -247,10 +253,101 @@ public void testDateRangeToThrift() {
 
         // Dates should be encoded via the `value` field.
         Assertions.assertTrue(lowerDate.isSetValue());
-        Assertions.assertFalse(lowerDate.getValue().isEmpty());
+        Assertions.assertTrue(lowerDate.getValue().length > 0);
 
         Assertions.assertTrue(upperDa
```

#### Recent Merged Pull Requests:
- **PR #84766** (2026-11-27): [BugFix] Wait for a non-loopback address before choosing the BE/CN local IP (backport #84696) (@mergify[bot])
- **PR #84764** (2026-11-27): [BugFix] Create a reshard job's StarOS shards without holding the reshard scheduler (@starrocks-bot[bot])
- **PR #84763** (2026-11-27): [BugFix] Keep tablet range boundary values as raw bytes on FE (@starrocks-bot[bot])
- **PR #84753** (2026-11-27): [BugFix] Test each row of a constant column against its own partition's runtime filter (backport #84695) (@mergify[bot])
- **PR #84752** (2026-11-27): [BugFix] Test each row of a constant column against its own partition's runtime filter (backport #84695) (@mergify[bot])
- **PR #84751** (2026-11-27): [BugFix] Test each row of a constant column against its own partition's runtime filter (backport #84695) (@mergify[bot])

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

## X. [BugFix] Resolve files() in expression subqueries before the planner lock

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/QueryAnalyzer.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `908f480d`: [BugFix] Resolve files() in expression subqueries before the planner lock. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/QueryAnalyzer.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
        // The planner calls this when AnalyzerUtils#collectFileTableFunctionRelation finds a files() call; resolving
        // what that same walk finds leaves none of them to the analyzer, which runs under the planner lock.
        AnalyzerUtils.collectFileTableFunctionRelation(node).forEach(this::initializeFileTableIfAbsent);
    }

    private void initializeFileTableIfAbsent(FileTableFunctionRelation relation) {
        if (relation.getTable() instanceof TableFunctionTable) {
            return;
        }
        relation.setTable(resolveTableFunctionTable(relation.getProperties(), relation.getPushDownSchemaFunc()));
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
        new FilesOnlyVisitor().process(node, new Scope(RelationId.anonymous(), new RelationFields()));
    /**
     * A lightweight visitor that only resolves FileTableFunctionRelation so that
     * files() schema can be inferred without acquiring DB/table locks. Normal tables/views are skipped.
     */
    private class FilesOnlyVisitor implements AstVisitorExtendInterface<Scope, Scope> {
        public FilesOnlyVisitor() {}

        public Scope process(ParseNode node, Scope scope) {
            return node.accept(this, scope);
        }

        @Override
        public Scope visitQueryStatement(QueryStatement node, Scope parent) {
            QueryRelation queryRelation = node.getQueryRelation();
            if (queryRelation != null && !queryRelation.getCteRelations().isEmpty()) {
                for (CTERelation cteRelation : queryRelation.getCteRelations()) {
                    process(cteRelation.getCteQueryStatement(), parent);
                }
            }
            return process(queryRelation, parent);
        }

        @Override
        public Scope visitQueryRelation(QueryRelation node, Scope parent) {
            return process(node, parent);
        }

      
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `908f480d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
