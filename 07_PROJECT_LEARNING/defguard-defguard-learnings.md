# Forensic Learning Record (Deep Inspection): DefGuard/defguard

> **Canonical Artifact**: `07_PROJECT_LEARNING/defguard-defguard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DefGuard/defguard](https://github.com/DefGuard/defguard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:23:07.412Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DefGuard/defguard`
- **Description**: Zero-Trust access management with true WireGuard® 2FA/MFA
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2857 stars

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

### Core Architecture Module: `crates/defguard_core/src/db/models/mod.rs`
```
pub mod activity_log;
pub mod enrollment;
pub mod webhook;

```

### Core Architecture Module: `crates/defguard_core/src/db/models/webhook.rs`
```
use defguard_common::{
    db::{Id, NoId},
    types::user_info::UserInfo,
};
use model_derive::Model;
use sqlx::{FromRow, PgPool, query_as};
use utoipa::ToSchema;

/// App events which triggers webhook action
#[derive(Debug)]
pub enum AppEvent {
    UserCreated(UserInfo),
    UserModified(UserInfo),
    UserDeleted(String),
    HWKeyProvision(HWKeyUserData),
}

/// User data send on HWKeyProvision AppEvent
#[derive(Debug, Serialize)]
pub struct HWKeyUserData {
    pub username: String,
    pub email: String,
    pub ssh_key: String,
    pub pgp_key: String,
    pub serial: String,
}

impl AppEvent {
    // Debug name
    #[must_use]
    pub fn name(&self) -> &str {
        match self {
            Self::UserCreated(_) => "user created",
            Self::UserModified(_) => "user modified",
            Self::UserDeleted(_) => "user deleted",
            Self::HWKeyProvision(_) => "hwkey provisioned",
        }
    }

    /// Database column name.
    #[must_use]
    pub fn column_name(&self) -> &str {
        match self {
            Self::UserCreated(_) => "on_user_created",
            Self::UserModified(_) => "on_user_modified",
            Self::UserDeleted(_) => "on_user_deleted",
            Self::HWKeyProvision(_) => "on_hwkey_provision",
        }
    }
}

#[derive(Clone, Debug, Deserialize, FromRow, Model, Serialize, ToSchema, PartialEq)]
pub struct WebHook<I = NoId> {
    #[schema(value_type = i64)]
    pub id: I,
    pub url: String,
    pub description: String,
    pub token: String,
    pub enabled: bool,
    pub on_user_created: bool,
    pub on_user_deleted: bool,
    pub on_user_modified: bool,
    pub on_hwkey_provision: bool,
}

impl WebHook<Id> {
    /// Fetch all enabled webhooks.
    pub async fn all_enabled(pool: &PgPool, trigger: &AppEvent) -> sqlx::Result<Vec<Self>> {
        let column_name = trigger.column_name();
        let query = format!(
            "SELECT id, url, description, token, enabled, on_user_created, \
            on_user_deleted, on_user_modified, on_hwkey_provision FROM webhook \
            WHERE enabled AND {column_name}"
        );
        query_as(&query).fetch_all(pool).await
    }

    /// Find [`WebHook`] by URL.
    pub async fn find_by_url(pool: &PgPool, url: &str) -> sqlx::Result<Option<Self>> {
        query_as!(
            Self,
            "SELECT id, url, description, token, enabled, on_user_created, \
            on_user_deleted, on_user_modified, on_hwkey_provision FROM webhook WHERE url = $1",
            url
        )
        .fetch_optional(pool)
        .await
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3774** (2026-10-01): **Apt repository is not signing properly. Apt is reporting a 'Clearsigned file isn't valid'**
  *Symptoms*: **Describe the bug** Seems the deb apt repository is no longer signed. I cannot refresh the key. See screenshot below  **To Reproduce** Steps to reproduce the behavior: 1. apt update with the apt repository in /etc/apt/sources.list.d/defguard.sources (or .list) 2. see apt error  **Expected behavior** Expecting apt to pass with no errors, if there was any pending updates.   **Version information** - Defguard Core version: v2.1.0 - Defguard Gateway version: N/A, just cli   - Operating system and version running the gateway: Debian 13, Running in a LXC container inside Proxmox VE 9.2.21  - Your browser and version [e.g. chrome 99, safari]: N/A, just CLI  **Screenshots** If applicable, add screenshots to help explain your problem. <img width="1005" height="130" alt="Image" src="https://github.com/user-attachments/assets/197d55ef-3f2a-40d8-836c-38bf01008dfd" />  **Additional context** N/A 
  **Post-Mortem & Fix Analysis**:
  > Hello @kokomo123,  Could you please try again? APT repository should work now.
  > Can confirm, it successfully works! Closing. Thank you very much :) 

- **Issue #3771** (2026-09-30): **After removing SMTP configuration, "Email Verification Code" stays in MFA Flow without any warning**
  *Symptoms*: 1. Enable SMTP 2. Add MFA Flow with 1 step and 1 factor "Email Verification Code" 3. Disable SMTP   Users without SMTP will be presented with error <img width="312" height="48" alt="Image" src="https://github.com/user-attachments/assets/cf8c1217-5d91-478f-85af-0709abac5f4e" />  <img width="553" height="46" alt="Image" src="https://github.com/user-attachments/assets/843a145c-9047-4b8b-8937-0e2aa347cd51" />   We should add warning when removing SMTP configuration, as we do in OIDC case.  Potentially, block removal if there are existing MFA flows containing steps with 1 factor - Email Verification Code ^ This also happen with OIDC. 
  **Post-Mortem & Fix Analysis**:
  > When the user configured Email factor before the admin disabled SMTP, the client also behaves incorrectly and shows "Configure MFA" button instead of "Connect VPN".
  > Duplicates #3723 

- **Issue #3747** (2026-10-02): **Create location during initial wizard doesn't work correctly**
  *Symptoms*: After clicking "Create location now", user should be brought to location wizard or login page-> location wizard. Currently user is brought to login page -> VPN Overview  https://github.com/user-attachments/assets/31717c55-0d62-4e2b-904b-9097ac4c51af
  **Post-Mortem & Fix Analysis**:
  > Test if bug still occurs on 2.1.1

- **Issue #3725** (2026-10-05): **TOTP MFA stops working after re-enrollment, but is left on profile**
  *Symptoms*: 1. Enroll normally, add TOTP MFA to account 2. Set all locations to non-mfa 3. Trigger re-enrollment on user 4. Set location to Internal MFA 5. Try to authenticate with TOTP added in step 1. (doesn't work)  Either we should remove this method from the account, or we shouldn't break the existing method
  **Post-Mortem & Fix Analysis**:
  > We should remove all MFA methods from the profile on re-enrollment
  > The TOTP secret was silently overridden during reenrollment when no location used MFA. **Decision**: instead of removing all  MFA methods, we will leave them untouched.

- **Issue #3707** (2026-09-28): **LDAP sync: `Missing attribute: givenName` against servers that return attribute names in a different case (LLDAP) — attribute lookup should be case-insensitive (RFC 4512 §2.5)**
  *Symptoms*: Environment: Defguard Core 2.1.0 (Business/free tier), LDAP server LLDAP 0.6.3, `ldap_user_obj_class=inetOrgPerson`, `ldap_group_obj_class=groupOfUniqueNames`, `ldap_member_attr=uniqueMember`, LDAP authority, two-way sync.  What happens: `POST /ldap/test` and the sync find every user, then each one is skipped with `Missing attribute: givenName`.  Why (from the sources): the user search asks for `["*", ldap_member_attr]` and then reads the attribute with an exact `HashMap::get("givenName")` — `crates/defguard_core/src/enterprise/ldap/client.rs:449` and `ldap/model.rs:73,344` in v2.1.0 (still exact on `main` when checked on 2026-09-20). LLDAP expands the `*` request from its own attribute table, which spells the key `givenname` (lower case), and that spelling wins over an explicitly requested `givenName` (`crates/ldap/src/core/utils.rs::expand_attribute_wildcards`, a `BTreeMap::extend`). So the entry comes back with `givenname` and the exact lookup misses.  RFC 4512 §2.5: attribute type names (descriptors) are case-insensitive. A server is free to return `givenname`, `GIVENNAME` or `givenName`; the client has to match them as equal. Any server that normalises attribute names (LLDAP does; some AD-facing proxies do too) hits this.  Suggested fix: compare attribute names case-insensitively when reading a `SearchEntry` (e.g. lower-case both the requested name and the returned keys once, or look the key up through `eq_ignore_ascii_case`), for `givenName`, `sn`, `mail`, `uniqueMember
  **Post-Mortem & Fix Analysis**:
  > @jakub-tldr please exercise the standard LDAP test scenarios against the fix introduced in the linked PR. The rest of the LDAP behavior should not change.
  > This will be tested along with other LDAP fixes when the related DN migration fix ships. The fix is coming in 2.1.1.

- **Issue #3698** (2026-09-25): **Invalid parsing of escape characters in DN when importing LDAP users**
  *Symptoms*: Users whose CN contains a comma, for example `CN=Doe\, John - jdoe,OU=Members,DC=example,DC=com`, never receive their LDAP group memberships in Defguard. With LDAP as the authority they are also removed from the Defguard group on each sync.   The debug log shows Defguard rendering the DN as `CN=Doe\5c, John - jdoe,OU=...`, which does not match the value retrieved from LDAP server.  **Cause:** `extract_rdn_value` and `extract_dn_path` both split a DN at the first literal comma with no awareness of the \, escape, so for the DN above Defguard stores ldap_rdn = Doe\ and ldap_user_path = " John - jdoe,OU=Members,...". 2.0 added `dn_escape` on reassembly in `user_dn` method, which correctly protects the stray backslash as \5c. The rebuilt DN then does not match the member value the directory returns and the membership is dropped.  

- **Issue #3696** (2026-09-28): **AllowedIPs should not generate a /31 prefix**
  *Symptoms*: **Describe the bug** We have the "Automatically add IPs used in Firewall Rules to the Allowed IPs list" option enabled on a location. In the firewall rules, we have added "192.168.3.64,192.168.3.65", which is then pushed into the AllowedIPs as "192.168.3.64/31".  This causes a problem on Windows, it appears that it still doesn't support /31 prefixes. Which in this case, causes the IP 192.168.3.65 to be unreachable from Windows VPN clients.  **To Reproduce** Enable "Automatically add IPs used in Firewall Rules to the Allowed IPs list" Add a rule to allow IP 192.168.3.64,192.168.3.65 or similar Connect from Windows and ping both IP's, the last host from the /31 will be unreachable Connect from Linux and ping both IP's, both will work  **Expected behavior** The AllowedIPs should not combine IP's into a /31 prefix, but keep it as separate /32  **Version information** - Defguard Core version: v2.1.0 - Defguard Gateway version: v2.1.1 - Operating system and version running the gateway: Debian 13  
  **Post-Mortem & Fix Analysis**:
  > @jakub-tldr Please test it

- **Issue #3695** (2026-09-17): **Defguard Client Version 2.1.0 Power Management Issue**
  *Symptoms*: I have upgraded (clean install) the Defguard client from version 1.6.9 to 2.1.0.  My computer no longer turns off the screen, at the set time in the Power Management options, as it used to before.  It obviously does not go into standby either.  I am 100% certain that this specific program is the problem, because I have reverted to the previous version, and things are back to normal.  I have also noticed that the compact program window is always on top of all other windows, and cannot be dragged around the screen, or have its focus changed.  I do believe that this behaviour is, more than likely, directly attributed to the aforementioned problem.  I am currently running the program on Windows 10 Pro 22H2. 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of https://github.com/DefGuard/client/issues/1164

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

### Incident Patch 1: `86603705` (2026-10-02)
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

---

