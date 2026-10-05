# Forensic Learning Record (Deep Inspection): meilisearch/meilisearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/meilisearch-meilisearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meilisearch/meilisearch](https://github.com/meilisearch/meilisearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:09:55.401Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meilisearch/meilisearch`
- **Description**: A lightning-fast search engine API bringing AI-powered hybrid search to your sites and applications.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 59491 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/index-scheduler/src/queue/batches.rs`
```
use std::collections::HashSet;
use std::ops::{Bound, RangeBounds};

use meilisearch_types::batches::{Batch, BatchId};
use meilisearch_types::heed::types::{DecodeIgnore, SerdeBincode, SerdeJson, Str};
use meilisearch_types::heed::{Database, Env, RoTxn, RwTxn, WithoutTls};
use meilisearch_types::milli::{CboRoaringBitmapCodec, RoaringBitmapCodec, BEU32};
use meilisearch_types::tasks::{Kind, Status};
use roaring::{MultiOps, RoaringBitmap};
use time::OffsetDateTime;

use super::{Query, Queue};
use crate::processing::ProcessingTasks;
use crate::utils::{
    insert_task_datetime, keep_ids_within_datetimes, map_bound,
    remove_n_tasks_datetime_earlier_than, remove_task_datetime, ProcessingBatch,
};
use crate::{Error, Result, BEI128};

/// The number of database used by the batch queue
const NUMBER_OF_DATABASES: u32 = 7;
/// Database const names for the `IndexScheduler`.
mod db_name {
    pub const ALL_BATCHES: &str = "all-batches";

    pub const BATCH_STATUS: &str = "batch-status";
    pub const BATCH_KIND: &str = "batch-kind";
    pub const BATCH_INDEX_TASKS: &str = "batch-index-tasks";
    pub const BATCH_ENQUEUED_AT: &str = "batch-enqueued-at";
    pub const BATCH_STARTED_AT: &str = "batch-started-at";
    pub const BATCH_FINISHED_AT: &str = "batch-finished-at";
}

pub struct BatchQueue {
    /// Contains all the batches accessible by their Id.
    pub(crate) all_batches: Database<BEU32, SerdeJson<Batch>>,

    /// All the batches containing a task matching the selected status.
    pub(crate) status: Database<SerdeBincode<Status>, RoaringBitmapCodec>,
    /// All the batches ids grouped by the kind of their task.
    pub(crate) kind: Database<SerdeBincode<Kind>, RoaringBitmapCodec>,
    /// Store the batches associated to an index.
    pub(crate) index_tasks: Database<Str, RoaringBitmapCodec>,
    /// Store the batches containing tasks which were enqueued at a specific date
    pub(crate) enqueued_at: Database<BEI128, CboRoaringBitmapCodec>,
    /// Store the batches containing finished tasks started at a specific date
    pub(crate) started_at: Database<BEI128, CboRoaringBitmapCodec>,
    /// Store the batches containing tasks finished at a specific date
    pub(crate) finished_at: Database<BEI128, CboRoaringBitmapCodec>,
}

impl BatchQueue {
    pub(crate) fn private_clone(&self) -> BatchQueue {
        BatchQueue {
            all_batches: self.all_batches,
            status: self.status,
            kind: self.kind,
            index_tasks: self.index_tasks,
            enqueued_at: self.enqueued_at,
            started_at: self.started_at,
            finished_at: self.finished_at,
        }
    }

    pub(crate) const fn nb_db() -> u32 {
        NUMBER_OF_DATABASES
    }

    pub(crate) fn new(env: &Env<WithoutTls>, wtxn: &mut RwTxn) -> Result<Self> {
        Ok(Self {
            all_batches: env.create_database(wtxn, Some(db_name::ALL_BATCHES))?,
            status: env.create_database(wtxn, Some(db_name::BATCH_STATUS))?,
            kind: env.create_database(wtxn, Some(db_name::BATCH_KIND))?,
            index_tasks: env.create_database(wtxn, Some(db_name::BATCH_INDEX_TASKS))?,
            enqueued_at: env.create_database(wtxn, Some(db_name::BATCH_ENQUEUED_AT))?,
            started_at: env.create_database(wtxn, Some(db_name::BATCH_STARTED_AT))?,
            finished_at: env.create_database(wtxn, Some(db_name::BATCH_FINISHED_AT))?,
        })
    }

    pub(crate) fn all_batch_ids(&self, rtxn: &RoTxn) -> Result<RoaringBitmap> {
        enum_iterator::all().map(|s| self.get_status(rtxn, s)).union()
    }

    pub(crate) fn next_batch_id(&self, rtxn: &RoTxn) -> Result<BatchId> {
        Ok(self
            .all_batches
            .remap_data_type::<DecodeIgnore>()
            .last(rtxn)?
            .map(|(k, _)| k + 1)
            .unwrap_or_default())
    }

    pub(crate) fn get_batch(&self, rtxn: &RoTxn, batch_id: BatchId) -> Result<Option<Batch>> {
        Ok(self.all_batches.get(rtxn, &batch_id)?)
    }

    /// Returns the whole set of batches that belongs to this index.
    pub(crate) fn index_batches(&self, rtxn: &RoTxn, index: &str) -> Result<RoaringBitmap> {
        Ok(self.index_tasks.get(rtxn, index)?.unwrap_or_default())
    }

    pub(crate) fn update_index(
        &self,
        wtxn: &mut RwTxn,
        index: &str,
        f: impl Fn(&mut RoaringBitmap),
    ) -> Result<()> {
        let mut batches = self.index_batches(wtxn, index)?;
        f(&mut batches);
        if batches.is_empty() {
            self.index_tasks.delete(wtxn, index)?;
        } else {
            self.index_tasks.put(wtxn, index, &batches)?;
        }

        Ok(())
    }

    pub(crate) fn get_status(&self, rtxn: &RoTxn, status: Status) -> Result<RoaringBitmap> {
        Ok(self.status.get(rtxn, &status)?.unwrap_or_default())
    }

    pub(crate) fn put_status(
        &self,
        wtxn: &mut RwTxn,
        status: Status,
        bitmap: &RoaringBitmap,
    ) -> Result<()> {
        if bitmap.is_empty() {
            self.status.delete(wtxn, &status)?;
        } else {
            self.status.put(wtxn, &status, bitmap)?;
        }
        Ok(())
    }

    pub(crate) fn update_status(
        &self,
        wtxn: &mut RwTxn,
        status: Status,
        f: impl Fn(&mut RoaringBitmap),
    ) -> Result<()> {
        let mut tasks = self.get_status(wtxn, status)?;
        f(&mut tasks);
        self.put_status(wtxn, status, &tasks)?;

        Ok(())
    }

    pub(crate) fn get_kind(&self, rtxn: &RoTxn, kind: Kind) -> Result<RoaringBitmap> {
        Ok(self.kind.get(rtxn, &kind)?.unwrap_or_default())
    }

    pub(crate) fn put_kind(
        &self,
        wtxn: &mut RwTxn,
        kind: Kind,
        bitmap: &RoaringBitmap,
    ) -> Result<()> {
        Ok(self.kind.put(wtxn, &kind, bitmap)?)
    }

    pub(crate) fn update_kind(
        &self,
        wtxn: &mut RwTxn,
        kind: Kind,
        f: impl Fn(&mut RoaringBitmap),
    ) -> Result<()> {
        let mut tasks = self.get_kind(wtxn, kind)?;
        f(&mut tasks);
        self.put_kind(wtxn, kind, &tasks)?;
        Ok(())
    }

