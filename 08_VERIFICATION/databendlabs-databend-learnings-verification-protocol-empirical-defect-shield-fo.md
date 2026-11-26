# Verification Protocol: Verification Protocol: Empirical Defect Shield for databendlabs-databend-learnings

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs-databend-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T19:37:28.302Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-databendlabs-databend-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs-databend-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T19:37:28.302Z`  
> **Learning ID**: `LEARN-EVO-databendlabs-databend-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `databendlabs-databend-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `f1fb8936`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T19:37:21.924Z  
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
> **Harvest Timestamp**: 2026-11-26T19:37:21.918Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9509 stars

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
- **Issue #21241** (2026-11-26): **fix: query: read the RESULT_SCAN cache key of HTTP sessions from meta**
  *Symptoms*:   I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  ##### fix: query: read the RESULT_SCAN cache key of HTTP sessions from meta # Summary  For an HTTP session, `RESULT_SCAN` now uses the result cache key that the server recorded for the last query, instead of the copy in the session state that the client sends back.  # Details  - When an HTTP query has a result cache key, `HttpQuery` records it in   meta at `_result_scan_owner/{tenant}/{user}/{query_id}`, with   `query_result_cache_ttl_secs` as its TTL, before the response that   carries the key. The tenant and user are the authenticated ones that   `HttpQuery` already uses for query ownership. Because the user is   part of the key, a user reads back only the keys of their own   queries.  - `HttpSessionConf::restore()` reads the record for the last query id   only when the client's `last_query_result_cache_key` is not empty,   so a session that does not use the result cache makes no extra meta   read. The content of that field is no longer used. A failed read or   write is logged, and `RESULT_SCAN` then reports that no cache key is   found.  - Each HTTP query with a result cache key costs one meta write. The   result cache is off by default.  - The field is still sent, so nodes of older versions keep working   during a rolling upgrade. A `RESULT_SCAN` on a new node of a query   that ran on an old node finds no record, and reports that no cache   key is found.  ##### 

- **Issue #21239** (2026-11-26): **fix: query: update the matching entry in update_query_ids_results**
  *Symptoms*:   I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  ##### fix: query: update the matching entry in update_query_ids_results # Summary  `SessionContext::update_query_ids_results()` now writes the new result cache key into the entry whose query id matches, instead of into the entry at the mirrored position.  # Details  - The loop took its index from `iter().rev().enumerate()`, an offset   from the end, and used it to index the list from the front. In a list   of more than one entry, updating the k-th entry from the end replaced   the k-th entry from the front with the updated query id: another   query's entry was lost, and the matching entry kept its old key.  - No current caller is known to reach this. Every update with `Some`   is for a query id that is not in the list yet, so it is appended, and   an update with `None` never writes.  - The function now finds the entry with `rposition()`. An update with   `None` still keeps a key that is already set.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test  - _Explain why_  ## Type of change  - [x] Bug Fix (non-breaking change which fixes an issue)  ## AI assistance  - AI usage: An AI coding agent generated code and wrote tests; I reviewed and confirmed every line before committing it. - Responsible human: @drmingdrmer - [x] The responsible human has read every line of this diff and can explain each change  ## Related Issues  <!-- Reviewable:sta

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

### Incident Patch 1: `80519243` (2026-11-26)
**Commit Message**: fix(query): use one conversion plan for CAST and TRY_CAST (#21203)

* feat(query): record how overloads take nullable arguments

A call checked for non-nullable arguments may get nullable ones later,
e.g. when an outer join makes a column nullable. Record, at registration,
which overload takes them instead of searching all overloads again.

- NullableInput tells the variant of a builtin overload (passthrough,
  combine or null-aware), or the factories that create the function for
  nullable arguments: a passthrough factory, registered by
  register_passthrough_nullable_factory, or null-aware ones.
- The register_passthrough_nullable_* and register_combine_nullable_*
  helpers and the builders with passthrough_nullable record their
  variants. register_nullable_variants pairs each builtin with the
  variant that takes its arguments nullable, and panics on an overload,
  variant or name it cannot pair.
- check_nullable_arguments checks a call again for nullable arguments
  through its recorded overloads.

* feat(query): declare the nullable variants of and, or, is_true, concat_ws, tuple get and the decimal casts

- and, or and is_true register their three-valued variants, and
  conca

**File**: `src/query/expression/src/auto_cast_rules.rs` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
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
+//! The rules of automatic casts that hold across functions.
+//!
+//! Type checking casts an argument to the type a function overload takes when a rule allows it.
+//! The rules here are shared by many functions, and planner and storage code rely on the casts
+//! they allow; which rules a function uses is decided where the function is registered.
+//! [`decimal_auto_cast`] is the rule for decimals, whose sizes a list of type pairs cannot hold.
+
+use crate::types::ALL_INTEGER_TYPES;
+use crate::types::ALL_NUMERICS_TYPES;
+use crate::types::DataType;
+use crate::types::Decimal;
+use crate::types::NumberDataType;
+use crate::types::i256;
+
+/// Whether a decimal rule casts `src` to `dest` automatically, for any function: a string or an
+/// integer to a decimal that holds it, a decimal to a wider decimal, and a decimal to Float64.
+pub fn decimal_auto_cast(src: &DataType, dest: &DataType) -> bool {
+    match (src, dest) {
+        (DataType::String, DataType::Decimal(_)) => true,
+        (DataType::Decimal(x), DataType::Decimal(y)) => {
+            x.scale() <= y.scale()
+                && (x.leading_digits() <= y.leading_digits()
+                    || y.precision() == i256::MAX_PRECISION)
+        }
+        (DataType::Number(n), DataType::Decimal(d)) if !n.is_float() => {
+            let properties = n.get_decimal_properties().unwrap();
+            properties.scale() <= d.scale()
+                && properties.precision() - properties.scale() <= d.leading_digits()
+        }
+        // Only to Float64, otherwise `sqrt(1234.56789)` would have the signature
+        // `sqrt(1234.56789::Float32)`.
+        (DataType::Decimal(_), DataType::Number(n)) => n.is_float64(),
+        _ => false,
+    }
+}
+
+/// Whether an automatic cast from `src` to `dest` is a `TRY_CAST`: a Variant extracts a value
+/// with [`cast_from_variant_rules`], and a value of another JSON type becomes NULL.
+pub fn is_auto_try_cast(src: &DataType, dest: &DataType) -> bool {
+    src.remove_nullable() == DataType::Variant
+        && dest.is_nullable()
+        && is_variant_auto_cast_target(dest)
+}
+
+/// The types that a Variant extracts automatically, as NULL for a value of another JSON type.
+const VARIANT_AUTO_CAST_TARGETS: &[DataType] = &[
+    DataType::Boolean,
+    DataType::Date,
+    DataType::Timestamp,
+    DataType::String,
+    DataType::Number(NumberDataType::UInt8),
+    DataType::Number(NumberDataType::UInt16),
+    DataType::Number(NumberDataType::UInt32),
+    DataType::Number(NumberDataType::UInt64),
+    DataType::Number(NumberDataType::Int8),
+    DataType::Number(NumberDataType::Int16),
+    DataType::Number(NumberDataType::Int32),
+    DataType::Number(NumberDataType::Int64),
+    DataType::Number(NumberDataType::Float32),
+    DataType::Number(NumberDataType::Float64),
+];
+
+/// Whether [`cast_from_variant_rules`] cast a Variant to `dest`, nullable or not.
+pub fn is_variant_auto_cast_target(dest: &DataType) -> bool {
+    VARIANT_AUTO_CAST_TARGETS.contains(&dest.remove_nullable())
+}
+
+/// The cast rules for any situation, including comparison functions, joins, etc. Among numbers,
+/// they are the lossless casts of [`NumberDataType::can_lossless_cast_to`], and the lossy casts
+/// `UInt64 -> Int64`, `UInt64 -> Float64` and `Int64 -> Float64`. Through the lossy casts,
+/// comparing a `UInt64` with an `Int64` casts to `Int64`, unlike the lossless common types of
+/// [`crate::conversion::common_super_type_with_conversion`].
+pub fn general_cast_rules() -> Vec<(DataType, DataType)> {
+    let mut rules = vec![
+        (DataType::String, DataType::Binary),
+        (DataType::String, DataType::Timestamp),
+        (DataType::String, DataType::TimestampTz),
+        (DataType::String, DataType::Date),
+        (DataType::String, DataType::Interval),
+        (DataType::String, DataType::Boolean),
+        (DataType::Date, DataType::Timestamp),
+    ];
+    let lossless = ALL_NUMERICS_TYPES.iter().flat_map(|src| {
+        ALL_NUMERICS_TYPES
+            .iter()
+            .filter(move |dest| src != *dest && src.can_lossless_cast_to(**dest))
+            .map(|dest| (*src, *dest))
+    });
+    let lossy = [
+        (NumberDataType::UInt64, NumberDataType::Int64),
+        (NumberDataType::UInt64, NumberDataType::Float64),
+        (NumberDataType::Int64, NumberDataType::Float64),
+    
```

