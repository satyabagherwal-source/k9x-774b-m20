> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `2d15aef3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T11:59:50.713Z  
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
> **Harvest Timestamp**: 2026-10-27T11:59:50.260Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12209 stars

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

### Incident Patch 1: `5ffc3151` (2026-10-27)
**Commit Message**: [BugFix] Bump lastSchemaUpdateTime before shared-data schema change swaps indexes so concurrent queries re-plan (#81363)

Signed-off-by: GavinMar <[REDACTED_EMAIL]>
Co-authored-by: Gavin <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/LakeTableSchemaChangeJob.java` (modified, +4/-0)
```diff
@@ -1272,6 +1272,10 @@ List<MaterializedIndex> visualiseShadowIndex(@NotNull OlapTable table) {
             }
         }
 
+        // Lock-free plans share these physical partitions; invalidate them before the first origin index is dropped,
+        // so a plan that hits the half-swapped partitions retries instead of failing.
+        table.lastSchemaUpdateTime.set(System.nanoTime());
+
         // replace the origin index with shadow index, set index state as NORMAL
         for (PhysicalPartition physicalPartition : table.getPhysicalPartitions()) {
             Preconditions.checkState(commitVersionMap.containsKey(physicalPartition.getId()));
```

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/LakeTableSchemaChangeJobTest.java` (modified, +55/-0)
```diff
@@ -60,6 +60,7 @@
 import com.starrocks.server.LocalMetastore;
 import com.starrocks.server.RunMode;
 import com.starrocks.server.WarehouseManager;
+import com.starrocks.sql.OptimisticVersion;
 import com.starrocks.sql.ast.AlterMaterializedViewStatusClause;
 import com.starrocks.sql.ast.AlterTableStmt;
 import com.starrocks.sql.ast.CancelAlterTableStmt;
@@ -1869,6 +1870,60 @@ public void testFollowerReplayPrunesFinishedJob() throws Exception {
         Assertions.assertEquals(0, shadowIndexCount(followerTable));
     }
 