### Incident Patch 2: `78b97510` (2026-09-28)
**Commit Message**: Disallow CIDR of /31 and fix address range handling (#3708) (#3749)

Co-authored-by: Adam <[REDACTED_EMAIL]>

**File**: `crates/defguard_core/src/enterprise/allowed_ips/mod.rs` (modified, +6/-6)
```diff
@@ -72,8 +72,8 @@ pub async fn get_allowed_ips_from_acl_rules(
     let acl_rules = get_location_active_acl_rules(location, &mut *conn).await?;
 
     // Collect all destination networks and ranges across all matching rules.
-    let mut all_networks: Vec<IpNetwork> = Vec::new();
-    let mut all_ranges: Vec<RangeInclusive<IpAddr>> = Vec::new();
+    let mut all_networks = Vec::new();
+    let mut all_ranges = Vec::new();
 
     for rule in acl_rules {
         if !rule.user_is_allowed(user.id, &mut *conn).await? {
@@ -128,20 +128,20 @@ pub async fn get_allowed_ips_from_acl_rules(
     }
 
     // Convert all networks to ranges and combine with the explicit ranges collected above.
-    let combined_ranges: Vec<RangeInclusive<IpAddr>> = all_networks
+    let combined_ranges = all_networks
         .iter()
         .map(ipnetwork_to_range)
         .chain(all_ranges)
-        .collect();
+        .collect::<Vec<_>>();
 
     // Merge overlapping/adjacent ranges then decompose into minimal non-overlapping subnets.
-    let result: Vec<IpNetwork> = merge_ranges(combined_ranges)
+    let result = merge_ranges(combined_ranges)
         .into_iter()
         .flat_map(|range| {
             let (start, end) = range.into_inner();
             extract_subnets_from_range(start, end)
         })
-        .collect();
+        .collect::<Vec<_>>();
 
     debug!(
         "Computed {} AllowedIPs networks for user {} in location {}",
```

**File**: `crates/defguard_core/src/enterprise/allowed_ips/tests.rs` (modified, +16/-15)
```diff
@@ -1,4 +1,4 @@
-use std::net::IpAddr;
+use std::net::{IpAddr, Ipv4Addr};
 
 use chrono::DateTime;
 use defguard_common::db::{
@@ -263,12 +263,16 @@ async fn test_allow_all_users(_: PgPoolOptions, options: PgConnectOptions) {
 
     let location = create_acl_location(&pool, "10.0.0.1/24").await;
 
-    let user_1 = User::new("alice", Some("pw"), "Alice", "T", "a@example.com", None);
-    let user_1 = user_1.save(&pool).await.unwrap();
-    let user_2 = User::new("bob", Some("pw"), "Bob", "T", "b@example.com", None);
-    let user_2 = user_2.save(&pool).await.unwrap();
+    let user_1 = User::new("alice", Some("pw"), "Alice", "T", "a@example.com", None)
+        .save(&pool)
+        .await
+        .unwrap();
+    let user_2 = User::new("bob", Some("pw"), "Bob", "T", "b@example.com", None)
+        .save(&pool)
+        .await
+        .unwrap();
 
-    let destination = "172.16.0.0/12".parse().unwrap();
+    let destination = IpNetwork::new(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 0)), 12).unwrap();
     let rule = AclRule {
         name: "allow-everyone".into(),
         state: RuleState::Applied,
@@ -285,17 +289,12 @@ async fn test_allow_all_users(_: PgPoolOptions, options: PgConnectOptions) {
 
     let mut conn = pool.acquire().await.unwrap();
 
-    // Every user should receive the destination regardless of explicit membership
+    // Every user should receive the destination regardless of explicit membership.
     for user in [&user_1, &user_2] {
         let result = get_allowed_ips_from_acl_rules(&mut conn, &location, user)
             .await
             .unwrap();
-        assert_eq!(
-            result,
-            vec![destination],
-            "user {} should be allowed",
-            user.id
-        );
+        assert_eq!(result, [destination], "user {} should be allowed", user.id);
     }
 }
 
@@ -738,10 +737,12 @@ async fn test_address_range_decomposed_to_cidrs(_: PgPoolOptions, options: PgCon
 
     let expected = vec![
         "10.0.1.1/32".parse().unwrap(),
-        "10.0.1.2/31".parse().unwrap(),
+        "10.0.1.2/32".parse().unwrap(),
+        "10.0.1.3/32".parse().unwrap(),
         "10.0.1.4/30".parse().unwrap(),
         "10.0.1.8/30".parse().unwrap(),
-        "10.0.1.12/31".parse().unwrap(),
+        "10.0.1.12/32".parse().unwrap(),
+        "10.0.1.13/32".parse().unwrap(),
         "10.0.1.14/32".parse().unwrap(),
     ];
     assert_eq!(result, expected);
```

**File**: `crates/defguard_core/src/enterprise/firewall/mod.rs` (modified, +2/-3)
```diff
@@ -619,12 +619,11 @@ where
 /// Converts an IP address range into `Vec<IpAddress>` for use in firewall rules,
 /// delegating decomposition to the shared [`extract_subnets_from_range`] utility and
 /// mapping each resulting [`IpNetwork`] to the appropriate gRPC [`IpAddress`] variant.
-/// Falls back to [`Address::IpRange`] when the range cannot be expressed as any CIDR.
+/// Falls back to [`Address::IpRange`] when the range cannot be decomposed at all.
 fn extract_all_subnets_from_range(range_start: IpAddr, range_end: IpAddr) -> Vec<IpAddress> {
     let networks = extract_subnets_from_range(range_start, range_end);
 
-    // If decomposition produced nothing for a multi-IP range, the range straddles
-    // a CIDR boundary and cannot be expressed as subnets - fall back to IpRange.
+    // Decomposition only comes up empty on mixed IP versions, which callers filter out.
     if networks.is_empty() && range_start != range_end {
         return vec![IpAddress::IpRange(IpRange {
             start: range_start.to_string(),
```

**File**: `crates/defguard_core/src/enterprise/firewall/tests/destination.rs` (modified, +47/-83)
```diff
@@ -6,7 +6,7 @@ use std::{
 use defguard_common::{
     db::{NoId, models::WireguardNetwork, setup_pool},
     gateway_types::{
-        FirewallPolicy, IpAddress, IpRange, Port, PortRange as GwPortRange, Protocol as GwProtocol,
+        FirewallPolicy, IpAddress, Port, PortRange as GwPortRange, Protocol as GwProtocol,
     },
 };
 use defguard_proto::enterprise::firewall::Protocol as ProtoProtocol;
@@ -55,10 +55,8 @@ fn test_process_destination_addrs_v4() {
         [
             IpAddress::IpSubnet("10.0.1.0/24".to_owned()),
             IpAddress::IpSubnet("10.0.2.0/24".to_owned()),
-            IpAddress::IpRange(IpRange {
-                start: "10.0.3.255".to_owned(),
-                end: "10.0.4.0".to_owned(),
-            }),
+            IpAddress::Ip("10.0.3.255".to_owned()),
+            IpAddress::Ip("10.0.4.0".to_owned()),
             IpAddress::IpSubnet("192.168.1.0/24".to_owned()),
         ]
     );
@@ -180,14 +178,10 @@ async fn test_any_address_overwrites_manual_destination(
         .rules;
 
     let expected_source_addrs = [
-        IpAddress::IpRange(IpRange {
-            start: "10.0.1.1".to_owned(),
-            end: "10.0.1.2".to_owned(),
-        }),
-        IpAddress::IpRange(IpRange {
-            start: "10.0.2.1".to_owned(),
-            end: "10.0.2.2".to_owned(),
-        }),
+        IpAddress::Ip("10.0.1.1".to_owned()),
+        IpAddress::Ip("10.0.1.2".to_owned()),
+        IpAddress::Ip("10.0.2.1".to_owned()),
+        IpAddress::Ip("10.0.2.2".to_owned()),
     ];
 
     assert_eq!(generated_firewall_rules.len(), 2);
@@ -275,14 +269,10 @@ async fn test_any_address_overwrites_destination_alias_addrs(
         .rules;
 
     let expected_source_addrs = [
-        IpAddress::IpRange(IpRange {
-            start: "10.0.1.1".to_owned(),
-            end: "10.0.1.2".to_owned(),
-        }),
-        IpAddress::IpRange(IpRange {
-            start: "10.0.2.1".to_owned(),
-            end: "10.0.2.2".to_owned(),
-        }),
+        IpAddress::Ip("10.0.1.1".to_owned()),
+        IpAddress::Ip("10.0.1.2".to_owned()),
+        IpAddress::Ip("10.0.2.1".to_owned()),
+        IpAddress::Ip("10.0.2.2".to_owned()),
     ];
 
     assert_eq!(generated_firewall_rules.len(), 2);
@@ -367,19 +357,15 @@ async fn test_manual_destination_includes_component_alias_address_range(
         .rules;
 
     let expected_source_addrs = [
-        IpAddress::IpRange(IpRange {
-            start: "10.0.1.1".to_owned(),
-            end: "10.0.1.2".to_owned(),
-        }),
-        IpAddress::IpRange(IpRange {
-            start: "10.0.2.1".to_owned(),
-            end: "10.0.2.2".to_owned(),
-        }),
+        IpAddress::Ip("10.0.1.1".to_owned()),
+        IpAddress::Ip("10.0.1.2".to_owned()),
+        IpAddress::Ip("10.0.2.1".to_owned()),
+        IpAddress::Ip("10.0.2.2".to_owned()),
+    ];
+    let expected_destination_addrs = [
+        IpAddress::Ip("10.2.0.255".to_owned()),
+        IpAddress::Ip("10.2.1.0".to_owned()),
     ];
-    let expected_destination_addrs = [IpAddress::IpRange(IpRange {
-        start: "10.2.0.255".to_owned(),
-        end: "10.2.1.0".to_owned(),
-    })];
 
     assert_eq!(generated_firewall_rules.len(), 2);
 
@@ -466,24 +452,16 @@ async fn test_manual_destination_merges_rule_and_component_alias_address_ranges(
         .rules;
 
     let expected_source_addrs = [
-        IpAddress::IpRange(IpRange {
-            start: "10.0.1.1".to_owned(),
-            end: "10.0.1.2".to_owned(),
-        }),
-        IpAddress::IpRange(IpRange {
-            start: "10.0.2.1".to_owned(),
-            end: "10.0.2.2".to_owned(),
-        }),
+        IpAddress::Ip("10.0.1.1".to_owned()),
+        IpAddress::Ip("10.0.1.2".to_owned()),
+        IpAddress::Ip("10.0.2.1".to_owned()),
+        IpAddress::Ip("10.0.2.2".to_owned()),
     ];
     let expected_destination_addrs = [
-        IpAddress::IpRange(IpRange {
-            start: "10.2.0.255".to_owned(),
-            end: "10.2.1.0".to_owned(),
-        }),
-        IpAddress::IpRange(IpRange {
-            start: "10.3.0.255".to_owned(),
-            end: "10.3.1.0".to_owned(),
-        }),
+        IpAddress::Ip("10.2.0.255".to_owned()),
+        IpAddress::Ip("10.2.1.0".to_owned()),
+        IpAddress::Ip("10.3.0.255".to_owned()),
+        IpAddress::Ip("10.3.1.0".to_owned()),
     ];
 
     assert_eq!(generated_firewall_rules.len(), 2);
@@ -560,18 +538,15 @@ async fn test_any_port_preserves_destination_addresses_and_protocols(
         .rules;
 
     let expected_source_addrs = [
-        IpAddress::IpRange(IpRange {
-            start: "10.0.1.1".to_owned(),
-            end: "10.0.1.2".to_owned(),
-        }),
-        IpAddress::IpRange(IpRange {
-            start: "10.0.2.1".to_owned(),
-            end: "10.0.2.2".to_owned(),
-        }),
+        IpAddress::Ip("10.0.1.1".to_owned()),
+        IpAddress::Ip("10.0.1.2".to_owned()),
+        IpAddress::Ip("10.0.2.1".to_owned()),
+        IpAddress::Ip("10.0.2.2".to_
```

**File**: `crates/defguard_core/src/enterprise/firewall/tests/ip_address_handling.rs` (modified, +39/-11)
```diff
@@ -1,6 +1,6 @@
 use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
 
-use defguard_common::gateway_types::{IpAddress, IpRange, Port, PortRange as GwPortRange};
+use defguard_common::gateway_types::{IpAddress, Port, PortRange as GwPortRange};
 use ipnetwork::Ipv6Network;
 
 use crate::enterprise::{
@@ -32,7 +32,8 @@ fn test_merge_v4_addrs() {
             IpAddress::IpSubnet("10.0.10.0/27".to_owned()),
             IpAddress::Ip("10.0.20.20".to_owned()),
             IpAddress::IpSubnet("10.0.60.20/30".to_owned()),
-            IpAddress::IpSubnet("10.0.60.24/31".to_owned()),
+            IpAddress::Ip("10.0.60.24".to_owned()),
+            IpAddress::Ip("10.0.60.25".to_owned()),
             IpAddress::Ip("192.168.0.20".to_owned()),
         ]
     );
@@ -119,7 +120,8 @@ fn test_merge_addrs_extracts_ipv6_subnets() {
 }
 
 #[test]
-fn test_merge_addrs_falls_back_to_range_when_no_subnet_fits() {
+fn test_merge_addrs_handles_ranges_straddling_cidr_boundary() {
+    // Both IP versions decompose down to single hosts.
     let ranges = vec![
         IpAddr::V4(Ipv4Addr::new(192, 168, 1, 255))..=IpAddr::V4(Ipv4Addr::new(192, 168, 2, 0)),
     ];
@@ -128,10 +130,10 @@ fn test_merge_addrs_falls_back_to_range_when_no_subnet_fits() {
 
     assert_eq!(
         result,
-        [IpAddress::IpRange(IpRange {
-            start: "192.168.1.255".to_owned(),
-            end: "192.168.2.0".to_owned(),
-        }),]
+        [
+            IpAddress::Ip("192.168.1.255".to_owned()),
+            IpAddress::Ip("192.168.2.0".to_owned()),
+        ]
     );
 
     let start = "2001:db8:ffff:ffff:ffff:ffff:ffff:ffff"
@@ -144,10 +146,10 @@ fn test_merge_addrs_falls_back_to_range_when_no_subnet_fits() {
 
     assert_eq!(
         result,
-        [IpAddress::IpRange(IpRange {
-            start: "2001:db8:ffff:ffff:ffff:ffff:ffff:ffff".to_owned(),
-            end: "2001:db9::".to_owned(),
-        }),]
+        [
+            IpAddress::Ip("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff".to_owned()),
+            IpAddress::Ip("2001:db9::".to_owned()),
+        ]
     );
 }
 
@@ -193,6 +195,32 @@ fn test_find_largest_ipv4_subnet_perfect_match() {
     assert_eq!(subnet.to_string(), "192.168.1.0/28");
 }
 
+#[test]
+fn test_find_largest_subnet_is_not_anchored_to_range_start() {
+    // The largest subnet sits in the middle of the range, touching neither end.
+    let start = IpAddr::V4(Ipv4Addr::LOCALHOST);
+    let end = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 127));
+
+    let result = find_largest_subnet_in_range(start, end);
+
+    assert_eq!(result.unwrap().to_string(), "127.0.0.64/26");
+
+    // The rest of the range still decomposes minimally.
+    assert_eq!(
+        merge_addrs(vec![start..=end]),
+        [
+            IpAddress::Ip("127.0.0.1".to_owned()),
+            IpAddress::Ip("127.0.0.2".to_owned()),
+            IpAddress::Ip("127.0.0.3".to_owned()),
+            IpAddress::IpSubnet("127.0.0.4/30".to_owned()),
+            IpAddress::IpSubnet("127.0.0.8/29".to_owned()),
+            IpAddress::IpSubnet("127.0.0.16/28".to_owned()),
+            IpAddress::IpSubnet("127.0.0.32/27".to_owned()),
+            IpAddress::IpSubnet("127.0.0.64/26".to_owned()),
+        ]
+    );
+}
+
 #[test]
 fn test_find_largest_ipv6_subnet_perfect_match() {
     // Test /112 subnet
```

**File**: `crates/defguard_core/src/enterprise/firewall/tests/mod.rs` (modified, +81/-143)
```diff
@@ -11,7 +11,7 @@ use defguard_common::{
         setup_pool,
     },
     gateway_types::{
-        FirewallPolicy, IpAddress, IpRange, IpVersion, Port, PortRange as GwPortRange,
+        FirewallPolicy, IpAddress, IpVersion, Port, PortRange as GwPortRange,
         Protocol as GwProtocol,
     },
 };
@@ -80,12 +80,12 @@ fn random_network_device_with_id<R: Rng>(rng: &mut R, id: Id) -> Device<Id> {
     device
 }
 
-fn expected_ipv4_source_range_for_user(user_id: Id) -> IpAddress {
+fn expected_ipv4_source_addrs_for_user(user_id: Id) -> [IpAddress; 2] {
     let user_octet = user_id as u8;
-    IpAddress::IpRange(IpRange {
-        start: format!("10.0.{user_octet}.1"),
-        end: format!("10.0.{user_octet}.2"),
-    })
+    [
+        IpAddress::Ip(format!("10.0.{user_octet}.1")),
+        IpAddress::Ip(format!("10.0.{user_octet}.2")),
+    ]
 }
 
 async fn create_test_user_with_devices<R: Rng>(
@@ -610,14 +610,10 @@ async fn test_generate_firewall_rules_ipv4(_: PgPoolOptions, options: PgConnectO
     assert_eq!(
         web_allow_rule.source_addrs,
         [
-            IpAddress::IpRange(IpRange {
-                start: "10.0.1.1".to_owned(),
-                end: "10.0.1.2".to_owned(),
-            }),
-            IpAddress::IpRange(IpRange {
-                start: "10.0.2.1".to_owned(),
-                end: "10.0.2.2".to_owned(),
-            }),
+            IpAddress::Ip("10.0.1.1".to_owned()),
+            IpAddress::Ip("10.0.1.2".to_owned()),
+            IpAddress::Ip("10.0.2.1".to_owned()),
+            IpAddress::Ip("10.0.2.2".to_owned()),
             IpAddress::Ip("10.0.100.1".to_owned()),
         ]
     );
@@ -642,24 +638,19 @@ async fn test_generate_firewall_rules_ipv4(_: PgPoolOptions, options: PgConnectO
     assert_eq!(
         dns_allow_rule.source_addrs,
         [
-            IpAddress::IpRange(IpRange {
-                start: "10.0.1.1".to_owned(),
-                end: "10.0.1.2".to_owned(),
-            }),
-            IpAddress::IpRange(IpRange {
-                start: "10.0.2.1".to_owned(),
-                end: "10.0.2.2".to_owned(),
-            }),
-            IpAddress::IpRange(IpRange {
-                start: "10.0.100.1".to_owned(),
-                end: "10.0.100.2".to_owned(),
-            }),
+            IpAddress::Ip("10.0.1.1".to_owned()),
+            IpAddress::Ip("10.0.1.2".to_owned()),
+            IpAddress::Ip("10.0.2.1".to_owned()),
+            IpAddress::Ip("10.0.2.2".to_owned()),
+            IpAddress::Ip("10.0.100.1".to_owned()),
+            IpAddress::Ip("10.0.100.2".to_owned()),
         ]
     );
 
     let expected_destination_addrs = [
         IpAddress::Ip("10.0.1.13".to_owned()),
-        IpAddress::IpSubnet("10.0.1.14/31".to_owned()),
+        IpAddress::Ip("10.0.1.14".to_owned()),
+        IpAddress::Ip("10.0.1.15".to_owned()),
         IpAddress::IpSubnet("10.0.1.16/28".to_owned()),
         IpAddress::IpSubnet("10.0.1.32/29".to_owned()),
         IpAddress::IpSubnet("10.0.1.40/30".to_owned()),
@@ -976,14 +967,10 @@ async fn test_generate_firewall_rules_ipv6(_: PgPoolOptions, options: PgConnectO
     assert_eq!(
         web_allow_rule.source_addrs,
         [
-            IpAddress::IpRange(IpRange {
-                start: "ff00::1:1".to_owned(),
-                end: "ff00::1:2".to_owned(),
-            }),
-            IpAddress::IpRange(IpRange {
-                start: "ff00::2:1".to_owned(),
-                end: "ff00::2:2".to_owned(),
-            }),
+            IpAddress::Ip("ff00::1:1".to_owned()),
+            IpAddress::Ip("ff00::1:2".to_owned()),
+            IpAddress::Ip("ff00::2:1".to_owned()),
+            IpAddress::Ip("ff00::2:2".to_owned()),
             IpAddress::Ip("ff00::100:1".to_owned()),
         ]
     );
@@ -1032,18 +1019,12 @@ async fn test_generate_firewall_rules_ipv6(_: PgPoolOptions, options: PgConnectO
     assert_eq!(
         dns_allow_rule.source_addrs,
         [
-            IpAddress::IpRange(IpRange {
-                start: "ff00::1:1".to_owned(),
-                end: "ff00::1:2".to_owned(),
-            }),
-            IpAddress::IpRange(IpRange {
-                start: "ff00::2:1".to_owned(),
-                end: "ff00::2:2".to_owned(),
-            }),
-            IpAddress::IpRange(IpRange {
-                start: "ff00::100:1".to_owned(),
-                end: "ff00::100:2".to_owned(),
-            }),
+            IpAddress::Ip("ff00::1:1".to_owned()),
+            IpAddress::Ip("ff00::1:2".to_owned()),
+            IpAddress::Ip("ff00::2:1".to_owned()),
+            IpAddress::Ip("ff00::2:2".to_owned()),
+            IpAddress::Ip("ff00::100:1".to_owned()),
+            IpAddress::Ip("ff00::100:2".to_owned()),
         ]
     );
     assert_eq!(dns_allow_rule.destination_addrs, expected_destination_addrs);
@@ -1371,14 +1352,10 @@ async fn test_generate_firewall_rules_ipv4_and_ipv6(_: PgPoolOptions, options: P
     assert_eq!(
         web_allow_rule_ipv4.source_addrs,
  
```

**File**: `crates/defguard_core/src/enterprise/firewall/tests/source.rs` (modified, +4/-2)
```diff
@@ -72,8 +72,10 @@ fn test_process_source_addrs_v4() {
         source_addrs,
         [
             IpAddress::Ip("10.0.1.1".to_owned()),
-            IpAddress::IpSubnet("10.0.1.2/31".to_owned()),
-            IpAddress::IpSubnet("10.0.1.4/31".to_owned()),
+            IpAddress::Ip("10.0.1.2".to_owned()),
+            IpAddress::Ip("10.0.1.3".to_owned()),
+            IpAddress::Ip("10.0.1.4".to_owned()),
+            IpAddress::Ip("10.0.1.5".to_owned()),
             IpAddress::Ip("172.16.1.1".to_owned()),
             IpAddress::Ip("192.168.1.100".to_owned()),
         ]
```

**File**: `crates/defguard_core/src/enterprise/utils.rs` (modified, +86/-129)
```diff
@@ -54,178 +54,135 @@ pub(crate) fn find_largest_subnet_in_range(start: IpAddr, end: IpAddr) -> Option
 }
 
 /// Finds the largest IPv4 subnet that fits within the given range.
-/// The subnet must contain more than one IP address since single IPs have their own
-/// representation.
+/// The highest bit at which `start` and `end` differ splits the range in two. Unless both
+/// halves are whole, making the range a subnet itself, the largest subnet lies against that
+/// split, on the side of the bigger half. We skip /0 networks.
 fn find_largest_ipv4_subnet_in_range(start: Ipv4Addr, end: Ipv4Addr) -> Option<IpNetwork> {
     let start_bits = start.to_bits();
     let end_bits = end.to_bits();
 
-    // Find the largest prefix length where the subnet fits in the range.
-    // We make some reasonable assumptions here and skip /0 and /32 networks.
-    for prefix_len in 1..=31 {
-        let mask = u32::MAX << (32 - prefix_len);
-
-        // number of IPs in subnet
-        let subnet_size = 1u32 << (32 - prefix_len);
-
-        // try to find first and last address in subnet
-        // in case the subnet does not align with first address in range
-        // try next potential subnet start
-        let network_addr = start_bits & mask;
-        let network_addr = if network_addr < start_bits {
-            // try next aligned address and handle overflow
-            let next_network_addr = network_addr.wrapping_add(subnet_size);
-            if next_network_addr < network_addr {
-                // overflow occurred, no valid network of this size
-                continue;
-            }
-            next_network_addr
-        } else {
-            network_addr
-        };
-
-        let broadcast_addr = network_addr | !mask;
-
-        if network_addr >= start_bits
-            && broadcast_addr <= end_bits
-            && let Ok(network) =
-                IpNetwork::new(IpAddr::V4(Ipv4Addr::from(network_addr)), prefix_len)
-        {
-            return Some(network);
-        }
-    }
-
-    None
+    // Bits below the split, empty for a single address.
+    let mask = u32::MAX.unbounded_shr((start_bits ^ end_bits).leading_zeros() + 1);
+    // First address above the split.
+    let boundary = (start_bits | mask).wrapping_add(1);
+    // Addresses on each side of the split.
+    let lower = (!start_bits & mask) + 1;
+    let upper = (end_bits & mask) + 1;
+
+    let (network_addr, prefix_len) = if lower.min(upper) > mask {
+        // The range is a subnet itself.
+        (start_bits, (start_bits ^ end_bits).leading_zeros().max(1))
+    } else if lower >= upper {
+        // The subnet ends at the split.
+        let prefix_len = lower.leading_zeros() + 1;
+        (boundary - (1 << (Ipv4Addr::BITS - prefix_len)), prefix_len)
+    } else {
+        // The subnet starts at the split.
+        (boundary, upper.leading_zeros() + 1)
+    };
+
+    IpNetwork::new(
+        IpAddr::V4(Ipv4Addr::from_bits(network_addr)),
+        prefix_len as u8,
+    )
+    .ok()
 }
 
 /// Finds the largest IPv6 subnet that fits within the given range.
-/// The subnet must contain more than one IP address since single IPs have their own
-/// representation.
+/// Works the same way as [`find_largest_ipv4_subnet_in_range`].
 fn find_largest_ipv6_subnet_in_range(start: Ipv6Addr, end: Ipv6Addr) -> Option<IpNetwork> {
     let start_bits = start.to_bits();
     let end_bits = end.to_bits();
 
-    // Find the largest prefix length where the subnet fits in the range.
-    // We make some reasonable assumptions here and skip /0 and /128 networks.
-    for prefix_len in 1..=127 {
-        let mask = u128::MAX << (128 - prefix_len);
-
-        // number of IPs in subnet
-        let subnet_size = 1u128 << (128 - prefix_len);
+    // Bits below the split, empty for a single address.
+    let mask = u128::MAX.unbounded_shr((start_bits ^ end_bits).leading_zeros() + 1);
+    // First address above the split.
+    let boundary = (start_bits | mask).wrapping_add(1);
+    // Addresses on each side of the split.
+    let lower = (!start_bits & mask) + 1;
+    let upper = (end_bits & mask) + 1;
+
+    let (network_addr, prefix_len) = if lower.min(upper) > mask {
+        // The range is a subnet itself.
+        (start_bits, (start_bits ^ end_bits).leading_zeros().max(1))
+    } else if lower >= upper {
+        // The subnet ends at the split.
+        let prefix_len = lower.leading_zeros() + 1;
+        (boundary - (1 << (Ipv6Addr::BITS - prefix_len)), prefix_len)
+    } else {
+        // The subnet starts at the split.
+        (boundary, upper.leading_zeros() + 1)
+    };
+
+    IpNetwork::new(
+        IpAddr::V6(Ipv6Addr::from_bits(network_addr)),
+        prefix_len as u8,
+    )
+    .ok()
+}
 
-        // try to find first and last address in subnet
-        // in case the subnet does not align with first address in range
-        // try next potential subnet start
-        let network_addr = start_bits & mask;
-        let netwo
```

---

### Incident Patch 3: `d8b8e8e0` (2026-09-25)
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

### Incident Patch 4: `d5098974` (2026-09-02)
**Commit Message**: Fix TypeError: undefined is not an object (#3629)

**File**: `web/src/shared/api/api.ts` (modified, +5/-3)
```diff
@@ -1,5 +1,6 @@
 import dayjs from 'dayjs';
 import { cloneDeep } from 'lodash-es';
+import { isPresent } from '../defguard-ui/utils/isPresent';
 import { narrowLicenseSupport } from '../utils/license';
 import { removeEmptyStrings } from '../utils/removeEmptyStrings';
 import { client } from './api-client';
@@ -616,10 +617,11 @@ const api = {
     client
       .get<LicenseInfoResponse>(`/enterprise_info`)
       .then((res): LicenseInfo | null => {
-        if (res.data.license_info === null) return null;
+        const licenseInfo = res.data?.license_info;
+        if (!isPresent(licenseInfo)) return null;
         return {
-          ...res.data.license_info,
-          support_type_narrow: narrowLicenseSupport(res.data.license_info),
+          ...licenseInfo,
+          support_type_narrow: narrowLicenseSupport(licenseInfo),
         };
       }),
   support: {
```

**File**: `web/src/shared/api/types.ts` (modified, +1/-1)
```diff
@@ -522,7 +522,7 @@ export interface LicenseInfoApi {
 }
 
 export interface LicenseInfoResponse {
-  license_info: LicenseInfo | null;
+  license_info: LicenseInfoApi | null;
 }
 
 export interface LdapInfo {
```

---

### Incident Patch 5: `46ee0daa` (2026-08-28)
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

### Incident Patch 6: `46ba4f08` (2026-08-28)
**Commit Message**: Bump UI submodule (#3611)

**File**: `web/src/shared/defguard-ui` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 481b2e323f22ff45908c2ffa2de6ccf52620da4b
+Subproject commit 6a864644bfe20c24cbada92f0eb44fa32343d492
```

---

### Incident Patch 7: `965b2944` (2026-08-24)
**Commit Message**: OIDC email verified fix (#3598)

* require email to be verified to link accounts

* add tests

* review fixes

* update nix flake

* clippy fix

* formatting

* change comment & log level

* remove redundant type

**File**: `.sqlx/query-f50806305abd7402f21e5ed8c9e9688c6ea78ba2583da4612d1bff0a13813d7b.json` (renamed, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "db_name": "PostgreSQL",
-  "query": "SELECT id, username, password_hash, last_name, first_name, email, phone, mfa_enabled, totp_enabled, email_mfa_enabled, totp_secret, email_mfa_secret, mfa_method \"mfa_method: _\", recovery_codes, is_active, openid_sub, from_ldap, ldap_pass_randomized, ldap_rdn, ldap_user_path, ldap_remote_enrollment_completed, enrollment_pending FROM \"user\" WHERE email ILIKE $1",
+  "query": "SELECT id, username, password_hash, last_name, first_name, email, phone, mfa_enabled, totp_enabled, email_mfa_enabled, totp_secret, email_mfa_secret, mfa_method \"mfa_method: _\", recovery_codes, is_active, openid_sub, from_ldap, ldap_pass_randomized, ldap_rdn, ldap_user_path, ldap_remote_enrollment_completed, enrollment_pending FROM \"user\" WHERE LOWER(email) = LOWER($1)",
   "describe": {
     "columns": [
       {
@@ -156,5 +156,5 @@
       false
     ]
   },
-  "hash": "e20bb4d7529adc50b620a5a96bdccea9f2f51f0f45e1833555263cb776daf0d0"
+  "hash": "f50806305abd7402f21e5ed8c9e9688c6ea78ba2583da4612d1bff0a13813d7b"
 }
```

**File**: `crates/defguard_common/src/db/models/user.rs` (modified, +43/-1)
```diff
@@ -888,7 +888,7 @@ impl User<Id> {
             totp_enabled, email_mfa_enabled, totp_secret, email_mfa_secret, \
             mfa_method \"mfa_method: _\", recovery_codes, is_active, openid_sub, \
             from_ldap, ldap_pass_randomized, ldap_rdn, ldap_user_path, ldap_remote_enrollment_completed, enrollment_pending \
-            FROM \"user\" WHERE email ILIKE $1",
+            FROM \"user\" WHERE LOWER(email) = LOWER($1)",
             email
         )
         .fetch_optional(executor)
@@ -1358,6 +1358,48 @@ mod test {
         secret::SecretStringWrapper,
     };
 
+    #[sqlx::test]
+    async fn test_find_by_email_is_exact_not_a_pattern(
+        _: PgPoolOptions,
+        options: PgConnectOptions,
+    ) {
+        let pool = setup_pool(options).await;
+
+        User::new(
+            "hpotter",
+            Some("pass123"),
+            "Potter",
+            "Harry",
+            "h.potter@hogwart.edu.uk",
+            None,
+        )
+        .save(&pool)
+        .await
+        .unwrap();
+
+        // Lookups stay case-insensitive.
+        assert!(
+            User::find_by_email(&pool, "H.Potter@Hogwart.Edu.UK")
+                .await
+                .unwrap()
+                .is_some()
+        );
+
+        // The argument is a value, not a `LIKE` pattern: callers pass externally
+        // supplied addresses, so wildcards must never match another user.
+        for pattern in [
+            "%",
+            "%@%",
+            "h.potter@hogwart.edu.u_",
+            "_.potter@hogwart.edu.uk",
+        ] {
+            assert!(
+                User::find_by_email(&pool, pattern).await.unwrap().is_none(),
+                "email lookup treated {pattern:?} as a pattern"
+            );
+        }
+    }
+
     #[sqlx::test]
     async fn test_mfa_code(_: PgPoolOptions, options: PgConnectOptions) {
         let pool = setup_pool(options).await;
```

**File**: `crates/defguard_common/src/db/models/wizard.rs` (modified, +5/-7)
```diff
@@ -122,15 +122,13 @@ impl Wizard {
         .fetch_one(executor)
         .await?;
 
-        let active_wizard;
-
-        if has_auto_adopt_flags {
-            active_wizard = ActiveWizard::AutoAdoption;
+        let active_wizard = if has_auto_adopt_flags {
+            ActiveWizard::AutoAdoption
         } else if is_fresh_instance {
-            active_wizard = ActiveWizard::Initial;
+            ActiveWizard::Initial
         } else {
-            active_wizard = ActiveWizard::Migration;
-        }
+            ActiveWizard::Migration
+        };
 
         wizard.active_wizard = active_wizard;
 
```

**File**: `crates/defguard_core/src/enterprise/handlers/openid_login.rs` (modified, +19/-0)
```diff
@@ -322,6 +322,25 @@ pub async fn user_from_claims(
             user
         }
         None => {
+            // Only an explicit `false` is rejected. Some providers omit `email_verified`.
+            match token_claims.email_verified() {
+                Some(false) => {
+                    warn!(
+                        "OpenID login: provider reported email address {} as unverified, \
+                        refusing to link or create an account",
+                        email.as_str()
+                    );
+                    return Err(WebError::Authorization(
+                        "Provider did not verify the email address".into(),
+                    ));
+                }
+                None => debug!(
+                    "OpenID login: provider sent no email_verified claim for {}, so the address \
+                    cannot be confirmed as belonging to this identity",
+                    email.as_str()
+                ),
+                Some(true) => {}
+            }
             if let Some(mut user) = User::find_by_email(pool, email).await? {
                 if !user.is_active {
                     debug!("User {} tried to log in, but is disabled", user.username);
```

**File**: `crates/defguard_proxy_manager/src/servers/enrollment.rs` (modified, +5/-5)
```diff
@@ -1113,17 +1113,17 @@ impl EnrollmentServer {
         if user.is_enrolled() {
             return Err(Status::permission_denied("User is already enrolled"));
         }
-        let mfa_method: MFAMethod;
+
         // enable corresponding MFA
-        match method {
+        let mfa_method = match method {
             MfaMethod::Email => {
                 if !user.verify_email_mfa_code(&request.code) {
                     return Err(Status::invalid_argument("Email code invalid".to_owned()));
                 }
                 user.enable_email_mfa(&self.pool)
                     .await
                     .map_err(|_| Status::internal("Enabling method failed.".to_owned()))?;
-                mfa_method = MFAMethod::Email;
+                MFAMethod::Email
             }
             MfaMethod::Totp => {
                 if !user.verify_totp_code(&request.code) {
@@ -1132,12 +1132,12 @@ impl EnrollmentServer {
                 user.enable_totp(&self.pool)
                     .await
                     .map_err(|_| Status::internal("Enabling method failed.".to_owned()))?;
-                mfa_method = MFAMethod::OneTimePassword;
+                MFAMethod::OneTimePassword
             }
             _ => {
                 return Err(Status::invalid_argument("Method not supported"));
             }
-        }
+        };
         user.enable_mfa(&self.pool)
             .await
             .map_err(|_| Status::internal("Enabling MFA on the account failed.".to_owned()))?;
```

**File**: `crates/defguard_proxy_manager/src/tests/common/mod.rs` (modified, +22/-7)
```diff
@@ -762,8 +762,10 @@ struct OidcProviderState {
 /// * `POST /token`                             – exchange authorization code for ID token
 ///
 /// ### Code format
-/// The authorization code must be `"{sub}:{email}:{nonce}"`.  The `/token`
-/// handler parses those three components and embeds them in the signed JWT.
+/// The authorization code must be `"{sub}:{email}:{nonce}:{email_verified}"`.
+/// The `/token` handler parses those components and embeds them in the signed
+/// JWT. `email_verified` is `"true"` or `"false"`; omitting it drops the
+/// claim from the token.
 pub(crate) struct MockOidcProvider {
     /// HTTP base URL of the mock server, e.g. `http://127.0.0.1:45321`.
     pub(crate) base_url: String,
@@ -871,25 +873,35 @@ async fn oidc_jwks(State(state): State<OidcProviderState>) -> Json<serde_json::V
     }))
 }
 
