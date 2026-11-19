# Verification Protocol: Verification Protocol: Empirical Defect Shield for infiniflow/infinity

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow/infinity",
  "source_url": "https://github.com/infiniflow/infinity",
  "source_version": "22c627e7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T18:20:05.693Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-infiniflow-infinity",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow/infinity](https://github.com/infiniflow/infinity) (Revision: `22c627e7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T18:20:05.693Z`  
> **Learning ID**: `learn-github-infiniflow-infinity`


## 1. Scope & Verification Target
- **Target Repository**: `infiniflow/infinity` (Commit: `22c627e7`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): infiniflow/infinity

> **Canonical Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T18:20:04.550Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4770 stars

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

### Incident Patch 1: `d95c80d2` (2026-11-19)
**Commit Message**: rust_engine: bound process memory; read vectors in place (#3576)

## What

Consolidating memory governance in `rust_engine`, and changing vector
reads from “materializing the whole column” to “borrowing in place.”

### Process memory
- **Block mapping cache** (`BlockMapCache`): CLOCK eviction based on
`buffer_budget`; entry accounting = mapped bytes + decoded `version`
heap (64 KiB per block). Large tables no longer retain every mapping
ever read for the lifetime of the process.
- **Mapping registry**: `MappedFile` owns its slot and returns it on
`Drop`; the reclamation table length follows live mappings rather than
the historical creation count (after block-cache eviction begins, churn
would make the old implementation grow without bound).
- **`release_mapped_pages` cursor rotation**: several consecutive passes
cover the entire tree, instead of advising only the header entries once
per second.
- **`reclaim_memory`**: re-measure the process watermark between steps
(do not trust the “advised bytes” upper bound); escalate to unmapping
block mappings when page advice is insufficient; run the tick
unconditionally (read-only instances also grow page cache without
transactions); at the c

**File**: `rust_engine/crates/executor/examples/mem_bench.rs` (added, +262/-0)
```diff
@@ -0,0 +1,262 @@
+//! Throwaway driver: what bounding the block-map cache costs *index* work.
+//!
+//!   mem_bench <dir> <rows> <dim> <budget_mb> <iters> build
+//!   mem_bench <dir> <rows> <dim> <budget_mb> <iters> measure
+//!   mem_bench <dir> <rows> <dim> <budget_mb> <iters> concurrent <threads>
+//!
+//! `build` creates the tables, loads them through `COPY`, flushes the blocks and
+//! creates the HNSW, SPANN and FULLTEXT indexes (timing each), so every later
+//! run only measures queries. Every run opens the engine with
+//! `buffer_manager_size = budget_mb`, so the only thing that differs between
+//! runs is the budget.
+
+use std::io::Write;
+use std::path::Path;
+use std::sync::atomic::{AtomicUsize, Ordering};
+use std::sync::{Arc, Mutex};
+use std::time::Instant;
+
+use executor::Engine;
+
+fn rss_kb() -> u64 {
+    if let Ok(text) = std::fs::read_to_string("/proc/self/status") {
+        for line in text.lines() {
+            if let Some(rest) = line.strip_prefix("VmRSS:") {
+                if let Some(kb) = rest.split_whitespace().next() {
+                    return kb.parse().unwrap_or(0);
+                }
+            }
+        }
+    }
+    let out = std::process::Command::new("ps")
+        .args(["-o", "rss=", "-p", &std::process::id().to_string()])
+        .output();
+    out.ok()
+        .and_then(|o| String::from_utf8(o.stdout).ok())
+        .and_then(|s| s.trim().parse::<u64>().ok())
+        .unwrap_or(0)
+}
+
+fn rows_of(e: &Engine, sql: &str) -> usize {
+    let out = e
+        .execute_blocking(sql)
+        .unwrap_or_else(|err| panic!("{sql}: {err:?}"));
+    out.iter()
+        .filter_map(|r| match r {
+            executor::QueryResult::Rows { rows, .. } => Some(rows.len()),
+            _ => None,
+        })
+        .max()
+        .unwrap_or(0)
+}
+
+fn vec_text(i: usize, dim: usize) -> String {
+    let body: Vec<String> = (0..dim)
+        .map(|d| {
+            let v = ((i * 31 + d * 17) % 1000) as f32 / 1000.0;
+            format!("{v:.3}")
+        })
+        .collect();
+    format!("[{}]", body.join(","))
+}
+
+fn timed(label: &str, f: impl FnOnce()) {
+    let t0 = Instant::now();
+    f();
+    println!("  {label:<10} {:>8.2} s", t0.elapsed().as_secs_f64());
+}
+
+fn build(e: &Engine, dir: &Path, rows: usize, dim: usize) {
+    e.execute_blocking(&format!(
+        "CREATE TABLE bench (id INT, v EMBEDDING(FLOAT, {dim}), body VARCHAR);"
+    ))
+    .ok();
+    let path = dir.join("bench.csv");
+    {
+        let mut w = std::io::BufWriter::new(std::fs::File::create(&path).unwrap());
+        for i in 0..rows {
+            writeln!(
+                w,
+                "{i},\"{}\",\"alpha w{} beta gamma\"",
+                vec_text(i, dim),
+                i % 1000
+            )
+            .unwrap();
+        }
+        w.flush().unwrap();
+    }
+    timed("copy", || {
+        e.execute_blocking(&format!(
+            "COPY bench FROM '{}' WITH (DELIMITER ',', FORMAT CSV);",
+            path.display()
+        ))
+        .expect("COPY");
+    });
+    timed("flush", || {
+        e.execute_blocking("FLUSH;").expect("FLUSH");
+    });
+    timed("hnsw", || {
+        e.execute_blocking(
+            "CREATE INDEX bench_hnsw ON bench (v) USING HNSW \
+             WITH (metric='l2', encode='plain', m=16, ef_construction=200);",
+        )
+        .expect("CREATE INDEX hnsw");
+    });
+    timed("fulltext", || {
+        e.execute_blocking("CREATE INDEX bench_ft ON bench (body) USING FULLTEXT;")
+            .expect("CREATE INDEX fulltext");
+    });
+
+    // The same vectors in their own table: one vector index per column, and the
+    // SPANN tree is built by reading them through the block cache (`VectorColumn`),
+    // which is the other half of this change.
+    e.execute_blocking(&format!(
+        "CREATE TABLE bench_sp (id INT, v EMBEDDING(FLOAT, {dim}));"
+    ))
+    .ok();
+    let sp_path = dir.join("spann.csv");
+    {
+        let mut w = std::io::BufWriter::new(std::fs::File::create(&sp_path).unwrap());
+        for i in 0..rows {
+            writeln!(w, "{i},\"{}\"", vec_text(i, dim)).unwrap();
+        }
+        w.flush().unwrap();
+    }
+    timed("sp copy", || {
+        e.execute_blocking(&format!(
+            "COPY bench_sp FROM '{}' WITH (DELIMITER ',', FORMAT CSV);",
+            sp_path.display()
+        ))
+        .expect("COPY bench_sp");
+    });
+    timed("sp flush", || {
+        e.execute_blocking("FLUSH;").expect("FLUSH");
+    });
+    timed("spann", || {
+        e.execute_blocking(
+            "CREATE INDEX bench_sp_i ON bench_sp (v) USING SPANN \
+             WITH (min_rows=1, metric='l2', max_partition_size=256, num_centroids=64);",
+        )
+        .expect("CREATE INDEX spann");
+    });
+}
+
+fn queries(rows: usize, dim: usize) -> (String, String, String) {
+    let probe = vec_text(rows / 2, dim);
+    (
+        format!("SELECT id FROM bench SEARCH MATCH VECTOR (v, {probe}, 'float', 'l2
```

**File**: `rust_engine/crates/executor/src/blocks/engine.rs` (modified, +37/-106)
```diff
@@ -75,7 +75,7 @@ impl RowCells<'_> {
 /// One argument for "which column, how wide, in which element type" instead of
 /// five loose ones.
 #[derive(Clone, Copy)]
-pub(crate) struct VectorColumn<'a> {
+pub(crate) struct EmbeddingColumn<'a> {
     /// The declared types (`IndexMeta`/table meta `types`), in column order.
     pub declared: &'a [String],
     /// The storage types, in column order.
@@ -2419,7 +2419,7 @@ impl Engine {
                         };
                         // The new rows may still be in the append buffer, where
                         // the mapped column source refuses to answer
-                        // (`spann_vector_source` returns `None` for a buffered
+                        // (`vector_column` returns `None` for a buffered
                         // table). `BlockCursor::vectors` is the read the exact
                         // rescoring of a query uses: one decode per block the ids
                         // touch, and the buffer's text parsed for the rows that
@@ -3960,11 +3960,25 @@ impl Engine {
         root: &Path,
         id: BlockId,
     ) -> std::io::Result<Arc<MappedBlock>> {
-        if let Some(block) = self.context.block_maps.lock().unwrap().get(&id) {
-            self.context
-                .block_map_hits
-                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
-            return Ok(block.clone());
+        // One load per call, whether the block is cached or not: the budget can
+        // be lowered after mappings were made (a config applied to a running
+        // engine maps the catalog's blocks during open), and a hit never
+        // inserts, so insert-time enforcement alone would leave an over-budget
+        // cache resident for the life of the process.
+        let budget = self
+            .context
+            .buffer_budget
+            .load(std::sync::atomic::Ordering::Relaxed)
+            .max(1);
+        {
+            let mut maps = self.context.block_maps.lock().unwrap();
+            if let Some(block) = maps.get(&id) {
+                self.context
+                    .block_map_hits
+                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
+                maps.trim_to(budget);
+                return Ok(block);
+            }
         }
         self.context
             .block_map_misses
@@ -3981,8 +3995,14 @@ impl Engine {
         };
         // Another reader may have mapped the block while this one did the I/O:
         // keep the first mapping, so a block has exactly one in the process.
-        let mut maps = self.context.block_maps.lock().unwrap();
-        Ok(maps.entry(id).or_insert(block).clone())
+        // The insert also enforces the buffer budget - a block beyond it evicts
+        // the least recently used mappings rather than staying mapped forever.
+        Ok(self
+            .context
+            .block_maps
+            .lock()
+            .unwrap()
+            .insert(id, block, budget))
     }
 
     /// Drops the mappings of every block of `table_id`: the block files under
@@ -3993,7 +4013,7 @@ impl Engine {
             .block_maps
             .lock()
             .unwrap()
-            .retain(|id, _| id.table_id != table_id);
+            .retain_table(table_id);
     }
 
     /// Drops the mapping of one block, for a rewrite that only touches that
@@ -4600,7 +4620,7 @@ impl Engine {
     /// `decode_rows_of_values` answers `Value::Null` for them as well.
     pub(crate) fn decode_vectors_of_block(
         ids: &[u64],
-        vector: VectorColumn<'_>,
+        vector: EmbeddingColumn<'_>,
         id: BlockId,
         version: &storage::definition::format::BlockVersionFile,
         columns: &dyn BlockColumns,
@@ -5853,100 +5873,6 @@ impl Engine {
         out
     }
 
-    /// Hands the buffered cells of `column` for the rows of `segment` (every
-    /// segment when `None`) to `sink`, one cell at a time.
-    ///
-    /// The sink runs **while the buffer is locked**, so it must not reach back into
-    /// `tables` - a segment build only writes to its scratch file.
-    pub(crate) fn for_each_buffered_cell(
-        &self,
-        table: &str,
-        column: usize,
-        segments: Option<&std::collections::HashSet<u32>>,
-        mut sink: impl FnMut(usize, &str),
-    ) {
-        let key = self.table_key(table);
-        let tables = self.tables.lock().unwrap();
-        let Some(entry) = tables.get(&key) else {
-            return;
-        };
-        // The buffer is columnar, so the column is picked by position through
-        // the live schema first, then its cells are walked in row order.
-        let order = self.table_schema_ids(table).unwrap_or_default();
-        let Some(id) = order.get(column).copied() else {
-            return;
-        };
-        for k in 0..entry.pending_rows.len() {
-            let seq = entry.pending_rows.row_id(k);
-            // This side narrows by a *set* of segments (a compaction walks
-        
```

**File**: `rust_engine/crates/executor/src/blocks/misc.rs` (modified, +210/-2)
```diff
@@ -367,7 +367,22 @@ impl<'a> BlockCursor<'a> {
             for seq in &live {
                 if let Some(values) = pending.remove(seq) {
                     if let Some(Value::Str(text)) = values.get(col) {
-                        let parsed = crate::parse_vec_f32(text);
+                        // A row that is still in the append buffer is text, and a
+                        // `BIT` cell's text is a bit string (`[0100…]`): the
+                        // numeric reader turns that into one number, so the row
+                        // was dropped and a query over a table nobody had
+                        // checkpointed scored nothing (`test_knn_binary_hamming`).
+                        // Read it as bits, the same way the block body is
+                        // decoded (`decode_embedding_f32`).
+                        let parsed: Vec<f32> = if element_type == 0 {
+                            crate::parse_bit_leaves(text)
+                                .into_iter()
+                                .flatten()
+                                .map(|bit| bit as f32)
+                                .collect()
+                        } else {
+                            crate::parse_vec_f32(text)
+                        };
                         if parsed.len() == dim {
                             out.push((*seq, parsed));
                         }
@@ -412,7 +427,7 @@ impl<'a> BlockCursor<'a> {
             }
             let Some(rows) = Engine::decode_vectors_of_block(
                 &self.meta.ids,
-                crate::blocks::engine::VectorColumn {
+                crate::blocks::engine::EmbeddingColumn {
                     declared: &self.meta.types,
                     storage: &self.types,
                     col,
@@ -539,6 +554,77 @@ mod tests {
         out
     }
 
+    /// **Experiment, not a gate**: what [`BlockCursor::vectors`] costs against the
+    /// same rows read through [`VectorColumn`], which borrows instead of copying.
+    ///
+    /// `vectors` is what the delta checkpoint calls for every pending row, and it
+    /// returns an owned `Vec<f32>` per row (`INSERT_BATCH` exists to cap the
+    /// peak). `VectorColumn:` [`index::source::VectorSource`] hands out
+    /// `&[f32]` into the mapping. This run is the measurement that decides
+    /// whether the owned form is worth replacing - see the printed per-row cost.
+    #[test]
+    #[ignore = "measurement, run with --ignored --nocapture"]
+    fn experiment_borrowed_vectors_against_owned() {
+        let dim = 256;
+        let rows = 4000usize;
+        let dir = tempdir().unwrap();
+        let e = Engine::open(dir.path()).unwrap();
+        e.execute_blocking(&format!(
+            "CREATE TABLE bv (id INT, v EMBEDDING(FLOAT,{dim}));"
+        ))
+        .unwrap();
+        let vector = |i: usize| -> String {
+            let body: Vec<String> = (0..dim)
+                .map(|d| format!("{}", (i * 7 + d * 13) % 991))
+                .collect();
+            format!("[{}]", body.join(","))
+        };
+        let mut sql = String::from("INSERT INTO bv VALUES ");
+        for i in 0..rows {
+            sql.push_str(&format!("({i}, {})", vector(i)));
+            if i + 1 < rows {
+                sql.push(',');
+            }
+        }
+        sql.push(';');
+        e.execute_blocking(&sql).unwrap();
+        crate::scheduler::block_on(e.flush()).unwrap();
+
+        let wanted = 2048usize;
+        let ids: Vec<u64> = (0..wanted as u64).collect();
+
+        let mut cursor = e.block_cursor("bv").unwrap();
+        let started = std::time::Instant::now();
+        let owned = cursor.vectors(1, dim, 6, &ids).unwrap();
+        let owned_time = started.elapsed();
+
+        let started = std::time::Instant::now();
+        let column = e
+            .vector_column("bv", 1, None, crate::blocks::vector_column::Rows::Chunk)
+            .expect("the column reads in place");
+        let open = started.elapsed();
+        let started = std::time::Instant::now();
+        let mut borrowed = 0usize;
+        for id in &ids {
+            let v = column.at(*id).expect("the row is there");
+            borrowed += v.len();
+        }
+        let borrow = started.elapsed();
+
+        assert_eq!(owned.len(), wanted);
+        assert_eq!(borrowed, wanted * dim);
+        eprintln!(
+            "vectors(): {} rows of {dim}d -> {:?} ({} KB copied, {} allocations); \
+             VectorColumn::at(): open {:?} + walk {:?} (0 bytes copied)",
+            owned.len(),
+            owned_time,
+            owned.len() * owned[0].1.len() * 4 / 1024,
+            owned.len(),
+            open,
+            borrow
+        );
+    }
+
     /// A sealed block is mapped **once** and the mapping is shared: a second
     /// reader gets the same `Arc`, no file is reopened, and no column body is
     /// copied into the heap (the scan decodes straight out of the pages).
@@ -593,6 +679,128 @@ mod tests {
         );

```

**File**: `rust_engine/crates/executor/src/blocks/mod.rs` (modified, +1/-1)
```diff
@@ -61,8 +61,8 @@ pub(crate) mod column;
 pub(crate) mod engine;
 pub(crate) mod index_chunk;
 pub(crate) mod misc;
-pub(crate) mod spann_source;
 pub(crate) mod value_shape;
+pub(crate) mod vector_column;
 
 pub use chunk::encode_fulltext_chunk;
 pub(crate) use chunk::*;
```

**File**: `rust_engine/crates/executor/src/blocks/spann_source.rs` (removed, +0/-255)
```diff
@@ -1,255 +0,0 @@
-//! A `VectorSource` over a table's blocks: the build reads the vectors where
-//! they already are.
-//!
-//! `EMBEDDING(FLOAT, dim)` is `ColumnLayout::Fixed(dim * 4)` of inline `f32` per
-//! row (`storage::definition::fixed_f32`), so row `slot` of a block's column
-//! body already is the array the builder wants. Borrowing it costs an add and a
-//! bounds check; the scratch file the first version wrote cost a **second copy
-//! of the column on disk** (12.3 GB at 2M x 1536d) plus the page cache that copy
-//! occupied, for data that is read and then dropped.
-//!
-//! The builder asks for one vector at a time and in no particular order
-//! (`index::spann::VectorSource`), which is why a mapping suits: the source
-//! keeps one mapping per block - mapped once at construction and never evicted,
-//! so the `&[f32]` it hands out cannot dangle - and one row id per row.
-
-use super::*;
-
-/// The vectors of one column, one block at a time, in row order.
-pub(crate) struct BlockVectorSource {
-    ids: Vec<u64>,
-    dim: usize,
-    blocks: Vec<SourceBlock>,
-}
-
-struct SourceBlock {
-    mapped: std::sync::Arc<MappedBlock>,
-    column_id: u64,
-    layout: storage::definition::format::ColumnLayout,
-    /// Index of this block's first row in [`BlockVectorSource::ids`].
-    first: usize,
-    /// Row id of slot 0, so a slot is `row id - base`.
-    base: u64,
-    /// Set when the cell cannot be borrowed (a body that is not `f32`-aligned):
-    /// the block's vectors, copied once.
-    materialized: Option<Vec<f32>>,
-}
-
-impl index::spann::VectorSource for BlockVectorSource {
-    fn len(&self) -> usize {
-        self.ids.len()
-    }
-
-    fn id(&self, index: usize) -> u64 {
-        self.ids[index]
-    }
-
-    fn vector(&self, index: usize) -> &[f32] {
-        let at = match self
-            .blocks
-            .binary_search_by(|block| block.first.cmp(&index))
-        {
-            Ok(at) => at,
-            // Before the first block's first row cannot happen: every row of
-            // `ids` belongs to a block that is in the list.
-            Err(0) => 0,
-            Err(at) => at - 1,
-        };
-        let block = &self.blocks[at];
-        let local = index - block.first;
-        if let Some(flat) = &block.materialized {
-            return &flat[local * self.dim..(local + 1) * self.dim];
-        }
-        let (body, _outline) = block
-            .mapped
-            .as_ref()
-            .column(block.column_id)
-            .expect("the column body was checked when the source was built");
-        let (data, _nulls) = storage::definition::format::split_body_refs(
-            body,
-            DEFAULT_BLOCK_CAPACITY,
-            block.layout,
-        );
-        let slot = (self.ids[index] - block.base) as usize;
-        storage::definition::fixed_f32::fixed_f32_slot(data, slot, self.dim)
-            .expect("alignment was checked when the source was built")
-    }
-}
-
-impl Engine {
-    /// A [`BlockVectorSource`] over `column`'s rows in `segments` (every visible
-    /// segment when `None`), or `None` when the column is not a `FLOAT`
-    /// embedding, or when rows are still in the append buffer - the two cases
-    /// the scratch path still serves.
-    ///
-    /// The segment set is the same one [`Self::for_each_block_cell`] takes:
-    /// compaction rebuilds from the merged segment only, because the source
-    /// segments are dropped at the compaction's ts and the bottom half is still
-    /// below it.
-    pub(crate) fn spann_vector_source(
-        &self,
-        table: &str,
-        column: usize,
-        segments: Option<&std::collections::HashSet<u32>>,
-    ) -> Option<BlockVectorSource> {
-        // Rows in the append buffer have no block yet, and a chunk has to cover
-        // them (`for_each_block_cell` reads them too): a build that skipped them
-        // would publish a chunk whose row count disagrees with the segment.
-        let table = self.qualified_table(table);
-        if self.buffered_row_count(&table) > 0 {
-            return None;
-        }
-        let meta = self
-            .storage
-            .catalog
-            .get_table_by_name(&table)
-            .ok()
-            .flatten()?;
-        let type_text = meta.types.get(column)?;
-        let (dim, element) = embedding_shape(type_text)?;
-        // `FLOAT` only: a `FLOAT16`/`DOUBLE`/`BIT` body is not an `f32` array,
-        // and widening it here would be a copy per access, which is the scratch
-        // path's job.
-        if element != 6 {
-            return None;
-        }
-        let layout = layout_of(type_text, column_type_of(type_text)?)?;
-        let column_id = *meta.ids.get(column)?;
-        let read_ts = crate::read_ts();
-        let root = self.blocks_root();
-        let mut ids: Vec<u64> = Vec::new();
-        let mut blocks: Vec<SourceBlock> = Vec::new();
-        // A row can be in a block *and* in the append buffer
```

**File**: `rust_engine/crates/executor/src/blocks/vector_column.rs` (added, +457/-0)
```diff
@@ -0,0 +1,457 @@
+//! A table's embedding column, read where it already is.
+//!
+//! `EMBEDDING(FLOAT, dim)` is `ColumnLayout::Fixed(dim * 4)` of inline `f32` per
+//! row (`storage::definition::fixed_f32`), so row `slot` of a block's column
+//! body already is the array a builder wants: borrowing it costs an add and a
+//! bounds check. The first version of this path wrote a **second copy of the
+//! column on disk** (12.3 GB at 2M x 1536d) plus the page cache that copy
+//! occupied, for data that is read once and then dropped.
+//!
+//! Nothing here belongs to one index type: a builder asks for "this column's
+//! vectors, in row order, by row id" and gets them. What a caller chooses is
+//! *which rows* ([`Rows`]); the elements it does not have to choose, because a
+//! body that is not an `f32` array (`FLOAT16`/`BFLOAT16`/`DOUBLE`/`BIT`, or a
+//! `f32` body that starts off-alignment) is widened one **row** at a time
+//! instead of borrowed, and handed back as an owned
+//! [`Cow`](std::borrow::Cow). That is the case the scratch file existed for, and
+//! it is bounded: one vector, not the column - nor one block per block, which is
+//! what keeping a materialized `Vec<f32>` per [`SourceBlock`] amounted to.
+
+use super::*;
+
+/// Which rows a [`VectorColumn`] answers for.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+pub(crate) enum Rows {
+    /// Visible rows of sealed blocks only. `None` when the table still has rows
+    /// in the append buffer: those have no block body, and a caller that must
+    /// cover every row has to ask for them.
+    ///
+    /// No production caller asks for this today - a rebuild needs [`Self::Chunk`]
+    /// - but it is the other half of the slot filter, and the tests pin it.
+    #[allow(dead_code)]
+    Sealed,
+    /// Every **slot** of the segment - tombstones and buffered rows included.
+    ///
+    /// This is what a rebuild must cover: the chunk it writes is compared with
+    /// the segment's row count, and that count is the column's slots, not the
+    /// live ones. A tree built from live rows alone is one member short for
+    /// every tombstone, which reads as a gap and rebuilds again next checkpoint.
+    Chunk,
+}
+
+/// The vectors of one column, one block at a time, in row order.
+pub(crate) struct VectorColumn {
+    ids: Vec<u64>,
+    dim: usize,
+    /// Rows of `ids` before this came from sealed blocks; the rest are the
+    /// append buffer's, in [`Self::buffered`].
+    sealed: usize,
+    /// One vector per row of `ids[sealed..]`. Only [`Rows::SealedAndBuffer`]
+    /// fills this, and the buffer is bounded by the pending-row budget.
+    buffered: Vec<Vec<f32>>,
+    blocks: Vec<SourceBlock>,
+}
+
+struct SourceBlock {
+    mapped: std::sync::Arc<MappedBlock>,
+    column_id: u64,
+    layout: storage::definition::format::ColumnLayout,
+    /// Index of this block's first row in [`VectorColumn::ids`].
+    first: usize,
+    /// Row id of slot 0, so a slot is `row id - base`.
+    base: u64,
+    /// The element type and the bytes of one slot, kept so a cell that cannot be
+    /// borrowed (not `f32`, or off-alignment) can be widened for the one call
+    /// that asked: no block-wide copy is retained.
+    element: i32,
+    row_bytes: usize,
+}
+
+impl index::source::VectorSource for VectorColumn {
+    fn len(&self) -> usize {
+        self.ids.len()
+    }
+
+    fn id(&self, index: usize) -> u64 {
+        self.ids[index]
+    }
+
+    fn vector(&self, index: usize) -> std::borrow::Cow<'_, [f32]> {
+        // The buffer's rows are the tail of `ids`: no block lookup, no body.
+        if index >= self.sealed {
+            return std::borrow::Cow::Borrowed(&self.buffered[index - self.sealed]);
+        }
+        let at = match self
+            .blocks
+            .binary_search_by(|block| block.first.cmp(&index))
+        {
+            Ok(at) => at,
+            // Before the first block's first row cannot happen: every sealed row
+            // of `ids` belongs to a block that is in the list.
+            Err(0) => 0,
+            Err(at) => at - 1,
+        };
+        let block = &self.blocks[at];
+        let (body, _outline) = block
+            .mapped
+            .as_ref()
+            .column(block.column_id)
+            .expect("the column body was checked when the source was built");
+        let (data, _nulls) = storage::definition::format::split_body_refs(
+            body,
+            DEFAULT_BLOCK_CAPACITY,
+            block.layout,
+        );
+        let slot = (self.ids[index] - block.base) as usize;
+        if block.element == 6 {
+            if let Some(v) = storage::definition::fixed_f32::fixed_f32_slot(data, slot, self.dim) {
+                return std::borrow::Cow::Borrowed(v);
+            }
+            // A body that starts off-alignment cannot be borrowed as an array of
+            // `f32`: copied for this row, not for the block.
+            return std::borrow::Cow::Owned(
+          
```

**File**: `rust_engine/crates/executor/src/buffer_obj_ut.rs` (modified, +12/-6)
```diff
@@ -134,12 +134,18 @@ fn test_big_with_gc_and_cleanup() {
     let (columns, rows) = e.read_blocks("table1").unwrap();
     assert_eq!(columns, vec!["col1".to_string()]);
     assert_eq!(rows.len(), INSERT_N * IMPORT_SIZE);
-    // Reading a block maps it instead of copying it into a budget: every
-    // block of the table is mapped once and shared, whatever the budget says.
-    assert_eq!(
-        e.buffer_objects().len(),
-        INSERT_N,
-        "one mapping per block of the table"
+    // Reading a block maps it instead of copying it, and the shared map is an
+    // LRU over those mappings: a block beyond the budget evicts the least
+    // recently used one, so a table larger than the budget does not leave one
+    // mapping per block in the process (what the reference's GC does here).
+    assert!(
+        e.buffer_used_bytes() <= memory_limit,
+        "{} bytes mapped against a {memory_limit}-byte budget",
+        e.buffer_used_bytes()
+    );
+    assert!(
+        e.buffer_objects().len() < INSERT_N,
+        "a table larger than the budget does not keep every mapping"
     );
     for idx in 0..INSERT_N {
         for row_id in 0..IMPORT_SIZE {
```

**File**: `rust_engine/crates/executor/src/engine/admin.rs` (modified, +7/-10)
```diff
@@ -1222,19 +1222,16 @@ impl Engine {
         Ok(())
     }
 
-    /// Drops the shared mappings of the spilled index files, so RSS tracks live
+    /// Drops the clean pages of every index mapping, so RSS tracks live
     /// structures rather than the page cache (C++ `BufferManager::Flush` drops
     /// the clean pages it wrote back).
+    ///
+    /// Through the mapping registry rather than the directory: the walk it
+    /// replaced opened every file under `fulltext`/`multivector`/`sparse`/
+    /// `secondary`/`secondary_low` on every checkpoint, and `fadvise` on an
+    /// already-mapped file does not drop the pages the mapping holds.
     pub(crate) fn drop_index_caches(&self) {
-        for sub in [
-            "fulltext",
-            "multivector",
-            "sparse",
-            "secondary",
-            "secondary_low",
-        ] {
-            storage::drop_tree_cache(&self.dir.join(sub));
-        }
+        storage::mapped::release_mapped_pages(usize::MAX);
     }
 
     /// The checkpoint itself, without the mode gate: [`Self::cleanup`] runs it
```

---

### Incident Patch 2: `0a776c19` (2026-11-19)
**Commit Message**: incremental spann and full text fix (#3574)

**File**: `rust_engine/crates/cli/src/main.rs` (modified, +6/-0)
```diff
@@ -231,6 +231,12 @@ fn serve_from_config(path: Option<&str>, maintenance: bool) -> common::Result<()
         let bytes = parse_size_bytes(&size) as usize;
         if bytes > 0 {
             engine.set_buffer_budget(bytes);
+            // The same number is the process's RSS ceiling: the budget above
+            // bounds what the engine *knows* it holds, and this is what the
+            // cleanup pass compares `/proc/self/status` against, so a container
+            // that sized `buffer_manager_size` to its own limit reclaims pages
+            // instead of being killed.
+            engine.set_memory_limit(bytes as u64);
         }
     }
     // The reference checkpoints periodically (`[wal] checkpoint_interval`), which
```

**File**: `rust_engine/crates/executor/src/blocks/engine.rs` (modified, +666/-97)
```diff
@@ -1421,10 +1421,11 @@ impl Engine {
                 _ => Some((live.ids.clone(), live.defaults.clone())),
             }
         };
-        // spann's mem index: the row goes here, **not** into the tree
-        // (`docs/SPANN_DESIGN.md` §9.2). One vector copy per row, and the next
-        // dump builds the tree that covers these rows and clears the list.
-        let spann_columns: Vec<(u64, usize)> = self
+        // spann's tail: the row goes **into the tree** (`docs/SPANN_DESIGN.md`
+        // §0.0.3) - one descent plus a code, 208 B at 1536d, and the query
+        // descends the same tree. The dump publishes a chunk over the segment and
+        // empties the tail; it does not have to build the tree from scratch.
+        let spann_columns: Vec<(u64, usize, usize, index::spann::Options)> = self
             .storage
             .catalog
             .indexes_of_table(&table)
@@ -1437,23 +1438,30 @@ impl Engine {
                     .ok()?
                     .iter()
                     .position(|c| c == &im.column)?;
-                Some((im.id, position))
+                let dims = self.spann_dims_of(&table, &im.column);
+                let opts = crate::spann_mem::options_from(&im.options).ok()?;
+                Some((im.id, position, dims, opts))
             })
             .collect();
         {
             let mut tables = self.tables.lock().unwrap();
             let entry = tables.entry(tkey.clone()).or_default();
             // Before `buffer_rows`, which consumes `rows`.
-            for (index_id, column) in &spann_columns {
-                let mem = entry.spann_mem.entry(*index_id).or_default();
-                mem.reserve(rows.len());
+            for (index_id, column, dims, opts) in &spann_columns {
+                if *dims == 0 {
+                    continue;
+                }
+                let tail = entry.spann_mem.entry(*index_id).or_insert_with(|| {
+                    crate::spann_mem::SpannTail::new(*dims, opts.clone())
+                        .expect("a tail over a validated dimension")
+                });
                 for (seq, row) in &rows {
                     let Some(value) = row.get(*column) else {
                         continue;
                     };
                     let vector = crate::engine::state::parse_vec_f32(&mirror_cell_text(value));
                     if !vector.is_empty() {
-                        mem.push((*seq as u64, vector));
+                        let _ = tail.insert(*seq as u64, &vector);
                     }
                 }
             }
@@ -1739,17 +1747,80 @@ impl Engine {
     /// seals it: every record it writes carries that transaction's commit ts.
     /// The checkpoint passes `None` and mirrors the whole table with the ts the
     /// last dump recorded.
+    /// Share of a segment's rows that may be dead - published into a chunk,
+    /// then deleted from the column - before the checkpoint asks for a rebuild.
+    ///
+    /// A delta appends a page; it never rewrites a leaf to drop a row, so dead
+    /// rows accumulate until a rebuild. Without a bound they are scanned
+    /// forever: a table that deletes and re-inserts the same volume grows a
+    /// chain of tombstones nothing reclaims.
+    pub(crate) const SPANN_DEAD_REBUILD_PERCENT: u64 = 20;
+
+    /// Clean pages a delta checkpoint may keep for routing.
+    ///
+    /// The pages are one centroid plus child keys each (~6 KB at 1536d), so this
+    /// is roughly 10k partitions - far more than a checkpoint's working set,
+    /// and small enough that it does not scale with the segment.
+    pub(crate) const SPANN_PAGE_BUDGET: usize = 64 << 20;
+
+    /// Pages a delta checkpoint may hold **for writing**. A dirty page cannot be
+    /// evicted, so this is what bounds the delta; when it is spent the remaining
+    /// rows go back to the tail and the next checkpoint publishes them.
+    pub(crate) const SPANN_DIRTY_BUDGET: usize = 512 << 20;
+
+    /// [`Self::SPANN_PAGE_BUDGET`], as the running engine holds it.
+    pub(crate) fn spann_page_budget(&self) -> usize {
+        self.context
+            .spann_page_budget
+            .load(std::sync::atomic::Ordering::Relaxed)
+    }
+
+    /// [`Self::SPANN_DIRTY_BUDGET`], as the running engine holds it.
+    pub(crate) fn spann_dirty_budget(&self) -> usize {
+        self.context
+            .spann_dirty_budget
+            .load(std::sync::atomic::Ordering::Relaxed)
+    }
+
     pub(crate) fn publish_index_chunks(
         &self,
         table: &str,
         table_id: u64,
         only: Option<(&str, u64)>,
+    ) -> Result<()> {
+        self.publish_index_chunks_inner(table, table_id, only, false)
+    }
+
+    /// [`Self::publish_index_chunks`] that rebuilds each spann segment from the
+    /// column instead of appending a delta.
+    ///
+    /// The optimize pass calls this for the states a delta cannot fix: a chain
+    /// at the layer cap (each further delta is
```

**File**: `rust_engine/crates/executor/src/blocks/mod.rs` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ pub(crate) mod column;
 pub(crate) mod engine;
 pub(crate) mod index_chunk;
 pub(crate) mod misc;
+pub(crate) mod spann_source;
 pub(crate) mod value_shape;
 
 pub use chunk::encode_fulltext_chunk;
```

**File**: `rust_engine/crates/executor/src/blocks/spann_source.rs` (added, +255/-0)
```diff
@@ -0,0 +1,255 @@
+//! A `VectorSource` over a table's blocks: the build reads the vectors where
+//! they already are.
+//!
+//! `EMBEDDING(FLOAT, dim)` is `ColumnLayout::Fixed(dim * 4)` of inline `f32` per
+//! row (`storage::definition::fixed_f32`), so row `slot` of a block's column
+//! body already is the array the builder wants. Borrowing it costs an add and a
+//! bounds check; the scratch file the first version wrote cost a **second copy
+//! of the column on disk** (12.3 GB at 2M x 1536d) plus the page cache that copy
+//! occupied, for data that is read and then dropped.
+//!
+//! The builder asks for one vector at a time and in no particular order
+//! (`index::spann::VectorSource`), which is why a mapping suits: the source
+//! keeps one mapping per block - mapped once at construction and never evicted,
+//! so the `&[f32]` it hands out cannot dangle - and one row id per row.
+
+use super::*;
+
+/// The vectors of one column, one block at a time, in row order.
+pub(crate) struct BlockVectorSource {
+    ids: Vec<u64>,
+    dim: usize,
+    blocks: Vec<SourceBlock>,
+}
+
+struct SourceBlock {
+    mapped: std::sync::Arc<MappedBlock>,
+    column_id: u64,
+    layout: storage::definition::format::ColumnLayout,
+    /// Index of this block's first row in [`BlockVectorSource::ids`].
+    first: usize,
+    /// Row id of slot 0, so a slot is `row id - base`.
+    base: u64,
+    /// Set when the cell cannot be borrowed (a body that is not `f32`-aligned):
+    /// the block's vectors, copied once.
+    materialized: Option<Vec<f32>>,
+}
+
+impl index::spann::VectorSource for BlockVectorSource {
+    fn len(&self) -> usize {
+        self.ids.len()
+    }
+
+    fn id(&self, index: usize) -> u64 {
+        self.ids[index]
+    }
+
+    fn vector(&self, index: usize) -> &[f32] {
+        let at = match self
+            .blocks
+            .binary_search_by(|block| block.first.cmp(&index))
+        {
+            Ok(at) => at,
+            // Before the first block's first row cannot happen: every row of
+            // `ids` belongs to a block that is in the list.
+            Err(0) => 0,
+            Err(at) => at - 1,
+        };
+        let block = &self.blocks[at];
+        let local = index - block.first;
+        if let Some(flat) = &block.materialized {
+            return &flat[local * self.dim..(local + 1) * self.dim];
+        }
+        let (body, _outline) = block
+            .mapped
+            .as_ref()
+            .column(block.column_id)
+            .expect("the column body was checked when the source was built");
+        let (data, _nulls) = storage::definition::format::split_body_refs(
+            body,
+            DEFAULT_BLOCK_CAPACITY,
+            block.layout,
+        );
+        let slot = (self.ids[index] - block.base) as usize;
+        storage::definition::fixed_f32::fixed_f32_slot(data, slot, self.dim)
+            .expect("alignment was checked when the source was built")
+    }
+}
+
+impl Engine {
+    /// A [`BlockVectorSource`] over `column`'s rows in `segments` (every visible
+    /// segment when `None`), or `None` when the column is not a `FLOAT`
+    /// embedding, or when rows are still in the append buffer - the two cases
+    /// the scratch path still serves.
+    ///
+    /// The segment set is the same one [`Self::for_each_block_cell`] takes:
+    /// compaction rebuilds from the merged segment only, because the source
+    /// segments are dropped at the compaction's ts and the bottom half is still
+    /// below it.
+    pub(crate) fn spann_vector_source(
+        &self,
+        table: &str,
+        column: usize,
+        segments: Option<&std::collections::HashSet<u32>>,
+    ) -> Option<BlockVectorSource> {
+        // Rows in the append buffer have no block yet, and a chunk has to cover
+        // them (`for_each_block_cell` reads them too): a build that skipped them
+        // would publish a chunk whose row count disagrees with the segment.
+        let table = self.qualified_table(table);
+        if self.buffered_row_count(&table) > 0 {
+            return None;
+        }
+        let meta = self
+            .storage
+            .catalog
+            .get_table_by_name(&table)
+            .ok()
+            .flatten()?;
+        let type_text = meta.types.get(column)?;
+        let (dim, element) = embedding_shape(type_text)?;
+        // `FLOAT` only: a `FLOAT16`/`DOUBLE`/`BIT` body is not an `f32` array,
+        // and widening it here would be a copy per access, which is the scratch
+        // path's job.
+        if element != 6 {
+            return None;
+        }
+        let layout = layout_of(type_text, column_type_of(type_text)?)?;
+        let column_id = *meta.ids.get(column)?;
+        let read_ts = crate::read_ts();
+        let root = self.blocks_root();
+        let mut ids: Vec<u64> = Vec::new();
+        let mut blocks: Vec<SourceBlock> = Vec::new();
+        // A row can be in a block *and* in the append buffer
```

**File**: `rust_engine/crates/executor/src/engine/admin.rs` (modified, +240/-50)
```diff
@@ -89,68 +89,120 @@ impl Engine {
     /// The body [`Self::optimize_fulltext_async`] runs: the gate is held.
     async fn optimize_fulltext_locked(&self, table: &str) -> Result<usize> {
         let key = self.table_key(table);
+        // **The catalog is the input**, exactly as in the reference: a merge
+        // reads `SegmentIndexMeta`'s chunk ids (`OptimizeFtIndex`,
+        // `new_txn_index_impl.cpp:2193-2245`) and never a memory index. Walking
+        // only the cached indexes left every index of a process that had not
+        // answered a query on the column yet unmerged - a reopened engine kept
+        // its chunk list fragmented for good, because nothing but a `MATCH` or a
+        // `filter_fulltext` ever loads the cache.
+        let catalog_indexes: Vec<(u64, String)> = self
+            .storage
+            .catalog
+            .indexes_of_table(&self.qualified_table(table))
+            .unwrap_or_default()
+            .into_iter()
+            .filter(|im| im.index_type.eq_ignore_ascii_case("FULLTEXT"))
+            .map(|im| (im.id, im.column))
+            .collect();
+        if catalog_indexes.is_empty() {
+            return Ok(0);
+        }
         // Clone the handles while the `tables` guard is held, then drop it before
         // taking any index write lock. `text_index_for` takes `tables` first and
         // the index second, so waiting for an index lock with `tables` held is the
         // reverse order and can deadlock a concurrent seal or query.
-        let indexes: Vec<(u64, String, SharedTextIndex)> = {
+        let cached: Vec<(u64, SharedTextIndex)> = {
             let tables = self.tables.lock().unwrap();
-            let Some(entry) = tables.get(&key) else {
-                return Ok(0);
-            };
-            let by_id: std::collections::HashMap<u64, String> = self
-                .storage
-                .catalog
-                .indexes_of_table(&self.qualified_table(table))
+            tables
+                .get(&key)
+                .map(|entry| entry.text.iter().map(|(id, v)| (*id, v.clone())).collect())
                 .unwrap_or_default()
-                .into_iter()
-                .map(|im| (im.id, im.column))
-                .collect();
-            entry
-                .text
-                .iter()
-                .filter_map(|(id, v)| Some((*id, by_id.get(id)?.clone(), v.clone())))
-                .collect()
         };
-        if indexes.is_empty() {
-            return Ok(0);
-        }
         // A merge is the only point at which the postings of a deleted row can
         // be reclaimed (a chunk is immutable once published), so it takes the
         // table's deleted rows with it.
         let deleted = self.tombstone_set(table)?;
         if crate::engine::text_index::ft_trace_enabled(&self.table_key(table)) {
             eprintln!(
-                "[FT] optimize_fulltext_locked {table} indexes={}",
-                indexes.len()
+                "[FT] optimize_fulltext_locked {table} indexes={} cached={}",
+                catalog_indexes.len(),
+                cached.len()
             );
         }
         let mut merges = 0;
-        let mut merged: Vec<(u64, String)> = Vec::new();
-        for (index_id, column, index) in indexes {
-            // The merge rewrites whole chunks and fsyncs every file it writes:
-            // it is a blocking leaf, so it runs on the blocking pool. Running it
-            // here would hold a runtime worker for the duration of the rewrite,
-            // stalling every other task scheduled on it.
-            let done = crate::scheduler::scheduler()
-                .spawn_blocking({
-                    let deleted = deleted.clone();
-                    move || crate::engine::state::optimize_text_index_unlocked(&index, &deleted)
-                })
-                .await?;
-            if done > 0 {
-                merged.push((index_id, column));
-            }
-            merges += done;
-        }
-        // The merge replaced chunks: the catalog's chunk list is what a reader
-        // maps, so it has to name the merged chunk and stop naming the sources
-        // the merge deleted (`OptimizeFtIndex` -> `RemoveChunkIDs`).
-        for (index_id, column) in merged {
-            if crate::engine::text_index::ft_trace_enabled(&self.table_key(table)) {
-                eprintln!("[FT] {table}.{column} optimize merged {merges}, republishing records");
+        for (index_id, column) in catalog_indexes {
+            let shared = cached
+                .iter()
+                .find(|(id, _)| *id == index_id)
+                .map(|(_, shared)| shared.clone());
+            match shared {
+                Some(index) => {
+                    // The merge rewrites whole chunks and fsyncs every file it
+                    // writes: it is a blocking leaf, so it runs on the blocking
+                    // pool. Running it here would hold a runtime worker
```

**File**: `rust_engine/crates/executor/src/engine/dml.rs` (modified, +106/-9)
```diff
@@ -426,12 +426,13 @@ impl Engine {
         // insert, so both halves go through this hook.
         if !entry.spann_mem.is_empty() {
             let gone: std::collections::HashSet<u64> = ids.iter().map(|s| *s as u64).collect();
-            for rows in entry.spann_mem.values_mut() {
-                rows.retain(|(seq, _)| !gone.contains(seq));
+            for tail in entry.spann_mem.values() {
+                tail.forget(&gone);
             }
         }
         entry.mirror_dirty = true;
         entry.mirror_epoch += 1;
+        drop(tables);
         first
     }
 
@@ -1891,6 +1892,30 @@ impl Engine {
             .collect()
     }
 
+    /// The table's full-text columns, from the catalog.
+    ///
+    /// [`Self::index_column_map`] carries every index kind, so it cannot say
+    /// which columns a *text* index belongs to - a column with only a secondary
+    /// index has no text postings to write. A column that carries two full-text
+    /// indexes (a sparse-gram one and a regular one) is listed once.
+    fn fulltext_columns(&self, table: &str) -> Vec<String> {
+        let mut columns: Vec<String> = Vec::new();
+        for meta in self
+            .storage
+            .catalog
+            .indexes_of_table(&self.qualified_table(table))
+            .unwrap_or_default()
+        {
+            if meta.id > 0
+                && meta.index_type.eq_ignore_ascii_case("FULLTEXT")
+                && !columns.contains(&meta.column)
+            {
+                columns.push(meta.column);
+            }
+        }
+        columns
+    }
+
     /// Undoes the index hooks for rows a write staged but never committed.
     ///
     /// An `IMPORT` feeds every hook batch by batch (`insert_secondary_keys`,
@@ -2178,7 +2203,7 @@ impl Engine {
         }
         let tkey = self.table_key(table);
         let by_id = self.index_column_map(table);
-        let indexes: Vec<(String, SharedTextIndex)> = self
+        let mut indexes: Vec<(String, SharedTextIndex)> = self
             .tables
             .lock()
             .unwrap()
@@ -2190,6 +2215,30 @@ impl Engine {
                     .collect()
             })
             .unwrap_or_default();
+        // A writer must not depend on a reader having built the index. The
+        // reference's write path only needs the column's mem indexer, which it
+        // creates itself; here the documents go into the **cached** index, so a
+        // column whose index is not cached yet - a build still in flight, a cache
+        // a compaction dropped, a table entry that has not loaded it - was
+        // skipped in silence and its postings existed nowhere. A rebuild recovers
+        // them only from the blocks, and a `COPY` writes those when its statement
+        // commits, so the rows of the import that hit the window are exactly the
+        // ones a following build cannot see. Build the index here instead: the
+        // read is the one the first query would have done, at most once per
+        // column, and only while the cache has no entry for it.
+        if indexes.len() < by_id.len() {
+            for column in self.fulltext_columns(table) {
+                if schema.iter().all(|c| c != &column)
+                    || indexes.iter().any(|(cached, _)| cached == &column)
+                {
+                    continue;
+                }
+                let tokenizer = self.index_tokenizer(table, &column);
+                if let Ok(shared) = self.text_index_for(table, &column, tokenizer) {
+                    indexes.push((column, shared));
+                }
+            }
+        }
         for (column, shared) in indexes {
             let Some(ci) = schema.iter().position(|c| c == &column) else {
                 continue;
@@ -2348,7 +2397,7 @@ impl Engine {
         table: &str,
         mut t: Txn,
         segments: &[u32],
-        encoded_rows: &[(usize, String)],
+        staged_rows: &crate::engine::import::StagedRows,
         batches: &[usize],
     ) -> Result<u64> {
         let mut cmds = Vec::new();
@@ -2384,7 +2433,6 @@ impl Engine {
         // blocks that never got written and that slice's rows were gone.
         let segments_owned: Vec<u32> = segments.to_vec();
         let batches_owned: Vec<usize> = batches.to_vec();
-        let encoded_owned: Vec<(usize, String)> = encoded_rows.to_vec();
         let table_owned = table.to_string();
         // The append records are created here (the WAL frame names them) but
         // **stamped after the rows are published**. The reference keeps a
@@ -2431,10 +2479,14 @@ impl Engine {
             let gate = self.bottom_gate(table);
             let _turn = gate.lock().await;
             let _held = crate::engine::statements::HeldBottom::enter(&self.table_key(table));
-            self.publish_encoded_rows(table, &encoded_owned)?;
-            // The buffer holds the values now; the stored text of the whole
-            // file (hundreds of MB) has no reader left
```

**File**: `rust_engine/crates/executor/src/engine/import.rs` (modified, +171/-4)
```diff
@@ -4,6 +4,168 @@
 
 use super::*;
 
+/// Stored text an import keeps in memory before it spills to disk.
+///
+/// The import commits once, so its rows cannot reach the block writer early;
+/// holding every row's stored text until then made the peak the *statement*
+/// (11 KiB per row at 1536d - 5.8 GiB for one 500k-row segment, measured on
+/// `spann_scale_1536d`). Past this much text the rows go to a scratch file and
+/// are replayed a batch at a time, so the import's memory is a batch whatever
+/// the file's size.
+const IMPORT_SPILL_BYTES: usize = 64 * 1024 * 1024;
+
+/// The rows one `COPY` stages for the block writer, spilled past
+/// [`IMPORT_SPILL_BYTES`].
+pub(crate) struct StagedRows {
+    /// Rows kept in memory (the whole set while it stays under the threshold).
+    memory: Vec<(usize, String)>,
+    /// The scratch file once the threshold is crossed: path and writer.
+    spill: Option<(std::path::PathBuf, std::io::BufWriter<std::fs::File>)>,
+    /// Rows staged so far, in both modes.
+    count: usize,
+    /// Bytes of stored text held so far, in both modes.
+    bytes: usize,
+}
+
+impl StagedRows {
+    fn new() -> Self {
+        Self {
+            memory: Vec::new(),
+            spill: None,
+            count: 0,
+            bytes: 0,
+        }
+    }
+
+    pub(crate) fn is_empty(&self) -> bool {
+        self.count == 0
+    }
+
+    /// Stages one row's stored text, moving the set to disk when it grows past
+    /// the threshold. `dir` is where the scratch file lives.
+    fn push(&mut self, seq: usize, text: String, dir: &std::path::Path) -> Result<()> {
+        self.count += 1;
+        self.bytes += text.len();
+        if self.spill.is_none() {
+            if self.bytes <= IMPORT_SPILL_BYTES {
+                self.memory.push((seq, text));
+                return Ok(());
+            }
+            std::fs::create_dir_all(dir).map_err(|e| Error::io(dir, e))?;
+            let path = dir.join(format!(
+                "import-spill-{}-{}.rows",
+                std::process::id(),
+                self.count
+            ));
+            let file = std::fs::File::create(&path).map_err(|e| Error::io(&path, e))?;
+            let mut writer = std::io::BufWriter::with_capacity(1 << 20, file);
+            for (seq, text) in self.memory.drain(..) {
+                Self::write_row(&mut writer, &path, seq, &text)?;
+            }
+            self.spill = Some((path, writer));
+            // The row that crossed the threshold goes to the file too, below:
+            // returning here dropped exactly one row per segment, and the block
+            // writer caught it ("block 0.0 holds 8191 of the 8192 rows
+            // committed at ts 10").
+        }
+        let (path, writer) = self.spill.as_mut().unwrap();
+        let path = path.clone();
+        Self::write_row(writer, &path, seq, &text)
+    }
+
+    fn write_row(
+        writer: &mut impl std::io::Write,
+        path: &std::path::Path,
+        seq: usize,
+        text: &str,
+    ) -> Result<()> {
+        let len = u32::try_from(text.len())
+            .map_err(|_| Error::Invalid("import: a row's stored text exceeds 4 GiB".into()))?;
+        writer
+            .write_all(&(seq as u64).to_le_bytes())
+            .and_then(|()| writer.write_all(&len.to_le_bytes()))
+            .and_then(|()| writer.write_all(text.as_bytes()))
+            .map_err(|e| Error::io(path, e))
+    }
+
+    /// Pushes what the writer still holds to the file, so [`Self::replay`] can
+    /// read it back.
+    fn flush(&mut self) -> Result<()> {
+        use std::io::Write;
+        if let Some((path, writer)) = self.spill.as_mut() {
+            let path = path.clone();
+            writer.flush().map_err(|e| Error::io(&path, e))?;
+        }
+        Ok(())
+    }
+
+    /// Hands every staged row to `row`, in staging order, calling `batch_done`
+    /// at each boundary in `batches` (one entry per import batch).
+    ///
+    /// One pass for the whole set: the caller publishes a batch, writes the
+    /// block it landed in, and drops it, so the append buffer never holds more
+    /// than one batch either.
+    pub(crate) fn replay_batches(
+        &self,
+        batches: &[usize],
+        mut row: impl FnMut(usize, &str) -> Result<()>,
+        mut batch_done: impl FnMut(usize) -> Result<()>,
+    ) -> Result<()> {
+        let mut batch = 0usize;
+        let mut left = batches.first().copied().unwrap_or(0);
+        let mut end_batch = |batch: &mut usize, left: &mut usize| -> Result<()> {
+            batch_done(*batch)?;
+            *batch += 1;
+            *left = batches.get(*batch).copied().unwrap_or(0);
+            Ok(())
+        };
+        let Some((path, _)) = self.spill.as_ref() else {
+            for (seq, text) in &self.memory {
+                row(*seq, text.as_str())?;
+                left = left.saturating_sub(1);
+                if left == 0 {
+                    end_batch(&mut batch, &m
```

**File**: `rust_engine/crates/executor/src/engine/index_build.rs` (modified, +159/-62)
```diff
@@ -689,12 +689,13 @@ impl Engine {
         Ok(())
     }
 
-    /// Loads the newest spann chunk of `index` (`docs/SPANN_DESIGN.md` §6).
+    /// Loads the newest spann chunk of every live segment of `index`.
     ///
-    /// A rebuild-mode chunk is a whole-table snapshot, so the highest
-    /// `chunk_*.idx` id under `idx_{id}/seg_*/` **is** the index and the older
-    /// ones are superseded. The catalog's chunk list is not consulted: it is
-    /// keyed per segment, and the snapshot covers every segment anyway.
+    /// A chunk is **one segment's tree** and a checkpoint publishes a new one
+    /// per segment, so the highest `chunk_*.idx` id the catalog lists for a
+    /// segment is that segment's index and the older ids are superseded. This
+    /// is the same rule the HNSW loader applies, and the same one
+    /// `publish_index_chunks` maintains; nothing here reads a directory.
     pub(crate) fn load_spann_index(
         &self,
         table: &str,
@@ -703,41 +704,55 @@ impl Engine {
     ) -> Option<std::sync::Arc<crate::spann_mem::SpannHandle>> {
         let table = self.qualified_table(table);
         let opts = crate::spann_mem::options_from(options).ok()?;
-        let dir = self.hnsw_dir(&table, index)?;
-        // One chunk per segment (§6), so the index is the newest live chunk of
-        // **each** segment, not the newest chunk overall. The live chunk list,
-        // not a directory walk: a chunk an `optimize` superseded leaves the list
-        // the moment it is deprecated, while its bytes stay on disk until
-        // `Cleanup` (`live_chunk_files`, `GetChunkIDs1`).
-        let mut segments = self.segment_row_counts(&table);
-        if segments.is_empty() {
-            segments.push((0, 0));
+        let meta = self
+            .storage
+            .catalog
+            .indexes_of_table(&table)
+            .ok()?
+            .into_iter()
+            .find(|im| im.name == index && im.index_type.eq_ignore_ascii_case("SPANN"))?;
+        if self.spann_dims_of(&table, &meta.column) == 0 {
+            return None;
         }
-        segments.sort_by_key(|(segment, _)| *segment);
-        let mut chunks = Vec::new();
-        for (segment, rows) in segments {
-            if rows == 0 {
-                continue;
-            }
-            let mut best: Option<(u64, std::path::PathBuf)> = None;
-            for (id, path) in self.live_chunk_files(&table, index, segment, &dir) {
-                if best.as_ref().map(|(b, _)| id > *b).unwrap_or(true) {
-                    best = Some((id, path));
+        // Every live chunk of every segment, newest first **per segment**: a
+        // checkpoint appends the pages it rewrote (a delta chunk) and leaves the
+        // chunk it rewrote them from in place, so one segment's chunks are a
+        // chain whose newest layer wins per key (§5.4). `ChunkChain` does that
+        // resolution; assembling one chain per segment and merging the chains is
+        // the same shape the old "one whole tree per chunk" loader had.
+        let mut per_segment: std::collections::BTreeMap<
+            u32,
+            Vec<(u64, std::sync::Arc<storage::knn_index::spann::FileIndex>)>,
+        > = Default::default();
+        for (segment, chunk_id, path) in self.catalog_index_files(&table, meta.id) {
+            match storage::knn_index::spann::FileIndex::open(&path, &opts) {
+                Ok(chunk) => {
+                    per_segment
+                        .entry(segment)
+                        .or_default()
+                        .push((chunk_id, std::sync::Arc::new(chunk)));
                 }
-            }
-            let Some((_, path)) = best else { continue };
-            // Mapped, not decoded: the slot bytes stay in page cache, which is
-            // what makes §19.3's 50M-in-8GB arithmetic work. The CRC of every
-            // section is still verified — once, here.
-            if let Ok(chunk) = storage::knn_index::spann::FileIndex::open(&path, &opts) {
-                chunks.push(std::sync::Arc::new(chunk));
+                // A chunk whose header disagrees with the catalog is derived
+                // data: skip it, and the next checkpoint republishes the
+                // segment. A query on the gap falls back to the exact scan.
+                Err(_) => continue,
             }
         }
-        if chunks.is_empty() {
+        let mut chains = Vec::new();
+        for (_, mut layers) in per_segment {
+            // Newest chunk id first: a delta shadows the pages it rewrote.
+            layers.sort_by_key(|a| std::cmp::Reverse(a.0));
+            let layers: Vec<std::sync::Arc<storage::knn_index::spann::FileIndex>> =
+                layers.into_iter().map(|(_, chunk)| chunk).collect();
+            chains.push(std::sync::Arc::new(
+                storage::knn_index::spann::ChunkChain::from_layers(layers, &opts),
+            ));
+        }
+        if chains.is_empty() {
            
```

#### Recent Merged Pull Requests:
- **PR #3577** (2026-11-19): add license header (@yingfeng)
- **PR #3576** (2026-11-19): rust_engine: bound process memory; read vectors in place (@yingfeng)
- **PR #3574** (2026-11-19): incremental spann and full text fix (@yingfeng)
- **PR #3572** (2026-11-18): checkpoint: encode a block with the schema at its bound; key the append buffer by column id (@yuzhichang)
- **PR #3571** (2026-11-17): rust_engine: spann index, filter push-down, unified maintenance accounting (@yingfeng)
- **PR #3570** (2026-11-16): executor: record each full-text chunk name once, and name the row a MATCH lost (@yingfeng)

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

## X. rust_engine: bound process memory; read vectors in place

**RULE**:
When implementing operations in `rust_engine/crates/executor/examples/mem_bench.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d95c80d2`: rust_engine: bound process memory; read vectors in place. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust_engine/crates/executor/examples/mem_bench.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
//! Throwaway driver: what bounding the block-map cache costs *index* work.
//!
//!   mem_bench <dir> <rows> <dim> <budget_mb> <iters> build
//!   mem_bench <dir> <rows> <dim> <budget_mb> <iters> measure
//!   mem_bench <dir> <rows> <dim> <budget_mb> <iters> concurrent <threads>
//!
//! `build` creates the tables, loads them through `COPY`, flushes the blocks and
//! creates the HNSW, SPANN and FULLTEXT indexes (timing each), so every later
//! run only measures queries. Every run opens the engine with
//! `buffer_manager_size = budget_mb`, so the only thing that differs between
//! runs is the budget.

use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use executor::Engine;

fn rss_kb() -> u64 {
    if let Ok(text) = std::fs::read_to_string("/proc/self/status") {
        for line in text.lines() {
            if let Some(rest) = line.strip_prefix("VmRSS:") {
                if let Some(kb) = rest.split_whitespace().next() {
                    return kb.parse().unwrap_or(0);
                }
            }
        }
    }
    let out = std::process::Command::new("ps")
        .args(["-o", "
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d95c80d2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
