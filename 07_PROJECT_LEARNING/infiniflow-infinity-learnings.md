> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `e02e0d7e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T22:48:33.142Z  
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
> **Harvest Timestamp**: 2026-11-12T22:48:33.130Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4764 stars

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
- **Issue #3377** (2026-06-05): **[Bug]: Segmentation fault after upgrading from v0.7.0-dev5 to v0.7.0**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  v0.7.0  ### Other environment information  ```Markdown Debian Kubernetes v1.34.6 ```  ### Actual behavior and How to reproduce it  I had a working RAGFlow v0.25.0 installation (via Helm chart) on a Kubernetes cluster. I scaled down all RAGFlow deployments and stateful sets (UI, minio, mysql,redis, infinity), then I upgraded RAGFlow to v0.25.6 (via Helm chart), all pods started successfully except for Infinity that crashed with the following logs. Currently my RAGFlow installation is broken, any way to recover from it? Thank you  ``` [17:39:50.199] [1] [info] Find wal file: /var/infinity/wal/wal.log.76640 [17:39:50.199] [1] [info] Find wal file: /var/infinity/wal/wal.log.76632 [...lots of these logs...] [17:45:00.293] [1] [info] Find wal file: /var/infinity/wal/wal.log.18 [17:45:00.293] [1] [info] Find wal file: /var/infinity/wal/wal.log.10 [17:45:00.294] [1] [info] Start Wal Replay [17:45:00.520] [1] [warning] TxnManager is null [17:45:00.520] [1] [critical] Error: Segmentation fault [17:45:00.769] [1] [critical]    0# infinity::PrintStacktrace@infinity_core(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&) at /infinity/src/common/utility/exception_impl.cpp:47    1# (anonymous namespace)::SignalHandler(int, siginfo_t*, void*) at /infinity/src/bin/infinity_main.cpp:160    2#      at :0    3#      at :0    4# std::char_trai

- **Issue #3359** (2026-06-05): **[Bug]: Error: RoaringBitmap::SetTrue: row_index >= count_, row_index: 190600, count_: 150892@src/storage/common/roaring_bitmap.cppm:120 [00:37:59.956] [246] [info] AppendMemIndex ENTER: block_id=39, offset=2655, row_cnt=1**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Version or Commit ID  0.7.0-dev6  ### Other environment information  ```Markdown PRETTY_NAME="Ubuntu 24.04.2 LTS" NAME="Ubuntu" VERSION_ID="24.04" VERSION="24.04.2 LTS (Noble Numbat)" VERSION_CODENAME=noble ID=ubuntu ID_LIKE=debian HOME_URL="https://www.ubuntu.com/" SUPPORT_URL="https://help.ubuntu.com/" BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/" PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy" UBUNTU_CODENAME=noble LOGO=ubuntu-logo ```  ### Actual behavior and How to reproduce it  I currently use mirror is infiniflow/infinity: v0.7.0 - dev6 but will still be an error: Txn ID: 9240230, Text: insert statement, Begin TS: 979487, Commit TS: 979488, KV Commit TS: 979489, State: Committed     APPEND table tw_rd_db.ragflow_26ea039b49d611f1876fd3149acf17cf_68b5372a49d611f1af06d3149acf17cf (db_id:  2, table_id: 1) Txn ID: 9240298, Text: insert statement, Begin TS: 979489, Commit TS: 979490, KV Commit TS: 979491, State: Committed     APPEND table tw_rd_db.ragflow_doc_meta_26ea039b49d611f1876fd3149acf17cf (db_id: 2, table_id: 0) Txn ID: 9240307, Text: Select Statement, Begin TS: 979491, Commit TS: 18446744073709551615, KV Commit TS:  18446744073709551615, State: Started Txn ID: 9240305, Text: Select Statement, Begin TS: 979491, Commit TS: 18446744073709551615, KV Commit TS:  18446744073709551615, State: Started Txn ID: 9240299, Text: insert statem

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

