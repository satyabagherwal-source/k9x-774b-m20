> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `75a200a3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T22:59:05.769Z  
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
> **Harvest Timestamp**: 2026-11-04T22:59:05.764Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9490 stars

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
- **Issue #20967** (2026-11-04): **feat(query): support runtime TopN pruning across UNION ALL**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Runtime TopN pruning (#20247) stopped at `UNION ALL`: for `SELECT ... FROM (t1 UNION ALL t2) ORDER BY k LIMIT n`, or a view defined as such a union, no branch scan got a runtime filter. This PR lets one TopN drive the runtime filters of all branch scans, and does the same for the aggregate rank limit (`GROUP BY k ORDER BY k LIMIT n` over a union).  - `RuntimeTopNFilter` is split into a shared `RuntimeTopNBoundary` (published by TopN / rank-limit sort) and per-scan `RuntimeTopNFilter`s (each with its own column id). One boundary update prunes and notifies every branch. - `register_runtime_top_n_filter` now crosses `UnionAll` (including nested ones) besides `Filter`/`EvalScalar`, and registers a filter on every eligible branch scan. An ineligible branch only skips itself. The scan's sort column is now matched by symbol through `name_mapping` instead of `display_name`. - New rule `PushDownTopNUnionScan` (`TopN -> [EvalScalar ->] UnionAll`) pushes the TopN keys, translated into each branch's columns, into the branch scans' `order_by`. Only the order is pushed, not the limit. `PushDownRankLimitAggregate` reuses the same helper (`rule/scan_order.rs`), so aggregates over a union push the order too. - Correctness: the boundary comes from rows of the union output; a block whose rows are all strictly worse cannot reach the top N whichever branch it belongs to. A branch is skipp

- **Issue #20965** (2026-11-04): **ci: use $1 for the capture group in ClickBench Q28**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  `benchmark/hits/queries/28.sql` passed `'\1'` as the replacement of `REGEXP_REPLACE`. The string literal parser turns `'\1'` into the byte `0x01` (`SELECT ascii('\1')` returns 1), and `regexp_replace` uses the Rust regex syntax `$1` for a capture group, so every matching `Referer` was replaced by `'\x01'`. On the 100M-row `hits` table the query returned 11 rows, the first being the key `'\x01'` with 66,284,655 rows, instead of 25 domains.  This PR uses `'$1'`, as the Databend query of ClickBench does (`databend/queries.sql`, line 29); the file now matches it. Q28 timings of the local and cloud benchmarks measured the wrong query until now and will change: on a local 100M-row run the corrected query takes 2.25 s instead of about 1 s.  The corrected query returns the 25 domains. With `octet_length` and `(?s)` added for the dialect differences (byte length, `.` matching newlines), its result is identical to another engine's result of the ClickBench query.  No test: this changes a benchmark query only; it was checked by running it as described above.  ## Tests  - [ ] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [x] No Test - _Explain why_  ## Type of change  - [x] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work 

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

### Incident Patch 1: `6454b150` (2026-11-04)
**Commit Message**: fix(storage): prevent incomplete index refresh after writes (#20909)

* refactor(storage): streamline compact and recluster maintenance

Use execution-time segment claims and publish-time table locks for
lightweight compaction. Bound hook compaction to 128 source segments and
cap auto_compaction_segments_limit at 128.

Keep commit-lock retries for already-written output, with a one-second
query-level lock timeout for Compact/Recluster hooks. Leave session
settings unchanged.

Preserve parent-write hints across partial compaction and refresh the
table cache before index maintenance. Log Compact/Recluster stage times.

Retain block HLL, Top-N and segment-local virtual schemas during metadata
assembly. Use physical block sizes for native compact admission and keep
partition boundaries, force-perfect handling and the original recluster
memory threshold unchanged.

Remove redundant compact interfaces and stop reading distributed
maintenance toggles. Retain both settings as deprecated no-ops so existing
SET statements remain accepted.

Extend existing settings, index-refresh and auto-compaction regressions.
Validation: rustfmt --check on 24 changed Rust files; git diff --check.
Builds, t

**File**: `src/query/catalog/src/plan/partition.rs` (modified, +21/-5)
```diff
@@ -28,8 +28,10 @@ use databend_common_exception::Result;
 use databend_meta_client::types::NodeInfo;
 use databend_storages_common_table_meta::meta::BlockIndexMeta;
 use databend_storages_common_table_meta::meta::BlockMeta;
+use databend_storages_common_table_meta::meta::BlockTopN;
 use databend_storages_common_table_meta::meta::RawBlockHLL;
 use databend_storages_common_table_meta::meta::Statistics;
+use databend_storages_common_table_meta::meta::VirtualSegmentSchema;
 use parking_lot::RwLock;
 use rand::prelude::SliceRandom;
 use rand::thread_rng;
@@ -84,8 +86,11 @@ pub trait PartInfo: Send + Sync {
 impl Debug for Box<dyn PartInfo> {
     fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
         match serde_json::to_string(self) {
-            Ok(str) => write!(f, "{}", str),
-            Err(_cause) => Err(std::fmt::Error {}),
+            Ok(json) => f.write_str(&json),
+            Err(cause) => f
+                .debug_struct("PartInfo")
+                .field("serialization_error", &cause)
+                .finish(),
         }
     }
 }
@@ -496,12 +501,22 @@ pub struct ReclusterTask {
     pub inverted_index_sources: Vec<Vec<BlockIndexMeta>>,
 }
 
-pub type BlockMetaWithHLL = (Arc<BlockMeta>, Option<RawBlockHLL>);
+/// A surviving block keeps its segment-local virtual-column interpretation
+/// and per-block statistics when maintenance replaces the containing segment.
+#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
+pub struct RetainedBlockMeta {
+    pub block_meta: Arc<BlockMeta>,
+    pub hll: Option<RawBlockHLL>,
+    pub top_n: Option<BlockTopN>,
+    /// Local index into the enclosing container's `virtual_schemas`.
+    pub virtual_schema_index: usize,
+}
 
 #[derive(Clone, Default)]
 pub struct ReclusterParts {
     pub tasks: Vec<ReclusterTask>,
-    pub remained_blocks: Vec<BlockMetaWithHLL>,
+    pub remained_blocks: Vec<RetainedBlockMeta>,
+    pub virtual_schemas: Vec<Option<Arc<VirtualSegmentSchema>>>,
     pub removed_segment_indexes: Vec<usize>,
     pub removed_segment_summary: Statistics,
 }
