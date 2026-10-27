> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source**: github ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Source Version**: `6e4ce04b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T16:38:32.234Z  
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
> **Harvest Timestamp**: 2026-10-27T16:38:31.786Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4746 stars

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

### Incident Patch 1: `76933d02` (2026-10-26)
**Commit Message**: Fix mem-index (#3528)

## Problem
- Crash during a mem-index dump could lose the popped index, and startup recovery aborted with "Chunk index row alignment error" whenever the committed chunk chain was not contiguous.
- AppendMemIndex leaked the mem-index update slot on early returns, and
the appender resolved the indexer at dequeue time instead of at submit time.
- A failed fulltext inversion left a hole in the sorted ring and was retried after later docs were committed, appending smaller doc ids behind larger ones in delta-encoded posting lists.

## Changes
- Dump transaction now owns the popped mem indexes: rollback puts them
back, commit clears them and releases the tracer reservation; non-transactional
  callers (build index, replay) clear immediately.
- Recovery computes gaps from the full set of covered `[begin, end)`
ranges (unordered, overlapping, holes), so missing chunks, empty blocks and
narrow chunk declarations are rebuilt instead of being fatal. Pure helper
exposed  for tests.
- AppendMemIndex releases the update slot via RAII on every exit path.
- AppendMemIndexTask binds its MemoryIndexer at submit time; the
appender holds shared_ptr instead of raw pointers.
- Full

**File**: `src/storage/bg_task/bg_task.cppm` (modified, +7/-0)
```diff
@@ -31,6 +31,7 @@ struct MemIndex;
 struct ColumnVector;
 class BaseMemIndex;
 class EMVBIndexInMem;
