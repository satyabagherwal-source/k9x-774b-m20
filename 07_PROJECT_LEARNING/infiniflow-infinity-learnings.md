> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `5d27942c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T09:54:33.105Z  
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
> **Harvest Timestamp**: 2026-10-19T09:54:33.098Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4740 stars

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

### Incident Patch 1: `807af1b0` (2026-09-04)
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
+                    }
+                    WalCmdCheckpointV2 *checkpoint_cmd = nullptr;
+                    if (backward_entry->IsCheckPoint(checkpoint_cmd)) {
+                        // GetOffset() after reading the checkpoint backward is the checkpoint's start offset.
+                        // A checkpoint stored after the bad entry means the bad entry is already covered by it.
+                        ignore_bad_entry = (backward_iter->GetOffset() > bad_offset);
+                        break;
+                    }
+                }
+            }
+            if (ignore_bad_entry) {
+                // The bad entry is covered by a checkpoint further on in the same file, so it is not part of
+                // the region replay reads. Leave the file untouched and stop looking for an older checkpoint:
+                // this file already carries one that replay can start from.
+                LOG_WARN(fmt::format("Ignoring bad wal entry {}@{} (before a checkpoint in the same file
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
+    std::filesystem::create_directories(GetFullWalDir());
+    const std::string wal_file = std::string(GetFullWalDir()) + "/wal.log";
+    MockWalFile(wal_file, "catalog", "META_123.full.json");
+
+    const std::vector<i64> offsets = WalEntryOffsets(wal_file);
+    ASSERT_FALSE(offsets.empty());
+    const auto size_before = std::filesystem::file_size(wal_file);
+    CorruptEntry(wal_file, offsets[0]);
+
+    WalListIterator iterator({wal_file});
+    EXPECT_EQ(ReplayToFirstCheckpoint(iterator), 123ul);
+    EXPECT_EQ(std::filesystem::file_size(wal_file), size_before);
+}
+
+// Damage in a file that holds no checkpoint: the file is truncated at the first bad entry and replay
+// continues into the older file, which still carries the checkpoint.
+TEST_F(WalEntryTest, DamagedEntryTruncatesWalFile) {
+    RemoveDbDirs();
+    std::filesystem::create_directories(GetFullWalDir());
+    const std::string wal_file1 = std::string(GetFullWalDir()) + "/wal.log";
+    const std::string wal_file2 = std::string(GetFullWalDir()) + "/wal2
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

**File**: `src/unit_test/storage/invertedindex/search/query_match_ut.cpp` (modified, +50/-0)
```diff
@@ -34,6 +34,7 @@ import :txn_state;
 import :new_txn_manager;
 import :new_txn;
 import :data_block;
+import :fulltext_score_result_heap;
 
 import logical_type;
 import column_def;
@@ -158,6 +159,55 @@ TEST_P(QueryMatchTest, phrase) {
     }
 }
 