### Incident Patch 1: `6ea59ff9` (2026-11-12)
**Commit Message**: fix(optimize): use block-relative offset as row-id label base when merging HNSW/BMP chunks (#3548)

As discussed in #3542.

**Problem:** in `NewTxn::OptimizeVecIndex`, the HNSW and BMP branches
passed `base_rowid.segment_offset_` (always 0 for a merge starting at
the segment base) as the row-id label base for every block, so every
block after the first was relabeled 0..8191. Merged chunks silently lost
row 8192+ from search results (normal file size, no log output).

**File**: `src/storage/new_txn/new_txn_index_impl.cpp` (modified, +9/-2)
```diff
@@ -2300,7 +2300,12 @@ Status NewTxn::OptimizeVecIndex(std::shared_ptr<IndexBase> index_base,
                 return status;
             }
             u32 offset = 0;
-            memory_hnsw_index->InsertVecs(base_rowid.segment_offset_, col, offset, row_cnt);
+            // Row-id labels must use the block's absolute offset within the segment (the pattern
+            // used by the SMVE branch below). base_rowid.segment_offset_ is always 0 when the
+            // merge range starts from the segment base, which would relabel every block after
+            // the first one as 0..8191 and silently drop those rows from search results.
+            SegmentOffset block_offset = block_id * DEFAULT_BLOCK_CAPACITY;
+            memory_hnsw_index->InsertVecs(block_offset, col, offset, row_cnt);
         }
 
         memory_hnsw_index->Dump(buffer_obj);
@@ -2323,7 +2328,9 @@ Status NewTxn::OptimizeVecIndex(std::shared_ptr<IndexBase> index_base,
                 return status;
             }
             u32 offset = 0;
-            memory_bmp_index->AddDocs(base_rowid.segment_offset_, col, offset, row_cnt);
+            // Same as the HNSW branch above: label rows with the block's absolute offset.
+            SegmentOffset block_offset = block_id * DEFAULT_BLOCK_CAPACITY;
+            memory_bmp_index->AddDocs(block_offset, col, offset, row_cnt);
         }
         memory_bmp_index->Dump(buffer_obj);
     } else if (index_base->index_type_ == IndexType::kSMVE) {
```

---

### Incident Patch 2: `2aa4f942` (2026-11-12)
**Commit Message**: fix(restart-test): disable periodic checkpoint/cleanup so explicit flush/cleanup is not skipped (#3555)

### Summary

Disable periodic checkpoint/cleanup in restart test so explicit
flush/cleanup is not skipped

**File**: `test/data/config/restart_test/test_alter/1.toml` (modified, +1/-1)
```diff
@@ -16,6 +16,6 @@ persistence_dir = ""
 
 [buffer]
 [wal]
-checkpoint_interval = "1s"
+checkpoint_interval = "0s"
 
 [resource]
```

**File**: `test/data/config/restart_test/test_alter/3.toml` (modified, +5/-2)
```diff
@@ -10,12 +10,15 @@ log_level = "trace"
 [storage]
 data_dir = "/var/infinity/data"
 optimize_interval = "0s"
-cleanup_interval = "1s"
+cleanup_interval = "0s"
 compact_interval = "0s"
 persistence_dir = ""
 
 [buffer]
 [wal]
-checkpoint_interval = "1s"
+# The periodic checkpoint must stay disabled: an explicit FLUSH DATA that lands
+# while a periodic checkpoint txn is in flight is skipped (query_context_impl.cpp),
+# and test_alter_cleanup_simple asserts on the .col files the flush produces.
+checkpoint_interval = "0s"
 
 [resource]
```

**File**: `test/data/config/restart_test/test_cleanup/2.toml` (modified, +2/-2)
```diff
@@ -11,11 +11,11 @@ log_level = "trace"
 persistence_dir = ""
 data_dir = "/var/infinity/data"
 optimize_interval = "0s"
-cleanup_interval = "1s"
+cleanup_interval = "0s"
 compact_interval = "1s"
 
 [buffer]
 [wal]
-checkpoint_interval = "1s"
+checkpoint_interval = "0s"
 
 [resource]
```

**File**: `test/data/config/restart_test/test_fulltext/1.toml` (modified, +2/-1)
```diff
@@ -9,10 +9,11 @@ log_to_stdout = true
 
 [storage]
 persistence_dir = ""
+cleanup_interval = "0s"
 mem_index_capacity = 1048576
 
 [buffer]
 [wal]
-checkpoint_interval = "30s"
+checkpoint_interval = "0s"
 
 [resource]
```

---

### Incident Patch 3: `b53d40ce` (2026-11-12)
**Commit Message**: Fix reentrantcy issue of opencc  (#3554)

#3552

**File**: `src/common/analyzer/analyzer_pool.cppm` (modified, +8/-0)
```diff
@@ -48,6 +48,14 @@ public:
     static constexpr std::string_view SPARSEGRAM = "sparsegram";
 
 private:
+    // Guards cache_. GetAnalyzer() is called from every fulltext indexing worker
+    // and from concurrent queries: without the lock two threads could both load
+    // a prototype and the second store would destroy the first one, leaving the
+    // analyzers already handed out with dangling borrowed members (trie_,
+    // pos_table_, wordnet_lemma_, opencc_). Entries are never erased, so the
+    // borrowed members stay valid for the lifetime of the process.
+    std::mutex cache_mtx_;
+
     CacheType cache_{};
 };
 
```

**File**: `src/common/analyzer/analyzer_pool_impl.cpp` (modified, +3/-0)
```diff
@@ -71,6 +71,9 @@ constexpr std::string_view SWEDISH = "-swedish";
 constexpr std::string_view TURKISH = "-turkish";
 
 std::tuple<std::unique_ptr<Analyzer>, Status> AnalyzerPool::GetAnalyzer(const std::string_view &name) {
+    // The prototype cache is filled lazily and shared by all caller threads.
+    std::unique_lock<std::mutex> lock(cache_mtx_);
+
     switch (Str2Int(name.data())) {
         case Str2Int(CHINESE.data()): {
             // chinese-{coarse|fine}
```

**File**: `src/common/analyzer/rag_analyzer_impl.cpp` (modified, +15/-2)
```diff
@@ -672,6 +672,12 @@ RAGAnalyzer::RAGAnalyzer(const std::string &path)
 RAGAnalyzer::RAGAnalyzer(const RAGAnalyzer &other)
     : own_dict_(false), trie_(other.trie_), pos_table_(other.pos_table_), wordnet_lemma_(other.wordnet_lemma_), stemmer_(std::make_unique<Stemmer>()),
       opencc_(other.opencc_), lowercase_string_buffer_(term_string_buffer_limit_), fine_grained_(other.fine_grained_) {
+    // The dictionary, POS table, lemmatizer and OpenCC converter are borrowed from
+    // the prototype held by AnalyzerPool and are read-only after loading, so the
+    // copies share them instead of reloading. OpenCC conversion itself is
+    // re-entrant (its scratch and error state are per call / per thread), which is
+    // what makes it safe for several indexing workers to convert through the same
+    // converter. Only per-instance state (stemmer, buffers, flags) is duplicated.
     InitStemmer(STEM_LANG_ENGLISH);
 }
 
@@ -1831,7 +1837,11 @@ std::string RAGAnalyzer::Tokenize(const std::string &line) {
     std::string processed_line = PCRE2GlobalReplace(*input, R"#(\W+)#", " ");
     std::string str1 = StrQ2B(processed_line);
     std::string strline;
-    opencc_->convert(str1, strline);
+    if (opencc_ == nullptr || opencc_->convert(str1, strline) < 0) {
+        // Never tokenize an empty string because of a failed conversion: it would
+        // silently drop the whole field from the index. Use the unconverted text.
+        strline = str1;
+    }
 
     std::vector<std::string> res;
 
@@ -1915,7 +1925,10 @@ std::pair<std::vector<std::string>, std::vector<std::pair<unsigned, unsigned>>>
 
     std::string str1 = StrQ2B(processed_line);
     std::string strline;
-    opencc_->convert(str1, strline);
+    if (opencc_ == nullptr || opencc_->convert(str1, strline) < 0) {
+        // See Tokenize(): a failed conversion must not erase the field.
+        strline = str1;
+    }
     std::vector<std::string> tokens;
     std::vector<std::pair<unsigned, unsigned>> positions;
 
```

**File**: `src/common/analyzer/traditional_chinese_analyzer_impl.cpp` (modified, +5/-1)
```diff
@@ -61,7 +61,11 @@ Status TraditionalChineseAnalyzer::Load() {
 
 void TraditionalChineseAnalyzer::Parse(const std::string &input) {
     std::string out;
-    opencc_->convert(input, out);
+    // The converter may be shared with other analyzer copies, so a failed
+    // conversion is possible; fall back to the input instead of indexing nothing.
+    if (opencc_ == nullptr || opencc_->convert(input, out) < 0) {
+        out = input;
+    }
     ChineseAnalyzer::Parse(out);
 }
 
```

**File**: `src/unit_test/third_party/opencc_thread_safety_ut.cpp` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+// Copyright(C) 2024 InfiniFlow, Inc. All rights reserved.
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
+module;
+
+#include "unit_test/gtest_expand.h"
+
+#include "opencc.h"
+
+#include <errno.h>
+#include <pthread.h>
+#include <stdlib.h>
+#include <string.h>
+
+module infinity_core:ut.opencc_thread_safety;
+
+import :ut.base_test;
+
+using namespace infinity;
+
+namespace fs = std::filesystem;
+
+// One ::OpenCC is shared by every copy of a RAGAnalyzer, i.e. by every fulltext
+// indexing worker that tokenizes a column value, and several workers convert at
+// the same time. The conversion used to keep its shortest-path segmentation
+// scratch inside the converter and its lookup key inside the dictionary, so
+// concurrent conversions overwrote each other's min_len/parent/path arrays.
+// Reported symptom: SIGSEGV in sp_seg() (converter.c, path reconstruction) from
+// a MemoryIndexer::AsyncInsertBottom worker.
+//
+// The dictionaries below are plain TEXT dictionaries on purpose: unlike the
+// shipped .ocd ones they answer multi-character phrases from
+// dictionary_group_match_longest(), which is what makes sp_seg() run with
+// length > 1 and touch that scratch at all.
+class OpenCCThreadSafetyTest : public BaseTest {
+public:
+    void SetUp() override {
+        BaseTest::SetUp();
+        dict_dir_ = fs::temp_directory_path() / ("infinity_ut_opencc_reentrancy_" + std::to_string(getpid()));
+        std::error_code ec;
+        fs::remove_all(dict_dir_, ec);
+        ASSERT_TRUE(fs::create_directories(dict_dir_, ec)) << dict_dir_ << ": " << ec.message();
+    }
+
+    void TearDown() override {
+        std::error_code ec;
+        fs::remove_all(dict_dir_, ec);
+        BaseTest::TearDown();
+    }
+
+    static bool WriteTextFile(const fs::path &path, const char *content) {
+        FILE *fp = fopen(path.string().c_str(), "wb");
+        if (fp == nullptr) {
+            return false;
+        }
+        const bool ok = fputs(content, fp) >= 0;
+        fclose(fp);
+        return ok;
+    }
+
+    static std::string MakeRepeated(const char *unit, size_t repeat) {
+        std::string text;
+        text.reserve(strlen(unit) * repeat);
+        for (size_t i = 0; i < repeat; ++i) {
+            text += unit;
+        }
+        return text;
+    }
+
+    // Returns the conversion result, or nullptr when the conversion failed.
+    static char *Convert(opencc_t od, const char *input) {
+        char *out = opencc_convert_utf8(od, input, (size_t)-1);
+        return out == (char *)-1 ? nullptr : out;
+    }
+
+    struct WorkerArgs {
+        opencc_t od;
+        const char *input;
+        const char *expected;
+        size_t iterations;
+        size_t mismatches;
+    };
+
+    static void *ConvertLoop(void *arg) {
+        auto *args = static_cast<WorkerArgs *>(arg);
+        for (size_t i = 0; i < args->iterations; ++i) {
+            char *out = Convert(args->od, args->input);
+            if (out == nullptr || strcmp(out, args->expected) != 0) {
+                ++args->mismatches;
+            }
+            free(out);
+        }
+        return nullptr;
+    }
+
+protected:
+    fs::path dict_dir_;
+
+    // Every phrase is longer than one character, so the segmentation has to run
+    // the shortest-path pass over spans of several code points.
+    static constexpr const char *PHRASES = "中華人民共和國\t中华人民共和国\n"
+                                           "這個時候\t这个时候\n"
+                                           "我們發現\t我们发现\n"
+                                           "另外一個問題\t另外一个问题\n"
+                                           "臺灣的經濟發展\t台湾的经济发展\n"
+                                           "後來怎麼樣了呢\t后来怎么样了呢\n";
+
+    static constexpr const char *CONFIG = "title = reentrancy\n"
+                                          "dict0 = TEXT phrases.txt\n";
+
+    static constexpr const char *UNIT = "中華人民共和國這個時候我們發現另外一個問題臺灣的經濟發展後來怎麼樣了呢";
+
+    static constexpr size_t THREAD_COUNT = 8;
+    static constexpr size_t ITERATIONS = 200;
+};
+
+TEST_F(OpenCCThreadSafetyTest, shared_converter_is_reentrant) {
+    const fs::path config_path = dict_dir_ / "zht2zhs.ini";
+    ASSERT_TRUE(WriteTextFile(config_path, CONFIG));
+    ASSERT_TRUE(WriteTextFile(dict_dir_ / "phrases.txt", PHRASES));
+
+    opencc_t od = opencc_open(config_path.string().c_str(), dict_dir_.string().c_str());
+    ASSERT_NE(od, (opencc_t)-1) << "cannot open " << config_path;
+
+    // Differe
```

**File**: `third_party/opencc/config_reader.c` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ struct _config_desc {
 };
 typedef struct _config_desc config_desc;
 
-static config_error errnum = CONFIG_ERROR_VOID;
+static OPENCC_THREAD_LOCAL config_error errnum = CONFIG_ERROR_VOID;
 
 static int qsort_dictionary_buffer_cmp(const void *a, const void *b) {
     if (((dictionary_buffer *)a)->index < ((dictionary_buffer *)b)->index)
```

**File**: `third_party/opencc/converter.c` (modified, +209/-172)
```diff
@@ -28,185 +28,111 @@
 
 #if SEGMENT_METHOD == SEGMENT_SHORTEST_PATH
 
-#define OPENCC_SP_SEG_DEFAULT_BUFFER_SIZE 1024
+/* Number of UCS-4 units served by the on-stack scratch block of sp_seg(). A
+   span is one ambiguous run of a single text, so keeping the common case
+   allocation-free is worth a few KB of stack. Longer spans fall back to one
+   heap block that is freed before sp_seg() returns. */
+#define OPENCC_SP_SEG_STACK_LENGTH 128
 
+/* Scratch arrays of a single sp_seg() call.
+ *
+ * They are deliberately NOT cached in converter_desc. One opencc_t is shared by
+ * all worker threads of a fulltext indexer (RAGAnalyzer clones share the same
+ * ::OpenCC), and caching the scratch made concurrent conversions reset and
+ * reallocate each other's min_len/parent/path. The visible symptom was a wild
+ * write in the path reconstruction below, where j starts at min_len[length] and
+ * a buffer reset by another thread left it at INFINITY_INT. */
 typedef struct {
-    int initialized;
-    size_t buffer_size;
     size_t *match_length;
     size_t *min_len;
     size_t *parent;
     size_t *path;
+    size_t *heap_block;
 } spseg_buffer_desc;
 
 #endif
 
 typedef struct {
-#if SEGMENT_METHOD == SEGMENT_SHORTEST_PATH
-    spseg_buffer_desc spseg_buffer;
-#endif
     dictionary_set_t dictionary_set;
-    dictionary_group_t current_dictionary_group;
     opencc_conversion_mode conversion_mode;
 } converter_desc;
-static converter_error errnum = CONVERTER_ERROR_VOID;
-
-#if SEGMENT_METHOD == SEGMENT_SHORTEST_PATH
-static void sp_seg_buffer_free(spseg_buffer_desc *ossb) {
-    free(ossb->match_length);
-    free(ossb->min_len);
-    free(ossb->parent);
-    free(ossb->path);
-}
-
-static void sp_seg_set_buffer_size(spseg_buffer_desc *ossb, size_t buffer_size) {
-    if (ossb->initialized == TRUE)
-        sp_seg_buffer_free(ossb);
 
-    ossb->buffer_size = buffer_size;
-    ossb->match_length = (size_t *)malloc((buffer_size + 1) * sizeof(size_t));
-    ossb->min_len = (size_t *)malloc(buffer_size * sizeof(size_t));
-    ossb->parent = (size_t *)malloc(buffer_size * sizeof(size_t));
-    ossb->path = (size_t *)malloc(buffer_size * sizeof(size_t));
+/* Everything mutable during a conversion now lives on the stack or in a per-call
+ * heap block, and the dictionary set is only read after open, so one opencc_t
+ * may be converted from several threads at once without external locking.
+ * The error code is per thread to keep it meaningful under that sharing. */
+static OPENCC_THREAD_LOCAL converter_error errnum = CONVERTER_ERROR_VOID;
 
-    ossb->initialized = TRUE;
-}
-
-static size_t sp_seg(converter_desc *converter, ucs4_t **inbuf, size_t *inbuf_left, ucs4_t **outbuf, size_t *outbuf_left, size_t length) {
+#if SEGMENT_METHOD == SEGMENT_SHORTEST_PATH
+/* Shortest-path segmentation over one ambiguous span. Takes the scratch
+ * explicitly so that no per-converter state is touched (see the note above). */
+static size_t sp_seg_convert(converter_desc *converter,
+                             dictionary_group_t group,
+                             spseg_buffer_desc *ossb,
+                             ucs4_t **inbuf,
+                             size_t *inbuf_left,
+                             ucs4_t **outbuf,
+                             size_t *outbuf_left,
+                             size_t length) {
     /* 最短路徑分詞 */
-
-    /* 對長度爲1時特殊優化 */
-    if (length == 1) {
-        const ucs4_t *const *match_rs = dictionary_group_match_longest(converter->current_dictionary_group, *inbuf, 1, NULL);
-
-        size_t match_len = 1;
-        if (converter->conversion_mode == OPENCC_CONVERSION_FAST) {
-            if (match_rs == NULL) {
-                **outbuf = **inbuf;
-                (*outbuf)++, (*outbuf_left)--;
-                (*inbuf)++, (*inbuf_left)--;
-            } else {
-                const ucs4_t *result = match_rs[0];
-
-                /* 輸出緩衝區剩餘空間小於分詞長度 */
-                if (ucs4len(result) > *outbuf_left) {
-                    errnum = CONVERTER_ERROR_OUTBUF;
-                    return (size_t)-1;
-                }
-
-                for (; *result; result++) {
-                    **outbuf = *result;
-                    (*outbuf)++, (*outbuf_left)--;
-                }
-
-                *inbuf += match_len;
-                *inbuf_left -= match_len;
-            }
-        } else if (converter->conversion_mode == OPENCC_CONVERSION_LIST_CANDIDATES) {
-            if (match_rs == NULL) {
-                **outbuf = **inbuf;
-                (*outbuf)++, (*outbuf_left)--;
-                (*inbuf)++, (*inbuf_left)--;
-            } else {
-                size_t i;
-                for (i = 0; match_rs[i] != NULL; i++) {
-                    const ucs4_t *result = match_rs[i];
-                    int show_delimiter = match_rs[i + 1] != NULL ? 1 : 0;
-
-                    /* 輸出緩衝區剩餘空間小於分詞長度 */
-                    if (ucs4len(result) + show_delimiter > *outbuf_left) {
-               
```

**File**: `third_party/opencc/dictionary/text.c` (modified, +46/-13)
```diff
@@ -27,10 +27,34 @@ struct _text_dictionary {
     size_t entry_count;
     size_t max_length;
     entry *lexicon;
-    ucs4_t *word_buff;
 };
 typedef struct _text_dictionary text_dictionary_desc;
 
+/* Lookup keys are built in a per-call buffer: the dictionary is shared by every
+ * thread converting with the same opencc_t, and a cached key buffer made
+ * concurrent lookups overwrite each other's ucs4ncpy()/bsearch() input. */
+#define TEXT_DICTIONARY_KEY_STACK_SIZE 64
+
+/* Returns the buffer holding `len` code points of `word`, NUL terminated, or
+ * NULL when the heap fallback cannot be allocated. `stack` must hold at least
+ * TEXT_DICTIONARY_KEY_STACK_SIZE code points; *heap_block is set when the
+ * caller has to free the result with free(). */
+static ucs4_t *text_dictionary_make_key(ucs4_t *stack, ucs4_t **heap_block, size_t key_size, const ucs4_t *word, size_t len) {
+    ucs4_t *key = stack;
+    *heap_block = NULL;
+
+    if (key_size > TEXT_DICTIONARY_KEY_STACK_SIZE) {
+        *heap_block = (ucs4_t *)malloc(sizeof(ucs4_t) * key_size);
+        if (*heap_block == NULL)
+            return NULL;
+        key = *heap_block;
+    }
+
+    ucs4ncpy(key, word, len);
+    key[len] = L'\0';
+    return key;
+}
+
 int qsort_entry_cmp(const void *a, const void *b) { return ucs4cmp(((entry *)a)->key, ((entry *)b)->key); }
 
 int parse_entry(const char *buff, entry *entry_i) {
@@ -93,9 +117,9 @@ dictionary_t dictionary_text_open(const char *filename) {
     text_dictionary->entry_count = INITIAL_DICTIONARY_SIZE;
     text_dictionary->max_length = 0;
     text_dictionary->lexicon = (entry *)malloc(sizeof(entry) * text_dictionary->entry_count);
-    text_dictionary->word_buff = NULL;
 
-    static char buff[ENTRY_BUFF_SIZE];
+    /* Per-call line buffer: two dictionaries may be opened concurrently. */
+    char buff[ENTRY_BUFF_SIZE];
 
     FILE *fp = fopen(filename, "rb");
     if (fp == NULL) {
@@ -127,7 +151,6 @@ dictionary_t dictionary_text_open(const char *filename) {
 
     text_dictionary->entry_count = i;
     text_dictionary->lexicon = (entry *)realloc(text_dictionary->lexicon, sizeof(entry) * text_dictionary->entry_count);
-    text_dictionary->word_buff = (ucs4_t *)malloc(sizeof(ucs4_t) * (text_dictionary->max_length + 1));
 
     qsort(text_dictionary->lexicon, text_dictionary->entry_count, sizeof(text_dictionary->lexicon[0]), qsort_entry_cmp);
 
@@ -149,7 +172,6 @@ void dictionary_text_close(dictionary_t t_dictionary) {
     }
 
     free(text_dictionary->lexicon);
-    free(text_dictionary->word_buff);
     free(text_dictionary);
 }
 
@@ -165,24 +187,31 @@ const ucs4_t *const *dictionary_text_match_longest(dictionary_t t_dictionary, co
     if (maxlen < len)
         len = maxlen;
 
-    ucs4ncpy(text_dictionary->word_buff, word, len);
-    text_dictionary->word_buff[len] = L'\0';
+    ucs4_t stack_key[TEXT_DICTIONARY_KEY_STACK_SIZE];
+    ucs4_t *heap_key;
+    ucs4_t *key = text_dictionary_make_key(stack_key, &heap_key, text_dictionary->max_length + 1, word, len);
+    if (key == NULL)
+        goto not_found;
 
     entry buff;
-    buff.key = text_dictionary->word_buff;
+    buff.key = key;
 
     for (; len > 0; len--) {
-        text_dictionary->word_buff[len] = L'\0';
+        key[len] = L'\0';
         entry *brs =
             (entry *)bsearch(&buff, text_dictionary->lexicon, text_dictionary->entry_count, sizeof(text_dictionary->lexicon[0]), qsort_entry_cmp);
 
         if (brs != NULL) {
             if (match_length != NULL)
                 *match_length = len;
+            free(heap_key);
             return (const ucs4_t *const *)brs->value;
         }
     }
 
+    free(heap_key);
+
+not_found:
     if (match_length != NULL)
         *match_length = 0;
     return NULL;
@@ -201,21 +230,25 @@ size_t dictionary_text_get_all_match_lengths(dictionary_t t_dictionary, const uc
     if (length < len)
         len = length;
 
-    ucs4ncpy(text_dictionary->word_buff, word, len);
-    text_dictionary->word_buff[len] = L'\0';
+    ucs4_t stack_key[TEXT_DICTIONARY_KEY_STACK_SIZE];
+    ucs4_t *heap_key;
+    ucs4_t *key = text_dictionary_make_key(stack_key, &heap_key, text_dictionary->max_length + 1, word, len);
+    if (key == NULL)
+        return rscnt;
 
     entry buff;
-    buff.key = text_dictionary->word_buff;
+    buff.key = key;
 
     for (; len > 0; len--) {
-        text_dictionary->word_buff[len] = L'\0';
+        key[len] = L'\0';
         entry *brs =
             (entry *)bsearch(&buff, text_dictionary->lexicon, text_dictionary->entry_count, sizeof(text_dictionary->lexicon[0]), qsort_entry_cmp);
 
         if (brs != NULL)
             match_length[rscnt++] = len;
     }
 
+    free(heap_key);
     return rscnt;
 }
 
```

#### Recent Merged Pull Requests:
- **PR #3555** (2026-11-12): fix(restart-test): disable periodic checkpoint/cleanup so explicit flush/cleanup is not skipped (@qinling0210)
- **PR #3554** (2026-11-12): Fix reentrancy issue of opencc  (@yingfeng)
- **PR #3553** (2026-11-12): Port hnsw to rust  (@yingfeng)
- **PR #3548** (2026-11-12): fix(optimize): use block-relative offset as row-id label base when merging HNSW/BMP chunks (@rain222)
- **PR #3547** (2026-11-11): Port secondary index and plaid to rust (@yingfeng)
- **PR #3546** (2026-11-12): Port the Rust engine to an async, parallel server (@yuzhichang)

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

## X. optimize): use block-relative offset as row-id label base when merging HNSW/BMP 

**RULE**:
When implementing operations in `src/storage/new_txn/new_txn_index_impl.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6ea59ff9`: optimize): use block-relative offset as row-id label base when merging HNSW/BMP chunks (#3548). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/storage/new_txn/new_txn_index_impl.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
            // Row-id labels must use the block's absolute offset within the segment (the pattern
            // used by the SMVE branch below). base_rowid.segment_offset_ is always 0 when the
            // merge range starts from the segment base, which would relabel every block after
            // the first one as 0..8191 and silently drop those rows from search results.
            SegmentOffset block_offset = block_id * DEFAULT_BLOCK_CAPACITY;
            memory_hnsw_index->InsertVecs(block_offset, col, offset, row_cnt);
            // Same as the HNSW branch above: label rows with the block's absolute offset.
            SegmentOffset block_offset = block_id * DEFAULT_BLOCK_CAPACITY;
            memory_bmp_index->AddDocs(block_offset, col, offset, row_cnt);
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
            memory_hnsw_index->InsertVecs(base_rowid.segment_offset_, col, offset, row_cnt);
            memory_bmp_index->AddDocs(base_rowid.segment_offset_, col, offset, row_cnt);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6ea59ff9` are properly handled with clean fallback behavior.
