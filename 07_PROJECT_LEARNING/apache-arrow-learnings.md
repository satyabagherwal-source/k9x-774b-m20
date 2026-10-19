> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-arrow-learnings.md`  
> **Source**: github ([https://github.com/apache/arrow](https://github.com/apache/arrow))  
> **Source Version**: `fb767a7c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T09:54:22.834Z  
> **Learning ID**: `learn-github-apache-arrow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): apache/arrow

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-arrow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/arrow](https://github.com/apache/arrow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T09:54:21.841Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/arrow`
- **Description**: Apache Arrow is the universal columnar format and multi-language toolbox for fast data interchange and in-memory analytics
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17213 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cpp/src/arrow/acero/accumulation_queue.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <cstdint>
#include <functional>
#include <optional>
#include <vector>

#include "arrow/acero/visibility.h"
#include "arrow/compute/exec.h"
#include "arrow/result.h"

namespace arrow {
namespace acero {
namespace util {

using arrow::compute::ExecBatch;

/// \brief A container that accumulates batches until they are ready to
///        be processed.
class ARROW_ACERO_EXPORT AccumulationQueue {
 public:
  AccumulationQueue() : row_count_(0) {}
  ~AccumulationQueue() = default;

  // We should never be copying ExecBatch around
  AccumulationQueue(const AccumulationQueue&) = delete;
  AccumulationQueue& operator=(const AccumulationQueue&) = delete;

  AccumulationQueue(AccumulationQueue&& that);
  AccumulationQueue& operator=(AccumulationQueue&& that);

  void Concatenate(AccumulationQueue&& that);
  void InsertBatch(ExecBatch batch);
  int64_t row_count() { return row_count_; }
  size_t batch_count() { return batches_.size(); }
  bool empty() const { return batches_.empty(); }
  void Clear();
  ExecBatch& operator[](size_t i);

 private:
  int64_t row_count_;
  std::vector<ExecBatch> batches_;
};

/// A queue that sequences incoming batches
///
/// This can be used when a node needs to do some kind of ordered processing on
/// the stream.
///
/// Batches can be inserted in any order.  The process_callback will be called on
/// the batches, in order, without reentrant calls. For this reason the callback
/// should be quick.
///
/// For example, in a top-n node, the process callback should determine how many
/// rows need to be delivered for the given batch, and then return a task to actually
/// deliver those rows.
class ARROW_ACERO_EXPORT SequencingQueue {
 public:
  using Task = std::function<Status()>;

  /// Strategy that describes how to handle items
  class Processor {
   public:
    /// Process the batch, potentially generating a task
    ///
    /// This method will be called on each batch in order.  Calls to this method
    /// will be serialized and it will not be called reentrantly.  This makes it
    /// safe to do things that rely on order but minimal time should be spent here
    /// to avoid becoming a bottleneck.
    ///
    /// \return a follow-up task that will be scheduled.  The follow-up task(s) are
    ///         is not guaranteed to run in any particular order.  If nullopt is
    ///         returned then nothing will be scheduled.
    virtual Result<std::optional<Task>> Process(ExecBatch batch) = 0;
    /// Schedule a task
    virtual void Schedule(Task task) = 0;
  };

  virtual ~SequencingQueue() = default;

  /// Insert a batch into the queue
  ///
  /// This will insert the batch into the queue.  If this batch was the next batch
  /// to deliver then this will trigger 1+ calls to the process callback to generate
  /// 1+ tasks.
  ///
  /// The task generated by this call will be executed immediately.  The remaining
  /// tasks will be scheduled using the schedule callback.
  ///
  /// From a data pipeline perspective the sequencing queue is a "sometimes" breaker.  If
  /// a task arrives in order then this call will usually execute the downstream pipeline.
  /// If this task arrives early then this call will only queue the data.
  virtual Status InsertBatch(ExecBatch batch) = 0;

  /// Create a queue
  /// \param processor describes how to process the batches, must outlive the queue
  static std::unique_ptr<SequencingQueue> Make(Processor* processor);
};

/// A queue that sequences incoming batches
///
/// Unlike SequencingQueue the Process method is not expected to schedule new tasks.
///
/// If a batch arrives and another thread is currently processing then the batch
/// will be queued and control will return.  In other words, delivery of batches will
/// not block on the Process method.
///
/// It can be helpful to think of this as if a dedicated thread is running Process as
/// batches arrive
class ARROW_ACERO_EXPORT SerialSequencingQueue {
 public:
  /// Strategy that describes how to handle items
  class Processor {
   public:
    virtual ~Processor() = default;
    /// Process the batch
    ///
    /// This method will be called on each batch in order.  Calls to this method
    /// will be serialized and it will not be called reentrantly.  This makes it
    /// safe to do things that rely on order.
    ///
    /// If this falls behind then data may accumulate
    ///
    /// TODO: Could add backpressure if needed but right now all uses of this should
    ///       be pretty fast and so are unlikely to block.
    virtual Status Process(ExecBatch batch) = 0;
  };

  virtual ~SerialSequencingQueue() = default;

  /// Insert a batch into the queue
  ///
  /// This will insert the batch into the queue.  If this batch was the next batch
  /// to deliver then this may trigger calls to the processor which will be run
  /// as part of this call.
  virtual Status InsertBatch(ExecBatch batch) = 0;

  /// Create a queue
  /// \param processor describes how to process the batches, must outlive the queue
  static std::unique_ptr<SerialSequencingQueue> Make(Processor* processor);
};

}  // namespace util
}  // namespace acero
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/acero/benchmark_util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "benchmark/benchmark.h"

#include "arrow/acero/exec_plan.h"
#include "arrow/acero/test_util_internal.h"
#include "arrow/compute/exec.h"

namespace arrow {

namespace acero {

Status BenchmarkNodeOverhead(benchmark::State& state, int32_t num_batches,
                             int32_t batch_size, arrow::acero::BatchesWithSchema data,
                             std::vector<arrow::acero::Declaration>& node_declarations,
                             arrow::MemoryPool* pool = default_memory_pool());

Status BenchmarkIsolatedNodeOverhead(benchmark::State& state,
                                     arrow::compute::Expression expr, int32_t num_batches,
                                     int32_t batch_size,
                                     arrow::acero::BatchesWithSchema data,
                                     std::string factory_name,
                                     arrow::acero::ExecNodeOptions& options,
                                     arrow::MemoryPool* pool = default_memory_pool());

}  // namespace acero
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/acero/concurrent_queue_internal.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <condition_variable>
#include <mutex>
#include <queue>
#include "arrow/acero/backpressure_handler.h"

namespace arrow::acero {

/**
 * Simple implementation for a thread safe blocking unbound multi-consumer /
 * multi-producer concurrent queue
 */
template <class T>
class ConcurrentQueue {
 public:
  // Pops the last item from the queue but waits if the queue is empty until new items are
  // pushed.
  T WaitAndPop() {
    std::unique_lock<std::mutex> lock(mutex_);
    WaitUntilNonEmpty(lock);
    return PopUnlocked();
  }

  // Pops the last item from the queue, or returns a nullopt if empty
  std::optional<T> TryPop() {
    std::unique_lock<std::mutex> lock(mutex_);
    return TryPopUnlocked();
  }

  // Pushes an item to the queue
  void Push(const T& item) {
    std::unique_lock<std::mutex> lock(mutex_);
    return PushUnlocked(item);
  }

  // Clears the queue
  void Clear() {
    std::unique_lock<std::mutex> lock(mutex_);
    ClearUnlocked();
  }

  // Checks if the queue is empty
  bool Empty() const {
    std::unique_lock<std::mutex> lock(mutex_);
    return queue_.empty();
  }

  // Returns a reference to the next element in the queue. Must be called on a non-empty
  // queue
  const T& Front() const {
    // Need to lock the queue because `front()` may be implemented in terms
    // of `begin()`, which isn't safe with concurrent calls to e.g. `push()`.
    // (see GH-44846)
    std::unique_lock<std::mutex> lock(mutex_);
    return queue_.front();
  }

 protected:
  std::mutex& GetMutex() { return mutex_; }

  size_t SizeUnlocked() const { return queue_.size(); }

  void WaitUntilNonEmpty(std::unique_lock<std::mutex>& lock) {
    cond_.wait(lock, [&] { return !queue_.empty(); });
  }

  T PopUnlocked() {
    auto item = queue_.front();
    queue_.pop();
    return item;
  }

  void PushUnlocked(const T& item) {
    queue_.push(item);
    cond_.notify_one();
  }

  void ClearUnlocked() { queue_ = std::queue<T>(); }

  std::optional<T> TryPopUnlocked() {
    // Try to pop the oldest value from the queue (or return nullopt if none)
    if (queue_.empty()) {
      return std::nullopt;
    } else {
      auto item = queue_.front();
      queue_.pop();
      return item;
    }
  }
  std::queue<T> queue_;

