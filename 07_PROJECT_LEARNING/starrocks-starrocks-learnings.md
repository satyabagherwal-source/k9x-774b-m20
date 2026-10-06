# Forensic Learning Record (Deep Inspection): StarRocks/starrocks

> **Canonical Artifact**: `07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarRocks/starrocks](https://github.com/StarRocks/starrocks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:11:57.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarRocks/starrocks`
- **Description**: The world's fastest open query engine for sub-second analytics both on and off the data lakehouse. With the flexibility to support nearly any scenario, StarRocks provides best-in-class performance for multi-dimensional analytics, real-time analytics, and ad-hoc queries. A Linux Foundation project.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12155 stars

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

### Core Architecture Module: `be/src/base/concurrency/await.cpp`
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

#include "base/concurrency/await.h"

#include <bthread/bthread.h>

#include <chrono>

namespace starrocks {

static const int64_t kDefaultMinInterval = 10 * 1000; // 10ms

bool Awaitility::until(const condition_fun& cond) {
    if (_timeout <= 0) {
        return cond();
    }
    if (_interval == 0) {
        _interval = std::min(kDefaultMinInterval, _timeout);
    }
    auto start = std::chrono::steady_clock::now();
    int count = 0;
    while (!cond()) {
        if (_cb && count > 0) {
            _cb(count);
        }
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::microseconds>(now - start).count() >= _timeout) {
            return false;
        }
        bthread_usleep(_interval);
        ++count;
    }
    return true;
}

} // namespace starrocks

```

### Core Architecture Module: `be/src/base/concurrency/await.h`
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
#include <functional>
#include <utility>

namespace starrocks {

// Convenient function to archive wait-until ability
// Awaitility()
// .timeout(1000 * 1000) // one second
// .interval(1000)  // check every 1000 microseconds
// .until(() -> {}); // until the condition is true or timedout
class Awaitility {
public:
    typedef std::function<bool()> condition_fun;
    typedef std::function<void(int)> interval_callback_t;

public:
    explicit Awaitility() = default;

    // overall timeout
    Awaitility& timeout(int64_t timeout) {
        _timeout = timeout;
        return *this;
    }

    // check interval
    // if not provided, set to 10ms by default, or equal to the timeout value if _timeout < 10ms
    Awaitility& interval(int64_t interval) {
        _interval = interval;
        return *this;
    }

    // when the condition is false during the check, the cb will be called if provided.
    Awaitility& interval_callback(interval_callback_t cb) {
        _cb = std::move(cb);
        return *this;
    }

    // block until the cond is true or timed out.
    // return value:
    // * true: condition is true
    // * false: condition is still false, timed out
    bool until(const condition_fun& cond);

private:
    int64_t _timeout = 0;
    int64_t _interval = 0;
    condition_fun _cond;
    interval_callback_t _cb;
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

### Incident Patch 1: `dedeb209` (2026-10-06)
**Commit Message**: [BugFix] Fix native GEO compatibility and materialization boundaries (#80074)

Signed-off-by: Viktor Gnidenko <[REDACTED_EMAIL]>
Co-authored-by: mergify[bot] <37929162+mergify[bot]@users.noreply.github.com>

**File**: `be/src/column/geo_column.cpp` (modified, +24/-3)
```diff
@@ -74,10 +74,27 @@ GeoColumn::GeoColumn(const TypeDescriptor& type, size_t size)
     resize(size);
 }
 
