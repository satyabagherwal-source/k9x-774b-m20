# Forensic Learning Record (Deep Inspection): infiniflow/infinity

> **Canonical Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:16:03.309Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4728 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/common/base_profiler.cpp`
```
//
// Created by JinHai on 2022/9/5.
//

#include <sstream>

#include "base_profiler.h"

namespace infinity {

void BaseProfiler::Begin() {
    finished_ = false;
    begin_ts_ = Now();
}

void BaseProfiler::End() {
    if (finished_)
        return;
    end_ts_ = Now();
    finished_ = true;
}

std::chrono::nanoseconds BaseProfiler::ElapsedInternal() const {
    auto now = finished_ ? end_ts_ : Now();
    return now - begin_ts_;
}

std::string BaseProfiler::ElapsedToString() const {
    auto duration = this->ElapsedInternal();
    std::stringstream ss;
    if (duration.count() <= 1000) {
        ss << duration.count() << "ns";
    } else if (duration.count() <= 1000 * 1000) {
        ss << std::chrono::duration_cast<std::chrono::microseconds>(duration).count() << "us";
    } else if (duration.count() <= 1000 * 1000 * 1000) {
        ss << std::chrono::duration_cast<std::chrono::milliseconds>(duration).count() << "ms";
    } else {
        ss << std::chrono::duration_cast<std::chrono::seconds>(duration).count() << "s";
    }
    return ss.str();
}

int BaseProfiler::ElapsedToMs() const {
    std::stringstream ss;
    auto duration = this->ElapsedInternal();
    ss << std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
    int ret;
    ss >> ret;
    return ret;
}
} // namespace infinity

```

### Core Architecture Module: `benchmark/common/base_profiler.h`
```
//
// Created by JinHai on 2022/9/5.
//

#pragma once

#include <chrono>
#include <string>

namespace infinity {

class BaseProfiler {
public:
    BaseProfiler() = default;

    explicit BaseProfiler(std::string name) : name_(std::move(name)) {}

    // Start the profiler
    void Begin();

    // End the profiler
    void End();

    [[nodiscard]] std::string ElapsedToString() const;

    [[nodiscard]] int ElapsedToMs() const;

    // Return the elapsed time from begin, if the profiler is ended, it will return total elapsed time.
    [[nodiscard]] inline int64_t Elapsed() const { return ElapsedInternal().count(); }

    [[nodiscard]] const std::string &name() const { return name_; }
    void set_name(const std::string &name) { name_ = name; }

private:
    [[nodiscard]] static inline std::chrono::time_point<std::chrono::high_resolution_clock> Now() {
        return std::chrono::high_resolution_clock::now();
    }

    [[nodiscard]] std::chrono::nanoseconds ElapsedInternal() const;

    std::chrono::time_point<std::chrono::high_resolution_clock> begin_ts_{};
    std::chrono::time_point<std::chrono::high_resolution_clock> end_ts_{};

    bool finished_ = false;
    std::string name_{};
};

} // namespace infinity

```

### Core Architecture Module: `benchmark/common/mpsc_queue.h`
```
// Copyright (c) 2020 Dolev
// MIT License
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// This MPSC queue comes from Dolev Adas
// https://arxiv.org/abs/2010.14189
// Jiffy: A Fast, Memory Efficient, Wait-Free Multi-Producers Single-Consumer Queue
//
#pragma once

#include <atomic>
#include <iostream>
#include <stdlib.h>
#include <string.h>
#include <thread>

namespace infinity {

#define QUEUE_PAGE_SIZE 4096
#define CACHE_LINE_SIZE 64
#define NODE_SIZE 1620
static inline void *align_malloc(size_t align, size_t size) {
    void *ptr;
    int ret = posix_memalign(&ptr, align, size);
    if (ret != 0) {
        abort();
    }
    return ptr;
}

template <class T>
class MPSCQueue {
private:
    struct Node {
        Node() : data_(), is_set_(0) {}

        Node(T d) : data_(d), is_set_(0) {}

        Node(const Node &n) {
            data_ = n.data_;
            is_set_ = n.is_set_;
        }

        T data_;

        std::atomic<char> is_set_; // if the node and its data are valid.  0- empty  , 1- set , 2 - handled
    };

    typedef char cache_line_pad[64];

    struct BufferList {
        BufferList() : next_(NULL), prev_(NULL), head_(0), position_in_queue_(0) {}
        BufferList(unsigned int buffer_size_z) : next_(NULL), prev_(NULL), head_(0), position_in_queue_(1) {
            memset(curr_buffer_, 0, NODE_SIZE * sizeof(Node));
        }
        BufferList(unsigned int buffer_size_z, unsigned int position_in_queue, BufferList *prev)
            : next_(NULL), prev_(prev), head_(0), position_in_queue_(position_in_queue) {
            memset(curr_buffer_, 0, NODE_SIZE * sizeof(Node));
        }

        alignas(CACHE_LINE_SIZE) Node curr_buffer_[NODE_SIZE];

        std::atomic<BufferList *> next_ alignas(CACHE_LINE_SIZE);

        BufferList *prev_ alignas(CACHE_LINE_SIZE);

        unsigned int head_; // we have one thread that takes out elelemts and it is the only one that moves the head_

        unsigned int position_in_queue_; // start with 1
    };

    unsigned int buffer_size_;
    BufferList *head_of_queue_; // the first array that contains data for the thread that takes elements from the queue (for the single consumer)
    std::atomic<BufferList *>
        tail_of_queue_ alignas(CACHE_LINE_SIZE);               // the beginning of the last array which we insert elements into (for the producers)
    std::atomic<uint_fast64_t> tail_ alignas(CACHE_LINE_SIZE); // we need a global tail so the queue will be wait free - if not the queue is look free

public:
    MPSCQueue(unsigned int size) : buffer_size_(NODE_SIZE), tail_of_queue_(NULL), tail_(0) {
        void *buffer = align_malloc(QUEUE_PAGE_SIZE, sizeof(BufferList));
        head_of_queue_ = new (buffer) BufferList(buffer_size_);
        tail_of_queue_ = head_of_queue_;
    }
    MPSCQueue() : buffer_size_(NODE_SIZE), tail_of_queue_(NULL), tail_(0) {
        void *buffer = align_malloc(QUEUE_PAGE_SIZE, sizeof(BufferList));
        head_of_queue_ = new (buffer) BufferList(buffer_size_);
        tail_of_queue_ = head_of_queue_;
    }

    ~MPSCQueue() {

        while (head_of_queue_->next_.load(std::memory_order_acquire) != NULL) {
            BufferList *next = head_of_queue_->next_.load(std::memory_order_acquire);
            free(head_of_queue_);
            head_of_queue_ = next;
        }
        free(head_of_queue_);
    }

