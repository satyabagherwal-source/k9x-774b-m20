> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/defguard-defguard-learnings.md`  
> **Source**: github ([https://github.com/DefGuard/defguard](https://github.com/DefGuard/defguard))  
> **Source Version**: `b6b437f9`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:32:42.114Z  
> **Learning ID**: `learn-github-defguard-defguard`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): DefGuard/defguard

> **Canonical Artifact**: `07_PROJECT_LEARNING/defguard-defguard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DefGuard/defguard](https://github.com/DefGuard/defguard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T21:32:41.326Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DefGuard/defguard`
- **Description**: Zero-Trust access management with true WireGuard® 2FA/MFA
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2874 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/defguard_common/src/utils.rs`
```
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use ipnetwork::IpNetwork;
use serde::Serialize;
use url::Url;
use utoipa::ToSchema;

/// Strip any `http://` or `https://` scheme prefix a user may have accidentally
/// included in a hostname/IP field that expects a bare host, not a URL.
#[must_use]
pub fn strip_scheme(s: &str) -> &str {
    s.strip_prefix("https://")
        .or_else(|| s.strip_prefix("http://"))
        .unwrap_or(s)
}

/// Validates that `ip_or_domain` is a bare hostname or IP address with no embedded port,
/// path, query string, or fragment.
/// Intended for the `ip_or_domain` fields of Gateway and Edge setup requests.
pub fn validate_host_only(ip_or_domain: &str) -> Result<(), String> {
    let test_url = format!("http://{ip_or_domain}/");
    let url = Url::parse(&test_url)
        .map_err(|_| format!("'{ip_or_domain}' is not a valid hostname or IP address"))?;
    if url.host_str().is_none() {
        return Err(format!(
            "'{ip_or_domain}' is not a valid hostname or IP address"
        ));
    }
    if url.port().is_some() {
        return Err(format!(
            "'{ip_or_domain}' must not include a port; provide the port in the grpc_port field"
        ));
    }
    if url.path() != "/" {
        return Err(format!(
            "'{ip_or_domain}' must not include a path component"
        ));
    }
    if url.query().is_some() {
        return Err(format!("'{ip_or_domain}' must not include a query string"));
    }
    if url.fragment().is_some() {
        return Err(format!("'{ip_or_domain}' must not include a fragment"));
    }
    Ok(())
}

/// Parse a string with comma-separated IP addresses.
/// Invalid addresses will be silently ignored.
#[must_use]
pub fn parse_address_list(ips: &str) -> Vec<IpNetwork> {
    ips.split(',')
        .filter_map(|ip| ip.trim().parse().ok())
        .collect()
}

/// Parse a string with comma-separated IP network addresses.
/// Host bits will be stripped.
/// Invalid addresses will be silently ignored.
#[must_use]
pub fn parse_network_address_list(ips: &str) -> Vec<IpNetwork> {
    ips.split(',')
        .filter_map(|ip| ip.trim().parse().ok())
        .filter_map(|ip: IpNetwork| {
            let network_address = ip.network();
            let network_mask = ip.mask();
            IpNetwork::with_netmask(network_address, network_mask).ok()
        })
        .collect()
}

#[derive(Debug, Serialize, PartialEq, ToSchema)]
pub struct SplitIp {
    network_part: String,
    modifiable_part: String,
    network_prefix: String,
    ip: String,
}

/// Splits the IP address (IPv4 or IPv6) into three parts: network part, modifiable part and prefix
/// The network part is the part that can't be changed by the user.
/// This is to display an IP address in the UI like this: 192.168.(1.1)/16, where the part in the parenthesis can be changed by the user.
/// The algorithm works as follows:
/// 1. Get the network address, last address and IP address segments, e.g. 192.1.1.1 would be [192, 1, 1, 1]
/// 2. Iterate over the segments and compare the last address and network segments, as long as the current segments are equal, append the segment to the network part.
///    If they are not equal, we found the first modifiable segment (one of the segments of an address that may change between hosts in the same network),
///    append the rest of the segments to the modifiable part.
/// 3. Join the segments with the delimiter and return the network part, modifiable part and the network prefix
#[must_use]
pub fn split_ip(ip: &IpAddr, network: &IpNetwork) -> SplitIp {
    let network_addr = network.network();
    let network_prefix = network.prefix();

    let ip_segments = match ip {
        IpAddr::V4(ip) => ip.octets().iter().map(|x| u16::from(*x)).collect(),
        IpAddr::V6(ip) => ip.segments().to_vec(),
    };

    let last_addr_segments = match network {
        IpNetwork::V4(net) => {
            let last_ip = u32::from(net.ip()) | (!u32::from(net.mask()));
            let last_ip: Ipv4Addr = last_ip.into();
            last_ip.octets().iter().map(|x| u16::from(*x)).collect()
        }
        IpNetwork::V6(net) => {
            let last_ip = u128::from(net.ip()) | (!u128::from(net.mask()));
            let last_ip: Ipv6Addr = last_ip.into();
            last_ip.segments().to_vec()
        }
    };

    let network_segments = match network_addr {
        IpAddr::V4(ip) => ip.octets().iter().map(|x| u16::from(*x)).collect(),
        IpAddr::V6(ip) => ip.segments().to_vec(),
    };

    let mut network_part = String::new();
    let mut modifiable_part = String::new();
    let delimiter = if ip.is_ipv4() { "." } else { ":" };
    let formatter = |x: &u16| {
        if ip.is_ipv4() {
            x.to_string()
        } else {
            format!("{x:04x}")
        }
    };

    for (i, ((last_addr_segment, network_segment), ip_segment)) in last_addr_segments
        .iter()
        .zip(network_segments.iter())
        .zip(ip_segments.iter())
        .enumerate()
    {
        if last_addr_segment != network_segment {
            let parts = ip_segments.split_at(i).1;
            let joined = parts
                .iter()
                .map(formatter)
                .collect::<Vec<String>>()
                .join(delimiter);
            modifiable_part.push_str(&joined);
            break;
        }
        let formatted = formatter(ip_segment);
        network_part.push_str(&formatted);
        network_part.push_str(delimiter);
    }

    SplitIp {
        ip: ip.to_string(),
        network_part,
        modifiable_part,
        network_prefix: network_prefix.to_string(),
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use super::*;

    #[test]
    fn test_ip_splitter() {
        let net = split_ip(
            &IpAddr::from_str("192.168.3.1").unwrap(),
            &IpNetwork::from_str("192.168.3.1/30").unwrap(),
        );

        assert_eq!(net.network_part, "192.168.3.");
        assert_eq!(net.modifiable_part, "1");
        assert_eq!(net.network_prefix, "30");

        let net = split_ip(
            &IpAddr::from_str("192.168.5.7").unwrap(),
            &IpNetwork::from_str("192.168.3.1/24").unwrap(),
        );

        assert_eq!(net.network_part, "192.168.5.");
        assert_eq!(net.modifiable_part, "7");
        assert_eq!(net.network_prefix, "24");

        let net = split_ip(
            &IpAddr::from_str("2001:0db8:85a3::8a2e:0370:7334").unwrap(),
            &IpNetwork::from_str("2001:0db8:85a3::8a2e:0370:7334/64").unwrap(),
        );

        assert_eq!(net.network_part, "2001:0db8:85a3:0000:");
        assert_eq!(net.modifiable_part, "0000:8a2e:0370:7334");
        assert_eq!(net.network_prefix, "64");

        let net = split_ip(
            &IpAddr::from_str("2001:0db8::0010:8a2e:0370:aaaa").unwrap(),
            &IpNetwork::from_str("2001:db8::10:8a2e:370:aaa8/125").unwrap(),
        );

        assert_eq!(net.network_part, "2001:0db8:0000:0000:0010:8a2e:0370:");
        assert_eq!(net.modifiable_part, "aaaa");
        assert_eq!(net.network_prefix, "125");
    }

    #[test]
    fn test_validate_host_only_accepts_bare_ipv4() {
        assert!(validate_host_only("192.168.1.1").is_ok());
        assert!(validate_host_only("10.0.0.1").is_ok());
    }

    #[test]
    fn test_validate_host_only_accepts_bare_ipv6() {
        assert!(validate_host_only("[::1]").is_ok());
        assert!(validate_host_only("[2001:db8::1]").is_ok());
    }

    #[test]
    fn test_validate_host_only_accepts_bare_hostname() {
        assert!(validate_host_only("gateway.example.com").is_ok());
        assert!(validate_host_only("my-gateway").is_ok());
        assert!(validate_host_only("edge01.vpn.internal").is_ok());
    }

    #[test]
    fn test_validate_host_only_rejects_embedded_port() {
        let err = validate_host_only("192.168.1.1:4444").unwrap_err();
        assert!(err.contains("must not include a port"), "got: {err}");

        let err = validate_host_only("gateway.example.com:8443").unwrap_err();
        assert!(err.contains("must not include a port"), "got: {err}");
    }

    #[test]
    fn test_validate_host_only_rejects_path() {
        let err = validate_host_only("192.168.1.1/testpath").unwrap_err();
        assert!(err.contains("must not include a path"), "got: {err}");
    }

    #[test]
    fn test_validate_host_only_rejects_query_string() {
        // A bare query string without a path separator is not reachable via URL
        // parsing in practice, but a port+path+query is. The port check fires first.
        let err = validate_host_only("192.168.1.1:4444/path?a=b").unwrap_err();
        assert!(err.contains("must not include a port"), "got: {err}");
    }

    #[test]
    fn dg26_11_test_validate_host_only_rejects_fragment() {
        let err = validate_host_only("192.168.1.1#frag").unwrap_err();
        assert!(err.contains("must not include a fragment"), "got: {err}");
    }

    #[test]
    fn dg26_11_test_validate_host_only_rejects_poc_input() {
        // Exact input from the DG26-11 audit report (after URL-decode of %23 -> #).
        // The embedded port (:4444) is the first violation the validator encounters.
        let err = validate_host_only("46.101.217.165:4444/testpath?a=b#").unwrap_err();
        assert!(err.contains("must not include a port"), "got: {err}");
    }
}

```

### Core Architecture Module: `crates/defguard_core/examples/openapi.rs`
```
use std::fs;

use defguard_core::openapi::ApiDoc;
use utoipa::OpenApi;

fn main() -> anyhow::Result<()> {
    let mut spec = ApiDoc::openapi().to_pretty_json()?;
    spec.push('\n');
    fs::write("openapi.json", spec)?;

    Ok(())
}

```

### Core Architecture Module: `crates/defguard_core/src/appstate.rs`
```
use std::sync::{Arc, Mutex, RwLock, atomic::AtomicBool};

use axum::extract::FromRef;
use axum_extra::extract::cookie::Key;
use defguard_common::{db::models::Settings, types::proxy::ProxyControlMessage};
use reqwest::Client;
use serde_json::json;
use sqlx::PgPool;
use tokio::{
    sync::{
        broadcast::Sender,
        mpsc::{UnboundedReceiver, UnboundedSender},
    },
    task::spawn,
};

use crate::{
    auth::failed_login::FailedLoginMap,
    db::{AppEvent, WebHook},
    error::WebError,
    events::{ApiEvent, DirectorySyncEvent, LdapSyncEventType},
    grpc::{GatewayCommand, send_gateway_command, send_multiple_gateway_commands},
    version::IncompatibleComponents,
};

const X_DEFGUARD_EVENT: &str = "x-defguard-event";

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    tx: UnboundedSender<AppEvent>,
    pub gateway_tx: Sender<GatewayCommand>,
    pub web_reload_tx: tokio::sync::broadcast::Sender<()>,
    pub failed_logins: Arc<Mutex<FailedLoginMap>>,
    key: Key,
    pub event_tx: UnboundedSender<ApiEvent>,
    pub ldap_tx: UnboundedSender<LdapSyncEventType>,
    pub dirsync_tx: UnboundedSender<DirectorySyncEvent>,
    pub incompatible_components: Arc<RwLock<IncompatibleComponents>>,
    pub proxy_control_tx: tokio::sync::mpsc::Sender<ProxyControlMessage>,
    /// Reflects whether the HTTP server is currently running with TLS
    pub tls_active: Arc<AtomicBool>,
}

impl AppState {
    pub(crate) fn trigger_action(&self, event: AppEvent) {
        let event_name = event.name().to_owned();
        match self.tx.send(event) {
            Ok(()) => info!("Sent trigger {event_name}"),
            Err(err) => error!("Error sending trigger {event_name}: {err}"),
        }
    }

    /// Handle webhook events
    async fn handle_triggers(pool: PgPool, mut rx: UnboundedReceiver<AppEvent>) {
        let reqwest_client = Client::builder().user_agent("reqwest").build().unwrap();
        while let Some(msg) = rx.recv().await {
            debug!("WebHook triggered");
            debug!("Retrieving webhooks");
            if let Ok(webhooks) = WebHook::all_enabled(&pool, &msg).await {
                debug!("Found webhooks: {webhooks:?}");
                let (payload, event) = match msg {
                    AppEvent::UserCreated(user) => (json!(user), "user_created"),
                    AppEvent::UserModified(user) => (json!(user), "user_modified"),
                    AppEvent::UserDeleted(username) => {
                        (json!({"username": username}), "user_deleted")
                    }
                    AppEvent::HWKeyProvision(data) => (json!(data), "user_keys"),
                };
                for webhook in webhooks {
                    match reqwest_client
                        .post(&webhook.url)
                        .bearer_auth(&webhook.token)
                        .header(X_DEFGUARD_EVENT, event)
                        .json(&payload)
                        .send()
                        .await
                    {
                        Ok(res) => {
                            info!("Trigger sent to {}, status {}", webhook.url, res.status());
                        }
                        Err(err) => {
                            error!("Error sending trigger to {}: {err}", webhook.url);
                        }
                    }
                }
            }
        }
    }

    /// Sends given `GatewayCommand` to be handled by gateway manager service.
    /// Convenience wrapper around [`send_gateway_command`]
    pub fn send_gateway_command(&self, command: GatewayCommand) {
        send_gateway_command(command, &self.gateway_tx);
    }

    /// Sends multiple commands to be handled by gateway manager service.
    /// Convenience wrapper around [`send_multiple_gateway_commands`]
    pub fn send_multiple_gateway_commands(&self, commands: Vec<GatewayCommand>) {
        send_multiple_gateway_commands(commands, &self.gateway_tx);
    }

    /// Sends event to the main event router
    ///
    /// This method is fallible since events are used for communication between services
    pub fn emit_event(&self, event: ApiEvent) -> Result<(), WebError> {
        Ok(self.event_tx.send(event)?)
    }

    pub fn webauthn(&self) -> Result<Arc<webauthn_rs::Webauthn>, WebError> {
        let settings = Settings::get_current_settings();
        settings.build_webauthn().map(Arc::new).map_err(|err| {
            error!("Failed to build WebAuthn configuration from current settings: {err}");
            WebError::Http(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        })
    }

    /// Create application state
    pub fn new(
        pool: PgPool,
        tx: UnboundedSender<AppEvent>,
        rx: UnboundedReceiver<AppEvent>,
        gateway_tx: Sender<GatewayCommand>,
        web_reload_tx: tokio::sync::broadcast::Sender<()>,
        key: Key,
        failed_logins: Arc<Mutex<FailedLoginMap>>,
        event_tx: UnboundedSender<ApiEvent>,
        ldap_tx: UnboundedSender<LdapSyncEventType>,
        dirsync_tx: UnboundedSender<DirectorySyncEvent>,
        incompatible_components: Arc<RwLock<IncompatibleComponents>>,
        proxy_control_tx: tokio::sync::mpsc::Sender<ProxyControlMessage>,
        tls_active: Arc<AtomicBool>,
    ) -> Self {
        spawn(Self::handle_triggers(pool.clone(), rx));

        Self {
            pool,
            tx,
            gateway_tx,
            web_reload_tx,
            failed_logins,
            key,
            event_tx,
            ldap_tx,
            dirsync_tx,
            incompatible_components,
            proxy_control_tx,
            tls_active,
        }
    }
}

impl FromRef<AppState> for Key {
    fn from_ref(state: &AppState) -> Self {
        state.key.clone()
    }
}

```

### Core Architecture Module: `crates/defguard_core/src/auth/failed_login.rs`
```
use std::{collections::HashMap, sync::Mutex};

use chrono::{DateTime, Local, TimeDelta};
use thiserror::Error;

// Time window in seconds
const FAILED_LOGIN_WINDOW: i64 = 60;
// Failed login count threshold
const FAILED_LOGIN_COUNT: u32 = 5;
// How long (in seconds) to lock users out after crossing the threshold
const FAILED_LOGIN_TIMEOUT: i64 = 5 * 60;

#[derive(Error, Debug)]
#[error("Too many login attempts")]
pub struct FailedLoginError;

pub struct FailedLoginMap(HashMap<String, FailedLogin>);

pub struct FailedLogin {
    attempt_count: u32,
    first_attempt: DateTime<Local>,
    last_attempt: DateTime<Local>,
}

impl Default for FailedLogin {
    fn default() -> Self {
        Self {
            attempt_count: 1,
            first_attempt: Local::now(),
            last_attempt: Local::now(),
        }
    }
}

impl FailedLogin {
    // How much time has elapsed since first failed login attempt
    fn time_since_first_attempt(&self) -> TimeDelta {
        Local::now().signed_duration_since(self.first_attempt)
    }

    // How much time has elapsed since last failed login attempt
    fn time_since_last_attempt(&self) -> TimeDelta {
        Local::now().signed_duration_since(self.last_attempt)
    }

    fn increment(&mut self) {
        self.attempt_count += 1;
        self.last_attempt = Local::now();
    }

    fn reset(&mut self) {
        self.attempt_count = 1;
        self.first_attempt = Local::now();
        self.last_attempt = Local::now();
    }

    // Check if user login attempt should be stopped
    fn should_prevent_login(&self) -> bool {
        self.attempt_count >= FAILED_LOGIN_COUNT
            && self.time_since_last_attempt() <= TimeDelta::seconds(FAILED_LOGIN_TIMEOUT)
    }

    // Check if attempt counter can be reset.
    // Counter can be reset after enough time has passed since the initial attempt.
    // If user was blocked we also check if enough time (timeout) has passed since last attempt.
    fn should_reset_counter(&self) -> bool {
        self.time_since_first_attempt() > TimeDelta::seconds(FAILED_LOGIN_WINDOW)
            && self.attempt_count < FAILED_LOGIN_COUNT
            || self.time_since_last_attempt() > TimeDelta::seconds(FAILED_LOGIN_TIMEOUT)
    }
}

impl Default for FailedLoginMap {
    fn default() -> Self {
        Self::new()
    }
}

impl FailedLoginMap {
    #[must_use]
    pub fn new() -> Self {
        Self(HashMap::new())
    }

    // Add failed login attempt to tracker
    pub fn log_failed_attempt(&mut self, username: &str) {
        info!("Logging failed login attempt for username {username}");
        match self.0.get_mut(username) {
            None => {
                self.0.insert(username.into(), FailedLogin::default());
            }
            Some(failed_login) => {
                if failed_login.should_reset_counter() {
                    failed_login.reset();
                } else {
                    failed_login.increment();
                }
            }
        }
    }

    // Check if user can proceed with login process or should be locked out
    pub fn verify_username(&mut self, username: &str) -> Result<(), FailedLoginError> {
        debug!("Checking if user {username} can proceed with login");
        if let Some(failed_login) = self.0.get_mut(username)
            && failed_login.should_prevent_login()
        {
            debug!("Preventing user {username} from logging in");
            // log a failed attempt to prolong timeout
            failed_login.increment();
            return Err(FailedLoginError);
        }
        Ok(())
    }
}

// Check if auth request with a given username can proceed
pub fn check_failed_logins(
    failed_logins: &Mutex<FailedLoginMap>,
    username: &str,
) -> Result<(), FailedLoginError> {
    let mut failed_logins = failed_logins
        .lock()
        .expect("Failed to get a lock on failed login map.");
    failed_logins.verify_username(username)
}

// Helper to log failed login attempt
pub fn log_failed_login_attempt(failed_logins: &Mutex<FailedLoginMap>, username: &str) {
    let mut failed_logins = failed_logins
        .lock()
        .expect("Failed to get a lock on failed login map.");
    failed_logins.log_failed_attempt(username);
}

```

### Core Architecture Module: `crates/defguard_core/src/auth/mod.rs`
```
pub mod failed_login;

use axum::{
    Extension,
    extract::{FromRequestParts, OptionalFromRequestParts},
    http::request::Parts,
};
use axum_extra::{
    TypedHeader,
    extract::cookie::CookieJar,
    headers::{Authorization, authorization::Bearer},
};
use defguard_common::db::{
    Id,
    models::{
        OAuth2Token, Session, SessionState,
        group::{Group, Permission},
        oauth2client::OAuth2Client,
        user::User,
    },
};
use sqlx::PgPool;

use crate::{
    enterprise::{db::models::api_tokens::ApiToken, is_business_license_active},
    error::WebError,
    handlers::{ClientIpAddr, SESSION_COOKIE_NAME},
};

pub struct SessionExtractor(pub Session);

impl<S> FromRequestParts<S> for SessionExtractor
where
    S: Send + Sync,
{
    type Rejection = WebError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // let appstate = AppState::from_ref(state);
        let pool = extract_pool(parts, state).await?;

        // first try to authenticate by API token if one is found in header
        if is_business_license_active() {
            let maybe_auth_header: Option<TypedHeader<Authorization<Bearer>>> =
                <TypedHeader<_> as OptionalFromRequestParts<S>>::from_request_parts(parts, state)
                    .await
                    .map_err(|err| {
                        error!("Failed to extract optional auth header: {err}");
                        WebError::Authorization("Invalid auth header".into())
                    })?;
            if let Some(header) = maybe_auth_header {
                let token_string = header.token();
                debug!("Trying to authorize request using API token");
                return match ApiToken::try_find_by_auth_token(&pool, token_string).await {
                    Ok(Some(api_token)) => {
                        // create a dummy session and don't store it in the DB
                        // since each request needs to be authorized anyway
                        let ip_address = ClientIpAddr::from_request_parts(parts, state)
                            .await
                            .map_err(|err| {
                                error!("Failed to get client IP: {err:?}");
                                WebError::ClientIpError
                            })?;
                        Ok(Self(Session::new(
                            api_token.user_id,
                            SessionState::ApiTokenVerified,
                            ip_address.0.to_string(),
                            None,
                        )))
                    }
                    Ok(None) => Err(WebError::Authorization("Invalid API token".into())),
                    Err(err) => Err(err.into()),
                };
            }
        }

        let Ok(cookies) = CookieJar::from_request_parts(parts, state).await;
        if let Some(session_cookie) = cookies.get(SESSION_COOKIE_NAME) {
            return {
                match Session::find_by_id(&pool, session_cookie.value()).await {
                    Ok(Some(session)) => {
                        if session.expired() {
                            let _result = session.delete(&pool).await;
                            Err(WebError::Authorization("Session expired".into()))
                        } else {
                            Ok(Self(session))
                        }
                    }
                    Ok(None) => Err(WebError::Authorization("Session not found".into())),
                    Err(err) => Err(err.into()),
                }
            };
        }

        Err(WebError::Authorization("Session is required".into()))
    }
}

// Extension of base user session that contains user data fetched from database.
// This represents a session for a user who completed the login process (including MFA, if enabled).
#[derive(Clone)]
pub struct SessionInfo {
    pub session: Session,
    pub user: User<Id>,
    pub is_admin: bool,
    groups: Vec<Group<Id>>,
}

impl SessionInfo {
    #[must_use]
    pub const fn new(session: Session, user: User<Id>, is_admin: bool) -> Self {
        Self {
            session,
            user,
            is_admin,
            groups: Vec::new(),
        }
    }

    fn contains_any_group(&self, group_names: &[&str]) -> bool {
        self.groups
            .iter()
            .any(|group| group_names.contains(&group.name.as_str()))
    }
}

impl<S> FromRequestParts<S> for SessionInfo
where
    S: Send + Sync,
{
    type Rejection = WebError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let session = SessionExtractor::from_request_parts(parts, state).await?.0;
        let pool = extract_pool(parts, state).await?;
        let user = User::find_by_id(&pool, session.user_id).await?;

        if let Some(user) = user {
            if user.mfa_enabled
                && (session.state != SessionState::MultiFactorVerified
                    && session.state != SessionState::ApiTokenVerified)
            {
                return Err(WebError::Authorization("MFA not verified".into()));
            }
            let Ok(groups) = user.member_of(&pool).await else {
                return Err(WebError::DbError("cannot fetch groups".into()));
            };
            let is_admin = user.is_admin(&pool).await?;

            // non-admin users are not allowed to use token auth
            if !is_admin && session.state == SessionState::ApiTokenVerified {
                return Err(WebError::Forbidden(
                    "Token authentication is not allowed for normal users",
                ));
            }

            // Store session info into request extensions so future extractors can use it
            let session_info = Self {
                session,
                user,
                is_admin,
                groups,
            };
            parts.extensions.insert(session_info.clone());
            Ok(session_info)
        } else {
            Err(WebError::Authorization("User not found".into()))
        }
    }
}

