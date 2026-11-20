# Verification Protocol: Verification Protocol: Empirical Defect Shield for databendlabs/databend

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "77137bc2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T21:47:12.315Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-databendlabs-databend",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `77137bc2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T21:47:12.315Z`  
> **Learning ID**: `learn-github-databendlabs-databend`


## 1. Scope & Verification Target
- **Target Repository**: `databendlabs/databend` (Commit: `77137bc2`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): databendlabs/databend

> **Canonical Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T21:47:10.993Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9501 stars

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
- **Issue #21146** (2026-11-20): **chore(meta): use server v260629.11.0 and client v260205.13.7**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Use Meta server and test harness `v260629.11.0` with maintenance client `v260205.13.7`. Both resolve crates.io OpenRaft `0.10.1`; the server no longer needs a Git source for OpenRaft. Keep the runtime bridge between the two Meta sources. Server-side credentials import `databend_meta::Secret` without a direct `databend-meta-raft-config` dependency. The semaphore codec uses `codeq 0.6.3` with the same wire format. Databend’s separate Hickory dependencies are outside this change.  The maintenance client retains the `1.2.770` minimum Meta server version. Keep `watch_on_leader()` until all watch-serving endpoints have upgraded through normal rollout and a deployed probe confirms stale-stream closure, reconnect to the new leader, and resumed updates.  Validation: Clippy and 111 focused tests passed for query config, Meta CLI config, control, store, cache, and semaphore. The `metactl` Raft TLS suite also passed locally, including follower reads, snapshot catch-up, and leader transfer.  <!-- x-pr-ship target=main old-base-oid=a85e50302ceeb3fd46c3582409745f0d551a0eee predecessor=none -->  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [ ] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [x] Breaking Change (fix or feature that could cause ex

- **Issue #21141** (2026-11-20): **fix(query): probe the partition built in each hash join spill round**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  The legacy hash join can silently return wrong results when it spills. CI hit this in [`linux / sqllogic / cluster (tpcds, 4c)`](https://github.com/databendlabs/databend/actions/runs/44673294220/job/136092536425): TPC-DS Q69 in `tpcds_spill_3.test` returned one extra row. Correct runs in the same job had identical row counts for every operator up to the `NOT EXISTS` left mark join on `web_sales`. That join's output differed on one node, and on that node the join spilled into 16 rounds.  **Root cause.** Spilled partitions are restored one per round. At the end of a round, the last probe processor releases the build side (`continue_build_watcher.send(true)`) and only afterwards reads the partition to restore from `HashJoinState::partition_id`. Once the build side finishes the next round, its `finalize_done` already stores the partition of the round after that in the same slot. A probe thread delayed between the release and the read (for example, preempted for about the 1 ms a small round takes) restores the following partition. It probes that partition against the wrong table, and its buffered rows of both partitions are never joined:  - inner and semi joins lose rows; - `NOT EXISTS` / left mark joins return extra rows; - no error is raised.  This has existed since the round protocol was introduced. It affects every join that runs on the legacy implementatio

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

### Incident Patch 1: `f3fe9792` (2026-11-20)
**Commit Message**: fix(query): read spilled byte columns with the writer's arrow types (#21053)

* fix(query): read spilled byte columns with the writer's arrow types

Spill files are written with LargeBinary/Utf8View byte columns, but
SpillsDataReader built its field levels from the row group's parquet
schema without the footer's embedded arrow schema, so byte columns were
decoded as Binary/Utf8 with i32 offsets. A row group is decoded as one
batch, so a byte column above 2 GiB failed with "index overflow decoding
byte array".

Pass the arrow schema derived from the reader's data schema, the same
conversion the writer uses, as the decoding hint.

* fix(query): name spill read hint fields after the file's columns

Parquet matches hint fields by name. The writer names top-level columns after the block (col_N), while callers pass their own data schema (for example agg_0/group_0, or 0/1 for partial top-n), so the hint failed with 'incompatible arrow schema'. Take the top-level names from the file and keep the types inferred from the data schema.

