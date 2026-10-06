# Forensic Learning Record (Deep Inspection): telemt/telemt

> **Canonical Artifact**: `07_PROJECT_LEARNING/telemt-telemt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/telemt/telemt](https://github.com/telemt/telemt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:21:49.714Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `telemt/telemt`
- **Description**: MTProxy for Telegram on Rust + Tokio
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5719 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
        .remove_user(&configured_users, user)
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

### Core Architecture Module: `src/metrics/render/me_lifecycle.rs`
```
use super::*;
use std::fmt::Write;

pub(super) fn render(out: &mut String, stats: &Stats, me_allows_normal: bool) {
    let _ = writeln!(
        out,
        "# HELP telemt_me_reconnect_attempts_total ME reconnect attempts"
    );
    let _ = writeln!(out, "# TYPE telemt_me_reconnect_attempts_total counter");
    let _ = writeln!(
        out,
        "telemt_me_reconnect_attempts_total {}",
        if me_allows_normal {
            stats.get_me_reconnect_attempts()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_reconnect_success_total ME reconnect successes"
    );
    let _ = writeln!(out, "# TYPE telemt_me_reconnect_success_total counter");
    let _ = writeln!(
        out,
        "telemt_me_reconnect_success_total {}",
        if me_allows_normal {
            stats.get_me_reconnect_success()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_handshake_reject_total ME handshake rejects from upstream"
    );
    let _ = writeln!(out, "# TYPE telemt_me_handshake_reject_total counter");
    let _ = writeln!(
        out,
        "telemt_me_handshake_reject_total {}",
        if me_allows_normal {
            stats.get_me_handshake_reject_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_handshake_error_code_total ME handshake reject errors by code"
    );
    let _ = writeln!(out, "# TYPE telemt_me_handshake_error_code_total counter");
    if me_allows_normal {
        for (error_code, count) in stats.get_me_handshake_error_code_counts() {
            let _ = writeln!(
                out,
                "telemt_me_handshake_error_code_total{{error_code=\"{}\"}} {}",
                error_code, count
            );
        }
        let _ = writeln!(
            out,
            "telemt_me_handshake_error_code_total{{error_code=\"overflow\"}} {}",
            stats.get_me_handshake_error_code_overflow_total()
        );
    }

    let _ = writeln!(
        out,
        "# HELP telemt_me_reader_eof_total ME reader EOF terminations"
    );
    let _ = writeln!(out, "# TYPE telemt_me_reader_eof_total counter");
    let _ = writeln!(
        out,
        "telemt_me_reader_eof_total {}",
        if me_allows_normal {
            stats.get_me_reader_eof_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_idle_close_by_peer_total ME idle writers closed by peer"
    );
    let _ = writeln!(out, "# TYPE telemt_me_idle_close_by_peer_total counter");
    let _ = writeln!(
        out,
        "telemt_me_idle_close_by_peer_total {}",
        if me_allows_normal {
            stats.get_me_idle_close_by_peer_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_relay_idle_soft_mark_total Middle-relay sessions marked as soft-idle candidates"
    );
    let _ = writeln!(out, "# TYPE telemt_relay_idle_soft_mark_total counter");
    let _ = writeln!(
        out,
        "telemt_relay_idle_soft_mark_total {}",
        if me_allows_normal {
            stats.get_relay_idle_soft_mark_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_relay_idle_hard_close_total Middle-relay sessions closed by hard-idle policy"
    );
    let _ = writeln!(out, "# TYPE telemt_relay_idle_hard_close_total counter");
    let _ = writeln!(
        out,
        "telemt_relay_idle_hard_close_total {}",
        if me_allows_normal {
            stats.get_relay_idle_hard_close_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_relay_pressure_evict_total Middle-relay sessions evicted under resource pressure"
    );
    let _ = writeln!(out, "# TYPE telemt_relay_pressure_evict_total counter");
    let _ = writeln!(
        out,
        "telemt_relay_pressure_evict_total {}",
        if me_allows_normal {
            stats.get_relay_pressure_evict_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_relay_protocol_desync_close_total Middle-relay sessions closed due to protocol desync"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_relay_protocol_desync_close_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_relay_protocol_desync_close_total {}",
        if me_allows_normal {
            stats.get_relay_protocol_desync_close_total()
        } else {
            0
        }
    );

    let _ = writeln!(out, "# HELP telemt_me_crc_mismatch_total ME CRC mismatches");
    let _ = writeln!(out, "# TYPE telemt_me_crc_mismatch_total counter");
    let _ = writeln!(
        out,
        "telemt_me_crc_mismatch_total {}",
        if me_allows_normal {
            stats.get_me_crc_mismatch()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_seq_mismatch_total ME sequence mismatches"
    );
    let _ = writeln!(out, "# TYPE telemt_me_seq_mismatch_total counter");
    let _ = writeln!(
        out,
        "telemt_me_seq_mismatch_total {}",
        if me_allows_normal {
            stats.get_me_seq_mismatch()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_route_drop_no_conn_total ME route drops: no conn"
    );
    let _ = writeln!(out, "# TYPE telemt_me_route_drop_no_conn_total counter");
    let _ = writeln!(
        out,
        "telemt_me_route_drop_no_conn_total {}",
        if me_allows_normal {
            stats.get_me_route_drop_no_conn()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_route_drop_channel_closed_total ME route drops: channel closed"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_route_drop_channel_closed_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_route_drop_channel_closed_total {}",
        if me_allows_normal {
            stats.get_me_route_drop_channel_closed()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_route_drop_queue_full_total ME route drops: queue full"
    );
    let _ = writeln!(out, "# TYPE telemt_me_route_drop_queue_full_total counter");
    let _ = writeln!(
        out,
        "telemt_me_route_drop_queue_full_total {}",
        if me_allows_normal {
            stats.get_me_route_drop_queue_full()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_route_drop_queue_full_profile_total ME route drops: queue full by adaptive profile"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_route_drop_queue_full_profile_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_route_drop_queue_full_profile_total{{profile=\"base\"}} {}",
        if me_allows_normal {
            stats.get_me_route_drop_queue_full_base()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_route_drop_queue_full_profile_total{{profile=\"high\"}} {}",
        if me_allows_normal {
            stats.get_me_route_drop_queue_full_high()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_fair_pressure_state Worker-local fairness pressure state"
    );
    let _ = writeln!(out, "# TYPE telemt_me_fair_pressure_state gauge");
    let _ = writeln!(
        out,
        "telemt_me_fair_pressure_state {}",
        if me_allows_normal {
            stats.get_me_fair_pressure_state_gauge()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_fair_active_flows Fair-scheduler active flow count"
    );
    let _ = writeln!(out, "# TYPE telemt_me_fair_active_flows gauge");
    let _ = writeln!(
        out,
        "telemt_me_fair_active_flows {}",
        if me_allows_normal {
            stats.get_me_fair_active_flows_gauge()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_fair_queued_bytes Fair-scheduler queued bytes"
    );
    let _ = writeln!(out, "# TYPE telemt_me_fair_queued_bytes gauge");
    let _ = writeln!(
        out,
        "telemt_me_fair_queued_bytes {}",
        if me_allows_normal {
            stats.get_me_fair_queued_bytes_gauge()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_fair_flow_state_gauge Fair-scheduler flow health classes"
    );
    let _ = writeln!(out, "# TYPE telemt_me_fair_flow_state_gauge gauge");
    let _ = writeln!(
        out,
        "telemt_me_fair_flow_state_gauge{{class=\"standing\"}} {}",
        if me_allows_normal {
            stats.get_me_fair_standing_flows_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_fair_flow_state_gauge{{class=\"backpressured\"}} {}",
        if me_allows_normal {
            stats.get_me_fair_backpressured_flows_gauge()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_fair_events_total Fair-scheduler event counters"
    );
    let _ = writeln!(out, "# TYPE telemt_me_fair_events_total counter");
    let _ = writeln!(
        out,
        "telemt_me_fair_events_total{{event=\"scheduler_round\"}} {}",
        if me_allows_normal {
            stats.get_me_fair_scheduler_rounds_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_fair_events_total{{event=\"deficit_grant\"}} {}",
        if me_allows_normal {
            stats.get_me_fair_deficit_grants_total()
        } else {
            0
        }
    );
    le
```

### Core Architecture Module: `src/metrics/render/me_policy.rs`
```
use super::*;
use std::fmt::Write;

pub(super) fn render(
    out: &mut String,
    stats: &Stats,
    me_allows_normal: bool,
    me_allows_debug: bool,
) {
    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_byte_budget_reserved_bytes Aggregate ME writer memory reservations by lifecycle state"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_byte_budget_reserved_bytes gauge"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_byte_budget_reserved_bytes{{state=\"queued\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_byte_budget_queued_bytes_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_byte_budget_reserved_bytes{{state=\"inflight\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_byte_budget_inflight_bytes_gauge()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_byte_budget_events_total ME writer byte-budget outcomes"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_byte_budget_events_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_byte_budget_events_total{{result=\"wait\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_byte_budget_wait_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_byte_budget_events_total{{result=\"timeout\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_byte_budget_timeout_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_byte_budget_events_total{{result=\"oversize\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_byte_budget_oversize_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_pick_total ME writer-pick outcomes by mode and result"
    );
    let _ = writeln!(out, "# TYPE telemt_me_writer_pick_total counter");
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"sorted_rr\",result=\"success_try\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_sorted_rr_success_try_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"sorted_rr\",result=\"success_fallback\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_sorted_rr_success_fallback_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"sorted_rr\",result=\"full\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_sorted_rr_full_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"sorted_rr\",result=\"closed\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_sorted_rr_closed_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"sorted_rr\",result=\"no_candidate\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_sorted_rr_no_candidate_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"p2c\",result=\"success_try\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_p2c_success_try_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"p2c\",result=\"success_fallback\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_p2c_success_fallback_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"p2c\",result=\"full\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_p2c_full_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"p2c\",result=\"closed\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_p2c_closed_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_total{{mode=\"p2c\",result=\"no_candidate\"}} {}",
        if me_allows_normal {
            stats.get_me_writer_pick_p2c_no_candidate_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_pick_blocking_fallback_total ME writer-pick blocking fallback attempts"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_pick_blocking_fallback_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_blocking_fallback_total {}",
        if me_allows_normal {
            stats.get_me_writer_pick_blocking_fallback_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_pick_mode_switch_total Writer-pick mode switches via runtime updates"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_pick_mode_switch_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_pick_mode_switch_total {}",
        if me_allows_normal {
            stats.get_me_writer_pick_mode_switch_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_socks_kdf_policy_total SOCKS KDF policy outcomes"
    );
    let _ = writeln!(out, "# TYPE telemt_me_socks_kdf_policy_total counter");
    let _ = writeln!(
        out,
        "telemt_me_socks_kdf_policy_total{{policy=\"strict\",outcome=\"reject\"}} {}",
        if me_allows_normal {
            stats.get_me_socks_kdf_strict_reject()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_me_socks_kdf_policy_total{{policy=\"compat\",outcome=\"fallback\"}} {}",
        if me_allows_debug {
            stats.get_me_socks_kdf_compat_fallback()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_endpoint_quarantine_total ME endpoint quarantines due to rapid flaps"
    );
    let _ = writeln!(out, "# TYPE telemt_me_endpoint_quarantine_total counter");
    let _ = writeln!(
        out,
        "telemt_me_endpoint_quarantine_total {}",
        if me_allows_normal {
            stats.get_me_endpoint_quarantine_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_endpoint_quarantine_unexpected_total ME endpoint quarantines caused by unexpected writer removals"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_endpoint_quarantine_unexpected_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_endpoint_quarantine_unexpected_total {}",
        if me_allows_normal {
            stats.get_me_endpoint_quarantine_unexpected_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_endpoint_quarantine_draining_suppressed_total Draining writer removals that skipped endpoint quarantine"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_endpoint_quarantine_draining_suppressed_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_endpoint_quarantine_draining_suppressed_total {}",
        if me_allows_normal {
            stats.get_me_endpoint_quarantine_draining_suppressed_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_kdf_drift_total ME KDF input drift detections"
    );
    let _ = writeln!(out, "# TYPE telemt_me_kdf_drift_total counter");
    let _ = writeln!(
        out,
        "telemt_me_kdf_drift_total {}",
        if me_allows_normal {
            stats.get_me_kdf_drift_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_kdf_port_only_drift_total ME KDF client-port changes with stable non-port material"
    );
    let _ = writeln!(out, "# TYPE telemt_me_kdf_port_only_drift_total counter");
    let _ = writeln!(
        out,
        "telemt_me_kdf_port_only_drift_total {}",
        if me_allows_debug {
            stats.get_me_kdf_port_only_drift_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_reuse_total Hardswap cycles that reused an existing pending generation"
    );
    let _ = writeln!(out, "# TYPE telemt_me_hardswap_pending_reuse_total counter");
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_reuse_total {}",
        if me_allows_debug {
            stats.get_me_hardswap_pending_reuse_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_hardswap_pending_ttl_expired_total Pending hardswap generations reset by TTL expiration"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_hardswap_pending_ttl_expired_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_hardswap_pending_ttl_expired_total {}",
        if me_allows_normal {
            stats.get_me_hardswap_pending_ttl_expired_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_single_endpoint_outage_enter_total Single-endpoint DC outage transitions to active state"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_single_endpoint_outage_enter_total counter"
    );
    let _ = writeln!(

```

### Core Architecture Module: `src/metrics/render/me_recovery.rs`
```
use super::*;
use std::fmt::Write;

pub(super) fn render(
    out: &mut String,
    stats: &Stats,
    me_allows_normal: bool,
    me_allows_debug: bool,
) {
    let _ = writeln!(
        out,
        "# HELP telemt_secure_padding_invalid_total Invalid secure frame lengths"
    );
    let _ = writeln!(out, "# TYPE telemt_secure_padding_invalid_total counter");
    let _ = writeln!(
        out,
        "telemt_secure_padding_invalid_total {}",
        if me_allows_normal {
            stats.get_secure_padding_invalid()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_desync_total Total crypto-desync detections"
    );
    let _ = writeln!(out, "# TYPE telemt_desync_total counter");
    let _ = writeln!(
        out,
        "telemt_desync_total {}",
        if me_allows_normal {
            stats.get_desync_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_desync_full_logged_total Full forensic desync logs emitted"
    );
    let _ = writeln!(out, "# TYPE telemt_desync_full_logged_total counter");
    let _ = writeln!(
        out,
        "telemt_desync_full_logged_total {}",
        if me_allows_normal {
            stats.get_desync_full_logged()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_desync_suppressed_total Suppressed desync forensic events"
    );
    let _ = writeln!(out, "# TYPE telemt_desync_suppressed_total counter");
    let _ = writeln!(
        out,
        "telemt_desync_suppressed_total {}",
        if me_allows_normal {
            stats.get_desync_suppressed()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_desync_frames_bucket_total Desync count by frames_ok bucket"
    );
    let _ = writeln!(out, "# TYPE telemt_desync_frames_bucket_total counter");
    let _ = writeln!(
        out,
        "telemt_desync_frames_bucket_total{{bucket=\"0\"}} {}",
        if me_allows_normal {
            stats.get_desync_frames_bucket_0()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_desync_frames_bucket_total{{bucket=\"1_2\"}} {}",
        if me_allows_normal {
            stats.get_desync_frames_bucket_1_2()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_desync_frames_bucket_total{{bucket=\"3_10\"}} {}",
        if me_allows_normal {
            stats.get_desync_frames_bucket_3_10()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "telemt_desync_frames_bucket_total{{bucket=\"gt_10\"}} {}",
        if me_allows_normal {
            stats.get_desync_frames_bucket_gt_10()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_pool_swap_total Successful ME pool swaps"
    );
    let _ = writeln!(out, "# TYPE telemt_pool_swap_total counter");
    let _ = writeln!(
        out,
        "telemt_pool_swap_total {}",
        if me_allows_normal {
            stats.get_pool_swap_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_pool_drain_active Active draining ME writers"
    );
    let _ = writeln!(out, "# TYPE telemt_pool_drain_active gauge");
    let _ = writeln!(
        out,
        "telemt_pool_drain_active {}",
        if me_allows_debug {
            stats.get_pool_drain_active()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_pool_force_close_total Forced close events for draining writers"
    );
    let _ = writeln!(out, "# TYPE telemt_pool_force_close_total counter");
    let _ = writeln!(
        out,
        "telemt_pool_force_close_total {}",
        if me_allows_normal {
            stats.get_pool_force_close_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_pool_stale_pick_total Stale writer fallback picks for new binds"
    );
    let _ = writeln!(out, "# TYPE telemt_pool_stale_pick_total counter");
    let _ = writeln!(
        out,
        "telemt_pool_stale_pick_total {}",
        if me_allows_normal {
            stats.get_pool_stale_pick_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_removed_total Total ME writer removals"
    );
    let _ = writeln!(out, "# TYPE telemt_me_writer_removed_total counter");
    let _ = writeln!(
        out,
        "telemt_me_writer_removed_total {}",
        if me_allows_debug {
            stats.get_me_writer_removed_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_removed_unexpected_total Unexpected ME writer removals that triggered refill"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_removed_unexpected_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_removed_unexpected_total {}",
        if me_allows_normal {
            stats.get_me_writer_removed_unexpected_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_refill_triggered_total Immediate ME refill runs started"
    );
    let _ = writeln!(out, "# TYPE telemt_me_refill_triggered_total counter");
    let _ = writeln!(
        out,
        "telemt_me_refill_triggered_total {}",
        if me_allows_debug {
            stats.get_me_refill_triggered_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_refill_skipped_inflight_total Immediate ME refill skips due to inflight dedup"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_refill_skipped_inflight_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_refill_skipped_inflight_total {}",
        if me_allows_debug {
            stats.get_me_refill_skipped_inflight_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_refill_failed_total Immediate ME refill failures"
    );
    let _ = writeln!(out, "# TYPE telemt_me_refill_failed_total counter");
    let _ = writeln!(
        out,
        "telemt_me_refill_failed_total {}",
        if me_allows_normal {
            stats.get_me_refill_failed_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_restored_same_endpoint_total Refilled ME writer restored on the same endpoint"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_restored_same_endpoint_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_restored_same_endpoint_total {}",
        if me_allows_normal {
            stats.get_me_writer_restored_same_endpoint_total()
        } else {
            0
        }
    );

    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_restored_fallback_total Refilled ME writer restored via fallback endpoint"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_restored_fallback_total counter"
    );
    let _ = writeln!(
        out,
        "telemt_me_writer_restored_fallback_total {}",
        if me_allows_normal {
            stats.get_me_writer_restored_fallback_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_no_writer_failfast_total ME route failfast errors due to missing writer in bounded wait window"
    );
    let _ = writeln!(out, "# TYPE telemt_me_no_writer_failfast_total counter");
    let _ = writeln!(
        out,
        "telemt_me_no_writer_failfast_total {}",
        if me_allows_normal {
            stats.get_me_no_writer_failfast_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_hybrid_timeout_total ME hybrid route timeouts after bounded retry window"
    );
    let _ = writeln!(out, "# TYPE telemt_me_hybrid_timeout_total counter");
    let _ = writeln!(
        out,
        "telemt_me_hybrid_timeout_total {}",
        if me_allows_normal {
            stats.get_me_hybrid_timeout_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_async_recovery_trigger_total Async ME recovery trigger attempts from route path"
    );
    let _ = writeln!(out, "# TYPE telemt_me_async_recovery_trigger_total counter");
    let _ = writeln!(
        out,
        "telemt_me_async_recovery_trigger_total {}",
        if me_allows_normal {
            stats.get_me_async_recovery_trigger_total()
        } else {
            0
        }
    );
    let _ = writeln!(
        out,
        "# HELP telemt_me_inline_recovery_total Legacy inline ME recovery attempts from route path"
    );
    let _ = writeln!(out, "# TYPE telemt_me_inline_recovery_total counter");
    let _ = writeln!(
        out,
        "telemt_me_inline_recovery_total {}",
        if me_allows_normal {
            stats.get_me_inline_recovery_total()
        } else {
            0
        }
    );

    let unresolved_writer_losses = if me_allows_normal {
        stats
            .get_me_writer_removed_unexpected_total()
            .saturating_sub(
                stats
                    .get_me_writer_restored_same_endpoint_total()
                    .saturating_add(stats.get_me_writer_restored_fallback_total()),
            )
    } else {
        0
    };
    let _ = writeln!(
        out,
        "# HELP telemt_me_writer_removed_unexpected_minus_restored_total Unexpected writer removals not yet compensated by restore"
    );
    let _ = writeln!(
        out,
        "# TYPE telemt_me_writer_removed_unexpected_minus_restored_total ga
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
  **Post-Mortem & Fix Analysis**:
  > перед тем как начать: спасибо, что делитесь и учавствуете, это реально очень важно, чтоб держать в голове мысль, что всё это время, силы, бессонные ночи - не зря; мы открыты к идеям, мыслям, наблюдениям, а тем более pr)  > 1. Возможность возможность не рвать соединение, а сделать его лимитированным(шейпинг) уже средствами прокси  upstream manager - отдельно, шейпинг и полисинг - отдельно, давайте не будем путать; проблема шейпинга и полисинга в том, что когда протокол их не реализует, то получается либо lossy, либо laggy - а это долгая отправка сообщений, долгое получение медиа, сбои... -> как определить, кого и в какой момент может полисить/шейпить безопасно - большая загадка...  > 2\. **маппинга имени пользователя из telemt в socks**, например флаг `map_username=true`  это не проблема сделать, но, есть нюансы: - пользователи первичнее апстримов, - можно сделать привязку пользователей к апстримам - своеобразный ACL  > 2\. возможность не рвать соединение  пока, судя по драфтам, при бол
  > фитнес мощно влепил xd 
  > а с оригинальным mtProxy клиенты так же себя ведут? чет сомневаюсь

- **Issue #20** (2026-02-25): **[PROBLEM] No working w/ VLESS-proxy**
  *Symptoms*: I use VLESS as VPN protocol. When Im connected to VPN then proxy can't establish connection. Through openvpn all is good
  **Post-Mortem & Fix Analysis**:
  > Just checked, and it works like a charm with my VLESS + xtls profiles. Kinda a weird thing to do though, tbh — you're better off just adding the telemt server IP to your exceptions.
  > I have used tcpdump to check the incoming packets on 443 port of the proxy server. When I enable proxy in telegram on my laptop through the VPN there is no activity in tcpdump log. When I use telnet to connect to 443 I can see activity. Maybe the problem is with the host masking?
  > I think your VLESS client sees the SNI (tls_domain) in Telegram's Fake TLS handshake and routes it to the real domain instead of your proxy. That's why tcpdump shows nothing - packets never reach your server. OpenVPN doesn't care about SNI, it just tunnels raw packets - that's why it works fine.  Not a telemt bug it's VLESS being too smart for its own good  Just add the telemt server IP to your exceptions

- **Issue #19** (2026-02-19): **[PROBLEM] DC=203 Endpoint**
  *Symptoms*: Hello! Images and video from dc4 is ok, from dc2 not loading. tried in direct mode and with socks5 upstream to vps in another country. Is it any way to debug it? Tested with curl and ping - both ip are ok from two vps. Logs are the same for dc2 and dc4.
  **Post-Mortem & Fix Analysis**:
  > Hello! Add `--log-level debug` to the end of exec command for debug: `telemt` will run 2-50 times slower depending on the scenario, but it will make it clear where the errors occur...
  > I have a same problem. Here's my log:   telemt  | 2026-02-11T12:10:07.685848Z  INFO telemt::config: mask_host not set, using tls_domain (tori.fi) for masking telemt  | 2026-02-11T12:10:07.685978Z  INFO telemt: === Configuration Loaded === telemt  | 2026-02-11T12:10:07.685983Z  INFO telemt: TLS Domain: tori.fi telemt  | 2026-02-11T12:10:07.685985Z  INFO telemt: Mask enabled: true telemt  | 2026-02-11T12:10:07.685991Z  INFO telemt: Mask host: tori.fi telemt  | 2026-02-11T12:10:07.685992Z  INFO telemt: Mask port: 8080 telemt  | 2026-02-11T12:10:07.685994Z  INFO telemt: Modes: classic=false, secure=false, tls=true telemt  | 2026-02-11T12:10:07.685996Z  INFO telemt: ============================ telemt  | 2026-02-11T12:10:07.734870Z  INFO telemt: Listening on 0.0.0.0:8080 telemt  | 2026-02-11T12:10:07.735065Z  INFO telemt: --- Proxy Links for xx.xxx.xxx.xxx --- telemt  | 2026-02-11T12:10:07.735079Z  INFO telemt: User: docker telemt  | 2026-02-11T12:10:07.735134Z  INFO telemt:   EE-TLS:  tg:/
  > does the problem persist if you run telemt outside of docker?

- **Issue #18** (2026-02-15): **[PROBLEM] Colored log output w/ syslog**
  *Symptoms*: non-readable log in syslog, when run in docker and logging.driver: syslog  Something like:  > 2026-02-11T08:55:08.037941+00:00 vm 2660c012d466[784]: #033[2m2026-02-11T08:55:08.037771Z#033[0m #033[32m INFO#033[0m #033[2mtelemt::proxy::handshake#033[0m#033[2m:#033[0m MTProto handshake successful #033[3mpeer#033[0m#033[2m=#033[0m91.191.254.158:43294 #033[3muser#033[0m#033[2m=#033[0mdocker #033[3mdc#033[0m#033[2m=#033[0m-2 #033[3mproto#033[0m#033[2m=#033[0mSecure #033[3mtls#033[0m#033[2m=#033[0mtrue  
  **Post-Mortem & Fix Analysis**:
  > Hello! Unfortunately, the official release of telemt-docker is still WIP... but, we consider the readability of logs to be really important, so we will add this in version 1.2.0.0
  > > Hello! Unfortunately, the official release of telemt-docker is still WIP... but, we consider the readability of logs to be really important, so we will add this in version 1.2.0.0  This issue is reproduced in non‑containerized version 2.0.0.1 Fernsprach. 
  > Fixed by @artemws in #78  Fixed version available in Release and in tree

- **Issue #11** (2026-02-15): **[PROBLEM] Ad-tag not working**
  *Symptoms*: Hello, I've set up the proxy using your script, and it works great. However, I'm having a problem: the AD_TAG isn't showing up on the proxy. The AD_TAG and channel key are correct; it's just that the proxy built with your script isn't displaying the AD_TAG. What could be the problem?
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for informing, in few hours, we will reproduce and investigate why this is happening...
  > Step 1: System Preparation apt update && apt upgrade -y apt install -y curl wget nano  Step 2: Install Rust curl --proto '=https' --tlsv1.2 -sSf  https://sh.rustup.rs  | sh #Install by default according to 1 source $HOME/.cargo/env  Step 3: Clone and compile telemt cd /opt git clone  https://github.com/telemt/telemt.git cd telemt cargo build --release cp target/release/telemt /opt/telemt/telemt mkdir -p /opt/telemt && mv /opt/telemt/telemt /opt/telemt/ 2>/dev/null || true cd /opt/telemt  Step 4: Create a configuration file cat > config.toml << 'EOF' [general] ad_tag = "b2023fd75dd03299856015dc469139ae"  [general.modes] tls = true  [server] port = 443  [[server.listeners]] ip = "0.0.0.0" announce_ip = "118.11.11.11"  [censorship] tls_domain = "aure.microsoft.com"  [access.users] tg = "a1b2c3d4e5f67890abcdecf4b2d7e8f9" EOF  Step 5: Test Run ./telemt config.toml Success symbol: [INFO] Listening on 0.0.0.0:8443 Press Ctrl+C to stop  Step 6: Firewall ufw allow 8443/tcp ufw reload  Step 7: R
  > Issue confirmed Added to Task-plan for version 1.2.0.0 Release - until February 9

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

### Incident Patch 1: `e2f1c3f3` (2026-10-03)
**Commit Message**: Bridge JS semicolon warnings fixed

**File**: `src/web/bridge/behavior_tests.js` (modified, +15/-1)
```diff
@@ -228,7 +228,7 @@ test('multiple precommit lanes survive fallback without losing stream ordering',
  env.send(join(frame(2,2,[2]),frame(2,1,[1])));await flush();await env.tick(3001);
  const next=env.pending('/api/v1/session')[0];env.answer(next,200,frame(17),{'X-Session-Token':'C'.repeat(43),'X-Down-Cursor':'0','X-Carrier-Mode':'https','X-Carrier-Attempt':'2','X-Carrier-Candidate-Count':'4','X-Carrier-Deadline':'12','X-Carrier-State':'provisional','X-Telemt-Up-Window':'4'});await flush();
  const requests=env.requests.filter(r=>r.url.endsWith('/api/v1/up')&&r.options.headers.Authorization==='Bearer '+'C'.repeat(43));
- const frames=[];for(const request of requests){const bytes=new Uint8Array(request.options.body);for(let offset=0;offset<bytes.length;){const view=new DataView(bytes.buffer,offset);frames.push([bytes[offset],bytes[offset+3]]);offset+=8+view.getUint32(4)}}
+ const frames=[];for(const request of requests){const bytes=new Uint8Array(request.options.body);for(let offset=0;offset<bytes.length;){const view=new DataView(bytes.buffer,offset);frames.push([bytes[offset],bytes[offset+3]]);offset+=8+view.getUint32(4);}}
  for(const id of [1,2])assert.deepEqual(frames.filter(value=>value[1]===id),[[1,id],[2,id]]);
  assert.equal(frames.length,4);env.close();await flush();
 });
@@ -248,4 +248,18 @@ test('receiver retirement releases shared prefix capacity without exposing a par
  b.owner.close();env.close();await flush();
 });
 
+test('native close cancels every HTTP request and pagehide cannot repeat cleanup',async page=>{
+ for(const android of [false,true])for(const carrier of ['https','https-lanes']){
+  const env=await session(page,carrier,4,android);env.send(frame(1,1));await flush();env.send(frame(2,1,[7]));await flush();
+  const up=env.pending('/api/v1/up'),down=env.pending('/api/v1/down'),requests=up.concat(down);
+  assert.equal(up.length,2);assert.equal(down.length,1);assert.ok(requests.every(request=>!request.options.signal.aborted));
+  env.send({t:'close'});await flush();
+  assert.ok(requests.every(request=>request.options.signal.aborted));
+  assert.equal(env.requests.filter(request=>request.options.method==='DELETE').length,1);
+  const count=env.requests.length;env.close();await env.tick(120000);
+  assert.equal(env.requests.filter(request=>request.options.method==='DELETE').length,1);
+  assert.equal(env.requests.length,count);
+ }
+});
+
 (async()=>{const page=renderedPage();let failed=0;for(const {name,run} of tests){let timer;try{await Promise.race([run(page),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('test made no bounded progress')),5000)})]);console.log('ok - '+name)}catch(error){failed++;console.error('not ok - '+name+'\n'+error.stack)}finally{clearTimeout(timer)}}if(failed)process.exitCode=1})();
```

**File**: `src/web/bridge/conveyor.js` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ function create(settings){
  function retire(channel,restore){
   channel.closed=true;if(channel.controller)channel.controller.abort();channel.receiver.close();
   const saved=[];
-  for(const lease of channel.flights.values()){if(restore)saved.push({order:lease.order,data:lease.body});settings.buffers.cancelBatch(lease)}
+  for(const lease of channel.flights.values()){if(restore)saved.push({order:lease.order,data:lease.body});settings.buffers.cancelBatch(lease);}
   channel.flights.clear();channel.acks.clear();
   for(const data of channel.pending)if(restore)saved.push({order:order++,data});
   settings.buffers.releasePending(channel.pending,channel.lane);return saved;
```

**File**: `src/web/bridge/downlink.js` (modified, +4/-4)
```diff
@@ -38,11 +38,11 @@ function create(settings){
   const next=response.headers.get('X-Down-Cursor')||'',base=settings.cursor();
   if(!/^[1-9]\d*$/.test(next)||BigInt(next)!==BigInt(base)+1n||BigInt(next)>18446744073709551615n)throw protocol('invalid downlink cursor');
   const length=response.headers.get('Content-Length');let declared=null;
-  if(length!==null){if(!/^(0|[1-9]\d*)$/.test(length))throw protocol('invalid response length');declared=Number(length);if(!Number.isSafeInteger(declared)||declared===0||declared>settings.limit())throw protocol('response body overflow')}
+  if(length!==null){if(!/^(0|[1-9]\d*)$/.test(length))throw protocol('invalid response length');declared=Number(length);if(!Number.isSafeInteger(declared)||declared===0||declared>settings.limit())throw protocol('response body overflow');}
   if(transaction&&(transaction.base!==base||transaction.next!==next||(transaction.declared!==null&&declared!==null&&transaction.declared!==declared)))throw protocol('changed replay metadata');
   if(!transaction){
    const capacity=declared===null?settings.limit():declared,release=await settings.budget.acquire(capacity,signal);
-   if(!current(signal)){release();throw new Error('downlink retired')}
+   if(!current(signal)){release();throw new Error('downlink retired');}
    transaction={base,next,declared,bytes:new Uint8Array(capacity),retained:0,delivered:0,release};
   }
   const owner=transaction;
@@ -53,7 +53,7 @@ function create(settings){
   const reader=response.body.getReader();let position=0,offset=0,frames=0,chunks=0,complete=false;
   try{
    for(;;){
-    let part;try{part=await reader.read()}catch(error){throw settings.failure('network','response stream interrupted')}
+    let part;try{part=await reader.read();}catch(error){throw settings.failure('network','response stream interrupted');}
     if(!current(signal)||transaction!==owner)throw new Error('downlink retired');
     if(part.done)break;
     const data=part.value;if(!(data instanceof Uint8Array)||++chunks>65536||data.byteLength>owner.bytes.byteLength-position)throw protocol('response body overflow');
@@ -76,7 +76,7 @@ function create(settings){
    if(!position||offset!==position||position<owner.retained||(owner.declared!==null&&position!==owner.declared))throw protocol('incomplete downlink batch');
    settings.advance(next);complete=true;dispose();return new ArrayBuffer(0);
   }finally{
-   if(!complete)try{const cancelled=reader.cancel();if(cancelled)cancelled.catch(()=>{})}catch(error){}
+   if(!complete)try{const cancelled=reader.cancel();if(cancelled)cancelled.catch(()=>{});}catch(error){}
    reader.releaseLock();
   }
  }
```

**File**: `src/web/bridge/request.js` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ function create(settings){
      lastReason='http';wait=retryAfterMs(fetched);settings.cancel(fetched);
     }else{
      const policy=responsePolicy(path,fetched.status);let body;
-     try{body=receiver&&(fetched.status===200||fetched.status===204)?await receiver(fetched,controller.signal):await settings.read(fetched,policy.limit,policy.exact,controller.signal)}
+     try{body=receiver&&(fetched.status===200||fetched.status===204)?await receiver(fetched,controller.signal):await settings.read(fetched,policy.limit,policy.exact,controller.signal);}
      catch(error){
       controller.abort();
       if(external&&external.aborted)throw error;
```

**File**: `src/web/bridge/runtime.js` (modified, +3/-4)
```diff
@@ -19,7 +19,7 @@ let laneQueueLimit=Math.min(queueLimit,8388608),laneItemLimit=Math.min(queueItem
 const fragment=location.hash,androidNonce=/^#android=([A-Za-z0-9_-]{43})$/.exec(fragment)?.[1]||'',recoveryPath=location.pathname+location.search;
 history.replaceState(null,'',location.pathname);
 let initialized=false,closed=false,port=null,sessionToken='',cleanupToken='',createStarted=false,socket=null,socketReady=false,carrier='';
-let upSequence=1,downCursor='0',upRunning=false,upLease=null,pollController=null,httpCarrier=null,upWindow=1;
+let upSequence=1,downCursor='0',upRunning=false,upLease=null,httpCarrier=null,upWindow=1;
 let helloFrame=null,helloTimer=null,welcomeSent=false,carrierAttempt=1,carrierFailure='',carrierCommitted=false,terminalFailure='';
 let negotiationStartedAt=0,carrierTimer=null,probeTimer=null,attemptController=null,attemptEpoch=1,candidateRunning=false,switching=false,currentAttempt=null;
 let recoveryController=null,recoveryCommit=null,recoveryReplaced=false,lastSchedulerWall=Date.now(),lastSchedulerMonotonic=performance.now(),schedulerGapPending=0,schedulerTimer=null;
@@ -60,7 +60,7 @@ function resolveRecoveryCommit(){
 function retireCarrier(policy){
  stopHttp(false);upWindow=1;
  recoveryReplaced=true;attemptEpoch++;if(carrierTimer)clearTimeout(carrierTimer);carrierTimer=null;clearProbeTimer();
- if(attemptController)attemptController.abort();attemptController=null;if(pollController)pollController.abort();pollController=null;
+ if(attemptController)attemptController.abort();attemptController=null;
  if(socket){const previous=socket;socket=null;previous.close()}socketReady=false;cancelBatch(upLease);releasePending(upPending,null);
  for(const lane of lanes.values()){
   if(lane.controller)lane.controller.abort();cancelBatch(lane.upLease);releasePending(lane.pending,lane);if(lane.socket)lane.socket.close();
@@ -144,7 +144,6 @@ function clearProbeTimer(){if(probeTimer){clearTimeout(probeTimer.timer);probeTi
 function resetCandidate(){
  stopHttp(true);upWindow=1;
  clearProbeTimer();
- if(pollController)pollController.abort();pollController=null;
  if(socket){const previous=socket;socket=null;previous.close()}socketReady=false;
  cancelBatch(upLease);releasePending(upPending,null);
  for(const lane of lanes.values()){
@@ -384,7 +383,7 @@ function deleteSession(){
  if(token)fetch(relayBase+'/api/v1/session',options('DELETE',token,null,headers,undefined,true)).catch(()=>{});
 }
 function close(notifyServer){
- if(closed)return;closed=true;stopHttp(false);if(recoveryController)recoveryController.cancel();rejectRecoveryCommit(failure('network','bridge closed'));if(helloTimer)clearTimeout(helloTimer);helloTimer=null;if(carrierTimer)clearTimeout(carrierTimer);clearProbeTimer();if(schedulerTimer)clearTimeout(schedulerTimer);schedulerTimer=null;if(attemptController)attemptController.abort();if(pollController)pollController.abort();
+ if(closed)return;closed=true;stopHttp(false);if(recoveryController)recoveryController.cancel();rejectRecoveryCommit(failure('network','bridge closed'));if(helloTimer)clearTimeout(helloTimer);helloTimer=null;if(carrierTimer)clearTimeout(carrierTimer);clearProbeTimer();if(schedulerTimer)clearTimeout(schedulerTimer);schedulerTimer=null;if(attemptController)attemptController.abort();
  if(socket)socket.close();cancelBatch(upLease);releasePending(upPending,null);
  for(const lane of lanes.values()){
   if(lane.controller)lane.controller.abort();cancelBatch(lane.upLease);releasePending(lane.pending,lane);if(lane.socket)lane.socket.close();
```

---

### Incident Patch 2: `d65efcc4` (2026-10-02)
**Commit Message**: Fix autonomous ME recovery from Direct fallback

Co-Authored-By: brekotis <[REDACTED_EMAIL]>

**File**: `src/config/defaults.rs` (modified, +2/-1)
```diff
@@ -59,7 +59,7 @@ const DEFAULT_ME_POOL_DRAIN_SOFT_EVICT_BUDGET_PER_CORE: u16 = 16;
 const DEFAULT_ME_POOL_DRAIN_SOFT_EVICT_COOLDOWN_MS: u64 = 1000;
 const DEFAULT_USER_MAX_UNIQUE_IPS_WINDOW_SECS: u64 = 30;
 const DEFAULT_ACCEPT_PERMIT_TIMEOUT_MS: u64 = 250;
-const DEFAULT_CONNTRACK_CONTROL_ENABLED: bool = true;
+const DEFAULT_CONNTRACK_CONTROL_ENABLED: bool = false;
 const DEFAULT_CONNTRACK_PRESSURE_HIGH_WATERMARK_PCT: u8 = 85;
 const DEFAULT_CONNTRACK_PRESSURE_LOW_WATERMARK_PCT: u8 = 70;
 const DEFAULT_CONNTRACK_DELETE_BUDGET_PER_SEC: u64 = 4096;
@@ -244,6 +244,7 @@ pub(crate) fn default_accept_permit_timeout_ms() -> u64 {
     DEFAULT_ACCEPT_PERMIT_TIMEOUT_MS
 }
 
+/// Keeps privileged conntrack control disabled unless explicitly requested.
 pub(crate) fn default_conntrack_control_enabled() -> bool {
     DEFAULT_CONNTRACK_CONTROL_ENABLED
 }
```

**File**: `src/config/tests/load_basic_tests/conntrack_tests.rs` (modified, +66/-0)
```diff
@@ -1,5 +1,71 @@
 use super::*;
 
+#[test]
+fn conntrack_control_is_opt_in_by_default() {
+    assert!(!default_conntrack_control_enabled());
+    assert!(
+        !ProxyConfig::default()
+            .server
+            .conntrack_control
+            .inline_conntrack_control
+    );
+    let cfg = load_config_from_temp_toml(
+        r#"
+        [censorship]
+        tls_domain = "example.com"
+
+        [access.users]
+        user = "00000000000000000000000000000000"
+        "#,
+    );
+    assert!(!cfg.server.conntrack_control.inline_conntrack_control);
+    assert!(
+        !cfg.server
+            .conntrack_control
+            .inline_conntrack_control_explicit
+    );
+    assert_eq!(
+        serde_json::to_value(&cfg.server.conntrack_control).unwrap()["inline_conntrack_control"],
+        false,
+    );
+}
+
+#[test]
+fn conntrack_control_preserves_explicit_enablement() {
+    for enabled in [false, true] {
+        let cfg = load_config_from_temp_toml(&format!(
+            r#"
+            [server.conntrack_control]
+            inline_conntrack_control = {enabled}
+            backend = "nftables"
+
+            [censorship]
+            tls_domain = "example.com"
+
+            [access.users]
+            user = "00000000000000000000000000000000"
+            "#,
+        ));
+        assert_eq!(
+            cfg.server.conntrack_control.inline_conntrack_control,
+            enabled
+        );
+        assert!(
+            cfg.server
+                .conntrack_control
+                .inline_conntrack_control_explicit
+        );
+        assert_eq!(
+            cfg.server.conntrack_control.backend,
+            ConntrackBackend::Nftables
+        );
+        assert_eq!(
+            serde_json::to_value(&cfg.server.conntrack_control).unwrap()["inline_conntrack_control"],
+            enabled,
+        );
+    }
+}
+
 #[test]
 fn conntrack_pressure_high_watermark_out_of_range_is_rejected() {
     let toml = r#"
```

**File**: `src/conntrack_control/firewall/actor.rs` (modified, +48/-13)
```diff
@@ -26,15 +26,21 @@ const RETRY_DELAYS: [Duration; 6] = [
     Duration::from_secs(30),
 ];
 
+/// Reports whether a generation's desired firewall policy was confirmed.
 #[derive(Clone, Copy, Debug, Eq, PartialEq)]
 pub(super) enum ReconcileOutcome {
+    /// The applied policy matches the accepted generation's desired policy.
     Applied,
+    /// The attempt failed without confirming the desired policy.
     Failed,
 }
 
+/// Associates a reconciliation result with its accepted runtime generation.
 #[derive(Clone, Copy, Debug, Eq, PartialEq)]
 pub(super) struct ReconcileStatus {
+    /// Runtime generation whose desired policy was attempted.
     pub(super) generation: u64,
+    /// Result of the latest completed attempt for this generation.
     pub(super) outcome: ReconcileOutcome,
 }
 
@@ -51,8 +57,35 @@ pub(crate) struct FirewallAuthority {
 }
 
 impl FirewallAuthority {
-    /// Starts the single process-owned firewall reconciler.
-    pub(crate) fn spawn(control_plane: &ProcessControlPlane) -> Result<Self, String> {
+    /// Starts reconciliation only when enabled and CAP_NET_ADMIN is available.
+    pub(crate) fn spawn(
+        control_plane: &ProcessControlPlane,
+        config: &ProxyConfig,
+    ) -> Result<Option<Self>, String> {
+        let Some((authority, actor)) = Self::prepare(config, SystemCommandRunner) else {
+            return Ok(None);
+        };
+        control_plane
+            .spawn_cooperative(move |process_cancellation| async move {
+                actor.run(process_cancellation).await;
+            })
+            .map_err(|_| {
+                "process control-plane admission closed before conntrack firewall startup"
+                    .to_string()
+            })?;
+        Ok(Some(authority))
+    }
+
+    // Admission precedes allocation so an opted-out process never owns firewall cleanup.
+    // Keeping construction separate permits fake runners without changing async Send bounds.
+    fn prepare<R>(config: &ProxyConfig, runner: R) -> Option<(Self, FirewallReconciler<R>)>
+    where
+        R: FirewallCommandRunner + 'static,
+    {
+        if !config.server.conntrack_control.inline_conntrack_control || !runner.has_cap_net_admin()
+        {
+            return None;
+        }
         let (desired_tx, desired_rx) = watch::channel(None);
         let (status_tx, status_rx) = watch::channel(None);
         let terminal = CancellationToken::new();
@@ -61,7 +94,7 @@ impl FirewallAuthority {
         let cleanup_succeeded = Arc::new(AtomicBool::new(false));
         let completed = Arc::new(Notify::new());
         let actor = FirewallReconciler::new(
-            SystemCommandRunner,
+            runner,
             desired_rx,
             status_tx,
             terminal.clone(),
@@ -70,23 +103,16 @@ impl FirewallAuthority {
             Arc::clone(&cleanup_succeeded),
             Arc::clone(&completed),
         );
-        control_plane
-            .spawn_cooperative(move |process_cancellation| async move {
-                actor.run(process_cancellation).await;
-            })
-            .map_err(|_| {
-                "process control-plane admission closed before conntrack firewall startup"
-                    .to_string()
-            })?;
-        Ok(Self {
+        let authority = Self {
             desired_tx,
             status_rx,
             terminal,
             closed,
             completed_flag,
             cleanup_succeeded,
             completed,
-        })
+        };
+        Some((authority, actor))
     }
 
     /// Publishes policy only after its runtime generation becomes active.
@@ -169,6 +195,7 @@ impl Drop for CompletionGuard {
     }
 }
 
+/// Serializes confirmed-state transitions and retains cleanup ownership until shutdown.
 pub(super) struct FirewallReconciler<R> {
     runner: R,
     desired_rx: watch::Receiver<Option<DesiredState>>,
@@ -186,6 +213,7 @@ impl<R> FirewallReconciler<R>
 where
     R: FirewallCommandRunner + 'static,
 {
+    /// Constructs an admitted actor with unknown state pending startup recovery.
     pub(super) fn new(
         runner: R,
         desired_rx: watch::Receiver<Option<DesiredState>>,
@@ -214,6 +242,7 @@ where
         }
     }
 
+    /// Reconciles accepted generations and completes bounded cleanup on cancellation.
     pub(super) async fn run(mut self, process_cancellation: CancellationToken) {
         let mut current = None;
         let mut retry_index = 0usize;
@@ -337,6 +366,7 @@ where
         let _completion = &self.completion;
     }
 
+    /// Accepts fenced publications without replacing telemetry with stale desired state.
     pub(super) fn take_latest_desired(&mut self) -> Option<DesiredState> {
         let next = self.desired_rx.borrow_and_update().clone()?;
         if next.generation < self.last_generation {
@@ -369,3 +399,8 @@ where
         Some(next)
     }
 }
+
+// Exercises startup admission and cleanup ownership with fake helper processes.
+#[cfg(test)]
+#[
```

**File**: `src/conntrack_control/firewall/tests/startup_admission.rs` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+use std::sync::Mutex;
+use std::sync::atomic::AtomicUsize;
+
+use crate::config::{ConntrackBackend, ConntrackMode};
+
+use super::super::command::{CommandErrorKind, CommandSpec, classify_command_error};
+use super::super::transaction::reconcile_once;
+use super::*;
+
+const NETLINK_ERROR: &str =
+    "src/mnl.c:68: Unable to initialize Netlink socket: Address family not supported by protocol";
+const PERMISSION_ERROR: &str = "iptables v1.8.11 (nf_tables): Could not fetch rule set generation id: Permission denied (you must be root)";
+
+#[derive(Clone)]
+struct StartupRunner {
+    has_cap_net_admin: bool,
+    cap_probes: Arc<AtomicUsize>,
+    calls: Arc<Mutex<Vec<CommandSpec>>>,
+    failure: Option<&'static str>,
+}
+
+impl StartupRunner {
+    fn new(has_cap_net_admin: bool, failure: Option<&'static str>) -> Self {
+        Self {
+            has_cap_net_admin,
+            cap_probes: Arc::new(AtomicUsize::new(0)),
+            calls: Arc::new(Mutex::new(Vec::new())),
+            failure,
+        }
+    }
+
+    fn calls(&self) -> Vec<CommandSpec> {
+        self.calls.lock().unwrap().clone()
+    }
+}
+
+impl FirewallCommandRunner for StartupRunner {
+    fn available(&self, _binary: &str) -> bool {
+        true
+    }
+
+    fn has_cap_net_admin(&self) -> bool {
+        self.cap_probes.fetch_add(1, Ordering::Relaxed);
+        self.has_cap_net_admin
+    }
+
+    async fn run(&self, spec: CommandSpec) -> Result<(), CommandError> {
+        self.calls.lock().unwrap().push(spec.clone());
+        if let Some(message) = self.failure {
+            return Err(CommandError {
+                kind: classify_command_error(spec.binary, &spec.args, message),
+                message: message.to_string(),
+            });
+        }
+        if (spec.binary == "nft" && spec.args.first().map(String::as_str) == Some("delete"))
+            || (matches!(spec.binary, "iptables" | "ip6tables")
+                && matches!(
+                    spec.args.get(2).map(String::as_str),
+                    Some("-C" | "-D" | "-F" | "-X")
+                ))
+        {
+            return Err(CommandError {
+                kind: CommandErrorKind::NotFound,
+                message: "injected absent owned object".to_string(),
+            });
+        }
+        Ok(())
+    }
+}
+
+fn start_with_runner(
+    config: &ProxyConfig,
+    runner: StartupRunner,
+    scope: &ProcessControlPlane,
+) -> Option<FirewallAuthority> {
+    let (authority, actor) = FirewallAuthority::prepare(config, runner)?;
+    assert!(
+        scope
+            .spawn_cooperative(move |cancellation| actor.run(cancellation))
+            .is_ok()
+    );
+    Some(authority)
+}
+
+#[tokio::test(start_paused = true)]
+async fn disabled_startup_never_acquires_cleanup_ownership() {
+    for explicit in [false, true] {
+        for has_cap in [true, false] {
+            for backend in [
+                ConntrackBackend::Auto,
+                ConntrackBackend::Nftables,
+                ConntrackBackend::Iptables,
+            ] {
+                for mode in [
+                    ConntrackMode::Tracked,
+                    ConntrackMode::Notrack,
+                    ConntrackMode::Hybrid,
+                ] {
+                    for message in [NETLINK_ERROR, PERMISSION_ERROR] {
+                        let mut config = ProxyConfig::default();
+                        if explicit {
+                            config.server.conntrack_control.inline_conntrack_control = false;
+                            config
+                                .server
+                                .conntrack_control
+                                .inline_conntrack_control_explicit = true;
+                        }
+                        config.server.conntrack_control.backend = backend;
+                        config.server.conntrack_control.mode = mode;
+                        let runner = StartupRunner::new(has_cap, Some(message));
+                        let scope = ProcessControlPlane::new();
+                        let authority = start_with_runner(&config, runner.clone(), &scope);
+                        assert!(
+                            authority.is_none(),
+                            "{explicit} {has_cap} {backend:?} {mode:?}"
+                        );
+                        assert_eq!(runner.cap_probes.load(Ordering::Relaxed), 0);
+                        tokio::time::advance(Duration::from_secs(90)).await;
+                        assert!(scope.shutdown(Duration::from_secs(1)).await);
+                        assert!(runner.calls().is_empty());
+                    }
+                }
+            }
+        }
+    }
+}
+
+#[tokio::test(start_paused = true)]
+async fn enabled_startup_without_capability_creates_no_firewall_work() {
+    let mut config = ProxyConfig::default();
+    config.server.conntrack_control.inline_conntrack_control = true;
+    for mode in [ConntrackMode::Tracked, ConntrackMode::No
```

**File**: `src/maestro/admission.rs` (modified, +20/-4)
```diff
@@ -13,6 +13,11 @@ use super::generation::RuntimeTaskScope;
 const STARTUP_FALLBACK_AFTER: Duration = Duration::from_secs(80);
 const RUNTIME_FALLBACK_AFTER: Duration = Duration::from_secs(6);
 
+// Admission regressions cover notification loss without network startup.
+#[cfg(test)]
+mod tests;
+
+/// Keeps generation admission and routing synchronized with periodic ME readiness.
 pub(crate) async fn configure_admission_gate(
     config: &Arc<ProxyConfig>,
     me_pool: Option<Arc<MePool>>,
@@ -76,21 +81,32 @@ pub(crate) async fn configure_admission_gate(
                 } else {
                     Some(Instant::now())
                 };
+                let mut config_watch_open = true;
+                let mut me_ready_watch_open = true;
                 loop {
                     tokio::select! {
-                        changed = config_rx_gate.changed() => {
+                        changed = config_rx_gate.changed(), if config_watch_open => {
                             if changed.is_err() {
-                                break;
+                                config_watch_open = false;
+                                warn!(
+                                    watch_channel = "config",
+                                    "Admission config watch closed; continuing readiness polling with last configuration"
+                                );
+                                continue;
                             }
                             let cfg = config_rx_gate.borrow_and_update().clone();
                             admission_poll_ms = cfg.general.me_admission_poll_ms.max(1);
                             fallback_enabled = cfg.general.me2dc_fallback;
                             fast_fallback_enabled = cfg.general.me2dc_fallback && cfg.general.me2dc_fast;
                             continue;
                         }
-                        changed = me_ready_rx_gate.changed() => {
+                        changed = me_ready_rx_gate.changed(), if me_ready_watch_open => {
                             if changed.is_err() {
-                                break;
+                                me_ready_watch_open = false;
+                                warn!(
+                                    watch_channel = "me_ready",
+                                    "Admission ME readiness watch closed; continuing periodic polling"
+                                );
                             }
                         }
                         _ = tokio::time::sleep(Duration::from_millis(admission_poll_ms)) => {}
```

**File**: `src/maestro/admission/tests.rs` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+use std::sync::atomic::{AtomicUsize, Ordering};
+
+use tracing::{Event, Subscriber};
+use tracing_subscriber::Layer;
+use tracing_subscriber::layer::{Context, SubscriberExt};
+
+use super::*;
+use crate::transport::middle_proxy::admission_test_support::IdlePoolFixture;
+
+const POLL_MS: u64 = 20;
+
+struct ClosureWarnings(Arc<AtomicUsize>);
+
+impl<S: Subscriber> Layer<S> for ClosureWarnings {
+    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
+        struct ChannelField(bool);
+        impl tracing::field::Visit for ChannelField {
+            fn record_debug(
+                &mut self,
+                field: &tracing::field::Field,
+                _value: &dyn std::fmt::Debug,
+            ) {
+                self.0 |= field.name() == "watch_channel";
+            }
+        }
+        if event.metadata().level() == &tracing::Level::WARN {
+            let mut visitor = ChannelField(false);
+            event.record(&mut visitor);
+            if visitor.0 {
+                self.0.fetch_add(1, Ordering::Relaxed);
+            }
+        }
+    }
+}
+
+struct GateFixture {
+    pool: IdlePoolFixture,
+    route: Arc<RouteRuntimeController>,
+    admission: watch::Receiver<bool>,
+    config_tx: Option<watch::Sender<Arc<ProxyConfig>>>,
+    ready_tx: Option<watch::Sender<u64>>,
+    config: Arc<ProxyConfig>,
+    scope: RuntimeTaskScope,
+}
+
+impl GateFixture {
+    async fn new() -> Self {
+        let pool = IdlePoolFixture::new(false).await;
+        let mut cfg = ProxyConfig::default();
+        cfg.general.use_middle_proxy = true;
+        cfg.general.me2dc_fallback = true;
+        cfg.general.me2dc_fast = true;
+        cfg.general.me_admission_poll_ms = POLL_MS;
+        let config = Arc::new(cfg);
+        let (config_tx, config_rx) = watch::channel(config.clone());
+        let (ready_tx, ready_rx) = watch::channel(0);
+        let (admission_tx, mut admission) = watch::channel(false);
+        let route = Arc::new(RouteRuntimeController::new(RelayRouteMode::Direct));
+        let scope = RuntimeTaskScope::new();
+        configure_admission_gate(
+            &config,
+            Some(pool.pool()),
+            Arc::new(RwLock::new(Some(pool.pool()))),
+            route.clone(),
+            &admission_tx,
+            config_rx,
+            ready_rx,
+            scope.clone(),
+        )
+        .await;
+        drop(admission_tx);
+        admission.borrow_and_update();
+        tokio::task::yield_now().await;
+        Self {
+            pool,
+            route,
+            admission,
+            config_tx: Some(config_tx),
+            ready_tx: Some(ready_tx),
+            config,
+            scope,
+        }
+    }
+
+    async fn poll(&self) {
+        tokio::task::yield_now().await;
+        tokio::time::advance(Duration::from_millis(POLL_MS)).await;
+        tokio::task::yield_now().await;
+    }
+
+    async fn expect_route(&self, mode: RelayRouteMode) {
+        let mut rx = self.route.subscribe();
+        tokio::time::timeout(Duration::from_secs(1), async {
+            loop {
+                if rx.borrow_and_update().mode == mode {
+                    return;
+                }
+                rx.changed().await.unwrap();
+            }
+        })
+        .await
+        .expect("the generation must keep sampling readiness without client traffic");
+    }
+}
+
+async fn recovery_after_watch_closure(close_config: bool, close_ready: bool) {
+    let warnings = Arc::new(AtomicUsize::new(0));
+    let subscriber = tracing_subscriber::registry().with(ClosureWarnings(warnings.clone()));
+    let _default = tracing::subscriber::set_default(subscriber);
+    let mut fixture = GateFixture::new().await;
+    assert!(*fixture.admission.borrow());
+    if close_config {
+        fixture.config_tx.take();
+    }
+    if close_ready {
+        fixture.ready_tx.take();
+    }
+    for _ in 0..4 {
+        tokio::task::yield_now().await;
+    }
+    let expected_warnings = usize::from(close_config) + usize::from(close_ready);
+    fixture.pool.set_ready(true);
+    for _ in 0..4 {
+        tokio::task::yield_now().await;
+    }
+    assert_eq!(fixture.route.snapshot().mode, RelayRouteMode::Direct);
+    fixture.poll().await;
+    fixture.expect_route(RelayRouteMode::Middle).await;
+    fixture.pool.set_ready(false);
+    fixture.poll().await;
+    fixture.expect_route(RelayRouteMode::Direct).await;
+    fixture.pool.set_ready(true);
+    fixture.poll().await;
+    fixture.expect_route(RelayRouteMode::Middle).await;
+    for _ in 0..5 {
+        fixture.poll().await;
+    }
+    assert_eq!(warnings.load(Ordering::Relaxed), expected_warnings);
+    fixture.scope.stop().await;
+    assert!(fixture.admission.has_changed().is_err());
+}
+
+#[tokio::test(start_paused = true)]
+async fn idle_gate_recovers_after_readiness_watch_closes() {
+    recovery_after_watch_closure(false, true).await;
+}
+
+#[tokio::test(start_paused = true)]
+async fn idle_ga
```

**File**: `src/maestro/orchestrator.rs` (modified, +10/-6)
```diff
@@ -375,17 +375,21 @@ pub(super) async fn run_telemt_core(
 
     #[cfg(target_os = "linux")]
     let conntrack_firewall = {
-        let authority = crate::conntrack_control::FirewallAuthority::spawn(&process_control_plane)
-            .map_err(std::io::Error::other)?;
-        if !authority
-            .publish_initial(1, runtime.config.clone(), stats.clone())
-            .await
+        let authority = crate::conntrack_control::FirewallAuthority::spawn(
+            &process_control_plane,
+            &runtime.config,
+        )
+        .map_err(std::io::Error::other)?;
+        if let Some(authority) = &authority
+            && !authority
+                .publish_initial(1, runtime.config.clone(), stats.clone())
+                .await
         {
             warn!(
                 "Initial conntrack firewall reconciliation failed; background retries remain active"
             );
         }
-        Some(authority)
+        authority
     };
     #[cfg(not(target_os = "linux"))]
     let conntrack_firewall = None::<crate::conntrack_control::FirewallAuthority>;
```

**File**: `src/service/mod.rs` (modified, +32/-7)
```diff
@@ -104,11 +104,12 @@ pub fn generate_service_file(init_system: InitSystem, opts: &ServiceOptions) ->
         InitSystem::Systemd => generate_systemd_unit(opts),
         InitSystem::OpenRC => generate_openrc_script(opts),
         InitSystem::FreeBSDRc => generate_freebsd_rc_script(opts),
-        InitSystem::Unknown => generate_systemd_unit(opts), // Default to systemd format
+        // Preserve systemd generation when init detection is unavailable.
+        InitSystem::Unknown => generate_systemd_unit(opts),
     }
 }
 
-/// Generates an enhanced systemd unit file.
+/// Generates a hardened systemd unit with Netlink access for optional firewall helpers.
 fn generate_systemd_unit(opts: &ServiceOptions) -> String {
     let user_line = opts.user.map(|u| format!("User={}", u)).unwrap_or_default();
     let group_line = opts
@@ -151,14 +152,14 @@ PrivateDevices=true
 ProtectKernelTunables=true
 ProtectKernelModules=true
 ProtectControlGroups=true
-RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
+RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
 RestrictNamespaces=true
 RestrictRealtime=true
 RestrictSUIDSGID=true
 MemoryDenyWriteExecute=true
 LockPersonality=true
 
-# Allow binding to privileged ports and writing to specific paths
+# Allow privileged port binding, optional firewall helpers, and runtime state writes
 AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_ADMIN
 CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_ADMIN
 ReadWritePaths=/etc/telemt /var/run /var/lib/telemt
@@ -233,9 +234,11 @@ fn generate_freebsd_rc_script(opts: &ServiceOptions) -> String {
 # Add the following lines to /etc/rc.conf to enable telemt:
 #
 # telemt_enable="YES"
-# telemt_config="/etc/telemt/config.toml"  # optional
-# telemt_user="telemt"                      # optional
-# telemt_group="telemt"                     # optional
+# The configuration path can be overridden in rc.conf.
+# telemt_config="/etc/telemt/config.toml"
+# The service user and group can be overridden in rc.conf.
+# telemt_user="telemt"
+# telemt_group="telemt"
 #
 
 . /etc/rc.subr
@@ -355,6 +358,28 @@ mod tests {
         assert!(unit.contains("PIDFile="));
     }
 
+    #[test]
+    fn systemd_unit_allows_netlink_without_removing_hardening() {
+        let unit = generate_systemd_unit(&ServiceOptions::default());
+        let families = unit
+            .lines()
+            .find_map(|line| line.strip_prefix("RestrictAddressFamilies="))
+            .unwrap();
+        assert_eq!(
+            families.split_whitespace().collect::<Vec<_>>(),
+            ["AF_INET", "AF_INET6", "AF_UNIX", "AF_NETLINK"],
+        );
+        for directive in [
+            "NoNewPrivileges=true",
+            "ProtectSystem=strict",
+            "RestrictNamespaces=true",
+            "AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_ADMIN",
+            "CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_ADMIN",
+        ] {
+            assert!(unit.lines().any(|line| line == directive), "{directive}");
+        }
+    }
+
     #[test]
     fn test_openrc_script_generation() {
         let opts = ServiceOptions::default();
```

---

### Incident Patch 3: `86912e34` (2026-10-01)
**Commit Message**: Сonntrack recovery on absent iptables-nft chains fixes

Co-Authored-By: brekotis <[REDACTED_EMAIL]>

**File**: `src/conntrack_control/firewall/command.rs` (modified, +104/-5)
```diff
@@ -10,14 +10,19 @@ use crate::util::trusted_command::{resolve_trusted_helper, trusted_helper_comman
 
 const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
 
+/// A privileged helper invocation with arguments kept separate from shell syntax.
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub(super) struct CommandSpec {
+    /// Logical helper name resolved by the trusted executable policy.
     pub(super) binary: &'static str,
+    /// Arguments passed directly to the helper process.
     pub(super) args: Vec<String>,
+    /// Optional restore script supplied on standard input.
     pub(super) stdin: Option<String>,
 }
 
 impl CommandSpec {
+    /// Creates a helper invocation without an input script.
     pub(super) fn new(binary: &'static str, args: impl IntoIterator<Item = &'static str>) -> Self {
         Self {
             binary,
@@ -26,6 +31,7 @@ impl CommandSpec {
         }
     }
 
+    /// Creates a helper invocation that receives a restore script.
     pub(super) fn with_stdin(
         binary: &'static str,
         args: impl IntoIterator<Item = &'static str>,
@@ -39,29 +45,40 @@ impl CommandSpec {
     }
 }
 
+/// Distinguishes idempotent absence from transaction and execution failures.
 #[derive(Clone, Copy, Debug, Eq, PartialEq)]
 pub(super) enum CommandErrorKind {
+    /// The trusted helper executable is unavailable.
     Missing,
+    /// The requested firewall object or rule is absent.
     NotFound,
+    /// A terminal or process cancellation interrupted the invocation.
     Cancelled,
+    /// The helper exceeded its execution deadline.
     Timeout,
+    /// A failure that must not be treated as successful cleanup.
     Failed,
 }
 
+/// A classified helper failure retaining its diagnostic for reconciliation.
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub(super) struct CommandError {
+    /// Recovery semantics associated with the failure.
     pub(super) kind: CommandErrorKind,
+    /// Original helper diagnostic or an execution failure description.
     pub(super) message: String,
 }
 
 impl CommandError {
+    /// Creates the cancellation failure used by interruptible transactions.
     pub(super) fn cancelled() -> Self {
         Self {
             kind: CommandErrorKind::Cancelled,
             message: "firewall transaction cancelled".to_string(),
         }
     }
 
+    /// Creates a failure that prevents idempotent cleanup from claiming success.
     pub(super) fn failed(message: impl Into<String>) -> Self {
         Self {
             kind: CommandErrorKind::Failed,
@@ -76,14 +93,19 @@ impl std::fmt::Display for CommandError {
     }
 }
 
+/// Executes firewall commands through a production or deterministic test runner.
 pub(super) trait FirewallCommandRunner: Send + Sync {
+    /// Reports whether a helper can be resolved under the runner's trust policy.
     fn available(&self, binary: &str) -> bool;
 
+    /// Reports whether the process has the capability required to alter firewall rules.
     fn has_cap_net_admin(&self) -> bool;
 
+    /// Executes one invocation while preserving classified failure semantics.
     async fn run(&self, spec: CommandSpec) -> Result<(), CommandError>;
 }
 
+/// Runs trusted system helpers with bounded execution and captured diagnostics.
 #[derive(Clone, Copy, Default)]
 pub(super) struct SystemCommandRunner;
 
@@ -187,18 +209,95 @@ impl FirewallCommandRunner for SystemCommandRunner {
             } else {
                 stderr
             };
-            let kind = if is_not_found_error(&message) {
-                CommandErrorKind::NotFound
-            } else {
-                CommandErrorKind::Failed
-            };
+            let kind = classify_command_error(binary, &spec.args, &message);
             Err(CommandError { kind, message })
         }
     }
 }
 
+/// Recognizes the existing legacy iptables and native nftables absence formats.
 pub(super) fn is_not_found_error(message: &str) -> bool {
     message.contains("No chain/target/match by that name")
         || message.contains("Bad rule (does a matching rule exist in that chain?)")
         || message.contains("Could not process rule: No such file or directory")
 }
+
+/// Bounds additional iptables-nft absence diagnostics to owned cleanup and checks.
+pub(super) fn classify_command_error(
+    binary: &str,
+    args: &[String],
+    message: &str,
+) -> CommandErrorKind {
+    if is_not_found_error(message) || is_missing_owned_iptables_chain(binary, args, message) {
+        CommandErrorKind::NotFound
+    } else {
+        CommandErrorKind::Failed
+    }
+}
+
+fn is_missing_owned_iptables_chain(binary: &str, args: &[String], message: &str) -> bool {
+    if !matches!(binary, "iptables" | "ip6tables") {
+        return false;
+    }
+    // An absent jump target is harmless for deletion, but not for installation.
+    let chain = match args {
+        [flag, table, operation, source, jump, target]
+            if flag == "-t"
+                && table == "raw"
+      
```

**File**: `src/conntrack_control/firewall/tests.rs` (modified, +4/-0)
```diff
@@ -20,6 +20,10 @@ use super::transaction::{InterruptibleRunner, reconcile_once};
 #[path = "tests/model_tests.rs"]
 mod model_tests;
 
+// Replays helper diagnostics through command classification and recovery.
+#[path = "tests/recovery_errors.rs"]
+mod recovery_errors;
+
 #[derive(Clone)]
 struct FailureRule {
     binary: &'static str,
```

**File**: `src/conntrack_control/firewall/tests/recovery_errors.rs` (added, +512/-0)
```diff
@@ -0,0 +1,512 @@
+use super::super::command::classify_command_error;
+use super::super::transaction::recover_to_empty;
+use super::*;
+
+const OWNED_CHAINS: [&str; 3] = ["TELEMT_NOTRACK", "TELEMT_NT_A", "TELEMT_NT_B"];
+type ChainKey = (&'static str, String, String);
+type ChainRules = BTreeMap<ChainKey, BTreeSet<String>>;
+
+fn missing_chain(binary: &str, chain: &str) -> String {
+    format!(
+        "{binary} v1.8.10 (nf_tables): Chain '{chain}' does not exist\n\
+         Try `{binary} -h' or '{binary} --help' for more information."
+    )
+}
+
+fn classified_error(spec: &CommandSpec, message: &str) -> CommandError {
+    CommandError {
+        kind: classify_command_error(spec.binary, &spec.args, message),
+        message: message.to_string(),
+    }
+}
+
+#[derive(Default)]
+struct FixtureState {
+    calls: Vec<CommandSpec>,
+    chains: ChainRules,
+    nft_tables: BTreeSet<String>,
+    failure: Option<&'static str>,
+}
+
+#[derive(Clone)]
+struct FixtureRunner {
+    state: Arc<Mutex<FixtureState>>,
+}
+
+impl FixtureRunner {
+    fn new(failure: Option<&'static str>) -> Self {
+        let mut state = FixtureState {
+            failure,
+            ..FixtureState::default()
+        };
+        for binary in ["iptables", "ip6tables"] {
+            for (table, chain, rules) in [
+                ("raw", "PREROUTING", vec!["-j FOREIGN_RAW"]),
+                ("raw", "FOREIGN_RAW", vec!["-j ACCEPT"]),
+                ("filter", "INPUT", vec!["-j MTPR_SYNFIX", "-j TMT_SYN_TEST"]),
+                ("filter", "MTPR_SYNFIX", vec!["-p tcp --syn -j DROP"]),
+                ("filter", "TMT_SYN_TEST", vec!["-p tcp --syn -j DROP"]),
+            ] {
+                state.chains.insert(
+                    (binary, table.to_string(), chain.to_string()),
+                    rules.into_iter().map(str::to_string).collect(),
+                );
+            }
+        }
+        state.nft_tables.extend([
+            "mtpr_synfix".to_string(),
+            "telemt_synlimit_test".to_string(),
+            "foreign_table".to_string(),
+        ]);
+        Self {
+            state: Arc::new(Mutex::new(state)),
+        }
+    }
+
+    fn calls(&self) -> Vec<CommandSpec> {
+        self.state.lock().unwrap().calls.clone()
+    }
+
+    fn foreign_snapshot(&self) -> (ChainRules, BTreeSet<String>) {
+        let state = self.state.lock().unwrap();
+        let mut chains = state.chains.clone();
+        chains.retain(|(_, table, chain), _| {
+            table != "raw" || !OWNED_CHAINS.contains(&chain.as_str())
+        });
+        for ((_, table, chain), rules) in &mut chains {
+            if table == "raw" && chain == "PREROUTING" {
+                rules.remove("-j TELEMT_NOTRACK");
+            }
+        }
+        (chains, state.nft_tables.clone())
+    }
+
+    fn assert_owned_policy(&self, enabled: bool) {
+        let state = self.state.lock().unwrap();
+        for (binary, ip) in [("iptables", "192.0.2.10"), ("ip6tables", "2001:db8::10")] {
+            for chain in OWNED_CHAINS {
+                let key = (binary, "raw".to_string(), chain.to_string());
+                if !enabled {
+                    assert!(!state.chains.contains_key(&key));
+                    continue;
+                }
+                let expected = match chain {
+                    "TELEMT_NOTRACK" => BTreeSet::from(["-j TELEMT_NT_A".to_string()]),
+                    "TELEMT_NT_A" => {
+                        BTreeSet::from([format!("-p tcp --dport 443 -d {ip} -j CT --notrack")])
+                    }
+                    "TELEMT_NT_B" => BTreeSet::new(),
+                    _ => unreachable!(),
+                };
+                assert_eq!(state.chains.get(&key), Some(&expected));
+            }
+            let prerouting = (binary, "raw".to_string(), "PREROUTING".to_string());
+            assert_eq!(
+                state.chains[&prerouting].contains("-j TELEMT_NOTRACK"),
+                enabled
+            );
+        }
+    }
+}
+
+impl FirewallCommandRunner for FixtureRunner {
+    fn available(&self, _binary: &str) -> bool {
+        true
+    }
+
+    fn has_cap_net_admin(&self) -> bool {
+        true
+    }
+
+    async fn run(&self, spec: CommandSpec) -> Result<(), CommandError> {
+        let mut state = self.state.lock().unwrap();
+        state.calls.push(spec.clone());
+        if spec.binary == "nft" {
+            assert_eq!(&spec.args[..3], ["delete", "table", "inet"]);
+            return if state.nft_tables.remove(&spec.args[3]) {
+                Ok(())
+            } else {
+                Err(classified_error(
+                    &spec,
+                    "Error: Could not process rule: No such file or directory",
+                ))
+            };
+        }
+        if let Some(script) = &spec.stdin {
+            let binary = match spec.binary {
+                "iptables-restore" => "iptables",
+                "ip6tables-restore" => "ip6tables",
+                _ =>
```

---

### Incident Patch 4: `6fa8da3c` (2026-09-30)
**Commit Message**: Daemon stdio ownership and cover runtime path policies fixed

Co-Authored-By: brekotis <[REDACTED_EMAIL]>

**File**: `src/daemon/mod.rs` (modified, +5/-3)
```diff
@@ -9,7 +9,7 @@ use std::os::unix::fs::OpenOptionsExt;
 use std::path::{Path, PathBuf};
 
 use nix::errno::Errno;
-use nix::unistd::{self, ForkResult, Gid, Uid, chdir, close, fork, getpid, setsid};
+use nix::unistd::{self, ForkResult, Gid, Uid, chdir, fork, getpid, setsid};
 use tracing::info;
 
 // PID file ownership and process-control helpers.
@@ -176,8 +176,10 @@ fn redirect_stdio_to_devnull() -> Result<(), DaemonError> {
         }
     }
 
-    if devnull_fd > 2 {
-        let _ = close(devnull_fd);
+    // Keep stdio descriptors open; other source descriptors are closed once by File's Drop.
+    // Transfer ownership only after all dup2 calls succeed so errors retain RAII cleanup.
+    if devnull_fd <= 2 {
+        let _ = std::os::unix::io::IntoRawFd::into_raw_fd(devnull);
     }
 
     Ok(())
```

---

### Incident Patch 5: `38eabc50` (2026-09-26)
**Commit Message**: WEB: Base Path: security + reload coverage fixes&tests

**File**: `src/api/config_edit.rs` (modified, +3/-0)
```diff
@@ -447,6 +447,9 @@ fn deep_merge(base: &mut Toml, patch: &Toml) {
     }
 }
 
+#[cfg(test)]
+#[path = "config_edit/base_path_tests.rs"]
+mod base_path_tests;
 #[cfg(test)]
 #[path = "config_edit/tests.rs"]
 mod tests;
```

**File**: `src/api/config_edit/base_path_tests.rs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+use super::*;
+
+fn web_config() -> &'static str {
+    r#"
+[access.users]
+alice = "000102030405060708090a0b0c0d0e0f"
+
+[[server.listeners]]
+ip = "127.0.0.1"
+port = 18080
+transport = "web"
+proxy_protocol = false
+web_client_ip_source = "x_forwarded_for"
+web_trusted_proxy_cidrs = ["127.0.0.1/32"]
+
+[web]
+enabled = true
+
+[[web.vhosts]]
+host = "proxy.example.com"
+public_addr = "203.0.113.10:443"
+
+[web.vhosts.decoy]
+mode = "http_upstream"
+upstream = "http://127.0.0.1:18081"
+
+[[web.vhosts.profiles]]
+user = "alice"
+secret_mode = "plain"
+"#
+}
+
+fn vhosts_patch(base_path: &str) -> Json {
+    serde_json::json!({
+        "web": {
+            "vhosts": [{
+                "host": "proxy.example.com",
+                "base_path": base_path,
+                "public_addr": "203.0.113.10:443",
+                "decoy": {
+                    "mode": "http_upstream",
+                    "upstream": "http://127.0.0.1:18081"
+                },
+                "profiles": [{
+                    "user": "alice",
+                    "secret_mode": "plain"
+                }]
+            }]
+        }
+    })
+}
+
+#[tokio::test]
+async fn config_api_applies_valid_base_path_and_preserves_source_on_invalid_patch() {
+    let directory = tempfile::tempdir().unwrap();
+    let path = directory.path().join("config.toml");
+    std::fs::write(&path, web_config()).unwrap();
+    let active = ProxyConfig::load(&path).unwrap();
+
+    let mut response = apply_patch_to_path(&path, &vhosts_patch("MixedCase/path"), None)
+        .await
+        .unwrap();
+    let desired = ProxyConfig::load(&path).unwrap();
+    let resolved = reconcile_runtime_effect(&mut response, &active, &desired).unwrap();
+    assert!(!response.restart_required);
+    assert!(response.runtime_reload_required);
+    assert!(!response.process_restart_required);
+    assert!(response.deferred_process_fields.is_empty());
+    assert!(resolved.runtime_changed);
+    assert_eq!(desired.web.vhosts[0].base_path, "MixedCase/path");
+    assert_eq!(
+        resolved.effective.web.runtime.as_ref().unwrap().vhosts["proxy.example.com"].base,
+        "/MixedCase/path/"
+    );
+
+    let (managed, _revision) = read_managed_config(&path).await.unwrap();
+    let vhosts = managed["web"]["vhosts"].as_array().unwrap();
+    assert_eq!(vhosts[0]["base_path"].as_str(), Some("MixedCase/path"));
+    assert!(managed["web"].get("runtime").is_none());
+    assert!(!managed.as_table().unwrap().contains_key("access"));
+
+    let before_invalid = std::fs::read(&path).unwrap();
+    let error = apply_patch_to_path(&path, &vhosts_patch("/invalid"), None)
+        .await
+        .unwrap_err();
+    assert_eq!(error.status, hyper::StatusCode::BAD_REQUEST);
+    assert_eq!(std::fs::read(&path).unwrap(), before_invalid);
+}
```

**File**: `src/config/hot_reload.rs` (modified, +3/-0)
```diff
@@ -62,5 +62,8 @@ use reporting::log_changes;
 #[cfg(test)]
 use watcher::{ReloadState, reload_config};
 
+#[cfg(test)]
+#[path = "hot_reload/base_path_tests.rs"]
+mod base_path_tests;
 #[cfg(test)]
 mod tests;
```

**File**: `src/config/hot_reload/base_path_tests.rs` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+use base64::Engine as _;
+
+use super::*;
+
+fn write_base_path_config(path: &Path, base_path: &str) {
+    let base_path = if base_path.is_empty() {
+        String::new()
+    } else {
+        format!("base_path = \"{base_path}\"\n")
+    };
+    let config = format!(
+        r#"
+[access.users]
+alice = "000102030405060708090a0b0c0d0e0f"
+
+[[server.listeners]]
+ip = "127.0.0.1"
+port = 18080
+transport = "web"
+proxy_protocol = false
+web_client_ip_source = "x_forwarded_for"
+web_trusted_proxy_cidrs = ["127.0.0.1/32"]
+
+[web]
+enabled = true
+
+[[web.vhosts]]
+host = "proxy.example.com"
+{base_path}public_addr = "203.0.113.10:443"
+
+[web.vhosts.decoy]
+mode = "http_upstream"
+upstream = "http://127.0.0.1:18081"
+
+[[web.vhosts.profiles]]
+user = "alice"
+secret_mode = "plain"
+"#,
+    );
+    std::fs::write(path, config).unwrap();
+}
+
+#[test]
+fn reload_rejects_invalid_base_then_publishes_route_identity_together() {
+    let directory = tempfile::tempdir().unwrap();
+    let path = directory.path().join("config.toml");
+    write_base_path_config(&path, "");
+    let initial = Arc::new(ProxyConfig::load(&path).unwrap());
+    let initial_hash = ProxyConfig::load_with_metadata(&path)
+        .unwrap()
+        .rendered_hash;
+    let initial_capability = initial.web.runtime.as_ref().unwrap().capabilities[0];
+    let (config_tx, _config_rx) = watch::channel(Arc::clone(&initial));
+    let (log_tx, _log_rx) = watch::channel(initial.general.log_level.clone());
+    let mut reload_state = ReloadState::new(Some(initial_hash));
+
+    write_base_path_config(&path, "/invalid");
+    reload_config(&path, &config_tx, &log_tx, None, None, &mut reload_state);
+    let unchanged = config_tx.borrow().clone();
+    assert!(Arc::ptr_eq(&unchanged, &initial));
+    assert_eq!(unchanged.web.vhosts[0].base_path, "");
+    assert_eq!(
+        unchanged.web.runtime.as_ref().unwrap().capabilities[0],
+        initial_capability
+    );
+
+    write_base_path_config(&path, "dobry-cola-super-app");
+    reload_config(&path, &config_tx, &log_tx, None, None, &mut reload_state);
+    let applied = config_tx.borrow().clone();
+    let runtime = applied.web.runtime.as_ref().unwrap();
+    let vhost = &runtime.vhosts["proxy.example.com"];
+    assert_eq!(applied.web.vhosts[0].base_path, "dobry-cola-super-app");
+    assert_eq!(vhost.base, "/dobry-cola-super-app/");
+    assert_eq!(vhost.capabilities[0], vhost.profiles[0].capability);
+    assert_eq!(runtime.capabilities.as_ref(), vhost.capabilities.as_ref());
+    assert!(!runtime.capabilities.contains(&initial_capability));
+    assert_eq!(
+        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(vhost.capabilities[0]),
+        "hHz99Xs93EN1j91G9gpNepXwGNNt5YdAFkEVk_LlqdQ"
+    );
+}
```

**File**: `src/config/load/runtime_web/tests.rs` (modified, +17/-0)
```diff
@@ -38,6 +38,23 @@ fn capability_matches_reference_vectors() {
     }
 }
 
+#[test]
+fn capability_binds_the_exact_host_and_base_path_identity() {
+    let secret = hex::decode("000102030405060708090a0b0c0d0e0f").unwrap();
+    let root = derive_web_capability(&secret, b"proxy.example.com", b"").unwrap();
+    let mixed = derive_web_capability(&secret, b"proxy.example.com", b"MixedCase/path").unwrap();
+    let lower = derive_web_capability(&secret, b"proxy.example.com", b"mixedcase/path").unwrap();
+    let other_path =
+        derive_web_capability(&secret, b"proxy.example.com", b"MixedCase/other").unwrap();
+    let other_host =
+        derive_web_capability(&secret, b"other.example.com", b"MixedCase/path").unwrap();
+
+    let identities = [root, mixed, lower, other_path, other_host]
+        .into_iter()
+        .collect::<std::collections::HashSet<_>>();
+    assert_eq!(identities.len(), 5);
+}
+
 #[cfg(unix)]
 #[test]
 fn static_snapshot_remains_anchored_after_root_path_replacement() {
```

**File**: `src/config/load/strict_keys.rs` (modified, +1/-7)
```diff
@@ -365,13 +365,7 @@ const WEB_TIMEOUTS_CONFIG_KEYS: &[&str] = &[
     "decoy_header_secs",
 ];
 
-const WEB_VHOST_CONFIG_KEYS: &[&str] = &[
-    "host",
-    "base_path",
-    "public_addr",
-    "decoy",
-    "profiles",
-];
+const WEB_VHOST_CONFIG_KEYS: &[&str] = &["host", "base_path", "public_addr", "decoy", "profiles"];
 const WEB_DECOY_CONFIG_KEYS: &[&str] = &["mode", "upstream", "directory", "index"];
 const WEB_PROFILE_CONFIG_KEYS: &[&str] = &[
     "user",
```

**File**: `src/config/load/validate_web/vhosts.rs` (modified, +3/-1)
```diff
@@ -85,7 +85,9 @@ fn validate_web_base_path(value: &str, field: &str) -> Result<()> {
         && !value.ends_with('/')
         && value.split('/').all(|segment| {
             let mut bytes = segment.bytes();
-            bytes.next().is_some_and(|byte| byte.is_ascii_alphanumeric())
+            bytes
+                .next()
+                .is_some_and(|byte| byte.is_ascii_alphanumeric())
                 && bytes.all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
         });
     if value.is_empty() || valid {
```

**File**: `src/config/tests/load_basic_tests/web_tests.rs` (modified, +9/-1)
```diff
@@ -1,5 +1,8 @@
 use super::*;
 
+#[path = "web_tests/base_path_tests.rs"]
+mod base_path_tests;
+
 const WEB_CONFIG: &str = r#"
 [access.users]
 alice = "000102030405060708090a0b0c0d0e0f"
@@ -64,7 +67,7 @@ fn web_config_builds_canonical_runtime_snapshot() {
 #[test]
 fn web_base_path_is_canonical_and_precomputed() {
     let maximum = "a".repeat(128);
-    for base_path in ["Dobry-Cola/super_app", maximum.as_str()] {
+    for base_path in ["a", "a/b/c9_x-y", "Dobry-Cola/super_app", maximum.as_str()] {
         let configured = WEB_CONFIG.replace(
             "host = \"Proxy.Example.COM\"",
             &format!("host = \"Proxy.Example.COM\"\nbase_path = \"{base_path}\""),
@@ -99,6 +102,11 @@ fn web_base_path_rejects_noncanonical_forms() {
         "relay//nested",
         "-relay",
         "_relay",
+        "a/-lead",
+        "a/_lead",
+        "dot.ted",
+        "..",
+        "/",
         "relay/.hidden",
         "relay/%2fhidden",
         "relay path",
```

---

### Incident Patch 6: `f1107c21` (2026-09-23)
**Commit Message**: Process-wide concurrency + Cancellation ownership fixes

**File**: `src/api/runtime_edge.rs` (modified, +3/-3)
```diff
@@ -314,9 +314,9 @@ async fn recompute_connections_payload(
     let mut active_users = 0usize;
     for entry in shared.stats.iter_user_stats() {
         let user_stats = entry.value();
-        let current_connections = user_stats
-            .curr_connects
-            .load(std::sync::atomic::Ordering::Relaxed);
+        let current_connections = shared
+            .stats
+            .get_process_user_curr_connects(entry.key());
         let total_octets = user_stats
             .octets_from_client
             .load(std::sync::atomic::Ordering::Relaxed)
```

**File**: `src/api/users/view.rs` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ pub(in crate::api) async fn users_from_config(
                 .filter(|limit| *limit > 0)
                 .or((cfg.access.user_max_unique_ips_global_each > 0)
                     .then_some(cfg.access.user_max_unique_ips_global_each)),
-            current_connections: stats.get_user_curr_connects(&username),
+            current_connections: stats.get_process_user_curr_connects(&username),
             active_unique_ips: active_ip_list.len(),
             active_unique_ips_list: active_ip_list,
             recent_unique_ips: recent_ip_list.len(),
```

**File**: `src/conntrack_control/firewall.rs` (modified, +18/-11)
```diff
@@ -1,5 +1,6 @@
 use std::collections::BTreeSet;
 use std::net::IpAddr;
+use std::time::Duration;
 
 use tokio::io::AsyncWriteExt;
 use tokio::process::Command;
@@ -363,6 +364,7 @@ pub(super) async fn delete_conntrack_entry(event: ConntrackCloseEvent) -> Delete
 }
 
 async fn run_command(binary: &str, args: &[&str], stdin: Option<String>) -> Result<(), String> {
+    const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
     #[cfg(unix)]
     let Some(command_path) = resolve_trusted_helper(binary) else {
         return Err(format!("{binary} is not available"));
@@ -377,21 +379,26 @@ async fn run_command(binary: &str, args: &[&str], stdin: Option<String>) -> Resu
     }
     command.stdout(std::process::Stdio::null());
     command.stderr(std::process::Stdio::piped());
+    command.kill_on_drop(true);
     let mut child = command
         .spawn()
         .map_err(|error| format!("spawn {binary} failed: {error}"))?;
-    if let Some(blob) = stdin
-        && let Some(mut writer) = child.stdin.take()
-    {
-        writer
-            .write_all(blob.as_bytes())
+    let output = tokio::time::timeout(COMMAND_TIMEOUT, async move {
+        if let Some(blob) = stdin
+            && let Some(mut writer) = child.stdin.take()
+        {
+            writer
+                .write_all(blob.as_bytes())
+                .await
+                .map_err(|error| format!("stdin write {binary} failed: {error}"))?;
+        }
+        child
+            .wait_with_output()
             .await
-            .map_err(|error| format!("stdin write {binary} failed: {error}"))?;
-    }
-    let output = child
-        .wait_with_output()
-        .await
-        .map_err(|error| format!("wait {binary} failed: {error}"))?;
+            .map_err(|error| format!("wait {binary} failed: {error}"))
+    })
+    .await
+        .map_err(|_| format!("{binary} timed out after {}s", COMMAND_TIMEOUT.as_secs()))??;
     if output.status.success() {
         return Ok(());
     }
```

**File**: `src/ip_tracker.rs` (modified, +35/-12)
```diff
@@ -38,11 +38,16 @@ struct UserIpShard {
 
 #[derive(Debug, Default)]
 struct CleanupShard {
-    queue: Mutex<HashMap<(String, UserIncarnation), HashMap<IpAddr, usize>>>,
+    queue: Mutex<CleanupQueue>,
 }
 
+type CleanupQueue =
+    HashMap<String, HashMap<UserIncarnation, HashMap<IpAddr, usize>>>;
+type CleanupBatch = HashMap<(String, UserIncarnation, IpAddr), usize>;
+
 #[derive(Debug, Clone)]
 struct UserIpLimitPolicy {
+    source_generation: u64,
     max_ips: Arc<HashMap<String, usize>>,
     default_max_ips: usize,
     mode: UserMaxUniqueIpsMode,
@@ -52,6 +57,7 @@ struct UserIpLimitPolicy {
 impl Default for UserIpLimitPolicy {
     fn default() -> Self {
         Self {
+            source_generation: 0,
             max_ips: Arc::new(HashMap::new()),
             default_max_ips: 0,
             mode: UserMaxUniqueIpsMode::ActiveWindow,
@@ -70,6 +76,7 @@ pub struct UserIpTracker {
     recent_cap_rejects: Arc<AtomicU64>,
     cleanup_deferred_releases: Arc<AtomicU64>,
     limit_policy: Arc<ArcSwap<UserIpLimitPolicy>>,
+    policy_update: Arc<Mutex<()>>,
     last_compact_epoch_secs: Arc<AtomicU64>,
     cleanup_queue_len: Arc<AtomicU64>,
     cleanup_shards: Arc<Box<[CleanupShard]>>,
@@ -121,6 +128,7 @@ impl UserIpTracker {
             recent_cap_rejects: Arc::new(AtomicU64::new(0)),
             cleanup_deferred_releases: Arc::new(AtomicU64::new(0)),
             limit_policy: Arc::new(ArcSwap::from_pointee(UserIpLimitPolicy::default())),
+            policy_update: Arc::new(Mutex::new(())),
             last_compact_epoch_secs: Arc::new(AtomicU64::new(0)),
             cleanup_queue_len: Arc::new(AtomicU64::new(0)),
             cleanup_shards: Arc::new(cleanup_shards),
@@ -196,19 +204,21 @@ impl UserIpTracker {
     }
 
     pub(super) fn pop_one_cleanup(
-        queue: &mut HashMap<(String, UserIncarnation), HashMap<IpAddr, usize>>,
+        queue: &mut CleanupQueue,
     ) -> Option<(String, UserIncarnation, IpAddr, usize)> {
-        let owner = queue.keys().next().cloned()?;
-        let ip = queue.get(&owner)?.keys().next().copied()?;
-        let count = queue.get_mut(&owner)?.remove(&ip)?;
-        let remove_user = queue
-            .get(&owner)
-            .map(|user_queue| user_queue.is_empty())
-            .unwrap_or(false);
-        if remove_user {
-            queue.remove(&owner);
+        let user = queue.keys().next().cloned()?;
+        let incarnation = queue.get(&user)?.keys().next().copied()?;
+        let ip = queue.get(&user)?.get(&incarnation)?.keys().next().copied()?;
+        let incarnations = queue.get_mut(&user)?;
+        let ips = incarnations.get_mut(&incarnation)?;
+        let count = ips.remove(&ip)?;
+        if ips.is_empty() {
+            incarnations.remove(&incarnation);
         }
-        Some((owner.0, owner.1, ip, count))
+        if incarnations.is_empty() {
+            queue.remove(&user);
+        }
+        Some((user, incarnation, ip, count))
     }
 
     #[cfg(test)]
@@ -224,6 +234,19 @@ impl UserIpTracker {
     #[cfg(not(test))]
     pub(super) fn observe_cleanup_poison_for_tests(&self) {}
 
+    #[cfg(test)]
+    pub(crate) async fn hold_user_shard_for_tests(
+        &self,
+        user: &str,
+        entered: tokio::sync::oneshot::Sender<()>,
+        release: tokio::sync::oneshot::Receiver<()>,
+    ) {
+        let shard_idx = Self::shard_idx(user);
+        let _guard = self.shards[shard_idx].write().await;
+        let _ = entered.send(());
+        let _ = release.await;
+    }
+
     pub(super) fn now_epoch_secs() -> u64 {
         std::time::SystemTime::now()
             .duration_since(std::time::UNIX_EPOCH)
```

**File**: `src/ip_tracker/admission.rs` (modified, +65/-30)
```diff
@@ -2,47 +2,84 @@ use super::*;
 
 impl UserIpTracker {
     pub async fn set_limit_policy(&self, mode: UserMaxUniqueIpsMode, window_secs: u64) {
-        self.limit_policy.rcu(|current| {
-            Arc::new(UserIpLimitPolicy {
-                mode,
-                window_secs: window_secs.max(1),
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            mode,
+            window_secs: window_secs.max(1),
+            ..(*current).clone()
+        }));
     }
 
     pub async fn set_user_limit(&self, username: &str, max_ips: usize) {
-        let username = username.to_string();
-        self.limit_policy.rcu(|current| {
-            let mut limits = current.max_ips.as_ref().clone();
-            limits.insert(username.clone(), max_ips);
-            Arc::new(UserIpLimitPolicy {
-                max_ips: Arc::new(limits),
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        let mut limits = current.max_ips.as_ref().clone();
+        limits.insert(username.to_string(), max_ips);
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            max_ips: Arc::new(limits),
+            ..(*current).clone()
+        }));
     }
 
     pub async fn remove_user_limit(&self, username: &str) {
-        self.limit_policy.rcu(|current| {
-            let mut limits = current.max_ips.as_ref().clone();
-            limits.remove(username);
-            Arc::new(UserIpLimitPolicy {
-                max_ips: Arc::new(limits),
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        let mut limits = current.max_ips.as_ref().clone();
+        limits.remove(username);
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            max_ips: Arc::new(limits),
+            ..(*current).clone()
+        }));
     }
 
     pub async fn load_limits(&self, default_limit: usize, limits: &HashMap<String, usize>) {
-        let limits = Arc::new(limits.clone());
-        self.limit_policy.rcu(|current| {
-            Arc::new(UserIpLimitPolicy {
-                max_ips: Arc::clone(&limits),
-                default_max_ips: default_limit,
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            max_ips: Arc::new(limits.clone()),
+            default_max_ips: default_limit,
+            ..(*current).clone()
+        }));
+    }
+
+    /// Atomically publishes one coherent policy from the active runtime generation.
+    pub(crate) async fn apply_policy_from_source(
+        &self,
+        source_generation: u64,
+        default_limit: usize,
+        limits: &HashMap<String, usize>,
+        mode: UserMaxUniqueIpsMode,
+        window_secs: u64,
+    ) -> bool {
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
+        });
+        let current = self.limit_policy.load_full();
+        if source_generation < current.source_generation {
+            return false;
+        }
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            source_generation,
+            max_ips: Arc::new(limits.clone()),
+            default_max_ips: default_limit,
+            mode,
+            window_secs: window_secs.max(1),
+        }));
+        true
     }
 
     pub(super) fn prune_recent(
@@ -70,7 +107,6 @@ impl UserIpTracker {
         ip: IpAddr,
     ) -> Result<(), String> {
         self.drain_cleanup_for_user(username).await;
-        self.maybe_compact_empty_users().await;
         let policy = self.limit_policy.load();
         let limit = Self::user_limit(&policy, username);
         let mode = policy.mode;
@@ -218,7 +254,6 @@ impl UserIpTracker {
         incarnation: UserIncarnation,
         ip: IpAddr,
     ) {
-        self.maybe_compact_empty_users().await;
         let shard_idx = Self::shard_idx(username);
         let mut shard = self.shards[shard_idx].write().await;
         if shard.incarnations.g
```

**File**: `src/ip_tracker/cleanup.rs` (modified, +147/-46)
```diff
@@ -1,5 +1,68 @@
 use super::*;
 
+struct DetachedCleanupBatch<'a> {
+    tracker: &'a UserIpTracker,
+    shard_idx: usize,
+    entries: CleanupBatch,
+}
+
+impl DetachedCleanupBatch<'_> {
+    fn is_empty(&self) -> bool {
+        self.entries.is_empty()
+    }
+
+    fn entries(&self) -> impl Iterator<Item = (&(String, UserIncarnation, IpAddr), &usize)> {
+        self.entries.iter()
+    }
+
+    fn commit(mut self) {
+        let committed = self.entries.len();
+        self.entries.clear();
+        UserIpTracker::decrement_counter(&self.tracker.cleanup_queue_len, committed);
+    }
+}
+
+impl Drop for DetachedCleanupBatch<'_> {
+    fn drop(&mut self) {
+        if self.entries.is_empty() {
+            return;
+        }
+
+        let cleanup_shard = &self.tracker.cleanup_shards[self.shard_idx];
+        let mut duplicate_entries = 0usize;
+        let mut restore = |queue: &mut CleanupQueue| {
+            for ((user, incarnation, ip), count) in self.entries.drain() {
+                let queued = queue
+                    .entry(user)
+                    .or_default()
+                    .entry(incarnation)
+                    .or_default()
+                    .entry(ip)
+                    .or_insert(0);
+                if *queued != 0 {
+                    duplicate_entries = duplicate_entries.saturating_add(1);
+                }
+                *queued = queued.saturating_add(count);
+            }
+        };
+        match cleanup_shard.queue.lock() {
+            Ok(mut queue) => restore(&mut queue),
+            Err(poisoned) => {
+                let mut queue = poisoned.into_inner();
+                restore(&mut queue);
+                cleanup_shard.queue.clear_poison();
+                tracing::warn!(
+                    "UserIpTracker cleanup_queue lock poisoned while restoring a cancelled cleanup batch"
+                );
+            }
+        }
+        UserIpTracker::decrement_counter(
+            &self.tracker.cleanup_queue_len,
+            duplicate_entries,
+        );
+    }
+}
+
 impl UserIpTracker {
     /// Queues a deferred active IP cleanup for a later async drain.
     pub fn enqueue_cleanup(&self, user: String, ip: IpAddr) {
@@ -18,8 +81,13 @@ impl UserIpTracker {
         let cleanup_shard = &self.cleanup_shards[shard_idx];
         match cleanup_shard.queue.lock() {
             Ok(mut queue) => {
-                let user_queue = queue.entry((user, incarnation)).or_default();
-                let count = user_queue.entry(ip).or_insert(0);
+                let count = queue
+                    .entry(user)
+                    .or_default()
+                    .entry(incarnation)
+                    .or_default()
+                    .entry(ip)
+                    .or_insert(0);
                 if *count == 0 {
                     self.cleanup_queue_len.fetch_add(1, Ordering::Relaxed);
                 }
@@ -29,8 +97,13 @@ impl UserIpTracker {
             }
             Err(poisoned) => {
                 let mut queue = poisoned.into_inner();
-                let user_queue = queue.entry((user.clone(), incarnation)).or_default();
-                let count = user_queue.entry(ip).or_insert(0);
+                let count = queue
+                    .entry(user.clone())
+                    .or_default()
+                    .entry(incarnation)
+                    .or_default()
+                    .entry(ip)
+                    .or_insert(0);
                 if *count == 0 {
                     self.cleanup_queue_len.fetch_add(1, Ordering::Relaxed);
                 }
@@ -52,6 +125,26 @@ impl UserIpTracker {
         self.cleanup_queue_len.load(Ordering::Relaxed) as usize
     }
 
+    #[cfg(test)]
+    pub(crate) fn cleanup_queue_physical_entries_for_tests(&self) -> usize {
+        self.cleanup_shards
+            .iter()
+            .map(|cleanup_shard| {
+                let count = |queue: &CleanupQueue| {
+                    queue
+                        .values()
+                        .flat_map(HashMap::values)
+                        .map(HashMap::len)
+                        .sum::<usize>()
+                };
+                match cleanup_shard.queue.lock() {
+                    Ok(queue) => count(&queue),
+                    Err(poisoned) => count(&poisoned.into_inner()),
+                }
+            })
+            .sum()
+    }
+
     #[cfg(test)]
     pub(crate) fn cleanup_queue_mutex_for_tests(
         &self,
@@ -73,38 +166,38 @@ impl UserIpTracker {
             return;
         }
         let shard_idx = Self::shard_idx(user);
+        let _drain_guard = self.cleanup_drain_locks[shard_idx].lock().await;
         let cleanup_shard = &self.cleanup_shards[shard_idx];
         let to_remove = match cleanup_shard.queue.lock() {
-            Ok(mut queue) => drain_user_cleanup(&mut queue, user),
+            Ok(mut queue) => detach_user_cleanup(self, shard_idx, &mut queue, user),
             Err(poisoned) => {
  
```

**File**: `src/ip_tracker/snapshot.rs` (modified, +20/-5)
```diff
@@ -68,10 +68,13 @@ impl UserIpTracker {
         }
     }
 
-    pub async fn run_periodic_maintenance(self: Arc<Self>) {
+    pub async fn run_periodic_maintenance(self: Arc<Self>, source_generation: u64) {
         let mut interval = tokio::time::interval(Duration::from_secs(1));
         loop {
             interval.tick().await;
+            if self.limit_policy.load().source_generation != source_generation {
+                continue;
+            }
             self.drain_cleanup_queue().await;
             self.maybe_compact_empty_users().await;
         }
@@ -263,6 +266,10 @@ impl UserIpTracker {
     }
 
     pub async fn clear_all(&self) {
+        let mut cleanup_drain_guards = Vec::with_capacity(USER_IP_TRACKER_SHARDS);
+        for drain_lock in self.cleanup_drain_locks.iter() {
+            cleanup_drain_guards.push(drain_lock.lock().await);
+        }
         for shard_lock in self.shards.iter() {
             let mut shard = shard_lock.write().await;
             shard.active_ips.clear();
@@ -271,16 +278,24 @@ impl UserIpTracker {
         }
         self.active_entry_count.store(0, Ordering::Relaxed);
         self.recent_entry_count.store(0, Ordering::Relaxed);
+        let mut cleanup_queue_guards = Vec::with_capacity(USER_IP_TRACKER_SHARDS);
         for cleanup_shard in self.cleanup_shards.iter() {
-            match cleanup_shard.queue.lock() {
-                Ok(mut queue) => queue.clear(),
+            let queue = match cleanup_shard.queue.lock() {
+                Ok(queue) => queue,
                 Err(poisoned) => {
-                    poisoned.into_inner().clear();
+                    let queue = poisoned.into_inner();
                     cleanup_shard.queue.clear_poison();
+                    queue
                 }
-            }
+            };
+            cleanup_queue_guards.push(queue);
+        }
+        for queue in cleanup_queue_guards.iter_mut() {
+            queue.clear();
         }
         self.cleanup_queue_len.store(0, Ordering::Relaxed);
+        drop(cleanup_queue_guards);
+        drop(cleanup_drain_guards);
     }
 
     pub async fn is_ip_active(&self, username: &str, ip: IpAddr) -> bool {
```

**File**: `src/ip_tracker/tests.rs` (modified, +79/-4)
```diff
@@ -3,6 +3,8 @@ use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
 use std::sync::atomic::AtomicBool;
 use std::sync::atomic::Ordering;
 
+mod cleanup_invariants;
+
 fn test_ipv4(oct1: u8, oct2: u8, oct3: u8, oct4: u8) -> IpAddr {
     IpAddr::V4(Ipv4Addr::new(oct1, oct2, oct3, oct4))
 }
@@ -266,6 +268,82 @@ async fn test_load_limits_replaces_previous_map() {
     assert_eq!(tracker.get_user_limit("user2").await, Some(5));
 }
 
+#[tokio::test]
+async fn stale_runtime_cannot_overwrite_newer_ip_policy() {
+    let tracker = UserIpTracker::new();
+    let mut newer = HashMap::new();
+    newer.insert("alice".to_string(), 5);
+    assert!(
+        tracker
+            .apply_policy_from_source(
+                2,
+                7,
+                &newer,
+                UserMaxUniqueIpsMode::Combined,
+                90,
+            )
+            .await
+    );
+
+    let mut stale = HashMap::new();
+    stale.insert("alice".to_string(), 1);
+    assert!(
+        !tracker
+            .apply_policy_from_source(
+                1,
+                1,
+                &stale,
+                UserMaxUniqueIpsMode::ActiveWindow,
+                1,
+            )
+            .await
+    );
+
+    let policy = tracker.limit_policy.load_full();
+    assert_eq!(policy.source_generation, 2);
+    assert_eq!(policy.default_max_ips, 7);
+    assert_eq!(policy.max_ips["alice"], 5);
+    assert_eq!(policy.mode, UserMaxUniqueIpsMode::Combined);
+    assert_eq!(policy.window_secs, 90);
+}
+
+#[tokio::test]
+async fn active_runtime_can_publish_coherent_same_generation_ip_policy() {
+    let tracker = UserIpTracker::new();
+    assert!(
+        tracker
+            .apply_policy_from_source(
+                3,
+                1,
+                &HashMap::new(),
+                UserMaxUniqueIpsMode::ActiveWindow,
+                10,
+            )
+            .await
+    );
+    let mut limits = HashMap::new();
+    limits.insert("alice".to_string(), 4);
+
+    assert!(
+        tracker
+            .apply_policy_from_source(
+                3,
+                6,
+                &limits,
+                UserMaxUniqueIpsMode::TimeWindow,
+                30,
+            )
+            .await
+    );
+
+    let policy = tracker.limit_policy.load_full();
+    assert_eq!(policy.source_generation, 3);
+    assert_eq!(policy.default_max_ips, 6);
+    assert_eq!(policy.max_ips["alice"], 4);
+    assert_eq!(policy.mode, UserMaxUniqueIpsMode::TimeWindow);
+    assert_eq!(policy.window_secs, 30);
+}
+
 #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
 async fn concurrent_policy_replacement_never_exposes_partial_limit_map() {
     const USER_COUNT: usize = 4_096;
@@ -437,10 +515,7 @@ async fn test_compact_prunes_stale_recent_entries() {
     }
 
     tracker.last_compact_epoch_secs.store(0, Ordering::Relaxed);
-    tracker
-        .check_and_add("trigger-user", test_ipv4(10, 3, 0, 2))
-        .await
-        .unwrap();
+    tracker.maybe_compact_empty_users().await;
 
     let shard_idx = UserIpTracker::shard_idx(&stale_user);
     let shard = tracker.shards[shard_idx].read().await;
```

---

### Incident Patch 7: `baa9bfbb` (2026-09-22)
**Commit Message**: ME Authority + Quota Resets + WEB Replacement Rollback fixes

**File**: `src/quota_state.rs` (modified, +2/-3)
```diff
@@ -104,14 +104,13 @@ impl QuotaStateOwner {
             used_bytes: 0,
             last_reset_epoch_secs,
         };
+        let reset_target = self.store.current_or_legacy_handle(user);
         let state = self.state_for_users(configured_users, Some((user, prospective.clone())));
         let path = self.path.clone();
-        let store = Arc::clone(&self.store);
-        let user = user.to_string();
         let task = tokio::task::spawn_blocking(move || {
             let _guard = guard;
             write_state_file_blocking(&path, &state)?;
-            Ok(store.reset(&user, last_reset_epoch_secs))
+            Ok(reset_target.reset(last_reset_epoch_secs))
         });
         wait_for_blocking_io(task).await
     }
```

**File**: `src/stats/quota_store.rs` (modified, +26/-6)
```diff
@@ -213,12 +213,7 @@ impl QuotaStore {
     }
 
     pub(crate) fn reset(&self, user: &str, now_epoch_secs: u64) -> UserQuotaSnapshot {
-        let state = self.current_or_legacy_handle(user);
-        state.counters.replace(0, now_epoch_secs);
-        UserQuotaSnapshot {
-            used_bytes: 0,
-            last_reset_epoch_secs: now_epoch_secs,
-        }
+        self.current_or_legacy_handle(user).reset(now_epoch_secs)
     }
 
     pub(crate) fn remove(&self, user: &str) {
@@ -359,6 +354,15 @@ impl UserQuotaHandle {
     ) -> Result<QuotaReservation, QuotaReserveError> {
         self.counters.try_reserve(bytes, limit)
     }
+
+    /// Resets only the quota incarnation captured by this handle.
+    pub(crate) fn reset(&self, now_epoch_secs: u64) -> UserQuotaSnapshot {
+        self.counters.replace(0, now_epoch_secs);
+        UserQuotaSnapshot {
+            used_bytes: 0,
+            last_reset_epoch_secs: now_epoch_secs,
+        }
+    }
 }
 
 impl QuotaReservation {
@@ -497,6 +501,22 @@ mod tests {
         assert_eq!(current.used(), 40);
     }
 
+    #[test]
+    fn captured_reset_handle_cannot_reset_a_new_incarnation() {
+        let store = QuotaStore::default();
+        store.activate_fresh("alice", 1);
+        let reset_target = store.handle_exact("alice", 1).unwrap();
+        reset_target.charge(40);
+        store.advance_preserving_usage("alice", 2);
+        let current = store.handle_exact("alice", 2).unwrap();
+        current.charge(20);
+
+        reset_target.reset(7);
+
+        assert_eq!(reset_target.used(), 0);
+        assert_eq!(current.used(), 60);
+    }
+
     #[test]
     fn stale_retirement_cannot_remove_newer_quota_owner() {
         let store = QuotaStore::default();
```

**File**: `src/transport/middle_proxy/health/family.rs` (modified, +2/-0)
```diff
@@ -26,6 +26,7 @@ pub(super) async fn check_family(
 
     let mut dc_endpoints = HashMap::<i32, Vec<SocketAddr>>::new();
     let endpoint_snapshot = pool.endpoint_snapshot.load();
+    let endpoint_revision = endpoint_snapshot.revision;
     let map_guard = match family {
         IpFamily::V4 => &endpoint_snapshot.map_v4,
         IpFamily::V6 => &endpoint_snapshot.map_v6,
@@ -253,6 +254,7 @@ pub(super) async fn check_family(
                 dc,
                 family,
                 generation: pool.current_generation(),
+                endpoint_revision,
                 contour: WriterContour::Active,
             })
             .await
```

**File**: `src/transport/middle_proxy/pool.rs` (modified, +3/-0)
```diff
@@ -37,6 +37,8 @@ pub(super) struct RefillTargetKey {
     pub family: IpFamily,
     /// Generation that retains publication authority.
     pub generation: u64,
+    /// Endpoint snapshot revision targeted by this refill producer.
+    pub endpoint_revision: u64,
     /// Lifecycle contour that the replacement must preserve.
     pub contour: WriterContour,
 }
@@ -310,6 +312,7 @@ pub(super) struct ReinitStatusSnapshot {
     pub(super) pending_hardswap_generation: u64,
     pub(super) pending_hardswap_started_at_epoch_secs: u64,
     pub(super) pending_hardswap_map_hash: u64,
+    pub(super) pending_hardswap_endpoint_revision: u64,
     pub(super) inflight: usize,
 }
 
```

**File**: `src/transport/middle_proxy/pool/construction.rs` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ impl MePool {
             pending_hardswap_generation: 0,
             pending_hardswap_started_at_epoch_secs: 0,
             pending_hardswap_map_hash: 0,
+            pending_hardswap_endpoint_revision: 0,
             inflight: 0,
         };
         stats.set_me_writer_byte_budget_limit_bytes(me_writer_byte_budget_bytes);
```

**File**: `src/transport/middle_proxy/pool/routing.rs` (modified, +32/-0)
```diff
@@ -1,5 +1,37 @@
 use super::*;
 
+impl EndpointSnapshot {
+    /// Returns authoritative configured endpoints for one exact DC and address family.
+    pub(in crate::transport::middle_proxy) fn endpoints_for_dc_family(
+        &self,
+        dc: i32,
+        family: IpFamily,
+    ) -> &[(IpAddr, u16)] {
+        match family {
+            IpFamily::V4 => self.map_v4.get(&dc),
+            IpFamily::V6 => self.map_v6.get(&dc),
+        }
+        .map(Vec::as_slice)
+        .unwrap_or_default()
+    }
+
+    /// Checks control-plane membership without applying data-plane family preference.
+    pub(in crate::transport::middle_proxy) fn contains_dc_endpoint(
+        &self,
+        dc: i32,
+        endpoint: SocketAddr,
+    ) -> bool {
+        let family = if endpoint.is_ipv4() {
+            IpFamily::V4
+        } else {
+            IpFamily::V6
+        };
+        self.endpoints_for_dc_family(dc, family)
+            .iter()
+            .any(|(ip, port)| *ip == endpoint.ip() && *port == endpoint.port())
+    }
+}
+
 impl MePool {
     pub(in crate::transport::middle_proxy) fn single_endpoint_outage_mode_enabled(&self) -> bool {
         self.single_endpoint_runtime
```

**File**: `src/transport/middle_proxy/pool/writer_admission.rs` (modified, +17/-12)
```diff
@@ -65,7 +65,7 @@ impl MePool {
     pub(in crate::transport::middle_proxy) async fn active_coverage_required_total(&self) -> usize {
         let now_epoch_secs = Self::now_epoch_secs();
         let mut required_total = 0usize;
-        let endpoint_snapshot = self.endpoint_snapshot.load();
+        let endpoint_snapshot = self.endpoint_snapshot.load_full();
 
         if self.family_enabled_for_drain_coverage(IpFamily::V4, now_epoch_secs) {
             for addrs in endpoint_snapshot.map_v4.values() {
@@ -100,11 +100,21 @@ impl MePool {
         contour: WriterContour,
         intent: WriterOpenIntent,
         writer_dc: i32,
-        family: IpFamily,
+        target_addr: SocketAddr,
     ) -> bool {
         if intent == WriterOpenIntent::Replacement {
             return true;
         }
+        let family = if target_addr.is_ipv4() {
+            IpFamily::V4
+        } else {
+            IpFamily::V6
+        };
+        let endpoint_snapshot = self.endpoint_snapshot.load_full();
+        let endpoints = endpoint_snapshot.endpoints_for_dc_family(writer_dc, family);
+        if !endpoint_snapshot.contains_dc_endpoint(writer_dc, target_addr) {
+            return false;
+        }
         let (active_writers, warm_writers, _) = self.non_draining_writer_counts_by_contour().await;
         let live = match contour {
             WriterContour::Active => active_writers,
@@ -123,13 +133,7 @@ impl MePool {
             return false;
         }
 
-        let endpoint_snapshot = self.endpoint_snapshot.load();
-        let endpoint_count = match family {
-            IpFamily::V4 => endpoint_snapshot.map_v4.get(&writer_dc),
-            IpFamily::V6 => endpoint_snapshot.map_v6.get(&writer_dc),
-        }
-        .map(Vec::len)
-        .unwrap_or(0);
+        let endpoint_count = endpoints.len();
         if endpoint_count == 0 {
             return false;
         }
@@ -150,14 +154,15 @@ impl MePool {
                         && writer.generation == generation
                         && WriterContour::from_u8(writer.contour.load(Ordering::Relaxed)) == contour
                         && writer.addr.is_ipv4() == (family == IpFamily::V4)
+                        && endpoint_snapshot.contains_dc_endpoint(writer_dc, writer.addr)
                 })
                 .count()
         };
         if family_count < required {
             return true;
         }
 
-        live < self.active_coverage_required_total().await
+        false
     }
 
     /// Reserves bounded transient capacity for a writer open attempt.
@@ -166,7 +171,7 @@ impl MePool {
         contour: WriterContour,
         intent: WriterOpenIntent,
         writer_dc: i32,
-        family: IpFamily,
+        target_addr: SocketAddr,
     ) -> Option<WriterOpenReservation<'_>> {
         let counter = match contour {
             WriterContour::Active => &self.writer_connect_active_reserved,
@@ -221,7 +226,7 @@ impl MePool {
 
         loop {
             if !self
-                .can_open_writer_for_contour(contour, intent, writer_dc, family)
+                .can_open_writer_for_contour(contour, intent, writer_dc, target_addr)
                 .await
             {
                 return None;
```

**File**: `src/transport/middle_proxy/pool_refill.rs` (modified, +30/-16)
```diff
@@ -26,6 +26,13 @@ enum RefillOutcome {
     Obsolete,
 }
 
+fn refill_open_intent(contour: WriterContour) -> WriterOpenIntent {
+    match contour {
+        WriterContour::Active | WriterContour::Warm => WriterOpenIntent::Coverage,
+        WriterContour::Draining => WriterOpenIntent::Normal,
+    }
+}
+
 struct RefillRunGuard {
     pool: Arc<MePool>,
     key: RefillTargetKey,
@@ -293,18 +300,15 @@ impl MePool {
                 && target.generation == status.pending_hardswap_generation,
             WriterContour::Draining => false,
         };
+        let pending_revision_matches = target.contour != WriterContour::Warm
+            || target.endpoint_revision == status.pending_hardswap_endpoint_revision;
+        let endpoint_snapshot = self.endpoint_snapshot.load();
         role_is_authoritative
-            && self
-                .endpoint_snapshot
-                .load()
-                .preferred_endpoints_by_dc
-                .get(&target.dc)
-                .is_some_and(|endpoints| {
-                    endpoints.iter().any(|endpoint| match target.family {
-                        IpFamily::V4 => endpoint.is_ipv4(),
-                        IpFamily::V6 => endpoint.is_ipv6(),
-                    })
-                })
+            && pending_revision_matches
+            && target.endpoint_revision == endpoint_snapshot.revision
+            && !endpoint_snapshot
+                .endpoints_for_dc_family(target.dc, target.family)
+                .is_empty()
     }
 
     async fn refill_writer_after_loss(
@@ -315,11 +319,7 @@ impl MePool {
         if !self.refill_target_is_authoritative(target) {
             return RefillOutcome::Obsolete;
         }
-        let open_intent = if target.contour == WriterContour::Active {
-            WriterOpenIntent::Coverage
-        } else {
-            WriterOpenIntent::Normal
-        };
+        let open_intent = refill_open_intent(target.contour);
         let fast_retries = self.reconnect_runtime.me_reconnect_fast_retry_count.max(1);
         let mut total_attempts = 0u32;
         let same_endpoint_quarantined = self.is_endpoint_quarantined(addr).await;
@@ -455,6 +455,7 @@ impl MePool {
             dc: role.dc,
             family: role.family,
             generation: role.generation,
+            endpoint_revision: self.endpoint_snapshot.load().revision,
             contour: role.contour,
         };
         if !self.refill_target_is_authoritative(target) {
@@ -517,3 +518,16 @@ impl MePool {
             });
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn warm_refill_preserves_required_floor_coverage() {
+        assert_eq!(
+            refill_open_intent(WriterContour::Warm),
+            WriterOpenIntent::Coverage
+        );
+    }
+}
```

---

### Incident Patch 8: `d706b3f3` (2026-09-19)
**Commit Message**: Hardswap Invariants in tests + Quota fixes

**File**: `src/api/config_edit.rs` (modified, +19/-3)
```diff
@@ -62,6 +62,21 @@ pub(super) async fn patch_config(
     expected_revision: Option<String>,
     reload_request: Option<ReloadRequest>,
     shared: &ApiShared,
+) -> Result<PatchConfigResponse, ApiFailure> {
+    let shared = shared.clone();
+    shared
+        .clone()
+        .run_mutation_completion(async move {
+            patch_config_to_completion(patch_json, expected_revision, reload_request, &shared).await
+        })
+        .await
+}
+
+async fn patch_config_to_completion(
+    patch_json: Json,
+    expected_revision: Option<String>,
+    reload_request: Option<ReloadRequest>,
+    shared: &ApiShared,
 ) -> Result<PatchConfigResponse, ApiFailure> {
     let _guard = shared.mutation_lock.lock().await;
     let active_config = shared.active_runtime.load_full().config();
@@ -83,7 +98,7 @@ pub(super) async fn patch_config(
     } else {
         None
     };
-    write_atomic_if_unchanged(
+    prepared.response.revision = write_atomic_if_unchanged(
         prepared.config_path,
         prepared.expected_revision,
         prepared.owner_path,
@@ -123,15 +138,16 @@ pub(super) async fn apply_patch_to_path(
     patch_json: &Json,
     expected_revision: Option<String>,
 ) -> Result<PatchConfigResponse, ApiFailure> {
-    let prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
-    write_atomic_if_unchanged(
+    let mut prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
+    let revision = write_atomic_if_unchanged(
         prepared.config_path,
         prepared.expected_revision,
         prepared.owner_path,
         prepared.expected_owner_contents,
         prepared.owner_contents,
     )
     .await?;
+    prepared.response.revision = revision;
     Ok(prepared.response)
 }
 
```

**File**: `src/api/config_store/atomic.rs` (modified, +90/-9)
```diff
@@ -31,16 +31,22 @@ struct ExistingTarget {
     metadata: std::fs::Metadata,
 }
 
+struct GraphFence<'a> {
+    config_path: &'a Path,
+    expected_revision: &'a str,
+}
+
 struct ConfigWriteLock {
     #[cfg(unix)]
     _file: Flock<File>,
 }
 
 impl ConfigWriteLock {
     fn acquire(path: &Path) -> std::io::Result<Self> {
+        let path = normalize_path(path);
         #[cfg(unix)]
         {
-            let lock_path = sibling_lock_path(path);
+            let lock_path = sibling_lock_path(&path);
             let anchored = AnchoredPath::open_creating_parents(&lock_path, 0o750)?;
             let descriptor = openat(
                 anchored.parent(),
@@ -76,7 +82,7 @@ pub(in crate::api) async fn write_atomic(
 ) -> Result<(), ApiFailure> {
     tokio::task::spawn_blocking(move || {
         let _lock = ConfigWriteLock::acquire(&path)?;
-        write_atomic_sync(&path, None, &contents)
+        write_atomic_sync(&path, None, &contents, None).map(|_| ())
     })
         .await
         .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
@@ -90,21 +96,37 @@ pub(in crate::api) async fn write_atomic_if_unchanged(
     path: PathBuf,
     expected_contents: String,
     contents: String,
-) -> Result<(), ApiFailure> {
+) -> Result<String, ApiFailure> {
     tokio::task::spawn_blocking(move || {
+        let config_path = normalize_path(&config_path);
+        let path = normalize_path(&path);
         // Every API mutation locks the root source so writes to different includes serialize.
         let _lock = ConfigWriteLock::acquire(&config_path).map_err(AtomicWriteError::Io)?;
         let graph = ProxyConfig::read_source_graph(&config_path)
             .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
         if compute_source_revision(&graph) != expected_revision {
             return Err(AtomicWriteError::Conflict);
         }
-        write_atomic_sync(&path, Some(&expected_contents), &contents).map_err(|error| {
+        write_atomic_sync(
+            &path,
+            Some(&expected_contents),
+            &contents,
+            Some(GraphFence {
+                config_path: &config_path,
+                expected_revision: &expected_revision,
+            }),
+        )
+        .map_err(|error| {
             if error.kind() == std::io::ErrorKind::AlreadyExists {
                 AtomicWriteError::Conflict
             } else {
                 AtomicWriteError::Io(error)
             }
+        })?
+        .ok_or_else(|| {
+            AtomicWriteError::Io(std::io::Error::other(
+                "config graph fence did not produce a committed revision",
+            ))
         })
     })
     .await
@@ -137,6 +159,51 @@ fn sibling_lock_path(path: &Path) -> PathBuf {
     path.parent().unwrap_or_else(|| Path::new(".")).join(name)
 }
 
+fn normalize_path(path: &Path) -> PathBuf {
+    let absolute = if path.is_absolute() {
+        path.to_path_buf()
+    } else {
+        std::env::current_dir()
+            .map(|current| current.join(path))
+            .unwrap_or_else(|_| path.to_path_buf())
+    };
+    let mut normalized = PathBuf::new();
+    for component in absolute.components() {
+        match component {
+            std::path::Component::CurDir => {}
+            std::path::Component::ParentDir => {
+                normalized.pop();
+            }
+            component => normalized.push(component.as_os_str()),
+        }
+    }
+    normalized
+}
+
+fn fenced_post_commit_revision(
+    fence: GraphFence<'_>,
+    path: &Path,
+    contents: &str,
+) -> std::io::Result<String> {
+    let mut graph = ProxyConfig::read_source_graph(fence.config_path)
+        .map_err(|error| std::io::Error::other(error.to_string()))?;
+    if compute_source_revision(&graph) != fence.expected_revision {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::AlreadyExists,
+            "config graph changed during persistence",
+        ));
+    }
+    let path = normalize_path(path);
+    let Some(owner) = graph.source_contents.get_mut(&path) else {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::InvalidInput,
+            "config source owner left the source graph during persistence",
+        ));
+    };
+    *owner = contents.to_string();
+    Ok(compute_source_revision(&graph))
+}
+
 #[cfg(unix)]
 fn open_existing_target(anchored: &AnchoredPath) -> std::io::Result<Option<ExistingTarget>> {
     let descriptor = match openat(
@@ -210,7 +277,8 @@ fn write_atomic_sync(
     path: &Path,
     expected_contents: Option<&str>,
     contents: &str,
-) -> std::io::Result<()> {
+    graph_fence: Option<GraphFence<'_>>,
+) -> std::io::Result<Option<String>> {
     let anchored = AnchoredPath::open_creating_parents(path, 0o750)?;
     let existing = open_existing_target(&anchored)?;
     validate_expected_contents(existing.as_ref(), expected_contents)?;
@@ -234,10 +302,12 @@ fn write_atomic_sync(
     .
```

**File**: `src/api/config_store/persistence.rs` (modified, +2/-2)
```diff
@@ -159,8 +159,8 @@ pub(in crate::api) async fn save_access_sections_to_disk_if_revision(
         owner_contents.clone(),
     )
     .await?;
-    let revision = compute_snapshot_revision(&candidate);
-    write_atomic_if_unchanged(
+    let _candidate_revision = compute_snapshot_revision(&candidate);
+    let revision = write_atomic_if_unchanged(
         config_path.to_path_buf(),
         loaded_revision,
         owner_path,
```

**File**: `src/api/handler/user_routes.rs` (modified, +46/-29)
```diff
@@ -133,38 +133,55 @@ pub(super) async fn handle(
             ));
         }
         let expected_revision = parse_if_match(req.headers());
-        let _mutation_guard = shared.mutation_lock.lock().await;
-        let (disk_cfg, _) =
-            load_config_for_mutation(&shared.config_path, expected_revision.as_deref()).await?;
-        if !disk_cfg.access.users.contains_key(user) {
-            return Ok(error_response(
-                request_id,
-                ApiFailure::new(StatusCode::NOT_FOUND, "not_found", "User not found"),
-            ));
-        }
-        let configured_users = disk_cfg
-            .access
-            .users
-            .keys()
-            .cloned()
-            .collect::<BTreeSet<_>>();
-        let snapshot = match shared.quota_state.reset_user(&configured_users, user).await {
-            Ok(snapshot) => snapshot,
-            Err(error) => {
-                shared.runtime_events.record(
-                    "api.user.reset_quota.failed",
-                    format!("username={} error={}", user, error),
+        let completion_shared = shared.as_ref().clone();
+        let user_owned = user.to_string();
+        let completion = shared
+            .run_mutation_completion(async move {
+                let _mutation_guard = completion_shared.mutation_lock.lock().await;
+                let (disk_cfg, _) = load_config_for_mutation(
+                    &completion_shared.config_path,
+                    expected_revision.as_deref(),
+                )
+                .await?;
+                if !disk_cfg.access.users.contains_key(&user_owned) {
+                    return Err(ApiFailure::new(
+                        StatusCode::NOT_FOUND,
+                        "not_found",
+                        "User not found",
+                    ));
+                }
+                let configured_users = disk_cfg
+                    .access
+                    .users
+                    .keys()
+                    .cloned()
+                    .collect::<BTreeSet<_>>();
+                let snapshot = completion_shared
+                    .quota_state
+                    .reset_user(&configured_users, &user_owned)
+                    .await
+                    .map_err(|error| {
+                        completion_shared.runtime_events.record(
+                            "api.user.reset_quota.failed",
+                            format!("username={} error={}", user_owned, error),
+                        );
+                        ApiFailure::internal(format!("Failed to reset user quota: {}", error))
+                    })?;
+                completion_shared.runtime_events.record(
+                    "api.user.reset_quota.ok",
+                    format!("username={}", user_owned),
                 );
-                return Err(ApiFailure::internal(format!(
-                    "Failed to reset user quota: {}",
-                    error
-                )));
+                let revision = current_revision(&completion_shared.config_path).await?;
+                Ok((snapshot, revision))
+            })
+            .await;
+        let (snapshot, revision) = match completion {
+            Ok(result) => result,
+            Err(error) if error.code == "not_found" => {
+                return Ok(error_response(request_id, error));
             }
+            Err(error) => return Err(error),
         };
-        shared
-            .runtime_events
-            .record("api.user.reset_quota.ok", format!("username={}", user));
-        let revision = current_revision(&shared.config_path).await?;
         return Ok(success_response(
             StatusCode::OK,
             ResetUserQuotaResponse {
```

**File**: `src/api/mod.rs` (modified, +27/-1)
```diff
@@ -17,7 +17,7 @@ use hyper::service::service_fn;
 use hyper::{Method, Request, Response, StatusCode};
 use subtle::ConstantTimeEq;
 use tokio::net::TcpListener;
-use tokio::sync::{Mutex, RwLock, Semaphore, watch};
+use tokio::sync::{Mutex, RwLock, Semaphore, oneshot, watch};
 use tokio::time::timeout;
 use tracing::{debug, info, warn};
 
@@ -134,6 +134,7 @@ pub(super) struct ApiShared {
     pub(super) active_runtime: Arc<ArcSwap<RuntimeGeneration>>,
     pub(super) web_trace: Arc<WebTraceStore>,
     pub(super) web_runtime_rx: watch::Receiver<WebRuntimePublication>,
+    pub(super) control_plane: ProcessControlPlane,
 }
 
 impl ApiShared {
@@ -169,8 +170,32 @@ impl ApiShared {
             active_runtime: self.active_runtime.clone(),
             web_trace: self.web_trace.clone(),
             web_runtime_rx: self.web_runtime_rx.clone(),
+            control_plane: self.control_plane.clone(),
         }
     }
+
+    /// Keeps an accepted mutation alive until persistence and mandatory publication finish.
+    async fn run_mutation_completion<T, F>(&self, future: F) -> Result<T, ApiFailure>
+    where
+        T: Send + 'static,
+        F: std::future::Future<Output = Result<T, ApiFailure>> + Send + 'static,
+    {
+        let (result_tx, result_rx) = oneshot::channel();
+        self.control_plane
+            .spawn_completion(async move {
+                let _ = result_tx.send(future.await);
+            })
+            .map_err(|_| {
+                ApiFailure::new(
+                    StatusCode::SERVICE_UNAVAILABLE,
+                    "control_plane_shutting_down",
+                    "Control plane is shutting down",
+                )
+            })?;
+        result_rx.await.map_err(|_| {
+            ApiFailure::internal("accepted config mutation did not report completion")
+        })?
+    }
 }
 
 fn auth_header_matches(actual: &str, expected: &str) -> bool {
@@ -364,6 +389,7 @@ pub(crate) async fn serve(
         active_runtime,
         web_trace,
         web_runtime_rx,
+        control_plane: control_plane.clone(),
     });
 
     spawn_runtime_watchers(
```

**File**: `src/api/users.rs` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ use hyper::StatusCode;
 use crate::config::ProxyConfig;
 use crate::config::RateLimitBps;
 use crate::ip_tracker::UserIpTracker;
+use crate::proxy::user_admission::credential_id_from_hex;
 use crate::stats::Stats;
 
 use super::ApiShared;
```

**File**: `src/api/users/create.rs` (modified, +19/-4)
```diff
@@ -4,6 +4,20 @@ pub(in crate::api) async fn create_user(
     body: CreateUserRequest,
     expected_revision: Option<String>,
     shared: &ApiShared,
+) -> Result<(CreateUserResponse, String), ApiFailure> {
+    let shared = shared.clone();
+    shared
+        .clone()
+        .run_mutation_completion(async move {
+            create_user_to_completion(body, expected_revision, &shared).await
+        })
+        .await
+}
+
+async fn create_user_to_completion(
+    body: CreateUserRequest,
+    expected_revision: Option<String>,
+    shared: &ApiShared,
 ) -> Result<(CreateUserResponse, String), ApiFailure> {
     let touches_user_ad_tags = body.user_ad_tag.is_some();
     let touches_user_max_tcp_conns = body.max_tcp_conns.is_some();
@@ -41,6 +55,8 @@ pub(in crate::api) async fn create_user(
     }
 
     let expiration = parse_optional_expiration(body.expiration_rfc3339.as_deref())?;
+    let credential_id = credential_id_from_hex(&secret)
+        .ok_or_else(|| ApiFailure::internal("validated user secret could not be decoded"))?;
     let _guard = shared.mutation_lock.lock().await;
     let (mut cfg, base_revision) =
         load_config_for_mutation(&shared.config_path, expected_revision.as_deref()).await?;
@@ -131,12 +147,11 @@ pub(in crate::api) async fn create_user(
     .await?;
     shared
         .proxy_shared
-        .stage_user(
+        .stage_user_credential(
             &body.username,
-            &secret,
+            credential_id,
             cfg.access.is_user_enabled(&body.username),
-        )
-        .ok_or_else(|| ApiFailure::internal("failed to stage user admission policy"))?;
+        );
 
     if let Some(limit) = updated_limit {
         shared
```

**File**: `src/api/users/lifecycle.rs` (modified, +34/-2)
```diff
@@ -6,13 +6,31 @@ pub(in crate::api) async fn rotate_secret(
     body: RotateSecretRequest,
     expected_revision: Option<String>,
     shared: &ApiShared,
+) -> Result<(CreateUserResponse, String), ApiFailure> {
+    let shared = shared.clone();
+    let user = user.to_string();
+    shared
+        .clone()
+        .run_mutation_completion(async move {
+            rotate_secret_to_completion(&user, body, expected_revision, &shared).await
+        })
+        .await
+}
+
+async fn rotate_secret_to_completion(
+    user: &str,
+    body: RotateSecretRequest,
+    expected_revision: Option<String>,
+    shared: &ApiShared,
 ) -> Result<(CreateUserResponse, String), ApiFailure> {
     let secret = body.secret.unwrap_or_else(random_user_secret);
     if !is_valid_user_secret(&secret) {
         return Err(ApiFailure::bad_request(
             "secret must be exactly 32 hex characters",
         ));
     }
+    let credential_id = credential_id_from_hex(&secret)
+        .ok_or_else(|| ApiFailure::internal("validated user secret could not be decoded"))?;
 
     let _guard = shared.mutation_lock.lock().await;
     let (mut cfg, base_revision) =
@@ -38,8 +56,7 @@ pub(in crate::api) async fn rotate_secret(
     .await?;
     shared
         .proxy_shared
-        .stage_user(user, &secret, cfg.access.is_user_enabled(user))
-        .ok_or_else(|| ApiFailure::internal("failed to stage rotated user credential"))?;
+        .stage_user_credential(user, credential_id, cfg.access.is_user_enabled(user));
     drop(_guard);
 
     let (detected_ip_v4, detected_ip_v6) = shared.detected_link_ips();
@@ -70,6 +87,21 @@ pub(in crate::api) async fn delete_user(
     user: &str,
     expected_revision: Option<String>,
     shared: &ApiShared,
+) -> Result<(String, String), ApiFailure> {
+    let shared = shared.clone();
+    let user = user.to_string();
+    shared
+        .clone()
+        .run_mutation_completion(async move {
+            delete_user_to_completion(&user, expected_revision, &shared).await
+        })
+        .await
+}
+
+async fn delete_user_to_completion(
+    user: &str,
+    expected_revision: Option<String>,
+    shared: &ApiShared,
 ) -> Result<(String, String), ApiFailure> {
     let _guard = shared.mutation_lock.lock().await;
     let (mut cfg, base_revision) =
```

---

### Incident Patch 9: `89dacbd1` (2026-09-19)
**Commit Message**: TOCTOU and lifecycle races across runtime boundaries fixes

**File**: `src/cli/init.rs` (modified, +14/-5)
```diff
@@ -3,6 +3,8 @@ use std::process::Command;
 
 use rand::RngExt;
 
+use crate::util::trusted_command::resolve_trusted_helper;
+
 /// Options for the fire-and-forget init command.
 #[derive(Debug, Clone)]
 pub struct InitOptions {
@@ -165,11 +167,14 @@ pub fn run_init(opts: InitOptions) -> Result<(), Box<dyn std::error::Error>> {
                 eprintln!("[+] Service started");
 
                 std::thread::sleep(std::time::Duration::from_secs(1));
-                let status = Command::new("systemctl")
-                    .args(["is-active", "telemt.service"])
-                    .output();
+                let status = resolve_trusted_helper("systemctl").and_then(|command_path| {
+                    Command::new(command_path)
+                        .args(["is-active", "telemt.service"])
+                        .output()
+                        .ok()
+                });
                 match status {
-                    Ok(out) if out.status.success() => {
+                    Some(out) if out.status.success() => {
                         eprintln!("[+] Service is running");
                     }
                     _ => {
@@ -329,7 +334,11 @@ weight = 10
 }
 
 fn run_cmd(cmd: &str, args: &[&str]) {
-    match Command::new(cmd).args(args).output() {
+    let Some(command_path) = resolve_trusted_helper(cmd) else {
+        eprintln!("[!] Refusing unavailable or untrusted command: {}", cmd);
+        return;
+    };
+    match Command::new(command_path).args(args).output() {
         Ok(output) => {
             if !output.status.success() {
                 let stderr = String::from_utf8_lossy(&output.stderr);
```

**File**: `src/config/load/runtime_auth.rs` (modified, +2/-0)
```diff
@@ -117,12 +117,14 @@ impl UserAuthSnapshot {
         self.entries.get(idx)
     }
 
+    /// Returns the stable credential identity for an exact configured username.
     pub(crate) fn credential_id_by_name(&self, user: &str) -> Option<[u8; 16]> {
         self.user_id_by_name(user)
             .and_then(|user_id| self.entry_by_id(user_id))
             .map(|entry| entry.credential_id)
     }
 
+    /// Returns every bounded authentication candidate sharing a stable hint key.
     pub(crate) fn candidate_ids_by_hint_key(&self, hint_key: u64) -> Option<&[u32]> {
         self.by_hint_key.get(&hint_key).map(Vec::as_slice)
     }
```

**File**: `src/config/load/runtime_web/static_site_fallback.rs` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ use std::path::Path;
 
 use super::*;
 
+/// Builds a bounded static-site snapshot on platforms without directory descriptors.
 pub(super) fn load_static_site_by_path(
     root: &Path,
     limits: &WebLimitsConfig,
```

**File**: `src/conntrack_control/firewall.rs` (modified, +8/-0)
```diff
@@ -13,6 +13,7 @@ use crate::util::trusted_command::resolve_trusted_helper;
 
 use super::{ConntrackRuntimeSupport, NetfilterBackend};
 
+/// Reconciles kernel NOTRACK rules with the active listener policy.
 pub(super) async fn reconcile_rules(
     cfg: &ProxyConfig,
     runtime_support: ConntrackRuntimeSupport,
@@ -45,6 +46,7 @@ pub(super) async fn reconcile_rules(
     }
 }
 
+/// Probes the effective firewall backend and conntrack deletion capability.
 pub(super) fn probe_runtime_support(
     configured_backend: ConntrackBackend,
 ) -> ConntrackRuntimeSupport {
@@ -55,6 +57,7 @@ pub(super) fn probe_runtime_support(
     }
 }
 
+/// Resolves whether conntrack close publication is usable for this runtime.
 pub(super) fn effective_conntrack_enabled(
     cfg: &ProxyConfig,
     runtime_support: ConntrackRuntimeSupport,
@@ -317,12 +320,17 @@ async fn clear_notrack_rules_all_backends() {
     let _ = run_command("ip6tables", &["-t", "raw", "-X", "TELEMT_NOTRACK"], None).await;
 }
 
+/// Result of one best-effort kernel conntrack deletion.
 pub(super) enum DeleteOutcome {
+    /// The kernel reported successful deletion.
     Deleted,
+    /// No matching conntrack entry existed.
     NotFound,
+    /// The helper was unavailable or returned an unexpected failure.
     Error,
 }
 
+/// Deletes the exact TCP tuple represented by one close event.
 pub(super) async fn delete_conntrack_entry(event: ConntrackCloseEvent) -> DeleteOutcome {
     if !command_exists("conntrack") {
         return DeleteOutcome::Error;
```

**File**: `src/daemon/pid_file.rs` (modified, +37/-10)
```diff
@@ -1,7 +1,7 @@
 use std::ffi::OsStr;
 use std::fs::{self, File};
 use std::io::{self, ErrorKind, Read, Write};
-use std::os::unix::fs::MetadataExt;
+use std::os::unix::fs::{MetadataExt, PermissionsExt};
 #[cfg(target_os = "linux")]
 use std::os::fd::{FromRawFd, OwnedFd};
 use std::path::{Path, PathBuf};
@@ -42,7 +42,7 @@ impl FileIdentity {
 impl PidFile {
     /// Creates a new PID file manager for the given path.
     pub fn new<P: AsRef<Path>>(path: P) -> Self {
-        let path = path.as_ref().to_path_buf();
+        let path = normalize_pid_path(path.as_ref());
         let lock_path = sibling_lock_path(&path);
         Self {
             path,
@@ -209,6 +209,33 @@ fn sibling_lock_path(path: &Path) -> PathBuf {
     lock_path.into()
 }
 
+fn normalize_pid_path(path: &Path) -> PathBuf {
+    let legacy_run = Path::new("/var/run");
+    let Ok(remainder) = path.strip_prefix(legacy_run) else {
+        return path.to_path_buf();
+    };
+    let Ok(var_metadata) = fs::metadata("/var") else {
+        return path.to_path_buf();
+    };
+    let Ok(link_metadata) = fs::symlink_metadata(legacy_run) else {
+        return path.to_path_buf();
+    };
+    let Ok(target) = fs::read_link(legacy_run) else {
+        return path.to_path_buf();
+    };
+    let trusted_var = var_metadata.is_dir()
+        && var_metadata.uid() == 0
+        && var_metadata.permissions().mode() & 0o022 == 0;
+    let trusted_alias = link_metadata.file_type().is_symlink()
+        && link_metadata.uid() == 0
+        && (target == Path::new("/run") || target == Path::new("../run"));
+    if trusted_var && trusted_alias {
+        Path::new("/run").join(remainder)
+    } else {
+        path.to_path_buf()
+    }
+}
+
 fn open_file_at(
     anchor: &AnchoredPath,
     name: &OsStr,
@@ -343,8 +370,8 @@ fn validate_regular_single_link(
 /// Reads a PID from a PID file.
 #[allow(dead_code)]
 pub fn read_pid_file<P: AsRef<Path>>(path: P) -> Result<i32, DaemonError> {
-    let path = path.as_ref();
-    read_pid_file_if_exists(path)?.ok_or_else(|| {
+    let path = normalize_pid_path(path.as_ref());
+    read_pid_file_if_exists(&path)?.ok_or_else(|| {
         DaemonError::PidFile(format!(
             "cannot read {}: file does not exist",
             path.display()
@@ -358,11 +385,11 @@ pub fn signal_pid_file<P: AsRef<Path>>(
     path: P,
     signal: nix::sys::signal::Signal,
 ) -> Result<(), DaemonError> {
-    let path = path.as_ref();
-    let pid = read_pid_file(path)?;
+    let path = normalize_pid_path(path.as_ref());
+    let pid = read_pid_file(&path)?;
     #[cfg(target_os = "linux")]
     let pidfd = open_pidfd(pid)?;
-    if !daemon_lock_is_held(path)? {
+    if !daemon_lock_is_held(&path)? {
         return Err(DaemonError::PidFile(format!(
             "refusing to signal unlocked or stale PID file {}",
             path.display()
@@ -390,10 +417,10 @@ pub enum DaemonStatus {
 /// Checks daemon status without modifying the PID or lock file.
 #[allow(dead_code)]
 pub fn check_status<P: AsRef<Path>>(path: P) -> DaemonStatus {
-    let path = path.as_ref();
-    match read_pid_file_if_exists(path) {
+    let path = normalize_pid_path(path.as_ref());
+    match read_pid_file_if_exists(&path) {
         Ok(Some(pid))
-            if daemon_lock_is_held(path).unwrap_or(false) && is_process_running(pid) =>
+            if daemon_lock_is_held(&path).unwrap_or(false) && is_process_running(pid) =>
         {
             DaemonStatus::Running(pid)
         }
```

**File**: `src/daemon/pid_file/tests.rs` (modified, +19/-0)
```diff
@@ -38,6 +38,25 @@ fn pid_file_remains_send_and_sync() {
     assert_send_sync::<PidFile>();
 }
 
+#[test]
+fn system_var_run_alias_keeps_the_default_pid_path_usable() {
+    let Ok(metadata) = fs::symlink_metadata("/var/run") else {
+        return;
+    };
+    let Ok(target) = fs::read_link("/var/run") else {
+        return;
+    };
+    if !metadata.file_type().is_symlink()
+        || (target != Path::new("/run") && target != Path::new("../run"))
+    {
+        return;
+    }
+
+    let pid_file = PidFile::new("/var/run/telemt.pid");
+
+    assert_eq!(pid_file.path(), Path::new("/run/telemt.pid"));
+}
+
 #[test]
 fn lock_holder_subprocess() {
     let Some(pid_path) = std::env::var_os(HELPER_PID_PATH) else {
```

**File**: `src/maestro/helpers/runtime.rs` (modified, +9/-0)
```diff
@@ -12,6 +12,7 @@ use crate::transport::middle_proxy::{
 
 use super::print_maestro_line;
 
+/// Prints configured MTProxy links through the direct MAESTRO output channel.
 pub(crate) fn print_proxy_links(host: &str, port: u16, config: &ProxyConfig) {
     print_maestro_line(format!("Proxy links ({host})"));
     for user_name in config
@@ -94,6 +95,7 @@ pub(crate) fn print_web_proxy_links(config: &ProxyConfig) {
     }
 }
 
+/// Durably replaces one Beobachten snapshot without following Unix symlinks.
 pub(crate) async fn write_beobachten_snapshot(path: &str, payload: &str) -> std::io::Result<()> {
     #[cfg(unix)]
     {
@@ -115,10 +117,12 @@ pub(crate) async fn write_beobachten_snapshot(path: &str, payload: &str) -> std:
     }
 }
 
+/// Selects a singular or plural display label for one integer value.
 pub(crate) fn unit_label(value: u64, singular: &'static str, plural: &'static str) -> &'static str {
     if value == 1 { singular } else { plural }
 }
 
+/// Formats process uptime into bounded human-readable units and exact seconds.
 pub(crate) fn format_uptime(total_secs: u64) -> String {
     const SECS_PER_MINUTE: u64 = 60;
     const SECS_PER_HOUR: u64 = 60 * SECS_PER_MINUTE;
@@ -172,6 +176,7 @@ pub(crate) fn format_uptime(total_secs: u64) -> String {
 }
 
 #[allow(dead_code)]
+/// Waits until admission opens or its watch channel closes.
 pub(crate) async fn wait_until_admission_open(admission_rx: &mut watch::Receiver<bool>) -> bool {
     loop {
         if *admission_rx.borrow() {
@@ -183,10 +188,12 @@ pub(crate) async fn wait_until_admission_open(admission_rx: &mut watch::Receiver
     }
 }
 
+/// Classifies peer closure that is expected during an incomplete handshake.
 pub(crate) fn is_expected_handshake_eof(err: &crate::error::ProxyError) -> bool {
     expected_handshake_close_description(err).is_some()
 }
 
+/// Returns a stable diagnostic description for transport-level peer closure.
 pub(crate) fn peer_close_description(err: &crate::error::ProxyError) -> Option<&'static str> {
     fn from_kind(kind: std::io::ErrorKind) -> Option<&'static str> {
         match kind {
@@ -209,6 +216,7 @@ pub(crate) fn peer_close_description(err: &crate::error::ProxyError) -> Option<&
     }
 }
 
+/// Returns a stable diagnostic description for expected handshake closure.
 pub(crate) fn expected_handshake_close_description(
     err: &crate::error::ProxyError,
 ) -> Option<&'static str> {
@@ -243,6 +251,7 @@ pub(crate) fn expected_handshake_close_description(
     }
 }
 
+/// Loads a non-empty startup endpoint snapshot with bounded cache fallback.
 pub(crate) async fn load_startup_proxy_config_snapshot(
     url: &str,
     cache_path: Option<&str>,
```

**File**: `src/metrics/render/me_hardswap.rs` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@ use std::fmt::Write;
 
 use crate::transport::middle_proxy::MeApiHardswapSnapshot;
 
+/// Renders fixed-cardinality hardswap and writer-replacement gauges.
 pub(super) fn render(
     out: &mut String,
     snapshot: Option<&MeApiHardswapSnapshot>,
```

---

### Incident Patch 10: `9a683d8b` (2026-09-16)
**Commit Message**: Slot Budget + Config Store Atomic Writer fixes + Trusted Command

**File**: `src/api/config_edit.rs` (modified, +27/-3)
```diff
@@ -9,8 +9,11 @@ use super::ApiShared;
 use super::config_store::{
     EDITABLE_SECTIONS, EDITABLE_SERVER_FIELDS, compute_snapshot_revision, is_editable_section,
     load_candidate_snapshot, load_config_snapshot, render_server_listeners,
-    render_top_level_section, resolve_single_source_owner, upsert_toml_table, write_atomic,
+    render_top_level_section, resolve_single_source_owner, upsert_toml_table,
+    write_atomic_if_unchanged,
 };
+#[cfg(test)]
+use super::config_store::write_atomic;
 use super::model::ApiFailure;
 use crate::config::ProxyConfig;
 use crate::config::hot_reload::classify_config_changes;
@@ -43,7 +46,10 @@ pub(super) struct PatchConfigResponse {
 }
 
 struct PreparedConfigPatch {
+    config_path: PathBuf,
+    expected_revision: String,
     owner_path: PathBuf,
+    expected_owner_contents: String,
     owner_contents: String,
     desired_config: Arc<ProxyConfig>,
     response: PatchConfigResponse,
@@ -77,7 +83,14 @@ pub(super) async fn patch_config(
     } else {
         None
     };
-    write_atomic(prepared.owner_path, prepared.owner_contents).await?;
+    write_atomic_if_unchanged(
+        prepared.config_path,
+        prepared.expected_revision,
+        prepared.owner_path,
+        prepared.expected_owner_contents,
+        prepared.owner_contents,
+    )
+    .await?;
     if let Some(reservation) = reservation {
         prepared.response.reload = Some(reservation.enqueue(prepared.desired_config));
     }
@@ -111,7 +124,14 @@ pub(super) async fn apply_patch_to_path(
     expected_revision: Option<String>,
 ) -> Result<PatchConfigResponse, ApiFailure> {
     let prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
-    write_atomic(prepared.owner_path, prepared.owner_contents).await?;
+    write_atomic_if_unchanged(
+        prepared.config_path,
+        prepared.expected_revision,
+        prepared.owner_path,
+        prepared.expected_owner_contents,
+        prepared.owner_contents,
+    )
+    .await?;
     Ok(prepared.response)
 }
 
@@ -197,6 +217,7 @@ async fn prepare_patch_to_path(
         .get(&owner_path)
         .cloned()
         .ok_or_else(|| ApiFailure::internal("config source owner is missing from snapshot"))?;
+    let expected_owner_contents = owner_contents.clone();
     for section in &touched {
         if *section == "server" {
             let rendered = render_server_listeners(&requested_cfg)?;
@@ -233,7 +254,10 @@ async fn prepare_patch_to_path(
         deferred_process_fields(&old_cfg, &new_cfg).map_err(ApiFailure::bad_request)?;
 
     Ok(PreparedConfigPatch {
+        config_path: config_path.to_path_buf(),
+        expected_revision: current,
         owner_path,
+        expected_owner_contents,
         owner_contents,
         desired_config: Arc::new(new_cfg),
         response: PatchConfigResponse {
```

**File**: `src/api/config_edit/tests.rs` (modified, +24/-0)
```diff
@@ -323,6 +323,30 @@ async fn patch_writes_the_included_section_owner_only() {
     );
 }
 
+#[tokio::test]
+async fn prepared_patch_rejects_external_edit_before_commit() {
+    let (path, _directory) = temp_config("[censorship]\ntls_domain = \"old.example\"\n");
+    let patch: Json = serde_json::json!({
+        "censorship": {"tls_domain": "api.example"}
+    });
+    let prepared = prepare_patch_to_path(&path, &patch, None).await.unwrap();
+    let external = "[censorship]\ntls_domain = \"external.example\"\n";
+    tokio::fs::write(&path, external).await.unwrap();
+
+    let error = write_atomic_if_unchanged(
+        prepared.config_path,
+        prepared.expected_revision,
+        prepared.owner_path,
+        prepared.expected_owner_contents,
+        prepared.owner_contents,
+    )
+    .await
+    .unwrap_err();
+
+    assert_eq!(error.code, "revision_conflict");
+    assert_eq!(tokio::fs::read_to_string(&path).await.unwrap(), external);
+}
+
 #[tokio::test]
 async fn patch_rejects_multiple_source_owners_without_writing() {
     let dir = tempfile::tempdir().unwrap();
```

**File**: `src/api/config_store.rs` (modified, +11/-9)
```diff
@@ -10,13 +10,16 @@ use super::model::ApiFailure;
 
 // Source-preserving TOML rendering and atomic persistence helpers.
 mod persistence;
+// Compare-and-replace file persistence and metadata preservation.
+mod atomic;
 
 #[cfg(test)]
 use persistence::{find_toml_table_bounds, render_access_section, save_sections_to_disk};
 pub(in crate::api) use persistence::{
     render_server_listeners, render_top_level_section, save_access_sections_to_disk,
-    upsert_toml_table, write_atomic,
+    save_access_sections_to_disk_if_revision, upsert_toml_table,
 };
+pub(in crate::api) use atomic::{write_atomic, write_atomic_if_unchanged};
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
 pub(super) enum AccessSection {
@@ -54,22 +57,21 @@ pub(super) fn parse_if_match(headers: &hyper::HeaderMap) -> Option<String> {
         .map(|value| value.trim_matches('"').to_string())
 }
 
-pub(super) async fn ensure_expected_revision(
+/// Loads one mutation base and validates its revision from the same source snapshot.
+pub(super) async fn load_config_for_mutation(
     config_path: &Path,
     expected_revision: Option<&str>,
-) -> Result<(), ApiFailure> {
-    let Some(expected) = expected_revision else {
-        return Ok(());
-    };
-    let current = current_revision(config_path).await?;
-    if current != expected {
+) -> Result<(ProxyConfig, String), ApiFailure> {
+    let loaded = load_config_snapshot(config_path, false).await?;
+    let revision = compute_snapshot_revision(&loaded);
+    if expected_revision.is_some_and(|expected| expected != revision) {
         return Err(ApiFailure::new(
             hyper::StatusCode::CONFLICT,
             "revision_conflict",
             "Config revision mismatch",
         ));
     }
-    Ok(())
+    Ok((loaded.config, revision))
 }
 
 pub(super) async fn current_revision(config_path: &Path) -> Result<String, ApiFailure> {
```

**File**: `src/api/config_store/atomic.rs` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+use std::io::{Read, Write};
+use std::path::{Path, PathBuf};
+
+#[cfg(unix)]
+use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
+
+use super::compute_source_revision;
+use crate::api::model::ApiFailure;
+use crate::config::ProxyConfig;
+
+enum AtomicWriteError {
+    Conflict,
+    ReadGraph(String),
+    Io(std::io::Error),
+}
+
+struct ExistingTarget {
+    contents: String,
+    metadata: std::fs::Metadata,
+}
+
+/// Replaces one config source through a durable same-directory rename.
+pub(in crate::api) async fn write_atomic(
+    path: PathBuf,
+    contents: String,
+) -> Result<(), ApiFailure> {
+    tokio::task::spawn_blocking(move || write_atomic_sync(&path, None, &contents))
+        .await
+        .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
+        .map_err(|error| ApiFailure::internal(format!("failed to write config: {error}")))
+}
+
+/// Replaces one source only if both its graph revision and owner contents are unchanged.
+pub(in crate::api) async fn write_atomic_if_unchanged(
+    config_path: PathBuf,
+    expected_revision: String,
+    path: PathBuf,
+    expected_contents: String,
+    contents: String,
+) -> Result<(), ApiFailure> {
+    tokio::task::spawn_blocking(move || {
+        let graph = ProxyConfig::read_source_graph(&config_path)
+            .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
+        if compute_source_revision(&graph) != expected_revision {
+            return Err(AtomicWriteError::Conflict);
+        }
+        write_atomic_sync(&path, Some(&expected_contents), &contents).map_err(|error| {
+            if error.kind() == std::io::ErrorKind::AlreadyExists {
+                AtomicWriteError::Conflict
+            } else {
+                AtomicWriteError::Io(error)
+            }
+        })
+    })
+    .await
+    .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
+    .map_err(|error| match error {
+        AtomicWriteError::Conflict => revision_conflict(),
+        AtomicWriteError::ReadGraph(error) => {
+            ApiFailure::internal(format!("failed to verify config graph: {error}"))
+        }
+        AtomicWriteError::Io(error) => {
+            ApiFailure::internal(format!("failed to write config: {error}"))
+        }
+    })
+}
+
+fn revision_conflict() -> ApiFailure {
+    ApiFailure::new(
+        hyper::StatusCode::CONFLICT,
+        "revision_conflict",
+        "Config revision changed before persistence",
+    )
+}
+
+fn open_existing_target(path: &Path) -> std::io::Result<Option<ExistingTarget>> {
+    let mut options = std::fs::OpenOptions::new();
+    options.read(true);
+    #[cfg(unix)]
+    options.custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
+    let mut file = match options.open(path) {
+        Ok(file) => file,
+        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
+        Err(error) => return Err(error),
+    };
+    let metadata = file.metadata()?;
+    if !metadata.is_file() {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::InvalidInput,
+            "config target must be a regular file",
+        ));
+    }
+    let mut contents = String::new();
+    file.read_to_string(&mut contents)?;
+    Ok(Some(ExistingTarget { contents, metadata }))
+}
+
+fn same_target(left: &std::fs::Metadata, right: &std::fs::Metadata) -> bool {
+    #[cfg(unix)]
+    {
+        left.dev() == right.dev() && left.ino() == right.ino()
+    }
+    #[cfg(not(unix))]
+    {
+        left.len() == right.len() && left.modified().ok() == right.modified().ok()
+    }
+}
+
+fn write_atomic_sync(
+    path: &Path,
+    expected_contents: Option<&str>,
+    contents: &str,
+) -> std::io::Result<()> {
+    let parent = path.parent().unwrap_or_else(|| Path::new("."));
+    std::fs::create_dir_all(parent)?;
+    let existing = open_existing_target(path)?;
+    if expected_contents.is_some_and(|expected| {
+        existing
+            .as_ref()
+            .is_none_or(|target| target.contents != expected)
+    }) {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::AlreadyExists,
+            "config source changed before persistence",
+        ));
+    }
+
+    let tmp_name = format!(
+        ".{}.tmp-{}",
+        path.file_name()
+            .and_then(|name| name.to_str())
+            .unwrap_or("config.toml"),
+        rand::random::<u64>()
+    );
+    let tmp_path = parent.join(tmp_name);
+
+    let write_result = (|| {
+        let mut options = std::fs::OpenOptions::new();
+        options.create_new(true).write(true);
+        #[cfg(unix)]
+        options.mode(0o600);
+        let mut file = options.open(&tmp_path)?;
+        #[cfg(unix)]
+        if let Some(existing) = existing.as_ref() {
+            use nix::unistd::{Gid, Uid, fchown};
+
+            fchown(
+                &file,
+                Some(Uid::from_raw(existing.metadata.
```

**File**: `src/api/config_store/persistence.rs` (modified, +6/-171)
```diff
@@ -1,9 +1,5 @@
 use std::collections::BTreeMap;
-use std::io::{Read, Write};
-use std::path::{Path, PathBuf};
-
-#[cfg(unix)]
-use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
+use std::path::Path;
 
 use chrono::{DateTime, Utc};
 use serde::Serialize;
@@ -13,9 +9,12 @@ use crate::config::{ProxyConfig, RateLimitBps};
 #[cfg(test)]
 use super::compute_revision;
 use super::{
-    AccessSection, compute_snapshot_revision, compute_source_revision, load_candidate_snapshot,
-    load_config_snapshot, resolve_single_source_owner, toml_path_exists,
+    AccessSection, compute_snapshot_revision, load_candidate_snapshot, load_config_snapshot,
+    resolve_single_source_owner, toml_path_exists,
 };
+use super::atomic::write_atomic_if_unchanged;
+#[cfg(test)]
+use super::atomic::write_atomic;
 use crate::api::model::ApiFailure;
 
 /// Re-render the given top-level tables from `cfg` and upsert each into the
@@ -398,174 +397,10 @@ fn find_all_table_blocks(source: &str, table_name: &str) -> Vec<(usize, usize)>
     blocks
 }
 
-/// Replaces one config source through a durable same-directory rename.
-pub(in crate::api) async fn write_atomic(
-    path: PathBuf,
-    contents: String,
-) -> Result<(), ApiFailure> {
-    tokio::task::spawn_blocking(move || write_atomic_sync(&path, None, &contents))
-        .await
-        .map_err(|e| ApiFailure::internal(format!("failed to join writer: {}", e)))?
-        .map_err(|e| ApiFailure::internal(format!("failed to write config: {}", e)))
-}
-
-/// Replaces one source only if both its graph revision and owner contents are unchanged.
-pub(in crate::api) async fn write_atomic_if_unchanged(
-    config_path: PathBuf,
-    expected_revision: String,
-    path: PathBuf,
-    expected_contents: String,
-    contents: String,
-) -> Result<(), ApiFailure> {
-    tokio::task::spawn_blocking(move || {
-        let graph = ProxyConfig::read_source_graph(&config_path)
-            .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
-        if compute_source_revision(&graph) != expected_revision {
-            return Err(AtomicWriteError::Conflict);
-        }
-        write_atomic_sync(&path, Some(&expected_contents), &contents)
-            .map_err(AtomicWriteError::Io)
-    })
-    .await
-    .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
-    .map_err(|error| match error {
-        AtomicWriteError::Conflict => revision_conflict(),
-        AtomicWriteError::ReadGraph(error) => {
-            ApiFailure::internal(format!("failed to verify config graph: {error}"))
-        }
-        AtomicWriteError::Io(error) => {
-            ApiFailure::internal(format!("failed to write config: {error}"))
-        }
-    })
-}
-
-enum AtomicWriteError {
-    Conflict,
-    ReadGraph(String),
-    Io(std::io::Error),
-}
-
-struct ExistingTarget {
-    contents: String,
-    metadata: std::fs::Metadata,
-}
-
 fn revision_conflict() -> ApiFailure {
     ApiFailure::new(
         hyper::StatusCode::CONFLICT,
         "revision_conflict",
         "Config revision changed before persistence",
     )
 }
-
-fn open_existing_target(path: &Path) -> std::io::Result<Option<ExistingTarget>> {
-    let mut options = std::fs::OpenOptions::new();
-    options.read(true);
-    #[cfg(unix)]
-    options.custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
-    let mut file = match options.open(path) {
-        Ok(file) => file,
-        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
-        Err(error) => return Err(error),
-    };
-    let metadata = file.metadata()?;
-    if !metadata.is_file() {
-        return Err(std::io::Error::new(
-            std::io::ErrorKind::InvalidInput,
-            "config target must be a regular file",
-        ));
-    }
-    let mut contents = String::new();
-    file.read_to_string(&mut contents)?;
-    Ok(Some(ExistingTarget { contents, metadata }))
-}
-
-fn same_target(left: &std::fs::Metadata, right: &std::fs::Metadata) -> bool {
-    #[cfg(unix)]
-    {
-        left.dev() == right.dev() && left.ino() == right.ino()
-    }
-    #[cfg(not(unix))]
-    {
-        left.len() == right.len() && left.modified().ok() == right.modified().ok()
-    }
-}
-
-fn write_atomic_sync(
-    path: &Path,
-    expected_contents: Option<&str>,
-    contents: &str,
-) -> std::io::Result<()> {
-    let parent = path.parent().unwrap_or_else(|| Path::new("."));
-    std::fs::create_dir_all(parent)?;
-    let existing = open_existing_target(path)?;
-    if expected_contents.is_some_and(|expected| {
-        existing
-            .as_ref()
-            .is_none_or(|target| target.contents != expected)
-    }) {
-        return Err(std::io::Error::new(
-            std::io::ErrorKind::AlreadyExists,
-            "config source changed before persistence",
-        ));
-    }
-
-    let tmp_name = format!(
-        ".{}.tmp-{}",
-        path.file_name()
-            .and_then(|s| s.to_str())
-        
```

**File**: `src/api/config_store/tests.rs` (modified, +54/-0)
```diff
@@ -260,6 +260,60 @@ async fn access_mutation_writes_only_the_single_included_owner() {
     assert_eq!(revision, current_revision(&root).await.unwrap());
 }
 
+#[tokio::test]
+async fn access_mutation_rejects_source_graph_change_after_snapshot() {
+    let dir = tempfile::tempdir().unwrap();
+    let root = dir.path().join("config.toml");
+    let included = dir.path().join("users.toml");
+    let root_body = "include = \"users.toml\"\n[censorship]\ntls_domain = \"one.example\"\n";
+    let external_root =
+        "include = \"users.toml\"\n[censorship]\ntls_domain = \"two.example\"\n";
+    let included_body = "[access.users]\nalice = \"00000000000000000000000000000000\"\n";
+    tokio::fs::write(&root, root_body).await.unwrap();
+    tokio::fs::write(&included, included_body).await.unwrap();
+    let (mut cfg, revision) = load_config_for_mutation(&root, None).await.unwrap();
+    cfg.access.users.insert(
+        "bob".to_string(),
+        "11111111111111111111111111111111".to_string(),
+    );
+    tokio::fs::write(&root, external_root).await.unwrap();
+
+    let error = save_access_sections_to_disk_if_revision(
+        &root,
+        &cfg,
+        &[AccessSection::Users],
+        Some(&revision),
+    )
+    .await
+    .unwrap_err();
+
+    assert_eq!(error.code, "revision_conflict");
+    assert_eq!(tokio::fs::read_to_string(&root).await.unwrap(), external_root);
+    assert_eq!(
+        tokio::fs::read_to_string(&included).await.unwrap(),
+        included_body
+    );
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn atomic_write_preserves_existing_file_mode() {
+    use std::os::unix::fs::{MetadataExt, PermissionsExt};
+
+    let dir = tempfile::tempdir().unwrap();
+    let path = dir.path().join("config.toml");
+    tokio::fs::write(&path, "old").await.unwrap();
+    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o640)).unwrap();
+    let before = std::fs::metadata(&path).unwrap();
+
+    write_atomic(path.clone(), "new".to_string()).await.unwrap();
+
+    let after = std::fs::metadata(&path).unwrap();
+    assert_eq!(after.mode() & 0o7777, 0o640);
+    assert_eq!(after.uid(), before.uid());
+    assert_eq!(after.gid(), before.gid());
+}
+
 #[tokio::test]
 async fn access_mutation_rejects_sections_with_different_source_owners() {
     let dir = tempfile::tempdir().unwrap();
```

**File**: `src/api/handler/user_routes.rs` (modified, +2/-2)
```diff
@@ -134,8 +134,8 @@ pub(super) async fn handle(
         }
         let expected_revision = parse_if_match(req.headers());
         let _mutation_guard = shared.mutation_lock.lock().await;
-        let disk_cfg = load_config_from_disk(&shared.config_path).await?;
-        ensure_expected_revision(&shared.config_path, expected_revision.as_deref()).await?;
+        let (disk_cfg, _) =
+            load_config_for_mutation(&shared.config_path, expected_revision.as_deref()).await?;
         if !disk_cfg.access.users.contains_key(user) {
             return Ok(error_response(
                 request_id,
```

**File**: `src/api/mod.rs` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ mod web_runtime;
 mod web_status;
 
 use config_store::{
-    current_revision, ensure_expected_revision, load_config_for_reload, load_config_from_disk,
+    current_revision, load_config_for_mutation, load_config_for_reload, load_config_from_disk,
     parse_if_match,
 };
 use events::ApiEventStore;
```

---

### Incident Patch 11: `844e41ea` (2026-09-09)
**Commit Message**: Races in admission + accounting + publication,+ PID fixed

**File**: `src/api/handler/fixed_routes.rs` (modified, +1/-4)
```diff
@@ -35,13 +35,10 @@ pub(super) async fn create_user_route(
     let runtime_cfg = config_rx.borrow().clone();
     data.user.in_runtime = runtime_cfg.access.users.contains_key(&data.user.username);
     if let Some(enabled) = requested_enabled {
-        shared
+        let (_, cancelled) = shared
             .proxy_shared
             .set_user_enabled(&data.user.username, enabled);
         if !enabled {
-            let cancelled = shared
-                .proxy_shared
-                .cancel_user_sessions(&data.user.username);
             if cancelled > 0 {
                 shared.runtime_events.record(
                     "api.user.disable.runtime",
```

**File**: `src/api/handler/user_routes.rs` (modified, +2/-4)
```diff
@@ -104,8 +104,7 @@ pub(super) async fn handle(
         };
         let runtime_cfg = config_rx.borrow().clone();
         data.in_runtime = runtime_cfg.access.users.contains_key(&data.username);
-        let newly_disabled = shared.proxy_shared.set_user_enabled(base_user, false);
-        let cancelled = shared.proxy_shared.cancel_user_sessions(base_user);
+        let (newly_disabled, cancelled) = shared.proxy_shared.set_user_enabled(base_user, false);
         shared.runtime_events.record(
             "api.user.disable.ok",
             format!(
@@ -290,11 +289,10 @@ pub(super) async fn handle(
             let runtime_cfg = config_rx.borrow().clone();
             data.in_runtime = runtime_cfg.access.users.contains_key(&data.username);
             if let Some(enabled) = enabled_update {
-                shared
+                let (_, cancelled) = shared
                     .proxy_shared
                     .set_user_enabled(&data.username, enabled);
                 if !enabled {
-                    let cancelled = shared.proxy_shared.cancel_user_sessions(&data.username);
                     shared.runtime_events.record(
                         "api.user.disable.runtime",
                         format!(
```

**File**: `src/cli.rs` (modified, +23/-496)
```diff
@@ -8,15 +8,22 @@
 //! - `run [OPTIONS] [config.toml]` - Run in foreground (default behavior)
 //! - `healthcheck [OPTIONS] [config.toml]` - Run control-plane health probe
 
-use rand::RngExt;
-use std::fs;
-use std::path::{Path, PathBuf};
-use std::process::Command;
+use std::path::PathBuf;
 
 use crate::healthcheck::{self, HealthcheckMode};
 
 #[cfg(unix)]
-use crate::daemon::{self, DEFAULT_PID_FILE, DaemonOptions};
+use crate::daemon::{DEFAULT_PID_FILE, DaemonOptions};
+
+// Unix daemon control and argument parsing.
+#[cfg(unix)]
+mod daemon_commands;
+// Fire-and-forget installation workflow.
+mod init;
+
+#[cfg(unix)]
+pub use daemon_commands::parse_daemon_args;
+pub use init::{InitOptions, parse_init_args, run_init};
 
 /// CLI subcommand to execute.
 #[derive(Debug, Clone, PartialEq, Eq)]
@@ -40,13 +47,20 @@ pub enum Subcommand {
 /// Parsed subcommand with its options.
 #[derive(Debug)]
 pub struct ParsedCommand {
+    /// Selected command mode.
     pub subcommand: Subcommand,
+    /// PID file used by daemon-control commands.
     pub pid_file: PathBuf,
+    /// Configuration file passed to runtime or healthcheck.
     pub config_path: String,
+    /// Requested healthcheck mode.
     pub healthcheck_mode: HealthcheckMode,
+    /// Invalid healthcheck mode retained for command diagnostics.
     pub healthcheck_mode_invalid: Option<String>,
     #[cfg(unix)]
+    /// Unix daemon lifecycle options.
     pub daemon_opts: DaemonOptions,
+    /// Fire-and-forget initialization options.
     pub init_opts: Option<InitOptions>,
 }
 
@@ -79,7 +93,6 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
         return cmd;
     }
 
-    // Check for subcommand as first argument
     if let Some(first) = args.first() {
         match first.as_str() {
             "start" => {
@@ -120,11 +133,9 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
         }
     }
 
-    // Parse remaining options
     let mut i = 0;
     while i < args.len() {
         match args[i].as_str() {
-            // Skip subcommand names
             "start" | "stop" | "reload" | "status" | "run" | "healthcheck" => {}
             "--mode" => {
                 i += 1;
@@ -154,7 +165,6 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
                     }
                 }
             }
-            // PID file option (for stop/reload/status)
             "--pid-file" => {
                 i += 1;
                 if i < args.len() {
@@ -189,9 +199,9 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
 #[cfg(unix)]
 pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
     match cmd.subcommand {
-        Subcommand::Stop => Some(cmd_stop(&cmd.pid_file)),
-        Subcommand::Reload => Some(cmd_reload(&cmd.pid_file)),
-        Subcommand::Status => Some(cmd_status(&cmd.pid_file)),
+        Subcommand::Stop => Some(daemon_commands::stop(&cmd.pid_file)),
+        Subcommand::Reload => Some(daemon_commands::reload(&cmd.pid_file)),
+        Subcommand::Status => Some(daemon_commands::status(&cmd.pid_file)),
         Subcommand::Healthcheck => {
             if let Some(invalid_mode) = cmd.healthcheck_mode_invalid.as_ref() {
                 if invalid_mode.is_empty() {
@@ -224,6 +234,7 @@ pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
     }
 }
 
+/// Executes a non-server subcommand on platforms without daemon support.
 #[cfg(not(unix))]
 pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
     match cmd.subcommand {
@@ -261,487 +272,3 @@ pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
         Subcommand::Run | Subcommand::Start => None,
     }
 }
-
-/// Stop command: send SIGTERM to the running daemon.
-#[cfg(unix)]
-fn cmd_stop(pid_file: &Path) -> i32 {
-    use nix::sys::signal::Signal;
-
-    println!("Stopping telemt daemon...");
-
-    match daemon::signal_pid_file(pid_file, Signal::SIGTERM) {
-        Ok(()) => {
-            println!("Stop signal sent successfully");
-
-            // Wait for process to exit (up to 10 seconds)
-            for _ in 0..20 {
-                std::thread::sleep(std::time::Duration::from_millis(500));
-                if let daemon::DaemonStatus::NotRunning = daemon::check_status(pid_file) {
-                    println!("Daemon stopped");
-                    return 0;
-                }
-            }
-            println!("Daemon may still be shutting down");
-            0
-        }
-        Err(e) => {
-            eprintln!("Failed to stop daemon: {}", e);
-            1
-        }
-    }
-}
-
-/// Reload command: send SIGHUP to trigger config reload.
-#[cfg(unix)]
-fn cmd_reload(pid_file: &Path) -> i32 {
-    use nix::sys::signal::Signal;
-
-    println!("Reloading telemt configuration...");
-
-    match daemon::signal_pid_file(pid_file, Signal::SIGHUP) {
-        Ok(()) => {
-            println!("Reload signal sent successfully");
-            0
-        }
-        Err(e) => {
-            eprint
```

**File**: `src/cli/daemon_commands.rs` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+use std::path::{Path, PathBuf};
+
+use crate::daemon::{self, DaemonOptions};
+
+/// Parses daemon-related options from CLI arguments.
+pub fn parse_daemon_args(args: &[String]) -> DaemonOptions {
+    let mut opts = DaemonOptions::default();
+    let mut i = 0;
+
+    while i < args.len() {
+        match args[i].as_str() {
+            "--daemon" | "-d" => {
+                opts.daemonize = true;
+            }
+            "--foreground" | "-f" => {
+                opts.foreground = true;
+            }
+            "--pid-file" => {
+                i += 1;
+                if i < args.len() {
+                    opts.pid_file = Some(PathBuf::from(&args[i]));
+                }
+            }
+            s if s.starts_with("--pid-file=") => {
+                opts.pid_file = Some(PathBuf::from(s.trim_start_matches("--pid-file=")));
+            }
+            "--run-as-user" => {
+                i += 1;
+                if i < args.len() {
+                    opts.user = Some(args[i].clone());
+                }
+            }
+            s if s.starts_with("--run-as-user=") => {
+                opts.user = Some(s.trim_start_matches("--run-as-user=").to_string());
+            }
+            "--run-as-group" => {
+                i += 1;
+                if i < args.len() {
+                    opts.group = Some(args[i].clone());
+                }
+            }
+            s if s.starts_with("--run-as-group=") => {
+                opts.group = Some(s.trim_start_matches("--run-as-group=").to_string());
+            }
+            "--working-dir" => {
+                i += 1;
+                if i < args.len() {
+                    opts.working_dir = Some(PathBuf::from(&args[i]));
+                }
+            }
+            s if s.starts_with("--working-dir=") => {
+                opts.working_dir = Some(PathBuf::from(s.trim_start_matches("--working-dir=")));
+            }
+            _ => {}
+        }
+        i += 1;
+    }
+
+    opts
+}
+
+/// Sends SIGTERM and waits briefly for graceful PID-file cleanup.
+pub(super) fn stop(pid_file: &Path) -> i32 {
+    use nix::sys::signal::Signal;
+
+    println!("Stopping telemt daemon...");
+
+    match daemon::signal_pid_file(pid_file, Signal::SIGTERM) {
+        Ok(()) => {
+            println!("Stop signal sent successfully");
+
+            // Wait for process to exit for up to ten seconds.
+            for _ in 0..20 {
+                std::thread::sleep(std::time::Duration::from_millis(500));
+                if let daemon::DaemonStatus::NotRunning = daemon::check_status(pid_file) {
+                    println!("Daemon stopped");
+                    return 0;
+                }
+            }
+            println!("Daemon may still be shutting down");
+            0
+        }
+        Err(e) => {
+            eprintln!("Failed to stop daemon: {}", e);
+            1
+        }
+    }
+}
+
+/// Sends SIGHUP to trigger configuration reload.
+pub(super) fn reload(pid_file: &Path) -> i32 {
+    use nix::sys::signal::Signal;
+
+    println!("Reloading telemt configuration...");
+
+    match daemon::signal_pid_file(pid_file, Signal::SIGHUP) {
+        Ok(()) => {
+            println!("Reload signal sent successfully");
+            0
+        }
+        Err(e) => {
+            eprintln!("Failed to reload daemon: {}", e);
+            1
+        }
+    }
+}
+
+/// Reports daemon status without mutating PID lifecycle state.
+pub(super) fn status(pid_file: &Path) -> i32 {
+    match daemon::check_status(pid_file) {
+        daemon::DaemonStatus::Running(pid) => {
+            println!("telemt is running (pid {})", pid);
+            0
+        }
+        daemon::DaemonStatus::Stale(pid) => {
+            println!("telemt is not running (stale pid file, was pid {})", pid);
+            1
+        }
+        daemon::DaemonStatus::NotRunning => {
+            println!("telemt is not running");
+            1
+        }
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use std::fs;
+
+    use super::*;
+
+    #[test]
+    fn status_does_not_remove_stale_pid_file() {
+        let directory = tempfile::tempdir().unwrap();
+        let pid_file = directory.path().join("telemt.pid");
+        fs::write(&pid_file, b"2000000000\n").unwrap();
+
+        assert_eq!(status(&pid_file), 1);
+        assert!(pid_file.exists());
+    }
+}
```

**File**: `src/cli/init.rs` (added, +353/-0)
```diff
@@ -0,0 +1,353 @@
+use std::fs;
+use std::path::{Path, PathBuf};
+use std::process::Command;
+
+use rand::RngExt;
+
+/// Options for the fire-and-forget init command.
+#[derive(Debug, Clone)]
+pub struct InitOptions {
+    /// Public listener port.
+    pub port: u16,
+    /// TLS camouflage domain.
+    pub domain: String,
+    /// Optional pre-generated proxy secret.
+    pub secret: Option<String>,
+    /// Initial access username.
+    pub username: String,
+    /// Destination directory for generated configuration.
+    pub config_dir: PathBuf,
+    /// Generate service files without starting the service.
+    pub no_start: bool,
+}
+
+impl Default for InitOptions {
+    fn default() -> Self {
+        Self {
+            port: 443,
+            domain: "www.google.com".to_string(),
+            secret: None,
+            username: "user".to_string(),
+            config_dir: PathBuf::from("/etc/telemt"),
+            no_start: false,
+        }
+    }
+}
+
+/// Parse --init subcommand options from CLI args.
+///
+/// Returns `Some(InitOptions)` if `--init` was found, `None` otherwise.
+pub fn parse_init_args(args: &[String]) -> Option<InitOptions> {
+    if !args.iter().any(|a| a == "--init") {
+        return None;
+    }
+
+    let mut opts = InitOptions::default();
+    let mut i = 0;
+
+    while i < args.len() {
+        match args[i].as_str() {
+            "--port" => {
+                i += 1;
+                if i < args.len() {
+                    opts.port = args[i].parse().unwrap_or(443);
+                }
+            }
+            "--domain" => {
+                i += 1;
+                if i < args.len() {
+                    opts.domain = args[i].clone();
+                }
+            }
+            "--secret" => {
+                i += 1;
+                if i < args.len() {
+                    opts.secret = Some(args[i].clone());
+                }
+            }
+            "--user" => {
+                i += 1;
+                if i < args.len() {
+                    opts.username = args[i].clone();
+                }
+            }
+            "--config-dir" => {
+                i += 1;
+                if i < args.len() {
+                    opts.config_dir = PathBuf::from(&args[i]);
+                }
+            }
+            "--no-start" => {
+                opts.no_start = true;
+            }
+            _ => {}
+        }
+        i += 1;
+    }
+
+    Some(opts)
+}
+
+/// Run the fire-and-forget setup.
+pub fn run_init(opts: InitOptions) -> Result<(), Box<dyn std::error::Error>> {
+    use crate::service::{self, InitSystem, ServiceOptions};
+
+    eprintln!("[telemt] Fire-and-forget setup");
+    eprintln!();
+
+    let init_system = service::detect_init_system();
+    eprintln!("[+] Detected init system: {}", init_system);
+
+    let secret = match opts.secret {
+        Some(s) => {
+            if s.len() != 32 || !s.chars().all(|c| c.is_ascii_hexdigit()) {
+                eprintln!("[error] Secret must be exactly 32 hex characters");
+                std::process::exit(1);
+            }
+            s
+        }
+        None => generate_secret(),
+    };
+
+    eprintln!("[+] Secret: {}", secret);
+    eprintln!("[+] User:   {}", opts.username);
+    eprintln!("[+] Port:   {}", opts.port);
+    eprintln!("[+] Domain: {}", opts.domain);
+
+    fs::create_dir_all(&opts.config_dir)?;
+    let config_path = opts.config_dir.join("config.toml");
+    let config_content = generate_config(&opts.username, &secret, opts.port, &opts.domain);
+    fs::write(&config_path, &config_content)?;
+    eprintln!("[+] Config written to {}", config_path.display());
+
+    let exe_path =
+        std::env::current_exe().unwrap_or_else(|_| PathBuf::from("/usr/local/bin/telemt"));
+    let service_opts = ServiceOptions {
+        exe_path: &exe_path,
+        config_path: &config_path,
+        // Let the selected init system manage process identity.
+        user: None,
+        group: None,
+        pid_file: "/var/run/telemt.pid",
+        working_dir: Some("/var/lib/telemt"),
+        description: "Telemt MTProxy - Telegram MTProto Proxy",
+    };
+
+    let service_path = service::service_file_path(init_system);
+    let service_content = service::generate_service_file(init_system, &service_opts);
+    if let Some(parent) = Path::new(service_path).parent() {
+        let _ = fs::create_dir_all(parent);
+    }
+
+    match fs::write(service_path, &service_content) {
+        Ok(()) => {
+            eprintln!("[+] Service file written to {}", service_path);
+
+            // OpenRC and FreeBSD service scripts must be executable.
+            #[cfg(unix)]
+            if init_system == InitSystem::OpenRC || init_system == InitSystem::FreeBSDRc {
+                use std::os::unix::fs::PermissionsExt;
+                let mut perms = fs::metadata(service_path)?.permissions();
+                perms.set_mode(0o755);
+                fs::set_permissions(service_path, perms)?
```

**File**: `src/config/load/validate_runtime.rs` (modified, +14/-0)
```diff
@@ -196,6 +196,13 @@ pub(super) fn validate(config: &mut ProxyConfig) -> Result<()> {
                 "access.user_rate_limits.{user} must set at least one non-zero direction"
             )));
         }
+        for (direction, value) in [("up_bps", limit.up_bps), ("down_bps", limit.down_bps)] {
+            if value > MAX_RATE_LIMIT_BPS {
+                return Err(ProxyError::Config(format!(
+                    "access.user_rate_limits.{user}.{direction} must be within [0, {MAX_RATE_LIMIT_BPS}]"
+                )));
+            }
+        }
     }
 
     for (cidr, limit) in &config.access.cidr_rate_limits {
@@ -204,6 +211,13 @@ pub(super) fn validate(config: &mut ProxyConfig) -> Result<()> {
                 "access.cidr_rate_limits.{cidr} must set at least one non-zero direction"
             )));
         }
+        for (direction, value) in [("up_bps", limit.up_bps), ("down_bps", limit.down_bps)] {
+            if value > MAX_RATE_LIMIT_BPS {
+                return Err(ProxyError::Config(format!(
+                    "access.cidr_rate_limits.{cidr}.{direction} must be within [0, {MAX_RATE_LIMIT_BPS}]"
+                )));
+            }
+        }
     }
     let mut cidr_auto_templates = HashSet::new();
     for cidr in config.access.cidr_rate_limits.keys() {
```

**File**: `src/config/tests/load_basic_tests/defaults_access_tests.rs` (modified, +62/-0)
```diff
@@ -288,6 +288,68 @@ fn cidr_rate_limits_reject_duplicate_normalized_auto_templates() {
     assert!(error.contains("duplicates normalized auto-template *6/128"));
 }
 
+#[test]
+fn rate_limits_accept_the_packed_counter_maximum() {
+    let cfg = load_config_from_temp_toml(
+        r#"
+            [censorship]
+            tls_domain = "example.com"
+
+            [access.users]
+            user = "00000000000000000000000000000000"
+
+            [access.user_rate_limits]
+            user = { up_bps = 100000000000, down_bps = 0 }
+
+            [access.cidr_rate_limits]
+            "203.0.113.0/24" = { up_bps = 0, down_bps = 100000000000 }
+        "#,
+    );
+
+    assert_eq!(cfg.access.user_rate_limits["user"].up_bps, 100_000_000_000);
+    assert_eq!(
+        cfg.access.cidr_rate_limits[&CidrRateLimitKey::Network("203.0.113.0/24".parse().unwrap())]
+            .down_bps,
+        100_000_000_000
+    );
+}
+
+#[test]
+fn user_rate_limits_reject_values_above_the_packed_counter_maximum() {
+    let error = load_config_error_from_temp_toml(
+        r#"
+            [censorship]
+            tls_domain = "example.com"
+
+            [access.users]
+            user = "00000000000000000000000000000000"
+
+            [access.user_rate_limits]
+            user = { up_bps = 100000000001, down_bps = 0 }
+        "#,
+    );
+
+    assert!(error.contains("access.user_rate_limits.user.up_bps must be within"));
+}
+
+#[test]
+fn cidr_rate_limits_reject_values_above_the_packed_counter_maximum() {
+    let error = load_config_error_from_temp_toml(
+        r#"
+            [censorship]
+            tls_domain = "example.com"
+
+            [access.users]
+            user = "00000000000000000000000000000000"
+
+            [access.cidr_rate_limits]
+            "203.0.113.0/24" = { up_bps = 0, down_bps = 100000000001 }
+        "#,
+    );
+
+    assert!(error.contains("access.cidr_rate_limits.203.0.113.0/24.down_bps must be within"));
+}
+
 #[test]
 fn file_logging_requires_path() {
     let error = load_config_error_from_temp_toml(
```

**File**: `src/config/types.rs` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ mod web_debug;
 
 pub use access::{AccessConfig, CidrRateLimitKey, RateLimitBps};
 #[allow(unused_imports)]
-pub(crate) use access::{CidrAutoTemplate, CidrAutoTemplateFamily};
+pub(crate) use access::{CidrAutoTemplate, CidrAutoTemplateFamily, MAX_RATE_LIMIT_BPS};
 pub use api::{ApiConfig, ApiGrayAction};
 pub use censorship::{
     AntiCensorshipConfig, ExclusiveMaskTarget, TlsFetchConfig, TlsFetchProfile, UnknownSniAction,
```

---

### Incident Patch 12: `4e3d560a` (2026-09-06)
**Commit Message**: Merge pull request #919 from nikoano/fix/install-port-check-tcp-only

fix(install): probe only TCP when validating the target port

**File**: `install.sh` (modified, +2/-2)
```diff
@@ -447,9 +447,9 @@ check_port_availability() {
     port_info=""
 
     if command -v ss >/dev/null 2>&1; then
-        port_info=$($SUDO ss -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO ss -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v netstat >/dev/null 2>&1; then
-        port_info=$($SUDO netstat -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO netstat -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v lsof >/dev/null 2>&1; then
         port_info=$($SUDO lsof -i :${SERVER_PORT} 2>/dev/null | grep LISTEN || true)
     else
```

---

### Incident Patch 13: `9908e04e` (2026-09-05)
**Commit Message**: fix(install): probe only TCP when validating the target port

**File**: `install.sh` (modified, +2/-2)
```diff
@@ -447,9 +447,9 @@ check_port_availability() {
     port_info=""
 
     if command -v ss >/dev/null 2>&1; then
-        port_info=$($SUDO ss -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO ss -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v netstat >/dev/null 2>&1; then
-        port_info=$($SUDO netstat -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO netstat -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v lsof >/dev/null 2>&1; then
         port_info=$($SUDO lsof -i :${SERVER_PORT} 2>/dev/null | grep LISTEN || true)
     else
```

---

### Incident Patch 14: `0d044c73` (2026-09-03)
**Commit Message**: WEB WS Downlink correctness + peer-lease fixed

Co-Authored-By: brekotis <[REDACTED_EMAIL]>

**File**: `src/web/http/websocket/driver.rs` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ async fn run_multiplex(
     let maximum_message = session.limits().carrier_batch_bytes;
     let mut active = false;
     loop {
-        let down = session.poll_down(cursor);
+        let down = session.poll_down_websocket(cursor);
         tokio::pin!(down);
         let event = tokio::select! {
             _ = cancellation.cancelled() => return Err(()),
```

**File**: `src/web/session/downlink.rs` (modified, +30/-10)
```diff
@@ -15,6 +15,14 @@ use crate::web::telemetry::WebSessionLifecycleObservation;
 impl WebSession {
     /// Polls pending downlink frames with cursor replay and newest-poll-wins semantics.
     pub(crate) async fn poll_down(&self, cursor: u64) -> Result<PollResult, ManagerError> {
+        self.poll_down_inner(cursor, true).await
+    }
+
+    async fn poll_down_inner(
+        &self,
+        cursor: u64,
+        peer_activity: bool,
+    ) -> Result<PollResult, ManagerError> {
         if !self.carrier().is_multiplexed() {
             return Err(ManagerError::Protocol);
         }
@@ -30,11 +38,13 @@ impl WebSession {
                         next_cursor: unacked.next_cursor,
                         lane_closed: false,
                     };
-                    self.touch_peer_locked(
-                        &mut state,
-                        Instant::now(),
-                        WebSessionLifecycleObservation::HttpActivityAfterGap,
-                    );
+                    if peer_activity {
+                        self.touch_peer_locked(
+                            &mut state,
+                            Instant::now(),
+                            WebSessionLifecycleObservation::HttpActivityAfterGap,
+                        );
+                    }
                     return Ok(result);
                 }
                 if cursor != unacked.next_cursor {
@@ -59,11 +69,13 @@ impl WebSession {
                 return Err(ManagerError::Protocol);
             };
             state.down_epoch = epoch;
-            self.touch_peer_locked(
-                &mut state,
-                Instant::now(),
-                WebSessionLifecycleObservation::HttpActivityAfterGap,
-            );
+            if peer_activity {
+                self.touch_peer_locked(
+                    &mut state,
+                    Instant::now(),
+                    WebSessionLifecycleObservation::HttpActivityAfterGap,
+                );
+            }
             let healthy = self.carrier_health_ready_locked(&mut state, Instant::now());
             (state.down_epoch, healthy)
         };
@@ -133,6 +145,14 @@ impl WebSession {
         }
     }
 
+    /// Polls multiplexed WebSocket downlink without renewing the peer lease.
+    pub(crate) async fn poll_down_websocket(
+        &self,
+        cursor: u64,
+    ) -> Result<PollResult, ManagerError> {
+        self.poll_down_inner(cursor, false).await
+    }
+
     /// Reserves session and process queue capacity while the session lock is held.
     pub(super) fn reserve_locked(
         &self,
```

**File**: `src/web/session/downlink_tests.rs` (modified, +16/-0)
```diff
@@ -142,3 +142,19 @@ async fn newer_poll_supersedes_older_poll_without_closing_session() {
     session.close(super::SessionCloseReason::ApiClose);
     manager.shutdown().await;
 }
+
+#[tokio::test]
+async fn websocket_downlink_poll_does_not_extend_the_peer_lease() {
+    let (session, manager) = session();
+    session
+        .state
+        .lock()
+        .activity
+        .touch_peer(Instant::now() - Duration::from_secs(121));
+    queue_close(&session);
+
+    session.poll_down_websocket(0).await.unwrap();
+
+    assert!(session.close_if_due(Instant::now()));
+    manager.shutdown().await;
+}
```

---

### Incident Patch 15: `7de6edda` (2026-09-03)
**Commit Message**: Security-regression fixed + Uplink moduled

Co-Authored-By: brekotis <[REDACTED_EMAIL]>

**File**: `src/web/session/lanes.rs` (modified, +2/-5)
```diff
@@ -319,11 +319,8 @@ impl WebSession {
                 return Err(ManagerError::Limit);
             };
             state.lane_open_waits += 1;
-            self.touch_peer_locked(
-                &mut state,
-                Instant::now(),
-                WebSessionLifecycleObservation::HttpActivityAfterGap,
-            );
+            let observation = WebSessionLifecycleObservation::HttpActivityAfterGap;
+            self.touch_peer_locked(&mut state, Instant::now(), observation);
             LaneOpenWaitGuard {
                 session: self,
                 _auxiliary: auxiliary,
```

**File**: `src/web/session/uplink.rs` (modified, +2/-127)
```diff
@@ -430,130 +430,5 @@ pub(super) fn inbound_reservation(state: &SessionState, frames: &[Frame<'_>]) ->
 }
 
 #[cfg(test)]
-mod tests {
-    use super::*;
-    use std::net::SocketAddr;
-
-    use crate::config::{
-        WebCarrier, WebLimitsConfig, WebRuntimeProfile, WebSecretMode, WebTimeoutsConfig,
-    };
-    use crate::web::manager::WebProcessRuntime;
-
-    fn session() -> Arc<WebSession> {
-        session_with_automatic(false)
-    }
-
-    fn session_with_automatic(automatic: bool) -> Arc<WebSession> {
-        let profile = Arc::new(WebRuntimeProfile {
-            host: "proxy.example.com".to_string(),
-            public_addr: SocketAddr::from(([203, 0, 113, 10], 443)),
-            user: "alice".to_string(),
-            secret_mode: WebSecretMode::Plain,
-            carrier: WebCarrier::Https,
-            carrier_negotiation_enabled: false,
-            carrier_learning: true,
-            carriers: Arc::from([WebCarrier::Https]),
-            carrier_negotiation_deadlines_secs: [3, 5, 8, 12],
-            capability: [0; 32],
-            key_fingerprint: "0000000000000000".to_string(),
-            max_sessions: 1,
-            max_streams: 1,
-            max_streams_per_session: 1,
-        });
-        WebSession::new(
-            std::sync::Weak::<WebProcessRuntime>::new(),
-            [1; 32],
-            "192.0.2.10".parse().unwrap(),
-            1,
-            profile,
-            [2; 32],
-            WebCarrier::Https,
-            1,
-            [3; 32],
-            None,
-            if automatic {
-                crate::web::manager::CarrierClientClass::Bridge
-            } else {
-                crate::web::manager::CarrierClientClass::Legacy
-            },
-            None,
-            automatic,
-            WebLimitsConfig::default(),
-            WebTimeoutsConfig::default(),
-        )
-    }
-
-    #[test]
-    fn uplink_retry_commits_only_one_exact_body() {
-        let session = session();
-        let first = frame::encode(FrameType::Pong, 0, &[1, 2, 3]);
-        assert_eq!(session.process_up(1, &first), Ok(1));
-        assert_eq!(session.process_up(1, &first), Ok(1));
-
-        let changed = frame::encode(FrameType::Pong, 0, &[1, 2, 4]);
-        assert_eq!(session.process_up(1, &changed), Err(ManagerError::Protocol));
-        assert!(session.state.lock().closed);
-    }
-
-    #[test]
-    fn concurrent_uplink_does_not_commit_sequence() {
-        let session = session();
-        let body = frame::encode(FrameType::Pong, 0, &[]);
-        session.up_active.store(true, Ordering::Release);
-        assert_eq!(session.process_up(1, &body), Err(ManagerError::Concurrent));
-        assert_eq!(session.state.lock().last_up_sequence, 0);
-        session.up_active.store(false, Ordering::Release);
-        assert_eq!(session.process_up(1, &body), Ok(1));
-    }
-
-    #[test]
-    fn backpressured_uplink_does_not_commit_or_close() {
-        let session = session();
-        {
-            let mut state = session.state.lock();
-            state.streams.insert(
-                1,
-                StreamState {
-                    instance: 1,
-                    inbound: VecDeque::new(),
-                    receive_window: frame::INITIAL_STREAM_WINDOW,
-                    send_credit: u64::from(frame::INITIAL_STREAM_WINDOW),
-                    read_waker: None,
-                    write_waker: None,
-                },
-            );
-            state.pending_bytes = session.limits.pending_bytes_per_session;
-        }
-        let body = frame::encode(FrameType::Data, 1, &[1]);
-
-        assert_eq!(
-            session.process_up(1, &body),
-            Err(ManagerError::Backpressure)
-        );
-        let state = session.state.lock();
-        assert!(!state.closed);
-        assert_eq!(state.last_up_sequence, 0);
-        assert!(state.streams.get(&1).unwrap().inbound.is_empty());
-    }
-
-    #[test]
-    fn uplink_gap_is_fatal() {
-        let session = session();
-        let body = frame::encode(FrameType::Pong, 0, &[]);
-        assert_eq!(session.process_up(2, &body), Err(ManagerError::Protocol));
-        assert!(session.state.lock().closed);
-    }
-
-    #[test]
-    fn automatic_uplink_does_not_ack_a_batch_without_real_progress() {
-        let session = session_with_automatic(true);
-        let body = frame::encode(FrameType::Pong, 0, &[]);
-
-        assert_eq!(
-            session.process_up(1, &body),
-            Err(ManagerError::Backpressure)
-        );
-        assert!(!session.is_carrier_committed());
-        assert!(!session.state.lock().closed);
-    }
-}
+#[path = "uplink_tests.rs"]
+mod tests;
```

**File**: `src/web/session/uplink_tests.rs` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+use super::*;
+use std::net::SocketAddr;
+
+use crate::config::{
+    WebCarrier, WebLimitsConfig, WebRuntimeProfile, WebSecretMode, WebTimeoutsConfig,
+};
+use crate::web::manager::WebProcessRuntime;
+
+fn session() -> Arc<WebSession> {
+    session_with_automatic(false)
+}
+
+fn session_with_automatic(automatic: bool) -> Arc<WebSession> {
+    let profile = Arc::new(WebRuntimeProfile {
+        host: "proxy.example.com".to_string(),
+        public_addr: SocketAddr::from(([203, 0, 113, 10], 443)),
+        user: "alice".to_string(),
+        secret_mode: WebSecretMode::Plain,
+        carrier: WebCarrier::Https,
+        carrier_negotiation_enabled: false,
+        carrier_learning: true,
+        carriers: Arc::from([WebCarrier::Https]),
+        carrier_negotiation_deadlines_secs: [3, 5, 8, 12],
+        capability: [0; 32],
+        key_fingerprint: "0000000000000000".to_string(),
+        max_sessions: 1,
+        max_streams: 1,
+        max_streams_per_session: 1,
+    });
+    WebSession::new(
+        std::sync::Weak::<WebProcessRuntime>::new(),
+        [1; 32],
+        "192.0.2.10".parse().unwrap(),
+        1,
+        profile,
+        [2; 32],
+        WebCarrier::Https,
+        1,
+        [3; 32],
+        None,
+        if automatic {
+            crate::web::manager::CarrierClientClass::Bridge
+        } else {
+            crate::web::manager::CarrierClientClass::Legacy
+        },
+        None,
+        automatic,
+        WebLimitsConfig::default(),
+        WebTimeoutsConfig::default(),
+    )
+}
+
+#[test]
+fn uplink_retry_commits_only_one_exact_body() {
+    let session = session();
+    let first = frame::encode(FrameType::Pong, 0, &[1, 2, 3]);
+    assert_eq!(session.process_up(1, &first), Ok(1));
+    assert_eq!(session.process_up(1, &first), Ok(1));
+
+    let changed = frame::encode(FrameType::Pong, 0, &[1, 2, 4]);
+    assert_eq!(session.process_up(1, &changed), Err(ManagerError::Protocol));
+    assert!(session.state.lock().closed);
+}
+
+#[test]
+fn concurrent_uplink_does_not_commit_sequence() {
+    let session = session();
+    let body = frame::encode(FrameType::Pong, 0, &[]);
+    session.up_active.store(true, Ordering::Release);
+    assert_eq!(session.process_up(1, &body), Err(ManagerError::Concurrent));
+    assert_eq!(session.state.lock().last_up_sequence, 0);
+    session.up_active.store(false, Ordering::Release);
+    assert_eq!(session.process_up(1, &body), Ok(1));
+}
+
+#[test]
+fn backpressured_uplink_does_not_commit_or_close() {
+    let session = session();
+    {
+        let mut state = session.state.lock();
+        state.streams.insert(
+            1,
+            StreamState {
+                instance: 1,
+                inbound: VecDeque::new(),
+                receive_window: frame::INITIAL_STREAM_WINDOW,
+                send_credit: u64::from(frame::INITIAL_STREAM_WINDOW),
+                read_waker: None,
+                write_waker: None,
+            },
+        );
+        state.pending_bytes = session.limits.pending_bytes_per_session;
+    }
+    let body = frame::encode(FrameType::Data, 1, &[1]);
+
+    assert_eq!(
+        session.process_up(1, &body),
+        Err(ManagerError::Backpressure)
+    );
+    let state = session.state.lock();
+    assert!(!state.closed);
+    assert_eq!(state.last_up_sequence, 0);
+    assert!(state.streams.get(&1).unwrap().inbound.is_empty());
+}
+
+#[test]
+fn uplink_gap_is_fatal() {
+    let session = session();
+    let body = frame::encode(FrameType::Pong, 0, &[]);
+    assert_eq!(session.process_up(2, &body), Err(ManagerError::Protocol));
+    assert!(session.state.lock().closed);
+}
+
+#[test]
+fn automatic_uplink_does_not_ack_a_batch_without_real_progress() {
+    let session = session_with_automatic(true);
+    let body = frame::encode(FrameType::Pong, 0, &[]);
+
+    assert_eq!(
+        session.process_up(1, &body),
+        Err(ManagerError::Backpressure)
+    );
+    assert!(!session.is_carrier_committed());
+    assert!(!session.state.lock().closed);
+}
```

#### Recent Merged Pull Requests:
- **PR #949** (2026-10-05): ME: Autonomous&Lifecycle-bounded Pool Convergence (@axkurcom)
- **PR #948** (2026-10-04): WEB: Resolve opt-in decoy hostnames during config preparation (@axkurcom)
- **PR #946** (2026-10-03): Bounded WEB HTTP conveyor with replay-safe streaming downlink added (@axkurcom)
- **PR #945** (2026-10-03): Bump -> 3.5.12 (@axkurcom)
- **PR #944** (2026-10-03): ME NAT Discovery Cancellation correctness (@axkurcom)
- **PR #943** (2026-10-03): Configurable HTTP Methods for Bridge Carriers + Fix autonomous ME recovery from Direct fallback (@axkurcom)
- **PR #942** (2026-10-02): docs(web): add Caddy TLS termination example (@nomah4)
- **PR #939** (2026-10-01): Сonntrack recovery on absent iptables-nft chains fixes (@axkurcom)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