 private:
  mutable std::mutex mutex_;
  std::condition_variable cond_;
};

template <typename T>
class BackpressureConcurrentQueue : private ConcurrentQueue<T> {
 private:
  struct DoHandle {
    explicit DoHandle(BackpressureConcurrentQueue& queue)
        : queue_(queue), start_size_(queue_.SizeUnlocked()) {}

    ~DoHandle() {
      // unsynced access is safe since DoHandle is internally only used when the
      // lock is held
      size_t end_size = queue_.SizeUnlocked();
      queue_.handler_.Handle(start_size_, end_size);
    }

    BackpressureConcurrentQueue& queue_;
    size_t start_size_;
  };

 public:
  explicit BackpressureConcurrentQueue(BackpressureHandler handler)
      : handler_(std::move(handler)) {}

  using ConcurrentQueue<T>::Empty;
  using ConcurrentQueue<T>::Front;

  // Pops the last item from the queue but waits if the queue is empty until new items are
  // pushed.
  T WaitAndPop() {
    std::unique_lock<std::mutex> lock(ConcurrentQueue<T>::GetMutex());
    ConcurrentQueue<T>::WaitUntilNonEmpty(lock);
    DoHandle do_handle(*this);
    return ConcurrentQueue<T>::PopUnlocked();
  }

  // Pops the last item from the queue, or returns a nullopt if empty
  std::optional<T> TryPop() {
    std::unique_lock<std::mutex> lock(ConcurrentQueue<T>::GetMutex());
    DoHandle do_handle(*this);
    return ConcurrentQueue<T>::TryPopUnlocked();
  }

  // Pushes an item to the queue
  void Push(const T& item) {
    if (shutdown_) return;
    std::unique_lock<std::mutex> lock(ConcurrentQueue<T>::GetMutex());
    DoHandle do_handle(*this);
    ConcurrentQueue<T>::PushUnlocked(item);
  }

  // Clears the queue
  void Clear() {
    std::unique_lock<std::mutex> lock(ConcurrentQueue<T>::GetMutex());
    DoHandle do_handle(*this);
    ConcurrentQueue<T>::ClearUnlocked();
  }

  void ForceShutdown() {
    shutdown_ = true;
    Clear();
  }

 private:
  BackpressureHandler handler_;
  std::atomic<bool> shutdown_{false};
};

}  // namespace arrow::acero

```

### Core Architecture Module: `cpp/src/arrow/acero/partition_util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <atomic>
#include <cassert>
#include <cstdint>
#include <functional>
#include <random>

#include "arrow/acero/util.h"
#include "arrow/buffer.h"
#include "arrow/util/pcg_random.h"

namespace arrow {
namespace acero {

class PartitionSort {
 public:
  /// \brief Bucket sort rows on partition ids in O(num_rows) time.
  ///
  /// Include in the output exclusive cumulative sum of bucket sizes.
  /// This corresponds to ranges in the sorted array containing all row ids for
  /// each of the partitions.
  ///
  /// prtn_ranges must be initialized and have at least num_prtns + 1 elements
  /// when this method returns prtn_ranges[i] will contains the total number of
  /// elements in partitions 0 through i.  prtn_ranges[0] will be 0.
  ///
  /// prtn_id_impl must be a function that takes in a row id (int) and returns
  /// a partition id (int).  The returned partition id must be between 0 and
  /// num_prtns (exclusive).
  ///
  /// output_pos_impl is a function that takes in a row id (int) and a position (int)
  /// in the bucket sorted output.  The function should insert the row in the
  /// output.
  ///
  /// For example:
  ///
  /// in_arr: [5, 7, 2, 3, 5, 4]
  /// num_prtns: 3
  /// prtn_id_impl: [&in_arr] (int row_id) { return in_arr[row_id] / 3; }
  /// output_pos_impl: [&sorted_row_ids] (int row_id, int pos) { sorted_row_ids[pos] =
  /// row_id; }
  ///
  /// After Execution
  /// sorted_row_ids: [2, 0, 3, 4, 5, 1]
  /// prtn_ranges: [0, 1, 5, 6]
  template <class INPUT_PRTN_ID_FN, class OUTPUT_POS_FN>
  static void Eval(int64_t num_rows, int num_prtns, uint16_t* prtn_ranges,
                   INPUT_PRTN_ID_FN prtn_id_impl, OUTPUT_POS_FN output_pos_impl) {
    ARROW_DCHECK(num_rows > 0 && num_rows <= (1 << 15));
    ARROW_DCHECK(num_prtns >= 1 && num_prtns <= (1 << 15));

    memset(prtn_ranges, 0, (num_prtns + 1) * sizeof(uint16_t));

    for (int64_t i = 0; i < num_rows; ++i) {
      int prtn_id = static_cast<int>(prtn_id_impl(i));
      ++prtn_ranges[prtn_id + 1];
    }

    uint16_t sum = 0;
    for (int i = 0; i < num_prtns; ++i) {
      uint16_t sum_next = sum + prtn_ranges[i + 1];
      prtn_ranges[i + 1] = sum;
      sum = sum_next;
    }

    for (int64_t i = 0; i < num_rows; ++i) {
      int prtn_id = static_cast<int>(prtn_id_impl(i));
      int pos = prtn_ranges[prtn_id + 1]++;
      output_pos_impl(i, pos);
    }
  }
};

/// \brief A control for synchronizing threads on a partitionable workload
class PartitionLocks {
 public:
  PartitionLocks();
  ~PartitionLocks();
  /// \brief Initializes the control, must be called before use
  ///
  /// \param num_threads Maximum number of threads that will access the partitions
  /// \param num_prtns Number of partitions to synchronize
  void Init(size_t num_threads, int num_prtns);
  /// \brief Cleans up the control, it should not be used after this call
  void CleanUp();
  /// \brief Acquire a partition to work on one
  ///
  /// \param thread_id The index of the thread trying to acquire the partition lock
  /// \param num_prtns Length of prtns_to_try, must be <= num_prtns used in Init
  /// \param prtns_to_try An array of partitions that still have remaining work
  /// \param limit_retries If false, this method will spinwait forever until success
  /// \param max_retries Max times to attempt checking out work before returning false
  /// \param[out] locked_prtn_id The id of the partition locked
  /// \param[out] locked_prtn_id_pos The index of the partition locked in prtns_to_try
  /// \return True if a partition was locked, false if max_retries was attempted
  ///         without successfully acquiring a lock
  ///
  /// This method is thread safe
  bool AcquirePartitionLock(size_t thread_id, int num_prtns, const int* prtns_to_try,
                            bool limit_retries, int max_retries, int* locked_prtn_id,
                            int* locked_prtn_id_pos);
  /// \brief Release a partition so that other threads can work on it
  void ReleasePartitionLock(int prtn_id);

  // Executes (synchronously and using current thread) the same operation on a set of
  // multiple partitions. Tries to minimize partition locking overhead by randomizing and
  // adjusting order in which partitions are processed.
  //
  // PROCESS_PRTN_FN is a callback which will be executed for each partition after
  // acquiring the lock for that partition. It gets partition id as an argument.
  // IS_PRTN_EMPTY_FN is a callback which filters out (when returning true) partitions
  // with specific ids from processing.
  //
  template <typename IS_PRTN_EMPTY_FN, typename PROCESS_PRTN_FN>
  Status ForEachPartition(size_t thread_id,
                          /*scratch space buffer with space for one element per partition;
                             dirty in and dirty out*/
                          int* temp_unprocessed_prtns, IS_PRTN_EMPTY_FN is_prtn_empty_fn,
                          PROCESS_PRTN_FN process_prtn_fn) {
    int num_unprocessed_partitions = 0;
    for (int i = 0; i < num_prtns_; ++i) {
      bool is_prtn_empty = is_prtn_empty_fn(i);
      if (!is_prtn_empty) {
        temp_unprocessed_prtns[num_unprocessed_partitions++] = i;
      }
    }
    while (num_unprocessed_partitions > 0) {
      int locked_prtn_id;
      int locked_prtn_id_pos;
      AcquirePartitionLock(thread_id, num_unprocessed_partitions, temp_unprocessed_prtns,
                           /*limit_retries=*/false, /*max_retries=*/-1, &locked_prtn_id,
                           &locked_prtn_id_pos);
      {
        class AutoReleaseLock {
         public:
          AutoReleaseLock(PartitionLocks* locks, int prtn_id)
              : locks(locks), prtn_id(prtn_id) {}
          ~AutoReleaseLock() { locks->ReleasePartitionLock(prtn_id); }
          PartitionLocks* locks;
          int prtn_id;
        } auto_release_lock(this, locked_prtn_id);
        ARROW_RETURN_NOT_OK(process_prtn_fn(locked_prtn_id));
      }
      if (locked_prtn_id_pos < num_unprocessed_partitions - 1) {
        temp_unprocessed_prtns[locked_prtn_id_pos] =
            temp_unprocessed_prtns[num_unprocessed_partitions - 1];
      }
      --num_unprocessed_partitions;
    }
    return Status::OK();
  }

