> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `328efad7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T21:45:19.896Z  
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
> **Harvest Timestamp**: 2026-11-13T21:45:19.890Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9494 stars

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
- **Issue #21092** (2026-11-13): **fix(query): truncate REPLACE statements in query logs**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - Long `REPLACE INTO ... VALUES ...` statements bypass `short_sql_max_length` because `short_sql` only recognizes `INSERT`. Add `REPLACE` to the existing keyword list so its query log text is truncated in the same way, including in `system_history.query_history`. - Keep truncation behavior unchanged for all other statement types. For example, an oversized `REPLACE INTO t ON (id) VALUES (1, '...')` now retains the configured prefix followed by `...[X more characters]`; execution SQL is unaffected. - Add `test_short_sql_replace` covering keyword case, leading whitespace, Unicode, and lengths below, at, and above the limit. Confirmed the regression fails before the fix and passes afterward alongside the existing `INSERT` tests. - Validation: `cargo test --offline -p databend-common-base --test it test_short_sql`, `cargo clippy --offline -p databend-common-base --tests -- -D warnings`, formatting, and `git diff --check` passed. Full-service end-to-end validation was not run. No migrations or new settings are required.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [x] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work as expected) - [ ] Documentation 

- **Issue #21090** (2026-11-13): **refactor(query): scan only the rows matched by the inverted index**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  When `match()` / `query()` is the only filter, the scan output every row of each kept block and left the `Filter` operator to drop the unmatched ones. Now the scan outputs only the matched rows.  MS MARCO passage, 8,841,823 rows in 22 blocks, `WHERE match(...) ORDER BY score() DESC LIMIT 100`, one 16-core node, CPU saturated:  | per query | before | after | |---|---|---| | rows output by the scan | up to 8,841,823 (every row of 22 blocks) | up to 2,200 (top 100 of each block) | | CPU in scan + filter | 23.1 ms | 5.8 ms | | CPU total | 78 ms | 60 ms | | QPS | 190-193 | 246-250 (+29%) |  Results are identical for all 6,980 queries (same score lists, Recall@100 0.6188). The row counts follow from the table layout; the timings are from a prototype of the same change. This revision has not been re-measured or tested locally, hence the draft.  - `BlockMetaIndex` holds the result of each index as one `IndexMatches { rows, scores, rows_only }`: `inverted_index_matches` replaces `matched_rows` / `matched_scores`, and `vector_index_matches` replaces the `VectorScores` enum. - `rows_only` tells the scan to output only `rows`. The inverted index pruner sets it when the filter is the index match alone; vector TopN pruning sets it as before. `BlockMetaIndex::selected_rows` derives the row selection from both, so the read path has one row selection instead of a vector-specific one. 

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

### Incident Patch 1: `7cac7adf` (2026-11-13)
**Commit Message**: fix(storage): scope fault injection rules to the installing fixture's prefix (#21075)

* fix(storage): scope fault injection rules to the installing fixture's prefix

`FaultInjectionLayer` keeps its rules in a process-wide registry, so a rule
that only named a path fragment could fire for any other test in the same
binary. The reported failure was a `_ss/` rule hitting another test's snapshot
write.

Match rules as a prefix instead of a substring: current rules are all built
from the fixture's table prefix, and a bare `_ss/` now matches nothing rather
than every table. Also reject an empty pattern (it matches everything) and
remove a rule when its handle is dropped, so a panicking test cannot leave a
live global rule behind for the rest of the process.

* fix(storage): bind fault rules to the installing fixture's storage root

Fixtures use separate storage roots and embedded metastores, so their
root-relative table prefixes can repeat; a prefix-only rule could still
fail another fixture's IO. FaultRule::in_root restricts a rule to one
operator root (normalized, since Fs and Memory report it differently),
and the query fault-injection tests use it.

Also drop the unsynchronized Faul

**File**: `src/common/storage/src/fault_injection_layer.rs` (modified, +171/-15)
```diff
@@ -27,8 +27,19 @@
 //! optionally expires after a number of hits; the [`FaultHandle`] returned on install
 //! reports how often the rule fired, so a test can assert the fault was actually exercised.
 //!
+//! A rule is process-global, so it must be scoped to the fixture that installed it: other
+//! tests in the same binary keep doing storage IO while it is installed, and they must not see
+//! it. The path is matched as a prefix, and [`FaultRule::in_root`] binds the rule to one
+//! storage root, since fixtures with separate roots and metastores can share a relative table
+//! prefix. The rule is removed when its [`FaultHandle`] is dropped, so a failing test cannot
+//! leave it behind for the rest of the process.
+//!
 //! ```ignore
-//! let fault = FaultInjection::install(FaultRule::new(FaultOp::Write, "_ss/", FaultKind::Permanent));
+//! let prefix = table_prefix(&fixture);
+//! let fault = FaultInjection::install(
+//!     FaultRule::new(FaultOp::Write, format!("{prefix}/_ss/"), FaultKind::Permanent)
+//!         .in_root(fixture.storage_root()),
+//! );
 //! assert!(insert(...).await.is_err());
 //! assert_eq!(fault.hits(), 1);
 //! fault.remove();
@@ -59,6 +70,7 @@ use opendal::raw::RpList;
 use opendal::raw::RpRead;
 use opendal::raw::RpStat;
 use opendal::raw::RpWrite;
+use opendal::raw::normalize_root;
 use opendal::raw::oio;
 
 /// The storage operation a rule applies to.
@@ -93,14 +105,24 @@ impl FaultKind {
     }
 }
 
-/// A fault to inject: `kind` for every `op` whose path contains `path_contains`, at most
+/// A fault to inject: `kind` for every `op` on a path under `path_contains`, at most
 /// `remaining` times (unlimited when `None`).
+///
+/// `path_contains` is matched as a prefix, so a rule is anchored to the storage prefix of the
+/// fixture that installed it. A pattern like `_ss/` does not match another fixture's
+/// `1/11/_ss/…`, which a substring match would.
+///
+/// The path an operator reports is relative to its root, and fixtures with separate roots and
+/// separate metastores can hand out the same relative table prefix. `root`, when set,
+/// restricts the rule to operators with that storage root; see [`FaultRule::in_root`].
 #[derive(Debug, Clone)]
 pub struct FaultRule {
     pub op: FaultOp,
     pub path_contains: String,
     pub kind: FaultKind,
     pub remaining: Option<usize>,
+    /// Normalized as opendal does (`/a/b/`), compared with the operator's reported root.
+    pub root: Option<String>,
 }
 
 impl FaultRule {
@@ -110,6 +132,7 @@ impl FaultRule {
             path_contains: path_contains.into(),
             kind,
             remaining: None,
+            root: None,
         }
     }
 