@@ -514,7 +529,8 @@ impl ReclusterParts {
 
 #[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
 pub struct ReclusterInfoSideCar {
-    pub merged_blocks: Vec<BlockMetaWithHLL>,
+    pub merged_blocks: Vec<RetainedBlockMeta>,
+    pub virtual_schemas: Vec<Option<Arc<VirtualSegmentSchema>>>,
     pub removed_segment_indexes: Vec<usize>,
     pub removed_statistics: Statistics,
     /// Acquire the table lock only around refresh, sequence validation, and CAS publish.
```

**File**: `src/query/service/src/interpreters/hook/compact_hook.rs` (modified, +71/-41)
```diff
@@ -46,7 +46,6 @@ use crate::interpreters::hook::vacuum_hook::hook_vacuum_temp_files;
 use crate::pipelines::executor::ExecutorSettings;
 use crate::pipelines::executor::PipelineCompleteExecutor;
 use crate::sessions::QueryContext;
-use crate::sessions::TableContext;
 use crate::sessions::TableContextPartitionStats;
 use crate::sessions::TableContextProgress;
 use crate::sessions::TableContextSettings;
@@ -207,10 +206,10 @@ pub(crate) async fn compact_table(
         &compact_target.database,
         &compact_target.table,
     )?;
-
     ctx.clear_table_meta_timestamps_cache();
 
-    {
+    let compact_start = Instant::now();
+    let compact_result: Result<()> = async {
         // do compact.
         let compact_block = RelOperator::CompactBlock(OptimizeCompactBlock {
             catalog: compact_target.catalog.clone(),
@@ -243,13 +242,27 @@ pub(crate) async fn compact_table(
             let complete_executor =
                 PipelineCompleteExecutor::from_pipelines(pipelines, executor_settings)?;
 
-            // Clears previously generated segment locations to avoid duplicate data in the refresh phase
-            ctx.written_segment_locations().clear();
+            // Preserve parent-write hints for untouched segments and failed compaction.
+            // CommitSink adds published outputs; refresh filters out no-longer-live sources.
             ctx.set_executor(complete_executor.get_inner())?;
             complete_executor.execute().await?;
             drop(complete_executor);
         }
+        Ok(())
     }
+    .await;
+    info!(
+        event = "compact_hook.stage_finished",
+        stage = "compact",
+        catalog = compact_target.catalog.as_str(),
+        database = compact_target.database.as_str(),
+        table = compact_target.table.as_str(),
+        elapsed_ms = compact_start.elapsed().as_millis() as u64,
+        success = compact_result.is_ok(),
+        error :? = compact_result.as_ref().err();
+        "Compact hook stage finished"
+    );
+    compact_result?;
 
     {
         let table = ctx
@@ -264,42 +277,59 @@ pub(crate) async fn compact_table(
         }
         // do recluster.
         if table.cluster_key_meta().is_some() {
-            // evict the table from cache
-            ctx.evict_table_from_cache(
-                &compact_target.catalog,
-                &compact_target.database,
-                &compact_target.table,
-            )?;
-            // Spill is disabled to keep this synchronous hook fast (spilling adds
-            // disk IO). Admission must then keep tasks inside the memory budget.
-            // TODO: remove once the async hook is enabled.
-            ctx.set_enable_sort_spill(false);
-            let target = if is_materialized_view_engine(table.engine()) {
-                MaintenanceTarget::MaterializedView {
-                    table_id: table.get_id(),
-                }
-            } else {
-                MaintenanceTarget::Table
-            };
-            let recluster = ReclusterPlan {
-                catalog: compact_target.catalog,
-                database: compact_target.database,
-                table: compact_target.table,
-                target,
-                limit: Some(settings.get_auto_compaction_segments_limit()? as usize),
-                selection: None,
-                is_final: false,
-            };
-            let allow_segment_claims = lock_opt != LockTableOption::NoLock;
-            let recluster_interpreter = ReclusterTableInterpreter::try_create(
-                ctx.clone(),
-                recluster,
-                allow_segment_claims,
-            )?;
-            // Recluster will be done in `ReclusterTableInterpreter::execute2` directly,
-            // we do not need to use `PipelineCompleteExecutor` to execute it.
-            let build_res = recluster_interpreter.execute2().await?;
-            debug_assert!(build_res.main_pipeline.is_empty());
+            let recluster_start = Instant::now();
+            let recluster_result: Result<()> = async {
+                // evict the table from cache
+                ctx.evict_table_from_cache(
+                    &compact_target.catalog,
+                    &compact_target.database,
+                    &compact_target.table,
+                )?;
+                // Spill is disabled to keep this synchronous hook fast (spilling adds
+                // disk IO). Admission must then keep tasks inside the memory budget.
+                // TODO: remove once the async hook is enabled.
+                ctx.set_enable_sort_spill(false);
+                let target = if is_materialized_view_engine(table.engine()) {
+                    MaintenanceTarget::MaterializedView {
+                        table_id: table.get_id(),
+                    }
+                } else {
+                    MaintenanceTarget::Table
+                };
+                let recluster = ReclusterPlan {
+                    catalog: compact_targ
```

**File**: `src/query/service/src/interpreters/hook/refresh_hook.rs` (modified, +40/-114)
```diff
@@ -17,20 +17,14 @@ databend_common_tracing::register_module_tag!("[REFRESH-HOOK]");
 
 use std::sync::Arc;
 
-use databend_common_ast::ast;
 use databend_common_base::runtime::GlobalIORuntime;
-use databend_common_catalog::table::Table;
 use databend_common_exception::Result;
-use databend_common_meta_app::schema::TableIndexType;
 use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
 use databend_common_pipeline::core::always_callback;
-use databend_common_sql::plans::Plan;
-use databend_common_sql::plans::RefreshTableIndexPlan;
+use databend_common_storages_fuse::FuseTable;
 use log::info;
 
-use crate::interpreters::Interpreter;
-use crate::interpreters::RefreshTableIndexInterpreter;
 use crate::interpreters::hook::resolve_current_table_name_by_id;
 use crate::interpreters::hook::table_id_matches_target;
 use crate::interpreters::hook::vacuum_hook::hook_clear_m_cte_temp_table;
@@ -40,7 +34,6 @@ use crate::pipelines::executor::ExecutorSettings;
 use crate::pipelines::executor::PipelineCompleteExecutor;
 use crate::sessions::QueryContext;
 use crate::sessions::TableContext;
-use crate::sessions::TableContextSettings;
 use crate::sessions::TableContextTableAccess;
 use crate::sessions::TableContextTableManagement;
 
@@ -69,14 +62,9 @@ pub async fn hook_refresh(ctx: Arc<QueryContext>, pipeline: &mut Pipeline, desc:
 pub(crate) async fn execute_refresh_hook(ctx: Arc<QueryContext>, desc: RefreshDesc) -> Result<()> {
     info!("Table hook starting refresh job");
     match do_refresh(ctx, desc).await {
-        Ok(_) => {
-            info!("Refresh job completed successfully");
-        }
-        Err(e) => {
-            info!("Refresh job failed: {:?}", e);
-        }
+        Ok(_) => info!("Refresh job completed successfully"),
+        Err(e) => info!("Refresh job failed: {:?}", e),
     }
-
     Ok(())
 }
 
@@ -85,87 +73,58 @@ pub(crate) async fn do_refresh(ctx: Arc<QueryContext>, desc: RefreshDesc) -> Res
         return Ok(());
     };
 
-    if desc.table_id.is_some() {
-        ctx.evict_table_from_cache(&desc.catalog, &desc.database, &desc.table)?;
-        ctx.clear_table_meta_timestamps_cache();
-    }
-
+    // Sync hooks reuse the write context too. Filter accumulated write and
+    // maintenance hints against the post-maintenance snapshot, not a cached one.
+    ctx.evict_table_from_cache(&desc.catalog, &desc.database, &desc.table)?;
     let table = ctx
         .get_table(&desc.catalog, &desc.database, &desc.table)
         .await?;
-    let table_id = table.get_id();
     if !table_id_matches_target(
         "refresh",
         desc.table_id,
-        table_id,
+        table.get_id(),
         &desc.catalog,
         &desc.database,
         &desc.table,
     ) {
         return Ok(());
     }
-
     ctx.clear_table_meta_timestamps_cache();
-
-    let mut plans = Vec::new();
-
-    // Generate sync inverted indexes.
-    let inverted_index_plans = generate_refresh_table_index_plan(ctx.clone(), &desc, table).await?;
-    plans.extend_from_slice(&inverted_index_plans);
-
-    let mut tasks = Vec::with_capacity(std::cmp::min(
-        ctx.get_settings().get_max_threads()? as usize,
-        plans.len(),
-    ));
-
-    for plan in plans {
-        let ctx_cloned = ctx.clone();
-        tasks.push(async move {
-            match plan {
-                Plan::RefreshTableIndex(inverted_index_plan) => {
-                    let refresh_inverted_index_interpreter =
-                        RefreshTableIndexInterpreter::try_create(
-                            ctx_cloned.clone(),
-                            *inverted_index_plan,
-                        )?;
-                    let mut build_res = refresh_inverted_index_interpreter.execute2().await?;
-                    if build_res.main_pipeline.is_empty() {
-                        return Ok(());
-                    }
-
-                    let settings = ctx_cloned.get_settings();
-                    build_res.set_max_threads(settings.get_max_threads()? as usize);
-                    let settings = ExecutorSettings::try_create(ctx_cloned.clone())?;
-
-                    if build_res.main_pipeline.is_complete_pipeline()? {
-                        let query_ctx = ctx_cloned.clone();
-                        build_res.main_pipeline.set_on_finished(always_callback(
-                            move |_info: &ExecutionInfo| {
-                                hook_clear_m_cte_temp_table(&query_ctx)?;
-                                hook_vacuum_temp_files(&query_ctx)?;
-                                hook_disk_temp_dir(&query_ctx)?;
-                                Ok(())
-                            },
-                        ));
-
-                        let mut pipelines = build_res.sources_pipelines;
-                        pipelines.push(build_res.main_pipeline);
-
-                        let complete_executor =
-                            PipelineCompleteExecutor::from_pipelines(pipelin
```

**File**: `src/query/service/src/interpreters/interpreter_table_recluster.rs` (modified, +8/-9)
```diff
@@ -70,7 +70,6 @@ use crate::pipelines::executor::ExecutorSettings;
 use crate::pipelines::executor::PipelineCompleteExecutor;
 use crate::schedulers::build_query_pipeline_without_render_result_set;
 use crate::sessions::QueryContext;
-use crate::sessions::TableContext;
 use crate::sessions::TableContextLicense;
 use crate::sessions::TableContextQueryState;
 use crate::sessions::TableContextSettings;
@@ -303,8 +302,7 @@ impl ReclusterTableInterpreter {
         } = &self.plan;
         // Callers that already own the lifecycle lock (for example, MV refresh) disable segment
         // claims to avoid reacquiring the shared table lock at the commit gate.
-        let mut use_segment_claims =
-            self.allow_segment_claims && settings.get_enable_table_lock()?;
+        let use_segment_claims = self.allow_segment_claims && settings.get_enable_table_lock()?;
 
         // Concurrent planning must evict this cache so the claim set is matched against the
         // latest snapshot.
@@ -314,10 +312,8 @@ impl ReclusterTableInterpreter {
         let mut tbl = self.ctx.get_table(catalog, database, table).await?;
         // Temporary tables are session-local, and their IDs are intentionally unsupported by
         // the segment-claim and lock catalog APIs.
-        if tbl.is_temp() {
-            use_segment_claims = false;
-        }
-        let claim_manager = use_segment_claims.then(CoordinationManager::instance);
+        let claim_manager =
+            (use_segment_claims && !tbl.is_temp()).then(CoordinationManager::instance);
         let mut claim_retries = 0;
         let (parts, snapshot, claim_guard) = loop {
             check_maintenance_target(tbl.as_ref(), &self.plan.target)?;
@@ -380,7 +376,7 @@ impl ReclusterTableInterpreter {
             tbl = self.ctx.get_table(catalog, database, table).await?;
         };
         let mut physical_plan =
-            self.build_linear_plan(tbl.as_ref(), parts, snapshot, use_segment_claims)?;
+            self.build_linear_plan(tbl.as_ref(), parts, snapshot, claim_manager.is_some())?;
         physical_plan.adjust_plan_id(&mut 0);
         let mut build_res =
             build_query_pipeline_without_render_result_set(&self.ctx, &physical_plan).await?;
@@ -392,7 +388,8 @@ impl ReclusterTableInterpreter {
             let table = self.plan.table.clone();
             build_res.main_pipeline.set_on_finished(always_callback(
                 move |info: &ExecutionInfo| {
-                    ctx.written_segment_locations().clear();
+                    // Retain parent-write refresh hints and published output
+                    // locations; index refresh filters out no-longer-live sources.
                     ctx.evict_table_from_cache(&catalog, &database, &table)?;
 
                     ctx.unload_spill_meta();
@@ -512,6 +509,7 @@ impl ReclusterTableInterpreter {
         let ReclusterParts {
             tasks,
             remained_blocks,
+            virtual_schemas,
             removed_segment_indexes,
             removed_segment_summary,
         } = parts;
@@ -546,6 +544,7 @@ impl ReclusterTableInterpreter {
             table_meta_timestamps,
             recluster_info: Some(ReclusterInfoSideCar {
                 merged_blocks: remained_blocks,
+                virtual_schemas,
                 removed_segment_indexes,
                 removed_statistics: removed_segment_summary,
                 acquire_commit_lock,
```

**File**: `src/query/service/src/physical_plans/physical_commit_sink.rs` (modified, +5/-16)
```diff
@@ -30,8 +30,6 @@ use databend_common_storages_fuse::operations::MutationGenerator;
 use databend_common_storages_fuse::operations::TableMutationAggregator;
 use databend_common_storages_fuse::operations::TransformMergeCommitMeta;
 use databend_common_storages_fuse::operations::TruncateGenerator;
-use databend_storages_common_table_meta::meta::BlockHLLState;
-use databend_storages_common_table_meta::meta::ExtendedBlockMeta;
 use databend_storages_common_table_meta::meta::TableMetaTimestamps;
 use databend_storages_common_table_meta::meta::TableSnapshot;
 use databend_storages_common_table_meta::readers::snapshot_reader::TableSnapshotAccessor;
@@ -182,29 +180,20 @@ impl IPhysicalPlan for CommitSink {
                             // extract re-cluster related mutations from physical plan
                             let recluster_info = self.recluster_info.clone().unwrap_or_default();
 
-                            let extended_merged_blocks = recluster_info
-                                .merged_blocks
-                                .into_iter()
-                                .map(|(block_meta, column_hlls)| {
-                                    Arc::new(ExtendedBlockMeta {
-                                        block_meta: Arc::unwrap_or_clone(block_meta),
-                                        draft_virtual_block_meta: None,
-                                        column_hlls: column_hlls.map(BlockHLLState::Serialized),
-                                        column_top_n: None,
-                                    })
-                                })
-                                .collect::<Vec<Arc<ExtendedBlockMeta>>>();
-
                             TableMutationAggregator::create(
                                 table,
                                 builder.ctx.clone(),
                                 base_segments,
-                                extended_merged_blocks,
+                                vec![],
                                 recluster_info.removed_segment_indexes,
                                 recluster_info.removed_statistics,
                                 *kind,
                                 self.table_meta_timestamps,
                             )
+                            .with_retained_blocks(
+                                recluster_info.merged_blocks,
+                                recluster_info.virtual_schemas,
+                            )
                         });
                 }
 
```

**File**: `src/query/service/src/physical_plans/physical_compact_source.rs` (modified, +1/-2)
```diff
@@ -270,8 +270,7 @@ impl PhysicalPlanBuilder {
             meta: PhysicalPlanMeta::new("ConstantTableScan"),
         });
 
-        let is_distributed = (!self.ctx.get_cluster().is_empty())
-            && self.ctx.get_settings().get_enable_distributed_compact()?;
+        let is_distributed = !self.ctx.get_cluster().is_empty();
         if is_distributed {
             root = PhysicalPlan::new(Exchange {
                 input: root,
```

**File**: `src/query/service/src/sessions/query_ctx.rs` (modified, +0/-4)
```diff
@@ -89,7 +89,6 @@ use databend_common_component::FragmentId;
 use databend_common_component::MutationState;
 use databend_common_component::ReadBlockThresholdsState;
 use databend_common_component::ResultCacheState;
-use databend_common_component::SegmentLocationsState;
 use databend_common_config::GlobalConfig;
 use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
@@ -196,8 +195,6 @@ pub struct QueryContext {
     shared: Arc<QueryContextShared>,
     query_settings: Arc<Settings>,
     fragment_id: FragmentId,
-    // Used by synchronized generate aggregating indexes when new data written.
-    written_segment_locs: SegmentLocationsState,
     // Temp table for materialized CTE, first string is the database_name, second string is the table_name
     // All temp tables' catalog is `CATALOG_DEFAULT`, so we don't need to store it.
     m_cte_temp_table: Arc<RwLock<Vec<(String, String)>>>,
@@ -230,7 +227,6 @@ impl QueryContext {
             shared,
             query_settings,
             fragment_id: Default::default(),
-            written_segment_locs: Default::default(),
             read_block_thresholds: Default::default(),
             m_cte_temp_table: Arc::new(RwLock::new(Vec::new())),
         })
```

**File**: `src/query/service/src/sessions/query_ctx/context.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ impl TableContext for QueryContext {
     }
 
     fn written_segment_locations(&self) -> &SegmentLocationsState {
-        &self.written_segment_locs
+        &self.shared.written_segment_locs
     }
 
     fn as_any(&self) -> &dyn Any {
```

---

### Incident Patch 2: `4e2c7131` (2026-11-04)
**Commit Message**: fix(query): skip aggregate work for empty inputs and buckets (#20891)

* fix(query): skip aggregate work for empty inputs and buckets

Distributed aggregation with little or no input paid for allocations that
nothing used:

- Payload::aggregate_flush_all allocated and zeroed a ~136KB
  PayloadFlushState even for empty payloads, and the exchange serializer
  called it once per bucket payload. Return early for empty payloads and
  reuse one flush state in the serializer.
- TransformFinalAggregate created its hash table (32K-slot index) at
  construction and after each spill. Create it on the first non-empty
  input instead.
- TransformPartialAggregate created its hash table while the pipeline was
  built and always emitted a block of per-bucket payloads on finish, even
  when it aggregated nothing. Create the table on the first block and emit
  only spilled payloads when nothing was aggregated.

Also add the release regression query where a spilled final aggregate
feeds a join whose build side is empty; main already handles it via
#20489.

* chore(query): format partial aggregate finish

* chore(query): drop dead lint allow and redundant empty check (fable review round 1)

**File**: `src/query/expression/src/aggregate/payload_flush.rs` (modified, +20/-1)
```diff
@@ -185,10 +185,25 @@ impl PartitionedPayload {
 
 impl Payload {
     pub fn aggregate_flush_all(&self) -> Result<DataBlock> {
+        // A PayloadFlushState is over 100KB, do not allocate one for an empty payload.
+        if self.len() == 0 {
+            return Ok(self.empty_block(0));
+        }
+
         let mut state = PayloadFlushState::default();
+        self.aggregate_flush_all_with_state(&mut state)
+    }
+
+    /// Same as `aggregate_flush_all`, but reuses the caller's flush state, so that
+    /// flushing many payloads does not allocate a new state for each of them.
+    pub fn aggregate_flush_all_with_state(
+        &self,
+        state: &mut PayloadFlushState,
+    ) -> Result<DataBlock> {
+        state.clear();
         let mut blocks = vec![];
 
-        while let Some(block) = self.aggregate_flush(&mut state)? {
+        while let Some(block) = self.aggregate_flush(state)? {
             blocks.push(block);
         }
 
@@ -230,6 +245,10 @@ impl Payload {
     }
 
     pub fn group_by_flush_all(&self) -> Result<DataBlock> {
+        if self.len() == 0 {
+            return Ok(self.empty_block(0));
+        }
+
         let mut state = PayloadFlushState::default();
         let mut blocks = vec![];
 
```

**File**: `src/query/functions/tests/it/aggregates/agg_hashtable.rs` (modified, +75/-0)
```diff
@@ -28,6 +28,7 @@ use databend_common_expression::ProjectedBlock;
 use databend_common_expression::aggregate_function::AggregateCallRef;
 use databend_common_expression::aggregate_function::RawAggregateCall;
 use databend_common_expression::aggregate_function::get_states_layout;
+use databend_common_expression::block_debug::assert_block_value_eq;
 use databend_common_expression::block_debug::assert_block_value_sort_eq;
 use databend_common_expression::types::ArgType;
 use databend_common_expression::types::BooleanType;
@@ -562,3 +563,77 @@ fn test_agg_hashtable_encoded_columns() {
         }
     }
 }
+
+// Flushing a payload with a reused `PayloadFlushState` must produce the same
+// result as flushing it with a fresh state, including for empty payloads.
+#[test]
+fn test_payload_flush_all_with_reused_state() {
+    let aggrs = vec![
+        resolve_agg("sum", Int64Type::data_type()),
+        resolve_agg("count", Int64Type::data_type()),
+    ];
+
+    // (distinct groups, radix bits): the first case has payloads larger than
+    // one flush batch, the second one has mostly empty payloads.
+    for (m, radix_bits) in [(5000_usize, 1_u64), (2, 4)] {
+        let n = m * 2;
+        let group_columns: Vec<BlockEntry> =
+            vec![Int64Type::from_data((0..n).map(|x| (x % m) as i64).collect_vec()).into()];
+        let group_types = group_columns
+            .iter()
+            .map(|c| c.data_type())
+            .collect::<Vec<_>>();
+        let args = vec![group_columns[0].clone()];
+        let params: Vec<ProjectedBlock> = aggrs.iter().map(|_| (&args).into()).collect_vec();
+
+        let config = HashTableConfig::default().with_initial_radix_bits(radix_bits);
+        let mut hashtable = AggregateHashTable::new(
+            group_types.clone(),
+            aggrs.clone(),
+            config,
+            Arc::new(Bump::new()),
+        );
+
+        let mut state = ProbeState::default();
+        hashtable
+            .add_groups(
+                &mut state,
+                (&group_columns).into(),
+                &params,
+                (&[]).into(),
+                n,
+            )
+            .unwrap();
+
+        assert_eq!(hashtable.payload.partition_count(), 1 << radix_bits);
+
+        let mut shared_state = PayloadFlushState::default();
+        let mut total_rows = 0;
+        let mut empty_payloads = 0;
+        for (_, payload) in hashtable.payload.into_bucket_payloads() {
+            let expected = payload.aggregate_flush_all().unwrap();
+            let actual = payload
+                .aggregate_flush_all_with_state(&mut shared_state)
+                .unwrap();
+
+            assert_eq!(expected.num_rows(), payload.len());
+            assert_eq!(actual.num_rows(), payload.len());
+            assert_eq!(expected.num_columns(), group_types.len() + aggrs.len());
+            assert_eq!(actual.num_columns(), expected.num_columns());
+            assert_block_value_eq(&expected, &actual);
+
+            let group_by = payload.group_by_flush_all().unwrap();
+            assert_eq!(group_by.num_rows(), payload.len());
+
+            if payload.len() == 0 {
+                empty_payloads += 1;
+            }
+            total_rows += actual.num_rows();
+        }
+
+        assert_eq!(total_rows, m);
+        if m < (1 << radix_bits) {
+            assert!(empty_payloads > 0);
+        }
+    }
+}
```

**File**: `src/query/service/src/pipelines/processors/transforms/aggregator/serde/aggregate_scatter.rs` (modified, +6/-1)
```diff
@@ -21,6 +21,7 @@ use databend_common_expression::AggregatePayload;
 use databend_common_expression::BlockMetaInfoDowncast;
 use databend_common_expression::DataBlock;
 use databend_common_expression::DataSchemaRef;
+use databend_common_expression::PayloadFlushState;
 use databend_common_expression::ProjectedBlock;
 use databend_common_expression::group_hash_entries;
 use databend_common_expression::group_hash_route_index;
@@ -173,8 +174,12 @@ impl AggregateScatter {
         let mut buckets = Vec::with_capacity(payloads.len());
         let mut row_counts = Vec::with_capacity(payloads.len());
         let mut blocks = Vec::with_capacity(payloads.len());
+        // One flush state (over 100KB) for all payloads instead of one per payload.
+        let mut flush_state = PayloadFlushState::default();
         for payload in payloads {
-            let block = payload.payload.aggregate_flush_all()?;
+            let block = payload
+                .payload
+                .aggregate_flush_all_with_state(&mut flush_state)?;
             if block.num_rows() == 0 {
                 continue;
             }
```

**File**: `src/query/service/src/pipelines/processors/transforms/aggregator/transform_aggregate_final.rs` (modified, +132/-44)
```diff
@@ -56,18 +56,6 @@ use crate::pipelines::processors::transforms::aggregator::statistics::FinalAggre
 use crate::sessions::QueryContext;
 use crate::sessions::TableContextSettings;
 
-#[allow(clippy::enum_variant_names)]
-enum HashTable {
-    MovedOut,
-    AggregateHashTable(AggregateHashTable),
-}
-
-impl Default for HashTable {
-    fn default() -> Self {
-        Self::MovedOut
-    }
-}
-
 const SPILL_BUCKET_NUM: usize = 4;
 const SPILL_BUCKET_BITS: u64 = SPILL_BUCKET_NUM.trailing_zeros() as u64;
 
@@ -102,7 +90,10 @@ pub struct TransformFinalAggregate {
     stage: Stage,
     spilled_occurred: bool,
 
-    hashtable: HashTable,
+    // Created on the first non-empty input. With bucket shuffle there are many final
+    // processors and most of them may never receive rows, so an eagerly allocated
+    // hash table (and its hash index) per processor is pure overhead.
+    hashtable: Option<AggregateHashTable>,
     params: Arc<AggregatorParams>,
     flush_state: PayloadFlushState,
     statistics: AggregationStatistics,
@@ -132,7 +123,6 @@ impl TransformFinalAggregate {
         let max_aggregate_spill_level =
             (settings.get_max_aggregate_spill_level()? as usize).min(max_partition_depth);
 
-        let hashtable = Self::create_hashtable(&params, 0);
         let flush_state = PayloadFlushState::default();
 
         let spiller = AggregateSpiller::try_create(
@@ -156,7 +146,7 @@ impl TransformFinalAggregate {
             output_finished: WatchNotify::new(),
             stage: Stage::Input,
             spilled_occurred: false,
-            hashtable: HashTable::AggregateHashTable(hashtable),
+            hashtable: None,
             params,
             flush_state,
             statistics: AggregationStatistics::new("FinalAggregate"),
@@ -189,11 +179,20 @@ impl TransformFinalAggregate {
         )
     }
 
+    /// Drop the current hash table and switch to `spilled_depth`. The next hash
+    /// table is created by `hashtable_mut` when data arrives.
     fn reset_hashtable(&mut self, spilled_depth: usize) {
-        let partition_depth = spilled_depth.min(self.max_partition_depth);
-        self.hashtable =
-            HashTable::AggregateHashTable(Self::create_hashtable(&self.params, partition_depth));
-        self.current_partition_depth = partition_depth;
+        self.hashtable = None;
+        self.current_partition_depth = spilled_depth.min(self.max_partition_depth);
+    }
+
+    // Takes the fields separately so callers can still borrow `flush_state`.
+    fn hashtable_mut<'a>(
+        hashtable: &'a mut Option<AggregateHashTable>,
+        params: &Arc<AggregatorParams>,
+        partition_depth: usize,
+    ) -> &'a mut AggregateHashTable {
+        hashtable.get_or_insert_with(|| Self::create_hashtable(params, partition_depth))
     }
 
     // One final-aggregate processor handles both the original input stream and
@@ -203,9 +202,7 @@ impl TransformFinalAggregate {
     // `spilled_depth * SPILL_BUCKET_BITS`.
     fn ensure_spill_depth(&mut self, spilled_depth: usize) {
         let partition_depth = spilled_depth.min(self.max_partition_depth);
-        if !matches!(&self.hashtable, HashTable::AggregateHashTable(_))
-            || self.current_partition_depth != partition_depth
-        {
+        if self.current_partition_depth != partition_depth {
             self.reset_hashtable(spilled_depth);
         }
     }
@@ -231,7 +228,12 @@ impl TransformFinalAggregate {
         let rows = block.num_rows();
         self.statistics.record_block(rows, block.memory_size());
 
-        if let HashTable::AggregateHashTable(ht) = &mut self.hashtable {
+        if rows != 0 {
+            let ht = Self::hashtable_mut(
+                &mut self.hashtable,
+                &self.params,
+                self.current_partition_depth,
+            );
             let group_columns = ProjectedBlock::project(&self.params.group_columns, &block);
             let params = self
                 .params
@@ -253,9 +255,12 @@ impl TransformFinalAggregate {
             Arc::new(Bump::new()),
         )?;
 
-        if let HashTable::AggregateHashTable(ht) = &mut self.hashtable {
-            ht.combine_payloads(&partitioned_payload, &mut self.flush_state)?;
-        }
+        let ht = Self::hashtable_mut(
+            &mut self.hashtable,
+            &self.params,
+            self.current_partition_depth,
+        );
+        ht.combine_payloads(&partitioned_payload, &mut self.flush_state)?;
 
         Ok(())
     }
@@ -269,7 +274,12 @@ impl TransformFinalAggregate {
         let bytes = payload.payload.memory_size();
         self.statistics.record_block(rows, bytes);
 
-        if let HashTable::AggregateHashTable(ht) = &mut self.hashtable {
+        if rows != 0 {
+            let ht = Self::hashtable_mut(
+                &mut self.hashtable,
+                &self.params,
+                self.current_partition_depth,
+            );
             ht.combine_payload(&payload.paylo
```

**File**: `src/query/service/src/pipelines/processors/transforms/aggregator/transform_aggregate_partial.rs` (modified, +116/-22)
```diff
@@ -66,8 +66,11 @@ pub fn parse_partial_aggregate_mode(mode: &str) -> Result<PartialAggregateMode>
 /// input blocks are forwarded unchanged as raw rows for the final aggregate to aggregate. The
 /// partial aggregate never spills: the state bounds the table and the final aggregate spills.
 pub struct TransformPartialAggregate {
-    /// Taken out when the input ends.
+    /// Created on the first rows to aggregate, so that the processors of a scan pruned to zero
+    /// rows (or in bypass) do not each pay for a table while the pipeline is being built. Taken
+    /// out when the input ends.
     table: Option<AggregateHashTable>,
+    config: HashTableConfig,
     probe_state: ProbeState,
     params: Arc<AggregatorParams>,
     statistics: AggregationStatistics,
@@ -116,18 +119,12 @@ impl TransformPartialAggregate {
         mode: PartialAggregateMode,
         max_table_bytes: usize,
     ) -> Result<Box<dyn Processor>> {
-        let table = AggregateHashTable::new(
-            params.group_data_types.clone(),
-            params.aggregate_functions.clone(),
-            config,
-            Arc::new(Bump::new()),
-        );
-
         Ok(AccumulatingTransformer::create(
             input,
             output,
             TransformPartialAggregate {
-                table: Some(table),
+                table: None,
+                config,
                 probe_state: ProbeState::default(),
                 settings: MemorySettings::from_aggregate_settings(&ctx)?,
                 statistics: AggregationStatistics::new("PartialAggregate"),
@@ -189,9 +186,15 @@ impl TransformPartialAggregate {
         let group_columns = ProjectedBlock::project(&self.params.group_columns, block);
         let params_columns =
             Self::aggregate_arguments(block, &self.params.aggregate_functions_arguments);
-        let Some(table) = self.table.as_mut() else {
-            unreachable!("[TRANSFORM-AGGREGATOR] Partial table already taken")
-        };
+        let (params, config) = (&self.params, &self.config);
+        let table = self.table.get_or_insert_with(|| {
+            AggregateHashTable::new(
+                params.group_data_types.clone(),
+                params.aggregate_functions.clone(),
+                config.clone(),
+                Arc::new(Bump::new()),
+            )
+        });
         let capacity = self.state.capacity();
         let stats = self.memory.track(|| {
             table.add_groups_partial(
@@ -289,13 +292,13 @@ impl AccumulatingTransform for TransformPartialAggregate {
     }
 
     fn on_finish(&mut self, output: bool) -> Result<Vec<DataBlock>> {
-        let Some(table) = self.table.take() else {
-            return Ok(vec![]);
-        };
-        self.statistics.log_partial_finish_statistics(
-            self.output_rows + table.len(),
-            table.hash_index_resize_count(),
-        );
+        // No table means no rows were aggregated: they were bypassed, or there were none.
+        let table = self.table.take();
+        let (table_rows, hash_index_resizes) = table.as_ref().map_or((0, 0), |table| {
+            (table.len(), table.hash_index_resize_count())
+        });
+        self.statistics
+            .log_partial_finish_statistics(self.output_rows + table_rows, hash_index_resizes);
         let total = &self.total;
         log::info!(
             "[PartialAggregate] Adaptive: final_state={:?}, rows={}, new_groups={}, windows={}, emits={:?}, group_bytes={}",
@@ -306,9 +309,100 @@ impl AccumulatingTransform for TransformPartialAggregate {
             self.emits,
             Self::group_bytes(&self.memory, total),
         );
-        if !output {
-            return Ok(vec![]);
+        match table {
+            Some(table) if output => Ok(self.emit(table.payload)),
+            _ => Ok(vec![]),
         }
-        Ok(self.emit(table.payload))
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use databend_common_expression::BlockMetaInfoDowncast;
+    use databend_common_expression::DataField;
+    use databend_common_expression::DataSchema;
+    use databend_common_expression::FromData;
+    use databend_common_expression::types::DataType;
+    use databend_common_expression::types::NumberDataType;
+    use databend_common_expression::types::UInt64Type;
+
+    use super::*;
+    use crate::test_kits::TestFixture;
+
+    // Boxed like in the pipeline: the probe state alone is about 100KB, too large to
+    // keep several transforms in the test future on the test thread's stack.
+    fn create_transform(ctx: &Arc<QueryContext>) -> Result<Box<TransformPartialAggregate>> {
+        let key_type = DataType::Number(NumberDataType::UInt64);
+        let params = AggregatorParams::try_create(
+            Arc::new(DataSchema::new(vec![DataField::new(
+                "key",
+                key_type.clone(),
+            )])),
+            vec![key_type],
+            &[0],
+            &[],
+            &[],
+            false,
+            1024,
+   
```

**File**: `tests/sqllogictests/suites/query/aggregate.test` (modified, +36/-0)
```diff
@@ -330,6 +330,42 @@ select count(*) from (select number from numbers(2000000) group by number);
 ----
 2000000
 
+## Most buckets are empty: only a few groups, or no input rows at all
+query II
+select number % 3 as k, sum(number) from numbers_mt(10000) group by k order by k;
+----
+0 16668333
+1 16661667
+2 16665000
+
+query I
+select count(*) from (select number % 7 as k, sum(number) from numbers_mt(10000) where number > 100000 group by k);
+----
+0
+
+statement ok
+set force_aggregate_data_spill = 1;
+
+query II
+select number % 3 as k, sum(number) from numbers_mt(10000) group by k order by k;
+----
+0 16668333
+1 16661667
+2 16665000
+
+query I
+select count(*) from (select number % 7 as k, sum(number) from numbers_mt(10000) where number > 100000 group by k);
+----
+0
+
+## Spilled final-aggregate tasks whose consumer finishes early (the other join side is empty) must not hang
+query II
+select a.k, count(*) from (select number % 4 as k from numbers_mt(1000) group by k) a join (select number % 4 as k from numbers_mt(2000) where number > 5000 group by k) b on a.k = b.k group by a.k order by a.k;
+----
+
+statement ok
+unset force_aggregate_data_spill;
+
 
 ## Aggregation without Exchange source
 query III
```

---

### Incident Patch 3: `75a200a3` (2026-11-04)
**Commit Message**: fix(storage): publish snapshot hints only after transaction commit (#20827)

* fix(storage): publish snapshot hints only after transaction commit

* test(storage): deduplicate transaction snapshot hint coverage

* fix(query): defer temporary metadata updates on commit conflicts

**File**: `src/query/service/src/catalogs/default/session_catalog.rs` (modified, +8/-3)
```diff
@@ -606,9 +606,14 @@ impl Catalog for SessionCatalog {
                         .retryable_update_multi_table_meta(tenant, req)
                         .await?
                 };
-                self.temp_tbl_mgr
-                    .lock()
-                    .update_multi_table_meta(update_temp_tables);
+                // An OCC conflict is an inner Err, not a successful commit.
+                // Keep temporary tables unchanged until persistent updates succeed;
+                // otherwise a failed retry can partially commit a mixed transaction.
+                if reply.is_ok() {
+                    self.temp_tbl_mgr
+                        .lock()
+                        .update_multi_table_meta(update_temp_tables);
+                }
                 Ok(reply)
             }
             TxnState::Active => {
```

**File**: `src/query/service/tests/it/storages/fuse/operations/mod.rs` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ mod purge_drop;
 mod read_plan;
 mod replace_into;
 mod scan_progress;
+mod snapshot_hint;
 mod table_analyze;
 mod truncate;
 mod virtual_column_pruner_reader;
```

**File**: `src/query/service/tests/it/storages/fuse/operations/snapshot_hint.rs` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+// Copyright 2021 Datafuse Labs.
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
+use std::sync::Arc;
+
+use databend_common_catalog::session_type::SessionType;
+use databend_common_catalog::table::Table;
+use databend_common_storages_fuse::FuseTable;
+use databend_common_storages_fuse::operations::load_last_snapshot_hint;
+use databend_common_version::BUILD_INFO;
+use databend_query::sessions::Session;
+use databend_query::sessions::TableContextTableAccess;
+use databend_query::test_kits::ConfigBuilder;
+use databend_query::test_kits::OSSSetup;
+use databend_query::test_kits::TestFixture;
+use futures::TryStreamExt;
+
+// Single-session behavior is covered by txn_snapshot_hint.test. These tests
+// control concurrent writers to exercise successful and failed commit retries.
+async fn execute(session: &Arc<Session>, sql: &str) -> anyhow::Result<()> {
+    let ctx = session.create_query_context(&BUILD_INFO).await?;
+    TestFixture::execute_query_with_ctx(ctx, sql)
+        .await?
+        .try_collect::<Vec<_>>()
+        .await?;
+    Ok(())
+}
+
+async fn table(fixture: &TestFixture, name: &str) -> anyhow::Result<FuseTable> {
+    let ctx = fixture.new_query_ctx().await?;
+    let table = ctx
+        .get_table("default", &fixture.default_db_name(), name)
+        .await?;
+    Ok(FuseTable::try_from_table(table.as_ref())?.clone())
+}
+
+async fn ids(fixture: &TestFixture, name: &str) -> anyhow::Result<Vec<String>> {
+    let blocks = fixture
+        .execute_query(&format!(
+            "SELECT id FROM {}.{name} ORDER BY id",
+            fixture.default_db_name()
+        ))
+        .await?
+        .try_collect::<Vec<_>>()
+        .await?;
+    let mut result = Vec::new();
+    for block in blocks {
+        for row in 0..block.num_rows() {
+            result.push(
+                block
+                    .get_by_offset(0)
+                    .value()
+                    .index(row)
+                    .unwrap()
+                    .to_string(),
+            );
+        }
+    }
+    Ok(result)
+}
+
+fn snapshot_path(table: &FuseTable) -> String {
+    format!(
+        "{}{}",
+        table.get_operator().info().root(),
+        table.snapshot_loc().unwrap()
+    )
+}
+
+async fn hint(table: &FuseTable) -> anyhow::Result<Option<String>> {
+    Ok(load_last_snapshot_hint(
+        table.meta_location_generator().prefix(),
+        &table.get_operator(),
+    )
+    .await?
+    .map(|hint| hint.snapshot_full_path))
+}
+
+async fn setup() -> anyhow::Result<TestFixture> {
+    // Temporary tables require a client session rather than SessionType::Dummy.
+    let fixture = TestFixture::setup_with_custom_and_session_type(
+        OSSSetup {
+            config: ConfigBuilder::create().config(),
+        },
+        SessionType::MySQL,
+    )
+    .await?;
+    fixture.create_default_database().await?;
+    fixture
+        .execute_command("SET auto_compaction_imperfect_blocks_threshold=0")
+        .await?;
+    fixture.execute_command("SET enable_auto_analyze=0").await?;
+    Ok(fixture)
+}
+
+#[tokio::test(flavor = "multi_thread")]
+async fn test_transaction_snapshot_hints_after_retry() -> anyhow::Result<()> {
+    let fixture = setup().await?;
+    let db = fixture.default_db_name();
+    let writer = fixture.new_session_with_type(SessionType::Dummy).await?;
+    let names = ["hint_retry_a", "hint_retry_b"];
+    for name in names {
+        fixture
+            .execute_command(&format!("CREATE TABLE {db}.{name}(id INT, v INT)"))
+            .await?;
+        fixture
+            .execute_command(&format!("INSERT INTO {db}.{name} VALUES (1,10)"))
+            .await?;
+    }
+    let temp = "hint_retry_temp";
+    fixture
+        .execute_command(&format!("CREATE TEMP TABLE {db}.{temp}(id INT)"))
+        .await?;
+    fixture
+        .execute_command(&format!("INSERT INTO {db}.{temp} VALUES (0)"))
+        .await?;
+    let before = table(&fixture, temp).await?;
+    assert_eq!(hint(&before).await?, Some(snapshot_path(&before)));
+
+    fixture.execute_command("BEGIN").await?;
+    fixture
+        .execute_command(&format!("INSERT INTO {db}.{temp} VALUES (1)"))
+        .await?;
+    let temp_buffered = table(&fixture, temp).await?;
+    assert_ne!(temp_buffered.snapshot_loc(), before.snapshot_loc());
+    assert_eq!(hint(&before).await?, Some(snapshot_path(&before)));
+    fixture
+        .execute_command(&format!(
+            "INSERT ALL INTO {db
```

**File**: `src/query/storages/fuse/src/operations/snapshot_hint.rs` (modified, +6/-0)
```diff
@@ -143,6 +143,12 @@ impl SnapshotHintWriter<'_> {
         table_meta: &TableMeta,
     ) {
         let ctx = &self.ctx;
+        // Attached tables trust this hint without consulting the catalog. Do not
+        // expose a buffered snapshot; COMMIT publishes the final snapshot after
+        // the metadata update succeeds (and has switched to auto-commit mode).
+        if ctx.txn_mgr().lock().is_active() {
+            return;
+        }
         if let Ok(false) = ctx.get_settings().get_enable_last_snapshot_location_hint() {
             info!(
                 "Write last_snapshot_location_hint disabled. Snapshot {}",
```

**File**: `src/query/storages/fuse/src/retry/commit.rs` (modified, +58/-0)
```diff
@@ -34,6 +34,7 @@ use databend_storages_common_table_meta::meta::Versioned;
 use databend_storages_common_table_meta::readers::snapshot_reader::TableSnapshotAccessor;
 use databend_storages_common_table_meta::table::is_fuse_backed_engine;
 use log::info;
+use log::warn;
 use tokio::time::sleep;
 
 use super::diff::SegmentsDiff;
@@ -66,6 +67,9 @@ pub async fn commit_with_backoff(
             .retryable_update_multi_table_meta(tenant, req.clone())
             .await?;
         let Err(update_failed_tbls) = ret else {
+            // Retries can replace the buffered snapshots with merged snapshots.
+            // Publish only the locations in the request that actually committed.
+            write_snapshot_hints(ctx.as_ref(), &req).await;
             return Ok(());
         };
         let Some(duration) = backoff.next_backoff() else {
@@ -89,6 +93,60 @@ pub async fn commit_with_backoff(
     }
 }
 
+// Like the hint write itself, operator initialization is best effort: metadata
+// has already committed, so a hint failure must not turn COMMIT into an error.
+async fn write_snapshot_hints(ctx: &dyn TableContext, req: &UpdateMultiTableMetaReq) {
+    let storage_class = match ctx.get_settings().get_s3_storage_class() {
+        Ok(storage_class) => storage_class,
+        Err(e) => {
+            warn!("Failed to initialize transaction snapshot hints: {e}");
+            return;
+        }
+    };
+    let tables = req
+        .update_table_metas
+        .iter()
+        .map(|(update, info)| {
+            (
+                update.table_id,
+                info.ident.seq,
+                &update.new_table_meta,
+                info.desc.as_str(),
+            )
+        })
+        .chain(req.update_temp_tables.iter().map(|update| {
+            (
+                update.table_id,
+                0,
+                &update.new_table_meta,
+                update.desc.as_str(),
+            )
+        }));
+    for (table_id, seq, meta, desc) in tables {
+        if !is_fuse_backed_engine(&meta.engine) {
+            continue;
+        }
+        let table =
+            match FuseTable::from_table_meta(table_id, seq, meta.clone(), storage_class, desc) {
+                Ok(table) => table,
+                Err(e) => {
+                    warn!("Failed to initialize snapshot hint for table {table_id}: {e}");
+                    continue;
+                }
+            };
+        if let Some(location) = table.snapshot_loc() {
+            FuseTable::write_last_snapshot_hint(
+                ctx,
+                &table.get_operator(),
+                table.meta_location_generator(),
+                &location,
+                meta,
+            )
+            .await;
+        }
+    }
+}
+
 async fn compute_table_segments_diffs(
     ctx: Arc<dyn TableContext>,
     req: &UpdateMultiTableMetaReq,
```

**File**: `tests/sqllogictests/suites/http_handler/transaction/txn_snapshot_hint.test` (added, +228/-0)
```diff
@@ -0,0 +1,228 @@
+# Regression for #20752. Inspect the same storage hint used by ATTACH TABLE,
+# without requiring an enterprise license to attach the table. The dedicated
+# fs prefix follows txn_ext.test; clear it so repeated runs see only this table.
+statement ok
+create or replace database txn_snapshot_hint;
+
+statement ok
+use txn_snapshot_hint;
+
+statement ok
+set auto_compaction_imperfect_blocks_threshold=0;
+
+statement ok
+set enable_auto_analyze=0;
+
+statement ok
+create or replace stage txn_hint_stage url='fs:///tmp/http_handler_txn_snapshot_hint/persistent/';
+
+statement ok
+remove @txn_hint_stage;
+
+statement ok
+create table t(id int, v int) 'fs:///tmp/http_handler_txn_snapshot_hint/persistent/';
+
+# A table's first snapshot must not create a hint until COMMIT.
+statement ok
+begin;
+
+statement ok
+insert into t values (1,10);
+
+query I
+select count(*) from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+----
+0
+
+statement ok
+rollback;
+
+query I
+select count(*) from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+----
+0
+
+statement ok
+begin;
+
+statement ok
+insert into t values (1,10);
+
+statement ok
+commit;
+
+statement ok
+create temp table hint_before as select $1:snapshot_full_path::string as path from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+
+statement ok
+begin;
+
+statement ok
+delete from t where id=1;
+
+# The source sees its own DELETE, but the published hint must not change.
+query I
+select count(*) from t;
+----
+0
+
+statement ok
+insert into t values (1,10),(2,20);
+
+statement ok
+update t set v=-1 where id=1;
+
+statement ok
+replace into t on (id) values (1,-2),(5,50);
+
+query B
+select $1:snapshot_full_path::string = (select path from hint_before) from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+----
+1
+
+statement ok
+rollback;
+
+query II
+select * from t;
+----
+1 10
+
+query B
+select $1:snapshot_full_path::string = (select path from hint_before) from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+----
+1
+
+# Multiple statements must publish only the final snapshot on COMMIT.
+statement ok
+begin;
+
+statement ok
+insert into t values (2,20);
+
+statement ok
+update t set v=11 where id=1;
+
+query B
+select $1:snapshot_full_path::string = (select path from hint_before) from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+----
+1
+
+statement ok
+commit;
+
+query II
+select * from t order by id;
+----
+1 11
+2 20
+
+query B
+select right($1:snapshot_full_path::string, length(s.snapshot_location)) = s.snapshot_location
+from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson')
+cross join (select snapshot_location from fuse_snapshot('txn_snapshot_hint','t') limit 1) s;
+----
+1
+
+query B
+select $1:snapshot_full_path::string != (select path from hint_before) from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson');
+----
+1
+
+# COMMIT must still honor the setting that disables hint writes.
+statement ok
+set enable_last_snapshot_location_hint=0;
+
+statement ok
+begin;
+
+statement ok
+insert into t values (3,30);
+
+statement ok
+commit;
+
+query B
+select right($1:snapshot_full_path::string, length(s.snapshot_location)) = s.snapshot_location
+from @txn_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson')
+cross join (select snapshot_location from fuse_snapshot('txn_snapshot_hint','t') limit 1) s;
+----
+0
+
+statement ok
+set enable_last_snapshot_location_hint=1;
+
+# Temporary tables use a separate metadata-update list at COMMIT.
+statement ok
+create or replace stage txn_temp_hint_stage url='fs:///tmp/http_handler_txn_snapshot_hint/temporary/';
+
+statement ok
+remove @txn_temp_hint_stage;
+
+statement ok
+create temp table tt(id int) 'fs:///tmp/http_handler_txn_snapshot_hint/temporary/';
+
+statement ok
+insert into tt values (1);
+
+statement ok
+begin;
+
+statement ok
+insert into tt values (2);
+
+query B
+select right($1:snapshot_full_path::string, length(s.snapshot_location)) = s.snapshot_location
+from @txn_temp_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson')
+cross join (select snapshot_location from fuse_snapshot('txn_snapshot_hint','tt') limit 1) s;
+----
+0
+
+statement ok
+rollback;
+
+query B
+select right($1:snapshot_full_path::string, length(s.snapshot_location)) = s.snapshot_location
+from @txn_temp_hint_stage (pattern=>'.*last_snapshot_location_hint_v2', file_format=>'ndjson')
+cross join (select snapshot_location from fuse_snapshot('txn_snapshot_hint','tt') limit 1) s;
+----
+1
+
+statement ok
+begin;
+
+statement ok
+insert into tt values (2);
+
+statement ok
+commit;
+
+query B
+select right($1:snapshot_full_path::string, length(s.snapshot_location)) = s.sna
```

#### Recent Merged Pull Requests:
- **PR #20967** (2026-11-04): feat(query): support runtime TopN pruning across UNION ALL (@zhang2014)
- **PR #20965** (2026-11-04): ci: use $1 for the capture group in ClickBench Q28 (@KKould)
- **PR #20964** (2026-11-04): feat(query): prune runtime TopN by the first of several sort keys (@KKould)
- **PR #20962** (2026-11-04): feat(query): prune group items computed from group items and constants (@KKould)
- **PR #20955** (closed): fix(query): evaluate stream status in private task conditions (@KKould)
- **PR #20954** (closed): feat(storage): prune segments using learned snapshot layouts (@KKould)

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

## X. storage): prevent incomplete index refresh after writes (#20909)

**RULE**:
When implementing operations in `src/query/catalog/src/plan/partition.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6454b150`: storage): prevent incomplete index refresh after writes (#20909). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/catalog/src/plan/partition.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use databend_storages_common_table_meta::meta::BlockTopN;
use databend_storages_common_table_meta::meta::VirtualSegmentSchema;
            Ok(json) => f.write_str(&json),
            Err(cause) => f
                .debug_struct("PartInfo")
                .field("serialization_error", &cause)
                .finish(),
/// A surviving block keeps its segment-local virtual-column interpretation
/// and per-block statistics when maintenance replaces the containing segment.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RetainedBlockMeta {
    pub block_meta: Arc<BlockMeta>,
    pub hll: Option<RawBlockHLL>,
    pub top_n: Option<BlockTopN>,
    /// Local index into the enclosing container's `virtual_schemas`.
    pub virtual_schema_index: usize,
}
    pub remained_blocks: Vec<RetainedBlockMeta>,
    pub virtual_schemas: Vec<Option<Arc<VirtualSegmentSchema>>>,
    pub merged_blocks: Vec<RetainedBlockMeta>,
    pub virtual_schemas: Vec<Option<Arc<VirtualSegmentSchema>>>,
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            Ok(str) => write!(f, "{}", str),
            Err(_cause) => Err(std::fmt::Error {}),
pub type BlockMetaWithHLL = (Arc<BlockMeta>, Option<RawBlockHLL>);
    pub remained_blocks: Vec<BlockMetaWithHLL>,
    pub merged_blocks: Vec<BlockMetaWithHLL>,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6454b150` are properly handled with clean fallback behavior.
