# Verification Protocol: Verification Protocol: Empirical Defect Shield for databendlabs/databend

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "58dd5893",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T19:53:45.826Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-databendlabs-databend",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `58dd5893`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T19:53:45.826Z`  
> **Learning ID**: `learn-github-databendlabs-databend`


## 1. Scope & Verification Target
- **Target Repository**: `databendlabs/databend` (Commit: `58dd5893`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): databendlabs/databend

> **Canonical Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T19:53:44.675Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9498 stars

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
- **Issue #21111** (2026-11-17): **fix(query): finish queries correctly on the queries executor**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Fixes how queries finish on the executor shared by all the queries (`enable_queries_executor`, off by default). It does not enable the executor; nothing changes when the switch is off.  | Bug | Case | main | This PR | |---|---|---|---| | Bug 1 | Client stops reading the result | The result sink blocks a shared worker; enough such queries hold every worker | The sink waits asynchronously, no worker is held | | Bug 2 | A query fails or is killed while its other processors run | Finish callbacks run concurrently with those processors | Finish callbacks run after no worker runs a task of the query | | Bug 3 | Tasks of a finished query still queued | Run | Dropped | | Bug 4 | The result is read right after a query fails | The finish flag is set before the error is stored, so the error can be missed | The error is stored before the flag | | Bug 5 | All processors finish in their first event | The query hangs | The query completes | | Bug 6 | Stopped early without an error, e.g. `finish(None)` | Returns `Ok` | Returns an error, as the per-query executor | | Bug 7 | Fails to start, or dropped without being executed | Finish callbacks are skipped | Finish callbacks run | | Bug 8 | Executor finishes with tasks queued | Tasks dropped with the executor, possibly after the global IO runtime (aborts in tests) | Tasks dropped in `finish`; none queued afterwards | | Bug 9 | A first e

- **Issue #21104** (2026-11-17): **fix(storage): bound fuse_page Thrift decoding and drop thrift dep**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  `fuse_page` previously decoded Parquet `PageHeader` metadata through `thrift` 0.17's `TCompactInputProtocol` and the deprecated `parquet::format::PageHeader` API. Because `TCompactInputProtocol::read_bytes` eagerly allocates a `Vec<u8>` sized directly from the wire varint before reading payload bytes, a corrupted or crafted column chunk header could trigger multi-gigabyte allocations from a few bytes of input.  - Add reusable zero-allocation Parquet/Thrift helpers in `databend-storages-common-blocks`:   - `thrift_compact::ThriftCompactReader`: bounded Thrift Compact Protocol slice reader that checks binary and container lengths against remaining slice bytes before advancing, enforces a recursion depth budget (64), and validates field wire types.   - `parquet_page::{read_parquet_page_header, iter_parquet_page_headers, ParquetPageHeader}`: decodes Parquet v1/v2/dictionary/index page headers lazily over an in-memory column chunk slice without intermediate `Vec` materialization. - Simplify `fuse_page` to stream `iter_parquet_page_headers`, drop `#![allow(deprecated)]`, and remove the direct `thrift` dependency from `Cargo.toml` and `src/query/storages/fuse/Cargo.toml`. - Validated with unit tests in `databend_storages_common_blocks::parquet_page::tests` (`ArrowWriter` v1/v2 multi-page round-trips with page statistics, `u32::MAX` binary length prefixes, oversized/negative 

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

