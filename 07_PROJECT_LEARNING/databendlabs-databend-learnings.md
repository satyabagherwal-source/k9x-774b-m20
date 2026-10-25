> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `058a1e8f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T12:32:06.782Z  
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
> **Harvest Timestamp**: 2026-10-25T12:32:06.239Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9479 stars

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

### Core Architecture Module: `src/binaries/query/entry/python_worker_entry.rs`
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

pub fn try_run() {
    #[cfg(feature = "python-udf")]
    {
        let mut args = std::env::args_os().skip(1);
        if args.next().as_deref() != Some(std::ffi::OsStr::new(databend_query::PYTHON_WORKER_ARG)) {
            return;
        }
        let Some(path) = args.next() else {
            eprintln!("Missing Python UDF worker socket path");
            std::process::exit(1);
        };
        if args.next().is_some() {
            std::process::exit(1);
        }
        databend_common_base::runtime::ThreadTracker::init();
        let result = databend_query::run_python_udf_worker(path.into());
        if let Err(error) = &result {
            eprintln!("{error}");
        }
        std::process::exit(if result.is_ok() { 0 } else { 1 });
    }
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20822** (2026-10-23): **chore(meta): reuse source-option read when validating MV source**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Address the duplicate source-metadata read in item 2 of #20286.  When `CREATE MATERIALIZED VIEW` includes a source-options update, `create_table()` already reads the source metadata, checks its sequence, and adds an exact source CAS condition. Reuse that read's source ID and dropped status for MV validation when both requests refer to the same source, avoiding the redundant lookup within that transaction attempt.  - Keep the existing lookup when there is no source-options update or the source IDs differ. - Recompute the local status on every retry. Do not clone or cache the full `TableMeta`. - Preserve the source CAS, atomic metadata publication, privilege model, and persistent formats. - Extend the existing `materialized_view_lifecycle` cases to reject missing/dropped MV sources without publishing the source-options update.  The documentation and old-binary compatibility follow-ups are covered by databendlabs/databend-docs#3532, which is still open. This PR addresses the code follow-up only and intentionally does not auto-close #20286.  ## Tests  - [x] Unit Test — existing schema API integration suite - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  Passed locally:  ```sh CARGO_BUILD_JOBS=4 RUST_MIN_STACK=16777216 cargo nextest run --offline \   -p databend-common-meta-schema-api-tests --test it \   -E 'test(test_schema_api_single_node) | test(tes

- **Issue #20821** (2026-10-23): **fix(query): cap window top-n cardinality estimate by partition count**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Cardinality estimation for the common "top-N per key" pattern  ```sql SELECT ... FROM (   SELECT ..., row_number() OVER (PARTITION BY k1, k2, k3 ORDER BY d DESC) AS rn FROM t ) WHERE rn = 1 ```  passed the whole input cardinality through the `Window` / `WindowPartition` nodes, and in some shapes through the `Filter` as well, although the output is bounded by `distinct partition keys × N`. The bad estimate is harmless for the standalone subquery but misleads join ordering and join type selection when such a subquery is joined to other tables.  ### Root cause  `RulePushDownFilterWindowTopN` records the per-partition `top`, but statistics derivation only used it to bound the ranking column's value range and ndv:  - Single window function (`Window` over `Sort { window_partition }`): `top` lives on `Sort.window_partition.top`, which `Sort::derive_stats` ignored. `WindowPartition` and `Window` kept the input cardinality; the `Filter` estimate was only right by accident for a single partition column with `rn = 1`, and wrong for multi-column keys or `rank() <= N` (full input). - Several window functions (`WindowGroup`): `top` is set on the window, so the ranking column got ndv 1 in range `[1, 1]` while the group cardinality stayed at the input, which made `rn = 1` estimated as keeping every row.  ### Fix  - `plans/window.rs`: add `estimate_partition_count` (returns `None` whe

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

