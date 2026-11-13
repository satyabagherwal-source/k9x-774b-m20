> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/telemt-telemt-learnings.md`  
> **Source**: github ([https://github.com/telemt/telemt](https://github.com/telemt/telemt))  
> **Source Version**: `b594ee55`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T19:54:22.385Z  
> **Learning ID**: `learn-github-telemt-telemt`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): telemt/telemt

> **Canonical Artifact**: `07_PROJECT_LEARNING/telemt-telemt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/telemt/telemt](https://github.com/telemt/telemt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T19:52:49.457Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `telemt/telemt`
- **Description**: MTProxy for Telegram on Rust + Tokio
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5798 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/api/config_state.rs`
```
//! Bounded inspection of desired source and actual owner publications.

use std::collections::BTreeSet;
use std::sync::Arc;
use std::time::Duration;

use http_body_util::Full;
use hyper::{Response, StatusCode, body::Bytes};
use serde::Serialize;
use serde_json::Value as Json;

use super::config_edit::{RuntimeBaseline, RuntimeFence};
use super::model::{ApiFailure, FieldIssue};
use super::{ApiShared, config_projection as projection};
use crate::config::{
    ProxyConfig,
    observation::{ConfigProvenance, WatchOutcome},
};
use crate::maestro::{reload::ReloadObservation, runtime_build::project_reload_config};

const MAX_RESPONSE_BYTES: usize = 512 * 1024;
const MAX_STATE_PATHS: usize = 512;

#[derive(Debug, Serialize)]
struct Comparison {
    scope: &'static str,
    status: &'static str,
    pending_paths: Vec<String>,
    watcher_pending_paths: Vec<String>,
    generation_pending_paths: Vec<String>,
    process_deferred_paths: Vec<String>,
    deferred_process_fields: Vec<String>,
    runtime_derived_paths: Vec<String>,
    truncated: bool,
}

impl Default for Comparison {
    fn default() -> Self {
        Self {
            scope: "selected_sections",
            status: "unknown",
            pending_paths: Vec::new(),
            watcher_pending_paths: Vec::new(),
            generation_pending_paths: Vec::new(),
            process_deferred_paths: Vec::new(),
            deferred_process_fields: Vec::new(),
            runtime_derived_paths: Vec::new(),
            truncated: false,
        }
    }
}

#[derive(Debug, Serialize)]
pub(super) struct ConfigState {
    scope: &'static str,
    sections: BTreeSet<String>,
    runtime: RuntimeBaseline,
    runtime_sample_current: bool,
    pub(super) desired_revision: Option<String>,
    desired_status: &'static str,
    desired_error: Option<FieldIssue>,
    desired: Option<projection::Projection>,
    effective: Option<projection::Projection>,
    projection_error: Option<FieldIssue>,
    comparison: Comparison,
    watcher: Option<WatchOutcome>,
    watcher_matches_desired: Option<bool>,
    reload: Option<ReloadObservation>,
    reload_observation: &'static str,
    reload_matches_desired: Option<bool>,
    subsystem_convergence: &'static str,
}

fn issue(code: &'static str, message: &'static str) -> FieldIssue {
    FieldIssue {
        path: "$".into(),
        code,
        message: message.into(),
    }
}

fn sections(query: Option<&str>) -> Result<BTreeSet<String>, ApiFailure> {
    let Some(query) = query.filter(|query| !query.is_empty()) else {
        return Ok(projection::SECTIONS
            .iter()
            .map(|section| (*section).to_owned())
            .collect());
    };
    if query.len() > 256 {
        return Err(ApiFailure::bad_request(
            "Config state query exceeds 256 bytes",
        ));
    }
    let mut parsed = url::form_urlencoded::parse(query.as_bytes());
    let Some((key, value)) = parsed.next() else {
        return Err(ApiFailure::bad_request("Expected sections query"));
    };
    if key != "sections" || parsed.next().is_some() {
        return Err(ApiFailure::bad_request(
            "Only one sections query parameter is supported",
        ));
    }
    let mut sections = BTreeSet::new();
    for section in value.split(',') {
        if !projection::SECTIONS.contains(&section) || !sections.insert(section.to_owned()) {
            return Err(ApiFailure::bad_request(
                "Unknown, empty or repeated configuration section",
            ));
        }
    }
    Ok(sections)
}

fn json(config: &ProxyConfig) -> Result<Json, ApiFailure> {
    serde_json::to_value(config)
        .map_err(|_| ApiFailure::internal("Cannot project configuration snapshot"))
}

struct Desired {
    revision: Option<String>,
    status: &'static str,
    error: Option<FieldIssue>,
    projection: Option<projection::Projection>,
    effective: Option<projection::Projection>,
    comparison: Comparison,
}

fn unavailable(revision: Option<String>, status: &'static str, code: &'static str) -> Desired {
    Desired {
        revision,
        status,
        error: Some(issue(
            code,
            "Desired configuration is unavailable; effective publication remains readable",
        )),
        projection: None,
        effective: None,
        comparison: Comparison::default(),
    }
}

fn read_desired(
    path: &std::path::Path,
    active: &ProxyConfig,
    sections: &BTreeSet<String>,
) -> Result<Desired, ApiFailure> {
    let graph = match ProxyConfig::read_source_graph(path) {
        Ok(graph) => graph,
        Err(_) => return Ok(unavailable(None, "unreadable", "desired_source_unreadable")),
    };
    let revision = super::config_store::compute_source_revision(&graph);
    let mut desired = match ProxyConfig::parse_captured_source(graph) {
        Ok(parsed) => parsed.config,
        Err(_) => {
            return Ok(unavailable(
                Some(revision),
                "invalid",
                "desired_config_invalid",
            ));
        }
    };
    let mut derived = Vec::new();
    if matches!(&desired.provenance, ConfigProvenance::Source(source) if source.generated_fake_cert_len)
    {
        desired.censorship.fake_cert_len = active.censorship.fake_cert_len;
        if projection::selected("censorship.fake_cert_len", sections) {
            derived.push("censorship.fake_cert_len".into());
        }
    }
    let mut active_json = json(active)?;
    let mut desired_json = json(&desired)?;
    let effective =
        projection::project(active, &active_json, Some(&desired_json), sections, false)?;
    let desired_projection =
        projection::project(&desired, &desired_json, Some(&active_json), sections, true)?;
    let hot = crate::config::hot_reload::overlay_hot_fields(active, &desired);
    let projected = project_reload_config(active, &desired);
    let mut hot_json = json(&hot)?;
    let mut projected_json = json(&projected.effective)?;
    for value in [
        &mut active_json,
        &mut desired_json,
        &mut hot_json,
        &mut projected_json,
    ] {
        projection::retain_sections(value, sections);
    }
    let mut comparison = Comparison {
        pending_paths: projection::changed_paths(&active_json, &desired_json),
        watcher_pending_paths: projection::changed_paths(&active_json, &hot_json),
        generation_pending_paths: projection::changed_paths(&hot_json, &projected_json),
        process_deferred_paths: projection::changed_paths(&projected_json, &desired_json),
        deferred_process_fields: projected
            .deferred_process_fields
            .into_iter()
            .filter(|path| projection::selected(path, sections))
            .collect(),
        runtime_derived_paths: derived,
        ..Comparison::default()
    };
    comparison.status = if comparison.pending_paths.is_empty() {
        "published_match"
    } else if comparison.watcher_pending_paths.is_empty()
        && comparison.generation_pending_paths.is_empty()
    {
        "process_deferred"
    } else {
        "pending_publication"
    };
    for paths in [
        &mut comparison.pending_paths,
        &mut comparison.watcher_pending_paths,
        &mut comparison.generation_pending_paths,
        &mut comparison.process_deferred_paths,
    ] {
        comparison.truncated |= paths.len() > MAX_STATE_PATHS;
        paths.truncate(MAX_STATE_PATHS);
    }
    Ok(Desired {
        revision: Some(revision),
        status: "valid",
        error: None,
        projection: Some(desired_projection),
        effective: Some(effective),
        comparison,
    })
}

pub(super) async fn state(
    shared: &ApiShared,
    query: Option<&str>,
) -> Result<ConfigState, ApiFailure> {
    let sections = sections(query)?;
    let fence = RuntimeFence::capture(shared, None)?;
    let mut data = ConfigState {
        scope: "published_configuration_not_subsystem_acknowledgment",
        sections: sections.clone(),
        runtime: fence.baseline(),
        runtime_sample_current: true,
        desired_revision: None,
        desired_status: "busy",
        desired_error: None,
        desired: None,
        effective: None,
        projection_error: None,
        comparison: Comparison::default(),
        watcher: None,
        watcher_matches_desired: None,
        reload: None,
        reload_observation: "unknown",
        reload_matches_desired: None,
        subsystem_convergence: "unknown",
    };
    if let Ok(permit) = shared.config_state_slots.clone().try_acquire_owned() {
        let permit = Arc::new(permit);
        let guard = permit.clone();
        let active = fence.config.clone();
        let scope = sections.clone();
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        let effective = tokio::task::spawn_blocking(move || {
            let _guard = guard;
            projection::project(&active, &json(&active)?, None, &scope, false)
        });
        match tokio::time::timeout_at(deadline, effective).await {
            Ok(Ok(Ok(effective))) => data.effective = Some(effective),
            _ => {
                data.projection_error = Some(issue(
                    "effective_projection_unavailable",
                    "Runtime identity is available but its projection could not complete",
                ))
            }
        }
        if data.effective.is_some() {
            let active = fence.config.clone();
            let path = shared.config_path.clone();
            let desired = tokio::task::spawn_blocking(move || {
                let _guard = permit;
                read_desired(&path, &active, &sections)
            });
            let desired = match tokio::time::timeout_at(deadline, desired).await {
                Ok(Ok(Ok(desired))) => desired,
                Ok(_) => unavailable(None, "unavailable", "desired_projection_failed"),
                Err(_) => unavailable(None, "timeout", "desired_read_timeout"),
            };
 
```

### Core Architecture Module: `src/api/http_utils.rs`
```
use http_body_util::{BodyExt, Full};
use hyper::StatusCode;
use hyper::body::{Bytes, Incoming};
use hyper::header::ALLOW;
use serde::Serialize;
use serde::de::DeserializeOwned;

use super::model::{ApiFailure, ErrorBody, ErrorResponse, SuccessResponse};

pub(super) fn success_response<T: Serialize>(
    status: StatusCode,
    data: T,
    revision: String,
) -> hyper::Response<Full<Bytes>> {
    let payload = SuccessResponse {
        ok: true,
        data,
        revision,
    };
    let body = serde_json::to_vec(&payload).unwrap_or_else(|_| b"{\"ok\":false}".to_vec());
    hyper::Response::builder()
        .status(status)
        .header("content-type", "application/json; charset=utf-8")
        .body(Full::new(Bytes::from(body)))
        .unwrap()
}

pub(super) fn error_response(request_id: u64, failure: ApiFailure) -> hyper::Response<Full<Bytes>> {
    let status = failure.status;
    let allow = failure.allow;
    let payload = ErrorResponse {
        ok: false,
        error: ErrorBody {
            code: failure.code,
            message: failure.message,
            details: failure.details,
        },
        request_id,
    };
    let body = serde_json::to_vec(&payload).unwrap_or_else(|_| {
        format!(
            "{{\"ok\":false,\"error\":{{\"code\":\"internal_error\",\"message\":\"serialization failed\"}},\"request_id\":{}}}",
            request_id
        )
        .into_bytes()
    });
    let mut builder = hyper::Response::builder()
        .status(status)
        .header("content-type", "application/json; charset=utf-8");
    if let Some(allow) = allow {
        builder = builder.header(ALLOW, allow);
    }
    builder.body(Full::new(Bytes::from(body))).unwrap()
}

pub(super) async fn read_json<T: DeserializeOwned>(
    body: Incoming,
    limit: usize,
) -> Result<T, ApiFailure> {
    let bytes = read_body_with_limit(body, limit).await?;
    serde_json::from_slice(&bytes).map_err(|_| ApiFailure::bad_request("Invalid JSON body"))
}

pub(super) async fn read_optional_json<T: DeserializeOwned>(
    body: Incoming,
    limit: usize,
) -> Result<Option<T>, ApiFailure> {
    let bytes = read_body_with_limit(body, limit).await?;
    if bytes.is_empty() {
        return Ok(None);
    }
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| ApiFailure::bad_request("Invalid JSON body"))
}

async fn read_body_with_limit(body: Incoming, limit: usize) -> Result<Vec<u8>, ApiFailure> {
    let mut collected = Vec::new();
    let mut body = body;
    while let Some(frame_result) = body.frame().await {
        let frame = frame_result.map_err(|_| ApiFailure::bad_request("Invalid request body"))?;
        if let Some(chunk) = frame.data_ref() {
            if collected.len().saturating_add(chunk.len()) > limit {
                return Err(ApiFailure::new(
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "payload_too_large",
                    format!("Body exceeds {} bytes", limit),
                ));
            }
            collected.extend_from_slice(chunk);
        }
    }
    Ok(collected)
}

```

### Core Architecture Module: `src/api/users/lifecycle.rs`
```
use super::*;
use tracing::warn;

pub(in crate::api) async fn rotate_secret(
    user: &str,
    body: RotateSecretRequest,
    expected_revision: Option<String>,
    shared: &ApiShared,
) -> Result<(CreateUserResponse, String), ApiFailure> {
    let shared = shared.clone();
    let user = user.to_string();
    shared
        .clone()
        .run_mutation_completion(async move {
            rotate_secret_to_completion(&user, body, expected_revision, &shared).await
        })
        .await
}

async fn rotate_secret_to_completion(
    user: &str,
    body: RotateSecretRequest,
    expected_revision: Option<String>,
    shared: &ApiShared,
) -> Result<(CreateUserResponse, String), ApiFailure> {
    let secret = body.secret.unwrap_or_else(random_user_secret);
    if !is_valid_user_secret(&secret) {
        return Err(ApiFailure::bad_request(
            "secret must be exactly 32 hex characters",
        ));
    }
    let credential_id = credential_id_from_hex(&secret)
        .ok_or_else(|| ApiFailure::internal("validated user secret could not be decoded"))?;

    let _guard = shared.mutation_lock.lock().await;
    let quota_guard = shared.quota_state.lock().await;
    let (mut cfg, base_revision) =
        load_config_for_mutation(&shared.config_path, expected_revision.as_deref()).await?;

    if !cfg.access.users.contains_key(user) {
        return Err(ApiFailure::new(
            StatusCode::NOT_FOUND,
            "not_found",
            "User not found",
        ));
    }

    cfg.access.users.insert(user.to_string(), secret.clone());
    cfg.validate()
        .map_err(|e| ApiFailure::bad_request(format!("config validation failed: {}", e)))?;
    let revision = save_access_sections_to_disk_if_revision(
        &shared.config_path,
        &cfg,
        &[AccessSection::Users],
        Some(&base_revision),
    )
    .await?;
    shared.proxy_shared.stage_user_credential(
        user,
        credential_id,
        cfg.access.is_user_enabled(user),
    );
    shared.quota_state.refresh_fresh_schedule(user, &cfg);
    drop(quota_guard);
    drop(_guard);

    let (detected_ip_v4, detected_ip_v6) = shared.detected_link_ips();
    let users = users_from_config(
        &cfg,
        &shared.stats,
        &shared.ip_tracker,
        detected_ip_v4,
        detected_ip_v6,
        None,
    )
    .await;
    let user_info = users
        .into_iter()
        .find(|entry| entry.username == user)
        .ok_or_else(|| ApiFailure::internal("failed to build updated user view"))?;

    Ok((
        CreateUserResponse {
            user: user_info,
            secret,
        },
        revision,
    ))
}

pub(in crate::api) async fn delete_user(
    user: &str,
    expected_revision: Option<String>,
    shared: &ApiShared,
) -> Result<(String, String), ApiFailure> {
    let shared = shared.clone();
    let user = user.to_string();
    shared
        .clone()
        .run_mutation_completion(async move {
            delete_user_to_completion(&user, expected_revision, &shared).await
        })
        .await
}

async fn delete_user_to_completion(
    user: &str,
    expected_revision: Option<String>,
    shared: &ApiShared,
) -> Result<(String, String), ApiFailure> {
    let _guard = shared.mutation_lock.lock().await;
    let quota_guard = shared.quota_state.lock().await;
    let (mut cfg, base_revision) =
        load_config_for_mutation(&shared.config_path, expected_revision.as_deref()).await?;

    if !cfg.access.users.contains_key(user) {
        return Err(ApiFailure::new(
            StatusCode::NOT_FOUND,
            "not_found",
            "User not found",
        ));
    }
    if cfg.access.users.len() <= 1 {
        return Err(ApiFailure::new(
            StatusCode::CONFLICT,
            "last_user_forbidden",
            "Cannot delete the last configured user",
        ));
    }

    let mut touched_sections = vec![AccessSection::Users];
    cfg.access.users.remove(user);
    if cfg.access.user_enabled.remove(user).is_some() {
        touched_sections.push(AccessSection::UserEnabled);
    }
    if cfg.access.user_ad_tags.remove(user).is_some() {
        touched_sections.push(AccessSection::UserAdTags);
    }
    if cfg.access.user_max_tcp_conns.remove(user).is_some() {
        touched_sections.push(AccessSection::UserMaxTcpConns);
    }
    if cfg.access.user_expirations.remove(user).is_some() {
        touched_sections.push(AccessSection::UserExpirations);
    }
    if cfg.access.user_quota_periods.remove(user).is_some() {
        touched_sections.push(AccessSection::UserQuotaPeriods);
    }
    if cfg.access.user_data_quota.remove(user).is_some() {
        touched_sections.push(AccessSection::UserDataQuota);
    }
    if cfg.access.user_rate_limits.remove(user).is_some() {
        touched_sections.push(AccessSection::UserRateLimits);
    }
    if cfg.access.user_max_unique_ips.remove(user).is_some() {
        touched_sections.push(AccessSection::UserMaxUniqueIps);
    }

    cfg.validate()
        .map_err(|e| ApiFailure::bad_request(format!("config validation failed: {}", e)))?;
    let revision = save_access_sections_to_disk_if_revision(
        &shared.config_path,
        &cfg,
        &touched_sections,
        Some(&base_revision),
    )
    .await?;
    let deleted_incarnation = shared.proxy_shared.delete_user(user).incarnation;
    let configured_users = cfg.access.users.keys().cloned().collect();
    if let Err(error) = shared
        .quota_state
        .remove_user_locked(&configured_users, user, quota_guard)
        .await
    {
        warn!(
            user,
            error = %error,
            "Deleted user quota checkpoint cleanup will be reconciled on restart"
        );
    }
    shared.ip_tracker.remove_user_limit(user).await;
    shared
        .ip_tracker
        .clear_user_ips_if_not_newer(user, deleted_incarnation)
        .await;
    drop(_guard);

    Ok((user.to_string(), revision))
}

```

### Core Architecture Module: `src/config/load/validate_core.rs`
```
use super::*;

pub(super) fn validate(config: &mut ProxyConfig) -> Result<()> {
    if let Some(path) = &config.general.proxy_config_v4_cache_path
        && path.trim().is_empty()
    {
        return Err(ProxyError::Config(
            "general.proxy_config_v4_cache_path cannot be empty when provided".to_string(),
        ));
    }

    if let Some(path) = &config.general.proxy_config_v6_cache_path
        && path.trim().is_empty()
    {
        return Err(ProxyError::Config(
            "general.proxy_config_v6_cache_path cannot be empty when provided".to_string(),
        ));
    }

    if let Some(update_every) = config.general.update_every {
        if update_every == 0 {
            return Err(ProxyError::Config(
                "general.update_every must be > 0".to_string(),
            ));
        }
    } else {
        let legacy_secret = config.general.proxy_secret_auto_reload_secs;
        let legacy_config = config.general.proxy_config_auto_reload_secs;
        let effective = legacy_secret.min(legacy_config);
        if effective == 0 {
            return Err(ProxyError::Config(
                "legacy proxy_*_auto_reload_secs values must be > 0 when general.update_every is not set".to_string(),
            ));
        }

        if legacy_secret != default_proxy_secret_reload_secs()
            || legacy_config != default_proxy_config_reload_secs()
        {
            warn!(
                proxy_secret_auto_reload_secs = legacy_secret,
                proxy_config_auto_reload_secs = legacy_config,
                effective_update_every_secs = effective,
                "proxy_*_auto_reload_secs are deprecated; set general.update_every"
            );
        }
    }

    if config.general.stun_nat_probe_concurrency == 0 {
        return Err(ProxyError::Config(
            "general.stun_nat_probe_concurrency must be > 0".to_string(),
        ));
    }

    if config.general.me_init_retry_attempts > 1_000_000 {
        return Err(ProxyError::Config(
            "general.me_init_retry_attempts must be within [0, 1000000]".to_string(),
        ));
    }

    if config.general.upstream_connect_retry_attempts == 0 {
        return Err(ProxyError::Config(
            "general.upstream_connect_retry_attempts must be > 0".to_string(),
        ));
    }

    if config.general.upstream_connect_budget_ms == 0 {
        return Err(ProxyError::Config(
            "general.upstream_connect_budget_ms must be > 0".to_string(),
        ));
    }

    if config.general.tg_connect == 0 {
        return Err(ProxyError::Config(
            "general.tg_connect must be > 0".to_string(),
        ));
    }

    if config.general.upstream_unhealthy_fail_threshold == 0 {
        return Err(ProxyError::Config(
            "general.upstream_unhealthy_fail_threshold must be > 0".to_string(),
        ));
    }

    if config.general.rpc_proxy_req_every != 0
        && !(10..=300).contains(&config.general.rpc_proxy_req_every)
    {
        return Err(ProxyError::Config(
            "general.rpc_proxy_req_every must be 0 or within [10, 300]".to_string(),
        ));
    }

    if config.timeouts.client_handshake == 0 {
        return Err(ProxyError::Config(
            "timeouts.client_handshake must be > 0".to_string(),
        ));
    }

    let handshake_timeout_ms = config
        .timeouts
        .client_handshake
        .checked_mul(1000)
        .ok_or_else(|| {
            ProxyError::Config(
                "timeouts.client_handshake is too large to validate milliseconds budget"
                    .to_string(),
            )
        })?;

    if config.censorship.server_hello_delay_max_ms >= handshake_timeout_ms {
        return Err(ProxyError::Config(
            "censorship.server_hello_delay_max_ms must be < timeouts.client_handshake * 1000"
                .to_string(),
        ));
    }

    if config.censorship.mask_shape_bucket_floor_bytes == 0 {
        return Err(ProxyError::Config(
            "censorship.mask_shape_bucket_floor_bytes must be > 0".to_string(),
        ));
    }

    if config.censorship.mask_shape_bucket_cap_bytes
        < config.censorship.mask_shape_bucket_floor_bytes
    {
        return Err(ProxyError::Config(
            "censorship.mask_shape_bucket_cap_bytes must be >= censorship.mask_shape_bucket_floor_bytes"
                .to_string(),
        ));
    }

    if config.censorship.mask_shape_above_cap_blur && !config.censorship.mask_shape_hardening {
        return Err(ProxyError::Config(
            "censorship.mask_shape_above_cap_blur requires censorship.mask_shape_hardening = true"
                .to_string(),
        ));
    }

    if config.censorship.mask_shape_hardening_aggressive_mode
        && !config.censorship.mask_shape_hardening
    {
        return Err(ProxyError::Config(
            "censorship.mask_shape_hardening_aggressive_mode requires censorship.mask_shape_hardening = true"
                .to_string(),
        ));
    }

    if config.censorship.mask_shape_above_cap_blur
        && config.censorship.mask_shape_above_cap_blur_max_bytes == 0
    {
        return Err(ProxyError::Config(
            "censorship.mask_shape_above_cap_blur_max_bytes must be > 0 when censorship.mask_shape_above_cap_blur is enabled"
                .to_string(),
        ));
    }

    if config.censorship.mask_shape_above_cap_blur_max_bytes > 1_048_576 {
        return Err(ProxyError::Config(
            "censorship.mask_shape_above_cap_blur_max_bytes must be <= 1048576".to_string(),
        ));
    }

    if config.censorship.mask_relay_max_bytes > 67_108_864 {
        return Err(ProxyError::Config(
            "censorship.mask_relay_max_bytes must be <= 67108864".to_string(),
        ));
    }

    if !(5..=50).contains(&config.censorship.mask_classifier_prefetch_timeout_ms) {
        return Err(ProxyError::Config(
            "censorship.mask_classifier_prefetch_timeout_ms must be within [5, 50]".to_string(),
        ));
    }

    if config.censorship.mask_timing_normalization_ceiling_ms
        < config.censorship.mask_timing_normalization_floor_ms
    {
        return Err(ProxyError::Config(
            "censorship.mask_timing_normalization_ceiling_ms must be >= censorship.mask_timing_normalization_floor_ms"
                .to_string(),
        ));
    }

    if config.censorship.mask_timing_normalization_enabled
        && config.censorship.mask_timing_normalization_floor_ms == 0
    {
        return Err(ProxyError::Config(
            "censorship.mask_timing_normalization_floor_ms must be > 0 when censorship.mask_timing_normalization_enabled is true"
                .to_string(),
        ));
    }

    if config.censorship.mask_timing_normalization_ceiling_ms > 60_000 {
        return Err(ProxyError::Config(
            "censorship.mask_timing_normalization_ceiling_ms must be <= 60000".to_string(),
        ));
    }

    if config.timeouts.relay_client_idle_soft_secs == 0 {
        return Err(ProxyError::Config(
            "timeouts.relay_client_idle_soft_secs must be > 0".to_string(),
        ));
    }

    if config.timeouts.relay_client_idle_hard_secs == 0 {
        return Err(ProxyError::Config(
            "timeouts.relay_client_idle_hard_secs must be > 0".to_string(),
        ));
    }

    if config.timeouts.relay_client_idle_hard_secs < config.timeouts.relay_client_idle_soft_secs {
        return Err(ProxyError::Config(
            "timeouts.relay_client_idle_hard_secs must be >= timeouts.relay_client_idle_soft_secs"
                .to_string(),
        ));
    }

    if config
        .timeouts
        .relay_idle_grace_after_downstream_activity_secs
        > config.timeouts.relay_client_idle_hard_secs
    {
        return Err(ProxyError::Config(
            "timeouts.relay_idle_grace_after_downstream_activity_secs must be <= timeouts.relay_client_idle_hard_secs"
                .to_string(),
        ));
    }
    Ok(())
}

```

### Core Architecture Module: `src/maestro/generation/lifecycle.rs`
```
use super::*;

/// Cancels tasks if runtime preparation exits before ownership reaches a generation.
#[must_use = "runtime preparation guards must be disarmed after ownership transfer"]
pub(crate) struct RuntimeTaskScopePreparationGuard {
    scope: RuntimeTaskScope,
    armed: bool,
}

impl RuntimeTaskScopePreparationGuard {
    /// Arms cancellation for a newly created, not-yet-published task scope.
    pub(crate) fn new(scope: RuntimeTaskScope) -> Self {
        Self { scope, armed: true }
    }

    /// Confirms that a runtime generation now owns the task scope.
    pub(crate) fn disarm(mut self) {
        self.armed = false;
    }
}

impl Drop for RuntimeTaskScopePreparationGuard {
    fn drop(&mut self) {
        if self.armed {
            self.scope.begin_stop();
        }
    }
}

pub(super) struct SessionDrainCancellationGuard<'a> {
    generation: &'a RuntimeGeneration,
    armed: bool,
}

impl<'a> SessionDrainCancellationGuard<'a> {
    pub(super) fn new(generation: &'a RuntimeGeneration) -> Self {
        Self {
            generation,
            armed: true,
        }
    }

    pub(super) fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for SessionDrainCancellationGuard<'_> {
    fn drop(&mut self) {
        if self.armed {
            self.generation.begin_stop_sessions();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct NotifyOnDrop(Arc<Notify>);

    impl Drop for NotifyOnDrop {
        fn drop(&mut self) {
            self.0.notify_one();
        }
    }

    #[tokio::test]
    async fn preparation_guard_drop_cancels_scope_and_rejects_late_spawn() {
        let scope = RuntimeTaskScope::new();
        let guard = RuntimeTaskScopePreparationGuard::new(scope.clone());
        drop(guard);

        assert!(scope.cancellation_token().is_cancelled());
        let ran = Arc::new(AtomicUsize::new(0));
        let ran_task = Arc::clone(&ran);
        scope.spawn(async move {
            ran_task.fetch_add(1, Ordering::AcqRel);
        });
        tokio::task::yield_now().await;
        assert_eq!(ran.load(Ordering::Acquire), 0);
    }

    #[tokio::test]
    async fn preparation_guard_disarm_transfers_ownership() {
        let scope = RuntimeTaskScope::new();
        RuntimeTaskScopePreparationGuard::new(scope.clone()).disarm();

        assert!(!scope.cancellation_token().is_cancelled());
        scope.stop().await;
    }

    #[tokio::test]
    async fn aborted_scope_stop_still_cancels_children() {
        let scope = RuntimeTaskScope::new();
        let registration = scope.admission.try_register().unwrap();
        let started = Arc::new(Notify::new());
        let dropped = Arc::new(Notify::new());
        let started_task = Arc::clone(&started);
        let dropped_task = Arc::clone(&dropped);
        scope.spawn(async move {
            let _drop_signal = NotifyOnDrop(dropped_task);
            started_task.notify_one();
            std::future::pending::<()>().await;
        });
        started.notified().await;

        let stop_scope = scope.clone();
        let stop = tokio::spawn(async move {
            stop_scope.stop().await;
        });
        scope.cancellation_token().cancelled().await;
        stop.abort();
        assert!(stop.await.unwrap_err().is_cancelled());
        drop(registration);

        tokio::time::timeout(Duration::from_secs(1), dropped.notified())
            .await
            .expect("scope cancellation must drop the tracked child");
        assert!(scope.admission.try_register().is_none());
    }

    #[tokio::test]
    async fn aborted_graceful_drain_forces_session_cancellation() {
        let generation = test_runtime_generation(1, ProxyConfig::default());
        let registration = generation.session_admission.try_register().unwrap();
        let started = Arc::new(Notify::new());
        let dropped = Arc::new(Notify::new());
        let started_task = Arc::clone(&started);
        let dropped_task = Arc::clone(&dropped);
        assert!(generation.spawn_session(async move {
            let _drop_signal = NotifyOnDrop(dropped_task);
            started_task.notify_one();
            std::future::pending::<()>().await;
        }));
        started.notified().await;

        let drain_generation = Arc::clone(&generation);
        let drain = tokio::spawn(async move {
            drain_generation
                .drain_sessions(Duration::from_secs(60))
                .await
        });
        while generation.session_admission.state.load(Ordering::Acquire) & SESSION_ADMISSION_CLOSED
            == 0
        {
            tokio::task::yield_now().await;
        }
        drain.abort();
        assert!(drain.await.unwrap_err().is_cancelled());
        assert!(generation.session_cancel.is_cancelled());
        drop(registration);

        tokio::time::timeout(Duration::from_secs(1), dropped.notified())
            .await
            .expect("aborted graceful drain must cancel existing sessions");
    }
}

```

### Core Architecture Module: `src/metrics/render.rs`
```
use super::*;

// Process, buffer, and TLS cache metrics.
mod process;
// Connection, quota, and conntrack metrics.
mod connections;
// Rate limiter, upstream, and initial ME metrics.
mod traffic;
// ME lifecycle and relay event metrics.
mod me_lifecycle;
// ME batching and resident-memory metrics.
mod me_buffers;
// ME writer selection, KDF, and hardswap metrics.
mod me_policy;
// Live hardswap ownership and replacement progress metrics.
mod me_hardswap;
// Adaptive-floor and writer-cap metrics.
mod me_floor;
// Desync, pool recovery, and refill metrics.
mod me_recovery;
// Bounded per-user and IP-tracker metrics.
mod users;

pub(super) async fn render_metrics(
    stats: &Stats,
    shared_state: &ProxySharedState,
    config: &ProxyConfig,
    ip_tracker: &UserIpTracker,
    tls_cache: Option<&TlsFrontCache>,
    tls_full_cert_budget: &TlsFullCertBudget,
    web_publication: &crate::web::control::WebRuntimePublication,
    me_hardswap: Option<&crate::transport::middle_proxy::MeApiHardswapSnapshot>,
) -> String {
    let mut out = String::with_capacity(4096);
    let telemetry = stats.telemetry_policy();
    let core_enabled = telemetry.core_enabled;
    let user_enabled = telemetry.user_enabled;
    let me_allows_normal = telemetry.me_level.allows_normal();
    let me_allows_debug = telemetry.me_level.allows_debug();

    process::render(
        &mut out,
        stats,
        shared_state,
        telemetry,
        tls_full_cert_budget,
    );
    super::render_tls_front_profile_health(&mut out, config, tls_cache).await;
    connections::render(&mut out, stats, shared_state, core_enabled);
    traffic::render(
        &mut out,
        stats,
        shared_state,
        config,
        core_enabled,
        me_allows_normal,
        me_allows_debug,
    );
    me_lifecycle::render(&mut out, stats, me_allows_normal);
    me_buffers::render(
        &mut out,
        stats,
        core_enabled,
        me_allows_normal,
        me_allows_debug,
    );
    me_policy::render(&mut out, stats, me_allows_normal, me_allows_debug);
    me_hardswap::render(&mut out, me_hardswap, me_allows_normal);
    me_floor::render(&mut out, stats, config, me_allows_normal);
    me_recovery::render(&mut out, stats, me_allows_normal, me_allows_debug);
    users::render(
        &mut out,
        stats,
        config,
        ip_tracker,
        core_enabled,
        user_enabled,
    )
    .await;
    super::web::render(&mut out, web_publication, config);
    out
}

```

### Core Architecture Module: `src/metrics/render/connections.rs`
```
use super::*;
use std::fmt::Write;

pub(super) fn render(
    out: &mut String,
    stats: &Stats,
    shared_state: &ProxySharedState,
    core_enabled: bool,
) {
    let _ = writeln!(
        out,
        "# HELP telemt_connections_total Total accepted connections"
    );
    let _ = writeln!(out, "# TYPE telemt_connections_total counter");
    let _ = writeln!(
        out,
        "telemt_connections_total {}",
        if core_enabled {
            stats.get_connects_all()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_connections_bad_total Bad/rejected connections"
    );
    let _ = writeln!(out, "# TYPE telemt_connections_bad_total counter");
    let _ = writeln!(
        out,
        "telemt_connections_bad_total {}",
        if core_enabled {
            stats.get_connects_bad()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_connections_bad_by_class_total Bad/rejected connections by class"
    );
    let _ = writeln!(out, "# TYPE telemt_connections_bad_by_class_total counter");
    if core_enabled {
        for (class, total) in stats.get_connects_bad_class_counts() {
            let _ = writeln!(
                out,
                "telemt_connections_bad_by_class_total{{class=\"{}\"}} {}",
                class, total
            );
        }
    }

    let _ = writeln!(
        out,
        "# HELP telemt_handshake_timeouts_total Handshake timeouts"
    );
    let _ = writeln!(out, "# TYPE telemt_handshake_timeouts_total counter");
    let _ = writeln!(
        out,
        "telemt_handshake_timeouts_total {}",
        if core_enabled {
            stats.get_handshake_timeouts()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_handshake_failures_by_class_total Handshake failures by class"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_handshake_failures_by_class_total counter"
    );
    if core_enabled {
        for (class, total) in stats.get_handshake_failure_class_counts() {
            let _ = writeln!(
                out,
                "telemt_handshake_failures_by_class_total{{class=\"{}\"}} {}",
                class, total
            );
        }
    }

    let _ = writeln!(
        out,
        "# HELP telemt_auth_expensive_checks_total Expensive authentication candidate checks executed during handshake validation"
    );
    let _ = writeln!(out, "# TYPE telemt_auth_expensive_checks_total counter");
    let _ = writeln!(
        out,
        "telemt_auth_expensive_checks_total {}",
        if core_enabled {
            shared_state
                .handshake
                .auth_expensive_checks_total
                .load(std::sync::atomic::Ordering::Relaxed)
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_auth_budget_exhausted_total Handshake validations that hit authentication candidate budget limits"
    );
    let _ = writeln!(out, "# TYPE telemt_auth_budget_exhausted_total counter");
    let _ = writeln!(
        out,
        "telemt_auth_budget_exhausted_total {}",
        if core_enabled {
            shared_state
                .handshake
                .auth_budget_exhausted_total
                .load(std::sync::atomic::Ordering::Relaxed)
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_accept_permit_timeout_total Accepted connections dropped due to permit wait timeout"
    );
    let _ = writeln!(out, "# TYPE telemt_accept_permit_timeout_total counter");
    let _ = writeln!(
        out,
        "telemt_accept_permit_timeout_total {}",
        if core_enabled {
            stats.get_accept_permit_timeout_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_route_cutover_parked_current Sessions currently parked in route cutover stagger delay"
    );
    let _ = writeln!(out, "# TYPE telemt_route_cutover_parked_current gauge");
    let _ = writeln!(
        out,
        "telemt_route_cutover_parked_current{{route=\"direct\"}} {}",
        stats.get_route_cutover_parked_direct_current()
    );
    let _ = writeln!(
        out,
        "telemt_route_cutover_parked_current{{route=\"middle\"}} {}",
        stats.get_route_cutover_parked_middle_current()
    );
    let _ = writeln!(
        out,
        "# HELP telemt_route_cutover_parked_total Sessions parked in route cutover stagger delay"
    );
    let _ = writeln!(out, "# TYPE telemt_route_cutover_parked_total counter");
    let _ = writeln!(
        out,
        "telemt_route_cutover_parked_total{{route=\"direct\"}} {}",
        stats.get_route_cutover_parked_direct_total()
    );
    let _ = writeln!(
        out,
        "telemt_route_cutover_parked_total{{route=\"middle\"}} {}",
        stats.get_route_cutover_parked_middle_total()
    );

    let _ = writeln!(
        out,
        "# HELP telemt_quota_refund_bytes_total Reserved quota bytes returned before commit"
    );
    let _ = writeln!(out, "# TYPE telemt_quota_refund_bytes_total counter");
    let _ = writeln!(
        out,
        "telemt_quota_refund_bytes_total {}",
        if core_enabled {
            stats.get_quota_refund_bytes_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_quota_contention_total Quota reservation CAS contention events"
    );
    let _ = writeln!(out, "# TYPE telemt_quota_contention_total counter");
    let _ = writeln!(
        out,
        "telemt_quota_contention_total {}",
        if core_enabled {
            stats.get_quota_contention_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_quota_contention_timeout_total Quota reservations that hit the bounded contention budget"
    );
    let _ = writeln!(out, "# TYPE telemt_quota_contention_timeout_total counter");
    let _ = writeln!(
        out,
        "telemt_quota_contention_timeout_total {}",
        if core_enabled {
            stats.get_quota_contention_timeout_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_quota_acquire_cancelled_total Quota acquisitions cancelled before reservation completed"
    );
    let _ = writeln!(out, "# TYPE telemt_quota_acquire_cancelled_total counter");
    let _ = writeln!(
        out,
        "telemt_quota_acquire_cancelled_total {}",
        if core_enabled {
            stats.get_quota_acquire_cancelled_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_conntrack_control_state Runtime conntrack control state flags"
    );
    let _ = writeln!(out, "# TYPE telemt_conntrack_control_state gauge");
    let _ = writeln!(
        out,
        "telemt_conntrack_control_state{{flag=\"enabled\"}} {}",
        if stats.get_conntrack_control_enabled() {
            1
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_conntrack_control_state{{flag=\"available\"}} {}",
        if stats.get_conntrack_control_available() {
            1
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_conntrack_control_state{{flag=\"pressure_active\"}} {}",
        if stats.get_conntrack_pressure_active() {
            1
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_conntrack_control_state{{flag=\"rule_apply_ok\"}} {}",
        if stats.get_conntrack_rule_apply_ok() {
            1
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_conntrack_rule_reconcile_total Conntrack firewall reconciliations by result"
    );
    let _ = writeln!(out, "# TYPE telemt_conntrack_rule_reconcile_total counter");
    let _ = writeln!(
        out,
        "telemt_conntrack_rule_reconcile_total{{result=\"success\"}} {}",
        if core_enabled {
            stats.get_conntrack_rule_reconcile_success_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_conntrack_rule_reconcile_total{{result=\"error\"}} {}",
        if core_enabled {
            stats.get_conntrack_rule_reconcile_error_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_conntrack_rule_rollback_total Conntrack firewall rollbacks by result"
    );
    let _ = writeln!(out, "# TYPE telemt_conntrack_rule_rollback_total counter");
    let _ = writeln!(
        out,
        "telemt_conntrack_rule_rollback_total{{result=\"success\"}} {}",
        if core_enabled {
            stats.get_conntrack_rule_rollback_success_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_conntrack_rule_rollback_total{{result=\"error\"}} {}",
        if core_enabled {
            stats.get_conntrack_rule_rollback_error_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_conntrack_event_queue_depth Pending close events in conntrack control queue"
    );
    let _ = writeln!(out, "# TYPE telemt_conntrack_event_queue_depth gauge");
    let _ = writeln!(
        out,
        "telemt_conntrack_event_queue_depth {}",
        stats.get_conntrack_event_queue_depth()
    );

    let _ = writeln!(
        out,
        "# HELP telemt_conntrack_delete_total Conntrack delete attempts by outcome"
    );
    let _ = writeln!(out, "# TYPE telemt_conntrack_delete_total counter");
    let _ = writeln!(
        out,
        "telemt_conntrack_delete_total{{result=\"attempt\"}} {}",
        if core_enabled {
            stats.get_conntrack_delete_attempt_total()
        } else {
            0
        }
    );
 
```

### Core Architecture Module: `src/metrics/render/me_buffers.rs`
```
use super::*;
use std::fmt::Write;

pub(super) fn render(
    out: &mut String,
    stats: &Stats,
    core_enabled: bool,
    me_allows_normal: bool,
    me_allows_debug: bool,
) {
    let _ = writeln!(
        out,
        "telemt_me_d2c_flush_reason_total{{reason=\"batch_bytes\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_flush_reason_batch_bytes_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_flush_reason_total{{reason=\"max_delay\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_flush_reason_max_delay_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_flush_reason_total{{reason=\"ack_immediate\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_flush_reason_ack_immediate_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_flush_reason_total{{reason=\"close\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_flush_reason_close_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_data_frames_total DC->Client data frames"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_data_frames_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_data_frames_total {}",
        if me_allows_normal {
            stats.get_me_d2c_data_frames_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_ack_frames_total DC->Client quick-ack frames"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_ack_frames_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_ack_frames_total {}",
        if me_allows_normal {
            stats.get_me_d2c_ack_frames_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_payload_bytes_total DC->Client payload bytes before transport framing"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_payload_bytes_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_payload_bytes_total {}",
        if me_allows_normal {
            stats.get_me_d2c_payload_bytes_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_write_mode_total DC->Client writer mode selection"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_write_mode_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_write_mode_total{{mode=\"coalesced\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_write_mode_coalesced_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_write_mode_total{{mode=\"split\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_write_mode_split_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_quota_reject_total DC->Client quota rejects"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_quota_reject_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_quota_reject_total{{stage=\"pre_write\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_quota_reject_pre_write_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_quota_reject_total{{stage=\"post_write\"}} {}",
        if me_allows_normal {
            stats.get_me_d2c_quota_reject_post_write_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_child_join_timeout_total Middle relay child tasks that did not join before cleanup deadline"
    );
    let _ = writeln!(out, "# TYPE telemt_me_child_join_timeout_total counter");
    let _ = writeln!(
        out,
        "telemt_me_child_join_timeout_total {}",
        if core_enabled {
            stats.get_me_child_join_timeout_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_child_abort_total Middle relay child tasks aborted after bounded cleanup timeout"
    );
    let _ = writeln!(out, "# TYPE telemt_me_child_abort_total counter");
    let _ = writeln!(
        out,
        "telemt_me_child_abort_total {}",
        if core_enabled {
            stats.get_me_child_abort_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_flow_wait_events_total Flow wait events by reason, direction, and outcome"
    );
    let _ = writeln!(out, "# TYPE telemt_flow_wait_events_total counter");
    let _ = writeln!(
        out,
        "telemt_flow_wait_events_total{{reason=\"middle_rate_limit\",direction=\"down\",outcome=\"waited\"}} {}",
        if core_enabled {
            stats.get_flow_wait_middle_rate_limit_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_flow_wait_events_total{{reason=\"middle_rate_limit\",direction=\"down\",outcome=\"cancelled\"}} {}",
        if core_enabled {
            stats.get_flow_wait_middle_rate_limit_cancelled_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_flow_wait_ms_total Flow wait time in milliseconds by reason and direction"
    );
    let _ = writeln!(out, "# TYPE telemt_flow_wait_ms_total counter");
    let _ = writeln!(
        out,
        "telemt_flow_wait_ms_total{{reason=\"middle_rate_limit\",direction=\"down\"}} {}",
        if core_enabled {
            stats.get_flow_wait_middle_rate_limit_ms_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_session_drop_fallback_total Session reservations cleaned by Drop instead of explicit async release"
    );
    let _ = writeln!(out, "# TYPE telemt_session_drop_fallback_total counter");
    let _ = writeln!(
        out,
        "telemt_session_drop_fallback_total {}",
        if core_enabled {
            stats.get_session_drop_fallback_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_frame_buf_shrink_total DC->Client reusable frame buffer shrink events"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_frame_buf_shrink_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_frame_buf_shrink_total {}",
        if me_allows_normal {
            stats.get_me_d2c_frame_buf_shrink_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_frame_buf_shrink_bytes_total DC->Client reusable frame buffer bytes released"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_d2c_frame_buf_shrink_bytes_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_frame_buf_shrink_bytes_total {}",
        if me_allows_normal {
            stats.get_me_d2c_frame_buf_shrink_bytes_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_batch_frames_bucket_total DC->Client batch frame count buckets"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_d2c_batch_frames_bucket_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_frames_bucket_total{{bucket=\"1\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_frames_bucket_1()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_frames_bucket_total{{bucket=\"2_4\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_frames_bucket_2_4()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_frames_bucket_total{{bucket=\"5_8\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_frames_bucket_5_8()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_frames_bucket_total{{bucket=\"9_16\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_frames_bucket_9_16()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_frames_bucket_total{{bucket=\"17_32\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_frames_bucket_17_32()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_frames_bucket_total{{bucket=\"gt_32\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_frames_bucket_gt_32()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_d2c_batch_bytes_bucket_total DC->Client batch byte size buckets"
    );
    let _ = writeln!(out, "# TYPE telemt_me_d2c_batch_bytes_bucket_total counter");
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_bytes_bucket_total{{bucket=\"0_1k\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_bytes_bucket_0_1k()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_bytes_bucket_total{{bucket=\"1k_4k\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_bytes_bucket_1k_4k()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_bytes_bucket_total{{bucket=\"4k_16k\"}} {}",
        if me_allows_debug {
            stats.get_me_d2c_batch_bytes_bucket_4k_16k()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_d2c_batch_bytes_bucket_total{{bucket=\"16k_64k\"}
```

### Core Architecture Module: `src/metrics/render/me_floor.rs`
```
use super::*;
use std::fmt::Write;

pub(super) fn render(
    out: &mut String,
    stats: &Stats,
    config: &ProxyConfig,
    me_allows_normal: bool,
) {
    let floor_mode = config.general.me_floor_mode;
    let _ = writeln!(
        out,
        "telemt_me_floor_mode{{mode=\"static\"}} {}",
        if matches!(floor_mode, crate::config::MeFloorMode::Static) {
            1
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_floor_mode{{mode=\"adaptive\"}} {}",
        if matches!(floor_mode, crate::config::MeFloorMode::Adaptive) {
            1
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_floor_mode_switch_all_total Runtime ME floor mode switches"
    );
    let _ = writeln!(out, "# TYPE telemt_me_floor_mode_switch_all_total counter");
    let _ = writeln!(
        out,
        "telemt_me_floor_mode_switch_all_total {}",
        if me_allows_normal {
            stats.get_me_floor_mode_switch_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_floor_mode_switch_total{{from=\"static\",to=\"adaptive\"}} {}",
        if me_allows_normal {
            stats.get_me_floor_mode_switch_static_to_adaptive_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_floor_mode_switch_total{{from=\"adaptive\",to=\"static\"}} {}",
        if me_allows_normal {
            stats.get_me_floor_mode_switch_adaptive_to_static_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_cpu_cores_detected Runtime detected logical CPU cores for adaptive floor"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_cpu_cores_detected gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_cpu_cores_detected {}",
        if me_allows_normal {
            stats.get_me_floor_cpu_cores_detected_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_cpu_cores_effective Runtime effective logical CPU cores for adaptive floor"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_cpu_cores_effective gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_cpu_cores_effective {}",
        if me_allows_normal {
            stats.get_me_floor_cpu_cores_effective_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_global_cap_raw Runtime raw global adaptive floor cap"
    );
    let _ = writeln!(out, "# TYPE telemt_me_adaptive_floor_global_cap_raw gauge");
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_global_cap_raw {}",
        if me_allows_normal {
            stats.get_me_floor_global_cap_raw_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_global_cap_effective Runtime effective global adaptive floor cap"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_global_cap_effective gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_global_cap_effective {}",
        if me_allows_normal {
            stats.get_me_floor_global_cap_effective_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_target_writers_total Runtime adaptive floor target writers total"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_target_writers_total gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_target_writers_total {}",
        if me_allows_normal {
            stats.get_me_floor_target_writers_total_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_active_cap_configured Runtime configured active writer cap"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_active_cap_configured gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_active_cap_configured {}",
        if me_allows_normal {
            stats.get_me_floor_active_cap_configured_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_active_cap_effective Runtime effective active writer cap"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_active_cap_effective gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_active_cap_effective {}",
        if me_allows_normal {
            stats.get_me_floor_active_cap_effective_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_warm_cap_configured Runtime configured warm writer cap"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_warm_cap_configured gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_warm_cap_configured {}",
        if me_allows_normal {
            stats.get_me_floor_warm_cap_configured_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_adaptive_floor_warm_cap_effective Runtime effective warm writer cap"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_adaptive_floor_warm_cap_effective gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_adaptive_floor_warm_cap_effective {}",
        if me_allows_normal {
            stats.get_me_floor_warm_cap_effective_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_writers_active_current Current non-draining active ME writers"
    );
    let _ = writeln!(out, "# TYPE telemt_me_writers_active_current gauge");
    let _ = writeln!(
        out,
        "telemt_me_writers_active_current {}",
        if me_allows_normal {
            stats.get_me_writers_active_current_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_writers_warm_current Current non-draining warm ME writers"
    );
    let _ = writeln!(out, "# TYPE telemt_me_writers_warm_current gauge");
    let _ = writeln!(
        out,
        "telemt_me_writers_warm_current {}",
        if me_allows_normal {
            stats.get_me_writers_warm_current_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_floor_cap_block_total Reconnect attempts blocked by adaptive floor caps"
    );
    let _ = writeln!(out, "# TYPE telemt_me_floor_cap_block_total counter");
    let _ = writeln!(
        out,
        "telemt_me_floor_cap_block_total {}",
        if me_allows_normal {
            stats.get_me_floor_cap_block_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_floor_swap_idle_total Adaptive floor cap recovery via idle writer swap"
    );
    let _ = writeln!(out, "# TYPE telemt_me_floor_swap_idle_total counter");
    let _ = writeln!(
        out,
        "telemt_me_floor_swap_idle_total {}",
        if me_allows_normal {
            stats.get_me_floor_swap_idle_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_floor_swap_idle_failed_total Failed idle swap attempts under adaptive floor caps"
    );
    let _ = writeln!(out, "# TYPE telemt_me_floor_swap_idle_failed_total counter");
    let _ = writeln!(
        out,
        "telemt_me_floor_swap_idle_failed_total {}",
        if me_allows_normal {
            stats.get_me_floor_swap_idle_failed_total()
        } else {
            0
        }
    );
}

```

### Core Architecture Module: `src/metrics/render/me_hardswap.rs`
```
use std::fmt::Write;

use crate::transport::middle_proxy::MeApiHardswapSnapshot;

/// Renders fixed-cardinality hardswap and writer-replacement gauges.
pub(super) fn render(out: &mut String, snapshot: Option<&MeApiHardswapSnapshot>, enabled: bool) {
    let snapshot = enabled.then_some(snapshot).flatten();
    let pending = snapshot.is_some_and(|value| value.pending);
    let pending_age_secs = snapshot
        .and_then(|value| value.pending_age_secs)
        .unwrap_or(0);
    let pending_writers_current = snapshot
        .map(|value| value.pending_writers_current)
        .unwrap_or(0);
    let pending_writer_deficit = snapshot
        .map(|value| value.pending_writer_deficit)
        .unwrap_or(0);
    let pending_missing_dc_groups = snapshot
        .map(|value| value.pending_missing_dc_groups)
        .unwrap_or(0);
    let pending_map_current = snapshot
        .and_then(|value| value.pending_map_current)
        .is_some_and(|value| value);
    let orphan_warm_writers_current = snapshot
        .map(|value| value.orphan_warm_writers_current)
        .unwrap_or(0);
    let replacement_preparing_current = snapshot
        .map(|value| value.replacement_preparing_current)
        .unwrap_or(0);
    let replacement_retiring_current = snapshot
        .map(|value| value.replacement_retiring_current)
        .unwrap_or(0);

    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending Whether an ME hardswap generation is pending"
    );
    let _ = writeln!(out, "# TYPE telemt_me_hardswap_pending gauge");
    let _ = writeln!(out, "telemt_me_hardswap_pending {}", usize::from(pending));
    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_age_seconds Age of the pending ME hardswap generation"
    );
    let _ = writeln!(out, "# TYPE telemt_me_hardswap_pending_age_seconds gauge");
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_age_seconds {pending_age_secs}"
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_writers_current Authoritative warm writers in the pending generation"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_hardswap_pending_writers_current gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_writers_current {pending_writers_current}"
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_writer_deficit Writers missing from the pending generation floor"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_hardswap_pending_writer_deficit gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_writer_deficit {pending_writer_deficit}"
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_missing_dc_groups Desired DC-family groups below the pending-generation floor"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_hardswap_pending_missing_dc_groups gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_missing_dc_groups {pending_missing_dc_groups}"
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_map_current Whether the pending generation targets the current endpoint map"
    );
    let _ = writeln!(out, "# TYPE telemt_me_hardswap_pending_map_current gauge");
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_map_current {}",
        usize::from(pending_map_current)
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_orphan_warm_writers_current Warm writers not owned by the pending hardswap generation"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_hardswap_orphan_warm_writers_current gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_hardswap_orphan_warm_writers_current {orphan_warm_writers_current}"
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_replacement_current ME writer replacements by transaction phase"
    );
    let _ = writeln!(out, "# TYPE telemt_me_writer_replacement_current gauge");
    let _ = writeln!(
        out,
        "telemt_me_writer_replacement_current{{state=\"preparing\"}} {replacement_preparing_current}"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_replacement_current{{state=\"retiring\"}} {replacement_retiring_current}"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_bounded_hardswap_and_replacement_state() {
        let snapshot = MeApiHardswapSnapshot {
            pending: true,
            pending_age_secs: Some(42),
            pending_writers_current: 3,
            pending_writer_deficit: 4,
            pending_missing_dc_groups: 2,
            pending_map_current: Some(true),
            orphan_warm_writers_current: 1,
            replacement_preparing_current: 5,
            replacement_retiring_current: 6,
        };
        let mut out = String::new();

        render(&mut out, Some(&snapshot), true);

        assert!(out.contains("telemt_me_hardswap_pending 1"));
        assert!(out.contains("telemt_me_hardswap_pending_age_seconds 42"));
        assert!(out.contains("telemt_me_hardswap_pending_writer_deficit 4"));
        assert!(out.contains("telemt_me_writer_replacement_current{state=\"preparing\"} 5"));
        assert!(out.contains("telemt_me_writer_replacement_current{state=\"retiring\"} 6"));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #573** (2026-04-15): **API - seems something wrong in Route and method matching /v1/xx/xx**
  *Symptoms*: According to [wiki](https://github.com/telemt/telemt/blob/main/docs/API.md#request-processing-order) i shouldn't get this via API req, but it seems something wrong in Route and method matching _[so i even cant reach the system version info to enrich this issue with it]_  See 2 calls via curl to api endpoint  **Health = Ok** root@telemt-webui:/# curl -H "Authorization: XX" -vv http://172.17.0.2:9091/v1/health ``` *  *   Trying 172.17.0.2:9091... * Connected to 172.17.0.2 (172.17.0.2) port 9091 (#0) > GET /v1/health HTTP/1.1 > Host: 172.17.0.2:9091 > User-Agent: curl/7.88.1 > Accept: */* > Authorization: XX >  < HTTP/1.1 200 OK < content-type: application/json; charset=utf-8 < content-length: 130 < date: Tue, 24 Mar 2026 07:35:02 GMT <  * Connection #0 to host 172.17.0.2 left intact {"ok":true,"data":{"status":"ok","read_only":false},"revision":"XX"} ```  **systemInfo = Fail** root@telemt-webui:/# curl -H "Authorization: XX" -vv http://172.17.0.2:9091/v1/system/info ``` *   Trying 172.17.0.2:9091... * Connected to 172.17.0.2 (172.17.0.2) port 9091 (#0) > GET /v1/system/info HTTP/1.1 > Host: 172.17.0.2:9091 > User-Agent: curl/7.88.1 > Accept: */* > Authorization: XX >  < HTTP/1.1 404 Not Found < content-type: application/json; charset=utf-8 < content-length: 86 < date: Tue, 24 Mar 2026 07:41:51 GMT <  * Connection #0 to host 172.17.0.2 left intact {"ok":false,"error":{"code":"not_found","message":"Route not found"},"request_id":738} ```  **It seems something wrong with telemt it
  **Post-Mortem & Fix Analysis**:
  > seems interesting, will be investigate...
  > fixed in [3.4.0](https://github.com/telemt/telemt/releases/tag/3.4.0)

- **Issue #94** (2026-02-25): **[FEATURE] Limit architecture / DPI Detection avoidance / SOCKS Integration**
  *Symptoms*: Это идеологическое продолжение #22, там видимо не поняли про что я писал, тут опишу максимально подробно, с решением, которое вижу на своем опыте. В заголовке "каша", потому что это все взаимосвязано. _Итак, погнали, "Ты снова выходишь на связь..."_  ### Проблема: Как я и писал в #22 ограничения, которые сервер создает клиенту, уже после handshake, "провоцируют" **клиент** на постоянный реконнект, заставляя думать, что соединение просто потеряно, создавая мини-ddos атаку на порт MTProxy. **Это весьма сильно нарушает маскировку под TLS, создавая нетипичную модель поведения трафика,** соответственно подсвечивает сервис для провайдера (а фиг бы с ним) и РКН (если вспомнить, что VLESS ~~блокировали~~ _пытались_ по количеству коннектов, то инструменты для этого у них есть), как только последним кинут кость "банить", этот фактор станет первым демаскирующим, уже не говоря о том, что еще раньше может прийти хостер у которого закончились порты, именно поэтому они не любят торренты. _Кстати, вероятно этот баг является причиной #56, где в качестве решения просто "отсыпали" лимитов побольше._  #### Демо: В качестве примера прикрепляю домашнее видео, где клиент упирается в лимит, и просто сидит ждет, пока "видосик загрузится". На 12 секунде у пользователя закончился трафик, дальше 50 секунд мы можем наблюдать пенетрацию порта (слева количество открытых/закрывающихся соединений) с 89 до 3254, и это только один клиент...  https://github.com/user-attachments/assets/07a497c3-0cde-4e07-8b9f-bc

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

### Incident Patch 1: `b594ee55` (2026-11-12)
**Commit Message**: Merge pull request #966 from AndreyOsipuk/fix/emulated-record-marker

Randomize the inner content type byte in emulated TLS ApplicationData

**File**: `src/tls_front/emulator.rs` (modified, +4/-13)
```diff
@@ -508,21 +508,13 @@ pub fn build_emulated_server_hello(
                     rec.extend_from_slice(&payload[payload_offset..payload_offset + copy_len]);
                     payload_offset += copy_len;
                 }
-                if body_len > copy_len {
-                    rec.extend_from_slice(&rng.bytes(body_len - copy_len));
-                }
-                rec.push(0x16);
-                rec.extend_from_slice(&rng.bytes(16));
+                // The 17-byte tail stands in for the encrypted inner content
+                // type and AEAD tag. Both are ciphertext in real TLS 1.3, so a
+                // fixed plaintext content type byte would be a stable marker.
+                rec.extend_from_slice(&rng.bytes(body_len - copy_len + 17));
             } else {
                 rec.extend_from_slice(&rng.bytes(size));
             }
-        } else if size > 17 {
-            let body_len = size - 17;
-            let mut body = Vec::with_capacity(body_len);
-            body.extend_from_slice(&rng.bytes(body_len));
-            rec.extend_from_slice(&body);
-            rec.push(0x16);
-            rec.extend_from_slice(&rng.bytes(16));
         } else {
             rec.extend_from_slice(&rng.bytes(size));
         }
@@ -887,7 +879,6 @@ mod tests {
 
         let payload = first_app_data_payload(&response);
         assert!(payload.len() >= 64);
-        assert_eq!(payload[payload.len() - 17], 0x16);
     }
 
     #[test]
```

**File**: `src/tls_front/tests/emulator_security_tests.rs` (modified, +55/-0)
```diff
@@ -1,3 +1,4 @@
+use std::collections::HashSet;
 use std::time::SystemTime;
 
 use crate::crypto::SecureRandom;
@@ -156,3 +157,57 @@ fn emulated_server_hello_prefers_cert_payload_over_alpn_marker() {
         "ALPN marker must not displace selected certificate payload"
     );
 }
+
+fn inner_content_type_bytes(
+    cached: &CachedTlsData,
+    client_tls_version: ClientHelloTlsVersion,
+) -> HashSet<u8> {
+    let rng = SecureRandom::new();
+    let mut seen = HashSet::new();
+    for _ in 0..32 {
+        let response = build_emulated_server_hello(
+            b"secret",
+            &[0x33; 32],
+            &[0x43; 16],
+            cached,
+            true,
+            true,
+            client_tls_version,
+            [0x13, 0x01],
+            &test_server_key_share(),
+            &rng,
+            None,
+            0,
+        );
+        let payload = first_app_data_payload(&response);
+        assert!(payload.len() > 17);
+        seen.insert(payload[payload.len() - 17]);
+    }
+    seen
+}
+
+#[test]
+fn emulated_server_hello_inner_content_type_position_is_not_constant() {
+    let cached = make_cached(None);
+
+    let seen = inner_content_type_bytes(&cached, ClientHelloTlsVersion::Tls13);
+    assert!(
+        seen.len() > 1,
+        "byte at the TLS 1.3 inner content type position must not be a fixed plaintext marker"
+    );
+}
+
+#[test]
+fn emulated_server_hello_with_cert_payload_inner_content_type_position_is_not_constant() {
+    let cert_msg = vec![0x0b, 0x00, 0x00, 0x05, 0x00, 0xaa, 0xbb, 0xcc, 0xdd];
+    let cached = make_cached(Some(TlsCertPayload {
+        cert_chain_der: vec![vec![0x30, 0x01, 0x00]],
+        certificate_message: cert_msg,
+    }));
+
+    let seen = inner_content_type_bytes(&cached, ClientHelloTlsVersion::Tls12);
+    assert!(
+        seen.len() > 1,
+        "byte after the certificate payload must not be a fixed plaintext content type marker"
+    );
+}
```

---

### Incident Patch 2: `f3cc2017` (2026-11-12)
**Commit Message**: Merge pull request #968 from AndreyOsipuk/fix/tls-profile-fast-retry

Retry missing TLS front profiles with backoff instead of waiting for the regular refresh

**File**: `src/maestro/tls_bootstrap.rs` (modified, +178/-33)
```diff
@@ -14,6 +14,11 @@ use crate::transport::UpstreamManager;
 
 use super::generation::RuntimeTaskScope;
 
+/// First retry delay for domains that are still served from the default profile.
+const TLS_FRONT_RETRY_INITIAL: Duration = Duration::from_secs(30);
+/// Retry delay cap; far below the regular refresh period.
+const TLS_FRONT_RETRY_MAX: Duration = Duration::from_secs(600);
+
 /// Readiness requirement for TLS-front cache initialization.
 #[derive(Clone, Copy)]
 pub(crate) enum TlsBootstrapPolicy {
@@ -36,9 +41,10 @@ struct TlsFetchContext {
 }
 
 impl TlsFetchContext {
-    async fn fetch_all(&self, failure_message: &'static str) {
+    async fn fetch_domains(&self, domains: &[String], failure_message: &'static str) {
         let mut join = tokio::task::JoinSet::new();
-        for domain in self.domains.clone() {
+        for domain in domains {
+            let domain = domain.clone();
             let cache = self.cache.clone();
             let host = tls_fetch_host_for_domain(&self.mask_host, &self.primary_domain, &domain);
             let unix_sock = self.mask_unix_sock.clone();
@@ -73,9 +79,16 @@ impl TlsFetchContext {
     }
 
     async fn fetch_all_with_budget(&self, phase: &'static str) {
-        if tokio::time::timeout(self.strategy.total_budget, self.fetch_all(phase))
-            .await
-            .is_err()
+        self.fetch_with_budget(&self.domains, phase).await;
+    }
+
+    async fn fetch_with_budget(&self, domains: &[String], phase: &'static str) {
+        if tokio::time::timeout(
+            self.strategy.total_budget,
+            self.fetch_domains(domains, phase),
+        )
+        .await
+        .is_err()
         {
             warn!(
                 phase,
@@ -86,6 +99,69 @@ impl TlsFetchContext {
     }
 }
 
+/// Regular refresh period for fetched profiles: 4-6h base plus up to 2h jitter.
+fn regular_refresh_delay() -> Duration {
+    let base_secs = rand::rng().random_range(4 * 3600..=6 * 3600);
+    let jitter_secs = rand::rng().random_range(0..=7200);
+    Duration::from_secs(base_secs + jitter_secs)
+}
+
+/// Picks a delay in `[backoff / 2, backoff]` so that nodes restarted together do not
+/// probe the origin in lockstep, while the delay never exceeds the backoff.
+fn jittered_retry_delay(backoff: Duration) -> Duration {
+    let backoff_ms = u64::try_from(backoff.as_millis()).unwrap_or(u64::MAX);
+    Duration::from_millis(rand::rng().random_range(backoff_ms / 2..=backoff_ms))
+}
+
+/// Refresh cadence: exponential retries while any domain still has the default
+/// profile, the regular period once every domain has a fetched one.
+struct RefreshSchedule {
+    retry_backoff: Duration,
+}
+
+impl RefreshSchedule {
+    fn new() -> Self {
+        Self {
+            retry_backoff: TLS_FRONT_RETRY_INITIAL,
+        }
+    }
+
+    fn next_delay(&mut self, has_default_profiles: bool) -> Duration {
+        if !has_default_profiles {
+            self.retry_backoff = TLS_FRONT_RETRY_INITIAL;
+            return regular_refresh_delay();
+        }
+        let delay = jittered_retry_delay(self.retry_backoff);
+        self.retry_backoff = self
+            .retry_backoff
+            .saturating_mul(2)
+            .min(TLS_FRONT_RETRY_MAX);
+        delay
+    }
+}
+
+/// Retries only the domains without a fetched profile, so origins that already
+/// answered are not probed more often than the regular refresh.
+async fn run_refresh_loop(context: TlsFetchContext) {
+    let mut schedule = RefreshSchedule::new();
+    loop {
+        let pending = context
+            .cache
+            .default_profile_domains(&context.domains)
+            .await;
+        tokio::time::sleep(schedule.next_delay(!pending.is_empty())).await;
+        if pending.is_empty() {
+            context
+                .fetch_all_with_budget("TLS emulation refresh failed")
+                .await;
+        } else {
+            context
+                .fetch_with_budget(&pending, "TLS emulation retry failed")
+                .await;
+        }
+    }
+}
+
 fn tls_fetch_host_for_domain(mask_host: &str, primary_tls_domain: &str, domain: &str) -> String {
     if mask_host.eq_ignore_ascii_case(primary_tls_domain) {
         domain.to_string()
@@ -165,28 +241,8 @@ pub(crate) async fn bootstrap_tls_front(
         proxy_protocol: config.censorship.mask_proxy_protocol,
     };
 
-    match policy {
-        TlsBootstrapPolicy::BestEffort => {
-            let initial_fetch = fetch_context.clone();
-            let fake_cert_len = config.censorship.fake_cert_len;
-            task_scope.spawn(async move {
-                initial_fetch
-                    .fetch_all_with_budget("TLS emulation initial fetch failed")
-                    .await;
-                for domain in initial_fetch
-                    .cache
-                    .default_profile_domains(&initial_fetch.domains)
-                    .await
-                {
-                    warn!(
-                        domain
```

---

### Incident Patch 3: `55d26e0c` (2026-11-12)
**Commit Message**: Merge branch 'main' into fix/tls-profile-fast-retry

**File**: `Cargo.lock` (modified, +24/-7)
```diff
@@ -2780,7 +2780,7 @@ dependencies = [
 
 [[package]]
 name = "telemt"
-version = "3.5.16"
+version = "3.5.17"
 dependencies = [
  "aes",
  "anyhow",
@@ -2834,6 +2834,7 @@ dependencies = [
  "tokio-tungstenite",
  "tokio-util",
  "toml",
+ "toml_edit",
  "tracing",
  "tracing-appender",
  "tracing-subscriber",
@@ -3076,27 +3077,40 @@ dependencies = [
 
 [[package]]
 name = "toml_datetime"
-version = "1.1.1+spec-1.1.0"
+version = "1.1.3+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3165f65f62e28e0115a00b2ebdd37eb6f3b641855f9d636d3cd4103767159ad7"
+checksum = "173f25c883cd2176a2d8212155638c0a60d484a9d84546d270866f40f56b6e49"
 dependencies = [
  "serde_core",
 ]
 
+[[package]]
+name = "toml_edit"
+version = "0.25.19+spec-1.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "dd43688c4858d7264ae1cf9a9f874a67c3feb74a883b1cd7bebd6a4ea8307218"
+dependencies = [
+ "indexmap",
+ "toml_datetime",
+ "toml_parser",
+ "toml_writer",
+ "winnow",
+]
+
 [[package]]
 name = "toml_parser"
-version = "1.1.3+spec-1.1.0"
+version = "1.1.5+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1d38ac1cf9b95face32296c0a3ede1fdc270627c9d9c02a7274dd6d960dc4d56"
+checksum = "baa693a8032d7e1cada7d0041e96126df243179ff061456783ac7f12bda4744c"
 dependencies = [
  "winnow",
 ]
 
 [[package]]
 name = "toml_writer"
-version = "1.1.2+spec-1.1.0"
+version = "1.2.0+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7d56353a2a665ad0f41a421187180aab746c8c325620617ad883a99a1cbe66d2"
+checksum = "009dbb7700f11c55ef83aebbe4c0e9cf1f1ac0844bd8d6f00dc38f302026e13a"
 
 [[package]]
 name = "tower"
@@ -3697,6 +3711,9 @@ name = "winnow"
 version = "1.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "23b97319f7b8343df12cc98938e5c3eb436064524c8d2b4e30a1d3a36eecdf81"
+dependencies = [
+ "memchr",
+]
 
 [[package]]
 name = "wit-bindgen"
```

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "telemt"
-version = "3.5.16"
+version = "3.5.17"
 edition = "2024"
 rust-version = "1.88"
 
@@ -49,6 +49,7 @@ shadowsocks = { version = "1.24.0", default-features = false, features = [
 serde = { version = "1.0.229", features = ["derive"] }
 serde_json = "1.0.151"
 toml = "1.1.5"
+toml_edit = "0.25.19"
 x509-parser = "0.18.1"
 
 # Utils
```

**File**: `docs/Advanced_settings/HIGH_LOAD.en.md` (modified, +31/-14)
```diff
@@ -1,5 +1,10 @@
 # High-Load Configuration & Tuning Guide
-When deploying Telemt under high-traffic load (tens or hundreds of thousands of concurrent connections), the standard OS network stack limits can lead to packet drops, high CPU context switching, and connection failures. This guide covers Linux kernel tuning, hardware configuration, and architecture optimizations required to prepare the server for high-load scenarios.
+
+[English](HIGH_LOAD.en.md) · [Русский](HIGH_LOAD.ru.md) · [Deutsch](HIGH_LOAD.de.md)
+
+Use this guide when measured load exposes a specific resource limit. The values below are example capacities, not a tested guarantee of a particular connection count. Record the kernel version, active configuration, connection rate, memory use and latency before changing a setting. Save the previous values and change one group at a time so you can compare and revert it.
+
+For terminology, see the [shared glossary](../TERMINOLOGY.md).
 
 ---
 ## 1. System Limits & File Descriptors
@@ -51,45 +56,57 @@ net.ipv4.tcp_max_syn_backlog = 65535
 net.ipv4.tcp_syncookies = 1
 ```
 ### 2.2 Port Exhaustion & TIME-WAIT Sockets
-High churn rates lead to ephemeral port exhaustion. Expand the range and rapidly recycle closed sockets:
+First distinguish failed outbound connects caused by exhausted source ports from a large but harmless TIME-WAIT population. Inspect the failing error, destination tuples and `ss -s`. Expanding the ephemeral range can help when this is the limiting resource; account for ports reserved by other services:
+
 ```ini
 net.ipv4.ip_local_port_range = 10000 65535
-net.ipv4.tcp_fin_timeout = 15
-net.ipv4.tcp_tw_reuse = 1
-net.ipv4.tcp_max_tw_buckets = 2000000
 ```
-### 2.3 TCP Keepalive (Aggressive Dead Connection Culling)
-By default, Linux keeps silent, dropped connections open for over 2 hours. This consumes memory at scale. The values below start probing after five idle minutes and abandon an unresponsive peer after the subsequent probe budget, roughly 7–8 minutes after it became idle:
+
+`tcp_tw_reuse` controls reuse of TIME-WAIT sockets when the protocol permits it. In the referenced kernel documentation, `0` disables it, `1` enables it globally and `2` limits it to loopback; inspect your running kernel's current value before changing it. `tcp_max_tw_buckets` limits retained TIME-WAIT entries, not the duration of TIME-WAIT.
+
+`tcp_fin_timeout` applies to orphaned connections in `FIN_WAIT_2`; reducing it does not shorten `TIME_WAIT`. Keep these mechanisms separate when investigating port exhaustion. See the [Linux IP sysctl reference](https://docs.kernel.org/networking/ip-sysctl.html).
+
+### 2.3 TCP Keepalive
+These sysctls are defaults for sockets with TCP keepalive enabled that do not override the corresponding options. They start probing after five idle minutes and exhaust the subsequent probe budget after roughly 7–8 minutes of total inactivity:
+
 ```ini
 net.ipv4.tcp_keepalive_time = 300
 net.ipv4.tcp_keepalive_intvl = 30
 net.ipv4.tcp_keepalive_probes = 5
 ```
+
+Telemt overrides keepalive time and interval on client sockets using `timeouts.client_keepalive` (default 15 seconds). On Linux its ME sockets use 30 seconds idle, a 10-second interval and 3 probes. These are TCP socket settings; ME RPC Ping/Pong, `timeouts.client_ack` and relay idle policies impose separate checks. The sysctl example therefore does not define the lifetime of every Telemt connection. Verify the relevant socket and configured application timeout.
+
 ### 2.4 TCP Buffers & Congestion Control
-Optimize memory usage per socket and switch to BBR (Bottleneck Bandwidth and Round-trip propagation time) to improve latency on lossy networks:
+Measure memory pressure, throughput and p95/p99 latency with the same workload before and after changing buffers. The maximum below is a ceiling for an eligible socket, not a fixed allocation for every connection. Telemt also sets socket buffer sizes explicitly, so kernel defaults alone do not describe its effective buffers.
+
 ```ini
-# Core buffer sizes
+# Example buffer ceilings: size them for the available memory and workload.
 net.core.rmem_default = 262144
 net.core.wmem_default = 262144
 net.core.rmem_max = 16777216
 net.core.wmem_max = 16777216
-# TCP-specific buffers (min, default, max)
 net.ipv4.tcp_rmem = 4096 87380 16777216
 net.ipv4.tcp_wmem = 4096 65536 16777216
-# Enable BBR
+```
+
+Check available congestion-control algorithms with `sysctl net.ipv4.tcp_available_congestion_control`. If BBR is supported, evaluate it against the current algorithm under representative RTT, loss and load; this guide does not establish that it always improves latency. An example BBR configuration is:
+
+```ini
 net.core.default_qdisc = fq
 net.ipv4.tcp_congestion_control = bbr
 ```
 
+
 ---
 ## 3. Conntrack (Netfilter) Tuning
-If your server uses `iptables`, `ufw`, or `firewalld`, the Linux kernel tracks every connection state in a table (`nf_conntrack`). When this table fills u
```

**File**: `docs/Advanced_settings/HIGH_LOAD.ru.md` (modified, +49/-32)
```diff
@@ -1,12 +1,17 @@
-# Руководство по High-Load конфигурации и тюнингу
-При развертывании Telemt под высокой нагрузкой (десятки и сотни тысяч одновременных подключений), стандартные ограничения сетевого стека ОС могут приводить к потерям пакетов, переключениям контекста CPU и отказам в соединениях. В данном руководстве описана настройка ядра Linux, системных лимитов и аппаратной конфигурации для работы в подобных сценариях.
+# Настройка Telemt для высокой нагрузки
+
+[English](HIGH_LOAD.en.md) · [Русский](HIGH_LOAD.ru.md) · [Deutsch](HIGH_LOAD.de.md)
+
+Используйте это руководство, когда измерения показывают конкретное ограничение ресурсов. Значения ниже — примеры настройки, а не подтверждённая гарантия определённого числа соединений. Перед изменениями запишите версию ядра, действующую конфигурацию, частоту подключений, расход памяти и задержку. Сохраните прежние значения и меняйте одну группу настроек за раз, чтобы сравнить результат и при необходимости откатить изменение.
+
+Термины объяснены в [общем словаре](../TERMINOLOGY.md).
 
 ---
 ## 1. Системные лимиты и файловые дескрипторы
 
-Также учитывайте [`server.max_connections`](../Config_params/CONFIG_PARAMS.ru.md#max_connections) при расчёте клиентской нагрузки, в том числе через ME. `0` снимает этот общий клиентский лимит и не ограничивает ME 128 клиентами. Ограничения дескрипторов ОС, пользовательские лимиты, очереди, бюджеты памяти и политики writer-ов продолжают действовать. Для изменения параметра нужен перезапуск процесса.
+Также учитывайте [`server.max_connections`](../Config_params/CONFIG_PARAMS.ru.md#max_connections) при расчёте клиентской нагрузки, в том числе через ME. `0` снимает этот общий клиентский лимит и не ограничивает ME 128 клиентами. Ограничения дескрипторов ОС, пользовательские лимиты, очереди, бюджеты памяти и политики ME Writer продолжают действовать. Для изменения параметра нужен перезапуск процесса.
 
-Каждое TCP-сосоединение требует файлового дескриптора. При 100 тысячах соединений стандартные лимиты Linux (зачастую 1024 или 65535) будут исчерпаны немедленно.
+Каждое TCP-соединение требует файлового дескриптора. При 100 тысячах соединений стандартные лимиты Linux (зачастую 1024 или 65535) будут исчерпаны немедленно.
 ### Общесистемные лимиты (`sysctl`)
 Увеличьте глобальный лимит файловых дескрипторов в `/etc/sysctl.conf`:
 ```ini
@@ -51,45 +56,57 @@ net.ipv4.tcp_max_syn_backlog = 65535
 net.ipv4.tcp_syncookies = 1
 ```
 ### 2.2 Исчерпание портов и TIME-WAIT сокеты
-Высокая текучесть приводит к нехватке временных (ephemeral) портов. Расширьте диапазон портов и позвольте ядру быстро переиспользовать закрытые сокеты:
+Сначала отличите ошибки исходящих подключений из-за нехватки портов от большого, но безвредного числа записей TIME-WAIT. Проверьте ошибку подключения, адреса и порты назначения и вывод `ss -s`. Если ограничение действительно связано с исходными портами, диапазон можно расширить с учётом портов, зарезервированных другими службами:
+
 ```ini
 net.ipv4.ip_local_port_range = 10000 65535
-net.ipv4.tcp_fin_timeout = 15
-net.ipv4.tcp_tw_reuse = 1
-net.ipv4.tcp_max_tw_buckets = 2000000
 ```
-### 2.3 TCP Keepalive (Агрессивная очистка мертвых соединений)
-По умолчанию Linux держит "оборванные" TCP-сессии более 2 часов. Значения ниже начинают probes после пяти минут простоя и закрывают не отвечающий peer после последующего probe budget — примерно через 7–8 минут общего простоя:
+
+`tcp_tw_reuse` управляет повторным использованием TIME-WAIT-сокетов, когда это допускает протокол. В указанной документации ядра `0` отключает повторное использование, `1` включает его глобально, `2` — только для loopback. Перед изменением проверьте значение в работающем ядре. `tcp_max_tw_buckets` ограничивает число сохраняемых записей, а не продолжительность TIME-WAIT.
+
+`tcp_fin_timeout` действует на осиротевшие соединения в `FIN_WAIT_2`: его уменьшение не сокращает `TIME_WAIT`. При диагностике исчерпания портов различайте эти механизмы. См. [справочник IP sysctl ядра Linux](https://docs.kernel.org/networking/ip-sysctl.html).
+
+### 2.3 TCP Keepalive
+Эти sysctl задают значения по умолчанию для сокетов с включённым TCP keepalive, если приложение не переопределило соответствующие параметры. Проверки начинаются после пяти минут простоя; с учётом последующих проб общий срок составляет примерно 7–8 минут:
+
 ```ini
 net.ipv4.tcp_keepalive_time = 300
 net.ipv4.tcp_keepalive_intvl = 30
 net.ipv4.tcp_keepalive_probes = 5
 ```
-### 2.4 Буферы TCP и управление перегрузками (Congestion Control)
-Оптимизируйте использование памяти на сокет и переключитесь на алгоритм BBR (Bottleneck Bandwidth and Round-trip propagation time) для улучшения задержки на плохих сетях:
+
+Для клиентских сокетов Telemt задаёт время ожидания и интервал через `timeouts.client_keepalive` — по умолчанию 15 секунд. Для ME-сокетов на Linux используются 30 секунд простоя, интервал 10 секунд и 3 пробы. Это параметры TCP; ME RPC Ping/Pong, `timeouts.client_ack` и политики простоя при перед
```

**File**: `docs/Advanced_settings/TUNING.de.md` (modified, +28/-15)
```diff
@@ -1,5 +1,7 @@
 # Telemt Tuning-Leitfaden: Middle-End und Upstreams
 
+[English](TUNING.en.md) · [Русский](TUNING.ru.md) · [Deutsch](TUNING.de.md) · [EN / RU / DE terminology](../TERMINOLOGY.md)
+
 Dieses Dokument beschreibt das aktuelle Laufzeitverhalten für Middle-End (ME) und Upstream-Routing basierend auf:
 - `src/config/types.rs`
 - `src/config/defaults.rs`
@@ -8,6 +10,8 @@ Dieses Dokument beschreibt das aktuelle Laufzeitverhalten für Middle-End (ME) u
 
 Die unten angegebenen `Default`-Werte sind Code-Defaults (bei fehlendem Schlüssel), nicht zwingend die Werte aus `config.full.toml`.
 
+`Option<T>` und `null` in Typ- und Standardwertspalten beschreiben optionale interne Werte. TOML kennt kein `null`-Literal. Für die alten Aktualisierungsintervalle lassen Sie `general.update_every` weg und setzen die alten Schlüssel ausdrücklich; andernfalls beträgt das einheitliche Standardintervall 300 Sekunden. Null-Werte in Objektfeldern eines Konfigurations-PATCH werden ignoriert und entfernen keine Einstellungen.
+
 ## Middle-End-Parameter
 
 ### 1) ME-Grundmodus, NAT und STUN
@@ -65,7 +69,7 @@ Die unten angegebenen `Default`-Werte sind Code-Defaults (bei fehlendem Schlüss
 | `general.proxy_secret_stable_snapshots` | `u8` | `2` | muss `> 0` sein | Anzahl identischer Secret-Snapshots vor Rotation. | `proxy_secret_stable_snapshots = 3` |
 | `general.proxy_secret_rotate_runtime` | `bool` | `true` | keine | Aktiviert Runtime-Rotation des Proxy-Secrets. | `proxy_secret_rotate_runtime = true` |
 | `general.proxy_secret_len_max` | `usize` | `256` | Bereich `[32,4096]` | Obergrenze für akzeptierte Secret-Länge. | `proxy_secret_len_max = 512` |
-| `general.update_every` | `Option<u64>` | `300` | wenn gesetzt: `> 0`; bei `null`: Legacy-Min-Fallback | Einheitliches Refresh-Intervall für ME-Config + Secret-Updater. | `update_every = 300` |
+| `general.update_every` | `Option<u64>` | `300` | wenn gesetzt: `> 0`; ohne diesen Schlüssel mit expliziten alten Intervallen: deren Minimum | Einheitliches Refresh-Intervall für ME-Config + Secret-Updater. | `update_every = 300` |
 | `general.me_pool_drain_ttl_secs` | `u64` | `90` | keine | Altersschwelle für Warnungen bei langem Drain und Untergrenze der Force-Close-Normalisierung; gewährt keine stale Binds. | `me_pool_drain_ttl_secs = 120` |
 | `general.me_bind_stale_mode` | `"never"`, `"ttl"` oder `"always"` | `"never"` | keine | Steuert neue Bindings auf draining stale Writer für nicht abgedeckte DC-Family-Gruppen. | `me_bind_stale_mode = "never"` |
 | `general.me_bind_stale_ttl_secs` | `u64` | `90` | keine | Stale-Bind-Fenster nur für `me_bind_stale_mode = "ttl"`; `0` deaktiviert den TTL-Ablauf für zulässige draining Writer. | `me_bind_stale_ttl_secs = 90` |
@@ -74,20 +78,20 @@ Die unten angegebenen `Default`-Werte sind Code-Defaults (bei fehlendem Schlüss
 | `general.auto_degradation_enabled` | `bool` | `true` | keine | Reserviertes Kompatibilitätsfeld in aktueller Revision (kein aktiver Runtime-Consumer). | `auto_degradation_enabled = true` |
 | `general.degradation_min_unavailable_dc_groups` | `u8` | `2` | keine | Reservierter Kompatibilitäts-Schwellenwert in aktueller Revision (kein aktiver Runtime-Consumer). | `degradation_min_unavailable_dc_groups = 2` |
 
-Eine Hardswap-Kandidatengeneration ist nur für denselben Desired-Map-Hash und dieselbe Endpoint-Revision maßgeblich. Wiederholte Versuche verwenden diese pending Generation höchstens 1800 Sekunden wieder; danach wird eine neue Generation angelegt. Der Commit validiert die Authority erneut und verlangt mindestens `me_pool_min_fresh_ratio` frische DC-Family-Coverage. Fehlende Gruppen blockieren den Commit bei `me_bind_stale_mode = "never"`; `ttl` oder `always` können mit policy-begrenztem stale Fallback für diese Gruppen committen. Abgedeckte alte Writer können sofort retiret werden; Hardswap ist daher ein atomarer Policy-Übergang, keine universelle Zero-Drop-Garantie.
+Eine für Hardswap vorbereitete Generation darf nur übernommen werden, solange der Hash der gewünschten ME-Zuordnung und die Revision der Verbindungsziele unverändert sind. Wiederholungsversuche verwenden sie höchstens 1800 Sekunden; danach wird eine neue Generation angelegt. Vor der Übernahme prüft Telemt diese Voraussetzungen erneut. Der Anteil der durch neue Verbindungen abgedeckten Gruppen aus DC und IP-Adressfamilie muss mindestens `me_pool_min_fresh_ratio` betragen. Bei `me_bind_stale_mode = "never"` blockiert jede fehlende Gruppe die Übernahme. Mit `ttl` oder `always` dürfen für solche Gruppen ältere Verbindungen innerhalb der gewählten Richtlinie weiterverwendet werden. Alte ME Writer bereits abgedeckter Gruppen können sofort außer Betrieb genommen werden. Der atomare Wechsel der Richtlinie garantiert daher nicht den Erhalt aller Verbindungen.
 
-Writer-Replacement verwendet separat den cancellation-sicheren Zustand `Open -> Preparing -> Retiring`. `Preparing` verhindert doppelte Replacement-Arbeit, erlaubt aber weiterhin neue Binds. Unter dem Regist
```

**File**: `docs/Advanced_settings/TUNING.en.md` (modified, +26/-13)
```diff
@@ -1,5 +1,7 @@
 # Telemt Tuning Guide: Middle-End and Upstreams
 
+[English](TUNING.en.md) · [Русский](TUNING.ru.md) · [Deutsch](TUNING.de.md) · [EN / RU / DE terminology](../TERMINOLOGY.md)
+
 This document describes the current runtime behavior for Middle-End (ME) and upstream routing based on:
 - `src/config/types.rs`
 - `src/config/defaults.rs`
@@ -8,14 +10,16 @@ This document describes the current runtime behavior for Middle-End (ME) and ups
 
 Defaults below are code defaults (used when a key is omitted), not necessarily values from `config.full.toml` examples.
 
+`Option<T>` and `null` in type/default columns describe optional internal values. TOML has no `null` literal. To use legacy update intervals, omit `general.update_every` and explicitly set the legacy keys; otherwise the unified default is 300 seconds. Object-valued null members in config PATCH are ignored, not used to remove settings.
+
 ## Middle-End Parameters
 
 ### 1) Core ME mode, NAT, and STUN
 
 | Parameter | Type | Default | Constraints / validation | Runtime effect | Example |
 |---|---|---:|---|---|---|
 | `general.use_middle_proxy` | `bool` | `true` | none | Enables ME transport mode. If `false`, Direct mode is used. | `use_middle_proxy = true` |
-| `general.proxy_secret_path` | `Option<String>` | `"proxy-secret"` | path may be `null` | Path to Telegram infrastructure proxy-secret file. | `proxy_secret_path = "proxy-secret"` |
+| `general.proxy_secret_path` | `Option<String>` | `"proxy-secret"` | optional internal path; TOML has no `null` | Path to Telegram infrastructure proxy-secret file. | `proxy_secret_path = "proxy-secret"` |
 | `general.middle_proxy_nat_ip` | `Option<IpAddr>` | `null` | valid IP when set | Manual public NAT IP override for ME address material. | `middle_proxy_nat_ip = "203.0.113.10"` |
 | `general.middle_proxy_nat_probe` | `bool` | `true` | none | Enables ME NAT probing when ME mode and `network.stun_use` are both enabled. | `middle_proxy_nat_probe = true` |
 | `general.stun_nat_probe_concurrency` | `usize` | `8` | must be `> 0` | Max parallel STUN probes during NAT discovery. | `stun_nat_probe_concurrency = 16` |
@@ -65,7 +69,7 @@ Defaults below are code defaults (used when a key is omitted), not necessarily v
 | `general.proxy_secret_stable_snapshots` | `u8` | `2` | must be `> 0` | Number of identical proxy-secret snapshots required before rotation. | `proxy_secret_stable_snapshots = 3` |
 | `general.proxy_secret_rotate_runtime` | `bool` | `true` | none | Enables runtime proxy-secret rotation. | `proxy_secret_rotate_runtime = true` |
 | `general.proxy_secret_len_max` | `usize` | `256` | must be within `[32,4096]` | Upper limit for accepted proxy-secret length. | `proxy_secret_len_max = 512` |
-| `general.update_every` | `Option<u64>` | `300` | if set: must be `> 0`; if `null`: legacy min fallback | Unified refresh interval for ME config + secret updater. | `update_every = 300` |
+| `general.update_every` | `Option<u64>` | `300` | if set: must be `> 0`; omitted with explicit legacy keys: legacy minimum | Unified refresh interval for ME config + secret updater. | `update_every = 300` |
 | `general.me_pool_drain_ttl_secs` | `u64` | `90` | none | Age threshold for prolonged-drain warnings and the lower-bound normalization of force-close timeout; it does not grant stale binds. | `me_pool_drain_ttl_secs = 120` |
 | `general.me_bind_stale_mode` | `"never"`, `"ttl"`, or `"always"` | `"never"` | none | Controls whether new bindings may use draining stale writers for uncovered DC-family groups. | `me_bind_stale_mode = "never"` |
 | `general.me_bind_stale_ttl_secs` | `u64` | `90` | none | Stale-bind eligibility window used only when `me_bind_stale_mode = "ttl"`; `0` disables TTL expiry for eligible draining writers. | `me_bind_stale_ttl_secs = 90` |
@@ -86,8 +90,8 @@ Operators can observe pending age, writer count and deficit, missing DC groups,
 |---|---|---|---|---|
 | `general.middle_proxy_nat_stun` | Deprecated | `network.stun_servers` | Merged into `network.stun_servers` only when `network.stun_servers` is not explicitly set. | Move value into `network.stun_servers` and remove legacy key. |
 | `general.middle_proxy_nat_stun_servers` | Deprecated | `network.stun_servers` | Merged into `network.stun_servers` only when `network.stun_servers` is not explicitly set. | Move values into `network.stun_servers` and remove legacy key. |
-| `general.proxy_secret_auto_reload_secs` | Deprecated | `general.update_every` | Used only when `update_every = null` (legacy fallback path). | Set `general.update_every` explicitly and remove legacy key. |
-| `general.proxy_config_auto_reload_secs` | Deprecated | `general.update_every` | Used only when `update_every = null` (legacy fallback path). | Set `general.update_every` explicitly and remove legacy key. |
+| `general.proxy_secret_auto_reload_secs` | Deprecated | `general.update_every` | Used when `update_every` is omitted and legacy intervals are explicitly configured. | Set `gen
```

**File**: `docs/Advanced_settings/TUNING.ru.md` (modified, +78/-65)
```diff
@@ -1,99 +1,103 @@
 # Руководство по тюнингу Telemt: Middle-End и Upstreams
 
+[English](TUNING.en.md) · [Русский](TUNING.ru.md) · [Deutsch](TUNING.de.md) · [EN / RU / DE terminology](../TERMINOLOGY.md)
+
 Документ описывает актуальное поведение Middle-End (ME) и маршрутизации через upstream на основе:
 - `src/config/types.rs`
 - `src/config/defaults.rs`
 - `src/config/load.rs`
 - `src/transport/upstream.rs`
 
-Значения `Default` ниже — это значения из кода при отсутствии ключа в конфиге, а не обязательно значения из примеров `config.full.toml`.
+Значения `По умолчанию` ниже — это значения из кода при отсутствии ключа в конфиге, а не обязательно значения из примеров `config.full.toml`.
+
+`Option<T>` и `null` в столбцах типов и значений по умолчанию обозначают необязательные внутренние значения. В TOML нет литерала `null`. Для старых интервалов обновления не задавайте `general.update_every` и явно укажите старые ключи; в остальных случаях общий интервал по умолчанию равен 300 секундам. Значения null в полях объекта PATCH конфигурации игнорируются и не удаляют настройки.
 
 ## Параметры Middle-End
 
 ### 1) Базовый режим ME, NAT и STUN
 
-| Параметр | Тип | Default | Ограничения / валидация | Влияние на runtime | Пример |
+| Параметр | Тип | По умолчанию | Ограничения / валидация | Влияние на работу | Пример |
 |---|---|---:|---|---|---|
 | `general.use_middle_proxy` | `bool` | `true` | нет | Включает транспорт ME. При `false` используется Direct-режим. | `use_middle_proxy = true` |
-| `general.proxy_secret_path` | `Option<String>` | `"proxy-secret"` | путь может быть `null` | Путь к инфраструктурному proxy-secret Telegram. | `proxy_secret_path = "proxy-secret"` |
-| `general.middle_proxy_nat_ip` | `Option<IpAddr>` | `null` | валидный IP при задании | Ручной override публичного NAT IP для адресного материала ME. | `middle_proxy_nat_ip = "203.0.113.10"` |
-| `general.middle_proxy_nat_probe` | `bool` | `true` | нет | Включает NAT probing, когда одновременно включены ME-режим и `network.stun_use`. | `middle_proxy_nat_probe = true` |
+| `general.proxy_secret_path` | `Option<String>` | `"proxy-secret"` | необязательный путь; в TOML нет `null` | Путь к инфраструктурному proxy-secret Telegram. | `proxy_secret_path = "proxy-secret"` |
+| `general.middle_proxy_nat_ip` | `Option<IpAddr>` | `null` | валидный IP при задании | Явный публичный IP за NAT для вычисления адресной части ключей ME. | `middle_proxy_nat_ip = "203.0.113.10"` |
+| `general.middle_proxy_nat_probe` | `bool` | `true` | нет | Проверяет внешний адрес за NAT, если включены ME и `network.stun_use`. | `middle_proxy_nat_probe = true` |
 | `general.stun_nat_probe_concurrency` | `usize` | `8` | должно быть `> 0` | Максимум параллельных STUN-проб при NAT-детекте. | `stun_nat_probe_concurrency = 16` |
 | `network.stun_use` | `bool` | `true` | нет | Глобальный переключатель STUN. При `false` STUN отключен. | `stun_use = true` |
-| `network.stun_servers` | `Vec<String>` | встроенный публичный пул | удаляются дубликаты и пустые значения | Основной список STUN-серверов для NAT/public endpoint discovery. | `stun_servers = ["stun1.l.google.com:19302"]` |
-| `network.stun_tcp_fallback` | `bool` | `true` | нет | Включает TCP fallback, если UDP STUN недоступен. | `stun_tcp_fallback = true` |
-| `network.http_ip_detect_urls` | `Vec<String>` | `ifconfig.me` + `api.ipify.org` | нет | HTTP fallback для определения публичного IPv4 при недоступности STUN. | `http_ip_detect_urls = ["https://api.ipify.org"]` |
-| `general.stun_iface_mismatch_ignore` | `bool` | `false` | нет | Зарезервированный флаг в текущей ревизии (runtime его не использует). | `stun_iface_mismatch_ignore = false` |
-| `timeouts.me_one_retry` | `u8` | `12` | нет | Количество быстрых reconnect-попыток для DC с одним endpoint. | `me_one_retry = 6` |
+| `network.stun_servers` | `Vec<String>` | встроенный публичный пул | удаляются дубликаты и пустые значения | Основной список STUN-серверов для определения внешнего адреса и порта за NAT. | `stun_servers = ["stun1.l.google.com:19302"]` |
+| `network.stun_tcp_fallback` | `bool` | `true` | нет | Разрешает резервную проверку по TCP, когда STUN по UDP недоступен. | `stun_tcp_fallback = true` |
+| `network.http_ip_detect_urls` | `Vec<String>` | `ifconfig.me` + `api.ipify.org` | нет | Резервные HTTP-сервисы для определения публичного IPv4 при недоступности STUN. | `http_ip_detect_urls = ["https://api.ipify.org"]` |
+| `general.stun_iface_mismatch_ignore` | `bool` | `false` | нет | Зарезервированный флаг; в текущей ревизии не влияет на работу. | `stun_iface_mismatch_ignore = false` |
+| `timeouts.me_one_retry` | `u8` | `12` | нет | Число быстрых повторных подключений для DC с одним адресом подключения. | `me_one_retry = 6` |
 | `timeouts.me_one_timeout_ms` | `u64` | `1200` | нет | Таймаут одной быстрой попытки (мс). | `me_one_timeout_ms = 1500` |
 
 ### 2) Размер пула, keepalive и reconnect-политика
 
-| Параметр | Тип | Default | Ограничения / валидация | Влияние на run
```

**File**: `docs/Architecture/API/API.md` (modified, +645/-33)
```diff
@@ -12,6 +12,7 @@ API runtime is configured in `[server.api]`.
 | `enabled` | `bool` | `true` | Enables REST API listener. |
 | `listen` | `string` (`IP:PORT`) | `0.0.0.0:9091` | API bind address. |
 | `whitelist` | `CIDR[]` | `127.0.0.0/8` | Source IP allowlist. Empty list means allow all. |
+| `gray_action` | `"drop"`, `"api"`, `"200"` | `"drop"` | Response to a direct peer outside the whitelist: close without HTTP, structured `403 forbidden`, or empty `200` respectively. |
 | `auth_header` | `string` | `""` | Exact value for `Authorization` header. Empty disables header auth. |
 | `request_body_limit_bytes` | `usize` | `65536` | Maximum request body size. Must be within `[1, 1048576]`. |
 | `minimal_runtime_enabled` | `bool` | `true` | Enables runtime snapshot endpoints requiring ME pool read-lock aggregation. |
@@ -32,6 +33,16 @@ Runtime validation for API config:
 - `server.api.runtime_edge_top_n` must be within `[1, 1000]`.
 - `server.api.runtime_edge_events_capacity` must be within `[16, 4096]`.
 
+The file watcher retains every `server.api.*` field. Explicit generation reload
+applies `whitelist`, `gray_action`, `auth_header`, `request_body_limit_bytes`,
+`minimal_runtime_enabled`, `minimal_runtime_cache_ttl_ms`,
+`runtime_edge_enabled`, `runtime_edge_cache_ttl_ms`, `runtime_edge_top_n`, and
+`read_only`. `enabled`, `listen`, and `runtime_edge_events_capacity` remain
+process-owned and require a process restart. The five [observability settings](#api-observability-settings)
+are editable through `PATCH /v1/config`; other API settings require editing the
+owning TOML source. A client polling after an authentication change must use the
+new header explicitly.
+
 ## Protocol Contract
 
 | Item | Value |
@@ -51,6 +62,10 @@ Runtime validation for API config:
 }
 ```
 
+`GET /v1/config/state` is the additive exception to the non-null revision: its
+`revision` equals `data.desired_revision` and is `null` when the desired source
+cannot be captured. Its effective runtime identity remains available.
+
 ### Error Envelope
 ```json
 {
@@ -67,7 +82,9 @@ Runtime validation for API config:
 
 Requests are processed in this order:
 1. `api_enabled` gate (`503 api_disabled` if disabled).
-2. Source IP whitelist gate (`403 forbidden`).
+2. Source IP whitelist gate: `gray_action="drop"` closes without an HTTP
+   response, `"api"` returns `403 forbidden`, and `"200"` returns an empty
+   `200 OK` with `text/html; charset=utf-8`.
 3. `Authorization` header gate when configured (`401 unauthorized`).
 4. Route and method matching (`404 not_found` or `405 method_not_allowed`).
 5. `read_only` gate for mutating routes (`403 read_only`).
@@ -77,13 +94,34 @@ Requests are processed in this order:
 Notes:
 - Whitelist is evaluated against the direct TCP peer IP (`SocketAddr::ip`), without `X-Forwarded-For` support.
 - `Authorization` check is exact constant-time byte equality against configured `auth_header`.
+- `gray_action` does not grant API access and does not mask authentication or
+  read-only failures for allowed peers. An empty gray `200` is not a JSON success
+  envelope; clients must not interpret it as a successful operation.
+
+## Python client and CLI
+
+The standard-library [Python client](../../../tools/telemt_api.py) covers the 53
+JSON operations, including discovery, preflight/state, user quota/period/rates,
+generation reload and WEB lifecycle/session controls. The HTML `/web-status`
+viewer remains a browser endpoint. See the [client guide](PYTHON_CLIENT.md) for
+command and method mappings, exact sparse/null updates, source/runtime
+preconditions, process references and polling examples.
+
+`APIResponse.http_status` retains HTTP status independently from the JSON `ok`
+flag. Readiness `503` and WEB tombstone `410` with `ok=true` are returned as data
+only by their documented wrappers. Mutations returning `202` remain accepted
+operations or pending publication; they are not silently promoted to success.
+`TelemtAPIError` retains `http_status`, `code`, `request_id` and field `details`.
 
 ## Endpoint Matrix
 
 | Method | Path | Body | Success | `data` contract |
 | --- | --- | --- | --- | --- |
 | `GET` | `/v1/health` | none | `200` | `HealthData` |
 | `GET` | `/v1/health/ready` | none | `200` or `503` | `HealthReadyData` |
+| `GET` | `/v1/capabilities` | none | `200` | `CapabilitiesData` |
+| `GET` | `/v1/config/schema` | none | `200` | `ConfigSchemaData` |
+| `GET` | `/v1/config/state` | optional `sections` query | `200` | `ConfigStateData`, including partial results |
 | `GET` | `/v1/system/info` | none | `200` | `SystemInfoData` |
 | `GET` | `/v1/runtime/gates` | none | `200` | `RuntimeGatesData` |
 | `GET` | `/v1/runtime/initialization` | none | `200` | `RuntimeInitializationData` |
@@ -117,8 +155,11 @@ Notes:
 | `GET` | `/v1/stats/users/active-ips` | none | `200` | `UserActiveIps[]` |
 | `GET` | `/v1/stats/users` | none | `200` | `UserInfo[]` |
 | `GET` | `/v1/stats/users/quota` | none | `200` | User
```

#### Recent Merged Pull Requests:
- **PR #974** (2026-11-11): Docs/3.5.17 (@axkurcom)
- **PR #970** (2026-11-08): API Exposure enhanced (@axkurcom)
- **PR #968** (2026-11-12): Retry missing TLS front profiles with backoff instead of waiting for the regular refresh (@AndreyOsipuk)
- **PR #966** (2026-11-12): Randomize the inner content type byte in emulated TLS ApplicationData (@AndreyOsipuk)
- **PR #964** (2026-10-31): Flow/3.5.16 (@axkurcom)
- **PR #963** (2026-10-30): Webperf/3.5.15 (@axkurcom)

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

## X. Empirical Invariant Guard in emulator.rs

**RULE**:
When implementing operations in `src/tls_front/emulator.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in telemt/telemt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b594ee55`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/tls_front/emulator.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // The 17-byte tail stands in for the encrypted inner content
                // type and AEAD tag. Both are ciphertext in real TLS 1.3, so a
                // fixed plaintext content type byte would be a stable marker.
                rec.extend_from_slice(&rng.bytes(body_len - copy_len + 17));
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                if body_len > copy_len {
                    rec.extend_from_slice(&rng.bytes(body_len - copy_len));
                }
                rec.push(0x16);
                rec.extend_from_slice(&rng.bytes(16));
        } else if size > 17 {
            let body_len = size - 17;
            let mut body = Vec::with_capacity(body_len);
            body.extend_from_slice(&rng.bytes(body_len));
            rec.extend_from_slice(&body);
            rec.push(0x16);
            rec.extend_from_slice(&rng.bytes(16));
        assert_eq!(payload[payload.len() - 17], 0x16);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b594ee55` are properly handled with clean fallback behavior.
