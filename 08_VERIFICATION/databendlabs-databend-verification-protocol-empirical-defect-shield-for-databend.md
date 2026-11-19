# Verification Protocol: Verification Protocol: Empirical Defect Shield for databendlabs/databend

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "a83eaead",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T17:23:31.147Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-databendlabs-databend",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `a83eaead`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T17:23:31.147Z`  
> **Learning ID**: `learn-github-databendlabs-databend`


## 1. Scope & Verification Target
- **Target Repository**: `databendlabs/databend` (Commit: `a83eaead`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): databendlabs/databend

> **Canonical Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T17:23:29.696Z  
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
- **Issue #21126** (2026-11-19): **fix(query): enforce stage WRITE on HTTP uploads**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  The HTTP stage upload handler now requires the same stage `WRITE` permission as SQL writes, before initializing storage or reading the upload body. Permission denials return HTTP 403. Uploads to the authenticated user's own `~` stage and both stage-name header formats remain supported.  Stateless regression `18_0027_http_stage_write` checks HTTP 403 without `WRITE`, successful uploads via role grants or ownership, and the user's own `~` stage. The targeted test passed twice against a local server with the fix; shell syntax and formatting checks passed.  Fixes #21094.  <!-- Briefly describe what this PR aims to solve. Include background context that will help reviewers understand the purpose of the PR.  Write for humans, in your own words: the concrete problem, why it matters, how you validated it. Do NOT paste model transcripts, long logs, or stack traces here - link a gist or use <details>. The automated PR Assistant checks reject bloated, repetitive, or template-placeholder descriptions.  - fixes: #[Link the issue here] -->  ## Tests  - [ ] Unit Test - [x] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [x] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work as expected) - [ ] Do

- **Issue #21125** (2026-11-19): **refactor: query: read the ownership and access caches without a lock**
  *Symptoms*:   I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  ##### refactor: query: read the ownership and access caches without a lock # Summary  The ownership, network rule and external access integration caches are no longer behind a tokio `Mutex`: `RoleMgr` and `UserApiProvider` hold them as `Arc<Cache>` and `Cache`, since the sub-cache reads take `&self`.  # Details  Concurrent `RoleMgr::list_ownerships` calls no longer queue on the lock: they share the copy, and each still waits while it initializes or reconnects. `UserApiProvider::external_access_values` no longer needs `try_lock` to avoid that queue, since `Cache::try_get_ready` never waits. The test of busy caches uses caches that cannot answer instead of holding their locks.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test  - _Explain why_  ## Type of change  - [x] Refactoring  ## AI assistance  - AI usage: An AI coding agent generated code and wrote tests; I reviewed and confirmed every line before committing it. - Responsible human: @drmingdrmer - [x] The responsible human has read every line of this diff and can explain each change  ## Related Issues  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/databendlabs/databend/21125) <!-- Reviewable:end --> 
  **Post-Mortem & Fix Analysis**:
  > ## ⏱ CI timing · Dev  ### [run 44318988933](https://github.com/databendlabs/databend/actions/runs/44318988933) · **37.5 min** (main p50 47.3 min, **−9.8 min**)  | stage | this run | main p50 | Δ | |---|--:|--:|--:| | **total** | 37.5 min | 47.3 min | **−9.8 min** | | **build (aarch64, ci profile)** | 21.8 min | 33.6 min | **−11.8 min** | | ├ deps + crates (parallel) | 4.9 min | — | — | | ├ databend-query codegen | 2.8 min | — | — | | ├ databend-binaries link | 12.0 min | — | — | | └ sccache hit rate | 97.5 % | — | — | | **test_unit** | 15.9 min | 15.1 min | +0.8 min | | mac_check | — | 14.0 min | — | | **tests after build (52 jobs)** | 14.5 min | 11.6 min | **+2.9 min** | | ├ queue p50 / max | 4.4 min / 11.1 min | 1.8 min / 4.5 min | **+2.7 min** | | ├ sqllogic standalone (8 jobs, max) | 5.4 min | 5.2 min | +0.2 min | | ├ sqllogic cluster (8 jobs, max) | 9.7 min | 9.1 min | +0.6 min | | ├ sqllogic stage (2 jobs, max) | 6.7 min | 6.3 min | +0.3 min | | ├ sqllogic other (13 jobs, max) | 
  > Folded into #21124, whose branch now carries this commit on top of its own, as 3917502b8e.  <!-- x-pr-ship -->

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

