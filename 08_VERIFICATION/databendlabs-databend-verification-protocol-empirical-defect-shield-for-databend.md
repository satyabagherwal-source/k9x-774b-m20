# Verification Protocol: Verification Protocol: Empirical Defect Shield for databendlabs/databend

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `databendlabs/databend` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source**: github ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Source Version**: `fdcf2d37`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T10:08:16.656Z  
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
> **Harvest Timestamp**: 2026-11-11T10:08:16.641Z  
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
- **Issue #21060** (2026-11-11): **fix(query): break rank limit ties by the remaining group keys**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  `GROUP BY k1, k2 ORDER BY k1 LIMIT n` can return wrong aggregate values when groups tie on `k1`.  A rank limit pushed into the aggregate drops, batch by batch, the rows of the groups that rank after the limit, so only the first `n` groups by **all** the rank keys (`k1, k2`) are whole. The Sort / TopN above ordered by `k1` only, so among tied groups it could return one that had lost rows. With several final aggregate processors each keeping its own first `n` groups, such groups reach the limit. `GROUP BY ... LIMIT n` without ORDER BY had the same problem when a group key cannot be sorted by (e.g. an array), because the injected sort skipped that key.  ```sql create table t (dt int, uid int); insert into t select 1, number from numbers(300000); insert into t select 1, number + 3 from numbers(300000); -- every (dt, uid) with uid in [3, 300000) has count 2, but rows such as (1, 60001, 1) were returned select dt, uid, count(*) from t group by dt, uid order by dt limit 5; ```  Changes in `RulePushDownRankLimitAggregate`:  - When ORDER BY covers only part of the group keys, append the remaining group keys to the Sort / TopN above as tie breakers, so it picks exactly the groups the rank limit kept whole. The extra keys are group keys, so the result still satisfies the ORDER BY. - When a group key that has to break ties cannot be sorted by, do not push the rank limit, for both

- **Issue #21056** (2026-11-11): **bug: HashMethodSerializer panics on constant BlockEntry inputs**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/databendlabs/databend/issues) and found no similar issues.  ### Version  Source at `f004c938f4` (parent of #20972). The same code is present in the `v1.2.961-nightly` source. No released binary was tested, because no SQL path has been found that reaches this code (see below).  ### What's Wrong?  `HashMethodSerializer::build_keys_state` assumes every input `BlockEntry` is a materialized column and unwraps `as_column()` while estimating capacity:  ```rust let serialize_size = group_columns     .iter()     .map(|entry| entry.as_column().unwrap().serialize_size())     .sum(); ```  Passing a constant entry therefore panics before any key bytes are written, even though the downstream serialization path (`serialize_group_columns`) already materializes entries through `to_column()`. The other hash methods (`HashMethodFixedKeys::build_keys_state` and `HashMethodSingleBinary::build_keys_state`) also accept constant entries via `to_column()`, so the serializer is the only one with this restriction.  This is separate from the underestimated-buffer issue (#21055). The issue is confirmed at the serializer API level. A SQL path that passes constant entries to this interface has not been established.  SQL reachability checked so far, on `f004c938f4`: every in-tree caller of `build_keys_state`, `hash_by_method` and `hash_by_method_for_bloom` materializes its key entries first.  - Legacy hash join build/probe (`h

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

