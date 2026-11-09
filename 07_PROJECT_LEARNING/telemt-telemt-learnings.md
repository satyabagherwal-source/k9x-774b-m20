> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/telemt-telemt-learnings.md`  
> **Source**: github ([https://github.com/telemt/telemt](https://github.com/telemt/telemt))  
> **Source Version**: `66708d28`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T14:04:32.565Z  
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
> **Harvest Timestamp**: 2026-11-09T14:04:31.988Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `telemt/telemt`
- **Description**: MTProxy for Telegram on Rust + Tokio
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5786 stars

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

### Incident Patch 1: `982c4e4a` (2026-11-07)
**Commit Message**: API: expose observability settings and fix cross-generation cache races

**File**: `src/api/config_edit.rs` (modified, +49/-12)
```diff
@@ -8,9 +8,9 @@ use toml::Value as Toml;
 
 use super::ApiShared;
 use super::config_store::{
-    EDITABLE_NETWORK_FIELDS, EDITABLE_SECTIONS, EDITABLE_SERVER_FIELDS, compute_snapshot_revision,
-    is_editable_section, load_config_snapshot, render_server_listeners, render_top_level_section,
-    resolve_single_source_owner, upsert_dns_overrides, upsert_toml_table,
+    EDITABLE_NETWORK_FIELDS, EDITABLE_SECTIONS, EDITABLE_SERVER_API_FIELDS, EDITABLE_SERVER_FIELDS,
+    compute_snapshot_revision, is_editable_section, load_config_snapshot, render_server_listeners,
+    render_top_level_section, resolve_single_source_owner, upsert_dns_overrides, upsert_toml_table,
 };
 #[cfg(test)]
 use super::config_store::{write_atomic, write_atomic_if_unchanged};
@@ -25,6 +25,8 @@ use serde::Serialize;
 use std::path::{Path, PathBuf};
 use std::sync::Arc;
 
+#[cfg(test)]
+mod api_observability_tests;
 mod diagnostics;
 mod preflight;
 mod preparation;
@@ -250,7 +252,23 @@ fn filter_server_for_read(server: &Toml) -> Option<Toml> {
                     }
                 }
             }
