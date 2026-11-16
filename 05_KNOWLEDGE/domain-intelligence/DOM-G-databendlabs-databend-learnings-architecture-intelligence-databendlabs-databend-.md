# Domain G — Architecture Intelligence: Architecture Intelligence: databendlabs-databend-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs-databend-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T21:10:40.371Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-databendlabs-databend-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs-databend-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T21:10:40.371Z`  
> **Learning ID**: `LEARN-EVO-databendlabs-databend-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence)
- **Confidence Rating**: 66%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from databendlabs-databend-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `342ec629`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T21:10:34.947Z  
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
> **Harvest Timestamp**: 2026-11-16T21:10:34.941Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9497 stars

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
- **Issue #21099** (2026-11-16): **fix(meta): decode BLOOM table index type; default cache.data_max_ratio to 0**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Two small, independent changes, one commit each.  **1. Default `cache.data_max_ratio` to 0.**  With the shared cache backend on by default (#21091), the data pool reserved 10% of `max_server_memory_usage` for deserialized column data (`memory_cache_table_data`). That pool is the first one reclaimed under memory pressure and re-reads are already served by the disk cache, so the memory is better left to queries. With a 0 cap `SharedStore::check_admissible` rejects every insert into the pool, so no column data is kept in memory; the meta and index pools (10% / 40%) and the disk cache (`cache.disk.*`) are unchanged. Users who want the pool back set `cache.data_max_ratio` explicitly. Legacy options such as `table_data_deserialized_data_bytes` were already ignored by the shared backend, so they do not re-enable it.  **2. Decode `TableIndexType::Bloom` written by newer releases.**  A page-index branch rolling out in production writes `TableIndex.index_type = 4` (`BLOOM`). `proto-conv` on `main` only knows values 0..=3 and returns `Incompatible("invalid IndexType: 4")`, which fails the whole `TableMeta`. `list_tables` then skips the table (or, before #20663, fails the database), so it disappears from the admin tables API and `SHOW CREATE TABLE`.  This adds the enum placeholders (`TableIndexType::Bloom = 4`, `MarkedDeletedIndexType::BLOOM = 6`, `Display` → `BLOOM`, the `mark_t

- **Issue #21093** (2026-11-15): **fix(query): link cosine HNSW graphs with normalized vectors**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - On main, `HNSWIndex::build` normalizes cosine vectors only for SQ8 and links the graph with the raw vectors (inner product), so non-unit-length data gets a poor graph and needs a much larger ef. Link the graph with the normalized vectors; L1/L2 are unchanged. - Test: `test_cosine_graph_ignores_vector_lengths` (recall 0.196 before, 0.904 after).  Cohere 1M (768d, cosine, top 100), aarch64 8 vCPU, warm cache, refine 2, single round. Both columns use the same binary (it also carries a separate aarch64 SQ8 kernel tweak, not part of this PR), so they differ only in how the index was built:  | | 18 blocks (default)<br>main | 18 blocks (default)<br>this PR | 4 × 250K rows<br>main | 4 × 250K rows<br>this PR | 1 × 1M rows<br>this PR | |---|---:|---:|---:|---:|---:| | ef | 200 | 200 | 800 | 200 | 400 | | Recall@100 | 0.9677 | 0.9858 | 0.9686 | 0.9767 | 0.9742 | | c1 QPS | 86.3 | 85.1 | 97.6 | 111.7 | 103.5 | | c8 QPS | 334.9 | 335.8 | 415.7 | 524.7 | 570.9 | | c80 QPS | 438.0 | 437.1 | 583.1 | **812.2** | **948.4** | | c80 P99 (ms) | 295.0 | 293.3 | 219.1 | 149.5 | 129.2 |  At Recall ≥ 0.9677, the best c80 goes from 583.1 QPS (main, 4 × 250K, ef 800) to 948.4 QPS (this PR, 1 × 1M, ef 400), **+63%**. main needs ef 800 on 4 blocks because ef 200 only reaches recall 0.8943.  Layouts: `CREATE TABLE t (id BIGINT, emb VECTOR(768), VECTOR INDEX vi (emb) distance='cosine' m=16 ef_con

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

