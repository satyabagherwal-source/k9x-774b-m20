> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `17bcab80`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T03:47:03.012Z  
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
> **Harvest Timestamp**: 2026-11-23T03:47:03.005Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9504 stars

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
- **Issue #21162** (2026-11-22): **fix: planner: keep cached distributed and local plans apart**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  A follow-up of #21158, whose first CI run failed `test_private_tasks` on this bug: https://github.com/databendlabs/databend/pull/21158#issuecomment-7067658905  The plan cache gave a SELECT the cached plan of the same statement without checking whether that plan was made for a cluster or for a single node. A distributed plan fails with `UnknownFragmentExchange` in a context that plans locally, such as the one the task service plans its own queries in, and a local plan runs on one node of a cluster. The cache now keeps the distributed and the local plan of a statement apart.  Tests: `test_planner_cache_keeps_distributed_and_local_plans_apart`, in `src/query/service/tests/it/sql/planner/planner_cache.rs`, plans the same SELECT on a two-node cluster and on a single node, in both orders, and checks that the cluster gets a distributed plan and the single node a local one. No logic test covers it: in SQL, a statement is planned locally on a cluster through the `enforce_local` setting, and the cache already tells apart plans made under different settings.  ##### fix: planner: keep cached distributed and local plans apart # Summary  The plan cache keys a plan also on whether its statement is optimized for distributed execution, so a query gets only a plan made for where it runs: on a cluster, or on a single node.  # Details  `Planner::plan_stmt_with_materialized_view_rewrite` 

- **Issue #21160** (2026-11-22): **feat(cache): size the disk cache from its disk when max_bytes is unset**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Leaving `max_bytes` unset now sizes the disk cache from the disk it lives on, instead of using a fixed 20 GiB. By default the cache may use up to 85% of that disk: 5 points below `cache.disk.watermark_ratio` (default 90), minus what other files already use.  ```toml [cache] data_cache_storage = "disk"  [cache.disk] path = "/var/lib/databend/cache" # max_bytes unset: at startup, up to 85% of the file system under `path`/<tenant>, minus other files # watermark_ratio = 90  # default; the cache is sized 5 points below it ```  How it is sized, per query node at startup:  ``` max_bytes = Avail + cache files - Size × (105 - watermark_ratio)%    (capped at 1 TiB) ```  - `Size` / `Avail`: total and available bytes of the file system under `<path>/<tenant>`, as `df /var/lib/databend/cache/<tenant>` shows: the one the cache writes to, also when the tenant directory is a mount point. - `cache files`: the space taken by the files under `<path>/<tenant>` from the previous run (their blocks, not their lengths). They count as room, so restarts do not shrink the cache. - The 5-point headroom keeps a full cache off the watermark line, so other files growing a little do not turn every write into a disk-pressure eviction, and `watermark_ratio` is held to 95 in this mode: the pools count entries by length while the disk fills by blocks, so only the watermark keeps sub-block entries from f

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

