# Verification Protocol: Verification Protocol: Empirical Defect Shield for databendlabs-databend-learnings

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs-databend-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T03:14:32.767Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-databendlabs-databend-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs-databend-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T03:14:32.767Z`  
> **Learning ID**: `LEARN-EVO-databendlabs-databend-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `databendlabs-databend-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `b5eb22e2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T03:14:27.063Z  
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
> **Harvest Timestamp**: 2026-11-24T03:14:27.058Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9505 stars

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
- **Issue #21181** (2026-11-24): **fix: semaphore: wait before retrying a failed acquisition**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  When an attempt to acquire a query-queue semaphore failed, `MetaStore::new_acquired_by_time` retried it at once. Since meta servers v260629.9.0 only the leader serves watches. While no meta node the client knows serves the watch, such as during a leader election, every attempt fails as soon as it starts, after writing a permit entry and deleting it. Each queued query did that in a tight loop until its queue timeout. A failed attempt is now retried after 100 ms, doubling with each failure in a row, up to 2 s.  A retried attempt still moves the query to the back of the queue. Keeping the first attempt's timestamp would keep its place, but it is not safe with the current queue: `SemaphoreQueue` admits a waiting entry that sorts before the last acquired one regardless of capacity, so after a leader change many waiters could be admitted at once. Keeping the place needs the acquirer to watch again without leaving the queue, and is left for a follow-up.  Tests: `test_new_acquired_by_time_waits_before_retrying_a_failed_attempt`, in `src/meta/store/tests/it/semaphore.rs`, calls the method against a local meta service whose semaphore queue holds an entry that does not decode, so that every attempt fails as soon as it starts. It checks that the fourth attempt's permit entry appears at least 700 ms after the call starts.  ##### fix: semaphore: wait before retrying a failed acquis

- **Issue #21179** (2026-11-23): **fix(meta): reject deduplication markers without durable updates**
  *Symptoms*:   I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  ##### fix(meta): reject deduplication markers without durable updates # Summary  Write persistent DML deduplication markers only with a durable metadata update. Temporary-table-only writes must not leave markers in Meta.  # Details  SessionCatalog skips Meta when a request has no persistent updates, and the table API rejects labeled requests without such updates. A stream offset update still qualifies even if no table rows changed.  TxnBuffer separates local from persistent labels before combining statements, so local retry detection still works without attaching a temporary write's label to another statement's durable updates.   ##### fix(query): make DML deduplication labels session-only # Summary  Keep deduplication labels tied to the client that supplies them rather than allowing a tenant-wide retry token to affect unrelated writes.  # Details  Limit deduplicate_label to session scope. Query rejects new global values and ignores previously stored global values when loading settings. Use statement settings or the HTTP request header for one write and its retries; existing session inputs remain available.  Document the intended operation and input contract separately from its implementation. This change does not alter marker keys or DML commits.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test  - _Explain why_  ## Type of change  - [x

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