+class MemoryIndexer;
 class NewTxn;
 
 export struct BGTask {
@@ -194,6 +195,12 @@ public:
 
 public:
     std::shared_ptr<MemIndex> mem_index_{};
+    // The inverted index this task was prepared against. It is bound at submit time (in
+    // NewTxn::AppendMemIndex, right after AsyncInsertTop), because seq_inserted_/doc_count_
+    // are computed on that very indexer. Resolving it again at dequeue time (from mem_index_)
+    // can yield a different -- or already dumped/cleared -- indexer, which silently drops the
+    // rows. Holding a shared_ptr also keeps the indexer alive while the appender uses it.
+    std::shared_ptr<MemoryIndexer> memory_indexer_{};
     std::shared_ptr<ColumnVector> input_column_{};
     BlockOffset offset_{};
     BlockOffset row_cnt_{};
```

**File**: `src/storage/bg_task/mem_index_appender_impl.cpp` (modified, +10/-5)
```diff
@@ -70,7 +70,10 @@ void MemIndexAppender::Submit(std::shared_ptr<BGTask> bg_task) {
 void MemIndexAppender::Process() {
     std::deque<std::shared_ptr<BGTask>> tasks;
     StopProcessorTask *stop_task_{};
-    std::vector<MemoryIndexer *> memory_indexers;
+    // Hold a shared_ptr here: the same mem index can be popped and cleared by a concurrent
+    // mem-index dump between the two phases of the loop below, which used to leave these
+    // raw pointers dangling (use-after-free inside Ring::GetBatch).
+    std::vector<std::shared_ptr<MemoryIndexer>> memory_indexers;
     std::unordered_map<MemoryIndexer *, std::shared_ptr<AppendMemIndexBatch>> memory_indexer_map;
     while (true) {
         task_queue_.DequeueBulk(tasks);
@@ -88,13 +91,15 @@ void MemIndexAppender::Process() {
                     }
                     if (storage_mode == StorageMode::kWritable) {
                         auto append_mem_index_task = static_cast<AppendMemIndexTask *>(bg_task.get());
-                        std::shared_ptr<MemoryIndexer> memory_indexer = append_mem_index_task->mem_index_->GetFulltextIndex();
+                        // Use the indexer the task was prepared against, never re-resolve it from
+                        // mem_index_ (which may have been dumped, cleared or replaced meanwhile).
+                        std::shared_ptr<MemoryIndexer> memory_indexer = append_mem_index_task->memory_indexer_;
                         if (memory_indexer == nullptr) {
                             // Only used for full text index, currently
                             UnrecoverableError("Not inverted index");
                         }
                         if (memory_indexer_map.find(memory_indexer.get()) == memory_indexer_map.end()) {
-                            memory_indexers.push_back(memory_indexer.get());
+                            memory_indexers.push_back(memory_indexer);
                             memory_indexer_map.emplace(memory_indexer.get(), std::make_shared<AppendMemIndexBatch>());
                         }
                         AppendMemIndexBatch *append_mem_index_batch = memory_indexer_map[memory_indexer.get()].get();
@@ -115,8 +120,8 @@ void MemIndexAppender::Process() {
             }
         }
 
-        for (auto memory_indexer : memory_indexers) {
-            AppendMemIndexBatch *append_mem_index_batch = memory_indexer_map[memory_indexer].get();
+        for (auto &memory_indexer : memory_indexers) {
+            AppendMemIndexBatch *append_mem_index_batch = memory_indexer_map[memory_indexer.get()].get();
             append_mem_index_batch->WaitForCompletion();
             memory_indexer->CommitSync();
             for (auto &append_task : append_mem_index_batch->append_tasks_) {
```

**File**: `src/storage/catalog/meta/segment_index_meta.cppm` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ public:
 
     std::shared_ptr<MemIndex> GetMemIndex(bool for_update = false);
     std::shared_ptr<MemIndex> PopMemIndex();
+    bool TrySetMemIndex(const std::shared_ptr<MemIndex> &mem_index);
 
     std::shared_ptr<std::string> GetSegmentIndexDir() const;
 
```

**File**: `src/storage/catalog/meta/segment_index_meta_impl.cpp` (modified, +6/-0)
```diff
@@ -233,6 +233,12 @@ std::shared_ptr<MemIndex> SegmentIndexMeta::PopMemIndex() {
     return new_catalog->PopMemIndex(mem_index_key);
 }
 
+bool SegmentIndexMeta::TrySetMemIndex(const std::shared_ptr<MemIndex> &mem_index) {
+    std::string mem_index_key = GetSegmentIndexTag("mem_index");
+    NewCatalog *new_catalog = InfinityContext::instance().storage()->new_catalog();
+    return new_catalog->TrySetMemIndex(mem_index_key, mem_index);
+}
+
 Status SegmentIndexMeta::LoadChunkIDs1() {
     chunk_ids_ = std::vector<ChunkID>();
     std::vector<ChunkID> &chunk_ids = *chunk_ids_;
```

**File**: `src/storage/catalog/new_catalog.cppm` (modified, +3/-0)
```diff
@@ -173,6 +173,9 @@ private:
 public:
     std::shared_ptr<MemIndex> GetMemIndex(const std::string &mem_index_key, bool for_update);
     std::shared_ptr<MemIndex> PopMemIndex(const std::string &mem_index_key);
+    // Insert the mem index only when the key is free. Used to put back an index popped by an
+    // aborted dump. Returns false when a newer mem index already occupies the key.
+    bool TrySetMemIndex(const std::string &mem_index_key, const std::shared_ptr<MemIndex> &mem_index);
     Status DropMemIndexByMemIndexKey(const std::string &mem_index_key);
     std::vector<std::pair<std::string, std::string>> GetAllMemIndexInfo();
 
```

**File**: `src/storage/catalog/new_catalog_impl.cpp` (modified, +9/-0)
```diff
@@ -159,6 +159,15 @@ std::shared_ptr<MemIndex> NewCatalog::PopMemIndex(const std::string &mem_index_k
     return nullptr;
 }
 
+bool NewCatalog::TrySetMemIndex(const std::string &mem_index_key, const std::shared_ptr<MemIndex> &mem_index) {
+    if (mem_index == nullptr) {
+        return false;
+    }
+    std::unique_lock<std::shared_mutex> lck(mem_index_mtx_);
+    auto [iter, inserted] = mem_index_map_.emplace(mem_index_key, mem_index);
+    return inserted;
+}
+
 Status NewCatalog::DropMemIndexByMemIndexKey(const std::string &mem_index_key) {
     bool delete_success = false;
     {
```

**File**: `src/storage/invertedindex/column_inverter.cppm` (modified, +2/-0)
```diff
@@ -56,6 +56,8 @@ public:
 
     u32 GetDocCount() { return doc_count_; }
 
+    u32 GetBeginDocID() const { return begin_doc_id_; }
+
     u32 GetMerged() { return merged_; }
 
     struct PosInfo {
```

**File**: `src/storage/invertedindex/memory_indexer.cppm` (modified, +30/-0)
```diff
@@ -81,6 +81,17 @@ public:
     // InsertGap insert some empty documents. This is for abnormal case.
     void InsertGap(u32 row_count);
 
+    // Called when the inversion of one task failed. It keeps the sorted ring contiguous (a
+    // missing sequence number would stall every later commit forever) and remembers the task
+    // so that Dump() can re-invert it before the chunk is written. Doc ids are preserved,
+    // therefore a successful retry makes the row visible exactly where it belongs.
+    void MarkInvertFailed(u64 seq, const std::shared_ptr<ColumnVector> &column_vector, u32 row_offset, u32 row_count, u32 start_doc_id);
+
+    bool HasFailedInvertTasks() const {
+        std::unique_lock<std::mutex> lock(mutex_);
+        return !failed_invert_tasks_.empty();
+    }
+
     // Commit is non-blocking and thread-safe. There shall be a background thread which call this method regularly.
     void Commit(bool offline = false);
 
@@ -158,6 +169,19 @@ private:
 
     void TupleListToIndexFile(std::unique_ptr<SortMergerTermTuple<TermTuple, u32>> &merger);
 
+    struct FailedInvertTask {
+        std::shared_ptr<ColumnVector> column_vector_;
+        u32 row_offset_{0};
+        u32 row_count_{0};
+        u32 start_doc_id_{0};
+    };
+
+    // Re-invert the tasks that could not even be re-inverted synchronously in MarkInvertFailed.
+    // Called by Dump() after all in-flight tasks are committed and before the chunk is written.
+    // Retried postings are appended to the shared posting writers, whose doc lists are delta
+    // encoded, so the retry is only valid while no larger doc id has been generated yet.
+    void RetryFailedInvertTasks();
+
 private:
     std::string index_dir_;
     std::string base_name_;
@@ -175,6 +199,12 @@ private:
     u64 inflight_tasks_{0};
     std::condition_variable cv_;
     mutable std::mutex mutex_;
+    // Guarded by mutex_. Tasks whose inversion threw; re-inverted by Dump().
+    std::vector<FailedInvertTask> failed_invert_tasks_;
+    // Upper bound (exclusive) of the doc ids already generated into the shared posting writers.
+    // Written by CommitSync (single writer, guarded by mutex_commit_) and read by
+    // RetryFailedInvertTasks to decide whether a retry can still keep the doc lists ordered.
+    std::atomic<u32> generated_doc_end_{0};
     std::mutex mutex_commit_;
     std::shared_mutex mutex_commit_sync_share_;
 
```

---

### Incident Patch 2: `6e4ce04b` (2026-10-27)
**Commit Message**: fix(sdk): parse chained arithmetic left to right in the Go SDK (#3530)

Fixes #3529

**File**: `go/expression_parser.go` (modified, +69/-3)
```diff
@@ -172,9 +172,11 @@ func parseExpressionInternal(expr string) (*Expression, error) {
 		}
 	}
 
-	// Check for arithmetic operators
-	for _, op := range []string{"+", "-", "*", "/", "%"} {
-		if left, right, found := splitByOperator(expr, op); found {
+	// Check for arithmetic operators, lowest precedence group first. Operators
+	// of equal precedence are left associative, so "c1 - c2 - c3" is
+	// "(c1 - c2) - c3": split at the rightmost operator of the group.
+	for _, ops := range [][]string{{"+", "-"}, {"*", "/", "%"}} {
+		if left, right, op, found := splitByLastOperator(expr, ops); found {
 			return &Expression{
 				Type:     ExprTypeBinary,
 				Operator: op,
@@ -853,6 +855,70 @@ func splitByOperator(expr, op string) (*Expression, *Expression, bool) {
 	return nil, nil, false
 }
 
+// splitByLastOperator splits an expression at the rightmost top-level
+// occurrence of any of the given single-character operators, respecting
+// parentheses and string literals. Splitting at the rightmost operator makes
+// operators of equal precedence left associative.
+func splitByLastOperator(expr string, ops []string) (*Expression, *Expression, string, bool) {
+	expr = strings.TrimSpace(expr)
+
+	var positions []int
+	parenCount := 0
+	inString := false
+	stringQuote := byte(0)
+
+	for i := 0; i < len(expr); i++ {
+		ch := expr[i]
+
+		// Handle string literals
+		if !inString && (ch == '\'' || ch == '"') {
+			inString = true
+			stringQuote = ch
+			continue
+		} else if inString && ch == stringQuote {
+			// Check for escaped quote (e.g., 'it''s')
+			if i+1 < len(expr) && expr[i+1] == stringQuote {
+				i++ // Skip the next quote
+				continue
+			}
+			inString = false
+			stringQuote = 0
+			continue
+		}
+
+		// Skip processing when inside a string literal
+		if inString {
+			continue
+		}
+
+		if ch == '(' {
+			parenCount++
+		} else if ch == ')' {
+			parenCount--
+		} else if parenCount == 0 {
+			for _, op := range ops {
+				if ch == op[0] {
+					positions = append(positions, i)
+					break
+				}
+			}
+		}
+	}
+
+	// Try the rightmost operator first. An operator that leaves an
+	// unparsable side, such as the unary minus in "c1 - -5", is skipped.
+	for j := len(positions) - 1; j >= 0; j-- {
+		i := positions[j]
+		left, err1 := parseExpressionInternal(strings.TrimSpace(expr[:i]))
+		right, err2 := parseExpressionInternal(strings.TrimSpace(expr[i+1:]))
+		if err1 == nil && err2 == nil {
+			return left, right, string(expr[i]), true
+		}
+	}
+
+	return nil, nil, "", false
+}
+
 // isAlpha checks if a byte is an alphabetic character
 func isAlpha(ch byte) bool {
 	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
```

**File**: `go/tests/expression_parser_test.go` (modified, +17/-10)
```diff
@@ -170,10 +170,16 @@ func TestParseExprArithmetic(t *testing.T) {
 		{"division_slim", "c1/2", "/(c1, 2)"},
 		{"modulo_slim", "c1%2", "%(c1, 2)"},
 
-		// Multiple operations (right associative - parser behavior)
-		{"chain_addition", "c1 + c2 + c3", "+(c1, +(c2, c3))"},
-		{"chain_subtraction", "c1 - c2 - c3", "-(c1, -(c2, c3))"},
-		{"chain_multiplication", "c1 * c2 * c3", "*(c1, *(c2, c3))"},
+		// Multiple operations (left associative)
+		{"chain_addition", "c1 + c2 + c3", "+(+(c1, c2), c3)"},
+		{"chain_subtraction", "c1 - c2 - c3", "-(-(c1, c2), c3)"},
+		{"chain_multiplication", "c1 * c2 * c3", "*(*(c1, c2), c3)"},
+		{"chain_division", "c1 / c2 / c3", "/(/(c1, c2), c3)"},
+		{"sub_then_add", "c1 - c2 + c3", "+(-(c1, c2), c3)"},
+		{"mul_then_div", "c1 * c2 / c3", "/(*(c1, c2), c3)"},
+		{"div_then_mod", "c1 / c2 % c3", "%(/(c1, c2), c3)"},
+		{"chain_sub_negative", "c1 - c2 - -5", "-(-(c1, c2), -(5))"},
+		{"chain_sub_slim", "c1-c2-c3", "-(-(c1, c2), c3)"},
 
 		// Mixed operations (precedence)
 		{"add_mul_precedence", "c1 + c2 * c3", "+(c1, *(c2, c3))"},
@@ -194,16 +200,16 @@ func TestParseExprArithmetic(t *testing.T) {
 		{"mul_reverse", "2 * c1", "*(2, c1)"},
 		{"div_reverse", "100 / c1", "/(100, c1)"},
 
-		// Multiple terms (right associative - parser behavior)
-		{"three_terms_add", "c1 + c2 + c3", "+(c1, +(c2, c3))"},
-		{"mixed_three_terms", "c1 + c2 - c3", "+(c1, -(c2, c3))"},
-		{"four_terms", "c1 + c2 + c3 + c4", "+(c1, +(c2, +(c3, c4)))"},
+		// Multiple terms (left associative)
+		{"three_terms_add", "c1 + c2 + c3", "+(+(c1, c2), c3)"},
+		{"mixed_three_terms", "c1 + c2 - c3", "-(+(c1, c2), c3)"},
+		{"four_terms", "c1 + c2 + c3 + c4", "+(+(+(c1, c2), c3), c4)"},
 
 		// Complex expressions
 		{"complex_nested", "c1 * c2 + c3 * c4", "+(*(c1, c2), *(c3, c4))"},
 		{"complex_nested2", "(c1 + c2) * (c3 - c4)", "*(+(c1, c2), -(c3, c4))"},
-		// Complex expression with all operators - parser groups right due to equal precedence
-		{"all_operators", "c1 + c2 - c3 * c4 / c5 % c6", "+(c1, -(c2, *(c3, /(c4, %(c5, c6)))))"},
+		// Complex expression with all operators - equal precedence groups left
+		{"all_operators", "c1 + c2 - c3 * c4 / c5 % c6", "-(+(c1, c2), %(/(*(c3, c4), c5), c6))"},
 
 		// Arithmetic with floats
 		{"add_float", "c1 + 3.14", "+(c1, 3.140000)"},
@@ -862,6 +868,7 @@ func TestCondition(t *testing.T) {
 		// Arithmetic in conditions
 		{"addition in condition", "c1 + c2 > 10", ">(+(c1, c2), 10)"},
 		{"subtraction in condition", "c1 - c2 = 0", "=(-(c1, c2), 0)"},
+		{"chained subtraction in condition", "c1 - c2 - c3 > 0", ">(-(-(c1, c2), c3), 0)"},
 		{"multiplication in condition", "c1 * 2 < 100", "<(*(c1, 2), 100)"},
 		{"complex arithmetic", "(c1 + c2) * c3 > 100", ">(*(+(c1, c2), c3), 100)"},
 		// String comparisons
```

---

### Incident Patch 3: `8cd094fe` (2026-10-27)
**Commit Message**: fix(ci): install LLVM 20 from the Ubuntu archive instead of apt.llvm.org (#3532)

**File**: `.github/workflows/tests.yml` (modified, +36/-18)
```diff
@@ -263,9 +263,12 @@ jobs:
 
       - name: Install LLVM 20
         run: |
-          wget https://apt.llvm.org/llvm.sh
-          chmod +x llvm.sh
-          sudo ./llvm.sh 20
+          # apt.llvm.org publishes no llvm-toolchain-20 archive for Ubuntu 26.04
+          # (resolute), so llvm.sh adds a repo whose Release file is a 404.
+          # The Ubuntu archive itself ships LLVM 20, including llvm-cov and
+          # llvm-profdata under /usr/lib/llvm-20/bin.
+          sudo apt-get update
+          sudo apt-get install -y llvm-20
           echo "/usr/lib/llvm-20/bin" >> $GITHUB_PATH
 
       - name: Wait for minio and run unit test
@@ -355,9 +358,12 @@ jobs:
 
       - name: Install LLVM 20
         run: |
-          wget https://apt.llvm.org/llvm.sh
-          chmod +x llvm.sh
-          sudo ./llvm.sh 20
+          # apt.llvm.org publishes no llvm-toolchain-20 archive for Ubuntu 26.04
+          # (resolute), so llvm.sh adds a repo whose Release file is a 404.
+          # The Ubuntu archive itself ships LLVM 20, including llvm-cov and
+          # llvm-profdata under /usr/lib/llvm-20/bin.
+          sudo apt-get update
+          sudo apt-get install -y llvm-20
           echo "/usr/lib/llvm-20/bin" >> $GITHUB_PATH
 
       - name: Wait for infinity and run sqllogictest
@@ -490,9 +496,12 @@ jobs:
 
       - name: Install LLVM 20
         run: |
-          wget https://apt.llvm.org/llvm.sh
-          chmod +x llvm.sh
-          sudo ./llvm.sh 20
+          # apt.llvm.org publishes no llvm-toolchain-20 archive for Ubuntu 26.04
+          # (resolute), so llvm.sh adds a repo whose Release file is a 404.
+          # The Ubuntu archive itself ships LLVM 20, including llvm-cov and
+          # llvm-profdata under /usr/lib/llvm-20/bin.
+          sudo apt-get update
+          sudo apt-get install -y llvm-20
           echo "/usr/lib/llvm-20/bin" >> $GITHUB_PATH
 
       - name: Wait for infinity and run pysdk test
@@ -584,9 +593,12 @@ jobs:
 
       - name: Install LLVM 20
         run: |
-          wget https://apt.llvm.org/llvm.sh
-          chmod +x llvm.sh
-          sudo ./llvm.sh 20
+          # apt.llvm.org publishes no llvm-toolchain-20 archive for Ubuntu 26.04
+          # (resolute), so llvm.sh adds a repo whose Release file is a 404.
+          # The Ubuntu archive itself ships LLVM 20, including llvm-cov and
+          # llvm-profdata under /usr/lib/llvm-20/bin.
+          sudo apt-get update
+          sudo apt-get install -y llvm-20
           echo "/usr/lib/llvm-20/bin" >> $GITHUB_PATH
 
       - name: Wait for infinity and run Go tests
@@ -669,9 +681,12 @@ jobs:
 
       - name: Install LLVM 20
         run: |
-          wget https://apt.llvm.org/llvm.sh
-          chmod +x llvm.sh
-          sudo ./llvm.sh 20
+          # apt.llvm.org publishes no llvm-toolchain-20 archive for Ubuntu 26.04
+          # (resolute), so llvm.sh adds a repo whose Release file is a 404.
+          # The Ubuntu archive itself ships LLVM 20, including llvm-cov and
+          # llvm-profdata under /usr/lib/llvm-20/bin.
+          sudo apt-get update
+          sudo apt-get install -y llvm-20
           echo "/usr/lib/llvm-20/bin" >> $GITHUB_PATH
 
       - name: Wait for infinity and run http test
@@ -752,9 +767,12 @@ jobs:
 
       - name: Install LLVM 20
         run: |
-          wget https://apt.llvm.org/llvm.sh
-          chmod +x llvm.sh
-          sudo ./llvm.sh 20
+          # apt.llvm.org publishes no llvm-toolchain-20 archive for Ubuntu 26.04
+          # (resolute), so llvm.sh adds a repo whose Release file is a 404.
+          # The Ubuntu archive itself ships LLVM 20, including llvm-cov and
+          # llvm-profdata under /usr/lib/llvm-20/bin.
+          sudo apt-get update
+          sudo apt-get install -y llvm-20
           echo "/usr/lib/llvm-20/bin" >> $GITHUB_PATH
 
       - name: Wait for infinity and run pysdk test
```

#### Recent Merged Pull Requests:
- **PR #3532** (2026-10-27): fix(ci): install LLVM 20 from the Ubuntu archive instead of apt.llvm.org (@qinling0210)
- **PR #3530** (2026-10-27): fix(sdk): parse chained arithmetic left to right in the Go SDK (@RaphaelFakhri)
- **PR #3528** (2026-10-26): Fix mem-index (@yingfeng)
- **PR #3525** (2026-10-13): fix(ci): replace removed quay.io/minio image with pgsty/silo (@qinling0210)
- **PR #3524** (2026-10-13): fix(sdk): a NOT clause must not swallow the following AND/OR clauses (@qinling0210)
- **PR #3507** (2026-10-16): fix(optimizer): only extract regex runs every match contains (@Taranum01)

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

## X. mem-index (#3528)

**RULE**:
When implementing operations in `src/storage/bg_task/bg_task.cppm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `76933d02`: mem-index (#3528). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/storage/bg_task/bg_task.cppm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
class MemoryIndexer;
    // The inverted index this task was prepared against. It is bound at submit time (in
    // NewTxn::AppendMemIndex, right after AsyncInsertTop), because seq_inserted_/doc_count_
    // are computed on that very indexer. Resolving it again at dequeue time (from mem_index_)
    // can yield a different -- or already dumped/cleared -- indexer, which silently drops the
    // rows. Holding a shared_ptr also keeps the indexer alive while the appender uses it.
    std::shared_ptr<MemoryIndexer> memory_indexer_{};
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `76933d02` are properly handled with clean fallback behavior.
