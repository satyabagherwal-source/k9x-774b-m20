> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `0b659694`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T10:37:47.359Z  
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
> **Harvest Timestamp**: 2026-11-04T10:37:46.103Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12231 stars

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

### Incident Patch 1: `84536d8f` (2026-11-04)
**Commit Message**: [BugFix] Never raise a decimal overflow error from a NULL row's data under ERROR_IF_OVERFLOW (#82254)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `be/src/exprs/arithmetic_expr.cpp` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ class VectorizedDivArithmeticExpr final : public Expr
     StatusOr<ColumnPtr> evaluate_checked(ExprContext* context, Chunk* ptr) override {
         if constexpr (is_intdiv_op<Op> && lt_is_bigint<Type>) {
 #define EVALUATE_CHECKED_OVERFLOW(Mode)                                                   \
-    using CastFunction = VectorizedUnaryFunction<DecimalTo<Mode>>;                        \
+    using CastFunction = VectorizedDecimalCastFunction<DecimalTo, Mode>;                  \
     switch (_children[0]->type().type) {                                                  \
     case TYPE_DECIMAL32: {                                                                \
         ASSIGN_OR_RETURN(auto column, evaluate_internal<TYPE_DECIMAL32>(context, ptr));   \
```

**File**: `be/src/exprs/cast_expr_tpl.hpp` (modified, +5/-4)
```diff
@@ -1240,24 +1240,25 @@ class VectorizedCastExpr final : public Expr
             }
         } else if constexpr (lt_is_decimal<FromType> && lt_is_decimal<ToType>) {
             if (context != nullptr && context->error_if_overflow()) {
-                return VectorizedUnaryFunction<DecimalToDecimal<OverflowMode::REPORT_ERROR>>::evaluate<FromType,
-                                                                                                       ToType>(
+                return VectorizedDecimalCastFunction<DecimalToDecimal, OverflowMode::REPORT_ERROR>::evaluate<FromType,
+                                                                                                             ToType>(
                         column, to_type.precision, to_type.scale);
             } else {
                 return VectorizedUnaryFunction<DecimalToDecimal<OverflowMode::OUTPUT_NULL>>::evaluate<FromType, ToType>(
                         column, to_type.precision, to_type.scale);
             }
         } else if constexpr (lt_is_decimal<FromType>) {
             if (context != nullptr && context->error_if_overflow()) {
-                return VectorizedUnaryFunction<DecimalTo<OverflowMode::REPORT_ERROR>>::evaluate<FromType, ToType>(
+                return VectorizedDecimalCastFunction<DecimalTo, OverflowMode::REPORT_ERROR>::evaluate<FromType, ToType>(
                         column);
             } else {
                 return VectorizedUnaryFunction<DecimalTo<OverflowMode::OUTPUT_NULL>>::evaluate<FromType, ToType>(
                         column);
             }
         } else if constexpr (lt_is_decimal<ToType>) {
             if (context != nullptr && context->error_if_overflow()) {
-                return VectorizedUnaryFunction<DecimalFrom<OverflowMode::REPORT_ERROR>>::evaluate<FromType, ToType>(
+                return VectorizedDecimalCastFunction<DecimalFrom, OverflowMode::REPORT_ERROR>::evaluate<FromType,
+                                                                                                        ToType>(
                         column, to_type.precision, to_type.scale);
             } else {
                 return VectorizedUnaryFunction<DecimalFrom<OverflowMode::OUTPUT_NULL>>::evaluate<FromType, ToType>(
```

**File**: `be/src/exprs/decimal_binary_function.h` (modified, +122/-31)
```diff
@@ -48,7 +48,7 @@ struct DecimalBinaryFunction {
               typename RhsCppType, typename ResultCppType>
     static inline bool adjust_evaluate(size_t num_rows, const LhsCppType* lhs_data, const RhsCppType* rhs_data,
                                        ResultCppType* result_data, NullColumn::ValueType* nulls, bool* has_null,
-                                       int adjust_scale) {
+                                       int adjust_scale, const uint8_t* input_nulls) {
         [[maybe_unused]] LhsCppType lhs_datum;
         [[maybe_unused]] RhsCppType rhs_datum;
         [[maybe_unused]] const auto scale_factor = get_scale_factor<LhsCppType>(adjust_scale);
@@ -61,7 +61,9 @@ struct DecimalBinaryFunction {
             if constexpr (adjust_left) {
                 overflow = DecimalV3Cast::scale_up<LhsCppType, LhsCppType, check_overflow<overflow_mode>>(
                         lhs_datum, scale_factor, &lhs_datum);
-                // adjusting operand generates decimal overflow
+                // adjusting operand generates decimal overflow. The constant operand is shared by every row, and
+                // NullAwareReportErrorDecimalBinaryFunction never calls in with every row null, so under
+                // REPORT_ERROR this overflow belongs to a non-null row.
                 if constexpr (check_overflow<overflow_mode>) {
                     if (overflow) {
                         if constexpr (error_if_overflow<overflow_mode>) {
@@ -100,8 +102,10 @@ struct DecimalBinaryFunction {
             if constexpr (check_overflow<overflow_mode>) {
                 if (overflow) {
                     if constexpr (error_if_overflow<overflow_mode>) {
-                        throw std::overflow_error(strings::Substitute(
-                                "The '$0' operation involving decimal values overflows", get_op_name<Op>()));
+                        if (!is_null_input_row(input_nulls, i)) {
+                            throw std::overflow_error(strings::Substitute(
+                                    "The '$0' operation involving decimal values overflows", get_op_name<Op>()));
+                        }
                     } else {
                         static_assert(null_if_overflow<overflow_mode>);
                         *has_null = true;
@@ -114,7 +118,7 @@ struct DecimalBinaryFunction {
     }
 
     template <bool lhs_is_const, bool rhs_is_const, LogicalType LhsType, LogicalType RhsType, LogicalType ResultType>
-    static inline ColumnPtr evaluate(const ColumnPtr& lhs, const ColumnPtr& rhs) {
+    static inline ColumnPtr evaluate(const ColumnPtr& lhs, const ColumnPtr& rhs, const uint8_t* input_nulls = nullptr) {
         using ResultCppType = RunTimeCppType<ResultType>;
         using ResultColumnType = RunTimeColumnType<ResultType>;
 
@@ -148,47 +152,47 @@ struct DecimalBinaryFunction {
             if (adjust_scale == 0) {
                 // S(lhs)==S(rhs) no need to adjust
                 all_null = adjust_evaluate<lhs_is_const, rhs_is_const, false, BinaryOperator>(
-                        num_rows, lhs_data, rhs_data, result_data, nulls, &has_null, adjust_scale);
+                        num_rows, lhs_data, rhs_data, result_data, nulls, &has_null, adjust_scale, input_nulls);
             } else if (lhs_scale < rhs_scale) {
                 // S(lhs) < S(rhs), scale lhs up by S(rhs)-S(lhs)
                 all_null = adjust_evaluate<lhs_is_const, rhs_is_const, true, BinaryOperator>(
-                        num_rows, lhs_data, rhs_data, result_data, nulls, &has_null, adjust_scale);
+                        num_rows, lhs_data, rhs_data, result_data, nulls, &has_null, adjust_scale, input_nulls);
             } else {
                 // S(lhs) > S(rhs), scale rhs up by S(lhs)-S(rhs)
                 if constexpr (is_add_op<Op>) {
                     // add: just swap two operands
                     all_null = adjust_evaluate<rhs_is_const, lhs_is_const, true, BinaryOperator>(
-                            num_rows, rhs_data, lhs_data, result_data, nulls, &has_null, adjust_scale);
+                            num_rows, rhs_data, lhs_data, result_data, nulls, &has_null, adjust_scale, input_nulls);
                 } else if constexpr (is_sub_op<Op>) {
                     // sub: just swap two operand and then rhs - lhs
                     using ReverseSubOperator = ArithmeticBinaryOperator<ReverseSubOp, ResultType>;
                     all_null = adjust_evaluate<rhs_is_const, lhs_is_const, true, ReverseSubOperator>(
-                            num_rows, rhs_data, lhs_data, result_data, nulls, &has_null, adjust_scale);
+                            num_rows, rhs_data, lhs_data, result_data, nulls, &has_null, adjust_scale, input_nulls);
                 } else if constexpr (is_mod_op<Op>) {
                     // mod: just swap two operand and then rhs - lhs
                     using ReverseModOperator = ArithmeticBinaryOperator<ReverseModOp, ResultType>;
                
```

**File**: `be/src/exprs/decimal_cast_expr.h` (modified, +62/-17)
```diff
@@ -18,7 +18,9 @@
 
 #include "base/decimal_types.h"
 #include "column/column_builder.h"
+#include "exprs/function_helper.h"
 #include "exprs/overflow.h"
+#include "exprs/unary_function.h"
 #include "types/decimalv3.h"
 #include "types/variant.h"
 
@@ -30,7 +32,8 @@ UNION_VALUE_GUARD(LogicalType, FixedNonDecimalTypeGuard, lt_is_fixed_non_decimal
 
 template <OverflowMode overflow_mode, LogicalType Type, LogicalType ResultType>
 struct DecimalDecimalCast {
-    static inline ColumnPtr evaluate(const ColumnPtr& column, int to_precision, int to_scale) {
+    static inline ColumnPtr evaluate(const ColumnPtr& column, int to_precision, int to_scale,
+                                     const uint8_t* input_nulls = nullptr) {
         using FromCppType = RunTimeCppType<Type>;
         using FromColumnType = RunTimeColumnType<Type>;
         using ToCppType = RunTimeCppType<ResultType>;
@@ -74,7 +77,9 @@ struct DecimalDecimalCast {
                     if constexpr (check_overflow<overflow_mode>) {
                         if (overflow) {
                             if constexpr (error_if_overflow<overflow_mode>) {
-                                throw std::overflow_error("The type cast from decimal to decimal overflows");
+                                if (!is_null_input_row(input_nulls, i)) {
+                                    throw std::overflow_error("The type cast from decimal to decimal overflows");
+                                }
                             } else {
                                 static_assert(null_if_overflow<overflow_mode>);
                                 has_null = true;
@@ -93,7 +98,9 @@ struct DecimalDecimalCast {
                 if constexpr (check_overflow<overflow_mode>) {
                     if (overflow) {
                         if constexpr (error_if_overflow<overflow_mode>) {
-                            throw std::overflow_error("The type cast from decimal to decimal overflows");
+                            if (!is_null_input_row(input_nulls, i)) {
+                                throw std::overflow_error("The type cast from decimal to decimal overflows");
+                            }
                         } else {
                             static_assert(null_if_overflow<overflow_mode>);
                             has_null = true;
@@ -111,7 +118,9 @@ struct DecimalDecimalCast {
                 if constexpr (check_overflow<overflow_mode>) {
                     if (overflow) {
                         if constexpr (error_if_overflow<overflow_mode>) {
-                            throw std::overflow_error("The type cast from decimal to decimal overflows");
+                            if (!is_null_input_row(input_nulls, i)) {
+                                throw std::overflow_error("The type cast from decimal to decimal overflows");
+                            }
                         } else {
                             static_assert(null_if_overflow<overflow_mode>);
                             has_null = true;
@@ -141,16 +150,18 @@ struct DecimalNonDecimalCast<overflow_mode, DecimalType, NonDecimalType, Decimal
     using NonDecimalCppType = RunTimeCppType<NonDecimalType>;
     using NonDecimalColumnType = RunTimeColumnType<NonDecimalType>;
 
-    static inline ColumnPtr decimal_from(const ColumnPtr& column, int precision, int scale) {
+    static inline ColumnPtr decimal_from(const ColumnPtr& column, int precision, int scale,
+                                         const uint8_t* input_nulls = nullptr) {
         if (scale == 0) {
-            return _decimal_from<true>(column, precision, scale);
+            return _decimal_from<true>(column, precision, scale, input_nulls);
         } else {
-            return _decimal_from<false>(column, precision, scale);
+            return _decimal_from<false>(column, precision, scale, input_nulls);
         }
     }
 
     template <bool ZeroScale>
-    static inline ColumnPtr _decimal_from(const ColumnPtr& column, int precision, int scale) {
+    static inline ColumnPtr _decimal_from(const ColumnPtr& column, int precision, int scale,
+                                          const uint8_t* input_nulls) {
         const auto num_rows = column->size();
         typename DecimalColumnType::MutablePtr result = DecimalColumnType::create(precision, scale, num_rows);
         const auto data = &ColumnHelper::cast_to_raw<NonDecimalType>(column.get())->immutable_data().front();
@@ -227,7 +238,9 @@ struct DecimalNonDecimalCast<overflow_mode, DecimalType, NonDecimalType, Decimal
             if constexpr (check_overflow<overflow_mode>) {
                 if (overflow) {
                     if constexpr (error_if_overflow<overflow_mode>) {
-                        throw std::overflow_error("The type cast from other types to decimal overflows");
+                        if (!is_null_input_row(input_nulls, i)) {
+                            throw std::overflow_error("The type cast from other types to decimal
```

**File**: `be/src/exprs/overflow.h` (modified, +10/-0)
```diff
@@ -14,6 +14,9 @@
 
 #pragma once
 
+#include <cstddef>
+#include <cstdint>
+
 namespace starrocks {
 enum OverflowMode {
     // We don't check overflow in this mode
@@ -40,4 +43,11 @@ template <OverflowMode mode>
 inline constexpr bool error_if_overflow = false;
 template <>
 inline constexpr bool error_if_overflow<OverflowMode::REPORT_ERROR> = true;
+
+// Under REPORT_ERROR a decimal kernel can be given the null flags of its input rows (nullptr: no null rows).
+// The data slot of a null row is undefined, e.g. "" after NULLIF or a value left by an upstream expression, so
+// an overflow found in it must not raise an error: the row's result is NULL anyway.
+inline bool is_null_input_row(const uint8_t* input_nulls, size_t row) {
+    return input_nulls != nullptr && input_nulls[row] != 0;
+}
 } // namespace starrocks
```

**File**: `be/test/exprs/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ set(EXPR_TEST_FILES
     decimal_cast_expr_decimalv2_test.cpp
     decimal_cast_expr_integer_test.cpp
     decimal_cast_expr_time_test.cpp
+    decimal_null_row_report_error_test.cpp
     encryption_functions_test.cpp
     function_call_expr_test.cpp
     generate_series_core_test.cpp
```

**File**: `be/test/exprs/decimal_null_row_report_error_test.cpp` (added, +437/-0)
```diff
@@ -0,0 +1,437 @@
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
+// Under sql_mode=ERROR_IF_OVERFLOW (OverflowMode::REPORT_ERROR) a decimal cast or decimal arithmetic must only
+// report an error for a non-null row. The data slot of a null row is undefined ("" for a string, 0, or a value
+// left by an upstream expression), so it must never raise an error. Every case below builds one column whose
+// null row holds a slot that the op rejects, next to a valid non-null row, so neither the all-null nor the
+// no-null shortcut is taken.
+
+#include <gtest/gtest.h>
+
+#include <stdexcept>
+#include <string>
+#include <vector>
+
+#include "column/binary_column.h"
+#include "column/column_helper.h"
+#include "column/const_column.h"
+#include "column/nullable_column.h"
+#include "column/runtime_type_traits.h"
+#include "exprs/arithmetic_operation.h"
+#include "exprs/decimal_binary_function.h"
+#include "exprs/decimal_cast_expr.h"
+#include "types/date_value.h"
+#include "types/timestamp_value.h"
+
+namespace starrocks {
+
+namespace {
+
+constexpr auto REPORT = OverflowMode::REPORT_ERROR;
+
+template <typename DataColumn>
+ColumnPtr make_nullable(typename DataColumn::MutablePtr data, const std::vector<uint8_t>& is_null) {
+    auto nulls = NullColumn::create();
+    bool any_null = false;
+    for (auto n : is_null) {
+        nulls->get_data().push_back(n);
+        any_null |= (n != 0);
+    }
+    auto column = NullableColumn::create(std::move(data), std::move(nulls));
+    column->set_has_null(any_null);
+    return column;
+}
+
+ColumnPtr make_strings(const std::vector<std::string>& values, const std::vector<uint8_t>& is_null) {
+    auto data = BinaryColumn::create();
+    for (const auto& v : values) {
+        data->append(Slice(v));
+    }
+    if (is_null.empty()) {
+        return data;
+    }
+    return make_nullable<BinaryColumn>(std::move(data), is_null);
+}
+
+template <LogicalType Type>
+ColumnPtr make_decimals(int precision, int scale, const std::vector<RunTimeCppType<Type>>& values,
+                        const std::vector<uint8_t>& is_null) {
+    auto data = RunTimeColumnType<Type>::create(precision, scale);
+    for (const auto& v : values) {
+        data->get_data().push_back(v);
+    }
+    if (is_null.empty()) {
+        return data;
+    }
+    return make_nullable<RunTimeColumnType<Type>>(std::move(data), is_null);
+}
+
+template <LogicalType Type>
+ColumnPtr make_values(const std::vector<RunTimeCppType<Type>>& values, const std::vector<uint8_t>& is_null) {
+    auto data = RunTimeColumnType<Type>::create();
+    for (const auto& v : values) {
+        data->get_data().push_back(v);
+    }
+    return make_nullable<RunTimeColumnType<Type>>(std::move(data), is_null);
+}
+
+void expect_nulls(const ColumnPtr& result, const std::vector<bool>& expected) {
+    ASSERT_EQ(result->size(), expected.size());
+    for (size_t i = 0; i < expected.size(); ++i) {
+        EXPECT_EQ(result->is_null(i), expected[i]) << "row " << i;
+    }
+}
+
+template <LogicalType Type>
+RunTimeCppType<Type> value_at(const ColumnPtr& result, size_t row) {
+    const auto* data = ColumnHelper::get_data_column(result.get());
+    return down_cast<const RunTimeColumnType<Type>*>(data)->immutable_data()[row];
+}
+
+template <LogicalType From, LogicalType To, typename... Args>
+ColumnPtr cast_from(const ColumnPtr& column, Args... args) {
+    return VectorizedDecimalCastFunction<DecimalFrom, REPORT>::evaluate<From, To>(column, args...);
+}
+
+template <LogicalType From, LogicalType To>
+ColumnPtr cast_to(const ColumnPtr& column) {
+    return VectorizedDecimalCastFunction<DecimalTo, REPORT>::evaluate<From, To>(column);
+}
+
+template <LogicalType From, LogicalType To>
+ColumnPtr cast_decimal(const ColumnPtr& column, int precision, int scale) {
+    return VectorizedDecimalCastFunction<DecimalToDecimal, REPORT>::evaluate<From, To>(column, precision, scale);
+}
+
+const int128_t kE20 = static_cast<int128_t>(100000000000LL) * 1000000000LL; // 1e20
+const int128_t kE38 = kE20 * 1000000000000000000LL;                         // 1e38
+
+} // namespace
+
+class DecimalNullRowReportErrorTest : public ::testing::Test {
+public:
+    void SetUp() override { date::init_date_cache(); }
+};
+
+// ---------------------------------------------------------------- cast -> DECIMAL (DecimalFrom)
+
+// Issue #82140: NULLIF(x, '') leaves "" in the null row, an
```

**File**: `test/sql/test_analyze_statistics/R/test_stats_mixed_null_column_error_if_overflow` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+-- name: test_stats_mixed_null_column_error_if_overflow @sequential
+[UC]ori_sql_mode=select @@GLOBAL.sql_mode;
+-- result:
+
+-- !result
+set global sql_mode = 'ERROR_IF_OVERFLOW';
+-- result:
+-- !result
+create database analyze_test_${uuid0};
+-- result:
+-- !result
+use analyze_test_${uuid0};
+-- result:
+-- !result
+CREATE TABLE `mixed_null_decimal` (
+  `k1` int,
+  `c1` decimal(20,8)
+)
+DUPLICATE KEY(`k1`)
+PARTITION BY RANGE(`k1`) (
+  PARTITION p1 VALUES LESS THAN ("10"),
+  PARTITION p2 VALUES LESS THAN ("20")
+)
+DISTRIBUTED BY HASH(`k1`) BUCKETS 1
+PROPERTIES ('replication_num' = '1');
+-- result:
+-- !result
+INSERT INTO mixed_null_decimal VALUES (1, null), (2, null), (11, 1.25), (12, 2.50);
+-- result:
+-- !result
+analyze table mixed_null_decimal;
+-- result:
+[REGEX].*OK.*
+-- !result
+select partition_name, length(`max`) > 0, length(`min`) > 0 from default_catalog._statistics_.column_statistics where table_name='analyze_test_${uuid0}.mixed_null_decimal' and column_name='c1' order by partition_name;
+-- result:
+p1	0	0
+p2	1	1
+-- !result
+LOOP {
+  PROPERTY: {"timeout": 120, "interval": 5, "desc": "wait column stats cache load under ERROR_IF_OVERFLOW"}
+  result=explain costs select c1 from mixed_null_decimal;
+  CHECK: re.search("c1-->\[1.25, 2.5, .*ESTIMATE", ${result}) != None
+} END LOOP
+set global sql_mode = '${ori_sql_mode}';
+-- result:
+-- !result
+drop database analyze_test_${uuid0};
+-- result:
+-- !result
+CLEANUP {
+    set global sql_mode = '${ori_sql_mode}';
+    drop database if exists analyze_test_${uuid0};
+} END CLEANUP
```

---

### Incident Patch 2: `c3f653d9` (2026-11-04)
**Commit Message**: [BugFix] Keep the gtid image block at id 40 (#82360)

Signed-off-by: PengFei Li <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/persist/metablock/SRMetaBlockID.java` (modified, +4/-1)
```diff
@@ -110,7 +110,10 @@ public int getId() {
     // AIProviderMgr image block (SQL-managed embedding / rerank providers).
     public static final SRMetaBlockID AI_PROVIDER_MGR = new SRMetaBlockID(38);
 
-    public static final SRMetaBlockID GTID_GENERATOR = new SRMetaBlockID(39);
+    // Placeholder.
+    public static final SRMetaBlockID PLACEHOLDER = new SRMetaBlockID(39);
+
+    public static final SRMetaBlockID GTID_GENERATOR = new SRMetaBlockID(40);
 
     /**
      * NOTICE: SRMetaBlockID cannot use a value exceeding 20000, please follow the above sequence number
```

---

### Incident Patch 3: `dfff47f3` (2026-11-03)
**Commit Message**: [BugFix][RB-843] Read channel stream load pipes without blocking, with the default buffer (#81872)

Signed-off-by: meegoo <[REDACTED_EMAIL]>
Co-authored-by: mervinsr <[REDACTED_EMAIL]>
Co-authored-by: meegoo <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `be/src/compute_env/load/stream_context_mgr.cpp` (modified, +13/-1)
```diff
@@ -29,6 +29,12 @@
 
 namespace starrocks {
 
+// How long a read of a channel stream load pipe waits for data before the pipeline scan yields. A channel can stay
+// idle for seconds between the requests of a transaction. Data and the end of the stream wake the read at once, so
+// a longer wait only means fewer wake-ups of idle channels: with a 500 us wait, the scan task of every idle channel
+// was re-queued thousands of times a second.
+static constexpr int32_t CHANNEL_PIPE_READ_WAIT_US = 20 * 1000;
+
 StreamContextMgr::StreamContextMgr(LoadStreamMgr* load_stream_mgr) : _load_stream_mgr(load_stream_mgr) {}
 
 StreamContextMgr::~StreamContextMgr() {
@@ -93,7 +99,13 @@ Status StreamContextMgr::create_channel_context(const std::string& label, int ch
     if (_load_stream_mgr == nullptr) {
         return Status::InternalError("load stream manager is not initialized");
     }
-    auto pipe = std::make_shared<StreamLoadPipe>(true);
+    // A channel stays open between the requests of a transaction and until it is committed. Its fragment reads
+    // without blocking (the pipeline scan yields on a timed-out read), so an open channel holds a connector scan
+    // thread for at most one read wait instead of until its next request, and requests are buffered like any
+    // stream load's, so an HTTP worker does not wait for the fragment to consume the previous chunk.
+    auto pipe = std::make_shared<StreamLoadPipe>(/*non_blocking_read=*/true, CHANNEL_PIPE_READ_WAIT_US,
+                                                 DEFAULT_STREAM_LOAD_PIPE_BUFFERED_BYTES,
+                                                 DEFAULT_STREAM_LOAD_PIPE_CHUNK_SIZE);
     RETURN_IF_ERROR(_load_stream_mgr->put(load_id, pipe));
     ctx = new StreamLoadContext(load_id, _load_stream_mgr);
     if (ctx == nullptr) {
```

**File**: `be/src/compute_env/load/stream_load_pipe.h` (modified, +5/-0)
```diff
@@ -37,6 +37,7 @@
 #include <condition_variable>
 #include <deque>
 #include <mutex>
+#include <type_traits>
 #include <utility>
 
 #include "base/bit/bit_util.h"
@@ -59,6 +60,10 @@ class StreamLoadPipe : public MessageBodySink {
                    size_t min_chunk_size = DEFAULT_STREAM_LOAD_PIPE_CHUNK_SIZE)
             : StreamLoadPipe(false, -1, max_buffered_bytes, min_chunk_size) {}
 
+    // A lone bool would silently bind to max_buffered_bytes above: a 1-byte buffer with blocking reads.
+    template <typename T, typename = std::enable_if_t<std::is_same_v<T, bool>>>
+    explicit StreamLoadPipe(T non_blocking_read) = delete;
+
     StreamLoadPipe(bool non_blocking_read, int32_t non_blocking_wait_us, size_t max_buffered_bytes,
                    size_t min_chunk_size)
             : _non_blocking_read(non_blocking_read),
```

**File**: `be/src/connector/file/scanner/csv_scanner.cpp` (modified, +24/-18)
```diff
@@ -275,27 +275,33 @@ Status CSVScanner::_init_reader() {
         }
 
         // only the first range needs to skip header
-        if (_parse_options.skip_header && range_desc.start_offset == 0) {
-            for (int64_t i = 0; i < _parse_options.skip_header; i++) {
-                CSVReader::Record dummy;
-                auto st = _curr_reader->next_record(&dummy);
-                if (!st.ok()) {
-                    if (st.is_end_of_file()) {
-                        auto err_msg = fmt::format(
-                                "The parameter 'skip_header' is set to {}, but there are only {} rows in the csv file",
-                                _parse_options.skip_header, i);
-
-                        return Status::EndOfFile(err_msg);
-                    } else {
-                        return st;
-                    }
-                }
-            }
-        }
-        return Status::OK();
+        _header_rows_to_skip =
+                (_parse_options.skip_header && range_desc.start_offset == 0) ? _parse_options.skip_header : 0;
     } else if (_curr_reader == nullptr) {
         return Status::EndOfFile("CSVScanner");
     }
+    return _skip_header_rows();
+}
+
+Status CSVScanner::_skip_header_rows() {
+    // A read of a stream load pipe that has no data yet times out. The header rows still to skip carry over to the
+    // next call, which goes on with the same reader.
+    while (_header_rows_to_skip > 0) {
+        CSVReader::Record dummy;
+        auto st = _curr_reader->next_record(&dummy);
+        if (!st.ok()) {
+            if (st.is_end_of_file()) {
+                const int64_t skipped = _parse_options.skip_header - _header_rows_to_skip;
+                _header_rows_to_skip = 0;
+                auto err_msg = fmt::format(
+                        "The parameter 'skip_header' is set to {}, but there are only {} rows in the csv file",
+                        _parse_options.skip_header, skipped);
+                return Status::EndOfFile(err_msg);
+            }
+            return st;
+        }
+        --_header_rows_to_skip;
+    }
     return Status::OK();
 }
 
```

**File**: `be/src/connector/file/scanner/csv_scanner.h` (modified, +3/-0)
```diff
@@ -76,6 +76,7 @@ class CSVScanner final : public FileScanner {
     ChunkPtr _create_chunk(const std::vector<SlotDescriptor*>& slots);
 
     Status _init_reader();
+    Status _skip_header_rows();
     Status _parse_csv(Chunk* chunk);
     Status _parse_csv_v2(Chunk* chunk);
 
@@ -93,6 +94,8 @@ class CSVScanner final : public FileScanner {
     int _num_fields_in_csv = 0;
     int _curr_file_index = -1;
     CSVReaderPtr _curr_reader;
+    // Header rows of the current range still to skip; a timed-out read leaves the rest to the next call.
+    int64_t _header_rows_to_skip = 0;
     std::vector<ConverterPtr> _converters;
     bool _use_v2;
     CSVReader::Fields fields;
```

**File**: `be/src/formats/csv/csv_reader.cpp` (modified, +23/-10)
```diff
@@ -112,16 +112,26 @@ Status CSVReader::buffInit() {
 }
 
 Status CSVReader::readMore(bool expandBuffer) {
+    // Once a read of this more_rows() call has timed out, the row being parsed cannot be completed in this call.
+    // Every later read fails at once too, also one inside is_row_delimiter() or is_column_delimiter(), which only
+    // returns false: the parser then reaches NEWROW without taking bytes of a delimiter for data, and parses the
+    // row again on the next call.
+    if (UNLIKELY(!_read_timeout.ok())) {
+        return _read_timeout;
+    }
+    Status st;
     if (_buff.free_space() > 0) {
-        return _fill_buffer();
+        st = _fill_buffer();
+    } else if (expandBuffer) {
+        RETURN_IF_ERROR(_expand_buffer_loosely());
+        st = _fill_buffer();
     } else {
-        if (expandBuffer) {
-            RETURN_IF_ERROR(_expand_buffer_loosely());
-            return _fill_buffer();
-        } else {
-            return Status::OK();
-        }
+        return Status::OK();
+    }
+    if (UNLIKELY(st.is_time_out())) {
+        _read_timeout = st;
     }
+    return st;
 }
 
 #define DOUBLE_CHECK_AVAILABLE()                \
@@ -156,6 +166,7 @@ Status CSVReader::more_rows() {
     if (UNLIKELY(_limit > 0 && _parsed_bytes > _limit)) {
         return Status::EndOfFile("Reached limit");
     }
+    _read_timeout = Status::OK();
     Status status = Status::OK();
     status = buffInit();
     if (!status.ok()) {
@@ -403,10 +414,12 @@ Status CSVReader::more_rows() {
 
         newrow_label:
         case NEWROW:
-            if (reachBuffEnd) {
-                // We dot get the complete row, back the read pointer, continue next time.
+            if (reachBuffEnd || UNLIKELY(status.is_time_out())) {
+                // The row is not complete: move the read pointer back to its start and parse it again next time. A
+                // timed-out read (a stream load pipe that has no data yet) returns its status so that the scanner
+                // yields; the bytes of the row stay in the buffer for the next call.
                 _buff.set_position_offset(parsed_start);
-                return Status::OK();
+                return status;
             }
             _parsed_bytes += _buff.position_offset() - parsed_start;
             parsed_end = _buff.position_offset();
```

**File**: `be/src/formats/csv/csv_reader.h` (modified, +2/-0)
```diff
@@ -220,6 +220,8 @@ class CSVReader {
 
     size_t _parsed_bytes = 0;
     size_t _limit = 0;
+    // Set by the first read of a more_rows() call that times out (a stream load pipe that has no data yet).
+    Status _read_timeout;
 };
 
 } // namespace starrocks
```

**File**: `be/test/compute_env/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ add_executable(compute_env_test
         data_stream_mgr_test.cpp
         fragment_dict_state_test.cpp
         load/load_stream_mgr_test.cpp
+        load/stream_context_mgr_test.cpp
         load/stream_load_context_test.cpp
         load/stream_load_metrics_test.cpp
         load/stream_load_pipe_test.cpp
```

**File**: `be/test/compute_env/load/stream_context_mgr_test.cpp` (added, +125/-0)
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
+#include "compute_env/load/stream_context_mgr.h"
+
+#include <gtest/gtest.h>
+
+#include <chrono>
+#include <cstdint>
+#include <functional>
+#include <future>
+#include <memory>
+#include <optional>
+#include <string>
+#include <type_traits>
+#include <utility>
+
+#include "base/testutil/assert.h"
+#include "base/uid_util.h"
+#include "base/utility/defer_op.h"
+#include "compute_env/load/load_stream_mgr.h"
+#include "compute_env/load/stream_load_context.h"
+#include "compute_env/load/stream_load_pipe.h"
+#include "gen_cpp/PlanNodes_types.h"
+#include "runtime/byte_buffer.h"
+
+namespace starrocks {
+
+// A lone bool used to bind to StreamLoadPipe(size_t max_buffered_bytes, ...): a 1-byte buffer with blocking reads.
+static_assert(!std::is_constructible_v<StreamLoadPipe, bool>);
+static_assert(std::is_constructible_v<StreamLoadPipe, size_t>);
+
+namespace {
+
+ByteBufferPtr make_buffer(size_t size, char fill) {
+    auto buf = ByteBuffer::allocate_with_tracker(size).value();
+    const std::string data(size, fill);
+    buf->put_bytes(data.data(), data.size());
+    buf->flip_to_read();
+    return buf;
+}
+
+// Runs `fn` on another thread and waits up to 10 s for it. A pipe call that blocks would never return, so on a
+// timeout the pipe is cancelled to release the thread, and nullopt lets the caller fail instead of hanging.
+std::optional<Status> call_with_deadline(StreamLoadPipe* pipe, std::function<Status()> fn) {
+    auto future = std::async(std::launch::async, std::move(fn));
+    if (future.wait_for(std::chrono::seconds(10)) != std::future_status::ready) {
+        pipe->cancel(Status::Cancelled("blocked past the deadline"));
+        future.wait();
+        return std::nullopt;
+    }
+    return future.get();
+}
+
+} // namespace
+
+// A channel stays open between the requests of a transaction and until it is committed. If its pipe blocked a
+// reader that has no data, every open channel would hold a connector scan thread; if the pipe could not buffer a
+// request while the fragment is not reading, the HTTP worker delivering it would wait for the fragment. Together
+// they deadlocked compute nodes with more open channels than connector scan threads until the transactions timed
+// out.
+TEST(StreamContextMgrTest, channel_pipe_reads_without_blocking_and_buffers_requests) {
+    // Declared first: a context removes its pipe from the load stream manager when it is released.
+    LoadStreamMgr load_stream_mgr;
+    StreamContextMgr stream_context_mgr(&load_stream_mgr);
+    const TUniqueId load_id = UniqueId::gen_uid().to_thrift();
+    StreamLoadContext* ctx = nullptr;
+    ASSERT_OK(stream_context_mgr.create_channel_context("label", 0, "db", "tbl", TFileFormatType::FORMAT_CSV_PLAIN, ctx,
+                                                        load_id, 1));
+    DeferOp release_ctx([&] { StreamLoadContext::release(ctx); });
+
+    auto pipe = std::dynamic_pointer_cast<StreamLoadPipe>(ctx->body_sink);
+    ASSERT_NE(nullptr, pipe);
+    ASSERT_EQ(pipe, load_stream_mgr.get(load_id));
+
+    // The fragment starts reading before any request arrives: the read times out instead of blocking.
+    auto read_st = call_with_deadline(pipe.get(), [&pipe] { return pipe->read().status(); });
+    ASSERT_TRUE(read_st.has_value()) << "a read with no data blocked";
+    ASSERT_TRUE(read_st->is_time_out()) << *read_st;
+
+    // The scanners read through StreamLoadPipeInputStream, which uses the byte read.
+    auto byte_read_st = call_with_deadline(pipe.get(), [&pipe] {
+        uint8_t data[16];
+        size_t size = sizeof(data);
+        bool eof = false;
+        return pipe->read(data, &size, &eof);
+    });
+    ASSERT_TRUE(byte_read_st.has_value()) << "a byte read with no data blocked";
+    ASSERT_TRUE(byte_read_st->is_time_out()) << *byte_read_st;
+
+    // Two requests arrive while the fragment is not reading. Both fit in the default buffer, so the second one
+    // does not wait for the fragment to consume the first.
+    const size_t request_bytes = DEFAULT_STREAM_LOAD_PIPE_BUFFERED_BYTES / 2;
+    ASSERT_OK(pipe->append(make_buffer(request_bytes, 'a')));
+    auto second_request = make_buffer(request_bytes, 'b');
+    auto append_st = call_with_deadline(pipe.get(), [&] { return pipe->append(std::move(second_request)); });
+    ASSERT_TRUE(append_st.has_
```

#### Recent Merged Pull Requests:
- **PR #82406** (2026-11-04): [Tool] Retire the stale GEO storage descriptor waivers (backport #82400) (@trueeyu)
- **PR #82403** (2026-11-04): [UT][RB-428] Stop the background publish in OptimizeJobV2Test (backport #82396) (@mergify[bot])
- **PR #82401** (2026-11-04): [Enhancement] Keep a bundled tablet's lake publish result for the retry (backport #81774) (@mergify[bot])
- **PR #82400** (2026-11-04): [Tool] Retire the stale GEO storage descriptor waivers (@trueeyu)
- **PR #82396** (2026-11-04): [UT][RB-428] Stop the background publish in OptimizeJobV2Test (@starrocks-bot[bot])
- **PR #82393** (2026-11-04): [Refactor] Use DistinctAggregateStateV2 for the nullable decimal_multi_distinct_sum wrapper (backport #82383) (@mergify[bot])

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

## X. [BugFix] Never raise a decimal overflow error from a NULL row's data under ERROR

**RULE**:
When implementing operations in `be/src/exprs/arithmetic_expr.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `84536d8f`: [BugFix] Never raise a decimal overflow error from a NULL row's data under ERROR_IF_OVERFLOW (#82254). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `be/src/exprs/arithmetic_expr.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    using CastFunction = VectorizedDecimalCastFunction<DecimalTo, Mode>;                  \
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
    using CastFunction = VectorizedUnaryFunction<DecimalTo<Mode>>;                        \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `84536d8f` are properly handled with clean fallback behavior.