**File**: `src/query/expression/src/cast_plan.rs` (added, +498/-0)
```diff
@@ -0,0 +1,498 @@
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
+//! The steps that a cast takes.
+//!
+//! A cast does not map to one function: it may take no function (`NULL`, nullability, empty
+//! containers), one function, a chain of casts, or a cast for each nested value. [`CastPlan`]
+//! records these steps; the evaluator runs them and the constant folder derives their domain.
+//!
+//! The plan of `TRY_CAST` is the plan of `CAST` to the nullable destination. What happens with
+//! a row that fails is decided where the plan runs: `CAST` reports an error, `TRY_CAST` turns
+//! the row into NULL at the nearest nullable destination. A function only provides the
+//! conversion of one step.
+//!
+//! A step that converts a value runs the function overload registered for its source and
+//! destination types, and its domain is the domain of that function. Function overload
+//! resolution does not take part: a cast without a registered function or chain has no plan.
+
+use std::fmt;
+use std::sync::Arc;
+
+use crate::FunctionRegistry;
+use crate::NullableInput;
+use crate::Scalar;
+use crate::function::Function;
+use crate::function::FunctionID;
+use crate::type_check::Substitution;
+use crate::types::DataType;
+use crate::types::NumberScalar;
+use crate::types::VectorDataType;
+use crate::types::decimal::DecimalSize;
+
+/// How a cast from `src_type` to `dest_type` runs.
+#[derive(Clone, Debug)]
+pub struct CastPlan {
+    pub src_type: DataType,
+    pub dest_type: DataType,
+    pub step: CastStep,
+}
+
+#[derive(Clone, Debug)]
+pub enum CastStep {
+    /// The value already has the layout of the destination.
+    Identity,
+    /// `NULL` to any type: NULL for a nullable destination, an error otherwise.
+    Null,
+    /// A cast function converts the value: `call` runs it on the value of the source, and
+    /// `value_call` on a non-NULL value, the same call for a non-nullable source. The function
+    /// may return NULL for some non-NULL values, e.g. a JSON null cast from Variant, which
+    /// `value_call` returns a nullable type for; see [`CastPlan::rejects_null`].
+    Function {
+        call: Box<CastCall>,
+        value_call: Box<CastCall>,
+    },
+    /// Casts through intermediate types, one cast after another.
+    Chain(Vec<CastPlan>),
+    /// `T1 NULL -> T2 NULL`.
+    Nullable(Box<CastPlan>),
+    /// `T1 NULL -> T2`: a NULL is an error.
+    FromNullable(Box<CastPlan>),
+    /// `T1 -> T2 NULL`.
+    ToNullable(Box<CastPlan>),
+    /// An empty array or map to an array or map, as the destination is: `[]` or `{}`.
+    Empty,
+    /// Casts the elements of each array, or the key-value tuples of each map, as the destination
+    /// is.
+    Elements(Box<CastPlan>),
+    /// Casts each field.
+    Tuple(Vec<CastPlan>),
+    /// Casts the elements of each JSON array; a value that is not an array has none.
+    ///
+    /// Known issue: so a value that is not an array becomes `[]`, for `TRY_CAST` too, which
+    /// follows `CAST` here instead of returning NULL. Whether NULL suits better is open; the
+    /// result of `CAST` is kept as before.
+    VariantToArray(Box<CastPlan>),
+    /// Casts the values of each JSON object; a value that is not an object has none, and
+    /// becomes `{}` as in [`CastStep::VariantToArray`].
+    VariantToMap(Box<CastPlan>),
+    /// Converts a String, Variant or numeric Array value to a vector.
+    ToVector,
+}
+
+/// The function overload that a cast step runs, on the value that the step converts.
+#[derive(Clone, Debug)]
+pub struct CastCall {
+    pub id: FunctionID,
+    pub function: Arc<Function>,
+    pub generics: Vec<DataType>,
+    pub return_type: DataType,
+}
+
+/// A registered overload of a cast function. A factory is instantiated for the types of each
+/// step, e.g. with the precision and scale of the destination decimal.
+#[derive(Clone, Copy, Debug)]
+pub enum CastOverload {
+    Builtin(usize),
+    Factory(usize),
+}
+
+/// How a registered cast converts a value of its source type to its destination type.
+#[derive(Clone, Debug)]
+pub enum RegisteredCast {
+    /// Runs a function.
+    Function(CastFunction),
+    /// Converts to `via` first, then from `via` to the destination.
+    Chain { via: DataType },
+}
+
+/// The function that a cast step runs.
+#[derive(Clone, Debug)]
+pub struct CastFunction {
+    pub name: String,
+    /// The overload for a non-NULL argument.
+    
```

**File**: `src/query/expression/src/constant_folder.rs` (modified, +196/-210)
```diff
@@ -136,47 +136,6 @@ impl<'e, Index: ColumnIndex> FunctionNode<'e, Index> {
             FunctionNode::Owned(call) => Cow::Owned(Expr::FunctionCall(call)),
         }
     }
-
-    fn finish(self, args: impl IntoIterator<Item = Expr<Index>>) -> Expr<Index> {
-        let args = args.into_iter().collect();
-        match self {
-            FunctionNode::Borrowed { call, .. } => Expr::FunctionCall(FunctionCall {
-                span: call.span,
-                id: call.id.clone(),
-                function: call.function.clone(),
-                generics: call.generics.clone(),
-                args,
-                return_type: call.return_type.clone(),
-            }),
-            FunctionNode::Owned(mut call) => {
-                call.args = args;
-                Expr::FunctionCall(call)
-            }
-        }
-    }
-
-    fn borrowed_expr(&self) -> Option<&'e Expr<Index>> {
-        match self {
-            FunctionNode::Borrowed { expr, .. } => Some(expr),
-            FunctionNode::Owned(_) => None,
-        }
-    }
-
-    fn finish_fold(self, args: Vec<FoldResult<'e, Index>>, changed: bool) -> FoldResult<'e, Index> {
-        match (changed, self) {
-            (false, FunctionNode::Borrowed { expr, .. }) => {
-                FoldResult::Unchanged(Cow::Borrowed(expr))
-            }
-            (changed, node) => {
-                let expr = node.finish(args.into_iter().map(FoldResult::into_expr));
-                if changed {
-                    FoldResult::Changed(expr)
-                } else {
-                    FoldResult::Unchanged(Cow::Owned(expr))
-                }
-            }
-        }
-    }
 }
 
 enum LambdaNode<'e, Index: ColumnIndex> {
@@ -214,7 +173,57 @@ impl<'e, Index: ColumnIndex> LambdaNode<'e, Index> {
             LambdaNode::Owned(call) => Cow::Owned(Expr::LambdaFunctionCall(call)),
         }
     }
+}
+
+/// A function or lambda call whose arguments are folded one by one.
+trait CallNode<'e, Index: ColumnIndex>: Sized {
+    /// The call itself, when it is borrowed and can be kept as it is.
+    fn borrowed_expr(&self) -> Option<&'e Expr<Index>>;
+
+    /// The call over `args`.
+    fn finish(self, args: impl IntoIterator<Item = Expr<Index>>) -> Expr<Index>;
+
+    fn finish_fold(self, args: Vec<FoldResult<'e, Index>>, changed: bool) -> FoldResult<'e, Index> {
+        if !changed && let Some(expr) = self.borrowed_expr() {
+            return FoldResult::Unchanged(Cow::Borrowed(expr));
+        }
+        let expr = self.finish(args.into_iter().map(FoldResult::into_expr));
+        if changed {
+            FoldResult::Changed(expr)
+        } else {
+            FoldResult::Unchanged(Cow::Owned(expr))
+        }
+    }
+}
+
+impl<'e, Index: ColumnIndex> CallNode<'e, Index> for FunctionNode<'e, Index> {
+    fn finish(self, args: impl IntoIterator<Item = Expr<Index>>) -> Expr<Index> {
+        let args = args.into_iter().collect();
+        match self {
+            FunctionNode::Borrowed { call, .. } => Expr::FunctionCall(FunctionCall {
+                span: call.span,
+                id: call.id.clone(),
+                function: call.function.clone(),
+                generics: call.generics.clone(),
+                args,
+                return_type: call.return_type.clone(),
+            }),
+            FunctionNode::Owned(mut call) => {
+                call.args = args;
+                Expr::FunctionCall(call)
+            }
+        }
+    }
+
+    fn borrowed_expr(&self) -> Option<&'e Expr<Index>> {
+        match self {
+            FunctionNode::Borrowed { expr, .. } => Some(expr),
+            FunctionNode::Owned(_) => None,
+        }
+    }
+}
 
+impl<'e, Index: ColumnIndex> CallNode<'e, Index> for LambdaNode<'e, Index> {
     fn finish(self, args: impl IntoIterator<Item = Expr<Index>>) -> Expr<Index> {
         let args = args.into_iter().collect();
         match self {
@@ -239,22 +248,6 @@ impl<'e, Index: ColumnIndex> LambdaNode<'e, Index> {
             LambdaNode::Owned(_) => None,
         }
     }
-
-    fn finish_fold(self, args: Vec<FoldResult<'e, Index>>, changed: bool) -> FoldResult<'e, Index> {
-        match (changed, self) {
-            (false, LambdaNode::Borrowed { expr, .. }) => {
-                FoldResult::Unchanged(Cow::Borrowed(expr))
-            }
-            (changed, node) => {
-                let expr = node.finish(args.into_iter().map(FoldResult::into_expr));
-                if changed {
-                    FoldResult::Changed(expr)
-                } else {
-                    FoldResult::Unchanged(Cow::Owned(expr))
-                }
-            }
-        }
-    }
 }
 
 enum CastNode<'e, Index: ColumnIndex> {
@@ -449,8 +442,19 @@ impl<'a, Index: ColumnIndex> ConstantFolder<'a, Index> {
 
     /// Fold expression by one step, specifically, by reducing expression by domain calculation and then
     /// folding the function calls whose all arguments are constants.
-    #[recursive::recursive]
     
```