    // return false if the queue is empty
    bool dequeue(T &data) {
        while (true) {
            BufferList *temp_tail = tail_of_queue_.load(std::memory_order_seq_cst);
            unsigned int prev_size = buffer_size_ * (temp_tail->position_in_queue_ - 1);
            if ((head_of_queue_ == tail_of_queue_.load(std::memory_order_acquire)) &&
                (head_of_queue_->head_ == (tail_.load(std::memory_order_acquire) - prev_size))) { // the queue is empty
                // empty
                return false;
            } else if (head_of_queue_->head_ < buffer_size_) { // there is elements in the current array.
                Node *n = &(head_of_queue_->curr_buffer_[head_of_queue_->head_]);
                if (n->is_set_.load(std::memory_order_acquire) == 2) {
                    head_of_queue_->head_++;
                    continue;
                }

                BufferList *temphead_of_queue = head_of_queue_;
                unsigned int temphead = temphead_of_queue->head_;
                bool flag_move_to_new_buffer = false, flag_buffer_all_handeld = true;

                while (n->is_set_.load(std::memory_order_acquire) == 0) { // is not set yet - try to take out set elements that are next_ in line

                    if (temphead < buffer_size_) { // there is elements in the current array.
                        Node *tn = &(temphead_of_queue->curr_buffer_[temphead++]);
                        if (tn->is_set_.load(std::memory_order_acquire) == 1 &&
                            n->is_set_.load(std::memory_order_acquire) ==
                                0) { // the data is valid and the element in the head_ is still in insert process

                            //************* scan****************************
                            BufferList *scanhead_of_queue = head_of_queue_;
                            for (unsigned int scanhead = scanhead_of_queue->head_;
                                 (scanhead_of_queue != temphead_of_queue ||
                                  (scanhead < (temphead - 1) && n->is_set_.load(std::memory_order_acquire) == 0));
                                 scanhead++) {
                                if (scanhead >= buffer_size_) { // we reach the end of the buffer -move to the next_
                                    scanhead_of_queue = scanhead_of_queue->next_.load(std::memory_order_acquire);
                                    scanhead = scanhead_of_queue->head_;
                                    continue;
                                }
                                Node *scanN = &(scanhead_of_queue->curr_buffer_[scanhead]);
                                if (scanN->is_set_.load(std::memory_order_acquire) ==
                                    1) { // there is another element that is set - the scan start again until him
                                    // this is the new item to be evicted
                                    temphead = scanhead;
                                    temphead_of_queue = scanhead_of_queue;
                                    tn = scanN;

                                    scanhead_of_queue = head_of_queue_;
                                    scanhead = scanhead_of_queue->head_;
                                }
                            }

                            if (n->is_set_.load(std::memory_order_acquire) == 1) {
                                break;
                            }
                            //************* scan  end ****************************

                            data = tn->data_;
                            tn
```

### Core Architecture Module: `benchmark/common/query_profiler.cpp`
```
//
// Created by JinHai on 2022/9/5.
//

#include "query_profiler.h"

#include <cstdio>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace infinity {

void OptimizerProfiler::StartRule(const std::string &rule_name) {
    profilers_.emplace_back(rule_name);
    profilers_.back().Begin();
}

void OptimizerProfiler::StopRule() { profilers_.back().End(); }

std::string OptimizerProfiler::ToString(size_t intent) const {
    std::stringstream ss;
    std::string space(intent, ' ');
    for (auto &profiler : profilers_) {
        ss << space << profiler.name() << ": " << profiler.ElapsedToString() << std::endl;
    }

    return ss.str();
}

std::string QueryProfiler::QueryPhaseToString(QueryPhase phase) {
    switch (phase) {
        case QueryPhase::kParser:
            return "Parser";
        case QueryPhase::kLogicalPlan:
            return "LogicalPlan";
        case QueryPhase::kOptimizer:
            return "Optimizer";
        case QueryPhase::kPhysicalPlan:
            return "PhysicalPlan";
        case QueryPhase::kPipelineBuild:
            return "PipelineBuild";
        case QueryPhase::kTaskBuild:
            return "TaskBuild";
        case QueryPhase::kExecution:
            return "Execution";
        default: {
            std::cerr << "Invalid query phase in query profiler" << std::endl;
            assert(false);
        }
    }
    return {};
}

void QueryProfiler::StartPhase(QueryPhase phase) {
    size_t phase_idx = magic_enum::enum_integer(phase);

    // Validate current query phase.
    if (current_phase_ == QueryPhase::kInvalid) {
        current_phase_ = phase;
    } else {
        std::cerr << "Can't start new query phase before current phase(" + QueryPhaseToString(current_phase_) + ") is finished" << std::endl;
        assert(false);
    }

    profilers_[phase_idx].set_name(QueryPhaseToString(phase));
    profilers_[phase_idx].Begin();
}

void QueryProfiler::StopPhase(QueryPhase phase) {
    // Validate current query phase.
    if (current_phase_ == QueryPhase::kInvalid) {
        std::cerr << "Query phase isn't started, yet" << std::endl;
        assert(false);
    }

    current_phase_ = QueryPhase::kInvalid;
    profilers_[magic_enum::enum_integer(phase)].End();
}

std::string QueryProfiler::ToString() const {
    std::stringstream ss;
    constexpr size_t profilers_count = magic_enum::enum_integer(QueryPhase::kInvalid);

    double cost_sum = 0;
    for (size_t idx = 0; idx < profilers_count; ++idx) {
        const BaseProfiler &profiler = profilers_[idx];
        cost_sum += static_cast<double>(profiler.Elapsed());
    }

    ss.setf(std::ios_base::fixed, std::ios_base::floatfield);
    ss.setf(std::ios_base::showpoint);
    ss.precision(2);
    for (size_t idx = 0; idx < profilers_count; ++idx) {
        const BaseProfiler &profiler = profilers_[idx];
        ss << profiler.name() << ": " << profiler.ElapsedToString() << "(" << static_cast<double>(profiler.Elapsed() * 100) / cost_sum << "%)"
           << std::endl;
        if (magic_enum::enum_value<QueryPhase>(idx) == QueryPhase::kOptimizer) {
            ss << optimizer_.ToString(4) << std::endl;
        }
    }
    return ss.str();
}

} // namespace infinity

```

### Core Architecture Module: `benchmark/common/query_profiler.h`
```
//
// Created by JinHai on 2022/9/5.
//

#pragma once

#include "base_profiler.h"
#include <magic_enum/magic_enum.hpp>
#include <vector>

namespace infinity {

enum class QueryPhase : int8_t {
    kParser = 0,
    kLogicalPlan,
    kOptimizer,
    kPhysicalPlan,
    kPipelineBuild,
    kTaskBuild,
    kExecution,
    kInvalid,
};

class OptimizerProfiler {
public:
    void StartRule(const std::string &rule_name);

    void StopRule();

    [[nodiscard]] std::string ToString(size_t intent = 0) const;

private:
    std::vector<BaseProfiler> profilers_;
};

class QueryProfiler {
public:
    void StartPhase(QueryPhase phase);

    void StopPhase(QueryPhase phase);

    OptimizerProfiler &optimizer() { return optimizer_; }

    [[nodiscard]] std::string ToString() const;

    static std::string QueryPhaseToString(QueryPhase phase);

private:
    std::vector<BaseProfiler> profilers_{magic_enum::enum_integer(QueryPhase::kInvalid)};
    OptimizerProfiler optimizer_;
    QueryPhase current_phase_{QueryPhase::kInvalid};
};

} // namespace infinity

```

### Core Architecture Module: `benchmark/common/threadutil.h`
```
#pragma once

#include <chrono>
#include <cstdint>
#include <iostream>
#include <thread>

namespace infinity {

// Encapsulates methods for thread access.
class ThreadUtil {
public:
    static bool pin(std::thread &thread, const std::uint16_t cpu_id) {
#if defined(__APPLE__)
        return false;
#else
        cpu_set_t cpu_set;
        CPU_ZERO(&cpu_set);
        CPU_SET(cpu_id, &cpu_set);

        if (pthread_setaffinity_np(thread.native_handle(), sizeof(cpu_set_t), &cpu_set) != 0) {
            std::cerr << "Can not pin thread!" << std::endl;
            return false;
        }
        return true;
#endif
    }
};
} // namespace infinity
```

### Core Architecture Module: `benchmark/local_infinity/fulltext/fulltext_benchmark.cpp`
```
// Copyright(C) 2023 InfiniFlow, Inc. All rights reserved.
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

#include "toml.hpp"

#include <unistd.h>
#ifdef ENABLE_JEMALLOC_PROF
#include <jemalloc/jemalloc.h>
#endif

import std;
#include <cassert>
#include <signal.h>
import infinity_core;

using std::size_t;
import compilation_config;
import internal_types;
import logical_type;
import create_index_info;
import column_def;
import data_type;
import extra_ddl_info;
import statement_common;
import parsed_expr;
import constant_expr;
import match_expr;
import function_expr;
import search_expr;
import column_expr;
import insert_row_expr;

using namespace infinity;

void ReadJsonl(std::ifstream &input_file, size_t lines_to_read, std::vector<std::tuple<char *, char *, char *>> &batch) {
    std::string line;
    size_t lines_readed = 0;
    batch.clear();
    static const char *columns[3] = {"id", "title", "text"};
    while (lines_readed < lines_to_read) {
        line.clear();
        std::getline(input_file, line);
        if (input_file.eof())
            break;
        else if (line.length() == 0)
            continue;
        else {
            simdjson::padded_string json_str(line);
            simdjson::parser parser;
            simdjson::document doc = parser.iterate(json_str);
            char *elems[3];
            for (size_t i = 0; i < 3; i++) {
                std::string val_str;
                [[maybe_unused]] auto error = doc[columns[i]].get<std::string>(val_str);
                assert(error == simdjson::SUCCESS);
                char *val_buf = (char *)malloc(val_str.length() + 1);
                memcpy(val_buf, val_str.data(), val_str.length());
                val_buf[val_str.length()] = '\0';
                elems[i] = val_buf;
            }
            batch.push_back({elems[0], elems[1], elems[2]});
            lines_readed++;
        }
    }
}

std::shared_ptr<Infinity> CreateDbAndTable(const std::string &db_name, const std::string &table_name) {
    std::vector<ColumnDef *> column_defs;
    {
        std::string col1_name = "id";
        auto col1_type = std::make_shared<DataType>(LogicalType::kVarchar);
        auto col1_def = new ColumnDef(0, col1_type, std::move(col1_name), std::set<ConstraintType>());
        column_defs.push_back(col1_def);
    }
    {
        std::string col2_name = "title";
        auto col2_type = std::make_shared<DataType>(LogicalType::kVarchar);
        auto col2_def = new ColumnDef(0, col2_type, std::move(col2_name), std::set<ConstraintType>());
        column_defs.push_back(col2_def);
    }
    {
        std::string col3_name = "text";
        auto col3_type = std::make_shared<DataType>(LogicalType::kVarchar);
        auto col3_def = new ColumnDef(0, col3_type, std::move(col3_name), std::set<ConstraintType>());
        column_defs.push_back(col3_def);
    }

    std::string data_path = "/var/infinity";

    Infinity::LocalInit(data_path);
    // SetLogLevel(LogLevel::kTrace);

    std::shared_ptr<Infinity> infinity = Infinity::LocalConnect();
    CreateDatabaseOptions create_db_options;
    create_db_options.conflict_type_ = ConflictType::kIgnore;
    infinity->CreateDatabase(db_name, std::move(create_db_options), "");

    DropTableOptions drop_tb_options;
    drop_tb_options.conflict_type_ = ConflictType::kIgnore;
    infinity->DropTable(db_name, table_name, std::move(drop_tb_options));

    CreateTableOptions create_tb_options;
    create_tb_options.conflict_type_ = ConflictType::kIgnore;
    infinity->CreateTable(db_name, table_name, std::move(column_defs), std::vector<TableConstraint *>{}, std::move(create_tb_options));
    return infinity;
}

void BenchmarkImport(std::shared_ptr<Infinity> infinity, const std::string &db_name, const std::string &table_name, const std::string &import_from) {
    if (!VirtualStore::Exists(import_from)) {
        LOG_ERROR(fmt::format("Data file doesn't exist: {}", import_from));
        return;
    }

    BaseProfiler profiler;

    profiler.Begin();
    ImportOptions import_options;
    std::string extension = std::filesystem::path(import_from).filename().extension().string();
    if (extension == ".jsonl") {
        import_options.copy_file_type_ = CopyFileType::kJSONL;
    } else if (extension == ".json") {
        import_options.copy_file_type_ = CopyFileType::kJSON;
    } else if (extension == ".csv") {
        import_options.copy_file_type_ = CopyFileType::kCSV;
    } else {
        LOG_ERROR(fmt::format("Unsupported file extension: {}", extension));
        return;
    }
    infinity->Import(db_name, table_name, import_from, std::move(import_options));
    LOG_INFO(fmt::format("Import data cost: {}", profiler.ElapsedToString()));
    profiler.End();
}

void BenchmarkInsert(std::shared_ptr<Infinity> infinity,
                     const std::string &db_name,
                     const std::string &table_name,
                     const std::string &insert_from,
                     size_t insert_batch) {
    std::ifstream input_file(insert_from);
    if (!input_file.is_open()) {
        LOG_ERROR(fmt::format("Failed to open file {}", insert_from));
        return;
    }

    BaseProfiler profiler;

    profiler.Begin();
    std::vector<std::tuple<char *, char *, char *>> batch_cache;
    ReadJsonl(input_file, (size_t)(-1), batch_cache);
    size_t num_rows = batch_cache.size();
    LOG_INFO(fmt::format("ReadJsonl {} rows cost: {}", num_rows, profiler.ElapsedToString()));
    profiler.End();

    profiler.Begin();
    std::vector<std::string> orig_columns{"id", "title", "text"};
    std::unique_ptr<ConstantExpr> const_expr;
    size_t num_inserted = 0;
    while (num_inserted < num_rows) {
        auto insert_rows = new std::vector<InsertRowExpr *>();
        insert_rows->reserve(insert_batch);
        for (size_t i = 0; i < insert_batch && (num_inserted + i) < num_rows; i++) {
            auto &t = batch_cache[num_inserted + i];
            auto insert_row = std::make_unique<InsertRowExpr>();
            insert_row->columns_ = orig_columns;
            const_expr = std::make_unique<ConstantExpr>(LiteralType::kString);
            const_expr->str_value_ = std::get<0>(t);
            insert_row->values_.emplace_back(std::move(const_expr));
            const_expr = std::make_unique<ConstantExpr>(LiteralType::kString);
            const_expr->str_value_ = std::get<1>(t);
            insert_row->values_.emplace_back(std::move(const_expr));
            const_expr = std::make_unique<ConstantExpr>(LiteralType::kString);
            const_expr->str_value_ = std::get<2>(t);
            insert_row->values_.emplace_back(std::move(const_expr));
            insert_rows->push_back(insert_row.release());
        }
        infinity->Insert(db_name, table_name, insert_rows);
        // NOTE: ~InsertStatement() has deleted or freed columns, values, value_list, const_expr, const_expr->str_value_
        num_inserted += insert_batch;
    }
    input_file.close();
    LOG_INFO(fmt::format("Insert data {} rows cost: {}", num_rows, profiler.ElapsedToString()));
    profiler.End();
}

void BenchmarkCreateIndex(std::shared_ptr<Infinity> infinity,
                          const std::string &db_name,
                          const std::string &table_name,
                          const std::string &index_name) {
    BaseProfiler profiler;
    profiler.Begin();
    auto index_info = new IndexInfo();
    index_info->index_type_ = IndexType::kFullText;
    index_info->column_name_ = "te
```

### Core Architecture Module: `benchmark/local_infinity/infinity_benchmark.cpp`
```
// Copyright(C) 2023 InfiniFlow, Inc. All rights reserved.
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

import std;
#include <cassert>
import infinity_core;

using std::size_t;
import compilation_config;
import embedding_info;
import logical_type;
import internal_types;
import parsed_expr;
import search_expr;
import column_expr;
import constant_expr;
import update_statement;
import create_index_info;
import extra_ddl_info;
import knn_expr;
import column_def;
import statement_common;
import data_type;
import insert_row_expr;

using namespace infinity;

constexpr u64 second_unit = 1000 * 1000 * 1000;

double Measurement(std::string name,
                   size_t thread_num,
                   size_t times,
                   const std::function<void(size_t, std::shared_ptr<Infinity>, std::thread::id)> &closure) {
    infinity::BaseProfiler profiler(name);
    std::vector<std::thread> threads;
    threads.reserve(thread_num);

    assert(times % thread_num == 0);

    size_t shared_size = times / thread_num;
    for (size_t i = 0; i < thread_num; ++i) {
        threads.emplace_back([=]() {
            std::thread::id thread_id = std::this_thread::get_id();
            std::cout << ">>> std::thread ID: " << thread_id << " <<<" << std::endl;
            for (size_t j = 0; j < shared_size; ++j) {
                std::shared_ptr<Infinity> infinity = Infinity::LocalConnect();
                closure(i * shared_size + j, infinity, thread_id);
                infinity->LocalDisconnect();
            }
        });
    }

    profiler.Begin();
    for (auto &thread : threads) {
        thread.join();
    }
    profiler.End();

    return static_cast<double>(profiler.Elapsed()) / second_unit;
}

int main() {
    size_t thread_num = 16;
    // For Sift1M
    size_t total_times = 100 * 100;

    std::string path = "/var/infinity";

    VirtualStore::CleanupDirectory(path);

    Infinity::LocalInit(path);

    std::cout << ">>> Infinity Benchmark Start <<<" << std::endl;
    std::cout << "std::thread Num: " << thread_num << ", Times: " << total_times << std::endl;

    std::vector<std::string> results;
    // Database
    {
        auto tims_costing_second =
            Measurement("Get Database", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                [[maybe_unused]] auto ignored = infinity->GetDatabase("default_db");
            });
        results.push_back(fmt::format("-> Get Database QPS: {}", total_times / tims_costing_second));
    }
    {
        auto tims_costing_second =
            Measurement("List Databases", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                [[maybe_unused]] auto ignored = infinity->ListDatabases();
            });
        results.push_back(fmt::format("-> List Databases QPS: {}", total_times / tims_costing_second));
    }
    {
        CreateDatabaseOptions create_db_opts;
        auto tims_costing_second =
            Measurement("Create Database", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                [[maybe_unused]] auto ignored = infinity->CreateDatabase(std::to_string(i), create_db_opts, "");
            });
        results.push_back(fmt::format("-> Create Database QPS: {}", total_times / tims_costing_second));
    }

    {
        DropDatabaseOptions drop_db_opts;
        auto tims_costing_second =
            Measurement("Drop Database", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                [[maybe_unused]] auto ignored = infinity->DropDatabase(std::to_string(i), drop_db_opts);
            });
        results.push_back(fmt::format("-> Drop Database QPS: {}", total_times / tims_costing_second));
    }
    // Table
    {
        CreateTableOptions create_table_opts;
        DropTableOptions drop_table_options;

        size_t column_count = 2;
        std::vector<ColumnDef *> column_defs;
        column_defs.reserve(column_count);

        std::shared_ptr<DataType> col_type = std::make_shared<DataType>(LogicalType::kInteger);
        std::string col_name_1 = "col1";
        auto col_def_1 = new ColumnDef(0, col_type, col_name_1, std::set<ConstraintType>());
        column_defs.emplace_back(col_def_1);

        col_type = std::make_shared<DataType>(LogicalType::kInteger);
        std::string col_name_2 = "col2";
        auto col_def_2 = new ColumnDef(1, col_type, col_name_2, std::set<ConstraintType>());
        column_defs.emplace_back(col_def_2);
        {
            // Init Table
            std::shared_ptr<Infinity> infinity = Infinity::LocalConnect();
            //            auto [ database, status ] = infinity->GetDatabase("default_db");
            [[maybe_unused]] auto ignored =
                infinity->CreateTable("default_db", "benchmark_test", column_defs, std::vector<TableConstraint *>(), create_table_opts);
            infinity->LocalDisconnect();
        }
        // {
        //     auto tims_costing_second = Measurement(thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id
        // thread_id) {
        //         [[maybe_unused]] auto ignored = infinity->GetDatabase("default_db")->ListTables();
        //     });
        //     results.push_back(fmt::format("-> List Tables QPS: {}", total_times / tims_costing_second));
        // }
        {
            auto tims_costing_second =
                Measurement("Get Tables", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                    //                auto [ database, status ] = infinity->GetDatabase("default_db");
                    [[maybe_unused]] auto ignored = infinity->GetTable("default_db", "benchmark_test");
                });
            results.push_back(fmt::format("-> Get Tables QPS: {}", total_times / tims_costing_second));
        }
        {
            auto tims_costing_second =
                Measurement("Describe Tables", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                    //                auto [ database, status ] = infinity->GetDatabase("default_db");
                    [[maybe_unused]] auto ignored = infinity->ShowTable("default_db", "benchmark_test");
                });
            results.push_back(fmt::format("-> Describe Tables QPS: {}", total_times / tims_costing_second));
        }
        {
            auto tims_costing_second =
                Measurement("Create Tables", thread_num, total_times, [&](size_t i, std::shared_ptr<Infinity> infinity, std::thread::id thread_id) {
                    size_t column_count = 2;
                    std::vector<ColumnDef *> column_definitions;
                    column_definitions.reserve(column_count);

                    std::shared_ptr<DataType> col_type = std::make_shared<DataType>(LogicalType::kInteger);
                    std::string col_name_1 = "col1";
                    auto col_def_1 = new ColumnDef(0, col_type, col_name_1, std::set<ConstraintType>());
                    column_definitions.emplace_back(col_def_1);

                    col_type = std::make_shared<DataType>(LogicalType::kInteger);
                    std::string col_name_2 = "col2";
                    auto col_def_2 = new ColumnDef(1, col_type, col_name_2, std::set<Constra
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3377** (2026-06-05): **[Bug]: Segmentation fault after upgrading from v0.7.0-dev5 to v0.7.0**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  v0.7.0  ### Other environment information  ```Markdown Debian Kubernetes v1.34.6 ```  ### Actual behavior and How to reproduce it  I had a working RAGFlow v0.25.0 installation (via Helm chart) on a Kubernetes cluster. I scaled down all RAGFlow deployments and stateful sets (UI, minio, mysql,redis, infinity), then I upgraded RAGFlow to v0.25.6 (via Helm chart), all pods started successfully except for Infinity that crashed with the following logs. Currently my RAGFlow installation is broken, any way to recover from it? Thank you  ``` [17:39:50.199] [1] [info] Find wal file: /var/infinity/wal/wal.log.76640 [17:39:50.199] [1] [info] Find wal file: /var/infinity/wal/wal.log.76632 [...lots of these logs...] [17:45:00.293] [1] [info] Find wal file: /var/infinity/wal/wal.log.18 [17:45:00.293] [1] [info] Find wal file: /var/infinity/wal/wal.log.10 [17:45:00.294] [1] [info] Start Wal Replay [17:45:00.520] [1] [warning] TxnManager is null [17:45:00.520] [1] [critical] Error: Segmentation fault [17:45:00.769] [1] [critical]    0# infinity::PrintStacktrace@infinity_core(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&) at /infinity/src/common/utility/exception_impl.cpp:47    1# (anonymous namespace)::SignalHandler(int, siginfo_t*, void*) at /infinity/src/bin/infinity_main.cpp:160    2#      at :0    3#      at :0    4# std::char_trai
  **Post-Mortem & Fix Analysis**:
  > @mginfn Please try to start Infinity following the following steps. ( It might lose data after last checkpoint in Infinity)  1) Back up directory /var/infinity/wal  on Infinity node. 2) In /var/infinity/wal, only keep wal.log, remove other wal log files. 3) Start Infinity
  > Hi @qinling0210, yes it worked! I scaled to 0 the infinity stateful-set, then mounted the volume on a temporary pod to backup directory and delete all war log files except for wal.log. Then scaled to 1 infinity and it started regularly. Thanks

- **Issue #3359** (2026-06-05): **[Bug]: Error: RoaringBitmap::SetTrue: row_index >= count_, row_index: 190600, count_: 150892@src/storage/common/roaring_bitmap.cppm:120 [00:37:59.956] [246] [info] AppendMemIndex ENTER: block_id=39, offset=2655, row_cnt=1**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev6  ### Other environment information  ```Markdown PRETTY_NAME="Ubuntu 24.04.2 LTS" NAME="Ubuntu" VERSION_ID="24.04" VERSION="24.04.2 LTS (Noble Numbat)" VERSION_CODENAME=noble ID=ubuntu ID_LIKE=debian HOME_URL="https://www.ubuntu.com/" SUPPORT_URL="https://help.ubuntu.com/" BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/" PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy" UBUNTU_CODENAME=noble LOGO=ubuntu-logo ```  ### Actual behavior and How to reproduce it  I currently use mirror is infiniflow/infinity: v0.7.0 - dev6 but will still be an error: Txn ID: 9240230, Text: insert statement, Begin TS: 979487, Commit TS: 979488, KV Commit TS: 979489, State: Committed     APPEND table tw_rd_db.ragflow_26ea039b49d611f1876fd3149acf17cf_68b5372a49d611f1af06d3149acf17cf (db_id:  2, table_id: 1) Txn ID: 9240298, Text: insert statement, Begin TS: 979489, Commit TS: 979490, KV Commit TS: 979491, State: Committed     APPEND table tw_rd_db.ragflow_doc_meta_26ea039b49d611f1876fd3149acf17cf (db_id: 2, table_id: 0) Txn ID: 9240307, Text: Select Statement, Begin TS: 979491, Commit TS: 18446744073709551615, KV Commit TS:  18446744073709551615, State: Started Txn ID: 9240305, Text: Select Statement, Begin TS: 979491, Commit TS: 18446744073709551615, KV Commit TS:  18446744073709551615, State: Started Txn ID: 9240299, Text: insert statem
  **Post-Mortem & Fix Analysis**:
  > Txn ID: 15420143, Text: clean up, Begin TS: 1733679, Commit TS: 1733680, KV Commit TS: 1733681, State: Committed  Txn ID: 15420146, Text: checkpoint, Begin TS: 1733681, Commit TS: 1733682, KV Commit TS: 1733683, State: Committed  Txn ID: 15420153, Text: clean up, Begin TS: 1733683, Commit TS: 1733684, KV Commit TS: 1733685, State: Committed  Txn ID: 15420159, Text: checkpoint, Begin TS: 1733685, Commit TS: 1733686, KV Commit TS: 1733687, State: Committed  Txn ID: 15420165, Text: clean up, Begin TS: 1733687, Commit TS: 1733688, KV Commit TS: 1733689, State: Committed  Txn ID: 15420168, Text: checkpoint, Begin TS: 1733689, Commit TS: 1733690, KV Commit TS: 1733691, State: Committed  Txn ID: 15420175, Text: clean up, Begin TS: 1733691, Commit TS: 1733692, KV Commit TS: 1733693, State: Committed  Txn ID: 15420181, Text: checkpoint, Begin TS: 1733693, Commit TS: 1733694, KV Commit TS: 1733695, State: Committed  Txn ID: 15420187, Text: clean up, Begin TS: 1733695, Commit TS: 1733696, KV Comm
  > Hi, can you try with infinity-0.7.0-dev7 or ragflow 0.25.3?  Thank you~ 
  > @luhuan497 , I am closing the issue now. If you find the same issue still occur  in the new version, please feel free to reopen the issue.

- **Issue #3352** (2026-04-02): **[Bug]: debug_amd64_unit_test fails with SIGILL (Illegal instruction) due to CPU feature mismatch between build and test runners**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev5  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  # `debug_amd64_unit_test` fails with SIGILL (Illegal instruction) due to CPU feature mismatch between build and test runners  ## Summary  The `debug_amd64_unit_test` CI job intermittently fails with **exit code 132 (SIGILL — Illegal Instruction)**:  ``` Run ./scripts/wait_for_minio.sh MinIO is ready! /home/runner/work/_temp/xxx.sh: line 2: 92023 Illegal instruction (core dumped) \   ASAN_OPTIONS=detect_leaks=0 ./test_main --gtest_filter=-*SLOW_* > debug_unit_test_stdout.log 2> debug_unit_test_stderr.log Error: Process completed with exit code 132. ```  Affected CI runs: - https://github.com/infiniflow/infinity/actions/runs/23881981379  ## Root Cause  The root cause is a **CPU feature mismatch** between the runner that performs the build and the runner that executes the test.  ### How it happens  1. **Build job** (`debug_amd64_build`) runs on a GitHub `ubuntu-latest` runner (Runner A). The CMake build happens inside a Docker container, but `/proc/cpuinfo` is passed through from the host.  2. `CMakeLists.txt` (lines 356–370) detects CPU features by grepping `/proc/cpuinfo`:    ```cmake    execute_process(COMMAND grep -qw avx512f /proc/cpuinfo && ...)    ```    If Runner A supports AVX-512, CMake adds:    ```cmake    add_definitions(-mavx512f -mavx512dq 

- **Issue #3341** (2026-04-02): **[Bug]: Chunk index row alignment error**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev4  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  ### Description ``` [19:12:20.181] [1704279] [critical] [19:12:20.181] [1704279] [critical] Error: Chunk index row alignment error: Expected 12.3008192 but got 12.3008194@src/storage/new_txn/new_txn_index_impl.cpp:2663 [19:12:20.380] [1704279] [critical]    0# infinity::PrintStacktrace@infinity_core(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&) at /home/weilongma/zpf/infinity/src/common/utility/exception_impl.cpp:47    1# infinity::UnrecoverableError@infinity_core(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&, char const*, unsigned int) at /home/weilongma/zpf/infinity/src/common/utility/exception_impl.cpp:81    2# infinity::NewTxn@infinity_core::CountMemIndexGapInSegment(infinity::SegmentIndexMeta@infinity_core&, infinity::SegmentMeta@infinity_core&, std::vector<std::pair<infinity::RowID, unsigned long>, std::allocator<std::pair<infinity::RowID, unsigned long> > >&) at /home/weilongma/zpf/infinity/src/storage/new_txn/new_txn_index_impl.cpp:2663    3# infinity::NewTxn@infinity_core::RecoverMemIndex(infinity::TableIndexMeta@infinity_core&) at /home/weilongma/zpf/infinity/src/storage/new_txn/new_txn_index_impl.cpp:2740    4# infinity::NewCatalog@infinity_core::MemIndexReco

- **Issue #3339** (2026-03-27): **[Bug]: Multiple Memory Indexers Cause BM25 Calculation Error**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev4  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  ### Summary  `ColumnIndexReader` may contain multiple memory indexers (one per segment). However, `FullTextColumnLengthReader::GetDocTermCount()` was only using a single `memory_indexer_` variable, causing `total_df_ < doc_freq_` crash during BM25 calculation.  ### Reproduction Steps  1. Set `optimize_interval` to 3600s 2. Run `TestMultipleIndexTypesImport` with snapshot restore enabled 3. The test will crash with `total_df_ < doc_freq_` error  ### Expected behavior  _No response_  ### Additional information  `UnrecoverableError(fmt::format("total_df_ {} is less than doc_freq_ {}", total_df_, doc_freq_));`

- **Issue #3333** (2026-03-23): **[Bug]: Double free bug when using 'Import'**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev4  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  ### Description  A race condition causes a critical error "attempt to free Freed buffer object" during CSV import operations when background garbage collection (GC) processes buffers before the import code explicitly frees them.  ### Error Message  ``` Txn ID: 1083, Text: compact table default_db.test_multi_index_types, Begin TS: 1237, Commit TS: 18446744073709551615, KV Commit TS: 18446744073709551615, State: Started  Txn ID: 1081, Text: COPY: default_db.test_multi_index_types FROM /home/infiniflow/runners_work/inf24-5478793f71f2/infinity/infinity/test/data/csv/enwiki_embedding_plus_9999.csv WITH CSV delimiter: 	, Begin TS: 1233, Commit TS: 18446744073709551615, KV Commit TS: 18446744073709551615, State: Started   [17:31:47.273] [2339751] [critical] Error: attempt to free Freed buffer object@src/storage/buffer/buffer_obj_impl.cpp:188 [17:31:47.443] [2340109] [info] SKIP cleanup. last_cleanup_ts: 1251, oldest_txn_begin_ts: 1233, last_checkpoint_ts: 1253 [17:31:47.443] [2340111] [info] Optimize all indexes begin ts: 1257 [17:31:48.390] [2339751] [critical]    0# infinity::PrintStacktrace@infinity_core(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&) at /infinity/src/common/utility/exception_impl.cpp:47    1# infin

- **Issue #3328** (2026-03-25): **[Bug]: OptimizeIndex concurrent conflict detection causes UnrecoverableError**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev4  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  ## Description When multiple optimize index operations occur (either from timer or manual trigger), the system throws UnrecoverableError("There should be no concurrent optimize txns") incorrectly.  ## Message ``` [02:07:36.025] [1667169] [critical] Error: Aborted    6# infinity::UnrecoverableError at /infinity/src/common/utility/exception_impl.cpp:84   11# infinity::NewTxn::CheckConflictTxnStore at /infinity/src/storage/new_txn/new_txn_impl.cpp:3953   12# infinity::NewTxn::CheckConflictTxnStores at /infinity/src/storage/new_txn/new_txn_impl.cpp:4558   13# infinity::NewTxnManager::CheckConflict1 at /infinity/src/storage/new_txn/new_txn_manager_impl.cpp:228   14# infinity::NewTxn::Commit at /infinity/src/storage/new_txn/new_txn_impl.cpp:2082   15# infinity::NewTxnManager::CommitTxn at /infinity/src/storage/new_txn/new_txn_manager_impl.cpp:317   16# infinity::OptimizationProcessor::NewNotifyOptimize at /infinity/src/storage/bg_task/optimization_process_impl.cpp:99   17# infinity::OptimizationProcessor::Process at /infinity/src/storage/bg_task/optimization_process_impl.cpp:181 ```  ## Reproduce reldeb_restart_test   ### Expected behavior  _No response_  ### Additional information  _No response_

- **Issue #3325** (2026-03-23): **[Bug]: Race condition between optimize and checkpoint causes infinity crash**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  ## Description  Running optimize and checkpoint simultaneously can cause the database to crash with an `UnrecoverableError`.  ## Error Log  ``` [20:44:24.615] [1856579] [critical] UnrecoverableError: Invalid buffer type: ToMmap    0# infinity::PrintStacktrace at /home/weilongma/zpf/infinity/src/common/utility/exception_impl.cpp:47    1# infinity::UnrecoverableError at /home/weilongma/zpf/infinity/src/common/utility/exception_impl.cpp:81    2# infinity::BufferObj::ToMmap at /home/weilongma/zpf/infinity/src/storage/buffer/buffer_obj_impl.cpp:386    3# infinity::NewTxn::TryToMmap at /home/weilongma/zpf/infinity/src/storage/new_txn/new_txn_data_impl.cpp:2142    4# infinity::NewTxn::CheckpointTable at /home/weilongma/zpf/infinity/src/storage/new_txn/new_txn_data_impl.cpp:1396    5# infinity::NewTxn::CheckpointDB at /home/weilongma/zpf/infinity/src/storage/new_txn/new_txn_impl.cpp:1889    6# infinity::NewTxn::Checkpoint at /home/weilongma/zpf/infinity/src/storage/new_txn/new_txn_impl.cpp:1802    7# infinity::NewCheckpointTask::ExecuteWithNewTxn at /home/weilongma/zpf/infinity/src/storage/bg_task/bg_task_impl.cpp:54    8# infinity::BGTaskProcessor::Process at /home/weilongma/zpf/infinity/src/storage/bg_task/background_process_impl.cpp:93 ```  ## Root Cause  This 

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

### Incident Patch 1: `b1083912` (2026-09-23)
**Commit Message**: fix(fulltext): avoid repeated UTF-8 validation in RAG replacement (#3503)

### Summary

Fix quadratic UTF-8 validation in the RAG analyzer's global replacement
loop. Large inputs with dense punctuation, such as HTML tables, invoke
`pcre2_match` many times. Each call previously validated the remaining
subject again, even though the input was unchanged. This can keep
full-text indexing busy for an extended period.

The first match still validates the entire subject. Subsequent matches
use `PCRE2_NO_UTF_CHECK` only after a successful checked match and when
the starting offset is a UTF-8 character boundary. Offsets inside
continuation bytes retain checked matching, including those produced by
empty matches or `\C`. Replacement text, byte-position mapping, and
invalid-input fallback remain unchanged. Both regular and position-aware
RAG tokenization use this helper.

Adds five regression tests for Unicode replacement and byte positions,
empty/unmatched input, malformed UTF-8, non-character offsets, and
approximately 4 MiB of HTML with dense matches. No public API or
configuration changes.

**File**: `src/common/analyzer/rag_analyzer_impl.cpp` (modified, +9/-2)
```diff
@@ -1743,10 +1743,16 @@ PCRE2GlobalReplaceWithPosition(const std::string &text, const std::string &patte
 
     PCRE2_SIZE current_pos = 0;
     PCRE2_SIZE last_match_end = 0;
+    bool subject_validated = false;
 
     // Process the string match by match
     while (current_pos < text.length()) {
-        int rc = pcre2_match(re, pcre2_subject, text.length(), current_pos, 0, match_data, nullptr);
+        // The first successful match validates the entire unchanged subject. Rechecking
+        // the remaining suffix for every match makes dense inputs (e.g. HTML) quadratic.
+        // Keep offset validation if an empty match or \\C advanced into a UTF-8 character.
+        const bool at_character_boundary = (static_cast<unsigned char>(text[current_pos]) & 0xc0) != 0x80;
+        const uint32_t match_options = subject_validated && at_character_boundary ? PCRE2_NO_UTF_CHECK : 0;
+        int rc = pcre2_match(re, pcre2_subject, text.length(), current_pos, match_options, match_data, nullptr);
 
         if (rc < 0) {
             // No more matches, copy remaining text
@@ -1762,6 +1768,7 @@ PCRE2GlobalReplaceWithPosition(const std::string &text, const std::string &patte
             break;
         }
 
+        subject_validated = true;
         PCRE2_SIZE *ovector = pcre2_get_ovector_pointer(match_data);
         PCRE2_SIZE match_start = ovector[0];
         PCRE2_SIZE match_end = ovector[1];
@@ -2603,4 +2610,4 @@ bool RAGAnalyzer::IsStopword(const std::string &term) {
     return kStopwords.find(term) != kStopwords.end();
 }
 
-} // namespace infinity
\ No newline at end of file
+} // namespace infinity
```

**File**: `src/unit_test/common/analyzer/rag_regex_ut.cpp` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+// Copyright(C) 2026 InfiniFlow, Inc. All rights reserved.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+module;
+
+#include "unit_test/gtest_expand.h"
+
+module infinity_core:ut.rag_regex;
+
+namespace infinity {
+
+std::pair<std::string, std::vector<std::pair<unsigned, unsigned>>>
+PCRE2GlobalReplaceWithPosition(const std::string &text, const std::string &pattern, const std::string &replacement);
+
+TEST(RAGRegexTest, unicode_replacement_preserves_byte_positions) {
+    const auto [text, positions] = PCRE2GlobalReplaceWithPosition("A<中>é🙂Z", R"(\W+)", " ");
+    EXPECT_EQ(text, "A 中 é Z");
+    const std::vector<std::pair<unsigned, unsigned>> expected = {{0, 0}, {1, 1}, {2, 2}, {3, 3}, {4, 4}, {5, 5}, {6, 6}, {7, 7}, {8, 8}, {12, 12}};
+    EXPECT_EQ(positions, expected);
+}
+
+TEST(RAGRegexTest, empty_and_unmatched_input) {
+    const auto [empty, empty_positions] = PCRE2GlobalReplaceWithPosition("", R"(\W+)", " ");
+    EXPECT_TRUE(empty.empty());
+    EXPECT_TRUE(empty_positions.empty());
+
+    const auto [text, positions] = PCRE2GlobalReplaceWithPosition("abc", R"(\W+)", " ");
+    EXPECT_EQ(text, "abc");
+    const std::vector<std::pair<unsigned, unsigned>> expected = {{0, 0}, {1, 1}, {2, 2}};
+    EXPECT_EQ(positions, expected);
+}
+
+TEST(RAGRegexTest, invalid_utf8_is_checked_before_any_replacement) {
+    // An invalid suffix must be detected even when an earlier punctuation match exists.
+    for (const auto &suffix : {std::string("\xff", 1), std::string("\xe4\xb8", 2)}) {
+        const std::string input = "a!b" + suffix;
+        const auto [text, positions] = PCRE2GlobalReplaceWithPosition(input, R"(\W+)", " ");
+        EXPECT_EQ(text, input);
+        ASSERT_EQ(positions.size(), input.size());
+        for (unsigned i = 0; i < positions.size(); ++i) {
+            EXPECT_EQ(positions[i], std::make_pair(i, i));
+        }
+    }
+}
+
+TEST(RAGRegexTest, non_character_offsets_remain_checked) {
+    // Empty matches and byte-wise patterns can advance into a continuation byte.
+    // Preserve the checked matcher's fallback instead of passing an unsafe offset.
+    const auto [empty_match, empty_positions] = PCRE2GlobalReplaceWithPosition("中!", "", "_");
+    EXPECT_EQ(empty_match, "_中!");
+    const std::vector<std::pair<unsigned, unsigned>> expected_empty = {{0, 0}, {0, 0}, {1, 1}, {2, 2}, {3, 3}};
+    EXPECT_EQ(empty_positions, expected_empty);
+
+    const auto [byte_match, byte_positions] = PCRE2GlobalReplaceWithPosition("中!", R"(\C)", "_");
+    EXPECT_EQ(byte_match, std::string("_\xb8\xad!", 4));
+    const std::vector<std::pair<unsigned, unsigned>> expected_byte = {{0, 0}, {1, 1}, {2, 2}, {3, 3}};
+    EXPECT_EQ(byte_positions, expected_byte);
+}
+
+TEST(RAGRegexTest, large_html_replacement) {
+    // Repeated UTF validation used to make this dense-match input quadratic.
+    const std::string row = "<td>物料123</td>";
+    const std::string replaced_row = " td 物料123 td ";
+    const size_t rows = 4 * 1024 * 1024 / row.size();
+    std::string input;
+    std::string expected;
+    input.reserve(rows * row.size());
+    expected.reserve(rows * replaced_row.size());
+    for (size_t i = 0; i < rows; ++i) {
+        input += row;
+        // Adjacent closing/opening angle brackets form one non-word match.
+        expected += i == 0 ? replaced_row : replaced_row.substr(1);
+    }
+
+    const auto start = std::chrono::steady_clock::now();
+    const auto [text, positions] =
```

---

### Incident Patch 2: `473f4fa0` (2026-09-21)
**Commit Message**: fix(fulltext): stop BMW scoring iterators on a stale posting block (#3496)

### What

Fix a server abort in fulltext search with many query terms. Fixes
#3495.

`match_text` with more than 15 terms could terminate the process from a
query thread:

```
TerminateHandler: Unhandled Exception: number of bits is unsupported
```

(or `Decode posting FAILEDF@src/storage/common/int_encoder.cppm:109`),
thrown under `BlockMaxWandIterator::Next` ->
`TermDocIterator::BM25Score` ->
`SkipIndexDecoder::DecodeCurrentTFBuffer`.

### Approach

- `BlockMaxWandIterator::Next` only partially sorted `sorted_iterators_`
for more than `SORT_SKIP_THRESHOLD` terms. With the pivot in the
unsorted tail, iterators in `[0, pivot]` could sit on an earlier doc;
BMW called `NextShallow(d)` on them (block cursor moves, nothing
decoded) and then `BM25Score()` without a `Next(d)`. The partial sort is
removed, the iterators are always fully sorted.
- `PostingIterator::SkipTo` now invalidates `current_row_id_` when the
block cursor moves, so `GetCurrentTF` / `GetCurrentTTF` /
`GetCurrentDocPayload` return 0 instead of decoding from the reader's
stale position. Before, the only guard was an `assert` in
`MultiPostingDeco

**File**: `src/scheduler/fragment_task_impl.cpp` (modified, +3/-0)
```diff
@@ -101,6 +101,9 @@ void FragmentTask::OnExecute() {
         } catch (UnrecoverableException &e) {
             LOG_CRITICAL(e.what());
             throw e;
+        } catch (std::exception &e) {
+            LOG_ERROR(e.what());
+            operator_status = Status::UnexpectedError(e.what());
         }
 
         profiler.End();
```

**File**: `src/storage/invertedindex/posting_iterator_impl.cpp` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ bool PostingIterator::SkipTo(RowID doc_id) {
     if (doc_id > last_doc_id_in_current_block_ or last_doc_id_in_current_block_ == INVALID_ROWID) {
         finish_decode_docid_ = false;
         finish_decode_tf_ = false;
+        current_row_id_ = INVALID_ROWID;
         return posting_decoder_->SkipTo(doc_id,
                                         last_doc_id_in_prev_block_,
                                         lowest_possible_doc_id_in_current_block_,
```

**File**: `src/storage/invertedindex/search/blockmax_wand_iterator.cppm` (modified, +0/-2)
```diff
@@ -51,7 +51,6 @@ private:
     size_t FindPivotOptimized(float threshold);
     void UpdateScoreUpperBoundPrefixSums();
     bool ShouldSkipSort() const;
-    void OptimizedPartialSort(size_t limit);
     bool TryFastPivotEstimation(float threshold, size_t &estimated_pivot);
 
     // Lucene-inspired MSM optimization methods
@@ -70,7 +69,6 @@ private:
     static constexpr u32 SORT_SKIP_THRESHOLD = 15;  // Reduced threshold for better balance
     static constexpr u32 LAZY_SORT_INTERVAL = 3;    // More frequent sorting for accuracy
     static constexpr u32 FAST_PIVOT_THRESHOLD = 50; // Use fast estimation for very large sets
-    static constexpr u32 PARTIAL_SORT_FACTOR = 3;   // Sort only top 1/3 for large sets
 
     std::vector<f32> score_ub_prefix_sums_; // Prefix sums for fast pivot calculation
     std::vector<size_t> iterator_indices_;  // Cached indices for avoiding pointer chasing
```

**File**: `src/storage/invertedindex/search/blockmax_wand_iterator_impl.cpp` (modified, +3/-32)
```diff
@@ -159,18 +159,6 @@ bool BlockMaxWandIterator::ShouldSkipSort() const {
     return iterations_since_sort_ < adaptive_interval;
 }
 
-// Optimized partial sort that only sorts what we need
-void BlockMaxWandIterator::OptimizedPartialSort(size_t limit) {
-    const size_t num_iterators = sorted_iterators_.size();
-    if (limit >= num_iterators) {
-        std::sort(sorted_iterators_.begin(), sorted_iterators_.end(), [](const auto &a, const auto &b) { return a->DocID() < b->DocID(); });
-    } else {
-        std::partial_sort(sorted_iterators_.begin(), sorted_iterators_.begin() + limit, sorted_iterators_.end(), [](const auto &a, const auto &b) {
-            return a->DocID() < b->DocID();
-        });
-    }
-}
-
 // Aggressively optimized pivot estimation with safety guarantees
 bool BlockMaxWandIterator::TryFastPivotEstimation(float threshold, size_t &estimated_pivot) {
     const size_t num_iterators = sorted_iterators_.size();
@@ -283,15 +271,8 @@ bool BlockMaxWandIterator::Next(RowID doc_id) {
             next_sort_cnt_++;
             consecutive_skips_ = 0; // Reset consecutive skip counter
 
-            if (num_iterators > SORT_SKIP_THRESHOLD) {
-                // For large keyword sets, use intelligent partial sort
-                size_t sort_limit = num_iterators / PARTIAL_SORT_FACTOR + 5;
-                sort_limit = std::min(sort_limit, num_iterators);
-                OptimizedPartialSort(sort_limit);
-            } else {
-                // For smaller keyword sets, use full sort
-                std::sort(sorted_iterators_.begin(), sorted_iterators_.end(), [](const auto &a, const auto &b) { return a->DocID() < b->DocID(); });
-            }
+            // Full sort required: a partially sorted tail lets BM25Score() run on an iterator whose block was skipped but not decoded.
+            std::sort(sorted_iterators_.begin(), sorted_iterators_.end(), [](const auto &a, const auto &b) { return a->DocID() < b->DocID(); });
             iterations_since_sort_ = 0;
             prefix_sums_valid_ = false; // Invalidate prefix sums after sorting
         } else {
@@ -329,17 +310,7 @@ bool BlockMaxWandIterator::Next(RowID doc_id) {
         } else {
             // Critical: BMW algorithm requires sorted order for correctness
             if (!should_sort) {
-                // We must ensure sorted order for correct pivot calculation
-                // Use a more efficient sort for this critical path
-                if (num_iterators > FAST_PIVOT_THRESHOLD) {
-                    // For very large sets, sort only what we likely need
-                    size_t estimated_limit = std::min(num_iterators, num_iterators / 4 + 10);
-                    OptimizedPartialSort(estimated_limit);
-                } else {
-                    std::sort(sorted_iterators_.begin(), sorted_iterators_.end(), [](const auto &a, const auto &b) {
-                        return a->DocID() < b->DocID();
-                    });
-                }
+                std::sort(sorted_iterators_.begin(), sorted_iterators_.end(), [](const auto &a, const auto &b) { return a->DocID() < b->DocID(); });
                 iterations_since_sort_ = 0;
                 prefix_sums_valid_ = false;
             }
```

**File**: `src/unit_test/storage/invertedindex/posting_writer_ut.cpp` (modified, +39/-0)
```diff
@@ -30,6 +30,8 @@ import :segment_posting;
 import :posting_iterator;
 import :vector_with_lock;
 import :infinity_context;
+import :virtual_store;
+import :byte_slice;
 
 import data_type;
 import internal_types;
@@ -108,3 +110,40 @@ TEST_P(PostingWriterTest, test1) {
         }
     }
 }
+
+TEST_P(PostingWriterTest, tf_after_skip_to_across_segments) {
+    VectorWithLock<u32> column_length_array(2000, 10);
+    std::vector<std::vector<u8>> storage;
+    auto seg_postings = std::make_shared<std::vector<SegmentPosting>>();
+    for (u32 seg = 0; seg < 2; ++seg) {
+        std::string path = file_ + "_seg" + std::to_string(seg);
+        auto posting = std::make_shared<PostingWriter>(posting_format_, column_length_array);
+        for (docid_t d = 1; d <= 300; ++d) {
+            posting->AddPosition(1);
+            posting->EndDocument(d, 0);
+        }
+        TermMeta term_meta(posting->GetDF(), posting->GetTotalTF());
+        {
+            auto file_writer = std::make_shared<FileWriter>(path, 128000);
+            posting->Dump(file_writer, term_meta);
+            file_writer->Sync();
+        }
+        size_t size = VirtualStore::GetFileSize(path);
+        storage.emplace_back(size);
+        FileReader file_reader(path, 128000);
+        file_reader.Read((char *)storage.back().data(), size);
+        auto slice_list = std::make_shared<ByteSliceList>(ByteSlice::NewSlice(storage.back().data(), size));
+        SegmentPosting seg_posting;
+        seg_posting.Init(slice_list, RowID(seg, 0), term_meta.doc_freq_, term_meta);
+        seg_postings->push_back(seg_posting);
+    }
+    PostingIterator iter(flag_);
+    iter.Init(seg_postings, 0);
+
+    ASSERT_EQ(iter.SeekDoc(RowID(0, 0)), RowID(0, 1));
+    ASSERT_EQ(iter.GetCurrentTF(), 1u);
+    ASSERT_TRUE(iter.SkipTo(RowID(1, 10)));
+    ASSERT_EQ(iter.GetCurrentTF(), 0u);
+    ASSERT_EQ(iter.SeekDoc(RowID(1, 10)), RowID(1, 10));
+    ASSERT_EQ(iter.GetCurrentTF(), 1u);
+}
```

---

### Incident Patch 3: `807af1b0` (2026-09-04)
**Commit Message**: Fix corrupt WAL handling: out-of-bounds reads and over-aggressive purge (#3429)

### Summary

This change fixes crashes and incorrect cleanup logic in the handling of
corrupt WAL entries.

- Fixed an out-of-bounds crash in WalEntry::ReadAdv when a checksum
mismatch logged the command type: the error path referenced cmds_[0]
before the commands were parsed, so it now logs only the header fields.
- Fixed an out-of-bounds read in WalEntry::ReadAdv that trusted the
on-disk entry->size_ without bounding it against the caller's frame
size; a corrupt size field could drive reads past the buffer, so it now
returns nullptr when the size is out of range.
- Fixed WalListIterator::PurgeBadEntriesAfterLatestCheckpoint deleting
files that are merely damaged in the region already covered by a
checkpoint: it now scans backward to confirm a checkpoint sits behind
the bad entry and keeps the file intact instead of truncating or
deleting the whole file.
- Fixed an infinite loop in WalEntryIterator::GetAllEntries caused by a
bad entry that returns nullptr without advancing the offset: iteration
now stops on a nullptr.
- Fixed a null-pointer crash in WalListIterator::Next when the purge
empties the fil

**File**: `src/storage/wal/wal_entry_impl.cpp` (modified, +58/-3)
```diff
@@ -2223,15 +2223,23 @@ std::shared_ptr<WalEntry> WalEntry::ReadAdv(const char *&ptr, i32 max_bytes) {
     entry->checksum_ = header->checksum_;
     entry->txn_id_ = header->txn_id_;
     entry->commit_ts_ = header->commit_ts_;
+    // entry->size_ is read from the on-disk header and is not trustworthy on its own; it is also what indexes
+    // into ptr below, so bound it against the frame (max_bytes) the caller handed us before touching
+    // ptr + entry->size_. Without this, a torn header can drive the reads past the end of the buffer.
+    if (entry->size_ <= static_cast<i32>(sizeof(WalEntryHeader)) || entry->size_ > max_bytes) {
+        LOG_WARN(fmt::format("WalEntry size_ {} out of range for a frame of {} bytes", entry->size_, max_bytes));
+        return nullptr;
+    }
     if (const i32 size2 = ReadBuf<i32>(ptr + entry->size_ - sizeof(i32)); entry->size_ != size2) {
         return nullptr;
     }
     {
         header->checksum_ = 0;
         DeferFn defer([&] { header->checksum_ = entry->checksum_; });
         if (const u32 checksum2 = CRC32IEEE::makeCRC(reinterpret_cast<const unsigned char *>(ptr), entry->size_); entry->checksum_ != checksum2) {
-            std::string error_msg = fmt::format("Command: {}, txn_id: {}, entry_size: {} checksum mismatch, expected: {}, actual: {}",
-                                                WalCmd::WalCommandTypeToString(entry->cmds_[0]->GetType()),
+            // The commands are serialized after the header and have not been parsed yet, so cmds_ is empty
+            // here; referencing cmds_[0] would index past its end and crash. Log the header fields only.
+            std::string error_msg = fmt::format("txn_id: {}, entry_size: {} checksum mismatch, expected: {}, actual: {}",
                                                 entry->txn_id_,
                                                 entry->size_,
                                                 entry->checksum_,
@@ -2492,7 +2500,14 @@ std::shared_ptr<WalEntry> WalEntryIterator::GetEntryByIndex(i64 index) {
 std::vector<std::shared_ptr<WalEntry>> WalEntryIterator::GetAllEntries() {
     std::vector<std::shared_ptr<WalEntry>> entries;
     while (HasNext()) {
-        entries.emplace_back(Next());
+        auto entry = Next();
+        if (entry.get() == nullptr) {
+            // Next() reports a corrupt entry by returning nullptr without advancing, so looping on HasNext()
+            // alone would spin forever. Stop at the first corrupt entry.
+            LOG_WARN(fmt::format("Stop reading {} at a corrupt entry (offset {})", file_name_, off_));
+            break;
+        }
+        entries.emplace_back(entry);
     }
     if (is_backward_) {
         std::reverse(entries.begin(), entries.end());
@@ -2534,6 +2549,40 @@ void WalListIterator::PurgeBadEntriesAfterLatestCheckpoint(const std::vector<std
             }
         }
         if (bad_offset != i64(-1)) {
+            // A bad entry in front of a checkpoint in the same file only damages the region the checkpoint
+            // already covers: replay reads from the latest checkpoint onward and never needs the entries
+            // before it. Reaching such a bad entry must not take the file down. Peek backward from the tail,
+            // which walks the intact entries between the tail and the checkpoint before it hits the bad one,
+            // and when a checkpoint sits behind the bad entry, keep the file untouched. This applies whether
+            // the bad entry is at the very start of the file (offset 0, which the caller would otherwise read
+            // as a whole-file delete) or further in.
+            bool ignore_bad_entry = false;
+            {
+                auto backward_iter = WalEntryIterator::Make(*it, true);
+                while (backward_iter->HasNext()) {
+                    auto backward_entry = backward_iter->Next();
+                    if (backward_entry.get() == nullptr) {
+                        break;
+       
```

**File**: `src/unit_test/storage/wal/wal_entry_ut.cpp` (modified, +343/-0)
```diff
@@ -475,3 +475,346 @@ TEST_F(WalEntryTest, WalListIterator) {
     EXPECT_EQ(max_commit_ts, 123ul);
     EXPECT_EQ(replay_entries.size(), 1u);
 }
+
+// Byte offset of every entry of `wal_file_path`, in file order.
+std::vector<i64> WalEntryOffsets(const std::string &wal_file_path) {
+    std::vector<i64> offsets;
+    auto iter = WalEntryIterator::Make(wal_file_path, false);
+    while (iter->HasNext()) {
+        offsets.push_back(iter->GetOffset());
+        if (iter->Next() == nullptr) {
+            break;
+        }
+    }
+    return offsets;
+}
+
+// Flips a byte of the command count of the entry starting at `entry_offset`, so that the entry no longer
+// matches its checksum. The size fields stay intact, so the entry is only rejected once it is read.
+void CorruptEntry(const std::string &wal_file_path, i64 entry_offset) {
+    const i64 offset = entry_offset + static_cast<i64>(sizeof(WalEntryHeader));
+    std::fstream fs(wal_file_path, std::ios::in | std::ios::out | std::ios::binary);
+    EXPECT_TRUE(fs.is_open());
+    if (!fs.is_open()) {
+        return;
+    }
+    fs.seekg(offset);
+    char byte = 0;
+    fs.read(&byte, 1);
+    fs.seekp(offset);
+    byte = static_cast<char>(byte ^ 0xFF);
+    fs.write(&byte, 1);
+}
+
+// Cuts the checkpoint and everything behind it off a freshly mocked WAL file, so that the file holds no
+// checkpoint. Returns the offsets of the four entries left in it.
+std::vector<i64> MockWalFileWithoutCheckpoint(const std::string &wal_file) {
+    MockWalFile(wal_file, "catalog", "META_123.full.json");
+    const std::vector<i64> offsets = WalEntryOffsets(wal_file);
+    // ASSERT_* expands to `return;`, which does not compile in a function returning a value, so check
+    // explicitly and bail out: offsets[4] below and the four offsets returned both need this many.
+    if (offsets.size() < 5) {
+        ADD_FAILURE() << "MockWalFile produced " << offsets.size() << " entries in " << wal_file << ", need at least 5";
+        return {};
+    }
+    std::filesystem::resize_file(wal_file, static_cast<size_t>(offsets[4]));
+    return std::vector<i64>(offsets.begin(), std::next(offsets.begin(), 4));
+}
+
+// Builds a WAL pair and drops the checkpoint (and everything behind it) from the newer file, so that the
+// purge has to look for the checkpoint in the older file. Returns the offsets of the entries left in the
+// newer file, which are its first four entries.
+std::vector<i64> MockWalPair(const std::string &newer_wal_file, const std::string &older_wal_file) {
+    MockWalFile(older_wal_file, "catalog", "META_123.full.json");
+    return MockWalFileWithoutCheckpoint(newer_wal_file);
+}
+
+// Drains the iterator and returns the max commit ts of the first checkpoint it reaches.
+TxnTimeStamp ReplayToFirstCheckpoint(WalListIterator &iterator) {
+    TxnTimeStamp max_commit_ts = 0;
+    while (iterator.HasNext()) {
+        auto entry = iterator.Next();
+        if (entry.get() == nullptr) {
+            break;
+        }
+        WalCmdCheckpointV2 *checkpoint_cmd = nullptr;
+        if (entry->IsCheckPoint(checkpoint_cmd)) {
+            max_commit_ts = checkpoint_cmd->max_commit_ts_;
+            break;
+        }
+    }
+    return max_commit_ts;
+}
+
+// Drains the iterator and returns the commit ts of every entry replay sees, in that order.
+std::vector<TxnTimeStamp> DrainWalList(WalListIterator &iterator) {
+    std::vector<TxnTimeStamp> commit_tss;
+    while (iterator.HasNext()) {
+        auto entry = iterator.Next();
+        if (entry.get() == nullptr) {
+            break;
+        }
+        commit_tss.push_back(entry->commit_ts_);
+    }
+    return commit_tss;
+}
+
+// Damage in front of the checkpoint entry must be ignored: replay only reads the entries behind it, and
+// the backward scan that locates the checkpoint must not walk the damaged prefix.
+TEST_F(WalEntryTest, DamagedEntryBeforeCheckpointIsIgnored) {
+    RemoveDbDirs();
+    std::filesystem::create_directories(G
```

---

### Incident Patch 4: `797d315f` (2026-09-01)
**Commit Message**: fix: set db_name in TableMeta constructor to fix mem index dump failure(#3420) (#3428)

- Fixes #3420: TableMeta now receives db_name at construction, so mem
index dump tasks correctly resolve the database instead of failing with
"Database: doesn't exist."
- Removes the SetDBTableName mutator so the table's database name is
fixed once at construction and cannot drift into an inconsistent state.

**File**: `src/planner/optimizer/index_scan/filter_expression_push_down_indexscanfilter_impl.cpp` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ struct ExpressionIndexScanInfo {
         Status status;
         if (!base_table_ref->block_index_->table_meta_) {
             base_table_ref->block_index_->table_meta_ =
-                std::make_unique<TableMeta>(table_info->db_id_, table_info->table_id_, *table_info->table_name_, new_txn);
+                std::make_unique<TableMeta>(table_info->db_id_, *table_info->db_name_, table_info->table_id_, *table_info->table_name_, new_txn);
         }
         table_meta_ = base_table_ref->block_index_->table_meta_.get();
         auto &table_index_meta_map = base_table_ref->block_index_->table_index_meta_map_;
```

**File**: `src/storage/catalog/meta/table_meta.cppm` (modified, +4/-6)
```diff
@@ -37,14 +37,15 @@ export class TableMeta {
 public:
     // TableMeta(const std::string &db_id_str, const std::string &table_id_str, KVInstance &kv_instance, TxnTimeStamp begin_ts, UsageEnum usage);
     TableMeta(const std::string &db_id_str,
+              const std::string &db_name,
               const std::string &table_id_str,
               const std::string &table_name,
               KVInstance *kv_instance,
               TxnTimeStamp begin_ts,
               TxnTimeStamp commit_ts,
               MetaCache *meta_cache);
 
-    TableMeta(const std::string &db_id_str, const std::string &table_id_str, const std::string &table_name, NewTxn *txn);
+    TableMeta(const std::string &db_id_str, const std::string &db_name, const std::string &table_id_str, const std::string &table_name, NewTxn *txn);
 
     TxnTimeStamp begin_ts() const { return begin_ts_; }
     TxnTimeStamp commit_ts() const { return commit_ts_; }
@@ -100,10 +101,6 @@ public:
     Status GetTableDetail(TableDetail &table_detail);
 
     std::pair<std::string, std::string> GetDBTableName() const { return std::make_pair(db_name_, table_name_); }
-    void SetDBTableName(const std::string &db_name, const std::string &table_name) {
-        db_name_ = db_name;
-        table_name_ = table_name;
-    }
 
     Status AddColumn(const ColumnDef &column_def);
 
@@ -135,6 +132,7 @@ public:
 
     MetaCache *meta_cache() const;
 
+    const std::string &db_name() const;
     const std::string &table_name() const;
 
     u64 db_id() const;
@@ -165,9 +163,9 @@ private:
 
     std::string db_id_str_;
     u64 db_id_{};
+    std::string db_name_{};
     std::string table_id_str_;
     u64 table_id_{};
-    std::string db_name_{};
     std::string table_name_{};
 
     std::optional<std::string> comment_;
```

**File**: `src/storage/catalog/meta/table_meta_impl.cpp` (modified, +10/-3)
```diff
@@ -46,20 +46,25 @@ import create_index_info;
 namespace infinity {
 
 TableMeta::TableMeta(const std::string &db_id_str,
+                     const std::string &db_name,
                      const std::string &table_id_str,
                      const std::string &table_name,
                      KVInstance *kv_instance,
                      TxnTimeStamp begin_ts,
                      TxnTimeStamp commit_ts,
                      MetaCache *meta_cache)
-    : begin_ts_(begin_ts), commit_ts_(commit_ts), kv_instance_(kv_instance), meta_cache_(meta_cache), db_id_str_(db_id_str),
+    : begin_ts_(begin_ts), commit_ts_(commit_ts), kv_instance_(kv_instance), meta_cache_(meta_cache), db_id_str_(db_id_str), db_name_(db_name),
       table_id_str_(table_id_str), table_name_(table_name) {
     db_id_ = std::stoull(db_id_str);
     table_id_ = std::stoull(table_id_str);
 }
 
-TableMeta::TableMeta(const std::string &db_id_str, const std::string &table_id_str, const std::string &table_name, NewTxn *txn)
-    : txn_(txn), db_id_str_(db_id_str), table_id_str_(table_id_str), table_name_(table_name) {
+TableMeta::TableMeta(const std::string &db_id_str,
+                     const std::string &db_name,
+                     const std::string &table_id_str,
+                     const std::string &table_name,
+                     NewTxn *txn)
+    : txn_(txn), db_id_str_(db_id_str), db_name_(db_name), table_id_str_(table_id_str), table_name_(table_name) {
     if (txn == nullptr) {
         UnrecoverableError("Null txn pointer");
     }
@@ -1109,6 +1114,8 @@ std::tuple<size_t, Status> TableMeta::GetTableRowCount() {
 
 MetaCache *TableMeta::meta_cache() const { return meta_cache_; }
 
+const std::string &TableMeta::db_name() const { return db_name_; }
+
 const std::string &TableMeta::table_name() const { return table_name_; }
 
 u64 TableMeta::db_id() const { return db_id_; }
```

**File**: `src/storage/catalog/new_catalog_static_impl.cpp` (modified, +31/-7)
```diff
@@ -208,7 +208,7 @@ Status NewCatalog::InitCatalog(MetaCache *meta_cache, KVInstance *kv_instance, T
         return Status::OK();
     };
     auto InitTable = [&](const std::string &table_id_str, const std::string &table_name, DBMeta &db_meta) {
-        TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, kv_instance, checkpoint_ts, MAX_TIMESTAMP, meta_cache);
+        TableMeta table_meta(db_meta.db_id_str(), db_meta.db_name(), table_id_str, table_name, kv_instance, checkpoint_ts, MAX_TIMESTAMP, meta_cache);
 
         std::vector<SegmentID> *segment_ids_ptr = nullptr;
         std::tie(segment_ids_ptr, status) = table_meta.GetSegmentIDs1();
@@ -321,7 +321,10 @@ Status NewCatalog::MemIndexRecover(NewTxn *txn) {
         for (size_t idx = 0; idx < table_count; ++idx) {
             const std::string &table_id_str = table_id_strs_ptr->at(idx);
             const std::string &table_name = table_names_ptr->at(idx);
-            TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, txn);
+            // The database name must reach the table meta: TableIndexMeta holds it by reference, so AppendMemIndex
+            // reads the name off it when it builds the dump task. Leaving it empty made the dump fail with
+            // "Database:  doesn't exist."
+            TableMeta table_meta(db_meta.db_id_str(), db_meta.db_name(), table_id_str, table_name, txn);
             status = IndexRecoverTable(table_meta);
             if (!status.ok()) {
                 return status;
@@ -391,7 +394,7 @@ Status NewCatalog::MemIndexRecover(NewTxn *txn) {
             for (size_t i = 0; i < table_id_strs_ptr->size(); ++i) {
                 const std::string &table_id_str = (*table_id_strs_ptr)[i];
                 const std::string &table_name = (*table_names_ptr)[i];
-                TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, txn);
+                TableMeta table_meta(db_meta.db_id_str(), db_meta.db_name(), table_id_str, table_name, txn);
                 DrainTable(table_meta);
             }
         };
@@ -455,7 +458,7 @@ Status NewCatalog::GetAllMemIndexes(NewTxn *txn, std::vector<std::shared_ptr<Mem
         for (size_t i = 0; i < table_id_strs_ptr->size(); ++i) {
             const std::string &table_id_str = (*table_id_strs_ptr)[i];
             const std::string &table_name = (*table_names_ptr)[i];
-            TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, txn);
+            TableMeta table_meta(db_meta.db_id_str(), db_name, table_id_str, table_name, txn);
             status = TraverseTable(table_meta, db_name, table_name);
             if (!status.ok()) {
                 return status;
@@ -520,7 +523,14 @@ Status NewCatalog::CleanDB(DBMeta &db_meta, TxnTimeStamp begin_ts, UsageFlag usa
     for (size_t i = 0; i < table_id_strs_ptr->size(); ++i) {
         const std::string &table_id_str = (*table_id_strs_ptr)[i];
         const std::string &table_name = (*table_names_ptr)[i];
-        TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, db_meta.kv_instance(), begin_ts, MAX_TIMESTAMP, db_meta.meta_cache());
+        TableMeta table_meta(db_meta.db_id_str(),
+                             db_meta.db_name(),
+                             table_id_str,
+                             table_name,
+                             db_meta.kv_instance(),
+                             begin_ts,
+                             MAX_TIMESTAMP,
+                             db_meta.meta_cache());
         status = NewCatalog::CleanTable(table_meta, begin_ts, usage_flag);
         if (!status.ok()) {
             return status;
@@ -550,7 +560,14 @@ Status NewCatalog::AddNewTable(DBMeta &db_meta,
         return status;
     }
 
-    table_meta = std::make_shared<TableMeta>(db_meta.db_id_str(), table_id_str, table_name, kv_instance, begin_ts, commit_ts, db_meta.meta_cache());
+    table_meta = std::make_shared<TableMeta>(db_meta.db_id_str(),
+                   
```

**File**: `src/storage/invertedindex/column_index_reader_impl.cpp` (modified, +3/-1)
```diff
@@ -207,7 +207,9 @@ std::shared_ptr<IndexReader> TableIndexReaderCache::GetIndexReader(NewTxn *txn)
         return index_reader;
     }
 
-    TableMeta table_meta(db_id_str_, table_id_str_, table_name_, txn);
+    // Only the ids are needed here: this path reads index metadata,
+    // so the database name is left empty.
+    TableMeta table_meta(db_id_str_, "", table_id_str_, table_name_, txn);
     std::vector<std::string> *index_id_strs = nullptr;
     std::vector<std::string> *index_name_strs = nullptr;
     {
```

---

### Incident Patch 5: `f4e78f98` (2026-08-31)
**Commit Message**: Fix admin commands issues (#3427)

### Summary

Fixes https://github.com/infiniflow/infinity/issues/3421 and other admin
commands issues

**File**: `src/admin/admin_executor_impl.cpp` (modified, +582/-243)
```diff
@@ -42,6 +42,7 @@ import :peer_task;
 import :infinity_exception;
 import :node_info;
 import :persistence_manager;
+import :storage;
 import :kv_store;
 import :kv_code;
 import :rocksdb_merge_operator;
@@ -644,13 +645,16 @@ QueryResult AdminExecutor::ListDatabases(QueryContext *query_context, const Admi
     std::unique_ptr<DataBlock> output_block_ptr = DataBlock::MakeUniquePtr();
     output_block_ptr->Init(column_types);
 
-    std::unique_ptr<rocksdb::DB> db;
-    rocksdb::Options options;
-    rocksdb::ReadOptions read_options;
-
-    auto catalog_dir = InfinityContext::instance().config()->CatalogDir();
-
-    rocksdb::TransactionDB::OpenForReadOnly(options, catalog_dir, &db);
+    // Reuse the already-loaded KVStore for catalog introspection instead of re-opening the
+    // RocksDB via DB::OpenForReadOnly. In maintenance (admin) mode the KVStore is opened
+    // read-only by Storage::InitToAdmin; in writable modes it is the normal writable KVStore.
+    // This avoids the DBImplReadOnly destructor assertion that crashes ADMIN SHOW DATABASES.
+    KVStore *kv_store = query_context->storage()->kv_store();
+    if (kv_store == nullptr) {
+        query_result.status_ = Status::UnexpectedError("KVStore is not initialized");
+        return query_result;
+    }
+    std::unique_ptr<KVInstance> kv_instance = kv_store->GetInstance();
 
     struct db_output_obj {
         std::string name_;
@@ -663,12 +667,12 @@ QueryResult AdminExecutor::ListDatabases(QueryContext *query_context, const Admi
 
     std::map<std::string, std::vector<std::pair<std::string, std::string>>> db_kvs_map;
 
-    auto catalog_db_iter = db->NewIterator(read_options);
+    auto catalog_db_iter = kv_instance->GetIterator();
     catalog_db_iter->Seek(KeyEncode::kCatalogDbHeader);
 
-    while (catalog_db_iter->Valid() && catalog_db_iter->key().starts_with(KeyEncode::kCatalogDbHeader)) {
-        std::string key_str = catalog_db_iter->key().ToString();
-        std::string db_id = catalog_db_iter->value().ToString();
+    while (catalog_db_iter->Valid() && catalog_db_iter->Key().starts_with(KeyEncode::kCatalogDbHeader)) {
+        std::string key_str = catalog_db_iter->Key().ToString();
+        std::string db_id = catalog_db_iter->Value().ToString();
         size_t start = KeyEncode::kCatalogDbHeader.size();
         size_t end = key_str.find('|', start);
         std::string db_name = key_str.substr(start, end - start);
@@ -679,13 +683,13 @@ QueryResult AdminExecutor::ListDatabases(QueryContext *query_context, const Admi
     for (const auto &[db_name, db_kvs] : db_kvs_map) {
         for (const auto &[db_key, db_value] : db_kvs) { // create -> drop -> create
             TxnTimeStamp db_commit_ts = std::stoull(Partition(db_key, '|').back());
-            auto drop_iter = db->NewIterator(read_options);
+            auto drop_iter = kv_instance->GetIterator();
             auto drop_db_name_prefix = fmt::format("{}{}", KeyEncode::kDropDbHeader, db_name);
             drop_iter->Seek(drop_db_name_prefix);
             TxnTimeStamp drop_ts{};
             bool dropped{};
-            while (drop_iter->Valid() && drop_iter->key().starts_with(drop_db_name_prefix)) {
-                auto key_str = drop_iter->key().ToString();
+            while (drop_iter->Valid() && drop_iter->Key().starts_with(drop_db_name_prefix)) {
+                auto key_str = drop_iter->Key().ToString();
                 drop_ts = static_cast<TxnTimeStamp>(std::stoull(Partition(key_str, '/')[1]));
                 if (drop_ts >= db_commit_ts) {
                     dropped = true;
@@ -697,10 +701,9 @@ QueryResult AdminExecutor::ListDatabases(QueryContext *query_context, const Admi
             // Get comment from tag
             std::string comment;
             auto comment_key = KeyEncode::CatalogDbTagKey(db_value, "comment");
-            auto comment_iter = db->NewIterator(read_options);
-            comment_iter->Seek(comment_key);
-            if (comment_iter->Valid() && c
```

**File**: `src/parser/parser.y` (modified, +10/-14)
```diff
@@ -2637,21 +2637,20 @@ admin_statement: ADMIN SHOW CATALOG LONG_VALUE LONG_VALUE DATABASES {
      free($4->table_name_ptr_);
      delete $4;
 }
-| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE {
+| ADMIN SHOW TABLE table_name COLUMNS {
      $$ = new infinity::AdminStatement();
-     $$->admin_type_ = infinity::AdminStmtType::kShowSegment;
+     $$->admin_type_ = infinity::AdminStmtType::kListColumns;
      if($4->schema_name_ptr_ != nullptr) {
          $$->schema_name_ = $4->schema_name_ptr_;
          free($4->schema_name_ptr_);
      }
      $$->table_name_ = $4->table_name_ptr_;
      free($4->table_name_ptr_);
      delete $4;
-     $$->segment_index_ = $6;
 }
-| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE BLOCKS {
+| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE {
      $$ = new infinity::AdminStatement();
-     $$->admin_type_ = infinity::AdminStmtType::kListBlocks;
+     $$->admin_type_ = infinity::AdminStmtType::kShowSegment;
      if($4->schema_name_ptr_ != nullptr) {
          $$->schema_name_ = $4->schema_name_ptr_;
          free($4->schema_name_ptr_);
@@ -2661,9 +2660,9 @@ admin_statement: ADMIN SHOW CATALOG LONG_VALUE LONG_VALUE DATABASES {
      delete $4;
      $$->segment_index_ = $6;
 }
-| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE BLOCK LONG_VALUE {
+| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE BLOCKS {
      $$ = new infinity::AdminStatement();
-     $$->admin_type_ = infinity::AdminStmtType::kShowBlock;
+     $$->admin_type_ = infinity::AdminStmtType::kListBlocks;
      if($4->schema_name_ptr_ != nullptr) {
          $$->schema_name_ = $4->schema_name_ptr_;
          free($4->schema_name_ptr_);
@@ -2672,11 +2671,10 @@ admin_statement: ADMIN SHOW CATALOG LONG_VALUE LONG_VALUE DATABASES {
      free($4->table_name_ptr_);
      delete $4;
      $$->segment_index_ = $6;
-     $$->block_index_ = $8;
 }
-| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE BLOCK LONG_VALUE COLUMNS {
+| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE BLOCK LONG_VALUE {
      $$ = new infinity::AdminStatement();
-     $$->admin_type_ = infinity::AdminStmtType::kListColumns;
+     $$->admin_type_ = infinity::AdminStmtType::kShowBlock;
      if($4->schema_name_ptr_ != nullptr) {
          $$->schema_name_ = $4->schema_name_ptr_;
          free($4->schema_name_ptr_);
@@ -2687,7 +2685,7 @@ admin_statement: ADMIN SHOW CATALOG LONG_VALUE LONG_VALUE DATABASES {
      $$->segment_index_ = $6;
      $$->block_index_ = $8;
 }
-| ADMIN SHOW TABLE table_name SEGMENT LONG_VALUE BLOCK LONG_VALUE COLUMN LONG_VALUE {
+| ADMIN SHOW TABLE table_name COLUMN LONG_VALUE {
      $$ = new infinity::AdminStatement();
      $$->admin_type_ = infinity::AdminStmtType::kShowColumn;
      if($4->schema_name_ptr_ != nullptr) {
@@ -2697,9 +2695,7 @@ admin_statement: ADMIN SHOW CATALOG LONG_VALUE LONG_VALUE DATABASES {
      $$->table_name_ = $4->table_name_ptr_;
      free($4->table_name_ptr_);
      delete $4;
-     $$->segment_index_ = $6;
-     $$->block_index_ = $8;
-     $$->column_index_ = $10;
+     $$->column_index_ = $6;
 }
 | ADMIN SHOW TABLE table_name INDEXES {
      $$ = new infinity::AdminStatement();
```

**File**: `src/storage/catalog/kv_store.cppm` (modified, +10/-0)
```diff
@@ -60,6 +60,9 @@ public:
     Status Rollback();
 
 private:
+    // Read-only (maintenance mode) support: when non-null, this KVInstance reads via a
+    // rocksdb::DB opened with OpenForReadOnly instead of a transaction on a writable DB.
+    rocksdb::DB *read_only_db_{};
     rocksdb::Transaction *transaction_{};
     rocksdb::ReadOptions read_options_;
 };
@@ -72,6 +75,9 @@ public:
     ~KVStore();
 
     Status Init(const std::string &db_path);
+    // Open the catalog DB in read-only mode (used by maintenance/admin mode, where the
+    // storage layer is not fully initialized). Safe to call on an existing catalog.
+    Status InitReadOnly(const std::string &db_path);
     Status Uninit();
     Status Flush();
     Status CreateBackup(const std::string &backup_path, std::vector<rocksdb::BackupInfo> &backup_info_list);
@@ -88,13 +94,17 @@ public:
     size_t KeyValueNum() const;
     std::vector<std::pair<std::string, std::string>> GetAllKeyValue();
     rocksdb::TransactionDB *transaction_db() const { return transaction_db_; }
+    // Return a readable DB handle for catalog introspection: the read-only DB in maintenance
+    // (admin) mode, or the writable transaction DB otherwise. The caller must NOT delete it.
+    rocksdb::DB *ReadableDB() const { return (read_only_db_ != nullptr) ? read_only_db_ : transaction_db_; }
 
     // For UT
     static Status Destroy(const std::string &db_path);
 
 private:
     std::string db_path_{};
     rocksdb::TransactionDB *transaction_db_{}; // RocksDB transaction db
+    rocksdb::DB *read_only_db_{};              // read-only DB opened by InitReadOnly (maintenance mode)
     rocksdb::Options options_;
     rocksdb::TransactionDBOptions txn_db_options_;
     rocksdb::TransactionOptions txn_options_;
```

**File**: `src/storage/catalog/kv_store_impl.cpp` (modified, +90/-8)
```diff
@@ -59,9 +59,13 @@ KVInstance::~KVInstance() {
         delete transaction_;
         transaction_ = nullptr;
     }
+    // read_only_db_ is owned by KVStore; do not delete here.
 }
 
 Status KVInstance::Put(const std::string &key, const std::string &value) {
+    if (read_only_db_ != nullptr) {
+        return Status::NotSupport("KVInstance is read-only");
+    }
     //    LOG_TRACE(fmt::format("To put key: {}, value: {}", key, value));
     rocksdb::Status s = transaction_->Put(key, value);
     if (!s.ok()) {
@@ -73,6 +77,9 @@ Status KVInstance::Put(const std::string &key, const std::string &value) {
 }
 
 Status KVInstance::Delete(const std::string &key) {
+    if (read_only_db_ != nullptr) {
+        return Status::NotSupport("KVInstance is read-only");
+    }
     //    LOG_TRACE(fmt::format("To delete key: {}", key));
     rocksdb::Status s = transaction_->Delete(key);
     if (!s.ok()) {
@@ -84,14 +91,19 @@ Status KVInstance::Delete(const std::string &key) {
 }
 
 Status KVInstance::Get(const std::string &key, std::string &value) {
-    rocksdb::Status s = transaction_->Get(read_options_, key, &value);
+    rocksdb::Status s;
+    if (read_only_db_ != nullptr) {
+        s = read_only_db_->Get(read_options_, key, &value);
+    } else {
+        s = transaction_->Get(read_options_, key, &value);
+    }
     if (!s.ok()) {
         switch (s.code()) {
             case rocksdb::Status::Code::kNotFound: {
                 return Status::NotFound(fmt::format("Key not found: {}", key));
             }
             default: {
-                std::string msg = fmt::format("rocksdb::Transaction::Get key: {}", key);
+                std::string msg = fmt::format("rocksdb::Get key: {}", key);
                 LOG_DEBUG(msg);
                 return Status::RocksDBError(std::move(s), msg);
             }
@@ -117,7 +129,12 @@ Status KVInstance::Get(const std::string &key, std::string &value) {
 //     return Status::OK();
 // }
 
-std::unique_ptr<KVIterator> KVInstance::GetIterator() { return std::make_unique<KVIterator>(transaction_->GetIterator(read_options_)); }
+std::unique_ptr<KVIterator> KVInstance::GetIterator() {
+    if (read_only_db_ != nullptr) {
+        return std::make_unique<KVIterator>(read_only_db_->NewIterator(read_options_));
+    }
+    return std::make_unique<KVIterator>(transaction_->GetIterator(read_options_));
+}
 
 // std::unique_ptr<KVIterator> KVInstance::GetIterator(const char *lower_bound_key, const char *upper_bound_key) {
 //     if (lower_bound_key != nullptr) {
@@ -132,7 +149,12 @@ std::unique_ptr<KVIterator> KVInstance::GetIterator() { return std::make_unique<
 std::vector<std::pair<std::string, std::string>> KVInstance::GetAllKeyValue() {
     std::vector<std::pair<std::string, std::string>> result;
     rocksdb::ReadOptions read_option;
-    std::unique_ptr<rocksdb::Iterator> iter{transaction_->GetIterator(read_options_)};
+    std::unique_ptr<rocksdb::Iterator> iter;
+    if (read_only_db_ != nullptr) {
+        iter.reset(read_only_db_->NewIterator(read_options_));
+    } else {
+        iter.reset(transaction_->GetIterator(read_options_));
+    }
     iter->SeekToFirst();
     for (; iter->Valid(); iter->Next()) {
         result.push_back({iter->key().ToString(), iter->value().ToString()});
@@ -143,7 +165,8 @@ std::vector<std::pair<std::string, std::string>> KVInstance::GetAllKeyValue() {
 std::string KVInstance::ToString() const {
     std::stringstream ss;
     rocksdb::ReadOptions read_option;
-    std::unique_ptr<rocksdb::Iterator> iter{transaction_->GetIterator(read_options_)};
+    std::unique_ptr<rocksdb::Iterator> iter{read_only_db_ != nullptr ? read_only_db_->NewIterator(read_options_)
+                                                                     : transaction_->GetIterator(read_options_)};
     iter->SeekToFirst();
     for (; iter->Valid(); iter->Next()) {
         auto key = iter->key().ToString();
@@ -158,6 +181,9 @@ std::string KVInstance::ToString() const {
 }
 
 St
```

**File**: `src/storage/storage_impl.cpp` (modified, +26/-0)
```diff
@@ -148,6 +148,19 @@ Status Storage::InitToAdmin() {
             persistence_manager_ =
                 std::make_unique<PersistenceManager>(this, persistence_dir, config_ptr_->DataDir(), (size_t)persistence_object_size_limit);
         }
+
+        // In maintenance (admin) mode the storage layer is not fully initialized, but the
+        // catalog DB must be readable for ADMIN introspection commands (e.g. ADMIN SHOW DATABASES).
+        // Open it read-only so those commands can reuse the KVStore traversal instead of re-opening
+        // the RocksDB via DB::OpenForReadOnly (whose DBImplReadOnly destructor asserts on this catalog).
+        if (kv_store_ == nullptr) {
+            kv_store_ = std::make_unique<KVStore>();
+        }
+        Status init_ro_status = kv_store_->InitReadOnly(config_ptr_->CatalogDir());
+        if (!init_ro_status.ok()) {
+            return init_ro_status;
+        }
+
         current_storage_mode_ = StorageMode::kAdmin;
     }
     LOG_INFO(fmt::format("Finish initializing storage from un-init mode to admin"));
@@ -192,6 +205,10 @@ Status Storage::UnInitFromAdmin() {
             memory_index_tracer_.reset();
         }
 
+        // Release the read-only catalog KVStore opened by InitToAdmin. Leaving it alive keeps a
+        // KVInstance with a null transaction_ around, which crashes write paths if it is reused.
+        kv_store_.reset();
+
         current_storage_mode_ = StorageMode::kUnInitialized;
     }
     LOG_INFO(fmt::format("Finishing un-initializing storage from admin mode to un-init"));
@@ -874,6 +891,15 @@ Status Storage::AdminToReaderBottom(TxnTimeStamp system_start_ts) {
     }
     bg_processor_ = std::make_unique<BGTaskProcessor>();
 
+    // The KVStore left over from the admin (read-only) phase is not writable: GetInstance()
+    // returns an instance with a null transaction_ that crashes write paths. Replace it with a
+    // writable KVStore before constructing the txn manager.
+    kv_store_ = std::make_unique<KVStore>();
+    Status kv_store_status = kv_store_->Init(config_ptr_->CatalogDir());
+    if (!kv_store_status.ok()) {
+        return kv_store_status;
+    }
+
     // TODO: new txn manager
     new_txn_mgr_ = std::make_unique<NewTxnManager>(this, kv_store_.get(), system_start_ts);
     new_txn_mgr_->Start();
```

---

### Incident Patch 6: `6e455a28` (2026-08-27)
**Commit Message**: fix(sdk): accept plain lists of numpy scalars in INSERT vector columns (#3422)

**File**: `python/infinity_embedded/local_infinity/utils.py` (modified, +3/-0)
```diff
@@ -321,6 +321,9 @@ def get_local_constant_expr_from_python_value(value) -> WrapConstantExpr:
         else:
             raise InfinityException(ErrorCode.INVALID_EXPRESSION,
                                     f"Invalid list member type: {type(value[0])}, ndarray dimension > 2")
+    elif isinstance(value, list) and len(value) > 0:
+        # Normalize numpy scalars in list to native Python types (element-wise check)
+        value = [x.item() if isinstance(x, (np.integer, np.floating, np.longdouble)) else x for x in value]
     elif isinstance(value, np.ndarray):
         if value.ndim <= 2:
             value = value.tolist()
```

**File**: `python/infinity_sdk/infinity/infinity_http.py` (modified, +2/-0)
```diff
@@ -794,6 +794,8 @@ def insert(self, values=[]):
                         for idx in range(len(value[key])):
                             if isinstance(value[key][idx], np.ndarray):
                                 value[key][idx] = value[key][idx].tolist()
+                            elif isinstance(value[key][idx], (np.integer, np.floating, np.longdouble)):
+                                value[key][idx] = value[key][idx].item()
                     elif isinstance(value[key], SparseVector):
                         value[key] = value[key].to_dict()
 
```

**File**: `python/infinity_sdk/infinity/remote_thrift/utils.py` (modified, +3/-0)
```diff
@@ -718,6 +718,9 @@ def get_remote_constant_expr_from_python_value(value) -> ttypes.ConstantExpr:
         else:
             raise InfinityException(ErrorCode.INVALID_EXPRESSION,
                                     f"Invalid list member type: {type(value[0])}, ndarray dimension > 2")
+    elif isinstance(value, list) and len(value) > 0:
+        # Normalize numpy scalars in list to native Python types (element-wise check)
+        value = [x.item() if isinstance(x, (np.integer, np.floating, np.longdouble)) else x for x in value]
     elif isinstance(value, np.ndarray):
         if value.ndim <= 2:
             value = value.tolist()
```

**File**: `python/test_pysdk/test_insert.py` (modified, +38/-0)
```diff
@@ -297,6 +297,43 @@ def _test_insert_embedding(self, suffix):
         res = db_obj.drop_table("test_insert_embedding_4" + suffix, ConflictType.Error)
         assert res.error_code == ErrorCode.OK
 
+    def _test_insert_embedding_numpy(self, suffix):
+        """
+        target: test insert embedding column with numpy array values (#1253)
+        method: insert a raw np.ndarray, and a plain list of numpy scalars
+                (e.g. list(embedding_array), which isn't itself an ndarray)
+        expected: ok
+        """
+        db_obj = self.infinity_obj.get_database("default_db")
+
+        db_obj.drop_table("test_insert_embedding_numpy_int" + suffix, ConflictType.Ignore)
+        table_obj = db_obj.create_table(
+            "test_insert_embedding_numpy_int" + suffix, {"c1": {"type": "vector,3,int"}}, ConflictType.Error)
+        assert table_obj
+        res = table_obj.insert([{"c1": np.array([1, 2, 3], dtype=np.int64)}])
+        assert res.error_code == ErrorCode.OK
+        res = table_obj.insert([{"c1": list(np.array([4, 5, 6], dtype=np.int64))}])
+        assert res.error_code == ErrorCode.OK
+        res, extra_result = table_obj.output(["*"]).to_df()
+        pd.testing.assert_frame_equal(res, pd.DataFrame({'c1': ([1, 2, 3], [4, 5, 6])}))
+        res = db_obj.drop_table("test_insert_embedding_numpy_int" + suffix, ConflictType.Error)
+        assert res.error_code == ErrorCode.OK
+
+        db_obj.drop_table("test_insert_embedding_numpy_float" + suffix, ConflictType.Ignore)
+        table_obj = db_obj.create_table(
+            "test_insert_embedding_numpy_float" + suffix, {"c1": {"type": "vector,3,float"}}, ConflictType.Error)
+        assert table_obj
+        res = table_obj.insert([{"c1": np.array([1.1, 2.2, 3.3], dtype=np.float32)}])
+        assert res.error_code == ErrorCode.OK
+        res = table_obj.insert([{"c1": list(np.array([4.4, 5.5, 6.6], dtype=np.float32))}])
+        assert res.error_code == ErrorCode.OK
+        res, extra_result = table_obj.output(["*"]).to_df()
+        pd.testing.assert_frame_equal(res, pd.DataFrame(
+            {'c1': (np.array([1.1, 2.2, 3.3], dtype=np.float32).tolist(),
+                    np.array([4.4, 5.5, 6.6], dtype=np.float32).tolist())}))
+        res = db_obj.drop_table("test_insert_embedding_numpy_float" + suffix, ConflictType.Error)
+        assert res.error_code == ErrorCode.OK
+
     def _test_insert_big_embedding(self, suffix):
         """
         target: test insert embedding with big dimension
@@ -816,6 +853,7 @@ def test_insert(self, suffix):
         self._test_insert_varchar(suffix)
         self._test_insert_big_varchar(suffix)
         self._test_insert_embedding(suffix)
+        self._test_insert_embedding_numpy(suffix)
         self._test_insert_big_embedding(suffix)
         self._test_insert_big_embedding_float(suffix)
         self._test_insert_exceed_block_size(suffix)
```

---

### Incident Patch 7: `f2ee43b7` (2026-08-17)
**Commit Message**: Fix: downgrade leftover debug log to trace in query cache hot path (#3416)

## Summary
- `TableIndexReaderCache::GetIndexReader` had a leftover
`LOG_INFO("DEBUG: Using cached index readers...")` on its `[[likely]]`
cache-hit branch, which runs on nearly every full-text/inverted-index
query that hits the cache.
- At `LOG_INFO` level this spams `infinity.log` in production on a very
hot path.
- Downgraded to `LOG_TRACE` (matching the convention used elsewhere in
`src/storage/invertedindex/`, e.g. `disk_segment_reader_impl.cpp`) and
dropped the stray `DEBUG:` prefix.

**File**: `src/storage/invertedindex/column_index_reader_impl.cpp` (modified, +1/-1)
```diff
@@ -202,7 +202,7 @@ std::shared_ptr<IndexReader> TableIndexReaderCache::GetIndexReader(NewTxn *txn)
     std::scoped_lock lock(mutex_);
     if (begin_ts >= cache_ts_) [[likely]] {
         // no need to build, use cache
-        LOG_INFO(fmt::format("DEBUG: Using cached index readers for table_id: '{}'", table_id_str_));
+        LOG_TRACE(fmt::format("Using cached index readers for table_id: '{}'", table_id_str_));
         index_reader->column_index_readers_ = cache_column_readers_;
         return index_reader;
     }
```

---

### Incident Patch 8: `8fc20770` (2026-07-31)
**Commit Message**: Fix json bugs (#3411)

### Summary

- Fix https://github.com/infiniflow/infinity/issues/3399

- json_extract_string & json_extract
 
```
$ create table t1(meta json);
$ insert into t1 values( '{"department":"IB"}');

$ select json_extract_string(meta, '$.department') from t1;

json_extract_string(meta, $.department) 
-----------------------------------------
 IB
(1 row)

$ select json_extract(meta, '$.department') from t1;

 json_extract(meta, $.department) 
----------------------------------
 "IB"
(1 row)
```

**File**: `python/test_pysdk/test_select.py` (modified, +10/-10)
```diff
@@ -220,7 +220,7 @@ def test_select_json(self, suffix):
             {'json_extract(c3, $.2)': 'string'}))
         res, extra_res = table_obj.output(["json_extract_string(c3,'$.2')"]).to_pl()
         pd.testing.assert_frame_equal(res.to_pandas().astype('string'), pd.DataFrame(
-            {'json_extract_string(c3, $.2)': ('3232', '"10"')}).astype(
+            {'json_extract_string(c3, $.2)': ('3232', '10')}).astype(
             {'json_extract_string(c3, $.2)': 'string'}))
         res, extra_res = table_obj.output(["json_extract_int(c3,'$.2')"]).to_pl()
         pd.testing.assert_frame_equal(res.to_pandas().astype('Int32'), pd.DataFrame(
@@ -296,7 +296,7 @@ def test_select_json_comprehensive(self, suffix):
         res, _ = table_obj.output(["json_extract_string(c3,'$.name')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas(),
-            pd.DataFrame({'json_extract_string(c3, $.name)': ('"测试"',)})
+            pd.DataFrame({'json_extract_string(c3, $.name)': ('测试',)})
         )
 
         res, _ = table_obj.output(["json_extract_double(c3,'$.value')"]).to_pl()
@@ -328,19 +328,19 @@ def test_select_json_comprehensive(self, suffix):
         res, _ = table_obj.output(["json_extract_string(c3,'$[0]')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas().astype('string'),
-            pd.DataFrame({'json_extract_string(c3, $[0])': (pd.NA, '"电商"')}, dtype='string')
+            pd.DataFrame({'json_extract_string(c3, $[0])': (pd.NA, '电商')}, dtype='string')
         )
 
         res, _ = table_obj.output(["json_extract_string(c3,'$[1]')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas().astype('string'),
-            pd.DataFrame({'json_extract_string(c3, $[1])': (pd.NA, '"美妆"')}, dtype='string')
+            pd.DataFrame({'json_extract_string(c3, $[1])': (pd.NA, '美妆')}, dtype='string')
         )
 
         res, _ = table_obj.output(["json_extract_string(c3,'$[2]')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas().astype('string'),
-            pd.DataFrame({'json_extract_string(c3, $[2])': (pd.NA, '"母婴"')}, dtype='string')
+            pd.DataFrame({'json_extract_string(c3, $[2])': (pd.NA, '母婴')}, dtype='string')
         )
 
         # Test out of bounds index
@@ -411,14 +411,14 @@ def test_select_json_comprehensive(self, suffix):
         res, _ = table_obj.output(["json_extract_string(c3,'$[1]')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas().astype('string'),
-            pd.DataFrame({'json_extract_string(c3, $[1])': (pd.NA, '"美妆"', pd.NA, '"two"')}, dtype='string')
+            pd.DataFrame({'json_extract_string(c3, $[1])': (pd.NA, '美妆', pd.NA, 'two')}, dtype='string')
         )
 
         # Use json_extract_string for double to avoid None conversion issues
         res, _ = table_obj.output(["json_extract_string(c3,'$[2]')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas(),
-            pd.DataFrame({'json_extract_string(c3, $[2])': (None, '"母婴"', None, '3.0')})
+            pd.DataFrame({'json_extract_string(c3, $[2])': (None, '母婴', None, '3.0')})
         )
 
         res, _ = table_obj.output(["json_extract_bool(c3,'$[3]')"]).to_pl()
@@ -469,7 +469,7 @@ def test_select_json_comprehensive(self, suffix):
         res, _ = table_obj.output(["json_extract_string(c3,'$[0].name')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas(),
-            pd.DataFrame({'json_extract_string(c3, $[0].name)': (None, None, None, None, '"张三"')})
+            pd.DataFrame({'json_extract_string(c3, $[0].name)': (None, None, None, None, '张三')})
         )
 
         res, _ = table_obj.output(["json_extract_int(c3,'$[0].age')"]).to_pl()
@@ -482,7 +482,7 @@ def test_select_json_comprehensive(self, suffix):
         res, _ = table_obj.output(["json_extract_string(c3,'$[1].name')"]).to_pl()
         pd.testing.assert_frame_equal(
             
```

**File**: `src/function/scalar/extract_json_impl.cpp` (modified, +6/-2)
```diff
@@ -68,10 +68,14 @@ class JsonExtractor {
     }
 };
 
-void JsonExtractString(const DataBlock &input, std::shared_ptr<ColumnVector> &output) {
+void JsonExtract(const DataBlock &input, std::shared_ptr<ColumnVector> &output) {
     JsonExtractor<std::string, JsonManager::json_extract, Value::MakeVarchar>::Execute(input, output);
 }
 
+void JsonExtractString(const DataBlock &input, std::shared_ptr<ColumnVector> &output) {
+    JsonExtractor<std::string, JsonManager::json_extract_string, Value::MakeVarchar>::Execute(input, output);
+}
+
 void JsonExtractInt(const DataBlock &input, std::shared_ptr<ColumnVector> &output) {
     JsonExtractor<BigIntT, JsonManager::json_extract_int, Value::MakeBigInt>::Execute(input, output);
 }
@@ -169,7 +173,7 @@ void RegisterJsonFunction(NewCatalog *catalog_ptr) {
         ScalarFunction json_function(func_name,
                                      {DataType(LogicalType::kJson), DataType(LogicalType::kVarchar)},
                                      DataType(LogicalType::kVarchar),
-                                     JsonExtractString);
+                                     JsonExtract);
         function_set_ptr->AddFunction(json_function);
         NewCatalog::AddFunctionSet(catalog_ptr, function_set_ptr);
     }
```

**File**: `src/planner/optimizer/index_scan/index_filter_evaluators_impl.cpp` (modified, +4/-0)
```diff
@@ -182,9 +182,11 @@ std::unique_ptr<IndexFilterEvaluator> IndexFilterEvaluatorBuildFromAnd(std::vect
                 for (auto &chi : child_logical->other_children_evaluators_) {
                     other_children_evaluators.push_back(std::move(chi));
                 }
+                break;
             }
             case Type::kOr: {
                 other_children_evaluators.push_back(std::move(child));
+                break;
             }
         }
     }
@@ -258,9 +260,11 @@ std::unique_ptr<IndexFilterEvaluator> IndexFilterEvaluatorBuildFromOr(std::vecto
                 for (auto &chi : child_logical->other_children_evaluators_) {
                     other_children_evaluators.push_back(std::move(chi));
                 }
+                break;
             }
             case Type::kAnd: {
                 other_children_evaluators.push_back(std::move(child));
+                break;
             }
         }
     }
```

**File**: `src/storage/common/json_manager.cppm` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ public:
      * return: arg1: is_null, arg2: result
      */
     static std::tuple<bool, std::string> json_extract(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens);
+    static std::tuple<bool, std::string> json_extract_string(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens);
     static std::tuple<bool, BigIntT> json_extract_int(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens);
     static std::tuple<bool, DoubleT> json_extract_double(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens);
     static std::tuple<bool, BooleanT> json_extract_bool(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens);
```

**File**: `src/storage/common/json_manager_impl.cpp` (modified, +33/-0)
```diff
@@ -270,6 +270,39 @@ std::tuple<bool, std::string> JsonManager::json_extract(const JsonTypeDef &data,
     return {true, current->dump()};
 }
 
+std::tuple<bool, std::string> JsonManager::json_extract_string(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens) {
+    const JsonTypeDef *current = &data;
+    for (const auto &token : tokens) {
+        const auto &token_type = token.first;
+        const auto &token_value = token.second;
+        if (current->is_array() && token_type == JsonType::kJsonArray) {
+            try {
+                size_t index = std::stoul(token_value);
+                if (index < current->size()) {
+                    current = &(*current)[index];
+                } else {
+                    return {false, ""};
+                }
+            } catch (const std::exception &) {
+                return {false, ""};
+            }
+        } else if (current->is_object() && token_type == JsonType::kJsonObject && current->contains(token_value)) {
+            current = &(*current)[token_value];
+        } else {
+            return {false, ""};
+        }
+    }
+    // Return the raw (unquoted) string value for string leaves; for other JSON types,
+    // fall back to the JSON text representation.
+    if (current->is_string()) {
+        return {true, current->get<std::string>()};
+    }
+    if (current->is_null()) {
+        return {false, ""};
+    }
+    return {true, current->dump()};
+}
+
 std::tuple<bool, BigIntT> JsonManager::json_extract_int(const JsonTypeDef &data, const std::vector<JsonTokenInfo> &tokens) {
     const JsonTypeDef *current = &data;
     for (const auto &token : tokens) {
```

---

### Incident Patch 9: `7badfd94` (2026-07-30)
**Commit Message**: Fix: prevent full-text inverting exceptions from deadlock (#3409)

**Issue**
Full-text invert tasks run in ctpl worker threads via lambdas that
increment counters (task_count_ / inflight_tasks_) before executing
InvertColumn→Sort→ring_sorted_.Put. If any of these steps throws (e.g.,
simdjson INCORRECT_TYPE on empty JSON {}), the counter decrement /
semaphore release code is never reached, causing the consumer to block
forever.

**Solution**
Wrap all 4 inverting lambdas in try-catch:
AsyncInsertBottom: --task_count_ + cv_.notify_one() always executes
(outside try)
AsyncInsert: on failure, release(sema) + --inflight_tasks_
Insert (offline/online): on failure, --inflight_tasks_

--

Make realtime the default for new full-text indexes

**File**: `src/storage/catalog/new_catalog_static_impl.cpp` (modified, +63/-0)
```diff
@@ -339,6 +339,69 @@ Status NewCatalog::MemIndexRecover(NewTxn *txn) {
             return status;
         }
     }
+
+    // Drain all pending fulltext index commits to ensure they complete before the checkpoint that follows.
+    {
+        auto DrainFulltextMemIndexes = [&](TableIndexMeta &table_index_meta) {
+            auto [index_base, base_status] = table_index_meta.GetIndexBase();
+            if (!base_status.ok() || index_base->index_type_ != IndexType::kFullText) {
+                return;
+            }
+            auto [segment_ids_ptr, seg_status] = table_index_meta.GetSegmentIndexIDs1();
+            if (!seg_status.ok()) {
+                return;
+            }
+            for (SegmentID segment_id : *segment_ids_ptr) {
+                SegmentIndexMeta segment_index_meta(segment_id, table_index_meta);
+                std::shared_ptr<MemIndex> mem_index = segment_index_meta.GetMemIndex();
+                if (mem_index == nullptr) {
+                    continue;
+                }
+                std::shared_ptr<MemoryIndexer> memory_indexer = mem_index->GetFulltextIndex();
+                if (memory_indexer != nullptr) {
+                    memory_indexer->WaitForTaskCompletion();
+                }
+            }
+        };
+
+        auto DrainTable = [&](TableMeta &table_meta) {
+            std::vector<std::string> *index_id_strs_ptr = nullptr;
+            std::vector<std::string> *index_name_strs_ptr = nullptr;
+            Status st = table_meta.GetIndexIDs(index_id_strs_ptr, &index_name_strs_ptr);
+            if (!st.ok()) {
+                return;
+            }
+            for (size_t i = 0; i < index_id_strs_ptr->size(); ++i) {
+                const std::string &index_id_str = (*index_id_strs_ptr)[i];
+                const std::string &index_name_str = (*index_name_strs_ptr)[i];
+                TableIndexMeta table_index_meta(index_id_str, index_name_str, table_meta);
+                DrainFulltextMemIndexes(table_index_meta);
+            }
+        };
+
+        auto DrainDB = [&](DBMeta &db_meta) {
+            std::vector<std::string> *table_id_strs_ptr = nullptr;
+            std::vector<std::string> *table_names_ptr = nullptr;
+            Status st = db_meta.GetTableIDs(table_id_strs_ptr, &table_names_ptr);
+            if (!st.ok()) {
+                return;
+            }
+            for (size_t i = 0; i < table_id_strs_ptr->size(); ++i) {
+                const std::string &table_id_str = (*table_id_strs_ptr)[i];
+                const std::string &table_name = (*table_names_ptr)[i];
+                TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, txn);
+                DrainTable(table_meta);
+            }
+        };
+
+        for (size_t idx = 0; idx < db_count; ++idx) {
+            const std::string &db_id_str = db_id_strs_ptr->at(idx);
+            const std::string &db_name = db_names_ptr->at(idx);
+            DBMeta db_meta(db_id_str, db_name, txn);
+            DrainDB(db_meta);
+        }
+    }
+
     return Status::OK();
 }
 
```

**File**: `src/storage/common/rcu_multimap.cppm` (modified, +67/-16)
```diff
@@ -618,6 +618,11 @@ private:
     InnerMap *volatile read_map_;
     std::size_t miss_time_;
 
+    // RCU reader count: incremented by readers before accessing read_map_,
+    // decremented after the read is complete. Writers (CheckSwapInLock, CheckGc)
+    // wait for this to reach 0 before freeing old maps, preventing use-after-free.
+    mutable std::atomic<u64> rcu_reader_count_{0};
+
     mutable std::mutex dirty_lock_;
     InnerMap *dirty_map_;
 
@@ -662,6 +667,9 @@ typename RcuMap<Key, Value>::MapValue RcuMap<Key, Value>::CreateMapValue(const V
 
 template <typename Key, typename Value>
 Value *RcuMap<Key, Value>::Get(const Key &key, bool update_access_time) {
+    // RCU read protection: prevent write-side GC from freeing read_map_ during iteration
+    rcu_reader_count_.fetch_add(1, std::memory_order_acquire);
+
     // ULTRA-OPTIMIZED RCU READ PATTERN FOR READ-HEAVY WORKLOADS:
     // Eliminate ALL overhead in the common case to match MapWithLock performance
 
@@ -686,9 +694,13 @@ Value *RcuMap<Key, Value>::Get(const Key &key, bool update_access_time) {
                 }
             }
         }
+        rcu_reader_count_.fetch_sub(1, std::memory_order_release);
         return &(it->second.value_);
     }
 
+    // RCU: temporarily release reader count while checking dirty_map under lock
+    rcu_reader_count_.fetch_sub(1, std::memory_order_release);
+
     // PHASE 2: Check dirty_map for recent writes (SLOW PATH - MINIMIZED)
     // This path should be rare in read-heavy workloads
     {
@@ -740,21 +752,25 @@ std::optional<Value> RcuMap<Key, Value>::GetValue(const Key &key, bool update_ac
 
 template <typename Key, typename Value>
 Value *RcuMap<Key, Value>::GetWithRcuTime(const Key &key) {
+    // RCU read protection
+    rcu_reader_count_.fetch_add(1, std::memory_order_acquire);
+
     // ABSOLUTE FASTEST PATH: Zero overhead reads for maximum performance
-    // This should be as fast as MapWithLock::Get() with shared_lock
     InnerMap *current_read = read_map_;
     auto it = current_read->find(key);
 
     if (it != current_read->end()) {
+        rcu_reader_count_.fetch_sub(1, std::memory_order_release);
         return &(it->second.value_);
     }
 
+    rcu_reader_count_.fetch_sub(1, std::memory_order_release);
+
     // Inline dirty_map check to avoid function call overhead
     {
         std::lock_guard<std::mutex> lock(dirty_lock_);
         auto dirty_it = dirty_map_->find(key);
         if (dirty_it != dirty_map_->end()) {
-            // No access time updates, no miss tracking - pure read performance
             return &(dirty_it->second.value_);
         }
     }
@@ -764,18 +780,18 @@ Value *RcuMap<Key, Value>::GetWithRcuTime(const Key &key) {
 
 template <typename Key, typename Value>
 Value *RcuMap<Key, Value>::GetReadOnly(const Key &key) {
-    // BENCHMARK-OPTIMIZED READ: Absolute minimum overhead
-    // This method is designed to match MapWithLock performance exactly
-    // by eliminating ALL RCU-specific overhead
+    // RCU read protection
+    rcu_reader_count_.fetch_add(1, std::memory_order_acquire);
 
-    // Try read_map first (should succeed in most cases for read-heavy workloads)
     InnerMap *current_read = read_map_;
     auto it = current_read->find(key);
     if (it != current_read->end()) {
+        rcu_reader_count_.fetch_sub(1, std::memory_order_release);
         return &(it->second.value_);
     }
 
-    // If not found, try dirty_map (minimal overhead)
+    rcu_reader_count_.fetch_sub(1, std::memory_order_release);
+
     std::lock_guard<std::mutex> lock(dirty_lock_);
     auto dirty_it = dirty_map_->find(key);
     if (dirty_it != dirty_map_->end()) {
@@ -826,6 +842,12 @@ void RcuMap<Key, Value>::CheckSwapInLock() {
     // std::set up new dirty_map for future writes
     dirty_map_ = new_dirty_map;
 
+    // RCU SYNCHRONIZATION: Wait for all readers that saw the OLD read_map_ to finish.
+    // Without this, a reader could still be iterating the old map when Check
```

**File**: `src/storage/invertedindex/column_inverter.cppm` (modified, +13/-0)
```diff
@@ -81,6 +81,18 @@ public:
 
     const std::vector<std::binary_semaphore *> &semas() const { return semas_; }
 
+    // Release all semaphores exactly once across all threads that process this inverter.
+    void ReleaseSemas() {
+        bool expected = false;
+        if (!semas_released_.compare_exchange_strong(expected, true, std::memory_order_acq_rel)) {
+            return;
+        }
+        for (auto *sema : semas_) {
+            sema->release();
+        }
+        // semas_ does not need clearing since the atomic flag prevents re-entry.
+    }
+
 private:
     using TermBuffer = std::vector<char>;
     using PosInfoVec = std::vector<PosInfo>;
@@ -112,6 +124,7 @@ private:
 
     u32 merged_{1};
     std::vector<std::binary_semaphore *> semas_{};
+    std::atomic<bool> semas_released_{false};
 
 protected:
     size_t InvertColumn(u32 doc_id, const std::string &val);
```

**File**: `src/storage/invertedindex/index_defines.cppm` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export {
     typedef u32 tf_t;
     typedef i64 ttf_t;
 
-    constexpr optionflag_t OPTION_FLAG_ALL = of_term_payload | of_doc_payload | of_position_list | of_term_frequency | of_block_max;
+    constexpr optionflag_t OPTION_FLAG_ALL = of_term_payload | of_doc_payload | of_position_list | of_term_frequency | of_block_max | of_realtime;
     constexpr optionflag_t NO_BLOCK_MAX = of_term_payload | of_doc_payload | of_position_list | of_term_frequency;
     constexpr optionflag_t NO_TERM_FREQUENCY = of_term_payload | of_doc_payload;
     constexpr optionflag_t OPTION_FLAG_NONE = of_none;
```

**File**: `src/storage/invertedindex/memory_indexer_impl.cpp` (modified, +124/-32)
```diff
@@ -132,12 +132,27 @@ void MemoryIndexer::Insert(std::shared_ptr<ColumnVector> column_vector, u32 row_
         auto inverter = std::make_shared<ColumnInverter>(provider, column_lengths_);
         inverter->InitAnalyzer(this->analyzer_);
         auto func = [this, task, inverter](int id) {
-            size_t column_length_sum = inverter->InvertColumn(task->column_vector_, task->row_offset_, task->row_count_, task->start_doc_id_);
-            term_cnt_ += column_length_sum;
-            if (column_length_sum > 0) {
-                inverter->SortForOfflineDump();
+            bool success = false;
+            try {
+                size_t column_length_sum = inverter->InvertColumn(task->column_vector_, task->row_offset_, task->row_count_, task->start_doc_id_);
+                term_cnt_ += column_length_sum;
+                if (column_length_sum > 0) {
+                    inverter->SortForOfflineDump();
+                }
+                this->ring_sorted_.Put(task->task_seq_, inverter);
+                success = true;
+            } catch (const std::exception &e) {
+                LOG_ERROR(fmt::format("Insert(offline) invert task failed, seq={}, error: {}", task->task_seq_, e.what()));
+            } catch (...) {
+                LOG_ERROR(fmt::format("Insert(offline) invert task failed, seq={}, unknown error", task->task_seq_));
+            }
+            if (!success) {
+                std::unique_lock lock(mutex_);
+                --inflight_tasks_;
+                if (inflight_tasks_ == 0) {
+                    cv_.notify_one();
+                }
             }
-            this->ring_sorted_.Put(task->task_seq_, inverter);
         };
         {
             std::unique_lock<std::mutex> lock(mutex_);
@@ -151,13 +166,32 @@ void MemoryIndexer::Insert(std::shared_ptr<ColumnVector> column_vector, u32 row_
         auto inverter = std::make_shared<ColumnInverter>(provider, column_lengths_);
         inverter->InitAnalyzer(this->analyzer_);
         auto func = [this, task, inverter](int id) {
-            // LOG_INFO(fmt::format("online inverter {} begin", id));
-            size_t column_length_sum = inverter->InvertColumn(task->column_vector_, task->row_offset_, task->row_count_, task->start_doc_id_);
-            term_cnt_ += column_length_sum;
-            inverter->MergePrepare();
-            inverter->Sort();
-            this->ring_sorted_.Put(task->task_seq_, inverter);
-            // LOG_INFO(fmt::format("online inverter {} end", id));
+            bool success = false;
+            try {
+                // LOG_INFO(fmt::format("online inverter {} begin", id));
+                size_t column_length_sum = inverter->InvertColumn(task->column_vector_, task->row_offset_, task->row_count_, task->start_doc_id_);
+                term_cnt_ += column_length_sum;
+                inverter->MergePrepare();
+                inverter->Sort();
+                this->ring_sorted_.Put(task->task_seq_, inverter);
+                success = true;
+                // LOG_INFO(fmt::format("online inverter {} end", id));
+            } catch (const std::exception &e) {
+                LOG_ERROR(fmt::format("Insert(online) invert task failed, seq={}, error: {}", task->task_seq_, e.what()));
+            } catch (...) {
+                LOG_ERROR(fmt::format("Insert(online) invert task failed, seq={}, unknown error", task->task_seq_));
+            }
+            if (success) {
+                // Proactively drain the ring to prevent deadlock when the ring fills up.
+                // CommitSync uses try_lock so it is safe and non-blocking if another thread is already committing.
+                CommitSync(100);
+            } else {
+                std::unique_lock lock(mutex_);
+                --inflight_tasks_;
+                if (inflight_tasks_ == 0) {
+                    cv_.notify_one();
+                }
+            }
         };
         {
             std::unique_lock<std::mutex> lock(mutex_);
@@ -
```

---

### Incident Patch 10: `de2298b5` (2026-07-15)
**Commit Message**: Fix CI process (#3406)

Fix 'No UV'

Signed-off-by: Jin Hai <haijin.chn@gmail.com>

**File**: `.github/workflows/release.yml` (modified, +3/-0)
```diff
@@ -306,6 +306,9 @@ jobs:
         with:
           submodules: recursive
 
+      - name: Install uv
+        uses: astral-sh/setup-uv@v7
+
       - name: Build and push infinity-sdk
         run: |
           uv run --python 3.11 python/infinity_sdk/prepare_huqie.py && uv build && uv publish --token ${{ secrets.PYPI_API_TOKEN }}
```

#### Recent Merged Pull Requests:
- **PR #3504** (2026-09-23): Add sparsegram analyzer for regex queries (@yingfeng)
- **PR #3503** (2026-09-23): fix(fulltext): avoid repeated UTF-8 validation in RAG replacement (@zhouyuchong)
- **PR #3496** (2026-09-21): fix(fulltext): stop BMW scoring iterators on a stale posting block (@loispostula)
- **PR #3436** (2026-09-09): Add Slovak and Czech language support to the RAG analyzer (@martincivan)
- **PR #3432** (2026-09-04): Thrift: upgrade to 0.24.0 (@JinHai-CN)
- **PR #3431** (closed): Bump thrift from 0.22.0 to 0.24.0 (@dependabot[bot])
- **PR #3430** (2026-09-04): Bump nltk from 3.9.2 to 3.10.3 (@dependabot[bot])
- **PR #3429** (2026-09-04): Fix corrupt WAL handling: out-of-bounds reads and over-aggressive purge (@qinling0210)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