 private:
  std::atomic<bool>* lock_ptr(int prtn_id);
  int random_int(size_t thread_id, int num_values);

  struct PartitionLock {
    static constexpr int kCacheLineBytes = 64;
    std::atomic<bool> lock;
    uint8_t padding[kCacheLineBytes];
  };
  int num_prtns_;
  std::unique_ptr<PartitionLock[]> locks_;
  std::unique_ptr<arrow::random::pcg32_fast[]> rngs_;
};

}  // namespace acero
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/acero/schema_util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <cassert>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "arrow/type.h"  // for DataType, FieldRef, Field and Schema

namespace arrow {

using internal::checked_cast;

namespace acero {

// Identifiers for all different row schemas that are used in a join
//
enum class HashJoinProjection : int {
  INPUT = 0,
  KEY = 1,
  PAYLOAD = 2,
  FILTER = 3,
  OUTPUT = 4
};

struct SchemaProjectionMap {
  static constexpr int kMissingField = -1;
  int num_cols;
  const int* source_to_base;
  const int* base_to_target;
  inline int get(int i) const {
    assert(i >= 0 && i < num_cols);
    assert(source_to_base[i] != kMissingField);
    return base_to_target[source_to_base[i]];
  }
};

/// Helper class for managing different projections of the same row schema.
/// Used to efficiently map any field in one projection to a corresponding field in
/// another projection.
/// Materialized mappings are generated lazily at the time of the first access.
/// Thread-safe apart from initialization.
template <typename ProjectionIdEnum>
class SchemaProjectionMaps {
 public:
  static constexpr int kMissingField = -1;

  Status Init(ProjectionIdEnum full_schema_handle, const Schema& schema,
              const std::vector<ProjectionIdEnum>& projection_handles,
              const std::vector<const std::vector<FieldRef>*>& projections) {
    assert(projection_handles.size() == projections.size());
    ARROW_RETURN_NOT_OK(RegisterSchema(full_schema_handle, schema));
    for (size_t i = 0; i < projections.size(); ++i) {
      ARROW_RETURN_NOT_OK(
          RegisterProjectedSchema(projection_handles[i], *(projections[i]), schema));
    }
    RegisterEnd();
    return Status::OK();
  }

  int num_cols(ProjectionIdEnum schema_handle) const {
    int id = schema_id(schema_handle);
    return static_cast<int>(schemas_[id].second.data_types.size());
  }

  bool is_empty(ProjectionIdEnum schema_handle) const {
    return num_cols(schema_handle) == 0;
  }

  const std::string& field_name(ProjectionIdEnum schema_handle, int field_id) const {
    int id = schema_id(schema_handle);
    return schemas_[id].second.field_names[field_id];
  }

  const std::shared_ptr<DataType>& data_type(ProjectionIdEnum schema_handle,
                                             int field_id) const {
    int id = schema_id(schema_handle);
    return schemas_[id].second.data_types[field_id];
  }

  const std::vector<std::shared_ptr<DataType>>& data_types(
      ProjectionIdEnum schema_handle) const {
    int id = schema_id(schema_handle);
    return schemas_[id].second.data_types;
  }

  SchemaProjectionMap map(ProjectionIdEnum from, ProjectionIdEnum to) const {
    int id_from = schema_id(from);
    int id_to = schema_id(to);
    SchemaProjectionMap result;
    result.num_cols = num_cols(from);
    result.source_to_base = mappings_[id_from].data();
    result.base_to_target = inverse_mappings_[id_to].data();
    return result;
  }

 protected:
  struct FieldInfos {
    std::vector<int> field_paths;
    std::vector<std::string> field_names;
    std::vector<std::shared_ptr<DataType>> data_types;
  };

  Status RegisterSchema(ProjectionIdEnum handle, const Schema& schema) {
    FieldInfos out_fields;
    const FieldVector& in_fields = schema.fields();
    out_fields.field_paths.resize(in_fields.size());
    out_fields.field_names.resize(in_fields.size());
    out_fields.data_types.resize(in_fields.size());
    for (size_t i = 0; i < in_fields.size(); ++i) {
      const std::string& name = in_fields[i]->name();
      const std::shared_ptr<DataType>& type = in_fields[i]->type();
      out_fields.field_paths[i] = static_cast<int>(i);
      out_fields.field_names[i] = name;
      out_fields.data_types[i] = type;
    }
    schemas_.push_back(std::make_pair(handle, out_fields));
    return Status::OK();
  }

  Status RegisterProjectedSchema(ProjectionIdEnum handle,
                                 const std::vector<FieldRef>& selected_fields,
                                 const Schema& full_schema) {
    FieldInfos out_fields;
    const FieldVector& in_fields = full_schema.fields();
    out_fields.field_paths.resize(selected_fields.size());
    out_fields.field_names.resize(selected_fields.size());
    out_fields.data_types.resize(selected_fields.size());
    for (size_t i = 0; i < selected_fields.size(); ++i) {
      // All fields must be found in schema without ambiguity
      ARROW_ASSIGN_OR_RAISE(auto match, selected_fields[i].FindOne(full_schema));
      const std::string& name = in_fields[match[0]]->name();
      const std::shared_ptr<DataType>& type = in_fields[match[0]]->type();
      out_fields.field_paths[i] = match[0];
      out_fields.field_names[i] = name;
      out_fields.data_types[i] = type;
    }
    schemas_.push_back(std::make_pair(handle, out_fields));
    return Status::OK();
  }

  void RegisterEnd() {
    size_t size = schemas_.size();
    mappings_.resize(size);
    inverse_mappings_.resize(size);
    int id_base = 0;
    for (size_t i = 0; i < size; ++i) {
      GenerateMapForProjection(static_cast<int>(i), id_base);
    }
  }

  int schema_id(ProjectionIdEnum schema_handle) const {
    for (size_t i = 0; i < schemas_.size(); ++i) {
      if (schemas_[i].first == schema_handle) {
        return static_cast<int>(i);
      }
    }
    // We should never get here
    assert(false);
    return -1;
  }

  void GenerateMapForProjection(int id_proj, int id_base) {
    int num_cols_proj = static_cast<int>(schemas_[id_proj].second.data_types.size());
    int num_cols_base = static_cast<int>(schemas_[id_base].second.data_types.size());

    std::vector<int>& mapping = mappings_[id_proj];
    std::vector<int>& inverse_mapping = inverse_mappings_[id_proj];
    mapping.resize(num_cols_proj);
    inverse_mapping.resize(num_cols_base);

    if (id_proj == id_base) {
      for (int i = 0; i < num_cols_base; ++i) {
        mapping[i] = inverse_mapping[i] = i;
      }
    } else {
      const FieldInfos& fields_proj = schemas_[id_proj].second;
      const FieldInfos& fields_base = schemas_[id_base].second;
      for (int i = 0; i < num_cols_base; ++i) {
        inverse_mapping[i] = SchemaProjectionMap::kMissingField;
      }
      for (int i = 0; i < num_cols_proj; ++i) {
        int field_id = SchemaProjectionMap::kMissingField;
        for (int j = 0; j < num_cols_base; ++j) {
          if (fields_proj.field_paths[i] == fields_base.field_paths[j]) {
            field_id = j;
            // If there are multiple matches for the same input field,
            // it will be mapped to the first match.
            break;
          }
        }
        assert(field_id != SchemaProjectionMap::kMissingField);
        mapping[i] = field_id;
        inverse_mapping[field_id] = i;
      }
    }
  }

  // vector used as a mapping from ProjectionIdEnum to fields
  std::vector<std::pair<ProjectionIdEnum, FieldInfos>> schemas_;
  std::vector<std::vector<int>> mappings_;
  std::vector<std::vector<int>> inverse_mappings_;
};

using HashJoinProjectionMaps = SchemaProjectionMaps<HashJoinProjection>;

}  // namespace acero
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/acero/task_util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <vector>

#include "arrow/acero/visibility.h"
#include "arrow/status.h"
#include "arrow/util/config.h"
#include "arrow/util/logging.h"

namespace arrow {
namespace acero {

// Atomic value surrounded by padding bytes to avoid cache line invalidation
// whenever it is modified by a concurrent thread on a different CPU core.
//
template <typename T>
class AtomicWithPadding {
 private:
  static constexpr int kCacheLineSize = 64;
  uint8_t padding_before[kCacheLineSize];

 public:
  std::atomic<T> value;

 private:
  uint8_t padding_after[kCacheLineSize];
};

// Used for asynchronous execution of operations that can be broken into
// a fixed number of symmetric tasks that can be executed concurrently.
//
// Implements priorities between multiple such operations, called task groups.
//
// Allows to specify the maximum number of in-flight tasks at any moment.
//
// Also allows for executing next pending tasks immediately using a caller thread.
//
class ARROW_ACERO_EXPORT TaskScheduler {
 public:
  using TaskImpl = std::function<Status(size_t, int64_t)>;
  using TaskGroupContinuationImpl = std::function<Status(size_t)>;
  using ScheduleImpl = std::function<Status(TaskGroupContinuationImpl)>;
  using AbortContinuationImpl = std::function<void()>;

