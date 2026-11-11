> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `b078219d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T04:00:47.414Z  
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
> **Harvest Timestamp**: 2026-11-09T04:00:47.406Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4762 stars

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

### Incident Patch 1: `b078219d` (2026-11-08)
**Commit Message**: Rewrite the engine in Rust: SQL, storage, WAL and indexes at parity with the C++ reference, enforced by conformance, byte and cross-engine gates.

## What

A Rust rewrite of the engine, developed as a separate workspace
(`rust_engine/`) with the C++ tree untouched. Goal: the same SQL, the
same wire protocols and the *same files on disk* — either engine can
open a directory the other wrote.

- `rust_engine/` — 13 crates (`storage`, `catalog`, `txn`, `parser`,
`planner`, `expression`, `index`, `analyzer`, `analyzer-ffi`,
`executor`, `server`, `cli`, `common`) + docs.
- `RUST_REWRITE_PLAN.md` — scope, gates and current status.
- `.github/workflows/rust_engine.yml` — CI: a reference/rewrite x
amd64/arm64 matrix that runs one test definition against both engines,
plus the cross-engine format gate.

## Verification (see `rust_engine/docs/`)

| Gate | What it checks | Status |
|---|---|---|
| A — SQL | the 175-file `.slt` suite | 1754/1754 statements, 129/129
errors, 1560/1560 queries |
| B — SDK / wire | unmodified Python and Go SDKs, HTTP | green |
| C — persistence | restart, crash recovery, cross-engine reads |
regular cases green; one heavy import profile still needs a CI-class
machi

**File**: `.github/workflows/rust_engine.yml` (added, +655/-0)
```diff
@@ -0,0 +1,655 @@
+name: rust_engine
+
+# CI for the Rust rewrite (RUST_REWRITE_PLAN.md M0/M6).
+#
+# This workflow tests the rewrite alone: the reference engine, the
+# cross-engine format gate and the C++ suites belong to the reference's own
+# workflows (tests.yml / slow_tests.yml), so nothing here builds C++.
+#
+# Each suite is written once and run per architecture; every trigger covers
+# both amd64 and arm64.
+
+on:
+  push:
+    paths:
+      - 'rust_engine/**'
+      - 'python/restart_test/**'
+      - 'python/test_pysdk/**'
+      - 'tools/run_restart_test.py'
+      - '.github/workflows/rust_engine.yml'
+  pull_request:
+    paths:
+      - 'rust_engine/**'
+      - 'python/restart_test/**'
+      - 'python/test_pysdk/**'
+      - 'go/**'
+      - 'tools/run_restart_test.py'
+      - '.github/workflows/rust_engine.yml'
+  schedule:
+    - cron: '0 18 * * *' # nightly: the arm64 lane
+  workflow_dispatch:
+
+concurrency:
+  group: rust-engine-${{ github.ref }}
+  cancel-in-progress: true
+
+env:
+  # Cases the rewrite cannot run yet, one pytest node id per line. There is no
+  # reference cell to leave untouched here, so they are deselected from every
+  # cell; a line goes away when the gap closes. Source of truth:
+  # rust_engine/docs/GAPS.md section 1.
+  RUST_DESELECT: |
+    python/restart_test/test_cross_engine_bytes_60_storage.py::test_the_port_round_trips_through_object_storage
+
+jobs:
+  quality:
+    # Gate F: formatting, lints, licenses / advisories.
+    name: quality
+    runs-on: ubuntu-latest
+    defaults:
+      run:
+        working-directory: rust_engine
+    steps:
+      - uses: actions/checkout@v6
+        with:
+          # The lefthook step below diffs the base of the push/PR, so the
+          # history has to be there (the default depth-1 fetch has neither the
+          # base commit nor HEAD's parent).
+          fetch-depth: 0
+      - name: Install the pinned toolchain
+        run: |
+          # rust_engine/rust-toolchain.toml is the single source of truth.
+          rustup toolchain install --profile minimal
+          rustup component add rustfmt clippy
+      - name: Install clang, mold and libclang
+        # rust_engine/.cargo/config.toml builds RocksDB with clang and links
+        # with mold (`-fuse-ld=mold`), and librocksdb-sys runs bindgen, which
+        # needs libclang. Without them the build fails in its first seconds
+        # ("cannot find 'ld'", then "couldn't find any valid shared libraries
+        # matching: ['libclang.so']").
+        run: |
+          sudo apt-get update -qq
+          sudo apt-get install -y -qq clang mold libclang-dev
+          if ! command -v ld.mold >/dev/null 2>&1; then
+            sudo ln -sf "$(command -v mold)" /usr/bin/ld.mold
+          fi
+          # clang-sys (bindgen, for librocksdb-sys) needs libclang, and
+          # LIBCLANG_PATH overrides its search - so point it at the LLVM that
+          # actually ships libclang.so* (the image also carries an LLVM
+          # without the dev package, and a wrong directory is fatal).
+          so=$(ls /usr/lib/llvm-*/lib/libclang.so* 2>/dev/null | sort -V | tail -1)
+          if [ -n "$so" ]; then
+            echo "LIBCLANG_PATH=$(dirname "$so")" >> "$GITHUB_ENV"
+          fi
+      - uses: Swatinem/rust-cache@v2
+        with:
+          workspaces: rust_engine
+      - name: Collect the changed files
+        id: changed
+        working-directory: ${{ github.workspace }}
+        run: |
+          if [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
+            base="${{ github.event.pull_request.base.sha }}"
+            head="${{ github.event.pull_request.head.sha }}"
+          else
+            base="${{ github.event.before }}"
+            head="${GITHUB_SHA}"
+          fi
+          # A new branch (or a base that a force-push moved away) has no common
+          # ancestor: check the last commit instead.
+          if [ -z "${base}" ] || [ "${base}" = "0000000000000000000000000000000000000000" ] \
+             || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
+            base=$(git rev-parse "${head}^" 2>/dev/null || git rev-parse "${head}")
+          fi
+          files="${RUNNER_TEMP}/lefthook-files"
+          : > "${files}"
+          git diff --name-only -z "${base}"..."${head}" | while IFS= read -r -d '' file; do
+            if [ -f "${file}" ]; then printf '%s\0' "${file}"; fi
+          done > "${files}"
+          echo "Changed files:"
+          if [ -s "${files}" ]; then tr '\0' '\n' < "${files}"; else echo "  (none)"; fi
+          if tr '\0' '\n' < "${files}" | grep -qE '\.(c|h|hpp|cpp|cppm)$'; then
+            echo "has_cpp=1" >> "${GITHUB_OUTPUT}"
+          else
+            echo "has_cpp=0" >> "${GITHUB_OUTPUT}"
+          fi
+          echo "files=${files}" >> "${GITHUB_OUTPUT}"
+          echo "base=${base}" >> "${GITHUB_OUTPUT}"
+
+      - name: Install uv (ruff runs through `uvx`)
+        uses: astral-sh/setup-uv@v7
```

**File**: `.gitignore` (modified, +10/-0)
```diff
@@ -149,6 +149,11 @@ python/benchmark/datasets/
 .venv*/
 tmp*/
 
+# Scratch space for anything a run leaves behind: benchmark data dirs, unit
+# and functional test fixtures, engine logs, result files. Kept inside the
+# checkout so a run is reproducible from the tree alone, never in /tmp.
+.scratch/
+
 dist/
 python/infinity_sdk/infinity_sdk.egg-info/
 minio/
@@ -157,3 +162,8 @@ minio/
 !Dockerfile*
 
 vcpkg_installed/
+
+# The pysdk suite generates its fixtures under python/test/data (a copy of
+# test/data); the C++ CI copies it the same way.
+python/test/data/
+.scratch/
```

**File**: `.hooks/pre-commit` (removed, +0/-45)
```diff
@@ -1,45 +0,0 @@
-#!/usr/bin/env python3
-
-import subprocess
-
-
-def get_files():
-    return subprocess.check_output(['git', 'diff-index', '--cached',
-                                    '--name-only', 'HEAD', '--diff-filter=d']).split()
-
-
-def apply_code_style():
-    files = filter(lambda x: x.find(b'third_party') == -1, get_files())
-    files = filter(lambda x: x.find(b'src/networker/third_party/infinity_thrift') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/expression_parser.cpp') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/expression_parser.h') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/lexer.cpp') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/lexer.h') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/parser.cpp') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/parser.h') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/search_parser.cpp') == -1, files)
-    files = filter(lambda x: x.find(b'src/parser/search_parser.h') == -1, files)
-
-    files = filter(lambda x: x.endswith(b'.c') or
-                             x.endswith(b'.h') or
-                             x.endswith(b'.hpp') or
-                             x.endswith(b'.cpp') or
-                             x.endswith(b'.cppm'), files)
-    for f in files:
-        print("Apply code style to: " + str(f))
-        try:
-            subprocess.check_output(['clang-format-20', '-i', f])
-        except subprocess.CalledProcessError as e:
-            print(f"⚠️ clang-format failed for {f}: {e}")
-        try:
-            subprocess.check_output(['git', 'add', f])
-        except subprocess.CalledProcessError as e:
-            print(f"⚠️ git add failed for {f}: {e}")
-
-
-def main():
-    apply_code_style()
-
-
-if (__name__ == '__main__'):
-    main()
```

**File**: `CONTRIBUTING.md` (modified, +44/-6)
```diff
@@ -22,26 +22,64 @@ The list below mentions some contributions you can make, but it is not a complet
 ### General workflow
 
 1. Fork our GitHub repository.