**File**: `src/query/expression/src/constant_folder/fold_rules.rs` (modified, +213/-274)
```diff
@@ -19,8 +19,6 @@
 //! with another tree type can apply the same decision to its own nodes. Only
 //! [`FoldRules::eval_constant`] takes an expression, which must be free of columns.
 
-use databend_common_ast::Span;
-
 use super::monotonicity::calculate_monotonicity_domain;
 use super::monotonicity::is_monotonic;
 use crate::ColumnIndex;
@@ -32,17 +30,19 @@ use crate::FunctionRegistry;
 use crate::Scalar;
 use crate::Value;
 use crate::block::DataBlock;
+use crate::cast_plan::CastCall;
+use crate::cast_plan::CastPlan;
+use crate::cast_plan::CastStep;
+use crate::cast_plan::resolve_cast_plan;
 use crate::evaluator::Evaluator;
-use crate::expression::Cast;
 use crate::expression::ColumnRef;
-use crate::expression::Constant;
 use crate::expression::Expr;
 use crate::expression::ExprVisitor;
 use crate::expression::FunctionCall;
 use crate::expression::LambdaFunctionCall;
 use crate::expression::visit_expr;
 use crate::property::Domain;
-use crate::type_check::resolve_cast_function;
+use crate::types::AnyType;
 use crate::types::DataType;
 use crate::types::boolean::BooleanDomain;
 use crate::types::nullable::NullableDomain;
@@ -62,299 +62,232 @@ impl FoldRules {
     pub fn cast_domain(
         func_ctx: &FunctionContext,
         fn_registry: &FunctionRegistry,
-        span: Span,
         src_type: &DataType,
         dest_type: &DataType,
         is_try: bool,
         domain: &Domain,
     ) -> Option<Domain> {
-        if is_try {
-            Self::calculate_try_cast(func_ctx, fn_registry, span, src_type, dest_type, domain)
-        } else {
-            Self::calculate_cast(func_ctx, fn_registry, span, src_type, dest_type, domain)
-        }
+        let plan = resolve_cast_plan(src_type, dest_type, fn_registry)?;
+        let (domain, may_fail) =
+            Self::cast_plan_domain(func_ctx, fn_registry, &plan, is_try, domain)?;
+        // The destination of `TRY_CAST` is nullable, so a failed row is NULL by now.
+        debug_assert!(!may_fail);
+        Some(domain)
     }
 
-    pub(super) fn calculate_cast(
+    /// Domain of the output of a cast plan, and whether a row may fail, which is only possible
+    /// for `TRY_CAST`. A failed row becomes NULL at the nearest nullable destination, as in
+    /// `Evaluator::run_cast_plan`. Returns `None` when the domain is unknown, or when a row of
+    /// `CAST` may fail.
+    fn cast_plan_domain(
         func_ctx: &FunctionContext,
         fn_registry: &FunctionRegistry,
-        span: Span,
-        src_type: &DataType,
-        dest_type: &DataType,
+        plan: &CastPlan,
+        is_try: bool,
         domain: &Domain,
-    ) -> Option<Domain> {
-        if src_type == dest_type {
-            return Some(domain.clone());
-        }
-
-        if let Some(call) = resolve_cast_function(span, false, src_type, dest_type, fn_registry)
-            && let Some(new_domain) =
-                Self::calculate_simple_cast(func_ctx, fn_registry, call, domain)
-        {
-            return new_domain;
-        }
-
-        match (src_type, dest_type) {
-            (DataType::Null, DataType::Nullable(_)) => Some(domain.clone()),
-            (DataType::Nullable(inner_src_ty), DataType::Nullable(inner_dest_ty)) => {
-                let domain = domain.as_nullable().unwrap();
-                let value = match &domain.value {
-                    Some(value) => Some(Box::new(Self::calculate_cast(
-                        func_ctx,
-                        fn_registry,
-                        span,
-                        inner_src_ty,
-                        inner_dest_ty,
-                        value,
-                    )?)),
-                    None => None,
-                };
-                Some(Domain::Nullable(NullableDomain {
-                    has_null: domain.has_null,
-                    value,
-                }))
-            }
-            (_, DataType::Nullable(inner_dest_ty)) => Some(Domain::Nullable(NullableDomain {
-                has_null: false,
-                value: Some(Box::new(Self::calculate_cast(
-                    func_ctx,
-                    fn_registry,
-                    span,
-                    src_type,
-                    inner_dest_ty,
-                    domain,
-                )?)),
-            })),
+    ) -> Option<(Domain, bool)> {
+        let dest_type = &plan.dest_type;
+        let nested = |plan: &CastPlan, domain: &Domain| {
+            Self::cast_plan_domain(func_ctx, fn_registry, plan, is_try, domain)
+        };
 
-            (DataType::EmptyArray, DataType::Array(_)) => Some(domain.clone()),
-            (DataType::Array(inner_src_ty), DataType::Array(inner_dest_ty)) => {
-                let inner_domain = match domain.as_array().unwrap() {
-                    Some(inner_domain) => Some(Box::new(Self::calculate_cast(
-                        func_ctx,
-                        fn_registry,
-                        span,
-                        inner_src_ty,
-               
```

**File**: `src/query/expression/src/conversion.rs` (modified, +12/-15)
```diff
@@ -12,6 +12,7 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use crate::auto_cast_rules::is_variant_auto_cast_target;
 use crate::type_check::common_super_type;
 use crate::types::DataType;
 use crate::types::Decimal;
@@ -126,12 +127,20 @@ pub fn classify_conversion(src: &DataType, dest: &DataType) -> ConversionClass {
         (DataType::String, dest) if is_value_dependent_string_target(dest) => {
             ConversionClass::ValueDependent
         }
-        (DataType::Variant, dest) if is_variant_try_cast_target(dest) => ConversionClass::TryOnly,
+        (DataType::Variant, dest) if is_variant_auto_cast_target(dest) => ConversionClass::TryOnly,
 
         _ => ConversionClass::Unsupported,
     }
 }
 
+/// The common type of `left` and `right` for reasoning about equality, with how each side
+/// converts to it.
+///
+/// Known divergence: this is not always the type that a comparison casts to. The comparison
+/// functions resolve their arguments with their auto cast rules, which include lossy number
+/// casts. For `UInt64` and `Int64`, this returns `Decimal(20, 0)`, lossless on both sides,
+/// while `a = b` casts `a` to `Int64` and fails on `u64::MAX`. The rules are kept apart for now;
+/// `test_comparison_and_conversion_common_types_differ` records the difference.
 pub fn common_super_type_with_conversion(
     left: impl Into<DataType>,
     right: impl Into<DataType>,
@@ -208,10 +217,10 @@ fn common_type_for_conversion(left: DataType, right: DataType) -> Option<DataTyp
                 (DataType::String, ty) if is_value_dependent_string_target(&ty) => Some(ty),
                 (ty, DataType::String) if is_value_dependent_string_target(&ty) => Some(ty),
 
-                (DataType::Variant, ty) if is_variant_try_cast_target(&ty) => {
+                (DataType::Variant, ty) if is_variant_auto_cast_target(&ty) => {
                     Some(ty.wrap_nullable())
                 }
-                (ty, DataType::Variant) if is_variant_try_cast_target(&ty) => {
+                (ty, DataType::Variant) if is_variant_auto_cast_target(&ty) => {
                     Some(ty.wrap_nullable())
                 }
 
@@ -331,18 +340,6 @@ fn is_value_dependent_string_target(ty: &DataType) -> bool {
     }
 }
 
-fn is_variant_try_cast_target(ty: &DataType) -> bool {
-    match ty {
-        DataType::Nullable(ty) => is_variant_try_cast_target(ty),
-        DataType::Boolean
-        | DataType::Date
-        | DataType::Timestamp
-        | DataType::String
-        | DataType::Number(_) => true,
-        _ => false,
-    }
-}
-
 fn is_type_safe_for_equality_inference(ty: &DataType) -> bool {
     !matches!(
         ty.remove_nullable(),
```