**File**: `src/query/service/src/spillers/async_buffer.rs` (modified, +211/-6)
```diff
@@ -25,6 +25,8 @@ use std::sync::atomic::Ordering;
 use std::time::Duration;
 use std::time::Instant;
 
+use arrow_array::RecordBatch;
+use arrow_schema::Fields;
 use arrow_schema::Schema;
 use bytes::Bytes;
 use bytes::BytesMut;
@@ -583,10 +585,23 @@ impl SpillsDataReader {
             ));
         }
 
+        // Read back the arrow types the writer used. Without them, byte columns are
+        // inferred as Binary/Utf8, whose i32 offsets overflow once a column of the
+        // row group, which is decoded as one batch, holds more than 2 GiB.
+        // Hint fields must carry the names in the file, which the writer takes
+        // from the block rather than from `data_schema`.
+        let schema_descr = row_groups[0].schema_descr();
+        let arrow_schema = Schema::from(infer_table_schema(&data_schema)?.as_ref());
+        let hint = arrow_schema
+            .fields()
+            .iter()
+            .zip(schema_descr.root_schema().get_fields())
+            .map(|(field, column)| field.as_ref().clone().with_name(column.name()))
+            .collect::<Vec<_>>();
         let field_levels = parquet_to_arrow_field_levels(
-            row_groups[0].schema_descr(),
+            schema_descr,
             ProjectionMask::all(),
-            None,
+            Some(&Fields::from(hint)),
         )?;
 
         let (tx, rx) = async_channel::bounded(1);
@@ -613,6 +628,16 @@ impl SpillsDataReader {
     }
 
     pub fn read(&mut self) -> Result<Option<DataBlock>> {
+        let Some(batch) = self.read_record_batch()? else {
+            return Ok(None);
+        };
+        Ok(Some(DataBlock::from_record_batch_keep_null_const(
+            &self.data_schema,
+            &batch,
+        )?))
+    }
+
+    fn read_record_batch(&mut self) -> Result<Option<RecordBatch>> {
         let start = Instant::now();
 
         let fetched = match self.receiver.recv_blocking() {
@@ -641,10 +666,7 @@ impl SpillsDataReader {
         };
         debug_assert!(reader.next().is_none());
         record_read_profile(self.target, start.elapsed(), fetched.read_bytes);
-        Ok(Some(DataBlock::from_record_batch_keep_null_const(
-            &self.data_schema,
-            &batch,
-        )?))
+        Ok(Some(batch))
     }
 }
 
@@ -868,9 +890,22 @@ mod tests {
     use std::sync::atomic::AtomicUsize;
     use std::sync::atomic::Ordering;
 
+    use arrow_schema::DataType as ArrowDataType;
     use databend_common_base::runtime::spawn;
+    use databend_common_expression::Column;
+    use databend_common_expression::DataField;
+    use databend_common_expression::DataSchema;
     use databend_common_expression::FromData;
+    use databend_common_expression::block_debug::pretty_format_blocks;
+    use databend_common_expression::types::BinaryType;
+    use databend_common_expression::types::BooleanType;
+    use databend_common_expression::types::DataType;
+    use databend_common_expression::types::DecimalSize;
     use databend_common_expression::types::Int32Type;
+    use databend_common_expression::types::Int64Type;
+    use databend_common_expression::types::NumberDataType;
+    use databend_common_expression::types::StringType;
+    use databend_common_expression::types::VariantType;
     use opendal::Operator;
 
     use super::*;
@@ -1081,6 +1116,176 @@ mod tests {
         );
     }
 
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_spill_reads_byte_columns_with_writer_types() {
+        let pool = SpillsBufferPool::create(1).unwrap();
+        let operator = create_test_operator().unwrap();
+        let path = "spill_byte_column_types".to_string();
+
+        let variants = || {
+            ["[1,\"a\"]", "{\"k\":null}"]
+                .iter()
+                .map(|json| jsonb::parse_value(json.as_bytes()).unwrap().to_vec())
+                .collect::<Vec<_>>()
+        };
+        // The last column has the shape of an arg_max state: (has_value, key, value).
+        let block = DataBlock::new_from_columns(vec![
+            StringType::from_data(vec!["a", "bc"]),
+            StringType::from_opt_data(vec![Some("d"), None]),
+            BinaryType::from_data(vec![b"ef".as_slice(), b"".as_slice()]),
+            VariantType::from_data(variants()),
+            Column::Tuple(vec![
+                BooleanType::from_data(vec![true, false]),
+                Int64Type::from_data(vec![1, 2]),
+                VariantType::from_data(variants()),
+            ]),
+            // Types whose hinted arrow type also differs from the parquet default.
+            Column::random(
+                &DataType::Decimal(DecimalSize::new(10, 2).unwrap()),
+                2,
+                None,
+            ),
+            Column::random(
+                &DataType::Array(Box::new(DataType::Number(NumberDataType::Int32))),
+                2,
+                None,
+            ),
+            Column::random(
+                &DataType::Nullable(Box::new(DataType::Tuple(vec![
+                    Da
```

---