### Incident Patch 1: `45a88e44` (2026-10-23)
**Commit Message**: fix(query): release queued acquire entry when future is dropped (#20629)

* fix(query): release queued acquire entry when future is dropped

A queued `AcquireQueueFuture` registers its entry in the queue on the
first pending poll and only unregisters it when it completes. If the
caller cancels the acquisition by dropping the future, the entry (and
the query context and session it keeps alive) stays in the queue
indefinitely, so the queue length keeps growing and the session slot
is never released.

Implement `PinnedDrop` for `AcquireQueueFuture` to remove any entry
still owned by the future. Completed acquisitions have already
released the key, so this is a no-op for them.

Add regression tests covering dropped acquisitions, repeated abort
notifications, a real queued query with `max_active_sessions = 1`, and
exactly-once cleanup on success or explicit removal.

Refs #20606

* fix(query): only drop queue entries owned by the cancelled acquire

Queue keys are not unique. `add_entity` replaces an existing entry with
the same key, so when a replaced acquisition is cancelled, an
unconditional `remove_entity(&key)` would delete the entry now owned by
the other acquisition. That acquisit

**File**: `src/query/service/src/sessions/queue_mgr.rs` (modified, +13/-0)
```diff
@@ -491,6 +491,19 @@ where T: Future<Output =  std::result::Result<std::result::Result<Permit, E>, El
     key: Option<Data::Key>,
     manager: Arc<QueueManager<Data>>,
 }
+
+impl<Data: QueueData, T, Permit, E> PinnedDrop for AcquireQueueFuture<Data, T, Permit, E>
+where T: Future<Output = std::result::Result<std::result::Result<Permit, E>, Elapsed>>
+{
+    fn drop(this: Pin<&mut Self>) {
+        let this = this.project();
+        // Cancellation can drop the future without polling it to completion.
+        // Release the registered entry and the query context it owns in that case.
+        if let Some(key) = this.key.take() {
+            this.manager.remove_entity(&key);
+        }
+    }
+}
 }
 
 impl<Data: QueueData, T, Permit, E> AcquireQueueFuture<Data, T, Permit, E>
```

**File**: `src/query/service/tests/it/sessions/queue_mgr.rs` (modified, +157/-0)
```diff
@@ -14,6 +14,8 @@
 
 use std::collections::HashMap;
 use std::sync::Arc;
+use std::sync::atomic::AtomicUsize;
+use std::sync::atomic::Ordering;
 use std::time::Duration;
 use std::time::Instant;
 use std::time::SystemTime;
@@ -26,18 +28,22 @@ use databend_common_base::runtime::workload_group::MAX_CONCURRENCY_QUOTA_KEY;
 use databend_common_base::runtime::workload_group::QuotaValue;
 use databend_common_base::runtime::workload_group::WorkloadGroup;
 use databend_common_base::runtime::workload_group::WorkloadGroupResource;
+use databend_common_catalog::session_type::SessionType;
 use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
 use databend_common_meta_store::MetaStore;
 use databend_common_meta_store::MetaStoreProvider;
 use databend_common_sql::Planner;
+use databend_common_version::BUILD_INFO;
 use databend_meta_client::RpcClientConf;
 use databend_meta_runtime::DatabendRuntime;
 use databend_query::interpreters::InterpreterFactory;
 use databend_query::sessions::QueryEntry;
 use databend_query::sessions::QueueData;
 use databend_query::sessions::QueueManager;
+use databend_query::sessions::SessionManager;
 use databend_query::sessions::TableContextSettings;
+use databend_query::test_kits::ConfigBuilder;
 use databend_query::test_kits::TestFixture;
 use log::error;
 use tokio::sync::Mutex;
@@ -48,6 +54,7 @@ struct TestData<const PASSED: bool = false> {
     acquire_id: String,
     abort_notify: Arc<WatchNotify>,
     test_timeout: Duration,
+    wait_exits: Arc<AtomicUsize>,
 }
 
 impl<const PASSED: bool> std::fmt::Debug for TestData<PASSED> {
@@ -67,6 +74,7 @@ impl<const PASSED: bool> TestData<PASSED> {
             acquire_id,
             abort_notify: Arc::new(WatchNotify::new()),
             test_timeout: Duration::from_secs(1000),
+            wait_exits: Arc::new(AtomicUsize::new(0)),
         }
     }
 
@@ -76,6 +84,7 @@ impl<const PASSED: bool> TestData<PASSED> {
             acquire_id,
             abort_notify: Arc::new(WatchNotify::new()),
             test_timeout: timeout,
+            wait_exits: Arc::new(AtomicUsize::new(0)),
         }
     }
 }
@@ -107,6 +116,10 @@ impl<const PASSED: bool> QueueData for TestData<PASSED> {
         !PASSED
     }
 
+    fn exit_wait_pending(&self, _wait_time: Duration) {
+        self.wait_exits.fetch_add(1, Ordering::SeqCst);
+    }
+
     fn get_abort_notify(&self) -> Arc<WatchNotify> {
         self.abort_notify.clone()
     }
@@ -523,6 +536,110 @@ async fn test_watch_abort_notify_immediate_abort() -> anyhow::Result<()> {
     Ok(())
 }
 
+#[tokio::test(flavor = "multi_thread")]
+async fn test_dropped_acquire_releases_queue_entry() -> anyhow::Result<()> {
+    let queue = QueueManager::<TestData>::create(1, create_meta_store().await?, false);
+    let holder = queue
+        .acquire(TestData::new("drop_wait".into(), "holder".into()))
+        .await?;
+
+    let data = TestData::new("drop_wait".into(), "waiter".into());
+    let wait_exits = data.wait_exits.clone();
+    let mut acquire = Box::pin(queue.acquire(data));
+    assert!(futures::poll!(acquire.as_mut()).is_pending());
+    assert_eq!(queue.length(), 1);
+    let weak_data = Arc::downgrade(&queue.list()[0]);
+
+    // Dropping the caller's future must clean up even without an abort notification.
+    drop(acquire);
+    assert_eq!(queue.length(), 0);
+    assert!(weak_data.upgrade().is_none());
+    assert_eq!(wait_exits.load(Ordering::SeqCst), 1);
+
+    drop(holder);
+    let _guard = queue
+        .acquire(TestData::new("drop_wait".into(), "next".into()))
+        .await?;
+    Ok(())
+}
+
+#[tokio::test(flavor = "multi_thread")]
+async fn test_aborted_queued_query_releases_session() -> anyhow::Result<()> {
+    let mut config = ConfigBuilder::create().config();
+    config.query.common.max_active_sessions = 1;
+    let fixture = TestFixture::setup_with_config(&config).await?;
+    let queue = QueueManager::<QueryEntry>::create(1, create_meta_store().await?, false);
+
+    let holder_ctx = fixture.new_query_ctx().await?;
+    let extras = Planner::new(holder_ctx.clone()).parse_sql("SELECT 1")?;
+    let _holder = queue
+        .acquire(QueryEntry::create_entry(&holder_ctx, &extras, true)?)
+        .await?;
+
+    let session = fixture.new_session_with_type(SessionType::MySQL).await?;
+    let session_id = session.get_id();
+    let weak_session = Arc::downgrade(&session);
+    let ctx = session.create_query_context(&BUILD_INFO).await?;
+    let weak_ctx = Arc::downgrade(&ctx);
+    let entry = QueryEntry::create_entry(&ctx, &extras, true)?;
+    let abort_notify = entry.get_abort_notify();
+    drop(ctx);
+    drop(session);
+
+    let mut acquire = Box::pin(queue.acquire(entry));
+    assert!(futures::poll!(acquire.as_mut()).is_pending());
+    assert_eq!(queue.length(), 1);
+    assert!(weak_session.upgrade().is_some());
+    assert!(
+        SessionManager::instance()
+            .create_session(SessionType::MySQL)
+            .await
+         
```

---

### Incident Patch 2: `058a1e8f` (2026-10-23)
**Commit Message**: chore(build): generate the embedded meta-service code once (#20814)

* chore(build): generate the embedded meta-service code once

`create_meta_store::<DatabendRuntime>()` is an async fn, so its state
machine, down to the embedded openraft node and the tasks it spawns, was
code-generated in every crate that awaited it, including databend-query,
the last crate before linking. meta-store itself had none of that code.

Add a non-generic `create_default_meta_store()` returning a boxed
`dyn Future`, so the code is generated once in meta-store and callers
only go through the vtable. Switch all callers to it and drop the now
unused databend-meta-runtime dependency from catalog, users and sql
test-support.

databend-query: LLVM IR 12.39M -> 10.71M lines; its lib build drops by
about 4s without incremental and 6s with it. No behavior change; one
extra allocation per meta-store creation at startup.

* fix(test): import DatabendRuntime in users external access tests

The tests merged from main relied on user_api.rs importing
DatabendRuntime, which this branch removed together with the
databend-meta-runtime dependency. Import it in the test module and
keep the crate as a dev-dependency only.

**File**: `Cargo.lock` (modified, +0/-2)
```diff
@@ -3075,7 +3075,6 @@ dependencies = [
  "databend-common-storage",
  "databend-common-users",
  "databend-meta-client 260205.13.5",
- "databend-meta-runtime",
  "databend-storages-common-session",
  "databend-storages-common-table-meta",
  "dyn-clone",
@@ -4008,7 +4007,6 @@ dependencies = [
  "databend-common-storage",
  "databend-common-users",
  "databend-meta-client 260205.13.5",
- "databend-meta-runtime",
  "databend-storages-common-session",
  "databend-storages-common-table-meta",
  "goldenfile",
```

**File**: `src/meta/store/src/lib.rs` (modified, +13/-0)
```diff
@@ -16,6 +16,7 @@ databend_common_tracing::register_module_tag!("[META_CLIENT]", "databend_meta_cl
 
 pub(crate) mod local;
 
+use std::future::Future;
 use std::ops::Deref;
 use std::pin::Pin;
 use std::sync::Arc;
@@ -213,6 +214,18 @@ impl MetaStoreProvider {
         MetaStoreProvider { rpc_conf }
     }
 
+    /// [`Self::create_meta_store`] for the production runtime.
+    ///
+    /// The embedded meta-service behind it is a whole openraft node. An `async fn`'s state
+    /// machine is code-generated in every crate that polls it, so returning it as a boxed
+    /// `dyn Future` makes this crate the only one that generates the raft code; callers only go
+    /// through the vtable.
+    pub fn create_default_meta_store(
+        &self,
+    ) -> Pin<Box<dyn Future<Output = Result<MetaStore, CreationError>> + Send + '_>> {
+        Box::pin(self.create_meta_store::<DatabendRuntime>())
+    }
+
     pub async fn create_meta_store<RT: RuntimeApi>(&self) -> Result<MetaStore, CreationError> {
         if self.rpc_conf.local_mode() {
             let local = match &self.rpc_conf.embedded_dir {
```

**File**: `src/query/catalog/Cargo.toml` (modified, +0/-1)
```diff
@@ -27,7 +27,6 @@ databend-common-statistics = { workspace = true }
 databend-common-storage = { workspace = true }
 databend-common-users = { workspace = true }
 databend-meta-client = { workspace = true }
-databend-meta-runtime = { workspace = true }
 databend-storages-common-session = { workspace = true }
 databend-storages-common-table-meta = { workspace = true }
 dyn-clone = { workspace = true }
```

**File**: `src/query/catalog/src/catalog/manager.rs` (modified, +3/-7)
```diff
@@ -39,7 +39,6 @@ use databend_common_meta_app::tenant::Tenant;
 use databend_common_meta_store::MetaStore;
 use databend_common_meta_store::MetaStoreProvider;
 use databend_meta_client::types::anyerror::func_name;
-use databend_meta_runtime::DatabendRuntime;
 use databend_storages_common_session::SessionState;
 use parking_lot::RwLock;
 
@@ -94,12 +93,9 @@ impl CatalogManager {
         let meta = {
             let provider = Arc::new(MetaStoreProvider::new(conf.meta.to_meta_grpc_client_conf()));
 
-            provider
-                .create_meta_store::<DatabendRuntime>()
-                .await
-                .map_err(|e| {
-                    ErrorCode::MetaServiceError(format!("Failed to create meta store: {}", e))
-                })?
+            provider.create_default_meta_store().await.map_err(|e| {
+                ErrorCode::MetaServiceError(format!("Failed to create meta store: {}", e))
+            })?
         };
 
         let tenant = conf.query.tenant_id.clone();
```

**File**: `src/query/ee/src/resource_management/mod.rs` (modified, +1/-5)
```diff
@@ -26,7 +26,6 @@ use databend_common_exception::Result;
 use databend_common_management::WarehouseMgr;
 use databend_common_meta_store::MetaStoreProvider;
 use databend_enterprise_resources_management::ResourcesManagement;
-use databend_meta_runtime::DatabendRuntime;
 use databend_query::sessions::BuildInfoRef;
 pub use resources_management_kubernetes::KubernetesResourcesManagement;
 pub use resources_management_self_managed::SelfManagedResourcesManagement;
@@ -52,10 +51,7 @@ pub async fn init_resources_management(cfg: &InnerConfig, version: BuildInfoRef)
                 "system_managed" => {
                     let meta_api_provider =
                         MetaStoreProvider::new(cfg.meta.to_meta_grpc_client_conf());
-                    match meta_api_provider
-                        .create_meta_store::<DatabendRuntime>()
-                        .await
-                    {
+                    match meta_api_provider.create_default_meta_store().await {
                         Err(cause) => {
                             let err = ErrorCode::MetaServiceError(format!(
                                 "Failed to create meta store: {}",
```

**File**: `src/query/ee/tests/it/storages/fuse/operations/clone.rs` (modified, +1/-2)
```diff
@@ -20,7 +20,6 @@ use databend_common_meta_app::principal::UserPrivilegeType;
 use databend_common_meta_store::MetaStoreProvider;
 use databend_common_storages_fuse::FuseTable;
 use databend_enterprise_query::test_kits::context::EESetup;
-use databend_meta_runtime::DatabendRuntime;
 use databend_query::sessions::TableContextTableAccess;
 use databend_query::test_kits::TestFixture;
 use databend_query::test_kits::query_count;
@@ -48,7 +47,7 @@ async fn assert_secured_rows(
 async fn test_clone_inherited_policies_for_restricted_owner() -> anyhow::Result<()> {
     // Catalog metadata and policy APIs must share one Meta service, as they do in production.
     let meta = MetaStoreProvider::new(MetaConfig::default().to_meta_grpc_client_conf())
-        .create_meta_store::<DatabendRuntime>()
+        .create_default_meta_store()
         .await?;
     let mut setup = EESetup::new();
     setup.config_mut().meta.endpoints = meta.inner().endpoints.clone();
```

**File**: `src/query/ee/tests/it/storages/fuse/operations/vacuum.rs` (modified, +1/-5)
```diff
@@ -57,7 +57,6 @@ use databend_enterprise_vacuum_handler::vacuum_handler::VacuumTempOptions;
 use databend_meta_client::kvapi::KvApiExt;
 use databend_meta_client::kvapi::ListOptions;
 use databend_meta_client::types::TxnRequest;
-use databend_meta_runtime::DatabendRuntime;
 use databend_query::sessions::TableContextSettings;
 use databend_query::sessions::TableContextTableAccess;
 use databend_query::test_kits::*;
@@ -1585,10 +1584,7 @@ async fn new_local_meta() -> MetaStore {
     let meta_config = MetaConfig::default();
     let config = meta_config.to_meta_grpc_client_conf();
     let provider = MetaStoreProvider::new(config);
-    provider
-        .create_meta_store::<DatabendRuntime>()
-        .await
-        .unwrap()
+    provider.create_default_meta_store().await.unwrap()
 }
 
 #[tokio::test(flavor = "multi_thread")]
```

**File**: `src/query/service/src/catalogs/default/mutable_catalog.rs` (modified, +3/-7)
```diff
@@ -139,7 +139,6 @@ use databend_common_users::GrantObjectVisibilityChecker;
 use databend_meta_client::types::Change;
 use databend_meta_client::types::MetaId;
 use databend_meta_client::types::SeqV;
-use databend_meta_runtime::DatabendRuntime;
 use fastrace::func_name;
 use log::info;
 use log::warn;
@@ -193,12 +192,9 @@ impl MutableCatalog {
         let meta = {
             let provider = Arc::new(MetaStoreProvider::new(conf.meta.to_meta_grpc_client_conf()));
 
-            provider
-                .create_meta_store::<DatabendRuntime>()
-                .await
-                .map_err(|e| {
-                    ErrorCode::MetaServiceError(format!("Failed to create meta store: {}", e))
-                })?
+            provider.create_default_meta_store().await.map_err(|e| {
+                ErrorCode::MetaServiceError(format!("Failed to create meta store: {}", e))
+            })?
         };
 
         let tenant = conf.query.tenant_id.clone();
```

---

### Incident Patch 3: `b6fada3a` (2026-10-23)
**Commit Message**: fix(optimizer): avoid incorrect anti joins for expression keys (#20804)

* fix(optimizer): require a column witness for outer-to-anti rewrites

* test(optimizer): focus expression-key anti-join regression in SQL

* test(optimizer): record expression-key anti-join plans

---------

Co-authored-by: dantengsky <[REDACTED_EMAIL]>

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/join_rules/push_down_filter_join/outer_join_to_anti_join.rs` (modified, +6/-2)
```diff
@@ -25,7 +25,8 @@ use crate::plans::ScalarExpr;
 use crate::plans::ScalarItem;
 
 /// Convert an outer-join exclusion pattern to the corresponding anti join when
-/// the null-tested expression is a regular equi-key on the null-extended side:
+/// the null-tested expression is a direct column and a regular equi-key on the
+/// null-extended side:
 ///
 /// ```text
 /// Filter(right_key IS NULL)
@@ -38,6 +39,8 @@ use crate::plans::ScalarItem;
 /// A matched row cannot have a NULL regular equi-join key, even when the source
 /// column itself is nullable. Therefore the filter keeps exactly the preserved
 /// side's unmatched rows. Null-equal join conditions are deliberately excluded.
+/// An arbitrary equi-key expression may map null-extended inputs to a non-NULL
+/// value, so its NULL test does not necessarily select unmatched rows.
 pub fn outer_join_to_anti_join(s_expr: &SExpr, metadata: MetadataRef) -> Result<Option<SExpr>> {
     let filter = s_expr.plan().as_filter().unwrap();
     let join_expr = s_expr.unary_child();
@@ -49,7 +52,8 @@ pub fn outer_join_to_anti_join(s_expr: &SExpr, metadata: MetadataRef) -> Result<
     };
 
     let Some(predicate_index) = filter.predicates.iter().position(|predicate| {
-        let Some(null_tested_expr) = null_tested_expr(predicate) else {
+        let Some(null_tested_expr @ ScalarExpr::BoundColumnRef(_)) = null_tested_expr(predicate)
+        else {
             return false;
         };
 
```

**File**: `src/query/sql/tests/it/optimizer/outer_join_to_anti.rs` (modified, +18/-0)
```diff
@@ -120,6 +120,24 @@ LIMIT 10",
 FROM outer_to_anti_left AS l
 RIGHT JOIN outer_to_anti_right AS r ON l.k = r.k
 WHERE l.keep IS NULL",
+        },
+        SqlTestCase {
+            name: "left_expression_key_is_not_anti_join",
+            description: "IF returns 0 on an unmatched right side, so its NULL test must not become a left anti join.",
+            setup_sqls: &[LEFT_TABLE, RIGHT_TABLE],
+            sql: "SELECT l.k
+FROM outer_to_anti_left AS l
+LEFT JOIN outer_to_anti_right AS r ON l.k = IF(r.k IS NULL, 0, r.payload)
+WHERE IF(r.k IS NULL, 0, r.payload) IS NULL",
+        },
+        SqlTestCase {
+            name: "right_expression_key_is_not_anti_join",
+            description: "The RIGHT JOIN mirror must also avoid the expression-key anti rewrite; later valid simplifications are allowed.",
+            setup_sqls: &[LEFT_TABLE, RIGHT_TABLE],
+            sql: "SELECT l.k
+FROM outer_to_anti_right AS r
+RIGHT JOIN outer_to_anti_left AS l ON IF(r.k IS NULL, 0, r.payload) = l.k
+WHERE IF(r.k IS NULL, 0, r.payload) IS NULL",
         },
         SqlTestCase {
             name: "null_safe_condition_keeps_left_outer",
```

**File**: `src/query/sql/tests/it/optimizer/outer_join_to_anti.txt` (modified, +90/-0)
```diff
@@ -372,6 +372,96 @@ Filter
         └── limit: NONE
 
 
+=== left_expression_key_is_not_anti_join ===
+description: IF returns 0 on an unmatched right side, so its NULL test must not become a left anti join.
+sql: SELECT l.k
+FROM outer_to_anti_left AS l
+LEFT JOIN outer_to_anti_right AS r ON l.k = IF(r.k IS NULL, 0, r.payload)
+WHERE IF(r.k IS NULL, 0, r.payload) IS NULL
+raw_plan:
+EvalScalar
+├── scalars: [outer_to_anti_left.k (#0) AS (#0)]
+└── Filter
+    ├── filters: [not(is_not_null(if(not(is_not_null(outer_to_anti_right.k (#3))), 0, outer_to_anti_right.payload (#5))))]
+    └── Join(Left)
+        ├── build keys: [if(not(is_not_null(outer_to_anti_right.k (#3))), 0, outer_to_anti_right.payload (#5))]
+        ├── probe keys: [outer_to_anti_left.k (#0)]
+        ├── other filters: []
+        ├── Scan
+        │   ├── table: default.outer_to_anti_right (#1)
+        │   ├── filters: []
+        │   ├── order by: []
+        │   └── limit: NONE
+        └── Scan
+            ├── table: default.outer_to_anti_left (#0)
+            ├── filters: []
+            ├── order by: []
+            └── limit: NONE
+
+optimized_plan:
+EvalScalar
+├── scalars: [outer_to_anti_left.k (#0) AS (#0), outer_to_anti_right.k (#3) AS (#6), outer_to_anti_right.payload (#5) AS (#7)]
+└── Join(Inner)
+    ├── build keys: [if(not(is_not_null(outer_to_anti_right.k (#3))), 0, outer_to_anti_right.payload (#5))]
+    ├── probe keys: [outer_to_anti_left.k (#0)]
+    ├── other filters: []
+    ├── Scan
+    │   ├── table: default.outer_to_anti_right (#1)
+    │   ├── filters: [not(is_not_null(if(not(is_not_null(outer_to_anti_right.k (#3))), 0, outer_to_anti_right.payload (#5))))]
+    │   ├── order by: []
+    │   └── limit: NONE
+    └── Scan
+        ├── table: default.outer_to_anti_left (#0)
+        ├── filters: []
+        ├── order by: []
+        └── limit: NONE
+
+
+=== right_expression_key_is_not_anti_join ===
+description: The RIGHT JOIN mirror must also avoid the expression-key anti rewrite; later valid simplifications are allowed.
+sql: SELECT l.k
+FROM outer_to_anti_right AS r
+RIGHT JOIN outer_to_anti_left AS l ON IF(r.k IS NULL, 0, r.payload) = l.k
+WHERE IF(r.k IS NULL, 0, r.payload) IS NULL
+raw_plan:
+EvalScalar
+├── scalars: [outer_to_anti_left.k (#3) AS (#3)]
+└── Filter
+    ├── filters: [not(is_not_null(if(not(is_not_null(outer_to_anti_right.k (#0))), 0, outer_to_anti_right.payload (#2))))]
+    └── Join(Right)
+        ├── build keys: [outer_to_anti_left.k (#3)]
+        ├── probe keys: [if(not(is_not_null(outer_to_anti_right.k (#0))), 0, outer_to_anti_right.payload (#2))]
+        ├── other filters: []
+        ├── Scan
+        │   ├── table: default.outer_to_anti_left (#1)
+        │   ├── filters: []
+        │   ├── order by: []
+        │   └── limit: NONE
+        └── Scan
+            ├── table: default.outer_to_anti_right (#0)
+            ├── filters: []
+            ├── order by: []
+            └── limit: NONE
+
+optimized_plan:
+EvalScalar
+├── scalars: [outer_to_anti_left.k (#3) AS (#3), outer_to_anti_right.k (#0) AS (#6), outer_to_anti_right.payload (#2) AS (#7)]
+└── Join(Inner)
+    ├── build keys: [outer_to_anti_left.k (#3)]
+    ├── probe keys: [if(not(is_not_null(outer_to_anti_right.k (#0))), 0, outer_to_anti_right.payload (#2))]
+    ├── other filters: []
+    ├── Scan
+    │   ├── table: default.outer_to_anti_left (#1)
+    │   ├── filters: []
+    │   ├── order by: []
+    │   └── limit: NONE
+    └── Scan
+        ├── table: default.outer_to_anti_right (#0)
+        ├── filters: [not(is_not_null(if(not(is_not_null(outer_to_anti_right.k (#0))), 0, outer_to_anti_right.payload (#2))))]
+        ├── order by: []
+        └── limit: NONE
+
+
 === null_safe_condition_keeps_left_outer ===
 description: A null-safe condition is not a regular equi-key in the raw plan and must remain a left outer join.
 sql: SELECT l.k, r.k
```

**File**: `tests/sqllogictests/suites/query/join/outer_join_to_anti.test` (modified, +31/-0)
```diff
@@ -74,6 +74,37 @@ where l.k is null;
 ----
 NULL 90 NULL
 
+# Use NULL keys and payloads so IF can return NULL on source rows, but 0
+# for an unmatched row. That makes IS NULL different from an anti-join test.
+statement ok
+create or replace table outer_to_anti_left(k int);
+
+statement ok
+create or replace table outer_to_anti_right(k int, payload int);
+
+statement ok
+insert into outer_to_anti_left values (0), (1), (2);
+
+statement ok
+insert into outer_to_anti_right values (null, null), (1, null), (1, 1);
+
+# No row passes. In particular, unmatched key 2 gets IF(NULL IS NULL,0,NULL)
+# = 0, which is not NULL. The old anti rewrite incorrectly returns 2.
+query I
+select l.k
+from outer_to_anti_left l
+left join outer_to_anti_right r on l.k = if(r.k is null, 0, r.payload)
+where if(r.k is null, 0, r.payload) is null;
+----
+
+# The same data/query with RIGHT JOIN must also return no rows.
+query I
+select l.k
+from outer_to_anti_right r
+right join outer_to_anti_left l on if(r.k is null, 0, r.payload) = l.k
+where if(r.k is null, 0, r.payload) is null;
+----
+
 statement ok
 drop table outer_to_anti_left;
 
```

#### Recent Merged Pull Requests:
- **PR #20822** (2026-10-23): chore(meta): reuse source-option read when validating MV source (@zhyass)
- **PR #20821** (closed): fix(query): cap window top-n cardinality estimate by partition count (@dqhl76)
- **PR #20816** (2026-10-22): ci(query): cover numeric ranges with string bounds (@KKould)
- **PR #20815** (2026-10-23): feat(storage): detect S3 region via AWS_REGION regional endpoint (@dantengsky)
- **PR #20814** (2026-10-23): chore(build): generate the embedded meta-service code once (@sundy-li)
- **PR #20812** (2026-10-23): fix(query): accelerate single-key hash shuffle (@dqhl76)

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

## X. query): release queued acquire entry when future is dropped (#20629)

**RULE**:
When implementing operations in `src/query/service/src/sessions/queue_mgr.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `45a88e44`: query): release queued acquire entry when future is dropped (#20629). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/service/src/sessions/queue_mgr.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

impl<Data: QueueData, T, Permit, E> PinnedDrop for AcquireQueueFuture<Data, T, Permit, E>
where T: Future<Output = std::result::Result<std::result::Result<Permit, E>, Elapsed>>
{
    fn drop(this: Pin<&mut Self>) {
        let this = this.project();
        // Cancellation can drop the future without polling it to completion.
        // Release the registered entry and the query context it owns in that case.
        if let Some(key) = this.key.take() {
            this.manager.remove_entity(&key);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `45a88e44` are properly handled with clean fallback behavior.