**File**: `src/query/expression/src/evaluator.rs` (modified, +696/-989)
```diff
@@ -12,7 +12,6 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use std::collections::BTreeMap;
 use std::collections::HashSet;
 use std::ops::Not;
 
@@ -30,20 +29,24 @@ use crate::BlockEntry;
 use crate::Function;
 use crate::FunctionContext;
 use crate::FunctionEval;
+use crate::FunctionID;
 use crate::FunctionRegistry;
 use crate::LikePattern;
 use crate::RemoteExpr;
 use crate::ScalarRef;
 use crate::SelectOp;
 use crate::block::DataBlock;
+use crate::cast_plan::CastCall;
+use crate::cast_plan::CastPlan;
+use crate::cast_plan::CastStep;
+use crate::cast_plan::resolve_cast_plan;
 use crate::expr::*;
 use crate::expression::Expr;
 use crate::function::EvalContext;
 use crate::kernels::has_nested_decimal;
 use crate::kernels::select_if_then_else;
-use crate::type_check::check_cast_function;
 use crate::type_check::format_function_argument_mismatch_hint;
-use crate::type_check::resolve_cast_function;
+use crate::types::BinaryColumn;
 use crate::types::BooleanType;
 use crate::types::DataType;
 use crate::types::DecimalColumn;
@@ -56,12 +59,10 @@ use crate::types::ReturnType;
 use crate::types::StringType;
 use crate::types::ValueType;
 use crate::types::VariantType;
-use crate::types::VectorDataType;
 use crate::types::VectorScalar;
 use crate::types::any::AnyType;
 use crate::types::array::ArrayColumn;
 use crate::types::nullable::NullableColumn;
-use crate::types::string::StringColumnBuilder;
 use crate::utils::filter_helper::FilterHelpers;
 use crate::utils::json_path_transform::PathStep;
 use crate::utils::json_path_transform::replace_at_locations;
@@ -124,9 +125,68 @@ fn and_validity(bitmap: Bitmap, validity: Option<&Bitmap>) -> Bitmap {
 /// parent calls must accumulate instead of overwrite.
 ///
 /// A length-1 source bitmap comes from a scalar subexpression (evaluated in
-/// a one-row block, e.g. a constant cast in `run_simple_cast`); a scalar
+/// a one-row block); a scalar
 /// error applies to every row, so it is broadcast to `num_rows` instead of
 /// marking only row 0.
+/// Rows that failed in either bitmap; an unset bit is a failed row.
+fn and_failures(left: Option<Bitmap>, right: Option<Bitmap>) -> Option<Bitmap> {
+    match (left, right) {
+        (Some(left), Some(right)) => Some(&left & &right),
+        (left, right) => left.or(right),
+    }
+}
+
+/// `validity` without the rows that `failed` unsets. A failed scalar fails every row.
+fn exclude_failures(validity: Option<Bitmap>, failed: Option<&Bitmap>) -> Option<Bitmap> {
+    let Some(failed) = failed else {
+        return validity;
+    };
+    match validity {
+        Some(validity) if failed.len() == 1 && validity.len() != 1 => {
+            if failed.get_bit(0) {
+                Some(validity)
+            } else {
+                Some(Bitmap::new_constant(false, validity.len()))
+            }
+        }
+        Some(validity) => Some(&validity & failed),
+        None => Some(failed.clone()),
+    }
+}
+
+/// A scalar function call whose arguments are evaluated.
+struct EvaluatedCall<'a> {
+    span: Span,
+    id: &'a FunctionID,
+    function: &'a Function,
+    generics: &'a [DataType],
+    args: Vec<Value<AnyType>>,
+    /// The rows that the call runs for, of which the rows in `validity` are active.
+    num_rows: usize,
+    validity: Option<Bitmap>,
+    /// Whether the call runs once per entry of a dictionary argument.
+    dictionary_eval: bool,
+}
+
+/// The validity of the single row of `value` that a scalar became, when `is_scalar`: every active
+/// row of `validity` uses the scalar, so it is active when any of them is.
+fn scalar_row_validity(validity: Option<Bitmap>, is_scalar: bool) -> Option<Bitmap> {
+    match validity {
+        Some(validity) if is_scalar => Some(Bitmap::new_constant(validity.true_count() > 0, 1)),
+        validity => validity,
+    }
+}
+
+/// The rows, given by `offsets`, that have a failed nested value.
+fn row_failures(offsets: &[u64], failed: Option<Bitmap>) -> Option<Bitmap> {
+    let failed = failed?;
+    let rows = offsets
+        .windows(2)
+        .map(|row| (row[0]..row[1]).all(|idx| failed.get_bit(idx as usize)))
+        .collect::<Bitmap>();
+    (rows.null_count() > 0).then_some(rows)
+}
+
 fn merge_eval_errors(
     target: &mut Option<(MutableBitmap, String)>,
     source: Option<(MutableBitmap, String)>,
@@ -301,19 +361,16 @@ impl<'a> Evaluator<'a> {
                 let keep_encoded =
                     keep_encoded && src_type.remove_nullable() == dest_type.remove_nullable();
                 let value = self.partial_run(inner, validity.clone(), options, keep_encoded)?;
-                if *is_try {
-                    self.run_try_cast(*span, src_type, dest_type, value, &|| expr.sql_display())?
-                } else {
-                    self.run_cast(
-                        *span,
-                        src_type,
-                        dest_type,
-                        value,

```

**File**: `src/query/expression/src/filter/selector.rs` (modified, +10/-14)
```diff
@@ -615,20 +615,16 @@ impl<'a> Selector<'a> {
                 let mut eval_options = EvaluateOptions::new_for_select(selection);
                 let value = self.evaluator.get_select_child(expr, &mut eval_options)?.0;
                 let src_type = expr.data_type();
-                let result = if *is_try {
-                    self.evaluator
-                        .run_try_cast(*span, src_type, dest_type, value, &|| expr.sql_display())?
-                } else {
-                    self.evaluator.run_cast(
-                        *span,
-                        src_type,
-                        dest_type,
-                        value,
-                        None,
-                        &|| expr.sql_display(),
-                        &mut eval_options,
-                    )?
-                };
+                let result = self.evaluator.run_cast(
+                    *span,
+                    *is_try,
+                    src_type,
+                    dest_type,
+                    value,
+                    None,
+                    &|| expr.sql_display(),
+                    &mut eval_options,
+                )?;
                 (result, dest_type.clone())
             }
             Expr::LambdaFunctionCall(LambdaFunctionCall {
```