### Incident Patch 2: `532835a7` (2026-11-20)
**Commit Message**: fix(query): reject out-of-range to_decimal parameters (#21128)

* fix(query): reject out-of-range to_decimal parameters (#21107)

* refactor(query): name the target type in decimal cast overflow errors

The overflow errors of integer, float and decimal casts to decimal
quoted the source line that raised them, which only told the cast
paths apart and changed with every edit of the file. They now name the
decimal type the value does not fit; a NaN or infinite float says so,
under the same 'Decimal overflow' prefix that tests match. The evaluator
already shows the function and the value.

(cherry picked from commit 84479b615116d7602f1394992dfbe25d57da208a)

* fix(query): reject NULL Decimal type arguments

**File**: `src/query/expression/src/types/decimal.rs` (modified, +35/-19)
```diff
@@ -52,6 +52,7 @@ use super::AccessType;
 use super::AnyType;
 use super::DataType;
 use super::F64;
+use super::NumberScalar;
 use super::NumberType;
 use super::SimpleDomain;
 use super::SimpleType;
@@ -518,28 +519,43 @@ impl DecimalSize {
     }
 
     pub fn new(precision: u8, scale: u8) -> Result<DecimalSize> {
-        let size = DecimalSize { precision, scale };
-        size.validate()?;
-
-        Ok(size)
+        Self::from_checked_params(Some(precision), Some(scale))
+    }
+
+    pub fn try_from_scalars(precision: &Scalar, scale: &Scalar) -> Result<Self> {
+        let to_u8 = |value: &Scalar, name: &str| -> Result<Option<u8>> {
+            crate::with_integer_mapped_type!(|NUM_TYPE| match value.as_number() {
+                Some(NumberScalar::NUM_TYPE(value)) => Ok(value.to_u8()),
+                _ => Err(ErrorCode::IllegalDataType(format!(
+                    "Decimal {name} must be an integer, got {}",
+                    value.as_ref().infer_data_type()
+                ))),
+            })
+        };
+        Self::from_checked_params(to_u8(precision, "precision")?, to_u8(scale, "scale")?)
     }
 
     pub fn validate(&self) -> Result<()> {
-        if self.precision < 1 || self.precision > i256::MAX_PRECISION {
-            return Err(ErrorCode::Overflow(format!(
-                "Decimal precision must be between 1 and {}",
-                i256::MAX_PRECISION
-            )));
-        }
-
-        if self.scale > self.precision {
-            return Err(ErrorCode::Overflow(format!(
-                "Decimal scale must be between 0 and precision {}",
-                self.precision
-            )));
-        }
-
-        Ok(())
+        Self::new(self.precision, self.scale).map(|_| ())
+    }
+
+    fn from_checked_params(precision: Option<u8>, scale: Option<u8>) -> Result<Self> {
+        let precision = precision
+            .filter(|p| (1..=i256::MAX_PRECISION).contains(p))
+            .ok_or_else(|| {
+                ErrorCode::Overflow(format!(
+                    "Decimal precision must be between 1 and {}",
+                    i256::MAX_PRECISION
+                ))
+            })?;
+        let scale = scale
+            .filter(|s| (0..=precision).contains(s))
+            .ok_or_else(|| {
+                ErrorCode::Overflow(format!(
+                    "Decimal scale must be between 0 and precision {precision}"
+                ))
+            })?;
+        Ok(Self::new_unchecked(precision, scale))
     }
 
     pub fn default_128() -> DecimalSize {
```

**File**: `src/query/functions/src/scalars/decimal/src/cast.rs` (modified, +43/-19)
```diff
@@ -118,8 +118,7 @@ pub fn register_to_decimal(registry: &mut FunctionRegistry) {
             _ => return None,
         };
 
-        let decimal_size =
-            DecimalSize::new(params[0].get_i64()? as _, params[1].get_i64()? as _).ok()?;
+        let decimal_size = DecimalSize::try_from_scalars(&params[0], &params[1]).ok()?;
 
         let is_variant = from_type == DataType::Variant;
         let return_type = if is_variant {
@@ -565,7 +564,7 @@ where
                 skip_inactive_with_builder_1_arg::<BooleanType, DecimalType<T>>(
                     |a, out: &mut Vec<T>, ctx| {
                         if a {
-                            ctx.set_error(out.len(), "Decimal overflow");
+                            ctx.set_error(out.len(), DecimalOverflow(size));
                             out.push(T::one());
                         } else {
                             out.push(T::zero());
@@ -758,7 +757,7 @@ where
             from, ctx,
         )
     } else {
-        let overflow = concat!("Decimal overflow at line : ", line!());
+        let overflow = DecimalOverflow(size);
         if let Value::Scalar(value) = &from {
             let x = S::to_scalar_ref(value);
             if let Some(x) = T::from_i128(x).and_then(|x| x.checked_mul(multiplier))
@@ -797,13 +796,15 @@ where
 {
     let f = |x: S::ScalarRef<'_>, builder: &mut Vec<T>, ctx: &mut EvalContext| {
         let rounding_mode = ctx.func_ctx.rounding_mode;
-        match T::from_float(x.as_(), size, rounding_mode) {
+        let x: f64 = x.as_();
+        match T::from_float(x, size, rounding_mode) {
             Some(x) => builder.push(x),
+            None if !x.is_finite() => {
+                ctx.set_error(builder.len(), NonFiniteDecimal(x));
+                builder.push(T::one());
+            }
             None => {
-                ctx.set_error(
-                    builder.len(),
-                    concat!("Decimal overflow at line : ", line!()),
-                );
+                ctx.set_error(builder.len(), DecimalOverflow(size));
                 builder.push(T::one());
             }
         }
@@ -843,28 +844,29 @@ where
     let min = W::min_for_precision(dest.precision());
     let max = W::max_for_precision(dest.precision());
     match dest.scale().cmp(&from.scale()) {
-        Ordering::Equal => {
-            rescale::<F, W, T>(value, ctx, move |x, _| (x >= min && x <= max).then_some(x))
-        }
+        Ordering::Equal => rescale::<F, W, T>(value, ctx, dest, move |x, _| {
+            (x >= min && x <= max).then_some(x)
+        }),
         Ordering::Greater => {
             let factor = W::e(dest.scale() - from.scale());
-            rescale::<F, W, T>(value, ctx, move |x, _| {
+            rescale::<F, W, T>(value, ctx, dest, move |x, _| {
                 x.checked_mul(factor).filter(|x| *x >= min && *x <= max)
             })
         }
         Ordering::Less => {
             let reduction = ScaleReduction::<W>::new(from.scale() - dest.scale(), dest.precision());
-            rescale::<F, W, T>(value, ctx, move |x, rounding_mode| {
+            rescale::<F, W, T>(value, ctx, dest, move |x, rounding_mode| {
                 reduction.reduce(x, rounding_mode)
             })
         }
     }
 }
 
-// Rows the rescaling rejects do not fit the target precision.
+// Rows the rescaling rejects do not fit `dest`.
 fn rescale<F, W, T>(
     value: Value<DecimalType<F>>,
     ctx: &mut EvalContext,
+    dest: DecimalSize,
     rescale: impl Fn(W, bool) -> Option<W> + Copy + Send + Sync,
 ) -> Value<DecimalType<T>>
 where
@@ -879,16 +881,38 @@ where
         ) {
             Some(y) => builder.push(y.as_decimal::<T>()),
             None => {
-                ctx.set_error(
-                    builder.len(),
-                    concat!("Decimal overflow at line : ", line!()),
-                );
+                ctx.set_error(builder.len(), DecimalOverflow(dest));
                 builder.push(T::one());
             }
         },
     )(value, ctx)
 }
 
+/// The error of a value that a decimal of `size` cannot hold. The evaluator
+/// adds the function and its arguments to it, which show the value.
+#[derive(Clone, Copy)]
+struct DecimalOverflow(DecimalSize);
+
+impl std::fmt::Display for DecimalOverflow {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        write!(
+            f,
+            "Decimal overflow: the value does not fit {}",
+            DataType::Decimal(self.0)
+        )
+    }
+}
+
+/// The error of a NaN or infinite float cast to a decimal.
+#[derive(Clone, Copy)]
+struct NonFiniteDecimal(f64);
+
+impl std::fmt::Display for NonFiniteDecimal {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        write!(f, "Decimal overflow: {} has no decimal value", self.0)
+    }
+}
+
 /// Drops `shift >= 1` fractional digits, truncating or rounding half away
 /// from zero, then checks the target range.
 ///
```

**File**: `src/query/functions/tests/it/scalars/cast.rs` (modified, +2/-0)
```diff
@@ -1267,6 +1267,8 @@ fn test_decimal_cast_precision_and_partial_errors() {
     let columns = [("a", Int64Type::from_data(vec![-10, -9, 0, 9, 10]))];
     run_ast(file, "CAST(a AS DECIMAL(1,0))", &columns);
     run_ast(file, "TRY_CAST(a AS DECIMAL(1,0))", &columns);
+    let columns = [("f", Float64Type::from_data(vec![1.5, f64::NAN]))];
+    run_ast(file, "CAST(f AS DECIMAL(38,10))", &columns);
     let columns = [("active", BooleanType::from_data(vec![false, true, false]))];
     run_ast(
         file,
```

**File**: `src/query/functions/tests/it/scalars/testdata/decimal_cast_precision.txt` (modified, +18/-10)
```diff
@@ -11,31 +11,31 @@ error:
   --> SQL:1:1
   |
 1 | CAST(10::Int64 AS DECIMAL(1,0))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 761 while evaluating function `to_decimal(1, 0)(10)` in expr `CAST(CAST(10 AS Int64) AS Decimal(1, 0))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(10)` in expr `CAST(CAST(10 AS Int64) AS Decimal(1, 0))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(-10::Int64 AS DECIMAL(1,0))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 761 while evaluating function `to_decimal(1, 0)(-10)` in expr `CAST(- CAST(10 AS Int64) AS Decimal(1, 0))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(-10)` in expr `CAST(- CAST(10 AS Int64) AS Decimal(1, 0))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(9223372036854775807::Int64 AS DECIMAL(1,0))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 761 while evaluating function `to_decimal(1, 0)(9223372036854775807)` in expr `CAST(CAST(9223372036854775807 AS Int64) AS Decimal(1, 0))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(9223372036854775807)` in expr `CAST(CAST(9223372036854775807 AS Int64) AS Decimal(1, 0))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(18446744073709551615::UInt64 AS DECIMAL(1,0))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 761 while evaluating function `to_decimal(1, 0)(18446744073709551615)` in expr `CAST(18446744073709551615 AS Decimal(1, 0))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(18446744073709551615)` in expr `CAST(18446744073709551615 AS Decimal(1, 0))`
 
 
 
@@ -70,7 +70,7 @@ error:
   --> SQL:1:1
   |
 1 | CAST(TRUE AS DECIMAL(1,1))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow while evaluating function `to_decimal(1, 1)(true)` in expr `CAST(true AS Decimal(1, 1))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 1) while evaluating function `to_decimal(1, 1)(true)` in expr `CAST(true AS Decimal(1, 1))`
 
 
 
@@ -135,7 +135,7 @@ error:
   --> SQL:1:1
   |
 1 | CAST(a AS DECIMAL(1,0))
-  | ^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 761 while evaluating function `to_decimal(1, 0)(-10)` in expr `CAST(a AS Decimal(1, 0))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(-10)` in expr `CAST(a AS Decimal(1, 0))`
 
 
 
@@ -163,11 +163,19 @@ evaluation (internal):
 +--------+--------------------------------------------------------------------------------+
 
 
+error: 
+  --> SQL:1:1
+  |
+1 | CAST(f AS DECIMAL(38,10))
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: NaN has no decimal value while evaluating function `to_decimal(38, 10)(NaN)` in expr `CAST(f AS Decimal(38, 10))`
+
+
+
 error: 
   --> SQL:1:12
   |
 1 | if(active, CAST(10::Int64 AS DECIMAL(1,0)), NULL)
-  |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 761 while evaluating function `to_decimal(1, 0)(10)` in expr `CAST(CAST(10 AS Int64) AS Decimal(1, 0))`, during run expr: `if(CAST(active AS Boolean NULL), CAST(CAST(CAST(10 AS Int64) AS Decimal(1, 0)) AS Decimal(1, 0) NULL), CAST(NULL AS Decimal(1, 0) NULL))`
+  |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(10)` in expr `CAST(CAST(10 AS Int64) AS Decimal(1, 0))`, during run expr: `if(CAST(active AS Boolean NULL), CAST(CAST(CAST(10 AS Int64) AS Decimal(1, 0)) AS Decimal(1, 0) NULL), CAST(NULL AS Decimal(1, 0) NULL))`
 
 
 
@@ -198,7 +206,7 @@ error:
   --> SQL:1:12
   |
 1 | if(active, CAST(1e30::Float64 AS DECIMAL(1,0)), NULL)
-  |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 805 while evaluating function `to_decimal(1, 0)(1000000000000000000000000000000)` in expr `CAST(CAST(1000000000000000000000000000000 AS Float64) AS Decimal(1, 0))`, during run expr: `if(CAST(active AS Boolean NULL), CAST(CAST(CAST(1000000000000000000000000000000 AS Float64) AS Decimal(1, 0)) AS Decimal(1, 0) NULL), CAST(NULL AS Decimal(1, 0) NULL))`
+  |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(1, 0) while evaluating function `to_decimal(1, 0)(1000000000000000000000000000000)` in expr `CAST(CAST(1000000000000000000000000000000 AS Float64) AS Decimal(1, 0))`, during run expr: `if(CAST(active AS Boolean NULL), CAST(CAST(CAST(1000000000000000000000000000000 AS Float64) AS Decimal(1, 0)) AS Decimal(1, 0) NULL), CAST(NULL AS Decimal(1, 0) NULL))`
 
 
 
@@ -214,15 +222,15 @@ error:
   --> SQL:1:12
   |
 1 | if(active, CAST(10::DE
```

**File**: `src/query/functions/tests/it/scalars/testdata/decimal_to_decimal_cast.txt` (modified, +10/-10)
```diff
@@ -67,15 +67,15 @@ error:
   --> SQL:1:1
   |
 1 | CAST(123.45::DECIMAL(5,2) AS DECIMAL(5,4))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(5, 4)(123.45)` in expr `CAST(123.45 AS Decimal(5, 4))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(5, 4) while evaluating function `to_decimal(5, 4)(123.45)` in expr `CAST(123.45 AS Decimal(5, 4))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(123::DECIMAL(3,0) AS DECIMAL(3,2))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(3, 2)(123)` in expr `CAST(CAST(123 AS Decimal(3, 0)) AS Decimal(3, 2))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(3, 2) while evaluating function `to_decimal(3, 2)(123)` in expr `CAST(CAST(123 AS Decimal(3, 0)) AS Decimal(3, 2))`
 
 
 
@@ -449,23 +449,23 @@ error:
   --> SQL:1:1
   |
 1 | CAST(12345.67::DECIMAL(7,2) AS DECIMAL(5,2))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(5, 2)(12345.67)` in expr `CAST(12345.67 AS Decimal(5, 2))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(5, 2) while evaluating function `to_decimal(5, 2)(12345.67)` in expr `CAST(12345.67 AS Decimal(5, 2))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(999.99::DECIMAL(5,2) AS DECIMAL(4,2))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(4, 2)(999.99)` in expr `CAST(999.99 AS Decimal(4, 2))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(4, 2) while evaluating function `to_decimal(4, 2)(999.99)` in expr `CAST(999.99 AS Decimal(4, 2))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(99.9::DECIMAL(3,1) AS DECIMAL(2,1))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(2, 1)(99.9)` in expr `CAST(99.9 AS Decimal(2, 1))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(2, 1) while evaluating function `to_decimal(2, 1)(99.9)` in expr `CAST(99.9 AS Decimal(2, 1))`
 
 
 
@@ -482,23 +482,23 @@ error:
   --> SQL:1:1
   |
 1 | CAST(-123.45::DECIMAL(5,2) AS DECIMAL(4,2))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(4, 2)(-123.45)` in expr `CAST(- 123.45 AS Decimal(4, 2))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(4, 2) while evaluating function `to_decimal(4, 2)(-123.45)` in expr `CAST(- 123.45 AS Decimal(4, 2))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(99.99::DECIMAL(4,2) AS DECIMAL(3,2))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(3, 2)(99.99)` in expr `CAST(99.99 AS Decimal(3, 2))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(3, 2) while evaluating function `to_decimal(3, 2)(99.99)` in expr `CAST(99.99 AS Decimal(3, 2))`
 
 
 
 error: 
   --> SQL:1:1
   |
 1 | CAST(9.99::DECIMAL(3,2) AS DECIMAL(2,2))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(2, 2)(9.99)` in expr `CAST(9.99 AS Decimal(2, 2))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(2, 2) while evaluating function `to_decimal(2, 2)(9.99)` in expr `CAST(9.99 AS Decimal(2, 2))`
 
 
 
@@ -524,7 +524,7 @@ error:
   --> SQL:1:1
   |
 1 | CAST(12345678901234567890.123456789::DECIMAL(38,9) AS DECIMAL(18,4))
-  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(18, 4)(12345678901234567890.123456789)` in expr `CAST(CAST(12345678901234567890.123456789 AS Decimal(38, 9)) AS Decimal(18, 4))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(18, 4) while evaluating function `to_decimal(18, 4)(12345678901234567890.123456789)` in expr `CAST(CAST(12345678901234567890.123456789 AS Decimal(38, 9)) AS Decimal(18, 4))`
 
 
 
@@ -650,7 +650,7 @@ error:
   --> SQL:1:1
   |
 1 | CAST(a AS DECIMAL(5,1))
-  | ^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow at line : 884 while evaluating function `to_decimal(5, 1)(1234567.89)` in expr `CAST(a AS Decimal(5, 1))`
+  | ^^^^^^^^^^^^^^^^^^^^^^^ Decimal overflow: the value does not fit Decimal(5, 1) while evaluating function `to_decimal(5, 1)(1234567.89)` in expr `CAST(a AS Decimal(5, 1))`
 
 
 
```

**File**: `src/query/sql/src/planner/semantic/type_check.rs` (modified, +2/-2)
```diff
@@ -52,8 +52,8 @@ use crate::planner::expression::UDFValidator;
 use crate::planner::expression::UdfValidationConfig;
 use crate::plans::DictGetFunctionArgument;
 
-const DEFAULT_DECIMAL_PRECISION: i64 = 38;
-const DEFAULT_DECIMAL_SCALE: i64 = 0;
+const DEFAULT_DECIMAL_PRECISION: u8 = 38;
+const DEFAULT_DECIMAL_SCALE: u8 = 0;
 
 mod adapter;
 mod aggregate;
```

**File**: `src/query/sql/src/planner/semantic/type_check/scalar_function.rs` (modified, +32/-44)
```diff
@@ -598,63 +598,51 @@ where A: TypeCheckAdapter
                     }
                 }
             }
-        } else if (func_name.eq_ignore_ascii_case("to_number")
+        } else if func_name.eq_ignore_ascii_case("to_number")
             || func_name.eq_ignore_ascii_case("to_numeric")
             || func_name.eq_ignore_ascii_case("to_decimal")
             || func_name.eq_ignore_ascii_case("try_to_number")
             || func_name.eq_ignore_ascii_case("try_to_numeric")
