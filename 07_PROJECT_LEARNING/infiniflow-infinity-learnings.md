# Forensic Learning Record (Deep Inspection): infiniflow/infinity

> **Canonical Artifact**: `07_PROJECT_LEARNING/infiniflow-infinity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infiniflow/infinity](https://github.com/infiniflow/infinity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:30.679Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/infinity`
- **Description**: The AI-native database built for LLM applications, providing incredibly fast hybrid search of dense vector, sparse vector, tensor (multi-vector), and full-text.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4731 stars

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

### Core Architecture Module: `python/benchmark/clients/utils.py`
```
import os
import struct


class SparseMatrix:
    nrow: int
    ncol: int
    nnz: int
    indptr: list[int]
    indices: list[int]
    data: list[float]

    def __init__(self, nrow, ncol, nnz, indptr, indices, data):
        self.nrow = nrow
        self.ncol = ncol
        self.nnz = nnz
        self.indptr = indptr
        self.indices = indices
        self.data = data

    def at(self, i: int):
        start, end = self.indptr[i], self.indptr[i + 1]
        return self.indices[start:end], self.data[start:end]


def csr_read_all(filename: str) -> SparseMatrix:
    if not os.path.exists(filename):
        raise FileNotFoundError(f"{filename} not found")
    with open(filename, "rb") as f:
        nrow = struct.unpack("q", f.read(8))[0]
        ncol = struct.unpack("q", f.read(8))[0]
        nnz = struct.unpack("q", f.read(8))[0]
        indptr = []
        for _ in range(nrow + 1):
            indptr.append(struct.unpack("q", f.read(8))[0])
        indices = []
        for _ in range(nnz):
            indices.append(struct.unpack("i", f.read(4))[0])
        data = []
        for _ in range(nnz):
            data.append(struct.unpack("f", f.read(4))[0])
    return SparseMatrix(nrow, ncol, nnz, indptr, indices, data)


def gt_read_all(filename: str):
    if not os.path.exists(filename):
        raise FileNotFoundError(f"{filename} not found")
    with open(filename, "rb") as f:
        num = struct.unpack("i", f.read(4))[0]
        topk = struct.unpack("i", f.read(4))[0]
        gt = []
        for _ in range(num):
            row = []
            for _ in range(topk):
                row.append(struct.unpack("i", f.read(4))[0])
            gt.append(row)
    return topk, gt

def calculate_recall(gt, query_res):
    correct = 0
    for gt_row, query_row in zip(gt, query_res):
        for gt_val in gt_row:
            if gt_val in query_row:
                correct += 1
    return correct / (len(gt) * len(gt[0]))
```

### Core Architecture Module: `python/benchmark/legacy_benchmark/utils.py`
```
import os
import struct


class SparseMatrix:
    nrow: int
    ncol: int
    nnz: int
    indptr: list[int]
    indices: list[int]
    data: list[float]

    def __init__(self, nrow, ncol, nnz, indptr, indices, data):
        self.nrow = nrow
        self.ncol = ncol
        self.nnz = nnz
        self.indptr = indptr
        self.indices = indices
        self.data = data

    def at(self, i: int):
        start, end = self.indptr[i], self.indptr[i + 1]
        return self.indices[start:end], self.data[start:end]


def csr_read_all(filename: str) -> SparseMatrix:
    if not os.path.exists(filename):
        raise FileNotFoundError(f"{filename} not found")
    with open(filename, "rb") as f:
        nrow = struct.unpack("q", f.read(8))[0]
        ncol = struct.unpack("q", f.read(8))[0]
        nnz = struct.unpack("q", f.read(8))[0]
        indptr = []
        for _ in range(nrow + 1):
            indptr.append(struct.unpack("q", f.read(8))[0])
        indices = []
        for _ in range(nnz):
            indices.append(struct.unpack("i", f.read(4))[0])
        data = []
        for _ in range(nnz):
            data.append(struct.unpack("f", f.read(4))[0])
    return SparseMatrix(nrow, ncol, nnz, indptr, indices, data)


def gt_read_all(filename: str):
    if not os.path.exists(filename):
        raise FileNotFoundError(f"{filename} not found")
    with open(filename, "rb") as f:
        num = struct.unpack("i", f.read(4))[0]
        topk = struct.unpack("i", f.read(4))[0]
        gt = []
        for _ in range(num):
            row = []
            for _ in range(topk):
                row.append(struct.unpack("i", f.read(4))[0])
            gt.append(row)
        # score = []
        # for _ in range(num):
        #     row = []
        #     for _ in range(topk):
        #         row.append(struct.unpack("f", f.read(4))[0])
        #     score.append(row)
    return topk, gt
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
+    const auto [text, positions] = PCRE2GlobalReplaceWithPosition(input, R"(\W+)", " ");
+    const auto elapsed = std::chrono::steady_clock::now() - start;
+    EXPECT_EQ(text, expected);
+    ASSERT_EQ(positions.size(), text.size());
+    EXPECT_EQ(positions.back().first, input.size() - 1);
+    // Generous for a linear scan of 4 MiB, including debug builds.
+    EXPECT_LT(elapsed, std::chrono::seconds(5));
+}
+
+} // namespace infinity
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
+                                             db_meta.db_name(),
+                                             table_id_str,
+                                             table_name,
+                                             kv_instance,
+                                             begin_ts,
+                                             commit_ts,
+                                             db_meta.meta_cache());
     status = table_meta->InitSet(table_def);
     if (!status.ok()) {
         return status;
@@ -1243,7 +1260,14 @@ Status NewCatalog::GetDBFilePaths(TxnTimeStamp begin_ts, TxnTimeStamp commit_ts,
     for (size_t idx = 0; idx < table_count; ++idx) {
         const std::string &table_id_str = table_id_strs_ptr->at(idx);
         const std::string &table_name = table_names_ptr->at(idx);
-        TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, db_meta.kv_instance(), begin_ts, commit_ts, db_meta.meta_cache());
+        TableMeta table_meta(db_meta.db_id_str(),
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

**File**: `src/storage/knn_index/emvb/emvb_index_in_mem_impl.cpp` (modified, +3/-1)
```diff
@@ -98,7 +98,9 @@ void EMVBIndexInMem::Insert(const ColumnVector &column_vector,
                                                       residual_pq_subspace_num_,
                                                       residual_pq_subspace_bits_);
 