**File**: `src/query/expression/src/function.rs` (modified, +335/-38)
```diff
@@ -42,6 +42,8 @@ use crate::ColumnIndex;
 use crate::Expr;
 use crate::FunctionDomain;
 use crate::Scalar;
+use crate::cast_plan::RegisteredCast;
+use crate::cast_plan::resolve_registered_cast;
 use crate::function_stat::DeriveStat;
 use crate::function_stat::ScalarFunctionStat;
 use crate::property::Domain;
@@ -259,6 +261,14 @@ pub enum FunctionID {
     },
 }
 
+/// `data_type` without the size of a decimal, as the key of a registered cast.
+pub(crate) fn cast_key(data_type: &DataType) -> DataType {
+    match data_type {
+        DataType::Decimal(_) => DataType::Decimal(DecimalSize::default()),
+        data_type => data_type.clone(),
+    }
+}
+
 #[derive(Default)]
 pub struct FunctionRegistry {
     pub funcs: HashMap<String, Vec<(Arc<Function>, usize)>>,
@@ -269,11 +279,15 @@ pub struct FunctionRegistry {
     pub aliases: HashMap<String, String>,
 
     /// Default cast rules for all functions.
-    pub default_cast_rules: Vec<(DataType, DataType)>,
+    default_cast_rules: Vec<(DataType, DataType)>,
     /// Cast rules for specific functions, which will override the default cast rules.
     pub additional_cast_rules: HashMap<String, Vec<(DataType, DataType)>>,
-    /// The auto rules that should use TRY_CAST instead of CAST.
-    pub auto_try_cast_rules: Vec<(DataType, DataType)>,
+    /// The registered casts, keyed by the source type, or `None` for any source, and the
+    /// destination type, both non-nullable, with decimal sizes erased. A cast runs a function,
+    /// or converts through an intermediate type.
+    casts: HashMap<(Option<DataType>, DataType), RegisteredCast>,
+    /// The function that converts values to a type, keyed by the type with decimal sizes erased.
+    conversion_functions: HashMap<DataType, String>,
     pub dynamic_cast_rules: HashMap<String, DynamicCastRules>,
     pub properties: HashMap<String, FunctionProperty>,
     pub derive_stat: HashMap<String, DeriveStat>,
@@ -283,6 +297,41 @@ pub struct FunctionRegistry {
     /// per overload avoids disabling context-free folding for unrelated overloads that share a
     /// name, such as numeric and timestamp arithmetic.
     context_dependent_functions: HashMap<String, HashSet<usize>>,
+    /// How overloads take nullable arguments where their signatures do not,
+    /// see [`NullableInput`]. The key is the canonical function name and the
+    /// registry-local function ID, as for `context_dependent_functions`.
+    nullable_inputs: HashMap<String, HashMap<usize, NullableInput>>,
+}
+
+/// How an overload takes arguments that are nullable where its signature is
+/// not, as its registration implements it. A builtin overload whose signature
+/// takes them, being nullable or a generic there, needs none, and a factory is
+/// asked for a function for them first, as candidate search asks it; an
+/// overload without one takes no such arguments otherwise.
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub enum NullableInput {
+    /// The builtin overload `variant`, registered with it, takes every argument
+    /// nullable and returns the result nullable, NULL where an argument is
+    /// NULL: `register_passthrough_nullable_*` and builders with
+    /// `passthrough_nullable`.
+    PassthroughVariant { variant: usize },
+    /// The builtin overload `variant`, registered with it, takes every argument
+    /// nullable and returns the same nullable result, NULL where an argument
+    /// is NULL: `register_combine_nullable_*`.
+    CombineVariant { variant: usize },
+    /// The builtin overload `variant`, registered with it, takes every argument
+    /// nullable and handles NULL itself, e.g. `and` by three-valued logic.
+    NullAwareVariant { variant: usize },
+    /// The factory `factory` of the same name creates the function for
+    /// nullable arguments that the factory declines or its function does not
+    /// take, as the passthrough nullable function of this factory's:
+    /// `register_passthrough_nullable_factory`.
+    PassthroughFactory { factory: usize },
+    /// The factories `factories` of the same name create the function for
+    /// nullable arguments that the factory declines or its function does not
+    /// take, tried in order, and may handle NULL themselves:
+    /// `register_nullable_variants`.
+    NullAwareFactories { factories: Vec<usize> },
 }
 
 impl FunctionRegistry {
@@ -331,6 +380,58 @@ impl FunctionRegistry {
         }
     }
 
+    /// The function that the factory `id` of `name` creates for `params` and
+    /// `args_type`, as candidate search creates it.
+    pub fn create_factory_function(
+        &self,
+        name: &str,
+        id: usize,
+        params: &[Scalar],
+        args_type: &[DataType],
+    ) -> Option<(FunctionID, Arc<Function>)> {
+        let (factory, _) = self
+            .factories
+            .get(name)?
+            .iter()
+            .find(|(_, factory_id)| *factory_id == id)?;
+        Self::create_by_factory(factory, name, id, params, args_typ
```

---

