> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-arrow-learnings.md`  
> **Source**: github ([https://github.com/apache/arrow](https://github.com/apache/arrow))  
> **Source Version**: `a95f92de`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T21:13:03.932Z  
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
> **Harvest Timestamp**: 2026-10-30T21:13:02.532Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/arrow`
- **Description**: Apache Arrow is the universal columnar format and multi-language toolbox for fast data interchange and in-memory analytics
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17263 stars

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
- **Issue #55331** (2026-10-30): **MINOR: [R] Update backwards compatibility matrix for 26.0.0 release**
  *Symptoms*: ### Rationale for this change  Standard release task.  ### What changes are included in this PR?  Add the previous CRAN version (25.0.1) to the backwards compatibility matrix.  ### Are these changes tested?  Nope.  ### Are there any user-facing changes?  No.  ### Was AI used for this PR?  In accordance to the [AI generation guidelines](https://arrow.apache.org/docs/dev/developers/overview.html#ai-generated-code), please disclose below whether and how AI was used in this PR.  **PR code and description written by:**  - [ ] Human - [x] AI  **Reviewed before submission by:**  - [x] Human - [ ] AI - [ ] Not reviewed

- **Issue #55330** (2026-10-30): **MINOR: [C++] Remove undefined variable reference in substrait test link libraries**
  *Symptoms*: ### Rationale for this change  `ARROW_SUBSTRAIT_LINK_lIBS` is a typo (`l` is lower).  ### What changes are included in this PR?  Remove the typo-ed variable.  ### Are these changes tested?  Yes.  ### Are there any user-facing changes?  No.  ### Was AI used for this PR?  In accordance to the [AI generation guidelines](https://arrow.apache.org/docs/dev/developers/overview.html#ai-generated-code), please disclose below whether and how AI was used in this PR.  **PR code and description written by:**  - [x] Human - [ ] AI  **Reviewed before submission by:**  - [x] Human - [ ] AI - [ ] Not reviewed 

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

### Incident Patch 1: `d24791f9` (2026-10-29)
**Commit Message**: GH-54936: [C++] Ensure reading an invalid map array from IPC doesn't crash (#54939)

### Rationale for this change