    pub(crate) fn write_batch(&self, wtxn: &mut RwTxn, batch: ProcessingBatch) -> Result<()> {
        let old_batch = self.all_batches.get(wtxn, &batch.uid)?;

        self.all_batches.put(
            wtxn,
            &batch.uid,
            &Batch {
                uid: batch.uid,
                progress: None,
                details: batch.details,
                stats: batch.stats,
                embedder_stats: batch.embedder_stats.as_ref().into(),
                started_at: batch.started_at,
                finished_at: batch.finished_at,
                enqueued_at: batch.enqueued_at,
                stop_reason: batch.reason.to_string(),
            },
        )?;

        // Update the statuses
        if let Some(ref old_batch) = old_batch {
            for status in old_batch.stats.status.keys() {
                self.update_status(wtxn, *status, |bitmap| {
                    bitmap.remove(batch.uid);
                })?;
            }
        }
        for status in batch.statuses {
            self.update_status(wtxn, status, |bitmap| {
                bitmap.insert(batch.uid);
            })?;
        }

        // Update the kinds / types
        if let Some(ref old_batch) = old_batch {
            let kinds: HashSet<_> = old_batch.stats.types.keys().cloned().collect();
            for kind in kinds.difference(&batch.kinds) {
                self.update_kind(wtxn, *kind, |bitmap| {
                    bitmap.remove(batch.uid);
                })?;
            }
        }
        for kind in batch.kinds {
            self.update_kind(wtxn, kind, |bitmap| {
                bitmap.insert(batch.uid);
            })?;
        }

        // Update the indexes
        if let Some(ref old_batch) = old_batch {
            let indexes: HashSet<_> = old_batch.stats.index_uids.keys().cloned().collect();
            for index in indexes.difference(&batch.indexes) {
                self.update_index(wtxn, index, |bitmap| {
                    bitmap.remove(batch.uid);
                })?;
            }
        }
        for index in batch.indexes {
            self.update_index(wtxn, &index, |bitmap| {
                bitmap.insert(batch.uid);
            })?;
        }

        // Update the enqueued_at: we cannot retrieve the previous enqueued at from the previous batch, and
        // must instead go through the db looking for it. We cannot look at the task contained in this batch either
        // because they may have been removed.
        // What we know, though, is that the task date is from before the enqueued_at, and max two timestamps have been written
        // to the DB per batches.
        if let Some(ref old_batch) = old_batch {
            if let Some(enqueued_at) = old_batch.enqueued_at {
                remove_task_datetime(wtxn, self.enqueued_at, enqueued_at.earliest, old_batch.uid)?;
                remove_task_datetime(wtxn, self.enqueued_at, enqueued_at.oldest, old_batch.uid)?;
            } else {
                // If we don't have the enqueued at in the batch it means the database comes from the v1.12
                // and we still need to find the date by scrolling the database
                remove_n_tasks_datetime_earlier_than(
                    wtxn,
                    self.enqueued_at,
                    old_batch.started_at,
                    old_batch.stats.total_nb_tasks.clamp(1, 2) as usize,
                    old_batch.uid,
                )?;
            }
        }
        // A finished batch MUST contains at least one task and have an enqueued_at
        let enqueued_at = batch.enqueued_at.as_ref().unwrap();
        insert_task_datetime(wtxn, self.enqueued_at, enqueued_at.earliest, batch.uid)?;
        insert_task_datetime(wtxn, self.enqueued_at, enqueued_at.oldest, batch.uid)?;

        // Update the started at and finished at
        if let Some(ref old_batch) 
```

### Core Architecture Module: `crates/index-scheduler/src/queue/mod.rs`
```
mod batches;
#[cfg(test)]
mod batches_test;
mod tasks;
#[cfg(test)]
mod tasks_test;
#[cfg(test)]
mod test;

use std::collections::BTreeMap;
use std::fs::File as StdFile;
use std::time::Duration;

use file_store::FileStore;
use meilisearch_types::batches::BatchId;
use meilisearch_types::heed::{Database, Env, RoTxn, RwTxn, WithoutTls};
use meilisearch_types::milli::{CboRoaringBitmapCodec, BEU32};
use meilisearch_types::tasks::network::DbTaskNetwork;
use meilisearch_types::tasks::{Kind, KindWithContent, Status, Task};
use roaring::RoaringBitmap;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

pub(crate) use self::batches::BatchQueue;
pub(crate) use self::tasks::TaskQueue;
use crate::processing::ProcessingTasks;
use crate::utils::{
    check_index_swap_validity, filter_out_references_to_newer_tasks, ProcessingBatch,
};
use crate::{Error, IndexSchedulerOptions, Result, TaskId};

/// The number of database used by queue itself
const NUMBER_OF_DATABASES: u32 = 1;
/// Database const names for the `IndexScheduler`.
pub(crate) mod db_name {
    pub const BATCH_TO_TASKS_MAPPING: &str = "batch-to-tasks-mapping";
}

/// Defines a subset of tasks to be retrieved from the [`IndexScheduler`].
///
/// An empty/default query (where each field is set to `None`) matches all tasks.
/// Each non-null field restricts the set of tasks further.
#[derive(Default, Debug, Clone, PartialEq, Eq)]
pub struct Query {
    /// The maximum number of tasks to be matched
    pub limit: Option<u32>,
    /// The minimum [task id](`meilisearch_types::tasks::Task::uid`) to be matched
    pub from: Option<u32>,
    /// The order used to return the tasks. By default the newest tasks are returned first and the boolean is `false`.
    pub reverse: Option<bool>,
    /// The [task ids](`meilisearch_types::tasks::Task::uid`) to be matched
    pub uids: Option<Vec<TaskId>>,
    /// The [batch ids](`meilisearch_types::batches::Batch::uid`) to be matched
    pub batch_uids: Option<Vec<BatchId>>,
    /// The allowed [statuses](`meilisearch_types::tasks::Task::status`) of the matched tasls
    pub statuses: Option<Vec<Status>>,
    /// The allowed [kinds](meilisearch_types::tasks::Kind) of the matched tasks.
    ///
    /// The kind of a task is given by:
    /// ```
    /// # use meilisearch_types::tasks::{Task, Kind};
    /// # fn doc_func(task: Task) -> Kind {
    /// task.kind.as_kind()
    /// # }
    /// ```
    pub types: Option<Vec<Kind>>,
    /// The allowed [index ids](meilisearch_types::tasks::Task::index_uid) of the matched tasks
    pub index_uids: Option<Vec<String>>,
    /// The [task ids](`meilisearch_types::tasks::Task::uid`) of the [`TaskCancelation`](meilisearch_types::tasks::Task::Kind::TaskCancelation) tasks
    /// that canceled the matched tasks.
    pub canceled_by: Option<Vec<TaskId>>,
    /// Exclusive upper bound of the matched tasks' [`enqueued_at`](meilisearch_types::tasks::Task::enqueued_at) field.
    pub before_enqueued_at: Option<OffsetDateTime>,
    /// Exclusive lower bound of the matched tasks' [`enqueued_at`](meilisearch_types::tasks::Task::enqueued_at) field.
    pub after_enqueued_at: Option<OffsetDateTime>,
    /// Exclusive upper bound of the matched tasks' [`started_at`](meilisearch_types::tasks::Task::started_at) field.
    pub before_started_at: Option<OffsetDateTime>,
    /// Exclusive lower bound of the matched tasks' [`started_at`](meilisearch_types::tasks::Task::started_at) field.
    pub after_started_at: Option<OffsetDateTime>,
    /// Exclusive upper bound of the matched tasks' [`finished_at`](meilisearch_types::tasks::Task::finished_at) field.
    pub before_finished_at: Option<OffsetDateTime>,
    /// Exclusive lower bound of the matched tasks' [`finished_at`](meilisearch_types::tasks::Task::finished_at) field.
    pub after_finished_at: Option<OffsetDateTime>,
}

impl Query {
    /// Return `true` if every field of the query is set to `None`, such that the query
    /// matches all tasks.
    pub fn is_empty(&self) -> bool {
        matches!(
            self,
            Query {
                limit: None,
                from: None,
                reverse: None,
                uids: None,
                batch_uids: None,
                statuses: None,
                types: None,
                index_uids: None,
                canceled_by: None,
                before_enqueued_at: None,
                after_enqueued_at: None,
                before_started_at: None,
                after_started_at: None,
                before_finished_at: None,
                after_finished_at: None,
            }
        )
    }

    /// Add an [index id](meilisearch_types::tasks::Task::index_uid) to the list of permitted indexes.
    pub fn with_index(self, index_uid: String) -> Self {
        let mut index_vec = self.index_uids.unwrap_or_default();
        index_vec.push(index_uid);
        Self { index_uids: Some(index_vec), ..self }
    }

    // Removes the `from` and `limit` restrictions from the query.
    // Useful to get the total number of tasks matching a filter.
    pub fn without_limits(self) -> Self {
        Query { limit: None, from: None, ..self }
    }
}

/// Structure which holds meilisearch's indexes and schedules the tasks
/// to be performed on them.
pub struct Queue {
    pub(crate) tasks: tasks::TaskQueue,
    pub(crate) batches: batches::BatchQueue,

    /// Matches a batch id with the associated task ids.
    pub(crate) batch_to_tasks_mapping: Database<BEU32, CboRoaringBitmapCodec>,

    /// The list of files referenced by the tasks.
    pub(crate) file_store: FileStore,

    /// The max number of tasks allowed before the scheduler starts to delete
    /// the finished tasks automatically.
    pub(crate) max_number_of_tasks: usize,
}

impl Queue {
    pub(crate) fn private_clone(&self) -> Queue {
        Queue {
            tasks: self.tasks.private_clone(),
            batches: self.batches.private_clone(),
            batch_to_tasks_mapping: self.batch_to_tasks_mapping,
            file_store: self.file_store.clone(),
            max_number_of_tasks: self.max_number_of_tasks,
        }
    }

    pub(crate) const fn nb_db() -> u32 {
        tasks::TaskQueue::nb_db() + batches::BatchQueue::nb_db() + NUMBER_OF_DATABASES
    }

    /// Create an index scheduler and start its run loop.
    pub(crate) fn new(
        env: &Env<WithoutTls>,
        wtxn: &mut RwTxn,
        options: &IndexSchedulerOptions,
    ) -> Result<Self> {
        // allow unreachable_code to get rids of the warning in the case of a test build.
        Ok(Self {
            file_store: FileStore::new(&options.update_file_path)?,
            batch_to_tasks_mapping: env
                .create_database(wtxn, Some(db_name::BATCH_TO_TASKS_MAPPING))?,
            tasks: TaskQueue::new(env, wtxn)?,
            batches: BatchQueue::new(env, wtxn)?,
            max_number_of_tasks: options.max_number_of_tasks,
        })
    }

    /// Returns the whole set of tasks that belongs to this batch.
    pub(crate) fn tasks_in_batch(&self, rtxn: &RoTxn, batch_id: BatchId) -> Result<RoaringBitmap> {
        Ok(self.batch_to_tasks_mapping.get(rtxn, &batch_id)?.unwrap_or_default())
    }

    /// Convert an iterator to a `Vec` of tasks and edit the `ProcessingBatch` to add the given tasks.
    ///
    /// The tasks MUST exist, or a `CorruptedTaskQueue` error will be thrown.
    pub(crate) fn get_existing_tasks_for_processing_batch(
        &self,
        rtxn: &RoTxn,
        processing_batch: &mut ProcessingBatch,
        tasks: impl IntoIterator<Item = TaskId>,
    ) -> Result<Vec<Task>> {
        tasks
            .into_iter()
            .map(|task_id| {
                let mut task = self.tasks.get_task(rtxn, task_id).and_then(|task| {
                    task.ok_or_else(|| Error::CorruptedTaskQueue {
                        file: file!(),
                        message: format!("Task content not found for uid `{}` when getting existing tasks for processing batch", task_id),
                    })
                });
                processing_batch.processing(&mut task);
                task
            })
            .collect::<Result<_>>()
    }

    pub(crate) fn write_batch(
        &self,
        wtxn: &mut RwTxn,
        batch: ProcessingBatch,
        tasks: &RoaringBitmap,
    ) -> Result<()> {
        self.batch_to_tasks_mapping.put(wtxn, &batch.uid, tasks)?;
        self.batches.write_batch(wtxn, batch)?;
        Ok(())
    }

    pub(crate) fn delete_persisted_task_data(&self, task: &Task) -> Result<()> {
        match task.content_uuid() {
            Some(content_file) => self.delete_update_file(content_file),
            None => Ok(()),
        }
    }

    /// Open and returns the task's content File.
    pub fn update_file(&self, uuid: Uuid) -> file_store::Result<StdFile> {
        self.file_store.get_update(uuid)
    }

    /// Delete a file from the index scheduler.
    ///
    /// Counterpart to the [`create_update_file`](IndexScheduler::create_update_file) method.
    pub fn delete_update_file(&self, uuid: Uuid) -> Result<()> {
        Ok(self.file_store.delete(uuid)?)
    }

    /// Create a file and register it in the index scheduler.
    ///
    /// The returned file and uuid can be used to associate
    /// some data to a task. The file will be kept until
    /// the task has been fully processed.
    pub fn create_update_file(&self) -> Result<(Uuid, file_store::File)> {
        Ok(self.file_store.new_update()?)
    }

    #[cfg(test)]
    pub fn create_update_file_with_uuid(&self, uuid: u128) -> Result<(Uuid, file_store::File)> {
        Ok(self.file_store.new_update_with_uuid(uuid)?)
    }

    /// The size on disk taken by all the updates files contained in the `IndexScheduler`, in bytes.
    pub fn compute_update_file_size(&self) -> Result<u64> {
        Ok(self.file_store.compute_total_size()?)
    }

    pub fn register(
        &self,
        wtxn: &m
```

### Core Architecture Module: `crates/index-scheduler/src/queue/tasks.rs`
```
use std::ops::{Bound, RangeBounds};

use meilisearch_types::heed::types::{DecodeIgnore, SerdeBincode, SerdeJson, Str};
use meilisearch_types::heed::{Database, Env, RoTxn, RwTxn, WithoutTls};
use meilisearch_types::milli::{CboRoaringBitmapCodec, RoaringBitmapCodec, BEU32};
use meilisearch_types::tasks::network::DbTaskNetwork;
use meilisearch_types::tasks::{Kind, KindWithContent, Status, Task};
use roaring::{MultiOps, RoaringBitmap};
use time::OffsetDateTime;

use super::{Query, Queue};
use crate::processing::ProcessingTasks;
use crate::utils::{
    self, insert_task_datetime, keep_ids_within_datetimes, map_bound, remove_task_datetime,
};
use crate::{Error, Result, TaskId, BEI128};

/// The number of database used by the task queue
const NUMBER_OF_DATABASES: u32 = 8;
/// Database const names for the `IndexScheduler`.
mod db_name {
    pub const ALL_TASKS: &str = "all-tasks";

    pub const STATUS: &str = "status";
    pub const KIND: &str = "kind";
    pub const INDEX_TASKS: &str = "index-tasks";
    pub const CANCELED_BY: &str = "canceled_by";
    pub const ENQUEUED_AT: &str = "enqueued-at";
    pub const STARTED_AT: &str = "started-at";
    pub const FINISHED_AT: &str = "finished-at";
}

pub struct TaskQueue {
    /// The main database, it contains all the tasks accessible by their Id.
    pub(crate) all_tasks: Database<BEU32, SerdeJson<Task>>,

    /// All the tasks ids grouped by their status.
    // TODO we should not be able to serialize a `Status::Processing` in this database.
    pub(crate) status: Database<SerdeBincode<Status>, RoaringBitmapCodec>,
    /// All the tasks ids grouped by their kind.
    pub(crate) kind: Database<SerdeBincode<Kind>, RoaringBitmapCodec>,
    /// Store the tasks associated to an index.
    pub(crate) index_tasks: Database<Str, RoaringBitmapCodec>,
    /// Store the tasks that were canceled by a task uid
    pub(crate) canceled_by: Database<BEU32, RoaringBitmapCodec>,
    /// Store the task ids of tasks which were enqueued at a specific date
    pub(crate) enqueued_at: Database<BEI128, CboRoaringBitmapCodec>,
    /// Store the task ids of finished tasks which started being processed at a specific date
    pub(crate) started_at: Database<BEI128, CboRoaringBitmapCodec>,
    /// Store the task ids of tasks which finished at a specific date
    pub(crate) finished_at: Database<BEI128, CboRoaringBitmapCodec>,
}

impl TaskQueue {
    pub(crate) fn private_clone(&self) -> TaskQueue {
        TaskQueue {
            all_tasks: self.all_tasks,
            status: self.status,
            kind: self.kind,
            index_tasks: self.index_tasks,
            canceled_by: self.canceled_by,
            enqueued_at: self.enqueued_at,
            started_at: self.started_at,
            finished_at: self.finished_at,
        }
    }

    pub(crate) const fn nb_db() -> u32 {
        NUMBER_OF_DATABASES
    }

    pub(crate) fn new(env: &Env<WithoutTls>, wtxn: &mut RwTxn) -> Result<Self> {
        Ok(Self {
            all_tasks: env.create_database(wtxn, Some(db_name::ALL_TASKS))?,
            status: env.create_database(wtxn, Some(db_name::STATUS))?,
            kind: env.create_database(wtxn, Some(db_name::KIND))?,
            index_tasks: env.create_database(wtxn, Some(db_name::INDEX_TASKS))?,
            canceled_by: env.create_database(wtxn, Some(db_name::CANCELED_BY))?,
            enqueued_at: env.create_database(wtxn, Some(db_name::ENQUEUED_AT))?,
            started_at: env.create_database(wtxn, Some(db_name::STARTED_AT))?,
            finished_at: env.create_database(wtxn, Some(db_name::FINISHED_AT))?,
        })
    }

    pub(crate) fn last_task_id(&self, rtxn: &RoTxn) -> Result<Option<TaskId>> {
        Ok(self.all_tasks.remap_data_type::<DecodeIgnore>().last(rtxn)?.map(|(k, _)| k + 1))
    }

    pub(crate) fn next_task_id(&self, rtxn: &RoTxn) -> Result<TaskId> {
        Ok(self.last_task_id(rtxn)?.unwrap_or_default())
    }

    pub(crate) fn all_task_ids(&self, rtxn: &RoTxn) -> Result<RoaringBitmap> {
        enum_iterator::all().map(|s| self.get_status(rtxn, s)).union()
    }

    pub(crate) fn get_task(&self, rtxn: &RoTxn, task_id: TaskId) -> Result<Option<Task>> {
        Ok(self.all_tasks.get(rtxn, &task_id)?)
    }

    /// Update the inverted task indexes and write the new value of the task.
    ///
    /// The passed `task` object typically comes from a previous transaction, so two kinds of modification might have occurred:
    /// 1. Modification to the `task` object after loading it from the DB (the purpose of this method is to persist these changes)
    /// 2. Modification to the task committed by another transaction in the DB (an annoying consequence of having lost the original
    ///    transaction from which the `task` instance was deserialized)
    ///
    /// When calling this function, this `task` is modified to take into account any existing `network`
    /// that can have been added since the task was loaded into memory.
    ///
    /// Any other modification to the task that was committed from the DB since the parameter was pulled from the DB will be overwritten.
    ///
    /// # Errors
    ///
    /// - CorruptedTaskQueue: The task doesn't exist in the database
    pub(crate) fn update_task(&self, wtxn: &mut RwTxn, task: &mut Task) -> Result<()> {
        let old_task = self.get_task(wtxn, task.uid)?.ok_or_else(|| Error::CorruptedTaskQueue {
            file: file!(),
            message: format!("Task content not found for uid `{}` when updating task", task.uid),
        })?;
        // network topology tasks may be processed multiple times.
        let maybe_reprocessing = old_task.status != Status::Enqueued
            || task.kind.as_kind() == Kind::NetworkTopologyChange;

        debug_assert_eq!(old_task.uid, task.uid);

        // If we're processing a task that failed it may already contains a batch_uid
        debug_assert!(
            maybe_reprocessing || (old_task.batch_uid.is_none() && task.batch_uid.is_some()),
            "\n==> old: {old_task:?}\n==> new: {task:?}"
        );

        if old_task.status != task.status {
            self.update_status(wtxn, old_task.status, |bitmap| {
                bitmap.remove(task.uid);
            })?;
            self.update_status(wtxn, task.status, |bitmap| {
                bitmap.insert(task.uid);
            })?;
        }

        if old_task.kind.as_kind() != task.kind.as_kind() {
            self.update_kind(wtxn, old_task.kind.as_kind(), |bitmap| {
                bitmap.remove(task.uid);
            })?;
            self.update_kind(wtxn, task.kind.as_kind(), |bitmap| {
                bitmap.insert(task.uid);
            })?;
        }

        // Avoids rewriting part of the network topology change because of TOCTOU errors
        if let (
            KindWithContent::NetworkTopologyChange(old_state),
            KindWithContent::NetworkTopologyChange(new_state),
        ) = (old_task.kind, &mut task.kind)
        {
            new_state.merge(old_state);
            // the state possibly just changed, rewrite the details
            task.details = Some(new_state.to_details());
        }

        assert_eq!(
            old_task.enqueued_at, task.enqueued_at,
            "Cannot update a task's enqueued_at time"
        );
        if old_task.started_at != task.started_at {
            assert!(
                maybe_reprocessing || old_task.started_at.is_none(),
                "Cannot update a task's started_at time"
            );
            if let Some(started_at) = old_task.started_at {
                remove_task_datetime(wtxn, self.started_at, started_at, task.uid)?;
            }
            if let Some(started_at) = task.started_at {
                insert_task_datetime(wtxn, self.started_at, started_at, task.uid)?;
            }
        }
        if old_task.finished_at != task.finished_at {
            assert!(
                maybe_reprocessing || old_task.finished_at.is_none(),
                "Cannot update a task's finished_at time"
            );
            if let Some(finished_at) = old_task.finished_at {
                remove_task_datetime(wtxn, self.finished_at, finished_at, task.uid)?;
            }
            if let Some(finished_at) = task.finished_at {
                insert_task_datetime(wtxn, self.finished_at, finished_at, task.uid)?;
            }
        }

        task.network = match (old_task.network, task.network.take()) {
            (None, None) => None,
            (None, Some(network)) | (Some(network), None) => Some(network),
            (Some(left), Some(right)) => Some(match (left, right) {
                (
                    DbTaskNetwork::Remotes { remote_tasks: mut left, network_version: _ },
                    DbTaskNetwork::Remotes { remote_tasks: mut right, network_version },
                ) => {
                    left.append(&mut right);
                    DbTaskNetwork::Remotes { remote_tasks: left, network_version }
                }
                (_, right) => right,
            }),
        };

        self.all_tasks.put(wtxn, &task.uid, task)?;
        Ok(())
    }

    /// Returns the whole set of tasks that belongs to this index.
    pub(crate) fn index_tasks(&self, rtxn: &RoTxn, index: &str) -> Result<RoaringBitmap> {
        Ok(self.index_tasks.get(rtxn, index)?.unwrap_or_default())
    }

    pub(crate) fn update_index(
        &self,
        wtxn: &mut RwTxn,
        index: &str,
        f: impl Fn(&mut RoaringBitmap),
    ) -> Result<()> {
        let mut tasks = self.index_tasks(wtxn, index)?;
        f(&mut tasks);
        if tasks.is_empty() {
            self.index_tasks.delete(wtxn, index)?;
        } else {
            self.index_tasks.put(wtxn, index, &tasks)?;
        }

        Ok(())
    }

    pub(crate) fn get_status(&self, rtxn: &RoTxn, status: Status) -> Result<RoaringBitmap> {
        Ok(self.status.get(rtxn, &status)?.unwrap_or_default())
    }

    pub(crate) fn put_status(
        &self,
        wtx
```

### Core Architecture Module: `crates/index-scheduler/src/utils.rs`
```
//! Utility functions on the DBs. Mainly getter and setters.

use std::collections::{BTreeSet, HashSet};
use std::ops::{Bound, RangeInclusive};
use std::sync::Arc;

use convert_case::{Case, Casing as _};
use meilisearch_types::batches::{Batch, BatchEnqueuedAt, BatchId, BatchStats};
use meilisearch_types::heed::{Database, RoTxn, RwTxn};
use meilisearch_types::milli::progress::Progress;
use meilisearch_types::milli::{CboRoaringBitmapCodec, ChannelCongestion};
use meilisearch_types::task_view::DetailsView;
use meilisearch_types::tasks::{
    BatchStopReason, Details, IndexSwap, Kind, KindWithContent, Status,
};
use roaring::RoaringBitmap;
use time::OffsetDateTime;

use crate::milli::progress::EmbedderStats;
use crate::{Error, Result, Task, TaskId, BEI128};

/// This structure contains all the information required to write a batch in the database without reading the tasks.
/// It'll stay in RAM so it must be small.
/// The usage is the following:
/// 1. Create the structure with its batch id.
/// 2. Call `processing` on all the task that we know are currently processing in the batch (it can change in the future)
/// 3. Call `finished` once the batch has been processed.
/// 4. Call `update` on all the tasks.
#[derive(Debug, Clone)]
pub struct ProcessingBatch {
    pub uid: BatchId,
    pub details: DetailsView,
    pub stats: BatchStats,
    pub embedder_stats: Arc<EmbedderStats>,

    pub statuses: HashSet<Status>,
    pub kinds: HashSet<Kind>,
    pub indexes: HashSet<String>,
    pub canceled_by: HashSet<TaskId>,
    pub enqueued_at: Option<BatchEnqueuedAt>,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
    pub reason: BatchStopReason,
}

impl ProcessingBatch {
    pub fn new(uid: BatchId) -> Self {
        // At the beginning, all the tasks are processing
        let mut statuses = HashSet::default();
        statuses.insert(Status::Processing);

        Self {
            uid,
            details: DetailsView::default(),
            stats: BatchStats::default(),
            embedder_stats: Default::default(),

            statuses,
            kinds: HashSet::default(),
            indexes: HashSet::default(),
            canceled_by: HashSet::default(),
            enqueued_at: None,
            started_at: OffsetDateTime::now_utc(),
            finished_at: None,
            reason: Default::default(),
        }
    }

    /// Update itself with the content of the task and update the batch id in the task.
    pub fn processing<'a>(&mut self, tasks: impl IntoIterator<Item = &'a mut Task>) {
        for task in tasks.into_iter() {
            self.stats.total_nb_tasks += 1;

            task.batch_uid = Some(self.uid);
            // We don't store the statuses in the map since they're all enqueued but we must
            // still store them in the stats since that can be displayed.
            *self.stats.status.entry(Status::Processing).or_default() += 1;

            self.kinds.insert(task.kind.as_kind());
            *self.stats.types.entry(task.kind.as_kind()).or_default() += 1;
            self.indexes.extend(task.indexes().iter().map(|s| s.to_string()));
            if let Some(index_uid) = task.index_uid() {
                *self.stats.index_uids.entry(index_uid.to_string()).or_default() += 1;
            }
            if let Some(ref details) = task.details {
                self.details.accumulate(&DetailsView::from(details.clone()));
            }
            if let Some(canceled_by) = task.canceled_by {
                self.canceled_by.insert(canceled_by);
            }
            match self.enqueued_at.as_mut() {
                Some(BatchEnqueuedAt { earliest, oldest }) => {
                    *oldest = task.enqueued_at.min(*oldest);
                    *earliest = task.enqueued_at.max(*earliest);
                }
                None => {
                    self.enqueued_at = Some(BatchEnqueuedAt {
                        earliest: task.enqueued_at,
                        oldest: task.enqueued_at,
                    });
                }
            }
        }
    }

    pub fn reason(&mut self, reason: BatchStopReason) {
        self.reason = reason;
    }

    /// Must be called once the batch has finished processing.
    pub fn finished(&mut self) {
        self.details = DetailsView::default();
        self.stats = BatchStats::default();
        self.finished_at = Some(OffsetDateTime::now_utc());

        // Initially we inserted ourselves as a processing batch, that's not the case anymore.
        self.statuses.clear();

        // We're going to recount the number of tasks AFTER processing the batch because
        // tasks may add themselves to a batch while its processing.
        self.stats.total_nb_tasks = 0;
    }

    /// Update batch task from a processed task
    pub fn update_from_task(&mut self, task: &Task) {
        self.statuses.insert(task.status);

        // Craft an aggregation of the details of all the tasks encountered in this batch.
        if let Some(ref details) = task.details {
            self.details.accumulate(&DetailsView::from(details.clone()));
        }
        self.stats.total_nb_tasks += 1;
        *self.stats.status.entry(task.status).or_default() += 1;
        *self.stats.types.entry(task.kind.as_kind()).or_default() += 1;
        if let Some(index_uid) = task.index_uid() {
            *self.stats.index_uids.entry(index_uid.to_string()).or_default() += 1;
        }
    }

    /// Update the timestamp of the tasks after they're done
    pub fn finish_task(&self, task: &mut Task) {
        // We must re-set this value in case we're dealing with a task that has been added between
        // the `processing` and `finished` state or that failed.
        task.batch_uid = Some(self.uid);
        // Same
        task.started_at = Some(self.started_at);
        task.finished_at = self.finished_at;
    }

    pub fn write_stats(
        &mut self,
        progress: &Progress,
        congestion: Option<ChannelCongestion>,
        pre_commit_dabases_sizes: indexmap::IndexMap<&'static str, usize>,
        post_commit_dabases_sizes: indexmap::IndexMap<&'static str, usize>,
    ) {
        self.stats.progress_trace =
            progress.accumulated_durations().into_iter().map(|(k, v)| (k, v.into())).collect();
        self.stats.write_channel_congestion = congestion.map(|congestion| {
            let mut congestion_info = serde_json::Map::new();
            congestion_info.insert("attempts".into(), congestion.attempts.into());
            congestion_info.insert("blocking_attempts".into(), congestion.blocking_attempts.into());
            congestion_info.insert("blocking_ratio".into(), congestion.congestion_ratio().into());
            congestion_info
        });
        self.stats.internal_database_sizes = pre_commit_dabases_sizes
            .iter()
            .flat_map(|(dbname, pre_size)| {
                post_commit_dabases_sizes
                    .get(dbname)
                    .map(|post_size| {
                        use std::cmp::Ordering::{Equal, Greater, Less};

                        use byte_unit::Byte;
                        use byte_unit::UnitType::Binary;

                        let post = Byte::from_u64(*post_size as u64).get_appropriate_unit(Binary);
                        let diff_size = post_size.abs_diff(*pre_size) as u64;
                        let diff = Byte::from_u64(diff_size).get_appropriate_unit(Binary);
                        let sign = match post_size.cmp(pre_size) {
                            Equal => return None,
                            Greater => "+",
                            Less => "-",
                        };

                        Some((
                            dbname.to_case(Case::Camel),
                            format!("{post:#.2} ({sign}{diff:#.2})").into(),
                        ))
                    })
                    .into_iter()
                    .flatten()
            })
            .collect();
    }

    pub fn to_batch(&self) -> Batch {
        Batch {
            uid: self.uid,
            progress: None,
            details: self.details.clone(),
            stats: self.stats.clone(),
            embedder_stats: self.embedder_stats.as_ref().into(),
            started_at: self.started_at,
            finished_at: self.finished_at,
            enqueued_at: self.enqueued_at,
            stop_reason: self.reason.to_string(),
        }
    }
}

/// Given a **sorted** iterator of `u32`, return an iterator of the ranges of consecutive values it contains.
pub fn consecutive_ranges<'a>(
    it: impl IntoIterator<Item = u32> + 'a,
) -> impl Iterator<Item = RangeInclusive<u32>> + 'a {
    let mut it = it.into_iter();
    let mut current_range = it.next().map(|s| (s, s));
    std::iter::from_fn(move || {
        for current in it.by_ref() {
            match current_range {
                Some((start, end)) => {
                    if current == end + 1 {
                        current_range = Some((start, end + 1));
                    } else {
                        current_range = Some((current, current));
                        return Some(start..=end);
                    }
                }
                None => return None,
            }
        }
        current_range.take().map(|(s, e)| s..=e)
    })
}

pub(crate) fn insert_task_datetime(
    wtxn: &mut RwTxn,
    database: Database<BEI128, CboRoaringBitmapCodec>,
    time: OffsetDateTime,
    task_id: TaskId,
) -> Result<()> {
    let timestamp = time.unix_timestamp_nanos();
    let mut task_ids = database.get(wtxn, &timestamp)?.unwrap_or_default();
    task_ids.insert(task_id);
    database.put(wtxn, &timestamp, &task_ids)?;
    Ok(())
}

pub(crate) fn remove_task_datetime(
    wtxn: &mut RwTxn,
    database: Database<BEI128, CboRoaringBitmapCodec>,
    time: OffsetDateTime,
    task_id: TaskId,
) -> Result<()> {
    let timestamp = time.unix_timestamp_nanos();
    if let Some(mut 
```

### Core Architecture Module: `crates/meilisearch-types/src/webhooks.rs`
```
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Webhook {
    pub url: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
}

impl Webhook {
    pub fn redact_authorization_header(&mut self) {
        // headers are case insensitive, so to make the redaction robust we iterate over qualifying headers
        // rather than getting one canonical `Authorization` header.
        for value in self
            .headers
            .iter_mut()
            .filter_map(|(name, value)| name.eq_ignore_ascii_case("authorization").then_some(value))
        {
            if value.starts_with("Bearer ") {
                crate::settings::hide_secret(value, "Bearer ".len());
            } else {
                crate::settings::hide_secret(value, 0);
            }
        }
    }
}

#[derive(Debug, Serialize, Default, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebhooksView {
    #[serde(default)]
    pub webhooks: BTreeMap<Uuid, Webhook>,
}

// Same as the WebhooksView instead it should never contains the CLI webhooks.
// It's the right structure to use in the dump
#[derive(Debug, Deserialize, Serialize, Default, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebhooksDumpView {
    #[serde(default)]
    pub webhooks: BTreeMap<Uuid, Webhook>,
}

```

### Core Architecture Module: `crates/meilisearch/src/routes/chats/utils.rs`
```
use std::cell::RefCell;
use std::sync::RwLock;

use actix_web_lab::sse::{self, Event};
use async_openai::types::{
    ChatChoiceStream, ChatCompletionMessageToolCall, ChatCompletionMessageToolCallChunk,
    ChatCompletionRequestAssistantMessage, ChatCompletionRequestMessage,
    ChatCompletionStreamResponseDelta, ChatCompletionToolType, CreateChatCompletionStreamResponse,
    FunctionCall, FunctionCallStream, Role,
};
use bumpalo::Bump;
use meilisearch_types::error::{Code, ResponseError};
use meilisearch_types::heed::RoTxn;
use meilisearch_types::milli::index::ChatConfig;
use meilisearch_types::milli::prompt::{Prompt, PromptData};
use meilisearch_types::milli::update::new::document::DocumentFromDb;
use meilisearch_types::milli::{
    DocumentId, FieldIdMapWithMetadata, FieldsIdsMap, GlobalFieldsIdsMap, MetadataBuilder,
};
use meilisearch_types::{Document, Index};
use serde::Serialize;
use tokio::sync::mpsc::error::SendError;
use tokio::sync::mpsc::Sender;

use super::errors::StreamErrorEvent;
use super::MEILI_APPEND_CONVERSATION_MESSAGE_NAME;
use crate::routes::chats::{MEILI_SEARCH_PROGRESS_NAME, MEILI_SEARCH_SOURCES_NAME};

pub struct SseEventSender(Sender<Event>);

impl SseEventSender {
    pub fn new(sender: Sender<Event>) -> Self {
        Self(sender)
    }

    /// Ask the front-end user to append this tool *call* to the conversation
    pub async fn append_tool_call_conversation_message(
        &self,
        resp: CreateChatCompletionStreamResponse,
        call_id: String,
        function_name: String,
        function_arguments: String,
    ) -> Result<(), SendError<Event>> {
        #[allow(deprecated)] // function_call
        let message =
            ChatCompletionRequestMessage::Assistant(ChatCompletionRequestAssistantMessage {
                content: None,
                refusal: None,
                name: None,
                audio: None,
                tool_calls: Some(vec![ChatCompletionMessageToolCall {
                    id: call_id,
                    r#type: Some(ChatCompletionToolType::Function),
                    function: FunctionCall { name: function_name, arguments: function_arguments },
                }]),
                function_call: None,
            });

        self.append_conversation_message(resp, &message).await
    }

    /// Ask the front-end user to append this tool to the conversation
    pub async fn append_conversation_message(
        &self,
        mut resp: CreateChatCompletionStreamResponse,
        message: &ChatCompletionRequestMessage,
    ) -> Result<(), SendError<Event>> {
        let call_text = serde_json::to_string(message).unwrap();
        let tool_call = ChatCompletionMessageToolCallChunk {
            index: 0,
            id: Some(uuid::Uuid::new_v4().to_string()),
            r#type: Some(ChatCompletionToolType::Function),
            function: Some(FunctionCallStream {
                name: Some(MEILI_APPEND_CONVERSATION_MESSAGE_NAME.to_string()),
                arguments: Some(call_text),
            }),
        };

        resp.choices[0] = ChatChoiceStream {
            index: 0,
            #[allow(deprecated)] // function_call
            delta: ChatCompletionStreamResponseDelta {
                content: None,
                function_call: None,
                tool_calls: Some(vec![tool_call]),
                role: Some(Role::Assistant),
                refusal: None,
            },
            finish_reason: None,
            logprobs: None,
        };

        self.send_json(&resp).await
    }

    pub async fn report_search_progress(
        &self,
        mut resp: CreateChatCompletionStreamResponse,
        call_id: &str,
        function_name: &str,
        function_arguments: &str,
    ) -> Result<(), SendError<Event>> {
        #[derive(Debug, Clone, Serialize)]
        /// Provides information about the current Meilisearch search operation.
        struct MeiliSearchProgress<'a> {
            /// The call ID to track the sources of the search.
            call_id: &'a str,
            /// The name of the function we are executing.
            function_name: &'a str,
            /// The arguments of the function we are executing, encoded in JSON.
            function_arguments: &'a str,
        }

        let progress = MeiliSearchProgress { call_id, function_name, function_arguments };
        let call_text = serde_json::to_string(&progress).unwrap();
        let tool_call = ChatCompletionMessageToolCallChunk {
            index: 0,
            id: Some(uuid::Uuid::new_v4().to_string()),
            r#type: Some(ChatCompletionToolType::Function),
            function: Some(FunctionCallStream {
                name: Some(MEILI_SEARCH_PROGRESS_NAME.to_string()),
                arguments: Some(call_text),
            }),
        };

        resp.choices[0] = ChatChoiceStream {
            index: 0,
            #[allow(deprecated)] // function_call
            delta: ChatCompletionStreamResponseDelta {
                content: None,
                function_call: None,
                tool_calls: Some(vec![tool_call]),
                role: Some(Role::Assistant),
                refusal: None,
            },
            finish_reason: None,
            logprobs: None,
        };

        self.send_json(&resp).await
    }

    pub async fn report_sources(
        &self,
        mut resp: CreateChatCompletionStreamResponse,
        call_id: &str,
        documents: &[Document],
    ) -> Result<(), SendError<Event>> {
        #[derive(Debug, Clone, Serialize)]
        /// Provides sources of the search.
        struct MeiliSearchSources<'a> {
            /// The call ID to track the original search associated to those sources.
            call_id: &'a str,
            /// The documents associated with the search (call_id).
            /// Only the displayed attributes of the documents are returned.
            sources: &'a [Document],
        }

        let sources = MeiliSearchSources { call_id, sources: documents };
        let call_text = serde_json::to_string(&sources).unwrap();
        let tool_call = ChatCompletionMessageToolCallChunk {
            index: 0,
            id: Some(uuid::Uuid::new_v4().to_string()),
            r#type: Some(ChatCompletionToolType::Function),
            function: Some(FunctionCallStream {
                name: Some(MEILI_SEARCH_SOURCES_NAME.to_string()),
                arguments: Some(call_text),
            }),
        };

        resp.choices[0] = ChatChoiceStream {
            index: 0,
            #[allow(deprecated)] // function_call
            delta: ChatCompletionStreamResponseDelta {
                content: None,
                function_call: None,
                tool_calls: Some(vec![tool_call]),
                role: Some(Role::Assistant),
                refusal: None,
            },
            finish_reason: None,
            logprobs: None,
        };

        self.send_json(&resp).await
    }

    pub async fn forward_response(
        &self,
        resp: &CreateChatCompletionStreamResponse,
    ) -> Result<(), SendError<Event>> {
        self.send_json(resp).await
    }

    pub async fn send_error(&self, error: &StreamErrorEvent) -> Result<(), SendError<Event>> {
        self.send_json(error).await
    }

    pub async fn stop(self) -> Result<(), SendError<Event>> {
        // It is the way OpenAI sends a correct end of stream
        // <https://platform.openai.com/docs/api-reference/assistants-streaming/events>
        const DONE_DATA: &str = "[DONE]";
        self.0.send(Event::Data(sse::Data::new(DONE_DATA))).await
    }

    async fn send_json<S: Serialize>(&self, data: &S) -> Result<(), SendError<Event>> {
        self.0.send(Event::Data(sse::Data::new_json(data).unwrap())).await
    }
}

/// Format documents based on the provided template and maximum bytes.
///
/// This formatting function is usually used to generate a summary of the documents for LLMs.
pub fn format_documents<'doc>(
    rtxn: &RoTxn<'_>,
    index: &Index,
    fields_ids_map: &FieldsIdsMap,
    doc_alloc: &'doc Bump,
    internal_docids: Vec<DocumentId>,
) -> Result<Vec<&'doc str>, ResponseError> {
    let ChatConfig { prompt: PromptData { template, max_bytes }, .. } = index.chat_config(rtxn)?;

    let prompt = Prompt::new(template, max_bytes).map_err(|e| {
        ResponseError::from_msg(e.to_string(), Code::InvalidChatSettingDocumentTemplate)
    })?;

    let metadata_builder = MetadataBuilder::from_index(index, rtxn)?;
    let fid_map_with_meta = FieldIdMapWithMetadata::new(fields_ids_map.clone(), metadata_builder);
    let global = RwLock::new(fid_map_with_meta);
    let gfid_map = RefCell::new(GlobalFieldsIdsMap::new(&global));

    let external_ids: Vec<String> = index
        .external_id_of(rtxn, fields_ids_map, internal_docids.iter().copied())?
        .into_iter()
        .collect::<Result<_, _>>()?;

    let mut renders = Vec::new();
    for (docid, external_docid) in internal_docids.into_iter().zip(external_ids) {
        let document = match DocumentFromDb::new(docid, rtxn, index, fields_ids_map)? {
            Some(doc) => doc,
            None => unreachable!("Document with internal ID {docid} not found"),
        };
        let text =
            match prompt.render_document(Some(&external_docid), document, &gfid_map, doc_alloc) {
                Ok(text) => text,
                Err(err) => {
                    return Err(ResponseError::from_msg(
                        err.to_string(),
                        Code::InvalidChatSettingDocumentTemplate,
                    ))
                }
            };
        renders.push(text);
    }

    Ok(renders)
}

