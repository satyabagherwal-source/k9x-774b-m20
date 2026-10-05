# Forensic Learning Record (Deep Inspection): databendlabs/databend

> **Canonical Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:04:01.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 9453 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/bendpy/src/utils.rs`
```
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::future::Future;

use ctor::ctor;
use pyo3::prelude::*;
use tokio::runtime::Runtime;

#[ctor]
pub(crate) static RUNTIME: Runtime = tokio::runtime::Builder::new_multi_thread()
    .enable_all()
    .build()
    .unwrap();

/// Utility to collect rust futures with GIL released
pub fn wait_for_future<F>(py: Python, f: F) -> F::Output
where
    F: Future + Send,
    F::Output: Send,
{
    py.detach(|| RUNTIME.block_on(f))
}

```

### Core Architecture Module: `src/bendsave/src/utils.rs`
```
// Copyright 2023 Databend Cloud
//
// Licensed under the Elastic License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.elastic.co/licensing/elastic-license
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use anyhow::Result;
use futures::SinkExt;
use futures::StreamExt;
use log::info;
use opendal::Operator;

/// The backup path for databend meta.
pub static DATABEND_META_BACKUP_PATH: &str = "databend_meta.db";

/// Copy the entire storage from one operator to another.
pub async fn storage_copy(src: Operator, dst: Operator) -> Result<()> {
    let mut list = src.lister_with("/").recursive(true).await?;
    while let Some(entry) = list.next().await.transpose()? {
        if entry.metadata().is_dir() {
            continue;
        }

        let src_meta = src.stat(entry.path()).await?;

        // Skip if the file is already exists.
        if let Ok(dst_meta) = dst.stat(entry.path()).await {
            if src_meta.content_length() == dst_meta.content_length()
                && src_meta.etag() == dst_meta.etag()
            {
                continue;
            }
        }

        let mut stream = src
            .reader_with(entry.path())
            .chunk(8 * 1024 * 1024)
            .await?
            .into_bytes_stream(..)
            .await?;

        let mut file = dst
            .writer_with(entry.path())
            .chunk(8 * 1024 * 1024)
            .await?
            .into_bytes_sink();
        file.send_all(&mut stream).await?;
        file.close().await?;
        info!("file {} has been copied", entry.path());
    }
    info!("storage copy has been finished");
    Ok(())
}

```

### Core Architecture Module: `src/common/base/src/runtime/memory/alloc_error_hook.rs`
```
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::cell::Cell;

use crate::runtime::LimitMemGuard;
use crate::runtime::ThreadTracker;

thread_local! {
    static ALLOC_ERROR_PANIC: Cell<bool> = const { Cell::new(false) };
}

fn mark_alloc_error_panic() {
    ALLOC_ERROR_PANIC.with(|flag| flag.set(true));
}

#[cfg(test)]
pub(crate) fn mark_alloc_error_panic_for_test() {
    mark_alloc_error_panic();
}

pub fn take_alloc_error_panic() -> bool {
    ALLOC_ERROR_PANIC.with(|flag| flag.replace(false))
}

pub fn is_alloc_error_panic() -> bool {
    ALLOC_ERROR_PANIC.with(|flag| flag.get())
}

pub fn set_alloc_error_hook() {
    std::alloc::set_alloc_error_hook(|layout| {
        let _guard = LimitMemGuard::enter_unlimited();

        let out_of_limit_desc = ThreadTracker::replace_error_message(None);
        mark_alloc_error_panic();

        panic!(
            "{}",
            out_of_limit_desc
                .unwrap_or_else(|| format!("memory allocation of {} bytes failed", layout.size()))
        );
    })
}

```

### Core Architecture Module: `src/common/cloud_control/src/notification_utils.rs`
```
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use chrono::DateTime;
use chrono::Utc;
use databend_common_exception::ErrorCode;
use databend_common_exception::Result;
use serde::Deserialize;
use serde::Serialize;

pub fn get_notification_type(raw_type: &str) -> Result<crate::pb::NotificationType> {
    match raw_type.to_lowercase().as_str() {
        "webhook" => Ok(crate::pb::NotificationType::Webhook),
        _ => Err(ErrorCode::IllegalCloudControlMessageFormat(
            "Invalid notification type",
        )),
    }
}
pub enum NotificationParams {
    Webhook(WebhookNotification),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebhookNotification {
    pub url: String,
    pub method: Option<String>,
    pub authorization_header: Option<String>,
    /// `WEBHOOK_BODY_TEMPLATE`. Absent when not configured or when talking to a
    /// Cloud Control that predates the field, so it is omitted from the
    /// serialized `webhook_options` rather than shown as null.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_template: Option<String>,
}

pub struct Notification {
    pub tenant_id: String,
    pub name: String,
    pub id: u64,
    pub enabled: bool,
    pub params: NotificationParams,
    pub comments: Option<String>,
    pub created_time: DateTime<Utc>,
    pub updated_time: DateTime<Utc>,
}

pub fn parse_timestamp(timestamp: Option<crate::utils::Timestamp>) -> Result<DateTime<Utc>> {
    match timestamp {
        Some(ts) => {
            let seconds = ts.seconds;
            let nanos = ts.nanos;
            let dt = DateTime::<Utc>::from_timestamp(seconds, nanos as u32);
            if dt.is_none() {
                return Err(ErrorCode::IllegalCloudControlMessageFormat(
                    "Invalid timestamp, parsed datetime is none",
                ));
            }
            Ok(dt.unwrap())
        }
        None => Err(ErrorCode::IllegalCloudControlMessageFormat(
            "Invalid timestamp",
        )),
    }
}

impl TryFrom<crate::pb::Notification> for Notification {
    type Error = ErrorCode;

    fn try_from(notification: crate::pb::Notification) -> Result<Self> {
        match crate::pb::NotificationType::try_from(notification.notification_type) {
            Ok(crate::pb::NotificationType::Webhook) => {
                Ok(Notification {
                    tenant_id: notification.tenant_id,
                    name: notification.name,
                    id: notification.notification_id,
                    enabled: notification.enabled,
                    params: NotificationParams::Webhook(WebhookNotification {
                        url: notification.webhook_url,
                        method: notification.webhook_method,
                        authorization_header: notification.webhook_authorization_header,
                        body_template: notification.webhook_body_template,
                    }),
                    comments: notification.comments,
                    // convert timestamp to DateTime
                    created_time: parse_timestamp(notification.created_time)?,
                    updated_time: parse_timestamp(notification.updated_time)?,
                })
            }
            _ => Err(ErrorCode::IllegalCloudControlMessageFormat(
                "Unimplemented notification type",
            )),
        }
    }
}

pub struct NotificationHistory {
    pub created_time: DateTime<Utc>,
    pub processed_time: Option<DateTime<Utc>>,
    pub message_source: String,
    pub name: String,
    pub message: String,
    pub status: String,
    pub error_message: String,
}

impl TryFrom<crate::pb::NotificationHistory> for NotificationHistory {
    type Error = ErrorCode;

    fn try_from(history: crate::pb::NotificationHistory) -> Result<Self> {
        Ok(NotificationHistory {
            created_time: parse_timestamp(history.created_time)?,
            processed_time: match history.processed_time {
                Some(ts) => Some(parse_timestamp(Some(ts))?),
                None => None,
            },
            message_source: history.message_source,
            name: history.name,
            message: history.message,
            status: history.status,
            error_message: history.error_message,
        })
    }
}

```

### Core Architecture Module: `src/common/cloud_control/src/task_utils.rs`
```
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::collections::BTreeMap;
use std::fmt::Display;
use std::fmt::Formatter;

use chrono::DateTime;
use chrono::FixedOffset;
use chrono::Utc;
use databend_common_exception::ErrorCode;
use databend_common_exception::Result;

use crate::pb::ScheduleOptions;
use crate::pb::WarehouseOptions;
use crate::pb::schedule_options::ScheduleType;

#[derive(Debug, Clone, PartialEq)]
pub enum Status {
    Suspended = 0,
    Started = 1,
}

impl Display for Status {
    fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
        match *self {
            Status::Suspended => write!(f, "Suspended"),
            Status::Started => write!(f, "Started"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum State {
    SCHEDULED = 0,
    EXECUTING = 1,
    SUCCEEDED = 2,
    FAILED = 3,
    CANCELLED = 4,
}

impl Display for State {
    fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
        match *self {
            State::SCHEDULED => write!(f, "SCHEDULED"),
            State::EXECUTING => write!(f, "EXECUTING"),
            State::SUCCEEDED => write!(f, "SUCCEEDED"),
            State::FAILED => write!(f, "FAILED"),
            State::CANCELLED => write!(f, "CANCELLED"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Task {
    pub task_id: u64,
    pub task_name: String,
    pub query_text: String,
    pub condition_text: String,
    pub after: Vec<String>,
    pub comment: Option<String>,
    pub owner: String,
    pub schedule_options: Option<String>,
    pub warehouse_options: Option<WarehouseOptions>,
    pub next_scheduled_at: Option<DateTime<Utc>>,
    pub suspend_task_after_num_failures: Option<i32>,
    pub error_integration: Option<String>,
    pub status: Status,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_suspended_at: Option<DateTime<Utc>>,
    pub session_params: BTreeMap<String, String>,
}

pub fn format_schedule_options(s: &ScheduleOptions) -> Result<String> {
    let schedule_type = match s.schedule_type {
        0 => ScheduleType::IntervalType,
        1 => ScheduleType::CronType,
        s => {
            return Err(ErrorCode::IllegalCloudControlMessageFormat(format!(
                "Illegal schedule type {s}"
            )));
        }
    };
    match schedule_type {
        ScheduleType::IntervalType => {
            if s.milliseconds_interval.is_some() {
                return Ok(format!(
                    "INTERVAL {} SECOND {} MILLISECOND",
                    s.interval.unwrap_or_default(),
                    s.milliseconds_interval.unwrap_or_default(),
                ));
            }
            Ok(format!(
                "INTERVAL {} SECOND",
                s.interval.unwrap_or_default(),
            ))
        }
        ScheduleType::CronType => {
            if s.cron.is_none() {
                return Err(ErrorCode::IllegalCloudControlMessageFormat(
                    "cron expression schedule has null value",
                ));
            }
            let mut res = String::new();
            res.push_str(format!("CRON {}", s.cron.clone().unwrap()).as_str());
            if let Some(timezone) = s.time_zone.as_ref() {
                res.push_str(format!(" TIMEZONE {}", timezone).as_str());
            }
            Ok(res)
        }
    }
}

// convert from crate::pb::task to struct task
impl TryFrom<crate::pb::Task> for Task {
    type Error = ErrorCode;

    fn try_from(value: crate::pb::Task) -> Result<Self> {
        let status = match value.status {
            0 => Status::Suspended,
            1 => Status::Started,
            s => {
                return Err(ErrorCode::IllegalCloudControlMessageFormat(format!(
                    "Illegal status code {s}"
                )));
            }
        };

        let created_at = DateTime::parse_from_rfc3339(&value.created_at)
            .map_err(|e| {
                ErrorCode::IllegalCloudControlMessageFormat(format!(
                    "illegal created_at message {}, {e}",
                    value.created_at
                ))
            })?
            .with_timezone(&Utc);
        let updated_at = DateTime::parse_from_rfc3339(&value.updated_at)
            .map_err(|e| {
                ErrorCode::IllegalCloudControlMessageFormat(format!(
                    "illegal updated_at message {}, {e}",
                    value.updated_at
                ))
            })?
            .with_timezone(&Utc);

        let next_scheduled_at = value
            .next_scheduled_at
            .as_ref()
            .map(|s| {
                DateTime::parse_from_rfc3339(s)
                    .map_err(|e| {
                        ErrorCode::IllegalCloudControlMessageFormat(format!(
                            "illegal next_scheduled_at message {:?}, {e}",
                            value.next_scheduled_at
                        ))
                    })
                    .map(|d: DateTime<FixedOffset>| d.with_timezone(&Utc))
            })
            .transpose()?;

        let last_suspended_at = value
            .last_suspended_at
            .as_ref()
            .map(|s| {
                DateTime::parse_from_rfc3339(s)
                    .map_err(|e| {
                        ErrorCode::IllegalCloudControlMessageFormat(format!(
                            "illegal next_scheduled_at message {:?}, {e}",
                            value.last_suspended_at
                        ))
                    })
                    .map(|d: DateTime<FixedOffset>| d.with_timezone(&Utc))
            })
            .transpose()?;
        let schedule = match value.schedule_options {
            None => None,
            Some(ref s) => {
                if !value.after.is_empty() {
                    None
                } else {
                    let r = format_schedule_options(s).map_err(|e| {
                        ErrorCode::IllegalCloudControlMessageFormat(format!(
                            "illegal schedule options {:?}, {e}",
                            value.schedule_options
                        ))
                    })?;
                    Some(r)
                }
            }
        };
        let t = Task {
            task_id: value.task_id,
            task_name: value.task_name,
            query_text: value.query_text,
            condition_text: value.when_condition.unwrap_or_default(),
            after: value.after,
            comment: value.comment,
            owner: value.owner,
            schedule_options: schedule,
            warehouse_options: value.warehouse_options,
            next_scheduled_at,
            last_suspended_at,
            suspend_task_after_num_failures: value.suspend_task_after_num_failures,
            error_integration: value.error_integration,
            status,
            created_at,
            updated_at,
            session_params: value.session_parameters,
        };
        Ok(t)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TaskRun {
    pub task_id: u64,
    pub task_name: String,
    pub query_text: String,
    pub condition_text: String,
    pub comment: Option<String>,
    pub owner: String,
    pub run_id: String,
    pub query_id: String,
    pub schedule_options: Option<String>,
    pub warehouse_options: Option<WarehouseOptions>,
    pub attempt_number: i32,
    pub state: State,
    pub scheduled_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_code: i64,
    pub error_message: Option<String>,
    pub root_task_id: String,
    pub session_params: BTreeMap<String, String>,
}

// convert from crate::pb::taskRun to struct taskRun
impl TryFrom<crate::pb::TaskRun> for TaskRun {
    type Error = ErrorCode;

    fn try_from(value: crate::pb::TaskRun) -> Result<Self> {
        let state = match value.state {
            0 => State::SCHEDULED,
            1 => State::EXECUTING,
            2 => State::SUCCEEDED,
            3 => State::FAILED,
            4 => State::CANCELLED,
            s => {
                return Err(ErrorCode::IllegalCloudControlMessageFormat(format!(
                    "Illegal state code {s}"
                )));
            }
        };

        let scheduled_at = DateTime::parse_from_rfc3339(&value.scheduled_time)
            .map_err(|e| {
                ErrorCode::IllegalCloudControlMessageFormat(format!(
                    "illegal scheduled_at message {}, {e}",
                    value.scheduled_time
                ))
            })?
            .with_timezone(&Utc);

        let completed_at = value
            .completed_time
            .as_ref()
            .map(|s| {
                DateTime::parse_from_rfc3339(s)
                    .map_err(|e| {
                        ErrorCode::IllegalCloudControlMessageFormat(format!(
                            "illegal completed_time message {:?}, {e}",
                            value.completed_time
                        ))
                    })
                    .map(|d| d.with_timezone(&Utc))
            })
            .transpose()?;

        let schedule = match value.schedule_options {
            None => None,
            Some(ref s) => {
                if value.task_id.to_string() != value.root_task_id {
                    None
                } else {
                    let r = format_schedule_options(s).map_err(|e| {
                        ErrorCode::IllegalCloudCon
```

### Core Architecture Module: `src/common/cloud_control/src/worker_client.rs`
```
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::sync::Arc;

use tonic::Request;
use tonic::transport::Channel;

use crate::pb::AlterWorkerRequest;
use crate::pb::AlterWorkerResponse;
use crate::pb::CreateWorkerRequest;
use crate::pb::CreateWorkerResponse;
use crate::pb::DropWorkerRequest;
use crate::pb::DropWorkerResponse;
use crate::pb::ListWorkersRequest;
use crate::pb::ListWorkersResponse;
use crate::pb::worker_service_client::WorkerServiceClient;

pub(crate) const WORKER_CLIENT_VERSION: &str = "v1";
pub(crate) const WORKER_CLIENT_VERSION_NAME: &str = "WORKER_CLIENT_VERSION";

pub struct WorkerClient {
    pub client: WorkerServiceClient<Channel>,
}

impl WorkerClient {
    pub async fn new(channel: Channel) -> databend_common_exception::Result<Arc<WorkerClient>> {
        let client = WorkerServiceClient::new(channel);
        Ok(Arc::new(WorkerClient { client }))
    }

    pub async fn create_worker(
        &self,
        req: Request<CreateWorkerRequest>,
    ) -> databend_common_exception::Result<CreateWorkerResponse> {
        let mut client = self.client.clone();
        let resp = client.create_worker(req).await?;
        Ok(resp.into_inner())
    }

    pub async fn alter_worker(
        &self,
        req: Request<AlterWorkerRequest>,
    ) -> databend_common_exception::Result<AlterWorkerResponse> {
        let mut client = self.client.clone();
        let resp = client.alter_worker(req).await?;
        Ok(resp.into_inner())
    }

    pub async fn drop_worker(
        &self,
        req: Request<DropWorkerRequest>,
    ) -> databend_common_exception::Result<DropWorkerResponse> {
        let mut client = self.client.clone();
        let resp = client.drop_worker(req).await?;
        Ok(resp.into_inner())
    }

    pub async fn list_workers(
        &self,
        req: Request<ListWorkersRequest>,
    ) -> databend_common_exception::Result<ListWorkersResponse> {
        let mut client = self.client.clone();
        let resp = client.list_workers(req).await?;
        Ok(resp.into_inner())
    }
}

```

### Core Architecture Module: `src/common/column/src/bitmap/utils/chunk_iterator/chunks_exact.rs`
```
// Copyright 2020-2022 Jorge C. Leitão
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::convert::TryInto;
use std::iter::TrustedLen;
use std::slice::ChunksExact;

use super::BitChunk;
use super::BitChunkIterExact;
/// An iterator over a slice of bytes in [`BitChunk`]s.
#[derive(Debug)]
pub struct BitChunksExact<'a, T: BitChunk> {
    iter: ChunksExact<'a, u8>,
    remainder: &'a [u8],
    remainder_len: usize,
    phantom: std::marker::PhantomData<T>,
}

impl<'a, T: BitChunk> BitChunksExact<'a, T> {
    /// Creates a new [`BitChunksExact`].
    #[inline]
    pub fn new(bitmap: &'a [u8], length: usize) -> Self {
        assert!(length <= bitmap.len() * 8);
        let size_of = std::mem::size_of::<T>();

        let bitmap = &bitmap[..length.saturating_add(7) / 8];

        let split = (length / 8 / size_of) * size_of;
        let (chunks, remainder) = bitmap.split_at(split);
        let remainder_len = length - chunks.len() * 8;
        let iter = chunks.chunks_exact(size_of);

        Self {
            iter,
            remainder,
            remainder_len,
            phantom: std::marker::PhantomData,
        }
    }

    /// Returns the number of chunks of this iterator
    #[inline]
    pub fn len(&self) -> usize {
        self.iter.len()
    }

    /// Returns whether there are still elements in this iterator
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Returns the remaining [`BitChunk`]. It is zero iff `len / 8 == 0`.
    #[inline]
    pub fn remainder(&self) -> T {
        let remainder_bytes = self.remainder;
        if remainder_bytes.is_empty() {
            return T::zero();
        }
        let remainder = match remainder_bytes.try_into() {
            Ok(a) => a,
            Err(_) => {
                let mut remainder = T::zero().to_ne_bytes();
                remainder_bytes
                    .iter()
                    .enumerate()
                    .for_each(|(index, b)| remainder[index] = *b);
                remainder
            }
        };
        T::from_ne_bytes(remainder)
    }
}

impl<T: BitChunk> Iterator for BitChunksExact<'_, T> {
    type Item = T;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        self.iter.next().map(|x| match x.try_into() {
            Ok(a) => T::from_ne_bytes(a),
            Err(_) => unreachable!(),
        })
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
}

unsafe impl<T: BitChunk> TrustedLen for BitChunksExact<'_, T> {}

impl<T: BitChunk> BitChunkIterExact<T> for BitChunksExact<'_, T> {
    #[inline]
    fn remainder(&self) -> T {
        self.remainder()
    }

    #[inline]
    fn remainder_len(&self) -> usize {
        self.remainder_len
    }
}

```

### Core Architecture Module: `src/common/column/src/bitmap/utils/chunk_iterator/merge.rs`
```
// Copyright 2020-2022 Jorge C. Leitão
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use super::BitChunk;

/// Merges 2 [`BitChunk`]s into a single [`BitChunk`] so that the new items represents
/// the bitmap where bits from `next` are placed in `current` according to `offset`.
/// # Panic
/// The caller must ensure that `0 < offset < size_of::<T>() * 8`
/// # Example
/// ```rust,ignore
/// let current = 0b01011001;
/// let next    = 0b01011011;
/// let result = merge_reversed(current, next, 1);
/// assert_eq!(result, 0b10101100);
/// ```
#[inline]
pub fn merge_reversed<T>(mut current: T, mut next: T, offset: usize) -> T
where T: BitChunk {
    // 8 _bits_:
    // current = [c0, c1, c2, c3, c4, c5, c6, c7]
    // next =    [n0, n1, n2, n3, n4, n5, n6, n7]
    // offset = 3
    // expected = [n5, n6, n7, c0, c1, c2, c3, c4]

    // 1. unset most significants of `next` up to `offset`
    let inverse_offset = std::mem::size_of::<T>() * 8 - offset;
    next <<= inverse_offset;
    // next    =  [n5, n6, n7, 0 , 0 , 0 , 0 , 0 ]

    // 2. unset least significants of `current` up to `offset`
    current >>= offset;
    // current =  [0 , 0 , 0 , c0, c1, c2, c3, c4]

    current | next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_reversed() {
        let current = 0b00000000;
        let next = 0b00000001;
        let result = merge_reversed::<u8>(current, next, 1);
        assert_eq!(result, 0b10000000);

        let current = 0b01011001;
        let next = 0b01011011;
        let result = merge_reversed::<u8>(current, next, 1);
        assert_eq!(result, 0b10101100);
    }

    #[test]
    fn test_merge_reversed_offset2() {
        let current = 0b00000000;
        let next = 0b00000001;
        let result = merge_reversed::<u8>(current, next, 3);
        assert_eq!(result, 0b00100000);
    }
}

```

### Core Architecture Module: `src/common/column/src/bitmap/utils/chunk_iterator/mod.rs`
```
// Copyright 2020-2022 Jorge C. Leitão
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::convert::TryInto;
use std::iter::TrustedLen;

mod chunks_exact;
mod merge;

pub use chunks_exact::BitChunksExact;
pub(crate) use merge::merge_reversed;

pub use crate::types::BitChunk;
use crate::types::BitChunkIter;

/// Trait representing an exact iterator over bytes in [`BitChunk`].
pub trait BitChunkIterExact<B: BitChunk>: TrustedLen<Item = B> {
    /// The remainder of the iterator.
    fn remainder(&self) -> B;

    /// The number of items in the remainder
    fn remainder_len(&self) -> usize;

    /// An iterator over individual items of the remainder
    #[inline]
    fn remainder_iter(&self) -> BitChunkIter<B> {
        BitChunkIter::new(self.remainder(), self.remainder_len())
    }
}

/// This struct is used to efficiently iterate over bit masks by loading bytes on
/// the stack with alignments of `uX`. This allows efficient iteration over bitmaps.
#[derive(Debug)]
pub struct BitChunks<'a, T: BitChunk> {
    chunk_iterator: std::slice::ChunksExact<'a, u8>,
    current: T,
    remainder_bytes: &'a [u8],
    last_chunk: T,
    remaining: usize,
    /// offset inside a byte
    bit_offset: usize,
    len: usize,
    phantom: std::marker::PhantomData<T>,
}

/// writes `bytes` into `dst`.
#[inline]
fn copy_with_merge<T: BitChunk>(dst: &mut T::Bytes, bytes: &[u8], bit_offset: usize) {
    bytes
        .windows(2)
        .chain(std::iter::once([bytes[bytes.len() - 1], 0].as_ref()))
        .take(std::mem::size_of::<T>())
        .enumerate()
        .for_each(|(i, w)| {
            let val = merge_reversed(w[0], w[1], bit_offset);
            dst[i] = val;
        });
}

impl<'a, T: BitChunk> BitChunks<'a, T> {
    /// Creates a [`BitChunks`].
    pub fn new(slice: &'a [u8], offset: usize, len: usize) -> Self {
        assert!(offset + len <= slice.len() * 8);

        let slice = &slice[offset / 8..];
        let bit_offset = offset % 8;
        let size_of = std::mem::size_of::<T>();

        let bytes_len = len / 8;
        let bytes_upper_len = (len + bit_offset).div_ceil(8);
        let mut chunks = slice[..bytes_len].chunks_exact(size_of);

        let remainder = &slice[bytes_len - chunks.remainder().len()..bytes_upper_len];

        let remainder_bytes = if chunks.len() == 0 { slice } else { remainder };

        let last_chunk = remainder_bytes
            .first()
            .map(|first| {
                let mut last = T::zero().to_ne_bytes();
                last[0] = *first;
                T::from_ne_bytes(last)
            })
            .unwrap_or_else(T::zero);

        let remaining = chunks.size_hint().0;

        let current = chunks
            .next()
            .map(|x| match x.try_into() {
                Ok(a) => T::from_ne_bytes(a),
                Err(_) => unreachable!(),
            })
            .unwrap_or_else(T::zero);

        Self {
            chunk_iterator: chunks,
            len,
            current,
            remaining,
            remainder_bytes,
            last_chunk,
            bit_offset,
            phantom: std::marker::PhantomData,
        }
    }

    #[inline]
    fn load_next(&mut self) {
        self.current = match self.chunk_iterator.next().unwrap().try_into() {
            Ok(a) => T::from_ne_bytes(a),
            Err(_) => unreachable!(),
        };
    }

    /// Returns the remainder [`BitChunk`].
    pub fn remainder(&self) -> T {
        // remaining bytes may not fit in `size_of::<T>()`. We complement
        // them to fit by allocating T and writing to it byte by byte
        let mut remainder = T::zero().to_ne_bytes();

        let remainder = match (self.remainder_bytes.is_empty(), self.bit_offset == 0) {
            (true, _) => remainder,
            (false, true) => {
                // all remaining bytes
                self.remainder_bytes
                    .iter()
                    .take(std::mem::size_of::<T>())
                    .enumerate()
                    .for_each(|(i, val)| remainder[i] = *val);

                remainder
            }
            (false, false) => {
                // all remaining bytes
                copy_with_merge::<T>(&mut remainder, self.remainder_bytes, self.bit_offset);
                remainder
            }
        };
        T::from_ne_bytes(remainder)
    }

    /// Returns the remainder bits in [`BitChunks::remainder`].
    pub fn remainder_len(&self) -> usize {
        self.len - (std::mem::size_of::<T>() * ((self.len / 8) / std::mem::size_of::<T>()) * 8)
    }
}

impl<T: BitChunk> Iterator for BitChunks<'_, T> {
    type Item = T;

    #[inline]
    fn next(&mut self) -> Option<T> {
        if self.remaining == 0 {
            return None;
        }

        let current = self.current;
        let combined = if self.bit_offset == 0 {
            // fast case where there is no offset. In this case, there is bit-alignment
            // at byte boundary and thus the bytes correspond exactly.
            if self.remaining >= 2 {
                self.load_next();
            }
            current
        } else {
            let next = if self.remaining >= 2 {
                // case where `next` is complete and thus we can take it all
                self.load_next();
                self.current
            } else {
                // case where the `next` is incomplete and thus we take the remaining
                self.last_chunk
            };
            merge_reversed(current, next, self.bit_offset)
        };

        self.remaining -= 1;
        Some(combined)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        // it contains always one more than the chunk_iterator, which is the last
        // one where the remainder is merged into current.
        (self.remaining, Some(self.remaining))
    }
}

impl<T: BitChunk> BitChunkIterExact<T> for BitChunks<'_, T> {
    #[inline]
    fn remainder(&self) -> T {
        self.remainder()
    }

    #[inline]
    fn remainder_len(&self) -> usize {
        self.remainder_len()
    }
}

impl<T: BitChunk> ExactSizeIterator for BitChunks<'_, T> {
    #[inline]
    fn len(&self) -> usize {
        self.chunk_iterator.len()
    }
}

unsafe impl<T: BitChunk> TrustedLen for BitChunks<'_, T> {}

```

### Core Architecture Module: `src/common/column/src/bitmap/utils/chunks_exact_mut.rs`
```
// Copyright 2020-2022 Jorge C. Leitão
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use super::BitChunk;

/// An iterator over mutable slices of bytes of exact size.
///
/// # Safety
/// The slices returned by this iterator are guaranteed to have length equal to
/// `std::mem::size_of::<T>()`.
#[derive(Debug)]
pub struct BitChunksExactMut<'a, T: BitChunk> {
    chunks: std::slice::ChunksExactMut<'a, u8>,
    remainder: &'a mut [u8],
    remainder_len: usize,
    marker: std::marker::PhantomData<T>,
}

impl<'a, T: BitChunk> BitChunksExactMut<'a, T> {
    /// Returns a new [`BitChunksExactMut`]
    #[inline]
    pub fn new(bitmap: &'a mut [u8], length: usize) -> Self {
        assert!(length <= bitmap.len() * 8);
        let size_of = std::mem::size_of::<T>();

        let bitmap = &mut bitmap[..length.saturating_add(7) / 8];

        let split = (length / 8 / size_of) * size_of;
        let (chunks, remainder) = bitmap.split_at_mut(split);
        let remainder_len = length - chunks.len() * 8;

        let chunks = chunks.chunks_exact_mut(size_of);
        Self {
            chunks,
            remainder,
            remainder_len,
            marker: std::marker::PhantomData,
        }
    }

    /// The remainder slice
    #[inline]
    pub fn remainder(&mut self) -> &mut [u8] {
        self.remainder
    }

    /// The length of the remainder slice in bits.
    #[inline]
    pub fn remainder_len(&mut self) -> usize {
        self.remainder_len
    }
}

impl<'a, T: BitChunk> Iterator for BitChunksExactMut<'a, T> {
    type Item = &'a mut [u8];

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        self.chunks.next()
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.chunks.size_hint()
    }
}

```

### Core Architecture Module: `src/common/column/src/bitmap/utils/fmt.rs`
```
// Copyright 2020-2022 Jorge C. Leitão
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::fmt::Write;

use super::is_set;

/// Formats `bytes` taking into account an offset and length of the form
pub fn fmt(
    bytes: &[u8],
    offset: usize,
    length: usize,
    f: &mut std::fmt::Formatter,
) -> std::fmt::Result {
    assert!(offset < 8);

    f.write_char('[')?;
    let mut remaining = length;
    if remaining == 0 {
        f.write_char(']')?;
        return Ok(());
    }

    let first = bytes[0];
    let bytes = &bytes[1..];
    let empty_before = 8usize.saturating_sub(remaining + offset);
    f.write_str("0b")?;
    for _ in 0..empty_before {
        f.write_char('_')?;
    }
    let until = std::cmp::min(8, offset + remaining);
    for i in offset..until {
        if is_set(first, offset + until - 1 - i) {
            f.write_char('1')?;
        } else {
            f.write_char('0')?;
        }
    }
    for _ in 0..offset {
        f.write_char('_')?;
    }
    remaining -= until - offset;

    if remaining == 0 {
        f.write_char(']')?;
        return Ok(());
    }

    let number_of_bytes = remaining / 8;
    for byte in &bytes[..number_of_bytes] {
        f.write_str(", ")?;
        f.write_fmt(format_args!("{byte:#010b}"))?;
    }
    remaining -= number_of_bytes * 8;
    if remaining == 0 {
        f.write_char(']')?;
        return Ok(());
    }

    let last = bytes[std::cmp::min((length + offset).div_ceil(8), bytes.len() - 1)];
    let remaining = (length + offset) % 8;
    f.write_str(", ")?;
    f.write_str("0b")?;
    for _ in 0..(8 - remaining) {
        f.write_char('_')?;
    }
    for i in 0..remaining {
        if is_set(last, remaining - 1 - i) {
            f.write_char('1')?;
        } else {
            f.write_char('0')?;
        }
    }
    f.write_char(']')
}

```

### Core Architecture Module: `src/common/column/src/bitmap/utils/iterator.rs`
```
// Copyright 2020-2022 Jorge C. Leitão
// Copyright 2021 Datafuse Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::iter::TrustedLen;

use super::get_bit_unchecked;

/// An iterator over bits according to the [LSB](https://en.wikipedia.org/wiki/Bit_numbering#Least_significant_bit),
/// i.e. the bytes `[4u8, 128u8]` correspond to `[false, false, true, false, ..., true]`.
#[derive(Debug, Clone)]
pub struct BitmapIter<'a> {
    bytes: &'a [u8],
    index: usize,
    end: usize,
}

impl<'a> BitmapIter<'a> {
    /// Creates a new [`BitmapIter`].
    pub fn new(slice: &'a [u8], offset: usize, len: usize) -> Self {
        // example:
        // slice.len() = 4
        // offset = 9
        // len = 23
        // result:
        let bytes = &slice[offset / 8..];
        // bytes.len() = 3
        let index = offset % 8;
        // index = 9 % 8 = 1
        let end = len + index;
        // end = 23 + 1 = 24
        assert!(end <= bytes.len() * 8);
        // maximum read before UB in bits: bytes.len() * 8 = 24
        // the first read from the end is `end - 1`, thus, end = 24 is ok

        Self { bytes, index, end }
    }
}

impl Iterator for BitmapIter<'_> {
    type Item = bool;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        if self.index == self.end {
            return None;
        }
        let old = self.index;
        self.index += 1;
        // See comment in `new`
        Some(unsafe { get_bit_unchecked(self.bytes, old) })
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let exact = self.end - self.index;
        (exact, Some(exact))
    }

    #[inline]
    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        let new_index = self.index + n;
        if new_index > self.end {
            self.index = self.end;
            None
        } else {
            self.index = new_index;
            self.next()
        }
    }
}

impl DoubleEndedIterator for BitmapIter<'_> {
    #[inline]
    fn next_back(&mut self) -> Option<bool> {
        if self.index == self.end {
            None
        } else {
            self.end -= 1;
            // See comment in `new`; end was first decreased
            Some(unsafe { get_bit_unchecked(self.bytes, self.end) })
        }
    }
}

unsafe impl TrustedLen for BitmapIter<'_> {}
impl ExactSizeIterator for BitmapIter<'_> {}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20600** (2026-10-04): **feat(storage): presign azblob internal stage with user delegation SAS**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  `PRESIGN` on an internal stage backed by Azure Blob fails with `storage doesn't support presign operation` (code 3902) when Query authenticates with Azure Workload Identity (no account key, no SAS token). OpenDAL's azblob service only enables presign when `sas_token` is configured, and reqsign 0.16 cannot put a bearer token into a query string, so there is no key-less presign path today.  This PR adds a fallback for exactly that case: when the stage operator lacks presign capability and the internal stage is Azblob with Workload Identity and no account key, Query signs a **User Delegation SAS** for the single blob:  1. Exchange the federated token (`AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_FEDERATED_TOKEN_FILE`, optional `AZURE_AUTHORITY_HOST`) for an Entra token with scope `https://storage.azure.com/.default`. 2. Call `Get User Delegation Key` (`?restype=service&comp=userdelegationkey`). 3. Sign a blob-scoped SAS (`sr=b`, `spr=https`, `sp=r` for download, `sp=cw` for upload, expiry capped at 7 days). 4. Upload responses carry the required `x-ms-blob-type: BlockBlob` header (plus `content-type` when given).  Behavior for all other storage types, and for azblob with account key or SAS, is unchanged: they still use OpenDAL presign. External stages are not affected.  The Entra access token (per identity) and the user delegation key (per identity and storage account)
  **Post-Mortem & Fix Analysis**:
  > ## Docker Image for PR * **tag**: `pr-20600-ad7f49d-1790737377`  > note: this image tag is only available for internal use. 
  > ## Docker Image for PR * **tag**: `pr-20600-28f01fd-1790749075`  > note: this image tag is only available for internal use. 

- **Issue #20599** (2026-09-30): **fix(planner): keep rank limit off eager aggregates below joins**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - fixes: #20591  With `GROUP BY ... ORDER BY <group keys> LIMIT n`, `RulePushDownRankLimitAggregate` sets `rank_limit` on the aggregate, which is correct because it sits right under the ORDER BY/LIMIT. `RuleEagerAggregation` then builds a pre-aggregate below the join by cloning the final aggregate (`..self.final_agg.clone()` in `pruned_aggregate_for_side`). That copied `rank_limit` down too.  Below the join, the limit keeps the first n groups of one join input, not of the join output. In the issue, the pre-aggregate on `part_l` kept only rows 1..3, all of which have `c0boolean = false` in `part_r`, so the query returned no rows.  LATERAL and the MEMORY engine are not required. MEMORY tables have no stats, so the cost model picks eager aggregation. With FUSE tables, a plain inner join reproduces the bug once `force_eager_aggregate = 1` is set. The `partitions total: 0` in the issue's EXPLAIN is normal for MEMORY tables and unrelated.  The fix sets `rank_limit: None` on the aggregates built below the join. The final aggregate above the join keeps its rank limit, so the TopN optimization still applies. `flatten_plan.rs` already clears `rank_limit` in the same way when it copies an aggregate during decorrelation.  ## Tests  - [ ] Unit Test - [x] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  - `query/join/eager_aggregation_strategy.test`: the issue's query

- **Issue #20593** (2026-09-30): **feat(query): distribute data rewrite of ALTER TABLE MODIFY COLUMN**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - fixes: #20575  When `ALTER TABLE ... MODIFY COLUMN` has to rewrite a Fuse table, the rewrite plan placed `DistributedInsertSelect` above the top `Merge` exchange. Only the scan ran on every node. The schema conversion (`TransformCastSchema`), block building and `append_data` all ran on the coordinator, so every row was shipped to one node, which converted and wrote the whole table by itself.  This PR builds the rewrite plan with `build_insert_select_physical_plan`, the builder used by `INSERT ... SELECT`. When the table supports distributed insert (Fuse does) and the select plan has a top `Merge`, it pushes `DistributedInsertSelect` below the `Merge`:  ``` before                            after DistributedInsertSelect           Exchange(Merge) └── Exchange(Merge)               └── DistributedInsertSelect     └── TableScan                     └── TableScan ```  Each node now converts and writes its own blocks. Only the writer metas are merged back to the coordinator.  What is unchanged:  - The commit still runs once on the coordinator through `commit_insertion`, with `overwrite = true` and `prev_snapshot_id` for conflict detection. The table lock in `execute2` is untouched. - Remote writers build the table from the new schema carried in the plan's `table_info`, the same way distributed `INSERT` does. - Single-node execution and metadata-only ALTERs behave as before.

- **Issue #20592** (2026-09-30): **fix(query): keep scalar eager aggregates out of inner/cross joins**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - fixes: #20483  `RuleEagerAggregation` could push a **scalar** aggregate (one that keeps no `GROUP BY` column of its own) below an inner or cross join. A scalar aggregate emits exactly one row even when its input is empty, so moving one below the join turned an empty build side into a one-row build side and made the join emit probe rows the original plan had already filtered out.  In the reported plan the never-TRUE `WHERE` predicate on `t1` was folded into an empty scan, `COUNT(t1.v)` was hoisted above the `CROSS JOIN` as a scalar aggregate over `t1`, and `t0` was re-scanned as the probe side. Since the folded `COUNT` had no `GROUP BY` column, it produced one row for an empty `t1`, so the `CROSS JOIN` behaved as though `t1` had contributed all its rows and the whole `t0` content survived.  The fix requires a side to retain at least one `GROUP BY` column before the rewrite replaces it with an eager aggregate. A grouped aggregate over an empty input produces zero rows, so it preserves the join's cardinality. The check is applied to every side each rewrite variant touches, so `SingleCount` and `SingleDouble` are gated on the opposite side as well. The existing `expand_analyses` body is also collapsed onto a local `analysis` closure while the guard is threaded through, since each variant previously repeated the same seven-field struct literal.  ## Tests  - [x] Unit Test

- **Issue #20591** (2026-09-30): **bug: Multi-table LATERAL JOIN reconstructed query returns empty result while single-table query returns 3 rows**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/databendlabs/databend/issues) and found no similar issues.   ### Version  - Databend version: v1.2.925-patch-11-ebcd374c34 - Build toolchain: rust-1.94.0-nightly-2026-08-26  ### What's Wrong?  The single-table query returns 3 rows, but the multi-table reconstructed query using `JOIN LATERAL` returns an empty result. The single-table query plan directly scans the `source` table and filters on `c0boolean`, returning 3 rows. In the multi-table query plan, `part_l` is a MEMORY table with 9 actual rows, but the plan shows `partitions total: 0, partitions scanned: 0`, causing the probe side to receive no input and ultimately return 0 rows.  ### How to Reproduce?  1. Start the Databend query service and connect using a MySQL client. 2. Execute the following SQL script:  ```sql DROP DATABASE IF EXISTS repro_databend912_db7_min; CREATE DATABASE repro_databend912_db7_min; USE repro_databend912_db7_min;  CREATE TABLE source (     vp_rowid BIGINT NOT NULL,     c0boolean BOOLEAN,     c1int BIGINT ) ENGINE=FUSE;  INSERT INTO source VALUES (1, false, -1), (2, false, -2), (3, false, -3), (4, true,  -4), (5, true,  -5), (6, true,  -6), (7, true,  -7), (8, true,  -8), (9, true,  -9);  CREATE TABLE part_l (     vp_rowid BIGINT NOT NULL,     c1int BIGINT ) ENGINE=MEMORY;  CREATE TABLE part_r (     vp_rowid BIGINT NOT NULL,     c0boolean BOOLEAN ) ENGINE=FUSE;  INSERT INTO part_l SELECT vp_rowid, c1int FROM source; 

- **Issue #20590** (2026-09-29): **fix(storage): read Iceberg tables on Azure (abfs[s])**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Iceberg tables on Azure (`abfs[s]://`) can't be read. Every table load fails:  ``` Iceberg catalog load failed: FeatureUnsupported => Constructing file io from scheme: azdls not supported now ```  The REST catalog attaches and lists namespaces; only table IO fails. Two causes:  1. **`storage-azdls` is not enabled on `iceberg`.** In iceberg-rust, `storage-all` means memory, fs, s3 and gcs only, so the Azdls storage is compiled out. `opendal/services-azdls` is already on in the workspace, so `Cargo.lock` doesn't change. 2. **`IcebergFileIO::build_operator` cuts the path short for `abfss://<filesystem>@<host>/<path>`.** It computes the relative-path offset as `scheme://host/`, which ignores the `<filesystem>@` userinfo, so every data-file path starts inside the filesystem name. It now starts after the whole authority, which is unchanged for `s3://bucket/…`. For Azdls it also sets opendal's `filesystem` and `endpoint` from the location, as iceberg-rust's own Azdls storage does, and maps `adls.tenant-id` / `adls.client-id` / `adls.client-secret` / `adls.authority-host` next to the existing `adls.sas-token` / `adls.account-*` keys.  ## Tests  - [x] Unit Test: `iceberg_file_io_azdls_path_skips_filesystem_in_authority` covers `*.dfs.core.windows.net` and `onelake.dfs.fabric.microsoft.com`. The three existing `iceberg_file_io_*` tests still pass, and `cargo fmt --all --check` 
  **Post-Mortem & Fix Analysis**:
  > thanks @sundy-li 

- **Issue #20589** (2026-09-29): **fix(storage): read Iceberg tables on Azure (abfs[s])**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Iceberg tables on Azure (`abfs[s]://`) can't be read. Every table load fails:  ``` Iceberg catalog load failed: FeatureUnsupported => Constructing file io from scheme: azdls not supported now ```  The REST catalog attaches and lists namespaces; only table IO fails. Two causes:  1. **`storage-azdls` is not enabled on `iceberg`.** In iceberg-rust, `storage-all` means memory, fs, s3 and gcs only, so the Azdls storage is compiled out. `opendal/services-azdls` is already on in the workspace, so `Cargo.lock` doesn't change. 2. **`IcebergFileIO::build_operator` cuts the path short for `abfss://<filesystem>@<host>/<path>`.** It computes the relative-path offset as `scheme://host/`, which ignores the `<filesystem>@` userinfo, so every data-file path starts inside the filesystem name. It now starts after the whole authority, which is unchanged for `s3://bucket/…`. For Azdls it also sets opendal's `filesystem` and `endpoint` from the location, as iceberg-rust's own Azdls storage does, and maps `adls.tenant-id` / `adls.client-id` / `adls.client-secret` / `adls.authority-host` next to the existing `adls.sas-token` / `adls.account-*` keys.  ## Tests  - [x] Unit Test: `iceberg_file_io_azdls_path_skips_filesystem_in_authority` covers `*.dfs.core.windows.net` and `onelake.dfs.fabric.microsoft.com`. The three existing `iceberg_file_io_*` tests still pass, and `cargo fmt --all --check` 
  **Post-Mortem & Fix Analysis**:
  > The `## AI assistance` section is incomplete. Review is blocked until it is filled in. @djouallah please update it 🙏.  - the checkbox "The responsible human has read every line of this diff and can explain each change" is not checked exactly as written  Required format (see [AI_POLICY.md](https://github.com/databendlabs/databend/blob/main/AI_POLICY.md)):  ``` ## AI assistance  - AI usage: An AI coding agent drafted the patch; I reviewed and added logic tests (or "None") - Responsible human: @actual-github-id - [x] The responsible human has read every line of this diff and can explain each change ```  The responsible human is the author-side owner — the person who has read the diff, can explain each change, and will answer questions during review. <!-- pr-assistant-ai-assistance -->

- **Issue #20586** (2026-09-29): **fix(parser): accept and ignore LIMIT in VACUUM DROP TABLE**
  *Symptoms*:   I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Older clients and internal tasks still send `VACUUM DROP TABLE [FROM db] LIMIT n`, which was rejected after the vacuum syntax unification. Parse the LIMIT for compatibility and ignore it.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [ ] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work as expected) - [ ] Documentation Update - [x] Refactoring - [ ] Performance Improvement - [ ] Other (please describe):  ## AI assistance  <!-- See AI_POLICY.md. Agent-opened PRs are welcome; a responsible human on the author side must own the change. The responsible human is NOT the reviewer — it is the submitter-side owner who has read the diff, can explain each change, and will answer questions during review. Write "None" for AI usage if no AI was involved. -->  - AI usage: AI generate the code I review it. - Responsible human: @TCeason - [x] The responsible human has read every line of this diff and can explain each change  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/databendlabs/databend/2

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

### Incident Patch 1: `99d0f9da` (2026-09-30)
**Commit Message**: fix(planner): keep rank limit off eager aggregates below joins (#20599)

* fix(planner): keep rank limit off eager aggregates below joins

RuleEagerAggregation cloned the final aggregate, including a rank limit pushed down by ORDER BY ... LIMIT, into the pre-aggregate below the join. The limit then kept the first N groups of one join input instead of the join output, so queries could return too few or no rows.

Fixes #20591

* test(planner): check eager aggregate rank limit with explain

Replace the optimizer unit test with a standalone EXPLAIN case that pins the plan shape: the rank limit stays on the aggregate above the join and is absent from the eager aggregate below it.

* test(planner): ignore pruning cost in eager rank limit explain

* test(planner): record eager aggregation rule candidates in golden

Port the rule-level test harness from the late-split branch onto the
current rule. Each case now records the plan fed to
RuleEagerAggregation (after the default rewrites and SplitAggregate),
the number of candidates, and every candidate plan, instead of only the
final optimized plan, which does not go through CBO here and rarely
picks an eager aggregate.

Add the Q0-Q11 cases f

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/agg_rules/rule_eager_aggregation.rs` (modified, +3/-0)
```diff
@@ -1103,6 +1103,9 @@ impl EagerAnalysis {
                 })
                 .cloned()
                 .collect(),
+            // A rank limit on the final aggregate only holds for the groups that survive
+            // the join. Applying it below the join could drop groups that would match.
+            rank_limit: None,
             ..self.final_agg.clone()
         }
     }
```

**File**: `src/query/sql/tests/it/optimizer/eager_aggregation.rs` (modified, +363/-30)
```diff
@@ -15,12 +15,20 @@
 use databend_common_catalog::table_context::TableContextSettings;
 use databend_common_exception::Result;
 use databend_common_sql::optimizer::OptimizerContext;
+use databend_common_sql::optimizer::ir::SExpr;
+use databend_common_sql::optimizer::ir::SExprVisitor;
 use databend_common_sql::optimizer::ir::StatContext;
+use databend_common_sql::optimizer::ir::VisitAction;
+use databend_common_sql::optimizer::optimizers::operator::PullUpFilterOptimizer;
+use databend_common_sql::optimizer::optimizers::operator::RuleNormalizeAggregateOptimizer;
+use databend_common_sql::optimizer::optimizers::operator::RuleStatsAggregateOptimizer;
 use databend_common_sql::optimizer::optimizers::recursive::RecursiveRuleOptimizer;
+use databend_common_sql::optimizer::optimizers::rule::DEFAULT_REWRITE_RULES;
 use databend_common_sql::optimizer::optimizers::rule::Rule;
 use databend_common_sql::optimizer::optimizers::rule::RuleEagerAggregation;
 use databend_common_sql::optimizer::optimizers::rule::RuleID;
 use databend_common_sql::optimizer::optimizers::rule::TransformResult;
+use databend_common_sql::plans::AggregateMode;
 use databend_common_sql::plans::Plan;
 