### Incident Patch 1: `58dd5893` (2026-11-17)
**Commit Message**: fix(query): finish queries correctly on the queries executor (#21111)

* ci(query): let unit tests run on the queries executor

ConfigBuilder::enable_queries_executor starts the executor shared by all the
queries. The test guard finishes it and waits for its workers on teardown:
they would outlive the test and look up the global instances of a dropped
test.

* fix(query): do not hold a shared worker for an unconsumed result

The sink of a pulling query blocks its thread when the result channel is
full. On the queries executor that thread is a worker shared by all the
queries, so a client that stops reading could hold every worker. The sink
now waits asynchronously there; the per-query executor is unchanged.

* fix(query): drop the queued tasks when the queries executor finishes

The queued tasks hold the graphs of the queries. They were dropped with the
executor itself, which may outlive what the processors need to shut down,
e.g. the global IO runtime that an async sink uses on drop. finish now takes
them out of the queue and drops them out of the lock, and no task is queued
once the executor is finished.

* fix(query): finish a query of the queries executor after its tasks stop



**File**: `src/query/pipeline/src/sinks/async_sink.rs` (modified, +18/-16)
```diff
@@ -73,22 +73,24 @@ impl<T: AsyncSink + 'static> AsyncSinker<T> {
 impl<T: AsyncSink + 'static> Drop for AsyncSinker<T> {
     fn drop(&mut self) {
         drop_guard(move || {
-            if !self.called_on_start || !self.called_on_finish {
-                if let Some(mut inner) = self.inner.take() {
-                    GlobalIORuntime::instance().spawn({
-                        let called_on_start = self.called_on_start;
-                        let called_on_finish = self.called_on_finish;
-                        async move {
-                            if !called_on_start && T::CALL_ON_START_ON_ERROR {
-                                let _ = inner.on_start().await;
-                            }
-
-                            if !called_on_finish && T::CALL_ON_FINISH_ON_ERROR {
-                                let _ = inner.on_finish().await;
-                            }
-                        }
-                    });
-                }
+            let run_on_start = !self.called_on_start && T::CALL_ON_START_ON_ERROR;
+            let run_on_finish = !self.called_on_finish && T::CALL_ON_FINISH_ON_ERROR;
+            // Nothing to run: do not touch the global runtime, which a sink
+            // dropped late may outlive.
+            if !run_on_start && !run_on_finish {
+                return;
+            }
+
+            if let Some(mut inner) = self.inner.take() {
+                GlobalIORuntime::instance().spawn(async move {
+                    if run_on_start {
+                        let _ = inner.on_start().await;
+                    }
+
+                    if run_on_finish {
+                        let _ = inner.on_finish().await;
+                    }
+                });
             }
         })
     }
```

**File**: `src/query/service/src/pipelines/executor/executor_graph.rs` (modified, +115/-15)
```diff
@@ -28,6 +28,7 @@ use std::time::SystemTime;
 use databend_common_base::base::WatchNotify;
 use databend_common_base::runtime::ExecutorStats;
 use databend_common_base::runtime::ExecutorStatsSnapshot;
+use databend_common_base::runtime::LimitMemGuard;
 use databend_common_base::runtime::MemStat;
 use databend_common_base::runtime::ParentMemStat;
 use databend_common_base::runtime::PerfEvent;
@@ -216,6 +217,8 @@ const DEFAULT_POINTS: u64 = 3;
 
 struct ExecutingGraph {
     finished_nodes: AtomicUsize,
+    /// The tasks of the graph running on a worker of the queries executor.
+    running_tasks: AtomicUsize,
     graph: StableGraph<Arc<Node>, EdgeInfo>,
     /// points store two values
     ///
@@ -263,6 +266,7 @@ impl ExecutingGraph {
         Ok(ExecutingGraph {
             graph,
             finished_nodes: AtomicUsize::new(0),
+            running_tasks: AtomicUsize::new(0),
             points: AtomicU64::new((DEFAULT_POINTS << 32) | init_epoch as u64),
             max_points: AtomicU64::new(DEFAULT_POINTS),
             query_id,
@@ -312,6 +316,7 @@ impl ExecutingGraph {
         let executor_stats = ExecutorStats::new();
         Ok(ExecutingGraph {
             finished_nodes: AtomicUsize::new(0),
+            running_tasks: AtomicUsize::new(0),
             graph,
             points: AtomicU64::new((DEFAULT_POINTS << 32) | init_epoch as u64),
             max_points: AtomicU64::new(DEFAULT_POINTS),
@@ -965,31 +970,63 @@ impl RunningGraph {
     }
 
     /// Flag the graph should finish and no more tasks should be scheduled.
+    ///
+    /// The first call decides the result of the graph. Its error is stored before
+    /// the flag is set, so whoever sees the flag sees the error too. The waiter of
+    /// the graph is woken once no worker runs a task of it.
     pub fn should_finish<C>(&self, cause: Result<(), C>) -> Result<()> {
         let cause = cause.with_context(|| "should finish");
 
-        if self.0.should_finish.load(Ordering::SeqCst) {
-            return Ok(());
+        {
+            let mut finished_error = self.0.finished_error.lock();
+            if self.0.should_finish.load(Ordering::SeqCst) {
+                return Ok(());
+            }
+            *finished_error = cause.as_ref().err().cloned();
+            // It is also the interrupt flag of the processors.
+            self.0.should_finish.store(true, Ordering::SeqCst);
         }
-        self.0.should_finish.store(true, Ordering::SeqCst);
+
+        self.0.finished_notify.notify_waiters();
+        self.notify_finished_if_idle();
+
+        // After the notifications: the diagnostics wait for locks that other
+        // queries hold, e.g. the one of `DataExchangeManager::shutdown_query`,
+        // and may run on a thread that exceeded its memory limit.
         if let Err(cause) = &cause {
+            let _guard = LimitMemGuard::enter_unlimited();
             log_memory_limit_diagnostics(cause, "memory limit exceeded");
         }
-        self.0.finished_notify.notify_waiters();
-        self.interrupt();
-        let mut finished_error = self.0.finished_error.lock();
-        if finished_error.is_none() {
-            *finished_error = cause.err();
-            drop(finished_error);
+        Ok(())
+    }
+
+    /// Counts a task of the graph as running until the guard is dropped.
+    ///
+    /// Check `is_should_finish` after this, not before: a graph that finishes in
+    /// between has woken its waiter already, which then runs concurrently with
+    /// the task.
+    pub(crate) fn track_running_task(self: &Arc<Self>) -> RunningTaskGuard {
+        self.0.running_tasks.fetch_add(1, Ordering::SeqCst);
+        RunningTaskGuard {
+            graph: self.clone(),
+        }
+    }
+
+    /// Wakes the waiter of the graph, which runs the finish callbacks of the
+    /// query, once the graph should finish and no worker runs a task of it.
+    ///
+    /// The async tasks of the graph are not waited for: they are aborted by
+    /// `finished_notify`, as on the per-query executor.
+    fn notify_finished_if_idle(&self) {
+        if !self.is_should_finish() || self.0.running_tasks.load(Ordering::SeqCst) != 0 {
+            return;
         }
 
-        if let Some(notify) = self.0.finish_condvar_notify.clone() {
-            let (lock, cvar) = &*notify;
-            let mut started = lock.lock();
-            *started = true;
-            cvar.notify_one();
+        if let Some(notify) = &self.0.finish_condvar_notify {
+            let (lock, cvar) = &**notify;
+            *lock.lock() = true;
+            cvar.notify_all();
         }
-        Ok(())
     }
 
     /// Checks if the graph should finish and no more tasks should be scheduled.
@@ -1194,6 +1231,18 @@ impl RunningGraph {
     }
 }
 
+/// A task of a graph running on a worker of the queries executor.
+pub(crate) struct RunningTaskGuard {
+    graph: Arc<RunningGraph>,
+}
+
+impl Drop for RunningTaskGuard {
+    fn drop(&mut self) {
+       
```

**File**: `src/query/service/src/pipelines/executor/global_queries_executor.rs` (modified, +5/-0)
```diff
@@ -38,4 +38,9 @@ impl GlobalQueriesExecutor {
     pub fn instance() -> Arc<QueriesPipelineExecutor> {
         GlobalInstance::get()
     }
+
+    /// The executor, `None` if `enable_queries_executor` is off.
+    pub fn try_instance() -> Option<Arc<QueriesPipelineExecutor>> {
+        GlobalInstance::try_get()
+    }
 }
```

**File**: `src/query/service/src/pipelines/executor/pipeline_executor.rs` (modified, +82/-29)
```diff
@@ -20,6 +20,8 @@ use std::time::Instant;
 use databend_common_base::base::WatchNotify;
 use databend_common_base::runtime::ExecutorStatsSnapshot;
 use databend_common_base::runtime::GlobalIORuntime;
+use databend_common_base::runtime::LimitMemGuard;
+use databend_common_base::runtime::ThreadTracker;
 use databend_common_base::runtime::catch_unwind;
 use databend_common_base::runtime::defer;
 use databend_common_exception::ErrorCode;
@@ -32,6 +34,7 @@ use databend_common_pipeline::core::PlanProfile;
 use futures_util::future::Either;
 use futures_util::future::select;
 use log::info;
+use log::warn;
 use parking_lot::Condvar;
 use parking_lot::Mutex;
 
@@ -55,6 +58,42 @@ pub struct QueryWrapper {
     finished_notify: Arc<WatchNotify>,
 }
 
+impl QueryWrapper {
+    /// Runs the finish callbacks of the query with its result. Only the first
+    /// call runs them.
+    fn on_finished(&self, res: Result<()>) -> Result<()> {
+        let mut on_finished_chain = self.on_finished_chain.lock();
+
+        // untracking for on finished
+        let tracking_payload = ThreadTracker::new_tracking_payload();
+        let _guard = ThreadTracker::tracking(tracking_payload);
+        let profiling = self
+            .graph
+            .fetch_profiling(Some(self.settings.executor_node_id.clone()));
+        on_finished_chain.apply(ExecutionInfo::create(res, profiling))
+    }
+}
+
+/// Runs the finish callbacks of a query that never executed, as the per-query
+/// executor does on drop. A no-op once `execute` has run them.
+impl Drop for QueryWrapper {
+    fn drop(&mut self) {
+        let _guard = LimitMemGuard::enter_unlimited();
+
+        // Drops the tasks that the wakers of its processors may still queue.
+        if let Err(cause) = self.graph.should_finish::<()>(Ok(())) {
+            warn!("Shutdown failure: {:?}", cause);
+        }
+
+        let cause = self.graph.get_error().unwrap_or_else(|| {
+            ErrorCode::Internal("Pipeline illegal state: not successfully shutdown")
+        });
+        if let Err(cause) = self.on_finished(Err(cause)) {
+            warn!("Shutdown failure: {:?}", cause);
+        }
+    }
+}
+
 pub enum PipelineExecutor {
     QueryPipelineExecutor(Arc<QueryPipelineExecutor>),
     QueriesPipelineExecutor(QueryWrapper),
@@ -179,37 +218,51 @@ impl PipelineExecutor {
         match self {
             PipelineExecutor::QueryPipelineExecutor(executor) => executor.execute(),
             PipelineExecutor::QueriesPipelineExecutor(query_wrapper) => {
-                Self::init(
-                    &query_wrapper.on_init_callback,
-                    &query_wrapper.settings.query_id,
-                )?;
-                GlobalQueriesExecutor::instance().send_graph(query_wrapper.graph.clone())?;
-                Self::start_executor_daemon(
-                    query_wrapper,
-                    query_wrapper.settings.max_execute_time_in_seconds,
-                )?;
-                let (lock, cvar) = &*query_wrapper.finish_condvar_wait;
-                let mut finished = lock.lock();
-                if !*finished {
-                    cvar.wait(&mut finished);
-                }
+                let res = Self::run_on_queries_executor(query_wrapper);
+                query_wrapper.on_finished(res.clone()).and(res)
+            }
+        }
+    }
 
-                query_wrapper.finished_notify.notify_waiters();
+    /// Runs the graph of the query on the queries executor until it finishes.
+    fn run_on_queries_executor(query_wrapper: &QueryWrapper) -> Result<()> {
+        let graph = &query_wrapper.graph;
+        let started = Self::init(
+            &query_wrapper.on_init_callback,
+            &query_wrapper.settings.query_id,
+        )
+        .and_then(|_| GlobalQueriesExecutor::instance().send_graph(graph.clone()));
+        match &started {
+            Ok(_) => Self::start_executor_daemon(
+                query_wrapper,
+                query_wrapper.settings.max_execute_time_in_seconds,
+            )?,
+            // A processor may have woken a worker from its first event before
+            // another one failed, so a task of the graph may be running: wait
+            // for it as well. The tasks still queued are dropped.
+            Err(cause) => graph.should_finish(Err(cause.clone()))?,
+        }
 
-                let may_error = query_wrapper.graph.get_error();
-                match may_error {
-                    None => {
-                        let mut finished_chain = query_wrapper.on_finished_chain.lock();
-                        let info = ExecutionInfo::create(Ok(()), self.fetch_profiling(true));
-                        finished_chain.apply(info)
-                    }
-                    Some(cause) => {
-                        let mut finished_chain = query_wrapper.on_finished_chain.lock();
-                        let profiling = self.fetch_profiling(true);
-                        let info = ExecutionInfo::create(Err(cause.cl
```

**File**: `src/query/service/src/pipelines/executor/pipeline_pulling_executor.rs` (modified, +58/-17)
```diff
@@ -17,7 +17,9 @@ use std::sync::atomic::AtomicBool;
 use std::sync::atomic::Ordering;
 
 use async_channel::Receiver;
+use async_channel::SendError;
 use async_channel::Sender;
+use async_trait::async_trait;
 use databend_common_base::base::Progress;
 use databend_common_base::base::ProgressValues;
 use databend_common_base::runtime::Thread;
@@ -33,6 +35,8 @@ use databend_common_pipeline::core::Pipeline;
 use databend_common_pipeline::core::Processor;
 use databend_common_pipeline::core::ProcessorPtr;
 use databend_common_pipeline::core::basic_callback;
+use databend_common_pipeline::sinks::AsyncSink;
+use databend_common_pipeline::sinks::AsyncSinker;
 use databend_common_pipeline::sinks::Sink;
 use databend_common_pipeline::sinks::Sinker;
 use fastrace::func_path;
@@ -105,6 +109,7 @@ impl PipelinePullingExecutor {
         pipeline: &mut Pipeline,
         tx: Sender<DataBlock>,
         progress: Option<Arc<Progress>>,
+        settings: &ExecutorSettings,
     ) -> Result<()> {
         if !pipeline.is_pulling_pipeline()? {
             return Err(ErrorCode::Internal(
@@ -117,6 +122,7 @@ impl PipelinePullingExecutor {
                 tx.clone(),
                 progress.clone(),
                 input,
+                settings.enable_queries_executor,
             )))
         })?;
 
@@ -137,7 +143,7 @@ impl PipelinePullingExecutor {
 
         let (sender, receiver) = async_channel::bounded(std::cmp::max(1, pipeline.output_len()));
 
-        Self::wrap_pipeline(&mut pipeline, sender, None)?;
+        Self::wrap_pipeline(&mut pipeline, sender, None, &settings)?;
         let executor = PipelineExecutor::create(pipeline, settings)?;
 
         Ok(PipelinePullingExecutor {
@@ -170,7 +176,7 @@ impl PipelinePullingExecutor {
         let (sender, receiver) =
             async_channel::bounded(std::cmp::max(1, main_pipeline.output_len()));
 
-        Self::wrap_pipeline(&mut main_pipeline, sender, result_progress)?;
+        Self::wrap_pipeline(&mut main_pipeline, sender, result_progress, &settings)?;
 
         let mut pipelines = build_res.sources_pipelines;
         pipelines.push(main_pipeline);
@@ -285,15 +291,39 @@ struct PullingSink {
 }
 
 impl PullingSink {
+    /// The sink waits for the consumer of the query when the channel is full. On
+    /// the queries executor it waits asynchronously: blocking would hold a worker
+    /// shared by all the queries for as long as the consumer does not read.
     pub fn create(
         tx: Sender<DataBlock>,
         progress: Option<Arc<Progress>>,
         input: Arc<InputPort>,
+        enable_queries_executor: bool,
     ) -> Box<dyn Processor> {
-        Sinker::create(input, PullingSink {
+        let sink = PullingSink {
             sender: Some(tx),
             progress,
-        })
+        };
+        match enable_queries_executor {
+            true => AsyncSinker::create(input, sink),
+            false => Sinker::create(input, sink),
+        }
+    }
+
+    fn record_progress(&self, data_block: &DataBlock) {
+        if let Some(progress) = &self.progress {
+            progress.incr(&ProgressValues {
+                rows: data_block.num_rows(),
+                bytes: data_block.memory_size(),
+            });
+        }
+    }
+
+    fn send_error(cause: SendError<DataBlock>) -> ErrorCode {
+        ErrorCode::Internal(format!(
+            "Logical error, cannot push data into SyncSender, cause {:?}",
+            cause
+        ))
     }
 }
 
@@ -306,22 +336,33 @@ impl Sink for PullingSink {
     }
 
     fn consume(&mut self, data_block: DataBlock) -> Result<()> {
-        if let Some(progress) = &self.progress {
-            progress.incr(&ProgressValues {
-                rows: data_block.num_rows(),
-                bytes: data_block.memory_size(),
-            });
-        }
-
+        self.record_progress(&data_block);
         if let Some(sender) = &self.sender {
-            if let Err(cause) = sender.send_blocking(data_block) {
-                return Err(ErrorCode::Internal(format!(
-                    "Logical error, cannot push data into SyncSender, cause {:?}",
-                    cause
-                )));
-            }
+            sender.send_blocking(data_block).map_err(Self::send_error)?;
         }
+        Ok(())
+    }
+}
 
+#[async_trait]
+impl AsyncSink for PullingSink {
+    const NAME: &'static str = "PullingExecutorSink";
+    // Nothing to run on drop: the sender is dropped with the sink. Running the
+    // hooks there would need the global runtime, which a query dropped late
+    // may outlive.
+    const CALL_ON_START_ON_ERROR: bool = false;
+    const CALL_ON_FINISH_ON_ERROR: bool = false;
+
+    async fn on_finish(&mut self) -> Result<()> {
+        drop(self.sender.take());
         Ok(())
     }
+
+    async fn consume(&mut self, data_block: DataBlock) -> Result<bool> {
+        self.record_progress(&data_block);
+        if let Some(sender) = &self.sender {
+            sender.send(data_block).
```

**File**: `src/query/service/src/pipelines/executor/queries_executor_tasks.rs` (modified, +29/-0)
```diff
@@ -46,6 +46,15 @@ impl WorkersTasks {
         }
     }
 
+    /// Takes all the queued tasks, so they are dropped out of the lock.
+    pub fn take_tasks(&mut self) -> (ExecutorTasks, ExecutorTasks) {
+        let workers_size = self.workers_waiting_status.total_size();
+        (
+            mem::replace(&mut self.current_tasks, ExecutorTasks::create(workers_size)),
+            mem::replace(&mut self.next_tasks, ExecutorTasks::create(workers_size)),
+        )
+    }
+
     pub fn swap_tasks(&mut self) {
         mem::swap(&mut self.current_tasks, &mut self.next_tasks);
     }
@@ -88,7 +97,14 @@ impl QueriesExecutorTasksQueue {
             wakeup_workers.push(worker_id);
         }
 
+        // No worker runs the queued tasks any more. They hold the graphs of the
+        // queries, whose processors must not be dropped with the executor: it may
+        // outlive what they need to shut down, e.g. the global runtimes. The flag
+        // is set before the lock is taken, so no task is queued after this.
+        let queued_tasks = workers_tasks.take_tasks();
         drop(workers_tasks);
+        drop(queued_tasks);
+
         for wakeup_worker in wakeup_workers {
             workers_condvar.wakeup(wakeup_worker);
         }
@@ -165,6 +181,9 @@ impl QueriesExecutorTasksQueue {
 
     pub fn init_sync_tasks(&self, tasks: VecDeque<ProcessorWrapper>, condvar: Arc<WorkersCondvar>) {
         let mut workers_tasks = self.workers_tasks.lock();
+        if self.is_finished() {
+            return;
+        }
 
         let mut worker_id = 0;
         for proc in tasks.into_iter() {
@@ -191,6 +210,9 @@ impl QueriesExecutorTasksQueue {
         condvar: Arc<WorkersCondvar>,
     ) {
         let mut workers_tasks = self.workers_tasks.lock();
+        if self.is_finished() {
+            return;
+        }
 
         let mut worker_id = 0;
         for proc in tasks.into_iter() {
@@ -208,6 +230,10 @@ impl QueriesExecutorTasksQueue {
 
     pub fn completed_async_task(&self, condvar: Arc<WorkersCondvar>, task: CompletedAsyncTask) {
         let mut workers_tasks = self.workers_tasks.lock();
+        if self.is_finished() {
+            condvar.dec_active_async_worker();
+            return;
+        }
         // The worker id of a waker is not always the id of a worker of this
         // executor, e.g. a fuse source passes its index among the sources.
         let workers = workers_tasks.workers_waiting_status.total_size();
@@ -248,6 +274,9 @@ impl QueriesExecutorTasksQueue {
         mut next_tasks: VecDeque<ExecutorTask>,
     ) {
         let mut workers_tasks = self.workers_tasks.lock();
+        if self.is_finished() {
+            return;
+        }
 
         if let Some(mut tasks) = current_tasks {
             while let Some(task) = tasks.pop_front() {
```

**File**: `src/query/service/src/pipelines/executor/queries_pipeline_executor.rs` (modified, +19/-0)
```diff
@@ -118,6 +118,12 @@ impl QueriesPipelineExecutor {
             let sync_queue = std::mem::take(&mut init_schedule_queue.sync_queue);
             self.global_tasks_queue
                 .init_sync_tasks(sync_queue, self.workers_condvar.clone());
+
+            // All its processors finished in their first event, so no worker runs
+            // a task of the graph that would finish it.
+            if graph.is_all_nodes_finished() {
+                graph.should_finish::<()>(Ok(()))?;
+            }
             Ok(())
         }
     }
@@ -222,6 +228,19 @@ impl QueriesPipelineExecutor {
 
                 while !self.global_tasks_queue.is_finished() && context.has_task() {
                     let task_info = context.get_task_info();
+                    // Counted before the check: a graph that finishes in between
+                    // waits for this task before running its finish callbacks.
+                    let _running_task = task_info
+                        .as_ref()
+                        .map(|(graph, _)| graph.track_running_task());
+                    if task_info
+                        .as_ref()
+                        .is_some_and(|(graph, _)| graph.is_should_finish())
+                    {
+                        drop(context.take_task());
+                        continue;
+                    }
+
                     let execute_res = catch_unwind(|| context.execute_task(Some(self)));
                     match execute_res {
                         Ok(res) => {
```

**File**: `src/query/service/src/test_kits/config.rs` (modified, +6/-0)
```diff
@@ -167,6 +167,12 @@ ADDRESS = 'https://databend.com';"
         self
     }
 
+    /// Run the queries on the executor shared by all the queries.
+    pub fn enable_queries_executor(mut self) -> ConfigBuilder {
+        self.conf.query.common.enable_queries_executor = true;
+        self
+    }
+
     pub fn table_meta_segment_bytes(mut self, value: u64) -> ConfigBuilder {
         self.conf.cache.table_meta_segment_bytes = value;
         self
```

---

### Incident Patch 2: `db269224` (2026-11-17)
**Commit Message**: fix(storage): bound fuse_page Thrift decoding and drop thrift dep (#21104)

* fix(storage): bound fuse_page Thrift decoding and drop thrift dep

* refactor(storage): extract bounded Thrift and Parquet page header readers

**File**: `Cargo.lock` (modified, +0/-12)
```diff
@@ -4290,7 +4290,6 @@ dependencies = [
  "tantivy",
  "tantivy-jieba",
  "tempfile",
- "thrift",
  "tokio",
  "typetag",
  "uuid",
@@ -15084,15 +15083,6 @@ dependencies = [
  "once_cell",
 ]
 
-[[package]]
-name = "threadpool"
-version = "1.8.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d050e60b33d41c19108b32cea32164033a9013fe3b46cbd4457559bfbf77afaa"
-dependencies = [
- "num_cpus",
-]
-
 [[package]]
 name = "thrift"
 version = "0.17.0"
@@ -15101,9 +15091,7 @@ checksum = "7e54bc85fc7faa8bc175c4bab5b92ba8d9a3ce893d0e9f42cc455c8ab16a9e09"
 dependencies = [
  "byteorder",
  "integer-encoding 3.0.4",
- "log",
  "ordered-float 2.10.1",
- "threadpool",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +0/-1)
```diff
@@ -477,7 +477,6 @@ terminal_size = "0.4.2"
 test-harness = "0.3.0"
 testcontainers = "0.23"
 thiserror = { version = "1" }
-thrift = "0.17.0"
 tikv-jemalloc-ctl = { version = "0.6.0", features = ["use_std", "stats"] }
 tikv-jemalloc-sys = "0.6.0"
 tokio = { version = "1.54.1", features = ["full"] }
```

**File**: `src/query/storages/common/blocks/src/lib.rs` (modified, +3/-0)
```diff
@@ -14,8 +14,11 @@
 
 #![allow(clippy::collapsible_if, clippy::uninlined_format_args)]
 
+mod parquet_page;
 mod parquet_rs;
 mod parquet_writer;
+pub mod thrift_compact;
+pub use parquet_page::*;
 pub use parquet_rs::*;
 pub use parquet_writer::*;
 pub mod memory;
```

**File**: `src/query/storages/common/blocks/src/parquet_page.rs` (added, +564/-0)
```diff
@@ -0,0 +1,564 @@
+// Copyright 2021 Datafuse Labs
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
+use databend_common_exception::ErrorCode;
+use databend_common_exception::Result;
+
+use crate::thrift_compact::CompactType;
+use crate::thrift_compact::ThriftCompactReader;
+
+const PAGE_TYPE_DATA_PAGE: i32 = 0;
+const PAGE_TYPE_INDEX_PAGE: i32 = 1;
+const PAGE_TYPE_DICTIONARY_PAGE: i32 = 2;
+const PAGE_TYPE_DATA_PAGE_V2: i32 = 3;
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub enum ParquetPageKind {
+    DataPageV1 {
+        num_values: u64,
+        encoding: i32,
+    },
+    DataPageV2 {
+        num_values: u64,
+        num_rows: u64,
+        encoding: i32,
+    },
+    DictionaryPage {
+        num_values: u64,
+        encoding: i32,
+    },
+    IndexPage,
+    Unknown(i32),
+}
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub struct ParquetPageHeader {
+    pub kind: ParquetPageKind,
+    pub compressed_size: u64,
+    pub uncompressed_size: u64,
+    pub header_size: u64,
+    pub page_offset: u64,
+}
+
+impl ParquetPageHeader {
+    pub fn is_index_page(&self) -> bool {
+        matches!(self.kind, ParquetPageKind::IndexPage)
+    }
+
+    pub fn page_type_name(&self) -> &'static str {
+        match self.kind {
+            ParquetPageKind::DataPageV1 { .. } => "data_page_v1",
+            ParquetPageKind::DataPageV2 { .. } => "data_page_v2",
+            ParquetPageKind::DictionaryPage { .. } => "dictionary",
+            ParquetPageKind::IndexPage => "index_page",
+            ParquetPageKind::Unknown(_) => "unknown",
+        }
+    }
+
+    pub fn encoding_name(&self) -> &'static str {
+        match self.kind {
+            ParquetPageKind::DataPageV1 { encoding, .. }
+            | ParquetPageKind::DataPageV2 { encoding, .. }
+            | ParquetPageKind::DictionaryPage { encoding, .. } => parquet_encoding_name(encoding),
+            ParquetPageKind::IndexPage | ParquetPageKind::Unknown(_) => "unknown",
+        }
+    }
+
+    pub fn num_values(&self) -> u64 {
+        match self.kind {
+            ParquetPageKind::DataPageV1 { num_values, .. }
+            | ParquetPageKind::DataPageV2 { num_values, .. }
+            | ParquetPageKind::DictionaryPage { num_values, .. } => num_values,
+            ParquetPageKind::IndexPage | ParquetPageKind::Unknown(_) => 0,
+        }
+    }
+
+    pub fn num_rows(&self) -> Option<u64> {
+        match self.kind {
+            ParquetPageKind::DataPageV1 { num_values, .. } => Some(num_values),
+            ParquetPageKind::DataPageV2 { num_rows, .. } => Some(num_rows),
+            ParquetPageKind::DictionaryPage { .. }
+            | ParquetPageKind::IndexPage
+            | ParquetPageKind::Unknown(_) => None,
+        }
+    }
+}
+
+pub fn parquet_encoding_name(encoding: i32) -> &'static str {
+    match encoding {
+        0 => "plain",
+        2 => "plain_dictionary",
+        3 => "rle",
+        4 => "bit_packed",
+        5 => "delta_binary_packed",
+        6 => "delta_length_byte_array",
+        7 => "delta_byte_array",
+        8 => "rle_dictionary",
+        9 => "byte_stream_split",
+        _ => "unknown",
+    }
+}
+
+/// Decodes a single Parquet `PageHeader` from the start of `input` without allocating.
+pub fn read_parquet_page_header(input: &[u8], page_offset: u64) -> Result<ParquetPageHeader> {
+    let mut reader = ThriftCompactReader::new(input);
+    let mut page_type = None;
+    let mut uncompressed_size = None;
+    let mut compressed_size = None;
+    let mut data_v1 = None;
+    let mut dict = None;
+    let mut data_v2 = None;
+
+    reader.read_root_struct(|r, field_id, ty| {
+        match field_id {
+            1 => page_type = Some(r.read_i32(ty)?),
+            2 => uncompressed_size = Some(r.read_i32(ty)?),
+            3 => compressed_size = Some(r.read_i32(ty)?),
+            4 => {
+                let _ = r.read_i32(ty)?;
+            }
+            5 => data_v1 = Some(read_data_page_v1(r, ty)?),
+            6 => r.read_struct(ty, |r, _, ty| r.skip_value(ty))?,
+            7 => dict = Some(read_dictionary_page(r, ty)?),
+            8 => data_v2 = Some(read_data_page_v2(r, ty)?),
+            _ => r.skip_value(ty)?,
+        }
+        Ok(())
+    })?;
+
+    let header_size = (input.len() - reader.remaining()) as u64;
+    let page_type = required_field(page_type, "PageHeader.type")?;
+    let uncompressed_size = non_negative_i32(
+        required_field(uncompressed_size, "PageHead
```

**File**: `src/query/storages/common/blocks/src/thrift_compact.rs` (added, +319/-0)
```diff
@@ -0,0 +1,319 @@
+// Copyright 2021 Datafuse Labs
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
+use databend_common_exception::ErrorCode;
+use databend_common_exception::Result;
+
+const MAX_VARINT32_BYTES: usize = 5;
+const MAX_VARINT64_BYTES: usize = 10;
+pub const DEFAULT_MAX_THRIFT_DEPTH: usize = 64;
+
+/// Wire types in the Thrift Compact Protocol.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub enum CompactType {
+    /// Struct boolean field whose value is encoded in the field header nibble.
+    InlineBool(bool),
+    /// Collection boolean element stored as a 1-byte value (`0x00..=0x02`).
+    Bool,
+    I8,
+    I16,
+    I32,
+    I64,
+    Double,
+    Binary,
+    List,
+    Set,
+    Map,
+    Struct,
+    Uuid,
+}
+
+impl CompactType {
+    fn from_common_nibble(nibble: u8) -> Result<Self> {
+        match nibble {
+            0x03 => Ok(Self::I8),
+            0x04 => Ok(Self::I16),
+            0x05 => Ok(Self::I32),
+            0x06 => Ok(Self::I64),
+            0x07 => Ok(Self::Double),
+            0x08 => Ok(Self::Binary),
+            0x09 => Ok(Self::List),
+            0x0A => Ok(Self::Set),
+            0x0B => Ok(Self::Map),
+            0x0C => Ok(Self::Struct),
+            0x0D => Ok(Self::Uuid),
+            other => Err(thrift_err(format!(
+                "unknown Thrift compact wire type {other}"
+            ))),
+        }
+    }
+
+    fn from_field_nibble(nibble: u8) -> Result<Self> {
+        match nibble {
+            0x01 => Ok(Self::InlineBool(true)),
+            0x02 => Ok(Self::InlineBool(false)),
+            other => Self::from_common_nibble(other),
+        }
+    }
+
+    fn from_elem_nibble(nibble: u8) -> Result<Self> {
+        match nibble {
+            // Both 0x01 and 0x02 are valid for collection booleans per the Thrift compact spec.
+            0x01 | 0x02 => Ok(Self::Bool),
+            other => Self::from_common_nibble(other),
+        }
+    }
+
+    fn min_wire_size(self) -> usize {
+        match self {
+            Self::InlineBool(_) => 0,
+            Self::Double => 8,
+            Self::Uuid => 16,
+            _ => 1,
+        }
+    }
+}
+
+/// Bounded, zero-allocation Thrift Compact Protocol reader over an in-memory byte slice.
+///
+/// Binary and container lengths are validated against the remaining slice before advancing,
+/// avoiding eager heap allocations from untrusted length prefixes.
+pub struct ThriftCompactReader<'a> {
+    buf: &'a [u8],
+    depth_budget: usize,
+}
+
+impl<'a> ThriftCompactReader<'a> {
+    pub fn new(buf: &'a [u8]) -> Self {
+        Self {
+            buf,
+            depth_budget: DEFAULT_MAX_THRIFT_DEPTH,
+        }
+    }
+
+    pub fn remaining(&self) -> usize {
+        self.buf.len()
+    }
+
+    pub fn read_byte(&mut self) -> Result<u8> {
+        let (&b, rest) = self
+            .buf
+            .split_first()
+            .ok_or_else(|| thrift_err("unexpected EOF"))?;
+        self.buf = rest;
+        Ok(b)
+    }
+
+    pub fn read_slice(&mut self, len: usize) -> Result<&'a [u8]> {
+        let (head, tail) = self
+            .buf
+            .split_at_checked(len)
+            .ok_or_else(|| thrift_err("unexpected EOF"))?;
+        self.buf = tail;
+        Ok(head)
+    }
+
+    pub fn read_varint32(&mut self) -> Result<u32> {
+        let mut result = 0u32;
+        let mut shift = 0u32;
+        for _ in 0..MAX_VARINT32_BYTES {
+            let b = self.read_byte()?;
+            result |= u32::from(b & 0x7F) << shift;
+            if b & 0x80 == 0 {
+                return Ok(result);
+            }
+            shift += 7;
+        }
+        Err(thrift_err("varint32 exceeds 5 bytes"))
+    }
+
+    pub fn read_zigzag_i32(&mut self) -> Result<i32> {
+        let n = self.read_varint32()?;
+        Ok(((n >> 1) as i32) ^ -(n as i32 & 1))
+    }
+
+    pub fn read_bool(&mut self, ty: CompactType) -> Result<bool> {
+        match ty {
+            CompactType::InlineBool(v) => Ok(v),
+            CompactType::Bool => match self.read_byte()? {
+                0x01 => Ok(true),
+                0x00 | 0x02 => Ok(false),
+                other => Err(thrift_err(format!("invalid boolean value {other}"))),
+            },
+            other => Err(unexpected_type(other, "Bool")),
+        }
+    }
+
+    pub fn read_i32(&mut self, ty: CompactType) -> Result<i32> {
+        if ty != CompactType::I32 {
+            return Err(unexpected_type(ty, "I32"));
+        }
+
```

**File**: `src/query/storages/fuse/Cargo.toml` (modified, +0/-1)
```diff
@@ -80,7 +80,6 @@ siphasher = { workspace = true }
 tantivy = { workspace = true }
 tantivy-jieba = { workspace = true }
 tempfile = { workspace = true }
-thrift = { workspace = true }
 tokio = { workspace = true }
 typetag = { workspace = true }
 uuid = { workspace = true }
```

**File**: `src/query/storages/fuse/src/table_functions/fuse_page.rs` (modified, +18/-189)
```diff
@@ -1,5 +1,3 @@
-#![allow(deprecated)]
-
 // Copyright 2021 Datafuse Labs
 //
 // Licensed under the Apache License, Version 2.0 (the "License");
@@ -14,7 +12,6 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use std::io::Read;
 use std::sync::Arc;
 
 use databend_common_catalog::table::Table;
@@ -33,14 +30,11 @@ use databend_common_expression::types::StringType;
 use databend_common_expression::types::TimestampType;
 use databend_common_expression::types::UInt64Type;
 use databend_common_expression::types::string::StringColumnBuilder;
+use databend_storages_common_blocks::iter_parquet_page_headers;
 use databend_storages_common_cache::CachePolicy;
 use databend_storages_common_table_meta::meta::SegmentInfo;
 use databend_storages_common_table_meta::meta::TableSnapshot;
 use opendal::Operator;
-use parquet::format::PageHeader;
-use parquet::format::PageType;
-use parquet::thrift::TSerializable;
-use thrift::protocol::TCompactInputProtocol;
 
 use crate::FuseStorageFormat;
 use crate::FuseTable;
@@ -52,18 +46,6 @@ use crate::table_functions::function_template::TableMetaFunc;
 pub struct FusePage;
 pub type FusePageFunc = TableMetaFuncTemplate<FusePage>;
 
-struct PageMetaRow<'a> {
-    column_name: &'a str,
-    page_type: &'static str,
-    encoding: &'static str,
-    num_values: u64,
-    num_rows: Option<u64>,
-    compressed_size: u64,
-    uncompressed_size: u64,
-    header_size: u64,
-    page_offset: u64,
-}
-
 #[async_trait::async_trait]
 impl TableMetaFunc for FusePage {
     fn schema() -> Arc<TableSchema> {
@@ -164,26 +146,29 @@ impl TableMetaFunc for FusePage {
                             parquet_meta.len,
                         )
                         .await?;
-                        for (page_ordinal_in_column, page) in parse_page_headers(
+                        let mut page_ordinal_in_column = 0u64;
+                        for page in iter_parquet_page_headers(
                             field.name(),
                             parquet_meta.offset,
-                            column_bytes.as_slice(),
-                        )?
-                        .into_iter()
-                        .enumerate()
-                        {
+                            column_bytes.as_ref(),
+                        ) {
+                            let page = page?;
+                            if page.is_index_page() {
+                                continue;
+                            }
                             block_location.put_and_commit(&block.location.0);
-                            column_name.put_and_commit(page.column_name);
-                            page_type.put_and_commit(page.page_type);
-                            encoding.put_and_commit(page.encoding);
-                            page_ordinal.push(page_ordinal_in_column as u64);
-                            num_values.push(page.num_values);
-                            num_rows.push(page.num_rows);
+                            column_name.put_and_commit(field.name());
+                            page_type.put_and_commit(page.page_type_name());
+                            encoding.put_and_commit(page.encoding_name());
+                            page_ordinal.push(page_ordinal_in_column);
+                            num_values.push(page.num_values());
+                            num_rows.push(page.num_rows());
                             compressed_size.push(page.compressed_size);
                             uncompressed_size.push(page.uncompressed_size);
                             header_size.push(page.header_size);
                             page_offset.push(page.page_offset);
 
+                            page_ordinal_in_column += 1;
                             rows += 1;
                             if rows >= limit {
                                 break 'FOR;
@@ -220,7 +205,7 @@ async fn read_parquet_column_chunk(
     location: &str,
     offset: u64,
     len: u64,
-) -> Result<Vec<u8>> {
+) -> Result<bytes::Bytes> {
     let end = offset.checked_add(len).ok_or_else(|| {
         ErrorCode::ParquetFileInvalid(format!(
             "invalid parquet file {}, column chunk length overflow",
@@ -232,161 +217,5 @@ async fn read_parquet_column_chunk(
         .range(offset..end)
         .await
         .map_err(|err| ErrorCode::StorageOther(err.to_string()))?;
-    Ok(buffer.to_vec())
-}
-
-fn parse_page_headers<'a>(
-    column_name: &'a str,
-    column_offset: u64,
-    column_bytes: &'a [u8],
-) -> Result<Vec<PageMetaRow<'a>>> {
-    let mut cursor = std::io::Cursor::new(column_bytes);
-    let total_len = column_bytes.len() as u64;
-    let mut pages = Vec::new();
-
-    while cursor.position() < total_len {
-        let header_offset = cursor.position();
-        let (header_len, header) = read_page_header_len(&mut cursor)?;
-        let compressed_size =
-            convert_i32_to_u64(header.compressed_page_size, "compresse
```

---

### Incident Patch 3: `9012edc8` (2026-11-17)
**Commit Message**: fix(query): correct HNSW graph construction and SQ8 scoring in vector indexes (#21097)

* fix(query): correct HNSW graph construction and SQ8 scoring in vector indexes

* fix calibration_count = 0

**File**: `src/query/service/tests/it/indexes/vector_index/pruning.rs` (modified, +30/-57)
```diff
@@ -741,13 +741,13 @@ async fn test_block_pruner() -> anyhow::Result<()> {
         // Third query: l2_distance with query_values1
         vec![
             vec![
-                VectorScoreResult::new(0, 0, 0, 3.5187712),
-                VectorScoreResult::new(0, 0, 9, 3.5518785),
+                VectorScoreResult::new(0, 0, 0, 0.0),
+                VectorScoreResult::new(0, 0, 9, 0.4838298),
+                VectorScoreResult::new(0, 0, 1, 0.59597003),
             ],
             vec![
-                VectorScoreResult::new(1, 3, 6, 3.4702706),
-                VectorScoreResult::new(1, 3, 7, 3.5206928),
-                VectorScoreResult::new(1, 3, 1, 3.556445),
+                VectorScoreResult::new(1, 0, 9, 0.51379997),
+                VectorScoreResult::new(1, 0, 5, 0.58313537),
             ],
         ],
         // Fourth query: cosine_distance with query_values2
@@ -771,12 +771,17 @@ async fn test_block_pruner() -> anyhow::Result<()> {
             ],
         ],
         // Sixth query: l2_distance with query_values2
-        vec![vec![VectorScoreResult::new(1, 1, 8, 3.4763064)], vec![
-            VectorScoreResult::new(1, 3, 5, 3.4903116),
-            VectorScoreResult::new(1, 3, 9, 3.4926815),
-            VectorScoreResult::new(1, 3, 0, 3.527872),
-            VectorScoreResult::new(1, 3, 8, 3.560473),
-        ]],
+        vec![
+            vec![
+                VectorScoreResult::new(0, 1, 6, 0.48633155),
+                VectorScoreResult::new(0, 1, 5, 0.7715289),
+            ],
+            vec![VectorScoreResult::new(1, 1, 8, 0.0)],
+            vec![
+                VectorScoreResult::new(1, 4, 8, 0.47685158),
+                VectorScoreResult::new(1, 4, 7, 0.71438366),
+            ],
+        ],
     ];
 
     let mut extras = Vec::new();
@@ -887,32 +892,17 @@ async fn test_block_pruner() -> anyhow::Result<()> {
                 VectorScoreResult::new(1, 0, 9, 0.7167929),
             ],
         ],
-        // Third query: l2_distance with filter and query_values1
+        // Third query: l2_distance with filter and query_values1. L2 scores are
+        // small, so few rows pass `> 2.0`; these are the TopN rows themselves,
+        // which `filtered_topn` leaves unchanged.
         vec![
+            vec![VectorScoreResult::new(0, 0, 7, 2.1106725)],
             vec![
-                VectorScoreResult::new(0, 0, 0, 3.5187712),
-                VectorScoreResult::new(0, 0, 1, 3.5688834),
-                VectorScoreResult::new(0, 0, 2, 4.158467),
-                VectorScoreResult::new(0, 0, 3, 3.8972623),
-                VectorScoreResult::new(0, 0, 4, 3.9402654),
-                VectorScoreResult::new(0, 0, 5, 3.8295133),
-                VectorScoreResult::new(0, 0, 6, 4.16049),
-                VectorScoreResult::new(0, 0, 7, 4.1032534),
-                VectorScoreResult::new(0, 0, 8, 4.2184787),
-                VectorScoreResult::new(0, 0, 9, 3.5518785),
-            ],
-            vec![
-                VectorScoreResult::new(1, 3, 0, 3.9212408),
-                VectorScoreResult::new(1, 3, 1, 3.556445),
-                VectorScoreResult::new(1, 3, 2, 3.7241573),
-                VectorScoreResult::new(1, 3, 3, 4.1835504),
-                VectorScoreResult::new(1, 3, 4, 3.6078227),
-                VectorScoreResult::new(1, 3, 5, 3.5779395),
-                VectorScoreResult::new(1, 3, 6, 3.4702706),
-                VectorScoreResult::new(1, 3, 7, 3.5206928),
-                VectorScoreResult::new(1, 3, 8, 3.8251386),
-                VectorScoreResult::new(1, 3, 9, 3.616931),
+                VectorScoreResult::new(0, 3, 6, 2.0039008),
+                VectorScoreResult::new(0, 3, 1, 2.0506036),
             ],
+            vec![VectorScoreResult::new(1, 0, 6, 2.0104616)],
+            vec![VectorScoreResult::new(1, 1, 4, 2.070966)],
         ],
         // Fourth query: cosine_distance with filter and query_values2
         vec![],
@@ -967,32 +957,15 @@ async fn test_block_pruner() -> anyhow::Result<()> {
                 VectorScoreResult::new(1, 3, 9, 2.011335),
             ],
         ],
-        // Sixth query: l2_distance with filter and query_values2
+        // Sixth query: l2_distance with filter and query_values2, TopN rows as above.
         vec![
             vec![
-                VectorScoreResult::new(1, 1, 0, 3.819309),
-                VectorScoreResult::new(1, 1, 1, 3.8105543),
-                VectorScoreResult::new(1, 1, 2, 3.8291273),
-                VectorScoreResult::new(1, 1, 3, 3.7389958),
-                VectorScoreResult::new(1, 1, 4, 3.5913217),
-                VectorScoreResult::new(1, 1, 5, 3.870244),
-                VectorScoreResult::new(1, 1, 6, 3.7941854),
-                VectorScoreResult::new(1, 1, 7, 3.585766),
-                VectorScoreResult::new(1, 1, 8, 3.4763064),
-                VectorScoreResult::new(1, 1, 9, 3.709784),
-            ],
-            vec![
-                VectorScoreResult::new(1,
```

**File**: `src/query/storages/common/index/src/hnsw_index/graph_layers_builder.rs` (modified, +59/-3)
```diff
@@ -248,13 +248,18 @@ impl GraphLayersBuilder {
 
     /// Map a uniform `[0, 1)` sample to a geometric level.
     ///
+    /// With `level_factor = 1 / ln(m)`, `floor` gives `P(level >= l) = m^-l`,
+    /// the distribution from the HNSW paper: 1 in `m` points reaches level 1.
+    /// Rounding instead would give `m^-(l - 0.5)`, putting 4x as many points on
+    /// level 1 at `m = 16` and growing the upper layers with no search benefit.
+    ///
     /// `Uniform::new(0.0, 1.0)` is half-open, so `sample` can be exactly `0.0`.
-    /// `ln(0.0)` is `-inf`, and `(-(-inf) * factor).round() as usize` saturates
+    /// `ln(0.0)` is `-inf`, and `(-(-inf) * factor).floor() as usize` saturates
     /// to `usize::MAX`, which then makes `set_levels` allocate unboundedly.
     /// Clamp to the smallest positive `f64` so the level stays bounded (qdrant#9959).
     fn level_from_sample(sample: f64, level_factor: f64) -> usize {
         let sample = sample.max(f64::MIN_POSITIVE);
-        (-sample.ln() * level_factor).round() as usize
+        (-sample.ln() * level_factor).floor() as usize
     }
 
     pub(crate) fn get_point_level(&self, point_id: PointOffsetType) -> usize {
@@ -468,8 +473,13 @@ impl GraphLayersBuilder {
 
 #[cfg(test)]
 mod tests {
+    use rand::SeedableRng as _;
+    use rand::rngs::SmallRng;
+
     use super::*;
 
+    const M: usize = 8;
+
     #[test]
     fn test_level_from_sample() {
         // A zero uniform sample used to make ln(0) = -inf and saturate the
@@ -482,6 +492,52 @@ mod tests {
         );
         // Other samples keep their level.
         assert_eq!(GraphLayersBuilder::level_from_sample(0.5, level_factor), 0);
-        assert_eq!(GraphLayersBuilder::level_from_sample(0.1, level_factor), 1);
+        assert_eq!(GraphLayersBuilder::level_from_sample(0.05, level_factor), 1);
+    }
+
+    #[test]
+    fn level_from_sample_level_boundaries() {
+        // A point reaches level `l` exactly when `sample <= m^-l`.
+        let m = M as f64;
+        let level_factor = 1.0 / m.ln();
+        let level = |sample: f64| GraphLayersBuilder::level_from_sample(sample, level_factor);
+
+        assert_eq!(level(0.99), 0);
+        assert_eq!(level(1.1 / m), 0);
+        assert_eq!(level(0.9 / m), 1);
+        assert_eq!(level(1.1 / (m * m)), 1);
+        assert_eq!(level(0.9 / (m * m)), 2);
+        // Rounding would put this sample on level 1 (`-ln(0.2) / ln(8) = 0.77`).
+        assert_eq!(level(0.2), 0);
+    }
+
+    #[test]
+    fn get_random_layer_follows_geometric_distribution() {
+        let level_factor = 1.0 / (M as f64).ln();
+        let distribution = Uniform::new(0.0, 1.0);
+        let mut rng = SmallRng::seed_from_u64(42);
+        let samples: u32 = 1_000_000;
+
+        let mut at_or_above = [0usize; 4];
+        for _ in 0..samples {
+            let sample: f64 = rng.sample(distribution);
+            let level = GraphLayersBuilder::level_from_sample(sample, level_factor);
+            for (l, count) in at_or_above.iter_mut().enumerate() {
+                if level >= l {
+                    *count += 1;
+                }
+            }
+        }
+
+        // `P(level >= l) = M^-l`
+        for (l, &count) in at_or_above.iter().enumerate().skip(1) {
+            let expected = f64::from(samples) * (M as f64).powi(-i32::try_from(l).unwrap());
+            let observed = count as f64;
+            let tolerance = 5.0 * expected.sqrt() + 1.0;
+            assert!(
+                (observed - expected).abs() <= tolerance,
+                "level >= {l}: observed {observed}, expected {expected:.0} +- {tolerance:.0}",
+            );
+        }
     }
 }
```

**File**: `src/query/storages/common/index/src/hnsw_index/hnsw.rs` (modified, +3/-0)
```diff
@@ -397,8 +397,11 @@ impl HNSWIndex {
         };
 
         let builder = Vec::new();
+        // NULL rows hold a placeholder vector: encode them to keep point ids as
+        // block rows, but fit the value range on the real vectors only.
         let encoded_vectors = EncodedVectorsU8::encode(
             (0..params.count).map(|i| &data.as_ref()[i * params.dim..(i + 1) * params.dim]),
+            (0..params.count).map(|i| validity.as_ref().is_none_or(|bitmap| bitmap.get_bit(i))),
             builder,
             &params,
             None,
```

**File**: `src/query/storages/common/index/src/hnsw_index/links_container.rs` (modified, +83/-9)
```diff
@@ -14,9 +14,8 @@
 // limitations under the License.
 
 // Ported from qdrant `lib/segment/src/index/hnsw_index/links_container.rs`
-// (v1.20.0, "Heuristic optimization", qdrant#6501). The redundancy test keeps the
-// strict comparison of the original heuristic, so the selected links are the same.
-// Unlike qdrant, the first link is also marked as processed.
+// (v1.20.0, "Heuristic optimization", qdrant#6501), with the redundancy test of
+// qdrant#10239. Unlike qdrant, the first link is also marked as processed.
 
 use std::cell::Cell;
 use std::iter::Copied;
@@ -25,11 +24,28 @@ use crate::hnsw_index::common::types::PointOffsetType;
 use crate::hnsw_index::common::types::ScoreType;
 use crate::hnsw_index::common::types::ScoredPointOffset;
 
-/// Neighbour-selection ("not closer than base") test: a candidate is dropped when
-/// an already selected link is closer to it than the target is.
+/// Neighbour-selection ("not closer than base") test.
+///
+/// A candidate is dropped when an already selected link is closer to it than the
+/// target is. The comparison is strict, *except* between candidates that are
+/// exactly equidistant from the target: without that exception a group of
+/// byte-identical vectors is mutually non-pruning and fills every link slot,
+/// turning the group into a sink with no edges leaving it.
+///
+/// Restricting the non-strict comparison to `candidate_score == existing_score`
+/// keeps ordinary (non-duplicate) candidates unaffected: for them the equality
+/// case has measure zero.
 #[inline]
-fn is_redundant(candidate_to_existing: ScoreType, candidate_score: ScoreType) -> bool {
-    candidate_to_existing > candidate_score
+fn is_redundant(
+    candidate_to_existing: ScoreType,
+    candidate_score: ScoreType,
+    existing_score: ScoreType,
+) -> bool {
+    if candidate_score == existing_score {
+        candidate_to_existing >= candidate_score
+    } else {
+        candidate_to_existing > candidate_score
+    }
 }
 
 /// The links of a point on one level, sorted from the closest, and how many of
@@ -85,13 +101,20 @@ impl LinksContainer {
             self.processed_by_heuristic = 0;
             return;
         }
+        // Scores of the already selected links, to detect exact ties (see `is_redundant`).
+        let mut selected_scores: Vec<ScoreType> = Vec::with_capacity(level_m);
         'outer: for candidate in candidates {
-            for &existing in &self.links {
-                if is_redundant(score(candidate.idx, existing), candidate.score) {
+            for (&existing, &existing_score) in self.links.iter().zip(&selected_scores) {
+                if is_redundant(
+                    score(candidate.idx, existing),
+                    candidate.score,
+                    existing_score,
+                ) {
                     continue 'outer;
                 }
             }
             self.links.push(candidate.idx);
+            selected_scores.push(candidate.score);
             if self.links.len() >= level_m {
                 break;
             }
@@ -213,6 +236,7 @@ impl LinksContainer {
                 if is_redundant(
                     score(candidate.idx, existing.idx),
                     candidate.cached_score(target_point_id, &mut score),
+                    existing.cached_score(target_point_id, &mut score),
                 ) {
                     continue 'outer;
                 }
@@ -387,6 +411,56 @@ mod tests {
         assert_eq!(links_container.links(), &[1, 2, 3, 4, 5, 6]);
     }
 
+    /// A group of byte-identical vectors must not consume each other's whole link
+    /// budget: every copy is equidistant from every other, so under a strictly
+    /// greater comparison none of them prunes any other and the group ends up as a
+    /// sink at level 0 with no edges leaving it.
+    #[test]
+    fn test_exact_duplicates_do_not_fill_the_link_list() {
+        const M: usize = 6;
+        const COPIES: usize = 8;
+
+        // Point 0 is the target. Points 1..=COPIES are byte-identical to it.
+        // The remaining points are ordinary neighbours, all a little further away.
+        let mut points: Vec<Vec<f32>> = vec![vec![0.0, 0.0]; COPIES + 1];
+        points.extend([vec![1.0, 0.0], vec![0.0, 1.0], vec![-1.0, 0.0], vec![
+            0.0, -1.0,
+        ]]);
+        let scorer = |a: PointOffsetType, b: PointOffsetType| {
+            -((points[a as usize][0] - points[b as usize][0]).powi(2)
+                + (points[a as usize][1] - points[b as usize][1]).powi(2))
+            .sqrt()
+        };
+
+        let mut candidates = FixedLengthPriorityQueue::new(points.len() - 1);
+        for id in 1..points.len() as PointOffsetType {
+            candidates.push(ScoredPointOffset {
+                idx: id,
+                score: scorer(0, id),
+            });
+        }
+
+        let mut container = LinksContainer::with_capacity(M);
+        container.fill_from_sorted_with_heuristic(candidates.into_iter_sorted(),
```

**File**: `src/query/storages/common/index/src/hnsw_index/point_scorer.rs` (modified, +1/-0)
```diff
@@ -248,6 +248,7 @@ mod tests {
         };
         let encoded = EncodedVectorsU8::encode(
             data.chunks(dim),
+            std::iter::repeat_n(true, count),
             Vec::new(),
             &params,
             None,
```

**File**: `src/query/storages/common/index/src/hnsw_index/quantization/encoded_vectors.rs` (modified, +50/-0)
```diff
@@ -79,6 +79,25 @@ impl DistanceType {
     }
 }
 
+/// The vectors of `data` to fit the quantization parameters on, and how many there are.
+///
+/// `keep` holds one flag per vector of `data`, set for the vectors to fit on.
+pub(crate) fn calibration_vectors<V>(
+    data: impl Iterator<Item = V> + Clone,
+    keep: impl Iterator<Item = bool> + Clone,
+) -> (impl Iterator<Item = V> + Clone, usize) {
+    debug_assert_eq!(
+        keep.clone().count(),
+        data.clone().count(),
+        "calibration mask must have one flag per vector",
+    );
+    let count = keep.clone().filter(|&keep| keep).count();
+    let vectors = data
+        .zip(keep)
+        .filter_map(|(vector, keep)| keep.then_some(vector));
+    (vectors, count)
+}
+
 pub(crate) fn validate_vector_parameters<'a>(
     data: impl Iterator<Item = impl AsRef<[f32]> + 'a> + Clone,
     vector_parameters: &VectorParameters,
@@ -103,3 +122,34 @@ pub(crate) fn validate_vector_parameters<'a>(
     }
     Ok(())
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_calibration_vectors() {
+        let data = [[1.0f32], [2.0], [3.0]];
+        let (vectors, count) = calibration_vectors(data.iter(), [true, false, true].into_iter());
+        assert_eq!(count, 2);
+        assert_eq!(vectors.collect::<Vec<_>>(), [&[1.0], &[3.0]]);
+    }
+
+    #[test]
+    #[cfg(debug_assertions)]
+    #[should_panic(expected = "calibration mask must have one flag per vector")]
+    fn test_calibration_vectors_rejects_short_mask() {
+        let data = [[1.0f32], [2.0], [3.0]];
+        let (vectors, _) = calibration_vectors(data.iter(), [true, true].into_iter());
+        vectors.for_each(drop);
+    }
+
+    #[test]
+    #[cfg(debug_assertions)]
+    #[should_panic(expected = "calibration mask must have one flag per vector")]
+    fn test_calibration_vectors_rejects_long_mask() {
+        let data = [[1.0f32], [2.0], [3.0]];
+        let (vectors, _) = calibration_vectors(data.iter(), [true; 4].into_iter());
+        vectors.for_each(drop);
+    }
+}
```

**File**: `src/query/storages/common/index/src/hnsw_index/quantization/encoded_vectors_u8.rs` (modified, +370/-46)
```diff
@@ -31,10 +31,15 @@ use crate::hnsw_index::quantization::encoded_storage::EncodedStorageBuilder;
 use crate::hnsw_index::quantization::encoded_vectors::DistanceType;
 use crate::hnsw_index::quantization::encoded_vectors::EncodedVectors;
 use crate::hnsw_index::quantization::encoded_vectors::VectorParameters;
+use crate::hnsw_index::quantization::encoded_vectors::calibration_vectors;
 use crate::hnsw_index::quantization::encoded_vectors::validate_vector_parameters;
 use crate::hnsw_index::quantization::quantile::find_min_max_from_iter;
 use crate::hnsw_index::quantization::quantile::find_quantile_interval;
 
+// Ported from qdrant `lib/quantization/src/encoded_vectors_u8.rs`. Deviation: a
+// constant range is widened in `alpha_offset_from_min_max`, qdrant quantizes it
+// with `alpha = 0`.
+
 pub const ALIGNMENT: usize = 16;
 
 pub struct EncodedVectorsU8<TStorage: EncodedStorage> {
@@ -61,15 +66,59 @@ struct Metadata {
     vector_parameters: VectorParameters,
 }
 
+impl Metadata {
+    #[inline]
+    fn postprocess_score(&self, score: f32, query_offset: f32, vector_offset: f32) -> f32 {
+        self.multiplier * score + query_offset + vector_offset
+    }
+
+    #[inline]
+    fn postprocess_internal_score(
+        &self,
+        score: f32,
+        vector_1_offset: f32,
+        vector_2_offset: f32,
+    ) -> f32 {
+        let query_offset = vector_1_offset - self.get_shift();
+        self.postprocess_score(score, query_offset, vector_2_offset)
+    }
+
+    fn get_shift(&self) -> f32 {
+        // Dotprod after shifting produces a number which is not related to vector and query
+        // (x - a)(y - a) = xy - ax - ay + a^2
+        // this a^2 is returned here
+        let shift = match self.vector_parameters.distance_type {
+            DistanceType::Dot => self.actual_dim as f32 * self.offset * self.offset,
+            // L2 is computed from squared code differences. The common quantizer offset cancels
+            // before squaring, so adding an absolute offset^2 shift would make scores depend on
+            // translating all vectors and the query by the same constant.
+            DistanceType::L1 | DistanceType::L2 => 0.0,
+        };
+        if self.vector_parameters.invert {
+            -shift
+        } else {
+            shift
+        }
+    }
+}
+
 impl EncodedVectorsU8<HugePageBytes> {
     pub(crate) fn memory_size(&self) -> usize {
         std::mem::size_of::<Self>() + self.encoded_vectors.capacity()
     }
 }
 
 impl<TStorage: EncodedStorage> EncodedVectorsU8<TStorage> {
+    /// Encode vector data using scalar quantization.
+    ///
+    /// Every vector of `orig_data` is encoded, but the value range (min/max or quantile) is
+    /// fitted only on the vectors whose flag in `keep` is set. `keep` holds one flag per vector;
+    /// clear the flags of vectors that are not real (e.g. the placeholders of NULL vectors).
+    /// If no flag is set while `orig_data` is not empty, no vector is real, so no score matters,
+    /// and a zero range is used.
     pub fn encode<'a>(
         orig_data: impl Iterator<Item = impl AsRef<[f32]> + 'a> + Clone,
+        keep: impl Iterator<Item = bool> + Clone,
         mut storage_builder: impl EncodedStorageBuilder<TStorage>,
         vector_parameters: &VectorParameters,
         quantile: Option<f32>,
@@ -92,12 +141,17 @@ impl<TStorage: EncodedStorage> EncodedVectorsU8<TStorage> {
         }
 
         debug_assert!(validate_vector_parameters(orig_data.clone(), vector_parameters).is_ok());
-        let (alpha, offset) = Self::find_alpha_offset_size_dim(orig_data.clone());
+        let (calibration_data, calibration_count) = calibration_vectors(orig_data.clone(), keep);
+        let (alpha, offset) = if calibration_count == 0 {
+            (0.0, 0.0)
+        } else {
+            Self::find_alpha_offset_size_dim(calibration_data.clone())
+        };
         let (alpha, offset) = if let Some(quantile) = quantile {
             if let Some((min, max)) = find_quantile_interval(
-                orig_data.clone(),
+                calibration_data,
                 vector_parameters.dim,
-                vector_parameters.count,
+                calibration_count,
                 quantile,
             ) {
                 Self::alpha_offset_from_min_max(min, max)
@@ -108,6 +162,30 @@ impl<TStorage: EncodedStorage> EncodedVectorsU8<TStorage> {
             (alpha, offset)
         };
 
+        let multiplier = match vector_parameters.distance_type {
+            // (alpha*x - offset) * (alpha*y - offset) = alpha^2*x*y - alpha*offset*x - alpha*offset*y + offset^2
+            // multiplier is applied to xy term only, so we need to multiply score by alpha^2
+            DistanceType::Dot => alpha * alpha,
+            // |(alpha*x - offset) - (alpha*y - offset)| = alpha*|x - y|
+            // multiplier is applied to |x - y| term only, so we need to multiply score by alpha
+            DistanceType::L1 => alpha,
+            // ((alpha*
```

**File**: `tests/sqllogictests/suites/query/index/09_vector_index/09_0000_vector_index_base.test` (modified, +12/-10)
```diff
@@ -177,14 +177,16 @@ SELECT id, l1_distance(embedding, [0.02559146, 0.38549544, 0.77889671, 0.3159103
 2 1.8405688
 11 1.8465419
 
+# Row 1 is the query vector: its SQ8 distance is the quantization error alone,
+# not shifted by the quantizer offset of its block.
 query IR
 SELECT id, l2_distance(embedding, [0.50515236, 0.8561939, 0.87169914, 0.55843271, 0.73689797, 0.49985862, 0.64527255, 0.29313098]::vector(8)) AS similarity FROM t ORDER BY similarity ASC LIMIT 5;
 ----
-1 0.052975703
-10 0.73442644
-12 0.84724534
-8 0.92271036
-3 0.9368646
+1 0.00069053395
+10 0.6369769
+12 0.764318
+8 0.9160794
+3 0.9353659
 
 query IR
 SELECT id, l2_distance(embedding, [0.50515236, 0.8561939, 0.87169914, 0.55843271, 0.73689797, 0.49985862, 0.64527255, 0.29313098]::vector(8)) AS similarity FROM t1 ORDER BY similarity ASC LIMIT 5;
@@ -198,11 +200,11 @@ SELECT id, l2_distance(embedding, [0.50515236, 0.8561939, 0.87169914, 0.55843271
 query IR
 SELECT id, l2_distance(embedding, [0.02559146, 0.38549544, 0.77889671, 0.31591033, 0.48453478, 0.51902057, 0.74154714, 0.75059576]::vector(8)) AS similarity FROM t ORDER BY similarity ASC LIMIT 5;
 ----
-4 0.41017252
-16 0.69951516
-6 0.73418504
-2 0.7379028
-11 0.8144757
+4 0.4067377
+16 0.6988953
+6 0.72583383
+11 0.7278242
+2 0.73599905
 
 query IR
 SELECT id, l2_distance(embedding, [0.02559146, 0.38549544, 0.77889671, 0.31591033, 0.48453478, 0.51902057, 0.74154714, 0.75059576]::vector(8)) AS similarity FROM t1 ORDER BY similarity ASC LIMIT 5;
```

#### Recent Merged Pull Requests:
- **PR #21111** (2026-11-17): fix(query): finish queries correctly on the queries executor (@bohutang)
- **PR #21104** (2026-11-17): fix(storage): bound fuse_page Thrift decoding and drop thrift dep (@sundy-li)
- **PR #21102** (2026-11-17): refactor(storage): look up search pin ranges by start (@bohutang)
- **PR #21101** (closed): [EXPERIMENTAL - DO NOT MERGE] feat(query): add /v1/data/search and speed up full-text top-k search (@bohutang)
- **PR #21099** (2026-11-16): fix(meta): decode BLOOM table index type; default cache.data_max_ratio to 0 (@zhang2014)
- **PR #21097** (2026-11-17): fix(query): correct HNSW graph construction and SQ8 scoring in vector indexes (@b41sh)

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

## X. query): finish queries correctly on the queries executor

**RULE**:
When implementing operations in `src/query/pipeline/src/sinks/async_sink.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `58dd5893`: query): finish queries correctly on the queries executor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/pipeline/src/sinks/async_sink.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            let run_on_start = !self.called_on_start && T::CALL_ON_START_ON_ERROR;
            let run_on_finish = !self.called_on_finish && T::CALL_ON_FINISH_ON_ERROR;
            // Nothing to run: do not touch the global runtime, which a sink
            // dropped late may outlive.
            if !run_on_start && !run_on_finish {
                return;
            }

            if let Some(mut inner) = self.inner.take() {
                GlobalIORuntime::instance().spawn(async move {
                    if run_on_start {
                        let _ = inner.on_start().await;
                    }

                    if run_on_finish {
                        let _ = inner.on_finish().await;
                    }
                });
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            if !self.called_on_start || !self.called_on_finish {
                if let Some(mut inner) = self.inner.take() {
                    GlobalIORuntime::instance().spawn({
                        let called_on_start = self.called_on_start;
                        let called_on_finish = self.called_on_finish;
                        async move {
                            if !called_on_start && T::CALL_ON_START_ON_ERROR {
                                let _ = inner.on_start().await;
                            }

                            if !called_on_finish && T::CALL_ON_FINISH_ON_ERROR {
                                let _ = inner.on_finish().await;
                            }
                        }
                    });
                }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `58dd5893` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