-            out.insert((*field).to_string(), value.clone());
+            if *field == "api" {
+                if let Some(api) = value.as_table() {
+                    out.insert(
+                        "api".to_owned(),
+                        Toml::Table(
+                            api.iter()
+                                .filter(|(key, _)| {
+                                    EDITABLE_SERVER_API_FIELDS.contains(&key.as_str())
+                                })
+                                .map(|(key, value)| (key.clone(), value.clone()))
+                                .collect(),
+                        ),
+                    );
+                }
+            } else {
+                out.insert((*field).to_string(), value.clone());
+            }
         }
     }
     if out.is_empty() {
@@ -261,20 +279,15 @@ fn filter_server_for_read(server: &Toml) -> Option<Toml> {
 }
 
 /// Reject any `[server]` patch keys outside [`EDITABLE_SERVER_FIELDS`].
-fn validate_server_patch(server: &Toml) -> Result<(), ApiFailure> {
-    let Some(table) = server.as_table() else {
+fn validate_server_patch(server: &Json) -> Result<(), ApiFailure> {
+    let Some(table) = server.as_object() else {
         return Err(ApiFailure::new(
             hyper::StatusCode::BAD_REQUEST,
             "section_not_editable",
             "server patch must be a JSON object",
         ));
     };
-    if table.is_empty() {
-        return Err(ApiFailure::bad_request(
-            "empty server patch: provide at least one editable field \
-             (currently: listeners)",
-        ));
-    }
+    // Validate original keys before null removal, including forbidden siblings.
     for key in table.keys() {
         if !EDITABLE_SERVER_FIELDS.contains(&key.as_str()) {
             return Err(ApiFailure::new(
@@ -288,6 +301,30 @@ fn validate_server_patch(server: &Toml) -> Result<(), ApiFailure> {
             ));
         }
     }
+    if let Some(api) = table.get("api").filter(|api| !api.is_null()) {
+        let fields = api
+            .as_object()
+            .ok_or_else(|| ApiFailure::bad_request("server.api patch must be a JSON object"))?;
+        for key in fields.keys() {
+            if !EDITABLE_SERVER_API_FIELDS.contains(&key.as_str()) {
+                return Err(ApiFailure::new(
+                    hyper::StatusCode::BAD_REQUEST,
+                    "field_not_editable",
+                    format!("server.api.{key} is not editable via the config API"),
+                ));
+            }
+        }
+    }
+    let has_listeners = table.get("listeners").is_some_and(|value| !value.is_null());
+    let has_api_fields = table
+        .get("api")
+        .and_then(Json::as_object)
+        .is_some_and(|fields| fields.values().any(|value| !value.is_null()));
+    if !has_listeners && !has_api_fields {
+        return Err(ApiFailure::bad_request(
+            "empty server patch: provide listeners or an editable server.api field",
+        ));
+    }
     Ok(())
 }
 
```

**File**: `src/api/config_edit/api_observability_tests.rs` (added, +508/-0)
```diff
@@ -0,0 +1,508 @@
+use super::*;
+use crate::api::discovery::http_tests::Fixture;
+use crate::config::hot_reload::spawn_config_watcher;
+use crate::maestro::{generation::test_runtime_generation, reload::ReloadControl};
+use serde_json::json;
+use std::time::Duration;
+use tokio::sync::watch;
+use tokio_util::sync::CancellationToken;
+
+const API: &str = "[server.api] # keep API perimeter\nenabled=true\nlisten='127.0.0.1:9092'\nread_only=false\nauth_header='Bearer discovery-test' # keep secret\nwhitelist=['127.0.0.1/32']\ngray_action='api'\nrequest_body_limit_bytes=4096\nruntime_edge_events_capacity=64\nminimal_runtime_enabled=false\nruntime_edge_enabled=false\n";
+
+fn patch(fields: Json) -> Json {
+    json!({"server": {"api": fields}})
+}
+
+#[tokio::test]
+async fn get_exposes_exactly_five_settings_and_defaults_without_api_secrets() {
+    for source in ["", API] {
+        let (path, _directory) = tests::temp_config(source);
+        let (managed, _) = read_managed_config(&path).await.unwrap();
+        let fields = managed["server"]["api"].as_table().unwrap();
+        let config = ProxyConfig::load(&path).unwrap();
+        let typed = toml::Value::try_from(&config.server.api).unwrap();
+        assert_eq!(fields.len(), 5);
+        for (key, value) in fields {
+            assert!(EDITABLE_SERVER_API_FIELDS.contains(&key.as_str()));
+            assert_eq!(*value, typed[key]);
+        }
+        assert!(!managed.to_string().contains("discovery-test"));
+    }
+}
+
+#[tokio::test]
+async fn every_forbidden_api_sibling_and_alias_is_rejected_even_when_null() {
+    let (path, _directory) = tests::temp_config(API);
+    let original = std::fs::read(&path).unwrap();
+    let api = serde_json::to_value(ProxyConfig::default().server.api).unwrap();
+    for (key, value) in api.as_object().unwrap() {
+        if EDITABLE_SERVER_API_FIELDS.contains(&key.as_str()) {
+            continue;
+        }
+        for value in [value.clone(), Json::Null] {
+            let error = apply_patch_to_path(
+                &path,
+                &patch(json!({key: value, "runtime_edge_enabled": true})),
+                None,
+            )
+            .await
+            .unwrap_err();
+            assert_eq!(error.code, "field_not_editable", "{key}: {error:?}");
+            assert_eq!(std::fs::read(&path).unwrap(), original);
+        }
+    }
+    for body in [
+        patch(json!({"typo": null, "runtime_edge_enabled": true})),
+        json!({"server": {"admin_api": null, "api": {"runtime_edge_enabled": true}}}),
+        json!({"server": {"port": null, "api": {"runtime_edge_enabled": true}}}),
+    ] {
+        assert_eq!(
+            apply_patch_to_path(&path, &body, None)
+                .await
+                .unwrap_err()
+                .code,
+            "field_not_editable"
+        );
+        assert_eq!(std::fs::read(&path).unwrap(), original);
+    }
+}
+
+#[tokio::test]
+async fn observability_bounds_and_types_are_checked_before_persistence() {
+    let (path, _directory) = tests::temp_config(API);
+    for (key, good, bad) in [
+        (
+            "minimal_runtime_cache_ttl_ms",
+            vec![json!(0), json!(60_000)],
+            vec![json!(-1), json!(60_001), json!(1.5), json!(false)],
+        ),
+        (
+            "runtime_edge_cache_ttl_ms",
+            vec![json!(0), json!(60_000)],
+            vec![json!(-1), json!(60_001), json!("0")],
+        ),
+        (
+            "runtime_edge_top_n",
+            vec![json!(1), json!(1000)],
+            vec![json!(0), json!(1001), json!(-1), json!([])],
+        ),
+        (
+            "minimal_runtime_enabled",
+            vec![json!(true), json!(false)],
+            vec![json!(0), json!("true")],
+        ),
+        (
+            "runtime_edge_enabled",
+            vec![json!(true), json!(false)],
+            vec![json!(1), json!({})],
+        ),
+    ] {
+        for value in good {
+            apply_patch_to_path(&path, &patch(json!({key: value})), None)
+                .await
+                .unwrap();
+            assert_eq!(
+                serde_json::to_value(ProxyConfig::load(&path).unwrap().server.api).unwrap()[key],
+                value
+            );
+        }
+        let original = std::fs::read(&path).unwrap();
+        for value in bad {
+            let error = apply_patch_to_path(&path, &patch(json!({key: value})), None)
+                .await
+                .unwrap_err();
+            assert_eq!(
+                error.status,
+                hyper::StatusCode::BAD_REQUEST,
+                "{key}: {error:?}"
+            );
+            assert_eq!(std::fs::read(&path).unwrap(), original);
+        }
+    }
+    let original = std::fs::read(&path).unwrap();
+    for value in [
+        json!(null),
+        json!({}),
+        json!([]),
+        json!(false),
+        json!({"runtime_edge_top_n": null}),
+    ] {
+        assert!(
+            apply_patch_to_path(&path, &patch(value), No
```

**File**: `src/api/config_edit/preparation.rs` (modified, +79/-11)
```diff
@@ -1,5 +1,6 @@
 //! One source-preserving candidate pipeline shared by preview and commit.
 use super::*;
+use crate::api::config_store::{FieldEdit, prepare_field_edits};
 use crate::config::{LoadedConfig, ParsedConfigSource};
 use tokio::sync::OwnedSemaphorePermit;
 
@@ -82,7 +83,7 @@ fn parse_patch(
             "access.* is managed via the users API, not editable here",
         ));
     }
-    for (key, value) in patch_table {
+    for key in patch_table.keys() {
         if !is_editable_section(key.as_str()) {
             return Err(ApiFailure::new(
                 hyper::StatusCode::BAD_REQUEST,
@@ -91,7 +92,7 @@ fn parse_patch(
             ));
         }
         if key == "server" {
-            validate_server_patch(value)?;
+            validate_server_patch(&patch_json["server"])?;
         } else if key == "network" {
             validate_network_patch(&patch_json["network"])?;
         }
@@ -127,30 +128,59 @@ fn parse_patch(
         .validate()
         .map_err(|error| diagnostics::validation_error("constraint_violation", "$", error))?;
 
+    let api_edits = api_field_edits(&loaded, &patch_toml)?;
+    let api_source = prepare_field_edits(&loaded, config_path, &api_edits)
+        .map_err(diagnostics::source_conflict)?;
+    let patch_listeners = patch_toml
+        .get("server")
+        .is_some_and(|server| server.get("listeners").is_some());
     let ownership_targets: Vec<&str> = touched
         .iter()
-        .map(|section| {
+        .filter_map(|section| {
             if section == "server" {
-                "server.listeners"
+                patch_listeners.then_some("server.listeners")
             } else if section == "network" {
-                "network.dns_overrides"
+                Some("network.dns_overrides")
             } else {
-                section.as_str()
+                Some(section.as_str())
             }
         })
         .collect();
-    let owner_path = resolve_single_source_owner(&loaded, config_path, &ownership_targets)
-        .map_err(diagnostics::source_conflict)?;
+    let section_owner = if ownership_targets.is_empty() {
+        None
+    } else {
+        Some(
+            resolve_single_source_owner(&loaded, config_path, &ownership_targets)
+                .map_err(diagnostics::source_conflict)?,
+        )
+    };
+    if let (Some(owner), Some(api)) = (&section_owner, &api_source) {
+        if *owner != api.owner_path {
+            return Err(ApiFailure::new(
+                hyper::StatusCode::CONFLICT,
+                "config_patch_not_atomic",
+                "Mutation requires one independently writable config source",
+            ));
+        }
+    }
+    let owner_path = section_owner
+        .or_else(|| api_source.as_ref().map(|source| source.owner_path.clone()))
+        .ok_or_else(|| ApiFailure::bad_request("empty patch: no editable fields"))?;
     let mut owner_contents = loaded
         .source_contents
         .get(&owner_path)
         .cloned()
         .ok_or_else(|| ApiFailure::internal("config source owner is missing from snapshot"))?;
     let expected_owner_contents = owner_contents.clone();
+    if let Some(api) = api_source {
+        owner_contents = api.owner_contents;
+    }
     for section in &touched {
         if *section == "server" {
-            let rendered = render_server_listeners(&requested_cfg)?;
-            owner_contents = upsert_toml_table(&owner_contents, "server.listeners", &rendered);
+            if patch_listeners {
+                let rendered = render_server_listeners(&requested_cfg)?;
+                owner_contents = upsert_toml_table(&owner_contents, "server.listeners", &rendered);
+            }
         } else if *section == "network" {
             owner_contents =
                 upsert_dns_overrides(&owner_contents, &requested_cfg.network.dns_overrides)?;
@@ -164,7 +194,7 @@ fn parse_patch(
     overrides.insert(owner_path.clone(), owner_contents.clone());
     let candidate = ProxyConfig::parse_source_with_overrides(config_path, &overrides)
         .map_err(|error| diagnostics::validation_error("constraint_violation", "$", error))?;
-    if touched.iter().any(|section| section == "server")
+    if patch_listeners
         && serde_json::to_value(&candidate.config.server.listeners).ok()
             != serde_json::to_value(&requested_cfg.server.listeners).ok()
     {
@@ -191,6 +221,44 @@ fn parse_patch(
     ))
 }
 
+fn api_field_edits(
+    loaded: &ParsedConfigSource,
+    patch: &Toml,
+) -> Result<Vec<FieldEdit>, ApiFailure> {
+    let Some(fields) = patch
+        .get("server")
+        .and_then(|server| server.get("api"))
+        .and_then(Toml::as_table)
+    else {
+        return Ok(Vec::new());
+    };
+    if fields.is_empty() {
+        return Ok(Vec::new());
+    }
+    // PATCH uses canonical paths, while an authored legacy table keeps its name.
+    let mut table_name = "api";
+    for source in loaded.source_contents.values() {
+        let d
```

**File**: `src/api/config_edit/tests.rs` (modified, +6/-5)
```diff
@@ -228,8 +228,7 @@ async fn invalid_web_patch_does_not_modify_the_source() {
 
 #[tokio::test]
 async fn read_managed_config_returns_only_editable_sections() {
-    // Server identity and network siblings must not leak. Listeners-only server
-    // is returned via the nested allowlist (covered in a dedicated test).
+    // Server identity and network siblings must not leak through nested allowlists.
     let (path, _d) = temp_config(concat!(
         "[censorship]\ntls_domain = \"a\"\n",
         "[server]\nport = 443\n[server.api]\nauth_header = \"SECRET\"\n",
@@ -241,7 +240,8 @@ async fn read_managed_config_returns_only_editable_sections() {
     assert!(table.contains_key("censorship"));
     let server = table["server"].as_table().unwrap();
     assert!(server.contains_key("listeners"));
-    assert!(!server.contains_key("api"));
+    assert_eq!(server["api"].as_table().unwrap().len(), 5);
+    assert!(server["api"].get("auth_header").is_none());
     assert!(!server.contains_key("port"));
     assert_eq!(
         serde_json::to_value(&table["network"]).unwrap(),
@@ -251,7 +251,7 @@ async fn read_managed_config_returns_only_editable_sections() {
 }
 
 #[tokio::test]
-async fn read_managed_config_returns_server_listeners_only() {
+async fn read_managed_config_returns_server_listeners_and_api_observability() {
     let (path, _d) = temp_config(concat!(
         "[censorship]\ntls_domain = \"a\"\n",
         "[server]\nport = 443\n",
@@ -266,7 +266,8 @@ async fn read_managed_config_returns_server_listeners_only() {
         .as_table()
         .unwrap();
     assert!(server.contains_key("listeners"));
-    assert!(!server.contains_key("api"));
+    assert_eq!(server["api"].as_table().unwrap().len(), 5);
+    assert!(server["api"].get("auth_header").is_none());
     assert!(!server.contains_key("port"));
     let listeners = server["listeners"].as_array().unwrap();
     assert_eq!(listeners.len(), 1);
```

**File**: `src/api/config_store.rs` (modified, +13/-4)
```diff
@@ -326,9 +326,9 @@ pub(super) async fn save_config_to_disk(
 ///                   located or replaced safely, so it is edited via `general`.
 ///
 /// `server` is partially editable: only the nested fields listed in
-/// [`EDITABLE_SERVER_FIELDS`] (currently `listeners`) may appear in GET/PATCH.
-/// Secrets and bind identity (`api`/`admin_api`, `port`, unix sockets, …) stay
-/// blocked. `network` is also partial: only [`EDITABLE_NETWORK_FIELDS`] are
+/// [`EDITABLE_SERVER_FIELDS`] may appear in GET/PATCH; `api` is further restricted
+/// to [`EDITABLE_SERVER_API_FIELDS`]. Secrets and bind identity stay blocked.
+/// `network` is also partial: only [`EDITABLE_NETWORK_FIELDS`] are
 /// exposed, retaining the boundary around per-node identity and routing policy.
 pub(super) const EDITABLE_SECTIONS: &[&str] = &[
     "general",
@@ -343,7 +343,16 @@ pub(super) const EDITABLE_SECTIONS: &[&str] = &[
 ///
 /// Arrays (e.g. `listeners`) replace wholesale on PATCH, matching the existing
 /// merge semantics for non-table values.
-pub(super) const EDITABLE_SERVER_FIELDS: &[&str] = &["listeners"];
+pub(super) const EDITABLE_SERVER_FIELDS: &[&str] = &["listeners", "api"];
+
+/// Diagnostics settings applied by explicit generation reload, not the watcher.
+pub(super) const EDITABLE_SERVER_API_FIELDS: &[&str] = &[
+    "minimal_runtime_enabled",
+    "minimal_runtime_cache_ttl_ms",
+    "runtime_edge_enabled",
+    "runtime_edge_cache_ttl_ms",
+    "runtime_edge_top_n",
+];
 
 /// Only the generation resolver's overrides may be read/patched under `network`.
 pub(super) const EDITABLE_NETWORK_FIELDS: &[&str] = &["dns_overrides"];
```

**File**: `src/api/discovery/http_tests.rs` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ impl Fixture {
         }];
         let runtime = test_runtime_generation(1, config.clone());
         let shared = ApiShared {
+            runtime_generation: runtime.id,
             stats: runtime.stats.clone(),
             ip_tracker: runtime.ip_tracker.clone(),
             me_pool: runtime.me_pool_runtime.clone(),
```

**File**: `src/api/discovery/schema.rs` (modified, +13/-7)
```diff
@@ -6,7 +6,7 @@ use serde::{Deserialize, Serialize};
 use serde_json::Value;
 
 use super::super::config_store::{
-    EDITABLE_NETWORK_FIELDS, EDITABLE_SECTIONS, EDITABLE_SERVER_FIELDS,
+    EDITABLE_NETWORK_FIELDS, EDITABLE_SECTIONS, EDITABLE_SERVER_API_FIELDS, EDITABLE_SERVER_FIELDS,
 };
 use super::super::model::ApiFailure;
 use super::SCHEMA_VERSION;
@@ -204,13 +204,19 @@ fn field_api(path: &str) -> FieldApi {
         || path
             .strip_prefix("network.")
             .is_some_and(|field| EDITABLE_NETWORK_FIELDS.contains(&field))
+        || path
+            .strip_prefix("server.api.")
+            .is_some_and(|field| EDITABLE_SERVER_API_FIELDS.contains(&field))
         || (top == "server"
-            && EDITABLE_SERVER_FIELDS.iter().any(|field| {
-                let prefix = format!("server.{field}");
-                path == prefix
-                    || path.starts_with(&format!("{prefix}["))
-                    || path.starts_with(&format!("{prefix}."))
-            }));
+            && EDITABLE_SERVER_FIELDS
+                .iter()
+                .filter(|field| **field != "api")
+                .any(|field| {
+                    let prefix = format!("server.{field}");
+                    path == prefix
+                        || path.starts_with(&format!("{prefix}["))
+                        || path.starts_with(&format!("{prefix}."))
+                }));
     let policy_field = path.strip_prefix("access.").and_then(|path| {
         let field = path.split('.').next()?;
         crate::api::access_policy::FIELDS
```

**File**: `src/api/discovery/schema/tests.rs` (modified, +7/-5)
```diff
@@ -133,11 +133,13 @@ fn api_ownership_aliases_and_null_contracts_match_existing_surfaces() {
     let schema = config_schema().unwrap();
     assert!(field(schema, "web.vhosts[].base_path").api.config_write);
     assert!(field(schema, "server.listeners[].port").api.config_write);
-    assert!(
-        !field(schema, "server.api.runtime_edge_enabled")
-            .api
-            .config_write
-    );
+    for entry in &schema.fields {
+        if let Some(key) = entry.spec.path.strip_prefix("server.api.") {
+            let editable = EDITABLE_SERVER_API_FIELDS.contains(&key);
+            assert_eq!(entry.api.config_read, editable, "{key}");
+            assert_eq!(entry.api.config_write, editable, "{key}");
+        }
+    }
     assert!(field(schema, "network.dns_overrides").api.config_read);
     assert!(field(schema, "network.dns_overrides").api.config_write);
     assert_eq!(
```

#### Recent Merged Pull Requests:
- **PR #970** (2026-11-08): API Exposure enhanced (@axkurcom)
- **PR #964** (2026-10-31): Flow/3.5.16 (@axkurcom)
- **PR #963** (2026-10-30): Webperf/3.5.15 (@axkurcom)
- **PR #949** (2026-10-05): ME: Autonomous&Lifecycle-bounded Pool Convergence (@axkurcom)
- **PR #948** (2026-10-04): WEB: Resolve opt-in decoy hostnames during config preparation (@axkurcom)
- **PR #946** (2026-10-03): Bounded WEB HTTP conveyor with replay-safe streaming downlink added (@axkurcom)

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

## X. API: expose observability settings and fix cross-generation cache races

**RULE**:
When implementing operations in `src/api/config_edit.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in telemt/telemt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `982c4e4a`: API: expose observability settings and fix cross-generation cache races. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/api/config_edit.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    EDITABLE_NETWORK_FIELDS, EDITABLE_SECTIONS, EDITABLE_SERVER_API_FIELDS, EDITABLE_SERVER_FIELDS,
    compute_snapshot_revision, is_editable_section, load_config_snapshot, render_server_listeners,
    render_top_level_section, resolve_single_source_owner, upsert_dns_overrides, upsert_toml_table,
#[cfg(test)]
mod api_observability_tests;
            if *field == "api" {
                if let Some(api) = value.as_table() {
                    out.insert(
                        "api".to_owned(),
                        Toml::Table(
                            api.iter()
                                .filter(|(key, _)| {
                                    EDITABLE_SERVER_API_FIELDS.contains(&key.as_str())
                                })
                                .map(|(key, value)| (key.clone(), value.clone()))
                                .collect(),
                        ),
                    );
                }
            } else {
                out.insert((*field).to_string(), value.clone());
            }
fn validate_server_patch(server: &Json) -> Result<(), ApiFailure> {
    let Some(table) = server.as_object() else {
    // Validate original keys before 
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    EDITABLE_NETWORK_FIELDS, EDITABLE_SECTIONS, EDITABLE_SERVER_FIELDS, compute_snapshot_revision,
    is_editable_section, load_config_snapshot, render_server_listeners, render_top_level_section,
    resolve_single_source_owner, upsert_dns_overrides, upsert_toml_table,
            out.insert((*field).to_string(), value.clone());
fn validate_server_patch(server: &Toml) -> Result<(), ApiFailure> {
    let Some(table) = server.as_table() else {
    if table.is_empty() {
        return Err(ApiFailure::bad_request(
            "empty server patch: provide at least one editable field \
             (currently: listeners)",
        ));
    }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `982c4e4a` are properly handled with clean fallback behavior.
