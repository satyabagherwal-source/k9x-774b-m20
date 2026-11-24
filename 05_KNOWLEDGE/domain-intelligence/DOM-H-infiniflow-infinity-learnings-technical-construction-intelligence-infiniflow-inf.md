# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: infiniflow-infinity-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow-infinity-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T03:41:56.214Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-infiniflow-infinity-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow-infinity-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T03:41:56.214Z`  
> **Learning ID**: `LEARN-EVO-infiniflow-infinity-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from infiniflow-infinity-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `e7db7afb`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T03:41:49.617Z  
> **Learning ID**: `learn-github-infiniflow-infinity`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): infiniflow/infinity

> **Canonical Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T03:41:49.611Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4773 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
                            tn->is_set_.store(2, std::memory_order_release); // set taken
                            if (flag_move_to_new_buffer &&
                                (temphead - 1) == temphead_of_queue->head_) { // if we moved to a new buffer ,we need to move forward the head_ so in
                                                                              // the end we can delete the buffer
                                temphead_of_queue->head_++;
                            }

                            return true;

                        } // the data is valid and the element in the head_ is still in insert process

                        if (tn->is_set_.load(std::memory_order_acquire) == 0) {
                            flag_buffer_all_handeld = false;
                        }
                    }
                    if (temphead >= buffer_size_) { // we reach the end of the buffer -move to the next_
                        if (flag_buffer_all_handeld &&
                            flag_move_to_new_buffer) { // we want to "fold" the queue - if there is a thread that got stuck - we want to keep only
                                                       // that buffer and delete the rest( upfront from  it)
                            if (temphead_of_queue == tail_of_queue_.load(std::memory_order_acquire))
                                return false; // there is no place to move

                            BufferList *next_ = temphead_of_queue->next_.load(std::memory_order_acquire);
                            BufferList *prev_ = temphead_of_queue->prev_;
                            if (next_ == NULL)
                                return false; // if we do not have where to move

                            next_->prev_ = prev_;
                            prev_->next_.store(next_, std::memory_order_release);
                            free(temphead_of_queue);

                            temphead_of_queue = next_;
                            temphead = temphead_
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

### Core Architecture Module: `benchmark/local_infinity/knn/hnsw_benchmark_util.h`
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

#pragma once

import infinity_core;
import std.compat;

using namespace infinity;

namespace benchmark {

template <typename T>
std::tuple<size_t, i32, std::unique_ptr<T[]>> DecodeFvecsDataset(const std::filesystem::path &path) {
    auto [file_handle, status] = VirtualStore::Open(path.string(), FileAccessMode::kRead);
    if (!status.ok()) {
        UnrecoverableError(status.message());
    }
    i32 dim = 0;
    file_handle->Read(&dim, sizeof(dim));
    size_t file_size = file_handle->FileSize();
    size_t vec_num = file_size / (dim * sizeof(T) + sizeof(dim));
    auto data = std::make_unique_for_overwrite<T[]>(vec_num * dim);
    for (size_t i = 0; i < vec_num - 1; ++i) {
        file_handle->Read(data.get() + i * dim, dim * sizeof(T));
        i32 dim1 = 0;
        file_handle->Read(&dim1, sizeof(dim1));
        if (dim1 != dim) {
            UnrecoverableError("dim not match");
        }
    }
    file_handle->Read(data.get() + (vec_num - 1) * dim, dim * sizeof(T));
    return {vec_num, dim, std::move(data)};
}

} // namespace benchmark

```

### Core Architecture Module: `benchmark/local_infinity/sparse/sparse_benchmark_util.h`
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

#pragma once

#include <CLI/CLI.hpp>
#include <atomic>
#include <filesystem>
#include <functional>
#include <memory>
#include <numeric>
#include <random>
#include <string>
#include <thread>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

using namespace infinity;

using Path = std::filesystem::path;
template <typename T>
using Vector = std::vector<T>;
template <typename T1, typename T2>
using Pair = std::pair<T1, T2>;
template <typename... Args>
using Tuple = std::tuple<Args...>;
template <typename T>
using Atomic = std::atomic<T>;
template <typename T>
using HashSet = std::unordered_set<T>;
template <typename K, typename V>
using Map = std::unordered_map<K, V>;
using String = std::string;

namespace benchmark {

SparseMatrix<f32, i32> DecodeSparseDataset(const Path &data_path) {
    auto [file_handle, status] = VirtualStore::Open(data_path.string(), FileAccessMode::kRead);
    if (!status.ok()) {
        UnrecoverableError(fmt::format("Can't open file: {}, reason: {}", data_path.string(), status.message()));
    }
    return SparseMatrix<f32, i32>::Load(*file_handle);
}

std::vector<size_t> ShuffleSparseMatrix(SparseMatrix<f32, i32> &mat) {
    std::vector<size_t> idx(mat.nrow_);
    std::iota(idx.begin(), idx.end(), 0);
    std::shuffle(idx.begin(), idx.end(), std::mt19937(std::random_device()()));

    auto indptr = std::make_unique_for_overwrite<i64[]>(mat.nrow_ + 1);
    auto indices = std::make_unique_for_overwrite<i32[]>(mat.nnz_);
    auto data = std::make_unique_for_overwrite<f32[]>(mat.nnz_);

    indptr[0] = 0;
    for (i64 i = 0; i < mat.nrow_; ++i) {
        indptr[i + 1] = indptr[i] + mat.indptr_[idx[i] + 1] - mat.indptr_[idx[i]];
        std::copy(mat.indices_.get() + mat.indptr_[idx[i]], mat.indices_.get() + mat.indptr_[idx[i] + 1], indices.get() + indptr[i]);
        std::copy(mat.data_.get() + mat.indptr_[idx[i]], mat.data_.get() + mat.indptr_[idx[i] + 1], data.get() + indptr[i]);
    }
    mat.data_ = std::move(data);
    mat.indices_ = std::move(indices);
    mat.indptr_ = std::move(indptr);
    return idx; // idx[i] = j means original i row is shuffled to j row
}

void SaveSparseMatrix(const SparseMatrix<f32, i32> &mat, const Path &data_path) {
    auto [file_handle, status] = VirtualStore::Open(data_path.string(), FileAccessMode::kWrite);
    if (!status.ok()) {
        UnrecoverableError(fmt::format("Can't open file: {}, reason: {}", data_path.string(), status.message()));
    }
    mat.Save(*file_handle);
}

Tuple<u32, u32, std::unique_ptr<i32[]>, std::unique_ptr<f32[]>> DecodeGroundtruth(const Path &groundtruth_path, bool meta) {
    auto [file_handle, status] = VirtualStore::Open(groundtruth_path.string(), FileAccessMode::kRead);
    if (!status.ok()) {
        UnrecoverableError(fmt::format("Can't open file: {}, reason: {}", groundtruth_path.string(), status.message()));
    }

    u32 top_k = 0;
    u32 query_n = 0;
    file_handle->Read(&query_n, sizeof(query_n));
    file_handle->Read(&top_k, sizeof(top_k));
    size_t file_size = file_handle->FileSize();
    if (file_size != sizeof(u32) * 2 + (sizeof(i32) + sizeof(float)) * (query_n * top_k)) {
        UnrecoverableError("Invalid groundtruth file format");
    }
    if (meta) {
        return {top_k, query_n, nullptr, nullptr};
    }

    auto indices = std::make_unique<i32[]>(query_n * top_k);
    file_handle->Read(indices.get(), sizeof(i32) * query_n * top_k);
    auto scores = std::make_unique<f32[]>(query_n * top_k);
    file_handle->Read(scores.get(), sizeof(f32) * query_n * top_k);
    return {top_k, query_n, std::move(indices), std::move(scores)};
}

void SaveGroundtruth(u32 top_k, u32 query_n, const i32 *indices, const f32 *scores, const Path &groundtruth_path) {
    auto [file_handle, status] = VirtualStore::Open(groundtruth_path.string(), FileAccessMode::kWrite);
    if (!status.ok()) {
        UnrecoverableError(fmt::format("Can't open file: {}, reason: {}", groundtruth_path.string(), status.message()));
    }
    file_handle->Append(&query_n, sizeof(query_n));
    file_handle->Append(&top_k, sizeof(top_k));
    file_handle->Append(indices, sizeof(i32) * query_n * top_k);
    file_handle->Append(scores, sizeof(f32) * query_n * top_k);
}

const int kQueryLogInterval = 100;

std::vector<Pair<std::vector<u32>, std::vector<f32>>>
Search(i32 thread_n,
       const SparseMatrix<f32, i32> &query_mat,
       u32 top_k,
       i64 query_n,
       std::function<Pair<std::vector<u32>, std::vector<f32>>(const SparseVecRef<f32, i32> &, u32)> search_fn) {
    Vector<Pair<Vector<u32>, Vector<f32>>> res(query_n);
    Atomic<i64> query_idx = 0;
    Vector<std::thread> threads;
    for (i32 thread_id = 0; thread_id < thread_n; ++thread_id) {
        threads.emplace_back([&]() {
            while (true) {
                i64 query_i = query_idx.fetch_add(1);
                if (query_i >= query_n) {
                    break;
                }
                SparseVecRef query = query_mat.at(query_i);
                auto [indices, scores] = search_fn(query, top_k);
                res[query_i] = {std::move(indices), std::move(scores)};

                if (kQueryLogInterval != 0 && query_i % kQueryLogInterval == 0) {
                    std::cout << fmt::format("Querying doc {}\n", query_i);
                }
            }
        });
    };
    for (auto &thread : threads) {
        thread.join();
    }
    return res;
}

void PrintQuery(u32 query_id, const i32 *gt_indices, const f32 *gt_scores, u32 gt_size, const Vector<i32> &indices, const Vector<f32> &scores) {
    std::cout << fmt::format("Query {}\n", query_id);
    std::cout << "Result:\n";
    for (u32 i = 0; i < gt_size; ++i) {
        std::cout << fmt::format("{} {}, ", indices[i], scores[i]);
    }
    std::cout << "\n";
    std::cout << "Groundtruth:\n";
    for (u32 i = 0; i < gt_size; ++i) {
        std::cout << fmt::format("{} {}, ", gt_indices[i], gt_scores[i]);
    }
    std::cout << "\n";
}

f32 CheckGroundtruth(i32 *gt_indices_list, f32 *gt_score_list, const Vector<Pair<Vector<u32>, Vector<f32>>> &results, u32 top_k) {
    u32 query_n = results.size();

    size_t recall_n = 0;
    for (u32 i = 0; i < results.size(); ++i) {
        const auto &[indices, scores] = results[i];
        const i32 *gt_indices = gt_indices_list + i * top_k;

        // const f32 *gt_score = gt_score_list + i * top_k;
        // PrintQuery(i, gt_indices, gt_score, top_k, indices, scores);
        HashSet<u32> indices_set(indices.begin(), indices.end());
        for (u32 j = 0; j < top_k; ++j) {
            if (indices_set.contains(gt_indices[j])) {
                ++recall_n;
            }
        }
    }
    f32 recall = static_cast<f32>(recall_n) / (query_n * top_k);
    return recall;
}

enum class ModeType : i8 {
    kImport,
    kQuery,
    kShuffle,
    kOptimize,
};

enum class DataSetType : u8 {
    kSmall,
    k1M,
    kFull,
};

struct BenchmarkOption {
public:
    BenchmarkOption() : app_("sparse benchmark") {}