-/// Parses the authorization code as `"{sub}:{email}:{nonce}"` and returns a
-/// signed RS256 ID token JWT.
+/// Parses the authorization code as `"{sub}:{email}:{nonce}:{email_verified}"`
+/// and returns a signed RS256 ID token JWT. The final segment is optional and
+/// may be `"true"` or `"false"`; when it is absent the `email_verified` claim is
+/// omitted. The nonce must not contain a colon.
 async fn oidc_token(
     State(state): State<OidcProviderState>,
     Form(params): Form<HashMap<String, String>>,
 ) -> Json<serde_json::Value> {
     let code = params.get("code").cloned().unwrap_or_default();
-    // code format: "{sub}:{email}:{nonce}"
-    let mut parts = code.splitn(3, ':');
+    // code format: "{sub}:{email}:{nonce}:{email_verified}"
+    let mut parts = code.splitn(4, ':');
     let sub = parts.next().unwrap_or("unknown-sub").to_owned();
     let email = parts.next().unwrap_or("unknown@example.com").to_owned();
     let nonce = parts.next().unwrap_or("").to_owned();
+    let email_verified = match parts.next() {
+        Some("true") => Some(true),
+        Some("false") => Some(false),
+        None => None,
+        Some(other) => {
+            panic!("unexpected email_verified segment in authorization code: {other:?}")
+        }
+    };
 
     let now = SystemTime::now()
         .duration_since(UNIX_EPOCH)
         .unwrap()
         .as_secs();
 
-    let claims = serde_json::json!({
+    let mut claims = serde_json::json!({
         "iss": state.base_url,
         "sub": sub,
         "aud": state.client_id,
@@ -901,6 +913,9 @@ async fn oidc_token(
         "family_name": "OidcUser",
         "name": "Test OidcUser",
     });
+    if let Some(email_verified) = email_verified {
+        claims["email_verified"] = serde_json::json!(email_verified);
+    }
 
     let mut header = Header::new(Algorithm::RS256);
     header.kid = None;
```

**File**: `crates/defguard_proxy_manager/src/tests/proxy_manager/handler/oidc.rs` (modified, +192/-5)
```diff
@@ -1,5 +1,8 @@
 #![allow(deprecated)]
-use defguard_common::db::models::settings::{Settings, update_current_settings};
+use defguard_common::db::models::{
+    User,
+    settings::{Settings, update_current_settings},
+};
 use defguard_core::{
     db::models::enrollment::Token,
     enterprise::{
@@ -21,10 +24,11 @@ use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
 use tokio::time::timeout;
 
 use super::support::{
-    assert_error_response, assert_vpn_session_exists, clear_test_license, complete_proxy_handshake,
-    create_external_mfa_network, create_oidc_provider, create_user, create_user_with_device,
-    expect_bidi_mfa_success, make_device_info, make_oidc_code, send_mfa_finish, send_mfa_start,
-    set_public_proxy_url, set_test_license_business,
+    EmailVerified, assert_error_response, assert_error_response_details, assert_vpn_session_exists,
+    clear_test_license, complete_proxy_handshake, create_external_mfa_network,
+    create_oidc_provider, create_user, create_user_with_device, expect_bidi_mfa_success,
+    make_device_info, make_oidc_code, make_oidc_code_with_email_verified, send_mfa_finish,
+    send_mfa_start, set_public_proxy_url, set_test_license_business,
 };
 use crate::tests::common::{HandlerTestContext, MockOidcProvider, RECEIVE_TIMEOUT};
 
@@ -528,6 +532,189 @@ async fn test_auth_callback_exchanges_code_for_enrollment_token(
     context.finish().await.expect_server_finished().await;
 }
 
+/// When the provider marks the email as unverified, the callback must not merge
+/// the identity into a pre-existing account: it returns `PermissionDenied` and
+/// leaves the target user's `openid_sub` unset.
+#[sqlx::test]
+async fn test_auth_callback_unverified_email_does_not_merge_into_existing_account(
+    _: PgPoolOptions,
+    options: PgConnectOptions,
+) {
+    let mut context = HandlerTestContext::new(options).await;
+    complete_proxy_handshake(&mut context).await;
+    set_test_license_business();
+
+    // Target account: pre-existing and never used OIDC, so `openid_sub` is NULL.
+    let target = create_user(&context.pool).await;
+
+    let mock = MockOidcProvider::start().await;
+    let _provider = create_oidc_provider(&context.pool, &mock).await;
+    set_public_proxy_url(&context.pool, &mock.base_url).await;
+
+    // The attacker's `sub` is unknown, the email matches the target, and the
+    // provider reports it unverified.
+    let raw_nonce = "test-nonce-unverified-email";
+    let code = make_oidc_code_with_email_verified(
+        "attacker-sub",
+        &target.email,
+        raw_nonce,
+        EmailVerified::Unverified,
+    );
+
+    context.mock_proxy().send_request(CoreRequest {
+        id: 12,
+        device_info: None,
+        payload: Some(core_request::Payload::AuthCallback(AuthCallbackRequest {
+            code,
+            nonce: raw_nonce.to_owned(),
+        })),
+    });
+
+    let response = context.mock_proxy_mut().recv_outbound().await;
+    let (status, message) = assert_error_response_details(&response);
+    assert_eq!(
+        status,
+        tonic::Code::PermissionDenied,
+        "expected PermissionDenied when the provider reports the email unverified"
+    );
+    assert!(
+        message.contains("did not verify the email address"),
+        "expected the unverified-email rejection, got: {message}"
+    );
+
+    // The target account must not be bound to the attacker's identity.
+    let target = User::find_by_email(&context.pool, &target.email)
+        .await
+        .expect("db query failed for target user")
+        .expect("target user should still exist");
+    assert!(
+        target.openid_sub.is_none(),
+        "unverified email must not set openid_sub on the existing account"
+    );
+
+    clear_test_license();
+    context.finish().await.expect_server_finished().await;
+}
+
+/// Many providers omit `email_verified` altogether, so an absent claim must stay
+/// permissive: the identity still links to the account matching its email. Pins the
+/// compatibility decision behind rejecting only an explicit `false`.
+#[sqlx::test]
+async fn test_auth_callback_absent_email_verified_claim_still_links_account(
+    _: PgPoolOptions,
+    options: PgConnectOptions,
+) {
+    let mut context = HandlerTestContext::new(options).await;
+    complete_proxy_handshake(&mut context).await;
+    set_test_license_business();
+
+    let user = create_user(&context.pool).await;
+
+    let mock = MockOidcProvider::start().await;
+    let _provider = create_oidc_provider(&context.pool, &mock).await;
+    set_public_proxy_url(&context.pool, &mock.base_url).await;
+
+    let raw_nonce = "test-nonce-absent-email-verified";
+    let code = make_oidc_code_with_email_verified(
+        "absent-claim-sub",
+        &user.email,
+        raw_nonce,
+        EmailVerified::Absent,
+    );
+
+    context.mock_proxy().send_request(CoreRequest {
+        id: 14,
+        device_info: None,
+        payload: Some(core_request::Payload::AuthCal
```

**File**: `crates/defguard_proxy_manager/src/tests/proxy_manager/handler/support.rs` (modified, +36/-3)
```diff
@@ -94,8 +94,17 @@ pub(crate) fn assert_device_config_response(response: &CoreResponse) -> &DeviceC
 /// Assert that a `CoreResponse` carries a `CoreError` payload and return the
 /// tonic status code.
 pub(crate) fn assert_error_response(response: &CoreResponse) -> Code {
+    assert_error_response_details(response).0
+}
+
+/// Assert that a `CoreResponse` carries a `CoreError` payload and return the
+/// tonic status code and message. Use when the status code alone cannot tell two
+/// rejections apart.
+pub(crate) fn assert_error_response_details(response: &CoreResponse) -> (Code, &str) {
     match &response.payload {
-        Some(core_response::Payload::CoreError(err)) => Code::from_i32(err.status_code),
+        Some(core_response::Payload::CoreError(err)) => {
+            (Code::from_i32(err.status_code), err.message.as_str())
+        }
         other => panic!(
             "expected CoreError response, got: {:?}",
             other.as_ref().map(discriminant)
@@ -764,10 +773,34 @@ pub(crate) async fn set_public_proxy_url(pool: &PgPool, url: &str) {
         .expect("failed to update public_proxy_url in settings");
 }
 
+/// The `email_verified` claim a mock ID token should carry.
+pub(crate) enum EmailVerified {
+    /// `"email_verified": true`.
+    Verified,
+    /// `"email_verified": false`.
+    Unverified,
+    /// The claim is omitted, as many providers do.
+    Absent,
+}
+
 /// Build the authorization code expected by `MockOidcProvider`'s `/token`
-/// endpoint.  Format: `"{sub}:{email}:{nonce}"`.
+/// endpoint, with the email marked as verified.
 pub(crate) fn make_oidc_code(sub: &str, email: &str, nonce: &str) -> String {
-    format!("{sub}:{email}:{nonce}")
+    make_oidc_code_with_email_verified(sub, email, nonce, EmailVerified::Verified)
+}
+
+/// Build an authorization code carrying the given `email_verified` claim.
+pub(crate) fn make_oidc_code_with_email_verified(
+    sub: &str,
+    email: &str,
+    nonce: &str,
+    email_verified: EmailVerified,
+) -> String {
+    match email_verified {
+        EmailVerified::Verified => format!("{sub}:{email}:{nonce}:true"),
+        EmailVerified::Unverified => format!("{sub}:{email}:{nonce}:false"),
+        EmailVerified::Absent => format!("{sub}:{email}:{nonce}"),
+    }
 }
 
 /// Send an `ActivateUser` request through the handler and return the raw
```

---

### Incident Patch 8: `44fa88fc` (2026-08-20)
**Commit Message**: Fix right border for devices not managed by users (#3579)

**File**: `Cargo.lock` (modified, +9/-9)
```diff
@@ -2277,7 +2277,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -5148,7 +5148,7 @@ dependencies = [
  "once_cell",
  "socket2",
  "tracing",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -5388,18 +5388,18 @@ dependencies = [
 
 [[package]]
 name = "ref-cast"
-version = "1.0.26"
+version = "1.0.27"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "216e8f773d7923bcba9ceb86a86c93cabb3903a11872fc3f138c49630e50b96d"
+checksum = "7e440fb4e4b4147295338efb76001ab9e4efc0e5839df2c47fc5ac2381d365c3"
 dependencies = [
  "ref-cast-impl",
 ]
 
 [[package]]
 name = "ref-cast-impl"
-version = "1.0.26"
+version = "1.0.27"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2c9283685feec7d69af75fb0e858d5e7378f33fe4fc699383b2916ab9273e03c"
+checksum = "92ecd8964f8453721699a1ed72037b0db49ce2f5a5138486ee89bed6f67cdf3a"
 dependencies = [
  "proc-macro2",
  "quote",
@@ -5632,7 +5632,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -6670,7 +6670,7 @@ dependencies = [
  "getrandom 0.4.3",
  "once_cell",
  "rustix",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -7754,7 +7754,7 @@ version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.48.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
```

**File**: `web/biome.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "$schema": "https://biomejs.dev/schemas/2.5.2/schema.json",
+  "$schema": "https://biomejs.dev/schemas/2.5.8/schema.json",
   "vcs": {
     "enabled": false,
     "clientKind": "git",
```

**File**: `web/package.json` (modified, +31/-31)
```diff
@@ -18,74 +18,74 @@
   },
   "dependencies": {
     "@axa-ch/react-polymorphic-types": "^1.4.2",
-    "@floating-ui/react": "^0.27.19",
-    "@inlang/paraglide-js": "^2.20.2",
+    "@floating-ui/react": "^0.27.20",
+    "@inlang/paraglide-js": "^2.24.1",
     "@react-hook/resize-observer": "^2.0.2",
     "@shortercode/webzip": "1.1.1-0",
     "@stablelib/base64": "^2.0.1",
     "@stablelib/x25519": "^2.0.1",
-    "@tanstack/react-form": "^1.33.0",
-    "@tanstack/react-query": "^5.101.2",
-    "@tanstack/react-router": "^1.170.17",
+    "@tanstack/react-form": "^1.33.5",
+    "@tanstack/react-query": "^5.101.4",
+    "@tanstack/react-router": "^1.170.29",
     "@tanstack/react-table": "^8.21.3",
     "@tanstack/react-virtual": "3.14.3",
     "@uidotdev/usehooks": "^2.4.1",
     "axios": "1.18.1",
     "byte-size": "^9.0.1",
     "clsx": "^2.1.1",
-    "dayjs": "^1.11.21",
+    "dayjs": "^1.11.22",
     "easy-file-picker": "^1.2.0",
     "humanize-duration": "^3.34.0",
-    "ipaddr.js": "^2.4.0",
+    "ipaddr.js": "^2.5.0",
     "lodash-es": "^4.18.1",
-    "motion": "^12.42.2",
+    "motion": "^12.43.0",
     "qrcode.react": "^4.2.0",
     "qs": "^6.15.3",
     "radashi": "^12.9.1",
-    "react": "^19.2.7",
-    "react-dom": "^19.2.7",
-    "react-intersection-observer": "^10.0.3",
+    "react": "^19.2.8",
+    "react-dom": "^19.2.8",
+    "react-intersection-observer": "^10.1.0",
     "react-loading-skeleton": "^3.5.0",
     "react-markdown": "^10.1.0",
-    "recharts": "^3.9.2",
+    "recharts": "^3.10.1",
     "rehype-raw": "^7.0.0",
     "rehype-sanitize": "^6.0.0",
     "rxjs": "^7.8.2",
     "text-case": "^1.2.11",
     "zod": "^4.4.3",
-    "zustand": "^5.0.14"
+    "zustand": "^5.0.15"
   },
   "devDependencies": {
-    "@biomejs/biome": "2.5.2",
+    "@biomejs/biome": "2.5.8",
     "@inlang/paraglide-js": "2.20.1",
-    "@tanstack/devtools-vite": "^0.8.1",
-    "@tanstack/react-devtools": "^0.10.8",
-    "@tanstack/react-query-devtools": "^5.101.2",
-    "@tanstack/react-router-devtools": "^1.167.0",
-    "@tanstack/router-plugin": "^1.168.19",
-    "@testing-library/jest-dom": "^6.9.1",
+    "@tanstack/devtools-vite": "^0.8.3",
+    "@tanstack/react-devtools": "^0.10.10",
+    "@tanstack/react-query-devtools": "^5.101.4",
+    "@tanstack/react-router-devtools": "^1.167.1",
+    "@tanstack/router-plugin": "^1.168.32",
+    "@testing-library/jest-dom": "^6.10.0",
     "@testing-library/react": "^16.3.2",
-    "@testing-library/user-event": "^14.6.1",
+    "@testing-library/user-event": "^14.6.4",
     "@types/byte-size": "^8.1.2",
     "@types/humanize-duration": "^3.27.4",
     "@types/lodash-es": "^4.17.12",
-    "@types/node": "^26.1.0",
+    "@types/node": "^26.2.0",
     "@types/qs": "^6.15.1",
-    "@types/react": "^19.2.17",
-    "@types/react-dom": "^19.2.3",
-    "@vitejs/plugin-react": "^6.0.3",
+    "@types/react": "^19.2.18",
+    "@types/react-dom": "^19.2.4",
+    "@vitejs/plugin-react": "^6.0.5",
     "@vitest/ui": "4.1.9",
-    "autoprefixer": "^10.5.2",
-    "globals": "^17.7.0",
+    "autoprefixer": "^10.5.4",
+    "globals": "^17.11.0",
     "jsdom": "^29.1.1",
-    "prettier": "^3.9.4",
-    "sass": "^1.101.0",
+    "prettier": "^3.9.6",
+    "sass": "^1.102.0",
     "sharp": "^0.35.3",
-    "stylelint": "^17.14.0",
+    "stylelint": "^17.14.1",
     "stylelint-config-standard-scss": "^17.0.0",
     "stylelint-scss": "^7.2.0",
     "typescript": "~6.0.3",
-    "vite": "^8.1.3",
+    "vite": "^8.2.1",
     "vite-plugin-image-optimizer": "^2.0.3",
     "vitest": "4.1.9"
   }
```

**File**: `web/src/pages/user-profile/UserProfilePage/tabs/ProfileDevicesTab/components/ProfileDevicesTable/ProfileDevicesTable.tsx` (modified, +14/-16)
```diff
@@ -270,24 +270,22 @@ const DevicesTable = ({ rowData }: { rowData: RowData[] }) => {
         header: m.profile_devices_col_connected(),
         enableSorting: false,
         minSize: 200,
-        meta: {
-          flex: !canModifyDevices,
-        },
         cell: (info) => CellWithFallback(info.getValue()),
       }),
-      ...(canModifyDevices
-        ? [
-            columnHelper.display({
-              id: 'edit',
-              header: '',
-              size: tableEditColumnSize,
-              cell: (info) => {
-                const menuItems = makeRowMenu(info.row.original);
-                return <TableEditCell menuItems={menuItems} />;
-              },
-            }),
-          ]
-        : []),
+      // Always render the trailing column; read-only viewers get a filler cell so rows
+      // reach the table edge.
+      columnHelper.display({
+        id: 'edit',
+        header: '',
+        size: tableEditColumnSize,
+        enableResizing: false,
+        cell: (info) =>
+          canModifyDevices ? (
+            <TableEditCell menuItems={makeRowMenu(info.row.original)} />
+          ) : (
+            <TableFlexCell />
+          ),
+      }),
     ],
     [canModifyDevices, makeRowMenu],
   );
```

**File**: `web/src/routeTree.gen.ts` (modified, +630/-630)
```diff
@@ -9,209 +9,222 @@
 // Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.
 
 import { Route as rootRouteImport } from './routes/__root'
-import { Route as SnackbarRouteImport } from './routes/snackbar'
-import { Route as SmtpOauthCallbackRouteImport } from './routes/smtp-oauth-callback'
-import { Route as ConsentRouteImport } from './routes/consent'
-import { Route as AuthRouteImport } from './routes/auth'
-import { Route as AuthorizedRouteImport } from './routes/_authorized'
-import { Route as R404RouteImport } from './routes/404'
 import { Route as IndexRouteImport } from './routes/index'
+import { Route as R404RouteImport } from './routes/404'
+import { Route as AuthorizedRouteImport } from './routes/_authorized'
+import { Route as AuthRouteImport } from './routes/auth'
+import { Route as ConsentRouteImport } from './routes/consent'
+import { Route as SmtpOauthCallbackRouteImport } from './routes/smtp-oauth-callback'
+import { Route as SnackbarRouteImport } from './routes/snackbar'
+import { Route as AuthorizedDefaultRouteImport } from './routes/_authorized/_default'
+import { Route as AuthorizedPlaygroundRouteImport } from './routes/_authorized/playground'
+import { Route as WizardSetupRouteImport } from './routes/_wizard/setup'
+import { Route as WizardSetupGatewayRouteImport } from './routes/_wizard/setup-gateway'
+import { Route as WizardSetupLoginRouteImport } from './routes/_wizard/setup-login'
 import { Route as AuthIndexRouteImport } from './routes/auth/index'
-import { Route as ErrorMigrationAuthRouteImport } from './routes/error/migration-auth'
-import { Route as AuthMfaRouteImport } from './routes/auth/mfa'
-import { Route as AuthLoginRouteImport } from './routes/auth/login'
-import { Route as AuthLoadingRouteImport } from './routes/auth/loading'
 import { Route as AuthCallbackRouteImport } from './routes/auth/callback'
-import { Route as WizardSetupLoginRouteImport } from './routes/_wizard/setup-login'
-import { Route as WizardSetupGatewayRouteImport } from './routes/_wizard/setup-gateway'
-import { Route as WizardSetupRouteImport } from './routes/_wizard/setup'
-import { Route as AuthorizedPlaygroundRouteImport } from './routes/_authorized/playground'
-import { Route as AuthorizedDefaultRouteImport } from './routes/_authorized/_default'
+import { Route as AuthLoadingRouteImport } from './routes/auth/loading'
+import { Route as AuthLoginRouteImport } from './routes/auth/login'
+import { Route as AuthMfaRouteImport } from './routes/auth/mfa'
+import { Route as ErrorMigrationAuthRouteImport } from './routes/error/migration-auth'
+import { Route as AuthorizedDefaultActivityRouteImport } from './routes/_authorized/_default/activity'
+import { Route as AuthorizedDefaultEdgesRouteImport } from './routes/_authorized/_default/edges'
+import { Route as AuthorizedDefaultEnrollmentRouteImport } from './routes/_authorized/_default/enrollment'
+import { Route as AuthorizedDefaultGroupsRouteImport } from './routes/_authorized/_default/groups'
+import { Route as AuthorizedDefaultNetworkDevicesRouteImport } from './routes/_authorized/_default/network-devices'
+import { Route as AuthorizedDefaultOpenidRouteImport } from './routes/_authorized/_default/openid'
+import { Route as AuthorizedDefaultSupportRouteImport } from './routes/_authorized/_default/support'
+import { Route as AuthorizedDefaultUsersRouteImport } from './routes/_authorized/_default/users'
+import { Route as AuthorizedDefaultWebhooksRouteImport } from './routes/_authorized/_default/webhooks'
+import { Route as AuthorizedWizardAddExternalOpenidRouteImport } from './routes/_authorized/_wizard/add-external-openid'
+import { Route as AuthorizedWizardAddLocationRouteImport } from './routes/_authorized/_wizard/add-location'
+import { Route as AuthorizedWizardAddPostureCheckRouteImport } from './routes/_authorized/_wizard/add-posture-check'
+import { Route as AuthorizedWizardSettingsCoreCertificateRouteImport } from './routes/_authorized/_wizard/settings-core-certificate'
+import { Route as AuthorizedWizardSettingsEdgeCertificateRouteImport } from './routes/_authorized/_wizard/settings-edge-certificate'
+import { Route as AuthorizedWizardSetupEdgeRouteImport } from './routes/_authorized/_wizard/setup-edge'
 import { Route as WizardMigrationIndexRouteImport } from './routes/_wizard/migration/index'
-import { Route as AuthMfaWebauthnRouteImport } from './routes/auth/mfa/webauthn'
-import { Route as AuthMfaTotpRouteImport } from './routes/auth/mfa/totp'
-import { Route as AuthMfaRecoveryRouteImport } from './routes/auth/mfa/recovery'
-import { Route as AuthMfaEmailRouteImport } from './routes/auth/mfa/email'
 import { Route as WizardMigrationLocationsRouteImport } from './routes/_wizard/migration/locations'
-import { Route as AuthorizedWizardSetupEdgeRouteImport } from './routes/_authorized/_wizard/setup-edge'
-import { Route as AuthorizedWizardSettingsEdgeCertificateRouteImpor
```

**File**: `web/tests/video-tutorials.test.ts` (modified, +11/-20)
```diff
@@ -998,27 +998,18 @@ describe('parseVideoTutorials', () => {
 
     const result = parseVideoTutorials(raw);
 
+    const placement = result['2.2'].placements?.migrationWizard as Record<
+      string,
+      unknown
+    >;
+    const content = result['2.2'].placements?.migrationWizard?.default;
+    const video = content?.video as Record<string, unknown>;
+    const docs = content?.docs?.[0] as Record<string, unknown>;
+
     expect((result['2.2'] as Record<string, unknown>).extraVersionField).toBeUndefined();
-    expect(
-      (result['2.2'].placements?.migrationWizard as Record<string, unknown>)
-        .extraPlacementField,
-    ).toBeUndefined();
-    expect(
-      (
-        result['2.2'].placements?.migrationWizard?.default?.video as Record<
-          string,
-          unknown
-        >
-      ).ignoredVideoField,
-    ).toBeUndefined();
-    expect(
-      (
-        result['2.2'].placements?.migrationWizard?.default?.docs?.[0] as Record<
-          string,
-          unknown
-        >
-      ).ignoredDocsField,
-    ).toBeUndefined();
+    expect(placement.extraPlacementField).toBeUndefined();
+    expect(video.ignoredVideoField).toBeUndefined();
+    expect(docs.ignoredDocsField).toBeUndefined();
   });
 
   it('should reject an empty placement docsTitle', () => {
```

---

### Incident Patch 9: `8f02382e` (2026-08-19)
**Commit Message**: fix google service file upload form (#3578)

**File**: `web/messages/en/openid.json` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@
   "settings_openid_provider_helper_admin_email": "",
   "settings_openid_provider_google_service_account_key_title": "Service account key",
   "settings_openid_provider_google_service_account_key_content": "Upload a new service account key file to set the service account used for synchronization. NOTE: The uploaded file won't be visible after saving the settings and reloading the page because its contents are sensitive and are never sent back to the dashboard.",
+  "settings_openid_provider_google_service_account_key_configured_content": "A service account key is configured. Upload a new key file to replace it.",
+  "settings_openid_provider_google_service_account_key_replace": "Replace service account key",
   "settings_openid_provider_label_sync_only_matching_groups": "Sync only matching memberships",
   "settings_openid_provider_helper_microsoft_group_match": "Groups Defguard should sync memberships for. Leave it empty to sync every group. If you fill it in, only those groups are kept and the rest are ignored. This only affects how group memberships are mapped, not who gets an account. Separate group names with commas.",
   "settings_openid_provider_prefetch_users": "Import users from your Microsoft directory to Defguard",
```

**File**: `web/src/pages/settings/SettingsEditOpenIdProviderPage/form/EditGoogleProviderForm.tsx` (modified, +61/-35)
```diff
@@ -40,30 +40,31 @@ const discriminatedSchema = z.discriminatedUnion('directory_sync_enabled', [
   syncSchema,
 ]);
 
-const validationSchema = syncSchema
-  .omit({ admin_email: true, google_service_account_file: true })
-  .extend({
-    admin_email: z.string().trim(),
-    google_service_account_file: z.file(m.form_error_required()).nullable(),
-  })
-  .superRefine((val, ctx) => {
-    if (val.directory_sync_enabled) {
-      if (val.admin_email.trim().length === 0) {
-        ctx.addIssue({
-          path: ['admin_email'],
-          code: 'custom',
-          message: m.form_error_required(),
-        });
-      }
-      if (val.google_service_account_file === null) {
-        ctx.addIssue({
-          path: ['google_service_account_file'],
-          code: 'custom',
-          message: m.form_error_required(),
-        });
+const makeValidationSchema = (hasServiceAccountKey: boolean) =>
+  syncSchema
+    .omit({ admin_email: true, google_service_account_file: true })
+    .extend({
+      admin_email: z.string().trim(),
+      google_service_account_file: z.file(m.form_error_required()).nullable(),
+    })
+    .superRefine((val, ctx) => {
+      if (val.directory_sync_enabled) {
+        if (val.admin_email.trim().length === 0) {
+          ctx.addIssue({
+            path: ['admin_email'],
+            code: 'custom',
+            message: m.form_error_required(),
+          });
+        }
+        if (!hasServiceAccountKey && val.google_service_account_file === null) {
+          ctx.addIssue({
+            path: ['google_service_account_file'],
+            code: 'custom',
+            message: m.form_error_required(),
+          });
+        }
       }
-    }
-  });
+    });
 
 type FormFields = z.infer<typeof discriminatedSchema>;
 
@@ -99,6 +100,12 @@ export const EditGoogleProviderForm = ({
     };
   }, [provider]);
 
+  const hasServiceAccountKey = Boolean(provider.google_service_account_email);
+  const validationSchema = useMemo(
+    () => makeValidationSchema(hasServiceAccountKey),
+    [hasServiceAccountKey],
+  );
+
   const form = useAppForm({
     defaultValues,
     validationLogic: formChangeLogic,
@@ -109,17 +116,24 @@ export const EditGoogleProviderForm = ({
     onSubmit: async ({ value }) => {
       if (value.directory_sync_enabled) {
         const inner = value as z.infer<typeof syncSchema>;
-        const file = await parseGoogleKeyFile(inner.google_service_account_file as File);
-        if (!file) {
-          Snackbar.error(m.form_error_file_contents());
-          return;
+        if (inner.google_service_account_file) {
+          const file = await parseGoogleKeyFile(inner.google_service_account_file);
+          if (!file) {
+            Snackbar.error(m.form_error_file_contents());
+            return;
+          }
+          await onSubmit({
+            ...omit(inner, ['google_service_account_file']),
+            google_service_account_email: file.client_email,
+            google_service_account_key: file.private_key,
+            directory_sync_user_groups: inner.directory_sync_user_groups ?? '',
+          });
+        } else {
+          await onSubmit({
+            ...omit(inner, ['google_service_account_file']),
+            directory_sync_user_groups: inner.directory_sync_user_groups ?? '',
+          });
         }
-        await onSubmit({
-          ...omit(inner, ['google_service_account_file']),
-          google_service_account_email: file.client_email,
-          google_service_account_key: file.private_key,
-          directory_sync_user_groups: inner.directory_sync_user_groups ?? '',
-        });
       } else {
         await onSubmit(omit(value, ['google_service_account_file']));
       }
@@ -272,11 +286,23 @@ export const EditGoogleProviderForm = ({
                 <DescriptionBlock
                   title={m.settings_openid_provider_google_service_account_key_title()}
                 >
-                  <p>{m.settings_openid_provider_google_service_account_key_content()}</p>
+                  <p>
+                    {hasServiceAccountKey
+                      ? m.settings_openid_provider_google_service_account_key_configured_content()
+                      : m.settings_openid_provider_google_service_account_key_content()}
+                  </p>
                 </DescriptionBlock>
                 <SizedBox height={ThemeSpacing.Xl} />
                 <form.AppField name="google_service_account_file">
-                  {(field) => <field.FormUploadField />}
+                  {(field) => (
+                    <field.FormUploadField
+                      title={
+                        hasServiceAccountKey
+                          ? m.settings_openid_provider_google_service_account_key_replace()
+                          : undefined
+                      }
+                    />
+                  )}
                 </form.AppField>
               </Fold>
             )}
```

---

### Incident Patch 10: `052595d1` (2026-08-18)
**Commit Message**: misc pre-2.1 bugfixes (#3561)

* fix potential race in proxy test

* display non-default values in enrollment email

* update UI submodule

* fix provider edit endpoint

* fix sending gw disconnect notifications

* address review feedback

**File**: `.sqlx/query-8b80c6e818d3ff25ad609bd592a260a580f6f549f696f9d639093c8105d76d25.json` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+{
+  "db_name": "PostgreSQL",
+  "query": "UPDATE settings SET enrollment_token_timeout_hours = $1, enrollment_session_timeout_minutes = $2",
+  "describe": {
+    "columns": [],
+    "parameters": {
+      "Left": [
+        "Int4",
+        "Int4"
+      ]
+    },
+    "nullable": []
+  },
+  "hash": "8b80c6e818d3ff25ad609bd592a260a580f6f549f696f9d639093c8105d76d25"
+}
```

**File**: `crates/defguard_core/src/db/models/enrollment.rs` (modified, +9/-0)
```diff
@@ -1,3 +1,5 @@
+use std::time::Duration;
+
 use chrono::{NaiveDateTime, TimeDelta, Utc};
 use defguard_common::{
     VERSION,
@@ -111,6 +113,13 @@ impl Token {
         }
     }
 
+    /// Duration for which the token is valid, i.e. `expires_at - created_at`, clamped to zero.
+    #[must_use]
+    pub fn validity_duration(&self) -> Duration {
+        let seconds = (self.expires_at - self.created_at).num_seconds().max(0);
+        Duration::from_secs(u64::try_from(seconds).unwrap_or_default())
+    }
+
     pub async fn save<'e, E>(&self, executor: E) -> Result<(), TokenError>
     where
         E: PgExecutor<'e>,
```

**File**: `crates/defguard_core/src/enrollment_management.rs` (modified, +2/-0)
```diff
@@ -61,6 +61,7 @@ pub async fn start_user_enrollment(
             base_message_context,
             enrollment_service_url,
             &enrollment.id,
+            enrollment.validity_duration(),
         )
         .await;
         match result {
@@ -200,6 +201,7 @@ pub async fn send_enrollment_invitation(
         base_message_context,
         enrollment_service_url,
         token_id,
+        token.validity_duration(),
     )
     .await
     {
```

**File**: `crates/defguard_core/src/enterprise/handlers/openid_providers.rs` (modified, +1/-0)
```diff
@@ -456,6 +456,7 @@ pub(crate) async fn modify_openid_provider(
         provider.directory_sync_group_match = group_match;
         provider.jumpcloud_api_key = provider_data.jumpcloud_api_key;
         provider.prefetch_users = provider_data.prefetch_users;
+        provider.disable_password_management = provider_data.disable_password_management;
         provider.directory_sync_user_groups = user_groups;
         provider.save(&mut *transaction).await?;
         transaction.commit().await?;
```

**File**: `crates/defguard_core/src/mail/mod.rs` (modified, +7/-0)
```diff
@@ -152,6 +152,13 @@ impl Mail {
         &self.subject
     }
 
+    /// Getter for the plain text body. Used by tests to assert rendered content.
+    #[cfg(test)]
+    #[must_use]
+    pub(crate) fn text(&self) -> &str {
+        &self.text
+    }
+
     /// Add to context.
     pub fn add_to_context<K, V>(&mut self, key: K, value: &V)
     where
```

**File**: `crates/defguard_core/src/mail/templates.rs` (modified, +118/-4)
```diff
@@ -15,7 +15,7 @@ use tera::{Context, Function, Tera};
 use thiserror::Error;
 use tracing::{debug, warn};
 
-use super::{Attachment, MailError, MailMessage};
+use super::{Attachment, Mail, MailError, MailMessage};
 
 pub(crate) const DEFAULT_LANG: &str = "en_US";
 
@@ -139,14 +139,43 @@ pub async fn user_import_blocked_mail(
     Ok(())
 }
 
+/// Placeholders substituted into the admin-configurable `token_info` mail text with the
+/// configured enrollment timeouts.
+const TOKEN_TIMEOUT_PLACEHOLDER: &str = "{{ token_timeout }}";
+const SESSION_TIMEOUT_PLACEHOLDER: &str = "{{ session_timeout }}";
+
 // Mail with link to enrollment service.
 pub async fn new_account_mail(
     to: &str,
     conn: &mut PgConnection,
     context: Context,
-    mut enrollment_service_url: Url,
+    enrollment_service_url: Url,
     enrollment_token: &str,
+    token_timeout: Duration,
 ) -> Result<(), TemplateError> {
+    build_new_account_mail(
+        to,
+        conn,
+        context,
+        enrollment_service_url,
+        enrollment_token,
+        token_timeout,
+    )
+    .await?
+    .send_and_forget();
+    Ok(())
+}
+
+/// Build (but do not send) the enrollment start mail. Extracted so tests can assert the
+/// rendered content without requiring an SMTP server.
+pub(crate) async fn build_new_account_mail(
+    to: &str,
+    conn: &mut PgConnection,
+    context: Context,
+    mut enrollment_service_url: Url,
+    enrollment_token: &str,
+    token_timeout: Duration,
+) -> Result<Mail, TemplateError> {
     debug!("Render an enrollment start mail template for the user.");
     let (mut tera, mut context) = get_base_tera_mjml(context, None, None, None)?;
 
@@ -166,9 +195,54 @@ pub async fn new_account_mail(
 
     let message = MailMessage::NewAccount;
     message.fill_context(conn, &mut context).await?;
-    message.mail(&mut tera, &context, to)?.send_and_forget();
 
-    Ok(())
+    // The token timeout is per-enrollment (passed in), while the session timeout is a global
+    // setting read here so the email reflects the configured value.
+    let session_timeout = Settings::get_current_settings().enrollment_session_timeout();
+
+    // Render the effective token/session timeouts into the admin-configurable `token_info` text.
+    if let Some(Value::String(token_info)) = context.get("token_info").cloned() {
+        if !token_info.contains(TOKEN_TIMEOUT_PLACEHOLDER)
+            || !token_info.contains(SESSION_TIMEOUT_PLACEHOLDER)
+        {
+            warn!(
+                "mail_context 'new-account' token_info is missing the timeout placeholders; \
+                the configured enrollment timeouts will not be shown"
+            );
+        }
+        let rendered = token_info
+            .replace(TOKEN_TIMEOUT_PLACEHOLDER, &format_timeout(token_timeout))
+            .replace(
+                SESSION_TIMEOUT_PLACEHOLDER,
+                &format_timeout(session_timeout),
+            );
+        context.insert("token_info", &rendered);
+    }
+
+    message.mail(&mut tera, &context, to)
+}
+
+/// Format a timeout duration as a short human-readable string, e.g. "1 week", "1 day",
+/// "24 hours", or "30 minutes".
+fn format_timeout(duration: Duration) -> String {
+    let secs = duration.as_secs();
+    let minute = 60;
+    let hour = 60 * minute;
+    let day = 24 * hour;
+    let week = 7 * day;
+
+    let (value, unit) = if secs >= week && secs.is_multiple_of(week) {
+        (secs / week, "week")
+    } else if secs >= day && secs.is_multiple_of(day) {
+        (secs / day, "day")
+    } else if secs >= hour && secs.is_multiple_of(hour) {
+        (secs / hour, "hour")
+    } else if secs >= minute && secs.is_multiple_of(minute) {
+        (secs / minute, "minute")
+    } else {
+        (secs, "second")
+    };
+    format!("{value} {unit}{}", if value == 1 { "" } else { "s" })
 }
 
 // Mail with link to enrollment service.
@@ -687,3 +761,43 @@ pub async fn certificate_expired_mail(
 
     Ok(())
 }
+
+#[cfg(test)]
+mod tests {
+    use std::time::Duration;
+
+    use super::format_timeout;
+
+    #[test]
+    fn test_formats_weeks() {
+        assert_eq!(format_timeout(Duration::from_secs(7 * 24 * 3600)), "1 week");
+        assert_eq!(
+            format_timeout(Duration::from_secs(14 * 24 * 3600)),
+            "2 weeks"
+        );
+    }
+
+    #[test]
+    fn test_formats_days() {
+        assert_eq!(format_timeout(Duration::from_secs(24 * 3600)), "1 day");
+        assert_eq!(format_timeout(Duration::from_secs(2 * 24 * 3600)), "2 days");
+    }
+
+    #[test]
+    fn test_formats_hours() {
+        assert_eq!(format_timeout(Duration::from_secs(3600)), "1 hour");
+        assert_eq!(format_timeout(Duration::from_secs(23 * 3600)), "23 hours");
+    }
+
+    #[test]
+    fn test_formats_minutes() {
+        assert_eq!(format_timeout(Duration::from_secs(60)), "1 minute");
+        assert_eq!(format_timeout(Duration::from_secs(30 * 60)), "30 minutes");
+    }
+
+    #[test]
+    fn test_
```

**File**: `crates/defguard_core/src/mail/tests.rs` (modified, +61/-0)
```diff
@@ -33,6 +33,66 @@ fn dg25_8_server_side_template_injection() {
     assert!(tera.render("text", &Context::new()).is_err());
 }
 
+/// Override the enrollment token/session timeouts and reload the global settings.
+async fn set_enrollment_timeouts(pool: &PgPool, token_hours: i32, session_minutes: i32) {
+    sqlx::query!(
+        "UPDATE settings \
+         SET enrollment_token_timeout_hours = $1, \
+             enrollment_session_timeout_minutes = $2",
+        token_hours,
+        session_minutes,
+    )
+    .execute(pool)
+    .await
+    .unwrap();
+
+    initialize_current_settings(pool).await.unwrap();
+}
+
+/// Regression test for https://github.com/DefGuard/defguard/issues/3518
+///
+/// The enrollment email must reflect the configured enrollment token and session timeouts
+/// instead of the hardcoded defaults ("24 hours" / "10 minutes").
+#[sqlx::test]
+async fn test_enrollment_email_reflects_configured_timeouts(
+    _: PgPoolOptions,
+    options: PgConnectOptions,
+) {
+    let pool = setup_pool(options).await;
+    initialize_current_settings(&pool).await.unwrap();
+
+    // Configure non-default timeouts: token valid for 1 week, session for 30 minutes.
+    // `build_new_account_mail` reads the session timeout from the global settings set here,
+    // while the token timeout is per-enrollment and passed explicitly.
+    set_enrollment_timeouts(&pool, 168, 30).await;
+
+    let mut conn = pool.begin().await.unwrap();
+    let url = Url::parse("http://localhost:8001").unwrap();
+    let context = Context::new();
+    let token = "zXc6N1ndXpWFeyBuogiFp1bD1UomAbZc";
+
+    let mail = templates::build_new_account_mail(
+        "user@example.com",
+        &mut conn,
+        context,
+        url,
+        token,
+        Duration::from_secs(168 * 3600),
+    )
+    .await
+    .unwrap();
+
+    let text = mail.text();
+    assert!(
+        text.contains("1 week"),
+        "enrollment email should show the configured token timeout, got: {text}"
+    );
+    assert!(
+        text.contains("30 minutes"),
+        "enrollment email should show the configured session timeout, got: {text}"
+    );
+}
+
 /// Delay, so send_and_forget() can process the message.
 async fn delay() {
     sleep(Duration::from_secs(2)).await;
@@ -163,6 +223,7 @@ fn send_new_account(_: PgPoolOptions, options: PgConnectOptions) {
         context,
         url,
         token,
+        Duration::from_secs(24 * 3600),
     )
     .await
     .unwrap();
```

**File**: `crates/defguard_core/tests/integration/api/openid_login.rs` (modified, +76/-0)
```diff
@@ -25,6 +25,16 @@ struct UrlResponse {
     url: String,
 }
 
+#[derive(Deserialize)]
+struct CurrentProviderResponse {
+    provider: CurrentProvider,
+}
+
+#[derive(Deserialize)]
+struct CurrentProvider {
+    disable_password_management: bool,
+}
+
 #[sqlx::test]
 async fn test_openid_providers(_: PgPoolOptions, options: PgConnectOptions) {
     let pool = setup_pool(options).await;
@@ -110,6 +120,72 @@ async fn test_openid_providers(_: PgPoolOptions, options: PgConnectOptions) {
     assert_eq!(response.status(), StatusCode::FORBIDDEN);
 }
 
+#[sqlx::test]
+async fn test_modify_openid_provider_persists_disable_password_management(
+    _: PgPoolOptions,
+    options: PgConnectOptions,
+) {
+    let pool = setup_pool(options).await;
+    let client = make_client(pool).await;
+
+    let auth = Auth::new("admin", "pass123");
+    let response = client.post("/api/v1/auth").json(&auth).send().await;
+    assert_eq!(response.status(), StatusCode::OK);
+
+    exceed_enterprise_limits(&client).await;
+
+    let mut provider_data = AddProviderData {
+        name: "test".to_owned(),
+        base_url: "https://accounts.google.com".to_owned(),
+        kind: OpenIdProviderKind::Google,
+        client_id: "client_id".to_owned(),
+        client_secret: "client_secret".to_owned(),
+        display_name: Some("display_name".to_owned()),
+        admin_email: None,
+        google_service_account_email: None,
+        google_service_account_key: None,
+        directory_sync_enabled: false,
+        directory_sync_interval: 100,
+        directory_sync_user_behavior: DirectorySyncUserBehavior::Keep.to_string(),
+        directory_sync_admin_behavior: DirectorySyncUserBehavior::Keep.to_string(),
+        directory_sync_target: DirectorySyncTarget::All.to_string(),
+        create_account: false,
+        okta_dirsync_client_id: None,
+        okta_private_jwk: None,
+        directory_sync_group_match: None,
+        username_handling: OpenIdUsernameHandling::PruneEmailDomain,
+        jumpcloud_api_key: None,
+        prefetch_users: false,
+        disable_password_management: false,
+        directory_sync_user_groups: None,
+    };
+
+    let response = client
+        .post("/api/v1/openid/provider")
+        .json(&provider_data)
+        .send()
+        .await;
+    assert_eq!(response.status(), StatusCode::CREATED);
+
+    // Toggle the flag and update the provider via PUT.
+    provider_data.disable_password_management = true;
+    let response = client
+        .put("/api/v1/openid/provider/test")
+        .json(&provider_data)
+        .send()
+        .await;
+    assert_eq!(response.status(), StatusCode::OK);
+
+    // Read back the current provider and assert the flag was persisted.
+    let response = client.get("/api/v1/openid/provider/current").send().await;
+    assert_eq!(response.status(), StatusCode::OK);
+    let body: CurrentProviderResponse = response.json().await;
+    assert!(
+        body.provider.disable_password_management,
+        "disable_password_management should be persisted as true after update"
+    );
+}
+
 // FIXME: this test sometimes fails because of test_openid_providers.
 // The license state is possibly preserved between those two. This requires further research.
 #[sqlx::test]
```

---

### Incident Patch 11: `a85978bb` (2026-08-17)
**Commit Message**: Fix LDAP synchronization interval form (#3569)

**File**: `web/src/pages/settings/SettingsLdapPage/SettingsLdapPage.tsx` (modified, +44/-32)
```diff
@@ -94,38 +94,50 @@ export const SettingsLdapPage = () => {
   );
 };
 
-const formSchema = z.object({
-  ldap_bind_password: z.string().trim().min(1, m.form_error_required()),
-  ldap_bind_username: z.string().trim().min(1, m.form_error_required()),
-  ldap_url: z.url(m.form_error_invalid()).min(1, m.form_error_required()),
-  ldap_group_member_attr: z.string().trim().min(1, m.form_error_required()),
-  ldap_group_obj_class: z.string().trim().min(1, m.form_error_required()),
-  ldap_group_search_base: z.string().trim().min(1, m.form_error_required()),
-  ldap_groupname_attr: z.string().trim().min(1, m.form_error_required()),
-  ldap_member_attr: z.string().trim().min(1, m.form_error_required()),
-  ldap_user_obj_class: z.string().trim().min(1, m.form_error_required()),
-  ldap_user_auxiliary_obj_classes: z.string().trim().nullable(),
-  ldap_user_search_base: z.string().trim().min(1, m.form_error_required()),
-  ldap_username_attr: z.string().trim().min(1, m.form_error_required()),
-  ldap_enabled: z.boolean(),
-  ldap_sync_enabled: z.boolean(),
-  ldap_is_authoritative: z.boolean(),
-  ldap_use_starttls: z.boolean(),
-  ldap_tls_verify_cert: z.boolean(),
-  ldap_sync_interval: z.number().min(
-    10,
-    m.form_error_min({
-      value: 10,
-    }),
-  ),
-  ldap_uses_ad: z.boolean(),
-  ldap_sync_account_status: z.boolean(),
-  ldap_disable_password_management: z.boolean(),
-  ldap_user_rdn_attr: z.string().trim().nullable(),
-  ldap_sync_groups: z.string().trim().nullable(),
-  ldap_remote_enrollment_enabled: z.boolean(),
-  ldap_remote_enrollment_send_invite: z.boolean(),
-});
+const ldap_minimum_sync_interval = 10;
+
+const formSchema = z
+  .object({
+    ldap_bind_password: z.string().trim().min(1, m.form_error_required()),
+    ldap_bind_username: z.string().trim().min(1, m.form_error_required()),
+    ldap_url: z.url(m.form_error_invalid()).min(1, m.form_error_required()),
+    ldap_group_member_attr: z.string().trim().min(1, m.form_error_required()),
+    ldap_group_obj_class: z.string().trim().min(1, m.form_error_required()),
+    ldap_group_search_base: z.string().trim().min(1, m.form_error_required()),
+    ldap_groupname_attr: z.string().trim().min(1, m.form_error_required()),
+    ldap_member_attr: z.string().trim().min(1, m.form_error_required()),
+    ldap_user_obj_class: z.string().trim().min(1, m.form_error_required()),
+    ldap_user_auxiliary_obj_classes: z.string().trim().nullable(),
+    ldap_user_search_base: z.string().trim().min(1, m.form_error_required()),
+    ldap_username_attr: z.string().trim().min(1, m.form_error_required()),
+    ldap_enabled: z.boolean(),
+    ldap_sync_enabled: z.boolean(),
+    ldap_is_authoritative: z.boolean(),
+    ldap_use_starttls: z.boolean(),
+    ldap_tls_verify_cert: z.boolean(),
+    ldap_sync_interval: z.number(m.form_error_required()),
+    ldap_uses_ad: z.boolean(),
+    ldap_sync_account_status: z.boolean(),
+    ldap_disable_password_management: z.boolean(),
+    ldap_user_rdn_attr: z.string().trim().nullable(),
+    ldap_sync_groups: z.string().trim().nullable(),
+    ldap_remote_enrollment_enabled: z.boolean(),
+    ldap_remote_enrollment_send_invite: z.boolean(),
+  })
+  .superRefine((value, context) => {
+    if (
+      value.ldap_sync_enabled &&
+      value.ldap_sync_interval < ldap_minimum_sync_interval
+    ) {
+      context.addIssue({
+        code: 'custom',
+        path: ['ldap_sync_interval'],
+        message: m.form_error_min({
+          value: ldap_minimum_sync_interval,
+        }),
+      });
+    }
+  });
 
 type FormFields = z.infer<typeof formSchema>;
 
```

---

### Incident Patch 12: `f0241404` (2026-08-17)
**Commit Message**: Fix phone number field (#3566)

**File**: `web/src/pages/UsersOverviewPage/modals/AddUserModal/AddUserModal.tsx` (modified, +1/-0)
```diff
@@ -464,6 +464,7 @@ const AddUserModalForm = () => {
             {(field) => (
               <field.FormInput
                 data-testid="field-phone"
+                notNull
                 label={m.form_label_phone()}
                 helper={m.form_helper_phone()}
               />
```

**File**: `web/src/pages/UsersOverviewPage/modals/EditUserModal/EditUserModal.tsx` (modified, +33/-13)
```diff
@@ -22,7 +22,10 @@ import {
 } from '../../../../shared/hooks/modalControls/modalsSubjects';
 import { ModalName } from '../../../../shared/hooks/modalControls/modalTypes';
 import type { OpenEditUserModal } from '../../../../shared/hooks/modalControls/types';
-import { patternSafeUsernameCharacters } from '../../../../shared/patterns';
+import {
+  patternSafeUsernameCharacters,
+  patternValidPhoneNumber,
+} from '../../../../shared/patterns';
 import { removeEmptyStrings } from '../../../../shared/utils/removeEmptyStrings';
 
 const modalName = ModalName.EditUserModal;
@@ -73,18 +76,34 @@ const ModalContent = ({ user }: ModalData) => {
 
   const formSchema = useMemo(
     () =>
-      z.object({
-        username: z
-          .string()
-          .trim()
-          .min(1, m.form_error_required())
-          .max(64, m.form_error_max_len({ length: 64 }))
-          .regex(patternSafeUsernameCharacters, m.form_error_forbidden_char()),
-        email: z.email().trim().min(1, m.form_error_required()),
-        last_name: z.string().trim().min(1, m.form_error_required()),
-        first_name: z.string().trim().min(1, m.form_error_required()),
-        phone: z.string().trim(),
-      }),
+      z
+        .object({
+          username: z
+            .string()
+            .trim()
+            .min(1, m.form_error_required())
+            .max(64, m.form_error_max_len({ length: 64 }))
+            .regex(patternSafeUsernameCharacters, m.form_error_forbidden_char()),
+          email: z.email().trim().min(1, m.form_error_required()),
+          last_name: z.string().trim().min(1, m.form_error_required()),
+          first_name: z.string().trim().min(1, m.form_error_required()),
+          phone: z.string().trim(),
+        })
+        .superRefine((val, ctx) => {
+          if (val.phone?.length) {
+            const phoneRes = z
+              .string()
+              .regex(patternValidPhoneNumber)
+              .safeParse(val.phone);
+            if (!phoneRes.success) {
+              ctx.addIssue({
+                code: 'custom',
+                path: ['phone'],
+                message: m.form_error_invalid(),
+              });
+            }
+          }
+        }),
     [],
   );
 
@@ -207,6 +226,7 @@ const ModalContent = ({ user }: ModalData) => {
           <form.AppField name="phone">
             {(field) => (
               <field.FormInput
+                notNull
                 label={m.form_label_phone()}
                 helper={m.form_helper_phone()}
               />
```

---

### Incident Patch 13: `2e3d3113` (2026-08-17)
**Commit Message**: fix location layout in rules (#3562)

**File**: `web/src/pages/CERulePage/style.scss` (modified, +4/-2)
```diff
@@ -83,10 +83,12 @@
   }
 }
 
-.selection-section .item .destination-selection-item {
+.selection-section .item .destination-selection-item,
+.selection-section .item .location-selection-item {
   display: grid;
-  grid-template-columns: auto 1fr;
+  grid-template-columns: auto 1fr auto;
   grid-template-rows: 1fr;
+  align-items: center;
   column-gap: var(--spacing-md);
   width: 100%;
   overflow: hidden;
```

---

### Incident Patch 14: `fc034ccc` (2026-08-07)
**Commit Message**: Fix logging in overwriting user groups when directory sync is enabled (#3519)

* fix group overwrite

* format

* more tests

**File**: `crates/defguard_core/src/enterprise/directory_sync/mod.rs` (modified, +10/-0)
```diff
@@ -479,6 +479,16 @@ pub async fn sync_user_groups_if_configured(
         debug!("Directory sync is disabled, skipping syncing user groups");
         return Ok(());
     }
+    if !matches!(
+        provider.directory_sync_target,
+        DirectorySyncTarget::All | DirectorySyncTarget::Groups
+    ) {
+        debug!(
+            "Directory sync target is set to {}, skipping syncing user groups",
+            provider.directory_sync_target
+        );
+        return Ok(());
+    }
 
     match DirectorySyncClient::build(pool).await {
         Ok(mut dir_sync) => {
```

**File**: `crates/defguard_core/src/enterprise/directory_sync/tests.rs` (modified, +32/-0)
```diff
@@ -650,6 +650,38 @@ mod test {
         assert_eq!(user_groups[0].id, group.id);
     }
 
+    // Logging in through OIDC used to sync the user's groups regardless of the configured sync
+    // target, overwriting locally managed group assignments when the target was set to users only.
+    #[sqlx::test]
+    async fn test_sync_user_groups_target_users(_: PgPoolOptions, options: PgConnectOptions) {
+        let pool = setup_pool(options).await;
+
+        let config = DefGuardConfig::new_test_config();
+        let _ = SERVER_CONFIG.set(config.clone());
+        let (gateway_tx, _) = broadcast::channel::<GatewayCommand>(16);
+        make_test_provider(
+            &pool,
+            DirectorySyncUserBehavior::Delete,
+            DirectorySyncUserBehavior::Delete,
+            DirectorySyncTarget::Users,
+            false,
+        )
+        .await;
+        let user = make_test_user_and_device("testuser", &pool).await;
+        let local_group = Group::new("localgroup").save(&pool).await.unwrap();
+        user.add_to_group(&pool, &local_group).await.unwrap();
+        let (ldap_tx, _ldap_rx) = mpsc::unbounded_channel::<LdapSyncEventType>();
+        let (dirsync_tx, _dirsync_rx) = dirsync_test_channel();
+
+        sync_user_groups_if_configured(&user, &pool, &gateway_tx, &ldap_tx, &dirsync_tx)
+            .await
+            .unwrap();
+
+        let user_groups = user.member_of(&pool).await.unwrap();
+        assert_eq!(user_groups.len(), 1);
+        assert_eq!(user_groups[0].id, local_group.id);
+    }
+
     #[sqlx::test]
     async fn test_sync_target_users(_: PgPoolOptions, options: PgConnectOptions) {
         let pool = setup_pool(options).await;
```

**File**: `crates/defguard_core/src/enterprise/handlers/openid_login.rs` (modified, +253/-0)
```diff
@@ -807,9 +807,45 @@ pub async fn auth_callback(
 
 #[cfg(test)]
 mod test {
+    use std::{
+        net::Ipv4Addr,
+        sync::{Arc, Mutex, RwLock, atomic::AtomicBool},
+    };
+
+    use axum::http::HeaderMap;
+    use axum_extra::extract::cookie::Key;
+    use chrono::Utc;
+    use defguard_common::{
+        config::{DefGuardConfig, SERVER_CONFIG},
+        db::{
+            models::{group::Group, settings::initialize_current_settings},
+            setup_pool,
+        },
+    };
+    use openidconnect::{
+        AccessToken, Audience, AuthUrl, EmptyAdditionalClaims, EmptyAdditionalProviderMetadata,
+        EmptyExtraTokenFields, EndUserEmail, JsonWebKeySetUrl, PrivateSigningKey, ResponseTypes,
+        StandardClaims, SubjectIdentifier, TokenUrl,
+        core::{
+            CoreIdToken, CoreIdTokenClaims, CoreIdTokenFields, CoreJsonWebKeySet,
+            CoreJwsSigningAlgorithm, CoreResponseType, CoreSubjectIdentifierType,
+            CoreTokenResponse, CoreTokenType,
+        },
+    };
+    use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
+    use tokio::sync::{broadcast, mpsc};
+    use wiremock::{
+        Mock, MockServer, ResponseTemplate,
+        matchers::{method, path},
+    };
+
     use super::*;
     use crate::{
+        auth::failed_login::FailedLoginMap,
         enterprise::{
+            db::models::openid_provider::{
+                DirectorySyncTarget, DirectorySyncUserBehavior, OpenIdProviderKind,
+            },
             license::{License, LicenseTier, SupportType, set_cached_license},
             limits::{Counts, set_counts},
         },
@@ -996,4 +1032,221 @@ mod test {
 
         assert_eq!(reached_user_license_limit(), None);
     }
+
+    const TEST_CLIENT_ID: &str = "client_id";
+    const TEST_NONCE: &str = "test_nonce";
+    const TEST_CSRF: &str = "test_csrf";
+    const TEST_SUB: &str = "test_sub";
+
+    async fn make_mock_provider_server(email: &str) -> MockServer {
+        let server = MockServer::start().await;
+        let issuer = IssuerUrl::new(server.uri()).unwrap();
+        let signing_key = Settings::get_current_settings()
+            .openid_key_required()
+            .unwrap();
+
+        let metadata = CoreProviderMetadata::new(
+            issuer.clone(),
+            AuthUrl::new(format!("{}/authorize", server.uri())).unwrap(),
+            JsonWebKeySetUrl::new(format!("{}/jwks", server.uri())).unwrap(),
+            vec![ResponseTypes::new(vec![CoreResponseType::Code])],
+            vec![CoreSubjectIdentifierType::Public],
+            vec![CoreJwsSigningAlgorithm::RsaSsaPkcs1V15Sha256],
+            EmptyAdditionalProviderMetadata {},
+        )
+        .set_token_endpoint(Some(
+            TokenUrl::new(format!("{}/token", server.uri())).unwrap(),
+        ));
+
+        let issue_time = Utc::now();
+        let id_token = CoreIdToken::new(
+            CoreIdTokenClaims::new(
+                issuer,
+                vec![Audience::new(TEST_CLIENT_ID.to_owned())],
+                issue_time + chrono::Duration::hours(1),
+                issue_time,
+                StandardClaims::new(SubjectIdentifier::new(TEST_SUB.to_owned()))
+                    .set_email(Some(EndUserEmail::new(email.to_owned()))),
+                EmptyAdditionalClaims {},
+            )
+            .set_nonce(Some(Nonce::new(TEST_NONCE.to_owned()))),
+            &signing_key,
+            CoreJwsSigningAlgorithm::RsaSsaPkcs1V15Sha256,
+            None,
+            None,
+        )
+        .unwrap();
+        let token_response = CoreTokenResponse::new(
+            AccessToken::new("access_token".to_owned()),
+            CoreTokenType::Bearer,
+            CoreIdTokenFields::new(Some(id_token), EmptyExtraTokenFields {}),
+        );
+
+        Mock::given(method("GET"))
+            .and(path("/.well-known/openid-configuration"))
+            .respond_with(ResponseTemplate::new(200).set_body_json(metadata))
+            .mount(&server)
+            .await;
+        Mock::given(method("GET"))
+            .and(path("/jwks"))
+            .respond_with(
+                ResponseTemplate::new(200).set_body_json(CoreJsonWebKeySet::new(vec![
+                    signing_key.as_verification_key(),
+                ])),
+            )
+            .mount(&server)
+            .await;
+        Mock::given(method("POST"))
+            .and(path("/token"))
+            .respond_with(ResponseTemplate::new(200).set_body_json(token_response))
+            .mount(&server)
+            .await;
+
+        server
+    }
+
+    fn make_app_state(pool: PgPool, key: Key) -> AppState {
+        let (webhook_tx, webhook_rx) = mpsc::unbounded_channel();
+        let (gateway_tx, _gateway_rx) = broadcast::channel(16);
+        let (web_reload_tx, _web_reload_rx) = broadcast::channel(8);
+        let (event_tx, _event_rx) = mpsc::unbounded_channel();
+        let (ldap_tx, _ldap_rx) = mpsc::unbounded_channel();
+        let (dirsync_tx, _dirsync_rx) = mpsc::unboun
```

**File**: `crates/defguard_core/src/handlers/activity_log.rs` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ use chrono::{DateTime, NaiveDateTime, Utc};
 use defguard_common::db::Id;
 use ipnetwork::IpNetwork;
 use sqlx::{FromRow, Postgres, QueryBuilder, Type};
-
 use utoipa::ToSchema;
 
 use super::{
```

---

### Incident Patch 15: `ceafb37f` (2026-08-03)
**Commit Message**: Release UI fixes (#3503)

* correct typing for location

* fix scroll lock shift

**File**: `web/src/pages/EditLocationPage/EditLocationPage.tsx` (modified, +4/-4)
```diff
@@ -371,11 +371,11 @@ const EditLocationForm = ({ location }: { location: NetworkLocation }) => {
   const postureChecksSectionState = useMemo(
     () =>
       getPostureChecksSectionState({
-        assignedPostureChecksCount: location.posture_checks.length,
+        assignedPostureChecksCount: location.posture_checks?.length ?? 0,
         canUseEnterprise: canUseDevicePosture,
         postureChecksCount: postureChecks.length,
       }),
-    [canUseDevicePosture, location.posture_checks.length, postureChecks.length],
+    [canUseDevicePosture, location.posture_checks?.length, postureChecks.length],
   );
   const firewallLocked = isPresent(canUseBusiness) && !canUseBusiness;
 
@@ -396,7 +396,7 @@ const EditLocationForm = ({ location }: { location: NetworkLocation }) => {
       postureChecks.map((postureCheck) => [postureCheck.id, postureCheck.name]),
     );
 
-    return location.posture_checks.map((id) => ({
+    return location.posture_checks?.map((id) => ({
       id,
       label: labelsById.get(id) ?? String(id),
     }));
@@ -985,7 +985,7 @@ const EditLocationForm = ({ location }: { location: NetworkLocation }) => {
                       options={postureCheckOptions}
                       selected={
                         new Set(
-                          assignedPostureChecks.map((postureCheck) => postureCheck.id),
+                          assignedPostureChecks?.map((postureCheck) => postureCheck.id),
                         )
                       }
                       modalTitle={m.location_posture_checks_select()}
```

**File**: `web/src/shared/api/types.ts` (modified, +1/-1)
```diff
@@ -814,7 +814,7 @@ export interface NetworkLocation {
   location_mfa_mode: LocationMfaModeValue;
   service_location_mode: LocationServiceModeValue;
   has_devices: boolean;
-  posture_checks: number[];
+  posture_checks?: number[];
 }
 
 export interface EditNetworkLocation
```

**File**: `web/src/shared/defguard-ui` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit ec3ca5ca6af3c058fd8ad9ee66db426378671811
+Subproject commit b73914b9b32ded9a4e248def32a5b7fbe87708c3
```

#### Recent Merged Pull Requests:
- **PR #3805** (2026-10-05): E2E tests for rate limits (@t-aleksander)
- **PR #3801** (2026-10-05): Add an information when flows for location are blocked by instance config (@filipslezaklab)
- **PR #3799** (2026-10-05): Add OpenID kind to InstanceInfo (@jakub-tldr)
- **PR #3798** (2026-10-05): Include all users coming from LDAP in the synchronization (@t-aleksander)
- **PR #3795** (2026-10-05): Block duplicated MFA Flow name (@jakub-tldr)
- **PR #3793** (2026-10-02): fix gateway trim logic on license expiry (@wojcik91)
- **PR #3792** (2026-10-02): send mfa capabilties to client (@filipslezaklab)
- **PR #3791** (2026-10-05): MFA flow load testing (@j-chmielewski)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
