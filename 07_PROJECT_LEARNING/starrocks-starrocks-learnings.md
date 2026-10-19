> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source**: github ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Source Version**: `8647602b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T16:18:24.157Z  
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
> **Harvest Timestamp**: 2026-10-19T16:18:24.151Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12188 stars

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

### Incident Patch 1: `c29f5294` (2026-10-19)
**Commit Message**: [BugFix] Fail an mv refresh on a non-ref base table lock timeout and keep inspect_mv_refresh_info off base table locks under a held lock (#81036)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/MvRefreshArbiter.java` (modified, +7/-5)
```diff
@@ -27,6 +27,7 @@
 import com.starrocks.common.util.DebugUtil;
 import com.starrocks.common.util.concurrent.lock.LockTimeoutException;
 import com.starrocks.connector.ConnectorPartitionTraits;
+import com.starrocks.sql.common.DmlException;
 import com.starrocks.sql.common.PCellSortedSet;
 import com.starrocks.sql.common.PCellUtils;
 import com.starrocks.sql.common.UnsupportedException;
@@ -143,12 +144,13 @@ private static Optional<Boolean> needsToRefreshTable(MaterializedView mv,
             Set<String> baseUpdatedPartitionNames;
             try {
                 baseUpdatedPartitionNames = MvUtils.readBaseTableUnderLock(mv, olapBaseTable,
-                        queryRewriteParams.isQueryRewrite(),
+                        queryRewriteParams.readsBaseTablesUnlocked(),
                         () -> mv.getUpdatedPartitionNamesOfOlapTable(olapBaseTable, queryRewriteParams.isQueryRewrite()));
             } catch (LockTimeoutException e) {
-                logMVPrepare(mv, "Failed to check updated partitions of base table {}: {}",
-                        olapBaseTable.getName(), e.getMessage());
-                return Optional.empty();
+                // Fail this refresh, as a lock timeout on a ref base table does: an empty result would read as
+                // "changed" and refresh every partition of the mv.
+                throw new DmlException("Failed to check updated partitions of base table %s of mv %s: %s", e,
+                        olapBaseTable.getName(), mv.getName(), e.getMessage());
             }
             if (!baseUpdatedPartitionNames.isEmpty()) {
                 return Optional.of(true);
@@ -200,7 +202,7 @@ public static MvBaseTableUpdateInfo getMvBaseTableUpdateInfo(MaterializedView mv
             PCellSortedSet updatedPCellSet;
             try {
                 updatedPCellSet = MvUtils.readBaseTableUnderLock(mv, olapBaseTable,
-                        queryRewriteParams.isQueryRewrite(), readUpdatedPartitions);
+                        queryRewriteParams.readsBaseTablesUnlocked(), readUpdatedPartitions);
             } catch (LockTimeoutException e) {
                 logMVPrepare(mv, "Failed to get updated partitions of base table {}: {}",
                         olapBaseTable.getName(), e.getMessage());
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/mv/MVTimelinessArbiter.java` (modified, +20/-0)
```diff
@@ -78,12 +78,19 @@ public abstract class MVTimelinessArbiter {
     // parameters for query rewrite
     public static class QueryRewriteParams {
         private final boolean isQueryRewrite;
+        // whether a refresh-mode check reads internal base tables under their READ lock, see readsBaseTablesUnlocked
+        private final boolean lockBaseTables;
         private final OptimizerContext optimizerContext;
         private final long timeLimit;
         private long loopCounter = 0;
 
         public QueryRewriteParams(boolean isQueryRewrite, OptimizerContext optimizerContext) {
+            this(isQueryRewrite, true, optimizerContext);
+        }
+
+        private QueryRewriteParams(boolean isQueryRewrite, boolean lockBaseTables, OptimizerContext optimizerContext) {
             this.isQueryRewrite = isQueryRewrite;
+            this.lockBaseTables = lockBaseTables;
             this.optimizerContext = optimizerContext;
             if (optimizerContext != null) {
                 SessionVariable sessionVariable = optimizerContext.getSessionVariable();
@@ -97,6 +104,14 @@ public static QueryRewriteParams ofRefresh() {
             return new QueryRewriteParams(false, null);
         }
 
+        /**
+         * A refresh-mode check that reads base tables without their locks, for a diagnostic constant-folded while
+         * a statement is planned: the planner may already hold other tables' locks there.
+         */
+        public static QueryRewriteParams ofUnlockedRefresh() {
+            return new QueryRewriteParams(false, false, null);
+        }
+
         public static QueryRewriteParams ofQueryRewrite(OptimizerContext optimizerContext) {
             return new QueryRewriteParams(true, optimizerContext);
         }
@@ -121,6 +136,11 @@ public boolean isQueryRewrite() {
             return isQueryRewrite;
         }
 
+        /** Whether internal base tables are read without their READ lock: query rewrite, or an unlocked refresh. */
+        public boolean readsBaseTablesUnlocked() {
+            return isQueryRewrite || !lockBaseTables;
+        }
+
         public OptimizerContext getOptimizerContext() {
             return optimizerContext;
         }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/scheduler/MVTaskRunProcessor.java` (modified, +11/-2)