    void Parse(int argc, char *argv[]) {
        Map<String, ModeType> mode_type_map = {{"import", ModeType::kImport},
                                               {"query", ModeType::kQuery},
                                               {"shuffle", ModeType::kShuffle},
                                               {"optimize", ModeType::kOptimize}};
        Map<String, DataSetType> dataset_type_map = {
            {"small", DataSetType::kSmall},
            {"1M", DataSetType::k1M},
            {"full", DataSetType::kFull},
        };

        app_.add_option("--mode", mode_type_, "Mode type")->required()->transform(CLI::CheckedTransformer(mode_type_map, CLI::ignore_case));
        app_.add_option("--dataset", dataset_type_, "Dataset type")
            ->required()
            ->transform(CLI::CheckedTransformer(dataset_type_map, CLI::ignore_case));
        app_.add_option("--shuffled", shuffled_, "Shuffled data")->required(false)->transform(CLI::TypeValidator<bool>());
        app_.add_option("--query_n", query_n_, "Test query number")->required(false)->transform(CLI::TypeValidator<i64>());
        app_.add_option("--thread_n", thread_n_, "std::thread number")->required(false)->transform(CLI::Range(1, 1024));
        ParseInner(app_);
        app_.parse(argc, argv);

        String index_name = IndexName();
        Path dataset_dir = Path(test_data_path()) / "benchmark" / "splade";
        query_path_ = dataset_dir / "queries.dev.csr";
        data_path_ = dataset_dir;
        groundtruth_path_ = dataset_dir;
        index_save_path_ = std::filesystem::temp_directory_path();
        data_save_path_ = dataset_dir;
        groundtruth_save_path_ = dataset_dir;
        switch (dataset_type_) {
            case DataSetType::kSmall: {
                if (!shuffled_) {
                    data_path_ /= "base_small.csr";
                    groundtruth_path_ /= "base_small.dev.gt";
                } else {
                    data_path_ /= "base_small_shuffled.csr";
                    groundtruth_path_ /= "base_small_shuffled.dev.gt";
                }
                index_save_path_ /= fmt::format("small_{}.bin", index_name);
                data_save_path_ /= "base_small_shuffled.csr";
                groundtruth_save_path_ /= "base_small_shuffled.dev.gt";
                break;
            }
           
```

### Core Architecture Module: `go/utils.go`
```
// Copyright(C) 2026 InfiniFlow, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package infinity

import (
	"fmt"
	"regexp"
	"strings"

	thriftapi "github.com/infiniflow/infinity-go-sdk/internal/thrift"
)

// ValidNamePattern is the pattern for valid names
const ValidNamePattern = `^[a-zA-Z][a-zA-Z0-9_]*$`

var validNameRegex = regexp.MustCompile(ValidNamePattern)

// CheckValidName checks if a name is valid
func CheckValidName(name string, entityType string) error {
	if strings.TrimSpace(name) == "" {
		return NewInfinityException(
			int(ErrorCodeEmptyDBName),
			fmt.Sprintf("%s name cannot be empty", entityType),
		)
	}
	if !validNameRegex.MatchString(name) {
		return NewInfinityException(
			int(ErrorCodeInvalidIdentifierName),
			fmt.Sprintf("Invalid %s name: %s", entityType, name),
		)
	}
	return nil
}

// NameValidityCheckDecorator returns a decorator-like function that checks name validity before executing the actual function
func NameValidityCheckDecorator(nameArg string, entityType string, fn func(...interface{}) (interface{}, error)) func(...interface{}) (interface{}, error) {
	return func(args ...interface{}) (interface{}, error) {
		// Find the name argument and check its validity
		// This is a simplified version; in real usage, you'd need to match by parameter name
		for _, arg := range args {
			if name, ok := arg.(string); ok {
				if err := CheckValidName(name, entityType); err != nil {
					return nil, err
				}
				break
			}
		}
		return fn(args...)
	}
}

// EscapeString escapes special characters in a string for use in queries
func EscapeString(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `'`, `\'`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return s
}

// QuoteIdentifier quotes an identifier (table name, column name, etc.)
func QuoteIdentifier(name string) string {
	return fmt.Sprintf(`"%s"`, strings.ReplaceAll(name, `"`, `\"`))
}

// QuoteString quotes a string literal
func QuoteString(s string) string {
	return fmt.Sprintf("'%s'", EscapeString(s))
}

// DeprecatedAPI logs a deprecation warning for deprecated APIs
func DeprecatedAPI(oldMethod string, newMethod string) {
	fmt.Printf("WARNING: %s is deprecated, please use %s instead\n", oldMethod, newMethod)
}

// BuildResult builds a result from the response
func BuildResult(res interface{}) (map[string][]interface{}, map[string]interface{}, error) {
	// This is a placeholder implementation
	// In the actual implementation, this would parse the response and build the result
	return nil, nil, nil
}

// SelectResToPolars converts a select result to a Polars-like format
func SelectResToPolars(res interface{}) (interface{}, error) {
	// This is a placeholder implementation
	// In the actual implementation, this would convert the result to a Polars-like format
	return res, nil
}

// TraverseConditions traverses SQL conditions and converts them to expressions
func TraverseConditions(cond interface{}) interface{} {
	// This is a placeholder implementation
	// In the actual implementation, this would traverse SQL conditions
	return cond
}

// GetRemoteConstantExprFromValue converts a Go value to a remote constant expression
func GetRemoteConstantExprFromValue(value interface{}) interface{} {
	// This is a placeholder implementation
	// In the actual implementation, this would convert the value to a remote constant expression
	return value
}

// GetRemoteFunctionExprFromFDE converts an FDE to a remote function expression
func GetRemoteFunctionExprFromFDE(fde *FDE) *thriftapi.FunctionExpr {
	if fde == nil {
		return nil
	}

	// Flatten 2D tensor data to 1D array
	var flatTensorData []float64
	for _, row := range fde.TensorData {
		flatTensorData = append(flatTensorData, row...)
	}

	// Create tensor data constant expression
	tensorConstExpr := thriftapi.NewConstantExpr()
	tensorConstExpr.LiteralType = thriftapi.LiteralType_DoubleArray
	tensorConstExpr.F64ArrayValue = flatTensorData

	// Create target dimension constant expression
	dimConstExpr := thriftapi.NewConstantExpr()
	dimConstExpr.LiteralType = thriftapi.LiteralType_Int64
	dimValue := int64(fde.TargetDimension)
	dimConstExpr.I64Value = &dimValue

	// Create parsed expressions for arguments
	tensorParsedExpr := thriftapi.NewParsedExpr()
	tensorParsedExpr.Type = thriftapi.NewParsedExprType()
	tensorParsedExpr.Type.ConstantExpr = tensorConstExpr

	dimParsedExpr := thriftapi.NewParsedExpr()
	dimParsedExpr.Type = thriftapi.NewParsedExprType()
	dimParsedExpr.Type.ConstantExpr = dimConstExpr

	// Create FDE function expression
	functionExpr := thriftapi.NewFunctionExpr()
	functionExpr.FunctionName = "fde"
	functionExpr.Arguments = []*thriftapi.ParsedExpr{tensorParsedExpr, dimParsedExpr}

	return functionExpr
}

// GetOrdinaryInfo extracts ordinary column information from column info
func GetOrdinaryInfo(columnInfo interface{}, columnDefs []interface{}, columnName string, index int) error {
	// This is a placeholder implementation
	// In the actual implementation, this would extract column information
	return nil
}

// ParsedExpressionToString converts a parsed expression to a string
func ParsedExpressionToString(expr interface{}) string {
	// This is a placeholder implementation
	// In the actual implementation, this would convert the expression to a string
	return fmt.Sprintf("%v", expr)
}

// SearchToString converts a search expression to a string
func SearchToString(search *SearchExpr) string {
	// This is a placeholder implementation
	// In the actual implementation, this would convert the search to a string
	return fmt.Sprintf("%v", search)
}

// QuoteStringLiteral quotes a value as a string literal for a filter
// expression. A backslash is passed through unchanged, which is what a regular
// expression needs, so only the quote itself has to be doubled.
func QuoteStringLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}

// RegexFilter builds a `regex(column, pattern)` filter expression for
// Table.Filter.
//
// The server evaluates the pattern with RE2. When the column carries a
// full-text index built with a sparse gram analyzer (`sparsegram-3-12`,
// optionally `-fold`), the literals the pattern proves mandatory narrow the
// scan through that index first and the regular expression then verifies the
// candidates that survive, so the narrowing can only ever remove rows the
// pattern cannot match. A column without such an index keeps a plain scan.
//
// Example:
//
//	table.Filter(infinity.RegexFilter("doc", `colou?r of the (sky|sea)`))
func RegexFilter(column, pattern string) string {
	return fmt.Sprintf("regex(%s, %s)", column, QuoteStringLiteral(pattern))
}

```

### Core Architecture Module: `gui/app/(dashboard)/database/hooks.ts`
```
import {
  ITableColumns,
  ITableIndex,
  ITableSegment
} from '@/lib/databse-interface';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INode, ITreeViewOnLoadDataProps } from 'react-accessible-treeview';
import {
  listDatabase,
  listTable,
  showTableColumns,
  showTableIndexes,
  showTableSegments
} from '../actions';
import { PureDatabaseRouteParams, TreeParentId } from './interface';
import { buildLeafData, getParentIdById, updateTreeData } from './utils';

export const useHandleClickTreeName = () => {
  const router = useRouter();

  const handleClickTreeName = useCallback(
    ({
      level,
      name,
      parent,
      data
    }: {
      level: number;
      name: string;
      parent: TreeParentId;
      data: INode[];
    }) => {
      if (level === 3) {
        const databaseId = getParentIdById(data, parent);
        if (databaseId) {
          router.push(`/database/${databaseId}/table/${parent}?tab=${name}`);
        }
      }
    },
    [router]
  );

  return { handleClickTreeName };
};

export interface TreeDataProps {
  fetchDatabases?: () => Promise<void>;
}

export const useBuildTreeData = () => {
  const loadedAlertElement = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<INode[]>([]);
  const [nodesAlreadyLoaded, setNodesAlreadyLoaded] = useState<INode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDatabases = useCallback(async () => {
    try {
      setLoading(true);
      const ret = await listDatabase();
      if (ret.databases?.length > 0) {
        setData(
          updateTreeData(
            [
              {
                name: '',
                id: 0,
                children: [],
                parent: null
              }
            ],
            0,
            ret.databases.map((x: string) => ({
              name: x,
              children: [],
              id: x,
              parent: 0,
              isBranch: true
            }))
          )
        );
      }
      setLoading(false);
    } catch (err: unknown) {
      console.log('🚀 ~ fetchDatabases ~ err:', err);
      setLoading(false);
    }
  }, []);

  const fetchTables = useCallback(async (databaseName: string) => {
    const ret = await listTable(databaseName);
    const tables = ret?.tables ?? ret?.table_names ?? [];
    if (tables.length > 0) {
      setData((value) => {
        const tablePropertyList: INode[] = [];
        const tableList = tables.map((x: string) => {
          const leafs = buildLeafData(x);
          tablePropertyList.push(...leafs);

          return {
            name: x,
            children: leafs.map((x) => x.id),
            id: x,
            parent: databaseName,
            isBranch: true
          };
        });

        return [
          ...updateTreeData(value, databaseName, tableList),
          ...tablePropertyList
        ];
      });
    } else {
      setData((value) =>
        value.map((x) => {
          const metadata = x.metadata ?? {};
          if (x.id === databaseName) {
            metadata['isEmpty'] = true;
          }
          return { ...x, metadata };
        })
      );
    }
  }, []);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const onLoadData = async ({ element }: { element: INode }) => {
    if (element?.children?.length > 0) {
      return;
    }

    await fetchTables(element.id as string);

    return undefined;
  };

  const wrappedOnLoadData = async (props: ITreeViewOnLoadDataProps) => {
    const nodeHasNoChildData = props.element.children?.length === 0;
    const nodeHasAlreadyBeenLoaded = nodesAlreadyLoaded.find(
      (e) => e.id === props.element.id
    );

    await onLoadData(props);

    if (nodeHasNoChildData && !nodeHasAlreadyBeenLoaded) {
      const el = loadedAlertElement.current;
      setNodesAlreadyLoaded([...nodesAlreadyLoaded, props.element]);
      if (el) {
        el.innerHTML = `${props.element.name} loaded`;
      }

      // Clearing aria-live region so loaded node alerts no longer appear in DOM
      setTimeout(() => {
        if (el) {
          el.innerHTML = '';
        }
      }, 5000);
    }
  };

  return {
    wrappedOnLoadData,
    data,
    loadedAlertElement,
    loading,
    fetchDatabases
  };
};

export const useFetchTableColumns = ({
  databaseId,
  tableId
}: PureDatabaseRouteParams) => {
  const [tableColumns, setTableColumns] = useState<ITableColumns[]>([]);

  const fetchTableColumns = useCallback(async () => {
    const data = await showTableColumns({
      database_name: databaseId,
      table_name: tableId
    });

    setTableColumns(data);
  }, [databaseId, tableId]);

  useEffect(() => {
    fetchTableColumns();
  }, [fetchTableColumns]);

  return { tableColumns };
};

export const useFetchTableIndexes = ({
  databaseId,
  tableId
}: PureDatabaseRouteParams) => {
  const [tableIndexes, setTableIndexes] = useState<ITableIndex[]>([]);

  const fetchTableIndexes = useCallback(async () => {
    const data = await showTableIndexes({
      database_name: databaseId,
      table_name: tableId
    });

    setTableIndexes(data);
  }, [databaseId, tableId]);

  useEffect(() => {
    fetchTableIndexes();
  }, [fetchTableIndexes]);

  return { tableIndexes };
};

export const useFetchTableSegments = ({
  databaseId,
  tableId
}: PureDatabaseRouteParams) => {
  const [tableSegments, setTableSegments] = useState<ITableSegment[]>([]);

  const fetchTableSegments = useCallback(async () => {
    const data = await showTableSegments({
      database_name: databaseId,
      table_name: tableId
    });

    setTableSegments(data);
  }, [databaseId, tableId]);

  useEffect(() => {
    fetchTableSegments();
  }, [fetchTableSegments]);

  return { tableSegments };
};

```

### Core Architecture Module: `gui/app/(dashboard)/database/utils.ts`
```
import { INode } from 'react-accessible-treeview';
import { Leaf } from './constants';
import { TreeParentId } from './interface';

export const updateTreeData = (
  list: INode[],
  id: string | number,
  children: Array<INode>
) => {
  const data = list.map((node) => {
    if (node.id === id) {
      node.children = children.map((el) => {
        return el.id;
      });
    }
    return node;
  });
  return data.concat(children);
};

export const buildLeafData = (parent: string) => {
  return [
    {
      name: Leaf.Columns,
      children: [],
      id: `${Leaf.Columns}-${parent}`,
      parent
    },
    {
      name: Leaf.Indexes,
      children: [],
      id: `${Leaf.Indexes}-${parent}`,
      parent
    },
    {
      name: Leaf.Segments,
      children: [],
      id: `${Leaf.Segments}-${parent}`,
      parent
    }
  ];
};

export const getParentIdById = (data: INode[], id: TreeParentId) => {
  return data.find((x) => x.id === id)?.parent;
};

```

### Core Architecture Module: `gui/components/hooks/use-toast.ts`
```
'use client';

// Inspired by react-hot-toast library
import * as React from 'react';

import type { ToastActionElement, ToastProps } from '../ui/toast';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST'
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT)
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        )
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false
              }
            : t
        )
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: []
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId)
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, 'id'>;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id }
    });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      }
    }
  });

  return {
    id: id,
    dismiss,
    update
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId })
  };
}

