# Forensic Learning Record (Deep Inspection): googleworkspace/cli

> **Canonical Artifact**: `07_PROJECT_LEARNING/googleworkspace-cli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/googleworkspace/cli](https://github.com/googleworkspace/cli))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:28.066Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `googleworkspace/cli`
- **Description**: Google Workspace CLI — one command-line tool for Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin, and more. Dynamically built from Google Discovery Service. Includes AI agent skills.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 31252 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/google-workspace-cli/src/fs_util.rs`
```
// Copyright 2026 Google LLC
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

//! File-system utilities.

use std::io::{self, Write};
use std::path::Path;

/// Write `data` to `path` atomically.
///
/// This implementation uses `tempfile::NamedTempFile` to create a temporary
/// file with a random name, `O_EXCL` flags (preventing symlink attacks),
/// and secure 0600 permissions from the moment of creation.
///
/// # Errors
///
/// Returns an `io::Error` if the temporary file cannot be created/written or if the
/// final rename fails.
pub fn atomic_write(path: &Path, data: &[u8]) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "path has no parent directory")
    })?;

    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    tmp.write_all(data)?;
    tmp.as_file().sync_all()?;
    tmp.persist(path)
        .map_err(|e| io::Error::new(e.error.kind(), e.error))?;

    Ok(())
}

/// Async variant of [`atomic_write`] for use with tokio.
///
/// This implementation uses `create_new(true)` (O_EXCL) and `mode(0o600)` to
/// prevent TOCTOU/symlink race conditions.
pub async fn atomic_write_async(path: &Path, data: &[u8]) -> io::Result<()> {
    use rand::Rng;
    use tokio::io::AsyncWriteExt;

    let parent = path.parent().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "path has no parent directory")
    })?;
    let file_name = path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "path has no file name"))?
        .to_string_lossy();

    let mut retries = 0;
    let mut file: tokio::fs::File;
    let mut tmp_path;

    loop {
        let suffix: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect();
        let tmp_name = format!("{}.tmp.{}", file_name, suffix);
        tmp_path = parent.join(tmp_name);

        let mut opts = tokio::fs::OpenOptions::new();
        opts.write(true).create_new(true);

        #[cfg(unix)]
        {
            opts.mode(0o600);
        }

        match opts.open(&tmp_path).await {
            Ok(f) => {
                file = f;
                break;
            }
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists && retries < 10 => {
                retries += 1;
                continue;
            }
            Err(e) => return Err(e),
        }
    }

    let write_result = async {
        file.write_all(data).await?;
        file.sync_all().await?;
        drop(file);
        tokio::fs::rename(&tmp_path, path).await
    }
    .await;

    if write_result.is_err() {
        let _ = tokio::fs::remove_file(&tmp_path).await;
    }

    write_result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_atomic_write_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("credentials.enc");
        atomic_write(&path, b"hello").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"hello");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let meta = fs::metadata(&path).unwrap();
            assert_eq!(meta.permissions().mode() & 0o777, 0o600);
        }
    }

    #[test]
    fn test_atomic_write_overwrites_existing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("credentials.enc");
        fs::write(&path, b"old").unwrap();
        atomic_write(&path, b"new").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new");
    }

    #[test]
    fn test_atomic_write_leaves_no_tmp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("credentials.enc");
        atomic_write(&path, b"data").unwrap();
        // Since we use random names, we just check that no .tmp files remain in the dir
        let files: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|res| res.unwrap().file_name())
            .collect();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0], "credentials.enc");
    }

    #[tokio::test]
    async fn test_atomic_write_async_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("token_cache.json");
        atomic_write_async(&path, b"async hello").await.unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"async hello");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let meta = fs::metadata(&path).unwrap();
            assert_eq!(meta.permissions().mode() & 0o777, 0o600);
        }
    }
}

```

### Core Architecture Module: `crates/google-workspace-cli/src/auth.rs`
```
// Copyright 2026 Google LLC
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

//! Authentication and Credential Management
//!
//! Handles obtaining OAuth 2.0 access tokens and Service Account tokens.
//! Supports local user flow (via a loopback server) and Application Default Credentials,
//! with token caching to minimize repeated authentication overhead.

use std::path::PathBuf;

use anyhow::Context;
use serde::Deserialize;

use crate::credential_store;

const PROXY_ENV_VARS: &[&str] = &[
    "http_proxy",
    "HTTP_PROXY",
    "https_proxy",
    "HTTPS_PROXY",
    "all_proxy",
    "ALL_PROXY",
];

/// Response from Google's token endpoint
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[allow(dead_code)]
    expires_in: u64,
    #[allow(dead_code)]
    token_type: String,
}

/// Refresh an access token using reqwest (supports HTTP proxy via environment variables).
/// This is used as a fallback when yup-oauth2's hyper-based client fails due to proxy issues.
async fn refresh_token_with_reqwest(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> anyhow::Result<String> {
    let client = crate::client::shared_client().map_err(anyhow::Error::from)?;
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .context("Failed to send token refresh request")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response_text_or_placeholder(response.text().await);
        anyhow::bail!("Token refresh failed with status {}: {}", status, body);
    }

    let token_response: TokenResponse = response
        .json()
        .await
        .context("Failed to parse token response")?;

    Ok(token_response.access_token)
}

/// Returns the project ID to be used for quota and billing (sets the `x-goog-user-project` header).
///
/// Priority:
/// 1. `GOOGLE_WORKSPACE_PROJECT_ID` environment variable.
/// 2. `project_id` from the OAuth client configuration (`client_secret.json`).
/// 3. `quota_project_id` from Application Default Credentials (ADC).
pub fn get_quota_project() -> Option<String> {
    // 1. Explicit environment variable (highest priority)
    if let Ok(project_id) = std::env::var("GOOGLE_WORKSPACE_PROJECT_ID") {
        if !project_id.is_empty() {
            return Some(project_id);
        }
    }

    // 2. Project ID from the OAuth client configuration (set via `gws auth setup`)
    if let Ok(config) = crate::oauth_config::load_client_config() {
        if !config.project_id.is_empty() {
            return Some(config.project_id);
        }
    }

    // 3. Fallback to Application Default Credentials (ADC)
    let path = std::env::var("GOOGLE_APPLICATION_CREDENTIALS")
        .ok()
        .map(PathBuf::from)
        .or_else(adc_well_known_path)?;
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("quota_project_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Returns the well-known Application Default Credentials path:
/// `~/.config/gcloud/application_default_credentials.json`.
///
/// Note: `dirs::config_dir()` returns `~/Library/Application Support` on macOS, which is
/// wrong for gcloud. The Google Cloud SDK always uses `~/.config/gcloud` regardless of OS.
fn adc_well_known_path() -> Option<PathBuf> {
    dirs::home_dir().map(|d| {
        d.join(".config")
            .join("gcloud")
            .join("application_default_credentials.json")
    })
}

/// Types of credentials we support
#[derive(Debug)]
enum Credential {
    AuthorizedUser(yup_oauth2::authorized_user::AuthorizedUserSecret),
    ServiceAccount(yup_oauth2::ServiceAccountKey),
}

/// Fetches access tokens for a fixed set of scopes.
///
/// Long-running helpers use this trait so they can request a fresh token before
/// each API call instead of holding a single token string until it expires.
#[async_trait::async_trait]
pub trait AccessTokenProvider: Send + Sync {
    async fn access_token(&self) -> anyhow::Result<String>;
}

/// A token provider backed by [`get_token`].
///
/// This keeps the scope list in one place so call sites can ask for a fresh
/// token whenever they need to make another request.
#[derive(Debug, Clone)]
pub struct ScopedTokenProvider {
    scopes: Vec<String>,
}

impl ScopedTokenProvider {
    pub fn new(scopes: &[&str]) -> Self {
        Self {
            scopes: scopes.iter().map(|scope| (*scope).to_string()).collect(),
        }
    }
}

#[async_trait::async_trait]
impl AccessTokenProvider for ScopedTokenProvider {
    async fn access_token(&self) -> anyhow::Result<String> {
        let scopes: Vec<&str> = self.scopes.iter().map(String::as_str).collect();
        get_token(&scopes).await
    }
}

pub fn token_provider(scopes: &[&str]) -> ScopedTokenProvider {
    ScopedTokenProvider::new(scopes)
}

/// A fake [`AccessTokenProvider`] for tests that returns tokens from a queue.
#[cfg(test)]
pub struct FakeTokenProvider {
    tokens: std::sync::Arc<tokio::sync::Mutex<std::collections::VecDeque<String>>>,
}

#[cfg(test)]
impl FakeTokenProvider {
    pub fn new(tokens: impl IntoIterator<Item = &'static str>) -> Self {
        Self {
            tokens: std::sync::Arc::new(tokio::sync::Mutex::new(
                tokens.into_iter().map(|t| t.to_string()).collect(),
            )),
        }
    }
}

#[cfg(test)]
#[async_trait::async_trait]
impl AccessTokenProvider for FakeTokenProvider {
    async fn access_token(&self) -> anyhow::Result<String> {
        self.tokens
            .lock()
            .await
            .pop_front()
            .ok_or_else(|| anyhow::anyhow!("no test token remaining"))
    }
}

/// Builds an OAuth2 authenticator and returns an access token.
///
/// Tries credentials in order:
/// 0. `GOOGLE_WORKSPACE_CLI_TOKEN` env var (raw access token, highest priority)
/// 1. `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` env var (plaintext JSON, can be User or Service Account)
/// 2. Encrypted credentials at `~/.config/gws/credentials.enc`
/// 3. Plaintext credentials at `~/.config/gws/credentials.json` (User only)
/// 4. Application Default Credentials (ADC):
///    - `GOOGLE_APPLICATION_CREDENTIALS` env var (path to a JSON credentials file), then
///    - Well-known ADC path: `~/.config/gcloud/application_default_credentials.json`
///      (populated by `gcloud auth application-default login`)
pub async fn get_token(scopes: &[&str]) -> anyhow::Result<String> {
    // 0. Direct token from env var (highest priority, bypasses all credential loading)
    if let Ok(token) = std::env::var("GOOGLE_WORKSPACE_CLI_TOKEN") {
        if !token.is_empty() {
            return Ok(token);
        }
    }

    let creds_file = std::env::var("GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE").ok();
    let config_dir = crate::auth_commands::config_dir();
    let enc_path = credential_store::encrypted_credentials_path();
    let default_path = config_dir.join("credentials.json");
    let token_cache = config_dir.join("token_cache.json");

    let creds = load_credentials_inner(creds_file.as_deref(), &enc_path, &default_path).await?;
    get_token_inner(scopes, creds, &token_cache).await
}

/// Check if HTTP proxy environment variables are set
pub(crate) fn has_proxy_env() -> bool {
    PROXY_ENV_VARS
        .iter()
        .any(|key| std::env::var_os(key).is_some_and(|value| !value.is_empty()))
}

pub(crate) fn response_text_or_placeholder<E>(result: Result<String, E>) -> String {
    result.unwrap_or_else(|_| "(could not read error response body)".to_string())
}

async fn get_token_inner(
    scopes: &[&str],
    creds: Credential,
    token_cache_path: &std::path::Path,
) -> anyhow::Result<String> {
    match creds {
        Credential::AuthorizedUser(ref secret) => {
            // If proxy env vars are set, use reqwest directly (it supports proxy)
            // This avoids waiting for yup-oauth2's hyper client to timeout
            if has_proxy_env() {
                return refresh_token_with_reqwest(
                    &secret.client_id,
                    &secret.client_secret,
                    &secret.refresh_token,
                )
                .await;
            }

            // No proxy - use yup-oauth2 (faster, has token caching)
            let auth = yup_oauth2::AuthorizedUserAuthenticator::builder(secret.clone())
                .with_storage(Box::new(crate::token_storage::EncryptedTokenStorage::new(
                    token_cache_path.to_path_buf(),
                )))
                .build()
                .await
                .context("Failed to build authorized user authenticator")?;

            let token = auth.token(scopes).await.context("Failed to get token")?;
            Ok(token
                .token()
                .ok_or_else(|| anyhow::anyhow!("Token response contained no access token"))?
                .to_string())
        }
        Credential::ServiceAccount(key) => {
            let tc_filename = token_cache_path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "token_cache.json".to_string());
            let sa_cac
```

### Core Architecture Module: `crates/google-workspace-cli/src/auth_commands.rs`
```
// Copyright 2026 Google LLC
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

use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::json;

use crate::credential_store;
use crate::error::GwsError;

/// Response from Google's token endpoint
#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    #[allow(dead_code)]
    expires_in: u64,
    #[allow(dead_code)]
    token_type: String,
}

/// Exchange authorization code for tokens using reqwest (supports HTTP proxy)
async fn exchange_code_with_reqwest(
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
) -> Result<OAuthTokenResponse, GwsError> {
    let client = crate::client::shared_client()?;
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];

    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| GwsError::Auth(format!("Failed to send token request: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = crate::auth::response_text_or_placeholder(response.text().await);
        return Err(GwsError::Auth(format!(
            "Token exchange failed with status {}: {}",
            status, body
        )));
    }

    response
        .json()
        .await
        .map_err(|e| GwsError::Auth(format!("Failed to parse token response: {e}")))
}

fn build_proxy_auth_url(client_id: &str, redirect_uri: &str, scopes: &[String]) -> String {
    let scopes_str = scopes.join(" ");
    format!(
        "https://accounts.google.com/o/oauth2/auth?\
         scope={}&\
         access_type=offline&\
         redirect_uri={}&\
         response_type=code&\
         client_id={}&\
         prompt=select_account+consent",
        urlencoding(&scopes_str),
        urlencoding(redirect_uri),
        urlencoding(client_id)
    )
}

fn extract_authorization_code(request_line: &str) -> Result<String, GwsError> {
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| GwsError::Auth("Invalid HTTP request".to_string()))?;

    path.split('?')
        .nth(1)
        .and_then(|query| {
            query.split('&').find_map(|pair| {
                let mut parts = pair.split('=');
                if parts.next() == Some("code") {
                    parts.next().map(|value| value.to_string())
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| GwsError::Auth("No authorization code in callback".to_string()))
}

/// Perform OAuth login flow with proxy support using reqwest for token exchange
async fn login_with_proxy_support(
    client_id: &str,
    client_secret: &str,
    scopes: &[String],
) -> Result<(String, String), GwsError> {
    // Start local server to receive OAuth callback
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| GwsError::Auth(format!("Failed to start local server: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| GwsError::Auth(format!("Failed to inspect local server: {e}")))?
        .port();
    let redirect_uri = format!("http://localhost:{}", port);

    let auth_url = build_proxy_auth_url(client_id, &redirect_uri, scopes);

    println!("Open this URL in your browser to authenticate:\n");
    println!("  {}\n", auth_url);

    // Wait for OAuth callback
    let (mut stream, _) = listener
        .accept()
        .map_err(|e| GwsError::Auth(format!("Failed to accept connection: {e}")))?;

    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| GwsError::Auth(format!("Failed to read request: {e}")))?;

    let code = extract_authorization_code(&request_line)?;

    // Send success response to browser
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body><h1>Success!</h1><p>You may now close this window.</p></body></html>";
    let _ = stream.write_all(response.as_bytes());

    // Exchange code for tokens using reqwest (proxy-aware)
    let token_response =
        exchange_code_with_reqwest(client_id, client_secret, &code, &redirect_uri).await?;

    let refresh_token = token_response.refresh_token.ok_or_else(|| {
        GwsError::Auth(
            "OAuth flow completed but no refresh token was returned. \
                 Ensure the OAuth consent screen includes 'offline' access."
                .to_string(),
        )
    })?;

    Ok((token_response.access_token, refresh_token))
}

fn read_refresh_token_from_cache(temp_path: &Path) -> Result<String, GwsError> {
    let token_data = std::fs::read(temp_path)
        .ok()
        .and_then(|bytes| crate::credential_store::decrypt(&bytes).ok())
        .and_then(|decrypted| String::from_utf8(decrypted).ok())
        .unwrap_or_default();

    extract_refresh_token(&token_data).ok_or_else(|| {
        GwsError::Auth(
            "OAuth flow completed but no refresh token was returned. \
             Ensure the OAuth consent screen includes 'offline' access."
                .to_string(),
        )
    })
}

async fn login_with_yup_oauth(
    config_dir: &Path,
    client_id: &str,
    client_secret: &str,
    scopes: &[String],
) -> Result<(String, String), GwsError> {
    let secret = yup_oauth2::ApplicationSecret {
        client_id: client_id.to_string(),
        client_secret: client_secret.to_string(),
        auth_uri: "https://accounts.google.com/o/oauth2/auth".to_string(),
        token_uri: "https://oauth2.googleapis.com/token".to_string(),
        redirect_uris: vec!["http://localhost".to_string()],
        ..Default::default()
    };

    let temp_path = config_dir.join("credentials.tmp");
    let _ = std::fs::remove_file(&temp_path);

    let result = async {
        let auth = yup_oauth2::InstalledFlowAuthenticator::builder(
            secret,
            yup_oauth2::InstalledFlowReturnMethod::HTTPRedirect,
        )
        .with_storage(Box::new(crate::token_storage::EncryptedTokenStorage::new(
            temp_path.clone(),
        )))
        .force_account_selection(true)
        .flow_delegate(Box::new(CliFlowDelegate { login_hint: None }))
        .build()
        .await
        .map_err(|e| GwsError::Auth(format!("Failed to build authenticator: {e}")))?;

        let scope_refs: Vec<&str> = scopes.iter().map(|s| s.as_str()).collect();
        let token = auth
            .token(&scope_refs)
            .await
            .map_err(|e| GwsError::Auth(format!("OAuth flow failed: {e}")))?;

        let access_token = token
            .token()
            .ok_or_else(|| GwsError::Auth("No access token returned".to_string()))?
            .to_string();
        let refresh_token = read_refresh_token_from_cache(&temp_path)?;

        Ok((access_token, refresh_token))
    }
    .await;

    let _ = std::fs::remove_file(&temp_path);
    result
}

/// Simple URL encoding
fn urlencoding(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}

/// Mask a secret string by showing only the first 4 and last 4 characters.
/// Strings with 8 or fewer characters are fully replaced with "***".
///
/// Uses char-based indexing (not byte offsets) so multi-byte UTF-8 secrets
/// never cause a panic.
fn mask_secret(s: &str) -> String {
    const MASK_PREFIX_LEN: usize = 4;
    const MASK_SUFFIX_LEN: usize = 4;
    const MIN_LEN_FOR_PARTIAL_MASK: usize = MASK_PREFIX_LEN + MASK_SUFFIX_LEN;

    let char_count = s.chars().count();
    if char_count > MIN_LEN_FOR_PARTIAL_MASK {
        let prefix: String = s.chars().take(MASK_PREFIX_LEN).collect();
        let suffix: String = s.chars().skip(char_count - MASK_SUFFIX_LEN).collect();
        format!("{prefix}...{suffix}")
    } else {
        "***".to_string()
    }
}

/// Minimal scopes for first-run login — only core Workspace APIs that never
/// trigger Google's `restricted_client` / unverified-app block.
///
/// These are the safest scopes for unverified OAuth apps and personal Cloud
/// projects.  Users can request broader access with `--scopes` or `--full`.
pub const MINIMAL_SCOPES: &[&str] = &[
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/tasks",
];

/// Default scopes for login.  Alias for [`MINIMAL_SCOPES`] — deliberately kept
/// narrow so first-run logins succeed even with an unverified OAuth app.
///
/// Previously this included `pubsub` and `cloud-platform`, which Google marks
/// as *restricted* and blocks for unverified apps, causing `Error 403:
/// restricted_client`.  Use `--scopes` to add those scopes explicitly when you
/// have a verified app or a GCP project with the APIs enabled and approved.
pub const DEFAULT_SCOPES: &[&str] = MINIMAL_SCOPES;