```diff
@@ -18,6 +18,7 @@
 import com.google.common.base.Preconditions;
 import com.google.common.base.Stopwatch;
 import com.google.common.base.Strings;
+import com.google.common.base.Throwables;
 import com.google.common.collect.Lists;
 import com.google.common.util.concurrent.Uninterruptibles;
 import com.starrocks.catalog.Database;
@@ -332,8 +333,16 @@ private Constants.TaskRunState retryProcessTaskRun(TaskRunContext taskRunContext
                         lockFailedTimes, DebugUtil.getStackTrace(e));
                 lastException = e;
             } catch (Throwable e) {
-                refreshFailedTimes += 1;
-                logger.warn("refresh mv failed at {}th time: {}", refreshFailedTimes, e);
+                // A lock timeout raised where a checked exception cannot propagate arrives wrapped, e.g. from the
+                // non-ref base table check of change detection; it is still lock contention.
+                if (Throwables.getCausalChain(e).stream().anyMatch(t -> t instanceof LockTimeoutException)) {
+                    lockFailedTimes += 1;
+                    logger.warn("refresh mv failed at {}th time because try lock failed: {}",
+                            lockFailedTimes, DebugUtil.getStackTrace(e));
+                } else {
+                    refreshFailedTimes += 1;
+                    logger.warn("refresh mv failed at {}th time: {}", refreshFailedTimes, e);
+                }
                 lastException = e;
             }
 
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/common/ListPartitionDiffer.java` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ public Map<Table, BaseToMVPartitionMapping> syncBaseTablePartitionInfos() {
                 Table refBaseTable = e.getKey();
                 List<Column> refPartitionColumns = e.getValue();
                 // collect base table's partition cells by aligning with mv's partition column order
-                BaseToMVPartitionMapping mapping = MvUtils.readBaseTableUnderLock(mv, refBaseTable, isQueryRewrite(),
+                BaseToMVPartitionMapping mapping = MvUtils.readBaseTableUnderLock(mv, refBaseTable, readsBaseTablesUnlocked(),
                         () -> MVPartitionCellBuilder.getPartitionCells(refBaseTable, refPartitionColumns,
                                 pinnedRangeFor(refBaseTable)));
                 refBaseTablePartitionMap.put(refBaseTable, mapping);
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/common/PartitionDiffer.java` (modified, +4/-0)
```diff
@@ -52,6 +52,10 @@ protected boolean isQueryRewrite() {
         return queryRewriteParams != null && queryRewriteParams.isQueryRewrite();
     }
 
+    protected boolean readsBaseTablesUnlocked() {
+        return queryRewriteParams != null && queryRewriteParams.readsBaseTablesUnlocked();
+    }
+
     protected TvrVersionRange pinnedRangeFor(Table table) {
         return pinnedRangeByTableIdentifier.get(table.getUUID());
     }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/common/RangePartitionDiffer.java` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ public Map<Table, BaseToMVPartitionMapping> syncBaseTablePartitionInfos() {
                 List<Column> refBTPartitionColumns = entry.getValue();
                 Preconditions.checkArgument(refBTPartitionColumns.size() == 1);
                 // Collect the ref base table's partition range map.
-                BaseToMVPartitionMapping mapping = MvUtils.readBaseTableUnderLock(mv, refBT, isQueryRewrite(),
+                BaseToMVPartitionMapping mapping = MvUtils.readBaseTableUnderLock(mv, refBT, readsBaseTablesUnlocked(),
                         () -> MVPartitionCellBuilder.getPartitionKeyRange(refBT, refBTPartitionColumns.get(0),
                                 mvPartitionExprOpt.get(), pinnedRangeFor(refBT)));
                 if (mapping.cells() == null) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/function/MetaFunctions.java` (modified, +6/-3)
```diff
@@ -245,11 +245,14 @@ public static ConstantOperator inspectMVRefreshInfo(ConstantOperator mvName) {
 
     public static String inspectMVRefreshInfo(Database db, MaterializedView mv) {
         // Compute mvToRefreshPartitions before acquiring the lock to avoid holding the lock
-        // during potentially expensive remote IO (e.g. Iceberg PartitionsTable scan).
+        // during potentially expensive remote IO (e.g. Iceberg PartitionsTable scan). Like readUnderTableLock, a thread
+        // that already holds metadata locks reads the base tables without theirs: a read broken by a concurrent
+        // change leaves the set empty.
         Set<String> mvToRefreshPartitions;
         try {
-            MvUpdateInfo mvUpdateInfo = MvRefreshArbiter.getMVTimelinessUpdateInfo(
-                    mv, MVTimelinessArbiter.QueryRewriteParams.ofRefresh());
+            MvUpdateInfo mvUpdateInfo = MvRefreshArbiter.getMVTimelinessUpdateInfo(mv, LockHoldDepth.isUnderLock()
+                    ? MVTimelinessArbiter.QueryRewriteParams.ofUnlockedRefresh()
+                    : MVTimelinessArbiter.QueryRewriteParams.ofRefresh());
             if (mvUpdateInfo.getMVToRefreshType() == MvUpdateInfo.MvToRefreshType.FULL) {
                 // For a full refresh, getMVToRefreshPCells() is empty by design (no partition-level tracking).
                 // Use the MV's actual partition names so callers can see which partitions need refreshing.
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rule/transformation/materialization/MvUtils.java` (modified, +5/-5)
```diff
@@ -1563,17 +1563,17 @@ public interface BaseTableRead<T, E extends Exception> {
      * ConcurrentModificationException, or looks up a partition that was dropped after its name was listed. An
      * external base table, or one the mv does not name, is read as before: no FE lock protects it.
      * <p>
-     * A freshness check for query rewrite ({@code isQueryRewrite}) reads unlocked, as before: it runs while the
-     * planner may already hold other tables' locks, so taking a base table's lock there could wait out of order,
-     * and its staleness check may reach a connector.
+     * A freshness check for query rewrite, or for {@code inspect_mv_refresh_info} ({@code unlocked}), reads unlocked,
+     * as before: it runs while the planner may already hold other tables' locks, so taking a base table's lock
+     * there could wait out of order, and its staleness check may reach a connector.
      *
      * @throws LockTimeoutException if the lock is not acquired within {@code mv_refresh_try_lock_timeout_ms}
      */
     public static <T, E extends Exception> T readBaseTableUnderLock(MaterializedView mv, Table baseTable,
-                                                                    boolean isQueryRewrite,
+                                                                    boolean unlocked,
                                                                     BaseTableRead<T, E> read)
             throws E, LockTimeoutException {
-        Optional<BaseTableInfo> baseTableInfo = isQueryRewrite || !baseTable.isNativeTableOrMaterializedView()
+        Optional<BaseTableInfo> baseTableInfo = unlocked || !baseTable.isNativeTableOrMaterializedView()
                 ? Optional.empty()
                 : mv.getBaseTableInfos().stream()
                         .filter(info -> info.isInternalCatalog() && info.getTableId() == baseTable.getId())
```

---

### Incident Patch 2: `a97f53c5` (2026-10-19)
**Commit Message**: [BugFix] Keep the task of an MV a refresh inactivated scheduled, and fix two follow-ups of the planner lock and Hive INSERT changes (#81033)

Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/http/HttpConnectProcessor.java` (modified, +3/-0)
```diff
@@ -47,6 +47,7 @@
 import org.apache.logging.log4j.Logger;
 
 import java.io.IOException;
+import java.util.Optional;
 
 // inherit ConnectProcessor  to record the audit log and Query Detail
 public class HttpConnectProcessor extends ConnectProcessor {
@@ -138,6 +139,8 @@ public void processOnce() throws IOException {
         // only handle query，so no need to dispatch
         ctx.setCommand(MysqlCommand.COM_QUERY);
         ctx.setStartTime();
+        // Set by an INSERT that reads Hive for itself only, see InsertAnalyzer; this context outlives the statement.
+        ctx.setUseConnectorMetadataCache(Optional.empty());
         ctx.setResourceGroup(null);
         ctx.resetErrorCode();
         this.handleQuery();
```

**File**: `fe/fe-core/src/main/java/com/starrocks/service/arrow/flight/sql/ArrowFlightSqlConnectProcessor.java` (modified, +3/-0)
```diff
@@ -47,6 +47,7 @@
 
 import java.io.IOException;
 import java.util.List;
+import java.util.Optional;
 import java.util.concurrent.CompletableFuture;
 import java.util.concurrent.ExecutionException;
 
@@ -148,6 +149,8 @@ public void processOnce() {
         // Only handle query，so no need to dispatch
         ctx.setCommand(MysqlCommand.COM_QUERY);
         ctx.setStartTime();
+        // Set by an INSERT that reads Hive for itself only, see InsertAnalyzer; this context outlives the statement.
+        ctx.setUseConnectorMetadataCache(Optional.empty());
         ctx.setResourceGroup(null);
         ctx.resetErrorCode();
 
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/StatementPlanner.java` (modified, +22/-0)
```diff
@@ -23,6 +23,7 @@
 import com.starrocks.catalog.Database;
 import com.starrocks.catalog.ExternalOlapTable;
 import com.starrocks.catalog.OlapTable;
+import com.starrocks.catalog.Partition;
 import com.starrocks.catalog.ResourceGroupClassifier;
 import com.starrocks.catalog.Table;
 import com.starrocks.catalog.TableName;
@@ -476,10 +477,31 @@ public static Set<OlapTable> copyOlapTablesAndUnlock(StatementBase stmt, Connect
                         + "was being planned, please retry", ErrorType.INTERNAL_ERROR);
             }
             AnalyzerUtils.copyOlapTable(stmt, copies);
+            resetAllTargetPartitionIds(stmt);
         }
         return copies;
     }
 
+    /**
+     * An INSERT into every partition of an olap table took their ids at analysis, under the lock {@link
+     * #copyOlapTablesAndUnlock} dropped before taking the whole set again. A partition dropped or replaced in between
+     * would fail the sink with an unknown partition, so take them again, under the lock now held. Partitions the
+     * statement names are left alone: one gone since is an error.
+     */
+    private static void resetAllTargetPartitionIds(StatementBase stmt) {
+        if (!(stmt instanceof InsertStmt insertStmt) || !(insertStmt.getTargetTable() instanceof OlapTable target)
+                || insertStmt.isSpecifyPartitionNames() || insertStmt.isStaticKeyPartitionInsert()
+                || insertStmt.isDynamicOverwrite()) {
+            return;
+        }
+        List<Long> targetPartitionIds = target.getPartitions().stream().map(Partition::getId).toList();
+        if (targetPartitionIds.isEmpty()) {
+            throw new SemanticException("data cannot be inserted into table with empty partition." +
+                    "Use `SHOW PARTITIONS FROM %s` to see the currently partitions of this table. ", target.getName());
+        }
+        insertStmt.setTargetPartitionIds(Lists.newArrayList(targetPartitionIds));
+    }
+
     /** The table a writing statement writes into, or null for anything else. */
     private static Table writeTargetOf(StatementBase stmt) {
         if (stmt instanceof InsertStmt insertStmt) {
```

**File**: `fe/fe-core/src/test/java/com/starrocks/qe/ConnectorMetadataCacheResetTest.java` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
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
+package com.starrocks.qe;
+
+import com.starrocks.http.HttpConnectContext;
+import com.starrocks.http.HttpConnectProcessor;
+import com.starrocks.service.arrow.flight.sql.ArrowFlightSqlConnectContext;
+import com.starrocks.service.arrow.flight.sql.ArrowFlightSqlConnectProcessor;
+import org.junit.jupiter.api.Assertions;
+import org.junit.jupiter.api.Test;
+
+import java.util.Optional;
+import java.util.concurrent.atomic.AtomicReference;
+
+/**
+ * An INSERT that reads Hive turns the connector metadata cache off for itself, on its connection's context
+ * (InsertAnalyzer). The MySQL protocol resets that for every command; the HTTP and Arrow Flight SQL contexts outlive a
+ * statement too -- the keep-alive connection, the session token -- so every later Hive query on them would skip the
+ * cache unless they reset it for each statement as well.
+ */
+public class ConnectorMetadataCacheResetTest {
+
+    @Test
+    public void testHttpStatementStartsWithTheCacheSetting() throws Exception {
+        HttpConnectContext ctx = new HttpConnectContext();
+        ctx.setUseConnectorMetadataCache(Optional.of(false));
+        AtomicReference<Optional<Boolean>> seen = new AtomicReference<>();
+        new HttpConnectProcessor(ctx) {
+            @Override
+            protected void handleQuery() {
+                seen.set(ctx.getUseConnectorMetadataCache());
+            }
+        }.processOnce();
+        Assertions.assertEquals(Optional.empty(), seen.get());
+    }
+
+    @Test
+    public void testArrowFlightSqlStatementStartsWithTheCacheSetting() {
+        ArrowFlightSqlConnectContext ctx = new ArrowFlightSqlConnectContext("token");
+        ctx.setUseConnectorMetadataCache(Optional.of(false));
+        AtomicReference<Optional<Boolean>> seen = new AtomicReference<>();
+        new ArrowFlightSqlConnectProcessor(ctx, "SELECT 1") {
+            @Override
+            protected void handleQuery() {
+                seen.set(ctx.getUseConnectorMetadataCache());
+            }
+        }.processOnce();
+        Assertions.assertEquals(Optional.empty(), seen.get());
+    }
+}
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/PlanningSnapshotViewLockTest.java` (modified, +66/-2)
```diff
@@ -23,6 +23,7 @@
 import com.starrocks.sql.analyzer.PlannerMetaLocker;
 import com.starrocks.sql.ast.StatementBase;
 import com.starrocks.sql.plan.ConnectorPlanTestBase;
+import com.starrocks.utframe.StarRocksAssert;
 import com.starrocks.utframe.UtFrameUtils;
 import mockit.Invocation;
 import mockit.Mock;
@@ -38,6 +39,7 @@
 import java.util.concurrent.CopyOnWriteArrayList;
 import java.util.concurrent.CopyOnWriteArraySet;
 import java.util.concurrent.atomic.AtomicInteger;
+import java.util.concurrent.atomic.AtomicReference;
 
 /**
  * Planning off private copies takes the copies in StatementPlanner while the meta lock is still held, which is
@@ -89,9 +91,13 @@ public void copyOnlyForQuery(Invocation invocation, OlapTable copy) {
     }
 
     private void assertEveryCopyWasLocked(String sql) throws Exception {
+        assertEveryCopyWasLockedOf(sql, "t0");
+    }
+
+    private void assertEveryCopyWasLockedOf(String sql, String table) throws Exception {
         getExecPlan(sql);
-        Assertions.assertTrue(copied.contains("t0"),
-                "planning did not copy the view's base table, so this is not testing the snapshot path: " + sql);
+        Assertions.assertTrue(copied.contains(table),
+                "planning did not copy " + table + ", so this is not testing the snapshot path: " + sql);
         Assertions.assertTrue(copiedWithoutLock.isEmpty(),
                 "copied without holding its read lock: " + copiedWithoutLock + ", for: " + sql);
         assertNothingLeftLocked(sql);
@@ -228,6 +234,64 @@ public PlannerMetaLocker forAllTablesOf(Invocation invocation, ConnectContext se
         assertNothingLeftLocked("SELECT * FROM " + VIEW);
     }
 
+    /**
+     * An INSERT into every partition of its target gets the partition ids at analysis, from the live table, with the
+     * first lock held. Taking the whole set again leaves a window with nothing held, where a partition of the target
+     * can be dropped: the ids then have to come from the copy, or the sink fails with an unknown partition.
+     */
+    @Test
+    public void testATargetPartitionDroppedWhileNothingWasHeld() throws Exception {
+        starRocksAssert.withTable("CREATE TABLE test.t_relock_target (k1 int, v1 int) DUPLICATE KEY(k1) "
+                + "PARTITION BY RANGE(k1) (PARTITION p1 VALUES LESS THAN ('10'), PARTITION p2 VALUES LESS THAN ('20')) "
+                + "DISTRIBUTED BY HASH(k1) BUCKETS 1 PROPERTIES('replication_num' = '1')");
+        try {
+            AtomicInteger resolutions = new AtomicInteger();
+            new MockUp<PlannerMetaLocker>() {
+                @Mock
+                public PlannerMetaLocker forTablesNotLockedOf(Invocation invocation, ConnectContext session,
+                                                              StatementBase analyzedStatement) {
+                    PlannerMetaLocker locker = invocation.getInvokedInstance();
+                    return locker.forAllTablesOf(session, analyzedStatement);
+                }
+
+                // 1: what forces the re-lock, 2: the set it locks, resolved with nothing held
+                @Mock
+                public PlannerMetaLocker forAllTablesOf(Invocation invocation, ConnectContext session,
+                                                        StatementBase analyzedStatement) {
+                    if (resolutions.incrementAndGet() == 2) {
+                        dropPartitionElsewhere("ALTER TABLE test.t_relock_target DROP PARTITION p2 FORCE");
+                    }
+                    return invocation.proceed(session, analyzedStatement);
+                }
+            };
+            String sql = "INSERT INTO test.t_relock_target SELECT l_orderkey, l_partkey FROM " + CONNECTOR_TABLE;
+            assertEveryCopyWasLockedOf(sql, "t_relock_target");
+            Assertions.assertTrue(resolutions.get() >= 2, "did not take the whole set again");
+        } finally {
+            starRocksAssert.dropTable("test.t_relock_target");
+        }
+    }
+
+    private static void dropPartitionElsewhere(String sql) {
+        AtomicReference<Throwable> failure = new AtomicReference<>();
+        Thread thread = new Thread(() -> {
+            ConnectContext ctx = UtFrameUtils.createDefaultCtx();
+            ctx.setThreadLocalInfo();
+            try {
+                new StarRocksAssert(ctx).alterTable(sql);
+            } catch (Throwable t) {
+                failure.set(t);
+            }
+        });
+        thread.start();
+        try {
+            thread.join();
+        } catch (InterruptedException e) {
+            throw new RuntimeException(e);
+        }
+        Assertions.assertNull(failure.get(), String.valueOf(failure.get()));
+    }
+
     /** A view does not take the whole set again: the lock taken before analysis already covers its base tables. */
     @Test
     public void testNoReLockForAView() throws Exception {
```

---

### Incident Patch 3: `c13d26da` (2026-10-19)
**Commit Message**: [BugFix] Fix three small pre-existing FE metadata concurrency issues (#81037)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/MaterializedView.java` (modified, +1/-1)
```diff
@@ -1785,7 +1785,7 @@ public synchronized StatusSnapshot getStatusSnapshot() {
         return new StatusSnapshot(active, statusEpoch);
     }
 
-    private boolean isInCatalog() {
+    public boolean isInCatalog() {
         Database db = GlobalStateMgr.getCurrentState().getLocalMetastore().getDb(dbId);
         return db != null && db.getTable(id) == this;
     }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/planner/AbstractOlapTableScanNode.java` (modified, +10/-1)
```diff
@@ -19,6 +19,7 @@
 import com.starrocks.catalog.MaterializedIndex;
 import com.starrocks.catalog.MaterializedIndexMeta;
 import com.starrocks.catalog.OlapTable;
+import com.starrocks.catalog.Partition;
 import com.starrocks.catalog.PhysicalPartition;
 import com.starrocks.catalog.SchemaInfo;
 import com.starrocks.sql.common.MetaUtils;
@@ -129,7 +130,15 @@ protected static int computeBucketNums(
         int bucketNum = distInfo.getBucketNum();
         if (selectedLogicalPartitionIds.size() <= 1) {
             for (Long pid : selectedLogicalPartitionIds) {
-                bucketNum = olapTable.getPartition(pid).getDistributionInfo().getBucketNum();
+                // Scheduling runs after planning released the table lock, so a TTL or dynamic-partition
+                // drop can remove the selected partition in between.
+                Partition partition = olapTable.getPartition(pid);
+                if (partition == null) {
+                    throw new IllegalStateException(String.format(
+                            "partition %d of table %s was dropped after the query was planned, please retry",
+                            pid, olapTable.getName()));
+                }
+                bucketNum = partition.getDistributionInfo().getBucketNum();
             }
         }
         return bucketNum;
```

**File**: `fe/fe-core/src/main/java/com/starrocks/scheduler/mv/MVVersionManager.java` (modified, +6/-0)
```diff
@@ -158,6 +158,12 @@ public void confirmFreshness() {
             return;
         }
         try {
+            // A DROP that ran before the lock was taken leaves nothing to confirm; logging for it would only
+            // journal an entry no follower can apply.
+            if (!mv.isInCatalog()) {
+                logger.info("skip freshness confirm, mv {} is no longer in the catalog", mv.getName());
+                return;
+            }
             MaterializedView.MvRefreshScheme copiedScheme = mv.getRefreshScheme().copy();
             if (copiedScheme.getLastFreshnessConfirmedAt() >= confirmTime) {
                 return;
```

**File**: `fe/fe-core/src/main/java/com/starrocks/service/FrontendServiceImpl.java` (modified, +20/-20)
```diff
@@ -2246,25 +2246,26 @@ public synchronized TImmutablePartitionResult updateImmutablePartitionInternal(T
 
         // immute partitions and create new sub partitions
         for (Long id : request.partition_ids) {
-            PhysicalPartition p = table.getPhysicalPartition(id);
-            if (p == null) {
-                LOG.warn("physical partition id {} does not exist", id);
-                continue;
-            }
-            Partition partition = olapTable.getPartition(p.getParentId());
-            if (partition == null) {
-                LOG.warn("partition id {} does not exist", p.getParentId());
-                continue;
-            }
-            updatePartitionIds.add(p.getParentId());
-            p.setImmutable(true);
-
+            Partition partition;
             List<PhysicalPartition> mutablePartitions;
-            // Reads sub-partitions of one known table; intensive table READ
+            // Reads the partition maps and sub-partitions of one known table; intensive table READ
             // (IS-on-db + READ-on-table) is enough. Acquire before try so a
             // failed acquire does not trigger an unlock of an unheld lock.
             locker.lockTableWithIntensiveDbLock(db.getId(), tableId, LockType.READ);
             try {
+                PhysicalPartition p = table.getPhysicalPartition(id);
+                if (p == null) {
+                    LOG.warn("physical partition id {} does not exist", id);
+                    continue;
+                }
+                partition = olapTable.getPartition(p.getParentId());
+                if (partition == null) {
+                    LOG.warn("partition id {} does not exist", p.getParentId());
+                    continue;
+                }
+                updatePartitionIds.add(p.getParentId());
+                p.setImmutable(true);
+
                 mutablePartitions = partition.getSubPartitions().stream()
                         .filter(physicalPartition -> !physicalPartition.isImmutable())
                         .collect(Collectors.toList());
@@ -2286,15 +2287,14 @@ public synchronized TImmutablePartitionResult updateImmutablePartitionInternal(T
 
         // return all mutable partitions
         for (Long id : updatePartitionIds) {
-            Partition partition = olapTable.getPartition(id);
-            if (partition == null) {
-                LOG.warn("partition id {} does not exist", id);
-                continue;
-            }
-
             long mutablePartitionNum = 0;
             locker.lockTableWithIntensiveDbLock(db.getId(), tableId, LockType.READ);
             try {
+                Partition partition = olapTable.getPartition(id);
+                if (partition == null) {
+                    LOG.warn("partition id {} does not exist", id);
+                    continue;
+                }
                 for (PhysicalPartition physicalPartition : partition.getSubPartitions()) {
                     if (physicalPartition.isImmutable()) {
                         continue;
```

**File**: `fe/fe-core/src/test/java/com/starrocks/planner/OlapScanNodeTest.java` (modified, +11/-0)
```diff
@@ -155,4 +155,15 @@ public void testPreparedPhysicalSplitScanToThriftDefaultUnset() {
         Assertions.assertNotNull(msg.lake_scan_node);
         Assertions.assertFalse(msg.lake_scan_node.isSetUse_prepared_physical_split_scan());
     }
+
+    @Test
+    public void testBucketNumsOfAPartitionDroppedAfterPlanning() {
+        // Planning selected one partition; a TTL or dynamic-partition drop removed it before scheduling
+        // asked for the bucket count.
+        OlapScanNode scanNode = createOlapScanNode(Table.TableType.OLAP);
+        scanNode.setSelectedPartitionIds(Collections.singletonList(PHYSICAL_PARTITION_ID));
+
+        IllegalStateException e = Assertions.assertThrows(IllegalStateException.class, scanNode::getBucketNums);
+        Assertions.assertTrue(e.getMessage().contains("dropped after the query was planned"), e.getMessage());
+    }
 }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/scheduler/mv/MVVersionManagerTest.java` (modified, +21/-0)
```diff
@@ -58,10 +58,19 @@
 public class MVVersionManagerTest {
 
     private final AtomicInteger editLogCount = new AtomicInteger();
+    // The test MVs live in no catalog; this stands in for whether a DROP has removed the MV.
+    private boolean mvInCatalog;
 
     @BeforeEach
     public void setUp() {
         editLogCount.set(0);
+        mvInCatalog = true;
+        new MockUp<MaterializedView>() {
+            @Mock
+            public boolean isInCatalog() {
+                return mvInCatalog;
+            }
+        };
         new MockUp<Locker>() {
             @Mock
             public boolean tryLockTableWithIntensiveDbLock(Long dbId, Long tableId, LockType lockType,
@@ -172,6 +181,18 @@ public void confirmFreshnessFallsBackOnMalformedBaseline() {
         Assertions.assertEquals(1, editLogCount.get());
     }
 
+    @Test
+    public void confirmFreshnessSkipsAnMvDroppedBeforeTheLock() {
+        MaterializedView mv = buildMv(1000L);
+        MVVersionManager manager = new MVVersionManager(mv, buildContext(null, statusWithProcessStartTime(2000L)));
+        mvInCatalog = false;
+
+        manager.confirmFreshness();
+
+        Assertions.assertEquals(1000L, mv.getRefreshScheme().getLastFreshnessConfirmedAt());
+        Assertions.assertEquals(0, editLogCount.get());
+    }
+
     @Test
     public void confirmFreshnessSkipsWhenLockTimedOut() {
         new MockUp<Locker>() {
```

**File**: `fe/fe-core/src/test/java/com/starrocks/service/FrontendServiceImplImmutablePartitionMultiNodeWriteTest.java` (modified, +51/-0)
```diff
@@ -21,6 +21,8 @@
 import com.starrocks.catalog.PhysicalPartition;
 import com.starrocks.common.Config;
 import com.starrocks.common.FeConstants;
+import com.starrocks.common.util.concurrent.lock.LockManager;
+import com.starrocks.common.util.concurrent.lock.LockType;
 import com.starrocks.lake.qe.scheduler.DefaultSharedDataWorkerProvider;
 import com.starrocks.planner.OlapTableSink;
 import com.starrocks.qe.ConnectContext;
@@ -39,13 +41,15 @@
 import com.starrocks.utframe.StarRocksAssert;
 import com.starrocks.utframe.UtFrameUtils;
 import com.starrocks.warehouse.cngroup.ComputeResource;
+import mockit.Invocation;
 import mockit.Mock;
 import mockit.MockUp;
 import mockit.Mocked;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 
+import java.util.ArrayList;
 import java.util.List;
 import java.util.Map;
 import java.util.concurrent.atomic.AtomicLong;
@@ -271,6 +275,53 @@ public boolean allowUsingBackupNode() {
         Assertions.assertEquals(1, hashTxn.getMultiNodeWriteWidth(hashTable.getId()));
     }
 
+    @Test
+    public void testPartitionLookupsHoldTheTableLock() throws Exception {
+        // The RPC runs while loads keep creating partitions, which rehash the table's plain HashMaps.
+        // Every lookup it makes into them must hold the table lock.
+        OlapTable table = table("t_random");
+        long txnId = TXN_ID.incrementAndGet();
+        mockNodes(newTxnState(txnId), 50001L, Lists.newArrayList(50001L));
+        long filled = onlyMutableSubPartition(table);
+
+        // One entry per lookup the RPC makes itself: whether the calling thread held the table lock.
+        List<Boolean> lockHeld = new ArrayList<>();
+        new MockUp<OlapTable>() {
+            @Mock
+            public PhysicalPartition getPhysicalPartition(Invocation inv, long physicalPartitionId) {
+                recordIfCalledByTheRpc(lockHeld, inv.getInvokedInstance());
+                return inv.proceed();
+            }
+
+            @Mock
+            public Partition getPartition(Invocation inv, long partitionId) {
+                recordIfCalledByTheRpc(lockHeld, inv.getInvokedInstance());
+                return inv.proceed();
+            }
+        };
+        updateImmutablePartition(table, txnId, filled);
+
+        Assertions.assertFalse(lockHeld.isEmpty());
+        Assertions.assertFalse(lockHeld.contains(false), lockHeld::toString);
+    }
+
+    private static void recordIfCalledByTheRpc(List<Boolean> lockHeld, Object table) {
+        // Lookups made by the metadata methods the RPC calls take their own locks and are not checked here.
+        boolean calledByTheRpc = StackWalker.getInstance().walk(frames -> frames
+                .filter(f -> f.getClassName().startsWith("com.starrocks.")
+                        && !f.getClassName().startsWith("com.starrocks.catalog.")
+                        && !f.getClassName().startsWith(FrontendServiceImplImmutablePartitionMultiNodeWriteTest.class.getName()))
+                .findFirst()
+                .map(f -> f.getMethodName().equals("updateImmutablePartitionInternal"))
+                .orElse(false));
+        if (calledByTheRpc) {
+            long tableId = ((OlapTable) table).getId();
+            LockManager lockManager = GlobalStateMgr.getCurrentState().getLockManager();
+            lockHeld.add(lockManager.isOwnedByCurrentThread(tableId, LockType.READ)
+                    || lockManager.isOwnedByCurrentThread(tableId, LockType.WRITE));
+        }
+    }
+
     private static TOlapTablePartitionParam partitionParam(OlapTable table) {
         TOlapTablePartitionParam partitionParam = new TOlapTablePartitionParam();
         partitionParam.setEnable_automatic_partition(false);
```

#### Recent Merged Pull Requests:
- **PR #81100** (closed): [Enhancement] Stream large flat JSON compaction output instead of buffering the segment (backport #80470) (@mergify[bot])
- **PR #81097** (2026-10-19): [BugFix] Fix ORC TINYINT min/max statistics on platforms with unsigned char (backport #81086) (@mergify[bot])
- **PR #81096** (closed): [BugFix] Mask credentials in task run definitions archived to task_run_history (backport #80447) (@mergify[bot])
- **PR #81094** (2026-10-19): [BugFix] Accept datacache mem writes into free space regardless of evict probability (backport #80542) (@mergify[bot])
- **PR #81093** (2026-10-19): [BugFix] Pin the dispatch version of lake fast-path index jobs against vacuum (@wanpengfei-git)
- **PR #81092** (2026-10-19): [BugFix] Keep scanning the MV in TRUE transparent mode when a base table is dropped (backport #81088) (@mergify[bot])

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

## X. [BugFix] Fail an mv refresh on a non-ref base table lock timeout and keep inspec

**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/catalog/MvRefreshArbiter.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c29f5294`: [BugFix] Fail an mv refresh on a non-ref base table lock timeout and keep inspect_mv_refresh_info off base table locks under a held lock (#81036). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/catalog/MvRefreshArbiter.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import com.starrocks.sql.common.DmlException;
                        queryRewriteParams.readsBaseTablesUnlocked(),
                // Fail this refresh, as a lock timeout on a ref base table does: an empty result would read as
                // "changed" and refresh every partition of the mv.
                throw new DmlException("Failed to check updated partitions of base table %s of mv %s: %s", e,
                        olapBaseTable.getName(), mv.getName(), e.getMessage());
                        queryRewriteParams.readsBaseTablesUnlocked(), readUpdatedPartitions);
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
                        queryRewriteParams.isQueryRewrite(),
                logMVPrepare(mv, "Failed to check updated partitions of base table {}: {}",
                        olapBaseTable.getName(), e.getMessage());
                return Optional.empty();
                        queryRewriteParams.isQueryRewrite(), readUpdatedPartitions);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c29f5294` are properly handled with clean fallback behavior.
