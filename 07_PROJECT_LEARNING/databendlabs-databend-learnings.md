> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `90d7dd75`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T14:07:32.894Z  
> **Learning ID**: `learn-github-databendlabs-databend`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): databendlabs/databend

> **Canonical Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T14:07:32.077Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9472 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20797** (2026-10-20): **fix(query): reclaim metadata of dropped tables with retired engines**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  After #20558 removed the `DELTA` table engine, existing `DELTA` tables were left behind in metadata. On builds without #20663, `VACUUM ALL` failed with `Unknown table engine DELTA`, because `list_tables` built the engine for every table. #20663 fixed that hard failure by skipping tables it cannot load during listing.  This PR fixes the two problems that remain:  1. **Dropped tables with a removed engine are never cleaned.** `VACUUM DROP TABLE` / `VACUUM DROPPED OBJECTS` calls `get_table_by_info` for every table that is not fuse-backed. For `DELTA` this always fails, so the table metadata, and the metadata of its database, is kept and a warning is added on every run.    - Add `RETIRED_TABLE_ENGINES` (currently only `DELTA`) and `is_retired_engine()` in `table_keys.rs`.    - In `VacuumDropTablesInterpreter`, dropped tables with a retired engine skip the engine check and get metadata-only GC. This is safe because `DELTA` was a read-only external engine, so Databend never owned any data files for it.    - Engines that are not known and not on the retired list are still kept, with a warning, as before. The existing test for this behavior does not change. 2. **The error did not say which table.** `Unknown table engine X` now reads `Unknown table engine X for table 'db'.'tbl' (id: N)`. It uses the table name when `desc` is empty. This improves the `load_tables` warning, the 

- **Issue #20792** (2026-10-20): **fix(version): remove nightly suffix from binary versions**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Remove the trailing `-nightly` suffix from Databend's binary version at the shared build-time entry point. For example, a release version of `v1.2.952-nightly` now produces `DATABEND_GIT_SEMVER=v1.2.952` and commit versions beginning with `v1.2.952-<sha>`.  - Normalize versions from both `DATABEND_RELEASE_VERSION` and Git tag discovery before exporting `DATABEND_GIT_SEMVER`. - Keep the internal `DATABEND_SEMVER` and externally displayed Query/Meta versions consistent. - Preserve release tags, other prerelease suffixes such as `-p2` and `-rc.1`, and Rust nightly toolchain identifiers. - Add normalization coverage and checks for the internal semantic version and Query/Meta commit-version prefixes.  Compatibility: consumers of binary version strings will no longer see `-nightly` for nightly-tagged builds. No persisted-data migration or release-tag changes are required.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  Local validation:  ```sh DATABEND_RELEASE_VERSION=v1.2.952-nightly cargo test -p databend-common-building -p databend-common-version --lib cargo clippy -p databend-common-building -p databend-common-version --all-targets -- -D warnings rustfmt --check --edition 2024 src/common/building/src/lib.rs src/common/version/src/lib.rs git diff --check ```  Full workspace and SQL logic tests w

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

