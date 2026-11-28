# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: apache-maka-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "apache-maka-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T04:39:21.639Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-maka-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-maka-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T04:39:21.639Z`  
> **Learning ID**: `LEARN-EVO-apache-maka-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: B (Product Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 74%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from apache-maka-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-maka-learnings.md`  
> **Source**: github ([https://github.com/apache/maka](https://github.com/apache/maka))  
> **Source Version**: `9c051de3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T04:38:39.494Z  
> **Learning ID**: `learn-github-apache-maka`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): apache/maka

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-maka-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/maka](https://github.com/apache/maka))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T04:38:39.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/maka`
- **Description**: Apache Maka (Incubating) is a high-performance agent workspace that keeps a complete record of everything it did.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 6015 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `platform/computer-use/src/desktop/worker.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! Private, parent-owned desktop worker. There is no listener or reconnect path.
mod callbacks;
mod connection;
#[cfg(all(target_os = "macos", feature = "native-desktop"))]
mod macos;
pub(in crate::desktop) mod preview;
#[cfg(all(target_os = "macos", feature = "native-desktop"))]
pub(crate) use macos::{MacRole, macos_finite};
#[cfg(feature = "native-desktop")]
mod epochs;
#[cfg(all(target_os = "windows", feature = "native-desktop"))]
pub(crate) mod native_owner;
pub(in crate::desktop) use connection::{AudioObservation, Connection};
#[cfg(feature = "native-desktop")]
use epochs::serve;

use super::failed;
#[cfg(feature = "native-desktop")]
use super::local_platform;
#[cfg(feature = "native-desktop")]
use crate::Driver;
use crate::{BrowserAccess, protocol::Command};
use maka_agent_facts::tools::{NativeToolError, ToolError};
use maka_capabilities::computer::BrowserConnection;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
#[cfg(feature = "native-desktop")]
use std::sync::Arc;
use std::{
    io,
    path::PathBuf,
    process::{ExitCode, Stdio},
    time::Duration,
};
#[cfg(feature = "native-desktop")]
use tokio::sync::Mutex;
#[cfg(feature = "native-desktop")]
use tokio::sync::mpsc;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout},
};
use tokio_util::sync::CancellationToken;

const ENTRY: &str = "__maka-cua-desktop";
const PROTOCOL: u32 = 5;
const STARTUP_TIMEOUT: Duration = Duration::from_secs(15);
const EXIT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Hello {
    protocol: u32,
    platform: String,
    audio_enabled: bool,
}

#[cfg(any(test, all(target_os = "windows", feature = "native-desktop")))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(tag = "step", rename_all = "snake_case", deny_unknown_fields)]
pub(crate) enum NativePresentStep {
    ReadFrame,
    SetFrame {
        #[serde(deserialize_with = "crate::protocol::deserialize_numbers")]
        x: f64,
        #[serde(deserialize_with = "crate::protocol::deserialize_numbers")]
        y: f64,
        #[serde(deserialize_with = "crate::protocol::deserialize_numbers")]
        width: f64,
        #[serde(deserialize_with = "crate::protocol::deserialize_numbers")]
        height: f64,
    },
    Raise,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case", deny_unknown_fields)]
pub(crate) enum Request {
    PreviewWatch {
        owner: String,
        epoch: String,
        session: String,
        after: Option<u64>,
    },
    PreviewRead {
        owner: String,
        epoch: String,
        session: String,
        target: crate::preview::PreviewTarget,
        pixels: bool,
    },
    PreviewPresent {
        owner: String,
        epoch: String,
        session: String,
        target: crate::preview::PreviewTarget,
        #[serde(deserialize_with = "crate::protocol::deserialize_numbers")]
        area: crate::preview::PresentationArea,
    },
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    NativePresent {
        key: native_owner::NativeKey,
        generation: String,
        binding: crate::ComputerAppBinding,
        step: NativePresentStep,
    },
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    NativeInvoke {
        key: native_owner::NativeKey,
        operation: native_owner::NativeOperation,
        operation_id: Option<String>,
        arguments: Value,
        coordinate_frame: native_owner::NativeCoordinateFrame,
        language: maka_agent_facts::language::Language,
    },
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    NativeDiscardAudio {
        key: native_owner::NativeKey,
        output: Option<PathBuf>,
    },
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    NativeRetire {
        key: native_owner::NativeKey,
    },
    Invoke {
        app_target: Option<crate::ComputerAppTarget>,
        owner: String,
        epoch: String,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        #[serde(default)]
        operation_id: Option<String>,
        #[serde(default)]
        native_observer_available: bool,
        browsers: Vec<BrowserConnection>,
        #[serde(default, skip_serializing_if = "no_preparation_policy")]
        preparation_policy: crate::BrowserPreparationPolicy,
        command: Box<Command>,
        language: maka_agent_facts::language::Language,
    },
    LeaseChild {
        owner: String,
        epoch: String,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        operation_id: String,
        browsers: Vec<BrowserConnection>,
        #[serde(default, skip_serializing_if = "no_preparation_policy")]
        preparation_policy: crate::BrowserPreparationPolicy,
        request: crate::BrowserLeaseChildRequest,
        language: maka_agent_facts::language::Language,
    },
    CloseEpoch {
        owner: String,
        epoch: String,
    },
    CloseOwner {
        owner: String,
    },
    DiscardAudio {
        owner: String,
        epoch: String,
    },
    FinishTurn {
        owner: String,
        epoch: String,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        language: maka_agent_facts::language::Language,
    },
    FinishOwnerTurn {
        owner: String,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        language: maka_agent_facts::language::Language,
    },
    Shutdown,
}

fn no_preparation_policy(policy: &crate::BrowserPreparationPolicy) -> bool {
    !policy.popup_enabled && policy.headers.is_empty()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "message", rename_all = "snake_case")]
enum Failure {
    Failed(String),
    Native(Box<NativeToolError>),
    OutcomeUnknown(String),
    CleanupUnconfirmed(String),
}
impl From<ToolError> for Failure {
    fn from(error: ToolError) -> Self {
        match error {
            ToolError::Failed(message) => Self::Failed(message),
            ToolError::Native(error) => Self::Native(error),
            ToolError::OutcomeUnknown(message) | ToolError::OperationUnknown { message, .. } => {
                Self::OutcomeUnknown(message)
            }
            ToolError::OperationCleanupUnconfirmed { message, .. }
            | ToolError::CleanupUnconfirmed(message)
            | ToolError::Persistence(message) => Self::CleanupUnconfirmed(message),
            ToolError::Io { message, .. } => Self::Failed(message),
        }
    }
}
impl From<Failure> for ToolError {
    fn from(error: Failure) -> Self {
        match error {
            Failure::Failed(message) => Self::Failed(message),
            Failure::Native(error) => Self::Native(error),
            Failure::OutcomeUnknown(message) => Self::OutcomeUnknown(message),
            Failure::CleanupUnconfirmed(message) => Self::CleanupUnconfirmed(message),
        }
    }
}
type Response = Result<Value, Failure>;

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum ParentFrame {
    BrowserCallback {
        message: Box<callbacks::ParentMessage>,
    },
    Request {
        id: u64,
        request: Box<Request>,
    },
    Cancel {
        id: u64,
    },
    BrowserAuthorizationResult {
        id: u64,
        authorization_id: u64,
        result: Result<(), Failure>,
    },
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum WorkerFrame {
    PreviewAuthorization {
        id: u64,
        authorization_id: u64,
        request: preview::AuthorizationRequest,
    },
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    NativeInterruption {
        key: native_owner::NativeKey,
        operation_id: Option<String>,
    },
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    NativeRetired {
        key: native_owner::NativeKey,
        result: Result<(), Failure>,
    },
    BrowserCallback {
        message: callbacks::WorkerMessage,
    },
    Response {
        id: u64,
        result: Response,
    },
    AudioFinished {
        id: u64,
        result: Result<(), Failure>,
    },
    BrowserAuthorization {
        id: u64,
        authorization_id: u64,
        mode: AuthorizationMode,
        access: BrowserAccess,
    },
    BrowserSessionPreparationAuthorization {
        id: u64,
        authorization_id: u64,
        mode: AuthorizationMode,
        identity: callbacks::ScopeIdentity,
        preparation: crate::BrowserSessionPreparation,
    },
}

fn callback_identity(request: &Request) -> Option<callbacks::ScopeIdentity> {
    match request {
        Request::Invoke {
            owner,
            epoch,
            session,
            turn,
            execution,
            operation_id: Some(operation_id),
            ..
        } if !operation_id.is_empty() => Some(callbacks::
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/callbacks.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! Metadata callbacks over the existing desktop worker frames.
//!
//! The owner must call `disconnect` on wire loss and retain these objects while
//! `has_unsettled` is true. No callback creates an authorization or an executor.
//! A wire sender only enqueues a frame, without inline callbacks or reentry;
//! its error means that frame was not queued locally. Short metadata critical
//! sections order Prepared/Seal/Released; no Host method is called under them.

use super::{AuthorizationMode, Failure};
use crate::invocation::{
    AuthorizationFuture, BrowserAccess, BrowserAttachmentAuthorization, BrowserAttachmentOrigin,
    BrowserAuthorization, BrowserEffectScope, BrowserHostEffects, BrowserPreparationBinding,
    CheckedSettlementFuture, HostEffectFuture, HostUncertaintyFuture, OperationSettlement,
};
#[cfg(feature = "native-desktop")]
use crate::invocation::{BrowserServices, HostEffectFactory, SettlementFuture};
#[cfg(feature = "native-desktop")]
use crate::invocation::{BrowserServicesFuture, BrowserServicesProvider};
use futures_util::FutureExt;
use maka_agent_facts::tools::ToolError;
use serde::{Deserialize, Serialize};
#[cfg(feature = "native-desktop")]
use std::sync::{Weak, atomic::AtomicBool};
use std::{
    collections::{HashMap, HashSet},
    future::Future,
    panic::AssertUnwindSafe,
    pin::Pin,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    task::{Context, Poll, Waker},
};
use tokio::sync::mpsc;
#[cfg(feature = "native-desktop")]
use tokio::sync::{Notify, oneshot};
use tokio_util::sync::CancellationToken;

mod files;

static NEXT_SCOPE: AtomicU64 = AtomicU64::new(0);
type Rejected = Box<dyn FnOnce(ToolError) + Send>;
pub(super) type ParentSender = Arc<dyn Fn(ParentMessage) -> Result<(), ToolError> + Send + Sync>;
#[cfg(feature = "native-desktop")]
pub(super) type WorkerSender = Arc<dyn Fn(WorkerMessage) -> Result<(), ToolError> + Send + Sync>;

fn failed(message: impl Into<String>) -> ToolError {
    ToolError::Failed(message.into())
}
fn uncertain(message: impl Into<String>) -> ToolError {
    ToolError::CleanupUnconfirmed(message.into())
}
fn allocate(counter: &AtomicU64) -> Result<u64, ToolError> {
    counter
        .try_update(Ordering::SeqCst, Ordering::SeqCst, |id| id.checked_add(1))
        .map(|id| id + 1)
        .map_err(|_| failed("Browser callback identity exhausted"))
}
#[cfg(feature = "native-desktop")]
fn outcome_unknown(error: &ToolError) -> bool {
    matches!(
        error,
        ToolError::OutcomeUnknown(_)
            | ToolError::OperationUnknown { .. }
            | ToolError::CleanupUnconfirmed(_)
            | ToolError::OperationCleanupUnconfirmed { .. }
            | ToolError::Persistence(_)
    )
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ScopeIdentity {
    pub owner: String,
    pub epoch: String,
    pub session: String,
    pub turn: String,
    pub execution: crate::ExecutionCorrelation,
    pub operation_id: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ScopeKey {
    pub identity: ScopeIdentity,
    pub access: BrowserAccess,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ScopeToken {
    pub id: u64,
    pub key: ScopeKey,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ScopeGrant {
    token: ScopeToken,
    attachment: bool,
    effects: bool,
    #[serde(default)]
    lease_children: bool,
    settlement: bool,
    #[serde(default)]
    files: bool,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub(super) enum AttachmentOrigin {
    Site(String),
    Opaque,
}
impl From<BrowserAttachmentOrigin> for AttachmentOrigin {
    fn from(origin: BrowserAttachmentOrigin) -> Self {
        match origin {
            BrowserAttachmentOrigin::Site(site) => Self::Site(site),
            BrowserAttachmentOrigin::Opaque => Self::Opaque,
        }
    }
}
impl From<AttachmentOrigin> for BrowserAttachmentOrigin {
    fn from(origin: AttachmentOrigin) -> Self {
        match origin {
            AttachmentOrigin::Site(site) => Self::Site(site),
            AttachmentOrigin::Opaque => Self::Opaque,
        }
    }
}
enum AttachmentCheck {
    Origin(BrowserAttachmentOrigin),
    Metadata,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum WorkerMessage {
    FileRequest {
        token: ScopeToken,
        id: u64,
        request: files::Request,
    },
    NativeObserver {
        invocation_id: u64,
        id: u64,
        identity: ScopeIdentity,
        notice: crate::native_interruption::WireNativeNotice,
    },
    Prepare {
        invocation_id: u64,
        request_id: u64,
        key: ScopeKey,
    },
    Check {
        token: ScopeToken,
        id: u64,
        origin: AttachmentOrigin,
    },
    CheckMetadata {
        token: ScopeToken,
        id: u64,
    },
    LeaseChild {
        token: ScopeToken,
        id: u64,
        request: crate::BrowserLeaseChildRequest,
    },
    CancelCheck {
        token: ScopeToken,
        id: u64,
    },
    Effect {
        token: ScopeToken,
        id: u64,
    },
    EffectScoped {
        token: ScopeToken,
        id: u64,
    },
    CheckEffectPreparation {
        token: ScopeToken,
        id: u64,
        effect_id: u64,
        binding: BrowserPreparationBinding,
    },
    EffectFinished {
        token: ScopeToken,
        id: u64,
        result: Result<(), Failure>,
    },
    EffectDeclined {
        token: ScopeToken,
        id: u64,
        error: Failure,
    },
    EffectUncertain {
        token: ScopeToken,
        id: u64,
        error: Failure,
    },
    Retain {
        token: ScopeToken,
        id: u64,
    },
    RetainedFinished {
        token: ScopeToken,
        id: u64,
    },
    RetainedUncertain {
        token: ScopeToken,
        id: u64,
        error: Failure,
    },
    Release {
        token: ScopeToken,
    },
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum ParentMessage {
    FileResult {
        token: ScopeToken,
        id: u64,
        result: Result<files::Reply, Failure>,
    },
    NativeObserved {
        id: u64,
        identity: ScopeIdentity,
        result: Result<(), Failure>,
    },
    Prepared {
        request_id: u64,
        key: ScopeKey,
        result: Box<Result<ScopeGrant, Failure>>,
    },
    Checked {
        token: ScopeToken,
        id: u64,
        result: Result<(), Failure>,
    },
    Admit {
        token: ScopeToken,
        id: u64,
    },
    Rejected {
        token: ScopeToken,
        id: u64,
        error: Failure,
    },
    Retained {
        token: ScopeToken,
        id: u64,
        result: Result<(), Failure>,
    },
    Sealed {
        token: ScopeToken,
    },
    Released {
        token: ScopeToken,
    },
}

#[derive(Clone, Default)]
pub(super) struct ParentCapabilities {
    pub preview: Option<Arc<dyn crate::preview::PreviewAuthority>>,
    pub foreground: Option<Arc<dyn crate::preview::ForegroundAuthority>>,
    pub files: Option<Arc<dyn crate::BrowserAssetFiles>>,
    pub native_interruption: Option<Arc<dyn crate::NativeInterruptionObserver>>,
    pub authorization: Option<Arc<dyn BrowserAuthorization>>,
    pub attachment: Option<Arc<dyn BrowserAttachmentAuthorization>>,
    pub effects: Option<Arc<dyn BrowserHostEffects>>,
    pub settlement: Option<Arc<dyn OperationSettlement>>,
}
impl ParentCapabilities {
    pub(super) fn session_preparation_decision(
        &self,
        expected: Option<&ScopeIdentity>,
        observed: ScopeIdentity,
        preparation: crate::BrowserSessionPreparation,
        mode: AuthorizationMode,
        cancellation: CancellationToken,
    ) -> AuthorizationFuture {
        // Parent transport identities are distinct from the child's native
        // owner/epoch. Only the actual backend ledger can prove that ownership.
        let routing = expected
            .filter(|expected| *expected == &observed)
            .ok_or_else(|| failed("Browser session preparation invocation identity mismatch"))
            .and_then(|expected| {
                preparation.check_scope(&expected.turn, &expected.execution, &expected.operation_id)
            });
        let authorization = self.authorization.clone();
        Box::pin(async move {
            routing?;
            if cancellation.is_cancelled() {
                return Err(failed("Browser authorization cancelled"));
            }
            let authorization = authorization.ok_or_else(|| {
                failed("Browser session preparation requires current Host authorization")
            })?;
            if preparation.target == crate::BrowserPreparationTarget::Se
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/callbacks/files.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! File service messages inherit the existing callback scope and joined checks.
use super::*;
#[cfg(feature = "native-desktop")]
use crate::FilesFuture;
use crate::{BrowserAssetDirectory, BrowserAssetFiles};
#[cfg(feature = "native-desktop")]
use maka_capabilities::call::ReadResource;

/// Framing follows immutable resource ingress; no whole asset enters a frame.
const CHUNK: usize = 64 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub(crate) enum Request {
    Begin,
    UploadPrepare {
        request: crate::BrowserUploadRequest,
    },
    UploadCheck {
        request: crate::BrowserUploadRequest,
    },
    UploadRead {
        input: u64,
        index: usize,
        offset: usize,
        end: usize,
    },
    UploadRelease {
        input: u64,
    },
    WriteStart {
        directory: u64,
        name: String,
        bytes: usize,
        digest: String,
    },
    WriteChunk {
        upload: u64,
        offset: usize,
        bytes: Vec<u8>,
    },
    WriteFinish {
        upload: u64,
    },
    Commit {
        directory: u64,
    },
    Abort {
        directory: u64,
    },
}
impl Request {
    fn cleanup(&self) -> bool {
        matches!(self, Self::Abort { .. } | Self::UploadRelease { .. })
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub(crate) enum Reply {
    Directory {
        id: u64,
        path: String,
    },
    Upload {
        id: u64,
    },
    Path {
        path: String,
    },
    Done,
    Inputs {
        id: u64,
        files: Vec<InputDescriptor>,
    },
    Bytes {
        bytes: Vec<u8>,
    },
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InputDescriptor {
    name: String,
    bytes: usize,
    digest: String,
    #[serde(default)]
    modified: Option<serde_json::Value>,
}
struct Upload {
    directory: u64,
    name: String,
    expected: usize,
    digest: String,
    bytes: Vec<u8>,
}
#[derive(Default)]
pub(super) struct Custody {
    next: u64,
    directories: HashMap<u64, Box<dyn BrowserAssetDirectory>>,
    uploads: HashMap<u64, Upload>,
    inputs: HashMap<u64, Vec<crate::BrowserUploadFile>>,
}
impl Custody {
    fn id(&mut self) -> Result<u64, ToolError> {
        self.next = self
            .next
            .checked_add(1)
            .ok_or_else(|| failed("File callback identity exhausted"))?;
        Ok(self.next)
    }
    async fn execute(
        &mut self,
        files: Option<Arc<dyn BrowserAssetFiles>>,
        request: Request,
        authorization: Option<Arc<dyn BrowserAuthorization>>,
        cancellation: CancellationToken,
    ) -> Result<Reply, ToolError> {
        match request {
            Request::UploadPrepare { request } => {
                let captured = authorization
                    .ok_or_else(|| failed("Upload snapshot lost its original Host authorization"))?
                    .prepare_upload(request, cancellation)
                    .await?;
                let descriptors = captured
                    .iter()
                    .map(|file| {
                        let metadata = file.resource.metadata();
                        let digest = metadata["digest"]
                            .as_str()
                            .ok_or_else(|| failed("Upload resource has no immutable digest"))?
                            .to_owned();
                        Ok(InputDescriptor {
                            name: file.name.clone(),
                            bytes: file.resource.bytes(),
                            digest,
                            modified: metadata.get("modified").cloned(),
                        })
                    })
                    .collect::<Result<Vec<_>, ToolError>>()?;
                let id = self.id()?;
                self.inputs.insert(id, captured);
                Ok(Reply::Inputs {
                    id,
                    files: descriptors,
                })
            }
            Request::UploadCheck { request } => {
                authorization
                    .ok_or_else(|| failed("Upload check lost its original Host authorization"))?
                    .check_upload(request, cancellation)
                    .await?;
                Ok(Reply::Done)
            }
            Request::UploadRead {
                input,
                index,
                offset,
                end,
            } => {
                if end.checked_sub(offset).is_none_or(|count| count > CHUNK) {
                    return Err(failed("Invalid upload resource range"));
                }
                let file = self
                    .inputs
                    .get(&input)
                    .and_then(|files| files.get(index))
                    .ok_or_else(|| failed("Upload resource does not belong to this operation"))?;
                let bytes = file.resource.read(offset..end).map_err(failed)?;
                if bytes.len() != end - offset {
                    return Err(failed("Upload resource snapshot changed"));
                }
                Ok(Reply::Bytes { bytes })
            }
            Request::UploadRelease { input } => {
                self.inputs.remove(&input);
                Ok(Reply::Done)
            }
            Request::Begin => {
                let directory = files
                    .as_ref()
                    .ok_or_else(|| failed("Current Host file publisher is unavailable"))?
                    .begin(cancellation)
                    .await?;
                let path = directory.path().to_owned();
                let id = self.id()?;
                self.directories.insert(id, directory);
                Ok(Reply::Directory { id, path })
            }
            Request::WriteStart {
                directory,
                name,
                bytes,
                digest,
            } => {
                if !self.directories.contains_key(&directory) {
                    return Err(failed("File directory does not belong to this operation"));
                }
                let id = self.id()?;
                self.uploads.insert(
                    id,
                    Upload {
                        directory,
                        name,
                        expected: bytes,
                        digest,
                        bytes: Vec::new(),
                    },
                );
                Ok(Reply::Upload { id })
            }
            Request::WriteChunk {
                upload,
                offset,
                bytes,
            } => {
                let upload = self
                    .uploads
                    .get_mut(&upload)
                    .ok_or_else(|| failed("File upload does not belong to this operation"))?;
                if bytes.len() > CHUNK
                    || offset != upload.bytes.len()
                    || offset
                        .checked_add(bytes.len())
                        .is_none_or(|end| end > upload.expected)
                {
                    return Err(failed("File resource chunk range changed"));
                }
                if cancellation.is_cancelled() {
                    return Err(failed("File resource publication cancelled"));
                }
                upload.bytes.extend_from_slice(&bytes);
                Ok(Reply::Done)
            }
            Request::WriteFinish { upload } => {
                let upload = self
                    .uploads
                    .remove(&upload)
                    .ok_or_else(|| failed("File upload does not belong to this operation"))?;
                if upload.bytes.len() != upload.expected {
                    return Err(failed("File resource snapshot changed"));
                }
                let resource = files
                    .as_ref()
                    .ok_or_else(|| failed("Current Host file publisher is unavailable"))?
                    .snapshot(upload.name.clone(), upload.bytes)?;
                if resource.metadata()["digest"].as_str() != Some(upload.digest.as_str()) {
                    return Err(failed("File resource snapshot digest changed"));
                }
                let directory = self
                    .directories
                    .get_mut(&upload.directory)
                    .ok_or_else(|| failed("File directory does not belong to this operation"))?;
                directory
                    .write(upload.name, resource, cancellation)
                    .await
                    .map(|path| Reply::Path { path })
            }
            Request::Commit { directory } => {
                if self
                    .uploads
                    .values()
                    .any(|upload| upload.directory == directory)
                {
                    return Err(failed("File directory still has an incomplete resource"));
                }
                let directory = self
                    .directories
                    .get_mut(&directory)
                    .ok_or_else(
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/connection.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! One connection retains each original request and its authorization until settlement.

use super::callbacks::{
    CallbackFault, ParentCallbacks, ParentCapabilities, ScopeIdentity, WorkerMessage,
};
use super::{
    AuthorizationMode, BrowserAuthorizationRequest, Failure, ParentFrame, Process, Request,
    WorkerFrame, authorization_cleanup, connection_error, failed, read, write,
};
#[cfg(all(target_os = "windows", feature = "native-desktop"))]
use crate::native_interruption::own_observation as own_native_observation;
use crate::{BrowserAuthorization, protocol::Command};
use maka_agent_facts::tools::ToolError;
use serde_json::Value;
use std::{collections::HashMap, sync::Arc};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;

const WIRE_BUFFER: usize = 64;

type Completion = Result<(), ToolError>;
pub(in crate::desktop) type AudioObservation = watch::Receiver<Option<Completion>>;

#[derive(Debug)]
pub(in crate::desktop) struct Reply {
    pub(in crate::desktop) value: Value,
    pub(in crate::desktop) audio: Option<AudioObservation>,
}

#[derive(Clone)]
pub(in crate::desktop) struct Connection {
    requests: mpsc::UnboundedSender<Invocation>,
    sealed: CancellationToken,
    fault: watch::Receiver<Option<ToolError>>,
    closed: watch::Receiver<Option<CloseSettlement>>,
}

struct Invocation {
    request: Request,
    capabilities: ParentCapabilities,
    cancellation: CancellationToken,
    reply: oneshot::Sender<Result<Reply, ToolError>>,
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    native_admission: Option<tokio::sync::OwnedMutexGuard<()>>,
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    native_source: Option<NativeCallSource>,
}

struct Pending {
    native_observer: Option<Arc<dyn crate::NativeInterruptionObserver>>,
    frames: mpsc::UnboundedSender<Result<WorkerFrame, ToolError>>,
    response_received: bool,
    identity: Option<ScopeIdentity>,
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    native_retirement: Option<NativeRetirement>,
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    native_call: bool,
}

#[cfg(all(target_os = "windows", feature = "native-desktop"))]
#[derive(Clone)]
pub(super) struct NativeCallSource {
    pub key: super::native_owner::NativeKey,
    pub operation_id: Option<String>,
    pub observer: Option<Arc<dyn crate::NativeInterruptionObserver>>,
    pub binding: Option<crate::NativeBindingSource>,
}
#[cfg(all(target_os = "windows", feature = "native-desktop"))]
struct NativeRetirement {
    key: super::native_owner::NativeKey,
    source: Option<Arc<NativeCallSource>>,
}
#[cfg(all(target_os = "windows", feature = "native-desktop"))]
impl NativeRetirement {
    fn covers(&self, native: &NativeConnection) -> bool {
        self.key == native.key
            && match (&self.source, &native.observation.borrow().source) {
                (Some(retired), Some(current)) => Arc::ptr_eq(retired, current),
                (None, None) => true,
                _ => false,
            }
    }
}
#[cfg(all(target_os = "windows", feature = "native-desktop"))]
struct NativeConnection {
    key: super::native_owner::NativeKey,
    observation: watch::Sender<super::native_owner::NativeObservation>,
    generation: super::native_owner::NativeGeneration,
    interruption: Option<crate::NativeInterruption>,
    pending_observer: Option<crate::InterruptionFuture>,
    deferred: Option<Settled>,
    affected_request: Option<u64>,
}

struct NativeProxyBinding {
    invocation_id: u64,
    identity: ScopeIdentity,
    inner: crate::native_interruption::WireNativeSource,
    observer: Arc<dyn crate::NativeInterruptionObserver>,
}
enum CustodianSettlement {
    Request(Settled),
    NativeNotice {
        id: u64,
        identity: ScopeIdentity,
        result: Completion,
    },
}

struct AudioCapture {
    completion: watch::Sender<Option<Completion>>,
    start_acknowledged: bool,
}

struct Settled {
    id: u64,
    result: Result<Reply, ToolError>,
    reply: oneshot::Sender<Result<Reply, ToolError>>,
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    _native_admission: Option<tokio::sync::OwnedMutexGuard<()>>,
    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    native_source: Option<NativeCallSource>,
}

fn combine_connection_completion(transport: Completion, remainders: Completion) -> Completion {
    match (transport, remainders) {
        (Ok(()), result) | (result, Ok(())) => result,
        (Err(original), Err(cleanup)) => Err(preserve_operation_observation(
            ToolError::CleanupUnconfirmed(format!("{original}; {cleanup}")),
            original,
        )),
    }
}

impl Connection {
    pub(super) fn start(process: Process) -> Self {
        Self::start_inner(
            process,
            None,
            #[cfg(all(target_os = "windows", feature = "native-desktop"))]
            None,
        )
    }

    #[cfg(all(target_os = "windows", feature = "native-desktop"))]
    pub(super) fn start_native(
        process: Process,
        stop: CancellationToken,
        key: super::native_owner::NativeKey,
        generation: super::native_owner::NativeGeneration,
        observation: watch::Sender<super::native_owner::NativeObservation>,
    ) -> Self {
        Self::start_inner(
            process,
            Some(stop),
            Some(NativeConnection {
                key,
                observation,
                generation,
                interruption: None,
                pending_observer: None,
                deferred: None,
                affected_request: None,
            }),
        )
    }

    fn start_inner(
        mut process: Process,
        native_stop: Option<CancellationToken>,
        #[cfg(all(target_os = "windows", feature = "native-desktop"))] native: Option<
            NativeConnection,
        >,
    ) -> Self {
        let (input, output) = process
            .pipes
            .take()
            .expect("handshaken process owns its pipes");
        let (connection, mut task) = Self::channel();
        #[cfg(all(target_os = "windows", feature = "native-desktop"))]
        {
            task.native = native;
        }
        tokio::spawn(async move {
            let mut kill_failure: Option<std::io::Error> = None;
            let transport = {
                let run = task.run_wire(input, output);
                tokio::pin!(run);
                #[cfg(all(target_os = "windows", feature = "native-desktop"))]
                {
                    match native_stop {
                        Some(stop) => tokio::select! {
                            result = &mut run => result,
                            _ = stop.cancelled() => {
                                kill_failure = process.stop_native().await.err();
                                // Keep the original IPC request custodians;
                                // child exit releases their real response pipe.
                                run.await
                            },
                        },
                        None => run.await,
                    }
                }
                #[cfg(not(all(target_os = "windows", feature = "native-desktop")))]
                {
                    let _ = native_stop;
                    run.await
                }
            };
            let physical_wait = process.disconnect();
            #[cfg(all(target_os = "windows", feature = "native-desktop"))]
            let pending_observer = task
                .native
                .as_mut()
                .and_then(|native| native.pending_observer.take());
            #[cfg(not(all(target_os = "windows", feature = "native-desktop")))]
            let pending_observer: Option<crate::InterruptionFuture> = None;
            let (cleanup, remainders, observed) =
                tokio::join!(physical_wait, task.finish_requests(), async {
                    match pending_observer {
                        Some(future) => Some(future.await),
                        None => None,
                    }
                });
            let transport = combine_connection_completion(transport, remainders);
            #[cfg(all(target_os = "windows", feature = "native-desktop"))]
            if let (Some(native), Some(observed)) = (task.native.as_mut(), observed) {
                native
                    .observation
                    .send_modify(|state| state.persisted = Some(observed));
            }
            #[cfg(not(all(target_os = "windows", feature = "native-desktop")))]
            let _ = observed;
            let cleanup = cleanup.map_err(|error| {
                ToolError::CleanupUnconfirmed(format!(
                    "Windows desktop worker exit was not confirmed: {error}"
                ))
            });
            let cleanup = match kill_failure.take() {
                Some(error) => Err(ToolError::CleanupUnconfirmed(format!(
                    "native-only child stop failed: {error}; process settlement: {cleanup:?}"
   
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/epochs.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! The child retains logical owners while independent native epochs settle.

use super::callbacks::{ScopeIdentity, WorkerCallbacks, WorkerMessage};
use super::{
    AuthorizationMode, BrowserAuthorizationRequest, Failure, Hello, PROTOCOL, ParentFrame, Request,
    Response, WorkerFrame, failed, local_platform, write,
};
use crate::desktop::{NativeCleanup, NativeEpochId, SessionOwner, observe_retirement};
use crate::{BrowserAccess, BrowserAuthorization, Driver, InvocationContext, protocol::Command};
use futures_util::{FutureExt, StreamExt, future::BoxFuture, stream::FuturesUnordered};
use maka_agent_facts::{language::Language, tools::ToolError};
use maka_capabilities::computer::BrowserConnection;
use serde_json::Value;
use std::{
    collections::{HashMap, VecDeque},
    future::Future,
    io,
    panic::AssertUnwindSafe,
    sync::Arc,
};
use tokio::io::{AsyncWrite, AsyncWriteExt};
use tokio::sync::{Mutex, mpsc, oneshot, watch};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

type AudioWait = BoxFuture<'static, Result<(), ToolError>>;
type AudioObservations = FuturesUnordered<BoxFuture<'static, (u64, Result<(), Failure>)>>;

#[derive(Default)]
struct PendingInvocations {
    replies: FuturesUnordered<BoxFuture<'static, (u64, Result<Value, ToolError>)>>,
    identities: HashMap<
        u64,
        (
            (String, String, crate::ExecutionCorrelation),
            CancellationToken,
        ),
    >,
}
impl PendingInvocations {
    fn insert(
        &mut self,
        id: u64,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        cancellation: CancellationToken,
        pending: BoxFuture<'static, Result<Value, ToolError>>,
    ) {
        assert!(
            self.identities
                .insert(id, ((session, turn, execution), cancellation))
                .is_none(),
            "the validated desktop request {id} cannot be parked twice"
        );
        self.replies
            .push(Box::pin(async move { (id, pending.await) }));
    }
    fn is_empty(&self) -> bool {
        self.identities.is_empty()
    }
    fn cancel(&self, scope: Option<(&str, &str, &crate::ExecutionCorrelation)>) {
        for (owner, cancellation) in self.identities.values() {
            if scope.is_none_or(|(session, turn, execution)| {
                owner.0 == session && owner.1 == turn && &owner.2 == execution
            }) {
                cancellation.cancel();
            }
        }
    }
    async fn forward_next(&mut self, events: &mpsc::UnboundedSender<Event>) {
        if let Some((id, result)) = self.replies.next().await {
            self.identities
                .remove(&id)
                .expect("parked completion retains its original request identity");
            let _ = events.send(Event::Response {
                id,
                result: result.map_err(Failure::from),
                audio: None,
            });
        }
    }
    async fn drain(
        &mut self,
        scope: Option<(&str, &str, &crate::ExecutionCorrelation)>,
        events: &mpsc::UnboundedSender<Event>,
    ) -> Result<(), ToolError> {
        while self.identities.values().any(|(owner, _)| {
            scope.is_none_or(|(session, turn, execution)| {
                owner.0 == session && owner.1 == turn && &owner.2 == execution
            })
        }) {
            self.forward_next(events).await;
        }
        Ok(())
    }
}
fn epoch_cleanup(
    pending: Result<(), ToolError>,
    native: Result<(), ToolError>,
) -> Result<(), ToolError> {
    match (pending, native) {
        (Ok(()), result) | (result, Ok(())) => result,
        (Err(pending), Err(native)) => Err(ToolError::CleanupUnconfirmed(format!(
            "{pending}; {native}"
        ))),
    }
}

async fn settle<T>(
    future: impl Future<Output = Result<T, ToolError>>,
    disconnected: &CancellationToken,
) -> Result<T, ToolError> {
    match AssertUnwindSafe(future).catch_unwind().await {
        Ok(result) => result,
        Err(_) => {
            disconnected.cancel();
            Err(ToolError::CleanupUnconfirmed(
                "Windows native epoch worker panicked; native settlement was not confirmed".into(),
            ))
        }
    }
}

struct Owner {
    session: String,
    resources: SessionOwner,
    epochs: HashMap<String, Epoch>,
    closing: Option<NativeCleanup>,
    disconnected: CancellationToken,
    shared: Vec<JoinHandle<()>>,
    preview_tasks: Vec<JoinHandle<()>>,
}

enum Epoch {
    Open(EpochWorker),
    Closed(NativeCleanup),
}

type EpochTask = futures_util::future::Shared<
    BoxFuture<'static, Result<Arc<Mutex<crate::session::Session>>, String>>,
>;

struct EpochWorker {
    preview_epoch: NativeEpochId,
    preview: crate::preview::PreviewRegistry,
    session: String,
    queue: mpsc::UnboundedSender<Operation>,
    task: EpochTask,
    closing: Option<NativeCleanup>,
}

enum Operation {
    Invoke {
        app_target: Option<crate::ComputerAppTarget>,
        id: u64,
        cancellation: CancellationToken,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        operation_id: Option<String>,
        native_observer_available: bool,
        browsers: Vec<BrowserConnection>,
        preparation_policy: crate::BrowserPreparationPolicy,
        command: Box<Command>,
        language: Language,
    },
    LeaseChild {
        id: u64,
        cancellation: CancellationToken,
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        operation_id: String,
        browsers: Vec<BrowserConnection>,
        preparation_policy: crate::BrowserPreparationPolicy,
        request: crate::BrowserLeaseChildRequest,
        language: Language,
    },
    DiscardAudio {
        id: u64,
    },
    FinishTurn {
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        language: Language,
        reply: oneshot::Sender<Result<(), ToolError>>,
    },
    DrainTurn {
        session: String,
        turn: String,
        execution: crate::ExecutionCorrelation,
        reply: oneshot::Sender<Result<(), ToolError>>,
    },
    Close {
        reply: watch::Sender<Option<Result<(), ToolError>>>,
    },
}

enum Event {
    BrowserCallback {
        message: WorkerMessage,
    },
    Response {
        id: u64,
        result: Response,
        audio: Option<AudioWait>,
    },
    Authorization {
        id: u64,
        mode: AuthorizationMode,
        request: BrowserAuthorizationRequest,
        reply: oneshot::Sender<Result<(), Failure>>,
    },
}

struct Authorization {
    callbacks: WorkerCallbacks,
    id: u64,
    events: mpsc::UnboundedSender<Event>,
    identity: Option<ScopeIdentity>,
}

impl crate::preview::PreviewAuthority for Authorization {
    fn authorize(
        &self,
        subject: crate::preview::PreviewSubject,
        cancellation: CancellationToken,
    ) -> crate::AuthorizationFuture {
        self.request(
            AuthorizationMode::Check,
            BrowserAuthorizationRequest::Preview(super::preview::AuthorizationRequest::Subject(
                subject,
            )),
            cancellation,
        )
    }
    fn browser_effect_scope(&self) -> Option<Arc<dyn crate::BrowserEffectScope>> {
        Some(Arc::new(Authorization {
            callbacks: self.callbacks.clone(),
            id: self.id,
            events: self.events.clone(),
            identity: None,
        }))
    }
}
impl crate::BrowserEffectScope for Authorization {
    fn check_session_preparation(
        &self,
        binding: crate::BrowserPreparationBinding,
        cancellation: CancellationToken,
    ) -> crate::AuthorizationFuture {
        self.request(
            AuthorizationMode::Check,
            BrowserAuthorizationRequest::Preview(
                super::preview::AuthorizationRequest::Preparation(binding),
            ),
            cancellation,
        )
    }
}
struct ForegroundAuthorization(Arc<Authorization>);
impl crate::preview::ForegroundAuthority for ForegroundAuthorization {
    fn authorize(
        &self,
        subject: crate::preview::PreviewSubject,
        cancellation: CancellationToken,
    ) -> crate::AuthorizationFuture {
        self.0.request(
            AuthorizationMode::Check,
            BrowserAuthorizationRequest::Preview(super::preview::AuthorizationRequest::Foreground(
                subject,
            )),
            cancellation,
        )
    }
    fn browser_effect_scope(&self) -> Option<Arc<dyn crate::BrowserEffectScope>> {
        Some(Arc::new(Self(self.0.clone())))
    }
}
impl crate::BrowserEffectScope for ForegroundAuthorization {
    fn check_session_preparation(
        &self,
        binding: crate::BrowserPreparationBinding,
        cancellation: CancellationToken,
    ) -> crate::AuthorizationFuture {
        self.0.request(
            AuthorizationMode::Check,
            BrowserAuthorizationRequest::Preview(
                super::preview::AuthorizationRequest::ForegroundPreparation(binding),
            ),
            cancellation,
        )

```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/macos.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! Finite metadata/privacy roles. None initializes the parent's native runtime.

use super::{ENTRY, PROTOCOL};
use maka_agent_facts::{
    capability::CallResult, interaction::SystemPermissionGrant, tools::ToolError,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    ffi::OsString,
    io::{self, Read, Write},
    process::{ExitCode, Stdio},
    time::{Duration, Instant},
};

#[derive(Clone, Copy)]
pub(crate) enum MacRole {
    PermissionStatus,
    PermissionRequest(SystemPermissionGrant),
    ListApps,
    ListWindows { pid: Option<u32> },
}

impl MacRole {
    fn arguments(self) -> Vec<OsString> {
        let arguments = match self {
            Self::PermissionStatus => vec!["--macos-permission-status"],
            Self::PermissionRequest(SystemPermissionGrant::Accessibility) => {
                vec!["--macos-permission-request", "accessibility"]
            }
            Self::PermissionRequest(SystemPermissionGrant::ScreenRecording) => {
                vec!["--macos-permission-request", "screen_recording"]
            }
            Self::ListApps => vec!["--macos-list-apps"],
            Self::ListWindows { .. } => vec!["--macos-list-windows"],
        };
        let mut arguments: Vec<OsString> = arguments.into_iter().map(OsString::from).collect();
        if let Self::ListWindows { pid: Some(pid) } = self {
            arguments.push(pid.to_string().into());
        }
        arguments
    }

    fn parse(arguments: &[OsString]) -> Option<Result<Self, String>> {
        let first = arguments.first()?.to_str()?;
        let role = match first {
            "--macos-permission-status" if arguments.len() == 1 => Self::PermissionStatus,
            "--macos-list-apps" if arguments.len() == 1 => Self::ListApps,
            "--macos-list-windows" if arguments.len() == 1 => Self::ListWindows { pid: None },
            "--macos-list-windows" if arguments.len() == 2 => {
                let Some(Ok(pid)) = arguments[1].to_str().map(str::parse::<u32>) else {
                    return Some(Err("macOS window inventory requires a valid PID".into()));
                };
                Self::ListWindows { pid: Some(pid) }
            }
            "--macos-permission-request" if arguments.len() == 2 => match arguments[1].to_str() {
                Some("accessibility") => {
                    Self::PermissionRequest(SystemPermissionGrant::Accessibility)
                }
                Some("screen_recording") => {
                    Self::PermissionRequest(SystemPermissionGrant::ScreenRecording)
                }
                _ => {
                    return Some(Err(
                        "macOS permission request requires one supported grant".into()
                    ));
                }
            },
            name if name.starts_with("--macos-") => {
                return Some(Err("invalid finite macOS desktop role arguments".into()));
            }
            _ => return None,
        };
        Some(Ok(role))
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Reply {
    protocol: u32,
    result: Result<Value, String>,
}

/// Blocking owned-child I/O: async callers must use spawn_blocking. Every call
/// observes a fresh process; no observation is cached or treated as execution.
pub(crate) fn macos_finite(
    role: MacRole,
    cancelled: &(dyn Fn() -> bool + Sync),
) -> Result<Value, ToolError> {
    if cancelled() {
        return Err(failed("finite macOS operation cancelled before dispatch"));
    }
    let request = matches!(role, MacRole::PermissionRequest(_));
    let mut child = std::process::Command::new(std::env::current_exe().map_err(failed)?)
        .arg(ENTRY)
        .args(role.arguments())
        .stdin(if request {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(failed)?;
    // Keep the request's liveness writer out of Child: wait() closes Child.stdin.
    // Only this invocation owns it; parent death closes it in the kernel.
    let _liveness = child.stdin.take();
    let stdout = child.stdout.take().expect("piped finite worker stdout");
    let stderr = child.stderr.take().expect("piped finite worker stderr");
    std::thread::scope(|scope| {
        let stdout = scope.spawn(move || read_output(stdout, 16 * 1024 * 1024));
        let stderr = scope.spawn(move || read_output(stderr, 64 * 1024));
        // An explicit request can be waiting on the human's native OS dialog.
        let deadline = (!request).then(|| Instant::now() + Duration::from_secs(30));
        let status = loop {
            let cancelled = cancelled();
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None)
                    if !cancelled && deadline.is_none_or(|deadline| Instant::now() < deadline) =>
                {
                    std::thread::sleep(Duration::from_millis(10))
                }
                observation => {
                    let reason = match observation {
                        Err(error) => format!("observe finite macOS worker exit: {error}"),
                        _ if cancelled => "finite macOS operation cancelled".into(),
                        _ => "finite macOS worker timed out".into(),
                    };
                    let killed = child.kill();
                    let reaped = child.wait();
                    break Err(failed(format!(
                        "{reason}; termination={killed:?}; reap={reaped:?}"
                    )));
                }
            }
        };
        let stdout = stdout
            .join()
            .map_err(|_| failed("finite macOS stdout reader panicked"))?
            .map_err(failed)?;
        let stderr = stderr
            .join()
            .map_err(|_| failed("finite macOS stderr reader panicked"))?
            .map_err(failed)?;
        let status = status?;
        if !status.success() {
            return Err(failed(format!(
                "finite macOS worker exited with {status}: {}",
                String::from_utf8_lossy(&stderr).trim()
            )));
        }
        let reply: Reply = serde_json::from_slice(&stdout)
            .map_err(|error| failed(format!("invalid finite macOS worker reply: {error}")))?;
        if reply.protocol != PROTOCOL {
            return Err(failed("finite macOS worker protocol mismatch"));
        }
        reply.result.map_err(failed)
    })
    .map_err(|error| {
        if request {
            failed(format!(
                "system_permission_request_outcome_unknown: {error}"
            ))
        } else {
            error
        }
    })
}

fn failed(message: impl std::fmt::Display) -> ToolError {
    ToolError::Failed(message.to_string())
}

fn read_output(mut input: impl Read, limit: usize) -> io::Result<Vec<u8>> {
    let mut result = Vec::new();
    let mut buffer = [0u8; 8192];
    loop {
        let count = input.read(&mut buffer)?;
        if count == 0 {
            return Ok(result);
        }
        if result.len() + count > limit {
            return Err(io::Error::other(
                "finite macOS worker output exceeds its bound",
            ));
        }
        result.extend_from_slice(&buffer[..count]);
    }
}

pub(super) fn bootstrap(arguments: &[OsString]) -> Option<ExitCode> {
    let role = MacRole::parse(arguments)?;
    let result = role.and_then(|role| match role {
        MacRole::PermissionStatus => crate::system_permission::process::finite_status(),
        MacRole::PermissionRequest(grant) => {
            watch_request_owner()?;
            crate::system_permission::process::finite_request(grant)
        }
        MacRole::ListApps | MacRole::ListWindows { .. } => {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|error| error.to_string())?;
            runtime.block_on(inventory(role))
        }
    });
    let response = Reply {
        protocol: PROTOCOL,
        result,
    };
    let output = std::io::stdout();
    let mut output = output.lock();
    let written = serde_json::to_writer(&mut output, &response)
        .map_err(io::Error::other)
        .and_then(|_| output.flush());
    Some(match written {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("Maka finite macOS worker: {error}");
            ExitCode::FAILURE
        }
    })
}

fn watch_request_owner() -> Result<(), String> {
    std::thread::Builder::new()
        .name("maka-permission-owner".into())
        .spawn(|| {
            // No commands are accepted. EOF, I/O failure or unexpected data all
            // end this child, even when its main thread is inside an OS modal.
            let _ = std::io::stdin().lock().read(&mut [0]);
            // SAFETY: this single-purpose child owns no parent resources. Avoid
            // exit handlers that could wait on the blocked native main thread.
            unsafe { libc::_exit(1) }
        })
        .map(|_| ())
      
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/native_owner.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//! Native-only Windows SDK owner, using the existing inherited worker channel.
//! Browser, JavaScript and the embedding Host never execute in this child.

mod presentation;

use super::{
    Connection, EXIT_TIMEOUT, Failure, Hello, NativePresentStep, PROTOCOL, ParentFrame, Process,
    Request, WorkerFrame, read_sync, write,
};
use crate::{InvocationContext, desktop::NativeEpochId};
use cua_driver_sdk::{
    CuaDriver, CuaDriverSession, WindowsInterruptionBinding, WindowsInterruptionSink,
    WindowsPhysicalInput,
};
use maka_agent_facts::{language::Language, tools::ToolError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{io, process::ExitCode, sync::Arc};
use tokio::{
    sync::{Mutex, mpsc, watch},
    task::{JoinError, JoinSet},
};
use tokio_util::sync::CancellationToken;

pub(super) const ENTRY: &str = "__maka-cua-native-windows";

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(
    tag = "frame",
    content = "window",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub(crate) enum NativeCoordinateFrame {
    Screenshot,
    WindowPixels,
    WindowFrame(cua_driver_sdk::NativeWindowFrame),
    RawWindowObservation,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct NativeGeneration(uuid::Uuid);
impl NativeGeneration {
    pub(super) fn observed(&self) -> String {
        self.0.to_string()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct NativeKey {
    pub epoch: String,
    pub session: String,
    pub turn: String,
    pub execution: crate::ExecutionCorrelation,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NativeOperation {
    ListApps,
    ListWindows,
    GetWindowState,
    Click,
    TypeText,
    PressKey,
    Scroll,
    Drag,
    SetValue,
    LaunchApp,
    ElementBounds,
    BringToFront,
    NativeSecondaryAction,
    StartAudioRecording,
    StopAudioRecording,
}
impl NativeOperation {
    pub(super) fn name(self) -> &'static str {
        match self {
            Self::ListApps => "list_apps",
            Self::ListWindows => "list_windows",
            Self::GetWindowState => "get_window_state",
            Self::Click => "click",
            Self::TypeText => "type_text",
            Self::PressKey => "press_key",
            Self::Scroll => "scroll",
            Self::Drag => "drag",
            Self::SetValue => "set_value",
            Self::LaunchApp => "launch_app",
            Self::ElementBounds => "element_bounds",
            Self::BringToFront => "bring_to_front",
            Self::NativeSecondaryAction => "native_secondary_action",
            Self::StartAudioRecording => "start_audio_recording",
            Self::StopAudioRecording => "stop_audio_recording",
        }
    }
    fn parse(name: &str) -> Result<Self, ToolError> {
        Ok(match name {
            "list_apps" => Self::ListApps,
            "list_windows" => Self::ListWindows,
            "get_window_state" => Self::GetWindowState,
            "click" => Self::Click,
            "type_text" => Self::TypeText,
            "press_key" => Self::PressKey,
            "scroll" => Self::Scroll,
            "drag" => Self::Drag,
            "set_value" => Self::SetValue,
            "launch_app" => Self::LaunchApp,
            "element_bounds" => Self::ElementBounds,
            "bring_to_front" => Self::BringToFront,
            "native_secondary_action" => Self::NativeSecondaryAction,
            "start_audio_recording" => Self::StartAudioRecording,
            "stop_audio_recording" => Self::StopAudioRecording,
            _ => {
                return Err(ToolError::Failed(
                    "unsupported native owner operation".into(),
                ));
            }
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct NativeResult {
    pub text: String,
    pub is_error: bool,
    pub error_code: Option<String>,
    pub raw_json: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    audio_output: Option<std::path::PathBuf>,
}
impl From<cua_driver_sdk::ToolResult> for NativeResult {
    fn from(result: cua_driver_sdk::ToolResult) -> Self {
        Self {
            text: result.text,
            is_error: result.is_error,
            error_code: result.error_code,
            raw_json: result.raw_json,
            audio_output: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct NativePresentationSource {
    generation: NativeGeneration,
    key: NativeKey,
}
impl NativePresentationSource {
    pub(crate) fn matches_invocation(
        &self,
        epoch: NativeEpochId,
        invocation: &crate::InvocationContext<'_>,
    ) -> bool {
        self.key.epoch == epoch.to_string()
            && self.key.session == invocation.session()
            && self.key.turn == invocation.turn()
            && self.key.execution == *invocation.execution_correlation()
    }
}

pub(crate) struct NativeInvocationTarget {
    pub(crate) epoch: NativeEpochId,
    pub(crate) expected: Option<NativeGeneration>,
    pub(crate) coordinate_frame: NativeCoordinateFrame,
}

pub(crate) struct NativeReply {
    pub source: NativePresentationSource,
    pub result: NativeResult,
    pub audio: Option<NativeAudioCompletion>,
}

#[derive(Serialize, Deserialize)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub(crate) enum NativePresentReply {
    Frame(cua_driver_contract::WindowBounds),
    Effect(NativeResult),
}

/// Exact transport custody of a real native capture, not a model-selected ID.
#[derive(Clone)]
pub(crate) struct NativeAudioCompletion {
    slot: Arc<Slot>,
    key: NativeKey,
    output: std::path::PathBuf,
    completion: super::connection::AudioObservation,
}
impl NativeAudioCompletion {
    pub(crate) async fn wait(&self) -> Result<(), ToolError> {
        let mut completion = self.completion.clone();
        loop {
            if let Some(result) = completion.borrow().clone() {
                return result;
            }
            completion.changed().await.map_err(|error| {
                ToolError::CleanupUnconfirmed(format!(
                    "native audio completion disappeared: {error}"
                ))
            })?;
        }
    }
    pub(crate) async fn discard(&self) -> Result<(), ToolError> {
        self.slot
            .connection
            .invoke(
                Request::NativeDiscardAudio {
                    key: self.key.clone(),
                    output: Some(self.output.clone()),
                },
                None,
                CancellationToken::new(),
            )
            .await?;
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub(super) enum NativeExit {
    Exited { code: Option<i32> },
    WaitFailed(String),
}
impl NativeExit {
    fn escape(&self) -> bool {
        matches!(self, Self::Exited { code: Some(130) })
    }
}
pub(super) type ExitObservation = watch::Receiver<Option<NativeExit>>;

#[derive(Clone, Default)]
pub(super) struct NativeObservation {
    pub key: Option<NativeKey>,
    pub interrupted: bool,
    pub retired: Option<Result<(), ToolError>>,
    pub source: Option<Arc<super::connection::NativeCallSource>>,
    pub persisted: Option<Result<(), ToolError>>,
}

struct Slot {
    initial_key: NativeKey,
    generation: NativeGeneration,
    connection: Connection,
    hard_stop: CancellationToken,
    exit: ExitObservation,
    observation: watch::Receiver<NativeObservation>,
    audio: std::sync::Mutex<
        Option<(
            NativeKey,
            std::path::PathBuf,
            super::connection::AudioObservation,
        )>,
    >,
    requests: Arc<Mutex<()>>,
}
impl Slot {
    fn key(&self) -> NativeKey {
        self.observation
            .borrow()
            .key
            .clone()
            .unwrap_or_else(|| self.initial_key.clone())
    }
    fn escaped(&self) -> bool {
        self.observation.borrow().interrupted
            || self.exit.borrow().as_ref().is_some_and(NativeExit::escape)
    }
    async fn retire_binding(&self) -> Result<(), ToolError> {
        let retired = self.observation.borrow().retired.clone();
        if !matches!(retired, Some(Ok(()))) {
            if self.exit.borrow().is_some() {
                return Err(ToolError::CleanupUnconfirmed(
                    "native owner exited without an owned-input retirement acknowledgement".into(),
                ));
            }
            // A normal exact-key RPC may settle while the older native input
            // remains blocked. Its ACK covers guards only, never that action.
            if let Err(error) = self.connection.retire_native(self.key()).await {
                // Esc can retire and exit before replying to this concurrently
                // queued control. Its exact-key native retirement notification
                // is equally real input proof; Child wait is still required.
                if !matches!(self.observation.borrow().retired, Some(Ok(()))) {
                    return Err(error);
      
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/native_owner/presentation.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

use super::*;
use crate::preview::{ForegroundAuthority, PresentationArea, PresentationResult, PreviewSubject};
use serde_json::json;

impl NativeOwner {
    async fn presentation_slot(
        &self,
        source: &NativePresentationSource,
    ) -> Result<Arc<Slot>, ToolError> {
        let slot = self
            .current
            .lock()
            .await
            .as_ref()
            .filter(|slot| slot.generation == source.generation && slot.key() == source.key)
            .cloned()
            .ok_or_else(|| failed("native presentation source changed"))?;
        if let Some(NativeExit::WaitFailed(reason)) = slot.exit.borrow().as_ref() {
            return Err(ToolError::CleanupUnconfirmed(reason.clone()));
        }
        if slot.hard_stop.is_cancelled()
            || slot.exit.borrow().is_some()
            || slot.observation.borrow().interrupted
            || slot.observation.borrow().retired.is_some()
        {
            return Err(failed("native presentation source retired"));
        }
        Ok(slot)
    }

    async fn present_step(
        &self,
        source: &NativePresentationSource,
        binding: &crate::ComputerAppBinding,
        step: NativePresentStep,
        cancellation: CancellationToken,
    ) -> Result<NativePresentReply, ToolError> {
        if cancellation.is_cancelled() {
            return Err(failed("native presentation cancelled"));
        }
        let slot = self.presentation_slot(source).await?;
        let admission = slot
            .requests
            .clone()
            .try_lock_owned()
            .map_err(|_| failed("native owner has an active request"))?;
        let reply = slot
            .connection
            .invoke_native_present(
                Request::NativePresent {
                    key: source.key.clone(),
                    generation: source.generation.observed(),
                    binding: binding.clone(),
                    step,
                },
                cancellation,
                admission,
            )
            .await?;
        serde_json::from_value(reply.value).map_err(|error| {
            ToolError::OutcomeUnknown(format!("invalid native presentation result: {error}"))
        })
    }

    pub(crate) async fn present(
        &self,
        source: &NativePresentationSource,
        binding: &crate::ComputerAppBinding,
        subject: PreviewSubject,
        authority: Arc<dyn ForegroundAuthority>,
        area: PresentationArea,
        cancellation: CancellationToken,
    ) -> Result<PresentationResult, ToolError> {
        let checkpoint = || async {
            authority
                .authorize(subject.clone(), cancellation.clone())
                .await?;
            self.presentation_slot(source).await.map(|_| ())
        };
        checkpoint().await?;
        let NativePresentReply::Frame(frame) = self
            .present_step(
                source,
                binding,
                NativePresentStep::ReadFrame,
                cancellation.clone(),
            )
            .await?
        else {
            return Err(ToolError::OutcomeUnknown(
                "native frame query returned an effect".into(),
            ));
        };
        let width = frame.width.min(area.width);
        let height = frame.height.min(area.height);
        checkpoint().await?;
        let NativePresentReply::Effect(placed) = self
            .present_step(
                source,
                binding,
                NativePresentStep::SetFrame {
                    x: area.x + (area.width - width) / 2.0,
                    y: area.y + (area.height - height) / 2.0,
                    width,
                    height,
                },
                cancellation.clone(),
            )
            .await?
        else {
            return Err(ToolError::OutcomeUnknown(
                "native placement returned no effect".into(),
            ));
        };
        let mut details =
            json!({"placement": serde_json::from_str::<Value>(&placed.raw_json).map_err(failed)?});
        if placed.is_error {
            return Ok(PresentationResult::Partial {
                message: placed.text,
                details,
            });
        }
        let call: maka_agent_facts::capability::CallResult =
            serde_json::from_str(&placed.raw_json).map_err(failed)?;
        let action: cua_driver_contract::ActionResult = serde_json::from_value(
            call.structured_content
                .ok_or_else(|| failed("native placement omitted its action result"))?,
        )
        .map_err(failed)?;
        if action.effect != cua_driver_contract::ActionEffect::Confirmed {
            return Ok(PresentationResult::Partial {
                message: "native placement was not verified".into(),
                details,
            });
        }
        if let Err(error) = checkpoint().await {
            return crate::preview::presentation_failure(error, details);
        }
        let raised = match self
            .present_step(
                source,
                binding,
                NativePresentStep::Raise,
                cancellation.clone(),
            )
            .await
        {
            Ok(NativePresentReply::Effect(result)) => result,
            Ok(_) => {
                return Err(ToolError::OutcomeUnknown(format!(
                    "native activation returned no effect; completed placement: {details}"
                )));
            }
            Err(ToolError::OutcomeUnknown(message)) => {
                return Err(ToolError::OutcomeUnknown(format!(
                    "{message}; completed placement: {details}"
                )));
            }
            Err(error) => {
                return crate::preview::presentation_failure(error, details);
            }
        };
        details["activation"] = serde_json::from_str::<Value>(&raised.raw_json).map_err(failed)?;
        if let Err(error) = checkpoint().await {
            return crate::preview::presentation_failure(error, details);
        }
        if raised.is_error {
            return Ok(PresentationResult::Partial {
                message: raised.text,
                details,
            });
        }
        #[derive(Deserialize)]
        struct Activated {
            target_hwnd: String,
            now_fg_hwnd: String,
            landed_on_target: bool,
        }
        let call: maka_agent_facts::capability::CallResult =
            serde_json::from_str(&raised.raw_json).map_err(failed)?;
        let result: Activated = serde_json::from_value(
            call.structured_content
                .ok_or_else(|| failed("native activation omitted its result"))?,
        )
        .map_err(failed)?;
        let exact = format!("0x{:x}", binding.window_id);
        if result.landed_on_target && result.target_hwnd == exact && result.now_fg_hwnd == exact {
            Ok(PresentationResult::Presented { details })
        } else {
            Ok(PresentationResult::Partial {
                message: "native foreground activation was not verified".into(),
                details,
            })
        }
    }
}

async fn verify_binding(binding: crate::ComputerAppBinding) -> Result<(), ToolError> {
    tokio::task::spawn_blocking(move || crate::windows_permission_subject::verify_binding(&binding))
        .await
        .map_err(failed)?
}

pub(super) async fn execute(
    session: Arc<CuaDriverSession>,
    binding: crate::ComputerAppBinding,
    step: NativePresentStep,
    cancellation: CancellationToken,
) -> Result<NativePresentReply, ToolError> {
    if cancellation.is_cancelled() {
        return Err(failed("native presentation cancelled before dispatch"));
    }
    verify_binding(binding.clone()).await?;
    if cancellation.is_cancelled() {
        return Err(failed("native presentation cancelled before dispatch"));
    }
    let result = match step {
        NativePresentStep::ReadFrame => {
            let window = session
                .list_windows(cua_driver_contract::ListWindowsInput {
                    pid: Some(binding.pid),
                    on_screen_only: Some(false),
                })
                .await
                .map_err(|error| crate::driver::native_error(&error, Language::EN))?
                .windows
                .into_iter()
                .find(|window| {
                    window.window_id == binding.window_id && window.pid == Some(binding.pid)
                })
                .ok_or_else(|| failed("native bound window closed"))?;
            NativePresentReply::Frame(window.bounds)
        }
        NativePresentStep::SetFrame {
            x,
            y,
            width,
            height,
        } => NativePresentReply::Effect(
            session
                .set_window_frame(cua_driver_contract::SetWindowFrameInput {
                    pid: binding.pid,
                    window_id: binding.window_id,
                    x,
                    y,
                    width,
                    height,
                    session: None,
                })
                .await
                .map_err(|e
```

### Core Architecture Module: `platform/computer-use/src/desktop/worker/preview.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

use super::{Connection, Request, failed};
use crate::desktop::{NativeCleanup, NativeEpochId};
use crate::preview::{
    Capture, CaptureFuture, CapturedImage, ForegroundAuthority, MAX_PREVIEW_BYTES,
    MAX_PREVIEW_DIMENSION, MAX_RECENT_PREVIEW_TARGETS, PresentationArea, PresentationFuture,
    PreviewAuthority, PreviewFrame, PreviewRegistry, PreviewSnapshot, PreviewSubject,
    PreviewTarget,
};
use crate::{AuthorizationFuture, BrowserPreparationBinding};
use base64::Engine;
use maka_agent_facts::tools::ToolError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

#[derive(Serialize, Deserialize)]
pub(super) enum AuthorizationRequest {
    Subject(PreviewSubject),
    Preparation(BrowserPreparationBinding),
    Foreground(PreviewSubject),
    ForegroundPreparation(BrowserPreparationBinding),
}
pub(super) fn decide(
    authority: Option<Arc<dyn PreviewAuthority>>,
    foreground: Option<Arc<dyn ForegroundAuthority>>,
    request: AuthorizationRequest,
    cancellation: CancellationToken,
) -> AuthorizationFuture {
    Box::pin(async move {
        if cancellation.is_cancelled() {
            return Err(failed("preview authorization cancelled"));
        }
        match request {
            AuthorizationRequest::Subject(subject) => {
                authority
                    .ok_or_else(|| failed("preview requires its actual Host authority"))?
                    .authorize(subject, cancellation)
                    .await
            }
            AuthorizationRequest::Preparation(binding) => {
                authority
                    .ok_or_else(|| failed("preview requires its actual Host authority"))?
                    .browser_effect_scope()
                    .ok_or_else(|| {
                        failed("preview requires its current read-only preparation scope")
                    })?
                    .check_session_preparation(binding, cancellation)
                    .await
            }
            AuthorizationRequest::Foreground(subject) => {
                foreground
                    .ok_or_else(|| {
                        failed("presentation requires its actual client mutation authority")
                    })?
                    .authorize(subject, cancellation)
                    .await
            }
            AuthorizationRequest::ForegroundPreparation(binding) => {
                foreground
                    .ok_or_else(|| {
                        failed("presentation requires its actual client mutation authority")
                    })?
                    .browser_effect_scope()
                    .ok_or_else(|| failed("presentation requires its current preparation scope"))?
                    .check_session_preparation(binding, cancellation)
                    .await
            }
        }
    })
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Frame {
    target_id: String,
    binding_id: String,
    revision: u64,
    width: u32,
    height: u32,
    jpeg: String,
}
#[cfg(feature = "native-desktop")]
pub(super) fn encode_frame(frame: PreviewFrame) -> Result<Value, ToolError> {
    serde_json::to_value(Frame {
        target_id: frame.target_id,
        binding_id: frame.binding_id,
        revision: frame.revision,
        width: frame.width,
        height: frame.height,
        jpeg: base64::engine::general_purpose::STANDARD.encode(frame.bytes),
    })
    .map_err(failed)
}
fn decode_frame(value: Value, target: &PreviewTarget) -> Result<PreviewFrame, ToolError> {
    let frame: Frame = serde_json::from_value(value).map_err(failed)?;
    if frame.target_id != target.id
        || frame.binding_id != target.binding_id
        || frame.revision != target.revision
        || frame.width == 0
        || frame.height == 0
        || frame.width > MAX_PREVIEW_DIMENSION
        || frame.height > MAX_PREVIEW_DIMENSION
        || frame.jpeg.len() > MAX_PREVIEW_BYTES.div_ceil(3) * 4
    {
        return Err(failed("invalid preview worker frame identity or limits"));
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(frame.jpeg)
        .map_err(failed)?;
    if bytes.len() > MAX_PREVIEW_BYTES {
        return Err(failed("preview worker frame exceeds byte limit"));
    }
    Ok(PreviewFrame {
        target_id: frame.target_id,
        binding_id: frame.binding_id,
        revision: frame.revision,
        width: frame.width,
        height: frame.height,
        bytes,
        mime_type: "image/jpeg",
    })
}

#[derive(Clone)]
struct RemoteCapture {
    connection: Connection,
    owner: String,
    epoch: String,
    session: String,
    target: PreviewTarget,
}
impl RemoteCapture {
    async fn read(
        &self,
        pixels: bool,
        authority: Arc<dyn PreviewAuthority>,
        cancellation: CancellationToken,
    ) -> Result<Value, ToolError> {
        self.connection
            .invoke_preview(
                Request::PreviewRead {
                    owner: self.owner.clone(),
                    epoch: self.epoch.clone(),
                    session: self.session.clone(),
                    target: self.target.clone(),
                    pixels,
                },
                Some(authority),
                cancellation,
            )
            .await
            .map(|reply| reply.value)
    }
}
impl Capture for RemoteCapture {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    fn same_source(&self, other: &dyn Capture) -> bool {
        other.as_any().downcast_ref::<Self>().is_some_and(|other| {
            self.connection.same_connection(&other.connection)
                && self.owner == other.owner
                && self.epoch == other.epoch
                && self.session == other.session
                && self.target.id == other.target.id
                && self.target.revision == other.target.revision
                && self.target.binding_id == other.target.binding_id
                && self.target.epoch == other.target.epoch
        })
    }
    fn authorize(
        &self,
        authority: Arc<dyn PreviewAuthority>,
        cancellation: CancellationToken,
    ) -> AuthorizationFuture {
        let source = self.clone();
        Box::pin(async move {
            source
                .read(false, authority, cancellation)
                .await
                .map(|_| ())
        })
    }
    fn capture(
        &self,
        authority: Arc<dyn PreviewAuthority>,
        cancellation: CancellationToken,
    ) -> CaptureFuture {
        let source = self.clone();
        Box::pin(async move {
            let value = source.read(true, authority, cancellation).await?;
            Ok(CapturedImage::Frame(decode_frame(value, &source.target)?))
        })
    }
    fn present(
        &self,
        authority: Arc<dyn ForegroundAuthority>,
        area: PresentationArea,
        cancellation: CancellationToken,
    ) -> PresentationFuture {
        let source = self.clone();
        Box::pin(async move {
            let reply = source
                .connection
                .invoke_foreground(
                    Request::PreviewPresent {
                        owner: source.owner,
                        epoch: source.epoch,
                        session: source.session,
                        target: source.target,
                        area,
                    },
                    authority,
                    cancellation,
                )
                .await?;
            serde_json::from_value(reply.value).map_err(failed)
        })
    }
}

pub(in crate::desktop) struct Bridge {
    connection: Connection,
    stop: CancellationToken,
    pub(in crate::desktop) cleanup: NativeCleanup,
}
impl Bridge {
    pub(in crate::desktop) fn matches(&self, connection: &Connection) -> bool {
        self.connection.same_connection(connection) && !self.stop.is_cancelled()
    }
    pub(in crate::desktop) fn stop(&self) {
        self.stop.cancel();
    }
    pub(in crate::desktop) fn start(
        connection: Connection,
        owner: String,
        epoch: NativeEpochId,
        session: String,
        registry: PreviewRegistry,
    ) -> Result<Self, ToolError> {
        let stop = registry.epoch_stop(epoch)?.child_token();
        let stream = stop.clone();
        let worker = connection.clone();
        let (finished, cleanup) = tokio::sync::watch::channel(None);
        tokio::spawn(async move {
            let result = async {
                let mut after = None;
                loop {
                    if stream.is_cancelled() {
                        return Ok(());
                    }
                    let reply = worker
                        .invoke_preview(
                            Request::PreviewWatch {
                                owner: owner.clone(),
                                epoch: epoch.to_string(),
                                session: session.clone(),
                                after,
                            },
                            None,
                            stream.clone(),
                        )
 
```

### Core Architecture Module: `platform/event-log/src/root_store/lifecycle.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

use super::*;
use futures_util::future::BoxFuture;
use futures_util::{FutureExt, future::Shared};
use std::panic::AssertUnwindSafe;

/// The original Root owner closes SQL only after accepted physical work drains.
/// It survives destruction of the caller's runtime and never blocks a SQL actor.
pub(super) struct Lifecycle {
    closed: Shared<BoxFuture<'static, Result<(), String>>>,
    maintenance: Option<tokio::sync::oneshot::Sender<()>>,
}
enum CloseFailure {
    RetainedWork,
    Unconfirmed(String),
}

impl Lifecycle {
    pub(super) async fn start(
        log: Arc<EventLog>,
        gates: Arc<gates::Gates>,
    ) -> Result<Self, StoreError> {
        let (ready, started) = tokio::sync::oneshot::channel();
        let (done, closed) = tokio::sync::oneshot::channel();
        let (maintenance, recovered) = tokio::sync::oneshot::channel();
        std::thread::Builder::new()
            .name("runtime-root-owner".into())
            .spawn(move || {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(error) => {
                        log.request_shutdown();
                        let reason = error.to_string();
                        let _ = ready.send(Err(reason.clone()));
                        let _ = done.send(Err(reason));
                        return;
                    }
                };
                // A cancelled startup observer is an instruction to close, not a
                // detached Root with no remaining authority holder.
                if ready.send(Ok(())).is_err() {
                    gates.close();
                }
                let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
                    let (unconfirmed, premature_close) = runtime.block_on(async {
                        let receipt = log.close_receipt();
                        let shutdown = async {
                            tokio::select! {
                            failed = gates.wait_for_shutdown() => (failed, None),
                            closed = receipt => {
                                let ready = gates.shutdown_ready();
                                gates.close();
                                match (closed, ready) {
                                    (Ok(()), Some(unconfirmed)) => (unconfirmed, None),
                                    (closed, _) => (false, Some(closed.err().unwrap_or_else(|| "SQL owner closed before Root work drained".into()))),
                                }
                            }
                            }
                        };
                        let (_, result) = futures_util::future::join(
                            material::maintain(&log, recovered, gates.cancellation()),
                            shutdown,
                        ).await;
                        result
                    });
                    if unconfirmed {
                        // Closing admission is not evidence that accepted owners
                        // have stopped using SQL. Keep their live
                        // actors and original authority so valid execution pins
                        // can still persist known results before quarantining.
                        return Err(CloseFailure::RetainedWork);
                    }
                    log.request_shutdown();
                    let mut failures: Vec<String> = runtime.block_on(log.shutdown()).err().map(|error|error.to_string()).into_iter().collect();
                    if let Some(error) = premature_close { failures.push(error); }
                    if failures.is_empty() {
                        Ok(())
                    } else {
                        Err(CloseFailure::Unconfirmed(failures.join("; ")))
                    }
                }))
                .unwrap_or_else(|_| {
                    Err(CloseFailure::Unconfirmed(
                        "Root lifecycle owner panicked before confirming cleanup".into(),
                    ))
                });
                match result {
                    Ok(()) => {
                        drop(log);
                        drop(gates);
                        let _ = done.send(Ok(()));
                    }
                    Err(CloseFailure::RetainedWork) => {
                        let _ = done.send(Err("accepted Root work cleanup is unconfirmed".into()));
                        // The original failure receipt stays failed. Only actual
                        // original settlement can release the retained authority.
                        let closed = std::panic::catch_unwind(AssertUnwindSafe(|| {
                            runtime.block_on(async {
                                gates.wait_for_settlement().await;
                                log.request_shutdown();
                                log.shutdown().await
                            })
                        }));
                        match closed {
                            Ok(Ok(())) => {
                                drop(log);
                                drop(gates);
                            }
                            failure => {
                                if let Ok(Err(error)) = failure {
                                    eprintln!("Root late cleanup close is unconfirmed: {error}");
                                }
                                loop { std::thread::park(); }
                            }
                        }
                    }
                    Err(CloseFailure::Unconfirmed(error)) => {
                        let _ = done.send(Err(error));
                        // A failed SQL close or lost owner has no release proof.
                        loop { std::thread::park(); }
                    }
                }

            })?;
        match started.await {
            Ok(Ok(())) => Ok(Self {
                maintenance: Some(maintenance),
                closed: async move {
                    closed
                        .await
                        .map_err(|_| "Root owner exited without close acknowledgement".to_owned())?
                }
                .boxed()
                .shared(),
            }),
            Ok(Err(error)) => Err(StoreError::CloseFailed(error)),
            Err(_) => Err(StoreError::Initialization),
        }
    }
    pub(super) fn start_maintenance(&mut self) -> Result<(), StoreError> {
        self.maintenance
            .take()
            .expect("Root enables maintenance once, after startup recovery")
            .send(())
            .map_err(|_| StoreError::ConnectionClosed)
    }

    pub(super) async fn wait(&self) -> Result<(), StoreError> {
        self.closed.clone().await.map_err(StoreError::CloseFailed)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7120** (2026-11-21): **bug(computer-use): the Maka cursor stays on screen when nothing is acting**
  *Symptoms*: ### What happened  After a turn that uses Computer Use on macOS, the Maka cursor (the pointer with the "Maka" label) stays on screen. It sits where the last action happened, above the app that was operated, and the user has no way to dismiss it: it takes no clicks and nothing in the UI removes it. It goes away only when the conversation is deleted, the model calls `cua.cursor.configure({enabled: false})`, or the Host stops.  On my machine a cursor from a finished turn was still drawn 1 h 26 min later, with `maka __maka-cua-cursor` running the whole time.  This is the documented behaviour ("Idle cursors remain until disabled or cleaned up", `idle_hide_ms: 0.0` with the comment "Visibility belongs to the Session, not to an individual action"), so this is a request to change it, not a regression report.  ### Why change it  The cursor tells the user where the agent is acting. Once the turn has ended nothing is acting, and a pointer that cannot be clicked or closed reads as a stuck overlay. A user who does not know what it is has no hint how to get rid of it.  ### How to reproduce  1. In a conversation, ask the model to click a button in Calculator with `cua_repl`. 2. Let the turn finish. 3. Bring Calculator to the front: the Maka cursor is still on the button.  ### Proposal  Keep the cursor as the Session's, but take it off the screen when nothing is acting: remove it when its turn ends, and let the next input action draw it again. Nothing changes within a turn. PR: #7121.  Hidin

- **Issue #6966** (2026-11-22): **Shell network requests are rejected before approval in sandboxed sessions**
  *Symptoms*: ### What happened  In a Workspace Write conversation with permission requests on, a Shell call with `additional_permissions` for network access fails at once with "Requested access exceeds the process installation or protected workspace boundary". No approval request reaches the user. Shell therefore cannot get network access outside Full Access, although the Shell tool says it can request it and `products/maka/bundle/src/installation.ts:325` says the session preset "denies networking until approved".  Expected: the user sees an approval request, and the command gets network access if they allow it.  In the original conversation the model tried `additional_permissions: {filesystem: [], network: "allowed"}` and then `{network: {restricted: {destinations: [{host: "push2.eastmoney.com", port: 443}]}}}`. Both were rejected without a prompt, so the model fetched every data source through WebFetch instead.  Cause:  - `tools.rs` gives native tools the floor from `access.sandbox_floor()` (`plugins/agent/native/src/tools.rs:851`). - That floor is the live preset's base sandbox (`resolve_sandbox_floor`, `plugins/agent/native/src/owner/access.rs:288`), and the base network is `Denied` (`plugins/workspace/workspace-files/engine/src/workspace/permissions.rs:52`). - workspace-processes intersects its approval ceiling with that floor (`plugins/workspace/workspace-processes/native/src/execute.rs:78-82`). Any requested network access exceeds the ceiling and fails at `execute.rs:311` before `p

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

### Incident Patch 1: `3dd8e9f8` (2026-11-28)
**Commit Message**: fix(external): isolate Antigravity ACP supervisor per Run (#7379)

Previously all concurrent Antigravity sessions shared a single
--maka-agy-acp-front supervisor process. When one session's
session/resume or session/close stalled, the shared router marked that
route expired and waited until every other route on the same front
drained before terminating agy and sealing closure.json. Any long-running
peer session held the stalled session indefinitely in wait_for_close,
blocking timeout errors, Stop requests, and queued follow-ups.

Give each Antigravity Run its own dedicated stdio supervisor and agy
process group with explicit Opening/Open/Closing state:
- Remove the shared Fronts pool, LocalListener socket multiplexing, and
  draining/retiring state machine in agy_front.rs / agy_front/router.rs.
- On Host disconnect (normal end, timeout, Stop, or Host crash), close
  immediately if no session opened yet, or wait up to 2s for
  session/close before terminating only this Run's agy process group and
  sealing closure.json.
- Replace &mut Option<TaskOwner> with explicit agy_front::OpenError
  states (BeforeLaunch / Closed / Unconfirmed) and honor cancellation
  and retirement during sup

**File**: `plugins/agent/native/src/executor/external.rs` (modified, +0/-4)
```diff
@@ -171,7 +171,6 @@ async fn await_closed_task(
 }
 
 pub(crate) struct External {
-    agy_fronts: agy_front::Fronts,
     commands: BTreeMap<NativeRuntime, NativeCommand>,
     queries: Arc<maka_plugin_core::work::resources::Resources>,
     catalog: tokio::sync::Mutex<Catalog>,
@@ -245,7 +244,6 @@ impl External {
             .map_err(|error| error.to_string())?,
         );
         Ok(Arc::new(Self {
-            agy_fronts: Default::default(),
             commands,
             sessions,
             queries: Arc::default(),
@@ -776,10 +774,8 @@ impl External {
             .map(|(key, endpoint)| (key.clone(), endpoint.clone()))
             .collect();
         let endpoints = self.finish_endpoints(selected).await;
-        let fronts = self.agy_fronts.finish().await;
         let queries = self.queries.finish().await.map_err(|e| e.to_string());
         let sessions = self.sessions.finish().await;
-        fronts?;
         queries?;
         endpoints?;
         sessions
```

**File**: `plugins/agent/native/src/executor/external/agy_acp.rs` (modified, +61/-27)
```diff
@@ -35,7 +35,6 @@ const HOST_SERVER: &str = "maka";
     reason = "one invocation owns the original process, protocol and Host bridge"
 )]
 pub(super) async fn execute(
-    fronts: &agy_front::Fronts,
     config: &NativeCommand,
     cwd: &str,
     request: &Value,
@@ -47,36 +46,63 @@ pub(super) async fn execute(
 ) -> Result<Outcome, Error> {
     let observation = journal.observation();
     let descriptor = owner.descriptor();
-    let mut owner = Some(owner);
-    let (lease, ticket) = match fronts.open(config, cwd, &mut owner).await {
-        Ok(lease) => {
-            let mut ticket = observation
-                .resources
-                .reserve()
-                .map_err(|_| Error::ObservationRetired)?;
-            ticket.start();
-            (lease, ticket)
-        }
-        Err(error) => {
-            if let Some(owner) = owner {
+    let (session, ticket) =
+        match agy_front::open(config, cwd, owner, &cancellation, &observation.retired).await {
+            Ok(session) => {
+                let mut ticket = observation
+                    .resources
+                    .reserve()
+                    .map_err(|_| Error::ObservationRetired)?;
+                ticket.start();
+                (session, ticket)
+            }
+            Err(agy_front::OpenError::BeforeLaunch(owner, error)) => {
                 let error = if cancellation.is_cancelled() {
                     Error::Cancelled
+                } else if observation.retired.is_cancelled() {
+                    Error::ObservationRetired
                 } else {
                     error
                 };
-                return runtime::fail_without_launch(&observation, owner, error).await;
+                return runtime::fail_without_launch(&observation, *owner, error).await;
             }
-            let mut ticket = observation
-                .resources
-                .reserve()
-                .map_err(|_| Error::ObservationRetired)?;
-            ticket.start();
-            ticket.unconfirmed(error.to_string(), descriptor);
-            return Err(error);
-        }
-    };
+            Err(agy_front::OpenError::Closed(error)) => {
+                let mut ticket = observation
+                    .resources
+                    .reserve()
+                    .map_err(|_| Error::ObservationRetired)?;
+                ticket.start();
+                ticket.complete(Ok(()));
+                observation
+                    .binding
+                    .cleanup(OperationCleanup::Confirmed)
+                    .await?;
+                return if cancellation.is_cancelled() {
+                    Err(Error::Cancelled)
+                } else if observation.retired.is_cancelled() {
+                    Err(Error::ObservationRetired)
+                } else {
+                    runtime::preparation_failure(error)
+                };
+            }
+            Err(agy_front::OpenError::Unconfirmed(error)) => {
+                let mut ticket = observation
+                    .resources
+                    .reserve()
+                    .map_err(|_| Error::ObservationRetired)?;
+                ticket.start();
+                ticket.unconfirmed(error.to_string(), descriptor);
+                return Err(Error::CleanupUnconfirmed);
+            }
+        };
+    let agy_front::Session {
+        stdin,
+        stdout,
+        child,
+    } = session;
     let mut io = Pipe::session(
-        lease.socket,
+        stdin,
+        stdout,
         observation.clone(),
         cancellation,
         bridge.failed.clone(),
@@ -99,9 +125,9 @@ pub(super) async fn execute(
         }
     };
     bridge.close_admission();
-    drop(io); // EOF asks the supervisor to close just this session.
+    drop(io); // EOF asks this Run's supervisor to close and reap its agy process tree.
     let (closed, bridge_closed) = tokio::join!(
-        agy_front::wait_for_close(&descriptor, lease.exited),
+        agy_front::wait_for_close(&descriptor, child),
         bridge.close()
     );
     bridge.clone().original_root_cleanup_signal().await;
@@ -206,6 +232,14 @@ impl Protocol<'_> {
         io: &mut Pipe,
     ) -> Result<(String, Vec<Value>, Option<String>, bool), Error> {
         let initialized = io.request("initialize", initialize_params()).await?;
+        if initialized["protocolVersion"] != 1
+            || initialized.pointer("/agentCapabilities/mcpCapabilities/http")
+                != Some(&Value::Bool(true))
+        {
+            return Err(Error::Invalid(
+                "agy must support ACP 1 with HTTP MCP".into(),
+            ));
+        }
         let system_prompt_append = supports_system_prompt_append(&initialized);
         let system_prompt = system_prompt_append
             .then(|| {
@@ -284,7 +318,7 @@ fn open_params(
     (method, params)
 }
 
-pub(super) fn initialize_params() -> Value {
+fn initialize_params() -> Value {
     json!({"protocolVersion":1,"clientCapabilit
```

**File**: `plugins/agent/native/src/executor/external/agy_front.rs` (modified, +421/-211)
```diff
@@ -17,153 +17,154 @@
  * under the License.
  */
 
-//! One stdio ACP front per resolved command in this activation. A private
-//! supervisor owns its group and the original transcripts across Host loss.
 use super::*;
-use maka_host_runtime::ipc::{LocalListener, LocalStream};
-use maka_process::isolated::{Descriptor, TaskOwner};
-use std::{io, path::Path, process::Stdio};
-use tokio::{
-    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
-    process::ChildStdin,
-    sync::Mutex,
-    task::JoinSet,
-};
-mod router;
-pub use router::serve_front;
+use futures_util::StreamExt;
+use maka_process::isolated::{Descriptor, SessionSpool, TaskOwner};
+use serde::{Deserialize, Serialize};
+use serde_json::json;
+use std::collections::BTreeMap;
+use std::io;
+use std::path::PathBuf;
+use std::process::Stdio;
+use std::time::Duration;
+use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
+use tokio::process::{Child, ChildStdin};
+use tokio::sync::watch;
+use tokio_util::codec::{FramedRead, LinesCodec};
+
+/// Private helper mode for a single isolated Antigravity ACP Run.
 pub const FRONT_HELPER: &str = "--maka-agy-acp-front";
 
+const CLOSE_TIMEOUT: Duration = Duration::from_secs(2);
+
 #[derive(Serialize, Deserialize)]
 struct Launch {
     executable: PathBuf,
     args: Vec<String>,
     env: BTreeMap<String, String>,
+    resource: Descriptor,
 }
 
-#[derive(Serialize, Deserialize)]
-struct Connect {
-    socket: PathBuf,
-    resource: Descriptor,
+pub(super) struct Session {
+    pub stdin: ChildStdin,
+    pub stdout: BufReader<Box<dyn AsyncRead + Unpin + Send>>,
+    pub child: Child,
 }
 
-#[derive(Default)]
-pub(super) struct Fronts(Mutex<Pool>);
-#[derive(Default)]
-struct Pool {
-    fronts: BTreeMap<PathBuf, Front>,
-    supervisors: JoinSet<io::Result<()>>,
+pub(super) enum OpenError {
+    BeforeLaunch(Box<TaskOwner>, Error),
+    Closed(Error),
+    Unconfirmed(Error),
 }
-#[derive(Clone)]
-struct Front {
+
+pub(super) async fn open(
+    config: &NativeCommand,
+    cwd: &str,
+    owner: TaskOwner,
+    cancellation: &CancellationToken,
+    retired: &CancellationToken,
+) -> Result<Session, OpenError> {
+    let resolved = match runtime::resolve(config, cwd).await.require() {
+        Ok(resolved) => resolved.executable,
+        Err(error) => return Err(OpenError::BeforeLaunch(Box::new(owner), error)),
+    };
+    let resource = match owner.prepare_session(resolved.clone()).await {
+        Ok(resource) => resource,
+        Err(error) => return Err(OpenError::BeforeLaunch(Box::new(owner), provider(error))),
+    };
+    let start = match serde_json::to_vec(&Launch {
+        executable: resolved,
+        args: config.args.clone(),
+        env: config.env.clone(),
+        resource: resource.clone(),
+    }) {
+        Ok(start) => start,
+        Err(error) => return Err(OpenError::BeforeLaunch(Box::new(owner), provider(error))),
+    };
+
+    let mut command = tokio::process::Command::new(owner.helper_executable());
     #[cfg(windows)]
-    pid: u32,
-    ready: futures_util::future::Shared<BoxFuture<'static, Result<(), String>>>,
-    registrations: tokio::sync::mpsc::UnboundedSender<Vec<u8>>,
-    retire: CancellationToken,
-    exited: CancellationToken,
-}
-pub(super) struct Lease {
-    pub socket: LocalStream,
-    pub exited: CancellationToken,
-}
-impl Fronts {
-    pub(super) async fn open(
-        &self,
-        config: &NativeCommand,
-        cwd: &str,
-        owner: &mut Option<TaskOwner>,
-    ) -> Result<Lease, Error> {
-        let resolved = runtime::resolve(config, cwd).await.require()?.executable;
-        let task = owner.as_ref().expect("unregistered Run");
-        #[cfg(unix)]
-        let dir = tempfile::Builder::new()
-            .prefix("maka-acp-")
-            .permissions(std::os::unix::fs::PermissionsExt::from_mode(0o700))
-            .tempdir_in("/tmp")
-            .map_err(provider)?;
-        #[cfg(unix)]
-        let socket = dir.path().join("run");
-        #[cfg(windows)]
-        let socket = PathBuf::from(format!(r"\\.\pipe\maka-agy-{}", uuid::Uuid::new_v4()));
-        let mut listener = LocalListener::bind(&socket).map_err(provider)?;
-        let front = {
-            let mut pool = self.0.lock().await;
-            while let Some(result) = pool.supervisors.try_join_next() {
-                if let Err(error) = result.map_err(io::Error::other).and_then(|r| r) {
-                    tracing::warn!(%error,"agy ACP supervisor exited");
-                }
-            }
-            if pool
-                .fronts
-                .get(&resolved)
-                .is_none_or(|f| f.retire.is_cancelled() || f.exited.is_cancelled())
-            {
-                let launch = Launch {
-                    executable: resolved.clone(),
-                    args: config.args.clone(),
-                    env: config.env.clone(),
-                };
-                let front = Front::start(task.helper_e
```

**File**: `plugins/agent/native/src/executor/external/agy_front/router.rs` (removed, +0/-452)
```diff
@@ -1,452 +0,0 @@
-/*
- * Licensed to the Apache Software Foundation (ASF) under one
- * or more contributor license agreements.  See the NOTICE file
- * distributed with this work for additional information
- * regarding copyright ownership.  The ASF licenses this file
- * to you under the Apache License, Version 2.0 (the
- * "License"); you may not use this file except in compliance
- * with the License.  You may obtain a copy of the License at
- *
- *     http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing,
- * software distributed under the License is distributed on an
- * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
- * KIND, either express or implied.  See the License for the
- * specific language governing permissions and limitations
- * under the License.
- */
-
-use super::*;
-use futures_util::StreamExt;
-use maka_process::isolated::SessionSpool;
-use serde_json::json;
-use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
-use tokio::sync::{mpsc, watch};
-use tokio_util::codec::{FramedRead, LinesCodec};
-
-type Run = u64;
-enum Event {
-    Frame(Run, String),
-    Detached(Run),
-    CloseExpired(Run),
-}
-
-struct Route {
-    spool: SessionSpool,
-    written: watch::Sender<u64>,
-    session: Option<String>,
-    detached: bool,
-    expired: bool,
-}
-impl Route {
-    async fn emit(&mut self, frame: &Value) -> io::Result<()> {
-        let bytes = line(frame)?;
-        self.spool.output.write_all(&bytes).await?;
-        self.spool.output.flush().await?;
-        self.written.send_modify(|n| *n += bytes.len() as u64);
-        Ok(())
-    }
-}
-fn line(value: &Value) -> io::Result<Vec<u8>> {
-    let mut bytes = serde_json::to_vec(value)?;
-    bytes.push(b'\n');
-    Ok(bytes)
-}
-fn frames(read: impl AsyncRead) -> FramedRead<impl AsyncRead, LinesCodec> {
-    FramedRead::new(
-        read,
-        LinesCodec::new_with_max_length(runtime::MAX_MESSAGE_BYTES),
-    )
-}
-async fn copy_committed(
-    mut file: tokio::fs::File,
-    mut destination: impl AsyncWrite + Unpin,
-    mut committed: watch::Receiver<u64>,
-) -> io::Result<()> {
-    let mut offset = 0;
-    loop {
-        let end = *committed.borrow_and_update();
-        if end > offset {
-            let copied =
-                tokio::io::copy(&mut (&mut file).take(end - offset), &mut destination).await?;
-            if copied != end - offset {
-                return Err(io::Error::other("short ACP session transcript"));
-            }
-            offset = end;
-        }
-        if committed.changed().await.is_err() {
-            return Ok(());
-        }
-    }
-}
-
-struct Pending {
-    run: Run,
-    local: Option<u64>,
-    method: String,
-    resume: Option<String>,
-}
-
-struct Router {
-    routes: BTreeMap<Run, Route>,
-    sessions: BTreeMap<String, Run>,
-    pending: BTreeMap<u64, Pending>,
-    next_id: u64,
-    next_run: u64,
-    events: mpsc::Sender<Event>,
-    initialized: Value,
-    writer: maka_process::pipe::Input,
-    clients: JoinSet<()>,
-}
-impl Router {
-    async fn connect(&mut self, spec: Connect) -> io::Result<()> {
-        let path = spec.resource.resource_ref.join("owner/stdout.bin");
-        let spool = SessionSpool::open(spec.resource).await?;
-        let socket = match maka_host_runtime::ipc::connect(&spec.socket).await {
-            Ok(socket) => socket,
-            Err(_) => return spool.seal().await,
-        };
-        let (read, write) = tokio::io::split(socket);
-        let run = self.next_run;
-        self.next_run += 1;
-        let (written, committed) = watch::channel(0);
-        let file = tokio::fs::File::open(path).await?;
-        let tx = self.events.clone();
-        self.clients.spawn(async move {
-            let mut input = frames(read);
-            while let Some(Ok(line)) = input.next().await {
-                if tx.send(Event::Frame(run, line)).await.is_err() {
-                    return;
-                }
-            }
-            let _ = tx.send(Event::Detached(run)).await;
-        });
-        self.clients.spawn(async move {
-            // A slow or disconnected observer cannot block another session's replies.
-            if let Err(error) = copy_committed(file, write, committed).await
-                && !matches!(
-                    error.kind(),
-                    io::ErrorKind::BrokenPipe | io::ErrorKind::ConnectionReset
-                )
-            {
-                eprintln!("agy ACP session output: {error}");
-            }
-        });
-        self.routes.insert(
-            run,
-            Route {
-                spool,
-                written,
-                session: None,
-                detached: false,
-                expired: false,
-            },
-        );
-        Ok(())
-    }
-    async fn request(
-        &mut self,
-        run: Run,
-        local: Option<u64>,
-        method: &str,
-        mut message: Value,
-  
```

**File**: `plugins/agent/native/src/executor/external/runtime.rs` (modified, +4/-5)
```diff
@@ -500,7 +500,6 @@ async fn execute_observed(
         }
         NativeRuntime::Antigravity => {
             agy_acp::execute(
-                &external.agy_fronts,
                 config,
                 cwd,
                 &request,
@@ -740,16 +739,16 @@ pub(super) struct Pipe {
 }
 impl Pipe {
     pub(super) fn session(
-        socket: maka_host_runtime::ipc::LocalStream,
+        stdin: tokio::process::ChildStdin,
+        stdout: BufReader<Box<dyn tokio::io::AsyncRead + Unpin + Send>>,
         observation: Observation,
         stop: CancellationToken,
         failed: CancellationToken,
     ) -> Self {
-        let (read, write) = tokio::io::split(socket);
         Self {
             wire: Wire::Lines {
-                input: Box::new(write),
-                reader: BufReader::new(Box::new(read)),
+                input: Box::new(stdin),
+                reader: stdout,
                 buffer: Vec::new(),
             },
             next_id: 0,
```

**File**: `products/maka/cli/tests/external_jobs.rs` (modified, +221/-25)
```diff
@@ -507,6 +507,61 @@ impl Rig {
         {
             return self.controller.resource(pid);
         }
+        if let Some(pending) = events
+            .iter()
+            .find(|e| e["kind"] == "resume_pending" && e["pid"] == pid)
+            && !events
+                .iter()
+                .any(|e| e["kind"] == "ready" && e["pid"] == pid)
+        {
+            let thread = pending["thread"].as_str().unwrap().to_owned();
+            let path = self.sandbox.root.join("runtime-rust.sqlite");
+            return phase("locate pre-bind ACP resource", async {
+                let mut tick = tokio::time::interval(Duration::from_millis(20));
+                loop {
+                    tick.tick().await;
+                    let path = path.clone();
+                    let thread = thread.clone();
+                    let resource = tokio::task::spawn_blocking(move || {
+                        let db = rusqlite::Connection::open_with_flags(
+                            path,
+                            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
+                        )?;
+                        maka_event_log::content::register_sql_functions(&db)
+                            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
+                        let mut stmt = db.prepare(
+                            "SELECT json_extract(maka_content_text(c.payload, c.encoding), '$.payload.privateResource.resourceRef')
+                               FROM agent_runs r JOIN contents c
+                                 ON c.content_sha256 = json_extract(r.external, '$.descriptor.digest')
+                              WHERE json_extract(r.external, '$.binding') IS NULL
+                              ORDER BY r.rowid DESC",
+                        )?;
+                        let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
+                        for row in rows {
+                            if let Some(resource_ref) = row? {
+                                let stdin = PathBuf::from(&resource_ref).join("owner/stdin.bin");
+                                if let Ok(body) = std::fs::read_to_string(&stdin)
+                                    && body.contains("\"session/resume\"")
+                                    && body.contains(&thread)
+                                {
+                                    return Ok(Some(resource_ref));
+                                }
+                            }
+                        }
+                        Ok::<_, rusqlite::Error>(None)
+                    })
+                    .await
+                    .map_err(|error| error.to_string())?
+                    .map_err(|error| error.to_string())?;
+                    if let Some(resource) = resource {
+                        return Ok(Descriptor {
+                            resource_ref: resource.into(),
+                        });
+                    }
+                }
+            })
+            .await;
+        }
         let ready = events
             .iter()
             .find(|e| e["kind"] == "ready" && e["pid"] == pid)
@@ -1797,41 +1852,182 @@ async fn antigravity_keeps_the_peer_alive_while_a_worker_fails_to_close() {
         )
         .await?;
         let peer = phase("B is live", rig.controller.event("ACP-peer", "ready")).await?;
-        assert_eq!(first["front"], peer["front"]);
+        assert_ne!(first["front"], peer["front"]);
         assert_ne!(first["pid"], peer["pid"]);
 
-        let stop = mutate(&sdk, "agent", "stop", json!({"sessionId":a,"runId":run_a}));
-        let check = async {
-            phase(
-                "A's close is outstanding",
-                rig.controller.event("ACP-stuck-close", "close_pending"),
-            )
-            .await?;
-            let original = rig.resource(first["pid"].as_u64().unwrap()).await?;
-            assert!(
-                isolated::cleanup_evidence(&original)
-                    .await
-                    .map_err(|e| e.to_string())?
-                    .is_none()
-            );
-            rig.controller.send(
-                peer["pid"].as_u64().unwrap(),
-                json!({"action":"complete","promptId":peer["promptId"]}),
-            )?;
-            phase("B completes", terminal_state(&sdk, &b, &run_b, "completed")).await?;
-            phase("A has original closure evidence", sealed(original)).await?;
-            Ok::<_, String>(())
-        };
-        let (stopped, ()) = tokio::try_join!(stop, check)?;
+        let original_a = rig.resource(first["pid"].as_u64().unwrap()).await?;
+        let original_b = rig.resource(peer["pid"].as_u64().unwrap()).await?;
+
+        let stopped = phase(
+            "stop A while B stays active",
+            mutate(&sdk, "agent", "stop", json!({"sessionId":a,"runId":run_a})),
+        )
+        .await?;
         assert_eq!(stopped["requested"], true);
         phase(
-            "A is cancelled",
+            "A's
```

---

### Incident Patch 2: `5b0c2861` (2026-11-27)
**Commit Message**: fix(agent-state): avoid reading contents.encoding during v54 queue migration and fix clippy lints (#7375)

Cold upgrades from pre-v54 databases (caught by Upgrade Compatibility replay of
capsule-first-nightly.tar.gz at schema v52) run migration 54
(queue::rebuild_queue_projections) before migration 63 adds contents.encoding
and contents.logical_bytes. While the outer queue event scan checked
has_encoding_column, project() still called content::read, pin, run_head, and
artifacts::pin_request -> read::lookup -> tool::content_id which queried
contents.encoding / contents.logical_bytes unconditionally.

- Thread has_encoding_column once through replay_queue_events -> project ->
  exact_content / pin / run_head / artifacts::pin_request_with_encoding so
  pre-v63 cold upgrades use raw contents.payload / length(payload) with zero
  extra runtime probes on live paths.
- Add cold_v53_upgrade_rebuilds_queue_projections_before_contents_encoding
  regression test covering queued session artifact attachments and completion
  caller run_head lookup across a real v53 -> v66 cold upgrade.
- Clean up Rust 1.100 clippy warnings across maka-agent-state, maka-agent-engine,
  maka-agent-native, maka-i1

**File**: `platform/i18n/build.rs` (modified, +3/-6)
```diff
@@ -128,12 +128,9 @@ fn main() {
     code.push_str("        }\n    }\n\n");
 
     code.push_str("    pub fn from_exact_tag(tag: &str) -> Option<Self> {\n");
-    code.push_str("        for locale in Self::ALL {\n");
-    code.push_str("            if locale.tag().eq_ignore_ascii_case(tag) {\n");
-    code.push_str("                return Some(locale);\n");
-    code.push_str("            }\n");
-    code.push_str("        }\n");
-    code.push_str("        None\n");
+    code.push_str(
+        "        Self::ALL.into_iter().find(|&locale| locale.tag().eq_ignore_ascii_case(tag))\n",
+    );
     code.push_str("    }\n");
     code.push_str("}\n");
 
```

**File**: `platform/i18n/src/lib.rs` (modified, +11/-12)
```diff
@@ -271,19 +271,18 @@ pub fn resolve_translation<'a>(
                 }
             }
         }
-        if let Some((lang, _)) = normalized.split_once('-') {
-            if !lang.eq_ignore_ascii_case("zh") && !lang.eq_ignore_ascii_case("yue") {
-                if let Some(found) = lookup_ci(translations, lang) {
-                    return found;
-                }
-            }
+        if let Some((lang, _)) = normalized.split_once('-')
+            && !lang.eq_ignore_ascii_case("zh")
+            && !lang.eq_ignore_ascii_case("yue")
+            && let Some(found) = lookup_ci(translations, lang)
+        {
+            return found;
         }
-        if let Some(b) = builtin {
-            if b.fallbacks().contains(&BuiltinLocale::En) {
-                if let Some(found) = lookup_ci(translations, BuiltinLocale::En.tag()) {
-                    return found;
-                }
-            }
+        if let Some(b) = builtin
+            && b.fallbacks().contains(&BuiltinLocale::En)
+            && let Some(found) = lookup_ci(translations, BuiltinLocale::En.tag())
+        {
+            return found;
         }
     }
     fallback
```

**File**: `platform/i18n/src/plural.rs` (modified, +2/-2)
```diff
@@ -49,7 +49,7 @@ pub const fn plural_category(locale: BuiltinLocale, n: i64) -> PluralCategory {
         BuiltinLocale::Es | BuiltinLocale::It => {
             if abs == 1 {
                 PluralCategory::One
-            } else if abs != 0 && abs % 1_000_000 == 0 {
+            } else if abs != 0 && abs.is_multiple_of(1_000_000) {
                 PluralCategory::Many
             } else {
                 PluralCategory::Other
@@ -58,7 +58,7 @@ pub const fn plural_category(locale: BuiltinLocale, n: i64) -> PluralCategory {
         BuiltinLocale::Fr | BuiltinLocale::PtBr => {
             if abs == 0 || abs == 1 {
                 PluralCategory::One
-            } else if abs != 0 && abs % 1_000_000 == 0 {
+            } else if abs != 0 && abs.is_multiple_of(1_000_000) {
                 PluralCategory::Many
             } else {
                 PluralCategory::Other
```

**File**: `plugins/agent/engine/src/context_input.rs` (modified, +1/-4)
```diff
@@ -187,10 +187,7 @@ async fn fit_generated_summary(
         } else {
             format!(
                 "{notice}{}",
-                maka_agent_facts::i18n::summary::media_omitted(
-                    language,
-                    i64::try_from(omitted).unwrap_or(i64::MAX),
-                )
+                maka_agent_facts::i18n::summary::media_omitted(language, i64::from(omitted),)
             )
         };
         let omission = if omitted == 0 {
```

**File**: `plugins/agent/engine/src/history/canonical_prompt.rs` (modified, +82/-112)
```diff
@@ -758,91 +758,93 @@ pub(crate) async fn validate_external_media_directory(
     if !valid_version {
         return Err(invalid());
     }
-    let owner: Arc<dyn Send + Sync> = Arc::new(());
-    async fn read_record(
-        arena: &CaptureArena,
-        offset: u64,
+    struct MediaCheckCtx<'a> {
+        arena: &'a CaptureArena,
         byte_len: u64,
-        owner: &Arc<dyn Send + Sync>,
-    ) -> io::Result<Record> {
-        if offset
-            .checked_add(RECORD_BYTES as u64)
-            .is_none_or(|end| end > byte_len)
-        {
-            return Err(invalid());
-        }
-        let bytes = arena
-            .read_control_owned::<RECORD_BYTES>(offset, owner.clone())
-            .await?;
-        Ok(std::array::from_fn(|i| {
-            u64::from_le_bytes(bytes[i * 8..i * 8 + 8].try_into().unwrap())
-        }))
+        version: u32,
+        expected_media: &'a [([u8; 32], u64)],
+        owner: Arc<dyn Send + Sync>,
+        cancellation: &'a CancellationToken,
     }
-    async fn read_list_item(
-        arena: &CaptureArena,
-        list: List,
-        index: usize,
-        byte_len: u64,
-        owner: &Arc<dyn Send + Sync>,
-    ) -> io::Result<Record> {
-        let entry_offset = list
-            .offset
-            .checked_add((index as u64).checked_mul(8).ok_or_else(overflow)?)
-            .ok_or_else(overflow)?;
-        if entry_offset.checked_add(8).is_none_or(|end| end > byte_len) {
-            return Err(invalid());
+    impl MediaCheckCtx<'_> {
+        async fn read_record(&self, offset: u64) -> io::Result<Record> {
+            if offset
+                .checked_add(RECORD_BYTES as u64)
+                .is_none_or(|end| end > self.byte_len)
+            {
+                return Err(invalid());
+            }
+            let bytes = self
+                .arena
+                .read_control_owned::<RECORD_BYTES>(offset, self.owner.clone())
+                .await?;
+            Ok(std::array::from_fn(|i| {
+                u64::from_le_bytes(bytes[i * 8..i * 8 + 8].try_into().unwrap())
+            }))
         }
-        let bytes = arena
-            .read_control_owned::<8>(entry_offset, owner.clone())
-            .await?;
-        read_record(arena, u64::from_le_bytes(bytes), byte_len, owner).await
-    }
-    async fn check_content_list(
-        arena: &CaptureArena,
-        list: List,
-        byte_len: u64,
-        version: u32,
-        expected_media: &[([u8; 32], u64)],
-        referenced: &mut [bool],
-        owner: &Arc<dyn Send + Sync>,
-        cancellation: &CancellationToken,
-    ) -> io::Result<()> {
-        if list
-            .offset
-            .checked_add((list.len as u64).checked_mul(8).ok_or_else(overflow)?)
-            .is_none_or(|end| end > byte_len)
-        {
-            return Err(invalid());
+        async fn read_list_item(&self, list: List, index: usize) -> io::Result<Record> {
+            let entry_offset = list
+                .offset
+                .checked_add((index as u64).checked_mul(8).ok_or_else(overflow)?)
+                .ok_or_else(overflow)?;
+            if entry_offset
+                .checked_add(8)
+                .is_none_or(|end| end > self.byte_len)
+            {
+                return Err(invalid());
+            }
+            let bytes = self
+                .arena
+                .read_control_owned::<8>(entry_offset, self.owner.clone())
+                .await?;
+            self.read_record(u64::from_le_bytes(bytes)).await
         }
-        for i in 0..list.len {
-            if cancellation.is_cancelled() {
-                return Err(crate::preparation_cancelled(
-                    "frozen prompt restore cancelled",
-                ));
+        async fn check_content_list(&self, list: List, referenced: &mut [bool]) -> io::Result<()> {
+            if list
+                .offset
+                .checked_add((list.len as u64).checked_mul(8).ok_or_else(overflow)?)
+                .is_none_or(|end| end > self.byte_len)
+            {
+                return Err(invalid());
             }
-            let r = read_list_item(arena, list, i, byte_len, owner).await?;
-            match r[0] {
-                1 | 2 => {}
-                3 => {
-                    if version != 3 {
-                        return Err(invalid());
-                    }
-                    let slot = usize::try_from(r[1]).map_err(|_| invalid())?;
-                    let expected_bytes = r[2];
-                    let expected_digest = digest(&r[6..10]);
-                    let (actual_digest, actual_bytes) =
-                        expected_media.get(slot).ok_or_else(invalid)?;
-                    if *actual_digest != expected_digest || *actual_bytes != expected_bytes {
-                        return Err(invalid());
+            for i in 0..list.len {
+                if self.cancellation.is_cancelled() {
+                    return Err(crate::preparation_cancelled(
+     
```

**File**: `plugins/agent/engine/src/preparation/snapshot.rs` (modified, +1/-2)
```diff
@@ -940,7 +940,7 @@ mod tests {
                         Box::pin(async move { Ok(item) })
                     }
                 }
-                Box::new(VecCursor(self.0[start..].to_vec().into_iter()))
+                Box::new(VecCursor(Vec::from(&self.0[start..]).into_iter()))
             }
         }
 
@@ -1021,7 +1021,6 @@ mod tests {
             resident_bytes: base_meta + 64 * 1024,
             work_bytes: 64 * 1024,
             progress_bytes: 128 * 1024,
-            ..PreparationPolicy::default()
         })
         .unwrap();
         let many_parts: Vec<_> = (0u8..20)
```

**File**: `plugins/agent/native/src/executor/external/agy_front.rs` (modified, +1/-0)
```diff
@@ -117,6 +117,7 @@ impl Fronts {
             .send(registration)
             .map_err(|_| Error::Provider("agy ACP supervisor exited before admission".into()))?;
         owner.take();
+        #[cfg_attr(not(windows), allow(clippy::never_loop))]
         let socket = loop {
             let socket = tokio::select! {
                 connection = listener.accept() => connection.map_err(provider)?,
```

**File**: `plugins/agent/native/src/owner/completions.rs` (modified, +2/-4)
```diff
@@ -658,10 +658,8 @@ impl Owner {
         entries: Vec<Completion>,
         now: u64,
     ) -> Result<(), String> {
-        let mut groups: BTreeMap<
-            (String, String),
-            Vec<(Completion, CompletionRequest, MessageResolution)>,
-        > = BTreeMap::new();
+        type CompletionGroup = Vec<(Completion, CompletionRequest, MessageResolution)>;
+        let mut groups: BTreeMap<(String, String), CompletionGroup> = BTreeMap::new();
         let mut runs = BTreeSet::new();
         for entry in entries {
             let prepare = async {
```

---

### Incident Patch 3: `2df4f5c4` (2026-11-27)
**Commit Message**: fix(agent,memory): drop session visibility taint tracking and simplify memory replay (#7361)

* fix(agent,memory): drop session visibility taint tracking and simplify memory replay

Migration 0058 removes the session/history read taint tables, recursive CTE visibility-propagation triggers, external conversation epoch rotation, and session-recap visibility wrapper introduced in #7184, while keeping pinned memory admission/freezing, hidden_spans evidence masking, and agent_memory_tool_inputs tracking.

- Scope HasReads and CheckReads to agent_memory_tool_inputs joined directly against current active memory versions (removing the derived revoked column and trigger).
- Evaluate cross-run replay and Recall checkpoint sharing directly against producer agent_memory_tool_inputs so normal runs (including legacy MemoryReplay::Run checkpoints from #7184) reuse compaction checkpoints across turns without re-compacting, and archiving a read source session no longer kills in-flight runs.
- Restore external executor conversation keys to session_id and unwrap session-recap receipts in migration 0058.
- Replace the regression-locking test with behavioral coverage verifying archive survival and cros

**File**: `plugins/agent/native/src/owner/access/model.rs` (modified, +1/-5)
```diff
@@ -133,11 +133,7 @@ impl RunAccess {
             .await
             .map_err(memory_read_failure)?;
         let spec = self.spec();
-        if spec.memory_projection.is_none()
-            && !reads.facts
-            && !(reads.history
-                && spec.memory_admission == maka_agent_facts::memory::MemoryAdmission::Enabled)
-        {
+        if spec.memory_projection.is_none() && !reads.facts {
             return Ok(());
         }
 
```

**File**: `plugins/agent/native/src/owner/auxiliary.rs` (modified, +12/-28)
```diff
@@ -77,7 +77,6 @@ pub(super) enum Admission {
         execution: Execution,
     },
     Operation {
-        history_visibility: Option<u64>,
         reference: Box<maka_plugin_core::operation::RecoveryRef>,
         attempt: Option<std::num::NonZeroU32>,
         scope: Box<maka_event_log::applications::operations::OperationDispatchScope>,
@@ -125,7 +124,6 @@ impl Auxiliary {
         }
         let (source, binding, purpose, execution, session, operation) = match admission {
             Admission::Operation {
-                history_visibility,
                 reference,
                 attempt,
                 scope,
@@ -147,7 +145,7 @@ impl Auxiliary {
                     purpose,
                     execution,
                     session_id,
-                    Some((reference, scope, history_visibility)),
+                    Some((reference, scope)),
                 )
             }
             Admission::Source {
@@ -195,10 +193,6 @@ impl Auxiliary {
         let data = log
             .data_writer_for_work(custody.as_ref(), &session)
             .map_err(admission_error)?;
-        let guard = operation
-            .as_ref()
-            .and_then(|(_, _, visibility)| *visibility)
-            .map(|revision| (data.clone(), revision, session.clone()));
         let (journal, write) = UsageStore::new(data)
             .auxiliary(
                 AuxiliarySpec {
@@ -222,7 +216,7 @@ impl Auxiliary {
                 .map_err(admission_error)?,
         ));
         let lease = pending.0.take().expect("auxiliary lease");
-        let physical = if let Some((reference, dispatch, _)) = operation {
+        let physical = if let Some((reference, dispatch)) = operation {
             // The pending owner releases an unstarted lease if lookup fails.
             let mut pending = IdleLease(Some(lease));
             let operation = log.operation(&reference).map_err(admission_error)?;
@@ -252,26 +246,16 @@ impl Auxiliary {
         let id = custody.journal().id();
         let model_id = request.provider.model.clone();
         let result = async {
-            let stream = match guard {
-                Some((data, revision, session)) => {
-                    super::recap::stream(
-                        &self.models,
-                        request,
-                        cancellation.clone(),
-                        data,
-                        revision,
-                        session,
-                    )
-                    .await
-                }
-                None => self.models.stream(request, cancellation.clone()).await,
-            }
-            .map_err(|error| {
-                if error.cleanup_unconfirmed() {
-                    custody.phase = ProviderPhase::Active;
-                }
-                Error::Model(error)
-            })?;
+            let stream = self
+                .models
+                .stream(request, cancellation.clone())
+                .await
+                .map_err(|error| {
+                    if error.cleanup_unconfirmed() {
+                        custody.phase = ProviderPhase::Active;
+                    }
+                    Error::Model(error)
+                })?;
             custody.phase = ProviderPhase::Active;
             let generation = receive(stream, &mut custody, model_id, delta).await?;
             if generation.finish_reason == ModelFinishReason::ToolCalls {
```

**File**: `plugins/agent/native/src/owner/compaction.rs` (modified, +7/-15)
```diff
@@ -326,21 +326,13 @@ impl super::driver::NativeDriver {
         let user_run = writer
             .query(maka_agent_state::memory::reads::OriginalUserRun(view.run))
             .await?;
-        let (mut admission_kind, memory) = owner
-            .admit_memory(
-                session,
-                &metadata.configuration,
-                user_run.unwrap_or(true),
-                &policy,
-            )
-            .await
-            .map_err(RunError::InvalidInput)?;
-        if user_run.is_none() {
-            if memory.is_some() {
-                return Err(RunError::InvalidInput("original memory admission unavailable; start a new user Run to load pinned memory".into()));
-            }
-            admission_kind = maka_agent_facts::memory::MemoryAdmission::Unknown;
-        }
+        let (admission_kind, memory) = match user_run {
+            Some(user_run) => owner
+                .admit_memory(session, &metadata.configuration, user_run, &policy)
+                .await
+                .map_err(RunError::InvalidInput)?,
+            None => (maka_agent_facts::memory::MemoryAdmission::Unknown, None),
+        };
         if let Some(memory) = &memory {
             let system: Option<SystemPrompt> = owner
                 .run_content(view.run, &view.spec.system_prompt)
```

**File**: `plugins/agent/native/src/owner/driver/tests/model_recovery/preset_acceptance/pinned_memory.rs` (modified, +51/-24)
```diff
@@ -781,7 +781,8 @@ async fn expect_revoked(
 }
 
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
-async fn recall_without_memory_only_revokes_a_returned_source() -> TestResult<()> {
+async fn archiving_read_source_preserves_run_and_reuses_compaction_checkpoint_across_runs()
+-> TestResult<()> {
     let mut rig = Rig::new()?;
     let mut provider = Provider::start().await?;
     let base = rig.directory.path().to_owned();
@@ -811,7 +812,6 @@ async fn recall_without_memory_only_revokes_a_returned_source() -> TestResult<()
     .await?;
     let source = create(client, &base, &model, None).await?;
     let reader = create(client, &base, &model, None).await?;
-    let unrelated = create(client, &base, &model, None).await?;
     let source = source["id"].as_str().unwrap();
     let reader = reader["id"].as_str().unwrap();
     let marker = "Clementine field notes";
@@ -825,44 +825,71 @@ async fn recall_without_memory_only_revokes_a_returned_source() -> TestResult<()
     let (_, reply) = provider.next().await?;
     reply.reply_text("Filed.");
     quiescent_message(client, source, &sent["messageId"]).await?;
+
+    // Run 1 reads another session via Recall, then that source session is archived mid-Run.
+    // Archiving must not kill Run 1, and Run 1's compaction checkpoint must remain reusable by Run 2.
     let sent = call(
         client,
         "agent",
         "send",
-        json!({"sessionId":reader,"message":"Find the field notes"}),
+        json!({"sessionId":reader,"message":"Find the field notes and compact"}),
     )
     .await?;
     let (_, reply) = provider.next().await?;
     reply.send_plan(tool_response("Recall", json!({"terms":["clementine"]})));
     let (wire, reply) = provider.next().await?;
     assert!(wire["messages"].to_string().contains(marker), "{wire}");
-    let archived=call(client,"agent","changeSession",json!({
-        "sessionId":unrelated["id"], "expectedRevision":unrelated["revision"], "action":"archive"
-    })).await?;
-    assert_eq!(archived["kind"], "changed", "{archived}");
-    reply.send_plan(TurnPlan::http_error(
-        HttpErrorSpec::plain(429, "rate limited").with_header("retry-after", "0"),
-    ));
-    let (retry, reply) = provider.next().await?;
-    assert_eq!(retry["messages"], wire["messages"]);
     let owner = rig.captured.lock().unwrap().clone().unwrap();
-    let archived=call(client,"agent","changeSession",json!({
-        "sessionId":source, "expectedRevision":owner.session(source).await?.revision, "action":"archive"
-    })).await?;
+    let archived = call(
+        client,
+        "agent",
+        "changeSession",
+        json!({
+            "sessionId":source,
+            "expectedRevision":owner.session(source).await?.revision,
+            "action":"archive"
+        }),
+    )
+    .await?;
     assert_eq!(archived["kind"], "changed", "{archived}");
-    reply.reply_tool_call(
-        "lookup-again",
-        "Recall",
-        json!({"terms":["unmatchedsecondlookup"]}),
+
+    // Continue Run 1 with CompactContext; Run 1 must survive the archive and finish cleanly.
+    reply.send_plan(tool_response("CompactContext", json!({})));
+    let (_, summary_reply) = provider.next().await?;
+    let summary_text = "Compacted checkpoint after reading field notes.";
+    summary_reply.reply_text(summary_text);
+    let (post_compact_wire, post_compact_reply) = provider.next().await?;
+    assert!(
+        post_compact_wire["messages"]
+            .to_string()
+            .contains(summary_text),
+        "{post_compact_wire}"
     );
-    expect_revoked(
+    post_compact_reply.reply_text("Run 1 finished after compaction.");
+    quiescent_message(client, reader, &sent["messageId"]).await?;
+
+    // Run 2 sends a short follow-up: it must reuse Run 1's compacted checkpoint directly
+    // instead of discarding it and replaying raw pre-compaction history.
+    let followup = call(
         client,
-        &mut provider,
-        reader,
-        &sent["messageId"],
-        "memory tool input revoked",
+        "agent",
+        "send",
+        json!({"sessionId":reader,"message":"Continue"}),
     )
     .await?;
+    let (run2_wire, run2_reply) = provider.next().await?;
+    let run2_body = run2_wire["messages"].to_string();
+    assert!(
+        run2_body.contains(summary_text),
+        "Run 2 dropped Run 1's compaction checkpoint: {run2_wire}"
+    );
+    assert!(
+        !run2_body.contains(marker),
+        "Run 2 replayed pre-compaction raw history instead of checkpoint: {run2_wire}"
+    );
+    run2_reply.reply_text("Continued from checkpoint.");
+    quiescent_message(client, reader, &followup["messageId"]).await?;
+    assert!(provider.requests.try_recv().is_err());
     assert!(rig.finish().await.is_empty());
     Ok(())
 }
```

**File**: `plugins/agent/native/src/owner/driver/tests/tool_history.rs` (modified, +0/-23)
```diff
@@ -357,16 +357,6 @@ async fn assert_partial_result_pages(
         );
         input = json!({"sessionId":session,"cursor":page["transcript"]["afterCursor"]});
     }
-    let fenced = driver
-        .access
-        .data_writer()?
-        .query(maka_agent_state::memory::reads::CheckReads(
-            driver.access.execution().run_id,
-        ))
-        .await;
-    assert!(
-        matches!(fenced, Err(maka_event_log::StoreError::InvalidTransition(reason)) if reason.contains("memory tool input revoked"))
-    );
     reader.finish().await?;
     Ok(())
 }
@@ -465,19 +455,6 @@ async fn external_return_keeps_the_name_of_its_original_call() -> TestResult<()>
         session_id: session.clone(),
         turn_id: external.spec.turn_id,
     };
-    let external_reader = driver.owner.services.request_with_work(
-        maka_capabilities::call::Identity::Agent {
-            execution: execution.clone(),
-            operation_id: None,
-        },
-        CancellationToken::new(),
-        driver.access.custody().clone(),
-    )?;
-    driver
-        .owner
-        .record_history_read(external_reader.scope(), &session, None)
-        .await?;
-    external_reader.finish().await?;
     let task = ExternalTaskId::new();
     let key = ExternalEffectKey {
         task,
```

**File**: `plugins/agent/native/src/owner/driver_executor.rs` (modified, +1/-21)
```diff
@@ -680,19 +680,6 @@ impl DriverExecutor {
         request: &Request,
         cancellation: &CancellationToken,
     ) -> Result<maka_sandbox::Sandbox, RunError> {
-        let current = self
-            .access
-            .data_writer()
-            .map_err(RunError::Internal)?
-            .query(maka_agent_state::memory::reads::ExternalConversation(
-                request.execution.session_id.clone(),
-            ))
-            .await?;
-        if current != request.conversation_key {
-            return Err(RunError::FrozenMemoryDenied(
-                "external conversation input revoked; start a new Run".into(),
-            ));
-        }
         let configuration = self.access.live_configuration().await?;
         self.authority_floor(request, cancellation, configuration)
             .await
@@ -1041,14 +1028,7 @@ impl ExternalPorts for DriverExecutor {
                 task_id: task,
                 language: view.spec.language,
                 execution: self.access.execution().clone(),
-                conversation_key: self
-                    .access
-                    .data_writer()
-                    .map_err(RunError::InvalidInput)?
-                    .query(maka_agent_state::memory::reads::ExternalConversation(
-                        view.spec.session_id.clone(),
-                    ))
-                    .await?,
+                conversation_key: view.spec.session_id.clone(),
                 content,
                 cwd: view.spec.workspace.clone(),
                 instructions,
```

**File**: `plugins/agent/native/src/owner/execution.rs` (modified, +0/-22)
```diff
@@ -91,21 +91,11 @@ impl Owner {
                     ),
             } = &mut execution.state
         {
-            let before = self.history_read_start(scope).await?;
             *diagnostic = crate::service::history::scoped_state(self, scope)?
                 .session_history(view.spec.owner.clone(), view.spec.session_id.clone())
                 .mask_terminal_diagnostic(view.run, std::mem::take(diagnostic))
                 .await
                 .map_err(|error| error.to_string())?;
-            self.record_history_sources(
-                scope,
-                maka_agent_state::memory::reads::HistorySources::Producer {
-                    session: view.spec.session_id.clone(),
-                    run: view.run,
-                },
-                before,
-            )
-            .await?;
         }
         Ok(execution)
     }
@@ -193,7 +183,6 @@ impl Owner {
     ) -> Result<Work, String> {
         use maka_agent_state::queue::MessageResolution;
         self.scoped_session(scope, &input.session_id).await?;
-        let before = self.history_read_start(scope).await?;
         let state = crate::service::history::scoped_state(self, scope)?;
         let model_read = scope.identity.agent().is_some();
         let cursor = input.cursor.map(|cursor| (cursor.run_id, cursor.offset));
@@ -262,17 +251,6 @@ impl Owner {
             })
         };
         let execution = self.execution_for_reader(&observed.view, scope).await?;
-        if answer.is_some() {
-            self.record_history_sources(
-                scope,
-                maka_agent_state::memory::reads::HistorySources::Producer {
-                    session: input.session_id,
-                    run,
-                },
-                before,
-            )
-            .await?;
-        }
         Ok(Work::Delivered {
             shared,
             execution,
```

**File**: `plugins/agent/native/src/owner/memory.rs` (modified, +1/-44)
```diff
@@ -365,50 +365,7 @@ impl Owner {
         }
         management(scope)
     }
-    pub(crate) async fn history_read_start(&self, call: &Scope) -> Result<Option<u64>, String> {
-        if call.identity.agent().is_none() {
-            return Ok(None);
-        }
-        self.memory_data(call)?
-            .query(stored::reads::SearchVisibility)
-            .await
-            .map(Some)
-            .map_err(|e| e.to_string())
-    }
-    pub(crate) async fn record_history_read(
-        &self,
-        call: &Scope,
-        session: &str,
-        before: Option<u64>,
-    ) -> Result<Option<u64>, String> {
-        self.record_history_sources(
-            call,
-            stored::reads::HistorySources::session(session),
-            before,
-        )
-        .await
-    }
-    pub(crate) async fn record_history_sources(
-        &self,
-        call: &Scope,
-        sources: stored::reads::HistorySources,
-        before: Option<u64>,
-    ) -> Result<Option<u64>, String> {
-        if let Some(execution) = call.identity.agent() {
-            return self
-                .memory_data(call)?
-                .write(stored::reads::RecordHistory {
-                    sources,
-                    before,
-                    owner: self.run_owner(),
-                    execution: execution.clone(),
-                })
-                .await
-                .map(Some)
-                .map_err(|e| e.to_string());
-        }
-        Ok(None)
-    }
+
     pub(super) async fn record_memory_reads(
         &self,
         call: &Scope,
```

#### Recent Merged Pull Requests:
- **PR #7380** (2026-11-27): fix(release): avoid shadowing bundled static C libs in Linux zigbuild (@M4n5ter)
- **PR #7379** (2026-11-28): fix(external): isolate Antigravity ACP supervisor per Run (@M4n5ter)
- **PR #7375** (2026-11-27): fix(agent-state): fix v54 cold queue migration before contents.encoding and clean clippy lints (@M4n5ter)
- **PR #7373** (closed): fix(ios): polish offline copy/quote, non-drag top paging, and turn keys (@me2seeks)
- **PR #7367** (2026-11-27): fix(nsh): retain virtual list rows and layout across scope replacement (@me2seeks)
- **PR #7363** (2026-11-27): feat(ios): paginate chat lists and complete history turns on scroll (@me2seeks)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
