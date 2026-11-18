# Verification Protocol: Verification Protocol: Empirical Defect Shield for infiniflow/infinity

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow/infinity",
  "source_url": "https://github.com/infiniflow/infinity",
  "source_version": "583c8505",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T14:15:59.184Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-infiniflow-infinity",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow/infinity](https://github.com/infiniflow/infinity) (Revision: `583c8505`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T14:15:59.184Z`  
> **Learning ID**: `learn-github-infiniflow-infinity`


## 1. Scope & Verification Target
- **Target Repository**: `infiniflow/infinity` (Commit: `583c8505`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): infiniflow/infinity

> **Canonical Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T14:15:58.045Z  
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

### Incident Patch 1: `583c8505` (2026-11-18)
**Commit Message**: checkpoint: encode a block with the schema at its bound; key the append buffer by column id (#3572)

## What

Five commits that make a checkpoint's block write agree with the buffer
it reads, and that key the append buffer by column id instead of by row
position.

### 1. `checkpoint: encode a block with the schema at its bound, not the
live one`

A checkpoint took the buffer's rows and `meta.at_ids(schema_ids_at(T))`
in one pass. `TableMeta::at_ids` **silently skips** an id the live table
no longer has, so a column dropped after the bound was left out of the
encoding and every cell after it landed in its neighbour's file. `2.col`
got the dropped `c2`'s value and the first row came back as
`[["1","2","test"]]` instead of `[["1","test","tttt"]]`.

`layout::schema_at` resolves the whole column set at a timestamp - id,
order, type, default, sparse hint - by rebuilding the `TableMeta` from
the `tbl|col|` record that was live then. The file sweep (`keep`) is
driven by that same schema: it **deletes every file it does not name and
runs before the write**, so a `keep` built from the live table would
delete the pre-DROP column file this pass just produced.

`checkpoint_ts` becomes `bound_ts

**File**: `.github/workflows/rust_engine.yml` (modified, +75/-9)
```diff
@@ -727,6 +727,24 @@ jobs:
           ./scripts/wait_for_infinity.sh
       - name: Python SDK suite
         run: .venv/bin/python -m pytest -q python/test_pysdk -m "not complex and not slow" --tb=short
+      - name: Python SDK slow cases
+        # The reference's `reldeb_parallel_test` runs the same files with
+        # `-m "not complex"`, i.e. including `@pytest.mark.slow`: the cases that
+        # build 10k tables, 10k databases and long-abandoned rows. They are the
+        # ones a nightly needs and a PR does not, so they only run when the
+        # workflow is dispatched or scheduled.
+        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
+        continue-on-error: true
+        run: .venv/bin/python -m pytest -q python/test_pysdk -m "slow and not complex" --tb=short
+      - name: Parallel suite (Python)
+        # `python/parallel_test`: the reference's `debug_tsan_parallel_test`
+        # target. Its Go counterpart above drives the same engine from
+        # goroutines; this one keeps the Python form because the client-side
+        # behaviour it asserts (session handling under writers) only exists in
+        # the SDK.
+        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
+        continue-on-error: true
+        run: .venv/bin/python -m pytest -q python/parallel_test -m "not complex and not slow" --tb=short
       - name: Stop the engine and show its log
         if: always()
         run: |
@@ -935,20 +953,68 @@ jobs:
           # sanitizer build (rustc rejects sanitizers for proc macros).
           RUSTFLAGS="-Zsanitizer=address" cargo test --target x86_64-unknown-linux-gnu \
             -p storage --lib
-      - name: Ignored tests (perf probes, long replay loops)
+      - name: Ignored tests (every ignored case, reported)
         # These mirror the reference's DISABLED_/SLOW_ gtests, which
-        # slow_tests.yml runs nightly, plus the cases the unit lane drops for
-        # its wall time: the ColBERT-SaR training ports and the `rabitq::tests::diag_*`
-        # diagnostics. They are reported rather than gated for
-        # now: at least `new_catalog_index_internal_ut::disabled_slow_test_populate_index`
-        # fails on the port (fulltext_tail is None where the case expects
-        # (0, 16384)), and that predates the current work. Flip this to a gate
-        # once the set is triaged.
+        # slow_tests.yml runs nightly, plus the cases the unit lane drops for its
+        # wall time: the ColBERT-SaR training ports and the `rabitq::tests::diag_*`
+        # diagnostics. Each `#[ignore]` carries a category prefix, and the test's
+        # own body names the reference case it mirrors:
+        #
+        #   slow:         reference `DISABLED_SLOW_*`; a gate (next step)
+        #   bench:        timing/throughput probe, host dependent
+        #   diagnostic:   prints metrics, asserts nothing
+        #   external:     needs MinIO (`INFINITY_MINIO_*`)
+        #   golden:       needs the reference binary's output
+        #   known-defect: a located behaviour difference, see GAPS.md
+        #
+        # This step runs the lot and only reports: a `bench:` number on a shared
+        # runner pans out differently every night, so it cannot gate.
         continue-on-error: true
         working-directory: rust_engine
         env:
           UV_PYTHON: "3.13"
-        run: cargo test --workspace -- --ignored
+        run: cargo test --workspace --no-fail-fast -- --ignored
+      - name: Slow reference cases (the gated half of --ignored)
+        # The `slow:` set alone, and this one gates. Everything else is skipped
+        # by name - `--skip` matches the test name, not the `#[ignore]` reason,
+        # so the categories above are spelled out here. Every `#[ignore]` carries
+        # one of those categories (`slow`/`bench`/`diagnostic`/`external`/
+        # `golden`/`stress`), so this list is exactly "everything but slow".
+        #
+        # Two names beyond the non-slow categories are skipped while their
+        # difference is open (both predate this lane and fail on main):
+        # `dump_index_task_row_cnt_exceed_memory_quota` and
+        # `a_large_corpus_is_byte_identical_to_the_reference`.
+        working-directory: rust_engine
+        env:
+          UV_PYTHON: "3.13"
+        run: |
+          skip=(
+            # bench:
+            probe_same_table_insert_concurrency probe_bulk_delete_journal_scan
+            hnsw_production_scale tensor_maxsim_throughput
+            flush_dump_wall_time_probe a_checkpoint_scaling_probe
+            dot_throughput position_lut_throughput maxsim_throughput
+            spann_bench_128d spann_vs_hnsw_at_equal_latency
+            # diagnostic:
+            diag_estimator_accuracy diag_ranking_quality diag_extra_bits
+            flat_rabitq hnsw_rabitq hnsw_lsg_rabitq
+            compress_hnsw_to_rabitq compress_lsg_to_rabitq
+            spa
```

**File**: `rust_engine/crates/catalog/src/layout.rs` (modified, +101/-0)
```diff
@@ -1476,6 +1476,107 @@ pub fn column_timeline(
     Ok(out)
 }
 
+/// One table's columns as of a timestamp: the schema a transaction whose
+/// `begin_ts` is `ts` would read.
+///
+/// `ids` alone is not enough to write a block: the writer needs the column's
+/// declared type, its layout and its default, and a `DROP COLUMN` retires the
+/// `tbl|col|` record from the *live* set without deleting it. Rebuilding the
+/// `TableMeta` from the record that was live at `ts` is what
+/// [`table_meta_of`] already does for "now" - this pins the same reconstruction
+/// to a timestamp.
+///
+/// The window rules are `column_timeline`'s (this is that function with the
+/// `ColumnDefValue` kept instead of only the id):
+///
+/// - a record lives from its create ts (the key carries it);
+/// - its `drop|tbl_col|…` marker - whose *value* is the DROP's commit ts -
+///   ends it at that ts, **inclusive**: a transaction whose `begin_ts` equals
+///   the drop ts already sees the column as gone (`begin_ts = current_ts + 1`
+///   and `current_ts` only advances past a finished commit), which is the same
+///   `<=` the `AppendView` predicate uses;
+/// - a name created again later is a new record with a new id; only the newest
+///   incarnation at or before `ts` is live.
+///
+/// A ts that predates every record yields an empty schema, not "the current
+/// one": an empty answer means "this table did not exist yet".
+pub fn schema_at(
+    store: &dyn MetaStore,
+    db_id: u64,
+    table_id: u64,
+    ts: u64,
+) -> Result<Vec<ColumnDefValue>> {
+    let db = db_id.to_string();
+    let table = table_id.to_string();
+    let prefix = key::table_column_prefix(&db, &table);
+    // `(record value, create ts)` per incarnation.
+    let mut records: Vec<(ColumnDefValue, u64)> = Vec::new();
+    for (k, v) in store.scan_prefix(prefix.as_bytes())? {
+        let key = String::from_utf8_lossy(&k).to_string();
+        let create_ts = key
+            .rsplit('|')
+            .next()
+            .and_then(|t| t.parse::<u64>().ok())
+            .unwrap_or(0);
+        if create_ts > ts {
+            continue;
+        }
+        let Some(col) = value_format::column_def_from_bytes(&v) else {
+            continue;
+        };
+        records.push((col, create_ts));
+    }
+    let drop_prefix = format!("drop|tbl_col|{db}/{table}/");
+    // `(name, create ts) -> drop ts`, only for the wins that ended a record.
+    let mut drops: Vec<(String, u64, u64)> = Vec::new();
+    for (k, v) in store.scan_prefix(drop_prefix.as_bytes())? {
+        let key = String::from_utf8_lossy(&k).to_string();
+        let Some(tail) = key.strip_prefix(&drop_prefix) else {
+            continue;
+        };
+        let Some((name, create)) = tail.rsplit_once('/') else {
+            continue;
+        };
+        let (Ok(create_ts), Ok(drop_ts)) = (
+            create.parse::<u64>(),
+            String::from_utf8_lossy(&v).parse::<u64>(),
+        ) else {
+            continue;
+        };
+        if drop_ts == crate::DDL_TS_SENTINEL {
+            continue;
+        }
+        drops.push((name.to_string(), create_ts, drop_ts));
+    }
+    // The newest incarnation of each name wins; the others are superseded.
+    let newest: std::collections::HashMap<String, u64> = records
+        .iter()
+        .map(|(col, create_ts)| (col.column_name.clone(), *create_ts))
+        .fold(std::collections::HashMap::new(), |mut acc, (name, ts)| {
+            acc.entry(name)
+                .and_modify(|seen| *seen = (*seen).max(ts))
+                .or_insert(ts);
+            acc
+        });
+    let mut live: Vec<ColumnDefValue> = Vec::new();
+    for (col, create_ts) in records {
+        let name = col.column_name.clone();
+        if newest.get(&name).is_some_and(|seen| *seen > create_ts) {
+            continue;
+        }
+        // Dropped at or before `ts`: not live any more.
+        if drops
+            .iter()
+            .any(|(other, c, d)| *other == name && *c == create_ts && *d <= ts)
+        {
+            continue;
+        }
+        live.push(col);
+    }
+    live.sort_by_key(|c| c.column_id);
+    Ok(live)
+}
+
 /// One table, resolved **by name**: its newest `catalog|tbl|` record and that
 /// record's columns.
 ///
```

**File**: `rust_engine/crates/catalog/src/lib.rs` (modified, +263/-3)
```diff
@@ -1671,6 +1671,50 @@ impl Catalog {
             .unwrap_or_default())
     }
 
+    /// The table's schema as of `ts`, complete enough to write a block.
+    ///
+    /// `schema_ids_at` answers "which ids", which is all a *reader* of the
+    /// buffer needs. A block writer also needs each column's declared type,
+    /// layout and default, and it must not take them from the **current**
+    /// table: a column dropped since `ts` is gone from there, and a column
+    /// added since `ts` has no cells in these rows. Rebuilding the `TableMeta`
+    /// from the record that was live at `ts` is what this returns.
+    ///
+    /// `None` when the table does not exist (no `catalog|tbl|` record), which
+    /// is distinct from "exists with no columns".
+    pub fn schema_at(&self, table: &str, ts: u64) -> Result<Option<TableMeta>> {
+        let (db_id, bare) = self.db_and_bare_name(table)?;
+        let Ok(db_id_num) = db_id.parse::<u64>() else {
+            return Ok(None);
+        };
+        let resolved = self.with_view(|store| {
+            let Some((table_id, _)) =
+                crate::layout::table_record(store, &db_id.to_string(), &bare)?
+            else {
+                return Ok(None);
+            };
+            let columns = crate::layout::schema_at(store, db_id_num, table_id, ts)?;
+            Ok(Some((table_id, columns)))
+        })?;
+        let Some((table_id, columns)) = resolved else {
+            return Ok(None);
+        };
+        if columns.is_empty() {
+            // The table existed but no column record is at or before `ts`:
+            // report it as "not yet", not as a schema-less table.
+            return Ok(None);
+        }
+        let layout = crate::layout::TableLayout {
+            db_name: String::new(),
+            db_id: db_id_num,
+            table_name: bare,
+            table_id,
+            columns,
+            next_column_id: 0,
+        };
+        Ok(Some(crate::layout::table_meta_of(&layout)))
+    }
+
     pub fn column_timeline(&self, table: &str) -> Result<Vec<(u64, Vec<u64>)>> {
         let (db_id, bare) = self.db_and_bare_name(table)?;
         let Ok(db_id) = db_id.parse::<u64>() else {
@@ -2040,11 +2084,20 @@ impl Catalog {
     }
 
     /// Writes the two system tags a C++-written directory always carries
-    /// (`NewCatalog::Init`): the catalog version and the database counter. Both
-    /// only when absent - a directory that already has them keeps its values.
+    /// (`NewCatalog::Init`): the catalog version and the database counter.
+    ///
+    /// The version is **upgraded** in place when it differs, not only written
+    /// when absent: the reference compares it with its own build version at
+    /// startup and runs its JSON-index conversion for anything older
+    /// (`Storage::ConvertJsonIndexFormat`), which aborts on a port-written
+    /// catalog. A directory this build opened must therefore carry its version
+    /// even when the open runs no DDL and no checkpoint - leaving an older value
+    /// behind would make the reference fail to start on it. The database
+    /// counter, unlike the version, is only initialised when absent: it is
+    /// real state, not a format stamp.
     pub fn init_key_space(&self) -> Result<()> {
         use storage::catalog_format::{CATALOG_VERSION, META_VERSION, NEXT_DATABASE_ID};
-        if self.store.get(META_VERSION.as_bytes())?.is_none() {
+        if self.store.get(META_VERSION.as_bytes())?.as_deref() != Some(CATALOG_VERSION.as_bytes()) {
             self.store
                 .put(META_VERSION.as_bytes(), CATALOG_VERSION.as_bytes())?;
         }
@@ -3288,4 +3341,211 @@ mod tests {
         let back = crate::layout::read_segments(store.as_ref()).unwrap();
         assert_eq!(back, vec![shrunk]);
     }
+
+    // ---- `Catalog::schema_at` -------------------------------------------
+    //
+    // The window rules are `column_timeline`'s, so these also pin that
+    // function's semantics - it had no test before.
+
+    /// Commits one DDL the way a statement does: capture its batch, restamp the
+    /// records to `ts`, apply them.
+    ///
+    /// `restamp` is what turns the sentinel a DDL writes into the
+    /// transaction's commit ts, so this is the only way to build a directory
+    /// whose column records carry several distinct timestamps.
+    fn ddl_at<F>(c: &Catalog, ts: u64, f: F)
+    where
+        F: FnOnce(&Catalog) -> Result<()>,
+    {
+        // The DDL has already run inside `capture`; only its batch is left.
+        let ((), mut batch) = c.capture(|| f(c)).unwrap();
+        Catalog::restamp(&mut batch, ts);
+        c.stage(&batch).unwrap();
+    }
+
+    fn schema_at_setup() -> (tempfile::TempDir, Catalog) {
+        let dir = tempdir().unwrap();
+        let store: Arc<dyn MetaStore> = Arc::new(RocksMetaStore::open(dir.path()).unwrap());
+        let c = Catalog::with_store_catalog_only(store);
+        c.create_database("db", false).unw
```

**File**: `rust_engine/crates/executor/src/alter_ut.rs` (modified, +14/-8)
```diff
@@ -423,15 +423,21 @@ fn replay_of_the_test_alter_complex_sequence_around_a_checkpoint() {
 /// `PeriodicTriggerThread` runs `checkpoint_wal()` + `flush()` on its own
 /// thread; fifty rounds of `INSERT / ADD / DROP / ADD / INSERT` run against it.
 ///
-/// `#[ignore]`d: it still reproduces a residual hole on a slow machine (the
-/// arm64 runner). After the restart a replayed row reads the old `c2` out of
-/// `c3` - `[["1","2","test"]]` instead of `[["1","test","tttt"]]`. The
-/// checkpoint writes no schema newer than its bound and an `ALTER` applies its
-/// cells before the commit is published, so the mismatch is on the replay side
-/// (`apply_replayed_rows` -> `ids_at` for a frame), which is tracked, not
-/// closed. Run with `--ignored` when working on that path.
+/// This is the regression for the column shift `docs/ALTER_CHECKPOINT_RACE.md`
+/// documents: a checkpoint used to take the buffer's four-cell rows and the
+/// *live* three-column table in one pass, so `2.col` got the dropped `c2`'s
+/// value and `3.col` got `c3`'s - the first row read `[["1","2","test"]]`
+/// instead of `[["1","test","tttt"]]`.
+///
+/// The write now resolves the whole schema **at its bound** (`schema_at`,
+/// including the dropped column's type and default), and the file sweep is
+/// driven by that same schema instead of the live one, so the pre-DROP
+/// columns and the rows that still carry them agree.
+///
+/// Fifty rounds against a checkpointing thread, so it is a `slow:` case: run
+/// it with `--ignored`.
 #[test]
-#[ignore = "reproduces a replay-side column-time mismatch under a racing checkpoint"]
+#[ignore = "slow: a checkpoint racing ALTER TABLE must not shift a buffered row's columns"]
 fn a_checkpoint_through_a_column_change_keeps_the_block_readable() {
     for _ in 0..50 {
         let dir = tempdir().unwrap();
```

**File**: `rust_engine/crates/executor/src/bg_task.rs` (modified, +54/-6)
```diff
@@ -53,10 +53,16 @@ struct Shared {
 
 /// A background task processor (`BGTaskProcessor`).
 pub struct BGTaskProcessor {
-    /// `None` before `start` and after `stop`: dropping the last sender closes
-    /// the channel, so the worker's `recv().await` returns `None` and it exits
-    /// once the queue is drained.
+    /// Created in `new`, closed in `stop`. The reference's processor owns its
+    /// blocking queue from construction and `Start()` only takes the consumer
+    /// out of it (`BackgroundProcessor::Start`), so a task submitted before
+    /// `start` waits in the queue instead of being dropped: a quota breach can
+    /// arrive before the owner has started the pool (the tests rely on it - the
+    /// reference submits the dump from the append path and starts the processor
+    /// afterwards).
     jobs: Mutex<Option<tokio::sync::mpsc::Sender<Box<dyn BgTask>>>>,
+    /// The queue's receiving half, parked here between `new` and `start`.
+    queue: Mutex<Option<tokio::sync::mpsc::Receiver<Box<dyn BgTask>>>>,
     shared: Arc<Shared>,
     /// The worker's `JoinHandle`. A runtime task, so `stop` waits by aborting
     /// nothing - it closes the channel and parks until the worker's own
@@ -71,8 +77,10 @@ impl BGTaskProcessor {
         // tokio fan-out), so a second consumer would only let two dumps of one
         // table race. The parameter stays so the call shape matches the
         // reference's processor pool.
+        let (jobs, queue) = tokio::sync::mpsc::channel::<Box<dyn BgTask>>(QUEUE_CAPACITY);
         Self {
-            jobs: Mutex::new(None),
+            jobs: Mutex::new(Some(jobs)),
+            queue: Mutex::new(Some(queue)),
             shared: Arc::new(Shared {
                 outstanding: AtomicUsize::new(0),
                 idle: Mutex::new(()),
@@ -83,13 +91,18 @@ impl BGTaskProcessor {
     }
 
     /// Starts the worker task. Idempotent.
+    ///
+    /// The queue already exists (`new`), so this only attaches the consumer.
+    /// `start` is not what makes `submit` legal: a task submitted before it
+    /// waits in the same channel.
     pub fn start(self: &Arc<Self>) {
         let mut handles = self.handles.lock().unwrap();
         if !handles.is_empty() {
             return;
         }
-        let (jobs, mut queue) = tokio::sync::mpsc::channel::<Box<dyn BgTask>>(QUEUE_CAPACITY);
-        *self.jobs.lock().unwrap() = Some(jobs);
+        let Some(mut queue) = self.queue.lock().unwrap().take() else {
+            return;
+        };
         let shared = Arc::clone(&self.shared);
         let handle = crate::scheduler::scheduler().spawn_task(async move {
             while let Some(task) = queue.recv().await {
@@ -122,6 +135,10 @@ impl BGTaskProcessor {
     /// submitting must clear it again, or the flag stays set for the rest of
     /// the process and stops new work from being proposed.
     ///
+    /// A task submitted **before** `start` is queued, not rejected: the queue
+    /// exists from `new` (see the field comment), so `false` only ever means
+    /// "stopped" or "the queue is full".
+    ///
     /// The send is `try_send`, not `blocking_send`: `submit` is called from
     /// `enforce_memindex_quota`, which already runs on a **runtime worker**
     /// (its callers are all async: `run_bottom`, `insert_literals_inner`,
@@ -170,6 +187,21 @@ impl BGTaskProcessor {
         // thread join: the worker is a runtime task and joining it from a
         // non-async caller would need a `block_on` of its own.
         self.jobs.lock().unwrap().take();
+        // A task submitted **before** `start` is queued in `queue` (`submit` is
+        // legal from `new`), and only the worker ever consumes that channel.
+        // Without a worker it would sit there with its `outstanding` count
+        // raised and `drain` below would wait forever - which is exactly what
+        // `Drop` does for a processor nobody started. Dropping the receiver
+        // discards those tasks, so their counts go with them.
+        if self.handles.lock().unwrap().is_empty() {
+            if let Some(queue) = self.queue.lock().unwrap().take() {
+                let queued = queue.len();
+                drop(queue);
+                if queued > 0 {
+                    self.shared.outstanding.fetch_sub(queued, Ordering::SeqCst);
+                }
+            }
+        }
         let handles: Vec<tokio::task::JoinHandle<()>> =
             std::mem::take(&mut *self.handles.lock().unwrap());
         drop(handles);
@@ -234,4 +266,20 @@ mod tests {
         processor.stop();
         assert_eq!(processor.running_task_count(), 0);
     }
+
+    /// A task submitted before `start` is queued, so a pool that is dropped
+    /// without ever starting must not wait for a worker that does not exist:
+    /// without dropping that queue, `stop`'s `drain` parks on a task nothing can
+    /// consume.
+    #[test]
+    fn drop_before_start_does_not_hang() {
+        let count
```

**File**: `rust_engine/crates/executor/src/bg_task_ut.rs` (modified, +2/-2)
```diff
@@ -297,7 +297,7 @@ fn submit_after_stop_is_rejected() {
 /// dumps both blocks as a single 16384-row chunk. The next append proposes
 /// another dump, which starts at row 16384.
 #[test]
-#[ignore = "SLOW: the reference disables this test"]
+#[ignore = "slow: C++ DumpMemIndexTaskTest2.DISABLED_SLOW_row_cnt_exceed_memory_quota"]
 fn dump_index_task_row_cnt_exceed_memory_quota() {
     let dir = tempdir().unwrap();
     let engine = Arc::new(Engine::open(dir.path()).unwrap());
@@ -337,7 +337,7 @@ fn dump_index_task_row_cnt_exceed_memory_quota() {
 /// `mem_index_capacity = 8192`: each append reaches the row bound and is
 /// dumped at the end of its batch, so the second chunk starts at row 8192.
 #[test]
-#[ignore = "SLOW: the reference disables this test"]
+#[ignore = "slow: C++ DumpMemIndexTaskTest.DISABLED_SLOW_row_cnt_exceed_memindex_capacity"]
 fn dump_index_task_row_cnt_exceed_memindex_capacity() {
     let dir = tempdir().unwrap();
     let engine = Engine::open(dir.path()).unwrap();
```

**File**: `rust_engine/crates/executor/src/blocks/chunk.rs` (modified, +116/-83)
```diff
@@ -117,80 +117,38 @@ pub(crate) fn publish_lowcard_chunks_from_dir(seg_dir: &Path, segment: u32) -> V
     chunks
 }
 
-/// Rebuilds a sparse index's published chunks: one per block, from the rows.
+/// Publishes the chunks one BMP dump produced, from the memory index it sealed.
 ///
-/// The reference's chunk is the block, and every memory dump re-dumps the block
-/// it touches (`BMPIndexInMem::Dump` hands the whole in-memory `BMPAlg` to the
-/// chunk buffer), so two 100-row inserts into one block leave **one** chunk of
-/// 200 rows. The port's spill files are per dump, so the merge happens here.
-///
-/// The chunk id is the catalog's, not the block number: `PopulateBMPIndexInner`
-/// and `DumpMemIndex` both take one from `GetAndSetNextChunkID`, and that
-/// counter only moves forward. `existing` maps a chunk's first row id to the id
-/// a record already named, so a re-dump of the same block rewrites its own
-/// chunk instead of appending a second one; `next_id` hands out the ones no
-/// record names yet.
-/// Where and how a sparse chunk is encoded: the column's `IdxWidth` and
-/// declared term bound, the block size, the segment the chunk belongs to and
-/// whether the whole segment folds into one chunk (an `IMPORT` does).
-pub(crate) struct BmpChunkShape {
-    pub(crate) width: storage::bmp::IdxWidth,
-    pub(crate) term_bound: usize,
-    pub(crate) block_size: usize,
-    pub(crate) segment: u32,
-    pub(crate) single_chunk: bool,
-}
-
+/// `pending` is the images `SparseIndex::seal` just encoded - **one per
+/// `ROW_ID` segment**, each holding exactly the documents that dump covered. The
+/// reference's `DumpSegmentMemIndex` dumps the segment's `BMPIndexInMem` once
+/// and records its `ChunkIndexMetaInfo`, so this is the chunk: the bytes are
+/// the index image (`BMPHandler::SaveToPtr`) and `base_row_id` is its first
+/// document. Rebuilding from the table's rows (`sparse_rows_by_block`) put
+/// every row of the segment in the chunk, so a second dump re-covered the first
+/// one's range and the two records overlapped.
 pub(crate) fn publish_bmp_chunks(
     seg_dir: &Path,
-    by_block: std::collections::BTreeMap<u64, Vec<storage::bmp::SparseDoc>>,
-    shape: &BmpChunkShape,
+    pending: &[crate::engine::PendingSparseChunk],
+    segment: u32,
     existing: &std::collections::HashMap<u64, u32>,
     next_id: &mut u32,
-) -> Vec<IndexChunk> {
-    let BmpChunkShape {
-        width,
-        term_bound,
-        block_size,
-        segment,
-        single_chunk,
-    } = *shape;
-    // `PopulateBMPIndexInner` adds every block of the segment to one
-    // `BMPIndexInMem` and dumps once, so an imported segment's sparse chunk
-    // covers all of its blocks.
-    let by_block: std::collections::BTreeMap<u64, Vec<storage::bmp::SparseDoc>> = match single_chunk
-    {
-        true => {
-            let docs: Vec<storage::bmp::SparseDoc> = by_block.into_values().flatten().collect();
-            if docs.is_empty() {
-                Default::default()
-            } else {
-                [(0u64, docs)].into_iter().collect()
-            }
-        }
-        false => by_block,
-    };
+) -> (Vec<IndexChunk>, Vec<crate::engine::PendingSparseChunk>) {
     let mut chunks = Vec::new();
-    for (block, mut docs) in by_block {
+    let mut failed: Vec<(u64, Vec<u8>, u32, usize)> = Vec::new();
+    for (chunk_segment, bytes, first_doc, doc_count) in pending {
+        if *chunk_segment != u64::from(segment) {
+            continue;
+        }
         if std::fs::create_dir_all(seg_dir).is_err() {
-            break;
+            // Keep the image: the caller's queue was drained before this ran,
+            // and a chunk it never wrote has no record - the documents would be
+            // gone at the next restart. It is returned to the caller so the next
+            // publication can try again.
+            failed.push((*chunk_segment, bytes.clone(), *first_doc, *doc_count));
+            continue;
         }
-        docs.sort_by_key(|(row, _)| *row);
-        // The term space is the column's declared bound, widened to the terms
-        // this chunk actually holds (`BMPAlg` is constructed with the bound).
-        let term_num = docs
-            .iter()
-            .flat_map(|(_, entries)| entries.iter().map(|(term, _)| *term + 1))
-            .max()
-            .unwrap_or(0)
-            .max(1)
-            .max(term_bound as i32) as usize;
-        let bytes = storage::bmp::encode_bmp(block_size, width, &docs, term_num);
-        // `block` is the index's own block ordinal, so its first row is
-        // `block * block_size` (`BMPAlg`: `doc_id = block_id * block_size`).
-        let base_row_id = (u64::from(segment) << 32) | (block * block_size as u64);
-        // The id the record for **this block's** chunk already owns, else the
-        // counter the catalog keeps. A block never reuses a retired id.
+        let base_row_id = (u64::from(segment) << 32) | u64:
```

**File**: `rust_engine/crates/executor/src/blocks/column.rs` (modified, +31/-5)
```diff
@@ -447,12 +447,38 @@ pub(crate) fn encode_value_with_shape(
     Ok(Some(bytes))
 }
 
-/// The commit ts of the append that wrote row `offset`, from the append log.
+/// The commit ts of the append that wrote row `seq`, from the append log.
 ///
-/// `totals[i]` is the cumulative row count after append `i` and `ts[i]` its
-/// commit ts; a row lands in the first append whose total passes it.
-pub(crate) fn append_ts_of(offset: u64, totals: &[u64], ts: &[u64]) -> Option<u64> {
-    let i = totals.partition_point(|total| *total <= offset);
+/// `totals[i]` is the cumulative **table-wide** row count after append `i` and
+/// `ts[i]` its commit ts; a row lands in the first append whose total passes
+/// its table-wide ordinal.
+///
+/// `seq` is a full row id (`segment << 32 | in-segment offset`), and the
+/// ordinal is what the segment map makes of it: the offset plus the rows every
+/// earlier segment holds. Comparing the raw in-segment offset against the
+/// table-wide totals read the *first* append's ts for any row whose offset is
+/// below it - every row of a second segment starts at offset 0 - so a
+/// checkpoint could stamp a block with a ts that predates its rows and skip it.
+///
+/// `segments` must be every segment the table has, ascending; a table with one
+/// segment has the same basis either way, which is why this went unnoticed.
+pub(crate) fn append_ts_of(
+    seq: u64,
+    segments: &[(u32, u64)],
+    totals: &[u64],
+    ts: &[u64],
+) -> Option<u64> {
+    let segment = (seq >> 32) as u32;
+    let offset = seq & 0xffff_ffff;
+    let mut before = 0u64;
+    for (id, rows) in segments {
+        if *id >= segment {
+            break;
+        }
+        before += rows;
+    }
+    let ordinal = before + offset;
+    let i = totals.partition_point(|total| *total <= ordinal);
     ts.get(i).copied().filter(|t| *t != 0)
 }
 
```

#### Recent Merged Pull Requests:
- **PR #3572** (2026-11-18): checkpoint: encode a block with the schema at its bound; key the append buffer by column id (@yuzhichang)
- **PR #3571** (2026-11-17): rust_engine: spann index, filter push-down, unified maintenance accounting (@yingfeng)
- **PR #3570** (2026-11-16): executor: record each full-text chunk name once, and name the row a MATCH lost (@yingfeng)
- **PR #3569** (closed): executor: record each full-text chunk name once, and name the row a MATCH lost (@yingfeng)
- **PR #3568** (2026-11-16): executor: column-wise WHERE/ORDER BY, per-request panic bounds, night… (@yingfeng)
- **PR #3566** (2026-11-16): executor: carry results as a columnar DataBlock instead of Value rows (@yingfeng)

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

## X. checkpoint: encode a block with the schema at its bound; key the append buffer b

**RULE**:
When implementing operations in `.github/workflows/rust_engine.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `583c8505`: checkpoint: encode a block with the schema at its bound; key the append buffer by column id. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/rust_engine.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
      - name: Python SDK slow cases
        # The reference's `reldeb_parallel_test` runs the same files with
        # `-m "not complex"`, i.e. including `@pytest.mark.slow`: the cases that
        # build 10k tables, 10k databases and long-abandoned rows. They are the
        # ones a nightly needs and a PR does not, so they only run when the
        # workflow is dispatched or scheduled.
        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
        continue-on-error: true
        run: .venv/bin/python -m pytest -q python/test_pysdk -m "slow and not complex" --tb=short
      - name: Parallel suite (Python)
        # `python/parallel_test`: the reference's `debug_tsan_parallel_test`
        # target. Its Go counterpart above drives the same engine from
        # goroutines; this one keeps the Python form because the client-side
        # behaviour it asserts (session handling under writers) only exists in
        # the SDK.
        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
        continue-on-error: true
        run: .venv/bin/python -m pytest -q python/parallel_test -m "not complex and not slow" --tb=short
  
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
      - name: Ignored tests (perf probes, long replay loops)
        # slow_tests.yml runs nightly, plus the cases the unit lane drops for
        # its wall time: the ColBERT-SaR training ports and the `rabitq::tests::diag_*`
        # diagnostics. They are reported rather than gated for
        # now: at least `new_catalog_index_internal_ut::disabled_slow_test_populate_index`
        # fails on the port (fulltext_tail is None where the case expects
        # (0, 16384)), and that predates the current work. Flip this to a gate
        # once the set is triaged.
        run: cargo test --workspace -- --ignored
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `583c8505` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