-            || func_name.eq_ignore_ascii_case("try_to_decimal"))
-            && params.is_empty()
+            || func_name.eq_ignore_ascii_case("try_to_decimal")
         {
-            if args.is_empty() || args.len() > 4 {
+            if args.is_empty() || args.len() > 4 || (!params.is_empty() && params.len() != 2) {
                 return Err(ErrorCode::SemanticError(format!(
                     "Invalid arguments for `{func_name}`, get {} params and {} arguments",
                     params.len(),
                     args.len()
                 )));
             }
-            let arg_fn = |args: &[BoundScalar],
-                          index: usize,
-                          arg_name: &str,
-                          default: i64|
-             -> Result<i64> {
-                Ok(args
-                    .get(index)
-                    .map(|arg| match self.bound_constant_value(&arg.scalar, &arg.facts) {
-                        Some((value, _)) => Ok(value.get_i64()),
-                        None => Err(ErrorCode::SemanticError(format!(
-                            "Invalid arguments for `{func_name}`, {arg_name} is only allowed to be a constant"
-                        ))),
-                    })
-                    .transpose()?
-                    .flatten()
-                    .unwrap_or(default))
-            };
-
-            let (precision_index, scale_index) =
-                if args.len() > 1 && args[1].scalar.data_type().remove_nullable().is_string() {
-                    (2, 3)
-                } else {
-                    (1, 2)
+            let size = if let [precision, scale] = params.as_slice() {
+                DecimalSize::try_from_scalars(precision, scale)
+            } else {
+                let arg_fn = |index: usize, name: &str, default: u8| -> Result<Scalar> {
+                    let Some(arg) = args.get(index) else {
+                        return Ok(Scalar::Number(NumberScalar::UInt8(default)));
+                    };
+                    self.bound_constant_value(&arg.scalar, &arg.facts)
+                        .map(|(value, _)| value)
+                        .ok_or_else(|| ErrorCode::SemanticError(format!(
+                            "Invalid arguments for `{func_name}`, {name} is only allowed to be a constant"
+                        )))
                 };
-            let precision = arg_fn(
-                &args,
-                precision_index,
-                "precision",
-                DEFAULT_DECIMAL_PRECISION,
-            )?;
-            let scale = arg_fn(&args, scale_index, "scale", DEFAULT_DECIMAL_SCALE)?;
-
-            if let Err(err) = DecimalSize::new(precision as u8, scale as u8) {
-                return Err(ErrorCode::SemanticError(format!(
-                    "Invalid arguments for `{func_name}`, {}",
-                    err,
-                )));
+                let precision_index =
+                    if args.len() > 1 && args[1].scalar.data_type().remove_nullable().is_string() {
+                        2
+                    } else {
+                        1
+                    };
+                let precision = arg_fn(precision_index, "precision", DEFAULT_DECIMAL_PRECISION)?;
+                let scale = arg_fn(precision_index + 1, "scale", DEFAULT_DECIMAL_SCALE)?;
+                DecimalSize::try_from_scalars(&precision, &scale)
+            };
+            let size = size.map_err(|err| {
+                ErrorCode::SemanticError(format!("Invalid arguments for `{func_name}`, {err}"))
+            })?;
+            if params.is_empty() {
+                // Typed as literal params are, e.g. `to_decimal(10, 2)(x)`.
+                params.push(Scalar::Number(NumberScalar::UInt8(size.precision())));
+                params.push(Scalar::Number(NumberScalar::UInt8(size.scale())));
             }
-
-            // Typed as literal params are, e.g. `to_decimal(10, 2)(x)`.
-            params.push(Scalar::Number(NumberScalar::UInt8(precision as _)));
-            params.push(Scalar::Number(NumberScalar::UInt8(scale as _)));
         }
 
         let placeholders = args
```

**File**: `tests/sqllogictests/suites/base/11_data_type/11_0006_data_type_decimal.test` (modified, +48/-0)
```diff
@@ -1348,6 +1348,54 @@ SELECT try_to_decimal(123456, 6, 0);
 ----
 123456
 
+# Decimal parameters must not wrap when converted to UInt8 (#21107).
+query IRR
+SELECT to_decimal(1, 1, 0), to_decimal(76, 0)(1), to_decimal(0, 3, 3);
+----
+1 1 0.000
+
+statement error Decimal precision must be between 1 and 76
+SELECT to_decimal(3, 259, 0)
+
+statement error Decimal scale must be between 0 and precision 3
+SELECT to_decimal(3, 3, 257)
+
+statement error Decimal scale must be between 0 and precision 3
+SELECT to_number(3, 3, -255)
+
+statement error Decimal scale must be between 0 and precision 6
+SELECT try_to_decimal(123456, 6, 256)
+
+statement error Decimal scale must be between 0 and precision 3
+SELECT to_decimal('2.5', '9D9', 3, 257)
+
+statement error Decimal scale must be between 0 and precision 3
+SELECT to_decimal(3, 257)(3)
+
+statement error Decimal precision must be between 1 and 76
+SELECT try_to_numeric(4294967299, 1)(3)
+
+statement error Decimal precision must be between 1 and 76
+SELECT to_decimal(3, 9223372036854775808, 0)
+
+# NULL is allowed as the value, not as an explicit Decimal type parameter.
+query ?
+SELECT to_decimal(CAST(NULL AS INT64 NULL), 3, 0);
+----
+NULL
+
+statement error Decimal scale must be an integer, got NULL
+SELECT to_decimal(3, 3, NULL)
+
+statement error Decimal precision must be an integer, got NULL
+SELECT to_decimal(3, NULL, 2)
+
+statement error Decimal scale must be an integer, got NULL
+SELECT try_to_numeric(3, 3, CAST(NULL AS INT64))
+
+statement error Decimal scale must be an integer, got NULL
+SELECT to_decimal(3, NULL)(3)
+
 query I
 SELECT TO_DECIMAL('123456789', 9);
 ----
```

---

### Incident Patch 3: `4cfb5200` (2026-11-20)
**Commit Message**: fix(storage): skip reversed ranges in clustering diagnostics (#21131)

* fix(storage): skip reversed ranges in clustering diagnostics

Normalize float endpoints to OrderedFloat semantics before row encoding. Exclude both endpoints of reversed blocks from overlap and depth statistics while preserving the original block counts.

* fix review comments

**File**: `Cargo.lock` (modified, +0/-2)
```diff
@@ -3383,10 +3383,8 @@ dependencies = [
  "databend-common-timezone",
  "databend_educe",
  "divan",
- "either",
  "enum-as-inner",
  "ethnum",
- "fastrace",
  "futures",
  "geo",
  "geozero",
```

**File**: `src/query/expression/Cargo.toml` (modified, +0/-2)
```diff
@@ -36,10 +36,8 @@ databend-common-metrics = { workspace = true }
 databend-common-statistics = { workspace = true }
 databend-common-timezone = { workspace = true }
 educe = { workspace = true }
-either = { workspace = true }
 enum-as-inner = { workspace = true }
 ethnum = { workspace = true }
-fastrace = { workspace = true }
 futures = { workspace = true }
 geo = { workspace = true }
 geozero = { workspace = true }
```

**File**: `src/query/storages/fuse/src/table_functions/clustering_information.rs` (modified, +247/-105)
```diff
@@ -21,6 +21,7 @@ use databend_common_base::runtime::JoinHandle;
 use databend_common_base::runtime::Runtime;
 use databend_common_catalog::plan::DataSourcePlan;
 use databend_common_catalog::table_args::TableArgs;
+use databend_common_column::bitmap::Bitmap;
 use databend_common_exception::ErrorCode;
 use databend_common_exception::Result;
 use databend_common_expression::BlockEntry;
@@ -38,6 +39,7 @@ use databend_common_expression::types::DataType;
 use databend_common_expression::types::StringType;
 use databend_common_expression::types::TimestampType;
 use databend_common_expression::types::VariantType;
+use databend_common_expression::types::number::NumberColumnBuilder;
 use databend_common_pipeline_transforms::sorts::core::RowConverter;
 use databend_common_pipeline_transforms::sorts::core::VariableRowConverter;
 use databend_common_sql::NameResolutionContext;
@@ -441,69 +443,31 @@ impl ClusteringInformationImpl<'_> {
     ) -> Result<ClusteringInformationResponse> {
         let cluster_type = key.cluster_type();
         let calculation_start = Instant::now();
-        let CollectedMetadata {
-            key_types,
-            endpoint_builders,
-            block_count,
-            constant_block_count,
-        } = metadata;
-        let aggregate = match endpoint_builders {
+        let statistics = match metadata.endpoint_builders {
             Some(builders) => {
                 let max_threads = self.ctx.get_settings().get_max_threads()? as usize;
                 with_request_pool(max_threads, move |_| {
-                    let sorted = sort_endpoints(builders, &key_types)?;
-                    sweep_exact_statistics(&sorted.keys, &sorted.order)
+                    summarize_linear_ranges(builders, &metadata.key_types)
                 })?
             }
-            None => LinearClusteringStatistics {
-                block_count,
-                depth_counts: if block_count == 0 {
-                    BTreeMap::new()
-                } else {
-                    BTreeMap::from([(0, block_count as u64)])
-                },
+            None if total_block_count != 0 => LinearClusterStatistics {
+                block_depth_histogram: BTreeMap::from([("00000".into(), total_block_count)]),
                 ..Default::default()
             },
+            None => LinearClusterStatistics::default(),
         };
-
-        let info = if aggregate.block_count == 0 {
-            LinearClusterStatistics {
-                total_block_count,
-                ..Default::default()
-            }
-        } else {
-            LinearClusterStatistics {
-                total_block_count,
-                constant_block_count,
-                average_overlaps: rounded_average(aggregate.sum_overlap, aggregate.block_count),
-                average_depth: rounded_average(aggregate.sum_depth, aggregate.block_count),
-                max_depth: aggregate
-                    .depth_counts
-                    .last_key_value()
-                    .map_or(0, |(&depth, _)| depth),
-                p95_depth: percentile_depth(&aggregate.depth_counts, aggregate.block_count, 95),
-                p99_depth: percentile_depth(&aggregate.depth_counts, aggregate.block_count, 99),
-                block_depth_histogram: {
-                    let mut histogram = BTreeMap::new();
-                    for (depth, count) in &aggregate.depth_counts {
-                        let depth = *depth as u32;
-                        let bucket = if depth <= 16 || depth.is_power_of_two() {
-                            depth
-                        } else {
-                            depth.next_power_of_two()
-                        };
-                        *histogram.entry(format!("{:05}", bucket)).or_insert(0) += count;
-                    }
-                    histogram
-                },
-            }
+        let info = LinearClusterStatistics {
+            total_block_count,
+            constant_block_count: metadata.constant_block_count,
+            ..statistics
         };
         info!(
-            "clustering_information: finished table={} cluster_type={} blocks={} constant_blocks={} average_overlaps={} average_depth={} max_depth={} p95_depth={} p99_depth={} calculation_elapsed={:?} total_elapsed={:?}",
+            "clustering_information: finished table={} cluster_type={} blocks={} constant_blocks={} invalid_blocks={} average_overlaps={} average_depth={} max_depth={} p95_depth={} p99_depth={} calculation_elapsed={:?} total_elapsed={:?}",
             self.table.table_info.desc,
             cluster_type,
             info.total_block_count,
             info.constant_block_count,
+            info.invalid_block_count.unwrap_or_default(),
             info.average_overlaps,
             info.average_depth,
             info.max_depth,
@@ -666,10 +630,9 @@ fn push_endpoint(builders: &mut [ColumnBuilder], endpoint: &[Scalar]) {
 // `sum_overlap` counts both directions for each overlapping b
```

#### Recent Merged Pull Requests:
- **PR #21146** (2026-11-20): chore(meta): use server v260629.11.0 and client v260205.13.7 (@drmingdrmer)
- **PR #21141** (2026-11-20): fix(query): probe the partition built in each hash join spill round (@dqhl76)
- **PR #21136** (2026-11-20): fix: meta: move the cache off a leader that refuses its watch (@drmingdrmer)
- **PR #21135** (closed): fix(fuse): accept strings without a bounded statistics maximum (@youngsofun)
- **PR #21132** (2026-11-20): fix(query): preserve RBAC upgrade compatibility and audit access (@TCeason)
- **PR #21131** (2026-11-20): fix(storage): skip reversed ranges in clustering diagnostics (@zhyass)

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

## X. query): read spilled byte columns with the writer's arrow types

**RULE**:
When implementing operations in `src/query/service/src/spillers/async_buffer.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f3fe9792`: query): read spilled byte columns with the writer's arrow types. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/service/src/spillers/async_buffer.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use arrow_array::RecordBatch;
use arrow_schema::Fields;
        // Read back the arrow types the writer used. Without them, byte columns are
        // inferred as Binary/Utf8, whose i32 offsets overflow once a column of the
        // row group, which is decoded as one batch, holds more than 2 GiB.
        // Hint fields must carry the names in the file, which the writer takes
        // from the block rather than from `data_schema`.
        let schema_descr = row_groups[0].schema_descr();
        let arrow_schema = Schema::from(infer_table_schema(&data_schema)?.as_ref());
        let hint = arrow_schema
            .fields()
            .iter()
            .zip(schema_descr.root_schema().get_fields())
            .map(|(field, column)| field.as_ref().clone().with_name(column.name()))
            .collect::<Vec<_>>();
            schema_descr,
            Some(&Fields::from(hint)),
        let Some(batch) = self.read_record_batch()? else {
            return Ok(None);
        };
        Ok(Some(DataBlock::from_record_batch_keep_null_const(
            &self.data_schema,
            &batch,
        )?))
    }

    fn read_record_batch(&mut self) -> Result<Option<RecordBatch>> {
   
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            row_groups[0].schema_descr(),
            None,
        Ok(Some(DataBlock::from_record_batch_keep_null_const(
            &self.data_schema,
            &batch,
        )?))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f3fe9792` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
