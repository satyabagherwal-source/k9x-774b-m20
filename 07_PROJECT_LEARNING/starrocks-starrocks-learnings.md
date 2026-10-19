> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `158cf605`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:14:05.276Z  
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
> **Harvest Timestamp**: 2026-10-19T03:14:04.590Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12187 stars

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
    template <typename T>
    static constexpr int _max_vlq_byte_len() {
        return BitUtil::Ceil(sizeof(T) * 8, 7);
    }

    // current read position in the buffer
    const uint8_t* _buffer_pos = nullptr;

    // the end of buffer
    const uint8_t* _buffer_end = nullptr;
};

} // namespace starrocks

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
            return false;
        }
        tmp |= static_cast<uint64_t>(byte & 0x7F) << (7 * i);

        if ((byte & 0x80) == 0) {
            *v = tmp;
            return true;
        }
 
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

### Incident Patch 1: `ecb0be33` (2026-10-16)
**Commit Message**: [BugFix] Drop repeated policy lookups and unbounded waits left by the planner lock fixes (#80943)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/MVTimelinessMgr.java` (modified, +78/-13)
```diff
@@ -14,19 +14,30 @@
 
 package com.starrocks.scheduler.mv;
 
+import com.google.common.base.Throwables;
 import com.google.common.collect.Maps;
 import com.starrocks.catalog.MaterializedView;
 import com.starrocks.catalog.MvRefreshArbiter;
 import com.starrocks.catalog.MvUpdateInfo;
 import com.starrocks.catalog.TableProperty;
 import com.starrocks.catalog.mv.MVTimelinessArbiter;
 import com.starrocks.common.Config;
+import com.starrocks.common.profile.Tracers;
 import com.starrocks.memory.MemoryTrackable;
+import com.starrocks.qe.ConnectContext;
+import com.starrocks.server.GlobalStateMgr;
+import com.starrocks.sql.common.ErrorType;
+import com.starrocks.sql.common.StarRocksPlannerException;
+import org.apache.logging.log4j.LogManager;
+import org.apache.logging.log4j.Logger;
 
+import java.time.Duration;
+import java.time.Instant;
 import java.util.Map;
-import java.util.concurrent.CancellationException;
 import java.util.concurrent.CompletableFuture;
-import java.util.concurrent.CompletionException;
+import java.util.concurrent.ExecutionException;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.TimeoutException;
 
 /**
  * Manage the timeliness of materialized view according to the MVChangeEvent across multiple queries.
@@ -40,6 +51,10 @@
  * TODO: we can track more mv/base table's changes to update the timeliness info in the future.
  */
 public class MVTimelinessMgr implements MemoryTrackable {
+    private static final Logger LOG = LogManager.getLogger(MVTimelinessMgr.class);
+    private static final long AWAIT_SLICE_MS = 100;
+    private static final Duration AWAIT_SLICE = Duration.ofMillis(AWAIT_SLICE_MS);
+
     // materialized view -> MvUpdateInfo, completed by the lookup that put the future and awaited by the others. An
     // invalidation removes the future, also one still being computed: later lookups put a new one, so a result read
     // from the state before the invalidation is never handed to them.
@@ -56,17 +71,9 @@ public MvUpdateInfo getMVTimelinessInfo(MaterializedView mv,
             return MvRefreshArbiter.getMVTimelinessUpdateInfo(mv, queryRewriteParams);
         }
         CompletableFuture<MvUpdateInfo> mine = new CompletableFuture<>();
-        while (true) {
-            CompletableFuture<MvUpdateInfo> existing = mvTimelinessMap.putIfAbsent(mv, mine);
-            if (existing == null) {
-                break;
-            }
-            try {
-                return existing.join();
-            } catch (CompletionException | CancellationException e) {
-                // The lookup computing it failed and removed its future before failing it. Try again to put one, so
-                // that one of the waiters computes for all of them and its result is cached.
-            }
+        CompletableFuture<MvUpdateInfo> existing = mvTimelinessMap.putIfAbsent(mv, mine);
+        if (existing != null) {
+            return awaitInFlight(mv, existing);
         }
         MvUpdateInfo computed;
         try {
@@ -82,9 +89,67 @@ public MvUpdateInfo getMVTimelinessInfo(MaterializedView mv,
             mvTimelinessMap.remove(mv, mine);
         }
         mine.complete(computed);
+        // DROP removes the MV from the catalog before it evicts this entry. A future put after that eviction would
+        // otherwise stay forever, holding the MV and its MvUpdateInfo.
+        if (!isInCatalog(mv)) {
+            mvTimelinessMap.remove(mv, mine);
+        }
         return computed;
     }
 
+    /**
+     * Waits on the check another lookup is computing, in slices so that a cancelled statement stops waiting:
+     * KILL QUERY and the query timeout only mark the statement, they do not interrupt this thread.
+     *
+     * <p>Once the statement's budget is spent the lookup fails rather than computing the check itself: that would
+     * repeat the same slow reads -- the base tables' partitions through the connector -- once per waiter, with nothing
+     * bounding them either. The failure reaches the caller as a failing check would: query rewrite preprocessing
+     * skips the MV for this query, while a query reading the MV through transparent rewrite may fail with it.
+     */
+    private MvUpdateInfo awaitInFlight(MaterializedView mv, CompletableFuture<MvUpdateInfo> existing) {
+        ConnectContext context = ConnectContext.get();
+        // Without a statement there is no budget and no cancellation: wait as long as the check takes.
+        Instant deadline = context == null
+                ? Instant.MAX
+                : context.getStartTimeInstant().plusSeconds(context.getExecTimeout());
+        while (true) {
+            if (context != null && context.isStatementCancelled()) {
+                throw new StarRocksPlannerException("statement cancelled while waiting for the timeliness of " +
+                        "materialized view " + mv.getName(), ErrorType.USER_ERROR);
+            }
+            Duration remaining = Duration.between(Instant.no
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/InsertPlanner.java` (modified, +1/-1)
```diff
@@ -325,7 +325,7 @@ public ExecPlan plan(InsertStmt insertStmt, ConnectContext session) {
             // the optimizer runs with the meta lock released, so every table the plan reaches has to be a
             // private copy. Collecting it inside buildExecPlanWithRetry -- where it used to live -- was too
             // late, because the logical plan built here would still point at the live objects.
-            originalOlapTables = StatementPlanner.collectOriginalOlapTables(session, insertStmt);
+            originalOlapTables = StatementPlanner.collectOriginalOlapTables(session, insertStmt, plannerMetaLocker);
         }
         try {
             return planWithRetry(insertStmt, session);
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/StatementPlanner.java` (modified, +16/-8)
```diff
@@ -685,7 +685,7 @@ public static ExecPlan createQueryPlanWithReTry(QueryStatement queryStmt,
         // the original olapTable in queryStmt had been replaced with the copied olapTable
         Set<OlapTable> olapTables = originalOlapTables != null
                 ? originalOlapTables
-                : collectOriginalOlapTables(session, queryStmt);
+                : collectOriginalOlapTables(session, queryStmt, plannerMetaLocker);
         for (int i = 0; i < Config.max_query_retry_time; ++i) {
             if (!isSchemaValid) {
                 planStartTime = OptimisticVersion.generate();
@@ -766,16 +766,24 @@ private static boolean checkOlapTableSchemaValid(Set<OlapTable> olapTables, long
         return olapTables.stream().allMatch(t -> OptimisticVersion.validateTableUpdate(t, planStartTime));
     }
 
-    public static Set<OlapTable> collectOriginalOlapTables(ConnectContext session, StatementBase queryStmt) {
+    /**
+     * Copy every olap table of an analyzed statement, for a caller that still holds {@code heldLocker}. Only what
+     * that lock does not cover -- what analysis brought in -- is locked on top of it, and within the wait the caller
+     * set on it ({@link PlannerMetaLocker#setAcquireTimeoutMs}), which an MV refresh bounds: a locker of its own
+     * would wait for good, and building one from the statement would also look the policies up again and reset
+     * the session's statement databases.
+     */
+    public static Set<OlapTable> collectOriginalOlapTables(ConnectContext session, StatementBase queryStmt,
+                                                           PlannerMetaLocker heldLocker) {
         Set<OlapTable> olapTables = Sets.newHashSet();
-        PlannerMetaLocker locker = new PlannerMetaLocker(session, queryStmt);
-        try {
-            // Need lock to avoid olap table metas ConcurrentModificationException
-            lock(locker);
+        try (PlannerMetaLocker missing = heldLocker.forTablesNotLockedOf(session, queryStmt)) {
+            // Need lock to avoid olap table metas ConcurrentModificationException. Usually the held lock covers every
+            // table already, and then there is nothing to acquire.
+            if (!missing.isEmpty()) {
+                lock(missing);
+            }
             AnalyzerUtils.copyOlapTable(queryStmt, olapTables);
             return olapTables;
-        } finally {
-            unLock(locker);
         }
     }
 
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/PlannerMetaLocker.java` (modified, +9/-2)
```diff
@@ -192,7 +192,9 @@ private void checkWalkedViewsOnFirstLock() {
      */
     public PlannerMetaLocker forAllTablesOf(ConnectContext session, StatementBase analyzedStatement) {
         PlannerMetaLocker all = new PlannerMetaLocker(queryId, acquireTimeoutMs);
-        new TableCollector(session, all.dbs, all.tables).visit(analyzedStatement);
+        TableCollector collector = new TableCollector(session, all.dbs, all.tables);
+        collector.analyzed = true;
+        collector.visit(analyzedStatement);
         return all;
     }
 
@@ -482,6 +484,11 @@ private static class TableCollector extends AstTraverser<Void, Void> {
         private boolean inBodyRewrittenByPolicy = false;
         // Collect nothing but what the policies of already resolved external tables read.
         private boolean externalPoliciesOnly = false;
+        // Walking an analyzed statement: every policy the analyzer applied is in it already, as the subquery it was
+        // rewritten to (QueryAnalyzer clears the relation's policy flag then), and the tables it reads are walked as
+        // any other. A relation still flagged had no policy when analyzed, so looking its policies up again -- per
+        // column, through Ranger -- would only find what the statement does not read.
+        private boolean analyzed = false;
         private boolean mayReachExternalTablePolicy = false;
 
         public TableCollector(ConnectContext session, Map<Long, Database> dbs, Map<Long, Set<Long>> tables) {
@@ -657,7 +664,7 @@ public Void visitTable(TableRelation node, Void context) {
             }
             boolean rewrittenByPolicy = (inBodyRewrittenByPolicy || node.isNeedRewrittenByPolicy())
                     && !node.isSyncMVQuery() && !node.isCacheStatsQuery();
-            if (rewrittenByPolicy) {
+            if (rewrittenByPolicy && !analyzed) {
                 visitPolicyBodies(new TableName(InternalCatalog.DEFAULT_INTERNAL_CATALOG_NAME,
                         dbAndTable.first.getFullName(), dbAndTable.second.getName()), dbAndTable.second);
             }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/scheduler/mv/MVRefreshLockParamsTest.java` (modified, +55/-0)
```diff
@@ -16,23 +16,35 @@
 
 import com.starrocks.catalog.Database;
 import com.starrocks.catalog.MaterializedView;
+import com.starrocks.catalog.OlapTable;
 import com.starrocks.common.util.UUIDUtil;
 import com.starrocks.common.util.concurrent.lock.LockParams;
+import com.starrocks.qe.ConnectContext;
 import com.starrocks.scheduler.MVTaskRunProcessor;
 import com.starrocks.scheduler.Task;
 import com.starrocks.scheduler.TaskBuilder;
 import com.starrocks.scheduler.TaskRun;
 import com.starrocks.scheduler.TaskRunBuilder;
 import com.starrocks.scheduler.TaskRunContext;
 import com.starrocks.server.GlobalStateMgr;
+import com.starrocks.sql.StatementPlanner;
+import com.starrocks.sql.analyzer.PlannerMetaLocker;
+import com.starrocks.sql.ast.StatementBase;
 import com.starrocks.sql.optimizer.rule.transformation.materialization.MVTestBase;
 import com.starrocks.sql.plan.ConnectorPlanTestBase;
+import mockit.Invocation;
+import mockit.Mock;
+import mockit.MockUp;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 
+import java.util.Arrays;
+import java.util.List;
 import java.util.Map;
 import java.util.Set;
+import java.util.concurrent.CopyOnWriteArrayList;
+import java.util.concurrent.CopyOnWriteArraySet;
 
 /**
  * An external base table has no usable lock identity: BaseTableInfo's external constructor leaves tableId at
@@ -112,4 +124,47 @@ public void testMixedBaseTablesKeepOnlyTheInternalEntry() throws Exception {
         // The -1 default that external BaseTableInfos carry must never show up as a lock id.
         lockParams.getTables().values().forEach(ids -> Assertions.assertFalse(ids.contains(-1L)));
     }
+
+    /**
+     * The refresh takes its lock within mv_refresh_try_lock_timeout_ms and bounds every later acquisition the same
+     * way. Planning the INSERT off copies collects them while that lock is held; a locker of its own there would
+     * wait without a bound, on top of the held lock. The INSERT of a refresh plans off copies only when it reads
+     * through a connector (AnalyzerUtils#isCopySafe), hence the MV over a hive table.
+     */
+    @Test
+    public void testRefreshPlanningTakesNoUnboundedLock() throws Exception {
+        Thread refresher = Thread.currentThread();
+        List<String> unbounded = new CopyOnWriteArrayList<>();
+        new MockUp<PlannerMetaLocker>() {
+            @Mock
+            public void lock(Invocation invocation) {
+                if (Thread.currentThread() == refresher) {
+                    // The caller: the first frame of ours that is not the locker or this probe.
+                    Arrays.stream(new Throwable().getStackTrace())
+                            .filter(f -> f.getClassName().startsWith("com.starrocks.")
+                                    && !f.getClassName().startsWith(PlannerMetaLocker.class.getName())
+                                    && !f.getClassName().startsWith(MVRefreshLockParamsTest.class.getName()))
+                            .findFirst().ifPresent(f -> unbounded.add(f.toString()));
+                }
+                invocation.proceed();
+            }
+        };
+        Database db = GlobalStateMgr.getCurrentState().getLocalMetastore().getDb("test");
+        MaterializedView mv = (MaterializedView) GlobalStateMgr.getCurrentState().getLocalMetastore()
+                .getTable(db.getFullName(), "lock_params_mixed_mv");
+        Set<String> plannedOffCopies = new CopyOnWriteArraySet<>();
+        new MockUp<StatementPlanner>() {
+            @Mock
+            public Set<OlapTable> collectOriginalOlapTables(Invocation invocation, ConnectContext session,
+                                                            StatementBase stmt, PlannerMetaLocker heldLocker) {
+                plannedOffCopies.add(stmt.getClass().getSimpleName());
+                return invocation.proceed(session, stmt, heldLocker);
+            }
+        };
+        refreshMV(db.getFullName(), mv);
+        Assertions.assertEquals(Set.of("InsertStmt"), plannedOffCopies,
+                "the refresh did not plan its INSERT off copies, so this is not testing it");
+        Assertions.assertTrue(unbounded.isEmpty(), "an MV refresh waited on the planner lock without a bound: "
+                + unbounded);
+    }
 }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/scheduler/mv/MVTimelinessMgrTest.java` (modified, +170/-19)
```diff
@@ -19,12 +19,15 @@
 import com.starrocks.catalog.MvUpdateInfo;
 import com.starrocks.catalog.TableProperty;
 import com.starrocks.catalog.mv.MVTimelinessArbiter;
+import com.starrocks.qe.ConnectContext;
+import com.starrocks.sql.common.StarRocksPlannerException;
 import mockit.Mock;
 import mockit.MockUp;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
 
+import java.time.Instant;
 import java.util.ArrayList;
 import java.util.List;
 import java.util.concurrent.CountDownLatch;
@@ -42,6 +45,7 @@ public class MVTimelinessMgrTest {
     private final AtomicInteger computeCount = new AtomicInteger();
     // What the timeliness check returns, given the number of the call (from 1).
     private Function<Integer, MvUpdateInfo> arbiter;
+    private volatile boolean inCatalog = true;
 
     private static MaterializedView forceMv() {
         MaterializedView mv = mock(MaterializedView.class);
@@ -59,6 +63,11 @@ public void setUp() {
             public boolean isEnableMVTimelinessGlobalCache(MaterializedView ignored) {
                 return true;
             }
+
+            @Mock
+            public boolean isInCatalog(MaterializedView ignored) {
+                return inCatalog;
+            }
         };
         new MockUp<MvRefreshArbiter>() {
             @Mock
@@ -155,7 +164,7 @@ public void testComputesOnceForConcurrentLookups() throws Exception {
         waiting.start();
         // Let the second lookup reach the in-flight computation: it either waits on it or starts its own.
         long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
-        while (waiting.getState() != Thread.State.WAITING && computeCount.get() < 2 && System.nanoTime() < deadline) {
+        while (waiting.getState() != Thread.State.TIMED_WAITING && computeCount.get() < 2 && System.nanoTime() < deadline) {
             Thread.sleep(10);
         }
         release.countDown();
@@ -209,11 +218,8 @@ public void testRefreshOnAnotherThreadWhileACheckIsComputed() throws Exception {
         Assertions.assertEquals(2, computeCount.get());
     }
 
-    @Test
-    public void testWaitersOfAFailedCheckRetryItOnce() throws Exception {
-        // A metadata race fails the check while other queries wait on it: one of them computes it again for all,
-        // and that result is cached, rather than each waiter computing it for itself.
-        CountDownLatch started = new CountDownLatch(1);
+    // Blocks the first check until the returned latch is released; later checks return NO_REFRESH.
+    private CountDownLatch blockFirstCheck(CountDownLatch started, Function<Integer, MvUpdateInfo> firstResult) {
         CountDownLatch release = new CountDownLatch(1);
         arbiter = call -> {
             if (call == 1) {
@@ -223,10 +229,29 @@ public void testWaitersOfAFailedCheckRetryItOnce() throws Exception {
                 } catch (InterruptedException e) {
                     throw new RuntimeException(e);
                 }
-                throw new IllegalStateException("partition dropped mid-check");
+                return firstResult.apply(call);
             }
             return MvUpdateInfo.noRefresh(mv);
         };
+        return release;
+    }
+
+    private static void awaitWaiting(List<Thread> waiters) throws InterruptedException {
+        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
+        while (waiters.stream().anyMatch(t -> t.getState() != Thread.State.TIMED_WAITING) &&
+                System.nanoTime() < deadline) {
+            Thread.sleep(10);
+        }
+    }
+
+    @Test
+    public void testWaitersOfAFailedCheckGetItsFailure() throws Exception {
+        // Retrying in each waiter would compute the check once per waiter in turn while it keeps failing. The
+        // failure is not cached: the next lookup computes it again.
+        CountDownLatch started = new CountDownLatch(1);
+        CountDownLatch release = blockFirstCheck(started, call -> {
+            throw new IllegalStateException("partition dropped mid-check");
+        });
         AtomicReference<Throwable> failure = new AtomicReference<>();
         Thread failing = new Thread(() -> {
             try {
@@ -239,31 +264,157 @@ public void testWaitersOfAFailedCheckRetryItOnce() throws Exception {
         Assertions.assertTrue(started.await(10, TimeUnit.SECONDS));
 
         int waiterCount = 3;
-        List<AtomicReference<MvUpdateInfo>> results = new ArrayList<>();
+        List<AtomicReference<Throwable>> waiterFailures = new ArrayList<>();
         List<Thread> waiters = new ArrayList<>();
         for (int i = 0; i < waiterCount; i++) {
-            AtomicReference<MvUpdateInfo> result = new AtomicReference<>();
-            results.add(result);
-            Thread waiter = new Thread(() -> result.set(lookup()));
+            AtomicReference<Throwable> waiterFailure = new AtomicReference<>();
+            waiterFailures.add(waite
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/StatementPlannerTest.java` (modified, +2/-2)
```diff
@@ -572,7 +572,7 @@ public void testPlanExceptionWithoutSchemaChange() throws Exception {
             assertEquals("Test exception during ExecPlanBuild", thrownException.getMessage());
 
             // Verify that OptimisticVersion.validateTableUpdate was called in the catch block
-            Set<OlapTable> olapTables = StatementPlanner.collectOriginalOlapTables(connectContext, queryStmt);
+            Set<OlapTable> olapTables = StatementPlanner.collectOriginalOlapTables(connectContext, queryStmt, plannerMetaLocker);
             if (!olapTables.isEmpty()) {
                 mockedOptimisticVersion.verify(() -> OptimisticVersion.validateTableUpdate(
                         any(OlapTable.class), eq(planStartTime)), times(olapTables.size()));
@@ -591,7 +591,7 @@ public void testPlanExceptionWithSchemaChange() throws Exception {
         PlannerMetaLocker plannerMetaLocker = new PlannerMetaLocker(connectContext, queryStmt);
 
         // Collect olap tables before mocking
-        Set<OlapTable> olapTables = StatementPlanner.collectOriginalOlapTables(connectContext, queryStmt);
+        Set<OlapTable> olapTables = StatementPlanner.collectOriginalOlapTables(connectContext, queryStmt, plannerMetaLocker);
         int tableCount = olapTables.size();
         try (MockedStatic<PlanFragmentBuilder> mockedPlanFragmentBuilder = mockStatic(PlanFragmentBuilder.class);
                 MockedStatic<com.starrocks.sql.OptimisticVersion> mockedOptimisticVersion =
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/WholePhaseLockPolicyTest.java` (modified, +57/-0)
```diff
@@ -15,6 +15,7 @@
 package com.starrocks.sql;
 
 import com.starrocks.catalog.Column;
+import com.starrocks.catalog.OlapTable;
 import com.starrocks.catalog.Table;
 import com.starrocks.catalog.TableName;
 import com.starrocks.common.util.UUIDUtil;
@@ -45,6 +46,7 @@
 import java.util.List;
 import java.util.Map;
 import java.util.Set;
+import java.util.concurrent.ConcurrentHashMap;
 import java.util.concurrent.CopyOnWriteArrayList;
 import java.util.concurrent.CopyOnWriteArraySet;
 
@@ -168,4 +170,59 @@ public void testRowAccessPolicyTableBehindAViewIsLocked() throws Exception {
     public void testRowAccessPolicyTableIsLockedForALocalInsert() throws Exception {
         assertPolicyTablePlannedUnderTheLock("INSERT INTO test.t0 SELECT k1, v1, v1 FROM " + GUARDED);
     }
+
+    /**
+     * Off the copies, the statement is walked again under the lock once analyzed, for what analysis brought in. The
+     * policies it applied are in it by then, so the walk reaches the mapping table without asking the access
+     * controller again -- which, through Ranger, costs a lookup per column of every table.
+     */
+    @Test
+    public void testPoliciesAreLookedUpOnlyBeforeAnalysisAndByTheAnalyzer() throws Exception {
+        Thread planner = Thread.currentThread();
+        Map<String, Integer> lookups = new ConcurrentHashMap<>();
+        new MockUp<Authorizer>() {
+            @Mock
+            public Expr getRowAccessPolicy(Invocation invocation, ConnectContext session, TableName name) {
+                if (Thread.currentThread() == planner) {
+                    lookups.merge("row:" + name.getTbl(), 1, Integer::sum);
+                }
+                return invocation.proceed(session, name);
+            }
+
+            @Mock
+            public Map<String, Expr> getColumnMaskingPolicy(Invocation invocation, ConnectContext session,
+                                                            TableName name, List<Column> columns) {
+                if (Thread.currentThread() == planner) {
+                    lookups.merge("mask:" + name.getTbl(), 1, Integer::sum);
+                }
+                return invocation.proceed(session, name, columns);
+            }
+        };
+        Set<String> copied = new CopyOnWriteArraySet<>();
+        List<String> copiedWithoutLock = new CopyOnWriteArrayList<>();
+        LockManager lockManager = GlobalStateMgr.getCurrentState().getLockManager();
+        new MockUp<OlapTable>() {
+            @Mock
+            public void copyOnlyForQuery(Invocation invocation, OlapTable copy) {
+                OlapTable source = invocation.getInvokedInstance();
+                if (Thread.currentThread() == planner) {
+                    copied.add(source.getName());
+                    if (!lockManager.isOwnedByCurrentThread(source.getId(), LockType.READ)) {
+                        copiedWithoutLock.add(source.getName());
+                    }
+                }
+                invocation.proceed(copy);
+            }
+        };
+        connectContext.getSessionVariable().setCboUseDBLock(false);
+        planWithPolicies("SELECT * FROM " + VIEW + " v JOIN test.t0 ON v.k1 = t0.v1");
+
+        Assertions.assertTrue(copied.containsAll(Set.of("t_map", "t_policy_lock", "t0")),
+                "planning did not run off copies, so this is not testing it: " + copied);
+        Assertions.assertTrue(copiedWithoutLock.isEmpty(), "copied without its read lock: " + copiedWithoutLock);
+        for (String key : List.of("row:t_policy_lock", "mask:t_policy_lock", "row:t0", "mask:t0")) {
+            Assertions.assertEquals(2, lookups.getOrDefault(key, 0),
+                    "once for the lock set, once by the analyzer: " + key + " in " + lookups);
+        }
+    }
 }
```

---

### Incident Patch 2: `64fa18bf` (2026-10-18)
**Commit Message**: [UT] Fix flaky OnlineOptimizeJobV2Test by stopping the background schema change scheduler (#80980)

Signed-off-by: trueeyu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/OnlineOptimizeJobV2Test.java` (modified, +10/-1)
```diff
@@ -68,6 +68,14 @@ public class OnlineOptimizeJobV2Test extends DDLTestBase {
     @BeforeAll
     public static void beforeAll() {
         DDLTestBase.beforeAll();
+        // The cases drive optimize jobs by hand. A running scheduler can pick a job up between process() and
+        // spyPreviousTxnFinished() and run its pending step on the original, which shares tmpPartitionIds with
+        // the spy, so its failure cancels the job and drops the spy's temp partitions.
+        try {
+            UtFrameUtils.stopBackgroundSchemaChangeHandler(60000);
+        } catch (Exception e) {
+            throw new RuntimeException(e);
+        }
         UtFrameUtils.setUpForPersistTest();
     }
 
@@ -465,7 +473,8 @@ public void testCommittedNotVisibleDefersReplacementWithoutRerunningRewrite() th
     }
 
     private OnlineOptimizeJobV2 spyPreviousTxnFinished(OnlineOptimizeJobV2 job) throws AnalysisException {
-        // Detach the job from schema change handler to prevent background scheduler from changing state
+        // The test drives the spy from here on, so the handler must not hold the original. Detaching alone does
+        // not keep the scheduler away from it, which is why beforeAll() stops the scheduler.
         SchemaChangeHandler schemaChangeHandler = GlobalStateMgr.getCurrentState().getSchemaChangeHandler();
         schemaChangeHandler.getAlterJobsV2().remove(job.getJobId());
 
```

---

### Incident Patch 3: `90503a6a` (2026-10-19)
**Commit Message**: [BugFix] Throw std::bad_alloc when an aligned allocation fails (#79054)

Signed-off-by: Youngwb <[REDACTED_EMAIL]>
Co-authored-by: Youngwb <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `be/src/base/container/raw_container.h` (modified, +6/-1)
```diff
@@ -15,6 +15,7 @@
 #pragma once
 
 #include <memory>
+#include <new>
 #include <string>
 #include <type_traits>
 #include <utility>
@@ -102,7 +103,11 @@ class AlignmentAllocator {
 
     pointer allocate(size_type n) {
         size_t size = (n * sizeof(value_type) < N) ? N : (n * sizeof(value_type));
-        return (pointer)BitUtil::safe_aligned_alloc(N, size);
+        auto* ptr = (pointer)BitUtil::safe_aligned_alloc(N, size);
+        // A null return is adopted as valid storage by the container; only std::bad_alloc
+        // reaches TRY_CATCH_ALLOC_SCOPE, which callers rely on for memory-limit errors.
+        if (UNLIKELY(ptr == nullptr)) throw std::bad_alloc();
+        return ptr;
     }
 
     void deallocate(pointer p, size_type) { free(p); }
```

**File**: `be/test/base/raw_container_test.cpp` (modified, +38/-0)
```diff
@@ -16,6 +16,8 @@
 
 #include <gtest/gtest.h>
 
+#include <new>
+
 #include "common/memory/column_allocator.h"
 
 namespace starrocks {
@@ -74,4 +76,40 @@ TEST(TestRawContainer, rawStringPageIsPageAligned) {
         EXPECT_EQ(0u, reinterpret_cast<uintptr_t>(s.data()) % kPageSize) << "unaligned for payload " << payload;
     }
 }
+
+// Both tests force a real aligned_alloc failure. The mem_alloc_error fail point cannot serve --
+// mem_hook's tracker-refusal branch is compiled out under BE_TEST -- and the ASAN/LSAN/TSAN
+// allocators abort with allocation-size-too-big instead of returning null, since run-be-ut.sh never
+// sets allocator_may_return_null. CI runs BE UT in the Release configuration, where both tests
+// execute.
+[[maybe_unused]] static constexpr size_t kUnsatisfiableSize = size_t{1} << 60; // 1 EiB, past the address space
+
+TEST(TestRawContainer, alignmentAllocatorThrowsWhenAllocationFails) {
+#if defined(ADDRESS_SANITIZER) || defined(LEAK_SANITIZER) || defined(THREAD_SANITIZER)
+    GTEST_SKIP() << "Sanitizer allocators abort on a refused aligned_alloc instead of returning null";
+#else
+    raw::AlignmentAllocator<char, 4096> allocator;
+    // Storing through a volatile keeps the compiler from eliding the allocation call outright,
+    // which would leave nothing for EXPECT_THROW to observe.
+    char* volatile allocated = nullptr;
+    EXPECT_THROW(allocated = allocator.allocate(kUnsatisfiableSize), std::bad_alloc);
+    EXPECT_EQ(nullptr, allocated);
+#endif
+}
+
+TEST(TestRawContainer, rawStringPageResizeThrowsInsteadOfAdoptingNullBuffer) {
+#if defined(ADDRESS_SANITIZER) || defined(LEAK_SANITIZER) || defined(THREAD_SANITIZER)
+    GTEST_SKIP() << "Sanitizer allocators abort on a refused aligned_alloc instead of returning null";
+#else
+    raw::RawStringPage s;
+    EXPECT_THROW(s.resize(kUnsatisfiableSize), std::bad_alloc);
+    EXPECT_TRUE(s.empty());
+
+    // A buffer that failed to grow must stay usable for the next chunk.
+    s.resize(8192);
+    EXPECT_EQ(8192u, s.size());
+    EXPECT_NE(nullptr, s.data());
+#endif
+}
+
 } // namespace starrocks
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #81016** (closed): [BugFix] Shrink list partition values in archived MV task run history (backport #80944) (@mergify[bot])
- **PR #81009** (closed): [BugFix] Reject a complex-typed row identity key for an incremental MV (backport #79312) (@mergify[bot])
- **PR #81007** (closed): [BugFix] Throw std::bad_alloc when an aligned allocation fails (backport #79054) (@mergify[bot])
- **PR #81006** (2026-10-19): [UT] Mock runAfterCatalogReady to pause the rollup scheduler in BatchRollupJobTest (backport #80807) (backport #81001) (@mergify[bot])
- **PR #81003** (2026-10-19): [Enhancement] Add canonical POINT fast path for GEOMETRY constructor and ST_X/ST_Y (@ViktorGo86)
- **PR #81001** (2026-10-19): [UT] Mock runAfterCatalogReady to pause the rollup scheduler in BatchRollupJobTest (backport #80807) (@trueeyu)

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

## X. [BugFix] Drop repeated policy lookups and unbounded waits left by the planner lo

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/MVTimelinessMgr.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ecb0be33`: [BugFix] Drop repeated policy lookups and unbounded waits left by the planner lock fixes (#80943). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/MVTimelinessMgr.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import com.google.common.base.Throwables;
import com.starrocks.common.profile.Tracers;
import com.starrocks.qe.ConnectContext;
import com.starrocks.server.GlobalStateMgr;
import com.starrocks.sql.common.ErrorType;
import com.starrocks.sql.common.StarRocksPlannerException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
    private static final Logger LOG = LogManager.getLogger(MVTimelinessMgr.class);
    private static final long AWAIT_SLICE_MS = 100;
    private static final Duration AWAIT_SLICE = Duration.ofMillis(AWAIT_SLICE_MS);

        CompletableFuture<MvUpdateInfo> existing = mvTimelinessMap.putIfAbsent(mv, mine);
        if (existing != null) {
            return awaitInFlight(mv, existing);
        // DROP removes the MV from the catalog before it evicts this entry. A future put after that eviction would
        // otherwise stay forever, holding the MV and its MvUpdateInfo.
        if (!isInCatalog(mv)) {
            mvTimelinessMap.remove(mv, mine);
   
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletionException;
        while (true) {
            CompletableFuture<MvUpdateInfo> existing = mvTimelinessMap.putIfAbsent(mv, mine);
            if (existing == null) {
                break;
            }
            try {
                return existing.join();
            } catch (CompletionException | CancellationException e) {
                // The lookup computing it failed and removed its future before failing it. Try again to put one, so
                // that one of the waiters computes for all of them and its result is cached.
            }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ecb0be33` are properly handled with clean fallback behavior.