### Incident Patch 1: `08cac7de` (2026-11-23)
**Commit Message**: fix: locks: keep waiting when a table lock watch is refused (#21177)

* feat: config: warn about the deprecated ownership cache flag

# Summary

A query node whose config sets the deprecated
`cache.meta_service_ownership_cache` now logs a warning at startup that
names its replacement, `ownership` in `cache.meta_service_caches`. The
flag still enables the ownership cache, and stays for backward
compatibility.

# Details

`CacheConfig::deprecated_ownership_cache_warning` returns the warning
for such a config, and `GlobalServices::init_with` logs it right after
`GlobalLogger::init`. The config is loaded before any logger is set up,
so a warning logged while it loads, where the one for the old `catalog`
key is logged, reaches no log.

The flag is not rejected at startup, as `meta_username` and other
deprecated keys are, because configs written since it was released may
set it.

* fix: locks: keep waiting when a table lock watch is refused

# Summary

A statement that waits for a table lock no longer fails when the meta
service refuses the watch on the lock revision before its own. The
waiter lists the revisions again 1 s later, and keeps waiting until it
holds the lock or `acquire_lock

**File**: `src/query/config/src/config.rs` (modified, +12/-2)
```diff
@@ -3172,8 +3172,9 @@ impl Default for LocalConfig {
 #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Args)]
 #[serde(default)]
 pub struct CacheConfig {
-    /// Deprecated: name `ownership` in `meta_service_caches` instead. When true, it enables
-    /// [`MetaServiceCache::Ownership`] as that name does.
+    /// Deprecated, kept for backward compatibility: name `ownership` in `meta_service_caches`
+    /// instead. When true, it enables [`MetaServiceCache::Ownership`] as that name does, and the
+    /// node logs a warning at startup.
     #[clap(long = "cache-enable-meta-service-ownership", default_value = "false")]
     #[serde(default = "bool_false")]
     pub meta_service_ownership_cache: bool,
@@ -3689,6 +3690,15 @@ impl CacheConfig {
         self.meta_service_caches.contains(&cache)
             || (cache == MetaServiceCache::Ownership && self.meta_service_ownership_cache)
     }
+
+    /// The warning to log at startup when this config sets the deprecated
+    /// `meta_service_ownership_cache`.
+    pub fn deprecated_ownership_cache_warning(&self) -> Option<&'static str> {
+        self.meta_service_ownership_cache.then_some(
+            "`cache.meta_service_ownership_cache` is deprecated but still enables the ownership \
+             cache; add `ownership` to `cache.meta_service_caches` instead",
+        )
+    }
 }
 
 /// A watched copy of meta-service data, enabled by its snake_case name, such as
```

**File**: `src/query/config/tests/it/meta_service_caches.rs` (modified, +24/-0)
```diff
@@ -94,3 +94,27 @@ fn test_meta_service_caches_ownership() {
         .cache;
     assert!(!cache.is_meta_service_cache_enabled(MetaServiceCache::Ownership));
 }
+
+/// Only the deprecated `meta_service_ownership_cache = true` gets a startup warning: `ownership`
+/// in the list enables the same cache without one.
+#[test]
+fn test_deprecated_ownership_cache_warning() {
+    let deprecated: Config =
+        toml::from_str("[cache]\nmeta_service_ownership_cache = true\n").unwrap();
+    assert!(
+        deprecated
+            .cache
+            .deprecated_ownership_cache_warning()
+            .is_some()
+    );
+
+    let listed: Config =
+        toml::from_str("[cache]\nmeta_service_caches = [\"ownership\"]\n").unwrap();
+    assert_eq!(listed.cache.deprecated_ownership_cache_warning(), None);
+
+    let cache = Args::try_parse_from(["databend-query"])
+        .unwrap()
+        .config
+        .cache;
+    assert_eq!(cache.deprecated_ownership_cache_warning(), None);
+}
```

**File**: `src/query/service/src/global_services.rs` (modified, +5/-0)
```diff
@@ -134,6 +134,11 @@ impl GlobalServices {
         );
         log_labels.insert("node_id".to_string(), config.query.node_id.clone());
         GlobalLogger::init(&app_name_shuffle, &config.log, log_labels);
+        // The config is loaded before logging is set up: a warning about it logged while loading
+        // reaches no log, so log it now.
+        if let Some(warning) = config.cache.deprecated_ownership_cache_warning() {
+            log::warn!("{warning}");
+        }
 
         // 3. runtime init.
         GlobalIORuntime::init(config.storage.num_cpus as usize)?;
```

**File**: `src/query/service/src/locks/lock_holder.rs` (modified, +204/-6)
```diff
@@ -25,10 +25,16 @@ use databend_common_meta_app::schema::CreateLockRevReq;
 use databend_common_meta_app::schema::DeleteLockRevReq;
 use databend_common_meta_app::schema::ExtendLockRevReq;
 use databend_common_meta_app::schema::ListLockRevReq;
+use databend_common_meta_app::schema::LockMeta;
+use databend_common_meta_app::schema::TableLockIdentV2;
+use databend_common_meta_store::MetaStore;
+use databend_common_meta_store::WatchStream;
 use databend_common_metrics::lock::record_acquired_lock_nums;
 use databend_common_metrics::lock::record_created_lock_nums;
 use databend_common_users::UserApiProvider;
 use databend_meta_client::kvapi::StructKey;
+use databend_meta_client::types::MetaError;
+use databend_meta_client::types::SeqV;
 use databend_meta_client::types::protobuf::WatchRequest;
 use databend_meta_client::types::protobuf::watch_request::FilterType;
 use futures_util::StreamExt;
@@ -39,6 +45,43 @@ use crate::locks::lease_keeper::LeaseOps;
 use crate::meta_service_error;
 use crate::sessions::SessionManager;
 
+/// How long a waiter whose watch failed waits before it lists the revisions again.
+const WATCH_RETRY_DELAY: Duration = Duration::from_secs(1);
+
+/// The meta-service reads a waiter makes on the revision before its own. A trait, so that a test
+/// can refuse the watch.
+#[async_trait]
+trait PrevRevisionApi: Send + Sync {
+    /// Watch for the deletion of `key`.
+    async fn watch_deletion(
+        &self,
+        key: &TableLockIdentV2,
+    ) -> std::result::Result<WatchStream, MetaError>;
+
+    async fn get_lock(
+        &self,
+        key: &TableLockIdentV2,
+    ) -> std::result::Result<Option<SeqV<LockMeta>>, MetaError>;
+}
+
+#[async_trait]
+impl PrevRevisionApi for MetaStore {
+    async fn watch_deletion(
+        &self,
+        key: &TableLockIdentV2,
+    ) -> std::result::Result<WatchStream, MetaError> {
+        let req = WatchRequest::new(key.to_string_key(), None).with_filter(FilterType::Delete);
+        self.watch(req).await
+    }
+
+    async fn get_lock(
+        &self,
+        key: &TableLockIdentV2,
+    ) -> std::result::Result<Option<SeqV<LockMeta>>, MetaError> {
+        self.get_pb(key).await
+    }
+}
+
 struct TableLockLeaseOps {
     catalog: Arc<dyn Catalog>,
     extend_req: ExtendLockRevReq,
@@ -88,6 +131,26 @@ impl LockHolder {
         req: CreateLockRevReq,
         should_retry: bool,
         acquire_timeout: Duration,
+    ) -> Result<u64> {
+        let meta_api = UserApiProvider::instance().get_meta_store_client();
+        self.acquire(
+            catalog,
+            req,
+            should_retry,
+            acquire_timeout,
+            meta_api.as_ref(),
+        )
+        .await
+    }
+
+    /// [`Self::try_acquire_lock`], with `prev_api` for the reads on the revision before this one.
+    async fn acquire(
+        self: &Arc<Self>,
+        catalog: Arc<dyn Catalog>,
+        req: CreateLockRevReq,
+        should_retry: bool,
+        acquire_timeout: Duration,
+        prev_api: &dyn PrevRevisionApi,
     ) -> Result<u64> {
         let start = Instant::now();
 
@@ -99,7 +162,6 @@ impl LockHolder {
 
         let revision = self.start(catalog.clone(), req).await?;
 
-        let meta_api = UserApiProvider::instance().get_meta_store_client();
         let list_table_lock_req = ListLockRevReq::new(lock_key.clone());
 
         loop {
@@ -148,12 +210,28 @@ impl LockHolder {
             let watch_delete_ident = lock_key.gen_v2_key(prev_revision);
 
             // Get the previous revision, watch the delete event.
-            let req = WatchRequest::new(watch_delete_ident.to_string_key(), None)
-                .with_filter(FilterType::Delete);
-            let mut watch_stream = meta_api.watch(req).await.map_err(meta_service_error)?;
+            let mut watch_stream = match prev_api.watch_deletion(&watch_delete_ident).await {
+                Ok(watch_stream) => watch_stream,
+                Err(error) => {
+                    // A meta node refuses a watch while it cannot serve one, such as during a
+                    // leader election, and the client gives up once no node it knows serves it.
+                    // Listing the revisions again finds the lock if it was released meanwhile.
+                    let remaining = acquire_timeout.saturating_sub(start.elapsed());
+                    let delay = WATCH_RETRY_DELAY.min(remaining);
+                    log::warn!(
+                        "Failed to watch the previous table lock revision (rev: {}, prev: {}): {}; listing the revisions again in {:?}",
+                        revision,
+                        prev_revision,
+                        error,
+                        delay
+                    );
+                    tokio::time::sleep(delay).await;
+                    continue;
+                }
+            };
 
-            let Some(lock_meta) = meta_api
-                .get_pb(&watch_delete_ident)
+            let Some(lock_meta) = prev_api
+    
```

---

### Incident Patch 2: `999fd5f4` (2026-11-23)
**Commit Message**: fix(query): tighten stage location checks (#21172)

* fix(query): tighten stage location checks

* fix(query): check storage security before opening stored locations

**File**: `scripts/ci/deploy/config/databend-query-node-2.toml` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ auto_sync_interval = 60
 [storage]
 # fs | s3 | azblob | obs | oss
 type = "fs"
+allow_insecure = true
 
 # Set a local folder to store your data.
 # Comment out this block if you're NOT using local file system as storage.
```

**File**: `scripts/ci/deploy/config/databend-query-node-3.toml` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ auto_sync_interval = 60
 [storage]
 # fs | s3 | azblob | obs | oss
 type = "fs"
+allow_insecure = true
 
 # Set a local folder to store your data.
 # Comment out this block if you're NOT using local file system as storage.
```

**File**: `src/common/storage/src/config.rs` (modified, +41/-0)
```diff
@@ -19,8 +19,10 @@ use std::str::FromStr;
 use std::sync::Arc;
 
 use databend_common_base::base::GlobalInstance;
+use databend_common_base::runtime::ThreadTracker;
 use databend_common_exception::ErrorCode;
 use databend_common_meta_app::storage::StorageParams;
+use log::LevelFilter;
 use serde::Deserialize;
 use serde::Serialize;
 use tokio::sync::RwLock;
@@ -132,6 +134,45 @@ pub enum EndpointUrlPolicy {
     Allowlist,
 }
 
+/// Process-wide `storage.allow_insecure`, for code paths that cannot reach the
+/// query config, such as opening an operator for a stored stage.
+#[derive(Clone, Copy, Debug)]
+struct StorageAllowInsecure(bool);
+
+pub struct StorageSecurityRegistry;
+
+impl StorageSecurityRegistry {
+    pub fn init(allow_insecure: bool) {
+        GlobalInstance::set(StorageAllowInsecure(allow_insecure));
+    }
+
+    /// Whether insecure storage is allowed on this node. Defaults to `true`
+    /// when the registry is not initialized, e.g. in unit tests.
+    pub fn allow_insecure() -> bool {
+        GlobalInstance::try_get::<StorageAllowInsecure>().is_none_or(|v| v.0)
+    }
+}
+
+/// Whether the current thread runs the node's own history log queries, whose
+/// storage comes from server config instead of user input.
+pub fn is_history_log_context() -> bool {
+    ThreadTracker::capture_log_settings().is_some_and(|settings| settings.level == LevelFilter::Off)
+}
+
+/// Rejects insecure storage (e.g. `fs://`, plain `http://`) unless allowed.
+pub fn ensure_secure_storage_params(
+    params: &StorageParams,
+    allow_insecure: bool,
+) -> databend_common_exception::Result<()> {
+    if params.is_secure() || allow_insecure || is_history_log_context() {
+        return Ok(());
+    }
+    Err(ErrorCode::StorageInsecure(format!(
+        "insecure storage {} is not allowed, set storage.allow_insecure to enable it",
+        params.storage_type()
+    )))
+}
+
 /// Runtime egress policy for external storage endpoint URLs.
 ///
 /// This config is process-local and is applied by query nodes before creating
```

**File**: `src/common/storage/src/lib.rs` (modified, +4/-0)
```diff
@@ -53,6 +53,9 @@ pub use config::EndpointUrlPolicyConfig;
 pub use config::ShareTableConfig;
 pub use config::StagePathTraversalPolicy;
 pub use config::StorageConfig;
+pub use config::StorageSecurityRegistry;
+pub use config::ensure_secure_storage_params;
+pub use config::is_history_log_context;
 pub use endpoint_policy::EndpointUrlPolicyRegistry;
 pub use endpoint_policy::check_storage_endpoint_url;
 pub use endpoint_policy::check_storage_params_endpoints;
@@ -120,6 +123,7 @@ pub use stage::StageFileInfoStream;
 pub use stage::StageFileStatus;
 pub use stage::StageFilesInfo;
 pub use stage::ensure_no_stage_path_traversal;
+pub use stage::ensure_valid_stage_prefix_name;
 pub use stage::init_stage_operator;
 pub use stage::internal_stage_storage_params;
 pub use stage::is_stage_path_traversal;
```

**File**: `src/common/storage/src/stage.rs` (modified, +47/-7)
```diff
@@ -37,6 +37,8 @@ use regex::Regex;
 
 use crate::DataOperator;
 use crate::EndpointPolicyScope;
+use crate::StorageSecurityRegistry;
+use crate::ensure_secure_storage_params;
 use crate::init_operator;
 use crate::init_operator_with_policy_scope;
 
@@ -104,27 +106,44 @@ pub fn init_stage_operator(stage_info: &StageInfo) -> Result<Operator> {
             }
             v => v,
         };
+        // Stored stages may predate the check at CREATE/ALTER STAGE.
+        ensure_secure_storage_params(&storage, StorageSecurityRegistry::allow_insecure())?;
 
         Ok(init_operator_with_policy_scope(
             &storage,
             EndpointPolicyScope::External,
         )?)
     } else {
-        Ok(init_operator(&stage_root_params(stage_info))?)
+        Ok(init_operator(&stage_root_params(stage_info)?)?)
     }
 }
 
 /// Storage params backing an internal or user stage, rooted at the stage
 /// prefix. Returns `None` for external stages.
-pub fn internal_stage_storage_params(stage_info: &StageInfo) -> Option<StorageParams> {
-    (stage_info.stage_type != StageType::External).then(|| stage_root_params(stage_info))
+pub fn internal_stage_storage_params(stage_info: &StageInfo) -> Result<Option<StorageParams>> {
+    (stage_info.stage_type != StageType::External)
+        .then(|| stage_root_params(stage_info))
+        .transpose()
 }
 
-fn stage_root_params(stage_info: &StageInfo) -> StorageParams {
+fn stage_root_params(stage_info: &StageInfo) -> Result<StorageParams> {
+    ensure_valid_stage_prefix_name(&stage_info.stage_name)?;
     let stage_prefix = stage_info.stage_prefix();
-    DataOperator::instance()
+    Ok(DataOperator::instance()
         .params()
-        .map_root(|path| format!("{path}/{stage_prefix}"))
+        .map_root(|path| format!("{path}/{stage_prefix}")))
+}
+
+/// Rejects stage names that would place an internal or user stage outside
+/// its own directory under the storage root.
+pub fn ensure_valid_stage_prefix_name(name: &str) -> Result<()> {
+    if StageInfo::is_valid_prefix_name(name) {
+        Ok(())
+    } else {
+        Err(ErrorCode::BadArguments(format!(
+            "invalid stage name {name:?}: must not be empty, '.' or '..', and must not contain '/'"
+        )))
+    }
 }
 
 pub fn is_stage_path_traversal(path: &str) -> bool {
@@ -404,6 +423,7 @@ mod tests {
     use databend_common_meta_app::storage::StorageFsConfig;
     use databend_common_meta_app::storage::StorageParams;
 
+    use super::init_stage_operator;
     use super::internal_stage_storage_params;
     use super::is_stage_path_traversal;
 
@@ -412,7 +432,27 @@ mod tests {
         // Must not touch the global DataOperator for external stages.
         let stage =
             StageInfo::new_external_stage(StorageParams::Fs(StorageFsConfig::default()), false);
-        assert!(internal_stage_storage_params(&stage).is_none());
+        assert!(internal_stage_storage_params(&stage).unwrap().is_none());
+    }
+
+    #[test]
+    fn test_is_valid_stage_prefix_name() {
+        for name in ["", ".", "..", "/", "a/", "/a", "a/b", "../..", "a/../b"] {
+            assert!(!StageInfo::is_valid_prefix_name(name), "{name:?}");
+        }
+        for name in ["a", "user@example.com", "a.b", "..a", "a..", "a\\b", "~"] {
+            assert!(StageInfo::is_valid_prefix_name(name), "{name:?}");
+        }
+    }
+
+    #[test]
+    fn user_stage_with_invalid_name_is_rejected() {
+        // Rejected before touching the global DataOperator.
+        for name in ["", ".", "..", "../..", "alice/", "/"] {
+            let stage = StageInfo::new_user_stage(name);
+            assert!(internal_stage_storage_params(&stage).is_err(), "{name:?}");
+            assert!(init_stage_operator(&stage).is_err(), "{name:?}");
+        }
     }
 
     #[test]
```

**File**: `src/meta/app/src/principal/user_stage.rs` (modified, +6/-0)
```diff
@@ -502,6 +502,12 @@ impl StageInfo {
         self
     }
 
+    /// Whether `name` can be used as one directory component of a stage prefix,
+    /// e.g. a user name that backs the user stage `@~`.
+    pub fn is_valid_prefix_name(name: &str) -> bool {
+        !(name.is_empty() || name == "." || name == ".." || name.contains('/'))
+    }
+
     /// Get the prefix of stage.
     ///
     /// Use this function to get the prefix of this stage in the data operator.
```

**File**: `src/query/config/src/global.rs` (modified, +2/-0)
```diff
@@ -20,6 +20,7 @@ use databend_common_base::base::GlobalInstance;
 use databend_common_exception::Result;
 use databend_common_grpc::is_in_process_grpc_address;
 use databend_common_storage::EndpointUrlPolicyRegistry;
+use databend_common_storage::StorageSecurityRegistry;
 
 use crate::InnerConfig;
 
@@ -38,6 +39,7 @@ impl GlobalConfig {
             .cloned()
             .collect();
         EndpointUrlPolicyRegistry::init(endpoint_url_policy)?;
+        StorageSecurityRegistry::init(config.storage.allow_insecure);
         Ok(())
     }
 
```

**File**: `src/query/ee/src/data_sharing/storage.rs` (modified, +3/-0)
```diff
@@ -59,6 +59,9 @@ pub async fn resolve_share_storage_params(
     let connection_storage = databend_common_sql::binder::parse_storage_params_from_uri(
         &mut location,
         "when resolving data share connection",
+        databend_common_config::GlobalConfig::instance()
+            .storage
+            .allow_insecure,
     )
     .await?;
 
```

---

### Incident Patch 3: `b5eb22e2` (2026-11-24)
**Commit Message**: fix: semaphore: wait before retrying a failed acquisition (#21181)

* fix: semaphore: wait before retrying a failed acquisition

# Summary

`MetaStore::new_acquired_by_time` now waits before it retries a failed
attempt to acquire a semaphore: 100 ms after the first failure,
doubling with each failure in a row, up to 2 s. It retried at once, so
a queued query whose attempts kept failing wrote a permit entry and
deleted it in a tight loop.

# Details

Since meta servers v260629.9.0, only the leader serves watches. While
no node the client knows serves the watch, such as during a leader
election or when the client's endpoints do not list the leader, every
attempt fails as soon as it starts: the semaphore's watcher ends, and
the attempt deletes the permit entry it wrote. The query queues retried
at once, until the queue timeout.

An attempt that times out after `queries_queue_retry_timeout` is still
retried at once: it lasted the whole timeout.

A retried attempt still takes a new timestamp, so the query moves to
the back of the queue. Keeping the first timestamp would be unsafe:
`SemaphoreQueue` admits a waiting entry that sorts before the last
acquired one regardless of capacity. Aft

**File**: `src/meta/store/src/lib.rs` (modified, +8/-2)
```diff
@@ -147,6 +147,10 @@ impl MetaStore {
 
         let name = format!("Semaphore-{prefix}-{id}");
 
+        // A failed attempt is retried after this delay, doubled after each failure in a row: an
+        // attempt can fail as soon as it starts, such as while no meta node serves its watch.
+        let mut retry_delay = Duration::from_millis(100);
+
         let mut ith = 0;
         loop {
             ith += 1;
@@ -179,9 +183,11 @@ impl MetaStore {
                 Ok(permit) => return Ok(permit),
                 Err(err) => {
                     warn!(
-                        "{} attempt {} to acquire semaphore failed: {:?}; retry at once",
-                        name, ith, err
+                        "{} attempt {} to acquire semaphore failed: {:?}; retry in {:?}",
+                        name, ith, err, retry_delay
                     );
+                    tokio::time::sleep(retry_delay).await;
+                    retry_delay = (retry_delay * 2).min(Duration::from_secs(2));
                     continue;
                 }
             }
```

**File**: `src/meta/store/tests/it/main.rs` (modified, +1/-0)
```diff
@@ -13,3 +13,4 @@
 // limitations under the License.
 
 mod kv_api;
+mod semaphore;
```

**File**: `src/meta/store/tests/it/semaphore.rs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
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
+use std::time::Duration;
+use std::time::Instant;
+
+use databend_common_meta_store::MetaStore;
+use databend_meta::runtime_api::TokioRuntime;
+use databend_meta_client::kvapi::KVApi;
+use databend_meta_client::types::UpsertKV;
+use databend_meta_client::types::protobuf::WatchRequest;
+use futures::StreamExt;
+use tokio::time::timeout;
+
+/// While every attempt to acquire a semaphore fails as soon as it starts, `new_acquired_by_time`
+/// waits 100 ms, 200 ms, 400 ms and so on before the next attempt.
+#[tokio::test(flavor = "multi_thread")]
+async fn test_new_acquired_by_time_waits_before_retrying_a_failed_attempt() -> anyhow::Result<()> {
+    let store = MetaStore::new_local_testing::<TokioRuntime>().await;
+
+    // An entry that does not decode ends the semaphore's watch as soon as the watch reads it, so
+    // every attempt fails, as when no meta node serves the watch.
+    store
+        .upsert_kv(UpsertKV::update("sem/queue/0", b"not a permit entry"))
+        .await?;
+
+    let watch = WatchRequest::new("sem/queue/".to_string(), Some("sem/queue0".to_string()));
+    let mut watch = store.watch(watch).await?;
+
+    let start = Instant::now();
+    let acquire = store.new_acquired_by_time("sem", 1, "id", Duration::from_secs(10), None);
+
+    // Each attempt inserts its own permit entry, and deletes it when it fails.
+    let four_attempts = async {
+        let mut attempts = 0;
+        while attempts < 4 {
+            let resp = watch.next().await.expect("watch stream ended")?;
+            if let Some((_key, None, Some(_inserted))) = resp.unpack() {
+                attempts += 1;
+            }
+        }
+        anyhow::Ok(())
+    };
+
+    tokio::select! {
+        res = acquire => panic!("every attempt should fail: {res:?}"),
+        res = timeout(Duration::from_secs(10), four_attempts) => res??,
+    }
+
+    let elapsed = start.elapsed();
+    assert!(
+        elapsed >= Duration::from_millis(700),
+        "elapsed: {elapsed:?}"
+    );
+    Ok(())
+}
```

#### Recent Merged Pull Requests:
- **PR #21181** (2026-11-24): fix: semaphore: wait before retrying a failed acquisition (@drmingdrmer)
- **PR #21179** (2026-11-23): fix(meta): reject deduplication markers without durable updates (@drmingdrmer)
- **PR #21177** (2026-11-23): fix: locks: keep waiting when a table lock watch is refused (@drmingdrmer)
- **PR #21175** (2026-11-23): fix(meta): scope DML deduplication labels to tenants (@drmingdrmer)
- **PR #21173** (2026-11-23): fix(storage): validate external location options (@bohutang)
- **PR #21172** (2026-11-23): fix(query): tighten stage location checks (@sundy-li)

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

## X. locks: keep waiting when a table lock watch is refused

**RULE**:
When implementing operations in `src/query/config/src/config.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `08cac7de`: locks: keep waiting when a table lock watch is refused. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/config/src/config.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Deprecated, kept for backward compatibility: name `ownership` in `meta_service_caches`
    /// instead. When true, it enables [`MetaServiceCache::Ownership`] as that name does, and the
    /// node logs a warning at startup.

    /// The warning to log at startup when this config sets the deprecated
    /// `meta_service_ownership_cache`.
    pub fn deprecated_ownership_cache_warning(&self) -> Option<&'static str> {
        self.meta_service_ownership_cache.then_some(
            "`cache.meta_service_ownership_cache` is deprecated but still enables the ownership \
             cache; add `ownership` to `cache.meta_service_caches` instead",
        )
    }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// Deprecated: name `ownership` in `meta_service_caches` instead. When true, it enables
    /// [`MetaServiceCache::Ownership`] as that name does.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `08cac7de` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