```

### Core Architecture Module: `crates/meilisearch/src/routes/open_api_utils.rs`
```
use serde::Serialize;
use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};

#[derive(Debug, Serialize)]
pub struct OpenApiAuth;

impl utoipa::Modify for OpenApiAuth {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(schema) = openapi.components.as_mut() {
            schema.add_security_scheme(
                "Bearer",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("Uuidv4, string or JWT")
                        .description(Some(
"An API key is a token that you provide when making API calls. Read more about [how to secure your project](https://www.meilisearch.com/docs/learn/security/basic_security).\n\nInclude the API key to the `Authorization` header, for instance:\n```bash\n-H \'Authorization: Bearer 6436fc5237b0d6e0d64253fbaac21d135012ecf1\'\n```\n\nIf you use a SDK, ensure you instantiate the client with the API key, for instance with [JS SDK](https://github.com/meilisearch/meilisearch-js):\n```js\nconst client = new MeiliSearch({\n  host: 'MEILISEARCH_URL',\n  apiKey: '6436fc5237b0d6e0d64253fbaac21d135012ecf1'\n});\n```"))
                        .build(),
                ),
            );
        }
    }
}

```

### Core Architecture Module: `crates/meilisearch/src/routes/render.rs`
```
use std::cell::RefCell;
use std::num::NonZeroUsize;
use std::sync::RwLock;

use actix_web::web::{self, Data};
use actix_web::{HttpRequest, HttpResponse};
use bumpalo::Bump;
use bumparaw_collections::RawMap;
use deserr::actix_web::AwebJson;
use index_scheduler::{IndexScheduler, RoFeatures};
use meilisearch_auth::AuthFilter;
use meilisearch_types::deserr::DeserrJsonError;
use meilisearch_types::error::deserr_codes::{InvalidRenderInput, InvalidRenderTemplate};
use meilisearch_types::error::{Code, ErrorCode, ResponseError};
use meilisearch_types::heed::RoTxn;
use meilisearch_types::index_uid::IndexUid;
use meilisearch_types::keys::actions;
use meilisearch_types::milli::prompt::{Prompt, PromptData};
use meilisearch_types::milli::update::new::document::DocumentFromDb;
use meilisearch_types::milli::vector::json_template::{self, JsonTemplate};
use meilisearch_types::milli::{FieldIdMapWithMetadata, FieldsIdsMap, GlobalFieldsIdsMap};
use meilisearch_types::{heed, milli, Index};
use serde::Serialize;
use serde_json::value::RawValue;
use serde_json::Value;
use tracing::debug;
use utoipa::ToSchema;

use crate::analytics::Analytics;
use crate::extractors::authentication::policies::DoubleActionPolicy;
use crate::extractors::authentication::GuardedData;
use crate::extractors::sequential_extractor::SeqHandler;
use crate::routes::render_analytics::RenderAggregator;