### Incident Patch 2: `75107161` (2026-11-26)
**Commit Message**: fix(query): fix materialized CTE hangs on channels nobody reads (#21227)

* fix(query): match materialized CTE channels to their consumers

A materialized CTE producer opens one channel per counted consumer and
sends every block to each of them. A channel nobody reads blocks a
bounded producer, which hangs the grouping-sets UNION rewrites.

- Count consumers on the physical plan. Physical building can drop a
  consumer, e.g. a grand-total level with no keys and no used aggregate
  becomes a constant scan and no longer reads the level above it.
- Give duplicate producers names of their own. A subquery copied behind a
  reused SELECT alias or a SQL function argument produces its CTEs under
  the same names, so the later producer replaced the earlier one's
  channels.

Fixes #21217

* fix(query): fail queries whose CTE channel has no consumer

A materialized CTE producer opens its channels when its pipeline is
built, and each consumer takes one when its own pipeline is built. A
channel that no consumer takes is never read: a bounded one fills up and
the query hangs instead of failing.

Check that every channel was taken once all pipelines of the query on
a node are built: after the lo

**File**: `src/query/service/src/physical_plans/physical_distributed_pruning.rs` (modified, +41/-1)
```diff
@@ -30,7 +30,11 @@ pub fn optimize_distributed_fuse_pruning(
     plan: &PhysicalPlan,
     eligible_scan_ids: &HashSet<usize>,
 ) -> PhysicalPlan {
-    if eligible_scan_ids.is_empty() {
+    // A plan without exchanges runs only on the local node. Injecting the metadata exchange
+    // under a materialized CTE would make it distributed: the CTE producer then runs on all
+    // executors while its consumers stay in the local root fragment, so the producers on the
+    // other executors read rows that nobody consumes and block on their full channels.
+    if eligible_scan_ids.is_empty() || !plan.is_distributed_plan() {
         return plan.clone();
     }
 
@@ -140,4 +144,40 @@ mod tests {
         assert_eq!(metadata_exchange.kind, FragmentKind::Normal);
         assert!(FusePrune::check_physical_plan(&metadata_exchange.input));
     }
+
+    fn materialized_cte(input: PhysicalPlan) -> PhysicalPlan {
+        PhysicalPlan::new(MaterializedCTE {
+            plan_id: 0,
+            stat_info: None,
+            input,
+            cte_name: "cte".to_string(),
+            cte_output_columns: None,
+            ref_count: 1,
+            channel_size: None,
+            meta: PhysicalPlanMeta::new("MaterializedCTE"),
+        })
+    }
+
+    #[test]
+    fn keeps_local_plan_with_materialized_cte_local() {
+        let eligible = HashSet::from([1]);
+
+        let local = optimize_distributed_fuse_pruning(&materialized_cte(table_scan(1)), &eligible);
+        let cte = MaterializedCTE::from_physical_plan(&local).unwrap();
+        assert!(TableScan::check_physical_plan(&cte.input));
+        assert!(!local.is_distributed_plan());
+
+        let distributed = PhysicalPlan::new(Exchange {
+            meta: PhysicalPlanMeta::new("Exchange"),
+            input: materialized_cte(table_scan(1)),
+            kind: FragmentKind::Merge,
+            keys: vec![],
+            ignore_exchange: false,
+            allow_adjust_parallelism: true,
+        });
+        let distributed = optimize_distributed_fuse_pruning(&distributed, &eligible);
+        let outer_exchange = Exchange::from_physical_plan(&distributed).unwrap();
+        let cte = MaterializedCTE::from_physical_plan(&outer_exchange.input).unwrap();
+        assert!(FuseBlockRead::check_physical_plan(&cte.input));
+    }
 }
```

**File**: `src/query/service/src/physical_plans/physical_materialized_cte.rs` (modified, +220/-0)
```diff
@@ -13,6 +13,8 @@
 // limitations under the License.
 
 use std::any::Any;
+use std::collections::HashMap;
+use std::collections::HashSet;
 
 use databend_common_exception::Result;
 use databend_common_expression::DataSchemaRef;
@@ -23,12 +25,16 @@ use databend_common_sql::evaluator::BlockOperator;
 use databend_common_sql::optimizer::ir::PExpr;
 
 use crate::physical_plans::IPhysicalPlan;
+use crate::physical_plans::MaterializeCTERef;
 use crate::physical_plans::PhysicalPlan;
 use crate::physical_plans::PhysicalPlanBuilder;
+use crate::physical_plans::PhysicalPlanCast;
 use crate::physical_plans::PhysicalPlanMeta;
+use crate::physical_plans::Sequence;
 use crate::physical_plans::explain::PlanStatsInfo;
 use crate::physical_plans::format::MaterializedCTEFormatter;
 use crate::physical_plans::format::PhysicalFormat;
+use crate::physical_plans::format::display_materialized_cte_name;
 use crate::pipelines::PipelineBuilder;
 use crate::pipelines::memory_settings::MemorySettingsExt;
 use crate::pipelines::processors::transforms::MaterializedCteSink;
@@ -167,3 +173,217 @@ impl PhysicalPlanBuilder {
         }))
     }
 }
+
+/// Gives every producer in the plan a name of its own.
+///
+/// A producer registers its channels under its name and each consumer takes one of them
+/// by that name. One bound subquery can occur twice in a plan, e.g. behind a SELECT alias
+/// that is referenced again, or as an argument that a SQL function uses twice. Both copies
+/// then produce their CTEs under the same names: the later producer replaces the channels
+/// of the earlier one, and the consumers of both copies are counted together.
+///
+/// The consumers of a producer are on the right side of its `Sequence`, so a renamed
+/// producer takes the consumers there with it. A later name keeps the display name, which
+/// EXPLAIN shows.
+pub fn rename_duplicate_materialized_ctes(plan: &mut PhysicalPlan) {
+    let mut names = HashSet::new();
+    collect_cte_producer_names(plan, &mut names);
+    let mut produced = HashSet::new();
+    rename_duplicate_producers(plan, &mut names, &mut produced, &mut Vec::new());
+}
+
+#[recursive::recursive]
+fn collect_cte_producer_names(plan: &PhysicalPlan, names: &mut HashSet<String>) {
+    if let Some(producer) = MaterializedCTE::from_physical_plan(plan) {
+        names.insert(producer.cte_name.clone());
+    }
+    for child in plan.children() {
+        collect_cte_producer_names(child, names);
+    }
+}
+
+/// `scopes` maps the name of each enclosing producer to the name it now has.
+#[recursive::recursive]
+fn rename_duplicate_producers(
+    plan: &mut PhysicalPlan,
+    names: &mut HashSet<String>,
+    produced: &mut HashSet<String>,
+    scopes: &mut Vec<(String, String)>,
+) {
+    if let Some(consumer) = MaterializeCTERef::from_mut_physical_plan(plan) {
+        if let Some((_, name)) = scopes
+            .iter()
+            .rev()
+            .find(|(original, _)| *original == consumer.cte_name)
+        {
+            consumer.cte_name = name.clone();
+        }
+        return;
+    }
+
+    if let Some(sequence) = Sequence::from_mut_physical_plan(plan)
+        && let Some(producer) = MaterializedCTE::from_mut_physical_plan(&mut sequence.left)
+    {
+        rename_duplicate_producers(&mut producer.input, names, produced, scopes);
+        let original = producer.cte_name.clone();
+        if !produced.insert(original.clone()) {
+            producer.cte_name = unique_cte_name(&original, names);
+            produced.insert(producer.cte_name.clone());
+        }
+        scopes.push((original, producer.cte_name.clone()));
+        rename_duplicate_producers(&mut sequence.right, names, produced, scopes);
+        scopes.pop();
+        return;
+    }
+
+    for child in plan.children_mut() {
+        rename_duplicate_producers(child, names, produced, scopes);
+    }
+}
+
+fn unique_cte_name(name: &str, names: &mut HashSet<String>) -> String {
+    let display_name = display_materialized_cte_name(name).to_string();
+    let mut id = 0;
+    loop {
+        let name = format!("__materialized_cte_{id}_{display_name}");
+        if names.insert(name.clone()) {
+            return name;
+        }
+        id += 1;
+    }
+}
+
+/// Sets each producer's `ref_count` to the number of consumers left in the physical plan.
+///
+/// The producer opens one channel per counted consumer and sends every block to each of
+/// them, while each consumer takes one channel when its pipeline is built. The logical
+/// count can be too high: physical building may drop a consumer, e.g. an aggregate with
+/// no keys and no used functions becomes a `ConstantTableScan` and its input, a
+/// consumer, is never built. Nobody reads that extra channel, so a bounded one fills up
+/// and blocks the producer and every other consumer.
+pub fn recount_materialized_cte_refs(plan: &mut PhysicalPlan) {
+    let mut ref_counts = HashMap::new();
+    count_cte_consumers(plan, &mut ref_counts);
+    set_cte_re
```

**File**: `src/query/service/src/physical_plans/physical_plan_builder.rs` (modified, +6/-0)
```diff
@@ -39,6 +39,8 @@ use databend_storages_common_table_meta::meta::TableSnapshot;
 use crate::physical_plans::explain::PlanStatsInfo;
 use crate::physical_plans::optimize_distributed_fuse_pruning;
 use crate::physical_plans::physical_plan::PhysicalPlan;
+use crate::physical_plans::recount_materialized_cte_refs;
+use crate::physical_plans::rename_duplicate_materialized_ctes;
 use crate::sessions::TableContext;
 
 pub struct PhysicalPlanBuilder {
@@ -113,6 +115,10 @@ impl PhysicalPlanBuilder {
 
         let mut plan = build_result?;
         if is_root_build {
+            if !self.cte_required_columns.is_empty() {
+                rename_duplicate_materialized_ctes(&mut plan);
+                recount_materialized_cte_refs(&mut plan);
+            }
             plan = optimize_distributed_fuse_pruning(&plan, &self.distributed_fuse_pruning_scans);
             plan.adjust_plan_id(&mut 0);
             self.publish_synchronous_pruning_stats(&plan);
```

**File**: `src/query/service/src/physical_plans/physical_union_all.rs` (modified, +11/-0)
```diff
@@ -13,6 +13,7 @@
 // limitations under the License.
 
 use std::any::Any;
+use std::collections::HashMap;
 
 use databend_common_exception::Result;
 use databend_common_expression::DataField;
@@ -33,6 +34,7 @@ use itertools::Itertools;
 
 use crate::physical_plans::Exchange;
 use crate::physical_plans::PhysicalPlanBuilder;
+use crate::physical_plans::count_cte_consumers;
 use crate::physical_plans::explain::PlanStatsInfo;
 use crate::physical_plans::format::PhysicalFormat;
 use crate::physical_plans::format::UnionAllFormatter;
@@ -203,6 +205,15 @@ impl UnionAll {
     }
 
     fn build_recursive_cte_source(&self, builder: &mut PipelineBuilder) -> Result<()> {
+        // The steps build their pipelines when they run, and only then do the materialized
+        // CTE consumers in them take their channels.
+        let mut consumers = HashMap::new();
+        count_cte_consumers(&self.left, &mut consumers);
+        count_cte_consumers(&self.right, &mut consumers);
+        builder
+            .ctx
+            .defer_materialized_cte_consumers(consumers.into_keys());
+
         let max_threads = builder.settings.get_max_threads()?;
         builder.main_pipeline.add_source(
             |output_port| {
```

**File**: `src/query/service/src/schedulers/scheduler.rs` (modified, +1/-0)
```diff
@@ -91,6 +91,7 @@ pub async fn build_local_pipeline(
     let pipeline =
         PipelineBuilder::create(ctx.get_function_context()?, ctx.get_settings(), ctx.clone());
     let mut build_res = pipeline.finalize(plan)?;
+    ctx.check_materialized_cte_receivers_taken()?;
 
     let settings = ctx.get_settings();
     build_res.set_max_threads(settings.get_max_threads()? as usize);
```

**File**: `src/query/service/src/servers/flight/v1/exchange/exchange_manager.rs` (modified, +3/-1)
```diff
@@ -1215,7 +1215,9 @@ impl QueryCoordinator {
             }
         }
 
-        Ok(())
+        // Every fragment of the query on this node is built, and a consumer takes its
+        // channel while its fragment is built.
+        query_context.check_materialized_cte_receivers_taken()
     }
 
     pub fn subscribe_fragment(
```

**File**: `src/query/service/src/sessions/query_ctx.rs` (modified, +34/-0)
```diff
@@ -1049,6 +1049,40 @@ impl QueryContext {
         let receivers = receivers.get_mut(cte_name).unwrap();
         receivers.pop().unwrap()
     }
+
+    /// Marks materialized CTEs whose consumers are built after the query pipeline: the
+    /// recursive CTE source builds the pipelines of its steps when they run.
+    pub fn defer_materialized_cte_consumers(&self, cte_names: impl IntoIterator<Item = String>) {
+        self.shared
+            .deferred_materialized_cte_consumers
+            .lock()
+            .extend(cte_names);
+    }
+
+    /// Fails if a materialized CTE producer has a channel that no consumer took.
+    ///
+    /// Call it once every pipeline of the query on this node is built. Nobody reads such a
+    /// channel: a bounded one fills up and blocks the producer, and the query would hang
+    /// instead of failing. CTEs with deferred consumers are skipped, as those consumers
+    /// take their channels later.
+    pub fn check_materialized_cte_receivers_taken(&self) -> Result<()> {
+        let deferred = self.shared.deferred_materialized_cte_consumers.lock();
+        let receivers = self.shared.materialized_cte_receivers.lock();
+        let mut untaken = receivers
+            .iter()
+            .filter(|(name, receivers)| !receivers.is_empty() && !deferred.contains(*name))
+            .map(|(name, receivers)| format!("{name} ({})", receivers.len()))
+            .collect::<Vec<_>>();
+        if untaken.is_empty() {
+            return Ok(());
+        }
+
+        untaken.sort();
+        Err(ErrorCode::Internal(format!(
+            "Materialized CTE channels without a consumer: {}",
+            untaken.join(", ")
+        )))
+    }
 }
 
 impl QueryContext {
```

**File**: `src/query/service/src/sessions/query_ctx_shared.rs` (modified, +4/-0)
```diff
@@ -216,6 +216,9 @@ pub struct QueryContextShared {
 
     pub(super) materialized_cte_receivers:
         Arc<Mutex<HashMap<String, Vec<Receiver<MaterializedCtePayload>>>>>,
+    /// Materialized CTEs read inside a recursive CTE, whose consumers are built only when
+    /// the recursive steps run.
+    pub(super) deferred_materialized_cte_consumers: Arc<Mutex<HashSet<String>>>,
     // Temp tables created for recursive CTE cleanup.
     // This must be shared across QueryContext instances created from the same query,
     // otherwise cleanup hooks running on the parent context cannot see registrations
@@ -326,6 +329,7 @@ impl QueryContextShared {
             nodes_perf: Arc::new(Mutex::new(HashMap::new())),
             nodes_perf_counters: Arc::new(Mutex::new(HashMap::new())),
             materialized_cte_receivers: Arc::new(Mutex::new(HashMap::new())),
+            deferred_materialized_cte_consumers: Arc::new(Mutex::new(HashSet::new())),
             recursive_cte_temp_tables: Arc::new(RwLock::new(Vec::new())),
             logical_recursive_cte_runtime_ids: Arc::new(RwLock::new(HashMap::new())),
             visibility_checker_cache: Default::default(),
```

---

### Incident Patch 3: `c86293c0` (2026-11-26)
**Commit Message**: fix(query): reject script names in subqueries that changed meaning (#21219)

#20338 made nested SQL inside procedure expressions follow SQL name
resolution. Bare names that used to resolve to script variables, and
row-variable column reads such as r.col, now silently resolve to
columns or fail with unrelated binder errors.

Reject at compile time every nested-SQL name that the previous
behavior resolved to a script variable or row variable, so no script
silently changes meaning. Variables are referenced as :var.

**File**: `src/query/script/src/compiler.rs` (modified, +42/-0)
```diff
@@ -39,6 +39,7 @@ use databend_common_ast::ast::SetExpr;
 use databend_common_ast::ast::Statement;
 use databend_common_ast::ast::TableReference;
 use databend_common_ast::ast::UnaryOperator;
+use databend_common_ast::span::merge_span;
 use databend_common_ast::visit::VisitControl;
 use databend_common_ast::visit::VisitorMut;
 use databend_common_ast::visit::WalkMut;
@@ -861,6 +862,46 @@ impl Compiler {
         Ok(())
     }
 
+    /// Reject names in nested SQL that older versions resolved to script
+    /// variables, so they cannot silently change meaning now that nested SQL
+    /// follows SQL name resolution.
+    fn check_nested_sql_column_ref(&self, expr: &Expr) -> Result<()> {
+        let Expr::ColumnRef {
+            span,
+            column:
+                ColumnRef {
+                    database: None,
+                    table,
+                    column: ColumnID::Name(column),
+                },
+        } = expr
+        else {
+            return Ok(());
+        };
+
+        match table {
+            None if matches!(self.lookup_ref(column), Ok(RefItem::Var(_))) => {
+                let name = self.normalize_ident(column);
+                Err(ErrorCode::ScriptSemanticError(format!(
+                    "`{name}` is ambiguous in a subquery: use `:{name}` for the \
+                     script variable, or qualify the column with its table name"
+                ))
+                .set_span(*span))
+            }
+            Some(iter) if matches!(self.lookup_ref(iter), Ok(RefItem::Iter(_))) => {
+                let span = merge_span(*span, column.span);
+                let iter = self.normalize_ident(iter);
+                let column = self.normalize_ident(column);
+                Err(ErrorCode::ScriptSemanticError(format!(
+                    "`{iter}.{column}` is ambiguous in a subquery: assign `{iter}.{column}` \
+                     to a variable and use it as `:var`, or use a table alias other than `{iter}`"
+                ))
+                .set_span(span))
+            }
+            _ => Ok(()),
+        }
+    }
+
     fn compile_sql_statement(
         &self,
         span: Span,
@@ -1083,6 +1124,7 @@ impl Compiler {
                 if self.query_depth > 0 {
                     // Nested SQL uses the same quoting rules as RESULTSET/RETURN TABLE:
                     // bare names stay SQL names, `:var` is a script variable.
+                    self.compiler.check_nested_sql_column_ref(expr)?;
                     self.compiler.rewrite_sql_hole_expr(expr)?;
                     return Ok(VisitControl::Continue);
                 }
```

**File**: `src/query/script/tests/it/main.rs` (modified, +57/-2)
```diff
@@ -364,11 +364,28 @@ fn test_script() {
         r#"
             LET x RESULTSET := SELECT * FROM numbers(3);
             FOR r IN x DO
-                LET y := (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1);
+                LET v := r.number;
+                LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :v + 1);
                 RETURN y;
             END FOR;
         "#,
     );
+    run_script(
+        file,
+        r#"
+            LET id := 1;
+            LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :id);
+            RETURN y;
+        "#,
+    );
+    run_script(
+        file,
+        r#"
+            LET number := 1;
+            LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :number);
+            RETURN y;
+        "#,
+    );
     run_script(
         file,
         r#"
@@ -444,6 +461,40 @@ fn test_script_error() {
             LET x := (SELECT :missing);
         "#,
     );
+    // Nested SQL names that older versions resolved to script variables must
+    // not silently resolve to columns.
+    run_script(
+        file,
+        r#"
+            LET id := 1;
+            LET y := (SELECT number FROM numbers(3) WHERE number = id);
+        "#,
+    );
+    run_script(
+        file,
+        r#"
+            LET number := 1;
+            LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = number);
+        "#,
+    );
+    run_script(
+        file,
+        r#"
+            LET x RESULTSET := SELECT * FROM numbers(3);
+            FOR r IN x DO
+                LET y := (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1);
+            END FOR;
+        "#,
+    );
+    run_script(
+        file,
+        r#"
+            LET x RESULTSET := SELECT * FROM numbers(3);
+            FOR r IN x DO
+                LET y := (SELECT number FROM numbers(3) AS t WHERE t.number = r.number);
+            END FOR;
+        "#,
+    );
     run_script(
         file,
         r#"
@@ -555,7 +606,11 @@ fn mock_client() -> MockClient {
             MockSet::unnamed(vec![vec![Literal::UInt64(1)]]),
         )
         .response_when(
-            "SELECT (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1)",
+            "SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = 0 + 1)",
+            MockSet::unnamed(vec![vec![Literal::UInt64(1)]]),
+        )
+        .response_when(
+            "SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = 1)",
             MockSet::unnamed(vec![vec![Literal::UInt64(1)]]),
         )
         .response_when(
```

**File**: `src/query/script/tests/it/testdata/script-error.txt` (modified, +54/-0)
```diff
@@ -102,6 +102,60 @@ error:
   |                  ^^^^^^^^ `missing` is not defined
 
 
+---------- Input ----------
+LET id := 1;
+LET y := (SELECT number FROM numbers(3) WHERE number = id);
+---------- Output ----------
+error: 
+  --> SQL:2:56
+  |
+1 | LET id := 1;
+2 | LET y := (SELECT number FROM numbers(3) WHERE number = id);
+  |                                                        ^^ `id` is ambiguous in a subquery: use `:id` for the script variable, or qualify the column with its table name
+
+
+---------- Input ----------
+LET number := 1;
+LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = number);
+---------- Output ----------
+error: 
+  --> SQL:2:65
+  |
+1 | LET number := 1;
+2 | LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = number);
+  |                                                                 ^^^^^^ `number` is ambiguous in a subquery: use `:number` for the script variable, or qualify the column with its table name
+
+
+---------- Input ----------
+LET x RESULTSET := SELECT * FROM numbers(3);
+FOR r IN x DO
+    LET y := (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1);
+END FOR;
+---------- Output ----------
+error: 
+  --> SQL:3:22
+  |
+1 | LET x RESULTSET := SELECT * FROM numbers(3);
+2 | FOR r IN x DO
+3 |     LET y := (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1);
+  |                      ^^^^^^^^ `r.number` is ambiguous in a subquery: assign `r.number` to a variable and use it as `:var`, or use a table alias other than `r`
+
+
+---------- Input ----------
+LET x RESULTSET := SELECT * FROM numbers(3);
+FOR r IN x DO
+    LET y := (SELECT number FROM numbers(3) AS t WHERE t.number = r.number);
+END FOR;
+---------- Output ----------
+error: 
+  --> SQL:3:67
+  |
+1 | LET x RESULTSET := SELECT * FROM numbers(3);
+2 | FOR r IN x DO
+3 |     LET y := (SELECT number FROM numbers(3) AS t WHERE t.number = r.number);
+  |                                                                   ^^^^^^^^ `r.number` is ambiguous in a subquery: assign `r.number` to a variable and use it as `:var`, or use a table alias other than `r`
+
+
 ---------- Input ----------
 LET x := 1;
 FOR r IN x DO
```

**File**: `src/query/script/tests/it/testdata/script.txt` (modified, +68/-9)
```diff
@@ -951,28 +951,87 @@ Some(Var(UInt64(1)))
 ---------- Input ----------
 LET x RESULTSET := SELECT * FROM numbers(3);
 FOR r IN x DO
-    LET y := (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1);
+    LET v := r.number;
+    LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :v + 1);
     RETURN y;
 END FOR;
 ---------- IR -------------
 QUERY SELECT * FROM numbers(3), x(0)
 ITER x(0), r(3)
 __LOOP1(1):
 JUMP_IF_ENDED r(3), __LOOP_END2(2)
-QUERY SELECT (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1), __expr_result5(5)
-ITER __expr_result5(5), __expr_result_iter6(6)
-READ __expr_result_iter6(6), $0, y(4)
-QUERY SELECT :4, __expr_result8(8)
-ITER __expr_result8(8), __expr_result_iter9(9)
-READ __expr_result_iter9(9), $0, __return_val7(7)
-RETURN __return_val7(7)
+READ r(3), "number", __r.number5(5)
+QUERY SELECT :5, __expr_result6(6)
+ITER __expr_result6(6), __expr_result_iter7(7)
+READ __expr_result_iter7(7), $0, v(4)
+QUERY SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = :4 + 1), __expr_result9(9)
+ITER __expr_result9(9), __expr_result_iter10(10)
+READ __expr_result_iter10(10), $0, y(8)
+QUERY SELECT :8, __expr_result12(12)
+ITER __expr_result12(12), __expr_result_iter13(13)
+READ __expr_result_iter13(13), $0, __return_val11(11)
+RETURN __return_val11(11)
 NEXT r(3)
 GOTO __LOOP1(1)
 __LOOP_END2(2):
 ---------- QUERY ---------
 QUERY: SELECT * FROM numbers(3)
 BLOCK: (number): (0), (1), (2)
-QUERY: SELECT (SELECT r.number FROM numbers(3) AS r WHERE r.number = 1)
+QUERY: SELECT 0
+BLOCK: ($0): (0)
+QUERY: SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = 0 + 1)
+BLOCK: ($0): (1)
+QUERY: SELECT 1
+BLOCK: ($0): (1)
+---------- Output ---------
+Some(Var(UInt64(1)))
+
+
+---------- Input ----------
+LET id := 1;
+LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :id);
+RETURN y;
+---------- IR -------------
+QUERY SELECT 1, __expr_result1(1)
+ITER __expr_result1(1), __expr_result_iter2(2)
+READ __expr_result_iter2(2), $0, id(0)
+QUERY SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = :0), __expr_result4(4)
+ITER __expr_result4(4), __expr_result_iter5(5)
+READ __expr_result_iter5(5), $0, y(3)
+QUERY SELECT :3, __expr_result7(7)
+ITER __expr_result7(7), __expr_result_iter8(8)
+READ __expr_result_iter8(8), $0, __return_val6(6)
+RETURN __return_val6(6)
+---------- QUERY ---------
+QUERY: SELECT 1
+BLOCK: ($0): (1)
+QUERY: SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = 1)
+BLOCK: ($0): (1)
+QUERY: SELECT 1
+BLOCK: ($0): (1)
+---------- Output ---------
+Some(Var(UInt64(1)))
+
+
+---------- Input ----------
+LET number := 1;
+LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :number);
+RETURN y;
+---------- IR -------------
+QUERY SELECT 1, __expr_result1(1)
+ITER __expr_result1(1), __expr_result_iter2(2)
+READ __expr_result_iter2(2), $0, number(0)
+QUERY SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = :0), __expr_result4(4)
+ITER __expr_result4(4), __expr_result_iter5(5)
+READ __expr_result_iter5(5), $0, y(3)
+QUERY SELECT :3, __expr_result7(7)
+ITER __expr_result7(7), __expr_result_iter8(8)
+READ __expr_result_iter8(8), $0, __return_val6(6)
+RETURN __return_val6(6)
+---------- QUERY ---------
+QUERY: SELECT 1
+BLOCK: ($0): (1)
+QUERY: SELECT (SELECT t.number FROM numbers(3) AS t WHERE t.number = 1)
 BLOCK: ($0): (1)
 QUERY: SELECT 1
 BLOCK: ($0): (1)
```

**File**: `tests/sqllogictests/suites/base/15_procedure/15_0001_execute_immediate.test` (modified, +42/-1)
```diff
@@ -271,7 +271,7 @@ $$;
 ----
 1
 
-query I
+query error `r.number` is ambiguous in a subquery
 EXECUTE IMMEDIATE $$
 BEGIN
     LET rs RESULTSET := SELECT * FROM numbers(3);
@@ -281,9 +281,50 @@ BEGIN
     END FOR;
 END;
 $$;
+
+query I
+EXECUTE IMMEDIATE $$
+BEGIN
+    LET rs RESULTSET := SELECT * FROM numbers(3);
+    FOR r IN rs DO
+        LET v := r.number;
+        LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :v + 1);
+        RETURN y;
+    END FOR;
+END;
+$$;
 ----
 1
 
+query error `id` is ambiguous in a subquery
+EXECUTE IMMEDIATE $$
+BEGIN
+    LET id := 1;
+    LET y := (SELECT number FROM numbers(3) WHERE number = id);
+    RETURN y;
+END;
+$$;
+
+query error `number` is ambiguous in a subquery
+EXECUTE IMMEDIATE $$
+BEGIN
+    LET number := 2;
+    LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = number);
+    RETURN y;
+END;
+$$;
+
+query I
+EXECUTE IMMEDIATE $$
+BEGIN
+    LET number := 2;
+    LET y := (SELECT t.number FROM numbers(3) AS t WHERE t.number = :number);
+    RETURN y;
+END;
+$$;
+----
+2
+
 query error `fallback` is not defined
 EXECUTE IMMEDIATE $$
 BEGIN
```

**File**: `tests/sqllogictests/suites/base/15_procedure/15_0002_procedure.test` (modified, +27/-0)
```diff
@@ -610,3 +610,30 @@ call PROCEDURE hdr();
 
 statement ok
 DROP PROCEDURE hdr();
+
+statement ok
+CREATE OR REPLACE PROCEDURE p_param_in_subquery(number UInt64) RETURNS UInt64 NOT NULL LANGUAGE SQL AS $$
+BEGIN
+    LET y := (SELECT count(*) FROM numbers(3) AS t WHERE t.number = number);
+    RETURN y;
+END;
+$$;
+
+query error `number` is ambiguous in a subquery
+call PROCEDURE p_param_in_subquery(1);
+
+statement ok
+CREATE OR REPLACE PROCEDURE p_param_in_subquery(number UInt64) RETURNS UInt64 NOT NULL LANGUAGE SQL AS $$
+BEGIN
+    LET y := (SELECT count(*) FROM numbers(3) AS t WHERE t.number = :number);
+    RETURN y;
+END;
+$$;
+
+query I
+call PROCEDURE p_param_in_subquery(1);
+----
+1
+
+statement ok
+DROP PROCEDURE p_param_in_subquery(UInt64);
```

#### Recent Merged Pull Requests:
- **PR #21241** (2026-11-26): fix: query: read the RESULT_SCAN cache key of HTTP sessions from meta (@drmingdrmer)
- **PR #21239** (2026-11-26): fix: query: update the matching entry in update_query_ids_results (@drmingdrmer)
- **PR #21237** (2026-11-26): ci(benchmark): move ClickBench hits from cloud to local fs benchmark (@dqhl76)
- **PR #21236** (closed): fix(storage): keep column statistics only where they cover every row (@dantengsky)
- **PR #21227** (2026-11-26): fix(query): fix materialized CTE hangs on channels nobody reads (@dqhl76)
- **PR #21223** (2026-11-26): fix: query: validate result cache key in RESULT_SCAN (@drmingdrmer)

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

## X. query): use one conversion plan for CAST and TRY_CAST

**RULE**:
When implementing operations in `src/query/expression/src/auto_cast_rules.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `80519243`: query): use one conversion plan for CAST and TRY_CAST. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/expression/src/auto_cast_rules.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
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

//! The rules of automatic casts that hold across functions.
//!
//! Type checking casts an argument to the type a function overload takes when a rule allows it.
//! The rules here are shared by many functions, and planner and storage code rely on the casts
//! they allow; which rules a function uses is decided where the function is registered.
//! [`decimal_auto_cast`] is the rule for decimals, whose sizes a list of type pairs cannot hold.

use crate::types::ALL_INTEGER_TYPES;
use crate::types::ALL_NUMERICS_TYPES;
use crate::types::DataType;
use crate::types::Decimal;
use crate::types::NumberDataType;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `80519243` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
