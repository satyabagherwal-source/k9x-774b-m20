> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `c930abe2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T22:21:03.332Z  
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
> **Harvest Timestamp**: 2026-11-12T22:21:03.304Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9493 stars

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
- **Issue #21074** (2026-11-12): **fix(sqllogictest): stop the runner from panicking on a multi-byte comment**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  The sqllogictest runner panicked while scanning a test file, before running anything, when a comment had a multi-byte character at byte 18. `parse_settings_directives` compared the first 18 bytes of every comment against the `run-with-settings:` directive with `comment[..18]`, which is not a char boundary for text like a commented-out `explain` result containing box-drawing characters. The abort took every later file in the suite with it.  The prefix is now taken through `str::get`, which returns `None` for a non-boundary index, so a comment like `#── ── ── ── ── ──` is simply not a directive.  Proof: a unit test with that exact comment fails with the old slice (`end byte index 18 is not a char boundary`) and passes now. I also ran the issue's repro through the built binary:  ``` $ printf 'statement ok\nselect 1\n\n#── ── ── ── ── ──\n' > /tmp/slt_repro/x/repro.test $ ./target/debug/databend-sqllogictests --handlers http --suites /tmp/slt_repro --run_dir x Summary: ✅ Passed, 2 test(s) across 1 file(s) completed in 214 ms. ```  fixes: #20725  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [x] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work as exp

- **Issue #21071** (2026-11-12): **fix(query): remove vector bundle component size cap**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - Vector bundle components were capped at 1 GiB (`MAX_COMPONENT_SIZE`), so a 768-dim refined block failed at write time above ~699k rows (~350k at 1536-dim), well below the legal `ROW_PER_BLOCK = 1000000`, and only after the whole block had been built. - Remove the component size cap on both the write and read paths. Component sizes are bounded by the table's block size. The decoded size used for the decompression buffer comes from the footer, which is CRC32-verified when read from object storage and from the disk cache, and the decoded length and checksum are still verified after decoding. - `VectorBundleFooter::validate` now rejects plain components whose `raw_length` differs from `length`. - Tests: the existing `test_footer_validation` gains a case for the plain length mismatch  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [x] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work as expected) - [ ] Documentation Update - [ ] Refactoring - [ ] Performance Improvement - [ ] Other (please describe):  ## AI assistance  - AI usage: An AI coding agent analyzed the vector bundle size checks, implemented the codec-scoped bound

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