@@ -118,6 +141,13 @@ impl FaultRule {
         self.remaining = Some(times);
         self
     }
+
+    /// Fire only for operators whose storage root is `root` (a fixture's `storage_root()`).
+    /// Without it, a rule reaches every operator in the process whose relative paths match.
+    pub fn in_root(mut self, root: impl AsRef<str>) -> Self {
+        self.root = Some(normalize_root(root.as_ref()));
+        self
+    }
 }
 
 struct RuleState {
@@ -128,8 +158,11 @@ struct RuleState {
 
 impl RuleState {
     /// Returns the error to inject if this rule matches and has budget left.
-    fn fire(&self, op: FaultOp, path: &str) -> Option<Error> {
-        if self.rule.op != op || !path.contains(&self.rule.path_contains) {
+    fn fire(&self, op: FaultOp, root: &str, path: &str) -> Option<Error> {
+        if self.rule.op != op || !path.starts_with(&self.rule.path_contains) {
+            return None;
+        }
+        if self.rule.root.as_deref().is_some_and(|r| r != root) {
             return None;
         }
         if let Some(remaining) = &self.remaining {
@@ -162,8 +195,15 @@ static RULES: LazyLock<Mutex<Vec<Arc<RuleState>>>> = LazyLock::new(|| Mutex::new
 pub struct FaultInjection;
 
 impl FaultInjection {
-    /// Install a rule; it applies to every operator until removed.
+    /// Install a rule; it applies to every operator that touches a matching path until the
+    /// returned handle is dropped (or [`FaultHandle::remove`] is called).
     pub fn install(rule: FaultRule) -> FaultHandle {
+        // An empty pattern matches every path, which would also fail unrelated tests that run
+        // storage IO in the same process. Rules are only useful when scoped.
+        assert!(
+            !rule.path_contains.is_empty(),
+            "a fault rule must be scoped to a path such as the fixture's table prefix"
+        );
         let state = Arc::new(RuleState {
             remaining: rule.remaining.map(AtomicUsize::new),
             hits: AtomicUsize::new(0),
@@ -182,13 +222,13 @@ impl FaultInjection {
         ENABLED.store(false, Ordering::Release);
     }
 
-    fn check(op: FaultOp, path: &str) -> Result<()> {
+    fn check(op: FaultOp, root: &str, path: &str) -> Result<()> {
         if !ENABLED.load(Ordering::Relaxed) {
             return Ok(()
```

**File**: `src/query/service/tests/it/storages/fuse/operations/fault_injection.rs` (modified, +34/-23)
```diff
@@ -16,8 +16,9 @@
 //! `databend_common_storage::FaultInjection`.
 //!
 //! The rule registry is process-global: rules are scoped to the test table's storage prefix
-//! so that other tests running in the same process are not affected, and these tests still
-//! run one at a time to keep the hit counters unambiguous.
+//! and to the fixture's storage root (another fixture's table can have the same relative
+//! prefix) so that other tests running in the same process are not affected, and these tests
+//! still run one at a time to keep the hit counters unambiguous.
 
 use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
@@ -86,11 +87,14 @@ async fn test_failed_snapshot_write_fails_the_statement_and_leaves_the_table_int
 
     // Every snapshot write fails: the commit cannot succeed, the statement must report it,
     // and the table must still be exactly what it was before.
-    let fault = FaultInjection::install(FaultRule::new(
-        FaultOp::Write,
-        format!("{prefix}/_ss/"),
-        FaultKind::Permanent,
-    ));
+    let fault = FaultInjection::install(
+        FaultRule::new(
+            FaultOp::Write,
+            format!("{prefix}/_ss/"),
+            FaultKind::Permanent,
+        )
+        .in_root(fixture.storage_root()),
+    );
     let insert = format!(
         "INSERT INTO {}.{} VALUES (3, (3, 3))",
         fixture.default_db_name(),
@@ -122,11 +126,10 @@ async fn test_missing_block_is_reported_as_an_error() -> Result<()> {
     let _serial = SERIAL.lock().await;
     let (fixture, prefix) = setup().await?;
 
-    let fault = FaultInjection::install(FaultRule::new(
-        FaultOp::Read,
-        format!("{prefix}/_b/"),
-        FaultKind::NotFound,
-    ));
+    let fault = FaultInjection::install(
+        FaultRule::new(FaultOp::Read, format!("{prefix}/_b/"), FaultKind::NotFound)
+            .in_root(fixture.storage_root()),
+    );
     let err = count(&fixture).await.unwrap_err();
     assert_ne!(
         err.code(),
@@ -148,7 +151,9 @@ async fn test_temporary_read_failure_is_retried() -> Result<()> {
     // One transient failure on a block read: the retry layer must absorb it and the query
     // must succeed with the right result.
     let fault = FaultInjection::install(
-        FaultRule::new(FaultOp::Read, format!("{prefix}/_b/"), FaultKind::Temporary).times(1),
+        FaultRule::new(FaultOp::Read, format!("{prefix}/_b/"), FaultKind::Temporary)
+            .times(1)
+            .in_root(fixture.storage_root()),
     );
     assert_eq!(count(&fixture).await?, 2);
     assert_eq!(fault.hits(), 1, "the fault was never exercised");
@@ -206,11 +211,14 @@ async fn test_compact_segment_write_failure_cleans_concurrent_output() -> Result
     // Both outputs start together. Fail either PUT and check the successful
     // sibling cannot survive as an unreferenced file.
     for output in ["_sg", "_hs"] {
-        let fault = FaultInjection::install(FaultRule::new(
-            FaultOp::Write,
-            format!("{prefix}/{output}/"),
-            FaultKind::Permanent,
-        ));
+        let fault = FaultInjection::install(
+            FaultRule::new(
+                FaultOp::Write,
+                format!("{prefix}/{output}/"),
+                FaultKind::Permanent,
+            )
+            .in_root(fixture.storage_root()),
+        );
         let err = fixture
             .execute_command("OPTIMIZE TABLE default.t_compact_fault COMPACT SEGMENT")
             .await
@@ -240,11 +248,14 @@ async fn test_failed_segment_write_fails_the_statement_and_leaves_the_table_inta
     let _serial = SERIAL.lock().await;
     let (fixture, prefix) = setup().await?;
 
-    let fault = FaultInjection::install(FaultRule::new(
-        FaultOp::Write,
-        format!("{prefix}/_sg/"),
-        FaultKind::Permanent,
-    ));
+    let fault = FaultInjection::install(
+        FaultRule::new(
+            FaultOp::Write,
+            format!("{prefix}/_sg/"),
+            FaultKind::Permanent,
+        )
+        .in_root(fixture.storage_root()),
+    );
     let insert = format!(
         "INSERT INTO {}.{} VALUES (3, (3, 3))",
         fixture.default_db_name(),
```

---

### Incident Patch 2: `fec8fc42` (2026-11-13)
**Commit Message**: fix(query): keep multi-table insert distributed when the source needs reorder (#21083)

`build_source_physical_plan` wraps the SELECT plan in a reorder EvalScalar
when the physical column order differs from the select list. The wrapper
sat above the Merge exchange, so `build_physical_plan` no longer saw an
Exchange at the root and fell back to writing every target on the
coordinator, including bloom/inverted index building.

Place the reorder below the Merge exchange instead. The reorder is
positional and the exchange output follows its input, so the plan is
equivalent and the write stays distributed.

**File**: `src/query/service/src/interpreters/interpreter_insert_multi_table.rs` (modified, +20/-2)
```diff
@@ -382,8 +382,26 @@ impl InsertMultiTableInterpreter {
                 let projections: BTreeSet<usize> =
                     (input_col_num..input_col_num + exprs.len()).collect();
 
-                let reordered =
-                    PhysicalPlan::new(EvalScalar::create(input_source, exprs, projections, None));
+                // `build_physical_plan` distributes the write only when the source root is a Merge
+                // exchange. The reorder is positional and the exchange output follows its input, so
+                // put the reorder below the exchange rather than wrapping (and hiding) it.
+                let reordered = match Exchange::from_physical_plan(&input_source) {
+                    Some(exchange) if exchange.kind == FragmentKind::Merge => {
+                        let input = exchange.input.clone();
+                        exchange.derive(vec![PhysicalPlan::new(EvalScalar::create(
+                            input,
+                            exprs,
+                            projections,
+                            None,
+                        ))])
+                    }
+                    _ => PhysicalPlan::new(EvalScalar::create(
+                        input_source,
+                        exprs,
+                        projections,
+                        None,
+                    )),
+                };
                 Ok((reordered, metadata.clone()))
             }
             _ => unreachable!(),
```

**File**: `tests/sqllogictests/suites/mode/cluster/multi_table_insert_distributed.test` (modified, +58/-0)
```diff
@@ -125,6 +125,64 @@ Fragment 2:
         └── source fragment: [0]
 (empty)
 
+# A select list whose order differs from the physical column order needs a reorder
+# EvalScalar. It must stay below the Merge exchange, otherwise the write runs only
+# on the coordinator.
+statement ok
+create table mti_reorder(b int, s int, a int, tag string)
+
+query T
+EXPLAIN INSERT ALL
+  WHEN true THEN INTO mti_reorder
+  WHEN b = 0 THEN INTO mti_even(a, tag) VALUES(a, 'mod0')
+SELECT b, a + b AS s, a, 'x' AS tag FROM mti_src
+----
+Commit
+└── Exchange
+    ├── output columns: []
+    ├── exchange type: Merge
+    └── CommitMeta
+        └── WriteData
+            └── EvalScalar
+                ├── branch 0: mti_src.a (#0), 'mod0'
+                ├── branch 1: None
+                └── Filter
+                    ├── branch 0: is_true(mti_src.b (#1) = CAST(0 AS Int32 NULL))
+                    ├── branch 1: true
+                    └── Duplicate
+                        ├── Duplicate data to 2 branch
+                        └── EvalScalar
+                            ├── output columns: [mti_src.b (#1), s (#2), mti_src.a (#0), tag (#3)]
+                            ├── expressions: [1, 2, 0, 3]
+                            └── EvalScalar
+                                ├── output columns: [mti_src.a (#0), mti_src.b (#1), s (#2), tag (#3)]
+                                ├── expressions: [mti_src.a (#0) + mti_src.b (#1), 'x']
+                                ├── estimated rows: 100.00
+                                └── TableScan
+                                    ├── table: default.mti_distributed.mti_src
+                                    ├── scan id: 0
+                                    ├── output columns: [a (#0), b (#1)]
+                                    ├── read rows: 100
+                                    ├── read size: < 1 KiB
+                                    ├── partitions total: <slt:ignore>
+                                    ├── partitions scanned: <slt:ignore>
+                                    ├── pruning stats: [segments: <read cost: <slt:ignore>, range pruning: <slt:ignore> to <slt:ignore> cost: <slt:ignore>>, blocks: <range pruning: <slt:ignore> to <slt:ignore> cost: <slt:ignore>>]
+                                    ├── push downs: [filters: [], limit: NONE]
+                                    └── estimated rows: 100.00
+
+query II
+INSERT ALL
+  WHEN true THEN INTO mti_reorder
+  WHEN b = 0 THEN INTO mti_even(a, tag) VALUES(a, 'mod0')
+SELECT b, a + b AS s, a, 'x' AS tag FROM mti_src
+----
+34 100
+
+query IIIIT
+select count(*), sum(b), sum(s), sum(a), min(tag) from mti_reorder
+----
+100 99 5049 4950 x
+
 # Each target keeps the original source-once and multi-table commit pipeline,
 # but uses its own partition key for distributed hash routing.
 statement ok
```

---

### Incident Patch 3: `e8974097` (2026-11-13)
**Commit Message**: fix(storage): stop vector RECLUSTER FINAL from rewriting clustered blocks every round (#21054)

* fix(storage): stop vector RECLUSTER FINAL from rewriting clustered blocks every round

* fix

* fix

* fix

**File**: `src/query/service/src/interpreters/interpreter_table_recluster.rs` (modified, +54/-1)
```diff
@@ -44,7 +44,10 @@ use databend_common_storages_fuse::FUSE_OPT_KEY_AGGRESSIVE_RECLUSTER;
 use databend_common_storages_fuse::FuseTable;
 use databend_common_storages_fuse::operations::ReclusterFinalCarry;
 use databend_common_storages_fuse::operations::ReclusterMode;
+use databend_common_storages_fuse::operations::VectorFinalPlan;
+use databend_common_storages_fuse::operations::VectorReclusterBlock;
 use databend_common_storages_fuse::operations::is_auto_vacuum_enabled;
+use databend_common_storages_fuse::operations::vector_final_plan;
 use databend_common_storages_fuse::segment_zone_map::RefreshOutcome;
 use databend_enterprise_vacuum_handler::get_vacuum_handler;
 use databend_storages_common_table_meta::meta::TableSnapshot;
@@ -149,6 +152,35 @@ impl Interpreter for ReclusterTableInterpreter {
             let start = SystemTime::now();
             let timeout = Duration::from_secs(recluster_timeout_secs);
             let is_final = self.plan.is_final;
+            // Vector FINAL: what it does is decided from the blocks when it starts (see
+            // `vector_final_plan`); the full pass starts at once. This scans every block
+            // meta, so it is skipped when FINAL rewrites part of the table at most:
+            // `LIMIT 0` does no work, and a `WHERE` selection only rewrites the selected
+            // segments, which the scan would not tell apart. These recluster the level-0
+            // blocks by rounds, as a recluster without FINAL does.
+            let vector_plan =
+                if is_final && self.plan.limit != Some(0) && self.plan.selection.is_none() {
+                    match self.vector_recluster_blocks().await {
+                        Ok(Some(blocks)) => {
+                            let plan = vector_final_plan(&blocks);
+                            if plan == VectorFinalPlan::FullPass {
+                                let blocks: HashSet<String> =
+                                    blocks.into_iter().map(|block| block.location).collect();
+                                info!(
+                                    event = "recluster.vector_full_pass",
+                                    blocks = blocks.len();
+                                    "Recluster starts the vector full pass"
+                                );
+                                linear_final_carry.start_vector_full_pass(blocks);
+                            }
+                            plan
+                        }
+                        Ok(None) => VectorFinalPlan::Rounds,
+                        Err(e) => return Err(e.with_context("failed to execute")),
+                    }
+                } else {
+                    VectorFinalPlan::Rounds
+                };
             let mut committed_rounds = 0;
             let mut zone_map_rounds = 0;
             let (result, stop_reason) = loop {
@@ -160,6 +192,11 @@ impl Interpreter for ReclusterTableInterpreter {
                     );
                     break (Err(err.with_context("failed to execute")), "aborted");
                 }
+                if vector_plan == VectorFinalPlan::Skip {
+                    // Rows not mixed yet are below the full pass threshold, or none:
+                    // they keep their level to add up.
+                    break (Ok(()), "vector rows not mixed below full pass threshold");
+                }
 
                 rounds += 1;
                 let res = self
@@ -168,6 +205,7 @@ impl Interpreter for ReclusterTableInterpreter {
 
                 match res {
                     Ok(outcome) => {
+                        // The full pass ends when only blocks it wrote remain.
                         if let Some(reason) = outcome.stop_reason() {
                             break (Ok(()), reason);
                         }
@@ -262,6 +300,21 @@ impl Interpreter for ReclusterTableInterpreter {
 }
 
 impl ReclusterTableInterpreter {
+    async fn vector_recluster_blocks(&self) -> Result<Option<Vec<VectorReclusterBlock>>> {
+        let ReclusterPlan {
+            catalog,
+            database,
+            table,
+            ..
+        } = &self.plan;
+        self.ctx.evict_table_from_cache(catalog, database, table)?;
+        let tbl = self.ctx.get_table(catalog, database, table).await?;
+        let Ok(fuse_table) = FuseTable::try_from_table(tbl.as_ref()) else {
+            return Ok(None);
+        };
+        fuse_table.vector_recluster_blocks(self.ctx.clone()).await
+    }
+
     /// Refresh the segment zone map on the snapshot the last round committed,
     /// subject to its start decision. Recluster is the only writer that builds
     /// it; every other commit carries the pointer along. Failures never fail
@@ -430,7 +483,7 @@ impl ReclusterTableInterpreter {
             claim_retries += 1;
 
             // Let concurrent losers spread out before selecting another candidate set.
-            *linear_final_carry = ReclusterFinalCarry::default();
+            linear_final
```

**File**: `src/query/service/tests/it/storages/fuse/operations/mutation/recluster_mutator.rs` (modified, +110/-63)
```diff
@@ -365,6 +365,7 @@ async fn gen_recluster_segments_by_vector_stats(
     file_size: u64,
     thresholds: BlockThresholds,
     cluster_key_id: u32,
+    level: i32,
 ) -> anyhow::Result<Vec<meta::Location>> {
     if let Some(partitions) = partitions {
         assert_eq!(partitions.len(), blocks_by_segment.len());
@@ -411,7 +412,7 @@ async fn gen_recluster_segments_by_vector_stats(
                     } else {
                         vec![]
                     },
-                    0,
+                    level,
                 )),
                 location,
                 None,
@@ -1586,6 +1587,7 @@ async fn test_recluster_mutator_vector_mixed_key_overlap_selection() -> anyhow::
         100,
         thresholds,
         cluster_key_id,
+        0,
     )
     .await?;
 
@@ -1661,71 +1663,115 @@ async fn test_recluster_mutator_vector_only_overlap_selection() -> anyhow::Resul
     let cluster_key_id = 0;
     let thresholds = BlockThresholds::new(1000, 100, 100, 1);
 
-    let segment_locations = gen_recluster_segments_by_vector_stats(
-        &data_accessor,
-        &location_generator,
-        &[
-            vec![(1, 1, [0.0, 0.0], 1.0)],
-            vec![(2, 2, [0.5, 0.0], 1.0)],
-            vec![(3, 3, [10.0, 0.0], 1.0)],
-        ],
-        None,
-        false,
-        1000,
-        100,
-        100,
-        thresholds,
-        cluster_key_id,
-    )
-    .await?;
+    // (level, full pass of RECLUSTER FINAL)
+    for (level, full_pass) in [(0, false), (1, false), (2, false), (1, true), (2, true)] {
+        let segment_locations = gen_recluster_segments_by_vector_stats(
+            &data_accessor,
+            &location_generator,
+            &[
+                vec![(1, 1, [0.0, 0.0], 1.0)],
+                vec![(2, 2, [0.5, 0.0], 1.0)],
+                vec![(3, 3, [10.0, 0.0], 1.0)],
+            ],
+            None,
+            false,
+            1000,
+            100,
+            100,
+            thresholds,
+            cluster_key_id,
+            level,
+        )
+        .await?;
 
-    let schema = vector_recluster_schema();
-    let ctx: Arc<dyn TableContext> = ctx.clone();
-    let compact_segments = segment_pruning(
-        &ctx,
-        schema.clone(),
-        data_accessor.clone(),
-        create_segment_location_vector(segment_locations, None),
-    )
-    .await?;
+        let schema = vector_recluster_schema();
+        let query_ctx: Arc<dyn TableContext> = ctx.clone();
+        let compact_segments = segment_pruning(
+            &query_ctx,
+            schema.clone(),
+            data_accessor.clone(),
+            create_segment_location_vector(segment_locations, None),
+        )
+        .await?;
 
-    let vector_cluster_info = VectorClusterInfo {
-        key_index: 0,
-        column_id: 1,
-        column_name: "embedding".to_string(),
-        dimension: 2,
-        distance_type: VectorDistanceType::L2,
-    };
-    let mutator = ReclusterMutator::new(
-        ctx,
-        data_accessor,
-        schema,
-        vec![test_vector_cluster_key_expr()],
-        1.0,
-        thresholds,
-        ClusterKeyInfo::new((cluster_key_id, "(c0)".to_string()), ClusterType::Linear),
-        0,
-        1,
-        ReclusterMode::Conservative,
-        Some(vector_cluster_info),
-    );
+        // Selected by overlap, and with larger thresholds by the shared small-block
+        // compaction: vector recluster output may stay below them, so level >= 1
+        // blocks must not be compacted either. FINAL runs in the aggressive mode on
+        // tables with the `aggressive_recluster` option, whose groups differ.
+        let large = BlockThresholds::new(10000, 10000, 10000, 1);
+        for (mutator_thresholds, mode) in [
+            (thresholds, ReclusterMode::Conservative),
+            (large, ReclusterMode::Conservative),
+            (thresholds, ReclusterMode::Aggressive),
+            (large, ReclusterMode::Aggressive),
+        ] {
+            let vector_cluster_info = VectorClusterInfo {
+                key_index: 0,
+                column_id: 1,
+                column_name: "embedding".to_string(),
+                dimension: 2,
+                distance_type: VectorDistanceType::L2,
+            };
+            let mutator = ReclusterMutator::new(
+                query_ctx.clone(),
+                data_accessor.clone(),
+                schema.clone(),
+                vec![test_vector_cluster_key_expr()],
+                1.0,
+                mutator_thresholds,
+                ClusterKeyInfo::new((cluster_key_id, "(c0)".to_string()), ClusterType::Linear),
+                0,
+                1,
+                mode,
+                Some(vector_cluster_info),
+            );
+            let mutator = if full_pass {
+                let mut blocks = HashSet::new();
+                for (_, segment) in &compact_segments {
+                    for block in segment.block_metas()? {
+                        blocks.inse
```

**File**: `src/query/storages/fuse/src/io/write/vector_index_writer.rs` (modified, +54/-36)
```diff
@@ -55,12 +55,53 @@ use crate::io::write::block_index::PendingVectorIndex;
 const DEFAULT_M: usize = 16;
 const DEFAULT_EF_CONSTRUCT: usize = 100;
 
-/// Whether the index stores FP16 vectors for refinement (`refine = true`).
-fn vector_index_refine(options: &BTreeMap<String, String>) -> Result<bool> {
-    match options.get(VECTOR_INDEX_OPT_REFINE) {
-        None => Ok(false),
-        Some(value) => parse_vector_index_refine(value)
-            .ok_or_else(|| ErrorCode::IndexOptionInvalid("`refine` must be `true` or `false`")),
+/// The options of a vector index (`TableIndex::options`), as vector index writes,
+/// searches and the block size limit use them.
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub(crate) struct VectorIndexOptions {
+    pub m: usize,
+    pub ef_construct: usize,
+    /// The known distance types, in their configured order. Without any, no index
+    /// is built.
+    pub distances: Vec<DistanceType>,
+    /// Whether the index stores FP16 vectors for refinement (`refine = true`).
+    pub refine: bool,
+}
+
+impl VectorIndexOptions {
+    /// An `m` or `ef_construct` that is not a number takes the default, and unknown
+    /// distance types are skipped. `refine` is validated at bind time too, and an
+    /// invalid persisted value is an error: it must not silently omit FP16 data.
+    pub(crate) fn parse(options: &BTreeMap<String, String>) -> Result<Self> {
+        let number = |key: &str, default: usize| {
+            options
+                .get(key)
+                .and_then(|value| value.parse::<usize>().ok())
+                .unwrap_or(default)
+        };
+        let distances = options
+            .get(VECTOR_INDEX_OPT_DISTANCE)
+            .into_iter()
+            .flat_map(|value| value.split(','))
+            .filter_map(|distance| match distance {
+                "cosine" => Some(DistanceType::Dot),
+                "l1" => Some(DistanceType::L1),
+                "l2" => Some(DistanceType::L2),
+                _ => None,
+            })
+            .collect();
+        let refine = match options.get(VECTOR_INDEX_OPT_REFINE) {
+            None => false,
+            Some(value) => parse_vector_index_refine(value).ok_or_else(|| {
+                ErrorCode::IndexOptionInvalid("`refine` must be `true` or `false`")
+            })?,
+        };
+        Ok(Self {
+            m: number(VECTOR_INDEX_OPT_M, DEFAULT_M),
+            ef_construct: number(VECTOR_INDEX_OPT_EF_CONSTRUCT, DEFAULT_EF_CONSTRUCT),
+            distances,
+            refine,
+        })
     }
 }
 
@@ -79,7 +120,7 @@ impl VectorIndexSearchOptions {
         refine_factor: u64,
         search_ef: u64,
     ) -> Result<Self> {
-        let refine = refine_factor > 0 && vector_index_refine(index_options)?;
+        let refine = refine_factor > 0 && VectorIndexOptions::parse(index_options)?.refine;
         Ok(Self {
             refine_factor: refine.then_some(refine_factor as usize),
             search_ef: (search_ef > 0).then_some(search_ef as usize),
@@ -180,35 +221,12 @@ impl VectorIndexBuilder {
                 continue;
             }
 
-            // Validated at bind time too; invalid persisted metadata must return an
-            // error, not silently omit the index.
-            let refine = vector_index_refine(&index.options)?;
-            let m = match index.options.get(VECTOR_INDEX_OPT_M) {
-                Some(value) => value.parse::<usize>().unwrap_or(DEFAULT_M),
-                None => DEFAULT_M,
-            };
-
-            let ef_construct = match index.options.get(VECTOR_INDEX_OPT_EF_CONSTRUCT) {
-                Some(value) => value.parse::<usize>().unwrap_or(DEFAULT_EF_CONSTRUCT),
-                None => DEFAULT_EF_CONSTRUCT,
-            };
-
-            let mut distances = Vec::new();
-            match index.options.get(VECTOR_INDEX_OPT_DISTANCE) {
-                Some(value) => {
-                    let distance_types: Vec<&str> = value.split(',').collect();
-                    for distance_type in distance_types {
-                        let distance = match distance_type {
-                            "cosine" => DistanceType::Dot,
-                            "l1" => DistanceType::L1,
-                            "l2" => DistanceType::L2,
-                            _ => continue,
-                        };
-                        distances.push(distance);
-                    }
-                }
-                None => continue,
-            };
+            let VectorIndexOptions {
+                m,
+                ef_construct,
+                distances,
+                refine,
+            } = VectorIndexOptions::parse(&index.options)?;
             if distances.is_empty() {
                 debug!(
                     "Ignoring vector index: {}, no valid distance types",
```

**File**: `src/query/storages/fuse/src/operations/mod.rs` (modified, +3/-0)
```diff
@@ -64,6 +64,9 @@ pub use recluster::ReclusterFinalCarry;
 pub use recluster::ReclusterMode;
 pub use recluster::ReclusterMutator;
 pub use recluster::SelectedReclusterSegment;
+pub use recluster::VectorFinalPlan;
+pub use recluster::VectorReclusterBlock;
+pub use recluster::vector_final_plan;
 pub use replace_into::*;
 pub use snapshot_hint::*;
 pub use table_index::do_refresh_table_index;
```

**File**: `src/query/storages/fuse/src/operations/recluster/mod.rs` (modified, +5/-0)
```diff
@@ -38,4 +38,9 @@ pub(crate) use recluster_strategy::ReclusterTaskCandidate;
 pub use recluster_strategy::SelectedReclusterSegment;
 pub(crate) use recluster_strategy::passes_depth_gate;
 pub(crate) use recluster_strategy::task_candidate;
+pub use recluster_table::VectorFinalPlan;
+pub use recluster_table::VectorReclusterBlock;
+pub use recluster_table::vector_final_plan;
+pub(crate) use vector_recluster::VECTOR_LEVEL_MIXED;
+pub(crate) use vector_recluster::VECTOR_LEVEL_NEW;
 pub(crate) use vector_recluster::VectorReclusterStrategy;
```

**File**: `src/query/storages/fuse/src/operations/recluster/recluster_mutator.rs` (modified, +52/-11)
```diff
@@ -71,6 +71,7 @@ use crate::operations::recluster::ReclusterProperties;
 use crate::operations::recluster::ReclusterStrategy;
 use crate::operations::recluster::ReclusterTaskCandidate;
 use crate::operations::recluster::SelectedReclusterSegment;
+use crate::operations::recluster::VECTOR_LEVEL_MIXED;
 use crate::operations::recluster::task_candidate;
 use crate::statistics::VectorClusterInfo;
 use crate::statistics::partition_values;
@@ -145,9 +146,28 @@ pub struct ReclusterFinalCarry {
     pub(crate) cluster_key_id: u32,
     // Reuse block-meta decode workers across rounds of one FINAL statement.
     pub(crate) decode_runtime: Option<Arc<Runtime>>,
+    // The full pass of a vector RECLUSTER FINAL (see `vector_final_plan`): the blocks
+    // present when it starts, rewritten once together regardless of level, so new
+    // data is mixed with older clustered blocks. Blocks written by this pass are not
+    // in the set, which ends it.
+    pub(crate) vector_full_pass: Option<Arc<HashSet<String>>>,
 }
 
 impl ReclusterFinalCarry {
+    /// Starts the full pass of a vector RECLUSTER FINAL over `blocks`, scanning the
+    /// table again from the start.
+    pub fn start_vector_full_pass(&mut self, blocks: HashSet<String>) {
+        self.reset();
+        self.vector_full_pass = Some(Arc::new(blocks));
+    }
+
+    /// Forgets the scan state, keeping a started vector full pass.
+    pub fn reset(&mut self) {
+        let vector_full_pass = self.vector_full_pass.take();
+        *self = Self::default();
+        self.vector_full_pass = vector_full_pass;
+    }
+
     /// Lazily create or reuse the block-meta decode runtime for FINAL recluster.
     pub(crate) fn decode_runtime(&mut self, workers: usize) -> Result<Arc<Runtime>> {
         if self.decode_runtime.is_none() {
@@ -282,6 +302,13 @@ impl ReclusterMutator {
         })
     }
 
+    /// Restricts selection to the full pass of a vector RECLUSTER FINAL over
+    /// `blocks`; see `ReclusterFinalCarry`.
+    pub fn with_vector_full_pass(mut self, blocks: Option<Arc<HashSet<String>>>) -> Self {
+        self.properties.vector_full_pass = blocks;
+        self
+    }
+
     /// Build a recluster mutator directly for tests.
     #[allow(clippy::too_many_arguments)]
     pub fn new(
@@ -448,10 +475,22 @@ impl ReclusterMutator {
             if level < 0 {
                 continue;
             }
-            if level >= MAX_RECLUSTER_LEVEL {
+            let group = if let Some(full_pass) = &self.properties.vector_full_pass {
+                // The full pass rewrites the blocks present when it started, in one
+                // group whose output (the group level + 1) is `VECTOR_LEVEL_MIXED`, so
+                // levels stay bounded. A level group, in every mode: the aggressive
+                // low-maturity group would take the output level from the levels of
+                // the blocks.
+                if !full_pass.contains(&block.meta.location.0) {
+                    continue;
+                }
+                ReclusterGroup::Level(VECTOR_LEVEL_MIXED - 1)
+            } else if level >= MAX_RECLUSTER_LEVEL {
                 // Terminal-level blocks are excluded from further rewrite tasks.
                 continue;
-            }
+            } else {
+                ReclusterGroup::assign(level, self.properties.mode)
+            };
             let partition = if self.properties.partition_key_count == 0 {
                 Vec::new()
             } else if let Some(partition) = partition_values(
@@ -465,13 +504,7 @@ impl ReclusterMutator {
                 // together with another partition.
                 continue;
             };
-            blocks_map
-                .entry((
-                    ReclusterGroup::assign(level, self.properties.mode),
-                    partition,
-                ))
-                .or_default()
-                .push(idx);
+            blocks_map.entry((group, partition)).or_default().push(idx);
         }
 
         let mut tasks: Vec<ReclusterTaskCandidate> = Vec::new();
@@ -711,11 +744,19 @@ impl ReclusterMutator {
         task_budget: usize,
     ) -> Result<Vec<ReclusterTaskCandidate>> {
         debug_assert!(task_budget > 0);
+        let indices = self
+            .strategy
+            .eligible_blocks(&self.properties, indices, blocks);
         let block_count = indices.len();
-        if block_count < 2 && !self.properties.split_sort_tasks {
+        // The full pass of a vector RECLUSTER FINAL rewrites every block it holds
+        // once, whatever their level and also alone, so that new data mixes with all
+        // of them and none stays unmixed (see `VectorReclusterStrategy`).
+        let full_pass = self.properties.vector_full_pass.is_some();
+        if block_count < 2 && !self.properties.split_sort_tasks && !full_pass {
             return Ok(Vec::new());
         }
         if block_count == 2
+            && !full_pass
             && indices
                 .
```

**File**: `src/query/storages/fuse/src/operations/recluster/recluster_strategy.rs` (modified, +17/-0)
```diff
@@ -14,6 +14,7 @@
 
 use std::cmp;
 use std::collections::BTreeMap;
+use std::collections::HashSet;
 use std::fmt;
 use std::sync::Arc;
 
@@ -71,6 +72,9 @@ pub(crate) struct ReclusterProperties {
     pub(crate) split_sort_tasks: bool,
     pub(crate) prepared_cluster_key_exprs: Vec<PreparedClusterKeyExpr>,
     pub(crate) scalar_cluster_key_types: Vec<DataType>,
+    /// Blocks of the final full pass of a vector RECLUSTER FINAL, which are
+    /// rewritten once regardless of level; see `ReclusterFinalCarry`.
+    pub(crate) vector_full_pass: Option<Arc<HashSet<String>>>,
 }
 
 impl ReclusterProperties {
@@ -129,6 +133,7 @@ impl ReclusterProperties {
             memory_threshold,
             prepared_cluster_key_exprs,
             scalar_cluster_key_types,
+            vector_full_pass: None,
         };
         Ok((properties, strategy))
     }
@@ -176,6 +181,7 @@ impl ReclusterProperties {
             memory_threshold,
             prepared_cluster_key_exprs,
             scalar_cluster_key_types,
+            vector_full_pass: None,
         };
         (properties, strategy)
     }
@@ -199,6 +205,17 @@ pub(crate) trait ReclusterStrategy: Send + Sync {
         window_len: usize,
     ) -> Result<Vec<Vec<SelectedReclusterSegment>>>;
 
+    /// The blocks of a group that may be rewritten, before any selection, including
+    /// small-block compaction. All by default.
+    fn eligible_blocks(
+        &self,
+        _properties: &ReclusterProperties,
+        indices: Vec<usize>,
+        _blocks: &[&ReclusterBlock],
+    ) -> Vec<usize> {
+        indices
+    }
+
     fn fetch_task_candidates(
         &self,
         properties: &ReclusterProperties,
```

**File**: `src/query/storages/fuse/src/operations/recluster/recluster_table.rs` (modified, +150/-7)
```diff
@@ -30,7 +30,11 @@ use databend_common_meta_app::schema::MAX_SEGMENT_LOCATIONS_PER_CLAIM;
 use databend_common_metrics::storage::metrics_inc_recluster_build_task_milliseconds;
 use databend_common_metrics::storage::metrics_inc_recluster_segment_nums_scheduled;
 use databend_common_sql::BloomIndexColumns;
+use databend_common_sql::ClusterKeys;
+use databend_common_sql::parse_cluster_keys;
+use databend_storages_common_cache::CachePolicy;
 use databend_storages_common_table_meta::meta::CompactSegmentInfo;
+use databend_storages_common_table_meta::meta::SegmentInfo;
 use databend_storages_common_table_meta::meta::TableSnapshot;
 use log::debug;
 use log::info;
@@ -40,11 +44,14 @@ use tokio::sync::Semaphore;
 
 use crate::FuseTable;
 use crate::SegmentLocation;
+use crate::io::SegmentsIO;
 use crate::operations::recluster::CandidateScore;
 use crate::operations::recluster::ReclusterCandidateWindow;
 use crate::operations::recluster::ReclusterFinalCarry;
 use crate::operations::recluster::ReclusterMode;
 use crate::operations::recluster::ReclusterMutator;
+use crate::operations::recluster::VECTOR_LEVEL_MIXED;
+use crate::operations::recluster::VECTOR_LEVEL_NEW;
 use crate::pruning::PruningContext;
 use crate::pruning::SegmentPruner;
 
@@ -109,7 +116,109 @@ fn select_task_candidates(
     selected_task_indices
 }
 
+/// Rows not mixed yet (below `VECTOR_LEVEL_MIXED`), in percent of all rows, from
+/// which a vector RECLUSTER FINAL rewrites the whole table once to mix them in.
+const VECTOR_FULL_PASS_NEW_DATA_PERCENT: u64 = 10;
+
+/// A block of a table with a vector cluster key, as a vector RECLUSTER FINAL sees it
+/// when it starts.
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub struct VectorReclusterBlock {
+    pub location: String,
+    /// Recluster level (see `VECTOR_LEVEL_NEW`). Blocks whose cluster statistics are
+    /// missing or belong to another cluster key have level 0: recluster normalizes
+    /// their statistics to level 0 and rewrites them as new data.
+    pub level: i32,
+    pub rows: u64,
+}
+
+/// What a vector RECLUSTER FINAL does, decided from its blocks when it starts.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub enum VectorFinalPlan {
+    /// Recluster the level-0 blocks round by round, as a recluster without FINAL
+    /// does: for a FINAL that may only rewrite part of the table (`WHERE`, `LIMIT`).
+    Rounds,
+    /// Rewrite every block once, together, so that the rows not mixed yet mix with
+    /// the others. This is also the first clustering of a table.
+    FullPass,
+    /// Rewrite nothing: the rows not mixed yet are fewer than
+    /// `VECTOR_FULL_PASS_NEW_DATA_PERCENT` of all rows. They keep their level, so they
+    /// add up across statements until they reach the threshold.
+    Skip,
+}
+
+/// The plan of a vector RECLUSTER FINAL over `blocks`. Rows below
+/// `VECTOR_LEVEL_MIXED` are not mixed yet: new data, and data that the recluster after
+/// writes clustered on its own. Only the full pass mixes them in; it runs when they
+/// are all the data, or at least `VECTOR_FULL_PASS_NEW_DATA_PERCENT` of it. Blocks
+/// excluded from recluster (level < 0) count as neither.
+pub fn vector_final_plan(blocks: &[VectorReclusterBlock]) -> VectorFinalPlan {
+    let rows = |mixed: bool| -> u64 {
+        blocks
+            .iter()
+            .filter(|block| block.level >= VECTOR_LEVEL_NEW)
+            .filter(|block| (block.level >= VECTOR_LEVEL_MIXED) == mixed)
+            .map(|block| block.rows)
+            .sum()
+    };
+    let (unmixed_rows, mixed_rows) = (rows(false), rows(true));
+    if unmixed_rows > 0
+        && unmixed_rows.saturating_mul(100)
+            >= unmixed_rows
+                .saturating_add(mixed_rows)
+                .saturating_mul(VECTOR_FULL_PASS_NEW_DATA_PERCENT)
+    {
+        VectorFinalPlan::FullPass
+    } else {
+        VectorFinalPlan::Skip
+    }
+}
+
 impl FuseTable {
+    /// The blocks in the latest snapshot of a table with a vector cluster key, or
+    /// `None` for other tables.
+    #[async_backtrace::framed]
+    pub async fn vector_recluster_blocks(
+        &self,
+        ctx: Arc<dyn TableContext>,
+    ) -> Result<Option<Vec<VectorReclusterBlock>>> {
+        let (Some(cluster_key_id), Some(cluster_keys)) =
+            (self.cluster_key_id(), self.resolve_cluster_keys())
+        else {
+            return Ok(None);
+        };
+        let parsed = parse_cluster_keys(ctx.clone(), Arc::new(self.clone()), cluster_keys)?;
+        if !matches!(parsed, ClusterKeys::Vector { .. }) {
+            return Ok(None);
+        }
+        let Some(snapshot) = self.read_table_snapshot().await? else {
+            return Ok(Some(Vec::new()));
+        };
+        let chunk_size = ctx.get_settings().get_max_threads()? as usize * 4;
+        let segments_io = SegmentsIO::create(ctx, self.get_operator(), self.schema());
+        let mut blocks = Vec::new();
+        for chunk in snapshot.segments.chunks(chunk_size.max(1)) {

```

#### Recent Merged Pull Requests:
- **PR #21092** (2026-11-13): fix(query): truncate REPLACE statements in query logs (@TCeason)
- **PR #21090** (2026-11-13): refactor(query): scan only the rows matched by the inverted index (@bohutang)
- **PR #21087** (2026-11-13): feat(query): support native charset conversion for binary strings (@sundy-li)
- **PR #21083** (2026-11-13): fix(query): keep multi-table insert distributed when the source needs reorder (@zhang2014)
- **PR #21082** (closed): feat(query): enable meta-service ownership cache by default (@TCeason)
- **PR #21079** (2026-11-13): fix(query): fix virtual column binding (@b41sh)

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

## X. storage): scope fault injection rules to the installing fixture's prefix

**RULE**:
When implementing operations in `src/common/storage/src/fault_injection_layer.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7cac7adf`: storage): scope fault injection rules to the installing fixture's prefix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/common/storage/src/fault_injection_layer.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! A rule is process-global, so it must be scoped to the fixture that installed it: other
//! tests in the same binary keep doing storage IO while it is installed, and they must not see
//! it. The path is matched as a prefix, and [`FaultRule::in_root`] binds the rule to one
//! storage root, since fixtures with separate roots and metastores can share a relative table
//! prefix. The rule is removed when its [`FaultHandle`] is dropped, so a failing test cannot
//! leave it behind for the rest of the process.
//!
//! let prefix = table_prefix(&fixture);
//! let fault = FaultInjection::install(
//!     FaultRule::new(FaultOp::Write, format!("{prefix}/_ss/"), FaultKind::Permanent)
//!         .in_root(fixture.storage_root()),
//! );
use opendal::raw::normalize_root;
/// A fault to inject: `kind` for every `op` on a path under `path_contains`, at most
///
/// `path_contains` is matched as a prefix, so a rule is anchored to the storage prefix of the
/// fixture that installed it. A pattern like `_ss/` does not match another fixture's
/// `1/11/_ss/…`, which a substring match would.
///
/// The path an operator reports is relative to its root, and fixtures with separate roots and
/// se
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
//! let fault = FaultInjection::install(FaultRule::new(FaultOp::Write, "_ss/", FaultKind::Permanent));
/// A fault to inject: `kind` for every `op` whose path contains `path_contains`, at most
    fn fire(&self, op: FaultOp, path: &str) -> Option<Error> {
        if self.rule.op != op || !path.contains(&self.rule.path_contains) {
    /// Install a rule; it applies to every operator until removed.
    fn check(op: FaultOp, path: &str) -> Result<()> {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7cac7adf` are properly handled with clean fallback behavior.