#[routes::routes(
    routes("" => post(render_post)),
    tag = "Render templates",
    tags((
        name = "Render templates",
        description = "The /render-template route allows rendering templates used by Meilisearch.",
        external_docs(
            url = "https://www.meilisearch.com/docs/reference/api/render-template",
            description = "Render template API reference"
        ),
    )),
)]
pub struct RenderApi;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("").route(web::post().to(SeqHandler(render_post))));
}

/// Render template
///
/// Render a template, either fetched from the settings of an index (embedder document template,
/// chat document template, indexing or search fragment) or provided inline, by injecting the
/// given input (a document from an index, an inline document, or a search query).
///
/// Returns the template and the rendered result, allowing to preview how Meilisearch renders
/// templates without indexing any document.
///
/// This route is only available when the `renderRoute` [experimental feature](https://www.meilisearch.com/docs/resources/help/experimental_features_overview) is enabled.
#[routes::path(
    security(("Bearer" = ["settings.get,documents.get", "*.get", "*"])),
    request_body = RenderQuery,
    responses(
        (status = 200, description = "The rendered result is returned along with the template", body = RenderResult, content_type = "application/json", example = json!(
            {
                "template": "{{ doc.breed }} called {{ doc.name }}",
                "rendered": "A Jack Russell called Iko"
            }
        )),
        (status = 404, description = "Template or document not found", body = ResponseError, content_type = "application/json", example = json!(
            {
                "message": "Document with ID `9999` not found in index `movies`.",
                "code": "render_document_not_found",
                "type": "invalid_request",
                "link": "https://docs.meilisearch.com/errors#render_document_not_found"
            }
        )),
        (status = 400, description = "Parameters are incorrect", body = ResponseError, content_type = "application/json", example = json!(
            {
                "message": "cannot find embedder `default` in index `movies`",
                "code": "invalid_render_template",
                "type": "invalid_request",
                "link": "https://docs.meilisearch.com/errors#invalid_render_template_id"
            }
        )),
        (status = 401, description = "The authorization header is missing.", body = ResponseError, content_type = "application/json", example = json!(
            {
                "message": "The Authorization header is missing. It must use the bearer authorization method.",
                "code": "missing_authorization_header",
                "type": "auth",
                "link": "https://docs.meilisearch.com/errors#missing_authorization_header"
            }
        ))
    )
)]
pub async fn render_post(
    index_scheduler: GuardedData<
        DoubleActionPolicy<{ actions::SETTINGS_GET }, { actions::DOCUMENTS_GET }>,
        Data<IndexScheduler>,
    >,
    params: AwebJson<RenderQuery, DeserrJsonError>,
    req: HttpRequest,
    analytics: web::Data<Analytics>,
) -> Result<HttpResponse, ResponseError> {
    let query = params.into_inner();
    debug!(parameters = ?query, "Render document");
    let mut aggregate = RenderAggregator::from_query(&query);
    let features = index_scheduler.features();
    let (index_scheduler, auth_filter) = index_scheduler.into_inner();
    features.check_render_route("calling the /render-template route")?;

    let RenderQuery { template, input } = query;

    let result: Result<(RenderingTemplate, Option<Value>), Error> =
        tokio::task::spawn_blocking(move || {
            let template_index_uid = template.index_uid.as_deref();
            let input_index_uid = input.as_ref().and_then(|input| input.index_uid.as_deref());

            let doc_alloc = Bump::new();

            let (template, template_index_rtxn) =
                fetch_template(&index_scheduler, &auth_filter, features, &template)?;

            let rendered = if let Some(input) = &input {
                let input_index;
                let input_index_rtxn_fidmap = match (input_index_uid, template_index_uid) {
                    (None, _) => {
                        // close index that will not longer be in used
                        drop(template_index_rtxn);
                        None
                    }
                    (Some(input_index_uid), Some(template_index_uid))
                        if input_index_uid == template_index_uid =>
                    {
                        // unwrap: template_index_uid => template_index_rtxn
                        let (index, rtxn) = template_index_rtxn.unwrap();
                        input_index = index;
                        let fidmap = input_index.fields_ids_map_with_metadata(&rtxn)?;
                        Some((&input_index, rtxn, fidmap))
                    }
                    (Some(index_uid), _) => {
                        // avoid simultaneously opening several indexes
                        drop(template_index_rtxn);
                        input_index = index_scheduler.user_index(index_uid, &auth_filter).map_err(
                            |error| Error::CannotOpenIndex { error, index: index_uid.to_string() },
                        )?;
                        let input_index_rtxn =
                            input_index.read_txn().map_err(milli::Error::from)?;
                        let fidmap = input_index.fields_ids_map_with_metadata(&input_index_rtxn)?;
                        Some((&input_index, input_index_rtxn, fidmap))
                    }
                };

                let input = fetch_input(
                    input,
                    features,
                    input_index_rtxn_fidmap
                        .as_ref()
                        .map(|(index, rtxn, fidmap)| (*index, rtxn, fidmap.as_fields_ids_map())),
                    &doc_alloc,
                )?;

                let fields_ids_map = input_index_rtxn_fidmap.as_ref().map(|(_, _, fidmap)| fidmap);

                Some(render_template(&template, &input, fields_ids_map, &doc_alloc)?)
            } else {
                None
            };

            Ok((template, rendered))
        })
        .await?;

    if result.is_ok() {
        aggregate.succeed();
    }
    analytics.publish(aggregate, &req);

    let (template, rendered) = result?;

    let template = template.into_value();

    let result = RenderResult { template, rendered };

    debug!(returns = ?result, "Render document");
    Ok(HttpResponse::Ok().json(result))
}

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("error while fetching template: {0}")]
    Template(#[from] FetchTemplateError),
    #[error("error while fetching input: {0}")]
    Input(#[from] FetchInputError),
    #[error("error while rendering template: {0}")]
    Render(#[from] RenderError),
    #[error("internal error: {0}")]
    Milli(#[from] milli::Error),
    #[error("Cannot open index `{index}`: {error}")]
    CannotOpenIndex { error: index_scheduler::Error, index: String },
}

impl ErrorCode for Error {
    fn error_code(&self) -> Code {
        match self {
            Error::Template(error) => error.error_code(),
            Error::Input(error) => error.error_code(),
            Error::Render(error) => error.error_code(),
            Error::Milli(error) => error.error_code(),
            Error::CannotOpenIndex { error, index: _ } => error.error_code(),
        }
    }
}

fn render_template(
    template: &RenderingTemplate,
    input: &RenderableInput,
    field_id_map: Option<&FieldIdMapWithMetadata>,
    doc_alloc: &Bump,
) -> Result<Value, RenderError> {
    let field_id_map = field_id_map.cloned().unwrap_or_else(FieldIdMapWithMetadata::empty);
    let field_id_map = RwLock::new(field_id_map);
    let field_id_map = RefCell::new(GlobalFieldsIdsMap::new(&field_id_map));

    template.render(input, &field_id_map, doc_alloc)
}

#[derive(Debug, thiserror::Error)]
enum FetchInputError {
    #[error("parameter `{disallowed_param}` disallowed for kind `{kind}`")]
    DisallowedParameterForKind { kind: RenderQueryInputKind, disallowed_param: &'static str },
    #[error("parameter `{missing_param}` missing for kind `{kind}`")]
    MissingParameterForKind { kind: RenderQueryInputKind, missing_param: &'static str },
    #[error("inter
```

### Core Architecture Module: `crates/meilisearch/src/routes/render_analytics.rs`
```
use serde_json::json;

use crate::analytics::Aggregate;
use crate::routes::render::RenderQuery;

#[derive(Default)]
pub struct RenderAggregator {
    // requests
    total_received: usize,
    total_succeeded: usize,

    // parameters
    template_inline: bool,
    template_id: bool,
    input_inline: bool,
    input_id: bool,
    input_omitted: bool,
}

impl RenderAggregator {
    #[allow(clippy::field_reassign_with_default)]
    pub fn from_query(query: &RenderQuery) -> Self {
        let RenderQuery { template, input } = query;

        let mut ret = Self::default();

        ret.total_received = 1;

        ret.template_inline = template.inline.is_some();
        ret.template_id = template.index_uid.is_some();
        ret.input_inline = input.as_ref().is_some_and(|i| i.inline.is_some());
        ret.input_id = input.as_ref().is_some_and(|i| i.id.is_some());
        ret.input_omitted = input.as_ref().is_none();

        ret
    }

    pub fn succeed(&mut self) {
        self.total_succeeded += 1;
    }
}

impl Aggregate for RenderAggregator {
    fn event_name(&self) -> &'static str {
        "Documents Rendered"
    }

    fn aggregate(mut self: Box<Self>, new: Box<Self>) -> Box<Self> {
        self.total_received += new.total_received;
        self.total_succeeded += new.total_succeeded;

        self.template_inline |= new.template_inline;
        self.template_id |= new.template_id;
        self.input_inline |= new.input_inline;
        self.input_id |= new.input_id;
        self.input_omitted |= new.input_omitted;

        self
    }

    fn into_event(self: Box<Self>) -> serde_json::Value {
        let Self {
            total_received,
            total_succeeded,
            template_inline,
            template_id,
            input_inline,
            input_id,
            input_omitted,
        } = *self;

        json!({
            "requests": {
                "total_received": total_received,
                "total_succeeded": total_succeeded,
                "total_failed": total_received.saturating_sub(total_succeeded) // just to be sure we never panics
            },
            "template": {
                "inline": template_inline,
                "id": template_id,
            },
            "input": {
                "inline": input_inline,
                "id": input_id,
                "omitted": input_omitted
            },
        })
    }
}

```

### Core Architecture Module: `crates/meilisearch/src/routes/webhooks.rs`
```
use core::convert::Infallible;
use std::collections::BTreeMap;
use std::str::FromStr;

use actix_http::header::{
    HeaderName, HeaderValue, InvalidHeaderName as ActixInvalidHeaderName,
    InvalidHeaderValue as ActixInvalidHeaderValue,
};
use actix_web::web::{self, Data, Path};
use actix_web::{HttpRequest, HttpResponse};
use deserr::actix_web::AwebJson;
use deserr::{DeserializeError, ValuePointerRef};
use index_scheduler::IndexScheduler;
use meilisearch_types::deserr::{immutable_field_error, DeserrJsonError};
use meilisearch_types::error::deserr_codes::{
    BadRequest, InvalidWebhookHeaders, InvalidWebhookUrl,
};
use meilisearch_types::error::{Code, ErrorCode, ResponseError};
use meilisearch_types::keys::actions;
use meilisearch_types::milli::update::Setting;
use meilisearch_types::webhooks::Webhook;
use serde::Serialize;
use tracing::debug;
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;
use WebhooksError::*;

use crate::analytics::{Aggregate, Analytics};
use crate::extractors::authentication::policies::ActionPolicy;
use crate::extractors::authentication::GuardedData;

#[routes::routes(
    routes(
        "" => [get(get_webhooks), post(post_webhook)],
        "/{uuid}" => [get(get_webhook), patch(patch_webhook), delete(delete_webhook)],
    ),
    tag = "Webhooks",
    tags((
        name = "Webhooks",
        description = "The `/webhooks` route allows you to register endpoints to be called once tasks are processed.",
    )),
)]
pub struct WebhooksApi;

/// Configuration for a webhook endpoint
#[routes::request(deny_unknown_fields = deny_immutable_fields_webhook)]
#[derive(Debug)]
pub(super) struct WebhookSettings {
    /// URL endpoint to call when tasks complete.
    #[request(default, error = DeserrJsonError<InvalidWebhookUrl>, schema_type = Option<String>, example = "https://your.site/on-tasks-completed")]
    url: Setting<String>,
    /// HTTP headers to include in webhook requests.
    #[request(default, error = DeserrJsonError<InvalidWebhookHeaders>, schema_type = Option<BTreeMap<String, String>>, example = json!({"Authorization":"Bearer a-secret-token"}))]
    headers: Setting<BTreeMap<String, Setting<String>>>,
}

fn deny_immutable_fields_webhook(
    field: &str,
    accepted: &[&str],
    location: ValuePointerRef,
) -> DeserrJsonError {
    match field {
        "uuid" => immutable_field_error(field, accepted, Code::ImmutableWebhookUuid),
        "isEditable" => immutable_field_error(field, accepted, Code::ImmutableWebhookIsEditable),
        _ => deserr::take_cf_content(DeserrJsonError::<BadRequest>::error::<Infallible>(
            None,
            deserr::ErrorKind::UnknownKey { key: field, accepted },
            location,
        )),
    }
}

/// Webhook object with metadata and redacted authorization headers.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[schema(rename_all = "camelCase")]
pub(super) struct WebhookWithMetadataRedactedAuthorization {
    /// Unique identifier of the webhook.
    uuid: Uuid,
    /// Whether the webhook can be edited.
    is_editable: bool,
    /// URL and headers. Authorization header values are redacted in the response.
    #[schema(value_type = WebhookSettings)]
    #[serde(flatten)]
    webhook: Webhook,
}

impl WebhookWithMetadataRedactedAuthorization {
    pub fn from(uuid: Uuid, mut webhook: Webhook) -> Self {
        webhook.redact_authorization_header();
        Self { uuid, is_editable: uuid != Uuid::nil(), webhook }
    }
}

/// Response containing a list of all registered webhooks.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub(super) struct WebhookResults {
    /// All webhooks configured on the instance. Each entry includes UUID, URL, headers (authorization redacted), and editability.
    results: Vec<WebhookWithMetadataRedactedAuthorization>,
}

/// List webhooks
///
/// Return all webhooks registered on the instance. Each webhook is returned with its URL, optional headers, and UUID (the key value is never returned).
#[routes::path(
    security(("Bearer" = ["webhooks.get", "webhooks.*", "*.get", "*"])),
    responses(
        (status = OK, description = "Webhooks are returned.", body = WebhookResults, content_type = "application/json", example = json!({
            "results": [
                {
                    "uuid": "550e8400-e29b-41d4-a716-446655440000",
                    "url": "https://your.site/on-tasks-completed",
                    "headers": {
                        "Authorization": "Bearer a-secret-token"
                    },
                    "isEditable": true
                },
                {
                    "uuid": "550e8400-e29b-41d4-a716-446655440001",
                    "url": "https://another.site/on-tasks-completed",
                    "isEditable": true
                }
            ]
        })),
        (status = 401, description = "The authorization header is missing.", body = ResponseError, content_type = "application/json", example = json!(
            {
                "message": "The Authorization header is missing. It must use the bearer authorization method.",
                "code": "missing_authorization_header",
                "type": "auth",
                "link": "https://docs.meilisearch.com/errors#missing_authorization_header"
            }
        )),
    )
)]
async fn get_webhooks(
    index_scheduler: GuardedData<ActionPolicy<{ actions::WEBHOOKS_GET }>, Data<IndexScheduler>>,
) -> Result<HttpResponse, ResponseError> {
    let webhooks = index_scheduler.webhooks_view();
    let results = webhooks
        .webhooks
        .into_iter()
        .map(|(uuid, webhook)| WebhookWithMetadataRedactedAuthorization::from(uuid, webhook))
        .collect::<Vec<_>>();
    let results = WebhookResults { results };

    debug!(returns = ?results, "Get webhooks");
    Ok(HttpResponse::Ok().json(results))
}

#[derive(Serialize, Default)]
pub struct PatchWebhooksAnalytics;

impl Aggregate for PatchWebhooksAnalytics {
    fn event_name(&self) -> &'static str {
        "Webhooks Updated"
    }

    fn aggregate(self: Box<Self>, _new: Box<Self>) -> Box<Self> {
        self
    }

    fn into_event(self: Box<Self>) -> serde_json::Value {
        serde_json::to_value(*self).unwrap_or_default()
    }
}

#[derive(Serialize, Default)]
pub struct PostWebhooksAnalytics;

impl Aggregate for PostWebhooksAnalytics {
    fn event_name(&self) -> &'static str {
        "Webhooks Created"
    }

    fn aggregate(self: Box<Self>, _new: Box<Self>) -> Box<Self> {
        self
    }

    fn into_event(self: Box<Self>) -> serde_json::Value {
        serde_json::to_value(*self).unwrap_or_default()
    }
}

#[derive(Debug, thiserror::Error)]
enum WebhooksError {
    #[error("The URL for the webhook `{0}` is missing.")]
    MissingUrl(Uuid),
    #[error("Defining too many webhooks would crush the server. Please limit the number of webhooks to 20. You may use a third-party proxy server to dispatch events to more than 20 endpoints.")]
    TooManyWebhooks,
    #[error("Too many headers for the webhook `{0}`. Please limit the number of headers to 200. Hint: To remove an already defined header set its value to `null`")]
    TooManyHeaders(Uuid),
    #[error("Webhook `{0}` is immutable. The webhook defined from the command line cannot be modified using the API.")]
    ImmutableWebhook(Uuid),
    #[error("Webhook `{0}` not found.")]
    WebhookNotFound(Uuid),
    #[error("Invalid header name `{0}`: {1}")]
    InvalidHeaderName(String, ActixInvalidHeaderName),
    #[error("Invalid header value `{0}`: {1}")]
    InvalidHeaderValue(String, ActixInvalidHeaderValue),
    #[error("Invalid URL `{0}`: {1}")]
    InvalidUrl(String, url::ParseError),
    #[error("Invalid UUID: {0}")]
    InvalidUuid(uuid::Error),
}

impl ErrorCode for WebhooksError {
    fn error_code(&self) -> meilisearch_types::error::Code {
        match self {
            MissingUrl(_) => meilisearch_types::error::Code::InvalidWebhookUrl,
            TooManyWebhooks => meilisearch_types::error::Code::InvalidWebhooks,
            TooManyHeaders(_) => meilisearch_types::error::Code::InvalidWebhookHeaders,
            ImmutableWebhook(_) => meilisearch_types::error::Code::ImmutableWebhook,
            WebhookNotFound(_) => meilisearch_types::error::Code::WebhookNotFound,
            InvalidHeaderName(_, _) => meilisearch_types::error::Code::InvalidWebhookHeaders,
            InvalidHeaderValue(_, _) => meilisearch_types::error::Code::InvalidWebhookHeaders,
            InvalidUrl(_, _) => meilisearch_types::error::Code::InvalidWebhookUrl,
            InvalidUuid(_) => meilisearch_types::error::Code::InvalidWebhookUuid,
        }
    }
}