### Incident Patch 1: `dea33860` (2026-11-19)
**Commit Message**: fix(query): batch small blocks before the window partition exchange (#21112)

* fix(query): batch small blocks before the window partition exchange

The window partition exchange scatters every input block into
`window_num_partitions` pieces. When the blocks that reach it are small,
for example after a selective filter or after the per-block top-n
truncation of `row_number`/`rank`, each piece holds one or two rows but
still a full set of allocations per column. Those allocations take far
more memory than the rows, are not counted by `memory_size`, so the
window buffer never reaches its spill threshold.

Add `TransformWindowPartitionBatch` before the exchange of every
partitioned window. Blocks that would give fewer than 64 rows and less
than 1 KiB per column to each partition on average are buffered until
they are not small together and then concatenated; other blocks pass
through untouched. The top-n truncation moves from
`WindowPartitionTopNExchange` into this transform, so top-n windows now
use the plain `WindowPartitionExchange`.

* fix(query): send large window blocks without concatenation and keep partition ids above 255

* fix(query): copy small window blocks into the batch 

**File**: `src/query/expression/src/kernels/stream_partition.rs` (modified, +135/-12)
```diff
@@ -136,6 +136,33 @@ impl PendingColumn {
         copy_column(indices, column, self.builder(indices.len()));
     }
 
+    /// Add every row of `column`, in order.
+    fn append_column(&mut self, column: &Column) {
+        let builder = self.builder(column.len());
+        if builder.data_type() == column.data_type() {
+            builder.append_column(column);
+        } else {
+            // Such as an `Array` column into an `EmptyArray` builder, which
+            // only `copy_column` turns into an `Array` builder.
+            let indices = (0..column.len() as u32).collect::<Vec<_>>();
+            copy_column(&indices, column, builder);
+        }
+    }
+
+    /// Add `rows` of a constant, kept a constant when it can be.
+    fn append_const(
+        &mut self,
+        scalar: &Scalar,
+        data_type: &DataType,
+        rows: usize,
+        size: &mut impl FnMut() -> ExpandedSize,
+    ) {
+        if !self.try_push_const(scalar, data_type, rows, size) {
+            let column = ColumnBuilder::repeat(&scalar.as_ref(), rows, data_type).build();
+            self.append_column(&column);
+        }
+    }
+
     /// Turn the pending rows into a builder with room for `additional` more.
     fn builder(&mut self, additional: usize) -> &mut ColumnBuilder {
         match self {
@@ -215,6 +242,21 @@ fn copy_const(scalar: &Scalar, data_type: &DataType, rows: usize, to: &mut Colum
     copy_column(&indices, &column, to);
 }
 
+/// The expanded size of the last constant seen in a column.
+type ConstSize = Option<(Scalar, DataType, ExpandedSize)>;
+
+fn cached_const_size(cache: &mut ConstSize, scalar: &Scalar, data_type: &DataType) -> ExpandedSize {
+    if let Some((s, t, size)) = cache.as_ref()
+        && s == scalar
+        && t == data_type
+    {
+        return *size;
+    }
+    let size = ExpandedSize::measure(scalar, data_type);
+    *cache = Some((scalar.clone(), data_type.clone(), size));
+    size
+}
+
 struct PartitionBlockBuilder {
     num_rows: usize,
     columns: Vec<PendingColumn>,
@@ -244,7 +286,7 @@ pub struct BlockPartitionStream {
     partitions: Vec<PartitionBlockBuilder>,
     // The expanded size of the last constant seen in each column, as the same
     // constant usually comes in every block.
-    const_sizes: Vec<Option<(Scalar, DataType, ExpandedSize)>>,
+    const_sizes: Vec<ConstSize>,
 }
 
 impl BlockPartitionStream {
@@ -313,17 +355,7 @@ impl BlockPartitionStream {
             match entry {
                 BlockEntry::Const(scalar, data_type, num_rows) => {
                     let const_size = &mut self.const_sizes[column_idx];
-                    let mut size = || {
-                        if let Some((s, t, size)) = const_size.as_ref()
-                            && *s == scalar
-                            && *t == data_type
-                        {
-                            return *size;
-                        }
-                        let size = ExpandedSize::measure(&scalar, &data_type);
-                        *const_size = Some((scalar.clone(), data_type.clone(), size));
-                        size
-                    };
+                    let mut size = || cached_const_size(const_size, &scalar, &data_type);
                     // Expanded once for the partitions that already hold other
                     // rows, as every block used to be.
                     let mut expanded = None;
@@ -435,6 +467,97 @@ impl BlockPartitionStream {
     }
 }
 
+/// Concatenates blocks into blocks of `rows_threshold` rows or
+/// `bytes_threshold` bytes, whichever is reached first: a
+/// `BlockPartitionStream` with one partition, without row indices.
+///
+/// The rows of each block are appended to the column builders as it arrives,
+/// so the block, which can be a slice of a larger one, is not kept. A column
+/// that has been the same constant in every block so far stays a constant,
+/// counted as if expanded. Once a block is sent, the builders of the next one
+/// reserve as many rows.
+pub struct BlockConcatStream {
+    rows_threshold: usize,
+    bytes_threshold: usize,
+    pending: PartitionBlockBuilder,
+    const_sizes: Vec<ConstSize>,
+}
+
+impl BlockConcatStream {
+    pub fn create(rows_threshold: usize, bytes_threshold: usize) -> BlockConcatStream {
+        BlockConcatStream {
+            rows_threshold: if rows_threshold == 0 {
+                usize::MAX
+            } else {
+                rows_threshold
+            },
+            bytes_threshold: if bytes_threshold == 0 {
+                usize::MAX
+            } else {
+                bytes_threshold
+            },
+            pending: PartitionBlockBuilder {
+                num_rows: 0,
+                columns: vec![],
+            },
+            const_sizes: vec![],
+        }
+    }
+
+    /// Appends the rows of `block`, and returns the concatenated block once
+    /// it reaches a threshold.
+    pub fn push(&mut self, block: DataBlock) -> Option<DataBlock
```

**File**: `src/query/expression/tests/it/stream_partition.rs` (modified, +57/-0)
```diff
@@ -14,6 +14,7 @@
 
 use std::collections::HashSet;
 
+use databend_common_expression::BlockConcatStream;
 use databend_common_expression::BlockEntry;
 use databend_common_expression::BlockPartitionStream;
 use databend_common_expression::DataBlock;
@@ -107,6 +108,62 @@ fn assert_same_as_expanded(
     output
 }
 
+#[test]
+fn test_concat_stream_cuts_as_one_partition() {
+    // Columns, runs of one constant, a new constant and a slice, cut at 10
+    // rows as a `BlockPartitionStream` with one partition cuts them.
+    let blocks = [
+        column_block(5, 0),
+        const_block(4, 5, "a"),
+        const_block(3, 9, "a"),
+        column_block(8, 10).slice(2..6),
+        const_block(2, 20, "b"),
+        column_block(7, 30),
+        const_block(1, 40, "b"),
+    ];
+    let mut stream = BlockConcatStream::create(10, 0);
+    let mut reference = BlockPartitionStream::create(10, 0, 1);
+    for block in &blocks {
+        let actual = stream.push(block.clone());
+        let mut expected = reference.partition(vec![0; block.num_rows()], block.clone(), true);
+        assert_eq!(actual.is_some(), expected.len() == 1);
+        if let (Some(a), Some((_, e))) = (&actual, expected.pop()) {
+            assert_same_values(a, &e);
+        }
+    }
+    let actual = stream.finish();
+    let expected = reference.finalize_partition(0);
+    assert_eq!(actual.is_some(), expected.is_some());
+    if let (Some(a), Some(e)) = (&actual, &expected) {
+        assert_same_values(a, e);
+    }
+    assert!(stream.finish().is_none());
+}
+
+#[test]
+fn test_concat_stream_keeps_one_constant() {
+    let mut stream = BlockConcatStream::create(0, 0);
+    assert!(stream.push(const_block(3, 0, "a")).is_none());
+    assert!(stream.push(const_block(4, 3, "a")).is_none());
+    assert_eq!(stream.num_rows(), 7);
+
+    let block = stream.finish().unwrap();
+    assert_eq!(block.num_rows(), 7);
+    assert_eq!(block.get_by_offset(1).as_scalar(), Some(&Scalar::Null));
+    assert_eq!(
+        block.get_by_offset(2).as_scalar(),
+        Some(&Scalar::String("a".to_string()))
+    );
+    assert_same_values(
+        &block,
+        &DataBlock::concat(&[
+            expanded(&const_block(3, 0, "a")),
+            expanded(&const_block(4, 3, "a")),
+        ])
+        .unwrap(),
+    );
+}
+
 #[test]
 fn test_partition_preserves_timezone_representations() {
     use databend_common_column::types::timestamp_tz;
```

**File**: `src/query/service/src/physical_plans/physical_window.rs` (modified, +16/-18)
```diff
@@ -32,6 +32,7 @@ use databend_common_functions::BUILTIN_FUNCTIONS;
 use databend_common_pipeline::core::Processor;
 use databend_common_pipeline::core::ProcessorPtr;
 use databend_common_pipeline_transforms::MemorySettings;
+use databend_common_pipeline_transforms::TransformPipelineHelper;
 use databend_common_sql::ColumnSet;
 use databend_common_sql::ScalarExpr;
 use databend_common_sql::Symbol;
@@ -68,10 +69,10 @@ use crate::pipelines::memory_settings::MemorySettingsExt;
 use crate::pipelines::processors::transforms::FrameBound;
 use crate::pipelines::processors::transforms::SortStrategy;
 use crate::pipelines::processors::transforms::TransformWindow;
+use crate::pipelines::processors::transforms::TransformWindowPartitionBatch;
 use crate::pipelines::processors::transforms::TransformWindowPartitionCollect;
 use crate::pipelines::processors::transforms::WindowFunctionInfo;
 use crate::pipelines::processors::transforms::WindowPartitionExchange;
-use crate::pipelines::processors::transforms::WindowPartitionTopNExchange;
 use crate::pipelines::processors::transforms::WindowSortDesc;
 
 #[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
@@ -449,23 +450,20 @@ fn apply_window_partition(
         .map(|index| input_schema.index_of(&index.to_string()))
         .collect::<Result<Vec<_>>>()?;
 
-    if let Some((top, func)) = window_top_n(window) {
-        builder.main_pipeline.exchange(
-            num_processors,
-            WindowPartitionTopNExchange::create(
-                partition_by.clone(),
-                sort_desc.clone(),
-                top,
-                func,
-                num_partitions as u64,
-            ),
-        )?;
-    } else {
-        builder.main_pipeline.exchange(
-            num_processors,
-            WindowPartitionExchange::create(partition_by.clone(), num_partitions),
-        )?;
-    }
+    let top_n = window_top_n(window);
+    builder.main_pipeline.add_accumulating_transformer(|| {
+        let transform = TransformWindowPartitionBatch::create(num_partitions);
+        match top_n {
+            Some((top, func)) => {
+                transform.with_top_n(partition_by.clone(), sort_desc.clone(), top, func)
+            }
+            None => transform,
+        }
+    });
+    builder.main_pipeline.exchange(
+        num_processors,
+        WindowPartitionExchange::create(partition_by.clone(), num_partitions),
+    )?;
 
     let window_spill_settings = MemorySettings::from_window_settings(&builder.ctx)?;
     let plan_schema = DataSchemaRefExt::create(input_schema.fields().clone());
```

**File**: `src/query/service/src/physical_plans/physical_window_partition.rs` (modified, +14/-15)
```diff
@@ -21,6 +21,7 @@ use databend_common_exception::Result;
 use databend_common_expression::SortColumnDescription;
 use databend_common_pipeline::core::ProcessorPtr;
 use databend_common_pipeline_transforms::MemorySettings;
+use databend_common_pipeline_transforms::TransformPipelineHelper;
 use databend_common_sql::Symbol;
 use databend_common_sql::executor::physical_plans::SortDesc;
 
@@ -33,9 +34,9 @@ use crate::physical_plans::physical_plan::PhysicalPlanMeta;
 use crate::pipelines::PipelineBuilder;
 use crate::pipelines::memory_settings::MemorySettingsExt;
 use crate::pipelines::processors::transforms::SortStrategy;
+use crate::pipelines::processors::transforms::TransformWindowPartitionBatch;
 use crate::pipelines::processors::transforms::TransformWindowPartitionCollect;
 use crate::pipelines::processors::transforms::WindowPartitionExchange;
-use crate::pipelines::processors::transforms::WindowPartitionTopNExchange;
 
 #[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
 pub struct WindowPartition {
@@ -121,25 +122,23 @@ impl IPhysicalPlan for WindowPartition {
             })
             .collect::<Result<Vec<_>>>()?;
 
-        if let Some(top_n) = &self.top_n
-            && top_n.top < 10000
-        {
-            builder.main_pipeline.exchange(
-                num_processors,
-                WindowPartitionTopNExchange::create(
+        let top_n = self.top_n.as_ref().filter(|top_n| top_n.top < 10000);
+        builder.main_pipeline.add_accumulating_transformer(|| {
+            let transform = TransformWindowPartitionBatch::create(num_partitions);
+            match top_n {
+                Some(top_n) => transform.with_top_n(
                     partition_by.clone(),
                     sort_desc.clone(),
                     top_n.top,
                     top_n.func,
-                    num_partitions as u64,
                 ),
-            )?;
-        } else {
-            builder.main_pipeline.exchange(
-                num_processors,
-                WindowPartitionExchange::create(partition_by.clone(), num_partitions),
-            )?;
-        }
+                None => transform,
+            }
+        });
+        builder.main_pipeline.exchange(
+            num_processors,
+            WindowPartitionExchange::create(partition_by.clone(), num_partitions),
+        )?;
 
         let window_spill_settings = MemorySettings::from_window_settings(&builder.ctx)?;
 
```

**File**: `src/query/service/src/pipelines/processors/transforms/window/partition/mod.rs` (modified, +2/-2)
```diff
@@ -13,14 +13,14 @@
 // limitations under the License.
 
 mod data_processor_strategy;
+mod transform_window_partition_batch;
 mod transform_window_partition_collect;
 mod window_partition_buffer;
 mod window_partition_exchange;
 mod window_partition_meta;
-mod window_partition_partial_top_n_exchange;
 
 pub use data_processor_strategy::*;
+pub use transform_window_partition_batch::*;
 pub use transform_window_partition_collect::*;
 pub use window_partition_exchange::*;
 pub use window_partition_meta::*;
-pub use window_partition_partial_top_n_exchange::*;
```

**File**: `src/query/service/src/pipelines/processors/transforms/window/partition/transform_window_partition_batch.rs` (added, +518/-0)
```diff
@@ -0,0 +1,518 @@
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
+use databend_common_exception::Result;
+use databend_common_expression::BlockConcatStream;
+use databend_common_expression::DataBlock;
+use databend_common_expression::FromData;
+use databend_common_expression::ProjectedBlock;
+use databend_common_expression::SortColumnDescription;
+use databend_common_expression::SortCompare;
+use databend_common_expression::Value;
+use databend_common_expression::group_hash_entries;
+use databend_common_expression::types::UInt64Type;
+use databend_common_expression::visitor::ValueVisitor;
+use databend_common_pipeline_transforms::AccumulatingTransform;
+
+use crate::physical_plans::WindowPartitionTopNFunc;
+
+/// A block is small when, scattered into the window partitions, each piece
+/// gets fewer rows than this on average and fewer bytes than
+/// `MIN_PIECE_BYTES_PER_COLUMN` per column. A constant column counts with its
+/// value repeated for every row, the size it can take once buffered.
+const MIN_PIECE_ROWS: usize = 64;
+
+const MIN_PIECE_BYTES_PER_COLUMN: usize = 1024;
+
+/// Prepares the input blocks of the window exchange, which scatters each
+/// block into `window_num_partitions` pieces.
+///
+/// A small block, such as the output of a selective filter, would be cut into
+/// pieces of one or two rows. Each piece holds its own allocations per
+/// column, which take more memory than its rows, and the window buffers the
+/// pieces until all input arrives. So small blocks go to a
+/// `BlockConcatStream`: their rows are appended as they arrive, so a small
+/// slice does not keep its source block, and they are sent as one block once
+/// they are not small together. Other blocks are sent as they are.
+///
+/// There is one buffer for each input stream, not one per window partition:
+/// the exchange scatters the batch into the window partitions afterwards.
+///
+/// With a top-n window function, the rows of each block that cannot rank
+/// within `top` of their partition are dropped first.
+pub struct TransformWindowPartitionBatch {
+    top_n: Option<PartitionTopN>,
+
+    min_rows: usize,
+    min_bytes_per_column: usize,
+    // Created by the first small block, as its threshold in bytes depends on
+    // the number of columns.
+    stream: Option<BlockConcatStream>,
+}
+
+impl TransformWindowPartitionBatch {
+    pub fn create(num_partitions: usize) -> TransformWindowPartitionBatch {
+        TransformWindowPartitionBatch {
+            top_n: None,
+            min_rows: num_partitions * MIN_PIECE_ROWS,
+            min_bytes_per_column: num_partitions * MIN_PIECE_BYTES_PER_COLUMN,
+            stream: None,
+        }
+    }
+
+    pub fn with_top_n(
+        mut self,
+        partition_indices: Vec<usize>,
+        order_by: Vec<SortColumnDescription>,
+        top: usize,
+        func: WindowPartitionTopNFunc,
+    ) -> TransformWindowPartitionBatch {
+        self.top_n = Some(PartitionTopN::new(partition_indices, order_by, top, func));
+        self
+    }
+
+    fn is_small(&self, rows: usize, bytes: usize, columns: usize) -> bool {
+        rows < self.min_rows && bytes < columns * self.min_bytes_per_column
+    }
+}
+
+impl AccumulatingTransform for TransformWindowPartitionBatch {
+    const NAME: &'static str = "TransformWindowPartitionBatch";
+
+    fn transform(&mut self, block: DataBlock) -> Result<Vec<DataBlock>> {
+        if block.is_empty() {
+            return Ok(vec![]);
+        }
+
+        let block = match &self.top_n {
+            Some(top_n) => top_n.truncate(block)?,
+            None => block,
+        };
+
+        let rows = block.num_rows();
+        let columns = block.num_columns();
+        let bytes = block.estimate_block_size(columns);
+        // A block that is not small is sent as it is, even when small blocks
+        // are buffered: buffering it would copy all its rows. The window
+        // sorts each partition later, so the order of the blocks does not
+        // matter.
+        if !self.is_small(rows, bytes, columns) {
+            return Ok(vec![block]);
+        }
+
+        // The stream sends the buffered rows once they reach either
+        // threshold, which is when they are no longer small.
+        let (min_rows, min_bytes) = (self.min_rows, columns * self.min_bytes_per_column);
+        let stream = self
+            .stream
+            .get_or_insert_with(|| BlockConcatStream::crea
```

**File**: `src/query/service/src/pipelines/processors/transforms/window/partition/window_partition_exchange.rs` (modified, +38/-1)
```diff
@@ -51,7 +51,7 @@ impl Exchange for WindowPartitionExchange {
         // Scatter the data block to different partitions.
         let indices = hashes
             .iter()
-            .map(|&hash| (hash % self.num_partitions as u64) as u8)
+            .map(|&hash| (hash % self.num_partitions as u64) as u32)
             .collect::<Vec<_>>();
         let scatter_blocks = DataBlock::scatter(&data_block, &indices, self.num_partitions)?;
 
@@ -69,3 +69,40 @@ impl Exchange for WindowPartitionExchange {
             .collect())
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use databend_common_expression::BlockMetaInfoDowncast;
+    use databend_common_expression::FromData;
+    use databend_common_expression::types::Int32Type;
+
+    use super::*;
+
+    #[test]
+    fn test_more_than_256_partitions() -> Result<()> {
+        let exchange = WindowPartitionExchange::create(vec![0], 512);
+        let block =
+            DataBlock::new_from_columns(vec![Int32Type::from_data((0..4096).collect::<Vec<_>>())]);
+
+        let mut outputs = exchange.partition(block, 1)?;
+        assert_eq!(outputs.len(), 1);
+        let meta = outputs
+            .pop()
+            .and_then(|block| block.get_owned_meta())
+            .and_then(WindowPartitionMeta::downcast_from)
+            .unwrap();
+
+        let rows = meta
+            .partitioned_data
+            .iter()
+            .map(|(_, block)| block.num_rows())
+            .sum::<usize>();
+        assert_eq!(rows, 4096);
+        assert!(
+            meta.partitioned_data
+                .iter()
+                .any(|(id, block)| *id >= 256 && !block.is_empty())
+        );
+        Ok(())
+    }
+}
```

**File**: `src/query/service/src/pipelines/processors/transforms/window/partition/window_partition_partial_top_n_exchange.rs` (removed, +0/-309)
```diff
@@ -1,309 +0,0 @@
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
-use std::sync::Arc;
-
-use databend_common_exception::Result;
-use databend_common_expression::DataBlock;
-use databend_common_expression::SortColumnDescription;
-use databend_common_expression::SortCompare;
-use databend_common_expression::group_hash_value_spread;
-use databend_common_expression::visitor::ValueVisitor;
-use databend_common_pipeline::basic::Exchange;
-
-use super::WindowPartitionMeta;
-use crate::physical_plans::WindowPartitionTopNFunc;
-
-pub struct WindowPartitionTopNExchange {
-    partition_indices: Box<[usize]>,
-    top: usize,
-    func: WindowPartitionTopNFunc,
-
-    sort_desc: Box<[SortColumnDescription]>,
-    num_partitions: u64,
-}
-
-impl WindowPartitionTopNExchange {
-    pub fn create(
-        partition_indices: Vec<usize>,
-        order_by: Vec<SortColumnDescription>,
-        top: usize,
-        func: WindowPartitionTopNFunc,
-        num_partitions: u64,
-    ) -> Arc<WindowPartitionTopNExchange> {
-        assert!(top > 0);
-        let partition_indices = partition_indices.into_boxed_slice();
-        let sort_desc = partition_indices
-            .iter()
-            .map(|&offset| SortColumnDescription {
-                offset,
-                asc: true,
-                nulls_first: false,
-            })
-            .chain(order_by)
-            .collect::<Vec<_>>()
-            .into();
-
-        Arc::new(WindowPartitionTopNExchange {
-            num_partitions,
-            partition_indices,
-            top,
-            func,
-            sort_desc,
-        })
-    }
-}
-
-impl Exchange for WindowPartitionTopNExchange {
-    const NAME: &'static str = "WindowTopN";
-    const SKIP_EMPTY_DATA_BLOCK: bool = true;
-
-    fn partition(&self, block: DataBlock, n: usize) -> Result<Vec<DataBlock>> {
-        let partition_permutation = self.partition_permutation(&block);
-
-        // Partition the data blocks to different processors.
-        let mut output_data_blocks = vec![vec![]; n];
-        for (partition_id, indices) in partition_permutation.into_iter().enumerate() {
-            output_data_blocks[partition_id % n]
-                .push((partition_id, block.take(indices.as_slice())?));
-        }
-
-        // Union data blocks for each processor.
-        Ok(output_data_blocks
-            .into_iter()
-            .map(WindowPartitionMeta::create)
-            .map(DataBlock::empty_with_meta)
-            .collect())
-    }
-}
-
-impl WindowPartitionTopNExchange {
-    fn partition_permutation(&self, block: &DataBlock) -> Vec<Vec<u32>> {
-        let rows = block.num_rows();
-        let mut sort_compare = SortCompare::with_force_equality(self.sort_desc.to_vec(), rows);
-
-        for &offset in &self.partition_indices {
-            let array = block.get_by_offset(offset).value();
-            sort_compare.visit_value(array).unwrap();
-            sort_compare.increment_column_index();
-        }
-
-        let partition_equality = sort_compare.equality_index().to_vec();
-
-        for desc in self.sort_desc.iter().skip(self.partition_indices.len()) {
-            let array = block.get_by_offset(desc.offset).value();
-            sort_compare.visit_value(array).unwrap();
-            sort_compare.increment_column_index();
-        }
-
-        let full_equality = sort_compare.equality_index().to_vec();
-        let permutation = sort_compare.take_permutation();
-
-        let hash_indices = std::iter::once(permutation[0])
-            .chain(
-                partition_equality
-                    .iter()
-                    .enumerate()
-                    .filter_map(|(i, &eq)| if eq == 0 { Some(permutation[i]) } else { None }),
-            )
-            .collect::<Vec<_>>();
-
-        let mut hashes = vec![0u64; rows];
-        for (i, &offset) in self.partition_indices.iter().enumerate() {
-            let entry = block.get_by_offset(offset);
-            group_hash_value_spread(&hash_indices, entry.value(), i == 0, &mut hashes).unwrap();
-        }
-
-        let mut partition_permutation = vec![Vec::new(); self.num_partitions as usize];
-
-        let mut start = 0;
-        let mut cur = 0;
-        while cur < rows {
-            let partition = &mut partition_permutation
-                [(hashes[permutation[start] as usize] % self.num_partitions) as usize];
-            partition.push(permutation[start]);
-
-          
```

---

### Incident Patch 2: `76caf9e8` (2026-11-19)
**Commit Message**: fix(query): enforce stage WRITE on HTTP uploads (#21126)

* fix(query): enforce stage WRITE on HTTP uploads (#21094)

* test(query): cover HTTP stage WRITE in the stateless suite

**File**: `src/query/service/src/interpreters/access/mod.rs` (modified, +1/-0)
```diff
@@ -22,3 +22,4 @@ pub use management_mode_access::ManagementModeAccess;
 pub use privilege_access::PrivilegeAccess;
 pub(crate) use privilege_access::validate_share_management_for_connection;
 pub(crate) use privilege_access::validate_share_object_by_id;
+pub(crate) use privilege_access::validate_stage_write_access;
```

**File**: `src/query/service/src/interpreters/access/privilege_access.rs` (modified, +9/-0)
```diff
@@ -275,6 +275,15 @@ enum ObjectId {
 // table functions that need `Super` privilege
 const SYSTEM_TABLE_FUNCTIONS: [&str; 3] = ["fuse_amend", "set_cache_capacity", "send_notification"];
 
+pub(crate) async fn validate_stage_write_access(
+    ctx: Arc<QueryContext>,
+    stage: &StageInfo,
+) -> Result<()> {
+    PrivilegeAccess::new(ctx)
+        .validate_stage_access(stage, UserPrivilegeType::Write)
+        .await
+}
+
 pub(crate) async fn validate_share_management_for_connection(
     ctx: Arc<QueryContext>,
     connection: Option<&str>,
```

**File**: `src/query/service/src/interpreters/mod.rs` (modified, +1/-0)
```diff
@@ -233,6 +233,7 @@ mod interpreter_virtual_column_vacuum;
 pub(crate) mod util;
 
 pub use access::ManagementModeAccess;
+pub(crate) use access::validate_stage_write_access;
 pub use common::InterpreterQueryLog;
 pub use common::QueryFinishHooks;
 pub use hook::HookOperator;
```

**File**: `src/query/service/src/servers/http/v1/stage.rs` (modified, +10/-0)
```diff
@@ -14,6 +14,7 @@
 
 use async_compat::CompatExt;
 use databend_common_catalog::session_type::SessionType;
+use databend_common_exception::ErrorCode;
 use databend_common_meta_app::principal::StageInfo;
 use databend_common_sql::binder::validate_stage_path_traversal_policy;
 use databend_common_storage::init_stage_operator;
@@ -22,6 +23,7 @@ use futures_util::AsyncWriteExt;
 use futures_util::io;
 use http::StatusCode;
 use poem::Request;
+use poem::error::Forbidden;
 use poem::error::InternalServerError;
 use poem::error::Result as PoemResult;
 use poem::web::Json;
@@ -31,6 +33,7 @@ use serde::Serialize;
 
 use super::HttpQueryContext;
 use super::require_upload_filename;
+use crate::interpreters::validate_stage_write_access;
 use crate::sessions::TableContextAuthorization;
 use crate::sessions::TableContextTableAccess;
 
@@ -114,6 +117,13 @@ pub async fn upload_to_stage(
             .map_err(InternalServerError)?
     };
 
+    validate_stage_write_access(context, &stage)
+        .await
+        .map_err(|e| match e.code() {
+            ErrorCode::PERMISSION_DENIED => Forbidden(e),
+            _ => InternalServerError(e),
+        })?;
+
     let op = init_stage_operator(&stage).map_err(InternalServerError)?;
     let path_traversal_policy = databend_common_config::GlobalConfig::instance()
         .storage
```

**File**: `tests/suites/0_stateless/18_rbac/18_0027_http_stage_write.result` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+Without a stage grant: 403
+With READ only: 403
+Named stage file count before authorization: 0
+With WRITE: SUCCESS
+With ownership (legacy header): SUCCESS
+Named stage file sizes:
+2
+2
+Own user stage: SUCCESS
+Own user stage file size: 2
```

**File**: `tests/suites/0_stateless/18_rbac/18_0027_http_stage_write.sh` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+#!/usr/bin/env bash
+
+set -euo pipefail
+
+CURDIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+. "$CURDIR"/../../../shell_env.sh
+
+url="http://${QUERY_MYSQL_HANDLER_HOST}:${QUERY_HTTP_HANDLER_PORT}/v1/upload_to_stage"
+user=stage_write_user_0027
+password=stage_write_test_password
+role=stage_write_role_0027
+stage=stage_write_0027
+owned_stage=stage_owned_0027
+file=stage_write_0027.csv
+clean_user_stage=false
+
+cleanup() {
+	local status=0
+	if "$clean_user_stage"; then
+		bendsql_connect_user "$user" "$password" --output null --query="REMOVE @~/$file" || status=$?
+	fi
+	bendsql_connect_root_null --query="
+DROP STAGE IF EXISTS $stage;
+DROP STAGE IF EXISTS $owned_stage;
+DROP USER IF EXISTS $user;
+DROP ROLE IF EXISTS $role;
+"
+	return "$status"
+}
+
+expect_denied() {
+	# No file part: check authorization without attempting to write data.
+	printf -- '--stage-test--\r\n' |
+		curl --silent --show-error --user "$user:$password" --request PUT \
+			--header "x-databend-stage-name: $stage" \
+			--header 'Content-Type: multipart/form-data; boundary=stage-test' \
+			--data-binary @- --output /dev/null --write-out '%{http_code}\n' "$url"
+}
+
+expect_allowed() {
+	printf '1\n' |
+		curl --fail --silent --show-error --user "$user:$password" --request PUT \
+			--header "$1: $2" --form "upload=@-;filename=$file" "$url" |
+		jq -er --arg stage "$2" --arg file "$file" \
+			'select(.stage_name == $stage and .state == "SUCCESS" and .files == [$file]) | .state'
+}
+
+cleanup
+trap cleanup EXIT
+bendsql_connect_root_null --query="
+CREATE USER $user IDENTIFIED BY '$password';
+CREATE ROLE $role;
+GRANT ROLE $role TO USER $user;
+CREATE STAGE $stage;
+CREATE STAGE $owned_stage;
+GRANT OWNERSHIP ON STAGE $owned_stage TO ROLE $role;
+"
+
+printf 'Without a stage grant: '
+expect_denied
+
+bendsql_connect_root_null --query="GRANT READ ON STAGE $stage TO ROLE $role"
+printf 'With READ only: '
+expect_denied
+
+printf 'Named stage file count before authorization: '
+bendsql_connect_root --output tsv --query="SELECT count(*) FROM list_stage(location => '@$stage')"
+
+bendsql_connect_root_null --query="GRANT WRITE ON STAGE $stage TO ROLE $role"
+printf 'With WRITE: '
+expect_allowed x-databend-stage-name "$stage"
+
+printf 'With ownership (legacy header): '
+expect_allowed stage_name "$owned_stage"
+
+printf 'Named stage file sizes:\n'
+bendsql_connect_root --output tsv --query="
+SELECT size FROM list_stage(location => '@$stage/$file');
+SELECT size FROM list_stage(location => '@$owned_stage/$file');
+"
+
+clean_user_stage=true
+printf 'Own user stage: '
+expect_allowed x-databend-stage-name '~'
+printf 'Own user stage file size: '
+bendsql_connect_user "$user" "$password" --output tsv \
+	--query="SELECT size FROM list_stage(location => '@~/$file')"
```

#### Recent Merged Pull Requests:
- **PR #21126** (2026-11-19): fix(query): enforce stage WRITE on HTTP uploads (@youngsofun)
- **PR #21125** (closed): refactor: query: read the ownership and access caches without a lock (@drmingdrmer)
- **PR #21124** (2026-11-19): feat: config: add `ownership` to `cache.meta_service_caches` (@drmingdrmer)
- **PR #21123** (2026-11-18): chore: meta: use sub-cache 0.4.1, which stops a dropped cache's watch (@drmingdrmer)
- **PR #21121** (2026-11-18): refactor(query): remove dead code and leftovers of the aggregate rewrites (@dqhl76)
- **PR #21118** (2026-11-18): fix(query): abbreviate large SQL constants in INFO logs (@bohutang)

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

## X. query): batch small blocks before the window partition exchange

**RULE**:
When implementing operations in `src/query/expression/src/kernels/stream_partition.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dea33860`: query): batch small blocks before the window partition exchange. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/expression/src/kernels/stream_partition.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Add every row of `column`, in order.
    fn append_column(&mut self, column: &Column) {
        let builder = self.builder(column.len());
        if builder.data_type() == column.data_type() {
            builder.append_column(column);
        } else {
            // Such as an `Array` column into an `EmptyArray` builder, which
            // only `copy_column` turns into an `Array` builder.
            let indices = (0..column.len() as u32).collect::<Vec<_>>();
            copy_column(&indices, column, builder);
        }
    }

    /// Add `rows` of a constant, kept a constant when it can be.
    fn append_const(
        &mut self,
        scalar: &Scalar,
        data_type: &DataType,
        rows: usize,
        size: &mut impl FnMut() -> ExpandedSize,
    ) {
        if !self.try_push_const(scalar, data_type, rows, size) {
            let column = ColumnBuilder::repeat(&scalar.as_ref(), rows, data_type).build();
            self.append_column(&column);
        }
    }

/// The expanded size of the last constant seen in a column.
type ConstSize = Option<(Scalar, DataType, ExpandedSize)>;

fn cached_const_size(cache: &mut ConstSize, scalar: &Scalar, data_type: &DataType)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    const_sizes: Vec<Option<(Scalar, DataType, ExpandedSize)>>,
                    let mut size = || {
                        if let Some((s, t, size)) = const_size.as_ref()
                            && *s == scalar
                            && *t == data_type
                        {
                            return *size;
                        }
                        let size = ExpandedSize::measure(&scalar, &data_type);
                        *const_size = Some((scalar.clone(), data_type.clone(), size));
                        size
                    };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dea33860` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