+TEST_P(QueryMatchTest, bmw_many_terms) {
+    CreateDBAndTable(db_name_, table_name_);
+    CreateIndex(db_name_, table_name_, index_name_, "standard");
+    std::mt19937 rng(42);
+    auto pick = [&rng] { return fmt::format("term{:03d} ", rng() % (1 + rng() % 300)); };
+    auto words = [&pick](u32 n) {
+        std::string s;
+        for (u32 i = 0; i < n; ++i) {
+            s += pick();
+        }
+        return s;
+    };
+    for (u32 seg = 0; seg < 4; ++seg) {
+        datas_.clear();
+        for (u32 i = 0; i < 1500; ++i) {
+            datas_.push_back({std::to_string(seg * 1500 + i), "title", words(40)});
+        }
+        InsertData(db_name_, table_name_);
+    }
+
+    NewTxnManager *txn_mgr = InfinityContext::instance().storage()->new_txn_manager();
+    auto *txn = txn_mgr->BeginTxn(std::make_unique<std::string>("query match"), TransactionType::kRead);
+    auto [table_info, status] = txn->GetTableInfo(db_name_, table_name_);
+    std::shared_ptr<IndexReader> index_reader;
+    status = txn->GetFullTextIndexReader(db_name_, table_name_, index_reader);
+    EXPECT_TRUE(status.ok());
+    QueryBuilder query_builder(table_info);
+    query_builder.Init(index_reader);
+    SearchDriver driver(query_builder.GetColumn2Analyzer(), "text");
+
+    constexpr u32 topn = 10;
+    FullTextQueryContext context(FulltextSimilarity::kBM25, BM25Params{}, MinimumShouldMatchOption{}, RankFeaturesOption{}, topn);
+    context.early_term_algo_ = EarlyTermAlgo::kBMW;
+    context.query_tree_ = driver.ParseSingleWithFields("text", words(200));
+    std::unique_ptr<DocIterator> doc_iterator = query_builder.CreateSearch(context);
+    ASSERT_EQ(doc_iterator->GetType(), DocIteratorType::kBMWIterator);
+
+    float scores[topn];
+    RowID row_ids[topn];
+    FullTextScoreResultHeap result_heap(topn, scores, row_ids);
+    while (doc_iterator->Next()) {
+        if (result_heap.AddResult(doc_iterator->Score(), doc_iterator->DocID())) {
+            doc_iterator->UpdateScoreThreshold(result_heap.GetScoreThreshold());
+        }
+    }
+    EXPECT_EQ(result_heap.GetResultSize(), topn);
+    EXPECT_TRUE(txn_mgr->CommitTxn(txn).ok());
+}
+
 void QueryMatchTest::CreateDBAndTable(const std::string &db_name, const std::string &table_name) {
     std::vector<std::shared_ptr<ColumnDef>> column_defs;
     {
```

---

### Incident Patch 3: `7badfd94` (2026-07-30)
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
+    // Without this, a reader could still be iterating the old map when CheckGc frees it.
+    while (rcu_reader_count_.load(std::memory_order_acquire) > 0) {
+        std::this_thread::yield();
+    }
+
     // Schedule old read_map for garbage collection
     // Cannot delete immediately - readers may still be using it
     deleted_map_list_.push_back(deleted_map);
@@ -929,6 +951,12 @@ void RcuMap<Key, Value>::CheckGc(u64 min_delete_time) {
     }
 
     for (auto &deleted_map : map_need_delete) {
+        // RCU: Wait for any in-flight readers to finish before freeing old maps.
+        // CheckSwapInLock already waited, but there may be readers that started before
+        // the swap and haven't finished yet.
+        while (rcu_reader_count_.load(std::memory_order_acquire) > 0) {
+            std::this_thread::yield();
+        }
         delete deleted_map.deleted_entries_;
         delete deleted_map.map_;
     }
@@ -991,20 +1019,31 @@ void RcuMap<Key, Value>::emplace(const Key &key, Args &&...args) {
 
 template <typename Key, typename Value>
 u32 RcuM
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
@@ -210,13 +244,51 @@ void MemoryIndexer::AsyncInsertBottom(const std::shared_ptr<ColumnVector> &colum
     auto inverter = std::make_shared<ColumnInverter>(provider, column_lengths_);
     inverter->InitAnalyzer(this->analyzer_);
     auto func = [this, task, inverter, append_batch](int id) {
-        // LOG_INFO(fmt::format("online inverter {} begin", id));
-        size_t column_length_sum = inverter->InvertColumn(task->column_vector_, task->row_offset_, task->row_count_, task->start_doc_id_);
-        term_cnt_ += column_length_sum;
-        inverter->MergePrepare();
-        inverter->Sort();
-        this->ring_sorted_.Put(task->task_seq_, inverter);
-        // LOG_INFO(fmt::format("online inverter {} end", id));
+        try {
+            size_t column_length_sum = inverter->InvertColumn(task->column_vector_, task->row_offset_, task->row_count_, task->start_doc_id_);
+            term_cnt_ += column_length_sum;
+            inverter->MergePrepare();
+            inverter->Sort();

```

**File**: `src/storage/new_txn/new_txn_index_impl.cpp` (modified, +8/-0)
```diff
@@ -859,7 +859,11 @@ NewTxn::AppendMemIndex(SegmentIndexMeta &segment_index_meta, BlockID block_id, c
                 std::shared_ptr<std::string> index_dir = segment_index_meta.GetSegmentIndexDir();
                 auto base_name = fmt::format("ft_{:016x}", base_row_id.ToUint64());
                 auto full_path = fmt::format("{}/{}", InfinityContext::instance().config()->DataDir(), *index_dir);
+                auto [db_name, table_name] = segment_index_meta.table_index_meta().table_meta().GetDBTableName();
                 memory_indexer = std::make_unique<MemoryIndexer>(full_path, base_name, base_row_id, index_fulltext->flag_, index_fulltext->analyzer_);
+                memory_indexer->db_name_ = db_name;
+                memory_indexer->table_name_ = table_name;
+                memory_indexer->index_name_ = *index_fulltext->index_name_;
                 need_to_update_ft_segment_ts = true;
                 mem_index->SetFulltextIndex(memory_indexer);
             } else {
@@ -1336,7 +1340,11 @@ Status NewTxn::PopulateFtIndexInner(std::shared_ptr<IndexBase> index_base,
             RowID base_row_id(segment_index_meta.segment_id(), block_id * block_capacity);
             auto base_name = fmt::format("ft_{:016x}", base_row_id.ToUint64());
             auto full_path = fmt::format("{}/{}", InfinityContext::instance().config()->DataDir(), *index_dir);
+            auto [db_name, table_name] = segment_index_meta.table_index_meta().table_meta().GetDBTableName();
             memory_indexer = std::make_shared<MemoryIndexer>(full_path, base_name, base_row_id, index_fulltext->flag_, index_fulltext->analyzer_);
+            memory_indexer->db_name_ = db_name;
+            memory_indexer->table_name_ = table_name;
+            memory_indexer->index_name_ = *index_fulltext->index_name_;
             LOG_INFO(fmt::format("PopulateFtIndexInner created memory_indexer, base_name: {}", base_name));
         }
         BlockMeta block_meta(block_id, segment_meta);
```

#### Recent Merged Pull Requests:
- **PR #3525** (2026-10-13): fix(ci): replace removed quay.io/minio image with pgsty/silo (@qinling0210)
- **PR #3524** (2026-10-13): fix(sdk): a NOT clause must not swallow the following AND/OR clauses (@qinling0210)
- **PR #3507** (2026-10-16): fix(optimizer): only extract regex runs every match contains (@Taranum01)
- **PR #3504** (2026-09-23): Add sparsegram analyzer for regex queries (@yingfeng)
- **PR #3503** (2026-09-23): fix(fulltext): avoid repeated UTF-8 validation in RAG replacement (@zhouyuchong)
- **PR #3501** (2026-10-09): Update version to 0.7.4 (@qinling0210)

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

## X. corrupt WAL handling: out-of-bounds reads and over-aggressive purge (#3429)

**RULE**:
When implementing operations in `src/storage/wal/wal_entry_impl.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `807af1b0`: corrupt WAL handling: out-of-bounds reads and over-aggressive purge (#3429). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/storage/wal/wal_entry_impl.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    // entry->size_ is read from the on-disk header and is not trustworthy on its own; it is also what indexes
    // into ptr below, so bound it against the frame (max_bytes) the caller handed us before touching
    // ptr + entry->size_. Without this, a torn header can drive the reads past the end of the buffer.
    if (entry->size_ <= static_cast<i32>(sizeof(WalEntryHeader)) || entry->size_ > max_bytes) {
        LOG_WARN(fmt::format("WalEntry size_ {} out of range for a frame of {} bytes", entry->size_, max_bytes));
        return nullptr;
    }
            // The commands are serialized after the header and have not been parsed yet, so cmds_ is empty
            // here; referencing cmds_[0] would index past its end and crash. Log the header fields only.
            std::string error_msg = fmt::format("txn_id: {}, entry_size: {} checksum mismatch, expected: {}, actual: {}",
        auto entry = Next();
        if (entry.get() == nullptr) {
            // Next() reports a corrupt entry by returning nullptr without advancing, so looping on HasNext()
            // alone would spin forever. Stop at the first corrupt entry.
            LOG_WARN(fmt::format("Stop reading {} at a co
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
            std::string error_msg = fmt::format("Command: {}, txn_id: {}, entry_size: {} checksum mismatch, expected: {}, actual: {}",
                                                WalCmd::WalCommandTypeToString(entry->cmds_[0]->GetType()),
        entries.emplace_back(Next());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `807af1b0` are properly handled with clean fallback behavior.