fn patch_webhook_inner(
    uuid: &Uuid,
    old_webhook: Webhook,
    new_webhook: WebhookSettings,
) -> Result<Webhook, WebhooksError> {
    let Webhook { url: old_url, mut headers } = old_webhook;

    let url = match new_webhook.url {
        Setting::Set(url) => url,
        Setting::NotSet => old_url,
        Setting::Reset => return Err(MissingUrl(uuid.to_owned())),
    };

    match new_webhook.headers {
        Setting::Set(new_headers) => {
            for (name, value) in new_headers {
                match value {
                    Setting::Set(value) => {
                        headers.insert(name, value);
                    }
                    Setting::NotSet => continue,
                    Setting::Reset => {
                        headers.remove(&name);
                        continue;
                    }
                }
            }
        }
        Setting::Reset => headers.clear(),
        Setting::NotSet => (),
    };

    if headers.len() > 200 {
        return Err(TooManyHeaders(uuid.to_owned()));
    }

    Ok(Webhook { url, headers })
}

fn check_changed(uuid: Uuid, webhook: &Webhook) -> Result<(), WebhooksError> {
    if uuid.is_nil() {
        return Err(ImmutableWebhook(uuid));
    }

    if webhook.url.is_empty() {
        return Err
```

### Core Architecture Module: `crates/meilisearch/src/search/federated/weighted_scores.rs`
```
use std::cmp::Ordering;

use meilisearch_types::milli::score_details::WeightedScoreValue;

pub fn compare(
    left_it: impl Iterator<Item = WeightedScoreValue>,
    left_weighted_global_score: f64,
    right_it: impl Iterator<Item = WeightedScoreValue>,
    right_weighted_global_score: f64,
) -> Ordering {
    WeightedScoreValue::compare_partial(left_it, right_it).unwrap_or_else(|| {
        left_weighted_global_score.partial_cmp(&right_weighted_global_score).unwrap()
    })
}

```

### Core Architecture Module: `crates/meilisearch/src/search_queue.rs`
```
//! This file implements a queue of searches to process and the ability to control how many searches can be run in parallel.
//! We need this because we don't want to process more search requests than the available CPU cores.
//! That slows down everything and consumes RAM for no reason.
//! The steps to do a search are to get the `SearchQueue` data structure and try to get a search permit.
//! This can fail if the queue is full, and we need to drop your search request to register a new one.
//!
//! ### How to do a search request
//!
//! In order to do a search request you should try to get a search permit.
//! Retrieve the `SearchQueue` structure from actix-web (`search_queue: Data<SearchQueue>`)
//! and right before processing the search, call the `SearchQueue::try_get_search_permit` method: `search_queue.try_get_search_permit().await?;`
//!
//! What is going to happen at this point is that you're going to send a oneshot::Sender over an async mpsc channel.
//! Then, the queue/scheduler is going to either:
//! - Drop your oneshot channel => that means there are too many searches going on, and yours won't be executed.
//!   You should exit and free all the RAM you use ASAP.
//! - Sends you a Permit => that will unlock the method, and you will be able to process your search.
//!   And should drop the Permit only once you have freed all the RAM consumed by the method.

use std::num::NonZeroUsize;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use meilisearch_types::milli::progress::Progress;
use meilisearch_types::milli::search::steps::TotalProcessingTimeStep;
use rand::rngs::StdRng;
use rand::RngExt as _;
use tokio::sync::{mpsc, oneshot};

use crate::error::MeilisearchHttpError;

#[derive(Debug)]
pub struct SearchQueue {
    sender: mpsc::Sender<oneshot::Sender<Permit>>,
    capacity: usize,
    /// If we have waited longer than this to get a permit, we should abort the search request entirely.
    /// The client probably already closed the connection, but we have no way to find out.
    time_to_abort: Duration,
    searches_running: Arc<AtomicUsize>,
    searches_waiting_to_be_processed: Arc<AtomicUsize>,
}

/// You should only run search requests while holding this permit.
/// Once it's dropped, a new search request will be able to process.
/// You should always try to drop the permit yourself calling the `drop` async method on it.
#[derive(Debug)]
pub struct Permit {
    sender: mpsc::Sender<()>,
}

impl Permit {
    /// Drop the permit giving back on permit to the search queue.
    pub async fn drop(self) {
        // if the channel is closed then the whole instance is down
        let _ = self.sender.send(()).await;
    }
}

impl Drop for Permit {
    /// The implicit drop implementation can still be called in multiple cases:
    /// - We forgot to call the explicit one somewhere => this should be fixed on our side asap
    /// - The future is cancelled while running and the permit dropped with it
    fn drop(&mut self) {
        let sender = self.sender.clone();
        // if the channel is closed then the whole instance is down
        std::mem::drop(tokio::spawn(async move { sender.send(()).await }));
    }
}

impl SearchQueue {
    pub fn new(capacity: usize, paralellism: NonZeroUsize) -> Self {
        // Search requests are going to wait until we're available anyway,
        // so let's not allocate any RAM and keep a capacity of 1.
        let (sender, receiver) = mpsc::channel(1);

        let instance = Self {
            sender,
            capacity,
            time_to_abort: Duration::from_secs(60),
            searches_running: Default::default(),
            searches_waiting_to_be_processed: Default::default(),
        };

        tokio::task::spawn(Self::run(
            capacity,
            paralellism,
            receiver,
            Arc::clone(&instance.searches_running),
            Arc::clone(&instance.searches_waiting_to_be_processed),
        ));

        instance
    }

    pub fn with_time_to_abort(self, time_to_abort: Duration) -> Self {
        Self { time_to_abort, ..self }
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn searches_running(&self) -> usize {
        self.searches_running.load(Ordering::Relaxed)
    }

    pub fn searches_waiting(&self) -> usize {
        self.searches_waiting_to_be_processed.load(Ordering::Relaxed)
    }

    /// This function is the main loop, it's in charge on scheduling which search request should execute first and
    /// how many should executes at the same time.
    ///
    /// It **must never** panic or exit.
    async fn run(
        capacity: usize,
        parallelism: NonZeroUsize,
        mut receive_new_searches: mpsc::Receiver<oneshot::Sender<Permit>>,
        metric_searches_running: Arc<AtomicUsize>,
        metric_searches_waiting: Arc<AtomicUsize>,
    ) {
        let mut queue: Vec<oneshot::Sender<Permit>> = Default::default();
        let mut rng: StdRng = rand::make_rng();
        let mut searches_running: usize = 0;
        // By having a capacity of parallelism we ensure that every time a search finish it can release its RAM asap
        let (sender, mut search_finished) = mpsc::channel(parallelism.into());

        loop {
            tokio::select! {
                // biased select because we want to free up space before trying to register new tasks
                biased;
                _ = search_finished.recv() => {
                    searches_running = searches_running.saturating_sub(1);
                    if !queue.is_empty() {
                        // Can't panic: the queue wasn't empty thus the range isn't empty.
                        let remove = rng.random_range(0..queue.len());
                        let channel = queue.swap_remove(remove);
                        let _ = channel.send(Permit { sender: sender.clone() });
                    }
                },

                search_request = receive_new_searches.recv() => {
                    let search_request = match search_request {
                        Some(search_request) => search_request,
                        // This should never happen while actix-web is running, but it's not a reason to crash
                        // and it can generate a lot of noise in the tests.
                        None => continue,
                    };

                    if searches_running < usize::from(parallelism) && queue.is_empty() {
                        searches_running += 1;
                        // if the search requests die, it's not a hard error on our side
                        let _ = search_request.send(Permit { sender: sender.clone() });
                        continue;
                    } else if capacity == 0 {
                        // in the very specific case where we have a capacity of zero,
                        // we must refuse the request straight away without going through
                        // the queue stuff.
                        drop(search_request);
                        continue;

                    } else if queue.len() >= capacity {
                        let remove = rng.random_range(0..queue.len());
                        let thing = queue.swap_remove(remove); // this will drop the channel and notify the search that it won't be processed
                        drop(thing);
                    }
                    queue.push(search_request);
                },
            }

            metric_searches_running.store(searches_running, Ordering::Relaxed);
            metric_searches_waiting.store(queue.len(), Ordering::Relaxed);
        }
    }

    /// Returns a search `Permit`.
    /// It should be dropped as soon as you've freed all the RAM associated with the search request being processed.
    pub async fn try_get_search_permit(
        &self,
        progress: &Progress,
    ) -> Result<Permit, MeilisearchHttpError> {
        let _step = progress.update_progress_scoped(TotalProcessingTimeStep::WaitInQueue);
        let now = std::time::Instant::now();
        let (sender, receiver) = oneshot::channel();
        self.sender.send(sender).await.map_err(|_| MeilisearchHttpError::SearchLimiterIsDown)?;
        let permit = receiver
            .await
            .map_err(|_| MeilisearchHttpError::TooManySearchRequests(self.capacity))?;

        // If we've been for more than one minute to get a search permit, it's better to simply
        // abort the search request than spending time processing something where the client
        // most certainly exited or got a timeout a long time ago.
        // We may find a better solution in https://github.com/actix/actix-web/issues/3462.
        if now.elapsed() > self.time_to_abort {
            permit.drop().await;
            Err(MeilisearchHttpError::TooManySearchRequests(self.capacity))
        } else {
            Ok(permit)
        }
    }

    /// Returns `Ok(())` if everything seems normal.
    /// Returns `Err(MeilisearchHttpError::SearchLimiterIsDown)` if the search limiter seems down.
    pub fn health(&self) -> Result<(), MeilisearchHttpError> {
        if self.sender.is_closed() {
            Err(MeilisearchHttpError::SearchLimiterIsDown)
        } else {
            Ok(())
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6660** (2026-10-01): **Replace mimalloc with jemalloc + patch heed, v52 edition**
  *Symptoms*: - "draft" changes in heed to introduce unique txns that gate db opening behind an environment-level mutex - replace mimalloc with jemalloc in an attempt to remove the crash issues on thread exit  See #6654 for details  ## Generative AI tools  - [x] This PR does not use generative AI tooling - [ ] This PR uses generative AI tooling and respect the [related policies](https://github.com/meilisearch/meilisearch/blob/main/CONTRIBUTING.md#use-of-generative-ai-tools)     - *list of used tools and what they were used for* 

- **Issue #6659** (2026-10-01): **Replace mimalloc with jemalloc + patch heed, v53 edition**
  *Symptoms*: - "draft" changes in heed to introduce unique txns that gate db opening behind an environment-level mutex - replace mimalloc with jemalloc in an attempt to remove the crash issues on thread exit  See #6654 for details  ## Generative AI tools  - [x] This PR does not use generative AI tooling - [ ] This PR uses generative AI tooling and respect the [related policies](https://github.com/meilisearch/meilisearch/blob/main/CONTRIBUTING.md#use-of-generative-ai-tools)     - *list of used tools and what they were used for* 

- **Issue #6658** (2026-10-01): **Replace mimalloc with jemalloc + patch heed, v54 edition**
  *Symptoms*: - "draft" changes in heed to introduce unique txns that gate db opening behind an environment-level mutex - replace mimalloc with jemalloc in an attempt to remove the crash issues on thread exit  See #6654 for details   ## Generative AI tools  - [x] This PR does not use generative AI tooling - [ ] This PR uses generative AI tooling and respect the [related policies](https://github.com/meilisearch/meilisearch/blob/main/CONTRIBUTING.md#use-of-generative-ai-tools)     - *list of used tools and what they were used for* 

- **Issue #6651** (2026-09-29): **Fix task queue following upgrade to v1.54 when using DSRs**
  *Symptoms*: ## Changelog  - DSR update tasks created in Meilisearch < v1.54 are now correctly displayed, processed, canceled, deleted  ## Related issue  Fixes #6646  ## Generative AI tools  - [x] This PR does not use generative AI tooling - [ ] This PR uses generative AI tooling and respect the [related policies](https://github.com/meilisearch/meilisearch/blob/main/CONTRIBUTING.md#use-of-generative-ai-tools)     - *list of used tools and what they were used for*  

- **Issue #6638** (2026-09-23): **Ignore geo errors when updating or deleting existing docs**
  *Symptoms*: Currently tasks are failed when an existing document in the db has an invlaid `_geo` for some reason (it is not clear how this is possible).  This PR ignores geo failures from existing documents when updating or deleting a document. Failures from existing documents when updating the settings and failures from new versions of documents are not ignored.  ## Generative AI tools  - [x] This PR does not use generative AI tooling - [ ] This PR uses generative AI tooling and respect the [related policies](https://github.com/meilisearch/meilisearch/blob/main/CONTRIBUTING.md#use-of-generative-ai-tools)     - *list of used tools and what they were used for* 

- **Issue #6613** (2026-09-08): **Fix geoJson and geo support in settings**
  *Symptoms*: ## Related issue  Fixes https://linear.app/meilisearch/issue/SP-2167  ## Generative AI tools  - [x] This PR does not use generative AI tooling  ## Changelog  When using the attribute pattern format with `_geo` and `_geojson` as follows: ```json "filterableAttributes": [   {     "attributePatterns": [       "_geo"     ],     "features": {       "facetSearch": true,       "filter": {         "equality": true,         "comparison": true       }     }   } ] ```  Meilisearch was returning an `Attribute '_geo/_geojson' is not filterable` error.  This PR fixes the way Meilisearch checks the filterable fields to take into account the patterns.  
  **Post-Mortem & Fix Analysis**:
  > closing in favor of a PR on the cloud side

- **Issue #6543** (2026-07-29): **Fix duplicate pins in federated search**
  *Symptoms*: ## Related issue  Fixes #6540   ## API change  - Add `precedence` to `ScoreDetails::Pin` in ranking score details  ## Implementation  - Introduce a trait to factor the behavior of deduplicating and sorting pins - Use the trait to correctly deduplicate pins in federated search - Fix existing tests - Add tests:     1. Checking that pins are no longer duplicated (checked that pins would be duplicated on main)     2. Checking that the pin belonging to the rule with the earliest precedence wins  ## Generative AI tools  - [x] This PR does not use generative AI tooling - [ ] This PR uses generative AI tooling and respect the [related policies](https://github.com/meilisearch/meilisearch/blob/main/CONTRIBUTING.md#use-of-generative-ai-tools)     - *list of used tools and what they were used for*

- **Issue #6540** (2026-07-29): **Duplicate pinned documents in federated search**
  *Symptoms*: **Describe the bug** Pinned documents are not correctly deduplicated in federated search requests containing several queries hitting the same index.  **To Reproduce** Steps to reproduce the behavior: 1. Enable the dsr experimental feature 2. Add a rule with an action to pin a document 3. Create a federated search request containing 2 queries that target the same index and firing the DSR 4. Observe the document being pinned twice.  **Expected behavior** The document is only pinned once.  **Meilisearch version:** The work on DSR as index did not modify the way pins are resolved, so this likely dates back from the original introduction of pinning in v1.41 

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

### Incident Patch 1: `82e0ec1e` (2026-10-05)
**Commit Message**: Merge pull request #6661 from meilisearch/fix-ranking-score-threshold-performances

Fix ranking score threshold performances

**File**: `crates/milli/src/search/new/bucket_sort.rs` (modified, +22/-2)
```diff
@@ -203,7 +203,18 @@ pub fn bucket_sort<'ctx, Q: RankingRuleQueryTrait>(
 
                         if is_below_threshold {
                             all_candidates -= &bucket;
-                            all_candidates -= &ranking_rule_universes[cur_ranking_rule_index];
+                            for rru in
+                                ranking_rule_universes.iter().take(cur_ranking_rule_index + 1)
+                            {
+                                all_candidates -= rru;
+                            }
+
+                            return Ok(BucketSortOutput {
+                                scores: valid_scores,
+                                docids: valid_docids,
+                                all_candidates,
+                                degraded: true,
+                            });
                         } else {
                             maybe_add_to_results!(bucket);
                         }
@@ -276,7 +287,16 @@ pub fn bucket_sort<'ctx, Q: RankingRuleQueryTrait>(
         {
             if is_below_threshold {
                 all_candidates -= &next_bucket.candidates;
-                all_candidates -= &ranking_rule_universes[cur_ranking_rule_index];
+                for rru in ranking_rule_universes.iter().take(cur_ranking_rule_index + 1) {
+                    all_candidates -= rru;
+                }
+
+                return Ok(BucketSortOutput {
+                    scores: valid_scores,
+                    docids: valid_docids,
+                    all_candidates,
+                    degraded: false,
+                });
             } else {
                 maybe_add_to_results!(next_bucket.candidates);
             }
```

---

### Incident Patch 2: `e2d12d3e` (2026-10-05)
**Commit Message**: Merge pull request #6667 from meilisearch/fix-openapi-docs

Fix OpenAPI docs

**File**: `crates/meilisearch/src/routes/batches.rs` (modified, +0/-4)
```diff
@@ -27,10 +27,6 @@ use crate::extractors::authentication::GuardedData;
         "/stream" => get(get_batches_stream),
         "/{batch_id}" => get(get_batch)
     ),
-    tags((
-        name = "Batches",
-        description = "Meilisearch groups compatible tasks ([asynchronous operations](https://www.meilisearch.com/docs/learn/async/asynchronous_operations)) into batches for efficient processing. For example, multiple document additions to the same index may be batched together. The /batches routes give information about the progress of these batches and let you monitor batch progress and performance.",
-    )),
 )]
 pub struct BatchesApi;
 
```

**File**: `crates/meilisearch/src/routes/mcp.rs` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ use crate::search_queue::SearchQueue;
 static MEILISEARCH_OPEN_API: LazyLock<OpenApi> = LazyLock::new(MeilisearchApi::openapi);
 
 #[routes::routes(
-    tag = "MCP connection",
+    tag = "MCP",
     routes(
         "" => post(mcp)
     ),
```

**File**: `crates/meilisearch/src/routes/network/mod.rs` (modified, +0/-6)
```diff
@@ -40,12 +40,6 @@ use enterprise_edition as current_edition;
         "/control" => post(post_network_change),
     ),
     tag = "Experimental features",
-    tags((
-        name = "Network",
-        description = "The `/network` route allows you to describe the topology of a network of Meilisearch instances.
-
-This route is **synchronous**. This means that no task object will be returned, and any change to the network will be made available immediately.",
-    )),
 )]
 pub struct NetworkApi;
 
```

**File**: `crates/meilisearch/src/routes/render.rs` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ use crate::routes::render_analytics::RenderAggregator;
 
 #[routes::routes(
     routes("" => post(render_post)),
-    tag = "Template",
+    tag = "Render templates",
     tags((
         name = "Render templates",
         description = "The /render-template route allows rendering templates used by Meilisearch.",
```

**File**: `crates/meilisearch/src/routes/tasks.rs` (modified, +0/-4)
```diff
@@ -43,10 +43,6 @@ use crate::extractors::authentication::GuardedData;
         "/{task_id}/documents" => get(get_task_documents_file),
     ),
     tag = "Async task management",
-    tags((
-        name = "Tasks",
-        description = "The tasks route gives information about the progress of the [asynchronous operations](https://docs.meilisearch.com/learn/advanced/asynchronous_operations.html).",
-    )),
 )]
 pub struct TaskApi;
 
```

---

### Incident Patch 3: `c46e7348` (2026-10-02)
**Commit Message**: Fix duplication of Render template route

**File**: `crates/meilisearch/src/routes/render.rs` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ use crate::routes::render_analytics::RenderAggregator;
 
 #[routes::routes(
     routes("" => post(render_post)),
-    tag = "Template",
+    tag = "Render templates",
     tags((
         name = "Render templates",
         description = "The /render-template route allows rendering templates used by Meilisearch.",
```

---

### Incident Patch 4: `48e5db28` (2026-10-01)
**Commit Message**: fix extimated total hit

**File**: `crates/milli/src/search/new/bucket_sort.rs` (modified, +6/-2)
```diff
@@ -203,7 +203,9 @@ pub fn bucket_sort<'ctx, Q: RankingRuleQueryTrait>(
 
                         if is_below_threshold {
                             all_candidates -= &bucket;
-                            all_candidates -= &ranking_rule_universes[0];
+                            for i in 0..=cur_ranking_rule_index {
+                                all_candidates -= &ranking_rule_universes[i];
+                            }
 
                             return Ok(BucketSortOutput {
                                 scores: valid_scores,
@@ -283,7 +285,9 @@ pub fn bucket_sort<'ctx, Q: RankingRuleQueryTrait>(
         {
             if is_below_threshold {
                 all_candidates -= &next_bucket.candidates;
-                all_candidates -= &ranking_rule_universes[0];
+                for i in 0..=cur_ranking_rule_index {
+                    all_candidates -= &ranking_rule_universes[i];
+                }
 
                 return Ok(BucketSortOutput {
                     scores: valid_scores,
```

---

### Incident Patch 5: `4657683e` (2026-09-29)
**Commit Message**: Update workload to expose the bug

**File**: `workloads/tests/dsr.json` (modified, +176/-4)
```diff
@@ -1015,15 +1015,128 @@
       "synchronous": "DontWait"
     },
     {
-      "route": "tasks?types=upgradeDatabase",
+      "route": "dynamic-search-rules/scale-rule",
+      "method": "PATCH",
+      "body": {
+        "inline": {
+          "conditions": {
+            "query": {
+              "words": "HERO SUPER"
+            }
+          },
+          "actions": {
+            "scale": [
+              {
+                "ids": ["372631"],
+                "weight": 2.0
+              }
+            ]
+          }
+        }
+      },
+      "expectedStatus": 202,
+      "expectedResponse": {
+        "taskUid": 6,
+        "indexUid": ".meili_dsr",
+        "status": "enqueued",
+        "type": "dsrUpdate",
+        "enqueuedAt": "[enqueuedAt]"
+      },
+      "synchronous": "WaitForTask"
+    },
+    {
+      "route": "indexes/movies/search?q=hero super&limit=3",
+      "method": "GET",
+      "body": null,
+      "expectedStatus": 200,
+      "expectedResponse": {
+        "estimatedTotalHits": 341,
+        "hits": [
+          {
+            "genres": [
+              "Family",
+              "Animation"
+            ],
+            "id": 15242,
+            "overview": "When Snoopy receives a letter from his original owner Lila, he goes to visit her in the hospital while Charlie Brown and the gang are on the lookout for him. Suddenly, Snoopy feels that he must go live with Lila, but must say goodbye to all his friends. In his adventure to the hospital, he encounters numerous \"No Dogs Allowed\" signs, an annoying little girl who desires to keep him, and more!",
+            "poster": "https://image.tmdb.org/t/p/w500/vGYhYtoXkpjXTZ7KLQMJehwfLG0.jpg",
+            "release_date": 84758400,
+            "title": "Snoopy, Come Home"
+          },
+          {
+            "genres": [
+              "Animation",
+              "Fantasy"
+            ],
+            "id": 372631,
+            "overview": "The holiday season gets extra chilly as Loki and the frost giant Ymir plot to conquer the world. Marvel heroes Iron Man, Captain America, Hulk, Thor and others must stop the villains from stealing Santa's power – if anyone can actually find the mysterious Mr. Claus. Fortunately, Rocket Raccoon and Groot are also hot on Santa's trail. Heroes, villains, elves and cosmic bounty hunters collide in an epic quest that leaves the fate of the holiday and the world in the balance.",
+            "poster": "https://image.tmdb.org/t/p/w500/2StM8Vavf7ukvuj9mxg1o7nKxmi.jpg",
+            "release_date": 1450137600,
+            "title": "Marvel Super Hero Adventures: Frost Fight!"
+          },
+          {
+            "genres": [
+              "Animation",
+              "Family"
+            ],
+            "id": 452931,
+            "overview": "Super Hero High is facing off against Korugar Academy in the Intergalactic Games, but Lena Luthor takes advantage of the gathering of Supers to enact her villainous plan.",
+            "poster": "https://image.tmdb.org/t/p/w500/9BkNrjD9fAlp0lo9Kw8Ky4qcnKq.jpg",
+            "release_date": 1494288000,
+            "title": "DC Super Hero Girls: Intergalactic Games"
+          }
+        ],
+        "limit": 3,
+        "offset": 0,
+        "processingTimeMs": "[duration]",
+        "query": "hero super",
+        "requestUid": "[uuid]"
+      },
+      "synchronous": "DontWait"
+    },
+    {
+      "route": "tasks?types=upgradeDatabase,dsrUpdate",
       "method": "GET",
       "body": null,
       "expectedStatus": 200,
       "expectedResponse": {
-        "from": 5,
+        "from": 6,
         "limit": 20,
         "next": null,
         "results": [
+          {
+            "batchUid": 5,
+            "canceledBy": null,
+            "details": {
+              "rule": {
+                "actions": {
+                  "scale": [
+                    {
+                      "ids": [
+                        "372631"
+                      ],
+                      "weight": 2.0
+                    }
+                  ]
+                },
+                "conditions": {
+                  "query": {
+                    "words": "HERO SUPER"
+                  }
+                }
+              },
+              "updatedRules": 1
+            },
+            "duration": "[duration]",
+            "enqueuedAt": "[enqueuedAt]",
+            "error": null,
+            "finishedAt": "[finishedAt]",
+            "indexUid": ".meili_dsr",
+            "startedAt": "[startedAt]",
+            "status": "succeeded",
+            "type": "dsrUpdate",
+            "uid": 6
+          },
           {
             "batchUid": 4,
             "canceledBy": null,
@@ -1057,11 +1170,70 @@
             "status": "succeeded",
             "type": "upgradeDatabase",
             "uid": 4
+          },
+          {
+            "batchUid": 3,
+            "canceledBy": null,
+            "details": {
+              "rule": {
+                "actions": {},
+         
```

---

### Incident Patch 6: `01ee09ab` (2026-09-29)
**Commit Message**: Merge pull request #6650 from meilisearch/link-to-mcp-guide

Add link to MCP guide in generated API reference

**File**: `crates/meilisearch/src/routes/mcp.rs` (modified, +2/-2)
```diff
@@ -47,8 +47,8 @@ pub struct McpApi;
 
 /// Model context protocol (MCP)
 ///
-/// The `/mcp` route exposes [the MCP open protocol](https://modelcontextprotocol.io) that enables seamless integration between LLM
-/// applications and external data sources and tools.
+/// The `/mcp` route exposes an [MCP server](https://www.meilisearch.com/docs/getting_started/integrations/mcp) for
+/// LLM applications to search Meilisearch.
 #[routes::path(
     security(),
     request_body = McpQuery,
```

---

### Incident Patch 7: `909ef7fe` (2026-09-24)
**Commit Message**: Merge pull request #6640 from meilisearch/fix-embedder-setting-change

Fix embedder setting change

**File**: `crates/meilisearch/tests/vector/rest.rs` (modified, +248/-2)
```diff
@@ -1,5 +1,6 @@
 use std::collections::BTreeMap;
-use std::sync::atomic::AtomicUsize;
+use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
+use std::sync::Arc;
 use std::time::Duration;
 
 use http_client::policy::IpPolicy;
@@ -345,7 +346,7 @@ async fn create_faulty_mock_raw(sender: mpsc::Sender<()>) -> (&'static MockServe
     Mock::given(method("POST"))
         .and(path("/"))
         .respond_with(move |_req: &Request| {
-            let count = count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
+            let count = count.fetch_add(1, Ordering::SeqCst);
 
             if count >= 5 {
                 let _ = sender.try_send(());
@@ -373,6 +374,90 @@ async fn create_faulty_mock_raw(sender: mpsc::Sender<()>) -> (&'static MockServe
     (mock_server, embedder_settings)
 }
 
+/// Mock REST embedder that accepts `Authorization: Bearer my-api-key` until `revoked` is set.
+async fn create_mock_with_revocable_key() -> (&'static MockServer, Value, Value, Arc<AtomicBool>) {
+    let mock_server = Box::leak(Box::new(MockServer::start().await));
+    let revoked = Arc::new(AtomicBool::new(false));
+    let revoked_for_handler = revoked.clone();
+
+    const REVOCABLE_API_KEY: &str = "my-api-key";
+    const REVOCABLE_API_KEY_BEARER: &str = "Bearer my-api-key";
+
+    const UNREVOCABLE_API_KEY: &str = "my-super-api-key";
+    const UNREVOCABLE_API_KEY_BEARER: &str = "Bearer my-super-api-key";
+
+    let text_to_embedding: BTreeMap<_, _> = vec![
+        ("kefir", [0.0, 0.0, 0.0]),
+        ("intel", [1.0, 1.0, 1.0]),
+        ("test", [0.5, 0.5, 0.5]),
+        ("toto kefir", [0.0, 0.5, 0.0]),
+        ("toto intel", [1.0, 0.5, 1.0]),
+        ("toto test", [0.5, 1.0, 0.5]),
+    ]
+    .into_iter()
+    .collect();
+
+    Mock::given(method("POST"))
+        .and(path("/"))
+        .respond_with(move |req: &Request| {
+            let text_to_embedding = match req.headers.get("Authorization") {
+                Some(api_key) if api_key == UNREVOCABLE_API_KEY_BEARER => &text_to_embedding,
+                Some(api_key)
+                    if api_key != REVOCABLE_API_KEY_BEARER
+                        || revoked_for_handler.load(Ordering::SeqCst) =>
+                {
+                    return ResponseTemplate::new(401).set_body_json(json!({
+                        "error": format!("invalid api key: {}", api_key.to_str().unwrap())
+                    }));
+                }
+                Some(_) => &text_to_embedding,
+                None => {
+                    return ResponseTemplate::new(401)
+                        .set_body_json(json!({"error": "missing Authorization header"}));
+                }
+            };
+
+            let text: String = match req.body_json() {
+                Ok(text) => text,
+                Err(error) => {
+                    return ResponseTemplate::new(400).set_body_json(json!({
+                      "error": format!("Invalid request: {error}")
+                    }));
+                }
+            };
+
+            ResponseTemplate::new(200).set_body_json(
+                json!({ "data": text_to_embedding.get(text.as_str()).unwrap_or(&[99., 99., 99.]) }),
+            )
+        })
+        .mount(mock_server)
+        .await;
+
+    let embedder_settings = json!({
+        "source": "rest",
+        "url": mock_server.uri(),
+        "apiKey": REVOCABLE_API_KEY,
+        "request": "{{text}}",
+        "response": {
+          "data": "{{embedding}}"
+        },
+        "documentTemplate": "{{doc.name}}",
+    });
+
+    let unrevocable_embedder_settings = json!({
+        "source": "rest",
+        "url": mock_server.uri(),
+        "apiKey": UNREVOCABLE_API_KEY,
+        "request": "{{text}}",
+        "response": {
+          "data": "{{embedding}}"
+        },
+        "documentTemplate": "toto {{doc.name}}",
+    });
+
+    (mock_server, embedder_settings, unrevocable_embedder_settings, revoked)
+}
+
 pub async fn post<T: IntoUrl>(
     url: T,
     text: &str,
@@ -2232,3 +2317,164 @@ async fn last_error_stats() {
     }
     "#);
 }
+
+#[actix_rt::test]
+async fn revoked_api_key() {
+    let (_mock, setting, unrevocable_settings, revoked) = create_mock_with_revocable_key().await;
+    let server = Server::new().await;
+    let index = server.index("doggo");
+
+    let (response, code) = index
+        .update_settings(json!({
+          "embedders": {
+              "rest": setting,
+          },
+        }))
+        .await;
+    snapshot!(code, @"202 Accepted");
+    let task = server.wait_task(response.uid()).await;
+    snapshot!(task["status"], @r###""succeeded""###);
+
+    let (value, code) = index.add_documents(json!([{"id": 0, "name": "kefir"}]), None).await;
+    snapshot!(code, @"202 Accepted");
+    let task = server.wait_task(value.uid()).await;
+    snapshot!(task["status"], @r###""succeeded""###);
+
+    revoked.store(true, Ordering::SeqCst);
+
+    let (value, code) = index.add_documents(json!([{"id": 1, "name": "int
```

**File**: `crates/milli/src/update/index_documents/extract/extract_vector_points.rs` (modified, +8/-8)
```diff
@@ -319,16 +319,16 @@ pub fn extract_vector_points<R: io::Read + io::Seek>(
                         }
                     }
 
-                    ReindexAction::RegeneratePrompts => {
-                        let Some(old_runtime) = old_configs.get(name) else {
-                            tracing::error!(embedder = name, "Old embedder config not found");
-                            continue;
-                        };
-
-                        ExtractionAction::SettingsRegeneratePrompts {
+                    ReindexAction::RegeneratePrompts => match old_configs.get(name) {
+                        Some(old_runtime) => ExtractionAction::SettingsRegeneratePrompts {
                             old_runtime: old_runtime.clone(),
+                        },
+                        None => {
+                            tracing::error!(embedder = name, "Old embedder config not found");
+                            // if we may need to reindex, but we don't have the old config, we need to reindex everything
+                            ExtractionAction::SettingsFullReindex
                         }
-                    }
+                    },
                 };
 
                 extractors.push(EmbedderVectorExtractor {
```

**File**: `crates/milli/src/update/new/indexer/mod.rs` (modified, +5/-5)
```diff
@@ -536,26 +536,26 @@ where
         let Some(infos) = index.embedding_configs().embedder_info(wtxn, embedder_name)? else {
             continue;
         };
-        let arroy = VectorStore::new(backend, index.vector_store, infos.embedder_id, was_quantized);
-        let Some(dimensions) = arroy.dimensions(wtxn)? else {
+        let store = VectorStore::new(backend, index.vector_store, infos.embedder_id, was_quantized);
+        let Some(dimensions) = store.dimensions(wtxn)? else {
             continue;
         };
         for fragment_id in fragment_ids {
             // we must keep the user provided embeddings that ended up in this store
 
             if infos.embedding_status.user_provided_docids().is_empty() {
                 // no user provided: clear store
-                arroy.clear_store(wtxn, *fragment_id, dimensions)?;
+                store.clear_store(wtxn, *fragment_id, dimensions)?;
                 continue;
             }
 
             // some user provided, remove only the ids that are not user provided
-            let to_delete = arroy.items_in_store(wtxn, *fragment_id, |items| {
+            let to_delete = store.items_in_store(wtxn, *fragment_id, |items| {
                 items - infos.embedding_status.user_provided_docids()
             })?;
 
             for to_delete in to_delete {
-                arroy.del_item_in_store(wtxn, to_delete, *fragment_id, dimensions)?;
+                store.del_item_in_store(wtxn, to_delete, *fragment_id, dimensions)?;
             }
         }
     }
```

**File**: `crates/milli/src/update/settings.rs` (modified, +22/-3)
```diff
@@ -1469,7 +1469,7 @@ impl<'a, 't, 'i> Settings<'a, 't, 'i> {
         self.index.set_updated_at(self.wtxn, &OffsetDateTime::now_utc())?;
 
         let old_inner_settings =
-            InnerIndexSettings::from_index(self.index, self.wtxn, ip_policy, None)?;
+            InnerIndexSettings::from_index_inner(self.index, self.wtxn, ip_policy, None, true)?;
 
         // never trigger re-indexing
         self.update_displayed()?;
@@ -1561,7 +1561,7 @@ impl<'a, 't, 'i> Settings<'a, 't, 'i> {
         self.index.set_updated_at(self.wtxn, &OffsetDateTime::now_utc())?;
 
         let old_inner_settings =
-            InnerIndexSettings::from_index(self.index, self.wtxn, ip_policy, None)?;
+            InnerIndexSettings::from_index_inner(self.index, self.wtxn, ip_policy, None, true)?;
 
         // Update index settings
         let embedding_config_updates = self.update_embedding_configs()?;
@@ -2012,6 +2012,19 @@ impl InnerIndexSettings {
         rtxn: &heed::RoTxn<'_>,
         ip_policy: &http_client::policy::IpPolicy,
         runtime_embedders: Option<RuntimeEmbedders>,
+    ) -> Result<Self> {
+        Self::from_index_inner(index, rtxn, ip_policy, runtime_embedders, false)
+    }
+
+    /// Allow to ignore embedder errors when building the runtime embedders.
+    /// This is used when we are loading the embedders from the old settings,
+    /// avoiding to fail the indexing because of settings that would have been replaced or removed.
+    fn from_index_inner(
+        index: &Index,
+        rtxn: &heed::RoTxn<'_>,
+        ip_policy: &http_client::policy::IpPolicy,
+        runtime_embedders: Option<RuntimeEmbedders>,
+        ignore_embedder_errors: bool,
     ) -> Result<Self> {
         let stop_words = index.stop_words(rtxn)?;
         let stop_words = stop_words.map(|sw| sw.map_data(Vec::from).unwrap());
@@ -2022,7 +2035,11 @@ impl InnerIndexSettings {
         let proximity_precision = index.proximity_precision(rtxn)?.unwrap_or_default();
         let runtime_embedders = match runtime_embedders {
             Some(embedding_configs) => embedding_configs,
-            None => embedders(index.embedding_configs().embedding_configs(rtxn)?, ip_policy)?,
+            None => embedders(
+                index.embedding_configs().embedding_configs(rtxn)?,
+                ip_policy,
+                ignore_embedder_errors,
+            )?,
         };
         let embedder_category_id = index
             .embedding_configs()
@@ -2118,6 +2135,7 @@ impl InnerIndexSettings {
 fn embedders(
     embedding_configs: Vec<IndexEmbeddingConfig>,
     ip_policy: &http_client::policy::IpPolicy,
+    ignore_build_errors: bool,
 ) -> Result<RuntimeEmbedders> {
     let res: Result<_> = embedding_configs
         .into_iter()
@@ -2159,6 +2177,7 @@ fn embedders(
                 ))
             },
         )
+        .filter(|r| if ignore_build_errors { r.is_ok() } else { true })
         .collect();
     res.map(RuntimeEmbedders::new)
 }
```

---

### Incident Patch 8: `5903ab98` (2026-09-21)
**Commit Message**: Add test reproducing the bug

**File**: `crates/meilisearch/tests/vector/rest.rs` (modified, +196/-2)
```diff
@@ -1,5 +1,6 @@
 use std::collections::BTreeMap;
-use std::sync::atomic::AtomicUsize;
+use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
+use std::sync::Arc;
 use std::time::Duration;
 
 use http_client::policy::IpPolicy;
@@ -345,7 +346,7 @@ async fn create_faulty_mock_raw(sender: mpsc::Sender<()>) -> (&'static MockServe
     Mock::given(method("POST"))
         .and(path("/"))
         .respond_with(move |_req: &Request| {
-            let count = count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
+            let count = count.fetch_add(1, Ordering::SeqCst);
 
             if count >= 5 {
                 let _ = sender.try_send(());
@@ -373,6 +374,84 @@ async fn create_faulty_mock_raw(sender: mpsc::Sender<()>) -> (&'static MockServe
     (mock_server, embedder_settings)
 }
 
+/// Mock REST embedder that accepts `Authorization: Bearer my-api-key` until `revoked` is set.
+async fn create_mock_with_revocable_key() -> (&'static MockServer, Value, Value, Arc<AtomicBool>) {
+    let mock_server = Box::leak(Box::new(MockServer::start().await));
+    let revoked = Arc::new(AtomicBool::new(false));
+    let revoked_for_handler = revoked.clone();
+
+    const REVOCABLE_API_KEY: &str = "my-api-key";
+    const REVOCABLE_API_KEY_BEARER: &str = "Bearer my-api-key";
+
+    const UNREVOCABLE_API_KEY: &str = "my-super-api-key";
+    const UNREVOCABLE_API_KEY_BEARER: &str = "Bearer my-super-api-key";
+
+    let text_to_embedding: BTreeMap<_, _> =
+        vec![("kefir", [0.0, 0.0, 0.0]), ("intel", [1.0, 1.0, 1.0]), ("test", [0.5, 0.5, 0.5])]
+            .into_iter()
+            .collect();
+
+    Mock::given(method("POST"))
+        .and(path("/"))
+        .respond_with(move |req: &Request| {
+            match req.headers.get("Authorization") {
+                Some(api_key) if api_key == UNREVOCABLE_API_KEY_BEARER => {}
+                Some(api_key)
+                    if api_key != REVOCABLE_API_KEY_BEARER
+                        || revoked_for_handler.load(Ordering::SeqCst) =>
+                {
+                    return ResponseTemplate::new(401).set_body_json(json!({
+                        "error": format!("invalid api key: {}", api_key.to_str().unwrap())
+                    }));
+                }
+                Some(_) => {}
+                None => {
+                    return ResponseTemplate::new(401)
+                        .set_body_json(json!({"error": "missing Authorization header"}));
+                }
+            }
+
+            let text: String = match req.body_json() {
+                Ok(text) => text,
+                Err(error) => {
+                    return ResponseTemplate::new(400).set_body_json(json!({
+                      "error": format!("Invalid request: {error}")
+                    }));
+                }
+            };
+
+            ResponseTemplate::new(200).set_body_json(
+                json!({ "data": text_to_embedding.get(text.as_str()).unwrap_or(&[99., 99., 99.]) }),
+            )
+        })
+        .mount(mock_server)
+        .await;
+
+    let embedder_settings = json!({
+        "source": "rest",
+        "url": mock_server.uri(),
+        "apiKey": REVOCABLE_API_KEY,
+        "request": "{{text}}",
+        "response": {
+          "data": "{{embedding}}"
+        },
+        "documentTemplate": "{{doc.name}}",
+    });
+
+    let unrevocable_embedder_settings = json!({
+        "source": "rest",
+        "url": mock_server.uri(),
+        "apiKey": UNREVOCABLE_API_KEY,
+        "request": "{{text}}",
+        "response": {
+          "data": "{{embedding}}"
+        },
+        "documentTemplate": "{{doc.name}}",
+    });
+
+    (mock_server, embedder_settings, unrevocable_embedder_settings, revoked)
+}
+
 pub async fn post<T: IntoUrl>(
     url: T,
     text: &str,
@@ -2232,3 +2311,118 @@ async fn last_error_stats() {
     }
     "#);
 }
+
+#[actix_rt::test]
+async fn revoked_api_key() {
+    let (_mock, setting, unrevocable_settings, revoked) = create_mock_with_revocable_key().await;
+    let server = Server::new().await;
+    let index = server.index("doggo");
+
+    let (response, code) = index
+        .update_settings(json!({
+          "embedders": {
+              "rest": setting,
+          },
+        }))
+        .await;
+    snapshot!(code, @"202 Accepted");
+    let task = server.wait_task(response.uid()).await;
+    snapshot!(task["status"], @r###""succeeded""###);
+
+    let (value, code) = index.add_documents(json!([{"id": 0, "name": "kefir"}]), None).await;
+    snapshot!(code, @"202 Accepted");
+    let task = server.wait_task(value.uid()).await;
+    snapshot!(task["status"], @r###""succeeded""###);
+
+    revoked.store(true, Ordering::SeqCst);
+
+    let (value, code) = index.add_documents(json!([{"id": 1, "name": "intel"}]), None).await;
+    snapshot!(code, @"202 Accepted");
+    let task = server.wait_task(value.uid()).await;
+    snapshot!(task, @r###"
+    {
+      "uid": "[uid]",
+      "batchUid": "[batch_u
```

---

### Incident Patch 9: `91fe3528` (2026-09-17)
**Commit Message**: Fix fmt

**File**: `crates/milli/src/search/hybrid.rs` (modified, +1/-1)
```diff
@@ -6,8 +6,8 @@ use roaring::RoaringBitmap;
 
 use crate::score_details::{ScoreDetails, ScoreValue, ScoringStrategy};
 use crate::search::new::{distinct_fid, distinct_single_docid};
-use crate::search::SemanticSearch;
 use crate::search::steps::RetrieveIndexDataStep;
+use crate::search::SemanticSearch;
 use crate::vector::{Embedding, SearchQuery};
 use crate::{
     merge_positioned_hits_into_page, FieldsIdsMap, Index, MatchingWords, PinDoc, Precedence,
```

**File**: `crates/milli/src/update/new/extract/faceted/extract_facets.rs` (modified, +1/-1)
```diff
@@ -14,7 +14,6 @@ use super::FacetKind;
 use crate::fields_ids_map::metadata::Metadata;
 use crate::filterable_attributes_rules::match_faceted_field;
 use crate::heed_codec::facet::OrderedF64Codec;
-use crate::update::new::steps::IndexingStep;
 use crate::update::del_add::DelAdd;
 use crate::update::new::channel::FieldIdDocidFacetSender;
 use crate::update::new::document::DocumentContext;
@@ -27,6 +26,7 @@ use crate::update::new::indexer::settings_changes::{
     DocumentsIndentifiers, SettingsChangeExtractor,
 };
 use crate::update::new::ref_cell_ext::RefCellExt as _;
+use crate::update::new::steps::IndexingStep;
 use crate::update::new::thread_local::{FullySend, ThreadLocal};
 use crate::update::new::{DocumentChange, DocumentIdentifiers};
 use crate::update::settings::SettingsDelta;
```

**File**: `crates/milli/src/update/new/extract/geo/cellulite.rs` (modified, +1/-1)
```diff
@@ -7,14 +7,14 @@ use geojson::GeoJson;
 use heed::{BytesEncode, RoTxn};
 use zerometry::Zerometry;
 
-use crate::update::new::steps::IndexingStep;
 use crate::update::new::channel::GeoJsonSender;
 use crate::update::new::document::{Document, DocumentContext};
 use crate::update::new::indexer::document_changes::{Extractor, IndexingContext};
 use crate::update::new::indexer::settings_change_extract;
 use crate::update::new::indexer::settings_changes::{
     DocumentsIndentifiers, SettingsChangeExtractor,
 };
+use crate::update::new::steps::IndexingStep;
 use crate::update::new::thread_local::{FullySend, ThreadLocal};
 use crate::update::new::{DocumentChange, DocumentIdentifiers};
 use crate::update::settings::SettingsDelta;
```

**File**: `crates/milli/src/update/new/extract/geo/mod.rs` (modified, +1/-1)
```diff
@@ -10,14 +10,14 @@ use serde_json::value::RawValue;
 use serde_json::Value;
 
 use crate::error::GeoError;
-use crate::update::new::steps::IndexingStep;
 use crate::update::new::document::{Document, DocumentContext};
 use crate::update::new::indexer::document_changes::{Extractor, IndexingContext};
 use crate::update::new::indexer::settings_change_extract;
 use crate::update::new::indexer::settings_changes::{
     DocumentsIndentifiers, SettingsChangeExtractor,
 };
 use crate::update::new::ref_cell_ext::RefCellExt as _;
+use crate::update::new::steps::IndexingStep;
 use crate::update::new::thread_local::{FullySend, MostlySend, ThreadLocal};
 use crate::update::new::{DocumentChange, DocumentIdentifiers};
 use crate::update::GrenadParameters;
```

**File**: `crates/milli/src/update/new/extract/searchable/extract_word_docids.rs` (modified, +1/-1)
```diff
@@ -10,7 +10,6 @@ use permissive_json_pointer::contained_in;
 use super::tokenize_document::{tokenizer_builder, DocumentTokenizer};
 use super::{match_searchable_field, OneOrTwoTokenizers};
 use crate::fields_ids_map::metadata::Metadata;
-use crate::update::new::steps::IndexingStep;
 use crate::update::new::document::DocumentContext;
 use crate::update::new::extract::cache::BalancedCaches;
 use crate::update::new::indexer::document_changes::{
@@ -20,6 +19,7 @@ use crate::update::new::indexer::settings_changes::{
     settings_change_extract, DocumentsIndentifiers, SettingsChangeExtractor,
 };
 use crate::update::new::ref_cell_ext::RefCellExt as _;
+use crate::update::new::steps::IndexingStep;
 use crate::update::new::thread_local::{FullySend, MostlySend, ThreadLocal};
 use crate::update::new::{DocumentChange, DocumentIdentifiers};
 use crate::update::settings::SettingsDelta;
```

**File**: `crates/milli/src/update/new/extract/searchable/extract_word_pair_proximity_docids.rs` (modified, +1/-1)
```diff
@@ -9,7 +9,6 @@ use super::tokenize_document::{tokenizer_builder, DocumentTokenizer};
 use crate::fields_ids_map::metadata::Metadata;
 use crate::proximity::ProximityPrecision::*;
 use crate::proximity::{index_proximity, MAX_DISTANCE};
-use crate::update::new::steps::IndexingStep;
 use crate::update::new::document::{Document, DocumentContext};
 use crate::update::new::extract::cache::BalancedCaches;
 use crate::update::new::extract::searchable::OneOrTwoTokenizers;
@@ -21,6 +20,7 @@ use crate::update::new::indexer::settings_changes::{
     DocumentsIndentifiers, SettingsChangeExtractor,
 };
 use crate::update::new::ref_cell_ext::RefCellExt as _;
+use crate::update::new::steps::IndexingStep;
 use crate::update::new::thread_local::{FullySend, ThreadLocal};
 use crate::update::new::{DocumentChange, DocumentIdentifiers};
 use crate::update::settings::SettingsDelta;
```

**File**: `crates/milli/src/update/new/indexer/document_changes.rs` (modified, +1/-1)
```diff
@@ -9,9 +9,9 @@ use roaring::RoaringBitmap;
 use super::super::document_change::DocumentChange;
 use crate::fields_ids_map::metadata::FieldIdMapWithMetadata;
 use crate::progress::{AtomicDocumentStep, Progress};
-use crate::update::new::steps::IndexingStep;
 use crate::update::new::document::DocumentContext;
 use crate::update::new::parallel_iterator_ext::ParallelIteratorExt as _;
+use crate::update::new::steps::IndexingStep;
 use crate::update::new::thread_local::{FullySend, MostlySend, ThreadLocal};
 use crate::update::GrenadParameters;
 use crate::{FieldsIdsMap, GlobalFieldsIdsMap, Index, InternalError, MustStopProcessing, Result};
```

**File**: `crates/milli/src/update/new/indexer/document_deletion.rs` (modified, +1/-1)
```diff
@@ -104,10 +104,10 @@ mod test {
     use crate::fields_ids_map::metadata::{FieldIdMapWithMetadata, MetadataBuilder};
     use crate::index::tests::TempIndex;
     use crate::progress::Progress;
-    use crate::update::new::steps::IndexingStep;
     use crate::update::new::document::DocumentContext;
     use crate::update::new::indexer::document_changes::{extract, Extractor, IndexingContext};
     use crate::update::new::indexer::DocumentDeletion;
+    use crate::update::new::steps::IndexingStep;
     use crate::update::new::thread_local::{MostlySend, ThreadLocal};
     use crate::update::new::DocumentChange;
     use crate::{DocumentId, MustStopProcessing};
```

---

### Incident Patch 10: `ed2ec35c` (2026-09-16)
**Commit Message**: Debug the received body

**File**: `crates/meilisearch/src/routes/mcp.rs` (modified, +1/-0)
```diff
@@ -93,6 +93,7 @@ async fn mcp(
     index_scheduler.features().check_mcp_route("calling the /mcp route")?;
 
     let body = body.into_inner();
+    tracing::debug!("MCP JSON-RPC body received: {:?}", body);
     let McpQuery { jsonrpc, id, method, params } = body;
 
     let response = match method.as_str() {
```

---

### Incident Patch 11: `b5e076ca` (2026-09-16)
**Commit Message**: Merge pull request #6619 from simpleqt/docs/fix-benchmarks-paths

docs: fix mailto typo, dead TOC anchor and grammar

**File**: `BENCHMARKS.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 Currently this repository hosts two kinds of benchmarks:
 
 1. The older "milli benchmarks", that use [criterion](https://github.com/bheisler/criterion.rs) and live in the "benchmarks" directory.
-2. The newer "bench" that are workload-based and so split between the [`workloads`](./workloads/) directory and the [`xtask::bench`](./xtask/src/bench/) module.
+2. The newer "bench" that are workload-based and so split between the [`workloads`](./workloads/) directory and the [`xtask::bench`](./crates/xtask/src/bench/) module.
 
 This document describes the newer "bench" benchmarks. For more details on the "milli benchmarks", see [benchmarks/README.md](./benchmarks/README.md).
 
```

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@ If Meilisearch does not offer optimized support for your language, please consid
 - [How to Contribute](#how-to-contribute)
 - [Development Workflow](#development-workflow)
 - [Git Guidelines](#git-guidelines)
-- [Release Process (for internal team only)](#release-process-for-internal-team-only)
+- [Release Process (for internal team only)](#publish-process-for-internal-team-only)
 
 ## Use of generative AI tools
 
@@ -238,7 +238,7 @@ This project uses GitHub Merge Queues that helps us manage pull requests merging
 Before merging a PR, the maintainer should ensure the following requirements are met
 - Automated tests have been added.
 - If some tests cannot be automated, manual rigorous tests should be applied.
-- ⚠️ If there is an change in the DB: it's mandatory to manually test the `--upgrade-db` on a DB of the previous Meilisearch minor version (e.g. v1.13 for the v1.14 release).
+- ⚠️ If there is a change in the DB: it's mandatory to manually test the `--upgrade-db` on a DB of the previous Meilisearch minor version (e.g. v1.13 for the v1.14 release).
 - If necessary, the feature have been tested in the Cloud production environment (with [prototypes](./documentation/prototypes.md)) and the Cloud UI is ready.
 - If necessary, the [documentation](https://github.com/meilisearch/documentation) related to the implemented feature in the PR is ready.
 - If necessary, the [integrations](https://github.com/meilisearch/integration-guides) related to the implemented feature in the PR are ready.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ Meilisearch is available in two editions:
 - Not allowed in production without a commercial agreement with Meilisearch.
   - You may use, modify, and distribute the Licensed Work for non-production purposes only, such as testing, development, or evaluation.
 
-Want access to Enterprise features? → Contact us at [sales@meilisearch.com](maito:sales@meilisearch.com).
+Want access to Enterprise features? → Contact us at [sales@meilisearch.com](mailto:sales@meilisearch.com).
 
 ### 📦 External crates
 
```

---

### Incident Patch 12: `87de28ac` (2026-09-16)
**Commit Message**: Fix the mcp route OpenAPI route definition

**File**: `crates/meilisearch/src/routes/mcp.rs` (modified, +40/-38)
```diff
@@ -10,7 +10,6 @@ use deserr::actix_web::{AwebJson, AwebQueryParameter};
 use deserr::{Deserr, IntoValue, Value, ValuePointerRef};
 use either::Either;
 use index_scheduler::IndexScheduler;
-use meilisearch_types::batch_view::BatchView;
 use meilisearch_types::deserr::{DeserrError, DeserrJson, DeserrJsonError};
 use meilisearch_types::error::deserr_codes::BadRequest;
 use meilisearch_types::error::Code::BadParameter;
@@ -62,39 +61,34 @@ macro_rules! r#try_or_internal_error {
 )]
 pub struct McpApi;
 
-/// Stream batches changes
+/// Model context protocol (MCP)
 ///
-/// The `/batches/stream` route returns information about [asynchronous operations](https://docs.meilisearch.com/learn/advanced/asynchronous_operations.html) (indexing, document updates, settings changes, and so on).
-///
-/// Batches are sent throught an SSE stream any time their progress or status changes, i.e., enqueued, processing, succeeded, failed.
+/// The `/mcp` route exposes [the MCP open protocol](https://modelcontextprotocol.io) that enables seamless integration between LLM
+/// applications and external data sources and tools.
 #[routes::path(
     security(),
     request_body = McpQuery,
     responses(
-        (status = 200, description = "Stream of batches changes.", body = BatchView, content_type = "application/x-ndjson", example = json!(
+        (status = 200, description = "Stream of batches changes.", body = McpResponse, content_type = "application/json", example = json!(
             {
-                "uid": 0,
-                "details": {
-                    "receivedDocuments": 1,
-                    "indexedDocuments": 1
-                },
-                "progress": null,
-                "stats": {
-                    "totalNbTasks": 1,
-                    "status": {
-                        "succeeded": 1
+                "jsonrpc": "2.0",
+                "id": 42,
+                "result": {
+                    "resultType": "complete",
+                    "supportedVersions": ["2026-07-28"],
+                    "capabilities": {
+                        "tools": {}
                     },
-                    "types": {
-                        "documentAdditionOrUpdate": 1
+                    "_meta": {
+                        "io.modelcontextprotocol/serverInfo": {
+                        "name": "Meilisearch",
+                        "version": "1.52.0"
+                        }
                     },
-                    "indexUids": {
-                        "INDEX_NAME": 1
-                    }
-                },
-                "duration": "PT0.364788S",
-                "startedAt": "2024-12-10T15:48:49.672141Z",
-                "finishedAt": "2024-12-10T15:48:50.036929Z",
-                "batchStrategy": "batched all enqueued tasks"
+                    "instructions": "This is a Meilisearch instance that is capable of returning documents based on a search query.",
+                    "ttlMs": 3_600_000,
+                    "cacheScope": "public"
+                }
             }
         )),
         (status = 401, description = "The authorization header is missing.", body = ResponseError, content_type = "application/json", example = json!(
@@ -680,13 +674,18 @@ impl utoipa::PartialSchema for RequestId {
     }
 }
 
-#[derive(Debug, Serialize)]
+#[derive(Debug, Serialize, ToSchema)]
 #[serde(rename_all = "camelCase")]
+#[schema(rename_all = "camelCase")]
 pub struct McpResponse {
+    /// The JSON-RPC version.
     jsonrpc: String,
+    /// The JSON-RPC request ID.
     id: RequestId,
+    /// The JSON-RPC result.
     #[serde(skip_serializing_if = "Option::is_none")]
     result: Option<McpResult>,
+    /// The JSON-RPC error.
     #[serde(skip_serializing_if = "Option::is_none")]
     error: Option<McpError>,
 }
@@ -698,8 +697,9 @@ impl routes::RequestBody for RequestId {}
 const RESULT_TYPE_COMPLETE: &str = "complete";
 const SUPPORTED_VERSIONS: &[&str] = &["2026-07-28"];
 
-#[derive(Debug, Serialize)]
+#[derive(Debug, Serialize, ToSchema)]
 #[serde(rename_all = "camelCase")]
+#[schema(rename_all = "camelCase")]
 pub struct McpResult {
     result_type: &'static str, // "complete", "input_required"
     #[serde(skip_serializing_if = "Option::is_none")]
@@ -711,10 +711,10 @@ pub struct McpResult {
     tools: Option<Vec<McpToolDefinition>>,
     // Note that for now we will simply return an empty list of resources
     #[serde(skip_serializing_if = "Option::is_none")]
-    resources: Option<Vec<()>>,
-    // Note that for now we will simply return an empty list of prompt
+    resources: Option<Vec<serde_json::Value>>,
+    // Note that for now we will simply return an empty list of prompts
     #[serde(skip_serializing_if = "Option::is_none")]
-    prompts: Option<Vec<()>>,
+    prompts: Option<Vec<serde_json::Value>>,
     #[serde(rename = "_meta", skip_serializing_if = "Option::is_none")]
     meta: Option<McpServerMeta>,
     /// Capabilities the server supports (tools, r
```

---

### Incident Patch 13: `bae5f565` (2026-09-15)
**Commit Message**: Merge pull request #6626 from meilisearch/fix-error-code-descriptions

Fix grammar and broken Markdown links in error code descriptions

**File**: `crates/meilisearch-types/src/error.rs` (modified, +8/-8)
```diff
@@ -210,7 +210,7 @@ ApiKeyNotFound                                 , InvalidRequest       , NOT_FOUN
 r#"The requested API key could not be found."# ;
 
 IndexScopedApiKeyWithGlobalAction              , InvalidRequest       , BAD_REQUEST,
-r#"This errors occurs when calling an endpoint that requires a global API key with an API key that is scoped to a subset of index.
+r#"This error occurs when calling an endpoint that requires a global API key with an API key that is scoped to a subset of indexes.
 
 Call the endpoint with an API key that has `"indexes": ["*"]`
 "#;
@@ -398,7 +398,7 @@ InvalidDocumentRetrieve                     , InvalidRequest       , BAD_REQUEST
 "This error code is no longer emitted and can be found in tasks imported from a dump created using a previous version of Meilisearch.";
 
 InvalidDocumentGeoField                        , InvalidRequest       , BAD_REQUEST,
-"The provided `_geo` field of one or more documents is invalid. Meilisearch expects `_geo` to be an object with two fields, `lat` and `lng`, each containing geographic coordinates expressed as a string or floating point number. Read more about `_geo` and how to troubleshoot it in [our dedicated guide](/capabilities/geo_search/getting_started)." ;
+"The provided `_geo` field of one or more documents is invalid. Meilisearch expects `_geo` to be an object with two fields, `lat` and `lng`, each containing geographic coordinates expressed as a string or floating-point number. Read more about `_geo` and how to troubleshoot it in [our dedicated guide](/capabilities/geo_search/getting_started)." ;
 
 InvalidDocumentGeojsonField                    , InvalidRequest       , BAD_REQUEST,
 "The `geojson` field in one or more documents is invalid or doesn't match the [GeoJSON specification](https://datatracker.ietf.org/doc/html/rfc7946)." ;
@@ -487,7 +487,7 @@ InvalidMultiSearchQueryFacets                  , InvalidRequest       , BAD_REQU
 "A query in the queries array contains `facets` when federation is present and non-`null`." ;
 
 InvalidMultiSearchDistinct                     , InvalidRequest       , BAD_REQUEST,
-"This error occurs when both `federation.distinct` and `distinct` inside of a queries are specified. Remove one of these parameters" ;
+"This error occurs when both `federation.distinct` and the `distinct` parameter of a query are specified. Remove one of these parameters." ;
 
 InvalidMultiSearchQueryPagination              , InvalidRequest       , BAD_REQUEST,
 "A multi-search query contains `page`, `hitsPerPage`, `limit` or `offset`, but the top-level federation object is not `null`." ;
@@ -696,7 +696,7 @@ InvalidSearchPersonalize                       , InvalidRequest       , BAD_REQU
  "The [`personalizeUserContext`](/reference/api/search/search-with-get#parameter-personalize-user-context) query parameter is invalid. It should be a string" ;
 
 InvalidSearchMediaAndVector                    , InvalidRequest       , BAD_REQUEST,
-"The search query contains non-`null` values for both [`media`](/reference/api/search/search-with-post#body-media) and [`vector`](/reference/api/search/search-with-post#body-media). These two parameters are mutually exclusive, since `media` generates vector embeddings via the embedder configured in `hybrid`." ;
+"The search query contains non-`null` values for both [`media`](/reference/api/search/search-with-post#body-media) and [`vector`](/reference/api/search/search-with-post#body-vector-one-of-0). These two parameters are mutually exclusive, since `media` generates vector embeddings via the embedder configured in `hybrid`." ;
 
 InvalidSettingsDisplayedAttributes             , InvalidRequest       , BAD_REQUEST,
 "The value of [displayed attributes](/capabilities/full_text_search/how_to/configure_displayed_attributes#displayed-fields) is invalid. It should be an empty array, an array of strings, or set to `null`." ;
@@ -705,7 +705,7 @@ InvalidSettingsDistinctAttribute               , InvalidRequest       , BAD_REQU
 "The value of [distinct attributes](/capabilities/full_text_search/how_to/configure_distinct_attribute) is invalid. It should be a string or set to `null`." ;
 
 InvalidSettingsProximityPrecision              , InvalidRequest       , BAD_REQUEST,
-"[`proximityPrecision`](/reference/api/settings/update-proximityprecision#update-proximityprecision) does not have one of allowed values" ;
+"[`proximityPrecision`](/reference/api/settings/update-proximityprecision#update-proximityprecision) does not have one of the allowed values." ;
 
 InvalidSettingsFacetSearch                     , InvalidRequest       , BAD_REQUEST,
 "The [`facetSearch`](/reference/api/settings/get-facetsearch) index setting value is invalid." ;
@@ -1038,7 +1038,7 @@ UnimplementedMultiChoiceChatCompletions        , InvalidRequest       , NOT_IMPL
 "Unsupported value of the `n` parameter. The only supported value is `1`." ;
 
 ChatNotFound                                   , InvalidRequest       , NOT_FOUND,
-"The
```

---

### Incident Patch 14: `f1a16e23` (2026-09-15)
**Commit Message**: Fix nested filter error message change

**File**: `crates/meilisearch/src/documents_retrieval/preprocessing.rs` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ fn extract_foreign_filters(
             // convert inner foreign filter into an index filter, throw an error if there is a nested foreign filter
             let index_filter =
                 IndexFilter::from_filter_without_foreign(Filter { condition: op.clone() })
-                    .map_err(|(fid, _)| {
+                    .map_err(|(_, _)| {
                         let error =
                             fid.to_external_error("Nested foreign filters are not supported");
                         milli::Error::from(error)
```

---

### Incident Patch 15: `f36ffb94` (2026-09-15)
**Commit Message**: fix PR comments

**File**: `crates/meilisearch/src/routes/dynamic_search_rules.rs` (modified, +2/-2)
```diff
@@ -382,8 +382,8 @@ fn check_rule(rule: &DynamicSearchRuleUpdateRequest) -> Result<(), ResponseError
 
                 let _ = IndexFilter::from_filter_without_foreign(filter).map_err(|(fid, _)| {
                     let err = fid.to_external_error(
-                    "filter condition `_foreign` is not supported in dynamic search rule actions.",
-                );
+                        "filter condition `_foreign` is not supported in dynamic search rule actions.",
+                    );
                     ResponseError::from_msg(
                         format!("invalid `.actions.scale[{action_index}].filter`: {err}"),
                         Code::InvalidDynamicSearchRuleActions,
```

**File**: `crates/milli/src/dynamic_search_rules/action.rs` (modified, +7/-3)
```diff
@@ -1,5 +1,3 @@
-use std::ops::Not as _;
-
 use roaring::RoaringBitmap;
 
 use crate::dynamic_search_rules::{fields, DsrFuel, DynamicSearchRulesView, RuleId};
@@ -228,6 +226,8 @@ impl ScaleAction {
         }
 
         Ok(match (&self.ids, &self.filter) {
+            // note: this case is not supposed to happen, because a rule without ids OR filter is rejected by the route.
+            // however, should it still happen due to a bug, the behavior here (no document) is a reasonable fallback.
             (None, None) => None,
             (None, Some(filter)) => {
                 let Ok(filter) = Filter::from_json(filter) else {
@@ -258,7 +258,11 @@ impl ScaleAction {
             }
             (Some(ids), None) => {
                 let candidates = candidates_from_ids(search_context, ids)?;
-                candidates.is_empty().not().then_some(candidates)
+                if candidates.is_empty() {
+                    None
+                } else {
+                    Some(candidates)
+                }
             }
             (Some(ids), Some(filter)) => {
                 let mut candidates = candidates_from_ids(search_context, ids)?;
```

**File**: `crates/milli/src/dynamic_search_rules/mod.rs` (modified, +8/-0)
```diff
@@ -133,6 +133,9 @@ impl<'a> DynamicSearchRulesView<'a> {
         let active_rules =
             self.active_rules_for_query(query_terms, filter, search_context, fuel)?;
 
+        // this used to be a flattened iterator of pin iterators.
+        // however we can no longer flatten because we have an iterator of `(pin_iterator, scale_iterator)`
+        // so we are using an explicit loop
         let mut pins = Vec::new();
         let mut scales = Vec::new();
 
@@ -151,6 +154,11 @@ impl<'a> DynamicSearchRulesView<'a> {
                     break;
                 }
                 let pin = pin?;
+                // this removal serves 2 simultaneous purposes:
+                // 1. make sure that the pinned document cannot appear in the organic results
+                // 2. make sure that the pinned document is initially part of the candidates post-filter: this is a security property
+                // of pinning that you cannot use pinning to pin documents that are not part of the current filter. This is to prevent,
+                // for example, unexpected interactions with tenant tokens.
                 if universe.remove(pin.id) {
                     pins.push(pin);
                 }
```

**File**: `crates/milli/src/score_details.rs` (modified, +8/-0)
```diff
@@ -220,6 +220,11 @@ impl ScoreDetails {
         std::iter::from_fn(move || {
             details
                 .by_ref()
+                // any scale detail modifies the weight starting from this action,
+                // meaning that a hypothetical score details iterator with some relevancy rules before the scale
+                // detail would have the base weight and not the weight modified by the scale.
+                // In practice, the search implementation guarantees that scale is the first score detail, and as a result
+                // the weight is applied to all relevancy rules.
                 .inspect(|detail| {
                     if let ScoreDetails::Scale { actions } = detail {
                         for action in actions {
@@ -251,6 +256,9 @@ impl ScoreDetails {
         // define a cell that will keep the current weight, and capture it in a from_fn closure to keep the state
         // throughout the entire iteration
         let weight = std::cell::Cell::new(weight);
+        // record whether there has been at least one relevancy rule.
+        // this allows weight to be effective even if there is no relevancy rule: one final score is then inserted taking into account
+        // the current weight.
         let used_weight = std::cell::Cell::new(false);
 
         std::iter::from_fn(move || {
```

**File**: `crates/milli/src/update/new/indexer/document_updater.rs` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@ pub trait DocumentUpdater {
     fn update<'doc, T, D>(
         &self,
         context: &'doc DocumentContext<T>,
-        docid: u32,
+        docid: DocumentId,
         current: D,
     ) -> Result<Option<DocumentChange<'doc>>>
     where
@@ -41,7 +41,7 @@ where
     fn update<'doc, T, D>(
         &self,
         context: &'doc DocumentContext<T>,
-        docid: u32,
+        docid: DocumentId,
         current: D,
     ) -> Result<Option<DocumentChange<'doc>>>
     where
@@ -57,7 +57,7 @@ where
 }
 
 pub struct DocumentUpdateChanges<U: DocumentUpdater> {
-    documents: Vec<u32>,
+    documents: Vec<DocumentId>,
     updater: U,
 }
 
```

#### Recent Merged Pull Requests:
- **PR #6667** (2026-10-05): Fix OpenAPI docs (@curquiza)
- **PR #6663** (2026-10-05): Add GHA to enforce benchmarks label on each PR (@curquiza)
- **PR #6661** (2026-10-05): Fix ranking score threshold performances (@ManyTheFish)
- **PR #6660** (2026-10-01): Replace mimalloc with jemalloc + patch heed, v52 edition (@dureuill)
- **PR #6659** (2026-10-01): Replace mimalloc with jemalloc + patch heed, v53 edition (@dureuill)
- **PR #6658** (2026-10-01): Replace mimalloc with jemalloc + patch heed, v54 edition (@dureuill)
- **PR #6652** (2026-09-29): Bring back v1.54.2 changes to main (@dureuill)
- **PR #6651** (2026-09-29): Fix task queue following upgrade to v1.54 when using DSRs (@dureuill)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