-const GeoColumn& GeoColumn::_source(const Column& src) const {
-    // Column's copy API requires an identical physical type; do not introduce SQL type dispatch here.
+bool GeoColumn::_is_storage_placeholder() const {
+    return _descriptor.storage ==
+                   GeoStorageDescriptor{GEO_ENCODING_WKB, GEO_DIMENSION_UNKNOWN, GEO_VALIDATION_STATE_UNVALIDATED} &&
+           _data->get_immutable_bytes().empty();
+}
+
+const GeoColumn& GeoColumn::_source(const Column& src) {
     const auto& geo = down_cast<const GeoColumn&>(src);
-    if (_descriptor != geo._descriptor) throw std::invalid_argument("GeoColumn descriptor mismatch");
+    if (_descriptor != geo._descriptor) {
+        if (_descriptor.type != geo._descriptor.type) throw std::invalid_argument("GeoColumn descriptor mismatch");
+        // TypeDescriptor factories have semantic identity but no physical metadata yet.
+        // Empty WKB bytes are only NULL/default placeholders, so binding storage here does
+        // not relabel any existing geometry. Populated UNKNOWN/MIXED data is never upgraded.
+        if (_is_storage_placeholder()) {
+            _descriptor.storage = geo._descriptor.storage;
+        } else if (!geo._is_storage_placeholder()) {
+            throw std::invalid_argument("GeoColumn descriptor mismatch");
+        }
+        // Copying a source containing only default placeholders preserves the destination's
+        // physical descriptor (for example a materialized NULL after a non-NULL UNION row).
+    }
     return geo;
 }
 
@@ -129,6 +146,7 @@ void GeoColumn::remove_first_n_values(size_t count) {
 }
 
 void GeoColumn::append(const Column& src, size_t offset, size_t count) {
+    if (count == 0) return;
     if (&src == this) {
         auto copy = clone();
         append(*copy, offset, count);
@@ -140,6 +158,7 @@ void GeoColumn::append(const Column& src, size_t offset, size_t count) {
 }
 
 void GeoColumn::append_selective(const Column& src, const uint32_t* indexes, uint32_t from, uint32_t count) {
+    if (count == 0) return;
     if (&src == this) {
         auto copy = clone();
         append_selective(*copy, indexes, from, count);
@@ -151,6 +170,7 @@ void GeoColumn::append_selective(const Column& src, const uint32_t* indexes, uin
 }
 
 void GeoColumn::append_value_multiple_times(const Column& src, uint32_t index, uint32_t count) {
+    if (count == 0) return;
     if (&src == this) {
         auto copy = clone();
         append_value_multiple_times(*copy, index, count);
@@ -181,6 +201,7 @@ void GeoColumn::fill_default(const Filter& filter) {
 }
 
 void GeoColumn::update_rows(const Column& src, const uint32_t* indexes) {
+    if (src.size() == 0) return;
     if (&src == this) {
         auto copy = clone();
         update_rows(*copy, indexes);
```

**File**: `be/src/column/geo_column.h` (modified, +4/-2)
```diff
@@ -28,7 +28,8 @@ struct TypeDescriptor;
 
 // Standalone physical column; not a VARBINARY SQL type or a TypeDescriptor attachment.
 // Semantic metadata is immutable; transport restores storage metadata after validation.
-// Column-to-column copies require identical descriptors;
+// A typed materialization placeholder binds its storage metadata on the first payload copy.
+// Populated columns and concrete physical descriptors require identical storage metadata;
 // SQL assignment/coercion belongs to FE, not to these physical copy operations.
 // NULL is represented by NullableColumn. Empty bytes are only a default/null placeholder,
 // not an OGC EMPTY geometry. Payload ingestion preserves bytes without eager parsing.
@@ -123,7 +124,8 @@ class GeoColumn final : public CowFactory<Column, GeoColumn> {
                                                bool& has_null) override;
 
 private:
-    const GeoColumn& _source(const Column& src) const;
+    bool _is_storage_placeholder() const;
+    const GeoColumn& _source(const Column& src);
     struct CachedWkb {
         size_t row;
         GeoWkbInfo info;
```

**File**: `be/src/exprs/function_call_expr.cpp` (modified, +14/-2)
```diff
@@ -40,7 +40,8 @@ DEFINE_FAIL_POINT(expr_prepare_fragment_thread_local_call_failed);
 
 VectorizedFunctionCallExpr::VectorizedFunctionCallExpr(const TExprNode& node) : Expr(node) {}
 
-const FunctionDescriptor* VectorizedFunctionCallExpr::_get_function_by_fid(const TFunction& fn) {
+const FunctionDescriptor* VectorizedFunctionCallExpr::_get_function_by_fid(
+        const TFunction& fn, const std::vector<TypeDescriptor>& arg_types) {
     // branch-3.0 is 150102~150104, branch-3.1 is 150103~150105
     // refs: https://github.com/StarRocks/starrocks/pull/17803
     // @todo: remove this code when branch-3.0 is deprecated
@@ -52,6 +53,17 @@ const FunctionDescriptor* VectorizedFunctionCallExpr::_get_function_by_fid(const
     } else if (fn.fid == 150104 && _type.type == TYPE_ARRAY && _type.children[0].type == TYPE_DECIMAL128) {
         fid = 150105;
     }
+    // Contract 4.3 (#79786) renumbered existing native GEOGRAPHY functions.
+    // Accept plans from the earlier registry without renumbering the current one again.
+    // 120081 is also the current ST_X(GEOMETRY): distinguish it by the native argument type,
+    // never by WKB contents. Normal GEO execution still validates the semantic descriptor.
+    if (arg_types.size() == 1 && arg_types[0].type == TYPE_GEOGRAPHY) {
+        if (fid == 120081) fid = 120090; // ST_Y(GEOGRAPHY)
+        if (fid == 120082) fid = 120170; // ST_GeometryType(GEOGRAPHY)
+    } else if (fid == 120083 && arg_types.size() == 2 && arg_types[0].type == TYPE_GEOGRAPHY &&
+               arg_types[1].type == TYPE_GEOGRAPHY) {
+        fid = 120180; // ST_Distance(GEOGRAPHY, GEOGRAPHY)
+    }
     return BuiltinFunctions::find_builtin_function(fid);
 }
 
@@ -78,7 +90,7 @@ const FunctionDescriptor* VectorizedFunctionCallExpr::_get_function(const TFunct
                                                                     prepare_func, close_func, true, false);
         return _agg_func_desc.get();
     } else {
-        return _get_function_by_fid(fn);
+        return _get_function_by_fid(fn, arg_types);
     }
 }
 
```

**File**: `be/src/exprs/function_call_expr.h` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ class VectorizedFunctionCallExpr final : public Expr {
     StatusOr<ColumnPtr> evaluate_checked(ExprContext* context, Chunk* ptr) override;
 
 private:
-    const FunctionDescriptor* _get_function_by_fid(const TFunction& fn);
+    const FunctionDescriptor* _get_function_by_fid(const TFunction& fn, const std::vector<TypeDescriptor>& arg_types);
     const FunctionDescriptor* _get_function(const TFunction& fn, const std::vector<TypeDescriptor>& arg_types,
                                             const TypeDescriptor& result_type, std::vector<bool> arg_nullables);
 
```

**File**: `be/test/column/geo_column_test.cpp` (modified, +64/-3)
```diff
@@ -249,6 +249,63 @@ TEST(GeoColumnTest, CopyRejectsDescriptorChangesWithoutSqlCoercion) {
     EXPECT_THROW(GeoColumn::create(different), std::invalid_argument);
 }
 
+TEST(GeoColumnTest, MaterializationBindsOnlyStorageOfTypedPlaceholders) {
+    auto desc = descriptor(GEO_LOGICAL_TYPE_GEOMETRY);
+    desc.storage = {GEO_ENCODING_WKB, GEO_DIMENSION_XY, GEO_VALIDATION_STATE_SEMANTICALLY_VALIDATED};
+    const auto type = TypeDescriptor::create_geo_type(TYPE_GEOMETRY, desc.type);
+    auto source = GeoColumn::create(desc);
+    source->append_wkb(Slice(point()));
+    auto empty = GeoColumn::create(type, 0);
+    const auto unbound = empty->descriptor();
+    empty->append(*source, 0, 0);
+    empty->append_selective(*source, nullptr, 0, 0);
+    empty->append_value_multiple_times(*source, 0, 0);
+    EXPECT_EQ(unbound, empty->descriptor());
+    for (int operation = 0; operation < 4; ++operation) {
+        SCOPED_TRACE(operation);
+        auto destination = GeoColumn::create(type, 0);
+        destination->append_default(); // A NULL placeholder has no WKB payload.
+        uint32_t index = 0;
+        switch (operation) {
+        case 0:
+            destination->append(*source, 0, 1);
+            break;
+        case 1:
+            destination->append_selective(*source, &index, 0, 1);
+            break;
+        case 2:
+            destination->append_value_multiple_times(*source, 0, 1);
+            break;
+        default:
+            destination->update_rows(*source, &index);
+        }
+        EXPECT_EQ(desc, destination->descriptor());
+        EXPECT_EQ(point(), destination->get_wkb(destination->size() - 1).to_string());
+    }
+
+    // An untyped placeholder must never acquire semantic identity from its input.
+    auto untyped = GeoColumn::create();
+    EXPECT_THROW(untyped->append(*source), std::invalid_argument);
+    auto other_crs = type;
+    other_crs.geo_type->crs = "custom:other";
+    auto incompatible = GeoColumn::create(other_crs, 0);
+    EXPECT_THROW(incompatible->append(*source), std::invalid_argument);
+
+    // Already populated UNKNOWN storage is not evidence of XY data.
+    auto raw = GeoColumn::create(type, 0);
+    raw->append_wkb(Slice(point()));
+    EXPECT_THROW(raw->append(*source), std::invalid_argument);
+    EXPECT_EQ(GEO_DIMENSION_UNKNOWN, raw->descriptor().storage.dimension);
+    EXPECT_EQ(1, raw->size());
+
+    // Explicit physical descriptors retain strict copy checks, even when empty.
+    auto explicit_desc = desc;
+    explicit_desc.storage.dimension = GEO_DIMENSION_XYZ;
+    auto explicit_column = GeoColumn::create(explicit_desc);
+    EXPECT_THROW(explicit_column->append(*source), std::invalid_argument);
+    EXPECT_EQ(explicit_desc, explicit_column->descriptor());
+}
+
 TEST(GeoColumnTest, BoundedInspectionDoesNotTrustProducerFlag) {
     auto desc = descriptor();
     desc.storage.validation_state = GEO_VALIDATION_STATE_SEMANTICALLY_VALIDATED;
@@ -331,15 +388,19 @@ TEST(GeoColumnTest, MysqlWkbUsesExistingBinaryEncoding) {
     EXPECT_FALSE(column->has_wkb_cache());
 }
 
-TEST(GeoColumnTest, GenericCreationCannotRelabelTypedPayload) {
+TEST(GeoColumnTest, GenericCreationPreservesTypedPayload) {
     for (const auto primitive : {TYPE_GEOGRAPHY, TYPE_GEOMETRY}) {
         const auto desc =
                 descriptor(primitive == TYPE_GEOGRAPHY ? GEO_LOGICAL_TYPE_GEOGRAPHY : GEO_LOGICAL_TYPE_GEOMETRY);
         auto source = GeoColumn::create(desc);
         source->append_wkb(Slice(point()));
         auto destination = ColumnHelper::create_column(TypeDescriptor::create_geo_type(primitive, desc.type), false);
-        EXPECT_THROW(destination->append(*source, 0, 1), std::invalid_argument);
-        EXPECT_EQ(0, destination->size());
+        // The factory already fixes the semantic type; an empty destination can acquire storage metadata.
+        ASSERT_NO_THROW(destination->append(*source, 0, 1));
+        ASSERT_EQ(1, destination->size());
+        EXPECT_EQ(desc, down_cast<const GeoColumn*>(destination.get())->descriptor());
+        EXPECT_EQ(point(), down_cast<const GeoColumn*>(destination.get())->get_wkb(0).to_string());
+        EXPECT_EQ(desc, source->descriptor());
         auto copied = source->clone();
         EXPECT_EQ(desc, down_cast<const GeoColumn*>(copied.get())->descriptor());
         EXPECT_EQ(point(), down_cast<const GeoColumn*>(copied.get())->get_wkb(0).to_string());
```

**File**: `be/test/exprs/geography_functions_test.cpp` (modified, +130/-0)
```diff
@@ -32,6 +32,8 @@
 #include "column/nullable_column.h"
 #include "common/config_expr_fwd.h"
 #include "exprs/builtin_functions.h"
+#include "exprs/expr_context.h"
+#include "exprs/function_call_expr.h"
 #include "exprs/geo_functions.h"
 #include "exprs/mock_vectorized_expr.h"
 #include "geo/geo_types.h"
@@ -1959,6 +1961,134 @@ TEST_F(geographyFunctionsTest, nativeGeoCrsRejectsThreeAxisProjectedCrs) {
     EXPECT_NE(std::string::npos, source_status.message().find("EPSG:4326 and EPSG:3857"));
 }
 
+TEST_F(geographyFunctionsTest, nativeGeoHistoricalFunctionIds) {
+    RuntimeState state;
+    auto run = [&](int64_t id, bool planar, LogicalType result_type, int arguments, double expected) {
+        SCOPED_TRACE(id);
+        const auto type = planar ? geometry_type() : geography_type();
+        auto value = planar ? geometry({"POINT (1 2)"}) : geography({"POINT (1 2)"});
+        TExprNode node;
+        node.__set_node_type(TExprNodeType::FUNCTION_CALL);
+        node.__set_type(TypeDescriptor(result_type).to_thrift());
+        node.__set_num_children(arguments);
+        TFunction fn;
+        TFunctionName name;
+        name.__set_function_name(
+                arguments == 2 ? "st_distance"
+                               : (result_type == TYPE_VARCHAR ? "st_geometrytype" : planar ? "st_x" : "st_y"));
+        fn.__set_name(name);
+        fn.__set_binary_type(TFunctionBinaryType::BUILTIN);
+        fn.__set_fid(id);
+        fn.__set_arg_types(std::vector<TTypeDesc>(arguments, type.to_thrift()));
+        fn.__set_ret_type(node.type);
+        fn.__set_has_var_args(false);
+        node.__set_fn(fn);
+        VectorizedFunctionCallExpr expr(node);
+        TExprNode input;
+        input.__set_node_type(TExprNodeType::SLOT_REF);
+        input.__set_type(type.to_thrift());
+        MockExpr first(input, value);
+        MockExpr second(input, value);
+        expr.add_child(&first);
+        if (arguments == 2) expr.add_child(&second);
+        ExprContext context(&expr);
+        auto status = context.prepare(&state);
+        if (status.ok()) status = context.open(&state);
+        if (status.ok()) {
+            auto result = context.evaluate(nullptr);
+            EXPECT_TRUE(result.ok()) << result.status();
+            if (result.ok()) {
+                if (result_type == TYPE_VARCHAR) {
+                    EXPECT_EQ("ST_Point", result.value()->get(0).get_slice().to_string());
+                } else {
+                    EXPECT_DOUBLE_EQ(expected, result.value()->get(0).get_double());
+                }
+            }
+        }
+        context.close(&state);
+        EXPECT_TRUE(status.ok()) << status;
+    };
+    // Plans from both registries must work during BE-before-FE upgrades.
+    for (int64_t id : {120081, 120090}) run(id, false, TYPE_DOUBLE, 1, 2.0);
+    for (int64_t id : {120082, 120170}) run(id, false, TYPE_VARCHAR, 1, 0.0);
+    for (int64_t id : {120083, 120180}) run(id, false, TYPE_DOUBLE, 2, 0.0);
+    run(120081, true, TYPE_DOUBLE, 1, 1.0);
+}
+
+TEST_F(geographyFunctionsTest, nativeGeometryConstantMaterialization) {
+    const auto type = geometry_type();
+    std::unique_ptr<FunctionContext> context(
+            FunctionContext::create_test_context({TypeDescriptor(TYPE_VARCHAR), TypeDescriptor(TYPE_VARCHAR)}, type));
+    auto wkt = ColumnHelper::create_const_column<TYPE_VARCHAR>(Slice("POINT (1 2)"), 1);
+    auto crs = ColumnHelper::create_const_column<TYPE_VARCHAR>(Slice("EPSG:3857"), 1);
+    auto value = GeoFunctions::st_geom_from_text(context.get(), {wkt, crs});
+    ASSERT_TRUE(value.ok()) << value.status();
+    const auto expected = down_cast<const GeoColumn*>(ColumnHelper::get_data_column(value->get()))->descriptor();
+    for (bool nullable : {false, true}) {
+        // A non-nullable destination receives a non-nullable constant payload.
+        ColumnPtr source =
+                nullable ? value.value() : ConstColumn::create(ColumnHelper::get_data_column(value->get())->clone(), 1);
+        auto unfolded = ColumnHelper::move_column(type, nullable, std::move(source), 3);
+        ASSERT_EQ(3, unfolded->size());
+        EXPECT_FALSE(unfolded->is_constant());
+        EXPECT_EQ(nullable, unfolded->is_nullable());
+        auto* geo = down_cast<const GeoColumn*>(ColumnHelper::get_data_column(unfolded.get()));
+        EXPECT_EQ(expected, geo->descriptor());
+        auto x = GeoFunctions::st_geometry_x(nullptr, {unfolded});
+        ASSERT_TRUE(x.ok()) << x.status();
+        for (size_t i = 0; i < 3; ++i) EXPECT_DOUBLE_EQ(1.0, x.value()->get(i).get_double());
+    }
+    // Match UNION's typed destination and copy path, with NULLs on both sides.
+    auto destination = ColumnHelper::create_column(type, true);
+    EXPECT_TRUE(destination->append_nulls(1));
+    ColumnPtr source = value.value();
+    auto row = ColumnHelper::move_column(type, true, std::move(source), 1);
+    destination->append(*row, 0, 1);
+    auto null_row = ColumnHelper::move_column(ty
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/ExpressionAnalyzer.java` (modified, +4/-0)
```diff
@@ -1257,6 +1257,10 @@ private void convertAesEncryptionParameters(FunctionCallExpr node) {
         }
 
         private void checkFunction(String fnName, FunctionCallExpr node, Type[] argumentTypes) {
+            if ((FunctionSet.ROW.equals(fnName) || FunctionSet.NAMED_STRUCT.equals(fnName)) &&
+                    node.getChildren().stream().anyMatch(child -> child.getType().isGeoType())) {
+                throw new SemanticException(fnName + " does not support native GEO arguments", node.getPos());
+            }
             switch (fnName) {
                 case FunctionSet.AES_ENCRYPT:
                 case FunctionSet.AES_DECRYPT:
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/analyzer/AnalyzeFunctionTest.java` (modified, +27/-0)
```diff
@@ -127,6 +127,33 @@ public void testNativeGeometryInitialFunctions() {
                 "No matching function with signature: st_distance");
     }
 
+    @Test
+    public void testNativeGeoStructAdmission() {
+        for (String geo : List.of("ST_GeogFromText('POINT (1 2)')",
+                "ST_GeomFromText('POINT (1 2)', 'EPSG:3857')")) {
+            analyzeFail("select row(" + geo + ")", "does not support native GEO arguments");
+            analyzeFail("select ST_AsText(row(" + geo + ").col1)", "does not support native GEO arguments");
+            analyzeFail("select named_struct('g', " + geo + ")", "does not support native GEO arguments");
+            analyzeFail("select row(named_struct('g', " + geo + "))", "does not support native GEO arguments");
+            analyzeFail("select named_struct('g', row(" + geo + "))", "does not support native GEO arguments");
+            analyzeSuccess("select row(ST_AsText(" + geo + "))");
+        }
+        analyzeSuccess("select row(1, NULL, 'a')");
+        analyzeSuccess("select named_struct('i', 1, 'n', NULL)");
+        // Legacy geometry is VARCHAR and is not affected by native-GEO admission.
+        analyzeSuccess("select row(ST_GeomFromText('POINT (1 2)'))");
+    }
+
+    @Test
+    public void testGeometryOpaqueCrsDescriptor() {
+        QueryRelation relation = ((QueryStatement) analyzeSuccess(
+                "select ST_GeomFromText('POINT (1 2)', 'EPSG:+4326')")).getQueryRelation();
+        ScalarType type = (ScalarType) ((SelectRelation) relation).getOutputExpression().get(0).getType();
+        Assertions.assertEquals("EPSG:+4326", type.getGeoDescriptor().crs());
+        Assertions.assertNull(type.getGeoDescriptor().srid());
+        analyzeSuccess("select ST_AsText(ST_GeomFromText('POINT (1 2)', 'EPSG:+4326'))");
+    }
+
     @Test
     public void testNativeGeoFunctionContract() {
         assertFunctionContract("select ST_GeogFromText('POINT (1 2)')", 120020, PrimitiveType.GEOGRAPHY);
```

---

### Incident Patch 2: `fa9e2668` (2026-10-06)
**Commit Message**: [BugFix] Resolve base tables before the MV lock when activating an MV (#79972)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterJobMgr.java` (modified, +77/-34)
```diff
@@ -256,38 +256,12 @@ public AlterMaterializedViewStatusContext prepareAlterMaterializedViewStatus(
         LOG.info("process change materialized view {} status to {}, isReplay: {}",
                 materializedView.getName(), status, isReplay);
         if (AlterMaterializedViewStatusClause.ACTIVE.equalsIgnoreCase(status)) {
-            ConnectContext context = ConnectContext.buildInner();
-            context.setGlobalStateMgr(GlobalStateMgr.getCurrentState());
-            context.setQualifiedUser(AuthenticationMgr.ROOT_USER);
-            context.setCurrentUserIdentity(UserIdentity.ROOT);
-            context.setCurrentRoleIds(Sets.newHashSet(PrivilegeBuiltinConstants.ROOT_ROLE_ID));
-
-            String createMvSql = materializedView.getMaterializedViewDdlStmt(false, isReplay);
-            QueryStatement mvQueryStatement = null;
             try {
-                mvQueryStatement = recreateMVQuery(materializedView, context, createMvSql);
-            } catch (Exception e) {
-                LOG.warn("alter mv {} to active failed", materializedView.getName(), e);
-                throw new SemanticException("Can not active materialized view [%s]" +
-                        " because analyze materialized view define sql: \n\n%s" +
-                        "\n\nCause an error: %s", materializedView.getName(), createMvSql, e.getMessage());
-            }
-
-            // Skip checks to maintain eventual consistency when replay
-            Map<TableName, Table> tableNameTableMap =
-                    AnalyzerUtils.collectAllConnectorTableAndViewWithViewDefinition(mvQueryStatement);
-            Set<BaseTableInfo> baseTableInfos = MaterializedViewAnalyzer.getBaseTableInfos(tableNameTableMap);
-            if (!isReplay) {
-                MaterializedViewAnalyzer.checkBaseTables(
-                        tableNameTableMap, materializedView.getPartitionInfo().isUnPartitioned());
-            }
-            TaskManager taskManager = GlobalStateMgr.getCurrentState().getTaskManager();
-            Task task = taskManager.getTask(materializedView);
-            if (task == null) {
-                throw new SemanticException("Can not find running task for materialized view [%s]",
-                        materializedView.getName());
+                return resolveActivate(materializedView, reason, isReplay);
+            } catch (RuntimeException e) {
+                applyActivateFailure(materializedView, e);
+                throw e;
             }
-            return new AlterMaterializedViewStatusContext(status, reason, Lists.newArrayList(baseTableInfos), task);
         } else if (AlterMaterializedViewStatusClause.INACTIVE.equalsIgnoreCase(status)) {
             TaskManager taskManager = GlobalStateMgr.getCurrentState().getTaskManager();
             Task currentTask = taskManager.getTask(TaskBuilder.getMvTaskName(materializedView.getId()));
@@ -309,6 +283,76 @@ public AlterMaterializedViewStatusContext prepareAlterMaterializedViewStatus(
         }
     }
 
+    /**
+     * The analysis half of an ACTIVE transition: re-parse and re-analyze the MV's definition and resolve the
+     * base tables it names. Every step can reach the connector of an external base table. It does not modify
+     * the MV, so the leader runs it before taking the MV write lock (see
+     * {@code AlterMVJobExecutor#resolveBeforeLock}); a failure that has to be recorded on the MV is left to
+     * {@link #applyActivateFailure}, for the caller to apply once it holds the lock.
+     */
+    public AlterMaterializedViewStatusContext resolveActivate(
+            MaterializedView materializedView, String reason, boolean isReplay) {
+        ConnectContext context = ConnectContext.buildInner();
+        context.setGlobalStateMgr(GlobalStateMgr.getCurrentState());
+        context.setQualifiedUser(AuthenticationMgr.ROOT_USER);
+        context.setCurrentUserIdentity(UserIdentity.ROOT);
+        context.setCurrentRoleIds(Sets.newHashSet(PrivilegeBuiltinConstants.ROOT_ROLE_ID));
+
+        String createMvSql = materializedView.getMaterializedViewDdlStmt(false, isReplay);
+        QueryStatement mvQueryStatement = null;
+        try {
+            mvQueryStatement = recreateMVQuery(materializedView, context, createMvSql);
+        } catch (Exception e) {
+            LOG.warn("alter mv {} to active failed", materializedView.getName(), e);
+            throw new SemanticException(String.format("Can not active materialized view [%s]" +
+                    " because analyze materialized view define sql: \n\n%s" +
+                    "\n\nCause an error: %s", materializedView.getName(), createMvSql, e.getMessage()), e);
+        }
+
+        Map<TableName, Table> tableNameTableMap =
+                AnalyzerUtils.collectAllConnectorTableAndViewWithViewDefinition(mvQueryStatement);
+        Set<BaseTableInfo> baseTableInfos = MaterializedViewAnalyzer.getBaseTableInfos(tableNameTableMap);
+        // Skip checks to maintain eventual c
```

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterMVJobExecutor.java` (modified, +55/-4)
```diff
@@ -33,6 +33,7 @@
 import com.starrocks.catalog.TableProperty;
 import com.starrocks.catalog.constraint.ForeignKeyConstraint;
 import com.starrocks.catalog.constraint.UniqueConstraint;
+import com.starrocks.catalog.mv.PreResolvedBaseTables;
 import com.starrocks.common.AnalysisException;
 import com.starrocks.common.Config;
 import com.starrocks.common.DdlException;
@@ -589,6 +590,9 @@ private void alterSessionVariables(Map<String, String> properties,
     private String preResolvedDefineSql;
     private Boolean preResolvedHasNonNativeBaseTable;
     private MaterializedView.PreResolvedRefBaseTables preResolvedRefBaseTables;
+    private AlterJobMgr.AlterMaterializedViewStatusContext preResolvedActivateContext;
+    private RuntimeException preResolvedActivateFailure;
+    private PreResolvedBaseTables preResolvedBaseTables;
 
     /**
      * Everything ALTER MATERIALIZED VIEW used to resolve while holding the MV's write lock.
@@ -641,9 +645,51 @@ protected void resolveBeforeLock(AlterClause alterClause, ConnectContext context
             // the lock whether the AST is still current -- see takePreResolvedDefineQueryAst.
             preResolvedDefineSql = mv.getOriginalViewDefineSql();
             preResolvedDefineQueryAst = mv.initDefineQueryParseNode();
+        } else if (alterClause instanceof AlterMaterializedViewStatusClause
+                && AlterMaterializedViewStatusClause.ACTIVE.equalsIgnoreCase(
+                        ((AlterMaterializedViewStatusClause) alterClause).getStatus())
+                && !mv.isActive()) {
+            // Re-analyzing the definition resolves every base table, and so does the relationship rebuild
+            // that follows it under the lock; both are resolved here. A failure is kept, not thrown: the
+            // visitor reports it under the lock, after the checks that come first today (MV state, whether
+            // the MV is already active), and records on the MV what it has to record -- see
+            // takePreResolvedActivate.
+            LOG.info("process change materialized view {} status to {}, isReplay: false", mv.getName(),
+                    AlterMaterializedViewStatusClause.ACTIVE);
+            preResolvedDefineSql = mv.getOriginalViewDefineSql();
+            try {
+                preResolvedActivateContext = GlobalStateMgr.getCurrentState().getAlterJobMgr()
+                        .resolveActivate(mv, "", false);
+                preResolvedBaseTables = PreResolvedBaseTables.resolve(preResolvedActivateContext.baseTableInfos());
+            } catch (RuntimeException e) {
+                preResolvedActivateFailure = e;
+            }
         }
     }
 
+    /**
+     * The analysis of an ACTIVE transition resolved before the lock, once it is known to still apply.
+     *
+     * <p>What it depends on that the MV lock covers is the MV's definition: the base tables are derived from
+     * it, and the column-compatibility check compares it with the MV's schema, which only changes together
+     * with the definition (ADD/DROP COLUMN). If the definition moved, or the MV was still active when the
+     * statement resolved and has been inactivated since, the analysis does not describe this MV any more.
+     * Redoing it here would put the connector calls back under the lock, so the statement is rejected; for
+     * MVActiveChecker that is one failed round, and its next round resolves afresh.
+     */
+    private AlterJobMgr.AlterMaterializedViewStatusContext takePreResolvedActivate(MaterializedView mv) {
+        if ((preResolvedActivateContext == null && preResolvedActivateFailure == null)
+                || !Objects.equals(preResolvedDefineSql, mv.getOriginalViewDefineSql())) {
+            throw new AlterJobException(String.format("Materialized view %s was altered concurrently, "
+                    + "please retry the statement", mv.getName()));
+        }
+        if (preResolvedActivateFailure != null) {
+            AlterJobMgr.applyActivateFailure(mv, preResolvedActivateFailure);
+            throw preResolvedActivateFailure;
+        }
+        return preResolvedActivateContext;
+    }
+
     /**
      * The define-query AST resolved before the lock, once it is known to still be current.
      *
@@ -1295,15 +1341,20 @@ public Void visitAlterMaterializedViewStatusClause(AlterMaterializedViewStatusCl
                 }
 
                 AlterJobMgr alterJobMgr = GlobalStateMgr.getCurrentState().getAlterJobMgr();
-                AlterJobMgr.AlterMaterializedViewStatusContext statusContext =
-                        alterJobMgr.prepareAlterMaterializedViewStatus(materializedView, status, "", false);
+                // Analyzed in resolveBeforeLock.
+                AlterJobMgr.AlterMaterializedViewStatusContext statusContext = takePreResolvedActivate(materializedView);
                 AlterMaterializedViewStatusLog log = new AlterMaterializedViewStatusLog(materializedView.getDbId(),
                         materializedVie
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/mv/PreResolvedBaseTables.java` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
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
+package com.starrocks.catalog.mv;
+
+import com.google.common.collect.Maps;
+import com.starrocks.catalog.BaseTableInfo;
+import com.starrocks.catalog.Table;
+import com.starrocks.qe.ConnectContext;
+import com.starrocks.server.GlobalStateMgr;
+
+import java.util.Collection;
+import java.util.Map;
+import java.util.Optional;
+import java.util.function.Supplier;
+
+/**
+ * External base tables of an MV, resolved before a metadata lock is taken, for MV code that runs under the
+ * lock and resolves them again.
+ *
+ * <p>MV code resolves a base table through {@code MetadataMgr#getTable(ConnectContext, BaseTableInfo)} --
+ * directly or via {@code MvUtils#getTable / getTableWithIdentifier / getTableChecked} -- and for an external
+ * base table that is a connector call. Much of that code mutates the MV and so has to run under the MV's lock
+ * (the relationship rebuild of ALTER ... ACTIVE, the retention-condition analysis of ALTER ... SET), but the
+ * lookups need not. The caller resolves the tables first, then runs the locked section inside {@link #enter()};
+ * while the scope is open, {@code MetadataMgr} answers those lookups on this thread from here.
+ *
+ * <p><b>Why no "still current" check.</b> No FE lock covers an external table, so holding a metadata lock
+ * never made its metadata stable, and resolving it again under the lock would not either -- the second answer
+ * is as current as the first. Whatever the lock does cover (such as the MV's definition) is the caller's to
+ * check.
+ *
+ * <p>A lookup that failed is recorded with its exception and rethrown on every read, so the locked code sees
+ * the outcome it would have seen resolving the table itself, at the same point. Internal base tables are never
+ * recorded: they are an in-memory lookup and the caller wants the current object.
+ */
+public final class PreResolvedBaseTables {
+    private record Resolution(Table table, RuntimeException failure) {
+        Optional<Table> get() {
+            if (failure != null) {
+                throw failure;
+            }
+            return Optional.ofNullable(table);
+        }
+    }
+
+    private static final ThreadLocal<PreResolvedBaseTables> CURRENT = new ThreadLocal<>();
+
+    private final Map<BaseTableInfo, Resolution> byInfo = Maps.newHashMap();
+
+    private PreResolvedBaseTables() {
+    }
+
+    /**
+     * Resolves the way {@code MvUtils#getTable} does -- on the thread's context, reading the iceberg cache
+     * only -- because that is the lookup the locked code makes and whose answer this stands in for.
+     */
+    public static PreResolvedBaseTables resolve(Collection<BaseTableInfo> baseTableInfos) {
+        PreResolvedBaseTables result = new PreResolvedBaseTables();
+        try (ConnectContext.ContextScope scope = ConnectContext.enterOnlyReadIcebergCacheScope(ConnectContext.get())) {
+            for (BaseTableInfo baseTableInfo : baseTableInfos) {
+                if (baseTableInfo == null || baseTableInfo.isInternalCatalog()
+                        || result.byInfo.containsKey(baseTableInfo)) {
+                    continue;
+                }
+                Resolution resolution;
+                try {
+                    resolution = new Resolution(GlobalStateMgr.getCurrentState().getMetadataMgr()
+                            .getTable(scope.getContext(), baseTableInfo).orElse(null), null);
+                } catch (RuntimeException e) {
+                    resolution = new Resolution(null, e);
+                }
+                result.byInfo.put(baseTableInfo, resolution);
+            }
+        }
+        return result;
+    }
+
+    /**
+     * Makes lookups on the current thread use these tables until the returned scope is closed. Scopes nest:
+     * closing one restores the one it replaced.
+     */
+    public Scope enter() {
+        PreResolvedBaseTables previous = CURRENT.get();
+        CURRENT.set(this);
+        return () -> {
+            if (previous == null) {
+                CURRENT.remove();
+            } else {
+                CURRENT.set(previous);
+            }
+        };
+    }
+
+    /**
+     * The lookup hook for {@code MetadataMgr}: the table pre-resolved for this base table in the scope open on
+     * this thread, or else whatever {@code resolver} returns.
+     *
+     * @throws RuntimeEx
```

**File**: `fe/fe-core/src/main/java/com/starrocks/server/MetadataMgr.java` (modified, +3/-2)
```diff
@@ -36,6 +36,7 @@
 import com.starrocks.catalog.PartitionKey;
 import com.starrocks.catalog.Table;
 import com.starrocks.catalog.TableName;
+import com.starrocks.catalog.mv.PreResolvedBaseTables;
 import com.starrocks.common.AlreadyExistsException;
 import com.starrocks.common.Config;
 import com.starrocks.common.DdlException;
@@ -590,8 +591,8 @@ public Optional<Table> getTable(ConnectContext context, BaseTableInfo baseTableI
         if (baseTableInfo.isInternalCatalog()) {
             return Optional.ofNullable(localMetastore.getTable(baseTableInfo.getDbId(), baseTableInfo.getTableId()));
         } else {
-            return Optional.ofNullable(
-                    getTable(context, baseTableInfo.getCatalogName(), baseTableInfo.getDbName(), baseTableInfo.getTableName()));
+            return PreResolvedBaseTables.getOrResolve(baseTableInfo, () -> Optional.ofNullable(
+                    getTable(context, baseTableInfo.getCatalogName(), baseTableInfo.getDbName(), baseTableInfo.getTableName())));
         }
     }
 
```

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/AlterMVActivateResolveBeforeLockTest.java` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
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
+package com.starrocks.alter;
+
+import com.starrocks.catalog.BaseTableInfo;
+import com.starrocks.catalog.MaterializedView;
+import com.starrocks.catalog.Table;
+import com.starrocks.catalog.mv.PreResolvedBaseTables;
+import com.starrocks.common.util.concurrent.lock.LockHoldDepth;
+import com.starrocks.connector.ConnectorMetadata;
+import com.starrocks.connector.MockedMetadataMgr;
+import com.starrocks.connector.hive.MockedHiveMetadata;
+import com.starrocks.qe.ConnectContext;
+import com.starrocks.scheduler.MVActiveChecker;
+import com.starrocks.server.GlobalStateMgr;
+import com.starrocks.sql.optimizer.rule.transformation.materialization.MVTestBase;
+import com.starrocks.sql.plan.ConnectorPlanTestBase;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Assertions;
+import org.junit.jupiter.api.BeforeAll;
+import org.junit.jupiter.api.Test;
+
+import java.util.Optional;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicInteger;
+
+/**
+ * ALTER MATERIALIZED VIEW ... ACTIVE -- run by a user, by MVActiveChecker, and by an MV task run that finds
+ * its MV inactive -- used to re-analyze the MV's definition and then rebuild its relationship while holding
+ * the MV write lock. Both resolve every base table, the rebuild several times each, and for an external base
+ * table each of those is a connector call. They are now resolved before the lock.
+ */
+public class AlterMVActivateResolveBeforeLockTest extends MVTestBase {
+
+    // Partitioned, so the rebuild analyzes the partition exprs against the hive table as well.
+    private static final String HIVE_MV_DEFINITION = "PARTITION BY (`l_shipdate`)\n"
+            + "DISTRIBUTED BY RANDOM\n"
+            + "REFRESH DEFERRED MANUAL\n"
+            + "AS SELECT l_orderkey, l_suppkey, l_shipdate FROM hive0.partitioned_db.lineitem_par;";
+
+    private LockProbeHiveMetadata probe;
+    private ConnectorMetadata originalHiveMetadata;
+
+    @BeforeAll
+    public static void beforeClass() throws Exception {
+        MVTestBase.beforeClass();
+        ConnectorPlanTestBase.mockHiveCatalog(connectContext);
+    }
+
+    /**
+     * Samples {@link LockHoldDepth#isUnderLock()} on getTable, OR-accumulated, for calls made on the thread
+     * that installed it only: creating an MV hands its definition to the mv-plan-cache executor, which
+     * resolves the same hive table at an arbitrary moment on a thread whose lock state is unrelated.
+     */
+    private static class LockProbeHiveMetadata extends MockedHiveMetadata {
+        private final Thread owner = Thread.currentThread();
+        private final AtomicBoolean underLock = new AtomicBoolean(false);
+        private final AtomicInteger calls = new AtomicInteger();
+        // Run once, on the first call made without the lock held.
+        private volatile Runnable onUnlockedGetTable;
+
+        @Override
+        public Table getTable(ConnectContext context, String dbName, String tblName) {
+            if (Thread.currentThread() == owner) {
+                calls.incrementAndGet();
+                if (LockHoldDepth.isUnderLock()) {
+                    underLock.set(true);
+                } else {
+                    Runnable hook = onUnlockedGetTable;
+                    onUnlockedGetTable = null;
+                    if (hook != null) {
+                        hook.run();
+                    }
+                }
+            }
+            return super.getTable(context, dbName, tblName);
+        }
+    }
+
+    private void installProbe() {
+        MockedMetadataMgr metadataMgr = (MockedMetadataMgr) GlobalStateMgr.getCurrentState().getMetadataMgr();
+        if (originalHiveMetadata == null) {
+            originalHiveMetadata = metadataMgr.getOptionalMetadata(MockedHiveMetadata.MOCKED_HIVE_CATALOG_NAME)
+                    .orElseThrow(() -> new IllegalStateException("hive0 catalog is not registered"));
+        }
+        probe = new LockProbeHiveMetadata();
+        metadataMgr.registerMockedMetadata(MockedHiveMetadata.MOCKED_HIVE_CATALOG_NAME, probe);
+    }
+
+    @AfterEach
+    public void removeProbe() {
+        if (originalHiveMetadata != null) {
+            MockedMetadataMgr metadataMgr = (MockedMetadataMgr) GlobalStateMgr.getCurrentState().getMetadataMgr();
+            metadataMg
```

---

### Incident Patch 3: `c8cdd09c` (2026-10-05)
**Commit Message**: [BugFix] Enqueue a finished transaction only once in finalStatusTransactionStateDeque (#79988)

Co-authored-by: starrocks-xupeng <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/transaction/DatabaseTransactionMgr.java` (modified, +11/-4)
```diff
@@ -1683,8 +1683,13 @@ protected void unprotectUpsertTransactionState(TransactionState transactionState
                         .removeFromStartupActiveCompactionTransactionMap(transactionState.getTransactionId());
             }
             transactionGraph.remove(transactionState.getTransactionId());
-            idToFinalStatusTransactionState.put(transactionState.getTransactionId(), transactionState);
-            finalStatusTransactionStateDeque.add(transactionState);
+            // A transaction may reach a final status more than once (a duplicated finish, a replayed edit
+            // log, an image load). The deque is what removeExpiredTxns walks and it must hold every
+            // transaction exactly once: a second entry is popped after its label mapping was already
+            // removed and aborts the whole cleanup round.
+            if (idToFinalStatusTransactionState.put(transactionState.getTransactionId(), transactionState) == null) {
+                finalStatusTransactionStateDeque.add(transactionState);
+            }
         }
         updateTxnLabels(transactionState);
     }
@@ -1731,8 +1736,10 @@ public void unprotectSetTransactionStateBatch(TransactionStateBatch stateBatch)
                         .removeFromStartupActiveCompactionTransactionMap(transactionState.getTransactionId());
             }
             transactionGraph.remove(transactionState.getTransactionId());
-            idToFinalStatusTransactionState.put(transactionState.getTransactionId(), transactionState);
-            finalStatusTransactionStateDeque.add(transactionState);
+            // See unprotectUpsertTransactionState(): enqueue a transaction at most once.
+            if (idToFinalStatusTransactionState.put(transactionState.getTransactionId(), transactionState) == null) {
+                finalStatusTransactionStateDeque.add(transactionState);
+            }
             updateTxnLabels(transactionState);
         }
     }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/transaction/DatabaseTransactionMgrTest.java` (modified, +50/-0)
```diff
@@ -1858,4 +1858,54 @@ public void testIsPreviousTransactionsFinishedExcludeTxnIds() throws Exception {
             masterTransMgr.abortTransaction(GlobalStateMgrTestUtil.testDbId1, txnId, "cleanup");
         }
     }
+
+    @Test
+    public void testReplayFinalTransactionStateTwiceEnqueuesOnce() throws AnalysisException {
+        // A follower replays whatever the leader logged. setUp() already replayed txn1 as VISIBLE once;
+        // replaying the same final state again, as a fresh object like a deserialized edit log entry, must
+        // not add a second deque entry, otherwise the label cleaner pops it after the label mapping is gone.
+        FakeGlobalStateMgr.setGlobalStateMgr(slaveGlobalStateMgr);
+        // The first replay already advanced the catalog and the lake applier rejects the same version twice;
+        // the subject here is only the bookkeeping of the transaction manager, so the applier is a no-op
+        // (the batch replay path only exists for lake tables).
+        new MockUp<Table>() {
+            @Mock
+            public boolean isCloudNativeTableOrMaterializedView() {
+                return true;
+            }
+        };
+        new MockUp<LakeTableTxnLogApplier>() {
+            @Mock
+            public void applyVisibleLog(TransactionState txnState, TableCommitInfo commitInfo, Database db) {
+            }
+
+            @Mock
+            public void applyVisibleLogBatch(TransactionStateBatch txnStateBatch, Database db) {
+            }
+        };
+        DatabaseTransactionMgr slaveDbTransMgr =
+                slaveTransMgr.getDatabaseTransactionMgr(GlobalStateMgrTestUtil.testDbId1);
+        long txnId1 = lableToTxnId.get(GlobalStateMgrTestUtil.testTxnLable1);
+        assertEquals(1, slaveDbTransMgr.getFinishedTxnNums());
+
+        TransactionState replayedAgain = new TransactionState(fakeEditLog.getTransaction(txnId1));
+        assertEquals(TransactionStatus.VISIBLE, replayedAgain.getTransactionStatus());
+        slaveTransMgr.replayUpsertTransactionState(replayedAgain);
+        assertEquals(1, slaveDbTransMgr.getFinishedTxnNums());
+        Assertions.assertSame(replayedAgain, slaveDbTransMgr.getTransactionState(txnId1));
+
+        // the batch path records the final state through the same containers
+        TransactionState replayedInBatch = new TransactionState(fakeEditLog.getTransaction(txnId1));
+        slaveTransMgr.replayUpsertTransactionStateBatch(
+                new TransactionStateBatch(Lists.newArrayList(replayedInBatch)));
+        assertEquals(1, slaveDbTransMgr.getFinishedTxnNums());
+        Assertions.assertSame(replayedInBatch, slaveDbTransMgr.getTransactionState(txnId1));
+
+        // the label cleaner drops the single entry together with its label mapping
+        Config.label_keep_max_second = -1;
+        slaveDbTransMgr.removeExpiredTxns(System.currentTimeMillis());
+        assertEquals(0, slaveDbTransMgr.getFinishedTxnNums());
+        assertNull(slaveDbTransMgr.getTransactionState(txnId1));
+        assertNull(slaveDbTransMgr.unprotectedGetTxnIdsByLabel(GlobalStateMgrTestUtil.testTxnLable1));
+    }
 }
```

---

### Incident Patch 4: `cbe8cc8f` (2026-10-05)
**Commit Message**: [BugFix] Replay MV activation without re-analyzing its definition under the MV lock (#79973)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterJobMgr.java` (modified, +15/-0)
```diff
@@ -474,6 +474,21 @@ public void replayAlterMaterializedViewStatus(AlterMaterializedViewStatusLog log
         // To be compatible with the old version, if the reason is empty, use the default reason
         String reason = Strings.isEmpty(log.getReason()) ? MANUAL_INACTIVE_MV_REASON : log.getReason();
         try {
+            if (AlterMaterializedViewStatusClause.ACTIVE.equalsIgnoreCase(log.getStatus())
+                    && log.getBaseTableInfos() != null) {
+                // Adopt the base tables the leader activated with instead of re-analyzing the define query,
+                // which resolves every base table through the connector under this lock. Entries written by
+                // older versions carry none and take the path below.
+                Task task = GlobalStateMgr.getCurrentState().getTaskManager().getTask(mv);
+                if (task == null) {
+                    throw new SemanticException("Can not find running task for materialized view [%s]",
+                            mv.getName());
+                }
+                mv.activateOnReplay(Lists.newArrayList(log.getBaseTableInfos()));
+                // resume the mv scheduler
+                GlobalStateMgr.getCurrentState().getTaskManager().resumeTask(task, true);
+                return;
+            }
             AlterMaterializedViewStatusContext context =
                     prepareAlterMaterializedViewStatus(mv, log.getStatus(), reason, true);
             applyAlterMaterializedViewStatus(mv, context, true);
```

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterMVJobExecutor.java` (modified, +3/-0)
```diff
@@ -1299,6 +1299,9 @@ public Void visitAlterMaterializedViewStatusClause(AlterMaterializedViewStatusCl
                         alterJobMgr.prepareAlterMaterializedViewStatus(materializedView, status, "", false);
                 AlterMaterializedViewStatusLog log = new AlterMaterializedViewStatusLog(materializedView.getDbId(),
                         materializedView.getId(), status, "");
+                // Journal the base tables the activation settled on, so replay can adopt them instead of
+                // re-analyzing the define query under the MV lock, see replayAlterMaterializedViewStatus.
+                log.setBaseTableInfos(Lists.newArrayList(statusContext.baseTableInfos()));
                 GlobalStateMgr.getCurrentState().getEditLog().logAlterMvStatus(log, wal ->
                         alterJobMgr.applyAlterMaterializedViewStatus(materializedView, statusContext, false));
                 // for manual refresh type, do not refresh
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/MaterializedView.java` (modified, +93/-10)
```diff
@@ -114,6 +114,7 @@
 import java.util.Map;
 import java.util.Optional;
 import java.util.Set;
+import java.util.concurrent.CompletableFuture;
 import java.util.concurrent.TimeUnit;
 import java.util.concurrent.atomic.AtomicInteger;
 import java.util.stream.Collectors;
@@ -732,6 +733,9 @@ public String toString() {
     private static final int RELOAD_STATE_ING = 0;
     private static final int RELOAD_STATE_DONE = 1;
     private AtomicInteger reloadState = new AtomicInteger(RELOAD_STATE_NOT);
+    // Bumped by every active/inactive transition, guarded by this. Lets an asynchronous verdict tell
+    // whether the status it was computed for is still the current one, see activateOnReplay.
+    private long statusEpoch = 0;
 
     public MaterializedView() {
         super(TableType.MATERIALIZED_VIEW);
@@ -809,6 +813,7 @@ public synchronized void setActive() {
         LOG.info("set {} to active", name);
         this.active = true;
         this.inactiveReason = null;
+        this.statusEpoch++;
         // reset mv rewrite cache when it is active again
         CachingMvPlanContextBuilder.getInstance().cacheMaterializedView(this);
     }
@@ -825,6 +830,7 @@ public synchronized void setInactiveAndReason(String reason) {
         LOG.warn("set {} to inactive because of {}", name, reason);
         this.active = false;
         this.inactiveReason = reason;
+        this.statusEpoch++;
         // reset cached variables
         resetMetadataCache();
         // evict mv rewrite cache when it is inactive
@@ -1456,16 +1462,7 @@ private static void removeConnectorRelatedMaterializedView(BaseTableInfo baseTab
                                 Sets.newHashSet(mvId)).build());
     }
 
-    private void onDropImpl(Database db, boolean replay) {
-        MvId mvId = new MvId(db.getId(), getId());
-
-        // remove materialized view metrics from MetricsRepository
-        MaterializedViewMetricsRegistry.getInstance().remove(mvId);
-
-        // 1. Remove from plan cache
-        CachingMvPlanContextBuilder.getInstance().evictMaterializedViewCache(this);
-
-        // 2. Remove from base tables
+    private void unlinkFromBaseTables(MvId mvId) {
         List<BaseTableInfo> baseTableInfos = getBaseTableInfos();
         for (BaseTableInfo baseTableInfo : ListUtils.emptyIfNull(baseTableInfos)) {
             if (!baseTableInfo.isInternalCatalog()) {
@@ -1513,6 +1510,19 @@ private void onDropImpl(Database db, boolean replay) {
                 }
             }
         }
+    }
+
+    private void onDropImpl(Database db, boolean replay) {
+        MvId mvId = new MvId(db.getId(), getId());
+
+        // remove materialized view metrics from MetricsRepository
+        MaterializedViewMetricsRegistry.getInstance().remove(mvId);
+
+        // 1. Remove from plan cache
+        CachingMvPlanContextBuilder.getInstance().evictMaterializedViewCache(this);
+
+        // 2. Remove from base tables
+        unlinkFromBaseTables(mvId);
 
         // 3. Remove relevant tasks
         TaskManager taskManager = GlobalStateMgr.getCurrentState().getTaskManager();
@@ -1663,6 +1673,79 @@ public void fixRelationship() {
         onReload(false, true, false);
     }
 
+    private boolean isInCatalog() {
+        Database db = GlobalStateMgr.getCurrentState().getLocalMetastore().getDb(dbId);
+        return db != null && db.getTable(id) == this;
+    }
+
+    /**
+     * Replay an ACTIVE transition the leader journaled together with the base-table infos it activated
+     * with. The leader only journals ACTIVE once the activation succeeded, so the persisted state is adopted
+     * as is: no define-query re-analysis, which resolved every base table through the connector while the
+     * replay thread held the MV lock, and made a checkpoint image depend on an external catalog being
+     * reachable.
+     *
+     * <p>What {@link #fixRelationship} derives on top -- the analyzed partition exprs, the constraints and
+     * the base tables' links back to this mv -- still needs the connector, so it runs asynchronously, off
+     * the replay thread and outside the caller's lock, like the post-image reload. The mv turns active once
+     * that succeeds. A negative verdict is applied only if no other status change was replayed meanwhile.
+     *
+     * <p>On the checkpoint thread the mv is set active right away and nothing is derived: the image only
+     * keeps the persisted state, and loading it reloads every mv anyway.
+     *
+     * <p>NOTE: caller need to hold the mv write lock; the returned future does not.
+     */
+    public CompletableFuture<?> activateOnReplay(List<BaseTableInfo> journaledBaseTableInfos) {
+        this.baseTableInfos = journaledBaseTableInfos;
+        if (GlobalStateMgr.isCheckpointThread()) {
+            setActive();
+            return CompletableFuture.completedFuture(null);
+        }
+        final long epoch;
+        synchronized (this) {
+            epoch = statusEpoch;
+        }
+        return
```

**File**: `fe/fe-core/src/main/java/com/starrocks/persist/AlterMaterializedViewStatusLog.java` (modified, +17/-1)
```diff
@@ -18,8 +18,11 @@
 package com.starrocks.persist;
 
 import com.google.gson.annotations.SerializedName;
+import com.starrocks.catalog.BaseTableInfo;
 import com.starrocks.common.io.Writable;
 
+import java.util.List;
+
 public class AlterMaterializedViewStatusLog implements Writable {
 
     @SerializedName(value = "dbId")
@@ -30,6 +33,11 @@ public class AlterMaterializedViewStatusLog implements Writable {
     private String status;
     @SerializedName(value = "reason")
     private String reason;
+    // ACTIVE only: the base tables the leader activated the MV with. Replay adopts them instead of
+    // re-analyzing the define query, which would resolve every base table through the connector while
+    // holding the MV lock. Null in entries written by older versions, which replay the old way.
+    @SerializedName(value = "baseTableInfos")
+    private List<BaseTableInfo> baseTableInfos;
 
     public AlterMaterializedViewStatusLog(long dbId, long tableId, String status, String reason) {
         this.dbId = dbId;
@@ -65,4 +73,12 @@ public void setStatus(String status) {
     public String getReason() {
         return reason;
     }
-}
\ No newline at end of file
+
+    public List<BaseTableInfo> getBaseTableInfos() {
+        return baseTableInfos;
+    }
+
+    public void setBaseTableInfos(List<BaseTableInfo> baseTableInfos) {
+        this.baseTableInfos = baseTableInfos;
+    }
+}
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/CachingMvPlanContextBuilder.java` (modified, +3/-1)
```diff
@@ -587,8 +587,9 @@ public List<AstKey> getAstsOfRelatedMvs(Set<MaterializedView> relatedMvs) {
      * Submit an async task to be executed in MV plan cache executor.
      * @param taskName: the name of the task.
      * @param task: the task to be executed.
+     * @return the future of the task, completed once the task finishes.
      */
-    public static void submitAsyncTask(String taskName, Supplier<Void> task) {
+    public static CompletableFuture<?> submitAsyncTask(String taskName, Supplier<Void> task) {
         CompletableFuture<?> future = CompletableFuture.supplyAsync(task, MV_PLAN_CACHE_EXECUTOR);
         long startTime = System.currentTimeMillis();
         future.whenComplete((result, e) -> {
@@ -599,6 +600,7 @@ public static void submitAsyncTask(String taskName, Supplier<Void> task) {
                 LOG.warn("async task {} failed: {}, cost: {}ms", taskName, e.getMessage(), duration, e);
             }
         });
+        return future;
     }
 
     public static String getMVPlanCacheStats() {
```

**File**: `fe/fe-core/src/test/java/com/starrocks/alter/AlterMVReplayActivateTest.java` (added, +401/-0)
```diff
@@ -0,0 +1,401 @@
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
+package com.starrocks.alter;
+
+import com.google.common.collect.Lists;
+import com.starrocks.catalog.BaseTableInfo;
+import com.starrocks.catalog.MaterializedView;
+import com.starrocks.catalog.Table;
+import com.starrocks.common.util.concurrent.lock.LockHoldDepth;
+import com.starrocks.connector.ConnectorMetadata;
+import com.starrocks.connector.MockedMetadataMgr;
+import com.starrocks.connector.hive.MockedHiveMetadata;
+import com.starrocks.persist.AlterMaterializedViewStatusLog;
+import com.starrocks.persist.EditLog;
+import com.starrocks.persist.gson.GsonUtils;
+import com.starrocks.qe.ConnectContext;
+import com.starrocks.server.GlobalStateMgr;
+import com.starrocks.sql.ast.AlterMaterializedViewStatusClause;
+import com.starrocks.sql.optimizer.rule.transformation.materialization.MVTestBase;
+import com.starrocks.sql.plan.ConnectorPlanTestBase;
+import org.awaitility.Awaitility;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Assertions;
+import org.junit.jupiter.api.BeforeAll;
+import org.junit.jupiter.api.Test;
+import org.mockito.ArgumentCaptor;
+
+import java.lang.reflect.Field;
+import java.util.List;
+import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicInteger;
+
+import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.Mockito.spy;
+import static org.mockito.Mockito.verify;
+
+/**
+ * Replaying ALTER MATERIALIZED VIEW ... ACTIVE used to re-analyze the whole define query while holding the
+ * MV write lock, resolving every base table through the connector. On a follower that is a connector round
+ * trip under the lock per replayed entry; on the checkpoint thread it made the image depend on an external
+ * catalog being reachable, and in lock_blocking_call_validation_mode=error the gate throws inside the
+ * re-analysis, so the image recorded the MV inactive while the leader had it active.
+ *
+ * <p>The leader now journals the base tables it activated with, and replay adopts them. The part of the
+ * rebuild that still needs the connector runs asynchronously, outside the lock.
+ */
+public class AlterMVReplayActivateTest extends MVTestBase {
+
+    private static final String BASE_TABLE = "t_replay_activate_base";
+    private static final String HIVE_MV_DEFINITION = "PARTITION BY (`l_shipdate`)\n"
+            + "DISTRIBUTED BY RANDOM\n"
+            + "REFRESH DEFERRED MANUAL\n"
+            + "AS SELECT l_orderkey, l_suppkey, l_shipdate FROM hive0.partitioned_db.lineitem_par;";
+
+    private LockProbeHiveMetadata probe;
+    private ConnectorMetadata originalHiveMetadata;
+
+    @BeforeAll
+    public static void beforeClass() throws Exception {
+        MVTestBase.beforeClass();
+        ConnectorPlanTestBase.mockHiveCatalog(connectContext);
+        starRocksAssert.withTable("CREATE TABLE " + BASE_TABLE + " (\n"
+                + "  k1 date,\n"
+                + "  k2 int,\n"
+                + "  v1 int\n"
+                + ") DUPLICATE KEY(k1)\n"
+                + "DISTRIBUTED BY HASH(k1) BUCKETS 3\n"
+                + "PROPERTIES ('replication_num' = '1');");
+    }
+
+    /**
+     * Samples {@link LockHoldDepth#isUnderLock()} on getTable, OR-accumulated, for calls made on the thread
+     * that installed it only: creating an MV hands its definition to the mv-plan-cache executor, which
+     * resolves the same hive table at an arbitrary moment on a thread whose lock state is unrelated.
+     * The asynchronous rebuild of a replayed activation can instead be parked on {@link #gate}.
+     */
+    private static class LockProbeHiveMetadata extends MockedHiveMetadata {
+        private final Thread owner = Thread.currentThread();
+        private final AtomicBoolean underLock = new AtomicBoolean(false);
+        private final AtomicInteger calls = new AtomicInteger();
+        // The same, for the calls made by the asynchronous rebuild of a replayed activation.
+        private final AtomicBoolean rebuildUnderLock = new AtomicBoolean(false);
+        private final AtomicInteger rebuildCalls = new AtomicInteger();
+        private volatile CountDownLatch gate;
+        private final CountDownLatch gateEntered = new CountDownLatch(
```

---

### Incident Patch 5: `46f4a778` (2026-10-05)
**Commit Message**: [BugFix] Keep MV refresh change detection, plan build and partition add off connector I/O under FE metadata locks (#79971)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/MaterializedView.java` (modified, +5/-0)
```diff
@@ -2408,6 +2408,11 @@ public void inferDistribution(DistributionInfo info) throws DdlException {
 
             int inferredBucketNum = 0;
             for (BaseTableInfo base : getBaseTableInfos()) {
+                // Only native base tables contribute a bucket number. Resolving an external one would be a
+                // connector round trip, made under the lock the partition-adding caller holds, for nothing.
+                if (!base.isInternalCatalog()) {
+                    continue;
+                }
                 Optional<Table> optTable = MvUtils.getTable(base);
                 if (optTable.isEmpty()) {
                     continue;
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/MvRefreshArbiter.java` (modified, +22/-0)
```diff
@@ -14,6 +14,7 @@
 
 package com.starrocks.catalog;
 
+import com.google.common.collect.Maps;
 import com.starrocks.catalog.mv.MVTimelinessArbiter;
 import com.starrocks.catalog.mv.MVTimelinessListPartitionArbiter;
 import com.starrocks.catalog.mv.MVTimelinessNonPartitionArbiter;
@@ -257,4 +258,25 @@ public static boolean hasDeletedPartitions(MaterializedView mv, BaseTableInfo ba
 
         return false;
     }
+
+    /** Whether the mv holds a refreshed partition version for any partition of {@code table}. */
+    public static boolean tracksPartitionVersions(MaterializedView mv, Table table) {
+        return !MapUtils.isEmpty(getTrackedPartitionVersions(mv, table));
+    }
+
+    /** Olap base tables are tracked in a table-id keyed map, external ones in a {@link BaseTableInfo} keyed map. */
+    private static Map<String, MaterializedView.BasePartitionInfo> getTrackedPartitionVersions(
+            MaterializedView mv, Table table) {
+        MaterializedView.AsyncRefreshContext context = mv.getRefreshScheme().getAsyncRefreshContext();
+        if (table.isNativeTableOrMaterializedView()) {
+            return context.getBaseTableVisibleVersionMap().getOrDefault(table.getId(), Maps.newHashMap());
+        }
+        // matchTable compares the whole identity; an identifier alone repeats across catalogs and databases and would
+        // hand back another table's version map.
+        return mv.getBaseTableInfos().stream()
+                .filter(info -> info.matchTable(table))
+                .findFirst()
+                .map(context::getBaseTableRefreshInfo)
+                .orElseGet(Maps::newHashMap);
+    }
 }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/ConnectorPartitionTraits.java` (modified, +5/-1)
```diff
@@ -148,7 +148,11 @@ public static ConnectorPartitionTraits build(Table table, TvrVersionRange pinned
         return traits;
     }
 
-    private static ConnectorPartitionTraits buildWithoutCache(Table table) {
+    /**
+     * Build the partition traits for the table without the query-context cache wrapper, whatever the current
+     * thread's context.
+     */
+    public static ConnectorPartitionTraits buildWithoutCache(Table table) {
         ConnectorPartitionTraits res = build(table.getType());
         res.table = table;
         return res;
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/partitiontraits/DefaultTraits.java` (modified, +30/-0)
```diff
@@ -100,6 +100,18 @@ public List<Column> getPartitionColumns() {
 
     @Override
     public Map<String, PartitionInfo> getPartitionNameWithPartitionInfo() {
+        Map<String, PartitionInfo> prefetched = PrefetchedPartitionInfos.lookup(this);
+        if (prefetched != null) {
+            return prefetched;
+        }
+        return fetchPartitionNameWithPartitionInfo();
+    }
+
+    /**
+     * The connector round trip behind {@link #getPartitionNameWithPartitionInfo()}, bypassing any
+     * {@link PrefetchedPartitionInfos} scope.
+     */
+    Map<String, PartitionInfo> fetchPartitionNameWithPartitionInfo() {
         Map<String, PartitionInfo> partitionNameWithPartition = Maps.newHashMap();
         List<String> partitionNames = getPartitionNames();
         List<PartitionInfo> partitions = getPartitions(partitionNames);
@@ -126,6 +138,24 @@ public Optional<Long> maxPartitionRefreshTs() {
         throw new NotImplementedException("Not support maxPartitionRefreshTs");
     }
 
+    /**
+     * Which snapshot of the table {@link #getPartitionNameWithPartitionInfo()} reads, beyond the table's own
+     * identity. It is part of the {@link PrefetchedPartitionInfos} key, so it must cover every input of the fetch
+     * that can differ between two traits of equal tables. The default is the pinned range: an unpinned fetch
+     * reads the live table by name.
+     */
+    protected Object partitionInfoSnapshot() {
+        return pinnedVersionRange;
+    }
+
+    /**
+     * Whether {@link #getUpdatedPartitionNames(List, MaterializedView.AsyncRefreshContext)} reads the partition
+     * infos. Traits that do not track partition updates answer without any connector call.
+     */
+    public boolean readsPartitionInfoToDetectUpdates() {
+        return true;
+    }
+
     @Override
     public Set<String> getUpdatedPartitionNames(List<BaseTableInfo> baseTables,
                                                 MaterializedView.AsyncRefreshContext context) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/partitiontraits/DeltaLakePartitionTraits.java` (modified, +5/-0)
```diff
@@ -35,6 +35,11 @@ public boolean isSupportPCTRefresh() {
         return false;
     }
 
+    @Override
+    public boolean readsPartitionInfoToDetectUpdates() {
+        return false;
+    }
+
     @Override
     public Set<String> getUpdatedPartitionNames(List<BaseTableInfo> baseTables,
                                                 MaterializedView.AsyncRefreshContext context) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/partitiontraits/HudiPartitionTraits.java` (modified, +5/-0)
```diff
@@ -38,6 +38,11 @@ public String getTableName() {
         return table.getCatalogTableName();
     }
 
+    @Override
+    public boolean readsPartitionInfoToDetectUpdates() {
+        return false;
+    }
+
     @Override
     public Set<String> getUpdatedPartitionNames(List<BaseTableInfo> baseTables,
                                                 MaterializedView.AsyncRefreshContext context) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/partitiontraits/IcebergPartitionTraits.java` (modified, +21/-8)
```diff
@@ -22,6 +22,7 @@
 import com.starrocks.catalog.PartitionKey;
 import com.starrocks.common.AnalysisException;
 import com.starrocks.common.tvr.TvrTableSnapshot;
+import com.starrocks.common.tvr.TvrVersionRange;
 import com.starrocks.connector.ConnectorMetadataRequestContext;
 import com.starrocks.connector.PartitionInfo;
 import com.starrocks.connector.iceberg.IcebergPartitionUtils;
@@ -139,20 +140,32 @@ public List<String> getPartitionNames() {
             return Lists.newArrayList(table.getName());
         }
 
-        IcebergTable icebergTable = (IcebergTable) table;
         ConnectorMetadataRequestContext requestContext = new ConnectorMetadataRequestContext();
         requestContext.setQueryMVRewrite(isQueryMVRewrite());
-        if (pinnedVersionRange != null) {
-            requestContext.setTableVersionRange(pinnedVersionRange);
-        } else {
-            Optional<Long> snapshotId = Optional.ofNullable(icebergTable.getNativeTable().currentSnapshot())
-                    .map(Snapshot::snapshotId);
-            requestContext.setTableVersionRange(TvrTableSnapshot.of(snapshotId));
-        }
+        requestContext.setTableVersionRange(readVersionRange());
         return GlobalStateMgr.getCurrentState().getMetadataMgr().listPartitionNames(
                 table.getCatalogName(), getCatalogDBName(), getTableName(), requestContext);
     }
 
+    /** The pinned range, else the snapshot this table object is at: an unpinned read follows the object. */
+    private TvrVersionRange readVersionRange() {
+        if (pinnedVersionRange != null) {
+            return pinnedVersionRange;
+        }
+        Optional<Long> snapshotId = Optional.ofNullable(((IcebergTable) table).getNativeTable().currentSnapshot())
+                .map(Snapshot::snapshotId);
+        return TvrTableSnapshot.of(snapshotId);
+    }
+
+    /**
+     * Two equal Iceberg tables can sit at different snapshots: the refresh re-resolves the live table under its
+     * lock, which may be newer than the one prefetched. Key on the snapshot actually read.
+     */
+    @Override
+    protected Object partitionInfoSnapshot() {
+        return readVersionRange();
+    }
+
     @Override
     public PartitionKey createPartitionKey(List<String> partitionValues, List<Column> partitionColumns)
             throws AnalysisException {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/connector/partitiontraits/KuduPartitionTraits.java` (modified, +5/-0)
```diff
@@ -33,6 +33,11 @@ public PartitionKey createEmptyKey() {
         return new KuduPartitionKey();
     }
 
+    @Override
+    public boolean readsPartitionInfoToDetectUpdates() {
+        return false;
+    }
+
     @Override
     public Set<String> getUpdatedPartitionNames(List<BaseTableInfo> baseTables,
                                                 MaterializedView.AsyncRefreshContext context) {
```

---

### Incident Patch 6: `51d6b708` (2026-10-05)
**Commit Message**: [BugFix] Keep Spark load ETL clean-up and ALTER MV retention analysis off FE metadata locks (#79970)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/alter/AlterMVJobExecutor.java` (modified, +12/-1)
```diff
@@ -588,6 +588,7 @@ private void alterSessionVariables(Map<String, String> properties,
     private ParseNode preResolvedDefineQueryAst;
     private String preResolvedDefineSql;
     private Boolean preResolvedHasNonNativeBaseTable;
+    private MaterializedView.PreResolvedRefBaseTables preResolvedRefBaseTables;
 
     /**
      * Everything ALTER MATERIALIZED VIEW used to resolve while holding the MV's write lock.
@@ -617,6 +618,13 @@ protected void resolveBeforeLock(AlterClause alterClause, ConnectContext context
             if (properties.containsKey(PropertyAnalyzer.PROPERTIES_FOREIGN_KEY_CONSTRAINT)) {
                 alterForeignKeyConstraint(properties, preResolvedPropClone, mv, preResolvedAppliers);
             }
+            if (properties.containsKey(PropertyAnalyzer.PROPERTIES_PARTITION_RETENTION_CONDITION)) {
+                // Analyzing the condition re-gets the external ref base table (iceberg / delta lake) from its
+                // connector, from several places (partition-expr adjust map, partition selector, the MV's
+                // retention analysis). Only the lookups move here; the analysis itself stays under the lock.
+                // No "still current" check is owed: the lock never covers external tables.
+                preResolvedRefBaseTables = mv.preResolveRefBaseTables();
+            }
         } else if (alterClause instanceof RefreshSchemeClause) {
             // Mirrors the condition in visitRefreshSchemeClause exactly. Resolving unconditionally
             // would change behaviour rather than just its timing: getTableChecked throws when a base
@@ -683,7 +691,10 @@ public Void visitModifyTablePropertiesClause(ModifyTablePropertiesClause modifyT
             alterPartitionTTL(properties, materializedView, tableProperty, appliers);
         }
         if (properties.containsKey(PropertyAnalyzer.PROPERTIES_PARTITION_RETENTION_CONDITION)) {
-            alterPartitionRetentionCondition(properties, materializedView, tableProperty, appliers, context);
+            try (MaterializedView.PreResolvedRefBaseTables.Scope ignored =
+                         preResolvedRefBaseTables != null ? preResolvedRefBaseTables.enter() : null) {
+                alterPartitionRetentionCondition(properties, materializedView, tableProperty, appliers, context);
+            }
         }
         if (properties.containsKey(PropertyAnalyzer.PROPERTIES_TIME_DRIFT_CONSTRAINT)) {
             alterTimeDriftConstraint(properties, materializedView, tableProperty, appliers);
```

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/MaterializedView.java` (modified, +81/-1)
```diff
@@ -2674,11 +2674,89 @@ public synchronized void analyzeAndSetMVRetentionCondition(ConnectContext connec
                 connectContext, this, refBaseTable, this.retentionConditionExprOpt);
     }
 
+    /**
+     * The outcome of re-getting one external ref base table ahead of time: the table (empty when it is not
+     * found), or the failure the lookup threw.
+     */
+    private record RefreshedBaseTable(Optional<Table> table, RuntimeException failure) {
+        Optional<Table> get() {
+            if (failure != null) {
+                throw failure;
+            }
+            return table;
+        }
+    }
+
+    /**
+     * External ref base tables re-got ahead of time, consulted by {@link #refreshBaseTable} on this thread only.
+     * Set by {@link PreResolvedRefBaseTables#enter()}.
+     */
+    private static final ThreadLocal<Map<BaseTableInfo, RefreshedBaseTable>> PRE_RESOLVED_REF_BASE_TABLES =
+            new ThreadLocal<>();
+
+    /**
+     * Re-gets every external ref base table that {@link #refreshBaseTable} would re-get, so a caller about
+     * to take a metadata lock can make the connector round trips first and then run the analysis under the
+     * lock inside {@link PreResolvedRefBaseTables#enter()}.
+     *
+     * <p>A failed lookup is kept, not thrown: refreshBaseTable rethrows it where the original lookup would
+     * have thrown, so errors surface at the same point and in the same order as without pre-resolving.
+     */
+    public PreResolvedRefBaseTables preResolveRefBaseTables() {
+        Map<BaseTableInfo, RefreshedBaseTable> resolved = Maps.newHashMap();
+        List<Optional<? extends Map<Table, ?>>> refMaps =
+                List.of(refBaseTablePartitionExprsOpt, refBaseTablePartitionSlotsOpt, refBaseTablePartitionColumnsOpt);
+        for (Optional<? extends Map<Table, ?>> refMap : refMaps) {
+            for (Table table : refMap.map(Map::keySet).orElse(Set.of())) {
+                BaseTableInfo baseTableInfo = tableToBaseTableInfoCache.get(table);
+                if (!(table instanceof IcebergTable || table instanceof DeltaLakeTable)
+                        || baseTableInfo == null || resolved.containsKey(baseTableInfo)) {
+                    continue;
+                }
+                try {
+                    resolved.put(baseTableInfo, new RefreshedBaseTable(MvUtils.getTable(baseTableInfo), null));
+                } catch (RuntimeException e) {
+                    resolved.put(baseTableInfo, new RefreshedBaseTable(null, e));
+                }
+            }
+        }
+        return new PreResolvedRefBaseTables(resolved);
+    }
+
+    public static final class PreResolvedRefBaseTables {
+        private final Map<BaseTableInfo, RefreshedBaseTable> tables;
+
+        private PreResolvedRefBaseTables(Map<BaseTableInfo, RefreshedBaseTable> tables) {
+            this.tables = tables;
+        }
+
+        /**
+         * Makes refreshBaseTable on the current thread use these tables until the returned scope is closed.
+         */
+        public Scope enter() {
+            Map<BaseTableInfo, RefreshedBaseTable> previous = PRE_RESOLVED_REF_BASE_TABLES.get();
+            PRE_RESOLVED_REF_BASE_TABLES.set(tables);
+            return () -> {
+                if (previous == null) {
+                    PRE_RESOLVED_REF_BASE_TABLES.remove();
+                } else {
+                    PRE_RESOLVED_REF_BASE_TABLES.set(previous);
+                }
+            };
+        }
+
+        public interface Scope extends AutoCloseable {
+            @Override
+            void close();
+        }
+    }
+
     /**
      * Since the table is cached in the Optional, needs to refresh it again for each query.
      */
     private <K> Map<Table, K> refreshBaseTable(Map<Table, K> cached) {
         Map<Table, K> result = Maps.newHashMap();
+        Map<BaseTableInfo, RefreshedBaseTable> preResolved = PRE_RESOLVED_REF_BASE_TABLES.get();
         for (Map.Entry<Table, K> e : cached.entrySet()) {
             Table table = e.getKey();
             if (table instanceof IcebergTable || table instanceof DeltaLakeTable) {
@@ -2688,7 +2766,9 @@ private <K> Map<Table, K> refreshBaseTable(Map<Table, K> cached) {
                 // the newest table info.
                 // NOTE: use getTable rather getTableChecked to avoid throwing exception when table has changed/recreated.
                 // If the table has changed, MVPCTMetaRepairer will handle it rather than throwing exception here.
-                Optional<Table> refreshedTableOpt = MvUtils.getTable(tableToBaseTableInfoCache.get(table));
+                BaseTableInfo baseTableInfo = tableToBaseTableInfoCache.get(table);
+                RefreshedBaseTable refreshed = preResolved == null ? null : preResolved.get(baseTableInfo);
+                Optional<Table> refreshedTableOpt = refreshed != null ? refreshed.get() : MvUtils.getTable(baseTableInfo);
                 // when meets a table that has been drop
```

**File**: `fe/fe-core/src/main/java/com/starrocks/load/loadv2/SparkLoadJob.java` (modified, +66/-8)
```diff
@@ -62,6 +62,7 @@
 import com.starrocks.common.MetaNotFoundException;
 import com.starrocks.common.Pair;
 import com.starrocks.common.StarRocksException;
+import com.starrocks.common.ThreadPoolManager;
 import com.starrocks.common.util.LogBuilder;
 import com.starrocks.common.util.LogKey;
 import com.starrocks.common.util.concurrent.lock.LockType;
@@ -132,6 +133,8 @@
 import java.util.List;
 import java.util.Map;
 import java.util.Set;
+import java.util.concurrent.RejectedExecutionException;
+import java.util.concurrent.ThreadPoolExecutor;
 
 import static com.starrocks.catalog.Replica.ReplicaState.NORMAL;
 
@@ -145,6 +148,32 @@
 public class SparkLoadJob extends BulkLoadJob {
     private static final Logger LOG = LogManager.getLogger(SparkLoadJob.class);
 
+    /**
+     * Deletes the ETL output (the job's temporary directory on the remote storage) of finished jobs.
+     *
+     * <p>Why: afterVisible() runs inside DatabaseTransactionMgr.finishTransaction's critical section (table
+     * locks + txn state lock). It used to delete the output synchronously there, so one broker / HDFS round
+     * trip -- up to broker_client_timeout_ms (120s by default) when the remote side hangs -- stalled every
+     * publish and every reader waiting on those tables. The deletion was already best-effort: a failure was
+     * only logged and never retried.
+     *
+     * <p>Why one thread and an unbounded queue: one small task is queued per finished job, and each delete is
+     * bounded by the broker / HDFS client timeout, so the queue only backs up while the remote storage is
+     * unreachable. A bounded queue would have to either drop deletions (leaking the directories for good) or
+     * block the submitter -- back inside the lock, which is what this executor exists to avoid.
+     *
+     * <p>Why this is no worse than before: the same deletions run, in the same order, with the same
+     * log-and-forget failure handling; only the thread changes. Worst case: while the remote storage is down
+     * the pending deletions pile up on the heap (a few strings each; a warn is logged past
+     * {@link #ETL_OUTPUT_CLEANER_BACKLOG_WARN_THRESHOLD}) and each fails after its timeout; the ones still
+     * queued when the FE restarts or loses leadership are not run, which leaves those ETL directories behind.
+     * The synchronous code never persisted or retried the clean-up either, so a failed or interrupted delete
+     * left the directory behind before as well.
+     */
+    private static final ThreadPoolExecutor ETL_OUTPUT_CLEANER =
+            ThreadPoolManager.newDaemonFixedThreadPoolWithUnboundedQueue(1, "spark-load-etl-output-cleaner", false);
+    private static final int ETL_OUTPUT_CLEANER_BACKLOG_WARN_THRESHOLD = 1000;
+
     // --- members below need persist ---
     // create from resourceDesc when job created
     @SerializedName("spkr")
@@ -797,6 +826,14 @@ private void tryCommitJob() throws StarRocksException {
      * 2. clear push tasks and infos that not persist
      */
     private void clearJob() {
+        clearJob(false);
+    }
+
+    /**
+     * @param deleteEtlOutputAsync delete the etl output on {@link #ETL_OUTPUT_CLEANER} instead of the caller's
+     *                             thread, for callers inside a metadata critical section
+     */
+    private void clearJob(boolean deleteEtlOutputAsync) {
         Preconditions.checkState(state == JobState.FINISHED || state == JobState.CANCELLED);
 
         LOG.debug("kill etl job and delete etl files. id: {}, state: {}", id, state);
@@ -811,13 +848,33 @@ private void clearJob() {
             }
         }
         if (!Strings.isNullOrEmpty(etlOutputPath)) {
-            try {
-                // delete label dir, remove the last taskId dir
-                String outputPath = etlOutputPath.substring(0, etlOutputPath.lastIndexOf("/"));
-                handler.deleteEtlOutputPath(outputPath,
-                        new BrokerDesc(brokerPersistInfo.getName(), brokerPersistInfo.getProperties()));
-            } catch (Exception e) {
-                LOG.warn("delete etl files failed. id: {}, state: {}", id, state, e);
+            // capture on the caller's thread, the async task must not read the job's fields
+            String jobEtlOutputPath = etlOutputPath;
+            BrokerPropertiesPersistInfo jobBrokerPersistInfo = brokerPersistInfo;
+            JobState jobState = state;
+            Runnable deleteEtlOutput = () -> {
+                try {
+                    // delete label dir, remove the last taskId dir
+                    String outputPath = jobEtlOutputPath.substring(0, jobEtlOutputPath.lastIndexOf("/"));
+                    handler.deleteEtlOutputPath(outputPath,
+                            new BrokerDesc(jobBrokerPersistInfo.getName(), jobBrokerPersistInfo.getProperties()));
+                } catch (Exception e) {
+                    LOG.warn("delete etl files failed. id: {}, state: {}", id, jobState, e);
+     
```

**File**: `fe/fe-core/src/test/java/com/starrocks/load/loadv2/SparkLoadJobTest.java` (modified, +52/-0)
```diff
@@ -57,6 +57,10 @@
 import com.starrocks.common.MetaNotFoundException;
 import com.starrocks.common.Pair;
 import com.starrocks.common.jmockit.Deencapsulation;
+import com.starrocks.common.util.concurrent.lock.LockHoldDepth;
+import com.starrocks.common.util.concurrent.lock.LockManager;
+import com.starrocks.common.util.concurrent.lock.LockType;
+import com.starrocks.common.util.concurrent.lock.Locker;
 import com.starrocks.lake.LakeTable;
 import com.starrocks.lake.LakeTablet;
 import com.starrocks.load.EtlJobType;
@@ -85,6 +89,8 @@
 import com.starrocks.warehouse.cngroup.ComputeResource;
 import mockit.Expectations;
 import mockit.Injectable;
+import mockit.Mock;
+import mockit.MockUp;
 import mockit.Mocked;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeEach;
@@ -93,6 +99,9 @@
 import java.util.List;
 import java.util.Map;
 import java.util.Set;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.atomic.AtomicBoolean;
 
 import static org.junit.jupiter.api.Assertions.assertThrows;
 
@@ -626,4 +635,47 @@ public void testNoPartitionsHaveDataLoad(@Mocked GlobalStateMgr globalStateMgr,
         ExceptionChecker.expectThrowsWithMsg(LoadException.class, "No rows were imported from upstream",
                 () -> Deencapsulation.invoke(job, "submitPushTasks"));
     }
+
+    @Test
+    public void testAfterVisibleDeletesEtlOutputOutsideThePublishLock(@Mocked GlobalStateMgr globalStateMgr,
+                                                                      @Injectable String originStmt,
+                                                                      @Injectable Database db) throws Exception {
+        // afterVisible() runs inside DatabaseTransactionMgr.finishTransaction's critical section, and the ETL
+        // output deletion is a broker/HDFS round trip. Sample the lock depth where the real transport would be
+        // contacted. OR-accumulated so a later lock-free call cannot erase a locked one.
+        AtomicBoolean deletedUnderLock = new AtomicBoolean(false);
+        CountDownLatch deleted = new CountDownLatch(1);
+        new MockUp<SparkEtlJobHandler>() {
+            @Mock
+            public void deleteEtlOutputPath(String outputPath, BrokerDesc brokerDesc) {
+                deletedUnderLock.compareAndSet(false, LockHoldDepth.isUnderLock());
+                deleted.countDown();
+            }
+        };
+        LockManager lockManager = new LockManager();
+        new Expectations() {
+            {
+                globalStateMgr.getLockManager();
+                result = lockManager;
+                globalStateMgr.getLocalMetastore().getDb(dbId);
+                result = db;
+            }
+        };
+
+        SparkLoadJob job = getEtlStateJob(originStmt);
+        job.state = JobState.LOADING;
+        Locker locker = new Locker();
+        locker.lock(dbId, LockType.WRITE);
+        try {
+            job.afterVisible(new TransactionState());
+        } finally {
+            locker.release(dbId, LockType.WRITE);
+        }
+
+        Assertions.assertEquals(JobState.FINISHED, job.getState());
+        Assertions.assertTrue(deleted.await(30, TimeUnit.SECONDS),
+                "the etl output was never deleted, so the check below is vacuous");
+        Assertions.assertFalse(deletedUnderLock.get(),
+                "SparkLoadJob.afterVisible deleted the etl output while holding an FE metadata lock");
+    }
 }
```

**File**: `fe/fe-core/src/test/java/com/starrocks/scheduler/PartitionBasedMvRefreshProcessorIcebergTest.java` (modified, +58/-0)
```diff
@@ -19,6 +19,7 @@
 import com.google.common.collect.ImmutableMap;
 import com.google.common.collect.ImmutableSet;
 import com.google.common.collect.Lists;
+import com.starrocks.catalog.BaseTableInfo;
 import com.starrocks.catalog.Database;
 import com.starrocks.catalog.MaterializedView;
 import com.starrocks.catalog.Partition;
@@ -27,17 +28,20 @@
 import com.starrocks.common.Config;
 import com.starrocks.common.FeConstants;
 import com.starrocks.common.util.RuntimeProfile;
+import com.starrocks.common.util.concurrent.lock.LockHoldDepth;
 import com.starrocks.connector.iceberg.MockIcebergMetadata;
 import com.starrocks.scheduler.mv.pct.MVPCTRefreshProcessor;
 import com.starrocks.server.GlobalStateMgr;
 import com.starrocks.server.MetadataMgr;
 import com.starrocks.sql.common.QueryDebugOptions;
 import com.starrocks.sql.optimizer.QueryMaterializationContext;
 import com.starrocks.sql.optimizer.rule.transformation.materialization.MVTestBase;
+import com.starrocks.sql.optimizer.rule.transformation.materialization.MvUtils;
 import com.starrocks.sql.plan.ConnectorPlanTestBase;
 import com.starrocks.sql.plan.ExecPlan;
 import com.starrocks.sql.plan.PlanTestBase;
 import com.starrocks.utframe.UtFrameUtils;
+import mockit.Invocation;
 import mockit.Mock;
 import mockit.MockUp;
 import org.junit.jupiter.api.Assertions;
@@ -50,7 +54,10 @@
 import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
+import java.util.Optional;
 import java.util.Set;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicInteger;
 import java.util.stream.Collectors;
 
 @TestMethodOrder(MethodName.class)
@@ -709,4 +716,55 @@ public void testRefreshMvWithIcebergPartitionEvolution() throws Exception {
 
         starRocksAssert.dropMaterializedView(mvName);
     }
+
+    /**
+     * ALTER MATERIALIZED VIEW ... SET ("partition_retention_condition" = ...) runs under the MV's write lock,
+     * and analyzing the condition re-gets the external ref base table from its connector -- an HMS / REST
+     * round trip for iceberg. The lookups have to happen before the lock. A list-partitioned MV is used so
+     * that every lookup site is exercised (partition-expr adjust map, partition selector, retention analysis).
+     * Sampled where the real connector would be contacted, confined to the test thread: the async MV plan
+     * cache resolves the same table from its own executor.
+     */
+    @Test
+    public void testAlterMVRetentionConditionResolvesIcebergBaseTableOutsideTheLock() throws Exception {
+        String mvName = "iceberg_retention_lock_mv";
+        starRocksAssert.withMaterializedView("CREATE MATERIALIZED VIEW `test`.`" + mvName + "`\n" +
+                "PARTITION BY (id, data, date_trunc('day', ts))\n" +
+                "DISTRIBUTED BY HASH(`id`) BUCKETS 10\n" +
+                "REFRESH DEFERRED MANUAL\n" +
+                "PROPERTIES (\n" +
+                "\"replication_num\" = \"1\"\n" +
+                ")\n" +
+                "AS SELECT id, data, ts  FROM `iceberg0`.`partitioned_transforms_db`.`t0_multi_day_tz` as a;");
+        Thread testThread = Thread.currentThread();
+        AtomicInteger calls = new AtomicInteger();
+        AtomicBoolean resolvedUnderLock = new AtomicBoolean(false);
+        new MockUp<MvUtils>() {
+            @Mock
+            public Optional<Table> getTable(Invocation invocation, BaseTableInfo baseTableInfo) {
+                if (Thread.currentThread() == testThread) {
+                    calls.incrementAndGet();
+                    // OR-accumulated: a later lock-free lookup must not erase a locked one
+                    resolvedUnderLock.compareAndSet(false, LockHoldDepth.isUnderLock());
+                }
+                return invocation.proceed(baseTableInfo);
+            }
+        };
+        try {
+            starRocksAssert.alterMvProperties(String.format("alter materialized view %s set (" +
+                    "\"partition_retention_condition\" = \"date_trunc('day', ts) >= current_date() - interval 1 year\")",
+                    mvName));
+
+            MaterializedView mv = (MaterializedView) GlobalStateMgr.getCurrentState().getLocalMetastore()
+                    .getTable("test", mvName);
+            Assertions.assertEquals("date_trunc('day', ts) >= current_date() - interval 1 year",
+                    mv.getTableProperty().getPartitionRetentionCondition());
+            Assertions.assertTrue(mv.getRetentionConditionExpr().isPresent());
+            Assertions.assertTrue(calls.get() > 0, "the iceberg base table was never re-got, so the check below is vacuous");
+            Assertions.assertFalse(resolvedUnderLock.get(),
+                    "ALTER MV SET partition_retention_condition re-got the iceberg base table under the MV's lock");
+        } finally {
+            starRocksAssert.dropMaterializedView(mvName);
+        }
+    }
 }
```

---

### Incident Patch 7: `2cfaab40` (2026-10-05)
**Commit Message**: [BugFix] Move remaining remote I/O out of FE metadata locks found by the dynamic lock test (#79969)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/catalog/system/sys/SysObjectDependencies.java` (modified, +25/-7)
```diff
@@ -40,7 +40,9 @@
 import org.apache.logging.log4j.LogManager;
 import org.apache.logging.log4j.Logger;
 
+import java.util.ArrayList;
 import java.util.Collection;
+import java.util.List;
 import java.util.Optional;
 
 public class SysObjectDependencies {
@@ -75,6 +77,7 @@ public static TObjectDependencyRes listObjectDependencies(TObjectDependencyReq r
 
         // list dependencies of mv
         Locker locker = new Locker();
+        List<ExternalRef> externalRefs = new ArrayList<>();
         Collection<Database> dbs = GlobalStateMgr.getCurrentState().getLocalMetastore().getFullNameToDb().values();
         for (Database db : CollectionUtils.emptyIfNull(dbs)) {
             String catalog = Optional.ofNullable(db.getCatalogName())
@@ -105,14 +108,12 @@ public static TObjectDependencyRes listObjectDependencies(TObjectDependencyReq r
                         item.setRef_object_id(refObj.getTableId());
                         item.setRef_database(refObj.getDbName());
                         item.setRef_catalog(refObj.getCatalogName());
-                        Optional<Table> refTable = MvUtils.getTableWithIdentifier(refObj);
-                        item.setRef_object_type(getRefObjectType(refTable, mv.getName()));
-                        // If the ref table is dropped/swapped/renamed, the actual info would be inconsistent with
-                        // BaseTableInfo, so we use the source-of-truth information
-                        if (refTable.isEmpty()) {
-                            item.setRef_object_name(refObj.getTableName());
+                        // An external base table is resolved through its connector, which the database lock
+                        // does not protect; fill those in once the lock is released.
+                        if (refObj.isInternalCatalog()) {
+                            fillRefObject(item, refObj, mv.getName());
                         } else {
-                            item.setRef_object_name(refTable.get().getName());
+                            externalRefs.add(new ExternalRef(item, refObj, mv.getName()));
                         }
 
                         response.addToItems(item);
@@ -121,11 +122,28 @@ public static TObjectDependencyRes listObjectDependencies(TObjectDependencyReq r
             } finally {
                 locker.unLockDatabase(db.getId(), LockType.READ);
             }
+            externalRefs.forEach(ref -> fillRefObject(ref.item(), ref.refObj(), ref.mvName()));
+            externalRefs.clear();
         }
 
         return response;
     }
 
+    private record ExternalRef(TObjectDependencyItem item, BaseTableInfo refObj, String mvName) {
+    }
+
+    private static void fillRefObject(TObjectDependencyItem item, BaseTableInfo refObj, String mvName) {
+        Optional<Table> refTable = MvUtils.getTableWithIdentifier(refObj);
+        item.setRef_object_type(getRefObjectType(refTable, mvName));
+        // If the ref table is dropped/swapped/renamed, the actual info would be inconsistent with
+        // BaseTableInfo, so we use the source-of-truth information
+        if (refTable.isEmpty()) {
+            item.setRef_object_name(refObj.getTableName());
+        } else {
+            item.setRef_object_name(refTable.get().getName());
+        }
+    }
+
     /**
      * We may not be able to obtain the base table information when external catalog is unavailable
      *
```

**File**: `fe/fe-core/src/main/java/com/starrocks/load/ExportJob.java` (modified, +18/-4)
```diff
@@ -197,6 +197,9 @@ public class ExportJob implements Writable, GsonPostProcessable {
     private ComputeResource computeResource = WarehouseManager.DEFAULT_RESOURCE;
 
     private TupleDescriptor exportTupleDesc;
+    // The sink's file system properties, resolved once before setJob takes the table lock; see
+    // resolveHdfsProperties. Every fragment gets its own copy.
+    private THdfsProperties resolvedHdfsProperties;
     private Table exportTable;
     // when set to true, means this job instance is created by replay thread(FE restarted or master changed)
     private boolean isReplayed = false;
@@ -288,6 +291,9 @@ public void setJob(ExportStmt stmt) throws StarRocksException {
         this.tableName = new TableName(tableRef.getCatalogName(), tableRef.getDbName(),
                 tableRef.getTableName(), tableRef.getPos());
 
+        // For a path whose file system is not cached yet, getTProperties builds it -- a round trip to the
+        // storage, which the table lock below does not protect.
+        resolveHdfsProperties();
         try (AutoCloseableLock ignore = new AutoCloseableLock(new Locker(), db.getId(), Lists.newArrayList(this.tableId),
                 LockType.READ)) {
             genExecFragment(stmt);
@@ -447,6 +453,17 @@ private OlapScanNode genOlapScanNodeByLocation(List<TScanRangeLocations> locatio
                 computeResource);
     }
 
+    private THdfsProperties resolveHdfsProperties() throws StarRocksException {
+        if (resolvedHdfsProperties == null) {
+            THdfsProperties properties = new THdfsProperties();
+            if (!brokerPersistInfo.hasBroker()) {
+                HdfsUtil.getTProperties(exportTempPath, brokerPersistInfo.getProperties(), properties);
+            }
+            resolvedHdfsProperties = properties;
+        }
+        return resolvedHdfsProperties;
+    }
+
     private PlanFragment genPlanFragment(Table.TableType type, ScanNode scanNode, int taskIdx) throws
             StarRocksException {
         PlanFragment fragment = null;
@@ -469,10 +486,7 @@ private PlanFragment genPlanFragment(Table.TableType type, ScanNode scanNode, in
         fragment.setOutputExprs(createOutputExprs());
 
         scanNode.setFragmentId(fragment.getFragmentId());
-        THdfsProperties hdfsProperties = new THdfsProperties();
-        if (!brokerPersistInfo.hasBroker()) {
-            HdfsUtil.getTProperties(exportTempPath, brokerPersistInfo.getProperties(), hdfsProperties);
-        }
+        THdfsProperties hdfsProperties = resolveHdfsProperties().deepCopy();
         BrokerDesc runtimeBrokerDesc = new BrokerDesc(brokerPersistInfo.getName(), brokerPersistInfo.getProperties());
 
         // Extract column names from slot descriptors for CSV header row
```

**File**: `fe/fe-core/src/main/java/com/starrocks/qe/ShowExecutor.java` (modified, +6/-0)
```diff
@@ -495,6 +495,12 @@ public ShowResultSet visitShowMaterializedViewStatement(ShowMaterializedViewsStm
                             AtomicBoolean baseTableHasPrivilege = new AtomicBoolean(true);
                             mvTable.getBaseTableInfos().stream()
                                     .forEach(baseTableInfo -> {
+                                        // Only a native base table is privilege-checked below, and an external
+                                        // catalog has none; resolving one would only contact that catalog with
+                                        // the database lock held.
+                                        if (!baseTableInfo.isInternalCatalog()) {
+                                            return;
+                                        }
                                         // skip if base table not existed
                                         Optional<Table> baseTableOpt = MvUtils.getTable(baseTableInfo);
                                         if (baseTableOpt.isEmpty()) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/StatementPlanner.java` (modified, +38/-16)
```diff
@@ -46,6 +46,7 @@
 import com.starrocks.sql.analyzer.AnalyzerUtils;
 import com.starrocks.sql.analyzer.Authorizer;
 import com.starrocks.sql.analyzer.InsertAnalyzer;
+import com.starrocks.sql.analyzer.PipeAnalyzer;
 import com.starrocks.sql.analyzer.PlannerMetaLocker;
 import com.starrocks.sql.analyzer.QueryAnalyzer;
 import com.starrocks.sql.analyzer.SemanticException;
@@ -62,6 +63,7 @@
 import com.starrocks.sql.ast.TableRef;
 import com.starrocks.sql.ast.UpdateStmt;
 import com.starrocks.sql.ast.ValuesRelation;
+import com.starrocks.sql.ast.pipe.CreatePipeStmt;
 import com.starrocks.sql.common.ErrorType;
 import com.starrocks.sql.common.MetaUtils;
 import com.starrocks.sql.common.StarRocksPlannerException;
@@ -293,22 +295,19 @@ protected static boolean analyzeStatement(StatementBase statement, ConnectContex
                 }
             }
 
-            // CTAS is not an INSERT at plan time: its target table does not exist until execution, so it
-            // cannot use the deferred-lock path above. Its SELECT still needs the same treatment as an
-            // INSERT-SELECT though -- files() schema inference does an object-store LIST plus a BE
-            // get_file_schema RPC, and running that inside the PlannerMetaLock critical section stalls
-            // every db-level DDL behind the database intention lock. Pre-resolve it here; resolveTableRef
-            // reuses the already-built TableFunctionTable once the lock is held.
-            // Unwrap SUBMIT TASK as well: it carries either an INSERT (handled above) or a CTAS.
-            CreateTableAsSelectStmt ctasStmt = null;
-            if (statement instanceof CreateTableAsSelectStmt ctas) {
-                ctasStmt = ctas;
-            } else if (statement instanceof SubmitTaskStmt submitTaskStmt) {
-                ctasStmt = submitTaskStmt.getCreateTableAsSelectStmt();
-            }
-            if (ctasStmt != null && locker != null && !locker.isEmpty()
-                    && !AnalyzerUtils.collectFileTableFunctionRelation(ctasStmt.getQueryStatement()).isEmpty()) {
-                new QueryAnalyzer(session).analyzeFilesOnly(ctasStmt.getQueryStatement());
+            // Statements other than INSERT cannot use the deferred-lock path above, but their files() still
+            // needs the same treatment as an INSERT-SELECT -- files() schema inference does an object-store
+            // LIST plus a BE get_file_schema RPC, and running that inside the PlannerMetaLock critical
+            // section stalls every db-level DDL behind the database intention lock. Pre-resolve it here;
+            // resolveTableRef reuses the already-built TableFunctionTable once the lock is held.
+            QueryStatement filesQuery = queryWithFilesToPreResolve(statement);
+            if (filesQuery != null && locker != null && !locker.isEmpty()
+                    && !AnalyzerUtils.collectFileTableFunctionRelation(filesQuery).isEmpty()) {
+                if (statement instanceof CreatePipeStmt createPipeStmt) {
+                    // Keep the original error order: PipeAnalyzer rejects bad properties before the INSERT.
+                    PipeAnalyzer.analyzeBeforeInsert(createPipeStmt);
+                }
+                new QueryAnalyzer(session).analyzeFilesOnly(filesQuery);
             }
 
             if (deferredLock) {
@@ -336,6 +335,29 @@ protected static boolean analyzeStatement(StatementBase statement, ConnectContex
         }
     }
 
+    /**
+     * The SELECT whose files() the pre-pass in {@link #analyzeStatement} resolves before the lock, for a
+     * statement the INSERT branch there does not cover. A CTAS target does not exist until execution, and
+     * CREATE PIPE analyzes its INSERT from inside PipeAnalyzer, after the lock of the outer statement is
+     * already held -- so neither reaches the deferred-lock path. SUBMIT TASK carries either an INSERT
+     * (handled by that branch) or a CTAS.
+     */
+    private static QueryStatement queryWithFilesToPreResolve(StatementBase statement) {
+        if (statement instanceof QueryStatement queryStatement) {
+            return queryStatement;
+        }
+        if (statement instanceof CreateTableAsSelectStmt ctas) {
+            return ctas.getQueryStatement();
+        }
+        if (statement instanceof SubmitTaskStmt submitTaskStmt && submitTaskStmt.getCreateTableAsSelectStmt() != null) {
+            return submitTaskStmt.getCreateTableAsSelectStmt().getQueryStatement();
+        }
+        if (statement instanceof CreatePipeStmt createPipeStmt && createPipeStmt.getInsertStmt() != null) {
+            return createPipeStmt.getInsertStmt().getQueryStatement();
+        }
+        return null;
+    }
+
     /**
      * The private copies planning will work off, plus the instant they were taken.
      *
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/CreateTableAnalyzer.java` (modified, +9/-3)
```diff
@@ -105,15 +105,21 @@ public static void analyze(CreateTableStmt statement, ConnectContext context) {
         final String tableName = tableRef.getTableName();
         FeNameFormat.checkTableName(tableName);
 
-        Database dbObj = GlobalStateMgr.getCurrentState().getMetadataMgr().getDb(context, catalogName, db);
+        // A CTAS into an external catalog had both answers fetched before the meta lock; see
+        // QueryAnalyzer#analyzeExternalTablesOnly. Anything else, or a miss, asks the catalog here.
+        PreResolvedWriteTargets.CreateTarget preResolved = context.getPreResolvedWriteTargets()
+                .takeCreateTarget(com.starrocks.catalog.TableName.fromTableRef(tableRef));
+        Database dbObj = preResolved != null ? preResolved.db()
+                : GlobalStateMgr.getCurrentState().getMetadataMgr().getDb(context, catalogName, db);
         if (dbObj == null) {
             ErrorReport.reportSemanticException(ErrorCode.ERR_BAD_DB_ERROR, db);
         }
         if (statement instanceof CreateTemporaryTableStmt) {
             analyzeTemporaryTable(statement, context, catalogName, dbObj, tableName);
         } else {
-            if (GlobalStateMgr.getCurrentState().getMetadataMgr()
-                    .tableExists(context, catalogName, db, tableName) && !statement.isSetIfNotExists()) {
+            boolean tableExists = preResolved != null ? preResolved.tableExists()
+                    : GlobalStateMgr.getCurrentState().getMetadataMgr().tableExists(context, catalogName, db, tableName);
+            if (tableExists && !statement.isSetIfNotExists()) {
                 ErrorReport.reportSemanticException(ErrorCode.ERR_TABLE_EXISTS_ERROR, tableName);
             }
         }
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/PipeAnalyzer.java` (modified, +10/-0)
```diff
@@ -90,6 +90,16 @@ public static void analyzePipeName(PipeName pipeName, ConnectContext context) {
         analyzePipeName(pipeName, context.getDatabase());
     }
 
+    /**
+     * The checks {@link #analyze(CreatePipeStmt, ConnectContext)} runs before it analyzes the INSERT, for a
+     * caller that is about to do remote work on the INSERT's behalf first (the files() pre-pass in
+     * StatementPlanner): an invalid statement must still fail on its properties, before touching storage.
+     * Local and idempotent, so running it again in analyze() is harmless.
+     */
+    public static void analyzeBeforeInsert(CreatePipeStmt stmt) {
+        analyzeProperties(stmt.getProperties());
+    }
+
     private static void analyzeProperties(Map<String, String> properties) {
         if (MapUtils.isEmpty(properties)) {
             return;
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/PreResolvedWriteTargets.java` (modified, +26/-1)
```diff
@@ -15,6 +15,7 @@
 package com.starrocks.sql.analyzer;
 
 import com.google.common.collect.Maps;
+import com.starrocks.catalog.Database;
 import com.starrocks.catalog.Table;
 import com.starrocks.catalog.TableName;
 
@@ -43,9 +44,20 @@
  * <p>Entries are handed out at most once and dropped with the statement, like {@link PreResolvedViewBodies}:
  * a statement has one write target, and anything the analyzer did not come to collect must not be offered to
  * the next statement on this connection.
+ *
+ * <p>A CTAS target is the same case one step earlier: the table does not exist yet, so what the locked
+ * {@code CreateTableAnalyzer} asks the external catalog is whether its database exists and whether the table
+ * already does. Those two answers are handed over as a {@link CreateTarget}.
  */
 public class PreResolvedWriteTargets {
+    /**
+     * The database a CTAS creates its table in, and whether that table already existed when it was asked.
+     */
+    public record CreateTarget(Database db, boolean tableExists) {
+    }
+
     private final Map<String, Table> byQualifiedName = Maps.newHashMap();
+    private final Map<String, CreateTarget> createTargets = Maps.newHashMap();
 
     /**
      * @param tableName fully qualified, i.e. already through {@code TableName#normalization}, because that
@@ -65,12 +77,25 @@ public Table take(TableName tableName) {
         return byQualifiedName.remove(key(tableName));
     }
 
+    public void putCreateTarget(TableName tableName, CreateTarget target) {
+        createTargets.put(key(tableName), target);
+    }
+
+    /**
+     * @return what the pre-pass learned about this CTAS target, or null when it did not ask -- the caller then
+     *         asks the catalog itself, as it did before this existed
+     */
+    public CreateTarget takeCreateTarget(TableName tableName) {
+        return createTargets.remove(key(tableName));
+    }
+
     public boolean isEmpty() {
-        return byQualifiedName.isEmpty();
+        return byQualifiedName.isEmpty() && createTargets.isEmpty();
     }
 
     public void clear() {
         byQualifiedName.clear();
+        createTargets.clear();
     }
 
     private static String key(TableName tableName) {
```

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/QueryAnalyzer.java` (modified, +46/-1)
```diff
@@ -55,6 +55,8 @@
 import com.starrocks.sql.ast.AstVisitorExtendInterface;
 import com.starrocks.sql.ast.CTERelation;
 import com.starrocks.sql.ast.CreateTableAsSelectStmt;
+import com.starrocks.sql.ast.CreateTableStmt;
+import com.starrocks.sql.ast.CreateTemporaryTableStmt;
 import com.starrocks.sql.ast.DeleteStmt;
 import com.starrocks.sql.ast.ExceptRelation;
 import com.starrocks.sql.ast.FileTableFunctionRelation;
@@ -2278,6 +2280,46 @@ public Void visitMergeIntoStatement(MergeIntoStmt node, Void context) {
             return null;
         }
 
+        /**
+         * A CTAS writing into an external catalog holds the lock only for the internal tables its SELECT
+         * reads, yet {@code CreateTableAnalyzer} asks the target catalog, with that lock held, whether the
+         * database exists and whether the table already does. Ask here instead; the same rules as
+         * {@link #preResolveExternalWriteTarget} apply.
+         */
+        private void preResolveExternalCreateTarget(CreateTableStmt createTableStmt) {
+            // A temporary table lives in the internal catalog, and its analyzer does not ask tableExists.
+            if (createTableStmt == null || createTableStmt instanceof CreateTemporaryTableStmt
+                    || createTableStmt.getTableRef() == null) {
+                return;
+            }
+            TableName tableName;
+            try {
+                TableRef tableRef = createTableStmt.getTableRef();
+                tableName = new TableName(tableRef.getCatalogName(), tableRef.getDbName(),
+                        tableRef.getTableName(), tableRef.getPos());
+                tableName.normalization(session);
+            } catch (RuntimeException e) {
+                return;
+            }
+            if (Strings.isNullOrEmpty(tableName.getCatalog()) || Strings.isNullOrEmpty(tableName.getDb())
+                    || CatalogMgr.isInternalCatalog(tableName.getCatalog())
+                    || !GlobalStateMgr.getCurrentState().getCatalogMgr().catalogExists(tableName.getCatalog())) {
+                return;
+            }
+            try (Timer ignored = Tracers.watchScope("AnalyzeTable")) {
+                Database db = metadataMgr.getDb(session, tableName.getCatalog(), tableName.getDb());
+                if (db == null) {
+                    return;
+                }
+                boolean exists = metadataMgr.tableExists(session, tableName.getCatalog(), tableName.getDb(),
+                        tableName.getTbl());
+                session.getPreResolvedWriteTargets().putCreateTarget(tableName,
+                        new PreResolvedWriteTargets.CreateTarget(db, exists));
+            } catch (RuntimeException e) {
+                // left to the locked analyzer, which reports it the way it always has
+            }
+        }
+
         /**
          * Resolve a DML's write target here, without the lock, when it lives in an external catalog.
          *
@@ -2528,7 +2570,10 @@ public Void visitInsertStatement(InsertStmt statement, Void context) {
 
         @Override
         public Void visitCreateTableAsSelectStatement(CreateTableAsSelectStmt statement, Void context) {
-            // Avoid touching target table metadata here; only pre-resolve external tables in the query part.
+            // The target table does not exist yet, so it is not resolved as a table; for an external target,
+            // what CreateTableAnalyzer asks its catalog is, see preResolveExternalCreateTarget. The query part
+            // is walked like any other; the INSERT the CTAS carries is not, since its target is that same table.
+            preResolveExternalCreateTarget(statement.getCreateTableStmt());
             if (statement.getQueryStatement() != null) {
                 visit(statement.getQueryStatement());
             }
```

---

### Incident Patch 8: `2ca4ad56` (2026-10-05)
**Commit Message**: [BugFix] Fix use-after-free when casting a rebuilt shredded VARIANT row (#80102)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `be/src/exprs/cast_expr_tpl.hpp` (modified, +4/-2)
```diff
@@ -204,8 +204,9 @@ static ColumnPtr cast_to_json_fn(ColumnPtr& column) {
                     down_cast<const VariantColumn*>(ColumnHelper::get_data_column(column.get()));
             const size_t variant_row = column->is_constant() ? 0 : row;
             VariantRowRef row_ref;
+            // row_ref may point into variant_buffer, so the buffer must outlive every use of row_ref.
+            VariantRowValue variant_buffer;
             if (!variant_data_column->try_get_row_ref(variant_row, &row_ref)) {
-                VariantRowValue variant_buffer;
                 const VariantRowValue* variant = variant_data_column->get_row_value(variant_row, &variant_buffer);
                 if (variant == nullptr) {
                     overflow = true;
@@ -289,8 +290,9 @@ static ColumnPtr cast_from_variant_fn(ColumnPtr& column) {
 
         const size_t variant_row = column->is_constant() ? 0 : row;
         VariantRowRef row_ref;
+        // row_ref may point into variant_buffer, so the buffer must outlive every use of row_ref.
+        VariantRowValue variant_buffer;
         if (!variant_data_column->try_get_row_ref(variant_row, &row_ref)) {
-            VariantRowValue variant_buffer;
             const VariantRowValue* variant = variant_data_column->get_row_value(variant_row, &variant_buffer);
             if (variant == nullptr) {
                 builder.append_null();
```

**File**: `be/test/exprs/cast_expr_test.cpp` (modified, +40/-0)
```diff
@@ -3282,4 +3282,44 @@ TEST_F(VectorizedCastExprTest, base_shredded_typed_variant_overlay_cast_mismatch
     ASSERT_TRUE(result->is_null(0));
 }
 
+// A row that exists only in typed shredded columns has no stored row ref: the cast rebuilds it into a
+// local buffer. The value must be read while that buffer is alive. The string is longer than the SSO
+// limit so a dangling read lands on freed heap memory (caught by ASAN).
+static ColumnPtr make_object_typed_only_variant_column(const std::vector<std::string>& values) {
+    auto typed = ColumnHelper::create_column(TypeDescriptor(TYPE_VARCHAR), true);
+    for (const auto& v : values) {
+        typed->append_datum(Datum(Slice(v)));
+    }
+    MutableColumns typed_columns;
+    typed_columns.emplace_back(std::move(typed));
+    auto variant = VariantColumn::create();
+    variant->set_shredded_columns({"a"}, {TypeDescriptor(TYPE_VARCHAR)}, std::move(typed_columns), nullptr, nullptr);
+    return variant;
+}
+
+TEST_F(VectorizedCastExprTest, variant_cast_to_string_from_rebuilt_shredded_row) {
+    const std::string long_value(64, 'x');
+    auto variant_col = make_object_typed_only_variant_column({long_value, "short"});
+    auto result = cast_from_variant(gen_type_desc(TPrimitiveType::VARCHAR), variant_col);
+    ASSERT_EQ(2, result->size());
+    ASSERT_FALSE(result->is_null(0));
+    EXPECT_EQ(R"({"a":")" + long_value + R"("})", result->get(0).get_slice().to_string());
+    EXPECT_EQ(R"({"a":"short"})", result->get(1).get_slice().to_string());
+}
+
+TEST_F(VectorizedCastExprTest, variant_cast_to_json_from_rebuilt_shredded_row) {
+    const std::string long_value(64, 'y');
+    auto variant_col = make_object_typed_only_variant_column({long_value});
+    auto result = cast_from_variant(gen_type_desc(TPrimitiveType::JSON), variant_col);
+    ASSERT_EQ(1, result->size());
+    ASSERT_FALSE(result->is_null(0));
+    const JsonValue* json = result->get(0).get_json();
+    ASSERT_NE(nullptr, json);
+    auto field = json->get_obj("a");
+    ASSERT_TRUE(field.ok());
+    auto str = field->get_string();
+    ASSERT_TRUE(str.ok());
+    EXPECT_EQ(long_value, str->to_string());
+}
+
 } // namespace starrocks
```

---

### Incident Patch 9: `4e255bbd` (2026-10-05)
**Commit Message**: [BugFix] Keep an ordered spill mem table over 4GB as BinaryColumn so its spill can be restored (#80090)

Signed-off-by: trueeyu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `be/src/compute_env/spill/mem_table.cpp` (modified, +7/-1)
```diff
@@ -204,8 +204,14 @@ void OrderedMemTable::reset() {
     _permutation.shrink_to_fit();
 }
 
+Status OrderedMemTable::check_chunk_before_sort(const Chunk& chunk) {
+    // BinaryColumn holds more than 4GB with 64-bit offsets, and every slice cut from it is a BinaryColumn again, so
+    // there is nothing to upgrade.
+    return chunk.capacity_limit_reached();
+}
+
 StatusOr<ChunkPtr> OrderedMemTable::_do_sort(const ChunkPtr& chunk) {
-    RETURN_IF_ERROR(chunk->upgrade_if_overflow());
+    RETURN_IF_ERROR(check_chunk_before_sort(*chunk));
     DataSegment segment(_sort_exprs, chunk);
     _permutation.resize(0);
 
```

**File**: `be/src/compute_env/spill/mem_table.h` (modified, +5/-0)
```diff
@@ -138,6 +138,11 @@ class OrderedMemTable final : public SpillableMemTable {
     Status finalize(workgroup::YieldContext& yield_ctx, const SpillOutputDataStreamPtr& output) override;
     void reset() override;
 
+    // Checks the mem table chunk before it is sorted and spilled. A chunk over 4GB must stay a BinaryColumn: upgrading
+    // it to LargeBinaryColumn would serialize its slices in the 64-bit format, while the restore side builds
+    // BinaryColumn from the spill schema and reads the 32-bit one. Only the capacity limits are checked.
+    static Status check_chunk_before_sort(const Chunk& chunk);
+
 private:
     StatusOr<ChunkPtr> _do_sort(const ChunkPtr& chunk);
 
```

**File**: `be/test/compute_env/spill/spill_test.cpp` (modified, +137/-0)
```diff
@@ -29,15 +29,19 @@
 #include "base/utility/defer_op.h"
 #include "column/adaptive_nullable_column.h"
 #include "column/array_column.h"
+#include "column/binary_column.h"
 #include "column/chunk.h"
 #include "column/column_helper.h"
 #include "column/column_visitor_adapter.h"
+#include "column/const_column.h"
+#include "column/container_resource.h"
 #include "column/map_column.h"
 #include "column/nullable_column.h"
 #include "column/sorting/sorting.h"
 #include "column/struct_column.h"
 #include "column/vectorized_fwd.h"
 #include "common/config_exec_fwd.h"
+#include "common/config_local_io_fwd.h"
 #include "common/config_storage_fwd.h"
 #include "common/object_pool.h"
 #include "common/runtime_profile.h"
@@ -67,6 +71,7 @@
 #include "runtime/mem_tracker.h"
 #include "runtime/query_context_lifetime.h"
 #include "runtime/runtime_state.h"
+#include "testutil/column_test_helper.h"
 #include "types/logical_type.h"
 
 namespace starrocks::vectorized {
@@ -681,6 +686,138 @@ TEST_F(SpillTest, order_by_process) {
     }
 }
 
+// Spill input whose BinaryColumn has 64-bit offsets through the ordered spiller and check that every row comes back in
+// order as a BinaryColumn with its value. OrderedMemTable::append() copies the input into a fresh column, so the mem
+// table itself stays small and 32-bit here; the over-4GB mem table is covered by
+// ordered_mem_table_keeps_binary_over_4g_before_sort.
+TEST_F(SpillTest, order_by_restore_large_offsets_binary) {
+    ObjectPool pool;
+    TExprBuilder order_by_slots_builder;
+    order_by_slots_builder << TYPE_INT;
+    auto order_by_slots = order_by_slots_builder.get_res();
+    TExprBuilder tuple_slots_builder;
+    tuple_slots_builder << TYPE_INT << TYPE_VARCHAR;
+    auto tuple_slots = tuple_slots_builder.get_res();
+
+    auto ctx_st = no_partition_context(&pool, &dummy_rt_st, order_by_slots, tuple_slots);
+    ASSERT_OK(ctx_st.status());
+    auto ctx = ctx_st.value();
+    auto& tuple = ctx->sort_exprs.sort_tuple_slot_expr_ctxs();
+    const SlotId key_slot = find_first_column_ref(tuple[0]->root())->slot_id();
+    const SlotId value_slot = find_first_column_ref(tuple[1]->root())->slot_id();
+
+    // Keys start + 2 * i, each with the value "v<key>".
+    auto make_chunk = [&](int32_t start, size_t num_rows, bool large_offsets) {
+        auto keys = Int32Column::create();
+        auto values = BinaryColumn::create();
+        for (size_t i = 0; i < num_rows; i++) {
+            const int32_t key = start + 2 * static_cast<int32_t>(i);
+            const std::string value = "v" + std::to_string(key);
+            keys->append(key);
+            values->append(Slice(value));
+        }
+        if (large_offsets) {
+            ColumnTestHelper::force_large_offsets(values.get());
+        }
+        auto chunk = std::make_shared<Chunk>();
+        chunk->append_column(std::move(keys), key_slot);
+        chunk->append_column(std::move(values), value_slot);
+        return chunk;
+    };
+
+    auto factory = spill::make_spilled_factory();
+    SpilledOptions spill_options(&ctx->sort_exprs, &ctx->sort_descs);
+    spill_options.mem_table_pool_size = 2;
+    spill_options.spill_mem_table_bytes_size = 64 * 1024 * 1024;
+    spill_options.spill_type = spill::SpillFormaterType::SPILL_BY_COLUMN;
+    spill_options.block_manager = dummy_block_mgr.get();
+
+    auto spiller = factory->create(spill_options);
+    spiller->set_metrics(metrics);
+    SpillerCaller<spill::RawSpillerWriter*, spill::SpillerReader*> caller(spiller.get());
+    ASSERT_OK(spiller->prepare(&dummy_rt_st));
+
+    constexpr size_t kRowsPerChunk = 100;
+    // Both chunks land in one mem table; append() copies them out of their 64-bit offsets.
+    ASSERT_OK(caller.spill<SyncExecutor>(&dummy_rt_st, make_chunk(0, kRowsPerChunk, true), EmptyMemGuard{}));
+    ASSERT_OK(caller.spill<SyncExecutor>(&dummy_rt_st, make_chunk(1, kRowsPerChunk, true), EmptyMemGuard{}));
+    ASSERT_OK(caller.flush<SyncExecutor>(&dummy_rt_st, EmptyMemGuard{}));
+    ASSERT_OK(spiller->_spilled_task_status);
+
+    std::vector<int32_t> keys;
+    std::vector<std::string> values;
+    ASSERT_OK(caller.trigger_restore<SyncExecutor>(&dummy_rt_st, EmptyMemGuard{}));
+    while (true) {
+        auto chunk_st = caller.restore<SyncExecutor>(&dummy_rt_st, EmptyMemGuard{});
+        if (chunk_st.status().is_end_of_file()) {
+            break;
+        }
+        ASSERT_OK(chunk_st.status());
+        ASSERT_OK(spiller->_spilled_task_status);
+        const auto& chunk = chunk_st.value();
+        if (chunk == nullptr) {
+            continue;
+        }
+        const auto& key_column = chunk->get_column_by_slot_id(key_slot);
+        const auto& value_column = chunk->get_column_by_slot_id(value_slot);
+        const Column* value_data = ColumnHelper::get_data_column(value_column.get());
+        ASSERT_TRUE(value_data->is_binary());
+        ASSERT_FALSE(value_data->is_large_binary());
+        for (size_t i = 0; i < chunk->num_rows(); 
```

---

### Incident Patch 10: `4abc3458` (2026-10-05)
**Commit Message**: [BugFix] Keep a join NULL rejection from converting outer joins below a limit, top-n or window (#79974)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/main/java/com/starrocks/sql/optimizer/rewrite/JoinPredicatePushdown.java` (modified, +42/-2)
```diff
@@ -355,7 +355,7 @@ private void deriveIsNotNullPredicate(
         boolean isLeftEmpty = leftPushDown.isEmpty();
         if (joinType.isAnyInnerJoin() || joinType.isRightSemiJoin()) {
             leftEQ.stream().map(c -> new IsNullPredicateOperator(true, c.clone(), true)).forEach(notNull -> {
-                optimizerContext.addPushdownNotNullPredicates(notNull);
+                recordPushdownNotNull(join.inputAt(0), notNull);
                 if (isLeftEmpty) {
                     leftPushDown.add(notNull);
                 }
@@ -364,7 +364,7 @@ private void deriveIsNotNullPredicate(
         boolean isRightEmpty = rightPushDown.isEmpty();
         if (joinType.isAnyInnerJoin() || joinType.isLeftSemiJoin()) {
             rightEQ.stream().map(c -> new IsNullPredicateOperator(true, c.clone(), true)).forEach(notNull -> {
-                optimizerContext.addPushdownNotNullPredicates(notNull);
+                recordPushdownNotNull(join.inputAt(1), notNull);
                 if (isRightEmpty) {
                     rightPushDown.add(notNull);
                 }
@@ -373,6 +373,46 @@ private void deriveIsNotNullPredicate(
         joinOp.setHasDeriveIsNotNullPredicate(true);
     }
 
+    // A recorded NULL rejection lets an outer join below turn into an inner join (convertOuterToInner), dropping the
+    // NULL-extended rows before they reach this join. That is only right if no operator on the way down picks or
+    // computes its output rows from other input rows (a limit, a top-n, a window), so do not record it past one.
+    private void recordPushdownNotNull(OptExpression child, IsNullPredicateOperator notNull) {
+        if (!isRowDependentOnTheWay(child, notNull.getUsedColumns())) {
+            optimizerContext.addPushdownNotNullPredicates(notNull);
+        }
+    }
+
+    // Walk down the inputs carrying the columns until the operator producing them.
+    private static boolean isRowDependentOnTheWay(OptExpression root, ColumnRefSet columns) {
+        OptExpression current = root;
+        while (current != null) {
+            if (dependsOnOtherRows(current.getOp())) {
+                return true;
+            }
+            OptExpression next = null;
+            for (OptExpression input : current.getInputs()) {
+                if (outputColumns(input).containsAll(columns)) {
+                    next = input;
+                    break;
+                }
+            }
+            current = next;
+        }
+        return false;
+    }
+
+    private static boolean dependsOnOtherRows(Operator op) {
+        return op.hasLimit() || op.getOpType() == OperatorType.LOGICAL_LIMIT ||
+                op.getOpType() == OperatorType.LOGICAL_TOPN || op.getOpType() == OperatorType.LOGICAL_WINDOW ||
+                op.getOpType() == OperatorType.LOGICAL_ASSERT_ONE_ROW;
+    }
+
+    // an input created by a rewrite of this pass may not have its logical property derived yet
+    private static ColumnRefSet outputColumns(OptExpression expression) {
+        return expression.getLogicalProperty() != null ? expression.getOutputColumns() :
+                expression.getRowOutputInfo().getOutputColumnRefSet();
+    }
+
     private JoinOperator deriveJoinType(JoinOperator originalType, ScalarOperator newJoinOnPredicate) {
         JoinOperator result;
         switch (originalType) {
```

**File**: `fe/fe-core/src/test/java/com/starrocks/sql/plan/OuterJoinBelowRowDependentOperatorTest.java` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
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
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.ValueSource;
+
+// A join rejecting NULLs of a column records `col IS NOT NULL` for the whole rewrite pass, and an outer join feeding
+// that column becomes an inner join. Below an operator whose output rows depend on other input rows, dropping the
+// NULL-extended rows changes which rows are kept or what is computed for them, so the outer join must stay.
+public class OuterJoinBelowRowDependentOperatorTest extends PlanTestBase {
+
+    private static final String OUTER_JOIN = "select t0.v1, t0.v2, t0.v3, t1.v5 from t0 left join t1 on t0.v1 = t1.v4";
+
+    @Test
+    public void testNullRejectedAboveConvertsOuterJoin() throws Exception {
+        String sql = "select * from (" + OUTER_JOIN + " where t0.v2 > 0) t join t2 on t.v5 = t2.v7";
+        assertNotContains(getFragmentPlan(sql), "OUTER JOIN");
+    }
+
+    @ParameterizedTest
+    @ValueSource(strings = {
+            OUTER_JOIN + " where t0.v2 > 0 order by t0.v3 limit 10",
+            OUTER_JOIN + " where t0.v2 > 0 limit 10",
+            // the local half of the limit is merged into the outer join itself
+            OUTER_JOIN + " limit 10",
+            "select v1, v5, count(*) over (partition by v2) from (" + OUTER_JOIN + ") x where v2 > 0",
+    })
+    public void testNullRejectedAboveRowDependentOperator(String below) throws Exception {
+        String sql = "select * from (" + below + ") t join t2 on t.v5 = t2.v7";
+        assertContains(getFragmentPlan(sql), "LEFT OUTER JOIN");
+    }
+
+    @Test
+    public void testFilterAboveOuterJoinWithLimit() throws Exception {
+        String sql = "select * from (" + OUTER_JOIN + " limit 10) t where t.v5 > 0";
+        assertContains(getFragmentPlan(sql), "LEFT OUTER JOIN");
+    }
+}
```

**File**: `test/sql/test_join/R/test_outer_join_below_limit_null_rejection` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+-- name: test_outer_join_below_limit_null_rejection
+CREATE DATABASE db_${uuid0};
+-- result:
+-- !result
+USE db_${uuid0};
+-- result:
+-- !result
+CREATE TABLE f (id int, k int, s int) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
+-- result:
+-- !result
+CREATE TABLE r (id int, k int) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
+-- result:
+-- !result
+CREATE TABLE d (id int, s int) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
+-- result:
+-- !result
+INSERT INTO f VALUES (1, 1, 10), (2, 2, NULL), (3, 3, 20);
+-- result:
+-- !result
+INSERT INTO r VALUES (1, 1), (2, 2), (3, 4), (4, NULL);
+-- result:
+-- !result
+INSERT INTO d VALUES (1, 10), (2, 20);
+-- result:
+-- !result
+select t.s, t.k from (select f.s, r.k from r left join f on r.k = f.k where r.k > 0) t join d on t.s = d.s order by t.k;
+-- result:
+10	1
+-- !result
+function: assert_explain_contains('select t.s, t.k from (select f.s, r.k from r left join f on r.k = f.k where r.k > 0 and r.k <> 2 order by r.k desc limit 1) t join d on t.s = d.s', 'OUTER JOIN')
+-- result:
+None
+-- !result
+select t.s, t.k from (select f.s, r.k from r left join f on r.k = f.k where r.k > 0 and r.k <> 2 order by r.k desc limit 1) t join d on t.s = d.s;
+-- result:
+-- !result
+select t.s, t.c from (select f.s, r.k, count(*) over () c from r left join f on r.k = f.k where r.k > 0) t join d on t.s = d.s;
+-- result:
+10	3
+-- !result
+DROP DATABASE db_${uuid0};
+-- result:
+-- !result
```

**File**: `test/sql/test_join/T/test_outer_join_below_limit_null_rejection` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+-- name: test_outer_join_below_limit_null_rejection
+CREATE DATABASE db_${uuid0};
+USE db_${uuid0};
+CREATE TABLE f (id int, k int, s int) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
+CREATE TABLE r (id int, k int) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
+CREATE TABLE d (id int, s int) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
+INSERT INTO f VALUES (1, 1, 10), (2, 2, NULL), (3, 3, 20);
+INSERT INTO r VALUES (1, 1), (2, 2), (3, 4), (4, NULL);
+INSERT INTO d VALUES (1, 10), (2, 20);
+select t.s, t.k from (select f.s, r.k from r left join f on r.k = f.k where r.k > 0) t join d on t.s = d.s order by t.k;
+function: assert_explain_contains('select t.s, t.k from (select f.s, r.k from r left join f on r.k = f.k where r.k > 0 and r.k <> 2 order by r.k desc limit 1) t join d on t.s = d.s', 'OUTER JOIN')
+select t.s, t.k from (select f.s, r.k from r left join f on r.k = f.k where r.k > 0 and r.k <> 2 order by r.k desc limit 1) t join d on t.s = d.s;
+select t.s, t.c from (select f.s, r.k, count(*) over () c from r left join f on r.k = f.k where r.k > 0) t join d on t.s = d.s;
+DROP DATABASE db_${uuid0};
```

---

### Incident Patch 11: `ae25d54b` (2026-10-05)
**Commit Message**: [BugFix] Fix Parquet nested type edge cases in schema resolution, inference, writer and reader (#80085)

Signed-off-by: tqqq <[REDACTED_EMAIL]>
Co-authored-by: tqqq <[REDACTED_EMAIL]>

**File**: `be/src/connector/file/scanner/parquet_schema_builder.cpp` (modified, +104/-72)
```diff
@@ -28,6 +28,7 @@ static constexpr int VARIANT_SHREDDING_COUNT = 3;
 // (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) in StarRocks VARCHAR.
 static constexpr int UUID_VARCHAR_LENGTH = 36;
 
+static Status get_parquet_node_type(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc);
 static Status get_parquet_type_from_group(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc);
 static Status get_parquet_type_from_primitive(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc);
 static Status get_parquet_type_from_list(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc);
@@ -36,7 +37,30 @@ static bool is_variant_type(const ::parquet::schema::NodePtr& node);
 static Status get_parquet_variant_type(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc);
 static Status try_to_infer_struct_type(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc);
 
+static bool is_list_or_map(const ::parquet::schema::NodePtr& node) {
+    return node->is_group() && (node->logical_type()->is_list() || node->logical_type()->is_map());
+}
+
+// The inference rules mirror the native reader's schema resolution (formats/parquet/schema.cpp), so that
+// files() infers the types the native reader then resolves for the same file.
 Status get_parquet_type(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc) {
+    // LIST/MAP-annotated groups check their own repetition.
+    if (node->is_repeated() && !is_list_or_map(node)) {
+        // One-level list encoding: a repeated primitive or a repeated group (a list of struct) outside
+        // a LIST/MAP-annotated group is a required list of non-null elements.
+        //
+        // repeated int32 name;
+        // repeated group name { ... }
+        TypeDescriptor element_type_desc;
+        RETURN_IF_ERROR(get_parquet_node_type(node, &element_type_desc));
+        *type_desc = TypeDescriptor::create_array_type(element_type_desc);
+        return Status::OK();
+    }
+    return get_parquet_node_type(node, type_desc);
+}
+
+// Types the node itself, ignoring its own repetition.
+static Status get_parquet_node_type(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc) {
     if (node->is_group()) {
         return get_parquet_type_from_group(node, type_desc);
     }
@@ -260,89 +284,79 @@ Support legacy encodings:
       repeated int32 array;
     }
   }
+
+4. List<OneTuple<String>> (nullable list, non-null elements)
+  optional group my_list (LIST) {
+    repeated group array {
+      required binary str (UTF8);
+    };
+  }
+  optional group my_list (LIST) {
+    repeated group my_list_tuple {
+      required binary str (UTF8);
+    }
+  }
+
+The rules match SchemaDescriptor::list_to_field in formats/parquet/schema.cpp.
 */
+
+// Backward-compatibility rule from the format spec: a single-field repeated group named `array` or
+// `<list name>_tuple` is the element type itself, i.e. a list of struct.
+static bool has_struct_list_name(const std::string& repeated_name, const std::string& list_name) {
+    return repeated_name == "array" || repeated_name == list_name + "_tuple";
+}
+
+// Also used for a key-only MAP, which is resolved as a list of keys.
 static Status get_parquet_type_from_list(const ::parquet::schema::NodePtr& node, TypeDescriptor* type_desc) {
     // 1st level.
     DCHECK(node->is_group());
-    DCHECK(node->logical_type()->is_list());
-
-    auto group_node = std::static_pointer_cast<::parquet::schema::GroupNode>(node);
+    if (node->is_repeated()) {
+        return Status::NotSupported(fmt::format("list 1st level group {} must not be repeated", node->name()));
+    }
+    const auto group_node = std::static_pointer_cast<::parquet::schema::GroupNode>(node);
     if (group_node->field_count() != 1) {
         return Status::NotSupported(fmt::format("list 1st level group {} must have exactly one child, but got {}",
                                                 group_node->name(), group_node->field_count()));
     }
 
     // 2nd level.
-    auto list_node = group_node->field(0);
+    const auto& list_node = group_node->field(0);
     if (!list_node->is_repeated()) {
         return Status::NotSupported(fmt::format("list 2nd level node {} is not repeated", list_node->name()));
     }
 
+    TypeDescriptor element_type_desc;
     if (list_node->is_group()) {
-        auto list_group_node = std::static_pointer_cast<::parquet::schema::GroupNode>(list_node);
-        int field_count = list_group_node->field_count();
-
-        if (field_count > 1) {
-            // The inner type of the list should be a struct when there are multiple fields in the repeated group
-            //
-            // List<Tuple<String, Integer>> (nullable list, non-null elements)
-            // optional group my_list (LIST) {
-            //   repeated group element {
-            //     required binary str (STRING);
-            //     required int32 num;
-            //   }
-            // }
-   
```

**File**: `be/src/formats/parquet/column_materializer.cpp` (modified, +4/-1)
```diff
@@ -172,7 +172,10 @@ StatusOr<size_t> ColumnMaterializer::read_active_range_round_by_round(const Rang
                 std::vector<ExprContext*> ctxs = _post_read_conjuncts_by_slot.at(slot_id);
                 ASSIGN_OR_RETURN(hit_count, eval_slot_conjuncts(ctxs, slot_id, chunk, filter));
                 if (hit_count == 0) {
-                    break;
+                    // No row left: skip the regular columns too, like the other early exits below. Reading
+                    // them with an all-zero filter is wasted work and leaves the stored readers' page state
+                    // out of step with their read cursors.
+                    return hit_count;
                 }
             }
         }
```

**File**: `be/src/formats/parquet/column_reader_factory.cpp` (modified, +22/-38)
```diff
@@ -591,51 +591,34 @@ StatusOr<ColumnReaderPtr> ColumnReaderFactory::create(ColumnReaderPtr raw_reader
 void ColumnReaderFactory::get_subfield_pos_with_pruned_type(const ParquetField& field, const TypeDescriptor& col_type,
                                                             bool case_sensitive, std::vector<int32_t>& pos) {
     DCHECK(field.type == ColumnType::STRUCT);
+    // A subfield is matched by its field id when it has one, otherwise by its physical name, otherwise by its
+    // name. field_ids / field_physical_names are either empty or hold one entry per child, with -1 / "" for a
+    // subfield that has none.
+    std::unordered_map<int32_t, size_t> field_id_2_pos;
     if (!col_type.field_ids.empty()) {
-        std::unordered_map<int32_t, size_t> field_id_2_pos;
         for (size_t i = 0; i < field.children.size(); i++) {
             field_id_2_pos.emplace(field.children[i].field_id, i);
         }
+    }
+    std::unordered_map<std::string, size_t> field_name_2_pos;
+    for (size_t i = 0; i < field.children.size(); i++) {
+        const std::string& format_field_name = Utils::format_name(field.children[i].name, case_sensitive);
+        field_name_2_pos.emplace(format_field_name, i);
+    }
 
-        for (size_t i = 0; i < col_type.children.size(); i++) {
+    for (size_t i = 0; i < col_type.children.size(); i++) {
+        if (!col_type.field_ids.empty() && col_type.field_ids[i] != -1) {
             auto it = field_id_2_pos.find(col_type.field_ids[i]);
-            if (it == field_id_2_pos.end()) {
-                pos[i] = -1;
-                continue;
-            }
-            pos[i] = it->second;
-        }
-    } else {
-        std::unordered_map<std::string, size_t> field_name_2_pos;
-        for (size_t i = 0; i < field.children.size(); i++) {
-            const std::string& format_field_name = Utils::format_name(field.children[i].name, case_sensitive);
-            field_name_2_pos.emplace(format_field_name, i);
+            pos[i] = it == field_id_2_pos.end() ? -1 : static_cast<int32_t>(it->second);
+            continue;
         }
 
-        if (!col_type.field_physical_names.empty()) {
-            for (size_t i = 0; i < col_type.children.size(); i++) {
-                const std::string& formatted_physical_name =
-                        Utils::format_name(col_type.field_physical_names[i], case_sensitive);
-
-                auto it = field_name_2_pos.find(formatted_physical_name);
-                if (it == field_name_2_pos.end()) {
-                    pos[i] = -1;
-                    continue;
-                }
-                pos[i] = it->second;
-            }
-        } else {
-            for (size_t i = 0; i < col_type.children.size(); i++) {
-                const std::string formatted_subfield_name = Utils::format_name(col_type.field_names[i], case_sensitive);
-
-                auto it = field_name_2_pos.find(formatted_subfield_name);
-                if (it == field_name_2_pos.end()) {
-                    pos[i] = -1;
-                    continue;
-                }
-                pos[i] = it->second;
-            }
-        }
+        const std::string& subfield_name =
+                !col_type.field_physical_names.empty() && !col_type.field_physical_names[i].empty()
+                        ? col_type.field_physical_names[i]
+                        : col_type.field_names[i];
+        auto it = field_name_2_pos.find(Utils::format_name(subfield_name, case_sensitive));
+        pos[i] = it == field_name_2_pos.end() ? -1 : static_cast<int32_t>(it->second);
     }
 }
 
@@ -663,8 +646,9 @@ void ColumnReaderFactory::get_subfield_pos_with_pruned_type(
     for (size_t i = 0; i < col_type.children.size(); i++) {
         const auto schema_subfield_name =
                 case_sensitive ? col_type.field_names[i] : boost::algorithm::to_lower_copy(col_type.field_names[i]);
+        // An empty physical name is the placeholder of a subfield without one.
         const auto parquet_subfield_name =
-                !col_type.field_physical_names.empty()
+                !col_type.field_physical_names.empty() && !col_type.field_physical_names[i].empty()
                         ? Utils::format_name(col_type.field_physical_names[i], case_sensitive)
                         : schema_subfield_name;
 
```

**File**: `be/src/formats/parquet/level_builder.cpp` (modified, +14/-4)
```diff
@@ -582,7 +582,18 @@ Status LevelBuilder::_write_map_column_chunk(const LevelBuilderContext& ctx, con
             continue;
         }
 
-        if (def_level < ctx._max_def_level || (null_col != nullptr && null_col[offset])) {
+        auto map_size = offsets[offset + 1] - offsets[offset];
+        auto map_is_null = (def_level < ctx._max_def_level || (null_col != nullptr && null_col[offset]));
+
+        // null in current map_column
+        if (map_is_null) {
+            // The entries of a null map would still be written to the key/value leaves and shift them onto
+            // the following rows.
+            if (map_size > 0) {
+                return Status::DataQualityError(
+                        fmt::format("Map column ({}) has null element at offset {}, but map size is {}",
+                                    type_desc.debug_string(), offset, map_size));
+            }
             (*def_levels)[num_levels] = def_level;
             (*rep_levels)[num_levels] = rep_level;
 
@@ -591,8 +602,7 @@ Status LevelBuilder::_write_map_column_chunk(const LevelBuilderContext& ctx, con
             continue;
         }
 
-        auto array_size = offsets[offset + 1] - offsets[offset];
-        if (array_size == 0) {
+        if (map_size == 0) {
             (*def_levels)[num_levels] = def_level + node->is_optional();
             (*rep_levels)[num_levels] = rep_level;
 
@@ -602,7 +612,7 @@ Status LevelBuilder::_write_map_column_chunk(const LevelBuilderContext& ctx, con
         }
 
         (*rep_levels)[num_levels] = rep_level;
-        num_levels += array_size;
+        num_levels += map_size;
         offset++;
     }
 
```

**File**: `be/src/formats/parquet/meta_helper.cpp` (modified, +28/-30)
```diff
@@ -131,47 +131,45 @@ bool ParquetMetaHelper::_is_valid_type(const ParquetField* parquet_field, const
         if (type_descriptor->type == LogicalType::TYPE_VARIANT) {
             // variant type currently can be mapped to struct type in parquet
             has_valid_child = true;
-        } else if (!type_descriptor->field_ids.empty()) {
+        } else {
+            // A subfield is matched by its field id when it has one, otherwise by its physical name, otherwise by
+            // its name. field_ids / field_physical_names are either empty or hold one entry per child, with -1 / ""
+            // for a subfield that has none.
             std::unordered_map<int32_t, const TypeDescriptor*> field_id_2_type;
+            std::unordered_map<std::string, const TypeDescriptor*> field_name_2_type;
             for (size_t idx = 0; idx < type_descriptor->children.size(); idx++) {
-                field_id_2_type.emplace(type_descriptor->field_ids[idx], &type_descriptor->children[idx]);
-            }
-
-            // start to check struct type
-            for (const auto& child_parquet_field : parquet_field->children) {
-                auto it = field_id_2_type.find(child_parquet_field.field_id);
-                if (it == field_id_2_type.end()) {
+                const TypeDescriptor* child_type = &type_descriptor->children[idx];
+                if (!type_descriptor->field_ids.empty() && type_descriptor->field_ids[idx] != -1) {
+                    field_id_2_type.emplace(type_descriptor->field_ids[idx], child_type);
                     continue;
                 }
-
-                if (_is_valid_type(&child_parquet_field, it->second)) {
-                    has_valid_child = true;
-                    break;
-                }
-            }
-        } else {
-            std::unordered_map<std::string, const TypeDescriptor*> field_name_2_type;
-            if (!type_descriptor->field_physical_names.empty()) {
-                for (size_t idx = 0; idx < type_descriptor->children.size(); idx++) {
-                    field_name_2_type.emplace(
-                            Utils::format_name(type_descriptor->field_physical_names[idx], _case_sensitive),
-                            &type_descriptor->children[idx]);
-                }
-            } else {
-                for (size_t idx = 0; idx < type_descriptor->children.size(); idx++) {
-                    field_name_2_type.emplace(Utils::format_name(type_descriptor->field_names[idx], _case_sensitive),
-                                              &type_descriptor->children[idx]);
-                }
+                const std::string& name = !type_descriptor->field_physical_names.empty() &&
+                                                          !type_descriptor->field_physical_names[idx].empty()
+                                                  ? type_descriptor->field_physical_names[idx]
+                                                  : type_descriptor->field_names[idx];
+                field_name_2_type.emplace(Utils::format_name(name, _case_sensitive), child_type);
             }
 
             // start to check struct type
             for (const auto& child_parquet_field : parquet_field->children) {
-                auto it = field_name_2_type.find(Utils::format_name(child_parquet_field.name, _case_sensitive));
-                if (it == field_name_2_type.end()) {
+                const TypeDescriptor* child_type = nullptr;
+                if (!field_id_2_type.empty()) {
+                    auto it = field_id_2_type.find(child_parquet_field.field_id);
+                    if (it != field_id_2_type.end()) {
+                        child_type = it->second;
+                    }
+                }
+                if (child_type == nullptr && !field_name_2_type.empty()) {
+                    auto it = field_name_2_type.find(Utils::format_name(child_parquet_field.name, _case_sensitive));
+                    if (it != field_name_2_type.end()) {
+                        child_type = it->second;
+                    }
+                }
+                if (child_type == nullptr) {
                     continue;
                 }
 
-                if (_is_valid_type(&child_parquet_field, it->second)) {
+                if (_is_valid_type(&child_parquet_field, child_type)) {
                     has_valid_child = true;
                     break;
                 }
```

**File**: `be/src/formats/parquet/schema.cpp` (modified, +39/-13)
```diff
@@ -19,7 +19,6 @@
 #include <string>
 #include <string_view>
 
-#include "base/string/slice.h"
 #include "gutil/strings/substitute.h"
 #include "types/logical_type.h"
 
@@ -101,13 +100,21 @@ static bool is_optional(const tparquet::SchemaElement* schema) {
     return schema->__isset.repetition_type && schema->repetition_type == tparquet::FieldRepetitionType::OPTIONAL;
 }
 
+// A node is a LIST/MAP if either the legacy converted_type or the logicalType says so: writers are
+// expected to set both, but some only set logicalType.
 static bool is_list(const tparquet::SchemaElement* schema) {
-    return schema->__isset.converted_type && schema->converted_type == tparquet::ConvertedType::LIST;
+    if (schema->__isset.converted_type && schema->converted_type == tparquet::ConvertedType::LIST) {
+        return true;
+    }
+    return schema->__isset.logicalType && schema->logicalType.__isset.LIST;
 }
 
 static bool is_map(const tparquet::SchemaElement* schema) {
-    return schema->__isset.converted_type && (schema->converted_type == tparquet::ConvertedType::MAP ||
-                                              schema->converted_type == tparquet::ConvertedType::MAP_KEY_VALUE);
+    if (schema->__isset.converted_type && (schema->converted_type == tparquet::ConvertedType::MAP ||
+                                           schema->converted_type == tparquet::ConvertedType::MAP_KEY_VALUE)) {
+        return true;
+    }
+    return schema->__isset.logicalType && schema->logicalType.__isset.MAP;
 }
 
 Status SchemaDescriptor::leaf_to_field(const tparquet::SchemaElement* t_schema, const LevelInfo& cur_level_info,
@@ -128,15 +135,13 @@ Status SchemaDescriptor::leaf_to_field(const tparquet::SchemaElement* t_schema,
     return Status::OK();
 }
 
-// Special case mentioned in the format spec:
+// Backward-compatibility rule from the format spec:
 // https://github.com/apache/parquet-format/blob/master/LogicalTypes.md
-//   If the name is array or ends in _tuple, this should be a list of struct
-//   even for single child elements.
-bool has_struct_list_name(const std::string& name) {
-    static const Slice array_slice("array", 5);
-    static const Slice tuple_slice("_tuple", 6);
-    Slice slice(name);
-    return slice == array_slice || slice.ends_with(tuple_slice);
+//   If the repeated field is a group with one field and is named either array or uses the
+//   LIST-annotated group's name with _tuple appended then the repeated type is the element type,
+//   i.e. a list of struct even for a single child element.
+static bool has_struct_list_name(const std::string& repeated_name, const std::string& list_name) {
+    return repeated_name == "array" || repeated_name == list_name + "_tuple";
 }
 
 Status SchemaDescriptor::list_to_field(const std::vector<tparquet::SchemaElement>& t_schemas, size_t pos,
@@ -182,7 +187,27 @@ Status SchemaDescriptor::list_to_field(const std::vector<tparquet::SchemaElement
         // rather than a primitive value
         //
         // yields list<item: struct<item: TYPE ?nullable> not null> ?nullable
-        if (list_node_schema->num_children == 1 && !has_struct_list_name(list_node_schema->name)) {
+        //
+        // A LIST-annotated repeated group with a single repeated child takes precedence over the
+        // name rule: it is a nested list with two-level encoding, whatever the repeated group is called.
+        //
+        // required/optional group name=whatever {
+        //   repeated group name=array (LIST) {
+        //     repeated TYPE item;
+        //   }
+        // }
+        //
+        // yields list<item: list<item: TYPE not null> not null> ?nullable
+        //
+        // Without the LIST annotation the name rule still applies, so an `array` group with a single
+        // repeated child is a struct element: list<item: struct<item: list<TYPE>>>.
+        bool is_single_element = false;
+        if (list_node_schema->num_children == 1) {
+            ASSIGN_OR_RETURN(const auto* element_schema, _get_schema_element(t_schemas, pos + 2));
+            is_single_element = (is_repeated(element_schema) && is_list(list_node_schema)) ||
+                                !has_struct_list_name(list_node_schema->name, group_schema->name);
+        }
+        if (is_single_element) {
             RETURN_IF_ERROR(node_to_field(t_schemas, pos + 2, cur_level_info, child_field, next_pos));
         } else {
             RETURN_IF_ERROR(group_to_struct_field(t_schemas, pos + 1, cur_level_info, child_field, next_pos));
@@ -321,6 +346,7 @@ Status SchemaDescriptor::group_to_field(const std::vector<tparquet::SchemaElemen
         RETURN_IF_ERROR(group_to_struct_field(t_schemas, pos, cur_level_info, &field->children[0], next_pos));
 
         field->name = group_schema->name;
+        field->field_id = group_schema->field_id;
         field->type = ColumnType::ARRAY;
         field->is_nullable = false;
         field->level_info = cur_level_info;
```

**File**: `be/src/types/type_descriptor.cpp` (modified, +18/-1)
```diff
@@ -53,21 +53,38 @@ TypeDescriptor::TypeDescriptor(const std::vector<TTypeNode>& types, int* idx) {
         }
         break;
     }
-    case TTypeNodeType::STRUCT:
+    case TTypeNodeType::STRUCT: {
         type = TYPE_STRUCT;
         ++(*idx);
+        // field_ids / field_physical_names are indexed by child position, so they hold one entry per child:
+        // -1 / "" for a field that has none. They stay empty when no field has one.
+        bool has_field_id = false;
+        bool has_physical_name = false;
         for (const auto& struct_field : node.struct_fields) {
             field_names.push_back(struct_field.name);
             children.push_back(TypeDescriptor(types, idx));
             if (struct_field.__isset.id && struct_field.id != -1) {
                 field_ids.emplace_back(struct_field.id);
+                has_field_id = true;
+            } else {
+                field_ids.emplace_back(-1);
             }
             if (struct_field.__isset.physical_name && !struct_field.physical_name.empty()) {
                 field_physical_names.emplace_back(struct_field.physical_name);
+                has_physical_name = true;
+            } else {
+                field_physical_names.emplace_back();
             }
         }
+        if (!has_field_id) {
+            field_ids.clear();
+        }
+        if (!has_physical_name) {
+            field_physical_names.clear();
+        }
         DCHECK_EQ(field_names.size(), children.size());
         break;
+    }
     case TTypeNodeType::ARRAY:
         DCHECK(!node.__isset.scalar_type);
         DCHECK_LT(*idx, types.size() - 1);
```

**File**: `be/test/connector/file/scanner/parquet_schema_builder_test.cpp` (modified, +302/-32)
```diff
@@ -16,6 +16,7 @@
 
 #include <gtest/gtest.h>
 
+#include "formats/parquet/schema.h"
 #include "parquet/schema.h"
 #include "parquet/types.h"
 #include "types/type_descriptor.h"
@@ -29,29 +30,30 @@ class ParquetSchemaBuilderTest : public testing::Test {
 
 protected:
     // Helper function to create a primitive node
-    static parquet::schema::NodePtr create_primitive_node(const std::string& name,
-                                                          const parquet::Repetition::type repetition,
-                                                          const parquet::Type::type type) {
-        return parquet::schema::PrimitiveNode::Make(name, repetition, type);
+    static ::parquet::schema::NodePtr create_primitive_node(const std::string& name,
+                                                            const ::parquet::Repetition::type repetition,
+                                                            const ::parquet::Type::type type) {
+        return ::parquet::schema::PrimitiveNode::Make(name, repetition, type);
     }
 
     // Helper function to create a group node
-    static parquet::schema::NodePtr create_group_node(const std::string& name,
-                                                      const parquet::Repetition::type repetition,
-                                                      const parquet::schema::NodeVector& fields) {
-        return parquet::schema::GroupNode::Make(name, repetition, fields);
+    static ::parquet::schema::NodePtr create_group_node(const std::string& name,
+                                                        const ::parquet::Repetition::type repetition,
+                                                        const ::parquet::schema::NodeVector& fields) {
+        return ::parquet::schema::GroupNode::Make(name, repetition, fields);
     }
 
     // Helper function to create a group node with logical type
-    static parquet::schema::NodePtr create_list_node(const std::string& name,
-                                                     const parquet::Repetition::type repetition,
-                                                     const parquet::schema::NodeVector& fields) {
-        return ::parquet::schema::GroupNode::Make(name, repetition, fields, parquet::LogicalType::List());
+    static ::parquet::schema::NodePtr create_list_node(const std::string& name,
+                                                       const ::parquet::Repetition::type repetition,
+                                                       const ::parquet::schema::NodeVector& fields) {
+        return ::parquet::schema::GroupNode::Make(name, repetition, fields, ::parquet::LogicalType::List());
     }
 
-    static parquet::schema::NodePtr create_map_node(const std::string& name, const parquet::Repetition::type repetition,
-                                                    const parquet::schema::NodeVector& fields) {
-        return parquet::schema::GroupNode::Make(name, repetition, fields, parquet::LogicalType::Map());
+    static ::parquet::schema::NodePtr create_map_node(const std::string& name,
+                                                      const ::parquet::Repetition::type repetition,
+                                                      const ::parquet::schema::NodeVector& fields) {
+        return ::parquet::schema::GroupNode::Make(name, repetition, fields, ::parquet::LogicalType::Map());
     }
 };
 
@@ -261,7 +263,7 @@ TEST_F(ParquetSchemaBuilderTest, VariantInvalidMissingMetadata) {
     Status st;
 
     // Only has value field, missing metadata
-    parquet::schema::NodeVector fields;
+    ::parquet::schema::NodeVector fields;
     fields.push_back(create_primitive_node("value", ::parquet::Repetition::REQUIRED, ::parquet::Type::BYTE_ARRAY));
 
     auto node = create_group_node("not_variant_col", ::parquet::Repetition::OPTIONAL, fields);
@@ -278,7 +280,7 @@ TEST_F(ParquetSchemaBuilderTest, VariantInvalidMissingValue) {
     Status st;
 
     // Only has metadata field, missing value
-    parquet::schema::NodeVector fields;
+    ::parquet::schema::NodeVector fields;
     fields.push_back(create_primitive_node("metadata", ::parquet::Repetition::REQUIRED, ::parquet::Type::BYTE_ARRAY));
 
     auto node = create_group_node("not_variant_col", ::parquet::Repetition::OPTIONAL, fields);
@@ -295,7 +297,7 @@ TEST_F(ParquetSchemaBuilderTest, VariantInvalidWrongFieldType) {
     Status st;
 
     // metadata is INT32 instead of BYTE_ARRAY
-    parquet::schema::NodeVector fields;
+    ::parquet::schema::NodeVector fields;
     fields.push_back(create_primitive_node("metadata", ::parquet::Repetition::REQUIRED, ::parquet::Type::INT32));
     fields.push_back(create_primitive_node("value", ::parquet::Repetition::REQUIRED, ::parquet::Type::BYTE_ARRAY));
 
@@ -313,7 +315,7 @@ TEST_F(ParquetSchemaBuilderTest, VariantInvalidWrongValueType) {
     Status st;
 
     // value is INT32 instead of BYTE_ARRAY
-    parquet::schema::NodeVector fields;
+    ::parquet::schema::
```

---

### Incident Patch 12: `8961bc24` (2026-10-05)
**Commit Message**: [UT] Fix flaky CreateMaterializedViewTest.testFullCreate (#80088)

Signed-off-by: trueeyu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/test/java/com/starrocks/analysis/CreateMaterializedViewTest.java` (modified, +17/-5)
```diff
@@ -384,8 +384,10 @@ private List<TaskRunStatus> waitingTaskFinish(String mvTaskName) {
                 .until(() -> {
                     List<TaskRunStatus> runs = taskManager.getMatchedTaskRunStatus(params);
                     // At least one run must exist (covers the initial periodic-fire wait)
-                    // AND no pending/running runs may remain for this task name (so any
-                    // executeTask() submission made just before this call has drained).
+                    // AND no pending/running runs may remain for this task name. This cannot
+                    // wait for a run just submitted by executeTask(): while the scheduler moves
+                    // it from pending to running it is briefly in neither, so wait on its
+                    // SubmitResult future instead (see executePartitionChange).
                     return !runs.isEmpty()
                             && runs.stream().allMatch(r -> r.getState().isFinishState());
                 });
@@ -409,7 +411,10 @@ public void handleDMLStmt(ExecPlan execPlan, DmlStmt stmt) {
                         "refresh async START('%s') EVERY(INTERVAL 3 minute)\n" +
                         "PROPERTIES (\n\"replication_num\" = \"1\"\n)\n" +
                         "as select tb1.k1, k2 s2 from tbl1 tb1;",
-                LocalDateTime.now().plusSeconds(3).format(DateUtils.DATE_TIME_FORMATTER)
+                // Start the periodic refresh well after the test ends. A periodic run firing while
+                // testFullCreateSync is checking a partition change would merge the manual refresh
+                // that the check waits for.
+                LocalDateTime.now().plusDays(1).format(DateUtils.DATE_TIME_FORMATTER)
         );
 
         MaterializedView materializedView = getMaterializedViewChecked(sql);
@@ -480,8 +485,15 @@ private void validatePartitionSync(Table baseTable, MaterializedView materialize
     private void executePartitionChange(String sql, String mvTaskName) throws Exception {
         StatementBase statement = SqlParser.parseSingleStatement(sql, connectContext.getSessionVariable().getSqlMode());
         new StmtExecutor(connectContext, statement).execute();
-        GlobalStateMgr.getCurrentState().getTaskManager().executeTask(mvTaskName);
-        waitingTaskFinish(mvTaskName);
+        SubmitResult result = GlobalStateMgr.getCurrentState().getTaskManager().executeTask(mvTaskName);
+        Assertions.assertEquals(SubmitResult.SubmitStatus.SUBMITTED, result.getStatus());
+        // Wait on this run's own future rather than waitingTaskFinish(): the scheduler polls a run out of the
+        // pending queue before putting it into the running map, so for a moment the run is in neither, and
+        // a poll in that window sees only the earlier, finished runs and returns before this run has synced
+        // the partitions. The run must have executed, not been merged into another run.
+        Constants.TaskRunState state = result.getFuture().get(15, TimeUnit.SECONDS);
+        Assertions.assertTrue(state == Constants.TaskRunState.SUCCESS || state == Constants.TaskRunState.SKIPPED,
+                "unexpected task run state: " + state);
     }
 
     @Test
```

---

### Incident Patch 13: `398abaf5` (2026-10-05)
**Commit Message**: [BugFix] Make the Python UDF worker socket name independent of the worker pid (#80083)

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `be/extension/python-udf/src/flight_server.py` (modified, +6/-9)
```diff
@@ -232,20 +232,17 @@ def do_exchange(self, context, descriptor, reader, writer):
                     started = True
                 writer.write_batch(result_batch)
 
-def main(unix_socket_path):
-    location = unix_socket_path
+def main(location):
     server = UDFFlightServer(location)
     print("Pywork start success")
     sys.stdout.flush()
     server.wait()
 
-def build_socket_url(prefix):
-    pid = os.getpid()
-    return prefix + str(pid)
-
 if __name__ == "__main__":
     parser = argparse.ArgumentParser(description="Run an Arrow Flight echo server over Unix socket.")
-    parser.add_argument("unix_socket_path", type=str, help="The path to the Unix socket.")
+    # Full Flight location handed down by BE, e.g. grpc+unix:///.../pyworker_<n>_<rand>.
+    # BE and worker no longer derive the socket name from the pid, so a launcher
+    # wrapper (sandbox) can sit between them without breaking the handshake.
+    parser.add_argument("location", type=str, help="The Flight server location (grpc+unix:// URL).")
     args = parser.parse_args()
-    url = build_socket_url(args.unix_socket_path)
-    main(url)
+    main(args.location)
```

**File**: `be/src/exprs/udf/python/env.cpp` (modified, +60/-16)
```diff
@@ -20,6 +20,7 @@
 #include <poll.h>
 #include <spawn.h>
 #include <sys/poll.h>
+#include <sys/stat.h>
 #include <sys/types.h>
 #include <sys/wait.h>
 #include <unistd.h>
@@ -49,7 +50,17 @@ bool LocalPyWorker::expired() {
 
 void LocalPyWorker::terminate() {
     if (_pid != -1) {
-        kill(_pid, SIGKILL);
+        if (_own_pgroup) {
+            // Group-kill: the child leads its own process group (pgid == _pid), so
+            // this reaps its descendants too -- a worker that spawned processes of
+            // its own, or a wrapper whose real worker is a separate pid, would
+            // otherwise be orphaned by kill(_pid).
+            if (kill(-_pid, SIGKILL) != 0 && errno == ESRCH) {
+                kill(_pid, SIGKILL);
+            }
+        } else {
+            kill(_pid, SIGKILL);
+        }
     }
 }
 
@@ -62,24 +73,52 @@ void LocalPyWorker::wait() {
 }
 
 void LocalPyWorker::remove_unix_socket() {
-    unlink(PyWorkerManager::unix_socket_path(_pid).c_str());
+    if (!_sock_path.empty()) {
+        unlink(_sock_path.c_str());
+    }
 }
 
-std::string PyWorkerManager::unix_socket(pid_t pid) {
-    std::string unix_socket = fmt::format("grpc+unix://{}/pyworker_{}", config::local_library_dir, pid);
-    return unix_socket;
+std::string PyWorkerManager::socket_dir() {
+    return fmt::format("{}/pyworker", config::local_library_dir);
 }
 
-std::string PyWorkerManager::unix_socket_prefix() {
-    std::string unix_socket = fmt::format("grpc+unix://{}/pyworker_", config::local_library_dir);
-    return unix_socket;
+Status PyWorkerManager::ensure_socket_dir() {
+    std::string dir = socket_dir();
+    if (mkdir(dir.c_str(), 0700) != 0 && errno != EEXIST) {
+        return Status::InternalError(fmt::format("create pyworker socket dir {} error: {}", dir, std::strerror(errno)));
+    }
+    // Tighten permissions to the BE user even if the directory pre-existed with
+    // a looser mode: any local user able to reach the socket can drive the
+    // worker's Flight server, which executes arbitrary UDF code.
+    if (chmod(dir.c_str(), 0700) != 0) {
+        return Status::InternalError(fmt::format("chmod pyworker socket dir {} error: {}", dir, std::strerror(errno)));
+    }
+    return Status::OK();
 }
 
-std::string PyWorkerManager::unix_socket_path(pid_t pid) {
-    std::string unix_socket_path = fmt::format("{}/pyworker_{}", config::local_library_dir, pid);
-    return unix_socket_path;
+std::string PyWorkerManager::new_socket_path() {
+    // A process-local counter keeps names unique among live workers; the random
+    // suffix avoids colliding with a stale socket left behind by a prior BE run.
+    static std::atomic<uint64_t> seq{0};
+    uint64_t n = seq.fetch_add(1, std::memory_order_relaxed);
+    uint32_t r = Random::GetTLSInstance()->Next();
+    return fmt::format("{}/pyworker_{}_{:08x}", socket_dir(), n, r);
 }
 
+namespace {
+
+// Ask posix_spawn to put the child in a process group of its own (pgid == child pid), so
+// terminate() can group-kill and reap the whole subtree, not just this one process.
+// Returns whether the attributes were accepted.
+bool spawn_in_own_process_group(posix_spawnattr_t* attrs) {
+    short flags = 0;
+    posix_spawnattr_getflags(attrs, &flags);
+    return posix_spawnattr_setpgroup(attrs, 0) == 0 &&
+           posix_spawnattr_setflags(attrs, static_cast<short>(flags | POSIX_SPAWN_SETPGROUP)) == 0;
+}
+
+} // namespace
+
 Status PyWorkerManager::_fork_py_worker(std::unique_ptr<LocalPyWorker>* child_process) {
     ASSIGN_OR_RETURN(auto py_env, global_python_env_registry().getDefault());
 
@@ -139,13 +178,16 @@ Status PyWorkerManager::_fork_py_worker(std::unique_ptr<LocalPyWorker>* child_pr
     }
 #endif
 
+    RETURN_IF_ERROR(ensure_socket_dir());
     std::string script = PyWorkerManager::bootstrap();
-    std::string unix_socket = PyWorkerManager::unix_socket_prefix();
-    std::string python_home_env = fmt::format("PYTHONHOME={}", py_env.home);
+    std::string sock_path = new_socket_path();
+    std::string sock_url = "grpc+unix://" + sock_path;
 
-    const char* args[] = {"python3", script.c_str(), unix_socket.c_str(), nullptr};
+    std::string python_home_env = fmt::format("PYTHONHOME={}", py_env.home);
+    const char* args[] = {"python3", script.c_str(), sock_url.c_str(), nullptr};
     const char* envs[] = {python_home_env.c_str(), nullptr};
 
+    bool own_pgroup = spawn_in_own_process_group(&attrs);
     int rc = posix_spawnp(&pid, python_path.c_str(), &actions, &attrs, const_cast<char* const*>(args),
                           const_cast<char* const*>(envs));
     close(pipefd[1]);
@@ -154,7 +196,9 @@ Status PyWorkerManager::_fork_py_worker(std::unique_ptr<LocalPyWorker>* child_pr
         return Status::InternalError(fmt::format("posix_spawnp failed: {}", std::strerror(rc)));
     }
 
-    *child_process = std::make_unique<LocalPyWorker>(pid);
+    // The worker owns its socket path from here on, so every failure and cleanup path

```

**File**: `be/src/exprs/udf/python/env.h` (modified, +19/-7)
```diff
@@ -62,16 +62,23 @@ class PyWorker {
 // reaps it when it dies or expires.
 class LocalPyWorker final : public PyWorker {
 public:
-    explicit LocalPyWorker(pid_t pid) : _pid(pid) {}
+    // sock_path is the worker's unix socket, chosen by PyWorkerManager before the spawn and
+    // kept independent of the pid, so it stays valid even when the worker is not the BE's
+    // direct child. own_pgroup says the child leads its own process group (pgid == pid),
+    // which lets terminate() group-kill and reap its descendants as well.
+    LocalPyWorker(pid_t pid, std::string sock_path, bool own_pgroup)
+            : _sock_path(std::move(sock_path)), _pid(pid), _own_pgroup(own_pgroup) {}
     ~LocalPyWorker() override { terminate_and_wait(); }
 
     void terminate();
     void wait();
     void terminate_and_wait() override {
         lock_free_call_once(_once, [this]() {
             terminate();
-            remove_unix_socket();
+            // Reap the process (whole group) BEFORE unlinking the socket, so the
+            // path is never removed while a worker is still using it.
             wait();
+            remove_unix_socket();
         });
     }
     void remove_unix_socket();
@@ -89,7 +96,9 @@ class LocalPyWorker final : public PyWorker {
     std::atomic<bool> _once{};
     bool _is_dead{};
     std::string _url;
+    std::string _sock_path;
     pid_t _pid = -1;
+    bool _own_pgroup = false;
     int64_t _last_touch_time = 0;
 };
 
@@ -120,11 +129,8 @@ class PyWorkerManager {
 
     StatusOr<WorkerClientPtr> get_client(const PyFunctionDescriptor& func_desc);
 
-    static std::string unix_socket(pid_t pid);
-
-    static std::string unix_socket_prefix();
-
-    static std::string unix_socket_path(pid_t pid);
+    // Directory that holds the worker unix sockets (created 0700 on first use).
+    static std::string socket_dir();
 
     static std::string bootstrap() {
         const char* server_main = "flight_server.py";
@@ -134,6 +140,12 @@ class PyWorkerManager {
     void cleanup_expired_worker();
 
 private:
+    // Ensure socket_dir() exists and is restricted to the BE user (0700).
+    static Status ensure_socket_dir();
+    // A fresh, collision-free unix socket path under socket_dir(). Independent
+    // of pid so BE and worker agree on the name without deriving it from one.
+    static std::string new_socket_path();
+
     Status _fork_py_worker(std::unique_ptr<LocalPyWorker>* child_process);
     StatusOr<std::shared_ptr<PyWorker>> _acquire_worker(int32_t driver_id, size_t reusable, std::string* url);
 
```

**File**: `be/test/exprs/udf/python/env_test.cpp` (modified, +94/-1)
```diff
@@ -15,9 +15,12 @@
 #include "exprs/udf/python/env.h"
 
 #include <fcntl.h>
+#include <fmt/format.h>
 #include <gtest/gtest.h>
+#include <signal.h>
 #include <unistd.h>
 
+#include <cerrno>
 #include <cstdlib>
 #include <filesystem>
 #include <fstream>
@@ -88,14 +91,17 @@ class PyWorkerManagerEnvTest : public testing::Test {
         std::filesystem::create_directories(bin_dir);
         auto python_path = bin_dir / "python3";
 
+        _grandchild_pid_file = _test_dir / "grandchild.pid";
         std::ofstream python(python_path);
         python << "#!/bin/sh\n"
                << "if [ -e /proc/self/fd/" << _leaked_fd << " ] || [ -e /dev/fd/" << _leaked_fd << " ]; then\n"
                << "  printf 'leaked fd " << _leaked_fd << "'\n"
                << "else\n"
                << "  printf 'Pywork start success'\n"
                << "fi\n"
-               << "/bin/sleep 30\n";
+               << "/bin/sleep 30 &\n"
+               << "echo $! > " << _grandchild_pid_file << "\n"
+               << "wait\n";
         python.close();
 
         std::filesystem::permissions(python_path,
@@ -105,9 +111,46 @@ class PyWorkerManagerEnvTest : public testing::Test {
         ASSERT_OK(global_python_env_registry().init({_python_env.string()}));
     }
 
+    // A process the kill reached is left a zombie until whoever adopted it reaps it, which
+    // nothing necessarily does inside a container, and a zombie still answers kill(pid, 0).
+    static bool is_zombie(pid_t pid) {
+        std::ifstream stat(fmt::format("/proc/{}/stat", pid));
+        std::string line;
+        if (!std::getline(stat, line)) {
+            return false;
+        }
+        // "<pid> (<comm>) <state> ...", and comm itself may hold spaces and parentheses.
+        auto comm_end = line.rfind(')');
+        return comm_end != std::string::npos && comm_end + 2 < line.size() && line[comm_end + 2] == 'Z';
+    }
+
+    // Wait for a process the worker spawned to be gone, up to two seconds.
+    static bool wait_until_gone(pid_t pid) {
+        for (int i = 0; i < 200; ++i) {
+            if ((kill(pid, 0) != 0 && errno == ESRCH) || is_zombie(pid)) {
+                return true;
+            }
+            usleep(10 * 1000);
+        }
+        return false;
+    }
+
+    pid_t read_grandchild_pid() {
+        for (int i = 0; i < 100; ++i) {
+            std::ifstream in(_grandchild_pid_file);
+            pid_t pid = 0;
+            if (in >> pid && pid > 0) {
+                return pid;
+            }
+            usleep(10 * 1000);
+        }
+        return -1;
+    }
+
     std::filesystem::path _test_dir;
     std::filesystem::path _starrocks_home;
     std::filesystem::path _python_env;
+    std::filesystem::path _grandchild_pid_file;
     std::unordered_map<std::string, PythonEnv> _saved_envs;
     std::optional<std::string> _saved_starrocks_home;
     std::string _saved_local_library_dir;
@@ -131,6 +174,56 @@ TEST_F(PyWorkerManagerEnvTest, fork_py_worker_closes_inherited_descriptors) {
     child_process->terminate_and_wait();
 }
 
+// The worker's socket name used to be derived from its pid on both sides (the BE passed a
+// prefix, the worker appended getpid()), which only holds while the worker is the BE's direct
+// child, and left the socket readable by any local user.
+TEST_F(PyWorkerManagerEnvTest, worker_socket_is_pid_independent_and_private) {
+    ASSERT_NO_FATAL_FAILURE(create_fake_python_env());
+
+    std::unique_ptr<LocalPyWorker> first;
+    ASSERT_OK(PyWorkerManager::getInstance()._fork_py_worker(&first));
+    std::unique_ptr<LocalPyWorker> second;
+    ASSERT_OK(PyWorkerManager::getInstance()._fork_py_worker(&second));
+
+    // Anyone who reaches a worker's unauthenticated Flight endpoint runs code as the BE user,
+    // so the directory holding the sockets must be the BE user's alone.
+    auto dir = std::filesystem::path(PyWorkerManager::socket_dir());
+    ASSERT_TRUE(std::filesystem::is_directory(dir));
+    EXPECT_EQ(std::filesystem::perms::owner_all, std::filesystem::status(dir).permissions());
+
+    EXPECT_NE(first->_sock_path, second->_sock_path);
+    for (const auto* worker : {first.get(), second.get()}) {
+        EXPECT_EQ(dir, std::filesystem::path(worker->_sock_path).parent_path());
+        // The BE and the worker agree on the socket because the BE hands down the whole
+        // location, not because both compute the same name from the pid.
+        EXPECT_EQ("grpc+unix://" + worker->_sock_path, worker->url());
+        EXPECT_NE((dir / fmt::format("pyworker_{}", worker->_pid)).string(), worker->_sock_path);
+    }
+
+    first->terminate_and_wait();
+    second->terminate_and_wait();
+}
+
+// Killing only the worker process leaves whatever it spawned behind; the worker leads its own
+// process group so that terminating it reaps the subtree.
+TEST_F(PyWorkerManagerEnvTest, terminating_a_worker_reaps_what_it_spawned) {
+    ASSERT_NO_FATAL_FAILURE(create_fake_python_env());
+
+    std::uniq
```

**File**: `bin/common.sh` (modified, +18/-0)
```diff
@@ -214,3 +214,21 @@ check_and_update_max_processes() {
     fi
 }
 
+# Kill the python UDF worker processes this instance spawned, then remove their sockets.
+# Workers live under $UDF_RUNTIME_DIR/pyworker, which is derived from this instance's
+# STARROCKS_HOME, so several instances on one host reap only their own. Their socket name
+# does not encode the worker pid, so they are matched by that directory in their command
+# line rather than by a pid parsed out of the file name -- which also keeps working when a
+# launcher sits between the instance and its workers. The directory is escaped before it
+# goes into the pattern: a deployment path may contain regex metacharacters.
+reap_python_udf_workers() {
+    local worker_dir="${UDF_RUNTIME_DIR}/pyworker"
+    if [[ -z "${UDF_RUNTIME_DIR}" || ! -d "$worker_dir" ]]; then
+        return 0
+    fi
+    local escaped_dir
+    escaped_dir=$(printf '%s' "${worker_dir}/" | sed 's/[][\\.*+?(){}|^$]/\\&/g')
+    pkill -9 -f "flight_server\.py .*${escaped_dir}" > /dev/null 2>&1
+    rm -rf "$worker_dir" > /dev/null 2>&1
+}
+
```

**File**: `bin/stop_be.sh` (modified, +2/-8)
```diff
@@ -76,14 +76,8 @@ while true; do
     esac
 done
 
-# kill all python worker process
-find "${UDF_RUNTIME_DIR}" -maxdepth 1 -name 'pyworker*' -print0 | while IFS= read -r -d $'\0' worker; do
-    pid=$(echo "$worker" | sed -n 's/.*pyworker_\([0-9]*\).*/\1/p')
-    if [[ ! -z "$pid" ]]; then
-        kill -9 "$pid" > /dev/null
-        rm -- "$worker"
-    fi
-done
+# kill all python UDF worker processes spawned by this BE, then remove their sockets
+reap_python_udf_workers
 
 
 # Stop profile collection daemon first
```

**File**: `bin/stop_cn.sh` (modified, +2/-8)
```diff
@@ -76,14 +76,8 @@ while true; do
     esac
 done
 
-# kill all python worker process
-find "${UDF_RUNTIME_DIR}" -maxdepth 1 -name 'pyworker*' -print0 | while IFS= read -r -d $'\0' worker; do
-    pid=$(echo "$worker" | sed -n 's/.*pyworker_\([0-9]*\).*/\1/p')
-    if [[ ! -z "$pid" ]]; then
-        kill -9 "$pid" > /dev/null
-        rm -- "$worker"
-    fi
-done
+# kill all python UDF worker processes spawned by this CN, then remove their sockets
+reap_python_udf_workers
 
 
 if [ -f $pidfile ]; then
```

---

### Incident Patch 14: `dbd7cb21` (2026-10-05)
**Commit Message**: [UT] Fix flaky LakeReplicationJobTest caused by async publish of committed replication txn (#80078)

Signed-off-by: trueeyu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `fe/fe-core/src/test/java/com/starrocks/replication/LakeReplicationJobTest.java` (modified, +21/-0)
```diff
@@ -41,10 +41,12 @@
 import com.starrocks.thrift.TReplicateSnapshotRequest;
 import com.starrocks.thrift.TStatus;
 import com.starrocks.thrift.TStatusCode;
+import com.starrocks.transaction.TransactionState;
 import com.starrocks.utframe.StarRocksAssert;
 import com.starrocks.utframe.UtFrameUtils;
 import mockit.Mock;
 import mockit.MockUp;
+import org.junit.jupiter.api.AfterEach;
 import org.junit.jupiter.api.Assertions;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.BeforeEach;
@@ -53,6 +55,7 @@
 import java.util.Arrays;
 import java.util.HashMap;
 import java.util.Map;
+import java.util.concurrent.TimeUnit;
 
 public class LakeReplicationJobTest {
     protected static StarRocksAssert starRocksAssert;
@@ -110,6 +113,24 @@ public void setUp() throws Exception {
                 GlobalStateMgr.getCurrentState().getNodeMgr().getClusterInfo());
     }
 
+    @AfterEach
+    public void tearDown() throws InterruptedException {
+        // A committed replication transaction is published asynchronously by PublishVersionDaemon, which sets
+        // the data version of the shared partition. Wait for the publish to finish, otherwise it may overwrite
+        // the versions set by the next test's setUp() and fail the "publish version not finished" check.
+        // Wait on the visible latch instead of polling the status: the status becomes VISIBLE before
+        // updateCatalogAfterVisible() updates the partition, while notifyVisible() is called after it.
+        if (job == null || job.getState() != ReplicationJobState.COMMITTED) {
+            return;
+        }
+        TransactionState txnState = GlobalStateMgr.getCurrentState().getGlobalTransactionMgr()
+                .getTransactionState(db.getId(), job.getTransactionId());
+        Assertions.assertNotNull(txnState, "Committed replication transaction " + job.getTransactionId()
+                + " not found");
+        Assertions.assertTrue(txnState.waitTransactionVisible(60, TimeUnit.SECONDS),
+                "Replication transaction " + job.getTransactionId() + " is not visible in time");
+    }
+
     @Test
     public void testNormal() throws Exception {
         Assertions.assertFalse(ReplicationJobState.INITIALIZING.equals(job));
```

---

### Incident Patch 15: `0af9c328` (2026-10-05)
**Commit Message**: [UT] Avoid GCC 14 -Wstringop-overflow false positives in SIMD tests (#80070)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `be/test/base/simd/rle_simd_test.cpp` (modified, +8/-3)
```diff
@@ -66,14 +66,19 @@ PARALLEL_TEST(RleSimdTest, simd_fill_int32) {
 
 template <class T>
 static void test_simdutils_fill(T value, T sentinel) {
+    constexpr size_t kMaxCount = 257;
     for (size_t n :
-         {size_t{0}, size_t{1}, size_t{15}, size_t{16}, size_t{31}, size_t{32}, size_t{63}, size_t{64}, size_t{257}}) {
-        std::vector<T> dst(n + 1, sentinel);
+         {size_t{0}, size_t{1}, size_t{15}, size_t{16}, size_t{31}, size_t{32}, size_t{63}, size_t{64}, kMaxCount}) {
+        // Size the buffer independently of n. With dst(n + 1), GCC jump-threads the n == SIZE_MAX path, where n + 1
+        // wraps to 0 and the vector is empty, and reports a bogus -Wstringop-overflow on the memset in fill_n.
+        std::vector<T> dst(kMaxCount + 1, sentinel);
         SIMDUtils::simd_fill<T>(dst.data(), value, n);
         for (size_t i = 0; i < n; ++i) {
             ASSERT_EQ(dst[i], value) << "n=" << n << " i=" << i << " sizeof(T)=" << sizeof(T);
         }
-        ASSERT_EQ(dst.back(), sentinel) << "n=" << n << " sentinel";
+        for (size_t i = n; i < dst.size(); ++i) {
+            ASSERT_EQ(dst[i], sentinel) << "n=" << n << " i=" << i << " sentinel";
+        }
     }
 }
 
```

**File**: `be/test/base/simd/simd_expand_test.cpp` (modified, +6/-10)
```diff
@@ -79,17 +79,13 @@ void test_expand_load() {
 
         std::vector<uint8_t> nulls;
         nulls.resize(chunk_size);
-        std::vector<uint8_t> pattern(8);
+        // Enumerate every non-zero 8-bit null pattern. Iterating the masks directly instead of using
+        // std::next_permutation avoids a GCC -Wstringop-overflow false positive on the vectorized std::reverse.
         size_t i = 0;
-        for (int k = 1; k <= 8; ++k) {
-            std::fill(pattern.begin(), pattern.end(), 0);
-            std::fill(pattern.begin(), pattern.begin() + k, 1);
-
-            do {
-                for (int j = 0; j < 8; ++j) {
-                    nulls[i++] = pattern[j];
-                }
-            } while (std::next_permutation(pattern.begin(), pattern.end()) && i + 8 < chunk_size);
+        for (uint32_t mask = 1; mask < 256 && i + 8 < chunk_size; ++mask) {
+            for (int j = 0; j < 8; ++j) {
+                nulls[i++] = (mask >> j) & 1;
+            }
         }
 
         std::vector<CppType> dsts1(chunk_size);
```

#### Recent Merged Pull Requests:
- **PR #80140** (closed): [BugFix] Resolve base tables before the MV lock when activating an MV (backport #79972) (@mergify[bot])
- **PR #80139** (closed): [BugFix] Resolve base tables before the MV lock when activating an MV (backport #79972) (@mergify[bot])
- **PR #80137** (closed): [BugFix] Enqueue a finished transaction only once in finalStatusTransactionStateDeque (backport #79988) (@mergify[bot])
- **PR #80136** (closed): [BugFix] Enqueue a finished transaction only once in finalStatusTransactionStateDeque (backport #79988) (@mergify[bot])
- **PR #80135** (closed): [BugFix] Replay MV activation without re-analyzing its definition under the MV lock (backport #79973) (@mergify[bot])
- **PR #80134** (closed): [BugFix] Replay MV activation without re-analyzing its definition under the MV lock (backport #79973) (@mergify[bot])
- **PR #80133** (closed): [BugFix] Keep MV refresh change detection, plan build and partition add off connector I/O under FE metadata locks (backport #79971) (@mergify[bot])
- **PR #80132** (closed): [BugFix] Keep MV refresh change detection, plan build and partition add off connector I/O under FE metadata locks (backport #79971) (@mergify[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
