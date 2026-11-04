> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `1c3abda1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T00:24:31.763Z  
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
> **Harvest Timestamp**: 2026-11-04T00:24:31.756Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4758 stars

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

### Incident Patch 1: `8c81b068` (2026-11-02)
**Commit Message**: fix(storage): make block map access thread-safe and look up block metas by block id (#3533)

**File**: `src/executor/operator/physical_scan/physical_match_sparse_scan_impl.cpp` (modified, +3/-0)
```diff
@@ -434,6 +434,9 @@ void PhysicalMatchSparseScan::ExecuteInnerT(DistFunc *dist_func,
         Bitmask bitmask;
 
         BlockMeta *block_meta = block_index->GetBlockMeta(segment_id, block_id);
+        if (block_meta == nullptr) [[unlikely]] {
+            UnrecoverableError(fmt::format("MatchSparseScan: block not found. segment_id: {}, block_id: {}", segment_id, block_id));
+        }
         LOG_DEBUG(fmt::format("MatchSparseScan: segment_id: {}, block_id: {}", segment_id, block_id));
 
         std::tie(row_cnt, status) = block_meta->GetRowCnt1();
```

**File**: `src/executor/operator/physical_scan/physical_match_tensor_scan_impl.cpp` (modified, +4/-1)
```diff
@@ -1270,7 +1270,10 @@ void GetRerankerScore(std::vector<MatchTensorRerankDoc> &rerank_docs,
         const BlockID block_id = segment_offset / DEFAULT_BLOCK_CAPACITY;
         const BlockOffset block_offset = segment_offset % DEFAULT_BLOCK_CAPACITY;
         ColumnVector column_vec;
-        BlockMeta *block_meta = block_index->new_segment_block_index_.at(segment_id).block_map().at(block_id).get();
+        BlockMeta *block_meta = block_index->GetBlockMeta(segment_id, block_id);
+        if (block_meta == nullptr) [[unlikely]] {
+            UnrecoverableError(fmt::format("MatchTensor rerank: block not found. segment_id: {}, block_id: {}", segment_id, block_id));
+        }
         ColumnMeta column_meta(column_id, *block_meta);
         auto [block_row_cnt, status] = block_meta->GetRowCnt1();
         if (!status.ok()) {
```

**File**: `src/executor/operator/physical_scan/physical_table_scan_impl.cpp` (modified, +6/-0)
```diff
@@ -135,6 +135,9 @@ void PhysicalTableScan::ExecuteInternal(QueryContext *query_context, TableScanOp
         BlockMeta *current_block_meta = block_index->GetBlockMeta(segment_id, block_id);
 
         std::optional<NewTxnGetVisibleRangeState> &range_state = table_scan_function_data_ptr->get_visible_range_state_;
+        if (current_block_meta == nullptr) [[unlikely]] {
+            UnrecoverableError(fmt::format("TableScan: block not found. segment_id: {}, block_id: {}", segment_id, block_id));
+        }
         if (!range_state) {
             // TODO
             range_state = NewTxnGetVisibleRangeState();
@@ -153,6 +156,9 @@ void PhysicalTableScan::ExecuteInternal(QueryContext *query_context, TableScanOp
                                           block_ids_idx,
                                           block_ids_count));
                     ++block_ids_idx;
+                    // Drop the range state of the skipped block, otherwise the next block would be
+                    // read with this block's visible ranges (the state is only rebuilt when empty).
+                    range_state.reset();
                     continue;
                 } else {
                     LOG_TRACE(fmt::format("TableScan: block_ids_idx: {}, block_ids.size(): {}, not skipped after apply FastRoughFilter",
```

**File**: `src/storage/catalog/meta/segment_meta.cppm` (modified, +0/-1)
```diff
@@ -84,7 +84,6 @@ public:
     Status CommitBlock(BlockID block_id, TxnTimeStamp commit_ts);
 
     std::tuple<std::vector<BlockID> *, Status> GetBlockIDs1();
-    std::tuple<std::vector<BlockID> *, Status> GetBlockIDs1(TxnTimeStamp commit_ts);
 
     std::tuple<size_t, Status> GetRowCnt1();
 
```

**File**: `src/storage/catalog/meta/segment_meta_impl.cpp` (modified, +13/-16)
```diff
@@ -189,22 +189,27 @@ Status SegmentMeta::AddBlockWithID(TxnTimeStamp commit_ts, BlockID block_id) {
 }
 
 std::pair<BlockID, Status> SegmentMeta::AddBlockID1(TxnTimeStamp commit_ts) {
-    Status status;
-
     BlockID block_id = 0;
     {
-        std::vector<BlockID> *block_ids_ptr = nullptr;
-        std::tie(block_ids_ptr, status) = GetBlockIDs1(commit_ts);
-        if (!status.ok()) {
-            return {INVALID_BLOCK_ID, status};
+        // Hold the lock across the whole read-modify-write: otherwise two appends of the same
+        // segment can both read the same last id and hand out the same one, and push_back can
+        // grow the vector while another thread is iterating it.
+        std::lock_guard<std::mutex> lock(mtx_);
+        if (!block_ids1_) {
+            block_ids1_ = infinity::GetTableSegmentBlocks(&kv_instance_,
+                                                          table_meta_.db_id_str(),
+                                                          table_meta_.table_id_str(),
+                                                          segment_id_,
+                                                          begin_ts_,
+                                                          commit_ts);
         }
-        block_id = block_ids_ptr->empty() ? 0 : block_ids_ptr->back() + 1;
+        block_id = block_ids1_->empty() ? 0 : block_ids1_->back() + 1;
         block_ids1_->push_back(block_id);
     }
 
     std::string block_id_key = KeyEncode::CatalogTableSegmentBlockKey(table_meta_.db_id_str(), table_meta_.table_id_str(), segment_id_, block_id);
     std::string commit_ts_str = fmt::format("{}", commit_ts);
-    status = kv_instance_.Put(block_id_key, commit_ts_str);
+    Status status = kv_instance_.Put(block_id_key, commit_ts_str);
     if (!status.ok()) {
         return {0, status};
     }
@@ -230,14 +235,6 @@ std::tuple<std::vector<BlockID> *, Status> SegmentMeta::GetBlockIDs1() {
     return {&*block_ids1_, Status::OK()};
 }
 
-std::tuple<std::vector<BlockID> *, Status> SegmentMeta::GetBlockIDs1(TxnTimeStamp commit_ts) {
-    if (!block_ids1_) {
-        block_ids1_ =
-            infinity::GetTableSegmentBlocks(&kv_instance_, table_meta_.db_id_str(), table_meta_.table_id_str(), segment_id_, begin_ts_, commit_ts);
-    }
-    return {&*block_ids1_, Status::OK()};
-}
-
 std::tuple<size_t, Status> SegmentMeta::GetRowCnt1() {
     std::lock_guard<std::mutex> lock(mtx_);
     if (row_cnt_) {
```

**File**: `src/storage/common/block_index.cppm` (modified, +2/-1)
```diff
@@ -35,7 +35,8 @@ public:
     std::unique_ptr<SegmentMeta> segment_meta_;
 
 private:
-    mutable std::vector<std::unique_ptr<BlockMeta>> block_map_;
+    mutable std::mutex block_map_mtx_;
+    mutable std::vector<std::unique_ptr<BlockMeta>> block_map_; // only used in function block_map()
 };
 
 export struct BlockIndex {
```

**File**: `src/storage/common/block_index_impl.cpp` (modified, +10/-4)
```diff
@@ -41,6 +41,7 @@ SegmentOffset NewSegmentSnapshot::segment_offset() const {
 }
 
 const std::vector<std::unique_ptr<BlockMeta>> &NewSegmentSnapshot::block_map() const {
+    std::lock_guard<std::mutex> lock(block_map_mtx_);
     if (block_map_.size()) {
         return block_map_;
     }
@@ -68,7 +69,7 @@ void BlockIndex::NewInit(const std::shared_ptr<TableMeta> &table_meta) {
         RecoverableError(status);
     }
     for (SegmentID segment_id : *segment_ids_ptr) {
-        NewSegmentSnapshot &segment_snapshot = new_segment_block_index_.emplace(segment_id, NewSegmentSnapshot()).first->second;
+        NewSegmentSnapshot &segment_snapshot = new_segment_block_index_[segment_id];
         segment_snapshot.segment_meta_ = std::make_unique<SegmentMeta>(segment_id, *table_meta_);
     }
 }
@@ -105,11 +106,16 @@ BlockMeta *BlockIndex::GetBlockMeta(u32 segment_id, u16 block_id) const {
     if (seg_it == new_segment_block_index_.end()) {
         return nullptr;
     }
-    const auto &blocks_info = seg_it->second;
-    if (blocks_info.block_map().size() <= block_id) {
+    // block_map() is sorted by id (GetTableSegmentBlocks sorts the ids) but holds only the blocks
+    // visible to this transaction, so block_id is a key, not a position in the vector.
+    const std::vector<std::unique_ptr<BlockMeta>> &block_map = seg_it->second.block_map();
+    auto it = std::lower_bound(block_map.begin(), block_map.end(), block_id, [](const std::unique_ptr<BlockMeta> &block_meta, BlockID id) {
+        return block_meta->block_id() < id;
+    });
+    if (it == block_map.end() || (*it)->block_id() != block_id) {
         return nullptr;
     }
-    return blocks_info.block_map()[block_id].get();
+    return it->get();
 }
 void IndexIndex::Insert(std::string index_name, std::shared_ptr<NewIndexSnapshot> new_index_snapshot) {
     new_index_snapshots_vec_.push_back(new_index_snapshot.get());
```

---

### Incident Patch 2: `1c3abda1` (2026-11-03)
**Commit Message**: fix(wal): recycle checkpointed wal.log.* files after the checkpoint entry is synced (#3534)

1. Recycle checkpointed wal.log.* files 
2. Flush and fsync WAL entries

**File**: `src/storage/io/local_file_handle.cppm` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ import global_resource_usage;
 
 namespace infinity {
 
-export enum class FileAccessMode { kWrite, kRead, kMmapRead, kInvalid };
+export enum class FileAccessMode { kWrite, kAppend, kRead, kMmapRead, kInvalid };
 
 export class LocalFileHandle {
 public:
```

**File**: `src/storage/io/local_file_handle_impl.cpp` (modified, +6/-4)
```diff
@@ -36,7 +36,7 @@ namespace infinity {
 LocalFileHandle::~LocalFileHandle() {
     Status status = Sync();
     if (!status.ok()) {
-        return;
+        UnrecoverableError(fmt::format("Fail to sync file {} before closing it: {}", path_, status.message()));
     }
 
     if (fd_ == -1) {
@@ -78,7 +78,7 @@ Status LocalFileHandle::Close() {
 }
 
 Status LocalFileHandle::Append(const void *buffer, u64 nbytes) {
-    if (access_mode_ != FileAccessMode::kWrite) {
+    if (access_mode_ != FileAccessMode::kWrite && access_mode_ != FileAccessMode::kAppend) {
         UnrecoverableError(fmt::format("File: {} isn't open.", path_));
     }
     i64 written = 0;
@@ -146,11 +146,13 @@ std::tuple<char *, size_t, Status> LocalFileHandle::MmapRead(const std::string &
 Status LocalFileHandle::Unmmap(const std::string &name) { return Status::OK(); }
 
 Status LocalFileHandle::Sync() {
-    if (access_mode_ != FileAccessMode::kWrite) {
+    if (access_mode_ != FileAccessMode::kWrite && access_mode_ != FileAccessMode::kAppend) {
         return Status::OK();
     }
 
-    fsync(fd_);
+    if (fsync(fd_) == -1) {
+        return Status::IOError(fmt::format("Can't sync file {}: {}", path_, strerror(errno)));
+    }
     return Status::OK();
 }
 
```

**File**: `src/storage/io/virtual_store_impl.cpp` (modified, +4/-0)
```diff
@@ -127,6 +127,10 @@ std::tuple<std::unique_ptr<LocalFileHandle>, Status> VirtualStore::Open(const st
             fd = open(path.c_str(), O_RDWR | O_CREAT, 0666);
             break;
         }
+        case FileAccessMode::kAppend: {
+            fd = open(path.c_str(), O_RDWR | O_CREAT | O_APPEND, 0666);
+            break;
+        }
         case FileAccessMode::kMmapRead: {
             UnrecoverableError("Unsupported now.");
             break;
```

**File**: `src/storage/wal/log_file.cppm` (modified, +2/-2)
```diff
@@ -47,8 +47,8 @@ public:
 
     static std::string TempWalFilename();
 
-    // max_commit_ts is the largest commit ts before the latest checkpoint
-    // static void RecycleWalFile(TxnTimeStamp max_commit_ts, const std::string &wal_dir);
+    // Deletes every rotated wal.log.<ts> file whose ts is covered by the checkpoint at ckp_ts.
+    static void Recycle(TxnTimeStamp ckp_ts, const std::string &wal_dir);
 };
 
 } // namespace infinity
```

**File**: `src/storage/wal/log_file_impl.cpp` (modified, +15/-15)
```diff
@@ -90,20 +90,20 @@ std::string WalFile::WalFilename(TxnTimeStamp max_commit_ts) { return fmt::forma
 
 std::string WalFile::TempWalFilename() { return std::string(WAL_FILE_TEMP_FILE); }
 
-// /**
-//  * @brief Gc the old wal files.
-//  * Only delete the wal.log.* files. the wal.log file is current wal file.
-//  * Check if the wal.log.* files are too old.
-//  * if * is less than the max_commit_ts, we will delete it.
-//  */
-// void WalFile::RecycleWalFile(TxnTimeStamp max_commit_ts, const std::string &wal_dir) {
-//     auto [cur_wal_info, wal_infos] = ParseWalFilenames(wal_dir);
-//     for (const auto &wal_info : wal_infos) {
-//         if (wal_info.max_commit_ts_ <= max_commit_ts) {
-//             LOG_INFO(fmt::format("WalManager::Checkpoint delete wal file: {}", wal_info.path_));
-//             VirtualStore::DeleteFile(wal_info.path_);
-//         }
-//     }
-// }
+// Deletes the rotated wal.log.<ts> files covered by the checkpoint at ckp_ts. The current wal.log is
+// not part of the rotated set, so it is never touched.
+void WalFile::Recycle(TxnTimeStamp ckp_ts, const std::string &wal_dir) {
+    auto [cur_wal_info, wal_infos] = ParseWalFilenames(wal_dir);
+    for (const auto &wal_info : wal_infos) {
+        if (wal_info.max_commit_ts_ < ckp_ts) {
+            Status status = VirtualStore::DeleteFile(wal_info.path_);
+            if (status.ok()) {
+                LOG_INFO(fmt::format("WalManager::Checkpoint delete wal file: {}", wal_info.path_));
+            } else {
+                LOG_WARN(fmt::format("Failed to delete checkpointed wal file {}: {}", wal_info.path_, status.message()));
+            }
+        }
+    }
+}
 
 } // namespace infinity
\ No newline at end of file
```

**File**: `src/storage/wal/wal_manager.cppm` (modified, +8/-2)
```diff
@@ -15,6 +15,7 @@
 export module infinity_core:wal_manager;
 
 import :blocking_queue;
+import :local_file_handle;
 import :log_file;
 import :options;
 
@@ -99,6 +100,8 @@ public:
     TxnTimeStamp LastCheckpointTS() const;
     void SetLastCheckpointTS(TxnTimeStamp new_last_ckp_ts);
 
+    void RecycleWalFile(TxnTimeStamp ckp_ts);
+
     std::vector<std::shared_ptr<std::string>> GetDiffWalEntryString(TxnTimeStamp timestamp) const;
     void UpdateCommitState(TxnTimeStamp commit_ts, i64 wal_size);
 
@@ -132,8 +135,11 @@ private:
     BlockingQueue<NewTxn *> new_wait_flush_{"WalManager"};
 
     // Only Flush thread access following members
-    std::ofstream ofs_{};
-    FlushOptionType flush_option_{FlushOptionType::kOnlyWrite};
+    // The current wal file
+    std::unique_ptr<LocalFileHandle> wal_handle_{nullptr};
+    // Kept only for configuration compatibility. It is never read: NewFlush() supports a single
+    // behavior and always flushes + fsyncs the WAL, no matter which FlushOptionType is configured.
+    [[maybe_unused]] FlushOptionType flush_option_{FlushOptionType::kOnlyWrite};
     std::unique_ptr<BottomExecutor> bottom_executor_{nullptr};
 
     // Flush and Checkpoint threads access following members
```

**File**: `src/storage/wal/wal_manager_impl.cpp` (modified, +43/-27)
```diff
@@ -20,6 +20,7 @@ import :new_txn_manager;
 import :new_txn;
 import :storage;
 import :virtual_store;
+import :local_file_handle;
 import :infinity_context;
 import :data_access_state;
 import :status;
@@ -79,10 +80,11 @@ void WalManager::Start() {
         VirtualStore::MakeDirectory(wal_dir_);
     }
     // TODO: recovery from wal checkpoint
-    ofs_ = std::ofstream(wal_path_, std::ios::app | std::ios::binary);
-    if (!ofs_.is_open()) {
-        UnrecoverableError(fmt::format("Failed to open wal file: {}", wal_path_));
+    auto [wal_handle, open_status] = VirtualStore::Open(wal_path_, FileAccessMode::kAppend);
+    if (!open_status.ok()) {
+        UnrecoverableError(fmt::format("Failed to open wal file {}: {}", wal_path_, open_status.message()));
     }
+    wal_handle_ = std::move(wal_handle);
     LOG_INFO(fmt::format("Open wal file: {}", wal_path_));
 
     wal_size_ = 0;
@@ -120,7 +122,7 @@ void WalManager::Stop() {
         UnrecoverableError("WAL manager stop failed: txn manager is nullptr");
     }
 
-    ofs_.close();
+    wal_handle_.reset();
     LOG_INFO("WAL manager is stopped.");
 }
 
@@ -144,6 +146,13 @@ void WalManager::SetLastCheckpointTS(TxnTimeStamp new_last_ckp_ts) {
     return;
 }
 
+void WalManager::RecycleWalFile(TxnTimeStamp ckp_ts) {
+    if (ckp_ts == 0 || ckp_ts == UNCOMMIT_TS) {
+        UnrecoverableError(fmt::format("Unexpected checkpoint ts to recycle wal files: {}", ckp_ts));
+    }
+    WalFile::Recycle(ckp_ts, wal_dir_);
+}
+
 std::vector<std::shared_ptr<std::string>> WalManager::GetDiffWalEntryString(TxnTimeStamp start_timestamp) const {
 
     std::vector<std::shared_ptr<std::string>> log_strings;
@@ -260,6 +269,9 @@ void WalManager::NewFlush() {
 
         LOG_TRACE(fmt::format("Attempt to write {} logs", txn_batch.size()));
 
+        // Begin ts of the checkpoint written by this batch (0: none), assigned after the swap so that it
+        // names the file the checkpoint entry was really written to.
+        TxnTimeStamp last_ckp_begin_ts{0};
         for (const auto &txn : txn_batch) {
             if (txn == nullptr) {
                 // terminate entry
@@ -291,6 +303,13 @@ void WalManager::NewFlush() {
                                      txn->CommitTS(),
                                      txn->TxnID()));
                 this->SwapWalFile(max_commit_ts_, true);
+                if (txn->BeginTS() > last_ckp_begin_ts) {
+                    last_ckp_begin_ts = txn->BeginTS();
+                } else {
+                    LOG_WARN(fmt::format("Checkpoint begin ts {} is not newer than the recorded {}, keep the recorded ts",
+                                         txn->BeginTS(),
+                                         last_ckp_begin_ts));
+                }
             }
 
             for (const std::shared_ptr<WalCmd> &cmd : entry->cmds_) {
@@ -308,7 +327,7 @@ void WalManager::NewFlush() {
                                                act_size,
                                                entry->ToString()));
             }
-            ofs_.write(buf->data(), ptr - buf->data());
+            wal_handle_->Append(buf->data(), ptr - buf->data());
 
             if (InfinityContext::instance().GetServerRole() == NodeRole::kLeader) {
                 if (cluster_manager == nullptr) {
@@ -326,19 +345,11 @@ void WalManager::NewFlush() {
             break;
         }
 
-        switch (flush_option_) {
-            case FlushOptionType::kFlushAtOnce: {
-                ofs_.flush();
-                break;
-            }
-            case FlushOptionType::kOnlyWrite: {
-                ofs_.flush(); // FIXME: not flush, only write
-                break;
-            }
-            case FlushOptionType::kFlushPerSecond: {
-                ofs_.flush(); // FIXME: not flush, flush per second
-                break;
-            }
+        // Appends reach the kernel during the loop above, so this fsync makes the whole batch durable.
+        // It syncs the current file; a mid-batch swap syncs the rotated one before renaming it away.
+        Status status = wal_handle_->Sync();
+        if (!status.ok()) {
+            UnrecoverableError(fmt::format("Fail to sync wal file {}: {}", wal_path_, status.message()));
         }
 
         if (InfinityContext::instance().GetServerRole() == NodeRole::kLeader) {
@@ -352,6 +363,10 @@ void WalManager::NewFlush() {
         }
         txn_batch.clear();
 
+        if (last_ckp_begin_ts != 0) {
+            RecycleWalFile(last_ckp_begin_ts);
+        }
+
         if (!VirtualStore::Exists(wal_path_)) {
             LOG_ERROR(fmt::format("WAL file: {} does not exist", wal_path_));
             LOG_ERROR(fmt::format("To list the files in WAL directory: {}", wal_dir_));
@@ -433,9 +448,8 @@ void WalManager::FlushLogByReplication(const std::vector<std::string> &synced_lo
     }
 
     for (const std::string &synced_log : synced_logs) {
-        ofs_.write(synced_log.c_str(), synced_log.size());
+        wal_handle_-
```

**File**: `src/unit_test/storage/wal/recycle_log_ut.cpp` (modified, +60/-0)
```diff
@@ -34,6 +34,7 @@ import :txn_state;
 import :new_txn;
 import :new_txn_manager;
 import :wal_manager;
+import :virtual_store;
 
 import global_resource_usage;
 import compilation_config;
@@ -117,6 +118,21 @@ TEST_P(RecycleLogTest, recycle_wal_after_delta_checkpoint) {
             status = new_txn_mgr->CommitTxn(txn);
             EXPECT_TRUE(status.ok());
         }
+        { // every rotated wal file is covered by the checkpoint, so none of them survives it
+            // The flush thread recycles after releasing the commit threads, so poll instead of asserting once.
+            const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
+            while (true) {
+                auto [temp_wal_info, wal_infos] = WalFile::ParseWalFilenames(wal_dir);
+                if (wal_infos.empty()) {
+                    break;
+                }
+                if (std::chrono::steady_clock::now() > deadline) {
+                    ADD_FAILURE() << "Still " << wal_infos.size() << " rotated wal file(s) after the checkpoint";
+                    break;
+                }
+                std::this_thread::sleep_for(std::chrono::milliseconds(50));
+            }
+        }
         infinity::InfinityContext::instance().UnInit();
 
 #ifdef INFINITY_DEBUG
@@ -151,3 +167,47 @@ TEST_P(RecycleLogTest, recycle_wal_after_delta_checkpoint) {
 #endif
     }
 }
+
+// Reclaiming drops exactly the rotated segments the checkpoint already contains, i.e. those whose max
+// commit ts is below ckp_ts. A segment at ckp_ts itself is not covered, and the current wal.log is
+// never part of the rotated set.
+TEST_P(RecycleLogTest, recycle_deletes_only_covered_segments) {
+    infinity::InfinityContext::instance().UnInit();
+    CleanupDbDirs();
+#ifdef INFINITY_DEBUG
+    infinity::GlobalResourceUsage::Init();
+#endif
+    std::shared_ptr<std::string> config_path = RecycleLogTest::test_ckp_recycle_config();
+    infinity::InfinityContext::instance().InitPhase1(config_path);
+    infinity::InfinityContext::instance().InitPhase2();
+
+    Storage *storage = infinity::InfinityContext::instance().storage();
+    WalManager *wal_manager = storage->wal_manager();
+    const std::string &wal_dir = storage->config()->WALDir();
+
+    constexpr TxnTimeStamp ckp_ts = 100;
+    ASSERT_TRUE(VirtualStore::Truncate(wal_dir + "/" + WalFile::WalFilename(ckp_ts - 2), 0).ok());
+    ASSERT_TRUE(VirtualStore::Truncate(wal_dir + "/" + WalFile::WalFilename(ckp_ts), 0).ok());
+    ASSERT_TRUE(VirtualStore::Truncate(wal_dir + "/" + WalFile::WalFilename(ckp_ts + 2), 0).ok());
+
+    wal_manager->RecycleWalFile(ckp_ts);
+
+    {
+        auto [temp_wal_info, wal_infos] = WalFile::ParseWalFilenames(wal_dir);
+        ASSERT_EQ(wal_infos.size(), 2u);
+        std::vector<TxnTimeStamp> remaining;
+        for (const auto &wal_info : wal_infos) {
+            remaining.push_back(wal_info.max_commit_ts_);
+        }
+        std::sort(remaining.begin(), remaining.end());
+        EXPECT_EQ(remaining, (std::vector<TxnTimeStamp>{ckp_ts, ckp_ts + 2}));
+    }
+
+    infinity::InfinityContext::instance().UnInit();
+
+#ifdef INFINITY_DEBUG
+    EXPECT_EQ(infinity::GlobalResourceUsage::GetObjectCount(), 0);
+    EXPECT_EQ(infinity::GlobalResourceUsage::GetRawMemoryCount(), 0);
+    infinity::GlobalResourceUsage::UnInit();
+#endif
+}
```

---

### Incident Patch 3: `cb2859bc` (2026-11-02)
**Commit Message**: CI: Fix no tar file in artifacts (#3538)

**File**: `.github/workflows/tests.yml` (modified, +3/-0)
```diff
@@ -2652,6 +2652,7 @@ jobs:
           echo "chown -R ${USER} ${GITHUB_WORKSPACE}" && sudo chown -R ${USER} ${GITHUB_WORKSPACE}
           ARTIFACTS_DIR=${RUNNER_WORKSPACE_PREFIX}/artifacts/${GITHUB_REPOSITORY}/${GITHUB_RUN_ID}
           echo "ARTIFACTS_DIR=${ARTIFACTS_DIR}" >> ${GITHUB_ENV}
+          mkdir -p ${ARTIFACTS_DIR}
           tar xzf ${ARTIFACTS_DIR}/infinity.tgz && git reset --hard && git clean -ffdx
 
       - name: Start builder container
@@ -2673,6 +2674,7 @@ jobs:
       - name: Upload artifacts
         if: ${{ !cancelled() && !failure() && steps.build.outcome == 'success' }}
         run: |
+          mkdir -p ${ARTIFACTS_DIR}
           tar -cf - cmake-build-reldeb/src/infinity cmake-build-reldeb/benchmark/local_infinity/{knn_import_benchmark,knn_query_benchmark} | tar -C ${ARTIFACTS_DIR} -xf -
 
       - name: Remove build container
@@ -2693,6 +2695,7 @@ jobs:
           echo "chown -R ${USER} ${GITHUB_WORKSPACE}" && sudo chown -R ${USER} ${GITHUB_WORKSPACE}
           ARTIFACTS_DIR=${RUNNER_WORKSPACE_PREFIX}/artifacts/${GITHUB_REPOSITORY}/${GITHUB_RUN_ID}
           echo "ARTIFACTS_DIR=${ARTIFACTS_DIR}" >> ${GITHUB_ENV}
+          mkdir -p ${ARTIFACTS_DIR}
           tar xzf ${ARTIFACTS_DIR}/infinity.tgz && git reset --hard && git clean -ffdx
           tar -C ${ARTIFACTS_DIR} -cf - cmake-build-reldeb/benchmark/local_infinity/{knn_import_benchmark,knn_query_benchmark} | tar -xf -
 
```

#### Recent Merged Pull Requests:
- **PR #3538** (2026-11-02): CI: Fix no tar file in artifacts (@myf-bee)
- **PR #3535** (2026-11-01): feat(search): heap-based block-max WAND as the default top-k early-termination iterator (@yingfeng)
- **PR #3534** (2026-11-03): fix(wal): recycle checkpointed wal.log.* files after the checkpoint entry is synced (@qinling0210)
- **PR #3533** (2026-11-02): fix(storage): make block map access thread-safe and look up block metas by block id (@qinling0210)
- **PR #3532** (2026-10-27): fix(ci): install LLVM 20 from the Ubuntu archive instead of apt.llvm.org (@qinling0210)
- **PR #3530** (2026-10-27): fix(sdk): parse chained arithmetic left to right in the Go SDK (@RaphaelFakhri)

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

## X. storage): make block map access thread-safe and look up block metas by block id 

**RULE**:
When implementing operations in `src/executor/operator/physical_scan/physical_match_sparse_scan_impl.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8c81b068`: storage): make block map access thread-safe and look up block metas by block id (#3533). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/executor/operator/physical_scan/physical_match_sparse_scan_impl.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
        if (block_meta == nullptr) [[unlikely]] {
            UnrecoverableError(fmt::format("MatchSparseScan: block not found. segment_id: {}, block_id: {}", segment_id, block_id));
        }
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8c81b068` are properly handled with clean fallback behavior.