 use crate::framework::LiteTableContext;
@@ -29,60 +37,235 @@ use crate::framework::golden::open_golden_file;
 use crate::framework::golden::setup_context;
 use crate::framework::golden::write_case_header;
 
-async fn write_optimized_case(file: &mut impl std::io::Write, case: &SqlTestCase) -> Result<()> {
+async fn write_rule_results(file: &mut impl std::io::Write, case: &SqlTestCase) -> Result<()> {
     let ctx = setup_context(case).await?;
-    let raw_plan = ctx.bind_sql(case.sql).await?;
-    let optimized_plan = ctx.optimize_plan(raw_plan.clone()).await?;
+    let plan = ctx.bind_sql(case.sql).await?;
+    let Plan::Query {
+        s_expr, metadata, ..
+    } = &plan
+    else {
+        unreachable!("test query should bind to Plan::Query")
+    };
+
+    let settings = ctx.get_settings();
+    let opt_ctx = OptimizerContext::new(ctx.clone(), metadata.clone(), ctx.get_function_context()?)
+        .with_settings(&settings)?;
+    let before_expr = optimize_before(opt_ctx.clone(), s_expr).await?;
+    let before_plan = plan.replace_query_s_expr(before_expr.clone());
 
     write_case_header(file, case)?;
-    writeln!(file, "raw_plan:")?;
+    writeln!(file, "before_plan:")?;
     writeln!(
         file,
         "{}",
-        raw_plan.format_indent(Default::default(), &StatContext::default())?
+        before_plan.format_indent(Default::default(), &StatContext::default())?
     )?;
-    writeln!(file, "optimized_plan:")?;
+    // The logical plan format does not show rank limits, so record their positions.
+    let before_rank_limits = rank_limit_positions(&before_expr);
+    if before_rank_limits != (0, 0) {
+        write_rank_limit_positions(file, before_rank_limits)?;
+    }
+
+    let mut extractor = Extractor {
+        rule: RuleEagerAggregation::new(metadata.clone()),
+        results: TransformResult::new(),
+    };
+    before_expr.accept(&mut extractor)?;
+    let results = extractor.results.results();
+    for (result_index, result) in results.iter().enumerate() {
+        assert_no_initial_aggregate(result)?;
+        result.validate_types(metadata)?;
+        result.validate_column_scope(metadata)?;
+        writeln!(file, "apply_plan_{result_index}:")?;
+        let rewritten = plan.replace_query_s_expr(result.clone());
+        writeln!(
+            file,
+            "{}",
+            rewritten.format_indent(Default::default(), &StatContext::default())?
+        )?;
+        // A rank limit below the join keeps the first groups of one join input, which
+        // may all be filtered out by the join (#20591).
+        if before_rank_limits != (0, 0) {
+            write_rank_limit_positions(file, rank_limit_positions(result))?;
+        }
+    }
+    writeln!(file)?;
+
+    Ok(())
+}
+
+/// Counts rank-limited aggregates above and below the first join.
+fn rank_limit_positions(expr: &SExpr) -> (usize, usize) {
+    fn walk(expr: &SExpr, below_join: bool, counts: &mut (usize, usize)) {
+        if let Some(aggregate) = expr.plan().as_aggregate()
+            && aggregate.rank_limit.is_some()
+        {
+            if below_join {
+                counts.1 += 1;
+            } else {
+                counts.0 += 1;
+            }
+        }
+        let below_join = below_join || expr.plan().as_join().is_some();
+        for child in expr.children() {
+            walk(child, below_join, counts);
+        }
+    }
+    let mut counts = (0, 0);
+    walk(expr, false, &mut counts);
+    counts
+}
+
+fn write_rank_limit_positions(
+    file: &mut impl std::io::Write,
+    (above_join, below_join): (usize, usize),
+) -> Result<()> {
     writeln!(
         file,
-        "{}",
-        optimized_plan.format_indent(Default::default(), &StatContext::default())?
+        "rank_limit_aggregates: above_join={above_join} below_join={b
```

**File**: `tests/sqllogictests/suites/mode/standalone/explain/aggregate.test` (modified, +117/-0)
```diff
@@ -545,3 +545,120 @@ DROP TABLE IF EXISTS t;
 
 statement ok
 DROP TABLE IF EXISTS explain_agg_t1;
+
+# https://github.com/databendlabs/databend/issues/20591
+# The rank limit pushed down by ORDER BY ... LIMIT stays on the aggregate above the join.
+# The eager aggregate below the join must not carry it.
+statement ok
+set force_eager_aggregate = 1;
+
+statement ok
+CREATE OR REPLACE TABLE explain_agg_rank_l (k BIGINT NOT NULL, v BIGINT);
+
+statement ok
+CREATE OR REPLACE TABLE explain_agg_rank_r (k BIGINT NOT NULL, flag BOOLEAN);
+
+statement ok
+INSERT INTO explain_agg_rank_l VALUES (1, -1), (2, -2), (3, -3), (4, -4), (5, -5), (6, -6), (7, -7), (8, -8), (9, -9);
+
+statement ok
+INSERT INTO explain_agg_rank_r VALUES (1, false), (2, false), (3, false), (4, true), (5, true), (6, true), (7, true), (8, true), (9, true);
+
+query T
+EXPLAIN SELECT sum(l.v), l.k, l.v
+FROM explain_agg_rank_l l JOIN explain_agg_rank_r r ON r.k = l.k
+WHERE r.flag
+GROUP BY l.k, l.v
+ORDER BY l.k, l.v
+LIMIT 3;
+----
+TopN(Final)
+├── output columns: [l.k (#0), l.v (#1), sum(l.v) (#4)]
+├── sort keys: [k ASC NULLS LAST, v ASC NULLS LAST]
+├── limit: 3
+├── offset: 0
+├── estimated rows: 3.00
+└── TopN(Partial)
+    ├── output columns: [l.k (#0), l.v (#1), sum(l.v) (#4), #_order_col]
+    ├── sort keys: [k ASC NULLS LAST, v ASC NULLS LAST]
+    ├── limit: 3
+    ├── offset: 0
+    ├── estimated rows: 3.00
+    └── EvalScalar
+        ├── output columns: [l.k (#0), l.v (#1), sum(l.v) (#4)]
+        ├── expressions: [sum(l.v) (#16)]
+        ├── estimated rows: 4.50
+        └── AggregateFinal
+            ├── output columns: [_eager_final_sum (#16), l.k (#0), l.v (#1)]
+            ├── group by: [k, v]
+            ├── aggregate functions: [sum(sum(l.v) * _eager_count)]
+            ├── estimated rows: 4.50
+            └── AggregatePartial
+                ├── group by: [k, v]
+                ├── aggregate functions: [sum(sum(l.v) * _eager_count)]
+                ├── estimated rows: 4.50
+                ├── rank limit: 3
+                └── EvalScalar
+                    ├── output columns: [l.k (#0), l.v (#1), sum(l.v) * _eager_count (#18)]
+                    ├── expressions: [_eager (#4) * CAST(_eager_count (#17) AS UInt64 NULL)]
+                    ├── estimated rows: 4.50
+                    └── HashJoin
+                        ├── output columns: [sum(l.v) (#4), l.k (#0), l.v (#1), count(*) (#17)]
+                        ├── join type: INNER
+                        ├── build keys: [r.k (#2)]
+                        ├── probe keys: [l.k (#0)]
+                        ├── keys is null equal: [false]
+                        ├── filters: []
+                        ├── build join filters:
+                        │   └── filter id:0, build key:r.k (#2), probe targets:[l.k (#0)@scan0], filter type:bloom,inlist,min_max
+                        ├── estimated rows: 4.50
+                        ├── AggregateFinal(Build)
+                        │   ├── output columns: [count(*) (#17), r.k (#2)]
+                        │   ├── group by: [k]
+                        │   ├── aggregate functions: [count()]
+                        │   ├── estimated rows: 4.50
+                        │   └── AggregatePartial
+                        │       ├── group by: [k]
+                        │       ├── aggregate functions: [count()]
+                        │       ├── estimated rows: 4.50
+                        │       └── TableScan
+                        │           ├── table: default.default.explain_agg_rank_r
+                        │           ├── scan id: 1
+                        │           ├── output columns: [k (#2)]
+                        │           ├── read rows: 9
+                        │           ├── read size: < 1 KiB
+                        │           ├── partitions total: 1
+                        │           ├── partitions scanned: 1
+                        │           ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
+                        │           ├── push downs: [filters: [is_true(explain_agg_rank_r.flag (#3))], limit: NONE]
+                        │           └── estimated rows: 4.50
+                        └── AggregateFinal(Probe)
+                            ├── output columns: [sum(l.v) (#4), l.k (#0), l.v (#1)]
+                            ├── group by: [k, v]
+                            ├── aggregate functions: [sum(v)]
+                            ├── estimated rows: 9.00
+                            └── AggregatePartial
+                                ├── group by: [k, v]
+                                ├── aggregate functions: [sum(v)]
+                                ├── estimated rows: 9.00
+                                └── TableScan
+                                    ├── table: default.default.explain_agg_rank_l
+                      
```

**File**: `tests/sqllogictests/suites/query/join/eager_aggregation_strategy.test` (modified, +56/-0)
```diff
@@ -45,3 +45,59 @@ DROP TABLE eager_strategy_left;
 
 statement ok
 DROP TABLE eager_strategy_right;
+
+# https://github.com/databendlabs/databend/issues/20591
+# A pushed-down rank limit must not be copied into an eager aggregate below the join:
+# the first groups of one join input may all be filtered out by the join.
+# force_eager_aggregate makes the plan independent of table statistics.
+statement ok
+set force_eager_aggregate = 1;
+
+statement ok
+CREATE TABLE eager_rank_limit_l (k BIGINT NOT NULL, v BIGINT);
+
+statement ok
+CREATE TABLE eager_rank_limit_r (k BIGINT NOT NULL, flag BOOLEAN);
+
+statement ok
+INSERT INTO eager_rank_limit_l VALUES (1, -1), (2, -2), (3, -3), (4, -4), (5, -5), (6, -6), (7, -7), (8, -8), (9, -9);
+
+statement ok
+INSERT INTO eager_rank_limit_r VALUES (1, false), (2, false), (3, false), (4, true), (5, true), (6, true), (7, true), (8, true), (9, true);
+
+query III
+SELECT sum(l.v), l.k, l.v
+FROM eager_rank_limit_l l JOIN eager_rank_limit_r r ON r.k = l.k
+WHERE r.flag
+GROUP BY l.k, l.v
+ORDER BY l.k, l.v
+LIMIT 3;
+----
+-4 4 -4
+-5 5 -5
+-6 6 -6
+
+query III
+SELECT sum(s.v), s.k, s.v
+FROM (
+    SELECT l.k, r.flag, l.v
+    FROM eager_rank_limit_l l
+    JOIN LATERAL (SELECT * FROM eager_rank_limit_r rr WHERE rr.k = l.k) r ON TRUE
+) s
+WHERE s.flag
+GROUP BY s.k, s.v
+ORDER BY s.k, s.v
+LIMIT 3;
+----
+-4 4 -4
+-5 5 -5
+-6 6 -6
+
+statement ok
+DROP TABLE eager_rank_limit_l;
+
+statement ok
+DROP TABLE eager_rank_limit_r;
+
+statement ok
+unset force_eager_aggregate;
```

---

### Incident Patch 2: `cb9170e5` (2026-09-30)
**Commit Message**: fix(query): keep scalar eager aggregates out of inner/cross joins (#20592)

* fix(query): keep scalar eager aggregates out of inner/cross joins

The eager-aggregation rewrite could push a scalar aggregate below an
inner or cross join. A scalar aggregate is one that keeps no GROUP BY
column of its own, so it emits exactly one row even when its input is
empty. Moving one below the join therefore turned an empty build side
into a one-row build side, and the join emitted probe rows that the
original plan had already filtered out.

The reported plan folded the never-TRUE WHERE predicate on t1 into a
ConstantTableScan, hoisted the COUNT(t1.v) above the CROSS join as a
scalar aggregate over t1, and then re-scanned t0. Because the folded
COUNT had no GROUP BY column of its own, it produced one row for an
empty t1, so the CROSS JOIN behaved as if t1 had contributed all its
rows and the whole t0 content survived.

Require a side to retain at least one GROUP BY column before the rewrite
replaces it with an eager aggregate: a grouped aggregate over an empty
input produces zero rows, so it preserves the join's cardinality. The
check is applied to every side each rewrite variant touches, so
Sing

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/agg_rules/rule_eager_aggregation.rs` (modified, +44/-47)
```diff
@@ -348,6 +348,19 @@ impl<'a> EagerInput<'a> {
             return Ok(vec![]);
         }
 
+        // An eager aggregate that keeps no group column on its side is a scalar
+        // aggregate: it emits exactly one row even when its input is empty. For an
+        // inner/cross join that turns an empty build side into a one-row build side,
+        // so the join emits probe rows the original plan filtered out (see #20483).
+        // Only sides that retain at least one group column preserve emptiness, because
+        // a grouped aggregate over an empty input produces zero rows.
+        let keeps_empty_side = Pair::new_with(|side| {
+            final_agg
+                .group_items
+                .iter()
+                .any(|item| join_columns[side].contains(&item.index))
+        });
+
         let eager_aggregation_variants = eager_candidates.assignments();
         Ok(eager_aggregation_variants
             .into_iter()
@@ -358,6 +371,7 @@ impl<'a> EagerInput<'a> {
                     &join_columns,
                     &eager_extra_eval_scalar_expr,
                     &can_eager,
+                    &keeps_empty_side,
                     assignment,
                 )
             })
@@ -401,33 +415,34 @@ impl<'a> EagerInput<'a> {
         join_columns: &Pair<ColumnSet>,
         eager_extra_eval_scalar_expr: &Pair<EvalScalar>,
         can_eager: &Pair<bool>,
+        keeps_empty_side: &Pair<bool>,
         assignment: EagerAssignment,
     ) -> Vec<EagerAnalysis> {
+        let analysis = |rewrite_kind| EagerAnalysis {
+            final_agg: final_agg.clone(),
+            original_group_items_len,
+            join_columns: join_columns.clone(),
+            eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
+            eager_aggregations: assignment.eager_aggregations.clone(),
+            can_eager: can_eager.clone(),
+            rewrite_kind,
+        };
+
         let can_push_down = Pair {
             left: !assignment.eager_aggregations[Side::Left].is_empty() && can_eager[Side::Left],
             right: !assignment.eager_aggregations[Side::Right].is_empty() && can_eager[Side::Right],
         };
 
-        if can_push_down[Side::Left] && can_push_down[Side::Right] {
+        // `keeps_empty_side` must hold for every side this rewrite replaces with an
+        // eager aggregate, otherwise the join would gain rows the input never had.
+        if can_push_down[Side::Left]
+            && can_push_down[Side::Right]
+            && keeps_empty_side[Side::Left]
+            && keeps_empty_side[Side::Right]
+        {
             return vec![
-                EagerAnalysis {
-                    final_agg: final_agg.clone(),
-                    original_group_items_len,
-                    join_columns: join_columns.clone(),
-                    eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
-                    eager_aggregations: assignment.eager_aggregations.clone(),
-                    can_eager: can_eager.clone(),
-                    rewrite_kind: EagerRewriteKind::DoubleGroupByCount(Side::Left),
-                },
-                EagerAnalysis {
-                    final_agg: final_agg.clone(),
-                    original_group_items_len,
-                    join_columns: join_columns.clone(),
-                    eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
-                    eager_aggregations: assignment.eager_aggregations.clone(),
-                    can_eager: can_eager.clone(),
-                    rewrite_kind: EagerRewriteKind::DoubleSplit(Side::Left),
-                },
+                analysis(EagerRewriteKind::DoubleGroupByCount(Side::Left)),
+                analysis(EagerRewriteKind::DoubleSplit(Side::Left)),
             ];
         }
 
@@ -443,40 +458,22 @@ impl<'a> EagerInput<'a> {
             return vec![];
         }
 
-        let mut analyses = vec![EagerAnalysis {
-            final_agg: final_agg.clone(),
-            original_group_items_len,
-            join_columns: join_columns.clone(),
-            eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
-            eager_aggregations: assignment.eager_aggregations.clone(),
-            can_eager: can_eager.clone(),
-            rewrite_kind: EagerRewriteKind::SingleGroupBy(d),
-        }];
+        // `SingleGroupBy` only rewrites side `d`.
+        if !keeps_empty_side[d] {
+            return vec![];
+        }
 
-        if can_eager[d.opposite()] {
+        let mut analyses = vec![analysis(EagerRewriteKind::SingleGroupBy(d))];
+
+        // `SingleCount` and `SingleDouble` also rewrite side `d^1`.
+        if can_eager[d.opposite()] && keeps_empty_side[d.opposite()] {
             if self.has_sum_aggregate(final_agg) {
-                analyses.push(EagerAnalysis {
-                    final_agg: final_agg.clone(),
-                    original_group_items_len,
-                    join_columns: jo
```

**File**: `src/query/sql/tests/it/optimizer/eager_aggregation.rs` (modified, +35/-1)
```diff
@@ -153,8 +153,11 @@ async fn test_eager_aggregation_keeps_decimal_product_types_in_sync() -> Result<
         name: "decimal_sum_multiplied_by_eager_count",
         description: "",
         setup_sqls: &[DECIMAL_SALES_TABLE, DATE_DIM_TABLE],
+        // An equi-join keeps a group column on both sides, so the `sum * eager_count`
+        // rewrite (`SingleCount`) stays eligible. A CROSS JOIN would leave `date_dim`
+        // without a group column and the rule would skip that rewrite (#20483).
         sql: "SELECT ss_store_sk, sum(ss_ext_sales_price)
-FROM store_sales CROSS JOIN date_dim
+FROM store_sales JOIN date_dim ON ss_store_sk = d_date_sk
 GROUP BY ss_store_sk",
     };
     let ctx = setup_context(&case).await?;
@@ -217,6 +220,37 @@ GROUP BY ss_store_sk"
     Ok(())
 }
 
+// Regression for #20483: an eager aggregate on a side without any GROUP BY column is
+// a scalar aggregate and emits one row for an empty input. Pushing it below a CROSS
+// JOIN would make the join emit rows from the other side, so no candidate is legal.
+#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+async fn test_eager_aggregation_skips_side_without_group_column() -> Result<()> {
+    for aggregate in ["sum", "count", "min", "max"] {
+        let sql = format!(
+            "SELECT ss_store_sk, {aggregate}(d_date_sk)
+FROM store_sales CROSS JOIN date_dim
+GROUP BY ss_store_sk"
+        );
+        let ctx = LiteTableContext::create().await?;
+        ctx.register_setup_sql(DECIMAL_SALES_TABLE).await?;
+        ctx.register_setup_sql(DATE_DIM_TABLE).await?;
+        let Plan::Query {
+            s_expr, metadata, ..
+        } = ctx.bind_sql(&sql).await?
+        else {
+            unreachable!("test query should bind to Plan::Query")
+        };
+        let opt_ctx =
+            OptimizerContext::new(ctx.clone(), metadata.clone(), ctx.get_function_context()?);
+        let split = RecursiveRuleOptimizer::new(opt_ctx, &[RuleID::SplitAggregate])
+            .optimize_sync(*s_expr)?;
+        let mut results = TransformResult::new();
+        RuleEagerAggregation::new(metadata.clone()).apply(&split, &mut results)?;
+        assert!(results.results().is_empty(), "{aggregate}");
+    }
+    Ok(())
+}
+
 const ORDERS_TABLE: &str = "CREATE TABLE orders
 (
     o_orderkey       BIGINT not null,
```

**File**: `tests/sqllogictests/suites/mode/standalone/explain/subquery.test` (modified, +55/-55)
```diff
@@ -1089,67 +1089,67 @@ HashJoin
 │   │       ├── aggregate functions: [max(v)]
 │   │       ├── estimated rows: 1.00
 │   │       └── HashJoin
-│   │           ├── output columns: [k (#7), nullable_scalar_exchange_payload.v (#4)]
+│   │           ├── output columns: [nullable_scalar_exchange_payload.v (#4), k (#7)]
 │   │           ├── join type: CROSS
 │   │           ├── build keys: []
 │   │           ├── probe keys: []
 │   │           ├── keys is null equal: []
 │   │           ├── filters: []
 │   │           ├── estimated rows: 1.00
-│   │           ├── TableScan(Build)
-│   │           │   ├── table: default.default.nullable_scalar_exchange_payload
-│   │           │   ├── scan id: 2
-│   │           │   ├── output columns: [v (#4)]
-│   │           │   ├── read rows: 1
-│   │           │   ├── read size: < 1 KiB
-│   │           │   ├── partitions total: 1
-│   │           │   ├── partitions scanned: 1
-│   │           │   ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
-│   │           │   ├── push downs: [filters: [], limit: NONE]
-│   │           │   └── estimated rows: 1.00
-│   │           └── AggregateFinal(Probe)
-│   │               ├── output columns: [k (#7)]
-│   │               ├── group by: [k]
-│   │               ├── aggregate functions: []
-│   │               ├── estimated rows: 1.00
-│   │               └── AggregatePartial
-│   │                   ├── group by: [k]
-│   │                   ├── aggregate functions: []
-│   │                   ├── estimated rows: 1.00
-│   │                   └── HashJoin
-│   │                       ├── output columns: [k (#7)]
-│   │                       ├── join type: INNER
-│   │                       ├── build keys: [o.id (#6)]
-│   │                       ├── probe keys: [j.id (#9)]
-│   │                       ├── keys is null equal: [false]
-│   │                       ├── filters: []
-│   │                       ├── estimated rows: 1.80
-│   │                       ├── Filter(Build)
-│   │                       │   ├── output columns: [id (#6), k (#7)]
-│   │                       │   ├── filters: [NOT is_not_null(outer.k (#7))]
-│   │                       │   ├── estimated rows: 0.60
-│   │                       │   └── TableScan
-│   │                       │       ├── table: default.default.nullable_scalar_exchange_outer
-│   │                       │       ├── scan id: 3
-│   │                       │       ├── output columns: [id (#6), k (#7)]
-│   │                       │       ├── read rows: 3
-│   │                       │       ├── read size: < 1 KiB
-│   │                       │       ├── partitions total: 1
-│   │                       │       ├── partitions scanned: 1
-│   │                       │       ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
-│   │                       │       ├── push downs: [filters: [true], limit: NONE]
-│   │                       │       └── estimated rows: 3.00
-│   │                       └── TableScan(Probe)
-│   │                           ├── table: default.default.nullable_scalar_exchange_join
-│   │                           ├── scan id: 4
-│   │                           ├── output columns: [id (#9)]
-│   │                           ├── read rows: 3
-│   │                           ├── read size: < 1 KiB
-│   │                           ├── partitions total: 1
-│   │                           ├── partitions scanned: 1
-│   │                           ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
-│   │                           ├── push downs: [filters: [], limit: NONE]
-│   │                           └── estimated rows: 3.00
+│   │           ├── AggregateFinal(Build)
+│   │           │   ├── output columns: [k (#7)]
+│   │           │   ├── group by: [k]
+│   │           │   ├── aggregate functions: []
+│   │           │   ├── estimated rows: 1.00
+│   │           │   └── AggregatePartial
+│   │           │       ├── group by: [k]
+│   │           │       ├── aggregate functions: []
+│   │           │       ├── estimated rows: 1.00
+│   │           │       └── HashJoin
+│   │           │           ├── output columns: [k (#7)]
+│   │           │           ├── join type: INNER
+│   │           │           ├── build keys: [o.id (#6)]
+│   │           │           ├── probe keys: [j.id (#9)]
+│   │           │           ├── keys is null equal: [false]
+│   │           │           ├── filters: []
+│   │           │           ├── estimated rows: 1.80
+│   │           │           ├── Filter(Build)
+│   │           │           │   ├── output columns: [id (#6), k (#7)]
+│   │           │       
```

**File**: `tests/sqllogictests/suites/query/issues/issue_20483.test` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# GitHub issue: https://github.com/databendlabs/databend/issues/20483
+#
+# The eager-aggregation rewrite used to move a scalar aggregate (an aggregate
+# that keeps no GROUP BY column of its own) below a CROSS join. A scalar
+# aggregate emits exactly one row even when its input is empty, so the rewritten
+# join gained a one-row build side and emitted probe rows that the zero-match
+# WHERE predicate had removed.
+
+statement ok
+DROP TABLE IF EXISTS issue_20483_t0
+
+statement ok
+DROP TABLE IF EXISTS issue_20483_t1
+
+statement ok
+CREATE TABLE issue_20483_t0(d DATE NOT NULL)
+
+statement ok
+CREATE TABLE issue_20483_t1(v VARCHAR NOT NULL)
+
+statement ok
+INSERT INTO issue_20483_t0 VALUES (DATE '1969-12-27'), (DATE '1969-12-31')
+
+# LENGTH(REGEXP_SUBSTR(v, '[0-9]{3}')) is 3 for a three-digit match and NULL for
+# no match, so `< 2` is never TRUE for any row.
+statement ok
+INSERT INTO issue_20483_t1 VALUES ('a'),('b'),('c'),('d'),('e'),('f'),('g'),('h'),('i')
+
+# The zero-match WHERE predicate must survive the constant-true HAVING branch.
+query I
+SELECT t0.d FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+WHERE LENGTH(REGEXP_SUBSTR(t1.v, '[0-9]{3}')) < 2
+GROUP BY t0.d
+HAVING (1=1) OR (COUNT(t1.v) != COUNT(t0.d));
+----
+
+# The same query with the HAVING predicate relocated into a derived table is the
+# reference result.
+query I
+SELECT ref0 FROM (
+  SELECT t0.d AS ref0, ((1=1) OR (COUNT(t1.v) != COUNT(t0.d))) AS ref1
+  FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+  WHERE LENGTH(REGEXP_SUBSTR(t1.v, '[0-9]{3}')) < 2
+  GROUP BY t0.d
+) s WHERE ref1;
+----
+
+# The aggregate over the join must agree with the aggregate over a derived empty
+# table: the cross join produces no rows, so there are no groups at all.
+query II
+SELECT t0.d, COUNT(t1.v) FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+WHERE LENGTH(REGEXP_SUBSTR(t1.v, '[0-9]{3}')) < 2
+GROUP BY t0.d
+ORDER BY t0.d;
+----
+
+query II
+SELECT t0.d, COUNT(t1.v) FROM issue_20483_t0 AS t0,
+  (SELECT v FROM issue_20483_t1 WHERE 1=0) AS t1
+GROUP BY t0.d
+ORDER BY t0.d;
+----
+
+# Without the WHERE predicate the rewrite is still valid and the count is the
+# full right-hand row count.
+query II
+SELECT t0.d, COUNT(t1.v) FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+GROUP BY t0.d
+ORDER BY t0.d;
+----
+1969-12-27	9
+1969-12-31	9
+
+statement ok
+DROP TABLE issue_20483_t0
+
+statement ok
+DROP TABLE issue_20483_t1
```

---

### Incident Patch 3: `f30229ee` (2026-09-29)
**Commit Message**: fix(storage): read Iceberg tables on Azure (abfs[s]) (#20590)

- enable iceberg-rust's storage-azdls: its storage-all covers memory, fs,
  s3 and gcs only, so every abfs[s]:// table failed to load with
  "Constructing file io from scheme: azdls not supported now"
- IcebergFileIO: start the relative path after the whole authority. For
  abfss://<filesystem>@<host>/... it skipped only scheme://host/, cutting
  the path inside the filesystem name
- IcebergFileIO: set Azdls filesystem and endpoint from the location, and
  map the adls.tenant-id/client-id/client-secret/authority-host keys

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +2/-0)
```diff
@@ -291,6 +291,8 @@ quote = "1.0"
 ## Arrow 58 compatible variant metadata support.
 iceberg = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012", features = [
     "storage-all",
+    # Not in iceberg-rust's `storage-all`: without it every abfs[s]:// table fails to load.
+    "storage-azdls",
 ] }
 iceberg-catalog-glue = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
 iceberg-catalog-hms = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
```

**File**: `src/common/storage/src/operator.rs` (modified, +51/-6)
```diff
@@ -786,12 +786,12 @@ impl IcebergFileIO {
             let bucket = url
                 .host_str()
                 .ok_or_else(|| Error::new(ErrorKind::InvalidInput, "missing bucket in URL"))?;
-            let prefix = format!("{}://{}/", scheme, bucket);
-            let relative_path_pos = if location.starts_with(&prefix) {
-                prefix.len()
-            } else {
-                url.scheme().len() + 3 + bucket.len() + 1
-            };
+            // The relative path starts after the authority, which can carry userinfo:
+            // abfss://<filesystem>@<account>.dfs.core.windows.net/<path>.
+            let authority_start = scheme.len() + 3;
+            let relative_path_pos = location[authority_start..]
+                .find('/')
+                .map_or(location.len(), |i| authority_start + i + 1);
             (Some(bucket), relative_path_pos)
         };
 
@@ -871,6 +871,10 @@ impl IcebergFileIO {
                 "adls.account-name" | "azure.account-name" => Some("account_name"),
                 "adls.account-key" | "azure.account-key" => Some("account_key"),
                 "adls.sas-token" | "azure.sas-token" => Some("sas_token"),
+                "adls.tenant-id" => Some("tenant_id"),
+                "adls.client-id" => Some("client_id"),
+                "adls.client-secret" => Some("client_secret"),
+                "adls.authority-host" => Some("authority_host"),
                 _ => {
                     opendal_config.insert(key.clone(), value.clone());
                     None
@@ -882,6 +886,26 @@ impl IcebergFileIO {
             }
         }
 
+        // Azdls names the container `filesystem` and needs the account endpoint; both are in
+        // the location (`abfss://<filesystem>@<host>/...`), as iceberg-rust's own Azdls
+        // storage reads them.
+        if matches!(scheme, "abfs" | "abfss" | "wasb" | "wasbs") {
+            if !url.username().is_empty() {
+                opendal_config
+                    .entry("filesystem".to_string())
+                    .or_insert_with(|| url.username().to_string());
+            }
+            if let Some(host) = url.host_str() {
+                let http = match scheme {
+                    "abfs" | "wasb" => "http",
+                    _ => "https",
+                };
+                opendal_config
+                    .entry("endpoint".to_string())
+                    .or_insert_with(|| format!("{http}://{host}"));
+            }
+        }
+
         let opendal_scheme = match self.scheme.as_str() {
             "s3" | "s3a" => opendal::Scheme::S3,
             "gs" | "gcs" => opendal::Scheme::Gcs,
@@ -945,6 +969,27 @@ mod tests {
         assert_eq!(path_pos, "s3://bucket/".len());
     }
 
+    #[test]
+    fn iceberg_file_io_azdls_path_skips_filesystem_in_authority() {
+        let file_io = IcebergFileIO {
+            scheme: "abfss".to_string(),
+            props: HashMap::from([("adls.sas-token".to_string(), "sv=token".to_string())]),
+        };
+
+        for prefix in [
+            "abfss://myfs@myaccount.dfs.core.windows.net/",
+            "abfss://myfs@onelake.dfs.fabric.microsoft.com/",
+        ] {
+            let location = format!("{prefix}lakehouse/Tables/ns/t/data/file.parquet");
+            let res = file_io.build_operator(&location);
+
+            assert!(res.is_ok(), "operator build failed: {:?}", res.err());
+            let (op, path_pos) = res.unwrap();
+            assert_eq!(path_pos, prefix.len());
+            assert_eq!(op.info().name(), "myfs");
+        }
+    }
+
     #[test]
     fn iceberg_file_io_rejects_partial_explicit_s3_credentials() {
         let file_io = IcebergFileIO {
```

---

### Incident Patch 4: `7d6d8c14` (2026-09-29)
**Commit Message**: fix(parser): accept and ignore LIMIT in VACUUM DROP TABLE (#20586)

Older clients and internal tasks still send
`VACUUM DROP TABLE [FROM db] LIMIT n`, which was rejected after the
vacuum syntax unification. Parse the LIMIT for compatibility and ignore it.

**File**: `src/query/ast/src/parser/statement.rs` (modified, +4/-2)
```diff
@@ -1470,9 +1470,11 @@ pub fn statement_body(i: Input) -> IResult<Statement> {
     let vacuum_all = value(Statement::VacuumAll(VacuumAllStmt), rule! { VACUUM ~ ALL });
     let vacuum_drop_table = map(
         rule! {
-            VACUUM ~ DROP ~ TABLE ~ (FROM ~ ^#ident)?
+            VACUUM ~ DROP ~ TABLE ~ (FROM ~ ^#ident)? ~ (LIMIT ~ #literal_u64)?
         },
-        |(_, _, _, database_option)| {
+        // `LIMIT` is accepted for compatibility with clients that still send the
+        // legacy `VACUUM DROP TABLE [FROM db] LIMIT n` syntax; the value is ignored.
+        |(_, _, _, database_option, _limit)| {
             Statement::VacuumDropTable(VacuumDropTableStmt {
                 database: database_option.map(|(_, database)| database),
             })
```

**File**: `src/query/ast/tests/it/parser.rs` (modified, +18/-1)
```diff
@@ -1445,7 +1445,6 @@ fn test_removed_vacuum_syntax() {
         "VACUUM ALL LIMIT 10",
         "VACUUM DROP TABLE DRY RUN",
         "VACUUM DROP TABLE DRY RUN SUMMARY",
-        "VACUUM DROP TABLE FROM db LIMIT 10",
         "VACUUM DROP TABLE FROM catalog.db",
         "VACUUM DROPPED OBJECTS FROM db LIMIT 10",
         "VACUUM DROPPED OBJECTS FROM catalog.db",
@@ -1465,6 +1464,24 @@ fn test_removed_vacuum_syntax() {
     }
 }
 
+#[test]
+fn test_vacuum_drop_table_legacy_limit_ignored() {
+    let cases = [
+        ("VACUUM DROP TABLE LIMIT 1000", "VACUUM DROP TABLE"),
+        (
+            "VACUUM DROP TABLE FROM db LIMIT 10",
+            "VACUUM DROP TABLE FROM db",
+        ),
+    ];
+
+    for (sql, expected) in cases {
+        let tokens = tokenize_sql(sql).unwrap();
+        let (stmt, _) = parse_sql(&tokens, Dialect::PostgreSQL).unwrap();
+        assert!(matches!(stmt, Statement::VacuumDropTable(_)), "{sql}");
+        assert_eq!(stmt.to_string(), expected, "{sql}");
+    }
+}
+
 #[test]
 fn test_file_format_trim_space_option() {
     let sql = r#"
```

---

### Incident Patch 5: `a5909393` (2026-09-29)
**Commit Message**: fix(query): match nullable lateral correlation keys (#20583)

**File**: `src/query/sql/src/planner/binder/bind_table_reference/bind_join.rs` (modified, +13/-4)
```diff
@@ -420,11 +420,20 @@ impl Binder {
                 &mut right_conditions,
                 &mut left_conditions,
             )?;
+            // These conditions reconnect the flattened lateral subquery to the outer row. They
+            // are internal correlation keys rather than user-written equality predicates, so
+            // NULL correlation groups must match each other.
             if build_side_cache_info.is_some() {
-                let num_conditions = left_conditions.len();
-                for i in original_num_conditions..num_conditions {
-                    is_null_equal.push(i);
-                }
+                is_null_equal.extend(original_num_conditions..left_conditions.len());
+            } else {
+                is_null_equal.extend(
+                    SubqueryDecorrelatorOptimizer::nullable_condition_indexes(
+                        &left_conditions[original_num_conditions..],
+                        &right_conditions[original_num_conditions..],
+                    )
+                    .into_iter()
+                    .map(|index| index + original_num_conditions),
+                );
             }
             if join_type == JoinType::Cross {
                 join_type = JoinType::Inner;
```

**File**: `tests/sqllogictests/suites/query/lateral.test` (modified, +94/-0)
```diff
@@ -331,5 +331,99 @@ a e r2021 NULL
 a e r2022 NULL
 a e r2023 NULL
 
+# NULL correlation values must reconnect the flattened lateral subquery to the outer row.
+statement ok
+create or replace table nullable_lateral_outer(id int, k int null)
+
+statement ok
+insert into nullable_lateral_outer values (1, 1), (2, NULL), (3, 5)
+
+statement ok
+create or replace table nullable_lateral_inner(k int null, v int)
+
+statement ok
+insert into nullable_lateral_inner values (1, 10), (NULL, 20), (NULL, 30)
+
+statement ok
+set enable_experimental_new_join = 0
+
+query II
+select o.id, t.x from nullable_lateral_outer o, lateral (select o.k as x) t order by o.id
+----
+1 1
+2 NULL
+3 5
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where o.k is null) t order by o.id, t.v
+----
+2 10
+2 20
+2 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where i.v > o.k or o.k is null) t order by o.id, t.v
+----
+1 10
+1 20
+1 30
+2 10
+2 20
+2 30
+3 10
+3 20
+3 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o left join lateral (select v from nullable_lateral_inner i where o.k is null) t on true order by o.id, t.v
+----
+1 NULL
+2 10
+2 20
+2 30
+3 NULL
+
+statement ok
+set enable_experimental_new_join = 1
+
+query II
+select o.id, t.x from nullable_lateral_outer o, lateral (select o.k as x) t order by o.id
+----
+1 1
+2 NULL
+3 5
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where o.k is null) t order by o.id, t.v
+----
+2 10
+2 20
+2 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where i.v > o.k or o.k is null) t order by o.id, t.v
+----
+1 10
+1 20
+1 30
+2 10
+2 20
+2 30
+3 10
+3 20
+3 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o left join lateral (select v from nullable_lateral_inner i where o.k is null) t on true order by o.id, t.v
+----
+1 NULL
+2 10
+2 20
+2 30
+3 NULL
+
+statement ok
+unset enable_experimental_new_join
+
 statement ok
 drop database test_lateral
```

---

### Incident Patch 6: `1e44fe75` (2026-09-29)
**Commit Message**: fix(query): preserve time in string date arithmetic (#20585)

* fix(query): preserve time in string date arithmetic

* test(query): add golden tests for string inputs to time arithmetic functions

**File**: `src/query/functions/src/cast_rules.rs` (modified, +19/-0)
```diff
@@ -57,6 +57,25 @@ pub fn register(registry: &mut FunctionRegistry) {
     registry.register_default_cast_rules(CAST_FROM_VARIANT_RULES());
     registry.register_auto_try_cast_rules(CAST_FROM_VARIANT_RULES());
 
+    // Time arithmetic returns a Timestamp even for Date inputs. Prefer parsing strings as
+    // Timestamp so that a time component is not silently discarded by the Date overload.
+    let time_arith_cast_rules = registry
+        .default_cast_rules
+        .iter()
+        .filter(|(src, dest)| !matches!((src, dest), (DataType::String, DataType::Date)))
+        .cloned()
+        .collect::<Vec<_>>();
+    for func_name in [
+        "add_hours",
+        "add_minutes",
+        "add_seconds",
+        "subtract_hours",
+        "subtract_minutes",
+        "subtract_seconds",
+    ] {
+        registry.register_additional_cast_rules(func_name, time_arith_cast_rules.iter().cloned());
+    }
+
     for func_name in ["and", "or", "not", "xor", "and_filters", "or_filters"] {
         for data_type in ALL_INTEGER_TYPES {
             registry.register_additional_cast_rules(func_name, [(
```

**File**: `src/query/functions/tests/it/scalars/datetime.rs` (modified, +29/-0)
```diff
@@ -49,6 +49,7 @@ fn test_datetime() {
     test_to_date(file);
     test_date_add_subtract(file);
     test_timestamp_add_subtract(file);
+    test_string_time_add_subtract(file);
     test_date_date_add_sub(file);
     test_timestamp_date_add_sub(file);
     test_date_arith(file);
@@ -300,6 +301,34 @@ fn test_timestamp_add_subtract(file: &mut impl Write) {
     ]);
 }
 
+// String inputs for hour/minute/second arithmetic must resolve to the Timestamp
+// overload so the time component is preserved. Day-based arithmetic keeps the
+// Date overload, since its semantics are whole days.
+fn test_string_time_add_subtract(file: &mut impl Write) {
+    run_ast(file, "add_hours('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "add_minutes('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "add_seconds('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_hours('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_minutes('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_seconds('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_minutes('2026-09-26', 5)", &[]);
+    run_ast(file, "add_days('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "add_hours(a, b)", &[
+        (
+            "a",
+            StringType::from_data(vec!["2026-09-26 08:34:00", "2026-09-26"]),
+        ),
+        ("b", Int32Type::from_data(vec![1, 2])),
+    ]);
+    run_ast(file, "subtract_seconds(a, b)", &[
+        (
+            "a",
+            StringType::from_data(vec!["2026-09-26 08:34:00", "2026-09-26"]),
+        ),
+        ("b", Int32Type::from_data(vec![1, 2])),
+    ]);
+}
+
 fn test_date_date_add_sub(file: &mut impl Write) {
     run_ast(file, "date_add(year, 10000, to_date(0))", &[]); // failed
     run_ast(file, "date_add(year, 100, to_date(0))", &[]);
```

**File**: `src/query/functions/tests/it/scalars/testdata/datetime.txt` (modified, +116/-0)
```diff
@@ -1099,6 +1099,122 @@ evaluation (internal):
 +--------+-------------------------------------------+
 
 
+ast            : add_hours('2026-09-26 08:34:00', 1)
+raw expr       : add_hours('2026-09-26 08:34:00', 1)
+checked expr   : add_hours<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790415240000000
+output type    : Timestamp
+output domain  : {1790415240000000..=1790415240000000}
+output         : '2026-09-26 09:34:00.000000'
+
+
+ast            : add_minutes('2026-09-26 08:34:00', 1)
+raw expr       : add_minutes('2026-09-26 08:34:00', 1)
+checked expr   : add_minutes<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411700000000
+output type    : Timestamp
+output domain  : {1790411700000000..=1790411700000000}
+output         : '2026-09-26 08:35:00.000000'
+
+
+ast            : add_seconds('2026-09-26 08:34:00', 1)
+raw expr       : add_seconds('2026-09-26 08:34:00', 1)
+checked expr   : add_seconds<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411641000000
+output type    : Timestamp
+output domain  : {1790411641000000..=1790411641000000}
+output         : '2026-09-26 08:34:01.000000'
+
+
+ast            : subtract_hours('2026-09-26 08:34:00', 1)
+raw expr       : subtract_hours('2026-09-26 08:34:00', 1)
+checked expr   : subtract_hours<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790408040000000
+output type    : Timestamp
+output domain  : {1790408040000000..=1790408040000000}
+output         : '2026-09-26 07:34:00.000000'
+
+
+ast            : subtract_minutes('2026-09-26 08:34:00', 1)
+raw expr       : subtract_minutes('2026-09-26 08:34:00', 1)
+checked expr   : subtract_minutes<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411580000000
+output type    : Timestamp
+output domain  : {1790411580000000..=1790411580000000}
+output         : '2026-09-26 08:33:00.000000'
+
+
+ast            : subtract_seconds('2026-09-26 08:34:00', 1)
+raw expr       : subtract_seconds('2026-09-26 08:34:00', 1)
+checked expr   : subtract_seconds<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411639000000
+output type    : Timestamp
+output domain  : {1790411639000000..=1790411639000000}
+output         : '2026-09-26 08:33:59.000000'
+
+
+ast            : subtract_minutes('2026-09-26', 5)
+raw expr       : subtract_minutes('2026-09-26', 5)
+checked expr   : subtract_minutes<Timestamp, Int64>(CAST<String>("2026-09-26" AS Timestamp), CAST<UInt8>(5_u8 AS Int64))
+optimized expr : 1790380500000000
+output type    : Timestamp
+output domain  : {1790380500000000..=1790380500000000}
+output         : '2026-09-25 23:55:00.000000'
+
+
+ast            : add_days('2026-09-26 08:34:00', 1)
+raw expr       : add_days('2026-09-26 08:34:00', 1)
+checked expr   : add_days<Date, Int64>(CAST<String>("2026-09-26 08:34:00" AS Date), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 20723
+output type    : Date
+output domain  : {20723..=20723}
+output         : '2026-09-27'
+
+
+ast            : add_hours(a, b)
+raw expr       : add_hours(a::String, b::Int32)
+checked expr   : add_hours<Timestamp, Int64>(CAST<String>(a AS Timestamp), CAST<Int32>(b AS Int64))
+evaluation:
++--------+----------------------------------------+---------+------------------------------+
+|        | a                                      | b       | Output                       |
++--------+----------------------------------------+---------+------------------------------+
+| Type   | String                                 | Int32   | Timestamp                    |
+| Domain | {"2026-09-26"..="2026-09-26 08:34:00"} | {1..=2} | Unknown                      |
+| Row 0  | '2026-09-26 08:34:00'                  | 1       | '2026-09-26 09:34:00.000000' |
+| Row 1  | '2026-09-26'                           | 2       | '2026-09-26 02:00:00.000000' |
++--------+----------------------------------------+---------+------------------------------+
+evaluation (internal):
++--------+-------------------------------------------------------+
+| Column | Data                                                  |
++--------+-------------------------------------------------------+
+| a      | Column(StringColumn[2026-09-26 08:34:00, 2026-09-26]) |
+| b      | Column(Int32([1, 2]))                                 |
+| Output | Timestamp([1790415240000000, 1790388000000000])       |
++--------+-------------------------------------------------------+
+
+
+ast            : subtract_seconds(a, b)
+raw expr       : subtract_seconds(a::String, b::Int32)
+checked expr   : subtract_seconds<Timestamp, Int64>(CAST<String>(a AS Timestamp), CAST<Int32>(b AS Int64))
+evaluation:
++--------
```

**File**: `tests/sqllogictests/suites/query/functions/02_0012_function_datetimes.test` (modified, +47/-0)
```diff
@@ -862,6 +862,53 @@ select add_hours(to_datetime('9999-12-29 23:59:59'), 1)
 ----
 9999-12-30 00:59:59.000000
 
+# String inputs to time arithmetic must retain the time component.
+query T
+select subtract_minutes('2026-09-26 08:34:00', 5)
+----
+2026-09-26 08:29:00.000000
+
+query IIIIII
+select
+    add_hours('2026-09-26 08:34:00', 1) = add_hours(to_timestamp('2026-09-26 08:34:00'), 1),
+    add_minutes('2026-09-26 08:34:00', 1) = add_minutes(to_timestamp('2026-09-26 08:34:00'), 1),
+    add_seconds('2026-09-26 08:34:00', 1) = add_seconds(to_timestamp('2026-09-26 08:34:00'), 1),
+    subtract_hours('2026-09-26 08:34:00', 1) = subtract_hours(to_timestamp('2026-09-26 08:34:00'), 1),
+    subtract_minutes('2026-09-26 08:34:00', 1) = subtract_minutes(to_timestamp('2026-09-26 08:34:00'), 1),
+    subtract_seconds('2026-09-26 08:34:00', 1) = subtract_seconds(to_timestamp('2026-09-26 08:34:00'), 1)
+----
+1 1 1 1 1 1
+
+query T
+select date_sub(minute, 5, '2026-09-26 08:34:00')
+----
+2026-09-26 08:29:00.000000
+
+query T
+select date_add(minute, 5, '2026-09-26 08:34:00')
+----
+2026-09-26 08:39:00.000000
+
+query T
+select date_sub(minute, 5, to_date('2026-09-26'))
+----
+2026-09-25 23:55:00.000000
+
+query T
+select date_add(minute, 5, to_date('2026-09-26'))
+----
+2026-09-26 00:05:00.000000
+
+query T
+select subtract_minutes('2026-09-26', 5)
+----
+2026-09-25 23:55:00.000000
+
+query T
+select subtract_minutes(to_date('2026-09-26'), 5)
+----
+2026-09-25 23:55:00.000000
+
 # 2020-2-29T10:00:00 - 1 minutes
 query ?
 select subtract_minutes(to_datetime(1582970400000000), cast(1, INT32))
```

---

### Incident Patch 7: `dc0acaa3` (2026-09-28)
**Commit Message**: fix(meta): keep in-progress CTAS staging table from vacuum (#20581)

**File**: `src/meta/api/src/api_impl/auto_increment_api_test_suite.rs` (modified, +3/-1)
```diff
@@ -108,7 +108,9 @@ impl AutoIncrementApiTestSuite {
             drop_on: Some(created_on),
             ..TableMeta::default()
         };
-        let created_on = Utc::now();
+        // CTAS staging tables are protected from vacuum for the default retention
+        // period (1 day), so create it as if it were dropped 2 days ago.
+        let created_on = Utc::now() - chrono::Duration::days(2);
 
         // verify the auto increment will be vacuum
         {
```

**File**: `src/meta/api/src/api_impl/garbage_collection_api.rs` (modified, +31/-0)
```diff
@@ -77,6 +77,7 @@ use log::error;
 use log::info;
 use log::warn;
 
+use super::data_retention_util::is_drop_time_retainable;
 use super::index_api::IndexApi;
 use crate::kv_app_error::KVAppError;
 use crate::kv_pb_api::KVPbApi;
@@ -176,6 +177,14 @@ where
 
 pub const ORPHAN_POSTFIX: &str = "orphan";
 
+/// Returns true if `table_name` is the history name of a CTAS staging table,
+/// i.e. `orphan@<ts>`, created by `create_table` with `as_dropped = true`.
+fn is_orphan_table_name(table_name: &str) -> bool {
+    table_name
+        .strip_prefix(ORPHAN_POSTFIX)
+        .is_some_and(|rest| rest.starts_with('@'))
+}
+
 /// Remove copied files for a dropped table.
 ///
 /// Dropped table can not be accessed by any query,
@@ -253,6 +262,10 @@ async fn remove_copied_files_for_dropped_table(
 /// Lists all dropped and non-dropped tables belonging to a Database,
 /// returns those tables that are eligible for garbage collection,
 /// i.e., whose dropped time is in the specified range.
+///
+/// CTAS staging tables (`orphan@<ts>`) whose `drop_on` is within the default
+/// retention period are always skipped, to protect an in-progress CTAS from
+/// being vacuumed concurrently.
 #[logcall::logcall(input = "")]
 #[fastrace::trace]
 pub async fn get_history_tables_for_gc(
@@ -307,6 +320,7 @@ pub async fn get_history_tables_for_gc(
     let mut filter_tb_infos = vec![];
     const BATCH_SIZE: usize = 1000;
 
+    let now = Utc::now();
     let args_len = args.len();
     let mut num_out_of_time_range = 0;
     let mut num_processed = 0;
@@ -365,6 +379,23 @@ pub async fn get_history_tables_for_gc(
                     num_out_of_time_range += 1;
                     continue;
                 }
+
+                // A CTAS staging table (`orphan@<ts>`) is created with `drop_on = now` and is
+                // only turned into a visible table by `commit_table_meta` after all data is
+                // written. A vacuum with a short retention (e.g. 0 days) must not collect it
+                // while the CTAS may still be running, otherwise the files written afterward
+                // are left without any metadata. Keep such tables for at least the default
+                // retention period, regardless of the requested retention.
+                if is_orphan_table_name(table_name)
+                    && is_drop_time_retainable(seq_meta.drop_on, now)
+                {
+                    info!(
+                        "get_history_tables_for_gc: skip CTAS staging table {} {:?}, drop_on {:?} is within the minimum retention period",
+                        table_name, table_id, seq_meta.drop_on
+                    );
+                    num_out_of_time_range += 1;
+                    continue;
+                }
             }
 
             filter_tb_infos.push(TableNIV::new(
```

**File**: `src/meta/schema-api-test-suite/src/schema_api_test_suite.rs` (modified, +89/-1)
```diff
@@ -318,6 +318,8 @@ impl SchemaApiTestSuite {
             + 'static,
     {
         self.table_commit_table_meta(&b.build().await).await?;
+        self.vacuum_skips_recent_ctas_orphan(&b.build().await)
+            .await?;
         self.table_commit_after_drop_different_engine(&b.build().await)
             .await?;
         self.table_commit_table_meta_engine_mismatch(&b.build().await)
@@ -6649,6 +6651,10 @@ impl SchemaApiTestSuite {
             let db_id = orphan_util.db_id();
             let tenant = orphan_util.tenant();
 
+            // CTAS staging tables are protected from vacuum for the default retention
+            // period (1 day), so create it as if it were dropped 2 days ago.
+            let orphan_created_on = Utc::now() - Duration::days(2);
+
             let create_table_req = CreateTableReq {
                 create_option: CreateOption::CreateOrReplace,
                 catalog_name: Some("default".to_string()),
@@ -6657,7 +6663,7 @@ impl SchemaApiTestSuite {
                     db_name: db_name.to_string(),
                     table_name: tbl_name.to_string(),
                 },
-                table_meta: drop_table_meta(created_on),
+                table_meta: drop_table_meta(orphan_created_on),
                 source_table_option: None,
                 as_dropped: true,
                 materialized_view: None,
@@ -6709,6 +6715,88 @@ impl SchemaApiTestSuite {
         Ok(())
     }
 
+    /// A vacuum with retention 0 must not collect the staging table of an in-progress CTAS,
+    /// otherwise its data is removed while the CTAS is still writing.
+    async fn vacuum_skips_recent_ctas_orphan<
+        MT: kvapi::KVApi<Error = MetaError> + DatabaseApi + TableApi + GarbageCollectionApi,
+    >(
+        &self,
+        mt: &MT,
+    ) -> anyhow::Result<()> {
+        let tenant_name = "vacuum_skips_recent_ctas_orphan_tenant";
+        let db_name = "db1";
+        let tbl_name = "t1";
+
+        let mut util = DbTableHarness::new(mt, tenant_name, db_name, tbl_name, "");
+        util.create_db().await?;
+        let tenant = util.tenant();
+
+        let staging_table_req = |drop_on: DateTime<Utc>| CreateTableReq {
+            create_option: CreateOption::CreateOrReplace,
+            catalog_name: Some("default".to_string()),
+            name_ident: TableNameIdent {
+                tenant: tenant.clone(),
+                db_name: db_name.to_string(),
+                table_name: tbl_name.to_string(),
+            },
+            table_meta: TableMeta {
+                schema: Arc::new(TableSchema::new(vec![TableField::new(
+                    "number",
+                    TableDataType::Number(NumberDataType::UInt64),
+                )])),
+                engine: "JSON".to_string(),
+                created_on: drop_on,
+                drop_on: Some(drop_on),
+                ..TableMeta::default()
+            },
+            source_table_option: None,
+            as_dropped: true,
+            materialized_view: None,
+            table_properties: None,
+            table_partition: None,
+        };
+
+        let dropped_table_ids = |drop_ids: &[DroppedId]| -> Vec<u64> {
+            drop_ids
+                .iter()
+                .filter_map(|id| match id {
+                    DroppedId::Table { id, .. } => Some(id.table_id),
+                    DroppedId::Db { .. } => None,
+                })
+                .collect()
+        };
+
+        info!("--- a just created CTAS staging table is not collected with retention 0");
+        {
+            let req = staging_table_req(Utc::now());
+            let resp = mt.create_table(req.clone()).await?;
+
+            let list_req =
+                ListDroppedTableReq::new4(&tenant, None::<String>, Some(Utc::now()), None);
+            let list_resp = mt.get_drop_table_infos(list_req).await?;
+            assert!(
+                !dropped_table_ids(&list_resp.drop_ids).contains(&resp.table_id),
+                "in-progress CTAS staging table must not be vacuumed"
+            );
+
+            // the CTAS can still be committed
+            mt.commit_table_meta(CommitTableMetaReq {
+                name_ident: req.name_ident.clone(),
+                db_id: resp.db_id,
+                table_id: resp.table_id,
+                prev_table_id: resp.prev_table_id,
+                orphan_table_name: resp.orphan_table_name.clone(),
+            })
+            .await?;
+
+            let table_key = TableId::new(resp.table_id);
+            let seqv = mt.get_pb(&table_key).await?.unwrap();
+            assert!(seqv.data.drop_on.is_none());
+        }
+
+        Ok(())
+    }
+
     async fn table_commit_after_drop_different_engine<MT>(&self, mt: &MT) -> anyhow::Result<()>
     where MT: kvapi::KVApi<Error = MetaError> + DatabaseApi + TableApi {
         let tenant_name = "table_commit_after_drop_different_engine";
```

**File**: `tests/sqllogictests/suites/ee/03_ee_vacuum/03_0000_vacuum_ctas.test` (modified, +10/-10)
```diff
@@ -12,7 +12,8 @@
 ## See the License for the specific language governing permissions and
 ## limitations under the License.
 
-# test orphan data created by failed CTAS could be vacuumed
+# test orphan data created by CTAS is not vacuumed within the minimum retention period (1 day),
+# even if data_retention_time_in_days = 0, since the CTAS may still be running concurrently.
 statement ok
 drop database if exists ctas_test;
 
@@ -35,7 +36,7 @@ select count() from system.tables_with_history where database = 'ctas_test' and
 ----
 0
 
-# verify the orphan files could be vacuumed
+# vacuum with retention 0 must not touch the CTAS staging data
 
 statement ok
 set data_retention_time_in_days = 0;
@@ -44,7 +45,7 @@ statement ok
 vacuum drop table from ctas_test;
 
 
-# the dropped table ctas_test.t should be vacuumed
+# there is still no visible table ctas_test.t
 query I
 select count() from system.tables_with_history where database = 'ctas_test' and name = 't';
 ----
@@ -55,15 +56,14 @@ statement ok
 create stage ctas_stage url='fs:///tmp/ctas/';
 
 
-# The data of the dropped table should be purged:
-# Listing the stage should return an empty result set,
-# except for the verification key '_v_d77aa11285c22e0e1d4593a035c98c0d',
-# which is 1 byte in size.
+# The data of the CTAS staging table should be kept:
+# besides the verification key '_v_d77aa11285c22e0e1d4593a035c98c0d',
+# the data files written by the CTAS are still there.
 
-query TI
-SELECT name, size FROM LIST_STAGE(location => '@ctas_stage')
+query B
+SELECT count() > 1 FROM LIST_STAGE(location => '@ctas_stage')
 ----
-_v_d77aa11285c22e0e1d4593a035c98c0d 1
+1
 
 statement ok
 drop database ctas_test;
```

---

### Incident Patch 8: `8d51739c` (2026-09-28)
**Commit Message**: fix(query): prune unused source columns before window buffering (#20572)

* fix(query): prune wide sources after materializing operator keys

* fix(query): preserve key bindings and runtime filter lineage

* fix(query): limit wide input pruning to windows

* refactor(query): record window input columns during binding

* fix(query): hash window partitions on evaluated keys

The window sort input already evaluates its partition items, so shuffle
on those columns instead of re-evaluating the expressions over source
columns. Wide source columns are then dropped before the exchange, and
WindowPartition no longer needs its own pre-projection.

Drop the join and range-join logic tests that covered the removed
pre-projection and runtime filter paths.

**File**: `src/query/service/src/physical_plans/physical_window.rs` (modified, +20/-17)
```diff
@@ -38,7 +38,6 @@ use databend_common_pipeline_transforms::MemorySettings;
 use databend_common_sql::ColumnSet;
 use databend_common_sql::ScalarExpr;
 use databend_common_sql::Symbol;
-use databend_common_sql::TypeCheck;
 use databend_common_sql::binder::wrap_cast;
 use databend_common_sql::executor::physical_plans::AggregateFunctionDesc;
 use databend_common_sql::executor::physical_plans::AggregateFunctionSignature;
@@ -525,32 +524,38 @@ impl PhysicalPlanBuilder {
             required.remove(&window.index);
         }
         for item in &window_group.scalar_items {
-            item.scalar.collect_used_columns(&mut required);
             required.insert(item.index);
         }
         for window in &window_group.windows {
             for item in &window.arguments {
-                item.scalar.collect_used_columns(&mut required);
                 required.insert(item.index);
             }
             for item in &window.partition_by {
-                item.scalar.collect_used_columns(&mut required);
                 required.insert(item.index);
             }
             for item in &window.order_by {
-                item.order_by_item
-                    .scalar
-                    .collect_used_columns(&mut required);
                 required.insert(item.order_by_item.index);
             }
         }
 
         let child = s_expr.child(0)?;
-        let input = self.build(child, required.clone()).await?;
+        // Sources are needed to evaluate the window inputs, but only the
+        // resulting columns and the parent's outputs need to survive the sort.
+        let mut input_required = required.clone();
+        for item in &window_group.scalar_items {
+            input_required.remove(&item.index);
+        }
+        for item in &window_group.scalar_items {
+            item.scalar.collect_used_columns(&mut input_required);
+        }
+        let input = self.build(child, input_required).await?;
         let input = if window_group.scalar_items.is_empty() {
             input
         } else {
-            let mut projections = required.iter().copied().collect::<Vec<_>>();
+            let mut projections = required
+                .union(self.metadata.read().get_retained_column())
+                .copied()
+                .collect::<Vec<_>>();
             for item in &window_group.scalar_items {
                 projections.push(item.index);
             }
@@ -617,20 +622,15 @@ impl PhysicalPlanBuilder {
         // left join ( select dense_rank() over(order by t1.a desc) as rk
         // from (select 'a2' as a) t1 )s2 on s1.rk=s2.rk;
 
-        // The scalar items in window function is not replaced yet.
-        // The will be replaced in physical plan builder.
+        // The child EvalScalar has already evaluated these expressions. Keep
+        // their results across the sort/window, not their source columns.
         window.arguments.iter().for_each(|item| {
-            item.scalar.collect_used_columns(&mut required);
             required.insert(item.index);
         });
         window.partition_by.iter().for_each(|item| {
-            item.scalar.collect_used_columns(&mut required);
             required.insert(item.index);
         });
         window.order_by.iter().for_each(|item| {
-            item.order_by_item
-                .scalar
-                .collect_used_columns(&mut required);
             required.insert(item.order_by_item.index);
         });
 
@@ -660,6 +660,10 @@ impl PhysicalPlanBuilder {
         let mut w = window.clone();
 
         if w.frame.units.is_range() && w.order_by.len() == 1 {
+            let mut common_ty = input_schema
+                .field_with_name(&w.order_by[0].order_by_item.index.to_string())?
+                .data_type()
+                .clone();
             let order_by = &mut w.order_by[0].order_by_item.scalar;
 
             let mut start = match &mut w.frame.start_bound {
@@ -673,7 +677,6 @@ impl PhysicalPlanBuilder {
                 _ => None,
             };
 
-            let mut common_ty = order_by.type_check(input_schema)?.data_type().clone();
             if common_ty.remove_nullable().is_timestamp() {
                 for scalar in start.iter_mut().chain(end.iter_mut()) {
                     let scalar_ty = scalar.as_ref().infer_data_type();
```

**File**: `src/query/service/tests/it/sql/exec/window.rs` (modified, +142/-0)
```diff
@@ -12,10 +12,152 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use std::sync::Arc;
+
+use databend_common_catalog::cluster_info::Cluster;
 use databend_common_exception::Result;
+use databend_common_expression::types::DataType;
+use databend_common_sql::Planner;
+use databend_common_sql::plans::Plan;
+use databend_meta_client::types::NodeInfo;
+use databend_query::clusters::ClusterHelper;
+use databend_query::physical_plans::PhysicalPlan;
+use databend_query::physical_plans::PhysicalPlanBuilder;
+use databend_query::physical_plans::Window;
+use databend_query::physical_plans::WindowGroup;
+use databend_query::physical_plans::WindowPartition;
+use databend_query::sessions::TableContextCluster;
+use databend_query::sessions::TableContextSettings;
 use databend_query::test_kits::TestFixture;
 use databend_query::test_kits::expects_ok;
 
+#[tokio::test(flavor = "multi_thread")]
+async fn test_window_inputs_prune_json_after_evaluation() -> Result<()> {
+    let fixture = TestFixture::setup().await?;
+    fixture
+        .execute_command("CREATE TABLE window_json_inputs (d VARIANT)")
+        .await?;
+
+    let cases = [
+        // The original SELECT/QUALIFY shape must reuse the window key columns.
+        (
+            "SELECT try_cast(d:id AS BIGINT) AS id, try_cast(d:ts AS BIGINT) AS ts \
+          FROM window_json_inputs \
+          QUALIFY row_number() OVER (PARTITION BY id ORDER BY ts DESC) = 1",
+            false,
+        ),
+        // Reuse also applies to a subexpression and a QUALIFY predicate.
+        (
+            "SELECT try_cast(d:id AS BIGINT) + 1 FROM window_json_inputs \
+          QUALIFY row_number() OVER (PARTITION BY try_cast(d:id AS BIGINT) \
+          ORDER BY try_cast(d:ts AS BIGINT)) = 1 AND try_cast(d:id AS BIGINT) > 0",
+            false,
+        ),
+        // Multiple windows canonicalize their partition/order input IDs.
+        (
+            "SELECT try_cast(d:id AS BIGINT) AS id, \
+          row_number() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT)) AS rn, \
+          rank() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT) DESC) AS r \
+          FROM window_json_inputs",
+            false,
+        ),
+        // A filter cannot move below the group that produces its reused key.
+        (
+            "SELECT try_cast(d:id AS BIGINT) AS id, \
+          row_number() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT)) AS rn, \
+          rank() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT) DESC) AS r \
+          FROM window_json_inputs QUALIFY id > 0",
+            false,
+        ),
+        // RANGE planning must use the evaluated order column's type.
+        (
+            "SELECT try_cast(d:ts AS BIGINT) AS ts, \
+          sum(try_cast(d:id AS BIGINT)) OVER (ORDER BY ts \
+          RANGE BETWEEN 1 PRECEDING AND CURRENT ROW) FROM window_json_inputs",
+            false,
+        ),
+        // The parent still needs the original JSON in these cases.
+        (
+            "SELECT d FROM window_json_inputs QUALIFY row_number() OVER \
+          (PARTITION BY try_cast(d:id AS BIGINT) ORDER BY try_cast(d:ts AS BIGINT)) = 1",
+            true,
+        ),
+        (
+            "SELECT d:payload FROM window_json_inputs QUALIFY row_number() OVER \
+          (PARTITION BY try_cast(d:id AS BIGINT) ORDER BY try_cast(d:ts AS BIGINT)) = 1",
+            true,
+        ),
+    ];
+
+    for nodes in [1, 3] {
+        for (sql, keep_json) in cases {
+            let ctx = fixture.new_query_ctx().await?;
+            ctx.get_settings()
+                .set_setting("enable_planner_cache".to_string(), "0".to_string())?;
+            if nodes == 3 {
+                let members = (0..nodes)
+                    .map(|id| {
+                        let mut node = NodeInfo::create(
+                            id.to_string(),
+                            String::new(),
+                            String::new(),
+                            String::new(),
+                            String::new(),
+                            String::new(),
+                            String::new(),
+                        );
+                        node.cluster_id = "cluster_id".to_string();
+                        node.warehouse_id = "warehouse_id".to_string();
+                        Arc::new(node)
+                    })
+                    .collect();
+                ctx.set_cluster(Cluster::create(members, "0".to_string()));
+            }
+            let (plan, _) = Planner::new(ctx.clone()).plan_sql(sql).await?;
+            let Plan::Query {
+                s_expr,
+                metadata,
+                bind_context,
+                ..
+            } = plan
+            else {
+                panic!("expected query plan");
+            };
+            let plan = PhysicalPlanBuilder::new(metadata, ctx, false)
+                .build(&s_expr, bind_context.colum
```

**File**: `src/query/sql/src/planner/binder/bind_query/bind_select.rs` (modified, +12/-3)
```diff
@@ -62,7 +62,9 @@ use crate::planner::binder::select::SelectAliasCatalog;
 use crate::planner::binder::select::SelectClauseFact;
 use crate::planner::binder::select::SelectList;
 use crate::planner::binder::sort::OrderItems;
+use crate::planner::binder::window::WindowInputColumns;
 use crate::plans::ScalarExpr;
+use crate::plans::VisitorMut as _;
 
 #[derive(Clone, Default)]
 struct SelectClauseFacts {
@@ -448,18 +450,25 @@ impl Binder {
 
         // bind window
         // window run after the HAVING clause but before the ORDER BY clause.
+        let mut window_inputs = WindowInputColumns::default();
         if !from_context.windows.window_functions.is_empty() {
-            let window_functions = from_context.windows.window_functions.clone();
-            s_expr = self.bind_window_functions(&window_functions, s_expr)?;
+            (s_expr, window_inputs) =
+                self.bind_window_functions(&from_context.windows.window_functions, s_expr)?;
+            for item in select_info.projection_scalars.values_mut() {
+                window_inputs.visit(&mut item.scalar)?;
+            }
         }
 
         // Bind lazy Set-returning functions after aggregate plan.
         if !from_context.srf_info.lazy_srf_set.is_empty() {
             s_expr = self.bind_project_set(&mut from_context, s_expr, true)?;
+            // Preserve the existing reuse boundary: extending QUALIFY reuse
+            // across ProjectSet row expansion is outside this refactor's scope.
+            window_inputs = WindowInputColumns::default();
         }
 
         if let Some(qualify) = qualify {
-            s_expr = self.bind_qualify(&mut from_context, qualify, s_expr)?;
+            s_expr = self.bind_qualify(&mut from_context, qualify, s_expr, &mut window_inputs)?;
         }
 
         if stmt.distinct {
```

**File**: `src/query/sql/src/planner/binder/qualify.rs` (modified, +4/-1)
```diff
@@ -24,6 +24,7 @@ use crate::binder::ExprContext;
 use crate::binder::ScalarBinder;
 use crate::binder::aggregate::AggregateRewriter;
 use crate::binder::into_conjunctions;
+use crate::binder::window::WindowInputColumns;
 use crate::binder::window::WindowRewriter;
 use crate::binder::window::find_replaced_window_function;
 use crate::optimizer::ir::SExpr;
@@ -66,11 +67,12 @@ impl Binder {
         Ok(scalar)
     }
 
-    pub fn bind_qualify(
+    pub(super) fn bind_qualify(
         &mut self,
         bind_context: &mut BindContext,
         qualify: ScalarExpr,
         child: SExpr,
+        window_inputs: &mut WindowInputColumns,
     ) -> Result<SExpr> {
         bind_context.expr_context = ExprContext::QualifyClause;
 
@@ -87,6 +89,7 @@ impl Binder {
                 let mut qualify_checker = QualifyChecker::new(bind_context);
                 qualify_checker.visit(&mut qualify)?;
             }
+            window_inputs.visit(&mut qualify)?;
             qualify
         };
 
```

**File**: `src/query/sql/src/planner/binder/window.rs` (modified, +74/-8)
```diff
@@ -55,12 +55,59 @@ use crate::plans::WindowOrderBy;
 use crate::plans::WindowPartition;
 use crate::plans::walk_expr_mut;
 
+/// Deterministic window inputs available to consumers in the same query block.
+/// Record the final column IDs after WindowGroup input canonicalization.
+#[derive(Default)]
+pub(super) struct WindowInputColumns {
+    scalars: HashMap<ScalarExpr, ScalarExpr>,
+}
+
+impl WindowInputColumns {
+    fn extend<'a>(&mut self, items: impl IntoIterator<Item = &'a ScalarItem>) -> Result<()> {
+        for item in items {
+            if matches!(
+                item.scalar,
+                ScalarExpr::FunctionCall(_) | ScalarExpr::CastExpr(_)
+            ) && item.scalar.is_deterministic()
+            {
+                self.scalars
+                    .entry(item.scalar.clone())
+                    .or_insert(item.bound_column_expr("window_input".to_string())?);
+            }
+        }
+        Ok(())
+    }
+}
+
+impl VisitorMut<'_> for WindowInputColumns {
+    fn visit(&mut self, expr: &mut ScalarExpr) -> Result<()> {
+        if let Some(column) = self.scalars.get(expr)
+            && column.data_type().as_ref() == expr.data_type().as_ref()
+        {
+            *expr = column.clone();
+            return Ok(());
+        }
+        // Only rewrite row-local consumers in this query block. Lambdas,
+        // subqueries, aggregates and window functions have separate scopes.
+        match expr {
+            ScalarExpr::FunctionCall(func) => {
+                for argument in &mut func.arguments {
+                    self.visit(argument)?;
+                }
+            }
+            ScalarExpr::CastExpr(cast) => self.visit(&mut cast.argument)?,
+            _ => {}
+        }
+        Ok(())
+    }
+}
+
 impl Binder {
     pub(super) fn bind_window_functions(
         &mut self,
         window_infos: &[WindowFunctionInfo],
         child: SExpr,
-    ) -> Result<SExpr> {
+    ) -> Result<(SExpr, WindowInputColumns)> {
         bind_window_function_infos(&self.ctx, window_infos, child)
     }
 
@@ -690,17 +737,30 @@ pub fn bind_window_function_info(
     ))
 }
 
-pub fn bind_window_function_infos(
+fn bind_window_function_infos(
     ctx: &Arc<dyn TableContext>,
     window_infos: &[WindowFunctionInfo],
     child: SExpr,
-) -> Result<SExpr> {
+) -> Result<(SExpr, WindowInputColumns)> {
+    let mut inputs = WindowInputColumns::default();
     if window_infos.is_empty() {
-        return Ok(child);
+        return Ok((child, inputs));
     }
 
-    if window_infos.len() == 1 {
-        return bind_window_function_info(ctx, &window_infos[0], child);
+    if let [window] = window_infos {
+        inputs.extend(
+            window
+                .arguments
+                .iter()
+                .chain(&window.partition_by_items)
+                .chain(
+                    window
+                        .order_by_items
+                        .iter()
+                        .map(|order| &order.order_by_item),
+                ),
+        )?;
+        return Ok((bind_window_function_info(ctx, window, child)?, inputs));
     }
 
     let mut groups = Vec::new();
@@ -777,9 +837,15 @@ pub fn bind_window_function_infos(
             .is_none_or(|window| window.partition_by.is_empty())
     });
 
-    Ok(groups.into_iter().fold(child, |child, window_group| {
+    // Prefer the outermost group's result when several groups evaluate the
+    // same expression, so consumers do not retain an earlier duplicate column.
+    for group in groups.iter().rev() {
+        inputs.extend(&group.scalar_items)?;
+    }
+    let child = groups.into_iter().fold(child, |child, window_group| {
         SExpr::create_unary(Arc::new(window_group.into()), Arc::new(child))
-    }))
+    });
+    Ok((child, inputs))
 }
 
 #[derive(Clone, Debug, PartialEq, Eq)]
```

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/filter_rules/rule_push_down_filter_window.rs` (modified, +10/-1)
```diff
@@ -16,6 +16,7 @@ use std::sync::Arc;
 
 use crate::ColumnSet;
 use crate::optimizer::ir::Matcher;
+use crate::optimizer::ir::RelExpr;
 use crate::optimizer::ir::SExpr;
 use crate::optimizer::optimizers::rule::Rule;
 use crate::optimizer::optimizers::rule::RuleID;
@@ -93,7 +94,15 @@ impl Rule for RulePushDownFilterWindow {
         let (window_plan, allowed, rejected) =
             if matches!(window_expr.plan(), RelOperator::WindowGroup(_)) {
                 let window_group: WindowGroup = window_expr.plan().clone().try_into()?;
-                let allowed = window_group_partition_by_columns(&window_group)?;
+                let mut allowed = window_group_partition_by_columns(&window_group)?;
+                // WindowGroup evaluates its scalar inputs internally. A reused
+                // partition expression can reference a column that does not yet
+                // exist below the group.
+                let child_columns = RelExpr::with_s_expr(window_expr.child(0)?)
+                    .derive_relational_prop()?
+                    .output_columns
+                    .clone();
+                allowed.retain(|column| child_columns.contains(column));
                 let rejected = window_group_rejected_columns(&window_group)?;
                 (RelOperator::WindowGroup(window_group), allowed, rejected)
             } else {
```

**File**: `src/query/sql/src/planner/plans/sort.rs` (modified, +3/-15)
```diff
@@ -142,11 +142,7 @@ impl Operator for Sort {
             return Ok(input_physical_prop);
         };
 
-        let partition_by = window
-            .partition_by
-            .iter()
-            .map(|s| s.scalar.clone())
-            .collect();
+        let partition_by = window.distribution_keys()?;
         Ok(PhysicalProperty {
             distribution: Distribution::GlobalHash(partition_by),
         })
@@ -172,11 +168,7 @@ impl Operator for Sort {
             return Ok(required);
         }
 
-        let partition_by = window
-            .partition_by
-            .iter()
-            .map(|s| s.scalar.clone())
-            .collect();
+        let partition_by = window.distribution_keys()?;
         required.distribution = Distribution::GlobalHash(partition_by);
 
         Ok(required)
@@ -201,11 +193,7 @@ impl Operator for Sort {
             return Ok(vec![vec![required]]);
         }
 
-        let partition_by = window
-            .partition_by
-            .iter()
-            .map(|s| s.scalar.clone())
-            .collect();
+        let partition_by = window.distribution_keys()?;
 
         required.distribution = Distribution::GlobalHash(partition_by);
         Ok(vec![vec![required]])
```

**File**: `src/query/sql/src/planner/plans/window.rs` (modified, +12/-0)
```diff
@@ -852,3 +852,15 @@ pub struct WindowPartition {
     pub top: Option<usize>,
     pub func: WindowFuncType,
 }
+
+impl WindowPartition {
+    /// Hash keys for shuffling the sort input. The input has already evaluated
+    /// the partition items, so hash their columns rather than re-evaluating the
+    /// expressions, which would keep the source columns alive across the exchange.
+    pub fn distribution_keys(&self) -> Result<Vec<ScalarExpr>> {
+        self.partition_by
+            .iter()
+            .map(|item| item.bound_column_expr("window_partition_key".to_string()))
+            .collect()
+    }
+}
```

---

### Incident Patch 9: `542c266a` (2026-09-28)
**Commit Message**: ci(sqllogictest): cover nullable mutation keys in cluster (#20569)

**File**: `tests/sqllogictests/scripts/gen_mutation_key_matrix.py` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+#!/usr/bin/env python3
+# Copyright 2021 Datafuse Labs
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Generate a shared MERGE/REPLACE key-type test and a cluster wrapper.
+
+Regenerate both files with:
+
+    python3 tests/sqllogictests/scripts/gen_mutation_key_matrix.py
+
+The expected *rows* are specified independently of key representation, not
+inferred by querying Databend. SQL equality does not match NULL to NULL, and
+REPLACE INTO deliberately retains rows whose conflict key is NULL (see
+09_0024_replace_into_decimal_key.test). We assert each operation's outcome
+separately rather than assuming MERGE and REPLACE have identical semantics.
+"""
+
+from dataclasses import dataclass
+from pathlib import Path
+
+SUITES = Path(__file__).resolve().parents[1] / "suites"
+OUTPUTS = {
+    "local": SUITES / "base" / "09_fuse_engine" / "09_0061_mutation_key_matrix.test",
+    "cluster": SUITES / "mode" / "cluster" / "mutation_key_matrix.test",
+}
+
+
+@dataclass(frozen=True)
+class Key:
+    name: str
+    data_type: str
+    values: tuple[str, str, str, str]
+
+
+KEYS = (
+    Key("int", "INT", ("1", "2", "3", "4")),
+    Key(
+        "decimal128",
+        "DECIMAL(38, 6)",
+        ("1.000001", "2.000002", "3.000003", "4.000004"),
+    ),
+    Key(
+        "date",
+        "DATE",
+        ("'2026-01-01'", "'2026-01-02'", "'2026-01-03'", "'2026-01-04'"),
+    ),
+    Key(
+        "timestamp",
+        "TIMESTAMP",
+        (
+            "'2026-01-01 00:00:01'",
+            "'2026-01-01 00:00:02'",
+            "'2026-01-01 00:00:03'",
+            "'2026-01-01 00:00:04'",
+        ),
+    ),
+)
+
+
+def statement(out: list[str], sql: str) -> None:
+    out.extend(("statement ok", sql, ""))
+
+
+def query(out: list[str], sql: str, rows: list[tuple[str, int]]) -> None:
+    out.extend(("query TI", f"{sql} ORDER BY v", "----"))
+    out.extend(f"{name} {is_null}" for name, is_null in sorted(rows))
+    out.append("")
+
+
+def mutation(out: list[str], op: str, table: str, source: str) -> None:
+    if op == "replace":
+        statement(out, f"REPLACE INTO {table} ON (k) SELECT k, v FROM {source}")
+    else:
+        statement(
+            out,
+            f"MERGE INTO {table} USING {source} AS s ON {table}.k = s.k "
+            "WHEN MATCHED THEN UPDATE SET v = s.v "
+            "WHEN NOT MATCHED THEN INSERT (k, v) VALUES (s.k, s.v)",
+        )
+
+
+def case(out: list[str], key: Key, nullable: bool, op: str) -> None:
+    suffix = "nullable" if nullable else "not_null"
+    table = f"mkm_{op}_{key.name}_{suffix}"
+    source = f"{table}_src"
+    k1, k2, k3, k4 = key.values
+    constraint = "NULL" if nullable else "NOT NULL"
+    out.append(f"# {op.upper()} / {key.data_type} / {constraint}")
+    # Small blocks and two separate inserts exercise multi-block reads and pruning.
+    statement(out, f"CREATE TABLE {table} (k {key.data_type} {constraint}, v STRING) ROW_PER_BLOCK = 2")
+    statement(out, f"CREATE TABLE {source} (k {key.data_type} {constraint}, v STRING)")
+    statement(out, f"INSERT INTO {table} VALUES ({k1}, 'old1'), ({k2}, 'old2')")
+    statement(out, f"INSERT INTO {table} VALUES ({k4}, 'old4')")
+    if nullable:
+        statement(out, f"INSERT INTO {table} VALUES (NULL, 'null_old')")
+    statement(out, f"INSERT INTO {source} VALUES ({k1}, 'new1'), ({k3}, 'new3')")
+    if nullable:
+        statement(out, f"INSERT INTO {source} VALUES (NULL, 'null_new')")
+    mutation(out, op, table, source)
+
+    rows = [("new1", 0), ("new3", 0), ("old2", 0), ("old4", 0)]
+    if nullable:
+        rows.extend((("null_old", 1), ("null_new", 1)))
+    query(out, f"SELECT v, if(k IS NULL, 1, 0) FROM {table}", rows)
+
+    # A second mutation re-matches the non-NULL key, but still does not
+    # match the NULL inserted in the previous statement.
+    statement(out, f"TRUNCATE TABLE {source}")
+    statement(out, f"INSERT INTO {source} VALUES ({k1}, 'new1_again')")
+    if nullable:
+        statement(out, f"INSERT INTO {source} VALUES (NULL, 'null_again')")
+    mutation(out, op, table, source)
+    rows = [("new1_again", 0), ("new3", 0), ("old2", 0), ("old4", 0)]
+    if nullable:
+        rows.extend((("null_old", 1), ("null_new", 1), ("null_again", 1)))
+    query(out, f"SELECT v, if(k IS NULL, 1, 0) FROM {table}", rows)
+
+    if nullable:
+        # All-NULL inputs cannot match on `=`. Both mutation operators must
+        # retain *all* old rows and insert each new
```

**File**: `tests/sqllogictests/suites/base/09_fuse_engine/09_0061_mutation_key_matrix.test` (added, +1098/-0)
```diff
@@ -0,0 +1,1098 @@
+# Generated by tests/sqllogictests/scripts/gen_mutation_key_matrix.py.
+# Do not edit by hand; change the generator and regenerate both files.
+# Row-set assertions cover matching, nonmatching and all-NULL keys,
+# including repeated mutations and multi-block targets.
+
+statement ok
+SET timezone = 'UTC'
+
+# REPLACE / INT / NOT NULL
+statement ok
+CREATE TABLE mkm_replace_int_not_null (k INT NOT NULL, v STRING) ROW_PER_BLOCK = 2
+
+statement ok
+CREATE TABLE mkm_replace_int_not_null_src (k INT NOT NULL, v STRING)
+
+statement ok
+INSERT INTO mkm_replace_int_not_null VALUES (1, 'old1'), (2, 'old2')
+
+statement ok
+INSERT INTO mkm_replace_int_not_null VALUES (4, 'old4')
+
+statement ok
+INSERT INTO mkm_replace_int_not_null_src VALUES (1, 'new1'), (3, 'new3')
+
+statement ok
+REPLACE INTO mkm_replace_int_not_null ON (k) SELECT k, v FROM mkm_replace_int_not_null_src
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_replace_int_not_null ORDER BY v
+----
+new1 0
+new3 0
+old2 0
+old4 0
+
+statement ok
+TRUNCATE TABLE mkm_replace_int_not_null_src
+
+statement ok
+INSERT INTO mkm_replace_int_not_null_src VALUES (1, 'new1_again')
+
+statement ok
+REPLACE INTO mkm_replace_int_not_null ON (k) SELECT k, v FROM mkm_replace_int_not_null_src
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_replace_int_not_null ORDER BY v
+----
+new1_again 0
+new3 0
+old2 0
+old4 0
+
+statement ok
+DROP TABLE mkm_replace_int_not_null_src
+
+statement ok
+DROP TABLE mkm_replace_int_not_null
+
+# REPLACE / INT / NULL
+statement ok
+CREATE TABLE mkm_replace_int_nullable (k INT NULL, v STRING) ROW_PER_BLOCK = 2
+
+statement ok
+CREATE TABLE mkm_replace_int_nullable_src (k INT NULL, v STRING)
+
+statement ok
+INSERT INTO mkm_replace_int_nullable VALUES (1, 'old1'), (2, 'old2')
+
+statement ok
+INSERT INTO mkm_replace_int_nullable VALUES (4, 'old4')
+
+statement ok
+INSERT INTO mkm_replace_int_nullable VALUES (NULL, 'null_old')
+
+statement ok
+INSERT INTO mkm_replace_int_nullable_src VALUES (1, 'new1'), (3, 'new3')
+
+statement ok
+INSERT INTO mkm_replace_int_nullable_src VALUES (NULL, 'null_new')
+
+statement ok
+REPLACE INTO mkm_replace_int_nullable ON (k) SELECT k, v FROM mkm_replace_int_nullable_src
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_replace_int_nullable ORDER BY v
+----
+new1 0
+new3 0
+null_new 1
+null_old 1
+old2 0
+old4 0
+
+statement ok
+TRUNCATE TABLE mkm_replace_int_nullable_src
+
+statement ok
+INSERT INTO mkm_replace_int_nullable_src VALUES (1, 'new1_again')
+
+statement ok
+INSERT INTO mkm_replace_int_nullable_src VALUES (NULL, 'null_again')
+
+statement ok
+REPLACE INTO mkm_replace_int_nullable ON (k) SELECT k, v FROM mkm_replace_int_nullable_src
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_replace_int_nullable ORDER BY v
+----
+new1_again 0
+new3 0
+null_again 1
+null_new 1
+null_old 1
+old2 0
+old4 0
+
+statement ok
+TRUNCATE TABLE mkm_replace_int_nullable
+
+statement ok
+TRUNCATE TABLE mkm_replace_int_nullable_src
+
+statement ok
+INSERT INTO mkm_replace_int_nullable VALUES (NULL, 'only_old1'), (NULL, 'only_old2')
+
+statement ok
+INSERT INTO mkm_replace_int_nullable_src VALUES (NULL, 'only_new')
+
+statement ok
+REPLACE INTO mkm_replace_int_nullable ON (k) SELECT k, v FROM mkm_replace_int_nullable_src
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_replace_int_nullable ORDER BY v
+----
+only_new 1
+only_old1 1
+only_old2 1
+
+statement ok
+DROP TABLE mkm_replace_int_nullable_src
+
+statement ok
+DROP TABLE mkm_replace_int_nullable
+
+# MERGE / INT / NOT NULL
+statement ok
+CREATE TABLE mkm_merge_int_not_null (k INT NOT NULL, v STRING) ROW_PER_BLOCK = 2
+
+statement ok
+CREATE TABLE mkm_merge_int_not_null_src (k INT NOT NULL, v STRING)
+
+statement ok
+INSERT INTO mkm_merge_int_not_null VALUES (1, 'old1'), (2, 'old2')
+
+statement ok
+INSERT INTO mkm_merge_int_not_null VALUES (4, 'old4')
+
+statement ok
+INSERT INTO mkm_merge_int_not_null_src VALUES (1, 'new1'), (3, 'new3')
+
+statement ok
+MERGE INTO mkm_merge_int_not_null USING mkm_merge_int_not_null_src AS s ON mkm_merge_int_not_null.k = s.k WHEN MATCHED THEN UPDATE SET v = s.v WHEN NOT MATCHED THEN INSERT (k, v) VALUES (s.k, s.v)
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_merge_int_not_null ORDER BY v
+----
+new1 0
+new3 0
+old2 0
+old4 0
+
+statement ok
+TRUNCATE TABLE mkm_merge_int_not_null_src
+
+statement ok
+INSERT INTO mkm_merge_int_not_null_src VALUES (1, 'new1_again')
+
+statement ok
+MERGE INTO mkm_merge_int_not_null USING mkm_merge_int_not_null_src AS s ON mkm_merge_int_not_null.k = s.k WHEN MATCHED THEN UPDATE SET v = s.v WHEN NOT MATCHED THEN INSERT (k, v) VALUES (s.k, s.v)
+
+query TI
+SELECT v, if(k IS NULL, 1, 0) FROM mkm_merge_int_not_null ORDER BY v
+----
+new1_again 0
+new3 0
+old2 0
+old4 0
+
+statement ok
+DROP TABLE mkm_merge_int_not_null_src
+
+statement ok
+DROP TABLE mkm_merge_int_not_null
+
+# MERGE / INT / NULL
+statement ok
+CREATE TABLE mkm_merge_int_nullable (k INT NULL, v STRING
```

**File**: `tests/sqllogictests/suites/mode/cluster/mutation_key_matrix.test` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+# Generated by tests/sqllogictests/scripts/gen_mutation_key_matrix.py.
+# Exercise the shared matrix with distributed MERGE and REPLACE enabled.
+
+query I
+SELECT if(count(*) >= 2, 1, 0) FROM system.clusters
+----
+1
+
+statement ok
+SET enable_distributed_replace_into = 1
+
+statement ok
+SET enable_distributed_merge_into = 1
+
+include ../../base/09_fuse_engine/09_0061_mutation_key_matrix.test
+
+statement ok
+UNSET enable_distributed_replace_into
+
+statement ok
+UNSET enable_distributed_merge_into
```

---

### Incident Patch 10: `8266d4a7` (2026-09-28)
**Commit Message**: fix(query): align name-filtered table history with list results (#20567)

**File**: `src/query/storages/system/src/tables_table.rs` (modified, +27/-3)
```diff
@@ -935,11 +935,35 @@ where TablesTable<WITH_HISTORY, WITHOUT_VIEW>: HistoryAware
                             }
                         }
                     } else if WITH_HISTORY {
-                        // Only can call get_table
-                        let mut tables = Vec::new();
+                        // Match the list path: include current tables and dropped history,
+                        // but exclude old table versions superseded by REPLACE with no drop_on.
+                        let mut tables = if default_catalog {
+                            let names: Vec<_> = tables_names.iter().cloned().collect();
+                            match ctl.mget_tables(&tenant, db_name, &names).await {
+                                Ok(t) => t,
+                                Err(err) => {
+                                    let msg = format!(
+                                        "Failed to get current tables in database: {}.{}, {}",
+                                        ctl.name(),
+                                        db_name,
+                                        err
+                                    );
+                                    warn!("{}", msg);
+                                    ctx.push_warning(msg);
+                                    continue;
+                                }
+                            }
+                        } else {
+                            Vec::new()
+                        };
                         for table_name in &tables_names {
                             match ctl.get_table_history(&tenant, db_name, table_name).await {
-                                Ok(t) => tables.extend(t),
+                                Ok(history) => {
+                                    tables.extend(history.into_iter().filter(|table| {
+                                        !default_catalog
+                                            || table.get_table_info().meta.drop_on.is_some()
+                                    }));
+                                }
                                 Err(err) => {
                                     let msg = format!(
                                         "Failed to get_table_history tables in database: {}.{}, {}",
```

**File**: `tests/sqllogictests/suites/base/12_time_travel/12_0007_history_name_filter.test` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+# CTAS REPLACE leaves the old table with drop_on = NULL. A name-filtered
+# history lookup must exclude it, just like the database-wide scan does.
+statement ok
+CREATE DATABASE db_12_0007_history
+
+statement ok
+CREATE TABLE db_12_0007_history.history_name_filter_120007 (id INT)
+
+# Preserve the original ID so the ID-only lookup can be checked after REPLACE.
+statement ok
+SET VARIABLE history_name_filter_old_id = (SELECT table_id FROM system.tables
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007')
+
+statement ok
+CREATE OR REPLACE TABLE db_12_0007_history.history_name_filter_120007 AS SELECT 1 AS id
+
+statement ok
+SET VARIABLE history_name_filter_new_id = (SELECT table_id FROM system.tables
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007')
+
+query B
+SELECT count(*) = 1 AND max(table_id) = (
+    SELECT table_id FROM system.tables
+    WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+) FROM system.tables_with_history
+WHERE name = 'history_name_filter_120007'
+----
+1
+
+query B
+SELECT count(*) = 1 FROM system.tables_with_history
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+----
+1
+
+# Check the actual rows as well as the counts above. A superseded ID
+# must return no rows, while the new ID still resolves to the current table.
+query I
+SELECT table_id FROM system.tables_with_history
+WHERE table_id = $history_name_filter_old_id
+----
+
+query B
+SELECT table_id = $history_name_filter_new_id FROM system.tables_with_history
+WHERE table_id = $history_name_filter_new_id
+----
+1
+
+query B
+SELECT table_id = $history_name_filter_new_id FROM system.tables_with_history
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+ORDER BY table_id
+----
+1
+
+# A dropped table is still visible when there is no current table.
+statement ok
+DROP TABLE db_12_0007_history.history_name_filter_120007
+
+query B
+SELECT count(*) = 1 FROM system.tables_with_history
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+  AND dropped_on IS NOT NULL
+----
+1
+
+statement ok
+UNSET VARIABLE (history_name_filter_old_id, history_name_filter_new_id)
+
+statement ok
+DROP DATABASE db_12_0007_history
```

---

### Incident Patch 11: `683c564e` (2026-09-24)
**Commit Message**: fix(query): release table locks before analyze and rebase statistics (#20551)

* fix(query): release the mutation table lock before the analyze hook

* fix(storage): rebase analyze statistics on concurrent appends

Collect segment summaries during the existing ANALYZE pass instead of
reading every segment again immediately before the metadata CAS. This
shortens the commit window from a full-table metadata scan to a normal
snapshot commit while preserving progress reporting.

Extract the per-segment collection into SegmentAnalyzer, shared by the
collect sources and the sink, with the reuse-or-scan decision isolated
in a pure CollectPolicy::plan. When the snapshot advances through
append-only commits before the statistics are committed, the sink feeds
the appended segments through the same analyzer, so HLL, column
statistics, Top-N, count-min sketches and KLL sketches all cover the
latest snapshot. KLL sketches and collectors are kept until commit so
the histogram buckets are derived after the rebase; window histograms
have no mergeable form and keep describing the base snapshot, which is
how they are consumed between two ANALYZE runs anyway.

Schema changes, cluster-key changes and 

**File**: `src/query/service/src/interpreters/hook/analyze_hook.rs` (modified, +21/-30)
```diff
@@ -23,12 +23,10 @@ use databend_common_exception::Result;
 use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
 use databend_common_storages_fuse::FuseTable;
-use databend_common_storages_fuse::operations::AnalyzeHistogramInfo;
-use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_FREQUENCY_COLUMNS;
+use databend_common_storages_fuse::operations::AnalyzeOptions;
 use log::info;
+use log::warn;
 
-use crate::interpreters::common::table_option_validation::analyze_count_min_sketch_error_rate_from_options;
-use crate::interpreters::common::table_option_validation::analyze_top_n_size_from_options;
 use crate::interpreters::hook::resolve_current_table_name_by_id;
 use crate::interpreters::hook::table_id_matches_target;
 use crate::pipelines::executor::ExecutorSettings;
@@ -76,7 +74,7 @@ pub(crate) async fn execute_analyze_hook(ctx: Arc<QueryContext>, desc: AnalyzeDe
             info!("Analyze job completed successfully");
         }
         Err(e) => {
-            info!("Analyze job failed: {:?}", e);
+            warn!("Analyze job failed (code {}): {}", e.code(), e);
         }
     }
 
@@ -107,35 +105,28 @@ pub(crate) async fn do_analyze(ctx: Arc<QueryContext>, desc: AnalyzeDesc) -> Res
         return Ok(());
     }
     let fuse_table = FuseTable::try_from_table(table.as_ref())?;
-    let table_options = fuse_table.get_table_info().options();
-    let top_n_size = analyze_top_n_size_from_options(table_options)?;
-    let count_min_sketch_error_rate =
-        analyze_count_min_sketch_error_rate_from_options(table_options)?;
-    let frequency_columns = table_options
-        .get(OPT_KEY_ANALYZE_FREQUENCY_COLUMNS)
-        .cloned();
-    let mut pipeline = Pipeline::create();
-    let Some(table_snapshot) = fuse_table.read_table_snapshot().await? else {
+    let options =
+        AnalyzeOptions::from_table_options(fuse_table.get_table_info().options())?.no_scan();
+    execute_analyze(ctx, fuse_table, options).await
+}
+
+/// Run ANALYZE over the table's current snapshot to completion. A table without a
+/// snapshot has nothing to analyze.
+pub(crate) async fn execute_analyze(
+    ctx: Arc<QueryContext>,
+    table: &FuseTable,
+    options: AnalyzeOptions,
+) -> Result<()> {
+    let Some(snapshot) = table.read_table_snapshot().await? else {
         return Ok(());
     };
-    fuse_table.do_analyze(
-        ctx.clone(),
-        table_snapshot,
-        &mut pipeline,
-        AnalyzeHistogramInfo::None,
-        top_n_size,
-        frequency_columns,
-        count_min_sketch_error_rate,
-        true,
-        false,
-    )?;
+    let mut pipeline = Pipeline::create();
+    table.do_analyze(ctx.clone(), snapshot, &mut pipeline, options)?;
     pipeline.set_max_threads(ctx.get_settings().get_max_threads()? as usize);
     let executor_settings = ExecutorSettings::try_create(ctx.clone())?;
-    let pipelines = vec![pipeline];
-    let complete_executor = PipelineCompleteExecutor::from_pipelines(pipelines, executor_settings)?;
-    ctx.set_executor(complete_executor.get_inner())?;
-    complete_executor.execute().await?;
-    Ok(())
+    let executor = PipelineCompleteExecutor::from_pipelines(vec![pipeline], executor_settings)?;
+    ctx.set_executor(executor.get_inner())?;
+    executor.execute().await
 }
 
 async fn resolve_analyze_desc(
```

**File**: `src/query/service/src/interpreters/hook/hook.rs` (modified, +155/-0)
```diff
@@ -21,6 +21,8 @@ use std::time::Instant;
 use databend_common_catalog::lock::LockTableOption;
 use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
+use databend_common_pipeline::core::SharedLockGuard;
+use databend_common_pipeline::core::always_callback;
 use databend_common_sql::executor::physical_plans::MutationKind;
 use log::warn;
 
@@ -38,6 +40,26 @@ use crate::interpreters::hook::table_hook_scheduler::TableHookTaskSettings;
 use crate::sessions::QueryContext;
 use crate::sessions::TableContextTableAccess;
 
+/// Register the release point of a handed-over table lock on the finished-callback chain.
+///
+/// The release is a normal callback so it runs in chain order: callbacks registered before it
+/// still run under the lock, callbacks registered after it run without the lock. An always
+/// callback is added as a safety net in case an earlier callback failed and interrupted the
+/// normal chain. Both are no-ops once the guard has been taken.
+pub(crate) fn register_lock_release(pipeline: &mut Pipeline, lock_guard: &SharedLockGuard) {
+    let guard = lock_guard.clone();
+    pipeline.set_on_finished(move |_info: &ExecutionInfo| {
+        drop(guard.try_take());
+        Ok(())
+    });
+
+    let guard = lock_guard.clone();
+    pipeline.set_on_finished(always_callback(move |_info: &ExecutionInfo| {
+        drop(guard.try_take());
+        Ok(())
+    }));
+}
+
 /// Hook operator.
 pub struct HookOperator {
     ctx: Arc<QueryContext>,
@@ -46,6 +68,12 @@ pub struct HookOperator {
     table: String,
     mutation_kind: MutationKind,
     lock_opt: LockTableOption,
+    /// The table lock acquired by the main operation, if any.
+    ///
+    /// The main pipeline and the compact/refresh hooks run under this lock. It is released
+    /// before the analyze hook, which only reads snapshots and commits statistics through a
+    /// sequence CAS, so it must not extend the lock hold time.
+    lock_guard: Option<SharedLockGuard>,
 }
 
 impl HookOperator {
@@ -64,9 +92,21 @@ impl HookOperator {
             table,
             mutation_kind,
             lock_opt,
+            lock_guard: None,
         }
     }
 
+    /// Hand the main operation's table lock over to the hook chain.
+    ///
+    /// The caller must not also register the guard on the pipeline; the hook chain owns its
+    /// release point. Callers that hand over a lock should pass `LockTableOption::NoLock` as
+    /// `lock_opt`, otherwise the compact hook would queue a second lock revision behind the
+    /// one it already holds.
+    pub fn with_lock_guard(mut self, lock_guard: Option<SharedLockGuard>) -> Self {
+        self.lock_guard = lock_guard;
+        self
+    }
+
     /// Execute the hook operator.
     /// The hook operator will:
     /// 1. Compact if needed.
@@ -82,12 +122,25 @@ impl HookOperator {
 
         self.execute_compact(pipeline).await;
         self.execute_refresh(pipeline).await;
+        // Compaction and reclustering mutate the table and rely on the main operation's lock.
+        // Analyze only reads snapshots and commits statistics with a sequence CAS, so the lock
+        // is released here to keep other maintenance jobs from waiting on it.
+        self.release_lock_guard(pipeline);
         self.execute_analyze(pipeline).await;
     }
 
+    fn release_lock_guard(&self, pipeline: &mut Pipeline) {
+        if let Some(lock_guard) = &self.lock_guard {
+            register_lock_release(pipeline, lock_guard);
+        }
+    }
+
     #[fastrace::trace]
     #[async_backtrace::framed]
     pub async fn execute_async(&self, pipeline: &mut Pipeline) {
+        // Async hooks acquire their own lock with retry, so the main operation's lock is
+        // released as soon as the main pipeline finishes.
+        self.release_lock_guard(pipeline);
         if pipeline.is_empty() {
             return;
         }
@@ -194,3 +247,105 @@ impl HookOperator {
         hook_analyze(self.ctx.clone(), pipeline, desc).await;
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use std::collections::HashMap;
+    use std::sync::atomic::AtomicBool;
+    use std::sync::atomic::Ordering;
+
+    use databend_common_exception::ErrorCode;
+    use databend_common_exception::Result;
+    use databend_common_pipeline::core::LockGuard;
+    use databend_common_pipeline::core::UnlockApi;
+    use parking_lot::Mutex;
+
+    use super::*;
+
+    #[derive(Default)]
+    struct MockUnlock {
+        unlocked: AtomicBool,
+    }
+
+    impl MockUnlock {
+        fn unlocked(&self) -> bool {
+            self.unlocked.load(Ordering::SeqCst)
+        }
+    }
+
+    impl UnlockApi for MockUnlock {
+        fn unlock(&self, _revision: u64) {
+            self.unlocked.store(true, Ordering::SeqCst);
+        }
+    }
+
+    struct LockedPipeline {
+        pipeline: Pipeline,
+        guard: SharedLockGuard,
+        unlock: Arc<MockUnlock>,
+        /// Lock state seen by each observing callback, in 
```

**File**: `src/query/service/src/interpreters/interpreter_mutation.rs` (modified, +5/-8)
```diff
@@ -140,15 +140,11 @@ impl Interpreter for MutationInterpreter {
                     .add_sink(|input| Ok(ProcessorPtr::create(EmptySink::create(input))))?;
             }
 
-            // Execute hook.
+            // Execute hook. The table lock acquired by the binder is handed over to the hook
+            // chain, which keeps it for the main pipeline and the compact hook and releases it
+            // before analyze.
             self.execute_hook(&mutation, &mut build_res).await;
 
-            let lock_guard = mutation
-                .lock_guard
-                .as_ref()
-                .and_then(|holder| holder.try_take());
-            build_res.main_pipeline.add_lock_guard(lock_guard);
-
             Ok(build_res)
         })
     }
@@ -187,7 +183,8 @@ impl MutationInterpreter {
             mutation.table_name.clone(),
             mutation_kind,
             hook_lock_opt,
-        );
+        )
+        .with_lock_guard(mutation.lock_guard.clone());
         hook_operator.execute(&mut build_res.main_pipeline).await;
     }
 
```

**File**: `src/query/service/src/interpreters/interpreter_replace.rs` (modified, +5/-8)
```diff
@@ -105,12 +105,6 @@ impl Interpreter for ReplaceInterpreter {
             let (physical_plan, purge_info) = self.build_physical_plan().await?;
             let mut pipeline =
                 build_query_pipeline_without_render_result_set(&self.ctx, &physical_plan).await?;
-            let lock_guard = self
-                .plan
-                .lock_guard
-                .as_ref()
-                .and_then(|holder| holder.try_take());
-            pipeline.main_pipeline.add_lock_guard(lock_guard);
 
             // purge
             if let Some((files, stage_info, options)) = purge_info {
@@ -123,7 +117,9 @@ impl Interpreter for ReplaceInterpreter {
                 )?;
             }
 
-            // Execute hook.
+            // Execute hook. The table lock acquired by the binder is handed over to the hook
+            // chain, which keeps it for the main pipeline and the compact hook and releases it
+            // before analyze.
             {
                 let hook_operator = HookOperator::create(
                     self.ctx.clone(),
@@ -132,7 +128,8 @@ impl Interpreter for ReplaceInterpreter {
                     self.plan.table.clone(),
                     MutationKind::Replace,
                     LockTableOption::NoLock,
-                );
+                )
+                .with_lock_guard(self.plan.lock_guard.clone());
                 hook_operator.execute(&mut pipeline.main_pipeline).await;
             }
 
```

**File**: `src/query/service/src/interpreters/interpreter_table_analyze.rs` (modified, +11/-24)
```diff
@@ -30,17 +30,15 @@ use databend_common_statistics::DEFAULT_HISTOGRAM_BUCKETS;
 use databend_common_storages_factory::Table;
 use databend_common_storages_fuse::FuseTable;
 use databend_common_storages_fuse::operations::AnalyzeHistogramInfo;
+use databend_common_storages_fuse::operations::AnalyzeOptions;
 use databend_common_storages_fuse::operations::HistogramInfoSink;
 use databend_storages_common_index::Index;
 use databend_storages_common_index::RangeIndex;
-use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_FREQUENCY_COLUMNS;
 use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_HISTOGRAM_ALGORITHM;
 use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_HISTOGRAM_KLL_RELATIVE_ERROR;
 use log::info;
 
 use crate::interpreters::Interpreter;
-use crate::interpreters::common::table_option_validation::analyze_count_min_sketch_error_rate_from_options;
-use crate::interpreters::common::table_option_validation::analyze_top_n_size_from_options;
 use crate::physical_plans::PhysicalPlan;
 use crate::physical_plans::PhysicalPlanBuilder;
 use crate::pipelines::PipelineBuildResult;
@@ -203,12 +201,7 @@ impl Interpreter for AnalyzeTableInterpreter {
             let collect_histogram = plan.histogram_requested
                 || has_table_histogram_policy(table_options)
                 || self.ctx.get_settings().get_enable_analyze_histogram()?;
-            let top_n_size = analyze_top_n_size_from_options(table_options)?;
-            let count_min_sketch_error_rate =
-                analyze_count_min_sketch_error_rate_from_options(table_options)?;
-            let frequency_columns = table_options
-                .get(OPT_KEY_ANALYZE_FREQUENCY_COLUMNS)
-                .cloned();
+            let mut options = AnalyzeOptions::from_table_options(table_options)?;
             if collect_histogram {
                 if self.plan.no_scan {
                     return Err(ErrorCode::BadArguments(
@@ -291,26 +284,20 @@ impl Interpreter for AnalyzeTableInterpreter {
                     }
                 }
             }
-            if self.plan.no_scan
-                && (top_n_size.is_some() || count_min_sketch_error_rate.is_some())
-                && frequency_columns
-                    .as_ref()
-                    .is_some_and(|columns| !columns.trim().is_empty())
-            {
-                return Err(ErrorCode::BadArguments(
-                    "ANALYZE TABLE NOSCAN cannot be used with frequency statistics collection because frequency statistics collection must scan table data",
-                ));
+            if self.plan.no_scan {
+                if options.frequency.is_some() {
+                    return Err(ErrorCode::BadArguments(
+                        "ANALYZE TABLE NOSCAN cannot be used with frequency statistics collection because frequency statistics collection must scan table data",
+                    ));
+                }
+                options = options.no_scan();
             }
+            options = options.with_histogram(histogram_info);
             table.do_analyze(
                 self.ctx.clone(),
                 snapshot,
                 &mut build_res.main_pipeline,
-                histogram_info,
-                top_n_size,
-                frequency_columns,
-                count_min_sketch_error_rate,
-                self.plan.no_scan,
-                true,
+                options,
             )?;
             Ok(build_res)
         })
```

**File**: `src/query/service/src/interpreters/interpreter_table_set_options.rs` (modified, +4/-35)
```diff
@@ -23,7 +23,6 @@ use databend_common_catalog::table::TableExt;
 use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
 use databend_common_meta_app::schema::UpsertTableOptionReq;
-use databend_common_pipeline::core::Pipeline;
 use databend_common_sql::plans::MaintenanceTarget;
 use databend_common_sql::plans::SetOptionsPlan;
 use databend_common_storages_factory::Table;
@@ -35,7 +34,7 @@ use databend_common_storages_fuse::FuseSegmentFormat;
 use databend_common_storages_fuse::FuseTable;
 use databend_common_storages_fuse::io::SegmentsIO;
 use databend_common_storages_fuse::io::read::RowOrientedSegmentReader;
-use databend_common_storages_fuse::operations::AnalyzeHistogramInfo;
+use databend_common_storages_fuse::operations::AnalyzeOptions;
 use databend_common_storages_fuse::segment_format_from_location;
 use databend_meta_client::types::MatchSeq;
 use databend_storages_common_table_meta::meta::SegmentInfo;
@@ -45,7 +44,6 @@ use databend_storages_common_table_meta::meta::column_oriented_segment::Abstract
 use databend_storages_common_table_meta::meta::column_oriented_segment::ColumnOrientedSegmentBuilder;
 use databend_storages_common_table_meta::meta::column_oriented_segment::SegmentBuilder;
 use databend_storages_common_table_meta::meta::column_oriented_segment::VirtualBlockInput;
-use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_FREQUENCY_COLUMNS;
 use databend_storages_common_table_meta::table::OPT_KEY_CHANGE_TRACKING;
 use databend_storages_common_table_meta::table::OPT_KEY_CHANGE_TRACKING_BEGIN_VER;
 use databend_storages_common_table_meta::table::OPT_KEY_CLUSTER_TYPE;
@@ -65,8 +63,6 @@ use log::error;
 
 use crate::interpreters::Interpreter;
 use crate::interpreters::common::check_maintenance_target;
-use crate::interpreters::common::table_option_validation::analyze_count_min_sketch_error_rate_from_options;
-use crate::interpreters::common::table_option_validation::analyze_top_n_size_from_options;
 use crate::interpreters::common::table_option_validation::is_valid_analyze_count_min_sketch_error_rate;
 use crate::interpreters::common::table_option_validation::is_valid_analyze_frequency_columns;
 use crate::interpreters::common::table_option_validation::is_valid_analyze_histogram_algorithm;
@@ -86,9 +82,8 @@ use crate::interpreters::common::table_option_validation::is_valid_option_of_typ
 use crate::interpreters::common::table_option_validation::is_valid_recluster_depth;
 use crate::interpreters::common::table_option_validation::is_valid_row_per_block;
 use crate::interpreters::common::table_option_validation::is_valid_virtual_column_layout_options;
+use crate::interpreters::hook::analyze_hook::execute_analyze;
 use crate::pipelines::PipelineBuildResult;
-use crate::pipelines::executor::ExecutorSettings;
-use crate::pipelines::executor::PipelineCompleteExecutor;
 use crate::sessions::QueryContext;
 use crate::sessions::TableContextSettings;
 use crate::sessions::TableContextTableAccess;
@@ -418,36 +413,10 @@ async fn analyze_table(
             FUSE_OPT_KEY_ENABLE_AUTO_ANALYZE,
         )));
     };
-    let Some(table_snapshot) = fuse_table.read_table_snapshot().await? else {
-        return Ok(table);
-    };
-
     let mut effective_options = fuse_table.get_table_info().options().clone();
     effective_options.extend(options.clone());
-    let top_n_size = analyze_top_n_size_from_options(&effective_options)?;
-    let count_min_sketch_error_rate =
-        analyze_count_min_sketch_error_rate_from_options(&effective_options)?;
-    let frequency_columns = effective_options
-        .get(OPT_KEY_ANALYZE_FREQUENCY_COLUMNS)
-        .cloned();
-    let mut pipeline = Pipeline::create();
-    fuse_table.do_analyze(
-        ctx.clone(),
-        table_snapshot,
-        &mut pipeline,
-        AnalyzeHistogramInfo::None,
-        top_n_size,
-        frequency_columns,
-        count_min_sketch_error_rate,
-        false,
-        true,
-    )?;
-    pipeline.set_max_threads(ctx.get_settings().get_max_threads()? as usize);
-    let executor_settings = ExecutorSettings::try_create(ctx.clone())?;
-    let pipelines = vec![pipeline];
-    let complete_executor = PipelineCompleteExecutor::from_pipelines(pipelines, executor_settings)?;
-    ctx.set_executor(complete_executor.get_inner())?;
-    complete_executor.execute().await?;
+    let analyze_options = AnalyzeOptions::from_table_options(&effective_options)?;
+    execute_analyze(ctx.clone(), fuse_table, analyze_options).await?;
     let table = table.refresh(ctx.as_ref()).await?;
     Ok(table)
 }
```

**File**: `src/query/service/tests/it/storages/fuse/operations/table_analyze.rs` (modified, +545/-0)
```diff
@@ -12,23 +12,37 @@
 //  See the License for the specific language governing permissions and
 //  limitations under the License.
 
+use std::collections::BTreeMap;
 use std::collections::HashMap;
 use std::sync::Arc;
 
 use databend_common_catalog::table::Table;
 use databend_common_catalog::table::TableExt;
+use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
 use databend_common_expression::ColumnId;
+use databend_common_expression::DataBlock;
 use databend_common_expression::Scalar;
 use databend_common_expression::types::number::NumberScalar;
 use databend_common_io::prelude::borsh_deserialize_from_slice;
+use databend_common_pipeline::core::Pipeline;
+use databend_common_statistics::Datum;
 use databend_common_storage::MetaHLL12;
 use databend_common_storages_fuse::FuseTable;
 use databend_common_storages_fuse::io::MetaReaders;
 use databend_common_storages_fuse::io::MetaWriter;
+use databend_common_storages_fuse::io::TableMetaLocationGenerator;
+use databend_common_storages_fuse::operations::AnalyzeHistogramInfo;
+use databend_common_storages_fuse::operations::AnalyzeOptions;
+use databend_common_storages_fuse::operations::commit_refresh_virtual_column;
+use databend_common_storages_fuse::operations::prepare_refresh_virtual_column;
 use databend_common_storages_fuse::statistics::reducers::merge_statistics_mut;
+use databend_query::pipelines::PipelineBuildResult;
+use databend_query::pipelines::executor::ExecutorSettings;
+use databend_query::pipelines::executor::PipelineCompleteExecutor;
 use databend_query::sessions::QueryContext;
 use databend_query::sessions::TableContext;
+use databend_query::sessions::TableContextSettings;
 use databend_query::sessions::TableContextTableAccess;
 use databend_query::sessions::TableContextTableManagement;
 use databend_query::sql::Planner;
@@ -41,6 +55,7 @@ use databend_storages_common_table_meta::meta::TableSnapshot;
 use databend_storages_common_table_meta::meta::TableSnapshotStatistics;
 use databend_storages_common_table_meta::meta::Versioned;
 use databend_storages_common_table_meta::meta::testing::TableSnapshotStatisticsV3;
+use futures::TryStreamExt;
 
 #[tokio::test(flavor = "multi_thread")]
 async fn test_table_modify_column_ndv_statistics() -> anyhow::Result<()> {
@@ -331,6 +346,536 @@ async fn test_table_analyze_without_prev_table_seq() -> anyhow::Result<()> {
     Ok(())
 }
 
+fn no_scan_options() -> AnalyzeOptions {
+    AnalyzeOptions::from_table_options(&BTreeMap::new())
+        .unwrap()
+        .no_scan()
+}
+
+/// Run ANALYZE with `snapshot` as the collection baseline, whatever the table's current
+/// snapshot is. This is how a stale baseline is reproduced deterministically.
+async fn execute_analyze_from_snapshot(
+    ctx: Arc<QueryContext>,
+    table: &FuseTable,
+    snapshot: Arc<TableSnapshot>,
+    options: AnalyzeOptions,
+) -> Result<()> {
+    let mut pipeline = Pipeline::create();
+    table.do_analyze(ctx.clone(), snapshot, &mut pipeline, options)?;
+    pipeline.set_max_threads(ctx.get_settings().get_max_threads()? as usize);
+    let settings = ExecutorSettings::try_create(ctx.clone())?;
+    let executor = PipelineCompleteExecutor::from_pipelines(vec![pipeline], settings)?;
+    ctx.set_executor(executor.get_inner())?;
+    executor.execute().await
+}
+
+async fn latest_fuse_table(ctx: &Arc<QueryContext>, name: &str) -> Result<FuseTable> {
+    ctx.evict_table_from_cache("default", "default", name)?;
+    let table = ctx
+        .get_catalog("default")
+        .await?
+        .get_table(&ctx.get_tenant(), "default", name)
+        .await?;
+    Ok(FuseTable::try_from_table(table.as_ref())?.clone())
+}
+
+/// The table's current snapshot and the statistics file it points to.
+async fn latest_statistics(
+    ctx: &Arc<QueryContext>,
+    name: &str,
+) -> Result<(FuseTable, Arc<TableSnapshot>, TableSnapshotStatistics)> {
+    let table = latest_fuse_table(ctx, name).await?;
+    let snapshot = table.read_table_snapshot().await?.unwrap();
+    let location = snapshot.table_statistics_location.as_ref().unwrap();
+    let statistics = MetaReaders::table_snapshot_statistics_reader(table.get_operator())
+        .read(&LoadParams {
+            location: location.clone(),
+            len_hint: None,
+            ver: TableMetaLocationGenerator::table_statistics_version(location),
+            put_cache: false,
+        })
+        .await?;
+    Ok((table, snapshot, statistics.as_ref().clone()))
+}
+
+/// Final content of the table built by `setup_stale_baseline`.
+const STALE_BASELINE_ROWS: u64 = 28;
+const STALE_BASELINE_NDV: u64 = 20;
+
+/// True frequency of a value in the table built by `setup_stale_baseline`.
+fn stale_baseline_frequency(value: i32) -> u64 {
+    match value {
+        0 => 5,
+        1 | 2 => 3,
+        _ => 1,
+    }
+}
+
+/// Build a table whose statistics snapshot is `base`, then append rows so that the table
+/// moves ahead of `base` before ANALYZE commits. Returns the st
```

**File**: `src/query/storages/fuse/src/fuse_table.rs` (modified, +4/-7)
```diff
@@ -1283,13 +1283,10 @@ impl Table for FuseTable {
         _ctx: Arc<dyn TableContext>,
     ) -> Result<Box<dyn ColumnStatisticsProvider>> {
         let provider = if let Some(snapshot) = self.read_table_snapshot().await? {
-            let mut stats = snapshot.summary.col_stats.clone();
-            // add virtual column stats
-            if let Some(virtual_col_stats) = &snapshot.summary.virtual_col_stats {
-                for (col_id, stat) in virtual_col_stats {
-                    stats.insert(*col_id, stat.clone());
-                }
-            }
+            // Snapshot-level virtual column statistics are ignored: current persisted ids are
+            // segment-local and can collide with table column ids here. Even older persisted
+            // ids cannot be reliably matched to paths using query-time virtual column ids.
+            let stats = snapshot.summary.col_stats.clone();
             let table_statistics = self.read_table_snapshot_statistics(Some(&snapshot)).await?;
             let additional_stats_meta = snapshot.summary.additional_stats_meta.as_ref();
             let column_distinct_values = match additional_stats_meta.and_then(|v| v.hll.as_ref()) {
```

---

### Incident Patch 12: `df1ae0ca` (2026-09-24)
**Commit Message**: fix(query): match nullable scalar correlation keys (#20408)

* fix(query): match nullable scalar correlation keys

* fix(query): keep NULL-safe join keys in left exchange join rule

**File**: `src/query/sql/src/planner/optimizer/optimizers/hyper_dp/dphyp.rs` (modified, +15/-24)
```diff
@@ -27,7 +27,6 @@ use super::algorithm::JoinEdgeRef;
 use super::algorithm::JoinNode;
 use super::algorithm::JoinOrderModel;
 use crate::IndexType;
-use crate::ScalarExpr;
 use crate::optimizer::Optimizer;
 use crate::optimizer::OptimizerContext;
 use crate::optimizer::ir::RelExpr;
@@ -60,7 +59,7 @@ pub struct DPhpyOptimizer {
 
 struct DPhypJoinOrderModel<'a> {
     join_relations: &'a [JoinRelation],
-    join_conditions: &'a [(ScalarExpr, ScalarExpr)],
+    join_conditions: &'a [JoinEquiCondition],
     stat_context: &'a StatContext,
 }
 
@@ -73,17 +72,14 @@ impl DPhypJoinOrderModel<'_> {
     ) -> SExpr {
         let left_expr = left.state().clone();
         let right_expr = right.state().clone();
-        let mut left_conditions = Vec::with_capacity(edge_refs.len());
-        let mut right_conditions = Vec::with_capacity(edge_refs.len());
+        let mut conditions = Vec::with_capacity(edge_refs.len());
 
         for edge_ref in edge_refs {
-            let (mut left_condition, mut right_condition) =
-                self.join_conditions[edge_ref.id].clone();
+            let mut condition = self.join_conditions[edge_ref.id].clone();
             if edge_ref.reversed {
-                std::mem::swap(&mut left_condition, &mut right_condition);
+                std::mem::swap(&mut condition.left, &mut condition.right);
             }
-            left_conditions.push(left_condition);
-            right_conditions.push(right_condition);
+            conditions.push(condition);
         }
 
         let join_type = if edge_refs.is_empty() {
@@ -92,11 +88,7 @@ impl DPhypJoinOrderModel<'_> {
             JoinType::Inner
         };
         let rel_op = RelOperator::Join(Join {
-            equi_conditions: JoinEquiCondition::new_conditions(
-                left_conditions,
-                right_conditions,
-                vec![],
-            ),
+            equi_conditions: conditions,
             non_equi_conditions: vec![],
             join_type,
             marker_index: None,
@@ -271,7 +263,7 @@ impl DPhpyOptimizer {
     async fn process_join_node(
         &mut self,
         s_expr: &SExpr,
-        join_conditions: &mut Vec<(ScalarExpr, ScalarExpr)>,
+        join_conditions: &mut Vec<JoinEquiCondition>,
     ) -> Result<(Arc<SExpr>, bool)> {
         let op = match s_expr.plan() {
             RelOperator::Join(op) => op,
@@ -306,7 +298,7 @@ impl DPhpyOptimizer {
                 break;
             }
 
-            join_conditions.push((condition.left.clone(), condition.right.clone()));
+            join_conditions.push(condition.clone());
         }
 
         // Add non-equi conditions to filters
@@ -599,7 +591,7 @@ impl DPhpyOptimizer {
     async fn process_unary_node(
         &mut self,
         s_expr: &SExpr,
-        join_conditions: &mut Vec<(ScalarExpr, ScalarExpr)>,
+        join_conditions: &mut Vec<JoinEquiCondition>,
         join_child: bool,
         join_relation: Option<&SExpr>,
     ) -> Result<(Arc<SExpr>, bool)> {
@@ -639,7 +631,7 @@ impl DPhpyOptimizer {
     async fn get_base_relations(
         &mut self,
         s_expr: &SExpr,
-        join_conditions: &mut Vec<(ScalarExpr, ScalarExpr)>,
+        join_conditions: &mut Vec<JoinEquiCondition>,
         join_child: bool,
         join_relation: Option<&SExpr>,
         is_subquery: bool,
@@ -704,7 +696,6 @@ impl DPhpyOptimizer {
         }
 
         // Firstly, we need to extract all join conditions and base tables
-        // `join_condition` is pair, left is left_condition, right is right_condition
         let mut join_conditions = vec![];
         let (s_expr, optimized) = self
             .get_base_relations(s_expr, &mut join_conditions, false, None, false)
@@ -747,18 +738,18 @@ impl DPhpyOptimizer {
     fn build_join_order_edges(
         &self,
         hyper_dp: &mut HyperDp<'_, DPhypJoinOrderModel<'_>>,
-        join_conditions: &[(ScalarExpr, ScalarExpr)],
+        join_conditions: &[JoinEquiCondition],
     ) -> Result<bool> {
-        for (edge_id, (left_condition, right_condition)) in join_conditions.iter().enumerate() {
+        for (edge_id, condition) in join_conditions.iter().enumerate() {
             let mut left_relation_set = HashSet::new();
             let mut right_relation_set = HashSet::new();
 
-            let left_used_tables = left_condition.used_tables()?;
+            let left_used_tables = condition.left.used_tables()?;
             for table in left_used_tables.iter() {
                 left_relation_set.insert(self.table_index_map[table]);
             }
 
-            let right_used_tables = right_condition.used_tables()?;
+            let right_used_tables = condition.right.used_tables()?;
             for table in right_used_tables.iter() {
                 right_relation_set.insert(self.table_index_map[table]);
             }
@@ -936,7 +927,7 @@ mod tests {
     use crate::plans::MaterializedCTERef;
     use crate::plans::Sequence;
 
-    fn bool_constant(value: bool) -
```

**File**: `src/query/sql/src/planner/optimizer/optimizers/operator/decorrelate/decorrelate.rs` (modified, +25/-21)
```diff
@@ -275,6 +275,12 @@ impl SubqueryDecorrelatorOptimizer {
                     &mut left_conditions,
                 )?;
 
+                // These conditions reconnect the flattened subquery result to the outer row.
+                // They are internal correlation keys rather than user-written equality
+                // predicates, so NULL correlation groups must match each other.
+                let is_null_equal =
+                    Self::nullable_condition_indexes(&left_conditions, &right_conditions);
+
                 let join_type = if matches!(subquery.contain_agg, Some(true)) && {
                     let rel_expr = RelExpr::with_s_expr(&subquery.subquery);
                     rel_expr
@@ -292,7 +298,7 @@ impl SubqueryDecorrelatorOptimizer {
                     equi_conditions: JoinEquiCondition::new_conditions(
                         left_conditions,
                         right_conditions,
-                        vec![],
+                        is_null_equal,
                     ),
                     non_equi_conditions: vec![],
                     join_type,
@@ -339,16 +345,8 @@ impl SubqueryDecorrelatorOptimizer {
                     &mut left_conditions,
                     &mut right_conditions,
                 )?;
-                let mut is_null_equal = Vec::new();
-                for (i, (l, r)) in left_conditions
-                    .iter()
-                    .zip(right_conditions.iter())
-                    .enumerate()
-                {
-                    if l.data_type().is_nullable() || r.data_type().is_nullable() {
-                        is_null_equal.push(i);
-                    }
-                }
+                let is_null_equal =
+                    Self::nullable_condition_indexes(&left_conditions, &right_conditions);
 
                 let marker_index = if let Some(idx) = subquery.projection_index {
                     idx
@@ -404,16 +402,8 @@ impl SubqueryDecorrelatorOptimizer {
                     &mut right_conditions,
                 )?;
 
-                let mut is_null_equal = Vec::new();
-                for (i, (l, r)) in left_conditions
-                    .iter()
-                    .zip(right_conditions.iter())
-                    .enumerate()
-                {
-                    if l.data_type().is_nullable() || r.data_type().is_nullable() {
-                        is_null_equal.push(i);
-                    }
-                }
+                let is_null_equal =
+                    Self::nullable_condition_indexes(&left_conditions, &right_conditions);
 
                 let output_column = subquery.output_column.clone();
                 let column_name = format!("subquery_{}", output_column.index);
@@ -522,6 +512,20 @@ impl SubqueryDecorrelatorOptimizer {
         Ok(())
     }
 
+    pub(crate) fn nullable_condition_indexes(
+        left_conditions: &[ScalarExpr],
+        right_conditions: &[ScalarExpr],
+    ) -> Vec<usize> {
+        left_conditions
+            .iter()
+            .zip(right_conditions)
+            .enumerate()
+            .filter_map(|(index, (left, right))| {
+                (left.data_type().is_nullable() || right.data_type().is_nullable()).then_some(index)
+            })
+            .collect()
+    }
+
     // Check if need to join outer and inner table
     // If correlated_columns only occur in equi-conditions, such as `where t1.a = t.a and t1.b = t.b`(t1 is outer table)
     // Then we won't join outer and inner table.
```

**File**: `src/query/sql/src/planner/optimizer/optimizers/operator/decorrelate/subquery_decorrelator.rs` (modified, +2/-10)
```diff
@@ -732,16 +732,8 @@ impl SubqueryDecorrelatorOptimizer {
                     )
                 };
 
-                let mut is_null_equal = Vec::new();
-                for (i, (l, r)) in left_conditions
-                    .iter()
-                    .zip(right_conditions.iter())
-                    .enumerate()
-                {
-                    if l.data_type().is_nullable() || r.data_type().is_nullable() {
-                        is_null_equal.push(i);
-                    }
-                }
+                let is_null_equal =
+                    Self::nullable_condition_indexes(&left_conditions, &right_conditions);
 
                 // Consider the sql: select * from t1 where t1.a = any(select t2.a from t2);
                 // Will be transferred to:select t1.a, t2.a, marker_index from t1, t2 where t2.a = t1.a;
```

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/join_rules/rule_left_exchange_join.rs` (modified, +67/-6)
```diff
@@ -18,7 +18,8 @@ use std::vec;
 
 use databend_common_exception::Result;
 
-use super::util::get_join_predicates;
+use super::util::equi_condition_to_predicate;
+use crate::ColumnSet;
 use crate::binder::JoinPredicate;
 use crate::optimizer::ir::Matcher;
 use crate::optimizer::ir::RelExpr;
@@ -120,7 +121,20 @@ impl Rule for RuleLeftExchangeJoin {
         let contains_cross_join =
             matches!(join1.join_type, JoinType::Cross) || join2.join_type == JoinType::Cross;
 
-        let predicates = [get_join_predicates(&join1)?, get_join_predicates(&join2)?].concat();
+        // NULL-safe equi conditions can't be represented by `eq` predicates, so keep them as
+        // structured conditions and place them after the ordinary predicates are resolved.
+        let mut predicates = vec![];
+        let mut null_equal_conditions = vec![];
+        for join in [&join1, &join2] {
+            for condition in join.equi_conditions.iter() {
+                if condition.is_null_equal {
+                    null_equal_conditions.push(condition);
+                } else {
+                    predicates.push(equi_condition_to_predicate(condition));
+                }
+            }
+            predicates.extend(join.non_equi_conditions.iter().cloned());
+        }
 
         let mut join_3 = Join::default();
         let mut join_4 = Join::default();
@@ -172,10 +186,6 @@ impl Rule for RuleLeftExchangeJoin {
             }
         }
 
-        if !join_3.equi_conditions.is_empty() {
-            join_3.join_type = JoinType::Inner;
-        }
-
         // Resolve predicates for join4
         for predicate in join_4_preds.iter() {
             let join_pred = JoinPredicate::new(predicate, &t1_prop, &t3_prop);
@@ -205,6 +215,29 @@ impl Rule for RuleLeftExchangeJoin {
             }
         }
 
+        // Place NULL-safe conditions on the join whose children provide both sides. Inner joins
+        // with NULL-safe equality keys are still associative, but these conditions must stay
+        // equi conditions; give up the exchange if one can't be placed that way.
+        for condition in null_equal_conditions {
+            if let Some(condition) =
+                orient_equi_condition(condition, &t1_prop.output_columns, &t3_prop.output_columns)
+            {
+                join_4.equi_conditions.push(condition);
+            } else if let Some(condition) = orient_equi_condition(
+                condition,
+                &join4_prop.output_columns,
+                &t2_prop.output_columns,
+            ) {
+                join_3.equi_conditions.push(condition);
+            } else {
+                return Ok(());
+            }
+        }
+
+        if !join_3.equi_conditions.is_empty() {
+            join_3.join_type = JoinType::Inner;
+        }
+
         if !join_4.equi_conditions.is_empty() {
             join_4.join_type = JoinType::Inner;
         }
@@ -245,3 +278,31 @@ impl Default for RuleLeftExchangeJoin {
         Self::new()
     }
 }
+
+/// Orient an equi condition so that its left side is provided by `left_columns` and its right
+/// side by `right_columns`, keeping `is_null_equal`. Returns `None` if it can't be oriented.
+fn orient_equi_condition(
+    condition: &JoinEquiCondition,
+    left_columns: &ColumnSet,
+    right_columns: &ColumnSet,
+) -> Option<JoinEquiCondition> {
+    let left_used_columns = condition.left.used_columns();
+    let right_used_columns = condition.right.used_columns();
+    if left_used_columns.is_empty() || right_used_columns.is_empty() {
+        return None;
+    }
+
+    if left_used_columns.is_subset(left_columns) && right_used_columns.is_subset(right_columns) {
+        return Some(condition.clone());
+    }
+
+    if right_used_columns.is_subset(left_columns) && left_used_columns.is_subset(right_columns) {
+        return Some(JoinEquiCondition::new(
+            condition.right.clone(),
+            condition.left.clone(),
+            condition.is_null_equal,
+        ));
+    }
+
+    None
+}
```

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/join_rules/util.rs` (modified, +20/-15)
```diff
@@ -17,27 +17,32 @@ use databend_common_expression::types::DataType;
 
 use crate::plans::FunctionCall;
 use crate::plans::Join;
+use crate::plans::JoinEquiCondition;
 use crate::plans::ScalarExpr;
 
 pub fn get_join_predicates(join: &Join) -> Result<Vec<ScalarExpr>> {
     Ok(join
         .equi_conditions
         .iter()
-        .map(|equi_condition| {
-            let return_type = ScalarExpr::passthrough_nullable_type(DataType::Boolean, [
-                &equi_condition.left,
-                &equi_condition.right,
-            ]);
-            Ok(ScalarExpr::FunctionCall(FunctionCall {
-                span: None,
-                func_name: "eq".to_string(),
-                params: vec![],
-                arguments: vec![equi_condition.left.clone(), equi_condition.right.clone()],
-                return_type: Box::new(return_type),
-            }))
-        })
-        .collect::<Result<Vec<_>>>()?
-        .into_iter()
+        .map(equi_condition_to_predicate)
         .chain(join.non_equi_conditions.clone())
         .collect())
 }
+
+/// Convert an equi condition to an `eq` predicate.
+///
+/// Note that the result can't represent a NULL-safe condition (`is_null_equal`), so callers
+/// must handle NULL-safe conditions separately instead of converting them with this function.
+pub fn equi_condition_to_predicate(equi_condition: &JoinEquiCondition) -> ScalarExpr {
+    let return_type = ScalarExpr::passthrough_nullable_type(DataType::Boolean, [
+        &equi_condition.left,
+        &equi_condition.right,
+    ]);
+    ScalarExpr::FunctionCall(FunctionCall {
+        span: None,
+        func_name: "eq".to_string(),
+        params: vec![],
+        arguments: vec![equi_condition.left.clone(), equi_condition.right.clone()],
+        return_type: Box::new(return_type),
+    })
+}
```

**File**: `src/query/sql/test-support/data/results/tpcds/Q01_optimized.txt` (modified, +70/-70)
```diff
@@ -15,80 +15,80 @@ TopN
                 ├── other filters: []
                 ├── Exchange(Broadcast)
                 │   └── Join(Inner)
-                │       ├── build keys: [store_returns.sr_store_sk (#103)]
+                │       ├── build keys: [store.s_store_sk (#49)]
                 │       ├── probe keys: [store_returns.sr_store_sk (#7)]
-                │       ├── other filters: [gt(Sum(sr_return_amt) (#48), sum(ctr_total_return) / if(count(ctr_total_return) = 0, 1, count(ctr_total_return)) * 1.2 (#147))]
+                │       ├── other filters: []
                 │       ├── Exchange(Broadcast)
-                │       │   └── Join(Inner)
-                │       │       ├── build keys: [store_returns.sr_store_sk (#103)]
-                │       │       ├── probe keys: [store.s_store_sk (#49)]
-                │       │       ├── other filters: []
-                │       │       ├── Exchange(Broadcast)
-                │       │       │   └── EvalScalar
-                │       │       │       ├── scalars: [store_returns.sr_store_sk (#103) AS (#103), multiply(divide(sum(ctr_total_return) (#145), if(eq(count(ctr_total_return) (#146), 0), 1, count(ctr_total_return) (#146))), 1.2) AS (#147)]
-                │       │       │       └── Aggregate(Final)
-                │       │       │           ├── group items: [store_returns.sr_store_sk (#103) AS (#103)]
-                │       │       │           ├── aggregate functions: [sum(Sum(sr_return_amt) (#144)) AS (#145), count(Sum(sr_return_amt) (#144)) AS (#146)]
-                │       │       │           └── Aggregate(Partial)
-                │       │       │               ├── group items: [store_returns.sr_store_sk (#103) AS (#103)]
-                │       │       │               ├── aggregate functions: [sum(Sum(sr_return_amt) (#144)) AS (#145), count(Sum(sr_return_amt) (#144)) AS (#146)]
-                │       │       │               └── Exchange(Hash)
-                │       │       │                   ├── Exchange(Hash): keys: [store_returns.sr_store_sk (#103)]
-                │       │       │                   └── Aggregate(Final)
-                │       │       │                       ├── group items: [store_returns.sr_customer_sk (#99) AS (#99), store_returns.sr_store_sk (#103) AS (#103)]
-                │       │       │                       ├── aggregate functions: [sum(store_returns.sr_return_amt (#107)) AS (#144)]
-                │       │       │                       └── Aggregate(Partial)
-                │       │       │                           ├── group items: [store_returns.sr_customer_sk (#99) AS (#99), store_returns.sr_store_sk (#103) AS (#103)]
-                │       │       │                           ├── aggregate functions: [sum(store_returns.sr_return_amt (#107)) AS (#144)]
-                │       │       │                           └── Exchange(Hash)
-                │       │       │                               ├── Exchange(Hash): keys: [store_returns.sr_customer_sk (#99)]
-                │       │       │                               └── EvalScalar
-                │       │       │                                   ├── scalars: [store_returns.sr_customer_sk (#99) AS (#99), store_returns.sr_store_sk (#103) AS (#103), store_returns.sr_return_amt (#107) AS (#107), store_returns.sr_returned_date_sk (#96) AS (#151), date_dim.d_date_sk (#116) AS (#152), date_dim.d_year (#122) AS (#153)]
-                │       │       │                                   └── Join(Inner)
-                │       │       │                                       ├── build keys: [date_dim.d_date_sk (#116)]
-                │       │       │                                       ├── probe keys: [store_returns.sr_returned_date_sk (#96)]
-                │       │       │                                       ├── other filters: []
-                │       │       │                                       ├── Exchange(Broadcast)
-                │       │       │                                       │   └── Scan
-                │       │       │                                       │       ├── table: default.date_dim (#5)
-                │       │       │                                       │       ├── filters: [eq(date_dim.d_year (#122), 2001)]
-                │       │       │                                       │       ├── order by: []
-                │       │       │                                       │       └── limit: NONE
-                │       │       │                                       └── Scan
-                │       │       │                                           ├── table: default.store_returns (#4)
-                │       │       │                                           ├── filters: [eq(store_returns.sr_store_sk (#103), store_returns.sr_store_sk (#103))]
-                │       │       │                                           ├── order by: []
-                │       │   
```

**File**: `src/query/sql/test-support/data/results/tpcds/Q01_physical.txt` (modified, +135/-136)
```diff
@@ -29,148 +29,147 @@ TopN(Final)
             │   └── HashJoin
             │       ├── output columns: [store_returns.sr_customer_sk (#3)]
             │       ├── join type: INNER
-            │       ├── build keys: [sr_store_sk (#103)]
-            │       ├── probe keys: [sr_store_sk (#7)]
+            │       ├── build keys: [store.s_store_sk (#49)]
+            │       ├── probe keys: [ctr1.ctr_store_sk (#7)]
             │       ├── keys is null equal: [false]
-            │       ├── filters: [ctr1.ctr_total_return (#48) > scalar_subquery_147 (#147)]
+            │       ├── filters: []
             │       ├── build join filters:
-            │       │   └── filter id:3, build key:sr_store_sk (#103), probe targets:[sr_store_sk (#7)@scan0], filter type:bloom,inlist,min_max
+            │       │   └── filter id:3, build key:store.s_store_sk (#49), probe targets:[ctr1.ctr_store_sk (#7)@scan0, sr_store_sk (#103)@scan4], filter type:bloom,inlist,min_max
             │       ├── estimated rows: 174302.78
             │       ├── Exchange(Build)
-            │       │   ├── output columns: [sum(ctr_total_return) / if(count(ctr_total_return) = 0, 1, count(ctr_total_return)) * 1.2 (#147), store_returns.sr_store_sk (#103)]
+            │       │   ├── output columns: [store.s_store_sk (#49)]
             │       │   ├── exchange type: Broadcast
-            │       │   └── HashJoin
-            │       │       ├── output columns: [sum(ctr_total_return) / if(count(ctr_total_return) = 0, 1, count(ctr_total_return)) * 1.2 (#147), store_returns.sr_store_sk (#103)]
-            │       │       ├── join type: INNER
-            │       │       ├── build keys: [sr_store_sk (#103)]
-            │       │       ├── probe keys: [store.s_store_sk (#49)]
-            │       │       ├── keys is null equal: [false]
-            │       │       ├── filters: []
-            │       │       ├── build join filters:
-            │       │       │   └── filter id:2, build key:sr_store_sk (#103), probe targets:[store.s_store_sk (#49)@scan2], filter type:bloom,inlist,min_max
-            │       │       ├── estimated rows: 7.96
-            │       │       ├── Exchange(Build)
-            │       │       │   ├── output columns: [store_returns.sr_store_sk (#103), sum(ctr_total_return) / if(count(ctr_total_return) = 0, 1, count(ctr_total_return)) * 1.2 (#147)]
-            │       │       │   ├── exchange type: Broadcast
-            │       │       │   └── EvalScalar
-            │       │       │       ├── output columns: [store_returns.sr_store_sk (#103), sum(ctr_total_return) / if(count(ctr_total_return) = 0, 1, count(ctr_total_return)) * 1.2 (#147)]
-            │       │       │       ├── expressions: [sum(ctr_total_return) (#145) / CAST(if(CAST(count(ctr_total_return) (#146) = 0 AS Boolean NULL), 1, count(ctr_total_return) (#146)) AS UInt64 NULL) * 1.2]
-            │       │       │       ├── estimated rows: 1.00
-            │       │       │       └── AggregateFinal
-            │       │       │           ├── output columns: [sum(ctr_total_return) (#145), count(ctr_total_return) (#146), store_returns.sr_store_sk (#103)]
-            │       │       │           ├── group by: [sr_store_sk]
-            │       │       │           ├── aggregate functions: [sum(Sum(sr_return_amt)), count(Sum(sr_return_amt))]
-            │       │       │           ├── estimated rows: 1.00
-            │       │       │           └── Exchange
-            │       │       │               ├── output columns: [sum(ctr_total_return) (#145), count(ctr_total_return) (#146), store_returns.sr_store_sk (#103)]
-            │       │       │               ├── exchange type: Hash(0)
-            │       │       │               └── AggregatePartial
-            │       │       │                   ├── group by: [sr_store_sk]
-            │       │       │                   ├── aggregate functions: [sum(Sum(sr_return_amt)), count(Sum(sr_return_amt))]
-            │       │       │                   ├── estimated rows: 1.00
-            │       │       │                   └── AggregateFinal
-            │       │       │                       ├── output columns: [Sum(sr_return_amt) (#144), store_returns.sr_customer_sk (#99), store_returns.sr_store_sk (#103)]
-            │       │       │                       ├── group by: [sr_customer_sk, sr_store_sk]
-            │       │       │                       ├── aggregate functions: [sum(sr_return_amt)]
-            │       │       │                       ├── estimated rows: 1.00
-            │       │       │                       └── Exchange
-            │       │       │                           ├── output columns: [Sum(sr_return_amt) (#144), store_returns.sr_customer_sk (#99), store_returns.sr_store_sk (#103)]
-            │       │       │                           ├── exchange type: Hash(0, 1)
-            │       │       │                           └── AggregatePartial
-            │       │     
```

**File**: `tests/sqllogictests/suites/mode/standalone/explain/explain.test` (modified, +9/-9)
```diff
@@ -930,13 +930,13 @@ explain select * from a where a.id = (select id from b where a.id = b.id);
 HashJoin
 ├── output columns: [a.id (#0), a.c1 (#1)]
 ├── join type: INNER
-├── build keys: [scalar_subquery_2 (#2), id (#2)]
-├── probe keys: [a.id (#0), a.id (#0)]
-├── keys is null equal: [false, false]
+├── build keys: [id (#2), scalar_subquery_2 (#2)]
+├── probe keys: [id (#0), a.id (#0)]
+├── keys is null equal: [true, false]
 ├── filters: []
 ├── build join filters:
-│   ├── filter id:0, build key:scalar_subquery_2 (#2), probe targets:[a.id (#0)@scan0], filter type:bloom,inlist,min_max
-│   └── filter id:1, build key:id (#2), probe targets:[a.id (#0)@scan0], filter type:bloom,inlist,min_max
+│   ├── filter id:0, build key:id (#2), probe targets:[id (#0)@scan0], filter type:
+│   └── filter id:1, build key:scalar_subquery_2 (#2), probe targets:[a.id (#0)@scan0], filter type:bloom,inlist,min_max
 ├── estimated rows: 0.40
 ├── TableScan(Build)
 │   ├── table: default.default.b
@@ -1327,10 +1327,10 @@ HashJoin
 ├── join type: INNER
 ├── build keys: [a (#0)]
 ├── probe keys: [a (#3)]
-├── keys is null equal: [false]
+├── keys is null equal: [true]
 ├── filters: [t2.c (#2) > scalar_subquery_5 (#5)]
 ├── build join filters:
-│   └── filter id:0, build key:a (#0), probe targets:[a (#3)@scan1], filter type:bloom,inlist,min_max
+│   └── filter id:0, build key:a (#0), probe targets:[a (#3)@scan1], filter type:
 ├── estimated rows: 0.00
 ├── TableScan(Build)
 │   ├── table: default.default.t2
@@ -1375,10 +1375,10 @@ HashJoin
 ├── join type: INNER
 ├── build keys: [a (#0)]
 ├── probe keys: [a (#3)]
-├── keys is null equal: [false]
+├── keys is null equal: [true]
 ├── filters: [t2.c (#2) > scalar_subquery_5 (#5)]
 ├── build join filters:
-│   └── filter id:0, build key:a (#0), probe targets:[a (#3)@scan1], filter type:bloom,inlist,min_max
+│   └── filter id:0, build key:a (#0), probe targets:[a (#3)@scan1], filter type:
 ├── estimated rows: 0.00
 ├── TableScan(Build)
 │   ├── table: default.default.t2
```

---

### Incident Patch 13: `0b49efbd` (2026-09-24)
**Commit Message**: fix(storage): map missing navigation snapshots to TableHistoricalDataNotFound (#20534)

#20265 mapped a vacuumed predecessor snapshot to TableHistoricalDataNotFound
for the NO_CHECK TIMESTAMP path only. The other navigation points that read
a snapshot by location still surfaced the raw object-store 404:

- AT (TAG => ...) whose tagged snapshot was vacuumed
- a STREAM whose base snapshot was vacuumed
- ALTER TABLE ... FLASHBACK TO a TAG / STREAM point

Generalise the NO_CHECK helper into FuseTable::read_navigation_snapshot and
route every navigation snapshot read through it, so a missing object is
always reported as "historical data is gone" with the navigation point and
the missing location in the message.

Add an integration test for the STREAM path; it fails with
StorageNotFound 3001 without this change.

**File**: `src/query/service/tests/it/storages/fuse/operations/navigate.rs` (modified, +70/-0)
```diff
@@ -26,6 +26,8 @@ use databend_query::storages::fuse::io::TableMetaLocationGenerator;
 use databend_query::test_kits::*;
 use databend_storages_common_cache::CacheAccessor;
 use databend_storages_common_cache::CacheManager;
+use databend_storages_common_table_meta::table::OPT_KEY_SNAPSHOT_LOCATION;
+use databend_storages_common_table_meta::table::OPT_KEY_SOURCE_TABLE_ID;
 use futures::TryStreamExt;
 
 #[tokio::test(flavor = "multi_thread")]
@@ -200,3 +202,71 @@ async fn test_no_check_timestamp_maps_missing_prev_snapshot() -> anyhow::Result<
 
     Ok(())
 }
+
+#[tokio::test(flavor = "multi_thread")]
+async fn test_stream_navigation_maps_missing_snapshot() -> anyhow::Result<()> {
+    // A STREAM keeps a pointer to a base snapshot. Once vacuum removes that object, reading
+    // the stream must report TableHistoricalDataNotFound, not a raw StorageNotFound from the
+    // object store.
+
+    let fixture = TestFixture::setup().await?;
+    let db = fixture.default_db_name();
+    let tbl = fixture.default_table_name();
+
+    fixture.create_default_database().await?;
+    fixture.create_default_table().await?;
+
+    let qry = format!("insert into {}.{} values (1, (2, 3)) ", db, tbl);
+    let strm = fixture.execute_query(qry.as_str()).await?;
+    strm.try_collect::<Vec<DataBlock>>().await?;
+
+    let table = fixture.latest_default_table().await?;
+    let fuse_table = FuseTable::try_from_table(table.as_ref())?;
+    let base_snapshot = fuse_table.snapshot_loc().unwrap();
+
+    // Advance the table so the base snapshot is no longer the current one.
+    let qry = format!("insert into {}.{} values (2, (4, 6)) ", db, tbl);
+    let strm = fixture.execute_query(qry.as_str()).await?;
+    strm.try_collect::<Vec<DataBlock>>().await?;
+
+    let table = fixture.latest_default_table().await?;
+    let fuse_table = FuseTable::try_from_table(table.as_ref())?;
+    assert_ne!(fuse_table.snapshot_loc().unwrap(), base_snapshot);
+
+    // A stream table info pointing at the base snapshot of this table.
+    let mut stream_info = table.get_table_info().clone();
+    stream_info.meta.options.insert(
+        OPT_KEY_SOURCE_TABLE_ID.to_string(),
+        table.get_table_info().ident.table_id.to_string(),
+    );
+    stream_info
+        .meta
+        .options
+        .insert(OPT_KEY_SNAPSHOT_LOCATION.to_string(), base_snapshot.clone());
+
+    // Simulate vacuum: remove the base snapshot object and drop its cache entry.
+    fuse_table.get_operator().delete(&base_snapshot).await?;
+    if let Some(cache) = CacheManager::instance().get_table_snapshot_cache() {
+        cache.evict(&base_snapshot);
+    }
+
+    let ctx = fixture.new_query_ctx().await?;
+    let tbl_ctx: std::sync::Arc<dyn TableContext> = ctx.clone();
+    let res = fuse_table
+        .navigate_to_point(&tbl_ctx, &NavigationPoint::StreamInfo(stream_info))
+        .await;
+
+    match res {
+        Ok(_) => panic!("expected historical data not found when stream base snapshot is missing"),
+        Err(e) => {
+            assert_eq!(
+                e.code(),
+                ErrorCode::TABLE_HISTORICAL_DATA_NOT_FOUND,
+                "unexpected error: {e}"
+            );
+            assert!(e.message().contains("STREAM"), "unexpected message: {e}");
+        }
+    }
+
+    Ok(())
+}
```

**File**: `src/query/storages/fuse/src/operations/navigate.rs` (modified, +30/-16)
```diff
@@ -76,8 +76,12 @@ impl FuseTable {
             }
             NavigationPoint::TableTag(tag_name) => {
                 let snapshot_loc = self.get_tag_snapshot_location(ctx, tag_name).await?;
-                let (snapshot, format_version) =
-                    SnapshotsIO::read_snapshot(snapshot_loc, self.get_operator(), true).await?;
+                let (snapshot, format_version) = Self::read_navigation_snapshot(
+                    snapshot_loc,
+                    self.get_operator(),
+                    &format!("TAG '{tag_name}'"),
+                )
+                .await?;
                 self.load_table_by_snapshot(
                     snapshot.as_ref(),
                     format_version,
@@ -104,7 +108,7 @@ impl FuseTable {
             return Ok(table.into());
         };
         let (snapshot, format_version) =
-            SnapshotsIO::read_snapshot(snapshot_loc.clone(), self.get_operator(), true).await?;
+            Self::read_navigation_snapshot(snapshot_loc, self.get_operator(), "STREAM").await?;
         self.load_table_by_snapshot(
             snapshot.as_ref(),
             format_version,
@@ -335,7 +339,8 @@ impl FuseTable {
         match first_snapshot_after {
             Some(location) => {
                 let (snapshot, _format_version) =
-                    Self::read_snapshot_for_no_check(location, op.clone()).await?;
+                    Self::read_navigation_snapshot(location, op.clone(), "TIMESTAMP with NO_CHECK")
+                        .await?;
 
                 match snapshot.prev_snapshot_id {
                     Some((prev_id, prev_ver)) => {
@@ -348,8 +353,12 @@ impl FuseTable {
                         let prev_location = self
                             .meta_location_generator()
                             .gen_snapshot_location(&prev_id, prev_ver)?;
-                        let (prev_snapshot, prev_format_version) =
-                            Self::read_snapshot_for_no_check(prev_location, op).await?;
+                        let (prev_snapshot, prev_format_version) = Self::read_navigation_snapshot(
+                            prev_location,
+                            op,
+                            "TIMESTAMP with NO_CHECK",
+                        )
+                        .await?;
                         self.load_table_by_snapshot(
                             prev_snapshot.as_ref(),
                             prev_format_version,
@@ -369,27 +378,32 @@ impl FuseTable {
                     ));
                 };
                 let (snapshot, format_version) =
-                    Self::read_snapshot_for_no_check(location, op).await?;
+                    Self::read_navigation_snapshot(location, op, "TIMESTAMP with NO_CHECK").await?;
                 self.load_table_by_snapshot(snapshot.as_ref(), format_version, s3_storage_class)
             }
         }
     }
 
-    /// Read a snapshot for NO_CHECK navigation.
+    /// Read a snapshot that a navigation point (TAG, STREAM, NO_CHECK lookup, revert target)
+    /// resolved to.
     ///
-    /// Missing objects are mapped to `TableHistoricalDataNotFound` so vacuumed
-    /// predecessor snapshots do not surface as raw `StorageNotFound` errors.
-    async fn read_snapshot_for_no_check(
+    /// The snapshot chain and the pointers into it (tags, streams, predecessor ids) can
+    /// outlive the objects once vacuum removes them. A missing object is therefore a
+    /// "historical data is gone" condition and is reported as
+    /// `TableHistoricalDataNotFound`, never as a raw `StorageNotFound` from the object
+    /// store. Every navigation path that reads a snapshot by location goes through here.
+    pub(crate) async fn read_navigation_snapshot(
         location: String,
         op: opendal::Operator,
+        point: &str,
     ) -> Result<(Arc<TableSnapshot>, u64)> {
-        match SnapshotsIO::read_snapshot(location, op, true).await {
+        match SnapshotsIO::read_snapshot(location.clone(), op, true).await {
             Ok(v) => Ok(v),
             Err(e) if e.code() == ErrorCode::STORAGE_NOT_FOUND => {
-                Err(ErrorCode::TableHistoricalDataNotFound(
-                    "No historical data found at given point with NO_CHECK \
-                     (snapshot object is missing, possibly vacuumed)",
-                ))
+                Err(ErrorCode::TableHistoricalDataNotFound(format!(
+                    "No historical data found at {point}: snapshot {location} is missing \
+                     (possibly vacuumed)"
+                )))
             }
             Err(e) => Err(e),
         }
```

**File**: `src/query/storages/fuse/src/operations/revert.rs` (modified, +2/-2)
```diff
@@ -28,7 +28,6 @@ use databend_common_sql::validate_stored_ttl_expr;
 use databend_meta_client::types::MatchSeq;
 
 use crate::FuseTable;
-use crate::io::SnapshotsIO;
 use crate::operations::SnapshotHintWriter;
 
 impl FuseTable {
@@ -103,7 +102,8 @@ impl FuseTable {
             ));
         };
         let (snapshot, format_version) =
-            SnapshotsIO::read_snapshot(snapshot_loc, self.get_operator(), true).await?;
+            Self::read_navigation_snapshot(snapshot_loc, self.get_operator(), "revert point")
+                .await?;
 
         let mut table_info = self.table_info.clone();
         let snapshot_loc = self
```

---

### Incident Patch 14: `3a1be1eb` (2026-09-23)
**Commit Message**: fix(query): canonicalize float zero and NaN in hashes and equality keys (#20547)

* refactor(base): add OrderedFloat::canonicalize for float equality classes

Introduce a single helper that maps every member of a float equality
class to one representative: -0.0 becomes +0.0 and every NaN payload
becomes T::nan(). Number::canonicalize exposes it for generic key code
and is the identity for integers.

This is the shared primitive required by
docs/designs/20260921-float-value-semantics.md (R4) so that all key
boundaries derive hashes and equality keys from the same bits.

* fix(hashtable): hash canonical float bits in FastHash and BloomHash

Replace the ad-hoc NaN branches with OrderedFloat::canonicalize so
-0.0/+0.0 and all NaN payloads share one FastHash and BloomHash value.

* fix(expression): hash container elements and NULL markers in ScalarRef::hash

Array and Map values used to hash their serialized column bytes, which
bypasses the float canonicalization applied by element hashing, and
Null/EmptyArray/EmptyMap wrote nothing, so [NULL, 1] and [1, NULL]
collided. Hash the length plus every element instead and write a
nine-byte marker for payload-less variants that no fixed-width 

**File**: `src/common/base/src/base/ordered_float.rs` (modified, +78/-0)
```diff
@@ -112,6 +112,21 @@ impl<T: FloatCore> OrderedFloat<T> {
     pub fn into_inner(self) -> T {
         self.0
     }
+
+    /// Map every member of an equality class to one representative value.
+    ///
+    /// `-0.0` becomes `+0.0` and every NaN payload becomes `T::nan()`. All
+    /// other values are returned unchanged. Equality keys and hash inputs
+    /// must be derived from the bits of the returned value so that values
+    /// which compare equal under `Ord`/`Eq` also produce identical keys.
+    #[inline]
+    pub fn canonicalize(self) -> Self {
+        if self.0.is_nan() {
+            Self(T::nan())
+        } else {
+            Self(canonicalize_signed_zero(self.0))
+        }
+    }
 }
 
 impl<T: FloatCore> AsRef<T> for OrderedFloat<T> {
@@ -2234,3 +2249,66 @@ impl Unmarshal<OrderedFloat<f64>> for OrderedFloat<f64> {
         f64::from_bits(bits).into()
     }
 }
+
+#[cfg(test)]
+mod canonicalize_tests {
+    use super::OrderedFloat;
+
+    #[test]
+    fn canonicalize_f64_collapses_zero_and_nan_classes() {
+        let zero = OrderedFloat(0.0f64).canonicalize().0.to_bits();
+        assert_eq!(OrderedFloat(-0.0f64).canonicalize().0.to_bits(), zero);
+        assert_eq!(zero, 0.0f64.to_bits());
+
+        let nan = OrderedFloat(f64::NAN).canonicalize().0.to_bits();
+        for bits in [
+            f64::NAN.to_bits(),
+            (-f64::NAN).to_bits(),
+            0x7ff8_0000_0000_0001u64,
+            0xfff0_0000_0000_0001u64,
+            (-1.0f64).sqrt().to_bits(),
+        ] {
+            let value = OrderedFloat(f64::from_bits(bits));
+            assert!(value.is_nan());
+            assert_eq!(value.canonicalize().0.to_bits(), nan, "{bits:#x}");
+        }
+
+        for value in [
+            1.0f64,
+            -1.0,
+            f64::INFINITY,
+            f64::NEG_INFINITY,
+            f64::MIN_POSITIVE,
+        ] {
+            assert_eq!(
+                OrderedFloat(value).canonicalize().0.to_bits(),
+                value.to_bits()
+            );
+        }
+    }
+
+    #[test]
+    fn canonicalize_f32_collapses_zero_and_nan_classes() {
+        let zero = OrderedFloat(0.0f32).canonicalize().0.to_bits();
+        assert_eq!(OrderedFloat(-0.0f32).canonicalize().0.to_bits(), zero);
+
+        let nan = OrderedFloat(f32::NAN).canonicalize().0.to_bits();
+        for bits in [
+            f32::NAN.to_bits(),
+            (-f32::NAN).to_bits(),
+            0x7fc0_0001u32,
+            0xff80_0001u32,
+        ] {
+            let value = OrderedFloat(f32::from_bits(bits));
+            assert!(value.is_nan());
+            assert_eq!(value.canonicalize().0.to_bits(), nan, "{bits:#x}");
+        }
+
+        for value in [1.0f32, -1.0, f32::INFINITY, f32::NEG_INFINITY] {
+            assert_eq!(
+                OrderedFloat(value).canonicalize().0.to_bits(),
+                value.to_bits()
+            );
+        }
+    }
+}
```

**File**: `src/common/hashtable/src/traits.rs` (modified, +7/-20)
```diff
@@ -390,47 +390,34 @@ impl BloomHash for bool {
     }
 }
 
+// Float keys hash the bits of the canonical class representative so that
+// `-0.0`/`+0.0` and every NaN payload share one hash. See
+// `OrderedFloat::canonicalize`.
 impl FastHash for OrderedFloat<f32> {
     #[inline(always)]
     fn fast_hash(&self) -> u64 {
-        if self.is_nan() {
-            f32::NAN.to_bits().fast_hash()
-        } else {
-            self.to_bits().fast_hash()
-        }
+        self.canonicalize().to_bits().fast_hash()
     }
 }
 
 impl BloomHash for OrderedFloat<f32> {
     #[inline(always)]
     fn bloom_hash(&self) -> u64 {
-        if self.is_nan() {
-            f32::NAN.to_bits().bloom_hash()
-        } else {
-            self.to_bits().bloom_hash()
-        }
+        self.canonicalize().to_bits().bloom_hash()
     }
 }
 
 impl FastHash for OrderedFloat<f64> {
     #[inline(always)]
     fn fast_hash(&self) -> u64 {
-        if self.is_nan() {
-            f64::NAN.to_bits().fast_hash()
-        } else {
-            self.to_bits().fast_hash()
-        }
+        self.canonicalize().to_bits().fast_hash()
     }
 }
 
 impl BloomHash for OrderedFloat<f64> {
     #[inline(always)]
     fn bloom_hash(&self) -> u64 {
-        if self.is_nan() {
-            f64::NAN.to_bits().bloom_hash()
-        } else {
-            self.to_bits().bloom_hash()
-        }
+        self.canonicalize().to_bits().bloom_hash()
     }
 }
 
```

**File**: `src/common/hashtable/tests/it/main.rs` (modified, +40/-0)
```diff
@@ -19,6 +19,9 @@ use std::sync::atomic::AtomicUsize;
 use std::sync::atomic::Ordering;
 
 use bumpalo::Bump;
+use databend_common_base::base::OrderedFloat;
+use databend_common_hashtable::BloomHash;
+use databend_common_hashtable::FastHash;
 use databend_common_hashtable::HashMap;
 use databend_common_hashtable::HashtableLike;
 use databend_common_hashtable::ShortStringHashMap;
@@ -88,6 +91,43 @@ fn test_stack_hash_map() {
     simple_test!(StackHashMap);
 }
 
+#[test]
+fn test_float_equality_class_hashes() {
+    fn check_same<T: FastHash + BloomHash>(class: &[T]) {
+        let (first, rest) = class.split_first().unwrap();
+        for other in rest {
+            assert_eq!(first.fast_hash(), other.fast_hash());
+            assert_eq!(first.bloom_hash(), other.bloom_hash());
+        }
+    }
+
+    check_same(&[OrderedFloat(0.0f32), OrderedFloat(-0.0f32)]);
+    check_same(&[OrderedFloat(0.0f64), OrderedFloat(-0.0f64)]);
+    check_same(&[
+        OrderedFloat(f32::NAN),
+        OrderedFloat(-f32::NAN),
+        OrderedFloat(f32::from_bits(0x7fc0_0001)),
+        OrderedFloat(f32::from_bits(0xffc0_0001)),
+    ]);
+    check_same(&[
+        OrderedFloat(f64::NAN),
+        OrderedFloat(-f64::NAN),
+        OrderedFloat(f64::from_bits(0x7ff8_0000_0000_0001)),
+        OrderedFloat(f64::from_bits(0xfff8_0000_0000_0001)),
+        OrderedFloat((-1.0f64).sqrt()),
+    ]);
+
+    // Distinct classes must stay distinguishable.
+    assert_ne!(
+        OrderedFloat(0.0f64).fast_hash(),
+        OrderedFloat(f64::NAN).fast_hash()
+    );
+    assert_ne!(
+        OrderedFloat(1.0f64).bloom_hash(),
+        OrderedFloat(-1.0f64).bloom_hash()
+    );
+}
+
 #[test]
 fn test_fast_memcmp() {
     let mut rng = rand::thread_rng();
```

**File**: `src/common/statistics/src/histogram.rs` (modified, +61/-1)
```diff
@@ -275,7 +275,11 @@ impl NumericRange {
     pub(crate) fn width(self) -> Option<f64> {
         match self {
             Self::Integer { min, max } => max.checked_sub(min).map(|width| width as f64),
-            Self::Float { min, max } => Some(max.into_inner() - min.into_inner()),
+            Self::Float { min, max } => {
+                // See `NumericValue::distance` for `OrderedFloat<f64>`.
+                let width = max.into_inner() - min.into_inner();
+                width.is_finite().then_some(width)
+            }
         }
     }
 
@@ -935,6 +939,62 @@ mod tests {
         Ok(())
     }
 
+    /// NaN sorts above every finite value, so a column holding NaN yields
+    /// buckets such as `[1.0, NaN]`. Their width is undefined and estimation
+    /// must degrade gracefully instead of producing NaN coverages.
+    #[test]
+    fn test_float_join_with_nan_bounds_does_not_panic() -> ExceptionResult<()> {
+        let histogram = |buckets: Vec<TypedHistogramBucket<F64>>| {
+            Histogram::Float(TypedHistogram {
+                accuracy: false,
+                row_scale: 1.0,
+                buckets,
+                avg_spacing: None,
+            })
+        };
+        let left = histogram(vec![TypedHistogramBucket::new(
+            F64::from(1.0),
+            F64::from(f64::NAN),
+            4.0,
+            3.0,
+        )]);
+        let right = histogram(vec![
+            TypedHistogramBucket::new(F64::from(0.0), F64::from(2.0), 2.0, 2.0),
+            TypedHistogramBucket::new(F64::from(2.0), F64::from(f64::NAN), 2.0, 2.0),
+        ]);
+        for (left, right) in [(&left, &right), (&right, &left), (&left, &left)] {
+            let estimation = left.estimate_join(right)?;
+            assert!(estimation.cardinality.expected.is_finite());
+            assert!(estimation.ndv.upper.is_finite());
+        }
+        let infinite = histogram(vec![TypedHistogramBucket::new(
+            F64::from(f64::NEG_INFINITY),
+            F64::from(f64::INFINITY),
+            4.0,
+            3.0,
+        )]);
+        assert!(
+            infinite
+                .estimate_join(&right)?
+                .cardinality
+                .expected
+                .is_finite()
+        );
+
+        // Restricting a NaN-bounded bucket keeps it whole instead of scaling
+        // its counts by an undefined selectivity.
+        let Histogram::Float(nan_bucket) = &left else {
+            unreachable!()
+        };
+        let restricted = nan_bucket
+            .restrict_float_buckets(F64::from(2.0), F64::from(f64::NAN))
+            .expect("bucket overlaps the requested range");
+        assert_eq!(restricted.buckets.len(), 1);
+        assert_eq!(restricted.buckets[0].num_values(), 4.0);
+        assert_eq!(restricted.buckets[0].num_distinct(), 3.0);
+        Ok(())
+    }
+
     #[test]
     fn test_direct_mixed_integer_join_matches_typed_join() -> ExceptionResult<()> {
         let left = Histogram::Int(TypedHistogram {
```

**File**: `src/common/statistics/src/typed_histogram.rs` (modified, +15/-4)
```diff
@@ -345,11 +345,17 @@ fn float_overlap_counts(
     num_values: f64,
     num_distinct: f64,
 ) -> (f64, f64) {
-    let bucket_width = bucket_max.into_inner() - bucket_min.into_inner();
+    // Buckets touching NaN or infinity have no usable width; keep the whole
+    // bucket rather than scaling by an undefined selectivity.
+    let (Some(bucket_width), Some(overlap_width)) = (
+        NumericValue::distance(&bucket_min, &bucket_max),
+        NumericValue::distance(&new_min, &new_max),
+    ) else {
+        return (num_values, num_distinct);
+    };
     if bucket_width <= 0.0 {
         return (num_values, num_distinct);
     }
-    let overlap_width = new_max.into_inner() - new_min.into_inner();
     let selectivity = overlap_width / bucket_width;
     debug_assert!(
         (0.0..=1.0).contains(&selectivity),
@@ -839,7 +845,8 @@ impl Value for OrderedFloat<f64> {
 
     fn avg_spacing(min: &Self, max: &Self, num_buckets: usize) -> Option<f64> {
         (max > min && num_buckets > 0)
-            .then(|| (max.into_inner() - min.into_inner()) / num_buckets as f64)
+            .then(|| Self::distance(min, max).map(|width| width / num_buckets as f64))
+            .flatten()
     }
 
     fn estimate_overlap_coverages(
@@ -855,8 +862,12 @@ impl Value for OrderedFloat<f64> {
 }
 
 impl NumericValue for OrderedFloat<f64> {
+    /// Ranges touching NaN or infinity have no usable width: NaN sorts above
+    /// every finite value, so `[1.0, NaN]` is a valid bucket whose distance is
+    /// undefined rather than infinite.
     fn distance(start: &Self, end: &Self) -> Option<f64> {
-        Some(end.into_inner() - start.into_inner())
+        let width = end.into_inner() - start.into_inner();
+        width.is_finite().then_some(width)
     }
 
     fn as_wide_integer(&self) -> i128 {
```

**File**: `src/query/expression/src/aggregate/group_hash.rs` (modified, +12/-11)
```diff
@@ -12,6 +12,10 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use std::hash::DefaultHasher;
+use std::hash::Hash;
+use std::hash::Hasher;
+
 use databend_common_base::base::OrderedFloat;
 use databend_common_column::bitmap::Bitmap;
 use databend_common_column::buffer::Buffer;
@@ -601,25 +605,20 @@ impl AggHash for i256 {
     }
 }
 
+// Float keys hash the bits of the canonical class representative so that
+// `-0.0`/`+0.0` and every NaN payload share one hash. See
+// `OrderedFloat::canonicalize`.
 impl AggHash for OrderedFloat<f32> {
     #[inline(always)]
     fn agg_hash(&self) -> u64 {
-        if self.is_nan() {
-            f32::NAN.to_bits().agg_hash()
-        } else {
-            self.to_bits().agg_hash()
-        }
+        self.canonicalize().to_bits().agg_hash()
     }
 }
 
 impl AggHash for OrderedFloat<f64> {
     #[inline(always)]
     fn agg_hash(&self) -> u64 {
-        if self.is_nan() {
-            f64::NAN.to_bits().agg_hash()
-        } else {
-            self.to_bits().agg_hash()
-        }
+        self.canonicalize().to_bits().agg_hash()
     }
 }
 
@@ -632,7 +631,9 @@ impl AggHash for OpaqueScalarRef<'_> {
 impl AggHash for ScalarRef<'_> {
     #[inline(always)]
     fn agg_hash(&self) -> u64 {
-        self.to_string().as_bytes().agg_hash()
+        let mut hasher = DefaultHasher::new();
+        self.hash(&mut hasher);
+        hasher.finish()
     }
 }
 
```

**File**: `src/query/expression/src/kernels/group_by_hash/method_fixed_keys.rs` (modified, +30/-4)
```diff
@@ -202,7 +202,20 @@ impl FixedKey for u32 {
         match column {
             Column::Number(NumberColumn::UInt32(_)) => Some(KeysState::Column(column.clone())),
             Column::Number(NumberColumn::Float32(buffer)) => {
-                let buffer = unsafe { std::mem::transmute(buffer.clone()) };
+                // Reinterpret the bits directly unless some value is not the
+                // canonical representative of its equality class (`-0.0` or a
+                // NaN payload other than `f32::NAN`).
+                let buffer = if buffer
+                    .iter()
+                    .any(|value| value.to_bits() != value.canonicalize().to_bits())
+                {
+                    buffer
+                        .iter()
+                        .map(|value| value.canonicalize().to_bits())
+                        .collect()
+                } else {
+                    unsafe { std::mem::transmute(buffer.clone()) }
+                };
                 Some(KeysState::Column(Column::Number(u32::upcast_column(
                     buffer,
                 ))))
@@ -225,7 +238,20 @@ impl FixedKey for u64 {
         match column {
             Column::Number(NumberColumn::UInt64(_)) => Some(KeysState::Column(column.clone())),
             Column::Number(NumberColumn::Float64(buffer)) => {
-                let buffer = unsafe { std::mem::transmute(buffer.clone()) };
+                // Reinterpret the bits directly unless some value is not the
+                // canonical representative of its equality class (`-0.0` or a
+                // NaN payload other than `f64::NAN`).
+                let buffer = if buffer
+                    .iter()
+                    .any(|value| value.to_bits() != value.canonicalize().to_bits())
+                {
+                    buffer
+                        .iter()
+                        .map(|value| value.canonicalize().to_bits())
+                        .collect()
+                } else {
+                    unsafe { std::mem::transmute(buffer.clone()) }
+                };
                 Some(KeysState::Column(Column::Number(u64::upcast_column(
                     buffer,
                 ))))
@@ -435,7 +461,7 @@ fn fixed_hash(keys_vec: &mut KeysVec, col_index: usize, column: &Column) -> Resu
                             for (row, (value, valid)) in c.iter().zip(bitmap.iter()).enumerate() {
                                 if valid {
                                     let slice = keys_vec.value(row, col_index);
-                                    value.marshal(slice);
+                                    value.canonicalize().marshal(slice);
                                 } else {
                                     keys_vec.set_null(row, col_index);
                                 }
@@ -444,7 +470,7 @@ fn fixed_hash(keys_vec: &mut KeysVec, col_index: usize, column: &Column) -> Resu
                         None => {
                             for (row, value) in c.iter().enumerate() {
                                 let slice = keys_vec.value(row, col_index);
-                                value.marshal(slice);
+                                value.canonicalize().marshal(slice);
                             }
                         }
                     }
```

**File**: `src/query/expression/src/kernels/group_by_hash/utils.rs` (modified, +3/-2)
```diff
@@ -23,6 +23,7 @@ use crate::types::NullableColumn;
 use crate::types::NumberColumn;
 use crate::types::binary::BinaryColumnBuilder;
 use crate::types::decimal::DecimalColumn;
+use crate::types::number::Number;
 use crate::types::vector::VectorScalarRef;
 use crate::utils::bitmap::normalize_bitmap_column;
 use crate::with_decimal_type;
@@ -64,7 +65,7 @@ pub unsafe fn serialize_column_binary(column: &Column, row: usize, row_space: &m
             Column::Null { .. } | Column::EmptyArray { .. } | Column::EmptyMap { .. } => {}
             Column::Number(v) => with_number_mapped_type!(|NUM_TYPE| match v {
                 NumberColumn::NUM_TYPE(v) => {
-                    row_space.store_value_uncheckd(&v[row]);
+                    row_space.store_value_uncheckd(&v[row].canonicalize());
                 }
             }),
             Column::Decimal(v) => {
@@ -131,7 +132,7 @@ pub unsafe fn serialize_column_binary(column: &Column, row: usize, row_space: &m
                 with_vector_number_type!(|NUM_TYPE| match scalar {
                     VectorScalarRef::NUM_TYPE(vals) => {
                         for val in vals {
-                            row_space.store_value_uncheckd(val);
+                            row_space.store_value_uncheckd(&val.canonicalize());
                         }
                     }
                 })
```

---

### Incident Patch 15: `d125f61c` (2026-09-23)
**Commit Message**: fix(query): three-valued logic in equivalence folding and LIKE on constant operands, found by metamorphic testing (#20545)

Add tests/fuzz/tlp.py: random predicates over small tables checked
against identities that hold for every predicate (TLP: Q == Q WHERE p ∪
Q WHERE NOT p ∪ Q WHERE p IS NULL as multisets; NoREC: count(*) WHERE p
== sum(CASE WHEN p THEN 1 ELSE 0 END); INNER JOIN ON p == CROSS JOIN
WHERE p; DISTINCT vs GROUP BY). It finds wrong results, not just
crashes, needs no reference engine and no dependencies, is deterministic
per seed, and prints the SQL to reproduce. Re-enable the standalone fuzz
CI job with it.

Two bugs from the first seeds, fixed here with regression tests in
query/filter_semantics.test:

- EquivalentConstantsVisitor recorded `col = const` from any conjunction
  it walked, including conjunctions nested under other functions. In
  `WHERE (a = 1 AND a = 2) IS NULL` the inner `a` was rewritten to 1,
  the conjunction folded to FALSE, and the filter to `false`: 0 rows
  instead of the rows where `a` is NULL. Track whether the visited
  expression is asserted (must be true for the row to survive); only
  then may an equality be recorded. Inherited equaliti

**File**: `.github/actions/test_fuzz_standalone_linux/action.yml` (modified, +1/-6)
```diff
@@ -5,12 +5,7 @@ runs:
   steps:
     - uses: ./.github/actions/setup_test
 
-    - name: Test setup
-      shell: bash
-      run: |
-        bash ./scripts/setup/dev_setup.sh -yd
-
-    - name: Run fuzz Tests with Standalone mode with embedded meta-store
+    - name: Run metamorphic oracle tests (TLP / NoREC) in standalone mode
       shell: bash
       run: |
         bash ./scripts/ci/ci-run-fuzz-tests.sh
```

**File**: `.github/workflows/reuse.linux.yml` (modified, +15/-13)
```diff
@@ -417,19 +417,21 @@ jobs:
         with:
           name: test-stateful-iceberg-catalogs-standalone
 
-  # test_fuzz_standalone:
-  #   needs: [build, check]
-  #   runs-on:
-  #     - self-hosted
-  #     - "${{ inputs.runner_arch }}"
-  #     - Linux
-  #     - 2c
-  #     - "${{ inputs.runner_provider }}"
-  #   steps:
-  #     - uses: actions/checkout@v6
-  #     - uses: ./.github/actions/test_fuzz_standalone_linux
-  #       timeout-minutes: 10
-  #       continue-on-error: true
+  # Metamorphic oracle testing (TLP / NoREC, tests/fuzz/tlp.py): random predicates
+  # checked against algebraic identities, so it finds wrong results, not just crashes.
+  # Deterministic per seed; a failure prints the seed and the SQL to reproduce.
+  test_fuzz_standalone:
+    needs: [build, check]
+    runs-on:
+      - self-hosted
+      - "${{ inputs.runner_arch }}"
+      - Linux
+      - 2c
+      - "${{ inputs.runner_provider }}"
+    steps:
+      - uses: actions/checkout@v6
+      - uses: ./.github/actions/test_fuzz_standalone_linux
+        timeout-minutes: 15
 
   test_ee_standalone:
     needs: [build, check]
```

**File**: `scripts/ci/ci-run-fuzz-tests.sh` (modified, +5/-2)
```diff
@@ -10,5 +10,8 @@ echo "Starting standalone DatabendQuery and DatabendMeta"
 SCRIPT_PATH="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
 cd "$SCRIPT_PATH/../../tests/fuzz" || exit
 
-echo "Starting databend fuzz tests"
-python3 fuzz.py
+# Metamorphic oracle testing: random predicates checked against identities that
+# hold for every predicate (TLP / NoREC). Python stdlib only; deterministic per
+# seed, and a failure prints the seed and the SQL statements to reproduce.
+echo "Starting databend metamorphic oracle tests"
+TLP_ITERATIONS=${TLP_ITERATIONS:-400} python3 tlp.py
```

**File**: `src/query/expression/src/filter/selector.rs` (modified, +3/-3)
```diff
@@ -371,9 +371,9 @@ impl<'a> Selector<'a> {
         if value.is_scalar_null() {
             return Ok(0);
         }
-        let column = value
-            .into_column()
-            .map_err(|v| ErrorCode::Internal(format!("Can not convert to column: {v}")))?;
+        // The operand is usually a column, but a block may carry it as a constant (e.g. the
+        // replicated side of a cross join); the LIKE fast path then applies to every row.
+        let column = value.convert_to_full_column(&data_type, self.num_rows);
 
         let (column, validity) = FilterHelpers::split_nullable_string_column(column);
 
```

**File**: `src/query/sql/src/planner/optimizer/optimizers/operator/filter/equivalent_constants_visitor.rs` (modified, +31/-5)
```diff
@@ -54,10 +54,28 @@ impl VisitorMut<'_> for EquivalentConstantsVisitor {
     }
 }
 
-#[derive(Default)]
 pub struct EquivalentConstantsVisitorInner {
     eq_constants: HashMap<BoundColumnRef, ScalarExpr>,
     left_visit_order: bool,
+    /// Whether the expression being visited must be true for the row to be kept.
+    ///
+    /// Only then does `col = const` assert anything about the row, so only then may it be
+    /// recorded as an equivalence. A conjunction nested under another function, e.g.
+    /// `is_null(a = 1 AND a = 2)`, `if(a = 1 AND a = 2, ...)`, is merely evaluated: folding
+    /// it to `false` would erase the difference between FALSE and NULL that the enclosing
+    /// function observes. Inherited equivalences may still be *substituted* anywhere,
+    /// because they hold for every row that reaches the expression.
+    asserted: bool,
+}
+
+impl Default for EquivalentConstantsVisitorInner {
+    fn default() -> Self {
+        Self {
+            eq_constants: HashMap::new(),
+            left_visit_order: false,
+            asserted: true,
+        }
+    }
 }
 
 impl EquivalentConstantsVisitorInner {
@@ -66,6 +84,11 @@ impl EquivalentConstantsVisitorInner {
         self
     }
 
+    fn asserted(mut self, asserted: bool) -> Self {
+        self.asserted = asserted;
+        self
+    }
+
     fn left_visit_order(mut self, left_visit_order: bool) -> Self {
         self.left_visit_order = left_visit_order;
         self
@@ -123,7 +146,8 @@ impl VisitorMut<'_> for EquivalentConstantsVisitorInner {
             "or" | "or_filters" => {
                 for expr in &mut func.arguments {
                     let mut visitor = EquivalentConstantsVisitorInner::default()
-                        .left_visit_order(self.left_visit_order);
+                        .left_visit_order(self.left_visit_order)
+                        .asserted(self.asserted);
                     visitor.visit(expr)?;
                 }
             }
@@ -142,7 +166,8 @@ impl VisitorMut<'_> for EquivalentConstantsVisitorInner {
                 for expr in &mut func.arguments {
                     let mut visitor = EquivalentConstantsVisitorInner::default()
                         .eq_constants(self.eq_constants.clone())
-                        .left_visit_order(self.left_visit_order);
+                        .left_visit_order(self.left_visit_order)
+                        .asserted(false);
                     visitor.visit(expr)?;
                 }
                 let Some(op) = ComparisonOp::try_from_func_name(&func.func_name) else {
@@ -157,7 +182,7 @@ impl VisitorMut<'_> for EquivalentConstantsVisitorInner {
                 if right != func.arguments[1] {
                     func.arguments[1] = right;
                 }
-                if !matches!(op, ComparisonOp::Equal) {
+                if !matches!(op, ComparisonOp::Equal) || !self.asserted {
                     return func.refresh_return_type();
                 }
 
@@ -219,7 +244,8 @@ impl VisitorMut<'_> for EquivalentConstantsVisitorInner {
         for argument in &mut lambda.args {
             let mut visitor = EquivalentConstantsVisitorInner::default()
                 .eq_constants(self.eq_constants.clone())
-                .left_visit_order(self.left_visit_order);
+                .left_visit_order(self.left_visit_order)
+                .asserted(false);
             visitor.visit(argument)?;
         }
         lambda.refresh_return_type()
```

**File**: `tests/fuzz/readme.md` (modified, +26/-12)
```diff
@@ -1,19 +1,33 @@
-# Fuzz test
+# Fuzz and metamorphic tests
 
-Fuzz test get sql in given grammar, execute it using mysql client.
+## `tlp.py` — metamorphic oracle testing (runs in CI)
 
-## failed condition
+Generates random predicates over small tables and checks identities that must hold for
+every predicate, so a mismatch is a bug without a reference database:
 
-Result is not a mysql error or None is a failed test.
+- **TLP** (ternary logic partitioning): `Q == Q WHERE p ∪ Q WHERE NOT p ∪ Q WHERE p IS NULL`
+  as multisets — filter push-down, join rewrites, NULL semantics.
+- **NoREC**: `count(*) WHERE p == sum(CASE WHEN p THEN 1 ELSE 0 END)` — the right side
+  evaluates `p` as a projection, bypassing filter push-down, pruning and prewhere.
+- **Join TLP**: `INNER JOIN ON p == CROSS JOIN WHERE p`; TLP over a LEFT JOIN.
+- **Aggregation**: DISTINCT vs GROUP BY group counts, partition counts add up.
 
-## python dependency
+Only internal errors (`Internal`, `PanicError`, `StorageNotFound`) and inconsistencies fail
+the run; a query the server rejects with a semantic/type error is skipped. Everything is
+deterministic per seed:
 
-1. python3
-2. pip3 install fuzzingbook mysql-connector
+```shell
+# against a running standalone query node (http handler on 8000)
+python3 tests/fuzz/tlp.py --iterations 400 --seed 42
+```
 
-## add new grammar fuzzer
+A failure prints the seed and the exact SQL to reproduce. Bugs it found on first use are
+kept as regression tests in `tests/sqllogictests/suites/query/filter_semantics.test`.
 
-1. Add new grammar, as a example: select_grammar:Grammar = {}
-2. Add validate of new grammar, assert is_valid_grammar(select_grammar)
-3. Add grammar to generator list with fuzz times, generator_list = [...]
-4. Run fuzz.py
\ No newline at end of file
+## `fuzz.py` — grammar-based fuzzing (manual)
+
+Generates SQL from a grammar and executes it through the MySQL handler; a result that is not
+a MySQL error or `None` is a failure. Needs `pip3 install fuzzingbook mysql-connector`.
+
+To add a grammar: define it (e.g. `select_grammar: Grammar = {}`), assert
+`is_valid_grammar(select_grammar)`, and add it to `generator_list` with a fuzz count.
```

**File**: `tests/fuzz/tlp.py` (added, +452/-0)
```diff
@@ -0,0 +1,452 @@
+#!/usr/bin/env python3
+# Copyright 2021 Datafuse Labs
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Metamorphic query testing with self-checking oracles (no reference engine).
+
+Grammar-based fuzzing only catches crashes and errors; the bugs that hurt most
+return a wrong result silently (a LEFT JOIN turned into an INNER JOIN, a row
+dropped by pruning, a NULL treated as a value). This harness generates random
+predicates over small tables and checks algebraic identities that must hold for
+*every* predicate, so a mismatch is a bug without needing another database to
+compare against:
+
+- TLP (ternary logic partitioning, Rigger & Su 2020): for any predicate p,
+      Q                ==  Q WHERE p  UNION ALL  Q WHERE NOT p  UNION ALL  Q WHERE p IS NULL
+  compared as multisets of rows. Exercises filter push-down, join rewrites and
+  NULL semantics.
+- NoREC (non-optimizing reference): for any predicate p,
+      SELECT count(*) FROM T WHERE p  ==  SELECT sum(CASE WHEN p THEN 1 ELSE 0 END) FROM T
+  The right-hand side evaluates p as a projection, bypassing filter push-down,
+  index pruning and prewhere, so a disagreement points at the filtering path.
+- Join TLP: INNER JOIN ON p == CROSS JOIN WHERE p, and TLP over the ON predicate
+  for LEFT JOIN row counts.
+- Aggregation consistency: DISTINCT vs GROUP BY, count(DISTINCT) vs GROUP BY.
+
+Every case is deterministic given the seed. On a mismatch the script prints the
+seed and the exact SQL statements to reproduce, then exits non-zero.
+
+    python3 tests/fuzz/tlp.py --iterations 300 --seed 42
+
+Only internal errors (Internal, PanicError, UnwindError, StorageNotFound) and
+inconsistencies fail the run. A generated query that the server rejects with a
+semantic/type error is skipped: the generator is deliberately loose about types
+so that type coercion paths are exercised too.
+"""
+
+from __future__ import annotations
+
+import argparse
+import json
+import os
+import random
+import sys
+import urllib.error
+import urllib.request
+from collections import Counter
+from dataclasses import dataclass
+
+# Error codes that always indicate a bug.
+FATAL_ERROR_CODES = {
+    1001,  # Internal
+    1104,  # PanicError / UnwindError
+    3001,  # StorageNotFound
+}
+
+
+class Client:
+    def __init__(self, host: str, port: int, user: str, database: str):
+        self.url = f"http://{host}:{port}/v1/query"
+        self.user = user
+        self.database = database
+
+    def query(self, sql: str) -> tuple[list[list], dict | None]:
+        body = json.dumps(
+            {"sql": sql, "session": {"database": self.database}, "pagination": {"wait_time_secs": 30}}
+        ).encode()
+        req = urllib.request.Request(self.url, data=body, method="POST")
+        req.add_header("Content-Type", "application/json")
+        req.add_header("Authorization", "Basic " + __import__("base64").b64encode(f"{self.user}:".encode()).decode())
+        try:
+            with urllib.request.urlopen(req, timeout=120) as resp:
+                result = json.load(resp)
+        except urllib.error.URLError as err:
+            raise ConnectionError(f"request failed: {err}") from err
+        if result.get("error"):
+            return [], result["error"]
+        rows = list(result.get("data", []))
+        while result.get("next_uri"):
+            next_url = f"{self.url.rsplit('/v1/', 1)[0]}{result['next_uri']}"
+            req = urllib.request.Request(next_url, method="GET")
+            req.add_header("Authorization", "Basic " + __import__("base64").b64encode(f"{self.user}:".encode()).decode())
+            with urllib.request.urlopen(req, timeout=120) as resp:
+                result = json.load(resp)
+            if result.get("error"):
+                return [], result["error"]
+            rows.extend(result.get("data", []))
+        return rows, None
+
+    def execute(self, sql: str) -> None:
+        _, err = self.query(sql)
+        if err:
+            raise RuntimeError(f"{sql}\n  -> {err}")
+
+
+@dataclass
+class Column:
+    name: str
+    kind: str  # int | str | date | dec | bool
+
+
+TABLES = {
+    "tlp_t1": [
+        Column("a", "int"),
+        Column("b", "int"),
+        Column("c", "str"),
+        Column("d", "date"),
+        Column("e", "dec"),
+        Column("f", "bool"),
+    ],
+    "tlp_t2": [
+        Column("a", "int"),
+        Column("x", "int"),
+        Column("c", "str"),
+    ],
+}
+
+SQL_TYPES = {
+    "
```

**File**: `tests/sqllogictests/suites/query/filter_semantics.test` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+# Regressions found by the metamorphic oracle harness (tests/fuzz/tlp.py).
+
+statement ok
+CREATE OR REPLACE TABLE fs_t(a INT NULL, c STRING NULL)
+
+statement ok
+INSERT INTO fs_t VALUES (1, 'ab'), (NULL, 'b'), (2, NULL), (2, 'héllo')
+
+# `a = 1 AND a = 2` is contradictory, and folding it to FALSE is fine when the conjunction
+# is the filter itself (FALSE and NULL both drop the row). Nested under a function that
+# distinguishes FALSE from NULL it is not: for a NULL `a` the conjunction is NULL.
+query I
+SELECT count(*) FROM fs_t WHERE a = 1 AND a = 2
+----
+0
+
+query I
+SELECT count(*) FROM fs_t WHERE (a = 1 AND a = 2) IS NULL
+----
+1
+
+query I
+SELECT count(*) FROM fs_t WHERE NOT (a = 1 AND a = 2)
+----
+3
+
+query I
+SELECT count(*) FROM fs_t WHERE if(a = 1 AND a = 2, 0, 1) = 1
+----
+4
+
+query I
+SELECT count(*) FROM fs_t WHERE coalesce(a = 1 AND a = 2, TRUE)
+----
+1
+
+# An equivalence asserted by the filter may still be substituted inside nested functions:
+# for the rows that pass `a = 1`, `a = 2` is FALSE, never NULL.
+query I
+SELECT count(*) FROM fs_t WHERE a = 1 AND is_null(a = 2)
+----
+0
+
+# TLP: the three partitions of any predicate add up to the whole table.
+query I
+SELECT (SELECT count(*) FROM fs_t WHERE (a = 1 AND a = 2) OR c LIKE 'a%')
+     + (SELECT count(*) FROM fs_t WHERE NOT ((a = 1 AND a = 2) OR c LIKE 'a%'))
+     + (SELECT count(*) FROM fs_t WHERE ((a = 1 AND a = 2) OR c LIKE 'a%') IS NULL)
+----
+4
+
+# The LIKE fast path of the filter selector must accept a constant operand: the replicated
+# side of a cross join arrives as a constant block entry.
+statement ok
+CREATE OR REPLACE TABLE fs_r(x INT NULL)
+
+statement ok
+INSERT INTO fs_r VALUES (1), (2), (NULL)
+
+query I
+SELECT count(*) FROM fs_t l CROSS JOIN fs_r r WHERE NOT (l.c NOT LIKE '%b%' AND r.x > 1)
+----
+8
+
+query I
+SELECT count(*) FROM fs_t l CROSS JOIN fs_r r WHERE l.c LIKE '%b%' OR r.x <= 1
+----
+8
+
+query I
+SELECT count(*) FROM fs_t l CROSS JOIN fs_r r WHERE NOT (l.c LIKE 'h%' AND r.x IS NULL)
+----
+10
+
+statement ok
+DROP TABLE fs_t
+
+statement ok
+DROP TABLE fs_r
```

#### Recent Merged Pull Requests:
- **PR #20600** (2026-10-04): feat(storage): presign azblob internal stage with user delegation SAS (@hantmac)
- **PR #20599** (2026-09-30): fix(planner): keep rank limit off eager aggregates below joins (@youngsofun)
- **PR #20593** (2026-09-30): feat(query): distribute data rewrite of ALTER TABLE MODIFY COLUMN (@SkyFan2002)
- **PR #20592** (2026-09-30): fix(query): keep scalar eager aggregates out of inner/cross joins (@sundy-li)
- **PR #20590** (2026-09-29): fix(storage): read Iceberg tables on Azure (abfs[s]) (@djouallah)
- **PR #20589** (closed): fix(storage): read Iceberg tables on Azure (abfs[s]) (@djouallah)
- **PR #20586** (2026-09-29): fix(parser): accept and ignore LIMIT in VACUUM DROP TABLE (@TCeason)
- **PR #20585** (2026-09-29): fix(query): preserve time in string date arithmetic (@TCeason)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