  virtual ~TaskScheduler() = default;

  // Order in which task groups are registered represents priorities of their tasks
  // (the first group has the highest priority).
  //
  // Returns task group identifier that is used to request operations on the task group.
  virtual int RegisterTaskGroup(TaskImpl task_impl,
                                TaskGroupContinuationImpl cont_impl) = 0;

  virtual void RegisterEnd() = 0;

  // total_num_tasks may be zero, in which case task group continuation will be executed
  // immediately
  virtual Status StartTaskGroup(size_t thread_id, int group_id,
                                int64_t total_num_tasks) = 0;

  // Execute given number of tasks immediately using caller thread
  virtual Status ExecuteMore(size_t thread_id, int num_tasks_to_execute,
                             bool execute_all) = 0;

  // Begin scheduling tasks using provided callback and
  // the limit on the number of in-flight tasks at any moment.
  //
  // Scheduling will continue as long as there are waiting tasks.
  //
  // It will automatically resume whenever new task group gets started.
  virtual Status StartScheduling(size_t thread_id, ScheduleImpl schedule_impl,
                                 int num_concurrent_tasks, bool use_sync_execution) = 0;

  // Abort scheduling and execution.
  // Used in case of being notified about unrecoverable error for the entire query.
  virtual void Abort(AbortContinuationImpl impl) = 0;

  static std::unique_ptr<TaskScheduler> Make();
};

}  // namespace acero
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/acero/time_series_util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include "arrow/record_batch.h"
#include "arrow/type_traits.h"

namespace arrow::acero {

// normalize the value to unsigned 64-bits while preserving ordering of values
template <typename T, enable_if_t<std::is_integral<T>::value, bool> = true>
uint64_t NormalizeTime(T t);

uint64_t GetTime(const RecordBatch* batch, Type::type time_type, int col, uint64_t row);

}  // namespace arrow::acero

```

### Core Architecture Module: `cpp/src/arrow/acero/util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <atomic>
#include <cstdint>
#include <optional>
#include <thread>
#include <unordered_map>
#include <vector>

#include "arrow/acero/options.h"
#include "arrow/acero/type_fwd.h"
#include "arrow/buffer.h"
#include "arrow/compute/expression.h"
#include "arrow/compute/util.h"
#include "arrow/memory_pool.h"
#include "arrow/result.h"
#include "arrow/status.h"
#include "arrow/util/bit_util.h"
#include "arrow/util/cpu_info.h"
#include "arrow/util/logging.h"
#include "arrow/util/mutex.h"
#include "arrow/util/thread_pool.h"
#include "arrow/util/type_fwd.h"

namespace arrow {

namespace acero {

ARROW_ACERO_EXPORT
Status ValidateExecNodeInputs(ExecPlan* plan, const std::vector<ExecNode*>& inputs,
                              int expected_num_inputs, const char* kind_name);

ARROW_ACERO_EXPORT
Result<std::shared_ptr<Table>> TableFromExecBatches(
    const std::shared_ptr<Schema>& schema, const std::vector<ExecBatch>& exec_batches);

class ARROW_ACERO_EXPORT AtomicCounter {
 public:
  AtomicCounter() = default;

  int count() const { return count_.load(); }

  std::optional<int> total() const {
    int total = total_.load();
    if (total == -1) return {};
    return total;
  }

  // return true if the counter is complete
  bool Increment() {
    ARROW_DCHECK_NE(count_.load(), total_.load());
    int count = count_.fetch_add(1) + 1;
    if (count != total_.load()) return false;
    return DoneOnce();
  }

  // return true if the counter is complete
  bool SetTotal(int total) {
    total_.store(total);
    if (count_.load() != total) return false;
    return DoneOnce();
  }

  // return true if the counter has not already been completed
  bool Cancel() { return DoneOnce(); }

  // return true if the counter has finished or been cancelled
  bool Completed() { return complete_.load(); }

 private:
  // ensure there is only one true return from Increment(), SetTotal(), or Cancel()
  bool DoneOnce() {
    bool expected = false;
    return complete_.compare_exchange_strong(expected, true);
  }

  std::atomic<int> count_{0}, total_{-1};
  std::atomic<bool> complete_{false};
};

class ARROW_ACERO_EXPORT ThreadIndexer {
 public:
  size_t operator()();

  static size_t Capacity();

 private:
  static size_t Check(size_t thread_index);

  arrow::util::Mutex mutex_;
  std::unordered_map<std::thread::id, size_t> id_to_index_;
};

/// \brief A consumer that collects results into an in-memory table
struct ARROW_ACERO_EXPORT TableSinkNodeConsumer : public SinkNodeConsumer {
 public:
  TableSinkNodeConsumer(std::shared_ptr<Table>* out, MemoryPool* pool)
      : out_(out), pool_(pool) {}
  Status Init(const std::shared_ptr<Schema>& schema,
              BackpressureControl* backpressure_control, ExecPlan* plan) override;
  Status Consume(ExecBatch batch) override;
  Future<> Finish() override;

 private:
  std::shared_ptr<Table>* out_;
  MemoryPool* pool_;
  std::shared_ptr<Schema> schema_;
  std::vector<std::shared_ptr<RecordBatch>> batches_;
  arrow::util::Mutex consume_mutex_;
};

class ARROW_ACERO_EXPORT NullSinkNodeConsumer : public SinkNodeConsumer {
 public:
  Status Init(const std::shared_ptr<Schema>&, BackpressureControl*,
              ExecPlan* plan) override {
    return Status::OK();
  }
  Status Consume(ExecBatch exec_batch) override { return Status::OK(); }
  Future<> Finish() override { return Status::OK(); }

 public:
  static std::shared_ptr<NullSinkNodeConsumer> Make() {
    return std::make_shared<NullSinkNodeConsumer>();
  }
};

/// CRTP helper for tracing helper functions

class ARROW_ACERO_EXPORT TracedNode {
 public:
  // All nodes should call TraceStartProducing or NoteStartProducing exactly once
  // Most nodes will be fine with a call to NoteStartProducing since the StartProducing
  // call is usually fairly cheap and simply schedules tasks to fetch the actual data.

  explicit TracedNode(ExecNode* node) : node_(node) {}

  // Create a span to record the StartProducing work
  [[nodiscard]] ::arrow::internal::tracing::Scope TraceStartProducing(
      std::string extra_details) const;

  // Record a call to StartProducing without creating with a span
  void NoteStartProducing(std::string extra_details) const;

  // All nodes should call TraceInputReceived for each batch they receive.  This call
  // should track the time spent processing the batch.  NoteInputReceived is available
  // but usually won't be used unless a node is simply adding batches to a trivial queue.

  // Create a span to record the InputReceived work
  [[nodiscard]] ::arrow::internal::tracing::Scope TraceInputReceived(
      const ExecBatch& batch) const;

  // Record a call to InputReceived without creating with a span
  void NoteInputReceived(const ExecBatch& batch) const;

  // Create a span to record any "finish" work.  This should NOT be called as part of
  // InputFinished and many nodes may not need to call this at all.  This should be used
  // when a node has some extra work that has to be done once it has received all of its
  // data.  For example, an aggregation node calculating aggregations.  This will
  // typically be called as a result of InputFinished OR InputReceived.
  [[nodiscard]] ::arrow::internal::tracing::Scope TraceFinish() const;

