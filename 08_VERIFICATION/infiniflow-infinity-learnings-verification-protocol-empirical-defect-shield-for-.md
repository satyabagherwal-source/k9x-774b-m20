# Verification Protocol: Verification Protocol: Empirical Defect Shield for infiniflow-infinity-learnings

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow-infinity-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T04:24:07.461Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-infiniflow-infinity-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow-infinity-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T04:24:07.461Z`  
> **Learning ID**: `LEARN-EVO-infiniflow-infinity-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `infiniflow-infinity-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `8c86bcb2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T04:24:02.789Z  
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
> **Harvest Timestamp**: 2026-11-23T04:23:24.693Z  
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

### Incident Patch 1: `d883351d` (2026-11-23)
**Commit Message**: Rust engine: express row visibility as bitmaps, and reclaim unsealed memory on a tick (#3582)

Two pieces that belong to the Rust port of the row-visibility model and
its
memory budget.

## Tombstones and row filters as bitmaps

The reference expresses "which rows may this statement see" as a
CRoaring
`Bitmask` and folds the deleted rows into the same per-segment bitmaps
as the
`WHERE` result (`CommonQueryFilter::NewBuildFilter` ends with
`CheckSegmentRowsVisible`). The port kept two separate `HashSet<u64>`s,
which
cost a deep copy per read and left the index probes filtering after the
fact.

- `common::bitmask` gains `Bitmask` (the reference's `u32` universe with
its
  all-true fast path), `RowBitmap` (a `RoaringTreemap` over row ids: its
partitions are the segment ids, so a segment's runs stay compressed in
that
segment's container) and `RowMask` (the reference's `always_true_` plus
the
  admit/exclude halves an index probe consumes).
- The delete journal, `BlockCursor::dead` and `SpannTail::dead` are
`RowBitmap`s
and are shared (`Arc`) instead of copied on every read. A 980-row run
costs
tens of bytes where a `HashSet` needed ~15 KB, and the 12
`tombstone_set`
  call sites no lo

**File**: `.github/workflows/rust_engine.yml` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ env:
   # rust_engine/docs/GAPS.md section 1.
   RUST_DESELECT: |
     python/restart_test/test_cross_engine_bytes_60_storage.py::test_the_port_round_trips_through_object_storage
+    python/restart_test/test_memidx.py::TestMemIdx::test_optimize_from_different_database
 
   # The level `rust_engine/.cargo/config.toml` leaves at `native` is wrong for a
   # binary that has to run elsewhere, so every lane pins its own here.
```

**File**: `conf/infinity_conf.toml` (modified, +12/-1)
```diff
@@ -51,7 +51,18 @@ buffer_manager_size      = "4GB"
 lru_num                  = 7
 temp_dir                 = "/var/infinity/tmp"
 result_cache             = "off"
-memindex_memory_quota    = "1GB"
+unsealed_memory_quota    = "1GB"
+# Periodic reclaim of memory that is not on disk yet (buffer + index tails):
+# tables nobody writes any more would otherwise hold it until the process ends.
+# A round sorts every such table by fused size/age ranks and dumps until the
+# ledger is back under HALF of unsealed_memory_quota. `unsealed_memory_quota = 0`
+# turns the whole mechanism off; it is the real switch, since the target is
+# derived from it. (The older name `memindex_memory_quota` is still accepted.)
+# unsealed_reclaim_interval:      the loop's period; "0s" stops the scheduler
+#                                 (a direct call still drains).
+# unsealed_max_tables_per_round:  how many tables one round may dump; 0 = no limit.
+unsealed_reclaim_interval     = "30s"
+unsealed_max_tables_per_round = 100
 
 [wal]
 wal_dir                       = "/var/infinity/wal"
```

**File**: `rust_engine/Cargo.lock` (modified, +1/-0)
```diff
@@ -558,6 +558,7 @@ name = "common"
 version = "0.1.0"
 dependencies = [
  "mimalloc",
+ "roaring",
  "thiserror 1.0.69",
 ]
 
```

**File**: `rust_engine/crates/cli/src/config.rs` (modified, +60/-0)
```diff
@@ -101,6 +101,10 @@ pub struct Config {
     /// budget. Only parsed real C++ configs set it.
     buffer_manager_size: Option<i64>,
     mem_index_memory_quota: i64,
+    /// `[buffer] unsealed_reclaim_interval` in seconds: the sweep's period.
+    unsealed_reclaim_interval: u64,
+    /// `[buffer] unsealed_max_tables_per_round`: `0` means no limit.
+    unsealed_max_tables_per_round: u64,
 
     checkpoint_interval: u64,
     wal_compact_threshold: i64,
@@ -155,6 +159,8 @@ impl Default for Config {
             temp_dir: "/var/infinity/tmp".into(),
             buffer_manager_size: None,
             mem_index_memory_quota: 4 * 1024 * 1024 * 1024,
+            unsealed_reclaim_interval: 30,
+            unsealed_max_tables_per_round: 100,
             checkpoint_interval: 86400,
             wal_compact_threshold: 1024 * 1024 * 1024,
             wal_flush: "only_write".into(),
@@ -270,9 +276,27 @@ impl Config {
             }
             ("buffer", "lru_num") => self.lru_num = integer()? as usize,
             ("buffer", "temp_dir") => self.temp_dir = string(),
+            ("buffer", "unsealed_memory_quota") => {
+                self.mem_index_memory_quota = parse_byte_size(&string())?
+            }
+            // The old spelling. Kept so an existing config keeps working; the
+            // name is misleading now - the quota bounds everything not yet on
+            // disk (the append buffer plus every index tail), not one index.
             ("buffer", "memindex_memory_quota") => {
                 self.mem_index_memory_quota = parse_byte_size(&string())?
             }
+            // The reclaim loop's two settings (`docs/MEMORY_RECLAIM.md` §5).
+            // This parser has no consumer of its own - the serving binary reads
+            // the same file through `toml_value` - but the shipped
+            // `conf/infinity_conf.toml` carries both keys and `Config::init`
+            // rejects a key it does not know, so leaving them out made the
+            // shipped config unloadable.
+            ("buffer", "unsealed_reclaim_interval") => {
+                self.unsealed_reclaim_interval = parse_time_info(&string())?
+            }
+            ("buffer", "unsealed_max_tables_per_round") => {
+                self.unsealed_max_tables_per_round = integer()? as u64
+            }
             ("buffer", "result_cache") => self.result_cache = string(),
             ("buffer", "cache_result_capacity") => self.cache_result_capacity = integer()? as u64,
             ("wal", "wal_dir") => self.wal_dir = string(),
@@ -430,6 +454,14 @@ impl Config {
     pub fn mem_index_memory_quota(&self) -> i64 {
         self.mem_index_memory_quota
     }
+    /// `[buffer] unsealed_reclaim_interval` in seconds; `0` stops the sweep.
+    pub fn unsealed_reclaim_interval(&self) -> u64 {
+        self.unsealed_reclaim_interval
+    }
+    /// `[buffer] unsealed_max_tables_per_round`; `0` means no limit.
+    pub fn unsealed_max_tables_per_round(&self) -> u64 {
+        self.unsealed_max_tables_per_round
+    }
     /// `[buffer] buffer_manager_size` in bytes, `None` when the config leaves
     /// it out (the engine then keeps its built-in budget).
     pub fn buffer_manager_size(&self) -> Option<i64> {
@@ -473,6 +505,9 @@ fn parse_time_zone(text: &str) -> Result<(String, i32), ConfigError> {
 }
 
 /// C++: `Config::ParseByteSize`: `KB`/`MB`/`GB` suffixes; `TB` is rejected.
+///
+/// `B` is accepted as a factor of one (`"2B"` is two bytes), which is the
+/// spelling the reclaim tests use to force a drain on the first batch.
 fn parse_byte_size(text: &str) -> Result<i64, ConfigError> {
     let lower = text.trim().to_ascii_lowercase();
     let (number, factor) = if let Some(v) = lower.strip_suffix("kb") {
@@ -483,6 +518,8 @@ fn parse_byte_size(text: &str) -> Result<i64, ConfigError> {
         (v, 1024 * 1024 * 1024)
     } else if lower.ends_with("tb") {
         return Err(ConfigError::InvalidByteSize);
+    } else if let Some(v) = lower.strip_suffix('b') {
+        (v, 1)
     } else {
         (lower.as_str(), 1)
     };
@@ -719,4 +756,27 @@ mod tests {
         assert_eq!(config.resource_path(), "/usr/share/infinity/resource");
         assert_eq!(config.persistence_dir(), "/var/infinity/persistence");
     }
+
+    /// The checked-in config carries the reclaim settings, so `Config::init`
+    /// has to accept them: a key it does not know is `InvalidConfig`.
+    #[test]
+    fn the_shipped_config_loads_its_reclaim_settings() {
+        let mut config = Config::default();
+        config.init(Some(&fixture("infinity_conf.toml"))).unwrap();
+        assert_eq!(config.unsealed_reclaim_interval(), 30);
+        assert_eq!(config.unsealed_max_tables_per_round(), 100);
+    }
+
+    /// `"2B"` is two bytes, not an unparseable value: the end-to-end reclaim
+    /// test sets it to force a drain on the first batch.
+    #[test]
+    fn a_bare_byte_suffix_is_a_factor_of_one() {
+        assert_eq!(parse_byte_siz
```

**File**: `rust_engine/crates/cli/src/main.rs` (modified, +247/-34)
```diff
@@ -105,12 +105,43 @@ fn usage() -> ! {
 }
 
 /// Reads `key = "value"` out of a TOML text without pulling in a parser.
+///
+/// A trailing `# comment` is dropped, and only outside a quoted string: an
+/// operator who writes `unsealed_memory_quota = "512MB" # container budget`
+/// means the size, and the stricter validation below would otherwise reject the
+/// whole line and refuse to start. A `#` inside the quotes stays part of the
+/// value.
 fn toml_value(text: &str, key: &str) -> Option<String> {
-    text.lines()
+    let line = text
+        .lines()
         .map(str::trim)
-        .find(|l| l.starts_with(key) && l[key.len()..].trim_start().starts_with('='))
-        .and_then(|l| l.split_once('='))
-        .map(|(_, v)| v.trim().trim_matches('"').to_string())
+        .find(|l| l.starts_with(key) && l[key.len()..].trim_start().starts_with('='))?;
+    let (_, value) = line.split_once('=')?;
+    Some(
+        strip_toml_comment(value)
+            .trim()
+            .trim_matches('"')
+            .to_string(),
+    )
+}
+
+/// Everything before an unquoted `#`, with a quoted run kept verbatim.
+fn strip_toml_comment(value: &str) -> &str {
+    let mut quoted = false;
+    let mut escaped = false;
+    for (at, ch) in value.char_indices() {
+        if escaped {
+            escaped = false;
+            continue;
+        }
+        match ch {
+            '\\' if quoted => escaped = true,
+            '"' => quoted = !quoted,
+            '#' if !quoted => return &value[..at],
+            _ => {}
+        }
+    }
+    value
 }
 
 /// The reference's default invocation: `infinity [-f <config>] [-m]` starts the
@@ -222,15 +253,21 @@ async fn serve_from_config(path: Option<&str>, maintenance: bool) -> common::Res
     // entry and lets the OS flush; the checkpoint is the durability boundary.
     let wal_flush = toml_value(&text, "wal_flush").unwrap_or_default();
     engine.set_wal_flush(txn::WalFlush::parse(&wal_flush));
-    // `[buffer] memindex_memory_quota` — a memory index is dumped into a C++
-    // chunk once it reaches this size. The reference defaults to 4 GiB.
-    let quota = toml_value(&text, "memindex_memory_quota").unwrap_or_default();
-    let quota = if quota.trim().is_empty() {
-        4 * 1024 * 1024 * 1024
-    } else {
-        parse_size_bytes(&quota)
+    // `[buffer] unsealed_memory_quota` — everything not yet on disk (the append
+    // buffer plus every index tail) is drained once it passes this. The byte
+    // figure the loop compares against is `budget_bytes()`; the reference's
+    // nearest knob is `index_memory_limit` (default 4 GiB). The older spelling
+    // `memindex_memory_quota` is still accepted.
+    //
+    // Parsed before it reaches the engine and rejected with a message naming
+    // the field: a typo used to become zero, which is the explicit off switch,
+    // so the operator got a running server with reclaim disabled and no hint
+    // why. An explicit numeric `0` still disables the mechanism.
+    let quota = match configured_size(&text, "unsealed_memory_quota")? {
+        Some(bytes) => bytes,
+        None => configured_size(&text, "memindex_memory_quota")?.unwrap_or(4 * 1024 * 1024 * 1024),
     };
-    engine.set_memindex_quota(quota);
+    engine.set_unsealed_memory_quota(quota);
     // `[storage] mem_index_capacity` — rows an in-memory index holds before it
     // is dumped into a sealed chunk (the reference defaults to 65536 rows).
     let capacity = toml_value(&text, "mem_index_capacity")
@@ -255,11 +292,8 @@ async fn serve_from_config(path: Option<&str>, maintenance: bool) -> common::Res
     // the decoded HNSW chunks and the block map, so the configured value is
     // applied instead of being dropped - a memory-limited container that asks
     // for 512MB must not get the built-in 8 GiB.
-    if let Some(size) = toml_value(&text, "buffer_manager_size")
-        .map(|v| v.trim().to_string())
-        .filter(|v| !v.is_empty())
-    {
-        let bytes = parse_size_bytes(&size) as usize;
+    if let Some(bytes) = configured_size(&text, "buffer_manager_size")? {
+        let bytes = bytes as usize;
         if bytes > 0 {
             engine.set_buffer_budget(bytes);
             // The same number is the process's RSS ceiling: the budget above
@@ -272,7 +306,7 @@ async fn serve_from_config(path: Option<&str>, maintenance: bool) -> common::Res
     }
     // The reference checkpoints periodically (`[wal] checkpoint_interval`), which
     // is what dumps the memory blocks into the on-disk C++ layout.
-    let secs = parse_interval_secs(&toml_value(&text, "checkpoint_interval").unwrap_or_default());
+    let secs = interval_or_zero(&text, "checkpoint_interval")?;
     // `-m/--maintenance` (the reference's admin mode) leaves the periodic
     // triggers off: maintenance is about inspecting and repairing a stopped
     // node, not about letting cleanup/compact/checkpoint mutate it.
@@ -303,16 +337,40 @@ async fn serv
```

**File**: `rust_engine/crates/common/Cargo.toml` (modified, +3/-0)
```diff
@@ -13,6 +13,9 @@ thiserror.workspace = true
 # `cargo test` alike - no per-target boilerplate, and no link-time conflict when
 # a binary happens to reach two crates that both wanted it.
 mimalloc.workspace = true
+# The tombstone / filter bitmaps: the reference's `Bitmask` is a CRoaring
+# bitmap (`roaring_bitmap.cppm`), and every read path builds one per statement.
+roaring.workspace = true
 
 [lints]
 workspace = true
```

**File**: `rust_engine/crates/common/src/bitmask.rs` (added, +777/-0)
```diff
@@ -0,0 +1,777 @@
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
+//! Row bitmaps: the reference's `Bitmask` / `Bitmap`
+//! (`src/storage/common/roaring_bitmap.cppm`).
+//!
+//! The reference expresses "which rows may this statement see" as a CRoaring
+//! bitmap, never as a hash set. The distinction is not cosmetic: a `DELETE FROM
+//! t WHERE id < 980` marks a *run*, which a roaring container stores in a few
+//! dozen bytes where a `HashSet<u64>` needs ~15 KB and one hash lookup per row
+//! tested. Every scan then tests membership once per candidate row, so the
+//! representation is on the hot path of every indexed query.
+//!
+//! Two shapes live here, matching the two universes the engine has:
+//!
+//! * [`Bitmask`] — a `u32` universe with the reference's **all-true fast
+//!   path**. This is what `CommonQueryFilter::filter_result_` holds, one per
+//!   segment (`common_query_filter.cppm:53`), keyed by segment offset. The
+//!   `all_true` flag is what makes "nobody deleted anything and the statement
+//!   has no predicate" cost zero bytes.
+//! * [`RowBitmap`] — a table-wide `u64` universe over **row ids**
+//!   (`segment << 32 | offset`). `roaring::RoaringTreemap` is a
+//!   `BTreeMap<u32, RoaringBitmap>`, and a row id's high 32 bits are exactly
+//!   that partition key, so one row id is one lookup in the partition its
+//!   segment already selects and the runs a segment deletes stay compressed.
+//!
+//! `RowBitmap` has no `all_true` flag: its callers always mean "these row ids
+//! are in the set", and the empty set is the common case, which is already
+//! zero-cost.
+
+use std::sync::Arc;
+
+use roaring::{RoaringBitmap, RoaringTreemap};
+
+/// The reference's `Bitmask`, i.e. `RoaringBitmap<true>`
+/// (`roaring_bitmap.cppm:27`): a `u32` universe that remembers whether it is
+/// still all-true without materialising the bits.
+///
+/// `count` is the universe (`RoaringBitmap::count_`), so [`Self::is_true`]
+/// answers `false` for an index at or past it exactly as the reference does
+/// (`roaring_bitmap.cppm:88-95`).
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub struct Bitmask {
+    count: u32,
+    all_true: bool,
+    values: RoaringBitmap,
+}
+
+impl Bitmask {
+    /// C++ `Bitmask(count)`: every bit in `0..count` is set.
+    pub fn all_true(count: u32) -> Self {
+        Self {
+            count,
+            all_true: true,
+            values: RoaringBitmap::new(),
+        }
+    }
+
+    /// C++ `Bitmap(count)`: nothing is set.
+    pub fn all_false(count: u32) -> Self {
+        Self {
+            count,
+            all_true: false,
+            values: RoaringBitmap::new(),
+        }
+    }
+
+    /// C++ `RoaringBitmap::count()`: the universe, not the cardinality.
+    pub fn count(&self) -> u32 {
+        self.count
+    }
+
+    /// C++ `RoaringBitmap::IsAllTrue()`.
+    pub fn is_all_true(&self) -> bool {
+        self.all_true
+    }
+
+    /// C++ `RoaringBitmap::IsTrue(row)`.
+    ///
+    /// A row outside the universe answers `false`: the reference logs and
+    /// returns `false` rather than including it (`roaring_bitmap.cppm:88-95`).
+    pub fn is_true(&self, row: u32) -> bool {
+        row < self.count && (self.all_true || self.values.contains(row))
+    }
+
+    /// C++ `RoaringBitmap::SetTrue(row)`. Out-of-universe writes are dropped;
+    /// the reference treats them as an unrecoverable error, and a bitmap that
+    /// silently grew past its universe would make [`Self::count_true`] lie.
+    pub fn set_true(&mut self, row: u32) {
+        if row >= self.count || self.all_true {
+            return;
+        }
+        self.values.insert(row);
+        if self.values.len() == u64::from(self.count) {
+            self.all_true = true;
+            self.values.clear();
+        }
+    }
+
+    /// C++ `RoaringBitmap::SetFalse(row)`.
+    pub fn set_false(&mut self, row: u32) {
+        if row >= self.count {
+            return;
+        }
+        // `TryRemoveAllTrueFlag`: the all-true shortcut has to become real bits
+        // before one can be cleared.
+        if self.all_true {
+            self.values.insert_range(0..self.count);
+            self.all_true = false;
+        }
+        self.values.remove(row);
+    }
+
+    /// C++ `RoaringBitmap::CountTrue()`.
+    pub fn count_true(&self) -> u32 {
+        if self.all_true {
+            self.count
+        } else {
+  
```

**File**: `rust_engine/crates/common/src/lib.rs` (modified, +2/-0)
```diff
@@ -38,6 +38,7 @@
 #[global_allocator]
 static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;
 
+pub mod bitmask;
 pub mod cast;
 pub mod datetime;
 pub mod error;
@@ -49,6 +50,7 @@ pub mod types;
 pub mod utility;
 pub mod varchar;
 
+pub use bitmask::{Bitmask, RowBitmap, RowMask, SharedRows};
 pub use cast::{
     bind_integer_cast, integer_try_cast_to_fixlen, integer_try_cast_to_varlen, CastError,
 };
```

---

### Incident Patch 2: `8c86bcb2` (2026-11-23)
**Commit Message**: plaid: build and fold a tensor mirror in chunks (#3581)

### Summary

- The embedded host sets the memindex quota it was leaving at 0, so a
multi-vector tail is sealed during the import instead of by the first
query: 62 k units kept 3 GiB resident and one query peaked at 8.2 GiB
because the structure that would have pruned it is what a dump builds.
Its stop seals the secondary tails as well.
- for_each_tensor_doc / build_plaid_chunk walk the block mirror a block
at a time, so a build costs index + one batch instead of four
whole-table images; both passes are capped (PLAID_BUILD_BATCH_BYTES /
PLAID_TRAIN_SAMPLE_BYTES).
- A chunk is written streaming and a fold plan reads chunk headers only,
so the periodic trigger never decodes a large mirror; the optimize merge
folds a subset and drops the files it folded.
- EMVB gains search_filtered: the filter runs on the candidates, before
the top_n cut, so the answer holds top_n live rows.
- is_multivector_kind is what registers a TENSOR column's memory index
with the write hook and the quota.

**File**: `rust_engine/crates/embedded-ffi/Cargo.toml` (modified, +4/-3)
```diff
@@ -5,10 +5,11 @@ edition.workspace = true
 license.workspace = true
 
 [lib]
-# The shared library a host process (rgrep's daemon) loads: the engine runs
-# inside that process, so its lifetime is the host's.
+# The engine a host process links in: `staticlib` is what rgrep's Go binary
+# links (one file to ship, no dlopen, no library search path), `cdylib` stays
+# for a host that prefers to load it at runtime.
 name = "infinity_embedded"
-crate-type = ["cdylib", "rlib"]
+crate-type = ["cdylib", "staticlib", "rlib"]
 
 [dependencies]
 executor.workspace = true
```

**File**: `rust_engine/crates/embedded-ffi/src/lib.rs` (modified, +45/-18)
```diff
@@ -123,6 +123,20 @@ pub unsafe extern "C" fn inf_embedded_start(
                 .block_on(Engine::open_async(&data_dir, Default::default()))
                 .map_err(|e| format!("open {data_dir}: {e}"))?,
         );
+        // `[buffer] memindex_memory_quota`, which the CLI sets and this host did
+        // not: `0` disables the dump trigger, so a tail was never sealed and
+        // every query rebuilt the index from the rows instead of mapping a
+        // chunk. A multi-vector row is ~48 KB, so a 62 k-unit table kept 3 GiB
+        // of vectors resident and one query peaked at 8.2 GiB and still had to
+        // brute-force its way through, because the structure that would have
+        // pruned it is what the dump builds.
+        //
+        // 1 GiB is a laptop's answer, not the reference's 4 GiB default: it
+        // bounds the tail at ~20 k units and pays the same build work the query
+        // would have paid, once per dump, during the import instead of on the
+        // first search. The chunks it writes are what later opens and queries
+        // map.
+        engine.set_memindex_quota(1 << 30);
         // `install_engine_handle` records the running runtime, so the bind has
         // to happen inside its context.
         let _guard = runtime.enter();
@@ -154,28 +168,41 @@ pub unsafe extern "C" fn inf_embedded_start(
                     // seals (`flush_storage`), which is what keeps the log at
                     // the size of one checkpoint.
                     if engine.has_work_since_checkpoint().await {
-                        // A checkpoint alone leaves every memory index in RAM,
-                        // and the next open rebuilds those tails from the rows
-                        // (`NewTxn::RecoverMemIndex`) - measured at 10.3 s of a
-                        // 10.3 s open for 4.6 k rows, because a multi-vector
-                        // row is ~96 KB. The operator's `FLUSH DATA` does not
-                        // dump either (the reference's flush leaves the tails
-                        // alone), but this host has no background trigger to
-                        // dump later, so the dump belongs here: pay it once on
-                        // the way down instead of on every open.
+                        // Seal the tails the checkpoint leaves in memory, now that
+                        // they are bounded: this host sets a memory quota, so what
+                        // is left is at most one watermark (~64 MiB of vectors,
+                        // seconds to dump) instead of the whole table. Without the
+                        // seal the rows written since the last quota dump have no
+                        // chunk, and the next query rebuilds the multi-vector index
+                        // from the rows rather than mapping the chunks - 248 s for
+                        // 62 k units against milliseconds once they are all there.
                         engine.set_flush_dumps_mem_index(true);
                         if let Err(e) = engine.flush().await {
                             eprintln!("embedded engine: final checkpoint failed: {e}");
                         }
-                        // `WalManager::Cleanup` is the only path that removes a
-                        // sealed segment, and it is the background trigger that
-                        // normally runs it. This host has none, so the stop does
-                        // it: without that step the log keeps every segment it
-                        // ever wrote, which is the disk half of the same
-                        // problem the replay half had.
-                        if let Err(e) = engine.cleanup().await {
-                            eprintln!("embedded engine: final cleanup failed: {e}");
-                        }
+                    }
+                    // The secondary tails, always: a dump is a key-to-rows map
+                    // (no row is read to write it) and sealing it is what lets
+                    // the next open skip a scan of the whole table - measured
+                    // at 94.5 s of a 102 s open for 62 k units with one
+                    // `path` index and nothing sealed. Not gated on the
+                    // checkpoint flag: a checkpoint the append budget already
+                    // ran leaves those tails unsealed, and an empty one is
+                    // skipped inside `dump_index_transaction`.
+                    //
+                    // The vector tails are the other trade and stay put:
+                    // sealing one rebuilds that index from the rows, ~64 ms per
+                    // unit, against the ~1-2 ms per unit `RecoverMemIndex`
+                    // spends rebuilding the same rows on the next open.
+                    engine.dump_secondary_indexes().await;
+                    // `WalManager::Cleanup` is the only path that removes a
+                    // sealed segment, and it is the 
```

**File**: `rust_engine/crates/executor/src/bg_task_ut.rs` (modified, +5/-1)
```diff
@@ -153,7 +153,11 @@ async fn start_background_tasks_sets_processor() {
             std::time::Duration::ZERO,
         )
         .await;
-    assert!(engine.submit_optimize_indexes(), "no processor attached");
+    // `submit_cleanup` is the marker here, not `submit_optimize_indexes`: an
+    // optimize submission now refuses to queue a pass when no index has anything
+    // to fold (its cheap gate), so an empty catalog legitimately answers `false`
+    // whether or not a processor is attached.
+    assert!(engine.submit_cleanup(), "no processor attached");
     engine.drain_background_tasks().await;
     drop(engine);
 }
```

**File**: `rust_engine/crates/executor/src/blocks/engine.rs` (modified, +1344/-202)
```diff
@@ -139,6 +139,20 @@ pub(crate) struct EmbeddingColumn<'a> {
     pub element_type: i32,
 }
 
+/// A `TENSOR`/`MULTIVECTOR` column of one block: the variable-length twin of
+/// [`EmbeddingColumn`]. Its rows are slot/page pairs in the column's `.col` and
+/// their tokens live in `col_{id}_out`, so a reader needs the outline as well
+/// as the body.
+#[derive(Clone, Copy)]
+pub(crate) struct TensorColumn<'a> {
+    /// The declared types (`IndexMeta`/table meta `types`), in column order.
+    pub declared: &'a [String],
+    /// The storage types, in column order.
+    pub storage: &'a [i32],
+    /// Position of the tensor column.
+    pub col: usize,
+}
+
 fn value_cell_text(values: &[Value], col: usize) -> std::borrow::Cow<'_, str> {
     match values.get(col) {
         Some(value) => std::borrow::Cow::Owned(mirror_cell_text(value)),
@@ -230,6 +244,10 @@ fn is_id_ordered(rows: &[(usize, Vec<Value>)]) -> bool {
     rows.windows(2).all(|w| w[0].0 <= w[1].0)
 }
 
+/// What a tensor-index build produces: the chunk id, the number of documents,
+/// the index, and the row each document came from (in document order).
+type PlaidChunkBuild = (u32, usize, PlaidIndex, Vec<u64>);
+
 /// The stored text form of a column default: the same value `AddColumnsData`
 impl Engine {
     /// Root of the C++-format block mirror. The C++ engine keeps the table
@@ -836,6 +854,12 @@ impl Engine {
         let totals = self.append_totals(&table);
         let append_ts = self.append_ts(&table);
         let mut counts = self.segment_row_counts(&table);
+        // The rows this write covers, table-wide. The append journal is
+        // table-wide too (`append_ts_of` maps a row id through `counts`), so
+        // the two are comparable: a `create` in a block's `version` may only
+        // name a ts whose append lies entirely inside this total. See
+        // [`Self::block_version_batches`].
+        let covered_rows: u64 = counts.iter().map(|(_, rows)| *rows).sum();
         // The reference decides per block, by ts: a block is flushed when
         // `record_ts < min(bound_ts, block_max_ts)` where `record_ts` is
         // the ts at which the block was last written and `block_max_ts` the
@@ -1067,7 +1091,13 @@ impl Engine {
                     })
                 };
                 if let Some((rows, filter)) = staged {
-                    let batches = self.block_version_batches(&totals, &append_ts, slot_base, rows);
+                    let batches = self.block_version_batches(
+                        &totals,
+                        &append_ts,
+                        slot_base,
+                        rows,
+                        covered_rows,
+                    );
                     let mut version = BlockVersionFile::new(&batches, DEFAULT_BLOCK_CAPACITY);
                     for k in 0..rows {
                         if let Some(ts) = deleted_at.get(&(first_id + k)) {
@@ -1197,8 +1227,13 @@ impl Engine {
                     &chunk,
                     bitmap_bits,
                 )?;
-                let batches =
-                    self.block_version_batches(&totals, &append_ts, slot_base, chunk.len());
+                let batches = self.block_version_batches(
+                    &totals,
+                    &append_ts,
+                    slot_base,
+                    chunk.len(),
+                    covered_rows,
+                );
                 let mut version = BlockVersionFile::new(&batches, DEFAULT_BLOCK_CAPACITY);
                 // The slot of a deleted row is its in-segment offset inside the
                 // block (`BlockVersion::Delete`); the id window is the block's.
@@ -1474,16 +1509,34 @@ impl Engine {
         ts: &[u64],
         block_start: usize,
         rows_in_block: usize,
+        covered_rows: u64,
     ) -> Vec<(u64, u32)> {
         let end = block_start + rows_in_block;
+        // A `create` may only name a ts whose append this write **covers**.
+        // `totals`/`ts` are the commit journal, read under the table lock, and
+        // the journal is written in a commit's top half while the segment map
+        // that decides what gets walked moves in its bottom: a checkpoint that
+        // lands in between sees an append whose rows it will not write. Naming
+        // that append's ts on rows that *are* in the file is not a cosmetic
+        // inaccuracy - `Engine::open` derives the row replay floor from these
+        // `create` timestamps (`recover_blocks` -> `newest`), so a `kill -9`
+        // then skips exactly the append it named and the batch is gone (the
+        // `restart_test` checkpoint race: 8192 rows short after a restart).
+        //
+        // Nothing changes while the journal and the segment map agree, which
+        // is every write whose rows are already placed.
+        let ahead = totals.last().copied().unwrap_or(0) > covered_rows;
+        let clamped =
+            |i: usize| -> bool { !ahead || totals.get(i).is_so
```

**File**: `rust_engine/crates/executor/src/blocks/index_chunk.rs` (modified, +207/-0)
```diff
@@ -130,6 +130,169 @@ pub(crate) struct IvfOptions {
     pub(crate) min_points: usize,
 }
 
+/// Rows a PLAID chunk grows to before a dump starts a new one.
+///
+/// The engine's segment holds `DEFAULT_SEGMENT_CAPACITY` = 8M rows
+/// (`common/default_values.cppm:69`) and a segment's mirror must stay loadable
+/// as a handful of chunks, so `8M / max_open_chunks_per_index` (8) is the size a
+/// chunk aims for. A chunk is a *dump accumulator*, not a segment: the segment
+/// is what seals, and a sealed segment's chunks never change again.
+pub(crate) const PLAID_CHUNK_TARGET_ROWS: usize = 1 << 20;
+
+/// A chunk below `total / PLAID_SMALL_CHUNK_DIVISOR` is folded into its
+/// neighbour even when the chunk count is under the cap: eight chunks that are
+/// all tiny still make the loader copy the whole mirror.
+pub(crate) const PLAID_SMALL_CHUNK_DIVISOR: u32 = 16;
+
+/// Outliers buffered before the centroid set is expanded
+/// (`PlaidIndexInMem::Update`'s buffer, the reference's 100).
+pub(crate) const PLAID_OUTLIER_BUFFER: usize = 100;
+
+/// L2 distance above which a document counts as an outlier of the centroid set.
+pub(crate) const PLAID_OUTLIER_THRESHOLD: f32 = 0.1;
+
+/// Which chunks an optimize pass folds, from their document counts in chunk-id
+/// order: `Some(positions)` when the mirror needs work, `None` when it does not.
+///
+/// - over the cap: every chunk folds into one, because the loader would
+///   otherwise merge them all on every open;
+/// - under the cap but with a chunk below `total / 16`: that chunk and its
+///   neighbour fold together. Folding *all* of them for one small chunk would
+///   rewrite the mirror for nothing, which is the cost this rule exists to keep
+///   off the write path.
+pub(crate) fn plaid_fold_plan(doc_nums: &[u32], cap: usize) -> Option<Vec<usize>> {
+    if doc_nums.len() > cap {
+        return Some((0..doc_nums.len()).collect());
+    }
+    if doc_nums.len() < 2 {
+        return None;
+    }
+    let total: u64 = doc_nums.iter().map(|n| u64::from(*n)).sum();
+    let (smallest, &small_docs) = doc_nums.iter().enumerate().min_by_key(|(_, n)| **n)?;
+    if u64::from(small_docs) * u64::from(PLAID_SMALL_CHUNK_DIVISOR) >= total {
+        return None;
+    }
+    // Its neighbour: the previous chunk, so the pair covers a contiguous run of
+    // documents (`base_row_id` order is chunk-id order).
+    let neighbour = smallest.saturating_sub(1).min(doc_nums.len() - 2);
+    let mut plan = vec![neighbour, neighbour + 1];
+    plan.sort_unstable();
+    plan.dedup();
+    Some(plan)
+}
+
+/// Squared L2 distance beyond which a document is an outlier of `codec`.
+///
+/// The scale is the codec's own: the median squared distance between a centroid
+/// and its nearest neighbour, halved. A document farther from every centroid than
+/// half the spacing between them is served no better by the codec than by the
+/// neighbour, which is the case an expansion can fix.
+///
+/// An absolute constant cannot work here - a `TENSOR` column holds whatever
+/// floats the caller stored, normalized embeddings or not - and the reference
+/// never calls its own `PlaidIndex::ExpandCentroids`, so there is no default to
+/// inherit.
+pub(crate) fn plaid_outlier_threshold_sq(codec: &PlaidIndex, dims: usize) -> f32 {
+    if dims == 0 || codec.n_centroids() < 2 {
+        return 0.0;
+    }
+    // At most 256 centroids: the estimate is a median over pairs, and a full
+    // codec's k^2 x dims is more than a buffering heuristic is worth.
+    let stride = (codec.n_centroids() as usize / 256).max(1);
+    let picked: Vec<usize> = (0..codec.n_centroids() as usize).step_by(stride).collect();
+    let data = codec.centroids_data();
+    let mut spacing: Vec<f32> = Vec::with_capacity(picked.len());
+    for (i, a) in picked.iter().enumerate() {
+        let mut best = f32::MAX;
+        for (j, b) in picked.iter().enumerate() {
+            if i == j {
+                continue;
+            }
+            let mut d = 0.0f32;
+            for k in 0..dims {
+                let diff = data[a * dims + k] - data[b * dims + k];
+                d += diff * diff;
+            }
+            best = best.min(d);
+        }
+        if best.is_finite() {
+            spacing.push(best);
+        }
+    }
+    if spacing.is_empty() {
+        return 0.0;
+    }
+    spacing.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
+    spacing[spacing.len() / 2] / 2.0
+}
+
+/// The merge a mirror last performed: its source chunk ids, the chunk it wrote,
+/// and the `(len, mtime)` of each source.
+///
+/// A merge whose deprecation did not land leaves the sources listed beside the
+/// chunk that already contains them. Merging that set again would count those
+/// documents twice, so the manifest is what makes the retry a no-op instead.
+#[derive(Debug, Default, Clone, PartialEq, Eq)]
+pub(crate) struct PlaidMergeManifest {
+    pub(crate) sources: Vec<u64>,
+    pub(crate
```

**File**: `rust_engine/crates/executor/src/blocks/misc.rs` (modified, +349/-1)
```diff
@@ -470,6 +470,129 @@ impl<'a> BlockCursor<'a> {
         Ok(())
     }
 
+    /// `MaxSim` for the rows `ids` name, scored straight out of the column's
+    /// blocks: one decode per block the ids touch, no text round trip.
+    ///
+    /// This is what lets the multi-vector index keep only the row ids it
+    /// published instead of its own copy of the vectors (the `.mvec` segment
+    /// files it used to write): the column already holds them, and a row's
+    /// tokens are one `&[f32]` slice of the block's outline.
+    pub(crate) fn tensor_scores(
+        &mut self,
+        col: usize,
+        dim: usize,
+        query: &[Vec<f32>],
+        ids: &[u64],
+        out: &mut Vec<(u64, f32)>,
+    ) -> Result<()> {
+        if dim == 0 || ids.is_empty() {
+            return Ok(());
+        }
+        let tensor = crate::blocks::engine::TensorColumn {
+            declared: &self.meta.types,
+            storage: &self.types,
+            col,
+        };
+        // The ids arrive in query order, not row order: group them so each block
+        // is mapped once. The slot is the low 32 bits of the row id modulo the
+        // block capacity (`ROW_ID = segment << 32 | block * capacity + slot`).
+        #[allow(clippy::type_complexity)]
+        let mut by_block: std::collections::BTreeMap<(u32, u16), Vec<(u64, usize)>> =
+            Default::default();
+        for seq in ids {
+            let row = (*seq & 0xffff_ffff) as usize;
+            by_block
+                .entry(((seq >> 32) as u32, (row / DEFAULT_BLOCK_CAPACITY) as u16))
+                .or_default()
+                .push((*seq, row % DEFAULT_BLOCK_CAPACITY));
+        }
+        let db_id = self.engine.database_id_of(&self.table);
+        let table_id = self.meta.id;
+        let mut answered: std::collections::HashSet<u64> =
+            std::collections::HashSet::with_capacity(ids.len());
+        for ((segment, block_id), rows) in by_block {
+            if !self.visible.contains(&(segment, block_id)) {
+                continue;
+            }
+            let id = BlockId {
+                db_id,
+                table_id,
+                segment_id: segment,
+                block_id,
+            };
+            let Ok(block) = self.engine.block_map(&self.table, &self.root, id) else {
+                continue;
+            };
+            let version = block.version();
+            let Some((slots, outline, _live)) =
+                self.engine
+                    .block_tensor_body(&self.meta.ids, tensor, version, block.as_ref())
+            else {
+                continue;
+            };
+            for (seq, slot) in rows {
+                if version.deleted.get(slot).copied().unwrap_or(0) != 0 || self.dead.contains(seq) {
+                    continue;
+                }
+                let at = slot * 8;
+                let Some(bytes) = slots.get(at..at + 8) else {
+                    continue;
+                };
+                let Ok(word) = <[u8; 8]>::try_from(bytes) else {
+                    continue;
+                };
+                let word = u64::from_le_bytes(word);
+                let count = (word & 0xffff) as usize;
+                let offset = (word >> 16) as usize;
+                if count == 0 {
+                    continue;
+                }
+                let score = match storage::definition::fixed_f32::tensor_rows_f32(
+                    outline, offset, count, dim,
+                ) {
+                    Some(tokens) => storage::simd::maxsim_f32_rows(query, &tokens),
+                    None => {
+                        // A misaligned outline: decode instead of borrowing.
+                        let Some(owned) = storage::definition::fixed_f32::copy_tensor_rows(
+                            outline, offset, count, dim,
+                        ) else {
+                            continue;
+                        };
+                        let tokens: Vec<&[f32]> = owned.iter().map(Vec::as_slice).collect();
+                        storage::simd::maxsim_f32_rows(query, &tokens)
+                    }
+                };
+                out.push((seq, score));
+                answered.insert(seq);
+            }
+        }
+        // Rows a commit appended since the last checkpoint have no block bytes:
+        // their cell is parsed from the text it was written as, the same value
+        // the seal will one day write into a block.
+        let missing: Vec<u64> = ids
+            .iter()
+            .copied()
+            .filter(|seq| !answered.contains(seq))
+            .collect();
+        if !missing.is_empty() {
+            let wanted: std::collections::HashSet<u64> = missing.into_iter().collect();
+            for (row, values) in self.engine.pending_rows_of(&self.table) {
+                let seq = row as u64;
+                if !wanted.contains(&seq) || self.dead.contains(seq) {
+                    continue;
+                }
+        
```

**File**: `rust_engine/crates/executor/src/engine/admin.rs` (modified, +87/-1)
```diff
@@ -1096,6 +1096,80 @@ impl Engine {
         }
     }
 
+    /// Publishes the PLAID mirror of every multi-vector index this process has
+    /// built, so the chunks on disk cover the rows the checkpoint just wrote.
+    ///
+    /// PLAID is **rebuild-mode**: its chunk is a snapshot of the column, and
+    /// before this only a `DumpMemIndex`-style transaction wrote one. A table
+    /// loaded by an import therefore left chunks covering the rows of the last
+    /// dump, and the first query after the import rebuilt the whole index - a
+    /// full row scan plus centroid training over every token vector, on the read
+    /// path. Measured on a 62 k-unit table: past the 120 s RPC timeout, so the
+    /// query failed, and the client that timed out then desynchronised
+    /// (`Select: out of order sequence response` for every later call).
+    ///
+    /// The checkpoint is where this belongs, for the same reason SPANN uses it
+    /// (§9.4): the blocks are final, the write path is already the expensive
+    /// one, and the query path then only reads. `write_plaid_index` appends one
+    /// chunk per dump and shares the first chunk's centroids, so a checkpoint
+    /// that appended little writes little.
+    ///
+    /// Best effort: a column whose index was never built in this process has
+    /// nothing to publish, and a failure here leaves the previous chunks in
+    /// place - `read_plaid_index` compares their document count with the rows it
+    /// can read and falls back to a rebuild when they disagree.
+    pub(crate) async fn publish_plaid_chunks(&self) {
+        let Ok(indexes) = self.storage.catalog.list_indexes() else {
+            return;
+        };
+        for im in indexes {
+            if !im.index_type.eq_ignore_ascii_case("PLAID") {
+                continue;
+            }
+            let Ok(index_id) = self.index_position(&im.table, &im.name) else {
+                continue;
+            };
+            let Some(shared) = self.cached_multivector_index(&im.table, index_id as u64) else {
+                continue;
+            };
+            // A tail below the chunk target waits for the dump that creates the
+            // chunk and folds it (`fold_dumped_mirror`): publishing a stub here
+            // would leave a tiny chunk nothing folds, and inflate the chain the
+            // reader has to merge on every load.
+            let target = self.plaid_chunk_target_rows();
+            {
+                let Ok(index) = shared.read() else {
+                    continue;
+                };
+                // A mirror written before the row list existed can never be
+                // loaded again once a row is deleted (see
+                // `write_plaid_index`), so an index that has been built has to
+                // be published once even with an empty tail. Only a built index:
+                // a checkpoint on a table nothing has queried must not start a
+                // full build here.
+                let stale_layout =
+                    index.plaid.is_some() && self.plaid_chunk_rows(&im.table, &im.name).is_none();
+                if index.tail.len() < target && !stale_layout {
+                    continue;
+                }
+            }
+            {
+                let Ok(mut index) = shared.write() else {
+                    continue;
+                };
+                // `PlaidIndexInMem::BuildIndex` (or its incremental form): the
+                // buffered rows are encoded against the centroids the index
+                // already holds and the buffer is released. There is nothing to
+                // `seal` - a PLAID column's chunk is the index, written by
+                // `write_plaid_index` from the rows below.
+                index.build_plaid();
+            }
+            if let Err(e) = self.write_plaid_index(&im.table, &im.name).await {
+                eprintln!("plaid publish {}: {e}", im.name);
+            }
+        }
+    }
+
     /// SPANN's optimize pass (§18, P5).
     ///
     /// The index is rebuild-mode, so "merge" is "dump once and keep one chunk":
@@ -1347,6 +1421,15 @@ impl Engine {
         // write (a column with no block layout) keeps its rows buffered only.
         let mirror = self.flush_blocks(bound_ts).await;
         mark("flush_blocks");
+        // Every table's rows are in a block for this bound, so the log below it
+        // is reclaimable - `CLEANUP` prunes by the frame alone otherwise, and
+        // the rows a previous crash left in the log would go with it. A table
+        // the mirror could not encode keeps its rows buffered, so a checkpoint
+        // that skipped one does not move this floor.
+        if mirror.as_ref().copied().unwrap_or(false) {
+            self.mirrored_ts
+                .store(bound_ts, std::sync::atomic::Ordering::Relaxed);
+        }
         // `EngineOptions::object_dir`: publish this checkpoint's data files as
         // the reference does (`
```

**File**: `rust_engine/crates/executor/src/engine/ddl.rs` (modified, +5/-10)
```diff
@@ -473,16 +473,11 @@ impl Engine {
             }
         }
         for index in multi_indexes {
-            let dir = index.read().map(|g| g.dir.clone()).ok();
-            if let Some(dir) = dir {
-                if let Ok(entries) = std::fs::read_dir(&dir) {
-                    for entry in entries.flatten() {
-                        let p = entry.path();
-                        if p.extension().is_some_and(|x| x == "mvec" || x == "emvb") {
-                            let _ = storage::chunk_store::remove_file(p);
-                        }
-                    }
-                }
+            if let Ok(dir) = index.read().map(|g| g.dir.clone()) {
+                // Nothing writes under it any more (a multi-vector chunk is a
+                // row-id list); the tree may still hold `seg_*.mvec` files from
+                // before that change.
+                storage::chunk_store::remove_tree(dir);
             }
         }
         self.recompute_memindex_total();
```

#### Recent Merged Pull Requests:
- **PR #3582** (2026-11-23): Rust engine: express row visibility as bitmaps, and reclaim unsealed memory on a tick (@yuzhichang)
- **PR #3581** (2026-11-23): plaid: build and fold a tensor mirror in chunks (@yingfeng)
- **PR #3580** (2026-11-21): rust_engine: provided embedded engine running in-process (@yingfeng)
- **PR #3579** (2026-11-21): fulltext and spann improvements (@yingfeng)
- **PR #3578** (2026-11-21): rust_engine: close the #3573 gaps (HNSW build parallelism and kernels, import memory, fulltext, exact scan) (@yuzhichang)
- **PR #3577** (2026-11-19): add license header (@yingfeng)

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

## X. Rust engine: express row visibility as bitmaps, and reclaim unsealed memory on a

**RULE**:
When implementing operations in `.github/workflows/rust_engine.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d883351d`: Rust engine: express row visibility as bitmaps, and reclaim unsealed memory on a tick. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/rust_engine.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    python/restart_test/test_memidx.py::TestMemIdx::test_optimize_from_different_database
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d883351d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
