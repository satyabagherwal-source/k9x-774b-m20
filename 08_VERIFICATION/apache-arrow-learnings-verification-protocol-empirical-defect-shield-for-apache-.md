# Verification Protocol: Verification Protocol: Empirical Defect Shield for apache-arrow-learnings

<!-- PROVENANCE_START
{
  "source_repository": "apache-arrow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:33:22.950Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-apache-arrow-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-arrow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:33:22.950Z`  
> **Learning ID**: `LEARN-REEXTRACT-apache-arrow-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `apache-arrow-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-arrow-learnings.md`  
> **Source**: github ([https://github.com/apache/arrow](https://github.com/apache/arrow))  
> **Source Version**: `976779b2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T10:08:04.386Z  
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
> **Harvest Timestamp**: 2026-11-11T10:08:04.215Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/arrow`
- **Description**: Apache Arrow is the universal columnar format and multi-language toolbox for fast data interchange and in-memory analytics
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17290 stars

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
- **Issue #55482** (2026-11-11): **MINOR: [CI] Bump docker/login-action from 4.7.0 to 4.8.0**
  *Symptoms*: Bumps [docker/login-action](https://github.com/docker/login-action) from 4.7.0 to 4.8.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/docker/login-action/releases">docker/login-action's releases</a>.</em></p> <blockquote> <h2>v4.8.0</h2> <ul> <li>Set Docker Hub OIDC token lifetime default to 1 hour by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/login-action/pull/1070">docker/login-action#1070</a></li> <li>Bump <code>@​aws-sdk/client-ecr</code> and <code>@​aws-sdk/client-ecr-public</code> to 3.1161.0 in <a href="https://redirect.github.com/docker/login-action/pull/1103">docker/login-action#1103</a></li> <li>Bump <code>@​docker/actions-toolkit</code> from 0.107.0 to 0.109.0 in <a href="https://redirect.github.com/docker/login-action/pull/1105">docker/login-action#1105</a></li> <li>Bump vite from 7.3.6 to 7.3.7 in <a href="https://redirect.github.com/docker/login-action/pull/1101">docker/login-action#1101</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/docker/login-action/compare/v4.7.0...v4.8.0">https://github.com/docker/login-action/compare/v4.7.0...v4.8.0</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/docker/login-action/commit/8aa5831fb8d48d8f76594c7ddde61ae58019f550"><code>8aa5831</code></a> Merge pull request <a href="https://redirect.github.com/docker/login-action/iss

- **Issue #55481** (2026-11-11): **MINOR: [CI] Bump the apache-infrastructure-actions-stash group with 2 updates**
  *Symptoms*: Updates the requirements on [apache/infrastructure-actions/stash/restore](https://github.com/apache/infrastructure-actions) and [apache/infrastructure-actions/stash/save](https://github.com/apache/infrastructure-actions) to permit the latest version. Updates `apache/infrastructure-actions/stash/restore` to 5a4eaabe6c43770c9df95875a513a6b8362be5eb <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/apache/infrastructure-actions/commits/5a4eaabe6c43770c9df95875a513a6b8362be5eb">compare view</a></li> </ul> </details> <br />  Updates `apache/infrastructure-actions/stash/save` to 5a4eaabe6c43770c9df95875a513a6b8362be5eb <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/apache/infrastructure-actions/commits/5a4eaabe6c43770c9df95875a513a6b8362be5eb">compare view</a></li> </ul> </details> <br />   Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the sp

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

### Incident Patch 1: `bea76d64` (2026-11-11)
**Commit Message**: GH-55277: [C++][Gandiva] Fix stack overflow in decimal evaluation with JIT optimization disabled (#55278)

### Rationale for this change
Gandiva can exhaust the stack when evaluating decimal expressions with JIT optimization disabled. Decimal return slots are allocated inside the record loop, so each row uses more stack. The stack is only released when the function returns.

### What changes are included in this PR?
Move return-slot allocations to the function entry block in `CallDecimalFunction` and `AddLarge`.

### Are these changes tested?
Locally, the large-batch test crashes before the fix (SIGSEGV, exit 139) and passes afterward. It checks negative values and nulls, with optimization off and on.

### Are there any user-facing changes?
No.

**This PR contains a "Critical Fix".** It fixes a native process crash.

### Was AI used for this PR?
AI tools helped investigate the crash and write the fix, tests, and description.

**PR code and description written by:**
- [x] Human
- [x] AI

**Reviewed before submission by:**
- [x] Human
- [ ] AI

GitHub Issue: #55277

P.S. The first commit contains only the regression test. The second commit contains only the fix.
* GitHub Issue: #5527

**File**: `cpp/src/gandiva/decimal_ir.cc` (modified, +12/-6)
```diff
@@ -243,12 +243,18 @@ DecimalIR::ValueWithOverflow DecimalIR::AddWithOverflowCheck(const ValueFull& x,
   return ValueWithOverflow(sum_descaled, overflow);
 }
 
+std::pair<llvm::AllocaInst*, llvm::AllocaInst*> DecimalIR::CreateEntryBlockReturnSlots() {
+  auto& entry = ir_builder()->GetInsertBlock()->getParent()->getEntryBlock();
+  llvm::IRBuilder<> entry_builder(&entry, entry.begin());
+  auto out_high_ptr = entry_builder.CreateAlloca(types()->i64_type(), nullptr, "out_hi");
+  auto out_low_ptr = entry_builder.CreateAlloca(types()->i64_type(), nullptr, "out_low");
+  return {out_high_ptr, out_low_ptr};
+}
+
 // This is pretty complex, so use CPP fns.
 llvm::Value* DecimalIR::AddLarge(const ValueFull& x, const ValueFull& y,
                                  const ValueFull& out) {
-  auto block = ir_builder()->GetInsertBlock();
-  auto out_high_ptr = new llvm::AllocaInst(types()->i64_type(), 0, "out_hi", block);
-  auto out_low_ptr = new llvm::AllocaInst(types()->i64_type(), 0, "out_low", block);
+  auto [out_high_ptr, out_low_ptr] = CreateEntryBlockReturnSlots();
   auto x_split = ValueSplit::MakeFromInt128(this, x.value());
   auto y_split = ValueSplit::MakeFromInt128(this, y.value());
 
@@ -454,9 +460,9 @@ llvm::Value* DecimalIR::CallDecimalFunction(const std::string& function_name,
   llvm::Value* result = nullptr;
   if (return_type == i128) {
     // for i128 ret, replace with two int64* args, and join them.
-    auto block = ir_builder()->GetInsertBlock();
-    auto out_high_ptr = new llvm::AllocaInst(i64, 0, "out_hi", block);
-    auto out_low_ptr = new llvm::AllocaInst(i64, 0, "out_low", block);
+    // Decimal calls can be emitted inside the record loop or a CASE branch.
+    // Allocate return slots once per invocation, rather than once per row.
+    auto [out_high_ptr, out_low_ptr] = CreateEntryBlockReturnSlots();
     dis_assembled_args.push_back(out_high_ptr);
     dis_assembled_args.push_back(out_low_ptr);
 
```

**File**: `cpp/src/gandiva/decimal_ir.h` (modified, +4/-0)
```diff
@@ -19,6 +19,7 @@
 
 #include <memory>
 #include <string>
+#include <utility>
 #include <vector>
 
 #include "gandiva/function_ir_builder.h"
@@ -137,6 +138,9 @@ class DecimalIR : public FunctionIRBuilder {
   ValueWithOverflow AddWithOverflowCheck(const ValueFull& x, const ValueFull& y,
                                          const ValueFull& out);
 
+  // Allocate decimal return slots in the current function's entry block.
+  std::pair<llvm::AllocaInst*, llvm::AllocaInst*> CreateEntryBlockReturnSlots();
+
   // Do addition of large integers (both positive and negative).
   llvm::Value* AddLarge(const ValueFull& x, const ValueFull& y, const ValueFull& out);
 
```

**File**: `cpp/src/gandiva/tests/decimal_test.cc` (modified, +36/-0)
```diff
@@ -67,6 +67,42 @@ std::vector<Decimal128> TestDecimal::MakeDecimalVector(std::vector<std::string>
   return ret;
 }
 
+TEST_F(TestDecimal, CastLargeBatch) {
+  // Allocating decimal return slots in the record loop can exhaust the stack
+  // when optimization is disabled. A single int32-to-decimal cast is sufficient.
+  constexpr int kNumRecords = 1 << 19;
+  auto input_field = arrow::field("large_batch_decimal", arrow::int32());
+  auto schema = arrow::schema({input_field});
+  auto decimal_type = arrow::decimal128(10, 0);
+  auto decimal = TreeExprBuilder::MakeFunction(
+      "castDECIMAL", {TreeExprBuilder::MakeField(input_field)}, decimal_type);
+  auto expression =
+      TreeExprBuilder::MakeExpression(decimal, arrow::field("result", decimal_type));
+
+  std::vector<int32_t> values(kNumRecords);
+  std::vector<bool> validity(kNumRecords);
+  std::vector<Decimal128> expected_values(kNumRecords);
+  for (int i = 0; i < kNumRecords; ++i) {
+    values[i] = i % 17 - 8;
+    validity[i] = i % 11 != 0;
+    expected_values[i] = Decimal128(values[i]);
+  }
+  auto batch = arrow::RecordBatch::Make(schema, kNumRecords,
+                                        {MakeArrowArrayInt32(values, validity)});
+  auto expected = MakeArrowArrayDecimal(decimal_type, expected_values, validity);
+
+  for (bool optimize : {false, true}) {
+    SCOPED_TRACE(optimize);
+    auto config = std::make_shared<Configuration>(optimize);
+    std::shared_ptr<Projector> projector;
+    ASSERT_OK(Projector::Make(schema, {expression}, config, &projector));
+    arrow::ArrayVector output;
+    ASSERT_OK(projector->Evaluate(*batch, pool_, &output));
+    ASSERT_EQ(output.size(), 1);
+    EXPECT_ARROW_ARRAY_EQUALS(expected, output[0]);
+  }
+}
+
 TEST_F(TestDecimal, TestSimple) {
   // schema for input fields
   constexpr int32_t precision = 36;
```

---

### Incident Patch 2: `16900e3b` (2026-11-10)
**Commit Message**: GH-49884: [C++] Fix integer overflow in BufferBuilder reachable from JSON parsing (#49883)

### Rationale for this change

`BufferBuilder` and `TypedBufferBuilder` perform size calculations that are reachable from JSON parsing of untrusted input. These calculations previously used unchecked integer arithmetic (e.g., `size_ + additional_bytes`, `num_elements * sizeof(T)`), which can overflow.

Since the JSON parser constructs arrays, strings, and offsets based on input data, an attacker can influence these values. Overflow in these calculations can result in incorrect buffer sizing and unsafe memory operations.

### What changes are included in this PR?

- Added overflow-safe arithmetic using `internal::AddWithOverflow` and `internal::MultiplyWithOverflow` for:
  - `size_ + additional_bytes`
  - `num_elements * sizeof(T)`
  - capacity growth logic

- Centralised the negative / too-large capacity check in a single `ValidateBufferCapacity` helper in `memory_pool.cc`, used by `PoolBuffer::Reserve`, `PoolBuffer::Resize` and `AllocateResizableBuffer`

- Hardened `GrowByFactor` to prevent overflow when doubling capacity

- Updated `TypedBufferBuilder` to safely compute byte sizes from ele

**File**: `cpp/src/arrow/buffer_builder.h` (modified, +54/-14)
```diff
@@ -29,6 +29,7 @@
 #include "arrow/util/bit_util.h"
 #include "arrow/util/bitmap_generate.h"
 #include "arrow/util/bitmap_ops.h"
+#include "arrow/util/int_util_overflow.h"
 #include "arrow/util/macros.h"
 #include "arrow/util/ubsan.h"
 #include "arrow/util/visibility.h"
@@ -91,7 +92,12 @@ class ARROW_EXPORT BufferBuilder {
   /// \param[in] additional_bytes number of additional bytes to make space for
   /// \return Status
   Status Reserve(const int64_t additional_bytes) {
-    auto min_capacity = size_ + additional_bytes;
+    int64_t min_capacity;
+    if (ARROW_PREDICT_FALSE(
+            internal::AddWithOverflow(size_, additional_bytes, &min_capacity))) {
+      return Status::CapacityError("Reserve: capacity overflow: ", size_, " + ",
+                                   additional_bytes);
+    }
     if (min_capacity <= capacity_) {
       return Status::OK();
     }
@@ -104,15 +110,24 @@ class ARROW_EXPORT BufferBuilder {
     // (versus 1.5x) seems to have slightly better performance when using
     // jemalloc, but significantly better performance when using the system
     // allocator. See ARROW-6450 for further discussion
-    return std::max(new_capacity, current_capacity * 2);
+    int64_t doubled;
+    if (ARROW_PREDICT_FALSE(
+            internal::AddWithOverflow(current_capacity, current_capacity, &doubled))) {
+      return new_capacity;
+    }
+    return std::max(new_capacity, doubled);
   }
 
   /// \brief Append the given data to the buffer
   ///
   /// The buffer is automatically expanded if necessary.
   Status Append(const void* data, const int64_t length) {
-    if (ARROW_PREDICT_FALSE(size_ + length > capacity_)) {
-      ARROW_RETURN_NOT_OK(Resize(GrowByFactor(capacity_, size_ + length), false));
+    int64_t new_size;
+    if (ARROW_PREDICT_FALSE(internal::AddWithOverflow(size_, length, &new_size))) {
+      return Status::CapacityError("Append: size overflow: ", size_, " + ", length);
+    }
+    if (ARROW_PREDICT_FALSE(new_size > capacity_)) {
+      ARROW_RETURN_NOT_OK(Resize(GrowByFactor(capacity_, new_size), false));
     }
     UnsafeAppend(data, length);
     return Status::OK();
@@ -250,12 +265,13 @@ class TypedBufferBuilder<
   }
 
   Status Append(const T* values, int64_t num_elements) {
-    return bytes_builder_.Append(reinterpret_cast<const uint8_t*>(values),
-                                 num_elements * sizeof(T));
+    int64_t num_bytes = 0;
+    ARROW_RETURN_NOT_OK(ElementsToBytes("Append", num_elements, &num_bytes));
+    return bytes_builder_.Append(reinterpret_cast<const uint8_t*>(values), num_bytes);
   }
 
   Status Append(const int64_t num_copies, T value) {
-    ARROW_RETURN_NOT_OK(Reserve(num_copies + length()));
+    ARROW_RETURN_NOT_OK(Reserve(num_copies));
     UnsafeAppend(num_copies, value);
     return Status::OK();
   }
@@ -284,15 +300,21 @@ class TypedBufferBuilder<
   }
 
   Status Resize(const int64_t new_capacity, bool shrink_to_fit = true) {
-    return bytes_builder_.Resize(new_capacity * sizeof(T), shrink_to_fit);
+    int64_t num_bytes = 0;
+    ARROW_RETURN_NOT_OK(ElementsToBytes("Resize", new_capacity, &num_bytes));
+    return bytes_builder_.Resize(num_bytes, shrink_to_fit);
   }
 
   Status Reserve(const int64_t additional_elements) {
-    return bytes_builder_.Reserve(additional_elements * sizeof(T));
+    int64_t num_bytes = 0;
+    ARROW_RETURN_NOT_OK(ElementsToBytes("Reserve", additional_elements, &num_bytes));
+    return bytes_builder_.Reserve(num_bytes);
   }
 
   Status Advance(const int64_t length) {
-    return bytes_builder_.Advance(length * sizeof(T));
+    int64_t num_bytes = 0;
+    ARROW_RETURN_NOT_OK(ElementsToBytes("Advance", length, &num_bytes));
+    return bytes_builder_.Advance(num_bytes);
   }
 
   void UnsafeAdvance(const int64_t length) {
@@ -316,7 +338,9 @@ class TypedBufferBuilder<
   /// only for memory allocation).
   Result<std::shared_ptr<Buffer>> FinishWithLength(int64_t final_length,
                                                    bool shrink_to_fit = true) {
-    return bytes_builder_.FinishWithLength(final_length * sizeof(T), shrink_to_fit);
+    int64_t num_bytes = 0;
+    ARROW_RETURN_NOT_OK(ElementsToBytes("FinishWithLength", final_length, &num_bytes));
+    return bytes_builder_.FinishWithLength(num_bytes, shrink_to_fit);
   }
 
   void Reset() { bytes_builder_.Reset(); }
@@ -327,6 +351,18 @@ class TypedBufferBuilder<
   T* mutable_data() { return reinterpret_cast<T*>(bytes_builder_.mutable_data()); }
 
  private:
+  // Convert a number of elements to a number of bytes, erroring out on
+  // byte size overflow.
+  static Status ElementsToBytes(const char* operation, int64_t num_elements,
+                                int64_t* num_bytes) {
+    if (ARROW_PREDICT_FALSE(internal::MultiplyWithOverflow(
+            num_elements, static_cast<int64_t>(sizeof(T)), num_bytes))) {
+      return Status::CapacityError(operation, ": byte size overflow: ", num_elements,
+                            
```

**File**: `cpp/src/arrow/buffer_test.cc` (modified, +24/-0)
```diff
@@ -726,6 +726,21 @@ TEST(TestBufferBuilder, ResizeReserve) {
   ASSERT_EQ(9, builder.length());
 }
 
+TEST(TestBufferBuilder, ReserveAndAppendOverflow) {
+  const std::string data = "x";
+  auto data_ptr = data.c_str();
+  BufferBuilder builder;
+
+  const int64_t overflow_add = std::numeric_limits<int64_t>::max() - 8;
+  ASSERT_RAISES(OutOfMemory, builder.Reserve(overflow_add));
+
+  ASSERT_OK(builder.Append(data_ptr, 1));
+  constexpr int64_t kMaxLength = std::numeric_limits<int64_t>::max();
+  ASSERT_RAISES(CapacityError, builder.Reserve(kMaxLength));
+  ASSERT_RAISES(CapacityError, builder.Append(data_ptr, kMaxLength));
+  ASSERT_EQ(1, builder.length());
+}
+
 TEST(TestBufferBuilder, Alignment) {
   const std::string data = "some data";
   auto data_ptr = data.c_str();
@@ -862,6 +877,15 @@ TYPED_TEST(TypedTestBufferBuilder, AppendCopies) {
   }
 }
 
+TYPED_TEST(TypedTestBufferBuilder, OverflowAppend) {
+  TypedBufferBuilder<TypeParam> builder;
+
+  const int64_t max_num_elements =
+      std::numeric_limits<int64_t>::max() / static_cast<int64_t>(sizeof(TypeParam)) + 1;
+  ASSERT_RAISES(CapacityError,
+                builder.Append(max_num_elements, static_cast<TypeParam>(0)));
+}
+
 TEST(TestBoolBufferBuilder, Basics) {
   TypedBufferBuilder<bool> builder;
 
```

**File**: `cpp/src/arrow/memory_pool.cc` (modified, +14/-9)
```diff
@@ -64,6 +64,17 @@ namespace {
 
 constexpr char kDefaultBackendEnvVar[] = "ARROW_DEFAULT_MEMORY_POOL";
 constexpr char kDebugMemoryEnvVar[] = "ARROW_DEBUG_MEMORY_POOL";
+constexpr int64_t kMaxBufferCapacity = std::numeric_limits<int64_t>::max() - 63;
+
+Status ValidateBufferCapacity(int64_t capacity, const char* operation) {
+  if (ARROW_PREDICT_FALSE(capacity < 0)) {
+    return Status::Invalid(operation, ": negative capacity: ", capacity);
+  }
+  if (ARROW_PREDICT_FALSE(capacity > kMaxBufferCapacity)) {
+    return Status::OutOfMemory(operation, ": capacity too large: ", capacity);
+  }
+  return Status::OK();
+}
 
 enum class MemoryPoolBackend : uint8_t { System, Jemalloc, Mimalloc };
 
@@ -915,9 +926,7 @@ class PoolBuffer final : public ResizableBuffer {
   }
 
   Status Reserve(const int64_t capacity) override {
-    if (capacity < 0) {
-      return Status::Invalid("Negative buffer capacity: ", capacity);
-    }
+    RETURN_NOT_OK(ValidateBufferCapacity(capacity, "Reserve"));
     uint8_t* ptr = mutable_data();
     if (!ptr || capacity > capacity_) {
       ARROW_ASSIGN_OR_RAISE(int64_t new_capacity, RoundCapacity(capacity));
@@ -933,9 +942,7 @@ class PoolBuffer final : public ResizableBuffer {
   }
 
   Status Resize(const int64_t new_size, bool shrink_to_fit = true) override {
-    if (ARROW_PREDICT_FALSE(new_size < 0)) {
-      return Status::Invalid("Negative buffer resize: ", new_size);
-    }
+    RETURN_NOT_OK(ValidateBufferCapacity(new_size, "Resize"));
     uint8_t* ptr = mutable_data();
     if (ptr && shrink_to_fit && new_size <= size_) {
       // Buffer is non-null and is not growing, so shrink to the requested size without
@@ -979,9 +986,7 @@ class PoolBuffer final : public ResizableBuffer {
 
  private:
   static Result<int64_t> RoundCapacity(int64_t capacity) {
-    if (capacity > std::numeric_limits<int64_t>::max() - 63) {
-      return Status::OutOfMemory("capacity too large");
-    }
+    DCHECK_LE(capacity, kMaxBufferCapacity);
     return bit_util::RoundUpToMultipleOf64(capacity);
   }
 
```

---

### Incident Patch 3: `87eb47ec` (2026-11-09)
**Commit Message**: GH-53500: [Python][Parquet] Prevent crashes when comparing metadata with None (#55168)

### Rationale for this change
Five Parquet metadata/schema `equals()` wrappers (`Statistics`, `ColumnChunkMetaData`, `RowGroupMetaData`, `ParquetSchema`, `ColumnSchema`) accept `None` for their typed `other` argument and then dereference a native pointer on it, which can crash the interpreter. This follows the existing `FileMetaData.equals()` pattern, which already declares `other not None`.

### What changes are included in this PR?
- Require non-null typed arguments in the five affected Cython `equals()` methods. `__eq__` already catches the resulting `TypeError` and returns `NotImplemented`, so `obj == None` is `False` and `obj != None` is `True`.
- Add a regression test covering `==`, `!=` and direct `.equals(None)` for all five wrappers.

### Are these changes tested?
Yes. I added a regression test and ran it locally: it passes with the fix and segfaults without it (details in the comment below). `flake8` and `cython-lint` pass on the changed files.

See comment for detailed testing evidence.

### Are there any user-facing changes?
`obj.equals(None)` now raises `TypeError` instead of riskin

**File**: `python/pyarrow/_parquet.pyx` (modified, +5/-5)
```diff
@@ -108,7 +108,7 @@ cdef class Statistics(_Weakrefable):
         except TypeError:
             return NotImplemented
 
-    def equals(self, Statistics other):
+    def equals(self, Statistics other not None):
         """
         Return whether the two column statistics objects are equal.
 
@@ -521,7 +521,7 @@ cdef class ColumnChunkMetaData(_Weakrefable):
         except TypeError:
             return NotImplemented
 
-    def equals(self, ColumnChunkMetaData other):
+    def equals(self, ColumnChunkMetaData other not None):
         """
         Return whether the two column chunk metadata objects are equal.
 
@@ -919,7 +919,7 @@ cdef class RowGroupMetaData(_Weakrefable):
         except TypeError:
             return NotImplemented
 
-    def equals(self, RowGroupMetaData other):
+    def equals(self, RowGroupMetaData other not None):
         """
         Return whether the two row group metadata objects are equal.
 
@@ -1295,7 +1295,7 @@ cdef class ParquetSchema(_Weakrefable):
         except TypeError:
             return NotImplemented
 
-    def equals(self, ParquetSchema other):
+    def equals(self, ParquetSchema other not None):
         """
         Return whether the two schemas are equal.
 
@@ -1350,7 +1350,7 @@ cdef class ColumnSchema(_Weakrefable):
     def __reduce__(self):
         return ColumnSchema, (self.parent, self.index)
 
-    def equals(self, ColumnSchema other):
+    def equals(self, ColumnSchema other not None):
         """
         Return whether the two column schemas are equal.
 
```

**File**: `python/pyarrow/tests/parquet/test_metadata.py` (modified, +21/-0)
```diff
@@ -724,6 +724,27 @@ def test_metadata_equals():
         original_metadata.equals(None)
 
 
+def test_parquet_metadata_equals_none(tempdir):
+    table = pa.table({"a": [1, 2, 3]})
+    path = tempdir / "metadata_equals_none.parquet"
+    pq.write_table(table, path)
+
+    metadata = pq.read_metadata(path)
+    row_group = metadata.row_group(0)
+    column_chunk = row_group.column(0)
+    objects = [
+        column_chunk.statistics,
+        column_chunk,
+        row_group,
+        metadata.schema,
+        metadata.schema[0],
+    ]
+
+    for obj in objects:
+        with pytest.raises(TypeError):
+            obj.equals(None)
+
+
 @pytest.mark.parametrize("t1,t2,expected_error", (
     ({'col1': range(10)}, {'col1': range(10)}, None),
     ({'col1': range(10)}, {'col2': range(10)},
```

#### Recent Merged Pull Requests:
- **PR #55482** (2026-11-11): MINOR: [CI] Bump docker/login-action from 4.7.0 to 4.8.0 (@dependabot[bot])
- **PR #55481** (2026-11-11): MINOR: [CI] Bump the apache-infrastructure-actions-stash group with 2 updates (@dependabot[bot])
- **PR #55477** (closed): GH-35721: [Python] Recognize pandas arrays in the array() constructor for the from_pandas argument (@jay23606)
- **PR #55472** (2026-11-11): GH-55471: [Dev] Stop clearing non-existent PR workflow labels on merge script (@raulcd)
- **PR #55469** (2026-11-10): GH-55468: [CI][Packaging] Add libarrow-s3 to the list of allow-downgrades (@raulcd)
- **PR #55466** (2026-11-11): MINOR: [R] Update backwards compatibility matrix for 26.0.1 release (@amoeba)

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

## X. GH-55277: [C++][Gandiva] Fix stack overflow in decimal evaluation with JIT optim

**RULE**:
When implementing operations in `cpp/src/gandiva/decimal_ir.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/arrow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bea76d64`: GH-55277: [C++][Gandiva] Fix stack overflow in decimal evaluation with JIT optimization disabled (#55278). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `cpp/src/gandiva/decimal_ir.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
std::pair<llvm::AllocaInst*, llvm::AllocaInst*> DecimalIR::CreateEntryBlockReturnSlots() {
  auto& entry = ir_builder()->GetInsertBlock()->getParent()->getEntryBlock();
  llvm::IRBuilder<> entry_builder(&entry, entry.begin());
  auto out_high_ptr = entry_builder.CreateAlloca(types()->i64_type(), nullptr, "out_hi");
  auto out_low_ptr = entry_builder.CreateAlloca(types()->i64_type(), nullptr, "out_low");
  return {out_high_ptr, out_low_ptr};
}

  auto [out_high_ptr, out_low_ptr] = CreateEntryBlockReturnSlots();
    // Decimal calls can be emitted inside the record loop or a CASE branch.
    // Allocate return slots once per invocation, rather than once per row.
    auto [out_high_ptr, out_low_ptr] = CreateEntryBlockReturnSlots();
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
  auto block = ir_builder()->GetInsertBlock();
  auto out_high_ptr = new llvm::AllocaInst(types()->i64_type(), 0, "out_hi", block);
  auto out_low_ptr = new llvm::AllocaInst(types()->i64_type(), 0, "out_low", block);
    auto block = ir_builder()->GetInsertBlock();
    auto out_high_ptr = new llvm::AllocaInst(i64, 0, "out_hi", block);
    auto out_low_ptr = new llvm::AllocaInst(i64, 0, "out_low", block);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bea76d64` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
