# Domain G — Architecture Intelligence: Architecture Intelligence: apache-maka-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "apache-maka-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T05:02:48.297Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-maka-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-maka-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T05:02:48.297Z`  
> **Learning ID**: `LEARN-EVO-apache-maka-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), B (Product Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), E (Creative Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from apache-maka-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-maka-learnings.md`  
> **Source**: github ([https://github.com/apache/maka](https://github.com/apache/maka))  
> **Source Version**: `218225f5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T05:02:37.704Z  
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
> **Harvest Timestamp**: 2026-11-27T05:02:37.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/maka`
- **Description**: Apache Maka (Incubating) is a high-performance agent workspace that keeps a complete record of everything it did.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 6014 stars

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

### Incident Patch 1: `85f66c80` (2026-11-26)
**Commit Message**: fix(agent): observe original CodeMode cells before retiring replaced Antigravity runs (#7308)

Observe original unsettled CodeMode cells via the already-constructed RunCells before attempting to retire a replaced external Antigravity run, keep unobservable child outcomes blocked instead of failing through fail_after_driver_error, preserve fenced cell cleanup checks in reconcile, and arm preflight RunCells cleanup signals once.

Generated-by: Maka

**File**: `plugins/agent/engine/src/driver/preflight.rs` (modified, +18/-1)
```diff
@@ -256,7 +256,10 @@ impl Engine {
                     "Expected a native external executor Run".into(),
                 ));
             }
-            if view.has_unsettled_recovery() || view.cells.values().any(|cell| cell.pending()) {
+            if self.resolve_recovered_cells(claim, &view, at).await? {
+                continue;
+            }
+            if view.has_unsettled_recovery() {
                 return Ok(None);
             }
             let diagnostic = "The external executor changed while the run was interrupted";
@@ -283,6 +286,11 @@ impl Engine {
                         }
                     }
                     None => {
+                        if task.cleanup != OperationCleanup::Confirmed
+                            || task.effects.values().any(|effect| effect.unsettled())
+                        {
+                            return Ok(None);
+                        }
                         if !view.stopped {
                             facts.push(Fact::StopRequested {
                                 diagnostic: diagnostic.into(),
@@ -295,6 +303,15 @@ impl Engine {
                 None if view.stopped => (Terminal::Cancelled, Some(diagnostic.into())),
                 None => (Terminal::Failed, Some(diagnostic.into())),
             };
+            let pending_cells = match terminal {
+                Terminal::Completed => view.cells.values().any(|cell| cell.pending()),
+                Terminal::Cancelled | Terminal::Failed => {
+                    view.cells.values().any(|cell| cell.has_unsettled_effects())
+                }
+            };
+            if pending_cells {
+                return Ok(None);
+            }
             facts.extend(
                 view.waits
                     .iter()
```

**File**: `plugins/agent/engine/src/reconcile.rs` (modified, +3/-5)
```diff
@@ -547,11 +547,9 @@ fn cell_action(view: &RunView, live: &Live, fenced: bool) -> Option<Action> {
                 )
             })
             || (interrupted && cell.children.values().any(|child| !child.known()));
-        let blocked = if fenced {
-            unknown || cell.children.values().any(|child| !child.known())
-        } else {
-            cell.blocks_effect_admission() || unknown
-        };
+        let blocked = cell.blocks_effect_admission()
+            || unknown
+            || (fenced && cell.children.values().any(|child| !child.known()));
         if blocked && !acknowledged {
             return Some(
                 if view
```

**File**: `plugins/agent/native/src/owner/driver/tests.rs` (modified, +1095/-4)
```diff
@@ -3256,7 +3256,7 @@ mod source_recovery {
             started.await?;
             observing.abort();
             assert!(observing.await.unwrap_err().is_cancelled());
-            owner.retain_original_scope(session.clone(), rig.lease.take().unwrap(), super::super::super::driver_cleanup::OriginalScope::Driver { driver: Some(driver.clone()), effects: rig.work_effects.take().unwrap(), state: driver.state.clone(), pending: None }).await;
+            owner.retain_original_scope(session.clone(), rig.lease.take().unwrap(), super::super::super::driver_cleanup::OriginalScope::Driver { driver: Some(driver.clone()), cells: None, effects: rig.work_effects.take().unwrap(), state: driver.state.clone(), pending: None }).await;
             assert_eq!(owner.close().await, Err("agent_cleanup_unconfirmed".into()));
             assert!(owner.runs.state().await.retained_cleanup.contains_key(&session));
             let mut physical = owner.physical_changes();
@@ -3314,7 +3314,7 @@ mod source_recovery {
             });
             owner.retain_original_scope(session.clone(), rig.lease.take().unwrap(),
                 super::super::super::driver_cleanup::OriginalScope::Driver {
-                    driver: Some(driver.clone()), effects: rig.work_effects.take().unwrap(),
+                    driver: Some(driver.clone()), cells: None, effects: rig.work_effects.take().unwrap(),
                     state: driver.state.clone(), pending: None,
                 }).await;
             let close_request = owner.runs.state().await.retained_cleanup[&session][0].close_request();
@@ -3421,6 +3421,7 @@ mod source_recovery {
                     rig.lease.take().unwrap(),
                     super::super::super::driver_cleanup::OriginalScope::Driver {
                         driver: Some(driver.clone()),
+                        cells: None,
                         effects: rig.work_effects.take().unwrap(),
                         state: driver.state.clone(),
                         pending: None,
@@ -4258,7 +4259,7 @@ mod model_recovery {
         facts: Vec<Value>,
     }
 
-    async fn root(base: &Path, create: bool) -> TestResult<Arc<RootStore>> {
+    pub(super) async fn root(base: &Path, create: bool) -> TestResult<Arc<RootStore>> {
         let base = base.to_path_buf();
         let owner = tokio::task::spawn_blocking(move || {
             let namespaces = RootNamespaces {
@@ -4283,7 +4284,7 @@ mod model_recovery {
     pub(super) async fn bootstrap(base: &Path, base_url: String, todo: bool) -> TestResult<Boot> {
         bootstrap_with(base, base_url, |config| config["todo"] = json!(todo)).await
     }
-    async fn bootstrap_with(
+    pub(super) async fn bootstrap_with(
         base: &Path,
         base_url: String,
         configure: impl FnOnce(&mut Value),
@@ -8986,6 +8987,1096 @@ async fn same_path_reclone_keeps_conversations_usable_and_grouped_without_marker
     assert!(cleanup.is_empty(), "{cleanup:?}");
 }
 
+mod replaced_antigravity_cell_recovery {
+    use super::*;
+    use crate::owner::driver::PreparedTool;
+    use crate::owner::driver::tests::model_recovery::call;
+    use maka_agent_facts::{
+        cells::{CellEvent, CellId, CellInterruption, CellOwner, CellStatus, CellVmBinding},
+        executor::{Selection, Settings},
+        external_effects::{ExternalEffectDescriptor, ExternalEffectEvent, ExternalEffectKey},
+        tool_call::ToolOrigin,
+        tools::{ToolExecutor, ToolFuture},
+    };
+
+    struct Gate {
+        entered: StdMutex<Option<oneshot::Sender<()>>>,
+        release: StdMutex<Option<oneshot::Receiver<()>>>,
+    }
+    impl ToolExecutor for Gate {
+        fn names(&self) -> Vec<String> {
+            vec!["gate".into()]
+        }
+        fn invoke(&self, _: String, _: Value, _: CancellationToken) -> ToolFuture {
+            let entered = self.entered.lock().unwrap().take().unwrap();
+            let release = self.release.lock().unwrap().take().unwrap();
+            Box::pin(async move {
+                entered
+                    .send(())
+                    .map_err(|_| ToolError::Failed("gate observer lost".into()))?;
+                release
+                    .await
+                    .map_err(|error| ToolError::Failed(error.to_string()))?;
+                Ok(json!("gate released"))
+            })
+        }
+    }
+
+    struct Seed {
+        owner: Arc<Owner>,
+        session: String,
+        run: RunId,
+        claim: maka_agent_state::DriverClaim,
+        spec: RunSpec,
+        task: ExternalTaskId,
+        key: ExternalEffectKey,
+        cell: CellId,
+    }
+
+    async fn setup_replaced_run_with_files(
+        rig: &mut Rig,
+        with_workspace_tools: bool,
+    ) -> Result<Seed, Box<dyn Error + Send + Sync>> {
+        let session = if with_workspace_tools {
+            let base = rig.directory.path().to_path_buf();
+            let boot =
+                model_recovery::bootstrap_with(&base, "http://127.0.0.1:1/v1".into(), |c
```

**File**: `plugins/agent/native/src/owner/driver_assembly.rs` (modified, +61/-3)
```diff
@@ -370,6 +370,7 @@ impl Owner {
             let (lease, effects) = scope.accept(cancellation.clone());
             scope_cleanup = maka_plugin_core::operation::OperationCleanup::Unconfirmed;
             let mut original_driver = None;
+            let mut preflight_cells: Option<Arc<driver_cells::RunCells>> = None;
             let mut cleanup_confirmed = false;
             let mut preflight_stage = Some(AuthorityStage::WorkspaceScope);
             let mut publication_store = self.durable.clone();
@@ -429,6 +430,7 @@ impl Owner {
                         driver::NativeBackend::Model { model, cells: cells.clone() }
                     }
                     (None, Some(accepted)) => {
+                        preflight_cells = cells.clone();
                         if let Some(exit) = self.interrupt_lost_bridge(&state, &claim, &view, cells.as_deref()).await? {
                             return Ok(exit);
                         }
@@ -438,7 +440,36 @@ impl Owner {
                                 if accepted.selection.executor == "external"
                                     && accepted.selection.settings.runtime.as_deref() == Some("antigravity") => {
                                 preflight_stage = None;
+                                if let Some(cells) = cells.as_deref() {
+                                    use maka_agent_engine::ports::CellPorts;
+                                    let current = state.frontier(view.run).await?;
+                                    for cell in current.cells.values() {
+                                        if cell.owner.run() != Some(current.run) {
+                                            continue;
+                                        }
+                                        if cell.has_unsettled_effects() {
+                                            match cells.observe_original_cell(&current, cell).await {
+                                                Ok(_) | Err(RunError::Blocked(_)) => {}
+                                                Err(RunError::Tool(
+                                                    error @ (maka_agent_facts::tools::ToolError::OutcomeUnknown(_)
+                                                    | maka_agent_facts::tools::ToolError::OperationUnknown { .. }),
+                                                )) => {
+                                                    tracing::warn!(
+                                                        run = %current.run,
+                                                        cell = %cell.id,
+                                                        %error,
+                                                        "Original Cell child outcome is unavailable while retiring replaced executor"
+                                                    );
+                                                }
+                                                Err(error) => return Err(error),
+                                            }
+                                        }
+                                    }
+                                }
                                 if let Some(exit) = Engine::new(state.clone()).retire_replaced_native_executor(&claim, UnixMillis(now() as i64)).await? {
+                                    if matches!(&exit, DriverExit::Terminal { .. }) {
+                                        self.wake_notify.notify_one();
+                                    }
                                     return Ok(exit);
                                 }
                                 preflight_stage = Some(AuthorityStage::BackendScope);
@@ -479,6 +510,7 @@ impl Owner {
                     workers,
                 ));
                 original_driver = Some(driver.clone());
+                preflight_cells = None;
                 if let Some(effects) = original_external_effects { driver.attach_external_effects(effects)?; }
                 self.runs.state().await.controls.insert(
                     view.spec.session_id.clone(),
@@ -617,9 +649,34 @@ impl Owner {
                 }
                 (result, _) => result,
             };
-            // Constructors before NativeDriver only assemble ports; none dispatch Run-owned work.
+            // Constructors before NativeDriver only assemble ports; preflight Cell
+            // observation must still prove its own VM/reader cleanup before releasing the Scope.
             // A pending canonical batch still owns its original payload independently of that proof.
-            if original_driver.is_none() && !matches!(&result, Err(RunError::PublicationUncertain { .. })) { cleanup_confirmed = true; }
+            if original_driver.is_none() && !matches!(&result, Err(RunError::PublicationUncertain { .. })) {
+                cleanup_confirmed = match &preflight_cells {
+                    Some(cells) => {
+                        cells.coordinator.cancel();
+                        cells.join_original
```

**File**: `plugins/agent/native/src/owner/driver_cells.rs` (modified, +19/-0)
```diff
@@ -82,6 +82,7 @@ pub(super) struct RunCells {
     effects: Arc<Mutex<BTreeMap<(CellId, Uuid), EffectCustody>>>,
     readers: Arc<Mutex<Vec<Arc<NativeRequest>>>>,
     workers: TaskTracker,
+    cleanup_signals_armed: Arc<std::sync::OnceLock<()>>,
     cleanup: Evidence,
 }
 struct OriginalPublication {
@@ -179,6 +180,7 @@ impl RunCells {
             effects: Arc::default(),
             readers: Arc::default(),
             workers,
+            cleanup_signals_armed: Arc::default(),
             cleanup,
         }))
     }
@@ -195,6 +197,23 @@ impl RunCells {
     pub(super) fn has_original_workers(&self) -> bool {
         !self.workers.is_empty()
     }
+    pub(super) fn close_original_workers(&self) {
+        self.workers.close();
+    }
+    pub(super) async fn join_original_workers(&self) {
+        self.workers.close();
+        self.workers.wait().await;
+    }
+    pub(super) fn original_cleanup_signals(&self) -> Vec<BoxFuture<'static, ()>> {
+        if self.cleanup_signals_armed.set(()).is_err() {
+            return Vec::new();
+        }
+        let workers = self.workers.clone();
+        workers.close();
+        vec![Box::pin(async move {
+            workers.wait().await;
+        })]
+    }
     pub(super) async fn original_cleanup_confirmed(&self) -> Result<bool, RunError> {
         // Shutdown joins the original coordinator tasks; its historical error is not positive or negative cleanup truth.
         let _shutdown = self.coordinator.shutdown().await;
```

**File**: `plugins/agent/native/src/owner/driver_cleanup.rs` (modified, +34/-6)
```diff
@@ -28,6 +28,7 @@ use maka_event_log::root_store::{RetainedWorkSettlement, SessionWorkLease, WorkE
 pub(super) enum OriginalScope {
     Driver {
         driver: Option<Arc<driver::NativeDriver>>,
+        cells: Option<Arc<driver_cells::RunCells>>,
         effects: WorkEffects,
         state: maka_agent_state::Store,
         pending: Option<Box<maka_agent_engine::PendingPublication>>,
@@ -74,6 +75,14 @@ impl OriginalScope {
                 driver: Some(driver),
                 ..
             } => driver.join_original_workers().await,
+            Self::Driver {
+                driver: None,
+                cells: Some(cells),
+                ..
+            } => {
+                cells.join_original_workers().await;
+                Ok(())
+            }
             Self::Preparation(Some(model)) => model.original_worker_join().await,
             _ => Ok(()),
         }
@@ -100,23 +109,36 @@ impl OriginalScope {
                 driver: Some(driver),
                 ..
             } => driver.original_cleanup_signals().await,
+            Self::Driver {
+                driver: None,
+                cells: Some(cells),
+                ..
+            } => cells.original_cleanup_signals(),
             _ => Vec::new(),
         }
     }
     async fn confirmed(&self) -> Result<bool, RunError> {
         match self {
             Self::Driver {
                 driver,
+                cells,
                 effects,
                 state,
                 pending,
             } => {
                 if let Some(pending) = pending {
                     pending.reconcile(state).await?;
                 }
-                let closed = match driver {
-                    Some(driver) => driver.original_cleanup_confirmed().await?,
-                    None => pending.is_some(),
+                let closed = match (driver, cells) {
+                    (Some(driver), _) => driver.original_cleanup_confirmed().await?,
+                    (None, Some(cells)) => {
+                        cells.coordinator.cancel();
+                        cells.close_original_workers();
+                        cells.coordinator.is_idle()
+                            && !cells.has_original_workers()
+                            && cells.original_cleanup_confirmed().await?
+                    }
+                    (None, None) => pending.is_some(),
                 };
                 Ok(closed && !effects.has_pending())
             }
@@ -240,9 +262,15 @@ impl RetainedScope {
                 };
                 model_changes = original.model_changes();
                 match original.as_ref() {
-                    OriginalScope::Driver { driver, .. } => {
-                        if let Some(driver) = driver
-                            && let Some(runtime) = driver.run_cells()
+                    OriginalScope::Driver {
+                        driver,
+                        cells: preflight_cells,
+                        ..
+                    } => {
+                        if let Some(runtime) = driver
+                            .as_ref()
+                            .and_then(|driver| driver.run_cells())
+                            .or(preflight_cells.as_ref())
                         {
                             let (js, python, coordinator) = runtime.physical_changes();
                             for receiver in [js, python, coordinator] {
```

---

### Incident Patch 2: `0ddb645a` (2026-11-26)
**Commit Message**: fix(workbench): assign explicit ownership to composer and settings notices (#7310)

* fix(workbench): assign explicit ownership to composer and settings notices

* fix(workbench): address review findings on conflict reload, room/intake attachments, and compact blocks

* fix(workbench): invalidate basis on configureBatch conflict and isolate external-agent read retry

* test(workbench): keep cached external agent switch enabled during SWR refresh

**File**: `packages/plugin-sdk/src/composer-view.ts` (modified, +9/-1)
```diff
@@ -245,6 +245,14 @@ export interface ComposerContinuation {
   };
 }
 
+export type ComposerSendBlockKind = 'transcript' | 'workspace' | 'attachments' | 'draft';
+
+/** Why sending is currently blocked, tagged with the surface that owns displaying it. */
+export interface ComposerSendBlock {
+  readonly kind: ComposerSendBlockKind;
+  readonly message: string;
+}
+
 /** A stable projection of the resident session, without its lifecycle or subscriptions. */
 export interface ComposerSession<Element = unknown> {
   quotes(): QuoteRef[];
@@ -263,7 +271,7 @@ export interface ComposerSession<Element = unknown> {
   previewImage(image: ComposerImagePreview): void;
   editable(): boolean;
   loading(): boolean;
-  blockedReason(): string;
+  sendBlock(): ComposerSendBlock | null;
   backend(): ComposerBackend;
   modelDetails(): ComposerModelDetails;
   refreshModel(): Promise<void>;
```

**File**: `packages/plugin-sdk/src/workbench-views.ts` (modified, +2/-0)
```diff
@@ -317,6 +317,8 @@ export interface SettingsPageNavigation {
   /** Returns a nested sub-page to its own root after `leave()` clears any unsaved draft. */
   returnToRoot?(): void;
   busy?(): boolean;
+  /** The page renders the shared operation error itself instead of the Settings header. */
+  ownsError?(): boolean;
   /** The page's one command, drawn beside its title. */
   action?(): SettingsPageAction | null;
 }
```

**File**: `plugins/agent/composer/ui/Composer.tsx` (modified, +9/-2)
```diff
@@ -193,13 +193,20 @@ export function Composer(props: ComposerViewInput<JSX.Element>) {
     const current = pending();
     if (current?.id === owner) completion.submitPending(current, text, expected);
   };
-  const blocked = () => props.session()?.blockedReason() ?? '';
+  const sendBlock = () => props.session()?.sendBlock() ?? null;
+  const blocked = () => sendBlock() !== null;
   const confirming = () =>
     !!props.session()?.loading() ||
     !!props.session()?.recovering() ||
     !!props.session()?.continuing() ||
     !!pending()?.sending();
-  const warning = () => (confirming() ? '' : blocked());
+  // Only draft blocks belong to the composer's own status row; workspace, transcript,
+  // and attachment-tray blocks are rendered by their owning surfaces.
+  const warning = () => {
+    if (confirming()) return '';
+    const block = sendBlock();
+    return block?.kind === 'draft' ? block.message : '';
+  };
   const cannotSend = () =>
     props.blocked?.() ||
     (props.session() === null &&
```

**File**: `plugins/agent/conversations/ui/CompactComposer.tsx` (modified, +30/-32)
```diff
@@ -17,7 +17,7 @@
  * under the License.
  */
 
-import { signal, Text, View, type InputRef, type JSX } from 'nsh';
+import { Text, View, type InputRef, type JSX } from 'nsh';
 import type { ClientDraftAttachment } from '../../../../packages/plugin-sdk/src/generated/runtime.js';
 import type { ComposerSession } from '../../../../packages/plugin-sdk/src/workbench-views.js';
 import { hasComposerContent } from '../../../../packages/plugin-sdk/src/composer-view.js';
@@ -35,17 +35,16 @@ export function CompactComposer(props: {
   chooseModel(): void;
   attach(node: InputRef): void;
 }) {
-  const refused = signal('');
   const running = () => (props.session()?.run() ?? null) !== null;
   const unavailable = () => props.session()?.modelDetails().kind === 'unavailable';
   const failure = () => {
     const session = props.session();
     if (!session) return '';
-    return (
-      session.error() ||
-      session.sends().find((send) => send.state === 'failed')?.detail ||
-      refused()
-    );
+    return session.error() || session.sends().find((send) => send.state === 'failed')?.detail || '';
+  };
+  const blockWarning = () => {
+    const block = props.session()?.sendBlock() ?? null;
+    return block && (block.kind === 'attachments' || block.kind === 'draft') ? block.message : '';
   };
   const send = () => {
     const session = props.session();
@@ -57,9 +56,8 @@ export function CompactComposer(props: {
       props.expand();
       return;
     }
-    const reason = session.blockedReason();
-    refused.set(reason);
-    if (!reason) session.submit({ text });
+    if (session.sendBlock()) return;
+    session.submit({ text });
   };
   return (
     <View>
@@ -69,10 +67,7 @@ export function CompactComposer(props: {
         placeholder={props.session()?.empty() === false ? tr('Ask a follow-up') : tr('Ask Maka')}
         value={props.session()?.draft() ?? ''}
         readonly={!(props.session()?.editable() ?? false)}
-        change={(value) => {
-          refused.set('');
-          props.session()?.changeDraft(value);
-        }}
+        change={(value) => props.session()?.changeDraft(value)}
         submit={send}
         extra={
           <>
@@ -123,28 +118,31 @@ export function CompactComposer(props: {
           </>
         }
       />
-      <If when={unavailable() || failure() !== ''}>
+      <If when={unavailable() || failure() !== '' || blockWarning() !== ''}>
         <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
           <If
             when={unavailable()}
             else={
-              <InlineCallout
-                tone="danger"
-                message={failure()}
-                onDismiss={() => {
-                  const session = props.session();
-                  if (session?.error()) {
-                    session.dismissError();
-                    return;
-                  }
-                  const failedSend = session?.sends().find((item) => item.state === 'failed');
-                  if (session && failedSend) {
-                    void session.dismissSend(failedSend.id);
-                    return;
-                  }
-                  refused.set('');
-                }}
-              />
+              <If
+                when={failure() !== ''}
+                else={<InlineCallout tone="warning" message={blockWarning()} />}
+              >
+                <InlineCallout
+                  tone="danger"
+                  message={failure()}
+                  onDismiss={() => {
+                    const session = props.session();
+                    if (session?.error()) {
+                      session.dismissError();
+                      return;
+                    }
+                    const failedSend = session?.sends().find((item) => item.state === 'failed');
+                    if (session && failedSend) {
+                      void session.dismissSend(failedSend.id);
+                    }
+                  }}
+                />
+              </If>
             }
           >
             <InlineCallout
```

**File**: `plugins/agent/conversations/ui/Conversation.tsx` (modified, +51/-35)
```diff
@@ -176,6 +176,7 @@ import type {
   ComposerPrediction,
   ComposerQueue,
   ComposerSendAction as SendAction,
+  ComposerSendBlock,
   ComposerSendStatus,
 } from '../../../../packages/plugin-sdk/src/composer-view.js';
 import { hasComposerContent } from '../../../../packages/plugin-sdk/src/composer-view.js';
@@ -3466,7 +3467,7 @@ export function Conversation(props: ConversationProps) {
       draft().trim() ||
       attachments.files().length ||
       quotes().length ||
-      sendBlockedReason() ||
+      sendBlock() !== null ||
       observed === null ||
       observed.source.sessionId !== source.sessionId ||
       observed.source.runId !== source.runId ||
@@ -3592,38 +3593,52 @@ export function Conversation(props: ConversationProps) {
     };
   };
 
-  const sendBlockedReasonFor = (includeAutoSend: boolean) => {
-    if (transcriptStatus() === 'closing')
-      return tr('Closing disconnected updates… Your draft is kept.');
-    if (transcriptStatus() === 'failed')
-      return ready()
-        ? tr('Updates disconnected. Reconnecting automatically; your draft is kept.')
-        : tr('History unavailable. Retrying automatically; your draft is kept.');
-    if (ready() && transcriptStatus() !== 'live')
-      return tr('Reconnecting updates… Your draft is kept.');
+  const sendBlockFor = (includeAutoSend: boolean): ComposerSendBlock | null => {
+    if (
+      transcriptStatus() === 'closing' ||
+      transcriptStatus() === 'failed' ||
+      (ready() && transcriptStatus() !== 'live')
+    )
+      return { kind: 'transcript', message: tr('Reconnecting updates… Your draft is kept.') };
     if (!ready() || (runId() !== null && runBackend() === null))
-      return tr('Loading session history… Your draft is kept.');
+      return { kind: 'draft', message: tr('Loading session history… Your draft is kept.') };
     if (archived() && formerBot())
-      return tr(
-        'This is a Bot that was replaced. It is read-only; restore it in Sessions to use it as a conversation.',
-      );
+      return {
+        kind: 'draft',
+        message: tr(
+          'This is a Bot that was replaced. It is read-only; restore it in Sessions to use it as a conversation.',
+        ),
+      };
     if (archived())
-      return tr(
-        'This conversation is archived. Restore it in Sessions to send; your draft is kept.',
-      );
-    if (workspaceUnavailable()) return tr('The workspace for this task is unavailable.');
-    if (!draftReady() || restoringSends().size > 0) return tr('Loading the saved draft…');
-    if (savingFailed()) return tr('The draft could not be saved. Sending is unavailable.');
-    if (attachments.blocked()) return attachments.blocked();
-    if (confirmingContinuation()) return tr('Confirming continuation…');
+      return {
+        kind: 'draft',
+        message: tr(
+          'This conversation is archived. Restore it in Sessions to send; your draft is kept.',
+        ),
+      };
+    if (workspaceUnavailable())
+      return { kind: 'workspace', message: tr('The workspace for this task is unavailable.') };
+    if (!draftReady() || restoringSends().size > 0)
+      return { kind: 'draft', message: tr('Loading the saved draft…') };
+    if (savingFailed())
+      return {
+        kind: 'draft',
+        message: tr('The draft could not be saved. Sending is unavailable.'),
+      };
+    const attachmentBlock = attachments.blocked();
+    if (attachmentBlock) return attachmentBlock;
+    if (confirmingContinuation()) return { kind: 'draft', message: tr('Confirming continuation…') };
     if (sending() || (includeAutoSend && autoSending()))
-      return tr('Saving message… New typing is kept.');
+      return { kind: 'draft', message: tr('Saving message… New typing is kept.') };
     if (freezeState().kind === 'failed')
-      return tr('Retry or remove the unsaved message before sending another.');
-    if (!receiptsKnown()) return tr('Checking send status…');
-    return '';
+      return {
+        kind: 'draft',
+        message: tr('Retry or remove the unsaved message before sending another.'),
+      };
+    if (!receiptsKnown()) return { kind: 'draft', message: tr('Checking send status…') };
+    return null;
   };
-  const sendBlockedReason = () => sendBlockedReasonFor(true);
+  const sendBlock = () => sendBlockFor(true);
 
   const refreshSends = async () => {
     const operations = await pendingSends(client);
@@ -3669,7 +3684,7 @@ export function Conversation(props: ConversationProps) {
         });
     } catch (reason) {
       if (alive && errorMessage(reason) === 'agent_workspace_unavailable') {
-        sendError(id, new UiError('The workspace for this task is unavailable.'));
+        sendError(id, new UiError('Not sent. Choose a workspace, then retry.'));
         void refreshWorkspace().catch(report);
       } else {
         sendError(id, reason);
@@ -3741,7 +3756,7 @@ export function Conversation(props: ConversationProps) {
     if (!hasComposerConten
```

**File**: `plugins/agent/conversations/ui/SessionSurface.tsx` (modified, +3/-3)
```diff
@@ -3180,7 +3180,7 @@ export function createConversationUi(
                 <SideReactions
                   followUp={(item) => {
                     const session = composerSession();
-                    if (session && !session.blockedReason()) session.submit({ text: item.message });
+                    if (session && !session.sendBlock()) session.submit({ text: item.message });
                   }}
                   attached={sideAttached}
                   attach={() => {
@@ -3484,7 +3484,7 @@ export function createConversationUi(
           owner.connected() &&
           owner.editable() &&
           owner.run() !== null &&
-          !owner.blockedReason() &&
+          !owner.sendBlock() &&
           hasComposerContent(owner.draft().trim(), owner.attachments.files(), owner.quotes()) &&
           !matchComposerCommand(
             commandCandidates().map((entry) => entry.metadata),
@@ -3646,7 +3646,7 @@ function projectComposerSession(
     previewImage: owner.previewImage,
     editable: owner.editable,
     loading: owner.loading,
-    blockedReason: owner.blockedReason,
+    sendBlock: owner.sendBlock,
     backend: owner.backend,
     modelDetails: owner.modelDetails,
     refreshModel: owner.refreshModel,
```

**File**: `plugins/agent/conversations/ui/sendReceipt.ts` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ export function sendReceiptFailure(
     case 'turn_stopped':
       return { detail: message('Stopped before delivery. Your message is kept.'), retryable: true };
     case 'workspace_unavailable':
-      return { detail: message('The workspace for this task is unavailable.'), retryable: true };
+      return { detail: message('Not sent. Choose a workspace, then retry.'), retryable: true };
     case 'model_unavailable':
       return {
         detail: message('The selected model is unavailable. Try again or choose another model.'),
```

**File**: `plugins/settings/settings/ui.tsx` (modified, +2/-1)
```diff
@@ -393,7 +393,7 @@ export const activate: UiModule<JSX.Element>['activate'] = (context) => {
                   when={form.editor() !== null}
                   else={
                     <If when={!!operations.error()} else={<SettingsSkeleton rows={3} />}>
-                      <SettingsProblem message={operations.error()} retry={() => void open()} />
+                      <SettingsProblem retry={() => void open()} />
                     </If>
                   }
                 >
@@ -456,6 +456,7 @@ export const activate: UiModule<JSX.Element>['activate'] = (context) => {
               },
               backLabel: () => tr('Back from connection settings'),
               busy: operations.navigationBusy,
+              ownsError: () => connections.page() === 'providers',
             },
             () => <ConnectionSettings owner={connections} externalAgents={externalAgents} />,
           ),
```

---

### Incident Patch 3: `3d38b934` (2026-11-27)
**Commit Message**: fix(workbench,ios): confine switch press targets to the switch control (#7330)

* fix(workbench,ios): confine switch press targets to the switch control

Previously SettingsSwitch passed onPress to SettingsRow, turning the
entire row (including labels, descriptions, and multi-line detail blocks
such as UsageLimits in External agents) into one large Button. Clicking
anywhere in an external agent card or hovering across it treated the
whole area as a toggle button, and static SettingsRow entries also set
pointerEvents: 'none' on their content wrapper, blocking interactive
elements inside detail.

- Add SettingsSwitchControl on nsh/base Switch (with proper switch role,
  light/dark styling, hitSlop, hover/focus, and terminal support) and
  have SettingsSwitch render a static SettingsRow with only the trailing
  switch interactive.
- Only apply pointerEvents: 'none' to SettingsRow content when the row
  itself is clickable (has onPress).
- Reuse SettingsSwitchControl and full-width RowLine in ConnectionForm
  and QuickTools split rows (and simplify non-configurable QuickTools
  rows to SettingsSwitch).
- Apply the same fix to generative UI Switch (spec/components.tsx) and
  iOS Setting

**File**: `products/maka/ios-shell/app/screens/settings/SettingsForm.tsx` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@ export function SettingSwitch(props: {
       title={props.title}
       disabled={props.disabled}
       divider={props.divider}
-      onPress={() => props.change(!props.checked)}
+      accessible={false}
       trailing={
         <Switch
           accessibilityLabel={props.title}
```

**File**: `products/maka/ios-shell/app/screens/settings/SettingsRootScreen.tsx` (modified, +1/-0)
```diff
@@ -262,6 +262,7 @@ export function SettingsRootScreen(props: {
                 <IconBadge name="haptics" background={token('teal')} size={28} iconSize={16} />
               }
               title={tr('Haptic Feedback')}
+              accessible={false}
               trailing={
                 <Switch
                   accessibilityLabel={tr('Haptic Feedback')}
```

**File**: `products/maka/ios-shell/app/ui/InsetGroup.tsx` (modified, +8/-1)
```diff
@@ -123,6 +123,7 @@ export function GroupRow(props: {
   disabled?: boolean;
   divider?: boolean;
   dividerInset?: number;
+  accessible?: boolean;
   accessibilityLabel?: string;
   testID?: string;
   onPress?: () => void;
@@ -209,7 +210,13 @@ export function GroupRow(props: {
       <If
         when={props.onPress && !props.disabled}
         else={
-          <View testID={props.testID} accessibilityLabel={props.accessibilityLabel ?? props.title}>
+          <View
+            testID={props.testID}
+            accessible={props.accessible}
+            accessibilityLabel={
+              props.accessible === false ? undefined : (props.accessibilityLabel ?? props.title)
+            }
+          >
             {rowContent}
           </View>
         }
```

**File**: `products/maka/workbench/app/ConnectionForm.tsx` (modified, +19/-24)
```diff
@@ -18,21 +18,23 @@
  */
 
 import { cleanup, computed, effect, inputAction, signal, Text, View } from 'nsh';
-import { Switch } from 'nsh/base';
 import type { CredentialStatus } from '../../../../packages/plugin-sdk/src/generated/runtime';
 import type { ModelSettingsOwner } from './settings';
 import { ConnectionLogin } from './ConnectionLogin';
 import { useHost } from './host';
 import { tr } from './locale';
 import {
+  RowLine,
   SettingsBody,
   SettingsButton,
   SettingsInput,
   SettingsRow,
   SettingsSearch,
   SettingsSection,
   SettingsSwitch,
+  SettingsSwitchControl,
   SettingsTextArea,
+  settingsInset,
 } from './SettingsPage';
 import { C, captionTextStyle } from './ui';
 
@@ -167,6 +169,7 @@ export function ConnectionForm(props: { settings: ModelSettingsOwner }) {
           <Each of={owner.filteredModels()} key={(id) => id}>
             {(id) => (
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>
+                <RowLine />
                 <View style={{ flex: 1, minWidth: 0 }}>
                   <SettingsRow
                     label={name(id())}
@@ -180,38 +183,30 @@ export function ConnectionForm(props: { settings: ModelSettingsOwner }) {
                       </If>
                     }
                     opens
+                    line={false}
                     disabled={disabled() || owner.dirty()}
                     onPress={inputAction(owner.editModel, { ...owner.action(), id: id() })}
                   />
                 </View>
-                <Switch
-                  accessibilityLabel={tr('{label}: {state}', {
-                    label: name(id()),
-                    state: owner.enabledModels().has(id()) ? tr('On') : tr('Off'),
-                  })}
-                  checked={owner.enabledModels().has(id())}
-                  disabled={disabled() || owner.dirty()}
-                  onChange={inputAction(owner.setModelEnabled, {
-                    ...owner.action(),
-                    id: id(),
-                    enabled: !owner.enabledModels().has(id()),
-                  })}
+                <View
                   style={{
-                    width: 52,
+                    paddingHorizontal: settingsInset,
                     alignSelf: 'stretch',
                     alignItems: 'center',
                     justifyContent: 'center',
                   }}
-                  trackClass="w-[32px] h-[16px] p-[3px] rounded-full flex-row items-center checked:justify-end"
-                  trackStyle={{
-                    backgroundColor: owner.enabledModels().has(id()) ? C.accent : C.line,
-                  }}
-                  thumbClass="size-[10px] rounded-full"
-                  thumbStyle={{
-                    backgroundColor: owner.enabledModels().has(id()) ? C.onAccent : C.secondary,
-                  }}
-                  disabledStyle={{ opacity: 0.5 }}
-                />
+                >
+                  <SettingsSwitchControl
+                    accessibilityLabel={name(id())}
+                    checked={owner.enabledModels().has(id())}
+                    disabled={disabled() || owner.dirty()}
+                    onChange={inputAction(owner.setModelEnabled, {
+                      ...owner.action(),
+                      id: id(),
+                      enabled: !owner.enabledModels().has(id()),
+                    })}
+                  />
+                </View>
               </View>
             )}
           </Each>
```

**File**: `products/maka/workbench/app/ExternalAgentSettings.tsx` (modified, +0/-3)
```diff
@@ -135,9 +135,6 @@ export function ExternalAgentSection(props: { owner: ExternalAgentSettingsOwner;
                     </If>
                   </>
                 }
-                accessibilityLabel={tr(runtime().enabled ? 'Disable {name}' : 'Enable {name}', {
-                  name: runtime().name,
-                })}
                 checked={runtime().enabled}
                 disabled={owner.disabled()}
                 onPress={
```

**File**: `products/maka/workbench/app/PluginSettings.tsx` (modified, +0/-3)
```diff
@@ -202,9 +202,6 @@ function PluginDetail(props: { owner: PluginSettingsOwner; request: PluginAction
       >
         <SettingsSwitch
           label={tr('Enabled')}
-          accessibilityLabel={
-            plugin().disabled ? tr('Enable Host plugin') : tr('Disable Host plugin')
-          }
           status={
             plugin().parentDisabled
               ? tr('Enable the parent plugin before enabling this child.')
```

**File**: `products/maka/workbench/app/QuickTools.tsx` (modified, +36/-27)
```diff
@@ -31,9 +31,7 @@ import {
   type SettingsPageInput,
   type SettingsPageNavigation,
 } from '../../../../packages/plugin-sdk/src/workbench-views.js';
-import { Button } from 'nsh/base';
 import { PluginIcon } from './PluginIcon';
-import { ChoiceIndicator } from './ChoiceIndicator';
 import { sameValue } from '../../../../plugins/shared/value';
 import { localizedPresentation, tr } from './locale';
 import { contributionTitle } from './plugins/context';
@@ -46,12 +44,15 @@ import {
   type ToolEntry,
 } from './QuickCommands';
 import {
+  RowLine,
   SettingsBody,
   SettingsProblem,
   SettingsRow,
   SettingsSection,
   SettingsSwitch,
+  SettingsSwitchControl,
   settingsGutter,
+  settingsInset,
 } from './SettingsPage';
 import { errorText, renderText } from './text';
 
@@ -425,39 +426,47 @@ export function QuickToolsSettings(props: {
           >
             <Each of={quick.tools()} key={(item: UiContributionRef) => item.key}>
               {(item) => (
-                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
-                  <View style={{ flex: 1 }}>
-                    <If
-                      when={quick.configurable(item())}
-                      else={<SettingsRow label={quick.title(item())} leading={mark(item())} />}
-                    >
+                <If
+                  when={quick.configurable(item())}
+                  else={
+                    <SettingsSwitch
+                      label={quick.title(item())}
+                      leading={mark(item())}
+                      checked={quick.toolEnabled(item())}
+                      disabled={!quick.ready()}
+                      onPress={() => quick.toggleTool(item())}
+                    />
+                  }
+                >
+                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
+                    <RowLine />
+                    <View style={{ flex: 1, minWidth: 0 }}>
                       <SettingsRow
                         label={quick.title(item())}
                         leading={mark(item())}
                         description={summary(item()) || undefined}
                         opens
+                        line={false}
                         onPress={() => selected.set(item())}
                       />
-                    </If>
+                    </View>
+                    <View
+                      style={{
+                        paddingHorizontal: settingsInset,
+                        alignSelf: 'stretch',
+                        alignItems: 'center',
+                        justifyContent: 'center',
+                      }}
+                    >
+                      <SettingsSwitchControl
+                        accessibilityLabel={quick.title(item())}
+                        checked={quick.toolEnabled(item())}
+                        disabled={!quick.ready()}
+                        onChange={() => quick.toggleTool(item())}
+                      />
+                    </View>
                   </View>
-                  <Button
-                    accessibilityLabel={tr('{label}: {state}', {
-                      label: quick.title(item()),
-                      state: quick.toolEnabled(item()) ? tr('On') : tr('Off'),
-                    })}
-                    selected={quick.toolEnabled(item())}
-                    disabled={!quick.ready()}
-                    onPress={() => quick.toggleTool(item())}
-                    style={{
-                      width: 52,
-                      height: 42,
-                      alignItems: 'center',
-                      justifyContent: 'center',
-                    }}
-                  >
-                    <ChoiceIndicator kind="switch" checked={quick.toolEnabled(item())} />
-                  </Button>
-                </View>
+                </If>
               )}
             </Each>
             <If when={quick.tools().length === 0}>
```

**File**: `products/maka/workbench/app/SettingsPage.tsx` (modified, +67/-19)
```diff
@@ -19,8 +19,7 @@
 
 import { Canvas, platform, Scroll, signal, Text, View, windowSize, type JSX } from 'nsh';
 import type { InputRef, ScrollRef } from 'nsh';
-import { Button, Input, Select } from 'nsh/base';
-import { ChoiceIndicator } from './ChoiceIndicator';
+import { Button, Input, Select, Switch } from 'nsh/base';
 import { Icon } from './Icon';
 import { tr } from './locale';
 import {
@@ -224,17 +223,20 @@ export type SettingsRowProps = {
   tone?: 'muted' | 'danger';
   /** A page below: draws the chevron. */
   opens?: boolean;
+  /** Draws the hairline above the row (default true). Pass false when an outer split row owns the line. */
+  line?: boolean;
   onPress?: () => void;
   accessibilityLabel?: string;
   disabled?: boolean;
   selected?: boolean;
 };
 
 export function SettingsRow(props: SettingsRowProps) {
+  const passThrough = () => (props.onPress ? ({ pointerEvents: 'none' } as const) : undefined);
   const content = () => (
     <>
       {props.leading}
-      <View style={[{ flex: 1, minWidth: 0, gap: textGap }, { pointerEvents: 'none' }]}>
+      <View style={[{ flex: 1, minWidth: 0, gap: textGap }, passThrough()]}>
         <Text
           style={[
             {
@@ -252,7 +254,7 @@ export function SettingsRow(props: SettingsRowProps) {
         {props.detail}
       </View>
       <If when={props.status}>
-        <Text style={[{ ...captionTextStyle, color: C.warning }, { pointerEvents: 'none' }]}>
+        <Text style={[{ ...captionTextStyle, color: C.warning }, passThrough()]}>
           {props.status}
         </Text>
       </If>
@@ -274,18 +276,21 @@ export function SettingsRow(props: SettingsRowProps) {
       focusStyle={quietFocusStyle()}
       disabledStyle={controlDisabledStyle}
     >
-      <RowLine />
+      <If when={props.line !== false}>
+        <RowLine />
+      </If>
       {content()}
     </Button>
   ) : (
     <View style={rowStyle}>
-      <RowLine />
+      <If when={props.line !== false}>
+        <RowLine />
+      </If>
       {content()}
     </View>
   );
 }
 
-/** An immediate on/off setting: the whole row toggles it. */
 export function SettingsMonogram(props: { name: string; muted: boolean }) {
   return (
     <If when={!terminal}>
@@ -317,6 +322,54 @@ export function SettingsMonogram(props: { name: string; muted: boolean }) {
   );
 }
 
+/** A standalone on/off switch control; only the switch itself is interactive. */
+export function SettingsSwitchControl(props: {
+  accessibilityLabel: string;
+  checked: boolean;
+  disabled?: boolean;
+  onChange(): void;
+}) {
+  return (
+    <Switch
+      accessibilityLabel={props.accessibilityLabel}
+      checked={props.checked}
+      disabled={props.disabled}
+      onChange={props.onChange}
+      hitSlop={terminal ? undefined : 6}
+      style={{
+        flexShrink: 0,
+        borderRadius: terminal ? 0 : 9999,
+        alignItems: 'center',
+        justifyContent: 'center',
+        cursor: props.disabled || terminal ? undefined : 'pointer',
+      }}
+      trackClass="w-[32px] h-[16px] p-[3px] rounded-full flex-row items-center checked:justify-end"
+      trackStyle={{
+        backgroundColor: props.checked && !props.disabled ? C.accent : C.line,
+      }}
+      thumbClass="size-[10px] rounded-full"
+      thumbStyle={{
+        backgroundColor:
+          props.checked && !props.disabled ? C.onAccent : isDark() ? C.secondary : C.background,
+      }}
+      hoverStyle={terminal || props.disabled ? undefined : { opacity: 0.85 }}
+      activeStyle={terminal || props.disabled ? undefined : { opacity: 0.72 }}
+      focusStyle={
+        terminal
+          ? { backgroundColor: C.raised }
+          : {
+              outlineStyle: 'solid' as const,
+              outlineWidth: 2,
+              outlineColor: C.accent,
+              outlineOffset: 2,
+            }
+      }
+      disabledStyle={controlDisabledStyle}
+    />
+  );
+}
+
+/** An immediate on/off setting: the label and detail stay static while the switch toggles it. */
 export function SettingsSwitch(props: {
   label: string;
   description?: string;
@@ -328,7 +381,7 @@ export function SettingsSwitch(props: {
   onPress(): void;
   trailing?: JSX.Element;
   status?: string;
-  /** Names the action instead of the state, such as "Enable Codex". */
+  /** Overrides the switch's accessible name when the row label alone is not specific enough. */
   accessibilityLabel?: string;
 }) {
   return (
@@ -339,20 +392,15 @@ export function SettingsSwitch(props: {
       leading={props.leading}
       tone={props.tone}
       status={props.status}
-      accessibilityLabel={
-        props.accessibilityLabel ??
-        tr('{label}: {state}', {
-          label: props.label,
-          state: props.checked ? tr('On') : tr('Off'),
-        })
-      }
-      selected={props.checked}
-      disabled={props.disabled}
-      onPress={props.onPress}
       trailing={
         <>
           {props.trailing}
-          <ChoiceIndicator kin
```

#### Recent Merged Pull Requests:
- **PR #7346** (2026-11-27): feat(workbench): keep the theme preview in view while the controls scroll (@UncertaintyDeterminesYou4ndMe)
- **PR #7343** (2026-11-27): fix(ios): render nsh/base Switch fallback off mobile for SettingSwitch (@M4n5ter)
- **PR #7336** (2026-11-27): fix(ios): auto-reconnect paired Hosts on foreground and network changes (@me2seeks)
- **PR #7334** (2026-11-27): chore(ios): polish 12-locale localization and dynamic labels (@me2seeks)
- **PR #7333** (2026-11-27): fix(ios): use native UIKit navigation title on ChatScreen (@me2seeks)
- **PR #7332** (2026-11-27): feat(workbench): give a theme its shape: corners, lines, shadow and letter spacing (@UncertaintyDeterminesYou4ndMe)

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

## X. agent): observe original CodeMode cells before retiring replaced Antigravity run

**RULE**:
When implementing operations in `plugins/agent/engine/src/driver/preflight.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/maka. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `85f66c80`: agent): observe original CodeMode cells before retiring replaced Antigravity runs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `plugins/agent/engine/src/driver/preflight.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            if self.resolve_recovered_cells(claim, &view, at).await? {
                continue;
            }
            if view.has_unsettled_recovery() {
                        if task.cleanup != OperationCleanup::Confirmed
                            || task.effects.values().any(|effect| effect.unsettled())
                        {
                            return Ok(None);
                        }
            let pending_cells = match terminal {
                Terminal::Completed => view.cells.values().any(|cell| cell.pending()),
                Terminal::Cancelled | Terminal::Failed => {
                    view.cells.values().any(|cell| cell.has_unsettled_effects())
                }
            };
            if pending_cells {
                return Ok(None);
            }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            if view.has_unsettled_recovery() || view.cells.values().any(|cell| cell.pending()) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `85f66c80` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