/// Full scopes — all common Workspace APIs 
```

### Core Architecture Module: `crates/google-workspace-cli/src/client.rs`
```
// Copyright 2026 Google LLC
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

//! HTTP client — re-exports from `google_workspace` library crate.

pub use google_workspace::client::*;

```

### Core Architecture Module: `crates/google-workspace-cli/src/commands.rs`
```
// Copyright 2026 Google LLC
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

use clap::{Arg, Command};

use crate::discovery::{RestDescription, RestResource};

/// Builds the full CLI command tree from a Discovery Document.
pub fn build_cli(doc: &RestDescription) -> Command {
    let about_text = doc
        .description
        .clone()
        .unwrap_or_else(|| "Google Workspace CLI".to_string());
    let mut root = Command::new("gws")
        .about(about_text)
        .subcommand_required(true)
        .arg_required_else_help(true)
        .arg(
            clap::Arg::new("sanitize")
                .long("sanitize")
                .help("Sanitize API responses through a Model Armor template. Requires cloud-platform scope. Format: projects/PROJECT/locations/LOCATION/templates/TEMPLATE. Also reads GWS_SANITIZE_TEMPLATE env var.")
                .value_name("TEMPLATE")
                .global(true),
        )
        .arg(
            clap::Arg::new("dry-run")
                .long("dry-run")
                .help("Validate the request locally without sending it to the API")
                .action(clap::ArgAction::SetTrue)
                .global(true),
        )
        .arg(
            clap::Arg::new("format")
                .long("format")
                .help("Output format: json (default), table, yaml, csv")
                .value_name("FORMAT")
                .global(true),
        );

    // Inject helper commands
    let helper = crate::helpers::get_helper(&doc.name);
    if let Some(ref helper) = helper {
        root = helper.inject_commands(root, doc);
    }

    // Add resource subcommands (unless helper suppresses them)
    let skip_resources = helper.as_ref().is_some_and(|h| h.helper_only());
    if !skip_resources {
        let mut resource_names: Vec<_> = doc.resources.keys().collect();
        resource_names.sort();
        for name in resource_names {
            let resource = &doc.resources[name];
            if let Some(cmd) = build_resource_command(name, resource) {
                root = root.subcommand(cmd);
            }
        }
    }

    root
}

/// Recursively builds a Command for a resource.
/// Returns None if the resource has no methods or sub-resources.
fn build_resource_command(name: &str, resource: &RestResource) -> Option<Command> {
    let mut cmd = Command::new(name.to_string())
        .about(format!("Operations on the '{name}' resource"))
        .subcommand_required(true)
        .arg_required_else_help(true);

    let mut has_children = false;

    // Add method subcommands
    let mut method_names: Vec<_> = resource.methods.keys().collect();
    method_names.sort();
    for method_name in method_names {
        let method = &resource.methods[method_name];

        has_children = true;

        let about = crate::text::truncate_description(
            method.description.as_deref().unwrap_or(""),
            crate::text::CLI_DESCRIPTION_LIMIT,
            true,
        );

        let mut method_cmd = Command::new(method_name.to_string())
            .about(about)
            .arg(
                Arg::new("params")
                    .long("params")
                    .help("JSON string for URL/Query parameters")
                    .value_name("JSON"),
            )
            .arg(
                Arg::new("output")
                    .long("output")
                    .short('o')
                    .help("Output file path for binary responses")
                    .value_name("PATH"),
            );

        // Only add --json flag if the method accepts a request body
        if method.request.is_some() {
            method_cmd = method_cmd.arg(
                Arg::new("json")
                    .long("json")
                    .help("JSON string for the request body")
                    .value_name("JSON"),
            );
        }

        // Add --upload flag if the method supports media upload
        if method.supports_media_upload {
            method_cmd = method_cmd
                .arg(
                    Arg::new("upload")
                        .long("upload")
                        .help("Local file path to upload as media content (multipart upload)")
                        .value_name("PATH"),
                )
                .arg(
                    Arg::new("upload-content-type")
                        .long("upload-content-type")
                        .help("MIME type of the uploaded file content (e.g. text/markdown). If omitted, detected from file extension or metadata mimeType")
                        .value_name("MIME"),
                );
        }

        // Pagination flags
        method_cmd = method_cmd
            .arg(
                Arg::new("page-all")
                    .long("page-all")
                    .help("Auto-paginate through all results, outputting one JSON line per page (NDJSON)")
                    .action(clap::ArgAction::SetTrue),
            )
            .arg(
                Arg::new("page-limit")
                    .long("page-limit")
                    .help("Maximum number of pages to fetch when using --page-all (default: 10)")
                    .value_name("N")
                    .value_parser(clap::value_parser!(u32)),
            )
            .arg(
                Arg::new("page-delay")
                    .long("page-delay")
                    .help("Delay in milliseconds between page fetches (default: 100)")
                    .value_name("MS")
                    .value_parser(clap::value_parser!(u64)),
            );

        cmd = cmd.subcommand(method_cmd);
    }

    // Add sub-resource subcommands (recursive)
    let mut sub_names: Vec<_> = resource.resources.keys().collect();
    sub_names.sort();
    for sub_name in sub_names {
        let sub_resource = &resource.resources[sub_name];
        if let Some(sub_cmd) = build_resource_command(sub_name, sub_resource) {
            has_children = true;
            cmd = cmd.subcommand(sub_cmd);
        }
    }

    if has_children {
        Some(cmd)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discovery::{RestMethod, RestResource};
    use std::collections::HashMap;

    fn make_doc() -> RestDescription {
        let mut methods = HashMap::new();
        methods.insert(
            "list".to_string(),
            RestMethod {
                id: None,
                description: None,
                http_method: "GET".to_string(),
                path: "list".to_string(),
                parameters: HashMap::new(),
                parameter_order: vec![],
                request: None,
                response: None,
                scopes: vec!["https://www.googleapis.com/auth/drive.readonly".to_string()],
                flat_path: None,
                supports_media_download: false,
                supports_media_upload: false,
                media_upload: None,
            },
        );

        methods.insert(
            "delete".to_string(),
            RestMethod {
                id: None,
                description: None,
                http_method: "DELETE".to_string(),
                path: "delete".to_string(),
                parameters: HashMap::new(),
                parameter_order: vec![],
                request: None,
                response: None,
                scopes: vec!["https://www.googleapis.com/auth/drive".to_string()],
                flat_path: None,
                supports_media_download: false,
                supports_media_upload: false,
                media_upload: None,
            },
        );

        let mut resources = HashMap::new();
        resources.insert(
            "files".to_string(),
            RestResource {
                methods,
                resources: HashMap::new(),
            },
        );

        RestDescription {
            name: "drive".to_string(),
            version: "v3".to_string(),
            title: None,
            description: None,
            root_url: "".to_string(),
            service_path: "".to_string(),
            base_url: None,
            schemas: HashMap::new(),
            resources,
            parameters: HashMap::new(),
            auth: None,
        }
    }

    #[test]
    fn test_all_commands_always_shown() {
        let doc = make_doc();
        let cmd = build_cli(&doc);

        // Should have "files" subcommand
        let files_cmd = cmd
            .find_subcommand("files")
            .expect("files resource missing");

        // All methods should always be visible regardless of auth state
        assert!(files_cmd.find_subcommand("list").is_some());
        assert!(files_cmd.find_subcommand("delete").is_some());
    }

    #[test]
    fn test_sanitize_arg_present() {
        let doc = make_doc();
        let cmd = build_cli(&doc);

        // The --sanitize global arg should be available
        let args: Vec<_> = cmd.get_arguments().collect();
        let sanitize_arg = args.iter().find(|a| a.get_id() == "sanitize");
        assert!(
            sanitize_arg.is_some(),
            "--sanitize arg should be present on root command"
        );
    }
}

```

### Core Architecture Module: `crates/google-workspace-cli/src/credential_store.rs`
```
// Copyright 2026 Google LLC
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

use std::path::PathBuf;

use crate::output::sanitize_for_terminal;

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Nonce};

use keyring::Entry;
use rand::RngCore;
use std::sync::OnceLock;
use zeroize::Zeroize;

/// Ensure the key-file parent directory exists with restrictive permissions.
fn ensure_key_dir(path: &std::path::Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Err(e) = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700))
            {
                eprintln!(
                    "Warning: failed to set secure permissions on key directory: {}",
                    sanitize_for_terminal(&e.to_string())
                );
            }
        }
    }
    Ok(())
}

/// Atomically create a **new** key file using `create_new(true)` (`O_EXCL` on
/// Unix, `CREATE_NEW` on Windows). If another process already created the file,
/// returns `Err` with `ErrorKind::AlreadyExists` so the caller can read the
/// winner's key instead.
fn save_key_file_exclusive(path: &std::path::Path, b64_key: &str) -> std::io::Result<()> {
    use std::io::Write;
    ensure_key_dir(path)?;

    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create_new(true); // atomic: fails if file already exists
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut file = opts.open(path)?;
    file.write_all(b64_key.as_bytes())?;
    file.sync_all()?; // fsync: ensure key is durable before returning
    Ok(())
}

/// Persist the base64-encoded encryption key to a local file with restrictive
/// permissions (0600 file, 0700 directory). Overwrites any existing file.
/// Uses atomic_write to prevent TOCTOU/symlink race conditions.
#[allow(dead_code)]
fn save_key_file(path: &std::path::Path, b64_key: &str) -> std::io::Result<()> {
    crate::fs_util::atomic_write(path, b64_key.as_bytes())
}
fn read_key_file(path: &std::path::Path) -> Option<[u8; 32]> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    // Item 4: validate file permissions on read
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mode = meta.permissions().mode();
            if mode & 0o077 != 0 {
                eprintln!(
                    "Warning: encryption key file {} has overly permissive mode {:04o}. \
                     Expected 0600. Run: chmod 600 {}",
                    path.display(),
                    mode & 0o777,
                    path.display()
                );
            }
        }
    }

    let b64_key = std::fs::read_to_string(path).ok()?;
    let mut decoded = STANDARD.decode(b64_key.trim()).ok()?;
    if decoded.len() == 32 {
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&decoded);
        decoded.zeroize(); // scrub decoded key material from heap
        Some(arr)
    } else {
        decoded.zeroize();
        None
    }
}

/// Generate a random 256-bit key.
fn generate_random_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    key
}

/// Abstraction over OS keyring operations for testability.
trait KeyringProvider {
    /// Attempt to read the stored password.
    fn get_password(&self) -> Result<String, keyring::Error>;
    /// Attempt to store a password in the keyring.
    fn set_password(&self, password: &str) -> Result<(), keyring::Error>;
}

/// Production keyring implementation wrapping an optional `keyring::Entry`.
struct OsKeyring(Option<Entry>);

impl OsKeyring {
    fn new(service: &str, user: &str) -> Self {
        Self(Entry::new(service, user).ok())
    }
}

impl KeyringProvider for OsKeyring {
    fn get_password(&self) -> Result<String, keyring::Error> {
        match &self.0 {
            Some(entry) => entry.get_password(),
            None => Err(keyring::Error::NoEntry),
        }
    }

    fn set_password(&self, password: &str) -> Result<(), keyring::Error> {
        match &self.0 {
            Some(entry) => entry.set_password(password),
            None => Err(keyring::Error::NoEntry),
        }
    }
}

/// Which backend to use for encryption key storage.
///
/// Controlled by `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND`:
/// - `"keyring"` (default): Use OS keyring, fall back to `.encryption_key` file
/// - `"file"`: Use `.encryption_key` file only (for Docker/CI/headless)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum KeyringBackend {
    Keyring,
    File,
}

impl KeyringBackend {
    fn from_env() -> Self {
        let raw = std::env::var("GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND").unwrap_or_default();
        let lower = raw.to_lowercase();
        match lower.as_str() {
            "file" => KeyringBackend::File,
            "keyring" | "" => KeyringBackend::Keyring,
            other => {
                // Item 1: warn on unrecognized values
                eprintln!(
                    "Warning: unknown GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=\"{other}\", \
                     defaulting to \"keyring\". Valid values: \"keyring\", \"file\"."
                );
                KeyringBackend::Keyring
            }
        }
    }

    /// Human-readable name for logging and status output.
    fn as_str(&self) -> &'static str {
        match self {
            KeyringBackend::Keyring => "keyring",
            KeyringBackend::File => "file",
        }
    }
}

