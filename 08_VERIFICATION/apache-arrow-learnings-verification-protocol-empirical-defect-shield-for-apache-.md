# Verification Protocol: Verification Protocol: Empirical Defect Shield for apache-arrow-learnings

<!-- PROVENANCE_START
{
  "source_repository": "apache-arrow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T17:51:26.845Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-arrow-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-arrow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T17:51:26.845Z`  
> **Learning ID**: `LEARN-EVO-apache-arrow-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `apache-arrow-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-arrow-learnings.md`  
> **Source**: github ([https://github.com/apache/arrow](https://github.com/apache/arrow))  
> **Source Version**: `ab5b4223`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T17:51:06.935Z  
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
> **Harvest Timestamp**: 2026-11-14T17:51:06.930Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/arrow`
- **Description**: Apache Arrow is the universal columnar format and multi-language toolbox for fast data interchange and in-memory analytics
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17295 stars

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
- **Issue #55610** (2026-11-14): **GH-55503: [C++] Fix Float16 memo table keys built from raw bits**
  *Symptoms*: ### Rationale for this change  Float16 dictionary unification and `count_distinct` produce incorrect results because raw `uint16_t` storage values are interpreted as numeric values instead of Float16 bit patterns.  For example, the Float16 bit pattern `0x3C00`, representing `1.0`, is interpreted as `15360.0` when passed through the converting constructor.  This causes dictionary values to be corrupted during dictionary unification and distinct Float16 values to be incorrectly merged by `count_distinct`.  ### What changes are included in this PR?  - Use `Float16::FromBits()` when constructing memo table keys from raw Float16 values in `DictionaryUnifierImpl::Unify`. - Fix Float16 handling in the array path of `CountDistinctImpl::Consume`. - Fix Float16 scalar unboxing to preserve the original bit representation in `UnboxScalar<HalfFloatType>::Unbox`.  ### Are these changes tested?  Added regression tests:  - `TestDictionaryUnifier.HalfFloat`: verifies unified dictionary values and transpose maps. - `TestCountDistinctKernel.HalfFloat`: covers distinct Float16 values, duplicates, nulls, chunked arrays, and scalar input.  Verified that both new regression tests fail with the original implementation and pass with the fix.  Validation performed:  - `arrow-array-test`: 346 tests passed (2 disabled). - `arrow-compute-aggregate-test`: 346 tests passed. - `clang-format --dry-run --Werror`: passed. - `git diff --check`: passed.  ### Are there any user-facing changes?  Fixes incorrect Fl

- **Issue #55584** (2026-11-13): **[Python] c/driver/sqlite: re-executing a prepared statement fails with "no more rows available" on macOS system SQLite**
  *Symptoms*: ### Describe the bug, including details regarding any error messages, version, and platform.  SQLite driver fails to re-execute a prepared statement when SQLite is built with `SQLITE_OMIT_AUTORESET`.  ## Description  Executing the same prepared statement a second time fails if the SQLite driver is linked against a SQLite built with [`SQLITE_OMIT_AUTORESET`](https://www.sqlite.org/compile.html#omit_autoreset).  Apple's system SQLite (`/usr/lib/libsqlite3.dylib`) is built that way, and CMake picks it up by default on macOS.  On my own macOS:  ```console $ echo "pragma compile_options;" | /usr/bin/sqlite3 | grep AUTORESET OMIT_AUTORESET ```  This shows up in the Python DB-API, which skips `set_sql_query()` and `prepare()` when the same SQL is executed twice in a row. As a result, `python/adbc_driver_manager/tests/test_dbapi.py::test_query_fetch_py` fails locally on macOS but passes in CI.  ## Minimal reproducible example  Build the SQLite driver on macOS with the default SQLite:  ```shell cmake -S c -B build -G Ninja -DADBC_DRIVER_SQLITE=ON cmake --build build --target adbc_driver_sqlite_shared otool -L build/driver/sqlite/libadbc_driver_sqlite.dylib | grep sqlite3 # /usr/lib/libsqlite3.dylib (compatibility version 9.0.0, current version 371.0.0) ```  ```python # mre.py import adbc_driver_manager.dbapi as dbapi  with dbapi.connect(driver="adbc_driver_sqlite") as conn:     with conn.cursor() as cur:         for i in range(2):             cur.execute("SELECT 1")             print(

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

### Incident Patch 1: `0974e94e` (2026-11-13)
**Commit Message**: GH-51043: [Python] Reject null required Arrow objects (#51161)

### Rationale for this change

Passing None where pyarrow requires an object can abort the Python process or raise an unrelated AttributeError, because the value reaches native Arrow code that cannot handle it. The original report covered some constructors, and later comments found the same failure in ScanNodeOptions, ParquetSchema, ColumnSchema, SubTreeFileSystem and ProjectNodeOptions, so this PR fixes those too.

Fixes https://github.com/apache/arrow/issues/51043.

get_partition_keys(None) is in https://github.com/apache/arrow/pull/51294.

### What changes are included in this PR?

The Python layer now checks required arguments before native code runs, so None raises a TypeError that names the argument instead of crashing. This covers schemas, formats, types, dictionaries, fragments, filesystems and child arrays, plus the classes listed above. Array buffer constructors also require a data type.

### Are these changes tested?

A native Arrow 26.0.0-SNAPSHOT build reproduced the failures. The same commands then raised TypeError.

```console
$ python -c 'from pyarrow import acero; acero.ScanNodeOptions(None)'
Before: p

**File**: `python/pyarrow/_acero.pyx` (modified, +2/-0)
```diff
@@ -141,6 +141,8 @@ cdef class _ProjectNodeOptions(ExecNodeOptions):
             vector[c_string] c_names
 
         for expr in expressions:
+            if expr is None:
+                raise TypeError("Expression must not be None")
             c_expressions.push_back(expr.unwrap())
 
         if names is not None:
```

**File**: `python/pyarrow/_dataset.pyx` (modified, +5/-2)
```diff
@@ -1121,7 +1121,8 @@ cdef class FileSystemDataset(Dataset):
     cdef:
         CFileSystemDataset* filesystem_dataset
 
-    def __init__(self, fragments, Schema schema, FileFormat format,
+    def __init__(self, fragments, Schema schema not None,
+                 FileFormat format not None,
                  FileSystem filesystem=None, root_partition=None):
         cdef:
             FileFragment fragment=None
@@ -1138,6 +1139,8 @@ cdef class FileSystemDataset(Dataset):
             )
 
         for fragment in fragments:
+            if fragment is None:
+                raise TypeError("Fragment must not be None")
             c_fragments.push_back(
                 static_pointer_cast[CFileFragment, CFragment](
                     fragment.unwrap()))
@@ -4236,5 +4239,5 @@ class ScanNodeOptions(_ScanNodeOptions):
         Preserve implicit ordering of data.
     """
 
-    def __init__(self, Dataset dataset, **kwargs):
+    def __init__(self, Dataset dataset not None, **kwargs):
         self._set_options(dataset, kwargs)
```

**File**: `python/pyarrow/_fs.pyx` (modified, +1/-1)
```diff
@@ -1205,7 +1205,7 @@ cdef class SubTreeFileSystem(FileSystem):
     For usage of the methods see examples for :func:`~pyarrow.fs.LocalFileSystem`.
     """
 
-    def __init__(self, base_path, FileSystem base_fs):
+    def __init__(self, base_path, FileSystem base_fs not None):
         cdef:
             c_string pathstr
             shared_ptr[CSubTreeFileSystem] wrapped
```

**File**: `python/pyarrow/_parquet.pyx` (modified, +5/-4)
```diff
@@ -755,7 +755,8 @@ cdef class SortingColumn:
         self.nulls_first = nulls_first
 
     @classmethod
-    def from_ordering(cls, Schema schema, sort_keys, null_placement='at_end'):
+    def from_ordering(cls, Schema schema not None, sort_keys,
+                      null_placement='at_end'):
         """
         Create a tuple of SortingColumn objects from the same arguments as
         :class:`pyarrow.compute.SortOptions`.
@@ -816,7 +817,7 @@ cdef class SortingColumn:
         return tuple(sorting_columns)
 
     @staticmethod
-    def to_ordering(Schema schema, sorting_columns):
+    def to_ordering(Schema schema not None, sorting_columns):
         """
         Convert a tuple of SortingColumn objects to the same format as
         :class:`pyarrow.compute.SortOptions`.
@@ -1247,7 +1248,7 @@ cdef class FileMetaData(_Weakrefable):
 cdef class ParquetSchema(_Weakrefable):
     """A Parquet schema."""
 
-    def __cinit__(self, FileMetaData container):
+    def __cinit__(self, FileMetaData container not None):
         self.parent = container
         self.schema = container._metadata.schema()
 
@@ -1336,7 +1337,7 @@ cdef class ColumnSchema(_Weakrefable):
         ParquetSchema parent
         const ColumnDescriptor* descr
 
-    def __cinit__(self, ParquetSchema schema, int index):
+    def __cinit__(self, ParquetSchema schema not None, int index):
         self.parent = schema
         self.index = index  # for pickling support
         self.descr = schema.schema.Column(index)
```

**File**: `python/pyarrow/array.pxi` (modified, +9/-6)
```diff
@@ -1329,8 +1329,8 @@ cdef class Array(_PandasConvertible):
             (_reduce_array_data(self.sp_array.get().data().get()),)
 
     @staticmethod
-    def from_buffers(DataType type, length, buffers, null_count=-1, offset=0,
-                     children=None):
+    def from_buffers(DataType type not None, length, buffers, null_count=-1,
+                     offset=0, children=None):
         """
         Construct an Array from a sequence of buffers.
 
@@ -1386,6 +1386,8 @@ cdef class Array(_PandasConvertible):
             c_buffers.push_back(pyarrow_unwrap_buffer(buf))
 
         for child in children:
+            if child is None:
+                raise TypeError("Array child must not be None")
             c_child_data.push_back(child.ap.data())
 
         array_data = CArrayData.MakeWithChildren(type.sp_type, length,
@@ -4328,8 +4330,9 @@ cdef class DictionaryArray(Array):
         return self._indices
 
     @staticmethod
-    def from_buffers(DataType type, int64_t length, buffers, Array dictionary,
-                     int64_t null_count=-1, int64_t offset=0):
+    def from_buffers(DataType type not None, int64_t length, buffers,
+                     Array dictionary not None, int64_t null_count=-1,
+                     int64_t offset=0):
         """
         Construct a DictionaryArray from buffers.
 
@@ -4745,8 +4748,8 @@ cdef class RunEndEncodedArray(Array):
                                                run_ends, values, 0)
 
     @staticmethod
-    def from_buffers(DataType type, length, buffers, null_count=-1, offset=0,
-                     children=None):
+    def from_buffers(DataType type not None, length, buffers, null_count=-1,
+                     offset=0, children=None):
         """
         Construct a RunEndEncodedArray from all the parameters that make up an
         Array.
```

**File**: `python/pyarrow/tests/parquet/test_metadata.py` (modified, +12/-0)
```diff
@@ -351,6 +351,12 @@ def test_parquet_sorting_column():
     with pytest.raises(ValueError):
         pq.SortingColumn.from_ordering(schema, (("a", "not a valid sort order")))
 
+    with pytest.raises(TypeError, match="Argument 'schema' has incorrect type"):
+        pq.SortingColumn.from_ordering(None, ())
+
+    with pytest.raises(TypeError, match="Argument 'schema' has incorrect type"):
+        pq.SortingColumn.to_ordering(None, ())
+
     with pytest.raises(ValueError, match="inconsistent null placement"):
         sorting_cols = (
             pq.SortingColumn(1, nulls_first=True),
@@ -871,6 +877,12 @@ def msg(c):
     with pytest.raises(TypeError, match=msg("FileMetaData")):
         pq.FileMetaData()
 
+    with pytest.raises(TypeError, match="Argument 'container'"):
+        pq.ParquetSchema(None)
+
+    with pytest.raises(TypeError, match="Argument 'schema'"):
+        pq.ColumnSchema(None, 0)
+
 
 def test_read_schema_uuid_extension_type(tmp_path):
     # These are the raw 16-byte payloads for
```

**File**: `python/pyarrow/tests/test_acero.py` (modified, +5/-0)
```diff
@@ -247,6 +247,8 @@ def test_project(table_source):
     # input validation
     with pytest.raises(ValueError):
         ProjectNodeOptions([pc.multiply(field("a"), 2)], ["a2", "b2"])
+    with pytest.raises(TypeError, match="Expression must not be None"):
+        ProjectNodeOptions([None])
 
     # no scalar expression
     decl = Declaration.from_sequence([
@@ -597,3 +599,6 @@ def test_scan(tempdir):
     assert result["a"].to_pylist() == [1, 2, 3]
     # "b" is still included, but without data as it will be removed by the projection
     assert pc.all(result["b"].is_null()).as_py()
+
+    with pytest.raises(TypeError, match="Argument 'dataset'"):
+        ScanNodeOptions(None)
```

**File**: `python/pyarrow/tests/test_array.py` (modified, +17/-0)
```diff
@@ -784,6 +784,9 @@ def test_array_from_buffers():
     with pytest.raises(TypeError):
         pa.Array.from_buffers(pa.int16(), 3, ['', ''], offset=1)
 
+    with pytest.raises(TypeError, match="Argument 'type' has incorrect type"):
+        pa.Array.from_buffers(type=None, length=0, buffers=[])
+
 
 def test_string_binary_from_buffers():
     array = pa.array(["a", None, "b", "c"])
@@ -868,6 +871,10 @@ def test_list_from_buffers(list_type_factory):
         pa.Array.from_buffers(ty, 4, buffers[:ty.num_buffers],
                               children=[child, child])
 
+    with pytest.raises(TypeError, match="Array child must not be None"):
+        pa.Array.from_buffers(
+            type=ty, length=4, buffers=buffers[:ty.num_buffers], children=[None])
+
 
 def test_struct_from_buffers():
     ty = pa.struct([pa.field('a', pa.int16()), pa.field('b', pa.utf8())])
@@ -987,6 +994,13 @@ def test_dictionary_from_buffers(offset):
                                         offset=offset)
     assert a[offset:] == b
 
+    with pytest.raises(TypeError, match="Argument 'type' has incorrect type"):
+        pa.DictionaryArray.from_buffers(
+            None, len(a), a.indices.buffers(), a.dictionary)
+    with pytest.raises(TypeError, match="Argument 'dictionary' has incorrect type"):
+        pa.DictionaryArray.from_buffers(
+            a.type, len(a), a.indices.buffers(), None)
+
 
 @pytest.mark.numpy
 def test_dictionary_from_numpy():
@@ -4275,6 +4289,9 @@ def test_run_end_encoded_from_buffers():
         pa.RunEndEncodedArray.from_buffers(ree_type, length, buffers,
                                            1, offset, children)
 
+    with pytest.raises(TypeError, match="Argument 'type' has incorrect type"):
+        pa.RunEndEncodedArray.from_buffers(type=None, length=0, buffers=[])
+
 
 @pytest.mark.numpy
 def test_run_end_encoded_from_array_with_type():
```

---

### Incident Patch 2: `48e4abf5` (2026-11-13)
**Commit Message**: GH-47329: [Packaging][Python][C++] Build and test PyArrow against Pyodide 314 (`2026_0` ABI) (#47330)

### Rationale for this change

This PR allows PyArrow to be built and tested against our Pyodide `2026_0` ABI introduced with [the Pyodide 314.0.0 release](https://blog.pyodide.org/posts/314-release/).

Closes #47329

### What changes are included in this PR?

This PR updates the Pyodide version in the build scripts to 314.0.7 and the Emscripten version to 5.0.3, along with associated build-time changes to fix compilation issues.

This PR updates the `conda-python-emscripten` job to Pyodide 314.0.7, Python 3.14, Node 24, and pyodide-build 0.39.2 and later. The Emscripten version for this job is gathered from the Pyodide distribution, which renders it to be 5.0.3. That matches the version the C++ job uses, since #55417.

The build changes are as follows:

- Emscripten builds now use native WebAssembly exceptions and WebAssembly-based `setjmp`/`longjmp` (`-fwasm-exceptions -sSUPPORT_LONGJMP=wasm`), as our `2026_0` ABI requires.
- `libarrow_python.so` and the Cython extension modules are linked with an `$ORIGIN` RPATH, in order for us to find `libarrow_python.so` next to the modules 

**File**: `ci/docker/conda-python-emscripten.dockerfile` (modified, +15/-8)
```diff
@@ -18,32 +18,39 @@
 ARG repo
 ARG arch
 ARG arch_short
-ARG python="3.12"
+ARG python="3.14"
 FROM --platform=linux/${arch} ${repo}:${arch_short}-conda-python-${python}
 
 ARG selenium_version="4.41.0"
-ARG pyodide_version="0.27.1"
+ARG pyodide_version="314.0.7"
+# pyodide-build is versioned independently of Pyodide
+ARG pyodide_build_version="0.39.2"
 ARG chrome_version="latest"
-ARG required_python_min="(3,12)"
-# fail if python version < 3.12
+ARG required_python_min="(3,14)"
+# fail if python version < 3.14
 RUN echo "check PYTHON>=${required_python_min}" && python -c "import sys;sys.exit(0 if sys.version_info>=${required_python_min} else 1)"
 
-# install selenium and recent pyodide-build and recent python
+RUN apt-get update -y -q && \
+    apt-get install -y -q --no-install-recommends \
+        libatomic1 && \
+    apt-get clean && \
+    rm -rf /var/lib/apt/lists/*
 
 # needs to be a login shell so ~/.profile is read
 SHELL ["/bin/bash", "--login", "-c", "-o", "pipefail"]
 
+# install selenium and recent pyodide-build and recent python
 RUN python -m pip install --no-cache-dir selenium==${selenium_version} && \
-    python -m pip install --no-cache-dir --upgrade pyodide-build>=${pyodide_version}
+    python -m pip install --no-cache-dir --upgrade "pyodide-build>=${pyodide_build_version}"
 
 # install pyodide dist directory to /pyodide
 RUN pyodide_dist_url="https://github.com/pyodide/pyodide/releases/download/${pyodide_version}/pyodide-${pyodide_version}.tar.bz2" && \
     wget -q "${pyodide_dist_url}" -O- | tar -xj -C /
 
-# install node 20 (needed for async call support)
+# install node 24 (needed for async call support and JSPI)
 # and pthread-stubs for build, and unzip needed for chrome build to work
 # xz is needed by emsdk to extract node tarballs
-RUN conda install nodejs=20 unzip pthread-stubs make xz -c conda-forge
+RUN conda install nodejs=24 unzip pthread-stubs make xz -c conda-forge
 
 # install correct version of emscripten for this pyodide
 COPY ci/scripts/install_emscripten.sh /arrow/ci/scripts/
```

**File**: `compose.yaml` (modified, +3/-2)
```diff
@@ -982,10 +982,11 @@ services:
         arch_short: ${ARCH_SHORT}
         clang_tools: ${CLANG_TOOLS}
         llvm: ${LLVM}
-        pyodide_version: "0.27.1"
+        pyodide_version: "314.0.7"
+        pyodide_build_version: "0.39.2"
         chrome_version: "latest"
         selenium_version: "4.41.0"
-        required_python_min: "(3,12)"
+        required_python_min: "(3,14)"
         python: ${PYTHON}
     shm_size: *shm-size
     volumes: *ubuntu-volumes
```

**File**: `cpp/cmake_modules/SetupCxxFlags.cmake` (modified, +20/-11)
```diff
@@ -714,26 +714,35 @@ if(MSVC)
 endif()
 
 if(CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
-  # flags are:
+  # For the Pyodide 2026_0 ABI, the flags are:
   # 1) We force *everything* to build as position independent
-  # 2) And with support for C++ exceptions
-  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC -fexceptions")
+  # 2) We support C++ WASM exceptions, using the native WebAssembly
+  #    exception handling proposal and WebAssembly-based setjmp/longjmp
+  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC -fwasm-exceptions -sSUPPORT_LONGJMP=wasm")
   # deprecated-literal-operator error is thrown in datetime (vendored lib in arrow)
   set(CMAKE_CXX_FLAGS
-      "${CMAKE_CXX_FLAGS} -fPIC -fexceptions -Wno-error=deprecated-literal-operator")
+      "${CMAKE_CXX_FLAGS} -fPIC -fwasm-exceptions -sSUPPORT_LONGJMP=wasm -Wno-error=deprecated-literal-operator"
+  )
 
   # flags for creating shared libraries (only used in pyarrow, because
   # Emscripten builds libarrow as static)
   # flags are:
   # 1) Tell it to use JavaScript / WebAssembly 64 bit number support.
-  # 2) Tell it to build with support for C++ exceptions
+  # 2) Tell it to build with support for C++ exceptions (see above)
   # 3) Skip linker flags error which happens with -soname parameter
-  set(ARROW_EMSCRIPTEN_LINKER_FLAGS "-sWASM_BIGINT=1 -fexceptions -Wno-error=linkflags")
-  set(CMAKE_SHARED_LIBRARY_CREATE_C_FLAGS
-      "-sSIDE_MODULE=1 ${ARROW_EMSCRIPTEN_LINKER_FLAGS}")
-  set(CMAKE_SHARED_LIBRARY_CREATE_CXX_FLAGS
-      "-sSIDE_MODULE=1 ${ARROW_EMSCRIPTEN_LINKER_FLAGS}")
-  set(CMAKE_SHARED_LINKER_FLAGS "-sSIDE_MODULE=1 ${ARROW_EMSCRIPTEN_LINKER_FLAGS}")
+  # 4) Record $ORIGIN as an RPATH, so that Pyodide can locate
+  #    libarrow_python.so next to the extension modules needing it
+  # Note: the CMAKE_SHARED_LIBRARY_CREATE_<LANG>_FLAGS and
+  # CMAKE_SHARED_MODULE_CREATE_<LANG>_FLAGS variables are not used by the
+  # Ninja generator, so the flags must go through the linker-flags
+  # variables, which apply to SHARED (libarrow_python) and MODULE (Cython
+  # extension) targets respectively.
+  set(ARROW_EMSCRIPTEN_LINKER_FLAGS
+      "-sWASM_BIGINT=1 -fwasm-exceptions -sSUPPORT_LONGJMP=wasm -Wno-error=linkflags")
+  set(ARROW_EMSCRIPTEN_DYLIB_CREATE_FLAGS
+      "-sSIDE_MODULE=1 ${ARROW_EMSCRIPTEN_LINKER_FLAGS} '-Wl,-rpath,$ORIGIN'")
+  set(CMAKE_SHARED_LINKER_FLAGS "${ARROW_EMSCRIPTEN_DYLIB_CREATE_FLAGS}")
+  set(CMAKE_MODULE_LINKER_FLAGS "${ARROW_EMSCRIPTEN_DYLIB_CREATE_FLAGS}")
   if(ARROW_TESTING)
     # Deeply nested tests need a larger stack (1 MiB).
     set(ARROW_EMSCRIPTEN_TEST_STACK_SIZE 1048576)
```

**File**: `cpp/cmake_modules/ThirdpartyToolchain.cmake` (modified, +4/-0)
```diff
@@ -2171,6 +2171,10 @@ function(build_protobuf)
     set(PROTOBUF_HOST_CMAKE_ARGS
         "-DCMAKE_CXX_FLAGS="
         "-DCMAKE_C_FLAGS="
+        # Explicitly set the C++ standard for the host build. Without this,
+        # Abseil may be compiled with the host compiler's default standard,
+        # which can be older than C++17.
+        "-DCMAKE_CXX_STANDARD=${CMAKE_CXX_STANDARD}"
         "-DCMAKE_INSTALL_PREFIX=${PROTOBUF_HOST_PREFIX}"
         -Dprotobuf_BUILD_TESTS=OFF
         -Dprotobuf_DEBUG_POSTFIX=
```

**File**: `dev/tasks/tasks.yml` (modified, +1/-1)
```diff
@@ -493,7 +493,7 @@ tasks:
     params:
       env:
         UBUNTU: 22.04
-        PYTHON: 3.12
+        PYTHON: 3.14
       image: conda-python-emscripten
 
   test-conda-python-3.11-hypothesis:
```

**File**: `docs/source/developers/cpp/emscripten.rst` (modified, +5/-4)
```diff
@@ -34,9 +34,9 @@ activate it using the commands below (see https://emscripten.org/docs/getting_st
    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    # replace <version> with the desired EMSDK version.
-   # e.g. for Pyodide 0.26, you need EMSDK version 3.1.58
+   # e.g. for Pyodide 314.0.x, you need EMSDK version 5.0.3
    # the versions can be found in the Makefile.envs file in the Pyodide repo:
-   # https://github.com/pyodide/pyodide/blob/10b484cfe427e076c929a55dc35cfff01ea8d3bc/Makefile.envs
+   # https://github.com/pyodide/pyodide/blob/314.0.7/Makefile.envs
    ./emsdk install <version>
    ./emsdk activate <version>
    source ./emsdk_env.sh
@@ -49,8 +49,9 @@ versions of emsdk tools.
 .. code:: shell
 
    # install Pyodide build tools.
-   # e.g., for version 0.26 of Pyodide, pyodide-build 0.26 and later work
-   pip install "pyodide-build>=0.26"
+   # pyodide-build is versioned independently of Pyodide.
+   # For Pyodide 314.0.x, pyodide-build 0.39.2 and later work well
+   pip install "pyodide-build>=0.39.2"
 
 Then build with the ``ninja-release-emscripten`` CMake preset,
 like below:
```

**File**: `python/CMakeLists.txt` (modified, +3/-1)
```diff
@@ -111,7 +111,9 @@ if("$ENV{CMAKE_EXPORT_COMPILE_COMMANDS}" STREQUAL "1")
   set(CMAKE_EXPORT_COMPILE_COMMANDS 1)
 endif()
 
-if(UNIX)
+# On Emscripten, the equivalent $ORIGIN runtime path is added
+# through the linker flags in SetupCxxFlags.cmake instead
+if(UNIX AND NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
   set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
   # In the event that we are bundling the shared libraries (e.g. in a
   # manylinux1 wheel), we need to set the RPATH of the extensions to the
```

**File**: `python/pyarrow/tests/test_csv.py` (modified, +1/-0)
```diff
@@ -2202,6 +2202,7 @@ def test_write_csv_decimal(tmpdir, type_factory):
     assert out.column('col').cast(type) == table.column('col')
 
 
+@pytest.mark.threading
 def test_read_csv_gil_deadlock():
     # GH-38676
     # This test depends on several preconditions:
```

---

### Incident Patch 3: `b5dd1041` (2026-11-13)
**Commit Message**: MINOR: [Docs] Fix compatibility spelling (#55574)

### Rationale for this change

While I was going through the Apache Arrow codebase as someone who is new to open source, I came across a small spelling mistake in the R packaging documentation. I thought I'd take the opportunity to fix it.

### What changes are included in this PR?

A minor spelling correction in the R packaging documentation. No functional changes.

### Are these changes tested?

Not applicable. This is a documentation-only change.

### Are there any user-facing changes?

No functional user-facing changes. Only a documentation correction.

### Was AI used for this PR?

**PR code and description written by:**

- [O] Human
- [ ] AI

**Reviewed before submission by:**

- [O] Human
- [ ] AI
- [ ] Not reviewed

This might be a very small contribution, but it's my first ever open-source contribution, so it means quite a lot to me. I'm looking forward to continuing to explore the codebase, learn more about the project, and hopefully contribute more in the future.

Thanks for maintaining Apache Arrow and for making it welcoming to new contributors like me!

Authored-by: Sumedh Pimplikar <[REDACTED_EMAIL]>
Signed-off-by: N

**File**: `r/PACKAGING.md` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ _This step must be done by the current package maintainer._
 
 - [ ] CRAN has accepted the submission.
 - [ ] Tag the tip of the CRAN-specific release branch with `r-universe-release`; e.g. `git tag -f r-universe-release maint-X.Y.Z-r && git push upstream r-universe-release --force`
-- [ ] Add a new line to the matrix in the [backwards compatability job](https://github.com/apache/arrow/blob/main/dev/tasks/r/github.linux.arrow.version.back.compat.yml).
+- [ ] Add a new line to the matrix in the [backwards compatibility job](https://github.com/apache/arrow/blob/main/dev/tasks/r/github.linux.arrow.version.back.compat.yml).
 - [ ] (patch releases only) Update the package version in `ci/scripts/PKGBUILD`, `r/DESCRIPTION`, and `r/NEWS.md`.
 - [ ] (CRAN-only releases) Rebuild news page with `pkgdown::build_news()` and submit a PR to the asf-site branch of the docs site with the contents of `arrow/r/docs/news/index.html` replacing the current contents of `arrow-site/docs/r/news/index.html`.
 - [ ] (CRAN-only releases) Bump the version number in `r/pkgdown/assets/versions.json`, and update this on the [the `asf-site` branch of the docs site](https://github.com/apache/arrow-site) too..
```

#### Recent Merged Pull Requests:
- **PR #55610** (closed): GH-55503: [C++] Fix Float16 memo table keys built from raw bits (@AnuragRaut08)
- **PR #55574** (2026-11-13): MINOR: [Docs] Fix compatibility spelling (@Sumdiboii)
- **PR #55496** (2026-11-12): GH-55495: [Packaging][deb] Extract source archive like dpkg-source in apt/build.sh (@kou)
- **PR #55492** (closed): GH-55478: [R] Vendored dependencies to enable parquet (biggest change, smallest tarball) (@jonkeane)
- **PR #55485** (2026-11-12): GH-38983: [Python] Bug in pyarrow.from_pandas() when input has MultiIndex index columns having non-string names (@thisisnic)
- **PR #55482** (2026-11-11): MINOR: [CI] Bump docker/login-action from 4.7.0 to 4.8.0 (@dependabot[bot])

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

## X. GH-51043: [Python] Reject null required Arrow objects

**RULE**:
When implementing operations in `python/pyarrow/_acero.pyx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/arrow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0974e94e`: GH-51043: [Python] Reject null required Arrow objects. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `python/pyarrow/_acero.pyx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
            if expr is None:
                raise TypeError("Expression must not be None")
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0974e94e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