### Incident Patch 1: `cbbeaa8c` (2026-11-10)
**Commit Message**: fix(query): defer transaction maintenance until after commit (#21020)

* fix(query): defer transaction maintenance until after commit

Aggregate automatic maintenance inputs per table in explicit transactions
and dispatch them in independent sessions only after successful commit.
Discard deferred maintenance and purge requests on rollback or failure.
Release materialized-view lifecycle locks before running maintenance.

Move maintenance stages into TableHookTask and keep scheduling separate.
Preserve stage ordering and local error handling, distinguish sync/async
execution logs, and recover scheduler state after runner panics.
Keep the existing COMPACT BLOCK lock scope and async blackbox matcher.

Add SQL regressions for transactional REPLACE and MV refresh maintenance.

Fixes #20825.

* fix(query): preserve hook lock cleanup and reduce metadata reads

Restore callback-chain lock release for synchronous hooks when task creation or execution fails.

Skip target resolution for zero compaction hints, verify the current name before falling back to ID lookup, and reuse freshly resolved tables within each maintenance stage. Remove duplicate cache cleanup while preserving per-stage ID che

**File**: `src/query/ee/src/materialized_view/handler.rs` (modified, +10/-4)
```diff
@@ -87,11 +87,13 @@ impl MaterializedViewHandler for RealMaterializedViewHandler {
                 ErrorCode::Internal("materialized view refresh requires QueryContext".to_string())
             })?;
 
-        // Refresh consumes one source checkpoint range. Keep the same mandatory non-waiting lock
-        // across the complete lifecycle so concurrent refreshes cannot consume the same changes.
+        // Refresh consumes one source checkpoint range. Keep the mandatory non-waiting lock
+        // through the data/checkpoint commit so concurrent refreshes cannot consume the same
+        // changes. Release this guard before post-commit maintenance, which uses each
+        // operation's existing coordination mechanism.
         let locked_table_id = table.get_id();
         let table_lock = CoordinationManager::create_table_lock(table.get_table_info().clone());
-        let _lock_guard = table_lock.try_lock(query_ctx.clone(), false).await?;
+        let lock_guard = table_lock.try_lock(query_ctx.clone(), false).await?;
 
         // Reload after acquiring the lock: the table may have been replaced while lock acquisition
         // was in progress, and refresh must use the endpoint protected by this guard.
@@ -115,7 +117,11 @@ impl MaterializedViewHandler for RealMaterializedViewHandler {
         )
         .await?
         {
-            refresh.execute().await?;
+            let hooks = refresh.execute().await?;
+            drop(lock_guard);
+            if let Some(hooks) = hooks {
+                hooks.execute().await;
+            }
         }
         Ok(())
     }
```

**File**: `src/query/ee/src/materialized_view/refresh.rs` (modified, +15/-11)
```diff
@@ -57,8 +57,9 @@ use databend_enterprise_materialized_view::get_materialized_view_handler;
 use databend_meta_client::types::MatchSeq;
 use databend_query::interpreters::InsertInterpreter;
 use databend_query::interpreters::MutationInterpreter;
+use databend_query::interpreters::PostCommitHooks;
 use databend_query::interpreters::QueryFinishHooks;
-use databend_query::interpreters::execute_commit_statement;
+use databend_query::interpreters::commit_transaction;
 use databend_query::schedulers::ServiceQueryExecutor;
 use databend_query::sessions::QueryContext;
 use databend_query::sessions::TableContextSettings;
@@ -709,7 +710,7 @@ impl<'a> MaterializedViewRefresh<'a> {
         ])
     }
 
-    async fn execute_refresh(&self) -> Result<()> {
+    async fn execute_refresh(&self) -> Result<Option<PostCommitHooks>> {
         let strategy = self.plan_refresh_strategy().await?;
         if let Some(statement) = match &strategy {
             RefreshStrategy::CheckpointOnly => None,
@@ -742,11 +743,12 @@ impl<'a> MaterializedViewRefresh<'a> {
                 )
                 .await?;
         }
-        execute_commit_statement(self.ctx.clone()).await?;
-        Ok(())
+        commit_transaction(self.ctx.clone()).await
     }
 
-    pub async fn execute(&self) -> Result<()> {
+    /// Commit the refresh and checkpoint while the handler holds the lifecycle lock.
+    /// The handler dispatches the returned hooks only after releasing that lock.
+    pub async fn execute(&self) -> Result<Option<PostCommitHooks>> {
         let txn_mgr = self.ctx.txn_mgr();
         if txn_mgr.lock().is_active() {
             return Err(ErrorCode::InvalidOperation(
@@ -755,12 +757,14 @@ impl<'a> MaterializedViewRefresh<'a> {
         }
         txn_mgr.lock().begin();
 
-        if let Err(error) = self.execute_refresh().await {
-            // execute_commit_statement() clears the transaction itself once entered. This
-            // explicit clear covers planning and refresh failures before commit starts.
-            txn_mgr.lock().clear();
-            return Err(error);
+        match self.execute_refresh().await {
+            Ok(hooks) => Ok(hooks),
+            Err(error) => {
+                // commit_transaction() clears the transaction itself once entered. This
+                // explicit clear covers planning and refresh failures before commit starts.
+                txn_mgr.lock().clear();
+                Err(error)
+            }
         }
-        Ok(())
     }
 }
```

**File**: `src/query/service/src/interpreters/common/mod.rs` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ pub use materialized_view::check_materialized_view_license;
 pub use notification::get_notification_client_config;
 pub use query_log::InterpreterQueryLog;
 pub use stream::build_update_stream_reqs;
+pub(crate) use table::check_expected_table_id;
 pub use table::check_referenced_computed_columns;
 pub use table::stored_computed_column_references;
 pub use util::check_deduplicate_label;
```

**File**: `src/query/service/src/interpreters/common/table.rs` (modified, +13/-0)
```diff
@@ -22,6 +22,19 @@ use databend_common_sql::parse_computed_expr;
 
 use crate::sessions::TableContext;
 
+/// Check table identity before planning or executing automatic maintenance.
+pub(crate) fn check_expected_table_id(actual_id: u64, expected_id: Option<u64>) -> Result<()> {
+    if let Some(expected_id) = expected_id {
+        if actual_id != expected_id {
+            return Err(ErrorCode::InvalidOperation(format!(
+                "Maintenance target changed: expected table id {}, found table id {}",
+                expected_id, actual_id,
+            )));
+        }
+    }
+    Ok(())
+}
+
 pub fn check_referenced_computed_columns(
     ctx: Arc<dyn TableContext>,
     schema: DataSchemaRef,
```

**File**: `src/query/service/src/interpreters/hook/analyze_hook.rs` (modified, +40/-94)
```diff
@@ -17,18 +17,16 @@ databend_common_tracing::register_module_tag!("[ANALYZE-HOOK]");
 
 use std::sync::Arc;
 
-use databend_common_base::runtime::GlobalIORuntime;
 use databend_common_catalog::cache_policy::CachePolicy;
 use databend_common_catalog::table::Table;
 use databend_common_exception::Result;
-use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
 use databend_common_storages_fuse::FuseTable;
 use databend_common_storages_fuse::operations::AnalyzeOptions;
 use log::info;
 use log::warn;
 
-use crate::interpreters::hook::resolve_current_table_name_by_id;
+use crate::interpreters::hook::table_hook_task::TableHookTask;
 use crate::interpreters::hook::table_id_matches_target;
 use crate::pipelines::executor::ExecutorSettings;
 use crate::pipelines::executor::PipelineCompleteExecutor;
@@ -37,82 +35,52 @@ use crate::sessions::TableContextCachePolicy;
 use crate::sessions::TableContextPartitionStats;
 use crate::sessions::TableContextSettings;
 use crate::sessions::TableContextTableAccess;
-use crate::sessions::TableContextTableManagement;
 
-pub struct AnalyzeDesc {
-    pub catalog: String,
-    pub database: String,
-    pub table: String,
-    pub table_id: Option<u64>,
-}
-
-/// Hook analyze action with a on-finished callback.
-/// errors (if any) are ignored.
-pub async fn hook_analyze(ctx: Arc<QueryContext>, pipeline: &mut Pipeline, desc: AnalyzeDesc) {
-    if pipeline.is_empty() {
-        return;
-    }
-
-    pipeline.set_on_finished(move |info: &ExecutionInfo| {
-        if info.res.is_ok() {
-            let _ = GlobalIORuntime::instance().block_on(execute_analyze_hook(ctx, desc));
+impl TableHookTask {
+    pub(super) async fn execute_analyze(&self) {
+        // Maintenance after the write: `CachePolicy::MAINTENANCE` for its reads, on the context
+        // of the write, whose own reads are done by now.
+        self.ctx
+            .set_cache_policy(self.ctx.cache_policy().at_most(CachePolicy::MAINTENANCE));
+        info!("Table hook starting analyze job");
+        if !self.ctx.get_enable_auto_analyze() {
+            return;
         }
-        Ok(())
-    });
-}
-
-pub(crate) fn analyze_after_write_enabled(ctx: &Arc<QueryContext>) -> bool {
-    ctx.get_enable_auto_analyze()
-}
-
-pub(crate) async fn execute_analyze_hook(ctx: Arc<QueryContext>, desc: AnalyzeDesc) -> Result<()> {
-    // Maintenance after the write: `CachePolicy::MAINTENANCE` for its reads, on the context of
-    // the write, whose own reads are done by now.
-    ctx.set_cache_policy(ctx.cache_policy().at_most(CachePolicy::MAINTENANCE));
-    info!("Table hook starting analyze job");
-    if !analyze_after_write_enabled(&ctx) {
-        return Ok(());
-    }
 
-    match do_analyze(ctx, desc).await {
-        Ok(_) => {
-            info!("Analyze job completed successfully");
-        }
-        Err(e) => {
-            warn!("Analyze job failed (code {}): {}", e.code(), e);
+        match self.do_analyze(self.ctx.clone()).await {
+            Ok(_) => {
+                info!("Analyze job completed successfully");
+            }
+            Err(e) => {
+                warn!("Analyze job failed (code {}): {}", e.code(), e);
+            }
         }
     }
 
-    Ok(())
-}
-
-/// hook the analyze action with a on-finished callback.
-pub(crate) async fn do_analyze(ctx: Arc<QueryContext>, desc: AnalyzeDesc) -> Result<()> {
-    let Some(desc) = resolve_analyze_desc(&ctx, desc).await? else {
-        return Ok(());
-    };
-
-    // evict the table from cache
-    ctx.evict_table_from_cache(&desc.catalog, &desc.database, &desc.table)?;
-    ctx.clear_table_meta_timestamps_cache();
-
-    let table = ctx
-        .get_table(&desc.catalog, &desc.database, &desc.table)
-        .await?;
-    if !table_id_matches_target(
-        "analyze",
-        desc.table_id,
-        table.get_id(),
-        &desc.catalog,
-        &desc.database,
-        &desc.table,
-    ) {
-        return Ok(());
+    async fn do_analyze(&self, ctx: Arc<QueryContext>) -> Result<()> {
+        let Some(desc) = self.target.resolve(&ctx, "analyze").await? else {
+            return Ok(());
+        };
+
+        // Reuse the table freshly loaded and ID-checked by this stage's resolution.
+        let table = ctx
+            .get_table(&desc.catalog, &desc.database, &desc.table)
+            .await?;
+        if !table_id_matches_target(
+            "analyze",
+            Some(desc.table_id),
+            table.get_id(),
+            &desc.catalog,
+            &desc.database,
+            &desc.table,
+        ) {
+            return Ok(());
+        }
+        let fuse_table = FuseTable::try_from_table(table.as_ref())?;
+        let options =
+            AnalyzeOptions::from_table_options(fuse_table.get_table_info().options())?.no_scan();
+        execute_analyze(ctx, fuse_table, options).await
     }
-    let fuse_table = FuseTable::try_from_table(table.as_ref())?;
-    let options =
-        Ana
```

**File**: `src/query/service/src/interpreters/hook/compact_hook.rs` (modified, +94/-156)
```diff
@@ -18,14 +18,12 @@ databend_common_tracing::register_module_tag!("[COMPACT-HOOK]");
 use std::sync::Arc;
 use std::time::Instant;
 
-use databend_common_base::runtime::GlobalIORuntime;
 use databend_common_catalog::cache_policy::CachePolicy;
 use databend_common_catalog::lock::LockTableOption;
 use databend_common_catalog::table::CompactionLimits;
 use databend_common_exception::Result;
 use databend_common_meta_app::schema::is_materialized_view_engine;
 use databend_common_pipeline::core::ExecutionInfo;
-use databend_common_pipeline::core::Pipeline;
 use databend_common_pipeline::core::always_callback;
 use databend_common_sql::optimizer::ir::SExpr;
 use databend_common_sql::plans::MaintenanceTarget;
@@ -39,7 +37,8 @@ use crate::interpreters::OptimizeCompactBlockInterpreter;
 use crate::interpreters::ReclusterTableInterpreter;
 use crate::interpreters::common::metrics_inc_compact_hook_compact_time_ms;
 use crate::interpreters::common::metrics_inc_compact_hook_main_operation_time_ms;
-use crate::interpreters::hook::resolve_current_table_name_by_id;
+use crate::interpreters::hook::table_hook_task::TableHookTarget;
+use crate::interpreters::hook::table_hook_task::TableHookTask;
 use crate::interpreters::hook::table_id_matches_target;
 use crate::interpreters::hook::vacuum_hook::hook_clear_m_cte_temp_table;
 use crate::interpreters::hook::vacuum_hook::hook_disk_temp_dir;
@@ -54,62 +53,6 @@ use crate::sessions::TableContextSettings;
 use crate::sessions::TableContextTableAccess;
 use crate::sessions::TableContextTableManagement;
 
-#[derive(Clone)]
-pub struct CompactTargetTableDescription {
-    pub catalog: String,
-    pub database: String,
-    pub table: String,
-    pub table_id: Option<u64>,
-}
-
-pub struct CompactHookTraceCtx {
-    pub start: Instant,
-    pub operation_name: String,
-}
-
-/// Hook compact action with a on-finished callback.
-/// errors (if any) are ignored.
-pub async fn hook_compact(
-    ctx: Arc<QueryContext>,
-    pipeline: &mut Pipeline,
-    compact_target: CompactTargetTableDescription,
-    trace_ctx: CompactHookTraceCtx,
-    lock_opt: LockTableOption,
-) {
-    let op_name = trace_ctx.operation_name.clone();
-    if let Err(e) = do_hook_compact(ctx, pipeline, compact_target, trace_ctx, lock_opt).await {
-        info!("Operation {} failed with error (ignored): {}", op_name, e);
-    }
-}
-
-/// hook the compact action with a on-finished callback.
-async fn do_hook_compact(
-    ctx: Arc<QueryContext>,
-    pipeline: &mut Pipeline,
-    compact_target: CompactTargetTableDescription,
-    trace_ctx: CompactHookTraceCtx,
-    lock_opt: LockTableOption,
-) -> Result<()> {
-    if pipeline.is_empty() {
-        return Ok(());
-    }
-
-    pipeline.set_on_finished(move |info: &ExecutionInfo| {
-        if info.res.is_ok() {
-            let _ = GlobalIORuntime::instance().block_on(execute_compact_hook(
-                ctx,
-                compact_target,
-                trace_ctx,
-                lock_opt,
-            ));
-        }
-
-        Ok(())
-    });
-
-    Ok(())
-}
-
 pub(crate) fn compact_after_write_enabled(ctx: &Arc<QueryContext>) -> bool {
     match ctx.get_settings().get_enable_compact_after_write() {
         Ok(false) => {
@@ -128,82 +71,94 @@ pub(crate) fn compact_after_write_enabled(ctx: &Arc<QueryContext>) -> bool {
     }
 }
 
-pub(crate) async fn execute_compact_hook(
-    ctx: Arc<QueryContext>,
-    compact_target: CompactTargetTableDescription,
-    trace_ctx: CompactHookTraceCtx,
-    lock_opt: LockTableOption,
-) -> Result<()> {
-    // Maintenance after the write: `CachePolicy::MAINTENANCE` for its reads, on the context of
-    // the write, whose own reads are done by now.
-    ctx.set_cache_policy(ctx.cache_policy().at_most(CachePolicy::MAINTENANCE));
-    let op_name = &trace_ctx.operation_name;
-    let Some(compact_target) = resolve_compact_target(&ctx, compact_target).await? else {
-        return Ok(());
-    };
-
-    metrics_inc_compact_hook_main_operation_time_ms(
-        op_name,
-        trace_ctx.start.elapsed().as_millis() as u64,
-    );
-    info!("Operation {op_name} completed successfully, starting table optimization job.");
-
-    let compact_start_at = Instant::now();
-    let compaction_num_block_hint = ctx.get_compaction_num_block_hint(&compact_target.table);
-    info!(
-        "Table {} requires compaction of {} blocks",
-        compact_target.table, compaction_num_block_hint
-    );
-    if compaction_num_block_hint == 0 {
-        return Ok(());
-    }
-    let compaction_limits = CompactionLimits {
-        segment_limit: None,
-        block_limit: Some(compaction_num_block_hint as usize),
-    };
-
-    // keep the original progress value
-    let write_progress = ctx.get_write_progress();
-    let write_progress_value = write_progress.as_ref().get_values();
-    let scan_progress = ctx.get_scan_progress();
-    let scan_progress_value = scan_progress.as_ref().get_values();
-
-    match compact_table(ctx, compac
```

**File**: `src/query/service/src/interpreters/hook/hook.rs` (modified, +180/-107)
```diff
@@ -18,26 +18,28 @@ databend_common_tracing::register_module_tag!("[TABLE-HOOK]");
 use std::sync::Arc;
 use std::time::Instant;
 
+use databend_common_base::runtime::GlobalIORuntime;
 use databend_common_catalog::lock::LockTableOption;
+use databend_common_exception::Result;
 use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
 use databend_common_pipeline::core::SharedLockGuard;
 use databend_common_pipeline::core::always_callback;
 use databend_common_sql::executor::physical_plans::MutationKind;
+use databend_storages_common_session::TxnTableHook;
 use log::warn;
 
-use crate::interpreters::hook::analyze_hook::AnalyzeDesc;
-use crate::interpreters::hook::analyze_hook::hook_analyze;
-use crate::interpreters::hook::compact_hook::CompactHookTraceCtx;
-use crate::interpreters::hook::compact_hook::CompactTargetTableDescription;
 use crate::interpreters::hook::compact_hook::compact_after_write_enabled;
-use crate::interpreters::hook::compact_hook::hook_compact;
-use crate::interpreters::hook::refresh_hook::RefreshDesc;
-use crate::interpreters::hook::refresh_hook::hook_refresh;
 use crate::interpreters::hook::table_hook_scheduler::TableHookScheduler;
-use crate::interpreters::hook::table_hook_scheduler::TableHookTask;
-use crate::interpreters::hook::table_hook_scheduler::TableHookTaskSettings;
+use crate::interpreters::hook::table_hook_task::TableHookTarget;
+use crate::interpreters::hook::table_hook_task::TableHookTask;
+use crate::interpreters::hook::table_hook_task::TableHookTaskSettings;
 use crate::sessions::QueryContext;
+use crate::sessions::TableContext;
+use crate::sessions::TableContextCluster;
+use crate::sessions::TableContextPartitionStats;
+use crate::sessions::TableContextQueryInfo;
+use crate::sessions::TableContextSession;
 use crate::sessions::TableContextTableAccess;
 
 /// Register the release point of a handed-over table lock on the finished-callback chain.
@@ -46,7 +48,7 @@ use crate::sessions::TableContextTableAccess;
 /// still run under the lock, callbacks registered after it run without the lock. An always
 /// callback is added as a safety net in case an earlier callback failed and interrupted the
 /// normal chain. Both are no-ops once the guard has been taken.
-pub(crate) fn register_lock_release(pipeline: &mut Pipeline, lock_guard: &SharedLockGuard) {
+fn register_lock_release(pipeline: &mut Pipeline, lock_guard: &SharedLockGuard) {
     let guard = lock_guard.clone();
     pipeline.set_on_finished(move |_info: &ExecutionInfo| {
         drop(guard.try_take());
@@ -109,24 +111,101 @@ impl HookOperator {
 
     /// Execute the hook operator.
     /// The hook operator will:
-    /// 1. Compact if needed.
-    /// 2. Refresh aggregating index if needed.
-    /// 3. Refresh virtual columns if needed.
+    /// 1. Compact/recluster if needed.
+    /// 2. Refresh indexes if needed.
+    /// 3. Analyze if needed.
     #[fastrace::trace]
     #[async_backtrace::framed]
     pub async fn execute(&self, pipeline: &mut Pipeline) {
-        if TableHookScheduler::is_async_enabled() {
-            self.execute_async(pipeline).await;
+        if pipeline.is_empty() {
+            return;
+        }
+        if self.ctx.txn_mgr().lock().is_active() {
+            // Preserve the statement's lock lifetime, but never execute or enqueue automatic
+            // maintenance until the user transaction has actually committed.
+            self.release_lock_guard(pipeline);
+            self.defer_until_commit(pipeline).await;
             return;
         }
+        let is_async = TableHookScheduler::is_async_enabled();
+        let lock_opt = if is_async {
+            // Async hooks acquire maintenance locks where required. Release the statement lock
+            // before the success callback enqueues the task, even if task creation fails.
+            self.release_lock_guard(pipeline);
+            LockTableOption::LockWithRetry
+        } else {
+            self.lock_opt.clone()
+        };
+        if let Some(mut task) = self.create_task(lock_opt).await {
+            if !is_async {
+                task.lock_guard = self.lock_guard.clone();
+            }
+            pipeline.set_on_finished(move |info: &ExecutionInfo| {
+                if info.res.is_ok() {
+                    if is_async {
+                        enqueue_table_hook(task);
+                    } else {
+                        GlobalIORuntime::instance()
+                            .block_on(async move {
+                                task.execute(is_async).await;
+                                Ok::<_, databend_common_exception::ErrorCode>(())
+                            })
+                            .unwrap_or_else(|e| warn!("Table hook execution failed: {e}"));
+                    }
+                }
+                Ok(())
+            });
+        }
+        if !is_async {
+            // Successful tasks release the lock before analyze. Keep the callback-chain
```

**File**: `src/query/service/src/interpreters/hook/mod.rs` (modified, +16/-3)
```diff
@@ -16,6 +16,7 @@ pub(crate) mod analyze_hook;
 pub(crate) mod compact_hook;
 pub(crate) mod refresh_hook;
 pub(crate) mod table_hook_scheduler;
+pub(crate) mod table_hook_task;
 pub(crate) mod vacuum_hook;
 
 #[allow(clippy::module_inception)]
@@ -25,14 +26,17 @@ use std::sync::Arc;
 
 use databend_common_exception::Result;
 pub use hook::HookOperator;
+pub(crate) use hook::execute_deferred_table_hooks;
 use log::info;
 use log::warn;
 pub use table_hook_scheduler::TableHookScheduler;
 
+use crate::interpreters::common::check_expected_table_id;
 use crate::sessions::QueryContext;
 use crate::sessions::TableContextTableAccess;
 use crate::sessions::TableContextTableManagement;
 
+/// Adapt the shared identity check to the hooks' log-and-skip behavior.
 pub(crate) fn table_id_matches_target(
     hook_name: &str,
     expected_table_id: Option<u64>,
@@ -45,7 +49,7 @@ pub(crate) fn table_id_matches_target(
         return true;
     };
 
-    if expected_table_id == actual_table_id {
+    if check_expected_table_id(actual_table_id, Some(expected_table_id)).is_ok() {
         return true;
     }
 
@@ -73,6 +77,12 @@ pub(crate) async fn resolve_current_table_name_by_id(
         return Ok(Some((database.to_string(), table.to_string())));
     };
 
+    // Most hooks still target the original name. Refresh and verify it first so the
+    // common path needs no ID-to-name lookup and leaves a current table in the cache.
+    if table_id_exists_in_database(ctx, catalog_name, database, table, table, table_id).await? {
+        return Ok(Some((database.to_string(), table.to_string())));
+    }
+
     let catalog = ctx.get_catalog(catalog_name).await?;
     let Some(current_table_name) = catalog.get_table_name_by_id(table_id).await? else {
         warn!(
@@ -169,14 +179,17 @@ async fn table_id_exists_in_database(
     expected_table_id: u64,
 ) -> Result<bool> {
     ctx.evict_table_from_cache(catalog_name, database, original_table)?;
-    ctx.evict_table_from_cache(catalog_name, database, current_table_name)?;
+    if current_table_name != original_table {
+        ctx.evict_table_from_cache(catalog_name, database, current_table_name)?;
+    }
     ctx.clear_table_meta_timestamps_cache();
 
     match ctx
         .get_table(catalog_name, database, current_table_name)
         .await
     {
-        Ok(table) => Ok(table.get_id() == expected_table_id),
+        // A mismatch is a failed name candidate, not a resolver error.
+        Ok(table) => Ok(check_expected_table_id(table.get_id(), Some(expected_table_id)).is_ok()),
         Err(_) => Ok(false),
     }
 }
```

---

### Incident Patch 2: `831d9dc3` (2026-11-10)
**Commit Message**: fix(storage): serve cached bloom filters without loading index meta (#20877)

* perf(storage): serve cached bloom filters without loading index meta

load_bloom_filter_by_columns always resolved the bloom index meta before
consulting the filter cache. The meta cache is bounded by item count, so
a scan touching more blocks than that misses it on every query, and a
miss reads the index file (whole file below parquet_fast_read_bytes)
even when every requested filter is still cached.

Probe the filter cache for all requested columns first and return them
in request order (duplicates removed) when all are cached; otherwise
fall back to the existing meta / index file path.

* fix(storage): probe only the in-memory bloom filter cache tier

A hit in the on-disk tier of the hybrid cache is a synchronous file read
and decode. The fast path runs on the pruning thread, so leave such
filters to the full load path, which reads them on the I/O runtime.

* fix(storage): skip disk tier re-population on the bloom fast path

Re-populating the on-disk tier serializes the filter, which should not
run on the pruning thread. The full load path still re-populates it.

* fix(storage): address fable review 

**File**: `src/query/storages/fuse/src/io/read/bloom/block_filter_reader.rs` (modified, +165/-0)
```diff
@@ -109,6 +109,14 @@ pub async fn load_bloom_filter_by_columns<'a>(
     index_length: u64,
     policy: CachePolicy,
 ) -> Result<BlockFilter> {
+    // 0. Fast path: every requested filter is already cached. Serving them
+    // straight from the filter cache needs neither the index meta nor the
+    // index file, so a miss in the (count bounded) meta cache does not turn
+    // into a remote read of the index file on every query.
+    if let Some(block_filter) = load_cached_bloom_filters(index_path, column_needed, policy) {
+        return Ok(block_filter);
+    }
+
     let whole_file =
         prepare_bloom_index_read_source(&dal, settings, index_path, index_length, policy).await?;
 
@@ -187,6 +195,51 @@ pub async fn load_bloom_filter_by_columns<'a>(
     })
 }
 
+/// Returns the requested filters when all of them are present in the
+/// in-memory tier of the bloom filter cache, `None` otherwise (including when
+/// the cache is disabled).
+///
+/// The lookups follow `policy`: when it does not read the memory cache, every
+/// lookup misses and the request takes the full load path. Only the memory
+/// cache is probed; this runs on the caller's thread and does no I/O.
+///
+/// The returned filters keep the order of `column_needed` with duplicates
+/// removed, so callers that rewrite the index (e.g. ngram index refresh) get
+/// a deterministic column order.
+///
+/// A column that carries no filter in this index is never cached, so such a
+/// request falls through to the full load path, which keeps the behaviour of
+/// silently omitting it. As a consequence, a block whose index skipped one of
+/// the requested columns never takes this fast path: the bloom index builder
+/// emits no filter for a column with fewer than 2 distinct values in the
+/// block (e.g. constant or all-NULL) or for an over-long string column, while
+/// the pruner still asks for it by the table schema.
+fn load_cached_bloom_filters(
+    index_path: &str,
+    column_needed: &[String],
+    policy: CachePolicy,
+) -> Option<BlockFilter> {
+    if column_needed.is_empty() {
+        return None;
+    }
+    let cache = FuseCaches::instance().bloom_filters.with_policy(policy);
+    let mut seen = HashSet::with_capacity(column_needed.len());
+    let mut fields = Vec::with_capacity(column_needed.len());
+    let mut filters = Vec::with_capacity(column_needed.len());
+    for name in column_needed {
+        if !seen.insert(name) {
+            continue;
+        }
+        let filter = cache.lookup(&BloomColumnFilterReader::cache_key(index_path, name))?;
+        fields.push(TableField::new(name, TableDataType::Binary));
+        filters.push(Arc::clone(&filter));
+    }
+    Some(BlockFilter {
+        filter_schema: Arc::new(TableSchema::new(fields)),
+        filters,
+    })
+}
+
 /// Loads bytes and index of the given column.
 /// read data from cache, or populate cache items if possible
 #[fastrace::trace]
@@ -384,6 +437,7 @@ mod tests {
     use databend_storages_common_index::BloomIndexBuilder;
     use databend_storages_common_index::BloomIndexType;
     use databend_storages_common_index::filters::BlockFilter;
+    use databend_storages_common_index::filters::Filter;
     use databend_storages_common_index::filters::Xor8Filter;
     use databend_storages_common_table_meta::meta::Versioned;
     use databend_storages_common_table_meta::table::TableCompression;
@@ -585,4 +639,115 @@ mod tests {
         assert_eq!(block_filter.filters.len(), 1);
         Ok(())
     }
+
+    /// Cached filters must be served without touching the index meta or the
+    /// index file: a miss in the meta cache (bounded by item count) used to
+    /// trigger a remote read of the index file on every query even though the
+    /// requested filters were still cached.
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_cached_filters_do_not_need_meta_or_index_file() -> Result<()> {
+        init_test_globals()?;
+
+        let (data, filter_name) = write_bloom_index_bytes()?;
+        let operator = opendal::Operator::via_iter(opendal::Scheme::Memory, [])?;
+        let path = "bloom_index_cached_only";
+        operator.write(path, data.clone()).await?;
+
+        let caches = FuseCaches::instance();
+        let filter_cache = &caches.bloom_filters;
+        assert!(
+            filter_cache.is_enabled(),
+            "filter cache must be enabled in test globals"
+        );
+        caches.index_metas.bloom.evict(path);
+        let filter_key = BloomColumnFilterReader::cache_key(path, &filter_name);
+        filter_cache.evict(&filter_key);
+
+        let settings = ReadSettings {
+            max_gap_size: 0,
+            max_range_size: 0,
+            parquet_fast_read_bytes: data.len() as u64,
+        };
+
+        // Warm the filter cache.
+        load_bloom_filter_by_columns(
+            operator.clone(),
+            &settings,
+            &[filter_name.clone()],
+            path,
+            data.len() as u
```

**File**: `src/query/storages/fuse/src/io/read/bloom/column_filter_reader.rs` (modified, +6/-1)
```diff
@@ -47,6 +47,11 @@ pub struct BloomColumnFilterReader {
 }
 
 impl BloomColumnFilterReader {
+    /// Cache key of the filter of `filter_name` inside the index file at `index_path`.
+    pub fn cache_key(index_path: &str, filter_name: &str) -> String {
+        format!("{index_path}-{filter_name}")
+    }
+
     pub fn new(
         index_path: String,
         column_ordinal: BloomIndexColumnOrdinal,
@@ -56,7 +61,7 @@ impl BloomColumnFilterReader {
         schema_desc: SchemaDescPtr,
         policy: CachePolicy,
     ) -> Self {
-        let cache_key = format!("{index_path}-{filter_name}");
+        let cache_key = Self::cache_key(&index_path, filter_name);
 
         let SingleColumnMeta {
             offset,
```

**File**: `src/query/storages/fuse/src/io/read/bloom/mod.rs` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ pub mod block_filter_reader;
 mod column_filter_reader;
 
 pub use block_filter_reader::BloomBlockFilterReader;
+pub(crate) use column_filter_reader::BloomColumnFilterReader;
 
 /// Position of a column inside one bloom index file (`BloomIndexMeta::columns`).
 ///
```

**File**: `src/query/storages/fuse/src/operations/table_index/processors/transform_assemble_indexes.rs` (modified, +2/-1)
```diff
@@ -49,6 +49,7 @@ use crate::io::BloomIndexState;
 use crate::io::SpatialIndexBuilder;
 use crate::io::SpatialIndexResult;
 use crate::io::TableMetaLocationGenerator;
+use crate::io::read::bloom::BloomColumnFilterReader;
 use crate::io::read::bloom::block_filter_reader::load_bloom_filter_by_columns;
 use crate::io::read::load_spatial_index_files;
 use crate::io::read::load_vector_index_meta;
@@ -282,7 +283,7 @@ impl AssembleIndexes {
         block.ngram_filter_index_size = state.ngram_size();
         let old_filter_keys = old_ngram_names
             .iter()
-            .map(|name| format!("{path}-{name}"))
+            .map(|name| BloomColumnFilterReader::cache_key(&path, name))
             .collect();
         BlockWriter::rewrite_bloom_index_state(&self.operator, state, old_filter_keys).await?;
         Ok(())
```

---

### Incident Patch 3: `c7539c57` (2026-11-10)
**Commit Message**: fix(query): preserve result page order after polling timeout (#21019)

* fix(query): preserve result page order after polling timeout

Select queued memory or spilled pages before the partial current page under one buffer lock when long polling expires. Preserve cancellation-safe spill restoration outside the buffer lock.

Add deterministic ordering and cancellation regressions, HTTP pagination tests, and a bounded result-spill TLA+ model with a shared, opt-in nox runner.

* fix

**File**: `src/query/service/src/servers/http/v1/query/sized_spsc.rs` (modified, +135/-4)
```diff
@@ -12,6 +12,11 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+//! Sized SPSC result channel with memory buffering and spill/restore.
+//!
+//! A bounded TLA+ model of this channel's protocol is maintained in
+//! `tests/nox/tla/result_spill/ResultSpill.tla`.
+
 use std::cmp::min;
 use std::collections::VecDeque;
 use std::fmt::Debug;
@@ -431,7 +436,7 @@ where S: DataBlockSpill
                     }
                     Err(_) => {
                         debug!("Long polling timeout reached");
-                        if let Some(page) = self.try_take_current_page().await? {
+                        if let Some(page) = self.try_take_page_after_timeout().await? {
                             return Ok((page, self.chan.is_close()));
                         }
                         return Ok((BlocksSerializer::empty(), self.chan.is_close()));
@@ -453,9 +458,16 @@ where S: DataBlockSpill
         self.deserialize_page(page).await
     }
 
-    #[fastrace::trace(name = "SizedChannelReceiver::try_take_current_page")]
-    async fn try_take_current_page(&mut self) -> Result<Option<BlocksSerializer>> {
-        let page = self.chan.buffer.lock().unwrap().take_current_page();
+    #[fastrace::trace(name = "SizedChannelReceiver::try_take_page_after_timeout")]
+    async fn try_take_page_after_timeout(&mut self) -> Result<Option<BlocksSerializer>> {
+        let page = {
+            let mut buffer = self.chan.buffer.lock().unwrap();
+            // A producer may have queued an earlier page after recv timed out.
+            // Select the queued page or partial page under the same lock.
+            buffer
+                .prepare_page_read()
+                .or_else(|| buffer.take_current_page())
+        };
         self.deserialize_page(page).await
     }
 
@@ -848,6 +860,125 @@ mod tests {
         send_task.await.unwrap();
     }
 
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_timeout_preserves_page_order() {
+        for enable_spill in [false, true] {
+            let (mut sender, mut receiver) = sized_spsc::<MockSpiller>(4, 4);
+            let spiller = enable_spill.then(MockSpiller::default);
+            sender.plan_ready(OutputFormatSettings::default(), spiller);
+
+            // Deterministically pause at the timeout/fallback boundary: recv
+            // observed an empty queue, then the producer publishes full pages
+            // and a partial page before the fallback acquires the buffer lock.
+            assert!(
+                tokio::time::timeout_at(tokio::time::Instant::now(), receiver.chan.recv())
+                    .await
+                    .is_err()
+            );
+            let rows = if enable_spill { 9 } else { 5 };
+            let values = (1..=rows).collect::<Vec<i32>>();
+            assert!(
+                sender
+                    .send(DataBlock::new_from_columns(vec![Int32Type::from_data(
+                        values.clone(),
+                    )]))
+                    .await
+                    .unwrap()
+            );
+            if enable_spill {
+                assert!(matches!(
+                    receiver.chan.buffer.lock().unwrap().pages.get(1),
+                    Some(Page::Spilled(_))
+                ));
+            }
+
+            for expected in values.chunks(4) {
+                let page = receiver
+                    .try_take_page_after_timeout()
+                    .await
+                    .unwrap()
+                    .unwrap();
+                let expected = expected
+                    .iter()
+                    .map(|value| vec![value.to_string()])
+                    .collect::<Vec<_>>();
+                assert_eq!(
+                    serde_json::to_value(&page).unwrap(),
+                    serde_json::json!(expected),
+                    "spill enabled: {enable_spill}"
+                );
+            }
+            assert!(
+                receiver
+                    .try_take_page_after_timeout()
+                    .await
+                    .unwrap()
+                    .is_none()
+            );
+
+            sender.finish();
+            let (page, is_end) = receiver.next_page(&Wait::Async).await.unwrap();
+            assert!(page.is_empty());
+            assert!(is_end);
+            assert_eq!(receiver.close().is_some(), enable_spill);
+        }
+    }
+
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_timeout_spilled_page_survives_cancelled_restore() {
+        let (_sender, mut receiver) = sized_spsc::<BlockingRestoreSpiller>(4, 4);
+        let block = DataBlock::new_from_columns(vec![Int32Type::from_data(vec![1, 2, 3, 4])]);
+        let (spiller, location) = BlockingRestoreSpiller::with_page("spilled_page", block);
+        let restore_started = spiller.restore_started.clone();
+
+        assert!(
+            tokio::time::timeout_at(tokio::time::Instant::now(), receiver.chan.recv())
+
```

**File**: `tests/nox/noxfile.py` (modified, +37/-0)
```diff
@@ -2,6 +2,7 @@
 import os
 import platform
 import shutil
+import sys
 import tarfile
 import tempfile
 import time
@@ -12,6 +13,8 @@
 
 import nox
 
+# nox also loads this file via --noxfile from outside tests/nox.
+sys.path.insert(0, str(Path(__file__).resolve().parent))
 
 PYTHON_DRIVER_PINNED = ["0.33.6"]
 PYTHON_DRIVER = ["latest", *PYTHON_DRIVER_PINNED]
@@ -572,6 +575,40 @@ def go_client(session, source_ref):
         session.run(*make_args, external=True, env=merge_env(env))
 
 
+def prepare_tlc():
+    # Keep TLA imports local: release testsuites do not include the tla package.
+    from tla import run as tla_runner
+
+    target = tla_runner.cached_jar(CACHE_DIR)
+    if target.exists():
+        tla_runner.verify_jar(target)
+        return target
+
+    target.parent.mkdir(parents=True, exist_ok=True)
+    with tempfile.TemporaryDirectory(dir=target.parent) as directory:
+        staged = download_file(tla_runner.TLC_URL, Path(directory) / target.name)
+        tla_runner.verify_jar(staged)
+        staged.replace(target)
+    return target
+
+
+@nox.session(python=False, default=False)
+def tla(session):
+    """Check a TLA+ model: nox -s tla -- <model-dir> [--case NAME]."""
+    from tla import run as tla_runner
+
+    args = list(session.posargs)
+    if args and not any(arg in args for arg in ("--list", "--help", "-h")):
+        jar = prepare_tlc()
+        args = ["--jar", str(jar), *args]
+    session.run(
+        sys.executable,
+        str(Path(tla_runner.__file__).resolve()),
+        *args,
+        external=True,
+    )
+
+
 # test API with requests directly.
 # some of the tests will fail with cluster behind nginx.
 # so run it in .github/actions/test_stateful_cluster_linux/action.yml.
```

**File**: `tests/nox/suites/http_handler/test_result_spill.py` (modified, +54/-11)
```diff
@@ -1,11 +1,13 @@
-import requests
 import time
 
+import pytest
+import requests
+
 auth = ("root", "")
 
 
 def do_query(query, session, pagination):
-    url = f"http://localhost:8000/v1/query"
+    url = "http://localhost:8000/v1/query"
     payload = {
         "sql": query,
     }
@@ -17,7 +19,7 @@ def do_query(query, session, pagination):
         "Content-Type": "application/json",
     }
 
-    response = requests.post(url, headers=headers, json=payload, auth=auth)
+    response = requests.post(url, headers=headers, json=payload, auth=auth, timeout=10)
     return response.json()
 
 
@@ -35,20 +37,20 @@ def test_disable_result_spill():
         "max_rows_per_page": 4,
     }
     resp = do_query("select * from numbers(97)", session=session, pagination=pagination)
-    assert resp["error"] == None
+    assert resp["error"] is None
 
     # print(resp["state"])
     # print(resp["stats"])
 
     rows = len(resp["data"])
     for _ in range(30):
-        if resp.get("next_uri") == None:
+        if resp.get("next_uri") is None:
             break
 
         uri = f"http://localhost:8000/{resp['next_uri']}"
         resp = requests.get(uri, auth=auth).json()
         cur_rows = len(resp["data"])
-        assert resp["error"] == None, resp
+        assert resp["error"] is None, resp
         if rows < 96:
             assert cur_rows == 4
         rows += cur_rows
@@ -57,11 +59,52 @@ def test_disable_result_spill():
         # print(resp["stats"])
 
         # get same page again
-        assert requests.get(uri, auth=auth).json()["error"] == None, resp
+        assert requests.get(uri, auth=auth).json()["error"] is None, resp
 
     assert rows == 97
 
 
+@pytest.mark.parametrize("enable_spill", ["0", "1"])
+def test_result_spill_ordered_pagination(enable_spill):
+    session = {
+        "settings": {
+            "enable_result_set_spilling": enable_spill,
+            "max_block_size": "10",
+            "max_threads": "2",
+        }
+    }
+    pagination = {
+        "wait_time_secs": 0,
+        "max_rows_in_buffer": 4,
+        "max_rows_per_page": 4,
+    }
+    resp = do_query(
+        "select number from numbers(97) order by number",
+        session=session,
+        pagination=pagination,
+    )
+    values = []
+    deadline = time.monotonic() + 30
+    while True:
+        assert resp["error"] is None, resp
+        values.extend(int(row[0]) for row in resp["data"])
+        assert values == list(range(len(values)))
+        if resp.get("next_uri") is None:
+            break
+        assert time.monotonic() < deadline, resp
+        if not resp["data"]:
+            time.sleep(0.01)
+        uri = f"http://localhost:8000/{resp['next_uri'].lstrip('/')}"
+        resp = requests.get(uri, auth=auth, timeout=10).json()
+        # Retrying a non-empty page must return the same ordered data.
+        if resp["data"]:
+            retry = requests.get(uri, auth=auth, timeout=10).json()
+            assert retry["error"] is None, retry
+            assert retry["data"] == resp["data"]
+
+    assert values == list(range(97))
+
+
 def test_enable_result_spill():
     session = {
         "settings": {
@@ -76,26 +119,26 @@ def test_enable_result_spill():
         "max_rows_per_page": 4,
     }
     resp = do_query("select * from numbers(97)", session=session, pagination=pagination)
-    assert resp["error"] == None
+    assert resp["error"] is None
 
     time.sleep(1)
 
     rows = len(resp["data"])
     for _ in range(30):
-        if resp.get("next_uri") == None:
+        if resp.get("next_uri") is None:
             break
 
         uri = f"http://localhost:8000/{resp['next_uri']}"
         resp = requests.get(uri, auth=auth).json()
         cur_rows = len(resp["data"])
-        assert resp["error"] == None, resp
+        assert resp["error"] is None, resp
         if rows < 96:
             assert cur_rows == 4
         rows += cur_rows
 
         assert resp["state"] == "Succeeded"
 
         # get same page again
-        assert requests.get(uri, auth=auth).json()["error"] == None, resp
+        assert requests.get(uri, auth=auth).json()["error"] is None, resp
 
     assert rows == 97
```

**File**: `tests/nox/tla/README.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+# Local TLA+ checks
+
+Shared runner and TLC dependency preparation for model directories containing `model.json` and `<Module>.tla`. Requirements: Python 3.10+, nox, Java 11+ (`PATH` or `JAVA_HOME`). No Databend build or running service is needed.
+
+```sh
+cd tests/nox
+nox -s tla -- tla/result_spill --list
+nox -s tla -- tla/result_spill
+nox -s tla -- tla/result_spill --case batch_deadline
+```
```

**File**: `tests/nox/tla/result_spill/ResultSpill.tla` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+-------------------------- MODULE ResultSpill --------------------------
+EXTENDS Naturals, Sequences, FiniteSets, TLC
+
+CONSTANTS Pages, MaxInterrupts, DeadlineReads, KeepUntilRestored, BatchFullPages,
+          QueueFirstAfterTimeout
+VARIABLES p, queue, tail, disk, layouts, stopped, r, delivered, lastPage,
+          publishedDuringFallback
+vars == <<p, queue, tail, disk, layouts, stopped, r, delivered, lastPage,
+          publishedDuringFallback>>
+Ids == 1..Pages
+Entries == [id : Ids, kind : {"memory", "spill"}]
+SeqIds(s) == {s[i] : i \in 1..Len(s)}
+QueueIds == {queue[i].id : i \in 1..Len(queue)}
+MemoryPages == Cardinality({i \in 1..Len(queue) : queue[i].kind = "memory"})
+OneOrEmpty(n) == IF n = 0 THEN {} ELSE {n}
+
+Init ==
+    /\ p = [next |-> 1, pending |-> 0, stage |-> "idle"]
+    /\ queue = <<>> /\ tail = 0 /\ disk = {} /\ layouts = {}
+    /\ stopped = FALSE
+    /\ r = [pc |-> "idle", page |-> 0, interrupts |-> 0, cancelledPage |-> 0,
+             fromFallback |-> FALSE]
+    /\ delivered = <<>> /\ lastPage = 0
+    /\ publishedDuringFallback = FALSE
+
+\* One full page per producer input; the last input is a partial page.
+\* Capacity is one full in-memory page; spilled pages count as zero.
+BufferMemory ==
+    /\ ~BatchFullPages
+    /\ p.stage = "idle" /\ p.next < Pages /\ MemoryPages = 0
+    /\ queue' = Append(queue, [id |-> p.next, kind |-> "memory"])
+    /\ p' = [p EXCEPT !.next = @ + 1]
+    /\ UNCHANGED <<tail, disk, layouts, stopped, r, delivered, lastPage,
+                    publishedDuringFallback>>
+
+\* A single input containing two full pages enters try_add_block's loop:
+\* first page queued and second detached under ONE buffer lock. This case
+\* matches a 9-row block with page_rows=max_rows=4 (partial tail follows).
+BufferBatch ==
+    /\ BatchFullPages /\ Pages = 3
+    /\ p.stage = "idle" /\ p.next = 1
+    /\ queue' = <<[id |-> 1, kind |-> "memory"]>>
+    /\ p' = [next |-> 3, pending |-> 2, stage |-> "writing"]
+    /\ UNCHANGED <<tail, disk, layouts, stopped, r, delivered, lastPage,
+                    publishedDuringFallback>>
+
+DetachForSpill ==
+    /\ p.stage = "idle" /\ p.next < Pages /\ MemoryPages = 1
+    /\ p' = [p EXCEPT !.pending = p.next, !.next = @ + 1, !.stage = "writing"]
+    /\ UNCHANGED <<queue, tail, disk, layouts, stopped, r, delivered, lastPage,
+                    publishedDuringFallback>>
+
+\* The write await completes before layout registration and queue publication.
+SpillWritten ==
+    /\ p.stage = "writing"
+    /\ disk' = disk \cup {p.pending}
+    /\ p' = [p EXCEPT !.stage = "written"]
+    /\ UNCHANGED <<queue, tail, layouts, stopped, r, delivered, lastPage,
+                    publishedDuringFallback>>
+
+RegisterLayout ==
+    /\ p.stage = "written"
+    /\ layouts' = layouts \cup {p.pending}
+    /\ p' = [p EXCEPT !.stage = "registered"]
+    /\ UNCHANGED <<queue, tail, disk, stopped, r, delivered, lastPage,
+                    publishedDuringFallback>>
+
+PublishSpill ==
+    /\ p.stage = "registered"
+    /\ queue' = Append(queue, [id |-> p.pending, kind |-> "spill"])
+    /\ p' = [p EXCEPT !.pending = 0, !.stage = "idle"]
+    /\ publishedDuringFallback' = (publishedDuringFallback \/ r.pc = "fallback")
+    /\ UNCHANGED <<tail, disk, layouts, stopped, r, delivered, lastPage>>
+
+BufferTail ==
+    /\ p.stage = "idle" /\ p.next = Pages /\ tail = 0
+    /\ tail' = p.next
+    /\ p' = [p EXCEPT !.next = @ + 1]
+    /\ UNCHANGED <<queue, disk, layouts, stopped, r, delivered, lastPage,
+                    publishedDuringFallback>>
+
+Finish ==
+    /\ p.stage = "idle" /\ p.next = Pages + 1
+    /\ queue' = IF tail = 0 THEN queue
+                 ELSE Append(queue, [id |-> tail, kind |-> "memory"])
+    /\ tail' = 0 /\ stopped' = TRUE
+    /\ p' = [p EXCEPT !.stage = "done"]
+    /\ UNCHANGED <<disk, layouts, r, delivered, lastPage, publishedDuringFallback>>
+
+ObserveEmpty ==
+    /\ r.pc = "idle" /\ Len(queue) = 0 /\ ~stopped
+    /\ r' = [r EXCEPT !.pc = "waiting"]
+    /\ UNCHANGED <<p, queue, tail, disk, layouts, stopped, delivered, lastPage,
+                    publishedDuringFallback>>
+
+\* timeout polls recv first. Expiry is admitted only with an empty queue.
+\* Another OS worker can run after expiry, before take_current_page locks.
+DeadlineExpired ==
+    /\ DeadlineReads /\ r.pc = "waiting" /\ Len(queue) = 0 /\ ~stopped
+    /\ r' = [r EXCEPT !.pc = "fallback"]
+    /\ UNCHANGED <<p, queue, tail, disk, layouts, stopped, delivered, lastPage,
+                    publishedDuringFallback>>
+
+\* The fixed fallback selects queued pages first under the SAME buffer lock.
+\* Mutation QueueFirstAfterTimeout=FALSE restores the old unchecked take.
+TakePartialAfterTimeout ==
+    /\ r.pc = "fallback"
+    /\ (~QueueFirstAfterTimeout \/ Len(queue) = 0)
+    /\ delivered' = IF tail = 0 THEN delivered ELSE Append(delivered, tail)
+    /\ lastPage' = IF tail = 0 THEN lastPage ELSE tail
+    /\ tail
```

**File**: `tests/nox/tla/result_spill/model.json` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+{
+  "module": "ResultSpill",
+  "constants": {"Pages": 3, "MaxInterrupts": 1, "DeadlineReads": false, "KeepUntilRestored": true, "BatchFullPages": false, "QueueFirstAfterTimeout": true},
+  "invariants": ["TypeOK", "NoPageLoss", "OrderedDelivery", "NoDuplicates", "ReadableSpills", "CacheMatchesLast"],
+  "matrix": {"Pages": [2, 3], "DeadlineReads": [false, true]},
+  "cases": {
+    "batch_async": {"constants": {"BatchFullPages": true}},
+    "batch_deadline": {"constants": {"BatchFullPages": true, "DeadlineReads": true}},
+    "mutation_partial_before_queue": {
+      "constants": {"DeadlineReads": true, "BatchFullPages": true, "QueueFirstAfterTimeout": false},
+      "violation": "OrderedDelivery"
+    },
+    "mutation_pop_before_restore": {
+      "constants": {"KeepUntilRestored": false},
+      "violation": "NoPageLoss"
+    },
+    "witness_cancel_then_retry": {"witness": "NeverCancelledRetry"},
+    "witness_spill_during_timeout_fallback": {
+      "constants": {"DeadlineReads": true, "BatchFullPages": true},
+      "witness": "NeverSpillDuringFallback"
+    },
+    "witness_fallback_restore_preserves_tail": {
+      "constants": {"DeadlineReads": true, "BatchFullPages": true},
+      "witness": "NeverFallbackRestoreWithTail"
+    }
+  },
+  "scope": [
+    "Single producer and receiver; 2 or 3 page tokens with unique locations. All but last input are full pages; last input is partial. This is a concrete subset of permitted producer inputs, not a general model of row slicing.",
+    "One full memory page capacity (page_rows=max_rows); spilled pages have zero in-memory row accounting. This matches legal HTTP pagination configuration. BatchFullPages=true makes first two full pages one atomic try_add_block call, matching the native nine-row input reproduction; final partial row appended after spill publication.",
+    "Producer full-page try_add_block is atomic under buffer mutex. Spill write, layout registration and queue publication are split. File writes are assumed successful and persistent; crashes/partial writes, codec corruption and cleanup are not checked.",
+    "Last partial page is current_page until finish or deadline fallback. Empty terminal pages are elided because they contain no result rows. BufferTail abstracts an append smaller than a full page.",
+    "Restore may fail or be cancelled at its await at most MaxInterrupts times in total; retry is allowed. Restore has no destructive side effects (SpillerInner::read_spilled_file).",
+    "Deadline expiry only occurs after recv observes an empty queue. Producer can run on another OS thread between timeout completion and the fallback buffer lock; no invented await is needed.",
+    "Successful memory extraction/restore commit through page-manager cache are collapsed: there is no await on this suffix and a single receiver owns the page_manager mutex. Producer may append independently; this does not change the consumed identity.",
+    "Page order, non-duplication, retained page availability and published spill readability are safety properties. No liveness, end-of-stream signaling, HTTP transport retry policy, spill write failure/abort, close/cleanup race, leak freedom, or memory-byte bound is claimed.",
+    "Close excluded: it intentionally discards results; actual HttpQuery::kill serializes it with get_page using page_manager mutex. No fabricated close/restore race.",
+    "Fixed fallback atomically selects queued memory/spill if present, else partial current_page under one buffer mutex. TakePartialAfterTimeout's empty-queue guard and fallback-enabled TakeMemory/BeginRestore are alternatives of this SAME locked selection, not separate check/use actions. QueueFirstAfterTimeout=false disables this actual protection for mutation control.",
+    "fromFallback is diagnostic history only: it enables a witness that spilled restore occurs from timeout fallback while a later partial page remains. It neither guards safety actions nor prunes schedules.",
+    "Matrix includes DeadlineReads=true to investigate ordering rather than assume fallback FIFO. Any normal-case failure must be triaged against source; do not weaken OrderedDelivery to get a pass."
+  ],
+  "source_map": {
+    "BufferMemory,BufferBatch,DetachForSpill,BufferTail": "src/query/service/src/servers/http/v1/query/sized_spsc.rs::SizedChannelBuffer::try_add_block; PageBuilder::try_append_block",
+    "SpillWritten": "src/query/service/src/spillers/inner.rs::SpillerInner::write_encodes; spill_unmanage",
+    "RegisterLayout": "src/query/service/src/spillers/inner.rs::SpillerInner::spill; src/query/service/src/spillers/adapter.rs::LiteAdapter::add_spill_file",
+    "PublishSpill": "src/query/service/src/servers/http/v1/query/sized_spsc.rs::SizedChannelSender::send; SizedChannelBuffer::try_add_page",
+    "Finish": "src/query/service/src/servers/http/v1/query/sized_spsc.rs::SizedChannelSender::finish",
+    "ObserveEmpty": "src/query/service/src/servers/http/v1/query/siz
```

**File**: `tests/nox/tla/run.py` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+#!/usr/bin/env python3
+"""Check a TLA+ model directory locally with a verified TLC jar."""
+
+import argparse
+import hashlib
+import itertools
+import json
+import os
+import re
+import shutil
+import subprocess
+import sys
+import tempfile
+import time
+from pathlib import Path
+
+# v1.8.0 and rolling are mutable master-build releases; use the stable release.
+TLC_VERSION = "1.7.4"
+TLC_SHA256 = "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"
+TLC_URL = (
+    f"https://github.com/tlaplus/tlaplus/releases/download/v{TLC_VERSION}/tla2tools.jar"
+)
+CACHE_DIR = Path(__file__).resolve().parents[1] / "cache"
+CASE_NAME = re.compile(r"[\w-]+")
+CASE_KEYS = {"constants", "invariants", "violation", "witness"}
+
+
+def literal(value):
+    if isinstance(value, bool):
+        return str(value).upper()
+    if isinstance(value, int):
+        return str(value)
+    if isinstance(value, str) and re.fullmatch(r'[^"\\\n]*', value):
+        return f'"{value}"'
+    raise ValueError(f"Unsupported TLA constant: {value!r}")
+
+
+def cases(spec):
+    """Expand the matrix and named cases into {name: (constants, invariants, expected)}."""
+    for key in ("module", "constants", "invariants"):
+        if key not in spec:
+            raise ValueError(f"model.json is missing '{key}'")
+    defaults = spec["constants"]
+    if not spec["invariants"]:
+        raise ValueError("model.json needs at least one invariant")
+    matrix = spec.get("matrix", {})
+    if matrix.keys() - defaults.keys() or any(not v for v in matrix.values()):
+        raise ValueError("Matrix keys must be declared constants with nonempty domains")
+    result = {}
+    for values in itertools.product(*matrix.values()):
+        overrides = dict(zip(matrix, values, strict=True))
+        name = ",".join(f"{k}={label(v)}" for k, v in overrides.items()) or "default"
+        result[name] = (defaults | overrides, list(spec["invariants"]), None)
+    for name, case in spec.get("cases", {}).items():
+        if not CASE_NAME.fullmatch(name) or name in result:
+            raise ValueError(f"Invalid or duplicate case name: {name}")
+        if case.keys() - CASE_KEYS:
+            raise ValueError(
+                f"Unknown options in case {name}: {sorted(case.keys() - CASE_KEYS)}"
+            )
+        overrides = case.get("constants", {})
+        if overrides.keys() - defaults.keys():
+            raise ValueError(f"Undeclared constants in case {name}")
+        if "witness" in case and ("violation" in case or "invariants" in case):
+            raise ValueError(f"A witness keeps the default invariants: {name}")
+        invariants = list(case.get("invariants", spec["invariants"]))
+        expected = case.get("violation", case.get("witness"))
+        if "witness" in case:
+            invariants.append(expected)
+        if expected and expected not in invariants:
+            raise ValueError(f"Expected invariant is not checked in case {name}")
+        result[name] = (defaults | overrides, invariants, expected)
+    return result
+
+
+def label(value):
+    if not isinstance(value, str):
+        return literal(value)
+    if not re.fullmatch(r"[\w.-]+", value):
+        raise ValueError(f"Matrix string values must be simple names: {value!r}")
+    return value
+
+
+def config_text(constants, invariants):
+    if not invariants:
+        raise ValueError("At least one invariant is required")
+    return "\n".join(
+        [
+            "CONSTANTS",
+            *(f"    {name} = {literal(value)}" for name, value in constants.items()),
+            "INIT Init",
+            "NEXT Next",
+            "CHECK_DEADLOCK FALSE",
+            "INVARIANTS " + " ".join(invariants),
+            "",
+        ]
+    )
+
+
+def verdict(code, text, expected):
+    """Normal cases need a complete search; controls need exactly the expected violation."""
+    errors = [line for line in text.splitlines() if line.startswith("Error:")]
+    if expected:
+        return (
+            code == 12
+            and errors
+            == [
+                f"Error: Invariant {expected} is violated.",
+                "Error: The behavior up to this point is:",
+            ]
+            and "State 1:" in text
+        )
+    return (
+        code == 0
+        and not errors
+        and "Model checking completed. No error has been found." in text
+        and re.search(
+            r"(?m)^\d+ states generated, \d+ distinct states found, 0 states left on queue\.$",
+            text,
+        )
+        is not None
+    )
+
+
+def cached_jar(cache_dir=CACHE_DIR):
+    return cache_dir / "tlc" / TLC_SHA256 / f"tla2tools-{TLC_VERSION}.jar"
+
+
+def verify_jar(path):
+    digest = hashlib.sha256(path.read_bytes()).hexdigest()
+    if digest != TLC_SHA256:
+        raise ValueError(
+            f"SHA-256 mismatch for {path}: expected {TLC_SHA256}, got {digest}"
+        )
+
+
+def find_java(explicit):
+    if explicit:
+        ret
```

**File**: `tests/nox/tla/test_runner.py` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+"""Offline runner/dependency tests; subprocesses and downloads are mocked, not TLC."""
+
+import contextlib
+import hashlib
+import io
+import json
+import subprocess
+import tempfile
+import unittest
+from pathlib import Path
+from types import SimpleNamespace
+from unittest import mock
+
+import noxfile
+
+from tla import run
+
+SUCCESS = (
+    "Model checking completed. No error has been found.\n"
+    "10 states generated, 8 distinct states found, 0 states left on queue.\n"
+)
+TRACE = (
+    "Error: Invariant Safe is violated.\n"
+    "Error: The behavior up to this point is:\nState 1: <Initial predicate>\n"
+)
+SPEC = {
+    "module": "Model",
+    "constants": {"N": 1, "Flag": True, "Mode": "fast"},
+    "invariants": ["Safe"],
+    "matrix": {"N": [1, 2], "Mode": ["fast", "slow"]},
+    "cases": {
+        "no_flag": {"constants": {"Flag": False}, "violation": "Safe"},
+        "reachable": {"witness": "NeverDone"},
+    },
+}
+
+
+class RunnerTests(unittest.TestCase):
+    def test_verdict_rejects_incomplete_or_wrong_failure(self):
+        for code, text, expected, passed in [
+            (0, SUCCESS, None, True),
+            (0, "Starting...", None, False),
+            (0, SUCCESS.replace("0 states left", "10 states left"), None, False),
+            (-9, SUCCESS, None, False),
+            (12, TRACE, "Safe", True),
+            (0, TRACE, "Safe", False),
+            (1, TRACE, "Safe", False),
+            (12, TRACE, "Other", False),
+            (12, TRACE, None, False),
+            (12, TRACE.replace("State 1:", "No trace:"), "Safe", False),
+            (12, TRACE + "Error: Unexpected exception\n", "Safe", False),
+        ]:
+            with self.subTest(code=code, text=text, expected=expected):
+                self.assertEqual(run.verdict(code, text, expected), passed)
+
+    def test_matrix_mutation_and_witness(self):
+        generated = run.cases(SPEC)
+        self.assertEqual(len(generated), 6)
+        self.assertIn("N=2,Mode=slow", generated)
+        constants, invariants, expected = generated["reachable"]
+        self.assertEqual((invariants, expected), (["Safe", "NeverDone"], "NeverDone"))
+        self.assertFalse(generated["no_flag"][0]["Flag"])
+        text = run.config_text(constants, invariants)
+        for line in [
+            "Flag = TRUE",
+            'Mode = "fast"',
+            "INVARIANTS Safe NeverDone",
+            "CHECK_DEADLOCK FALSE",
+        ]:
+            self.assertIn(line, text)
+
+    def test_invalid_specs(self):
+        for spec in [
+            {k: v for k, v in SPEC.items() if k != "module"},
+            {**SPEC, "invariants": []},
+            {**SPEC, "matrix": {"Unknown": [1]}},
+            {**SPEC, "matrix": {"N": []}},
+            {**SPEC, "matrix": {"Mode": ["a/b"]}},
+            {**SPEC, "cases": {"bad name": {}}},
+            {**SPEC, "cases": {"x": {"typo": 1}}},
+            {**SPEC, "cases": {"x": {"constants": {"Unknown": 1}}}},
+            {**SPEC, "cases": {"x": {"witness": "W", "invariants": []}}},
+            {**SPEC, "cases": {"x": {"violation": "Other"}}},
+        ]:
+            with self.subTest(spec=spec), self.assertRaises(ValueError):
+                run.cases(spec)
+        for value in [1.5, None, 'quote"d', [1]]:
+            with self.subTest(value=value), self.assertRaises(ValueError):
+                run.literal(value)
+
+    def test_list_needs_no_java_or_jar(self):
+        with tempfile.TemporaryDirectory() as directory:
+            model = Path(directory)
+            (model / "model.json").write_text(json.dumps(SPEC))
+            output = io.StringIO()
+            with (
+                mock.patch.object(run.subprocess, "run") as execute,
+                mock.patch.object(run, "verify_jar") as verify,
+                contextlib.redirect_stdout(output),
+            ):
+                self.assertEqual(run.main([str(model), "--list"]), 0)
+            execute.assert_not_called()
+            verify.assert_not_called()
+            self.assertEqual(len(output.getvalue().splitlines()), 6)
+
+    def test_timeout_fails(self):
+        with tempfile.TemporaryDirectory() as directory:
+            args = SimpleNamespace(java="unused", timeout=1, workers=1)
+            with (
+                mock.patch.object(
+                    run.subprocess,
+                    "run",
+                    side_effect=subprocess.TimeoutExpired("tlc", 1),
+                ),
+                contextlib.redirect_stdout(io.StringIO()),
+            ):
+                self.assertFalse(
+                    run.run_case(args, Path("x.jar"), Path(directory), "M", None)
+                )
+
+    def test_selected_models_have_separate_cache_outputs(self):
+        with tempfile.TemporaryDirectory() as directory:
+            root = Path(directory)
+            jar = root / "tools.jar"
+            jar.write_bytes(b"verified in dependency tests")
+            cache = root / "cache"
+        
```

#### Recent Merged Pull Requests:
- **PR #21060** (2026-11-11): fix(query): break rank limit ties by the remaining group keys (@zhang2014)
- **PR #21052** (2026-11-11): fix(storage): cut recluster output at the table block thresholds (@zhang2014)
- **PR #21050** (closed): feat(query): bound what a statement writes to the table data cache (@bohutang)
- **PR #21049** (2026-11-10): fix(query): reject cyclic named window references (@KKould)
- **PR #21048** (2026-11-10): fix(query): guard expression parsing against stack exhaustion (@KKould)
- **PR #21047** (2026-11-10): fix(query): reject MVs on tables with row access or masking policies (@TCeason)

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

## X. query): defer transaction maintenance until after commit (#21020)

**RULE**:
When implementing operations in `src/query/ee/src/materialized_view/handler.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cbbeaa8c`: query): defer transaction maintenance until after commit (#21020). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/ee/src/materialized_view/handler.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // Refresh consumes one source checkpoint range. Keep the mandatory non-waiting lock
        // through the data/checkpoint commit so concurrent refreshes cannot consume the same
        // changes. Release this guard before post-commit maintenance, which uses each
        // operation's existing coordination mechanism.
        let lock_guard = table_lock.try_lock(query_ctx.clone(), false).await?;
            let hooks = refresh.execute().await?;
            drop(lock_guard);
            if let Some(hooks) = hooks {
                hooks.execute().await;
            }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        // Refresh consumes one source checkpoint range. Keep the same mandatory non-waiting lock
        // across the complete lifecycle so concurrent refreshes cannot consume the same changes.
        let _lock_guard = table_lock.try_lock(query_ctx.clone(), false).await?;
            refresh.execute().await?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cbbeaa8c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