### Incident Patch 1: `5c09ab04` (2026-10-20)
**Commit Message**: fix(query): preserve original pipeline errors before interruption (#20750)

* fix(query): preserve original pipeline errors before interruption

* fix(query): run memory diagnostics outside finished_error lock

QueryPipelineExecutor::finish() ran memory limit diagnostics while it held
finished_error. The diagnostics lock DataExchangeManager::queries_coordinator,
and DataExchangeManager::shutdown_query calls finish() with that lock held,
which is an ABBA deadlock between an OOM worker and StatisticsSender.

Save the first error under the lock, release it, interrupt the graph, then
collect diagnostics in an unlimited memory scope so that a diagnostics
allocation on an over-limit thread cannot panic before workers are stopped.

**File**: `src/query/service/src/pipelines/executor/query_pipeline_executor.rs` (modified, +184/-11)
```diff
@@ -259,21 +259,36 @@ impl QueryPipelineExecutor {
     pub fn finish<C>(&self, cause: Option<ErrorCode<C>>) {
         let cause = cause.map(|err| err.with_context("Pipeline executor finished"));
 
-        let mut finished_error = self.finished_error.lock();
-        if let Some(cause) = cause {
-            // We only save the cause of the first error.
-            if finished_error.is_none() {
-                if !self.graph.is_should_finish() {
-                    log_memory_limit_diagnostics(&cause, "memory limit exceeded");
+        let mut diagnose_cause = None;
+        {
+            let mut finished_error = self.finished_error.lock();
+            if let Some(cause) = cause {
+                // We only save the cause of the first error. It must be saved before
+                // interrupting the graph, otherwise a sibling worker may observe the
+                // interruption and save ABORTED_QUERY first.
+                if finished_error.is_none() {
+                    if !self.graph.is_should_finish()
+                        && cause.code() == ErrorCode::MEMORY_EXCEEDS_LIMIT
+                    {
+                        diagnose_cause = Some(cause.clone());
+                    }
+                    *finished_error = Some(cause);
                 }
-                *finished_error = Some(cause);
             }
         }
 
-        drop(finished_error);
         self.global_tasks_queue.finish(self.workers_condvar.clone());
         self.graph.interrupt();
         self.finished_notify.notify_waiters();
+
+        // Collect diagnostics after releasing `finished_error` and interrupting the graph.
+        // The diagnostics lock DataExchangeManager, while DataExchangeManager::shutdown_query
+        // calls finish() with that lock held, so holding `finished_error` here can deadlock.
+        // The diagnostics may run on a thread that has already exceeded its memory limit.
+        if let Some(cause) = diagnose_cause {
+            let _guard = LimitMemGuard::enter_unlimited();
+            log_memory_limit_diagnostics(&cause, "memory limit exceeded");
+        }
     }
 
     pub fn is_finished(&self) -> bool {
@@ -422,7 +437,8 @@ impl QueryPipelineExecutor {
                 let this_clone = this.clone();
                 let try_result = catch_unwind(|| this_clone.execute_single_thread(thread_num));
 
-                // finish the pipeline executor when has error or panic
+                // Save the original error before interrupting other processors. Workers must
+                // not interrupt the graph first, or a secondary abort can win finished_error.
                 if let Err(cause) = try_result.flatten() {
                     span.with_property(|| ("error", "true")).add_properties(|| {
                         [
@@ -477,7 +493,6 @@ impl QueryPipelineExecutor {
                                             executed_pid,
                                             NodeErrorType::ScheduleEventError(cause.clone()),
                                         );
-                                        graph.should_finish(Err(cause.clone()))?;
                                         return Err(cause);
                                     }
                                 }
@@ -487,7 +502,6 @@ impl QueryPipelineExecutor {
                             let cause = error_type.get_error_code();
                             if let Some((graph, node_index)) = task_info {
                                 graph.record_node_error(node_index, *error_type);
-                                graph.should_finish(Err(cause.clone()))?;
                             }
                             return Err(cause);
                         }
@@ -541,3 +555,162 @@ impl Drop for QueryPipelineExecutor {
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use std::any::Any;
+    use std::sync::Arc;
+    use std::time::Duration;
+    use std::time::Instant;
+
+    use databend_common_base::runtime::Thread;
+    use databend_common_base::runtime::ThreadTracker;
+    use databend_common_exception::ErrorCode;
+    use databend_common_exception::Result;
+    use databend_common_pipeline::core::Event;
+    use databend_common_pipeline::core::Pipe;
+    use databend_common_pipeline::core::PipeItem;
+    use databend_common_pipeline::core::Pipeline;
+    use databend_common_pipeline::core::Processor;
+    use databend_common_pipeline::core::ProcessorPtr;
+    use databend_common_pipeline::core::check_interrupt;
+    use petgraph::graph::NodeIndex;
+
+    use super::QueryPipelineExecutor;
+    use crate::pipelines::executor::ExecutorSettings;
+    use crate::servers::flight::v1::exchange::DataExchangeManager;
+    use crate::test_kits::TestFixture;
+
+    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+    async fn test_worker_error_precedes_interrupt() -> anyhow::Result<()> {
+        let _fixture = TestFixture::setup().await?;
+
+        // Exercise errors from both process() and the sub
```

**File**: `src/query/service/src/servers/flight/v1/exchange/exchange_manager.rs` (modified, +6/-0)
```diff
@@ -257,6 +257,12 @@ impl DataExchangeManager {
             .collect()
     }
 
+    /// Holds the coordinator lock like `shutdown_query` does, for lock-order tests.
+    #[cfg(test)]
+    pub(crate) fn lock_queries_coordinator_for_test(&self) -> impl Sized + '_ {
+        self.queries_coordinator.lock()
+    }
+
     pub fn get_query_ctx(&self, query_id: &str) -> Result<Arc<QueryContext>> {
         let queries_coordinator_guard = self.queries_coordinator.lock();
         let queries_coordinator = unsafe { &mut *queries_coordinator_guard.deref().get() };
```

---

### Incident Patch 2: `d3880a7f` (2026-10-20)
**Commit Message**: chore(build): cut clean debug build time by ~20% (#20745)

* chore(deps): drop async-compression and orc-rust forks

- Replace the datafuse-extras async-compression fork with the upstream
  compression-codecs crate, which now exposes the raw codec API we need.
  Pin it to 0.4.39 so it stays on zstd 0.13 with arrow/parquet.
- Move orc-rust from the datafuse-extras fork (0.6) to crates.io 0.8,
  which already supports Arrow 58. COPY ORC now measures scan bytes from
  the chunk reader since StreamMap is no longer public.
- Bump apache-avro 0.17 -> 0.21 to share the version used by
  iceberg/paimon.
- Bump zip 3 -> 4.6 (default features off, same codec set) so it shares
  bzip2/liblzma with the rest of the graph.

Removes 7 packages and 8 duplicated crate versions from Cargo.lock.

* chore(deps): drop OpenSSL and aws-lc from the build graph

The vendored OpenSSL build (~73s) and aws-lc-sys (~71s) were the first
~75s of the clean-build critical path: reqwest waits for them, and
opendal / databend-common-exception / everything downstream waits for
reqwest. Removing either alone does not help, the other takes its place.

- reqwest: native-tls-vendored -> rustls-tls-native-roots (ring).
- 

**File**: `.github/actions/check/action.yml` (modified, +4/-0)
```diff
@@ -40,6 +40,10 @@ runs:
         taplo check --config .config/taplo.toml
         taplo fmt --config .config/taplo.toml --check
 
+    - name: Check TLS backend
+      shell: bash
+      run: ./scripts/ci/ci-check-tls-backend.sh
+
     - name: Clippy
       shell: bash
       run: cargo clippy --workspace --all-targets --all-features -- -D warnings
```

**File**: `.github/actions/test_unit/action.yml` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ runs:
       env:
         RUST_LOG: ERROR
         RUST_MIN_STACK: 33554432
+        # CI always compiles from scratch, where incremental tracking only adds overhead.
+        CARGO_INCREMENTAL: 0
         # RUST_BACKTRACE: 1
 
     - name: Test vacuum2 streaming GC against AWS S3
```

**File**: `Cargo.toml` (modified, +71/-34)
```diff
@@ -171,10 +171,10 @@ structkey = "0.1.1"
 
 # Crates.io dependencies
 ahash = { version = "0.8", features = ["no-rng"] }
-aho-corasick = { version = "1.0.1" } #
+aho-corasick = { version = "1.0.1" }
 anyerror = { version = "=0.1.13" }
 anyhow = { version = "1.0.65" }
-apache-avro = { version = "0.17.0", features = ["snappy", "zstandard", "xz", "bzip"] }
+apache-avro = { version = "0.21.0", features = ["snappy", "zstandard", "xz", "bzip"] }
 approx = "0.5.1"
 arrow = { version = "58.4.0" }
 arrow-array = { version = "58.4.0" }
@@ -187,14 +187,14 @@ arrow-json = { version = "58.4.0" }
 arrow-ord = { version = "58.4.0" }
 arrow-schema = { version = "58.4.0", features = ["serde"] }
 arrow-select = { version = "58.4.0" }
-arrow-udf-runtime = { version = "0.8.0", default-features = false, features = ["javascript", "wasm"] }
+# `javascript-runtime` rather than `javascript`: the latter also pulls in `javascript-fetch`,
+# which requires reqwest (with native-tls by default) for a `fetch()` API we never enable —
+# `Runtime::enable_fetch()` is not called anywhere.
+arrow-udf-runtime = { version = "0.8.0", default-features = false, features = ["javascript-runtime", "wasm"] }
 async-backtrace = "0.2"
 async-channel = "2.3.1"
 async-compat = { version = "0.2" }
-async-compression = { git = "https://github.com/datafuse-extras/async-compression", rev = "dc81082", features = [
-    "futures-io",
-    "all-algorithms",
-] }
+async-compression = { version = "0.4.39", features = ["futures-io", "gzip", "zlib"] }
 async-recursion = "1.1.1"
 async-stream = "0.3.3"
 async-trait = { version = "0.1.89" }
@@ -212,7 +212,6 @@ bitvec = "1.0.1"
 blake3 = "1.3.1"
 bollard = { version = "0.17" }
 borsh = { version = "1.2.1", features = ["derive"] }
-brotli = { version = "3.3", features = ["std"] }
 bstr = "1"
 buf-list = "1.0.3"
 bumpalo = "3.12.0"
@@ -228,6 +227,17 @@ cidr = { version = "0.3.1" }
 clap = { version = "4.4.2", features = ["derive"] }
 codeq = { version = "0.5.2" }
 comfy-table = "7"
+# Pinned: 0.4.40+ moves to zstd 0.14, while arrow/parquet still use zstd 0.13.
+compression-codecs = { version = "=0.4.39", features = [
+    "brotli",
+    "bzip2",
+    "deflate",
+    "gzip",
+    "lzma",
+    "xz",
+    "zlib",
+    "zstd",
+] }
 concurrent-queue = "2.5.0"
 convert_case = "0.6.0"
 cookie = "0.18.1"
@@ -275,7 +285,7 @@ globiter = "0.1"
 goldenfile = "1.4"
 h3o = "0.9.4"
 hashbrown = { version = "0.15.2", default-features = false }
-hashlink = "0.8"
+hashlink = "0.10"
 headers = "0.4.0"
 hex = "0.4.3"
 hickory-resolver = "0.25"
@@ -290,15 +300,15 @@ proc-macro2 = "1.0"
 quote = "1.0"
 
 ## Arrow 58 compatible variant metadata support.
-iceberg = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012", features = [
+iceberg = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", branch = "dev", features = [
     "storage-all",
     # Not in iceberg-rust's `storage-all`: without it every abfs[s]:// table fails to load.
     "storage-azdls",
 ] }
