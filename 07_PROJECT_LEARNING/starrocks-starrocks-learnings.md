> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `7e354c62`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T16:33:52.982Z  
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
> **Harvest Timestamp**: 2026-10-28T16:33:52.977Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12213 stars

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

### Incident Patch 1: `99d51e09` (2026-10-28)
**Commit Message**: [BugFix][RB-654] Stop two Iceberg FE hangs: profile explain partition listing and OSS read-ahead wait (#81711)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/planner/IcebergScanNode.java` (modified, +31/-22)
```diff
@@ -399,28 +399,7 @@ protected String getNodeExplainString(String prefix, TExplainLevel detailLevel)
         }
 
         if (detailLevel == TExplainLevel.VERBOSE && !isResourceMappingCatalog(icebergTable.getCatalogName())) {
-            ConnectorMetadataRequestContext requestContext = new ConnectorMetadataRequestContext();
-            requestContext.setTableVersionRange(tvrVersionRange);
-            List<String> partitionNames = GlobalStateMgr.getCurrentState().getMetadataMgr().listPartitionNames(
-                    icebergTable.getCatalogName(), icebergTable.getCatalogDBName(),
-                    icebergTable.getCatalogTableName(), requestContext);
-
-            if (selectedPartitionCount == -1) {
-                if (scanRangeSource != null) {
-                    // we have to consume all scan ranges to know how many partition been selected.
-                    while (scanRangeSource.hasMoreOutput()) {
-                        scanRangeSource.getOutputs(1000);
-                    }
-                    selectedPartitionCount = scanRangeSource.selectedPartitionCount();
-                } else {
-                    selectedPartitionCount = 0;
-                }
-            }
-
-            output.append(prefix).append(
-                    String.format("partitions=%s/%s", selectedPartitionCount,
-                            partitionNames.isEmpty() ? 1 : partitionNames.size()));
-            output.append("\n");
+            appendPartitionsExplain(output, prefix);
 
             //record scan metrics, should cosume all scan ranges too.
             //print scan metrics
@@ -446,6 +425,36 @@ protected String getNodeExplainString(String prefix, TExplainLevel detailLevel)
         return output.toString();
     }
 
+    // Lists every partition of the table and may plan all scan ranges. Skipped when the finished query's plan is
+    // rendered into its profile: nothing bounds that metadata read once the query has ended.
+    private void appendPartitionsExplain(StringBuilder output, String prefix) {
+        ConnectContext connectContext = ConnectContext.get();
+        if (connectContext != null && connectContext.isExplainForProfile()) {
+            return;
+        }
+        ConnectorMetadataRequestContext requestContext = new ConnectorMetadataRequestContext();
+        requestContext.setTableVersionRange(tvrVersionRange);
+        List<String> partitionNames = GlobalStateMgr.getCurrentState().getMetadataMgr().listPartitionNames(
+                icebergTable.getCatalogName(), icebergTable.getCatalogDBName(),
+                icebergTable.getCatalogTableName(), requestContext);
+        if (selectedPartitionCount == -1) {
+            if (scanRangeSource != null) {
+                // we have to consume all scan ranges to know how many partition been selected.
+                while (scanRangeSource.hasMoreOutput()) {
+                    scanRangeSource.getOutputs(1000);
+                }
+                selectedPartitionCount = scanRangeSource.selectedPartitionCount();
+            } else {
+                selectedPartitionCount = 0;
+            }
+        }
+
+        output.append(prefix).append(
+                String.format("partitions=%s/%s", selectedPartitionCount,
+                        partitionNames.isEmpty() ? 1 : partitionNames.size()));
+        output.append("\n");
+    }
+
     @Override
     protected void toThrift(TPlanNode msg) {
         msg.node_type = TPlanNodeType.HDFS_SCAN_NODE;
```

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/ConnectContext.java` (modified, +12/-0)
```diff
@@ -234,6 +234,10 @@ public class ConnectContext {
 
     protected StatementBase.ExplainLevel explainLevel;
 
+    // Set while the finished query's plan is rendered into its profile; scan nodes skip explain lines that read
+    // remote metadata, since nothing bounds that read after the query has ended.
+    protected boolean explainForProfile = false;
+
     protected TWorkGroup resourceGroup;
 
     protected volatile boolean isPending = false;
@@ -1132,6 +1136,14 @@ public void setExplainLevel(StatementBase.ExplainLevel explainLevel) {
         this.explainLevel = explainLevel;
     }
 
+    public boolean isExplainForProfile() {
+        return explainForProfile;
+    }
+
+    public void setExplainForProfile(boolean explainForProfile) {
+        this.explainForProfile = explainForProfile;
+    }
+
     public TWorkGroup getResourceGroup() {
         return resourceGroup;
     }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/StmtExecutor.java` (modified, +2/-0)
```diff
@@ -1823,8 +1823,10 @@ private void maybeEmbedExplainPlanInProfile(RuntimeProfile profile, ExecPlan pla
             String explainPlan;
             try {
                 sv.setEnableDesensitizeExplain(forceDesensitize);
+                context.setExplainForProfile(true);
                 explainPlan = plan.getExplainString(TExplainLevel.COSTS);
             } finally {
+                context.setExplainForProfile(false);
                 sv.setEnableDesensitizeExplain(prevDesensitize);
             }
             // Defense in depth: also strip credential-bearing literals (e.g. FILES("...")
```

**File**: `fe/fe-core/src/test/java/com/starrocks/qe/StmtExecutorTest.java` (modified, +1/-0)
```diff
@@ -1373,6 +1373,7 @@ public String getWarehouseComputeResourceName(ComputeResource computeResource) {
         String embedded = onSummary.getInfoString(ProfileKeyDictionary.EXPLAIN_PLAN);
         Assertions.assertNotNull(embedded,
                 "ExplainPlan must be embedded when enable_explain_in_profile is true");
+        Assertions.assertFalse(onCtx.isExplainForProfile(), "Embedding must reset explainForProfile after rendering");
         Assertions.assertTrue(embedded.contains("PLAN FRAGMENT"),
                 "Embedded explain plan should contain rendered fragment headers");
         Assertions.assertTrue(embedded.contains("OlapScanNode"),
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/IcebergExplainInProfileTest.java` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
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
+import org.junit.jupiter.api.Assertions;
+import org.junit.jupiter.api.Test;
+
+/**
+ * The partition line of an Iceberg scan lists every partition of the table. The plan embedded into a finished
+ * query's profile (enable_explain_in_profile) skips it, since nothing bounds that metadata read after the query.
+ */
+public class IcebergExplainInProfileTest extends ConnectorPlanTestBase {
+
+    @Test
+    public void testExplainForProfileSkipsPartitionLine() throws Exception {
+        String sql = "select * from iceberg0.unpartitioned_db.t0";
+        String plan = getVerboseExplain(sql);
+        Assertions.assertTrue(plan.contains("partitions="), plan);
+
+        connectContext.setExplainForProfile(true);
+        try {
+            plan = getVerboseExplain(sql);
+        } finally {
+            connectContext.setExplainForProfile(false);
+        }
+        Assertions.assertTrue(plan.contains("IcebergScanNode"), plan);
+        Assertions.assertFalse(plan.contains("partitions="), plan);
+    }
+}
```

**File**: `java-extensions/hadoop-ext/src/main/java/org/apache/hadoop/fs/aliyun/oss/ReadBuffer.java` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
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
+// This file is based on code available under the Apache license here:
+// https://github.com/apache/hadoop/blob/rel/release-3.4.3/hadoop-tools/hadoop-aliyun/src/main/java/org/apache/hadoop/fs/aliyun/oss/ReadBuffer.java
+
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one
+ * or more contributor license agreements.  See the NOTICE file
+ * distributed with this work for additional information
+ * regarding copyright ownership.  The ASF licenses this file
+ * to you under the Apache License, Version 2.0 (the
+ * "License"); you may not use this file except in compliance
+ * with the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.hadoop.fs.aliyun.oss;
+
+import org.slf4j.Logger;
+import org.slf4j.LoggerFactory;
+
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.locks.Condition;
+import java.util.concurrent.locks.ReentrantLock;
+
+/**
+ * This class is used by {@link AliyunOSSInputStream}
+ * and {@link AliyunOSSFileReaderTask} to buffer data that read from oss.
+ *
+ * StarRocks: {@link #await} is bounded. AliyunOSSInputStream.reopen() waits here for the read-ahead task to fill the
+ * buffer, but that task can be lost without signalling: a shut-down executor only logs the rejected task, and an
+ * Error thrown inside the task skips signalAll(). The reader then parked forever with no timeout. After the bound,
+ * the buffer is marked ERROR, so reopen() fails with an IOException instead.
+ */
+public class ReadBuffer {
+    private static final Logger LOG = LoggerFactory.getLogger(ReadBuffer.class);
+
+    // Far above a 512 KB part read that succeeds or fails through the OSS client's own timeouts and retries.
+    static long awaitTimeoutNanos = TimeUnit.MINUTES.toNanos(10);
+
+    enum STATUS {
+        INIT, SUCCESS, ERROR
+    }
+
+    private final ReentrantLock lock = new ReentrantLock();
+
+    private Condition readyCondition = lock.newCondition();
+
+    private byte[] buffer;
+    private STATUS status;
+    private long byteStart;
+    private long byteEnd;
+
+    public ReadBuffer(long byteStart, long byteEnd) {
+        this.buffer = new byte[(int) (byteEnd - byteStart) + 1];
+
+        this.status = STATUS.INIT;
+        this.byteStart = byteStart;
+        this.byteEnd = byteEnd;
+    }
+
+    public void lock() {
+        lock.lock();
+    }
+
+    public void unlock() {
+        lock.unlock();
+    }
+
+    public void await(STATUS waitStatus) throws InterruptedException {
+        long remainingNanos = awaitTimeoutNanos;
+        while (this.status == waitStatus) {
+            if (remainingNanos <= 0) {
+                LOG.warn("Read-ahead of bytes [{}, {}] did not finish within {} s, failing the read",
+                        byteStart, byteEnd, TimeUnit.NANOSECONDS.toSeconds(awaitTimeoutNanos));
+                this.status = STATUS.ERROR;
+                return;
+            }
+            remainingNanos = readyCondition.awaitNanos(remainingNanos);
+        }
+    }
+
+    public void signalAll() {
+        readyCondition.signalAll();
+    }
+
+    public byte[] getBuffer() {
+        return buffer;
+    }
+
+    public STATUS getStatus() {
+        return status;
+    }
+
+    public void setStatus(STATUS status) {
+        this.status = status;
+    }
+
+    public long getByteStart() {
+        return byteStart;
+    }
+
+    public long getByteEnd() {
+        return byteEnd;
+    }
+}
```

**File**: `java-extensions/hadoop-ext/src/test/java/org/apache/hadoop/fs/aliyun/oss/ReadBufferTest.java` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
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
+package org.apache.hadoop.fs.aliyun.oss;
+
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Assertions;
+import org.junit.jupiter.api.BeforeEach;
+import org.junit.jupiter.api.Test;
+
+import java.util.concurrent.TimeUnit;
+
+public class ReadBufferTest {
+    private long previousTimeoutNanos;
+
+    @BeforeEach
+    public void setUp() {
+        previousTimeoutNanos = ReadBuffer.awaitTimeoutNanos;
+    }
+
+    @AfterEach
+    public void tearDown() {
+        ReadBuffer.awaitTimeoutNanos = previousTimeoutNanos;
+    }
+
+    @Test
+    public void testLostReadAheadTaskFailsTheWaitInsteadOfHanging() throws Exception {
+        ReadBuffer.awaitTimeoutNanos = TimeUnit.MILLISECONDS.toNanos(100);
+        // No task ever fills or signals this buffer, as when the executor dropped it.
+        ReadBuffer readBuffer = new ReadBuffer(0, 9);
+        readBuffer.lock();
+        try {
+            readBuffer.await(ReadBuffer.STATUS.INIT);
+        } finally {
+            readBuffer.unlock();
+        }
+        Assertions.assertEquals(ReadBuffer.STATUS.ERROR, readBuffer.getStatus());
+    }
+
+    @Test
+    public void testSignalledReadAheadTaskEndsTheWait() throws Exception {
+        ReadBuffer.awaitTimeoutNanos = TimeUnit.MINUTES.toNanos(1);
+        ReadBuffer readBuffer = new ReadBuffer(0, 9);
+        Thread task = new Thread(() -> {
+            readBuffer.lock();
+            try {
+                readBuffer.setStatus(ReadBuffer.STATUS.SUCCESS);
+                readBuffer.signalAll();
+            } finally {
+                readBuffer.unlock();
+            }
+        });
+        long start = System.nanoTime();
+        readBuffer.lock();
+        try {
+            task.start();
+            readBuffer.await(ReadBuffer.STATUS.INIT);
+        } finally {
+            readBuffer.unlock();
+        }
+        task.join();
+        Assertions.assertEquals(ReadBuffer.STATUS.SUCCESS, readBuffer.getStatus());
+        Assertions.assertTrue(System.nanoTime() - start < TimeUnit.SECONDS.toNanos(30));
+    }
+}
```

---

### Incident Patch 2: `7e354c62` (2026-10-28)
**Commit Message**: [BugFix] Account buffered pass-through chunks in query and process memory (#80910)

Signed-off-by: Drake Wang <[REDACTED_EMAIL]>
Co-authored-by: trueeyu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `be/src/compute_env/data_stream/data_stream_recvr.cpp` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ DataStreamRecvr::DataStreamRecvr(DataStreamMgr* stream_mgr, RuntimeState* runtim
 
     _metrics.resize(degree_of_parallelism);
 
-    _pass_through_context.init();
+    _pass_through_context.init(_query_mem_tracker);
     if (runtime_state->query_options().__isset.transmission_encode_level) {
         _encode_level = runtime_state->query_options().transmission_encode_level;
     }
```

**File**: `be/src/compute_env/data_stream/local_pass_through_buffer.cpp` (modified, +51/-14)
```diff
@@ -22,15 +22,37 @@
 
 namespace starrocks {
 
+// A buffered chunk is allocated by the sender thread and freed by the receiver thread. While it waits in
+// the channel it belongs to neither instance, so it is parked on the query tracker, the common ancestor
+// of both instances: the query, resource group, query pool and process trackers keep counting it, and
+// only the instance trackers change. The global passthrough tracker is not part of the tracker tree; it
+// mirrors the parked bytes for diagnosis. Without a query tracker, fall back to the process tracker, the
+// common ancestor of every tracker, so the process tracker still counts the bytes.
+static MemTracker* parking_tracker(MemTracker* query_mem_tracker) {
+    return query_mem_tracker != nullptr ? query_mem_tracker : RuntimeEnv::GetInstance()->process_mem_tracker();
+}
+
+static void park_buffered_bytes(MemTracker* query_mem_tracker, int64_t bytes) {
+    CurrentThread::current().mem_transfer_to(parking_tracker(query_mem_tracker), bytes);
+    RuntimeEnv::GetInstance()->passthrough_mem_tracker()->consume(bytes);
+}
+
+// Hand parked bytes to the current thread's tracker, which then frees them or keeps them as its own.
+static void unpark_buffered_bytes(MemTracker* query_mem_tracker, int64_t bytes) {
+    CurrentThread::current().mem_transfer_from(parking_tracker(query_mem_tracker), bytes);
+    RuntimeEnv::GetInstance()->passthrough_mem_tracker()->release(bytes);
+}
+
 // channel per [sender_id]
 class PassThroughSenderChannel {
 public:
-    PassThroughSenderChannel(std::atomic_int64_t& total_bytes) : _total_bytes(total_bytes) {}
+    // `query_mem_tracker` is owned by the PassThroughChannel, which outlives this sender channel.
+    PassThroughSenderChannel(std::atomic_int64_t& total_bytes, MemTracker* query_mem_tracker)
+            : _total_bytes(total_bytes), _query_mem_tracker(query_mem_tracker) {}
 
     ~PassThroughSenderChannel() {
         if (_physical_bytes > 0) {
-            CurrentThread::current().mem_consume(_physical_bytes);
-            RuntimeEnv::GetInstance()->passthrough_mem_tracker()->release(_physical_bytes);
+            unpark_buffered_bytes(_query_mem_tracker, _physical_bytes);
         }
     }
 
@@ -40,8 +62,7 @@ class PassThroughSenderChannel {
         auto clone = chunk->clone_unique();
         int64_t physical_bytes = CurrentThread::current().get_consumed_bytes() - before_bytes;
         DCHECK_GE(physical_bytes, 0);
-        CurrentThread::current().mem_release(physical_bytes);
-        RuntimeEnv::GetInstance()->passthrough_mem_tracker()->consume(physical_bytes);
+        park_buffered_bytes(_query_mem_tracker, physical_bytes);
 
         std::unique_lock lock(_mutex);
         _buffer.emplace_back(std::make_pair(std::move(clone), driver_sequence));
@@ -53,22 +74,19 @@ class PassThroughSenderChannel {
         std::unique_lock lock(_mutex);
         chunks->swap(_buffer);
         bytes->swap(_bytes);
-        RuntimeEnv::GetInstance()->passthrough_mem_tracker()->release(_physical_bytes);
-        // Consume physical bytes in current MemTracker, since later it would be released
-        CurrentThread::current().mem_consume(_physical_bytes);
+        unpark_buffered_bytes(_query_mem_tracker, _physical_bytes);
         _total_bytes -= _physical_bytes;
         _physical_bytes = 0;
     }
     // Drop everything buffered without handing it to a consumer. Used when the receiver is
     // cancelled/closed: nobody will ever pull these chunks, so free them now instead of
     // holding the memory until query teardown. The accounting mirrors the destructor:
-    // pre-charge the physical bytes to the current MemTracker so the immediate _buffer.clear()
-    // frees net-zero on it, and release them from the global passthrough tracker.
+    // transfer ownership without changing common ancestors. The immediate _buffer.clear() then
+    // frees net-zero on the current tracker.
     void clear() {
         std::unique_lock lock(_mutex);
         if (_physical_bytes > 0) {
-            CurrentThread::current().mem_consume(_physical_bytes);
-            RuntimeEnv::GetInstance()->passthrough_mem_tracker()->release(_physical_bytes);
+            unpark_buffered_bytes(_query_mem_tracker, _physical_bytes);
             _total_bytes -= _physical_bytes;
             _physical_bytes = 0;
         }
@@ -82,6 +100,7 @@ class PassThroughSenderChannel {
     std::vector<size_t> _bytes;
     int64_t _physical_bytes = 0; // Physical consumed bytes for each chunk
     std::atomic_int64_t& _total_bytes;
+    MemTracker* const _query_mem_tracker;
 };
 
 // channel per [fragment_instance_id, dest_node_id]
@@ -91,7 +110,7 @@ class PassThroughChannel {
         std::unique_lock lock(_mutex);
         auto it = _sender_id_to_channel.find(sender_id);
         if (it == _sender_id_to_channel.end()) {
-            auto* channel = new PassThroughSenderChannel(_total_bytes);
+            auto* channel = new PassThroughSenderChannel(_total_
```

**File**: `be/src/compute_env/data_stream/local_pass_through_buffer.h` (modified, +7/-1)
```diff
@@ -26,6 +26,8 @@
 
 namespace starrocks {
 
+class MemTracker;
+
 // To manage pass through chunks between sink/sources in the same process.
 using ChunkUniquePtrVector = std::vector<std::pair<ChunkUniquePtr, int32_t>>;
 class PassThroughChannel;
@@ -69,7 +71,11 @@ class PassThroughContext {
 public:
     PassThroughContext(PassThroughChunkBuffer* chunk_buffer, const TUniqueId& fragment_instance_id, PlanNodeId node_id)
             : _chunk_buffer(chunk_buffer), _fragment_instance_id(fragment_instance_id), _node_id(node_id) {}
-    void init();
+    // `query_mem_tracker` is the query tracker shared by the sender and receiver instances (they always
+    // belong to the same query on this BE). Buffered chunks are parked on it while they wait in the
+    // channel, so they stay inside the query, resource group and process budgets. Without it the
+    // chunks are only tracked by the global passthrough tracker, outside the process tree.
+    void init(std::shared_ptr<MemTracker> query_mem_tracker = nullptr);
     void append_chunk(int sender_id, const Chunk* chunk, size_t chunk_size, int32_t driver_sequence);
     void pull_chunks(int sender_id, ChunkUniquePtrVector* chunks, std::vector<size_t>* bytes);
     int64_t total_bytes() const;
```

**File**: `be/src/exec/pipeline/exchange/exchange_sink_operator.cpp` (modified, +4/-4)
```diff
@@ -126,7 +126,7 @@ class ExchangeSinkOperator::Channel {
     Status _close_internal(RuntimeState* state, FragmentContext* fragment_ctx);
 
     bool _check_use_pass_through();
-    void _prepare_pass_through();
+    void _prepare_pass_through(RuntimeState* state);
     // Account the memory retained by _chunks[driver_sequence] into the parent's profile counter.
     // Container (capacity) usage is re-read each time, which is O(#columns); memory referenced by
     // out-of-line objects (JSON, bitmap, HLL, ...) is only measured for the rows just appended and
@@ -186,8 +186,8 @@ bool ExchangeSinkOperator::Channel::_check_use_pass_through() {
     return is_local();
 }
 
-void ExchangeSinkOperator::Channel::_prepare_pass_through() {
-    _pass_through_context.init();
+void ExchangeSinkOperator::Channel::_prepare_pass_through(RuntimeState* state) {
+    _pass_through_context.init(state->query_mem_tracker_ptr());
     _use_pass_through = _check_use_pass_through();
 }
 
@@ -217,7 +217,7 @@ Status ExchangeSinkOperator::Channel::init(RuntimeState* state) {
         return Status::InternalError(msg);
     }
 
-    _prepare_pass_through();
+    _prepare_pass_through(state);
     _ignore_local_data = _enable_exchange_perf && is_local();
 
     _is_inited = true;
```

**File**: `be/src/http/default_path_handlers.cpp` (modified, +2/-1)
```diff
@@ -189,7 +189,8 @@ void MemTrackerWebPageHandler::handle(const RuntimeEnv& runtime_env, MemTracker*
             auto* update_item = update_mem_tracker->get_snapshot(&obj_pool, upper_level);
             update_item->parent = root;
 
-            // passthrough memory tracker not in RootMemTrackerTree
+            // passthrough memory tracker not in RootMemTrackerTree. It only mirrors bytes that the query
+            // trackers (and so the process tracker) already count, so it is shown for diagnosis only.
             MemTracker* passthrough_mem_tracker = runtime_env.passthrough_mem_tracker();
             auto* passthrough_item = passthrough_mem_tracker->get_snapshot(&obj_pool, upper_level);
             passthrough_item->parent = root;
```

**File**: `be/src/runtime/current_thread.h` (modified, +41/-0)
```diff
@@ -196,6 +196,28 @@ class CurrentThread {
             }
         }
 
+        void transfer_to(MemTracker* tracker, int64_t size) {
+            commit(false);
+            if (auto* current = CurrentThread::mem_tracker(); current != nullptr) {
+                current->transfer_to(tracker, size);
+            } else {
+                tracker->consume(size);
+            }
+            _deallocated_cache_size += size;
+            _total_consumed_bytes -= size;
+        }
+
+        void transfer_from(MemTracker* tracker, int64_t size) {
+            commit(false);
+            if (auto* current = CurrentThread::mem_tracker(); current != nullptr) {
+                tracker->transfer_to(current, size);
+            } else {
+                tracker->release(size);
+            }
+            _allocated_cache_size += size;
+            _total_consumed_bytes += size;
+        }
+
         void commit(bool is_ctx_shift) {
             MemTracker* cur_tracker = CurrentThread::mem_tracker();
             if (cur_tracker != nullptr) {
@@ -366,6 +388,25 @@ class CurrentThread {
         }
     }
 
+    // Transfer already-accounted bytes (e.g. a get_consumed_bytes() delta) to another tracker.
+    // This is not a free: do not recycle the charge into the thread's reservation. Flush
+    // pending allocations, then leave all common ancestors unchanged during the transfer.
+    void mem_transfer_to(MemTracker* tracker, int64_t size) {
+        DCHECK_GE(size, 0);
+        if (size != 0) {
+            _mem_cache_manager.transfer_to(tracker, size);
+        }
+    }
+
+    // Receive already-accounted memory. This is not an allocation and must not consume a
+    // reservation; the eventual free will release this transferred charge normally.
+    void mem_transfer_from(MemTracker* tracker, int64_t size) {
+        DCHECK_GE(size, 0);
+        if (size != 0) {
+            _mem_cache_manager.transfer_from(tracker, size);
+        }
+    }
+
     static void mem_consume_without_cache(int64_t size) {
         MemTracker* cur_tracker = mem_tracker();
         if (cur_tracker != nullptr && size != 0) {
```

**File**: `be/src/runtime/mem_tracker.h` (modified, +20/-0)
```diff
@@ -221,6 +221,26 @@ class MemTracker {
         }
     }
 
+    // Reclassify live memory without changing any shared ancestor (in particular process).
+    // The two tracker paths are immutable. Their common suffix must not be debited/credited,
+    // even temporarily: concurrent limit checks observe those counters.
+    void transfer_to(MemTracker* dst, int64_t bytes) {
+        DCHECK(dst != nullptr);
+        DCHECK_GE(bytes, 0);
+        size_t src_end = _all_trackers.size();
+        size_t dst_end = dst->_all_trackers.size();
+        while (src_end > 0 && dst_end > 0 && _all_trackers[src_end - 1] == dst->_all_trackers[dst_end - 1]) {
+            --src_end;
+            --dst_end;
+        }
+        for (size_t i = 0; i < src_end; ++i) {
+            _all_trackers[i]->_consumption->add(-bytes);
+        }
+        for (size_t i = 0; i < dst_end; ++i) {
+            dst->_all_trackers[i]->_consumption->add(bytes);
+        }
+    }
+
     // the function can be used to transform memory stats from process mem_tracker to child mem_tracker
     void consume_without_root(int64_t bytes) {
         if (bytes == 0) {
```

**File**: `be/src/runtime/runtime_env.cpp` (modified, +3/-0)
```diff
@@ -318,6 +318,9 @@ Status RuntimeEnv::_init_mem_tracker(MetricRegistry* metrics) {
     _jit_cache_mem_tracker = regist_tracker(MemTrackerType::JIT_CACHE, -1, process_mem_tracker());
     _update_mem_tracker = regist_tracker(MemTrackerType::UPDATE, calc_max_update_memory(bytes_limit), nullptr);
     _update_mem_tracker->set_level(2);
+    // Diagnostic only: mirrors the bytes buffered in local pass-through channels. Those bytes are
+    // already accounted on the query tracker (or the process tracker as a fallback), so keep this
+    // tracker out of the tree, or they would be counted twice.
     _passthrough_mem_tracker = regist_tracker(MemTrackerType::PASSTHROUGH, -1, nullptr);
     _passthrough_mem_tracker->set_level(2);
     _brpc_iobuf_mem_tracker = regist_tracker(MemTrackerType::BRPC_IOBUF, -1, nullptr);
```

---

### Incident Patch 3: `e568fbf8` (2026-10-28)
**Commit Message**: [BugFix][RB-225] Keep Iceberg equality deletes applied when identity column optimize is off (#81760)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rule/transformation/IcebergEqualityDeleteRewriteRule.java` (modified, +7/-0)
```diff
@@ -477,6 +477,13 @@ private static Set<String> runtimeFilterPruningColumns(OptimizerContext context,
         if (!context.getSessionVariable().isEnableIcebergEqDeleteRuntimeFilterPruning()) {
             return Set.of();
         }
+        // only the delete scan always takes these columns from partition metadata; with the switch off the data-file
+        // scan reads them from the file, which may not store them (e.g. migrated Hive files), and a NULL never matches,
+        // so match by $partition_key instead, unless a real column of that name leaves no partition match at all
+        if (!context.getSessionVariable().getEnableIcebergIdentityColumnOptimize() &&
+                icebergTable.getNativeTable().schema().caseInsensitiveFindField(PARTITION_KEY) == null) {
+            return Set.of();
+        }
         Set<String> scanColumnNames = scan.getColRefToColumnMetaMap().values().stream()
                 .map(Column::getName)
                 .collect(Collectors.toSet());
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/optimizer/rule/transformation/IcebergEqualityDeleteRewriteRuleTest.java` (modified, +67/-18)
```diff
@@ -22,6 +22,7 @@
 import com.starrocks.connector.exception.StarRocksConnectorException;
 import com.starrocks.connector.iceberg.IcebergApiConverter;
 import com.starrocks.connector.iceberg.IcebergDeleteSchema;
+import com.starrocks.qe.ConnectContext;
 import com.starrocks.sql.ast.expression.BinaryType;
 import com.starrocks.sql.optimizer.OptExpression;
 import com.starrocks.sql.optimizer.OptimizerFactory;
@@ -346,10 +347,72 @@ private void collectBinaryTypes(ScalarOperator op, Map<String, BinaryType> out)
     // VARCHAR $partition_key: the data-file scan reads it next to the key, and the delete scan takes it as a slot.
     @Test
     public void testPartitionColumnReplacesPartitionKeyWhenNotSelected() {
-        Schema schema = new Schema(
+        OptExpression antiJoin = rewriteEqDeleteScanSelectingV(new ConnectContext());
+        LogicalIcebergScanOperator withDeleteScan = antiJoin.inputAt(0).getOp().cast();
+        LogicalIcebergEqualityDeleteScanOperator eqDeleteScan = antiJoin.inputAt(1).getOp().cast();
+        Set<String> withDeleteColumns = Set.copyOf(withDeleteScan.getColumnNameToColRefMap().keySet());
+        Assertions.assertTrue(withDeleteColumns.containsAll(Set.of("id", "p", "v")), withDeleteColumns.toString());
+        Assertions.assertFalse(withDeleteColumns.contains(PARTITION_KEY), withDeleteColumns.toString());
+        Assertions.assertEquals(Set.of("p"), eqDeleteScan.getRuntimeFilterPruningColumns());
+
+        Map<String, BinaryType> onTypes = new HashMap<>();
+        collectBinaryTypes(((LogicalJoinOperator) antiJoin.getOp())
+                .getOnPredicate(), onTypes);
+        Assertions.assertEquals(Map.of("id", BinaryType.EQ_FOR_NULL, "p", BinaryType.EQ_FOR_NULL,
+                DATA_SEQUENCE_NUMBER, BinaryType.LT), onTypes);
+    }
+
+    // With enable_iceberg_identity_column_optimize off the data-file scan reads the partition column from the file,
+    // which may not store it, so the match falls back to $partition_key instead of a NULL that never matches.
+    @Test
+    public void testPartitionKeyKeptWhenIdentityColumnOptimizeOff() {
+        ConnectContext connectContext = new ConnectContext();
+        connectContext.getSessionVariable().setEnableIcebergIdentityColumnOptimize(false);
+        OptExpression antiJoin = rewriteEqDeleteScanSelectingV(connectContext);
+        LogicalIcebergScanOperator withDeleteScan = antiJoin.inputAt(0).getOp().cast();
+        LogicalIcebergEqualityDeleteScanOperator eqDeleteScan = antiJoin.inputAt(1).getOp().cast();
+        Set<String> withDeleteColumns = Set.copyOf(withDeleteScan.getColumnNameToColRefMap().keySet());
+        Assertions.assertTrue(withDeleteColumns.contains(PARTITION_KEY), withDeleteColumns.toString());
+        Assertions.assertEquals(Set.of(), eqDeleteScan.getRuntimeFilterPruningColumns());
+
+        Map<String, BinaryType> onTypes = new HashMap<>();
+        collectBinaryTypes(((LogicalJoinOperator) antiJoin.getOp())
+                .getOnPredicate(), onTypes);
+        Assertions.assertEquals(Map.of("id", BinaryType.EQ_FOR_NULL, PARTITION_KEY, BinaryType.EQ,
+                DATA_SEQUENCE_NUMBER, BinaryType.LT), onTypes);
+    }
+
+    // A real $partition_key column leaves no $partition_key match, so the identity column keeps the match even with
+    // enable_iceberg_identity_column_optimize off; dropping it would let a delete reach rows of other partitions.
+    @Test
+    public void testIdentityColumnKeptWithPartitionKeyColumnWhenIdentityColumnOptimizeOff() {
+        ConnectContext connectContext = new ConnectContext();
+        connectContext.getSessionVariable().setEnableIcebergIdentityColumnOptimize(false);
+        OptExpression antiJoin = rewriteEqDeleteScanSelectingV(connectContext, new Schema(
+                Types.NestedField.optional(1, "id", Types.IntegerType.get()),
+                Types.NestedField.optional(2, "p", Types.IntegerType.get()),
+                Types.NestedField.optional(3, "v", Types.IntegerType.get()),
+                Types.NestedField.optional(4, PARTITION_KEY, Types.StringType.get())));
+        LogicalIcebergEqualityDeleteScanOperator eqDeleteScan = antiJoin.inputAt(1).getOp().cast();
+        Assertions.assertEquals(Set.of("p"), eqDeleteScan.getRuntimeFilterPruningColumns());
+
+        Map<String, BinaryType> onTypes = new HashMap<>();
+        collectBinaryTypes(((LogicalJoinOperator) antiJoin.getOp())
+                .getOnPredicate(), onTypes);
+        Assertions.assertEquals(Map.of("id", BinaryType.EQ_FOR_NULL, "p", BinaryType.EQ_FOR_NULL,
+                DATA_SEQUENCE_NUMBER, BinaryType.LT), onTypes);
+    }
+
+    // rewrites a scan of tb(id, p, v) partitioned by identity(p) with an equality delete on id, selecting v only, as
+    // `select sum(v) from tb` does after column pruning; returns the anti join
+    private static OptExpression rewriteEqDeleteScanSelectingV(ConnectContext connectContext) {
+        return rewriteEqDeleteScanSelectingV(connectCo
```

**File**: `test/sql/test_iceberg/R/test_iceberg_eq_delete_rf_pruning` (modified, +65/-0)
```diff
@@ -319,6 +319,62 @@ select m.* from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.mixed m join dim_p d on
 set enable_read_iceberg_equality_delete_with_partition_evolution = false;
 -- result:
 -- !result
+create table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_src(
+    id int,
+    v string,
+    p int
+) partition by(p) properties ("location" = "oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_src");
+-- result:
+-- !result
+insert into hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_src values (1, 'a1', 1), (2, 'a2', 1), (1, 'b1', 2), (2, 'b2', 2);
+-- result:
+-- !result
+create table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated(
+    id int,
+    v string,
+    p int
+) partition by(p) properties ("format-version" = "2");
+-- result:
+-- !result
+alter table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated execute add_files(location="oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_src", file_format="parquet");
+-- result:
+-- !result
+create table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_deletes(
+    id int,
+    p int
+) partition by(p) properties ("location" = "oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_deletes");
+-- result:
+-- !result
+insert into hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_deletes values (1, 1), (2, 2);
+-- result:
+-- !result
+alter table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated execute add_equality_delete_files(location="oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_deletes", file_format="parquet", equality_columns="id");
+-- result:
+-- !result
+select v from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated order by v;
+-- result:
+a2
+b1
+-- !result
+set enable_iceberg_identity_column_optimize = false;
+-- result:
+-- !result
+function: assert_explain_contains('select v from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated', '$partition_key')
+-- result:
+None
+-- !result
+select v from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated order by v;
+-- result:
+a2
+b1
+-- !result
+select count(*) from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated;
+-- result:
+2
+-- !result
+set enable_iceberg_identity_column_optimize = true;
+-- result:
+-- !result
 function: assert_explain_not_contains("delete from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.fact where p in (select p from db_${uuid0}.dim_p) and v = 'a2'", 'Runtime filter pruning columns')
 -- result:
 None
@@ -358,6 +414,15 @@ drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.mixed_global_deletes force;
 drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.mixed_part_deletes force;
 -- result:
 -- !result
+drop table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated force;
+-- result:
+-- !result
+drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_src force;
+-- result:
+-- !result
+drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_deletes force;
+-- result:
+-- !result
 drop database iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0};
 -- result:
 -- !result
```

**File**: `test/sql/test_iceberg/T/test_iceberg_eq_delete_rf_pruning` (modified, +37/-0)
```diff
@@ -178,6 +178,40 @@ function: assert_explain_not_contains('select m.* from iceberg_eq_rf_${uuid0}.eq
 select m.* from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.mixed m join dim_p d on m.p = d.p order by m.id;
 set enable_read_iceberg_equality_delete_with_partition_evolution = false;
 
+-- data files without the partition column (hive-written, registered with add_files): with
+-- enable_iceberg_identity_column_optimize off the data-file scan would read p as NULL, so the match keeps $partition_key
+create table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_src(
+    id int,
+    v string,
+    p int
+) partition by(p) properties ("location" = "oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_src");
+
+insert into hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_src values (1, 'a1', 1), (2, 'a2', 1), (1, 'b1', 2), (2, 'b2', 2);
+
+create table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated(
+    id int,
+    v string,
+    p int
+) partition by(p) properties ("format-version" = "2");
+
+alter table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated execute add_files(location="oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_src", file_format="parquet");
+
+create table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_deletes(
+    id int,
+    p int
+) partition by(p) properties ("location" = "oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_deletes");
+
+insert into hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_deletes values (1, 1), (2, 2);
+
+alter table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated execute add_equality_delete_files(location="oss://${oss_bucket}/eq_rf_db_${uuid0}/migrated_deletes", file_format="parquet", equality_columns="id");
+
+select v from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated order by v;
+set enable_iceberg_identity_column_optimize = false;
+function: assert_explain_contains('select v from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated', '$partition_key')
+select v from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated order by v;
+select count(*) from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated;
+set enable_iceberg_identity_column_optimize = true;
+
 -- a DML target keeps every delete
 function: assert_explain_not_contains("delete from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.fact where p in (select p from db_${uuid0}.dim_p) and v = 'a2'", 'Runtime filter pruning columns')
 delete from iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.fact where p in (select p from db_${uuid0}.dim_p) and v = 'a2';
@@ -192,6 +226,9 @@ drop table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.fact_null force;
 drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.fact_null_deletes force;
 drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.mixed_global_deletes force;
 drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.mixed_part_deletes force;
+drop table iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated force;
+drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_src force;
+drop table hive_eq_rf_${uuid0}.eq_rf_db_${uuid0}.migrated_deletes force;
 drop database iceberg_eq_rf_${uuid0}.eq_rf_db_${uuid0};
 drop database db_${uuid0};
 drop catalog iceberg_eq_rf_${uuid0};
```

#### Recent Merged Pull Requests:
- **PR #81780** (2026-10-28): [BugFix] Account buffered pass-through chunks in query and process memory (backport #80910) (@mergify[bot])
- **PR #81764** (2026-10-28): [Enhancement][RB-424] Support rollups, synchronous MVs and sort-key changes on range tables with AUTO_INCREMENT (backport #81757) (@mergify[bot])
- **PR #81760** (2026-10-28): [BugFix][RB-225] Keep Iceberg equality deletes applied when identity column optimize is off (@starrocks-bot[bot])
- **PR #81759** (2026-10-28): [Enhancement][RB-225] Cut the Iceberg equality-delete anti join cost: fixed-width partition match and key filters on the delete scan (@starrocks-bot[bot])
- **PR #81757** (2026-10-28): [Enhancement][RB-424] Support rollups, synchronous MVs and sort-key changes on range tables with AUTO_INCREMENT (@starrocks-bot[bot])
- **PR #81755** (closed): [Tool] Set fe version to 4.2.0 (@huailiu1122)

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

## X. [BugFix][RB-654] Stop two Iceberg FE hangs: profile explain partition listing an

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/planner/IcebergScanNode.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `99d51e09`: [BugFix][RB-654] Stop two Iceberg FE hangs: profile explain partition listing and OSS read-ahead wait (#81711). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/planner/IcebergScanNode.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
            appendPartitionsExplain(output, prefix);
    // Lists every partition of the table and may plan all scan ranges. Skipped when the finished query's plan is
    // rendered into its profile: nothing bounds that metadata read once the query has ended.
    private void appendPartitionsExplain(StringBuilder output, String prefix) {
        ConnectContext connectContext = ConnectContext.get();
        if (connectContext != null && connectContext.isExplainForProfile()) {
            return;
        }
        ConnectorMetadataRequestContext requestContext = new ConnectorMetadataRequestContext();
        requestContext.setTableVersionRange(tvrVersionRange);
        List<String> partitionNames = GlobalStateMgr.getCurrentState().getMetadataMgr().listPartitionNames(
                icebergTable.getCatalogName(), icebergTable.getCatalogDBName(),
                icebergTable.getCatalogTableName(), requestContext);
        if (selectedPartitionCount == -1) {
            if (scanRangeSource != null) {
                // we have to consume all scan ranges to know how many partition been selected.
                while (scanRangeSource.hasMoreOutput()) {
                    scanRangeSour
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
            ConnectorMetadataRequestContext requestContext = new ConnectorMetadataRequestContext();
            requestContext.setTableVersionRange(tvrVersionRange);
            List<String> partitionNames = GlobalStateMgr.getCurrentState().getMetadataMgr().listPartitionNames(
                    icebergTable.getCatalogName(), icebergTable.getCatalogDBName(),
                    icebergTable.getCatalogTableName(), requestContext);

            if (selectedPartitionCount == -1) {
                if (scanRangeSource != null) {
                    // we have to consume all scan ranges to know how many partition been selected.
                    while (scanRangeSource.hasMoreOutput()) {
                        scanRangeSource.getOutputs(1000);
                    }
                    selectedPartitionCount = scanRangeSource.selectedPartitionCount();
                } else {
                    selectedPartitionCount = 0;
                }
            }

            output.append(prefix).append(
                    String.format("partitions=%s/%s", selectedPartitionCount,
                            partitionNames.isEmpty() ? 1 : partitionNames.size()));
            output.append("\n"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `99d51e09` are properly handled with clean fallback behavior.