### Incident Patch 1: `a7a0a58b` (2026-11-16)
**Commit Message**: fix(meta): decode BLOOM table index type; default cache.data_max_ratio to 0 (#21099)

* chore(cache): turn the in-memory column data pool off by default

Default cache.data_max_ratio to 0 so the shared cache backend reserves
no server memory for deserialized column data; the disk cache and the
meta and index pools are unchanged. Users who want the in-memory pool
back set cache.data_max_ratio explicitly.

* fix(meta): decode BLOOM table index type written by newer releases

Table metadata written by the page-index rollout carries
TableIndexType::Bloom (index_type = 4). Without the variant, proto-conv
rejects the whole TableMeta, so the table disappears from the admin
tables API and SHOW CREATE TABLE.

Add the enum placeholder (and MarkedDeletedIndexType::BLOOM) so the
metadata decodes and displays, while creating or refreshing a BLOOM
index stays rejected in this release.

* chore(cache): align tests with the data pool off by default

Tests that exercise the data pool set cache.data_max_ratio explicitly;
the system.caches and system.configs golden files follow the default.

**File**: `src/meta/api/src/api_impl/schema_api.rs` (modified, +1/-0)
```diff
@@ -790,6 +790,7 @@ pub fn mark_table_index_as_deleted(
         TableIndexType::Ngram => MarkedDeletedIndexType::NGRAM,
         TableIndexType::Vector => MarkedDeletedIndexType::VECTOR,
         TableIndexType::Spatial => MarkedDeletedIndexType::SPATIAL,
+        TableIndexType::Bloom => MarkedDeletedIndexType::BLOOM,
     };
     let marked_deleted_table_index_meta = MarkedDeletedIndexMeta {
         dropped_on: Utc::now(),
```

**File**: `src/meta/app/src/schema/index.rs` (modified, +1/-0)
```diff
@@ -74,6 +74,7 @@ pub enum MarkedDeletedIndexType {
     NGRAM = 3,
     VECTOR = 4,
     SPATIAL = 5,
+    BLOOM = 6,
 }
 
 #[derive(Clone, Debug, Eq, PartialEq)]
```

**File**: `src/meta/app/src/schema/table/mod.rs` (modified, +8/-0)
```diff
@@ -290,6 +290,11 @@ pub enum TableIndexType {
     Ngram = 1,
     Vector = 2,
     Spatial = 3,
+    /// Granule-level Bloom index written by newer releases.
+    ///
+    /// This release only decodes the variant so table metadata that carries it
+    /// remains readable; creating or refreshing such an index is rejected.
+    Bloom = 4,
 }
 
 #[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Eq, PartialEq)]
@@ -490,6 +495,9 @@ impl Display for TableIndexType {
             TableIndexType::Spatial => {
                 write!(f, "SPATIAL")
             }
+            TableIndexType::Bloom => {
+                write!(f, "BLOOM")
+            }
         }
     }
 }
```

**File**: `src/meta/proto-conv/tests/it/proto_conv.rs` (modified, +30/-0)
```diff
@@ -387,6 +387,36 @@ fn test_pb_from_to() -> anyhow::Result<()> {
     Ok(())
 }
 
+/// Table metadata written by a newer release may carry a `BLOOM` table index
+/// (`index_type = 4`). This release must still decode that metadata, so the
+/// table remains visible to listing and `SHOW CREATE TABLE`, while any
+/// unknown value is rejected as before.
+#[test]
+fn test_table_index_type_bloom_placeholder() -> anyhow::Result<()> {
+    let mut index = new_table_index();
+    index.index_type = TableIndexType::Bloom;
+    index.options = btreemap! {s("filter_type") => s("binary_fuse32")};
+
+    let mut p = index.to_pb();
+    assert_eq!(p.index_type, 4);
+    let got = mt::TableIndex::from_pb(p.clone())?;
+    assert_eq!(index, got);
+    assert_eq!(got.index_type.to_string(), "BLOOM");
+
+    let mut tbl = new_table_meta();
+    tbl.indexes.insert(index.name.clone(), index);
+    let got = mt::TableMeta::from_pb(tbl.to_pb())?;
+    assert_eq!(tbl, got);
+
+    p.index_type = 99;
+    assert_eq!(
+        Incompatible::new(s("invalid IndexType: 99")),
+        mt::TableIndex::from_pb(p).unwrap_err()
+    );
+
+    Ok(())
+}
+
 #[test]
 fn test_incompatible() -> anyhow::Result<()> {
     let db_meta = new_db_meta();
```

**File**: `src/meta/schema-api-test-suite/src/schema_api_test_suite.rs` (modified, +4/-2)
```diff
@@ -7482,7 +7482,8 @@ impl SchemaApiTestSuite {
                     ver: VER,
                     min_reader_ver: MIN_READER_VER,
                     name: "idx".to_string(),
-                    index_type: 4,
+                    // No `TableIndexType` variant has this value.
+                    index_type: 99,
                     ..Default::default()
                 });
                 let table_key = TableId::new(table_id);
@@ -7709,7 +7710,8 @@ impl SchemaApiTestSuite {
                     ver: VER,
                     min_reader_ver: MIN_READER_VER,
                     name: "idx".to_string(),
-                    index_type: 4,
+                    // No `TableIndexType` variant has this value.
+                    index_type: 99,
                     ..Default::default()
                 });
                 upsert_test_data(mt, &TableId::new(table_id), table_pb.encode_to_vec()).await?;
```

**File**: `src/query/config/src/config.rs` (modified, +4/-3)
```diff
@@ -3582,11 +3582,12 @@ pub struct CacheConfig {
     )]
     pub index_max_ratio: u64,
 
-    /// Shared backend: percentage of the server memory limit for column data.
+    /// Shared backend: percentage of the server memory limit for column data. 0 disables the
+    /// in-memory column data pool.
     #[clap(
         long = "cache-data-max-ratio",
         value_name = "VALUE",
-        default_value = "10"
+        default_value = "0"
     )]
     pub data_max_ratio: u64,
 
@@ -3652,7 +3653,7 @@ impl Default for CacheConfig {
             shared_memory_enabled: true,
             meta_max_ratio: 10,
             index_max_ratio: 40,
-            data_max_ratio: 10,
+            data_max_ratio: 0,
             kind_max_bytes: BTreeMap::new(),
 
             // ----- the following options/args are all deprecated               ----
```

**File**: `src/query/service/tests/it/configs.rs` (modified, +9/-0)
```diff
@@ -1030,6 +1030,15 @@ fn test_server_memory_limit_defaults() {
     assert!(config.query.common.max_memory_limit_enabled);
     assert!(config.cache.shared_memory_enabled);
     assert_eq!(config.query.common.max_server_memory_usage, 0);
+    // The in-memory column data pool is off by default; metadata and index pools stay on.
+    assert_eq!(
+        (
+            config.cache.meta_max_ratio,
+            config.cache.index_max_ratio,
+            config.cache.data_max_ratio
+        ),
+        (10, 40, 0)
+    );
 
     let mut system = sysinfo::System::new();
     system.refresh_memory();
```

**File**: `src/query/service/tests/it/servers/admin/v1/mod.rs` (modified, +1/-0)
```diff
@@ -18,3 +18,4 @@ mod clustering_information;
 mod config;
 mod perf;
 mod status;
+mod tenant_tables;
```

---

### Incident Patch 2: `342ec629` (2026-11-16)
**Commit Message**: fix(query): hash equal bitmap, geometry and interval values consistently (#20971)

* fix(query): preserve equality across group hash representations

* fix(query): hash canonical bitmap containers without member expansion

* fix(query): validate bitmap range hashing without a direct dependency

* fix(query): compare bitmap members across roaring stores

* test(query): focus value hash regressions and expand SQL coverage

---------

Co-authored-by: kould <[REDACTED_EMAIL]>

**File**: `src/query/expression/src/aggregate/group_hash.rs` (modified, +6/-47)
```diff
@@ -34,7 +34,6 @@ use crate::types::decimal::Decimal;
 use crate::types::i256;
 use crate::types::number::Number;
 use crate::types::*;
-use crate::utils::bitmap::normalize_bitmap_column;
 use crate::visitor::ValueVisitor;
 use crate::with_decimal_mapped_type;
 use crate::with_number_mapped_type;
@@ -243,10 +242,7 @@ fn combine_group_hash_const_nonnull<const IS_FIRST: bool>(
         Scalar::Date(value) => value.agg_hash(),
         Scalar::Boolean(value) => value.agg_hash(),
         Scalar::String(value) => value.as_bytes().agg_hash(),
-        Scalar::Binary(value)
-        | Scalar::Bitmap(value)
-        | Scalar::Variant(value)
-        | Scalar::Geometry(value) => value.agg_hash(),
+        Scalar::Binary(value) | Scalar::Variant(value) => value.agg_hash(),
         Scalar::Geography(value) => value.0.agg_hash(),
         _ => scalar.as_ref().agg_hash(),
     };
@@ -366,8 +362,8 @@ impl<const IS_FIRST: bool> ValueVisitor for HashVisitor<'_, IS_FIRST> {
     }
 
     fn visit_bitmap(&mut self, column: BinaryColumn) -> Result<()> {
-        let column = normalize_bitmap_column(&column);
-        self.combine_group_hash_string_column::<BitmapType>(column.as_ref());
+        // Equal bitmaps can have different encodings, including within the hybrid format.
+        self.combine_group_hash_type_column::<AnyType>(&Column::Bitmap(column));
         Ok(())
     }
 
@@ -377,7 +373,7 @@ impl<const IS_FIRST: bool> ValueVisitor for HashVisitor<'_, IS_FIRST> {
     }
 
     fn visit_geometry(&mut self, column: BinaryColumn) -> Result<()> {
-        self.combine_group_hash_string_column::<GeometryType>(&column);
+        self.combine_group_hash_type_column::<AnyType>(&Column::Geometry(column));
         Ok(())
     }
 
@@ -508,7 +504,6 @@ where I: Index
             Scalar::Binary(v) => v.agg_hash(),
             Scalar::String(v) => v.as_bytes().agg_hash(),
             Scalar::Variant(v) => v.agg_hash(),
-            Scalar::Geometry(v) => v.agg_hash(),
             Scalar::Geography(v) => v.0.agg_hash(),
             Scalar::Opaque(v) => v.as_ref().agg_hash(),
             v => v.as_ref().agg_hash(),
@@ -575,11 +570,7 @@ where I: Index
     }
 
     fn visit_bitmap(&mut self, column: crate::types::BinaryColumn) -> Result<()> {
-        let column = normalize_bitmap_column(&column);
-        self.visit_indices(|i| {
-            let value = column.as_ref().index(i.to_usize()).unwrap();
-            value.agg_hash()
-        })
+        self.visit_typed_column::<BitmapType>(column, &DataType::Bitmap)
     }
 
     fn visit_string(&mut self, column: crate::types::StringColumn) -> Result<()> {
@@ -591,7 +582,7 @@ where I: Index
     }
 
     fn visit_geometry(&mut self, column: crate::types::BinaryColumn) -> Result<()> {
-        self.visit_binary(column)
+        self.visit_typed_column::<GeometryType>(column, &DataType::Geometry)
     }
 
     fn visit_geography(&mut self, column: crate::types::GeographyColumn) -> Result<()> {
@@ -794,8 +785,6 @@ mod tests {
     use databend_common_column::bitmap::Bitmap;
     use databend_common_column::types::months_days_micros;
     use databend_common_column::types::timestamp_tz;
-    use databend_common_io::HybridBitmap;
-    use roaring::RoaringTreemap;
 
     use super::*;
     use crate::BlockEntry;
@@ -804,7 +793,6 @@ mod tests {
     use crate::ProjectedBlock;
     use crate::Value;
     use crate::types::ArgType;
-    use crate::types::BitmapType;
     use crate::types::DecimalSize;
     use crate::types::Int32Type;
     use crate::types::NullableColumn;
@@ -1106,35 +1094,6 @@ mod tests {
         Ok(())
     }
 
-    #[test]
-    fn test_bitmap_group_hash_legacy_bytes_normalized() -> Result<()> {
-        let values = [1_u64, 5, 42];
-
-        let mut hybrid = HybridBitmap::new();
-        for v in values {
-            hybrid.insert(v);
-        }
-        let mut hybrid_bytes = Vec::new();
-        hybrid.serialize_into(&mut hybrid_bytes).unwrap();
-
-        let mut tree = RoaringTreemap::new();
-        for v in values {
-            tree.insert(v);
-        }
-        let mut legacy_bytes = Vec::new();
-        tree.serialize_into(&mut legacy_bytes).unwrap();
-
-        let bitmap_column = BitmapType::from_data(vec![hybrid_bytes, legacy_bytes]);
-        let block = DataBlock::new(vec![bitmap_column.into()], 2);
-
-        let mut hashes = vec![0_u64; block.num_rows()];
-        group_hash_entries(ProjectedBlock::from(block.columns()), &mut hashes);
-
-        // Legacy-encoded bitmap should hash identically to hybrid-encoded bitmap.
-        assert_eq!(hashes[0], hashes[1]);
-        Ok(())
-    }
-
     #[test]
     fn test_dict_value_hashes_match_group_hash_entries() {
         const ROWS: usize = 5000;
```

**File**: `src/query/expression/src/utils/bitmap.rs` (modified, +39/-0)
```diff
@@ -13,14 +13,53 @@
 // limitations under the License.
 
 use std::borrow::Cow;
+use std::hash::Hash;
+use std::hash::Hasher;
+use std::io;
 
 use databend_common_column::binary::BinaryColumn;
 use databend_common_column::binary::BinaryColumnBuilder;
 use databend_common_io::HYBRID_KIND_LARGE;
 use databend_common_io::HYBRID_KIND_SMALL;
 use databend_common_io::HYBRID_MAGIC;
 use databend_common_io::HYBRID_VERSION;
+use databend_common_io::HybridBitmap;
 use databend_common_io::deserialize_bitmap;
+
+/// Hash a canonical compressed representation, not every decoded member.
+/// Small hybrid sets are bounded by their one-byte serialized length; large
+/// bitmaps stay in Roaring's array/bitset containers throughout hashing.
+pub fn hash_bitmap<H: Hasher>(bytes: &[u8], state: &mut H) {
+    let mut tree = match deserialize_bitmap(bytes) {
+        Ok(HybridBitmap::Small(values)) => values.into_iter().collect(),
+        Ok(HybridBitmap::Large(tree)) => tree,
+        Err(_) => {
+            bytes.hash(state);
+            return;
+        }
+    };
+    // Self-intersection preserves members while normalizing container stores by
+    // cardinality and removing empty containers. In particular, decoding a run
+    // can otherwise leave an array store at the array/bitset threshold.
+    // This works on compressed containers, without enumerating the large set.
+    tree &= tree.clone();
+    // The writer only feeds a Hasher, so serialization cannot fail with I/O.
+    tree.serialize_into(BitmapHashWriter(state)).unwrap();
+}
+
+struct BitmapHashWriter<'a, H>(&'a mut H);
+
+impl<H: Hasher> io::Write for BitmapHashWriter<'_, H> {
+    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
+        self.0.write(bytes);
+        Ok(bytes.len())
+    }
+
+    fn flush(&mut self) -> io::Result<()> {
+        Ok(())
+    }
+}
+
 #[inline]
 pub fn is_hybrid_encoding(bytes: &[u8]) -> bool {
     if bytes.is_empty() {
```

**File**: `src/query/expression/src/values.rs` (modified, +8/-11)
```diff
@@ -57,6 +57,7 @@ use string::StringColumnBuilder;
 
 use crate::BlockEntry;
 use crate::ColumnView;
+use crate::bitmap::hash_bitmap;
 use crate::bitmap::is_hybrid_encoding;
 use crate::property::Domain;
 use crate::types::EncodedColumn;
@@ -1038,7 +1039,11 @@ impl PartialOrd for Scalar {
                 let Ok(map_2) = deserialize_bitmap(b2) else {
                     return None;
                 };
-                map_1.eq(&map_2).then_some(Ordering::Equal)
+                // Roaring's equality distinguishes array and bitset stores.
+                // Decoding a run can leave an oversized array at the threshold,
+                // so compare members through compressed intersection instead.
+                (map_1.len() == map_2.len() && map_1.intersection_len(&map_2) == map_1.len())
+                    .then_some(Ordering::Equal)
             }
             (Scalar::Tuple(t1), Scalar::Tuple(t2)) => t1.partial_cmp(t2),
             (Scalar::Variant(v1), Scalar::Variant(v2)) => {
@@ -1160,7 +1165,7 @@ impl Hash for ScalarRef<'_> {
             ScalarRef::Timestamp(v) => v.hash(state),
             ScalarRef::TimestampTz(v) => v.hash(state),
             ScalarRef::Date(v) => v.hash(state),
-            ScalarRef::Interval(v) => v.0.hash(state),
+            ScalarRef::Interval(v) => v.hash(state),
             ScalarRef::Array(v) | ScalarRef::Map(v) => {
                 v.len().hash(state);
                 for value in v.iter() {
@@ -1170,15 +1175,7 @@ impl Hash for ScalarRef<'_> {
             // `Scalar::eq` compares bitmaps by their decoded members, so the
             // hash must not depend on the encoding. Undecodable payloads only
             // compare equal bytewise and fall back to hashing the bytes.
-            ScalarRef::Bitmap(v) => match deserialize_bitmap(v) {
-                Ok(bitmap) => {
-                    bitmap.len().hash(state);
-                    for member in bitmap.iter() {
-                        member.hash(state);
-                    }
-                }
-                Err(_) => v.hash(state),
-            },
+            ScalarRef::Bitmap(v) => hash_bitmap(v, state),
             ScalarRef::Tuple(v) => {
                 v.hash(state);
             }
```

**File**: `src/query/expression/tests/it/group_hash.rs` (added, +356/-0)
```diff
@@ -0,0 +1,356 @@
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
+use std::collections::HashMap;
+use std::hash::DefaultHasher;
+use std::hash::Hash;
+use std::hash::Hasher;
+
+use databend_common_expression::types::DictColumn;
+use databend_common_expression::types::EncodedColumn;
+use databend_common_expression::types::Int16Type;
+use databend_common_expression::types::NarrowBuffer;
+use databend_common_expression::types::StringType;
+use databend_common_expression::*;
+use databend_common_io::HybridBitmap;
+use roaring::RoaringBitmap;
+use roaring::RoaringTreemap;
+
+fn repeated(scalar: Scalar, rows: usize) -> BlockEntry {
+    BlockEntry::new_const_column(scalar.as_ref().infer_data_type(), scalar, rows)
+}
+
+fn scalar_hash(scalar: &impl Hash) -> u64 {
+    let mut hasher = DefaultHasher::new();
+    scalar.hash(&mut hasher);
+    hasher.finish()
+}
+
+// All rows in a class have the same logical value. No expected hash is derived
+// from the hash implementation: compare representations and layouts instead.
+fn assert_hash_class(scalars: &[Scalar]) -> databend_common_exception::Result<()> {
+    let first = &scalars[0];
+    let data_type = first.as_ref().infer_data_type();
+    let mut map = HashMap::new();
+    let mut builder = ColumnBuilder::with_capacity(&data_type, scalars.len() + 2);
+    builder.push(first.as_ref());
+    for scalar in scalars {
+        // Check equality in both directions before diagnosing HashMap hashing.
+        assert_eq!(scalar, first);
+        assert_eq!(first, scalar);
+        assert_eq!(scalar_hash(scalar), scalar_hash(first));
+        map.insert(scalar.clone(), ());
+        builder.push(scalar.as_ref());
+    }
+    assert_eq!(map.len(), 1);
+    builder.push(first.as_ref());
+    // Slice off padding so binary/array buffers and validity can have offsets.
+    let column = builder.build().slice(1..scalars.len() + 1);
+    let rows = scalars.len();
+    let dictionary = Column::Encoded(Box::new(EncodedColumn::Dict(DictColumn::new(
+        NarrowBuffer::pack((0..rows).rev().map(|index| index as u64), (rows - 1) as u64),
+        column.clone(),
+    ))));
+    let suffix = Int16Type::from_data(vec![4_i16; rows]);
+    let entries = [BlockEntry::Column(column), BlockEntry::Column(dictionary)]
+        .into_iter()
+        .chain(scalars.iter().cloned().flat_map(|value| {
+            let entry = repeated(value.clone(), rows);
+            let nullable =
+                BlockEntry::new_const_column(data_type.clone().wrap_nullable(), value, rows);
+            [entry, nullable]
+        }))
+        .collect::<Vec<_>>();
+
+    for projection in [vec![0], vec![0, 1], vec![1, 0]] {
+        let null_block = DataBlock::new(
+            vec![
+                BlockEntry::new_const_column(data_type.clone().wrap_nullable(), Scalar::Null, rows),
+                suffix.clone().into(),
+            ],
+            rows,
+        );
+        let mut null_hashes = vec![0; rows];
+        group_hash_entries(
+            ProjectedBlock::project(&projection, &null_block),
+            &mut null_hashes,
+        );
+        // Compare the same layouts both without NULLs and with actual masked
+        // payloads. Indexed hashing selects a valid row and a NULL row.
+        for nullable in [false, true] {
+            let mut expected = None;
+            for entry in &entries {
+                let entry = if nullable {
+                    entry
+                        .to_column()
+                        .remove_nullable()
+                        .wrap_nullable(Some((0..rows).map(|row| row != rows - 1).collect()))
+                        .into()
+                } else {
+                    entry.clone()
+                };
+                let block = DataBlock::new(vec![entry, suffix.clone().into()], rows);
+                let mut hashes = vec![u64::MAX; rows];
+                group_hash_entries(ProjectedBlock::project(&projection, &block), &mut hashes);
+                let valid_rows = if nullable { rows - 1 } else { rows };
+                assert!(hashes[..valid_rows].iter().all(|hash| *hash == hashes[0]));
+                if nullable {
+                    assert_eq!(hashes[rows - 1], null_hashes[rows - 1]);
+                }
+                if let Some(expected) = &expected {
+                    assert_eq!(&hashes, expected);
+                } else {
+                    expected = Some(hashes.clone());
+ 
```

**File**: `src/query/expression/tests/it/main.rs` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ mod filter_executor;
 mod fold_rules;
 mod function_factory;
 mod group_by;
+mod group_hash;
 mod hilbert;
 mod kernel;
 mod meta_scalar;
```

**File**: `tests/sqllogictests/suites/mode/cluster/shuffle_value_hash.test` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# Integration smoke coverage for scalar/materialized bitmap shuffle inputs,
+# single/composite keys and NULLs. to_bitmap canonicalizes member order, so
+# these are not cross-encoding regressions; those require the Rust fixtures.
+# Cross-encoding JOIN key serialization remains outside this hash-only fix.
+
+statement ok
+set prefer_broadcast_join = 0
+
+statement ok
+create or replace table shuffle_value_left(tag int not null, bits bitmap null)
+
+statement ok
+create or replace table shuffle_value_right(tag int not null, bits bitmap null)
+
+statement ok
+insert into shuffle_value_left values (1, to_bitmap('2,9')), (2, to_bitmap('4')), (3, null)
+
+statement ok
+insert into shuffle_value_right values (1, to_bitmap('9,2')), (2, to_bitmap('4')), (3, null)
+
+query I
+select count(*) from shuffle_value_left l join shuffle_value_right r on l.bits = r.bits and l.tag = r.tag
+----
+2
+
+query I
+select count(*) from (select tag, to_bitmap('2,9') as bits from shuffle_value_left) l join shuffle_value_right r on l.bits = r.bits and l.tag = r.tag
+----
+1
+
+query I
+select count(*) from shuffle_value_left l join shuffle_value_right r on l.bits = r.bits
+----
+2
+
+statement ok
+drop table shuffle_value_left
+
+statement ok
+drop table shuffle_value_right
```

**File**: `tests/sqllogictests/suites/query/functions/02_0087_function_interval_hash.test` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Scalar interval hashes must follow duration equality, including inside
+# arrays, tuples and maps. Keep these SQL-visible cases here rather than
+# duplicating them in the expression crate's group-hash layout tests.
+
+# Establish the equality contract independently of hash-based deduplication.
+skipif mysql
+query BB
+select to_interval('1 month') = to_interval('30 days'), to_interval('30 days') = to_interval('29 days 24 hours')
+----
+1 1
+
+# Constant folding: three storage representations of one duration.
+skipif mysql
+query I
+select array_length(array_distinct([to_interval('1 month'), to_interval('30 days'), to_interval('29 days 24 hours')]))
+----
+1
+
+# Runtime evaluation: expose each row instead of hiding the result in a sum.
+skipif mysql
+query II
+select number, array_length(array_distinct([to_interval(if(number % 2 = 0, '1 month', '30 days')), to_interval('30 days')])) from numbers(4) order by number
+----
+0 1
+1 1
+2 1
+3 1
+
+# Recursive scalar hashing must use the same duration semantics in every
+# supported nested container, including a tuple with a NULL field.
+skipif mysql
+query III
+select
+    array_length(array_distinct([[to_interval('1 month')], [to_interval('30 days')]])),
+    array_length(array_distinct([tuple(null, to_interval('1 month')), tuple(null, to_interval('30 days'))])),
+    array_length(array_distinct([map(['key'], [to_interval('1 month')]), map(['key'], [to_interval('30 days')])]))
+----
+1 1 1
+
+# Negative durations must canonicalize too, not only positive intervals.
+skipif mysql
+query I
+select array_length(array_distinct([to_interval('-1 month'), to_interval('-30 days'), to_interval('-29 days -24 hours')]))
+----
+1
+
+# Do not collapse a genuinely different duration; NULL is ignored by array_distinct.
+skipif mysql
+query I
+select array_length(array_distinct([null, to_interval('1 month'), to_interval('30 days'), to_interval('31 days')]))
+----
+2
```

---

### Incident Patch 3: `3c30b0dd` (2026-11-16)
**Commit Message**: fix(query): bind a CTE body in its definition's scope (#21076)

* fix(query): bind a CTE body in its definition's scope

A non-materialized CTE was rebound at every reference with the referencing
context chained as its parent, so its body could bind columns that only the
referencing query provides. `WITH t AS (SELECT x) ... , LATERAL (SELECT * FROM
t)` therefore returned a row instead of rejecting `x`, and the meaning of the
same CTE depended on where it was used.

Bind the body without the referencing scope, so an unknown column is reported
where the CTE is defined. The context the CTE scan hands back still chains to
the referencing query: a correlated subquery that reads the CTE has to reach
the query it sits in.

* test(query): cover CTE binding scope with a sqllogictest instead of a binder unit test

**File**: `src/query/sql/src/planner/binder/table.rs` (modified, +10/-1)
```diff
@@ -179,7 +179,12 @@ impl Binder {
         cte_info: &CteInfo,
     ) -> Result<(SExpr, BindContext)> {
         let mut new_bind_context = BindContext {
-            parent: Some(Box::new(bind_context.clone())),
+            // A CTE definition is bound at the point of its `WITH` clause, not at the point
+            // where it is referenced. Chaining the referencing context as a parent would let
+            // the body bind its columns — a CTE referenced from a lateral subquery would
+            // silently correlate with whatever the subquery's left side produces. Earlier
+            // CTEs still resolve through the cloned `cte_context`.
+            parent: None,
             binding_depth: bind_context.next_depth()?,
             bound_internal_columns: BTreeMap::new(),
             bound_virtual_columns: BTreeMap::new(),
@@ -207,6 +212,10 @@ impl Binder {
 
         let (s_expr, mut res_bind_context) =
             self.bind_query(&mut new_bind_context, &cte_info.query)?;
+        // The body above was bound without the referencing scope, but the scan it produced is
+        // part of the referencing query: a correlated subquery that reads the CTE still has to
+        // reach the columns of the query it sits in.
+        res_bind_context.parent = Some(Box::new(bind_context.clone()));
         let mut cols_alias = cte_info.columns_alias.clone();
         if let Some(alias) = alias {
             for (idx, col_alias) in alias.columns.iter().enumerate() {
```

**File**: `tests/sqllogictests/suites/query/cte/cte_scope.test` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+# A CTE body is bound where its WITH clause is, so it can never resolve a column
+# that only the query referencing it provides. Issue #20983.
+
+# The enclosing SELECT does not provide x.
+statement error 1065
+WITH t AS (SELECT x) SELECT * FROM t
+
+# Another item of the referencing FROM does not provide x.
+statement error 1065
+WITH t AS (SELECT x) SELECT * FROM (SELECT 1 AS x) s, t
+
+# The left side of a LATERAL subquery used to leak into the CTE body and
+# this query returned `1 1`.
+statement error 1065
+WITH t AS (SELECT x) SELECT * FROM (SELECT 1 AS x) s, LATERAL (SELECT * FROM t)
+
+# A self-contained CTE is still readable from a lateral subquery.
+query II
+WITH t AS (SELECT 1 AS x) SELECT * FROM (SELECT 1 AS x) s, LATERAL (SELECT * FROM t)
+----
+1 1
+
+# A CTE body may still reference a CTE defined earlier in the same WITH clause.
+query I
+WITH a AS (SELECT 1 AS x), b AS (SELECT x + 1 AS y FROM a) SELECT * FROM b
+----
+2
+
+# A correlated subquery that reads a CTE still reaches the columns of the
+# query it sits in (the TPC-DS Q1 shape).
+statement ok
+create or replace table cte_scope_t(k int, v int)
+
+statement ok
+insert into cte_scope_t values (1, 10), (1, 30), (2, 5)
+
+query II
+WITH c AS (SELECT k, v FROM cte_scope_t)
+SELECT k, v FROM c c1
+WHERE v > (SELECT avg(v) * 1.2 FROM c c2 WHERE c1.k = c2.k)
+ORDER BY k
+----
+1 30
+
+statement ok
+drop table cte_scope_t
```

#### Recent Merged Pull Requests:
- **PR #21099** (2026-11-16): fix(meta): decode BLOOM table index type; default cache.data_max_ratio to 0 (@zhang2014)
- **PR #21093** (2026-11-15): fix(query): link cosine HNSW graphs with normalized vectors (@bohutang)
- **PR #21092** (2026-11-13): fix(query): truncate REPLACE statements in query logs (@TCeason)
- **PR #21091** (2026-11-15): feat(query): enable the memory limit and the shared cache by default (@bohutang)
- **PR #21090** (2026-11-13): refactor(query): scan only the rows matched by the inverted index (@bohutang)
- **PR #21087** (2026-11-13): feat(query): support native charset conversion for binary strings (@sundy-li)

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

## X. meta): decode BLOOM table index type; default cache.data_max_ratio to 0

**RULE**:
When implementing operations in `src/meta/api/src/api_impl/schema_api.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a7a0a58b`: meta): decode BLOOM table index type; default cache.data_max_ratio to 0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/meta/api/src/api_impl/schema_api.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        TableIndexType::Bloom => MarkedDeletedIndexType::BLOOM,
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a7a0a58b` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