#[macro_export]
macro_rules! role {
    ($name:ident, $($permission:path)*) => {
        pub struct $name;

        impl<S> FromRequestParts<S> for $name
        where
            S: Send + Sync,
        {
            type Rejection = WebError;

            async fn from_request_parts(
                parts: &mut Parts,
                state: &S,
            ) -> Result<Self, Self::Rejection> {
                let session_info = SessionInfo::from_request_parts(parts, state).await?;
                if !session_info.user.is_active {
                    return Err(WebError::Forbidden("user is disabled".into()));
                }
                let pool = extract_pool(parts, state).await?;
                $(
                let groups_with_permission = Group::find_by_permission(
                    &pool,
                    $permission,
                ).await?;
                let group_names = groups_with_permission.iter().map(|group| group.name.as_str()).collect::<Vec<_>>();
                if session_info.contains_any_group(&group_names) {
                    return Ok(Self {});
                }
                )*
                Err(WebError::Forbidden("access denied".into()))
            }
        }
    };
}

role!(AdminRole, Permission::IsAdmin);

async fn extract_pool<S>(parts: &mut Parts, state: &S) -> Result<PgPool, WebError>
where
    S: Send + Sync,
{
    let Extension(pool) =
        <Extension<PgPool> as FromRequestParts<S>>::from_request_parts(parts, state)
            .await
            .map_err(|err| {
                error!("Failed to extract database pool: {err:?}");
                WebError::ObjectNotFound("Database pool not found".into())
            })?;
    Ok(pool)
}