### Incident Patch 1: `652b12b4` (2026-11-11)
**Commit Message**: fix(query): keep the shared executor alive on processor panics (#21065)

* fix(query): keep the shared executor alive on a foreign worker id

A fuse source passes its index among the sources as the worker id of its waker. With max_storage_io_requests above the worker count of the shared executor, completed_async_task indexed out of bounds, the panic finished the executor, and every later query hung in 'Executing pipeline'.

The worker id is now taken modulo the worker count, as the per-query executor already does.

* fix(query): contain an event panic to its query on the shared executor

- Processor::event runs in schedule_queue, outside of the per-task catch_unwind: its panic finished the executor of all the queries. It now fails its own query only, as a panic of process does.
- A graph sent to a finished executor was queued with no worker left to run it, so the query hung. send_graph now returns the error of the executor.

* fix(query): contain the panics of the first event and of async tasks

- The first Processor::event of a graph runs in send_graph, on the thread of the query: a panic unwound that thread instead of failing the query. send_graph now returns it as an error.
- sc

**File**: `src/query/service/src/pipelines/executor/queries_executor_tasks.rs` (modified, +4/-1)
```diff
@@ -208,7 +208,10 @@ impl QueriesExecutorTasksQueue {
 
     pub fn completed_async_task(&self, condvar: Arc<WorkersCondvar>, task: CompletedAsyncTask) {
         let mut workers_tasks = self.workers_tasks.lock();
-        let mut worker_id = task.worker_id;
+        // The worker id of a waker is not always the id of a worker of this
+        // executor, e.g. a fuse source passes its index among the sources.
+        let workers = workers_tasks.workers_waiting_status.total_size();
+        let mut worker_id = task.worker_id % workers;
         workers_tasks.current_tasks.tasks_size += 1;
         workers_tasks.current_tasks.workers_completed_async_tasks[worker_id].push_back(task);
 
```

**File**: `src/query/service/src/pipelines/executor/queries_pipeline_executor.rs` (modified, +33/-20)
```diff
@@ -94,11 +94,22 @@ impl QueriesPipelineExecutor {
     }
 
     pub fn send_graph(self: &Arc<Self>, graph: Arc<RunningGraph>) -> Result<()> {
+        // No worker is left to run the graph: fail the query instead of
+        // leaving it in the queue forever.
+        if self.is_finished() {
+            let cause = self.finished_error.lock().clone();
+            return Err(cause
+                .unwrap_or_else(|| ErrorCode::Internal("The queries executor has been finished")));
+        }
+
         // Bind waker
         self.bind_waker_for_graph(&graph);
 
         unsafe {
-            let mut init_schedule_queue = graph.init_schedule_queue(self.threads_num)?;
+            // It runs `Processor::event` on the thread of the query: a panic must
+            // fail the query, not unwind a thread that nobody waits for.
+            let mut init_schedule_queue =
+                catch_unwind(|| graph.clone().init_schedule_queue(self.threads_num)).flatten()?;
 
             let async_queue = std::mem::take(&mut init_schedule_queue.async_queue);
             self.global_tasks_queue
@@ -221,25 +232,27 @@ impl QueriesPipelineExecutor {
                                         && !graph.is_should_finish()
                                     {
                                         // We immediately schedule the processor again.
-                                        let schedule_queue_res =
-                                            graph.clone().schedule_queue(executed_pid);
-                                        match schedule_queue_res {
-                                            Ok(schedule_queue) => {
-                                                schedule_queue.schedule_with_condition(
-                                                    &self.global_tasks_queue,
-                                                    &mut context,
-                                                    self,
-                                                );
-                                            }
-                                            Err(cause) => {
-                                                graph.record_node_error(
-                                                    executed_pid,
-                                                    NodeErrorType::ScheduleEventError(
-                                                        cause.clone(),
-                                                    ),
-                                                );
-                                                graph.should_finish(Err(cause))?;
-                                            }
+                                        // It runs `Processor::event` and creates the
+                                        // async tasks: a panic of them must only fail
+                                        // its query, as one of `process` does, not
+                                        // finish the executor.
+                                        let schedule_res = catch_unwind(|| {
+                                            let schedule_queue =
+                                                graph.clone().schedule_queue(executed_pid)?;
+                                            schedule_queue.schedule_with_condition(
+                                                &self.global_tasks_queue,
+                                                &mut context,
+                                                self,
+                                            );
+                                            Ok(())
+                                        })
+                                        .flatten();
+                                        if let Err(cause) = schedule_res {
+                                            graph.record_node_error(
+                                                executed_pid,
+                                                NodeErrorType::ScheduleEventError(cause.clone()),
+                                            );
+                                            graph.should_finish(Err(cause))?;
                                         }
                                     }
                                     if graph.is_all_nodes_finished() {
```

**File**: `src/query/service/tests/it/pipelines/executor/executor_graph.rs` (modified, +140/-0)
```diff
@@ -35,9 +35,12 @@ use databend_common_pipeline::core::check_interrupt;
 use databend_common_pipeline::sinks::SyncSenderSink;
 use databend_common_pipeline::sources::BlocksSource;
 use databend_common_pipeline_transforms::processors::TransformDummy;
+use databend_query::pipelines::executor::CompletedAsyncTask;
 use databend_query::pipelines::executor::ExecutorSettings;
 use databend_query::pipelines::executor::ExecutorTask;
 use databend_query::pipelines::executor::ExecutorWorkerContext;
+use databend_query::pipelines::executor::QueriesExecutorTasksQueue;
+use databend_query::pipelines::executor::QueriesPipelineExecutor;
 use databend_query::pipelines::executor::QueryPipelineExecutor;
 use databend_query::pipelines::executor::RunningGraph;
 use databend_query::pipelines::executor::WorkersCondvar;
@@ -189,6 +192,111 @@ async fn test_resize_pipeline_init_queue() -> anyhow::Result<()> {
     Ok(())
 }
 
+/// A waker may carry a worker id that is not one of the shared executor's, as
+/// the fuse sources do with `max_storage_io_requests` above the worker count.
+/// It must not panic: a panic finishes the executor of all the queries.
+#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+async fn test_queries_executor_completed_async_task_of_foreign_worker() -> anyhow::Result<()> {
+    let fixture = TestFixture::setup().await?;
+    let ctx = fixture.new_query_ctx().await?;
+    let graph = create_simple_pipeline(ctx)?;
+
+    let workers = 2;
+    let condvar = WorkersCondvar::create(workers);
+    let queue = QueriesExecutorTasksQueue::create(workers);
+    for worker_id in [workers, 2 * workers + 1] {
+        condvar.inc_active_async_worker();
+        queue.completed_async_task(
+            condvar.clone(),
+            CompletedAsyncTask::create(NodeIndex::new(0), worker_id, Ok(()), graph.clone()),
+        );
+    }
+    assert!(!condvar.has_waiting_async_task());
+
+    // Both tasks are still handed to the workers of the executor.
+    let executor = QueriesPipelineExecutor::create(workers)?;
+    let mut received = vec![];
+    for _ in 0..16 {
+        let mut context = ExecutorWorkerContext::create(0, condvar.clone());
+        queue.steal_task_to_context(&mut context, &executor);
+        if let ExecutorTask::AsyncCompleted(task) = context.take_task() {
+            received.push(task.worker_id);
+        }
+        if received.len() == 2 {
+            break;
+        }
+    }
+    received.sort();
+    assert_eq!(received, vec![workers, 2 * workers + 1]);
+
+    Ok(())
+}
+
+/// A processor whose `event` panics fails its own query only: the shared
+/// executor keeps its workers, and runs the next query.
+#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+async fn test_queries_executor_survives_event_panic() -> anyhow::Result<()> {
+    let _fixture = TestFixture::setup().await?;
+
+    type Finished = Arc<(parking_lot::Mutex<bool>, parking_lot::Condvar)>;
+    let create_graph = |panic_event: Option<usize>| -> Result<(Arc<RunningGraph>, Finished)> {
+        let mut pipeline = Pipeline::create();
+        pipeline.add_pipe(Pipe::create(0, 1, vec![PipeItem::create(
+            ProcessorPtr::create(Box::new(SecondEventSource {
+                events: 0,
+                panic_event,
+            })),
+            vec![],
+            vec![OutputPort::create()],
+        )]));
+        let finished = Finished::default();
+        let query_id = Arc::new(format!("test-event-panic-{panic_event:?}"));
+        let graph = RunningGraph::create(pipeline, 1, query_id, Some(finished.clone()), vec![])?;
+        Ok((graph, finished))
+    };
+    let wait = |finished: &Finished| {
+        let (lock, cvar) = &**finished;
+        let mut finished = lock.lock();
+        if !*finished {
+            cvar.wait_for(&mut finished, std::time::Duration::from_secs(10));
+        }
+        *finished
+    };
+
+    let executor = QueriesPipelineExecutor::create(1)?;
+    let workers = databend_common_base::runtime::Thread::spawn({
+        let executor = executor.clone();
+        move || executor.execute()
+    });
+
+    // The first event runs when the graph is sent, the next ones on a worker.
+    let (graph, _finished) = create_graph(Some(1))?;
+    let error = executor.send_graph(graph).unwrap_err();
+    assert_eq!(error.code(), ErrorCode::UNWIND_ERROR);
+    assert!(!executor.is_finished());
+
+    let (graph, finished) = create_graph(Some(2))?;
+    executor.send_graph(graph.clone())?;
+    assert!(wait(&finished), "the query of the panic must finish");
+    let error = graph.get_error().expect("the query of the panic must fail");
+    assert_eq!(error.code(), ErrorCode::UNWIND_ERROR);
+    assert!(!executor.is_finished());
+
+    let (graph, finished) = create_graph(None)?;
+    executor.send_graph(graph.clone())?;
+    assert!(wait(&finished), "the next query must still be executed");
+    assert!(graph.get_error().is_none());
+
+    // Once the executor is finished, a query fails i
```

---

### Incident Patch 2: `0b01116e` (2026-11-11)
**Commit Message**: fix(query): preserve known query kinds before planning failures (#21061)

* fix(query): preserve known query kinds before planning failures

Separate query kind registration from query text attachment and keep the first known kind on shared contexts. Register kinds after parsing and at AST planning entry points without moving SQL text attachment or changing logging paths.

Cover early SETTINGS, parameter, rewrite and transaction failures, including COPY INTO table and location, and shared-context kind precedence.

* test(query): avoid spelling errors in malformed SQL fixtures

* refactor(query): simplify first-known query kind registration

**File**: `src/query/catalog/src/table_context/query.rs` (modified, +6/-0)
```diff
@@ -41,6 +41,12 @@ pub trait TableContextQueryIdentity: Send + Sync {
 
     fn attach_query_str(&self, kind: QueryKind, query: String);
 
+    /// Records the kind of the query as soon as it is known, before its text
+    /// is attached, so that failures in between keep it. The first known kind
+    /// wins: statements planned later on a shared context, such as
+    /// subqueries, do not replace it.
+    fn attach_query_kind(&self, _kind: QueryKind) {}
+
     /// Records credential values hidden from the query text, so that error
     /// messages of this query can be scrubbed instead of discarded.
     fn add_query_secrets(&self, _secrets: SqlSecrets) {}
```

**File**: `src/query/service/src/sessions/query_ctx/state.rs` (modified, +4/-0)
```diff
@@ -89,6 +89,10 @@ impl TableContextQueryIdentity for QueryContext {
         self.shared.attach_query_str(kind, query);
     }
 
+    fn attach_query_kind(&self, kind: QueryKind) {
+        self.shared.attach_query_kind(kind);
+    }
+
     fn add_query_secrets(&self, secrets: SqlSecrets) {
         self.shared.query_secrets.write().extend(secrets);
     }
```

**File**: `src/query/service/src/sessions/query_ctx_shared.rs` (modified, +16/-14)
```diff
@@ -701,24 +701,26 @@ impl QueryContextShared {
     }
 
     pub fn attach_query_str(&self, kind: QueryKind, query: String) {
+        self.attach_query_kind(kind);
+
         // `create view as view_query` the view_query should not cover create view
         if !self.get_query_str().is_empty() {
             return;
         }
-        {
-            let mut running_query = self.running_query.write();
-            // Callers attach masked SQL, see `Statement::to_mask_sql`.
-            *running_query = Some(short_sql(
-                query,
-                self.get_settings()
-                    .get_short_sql_max_length()
-                    .unwrap_or(1000),
-            ));
-        }
-
-        {
-            let mut running_query_kind = self.running_query_kind.write();
-            *running_query_kind = Some(kind);
+        let mut running_query = self.running_query.write();
+        // Callers attach masked SQL, see `Statement::to_mask_sql`.
+        *running_query = Some(short_sql(
+            query,
+            self.get_settings()
+                .get_short_sql_max_length()
+                .unwrap_or(1000),
+        ));
+    }
+
+    /// The first known kind wins, see `TableContextQueryIdentity::attach_query_kind`.
+    pub fn attach_query_kind(&self, kind: QueryKind) {
+        if kind != QueryKind::Unknown {
+            self.running_query_kind.write().get_or_insert(kind);
         }
     }
 
```

**File**: `src/query/service/tests/it/sessions/query_ctx.rs` (modified, +31/-0)
```diff
@@ -16,6 +16,7 @@ use std::time::Duration;
 
 use anyhow::Context;
 use databend_common_catalog::lock::LockTableOption;
+use databend_common_catalog::query_kind::QueryKind;
 use databend_common_meta_app::schema::DeleteLockRevReq;
 use databend_common_meta_app::schema::ListLockRevReq;
 use databend_common_meta_app::schema::LockKey;
@@ -28,7 +29,9 @@ use databend_meta_client::kvapi::KvApiExt;
 use databend_meta_client::kvapi::StructKey;
 use databend_meta_runtime::DatabendRuntime;
 use databend_query::interpreters::interpreter_plan_sql;
+use databend_query::sessions::QueryContext;
 use databend_query::sessions::TableContextQueryIdentity;
+use databend_query::sessions::TableContextQueryInfo;
 use databend_query::sessions::TableContextTableAccess;
 use databend_query::test_kits::ConfigBuilder;
 use databend_query::test_kits::TestFixture;
@@ -183,6 +186,34 @@ async fn test_execute_immediate_planner_history() -> anyhow::Result<()> {
     Ok(())
 }
 
+#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+async fn test_attach_query_kind_keeps_first_known_kind() -> anyhow::Result<()> {
+    let fixture = TestFixture::setup().await?;
+
+    // A statement planned later on a shared context, such as a subquery of
+    // COPY, attaches its own kind; the kind of the query is kept.
+    let ctx = fixture.new_query_ctx().await?;
+    ctx.attach_query_kind(QueryKind::CopyIntoTable);
+    let shared = QueryContext::create_from(ctx.as_ref());
+    shared.attach_query_kind(QueryKind::Query);
+    shared.attach_query_str(QueryKind::Query, "SELECT 1".to_string());
+    assert_eq!(ctx.get_query_kind(), QueryKind::CopyIntoTable);
+    // The first text is still attached as before.
+    assert_eq!(ctx.get_query_str(), "SELECT 1");
+
+    // An unknown kind does not replace a known one, and is replaced by one.
+    let ctx = fixture.new_query_ctx().await?;
+    ctx.attach_query_kind(QueryKind::Unknown);
+    assert_eq!(ctx.get_query_kind(), QueryKind::Unknown);
+    ctx.attach_query_str(QueryKind::Unknown, "SELECT (".to_string());
+    ctx.attach_query_kind(QueryKind::Insert);
+    assert_eq!(ctx.get_query_kind(), QueryKind::Insert);
+    ctx.attach_query_str(QueryKind::Unknown, "other text".to_string());
+    assert_eq!(ctx.get_query_kind(), QueryKind::Insert);
+    assert_eq!(ctx.get_query_str(), "SELECT (");
+    Ok(())
+}
+
 #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
 async fn test_get_storage_accessor_s3() -> anyhow::Result<()> {
     let mock_server = MockServer::start().await;
```

**File**: `src/query/service/tests/it/sql/planner/builders/binder.rs` (modified, +102/-0)
```diff
@@ -17,7 +17,10 @@ use databend_common_catalog::session_type::SessionType;
 use databend_common_sql::FormatOptions;
 use databend_common_sql::Planner;
 use databend_common_sql::optimizer::ir::StatContext;
+use databend_query::interpreters::interpreter_plan_sql;
+use databend_query::sessions::TableContextQueryIdentity;
 use databend_query::sessions::TableContextQueryInfo;
+use databend_query::sessions::TableContextSession;
 use databend_query::sessions::TableContextSettings;
 use databend_query::test_kits::TestFixture;
 
@@ -119,3 +122,102 @@ async fn test_execute_immediate_uses_inner_timezone_for_statistics() -> anyhow::
     );
     Ok(())
 }
+
+/// Planning can fail after the statement is parsed but before its text is
+/// attached. Such failures keep the kind of the statement, not `Unknown`.
+#[tokio::test(flavor = "multi_thread")]
+async fn test_query_kind_of_early_planning_failures() -> anyhow::Result<()> {
+    let fixture = TestFixture::setup().await?;
+    fixture
+        .execute_command("CREATE TABLE default.query_kind_t(a INT)")
+        .await?;
+
+    #[derive(Clone, Copy)]
+    enum Setup {
+        None,
+        MaxSetOperators,
+        AbortedTransaction,
+    }
+    let params = serde_json::json!({ "y": 1 });
+    // (SQL, HTTP parameters, failure set up on the session, expected kind)
+    let cases = [
+        // `SETTINGS` clauses are applied before binding.
+        (
+            "SETTINGS (max_threads = 'abc') INSERT INTO default.query_kind_t VALUES (1)",
+            None,
+            Setup::None,
+            QueryKind::Insert,
+        ),
+        (
+            "SETTINGS (max_threads = 'abc') COPY INTO default.query_kind_t FROM @~/ \
+             FILE_FORMAT = (TYPE = 'csv')",
+            None,
+            Setup::None,
+            QueryKind::CopyIntoTable,
+        ),
+        (
+            "SETTINGS (max_threads = 'abc') COPY INTO @~/query_kind/ FROM default.query_kind_t",
+            None,
+            Setup::None,
+            QueryKind::CopyIntoLocation,
+        ),
+        // Parameters are substituted after parsing.
+        (
+            "INSERT INTO default.query_kind_t SELECT :x",
+            Some(&params),
+            Setup::None,
+            QueryKind::Insert,
+        ),
+        (
+            "COPY INTO @~/query_kind/ FROM (SELECT :x)",
+            Some(&params),
+            Setup::None,
+            QueryKind::CopyIntoLocation,
+        ),
+        // The AST is rewritten and checked right after parsing.
+        (
+            "DELETE FROM default.query_kind_t \
+             WHERE a IN (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3)",
+            None,
+            Setup::MaxSetOperators,
+            QueryKind::Update,
+        ),
+        // The transaction state is checked before planning.
+        (
+            "MERGE INTO default.query_kind_t USING (SELECT 1 AS a) AS s ON query_kind_t.a = s.a \
+             WHEN MATCHED THEN DELETE",
+            None,
+            Setup::AbortedTransaction,
+            QueryKind::Update,
+        ),
+        // Without a statement the kind stays unknown.
+        ("SELECT (", None, Setup::None, QueryKind::Unknown),
+    ];
+    for (sql, params, setup, expected) in cases {
+        let session = fixture
+            .new_session_with_type(SessionType::HTTPQuery)
+            .await?;
+        let ctx = session
+            .create_query_context(&databend_common_version::BUILD_INFO)
+            .await?;
+        match setup {
+            Setup::None => {}
+            Setup::MaxSetOperators => ctx
+                .get_settings()
+                .set_setting("max_set_operator_count".to_string(), "1".to_string())?,
+            Setup::AbortedTransaction => {
+                let txn_mgr = ctx.txn_mgr();
+                let mut txn_mgr = txn_mgr.lock();
+                txn_mgr.begin();
+                txn_mgr.set_fail();
+            }
+        }
+
+        let result = interpreter_plan_sql(ctx.clone(), sql, false, params).await;
+        assert!(result.is_err(), "{sql}");
+        assert_eq!(ctx.get_query_kind(), expected, "{sql}");
+        // The failure handler still attaches the text.
+        assert!(!ctx.get_query_str().is_empty(), "{sql}");
+    }
+    Ok(())
+}
```

**File**: `src/query/sql/src/planner/planner.rs` (modified, +6/-0)
```diff
@@ -238,6 +238,9 @@ impl Planner {
                     return Err(ErrorCode::SyntaxException("PRQL to SQL conversion failed"));
                 }
 
+                // Before the rewrites below and the rest of planning can fail.
+                // The text is attached later, once it is final.
+                self.ctx.attach_query_kind(get_query_kind(&stmt));
                 self.replace_stmt(&mut stmt)?;
 
                 PlanExtras {
@@ -295,6 +298,8 @@ impl Planner {
         stmt: &Statement,
         force_disable_distributed_optimization: bool,
     ) -> Result<Plan> {
+        // Callers may pass a statement that was not parsed by this planner.
+        self.ctx.attach_query_kind(get_query_kind(stmt));
         self.plan_stmt_with_materialized_view_rewrite(
             stmt,
             force_disable_distributed_optimization,
@@ -310,6 +315,7 @@ impl Planner {
         stmt: &Statement,
         force_disable_distributed_optimization: bool,
     ) -> Result<Plan> {
+        self.ctx.attach_query_kind(get_query_kind(stmt));
         self.plan_stmt_with_materialized_view_rewrite(
             stmt,
             force_disable_distributed_optimization,
```

---

### Incident Patch 3: `13106f77` (2026-11-11)
**Commit Message**: fix: meta: validate final gRPC status before completing reads (#21064)

* test: meta: control gRPC trailers and observe stream resets

# Summary

Add an HTTP/2 peer that separates response data from final gRPC status
and reports cancellation received from the client.

# Details

Keep the channel alive after dropping a response so stream cancellation
is distinguishable from connection teardown. Explicit release signals
make delayed completion deterministic without timing sleeps.

* fix: meta: finish protobuf response streams before success

# Summary

Validate the backend stream's final status before yielding the last
requested protobuf value, instead of dropping it after enough data.

# Details

Table enumeration and GC zip responses with keys. Replacing the final
item with a terminal error keeps trailers failures and excess items
visible to those consumers, rather than appending an error they ignore.

Preserve recoverable per-item decoding failures and short-stream count
checks. Empty reads do not open an RPC. No wire or stored-data format
changes are required.

* test: meta: compare repeated reads on one h2 connection

# Summary

Exercise truncated and fully consumed responses be

**File**: `Cargo.lock` (modified, +3/-0)
```diff
@@ -3682,6 +3682,7 @@ dependencies = [
  "anyhow",
  "async-backtrace",
  "async-trait",
+ "bytes",
  "chrono",
  "databend-common-base",
  "databend-common-exception",
@@ -3694,6 +3695,8 @@ dependencies = [
  "display-more 0.2.6",
  "fastrace",
  "futures",
+ "h2",
+ "http 1.3.1",
  "itertools 0.13.0",
  "log",
  "logcall",
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -285,6 +285,7 @@ gimli = "0.31.0"
 glob = "0.3.0"
 globiter = "0.1"
 goldenfile = "1.4"
+h2 = "0.4"
 h3o = "0.9.4"
 half = "2.7.1"
 hashbrown = { version = "0.15.2", default-features = false }
```

**File**: `src/meta/api/Cargo.toml` (modified, +3/-0)
```diff
@@ -36,8 +36,11 @@ uuid = { workspace = true }
 zstd = { workspace = true }
 
 [dev-dependencies]
+bytes = { workspace = true }
 databend-common-meta-store = { workspace = true }
 databend-meta-runtime = { workspace = true }
+h2 = { workspace = true }
+http = { workspace = true }
 
 [lints]
 workspace = true
```

**File**: `src/meta/api/src/kv/pb_api/errors/read_error.rs` (modified, +5/-1)
```diff
@@ -34,8 +34,12 @@ impl NoneValue {
     }
 }
 
+/// A response stream returned fewer or more items than requested.
 #[derive(Clone, Debug, PartialEq, thiserror::Error)]
-#[error("StreamReadEOF: expected {expected} items but only received {received} items")]
+#[error("{}: expected {expected} items but {}received {received} items",
+    if .received > .expected { "StreamReadOverflow" } else { "StreamReadEOF" },
+    if .received < .expected { "only " } else { "" }
+)]
 pub struct StreamReadEof {
     expected: u64,
     received: u64,
```

**File**: `src/meta/api/src/kv/pb_api/mod.rs` (modified, +46/-27)
```diff
@@ -222,8 +222,9 @@ pub trait KVPbApi: KVApi {
 
     /// Same as `get_pb_stream` but does not return keys, only values.
     ///
-    /// It guaranteed to return the same number of results as the input keys.
-    /// If the backend stream closed before all keys are processed, the following items is filled with `StreamReadEof` Error.
+    /// Returns one result per input key on success. The final result is not
+    /// yielded until the backend stream ends successfully, including gRPC trailers.
+    /// Missing or extra items produce a `StreamReadEof` count-mismatch error.
     fn get_pb_values<K, I>(
         &self,
         keys: I,
@@ -285,8 +286,10 @@ pub trait KVPbApi: KVApi {
     /// It returns the same error as `KVApi::Error`,
     /// thus it requires KVApi::Error can describe a decoding error, i.e., `impl From<PbApiReadError>`.
     ///
-    /// It guaranteed to return the same number of results as the input keys.
-    /// If the backend stream closed before all keys are processed, the following items is filled with `StreamReadEof` Error.
+    /// Returns one result per input key on success. The final result is not
+    /// yielded until the backend stream ends successfully, including gRPC trailers.
+    /// Missing or extra items produce a `StreamReadEof` count-mismatch error.
+    /// Dropping the stream before completion cancels the remaining read.
     fn get_pb_stream<K, I>(
         &self,
         keys: I,
@@ -334,11 +337,45 @@ pub trait KVPbApi: KVApi {
 
         async move {
             let sent = keys.len();
+            let state = if sent == 0 {
+                None
+            } else {
+                Some((self.get_kv_stream(&keys).await?, 0))
+            };
 
-            let strm = self.get_kv_stream(&keys).await?;
+            let strm = stream::unfold(state, move |state| async move {
+                let (mut strm, received) = state?;
+                let item = match strm.next().await {
+                    Some(Ok(item)) => item,
+                    Some(Err(e)) => return Some((Err(PbApiReadError::KvApiError(e)), None)),
+                    None => {
+                        let error = StreamReadEof::new(sent as u64, received as u64);
+                        return Some((Err(PbApiReadError::StreamReadEof(error)), None));
+                    }
+                };
+
+                let received = received + 1;
+                if received == sent {
+                    // A final data item is not proof that the RPC succeeded.
+                    // Wait for the real EOF so trailers are checked before
+                    // yielding the last item. Keep terminal errors within the
+                    // requested item count: callers may zip results with keys.
+                    let error = match strm.next().await {
+                        None => return Some((Ok(item), None)),
+                        Some(Err(e)) => PbApiReadError::KvApiError(e),
+                        Some(Ok(_)) => PbApiReadError::StreamReadEof(StreamReadEof::new(
+                            sent as u64,
+                            (received + 1) as u64,
+                        )),
+                    };
+                    return Some((Err(error), None));
+                }
+
+                Some((Ok(item), Some((strm, received))))
+            });
 
-            let strm = strm.map(|r: Result<StreamItem, Self::Error>| {
-                let item = r.map_err(PbApiReadError::KvApiError)?;
+            let strm = strm.map(|r: Result<StreamItem, PbApiReadError<Self::Error>>| {
+                let item = r?;
 
                 let k = K::from_str_key(&item.key).map_err(PbApiReadError::KeyError)?;
 
@@ -354,26 +391,6 @@ pub trait KVPbApi: KVApi {
                 Ok((k, v))
             });
 
-            // If the backend stream is closed, fill it with `StreamReadEof` error.
-
-            let strm = strm
-                // chain with a stream of `StreamReadEof` error but without received count set.
-                .chain(stream::once(async move {
-                    Err(PbApiReadError::StreamReadEof(StreamReadEof::new(
-                        sent as u64,
-                        0,
-                    )))
-                }))
-                .take(sent)
-                // set received count for `StreamReadEof` error after `sent`
-                .enumerate()
-                .map(move |(i, mut r)| {
-                    if let Err(PbApiReadError::StreamReadEof(e)) = &mut r {
-                        e.set_received(i as u64)
-                    }
-                    r
-                });
-
             Ok(strm.boxed())
         }
     }
@@ -492,6 +509,8 @@ impl<T> KVPbApi for T where T: KVApi + ?Sized {}
 
 #[cfg(test)]
 mod tests {
+    mod grpc;
+
     use std::collections::BTreeMap;
 
     use async_trait::async_trait;
```

**File**: `src/meta/api/src/kv/pb_api/tests/grpc.rs` (added, +485/-0)
```diff
@@ -0,0 +1,485 @@
+// Copyright 2021 Datafuse Labs
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+use std::collections::VecDeque;
+use std::sync::Arc;
+use std::sync::Mutex;
+use std::sync::atomic::AtomicUsize;
+use std::sync::atomic::Ordering;
+use std::time::Duration;
+
+use bytes::BufMut;
+use bytes::BytesMut;
+use databend_common_base::runtime::spawn;
+use databend_common_meta_app::schema::CatalogIdIdent;
+use databend_common_meta_app::tenant::Tenant;
+use databend_meta_client::kvapi::KVApi;
+use databend_meta_client::kvapi::KVStream;
+use databend_meta_client::kvapi::ListOptions;
+use databend_meta_client::types::Change;
+use databend_meta_client::types::MetaError;
+use databend_meta_client::types::SeqV;
+use databend_meta_client::types::TxnReply;
+use databend_meta_client::types::TxnRequest;
+use databend_meta_client::types::UpsertKV;
+use databend_meta_client::types::protobuf::RaftRequest;
+use databend_meta_client::types::protobuf::StreamItem;
+use databend_meta_client::types::protobuf::meta_service_client::MetaServiceClient;
+use futures::StreamExt;
+use futures::TryStreamExt;
+use futures::future::poll_fn;
+use futures::stream::BoxStream;
+use http::HeaderMap;
+use http::HeaderValue;
+use prost::Message;
+use tokio::net::TcpListener;
+use tokio::sync::Notify;
+use tokio::sync::mpsc;
+use tokio::task::JoinHandle;
+use tokio::time::timeout;
+use tonic::Code;
+use tonic::Streaming;
+
+use crate::kv_pb_api::KVPbApi;
+
+const TEST_TIMEOUT: Duration = Duration::from_secs(10);
+
+#[derive(Debug, PartialEq)]
+enum Event {
+    Cancelled(h2::Reason),
+    TrailersSent,
+}
+
+/// A real HTTP/2 peer that withholds grpc-status until the test releases it.
+/// Observe resets at the peer rather than inferring them from a dropped Body.
+struct ResponsePeer {
+    address: String,
+    finish: mpsc::UnboundedSender<Code>,
+    events: mpsc::UnboundedReceiver<Event>,
+    channel: Option<tonic::transport::Channel>,
+    task: JoinHandle<()>,
+}
+
+impl ResponsePeer {
+    async fn start(items: Vec<StreamItem>) -> Self {
+        Self::start_repeated(items, 1).await
+    }
+
+    async fn start_repeated(items: Vec<StreamItem>, requests: usize) -> Self {
+        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let address = format!("http://{}", listener.local_addr().unwrap());
+        let (finish, mut done) = mpsc::unbounded_channel::<Code>();
+        let (events_tx, events) = mpsc::unbounded_channel();
+        let task = spawn(async move {
+            let (socket, _) = listener.accept().await.unwrap();
+            socket.set_nodelay(true).unwrap();
+            // Match Meta's gRPC server rather than h2's smaller default
+            // pending-reset budget; that is a separate protection mechanism.
+            let mut connection = h2::server::Builder::new()
+                .max_pending_accept_reset_streams(4096)
+                .handshake(socket)
+                .await
+                .unwrap();
+            for _ in 0..requests {
+                let (request, mut respond) = connection.accept().await.unwrap().unwrap();
+                let mut body = request.into_body();
+                let read_request = async {
+                    while let Some(data) = body.data().await {
+                        let data = data.unwrap();
+                        body.flow_control().release_capacity(data.len()).unwrap();
+                    }
+                };
+                tokio::select! {
+                    _ = read_request => {}
+                    result = poll_fn(|cx| connection.poll_closed(cx)) => { result.unwrap(); return; }
+                }
+                let headers = http::Response::builder()
+                    .header("content-type", "application/grpc")
+                    .body(())
+                    .unwrap();
+                let mut response = respond.send_response(headers, false).unwrap();
+                let mut data = BytesMut::new();
+                for item in &items {
+                    data.put_u8(0); // Uncompressed gRPC message.
+                    data.put_u32(item.encoded_len() as u32);
+                    item.encode(&mut data).unwrap();
+                }
+                if !data.is_empty() {
+                    // Coalesce messages as tonic does: many tiny DATA frames
+                    // would exercise h2's unrelated framing-overhead protection.
+                    response.send_data(data.freeze(), false).unwrap();
+    
```

#### Recent Merged Pull Requests:
- **PR #21074** (2026-11-12): fix(sqllogictest): stop the runner from panicking on a multi-byte comment (@sundy-li)
- **PR #21071** (2026-11-12): fix(query): remove vector bundle component size cap (@bohutang)
- **PR #21067** (2026-11-12): fix(http): verify query owner on kill/final/state endpoints (@youngsofun)
- **PR #21066** (closed): ci: [DO NOT MERGE] enable queries executor by default for CI trial (@dqhl76)
- **PR #21065** (2026-11-11): fix(query): keep the shared executor alive on processor panics (@bohutang)
- **PR #21064** (2026-11-11): fix: meta: validate final gRPC status before completing reads (@drmingdrmer)

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

## X. query): keep the shared executor alive on processor panics (#21065)

**RULE**:
When implementing operations in `src/query/service/src/pipelines/executor/queries_executor_tasks.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `652b12b4`: query): keep the shared executor alive on processor panics (#21065). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/service/src/pipelines/executor/queries_executor_tasks.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // The worker id of a waker is not always the id of a worker of this
        // executor, e.g. a fuse source passes its index among the sources.
        let workers = workers_tasks.workers_waiting_status.total_size();
        let mut worker_id = task.worker_id % workers;
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        let mut worker_id = task.worker_id;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `652b12b4` are properly handled with clean fallback behavior.