-            TableMeta table_meta(db_id_str_, table_id_str_, table_name_, &kv_instance, begin_ts, MAX_TIMESTAMP, meta_cache);
+            // Only the ids are needed here: building the EMVB index reads the segment,
+            // so the database name is left empty.
+            TableMeta table_meta(db_id_str_, "", table_id_str_, table_name_, &kv_instance, begin_ts, MAX_TIMESTAMP, meta_cache);
             SegmentMeta segment_meta(segment_id_, table_meta);
             emvb_index_->BuildEMVBIndex(begin_row_id_, row_count_, segment_meta, column_def_);
             if (emvb_index_->GetDocNum() != row_count_ || emvb_index_->GetTotalEmbeddingNum() != embedding_count_) {
```

**File**: `src/storage/new_txn/new_txn_data_impl.cpp` (modified, +13/-8)
```diff
@@ -1711,11 +1711,12 @@ Status NewTxn::CreateTableSnapshotFile(std::shared_ptr<TableSnapshotInfo> table_
 Status NewTxn::PrepareCommitImport(WalCmdImportV2 *import_cmd) {
     TxnTimeStamp commit_ts = txn_context_ptr_->commit_ts_;
     const std::string &db_id_str = import_cmd->db_id_;
+    const std::string &db_name = import_cmd->db_name_;
     const std::string &table_id_str = import_cmd->table_id_;
     const std::string &table_name = import_cmd->table_name_;
 
     WalSegmentInfo &segment_info = import_cmd->segment_info_;
-    TableMeta table_meta(db_id_str, table_id_str, table_name, this);
+    TableMeta table_meta(db_id_str, db_name, table_id_str, table_name, this);
     SegmentMeta segment_meta(segment_info.segment_id_, table_meta);
 
     Status status = table_meta.CommitSegment(segment_info.segment_id_, commit_ts);
@@ -1751,11 +1752,12 @@ Status NewTxn::PrepareCommitImport(WalCmdImportV2 *import_cmd) {
 Status NewTxn::PrepareCommitReplayImport(WalCmdImportV2 *import_cmd) {
     TxnTimeStamp commit_ts = txn_context_ptr_->commit_ts_;
     const std::string &db_id_str = import_cmd->db_id_;
+    const std::string &db_name = import_cmd->db_name_;
     const std::string &table_id_str = import_cmd->table_id_;
     const std::string &table_name = import_cmd->table_name_;
 
     WalSegmentInfo &segment_info = import_cmd->segment_info_;
-    TableMeta table_meta(db_id_str, table_id_str, table_name, this);
+    TableMeta table_meta(db_id_str, db_name, table_id_str, table_name, this);
     SegmentMeta segment_meta(segment_info.segment_id_, table_meta);
 
     Status status = table_meta.CommitSegment(segment_info.segment_id_, commit_ts);
@@ -1790,8 +1792,7 @@ Status NewTxn::CommitBottomAppend(WalCmdAppendV2 *append_cmd) {
     const std::string &db_id_str = append_cmd->db_id_;
     const std::string &table_id_str = append_cmd->table_id_;
     TxnTimeStamp commit_ts = CommitTS();
-    TableMeta table_meta(db_id_str, table_id_str, table_name, this);
-    table_meta.SetDBTableName(db_name, table_name);
+    TableMeta table_meta(db_id_str, db_name, table_id_str, table_name, this);
     std::optional<SegmentMeta> segment_meta;
     std::optional<BlockMeta> block_meta;
     size_t copied_row_cnt = 0;
@@ -1909,10 +1910,11 @@ Status NewTxn::CommitBottomAppend(WalCmdAppendV2 *append_cmd) {
 
 Status NewTxn::PrepareCommitDelete(const WalCmdDeleteV2 *delete_cmd) {
     const std::string &db_id_str = delete_cmd->db_id_;
+    const std::string &db_name = delete_cmd->db_name_;
     const std::string &table_id_str = delete_cmd->table_id_;
     const std::string &table_name = delete_cmd->table_name_;
 
-    TableMeta table_meta(db_id_str, table_id_str, table_name, this);
+    TableMeta table_meta(db_id_str, db_name, table_id_str, table_name, this);
 
     std::optional<SegmentMeta> segment_meta;
     std::optional<BlockMeta> block_meta;
@@ -1947,9 +1949,10 @@ Status NewTxn::PrepareCommitDelete(const WalCmdDeleteV2 *delete_cmd) {
 Status NewTxn::CommitBottomDelete(const WalCmdDeleteV2 *delete_cmd) {
     TxnTimeStamp commit_ts = txn_context_ptr_->commit_ts_;
     const std::string &db_id_str = delete_cmd->db_id_;
+    const std::string &db_name = delete_cmd->db_name_;
     const std::string &table_id_str = delete_cmd->table_id_;
     const std::string &table_name = delete_cmd->table_name_;
-    TableMeta table_meta(db_id_str, table_id_str, table_name, this);
+    TableMeta table_meta(db_id_str, db_name, table_id_str, table_name, this);
 
     NewTxnTableStore1 *txn_table_store = txn_store_.GetNewTxnTableStore1(db_id_str, table_id_str);
     DeleteState &delete_state = txn_table_store->delete_state();
@@ -1975,10 +1978,11 @@ Status NewTxn::CommitBottomDelete(const WalCmdDeleteV2 *delete_cmd) {
 
 Status NewTxn::RollbackDelete(const DeleteTxnStore *delete_txn_store) {
     const std::string &db_id_str = delete_txn_store->db_id_str_;
+    const std::string &db_name = delete_txn_store->db_name_;
     const std::string &table_id_str = delete_txn_store->table_id_str_;
     const std::string &table_name = delete_txn_store->table_name_;
 
-    TableMeta table_meta(db_id_str, table_id_str, table_name, this);
+    TableMeta table_meta(db_id_str, db_name, table_id_str, table_name, this);
 
     std::optional<SegmentMeta> segment_meta;
     std::optional<BlockMeta> block_meta;
@@ -2009,6 +2013,7 @@ Status NewTxn::RollbackDelete(const DeleteTxnStore *delete_txn_store) {
 Status NewTxn::PrepareCommitCompact(WalCmdCompactV2 *compact_cmd) {
     Status status;
     const std::string &db_id_str = compact_cmd->db_id_;
+    const std::string &db_name = compact_cmd->db_name_;
     const std::string &table_id_str = compact_cmd->table_id_;
     const std::string &table_name = compact_cmd->table_name_;
     TxnTimeStamp commit_ts = txn_context_ptr_->commit_ts_;
@@ -2023,7 +2028,7 @@ Status NewTxn::PrepareCommitCompact(WalCmdCompactV2 *compact_cmd) {
     WalSegmentInfo &segment_info = segment_infos[0];
     std::vector<SegmentID> new_segment_ids{segm
```

**File**: `src/storage/new_txn/new_txn_impl.cpp` (modified, +26/-13)
```diff
@@ -374,7 +374,6 @@ Status NewTxn::GetTables(const std::string &db_name, std::vector<std::shared_ptr
             return status;
         }
         std::shared_ptr<TableDetail> table_detail = std::make_shared<TableDetail>();
-        table_meta->SetDBTableName(db_name, table_name);
         status = table_meta->GetTableDetail(*table_detail);
         table_detail->create_ts_ = create_timestamp;
         output_table_array.push_back(table_detail);
@@ -1885,7 +1884,7 @@ Status NewTxn::CheckpointDB(DBMeta &db_meta, const CheckpointOption &option, Che
     for (size_t idx = 0; idx < table_count; ++idx) {
         const std::string &table_id_str = table_id_strs_ptr->at(idx);
         const std::string &table_name = table_names_ptr->at(idx);
-        TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, this);
+        TableMeta table_meta(db_meta.db_id_str(), db_meta.db_name(), table_id_str, table_name, this);
         status = this->CheckpointTable(table_meta, option, ckp_txn_store);
         if (!status.ok()) {
             return status;
@@ -2465,7 +2464,6 @@ Status NewTxn::GetTableMeta(const std::string &db_name,
     if (!status.ok()) {
         return status;
     }
-    table_meta->SetDBTableName(db_name, table_name);
     return Status::OK();
 }
 
@@ -2481,8 +2479,7 @@ Status NewTxn::GetTableMeta(const std::string &table_name,
         return status;
     }
     LOG_DEBUG(fmt::format("GetTableMeta: txn_id: {} table_id: {}", TxnID(), table_id_str));
-    table_meta = std::make_shared<TableMeta>(db_meta->db_id_str(), table_id_str, table_name, this);
-    table_meta->SetDBTableName(db_meta->db_name(), table_name);
+    table_meta = std::make_shared<TableMeta>(db_meta->db_id_str(), db_meta->db_name(), table_id_str, table_name, this);
     if (table_key_ptr) {
         *table_key_ptr = table_key;
     }
@@ -2507,7 +2504,6 @@ Status NewTxn::GetTableIndexMeta(const std::string &db_name,
     if (!status.ok()) {
         return status;
     }
-    table_meta->SetDBTableName(db_name, table_name);
     status = GetTableIndexMeta(index_name, *table_meta, table_index_meta, index_key_ptr);
     if (!status.ok()) {
         return status;
@@ -2782,7 +2778,7 @@ Status NewTxn::CommitCheckpointDB(DBMeta &db_meta, const WalCmdCheckpointV2 *che
     for (size_t idx = 0; idx < table_count; ++idx) {
         const std::string &table_id_str = table_id_strs_ptr->at(idx);
         const std::string &table_name = table_names_ptr->at(idx);
-        TableMeta table_meta(db_meta.db_id_str(), table_id_str, table_name, this);
+        TableMeta table_meta(db_meta.db_id_str(), db_meta.db_name(), table_id_str, table_name, this);
         status = CommitCheckpointTable(table_meta, checkpoint_cmd);
         if (!status.ok()) {
             return status;
@@ -2829,8 +2825,11 @@ Status NewTxn::RestoreTableFromSnapshot(const WalCmdRestoreTableSnapshot *restor
             return status;
         }
     } else {
-        table_meta =
-            std::make_shared<TableMeta>(db_meta.db_id_str(), restore_table_snapshot_cmd->table_id_, restore_table_snapshot_cmd->table_name_, this);
+        table_meta = std::make_shared<TableMeta>(db_meta.db_id_str(),
+                                                 db_meta.db_name(),
+                                                 restore_table_snapshot_cmd->table_id_,
+                                                 restore_table_snapshot_cmd->table_name_,
+                                                 this);
     }
 
     // restore metadata of the table
@@ -4769,6 +4768,7 @@ Status NewTxn::PostRollback(TxnTimeStamp abort_ts) {
             MetaCache *meta_cache = txn_mgr_->storage()->meta_cache();
             CreateIndexTxnStore *create_index_txn_store = static_cast<CreateIndexTxnStore *>(base_txn_store_.get());
             TableMeta table_meta(create_index_txn_store->db_id_str_,
+                                 create_index_txn_store->db_name_,
                                  create_index_txn_store->table_id_str_,
                                  create_index_txn_store->table_name_,
                                  kv_instance_.get(),
@@ -5259,7 +5259,10 @@ Status NewTxn::CleanupInner(const std::vector<std::shared_ptr<MetaKey>> &metas)
                 if (!status.ok()) {
                     return status;
                 }
+                // Cleanup only needs the ids, so the database name is
+                // left empty.
                 TableMeta table_meta(table_meta_key->db_id_str_,
+                                     "",
                                      table_meta_key->table_id_str_,
                                      table_meta_key->table_name_,
                                      kv_instance,
@@ -5285,8 +5288,14 @@ Status NewTxn::CleanupInner(const std::vector<std::shared_ptr<MetaKey>> &metas)
             }
             case MetaType::kSegment: {
                 auto *segment_meta_key = static_cast<SegmentMetaKey *>(meta.get());
-                Tabl
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
-            if (comment_iter->Valid() && comment_iter->key().ToString() == comment_key) {
-                comment = comment_iter->value().ToString();
+            Status comment_status = kv_instance->Get(comment_key, comment);
+            if (comment_status.ok()) {
+                // comment found
             }
 
             db_output_objs.emplace_back(db_name, std::stoull(db_value), dropped, comment);
@@ -792,13 +795,14 @@ QueryResult AdminExecutor::ShowDatabase(QueryContext *query_context, const Admin
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
+    // RocksDB via DB::OpenForReadOnly (whose DB
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
 
 Status KVInstance::Commit() {
+    if (read_only_db_ != nullptr) {
+        return Status::NotSupport("KVInstance is read-only");
+    }
     rocksdb::Status s = transaction_->Commit();
     if (!s.ok()) {
         return Status::RocksDBError(std::move(s), "rocksdb::Transaction::Commit");
@@ -169,6 +195,9 @@ Status KVInstance::Commit() {
     return Status::OK();
 }
 Status KVInstance::Rollback() {
+    if (read_only_db_ != nullptr) {
+        return Status::NotSupport("KVInstance is read-only");
+    }
     rocksdb::Status s = transaction_->Rollback();
     if (!s.ok()) {
         return Status::RocksDBError(std::move(s), "rocksdb::Transaction::Rollback");
@@ -296,11 +325,52 @@ Status KVStore::Init(const std::string &db_path) {
     return Status::OK();
 }
 
+Status KVStore::InitReadOnly(const std::string &db_path) {
+    db_path_ = db_path;
+    // Note: rocksdb::DB::OpenForReadOnly ignores options_.create_if_missing and never creates the
+    // database. Do not set it here.
+    opti
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

### Incident Patch 8: `dc7bbd22` (2026-08-05)
**Commit Message**: Support null (#3412)

### Summary

**File**: `go/tests/import_test.go` (modified, +11/-4)
```diff
@@ -998,11 +998,18 @@ func TestTableWithNotMatchedColumns(t *testing.T) {
 				t.Fatalf("Test data file does not exist: %s", filePath)
 			}
 
+			// CSV has 2 columns. When the table has fewer columns than the CSV
+			// (extra CSV columns), the import raises. When the table has more
+			// columns than the CSV, the missing columns fill with NULL (no error).
 			_, err = table.ImportData(filePath, infinity.NewImportOption())
-			if err == nil {
-				t.Error("Expected error for column count mismatch, but got nil")
-			} else {
-				t.Logf("Got expected error: %v", err)
+			if len(schema) < 2 {
+				if err == nil {
+					t.Error("Expected error for column count mismatch, but got nil")
+				} else {
+					t.Logf("Got expected error: %v", err)
+				}
+			} else if err != nil {
+				t.Errorf("Expected import to succeed by filling NULL for missing columns, got error: %v", err)
 			}
 
 			result, err := table.Output([]string{"*"}).ToResult()
```

**File**: `go/tests/knn_test.go` (modified, +4/-8)
```diff
@@ -995,7 +995,7 @@ func TestInsertMultiColumn(t *testing.T) {
 		t.Fatalf("Failed to create table: %v", err)
 	}
 
-	// Insert data without query_color column (should fail with "No default value found")
+	// Insert data without query_color column (missing nullable column fills with NULL)
 	_, err = table.Insert([]map[string]interface{}{
 		{
 			"variant_id":         "123",
@@ -1006,16 +1006,12 @@ func TestInsertMultiColumn(t *testing.T) {
 			"other_vector":       []float32{5.0, 5.0, 5.0, 5.0},
 			"query_is_recommend": "ok",
 			"query_gender":       "male",
-			// "query_color": "red", // Missing required column
+			// "query_color": "red", // Missing nullable column, filled with NULL
 			"query_price": 1.0,
 		},
 	})
-
-	// Expect error for missing required column
-	if err == nil {
-		t.Error("Expected error for missing required column 'query_color', but got none")
-	} else {
-		t.Logf("Got expected error for missing column: %v", err)
+	if err != nil {
+		t.Errorf("Expected insert to succeed by filling NULL for missing nullable column, got error: %v", err)
 	}
 
 	// Cleanup
```

**File**: `python/infinity_embedded/local_infinity/utils.py` (modified, +31/-0)
```diff
@@ -69,6 +69,22 @@ def traverse_conditions(cons, fn=None):
         parsed_expr.type = ParsedExprType.kFunction
         parsed_expr.function_expr = function_expr
 
+        return parsed_expr
+    elif isinstance(cons, exp.Not) and isinstance(cons.args['this'], exp.Is):
+        # Handle IS NOT NULL / IS NOT TRUE / IS NOT FALSE / IS NOT UNKNOWN.
+        # Only IS NOT NULL is supported; others must be rejected.
+        inner_is = cons.args['this']
+        if not isinstance(inner_is.args.get('expression'), exp.Null):
+            raise InfinityException(ErrorCode.INVALID_EXPRESSION,
+                                    f"Unsupported IS expression: {cons}. Only IS NULL / IS NOT NULL are supported.")
+        func_expr = WrapFunctionExpr()
+        func_expr.func_name = "is_not_null"
+        if fn:
+            func_expr.arguments = [fn(inner_is.this)]
+        else:
+            func_expr.arguments = [traverse_conditions(inner_is.this)]
+        parsed_expr = WrapParsedExpr(ParsedExprType.kFunction)
+        parsed_expr.function_expr = func_expr
         return parsed_expr
     elif isinstance(cons, exp.Not) and not isinstance(cons.args['this'], exp.In):
         parsed_expr = WrapParsedExpr()
@@ -169,6 +185,21 @@ def traverse_conditions(cons, fn=None):
         parsed_expr.type = ParsedExprType.kFunction
         parsed_expr.function_expr = func_expr
         return parsed_expr
+    elif isinstance(cons, exp.Is):
+        # Handle IS NULL / IS TRUE / IS FALSE / IS UNKNOWN.
+        # Only IS NULL is supported; others must be rejected.
+        if not isinstance(cons.args.get('expression'), exp.Null):
+            raise InfinityException(ErrorCode.INVALID_EXPRESSION,
+                                    f"Unsupported IS expression: {cons}. Only IS NULL / IS NOT NULL are supported.")
+        func_expr = WrapFunctionExpr()
+        func_expr.func_name = "is_null"
+        if fn:
+            func_expr.arguments = [fn(cons.this)]
+        else:
+            func_expr.arguments = [traverse_conditions(cons.this)]
+        parsed_expr = WrapParsedExpr(ParsedExprType.kFunction)
+        parsed_expr.function_expr = func_expr
+        return parsed_expr
     # in
     elif isinstance(cons, exp.In):
         left_operand = parse_expr(cons.args['this'])
```

**File**: `python/infinity_sdk/infinity/remote_thrift/utils.py` (modified, +46/-0)
```diff
@@ -305,6 +305,50 @@ def traverse_conditions(cons: exp.Condition, fn=None) -> ttypes.ParsedExpr:
         return _parse_like(cons, None)
     elif isinstance(cons, exp.Not) and isinstance(cons.args['this'], exp.Like):
         return _parse_not_like(cons.args['this'], None)
+    elif isinstance(cons, exp.Is):
+        # Handle IS [NOT] NULL / IS [NOT] TRUE / IS [NOT] FALSE / IS [NOT] UNKNOWN.
+        # sqlglot parses all of these as exp.Is nodes.
+        # Only IS NULL and IS NOT NULL are supported; others must be rejected.
+        if not isinstance(cons.args.get('expression'), exp.Null):
+            raise InfinityException(ErrorCode.INVALID_EXPRESSION,
+                                    f"Unsupported IS expression: {cons}. Only IS NULL / IS NOT NULL are supported.")
+        # Handle IS NULL: exp.Is(this=col, expression=Null())
+        parsed_expr = ttypes.ParsedExpr()
+        function_expr = ttypes.FunctionExpr()
+        function_expr.function_name = "is_null"
+        arguments = []
+        if fn:
+            expr = fn(cons.this)
+        else:
+            expr = traverse_conditions(cons.this)
+        arguments.append(expr)
+        function_expr.arguments = arguments
+        parser_expr_type = ttypes.ParsedExprType()
+        parser_expr_type.function_expr = function_expr
+        parsed_expr.type = parser_expr_type
+        return parsed_expr
+    elif isinstance(cons, exp.Not) and isinstance(cons.args['this'], exp.Is):
+        # Handle IS NOT NULL / IS NOT TRUE / IS NOT FALSE / IS NOT UNKNOWN.
+        # Only IS NOT NULL is supported; others must be rejected.
+        inner_is = cons.args['this']
+        if not isinstance(inner_is.args.get('expression'), exp.Null):
+            raise InfinityException(ErrorCode.INVALID_EXPRESSION,
+                                    f"Unsupported IS expression: {cons}. Only IS NULL / IS NOT NULL are supported.")
+        # Handle IS NOT NULL: exp.Not(this=exp.Is(this=col, expression=Null()))
+        parsed_expr = ttypes.ParsedExpr()
+        function_expr = ttypes.FunctionExpr()
+        function_expr.function_name = "is_not_null"
+        arguments = []
+        if fn:
+            expr = fn(inner_is.this)
+        else:
+            expr = traverse_conditions(inner_is.this)
+        arguments.append(expr)
+        function_expr.arguments = arguments
+        parser_expr_type = ttypes.ParsedExprType()
+        parser_expr_type.function_expr = function_expr
+        parsed_expr.type = parser_expr_type
+        return parsed_expr
     elif isinstance(cons, exp.Binary):
         parsed_expr = ttypes.ParsedExpr()
         function_expr = ttypes.FunctionExpr()
@@ -684,6 +728,8 @@ def get_remote_constant_expr_from_python_value(value) -> ttypes.ConstantExpr:
     match value:
         case str():
             constant_expression = ttypes.ConstantExpr(literal_type=ttypes.LiteralType.String, str_value=value)
+        case None:
+            constant_expression = ttypes.ConstantExpr(literal_type=ttypes.LiteralType.Null)
         case bool():
             constant_expression = ttypes.ConstantExpr(literal_type=ttypes.LiteralType.Boolean, bool_value=value)
         case int():
```

**File**: `python/test_pysdk/conftest.py` (modified, +2/-2)
```diff
@@ -110,11 +110,11 @@ def disable_items_with_mark(items, mark, reason):
         if mark in item.keywords:
             item.add_marker(skipper)
 
-@pytest.fixture
+@pytest.fixture(scope="class")
 def http(request):
     return request.config.getoption("--http")
 
-@pytest.fixture
+@pytest.fixture(scope="class")
 def suffix(request):
     if request.config.getoption("--http"):
         return "_http"
```

**File**: `python/test_pysdk/test_alter.py` (modified, +54/-6)
```diff
@@ -52,16 +52,16 @@ def test_simple_add_columns(self):
         assert res.error_code == infinity.ErrorCode.DUPLICATE_COLUMN_NAME
 
         res = table_obj.add_columns({"c3": {"type": "varchar"}})
-        assert res.error_code == infinity.ErrorCode.NOT_SUPPORTED
+        assert res.error_code == infinity.ErrorCode.OK
 
-        res = table_obj.add_columns({"c3": {"type": "varchar", "default": "default"}})
+        res = table_obj.add_columns({"c4": {"type": "varchar", "default": "default"}})
         assert res.error_code == infinity.ErrorCode.OK
 
         res, extra_result = table_obj.output(["*"]).to_df()
         pd.testing.assert_frame_equal(
             res,
-            pd.DataFrame({"c1": [1], "c2": [2], "c3": ["default"]}).astype(
-                {"c1": 'Int32', "c2": 'Int32', "c3": 'string'}
+            pd.DataFrame({"c1": [1], "c2": [2], "c3": [None], "c4": ["default"]}).astype(
+                {"c1": 'Int32', "c2": 'Int32', "c3": 'string', "c4": 'string'}
             )
         )
 
@@ -71,14 +71,62 @@ def test_simple_add_columns(self):
         pd.testing.assert_frame_equal(
             res,
             pd.DataFrame(
-                {"c1": [1, 2], "c2": [2, 3], "c3": ["default", "test"]}
+                {"c1": [1, 2], "c2": [2, 3], "c3": [None, "test"], "c4": ["default", "default"]}
             ).astype(
-                {"c1": 'Int32', "c2": 'Int32', "c3": 'string'}
+                {"c1": 'Int32', "c2": 'Int32', "c3": 'string', "c4": 'string'}
             ),
         )
 
         db_obj.drop_table(table_name)
 
+    def test_add_column_not_null(self):
+        """
+        target: test ALTER TABLE ADD COLUMN with NOT NULL constraint
+        method:
+        1. Create table with data, add a NOT NULL column with default — succeeds, existing rows get the default value
+        2. Add a NOT NULL column without default on a table with data — fails (existing rows would be NULL)
+        3. Add a NOT NULL column without default on an empty table — succeeds
+        """
+        table_name = "test_add_column_not_null" + self.suffix
+        db_obj = self.infinity_obj.get_database("default_db")
+        db_obj.drop_table(table_name, ConflictType.Ignore)
+
+        # 1. Create table with data
+        table_obj = db_obj.create_table(
+            table_name,
+            {
+                "c1": {"type": "int"},
+                "c2": {"type": "varchar"},
+            },
+        )
+        assert table_obj is not None
+
+        res = table_obj.insert([
+            {"c1": 1, "c2": "hello"},
+            {"c1": 2, "c2": "world"},
+        ])
+        assert res.error_code == infinity.ErrorCode.OK
+
+        # 2. Add NOT NULL column with default — succeeds, existing rows get default
+        res = table_obj.add_columns({"c3": {"type": "varchar", "constraints": ["not null"], "default": "default_val"}})
+        assert res.error_code == infinity.ErrorCode.OK
+
+        res, _ = table_obj.output(["*"]).to_df()
+        pd.testing.assert_frame_equal(
+            res.sort_values("c1").reset_index(drop=True),
+            pd.DataFrame({
+                "c1": pd.array([1, 2], dtype="Int32"),
+                "c2": pd.array(["hello", "world"], dtype="string"),
+                "c3": pd.array(["default_val", "default_val"], dtype="string"),
+            }),
+        )
+
+        # 3. Add NOT NULL column without default on table that has data — fails
+        res = table_obj.add_columns({"c4": {"type": "int", "constraints": ["not null"]}})
+        assert res.error_code != infinity.ErrorCode.OK
+
+        db_obj.drop_table(table_name)
+
     def test_simple_drop_columns(self):
         table_name = "test_drop_column" + self.suffix
         db_obj = self.infinity_obj.get_database("default_db")
```

**File**: `python/test_pysdk/test_insert.py` (modified, +118/-105)
```diff
@@ -487,6 +487,111 @@ def _test_insert_zero_column(self, suffix):
         res = db_obj.drop_table("test_insert_zero_column" + suffix, ConflictType.Error)
         assert res.error_code == ErrorCode.OK
 
+    def _test_insert_null(self, suffix):
+        """
+        target: test insert null values into nullable columns
+        method:
+        1. create table with nullable columns of different types
+        2. insert rows with explicit None values
+        3. verify null values are stored correctly
+        4. drop table
+        expected: all operations successfully, NULL values stored as expected
+        """
+        db_obj = self.infinity_obj.get_database("default_db")
+        db_obj.drop_table("test_insert_null" + suffix, ConflictType.Ignore)
+
+        table_obj = db_obj.create_table(
+            "test_insert_null" + suffix,
+            {
+                "c1": {"type": "int"},
+                "c2": {"type": "varchar"},
+                "c3": {"type": "float"},
+            },
+            ConflictType.Error,
+        )
+        assert table_obj
+
+        # Insert explicit None values into nullable columns
+        res = table_obj.insert([{"c1": 1, "c2": "hello", "c3": 1.5}])
+        assert res.error_code == ErrorCode.OK
+        res = table_obj.insert([{"c1": None, "c2": "world", "c3": 2.5}])
+        assert res.error_code == ErrorCode.OK
+        res = table_obj.insert([{"c1": 3, "c2": None, "c3": 3.5}])
+        assert res.error_code == ErrorCode.OK
+        res = table_obj.insert([{"c1": 4, "c2": "test", "c3": None}])
+        assert res.error_code == ErrorCode.OK
+        res = table_obj.insert([{"c1": None, "c2": None, "c3": None}])
+        assert res.error_code == ErrorCode.OK
+
+        res, extra_result = table_obj.output(["*"]).to_df()
+        print(res)
+        pd.testing.assert_frame_equal(
+            res.sort_values("c1", na_position="last").reset_index(drop=True),
+            pd.DataFrame({
+                "c1": pd.array([1, 3, 4, pd.NA, pd.NA], dtype="Int32"),
+                "c2": pd.array(["hello", pd.NA, "test", "world", pd.NA], dtype="string"),
+                "c3": pd.array([1.5, 3.5, pd.NA, 2.5, pd.NA], dtype="Float32"),
+            }),
+        )
+
+        res = db_obj.drop_table("test_insert_null" + suffix, ConflictType.Error)
+        assert res.error_code == ErrorCode.OK
+
+    def _test_insert_not_null(self, suffix):
+        """
+        target: test insert into NOT NULL columns
+        method:
+        1. Create table with a NOT NULL column (no default)
+        2. Insert omitting the NOT NULL column — fails
+        3. Insert with explicit None in the NOT NULL column — fails
+        4. Insert with proper value in the NOT NULL column — succeeds
+        5. Verify data
+        6. Drop table
+        expected: NOT NULL constraint enforced during insert
+        """
+        db_obj = self.infinity_obj.get_database("default_db")
+        db_obj.drop_table("test_insert_not_null" + suffix, ConflictType.Ignore)
+
+        table_obj = db_obj.create_table(
+            "test_insert_not_null" + suffix,
+            {
+                "c1": {"type": "int"},
+                "c2": {"type": "varchar", "constraints": ["not null"]},
+                "c3": {"type": "float", "constraints": ["not null"], "default": 0.0},
+            },
+            ConflictType.Error,
+        )
+        assert table_obj
+
+        # Case 1: omitting c2 (NOT NULL without default) — fails
+        with pytest.raises(Exception):
+            table_obj.insert([{"c1": 1, "c3": 1.0}])
+
+        # Case 2: c2=None (explicit NULL on NOT NULL column) — fails
+        with pytest.raises(Exception):
+            table_obj.insert([{"c1": 1, "c2": None, "c3": 1.0}])
+
+        # Case 3: omitting c3 (NOT NULL with default) — succeeds, uses default
+        res = table_obj.insert([{"c1": 1, "c2": "hello"}])
+        assert res.error_code == ErrorCode.OK
+
+        # Case 4: all values provided — succeeds
+        res = table_obj.insert([{"c1": 2, "c2": "world", "c3": 2.5}])
+        assert res.error_code == ErrorCode.OK
+
+        res, _ = table_obj.output(["*"]).to_df()
+        pd.testing.assert_frame_equal(
+            res.sort_values("c1").reset_index(drop=True),
+            pd.DataFrame({
+                "c1": pd.array([1, 2], dtype="Int32"),
+                "c2": pd.array(["hello", "world"], dtype="string"),
+                "c3": pd.array([0.0, 2.5], dtype="Float32"),
+            }),
+        )
+
+        res = db_obj.drop_table("test_insert_not_null" + suffix, ConflictType.Error)
+        assert res.error_code == ErrorCode.OK
+
     def _test_insert_sparse(self, suffix):
         """
         target: test insert sparse column
@@ -720,6 +825,8 @@ def test_insert(self, suffix):
         self._test_read_after_shutdown(suffix)
         self._test_batch_insert(suffix)
         self._test_insert_zero_column(suffix)
+        self._test_insert_null(suffix)
+        self._test_insert_not_null(s
```

**File**: `python/test_pysdk/test_knn.py` (modified, +26/-27)
```diff
@@ -182,33 +182,32 @@ def test_knn_fp16_bf16(self, check_data, save_elem_type, query_elem_type, suffix
         assert res.error_code == ErrorCode.OK
 
     def test_insert_multi_column(self, suffix):
-        with pytest.raises(Exception, match=r".*No default value found*"):
-            db_obj = self.infinity_obj.get_database("default_db")
-            db_obj.drop_table("test_insert_multi_column" + suffix,
-                              conflict_type=ConflictType.Ignore)
-            table = db_obj.create_table("test_insert_multi_column" + suffix, {
-                "variant_id": {"type": "varchar"},
-                "gender_vector": {"type": "vector,4,float"},
-                "color_vector": {"type": "vector,4,float"},
-                "category_vector": {"type": "vector,4,float"},
-                "tag_vector": {"type": "vector,4,float"},
-                "other_vector": {"type": "vector,4,float"},
-                "query_is_recommend": {"type": "varchar"},
-                "query_gender": {"type": "varchar"},
-                "query_color": {"type": "varchar"},
-                "query_price": {"type": "float"}
-            }, ConflictType.Error)
-            table.insert([{"variant_id": "123",
-                           "gender_vector": [1.0] * 4,
-                           "color_vector": [2.0] * 4,
-                           "category_vector": [3.0] * 4,
-                           "tag_vector": [4.0] * 4,
-                           "other_vector": [5.0] * 4,
-                           "query_is_recommend": "ok",
-                           "query_gender": "varchar",
-                           # "query_color": "red",
-                           "query_price": 1.0
-                           }])
+        db_obj = self.infinity_obj.get_database("default_db")
+        db_obj.drop_table("test_insert_multi_column" + suffix,
+                          conflict_type=ConflictType.Ignore)
+        table = db_obj.create_table("test_insert_multi_column" + suffix, {
+            "variant_id": {"type": "varchar"},
+            "gender_vector": {"type": "vector,4,float"},
+            "color_vector": {"type": "vector,4,float"},
+            "category_vector": {"type": "vector,4,float"},
+            "tag_vector": {"type": "vector,4,float"},
+            "other_vector": {"type": "vector,4,float"},
+            "query_is_recommend": {"type": "varchar"},
+            "query_gender": {"type": "varchar"},
+            "query_color": {"type": "varchar"},
+            "query_price": {"type": "float"}
+        }, ConflictType.Error)
+        table.insert([{"variant_id": "123",
+                       "gender_vector": [1.0] * 4,
+                       "color_vector": [2.0] * 4,
+                       "category_vector": [3.0] * 4,
+                       "tag_vector": [4.0] * 4,
+                       "other_vector": [5.0] * 4,
+                       "query_is_recommend": "ok",
+                       "query_gender": "varchar",
+                       # "query_color": "red",
+                       "query_price": 1.0
+                       }])
 
         res = db_obj.drop_table("test_insert_multi_column" + suffix, ConflictType.Error)
         assert res.error_code == ErrorCode.OK
```

---

### Incident Patch 9: `8fc20770` (2026-07-31)
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
             res.to_pandas(),
-            pd.DataFrame({'json_extract_string(c3, $[1].name)': (None, None, None, None, '"李四"')})
+            pd.DataFrame({'json_extract_string(c3, $[1].name)': (None, None, None, None, '李四')})
         )
 
         res, _ = table_obj.output(["json_extract_int(c3,'$[1].age')"]).to_pl()
@@ -617,7 +617,7 @@ def test_select_json_comprehensive(self, suffix):
         res, _ = table_obj.output(["json_extract_string(c3,'$.level1.level2.level3.level4')"]).to_pl()
         pd.testing.assert_frame_equal(
             res.to_pandas(),
-            pd.DataFrame({'json_extract_string(c3, $.level1.level2.level3.level4)': (None, None, None, None, None, None, None, None, None, '"deep_value"')})
+            pd.DataFrame({'json_extract_string(c3, $.level1.level2.level3.level4)': (None, None, None, None, None, None, None, None, None, 'deep_value')})
         )
 
         res, _ = table_obj.output(["json_exists_path(c3,'$.level1.level2.level3')"]).to_pl()
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

**File**: `test/sql/ddl/index/test_json_index.slt` (modified, +8/-1)
```diff
@@ -130,7 +130,7 @@ SELECT id FROM test_json_index WHERE json_extract_string(meta, '$.author') == 'B
 query T
 SELECT json_extract_string(meta, '$.time') FROM test_json_index WHERE id = 5;
 ----
-"2026-05-27T23:59:59"
+2026-05-27T23:59:59
 
 query I
 SELECT id FROM test_json_index WHERE json_extract_string(meta, '$.author') > 'Bob';
@@ -183,6 +183,13 @@ SELECT id FROM test_json_index WHERE json_exists_path(meta, '$.name');
 ----
 4
 
+query I
+SELECT id FROM test_json_index WHERE json_exists_path(meta, '$.character');
+----
+1
+2
+3
+
 statement ok
 DROP TABLE test_json_index;
 
```

**File**: `test/sql/dql/type/json.slt` (modified, +12/-12)
```diff
@@ -282,17 +282,17 @@ INSERT INTO test_json_filter VALUES (16, 'q', '{"string_number": "123", "string_
 query T
 SELECT json_extract_string(c3, '$.string_number') FROM test_json_filter WHERE c1 = 16;
 ----
-"123"
+123
 
 query T
 SELECT json_extract_string(c3, '$.string_float') FROM test_json_filter WHERE c1 = 16;
 ----
-"45.67"
+45.67
 
 query T
 SELECT json_extract_string(c3, '$.string_bool') FROM test_json_filter WHERE c1 = 16;
 ----
-"true"
+true
 
 statement ok
 INSERT INTO test_json_filter VALUES (17, 'r', '{"a": [1, 2, 3], "b": [[4, 5], [6, 7]], "c": {"d": {"e": 8}}}')
@@ -605,7 +605,7 @@ SELECT id, json_extract(tags, '$[0]') AS first_object FROM user_tags WHERE id =
 query IT
 SELECT id, json_extract_string(tags, '$[0].name') AS first_name FROM user_tags WHERE id = 6;
 ----
-6 "张三"
+6 张三
 
 query II
 SELECT id, json_extract_int(tags, '$[0].age') AS first_age FROM user_tags WHERE id = 6;
@@ -615,7 +615,7 @@ SELECT id, json_extract_int(tags, '$[0].age') AS first_age FROM user_tags WHERE
 query IT
 SELECT id, json_extract_string(tags, '$[1].name') AS second_name FROM user_tags WHERE id = 6;
 ----
-6 "李四"
+6 李四
 
 query II
 SELECT id, json_extract_int(tags, '$[1].age') AS second_age FROM user_tags WHERE id = 6;
@@ -651,7 +651,7 @@ SELECT id, json_extract_bool(tags, '$[1]') AS second_element FROM user_tags WHER
 query IT
 SELECT id, json_extract_string(tags, '$[0]') AS first_element FROM user_tags WHERE id = 1;
 ----
-1 "电商"
+1 电商
 
 # json_extract_bool on non-boolean elements
 query IB
@@ -731,7 +731,7 @@ SELECT id, json_extract_int(tags, '$[0]') FROM user_tags WHERE id = 10;
 query IT
 SELECT id, json_extract_string(tags, '$[1]') FROM user_tags WHERE id = 10;
 ----
-10 "two"
+10 two
 
 query IF
 SELECT id, json_extract_double(tags, '$[2]') FROM user_tags WHERE id = 10;
@@ -756,7 +756,7 @@ SELECT id, json_extract(tags, '$[5]') FROM user_tags WHERE id = 10;
 query IT
 SELECT id, json_extract_string(tags, '$[5].key') FROM user_tags WHERE id = 10;
 ----
-10 "value"
+10 value
 
 # large arrays
 statement ok
@@ -986,25 +986,25 @@ query II
 SELECT c1, CAST(json_extract_string(c2, '$.int_val') AS INTEGER)
 FROM test_json_cast WHERE c1 = 1;
 ----
-1 null
+1 42
 
 query IT
 SELECT c1, CAST(json_extract_string(c2, '$.float_val') AS DOUBLE)
 FROM test_json_cast WHERE c1 = 2;
 ----
-2 null
+2 3.140000
 
 query IB
 SELECT c1, CAST(json_extract_string(c2, '$.bool_val') AS BOOLEAN)
 FROM test_json_cast WHERE c1 = 3;
 ----
-3 null
+3 true
 
 query IT
 SELECT c1, CAST(json_extract_string(c2, '$.name') AS VARCHAR)
 FROM test_json_cast WHERE c1 = 4;
 ----
-4 "Alice"
+4 Alice
 
 # ============================================================================
 # Part 18: Edge Cases and Error Handling
```

---

### Incident Patch 10: `7badfd94` (2026-07-30)
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

---

### Incident Patch 11: `de2298b5` (2026-07-15)
**Commit Message**: Fix CI process (#3406)

Fix 'No UV'

Signed-off-by: Jin Hai <[REDACTED_EMAIL]>

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

---

### Incident Patch 12: `b68109db` (2026-07-15)
**Commit Message**: Fix dockerfile (#3405)

As title.

Signed-off-by: Jin Hai <[REDACTED_EMAIL]>

**File**: `scripts/Dockerfile_infinity` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ FROM ubuntu:22.04
 RUN apt update && \
     apt --no-install-recommends install -y ca-certificates && \
     apt update && \
-    apt install -y curl, libatomic1
+    apt install -y curl libatomic1
 
 # https://docs.docker.com/reference/dockerfile/#copy
 # If <src> is a directory, the entire contents of the directory are copied, including filesystem metadata.
```

---

### Incident Patch 13: `c8966db6` (2026-07-14)
**Commit Message**: Fix dockerfile (#3402)

### What problem does this PR solve?

Install libatomic1 lib

---------

Signed-off-by: Jin Hai <[REDACTED_EMAIL]>

**File**: `.github/pull_request_template.md` (modified, +1/-17)
```diff
@@ -1,17 +1 @@
-### What problem does this PR solve?
-
-_Briefly describe what this PR aims to solve. Include background context that will help reviewers understand the purpose of the PR._
-
-Issue link:#[Link the issue here]
-
-### Type of change
-
-- [ ] Bug Fix (non-breaking change which fixes an issue)
-- [ ] New Feature (non-breaking change which adds functionality)
-- [ ] Breaking Change (fix or feature that could cause existing functionality not to work as expected)
-- [ ] Documentation Update
-- [ ] Refactoring
-- [ ] Performance Improvement
-- [ ] Test cases
-- [ ] Python SDK impacted, Need to update PyPI
-- [ ] Other (please describe):
+### Summary
\ No newline at end of file
```

**File**: `scripts/Dockerfile_infinity` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ FROM ubuntu:22.04
 RUN apt update && \
     apt --no-install-recommends install -y ca-certificates && \
     apt update && \
-    apt install -y curl
+    apt install -y curl, libatomic1
 
 # https://docs.docker.com/reference/dockerfile/#copy
 # If <src> is a directory, the entire contents of the directory are copied, including filesystem metadata.
```

---

### Incident Patch 14: `a7432bef` (2026-06-29)
**Commit Message**: Fix Json Index bugs (#3398)

### What problem does this PR solve?

- JSON Index row_cnt_ 
One JSON row produces multiple index entries. row_cnt_ is not the same
as index entry count. Correct it.
- Planner cross-type matching
json_extract_double > N was treating > as >= for integer-typed values;
now preserves original compare type
- JSON flattener
:p: path-exists term emitted for objects and arrays (was only scalars),
fixing json_exists_path for non-scalar paths
- OPTIMIZE merge
removed broken reader_offsets_ adjustment that corrupted segment offsets
during chunk merge

### Type of change

- [x] Bug Fix (non-breaking change which fixes an issue)

**File**: `src/planner/optimizer/index_scan/filter_expression_push_down_indexscanfilter_impl.cpp` (modified, +17/-7)
```diff
@@ -594,6 +594,7 @@ class IndexScanFilterExpressionPushDownMethod {
                 Value value = Value::MakeNull();
                 std::optional<Value> raw_value_for_double;
                 FilterCompareType compare_type;
+                FilterCompareType original_compare_type;
                 std::shared_ptr<TableIndexMeta> table_index_meta;
                 std::string json_path;
 
@@ -735,6 +736,8 @@ class IndexScanFilterExpressionPushDownMethod {
                         auto *json_func_expr = static_cast<FunctionExpression *>(function_expression->arguments()[0].get());
                         raw_value_for_double = FilterExpressionPushDownHelper::CalcValueResult(function_expression->arguments()[1]);
                         compare_type = PossibleCompareTypes[std::distance(PossibleFunctionNames.begin(), it)];
+                        // Save original compare_type before HandleJsonComparison mutates it (kGreater→kGreaterEqual, etc.)
+                        original_compare_type = compare_type;
                         HandleJsonComparison(json_func_expr, *raw_value_for_double, compare_type);
                         break;
                     }
@@ -744,6 +747,8 @@ class IndexScanFilterExpressionPushDownMethod {
                         auto *json_func_expr = static_cast<FunctionExpression *>(function_expression->arguments()[1].get());
                         raw_value_for_double = FilterExpressionPushDownHelper::CalcValueResult(function_expression->arguments()[0]);
                         compare_type = PossibleReverseCompareTypes[std::distance(PossibleFunctionNames.begin(), it)];
+                        // Save original compare_type before HandleJsonComparison mutates it (kGreater→kGreaterEqual, etc.)
+                        original_compare_type = compare_type;
                         HandleJsonComparison(json_func_expr, *raw_value_for_double, compare_type);
                         break;
                     }
@@ -778,14 +783,18 @@ class IndexScanFilterExpressionPushDownMethod {
                                 FilterCompareType int_cmp_type = FilterCompareType::kEqual;
                                 int64_t int_val = int_val_for_eq;
 
-                                if (compare_type == FilterCompareType::kGreater || compare_type == FilterCompareType::kGreaterEqual) {
+                                const bool is_integral_boundary = std::floor(double_val) == double_val;
+                                if (original_compare_type == FilterCompareType::kGreater) {
+                                    int_val = static_cast<int64_t>(std::ceil(double_val));
+                                    int_cmp_type = is_integral_boundary ? FilterCompareType::kGreater : FilterCompareType::kGreaterEqual;
+                                } else if (original_compare_type == FilterCompareType::kGreaterEqual) {
                                     int_val = static_cast<int64_t>(std::ceil(double_val));
-                                    // For int >= ceil(X), we use kGreaterEqual with int_val - 1
-                                    // because BuildJsonTerm does int_val + 1 for kGreater
                                     int_cmp_type = FilterCompareType::kGreaterEqual;
-                                } else if (compare_type == FilterCompareType::kLess || compare_type == FilterCompareType::kLessEqual) {
+                                } else if (original_compare_type == FilterCompareType::kLess) {
+                                    int_val = static_cast<int64_t>(std::floor(double_val));
+                                    int_cmp_type = is_integral_boundary ? FilterCompareType::kLess : FilterCompareType::kLessEqual;
+                                } else if (original_compare_type == FilterCompareType::kLessEqual) {
                                     int_val = static_cast<int64_t>(std::floor(double_val));
-                                    // For int <= floor(X), we use kLessEqual with the floor value directly
                                     int_cmp_type = FilterCompareType::kLessEqual;
                                 }
 
@@ -795,10 +804,11 @@ class IndexScanFilterExpressionPushDownMethod {
                                 std::string int_term_str = int_term.ToString();
                                 JsonTermT int_term_key(int_term_str);
 
-                                if (compare_type == FilterCompareType::kEqual) {
+                                if (original_compare_type == FilterCompareType::kEqual) {
                                     // For equality, just add the int term as an additional exact match
                                     evaluator->AddRange(std::make_pair(int_term_key, int_term_key));
-                                } else if (compare_type == FilterCompareType::kGreater || compare_type == FilterCompareType::kGreaterEqual) {
+                                } else if (original_compare_type == FilterCompareType::kGreater ||
+                               
```

**File**: `src/storage/catalog/meta/chunk_index_meta.cppm` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export struct ChunkIndexMetaInfo {
         : base_name_(base_name), base_row_id_(base_row_id), row_cnt_(row_cnt), term_cnt_(term_cnt), index_size_(index_size) {}
     std::string base_name_{};
     RowID base_row_id_{};
-    size_t row_cnt_{};
+    size_t row_cnt_{};  // number of data rows covered by this chunk
     size_t term_cnt_{}; // used only in fulltext index
     size_t index_size_{};
 
```

**File**: `src/storage/json_index/json_flattener_impl.cpp` (modified, +5/-0)
```diff
@@ -83,6 +83,9 @@ void JsonFlattener::FlattenRecursive(const JsonTypeDef &json_value, const std::s
             std::string child_path = current_path.empty() ? std::string("$") + "." + item.key() : current_path + "." + item.key();
             FlattenRecursive(item.value(), child_path, terms);
         }
+        // Emit path exists term for json_exists_path support
+        std::string object_path = current_path.empty() ? "$" : current_path;
+        terms.push_back({object_path + ":p:"});
     } else if (json_value.is_array()) {
         size_t idx = 0;
         for (const auto &val : json_value) {
@@ -97,6 +100,8 @@ void JsonFlattener::FlattenRecursive(const JsonTypeDef &json_value, const std::s
         for (const auto &val : json_value) {
             AddScalarTerm(val, parent_path);
         }
+        // Emit path exists term for json_exists_path support
+        terms.push_back({parent_path + ":p:"});
     } else {
         AddScalarTerm(json_value, current_path);
         // Emit path exists term for json_exists_path support (for non-null scalar values)
```

**File**: `src/storage/new_txn/new_txn.cppm` (modified, +2/-1)
```diff
@@ -599,7 +599,8 @@ private:
                            RowID &base_rowid,
                            u32 &row_cnt,
                            u32 &term_cnt,
-                           std::string &base_name);
+                           std::string &base_name,
+                           std::vector<ChunkID> &deprecate_ids);
 
     Status OptimizeVecIndex(std::shared_ptr<IndexBase> index_base,
                             std::shared_ptr<ColumnDef> column_def,
```

**File**: `src/storage/new_txn/new_txn_index_impl.cpp` (modified, +9/-10)
```diff
@@ -350,6 +350,7 @@ Status NewTxn::OptimizeIndexInner(SegmentIndexMeta &segment_index_meta,
     u32 row_cnt = 0;
     u32 term_cnt = 0;
     std::vector<size_t> row_cnts;
+    std::vector<ChunkID> deprecate_ids;
 
     std::string base_name;
 
@@ -358,7 +359,7 @@ Status NewTxn::OptimizeIndexInner(SegmentIndexMeta &segment_index_meta,
         return index_status;
     }
     if (index_base->index_type_ == IndexType::kFullText) {
-        status = OptimizeFtIndex(index_base, segment_index_meta, base_rowid, row_cnt, term_cnt, base_name);
+        status = OptimizeFtIndex(index_base, segment_index_meta, base_rowid, row_cnt, term_cnt, base_name, deprecate_ids);
         if (!status.ok()) {
             return status;
         }
@@ -368,11 +369,9 @@ Status NewTxn::OptimizeIndexInner(SegmentIndexMeta &segment_index_meta,
         ChunkIndexMetaInfo *chunk_info_ptr = nullptr;
         for (ChunkID old_chunk_id : *old_chunk_ids_ptr) {
             ChunkIndexMeta old_chunk_meta(old_chunk_id, segment_index_meta);
-            {
-                status = old_chunk_meta.GetChunkInfo(chunk_info_ptr);
-                if (!status.ok()) {
-                    return status;
-                }
+            status = old_chunk_meta.GetChunkInfo(chunk_info_ptr);
+            if (!status.ok()) {
+                return status;
             }
             if (last_rowid != chunk_info_ptr->base_row_id_) {
                 UnrecoverableError("OptimizeIndex: base_row_id is not continuous");
@@ -381,8 +380,8 @@ Status NewTxn::OptimizeIndexInner(SegmentIndexMeta &segment_index_meta,
             row_cnt += chunk_info_ptr->row_cnt_;
             row_cnts.push_back(chunk_info_ptr->row_cnt_);
         }
+        deprecate_ids = *old_chunk_ids_ptr;
     }
-    std::vector<ChunkID> deprecate_ids = *old_chunk_ids_ptr;
     ChunkID chunk_id = 0;
     std::tie(chunk_id, status) = segment_index_meta.GetAndSetNextChunkID();
     if (!status.ok()) {
@@ -2144,7 +2143,8 @@ Status NewTxn::OptimizeFtIndex(std::shared_ptr<IndexBase> index_base,
                                RowID &base_rowid_out,
                                u32 &row_cnt_out,
                                u32 &term_cnt_out,
-                               std::string &base_name_out) {
+                               std::string &base_name_out,
+                               std::vector<ChunkID> &deprecate_ids) {
     const auto *index_fulltext = static_cast<const IndexFullText *>(index_base.get());
 
     std::vector<ChunkID> chunk_ids;
@@ -2220,6 +2220,7 @@ Status NewTxn::OptimizeFtIndex(std::shared_ptr<IndexBase> index_base,
         row_cnt_out = total_row_count;
         term_cnt_out = total_term_count;
         base_name_out = dst_base_name;
+        deprecate_ids = std::move(chunk_ids);
     }
 
     LOG_INFO(fmt::format("finish merging {} {}", *index_fulltext->index_name_, dst_base_name));
@@ -2812,8 +2813,6 @@ Status NewTxn::RecoverMemIndex(TableIndexMeta &table_index_meta) {
     for (SegmentID segment_id : *segment_ids_ptr) {
         SegmentMeta segment_meta(segment_id, table_meta);
         if (!index_segment_ids_set.contains(segment_id)) {
-            //            std::shared_ptr<std::string> error_msg = std::make_shared<std::string>(fmt::format("Segment {} not in index {}",
-            //            segment_id, table_index_meta.index_id_str())); LOG_WARN(*error_msg); UnrecoverableError(*error_msg);//
             std::optional<SegmentIndexMeta> segment_index_meta;
             status = NewCatalog::AddNewSegmentIndex1(table_index_meta, this, segment_id, segment_index_meta);
             if (!status.ok()) {
```

**File**: `src/storage/secondary_index/secondary_index_data_impl.cpp` (modified, +16/-22)
```diff
@@ -132,19 +132,14 @@ template <typename RawValueType>
 struct SecondaryIndexChunkMerger<RawValueType, HighCardinalityTag> {
     using OrderedKeyType = ConvertToOrderedType<RawValueType>;
     std::vector<SecondaryIndexChunkDataReader<RawValueType, HighCardinalityTag>> readers_;
-    std::vector<u32> reader_offsets_;
     std::priority_queue<std::tuple<OrderedKeyType, u32, u32>,
                         std::vector<std::tuple<OrderedKeyType, u32, u32>>,
                         std::greater<std::tuple<OrderedKeyType, u32, u32>>>
         pq_;
     explicit SecondaryIndexChunkMerger(const std::vector<std::pair<u32, BufferObj *>> &buffer_objs) {
         readers_.reserve(buffer_objs.size());
-        reader_offsets_.reserve(buffer_objs.size());
-        u32 offset_shift = 0;
         for (const auto &[row_count, buffer_obj] : buffer_objs) {
             readers_.emplace_back(buffer_obj, row_count);
-            reader_offsets_.push_back(offset_shift);
-            offset_shift += row_count;
         }
         OrderedKeyType key = {};
         u32 offset = 0;
@@ -160,7 +155,7 @@ struct SecondaryIndexChunkMerger<RawValueType, HighCardinalityTag> {
         }
         const auto [key, offset, reader_id] = pq_.top();
         out_key = key;
-        out_offset = offset + reader_offsets_[reader_id];
+        out_offset = offset;
         pq_.pop();
         OrderedKeyType next_key = {};
         u32 next_offset = 0;
@@ -176,19 +171,14 @@ template <typename RawValueType>
 struct SecondaryIndexChunkMerger<RawValueType, LowCardinalityTag> {
     using OrderedKeyType = ConvertToOrderedType<RawValueType>;
     std::vector<SecondaryIndexChunkDataReader<RawValueType, LowCardinalityTag>> readers_;
-    std::vector<u32> reader_offsets_;
     std::priority_queue<std::tuple<OrderedKeyType, u32, u32>,
                         std::vector<std::tuple<OrderedKeyType, u32, u32>>,
                         std::greater<std::tuple<OrderedKeyType, u32, u32>>>
         pq_;
     explicit SecondaryIndexChunkMerger(const std::vector<std::pair<u32, BufferObj *>> &file_workers) {
         readers_.reserve(file_workers.size());
-        reader_offsets_.reserve(file_workers.size());
-        u32 offset_shift = 0;
         for (const auto &[row_count, file_worker] : file_workers) {
             readers_.emplace_back(file_worker, row_count);
-            reader_offsets_.push_back(offset_shift);
-            offset_shift += row_count;
         }
         OrderedKeyType key = {};
         u32 offset = 0;
@@ -204,7 +194,7 @@ struct SecondaryIndexChunkMerger<RawValueType, LowCardinalityTag> {
         }
         const auto [key, offset, reader_id] = pq_.top();
         out_key = key;
-        out_offset = offset + reader_offsets_[reader_id];
+        out_offset = offset;
         pq_.pop();
         OrderedKeyType next_key = {};
         u32 next_offset = 0;
@@ -424,8 +414,10 @@ class SecondaryIndexDataLowCardinalityT final : public SecondaryIndexDataBase<Lo
         if (!map_ptr) {
             UnrecoverableError("InsertData(): error: map_ptr type error.");
         }
-        if (map_ptr->size() != chunk_row_count_) {
-            UnrecoverableError(fmt::format("InsertData(): error: map size: {} != chunk_row_count_: {}", map_ptr->size(), chunk_row_count_));
+        if constexpr (!std::is_same_v<RawValueType, JsonTermT>) {
+            if (map_ptr->size() != chunk_row_count_) {
+                UnrecoverableError(fmt::format("InsertData(): error: map size: {} != chunk_row_count_: {}", map_ptr->size(), chunk_row_count_));
+            }
         }
 
         // Build unique keys and corresponding bitmaps
@@ -476,16 +468,18 @@ class SecondaryIndexDataLowCardinalityT final : public SecondaryIndexDataBase<Lo
             max_offset = std::max(max_offset, offset);
         }
 
-        if (total_count != chunk_row_count_) {
+        if constexpr (!std::is_same_v<RawValueType, JsonTermT>) {
             // Debug: print more information about the mismatch
-            LOG_ERROR(fmt::format("InsertMergeData(): total_count: {} != chunk_row_count_: {}", total_count, chunk_row_count_));
-            LOG_ERROR(fmt::format("InsertMergeData(): old_chunks.size(): {}", old_chunks.size()));
-            for (size_t i = 0; i < old_chunks.size(); ++i) {
-                LOG_ERROR(fmt::format("InsertMergeData(): old_chunks[{}].first (row_count): {}", i, old_chunks[i].first));
+            if (total_count != chunk_row_count_) {
+                LOG_ERROR(fmt::format("InsertMergeData(): total_count: {} != chunk_row_count_: {}", total_count, chunk_row_count_));
+                LOG_ERROR(fmt::format("InsertMergeData(): old_chunks.size(): {}", old_chunks.size()));
+                for (size_t i = 0; i < old_chunks.size(); ++i) {
+                    LOG_ERROR(fmt::format("InsertMergeData(): old_chunks[{}].first (row_count): {}", i, old_chunks[i].first));
+                }
+                LOG_ERROR(fmt::format("InsertMergeData(): unique_key_count_: {}", unique_key_
```

**File**: `src/storage/secondary_index/secondary_index_in_mem.cppm` (modified, +4/-2)
```diff
@@ -33,8 +33,6 @@ export class SecondaryIndexInMem : public BaseMemIndex {
 protected:
     explicit SecondaryIndexInMem(SecondaryIndexCardinality cardinality) : cardinality_(cardinality) {}
 
-    virtual u32 GetRowCountNoLock() const = 0;
-
     virtual u32 MemoryCostOfEachRow() const = 0;
 
     virtual u32 MemoryCostOfThis() const = 0;
@@ -46,10 +44,14 @@ public:
 
     const ChunkIndexMetaInfo GetChunkIndexMetaInfo() const override;
 
+    virtual size_t GetMemUsed() const = 0;
+
     virtual RowID GetBeginRowID() const override = 0;
 
     virtual u32 GetRowCount() const = 0;
 
+    virtual u32 GetEntryCount() const = 0;
+
     virtual void InsertBlockData(SegmentOffset block_offset, const ColumnVector &col, BlockOffset offset, BlockOffset row_cnt) = 0;
 
     virtual void Dump(BufferObj *buffer_obj) const = 0;
```

**File**: `src/storage/secondary_index/secondary_index_in_mem_impl.cpp` (modified, +31/-15)
```diff
@@ -54,36 +54,51 @@ class SecondaryIndexInMemT final : public SecondaryIndexInMem {
     const RowID begin_row_id_;
     // Replaced std::multimap + mutex with RcuMultiMap for better concurrent performance
     RcuMultiMap<KeyType, u32> in_mem_secondary_index_;
-    std::atomic_size_t json_key_bytes_{0};
+    std::atomic<size_t> json_key_bytes_{0};
+
+    // Track the number of data rows for JSON index only (one row → many entries).
+    // Non-JSON uses in_mem_secondary_index_.size() instead (one entry per row).
+    std::atomic<u32> row_count_{0};
 
 protected:
-    u32 GetRowCountNoLock() const override { return in_mem_secondary_index_.size(); }
-    u32 MemoryCostOfEachRow() const override {
+    // Memory cost per row for non-JSON indexes (1 row = 1 entry).
+    // JSON indexes track exact memory via json_key_bytes_, not this.
+    u32 MemoryCostOfEachRow() const override { return map_memory_bloat_factor * (sizeof(KeyType) + sizeof(u32)); }
+
+    u32 MemoryCostOfThis() const override { return sizeof(*this); }
+
+    size_t GetMemUsed() const override {
         if constexpr (std::is_same_v<RawValueType, JsonTermT>) {
-            return map_memory_bloat_factor * (sizeof(KeyType) + 64 + sizeof(u32));
+            return json_key_bytes_.load(std::memory_order_relaxed) + GetEntryCount() * sizeof(u32);
         } else {
-            return map_memory_bloat_factor * (sizeof(KeyType) + sizeof(u32));
+            return GetRowCount() * MemoryCostOfEachRow();
         }
     }
-    u32 MemoryCostOfThis() const override { return sizeof(*this); }
 
 public:
     explicit SecondaryIndexInMemT(const RowID begin_row_id, SecondaryIndexCardinality cardinality)
         : SecondaryIndexInMem(cardinality), begin_row_id_(begin_row_id) {
         IncreaseMemoryUsageBase(MemoryCostOfThis());
     }
-    ~SecondaryIndexInMemT() override {
+    ~SecondaryIndexInMemT() override { DecreaseMemoryUsageBase(MemoryCostOfThis() + GetMemUsed()); }
+    virtual RowID GetBeginRowID() const override { return begin_row_id_; }
+
+    u32 GetRowCount() const override {
+        // Returns the number of data rows inserted into this index.
         if constexpr (std::is_same_v<RawValueType, JsonTermT>) {
-            DecreaseMemoryUsageBase(MemoryCostOfThis() + json_key_bytes_.load(std::memory_order_relaxed) +
-                                    static_cast<size_t>(GetRowCount()) * sizeof(u32));
+            // For JSON: one data row → many entries, need to track separately.
+            return row_count_;
         } else {
-            DecreaseMemoryUsageBase(MemoryCostOfThis() + GetRowCount() * MemoryCostOfEachRow());
+            // For non-JSON: one entry per row, no separate counter needed.
+            return static_cast<u32>(in_mem_secondary_index_.size());
         }
     }
-    virtual RowID GetBeginRowID() const override { return begin_row_id_; }
-    u32 GetRowCount() const override {
+
+    u32 GetEntryCount() const override {
+        // Returns the number of index entries in the multimap.
         // RcuMultiMap is thread-safe, no lock needed
-        return in_mem_secondary_index_.size();
+        // For JSON: one data row → many entries (entry count ≥ row count).
+        return static_cast<u32>(in_mem_secondary_index_.size());
     }
 
     void InsertBlockData(SegmentOffset block_offset, const ColumnVector &col, BlockOffset offset, BlockOffset row_count) override {
@@ -118,6 +133,7 @@ class SecondaryIndexInMemT final : public SecondaryIndexInMem {
         }
         json_key_bytes_.fetch_add(key_bytes, std::memory_order_relaxed);
         IncreaseMemoryUsageBase(key_bytes + static_cast<size_t>(inserted_count) * sizeof(u32));
+        row_count_.fetch_add(row_count, std::memory_order_relaxed);
     }
 
     void Dump(BufferObj *buffer_obj) const override {
@@ -220,7 +236,7 @@ class SecondaryIndexInMemT final : public SecondaryIndexInMem {
 
 MemIndexTracerInfo SecondaryIndexInMem::GetInfo() const {
     const auto row_cnt = GetRowCount();
-    const auto mem = MemoryCostOfThis() + row_cnt * MemoryCostOfEachRow();
+    const auto mem = MemoryCostOfThis() + GetMemUsed();
     return MemIndexTracerInfo(nullptr, nullptr, nullptr, mem, row_cnt);
 }
 
@@ -327,4 +343,4 @@ SecondaryIndexInMem::NewSecondaryIndexInMem(const DataType &index_data_type, Row
     }
 }
 
-} // namespace infinity
\ No newline at end of file
+} // namespace infinity
```

---

### Incident Patch 15: `9383e954` (2026-06-24)
**Commit Message**: Support CMake version greater than 4.3.0; Fix a module inline issue; Cleanup some code (#3392)

### What problem does this PR solve?

As above.

### Type of change

- [x] Bug Fix (non-breaking change which fixes an issue)
- [x] New Feature (non-breaking change which adds functionality)

---------

Signed-off-by: noob <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ name: release
 
 on:
   schedule:
-    - cron: '0 0-23 * * *'  # This schedule runs every 13:00:00Z(21:00:00+08:00)
+    - cron: '0 13 * * *'  # This schedule runs every 13:00:00Z(21:00:00+08:00)
   # https://github.com/orgs/community/discussions/26286?utm_source=chatgpt.com#discussioncomment-3251208
   # "The create event does not support branch filter and tag filter."
   # The "create tags" trigger is specifically focused on the creation of new tags, while the "push tags" trigger is activated when tags are pushed, including both new tag creations and updates to existing tags.
@@ -74,7 +74,7 @@ jobs:
         BUILDER_CONTAINER=infinity_builder
         echo "BUILDER_CONTAINER=${BUILDER_CONTAINER}" >> ${GITHUB_ENV}
         TZ=$(readlink -f /etc/localtime | awk -F '/zoneinfo/' '{print $2}')
-        docker rm -f ${BUILDER_CONTAINER} && docker run -d --name ${BUILDER_CONTAINER} -e TZ=${TZ} -e UV_INDEX=https://pypi.org/simple/ -v ${PWD}:/infinity ${{ matrix.builder_image }}
+        docker run -d --name ${BUILDER_CONTAINER} -e TZ=${TZ} -e UV_INDEX=https://pypi.org/simple/ -v ${PWD}:/infinity ${{ matrix.builder_image }}
 
     - name: Create libstdc++ modules JSON for cross-compilation
       run: |
```

**File**: `CMakeLists.txt` (modified, +7/-15)
```diff
@@ -1,11 +1,15 @@
-cmake_minimum_required(VERSION 4.0.3...4.2.5)
+cmake_minimum_required(VERSION 4.0.3...4.3.4)
 
 cmake_policy(SET CMP0167 OLD)
 
 set(CMAKE_SUPPRESS_DEVELOPER_WARNINGS TRUE)
 
 if (CMAKE_VERSION GREATER_EQUAL 4.0.3 AND CMAKE_VERSION LESS_EQUAL 4.2.5)
     set(CMAKE_EXPERIMENTAL_CXX_IMPORT_STD "d0edc3af-4c50-42ea-a356-e2862fe7a444")
+else (CMAKE_VERSION GREATER 4.2.5 AND CMAKE_VERSION LESS_EQUAL 4.3.4)
+    set(CMAKE_EXPERIMENTAL_CXX_IMPORT_STD "451f2fe2-a8a2-47c3-bc32-94786d8fc91b")
+    # we use clang
+    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-reserved-module-identifier")
 endif ()
 
 # Auto-detect and set vcpkg toolchain if not already set
@@ -289,20 +293,8 @@ set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Werror -Wno-asm-operand-widths -W
 
 MESSAGE(STATUS "C++ Compilation flags: " ${CMAKE_CXX_FLAGS})
 
-option(IS_CI_TEST_PIPELINE "is ci test pipeline: " OFF)
-
-if (IS_CI_TEST_PIPELINE)
-    if (X86_64)
-        set(VCPKG_CHAINLOAD_TOOLCHAIN_FILE "cmake/toolchains/x86_64-v2.cmake")
-    elseif (ARM64)
-        set(VCPKG_CHAINLOAD_TOOLCHAIN_FILE "cmake/toolchains/arm64-linux.cmake")
-    else ()
-        message(FATAL_ERROR "Not support your arch yet.")
-    endif ()
-else ()
-    if (NOT CMAKE_CROSSCOMPILING)
-        add_compile_options(-march=native)
-    endif ()
+if (NOT CMAKE_CROSSCOMPILING)
+    add_compile_options(-march=native)
 endif ()
 
 execute_process(
```

**File**: `cmake/FindLz4.cmake` (removed, +0/-28)
```diff
@@ -1,28 +0,0 @@
-# - Find LZ4 (lz4.h, liblz4.a, liblz4.so, and liblz4.so.1)
-
-#
-# This module defines:
-# LZ4_FOUND
-# LZ4_INCLUDE_DIR
-# LZ4_LIBRARY
-#
-
-find_path(LZ4_INCLUDE_DIR NAMES lz4.h)
-
-find_library(LZ4_LIBRARY_DEBUG NAMES lz4d)
-find_library(LZ4_LIBRARY_RELEASE NAMES lz4)
-
-include(SelectLibraryConfigurations)
-SELECT_LIBRARY_CONFIGURATIONS(LZ4)
-
-include(FindPackageHandleStandardArgs)
-FIND_PACKAGE_HANDLE_STANDARD_ARGS(
-    LZ4 DEFAULT_MSG
-    LZ4_LIBRARY LZ4_INCLUDE_DIR
-)
-
-if (LZ4_FOUND)
-    message(STATUS "Found LZ4: ${LZ4_LIBRARY}")
-endif()
-
-mark_as_advanced(LZ4_INCLUDE_DIR LZ4_LIBRARY)
```

**File**: `cmake/tbb.cmake` (removed, +0/-36)
```diff
@@ -1,36 +0,0 @@
-# Licensed to the Apache Software Foundation (ASF) under one
-# or more contributor license agreements.  See the NOTICE file
-# distributed with this work for additional information
-# regarding copyright ownership.  The ASF licenses this file
-# to you under the Apache License, Version 2.0 (the
-# "License"); you may not use this file except in compliance
-# with the License.  You may obtain a copy of the License at
-#
-#   http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing,
-# software distributed under the License is distributed on an
-# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-# KIND, either express or implied.  See the License for the
-# specific language governing permissions and limitations
-# under the License.
-
-include_guard()
-
-include(cmake/utils.cmake)
-
-FetchContent_DeclareGitHubWithMirror(tbb
-  oneapi-src/oneTBB v2021.9.0
-  MD5=341fd0408cc0230e8d6121096b1d827a
-)
-
-FetchContent_MakeAvailableWithArgs(tbb
-  TBB_TEST=OFF
-  TBB_EXAMPLES=OFF
-  TBBMALLOC_BUILD=OFF
-  BUILD_SHARED_LIBS=OFF
-)
-
-if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" AND CMAKE_CXX_COMPILER_VERSION VERSION_GREATER_EQUAL 12)
-    target_compile_options(tbb PRIVATE "-Wno-error=stringop-overflow")
-endif()
```

**File**: `cmake/utils.cmake` (removed, +0/-122)
```diff
@@ -1,122 +0,0 @@
-# Licensed to the Apache Software Foundation (ASF) under one
-# or more contributor license agreements.  See the NOTICE file
-# distributed with this work for additional information
-# regarding copyright ownership.  The ASF licenses this file
-# to you under the Apache License, Version 2.0 (the
-# "License"); you may not use this file except in compliance
-# with the License.  You may obtain a copy of the License at
-#
-#   http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing,
-# software distributed under the License is distributed on an
-# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-# KIND, either express or implied.  See the License for the
-# specific language governing permissions and limitations
-# under the License.
-
-include_guard()
-
-include(FetchContent)
-
-macro(parse_var arg key value)
-  string(REGEX REPLACE "^(.+)=(.+)$" "\\1;\\2" REGEX_RESULT ${arg})
-  list(GET REGEX_RESULT 0 ${key})
-  list(GET REGEX_RESULT 1 ${value})
-endmacro()
-
-function(FetchContent_MakeAvailableWithArgs dep)
-  if(NOT ${dep}_POPULATED)
-    FetchContent_Populate(${dep})
-
-    foreach(arg IN LISTS ARGN)
-      parse_var(${arg} key value)
-      set(${key}_OLD ${${key}})
-      set(${key} ${value} CACHE INTERNAL "")
-    endforeach()
-
-    add_subdirectory(${${dep}_SOURCE_DIR} ${${dep}_BINARY_DIR} EXCLUDE_FROM_ALL)
-
-    foreach(arg IN LISTS ARGN)
-      parse_var(${arg} key value)
-      set(${key} ${${key}_OLD} CACHE INTERNAL "")
-    endforeach()
-  endif()
-endfunction()
-
-function(FetchContent_DeclareWithMirror dep url hash)
-  FetchContent_Declare(${dep}
-    URL ${DEPS_FETCH_PROXY}${url}
-    URL_HASH ${hash}
-  )
-endfunction()
-
-function(FetchContent_DeclareGitHubWithMirror dep repo tag hash)
-  FetchContent_DeclareWithMirror(${dep}
-    https://github.com/${repo}/archive/${tag}.zip
-    ${hash}
-  )
-endfunction()
-
-macro(SET_FIND_LIBRARY_OPTIONS _prefixes _suffixes)
-  set(_CMAKE_FIND_LIBRARY_PREFIXES "${CMAKE_FIND_LIBRARY_PREFIXES}")
-  set(_CMAKE_FIND_LIBRARY_SUFFIXES "${CMAKE_FIND_LIBRARY_SUFFIXES}")
-
-  set(CMAKE_FIND_LIBRARY_PREFIXES "${_prefixes}" CACHE INTERNAL "" FORCE)
-  set(CMAKE_FIND_LIBRARY_SUFFIXES "${_suffixes}" CACHE INTERNAL "" FORCE)
-endmacro()
-
-macro(RESTORE_FIND_LIBRARY_OPTIONS)
-  set(CMAKE_FIND_LIBRARY_PREFIXES "${_CMAKE_FIND_LIBRARY_PREFIXES}" CACHE INTERNAL "" FORCE)
-  set(CMAKE_FIND_LIBRARY_SUFFIXES "${_CMAKE_FIND_LIBRARY_SUFFIXES}" CACHE INTERNAL "" FORCE)
-endmacro()
-
-macro(ADD_OPTION_GPROF DEFAULT)
-  if (CMAKE_COMPILER_IS_GNUCXX)
-    option(USE_GPROF "Compile using -pg for gprof output" ${DEFAULT})
-
-    if (USE_GPROF)
-      message(STATUS "Using gprof output for ${CMAKE_PROJECT_NAME}")
-      set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -pg")
-      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pg")
-      set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -pg")
-      set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -pg")
-    else ()
-      message(STATUS "NOT using gprof output for ${CMAKE_PROJECT_NAME}")
-    endif ()
-  else ()
-    message(STATUS "gprof generation NOT AVAILABLE - Not a GNU compiler")
-  endif ()
-endmacro()
-
-# expands ~ to user home directory
-#
-# usage:
-# expand_path("~/code" x)
-function(expand_path in outvar)
-  string(SUBSTRING ${in} 0 1 first)
-  if (NOT ${first} STREQUAL "~")
-    set(${outvar} ${in} PARENT_SCOPE)
-    return()
-  endif ()
-
-  if (WIN32 AND NOT CYGWIN)
-    set(home $ENV{USERPROFILE})
-  else ()
-    set(home $ENV{HOME})
-  endif ()
-
-  if (NOT home)
-    set(${outvar} ${in} PARENT_SCOPE)
-    return()
-  endif ()
-
-  string(SUBSTRING ${in} 1 -1 tail)
-  if (CMAKE_VERSION VERSION_LESS 3.20)
-    file(TO_CMAKE_PATH ${home}${tail} out)
-  else ()
-    cmake_path(CONVERT ${home}${tail} TO_CMAKE_PATH_LIST out)
-  endif ()
-
-  set(${outvar} ${out} PARENT_SCOPE)
-endfunction(expand_path)
```

**File**: `cmake/zlib.cmake` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-# Licensed to the Apache Software Foundation (ASF) under one
-# or more contributor license agreements.  See the NOTICE file
-# distributed with this work for additional information
-# regarding copyright ownership.  The ASF licenses this file
-# to you under the Apache License, Version 2.0 (the
-# "License"); you may not use this file except in compliance
-# with the License.  You may obtain a copy of the License at
-#
-#   http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing,
-# software distributed under the License is distributed on an
-# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-# KIND, either express or implied.  See the License for the
-# specific language governing permissions and limitations
-# under the License.
-
-include_guard()
-
-include(cmake/utils.cmake)
-
-FetchContent_DeclareGitHubWithMirror(zlib
-  madler/zlib v1.2.13
-  MD5=fdedf0c8972a04a7c153dd73492d2d91
-)
-
-FetchContent_MakeAvailableWithArgs(zlib)
```

**File**: `cmake/zstd.cmake` (removed, +0/-44)
```diff
@@ -1,44 +0,0 @@
-# Licensed to the Apache Software Foundation (ASF) under one
-# or more contributor license agreements.  See the NOTICE file
-# distributed with this work for additional information
-# regarding copyright ownership.  The ASF licenses this file
-# to you under the Apache License, Version 2.0 (the
-# "License"); you may not use this file except in compliance
-# with the License.  You may obtain a copy of the License at
-#
-#   http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing,
-# software distributed under the License is distributed on an
-# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-# KIND, either express or implied.  See the License for the
-# specific language governing permissions and limitations
-# under the License.
-
-include_guard()
-
-include(cmake/utils.cmake)
-
-FetchContent_DeclareGitHubWithMirror(zstd
-  facebook/zstd v1.5.5
-  MD5=f336cde1961ee7e5d3a7f8c0c0f96987
-)
-
-FetchContent_GetProperties(zstd)
-if(NOT zstd_POPULATED)
-  FetchContent_Populate(zstd)
-
-  if(CMAKE_CXX_COMPILER_ID STREQUAL "AppleClang")
-    set(APPLE_FLAG "CFLAGS=-isysroot ${CMAKE_OSX_SYSROOT}")
-  endif()
-
-  add_custom_target(make_zstd COMMAND make CC=${CMAKE_C_COMPILER} ${APPLE_FLAG} libzstd.a
-    WORKING_DIRECTORY ${zstd_SOURCE_DIR}/lib
-    BYPRODUCTS ${zstd_SOURCE_DIR}/lib/libzstd.a
-  )
-endif()
-
-add_library(zstd INTERFACE)
-target_include_directories(zstd INTERFACE $<BUILD_INTERFACE:${zstd_SOURCE_DIR}/lib>)
-target_link_libraries(zstd INTERFACE $<BUILD_INTERFACE:${zstd_SOURCE_DIR}/lib/libzstd.a>)
-add_dependencies(zstd make_zstd)
```

**File**: `src/common/boost.cppm` (modified, +6/-0)
```diff
@@ -14,6 +14,10 @@
 
 module;
 
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-W#pragma-messages"
+#pragma clang diagnostic ignored "-Wall"
+
 #define BOOST_NO_AUTO_PTR ;
 
 #include <boost/asio/io_context.hpp>
@@ -33,6 +37,8 @@ module;
 #include <boost/interprocess/sync/interprocess_sharable_mutex.hpp>
 #include <boost/thread.hpp>
 
+#pragma clang diagnostic pop
+
 export module infinity_core:boost;
 
 export namespace boost {
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