-2. Clone your fork to your local machine: 
+2. Clone your fork to your local machine:
 `git clone git@github.com:<yourname>/infinity.git`
-3. Create a local branch: 
+3. Create a local branch:
 `git checkout -b my-branch`
 4. Provide sufficient information in your commit message
 `git commit -m 'Provide sufficient info in your commit message'`
 5. Commit changes to your local branch, and push to GitHub: (include necessary commit message)
 `git push origin my-branch.`
 6. Submit a pull request for review.
 
+### Git hooks (lefthook)
+
+The repository uses [lefthook](https://github.com/evilmartians/lefthook) for the
+checks that run before a commit and in CI (`.github/workflows/rust_engine.yml`,
+the `quality` job), the same way RAGFlow does.
+
+```bash
+lefthook install   # once per clone; writes .git/hooks/pre-commit
+```
+
+`git commit` then runs these jobs on the staged files:
+
+| Job | Tool |
+|---|---|
+| `clang-format` | `clang-format-20` (Clang 20+, see the build requirements) |
+| `rustfmt` | `cargo fmt` for the `rust_engine` workspace |
+| `ruff`, `ruff-format` | `uvx ruff` |
+| `end-of-file-fixer`, `trailing-whitespace`, `mixed-line-ending` | `tools/hooks/check_files.py` |
+| `check-yaml`, `check-json`, `check-case-conflict`, `check-merge-conflict` | `tools/hooks/check_files.py` |
+
+The fix-capable jobs rewrite the file and stage the result, so a commit that
+passes is already formatted. CI runs the same jobs on the files a push or a pull
+request touched with `LEFTHOOK_CHECK_ONLY=1`: nothing is rewritten and a finding
+fails the run. Run them by hand with:
+
+```bash
+LEFTHOOK_CHECK_ONLY=1 lefthook run pre-commit --all-files
+```
+
+CI runs a **second** hook after that one, the same split RAGFlow uses
+(`pre-commit`, then `web-checks`): `rust-checks` holds `cargo clippy
+--workspace --all-targets -- -D warnings`. It is not part of a commit because
+it needs a workspace compile; run it by hand when the commit touched Rust:
+
+```bash
+lefthook run rust-checks
+```
+
 ### Before filing a PR
 
-- Consider splitting a large PR into multiple smaller, standalone PRs to keep a traceable development history. 
+- Consider splitting a large PR into multiple smaller, standalone PRs to keep a traceable development history.
 - Ensure that your PR addresses just one issue, or keep any unrelated changes small.
 - Add test cases when contributing new features. They demonstrate that your code functions correctly and protect against potential issues from future changes.
-### Describing your PR 
+### Describing your PR
 
 - Ensure that your PR title is concise and clear, providing all the required information.
-- Refer to a corresponding GitHub issue in your PR description if applicable. 
+- Refer to a corresponding GitHub issue in your PR description if applicable.
 - Include sufficient design details for *breaking changes* or *API changes* in your description.
 
 ### Reviewing & merging a PR
-- Ensure that your PR passes all Continuous Integration (CI) tests before merging it.
\ No newline at end of file
+- Ensure that your PR passes all Continuous Integration (CI) tests before merging it.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ print(res)
 
 ## 🔧 Deploy Infinity using binary
 
-If you wish to deploy Infinity using binary with the server and client as separate processes, see the [Deploy infinity using binary](https://infiniflow.org/docs/dev/deploy_infinity_server) guide.
+If you wish to deploy Infinity using binary with the server and client as separate processes, see the [Deploy infinity using binary](https://infiniflow.org/docs/dev/deploy_server) guide.
 
 ## 🔧 Build from Source
 
```

**File**: `RUST_REWRITE_PLAN.md` (added, +713/-0)
```diff
@@ -0,0 +1,713 @@
+# Infinity Rust 重写计划书
+
+> 版本：v1.1（2026-10-18 迁移策略修订：D1 由「洁净室重写」改为「结构对齐的类级移植」）
+> 日期：2026-10-18
+> 基准代码：infinity `main` @ `5d27942c0`（v0.7.4 线，2026-10-19 rebase；含 regex literal extractor 上游更新）
+> 实现代码：`rust_engine/`（Cargo workspace），C++ 引擎作为参考实现（oracle）
+> 评审：codex 三轮评审（round 3 `VERDICT: APPROVE`，见附录 C）
+> 状态：**计划已定稿；实现进入收尾** —— Gate A/B/D/E/F/G 达标；Gate C 常规全绿，重档在无 `earlyoom` 的 CI 机复跑（见 §8）
+
+本文件是**唯一**的计划与状态来源。历史进展叙述已合并进 §7/§8；已实现项不再保留「待做」表述。
+
+---
+
+## 0. 摘要（Executive Summary）
+
+将 Infinity 引擎从 C++23（**约 38.3 万行 / 1,689 个源文件**，其中 8.61 万行 `.cppm`；另有单元测试约 12.8 万行）整体重写为 Rust，目标是内存安全、并发简化、行为等价与可维护性。
+
+三条技术主线：
+
+1. **并发**：以 **Tokio 多线程运行时** 替代「固定线程池 + 逐核绑核 + 私有阻塞队列」的 `TaskScheduler`，采用「async 编排 + CPU 计算下沉 Rayon」两层模型（§4.4）。
+2. **KV 存储**：RocksDB 在 Infinity 中只承担**元数据**（catalog / 计数器 / 对象清单 / rough filter / drop 墓碑），不承载行数据与索引。定义 `MetaStore` trait，唯一实现是 `rust-rocksdb`（与 C++ catalog 同一底座，§4.2）。
+3. **验收**：以现有测试资产为准 —— **173 个 SQL Logic Test**、**Python PySDK 308 个有效 `def test_`**、**Go SDK 375 用例**，外加持久化 / 并发 / 性能关卡（§8）。测试经网络连接真实服务，因此 **Thrift 线协议必须保持兼容**（`TBinaryProtocol` + `client_version == 37`）。
+
+迁移策略：**结构对齐的类级移植（structure-preserving port）**——以 C++ 类/public 方法为骨架逐类/逐方法移植（已批准的设计变更除外），C++ 单元测试随对应类一并移植，conformance testing 只作为验收而非设计来源（§4.1 D1）。新旧二进制并存，C++ 为 oracle；测试通过不等于移植完成，以 `CLASS_MAP.md` 的未闭合项为准。
+
+**当期结论**：
+
+| 维度 | 状态 |
+|---|---|
+| SQL 功能（Gate A） | ✅ 1752 statement ok / 129 statement error / 1546 query 全部通过 |
+| SDK 协议（Gate B） | ✅ 未修改的 Python / Go SDK 与 HTTP 模式全绿 |
+| 持久化恢复（Gate C） | ⚠️ 常规用例（含跨引擎兼容）全绿；仅 5.toml 重档未闭合：磁盘目录下 Rust 峰值 12.6–15 GB（C++ 9.47 GB、>30 min 未跑完），本机 30 GB + earlyoom 无法判定，需 CI 复跑 |
+| 并发稳定（Gate D） | ✅ loom + miri + ASan/TSAN + `parallel_test` |
+| 性能（Gate E） | ✅ 对 C++ golden **+4.59%**（最新；+2.93% / +4.75% 亦通过，门限 `<7%`）：insert 持平、全量 select +81%、点查 +394% |
+| 工程质量（Gate F） | ✅ fmt / clippy / deny |
+| 不变量（Gate G） | ✅ G1–G5 全部闭合 |
+| 磁盘格式（§3.1） | ✅ 全文 / 向量索引 / 稀疏 / 多向量 / 次级 / 数据块 / Catalog 均按 C++ 字节布局读写 |
+
+---
+
+## 1. 背景与目标
+
+### 1.1 背景
+
+Infinity 是面向 LLM 应用的 AI-native 数据库，提供稠密向量、稀疏向量、张量（多向量）与全文检索的混合搜索。v0.7.x 已具备完整能力，但积累了工程负担：
+
+- **并发模型复杂**：自研线程池、绑核、私有阻塞队列、`mutex`+`condvar`、fragment 树隐式依赖，难以形式化验证；TSAN 排查是常态成本。
+- **内存安全跨层**：53 处 `std::thread` 分布在 WAL / 后台任务 / 索引构建 / 网络，生命周期靠人工保证。
+- **构建沉重**：vcpkg + CMake + Clang 20 + Bison/Flex，多 target（x64-v2/v3/v4、arm64）链路长。
+
+### 1.2 目标（Goals）
+
+- **G1 内存安全**：核心路径零 `unsafe`（收敛到 FFI / SIMD 内核并集中审计）。
+- **G2 并发简化**：async/await + 结构化并发替代手工线程与条件变量。
+- **G3 行为等价**：验收测试上与 C++ 功能等价（§8），线协议兼容。
+- **G4 可维护性**：单一 Cargo workspace，模块边界清晰，编译期强制接口契约。
+- **G5 性能不退化**：关键基准达到现有 golden 水平（Gate E，`<7%`）。
+
+### 1.3 非目标（Non-Goals）
+
+- **磁盘格式兼容曾是非目标，2026-10-16 已收紧为硬要求**（§3.1）：全文倒排、向量列存储、向量索引、Catalog KV 均须与 C++ 互通。
+- 首版不重写集群/分布式能力（现有 peer/cluster 为实验性、默认关闭）。
+- 不改变 SDK 对外 API 形态（SQL / Python / Go 语义不变）。
+
+---
+
+## 2. C++ 现状评估（As-Is）
+
+### 2.1 规模（不含单元测试）
+
+> 统计口径：`src/**` 下 `.cpp/.h/.hpp` 与 `.cppm`（C++ 模块同样含实现）合并计数，`src/unit_test` 单列。
+
+| 模块 | 合计行数 | 其中 `.cppm` | 说明 |
+|---|---:|---:|---|
+| `src/storage` | 119,194 | 47,852 | KV / WAL / buffer / catalog / txn / 索引 |
+| `src/network` | 70,753 | 1,760 | Thrift / HTTP / PG / peer |
+| `src/parser` | 47,599 | 2,086 | Bison/Flex 语法 + AST（含生成代码） |
+| `src/common` | 37,816 | 8,391 | 基础设施 / 工具 / 分析器 |
+| `src/executor` | 36,781 | 6,921 | 物理算子、fragment 构建 |
+| `src/planner` | 29,428 | 6,492 | 逻辑计划、绑定、优化器 |
+| `src/function` | 19,202 | 7,538 | 标量 / 聚合函数 |
+| `src/main` | 9,826 | 2,006 | 引擎门面 / 配置 / 集群 |
+| `src/admin` | 4,690 | 67 | 管理接口 |
+| `src/expression` | 3,714 | 1,686 | 表达式 AST |
+| `src/scheduler` | 2,547 | 534 | 任务调度器 |
+| `src/bin` / `src/metrics` | 1,417 | 734 | 入口 / 指标 |
+| **引擎合计** | **382,967** | **86,067** | **1,689 个源文件** |
+| `src/unit_test` | 128,345 | 530 | GTest（约 1032 用例） |
+
+### 2.2 三大持久化底座（关键认知）
+
+三个**彼此独立**的持久化介质，重写时不可混为一谈：
+
+| 底座 | 内容 | C++ 位置 | Rust 对应 |
+|---|---|---|---|
+| **RocksDB（事务 KV）** | Catalog/元数据、ID 计数器、对象清单、rough filter、drop 墓碑 | `storage/catalog/kv_store*`、`meta/*` | `MetaStore` trait（`RocksMetaStore`） |
+| **自研 WAL** | 已提交 DDL/DML 的 redo log（CRC32 分帧） | `storage/wal/*` | `storage::wal`（格式全量移植） |
+| **自研块文件** | 列数据、MVCC `version`、索引 chunk | `storage/buffer/*`、`meta/*_impl.cpp` | `cpp_format` / `BufferManager` |
+
+要点：
+
+- **RocksDB 自身 WAL 并非全局关闭**：默认写入路径 `disable_wal=true`，但**对象清单持久化显式启用**（`KVStore::Put(..., false)` → `FlushWAL(false)`，`kv_store_impl.cpp:443,450`；调用点 `persistence_manager_impl.cpp:141`）。两条耐久性契约须分别保留。
+- RocksDB **未用列族 / 自定义比较器 / 显式 block cache**，仅默认单 CF + 字节序 + 自定义 merge operator（计数器）。
+- **MVCC 不依赖 RocksDB 快照**，而是时间戳数组：`BlockVersion.created_` / `deleted_`；更新 = 删除 + 追加。
+- 磁盘布局：`db_<id>/tbl_<id>/seg_<id>/blk_<id>/`，列文件 `<col>.col` + 变长 `<col>.out`，版本文件 `version`；块 8192 行、段 8M 行。
+- **索引文件并非统一单 `.idx`**：向量族用 per-chunk `chunk_<id>.idx`；全文用 `.dic` / `.pos` / `.spill` / `.len`（`index_defines.cppm:55`、`memory_indexer_impl.cpp:491`）。共性是「内存构建 → 落盘 → KV 记录 `ChunkIndexMetaInfo`」，但**文件集合 / 发布 / 合并 / 清理 / 恢复契约逐索引定义**。
+
+### 2.3 并发与调度模型
+
+现状（`src/s
```

**File**: `benchmark/local_infinity/fulltext/fulltext_benchmark.cpp` (modified, +40/-7)
```diff
@@ -116,6 +116,13 @@ std::shared_ptr<Infinity> CreateDbAndTable(const std::string &db_name, const std
     return infinity;
 }
 
+// Opens the directory as it stands: no database, table or index DDL, and
+// nothing dropped (CreateDbAndTable drops the table with kIgnore).
+std::shared_ptr<Infinity> ConnectExisting() {
+    Infinity::LocalInit("/var/infinity");
+    return Infinity::LocalConnect();
+}
+
 void BenchmarkImport(std::shared_ptr<Infinity> infinity, const std::string &db_name, const std::string &table_name, const std::string &import_from) {
     if (!VirtualStore::Exists(import_from)) {
         LOG_ERROR(fmt::format("Data file doesn't exist: {}", import_from));
@@ -308,7 +315,10 @@ void BenchmarkQuery(std::shared_ptr<Infinity> infinity,
                      "social custom \"harmful chemical\"",
                      "\"annual American awards\"",
                      "harmful chemical",
-                     "\"one of\""};
+                     "\"one of\"",
+                     // Multi-term (10+ OR terms): every term is a WAND cursor in the same pass.
+                     "harmful chemical social custom annual American awards one of the first world war",
+                     "national football league high school state university population family city game season team player"};
     }
 
     for (auto match_text : query_vec) {
@@ -401,11 +411,15 @@ int main(int argc, char *argv[]) {
     CLI::App app{"fulltext_benchmark"};
     // https://github.com/CLIUtils/CLI11/blob/main/examples/enum.cpp
     // Using enumerations in an option
-    enum class Mode : u8 { kInsert, kImport, kMerge, kQuery };
-    std::map<std::string, Mode> mode_map{{"insert", Mode::kInsert}, {"import", Mode::kImport}, {"merge", Mode::kMerge}, {"query", Mode::kQuery}};
+    enum class Mode : u8 { kInsert, kImport, kMerge, kQuery, kQueryOnly };
+    std::map<std::string, Mode> mode_map{{"insert", Mode::kInsert},
+                                         {"import", Mode::kImport},
+                                         {"merge", Mode::kMerge},
+                                         {"query", Mode::kQuery},
+                                         {"query-only", Mode::kQueryOnly}};
     Mode mode(Mode::kInsert);
     size_t insert_batch = 500;
-    app.add_option("--mode", mode, "Benchmark mode, one of insert, import, merge, query")
+    app.add_option("--mode", mode, "Benchmark mode, one of insert, import, merge, query, query-only")
         ->required()
         ->transform(CLI::CheckedTransformer(mode_map, CLI::ignore_case));
     app.add_option("--insert-batch", insert_batch, "batch size of each insert, valid only at insert and merge mode, default value 500");
@@ -428,10 +442,15 @@ int main(int argc, char *argv[]) {
     srcfile += "/benchmark/dbpedia-entity/corpus.jsonl";
     // srcfile += "/benchmark/enwiki.33332620.csv";
 
+    // query-only reuses the directory a previous run left behind (no DDL, no
+    // insert), so the query times are the query path alone.
+    const bool reuse = mode == Mode::kQueryOnly;
     printf("Cleanup /var/infinity\n");
-    system("rm -rf /var/infinity/data /var/infinity/log /var/infinity/persistence /var/infinity/tmp /var/infinity/wal");
+    if (!reuse) {
+        system("rm -rf /var/infinity/data /var/infinity/log /var/infinity/persistence /var/infinity/tmp /var/infinity/wal");
+    }
 
-    std::shared_ptr<Infinity> infinity = CreateDbAndTable(db_name, table_name);
+    std::shared_ptr<Infinity> infinity = reuse ? ConnectExisting() : CreateDbAndTable(db_name, table_name);
 
     switch (mode) {
         case Mode::kInsert: {
@@ -466,11 +485,25 @@ int main(int argc, char *argv[]) {
             BenchmarkMoreQuery(infinity, db_name, table_name, query_opts, vocab);
             break;
         }
+        case Mode::kQueryOnly: {
+            std::vector<std::string> vocab;
+            if (query_opts.terms_ > 0) {
+                vocab = LoadVocabulary(srcfile, 1000, 20000);
+                if (vocab.size() < query_opts.terms_) {
+                    LOG_ERROR(fmt::format("Vocabulary too small: {} < {} (--terms)", vocab.size(), query_opts.terms_));
+                    break;
+                }
+            }
+            BenchmarkMoreQuery(infinity, db_name, table_name, query_opts, vocab);
+            break;
+        }
         default: {
             printf("Unsupported benchmark mode: %u\n", static_cast<u8>(mode));
         }
     }
-    sleep(10);
+    if (!reuse) {
+        sleep(10);
+    }
 
     Infinity::LocalUnInit();
 }
```

**File**: `docs/references/pysdk_api_reference.md` (modified, +395/-197)
```diff
@@ -86,8 +86,9 @@ If you have deployed Infinity as a separate server and installed the Infinity cl
 
 ```python
 import infinity
+
 # If Infinity is deployed on the local machine, use infinity.LOCAL_HOST to replace <SERVER_IP_ADDRESS>
-infinity_object = infinity.connect(infinity.NetworkAddress("192.168.1.101", 23817)) 
+infinity_object = infinity.connect(infinity.NetworkAddress("192.168.1.101", 23817))
 ```
 
 ---
@@ -121,7 +122,7 @@ infinity_object.disconnect()
 ### create_database
 
 ```python
-infinity_object.create_database(db_name, conflict_type = ConflictType.Error, comment = None)
+infinity_object.create_database(db_name, conflict_type=ConflictType.Error, comment=None)
 ```
 
 Creates a database with a specified name.
@@ -172,29 +173,34 @@ Additional comment for the database to create.
 
 ```python
 # Create a database named 'my_database':
-# If the specified database already exists, raise an error. 
+# If the specified database already exists, raise an error.
 infinity_object.create_database("my_database")
 ```
 
 ```python
 # Create a database named 'my_database':
-# If the specified database already exists, raise an error (same as above). 
-infinity_object.create_database("my_database", infinity.common.ConflictType.Error, comment="Database One")
+# If the specified database already exists, raise an error (same as above).
+infinity_object.create_database(
+    "my_database", infinity.common.ConflictType.Error, comment="Database One"
+)
 ```
 
 ```python
 from infinity.common import ConflictType
+
 # Create a database named 'my_database':
-# If the specified database already exists, silently ignore the operation and proceed. 
-infinity_object.create_database("my_database", ConflictType.Ignore, comment="Database One")
+# If the specified database already exists, silently ignore the operation and proceed.
+infinity_object.create_database(
+    "my_database", ConflictType.Ignore, comment="Database One"
+)
 ```
 
 ---
 
 ### drop_database
 
 ```python
-infinity_object.drop_database(db_name, conflict_type = ConflictType.Error)
+infinity_object.drop_database(db_name, conflict_type=ConflictType.Error)
 ```
 
 Deletes a database by its name.
@@ -237,18 +243,19 @@ A structure containing the following attributes:
 
 ```python
 # Delete a database named 'my_database':
-# If the specified database does not exist, raise an error. 
+# If the specified database does not exist, raise an error.
 infinity_object.drop_database("my_database")
 ```
 
 ```python
 # Delete a database named 'my_database':
-# If the specified database does not exist, raise an error (same as above). 
+# If the specified database does not exist, raise an error (same as above).
 infinity_object.drop_database("my_database", infinity.common.ConflictType.Error)
 ```
 
 ```python
 from infinity.common import ConflictType
+
 # Delete a database named 'my_database':
 # If the specified database does not exist, silently ignore the operation and proceed.
 infinity_object.drop_database("my_database", ConflictType.Ignore)
@@ -278,8 +285,8 @@ A structure containing the following attributes:
 #### Examples
 
 ```python
-res = infinity_object.list_databases() 
-print(res.db_names) # ['my_database', 'database_1']
+res = infinity_object.list_databases()
+print(res.db_names)  # ['my_database', 'database_1']
 ```
 
 ---
@@ -305,7 +312,7 @@ A structure containing the following attributes:
 #### Examples
 
 ```python
-res = infinity_object.show_database('my_database')
+res = infinity_object.show_database("my_database")
 ```
 
 ---
@@ -342,7 +349,7 @@ db_object = infinity_object.get_database("my_database")
 ### create_table
 
 ```python
-db_object.create_table(table_name, columns_definition, conflict_type = ConflictType.Error)
+db_object.create_table(table_name, columns_definition, conflict_type=ConflictType.Error)
 ```
 
 Creates a table with a specified name and defined columns.
@@ -521,12 +528,11 @@ You can build a HNSW index on the vector column to speed up the match_dense sear
 :::
 
 ```python
-# Create a table with a vector column only:  
+# Create a table with a vector column only:
 # - `vector`: The column is a vector column
 # - `128`: The vector dimension
 # - `float`: The primitive data type of the vectors. Can be `float`/`float32`, `float16`, `bfloat16`, `uint8` or `int8`
 db_object.create_table("my_table", {"c1": {"type": "vector,128,float"}})
-
 ```
 
 ##### Create a table with a multi-vector column only
@@ -536,12 +542,11 @@ You can build an HNSW index on the multi-vector column to accelerate match_dense
 :::
 
 ```python
-# Create a table with a multi-vector column only:  
+# Create a table with a multi-vector column only:
 # - `multivector`: The column is a multi-vector column
 # - `128`: The basic vector dimension
 # - `float`: The primitive data type of the basic vectors. Can be `float`/`float32`, `float16`, `bfloat16`, `uint8` or `int8`
 db_object.create_table("my_table", {"c1": {"type": "multivector,128,float"}})
-
 ```
 
 ##### Create a tab
```

#### Recent Merged Pull Requests:
- **PR #3541** (2026-11-08): Rust rewrite: the rust_engine port of the engine (@yuzhichang)
- **PR #3540** (2026-11-05): fix(txn): report concurrent checkpoint/cleanup as skipped instead of failing (@qinling0210)
- **PR #3539** (2026-11-04): fix(cleanup): remove only the dirs of dropped entities (@qinling0210)
- **PR #3538** (2026-11-02): CI: Fix no tar file in artifacts (@myf-bee)
- **PR #3536** (2026-11-05): Update version to 0.7.5 (@qinling0210)
- **PR #3535** (2026-11-01): feat(search): heap-based block-max WAND as the default top-k early-termination iterator (@yingfeng)

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

## X. Rewrite the engine in Rust: SQL, storage, WAL and indexes at parity with the C++

**RULE**:
When implementing operations in `.github/workflows/rust_engine.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b078219d`: Rewrite the engine in Rust: SQL, storage, WAL and indexes at parity with the C++ reference, enforced by conformance, byte and cross-engine gates.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/rust_engine.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
name: rust_engine

# CI for the Rust rewrite (RUST_REWRITE_PLAN.md M0/M6).
#
# This workflow tests the rewrite alone: the reference engine, the
# cross-engine format gate and the C++ suites belong to the reference's own
# workflows (tests.yml / slow_tests.yml), so nothing here builds C++.
#
# Each suite is written once and run per architecture; every trigger covers
# both amd64 and arm64.

on:
  push:
    paths:
      - 'rust_engine/**'
      - 'python/restart_test/**'
      - 'python/test_pysdk/**'
      - 'tools/run_restart_test.py'
      - '.github/workflows/rust_engine.yml'
  pull_request:
    paths:
      - 'rust_engine/**'
      - 'python/restart_test/**'
      - 'python/test_pysdk/**'
      - 'go/**'
      - 'tools/run_restart_test.py'
      - '.github/workflows/rust_engine.yml'
  schedule:
    - cron: '0 18 * * *' # nightly: the arm64 lane
  workflow_dispatch:

concurrency:
  group: rust-engine-${{ github.ref }}
  cancel-in-progress: true

env:
  # Cases the rewrite cannot run yet, one pytest node id per line. There is no
  # reference cell to leave untouched here, so they are deselected from every
  # cell; a line goes away when the gap closes. Source of truth:
  # rust_en
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b078219d` are properly handled with clean fallback behavior.