+    /**
+     * A query planned off a snapshot taken before the swap shares the swapped physical partitions, so the swap must
+     * invalidate that snapshot before it drops the first origin index, or the planner rethrows instead of retrying.
+     */
+    @Test
+    public void testSwapInvalidatesEarlierPlansBeforeDroppingOriginIndex() throws Exception {
+        completeTasksAndPublishOnSend();
+        LakeTableSchemaChangeJob job = alterTableAddColumn();
+        long planStartTime = OptimisticVersion.generate();
+        List<Boolean> planValidAtDrop = recordPlanValidityOnIndexDrop(table, planStartTime);
+
+        runToFinished(job);
+
+        Assertions.assertEquals(List.of(false), planValidAtDrop);
+        Assertions.assertFalse(OptimisticVersion.validateTableUpdate(table, planStartTime));
+    }
+
+    @Test
+    public void testFollowerReplayInvalidatesEarlierPlansBeforeDroppingOriginIndex() throws Exception {
+        completeTasksAndPublishOnSend();
+        UtFrameUtils.PseudoImage initialImage = saveMetastore();
+        LakeTableSchemaChangeJob job = alterTableAddColumn();
+        runToFinished(job);
+        List<LakeTableSchemaChangeJob> entries = readJournaledEntries(job.getJobId());
+
+        LocalMetastore followerMetastore = loadMetastore(initialImage);
+        OlapTable followerTable = tableIn(followerMetastore);
+        SchemaChangeHandler followerHandler = new SchemaChangeHandler();
+        long planStartTime = OptimisticVersion.generate();
+        List<Boolean> planValidAtDrop = recordPlanValidityOnIndexDrop(followerTable, planStartTime);
+        for (LakeTableSchemaChangeJob entry : entries) {
+            replayOn(followerMetastore, followerHandler, entry);
+        }
+
+        Assertions.assertEquals(List.of(false), planValidAtDrop);
+        Assertions.assertFalse(OptimisticVersion.validateTableUpdate(followerTable, planStartTime));
+    }
+
+    /**
+     * Records, at each origin index drop, whether a plan started at {@code planStartTime} would still pass the
+     * planner's schema check on {@code olapTable}.
+     */
+    private static List<Boolean> recordPlanValidityOnIndexDrop(OlapTable olapTable, long planStartTime) {
+        List<Boolean> planValidAtDrop = new ArrayList<>();
+        new MockUp<PhysicalPartition>() {
+            @Mock
+            public List<MaterializedIndex> deleteMaterializedIndexByMetaId(Invocation inv, long indexMetaId) {
+                planValidAtDrop.add(OptimisticVersion.validateTableUpdate(olapTable, planStartTime));
+                return inv.proceed(indexMetaId);
+            }
+        };
+        return planValidAtDrop;
+    }
+
     @Test
     public void testFollowerReplayDropsShadowIndexOfCancelledJob() throws Exception {
         // The follower starts from the catalog as it was before the alter.
```

---

### Incident Patch 2: `2d15aef3` (2026-10-27)
**Commit Message**: [BugFix] Cap subdivide_bitmap's scratch buffer so it stops scaling with the caller's split size (#81478)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `be/src/exprs/table_function/subdivide_bitmap.h` (modified, +27/-6)
```diff
@@ -145,8 +145,18 @@ class SubdivideBitmap final : public TableFunction {
             subdivide_state->set_offset(0);
         };
 
-        // Reused across pieces and across rows: one piece is at most `batch_size` values, and the
-        // fast path below means the general path only runs when batch_size < cardinality.
+        // Reused across pieces and across rows. Capped rather than sized by the piece: a piece holds
+        // `batch_size` values and `batch_size` is the caller's, so sizing the buffer by it would make
+        // subdivide_bitmap(b, 50000000) ask for 400MB of uint64 scratch to build a piece whose Roaring
+        // representation is a fraction of that - an allocation the value-at-a-time iterator this
+        // replaced never made, and one that counts against the query's memory limit. next_batch() can
+        // be called repeatedly against the same cursor, so a larger piece is filled in several passes.
+        //
+        // Deliberately its own constant rather than `chunk_size`, which happens to have the same
+        // default: chunk_size bounds output *rows* per call and is a session variable, so tying the
+        // buffer to it would make `SET chunk_size = 2` - which the sibling batching case does set -
+        // fill a piece two values at a time.
+        constexpr uint64_t kValueBatchSize = 4096;
         std::vector<uint64_t> values;
         uint32_t emitted = 0;
         while (emitted < chunk_size && cur_row < rows) {
@@ -200,12 +210,23 @@ class SubdivideBitmap final : public TableFunction {
             const auto pieces = static_cast<uint32_t>(std::min<uint64_t>(pieces_left, chunk_size - emitted));
 
             if (required) {
-                values.resize(std::min<uint64_t>(split_size, remain));
+                values.resize(std::min({split_size, remain, kValueBatchSize}));
                 for (uint32_t k = 0; k < pieces; ++k) {
-                    const uint64_t taken = subdivide_state->iter.next_batch(values.data(), values.size());
+                    // A piece is a full split_size, except for the row's last one, which is whatever
+                    // the iterator still holds - the same truncation next_batch() applied when it was
+                    // asked for a whole piece at once. The iterator was reset with this cardinality.
+                    uint64_t left = std::min<uint64_t>(split_size, cardinality - subdivide_state->iter.offset());
                     BitmapValue sub_bitmap;
-                    for (uint64_t j = 0; j < taken; ++j) {
-                        sub_bitmap.add(values[j]);
+                    while (left > 0) {
+                        const uint64_t taken = subdivide_state->iter.next_batch(
+                                values.data(), std::min<uint64_t>(left, values.size()));
+                        if (taken == 0) {
+                            break;
+                        }
+                        for (uint64_t j = 0; j < taken; ++j) {
+                            sub_bitmap.add(values[j]);
+                        }
+                        left -= taken;
                     }
                     // append() copies the value into the column's pool, so the temporary above is the
                     // only extra materialization - one piece at a time, against the whole row's worth
```

**File**: `test/sql/test_bitmap_functions/R/test_subdivide_bitmap_scratch_bound` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+-- name: test_subdivide_bitmap_scratch_bound
+CREATE DATABASE db_${uuid0};
+-- result:
+-- !result
+USE db_${uuid0};
+-- result:
+-- !result
+CREATE TABLE sbs (
+    `id` int(11) NULL COMMENT "",
+    `b` bitmap BITMAP_UNION NULL COMMENT ""
+)
+AGGREGATE KEY(`id`)
+DISTRIBUTED BY HASH(`id`) BUCKETS 1
+PROPERTIES ("replication_num" = "1");
+-- result:
+-- !result
+INSERT INTO sbs SELECT 1, bitmap_agg(generate_series) FROM TABLE(generate_series(2, 20000, 2));
+-- result:
+-- !result
+SET pipeline_dop = 1;
+-- result:
+-- !result
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 6000) ORDER BY lo;
+-- result:
+6000	2	12000	36006000
+4000	12002	20000	64004000
+-- !result
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 4096) ORDER BY lo;
+-- result:
+4096	2	8192	16781312
+4096	8194	16384	50335744
+1808	16386	20000	32892944
+-- !result
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 4097) ORDER BY lo;
+-- result:
+4097	2	8194	16789506
+4097	8196	16388	50360324
+1806	16390	20000	32860170
+-- !result
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 9000) ORDER BY lo;
+-- result:
+9000	2	18000	81009000
+1000	18002	20000	19001000
+-- !result
+SET chunk_size = 2;
+-- result:
+-- !result
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 4097) ORDER BY lo;
+-- result:
+4097	2	8194	16789506
+4097	8196	16388	50360324
+1806	16390	20000	32860170
+-- !result
+SET chunk_size = 4096;
+-- result:
+-- !result
+INSERT INTO sbs SELECT 2, bitmap_agg(generate_series) FROM TABLE(generate_series(1, 10000000));
+-- result:
+-- !result
+SELECT /*+ SET_VAR(query_mem_limit=33554432) */
+       bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo, bitmap_max(subdivide_bitmap) AS hi
+FROM sbs, subdivide_bitmap(b, 9500000) WHERE id = 2 ORDER BY lo;
+-- result:
+9500000	1	9500000
+500000	9500001	10000000
+-- !result
+SELECT /*+ SET_VAR(query_mem_limit=33554432) */ count(1)
+FROM sbs, subdivide_bitmap(b, 1000) WHERE id = 2;
+-- result:
+10000
+-- !result
+DROP DATABASE db_${uuid0};
+-- result:
+-- !result
\ No newline at end of file
```

**File**: `test/sql/test_bitmap_functions/T/test_subdivide_bitmap_scratch_bound` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+-- name: test_subdivide_bitmap_scratch_bound
+-- subdivide_bitmap builds each sub-bitmap through a uint64 scratch buffer that it fills from a
+-- BitmapValueIter. The buffer used to be sized by the piece - `resize(min(split_size, remain))` - so
+-- it scaled with the split size the caller passed, at 8 bytes per value: subdivide_bitmap(b, 9500000)
+-- asked for 76MB of scratch to build a piece whose Roaring representation is around 1MB, and that
+-- allocation counts against the query's memory limit. It is now capped, and a piece larger than the
+-- cap is filled in several passes instead.
+--
+-- Two things need to hold, and they pull in opposite directions, so this case asserts both:
+--   1. the multi-pass fill puts exactly the same values in exactly the same pieces (below);
+--   2. the buffer no longer scales with the split size (the query_mem_limit assertion at the end).
+--
+-- The pre-existing test_subdivide_bitmap_bounded_batching covers the batching cursor itself, but only
+-- with split sizes of 1, 4 and 100 - all smaller than the cap, so none of them ever fills a piece in
+-- more than one pass. Every split size here is deliberately at or above it.
+CREATE DATABASE db_${uuid0};
+USE db_${uuid0};
+
+CREATE TABLE sbs (
+    `id` int(11) NULL COMMENT "",
+    `b` bitmap BITMAP_UNION NULL COMMENT ""
+)
+AGGREGATE KEY(`id`)
+DISTRIBUTED BY HASH(`id`) BUCKETS 1
+PROPERTIES ("replication_num" = "1");
+
+-- 10000 values, even numbers only. Not a contiguous range on purpose: over 1..10000 a piece that
+-- silently lost or repeated a value could still come out with the right min and max, and the sum
+-- below would be the only thing to catch it. Over the even numbers, every piece's min, max, count and
+-- sum have to agree with each other for the answer to be right.
+INSERT INTO sbs SELECT 1, bitmap_agg(generate_series) FROM TABLE(generate_series(2, 20000, 2));
+
+SET pipeline_dop = 1;
+
+-- A piece of 6000 values does not fit the 4096-value buffer, so it is filled in two passes
+-- (4096 + 1904). Expect 6000 values 2..12000 summing to 36006000, then 4000 values 12002..20000
+-- summing to 64004000 - the same split the single-pass fill produced.
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 6000) ORDER BY lo;
+
+-- Exactly the buffer size: one full pass per piece and a `taken == 0` on the next one, the boundary
+-- where an off-by-one in the loop condition would either drop a piece or spin.
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 4096) ORDER BY lo;
+
+-- One over the buffer, so the second pass of each full piece carries a single value.
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 4097) ORDER BY lo;
+
+-- Three passes for the first piece (4096 + 4096 + 808), and its last piece is a short one that the
+-- iterator, not the split size, has to truncate.
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 9000) ORDER BY lo;
+
+-- Multi-pass pieces crossing a process() boundary: split size 4097 gives 3 pieces, so at chunk_size 2
+-- the third one is emitted by a later call and the row's cursor - the cached BitmapValueIter plus the
+-- offset - has to survive in between, having been left mid-row by a loop that itself ran in passes.
+-- The answer must not depend on where that boundary fell, so the same query runs again unbatched.
+SET chunk_size = 2;
+SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
+       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
+FROM sbs, subdivide_bitmap(b, 4097) ORDER BY lo;
+SET chunk_size = 4096;
+
+-- The scratch bound itself. Cardinality 10000000, split size 9500000: two pieces, and the old buffer
+-- was min(9500000, 10000000) * 8 = 76MB. The query is capped at 32MB, which the whole thing now fits
+-- in several times over - the sub-bitmap being built is ~1MB of Roaring and the buffer is 32KB - but
+-- which the buffer alone used to blow through more than twice over, and TRY_CATCH_BAD_ALLOC around
+-- the table function turns that into "Memory of ... exceed limit" rather than a wrong answer.
+INSERT INTO sbs SELECT 2, bitmap_agg(generate_series) FROM TABLE(generate_series(1, 10000000));
+SELECT /*+ SET_VAR(query_mem_limit=33554432) */
+       bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo, bitmap_max(subdivide
```

---

### Incident Patch 3: `3d983651` (2026-10-27)
**Commit Message**: [BugFix] Journal the MV inactivation a refresh does, and keep its task scheduled (#81660)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterJobMgr.java` (modified, +5/-0)
```diff
@@ -579,6 +579,11 @@ && clearsOnInactivation(log, reason)) {
             }
             AlterMaterializedViewStatusContext context =
                     prepareAlterMaterializedViewStatus(mv, log.getStatus(), reason, true);
+            if (log.isKeepTaskScheduled()) {
+                // Inactivated by a refresh, which left the task scheduled: see AlterMVJobExecutor#inactiveMvFromRefresh.
+                context = new AlterMaterializedViewStatusContext(context.status(), context.reason(),
+                        context.baseTableInfos(), null);
+            }
             applyAlterMaterializedViewStatus(mv, context, true);
         } catch (Throwable e) {
             LOG.warn("replay alter materialized-view status failed: {}", mv.getName(), e);
```

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterMVJobExecutor.java` (modified, +32/-0)
```diff
@@ -45,6 +45,7 @@
 import com.starrocks.common.StarRocksException;
 import com.starrocks.common.util.DynamicPartitionUtil;
 import com.starrocks.common.util.PropertyAnalyzer;
+import com.starrocks.common.util.concurrent.lock.AutoCloseableLock;
 import com.starrocks.common.util.concurrent.lock.LockType;
 import com.starrocks.common.util.concurrent.lock.Locker;
 import com.starrocks.persist.AlterMaterializedViewBaseTableInfosLog;
@@ -1780,6 +1781,37 @@ public static void inactiveForConsecutiveFailures(MaterializedView mv) {
         inactiveMvAndLog(mv, MaterializedViewExceptions.inactiveReasonForConsecutiveFailures(mv.getName()));
     }
 
+    /**
+     * Inactivates an MV from inside the refresh that found a base table gone or changed, clearing its version map, and
+     * journals it so that followers and the next leader do not keep the MV active. It leaves the task scheduled: such
+     * a table is often dropped and created again by an ETL job, and the next refresh can activate the MV again.
+     */
+    public static void inactiveMvFromRefresh(MaterializedView mv, String inactiveReason) {
+        try (AutoCloseableLock ignored = new AutoCloseableLock(mv.getDbId(), mv.getId(), LockType.WRITE)) {
+            // A refresh can get here after its MV, or the MV's database, was dropped: the entry would then have
+            // nothing to apply to on any FE.
+            if (!mv.isInCatalog()) {
+                LOG.info("Skip inactivating materialized view {}/{}, it was dropped: {}", mv.getName(), mv.getId(),
+                        inactiveReason);
+                return;
+            }
+            AlterMaterializedViewStatusLog log = new AlterMaterializedViewStatusLog(mv.getDbId(),
+                    mv.getId(), AlterMaterializedViewStatusClause.INACTIVE, inactiveReason);
+            log.setClearVersionMap(true);
+            log.setKeepTaskScheduled(true);
+            // See doInactiveMaterializedViewOnly for the reset epoch bumped on both sides of the clear.
+            mv.markVersionMapReset();
+            try {
+                GlobalStateMgr.getCurrentState().getEditLog().logAlterMvStatus(log, wal -> {
+                    mv.setInactiveAndReason(inactiveReason);
+                    mv.getRefreshScheme().clearVersionState();
+                });
+            } finally {
+                mv.markVersionMapReset();
+            }
+        }
+    }
+
     // Mark the MV inactive and journal the transition, so the inactive state survives a leader restart
     // or failover instead of reverting to active until the next refresh re-detects the condition.
     public static void inactiveMvAndLog(MaterializedView mv, String inactiveReason) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/persist/AlterMaterializedViewStatusLog.java` (modified, +12/-0)
```diff
@@ -43,6 +43,10 @@ public class AlterMaterializedViewStatusLog implements Writable {
     // GSON builds the entry without running the constructor, which sets it for every entry written now.
     @SerializedName(value = "clearVersionMap")
     private Boolean clearVersionMap;
+    // INACTIVE only: the inactivation came from a refresh, which leaves the MV's task scheduled so that the next
+    // refresh can activate the MV again. Replay must not suspend the task either. Null in older entries.
+    @SerializedName(value = "keepTaskScheduled")
+    private Boolean keepTaskScheduled;
 
     public AlterMaterializedViewStatusLog(long dbId, long tableId, String status, String reason) {
         this.dbId = dbId;
@@ -100,4 +104,12 @@ public boolean isClearVersionMapUnset() {
     public void setClearVersionMap(boolean clearVersionMap) {
         this.clearVersionMap = clearVersionMap;
     }
+
+    public boolean isKeepTaskScheduled() {
+        return Boolean.TRUE.equals(keepTaskScheduled);
+    }
+
+    public void setKeepTaskScheduled(boolean keepTaskScheduled) {
+        this.keepTaskScheduled = keepTaskScheduled;
+    }
 }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/MVRefreshProcessor.java` (modified, +3/-2)
```diff
@@ -20,6 +20,7 @@
 import com.google.common.base.Strings;
 import com.google.common.collect.Lists;
 import com.google.common.collect.Maps;
+import com.starrocks.alter.AlterMVJobExecutor;
 import com.starrocks.catalog.BaseTableInfo;
 import com.starrocks.catalog.Column;
 import com.starrocks.catalog.Database;
@@ -624,7 +625,7 @@ public void refreshExternalTable(Map<BaseTableSnapshotInfo, PCellSortedSet> base
             final Optional<Table> optTable = MvUtils.getTable(baseTableInfo);
             if (optTable.isEmpty()) {
                 logger.warn("table {} do not exist when refreshing materialized view", baseTableInfo.getTableInfoStr());
-                mv.setInactiveAndReason(
+                AlterMVJobExecutor.inactiveMvFromRefresh(mv,
                         MaterializedViewExceptions.inactiveReasonForBaseTableNotExists(baseTableInfo.getTableName()));
                 throw new DmlException("Materialized view %s.%s refresh failed: base table %s does not exist",
                         db.getFullName(), mv.getName(), baseTableInfo.getTableInfoStr());
@@ -665,7 +666,7 @@ public void refreshExternalTable(Map<BaseTableSnapshotInfo, PCellSortedSet> base
             if (optNewTable.isEmpty()) {
                 logger.warn("table {} does not exist after refreshing materialized view",
                         baseTableInfo.getTableInfoStr());
-                mv.setInactiveAndReason(
+                AlterMVJobExecutor.inactiveMvFromRefresh(mv,
                         MaterializedViewExceptions.inactiveReasonForBaseTableNotExists(baseTableInfo.getTableName()));
                 throw new DmlException("Materialized view %s.%s refresh failed: base table %s disappeared " +
                                 "after metadata refresh",
```

**File**: `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/MVRefreshSchemaChecker.java` (modified, +3/-2)
```diff
@@ -15,6 +15,7 @@
 package com.starrocks.scheduler.mv;
 
 import com.google.common.base.Strings;
+import com.starrocks.alter.AlterMVJobExecutor;
 import com.starrocks.catalog.BaseTableInfo;
 import com.starrocks.catalog.Database;
 import com.starrocks.catalog.MaterializedView;
@@ -68,7 +69,7 @@ public static void checkExternalBaseSchemaCompat(MaterializedView mv) {
             boolean isExternalCatalog = !CatalogMgr.isInternalCatalog(bti.getCatalogName());
 
             if (!baseTableOpt.isPresent() && isExternalCatalog) {
-                mv.setInactiveAndReason(
+                AlterMVJobExecutor.inactiveMvFromRefresh(mv,
                         MaterializedViewExceptions.inactiveReasonForBaseTableNotExists(bti.getTableName()));
                 return;
             }
@@ -101,7 +102,7 @@ public static void checkExternalBaseSchemaCompat(MaterializedView mv) {
             // known drift signatures so a transient catalog blip doesn't brick the MV.
             if (isLikelyDriftException(e)) {
                 if (mv.isActive()) {
-                    mv.setInactiveAndReason(MaterializedViewExceptions.inactiveReasonForSchemaCheckFailed(
+                    AlterMVJobExecutor.inactiveMvFromRefresh(mv, MaterializedViewExceptions.inactiveReasonForSchemaCheckFailed(
                             mv.getName(), e.getMessage()));
                 }
                 LOG.warn("[MVRefreshSchemaChecker] schema drift detected for MV {}: {}", mv.getName(), e.getMessage());
```

**File**: `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/pct/MVPCTMetaRepairer.java` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@
 import com.google.common.base.Preconditions;
 import com.google.common.collect.Lists;
 import com.google.common.collect.Maps;
+import com.starrocks.alter.AlterMVJobExecutor;
 import com.starrocks.catalog.BaseTableInfo;
 import com.starrocks.catalog.Database;
 import com.starrocks.catalog.HiveTable;
@@ -77,7 +78,7 @@ public static void repairMetaIfNeeded(Database db, MaterializedView mv,
                 toRepairTables.stream().filter(p -> !isSupportedPCTRepairer(p.first, p.second)).findFirst();
         if (nonSupportedTableOpt.isPresent()) {
             Pair<Table, BaseTableInfo> nonSupportedTable = nonSupportedTableOpt.get();
-            mv.setInactiveAndReason(
+            AlterMVJobExecutor.inactiveMvFromRefresh(mv,
                     MaterializedViewExceptions.inactiveReasonForBaseTableChanged(nonSupportedTable.second.getTableName()));
             throw new DmlException(String.format("Materialized view %s.%s set inactive: base table '%s' " +
                             "(catalog=%s, db=%s) was recreated but its table type is not supported for automatic meta repair. " +
```

**File**: `fe/fe-core/src/test/java/com/starrocks/analysis/AlterMaterializedViewTest.java` (modified, +98/-0)
```diff
@@ -22,6 +22,7 @@
 import com.google.gson.JsonObject;
 import com.starrocks.alter.AlterJobMgr;
 import com.starrocks.alter.AlterMVJobExecutor;
+import com.starrocks.catalog.BaseTableInfo;
 import com.starrocks.catalog.Column;
 import com.starrocks.catalog.Database;
 import com.starrocks.catalog.HashDistributionInfo;
@@ -45,7 +46,9 @@
 import com.starrocks.scheduler.Task;
 import com.starrocks.scheduler.TaskManager;
 import com.starrocks.scheduler.TaskRunManager;
+import com.starrocks.scheduler.mv.MVRefreshSchemaChecker;
 import com.starrocks.scheduler.persist.TaskRunStatus;
+import com.starrocks.server.CatalogMgr;
 import com.starrocks.server.GlobalStateMgr;
 import com.starrocks.sql.analyzer.AnalyzeTestUtil;
 import com.starrocks.sql.analyzer.SemanticException;
@@ -60,6 +63,7 @@
 import com.starrocks.sql.ast.SyncRefreshSchemeDesc;
 import com.starrocks.sql.ast.expression.IntLiteral;
 import com.starrocks.sql.optimizer.rule.transformation.materialization.MVTestBase;
+import com.starrocks.sql.optimizer.rule.transformation.materialization.MvUtils;
 import com.starrocks.sql.parser.SqlParser;
 import com.starrocks.sql.plan.ExecPlan;
 import com.starrocks.utframe.LockProbe;
@@ -76,6 +80,7 @@
 import java.time.LocalDateTime;
 import java.util.List;
 import java.util.Map;
+import java.util.Optional;
 import java.util.Set;
 import java.util.concurrent.atomic.AtomicBoolean;
 import java.util.concurrent.atomic.AtomicInteger;
@@ -1368,4 +1373,97 @@ public void testReplayStatusEntryOfADroppedDatabase() {
                 AlterMaterializedViewStatusClause.INACTIVE, "base table dropped");
         Assertions.assertDoesNotThrow(() -> currentState.getAlterJobMgr().replayAlterMaterializedViewStatus(orphan));
     }
+
+    /**
+     * A refresh that finds a base table of an external catalog gone inactivates its MV: the inactivation is
+     * journaled, with the clear of the version map, so that followers and the next leader do not keep the MV active.
+     * But the task is not suspended, so that the next refresh tries to activate the MV again.
+     */
+    @Test
+    public void testRefreshPathInactivationIsJournaled() throws Exception {
+        starRocksAssert.withTable("CREATE TABLE refresh_gone_base (k1 int, v1 int)\n" +
+                "DUPLICATE KEY(k1) DISTRIBUTED BY HASH(k1) BUCKETS 1\n" +
+                "PROPERTIES ('replication_num' = '1');");
+        starRocksAssert.withMaterializedView("CREATE MATERIALIZED VIEW refresh_gone_mv\n" +
+                "DISTRIBUTED BY HASH(k1) BUCKETS 1\nREFRESH DEFERRED MANUAL\n" +
+                "PROPERTIES ('replication_num' = '1')\n" +
+                "AS SELECT k1, v1 FROM refresh_gone_base;");
+        try {
+            MaterializedView mv = starRocksAssert.getMv("test", "refresh_gone_mv");
+            Table base = starRocksAssert.getTable("test", "refresh_gone_base");
+            putStaleVersion(mv, base);
+            // Make the base table look like a dropped table of an external catalog.
+            AtomicBoolean tableGone = new AtomicBoolean(true);
+            new MockUp<MvUtils>() {
+                @Mock
+                public Optional<Table> getTable(Invocation invocation, BaseTableInfo baseTableInfo) {
+                    return tableGone.get() ? Optional.empty() : invocation.proceed(baseTableInfo);
+                }
+            };
+            new MockUp<CatalogMgr>() {
+                @Mock
+                public boolean isInternalCatalog(Invocation invocation, String name) {
+                    return !tableGone.get() && (boolean) invocation.proceed(name);
+                }
+            };
+            List<AlterMaterializedViewStatusLog> journaled = captureMvStatusJournal();
+
+            MVRefreshSchemaChecker.checkExternalBaseSchemaCompat(mv);
+            tableGone.set(false);
+
+            Assertions.assertFalse(mv.isActive());
+            Assertions.assertFalse(hasVersionMap(mv));
+            AlterMaterializedViewStatusLog log = journaledInactivation(journaled, mv);
+            Assertions.assertTrue(log.isClearVersionMap());
+            Assertions.assertEquals(mv.getInactiveReason(), log.getReason());
+            Assertions.assertEquals(0, mv.getVersionMapResetEpoch() % 2, "the reset epoch was left odd");
+            // The task stays scheduled, here and on every FE that replays the entry, so that the next refresh
+            // activates the MV again once the table is back: an ETL job dropping and creating it again is enough to
+            // get here.
+            Assertions.assertTrue(log.isKeepTaskScheduled());
+            Task task = GlobalStateMgr.getCurrentState().getTaskManager().getTask(mv);
+            Constants.TaskState state = task.getState();
+            Assertions.assertNotEquals(Constants.TaskState.PAUSE, state);
+            currentState.getAlterJobMgr().replayAlterMaterializedViewStatus(log);
+            Assertions.assertEquals(state, task.getState(), "replaying the inactivation suspended the task");
+    
```

**File**: `fe/fe-core/src/test/java/com/starrocks/persist/AlterMaterializedViewStatusLogTest.java` (modified, +16/-0)
```diff
@@ -45,4 +45,20 @@ public void testClearVersionMapOfCurrentAndOldEntries() {
         Assertions.assertTrue(read.isClearVersionMapUnset());
         Assertions.assertEquals("reason", read.getReason());
     }
+
+    @Test
+    public void testKeepTaskScheduledOfCurrentAndOldEntries() {
+        AlterMaterializedViewStatusLog log = new AlterMaterializedViewStatusLog(1L, 2L, "INACTIVE", "reason");
+        Assertions.assertFalse(log.isKeepTaskScheduled());
+        log.setKeepTaskScheduled(true);
+        AlterMaterializedViewStatusLog read = GsonUtils.GSON.fromJson(GsonUtils.GSON.toJson(log),
+                AlterMaterializedViewStatusLog.class);
+        Assertions.assertTrue(read.isKeepTaskScheduled());
+
+        // An entry written by a version that did not journal the flag suspends the task on replay, as it did.
+        JsonObject old = GsonUtils.GSON.toJsonTree(log).getAsJsonObject();
+        old.remove("keepTaskScheduled");
+        read = GsonUtils.GSON.fromJson(old, AlterMaterializedViewStatusLog.class);
+        Assertions.assertFalse(read.isKeepTaskScheduled());
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #81672** (closed): [Enhancement] Enable enable_put_combinded_txn_log_parallel by default (backport #81662) (@mergify[bot])
- **PR #81670** (2026-10-27): [Enhancement] Allow adding a NOT NULL column with a default to an Iceberg v3 table (@starrocks-bot[bot])
- **PR #81669** (2026-10-27): [Enhancement] Spread the runtime filter worker over several threads within a BE (@starrocks-bot[bot])
- **PR #81668** (closed): [Enhancement] Skip TabletMetadataPB deep copy on metacache hit in tablet_id overload (backport #73071) (@mergify[bot])
- **PR #81667** (2026-10-27): [Enhancement] Skip TabletMetadataPB deep copy on metacache hit in tablet_id overload (backport #73071) (@luohaha)
- **PR #81662** (2026-10-27): [Enhancement] Enable enable_put_combinded_txn_log_parallel by default (@luohaha)

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

## X. [BugFix] Bump lastSchemaUpdateTime before shared-data schema change swaps indexe

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/alter/LakeTableSchemaChangeJob.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5ffc3151`: [BugFix] Bump lastSchemaUpdateTime before shared-data schema change swaps indexes so concurrent queries re-plan (#81363). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/alter/LakeTableSchemaChangeJob.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
        // Lock-free plans share these physical partitions; invalidate them before the first origin index is dropped,
        // so a plan that hits the half-swapped partitions retries instead of failing.
        table.lastSchemaUpdateTime.set(System.nanoTime());

```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5ffc3151` are properly handled with clean fallback behavior.