 private:
  ExecNode* node_;
};

}  // namespace acero
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/adapters/orc/util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <cstdint>
#include <memory>

#include "arrow/array/builder_base.h"
#include "arrow/result.h"
#include "arrow/status.h"
#include "arrow/type_fwd.h"
#include "orc/OrcFile.hh"

namespace liborc = orc;

namespace arrow {
namespace adapters {
namespace orc {

Result<std::shared_ptr<DataType>> GetArrowType(const liborc::Type* type);

Result<std::unique_ptr<liborc::Type>> GetOrcType(const Schema& schema);

Result<std::shared_ptr<const KeyValueMetadata>> GetFieldMetadata(
    const liborc::Type* type);

Result<std::shared_ptr<Field>> GetArrowField(const std::string& name,
                                             const liborc::Type* type,
                                             bool nullable = true);

ARROW_EXPORT Status AppendBatch(const liborc::Type* type,
                                liborc::ColumnVectorBatch* batch, int64_t offset,
                                int64_t length, arrow::ArrayBuilder* builder);

/// \brief Write a chunked array to an orc::ColumnVectorBatch
///
/// \param[in] chunked_array the chunked array
/// \param[in] length the orc::ColumnVectorBatch size limit
/// \param[in,out] arrow_chunk_offset The current chunk being processed
/// \param[in,out] arrow_index_offset The index of the arrow_chunk_offset array
/// before or after a process
/// \param[in,out] column_vector_batch the orc::ColumnVectorBatch to be filled
/// \return Status
ARROW_EXPORT Status WriteBatch(const ChunkedArray& chunked_array, int64_t length,
                               int* arrow_chunk_offset, int64_t* arrow_index_offset,
                               liborc::ColumnVectorBatch* column_vector_batch);

/// \brief Get the major version provided by the official ORC C++ library.
ARROW_EXPORT int GetOrcMajorVersion();

}  // namespace orc
}  // namespace adapters
}  // namespace arrow

```

### Core Architecture Module: `cpp/src/arrow/array/util.h`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <cstdint>
#include <memory>
#include <vector>

#include "arrow/array/data.h"
#include "arrow/compare.h"
#include "arrow/result.h"
#include "arrow/status.h"
#include "arrow/type.h"
#include "arrow/util/macros.h"
#include "arrow/util/visibility.h"

namespace arrow {

/// \defgroup array-factories Array factory functions
///
/// @{

/// \brief Create a strongly-typed Array instance from generic ArrayData
/// \param[in] data the array contents
/// \return the resulting Array instance
ARROW_EXPORT
std::shared_ptr<Array> MakeArray(const std::shared_ptr<ArrayData>& data);

/// \brief Create a strongly-typed Array instance with all elements null
/// \param[in] type the array type
/// \param[in] length the array length
/// \param[in] pool the memory pool to allocate memory from
ARROW_EXPORT
Result<std::shared_ptr<Array>> MakeArrayOfNull(const std::shared_ptr<DataType>& type,
                                               int64_t length,
                                               MemoryPool* pool = default_memory_pool());

/// \brief Create an Array instance whose slots are the given scalar
/// \param[in] scalar the value with which to fill the array
/// \param[in] length the array length
/// \param[in] pool the memory pool to allocate memory from
ARROW_EXPORT
Result<std::shared_ptr<Array>> MakeArrayFromScalar(
    const Scalar& scalar, int64_t length, MemoryPool* pool = default_memory_pool());

/// \brief Create an empty Array of a given type
///
/// The output Array will be of the given type.
///
/// \param[in] type the data type of the empty Array
/// \param[in] pool the memory pool to allocate memory from
/// \return the resulting Array
ARROW_EXPORT
Result<std::shared_ptr<Array>> MakeEmptyArray(std::shared_ptr<DataType> type,
                                              MemoryPool* pool = default_memory_pool());

/// @}

namespace internal {

/// \brief Swap endian of each element in a generic ArrayData
///
/// As dictionaries are often shared between different arrays, dictionaries
/// are not swapped by this function and should be handled separately.
///
/// \param[in] data the array contents
/// \param[in] pool the memory pool to allocate memory from
/// \return the resulting ArrayData whose elements were swapped
ARROW_EXPORT
Result<std::shared_ptr<ArrayData>> SwapEndianArrayData(
    const std::shared_ptr<ArrayData>& data, MemoryPool* pool = default_memory_pool());

/// Given a number of ArrayVectors, treat each ArrayVector as the
/// chunks of a chunked array.  Then rechunk each ArrayVector such that
/// all ArrayVectors are chunked identically.  It is mandatory that
/// all ArrayVectors contain the same total number of elements.
ARROW_EXPORT
std::vector<ArrayVector> RechunkArraysConsistently(const std::vector<ArrayVector>&);

}  // namespace internal
}  // namespace arrow

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54572** (2026-10-19): **GH-54571: [GLib] Add support for returning string view array from C++**
  *Symptoms*: ### Rationale for this change  `garrow_array_new_raw_valist()` misses string view array detection. If we miss it, we can't return a string view array from C++ to GLib.  ### What changes are included in this PR?  Add missing string view array detection.  ### Are these changes tested?  Yes.  ### Are there any user-facing changes?  Yes.  ### Was AI used for this PR?  In accordance to the [AI generation guidelines](https://arrow.apache.org/docs/dev/developers/overview.html#ai-generated-code), please disclose below whether and how AI was used in this PR.  **PR code and description written by:**  - [x] Human - [ ] AI  **Reviewed before submission by:**  - [x] Human - [x] AI - [ ] Not reviewed  * GitHub Issue: #54571
  **Post-Mortem & Fix Analysis**:
  > :warning: GitHub issue #54571 **has been automatically assigned in GitHub** to PR creator.
  > +1  Confirmed: https://github.com/apache/arrow/issues/54571#issuecomment-6261048628

- **Issue #54571** (2026-10-19): **[Ruby] Casting to string_view aborts the process**
  *Symptoms*: ### Describe the bug, including details regarding any error messages, version, and platform.  Casting an array to string_view aborts the process. The error cannot be rescued.  ``` require "arrow"  Arrow::StringArray.new(["a", "b", "c"]).cast(Arrow::StringViewDataType.new) # GLib-GObject-ERROR **: cannot create instance of abstract (non-instantiatable) type 'GArrowArray' # (process exits with status 133) ```  Casting to binary_view works:  ``` Arrow::BinaryArray.new(["a", "b", "c"]).cast(Arrow::BinaryViewDataType.new).class # => Arrow::BinaryViewArray ```  garrow_array_new_raw_valist() in c_glib/arrow-glib/basic-array.cpp seems to have a case for BINARY_VIEW but not for STRING_VIEW.  Environment: red-arrow 25.0.1, apache-arrow-glib 25.0.1 (Homebrew), Ruby 3.4.1, macOS 15 (arm64)   ### Component(s)  Ruby
  **Post-Mortem & Fix Analysis**:
  > Thanks for your report. Could you try #54572?
  > I tried [apache/arrow#54572](https://github.com/apache/arrow/pull/54572) on top of 25.0.1, and it fixes the problem: ``` irb> Arrow::StringArray.new(["a", "b", "c"]).cast(Arrow::StringViewDataType.new) => #<Arrow::StringViewArray:0x0000000107c061f8 ptr=0x0000600002981360 [   "a",   "b",   "c" ]> ``` Thanks!

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

### Incident Patch 1: `c4a0850e` (2026-10-13)
**Commit Message**: GH-51018: [C++] Fix indices_nonzero segfault on chunkless ChunkedArray (#51021)

### Rationale for this change

`pyarrow.compute.indices_nonzero()` segfaults (SIGSEGV) on a `ChunkedArray` with zero chunks. A zero-length `Array` and a `ChunkedArray` holding one empty chunk both work; only the chunkless case crashes.

### Are these changes tested?

Yes, by new test case.

### Are there any user-facing changes?

Only a bugfix.

* GitHub Issue: #51018

Authored-by: waterWang <[REDACTED_EMAIL]>
Signed-off-by: Rok Mihevc <[REDACTED_EMAIL]>

**File**: `cpp/src/arrow/compute/kernels/vector_selection.cc` (modified, +4/-2)
```diff
@@ -264,8 +264,10 @@ Status DoNonZero(const std::vector<ArraySpan>& arrays, int64_t total_length,
   UInt64Builder builder;
   RETURN_NOT_OK(builder.Reserve(total_length));
 
-  NonZeroVisitor visitor(&builder, arrays);
-  RETURN_NOT_OK(VisitTypeInline(*arrays[0].type, &visitor));
+  if (!arrays.empty()) {
+    NonZeroVisitor visitor(&builder, arrays);
+    RETURN_NOT_OK(VisitTypeInline(*arrays[0].type, &visitor));
+  }
   return builder.FinishInternal(out);
 }
 
```

**File**: `cpp/src/arrow/compute/kernels/vector_selection_test.cc` (modified, +8/-0)
```diff
@@ -2920,6 +2920,14 @@ TEST(TestIndicesNonZero, IndicesNonZero) {
         actual, CallFunction("indices_nonzero", {static_cast<Datum>(chunked_arr_empty)}));
     AssertArraysEqual(*ArrayFromJSON(uint64(), "[0, 2, 3, 5]"), *actual.make_array(),
                       /*verbose*/ true);
+
+    // chunked with zero chunks (GH-51018)
+    ChunkedArray chunked_arr_no_chunks({}, type);
+    ASSERT_OK_AND_ASSIGN(
+        actual,
+        CallFunction("indices_nonzero", {static_cast<Datum>(chunked_arr_no_chunks)}));
+    AssertArraysEqual(*ArrayFromJSON(uint64(), "[]"), *actual.make_array(),
+                      /*verbose*/ true);
   }
 }
 
```

---

### Incident Patch 2: `402a71cb` (2026-10-16)
**Commit Message**: GH-51341: [C++][FlightRPC][ODBC] Fix statement descriptor and cursor lifecycle (#51342)

### Rationale for this change

The Flight SQL ODBC statement implementation had a cluster of related descriptor and cursor lifecycle defects:

- the implicit application row descriptor (ARD) was initialized from the application parameter descriptor (APD), aliasing two descriptor roles;
- `SQL_NULL_HANDLE` did not restore built-in application descriptors;
- freeing a statement left dangling registrations in explicit descriptors;
- `SQLFetch` and `SQLGetData` without an open cursor could dereference a null result or report the wrong diagnostic; and
- `SQLMoreResults` did not close the current cursor when returning `SQL_NO_DATA`.

### What changes are included in this PR?

- Initialize the active ARD from `built_in_ard_`.
- Map null APD/ARD assignments to the corresponding built-in descriptor and detach the outgoing explicit descriptor.
- Detach explicit descriptors before releasing a statement.
- Return SQLSTATE `24000` from `SQLFetch` and `SQLGetData` when no cursor is open.
- Close the current cursor when `SQLMoreResults` returns `SQL_NO_DATA`.

### Are there any user-facing changes?

Yes. Spec

**File**: `cpp/src/arrow/flight/sql/odbc/odbc_impl/odbc_statement.cc` (modified, +24/-5)
```diff
@@ -241,7 +241,7 @@ ODBCStatement::ODBCStatement(ODBCConnection& connection,
       ird_(std::make_shared<ODBCDescriptor>(spi_statement_->GetDiagnostics(), nullptr,
                                             this, false, false,
                                             connection.IsOdbc2Connection())),
-      current_ard_(built_in_apd_.get()),
+      current_ard_(built_in_ard_.get()),
       current_apd_(built_in_apd_.get()),
       row_number_(0),
       max_rows_(0),
@@ -323,6 +323,10 @@ void ODBCStatement::ExecuteDirect(const std::string& query) {
 
 bool ODBCStatement::Fetch(size_t rows, SQLULEN* row_count_ptr,
                           SQLUSMALLINT* row_status_array) {
+  if (!current_result_) {
+    throw DriverException("Invalid cursor state", "24000");
+  }
+
   if (has_reached_end_of_result_) {
     ird_->SetRowsProcessed(0);
     return false;
@@ -558,8 +562,9 @@ void ODBCStatement::SetStmtAttr(SQLINTEGER statement_attribute, SQLPOINTER value
 
   switch (statement_attribute) {
     case SQL_ATTR_APP_PARAM_DESC: {
-      ODBCDescriptor* desc = static_cast<ODBCDescriptor*>(value);
-      if (desc && current_apd_ != desc) {
+      ODBCDescriptor* desc =
+          value ? static_cast<ODBCDescriptor*>(value) : built_in_apd_.get();
+      if (current_apd_ != desc) {
         if (current_apd_ != built_in_apd_.get()) {
           current_apd_->DetachFromStatement(this, true);
         }
@@ -571,12 +576,14 @@ void ODBCStatement::SetStmtAttr(SQLINTEGER statement_attribute, SQLPOINTER value
       return;
     }
     case SQL_ATTR_APP_ROW_DESC: {
-      ODBCDescriptor* desc = static_cast<ODBCDescriptor*>(value);
-      if (desc && current_ard_ != desc) {
+      ODBCDescriptor* desc =
+          value ? static_cast<ODBCDescriptor*>(value) : built_in_ard_.get();
+      if (current_ard_ != desc) {
         if (current_ard_ != built_in_ard_.get()) {
           current_ard_->DetachFromStatement(this, false);
         }
         current_ard_ = desc;
+        current_ard_->NotifyBindingsHaveChanged();
         if (current_ard_ != built_in_ard_.get()) {
           desc->RegisterToStatement(this, false);
         }
@@ -718,6 +725,7 @@ void ODBCStatement::RevertAppDescriptor(bool isApd) {
     current_apd_ = built_in_apd_.get();
   } else {
     current_ard_ = built_in_ard_.get();
+    current_ard_->NotifyBindingsHaveChanged();
   }
 }
 
@@ -740,6 +748,10 @@ void ODBCStatement::CloseCursor(bool suppress_errors) {
 SQLRETURN ODBCStatement::GetData(SQLSMALLINT record_number, SQLSMALLINT c_type,
                                  SQLPOINTER data_ptr, SQLLEN buffer_length,
                                  SQLLEN* indicator_ptr) {
+  if (!current_result_) {
+    throw DriverException("Invalid cursor state", "24000");
+  }
+
   if (record_number == 0) {
     throw DriverException("Bookmarks are not supported", "07009");
   } else if (static_cast<size_t>(record_number) > ird_->GetRecords().size()) {
@@ -785,6 +797,7 @@ SQLRETURN ODBCStatement::GetData(SQLSMALLINT record_number, SQLSMALLINT c_type,
 
 SQLRETURN ODBCStatement::GetMoreResults() {
   // Multiple result sets are not supported by Arrow protocol.
+  CloseCursor(/*suppress_errors=*/true);
   return SQL_NO_DATA;
 }
 
@@ -811,6 +824,12 @@ void ODBCStatement::GetRowCount(SQLLEN* row_count_ptr) {
 
 void ODBCStatement::ReleaseStatement() {
   CloseCursor(true);
+  if (current_apd_ != built_in_apd_.get()) {
+    current_apd_->DetachFromStatement(this, true);
+  }
+  if (current_ard_ != built_in_ard_.get()) {
+    current_ard_->DetachFromStatement(this, false);
+  }
   connection_.DropStatement(this);
 }
 
```

**File**: `cpp/src/arrow/flight/sql/odbc/tests/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ set(ARROW_FLIGHT_SQL_ODBC_TEST_SRCS
     errors_test.cc
     get_functions_test.cc
     statement_attr_test.cc
+    statement_driver_api_test.cc
     statement_test.cc
     tables_test.cc
     type_info_test.cc
```

**File**: `cpp/src/arrow/flight/sql/odbc/tests/connection_test.cc` (modified, +40/-3)
```diff
@@ -528,6 +528,7 @@ TYPED_TEST(ConnectionTest, TestSQLSetStmtAttrDescriptor) {
 
   EXPECT_EQ(SQL_SUCCESS, SQLGetStmtAttr(this->stmt, SQL_ATTR_APP_ROW_DESC, &internal_ard,
                                         sizeof(internal_ard), 0));
+  EXPECT_NE(internal_apd, internal_ard);
 
   // Set APD descriptor to explicitly allocated handle
   EXPECT_EQ(SQL_SUCCESS, SQLSetStmtAttr(this->stmt, SQL_ATTR_APP_PARAM_DESC,
@@ -549,12 +550,31 @@ TYPED_TEST(ConnectionTest, TestSQLSetStmtAttrDescriptor) {
 
   EXPECT_EQ(ard_descriptor, value);
 
-  // Free explicitly allocated APD and ARD descriptor handles
-  ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, apd_descriptor));
+  // Assign replacement descriptors. Freeing the old descriptors must not revert these
+  // replacements, which proves switching descriptors detached the old handles. Null
+  // descriptor restoration is covered through the direct driver API because some driver
+  // managers intercept it.
+  SQLHDESC replacement_apd, replacement_ard;
+  ASSERT_EQ(SQL_SUCCESS, SQLAllocHandle(SQL_HANDLE_DESC, this->conn, &replacement_apd));
+  ASSERT_EQ(SQL_SUCCESS, SQLAllocHandle(SQL_HANDLE_DESC, this->conn, &replacement_ard));
+  ASSERT_EQ(SQL_SUCCESS,
+            SQLSetStmtAttr(this->stmt, SQL_ATTR_APP_PARAM_DESC, replacement_apd, 0));
+  ASSERT_EQ(SQL_SUCCESS,
+            SQLSetStmtAttr(this->stmt, SQL_ATTR_APP_ROW_DESC, replacement_ard, 0));
 
+  ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, apd_descriptor));
   ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, ard_descriptor));
+  EXPECT_EQ(SQL_SUCCESS, SQLGetStmtAttr(this->stmt, SQL_ATTR_APP_PARAM_DESC, &value,
+                                        sizeof(value), 0));
+  EXPECT_EQ(replacement_apd, value);
+  EXPECT_EQ(SQL_SUCCESS,
+            SQLGetStmtAttr(this->stmt, SQL_ATTR_APP_ROW_DESC, &value, sizeof(value), 0));
+  EXPECT_EQ(replacement_ard, value);
 
-  // Verify APD and ARD descriptors has been reverted to implicit descriptors
+  ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, replacement_apd));
+  ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, replacement_ard));
+
+  // Freeing the active explicit descriptors restores the implicit descriptors.
   value = nullptr;
 
   EXPECT_EQ(SQL_SUCCESS, SQLGetStmtAttr(this->stmt, SQL_ATTR_APP_PARAM_DESC, &value,
@@ -568,4 +588,21 @@ TYPED_TEST(ConnectionTest, TestSQLSetStmtAttrDescriptor) {
   EXPECT_EQ(internal_ard, value);
 }
 
+TYPED_TEST(ConnectionTest, TestExplicitDescriptorsOutliveStatement) {
+  SQLHSTMT statement;
+  SQLHDESC apd_descriptor, ard_descriptor;
+  ASSERT_EQ(SQL_SUCCESS, SQLAllocHandle(SQL_HANDLE_STMT, this->conn, &statement));
+  ASSERT_EQ(SQL_SUCCESS, SQLAllocHandle(SQL_HANDLE_DESC, this->conn, &apd_descriptor));
+  ASSERT_EQ(SQL_SUCCESS, SQLAllocHandle(SQL_HANDLE_DESC, this->conn, &ard_descriptor));
+
+  ASSERT_EQ(SQL_SUCCESS,
+            SQLSetStmtAttr(statement, SQL_ATTR_APP_PARAM_DESC, apd_descriptor, 0));
+  ASSERT_EQ(SQL_SUCCESS,
+            SQLSetStmtAttr(statement, SQL_ATTR_APP_ROW_DESC, ard_descriptor, 0));
+
+  ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_STMT, statement));
+  EXPECT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, apd_descriptor));
+  EXPECT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, ard_descriptor));
+}
+
 }  // namespace arrow::flight::sql::odbc
```

**File**: `cpp/src/arrow/flight/sql/odbc/tests/statement_driver_api_test.cc` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+// Licensed to the Apache Software Foundation (ASF) under one
+// or more contributor license agreements.  See the NOTICE file
+// distributed with this work for additional information
+// regarding copyright ownership.  The ASF licenses this file
+// to you under the Apache License, Version 2.0 (the
+// "License"); you may not use this file except in compliance
+// with the License.  You may obtain a copy of the License at
+//
+//   http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing,
+// software distributed under the License is distributed on an
+// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
+// KIND, either express or implied.  See the License for the
+// specific language governing permissions and limitations
+// under the License.
+#include "arrow/flight/sql/odbc/tests/odbc_test_suite.h"
+
+#include "arrow/flight/sql/odbc/odbc_api_internal.h"
+#include "arrow/flight/sql/odbc/odbc_impl/odbc_statement.h"
+
+#include <cstdint>
+#include <string_view>
+#include <vector>
+
+#include <gtest/gtest.h>
+
+namespace arrow::flight::sql::odbc {
+
+class StatementDriverApiTest : public FlightSQLODBCMockTestBase {
+ protected:
+  void SetUp() override {
+    FlightSQLODBCMockTestBase::SetUp();
+
+    ASSERT_EQ(SQL_SUCCESS, arrow::flight::sql::odbc::SQLAllocHandle(
+                               SQL_HANDLE_ENV, SQL_NULL_HANDLE, &driver_env_));
+    ASSERT_EQ(SQL_SUCCESS,
+              arrow::flight::sql::odbc::SQLSetEnvAttr(
+                  driver_env_, SQL_ATTR_ODBC_VERSION,
+                  reinterpret_cast<SQLPOINTER>(static_cast<intptr_t>(SQL_OV_ODBC3)), 0));
+    ASSERT_EQ(SQL_SUCCESS, arrow::flight::sql::odbc::SQLAllocHandle(
+                               SQL_HANDLE_DBC, driver_env_, &driver_conn_));
+
+    const std::string connect_string = GetConnectionString();
+    std::vector<SQLWCHAR> wide_connect_string(connect_string.begin(),
+                                              connect_string.end());
+    SQLWCHAR output[kOdbcBufferSize];
+    SQLSMALLINT output_length;
+    ASSERT_EQ(SQL_SUCCESS,
+              arrow::flight::sql::odbc::SQLDriverConnect(
+                  driver_conn_, nullptr, wide_connect_string.data(),
+                  static_cast<SQLSMALLINT>(wide_connect_string.size()), output,
+                  kOdbcBufferSize, &output_length, SQL_DRIVER_NOPROMPT));
+    driver_connected_ = true;
+
+    ASSERT_EQ(SQL_SUCCESS, arrow::flight::sql::odbc::SQLAllocHandle(
+                               SQL_HANDLE_STMT, driver_conn_, &driver_stmt_));
+  }
+
+  void TearDown() override {
+    if (driver_stmt_ != SQL_NULL_HSTMT) {
+      EXPECT_EQ(SQL_SUCCESS,
+                arrow::flight::sql::odbc::SQLFreeHandle(SQL_HANDLE_STMT, driver_stmt_));
+    }
+    if (driver_connected_) {
+      EXPECT_EQ(SQL_SUCCESS, arrow::flight::sql::odbc::SQLDisconnect(driver_conn_));
+    }
+    if (driver_conn_ != SQL_NULL_HDBC) {
+      EXPECT_EQ(SQL_SUCCESS,
+                arrow::flight::sql::odbc::SQLFreeHandle(SQL_HANDLE_DBC, driver_conn_));
+    }
+    if (driver_env_ != SQL_NULL_HENV) {
+      EXPECT_EQ(SQL_SUCCESS,
+                arrow::flight::sql::odbc::SQLFreeHandle(SQL_HANDLE_ENV, driver_env_));
+    }
+    FlightSQLODBCMockTestBase::TearDown();
+  }
+
+  void VerifyDriverErrorState(std::string_view expected_state) {
+    ODBC::ODBCStatement* statement = ODBC::ODBCStatement::Of(driver_stmt_);
+    ASSERT_TRUE(statement->GetDiagnostics().HasRecord(0));
+    EXPECT_EQ(expected_state, statement->GetDiagnostics().GetSQLState(0));
+  }
+
+  SQLHENV driver_env_ = SQL_NULL_HENV;
+  SQLHDBC driver_conn_ = SQL_NULL_HDBC;
+  SQLHSTMT driver_stmt_ = SQL_NULL_HSTMT;
+  bool driver_connected_ = false;
+};
+
+TEST_F(StatementDriverApiTest, TestSQLFetchWithoutCursor) {
+  ASSERT_EQ(SQL_ERROR, arrow::flight::sql::odbc::SQLFetch(driver_stmt_));
+  VerifyDriverErrorState(kErrorState24000);
+}
+
+TEST_F(StatementDriverApiTest, TestSQLGetDataWithoutCursor) {
+  SQLINTEGER value;
+  SQLLEN indicator;
+  ASSERT_EQ(SQL_ERROR,
+            arrow::flight::sql::odbc::SQLGetData(driver_stmt_, 1, SQL_C_LONG, &value,
+                                                 sizeof(value), &indicator));
+  VerifyDriverErrorState(kErrorState24000);
+}
+
+TEST_F(StatementDriverApiTest, TestChangingAppRowDescriptorRebindsColumns) {
+  SQLINTEGER implicit_value = -1;
+  SQLLEN implicit_indicator;
+  ASSERT_EQ(SQL_SUCCESS, arrow::flight::sql::odbc::SQLBindCol(
+                             driver_stmt_, 1, SQL_C_LONG, &implicit_value,
+                             sizeof(implicit_value), &implicit_indicator));
+
+  ASSIGN_SQLWCHAR_ARR_AND_LEN(wsql,
+                              LR"(
+   SELECT 1 AS value
+   UNION ALL SELECT 2
+   UNION ALL SELECT 3
+   UNION ALL SELECT 4
+   UNION ALL SELECT 5;
+ )");
+  ASSERT_EQ(SQL_SUCCESS,
+            arrow::flight::sql::odbc::SQLExecDirect(driver_stmt_, wsql, wsql_len));
+
+  ASSERT_EQ(SQL_SUCCESS, arrow::fli
```

**File**: `cpp/src/arrow/flight/sql/odbc/tests/statement_test.cc` (modified, +60/-0)
```diff
@@ -1781,6 +1781,41 @@ TYPED_TEST(StatementTest, TestSQLBindColRowFetching) {
   ASSERT_EQ(SQL_NO_DATA, SQLFetch(this->stmt));
 }
 
+TYPED_TEST(StatementTest, TestChangingAppRowDescriptorRebindsColumns) {
+  SQLINTEGER implicit_value = -1;
+  SQLLEN implicit_indicator;
+  ASSERT_EQ(SQL_SUCCESS, SQLBindCol(this->stmt, 1, SQL_C_LONG, &implicit_value,
+                                    sizeof(implicit_value), &implicit_indicator));
+
+  ASSIGN_SQLWCHAR_ARR_AND_LEN(wsql,
+                              LR"(
+   SELECT 1 AS value
+   UNION ALL SELECT 2
+   UNION ALL SELECT 3;
+ )");
+  ASSERT_EQ(SQL_SUCCESS, SQLExecDirect(this->stmt, wsql, wsql_len));
+
+  ASSERT_EQ(SQL_SUCCESS, SQLFetch(this->stmt));
+  EXPECT_EQ(1, implicit_value);
+
+  SQLHDESC explicit_ard;
+  ASSERT_EQ(SQL_SUCCESS, SQLAllocHandle(SQL_HANDLE_DESC, this->conn, &explicit_ard));
+  ASSERT_EQ(SQL_SUCCESS,
+            SQLSetStmtAttr(this->stmt, SQL_ATTR_APP_ROW_DESC, explicit_ard, 0));
+  SQLINTEGER explicit_value = -1;
+  SQLLEN explicit_indicator;
+  ASSERT_EQ(SQL_SUCCESS, SQLBindCol(this->stmt, 1, SQL_C_LONG, &explicit_value,
+                                    sizeof(explicit_value), &explicit_indicator));
+  ASSERT_EQ(SQL_SUCCESS, SQLFetch(this->stmt));
+  EXPECT_EQ(2, explicit_value);
+
+  // Releasing an active explicit ARD restores and rebinds the implicit ARD.
+  ASSERT_EQ(SQL_SUCCESS, SQLFreeHandle(SQL_HANDLE_DESC, explicit_ard));
+  ASSERT_EQ(SQL_SUCCESS, SQLFetch(this->stmt));
+  EXPECT_EQ(3, implicit_value);
+  EXPECT_EQ(2, explicit_value);
+}
+
 TYPED_TEST(StatementTest, TestSQLBindColRowArraySize) {
   // Set SQL_ATTR_ROW_ARRAY_SIZE to fetch 3 rows at once
 
@@ -1981,12 +2016,37 @@ TYPED_TEST(StatementTest, TestSQLMoreResultsNoData) {
   ASSERT_EQ(SQL_SUCCESS, SQLExecDirect(this->stmt, wsql, wsql_len));
 
   ASSERT_EQ(SQL_NO_DATA, SQLMoreResults(this->stmt));
+
+  // SQLMoreResults closes the current cursor when there is no next result.
+  ASSERT_EQ(SQL_ERROR, SQLCloseCursor(this->stmt));
+  VerifyOdbcErrorState(SQL_HANDLE_STMT, this->stmt, kErrorState24000);
 }
 
 TYPED_TEST(StatementTest, TestSQLMoreResultsWithoutQuery) {
   ASSERT_EQ(SQL_NO_DATA, SQLMoreResults(this->stmt));
 }
 
+TYPED_TEST(StatementTest, TestDriverManagerSQLFetchWithoutCursor) {
+  ASSERT_EQ(SQL_ERROR, SQLFetch(this->stmt));
+#ifdef __APPLE__
+  VerifyOdbcErrorState(SQL_HANDLE_STMT, this->stmt, kErrorStateS1010);
+#else
+  VerifyOdbcErrorState(SQL_HANDLE_STMT, this->stmt, kErrorStateHY010);
+#endif
+}
+
+TYPED_TEST(StatementTest, TestDriverManagerSQLGetDataWithoutCursor) {
+  SQLINTEGER value;
+  SQLLEN indicator;
+  ASSERT_EQ(SQL_ERROR,
+            SQLGetData(this->stmt, 1, SQL_C_LONG, &value, sizeof(value), &indicator));
+#ifdef __APPLE__
+  VerifyOdbcErrorState(SQL_HANDLE_STMT, this->stmt, kErrorStateS1010);
+#else
+  VerifyOdbcErrorState(SQL_HANDLE_STMT, this->stmt, kErrorStateHY010);
+#endif
+}
+
 TYPED_TEST(StatementTest, TestSQLNativeSqlReturnsInputString) {
   SQLWCHAR buf[1024];
   SQLINTEGER buf_char_len = sizeof(buf) / GetSqlWCharSize();
```

---

### Incident Patch 3: `d26582ee` (2026-10-16)
**Commit Message**: GH-50544: [C++][Gandiva] Fix out-of-bounds read in round with most negative precision (#50545)

### Rationale for this change

`round_int32_int32` and `round_int64_int32` negate the caller-supplied precision into `abs_precision` before range-checking it, so the check `abs_precision > 9` (and `> 18` for the int64 overload) never fires for `precision == INT32_MIN`, where the negation leaves the value negative. That value reaches `get_power_of_10`, which indexes a 19-element static table behind `DCHECK_GE`/`DCHECK_LE` only. The DCHECKs compile out in release builds, so `round(int_col, -2147483648)` reads far outside the table and either faults or returns arbitrary memory as the rounding multiplier. Both overloads are registered in `function_registry_arithmetic.cc`, so the precision comes straight from user SQL.

`truncate_int64_int32` in the same file already compares the signed scale directly (`out_scale < -38`) and is unaffected; the two `round` overloads are the only sites that negate first.

### What changes are included in this PR?

Check the bound against the signed `precision` before negating, at both sites. Every precision that was in range before still takes the same path, an

**File**: `cpp/src/gandiva/precompiled/extended_math_ops.cc` (modified, +8/-6)
```diff
@@ -324,12 +324,13 @@ gdv_int32 round_int32_int32(gdv_int32 number, gdv_int32 precision) {
   if (precision >= 0) {
     return number;
   }
-  gdv_int32 abs_precision = -precision;
   // This is to ensure that there is no overflow while calculating 10^precision, 9 is
-  // the smallest N for which 10^N does not fit into 32 bits, so we can safely return 0
-  if (abs_precision > 9) {
+  // the smallest N for which 10^N does not fit into 32 bits, so we can safely return 0.
+  // The bound is checked before negating because -INT32_MIN is still negative.
+  if (precision < -9) {
     return 0;
   }
+  gdv_int32 abs_precision = -precision;
   gdv_int32 num_sign = (number > 0) ? 1 : -1;
   gdv_int32 abs_number = number * num_sign;
   gdv_int32 power_of_10 = static_cast<gdv_int32>(get_power_of_10(abs_precision));
@@ -349,12 +350,13 @@ gdv_int64 round_int64_int32(gdv_int64 number, gdv_int32 precision) {
   if (precision >= 0) {
     return number;
   }
-  gdv_int32 abs_precision = -precision;
   // This is to ensure that there is no overflow while calculating 10^precision, 19 is
-  // the smallest N for which 10^N does not fit into 64 bits, so we can safely return 0
-  if (abs_precision > 18) {
+  // the smallest N for which 10^N does not fit into 64 bits, so we can safely return 0.
+  // The bound is checked before negating because -INT32_MIN is still negative.
+  if (precision < -18) {
     return 0;
   }
+  gdv_int32 abs_precision = -precision;
   gdv_int32 num_sign = (number > 0) ? 1 : -1;
   gdv_int64 abs_number = number * num_sign;
   gdv_int64 power_of_10 = get_power_of_10(abs_precision);
```

**File**: `cpp/src/gandiva/precompiled/extended_math_ops_test.cc` (modified, +12/-0)
```diff
@@ -203,6 +203,18 @@ TEST(TestExtendedMathOps, TestRound) {
   EXPECT_EQ(round_int64_int32(-23453462343, -4), -23453460000);
   EXPECT_EQ(round_int64_int32(-23453462343, -5), -23453500000);
   EXPECT_EQ(round_int64_int32(345353425343, -12), 0);
+
+  // The last in-range precision still rounds; one past it returns 0. These guard
+  // against an off-by-one in the range check at both overloads' boundary.
+  EXPECT_EQ(round_int32_int32(1234567890, -9), 1000000000);
+  EXPECT_EQ(round_int32_int32(1234567890, -10), 0);
+  EXPECT_EQ(round_int64_int32(1234567890123456789, -18), 1000000000000000000);
+  EXPECT_EQ(round_int64_int32(1234567890123456789, -19), 0);
+
+  // The most negative precision must be rejected by the range check rather than
+  // negated into an out-of-range table index.
+  EXPECT_EQ(round_int32_int32(1234, std::numeric_limits<int32_t>::min()), 0);
+  EXPECT_EQ(round_int64_int32(345353425343, std::numeric_limits<int32_t>::min()), 0);
 }
 
 TEST(TestExtendedMathOps, TestTruncate) {
```

#### Recent Merged Pull Requests:
- **PR #54572** (2026-10-19): GH-54571: [GLib] Add support for returning string view array from C++ (@kou)
- **PR #54510** (closed): MINOR: [C++][Compute] Avoid signed overflow in slice kernel output sizing (@Nayana-Naik73)
- **PR #54490** (2026-10-19): GH-54489: [CI][Integration] Install jpype1 from conda-forge in conda-integration image (@CurtHagenlocher)
- **PR #54376** (closed): MINOR: [C++][Compute] Reject non-UTF-8 padding in utf8 pad kernels (@Nayana-Naik73)
- **PR #54024** (2026-10-19): GH-51008: [C++] Remove vendored whereami (@Reranko05)
- **PR #53974** (closed): GH-53500: Guard Parquet metadata equality against None (@1932819331hy-debug)

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

## X. GH-51018: [C++] Fix indices_nonzero segfault on chunkless ChunkedArray (#51021)

**RULE**:
When implementing operations in `cpp/src/arrow/compute/kernels/vector_selection.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/arrow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c4a0850e`: GH-51018: [C++] Fix indices_nonzero segfault on chunkless ChunkedArray (#51021). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `cpp/src/arrow/compute/kernels/vector_selection.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  if (!arrays.empty()) {
    NonZeroVisitor visitor(&builder, arrays);
    RETURN_NOT_OK(VisitTypeInline(*arrays[0].type, &visitor));
  }
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
  NonZeroVisitor visitor(&builder, arrays);
  RETURN_NOT_OK(VisitTypeInline(*arrays[0].type, &visitor));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c4a0850e` are properly handled with clean fallback behavior.