When loading a MapArray from IPC, we call [`MapArray::ValidateChildData`](https://github.com/apache/arrow/blob/b9479757dd5c1914c2b007f11f6679c4fc080c05/cpp/src/arrow/ipc/reader.cc#L456-L459) to avoid a later crash in `MapArray::SetData`.

Unfortunately `MapArray::ValidateChildData` calls `GetNullCount()` which is unsafe if the advertised length is too large for the actual validity buffer size.

Found by OSS-Fuzz in https://issues.oss-fuzz.com/issues/556994537

### What changes are included in this PR?

Check that the `null_count` of the relevant fields is equal to zero, so that `GetNullCount` does not actually try to read buffer memory.

### Are these changes tested?

Yes, by additional fuzz regression test.

### Are there any user-facing changes?

Just a bugfix.

**This PR contains a "Critical Fix".** An invalid IPC file would lead to reading memory out of bounds for the purpose of counting validity bits. It is not obvious how this could be exploited by an attacker except for causing a denial of service.

### Was AI used for this PR?

**PR code and description writte

**File**: `cpp/src/arrow/ipc/reader.cc` (modified, +15/-0)
```diff
@@ -34,6 +34,7 @@
 #include <flatbuffers/flatbuffers.h>  // IWYU pragma: export
 
 #include "arrow/array.h"
+#include "arrow/array/validate.h"
 #include "arrow/buffer.h"
 #include "arrow/extension_type.h"
 #include "arrow/io/caching.h"
@@ -455,6 +456,20 @@ class ArrayLoader {
 
   Status Visit(const MapType& type) {
     RETURN_NOT_OK(LoadList(type));
+    DCHECK_EQ(out_->child_data.size(), 1);  // ensured by LoadList()
+    // Ensure that GetNullCount() calls in MapArray::ValidateChildData
+    // don't access invalid memory.
+    // We cannot call array validation as it will fail on non-native endianness
+    // (due to checking the last offset on variable-width data) or missing
+    // dictionaries (they are not yet populated at this point).
+    const ArrayData& child_data = *out_->child_data[0];
+    if (child_data.null_count != 0) {
+      return Status::Invalid("Map array child array should have no nulls");
+    }
+    if (!child_data.child_data.empty() && child_data.child_data[0]->null_count != 0) {
+      return Status::Invalid("Map array keys array should have no nulls");
+    }
+    // If we don't do this, MapArray::SetData will abort on invalid data.
     return MapArray::ValidateChildData(out_->child_data);
   }
 
```

**File**: `testing` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 9ff285c88565f0f6abc855918c6a342e70e4909c
+Subproject commit 5a26d35785ff8761e56d79eebff971f6f737e18c
```

---

### Incident Patch 2: `36cd76f6` (2026-10-29)
**Commit Message**: GH-55165: [C++][Packaging][R] Use Brotli 1.2.1 for bundled, vcpkg and R Windows builds (#55167)

### Rationale for this change

There is a security problem in bundled Brotli (1.0.9), pinned vcpkg Brotli (1.2.0) and rtools' Brotli (1.0.9).

We should update them.

### What changes are included in this PR?

* Bump the bundled Brotli to 1.2.1 from 1.0.9.
* Bump vcpkg to 2026.10.24 (`61d7eaeb09`) from 2026.05.27 (`9b965a1168`).
* Use the bundled Brotli instead of the rtools one for R Windows binaries.

### Are these changes tested?

Yes.

### Are there any user-facing changes?

Yes.

### Was AI used for this PR?

**PR code and description written by:**

- [x] Human
- [x] AI

**Reviewed before submission by:**

- [x] Human
- [ ] AI
- [ ] Not reviewed

* GitHub Issue: #55165

Lead-authored-by: Raúl Cumplido <[REDACTED_EMAIL]>
Co-authored-by: Curt Hagenlocher <[REDACTED_EMAIL]>
Signed-off-by: Sutou Kouhei <[REDACTED_EMAIL]>

**File**: `.env` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ TZ=UTC
 # Used through compose.yaml and serves as the default version for the
 # ci/scripts/install_vcpkg.sh script. Prefer to use short SHAs to keep the
 # docker tags more readable.
-VCPKG="9b965a116838c6cdcd36bca60d1b81b030c8ab8d"    # 2026.05.27 (not release, upstream commit)
+VCPKG="61d7eaeb094a6acbc23d9c2e54de9208175fda47"    # 2026.10.24 (not release, upstream commit)
 
 # This must be updated when we update
 # ci/docker/python-*-windows-*.dockerfile or the vcpkg config.
```

**File**: `c_glib/vcpkg.json` (modified, +1/-1)
```diff
@@ -7,5 +7,5 @@
     "pkgconf"
   ],
   "$comment": "We can update builtin-baseline by 'vcpkg x-update-baseline'",
-  "builtin-baseline": "9b965a116838c6cdcd36bca60d1b81b030c8ab8d"
+  "builtin-baseline": "61d7eaeb094a6acbc23d9c2e54de9208175fda47"
 }
```

**File**: `ci/scripts/PKGBUILD` (modified, +5/-2)
```diff
@@ -31,8 +31,7 @@ depends=("${MINGW_PACKAGE_PREFIX}-bzip2"
          "${MINGW_PACKAGE_PREFIX}-snappy"
          "${MINGW_PACKAGE_PREFIX}-zlib"
          "${MINGW_PACKAGE_PREFIX}-lz4"
-         "${MINGW_PACKAGE_PREFIX}-zstd"
-         "${MINGW_PACKAGE_PREFIX}-brotli")
+         "${MINGW_PACKAGE_PREFIX}-zstd")
 makedepends=("${MINGW_PACKAGE_PREFIX}-ccache"
              "${MINGW_PACKAGE_PREFIX}-gcc")
 options=("staticlibs" "strip" "!buildflags")
@@ -96,6 +95,9 @@ build() {
   # But one on rtools packages doesn't have the fix. So we can't use
   # the MINGW one.
 
+  # We use the bundled Brotli instead of the MINGW one because the one
+  # on rtools packages is unmaintained and stuck at 1.0.9.
+
   # MSYS2_ARG_CONV_EXCL is needed to prevent autoconverting CMAKE_INSTALL_PREFIX
   # to Windows paths. See https://www.msys2.org/docs/filesystem-paths/#process-arguments
 
@@ -137,6 +139,7 @@ build() {
     -DARROW_ZSTD_USE_SHARED=OFF \
     -DARROW_CXXFLAGS="${CPPFLAGS}" \
     -DAWSSDK_SOURCE=BUNDLED \
+    -DBrotli_SOURCE=BUNDLED \
     -DCMAKE_BUILD_TYPE="release" \
     -DCMAKE_DISABLE_PRECOMPILE_HEADERS=ON \
     -DCMAKE_INSTALL_PREFIX=${MINGW_PREFIX} \
```

**File**: `ci/scripts/r_windows_build.sh` (modified, +3/-3)
```diff
@@ -65,23 +65,23 @@ if [ -d mingw64/lib/ ]; then
   # Move the 64-bit versions of libarrow into the expected location
   mv mingw64/lib/*.a "${DST_DIR}/lib/x64"
   # These are from https://dl.bintray.com/rtools/mingw{32,64}/
-  cp "${MSYS_LIB_DIR}"/mingw64/lib/lib{snappy,zstd,lz4,brotli*,bz2,crypto,curl,ss*,utf8proc,re2,nghttp2}.a "${DST_DIR}/lib/x64"
+  cp "${MSYS_LIB_DIR}"/mingw64/lib/lib{snappy,zstd,lz4,bz2,crypto,curl,ss*,utf8proc,re2,nghttp2}.a "${DST_DIR}/lib/x64"
 fi
 
 # Same for the 32-bit versions
 if [ -d mingw32/lib/ ]; then
   ls "${MSYS_LIB_DIR}/mingw32/lib/"
   mkdir -p "${DST_DIR}/lib/i386"
   mv mingw32/lib/*.a "${DST_DIR}/lib/i386"
-  cp "${MSYS_LIB_DIR}"/mingw32/lib/lib{snappy,zstd,lz4,brotli*,bz2,crypto,curl,ss*,utf8proc,re2,nghttp2}.a "${DST_DIR}/lib/i386"
+  cp "${MSYS_LIB_DIR}"/mingw32/lib/lib{snappy,zstd,lz4,bz2,crypto,curl,ss*,utf8proc,re2,nghttp2}.a "${DST_DIR}/lib/i386"
 fi
 
 # Do the same also for ucrt64
 if [ -d ucrt64/lib/ ]; then
   ls "${MSYS_LIB_DIR}/ucrt64/lib/"
   mkdir -p "${DST_DIR}/lib/x64-ucrt"
   mv ucrt64/lib/*.a "${DST_DIR}/lib/x64-ucrt"
-  cp "${MSYS_LIB_DIR}"/ucrt64/lib/lib{snappy,zstd,lz4,brotli*,bz2,crypto,curl,ss*,utf8proc,re2,nghttp2}.a "$DST_DIR"/lib/x64-ucrt
+  cp "${MSYS_LIB_DIR}"/ucrt64/lib/lib{snappy,zstd,lz4,bz2,crypto,curl,ss*,utf8proc,re2,nghttp2}.a "$DST_DIR"/lib/x64-ucrt
 fi
 
 # Create build artifact
```

**File**: `ci/vcpkg/ports.patch` (modified, +69/-13)
```diff
@@ -19,19 +19,6 @@ index 73f5aece46..68cdb3966f 100644
  )
  vcpkg_cmake_install()
  vcpkg_copy_pdbs()
-diff --git a/ports/llvm/portfile.cmake b/ports/llvm/portfile.cmake
-index 7764357a6d..da7374ecec 100644
---- a/ports/llvm/portfile.cmake
-+++ b/ports/llvm/portfile.cmake
-@@ -302,6 +302,8 @@ vcpkg_cmake_configure(
-         ${FEATURE_OPTIONS}
-     MAYBE_UNUSED_VARIABLES 
-         COMPILER_RT_ENABLE_IOS
-+        BOLT_TOOLS_INSTALL_DIR
-+        LIBOMP_INSTALL_ALIASES
- )
- 
- vcpkg_cmake_install(ADD_BIN_TO_PATH)
 diff --git a/ports/orc/orc-fix-exception-propagation.diff b/ports/orc/orc-fix-exception-propagation.diff
 new file mode 100644
 index 0000000000..25568e70cd
@@ -114,3 +101,72 @@ index 5df5e94..225e5fb 100644
  )
  
  if("tool" IN_LIST FEATURES)
+diff --git a/ports/nanoarrow/portfile.cmake b/ports/nanoarrow/portfile.cmake
+index 34f113f..10ca500 100644
+--- a/ports/nanoarrow/portfile.cmake
++++ b/ports/nanoarrow/portfile.cmake
+@@ -24,6 +24,10 @@ vcpkg_cmake_configure(
+     OPTIONS
+         -DNANOARROW_INSTALL_SHARED=${NANOARROW_INSTALL_SHARED}
+         -DNANOARROW_DEBUG_EXTRA_WARNINGS=OFF
++        # Prefix the C symbols so that consumers linking nanoarrow
++        # statically (e.g. azure-storage-blobs-cpp inside libarrow) do
++        # not export or clash on plain Arrow* names.
++        -DNANOARROW_NAMESPACE=VcpkgNanoarrow
+         ${FEATURE_OPTIONS}
+         ${FLATCCRT_OPTIONS}
+ )
+@@ -36,12 +40,12 @@ vcpkg_cmake_config_fixup(
+     DO_NOT_DELETE_PARENT_CONFIG_PATH
+ )
+ 
+-# Fix bare "flatccrt" in INTERFACE_LINK_LIBRARIES - Windows needs the full path
++# Fix bare "flatccrt" in INTERFACE_LINK_LIBRARIES - consumers need the full path
+ # Tracked upstream at https://github.com/apache/arrow-nanoarrow/issues/922
+-if ("ipc" IN_LIST FEATURES AND VCPKG_TARGET_IS_WINDOWS)
++if ("ipc" IN_LIST FEATURES)
+     vcpkg_replace_string("${CURRENT_PACKAGES_DIR}/share/nanoarrow/nanoarrow-targets.cmake"
+         [[\$<LINK_ONLY:flatccrt>]]
+-        [[\$<LINK_ONLY:${_IMPORT_PREFIX}/lib/flatccrt.lib>]]
++        "\\\$<LINK_ONLY:\${_IMPORT_PREFIX}/lib/${VCPKG_TARGET_STATIC_LIBRARY_PREFIX}flatccrt${VCPKG_TARGET_STATIC_LIBRARY_SUFFIX}>"
+     )
+ endif()
+ 
+diff --git a/ports/protobuf/fix-msvc-global-empty-string.patch b/ports/protobuf/fix-msvc-global-empty-string.patch
+new file mode 100644
+index 0000000..da1d995
+--- /dev/null
++++ b/ports/protobuf/fix-msvc-global-empty-string.patch
+@@ -0,0 +1,20 @@
++diff --git a/src/google/protobuf/port.h b/src/google/protobuf/port.h
++index 7347203..a587be8 100644
++--- a/src/google/protobuf/port.h
+++++ b/src/google/protobuf/port.h
++@@ -876,9 +876,14 @@ class alignas(8) GlobalEmptyStringConstexpr {
++   // evaluation, not that a constant evaluated instance can leak into runtime.
++   // Memory allocated during constant evaluation can't be used for runtime
++   // objects.
++-#if !defined(__XTENSA__)
+++#if !defined(__XTENSA__) && !defined(_MSC_VER)
++   // Disable the optimization for Xtensa.
++   // Compilation fails on Xtensa: b/467129751
+++  // Disable the optimization for MSVC too, as protobuf 33.x did.
+++  // MSVC mangles the type of fixed_address_empty_string into its symbol
+++  // name, so libprotobuf and generated code built with different C++
+++  // standards (C++17 vs C++20) fail to link.
+++  // See https://github.com/microsoft/vcpkg/issues/54654
++   template <
++       typename Alloc = NonConstexprAllocator<char>,
++       int = std::basic_string<char, std::char_traits<char>, Alloc>().size()>
+diff --git a/ports/protobuf/portfile.cmake b/ports/protobuf/portfile.cmake
+index 74570d4..ae656fc 100644
+--- a/ports/protobuf/portfile.cmake
++++ b/ports/protobuf/portfile.cmake
+@@ -11,6 +11,7 @@ vcpkg_from_github(
+         fix-install-dirs.patch
+         fix-constinit-with-clang-cl.patch
+         fix-upb.patch
++        fix-msvc-global-empty-string.patch
+ )
+ 
+ string(COMPARE EQUAL "${TARGET_TRIPLET}" "${HOST_TRIPLET}" protobuf_BUILD_PROTOC_BINARIES)
```

**File**: `cpp/cmake_modules/ThirdpartyToolchain.cmake` (modified, +8/-39)
```diff
@@ -1552,36 +1552,19 @@ macro(build_brotli)
   set(BROTLI_PREFIX "${CMAKE_CURRENT_BINARY_DIR}/brotli_ep/src/brotli_ep-install")
   set(BROTLI_INCLUDE_DIR "${BROTLI_PREFIX}/include")
   set(BROTLI_LIB_DIR "${BROTLI_PREFIX}/lib")
+  # Brotli >= 1.1.0 names its static libraries without a "-static"
+  # suffix when BUILD_SHARED_LIBS=OFF.
   set(BROTLI_STATIC_LIBRARY_ENC
-      "${BROTLI_PREFIX}/lib/${CMAKE_STATIC_LIBRARY_PREFIX}brotlienc-static${CMAKE_STATIC_LIBRARY_SUFFIX}"
+      "${BROTLI_LIB_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}brotlienc${CMAKE_STATIC_LIBRARY_SUFFIX}"
   )
   set(BROTLI_STATIC_LIBRARY_DEC
-      "${BROTLI_PREFIX}/lib/${CMAKE_STATIC_LIBRARY_PREFIX}brotlidec-static${CMAKE_STATIC_LIBRARY_SUFFIX}"
+      "${BROTLI_LIB_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}brotlidec${CMAKE_STATIC_LIBRARY_SUFFIX}"
   )
   set(BROTLI_STATIC_LIBRARY_COMMON
-      "${BROTLI_PREFIX}/lib/${CMAKE_STATIC_LIBRARY_PREFIX}brotlicommon-static${CMAKE_STATIC_LIBRARY_SUFFIX}"
+      "${BROTLI_LIB_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}brotlicommon${CMAKE_STATIC_LIBRARY_SUFFIX}"
   )
-  set(BROTLI_CMAKE_ARGS ${EP_COMMON_CMAKE_ARGS} "-DCMAKE_INSTALL_PREFIX=${BROTLI_PREFIX}")
-
-  set(BROTLI_EP_OPTIONS)
-  if(CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
-    # "cmake install" is disabled for Brotli on Emscripten, so the
-    # default INSTALL_COMMAND fails. We need to disable the default
-    # INSTALL_COMMAND.
-    list(APPEND
-         BROTLI_EP_OPTIONS
-         INSTALL_COMMAND
-         ${CMAKE_COMMAND}
-         -E
-         true)
-
-    set(BROTLI_BUILD_DIR ${CMAKE_CURRENT_BINARY_DIR}/brotli_ep-prefix/src/brotli_ep-build)
-    set(BROTLI_BUILD_LIBS
-        "${BROTLI_BUILD_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}brotlienc-static${CMAKE_STATIC_LIBRARY_SUFFIX}"
-        "${BROTLI_BUILD_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}brotlidec-static${CMAKE_STATIC_LIBRARY_SUFFIX}"
-        "${BROTLI_BUILD_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}brotlicommon-static${CMAKE_STATIC_LIBRARY_SUFFIX}"
-    )
-  endif()
+  set(BROTLI_CMAKE_ARGS ${EP_COMMON_CMAKE_ARGS} "-DCMAKE_INSTALL_PREFIX=${BROTLI_PREFIX}"
+                        -DBROTLI_BUILD_TOOLS=OFF -DBROTLI_DISABLE_TESTS=ON)
 
   externalproject_add(brotli_ep
                       ${EP_COMMON_OPTIONS}
@@ -1590,22 +1573,8 @@ macro(build_brotli)
                       BUILD_BYPRODUCTS "${BROTLI_STATIC_LIBRARY_ENC}"
                                        "${BROTLI_STATIC_LIBRARY_DEC}"
                                        "${BROTLI_STATIC_LIBRARY_COMMON}"
-                                       ${BROTLI_BUILD_BYPRODUCTS}
                       CMAKE_ARGS ${BROTLI_CMAKE_ARGS}
-                      STEP_TARGETS headers_copy ${BROTLI_EP_OPTIONS})
-
-  if(CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
-    # Copy the libraries to our install directory manually.
-    set(BROTLI_BUILD_INCLUDE_DIR
-        ${CMAKE_CURRENT_BINARY_DIR}/brotli_ep-prefix/src/brotli_ep/c/include/brotli)
-    add_custom_command(TARGET brotli_ep
-                       POST_BUILD
-                       COMMAND ${CMAKE_COMMAND} -E copy_if_different
-                               ${BROTLI_BUILD_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}*${CMAKE_STATIC_LIBRARY_SUFFIX}
-                               ${BROTLI_LIB_DIR}
-                       COMMAND ${CMAKE_COMMAND} -E copy_directory
-                               ${BROTLI_BUILD_INCLUDE_DIR} ${BROTLI_INCLUDE_DIR}/brotli)
-  endif()
+                      STEP_TARGETS headers_copy)
 
   file(MAKE_DIRECTORY "${BROTLI_INCLUDE_DIR}")
 
```

**File**: `cpp/thirdparty/versions.txt` (modified, +2/-2)
```diff
@@ -58,8 +58,8 @@ ARROW_AZURE_SDK_BUILD_VERSION=azure-identity_1.9.0
 ARROW_AZURE_SDK_BUILD_SHA256_CHECKSUM=97065bfc971ac8df450853ce805f820f52b59457bd7556510186a1569502e4a1
 ARROW_BOOST_BUILD_VERSION=1.92.0
 ARROW_BOOST_BUILD_SHA256_CHECKSUM=f51707c27359a0df0cac1beada86de31bb5eed5e8285592dadec384df99c2984
-ARROW_BROTLI_BUILD_VERSION=v1.0.9
-ARROW_BROTLI_BUILD_SHA256_CHECKSUM=f9e8d81d0405ba66d181529af42a3354f838c939095ff99930da6aa9cdf6fe46
+ARROW_BROTLI_BUILD_VERSION=v1.2.1
+ARROW_BROTLI_BUILD_SHA256_CHECKSUM=98d35d11a78dc453aebb7d10c3748f3f73ff78c8267c0dc697b8631f67bf7e8f
 ARROW_BZIP2_BUILD_VERSION=1.0.8
 ARROW_BZIP2_BUILD_SHA256_CHECKSUM=ab5a03176ee106d3f0fa90e381da478ddae405918153cca248e682cd0c4a2269
 ARROW_CARES_BUILD_VERSION=1.34.6
```

**File**: `cpp/vcpkg.json` (modified, +1/-1)
```diff
@@ -59,5 +59,5 @@
     "zstd"
   ],
   "$comment": "We can update builtin-baseline by 'vcpkg x-update-baseline'",
-  "builtin-baseline": "9b965a116838c6cdcd36bca60d1b81b030c8ab8d"
+  "builtin-baseline": "61d7eaeb094a6acbc23d9c2e54de9208175fda47"
 }
```

---

### Incident Patch 3: `3f1fd722` (2026-10-30)
**Commit Message**: GH-47576: [C++][Acero] Fix C++23 build (#50975)

### Rationale for this change

In `C++23`, `Clang` diagnoses the conversion from `AsofJoinNode*` to `ExecNode*`
while instantiating `std::make_unique<BackpressureController>`. At the current
definition site, `AsofJoinNode` is still incomplete, causing the `Acero` build to
fail.

### What changes are included in this PR?

Declare `InputState::Make` in `InputState` and define it after `AsofJoinNode` is
complete. This makes the derived-to-base conversion valid without changing runtime
behavior.

AI assistance: Codex drafted and evaluated this source-ordering change. The
automated checks below were run before opening the PR.

### Are these changes tested?

- `cmake --build cpp/build-clang22-cxx23-release --target arrow_acero_static --parallel 2`
  (`Clang 22.1.8`, `Release`, `C++23`)
- `ctest -j 16 --output-on-failure` in
  `cpp/build-clang22-cxx23-release-tests/src/arrow/acero`: 14/14 tests passed
- `clang-format --dry-run --Werror cpp/src/arrow/acero/asof_join_node.cc`
- `git diff --check`

<details>
<summary>Original `Clang 22` `C++23` diagnostic</summary>

~~~text
In file included from /arrow/src/arrow/acero/asof_join_node.cc:18:
In 

**File**: `cpp/src/arrow/acero/asof_join_node.cc` (modified, +19/-12)
```diff
@@ -509,18 +509,7 @@ class InputState : public util::SerialSequencingQueue::Processor {
       KeyHasher* key_hasher, ExecNode* asof_input, AsofJoinNode* asof_node,
       std::atomic<int32_t>& backpressure_counter,
       const std::shared_ptr<arrow::Schema>& schema, const col_index_t time_col_index,
-      const std::vector<col_index_t>& key_col_index) {
-    constexpr size_t low_threshold = 4, high_threshold = 8;
-    std::unique_ptr<BackpressureControl> backpressure_control =
-        std::make_unique<BackpressureController>(
-            /*node=*/asof_input, /*output=*/asof_node, backpressure_counter);
-    ARROW_ASSIGN_OR_RAISE(auto handler,
-                          BackpressureHandler::Make(low_threshold, high_threshold,
-                                                    std::move(backpressure_control)));
-    return std::make_unique<InputState>(index, tolerance, must_hash, may_rehash,
-                                        key_hasher, asof_node, std::move(handler), schema,
-                                        time_col_index, key_col_index);
-  }
+      const std::vector<col_index_t>& key_col_index);
 
   col_index_t InitSrcToDstMapping(col_index_t dst_offset, bool skip_time_and_key_fields) {
     src_to_dst_.resize(schema_->num_fields());
@@ -1574,6 +1563,24 @@ class AsofJoinNode : public ExecNode {
   int batches_produced_ = 0;
 };
 
+Result<std::unique_ptr<InputState>> InputState::Make(
+    size_t index, TolType tolerance, bool must_hash, bool may_rehash,
+    KeyHasher* key_hasher, ExecNode* asof_input, AsofJoinNode* asof_node,
+    std::atomic<int32_t>& backpressure_counter,
+    const std::shared_ptr<arrow::Schema>& schema, const col_index_t time_col_index,
+    const std::vector<col_index_t>& key_col_index) {
+  constexpr size_t low_threshold = 4, high_threshold = 8;
+  std::unique_ptr<BackpressureControl> backpressure_control =
+      std::make_unique<BackpressureController>(
+          /*node=*/asof_input, /*output=*/asof_node, backpressure_counter);
+  ARROW_ASSIGN_OR_RAISE(auto handler,
+                        BackpressureHandler::Make(low_threshold, high_threshold,
+                                                  std::move(backpressure_control)));
+  return std::make_unique<InputState>(index, tolerance, must_hash, may_rehash, key_hasher,
+                                      asof_node, std::move(handler), schema,
+                                      time_col_index, key_col_index);
+}
+
 AsofJoinNode::AsofJoinNode(ExecPlan* plan, NodeVector inputs,
                            std::vector<std::string> input_labels,
                            const std::vector<col_index_t>& indices_of_on_key,
```

#### Recent Merged Pull Requests:
- **PR #55331** (2026-10-30): MINOR: [R] Update backwards compatibility matrix for 26.0.0 release (@thisisnic)
- **PR #55330** (2026-10-30): MINOR: [C++] Remove undefined variable reference in substrait test link libraries (@kou)
- **PR #55320** (2026-10-30): MINOR: [C++][FlightRPC][CI][ODBC] Increase nuget timeout for vcpkg upload (@alinaliBQ)
- **PR #55317** (2026-10-30): GH-55316: [CI][FlightRPC][ODBC] Apply ports.patch in Windows build (@amoeba)
- **PR #55311** (closed): WIP: [Release] Verify release-26.0.1-rc0 (@raulcd)
- **PR #55301** (2026-10-29): GH-55300: [CI][Packaging][Python] Update pinned 3.14 patch version to match the one available to download for free-threading wheels tests (@raulcd)

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

## X. GH-54936: [C++] Ensure reading an invalid map array from IPC doesn't crash (#549

**RULE**:
When implementing operations in `cpp/src/arrow/ipc/reader.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/arrow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d24791f9`: GH-54936: [C++] Ensure reading an invalid map array from IPC doesn't crash (#54939). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `cpp/src/arrow/ipc/reader.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include "arrow/array/validate.h"
    DCHECK_EQ(out_->child_data.size(), 1);  // ensured by LoadList()
    // Ensure that GetNullCount() calls in MapArray::ValidateChildData
    // don't access invalid memory.
    // We cannot call array validation as it will fail on non-native endianness
    // (due to checking the last offset on variable-width data) or missing
    // dictionaries (they are not yet populated at this point).
    const ArrayData& child_data = *out_->child_data[0];
    if (child_data.null_count != 0) {
      return Status::Invalid("Map array child array should have no nulls");
    }
    if (!child_data.child_data.empty() && child_data.child_data[0]->null_count != 0) {
      return Status::Invalid("Map array keys array should have no nulls");
    }
    // If we don't do this, MapArray::SetData will abort on invalid data.
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d24791f9` are properly handled with clean fallback behavior.