### Incident Patch 1: `c8df80e8` (2026-11-22)
**Commit Message**: fix(query): bind grouped SELECTs after their keys are known (#20780)

* fix(query): keep outer types when decorrelation reuses inner columns

Decorrelation replaces an outer column with the inner column of an
`inner = outer` predicate. When the outer column is nullable and the inner
one is not, the enclosing expressions keep their nullable types and fail
the type check, e.g. a correlated equality over a nullable outer column.

Reuse the inner column only if it differs from the outer one at most in
nullability or converts to it losslessly, and cast it to the outer type
where it is substituted. Otherwise fall back to joining the outer plan.

* fix(query): keep histograms through casts that only add nullability

A cast that only changes nullability keeps the non-NULL values and their
representation, so the input histogram still describes the output.

* fix(query): number lambda parameters past every query symbol

A lambda body is compiled against a schema keyed by symbol, shared by
its parameters and the columns it captures. Parameters were numbered
after the columns of the current context only, so they could collide
with other symbols in the body, e.g. an outer column referenced from

**File**: `src/query/expression/src/stat_evaluator.rs` (modified, +64/-6)
```diff
@@ -106,10 +106,10 @@ impl<'a> StatEvaluator<'a> {
             return Ok(None);
         }
 
-        let Some(input) = self.eval(&cast.expr, input_stats)? else {
+        let Some(input_stat) = self.eval(&cast.expr, input_stats)? else {
             return Ok(None);
         };
-        let input = input.as_ref();
+        let input = input_stat.as_ref();
 
         // Reuse the cast domain implementation without making statistics
         // evaluation depend on the physical value evaluator. The synthetic
@@ -135,13 +135,22 @@ impl<'a> StatEvaluator<'a> {
             return Ok(None);
         };
 
+        let (ndv, null_count) = (input.ndv, input.null_count);
+        // Histograms are typed, so their boundaries cannot be reused across a
+        // value conversion. Changing only nullability keeps the non-NULL
+        // values and their representation, so the distribution still holds.
+        let distribution = if src_type.remove_nullable_ref() == cast.dest_type.remove_nullable_ref()
+        {
+            input_stat.into_owned().distribution
+        } else {
+            OwnedDistribution::Unknown
+        };
         let stat = ReturnStat {
             domain,
             // A lossless injective cast preserves distinct values and NULLs.
-            // Histograms are typed, so their boundaries cannot be reused.
-            ndv: input.ndv,
-            null_count: input.null_count,
-            distribution: OwnedDistribution::Unknown,
+            ndv,
+            null_count,
+            distribution,
         };
         if let Err(msg) = stat.check_consistency_with_type(Some(&cast.dest_type)) {
             if cfg!(debug_assertions) {
@@ -343,6 +352,55 @@ mod tests {
         assert!(matches!(stat.distribution, OwnedDistribution::Unknown));
     }
 
+    #[test]
+    fn test_nullable_cast_preserves_histogram() {
+        use databend_common_statistics::BorrowedHistogram;
+        use databend_common_statistics::Histogram;
+        use databend_common_statistics::TypedHistogram;
+        use databend_common_statistics::TypedHistogramBucket;
+
+        let histogram = TypedHistogram::new(vec![TypedHistogramBucket::new(1u64, 3, 3.0, 3.0)]);
+        let src_type = DataType::Number(NumberDataType::UInt8);
+        let expr = Expr::Cast(Cast {
+            span: None,
+            is_try: false,
+            expr: Box::new(Expr::ColumnRef(ColumnRef {
+                span: None,
+                id: 0,
+                data_type: src_type.clone(),
+                display_name: "c0".to_string(),
+            })),
+            dest_type: src_type.wrap_nullable(),
+        });
+        let domain = crate::Domain::from_min_max(
+            Scalar::Number(NumberScalar::UInt8(1)),
+            Scalar::Number(NumberScalar::UInt8(3)),
+            &src_type,
+        );
+        let input_stats = HashMap::from([(0, ArgStat {
+            domain,
+            ndv: NdvEstimate::exact(3.0),
+            null_count: StatCount::exact(0),
+            distribution: BorrowedDistribution::Histogram(BorrowedHistogram::UInt(&histogram)),
+        })]);
+
+        let stat = StatEvaluator::run(
+            &expr,
+            &FunctionContext::default(),
+            &FunctionRegistry::empty(),
+            StatCardinality::exact(3),
+            &input_stats,
+        )
+        .unwrap()
+        .unwrap()
+        .into_owned();
+
+        assert!(matches!(
+            stat.distribution,
+            OwnedDistribution::Histogram(Histogram::UInt(ref h)) if *h == histogram
+        ));
+    }
+
     #[test]
     fn test_lossy_cast_is_not_derived() {
         let expr = Expr::Cast(Cast {
```

**File**: `src/query/expression/src/symbol.rs` (modified, +4/-0)
```diff
@@ -39,6 +39,10 @@ impl Symbol {
 
     pub const DUMMY_COLUMN: Self = Self::new_dummy_column(DummyColumnType::Default);
 
+    /// The first symbol of lambda parameters, far past the symbols of a query,
+    /// which metadata allocates from zero, and below the dummy columns.
+    pub const MIN_LAMBDA_PARAMETER: Self = Self(usize::MAX / 2);
+
     pub const fn new(index: usize) -> Self {
         Self(index)
     }
```

**File**: `src/query/service/src/physical_plans/physical_aggregate_expand.rs` (modified, +24/-43)
```diff
@@ -62,21 +62,18 @@ impl IPhysicalPlan for AggregateExpand {
     fn output_schema(&self) -> Result<DataSchemaRef> {
         let input_schema = self.input.output_schema()?;
         let mut output_fields = input_schema.fields().clone();
-        // Add virtual columns to group by.
-        output_fields.reserve(self.group_bys.len() + 1);
-
-        for (group_by, (actual, ty)) in self
-            .group_bys
-            .iter()
-            .zip(self.grouping_sets.dup_group_items.iter())
-        {
-            // All group by columns will wrap nullable.
+        output_fields.reserve(1);
+
+        // Rolled-up keys receive injected NULLs. The binder gives them nullable
+        // symbols already; wrapping keeps the schema valid for any key that is
+        // not nullable yet. Keys present in every set keep their type.
+        for group_by in self.group_bys() {
+            if !self.grouping_sets.is_rolled_up(*group_by) {
+                continue;
+            }
             let i = input_schema.index_of(&group_by.to_string())?;
             let f = &mut output_fields[i];
-            debug_assert!(f.data_type() == ty || f.data_type().wrap_nullable() == *ty);
             *f = DataField::new(f.name(), f.data_type().wrap_nullable());
-            let new_field = DataField::new(&actual.to_string(), ty.clone());
-            output_fields.push(new_field);
         }
 
         output_fields.push(DataField::new(
@@ -131,44 +128,28 @@ impl IPhysicalPlan for AggregateExpand {
 
         let input_schema = self.input.output_schema()?;
         let group_bys = self
-            .group_bys
-            .iter()
-            .take(self.group_bys.len() - 1) // The last group-by will be virtual column `_grouping_id`
+            .group_bys()
             .map(|i| input_schema.index_of(&i.to_string()))
             .collect::<Result<Vec<_>>>()?;
-        let grouping_sets = self
+        let grouping_ids = self
             .grouping_sets
-            .sets
-            .iter()
-            .map(|sets| {
-                sets.iter()
-                    .map(|i| {
-                        let i = input_schema.index_of(&i.to_string())?;
-                        let offset = group_bys.iter().position(|j| *j == i).unwrap();
-                        Ok(offset)
-                    })
-                    .collect::<Result<Vec<_>>>()
-            })
-            .collect::<Result<Vec<_>>>()?;
-        let mut grouping_ids = Vec::with_capacity(grouping_sets.len());
-        let mask = (1 << group_bys.len()) - 1;
-        for set in grouping_sets {
-            let mut id = 0;
-            for i in set {
-                id |= 1 << i;
-            }
-            // For element in `group_bys`,
-            // if it is in current grouping set: set 0, else: set 1. (1 represents it will be NULL in grouping)
-            // Example: GROUP BY GROUPING SETS ((a, b), (a), (b), ())
-            // group_bys: [a, b]
-            // grouping_sets: [[0, 1], [0], [1], []]
-            // grouping_ids: 00, 01, 10, 11
-            grouping_ids.push(!id & mask);
-        }
+            .grouping_ids(self.group_bys().copied())
+            .into_iter()
+            .map(|id| id as usize)
+            .collect::<Vec<_>>();
 
         builder.main_pipeline.add_accumulating_transformer(|| {
             TransformExpandGroupingSets::new(group_bys.clone(), grouping_ids.clone())
         });
         Ok(())
     }
 }
+
+impl AggregateExpand {
+    /// Grouping keys, without the virtual `_grouping_id` column.
+    fn group_bys(&self) -> impl Iterator<Item = &Symbol> {
+        self.group_bys
+            .iter()
+            .filter(|index| **index != self.grouping_sets.grouping_id_index)
+    }
+}
```

**File**: `src/query/service/src/physical_plans/physical_aggregate_final.rs` (modified, +27/-41)
```diff
@@ -322,28 +322,14 @@ impl PhysicalPlanBuilder {
                     .map(|item| Ok(item.scalar.as_expr()?.sql_display()))
                     .collect::<Result<Vec<_>>>()?;
 
-                let mut agg_funcs =
+                let agg_funcs =
                     build_aggregate_function(&agg.aggregate_functions, &input.output_schema()?)?;
 
                 let settings = self.ctx.get_settings();
                 let mut group_by_shuffle_mode = settings.get_group_by_shuffle_mode()?;
-                if agg.grouping_sets.is_some() {
+                if let Some(grouping_sets) = &agg.grouping_sets {
                     group_by_shuffle_mode = "before_merge".to_string();
-                }
-
-                if let Some(grouping_sets) = agg.grouping_sets.as_ref() {
-                    // AggregateExpand makes grouping columns nullable and fills in dummy
-                    // NULLs for rolled-up sets. Aggregate arguments and ORDER BY keys must
-                    // use its preserved copies instead, or aggregation can panic or sort
-                    // by the dummy NULLs rather than the original values.
-                    for func in agg_funcs.iter_mut() {
-                        for arg in func.arg_indices.iter_mut() {
-                            if let Some(pos) = group_items.iter().position(|g| g == arg) {
-                                *arg = grouping_sets.dup_group_items[pos].0;
-                            }
-                        }
-                        remap_grouping_set_order_by(&mut func.sig, &group_items, grouping_sets);
-                    }
+                    check_grouping_sets_inputs(&agg_funcs, &group_items, grouping_sets)?;
                 }
 
                 // Ranking the input rows needs the order to be by group keys only.
@@ -437,23 +423,9 @@ impl PhysicalPlanBuilder {
                 let group_by_display = partial.group_by_display.clone();
                 let before_group_by_schema = partial.input.output_schema()?;
 
-                let mut agg_funcs =
+                let agg_funcs =
                     build_aggregate_function(&agg.aggregate_functions, &before_group_by_schema)?;
 
-                if let Some(grouping_sets) = agg.grouping_sets.as_ref() {
-                    // Recover aggregate arguments and ORDER BY keys to the original,
-                    // unmasked columns and types from before `AggregateExpand`.
-                    for func in agg_funcs.iter_mut() {
-                        for (arg, ty) in func.arg_indices.iter_mut().zip(func.sig.args.iter_mut()) {
-                            if let Some(pos) = group_items.iter().position(|g| g == arg) {
-                                *arg = grouping_sets.dup_group_items[pos].0;
-                                *ty = grouping_sets.dup_group_items[pos].1.clone();
-                            }
-                        }
-                        remap_grouping_set_order_by(&mut func.sig, &group_items, grouping_sets);
-                    }
-                }
-
                 let top_n = rank_limit.filter(|_| agg.grouping_sets.is_none());
                 PhysicalPlan::new(AggregateFinal {
                     input,
@@ -487,19 +459,33 @@ impl PhysicalPlanBuilder {
     }
 }
 
-// Use the original grouping columns and types, not AggregateExpand's masked keys.
-fn remap_grouping_set_order_by(
-    signature: &mut AggregateFunctionSignature,
+/// `AggregateExpand` injects NULLs into rolled-up grouping keys, so aggregate
+/// arguments and ORDER BY keys must not read them. The binder gives every
+/// grouping-set key its own nullable symbol, separate from the input symbols
+/// that aggregates read; reject any plan that breaks that invariant instead of
+/// aggregating the injected NULLs.
+fn check_grouping_sets_inputs(
+    agg_funcs: &[AggregateFunctionDesc],
     group_items: &[Symbol],
     grouping_sets: &GroupingSets,
-) {
-    for item in &mut signature.order_by {
-        if let Some(pos) = group_items.iter().position(|g| *g == item.index) {
-            let (index, data_type) = &grouping_sets.dup_group_items[pos];
-            item.index = *index;
-            item.data_type = data_type.clone();
+) -> Result<()> {
+    for func in agg_funcs {
+        let inputs = func
+            .arg_indices
+            .iter()
+            .chain(func.sig.order_by.iter().map(|item| &item.index));
+        for index in inputs {
+            let is_injected = *index == grouping_sets.grouping_id_index
+                || (group_items.contains(index) && grouping_sets.is_rolled_up(*index));
+            if is_injected {
+                return Err(ErrorCode::Internal(format!(
+                    "aggregate function {} reads grouping-set key {index}, which contains injected NULLs",
+                    func.display
+                )));
+            }
         }
     }
+    Ok(())
 }
 
 fn build_aggregate_function(
```

**File**: `src/query/service/src/pipelines/processors/transforms/aggregator/transform_aggregate_expand.rs` (modified, +8/-14)
```diff
@@ -41,21 +41,15 @@ impl AccumulatingTransform for TransformExpandGroupingSets {
     fn transform(&mut self, data: DataBlock) -> Result<Vec<DataBlock>> {
         let num_rows = data.num_rows();
         let mut output_blocks = Vec::with_capacity(self.grouping_ids.len());
-        let dup_group_by_cols = self
-            .group_bys
-            .iter()
-            .map(|i| data.get_by_offset(*i).clone())
-            .collect::<Vec<_>>();
+        let mut entries = data.columns().to_vec();
 
-        let mut entries = data
-            .columns()
-            .iter()
-            .cloned()
-            .chain(dup_group_by_cols.clone())
-            .collect::<Vec<_>>();
-
-        // all group columns should be nullable
-        for &offset in &self.group_bys {
+        // Keys that some grouping set nulls out must be nullable. Keys present
+        // in every set, such as correlated columns, keep their input type.
+        let nulled_keys = self.grouping_ids.iter().fold(0, |bits, id| bits | id);
+        for (i, &offset) in self.group_bys.iter().enumerate() {
+            if nulled_keys & (1 << i) == 0 {
+                continue;
+            }
             match &mut entries[offset] {
                 BlockEntry::Const(_, data_type, _) => {
                     *data_type = data_type.wrap_nullable();
```

**File**: `src/query/service/tests/it/sql/exec/grouping_sets.rs` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ use databend_query::physical_plans::PhysicalPlanBuilder;
 use databend_query::sessions::TableContextSettings;
 use databend_query::test_kits::TestFixture;
 
+/// Under every execution strategy, an EvalScalar of a grouping-sets plan
+/// replaces a key symbol instead of projecting it twice, and a CTE consumer
+/// has the schema of its producer. The results of grouping-sets queries are
+/// in the sqllogictests of `query/grouping_sets`.
 #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
 async fn test_grouping_sets_project_redefined_keys_once() -> Result<()> {
     let fixture = TestFixture::setup().await?;
```

**File**: `src/query/sql/src/planner/binder/aggregate.rs` (modified, +547/-346)
```diff
@@ -17,6 +17,7 @@ use std::collections::HashSet;
 use std::collections::hash_map::Entry;
 use std::sync::Arc;
 
+use databend_common_ast::Span;
 use databend_common_ast::ast::Expr;
 use databend_common_ast::ast::GroupBy;
 use databend_common_ast::ast::Literal;
@@ -39,23 +40,35 @@ use super::reject_grouping_functions;
 use crate::BindContext;
 use crate::MetadataRef;
 use crate::Symbol;
+use crate::binder::AliasLookup;
 use crate::binder::Binder;
 use crate::binder::ColumnBinding;
 use crate::binder::ColumnBindingBuilder;
+use crate::binder::GroupingKeyScope;
+use crate::binder::GroupingScopeState;
+use crate::binder::NameResolutionResult;
+use crate::binder::ScalarFoldingPolicy;
+use crate::binder::SelectClauseExprs;
+use crate::binder::SelectItems;
 use crate::binder::Visibility;
 use crate::binder::project_set::SetReturningAnalyzer;
 use crate::binder::scalar::ScalarBinder;
-use crate::binder::select::ClauseAliasBindings;
 use crate::binder::select::SelectList;
 use crate::optimizer::ir::SExpr;
+use crate::planner::semantic::CoreExprArena;
+use crate::planner::semantic::CoreExprId;
+use crate::planner::semantic::FullTypeCheckAdapter;
 use crate::planner::semantic::TypeChecker;
+use crate::planner::semantic::normalize_identifier;
 use crate::plans::Aggregate;
 use crate::plans::AggregateFunction;
 use crate::plans::AggregateFunctionScalarSortDesc;
 use crate::plans::BoundColumnRef;
+use crate::plans::CastExpr;
 use crate::plans::EvalScalar;
 use crate::plans::FunctionCall;
 use crate::plans::GroupingSets;
+use crate::plans::MAX_GROUPING_KEYS;
 use crate::plans::ScalarExpr;
 use crate::plans::ScalarItem;
 use crate::plans::UDAFCall;
@@ -115,46 +128,104 @@ use crate::plans::walk_expr_mut;
 pub struct GroupingSetsInfo {
     /// Index for virtual column `grouping_id`.
     pub grouping_id_column: ColumnBinding,
-    /// Each grouping set is a list of column indices in `group_items`.
-    pub sets: Vec<Vec<Symbol>>,
-    /// The indices generated to identify the duplicate group items in the execution of the `GROUPING SETS` plan (not including `_grouping_id`).
-    ///
-    /// If the aggregation function argument is an item in the grouping set, for example:
+    /// The keys of each grouping set, as the output symbols in `group_items`.
     ///
-    /// ```sql
-    /// SELECT min(a) FROM t GROUP BY GROUPING SETS (a, ...);
-    /// ```
-    ///
-    /// we should use the original column `a` data instead of the column data after filling dummy NULLs.
-    pub dup_group_items: Vec<(Symbol, DataType)>,
+    /// Each key of a grouping-sets aggregate has a dedicated nullable output
+    /// symbol that receives the injected NULLs; its group item keeps the
+    /// pre-aggregate expression. Aggregate arguments and sort keys never read
+    /// the output symbols.
+    pub sets: Vec<Vec<Symbol>>,
 }
 
+/// A GROUP BY item, lowered with the other clauses of its SELECT, see
+/// `select_clauses.rs`.
 #[derive(Clone)]
-struct GroupItem {
-    expr: Expr,
-    disable_select_alias_fallback: bool,
+pub(crate) enum GroupItem {
+    /// The SELECT item at a zero-based position, written as a one-based
+    /// position or standing for one in GROUP BY ALL.
+    Position(usize),
+    Expr {
+        root: CoreExprId,
+        /// The name of the key output: the expression as written.
+        name: String,
+    },
 }
 
 impl GroupItem {
-    fn normal(expr: Expr) -> Self {
-        Self {
-            expr,
-            disable_select_alias_fallback: false,
-        }
+    /// Lower a GROUP BY item of a SELECT with `select_len` items. An integer
+    /// literal is a one-based position in the SELECT list.
+    fn lower<'a>(arena: &mut CoreExprArena<'a>, expr: &'a Expr, select_len: usize) -> Result<Self> {
+        Ok(match expr {
+            Expr::Literal {
+                span,
+                value: Literal::UInt64(position),
+            } => {
+                if *position < 1 {
+                    return Err(ErrorCode::SemanticError(format!(
+                        "GROUP BY position {position} is illegal"
+                    ))
+                    .set_span(*span));
+                }
+                if *position > select_len as u64 {
+                    return Err(ErrorCode::SemanticError(format!(
+                        "GROUP BY position {position} is not in select list"
+                    ))
+                    .set_span(*span));
+                }
+                Self::Position(*position as usize - 1)
+            }
+            expr => Self::Expr {
+                root: arena.lower_ast_expr(expr)?,
+                name: format!("{:#}", expr),
+            },
+        })
     }
+}
 
-    fn grouping_construct(expr: Expr) -> Self {
-        Self {
-            expr,
-            disable_select_alias_fallback: true,
+/// A GROUP BY with ALL replaced by positions, and ROLLUP, CUBE and
+/// combinations of them expanded into grouping sets.
+#[derive(Clone)]
+pub(crate) enum ExpandedGroup {
+    Normal(Vec<
```

**File**: `src/query/sql/src/planner/binder/aggregate_prepass.rs` (removed, +0/-831)
```diff
@@ -1,831 +0,0 @@
-// Copyright 2021 Datafuse Labs
-//
-// Licensed under the Apache License, Version 2.0 (the "License");
-// you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at
-//
-//     http://www.apache.org/licenses/LICENSE-2.0
-//
-// Unless required by applicable law or agreed to in writing, software
-// distributed under the License is distributed on an "AS IS" BASIS,
-// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-// See the License for the specific language governing permissions and
-// limitations under the License.
-
-use std::collections::BTreeSet;
-use std::collections::HashSet;
-
-use databend_common_ast::ast::ColumnID;
-use databend_common_ast::ast::ColumnRef;
-use databend_common_ast::ast::Expr;
-use databend_common_ast::ast::FunctionCall;
-use databend_common_ast::ast::OrderByExpr;
-use databend_common_ast::ast::Query;
-use databend_common_ast::visit::VisitControl;
-use databend_common_ast::visit::VisitResult;
-use databend_common_ast::visit::Visitor;
-use databend_common_ast::visit::Walk;
-use databend_common_base::runtime::block_on;
-use databend_common_exception::Result;
-use databend_common_functions::aggregates::AGGR_REGISTRY;
-use databend_common_functions::is_builtin_function;
-use databend_common_meta_app::principal::UDFDefinition;
-use databend_common_users::UserApiProvider;
-
-use super::ExprContext;
-use crate::BindContext;
-use crate::NameResolutionContext;
-use crate::binder::Binder;
-use crate::binder::select::SelectAliasCatalog;
-use crate::binder::select::SelectList;
-use crate::normalize_identifier;
-use crate::plans::ScalarExpr;
-
-macro_rules! try_ast_walk {
-    ($expr:expr) => {
-        match $expr? {
-            VisitControl::Continue | VisitControl::SkipChildren => {}
-            VisitControl::Break(value) => return Ok(VisitControl::Break(value)),
-        }
-    };
-}
-
-#[derive(Debug, Clone, PartialEq, Eq, enum_as_inner::EnumAsInner)]
-pub(super) enum AggregatePrepassSource {
-    DirectClause,
-    AliasExpansion(String),
-}
-
-fn is_aggregate_target(
-    name_resolution_ctx: &NameResolutionContext,
-    udaf_names: &HashSet<String>,
-    func: &FunctionCall,
-) -> bool {
-    if func.window.is_some() {
-        return false;
-    }
-
-    let func_name = normalize_identifier(&func.name, name_resolution_ctx).name;
-    AGGR_REGISTRY.contains(func_name.as_str())
-        || func_name.eq_ignore_ascii_case("grouping")
-        || udaf_names.contains(func_name.as_str())
-}
-
-#[derive(Debug, Clone, PartialEq)]
-pub(super) struct AggregatePrepassFact {
-    pub expr_context: ExprContext,
-    pub source: AggregatePrepassSource,
-    pub expr: Expr,
-    pub contains_window: bool,
-}
-
-#[derive(Debug, Clone, Copy, Default)]
-struct ExprFlags {
-    contains_aggregate: bool,
-    contains_window: bool,
-    contains_subquery: bool,
-}
-
-trait ExprInspection {
-    fn observe_top_level_expr(&mut self, _expr: &Expr) {}
-
-    fn observe_top_level_column_ref(&mut self, _column: &ColumnRef) {}
-
-    fn mark_contains_subquery(&mut self) {}
-
-    fn walk_expr(&mut self, expr: &Expr)
-    where Self: std::marker::Sized {
-        expr.walk(&mut ExprWalker {
-            inspection: self,
-            in_subquery: false,
-        })
-        .unwrap();
-    }
-}
-
-impl<L: ExprInspection, R: ExprInspection> ExprInspection for (L, R) {
-    fn observe_top_level_expr(&mut self, expr: &Expr) {
-        self.0.observe_top_level_expr(expr);
-        self.1.observe_top_level_expr(expr);
-    }
-
-    fn observe_top_level_column_ref(&mut self, column: &ColumnRef) {
-        self.0.observe_top_level_column_ref(column);
-        self.1.observe_top_level_column_ref(column);
-    }
-
-    fn mark_contains_subquery(&mut self) {
-        self.0.mark_contains_subquery();
-        self.1.mark_contains_subquery();
-    }
-}
-
-struct ExprWalker<'a, T> {
-    inspection: &'a mut T,
-    in_subquery: bool,
-}
-
-impl<T> Visitor for ExprWalker<'_, T>
-where T: ExprInspection
-{
-    fn visit_expr(&mut self, expr: &Expr) -> VisitResult {
-        if !self.in_subquery {
-            self.inspection.observe_top_level_expr(expr);
-            if let Expr::ColumnRef { column, .. } = expr {
-                self.inspection.observe_top_level_column_ref(column);
-            }
-        }
-        Ok(VisitControl::Continue)
-    }
-
-    fn visit_query(&mut self, _query: &Query) -> VisitResult {
-        self.inspection.mark_contains_subquery();
-        if self.in_subquery {
-            return Ok(VisitControl::SkipChildren);
-        }
-        self.in_subquery = true;
-        Ok(VisitControl::Continue)
-    }
-
-    fn leave_query(&mut self, _query: &Query) -> std::result::Result<(), !> {
-        self.in_subquery = false;
-        Ok(())
-    }
-}
-
-struct ExprFlagsProbe<'a> {
-    name_resolution_ctx: &'a NameResolutionContext,
-    udaf_names: &'a HashSet<String>,
-    result: ExprFlags,
-}
-
-impl Expr
```

---

### Incident Patch 2: `8f5f966a` (2026-11-22)
**Commit Message**: fix: task: keep a schedule running when one of its ticks fails (#21158)

# Summary

A schedule of `TaskService` that fails, on an error in one of its
ticks, now starts again after 1 s instead of ending for good. It ends
only when it is cancelled, or when its task was dropped or no longer
matches it.

# Details

Any error in a tick ended the schedule, and a meta-service error while
the meta leader changes, e.g. on the tick lock, was enough. Since #21157
a new watch keeps a schedule that still runs when its `ScheduleTask`
message comes again. A schedule in a tick that was about to fail
counted as running: it was kept, then ended, and the node ran no
schedule for the task until its watch ended again. This race was found
in the review of #21157.

The new `keep_running` runs a failed schedule again after
`SCHEDULE_RESTART_DELAY`, unless it is cancelled meanwhile. An interval
schedule then runs its next tick one interval later, and a cron
schedule at its next time.

`TaskService::update_schedule` stops a schedule whose task was dropped,
which `TaskMgr::update_task` reports as an error, instead of starting it
again and again. A failure to store the next run, before the first
interval tick

**File**: `src/query/service/src/task/service.rs` (modified, +97/-14)
```diff
@@ -40,6 +40,7 @@ use databend_common_config::InnerConfig;
 use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
 use databend_common_expression::DataBlock;
+use databend_common_management::task::TaskError;
 use databend_common_management::task::TaskMgr;
 use databend_common_meta_api::kv_pb_api::decode_seqv;
 use databend_common_meta_app::principal::ScheduleType;
@@ -102,6 +103,9 @@ const WHEN_CONDITION_FALSE: &str = "WHEN_CONDITION_FALSE";
 const WATCH_AGAIN_MIN_DELAY: Duration = Duration::from_secs(1);
 const WATCH_AGAIN_MAX_DELAY: Duration = Duration::from_secs(30);
 
+/// The delay before a schedule that failed starts again.
+const SCHEDULE_RESTART_DELAY: Duration = Duration::from_secs(1);
+
 /// A schedule that this node runs for a task.
 struct ScheduledTask {
     task_id: u64,
@@ -333,14 +337,22 @@ impl TaskService {
                                 duration += Duration::from_millis(*ms);
                             }
 
+                            let name = format!("interval schedule of task {}", task_name);
+                            let cancel = child_token.clone();
                             runtime
                                 .spawn(async move {
-                                    let mut fn_work = async move || {
+                                    let fn_work = async move || {
                                         let committed_at = Utc::now();
                                         task.next_scheduled_at = Some(committed_at + duration);
                                         task.updated_at = committed_at;
-                                        if !task_mgr.update_task(task.clone()).await?? {
-                                            return Ok(());
+                                        match Self::update_schedule(&task_mgr, &task).await {
+                                            Ok(true) => {}
+                                            Ok(false) => return Ok(()),
+                                            // Stored again by the first tick.
+                                            Err(err) => error!(
+                                                "failed to store the next run of task {}: {}",
+                                                task.task_name, err
+                                            ),
                                         }
                                         loop {
                                             tokio::select! {
@@ -351,7 +363,7 @@ impl TaskService {
                                                     let committed_at = Utc::now();
                                                     task.next_scheduled_at = Some(committed_at + duration);
                                                     task.updated_at = committed_at;
-                                                    if !task_mgr.update_task(task.clone()).await?? {
+                                                    if !Self::update_schedule(&task_mgr, &task).await? {
                                                         break;
                                                     }
                                                     if task_service.has_executing_task_run(&task.task_name).await? {
@@ -370,9 +382,8 @@ impl TaskService {
                                         }
                                         Result::Ok(())
                                     };
-                                    if let Err(err) = fn_work().await {
-                                        error!("interval schedule failed due to {}", err);
-                                    }
+                                    keep_running(&name, SCHEDULE_RESTART_DELAY, cancel, fn_work)
+                                        .await;
                                 })
                         }
                         ScheduleType::CronType => {
@@ -393,9 +404,11 @@ impl TaskService {
                                 .unwrap_or(Tz::UCT);
                             let schedule = Schedule::from_str(cron_expr).unwrap();
 
+                            let name = format!("cron schedule of task {}", task_name);
+                            let cancel = child_token.clone();
                             runtime
                                 .spawn(async move {
-                                    let mut fn_work = async move || {
+                                    let fn_work = async move || {
                                         let mut upcoming = schedule.upcoming(tz).peekable();
 
                                         while let Some(next_time) = upcoming.next() {
@@ -406,8 +419,14 @@ impl TaskService {
 
                                             task.next_scheduled_at = Some(next_time.with_timezone(&Utc));
                                             task.updated_at = now;
-                                            if !task_mgr.update_task(task.clone()).await?? {
-                                                break
```

---

### Incident Patch 3: `17bcab80` (2026-11-22)
**Commit Message**: fix: planner: keep cached distributed and local plans apart (#21162)

# Summary

The plan cache keys a plan also on whether its statement is optimized
for distributed execution, so a query gets only a plan made for where
it runs: on a cluster, or on a single node.

# Details

`Planner::plan_stmt_with_materialized_view_rewrite` optimizes a query
for distributed execution when its context has a cluster of more than
one node, and neither the caller nor the `enforce_local` setting keeps
it local. The cache key left that decision out, so while the tables it
reads did not change, the same SELECT got the plan of whichever context
planned it first.

A distributed plan fails with `UnknownFragmentExchange` in a context
that plans locally, and a local plan runs on one node of a cluster.
The task service plans its own queries in a single-node context
(`TaskService::create_context`). After `test_private_tasks` ran the
query of `TaskService::has_executing_task_run` on the cluster, that
check failed on the same node until `system_task.task_run` changed,
and the task did not run: this failed the test in the CI of #21158.

`Planner::enable_distributed_optimization` makes the decision for both
the c

**File**: `src/query/service/tests/it/sql/planner/mod.rs` (modified, +1/-0)
```diff
@@ -14,5 +14,6 @@
 
 mod builders;
 mod optimizer;
+mod planner_cache;
 mod semantic;
 mod view_cte_resolution;
```

**File**: `src/query/service/tests/it/sql/planner/planner_cache.rs` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+// Copyright 2026 Datafuse Labs.
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
+use databend_common_exception::Result;
+use databend_common_sql::Planner;
+use databend_common_sql::plans::Plan;
+use databend_query::test_kits::ClusterDescriptor;
+use databend_query::test_kits::TestFixture;
+
+/// Plans `sql` on a cluster of `nodes`, the first of them local, and tells whether the plan is
+/// distributed.
+async fn plans_distributed(fixture: &TestFixture, nodes: &[&str], sql: &str) -> Result<bool> {
+    let mut cluster = ClusterDescriptor::new();
+    for (i, node) in nodes.iter().enumerate() {
+        cluster = cluster.with_node_info(
+            *node,
+            format!("127.0.0.1:{}", 9090 + i),
+            "cluster",
+            "warehouse",
+        );
+    }
+    let ctx = fixture
+        .new_query_ctx_with_cluster(cluster.with_local_id(nodes[0]))
+        .await?;
+    let (plan, _) = Planner::new(ctx).plan_sql(sql).await?;
+    let Plan::Query { s_expr, .. } = plan else {
+        panic!("expected a query plan for {sql}");
+    };
+    Ok(s_expr.planned()?.expr().has_merge_exchange())
+}
+
+// A plan cached on a cluster is not served to a single node, where it would fail, and a plan
+// cached on a single node is not served to a cluster, which it would leave unused.
+#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+async fn test_planner_cache_keeps_distributed_and_local_plans_apart() -> Result<()> {
+    let fixture = TestFixture::setup().await?;
+    fixture.create_default_database().await?;
+    let db = fixture.default_db_name();
+    fixture
+        .execute_command(&format!("CREATE TABLE {db}.t (n INT)"))
+        .await?;
+    fixture
+        .execute_command(&format!("INSERT INTO {db}.t VALUES (1)"))
+        .await?;
+
+    let cluster = ["node-a", "node-b"];
+    let single_node = ["node-a"];
+
+    let sql = format!("SELECT count(*) FROM {db}.t WHERE n > 0");
+    assert!(plans_distributed(&fixture, &cluster, &sql).await?);
+    assert!(!plans_distributed(&fixture, &single_node, &sql).await?);
+
+    let sql = format!("SELECT count(*) FROM {db}.t WHERE n > 1");
+    assert!(!plans_distributed(&fixture, &single_node, &sql).await?);
+    assert!(plans_distributed(&fixture, &cluster, &sql).await?);
+    Ok(())
+}
```

**File**: `src/query/sql/src/planner/planner.rs` (modified, +15/-4)
```diff
@@ -341,7 +341,9 @@ impl Planner {
         // SQL can bind differently in a stored definition and as an ordinary query.
         let mut plan_cache_context =
             if enable_materialized_view_rewrite && self.definition_scope.is_session() {
-                self.build_plan_cache_context(name_resolution_ctx.clone(), stmt)
+                let distributed =
+                    self.enable_distributed_optimization(force_disable_distributed_optimization)?;
+                self.build_plan_cache_context(name_resolution_ctx.clone(), stmt, distributed)
                     .await?
             } else {
                 None
@@ -402,9 +404,7 @@ impl Planner {
         let opt_ctx = OptimizerContext::new(self.ctx.clone(), metadata.clone(), func_ctx)
             .with_settings(&settings)?
             .set_enable_distributed_optimization(
-                !force_disable_distributed_optimization
-                    && !self.ctx.get_cluster().is_empty()
-                    && !settings.get_enforce_local()?,
+                self.enable_distributed_optimization(force_disable_distributed_optimization)?,
             )
             .set_sample_executor(self.query_executor.clone())
             .clone();
@@ -422,6 +422,17 @@ impl Planner {
         Ok(optimized_plan)
     }
 
+    /// Whether to optimize a statement for distributed execution: it runs on a cluster of more
+    /// than one node, and neither the caller nor `enforce_local` keeps it on this node.
+    fn enable_distributed_optimization(
+        &self,
+        force_disable_distributed_optimization: bool,
+    ) -> Result<bool> {
+        Ok(!force_disable_distributed_optimization
+            && !self.ctx.get_cluster().is_empty()
+            && !self.ctx.get_settings().get_enforce_local()?)
+    }
+
     fn add_max_rows_limit(&self, statement: &mut Statement) {
         let max_rows = self.ctx.get_settings().get_max_result_rows().unwrap();
         if max_rows == 0 {
```

**File**: `src/query/sql/src/planner/planner_cache.rs` (modified, +16/-5)
```diff
@@ -82,6 +82,7 @@ impl Planner {
         &self,
         name_resolution_ctx: NameResolutionContext,
         stmt: &Statement,
+        distributed: bool,
     ) -> Result<Option<PlanCacheContext>> {
         if !matches!(stmt, Statement::Query(_))
             || !self.ctx.get_settings().get_enable_planner_cache()?
@@ -112,8 +113,12 @@ impl Planner {
             .map(|source| mv_fingerprint(source.1, &mv_source_bindings[source]))
             .collect::<Vec<_>>();
 
-        let cache_key =
-            self.planner_cache_key_for_stmt(stmt, visitor.has_security_policy, &mv_fingerprints)?;
+        let cache_key = self.planner_cache_key_for_stmt(
+            stmt,
+            visitor.has_security_policy,
+            &mv_fingerprints,
+            distributed,
+        )?;
         Ok(Some(PlanCacheContext {
             cache_key,
             table_snapshots: visitor.table_snapshots,
@@ -144,25 +149,31 @@ impl Planner {
         Some(bindings)
     }
 
+    /// `distributed` tells whether the statement is optimized for distributed execution. A
+    /// distributed plan fails where the same statement is planned locally, such as in the
+    /// single-node context of the task service, and a local plan leaves a cluster unused.
     fn planner_cache_key_for_stmt(
         &self,
         stmt: &Statement,
         has_security_policy: bool,
         mv_fingerprints: &[String],
+        distributed: bool,
     ) -> Result<String> {
         let mv_fingerprint = mv_fingerprints.join("\0");
+        let distribution = if distributed { "distributed" } else { "local" };
         if has_security_policy {
             return Ok(Self::planner_cache_key(&format!(
-                "{}\0{}\0{}",
+                "{}\0{}\0{}\0{}",
                 self.security_policy_cache_key_prefix()?,
+                distribution,
                 mv_fingerprint,
                 stmt
             )));
         }
 
         Ok(Self::planner_cache_key(&format!(
-            "{}\0{}",
-            mv_fingerprint, stmt
+            "{}\0{}\0{}",
+            distribution, mv_fingerprint, stmt
         )))
     }
 
```

#### Recent Merged Pull Requests:
- **PR #21162** (2026-11-22): fix: planner: keep cached distributed and local plans apart (@drmingdrmer)
- **PR #21160** (2026-11-22): feat(cache): size the disk cache from its disk when max_bytes is unset (@bohutang)
- **PR #21158** (2026-11-22): fix: task: keep a schedule running when one of its ticks fails (@drmingdrmer)
- **PR #21157** (2026-11-21): fix: task: watch the task messages again when the stream ends (@drmingdrmer)
- **PR #21151** (2026-11-22): feat(storage): cache inverted index searcher and term info for FTS (@bohutang)
- **PR #21146** (2026-11-20): chore(meta): use server v260629.11.0 and client v260205.13.7 (@drmingdrmer)

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

## X. query): bind grouped SELECTs after their keys are known

**RULE**:
When implementing operations in `src/query/expression/src/stat_evaluator.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c8df80e8`: query): bind grouped SELECTs after their keys are known. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/expression/src/stat_evaluator.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let Some(input_stat) = self.eval(&cast.expr, input_stats)? else {
        let input = input_stat.as_ref();
        let (ndv, null_count) = (input.ndv, input.null_count);
        // Histograms are typed, so their boundaries cannot be reused across a
        // value conversion. Changing only nullability keeps the non-NULL
        // values and their representation, so the distribution still holds.
        let distribution = if src_type.remove_nullable_ref() == cast.dest_type.remove_nullable_ref()
        {
            input_stat.into_owned().distribution
        } else {
            OwnedDistribution::Unknown
        };
            ndv,
            null_count,
            distribution,
    #[test]
    fn test_nullable_cast_preserves_histogram() {
        use databend_common_statistics::BorrowedHistogram;
        use databend_common_statistics::Histogram;
        use databend_common_statistics::TypedHistogram;
        use databend_common_statistics::TypedHistogramBucket;

        let histogram = TypedHistogram::new(vec![TypedHistogramBucket::new(1u64, 3, 3.0, 3.0)]);
        let src_type = DataType::Number(NumberDataType::UInt8);
        let expr = Expr::Cast(Cast {
         
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let Some(input) = self.eval(&cast.expr, input_stats)? else {
        let input = input.as_ref();
            // Histograms are typed, so their boundaries cannot be reused.
            ndv: input.ndv,
            null_count: input.null_count,
            distribution: OwnedDistribution::Unknown,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c8df80e8` are properly handled with clean fallback behavior.