/// Core key-resolution logic, separated from caching for testability.
///
/// When `backend` is `Keyring`:
///   1. Try keyring → 2. Try file → 3. Generate (save to keyring + file)
///
/// When `backend` is `File`:
///   1. Try file → 2. Generate (save to file only)
///
/// The `.encryption_key` file is **never deleted** — it always serves as a
/// durable fallback for environments where the keyring is ephemeral.
fn resolve_key(
    backend: KeyringBackend,
    provider: &dyn KeyringProvider,
    key_file: &std::path::Path,
) -> anyhow::Result<[u8; 32]> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    // --- 1. Try keyring (only when backend = Keyring) --------------------
    if backend == KeyringBackend::Keyring {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        {
            match provider.get_password() {
                Ok(b64_key) => {
                    if let Ok(decoded) = STANDARD.decode(&b64_key) {
                        if decoded.len() == 32 {
                            let mut arr = [0u8; 32];
                            arr.copy_from_slice(&decoded);
                            // Cleanup insecure file fallback if it still exists.
                            // TOCTOU race condition is a known limitation.
                            if let Err(e) = std::fs::remove_file(key_file) {
                                if e.kind() != std::io::ErrorKind::NotFound {
                                    eprintln!(
                                        "Warning: failed to remove legacy key file at '{}': {}",
                                        key_file.display(),
                                        e
                                    );
                                }
                            }
                            return Ok(arr);
                        }
                    }
                    // Keyring contained invalid data — fall through to generate new.
                }
                Err(keyring::Error::NoEntry) => {
                    // Keyring is empty — fall through to generate new.
                }
                Err(e) => {
                    anyhow::bail!("OS keyring failed: {}. Set GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file to use file storage.", sanitize_for_terminal(&e.to_string()));
                }
            }

            // Generate a new key if keyring was empty or contained invalid data.
            let key = generate_random_key();
            let b64_key = STANDARD.encode(key);
            if let Err(e) = provider.set_password(&b64_key) {
                anyhow::bail!(
                    "Failed to set key in OS keyring: {}",
                    sanitize_for_terminal(&e.to_string())
                );
            }
            if let Err(e) = std::fs::remove_file(key_file) {
                if e.kind() != std::io::ErrorKind::NotFound {
                    eprintln!(
                        "Warning: failed to remove legacy key file at '{}': {}",
                        key_file.display(),
                        e
                    );
                }
            }
            return Ok(key);
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            // On Linux, keyring uses a mock store by default without C DBus dependencies,
            // so we continue to use the file fallback for reliability.
            match provider.get_password() {
                Ok(b64_key) => {
                    if let Ok(decoded) = STANDARD.decode(&b64_key) {
                        if decoded.len() == 32 {
                            let mut arr = [0u8; 32];
                            arr.copy_from_slice(&decoded);
                            // Ensure file backup stays in sync with keyring 
```

### Core Architecture Module: `crates/google-workspace-cli/src/discovery.rs`
```
// Copyright 2026 Google LLC
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

//! Discovery Document types and fetching.
//!
//! Types are re-exported from the `google_workspace` library crate.
//! The CLI wrapper provides default caching via `config_dir()`.

pub use google_workspace::discovery::*;

/// Fetches and caches a Google Discovery Document using the CLI's config directory.
///
/// This is a convenience wrapper around
/// [`google_workspace::discovery::fetch_discovery_document`] that automatically
/// uses the CLI's cache directory (`~/.config/gws/cache/`).
pub async fn fetch_discovery_document(
    service: &str,
    version: &str,
) -> anyhow::Result<RestDescription> {
    let cache_dir = crate::auth_commands::config_dir().join("cache");
    google_workspace::discovery::fetch_discovery_document(service, version, Some(&cache_dir)).await
}

```

### Core Architecture Module: `crates/google-workspace-cli/src/error.rs`
```
// Copyright 2026 Google LLC
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

//! Structured error types and CLI error output.
//!
//! Core error types are re-exported from the `google_workspace` library crate.
//! CLI-specific error formatting (colored terminal output) is defined here.

pub use google_workspace::error::*;

use crate::output::{colorize, sanitize_for_terminal};

/// Human-readable exit code table, keyed by (code, description).
///
/// Used by `print_usage()` so the help text stays in sync with the
/// constants defined below without requiring manual updates in two places.
pub const EXIT_CODE_DOCUMENTATION: &[(i32, &str)] = &[
    (0, "Success"),
    (
        GwsError::EXIT_CODE_API,
        "API error  — Google returned an error response",
    ),
    (
        GwsError::EXIT_CODE_AUTH,
        "Auth error — credentials missing or invalid",
    ),
    (
        GwsError::EXIT_CODE_VALIDATION,
        "Validation — bad arguments or input",
    ),
    (
        GwsError::EXIT_CODE_DISCOVERY,
        "Discovery  — could not fetch API schema",
    ),
    (GwsError::EXIT_CODE_OTHER, "Internal   — unexpected failure"),
];

/// Format a colored error label for the given error variant.
fn error_label(err: &GwsError) -> String {
    match err {
        GwsError::Api { .. } => colorize("error[api]:", "31"), // red
        GwsError::Auth(_) => colorize("error[auth]:", "31"),   // red
        GwsError::Validation(_) => colorize("error[validation]:", "33"), // yellow
        GwsError::Discovery(_) => colorize("error[discovery]:", "31"), // red
        GwsError::Other(_) => colorize("error:", "31"),        // red
    }
}

/// Formats any error as a JSON object and prints to stdout.
///
/// A human-readable colored label is printed to stderr when connected to a
/// TTY. For `accessNotConfigured` errors (HTTP 403, reason
/// `accessNotConfigured`), additional guidance is printed to stderr.
/// The JSON output on stdout is unchanged (machine-readable).
pub fn print_error_json(err: &GwsError) {
    let json = err.to_json();
    println!(
        "{}",
        serde_json::to_string_pretty(&json).unwrap_or_default()
    );

    // Print a colored summary to stderr. For accessNotConfigured errors,
    // print specialized guidance instead of the generic message to avoid
    // redundant output (the full API error already appears in the JSON).
    if let GwsError::Api {
        reason, enable_url, ..
    } = err
    {
        if reason == "accessNotConfigured" {
            eprintln!();
            let hint = colorize("hint:", "36"); // cyan
            eprintln!(
                "{} {hint} API not enabled for your GCP project.",
                error_label(err)
            );
            if let Some(url) = enable_url {
                eprintln!("      Enable it at: {url}");
            } else {
                eprintln!("      Visit the GCP Console → APIs & Services → Library to enable the required API.");
            }
            eprintln!("      After enabling, wait a few seconds and retry your command.");
            return;
        }
    }
    eprintln!(
        "{} {}",
        error_label(err),
        sanitize_for_terminal(&err.to_string())
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[serial_test::serial]
    fn test_colorize_respects_no_color_env() {
        std::env::set_var("NO_COLOR", "1");
        let result = colorize("hello", "31");
        std::env::remove_var("NO_COLOR");
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_error_label_contains_variant_name() {
        let api_err = GwsError::Api {
            code: 400,
            message: "bad".to_string(),
            reason: "r".to_string(),
            enable_url: None,
        };
        let label = error_label(&api_err);
        assert!(label.contains("error[api]:"));

        let auth_err = GwsError::Auth("fail".to_string());
        assert!(error_label(&auth_err).contains("error[auth]:"));

        let val_err = GwsError::Validation("bad input".to_string());
        assert!(error_label(&val_err).contains("error[validation]:"));

        let disc_err = GwsError::Discovery("missing".to_string());
        assert!(error_label(&disc_err).contains("error[discovery]:"));

        let other_err = GwsError::Other(anyhow::anyhow!("oops"));
        assert!(error_label(&other_err).contains("error:"));
    }

    #[test]
    fn test_sanitize_for_terminal_strips_control_chars() {
        let input = "normal \x1b[31mred text\x1b[0m end";
        let sanitized = sanitize_for_terminal(input);
        assert_eq!(sanitized, "normal [31mred text[0m end");
        assert!(!sanitized.contains('\x1b'));

        let input2 = "line1\nline2\ttab";
        assert_eq!(sanitize_for_terminal(input2), "line1\nline2\ttab");

        let input3 = "hello\x07bell\x08backspace";
        assert_eq!(sanitize_for_terminal(input3), "hellobellbackspace");
    }
}

```

### Core Architecture Module: `crates/google-workspace-cli/src/executor.rs`
```
// Copyright 2026 Google LLC
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

//! API Request Execution
//!
//! Handles building and dispatching HTTP requests to Google Workspace APIs.
//! Responsibilities include multipart file uploads, response pagination,
//! error mapping, and optionally running text content through Model Armor for sanitization.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use anyhow::Context;
use futures_util::stream::TryStreamExt;
use futures_util::StreamExt;
use serde_json::{json, Map, Value};
use tokio::io::AsyncWriteExt;

use crate::discovery::{RestDescription, RestMethod};
use crate::error::GwsError;
use crate::output::sanitize_for_terminal;

/// Tracks what authentication method was used for the request.
#[derive(Debug, Clone, PartialEq)]
pub enum AuthMethod {
    /// OAuth2 bearer token from credentials file
    OAuth,
    /// No authentication was provided
    None,
}

/// Source for media upload content.
///
/// Two mutually exclusive strategies: upload from a file on disk (for Drive,
/// Chat, etc.) or from in-memory bytes (for Gmail's constructed RFC 5322
/// messages). Using an enum makes illegal states (both set, or mismatched
/// content types) unrepresentable.
pub enum UploadSource<'a> {
    /// Stream from a file on disk. Content type is inferred from the file
    /// extension, overridden by metadata mimeType, or explicitly set.
    File {
        path: &'a str,
        content_type: Option<&'a str>,
    },
    /// Upload from in-memory bytes with an explicit content type.
    Bytes {
        data: &'a [u8],
        content_type: &'a str,
    },
}

/// Configuration for auto-pagination.
#[derive(Debug, Clone)]
pub struct PaginationConfig {
    /// Whether to auto-paginate through all pages.
    pub page_all: bool,
    /// Maximum number of pages to fetch (default: 10).
    pub page_limit: u32,
    /// Delay between page fetches in milliseconds (default: 100).
    pub page_delay_ms: u64,
}

impl Default for PaginationConfig {
    fn default() -> Self {
        Self {
            page_all: false,
            page_limit: 10,
            page_delay_ms: 100,
        }
    }
}

/// Parsed and validated inputs ready for request execution.
#[allow(dead_code)]
struct ExecutionInput {
    params: Map<String, Value>,
    body: Option<Value>,
    full_url: String,
    query_params: Vec<(String, String)>,
    is_upload: bool,
}

/// Parse parameters and body JSON, validate against schema, check required params, and build the URL.
fn parse_and_validate_inputs(
    doc: &RestDescription,
    method: &RestMethod,
    params_json: Option<&str>,
    body_json: Option<&str>,
    is_media_upload: bool,
) -> Result<ExecutionInput, GwsError> {
    let params: Map<String, Value> = if let Some(p) = params_json {
        serde_json::from_str(p)
            .map_err(|e| GwsError::Validation(format!("Invalid --params JSON: {e}")))?
    } else {
        Map::new()
    };

    let body: Option<Value> = if let Some(b) = body_json {
        let val: Value = serde_json::from_str(b)
            .map_err(|e| GwsError::Validation(format!("Invalid --json body: {e}")))?;

        if let Some(ref req_ref) = method.request {
            if let Some(ref schema_name) = req_ref.schema_ref {
                validate_body_against_schema(&val, schema_name, doc)?;
            }
        }

        Some(val)
    } else {
        None
    };

    for param_name in &method.parameter_order {
        if let Some(param_def) = method.parameters.get(param_name) {
            if param_def.required
                && param_def.location.as_deref() == Some("path")
                && !params.contains_key(param_name)
            {
                return Err(GwsError::Validation(format!(
                    "Required path parameter {} is missing. Provide it via --params",
                    param_name
                )));
            }
        }
    }

    for (param_name, param_def) in &method.parameters {
        if param_def.required && !params.contains_key(param_name) {
            return Err(GwsError::Validation(format!(
                "Required parameter '{}' is missing. Provide it via --params",
                param_name
            )));
        }
    }

    let (full_url, query_params) = build_url(doc, method, &params, is_media_upload)?;
    let is_upload = is_media_upload && method.supports_media_upload;

    Ok(ExecutionInput {
        params,
        body,
        full_url,
        query_params,
        is_upload,
    })
}

/// Build an HTTP request with auth, query params, page token, and body/multipart attachment.
#[allow(clippy::too_many_arguments)]
async fn build_http_request(
    client: &reqwest::Client,
    method: &RestMethod,
    input: &ExecutionInput,
    token: Option<&str>,
    auth_method: &AuthMethod,
    page_token: Option<&str>,
    pages_fetched: u32,
    upload: &Option<UploadSource<'_>>,
) -> Result<reqwest::RequestBuilder, GwsError> {
    let mut request = match method.http_method.as_str() {
        "GET" => client.get(&input.full_url),
        "POST" => client.post(&input.full_url),
        "PUT" => client.put(&input.full_url),
        "PATCH" => client.patch(&input.full_url),
        "DELETE" => client.delete(&input.full_url),
        other => {
            return Err(GwsError::Other(anyhow::anyhow!(
                "Unsupported HTTP method: {other}"
            )))
        }
    };

    if let Some(token) = token {
        if *auth_method == AuthMethod::OAuth {
            request = request.bearer_auth(token);
        }
    }

    // Set quota project from ADC for billing/quota attribution
    if let Some(quota_project) = crate::auth::get_quota_project() {
        request = request.header("x-goog-user-project", quota_project);
    }

    let mut all_query_params = input.query_params.clone();
    if let Some(pt) = page_token {
        all_query_params.push(("pageToken".to_string(), pt.to_string()));
    }
    if !all_query_params.is_empty() {
        request = request.query(&all_query_params);
    }

    if pages_fetched == 0 {
        if let Some(upload_source) = upload {
            request = request.query(&[("uploadType", "multipart")]);
            let (body, content_type, content_length) = match upload_source {
                UploadSource::Bytes { data, content_type } => {
                    if content_type.contains('\r') || content_type.contains('\n') {
                        return Err(GwsError::Validation(
                            "Upload content type must not contain CR or LF".to_string(),
                        ));
                    }
                    build_multipart_bytes(&input.body, data, content_type)?
                }
                UploadSource::File { path, content_type } => {
                    let file_meta = tokio::fs::metadata(path).await.map_err(|e| {
                        GwsError::Validation(format!(
                            "Failed to get metadata for upload file '{}': {}",
                            path, e
                        ))
                    })?;
                    let file_size = file_meta.len();
                    let media_mime = resolve_upload_mime(*content_type, Some(path), &input.body);
                    build_multipart_stream(&input.body, path, file_size, &media_mime)?
                }
            };
            request = request.header("Content-Type", content_type);
            request = request.header("Content-Length", content_length);
            request = request.body(body);
        } else if let Some(ref body_val) = input.body {
            request = request.header("Content-Type", "application/json");
            request = request.json(body_val);
        } else if matches!(method.http_method.as_str(), "POST" | "PUT" | "PATCH") {
            request = request.header("Content-Length", "0");
        }
    }

    Ok(request)
}

/// Handle a JSON response: parse, sanitize via Model Armor, output, and check pagination.
/// Returns `Ok(true)` if the pagination loop should continue.
#[allow(clippy::too_many_arguments)]
async fn handle_json_response(
    body_text: &str,
    pagination: &PaginationConfig,
    sanitize_template: Option<&str>,
    sanitize_mode: &crate::helpers::modelarmor::SanitizeMode,
    output_format: &crate::formatter::OutputFormat,
    pages_fetched: &mut u32,
    page_token: &mut Option<String>,
    capture_output: bool,
    captured: &mut Vec<Value>,
) -> Result<bool, GwsError> {
    if let Ok(mut json_val) = serde_json::from_str::<Value>(body_text) {
        *pages_fetched += 1;

        // Run Model Armor sanitization if --sanitize is enabled
        if let Some(template) = sanitize_template {
            let text_to_check = serde_json::to_string(&json_val).unwrap_or_default();
            match crate::helpers::modelarmor::sanitize_text(template, &text_to_check).await {
                Ok(result) => {
                    let is_match = result.filter_match_state == "MATCH_FOUND";
                    if is_match {
                        eprintln!("⚠️  Model Armor: prompt injection detected (filterMatchState: MATCH_FOUND)");
                    }

                    if is_match && *sanitize_mode == crate::helpers::modelarmor::SanitizeMode::Block
                    {
                        let blocked = serde_json::json!({
                            "error": "Content blocked by Model Armor",
                            "sanitizationResult": serde_json::to_value(&result).unwrap_or_
```

### Core Architecture Module: `crates/google-workspace-cli/src/formatter.rs`
```
// Copyright 2026 Google LLC
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

//! Output Formatting
//!
//! Transforms JSON API responses into human-readable formats (table, YAML, CSV).

use serde_json::Value;
use std::fmt::Write;

/// Supported output formats.
#[derive(Debug, Clone, PartialEq, Default)]
pub enum OutputFormat {
    /// Pretty-printed JSON (default).
    #[default]
    Json,
    /// Aligned text table.
    Table,
    /// YAML.
    Yaml,
    /// Comma-separated values.
    Csv,
}

impl OutputFormat {
    /// Parse from a string argument.
    ///
    /// Returns `Ok(format)` for known values, or `Err(unknown_value)` if the
    /// string is not recognised.  Call sites should warn the user on `Err` and
    /// decide whether to fall back to JSON or surface an error.
    pub fn parse(s: &str) -> Result<Self, String> {
        match s.to_lowercase().as_str() {
            "json" => Ok(Self::Json),
            "table" => Ok(Self::Table),
            "yaml" | "yml" => Ok(Self::Yaml),
            "csv" => Ok(Self::Csv),
            other => Err(other.to_string()),
        }
    }

    /// Parse from a string argument, falling back to JSON for unknown values.
    ///
    /// Prefer `parse()` at call sites where you want to surface a warning.
    pub fn from_str(s: &str) -> Self {
        Self::parse(s).unwrap_or(Self::Json)
    }
}

/// Format a JSON value according to the specified output format.
pub fn format_value(value: &Value, format: &OutputFormat) -> String {
    match format {
        OutputFormat::Json => serde_json::to_string_pretty(value).unwrap_or_default(),
        OutputFormat::Table => format_table(value),
        OutputFormat::Yaml => format_yaml(value),
        OutputFormat::Csv => format_csv(value),
    }
}

/// Format a JSON value for a paginated page.
///
/// When auto-paginating with `--page-all`, CSV and table formats should only
/// emit column headers on the **first** page so that each subsequent page
/// contains only data rows, making the combined output machine-parseable.
///
/// For JSON the output is compact (one JSON object per line / NDJSON).
/// For YAML each page is prefixed with a `---` document separator so the
/// combined stream is a valid YAML multi-document file.
pub fn format_value_paginated(value: &Value, format: &OutputFormat, is_first_page: bool) -> String {
    match format {
        OutputFormat::Json => serde_json::to_string(value).unwrap_or_default(),
        OutputFormat::Csv => format_csv_page(value, is_first_page),
        OutputFormat::Table => format_table_page(value, is_first_page),
        // Prefix every page with a YAML document separator so that the
        // concatenated stream is parseable as a multi-document YAML file.
        OutputFormat::Yaml => format!("---\n{}", format_yaml(value)),
    }
}

/// Extract a "data array" from a typical Google API list response.
/// Google APIs return lists as `{ "files": [...], "nextPageToken": "..." }`
/// where the array key varies by resource type.
fn extract_items(value: &Value) -> Option<(&str, &Vec<Value>)> {
    if let Value::Object(obj) = value {
        for (key, val) in obj {
            if key == "nextPageToken" || key == "kind" || key.starts_with('_') {
                continue;
            }
            if let Value::Array(arr) = val {
                if !arr.is_empty() {
                    return Some((key, arr));
                }
            }
        }
    }
    None
}

fn format_table(value: &Value) -> String {
    format_table_page(value, true)
}

/// Recursively flatten a JSON object into `(dot.notation.key, string_value)` pairs.
///
/// Nested objects become `parent.child` key names so that `--format table` can
/// render them as individual columns instead of raw JSON blobs.
fn flatten_object(obj: &serde_json::Map<String, Value>, prefix: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for (key, val) in obj {
        let full_key = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        match val {
            Value::Object(nested) => {
                out.extend(flatten_object(nested, &full_key));
            }
            _ => {
                out.push((full_key, value_to_cell(val)));
            }
        }
    }
    out
}

/// Format as a text table, optionally omitting the header row.
///
/// Pass `emit_header = false` for continuation pages when using `--page-all`
/// so the combined terminal output doesn't repeat column names and separator
/// lines between pages.
fn format_table_page(value: &Value, emit_header: bool) -> String {
    // Try to extract a list of items from standard Google API response
    let items = extract_items(value);

    if let Some((_key, arr)) = items {
        format_array_as_table(arr, emit_header)
    } else if let Value::Array(arr) = value {
        format_array_as_table(arr, emit_header)
    } else if let Value::Object(obj) = value {
        // Single object: key/value table — flatten nested objects first
        let mut output = String::new();
        let flat = flatten_object(obj, "");
        let max_key_len = flat.iter().map(|(k, _)| k.len()).max().unwrap_or(0);
        for (key, val_str) in &flat {
            let _ = writeln!(output, "{:width$}  {}", key, val_str, width = max_key_len);
        }
        output
    } else {
        value.to_string()
    }
}

fn format_array_as_table(arr: &[Value], emit_header: bool) -> String {
    if arr.is_empty() {
        return "(empty)\n".to_string();
    }

    // Flatten each row so nested objects become dot-notation columns.
    let flat_rows: Vec<Vec<(String, String)>> = arr
        .iter()
        .map(|item| match item {
            Value::Object(obj) => flatten_object(obj, ""),
            _ => vec![(String::new(), value_to_cell(item))],
        })
        .collect();

    // Collect all unique column names (preserving insertion order).
    let mut columns: Vec<String> = Vec::new();
    for row in &flat_rows {
        for (key, _) in row {
            if !columns.contains(key) {
                columns.push(key.clone());
            }
        }
    }

    if columns.is_empty() {
        // Array of non-objects
        let mut output = String::new();
        for item in arr {
            let _ = writeln!(output, "{}", value_to_cell(item));
        }
        return output;
    }

    // Build lookup: row_index -> column_name -> cell_value
    let row_maps: Vec<std::collections::HashMap<&str, &str>> = flat_rows
        .iter()
        .map(|pairs| {
            pairs
                .iter()
                .map(|(k, v)| (k.as_str(), v.as_str()))
                .collect()
        })
        .collect();

    // Calculate column widths (char-count, not byte-count).
    let mut widths: Vec<usize> = columns.iter().map(|c| c.chars().count()).collect();
    let rows: Vec<Vec<String>> = row_maps
        .iter()
        .map(|row| {
            columns
                .iter()
                .enumerate()
                .map(|(i, col)| {
                    let cell = row.get(col.as_str()).copied().unwrap_or("").to_string();
                    let char_len = cell.chars().count();
                    if char_len > widths[i] {
                        widths[i] = char_len;
                    }
                    // Cap column width at 60 chars
                    if widths[i] > 60 {
                        widths[i] = 60;
                    }
                    cell
                })
                .collect()
        })
        .collect();

    let mut output = String::new();

    if emit_header {
        // Header
        let header: Vec<String> = columns
            .iter()
            .enumerate()
            .map(|(i, c)| format!("{:width$}", c, width = widths[i]))
            .collect();
        let _ = writeln!(output, "{}", header.join("  "));

        // Separator
        let sep: Vec<String> = widths.iter().map(|w| "─".repeat(*w)).collect();
        let _ = writeln!(output, "{}", sep.join("  "));
    }

    // Rows — truncate by char count to avoid panicking on multi-byte UTF-8.
    for row in &rows {
        let cells: Vec<String> = row
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let char_len = c.chars().count();
                let truncated = if char_len > widths[i] {
                    // Safe char-boundary slice: take widths[i]-1 chars, then append ellipsis.
                    let truncated_str: String = c.chars().take(widths[i] - 1).collect();
                    format!("{truncated_str}…")
                } else {
                    c.clone()
                };
                // Pad to column width (by char count)
                let pad = widths[i].saturating_sub(truncated.chars().count());
                format!("{truncated}{}", " ".repeat(pad))
            })
            .collect();
        let _ = writeln!(output, "{}", cells.join("  "));
    }

    output
}

fn format_yaml(value: &Value) -> String {
    json_to_yaml(value, 0)
}

fn json_to_yaml(value: &Value, indent: usize) -> String {
    let prefix = "  ".repeat(indent);
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => {
            if s.contains('\n') {
                // Genuine multi-line content: block scalar is the most readable choice.
                format!(
              
```

### Core Architecture Module: `crates/google-workspace-cli/src/generate_skills.rs`
```
// Copyright 2026 Google LLC
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

//! Generates SKILL.md files from the CLI's own clap metadata.
//!
//! Usage: `gws generate-skills [--output-dir skills/]`

use crate::commands;
use crate::discovery;
use crate::error::GwsError;
use crate::output::sanitize_for_terminal;
use crate::services;
use clap::Command;
use std::path::Path;

const PERSONAS_TOML: &str = include_str!("../registry/personas.toml");
const RECIPES_TOML: &str = include_str!("../registry/recipes.toml");

/// Methods blocked from skill generation.
/// Format: (service_alias, resource, method).
const BLOCKED_METHODS: &[(&str, &str, &str)] = &[
    ("drive", "files", "delete"),
    ("drive", "files", "emptyTrash"),
    ("drive", "drives", "delete"),
    ("drive", "teamdrives", "delete"),
    ("people", "people", "deleteContact"),
    ("people", "people", "batchDeleteContacts"),
];

#[derive(serde::Deserialize)]
struct PersonaRegistry {
    personas: Vec<PersonaEntry>,
}

#[derive(serde::Deserialize)]
struct PersonaEntry {
    name: String,
    title: String,
    description: String,
    services: Vec<String>,
    workflows: Vec<String>,
    instructions: Vec<String>,
    #[serde(default)]
    tips: Vec<String>,
}

#[derive(serde::Deserialize)]
struct RecipeRegistry {
    recipes: Vec<RecipeEntry>,
}

#[derive(serde::Deserialize)]
struct RecipeEntry {
    name: String,
    title: String,
    description: String,
    category: String,
    services: Vec<String>,
    steps: Vec<String>,
    caution: Option<String>,
}

struct SkillIndexEntry {
    name: String,
    description: String,
    category: String,
}

/// Entry point for `gws generate-skills`.
pub async fn handle_generate_skills(args: &[String]) -> Result<(), GwsError> {
    let output_dir = parse_output_dir(args);
    // Validate output_dir to prevent path traversal
    let output_path_buf = crate::validate::validate_safe_output_dir(&output_dir)?;
    let output_path = output_path_buf.as_path();
    let filter = parse_filter(args);
    let mut index: Vec<SkillIndexEntry> = Vec::new();

    // Generate gws-shared skill if no filter or "shared" is in the filter
    if filter
        .as_ref()
        .is_none_or(|f| "shared".contains(f.as_str()))
    {
        generate_shared_skill(output_path)?;
        index.push(SkillIndexEntry {
            name: "gws-shared".to_string(),
            description:
                "gws CLI: Shared patterns for authentication, global flags, and output formatting."
                    .to_string(),
            category: "service".to_string(),
        });
    }

    for entry in services::SERVICES {
        let alias = entry.aliases[0];

        let skill_name = format!("gws-{alias}");

        eprintln!(
            "Generating skills for {alias} ({}/{})...",
            entry.api_name, entry.version
        );

        // Synthetic services (no Discovery doc) use an empty RestDescription
        let doc = if entry.api_name == "workflow" {
            discovery::RestDescription {
                name: "workflow".to_string(),
                title: Some("Workflow".to_string()),
                description: Some(entry.description.to_string()),
                ..Default::default()
            }
        } else {
            // Fetch discovery doc
            match discovery::fetch_discovery_document(entry.api_name, entry.version).await {
                Ok(d) => d,
                Err(e) => {
                    eprintln!(
                        "  WARNING: Failed to fetch discovery doc for {alias}: {}",
                        sanitize_for_terminal(&e.to_string())
                    );
                    continue;
                }
            }
        };

        // Derive product name from Discovery title (e.g. "Google Drive API" -> "Google Drive")
        let product_name = product_name_from_title(doc.title.as_deref().unwrap_or(alias));

        // Build the CLI tree (includes helpers)
        let cli = commands::build_cli(&doc);

        // Collect helper commands (start with '+') and resource commands
        let mut helpers = Vec::new();
        let mut resources = Vec::new();

        for sub in cli.get_subcommands() {
            let name = sub.get_name();
            if name.starts_with('+') {
                helpers.push(sub);
            } else {
                resources.push(sub);
            }
        }

        // Generate service-level skill (only if service itself is in the filter, or no filter)
        let emit_service = match filter {
            Some(ref f) => alias.contains(f.as_str()),
            None => true,
        };
        if emit_service {
            let service_md =
                render_service_skill(alias, entry, &helpers, &resources, &product_name, &doc);
            write_skill(output_path, &skill_name, &service_md)?;
            index.push(SkillIndexEntry {
                name: skill_name.clone(),
                description: service_description(&product_name, entry.description),
                category: "service".to_string(),
            });
        }

        // Generate per-helper skills
        for helper in &helpers {
            let helper_name = helper.get_name();
            // +triage -> triage
            let short = helper_name.trim_start_matches('+');
            let helper_key = format!("{alias}-{short}");

            let emit_helper = match filter {
                Some(ref f) => helper_key.contains(f.as_str()),
                None => true,
            };
            if emit_helper {
                let helper_skill_name = format!("gws-{helper_key}");
                let about_raw = helper
                    .get_about()
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                let about_clean = about_raw.strip_prefix("[Helper] ").unwrap_or(&about_raw);
                let helper_md =
                    render_helper_skill(alias, helper_name, helper, entry, &product_name);
                write_skill(output_path, &helper_skill_name, &helper_md)?;
                index.push(SkillIndexEntry {
                    name: helper_skill_name,
                    description: truncate_desc(&format!(
                        "{}: {}",
                        product_name,
                        capitalize_first(about_clean)
                    )),
                    category: "helper".to_string(),
                });
            }
        }
    }

    if filter
        .as_ref()
        .is_none_or(|f| "persona".contains(f.as_str()) || "personas".contains(f.as_str()))
    {
        if let Ok(registry) = toml::from_str::<PersonaRegistry>(PERSONAS_TOML) {
            eprintln!(
                "Generating skills for {} personas...",
                registry.personas.len()
            );
            for persona in registry.personas {
                let name = format!("persona-{}", persona.name);
                let emit = match &filter {
                    Some(f) => name.contains(f.as_str()),
                    None => true,
                };
                if emit {
                    let md = render_persona_skill(&persona);
                    write_skill(output_path, &name, &md)?;
                    index.push(SkillIndexEntry {
                        name: name.clone(),
                        description: truncate_desc(&persona.description),
                        category: "persona".to_string(),
                    });
                }
            }
        } else {
            eprintln!("WARNING: Failed to parse personas.toml");
        }
    }

    // Generate Recipes
    if filter
        .as_ref()
        .is_none_or(|f| "recipe".contains(f.as_str()) || "recipes".contains(f.as_str()))
    {
        if let Ok(registry) = toml::from_str::<RecipeRegistry>(RECIPES_TOML) {
            eprintln!(
                "Generating skills for {} recipes...",
                registry.recipes.len()
            );
            for recipe in registry.recipes {
                let name = format!("recipe-{}", recipe.name);
                let emit = match &filter {
                    Some(f) => name.contains(f.as_str()),
                    None => true,
                };
                if emit {
                    let md = render_recipe_skill(&recipe);
                    write_skill(output_path, &name, &md)?;
                    index.push(SkillIndexEntry {
                        name: name.clone(),
                        description: truncate_desc(&recipe.description),
                        category: "recipe".to_string(),
                    });
                }
            }
        } else {
            eprintln!("WARNING: Failed to parse recipes.toml");
        }
    }

    // Write skills index
    if filter.is_none() {
        write_skills_index(&index)?;
    }

    eprintln!("\nDone. Skills written to {output_dir}/");
    Ok(())
}

fn parse_output_dir(args: &[String]) -> String {
    for (i, arg) in args.iter().enumerate() {
        if arg == "--output-dir" {
            if let Some(val) = args.get(i + 1) {
                return val.clone();
            }
        }
    }
    "skills".to_string()
}

/// Parse `--filter <match>` into a substring filter.
fn parse_filter(args: &[String]) -> Option<String> {
    for (i, arg) in args.iter().enumerate() {
        if arg == "--filter" {
            if let Some(val) = args.get(i + 1) {
                return Some(val.trim().to_string());
            }
        }
    }
   
```

### Core Architecture Module: `crates/google-workspace-cli/src/helpers/calendar.rs`
```
// Copyright 2026 Google LLC
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

use super::Helper;
use crate::auth;
use crate::error::GwsError;
use crate::executor;
use clap::{Arg, ArgAction, ArgMatches, Command};
use serde_json::json;
use serde_json::Value;
use std::future::Future;
use std::pin::Pin;

pub struct CalendarHelper;

impl Helper for CalendarHelper {
    fn inject_commands(
        &self,
        mut cmd: Command,
        _doc: &crate::discovery::RestDescription,
    ) -> Command {
        cmd = cmd.subcommand(
            Command::new("+insert")
                .about("[Helper] create a new event")
                .arg(
                    Arg::new("calendar")
                        .long("calendar")
                        .help("Calendar ID (default: primary)")
                        .default_value("primary")
                        .value_name("ID"),
                )
                .arg(
                    Arg::new("summary")
                        .long("summary")
                        .help("Event summary/title")
                        .required(true)
                        .value_name("TEXT"),
                )
                .arg(
                    Arg::new("start")
                        .long("start")
                        .help("Start time (ISO 8601, e.g., 2024-01-01T10:00:00Z)")
                        .required(true)
                        .value_name("TIME"),
                )
                .arg(
                    Arg::new("end")
                        .long("end")
                        .help("End time (ISO 8601)")
                        .required(true)
                        .value_name("TIME"),
                )
                .arg(
                    Arg::new("location")
                        .long("location")
                        .help("Event location")
                        .value_name("TEXT"),
                )
                .arg(
                    Arg::new("description")
                        .long("description")
                        .help("Event description/body")
                        .value_name("TEXT"),
                )
                .arg(
                    Arg::new("attendee")
                        .long("attendee")
                        .help("Attendee email (can be used multiple times)")
                        .value_name("EMAIL")
                        .action(ArgAction::Append),
                )
                .arg(
                    Arg::new("meet")
                        .long("meet")
                        .help("Add a Google Meet video conference link")
                        .action(ArgAction::SetTrue),
                )
                .after_help("\
EXAMPLES:
  gws calendar +insert --summary 'Standup' --start '2026-06-17T09:00:00-07:00' --end '2026-06-17T09:30:00-07:00'
  gws calendar +insert --summary 'Review' --start ... --end ... --attendee alice@example.com
  gws calendar +insert --summary 'Meet' --start ... --end ... --meet

TIPS:
  Use RFC3339 format for times (e.g. 2026-06-17T09:00:00-07:00).
  The --meet flag automatically adds a Google Meet link to the event."),
        );
        cmd = cmd.subcommand(
            Command::new("+agenda")
                .about("[Helper] Show upcoming events across all calendars")
                .arg(
                    Arg::new("today")
                        .long("today")
                        .help("Show today's events")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("tomorrow")
                        .long("tomorrow")
                        .help("Show tomorrow's events")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("week")
                        .long("week")
                        .help("Show this week's events")
                        .action(ArgAction::SetTrue),
                )
                .arg(
                    Arg::new("days")
                        .long("days")
                        .help("Number of days ahead to show")
                        .value_name("N"),
                )
                .arg(
                    Arg::new("calendar")
                        .long("calendar")
                        .help("Filter to specific calendar name or ID")
                        .value_name("NAME"),
                )
                .arg(
                    Arg::new("timezone")
                        .long("timezone")
                        .alias("tz")
                        .help("IANA timezone override (e.g. America/Denver). Defaults to Google account timezone.")
                        .value_name("TZ"),
                )
                .after_help(
                    "\
EXAMPLES:
  gws calendar +agenda
  gws calendar +agenda --today
  gws calendar +agenda --week --format table
  gws calendar +agenda --days 3 --calendar 'Work'
  gws calendar +agenda --today --timezone America/New_York

TIPS:
  Read-only — never modifies events.
  Queries all calendars by default; use --calendar to filter.
  Uses your Google account timezone by default; override with --timezone.",
                ),
        );
        cmd
    }

    fn handle<'a>(
        &'a self,
        doc: &'a crate::discovery::RestDescription,
        matches: &'a ArgMatches,
        _sanitize_config: &'a crate::helpers::modelarmor::SanitizeConfig,
    ) -> Pin<Box<dyn Future<Output = Result<bool, GwsError>> + Send + 'a>> {
        Box::pin(async move {
            if let Some(matches) = matches.subcommand_matches("+insert") {
                let (params_str, body_str, scopes) = build_insert_request(matches, doc)?;

                let scopes_str: Vec<&str> = scopes.iter().map(|s| s.as_str()).collect();
                let (token, auth_method) = match auth::get_token(&scopes_str).await {
                    Ok(t) => (Some(t), executor::AuthMethod::OAuth),
                    Err(_) if matches.get_flag("dry-run") => (None, executor::AuthMethod::None),
                    Err(e) => return Err(GwsError::Auth(format!("Calendar auth failed: {e}"))),
                };

                let events_res = doc.resources.get("events").ok_or_else(|| {
                    GwsError::Discovery("Resource 'events' not found".to_string())
                })?;
                let insert_method = events_res.methods.get("insert").ok_or_else(|| {
                    GwsError::Discovery("Method 'events.insert' not found".to_string())
                })?;

                executor::execute_method(
                    doc,
                    insert_method,
                    Some(&params_str),
                    Some(&body_str),
                    token.as_deref(),
                    auth_method,
                    None,
                    None,
                    matches.get_flag("dry-run"),
                    &executor::PaginationConfig::default(),
                    None,
                    &crate::helpers::modelarmor::SanitizeMode::Warn,
                    &crate::formatter::OutputFormat::default(),
                    false,
                )
                .await?;

                return Ok(true);
            }
            if let Some(matches) = matches.subcommand_matches("+agenda") {
                handle_agenda(matches).await?;
                return Ok(true);
            }
            Ok(false)
        })
    }
}
async fn handle_agenda(matches: &ArgMatches) -> Result<(), GwsError> {
    let cal_scope = "https://www.googleapis.com/auth/calendar.readonly";
    let token = auth::get_token(&[cal_scope])
        .await
        .map_err(|e| GwsError::Auth(format!("Calendar auth failed: {e}")))?;

    let output_format = matches
        .get_one::<String>("format")
        .map(|s| crate::formatter::OutputFormat::from_str(s))
        .unwrap_or(crate::formatter::OutputFormat::Table);

    let client = crate::client::build_client()?;
    let tz_override = matches.get_one::<String>("timezone").map(|s| s.as_str());
    let tz = crate::timezone::resolve_account_timezone(&client, &token, tz_override).await?;

    // Determine time range using the account timezone so that --today and
    // --tomorrow align with the user's Google account day, not the machine.
    let now_in_tz = chrono::Utc::now().with_timezone(&tz);
    let today_start_tz = crate::timezone::start_of_today(tz)?;

    let days: i64 = if matches.get_flag("tomorrow") {
        1
    } else if matches.get_flag("week") {
        7
    } else {
        matches
            .get_one::<String>("days")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(1)
    };

    let (time_min_dt, time_max_dt) = if matches.get_flag("today") {
        // Today: account tz midnight to midnight+1
        let end = today_start_tz + chrono::Duration::days(1);
        (today_start_tz, end)
    } else if matches.get_flag("tomorrow") {
        // Tomorrow: account tz midnight+1 to midnight+2
        let start = today_start_tz + chrono::Duration::days(1);
        let end = today_start_tz + chrono::Duration::days(2);
        (start, end)
    } else {
        // From now, N days ahead
        let end = now_in_tz + chrono::Duration::days(days);
        (now_in_tz, end)
    };

    let time_min = time_min_dt.to_rfc3339();
    let time_max = time_max_dt.to_rfc3339();

    // client already built above for timezone resolution
    let calendar_filter = matches.get_one::<String>(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #948** (2026-10-02): **chore: sync skills with Discovery API**
  *Symptoms*: Automated PR — the Google Discovery API specs have changed and the generated skill files are out of date.  Created by the **Generate Skills** workflow (`generate-skills.yml`).
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: ff8c7fc1a94c8af4e474349ec8424d57283c9a27  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/googleworkspace/cli/new/chore/sync-skills?filename=.changeset/spicy-queens-share.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Achore%3A%20sync%20skills%20with%20Discovery%20API%0A)  
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/googleworkspace/cli/pull/948/checks?check_run_id=108762695894) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > This PR has been inactive for 72 hours. Closing to keep the queue clean.

- **Issue #946** (2026-10-01): **fix(gmail): match message header names case-insensitively**
  *Symptoms*: Fixes #642.  `parse_message_headers` matched on the raw header name, so anything that didn't arrive spelled exactly `From`/`To`/`Cc`/... fell through the match. Exchange/Outlook send `CC` and `MESSAGE-ID`, so `gmail +reply-all` silently dropped the CC list and `gmail +read` handed back `cc: null`. If a message also had a non-canonical `From` or `Message-ID`, parsing failed outright with "Message is missing From header".  Lowercase the name before matching. `get_part_header` in the same file already compares case-insensitively, so this just makes the two agree.  I checked the new test fails on the old code ("Message is missing From header") and passes after. Full gmail suite is green, 236 tests.  One note for reviewers: clippy is currently red on this repo for me on 14 pre-existing spots (`assert_eq!(x, true)` style lints in test code, mostly executor.rs / sheets.rs / main.rs) — none in gmail/mod.rs, and none from this change.
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 0a916d83351290f499f293728aa103fbdb1458d3  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/rootkiller6788/googleworkspace__cli/new/fix-gmail-header-case-insensitive?filename=.changeset/chubby-lines-stick.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Afix(gmail)%3A%20match%20message%20header%20names%20case-insensitively%0A)  
  > This PR has been inactive for 72 hours. Closing to keep the queue clean.
  > This PR was closed because it has been stalled for 72 hours. Feel free to magically reopen it if you want to continue working on it!

- **Issue #945** (2026-09-28): **chore: sync skills with Discovery API**
  *Symptoms*: Automated PR — the Google Discovery API specs have changed and the generated skill files are out of date.  Created by the **Generate Skills** workflow (`generate-skills.yml`).
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: b260e2d63582e69391295d910aae1991ebab6bd8  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/googleworkspace/cli/new/chore/sync-skills?filename=.changeset/tiny-bees-hang.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Achore%3A%20sync%20skills%20with%20Discovery%20API%0A)  
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/googleworkspace/cli/pull/945/checks?check_run_id=106192886937) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > /gemini review

- **Issue #944** (2026-09-20): **docs(skills): document first-time gws setup**
  *Symptoms*: ## Summary  - document CLI and selective skill installation, including the required `gws-shared` dependency - add the first-time `gcloud` and `gws auth setup` flow, including Cloud Terms and manual Desktop OAuth recovery steps - document secure client-secret handling, explicit least-privilege Chat scopes, and the Chat-to-Slides scope set used in practice - keep the generated `gws-shared` skill and its Rust generator synchronized, with assertions and a patch changeset  Related to #672. Documents a workaround for #822.  ## Validation  - `quick_validate.py skills/gws-shared` with PyYAML in an isolated uv environment - `git diff --check` - verified the generated shared-skill template matches `skills/gws-shared/SKILL.md`  `cargo fmt` and Rust tests were not run because Cargo is not installed in the local environment.
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 9df60f0c750baeb849c42816e2bd197550f7beab  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/grasskin/cli/new/docs/gws-skill-setup?filename=.changeset/four-buses-show.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Adocs(skills)%3A%20document%20first-time%20gws%20setup%0A)  
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/googleworkspace/cli/pull/944/checks?check_run_id=106140366561) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > Closing because this documentation belongs in the Probie repository rather than upstream.

- **Issue #943** (2026-09-22): **fix: honor explicit version in <api>:<version> syntax for unlisted services**
  *Symptoms*: Re-opening again — both #927 and #940 were auto-closed by the stale-PR bot after 72 hours with zero maintainer activity (not rejected on merits; CLA signed, all real CI green both times). Same commit as before, unchanged. See #927 / #940 for full history/discussion.  @jpoehnelt — tagging you directly since CODEOWNERS lists you for `src/main.rs`, which this PR touches, in case the bot closures meant this never actually reached your queue.  ## Summary `parse_service_and_version` rejected `<api>:<version>` syntax for services not in the hardcoded `SERVICES` table, even though the discovery-based fetch path supports arbitrary API names. This blocked using e.g. `chromepolicy:v1` (Chrome Policy API), which isn't in the table.  Fix: when `resolve_service` fails to find the service in the table but the caller used explicit colon syntax, fall through to using the given API name/version directly instead of erroring.  ## Testing Added 3 unit tests covering: colon syntax for an unlisted service, existing known-service resolution (unchanged), and unknown service without colon syntax still erroring as before. `cargo test`/`clippy`/`fmt` all pass.
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 8e1bed02e089d65cc619c6138e5528fe65361cc1  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/JamCodex685/cli/new/fix/unlisted-service-colon-syntax?filename=.changeset/hip-lions-hope.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Afix%3A%20honor%20explicit%20version%20in%20%3Capi%3E%3A%3Cversion%3E%20syntax%20for%20unlisted%20services%0A)  
  > This PR has been inactive for 72 hours. Closing to keep the queue clean.
  > This PR was closed because it has been stalled for 72 hours. Feel free to magically reopen it if you want to continue working on it!

- **Issue #942** (2026-09-16): **Statically link the MSVC runtime on Windows**
  *Symptoms*: ## Why  The Windows release should start without requiring users to install the Visual C++ Redistributable separately.  ## What changed  Enable Rust's `crt-static` target feature only for Windows MSVC builds. Other targets keep their existing linker behavior.  ## Testing  - `cargo fmt --all -- --check` - `cargo test --locked --workspace` - `cargo xwin build --release --target x86_64-pc-windows-msvc --locked` - `objdump -p gws.exe` shows only Windows system DLL imports, with no `VCRUNTIME*`, `MSVCP*`, `api-ms-win-crt-*`, or `ucrtbase.dll` dependency 
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 2487eb5f162dc65837f2f21b2bd16832345b385a  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/longlho/cli/new/psi/static-msvc-runtime?filename=.changeset/eighty-lights-post.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0AStatically%20link%20the%20MSVC%20runtime%20on%20Windows%0A)  

- **Issue #940** (2026-09-18): **fix: honor explicit version in <api>:<version> syntax for unlisted services**
  *Symptoms*: Reopening as a new PR — the original (#927) was auto-closed by the stale-PR bot after 72 hours of no maintainer activity, not rejected. All CI was green and the CLA was signed before the close. See #927 for full history/discussion.  ## Summary `parse_service_and_version` rejected `<api>:<version>` syntax for services not in the hardcoded `SERVICES` table, even though the discovery-based fetch path supports arbitrary API names. This blocked using e.g. `chromepolicy:v1` (Chrome Policy API), which isn't in the table.  Fix: when `resolve_service` fails to find the service in the table but the caller used explicit colon syntax, fall through to using the given API name/version directly instead of erroring.  ## Testing Added 3 unit tests covering: colon syntax for an unlisted service, existing known-service resolution (unchanged), and unknown service without colon syntax still erroring as before. `cargo test`/`clippy`/`fmt` all pass.
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 8e1bed02e089d65cc619c6138e5528fe65361cc1  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/JamCodex685/cli/new/fix/unlisted-service-colon-syntax?filename=.changeset/great-pugs-jump.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Afix%3A%20honor%20explicit%20version%20in%20%3Capi%3E%3A%3Cversion%3E%20syntax%20for%20unlisted%20services%0A)  
  > This PR has been inactive for 72 hours. Closing to keep the queue clean.
  > This PR was closed because it has been stalled for 72 hours. Feel free to magically reopen it if you want to continue working on it!

- **Issue #939** (2026-09-17): **fix(gmail): add x-goog-user-project header to helpers bypassing executor.rs**
  *Symptoms*: Fixes #843.  `fetch_message_metadata`, `fetch_send_as_identities`, and `fetch_attachment_data` in `crates/google-workspace-cli/src/helpers/gmail/mod.rs` all call `gmail.googleapis.com` directly and only set `.bearer_auth(token)`, so an ADC caller with no explicit quota project gets a 403 `accessNotConfigured`. `executor.rs` already handles this correctly via `auth::get_quota_project()` for standard resource commands; this applies the same pattern to the three Gmail helpers that bypass it.  This is a superset of the issue title: `fetch_message_metadata` is shared by `+read`, `+forward`, and `+reply`, and I found the identical bug in `fetch_send_as_identities` (used by From-header resolution) and `fetch_attachment_data` (original-attachment forwarding) in the same file, which the issue's own suggested fix called out as in scope ("and other helper functions that bypass executor.rs"). Other `.bearer_auth`-only call sites exist in `calendar.rs`, `events/*.rs`, `workflows.rs`, `gmail/watch.rs`, and `gmail/triage.rs`, but those hit different Google APIs (Calendar, Pub/Sub, Workspace Events) with potentially different quota-project requirements, so I left them out of this PR.  Verified `cargo test` (709 passing) and `cargo clippy -- -D warnings` clean on the changed file; there's one pre-existing clippy failure in `helpers/script.rs` unrelated to this change that reproduces on unmodified `main` too.
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: d515881a007349ab8733f3aa771a30d33f1d5b97  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @googleworkspace/cli | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/mittalpk/cli/new/fix/gmail-inline-actions-quota-project-header?filename=.changeset/smart-ads-watch.md&value=---%0A%22%40googleworkspace%2Fcli%22%3A%20patch%0A---%0A%0Afix(gmail)%3A%20add%20x-goog-user-project%20header%20to%20helpers%20bypassing%20executor.rs%0A)  
  > This PR has been inactive for 72 hours. Closing to keep the queue clean.
  > This PR was closed because it has been stalled for 72 hours. Feel free to magically reopen it if you want to continue working on it!

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

### Incident Patch 1: `6ccbb426` (2026-03-31)
**Commit Message**: fix: auto-install binary on run if missing (#654)

* fix: auto-install binary on run if missing

pnpm skips postinstall when the package is already cached/installed.
This commit ensures run.js will auto-trigger install.js if the
binary is missing, fixing the 'gws binary not found' error.

* chore: add changeset for pnpm binary fix

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>

**File**: `.changeset/fix-pnpm-binary-install.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@googleworkspace/cli": patch
+---
+
+fix: auto-install binary on run if missing
+
+pnpm skips postinstall when the package is already up to date.
+This ensures run.js will auto-trigger install.js if the
+binary is missing, fixing the 'gws binary not found' error.
```

**File**: `npm/run.js` (modified, +8/-2)
```diff
@@ -12,9 +12,15 @@ const binPath = path.join(__dirname, "bin", platform.binary);
 
 if (!fs.existsSync(binPath)) {
   console.error(
-    `gws binary not found at ${binPath}\nRun "npm install -g @googleworkspace/cli" to install it.`,
+    `gws binary not found at ${binPath}\nAuto-installing...`
   );
-  process.exit(1);
+  const install = spawnSync(process.execPath, [path.join(__dirname, "install.js")], {
+    cwd: __dirname,
+    stdio: "inherit",
+  });
+  if (install.status !== 0) {
+    process.exit(install.status ?? 1);
+  }
 }
 
 const result = spawnSync(binPath, process.argv.slice(2), {
```

---

### Incident Patch 2: `158f93af` (2026-03-31)
**Commit Message**: fix: verify SHA256 checksum in npm postinstall script (#650)

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>

**File**: `.changeset/npm-sha256-verify.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+Verify SHA256 checksum of downloaded binary in npm postinstall script
```

**File**: `npm/install.js` (modified, +18/-0)
```diff
@@ -2,6 +2,7 @@
 
 "use strict";
 
+const crypto = require("crypto");
 const fs = require("fs");
 const path = require("path");
 const os = require("os");
@@ -130,6 +131,23 @@ async function install() {
     console.error(`Downloading gws from ${url}`);
     await download(url, tmpFile);
 
+    // Verify SHA256 checksum
+    const sha256Url = `${url}.sha256`;
+    const sha256File = `${tmpFile}.sha256`;
+    console.error(`Verifying checksum from ${sha256Url}`);
+    await download(sha256Url, sha256File);
+
+    const expectedHash = fs.readFileSync(sha256File, "utf8").trim().split(/\s+/)[0].toLowerCase();
+    const fileBuffer = fs.readFileSync(tmpFile);
+    const actualHash = crypto.createHash("sha256").update(fileBuffer).digest("hex").toLowerCase();
+
+    if (actualHash !== expectedHash) {
+      throw new Error(
+        `SHA256 checksum mismatch!\n  Expected: ${expectedHash}\n  Actual:   ${actualHash}\nThe downloaded binary may have been tampered with.`,
+      );
+    }
+    console.error("Checksum verified ✓");
+
     console.error(`Extracting to ${INSTALL_DIR}`);
     extract(tmpFile, INSTALL_DIR);
 
```

---

### Incident Patch 3: `86c08cfc` (2026-03-31)
**Commit Message**: fix: remove cargo-dist, use native fetch for npm installer (#646)

* chore: remove cargo-dist, use native fetch for npm installer

* fix: harden npm scripts — spawnSync, signal handling, binary-exists check

* fix: address PR review comments

- Add null body guard for fetch response
- Fix PowerShell Expand-Archive path quoting vulnerability
- Sanitize error output to prevent ANSI escape injection
- Add proxy support limitation note
- Fix upgrade bug: use .version marker so npm update downloads new binary
- Downgrade changeset from minor to patch (chore, not feature)
- Update AGENTS.md: remove stale cargo-dist reference from labels

* fix: use flat archives for consistent tar/zip extraction

Both tar.gz and zip archives now contain files at root (no nested
directory). Removes --strip-components 1 from install.js since it is
no longer needed. This makes extraction consistent across platforms.

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>

**File**: `.changeset/remove-cargo-dist.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@googleworkspace/cli": patch
+---
+
+Remove cargo-dist; use native Node.js fetch for npm binary installer
+
+Replaces the cargo-dist generated release pipeline and npm package with:
+- A custom GitHub Actions release workflow with matrix cross-compilation
+- A zero-dependency npm installer using native `fetch()` (Node 18+)
+- Removes axios, rimraf, detect-libc, console.table, and axios-proxy-builder dependencies from the published npm package
```

**File**: `.github/workflows/release.yml` (modified, +131/-296)
```diff
@@ -1,359 +1,194 @@
-# This file was autogenerated by dist: https://axodotdev.github.io/cargo-dist
+# Release workflow for @googleworkspace/cli
 #
-# Copyright 2022-2024, axodotdev
-# SPDX-License-Identifier: MIT or Apache-2.0
-#
-# CI that:
-#
-# * checks for a Git Tag that looks like a release
-# * builds artifacts with dist (archives, installers, hashes)
-# * uploads those artifacts to temporary workflow zip
-# * on success, uploads the artifacts to a GitHub Release
-#
-# Note that the GitHub Release will be created with a generated
-# title/body based on your changelogs.
+# Triggered by pushing a semver tag (e.g. v0.22.3).
+# Builds platform binaries, creates a GitHub Release, publishes to npm and crates.io.
 
 name: Release
 permissions:
-  "contents": "write"
+  contents: write
+  attestations: write
+  id-token: write
 
-# This task will run whenever you push a git tag that looks like a version
-# like "1.0.0", "v0.1.0-prerelease.1", "my-app/0.1.0", "releases/v1.0.0", etc.
-# Various formats will be parsed into a VERSION and an optional PACKAGE_NAME, where
-# PACKAGE_NAME must be the name of a Cargo package in your workspace, and VERSION
-# must be a Cargo-style SemVer Version (must have at least major.minor.patch).
-#
-# If PACKAGE_NAME is specified, then the announcement will be for that
-# package (erroring out if it doesn't have the given version or isn't dist-able).
-#
-# If PACKAGE_NAME isn't specified, then the announcement will be for all
-# (dist-able) packages in the workspace with that version (this mode is
-# intended for workspaces with only one dist-able package, or with all dist-able
-# packages versioned/released in lockstep).
-#
-# If you push multiple tags at once, separate instances of this workflow will
-# spin up, creating an independent announcement for each one. However, GitHub
-# will hard limit this to 3 tags per commit, as it will assume more tags is a
-# mistake.
-#
-# If there's a prerelease-style suffix to the version, then the release(s)
-# will be marked as a prerelease.
 on:
   pull_request:
   push:
     tags:
-      - '**[0-9]+.[0-9]+.[0-9]+*'
+      - 'v[0-9]+.[0-9]+.[0-9]+*'
+
+env:
+  CARGO_TERM_COLOR: always
 
 jobs:
-  # Run 'dist plan' (or host) to determine what tasks we need to do
   plan:
-    runs-on: "ubuntu-22.04"
+    runs-on: ubuntu-latest
     outputs:
-      val: ${{ steps.plan.outputs.manifest }}
-      tag: ${{ !github.event.pull_request && github.ref_name || '' }}
-      tag-flag: ${{ !github.event.pull_request && format('--tag={0}', github.ref_name) || '' }}
-      publishing: ${{ !github.event.pull_request }}
-    env:
-      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+      version: ${{ steps.meta.outputs.version }}
+      prerelease: ${{ steps.meta.outputs.prerelease }}
+      publishing: ${{ github.ref_type == 'tag' }}
     steps:
-      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
-        with:
-          persist-credentials: false
-          submodules: recursive
-      - name: Install dist
-        # we specify bash to get pipefail; it guards against the `curl` command
-        # failing. otherwise `sh` won't catch that `curl` returned non-0
-        shell: bash
-        run: "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/axodotdev/cargo-dist/releases/download/v0.31.0/cargo-dist-installer.sh | sh"
-      - name: Cache dist
-        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6
-        with:
-          name: cargo-dist-cache
-          path: ~/.cargo/bin/dist
-      # sure would be cool if github gave us proper conditionals...
-      # so here's a doubly-nested ternary-via-truthiness to try to provide the best possible
-      # functionality based on whether this is a pull_request, and whether it's from a fork.
-      # (PRs run on the *source* but secrets are usually on the *target* -- that's *good*
-      # but also really annoying to build CI around when it needs secrets to work right.)
-      - id: plan
+      - id: meta
         run: |
-          dist ${{ (!github.event.pull_request && format('host --steps=create --tag={0}', github.ref_name)) || 'plan' }} --output-format=json > plan-dist-manifest.json
-          echo "dist ran successfully"
-          cat plan-dist-manifest.json
-          echo "manifest=$(jq -c "." plan-dist-manifest.json)" >> "$GITHUB_OUTPUT"
-      - name: "Upload dist-manifest.json"
-        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6
-        with:
-          name: artifacts-plan-dist-manifest
-          path: plan-dist-manifest.json
+          TAG="${GITHUB_REF_NAME}"
+          VERSION="${TAG#v}"
+          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
+          if [[ "$VERSION" == *-* ]]; then
+            echo "prerelease=true" >> "$GITHUB_OUTPUT"
+          else
+            echo "prerelease=false" >> "$GITHUB_OUTPUT"
+          fi
 
-  # Build and packages all the platform-specific things
-  build-local-artifacts:
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -178,7 +178,7 @@ Use these labels to categorize pull requests and issues:
 - `area: http` — Request execution, URL building, response handling
 - `area: docs` — README, contributing guides, documentation
 - `area: tui` — Setup wizard, picker, input fields
-- `area: distribution` — Nix flake, cargo-dist, npm packaging, install methods
+- `area: distribution` — Nix flake, npm packaging, GitHub Actions release workflow, install methods
 - `area: auth` — OAuth, credentials, multi-account, ADC
 - `area: skills` — AI skill generation and management
 
```

**File**: `dist-workspace.toml` (removed, +0/-44)
```diff
@@ -1,44 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-[workspace]
-members = ["cargo:crates/google-workspace-cli"]
-
-# Config for 'cargo dist'
-[dist]
-# The preferred cargo-dist version to use in CI (Cargo.toml SemVer syntax)
-cargo-dist-version = "0.31.0"
-# CI backends to support
-ci = "github"
-# The installers to generate for each app
-installers = ["shell", "powershell", "npm"]
-# Publish jobs to run
-publish-jobs = ["npm"]
-npm-scope = "@googleworkspace"
-# Enable github attestations
-github-attestations = true
-npm-package = "cli"
-# Target platforms to build apps for (Rust target-triple syntax)
-targets = ["aarch64-apple-darwin", "aarch64-unknown-linux-gnu", "aarch64-unknown-linux-musl", "x86_64-apple-darwin", "x86_64-unknown-linux-gnu", "x86_64-unknown-linux-musl", "x86_64-pc-windows-msvc"]
-# Which actions to run on pull requests
-pr-run-mode = "plan"
-# Don't overwrite release.yml on `cargo dist init` (preserves custom npm registry config)
-allow-dirty = ["ci"]
-# The archive format to use for windows builds (defaults .zip)
-# Using .zip routes through PowerShell's Expand-Archive, which correctly
-# handles Windows paths. Using .tar.gz causes failures in Git Bash because
-# MSYS tar interprets "C:" as a remote host (issue #152).
-windows-archive = ".zip"
-# The archive format to use for non-windows builds (defaults .tar.xz)
-unix-archive = ".tar.gz"
```

**File**: `npm/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Downloaded binary (created during npm postinstall)
+bin/
```

**File**: `npm/install.js` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+#!/usr/bin/env node
+
+"use strict";
+
+const fs = require("fs");
+const path = require("path");
+const os = require("os");
+const { pipeline } = require("stream/promises");
+const { createWriteStream, mkdirSync, rmSync } = require("fs");
+const { spawnSync } = require("child_process");
+const { getPlatform } = require("./platform");
+
+const INSTALL_DIR = path.join(__dirname, "bin");
+
+/**
+ * Get the GitHub release download URL base for the current package version.
+ */
+function getDownloadUrl(artifactName) {
+  const { version } = require("./package.json");
+  return `https://github.com/googleworkspace/cli/releases/download/v${version}/${artifactName}`;
+}
+
+/**
+ * Strip ANSI escape sequences from a string.
+ */
+function sanitize(str) {
+  // eslint-disable-next-line no-control-regex
+  return String(str).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
+}
+
+/**
+ * Download a file using native fetch (Node 18+).
+ *
+ * NOTE: Native fetch does not respect HTTP_PROXY / HTTPS_PROXY environment
+ * variables. If proxy support is needed, consider using the `undici` ProxyAgent
+ * or a Node.js build with proxy support.
+ */
+async function download(url, dest) {
+  const res = await fetch(url, { redirect: "follow" });
+
+  if (!res.ok) {
+    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
+  }
+
+  if (!res.body) {
+    throw new Error(`Failed to download ${url}: Response body is empty`);
+  }
+
+  const fileStream = createWriteStream(dest);
+  // Convert web ReadableStream to Node stream and pipe
+  const { Readable } = require("stream");
+  const nodeStream = Readable.fromWeb(res.body);
+  await pipeline(nodeStream, fileStream);
+}
+
+/**
+ * Run a command and throw on failure.
+ */
+function run(cmd, args) {
+  const result = spawnSync(cmd, args, { stdio: "pipe" });
+  if (result.error) {
+    throw new Error(`Failed to run ${cmd}: ${result.error.message}`);
+  }
+  if ((result.status ?? 1) !== 0) {
+    const stderr = result.stderr ? result.stderr.toString() : "";
+    throw new Error(
+      `Command failed: ${cmd} ${args.join(" ")}\n${stderr}`,
+    );
+  }
+}
+
+/**
+ * Extract the archive to the install directory.
+ */
+function extract(archivePath, destDir) {
+  const isZip = archivePath.endsWith(".zip");
+  const isTar = archivePath.includes(".tar.");
+
+  if (isTar) {
+    run("tar", ["xf", archivePath, "-C", destDir]);
+  } else if (isZip) {
+    if (process.platform === "win32") {
+      // Use single-quoted PowerShell strings with doubled single-quote escaping
+      // to safely handle paths containing spaces and special characters.
+      const psArchive = archivePath.replace(/'/g, "''");
+      const psDest = destDir.replace(/'/g, "''");
+      run("powershell.exe", [
+        "-NoProfile",
+        "-NonInteractive",
+        "-Command",
+        `Expand-Archive -LiteralPath '${psArchive}' -DestinationPath '${psDest}' -Force`,
+      ]);
+    } else {
+      run("unzip", ["-q", "-o", archivePath, "-d", destDir]);
+    }
+  } else {
+    throw new Error(`Unsupported archive format: ${archivePath}`);
+  }
+}
+
+async function install() {
+  const platform = getPlatform();
+  const { version } = require("./package.json");
+  const url = getDownloadUrl(platform.artifact);
+
+  // Check if the correct version is already installed
+  const binPath = path.join(INSTALL_DIR, platform.binary);
+  const versionFile = path.join(INSTALL_DIR, ".version");
+  if (fs.existsSync(binPath) && fs.existsSync(versionFile)) {
+    const installed = fs.readFileSync(versionFile, "utf8").trim();
+    if (installed === version) {
+      console.error(`gws v${version} is already installed, skipping.`);
+      return;
+    }
+    console.error(`Upgrading gws from v${installed} to v${version}`);
+  }
+
+  // Clean and create install directory
+  if (fs.existsSync(INSTALL_DIR)) {
+    rmSync(INSTALL_DIR, { recursive: true, force: true });
+  }
+  mkdirSync(INSTALL_DIR, { recursive: true });
+
+  // Download to a temp file
+  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gws-"));
+  const archiveName = path.basename(platform.artifact);
+  const tmpFile = path.join(tmpDir, archiveName);
+
+  try {
+    console.error(`Downloading gws from ${url}`);
+    await download(url, tmpFile);
+
+    console.error(`Extracting to ${INSTALL_DIR}`);
+    extract(tmpFile, INSTALL_DIR);
+
+    // Make binary executable on Unix
+    if (process.platform !== "win32") {
+      fs.chmodSync(binPath, 0o755);
+    }
+
+    console.error(`gws v${version} has been installed!`);
+    fs.writeFileSync(versionFile, version);
+  } finally {
+    // Clean up temp files
+    rmSync(tmpDir, { recursive: true, force: true });
+  }
+}
+
+install().catch((err) => {
+  console.error(`Error installing gws: ${sanitize(err.message)}`);
+  process.exit(1);
+});
```

**File**: `npm/package.json` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+{
+  "name": "@googleworkspace/cli",
+  "description": "Google Workspace CLI — dynamic command surface from Discovery Service",
+  "version": "0.22.3",
+  "license": "Apache-2.0",
+  "author": "Justin Poehnelt",
+  "repository": {
+    "type": "git",
+    "url": "https://github.com/googleworkspace/cli.git"
+  },
+  "homepage": "https://github.com/googleworkspace/cli",
+  "bugs": {
+    "url": "https://github.com/googleworkspace/cli/issues"
+  },
+  "bin": {
+    "gws": "run.js"
+  },
+  "scripts": {
+    "postinstall": "node install.js"
+  },
+  "engines": {
+    "node": ">=18"
+  },
+  "preferUnplugged": true,
+  "keywords": [
+    "cli",
+    "google-workspace",
+    "google",
+    "google-api",
+    "google-drive",
+    "google-gmail",
+    "google-sheets",
+    "google-calendar",
+    "google-docs",
+    "google-chat",
+    "google-admin",
+    "gsuite",
+    "discovery-api",
+    "ai-agent",
+    "agent-skills",
+    "automation",
+    "oauth2",
+    "rust"
+  ],
+  "publishConfig": {
+    "provenance": true,
+    "registry": "https://wombat-dressing-room.appspot.com"
+  },
+  "supportedPlatforms": {
+    "aarch64-apple-darwin": {
+      "artifact": "google-workspace-cli-aarch64-apple-darwin.tar.gz",
+      "binary": "gws"
+    },
+    "x86_64-apple-darwin": {
+      "artifact": "google-workspace-cli-x86_64-apple-darwin.tar.gz",
+      "binary": "gws"
+    },
+    "aarch64-unknown-linux-gnu": {
+      "artifact": "google-workspace-cli-aarch64-unknown-linux-gnu.tar.gz",
+      "binary": "gws"
+    },
+    "aarch64-unknown-linux-musl": {
+      "artifact": "google-workspace-cli-aarch64-unknown-linux-musl.tar.gz",
+      "binary": "gws"
+    },
+    "x86_64-unknown-linux-gnu": {
+      "artifact": "google-workspace-cli-x86_64-unknown-linux-gnu.tar.gz",
+      "binary": "gws"
+    },
+    "x86_64-unknown-linux-musl": {
+      "artifact": "google-workspace-cli-x86_64-unknown-linux-musl.tar.gz",
+      "binary": "gws"
+    },
+    "x86_64-pc-windows-msvc": {
+      "artifact": "google-workspace-cli-x86_64-pc-windows-msvc.zip",
+      "binary": "gws.exe"
+    }
+  }
+}
```

**File**: `npm/platform.js` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+#!/usr/bin/env node
+
+"use strict";
+
+const os = require("os");
+const path = require("path");
+const fs = require("fs");
+const { spawnSync } = require("child_process");
+
+const { supportedPlatforms } = require("./package.json");
+
+/**
+ * Map Node.js os.type() and os.arch() to Rust-style target triples.
+ */
+function getPlatformKey() {
+  const rawOs = os.type();
+  const rawArch = os.arch();
+
+  let osType;
+  switch (rawOs) {
+    case "Windows_NT":
+      osType = "pc-windows-msvc";
+      break;
+    case "Darwin":
+      osType = "apple-darwin";
+      break;
+    case "Linux":
+      osType = "unknown-linux-gnu";
+      break;
+    default:
+      throw new Error(`Unsupported operating system: ${rawOs}`);
+  }
+
+  let arch;
+  switch (rawArch) {
+    case "x64":
+      arch = "x86_64";
+      break;
+    case "arm64":
+      arch = "aarch64";
+      break;
+    default:
+      throw new Error(`Unsupported architecture: ${rawArch}`);
+  }
+
+  // On Linux, try to detect musl libc
+  if (rawOs === "Linux") {
+    try {
+      const result = spawnSync("ldd", ["--version"], {
+        encoding: "utf8",
+        stdio: ["pipe", "pipe", "pipe"],
+      });
+      // musl ldd prints version info to stderr
+      const output = (result.stdout || "") + (result.stderr || "");
+      if (output.toLowerCase().includes("musl")) {
+        osType = "unknown-linux-musl";
+      }
+    } catch {
+      // If ldd fails, assume glibc
+    }
+  }
+
+  const key = `${arch}-${osType}`;
+
+  if (!supportedPlatforms[key]) {
+    // Try musl fallback on Linux if glibc binary is not available
+    if (rawOs === "Linux") {
+      const muslKey = `${arch}-unknown-linux-musl`;
+      if (supportedPlatforms[muslKey]) {
+        return muslKey;
+      }
+    }
+    throw new Error(
+      `Unsupported platform: ${key}\nSupported platforms: ${Object.keys(supportedPlatforms).join(", ")}`,
+    );
+  }
+
+  return key;
+}
+
+function getPlatform() {
+  const key = getPlatformKey();
+  return supportedPlatforms[key];
+}
+
+module.exports = { getPlatform, getPlatformKey };
```

---

### Incident Patch 4: `674d53a6` (2026-03-26)
**Commit Message**: fix(ci): add setup-uv step to Lint Skills job

The Lint Skills job uses uvx to run agentskills validate, but uv
is not pre-installed on GitHub Actions runners. Add astral-sh/setup-uv
action and a skills path filter to the changes detection.

**File**: `.changeset/fix-lint-skills-ci.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+Fix `Lint Skills` CI job by installing `uv` via `astral-sh/setup-uv` before running `uvx`
```

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -201,6 +201,9 @@ jobs:
     steps:
       - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
 
+
+      - uses: astral-sh/setup-uv@d4b2f3b6ecc6e67c4457f6d3e41ec42d3d0fcb86 # v5
+
       - name: Validate skills
         run: |
           failed=0
```

---

### Incident Patch 5: `c7c42f6d` (2026-03-25)
**Commit Message**: fix: register script service and fix test path validation

**File**: `.changeset/fix-triage-issues.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+fix: register script service and resolve test path validation errors
```

**File**: `crates/google-workspace-cli/src/helpers/gmail/mod.rs` (modified, +8/-4)
```diff
@@ -3119,7 +3119,8 @@ mod tests {
     #[test]
     fn test_parse_attachments_reads_real_file() {
         use std::io::Write;
-        let dir = tempfile::tempdir_in(".").unwrap();
+        let cwd = std::env::current_dir().unwrap().canonicalize().unwrap();
+        let dir = tempfile::tempdir_in(&cwd).unwrap();
         let file_path = dir.path().join("test.txt");
         let mut f = std::fs::File::create(&file_path).unwrap();
         f.write_all(b"hello world").unwrap();
@@ -3149,7 +3150,8 @@ mod tests {
     #[test]
     fn test_parse_attachments_unknown_extension_falls_back_to_octet_stream() {
         use std::io::Write;
-        let dir = tempfile::tempdir_in(".").unwrap();
+        let cwd = std::env::current_dir().unwrap().canonicalize().unwrap();
+        let dir = tempfile::tempdir_in(&cwd).unwrap();
         let file_path = dir.path().join("data.zzqqxx");
         let mut f = std::fs::File::create(&file_path).unwrap();
         f.write_all(b"unknown format").unwrap();
@@ -3164,7 +3166,8 @@ mod tests {
 
     #[test]
     fn test_parse_attachments_size_limit_accumulates() {
-        let dir = tempfile::tempdir_in(".").unwrap();
+        let cwd = std::env::current_dir().unwrap().canonicalize().unwrap();
+        let dir = tempfile::tempdir_in(&cwd).unwrap();
 
         // Create two files whose combined size exceeds MAX_TOTAL_ATTACHMENT_BYTES
         let file1 = dir.path().join("big1.bin");
@@ -3191,7 +3194,8 @@ mod tests {
 
     #[test]
     fn test_parse_attachments_rejects_empty_file() {
-        let dir = tempfile::tempdir_in(".").unwrap();
+        let cwd = std::env::current_dir().unwrap().canonicalize().unwrap();
+        let dir = tempfile::tempdir_in(&cwd).unwrap();
         let file_path = dir.path().join("empty.txt");
         std::fs::write(&file_path, b"").unwrap();
 
```

**File**: `crates/google-workspace/src/services.rs` (modified, +6/-0)
```diff
@@ -130,6 +130,12 @@ pub const SERVICES: &[ServiceEntry] = &[
         version: "v1",
         description: "Cross-service productivity workflows",
     },
+    ServiceEntry {
+        aliases: &["script"],
+        api_name: "script",
+        version: "v1",
+        description: "Manage Google Apps Script projects",
+    },
 ];
 
 /// Resolves a service alias to (api_name, version).
```

---

### Incident Patch 6: `19ddc259` (2026-03-24)
**Commit Message**: fix: move data files into CLI crate for crates.io publishing (#620)

* fix: move registry/ and templates/ into CLI crate for cargo publish

* chore: regenerate skills [skip ci]

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>
Co-authored-by: googleworkspace-bot <[REDACTED_EMAIL]>

**File**: `crates/google-workspace-cli/src/generate_skills.rs` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ use crate::services;
 use clap::Command;
 use std::path::Path;
 
-const PERSONAS_YAML: &str = include_str!("../../../registry/personas.yaml");
-const RECIPES_YAML: &str = include_str!("../../../registry/recipes.yaml");
+const PERSONAS_YAML: &str = include_str!("../registry/personas.yaml");
+const RECIPES_YAML: &str = include_str!("../registry/recipes.yaml");
 
 /// Methods blocked from skill generation.
 /// Format: (service_alias, resource, method).
```

**File**: `crates/google-workspace-cli/src/helpers/modelarmor.rs` (modified, +1/-1)
```diff
@@ -430,7 +430,7 @@ fn load_preset_template(name: &str) -> Result<String, GwsError> {
 
     // Fallback: embedded preset
     eprintln!("Template file not found, using embedded '{}' preset", name);
-    Ok(include_str!("../../../../templates/modelarmor/jailbreak.json").to_string())
+    Ok(include_str!("../../templates/modelarmor/jailbreak.json").to_string())
 }
 
 #[cfg(test)]
```

**File**: `skills/gws-chat/SKILL.md` (modified, +0/-1)
```diff
@@ -56,7 +56,6 @@ gws chat <resource> <method> [flags]
 
 ### users
 
-  - `sections` — Operations on the 'sections' resource
   - `spaces` — Operations on the 'spaces' resource
 
 ## Discovering Commands
```

---

### Incident Patch 7: `ea0849a6` (2026-03-24)
**Commit Message**: fix: version sync workspace (#615)

**File**: `.changeset/fix-version-sync-workspace.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@googleworkspace/cli": patch
+---
+
+Fix version-sync script and bump CLI crate version to 0.21.0
+
+The `version-sync.sh` script was updating the root `Cargo.toml` which no longer has a `[package]` section after the workspace refactor. Updated to target `crates/google-workspace-cli/Cargo.toml`. Also syncs the CLI crate version to 0.21.0 to match `package.json`.
```

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -896,7 +896,7 @@ dependencies = [
 
 [[package]]
 name = "google-workspace"
-version = "0.1.0"
+version = "0.21.0"
 dependencies = [
  "anyhow",
  "percent-encoding",
@@ -912,7 +912,7 @@ dependencies = [
 
 [[package]]
 name = "google-workspace-cli"
-version = "0.20.1"
+version = "0.21.0"
 dependencies = [
  "aes-gcm",
  "anyhow",
```

**File**: `crates/google-workspace-cli/Cargo.toml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 [package]
 name = "google-workspace-cli"
-version = "0.20.1"
+version = "0.21.0"
 edition = "2021"
 description = "Google Workspace CLI — dynamic command surface from Discovery Service"
 license = "Apache-2.0"
```

**File**: `crates/google-workspace/Cargo.toml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 [package]
 name = "google-workspace"
-version = "0.1.0"
+version = "0.21.0"
 edition = "2021"
 description = "Google Workspace API client — Discovery Document types, service registry, and HTTP utilities"
 license = "Apache-2.0"
```

**File**: `scripts/version-sync.sh` (modified, +14/-9)
```diff
@@ -1,5 +1,6 @@
 #!/usr/bin/env bash
-# Syncs the version from package.json into Cargo.toml, updates Cargo.lock, and regenerates skills.
+# Syncs the version from package.json into all workspace Cargo.toml files,
+# updates Cargo.lock, and regenerates skills.
 # Used by changesets/action as a custom version command.
 set -euo pipefail
 
@@ -9,14 +10,17 @@ pnpm changeset version
 # Read the new version from package.json
 VERSION=$(node -p "require('./package.json').version")
 
-# Update Cargo.toml version field
+# Update version in all workspace crate Cargo.toml files
 # Uses awk to only change the version under [package], not other sections
-awk -v ver="$VERSION" '
-  /^\[package\]/ { in_pkg=1 }
-  /^\[/ && !/^\[package\]/ { in_pkg=0 }
-  in_pkg && /^version = / { $0 = "version = \"" ver "\"" }
-  { print }
-' Cargo.toml > Cargo.toml.tmp && mv Cargo.toml.tmp Cargo.toml
+for cargo_toml in crates/*/Cargo.toml; do
+  tmp=$(mktemp)
+  awk -v ver="$VERSION" '
+    /^\[package\]/ { in_pkg=1 }
+    /^\[/ && !/^\[package\]/ { in_pkg=0 }
+    in_pkg && /^version = / { $0 = "version = \"" ver "\"" }
+    { print }
+  ' "$cargo_toml" > "$tmp" && mv "$tmp" "$cargo_toml"
+done
 
 # Update Cargo.lock to match
 cargo generate-lockfile
@@ -30,4 +34,5 @@ fi
 cargo run -- generate-skills --output-dir skills
 
 # Stage the changed files so changesets/action commits them
-git add Cargo.toml Cargo.lock flake.nix flake.lock skills/
+git add crates/*/Cargo.toml Cargo.lock flake.nix flake.lock skills/
+
```

---

### Incident Patch 8: `2ddb46e3` (2026-03-24)
**Commit Message**: test(gmail): add regression tests for RFC 2822 display name quoting (#610)

The original bug from #513 (display names with commas/parens causing
'Invalid To header') was already fixed by the mail-builder migration
in #482. This adds explicit regression tests to prevent regressions.

Closes #513

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>

**File**: `.changeset/rfc2822-display-name-quoting.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+test(gmail): add regression tests for RFC 2822 display name quoting
```

**File**: `src/helpers/gmail/mod.rs` (modified, +35/-0)
```diff
@@ -2675,6 +2675,41 @@ mod tests {
         assert_eq!(named.to_string(), "Alice <alice@example.com>");
     }
 
+    /// Regression test for PR #513: display names with RFC 2822 special characters
+    /// (commas, parens, colons, etc.) must be properly quoted in the To: header
+    /// so Gmail does not reject them with "Invalid To header".
+    #[test]
+    fn test_rfc2822_display_name_quoting_via_mail_builder() {
+        let test_cases = [
+            ("Anderson, Rich (CORP)", "rich@example.com", "comma/parens"),
+            ("Dr. Smith: Chief", "smith@example.com", "colon"),
+            ("O'Brien & Co.", "ob@example.com", "dot/ampersand"),
+        ];
+
+        for (name, email, description) in test_cases {
+            let m = Mailbox {
+                name: Some(name.to_string()),
+                email: email.to_string(),
+            };
+            let raw = mail_builder::MessageBuilder::new()
+                .to(to_mb_address(&m))
+                .subject("test")
+                .text_body("body")
+                .write_to_string()
+                .unwrap();
+            let to_line = raw
+                .lines()
+                .find(|l| l.starts_with("To:"))
+                .unwrap_or_else(|| panic!("No To: header for case: {description}"));
+
+            let quoted = format!("\"{name}\"");
+            assert!(
+                to_line.contains(&quoted) || to_line.contains("=?utf-8?"),
+                "Display name with {description} must be quoted: {to_line}"
+            );
+        }
+    }
+
     #[test]
     fn test_strip_angle_brackets() {
         assert_eq!(strip_angle_brackets("<abc@example.com>"), "abc@example.com");
```

---

### Incident Patch 9: `b8fd3d96` (2026-03-24)
**Commit Message**: fix(client): add 10s connect timeout to prevent initial hangs (#608)

* fix(client): add 10s connect timeout to prevent initial hangs

* fix(client): retry on transient connect/timeout errors

* chore: regenerate skills [skip ci]

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>
Co-authored-by: googleworkspace-bot <[REDACTED_EMAIL]>

**File**: `.changeset/http-timeouts.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+fix(client): add 10s connect timeout to prevent hangs on initial connection
```

**File**: `skills/gws-drive/SKILL.md` (modified, +4/-4)
```diff
@@ -70,19 +70,19 @@ gws drive <resource> <method> [flags]
   - `create` — Creates a shared drive. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
   - `get` — Gets a shared drive's metadata by ID. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
   - `hide` — Hides a shared drive from the default view. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
-  - `list` — Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](/workspace/drive/api/guides/search-shareddrives) guide.
+  - `list` — Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives) guide.
   - `unhide` — Restores a shared drive to the default view. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
   - `update` — Updates the metadata for a shared drive. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
 
 ### files
 
   - `copy` — Creates a copy of a file and applies any requested updates with patch semantics. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).
-  - `create` — Creates a file. For more information, see [Create and manage files](/workspace/drive/api/guides/create-file). This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:* `*/*` (Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded.
+  - `create` — Creates a file. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file). This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:* `*/*` (Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded.
   - `download` — Downloads the content of a file. For more information, see [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Operations are valid for 24 hours from the time of creation.
   - `export` — Exports a Google Workspace document to the requested MIME type and returns exported byte content. For more information, see [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Note that the exported content is limited to 10 MB.
   - `generateIds` — Generates a set of file IDs which can be provided in create or copy requests. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).
-  - `get` — Gets a file's metadata or content by ID. For more information, see [Search for files and folders](/workspace/drive/api/guides/search-files). If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive. To download Google Docs, Sheets, and Slides use [`files.export`](/workspace/drive/api/reference/rest/v3/files/export) instead.
-  - `list` — Lists the user's files. For more information, see [Search for files and folders](/workspace/drive/api/guides/search-files). This method accepts the `q` parameter, which is a search query combining one or more search terms. This method returns *all* files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results.
+  - `get` — Gets a file's metadata or content by ID. For more information, see [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files). If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive.
+  - `list` — Lists the user's files. For more information, see [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files). This method accepts the `q` parameter, which is a search query combining one or more search terms. This method retur
```

**File**: `src/client.rs` (modified, +35/-19)
```diff
@@ -1,5 +1,11 @@
 use reqwest::header::{HeaderMap, HeaderValue};
 
+const MAX_RETRIES: u32 = 3;
+/// Maximum seconds to sleep on a 429 Retry-After header. Prevents a hostile
+/// or misconfigured server from hanging the process indefinitely.
+const MAX_RETRY_DELAY_SECS: u64 = 60;
+const CONNECT_TIMEOUT_SECS: u64 = 10;
+
 pub fn build_client() -> Result<reqwest::Client, crate::error::GwsError> {
     let mut headers = HeaderMap::new();
     let name = env!("CARGO_PKG_NAME");
@@ -13,40 +19,50 @@ pub fn build_client() -> Result<reqwest::Client, crate::error::GwsError> {
 
     reqwest::Client::builder()
         .default_headers(headers)
+        .connect_timeout(std::time::Duration::from_secs(CONNECT_TIMEOUT_SECS))
         .build()
         .map_err(|e| {
             crate::error::GwsError::Other(anyhow::anyhow!("Failed to build HTTP client: {e}"))
         })
 }
 
-const MAX_RETRIES: u32 = 3;
-/// Maximum seconds to sleep on a 429 Retry-After header. Prevents a hostile
-/// or misconfigured server from hanging the process indefinitely.
-const MAX_RETRY_DELAY_SECS: u64 = 60;
-
-/// Send an HTTP request with automatic retry on 429 (rate limit) responses.
+/// Send an HTTP request with automatic retry on 429 (rate limit) responses
+/// and transient connection/timeout errors.
 /// Respects the `Retry-After` header; falls back to exponential backoff (1s, 2s, 4s).
 pub async fn send_with_retry(
     build_request: impl Fn() -> reqwest::RequestBuilder,
 ) -> Result<reqwest::Response, reqwest::Error> {
-    for attempt in 0..MAX_RETRIES {
-        let resp = build_request().send().await?;
+    let mut last_err: Option<reqwest::Error> = None;
 
-        if resp.status() != reqwest::StatusCode::TOO_MANY_REQUESTS {
-            return Ok(resp);
+    for attempt in 0..MAX_RETRIES {
+        match build_request().send().await {
+            Ok(resp) => {
+                if resp.status() != reqwest::StatusCode::TOO_MANY_REQUESTS {
+                    return Ok(resp);
+                }
+
+                let header_value = resp
+                    .headers()
+                    .get("retry-after")
+                    .and_then(|v| v.to_str().ok());
+                let retry_after = compute_retry_delay(header_value, attempt);
+                tokio::time::sleep(std::time::Duration::from_secs(retry_after)).await;
+            }
+            Err(e) if e.is_connect() || e.is_timeout() => {
+                // Transient network error — retry with exponential backoff
+                let delay = compute_retry_delay(None, attempt);
+                tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
+                last_err = Some(e);
+            }
+            Err(e) => return Err(e),
         }
-
-        let header_value = resp
-            .headers()
-            .get("retry-after")
-            .and_then(|v| v.to_str().ok());
-        let retry_after = compute_retry_delay(header_value, attempt);
-
-        tokio::time::sleep(std::time::Duration::from_secs(retry_after)).await;
     }
 
     // Final attempt — return whatever we get
-    build_request().send().await
+    match build_request().send().await {
+        Ok(resp) => Ok(resp),
+        Err(e) => Err(last_err.unwrap_or(e)),
+    }
 }
 
 /// Compute the retry delay from a Retry-After header value and attempt number.
```

---

### Incident Patch 10: `203acc7b` (2026-03-24)
**Commit Message**: fix(ci): skip publish-skills on fork PRs where secrets are unavailable (#605)

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>



---

### Incident Patch 11: `4663021b` (2026-03-24)
**Commit Message**: fix(ci): skip publish-skills on fork PRs (#604)

* fix(ci): skip publish-skills on fork PRs where secrets are unavailable

* chore: regenerate skills [skip ci]

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>
Co-authored-by: googleworkspace-bot <[REDACTED_EMAIL]>

**File**: `.github/workflows/publish-skills.yml` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ concurrency:
 
 jobs:
   publish:
+    # Skip fork PRs — secrets (CLAWHUB_TOKEN) are not available
+    if: github.event.pull_request.head.repo.full_name == github.repository || github.event_name != 'pull_request'
     runs-on: ubuntu-latest
     permissions:
       contents: read
```

**File**: `skills/gws-drive/SKILL.md` (modified, +4/-4)
```diff
@@ -70,19 +70,19 @@ gws drive <resource> <method> [flags]
   - `create` — Creates a shared drive. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
   - `get` — Gets a shared drive's metadata by ID. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
   - `hide` — Hides a shared drive from the default view. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
-  - `list` — Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](/workspace/drive/api/guides/search-shareddrives) guide.
+  - `list` — Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives) guide.
   - `unhide` — Restores a shared drive to the default view. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
   - `update` — Updates the metadata for a shared drive. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).
 
 ### files
 
   - `copy` — Creates a copy of a file and applies any requested updates with patch semantics. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).
-  - `create` — Creates a file. For more information, see [Create and manage files](/workspace/drive/api/guides/create-file). This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:* `*/*` (Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded.
+  - `create` — Creates a file. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file). This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:* `*/*` (Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded.
   - `download` — Downloads the content of a file. For more information, see [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Operations are valid for 24 hours from the time of creation.
   - `export` — Exports a Google Workspace document to the requested MIME type and returns exported byte content. For more information, see [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Note that the exported content is limited to 10 MB.
   - `generateIds` — Generates a set of file IDs which can be provided in create or copy requests. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).
-  - `get` — Gets a file's metadata or content by ID. For more information, see [Search for files and folders](/workspace/drive/api/guides/search-files). If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive. To download Google Docs, Sheets, and Slides use [`files.export`](/workspace/drive/api/reference/rest/v3/files/export) instead.
-  - `list` — Lists the user's files. For more information, see [Search for files and folders](/workspace/drive/api/guides/search-files). This method accepts the `q` parameter, which is a search query combining one or more search terms. This method returns *all* files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results.
+  - `get` — Gets a file's metadata or content by ID. For more information, see [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files). If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive.
+  - `list` — Lists the user's files. For more information, see [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files). This method accepts the `q` parameter, which is a search query combining one or more search terms. This method retur
```

---

### Incident Patch 12: `477f5d90` (2026-03-23)
**Commit Message**: docs: add helper command guidelines and anti-patterns (#598)

* docs: add helper command guidelines and anti-patterns

* Apply suggestions from code review

Co-authored-by: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>
Co-authored-by: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>

**File**: `.gemini/style_guide.md` (modified, +4/-0)
```diff
@@ -33,3 +33,7 @@ Examples of scope creep to avoid:
 ## Severity Calibration
 
 Mark issues as **critical** only when they cause data loss, security vulnerabilities, or incorrect behavior under normal conditions. Theoretical failures in infallible system APIs (e.g., `tokio::signal::ctrl_c()` registration) are **low** severity — do not label them critical. Contradicting a prior review suggestion (e.g., suggesting `expect()` then flagging `expect()` as wrong) erodes trust; verify consistency with earlier comments before posting.
+
+## Helper Commands (`+verb`)
+
+Helpers are handwritten commands that provide value Discovery-based commands cannot: multi-step orchestration, format translation, or multi-API composition. **Do not accept helpers that wrap a single API call, add flags to expose data already in the API response, or re-implement Discovery parameters as custom flags.** See [`src/helpers/README.md`](../src/helpers/README.md) for full guidelines and anti-patterns.
```

**File**: `AGENTS.md` (modified, +10/-1)
```diff
@@ -137,7 +137,7 @@ When a user-supplied string is used as a GCP resource identifier (project ID, to
 
 ```rust
 // Validates the string does not contain path traversal segments (`..`), control characters, or URL-breaking characters like `?` and `#`.
-let project = crate::helpers::validate_resource_name(&project_id)?;
+let project = crate::validate::validate_resource_name(&project_id)?;
 let url = format!("https://pubsub.googleapis.com/v1/projects/{}/topics/my-topic", project);
 ```
 
@@ -166,6 +166,15 @@ Use these labels to categorize pull requests and issues:
 - `area: auth` — OAuth, credentials, multi-account, ADC
 - `area: skills` — AI skill generation and management
 
+## Helper Commands (`+verb`)
+
+Helpers are handwritten commands prefixed with `+` that provide value the schema-driven Discovery commands cannot: multi-step orchestration, format translation (e.g., Markdown → Docs JSON), or multi-API composition.
+
+> [!IMPORTANT]
+> **Do NOT add a helper that** wraps a single API call already available via Discovery, adds flags to expose data already in the API response, or re-implements Discovery parameters as custom flags. Helper flags must control orchestration logic — use `--params` and `--format`/`jq` for API parameters and output filtering.
+
+See [`src/helpers/README.md`](src/helpers/README.md) for full guidelines, anti-patterns, and a checklist for new helpers.
+
 ## Environment Variables
 
 ### Authentication
```

**File**: `src/helpers/README.md` (modified, +85/-56)
```diff
@@ -1,66 +1,95 @@
-# Helper Modules
+# Helper Commands (`+verb`) — Guidelines
 
-This directory contains "Helper" implementations that provide high-value, simplified commands for complex Google Workspace API operations.
+## Design Principle
 
-## Philosophy
+The core design of `gws` is **schema-driven**: commands are dynamically generated from Google Discovery Documents at runtime. This avoids maintaining a hardcoded, unbounded argument surface. **Helpers must complement this design, not duplicate it.**
 
-The goal of the `gws` CLI is to provide raw access to the Google Workspace APIs. However, some operations are common but complex to execute via raw API calls (e.g., sending an email, appending a row to a sheet).
+## When a Helper is Justified
 
-**Helper commands should only be added if they offer "High Usefulness":**
+A `+helper` command should exist only when it provides value that Discovery-based commands **cannot**:
 
-*   **Complex Abstraction:** Does it abstract away significant complexity (e.g., MIME encoding, complex JSON structures, multiple API calls)?
-*   **Format Conversion:** Does it handle data format conversions that are tedious for the user?
-*   **Not Just an Alias:** Avoid adding helpers that simply alias a single, straightforward API call.
+| Justification | Example | Why Discovery Can't Do It |
+|---|---|---|
+| **Multi-step orchestration** | `+subscribe` | Creates Pub/Sub topic → subscription → Workspace Events subscription (3 APIs) |
+| **Format translation** | `+write` | Transforms Markdown → Docs `batchUpdate` JSON |
+| **Multi-API composition** | `+triage` | Lists messages then fetches N metadata payloads concurrently |
+| **Complex body construction** | `+send`, `+reply` | Builds RFC 2822 MIME from simple flags |
+| **Multipart upload** | `+upload` | Handles resumable upload protocol with progress |
+| **Workflow recipes** | `+standup-report` | Chains calls across multiple services |
+
+**Litmus test:** Can the user achieve the same result with `gws <service> <resource> <method> --params '{...}'`? If yes, don't add a helper.
+
+## Anti-Patterns
+
+### ❌ Anti-pattern 1: Single API Call Wrapper
+
+If a helper wraps one API call that Discovery already exposes, reject it.
+
+**Real example:** `+revisions` (PR #563) wrapped `gws drive files-revisions list` — same single API call, zero added value.
+
+### ❌ Anti-pattern 2: Unbounded Flag Accumulation
+
+Adding flags to expose data that is already in the API response creates unbounded surface area.
+
+**Real example:** `--thread-id`, `--delivered-to`, `--sent-last` on `+triage` (PR #597) — all three values are already present in the Gmail API response. Agents and users should extract them with `--format` or `jq`, not new flags.
+
+**Why this is harmful:** Every API response contains dozens of fields. If we add a flag for each one, helpers become unbounded maintenance burdens — the exact problem Discovery-driven design solves.
+
+### ❌ Anti-pattern 3: Duplicating Discovery Parameters
+
+Don't re-expose Discovery-defined parameters (e.g., `pageSize`, `fields`, `orderBy`) as custom helper flags. Use `--params` passthrough instead.
+
+## Flag Design Rules
+
+Helper flags must control **orchestration logic**, not API parameters or output fields.
+
+### ✅ Good Flags (control orchestration)
+
+| Flag | Helper | Why It's Good |
+|---|---|---|
+| `--spreadsheet`, `--range` | `+read` | Identifies which resource to operate on |
+| `--to`, `--subject`, `--body` | `+send` | Inputs to MIME construction (format translation) |
+| `--dry-run` | `+subscribe` | Controls whether API calls are actually made |
+| `--subscription` | `+subscribe` | Switches between "create new" vs. "use existing" orchestration path |
+| `--target`, `--project` | `+subscribe` | Required for multi-service resource creation |
+
+### ❌ Bad Flags (expose API response data)
+
+| Flag | Why It's Bad | Alternative |
+|---|---|---|
+| `--thread-id` | Already in API response | `jq '.threadId'` |
+| `--delivered-to` | Already in response headers | `jq '.payload.headers[] | ...'` |
+| `--include-labels` | Output field filtering | `--format` or `jq` |
+
+### Decision Checklist for New Flags
+
+1. Does this flag control **what API call to make** or **how to orchestrate** multiple calls? → ✅ Add it
+2. Does this flag control **what data appears in output**? → ❌ Use `--format`/`jq`
+3. Does this flag duplicate a Discovery parameter? → ❌ Use `--params`
+4. Could the user achieve this with existing flags + post-processing? → ❌ Don't add it
 
 ## Architecture
 
 Helpers are implemented using the `Helper` trait defined in `mod.rs`.
 
-```rust
-pub trait Helper: Send + Sync {
-    fn inject_commands(
-        &self,
-        cmd: Command,
-        doc: &crate::discovery::RestDescription,
-    ) -> Command;
-
-    fn handle<'a>(
-        &'a self,
-        doc: &'a crate::discovery::RestDescription,
-        matches: &'a ArgMatches
-    ) -> Pin<Box<dyn Future<Output = Result<bool, GwsError>> + Se
```

---

### Incident Patch 13: `f1572084` (2026-03-23)
**Commit Message**: fix: use block-style YAML sequences in SKILL.md frontmatter (#580)

Replace flow sequences (bins: ["gws"], skills: [...]) with block-style
sequences in all generated SKILL.md frontmatter templates.

Flow sequences are valid YAML but rejected by strictyaml, which the
Agent Skills reference implementation (agentskills validate) uses to
parse frontmatter. This caused all 93 generated skills to fail
validation.

Also adds unit tests verifying that service, shared, persona, and
recipe skill templates produce block-style sequences only.

Fixes #521

**File**: `.changeset/fix-skill-frontmatter-flow-sequences.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+---
+"@googleworkspace/cli": patch
+---
+
+fix: use block-style YAML sequences in generated SKILL.md frontmatter
+
+Replace flow sequences (`bins: ["gws"]`, `skills: [...]`) with block-style
+sequences (`bins:\n  - gws`) in all generated SKILL.md frontmatter templates.
+
+Flow sequences are valid YAML but rejected by `strictyaml`, which the
+Agent Skills reference implementation (`agentskills validate`) uses to parse
+frontmatter. This caused all 93 generated skills to fail validation.
+
+Fixes #521
```

**File**: `src/generate_skills.rs` (modified, +203/-12)
```diff
@@ -391,7 +391,8 @@ metadata:
   openclaw:
     category: "productivity"
     requires:
-      bins: ["gws"]
+      bins:
+        - gws
     cliHelp: "gws {alias} --help"
 ---
 
@@ -527,7 +528,8 @@ metadata:
   openclaw:
     category: "{category}"
     requires:
-      bins: ["gws"]
+      bins:
+        - gws
     cliHelp: "gws {alias} {cmd_name} --help"
 ---
 
@@ -674,7 +676,8 @@ metadata:
   openclaw:
     category: "productivity"
     requires:
-      bins: ["gws"]
+      bins:
+        - gws
 ---
 
 # gws — Shared Reference
@@ -755,13 +758,13 @@ gws <service> <resource> [sub-resource] <method> [flags]
 fn render_persona_skill(persona: &PersonaEntry) -> String {
     let mut out = String::new();
 
-    // metadata JSON string for skills array
+    // Block-style YAML for skills array
     let required_skills = persona
         .services
         .iter()
-        .map(|s| format!("\"gws-{s}\""))
+        .map(|s| format!("        - gws-{s}"))
         .collect::<Vec<_>>()
-        .join(", ");
+        .join("\n");
 
     let trigger_desc = truncate_desc(&persona.description);
 
@@ -774,8 +777,10 @@ metadata:
   openclaw:
     category: "persona"
     requires:
-      bins: ["gws"]
-      skills: [{skills}]
+      bins:
+        - gws
+      skills:
+{skills}
 ---
 
 # {title}
@@ -829,9 +834,9 @@ fn render_recipe_skill(recipe: &RecipeEntry) -> String {
     let required_skills = recipe
         .services
         .iter()
-        .map(|s| format!("\"gws-{s}\""))
+        .map(|s| format!("        - gws-{s}"))
         .collect::<Vec<_>>()
-        .join(", ");
+        .join("\n");
 
     let trigger_desc = truncate_desc(&recipe.description);
 
@@ -845,8 +850,10 @@ metadata:
     category: "recipe"
     domain: "{category}"
     requires:
-      bins: ["gws"]
-      skills: [{skills}]
+      bins:
+        - gws
+      skills:
+{skills}
 ---
 
 # {title}
@@ -1187,4 +1194,188 @@ mod tests {
     fn test_product_name_from_title_adds_google() {
         assert_eq!(product_name_from_title("Drive API"), "Google Drive");
     }
+
+    /// Extract the YAML frontmatter (between `---` delimiters) from a skill string.
+    fn extract_frontmatter(content: &str) -> &str {
+        let content = content.strip_prefix("---").expect("no opening ---");
+        let (frontmatter, _) = content.split_once("\n---").expect("no closing ---");
+        frontmatter
+    }
+
+    /// Asserts that the frontmatter uses block-style YAML sequences.
+    ///
+    /// Detects flow sequences by checking whether YAML values start with `[`,
+    /// rather than looking for brackets anywhere in a line.  This avoids false
+    /// positives from string values that legitimately contain brackets
+    /// (e.g., `description: 'Note: [INTERNAL] ticket was filed'`).
+    fn assert_block_style_sequences(frontmatter: &str) {
+        for (i, line) in frontmatter.lines().enumerate() {
+            let trimmed = line.trim();
+            // Skip lines that don't look like YAML values (e.g., comments, empty)
+            if trimmed.is_empty() || trimmed.starts_with('#') {
+                continue;
+            }
+            // A YAML flow sequence is "key: [...]". Check the value after `:`.
+            if let Some(colon_pos) = trimmed.find(':') {
+                let value = trimmed[colon_pos + 1..].trim();
+                // A flow sequence is not quoted. A quoted string is a scalar.
+                let is_quoted = value.starts_with('"') || value.starts_with('\'');
+                assert!(
+                    is_quoted || !value.starts_with('['),
+                    "Flow sequence found on line {} of frontmatter: {:?}\n\
+                     Use block-style sequences instead (e.g., `- value`)",
+                    i + 1,
+                    trimmed
+                );
+            }
+        }
+    }
+
+    #[test]
+    fn test_service_skill_frontmatter_uses_block_sequences() {
+        let entry = &services::SERVICES[0]; // first service
+        let doc = crate::discovery::RestDescription {
+            name: entry.api_name.to_string(),
+            title: Some("Test API".to_string()),
+            description: Some(entry.description.to_string()),
+            ..Default::default()
+        };
+        let cli = crate::commands::build_cli(&doc);
+        let helpers: Vec<&Command> = cli
+            .get_subcommands()
+            .filter(|s| s.get_name().starts_with('+'))
+            .collect();
+        let resources: Vec<&Command> = cli
+            .get_subcommands()
+            .filter(|s| !s.get_name().starts_with('+'))
+            .collect();
+        let product_name = product_name_from_title("Test API");
+        let md = render_service_skill(
+            entry.aliases[0],
+            entry,
+            &helpers,
+            &resources,
+            &product_name,
+            &doc,
+        );
+        let fm = extract_frontmatter(&md);
+        assert_block_style_sequences(fm);
+        assert!(
+            fm.contai
```

---

### Incident Patch 14: `d341de29` (2026-03-23)
**Commit Message**: fix(setup): handle --help/-h before launching setup wizard (#592)

* fix(setup): handle --help/-h before launching setup wizard

Check for --help/-h at the top of run_setup() before any work that
requires gcloud. Previously, running 'gws auth setup --help' would
launch the full setup flow.

Fixes #280

* refactor: extract SETUP_USAGE into const per review

* refactor: replace manual setup arg parsing with clap

Use clap::Command for gws auth setup argument parsing instead of manual
while-loop parser. This gives us:
- Automatic --help/-h handling (no manual check needed)
- Proper error messages for unknown flags
- Consistent with other clap usage in the codebase
- Help text stays in sync with actual arguments

* fix: distinguish --help (clean exit) from invalid flags (error)

Change parse_setup_args return type from Result<SetupOptions, ()> to
Result<Option<SetupOptions>, GwsError> so that:
- Ok(Some(opts)) = successful parse
- Ok(None) = --help/--version displayed (clean exit, code 0)
- Err(GwsError) = invalid flags (error exit, non-zero code)

* fix: propagate e.print() IO errors instead of silently ignoring

---------

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>

**File**: `.changeset/fix-setup-help-flag.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+Handle --help/-h in `gws auth setup` before launching the setup wizard, preventing accidental project creation when users just want usage info
```

**File**: `src/setup.rs` (modified, +66/-38)
```diff
@@ -377,33 +377,52 @@ pub struct SetupOptions {
     pub login: bool,
 }
 
-/// Parse setup flags from args.
-pub fn parse_setup_args(args: &[String]) -> SetupOptions {
-    let mut project = None;
-    let mut dry_run = false;
-    let mut login = false;
-    let mut i = 0;
-    while i < args.len() {
-        if args[i] == "--project" && i + 1 < args.len() {
-            project = Some(args[i + 1].clone());
-            i += 2;
-        } else if args[i].starts_with("--project=") {
-            project = Some(args[i].split_once('=').unwrap().1.to_string());
-            i += 1;
-        } else if args[i] == "--dry-run" {
-            dry_run = true;
-            i += 1;
-        } else if args[i] == "--login" {
-            login = true;
-            i += 1;
-        } else {
-            i += 1;
+/// Build the clap Command for `gws auth setup`.
+fn setup_command() -> clap::Command {
+    clap::Command::new("setup")
+        .about("Configure GCP project + OAuth client (requires gcloud)")
+        .arg(
+            clap::Arg::new("project")
+                .long("project")
+                .help("Use a specific GCP project")
+                .value_name("id"),
+        )
+        .arg(
+            clap::Arg::new("login")
+                .long("login")
+                .help("Run `gws auth login` after successful setup")
+                .action(clap::ArgAction::SetTrue),
+        )
+        .arg(
+            clap::Arg::new("dry-run")
+                .long("dry-run")
+                .help("Preview changes without making them")
+                .action(clap::ArgAction::SetTrue),
+        )
+}
+
+/// Parse setup flags from args using clap.
+/// Returns `Ok(Some(opts))` on success, `Ok(None)` if clap handled
+/// `--help`/`--version` (already printed), or `Err` for invalid args.
+pub fn parse_setup_args(args: &[String]) -> Result<Option<SetupOptions>, GwsError> {
+    match setup_command()
+        .try_get_matches_from(std::iter::once("setup".to_string()).chain(args.iter().cloned()))
+    {
+        Ok(matches) => Ok(Some(SetupOptions {
+            project: matches.get_one::<String>("project").cloned(),
+            dry_run: matches.get_flag("dry-run"),
+            login: matches.get_flag("login"),
+        })),
+        Err(e)
+            if e.kind() == clap::error::ErrorKind::DisplayHelp
+                || e.kind() == clap::error::ErrorKind::DisplayVersion =>
+        {
+            e.print().map_err(|io_err| {
+                GwsError::Validation(format!("Failed to print help: {io_err}"))
+            })?;
+            Ok(None)
         }
-    }
-    SetupOptions {
-        project,
-        dry_run,
-        login,
+        Err(e) => Err(GwsError::Validation(e.to_string())),
     }
 }
 
@@ -1599,7 +1618,11 @@ fn prompt_login_after_setup() -> Result<bool, GwsError> {
 
 /// Run the full setup flow. Orchestrates all steps and outputs JSON summary.
 pub async fn run_setup(args: &[String]) -> Result<(), GwsError> {
-    let opts = parse_setup_args(args);
+    // parse_setup_args uses clap, which handles --help / -h automatically.
+    let opts = match parse_setup_args(args)? {
+        Some(opts) => opts,
+        None => return Ok(()), // --help was printed, exit cleanly
+    };
     let dry_run = opts.dry_run;
     let interactive = std::io::IsTerminal::is_terminal(&std::io::stdin()) && !dry_run;
 
@@ -1826,7 +1849,7 @@ mod tests {
 
     #[test]
     fn test_parse_setup_args_empty() {
-        let opts = parse_setup_args(&[]);
+        let opts = parse_setup_args(&[]).unwrap().unwrap();
         assert!(opts.project.is_none());
         assert!(!opts.dry_run);
         assert!(!opts.login);
@@ -1835,39 +1858,44 @@ mod tests {
     #[test]
     fn test_parse_setup_args_with_project() {
         let args = vec!["--project".into(), "my-project".into()];
-        let opts = parse_setup_args(&args);
+        let opts = parse_setup_args(&args).unwrap().unwrap();
         assert_eq!(opts.project.as_deref(), Some("my-project"));
         assert!(!opts.login);
     }
 
     #[test]
     fn test_parse_setup_args_with_project_equals() {
         let args = vec!["--project=my-project".into()];
-        let opts = parse_setup_args(&args);
+        let opts = parse_setup_args(&args).unwrap().unwrap();
         assert_eq!(opts.project.as_deref(), Some("my-project"));
         assert!(!opts.login);
     }
 
     #[test]
-    fn test_parse_setup_args_ignores_unknown() {
-        let args = vec!["--verbose".into(), "--unknown".into()];
-        let opts = parse_setup_args(&args);
-        assert!(opts.project.is_none());
-        assert!(!opts.login);
+    fn test_parse_setup_args_rejects_unknown() {
+        let args = vec!["--verbose".into()];
+        assert!(parse_setup_args(&args).is_err());
+    }
+
+    #[test]
+    fn test_parse_setup_args_help_returns_none() {
+        let args = vec!["--help".into()];
+        // --help triggers display and returns Ok(None) for clean exit
+        assert!(parse_setup_
```

---

### Incident Patch 15: `d6794019` (2026-03-23)
**Commit Message**: fix(auth): prevent mask_secret panic on multi-byte UTF-8 secrets (#591)

Use char-based indexing instead of byte-offset slicing in mask_secret()
to prevent panics when secrets contain multi-byte UTF-8 characters
(accented letters, emoji, CJK, etc.).

Co-authored-by: jpoehnelt-bot <[REDACTED_EMAIL]>

**File**: `.changeset/fix-mask-secret-utf8-panic.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@googleworkspace/cli": patch
+---
+
+Fix `mask_secret` panic on multi-byte UTF-8 secrets by using char-based indexing instead of byte-offset slicing
```

**File**: `src/auth_commands.rs` (modified, +18/-6)
```diff
@@ -22,17 +22,19 @@ use crate::error::GwsError;
 
 /// Mask a secret string by showing only the first 4 and last 4 characters.
 /// Strings with 8 or fewer characters are fully replaced with "***".
+///
+/// Uses char-based indexing (not byte offsets) so multi-byte UTF-8 secrets
+/// never cause a panic.
 fn mask_secret(s: &str) -> String {
     const MASK_PREFIX_LEN: usize = 4;
     const MASK_SUFFIX_LEN: usize = 4;
     const MIN_LEN_FOR_PARTIAL_MASK: usize = MASK_PREFIX_LEN + MASK_SUFFIX_LEN;
 
-    if s.len() > MIN_LEN_FOR_PARTIAL_MASK {
-        format!(
-            "{}...{}",
-            &s[..MASK_PREFIX_LEN],
-            &s[s.len() - MASK_SUFFIX_LEN..]
-        )
+    let char_count = s.chars().count();
+    if char_count > MIN_LEN_FOR_PARTIAL_MASK {
+        let prefix: String = s.chars().take(MASK_PREFIX_LEN).collect();
+        let suffix: String = s.chars().skip(char_count - MASK_SUFFIX_LEN).collect();
+        format!("{prefix}...{suffix}")
     } else {
         "***".to_string()
     }
@@ -2124,6 +2126,16 @@ mod tests {
         assert_eq!(mask_secret("123456789"), "1234...6789");
     }
 
+    #[test]
+    fn mask_secret_multibyte_utf8() {
+        // Multi-byte chars must not panic (previously used byte slicing)
+        assert_eq!(mask_secret("áéíóúñüÁÉÍÓÚ"), "áéíó...ÉÍÓÚ");
+        // Short multi-byte — should fully mask
+        assert_eq!(mask_secret("café"), "***");
+        // Exactly at boundary with multi-byte (9 Greek chars)
+        assert_eq!(mask_secret("αβγδεζηθι"), "αβγδ...ζηθι");
+    }
+
     #[test]
     fn find_unmatched_services_identifies_missing() {
         let scopes = vec![
```

#### Recent Merged Pull Requests:
- **PR #948** (closed): chore: sync skills with Discovery API (@googleworkspace-bot)
- **PR #946** (closed): fix(gmail): match message header names case-insensitively (@rootkiller6788)
- **PR #945** (closed): chore: sync skills with Discovery API (@googleworkspace-bot)
- **PR #944** (closed): docs(skills): document first-time gws setup (@grasskin)
- **PR #943** (closed): fix: honor explicit version in <api>:<version> syntax for unlisted services (@JamCodex685)
- **PR #942** (closed): Statically link the MSVC runtime on Windows (@longlho)
- **PR #940** (closed): fix: honor explicit version in <api>:<version> syntax for unlisted services (@JamCodex685)
- **PR #939** (closed): fix(gmail): add x-goog-user-project header to helpers bypassing executor.rs (@mittalpk)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