-iceberg-catalog-glue = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
-iceberg-catalog-hms = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
-iceberg-catalog-rest = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
-iceberg-catalog-s3tables = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
+iceberg-catalog-glue = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", branch = "dev" }
+iceberg-catalog-hms = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", branch = "dev" }
+iceberg-catalog-rest = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", branch = "dev" }
+iceberg-catalog-s3tables = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", branch = "dev" }
 paimon = { version = "=0.2.0", default-features = false, features = ["storage-fs", "storage-s3", "storage-oss"] }
 
 indexmap = "2.0.0"
@@ -319,7 +329,7 @@ limits-rs = "0.2.0"
 lindera = { version = "5.0.1", features = ["embed-ipadic"] }
 lindera-analysis = "5.0.1"
 lindera-tantivy = { version = "5.0.1", features = ["embed-ipadic"] }
-logforth = { git = "https://github.com/datafuse-extras/logforth", branch = "main", features = [
+logforth = { git = "https://github.com/datafuse-extras/logforth", branch = "dev", features = [
     'json',
     'rolling-file',
     'opentelemetry',
@@ -332,7 +342,12 @@ memchr = { version = "2", default-features = false }
 micromarshal = "0.7.0"
 mlua = { version = "0.11", features = ["lua54", "vendored", "async", "serialize"] }
 mockall = "0.11.2"
-mysql_async = { version = "0.34", default-features = false, features 
```

**File**: `Makefile` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ lint:
 	typos --config .config/typos.toml
 	# Cargo.toml file formatter(make setup to install)
 	taplo fmt --config .config/taplo.toml
+	# Keep OpenSSL / aws-lc out of the dependency graph
+	./scripts/ci/ci-check-tls-backend.sh
 	# Python file formatter(make setup to install)
 	# ruff format tests/
 	# Bash file formatter(make setup to install)
```

**File**: `scripts/ci/ci-check-tls-backend.sh` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+#!/bin/bash
+# Copyright 2020-2025 The Databend Authors.
+# SPDX-License-Identifier: Apache-2.0.
+
+# Fails if OpenSSL or aws-lc sneaks back into the dependency graph.
+#
+# Both are C builds that sit at the very start of the clean-build critical path: everything
+# that needs `reqwest` (opendal, databend-common-exception, ...) waits for them, which costs
+# ~75s of build time. Cargo features are additive, so one dependency that asks for reqwest's
+# default TLS backend (`native-tls`) or for the `aws-lc` rustls provider brings them back for
+# the whole graph. See https://github.com/databendlabs/databend/pull/20745 for the details.
+
+set -e
+
+cd "$(dirname "$0")/../.." || exit
+
+banned=(openssl openssl-sys native-tls native-tls-crate hyper-tls aws-lc-sys aws-lc-rs)
+
+found=()
+for crate in "${banned[@]}"; do
+	if grep -qx "name = \"$crate\"" Cargo.lock; then
+		found+=("$crate")
+	fi
+done
+
+if [[ ${#found[@]} -ne 0 ]]; then
+	echo "Found banned crates in Cargo.lock: ${found[*]}" >&2
+	echo >&2
+	echo "These pull in a C build of OpenSSL or aws-lc, on the critical path of every build." >&2
+	echo "To find the dependent crate:" >&2
+	echo "  cargo tree --workspace --target x86_64-unknown-linux-gnu -e normal,build,features -i openssl-sys" >&2
+	echo >&2
+	echo "Fix it by asking the dependency for a rustls backend instead, e.g." >&2
+	echo '  reqwest = { version = "0.12", default-features = false, features = ["rustls-tls-native-roots"] }' >&2
+	echo "and, if it is a third-party crate that does not allow this, send it upstream or patch it." >&2
+	exit 1
+fi
+
+echo "No OpenSSL or aws-lc in Cargo.lock"
```

**File**: `src/common/base/src/http_client.rs` (modified, +4/-4)
```diff
@@ -80,8 +80,8 @@ pub fn get_global_http_client(
         // Disable http2 for better performance.
         builder = builder.http1_only();
 
-        // Enforce to use native tls backend.
-        builder = builder.use_native_tls();
+        // Enforce to use rustls (ring) backend.
+        builder = builder.use_rustls_tls();
 
         // Set dns resolver.
         builder = builder.dns_resolver(GLOBAL_HICKORY_RESOLVER.clone());
@@ -139,8 +139,8 @@ impl HttpClient {
         // Disable http2 for better performance.
         builder = builder.http1_only();
 
-        // Enforce to use native tls backend.
-        builder = builder.use_native_tls();
+        // Enforce to use rustls (ring) backend.
+        builder = builder.use_rustls_tls();
 
         // Set dns resolver.
         builder = builder.dns_resolver(GLOBAL_HICKORY_RESOLVER.clone());
```

**File**: `src/common/building/Cargo.toml` (modified, +1/-2)
```diff
@@ -10,9 +10,8 @@ edition = { workspace = true }
 anyhow = { workspace = true }
 base64 = { workspace = true }
 cargo_metadata = { workspace = true }
-gix = { workspace = true }
 log = { workspace = true }
-vergen-gix = { workspace = true }
+vergen-gitcl = { workspace = true }
 
 [lints]
 workspace = true
```

**File**: `src/common/building/src/git.rs` (modified, +69/-46)
```diff
@@ -12,65 +12,88 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+//! Git metadata for build scripts, read through the `git` CLI.
+//!
+//! We used to link `gix` into the build scripts, which costs ~85 CPU-seconds (125 crates) at the
+//! start of every clean build. Shelling out to `git` is what `vergen-gitcl` does as well.
+
 use std::collections::BTreeMap;
+use std::path::Path;
+use std::process::Command;
 
 use anyhow::Context;
 use anyhow::Result;
-use gix::Repository;
-use gix::commit::describe::SelectRef;
+use anyhow::bail;
 
-// Get the latest tag:
-// git describe --tags --abbrev=0
-// v0.6.99-nightly
-pub fn get_latest_tag(repo: &Repository) -> Result<String> {
-    let hc = repo.head_commit()?;
+/// Run `git <args>` in `dir` and return its trimmed stdout.
+fn git(dir: &Path, args: &[&str]) -> Result<String> {
+    let output = Command::new("git")
+        .current_dir(dir)
+        .args(args)
+        .output()
+        .with_context(|| format!("failed to run `git {}`", args.join(" ")))?;
+    if !output.status.success() {
+        bail!(
+            "`git {}` failed: {}",
+            args.join(" "),
+            String::from_utf8_lossy(&output.stderr).trim()
+        );
+    }
+    Ok(String::from_utf8(output.stdout)?.trim().to_string())
+}
+
+/// Top-level directory of the git work tree containing `dir`.
+pub fn discover(dir: &Path) -> Result<std::path::PathBuf> {
+    Ok(git(dir, &["rev-parse", "--show-toplevel"])?.into())
+}
 
-    let desc = hc
-        .describe()
-        .names(SelectRef::AllTags)
-        .try_resolve()?
-        .with_context(|| {
-            format!(
-                "Did not find a single candidate ref for naming id '{}'",
-                hc.id
-            )
-        })?;
-    let tag = desc
-        .format()?
-        .name
-        .with_context(|| format!("Did not find a valid tag for '{}'", hc.id))?;
-    Ok(tag.to_string())
+/// Name of the nearest tag (annotated or lightweight) reachable from HEAD.
+pub fn get_latest_tag(repo: &Path) -> Result<String> {
+    git(repo, &["describe", "--tags", "--abbrev=0", "HEAD"])
+        .context("Did not find a valid tag for HEAD")
 }
 
-// Get commit author list
-// git shortlog HEAD -sne | awk '{$1=""; sub(" ", "    \""); print }' | awk -F'<' '!x[$1]++' | awk -F'<' '!x[$2]++' | awk -F'<' '{gsub(/ +$/, "\",", $1); print $1}' | sort | xargs
-// use email to uniq authors
-pub fn get_commit_authors(repo: &Repository) -> Result<String> {
-    let mut authors: BTreeMap<String, String> = BTreeMap::new();
+/// Comma separated, sorted, de-duplicated author names of all commits reachable from HEAD.
+/// Authors are keyed by email; the name of the most recent commit for an email wins.
+pub fn get_commit_authors(repo: &Path) -> Result<String> {
+    let log = git(repo, &["log", "--format=%ae%x00%an", "HEAD"])?;
 
-    let revwalk = repo
-        .rev_walk(Some(repo.head_id()?.detach()))
-        .all()?
-        .filter_map(Result::ok);
-    for oid in revwalk {
-        let cm = oid.object()?;
-        let author = cm.author()?;
-        let email = author.email.to_string();
-        if authors.contains_key(&email) {
-            continue;
+    let mut authors: BTreeMap<&str, &str> = BTreeMap::new();
+    for line in log.lines() {
+        if let Some((email, name)) = line.split_once('\0') {
+            authors.entry(email).or_insert(name);
         }
-        let name = author.name.to_string();
-        authors.insert(email, name);
     }
 
-    let result = authors
-        .values()
-        .map(|name| (name, 1))
-        .collect::<BTreeMap<&String, u8>>()
-        .keys()
-        .map(|name| name.as_str())
+    let names = authors
+        .into_values()
+        .collect::<std::collections::BTreeSet<&str>>()
+        .into_iter()
         .collect::<Vec<&str>>()
         .join(", ");
+    Ok(names)
+}
+
+#[cfg(test)]
+mod tests {
+    use std::path::Path;
+
+    use super::*;
 
-    Ok(result)
+    #[test]
+    fn test_git_metadata() -> Result<()> {
+        let repo = discover(Path::new(env!("CARGO_MANIFEST_DIR")))?;
+        // A shallow clone may have no tag; only check that the command works when one exists.
+        if let Ok(tag) = get_latest_tag(&repo) {
+            assert!(!tag.is_empty());
+        }
+        let authors = get_commit_authors(&repo)?;
+        assert!(!authors.is_empty());
+        let names: Vec<&str> = authors.split(", ").collect();
+        let mut sorted = names.clone();
+        sorted.sort();
+        sorted.dedup();
+        assert_eq!(names, sorted);
+        Ok(())
+    }
 }
```

---

### Incident Patch 3: `90d7dd75` (2026-10-20)
**Commit Message**: fix(version): remove nightly suffix from binary versions (#20792)

**File**: `src/common/building/src/lib.rs` (modified, +28/-1)
```diff
@@ -86,7 +86,10 @@ pub fn set_env_config() -> Result<()> {
 pub fn add_env_version() {
     println!("cargo:rerun-if-env-changed=DATABEND_RELEASE_VERSION");
     let version = discover_version().expect(VERSION_ERROR_MESSAGE);
-    println!("cargo:rustc-env=DATABEND_GIT_SEMVER={}", version);
+    println!(
+        "cargo:rustc-env=DATABEND_GIT_SEMVER={}",
+        normalize_version(&version)
+    );
 }
 
 fn discover_version() -> Result<String> {
@@ -101,6 +104,11 @@ fn discover_version() -> Result<String> {
     }
 }
 
+// Keep the release tag unchanged, but omit its nightly suffix from binary versions.
+fn normalize_version(version: &str) -> &str {
+    version.strip_suffix("-nightly").unwrap_or(version)
+}
+
 pub fn add_env_license() {
     println!("cargo:rerun-if-env-changed=DATABEND_ENTERPRISE_LICENSE_EMBEDDED");
     let v = env::var("DATABEND_ENTERPRISE_LICENSE_EMBEDDED").unwrap_or_default();
@@ -218,3 +226,22 @@ pub fn add_opt_level() {
         }
     };
 }
+
+#[cfg(test)]
+mod tests {
+    use super::normalize_version;
+
+    #[test]
+    fn test_normalize_version() {
+        for (version, expected) in [
+            ("v1.2.952-nightly", "v1.2.952"),
+            ("1.2.952-nightly", "1.2.952"),
+            ("v1.2.952", "v1.2.952"),
+            ("1.2.952", "1.2.952"),
+            ("v1.2.952-p2", "v1.2.952-p2"),
+            ("v1.2.952-rc.1", "v1.2.952-rc.1"),
+        ] {
+            assert_eq!(normalize_version(version), expected);
+        }
+    }
+}
```

**File**: `src/common/version/src/lib.rs` (modified, +10/-0)
```diff
@@ -100,6 +100,16 @@ mod tests {
 
     use super::*;
 
+    #[test]
+    fn test_version_without_nightly() {
+        assert!(!DATABEND_GIT_SEMVER.ends_with("-nightly"));
+        assert_ne!(DATABEND_SEMVER.pre.as_str(), "nightly");
+
+        let prefix = format!("{DATABEND_GIT_SEMVER}-{VERGEN_GIT_SHA}");
+        assert!(DATABEND_COMMIT_VERSION.starts_with(&prefix));
+        assert!(METASRV_COMMIT_VERSION.starts_with(&prefix));
+    }
+
     #[test]
     fn test_basic_version() -> Result<(), regex::Error> {
         assert_eq!(VERGEN_GIT_SHA.len(), 10);
```

#### Recent Merged Pull Requests:
- **PR #20797** (2026-10-20): fix(query): reclaim metadata of dropped tables with retired engines (@SkyFan2002)
- **PR #20792** (2026-10-20): fix(version): remove nightly suffix from binary versions (@sundy-li)
- **PR #20771** (2026-10-19): ci: fix metachaos FUSE disconnects on statx (@bohutang)
- **PR #20750** (2026-10-20): fix(query): preserve original pipeline errors before interruption (@SkyFan2002)
- **PR #20745** (2026-10-20): chore(build): cut clean debug build time by ~20% (@sundy-li)
- **PR #20744** (2026-10-19): fix(storage): cache decoded vector indexes (@bohutang)

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

## X. query): preserve original pipeline errors before interruption (#20750)

**RULE**:
When implementing operations in `src/query/service/src/pipelines/executor/query_pipeline_executor.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5c09ab04`: query): preserve original pipeline errors before interruption (#20750). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/service/src/pipelines/executor/query_pipeline_executor.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let mut diagnose_cause = None;
        {
            let mut finished_error = self.finished_error.lock();
            if let Some(cause) = cause {
                // We only save the cause of the first error. It must be saved before
                // interrupting the graph, otherwise a sibling worker may observe the
                // interruption and save ABORTED_QUERY first.
                if finished_error.is_none() {
                    if !self.graph.is_should_finish()
                        && cause.code() == ErrorCode::MEMORY_EXCEEDS_LIMIT
                    {
                        diagnose_cause = Some(cause.clone());
                    }
                    *finished_error = Some(cause);

        // Collect diagnostics after releasing `finished_error` and interrupting the graph.
        // The diagnostics lock DataExchangeManager, while DataExchangeManager::shutdown_query
        // calls finish() with that lock held, so holding `finished_error` here can deadlock.
        // The diagnostics may run on a thread that has already exceeded its memory limit.
        if let Some(cause) = diagnose_cause {
            let _guard = LimitMemGuard::enter_unlimited();
 
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        let mut finished_error = self.finished_error.lock();
        if let Some(cause) = cause {
            // We only save the cause of the first error.
            if finished_error.is_none() {
                if !self.graph.is_should_finish() {
                    log_memory_limit_diagnostics(&cause, "memory limit exceeded");
                *finished_error = Some(cause);
        drop(finished_error);
                // finish the pipeline executor when has error or panic
                                        graph.should_finish(Err(cause.clone()))?;
                                graph.should_finish(Err(cause.clone()))?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5c09ab04` are properly handled with clean fallback behavior.