export { toast, useToast };

```

### Core Architecture Module: `gui/lib/hooks.ts`
```
import { useCallback, useState } from 'react';

export const useSeDialogState = () => {
  const [visible, setVisible] = useState(false);

  const showDialog = useCallback(() => {
    setVisible(true);
  }, []);
  const hideDialog = useCallback(() => {
    setVisible(false);
  }, []);

  const switchVisible = useCallback(() => {
    setVisible(!visible);
  }, [visible]);

  return { visible, showDialog, hideDialog, switchVisible };
};

```

### Core Architecture Module: `gui/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IResponseBody } from './databse-interface';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isResponseListExist = (response: IResponseBody, filed: string) => {
  return response.error_code === 0 && Array.isArray(response[filed]);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3552** (2026-11-16): **[Bug] OpenCC sp_seg SIGSEGV during concurrent RAG fulltext indexing on v0.7.4**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  v0.7.4 / e1bd341a2083f092f83face1d28443f8a341cd8e (official x64-v2 image; protocol 37)  ### Other environment information  ```Markdown  ```  ### Actual behavior and How to reproduce it  ## Summary  We observed an Infinity **v0.7.4** native SIGSEGV in OpenCC `sp_seg`, called from a RAG fulltext indexing worker. The inserting client subsequently timed out waiting for its Thrift reply.  We reviewed v0.7.5 source, but have **not run the workload on v0.7.5**. We are asking whether the remaining OpenCC shared-state path is safe or covered by another fix. This report does not claim a reproduced v0.7.5 regression, a confirmed data race, or a deterministic minimal reproducer.  ## Version and environment  - Image tag: `infiniflow/infinity:v0.7.4-x64-v2`. - Local Docker image ID: `sha256:223e5e12bfad4d35a1862cb21fbe58f9b00f5b30e760dfe94cb45d6311bb3d02` (an image ID, not a registry manifest digest). - Startup: `0.7.4`, `v0.7.4-0-e1bd341`, `RelWithDebInfo`, SIMD `sse2`. - Linux x86_64 container, Ubuntu 22.04 runtime, Docker Desktop/WSL2 on Windows. - Container limits: 2 CPU / 2 GiB; fresh independent data volume per run. - Java 21 custom Thrift client, **protocol index 37**, one connection/one sequential writer; fulltext flag 31. This was not a test of the official Python SDK. - Fulltext building workers: default 12 in the OpenCC-crash run; 1 in separate diagnostic contro

- **Issue #3531** (2026-11-16): **[Bug]: `wal_flush = "flush_at_once"` never syncs the WAL; acknowledged databases, tables and rows are lost after a power failure**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  main 5d27942c049d49039557cd357436ae51391d1575 (image `infiniflow/infinity:nightly-x64-v2` of 2026-10-18: "Release: 0.7.4 build on 2026-10-18 ... from branch: main, commit-id: -0-5d27942"), and v0.7.4 (`infiniflow/infinity:v0.7.4-x64-v2`).  ### Other environment information  ```Markdown - Hardware parameters: x86_64, 40 cores, 187 GB RAM - OS type: Linux 5.15 (Ubuntu), ext4, Docker - Others: standalone server, the shipped infinity_conf.toml with one change: [wal] wal_flush = "flush_at_once"   (GET /configs reports "wal_flush": "FlushAtOnce") ```  ### Actual behavior and How to reproduce it   The configuration documents `wal_flush` as:  ``` # flush_at_once: write and flush log each commit # only_write: write log, OS control when to flush the log, default # flush_per_second: logs are written after each commit and flushed to disk per second. ```  (docs/references/configurations.mdx: "Controls how the WAL manager flushes its logs to disk".) With `flush_at_once`, a commit that has been acknowledged should survive a power failure or OS crash. It does not: the WAL is an `std::ofstream`, and after writing a group of commit entries `WalManager::NewFlush()` only calls `ofs_.flush()`, which moves the stream buffer into the kernel page cache; nothing ever calls `fsync`/`fdatasync` on `wal.log`. A trace of the server (`strace -f -y -p <pid> -e trace=openat,write,pwrite64,w

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

### Incident Patch 1: `e7db7afb` (2026-11-24)
**Commit Message**: rust_engine: fix five concurrency defects the index-combination soak (#3585)

**File**: `rust_engine/crates/catalog/src/layout.rs` (modified, +37/-22)
```diff
@@ -2406,10 +2406,17 @@ pub fn dropped_segments_with_ts(
 pub fn write_segments(store: &dyn MetaStore, set: &SegmentSet) -> Result<usize> {
     let mut written = 0usize;
     // A mirror rewrite can leave fewer blocks (or segments) than the previous
-    // one, so start from an empty segment layer for the table - except for the
-    // segments a compaction deprecated, whose records the reference keeps until
-    // `Cleanup` (the `drop|seg|` record is what makes a reader ignore them).
+    // one, so the previous layer has to go - except for the segments a
+    // compaction deprecated, whose records the reference keeps until `Cleanup`
+    // (the `drop|seg|` record is what makes a reader ignore them).
+    //
+    // It goes **after** the new records are in, not before. Deleting first
+    // opened a window in which the table had a segment and no blocks at all, and
+    // a query landing in it read the table as missing (`no blocks for table`)
+    // even though every row was committed. Publishing first means a reader sees
+    // the old layer or the new one, never neither.
     let dropped = dropped_segments(store, &set.db_id, &set.table_id)?;
+    let mut stale: Vec<Vec<u8>> = Vec::new();
     for prefix in [
         key::catalog_segment_prefix(&set.db_id, &set.table_id),
         format!("catalog|blk|{}|{}|", set.db_id, set.table_id),
@@ -2421,34 +2428,42 @@ pub fn write_segments(store: &dyn MetaStore, set: &SegmentSet) -> Result<usize>
             if segment.is_some_and(|s| dropped.contains(&s)) {
                 continue;
             }
-            store.delete(&k)?;
+            stale.push(k);
         }
     }
+    // The keys this write publishes, so the sweep below cannot delete a record
+    // it just wrote.
+    let mut fresh: std::collections::HashSet<Vec<u8>> = std::collections::HashSet::new();
     for seg in &set.segments {
-        store.put(
-            key::catalog_segment_key(&set.db_id, &set.table_id, seg.segment_id).as_bytes(),
-            seg.create_ts.to_string().as_bytes(),
-        )?;
-        store.put(
-            key::catalog_segment_tag_key(
-                &set.db_id,
-                &set.table_id,
-                seg.segment_id,
-                "first_delete_ts",
-            )
-            .as_bytes(),
-            seg.first_delete_ts.to_string().as_bytes(),
-        )?;
+        let segment_key =
+            key::catalog_segment_key(&set.db_id, &set.table_id, seg.segment_id).into_bytes();
+        store.put(&segment_key, seg.create_ts.to_string().as_bytes())?;
+        fresh.insert(segment_key);
+        let tag_key = key::catalog_segment_tag_key(
+            &set.db_id,
+            &set.table_id,
+            seg.segment_id,
+            "first_delete_ts",
+        )
+        .into_bytes();
+        store.put(&tag_key, seg.first_delete_ts.to_string().as_bytes())?;
+        fresh.insert(tag_key);
         written += 2;
         for block in &seg.blocks {
-            store.put(
+            let block_key =
                 key::catalog_block_key(&set.db_id, &set.table_id, seg.segment_id, block.block_id)
-                    .as_bytes(),
-                block.commit_ts.to_string().as_bytes(),
-            )?;
+                    .into_bytes();
+            store.put(&block_key, block.commit_ts.to_string().as_bytes())?;
+            fresh.insert(block_key);
             written += 1;
         }
     }
+    for k in stale {
+        if fresh.contains(&k) {
+            continue;
+        }
+        store.delete(&k)?;
+    }
     // The reference writes `next_segment_id` as "0" when the table is created
     // and **never advances it** (`TableMeta::InitSet`,
     // `table_meta_impl.cpp:274`): the id it hands out is derived from the
```

**File**: `rust_engine/crates/executor/src/blocks/engine.rs` (modified, +108/-60)
```diff
@@ -854,12 +854,12 @@ impl Engine {
         let totals = self.append_totals(&table);
         let append_ts = self.append_ts(&table);
         let mut counts = self.segment_row_counts(&table);
-        // The rows this write covers, table-wide. The append journal is
-        // table-wide too (`append_ts_of` maps a row id through `counts`), so
-        // the two are comparable: a `create` in a block's `version` may only
-        // name a ts whose append lies entirely inside this total. See
-        // [`Self::block_version_batches`].
-        let covered_rows: u64 = counts.iter().map(|(_, rows)| *rows).sum();
+        // A `create` in a block's `version` may only name a ts whose append the
+        // block **holds in full**; that extent is per block, from the rows it
+        // actually encodes (see [`Self::block_version_batches`]). The window
+        // this write aimed at is deliberately not used: it is wider by exactly
+        // the commits that landed mid-checkpoint, and naming their ts is what
+        // made a restart skip their rows.
         // The reference decides per block, by ts: a block is flushed when
         // `record_ts < min(bound_ts, block_max_ts)` where `record_ts` is
         // the ts at which the block was last written and `block_max_ts` the
@@ -994,34 +994,12 @@ impl Engine {
             let seals_now = sealed && !already_recorded;
             let seg_partial =
                 partial && !seals_now && !(sealed && touched.contains(&(segment_id, last_block)));
-            for (k, _) in self
-                .storage
-                .catalog
-                .store()
-                .scan_prefix(format!("blk|{}|{}|{}|", db_id, meta.id, segment_id).as_bytes())?
-            {
-                // The prefix also covers the block's `fast_rough_filter` tag.
-                // It is not a block record (its key has no block id in the
-                // record's position, and `nth(5)` reads the record's tail), so
-                // the sweep below used to delete the filter of every block this
-                // write touched - the reference keeps them until the segment is
-                // re-sealed.
-                if k.ends_with(b"|fast_rough_filter") {
-                    continue;
-                }
-                if seg_partial {
-                    let block_id = String::from_utf8_lossy(&k)
-                        .split('|')
-                        .nth(5)
-                        .and_then(|s| s.parse::<u16>().ok());
-                    if block_id.is_some_and(|b| {
-                        (b as usize) < block_count && !touched.contains(&(segment_id, b))
-                    }) {
-                        continue;
-                    }
-                }
-                self.storage.catalog.store().delete(&k)?;
-            }
+            // The segment's block records are **not** swept here. Deleting them
+            // before the rewrite republishes them leaves a window in which the
+            // table has a segment and no blocks, and a concurrent query reads
+            // that as `no blocks for table` - a committed table answering an
+            // error. `Catalog::publish_segments` puts the new records first and
+            // removes what this write did not produce afterwards.
             let mut seg_filters = crate::fast_rough_filter::Filters::new(&encode_meta.types);
             // Drain the segment block by block so each block's values are freed
             // once it is encoded: holding the whole table's decoded rows while
@@ -1096,7 +1074,7 @@ impl Engine {
                         &append_ts,
                         slot_base,
                         rows,
-                        covered_rows,
+                        (slot_base + rows) as u64,
                     );
                     let mut version = BlockVersionFile::new(&batches, DEFAULT_BLOCK_CAPACITY);
                     for k in 0..rows {
@@ -1232,7 +1210,13 @@ impl Engine {
                     &append_ts,
                     slot_base,
                     chunk.len(),
-                    covered_rows,
+                    // The rows this block **holds**, not the window the write
+                    // aimed at. A commit that lands while the checkpoint walks
+                    // widens the window but leaves its rows in the append
+                    // buffer; naming its ts here would tell a restart's WAL
+                    // replay that rows it never wrote are already on disk, and
+                    // the tail was lost on the next open (1648 of 1800).
+                    (slot_base + chunk.len()) as u64,
                 );
                 let mut version = BlockVersionFile::new(&batches, DEFAULT_BLOCK_CAPACITY);
                 // The slot of a deleted row is its in-segment offset inside the
@@ -1304,6 +1288,13 @@ impl Engine {
                     path: root.join(&block_dir),
                     source: e,
                 })?;
+               
```

**File**: `rust_engine/crates/executor/src/engine/state.rs` (modified, +119/-27)
```diff
@@ -6063,6 +6063,17 @@ pub(crate) fn scalar_only(types: &[String]) -> bool {
 /// and only the cache's reference goes away.
 pub(crate) struct BlockMapCache {
     entries: std::collections::HashMap<storage::format::BlockId, CachedBlock>,
+    /// One counter per block that has ever been rewritten, bumped **after** the
+    /// new files land.
+    ///
+    /// A reader maps a block outside this lock (the open is I/O), so it can be
+    /// holding a directory that a writer replaces underneath it. Comparing the
+    /// generation it started from with the one found when it inserts is what
+    /// stops that mapping - a version file and column bodies from two different
+    /// writes - from being cached and served forever. Without it a rewrite
+    /// could be invisible to the live process until the next restart, while the
+    /// files on disk were already correct.
+    generations: std::collections::HashMap<storage::format::BlockId, u64>,
     /// Insertion order, the clock hand's track: eviction walks it from the
     /// front, giving an entry that was used since its last visit a second
     /// chance (CLOCK). A full sort by timestamp on every eviction would be
@@ -6090,11 +6101,32 @@ impl BlockMapCache {
     pub(crate) fn new() -> Self {
         Self {
             entries: std::collections::HashMap::new(),
+            generations: std::collections::HashMap::new(),
             order: std::collections::VecDeque::new(),
             bytes: 0,
         }
     }
 
+    /// The generation `id` is at: a reader that mapped the block under this
+    /// value may cache it, one that mapped it under an older value must not.
+    pub(crate) fn generation(&self, id: &storage::format::BlockId) -> u64 {
+        self.generations.get(id).copied().unwrap_or(0)
+    }
+
+    /// Marks `id` as rewritten: bumps its generation and drops the mapping the
+    /// cache holds, so the next read maps the files the write just landed.
+    ///
+    /// Called **after** the files are written: a reader that opened the
+    /// directory while the write was in flight discovers the bump when it tries
+    /// to insert and re-opens instead of caching a half-written block.
+    pub(crate) fn bump_generation(&mut self, id: storage::format::BlockId) -> u64 {
+        let next = self.generations.entry(id).or_insert(0);
+        *next += 1;
+        let next = *next;
+        self.remove(&id);
+        next
+    }
+
     /// The mapping for `id`, marked as used since the clock hand last passed.
     pub(crate) fn get(&mut self, id: &storage::format::BlockId) -> Option<Arc<MappedBlock>> {
         let entry = self.entries.get_mut(id)?;
@@ -6219,6 +6251,9 @@ impl BlockMapCache {
         for id in stale {
             self.remove(&id);
         }
+        // A table that is being dropped (or rebuilt under new block ids) has no
+        // generation worth remembering.
+        self.generations.retain(|id, _| id.table_id != table_id);
         // Keep the hand's track from filling with ids that no longer resolve.
         self.order.retain(|id| self.entries.contains_key(id));
     }
@@ -8649,15 +8684,24 @@ impl RowFulltextProvider<'_> {
 
     /// C++ `ColumnIndexReader::Lookup(term, false)`: the row ids whose documents
     /// contain `term`, with stale copies of re-indexed rows removed.
-    pub(crate) fn index_postings(&self, term: &str) -> Option<std::collections::HashSet<usize>> {
-        let (index, tokenizer) = self.index?;
-        self.row_ids?;
-        let guard = index.try_read().ok()?;
+    pub(crate) fn index_postings(&self, term: &str) -> TermPostings {
+        let Some((index, tokenizer)) = self.index else {
+            return TermPostings::Unusable;
+        };
+        if self.row_ids.is_none() {
+            return TermPostings::Unusable;
+        }
+        // A miss here is a writer indexing this column right now. It is not the
+        // same thing as "this column cannot answer", and the caller has to tell
+        // the two apart (see [`TermPostings`]).
+        let Ok(guard) = index.try_read() else {
+            return TermPostings::Busy;
+        };
         if &guard.tokenizer != tokenizer {
-            return None;
+            return TermPostings::Unusable;
         }
         let merged = guard.merge(&[term.to_string()]);
-        Some(
+        TermPostings::Hits(
             merged
                 .postings
                 .get(term)
@@ -8666,19 +8710,61 @@ impl RowFulltextProvider<'_> {
         )
     }
 
-    /// [`Self::index_postings`] over every form the analyzer emitted, or `None`
-    /// when this column has no inverted index to answer the filter.
-    fn analyzed_postings(&self, term: &str) -> Option<std::collections::HashSet<usize>> {
-        let mut out: Option<std::collections::HashSet<usize>> = None;
+    /// [`Self::index_postings`] over every form the analyzer emitted.
+    fn analyzed_postings(&self, term: &str) -> TermPostings {
+        let mut out: std::collections::Hash
```

**File**: `rust_engine/crates/executor/src/engine/statements.rs` (modified, +10/-5)
```diff
@@ -644,21 +644,26 @@ impl Engine {
         // The blocks next, then the WAL's rows on top: what the files carry is
         // already applied, so the replay starts above the newest timestamp they
         // hold (the reference's checkpoint record gives it the same floor).
-        let hydrated = engine.recover_blocks()?;
+        // Per table: a block's `create` says which appends *that table's* files
+        // already hold. One global floor was too high - the fastest table's
+        // checkpoint raised it above another table's rows that were still only
+        // in the append buffer, and the replay then skipped their tail
+        // (`ix_08: 238 rows after restart, expected 325`).
+        let floors = engine.recover_block_floors()?;
         mark("recover_blocks");
         // Two floors, because the two halves of a commit reach the disk in
         // sequence: the KV batch is written first, the block in `CommitBottom`
         // after. A record above `applied` (the newest checkpoint frame) still
-        // has KV work to do; a record above `hydrated` still has to reach a
-        // block.
+        // has KV work to do; a record above its table's floor still has to reach
+        // a block.
         if wal_enabled {
             let mut replayed_appends = Vec::new();
             let mut replayed_deletes = Vec::new();
             engine
                 .txn
-                .recover_into(
+                .recover_into_floors(
                     applied,
-                    hydrated,
+                    &floors,
                     &mut replayed_appends,
                     &mut replayed_deletes,
                 )
```

**File**: `rust_engine/crates/executor/src/knn_scan.rs` (modified, +24/-24)
```diff
@@ -152,6 +152,24 @@ impl KnnProbe {
     }
 }
 
+/// The index's answer, or `None` when it has nothing to say.
+///
+/// `None` sends the statement to the exact scan. An index that names no row at
+/// all - a segment whose publication is in flight, a graph whose build holds the
+/// lock, a probe that landed between two dumps - must not be read as "the table
+/// has no matches". A search that answers nothing for a table that has rows is
+/// the one failure a caller cannot notice or repair, so the empty answer is
+/// handed back as "the index cannot help" and the rows are scored directly.
+fn answered(candidates: HashSet<usize>, uncovered: Vec<usize>) -> Option<KnnProbe> {
+    if candidates.is_empty() && uncovered.is_empty() {
+        return None;
+    }
+    Some(KnnProbe {
+        candidates,
+        uncovered,
+    })
+}
+
 /// Whether the index covers every live row.
 ///
 /// The HNSW path asks this as a *count*: labels are disjoint across segments
@@ -384,10 +402,7 @@ impl Engine {
             // leaf's slot page - tens of milliseconds at 200k rows and ~1 s at
             // 2M - and this is the state of a table nobody deletes from.
             if all_covered(q, members) {
-                return Some(KnnProbe {
-                    candidates,
-                    uncovered: Vec::new(),
-                });
+                return answered(candidates, Vec::new());
             }
             // The counts disagree: the tree's own row list says exactly which
             // rows it holds, and the rest are scored by the exact scan.
@@ -397,10 +412,7 @@ impl Engine {
                 covered.extend(tail.row_ids().into_iter().map(|id| id as usize));
             }
             let uncovered = self.uncovered_rows(q, &covered);
-            return Some(KnnProbe {
-                candidates,
-                uncovered,
-            });
+            return answered(candidates, uncovered);
         }
         let ivf = {
             let tables = self.tables.lock().unwrap();
@@ -442,16 +454,10 @@ impl Engine {
             // Rows written after the mirror are not covered; only those are
             // read by the exact scan, not the table.
             if covers_set(q, &covered) {
-                return Some(KnnProbe {
-                    candidates,
-                    uncovered: Vec::new(),
-                });
+                return answered(candidates, Vec::new());
             }
             let uncovered = self.uncovered_rows(q, &covered);
-            return Some(KnnProbe {
-                candidates,
-                uncovered,
-            });
+            return answered(candidates, uncovered);
         }
         // Sealed segments. `CREATE INDEX` builds the graph into the memory
         // segment (`hnsw_mem`) and a checkpoint seals it into a chunk, so a
@@ -560,10 +566,7 @@ impl Engine {
             .map(|r| r as usize)
             .collect();
         if all_covered(q, labelled) {
-            return Some(KnnProbe {
-                candidates,
-                uncovered: Vec::new(),
-            });
+            return answered(candidates, Vec::new());
         }
         // The counts disagree, so which rows are missing has to be answered with
         // the labels themselves: a delete leaves its row in the graph (the
@@ -579,10 +582,7 @@ impl Engine {
             }
         }
         let uncovered = self.uncovered_rows(q, &covered);
-        Some(KnnProbe {
-            candidates,
-            uncovered,
-        })
+        answered(candidates, uncovered)
     }
 }
 
```

**File**: `rust_engine/crates/executor/tests/index_combination_soak.rs` (added, +1156/-0)
```diff
@@ -0,0 +1,1156 @@
+// Copyright(C) 2026 InfiniFlow, Inc. All rights reserved.
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
+//! Production-readiness soak: the five index families in **every combination**,
+//! under concurrent writes, concurrent reads and restarts.
+//!
+//! The five families are the ones a deployment can put on one table at once:
+//!
+//! | bit | family | SQL | answered by |
+//! |---|---|---|---|
+//! | `FT` | full text | `CREATE INDEX … USING FULLTEXT` | `WHERE filter_text(body, …)` / `SEARCH MATCH TEXT` |
+//! | `SEC` | secondary | `CREATE INDEX … (c1)` | `WHERE c1 = k` |
+//! | `HNSW` | graph ANN on `EMBEDDING` | `… USING HNSW` | `SEARCH MATCH VECTOR (v, …)` |
+//! | `SPANN` | IVF/tree ANN on `EMBEDDING` | `… USING SPANN` | `SEARCH MATCH VECTOR (sv, …)` |
+//! | `PLAID` | tensor index on `TENSOR` | `… USING PLAID` | `SEARCH MATCH TENSOR (tb, …)` |
+//!
+//! Our engine has no ScaNN: the fifth family named in the plan ("scann") is
+//! `SPANN`, the ANN index for an `EMBEDDING` column. `HNSW` and `SPANN` are kept
+//! apart by putting them on two columns, because one column carries one ANN
+//! index.
+//!
+//! ## What a round does
+//!
+//! 1. **Preload** `rows / 4` rows sequentially and sanity-check every index on
+//!    them. This prefix is what the readers below may sample from: it is
+//!    committed and indexed before the concurrency starts, so a missing answer
+//!    is a bug and not a race the test invented.
+//! 2. **Concurrent write phase**: `writers` tasks pull disjoint id ranges from
+//!    one job queue and `INSERT` them in batches, while `readers` tasks sample
+//!    the stable prefix and ask every index of the table for that row, and one
+//!    task runs `FLUSH DATA` (`Engine::flush`) on a timer - so checkpointing,
+//!    chunk publishing (`memindex_capacity`/PLAID chunk target are set small on
+//!    purpose) and index maintenance all happen *under* the reads.
+//! 3. **Crash**: the engine is dropped without `close()`: no checkpoint, no
+//!    drain, exactly what `kill -9` leaves behind (WAL frames and mmap'd pages
+//!    only). This is the same "the kill: no checkpoint, no drain" shape as
+//!    `restart_checkpoint.rs`; the real process kill -9 lane is
+//!    `rust_engine/scripts/soak_kill9.sh`.
+//! 4. **Reopen on the same directory** and assert, for every table and every
+//!    index it carries: every acknowledged row is present exactly once
+//!    (`COUNT(*)`, `SUM(id)`, `MIN`/`MAX`), the newest rows are visible, and a
+//!    self-query through each index answers the row itself.
+//!
+//! Every acknowledged row is a committed statement, so `COUNT(*) == SUM` of the
+//! claimed ids is exact: ids are handed out as contiguous ranges, count + sum +
+//! min/max together catch a lost row, a row twice, and a hole.
+//!
+//! ## Scale
+//!
+//! Both lanes are ordinary tests and run in `cargo test --workspace`; together
+//! they cost about two minutes in a debug build (6.5 k rows per table over three
+//! restarts in one, 31 tables in the other). The knobs scale them without
+//! touching the code - the numbers below are past what CI runs:
+//!
+//! ```text
+//! cargo test -p executor --test index_combination_soak -- --nocapture
+//!
+//! INDEX_SOAK_ROWS=4000 INDEX_SOAK_ROUNDS=5 INDEX_SOAK_BATCH=256 \
+//! INDEX_SOAK_WRITERS=16 INDEX_SOAK_READERS=24 \
+//!   cargo test -p executor --test index_combination_soak -- --nocapture
+//! ```
+//!
+//! ## What this caught
+//!
+//! Six defects, all found by the checks below and all fixed in the engine
+//! (`filter_text_pushdown_is_wrong_under_concurrent_writes` is the regression
+//! test for the first; the rest are what the two lanes assert):
+//!
+//! 1. **`WHERE filter_text(…)` matched the whole table while a writer ran.**
+//!    `RowFulltextProvider::postings` fell back to "keep every row" when
+//!    `try_read` on the text index missed (an `INSERT` indexing the same column
+//!    holds it), and there is no residual predicate to correct that. Fixed by
+//!    deciding such rows from their own text (`RowFulltextProvider::local_hit`),
+//!    with `TermPostings::Unusable` kept for the static cases (no index, no ids,
+//!    another analyzer) where the residual does exist.
+//! 2. **A block written by a checkpoint could hold rows whose column values read
+//!    as `NULL`.**
+//!
+//!    ```text
+//!    COUNT(*)                                    -> 1800
+//!    COUNT(*) WHERE id >= 0            
```

**File**: `rust_engine/crates/txn/src/lib.rs` (modified, +46/-5)
```diff
@@ -1298,6 +1298,42 @@ impl TxnManager {
         appends: &mut Vec<ReplayedAppend>,
         deletes: &mut Vec<ReplayedDelete>,
     ) -> Result<usize> {
+        // One floor for every table: the shape a caller with no per-table
+        // information has (a test). An engine reopen uses
+        // [`Self::recover_into_floors`], which knows each table's own floor.
+        self.recover_into_floors(
+            checkpoint_ts,
+            &[(String::new(), block_floor)].into_iter().collect(),
+            appends,
+            deletes,
+        )
+        .await
+    }
+
+    /// [`Self::recover_into`] with a floor **per table**.
+    ///
+    /// A block's `create` timestamp says what that table's files already hold;
+    /// it says nothing about any other table. Folding them into one number
+    /// takes the maximum, i.e. the fastest table's progress, and every slower
+    /// table's tail above it was silently skipped on the next open.
+    ///
+    /// A table missing from `block_floors` replays from zero: nothing proved its
+    /// rows are in a block, and re-adding a row that is already there is a
+    /// duplicate the next checkpoint merges by slot, while skipping one is a
+    /// lost row.
+    pub async fn recover_into_floors(
+        &self,
+        checkpoint_ts: TxnTimeStamp,
+        block_floors: &std::collections::HashMap<String, TxnTimeStamp>,
+        appends: &mut Vec<ReplayedAppend>,
+        deletes: &mut Vec<ReplayedDelete>,
+    ) -> Result<usize> {
+        let table_floor = |table: &str| -> TxnTimeStamp {
+            block_floors
+                .get(table)
+                .copied()
+                .unwrap_or_else(|| block_floors.get("").copied().unwrap_or(0))
+        };
         let mut applied = 0;
         // A sealed segment's name carries the timestamp it was sealed at, and
         // every record inside it is at or below that, so a segment both floors
@@ -1317,7 +1353,9 @@ impl TxnManager {
         // that held them was sealed with a ts the frame covers, and their blocks
         // were never written (`test_insert_checkpoint`: one 8192-row batch lost
         // on the restart after each checkpoint).
-        let floor = checkpoint_ts.min(block_floor);
+        // The *lowest* table floor, so a segment is only skipped when every
+        // table's files really do cover its records.
+        let floor = checkpoint_ts.min(block_floors.values().copied().min().unwrap_or(0));
         let covered: std::collections::HashSet<std::path::PathBuf> =
             sealed_segments(&self.wal_path)?
                 .into_iter()
@@ -1333,9 +1371,12 @@ impl TxnManager {
                 let Some(entry) = iter.next() else {
                     break; // torn / corrupt tail
                 };
+                // Per record: the row commands name their table, so the block
+                // floor is looked up there. The entry-level skip below only
+                // takes the cheap way out when *no* table can still need it.
                 let for_kv = entry.commit_ts > checkpoint_ts;
-                let for_blocks = entry.commit_ts > block_floor;
-                if !for_kv && !for_blocks {
+                let for_any_blocks = entry.commit_ts > floor;
+                if !for_kv && !for_any_blocks {
                     continue;
                 }
                 let mut writes = Vec::new();
@@ -1350,7 +1391,7 @@ impl TxnManager {
                             ..
                         } => {
                             // Rows live in the block, never in a `row:` key.
-                            if for_blocks {
+                            if entry.commit_ts > table_floor(&join_table(db_name, table_name)) {
                                 appends.push(ReplayedAppend {
                                     table: join_table(db_name, table_name),
                                     table_id: table_id.parse().unwrap_or(u64::MAX),
@@ -1368,7 +1409,7 @@ impl TxnManager {
                         } => {
                             // The tombstone is the block's `version`; the KV
                             // keeps no `del:` key.
-                            if for_blocks {
+                            if entry.commit_ts > table_floor(&join_table(db_name, table_name)) {
                                 deletes.push(ReplayedDelete {
                                     table: join_table(db_name, table_name),
                                     table_id: table_id.parse().unwrap_or(u64::MAX),
```

---

### Incident Patch 2: `09e5ba09` (2026-11-23)
**Commit Message**: fix a series of rust_engine issues (#3583)

- Bugs of Go SDK of Tensor
- Cross platform of embedded-ffi
- Improved SMVE
- Plaid scoring issues
- min should match syntax for full text

**File**: `go/query_builder.go` (modified, +15/-2)
```diff
@@ -1092,10 +1092,23 @@ func makeMatchTensorExpr(
 	columnExpr.ColumnName = []string{vectorColumnName}
 	columnExpr.Star = false
 
-	// Create embedding data - flatten tensor to array for storage
+	// Create embedding data - flatten the tensor into one array. `tensorData`
+	// holds one row per token for the multi-vector shapes, and the engine
+	// splits the buffer by the column's dimension, so every token has to be
+	// present: writing only `tensorData[0]` silently reduced a multi-token
+	// query to its first token, and MaxSim then summed a single row and ranked
+	// every document by a one-token match.
 	data := thriftapi.NewEmbeddingData()
 	if len(tensorData) > 0 {
-		data.F64ArrayValue = tensorData[0]
+		if len(tensorData) == 1 {
+			data.F64ArrayValue = tensorData[0]
+		} else {
+			flat := make([]float64, 0, len(tensorData)*len(tensorData[0]))
+			for _, row := range tensorData {
+				flat = append(flat, row...)
+			}
+			data.F64ArrayValue = flat
+		}
 	}
 
 	matchTensorExpr := thriftapi.NewMatchTensorExpr()
```

**File**: `go/tests/query_builder_test.go` (modified, +36/-0)
```diff
@@ -526,6 +526,42 @@ func TestQueryBuilderMatchTensor(t *testing.T) {
 	}
 }
 
+// TestMatchTensorKeepsEveryToken guards a multi-vector query's shape.
+//
+// `[][]float32` carries one row per token, and the engine splits the flattened
+// buffer by the column's dimension, so every row has to reach `EmbeddingData`.
+// Writing only `tensorData[0]` turned a multi-token query into a single-token
+// one; MaxSim then summed one row, every document was ranked by a one-token
+// match, and the loss showed up as a recall collapse rather than an error.
+func TestMatchTensorKeepsEveryToken(t *testing.T) {
+	tokens := [][]float32{
+		{0.1, 0.2, 0.3},
+		{0.4, 0.5, 0.6},
+		{0.7, 0.8, 0.9},
+	}
+	qb := infinity.NewQueryBuilder()
+	if _, err := qb.MatchTensor("tensor_col", tokens, "float", 10, nil); err != nil {
+		t.Fatalf("MatchTensor failed: %v", err)
+	}
+
+	expr := qb.GetSearch().MatchExprs[0].MatchTensorExpr
+	if expr == nil || expr.EmbeddingData == nil {
+		t.Fatal("MatchTensorExpr / EmbeddingData should not be nil")
+	}
+	want := len(tokens) * len(tokens[0])
+	if got := len(expr.EmbeddingData.F64ArrayValue); got != want {
+		t.Fatalf("embedding data holds %d values, want %d (one row per token)", got, want)
+	}
+	for i, token := range tokens {
+		for j, value := range token {
+			got := expr.EmbeddingData.F64ArrayValue[i*len(token)+j]
+			if got != float64(value) {
+				t.Fatalf("value[%d][%d] = %v, want %v", i, j, got, value)
+			}
+		}
+	}
+}
+
 // TestQueryBuilderFusion tests the Fusion method
 func TestQueryBuilderFusion(t *testing.T) {
 	qb := infinity.NewQueryBuilder()
```

**File**: `rust_engine/crates/embedded-ffi/src/lib.rs` (modified, +202/-140)
```diff
@@ -16,39 +16,50 @@
 //!
 //! A local client (rgrep's daemon) does not want a server to install, a port to
 //! pick or a supervisor to keep the two in step. It wants one process whose
-//! lifetime is its own. This crate is that: `inf_embedded_start` opens the
-//! engine on a directory, serves the ordinary thrift front end on a **unix
-//! socket** inside that directory, and `inf_embedded_stop` closes both.
+//! lifetime is its own. This crate is that: an entry point opens the engine on a
+//! directory, serves the ordinary thrift front end on an endpoint inside that
+//! directory (or on a loopback port), and the matching stop closes both.
+//!
+//! Two entry points, because a socket path is not portable:
+//!
+//! * [`inf_embedded_start`] binds a unix socket (`cfg(unix)` only). rgrep's
+//!   daemon uses it.
+//! * [`inf_embedded_start_tcp`] binds `127.0.0.1:0` and reports the assigned
+//!   port. It is the cross-platform entry point: Windows has no usable
+//!   `tokio::net::UnixListener`, and a loopback port also lets a host whose
+//!   unix-socket path budget is small (`sun_path` is 104 bytes on macOS) avoid
+//!   the limit entirely.
 //!
 //! Why a socket rather than a direct call: everything above the transport -
 //! thrift framing, the session table, every statement arm, the panic boundary -
-//! already exists in `server`, and a client that speaks thrift over a unix
-//! socket is the *same* client code as one that speaks it over TCP (the Go SDK
-//! only swaps its dialer). A function-call ABI would have meant a second
-//! statement path to keep in step with the first.
+//! already exists in `server`, and a client that speaks thrift over a socket is
+//! the *same* client code as one that speaks it over TCP (the Go SDK only swaps
+//! its dialer). A function-call ABI would have meant a second statement path to
+//! keep in step with the first.
 //!
-//! Ownership: the handle returned by `inf_embedded_start` owns the runtime
-//! thread and the socket file; `inf_embedded_stop` joins that thread, removes
-//! the file and releases the engine, after which the data directory can be
-//! reopened. Every entry point catches panics - a panic must never unwind
-//! across the FFI boundary.
+//! Ownership: the handle returned by a start owns the runtime thread and the
+//! socket file; the stop joins that thread, removes the file and releases the
+//! engine, after which the data directory can be reopened. Every entry point
+//! catches panics - a panic must never unwind across the FFI boundary.
 
 #![allow(non_camel_case_types)]
 
 use std::ffi::{c_char, c_int, CStr, CString};
 use std::panic::{catch_unwind, AssertUnwindSafe};
 use std::ptr;
 use std::sync::mpsc;
+use std::sync::Arc;
 use std::time::Duration;
 
 use executor::Engine;
 use server::Server;
 
-/// A running engine plus the thread serving its socket.
+/// A running engine plus the thread serving its endpoint.
 pub struct InfEmbedded {
-    /// The socket path, kept as a `CString` so `inf_embedded_addr` can hand out
-    /// a pointer that lives as long as the handle.
-    socket: CString,
+    /// The endpoint, kept as a `CString` so `inf_embedded_addr` can hand out a
+    /// pointer that lives as long as the handle: a socket path for the unix
+    /// entry point, `host:port` for the TCP one.
+    addr: CString,
     stop: Option<tokio::sync::oneshot::Sender<()>>,
     join: Option<std::thread::JoinHandle<()>>,
 }
@@ -89,7 +100,113 @@ unsafe fn c_str<'a>(p: *const c_char, what: &str) -> Result<&'a str, String> {
         .map_err(|_| format!("{what} is not valid UTF-8"))
 }
 
-/// Opens `data_dir` and serves the thrift API on `socket_path`.
+/// Opens the engine and serves it on whatever `bind` returns.
+///
+/// `socket_cleanup` is the path the serving thread unlinks on its way out; the
+/// TCP entry point passes none. `bind` runs inside the runtime's context, which
+/// `install_engine_handle` requires.
+fn boot(
+    data_dir: &str,
+    socket_cleanup: Option<std::path::PathBuf>,
+    bind: impl FnOnce(Arc<Engine>) -> Result<(Server, String), String>,
+) -> Result<InfEmbedded, String> {
+    let runtime = tokio::runtime::Builder::new_multi_thread()
+        .worker_threads(2)
+        .enable_all()
+        .thread_name("infinity-embedded")
+        .build()
+        .map_err(|e| format!("runtime: {e}"))?;
+
+    let engine = Arc::new(
+        runtime
+            .block_on(Engine::open_async(data_dir, Default::default()))
+            .map_err(|e| format!("open {data_dir}: {e}"))?,
+    );
+
+    // `[buffer] memindex_memory_quota`, which the CLI sets and this host did
+    // not: `0` disables the dump trigger, so a tail was never sealed and
+    // every query rebuilt the index from the rows instead of mapping a
+    // chunk. A multi-vector row is ~48 KB, so a 62 k-unit table kept 3 GiB
+    // of vectors resident and one query peaked at 8.2 GiB and still had to
+    // brute-force its way through, because the structure that
```

**File**: `rust_engine/crates/executor/src/blocks/engine.rs` (modified, +37/-13)
```diff
@@ -8700,6 +8700,22 @@ impl Engine {
     /// `None` when the column is not a tensor column: "looks like a tensor" is
     /// then a property of the cell's *text*, which the caller has to read.
     pub(crate) fn tensor_row_ids(&self, table: &str, col: usize) -> Option<Vec<u64>> {
+        self.tensor_row_scan(table, col, false)
+    }
+
+    /// How many rows hold a non-empty tensor, without rendering one of them.
+    ///
+    /// The chunk writer counts a document per parsed tensor (`for_each_tensor_doc`
+    /// drops an empty `[]`), so this is the count a chunk's `doc_num` has to be
+    /// compared with. It reads the slot word's count half and the null bitmap -
+    /// the same verdict, no formatting, no outline access.
+    pub(crate) fn tensor_doc_count(&self, table: &str, col: usize) -> u64 {
+        self.tensor_row_scan(table, col, true)
+            .map(|ids| ids.len() as u64)
+            .unwrap_or(0)
+    }
+
+    fn tensor_row_scan(&self, table: &str, col: usize, non_empty_only: bool) -> Option<Vec<u64>> {
         let table = self.qualified_table(table);
         let meta = self.storage.catalog.get_table_by_name(&table).ok()??;
         let type_text = meta.types.get(col)?;
@@ -8739,18 +8755,24 @@ impl Engine {
                 {
                     continue;
                 }
-                // A slot that exists always renders, but an empty tensor
-                // (`[]`, count 0) is not a document and the chunk writer never
-                // counted it. The count is the low half of the slot word.
-                let Some(word) = data.get(slot * 8..slot * 8 + 8) else {
-                    continue;
-                };
-                let Ok(word) = <[u8; 8]>::try_from(word) else {
-                    continue;
-                };
-                if u64::from_le_bytes(word) & 0xffff == 0 {
-                    continue;
+                if non_empty_only {
+                    // The count is the low half of the slot word.
+                    let Some(word) = data.get(slot * 8..slot * 8 + 8) else {
+                        continue;
+                    };
+                    let Ok(word) = <[u8; 8]>::try_from(word) else {
+                        continue;
+                    };
+                    if u64::from_le_bytes(word) & 0xffff == 0 {
+                        continue;
+                    }
                 }
+                // A slot that is present counts, even when its tensor is empty:
+                // the list is the document *sequence* a chunk's `base_row_id`
+                // indexes into, so it has to keep the same positions the writer
+                // saw. Empty documents are dropped when the chunk is built, not
+                // here - a shorter list would make `docs < seqs.len()` fail and
+                // turn every open into a rebuild.
                 let seq = ((id.segment_id as usize) << 32)
                     | (id.block_id as usize * DEFAULT_BLOCK_CAPACITY + slot);
                 if !dead.contains(seq as u64) {
@@ -8769,8 +8791,10 @@ impl Engine {
                 continue;
             };
             let text = text.trim();
-            // `[]` is an empty tensor: the writer never counted it either.
-            if text.len() > 2 && text.starts_with('[') && text.ends_with(']') {
+            // `[]` is an empty tensor: it keeps its position in the document
+            // sequence, but it is not a document the chunk writer counted.
+            let shaped = text.starts_with('[') && text.ends_with(']');
+            if shaped && (!non_empty_only || text.len() > 2) {
                 out.push(seq as u64);
             }
         }
```

**File**: `rust_engine/crates/executor/src/engine/index_build.rs` (modified, +73/-4)
```diff
@@ -1379,9 +1379,7 @@ impl Engine {
             else {
                 return false;
             };
-            self.tensor_row_ids(table, ci)
-                .map(|ids| ids.len() as u64)
-                .unwrap_or(0)
+            self.tensor_doc_count(table, ci)
         } else {
             // IVF: the writer's coverage is `column_vectors`, which skips a
             // NULL or unparseable cell. Comparing against the table's row count
@@ -4216,7 +4214,16 @@ impl Engine {
             .get(&key)
             .and_then(|e| e.mv.get(&index_id).cloned());
         if let Some(shared) = shared {
-            shared.write().unwrap().seal();
+            let mut guard = shared.write().unwrap();
+            // An SMVE column keeps its codes in memory only, so the tail is the
+            // only place they can come from. Building them here - before `seal`
+            // takes the tail - is also what keeps `wants_emvb_chunk`
+            // (`plaid.is_none() && smve.is_none()`) false: without this, a
+            // checkpoint paid a full EMVB prefilter build over every token of
+            // the column (measured: >25 min of one core on 62 k units) for an
+            // index the SMVE search never consults.
+            guard.build_smve();
+            guard.seal();
         }
     }
 
@@ -4568,6 +4575,67 @@ impl Engine {
         }
     }
 
+    /// Fills a table's analyzer maps from the catalog's index records.
+    ///
+    /// `CREATE INDEX … WITH (analyzer=…)` is the only writer of `analyzers`,
+    /// `analyzers_by_index` and `column_index_analyzers`, so a reopened process
+    /// starts with all three empty: `index_tokenizer` then fell back to the
+    /// default analyzer, and an index rebuilt from the persisted rows
+    /// re-tokenised every row with it. That silently changed the answer of a
+    /// `ngram`/`ik`/`rag-chinese` column and dropped the doc payload of a
+    /// `rankfeatures` one. Each `FULLTEXT` record keeps its analyzer in its
+    /// catalog `options`, so the maps are rebuilt from there once per table.
+    pub(crate) fn hydrate_analyzers(&self, table: &str) {
+        let key = self.table_key(table);
+        let loaded = self
+            .tables
+            .lock()
+            .unwrap()
+            .get(&key)
+            .is_some_and(|entry| entry.analyzers_loaded);
+        if loaded {
+            return;
+        }
+        let metas = self
+            .storage
+            .catalog
+            .indexes_of_table(&self.qualified_table(table))
+            .unwrap_or_default();
+        let mut tables = self.tables.lock().unwrap();
+        let entry = tables.entry(key).or_default();
+        if entry.analyzers_loaded {
+            return;
+        }
+        entry.analyzers_loaded = true;
+        for meta in metas {
+            if !meta.index_type.eq_ignore_ascii_case("FULLTEXT") {
+                continue;
+            }
+            let Some(analyzer_name) = meta
+                .options
+                .iter()
+                .find(|(key, _)| key.eq_ignore_ascii_case("analyzer"))
+                .map(|(_, value)| value.clone())
+            else {
+                continue;
+            };
+            entry
+                .analyzers_by_index
+                .entry(meta.name.clone())
+                .or_insert_with(|| analyzer_name.clone());
+            entry
+                .column_index_analyzers
+                .entry(meta.column.clone())
+                .or_default()
+                .entry(meta.name.clone())
+                .or_insert_with(|| analyzer_name.clone());
+            entry
+                .analyzers
+                .entry(meta.column.clone())
+                .or_insert_with(|| analyzer_name);
+        }
+    }
+
     /// The analyzer a query written against `column` is tokenised with.
     ///
     /// C++ `SearchDriver::GetAnalyzerName`: a query that names no `@index`
@@ -4576,6 +4644,7 @@ impl Engine {
     /// column has both; only a column whose indexes are all sparse-gram falls
     /// back to one of those.
     pub(crate) fn column_analyzer_name(&self, table: &str, column: &str) -> Option<String> {
+        self.hydrate_analyzers(table);
         let key = self.table_key(table);
         let guard = self.tables.lock().unwrap();
         let entry = guard.get(&key)?;
```

**File**: `rust_engine/crates/executor/src/engine/state.rs` (modified, +26/-0)
```diff
@@ -4110,6 +4110,25 @@ impl MultiVectorIndex {
             );
         }
         if indexed {
+            // The residual codes rank the shortlist; the column holds the
+            // float32 tokens. `ExactScorer` re-scores the rows the probe
+            // returned the way the SMVE branch does, which removes the code's
+            // quantization error from the score the caller sees. It costs one
+            // batch over `topn` rows (200 by default), and without it the
+            // ranking carries `±0.1` per token at a coarse centroid budget:
+            // an unrelated unit whose codes under-reconstruct their magnitude
+            // wins the MaxSim outright.
+            if let Some(rank) = exact.as_mut() {
+                let rank: ExactScorer<'_> = &mut **rank;
+                let seqs: Vec<u64> = hits.iter().map(|(seq, _)| *seq).collect();
+                let scored: std::collections::HashMap<u64, f32> = rank(&seqs).into_iter().collect();
+                for (seq, score) in hits.iter_mut() {
+                    if let Some(exact) = scored.get(seq) {
+                        *score = *exact;
+                    }
+                }
+            }
+
             // A short answer is the probe's answer, not a missing table: IVF
             // visited `n_ivf_probe` centroids and `centroid_score_threshold` may
             // have dropped more, which is what the reference returns as well -
@@ -4938,6 +4957,7 @@ impl Default for TableEntry {
             analyzers: Default::default(),
             imports: None,
             analyzers_by_index: Default::default(),
+            analyzers_loaded: false,
             column_index_analyzers: Default::default(),
             comments: Default::default(),
             hnsw_mem: Default::default(),
@@ -5344,6 +5364,12 @@ pub(crate) struct TableEntry {
     pub(crate) imports: Option<Vec<(u32, u64, u64)>>,
     /// Analyzer per index name: two indexes on one column may differ.
     pub(crate) analyzers_by_index: HashMap<String, String>,
+    /// Whether the three analyzer maps above were reconciled with the catalog.
+    ///
+    /// `CREATE INDEX` is their only writer, so a reopened process has them empty
+    /// until the first `CREATE INDEX`; [`Self::hydrate_analyzers`] fills them once
+    /// per table from the index records' `options`.
+    pub(crate) analyzers_loaded: bool,
     /// Every full-text index of a column, index name → analyzer, sorted by
     /// index name (`SearchDriver::GetAnalyzerName` walks exactly this shape).
     pub(crate) column_index_analyzers: HashMap<String, std::collections::BTreeMap<String, String>>,
```

**File**: `rust_engine/crates/executor/src/engine/statements.rs` (modified, +114/-74)
```diff
@@ -355,6 +355,10 @@ type BoxedMatch<'a> = std::pin::Pin<
     Box<dyn std::future::Future<Output = Result<(Vec<Vec<Value>>, Vec<String>)>> + Send + 'a>,
 >;
 
+/// The groups `rank_features=<col>^<tag>^<weight>,…` names: the scoring
+/// column's position in the schema, and the `(tag, weight)` pairs listed for it.
+type RankFeatureGroups = Vec<(usize, Vec<(String, f64)>)>;
+
 impl Engine {
     /// Opens without a WAL: catalog writes are buffered behind an undo journal
     /// and survive a reopen only if a checkpoint ran after they committed.
@@ -2334,6 +2338,7 @@ impl Engine {
     /// The analyzer recorded for the index named `index_name` on `table`, i.e.
     /// the analyzer of the column that index covers.
     pub(crate) fn analyzer_of_index(&self, table: &str, index_name: &str) -> Option<String> {
+        self.hydrate_analyzers(table);
         let key = self.table_key(table);
         if let Some(a) = self
             .tables
@@ -2370,6 +2375,7 @@ impl Engine {
         table: &str,
         index_name: &str,
     ) -> Option<String> {
+        self.hydrate_analyzers(table);
         let key = self.table_key(table);
         self.tables
             .lock()
@@ -8528,36 +8534,25 @@ impl Engine {
         // analysed into terms instead of being parsed. `TO BE OR NOT` with
         // `operator=and` is four ANDed terms, not a boolean expression.
         if !has_operator_opt && super::text_query::has_query_syntax(&query) {
-            // The tree path scores each leaf on its own: it has no BooleanWeight,
-            // batch-OR or rank-feature channel. Options only the WAND path
-            // implements are rejected instead of being silently dropped -
-            // answering a different question than the one asked is worse than an
-            // error.
-            let given = |name: &str| -> bool {
-                params
-                    .split(';')
-                    .filter_map(|p| p.split_once('='))
-                    .any(|(k, _)| k.trim().eq_ignore_ascii_case(name))
-            };
-            let unsupported = |name: &str| -> Error {
-                Error::Invalid(format!(
-                    "{name} is not supported with the query-string grammar \
-                     (a AND b / a OR b / column:term)"
-                ))
-            };
+            // `similarity=boolean` has no definition on the tree path (it scores
+            // each field separately and counts matched terms, which is the WAND
+            // path's channel), so it stays an error instead of being silently
+            // dropped.
             if boolean {
-                return Err(unsupported("similarity=boolean"));
-            }
-            // `block_max` is not in this set: it only picks an early-termination
-            // algorithm (`EarlyTermAlgo`, `bound_select_statement_impl.cpp:169-190`)
-            // and every value yields the same result set. The tree path scores
-            // every candidate, which is `batch`/`false`; accepting the option
-            // keeps `compare` and the BMW spellings usable on a parsed query.
-            for name in ["minimum_should_match", "rank_features"] {
-                if given(name) {
-                    return Err(unsupported(name));
-                }
+                return Err(Error::Invalid(
+                    "similarity=boolean is not supported with the query-string grammar \
+                     (a AND b / a OR b / column:term)"
+                        .into(),
+                ));
             }
+            // `minimum_should_match` is a count of matched root clauses, which
+            // `MinimumShouldMatchIterator` answers over the query tree
+            // (`minimum_should_match_iterator_impl.cpp`); `rank_features` is
+            // added to each hit's score from the tag payloads, as the WAND path
+            // does. `block_max` only picks an early-termination algorithm
+            // (`bound_select_statement_impl.cpp:169-190`), so every value
+            // yields the same rows; the tree path scores every candidate.
+            let rank_features = self.parse_rank_features(table, &schema, &params)?;
             // The predicate / `filter=` / `IN (…)` narrow the candidates before
             // the tree ranks and truncates, exactly like the WAND path.
             let dead = self.tombstone_set(table)?;
@@ -8575,6 +8570,8 @@ impl Engine {
                     threshold,
                     (bm25_k1, bm25_b),
                     allowed.as_ref(),
+                    super::state::search_option(&params, "minimum_should_match").as_deref(),
+                    &rank_features,
                 )
                 .await?
             {
@@ -8597,52 +8594,8 @@ impl Engine {
                 return Ok((out, hidden.to_vec()));
             }
         }
-        // `rank_features=<col>^<tag>^<weight>,…`: each document's `<col>` value is
-        // a JSON array of `{"<tag>": <number>}` objects (its index uses the
-        // `r
```

**File**: `rust_engine/crates/executor/src/engine/tests_ut.rs` (modified, +63/-0)
```diff
@@ -11211,6 +11211,69 @@ mod tests {
         assert!((pick(&sealed, "2") - pick(&ranked, "2")).abs() < 1e-4);
     }
 
+    /// A reopened directory must keep the analyzer each full-text record was
+    /// created with.
+    ///
+    /// The analyzer maps are written only by `CREATE INDEX`, so a cold handle had
+    /// them empty: `index_tokenizer` fell back to the default tokeniser, and an
+    /// index rebuilt from the persisted rows re-tokenised every row with it. A
+    /// `ngram-3` column then answered nothing (the row became one token `abcdef`
+    /// while the query asks for `bcd`), and a `rankfeatures` one lost its doc
+    /// payload. Both records keep the analyzer in their catalog `options`, which
+    /// `hydrate_analyzers` reads back.
+    #[tokio::test]
+    async fn a_reopened_table_keeps_its_recorded_analyzer() {
+        let dir = tempdir().unwrap();
+        let e = Engine::open_async(dir.path(), Default::default())
+            .await
+            .unwrap();
+        e.execute("CREATE TABLE rz (id INT, body VARCHAR, feat VARCHAR);")
+            .await
+            .unwrap();
+        e.execute(
+            "INSERT INTO rz VALUES (1,'abcdef','[{\"Tag1\":1}]'),\
+             (2,'abcdef','[{\"Tag1\":2}]');",
+        )
+        .await
+        .unwrap();
+        e.execute("CREATE INDEX rz_body ON rz (body) USING FULLTEXT WITH (analyzer='ngram-3');")
+            .await
+            .unwrap();
+        e.execute(
+            "CREATE INDEX rz_feat ON rz (feat) USING FULLTEXT WITH (analyzer='rankfeatures');",
+        )
+        .await
+        .unwrap();
+        let query = "SELECT id, SCORE() FROM rz SEARCH MATCH TEXT \
+                     ('body','bcd','topn=10;rank_features=feat^Tag1^1');";
+        let warm = rows(&e, query).await;
+        assert_eq!(
+            warm.len(),
+            2,
+            "ngram-3 must match the middle 3-gram: {warm:?}"
+        );
+
+        drop(e);
+        let reopened = Engine::open_async(dir.path(), Default::default())
+            .await
+            .unwrap();
+        let cold = rows(&reopened, query).await;
+        assert_eq!(
+            cold.len(),
+            2,
+            "a reopened table must keep the ngram-3 analyzer: {cold:?}"
+        );
+        let pick = |rs: &[Vec<String>], id: &str| -> f64 {
+            rs.iter()
+                .find(|r| r[0] == id)
+                .unwrap_or_else(|| panic!("id {id} missing: {rs:?}"))[1]
+                .parse()
+                .unwrap()
+        };
+        assert!((pick(&cold, "1") - pick(&warm, "1")).abs() < 1e-4);
+        assert!((pick(&cold, "2") - pick(&warm, "2")).abs() < 1e-4);
+    }
+
     /// A phrase, a multi-token clause under `operator=and`, and a boolean
     /// similarity query answer from the index's postings and position lists: no
     /// row is re-tokenised (`MATCH_ROWS_TOKENIZED` stays 0), which is what the
```

#### Recent Merged Pull Requests:
- **PR #3585** (2026-11-24): rust_engine: fix five concurrency defects the index-combination soak (@yingfeng)
- **PR #3584** (2026-11-24): fulltext: align JSON escapes, query terms, block skips and BM25 with the reference (@yuzhichang)
- **PR #3583** (2026-11-23): fix a series of rust_engine issues (@yingfeng)
- **PR #3582** (2026-11-23): Rust engine: express row visibility as bitmaps, and reclaim unsealed memory on a tick (@yuzhichang)
- **PR #3581** (2026-11-23): plaid: build and fold a tensor mirror in chunks (@yingfeng)
- **PR #3580** (2026-11-21): rust_engine: provided embedded engine running in-process (@yingfeng)

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

## X. rust_engine: fix five concurrency defects the index-combination soak

**RULE**:
When implementing operations in `rust_engine/crates/catalog/src/layout.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e7db7afb`: rust_engine: fix five concurrency defects the index-combination soak. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust_engine/crates/catalog/src/layout.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    // one, so the previous layer has to go - except for the segments a
    // compaction deprecated, whose records the reference keeps until `Cleanup`
    // (the `drop|seg|` record is what makes a reader ignore them).
    //
    // It goes **after** the new records are in, not before. Deleting first
    // opened a window in which the table had a segment and no blocks at all, and
    // a query landing in it read the table as missing (`no blocks for table`)
    // even though every row was committed. Publishing first means a reader sees
    // the old layer or the new one, never neither.
    let mut stale: Vec<Vec<u8>> = Vec::new();
            stale.push(k);
    // The keys this write publishes, so the sweep below cannot delete a record
    // it just wrote.
    let mut fresh: std::collections::HashSet<Vec<u8>> = std::collections::HashSet::new();
        let segment_key =
            key::catalog_segment_key(&set.db_id, &set.table_id, seg.segment_id).into_bytes();
        store.put(&segment_key, seg.create_ts.to_string().as_bytes())?;
        fresh.insert(segment_key);
        let tag_key = key::catalog_segment_tag_key(
            &set.db_id,
            &set.table_id,
        
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    // one, so start from an empty segment layer for the table - except for the
    // segments a compaction deprecated, whose records the reference keeps until
    // `Cleanup` (the `drop|seg|` record is what makes a reader ignore them).
            store.delete(&k)?;
        store.put(
            key::catalog_segment_key(&set.db_id, &set.table_id, seg.segment_id).as_bytes(),
            seg.create_ts.to_string().as_bytes(),
        )?;
        store.put(
            key::catalog_segment_tag_key(
                &set.db_id,
                &set.table_id,
                seg.segment_id,
                "first_delete_ts",
            )
            .as_bytes(),
            seg.first_delete_ts.to_string().as_bytes(),
        )?;
            store.put(
                    .as_bytes(),
                block.commit_ts.to_string().as_bytes(),
            )?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e7db7afb` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