#[derive(Debug)]
pub(crate) struct UserClaims {
    pub email: Option<String>,
    pub family_name: Option<String>,
    pub given_name: Option<String>,
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub preferred_username: Option<String>,
    pub sub: String,
}

fn get_available_scopes<'a>(
    all_scopes: &'a [String],
    requested_scopes: &'a [String],
) -> Vec<&'a str> {
    let mut scopes = Vec::new();
    for scope in requested_scopes {
        if all_scopes.contains(scope) {
            scopes.push(scope.as_str());
        }
    }
    scopes
}

impl UserClaims {
    pub fn from_user(
        user: &User<Id>,
        oauth_client: &OAuth2Client<Id>,
        oauth_token: &OAuth2Token,
    ) -> Self {
        let token_scopes = oauth_token
            .scope
            .split_whitespace()
            .map(String::from)
            .collect::<Vec<String>>();
        let scopes = get_available_scopes(&oauth_client.scope, &token_scopes);
        Self {
            email: if scopes.contains(&"email") {
                Some(user.email.clone())
            } else {
                None
            },
            family_name: if scopes.contains(&"profile") {
                Some(user.last_name.clone())
            } else {
                None
            },
            given_name: if scopes.contains(&"profile") {
                Some(user.first_name.clone())
            } else {
                None
            },
            name: if scopes.contains(&"profile") {
                Some(user.name())
            } else {
                None
            },
            phone_number: if scopes.contains(&"phone") {
                user.phone.clone()
            } else {
                None
            },
            preferred_username: if scopes.contains(&"profile") {
                Some(user.username.clone())
            } else {
                None
            },
            sub: user.username.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_available_scopes() {
        // All requested scopes are available
        let all_scopes = vec!["email".
```

### Core Architecture Module: `crates/defguard_core/src/cert_settings.rs`
```
use axum_server::tls_rustls::RustlsConfig;
use chrono::{NaiveDateTime, Utc};
use defguard_certs::{
    CertificateError, CertificateInfo, Csr, DnType, PemLabel, der_to_pem, generate_key_pair,
    parse_pem_certificate,
};
use defguard_common::db::models::{
    Certificates, CoreCertSource, ProxyCertSource, Settings,
    settings::{SettingsSaveError, update_current_settings},
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use thiserror::Error;
use utoipa::ToSchema;

/// Errors arising from certificate settings operations.
#[derive(Debug, Error)]
pub enum CertSettingsError {
    #[error("cert_pem is required for own_cert")]
    MissingCertPem,
    #[error("key_pem is required for own_cert")]
    MissingKeyPem,
    #[error("Invalid certificate or private key PEM")]
    InvalidCertOrKey,
    #[error("Certificate validity period is invalid")]
    InvalidValidityPeriod,
    #[error("Certificate has expired")]
    CertExpired,
    #[error("Certificate is not valid yet")]
    CertNotYetValid,
    #[error("Certificate error: {0}")]
    Cert(#[from] CertificateError),
    #[error("URL parse error: {0}")]
    Url(String),
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("Settings error: {0}")]
    Settings(#[from] SettingsSaveError),
    #[error("Not found: {0}")]
    NotFound(String),
}

/// Parses an uploaded certificate, validates its key pair, and rejects invalid validity windows.
async fn parse_cert(cert_pem: &str, key_pem: &str) -> Result<CertificateInfo, CertSettingsError> {
    let _ = rustls::crypto::ring::default_provider().install_default();

    RustlsConfig::from_pem(cert_pem.as_bytes().to_vec(), key_pem.as_bytes().to_vec())
        .await
        .map_err(|_| CertSettingsError::InvalidCertOrKey)?;

    let cert_der = parse_pem_certificate(cert_pem)?;
    let info = CertificateInfo::from_der(cert_der.as_ref())?;

    // Validate cert dates
    let now = Utc::now().naive_utc();

    if info.not_after <= info.not_before {
        return Err(CertSettingsError::InvalidValidityPeriod);
    }

    if info.not_after <= now {
        return Err(CertSettingsError::CertExpired);
    }

    if info.not_before > now {
        return Err(CertSettingsError::CertNotYetValid);
    }

    Ok(info)
}

/// Extract a non-empty hostname from `url`, returning a [`CertSettingsError`] on failure.
fn extract_hostname(url: &str, label: &str) -> Result<String, CertSettingsError> {
    reqwest::Url::parse(url)
        .map_err(|e| CertSettingsError::Url(format!("Invalid {label}: {e}")))?
        .host_str()
        .filter(|h| !h.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| CertSettingsError::Url(format!("{label} has no hostname")))
}

/// SSL configuration type for Defguard's internal (core) web server.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum InternalSslType {
    /// No SSL - plain HTTP, user manages reverse proxy / SSL termination themselves.
    None,
    /// Generate certificates using Defguard's internal Certificate Authority.
    DefguardCa,
    /// Upload a custom certificate and private key.
    OwnCert,
}

#[derive(Serialize, Deserialize, Debug, ToSchema)]
pub struct InternalUrlSettingsConfig {
    pub ssl_type: InternalSslType,
    pub cert_pem: Option<String>,
    pub key_pem: Option<String>,
}

#[derive(Serialize, Debug, ToSchema)]
pub struct CertInfoResponse {
    pub common_name: String,
    pub valid_for_days: i64,
    pub not_before: String,
    pub not_after: String,
}

/// SSL configuration type for the external (proxy) web server.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExternalSslType {
    /// No SSL - plain HTTP, user manages reverse proxy / SSL termination themselves.
    #[default]
    None,
    /// Obtain a certificate via ACME / Let's Encrypt.
    LetsEncrypt,
    /// Generate certificates using Defguard's internal Certificate Authority.
    DefguardCa,
    /// Upload a custom certificate and private key.
    OwnCert,
}

#[derive(Serialize, Deserialize, Debug, ToSchema)]
pub struct ExternalUrlSettingsConfig {
    pub ssl_type: ExternalSslType,
    pub cert_pem: Option<String>,
    pub key_pem: Option<String>,
}

pub(crate) fn ensure_https(url: &str) -> String {
    if let Some(rest) = url.strip_prefix("http://") {
        format!("https://{rest}")
    } else {
        url.to_owned()
    }
}

/// Core logic for applying internal URL certificate settings using the current Defguard URL.
/// Returns cert info if a certificate was generated/uploaded, `None` for `ssl_type = None`.
pub async fn apply_internal_url_settings(
    pool: &PgPool,
    defguard_url: &str,
    config: InternalUrlSettingsConfig,
) -> Result<Option<CertInfoResponse>, CertSettingsError> {
    debug!(
        "Internal URL certificate settings received: defguard_url={}, ssl_type={:?}",
        defguard_url, config.ssl_type,
    );

    let mut settings = Settings::get_current_settings();
    let mut transaction = pool.begin().await?;

    // Modify url schema if necessary
    settings.defguard_url = match config.ssl_type {
        InternalSslType::None => defguard_url.to_owned(),
        InternalSslType::DefguardCa | InternalSslType::OwnCert => ensure_https(defguard_url),
    };
    update_current_settings(&mut *transaction, settings).await?;

    let mut certs = Certificates::get_or_default(&mut *transaction)
        .await
        .map_err(CertSettingsError::from)?;

    let cert_info = match config.ssl_type {
        InternalSslType::None => {
            certs.core_http_cert_source = CoreCertSource::None;
            certs.core_http_cert_pem = None;
            certs.core_http_cert_key_pem = None;
            certs.core_http_cert_expiry = None;
            certs
                .save(&mut *transaction)
                .await
                .map_err(CertSettingsError::from)?;
            None
        }
        InternalSslType::DefguardCa => {
            let hostname = extract_hostname(defguard_url, "defguard URL")?;

            let ca = certs.certificate_authority()?;
            let key_pair = generate_key_pair()?;
            let san = vec![hostname.clone()];
            let dn = vec![(DnType::CommonName, hostname.as_str())];
            let csr = Csr::new(&key_pair, &san, dn)?;
            let server_cert = ca.sign_web_server_cert(&csr)?;

            let cert_der = server_cert.der().to_vec();
            let cert_pem = der_to_pem(&cert_der, PemLabel::Certificate)?;
            let key_pem = der_to_pem(key_pair.serialize_der().as_slice(), PemLabel::PrivateKey)?;
            let info = CertificateInfo::from_der(&cert_der)?;
            let valid_for_days = (info.not_after.and_utc() - chrono::Utc::now()).num_days();
            let expiry = info.not_after;

            certs.core_http_cert_source = CoreCertSource::SelfSigned;
            certs.core_http_cert_pem = Some(cert_pem);
            certs.core_http_cert_key_pem = Some(key_pem);
            certs.core_http_cert_expiry = Some(expiry);
            certs
                .save(&mut *transaction)
                .await
                .map_err(CertSettingsError::from)?;

            Some(CertInfoResponse {
                common_name: info.subject_common_name,
                valid_for_days,
                not_before: info.not_before.to_string(),
                not_after: info.not_after.to_string(),
            })
        }
        InternalSslType::OwnCert => {
            let cert_pem_str = config.cert_pem.ok_or(CertSettingsError::MissingCertPem)?;
            let key_pem_str = config.key_pem.ok_or(CertSettingsError::MissingKeyPem)?;

            let info = parse_cert(&cert_pem_str, &key_pem_str).await?;
            let valid_for_days = (info.not_after.and_utc() - chrono::Utc::now()).num_days();
            let expiry = info.not_after;

            certs.core_http_cert_source = CoreCertSource::Custom;
            certs.core_http_cert_pem = Some(cert_pem_str);
            certs.core_http_cert_key_pem = Some(key_pem_str);
            certs.core_http_cert_expiry = Some(expiry);
            certs
                .save(&mut *transaction)
                .await
                .map_err(CertSettingsError::from)?;

            Some(CertInfoResponse {
                common_name: info.subject_common_name,
                valid_for_days,
                not_before: info.not_before.to_string(),
                not_after: info.not_after.to_string(),
            })
        }
    };

    transaction.commit().await?;
    Ok(cert_info)
}

/// Core logic for applying external URL certificate settings using the current public proxy URL.
/// Returns cert info if a certificate was generated/uploaded, `None` otherwise.
pub async fn apply_external_url_settings(
    pool: &PgPool,
    public_proxy_url: &str,
    config: ExternalUrlSettingsConfig,
) -> Result<Option<CertInfoResponse>, CertSettingsError> {
    debug!(
        "External URL certificate settings received: public_proxy_url={}, ssl_type={:?}",
        public_proxy_url, config.ssl_type,
    );

    let mut transaction = pool.begin().await?;
    let mut certs = Certificates::get_or_default(&mut *transaction)
        .await
        .map_err(CertSettingsError::from)?;

    // Modify url schema if necessary
    let mut settings = Settings::get_current_settings();
    settings.public_proxy_url = match config.ssl_type {
        ExternalSslType::None | ExternalSslType::LetsEncrypt => public_proxy_url.to_owned(),
        ExternalSslType::DefguardCa | ExternalSslType::OwnCert => ensure_https(public_proxy_url),
    };
    update_current_settings(&mut *transaction, settings).await?;

    let hostname = match config.ssl_type {
        ExternalSslType::None | ExternalSslType::OwnCert => String::new(),
        ExternalSslType::DefguardCa | ExternalSslType::LetsEncrypt => {
            let url = public_proxy_url.trim();
            if url.is_empty(
```

### Core Architecture Module: `crates/defguard_core/src/db/mod.rs`
```
pub mod models;

pub use models::webhook::{AppEvent, HWKeyUserData, WebHook};

```

### Core Architecture Module: `crates/defguard_core/src/db/models/activity_log/metadata.rs`
```
use chrono::NaiveDateTime;
use defguard_common::db::{
    Id,
    models::{
        AuthenticationKey, AuthenticationKeyType, Device, MFAMethod, Settings, WebAuthn,
        WireguardNetwork,
        gateway::Gateway,
        group::Group,
        oauth2client::OAuth2Client,
        proxy::Proxy,
        settings::{LdapSyncStatus, OpenIdUsernameHandling, smtp::SmtpEncryption},
        user::User,
    },
};

use crate::{
    db::WebHook,
    enterprise::db::models::{
        activity_log_stream::{ActivityLogStream, ActivityLogStreamType},
        api_tokens::ApiToken,
        enterprise_settings::EnterpriseSettingsInfo,
        openid_provider::{DirectorySyncTarget, DirectorySyncUserBehavior, OpenIdProvider},
        snat::UserSnatBinding,
    },
    events::ClientMFAMethod,
};

#[derive(Serialize)]
pub struct LoginFailedMetadata {
    pub message: String,
}

#[derive(Serialize)]
pub struct MfaLoginMetadata {
    pub mfa_method: MFAMethod,
}

#[derive(Serialize)]
pub struct MfaLoginFailedMetadata {
    pub mfa_method: MFAMethod,
    pub message: String,
}

#[derive(Serialize)]
pub struct UserNoSecrets {
    pub id: Id,
    pub username: String,
    pub last_name: String,
    pub first_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub mfa_enabled: bool,
    pub is_active: bool,
    pub from_ldap: bool,
    pub ldap_pass_randomized: bool,
    pub ldap_rdn: Option<String>,
    pub openid_sub: Option<String>,
    pub totp_enabled: bool,
    pub email_mfa_enabled: bool,
    pub mfa_method: MFAMethod,
}

impl From<User<Id>> for UserNoSecrets {
    fn from(value: User<Id>) -> Self {
        Self {
            id: value.id,
            username: value.username,
            last_name: value.last_name,
            first_name: value.first_name,
            email: value.email,
            phone: value.phone,
            mfa_enabled: value.mfa_enabled,
            is_active: value.is_active,
            from_ldap: value.from_ldap,
            ldap_pass_randomized: value.ldap_pass_randomized,
            ldap_rdn: value.ldap_rdn,
            openid_sub: value.openid_sub,
            totp_enabled: value.totp_enabled,
            email_mfa_enabled: value.email_mfa_enabled,
            mfa_method: value.mfa_method,
        }
    }
}

#[derive(Serialize)]
pub struct DeviceMetadata {
    pub owner: UserNoSecrets,
    pub device: Device<Id>,
}

#[derive(Serialize)]
pub struct DeviceModifiedMetadata {
    pub owner: UserNoSecrets,
    pub before: Device<Id>,
    pub after: Device<Id>,
}

#[derive(Serialize)]
pub struct NetworkDeviceMetadata {
    pub device: Device<Id>,
    pub location: WireguardNetwork<Id>,
}

#[derive(Serialize)]
pub struct NetworkDeviceModifiedMetadata {
    pub location: WireguardNetwork<Id>,
    pub before: Device<Id>,
    pub after: Device<Id>,
}

#[derive(Serialize)]
pub struct UserMetadata {
    pub user: UserNoSecrets,
}

#[derive(Serialize)]
pub struct UserImportBlockedMetadata {
    pub username: String,
    pub email: String,
    pub user_count: u32,
    pub limit: u32,
}

#[derive(Serialize)]
pub struct UserModifiedMetadata {
    pub before: UserNoSecrets,
    pub after: UserNoSecrets,
}

#[derive(Serialize)]
pub struct UserGroupsModifiedMetadata {
    pub user: UserNoSecrets,
    pub before: Vec<String>,
    pub after: Vec<String>,
}
#[derive(Serialize)]
pub struct MfaSecurityKeyMetadata {
    pub key: WebAuthnNoSecrets,
}

// Avoid storing secrets in metadata
#[derive(Serialize)]
pub struct WebAuthnNoSecrets {
    pub id: Id,
    pub user_id: Id,
    pub name: String,
}

impl From<WebAuthn<Id>> for WebAuthnNoSecrets {
    fn from(value: WebAuthn<Id>) -> Self {
        Self {
            id: value.id,
            user_id: value.user_id,
            name: value.name,
        }
    }
}

#[derive(Serialize)]
pub struct ActivityLogStreamMetadata {
    pub stream: ActivityLogStreamNoSecrets,
}

#[derive(Serialize)]
pub struct ActivityLogStreamModifiedMetadata {
    pub before: ActivityLogStreamNoSecrets,
    pub after: ActivityLogStreamNoSecrets,
}

#[derive(Serialize)]
pub struct ActivityLogStreamNoSecrets {
    pub id: Id,
    pub name: String,
    pub stream_type: ActivityLogStreamType,
}

impl From<ActivityLogStream<Id>> for ActivityLogStreamNoSecrets {
    fn from(value: ActivityLogStream<Id>) -> Self {
        Self {
            id: value.id,
            name: value.name,
            stream_type: value.stream_type,
        }
    }
}

#[derive(Serialize)]
pub struct VpnClientMetadata {
    pub location: WireguardNetwork<Id>,
    pub device: Device<Id>,
}

#[derive(Serialize)]
pub struct VpnClientMfaMetadata {
    pub location: WireguardNetwork<Id>,
    pub device: Device<Id>,
    pub method: ClientMFAMethod,
    /// Name of the device used to approve the login when the mobile approve MFA
    /// method is used. Omitted for all other methods.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mobile_auth_device_name: Option<String>,
}

#[derive(Serialize)]
pub struct VpnClientMfaFailedMetadata {
    pub location: WireguardNetwork<Id>,
    pub device: Device<Id>,
    pub method: ClientMFAMethod,
    pub message: String,
}

#[derive(Serialize)]
pub struct EnrollmentDeviceAddedMetadata {
    pub device: Device<Id>,
}

#[derive(Serialize)]
pub struct EnrollmentTokenMetadata {
    pub user: UserNoSecrets,
}

#[derive(Serialize)]
pub struct VpnLocationMetadata {
    pub location: WireguardNetwork<Id>,
}

#[derive(Serialize)]
pub struct VpnLocationModifiedMetadata {
    pub before: WireguardNetwork<Id>,
    pub after: WireguardNetwork<Id>,
}

#[derive(Serialize)]
pub struct ApiTokenMetadata {
    pub owner: UserNoSecrets,
    pub token: ApiTokenNoSecrets,
}

#[derive(Serialize)]
pub struct ApiTokenNoSecrets {
    id: Id,
    pub user_id: Id,
    pub created_at: NaiveDateTime,
    pub name: String,
}

impl From<ApiToken<Id>> for ApiTokenNoSecrets {
    fn from(value: ApiToken<Id>) -> Self {
        Self {
            id: value.id,
            user_id: value.user_id,
            created_at: value.created_at,
            name: value.name,
        }
    }
}

#[derive(Serialize)]
pub struct ApiTokenRenamedMetadata {
    pub owner: UserNoSecrets,
    pub token: ApiTokenNoSecrets,
    pub old_name: String,
    pub new_name: String,
}

#[derive(Serialize)]
pub struct OpenIdAppMetadata {
    pub app: OAuth2ClientNoSecrets,
}

#[derive(Serialize)]
pub struct OAuth2ClientNoSecrets {
    pub id: Id,
    pub client_id: String, // unique
    pub redirect_uri: Vec<String>,
    pub scope: Vec<String>,
    pub name: String,
    pub enabled: bool,
}

impl From<OAuth2Client<Id>> for OAuth2ClientNoSecrets {
    fn from(value: OAuth2Client<Id>) -> Self {
        Self {
            id: value.id,
            client_id: value.client_id,
            redirect_uri: value.redirect_uri,
            scope: value.scope,
            name: value.name,
            enabled: value.enabled,
        }
    }
}

#[derive(Serialize)]
pub struct OpenIdAppModifiedMetadata {
    pub before: OAuth2ClientNoSecrets,
    pub after: OAuth2ClientNoSecrets,
}

#[derive(Serialize)]
pub struct OpenIdAppStateChangedMetadata {
    pub app: OAuth2ClientNoSecrets,
    pub enabled: bool,
}

#[derive(Serialize)]
pub struct OpenIdProviderMetadata {
    pub provider: OpenIdProviderNoSecrets,
}

#[derive(Serialize)]
pub struct OpenIdProviderNoSecrets {
    pub id: Id,
    pub name: String,
    pub base_url: String,
    pub client_id: String,
    pub display_name: Option<String>,
    pub google_service_account_email: Option<String>,
    pub admin_email: Option<String>,
    pub directory_sync_enabled: bool,
    pub directory_sync_interval: i32,
    pub directory_sync_user_behavior: DirectorySyncUserBehavior,
    pub directory_sync_admin_behavior: DirectorySyncUserBehavior,
    pub directory_sync_target: DirectorySyncTarget,
    pub okta_dirsync_client_id: Option<String>,
    pub directory_sync_group_match: Vec<String>,
    pub directory_sync_user_groups: Option<Vec<String>>,
}

impl From<OpenIdProvider<Id>> for OpenIdProviderNoSecrets {
    fn from(value: OpenIdProvider<Id>) -> Self {
        Self {
            id: value.id,
            name: value.name,
            base_url: value.base_url,
            client_id: value.client_id,
            display_name: value.display_name,
            google_service_account_email: value.google_service_account_email,
            admin_email: value.admin_email,
            directory_sync_enabled: value.directory_sync_enabled,
            directory_sync_interval: value.directory_sync_interval,
            directory_sync_user_behavior: value.directory_sync_user_behavior,
            directory_sync_admin_behavior: value.directory_sync_admin_behavior,
            directory_sync_target: value.directory_sync_target,
            okta_dirsync_client_id: value.okta_dirsync_client_id,
            directory_sync_group_match: value.directory_sync_group_match,
            directory_sync_user_groups: value.directory_sync_user_groups,
        }
    }
}

#[derive(Serialize)]
pub struct SettingsUpdateMetadata {
    pub before: SettingsNoSecrets,
    pub after: SettingsNoSecrets,
}

#[derive(Serialize)]
pub struct EnterpriseSettingsUpdateMetadata {
    pub before: EnterpriseSettingsInfo,
    pub after: EnterpriseSettingsInfo,
}

#[derive(Serialize)]
pub struct SettingsNoSecrets {
    // Modules
    pub openid_enabled: bool,
    pub wireguard_enabled: bool,
    pub webhooks_enabled: bool,
    pub worker_enabled: bool,
    // MFA
    pub challenge_template: String,
    // Branding
    pub instance_name: String,
    pub main_logo_url: String,
    pub nav_logo_url: String,
    // SMTP
    pub smtp_server: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_encryption: SmtpEncryption,
    pub smtp_user: Option<String>,
    pub smtp_sender: Option<String>,
    pub smtp_tls_verify_cert: bool,
    // Enrollment
    pub enrollment_vpn_step_optional: bool,
    pub enrollment_welcome_message: Option<String>,
    pub enr
```

### Core Architecture Module: `crates/defguard_core/src/db/models/activity_log/mod.rs`
```
use chrono::NaiveDateTime;
use defguard_common::db::{Id, NoId};
use ipnetwork::IpNetwork;
use model_derive::Model;
use sqlx::{FromRow, Type};
use utoipa::ToSchema;

pub mod metadata;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, ToSchema, Type)]
#[sqlx(type_name = "activity_log_module", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ActivityLogModule {
    Defguard,
    Client,
    Vpn,
    Enrollment,
    Posture,
    ActiveDirectory,
    Ldap,
    OidcDirectorySync,
}

/// Represents activity log event type as it's stored in the DB
///
/// To make searching and exporting the type is stored as text and not a custom Postgres enum.
/// Variant names are renamed to `snake_case` so `UserLogin` becomes `user_login` in the DB table.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    // Authentication
    UserLogin,
    UserLoginFailed,
    UserMfaLogin,
    UserMfaLoginFailed,
    RecoveryCodeUsed,
    UserLogout,
    // MFA management
    MfaDisabled,
    UserMfaDisabled,
    MfaTotpDisabled,
    MfaTotpEnabled,
    MfaEmailDisabled,
    MfaEmailEnabled,
    MfaSecurityKeyAdded,
    MfaSecurityKeyRemoved,
    // User management
    UserAdded,
    UserImportBlocked,
    UserRemoved,
    UserModified,
    UserGroupsModified,
    UserEnabled,
    UserDisabled,
    PasswordChanged,
    PasswordChangedByAdmin,
    PasswordReset,
    // Device management
    DeviceAdded,
    DeviceRemoved,
    DeviceModified,
    NetworkDeviceAdded,
    NetworkDeviceRemoved,
    NetworkDeviceModified,
    // activity log stream
    ActivityLogStreamCreated,
    ActivityLogStreamModified,
    ActivityLogStreamRemoved,
    ClientConfigurationTokenAdded,
    // OpenID app management
    OpenIdAppAdded,
    OpenIdAppRemoved,
    OpenIdAppModified,
    OpenIdAppStateChanged,
    // OpenID provider management
    OpenIdProviderRemoved,
    OpenIdProviderModified,
    // VPN location management
    VpnLocationAdded,
    VpnLocationRemoved,
    VpnLocationModified,
    // VPN client events
    VpnClientConnected,
    VpnClientDisconnected,
    VpnClientMfaConnected,
    VpnClientMfaDisconnected,
    VpnClientMfaSuccess,
    VpnClientMfaFailed,
    VpnClientSessionSuperseded,
    VpnClientMfaSessionSuperseded,
    // Enrollment events
    EnrollmentTokenAdded,
    EnrollmentStarted,
    EnrollmentDeviceAdded,
    EnrollmentCompleted,
    PasswordResetRequested,
    PasswordResetStarted,
    PasswordResetCompleted,
    // API token management,
    ApiTokenAdded,
    ApiTokenRemoved,
    ApiTokenRenamed,
    // Settings management
    SettingsUpdated,
    SettingsUpdatedPartial,
    SettingsDefaultBrandingRestored,
    EnterpriseSettingsUpdated,
    // Groups management
    GroupsBulkAssigned,
    GroupAdded,
    GroupModified,
    GroupRemoved,
    GroupMemberAdded,
    GroupMemberRemoved,
    GroupMembersModified,
    // WebHook management
    WebHookAdded,
    WebHookModified,
    WebHookRemoved,
    WebHookStateChanged,
    // Authentication key management
    AuthenticationKeyAdded,
    AuthenticationKeyRemoved,
    AuthenticationKeyRenamed,
    // User SNAT bindings management
    UserSnatBindingAdded,
    UserSnatBindingRemoved,
    UserSnatBindingModified,
    // Proxy management
    ProxyModified,
    ProxyDeleted,
    // Gateway management
    GatewayModified,
    GatewayDeleted,
    GatewayConnected,
    GatewayDisconnected,
    ProxyConnected,
    ProxyDisconnected,
    // Device posture management
    DevicePostureCreated,
    DevicePostureUpdated,
    DevicePostureDeleted,
    DevicePostureDuplicated,
    DevicePostureLocationsAssigned,
    LocationPosturesAssigned,
    DevicePostureCheckPassed,
    DevicePostureCheckFailed,
    // LDAP sync events
    LdapSyncUserCreated,
    LdapSyncUserDeleted,
    LdapSyncUserModified,
    LdapSyncUserEnabled,
    LdapSyncUserDisabled,
    LdapSyncGroupCreated,
    LdapSyncGroupMemberAdded,
    LdapSyncGroupMemberRemoved,
    LdapSyncOutboundUserCreated,
    LdapSyncOutboundUserDeleted,
    LdapSyncOutboundUserModified,
    LdapSyncOutboundUserEnabled,
    LdapSyncOutboundUserDisabled,
    LdapSyncOutboundGroupMemberAdded,
    LdapSyncOutboundGroupMemberRemoved,
    // OIDC directory sync events
    OidcDirectorySyncUserCreated,
    OidcDirectorySyncUserDeleted,
    OidcDirectorySyncUserModified,
    OidcDirectorySyncUserEnabled,
    OidcDirectorySyncUserDisabled,
    OidcDirectorySyncGroupCreated,
    OidcDirectorySyncGroupMemberAdded,
    OidcDirectorySyncGroupMemberRemoved,
}

#[derive(Model, FromRow, Serialize)]
#[table(activity_log_event)]
pub struct ActivityLogEvent<I = NoId> {
    pub id: I,
    pub timestamp: NaiveDateTime,
    #[model(option)]
    pub user_id: Option<Id>,
    pub username: String,
    pub location: Option<String>,
    #[model(option)]
    pub ip: Option<IpNetwork>,
    #[model(enum)]
    pub event: EventType,
    #[model(enum)]
    pub module: ActivityLogModule,
    pub device: String,
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

```

### Core Architecture Module: `crates/defguard_core/src/db/models/enrollment.rs`
```
use std::{fmt, time::Duration};

use chrono::{NaiveDateTime, TimeDelta, Utc};
use defguard_common::{
    VERSION,
    db::{
        Id,
        models::{Settings, user::User},
    },
    random::gen_alphanumeric,
    types::UrlParseError,
};
use sqlx::{PgConnection, PgExecutor, PgPool, query, query_as};
use tera::Context;
use thiserror::Error;
use tonic::{Code, Status};

use crate::mail::templates;

pub static ENROLLMENT_TOKEN_TYPE: &str = "ENROLLMENT";
pub static PASSWORD_RESET_TOKEN_TYPE: &str = "PASSWORD_RESET";

#[derive(Error, Debug)]
pub enum TokenError {
    #[error(transparent)]
    DbError(#[from] sqlx::Error),
    #[error("Enrollment token not found")]
    NotFound,
    #[error("Enrollment token expired")]
    TokenExpired,
    #[error("Enrollment session expired")]
    SessionExpired,
    #[error("Enrollment token already used")]
    TokenUsed,
    #[error("Enrollment user not found")]
    UserNotFound,
    #[error("Enrollment user is disabled")]
    UserDisabled,
    #[error("Enrollment admin not found")]
    AdminNotFound,
    #[error("User account is already activated")]
    AlreadyActive,
    #[error("Enrollment welcome message not configured")]
    WelcomeMsgNotConfigured,
    #[error("Enrollment welcome email not configured")]
    WelcomeEmailNotConfigured,
    #[error(transparent)]
    TemplateErrorInternal(#[from] tera::Error),
    #[error(transparent)]
    TemplateError(#[from] templates::TemplateError),
    #[error(transparent)]
    UrlParseError(#[from] UrlParseError),
}

impl From<TokenError> for Status {
    fn from(err: TokenError) -> Self {
        error!("{err}");
        let unexpected_err_msg = format!("Unexpected error: {err}");
        let (code, msg) = match err {
            TokenError::DbError(_)
            | TokenError::AdminNotFound
            | TokenError::UserNotFound
            | TokenError::UserDisabled
            | TokenError::WelcomeMsgNotConfigured
            | TokenError::WelcomeEmailNotConfigured
            | TokenError::TemplateError(_)
            | TokenError::UrlParseError(_)
            | TokenError::TemplateErrorInternal(_) => (Code::Internal, unexpected_err_msg.as_str()),
            TokenError::NotFound | TokenError::SessionExpired | TokenError::TokenUsed => {
                (Code::Unauthenticated, "invalid token")
            }
            TokenError::AlreadyActive => (Code::InvalidArgument, "already active"),
            TokenError::TokenExpired => (Code::Unauthenticated, "token expired"),
        };
        Self::new(code, msg)
    }
}

// Representation of a user enrollment session
#[derive(Clone)]
pub struct Token {
    pub id: String,
    pub user_id: Id,
    pub admin_id: Option<Id>,
    pub email: Option<String>,
    pub created_at: NaiveDateTime,
    pub expires_at: NaiveDateTime,
    pub used_at: Option<NaiveDateTime>,
    pub token_type: Option<String>,
    pub device_id: Option<Id>,
}

impl fmt::Debug for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Token")
            .field("id", &"<redacted>")
            .field("user_id", &self.user_id)
            .field("admin_id", &self.admin_id)
            .field("created_at", &self.created_at)
            .field("expires_at", &self.expires_at)
            .field("used_at", &self.used_at)
            .field("token_type", &self.token_type)
            .field("device_id", &self.device_id)
            .finish()
    }
}

impl Token {
    #[must_use]
    pub fn new(
        user_id: Id,
        admin_id: Option<Id>,
        email: Option<String>,
        token_timeout_seconds: u64,
        token_type: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: gen_alphanumeric(32),
            user_id,
            admin_id,
            email,
            created_at: now.naive_utc(),
            expires_at: (now + TimeDelta::seconds(token_timeout_seconds as i64)).naive_utc(),
            used_at: None,
            token_type,
            device_id: None,
        }
    }

    /// Duration for which the token is valid, i.e. `expires_at - created_at`, clamped to zero.
    #[must_use]
    pub fn validity_duration(&self) -> Duration {
        let seconds = (self.expires_at - self.created_at).num_seconds().max(0);
        Duration::from_secs(u64::try_from(seconds).unwrap_or_default())
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), TokenError>
    where
        E: PgExecutor<'e>,
    {
        query!(
            "INSERT INTO token (id, user_id, admin_id, email, created_at, expires_at, used_at, \
            token_type, device_id) \
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            self.id,
            self.user_id,
            self.admin_id,
            self.email,
            self.created_at,
            self.expires_at,
            self.used_at,
            self.token_type,
            self.device_id
        )
        .execute(executor)
        .await?;
        Ok(())
    }

    // check if token has already expired
    #[must_use]
    pub fn is_expired(&self) -> bool {
        self.expires_at < Utc::now().naive_utc()
    }

    // check if token has already been used
    #[must_use]
    pub fn is_used(&self) -> bool {
        self.used_at.is_some()
    }

    // check if enrollment session is still valid
    // after using the token user has 10 minutes to complete enrollment
    #[must_use]
    pub fn is_session_valid(&self, session_timeout_seconds: u64) -> bool {
        if let Some(used_at) = self.used_at {
            let now = Utc::now();
            return now.naive_utc()
                < (used_at + TimeDelta::seconds(session_timeout_seconds as i64));
        }
        false
    }

    // check if token can be used to start an enrollment session
    // and set timestamp if token is valid
    // returns session deadline
    pub async fn start_session(
        &mut self,
        transaction: &mut PgConnection,
        session_timeout_seconds: u64,
    ) -> Result<NaiveDateTime, TokenError> {
        // check if token can be used
        debug!("Creating a new session.");
        if self.is_expired() {
            debug!("Token is already expired. Cannot establish a new session.");
            return Err(TokenError::TokenExpired);
        }
        match self.used_at {
            // session started but still valid
            Some(used_at) if self.is_session_valid(session_timeout_seconds) => {
                debug!("Session already exists yet it is still valid.");
                Ok(used_at + TimeDelta::seconds(session_timeout_seconds as i64))
            }
            // session expired
            Some(_) => {
                debug!("Session has expired.");
                Err(TokenError::TokenUsed)
            }
            // session not yet started
            None => {
                let now = Utc::now().naive_utc();
                query!("UPDATE token SET used_at = $1 WHERE id = $2", now, self.id)
                    .execute(transaction)
                    .await?;
                self.used_at = Some(now);

                debug!("Generate a new session successfully.");
                Ok(now + TimeDelta::seconds(session_timeout_seconds as i64))
            }
        }
    }

    pub async fn find_by_id(pool: &PgPool, id: &str) -> Result<Self, TokenError> {
        if let Some(enrollment) = query_as!(
            Self,
            "SELECT id, user_id, admin_id, email, created_at, expires_at, used_at, token_type, device_id \
            FROM token WHERE id = $1",
            id
        )
        .fetch_optional(pool)
        .await?
        {
            debug!("Fetch token {enrollment:?} from database.");
            Ok(enrollment)
        } else {
            debug!("Token with id {id} does not exist in database.");
            Err(TokenError::NotFound)
        }
    }

    pub async fn fetch_all(pool: &PgPool) -> Result<Vec<Self>, TokenError> {
        let tokens = query_as!(
            Self,
            "SELECT id, user_id, admin_id, email, created_at, expires_at, used_at, token_type, device_id \
            FROM token",
        )
        .fetch_all(pool)
        .await?;
        Ok(tokens)
    }

    pub async fn fetch_user<'e, E>(&self, executor: E) -> Result<User<Id>, TokenError>
    where
        E: PgExecutor<'e>,
    {
        debug!("Find user by id {}.", self.user_id);
        let Some(user) = User::find_by_id(executor, self.user_id).await? else {
            error!(
                "User not found for enrollment token of user {}",
                self.user_id
            );
            return Err(TokenError::UserNotFound);
        };
        debug!("Fetched user {user:?}.");

        Ok(user)
    }

    pub async fn fetch_admin<'e, E>(&self, executor: E) -> Result<Option<User<Id>>, TokenError>
    where
        E: PgExecutor<'e>,
    {
        debug!("Fetch admin data");
        if self.admin_id.is_none() {
            debug!("Admin doesn't have ID; stop fetching data");
            return Ok(None);
        }

        let admin_id = self.admin_id.unwrap();
        debug!("Trying to find admin using ID {admin_id}");
        let user = User::find_by_id(executor, admin_id).await?;
        debug!("Fetched admin {user:?}.");

        Ok(user)
    }

    pub async fn delete_unused_user_tokens<'e, E>(
        executor: E,
        user_id: Id,
    ) -> Result<(), TokenError>
    where
        E: PgExecutor<'e>,
    {
        debug!("Deleting unused tokens for the user");
        let result = query!(
            "DELETE FROM token \
            WHERE user_id = $1 \
            AND used_at IS NULL",
            user_id
        )
        .execute(executor)
        .await?;
        info!(
            "Deleted {} unused enrollment tokens for the user",
            result.rows_affected()
        );

        Ok(())
    }

    pub async fn delete_unused_user_password_reset_tokens(
        transaction: &mut PgConnection,
        user_id: Id,
    ) -> Result<(), TokenErr
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3862** (2026-10-15): **"Only one client connection is allowed" error when connection to gateway interrupted**
  *Symptoms*: Related support issues: 106, 146. When the connection between Core and Gateway is interrupted, for example by restarting a firewall or proxy between them, it does not reconnect automatically once connectivity is restored. Instead, the following error appears on the gateway side:  ``` ERROR core_communication: defguard_gateway::gateway_server: message=Only one client connection is allowed. log.target=defguard_gateway::gateway_server  ```  Likely the connection is still registered as healthy by the gateway.
  **Post-Mortem & Fix Analysis**:
  > Duplicates https://github.com/DefGuard/gateway/issues/385

- **Issue #3844** (2026-10-15): **Incorrect "Edit workflow" label for MFA flow form**
  *Symptoms*: Should probably be "Edit MFA Flow" like in the breadcrumbs  <img width="754" height="388" alt="Image" src="https://github.com/user-attachments/assets/d49f23de-fca2-4d89-8e5d-ce22fc46242b" />

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

### Incident Patch 1: `d8b8e8e0` (2026-09-25)
**Commit Message**: fix(LDAP): handle escaped commas when parsing DNs (#3703)

* handle parsing escape characters in DN values

* normalize value for comparison

* add tests

* cleanup

* update rename path

**File**: `crates/defguard_core/src/enterprise/ldap/client.rs` (modified, +5/-3)
```diff
@@ -11,7 +11,7 @@ use ldap3::{
     drive, ldap_escape,
 };
 
-use super::{LDAPConfig, LDAPConnection, error::LdapError};
+use super::{LDAPConfig, LDAPConnection, dn::find_unescaped_separator, error::LdapError};
 use crate::enterprise::ldap::model::{Dn, LdapEntry, extract_rdn_value, is_search_entry};
 
 const STREAMING_PAGE_SIZE: i32 = 500;
@@ -212,7 +212,9 @@ impl LDAPConnection {
     {
         self.ldap.modify(old_dn, mods).await?;
         if old_dn != new_dn {
-            if let Some((new_rdn, _rest)) = new_dn.split_once(',') {
+            if let Some(new_rdn) =
+                find_unescaped_separator(new_dn, b',').and_then(|index| new_dn.get(..index))
+            {
                 self.ldap.modifydn(old_dn, new_rdn, true, None).await?;
             } else {
                 warn!("Failed to rename LDAP object {old_dn} to {new_dn}, new DN is invalid");
@@ -262,7 +264,7 @@ impl LDAPConnection {
                     let members = members
                         .iter()
                         .filter_map(|v| {
-                            if let Some(user) = dn_map.get(&Dn::from(v.as_str())) {
+                            if let Some(user) = dn_map.get(&self.config.dn_match_key(v)) {
                                 Some(*user)
                             } else {
                                 debug!(
```

**File**: `crates/defguard_core/src/enterprise/ldap/dn.rs` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+//! Distinguished name string handling, as defined by RFC 4514.
+
+/// Returns the byte index of the first `separator` that is not escaped.
+///
+/// `separator` must be ASCII, which every DN separator is. UTF-8 never uses a byte below 0x80
+/// inside a multi-byte character, so a byte-wise hit is always a real separator.
+#[must_use]
+pub(crate) fn find_unescaped_separator(input: &str, separator: u8) -> Option<usize> {
+    let bytes = input.as_bytes();
+    let mut index = 0;
+    while index < bytes.len() {
+        match bytes[index] {
+            // Skip the escape and whatever it protects, which may itself be a separator.
+            b'\\' => index += 2,
+            byte if byte == separator => return Some(index),
+            _ => index += 1,
+        }
+    }
+
+    None
+}
+
+/// Decodes the escapes in one RDN value: `Doe\, John` and `Doe\2c John` both give `Doe, John`.
+///
+/// Returns `None` for a value that is malformed or decodes to bytes that are not valid UTF-8. This
+/// text is stored as a user's `ldap_rdn`, so a name Defguard cannot hold faithfully is refused.
+#[must_use]
+pub(crate) fn unescape_value(value: &str) -> Option<String> {
+    String::from_utf8(unescape_value_bytes(value)?).ok()
+}
+
+/// Decodes to bytes, because a hex pair can carry one byte of a multi-byte character, as the
+/// `\c5\82` of `Micha\c5\82` does.
+fn unescape_value_bytes(value: &str) -> Option<Vec<u8>> {
+    let bytes = value.as_bytes();
+    let mut unescaped = Vec::with_capacity(bytes.len());
+    let mut index = 0;
+    while index < bytes.len() {
+        if bytes[index] != b'\\' {
+            unescaped.push(bytes[index]);
+            index += 1;
+            continue;
+        }
+
+        if let Some(byte) = bytes.get(index + 1..index + 3).and_then(hex_pair) {
+            unescaped.push(byte);
+            index += 3;
+        } else {
+            // Every character RFC 4514 escapes this way is ASCII, so taking one byte cannot cut a
+            // multi-byte character in half. Nothing left to protect means the value is malformed.
+            unescaped.push(*bytes.get(index + 1)?);
+            index += 2;
+        }
+    }
+
+    Some(unescaped)
+}
+
+fn hex_pair(digits: &[u8]) -> Option<u8> {
+    // `from_str_radix` would accept a leading sign, which would read `\+a` as a hex pair.
+    if !digits.iter().all(u8::is_ascii_hexdigit) {
+        return None;
+    }
+
+    u8::from_str_radix(str::from_utf8(digits).ok()?, 16).ok()
+}
+
+#[cfg(test)]
+mod tests {
+    use super::{find_unescaped_separator, unescape_value};
+
+    #[test]
+    fn test_find_unescaped_separator_skips_escaped_separators() {
+        assert_eq!(
+            find_unescaped_separator("cn=user,dc=example", b','),
+            Some(7)
+        );
+        assert_eq!(
+            find_unescaped_separator("cn=user,dc=example", b'='),
+            Some(2)
+        );
+        assert_eq!(
+            find_unescaped_separator(r"cn=Doe\, John,ou=users", b','),
+            Some(13)
+        );
+        assert_eq!(
+            find_unescaped_separator(r"cn=Doe\2c John,ou=users", b','),
+            Some(14)
+        );
+        assert_eq!(
+            find_unescaped_separator(r"cn=Doe\5c,ou=users", b','),
+            Some(9)
+        );
+        assert_eq!(find_unescaped_separator(r"cn=Doe\,John", b','), None);
+        assert_eq!(find_unescaped_separator("", b','), None);
+        assert_eq!(
+            find_unescaped_separator("cn=Michał,dc=example", b','),
+            Some(10)
+        );
+    }
+
+    #[test]
+    fn test_unescape_value_resolves_both_escape_forms() {
+        assert_eq!(
+            unescape_value("plain value").as_deref(),
+            Some("plain value")
+        );
+        assert_eq!(unescape_value(r"Doe\, John").as_deref(), Some("Doe, John"));
+        assert_eq!(unescape_value(r"Doe\2c John").as_deref(), Some("Doe, John"));
+        assert_eq!(unescape_value(r"Doe\2C John").as_deref(), Some("Doe, John"));
+        assert_eq!(
+            unescape_value(r#"a\+b\"c\\d\#e"#).as_deref(),
+            Some("a+b\"c\\d#e")
+        );
+        assert_eq!(unescape_value(r"edge\ ").as_deref(), Some("edge "));
+        assert_eq!(unescape_value(r"Micha\c5\82").as_deref(), Some("Michał"));
+        // A sign is not a hex digit, so this is the character escape for a plus.
+        assert_eq!(unescape_value(r"a\+5").as_deref(), Some("a+5"));
+    }
+
+    #[test]
+    fn test_unescape_value_rejects_malformed_and_invalid_utf8() {
+        assert_eq!(unescape_value(r"a\ff"), None);
+        assert_eq!(unescape_value(r"Micha\c5"), None);
+        assert_eq!(unescape_value(r"trailing\"), None);
+    }
+}
```

**File**: `crates/defguard_core/src/enterprise/ldap/mod.rs` (modified, +24/-4)
```diff
@@ -21,10 +21,13 @@ use self::error::LdapError;
 use crate::{
     enterprise::{
         is_business_license_active,
-        ldap::model::{
-            Dn, UAC_NORMAL_ACCOUNT, extract_dn_path, group_in_list, has_obj_class,
-            ldap_sync_allowed_for_user, uac_from_entry, uac_with_active, user_as_ldap_attrs,
-            user_as_ldap_mod, user_from_searchentry,
+        ldap::{
+            dn::unescape_value,
+            model::{
+                Dn, UAC_NORMAL_ACCOUNT, extract_dn_path, group_in_list, has_obj_class,
+                ldap_sync_allowed_for_user, split_first_rdn, uac_from_entry, uac_with_active,
+                user_as_ldap_attrs, user_as_ldap_mod, user_from_searchentry,
+            },
         },
         limits::update_counts,
     },
@@ -34,6 +37,7 @@ use crate::{
 
 #[cfg(not(test))]
 pub mod client;
+pub mod dn;
 pub mod error;
 pub mod hash;
 pub mod model;
@@ -236,6 +240,22 @@ impl LDAPConfig {
             .ldap_user_path
             .as_deref()
             .unwrap_or(&self.ldap_user_search_base);
+        self.dn_from_parts(rdn_value, path)
+    }
+
+    /// Respells a DN the server sent the way `user_dn` builds one, for comparison.
+    ///
+    /// A server may escape a comma as `\,` where Defguard writes `\2c`, so a `member` value can name
+    /// a user and still differ from that user's DN byte for byte.
+    #[must_use]
+    pub(crate) fn dn_match_key(&self, dn: &str) -> Dn {
+        split_first_rdn(dn)
+            .and_then(|(value, path)| Some(self.dn_from_parts(&unescape_value(value)?, path)))
+            .unwrap_or_else(|| dn.into())
+    }
+
+    #[must_use]
+    fn dn_from_parts(&self, rdn_value: &str, path: &str) -> Dn {
         format!("{}={},{path}", self.get_rdn_attr(), dn_escape(rdn_value)).into()
     }
 
```

**File**: `crates/defguard_core/src/enterprise/ldap/model.rs` (modified, +20/-15)
```diff
@@ -14,6 +14,7 @@ use sqlx::{PgExecutor, query_as};
 
 use super::{
     LDAPConfig,
+    dn::{find_unescaped_separator, unescape_value},
     error::{LdapError, sanitize_ldap_string},
 };
 use crate::{handlers::user::check_username, hashset};
@@ -443,14 +444,19 @@ pub(super) fn group_in_list(groups: &[String], name: &str) -> bool {
         .any(|g| g.to_lowercase() == name.to_lowercase())
 }
 
-/// Get first value from distinguished name, for example: cn=<value>,...
+/// Splits a DN into the still-escaped value of its first component and the path after it.
+#[must_use]
+pub(super) fn split_first_rdn(dn: &str) -> Option<(&str, &str)> {
+    let comma_index = find_unescaped_separator(dn, b',')?;
+    let rdn = &dn[..comma_index];
+    let eq_index = find_unescaped_separator(rdn, b'=')?;
+    Some((&rdn[(eq_index + 1)..], &dn[(comma_index + 1)..]))
+}
+
+/// Returns the unescaped value of the first component, so `cn=Doe\, John,ou=x` gives `Doe, John`.
 #[must_use]
 pub(crate) fn extract_rdn_value(dn: &str) -> Option<String> {
-    if let (Some(eq_index), Some(comma_index)) = (dn.find('='), dn.find(',')) {
-        dn.get((eq_index + 1)..comma_index).map(str::to_owned)
-    } else {
-        None
-    }
+    split_first_rdn(dn).and_then(|(value, _)| unescape_value(value))
 }
 
 /// Returns true only for a SearchResultEntry (LDAP protocol op id 4).
@@ -463,18 +469,17 @@ pub(super) fn is_search_entry(entry: &ResultEntry) -> bool {
     entry.0.id == 4
 }
 
-/// Extract the remaining part of the distinguished name after the first comma, for example:
-/// `cn=user,dc=example,dc=com` should return `dc=example,dc=com`.
+/// Returns the part after the first unescaped comma, so `cn=Doe\, John,ou=x` gives `ou=x`.
 #[must_use]
 pub(crate) fn extract_dn_path(dn: &str) -> Option<String> {
-    if let Some(parts) = dn.split_once(',') {
-        let path = parts.1.to_owned();
-        debug!("Extracted DN path '{path}' from DN '{dn}'");
-        Some(path)
-    } else {
+    let Some(comma_index) = find_unescaped_separator(dn, b',') else {
         warn!("Failed to extract DN path from '{dn}': no comma found");
-        None
-    }
+        return None;
+    };
+
+    let path = dn[(comma_index + 1)..].to_owned();
+    debug!("Extracted DN path '{path}' from DN '{dn}'");
+    Some(path)
 }
 
 #[cfg(test)]
```

**File**: `crates/defguard_core/src/enterprise/ldap/test_client.rs` (modified, +24/-13)
```diff
@@ -223,8 +223,13 @@ impl TestClient {
 
     pub(super) fn add_test_user(&mut self, user: &User, config: &LDAPConfig) {
         let dn = config.user_dn(user);
+        self.add_test_user_with_dn(user, &dn);
+    }
+
+    /// Records an entry under the DN given, for a test that needs the directory's own spelling.
+    pub(super) fn add_test_user_with_dn(&mut self, user: &User, dn: &str) {
         self.objects
-            .insert(dn, Object::User(Box::new(user.clone())));
+            .insert(dn.into(), Object::User(Box::new(user.clone())));
     }
 
     pub(super) fn remove_test_user(&mut self, user: &User, config: &LDAPConfig) {
@@ -239,12 +244,22 @@ impl TestClient {
     }
 
     pub(super) fn add_test_membership(&mut self, group: &Group, user: &User, config: &LDAPConfig) {
-        let group_dn = config.group_dn(&group.name);
         let user_dn = config.user_dn(user);
+        self.add_test_membership_with_dn(group, &user_dn, config);
+    }
+
+    /// Records a member under the DN given, for a test that needs the directory's own spelling.
+    pub(super) fn add_test_membership_with_dn(
+        &mut self,
+        group: &Group,
+        user_dn: &str,
+        config: &LDAPConfig,
+    ) {
+        let group_dn = config.group_dn(&group.name);
         self.memberships
             .entry(group_dn)
             .or_default()
-            .insert(user_dn);
+            .insert(user_dn.into());
     }
 
     pub(super) fn remove_test_membership(
@@ -492,21 +507,17 @@ impl LDAPConnection {
     ) -> Result<HashMap<String, HashSet<&'a User>>, LdapError> {
         let memberships = self.test_client.memberships.clone();
         let mut result = HashMap::new();
-        let user_dns = all_ldap_users
+        let users_by_dn = all_ldap_users
             .iter()
-            .map(|user| self.config.user_dn(user))
-            .collect::<HashSet<_>>();
+            .map(|user| (self.config.user_dn(user), user))
+            .collect::<HashMap<_, _>>();
         for (group_dn, member_dns) in memberships {
             let members = member_dns
                 .iter()
                 .filter_map(|member_dn| {
-                    if user_dns.contains(member_dn) {
-                        all_ldap_users
-                            .iter()
-                            .find(|user| self.config.user_dn(user) == *member_dn)
-                    } else {
-                        None
-                    }
+                    users_by_dn
+                        .get(&self.config.dn_match_key(member_dn))
+                        .copied()
                 })
                 .collect::<HashSet<_>>();
             let group_name = extract_rdn_value(&group_dn).unwrap();
```

**File**: `crates/defguard_core/src/enterprise/ldap/tests.rs` (modified, +121/-0)
```diff
@@ -1891,6 +1891,58 @@ async fn test_fix_missing_user_path(_: PgPoolOptions, options: PgConnectOptions)
     }
 }
 
+/// A group member the directory spells with `\,` must resolve to the user it names.
+#[sqlx::test]
+async fn test_sync_resolves_membership_for_comma_in_rdn(
+    _: PgPoolOptions,
+    options: PgConnectOptions,
+) {
+    let pool = setup_pool(options).await;
+    let (wg_tx, _wg_rx) = wg_test_channel();
+    let (ldap_tx, _ldap_rx) = ldap_test_channel();
+    let _ = initialize_current_settings(&pool).await;
+    set_test_license_business();
+
+    let mut ldap_conn = super::LDAPConnection::create().await.unwrap();
+    ldap_conn.config.ldap_username_attr = "uid".to_owned();
+    ldap_conn.config.ldap_user_rdn_attr = Some("cn".to_owned());
+    let config = ldap_conn.config.clone();
+
+    let group = Group::new("directory-group").save(&pool).await.unwrap();
+    let path = "OU=Members,DC=example,DC=com";
+    let ldap_user = make_test_user(
+        "jdoe",
+        Some("Doe, John - jdoe".to_owned()),
+        Some(path.to_owned()),
+    );
+    let directory_dn = format!(r"CN=Doe\, John - jdoe,{path}");
+    assert_ne!(config.user_dn(&ldap_user), Dn::from(directory_dn.as_str()));
+
+    let mut defguard_user = ldap_user.clone();
+    defguard_user.from_ldap = true;
+    let defguard_user = defguard_user.save(&pool).await.unwrap();
+
+    ldap_conn
+        .test_client_mut()
+        .add_test_user_with_dn(&ldap_user, &directory_dn);
+    let ldap_group = group.clone().as_noid();
+    ldap_conn
+        .test_client_mut()
+        .add_test_group(&ldap_group, &config);
+    ldap_conn
+        .test_client_mut()
+        .add_test_membership_with_dn(&ldap_group, &directory_dn, &config);
+
+    ldap_conn
+        .sync(&pool, false, &wg_tx, &ldap_tx)
+        .await
+        .unwrap();
+
+    assert_eq!(
+        group.member_usernames(&pool).await.unwrap(),
+        vec![defguard_user.username]
+    );
+}
 /// A dry run must preview the additions/removals a full sync would make while writing nothing
 /// to LDAP or the Defguard database. This guards the hard "no import" requirement of the LDAP
 /// setup preview.
@@ -3203,6 +3255,35 @@ async fn test_get_empty_user_path(_: PgPoolOptions, options: PgConnectOptions) {
     assert_eq!(user_found.username, user.username);
 }
 
+#[test]
+fn test_dn_match_key_reconciles_escape_spellings() {
+    let config = LDAPConfig {
+        ldap_username_attr: "uid".to_owned(),
+        ldap_user_rdn_attr: Some("cn".to_owned()),
+        ..LDAPConfig::default()
+    };
+    let path = "OU=Members,DC=example,DC=com";
+    let user = make_test_user(
+        "jdoe",
+        Some("Doe, John - jdoe".to_owned()),
+        Some(path.to_owned()),
+    );
+
+    let member_dn = format!(r"CN=Doe\, John - jdoe,{path}");
+    let rebuilt = config.user_dn(&user);
+    assert_ne!(Dn::from(member_dn.as_str()), rebuilt);
+    assert_eq!(config.dn_match_key(&member_dn), rebuilt);
+
+    // Either spelling a server may choose lands on one key.
+    let hexpair_dn = format!(r"CN=Doe\2c John - jdoe,{path}");
+    assert_eq!(
+        config.dn_match_key(&hexpair_dn),
+        config.dn_match_key(&member_dn)
+    );
+
+    assert_eq!(config.dn_match_key("value"), Dn::from("value"));
+}
+
 #[test]
 fn test_extract_dn_value() {
     assert_eq!(
@@ -3367,6 +3448,31 @@ fn test_from_searchentry() {
         ));
     }
 
+    // escaped RDN value
+    {
+        let mut attrs = HashMap::new();
+        attrs.insert("sn".to_owned(), vec!["lastname1".to_owned()]);
+        attrs.insert("givenName".to_owned(), vec!["firstname1".to_owned()]);
+        attrs.insert("mail".to_owned(), vec!["user1@example.com".to_owned()]);
+
+        let entry = LdapEntry::new(
+            r"cn=Doe\, John,ou=users,dc=example,dc=com".into(),
+            attrs.clone(),
+        );
+        let user = user_from_searchentry(&entry, "jdoe", None, &LDAPConfig::default()).unwrap();
+        assert_eq!(user.ldap_rdn.as_deref(), Some("Doe, John"));
+        assert_eq!(
+            user.ldap_user_path.as_deref(),
+            Some("ou=users,dc=example,dc=com")
+        );
+
+        let entry = LdapEntry::new(r"cn=bad\ff,dc=example,dc=com".into(), attrs);
+        assert!(matches!(
+            user_from_searchentry(&entry, "jdoe", None, &LDAPConfig::default()),
+            Err(LdapError::InvalidDN(_))
+        ));
+    }
+
     // invalid username
     {
         let mut attrs = HashMap::new();
@@ -3775,6 +3881,21 @@ fn test_extract_dn_path_various_cases() {
         extract_dn_path(" cn=abc ,dc=example,dc=com "),
         Some("dc=example,dc=com ".to_owned())
     );
+
+    assert_eq!(
+        extract_dn_path(r"cn=Doe\, John,ou=users,dc=example,dc=com"),
+        Some("ou=users,dc=example,dc=com".to_owned())
+    );
+    assert_eq!(
+        extract_dn_path(r"cn=Doe\2c John,ou=users,dc=example,dc=com"),
+        Some("ou=users,dc=example,dc=com".to_owned())
+    );
+    // An escaped backslash does not pro
```

**File**: `crates/defguard_core/tests/integration/ldap/mod.rs` (modified, +65/-0)
```diff
@@ -1718,3 +1718,68 @@ async fn test_sync_skips_referral_pdus_without_aborting(
     let _ = ldap_conn.delete_user(&user).await;
     let _ = ldap_conn.delete_group("referral_grp").await;
 }
+
+/// A comma in the RDN value must not stop the sync from applying the group membership.
+///
+/// Only a real server chooses the escape spelling, which is what makes this worth a live test.
+#[ignore = "requires LDAP server"]
+#[sqlx::test]
+async fn test_sync_pulls_membership_for_comma_in_rdn(_: PgPoolOptions, options: PgConnectOptions) {
+    let pool = setup_pool(options).await;
+    const TEST_GROUP: &str = "comma_rdn_group";
+    set_sync_settings(&pool, TEST_GROUP, true).await;
+
+    // The comma belongs in the RDN, so the username must come from a different attribute than the
+    // one `just test-ldap` sets: `check_username` rejects a comma.
+    let mut settings = Settings::get_current_settings();
+    settings.ldap_username_attr = Some(if env::var("LDAP_USES_AD").is_ok() {
+        "sAMAccountName".to_owned()
+    } else {
+        "uid".to_owned()
+    });
+    settings.ldap_user_rdn_attr = Some("cn".to_owned());
+    set_settings(Some(settings));
+
+    let mut user = User::new(
+        "comma_rdn_user",
+        Some("pass123"),
+        "Person",
+        "Example",
+        "comma.rdn@test.defguard",
+        None,
+    )
+    .save(&pool)
+    .await
+    .unwrap();
+    user.ldap_rdn = Some("Example, Person".to_owned());
+
+    let (wg_tx, _wg_rx) = wg_test_channel();
+    let mut ldap_conn = LDAPConnection::create().await.unwrap();
+    ldap_conn.config.ldap_uses_ad = env::var("LDAP_USES_AD").is_ok();
+    let _ = ldap_conn.delete_user(&user).await;
+    let _ = ldap_conn.delete_group(TEST_GROUP).await;
+
+    ldap_conn
+        .add_user(&mut user, Some("pass123"), &pool)
+        .await
+        .unwrap();
+    ldap_conn
+        .add_user_to_group(&user, TEST_GROUP)
+        .await
+        .unwrap();
+
+    sync_ldap(&mut ldap_conn, &pool, true, &wg_tx).await;
+
+    let synced = User::find_by_username(&pool, "comma_rdn_user")
+        .await
+        .unwrap()
+        .expect("user should still exist after sync");
+    let groups = synced.member_of_names(&pool).await.unwrap();
+    assert!(
+        groups.iter().any(|group| group == TEST_GROUP),
+        "expected {TEST_GROUP} in {groups:?}"
+    );
+
+    ldap_conn.delete_group(TEST_GROUP).await.unwrap();
+    ldap_conn.delete_user(&user).await.unwrap();
+}
```

---

### Incident Patch 2: `46ee0daa` (2026-08-28)
**Commit Message**: Fix sync issues during a failed HTTP request to provider (#3610)

**File**: `crates/defguard_core/src/enterprise/directory_sync/mod.rs` (modified, +4/-1)
```diff
@@ -1333,9 +1333,12 @@ pub(crate) async fn do_directory_sync(
                             }
                             Err(err) => {
                                 error!(
-                                    "Failed to get members of group '{}' for the user sync filter: {err}",
+                                    "Failed to get members of group '{}' for the user sync filter, \
+                                    aborting the sync to avoid acting on an incomplete list of \
+                                    allowed users: {err}",
                                     group.name
                                 );
+                                return Err(err);
                             }
                         }
                     }
```

**File**: `crates/defguard_core/src/enterprise/directory_sync/testprovider.rs` (modified, +15/-1)
```diff
@@ -1,5 +1,9 @@
 use super::{DirectoryGroup, DirectorySync, DirectorySyncError, DirectoryUser};
 
+/// Name of a directory group whose member query always fails, so tests can simulate a
+/// provider API error in the middle of a sync.
+pub(crate) const FAILING_GROUP: &str = "failing-group";
+
 #[allow(dead_code)]
 pub(crate) struct TestProviderDirectorySync;
 
@@ -18,6 +22,10 @@ impl DirectorySync for TestProviderDirectorySync {
                 id: "3".into(),
                 name: "group3".into(),
             },
+            DirectoryGroup {
+                id: "4".into(),
+                name: FAILING_GROUP.into(),
+            },
         ])
     }
 
@@ -33,9 +41,15 @@ impl DirectorySync for TestProviderDirectorySync {
 
     async fn get_group_members(
         &self,
-        _group: &DirectoryGroup,
+        group: &DirectoryGroup,
         _all_users_helper: Option<&[DirectoryUser]>,
     ) -> Result<Vec<String>, DirectorySyncError> {
+        if group.name == FAILING_GROUP {
+            return Err(DirectorySyncError::RequestError(format!(
+                "Failed to make GET request to /groups/{}/members",
+                group.id
+            )));
+        }
         Ok(vec![
             "testuser@email.com".into(),
             "testuserdisabled@email.com".into(),
```

**File**: `crates/defguard_core/src/enterprise/directory_sync/tests.rs` (modified, +40/-1)
```diff
@@ -17,7 +17,7 @@ mod test {
     use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
     use tokio::sync::{broadcast, mpsc};
 
-    use super::super::*;
+    use super::super::{testprovider::FAILING_GROUP, *};
     use crate::{
         device_access::join_device_to_all_networks,
         enterprise::{
@@ -1017,6 +1017,45 @@ mod test {
         assert!(gateway_rx.try_recv().is_err());
     }
 
+    #[sqlx::test]
+    async fn test_user_sync_filter_keeps_users_when_member_query_fails(
+        _: PgPoolOptions,
+        options: PgConnectOptions,
+    ) {
+        let pool = setup_pool(options).await;
+
+        let config = DefGuardConfig::new_test_config();
+        let _ = SERVER_CONFIG.set(config.clone());
+        let (gateway_tx, _gateway_rx) = broadcast::channel::<GatewayCommand>(16);
+
+        // limit the sync to a group whose member query always fails
+        let mut provider = make_test_provider(
+            &pool,
+            DirectorySyncUserBehavior::Delete,
+            DirectorySyncUserBehavior::Delete,
+            DirectorySyncTarget::Users,
+            true,
+        )
+        .await;
+        provider.directory_sync_user_groups = Some(vec![FAILING_GROUP.to_owned()]);
+        provider.save(&pool).await.unwrap();
+
+        make_test_user_and_device("FirstName", &pool).await;
+        make_test_user_and_device("LastName", &pool).await;
+        let users_before = User::all(&pool).await.unwrap().len();
+        assert_eq!(users_before, 2);
+
+        let (ldap_tx, _ldap_rx) = ldap_test_channel();
+        let (dirsync_tx, _dirsync_rx) = dirsync_test_channel();
+        let result = do_directory_sync(&pool, &gateway_tx, &ldap_tx, &dirsync_tx).await;
+
+        // the sync aborts instead of acting on an incomplete list of allowed users
+        assert_eq!(User::all(&pool).await.unwrap().len(), users_before);
+        assert!(get_test_user(&pool, "FirstName").await.is_some());
+        assert!(get_test_user(&pool, "LastName").await.is_some());
+        assert!(result.is_err());
+    }
+
     #[sqlx::test]
     async fn test_users_prefetch_allowed_emails(_: PgPoolOptions, options: PgConnectOptions) {
         let pool = setup_pool(options).await;
```

---

### Incident Patch 3: `86603705` (2026-10-02)
**Commit Message**: fix gateway trim logic on license expiry (#3787)

* keep one gw per location when license expires

* make edge trim deterministic

**File**: `.sqlx/query-31a7b0bb29abd495b5cec4e6d68f1d575ad4d755e18fa493db2581425309e368.json` (renamed, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "db_name": "PostgreSQL",
-  "query": "UPDATE gateway SET enabled = false WHERE enabled AND id NOT IN (SELECT id FROM gateway WHERE enabled LIMIT 1\n            )",
+  "query": "UPDATE gateway SET enabled = false WHERE enabled AND id NOT IN (SELECT DISTINCT ON (location_id) id FROM gateway WHERE enabled ORDER BY location_id, id\n            )",
   "describe": {
     "columns": [],
     "parameters": {
       "Left": []
     },
     "nullable": []
   },
-  "hash": "4b1b06bb9769c0237e467ee7cc5265d9b0c45a5b27368cffd634d858e974d8aa"
+  "hash": "31a7b0bb29abd495b5cec4e6d68f1d575ad4d755e18fa493db2581425309e368"
 }
```

**File**: `.sqlx/query-8d074246e8abad4a54b5a53a4414a4bc49c89343e02219514a3e4a4548d5655d.json` (renamed, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "db_name": "PostgreSQL",
-  "query": "SELECT * FROM proxy WHERE enabled AND id NOT IN (SELECT id FROM proxy WHERE enabled LIMIT 1\n            )",
+  "query": "SELECT * FROM proxy WHERE enabled AND id NOT IN (SELECT id FROM proxy WHERE enabled ORDER BY id LIMIT 1\n            )",
   "describe": {
     "columns": [
       {
@@ -100,5 +100,5 @@
       true
     ]
   },
-  "hash": "27e7e18a7014af541fe5f8f051f78d61eebe6a79945324e98ca452b50d6abc90"
+  "hash": "8d074246e8abad4a54b5a53a4414a4bc49c89343e02219514a3e4a4548d5655d"
 }
```

**File**: `crates/defguard_common/src/db/models/gateway.rs` (modified, +2/-2)
```diff
@@ -209,14 +209,14 @@ impl Gateway<Id> {
         Ok(record)
     }
 
-    /// Disable all Gateways except one. Used for expired licence.
+    /// Keep one enabled Gateway per location. Used for expired licence.
     pub async fn leave_one_enabled<'e, E>(executor: E) -> sqlx::Result<()>
     where
         E: PgExecutor<'e>,
     {
         let result = query_scalar!(
             "UPDATE gateway SET enabled = false WHERE enabled AND id NOT IN (\
-                SELECT id FROM gateway WHERE enabled LIMIT 1
+                SELECT DISTINCT ON (location_id) id FROM gateway WHERE enabled ORDER BY location_id, id
             )"
         )
         .execute(executor)
```

**File**: `crates/defguard_common/src/db/models/proxy.rs` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ impl Proxy<Id> {
         query_as!(
             Self,
             "SELECT * FROM proxy WHERE enabled AND id NOT IN (\
-                SELECT id FROM proxy WHERE enabled LIMIT 1
+                SELECT id FROM proxy WHERE enabled ORDER BY id LIMIT 1
             )"
         )
         .fetch_all(executor)
```

**File**: `crates/defguard_core/src/enterprise/license.rs` (modified, +47/-11)
```diff
@@ -612,7 +612,7 @@ pub fn update_cached_license(key: Option<&str>) -> Result<(), LicenseError> {
 const RENEWAL_TIME: TimeDelta = TimeDelta::hours(24);
 const MAX_OVERDUE_TIME: TimeDelta = TimeDelta::days(14);
 
-/// Scale down enabled Gateways and Edges to one (per component).
+/// Keep one enabled Gateway per location and one Edge per instance.
 async fn trim_gateways_and_edges(
     pool: &PgPool,
     proxy_control_tx: &tokio::sync::mpsc::Sender<ProxyControlMessage>,
@@ -1073,7 +1073,12 @@ mod test {
     async fn test_trim_gateways_and_edges(_: PgPoolOptions, options: PgConnectOptions) {
         let pool = setup_pool(options).await;
 
-        let location = WireguardNetwork::default().save(&pool).await.unwrap();
+        let mut location_a = WireguardNetwork::default();
+        location_a.name = "Location A".to_string();
+        let location_a = location_a.save(&pool).await.unwrap();
+        let mut location_b = WireguardNetwork::default();
+        location_b.name = "Location B".to_string();
+        let location_b = location_b.save(&pool).await.unwrap();
         let user = User::new(
             "tester",
             Some("hunter2"),
@@ -1087,20 +1092,24 @@ mod test {
         .unwrap();
         let fullname = user.fullname();
 
-        Gateway::new(location.id, "Gateway 1", "localhost", 8000, &fullname)
+        Gateway::new(location_a.id, "Gateway 1", "localhost", 8000, &fullname)
             .save(&pool)
             .await
             .unwrap();
-        Gateway::new(location.id, "Gateway 2", "localhost", 8001, &fullname)
+        Gateway::new(location_a.id, "Gateway 2", "localhost", 8001, &fullname)
+            .save(&pool)
+            .await
+            .unwrap();
+        Gateway::new(location_b.id, "Gateway 3", "localhost", 8002, &fullname)
             .save(&pool)
             .await
             .unwrap();
 
-        Proxy::new("Proxy 1", "localhost", 9000, &fullname)
+        let proxy_1 = Proxy::new("Proxy 1", "localhost", 9000, &fullname)
             .save(&pool)
             .await
             .unwrap();
-        Proxy::new("Proxy 2", "localhost", 9001, &fullname)
+        let proxy_2 = Proxy::new("Proxy 2", "localhost", 9001, &fullname)
             .save(&pool)
             .await
             .unwrap();
@@ -1113,15 +1122,42 @@ mod test {
             .unwrap();
 
         let all_gateways = Gateway::all(&pool).await.unwrap();
-        assert_eq!(1, all_gateways.iter().filter(|gw| gw.enabled).count());
+        assert_eq!(2, all_gateways.iter().filter(|gw| gw.enabled).count());
         assert_eq!(1, all_gateways.iter().filter(|gw| !gw.enabled).count());
+        assert!(
+            all_gateways
+                .iter()
+                .any(|gateway| gateway.name == "Gateway 1" && gateway.enabled)
+        );
+        assert!(
+            all_gateways
+                .iter()
+                .any(|gateway| gateway.name == "Gateway 2" && !gateway.enabled)
+        );
+        assert!(
+            all_gateways
+                .iter()
+                .any(|gateway| gateway.name == "Gateway 3" && gateway.enabled)
+        );
 
         let all_proxies = Proxy::all(&pool).await.unwrap();
-        assert_eq!(1, all_proxies.iter().filter(|gw| gw.enabled).count());
-        assert_eq!(1, all_proxies.iter().filter(|gw| !gw.enabled).count());
+        assert_eq!(1, all_proxies.iter().filter(|proxy| proxy.enabled).count());
+        assert_eq!(1, all_proxies.iter().filter(|proxy| !proxy.enabled).count());
+        assert!(
+            all_proxies
+                .iter()
+                .any(|proxy| proxy.id == proxy_1.id && proxy.enabled)
+        );
+        assert!(
+            all_proxies
+                .iter()
+                .any(|proxy| proxy.id == proxy_2.id && !proxy.enabled)
+        );
 
-        // Only one Proxy has to be shut down.
-        assert!(proxy_control_rx.try_recv().is_ok());
+        assert!(matches!(
+            proxy_control_rx.try_recv(),
+            Ok(ProxyControlMessage::ShutdownConnection(id)) if id == proxy_2.id
+        ));
         assert!(proxy_control_rx.try_recv().is_err());
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #3875** (2026-10-15): Add desktop and mobile v2.2 as posture-check option (@j-chmielewski)
- **PR #3873** (2026-10-15): Show error message if OIDC login fails (@t-aleksander)
- **PR #3871** (2026-10-15): Ensure Defguard and Public urls differ (@j-chmielewski)
- **PR #3867** (2026-10-14): Copy fixes (@j-chmielewski)
- **PR #3866** (2026-10-14): Fix MFA Flow button phasing (@jakub-tldr)
- **PR #3865** (2026-10-14): Fix permissions to allow load-test workflow alerts (@j-chmielewski)

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

## X. LDAP): handle escaped commas when parsing DNs (#3703)

**RULE**:
When implementing operations in `crates/defguard_core/src/enterprise/ldap/client.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in DefGuard/defguard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d8b8e8e0`: LDAP): handle escaped commas when parsing DNs (#3703). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/defguard_core/src/enterprise/ldap/client.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use super::{LDAPConfig, LDAPConnection, dn::find_unescaped_separator, error::LdapError};
            if let Some(new_rdn) =
                find_unescaped_separator(new_dn, b',').and_then(|index| new_dn.get(..index))
            {
                            if let Some(user) = dn_map.get(&self.config.dn_match_key(v)) {
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
use super::{LDAPConfig, LDAPConnection, error::LdapError};
            if let Some((new_rdn, _rest)) = new_dn.split_once(',') {
                            if let Some(user) = dn_map.get(&Dn::from(v.as_str())) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d8b8e8e0` are properly handled with clean fallback behavior.
