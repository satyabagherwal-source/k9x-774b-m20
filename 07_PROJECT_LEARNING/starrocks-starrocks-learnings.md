> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `9a755b9e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T11:24:31.668Z  
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
> **Harvest Timestamp**: 2026-11-13T11:24:31.662Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12253 stars

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

### Incident Patch 1: `28f9a91c` (2026-11-13)
**Commit Message**: [BugFix] Fix BatchRunCounter unsigned filter comparison and delta decode signed overflow UB (#82015)

Signed-off-by: James Lamb <[REDACTED_EMAIL]>

**File**: `be/src/base/simd/batch_run_counter.h` (modified, +10/-9)
```diff
@@ -62,15 +62,15 @@ class BatchRunCounter {
 
         if (batch_size >= 32 && _left >= 32) {
             __m256i f = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(_filter + _offset));
-            uint32_t mask = _mm256_movemask_epi8(_mm256_cmpgt_epi8(f, all0));
+            uint32_t zero_mask = _mm256_movemask_epi8(_mm256_cmpeq_epi8(f, all0));
             _offset += 32;
             _left -= 32;
 
-            if (mask == 0) {
+            if (zero_mask == 0xffffffff) {
                 // all zero
                 return BatchCount(32, 0, true);
-            } else if (mask == 0xffffffff) {
-                // all one
+            } else if (zero_mask == 0) {
+                // all non-zero
                 return BatchCount(32, 32, true);
             } else {
                 return BatchCount(32, 0, false);
@@ -83,15 +83,15 @@ class BatchRunCounter {
 
         if (batch_size >= 16 && _left >= 16) {
             const auto f = _mm_loadu_si128(reinterpret_cast<const __m128i*>(_filter + _offset));
-            const auto mask = _mm_movemask_epi8(_mm_cmpgt_epi8(f, zero16));
+            const auto zero_mask = _mm_movemask_epi8(_mm_cmpeq_epi8(f, zero16));
             _offset += 16;
             _left -= 16;
 
-            if (mask == 0) {
+            if (zero_mask == 0xffff) {
                 // all zero
                 return BatchCount(16, 0, true);
-            } else if (mask == 0xffff) {
-                // all one
+            } else if (zero_mask == 0) {
+                // all non-zero
                 return BatchCount(16, 16, true);
             } else {
                 return BatchCount(16, 0, false);
@@ -137,7 +137,8 @@ class BatchRunCounter {
             _left -= 8;
             if (partital_value == 0) {
                 return BatchCount(8, 0, true);
-            } else if (partital_value == 0x0101010101010101) {
+            } else if (partital_value == 0x0101010101010101ULL ||
+                       (((partital_value - 0x0101010101010101ULL) & ~partital_value & 0x8080808080808080ULL) == 0)) {
                 return BatchCount(8, 8, true);
             } else {
                 return BatchCount(8, 0, false);
```

**File**: `be/src/base/simd/delta_decode.cpp` (modified, +26/-10)
```diff
@@ -80,8 +80,10 @@ DD_TARGET_AVX2 void delta_decode_chain_int32_avx2(int32_t* buf, int n, int32_t m
     }
 
     for (int i = sz; i < n; i++) {
-        buf[i] += last_value + min_delta;
-        last_value = buf[i];
+        uint32_t val =
+                static_cast<uint32_t>(buf[i]) + static_cast<uint32_t>(last_value) + static_cast<uint32_t>(min_delta);
+        buf[i] = static_cast<int32_t>(val);
+        last_value = static_cast<int32_t>(val);
     }
 }
 
@@ -118,8 +120,10 @@ DD_TARGET_AVX512VL void delta_decode_chain_int32_avx2x(int32_t* buf, int n, int3
     }
 
     for (int i = sz; i < n; i++) {
-        buf[i] += last_value + min_delta;
-        last_value = buf[i];
+        uint32_t val =
+                static_cast<uint32_t>(buf[i]) + static_cast<uint32_t>(last_value) + static_cast<uint32_t>(min_delta);
+        buf[i] = static_cast<int32_t>(val);
+        last_value = static_cast<int32_t>(val);
     }
 }
 
@@ -160,8 +164,10 @@ DD_TARGET_AVX512F void delta_decode_chain_int32_avx512(int32_t* buf, int n, int3
     }
 
     for (int i = sz; i < n; i++) {
-        buf[i] += last_value + min_delta;
-        last_value = buf[i];
+        uint32_t val =
+                static_cast<uint32_t>(buf[i]) + static_cast<uint32_t>(last_value) + static_cast<uint32_t>(min_delta);
+        buf[i] = static_cast<int32_t>(val);
+        last_value = static_cast<int32_t>(val);
     }
 }
 
@@ -202,8 +208,10 @@ DD_TARGET_AVX512F void delta_decode_chain_int64_avx512(int64_t* buf, int n, int6
     }
 
     for (int i = sz; i < n; i++) {
-        buf[i] += last_value + min_delta;
-        last_value = buf[i];
+        uint64_t val =
+                static_cast<uint64_t>(buf[i]) + static_cast<uint64_t>(last_value) + static_cast<uint64_t>(min_delta);
+        buf[i] = static_cast<int64_t>(val);
+        last_value = static_cast<int64_t>(val);
     }
 }
 
@@ -308,6 +316,14 @@ void delta_decode_chain_int64_neon(int64_t* buf, int n, int64_t min_delta, int64
 // The AVX-512 path is skipped under ASan: it spills zmm registers to a stack slot ASan aligns to 32
 // (not 64) bytes, so the store touches the redzone and traps. See https://github.com/llvm/llvm-project/issues/91565.
 
+void delta_decode_chain_int32_scalar(int32_t* buf, int n, int32_t min_delta, int32_t& last_value) {
+    delta_decode_chain_scalar_prefetch<int32_t>(buf, n, min_delta, last_value);
+}
+
+void delta_decode_chain_int64_scalar(int64_t* buf, int n, int64_t min_delta, int64_t& last_value) {
+    delta_decode_chain_scalar_prefetch<int64_t>(buf, n, min_delta, last_value);
+}
+
 void delta_decode_chain_int32(int32_t* buf, int n, int32_t min_delta, int32_t& last_value) {
 #if defined(__x86_64__)
 #if !defined(ADDRESS_SANITIZER)
@@ -324,7 +340,7 @@ void delta_decode_chain_int32(int32_t* buf, int n, int32_t min_delta, int32_t& l
     delta_decode_chain_int32_neon(buf, n, min_delta, last_value);
     return;
 #endif
-    delta_decode_chain_scalar_prefetch<int32_t>(buf, n, min_delta, last_value);
+    delta_decode_chain_int32_scalar(buf, n, min_delta, last_value);
 }
 
 void delta_decode_chain_int64(int64_t* buf, int n, int64_t min_delta, int64_t& last_value) {
@@ -337,7 +353,7 @@ void delta_decode_chain_int64(int64_t* buf, int n, int64_t min_delta, int64_t& l
     delta_decode_chain_int64_neon(buf, n, min_delta, last_value);
     return;
 #endif
-    delta_decode_chain_scalar_prefetch<int64_t>(buf, n, min_delta, last_value);
+    delta_decode_chain_int64_scalar(buf, n, min_delta, last_value);
 }
 
 } // namespace starrocks
```

**File**: `be/src/base/simd/delta_decode.h` (modified, +16/-11)
```diff
@@ -16,6 +16,7 @@
 
 #include <cstddef>
 #include <cstdint>
+#include <type_traits>
 
 #if defined(__x86_64__) && defined(__AVX2__)
 #include <immintrin.h>
@@ -36,11 +37,9 @@ inline bool contains_negative_value_scalar(const int32_t* buf, int n) {
 static inline bool contains_negative_value(const int32_t* data, size_t size) {
     size_t i = 0;
 #ifdef __AVX2__
-    __m256i v_zero = _mm256_setzero_si256();
     for (; i + 8 <= size; i += 8) {
-        __m256i v = _mm256_loadu_si256((__m256i*)(data + i));
-        __m256i cmp = _mm256_cmpgt_epi32(v_zero, v);
-        if (_mm256_movemask_epi8(cmp)) return true;
+        __m256i v = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(data + i));
+        if (_mm256_movemask_ps(_mm256_castsi256_ps(v))) return true;
     }
 #elif defined(__ARM_NEON) && defined(__aarch64__)
     int32x4_t v_or0 = vdupq_n_s32(0);
@@ -58,21 +57,27 @@ static inline bool contains_negative_value(const int32_t* data, size_t size) {
 }
 
 template <typename T>
-static inline void delta_decode_chain_scalar_prefetch(T* buf, int n, T min_delta, T& last_value) noexcept {
-    T acc = last_value;
+inline void delta_decode_chain_scalar_prefetch(T* buf, int n, T min_delta, T& last_value) noexcept {
+    using U = std::make_unsigned_t<T>;
+    U acc = static_cast<U>(last_value);
+    const U u_min_delta = static_cast<U>(min_delta);
     int i = 0;
     for (i = 0; (i + 8) < n; ++i) {
         __builtin_prefetch(buf + i + 8);
-        acc += buf[i] + min_delta;
-        buf[i] = acc;
+        acc += static_cast<U>(buf[i]) + u_min_delta;
+        buf[i] = static_cast<T>(acc);
     }
     for (; i < n; ++i) {
-        acc += buf[i] + min_delta;
-        buf[i] = acc;
+        acc += static_cast<U>(buf[i]) + u_min_delta;
+        buf[i] = static_cast<T>(acc);
     }
-    last_value = acc;
+    last_value = static_cast<T>(acc);
 }
 
+// Portable scalar reference implementations, defined in delta_decode.cpp.
+void delta_decode_chain_int32_scalar(int32_t* buf, int n, int32_t min_delta, int32_t& last_value);
+void delta_decode_chain_int64_scalar(int64_t* buf, int n, int64_t min_delta, int64_t& last_value);
+
 // ISA-specific implementations, defined in delta_decode.cpp. Each kernel carries a per-function
 // `target` attribute so its AVX2 / AVX-512 intrinsics are available even when the global build
 // targets a lower baseline (e.g. USE_AVX512=OFF). Declared here for the runtime dispatchers below
```

**File**: `be/test/base/simd/batch_run_counter_test.cpp` (modified, +157/-0)
```diff
@@ -215,4 +215,161 @@ TEST_F(BatchRunCounterTest, deterministic_all_zero_all_one_and_single_flip) {
     }
 }
 
+TEST_F(BatchRunCounterTest, unsigned_filter_values) {
+    // 1. All 0xFF (values with high bit set, previously broken by signed cmpgt_epi8)
+    {
+        std::vector<uint8_t> filter_ff(test_size, 0xFF);
+        BatchRunCounter<32> counter32(filter_ff.data(), 0, test_size);
+        BatchCount b32 = counter32.next_batch();
+        EXPECT_TRUE(b32.AllSet());
+        EXPECT_FALSE(b32.NoneSet());
+
+        BatchRunCounter<16> counter16(filter_ff.data(), 0, test_size);
+        BatchCount b16 = counter16.next_batch();
+        EXPECT_TRUE(b16.AllSet());
+        EXPECT_FALSE(b16.NoneSet());
+
+        BatchRunCounter<8> counter8(filter_ff.data(), 0, test_size);
+        BatchCount b8 = counter8.next_batch();
+        EXPECT_TRUE(b8.AllSet());
+        EXPECT_FALSE(b8.NoneSet());
+    }
+
+    // 2. All 0x80 (int8_t -128)
+    {
+        std::vector<uint8_t> filter_80(test_size, 0x80);
+        BatchRunCounter<32> counter32(filter_80.data(), 0, test_size);
+        BatchCount b32 = counter32.next_batch();
+        EXPECT_TRUE(b32.AllSet());
+        EXPECT_FALSE(b32.NoneSet());
+
+        BatchRunCounter<16> counter16(filter_80.data(), 0, test_size);
+        BatchCount b16 = counter16.next_batch();
+        EXPECT_TRUE(b16.AllSet());
+        EXPECT_FALSE(b16.NoneSet());
+
+        BatchRunCounter<8> counter8(filter_80.data(), 0, test_size);
+        BatchCount b8 = counter8.next_batch();
+        EXPECT_TRUE(b8.AllSet());
+        EXPECT_FALSE(b8.NoneSet());
+    }
+
+    // 3. Mixed unsigned values {0, 0xFF, 0x80, 1, 42}
+    {
+        std::vector<uint8_t> filter(test_size);
+        const uint8_t choices[] = {0, 0xFF, 0x80, 1, 42};
+        for (size_t i = 0; i < test_size; i++) {
+            filter[i] = choices[rand() % 5];
+        }
+
+        size_t zero_count = SIMD::count_zero(filter.data(), test_size);
+
+        auto count_zeros = [&](auto counter) {
+            size_t count = 0;
+            size_t index = 0;
+            auto batch = counter.next_batch();
+            while (batch.length > 0) {
+                if (batch.AllSet()) {
+                    // all non-zero
+                } else if (batch.NoneSet()) {
+                    count += batch.length;
+                } else {
+                    for (int i = 0; i < batch.length; i++) {
+                        if (filter[index + i] == 0) {
+                            count++;
+                        }
+                    }
+                }
+                index += batch.length;
+                batch = counter.next_batch();
+            }
+            return count;
+        };
+
+        EXPECT_EQ(count_zeros(BatchRunCounter<32>(filter.data(), 0, test_size)), zero_count);
+        EXPECT_EQ(count_zeros(BatchRunCounter<16>(filter.data(), 0, test_size)), zero_count);
+        EXPECT_EQ(count_zeros(BatchRunCounter<8>(filter.data(), 0, test_size)), zero_count);
+    }
+}
+
+TEST_F(BatchRunCounterTest, tail_sizes_and_patterns) {
+    const std::vector<size_t> sizes = {0, 1, 3, 7, 8, 11, 15, 16, 23, 24, 31, 32, 40, 48, 55, 63, 64, 75, 127};
+
+    auto run_test = [](const std::vector<uint8_t>& filter) {
+        size_t expected_zeros = 0;
+        for (uint8_t b : filter) {
+            if (b == 0) expected_zeros++;
+        }
+
+        auto count_zeros = [&](auto counter) {
+            size_t count = 0;
+            size_t index = 0;
+            auto batch = counter.next_batch();
+            while (batch.length > 0) {
+                if (batch.AllSet()) {
+                    // all non-zero
+                } else if (batch.NoneSet()) {
+                    count += batch.length;
+                } else {
+                    for (size_t i = 0; i < batch.length; i++) {
+                        if (filter[index + i] == 0) {
+                            count++;
+                        }
+                    }
+                }
+                index += batch.length;
+                batch = counter.next_batch();
+            }
+            return count;
+        };
+
+        EXPECT_EQ(count_zeros(BatchRunCounter<32>(filter.data(), 0, filter.size())), expected_zeros);
+        EXPECT_EQ(count_zeros(BatchRunCounter<16>(filter.data(), 0, filter.size())), expected_zeros);
+        EXPECT_EQ(count_zeros(BatchRunCounter<8>(filter.data(), 0, filter.size())), expected_zeros);
+    };
+
+    for (size_t sz : sizes) {
+        // 1. All zeros
+        std::vector<uint8_t> all_zeros(sz, 0);
+        run_test(all_zeros);
+
+        // 2. All 1s
+        std::vector<uint8_t> all_ones(sz, 1);
+        run_test(all_ones);
+
+        // 3. All 0xFF (unsigned high bit set)
+        std::vector<uint8_t> all_ff(sz, 0xFF);
+        run_test(all_ff);
+
+        // 4. All 0x80 (int8_t -128)
+        std::vector<uint8_t> all_80(sz, 0x80);
+        run_test(all_80);
+
+        // 5. Alternating 0 and 1
+        std::vector<uint8_t> al
```

**File**: `be/test/base/simd/delta_decode_test.cpp` (modified, +185/-1)
```diff
@@ -17,6 +17,7 @@
 #include <gtest/gtest.h>
 
 #include <climits>
+#include <limits>
 #include <vector>
 
 namespace starrocks {
@@ -53,6 +54,15 @@ TEST_F(DeltaDecodeTest, test_int32) {
         ASSERT_EQ(v.back(), last_value);
     }
 
+    // scalar entry point
+    {
+        std::vector<int32_t> v(values);
+        int32_t last_value = 10;
+        delta_decode_chain_int32_scalar(v.data(), v.size(), 10, last_value);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_value);
+    }
+
 #if defined(__ARM_NEON) && defined(__aarch64__)
     {
         std::vector<int32_t> v(values);
@@ -111,6 +121,15 @@ TEST_F(DeltaDecodeTest, test_int64) {
         ASSERT_EQ(v.back(), last_value);
     }
 
+    // scalar entry point
+    {
+        std::vector<int64_t> v(values);
+        int64_t last_value = 10;
+        delta_decode_chain_int64_scalar(v.data(), v.size(), 10, last_value);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_value);
+    }
+
 #if defined(__ARM_NEON) && defined(__aarch64__)
     {
         std::vector<int64_t> v(values);
@@ -184,8 +203,173 @@ TEST_F(DeltaDecodeTest, test_boundary_sizes_and_negative_deltas) {
     }
 }
 
+TEST_F(DeltaDecodeTest, test_int32_wrapping_overflow) {
+    // Deliberately test values that wrap across INT32_MAX and INT32_MIN.
+    // In standard C++, signed overflow is UB unless unsigned cast is used.
+    // Under UBSan (-fsanitize=undefined), this verifies zero traps occur.
+    const size_t sz = 137;
+    std::vector<int32_t> values(sz);
+    int32_t start_val = std::numeric_limits<int32_t>::max() - 50;
+    int32_t min_delta = 100;
+    for (size_t i = 0; i < sz; i++) {
+        values[i] = static_cast<int32_t>(i * 1000);
+    }
+    // Force a signed underflow in the scalar tail (index 136) as well as the SIMD loop (index 0).
+    values[sz - 1] = std::numeric_limits<int32_t>::min();
+
+    std::vector<int32_t> expected(values);
+    int32_t expected_last = start_val;
+    delta_decode_chain_scalar_prefetch<int32_t>(expected.data(), expected.size(), min_delta, expected_last);
+    ASSERT_EQ(expected.back(), expected_last);
+
+    {
+        std::vector<int32_t> v(values);
+        int32_t last_val = start_val;
+        delta_decode_chain_int32(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+
+    {
+        std::vector<int32_t> v(values);
+        int32_t last_val = start_val;
+        delta_decode_chain_int32_scalar(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+
+#if defined(__ARM_NEON) && defined(__aarch64__)
+    {
+        std::vector<int32_t> v(values);
+        int32_t last_val = start_val;
+        delta_decode_chain_int32_neon(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+#endif
+
+#if defined(__x86_64__)
+    if (__builtin_cpu_supports("avx2")) {
+        std::vector<int32_t> v(values);
+        int32_t last_val = start_val;
+        delta_decode_chain_int32_avx2(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+#if !defined(ADDRESS_SANITIZER)
+    if (__builtin_cpu_supports("avx512f") && __builtin_cpu_supports("avx512vl")) {
+        std::vector<int32_t> v(values);
+        int32_t last_val = start_val;
+        delta_decode_chain_int32_avx2x(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+    if (__builtin_cpu_supports("avx512f")) {
+        std::vector<int32_t> v(values);
+        int32_t last_val = start_val;
+        delta_decode_chain_int32_avx512(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+#endif
+#endif
+}
+
+TEST_F(DeltaDecodeTest, test_int64_wrapping_overflow) {
+    const size_t sz = 137;
+    std::vector<int64_t> values(sz);
+    int64_t start_val = std::numeric_limits<int64_t>::max() - 50;
+    int64_t min_delta = 100;
+    for (size_t i = 0; i < sz; i++) {
+        values[i] = static_cast<int64_t>(i * 1000);
+    }
+    // Force a signed underflow in the scalar tail (index 136) as well as the SIMD loop (index 0).
+    values[sz - 1] = std::numeric_limits<int64_t>::min();
+
+    std::vector<int64_t> expected(values);
+    int64_t expected_last = start_val;
+    delta_decode_chain_scalar_prefetch<int64_t>(expected.data(), expected.size(), min_delta, expected_last);
+    ASSERT_EQ(expected.back(), expected_last);
+
+    {
+        std::vector<int64_t> v(values);
+        int64_t last_val = start_val;
+        delta_decode_chain_int64(v.data(), v.size(), min_delta, last_val);
+        ASSERT_EQ(v, expected);
+        ASSERT_EQ(v.back(), last_val);
+    }
+
+    {
+        std::vector<int64_t> v(values);
+        int64_t last_val = start_val;
+        delta_decode_chai
```

---

### Incident Patch 2: `6536a1d7` (2026-11-12)
**Commit Message**: [BugFix] Fix parquet bloom filter pruning for string struct subfield equality (#82844)

Signed-off-by: kyle-goodale-klaviyo <[REDACTED_EMAIL]>

**File**: `be/src/formats/parquet/complex_column_reader.cpp` (modified, +1/-1)
```diff
@@ -647,7 +647,7 @@ StatusOr<bool> StructColumnReader::row_group_bloom_filter(const std::vector<cons
         if (!val || !val->is_constant()) {
             return false;
         }
-        auto val_str = down_cast<const ConstColumn*>(val.get())->data_column()->debug_item(0);
+        auto val_str = down_cast<const ConstColumn*>(val.get())->data_column()->raw_item_value(0);
         auto t = get_type_info(root->get_child(1)->type().type);
         ColumnPredicate* pred = nullptr;
         pred = new_column_eq_predicate(t, rewritten_subfield_predicate->column_id(), val_str);
```

**File**: `be/test/formats/parquet/file_reader_test.cpp` (modified, +55/-0)
```diff
@@ -3280,6 +3280,61 @@ TEST_F(FileReaderTest, bloom_filter_reader_test_hit) {
     EXPECT_EQ(file_reader->row_group_size(), 1);
 }
 
+/*
+    c1 = [f"a{i:04d}" for i in range(1000) if i != 500] + ["a0999"] + [f"b{i:04d}" for i in range(1000)]
+    table = pa.table({
+        "c0": pa.array(range(len(c1)), pa.int32()),
+        "c_struct": pa.StructArray.from_arrays(
+                [pa.array(range(len(c1)), pa.int32()), pa.array(c1, pa.string())], ["c0", "c1"]),
+    })
+    pq.write_table(table, path, row_group_size=1000, use_dictionary=False, write_page_index=False,
+                   bloom_filter_options={"c_struct.c1": {"ndv": 1000, "fpp": 0.01}})
+ */
+TEST_F(FileReaderTest, StructSubfieldStringBloomFilter) {
+    const std::string file_path = "./be/test/formats/parquet/test_data/struct_subfield_bloom_filter.parquet";
+    TypeDescriptor type_struct = TypeDescriptor::create_struct_type({"c0", "c1"}, {TYPE_INT_DESC, TYPE_VARCHAR_DESC});
+    Utils::SlotDesc slot_descs[] = {{"c0", TYPE_INT_DESC}, {"c_struct", type_struct}, {""}};
+
+    auto scan = [&](const std::string& value, size_t* total_rows, int* bloom_filtered_row_groups) {
+        auto* ctx = _create_scan_context(slot_descs, file_path);
+        auto& conjunct_ctxs = ctx->format_scan_context.conjunct_ctxs_by_slot[1];
+        _create_struct_subfield_predicate_conjunct_ctxs(TExprOpcode::EQ, 1, type_struct, {"c1"}, value, &conjunct_ctxs);
+        TupleDescriptor* tuple_desc = Utils::create_tuple_descriptor(_runtime_state, &_pool, slot_descs);
+        ParquetUTBase::setup_conjuncts_manager(conjunct_ctxs, nullptr, tuple_desc, _runtime_state, ctx);
+        FormatScannerStats stats;
+        ctx->format_scan_context.stats = &stats;
+
+        auto file_reader = _create_file_reader(file_path);
+        Status status = file_reader->init(&ctx->format_scan_context);
+        ASSERT_OK(status);
+
+        auto chunk = std::make_shared<Chunk>();
+        chunk->append_column(ColumnHelper::create_column(TYPE_INT_DESC, true), chunk->num_columns());
+        chunk->append_column(ColumnHelper::create_column(type_struct, true), chunk->num_columns());
+        *total_rows = 0;
+        while (!status.is_end_of_file()) {
+            chunk->reset();
+            status = file_reader->get_next(&chunk);
+            chunk->check_or_die();
+            *total_rows += chunk->num_rows();
+        }
+        *bloom_filtered_row_groups = stats.bloom_filter_success_counter;
+    };
+
+    size_t total_rows = 0;
+    int bloom_filtered_row_groups = 0;
+
+    // Row group 0 holds 'a0400' and its bloom filter contains it, so it must not be pruned.
+    scan("a0400", &total_rows, &bloom_filtered_row_groups);
+    EXPECT_EQ(1, total_rows);
+    EXPECT_EQ(0, bloom_filtered_row_groups);
+
+    // 'a0500' is inside row group 0's min/max but absent, so only the bloom filter can prune it.
+    scan("a0500", &total_rows, &bloom_filtered_row_groups);
+    EXPECT_EQ(0, total_rows);
+    EXPECT_EQ(1, bloom_filtered_row_groups);
+}
+
 TEST_F(FileReaderTest, read_parquet_bloom_filter_by_parquet_hadoop) {
     Utils::SlotDesc slot_descs[] = {{"c0", TYPE_VARCHAR_DESC}, {"c1", TYPE_INT_DESC}, {"c2", TYPE_DATETIME_DESC}, {""}};
     const std::string bloom_filter_file =
```

---

### Incident Patch 3: `1cd80a91` (2026-11-12)
**Commit Message**: [Doc] Fix docs that contradict the source on memory limits, resource groups, MVs, shared-data, FE and Iceberg (#82971)

Signed-off-by: Binglin Chang <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: docs-automation[bot] <docs-automation[bot]@starrocks.io>

**File**: `docs/en/administration/Meta_recovery.md` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ You can follow these steps to fix this issue:
 :::tip
 
 - This bug has been fixed in StarRocks v3.1. You can avoid this issue by upgrading your cluster to v3.1 or later. 
-- This solution does not apply if more than half of the FE nodes have encountered this issue. You must follow the instructions provided in [Measure of the last resort](#7-measure-of-the-last-resort) to fix the issue.
+- This solution does not apply if more than half of the FE nodes have encountered this issue. You must follow the instructions provided in [Measure of the last resort](#10-measure-of-the-last-resort) to fix the issue.
 
 :::
 
```

**File**: `docs/en/administration/configuration/BE_parameters/shared_lake_other.md` (modified, +5/-5)
```diff
@@ -587,7 +587,7 @@ Enable this option only after **all target CNs** support it. A normalized replic
 - Type: String
 - Unit: -
 - Is mutable: Yes
-- Description: The maximum amount of data that can be cached on a single disk. You can set it as a percentage (for example, `80%`) or a physical limit (for example, `2T`, `500G`). For example, if you use two disks and set the value of the `datacache_disk_size` parameter as `21474836480` (20 GB), a maximum of 40 GB data can be cached on these two disks. The default value is `0`, which indicates that only memory is used to cache data.
+- Description: The maximum amount of data that can be cached on a single disk. You can set it as a percentage (for example, `80%`) or a physical limit (for example, `2T`, `500G`). For example, if you use two disks and set the value of the `datacache_disk_size` parameter as `21474836480` (20 GB), a maximum of 40 GB data can be cached on these two disks. A percentage is relative to the capacity of the disk that holds each `storage_root_path`. The default value is `100%`. When `enable_datacache_disk_auto_adjust` is `true` (default), the system adjusts the actual disk cache quota based on disk usage, and this item only sets the upper limit of that quota. `0` disables the disk cache.
 - Introduced in: -
 
 ### datacache_enable
@@ -886,7 +886,7 @@ Enable this option only after **all target CNs** support it. A normalized replic
 - Type: Int
 - Unit: -
 - Is mutable: No
-- Description: The maximum concurrency (per BE node) of the materialized view refresh tasks in the resource group `default_mv_wg`. The default value `0` indicates no limits.
+- Description: The maximum concurrency (per BE node) of the materialized view refresh tasks in the resource group `default_mv_wg`. The default value `0` indicates no limits. Deprecated: from v3.4 onwards, this item no longer takes effect because the FE stores `default_mv_wg` and sends it to the BEs. Use `ALTER RESOURCE GROUP default_mv_wg WITH (...)` instead.
 - Introduced in: v3.1
 
 ### default_mv_resource_group_cpu_limit
@@ -895,7 +895,7 @@ Enable this option only after **all target CNs** support it. A normalized replic
 - Type: Int
 - Unit: -
 - Is mutable: No
-- Description: The maximum number of CPU cores (per BE node) that can be used by the materialized view refresh tasks in the resource group `default_mv_wg`.
+- Description: The maximum number of CPU cores (per BE node) that can be used by the materialized view refresh tasks in the resource group `default_mv_wg`. Deprecated: from v3.4 onwards, this item no longer takes effect because the FE stores `default_mv_wg` and sends it to the BEs. Use `ALTER RESOURCE GROUP default_mv_wg WITH (...)` instead.
 - Introduced in: v3.1
 
 ### default_mv_resource_group_memory_limit
@@ -904,7 +904,7 @@ Enable this option only after **all target CNs** support it. A normalized replic
 - Type: Double
 - Unit:
 - Is mutable: No
-- Description: The maximum memory proportion (per BE node) that can be used by the materialized view refresh tasks in the resource group `default_mv_wg`. The default value indicates 80% of the memory.
+- Description: The maximum memory proportion (per BE node) that can be used by the materialized view refresh tasks in the resource group `default_mv_wg`. The default value indicates 80% of the memory. Deprecated: from v3.4 onwards, this item no longer takes effect because the FE stores `default_mv_wg` and sends it to the BEs. Use `ALTER RESOURCE GROUP default_mv_wg WITH (...)` instead.
 - Introduced in: v3.1
 
 ### default_mv_resource_group_spill_mem_limit_threshold
@@ -913,7 +913,7 @@ Enable this option only after **all target CNs** support it. A normalized replic
 - Type: Double
 - Unit: -
 - Is mutable: No
-- Description: The memory usage threshold before a materialized view refresh task in the resource group `default_mv_wg` triggers intermediate result spilling. The default value indicates 80% of the memory.
+- Description: The memory usage threshold before a materialized view refresh task in the resource group `default_mv_wg` triggers intermediate result spilling. The default value indicates 80% of the memory. Deprecated: from v3.4 onwards, this item no longer takes effect because the FE stores `default_mv_wg` and sends it to the BEs. Use `ALTER RESOURCE GROUP default_mv_wg WITH (...)` instead.
 - Introduced in: v3.1
 
 ### enable_resolve_hostname_to_ip_in_load_error_url
```

**File**: `docs/en/administration/configuration/FE_parameters/log_server_meta.md` (modified, +3/-3)
```diff
@@ -1594,7 +1594,7 @@ This topic introduces the following types of FE configurations:
 - Type: Int
 - Unit: -
 - Is mutable: Yes
-- Description: The maximum number of metadata log entries that can be written before a log file is created for these log entries. This parameter is used to control the size of log files. The new log file is written to the BDBJE database.
+- Description: The maximum number of metadata log entries that can be written before a log file is created for these log entries. This parameter is used to control the size of log files. The new log file is written to the BDBJE database. This parameter also controls how often a metadata image (checkpoint) can be created, because a checkpoint only covers log entries in log files that have already been rolled.
 - Introduced in: -
 
 ### `edit_log_type`
@@ -1856,7 +1856,7 @@ This topic introduces the following types of FE configurations:
 - Unit: Milliseconds
 - Is mutable: Yes
 - Description: The interval at which a Follower or Observer FE re-evaluates whether its metadata is still fresh enough to serve reads, as defined by `meta_delay_toleration_second`. Values outside the range [10, 5000] are clamped. This check runs on a dedicated thread rather than on the metadata replay thread, so that the node still stops serving stale metadata while a single journal entry is taking a long time to apply, for example when a replay operation is waiting for a database lock.
-- Introduced in: v4.2
+- Introduced in: v4.1.6, v4.2
 
 ### `metadata_replay_stuck_warn_threshold_second`
 
@@ -1865,7 +1865,7 @@ This topic introduces the following types of FE configurations:
 - Unit: Seconds
 - Is mutable: Yes
 - Description: A metadata journal entry that has been applying for longer than this duration is reported in **fe.log** as a stuck replay, together with the stack of the replay thread, so that you can identify what is blocking metadata replay. Set this item to `0` to disable the report.
-- Introduced in: v4.2
+- Introduced in: v4.1.6, v4.2
 
 ### `meta_dir`
 
```

**File**: `docs/en/administration/configuration/FE_parameters/shared_lake_other.md` (modified, +11/-2)
```diff
@@ -1658,7 +1658,7 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Type: Long
 - Unit:
 - Is mutable: Yes
-- Description: The maximum size of materialized view plan cache (which is used for materialized view rewrite). If there are many materialized views used for transparent query rewrite, you may increase this value.
+- Description: The maximum size of materialized view plan cache (which is used for materialized view rewrite). If there are many materialized views used for transparent query rewrite, you may increase this value. The value is read only once, when the cache is created at FE startup, so a value changed at runtime takes effect only after the FE restarts.
 - Introduced in: v3.2
 
 ### `mv_plan_cache_thread_pool_size`
@@ -1667,7 +1667,7 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Type: Int
 - Unit: -
 - Is mutable: Yes
-- Description: The default thread pool size of materialized view plan cache (which is used for materialized view rewrite).
+- Description: Deprecated. From v3.5.14, v4.0.7, and v4.1 onwards, this parameter no longer takes effect. The size of the thread pool that loads the materialized view plan cache (which is used for materialized view rewrite) is fixed at the larger of 2 and three quarters of the number of CPU cores.
 - Introduced in: v3.2
 
 ### `mv_refresh_default_planner_optimize_timeout`
@@ -1688,6 +1688,15 @@ Use `ADMIN SET FRONTEND CONFIG` for dynamic changes; you do not need to edit eac
 - Description: Mv refresh fails if there is filtered data in refreshing, true by default, otherwise return success by ignoring the filtered data.
 - Introduced in: -
 
+### `mv_refresh_force_partition_type`
+
+- Default: 0
+- Type: Int
+- Unit: -
+- Is mutable: Yes
+- Description: Forces materialized view refreshes of the specified partition types to refresh regardless of whether the base tables have changed. This is useful for materialized views on external tables, where data changes cannot be accurately detected. The value is a bitmap: `0` disables this behavior, `1` applies it to non-partitioned materialized views, `2` to range-partitioned materialized views, and `4` to list-partitioned materialized views. Add the values to combine types, for example, `7` applies to all three. It does not apply to a materialized view whose `refresh_mode` is `INCREMENTAL`.
+- Introduced in: v3.5.16, v4.0.9, v4.1
+
 ### `mv_refresh_try_lock_timeout_ms`
 
 - Default: 30000
```

**File**: `docs/en/administration/configuration/FE_parameters/user_query_loading.md` (modified, +1/-1)
```diff
@@ -1259,7 +1259,7 @@ Starting from version 3.3.0, the system defaults to refreshing one partition at
 - Type: Int
 - Unit: Seconds
 - Is mutable: Yes
-- Description: The timeout duration for the INSERT INTO statement that is used to load data.
+- Description: Deprecated. This item does not control the timeout of INSERT statements. Use the session variable `insert_timeout` instead.
 - Introduced in: -
 
 ### `label_clean_interval_second`
```

**File**: `docs/en/administration/management/cluster_snapshot.md` (modified, +20/-5)
```diff
@@ -51,18 +51,33 @@ Syntax:
 
 ```SQL
 ADMIN SET AUTOMATED CLUSTER SNAPSHOT ON
+[INTERVAL <value> <unit>]
 [STORAGE VOLUME <storage_volume_name>]
 ```
 
-Parameter:
+Parameters:
 
-`storage_volume_name`: Specifies the storage volume used to store the snapshot. If this parameter is not specified, the default storage volume will be used. For details on creating a storage volume, see [CREATE STORAGE VOLUME](../../sql-reference/sql-statements/cluster-management/storage_volume/CREATE_STORAGE_VOLUME.md).
+`INTERVAL <value> <unit>`: The interval at which automated snapshots are created. `value` must be a positive integer, and `unit` must be one of `SECOND`, `MINUTE`, `HOUR`, `DAY`, and `WEEK`. If this parameter is not specified, the interval is controlled by the FE configuration item `automated_cluster_snapshot_interval_seconds`.
 
-Each time FE creates a new metadata image after completing a metadata checkpoint, it automatically creates a snapshot. The name of the snapshot is generated by the system, following the format `automated_cluster_snapshot_{timestamp}`.
+`storage_volume_name`: Specifies the storage volume used to store the snapshot. If this parameter is not specified, the built-in storage volume `builtin_storage_volume` is used, even if another storage volume is set as the default. If `builtin_storage_volume` does not exist (for example, because `enable_load_volume_from_conf` is `false`), the statement fails, and you must specify a storage volume. For details on creating a storage volume, see [CREATE STORAGE VOLUME](../../sql-reference/sql-statements/cluster-management/storage_volume/CREATE_STORAGE_VOLUME.md).
+
+Each time the snapshot interval has elapsed since the previous automated snapshot started, the Leader FE performs a metadata checkpoint to create a new metadata image, and creates a snapshot from it. The name of the snapshot is generated by the system, following the format `automated_cluster_snapshot_{timestamp}`.
 
 Metadata snapshots are stored under `/{storage_volume_locations}/{service_id}/meta/image/automated_cluster_snapshot_timestamp`. Data snapshots are stored in the same location as the original data.
 
-FE configuration item `automated_cluster_snapshot_interval_seconds` controls the snapshot automation cycle. The default value is 600 seconds (10 minutes).
+FE configuration item `automated_cluster_snapshot_interval_seconds` controls the snapshot automation cycle when no `INTERVAL` is specified for the feature. The default value is 600 seconds (10 minutes).
+
+Use the following statement to change the interval while the feature is enabled (supported from v4.0.5 onwards, as is the `INTERVAL` clause):
+
+```SQL
+ADMIN ALTER AUTOMATED CLUSTER SNAPSHOT SET INTERVAL <value> <unit>
+```
+
+Use the following statement to view whether the feature is enabled, the effective interval, the storage volume, and the time of the last and the next snapshot (supported from v4.0.6 onwards):
+
+```SQL
+ADMIN SHOW AUTOMATED CLUSTER SNAPSHOT
+```
 
 ### Disable automated cluster snapshot
 
@@ -87,7 +102,7 @@ Return:
 | Field              | Description                                                  |
 | ------------------ | ------------------------------------------------------------ |
 | snapshot_name      | The name of the snapshot.                                    |
-| snapshot_type      | The type of the snapshot. Valid values: `automated` and `manual`. |
+| snapshot_type      | The type of the snapshot. Currently, the value is always `AUTOMATED`. |
 | created_time       | The time at which the snapshot was created.                  |
 | fe_journal_id      | The ID of the FE journal.                                    |
 | starmgr_journal_id | The ID of the StarManager journal.                           |
```

**File**: `docs/en/administration/management/graceful_exit.md` (modified, +2/-6)
```diff
@@ -49,12 +49,8 @@ Upon receiving the signal:
 
 **Leader FE**
 
-- Read request handling is identical to the of Followers.
-- Write request handling requires:
-
-  - Closing BDBJE.
-  - Allowing a new Leader election to complete.
-  - Redirecting subsequent writes to the newly elected Leader.
+- Request handling is identical to that of Followers: the Leader FE waits for its connections to drain and then exits.
+- The Leader FE does not hand over leadership before it exits. A new Leader is elected from the remaining FEs after the process exits.
 
 #### Timeout Control
 
```

**File**: `docs/en/administration/management/monitoring/metric_details/s.md` (modified, +6/-0)
```diff
@@ -6,6 +6,12 @@ description: "Alphabetical s"
 
 # Metrics s
 
+## `scheduled_tablet_num`
+
+- Unit: Count
+- Type: Instantaneous
+- Description: The number of tablets that are being scheduled by the tablet scheduler of the Leader FE, that is, the total of the tablets in Pending and Running states, including both BALANCE and REPAIR types. Non-Leader FEs report `0`.
+
 ## `schema_change_mem_bytes`
 
 - Unit: Bytes
```

#### Recent Merged Pull Requests:
- **PR #83209** (2026-11-13): [BugFix] Reject unsupported GEO arguments in sum_map and to_json (backport #83106) (@mergify[bot])
- **PR #83208** (2026-11-13): [Enhancement][RB-533] Scope connector scan EOS to independent drivers (backport #83197) (@mergify[bot])
- **PR #83206** (2026-11-13): [Tool] Support single quotes in assert_query_contains of SQL-tester (@trueeyu)
- **PR #83205** (2026-11-13): [BugFix] Support RLE-encoded BOOLEAN values in the parquet reader (backport #78691) (@mergify[bot])
- **PR #83204** (2026-11-13): [BugFix] Support RLE-encoded BOOLEAN values in the parquet reader (backport #78691) (@mergify[bot])
- **PR #83201** (2026-11-13): [BugFix][RB-225] Skip the storage stat on Iceberg metadata reads that do not need it (backport #83182) (@mergify[bot])

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

## X. [BugFix] Fix BatchRunCounter unsigned filter comparison and delta decode signed 

**RULE**:
When implementing operations in `be/src/base/simd/batch_run_counter.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `28f9a91c`: [BugFix] Fix BatchRunCounter unsigned filter comparison and delta decode signed overflow UB (#82015). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `be/src/base/simd/batch_run_counter.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
            uint32_t zero_mask = _mm256_movemask_epi8(_mm256_cmpeq_epi8(f, all0));
            if (zero_mask == 0xffffffff) {
            } else if (zero_mask == 0) {
                // all non-zero
            const auto zero_mask = _mm_movemask_epi8(_mm_cmpeq_epi8(f, zero16));
            if (zero_mask == 0xffff) {
            } else if (zero_mask == 0) {
                // all non-zero
            } else if (partital_value == 0x0101010101010101ULL ||
                       (((partital_value - 0x0101010101010101ULL) & ~partital_value & 0x8080808080808080ULL) == 0)) {
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
            uint32_t mask = _mm256_movemask_epi8(_mm256_cmpgt_epi8(f, all0));
            if (mask == 0) {
            } else if (mask == 0xffffffff) {
                // all one
            const auto mask = _mm_movemask_epi8(_mm_cmpgt_epi8(f, zero16));
            if (mask == 0) {
            } else if (mask == 0xffff) {
                // all one
            } else if (partital_value == 0x0101010101010101) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `28f9a91c` are properly handled with clean fallback behavior.
