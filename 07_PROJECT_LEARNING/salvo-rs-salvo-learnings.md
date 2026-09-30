# Forensic Learning Record (Deep Inspection): salvo-rs/salvo

> **Canonical Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:01.903Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `salvo-rs/salvo`
- **Description**: A powerful web framework built with a simplified design.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4434 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/acme/src/config.rs`
```
use std::collections::HashMap;
use std::fmt::{self, Debug, Formatter};
use std::io::{Error as IoError, Result as IoResult};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use certon::acme_issuer::CertIssuer;
use certon::crypto::KeyType;
use certon::solvers::Solver;
use certon::storage::Storage;
use certon::{OcspConfig, OnDemandConfig};
use tokio::sync::RwLock;

use super::{ChallengeType, LETS_ENCRYPT_PRODUCTION};

/// ACME configuration.
#[allow(dead_code)]
pub struct AcmeConfig {
    pub(crate) directory_name: String,
    pub(crate) directory_url: String,
    pub(crate) domains: Vec<String>,
    pub(crate) contacts: Vec<String>,
    pub(crate) challenge_type: ChallengeType,
    pub(crate) cache_path: Option<PathBuf>,
    pub(crate) keys_for_http01: Option<Arc<RwLock<HashMap<String, String>>>>,
    pub(crate) before_expired: Duration,
    // --- New certon-powered fields ---
    pub(crate) key_type: KeyType,
    pub(crate) issuers: Option<Vec<Arc<dyn CertIssuer>>>,
    pub(crate) storage: Option<Arc<dyn Storage>>,
    pub(crate) http01_solver: Option<Arc<dyn Solver>>,
    pub(crate) tls_alpn01_solver: Option<Arc<dyn Solver>>,
    pub(crate) dns01_solver: Option<Arc<dyn Solver>>,
    pub(crate) ocsp: OcspConfig,
    pub(crate) on_demand: Option<Arc<OnDemandConfig>>,
    pub(crate) zerossl_api_key: Option<String>,
    pub(crate) agree_to_tos: bool,
}

impl AcmeConfig {
    /// Create an ACME configuration builder.
    #[inline]
    #[must_use]
    pub fn builder() -> Self {
        Self::new()
    }
}

impl Debug for AcmeConfig {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("AcmeConfig")
            .field("directory_name", &self.directory_name)
            .field("directory_url", &self.directory_url)
            .field("domains", &self.domains)
            .field("contacts", &self.contacts)
            .field("challenge_type", &self.challenge_type)
            .field("cache_path", &self.cache_path)
            .field("key_type", &self.key_type)
            .finish()
    }
}

/// ACME configuration builder.
///
/// Provides a fluent API for configuring ACME certificate management.
/// The builder now exposes advanced features from the `certon` crate:
///
/// - **Multiple issuers** via [`add_issuer`](AcmeConfigBuilder::add_issuer).
/// - **DNS-01 challenges** via [`dns01_challenge`](AcmeConfigBuilder::dns01_challenge).
/// - **On-demand TLS** via [`on_demand`](AcmeConfigBuilder::on_demand).
/// - **Key type selection** via [`key_type`](AcmeConfigBuilder::key_type).
/// - **OCSP stapling** via [`ocsp`](AcmeConfigBuilder::ocsp).
/// - **Custom storage** via [`storage`](AcmeConfigBuilder::storage).
/// - **ZeroSSL** via [`zerossl_api_key`](AcmeConfigBuilder::zerossl_api_key).
pub use AcmeConfig as AcmeConfigBuilder;

impl AcmeConfigBuilder {
    #[inline]
    #[must_use]
    pub(crate) fn new() -> Self {
        Self {
            directory_name: "lets_encrypt".to_owned(),
            directory_url: LETS_ENCRYPT_PRODUCTION.to_owned(),
            domains: Vec::new(),
            contacts: Default::default(),
            challenge_type: ChallengeType::TlsAlpn01,
            cache_path: None,
            keys_for_http01: None,
            before_expired: Duration::from_secs(12 * 60 * 60),
            key_type: KeyType::EcdsaP256,
            issuers: None,
            storage: None,
            http01_solver: None,
            tls_alpn01_solver: None,
            dns01_solver: None,
            ocsp: OcspConfig::default(),
            on_demand: None,
            zerossl_api_key: None,
            agree_to_tos: true,
        }
    }

    /// Sets the directory url.
    ///
    /// Defaults to Let's Encrypt production.
    #[inline]
    #[must_use]
    pub fn directory(self, name: impl Into<String>, url: impl Into<String>) -> Self {
        let url = url.into();
        if !url.starts_with("https://") {
            tracing::warn!(
                directory_url = %url,
                "ACME directory URL is not HTTPS; the ACME exchange is not protected against \
                 man-in-the-middle tampering. Use an https:// directory in production."
            );
        }
        Self {
            directory_name: name.into(),
            directory_url: url,
            ..self
        }
    }

    /// Sets domains.
    #[inline]
    #[must_use]
    pub fn domains(mut self, domains: impl Into<Vec<String>>) -> Self {
        self.domains = domains.into();
        self
    }
    /// Add a domain.
    #[inline]
    #[must_use]
    pub fn add_domain(mut self, domain: impl Into<String>) -> Self {
        self.domains.push(domain.into());
        self
    }

    /// Sets contact emails for the ACME account.
    #[inline]
    #[must_use]
    pub fn contacts(mut self, contacts: impl Into<Vec<String>>) -> Self {
        self.contacts = contacts.into();
        self
    }
    /// Add a contact email for the ACME account.
    #[inline]
    #[must_use]
    pub fn add_contact(mut self, contact: impl Into<String>) -> Self {
        self.contacts.push(contact.into());
        self
    }

    /// Sets the challenge type to HTTP-01.
    #[inline]
    #[must_use]
    pub fn http01_challenge(self) -> Self {
        Self {
            challenge_type: ChallengeType::Http01,
            keys_for_http01: Some(Default::default()),
            ..self
        }
    }

    /// Sets the challenge type to TLS-ALPN-01.
    #[inline]
    #[must_use]
    pub fn tls_alpn01_challenge(self) -> Self {
        Self {
            challenge_type: ChallengeType::TlsAlpn01,
            keys_for_http01: None,
            ..self
        }
    }

    /// Sets the challenge type to DNS-01 with a custom DNS provider.
    #[inline]
    #[must_use]
    pub fn dns01_challenge(mut self, solver: Arc<dyn Solver>) -> Self {
        self.challenge_type = ChallengeType::Dns01;
        self.dns01_solver = Some(solver);
        self.keys_for_http01 = None;
        self
    }

    /// Sets the cache path for caching certificates.
    ///
    /// This is not a necessary option. If you do not configure the cache path,
    /// the obtained certificate will be stored in memory and will need to be
    /// obtained again when the server is restarted next time.
    #[inline]
    #[must_use]
    pub fn cache_path(self, path: impl Into<PathBuf>) -> Self {
        Self {
            cache_path: Some(path.into()),
            ..self
        }
    }

    /// Sets the duration before expiry to start certificate renewal.
    #[inline]
    #[must_use]
    pub fn before_expired(self, before_expired: Duration) -> Self {
        Self {
            before_expired,
            ..self
        }
    }

    // ----- New certon-powered options -----

    /// Sets the key type for certificate private keys.
    ///
    /// Defaults to [`KeyType::EcdsaP256`], which is the recommended key type
    /// for newly generated certificates. RSA variants are available for
    /// compatibility, but must be selected explicitly.
    /// Available types: `EcdsaP256`, `EcdsaP384`, `EcdsaP521`, `Rsa2048`,
    /// `Rsa4096`, `Rsa8192`, `Ed25519`.
    #[inline]
    #[must_use]
    pub fn key_type(mut self, key_type: KeyType) -> Self {
        self.key_type = key_type;
        self
    }

    /// Adds a custom certificate issuer.
    ///
    /// Multiple issuers can be added. They will be tried in order until one
    /// succeeds.
    #[must_use]
    pub fn add_issuer(mut self, issuer: Arc<dyn CertIssuer>) -> Self {
        self.issuers.get_or_insert_with(Vec::new).push(issuer);
        self
    }

    /// Sets a custom persistent storage backend.
    ///
    /// By default, a [`certon::FileStorage`] will be created from the `cache_path`
    /// if provided.
    #[inline]
    #[must_use]
    pub fn storage(mut self, storage: Arc<dyn Storage>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Sets the OCSP stapling configuration.
    #[inline]
    #[must_use]
    pub fn ocsp
```

### Core Architecture Module: `crates/acme/src/lib.rs`
```
#![cfg_attr(docsrs, feature(doc_cfg))]
#![cfg_attr(test, allow(clippy::unwrap_used))]
//! Automatic HTTPS/TLS certificate management for Salvo via the ACME protocol.
//!
//! This crate integrates [certon](https://crates.io/crates/certon), a
//! production-grade ACME client, with Salvo's listener/acceptor system.
//!
//! ## Features
//!
//! - **Multiple issuers**: Let's Encrypt, ZeroSSL, or any ACME-compatible CA.
//! - **Multiple challenge types**: HTTP-01, TLS-ALPN-01, DNS-01.
//! - **On-demand TLS**: obtain certificates at handshake time.
//! - **OCSP stapling**: automatic OCSP response fetching and stapling.
//! - **Multiple key types**: ECDSA P-256/P-384/P-521, RSA, Ed25519.
//! - **Persistent storage**: pluggable storage backend via [`Storage`].
//! - **Background renewal**: automatic certificate renewal and OCSP refresh.
//!
//! ## Certificate key type
//!
//! Salvo ACME defaults to [`KeyType::EcdsaP256`] for newly generated
//! certificate private keys. RSA key types remain available for compatibility,
//! but they are explicit opt-in via [`AcmeConfigBuilder::key_type`] or
//! [`AcmeListenerBuilder::key_type`].
//!
//! ## Quick Start - HTTP-01
//!
//! ```ignore
//! use salvo_acme::AcmeListener;
//! use salvo_core::prelude::*;
//!
//! #[handler]
//! async fn hello() -> &'static str {
//!     "Hello World"
//! }
//!
//! #[tokio::main]
//! async fn main() {
//!     let mut router = Router::new().get(hello);
//!     let listener = TcpListener::new("0.0.0.0:443")
//!         .acme()
//!         .cache_path("acme/letsencrypt")
//!         .add_domain("example.com")
//!         .http01_challenge(&mut router);
//!     let acceptor = listener.join(TcpListener::new("0.0.0.0:80")).bind().await;
//!     Server::new(acceptor).serve(router).await;
//! }
//! ```
//!
//! ## Quick Start - TLS-ALPN-01
//!
//! ```ignore
//! use salvo_acme::AcmeListener;
//! use salvo_core::prelude::*;
//!
//! #[handler]
//! async fn hello() -> &'static str {
//!     "Hello World"
//! }
//!
//! #[tokio::main]
//! async fn main() {
//!     let router = Router::new().get(hello);
//!     let acceptor = TcpListener::new("0.0.0.0:443")
//!         .acme()
//!         .cache_path("acme/letsencrypt")
//!         .add_domain("example.com")
//!         .bind().await;
//!     Server::new(acceptor).serve(router).await;
//! }
//! ```

use salvo_core::cfg_feature;

mod config;
mod listener;

use std::collections::HashMap;
use std::sync::Arc;

pub use config::{AcmeConfig, AcmeConfigBuilder};
pub use listener::{AcmeAcceptor, AcmeListenerBuilder};
use salvo_core::conn::tcp::TcpListener;
use salvo_core::http::StatusError;
use salvo_core::{Depot, FlowCtrl, Handler, Request, Response, async_trait};
use tokio::net::ToSocketAddrs;
use tokio::sync::RwLock;

cfg_feature! {
    #![feature = "quinn"]
    pub use listener::AcmeQuinnListener;
}

// ---------------------------------------------------------------------------
// Re-exports from certon for advanced usage
// ---------------------------------------------------------------------------

/// Re-export the entire `certon` crate for advanced configuration.
pub use certon;
pub use certon::{
    AcmeIssuer, AcmeIssuerBuilder, CertCache, CertIssuer, CertManager as CertonConfig,
    CertManagerBuilder as CertonConfigBuilder, CertResolver, Certificate, DistributedSolver,
    Dns01Solver, DnsProvider, FileStorage, Http01Solver, IssuedCertificate, IssuerPolicy, KeyType,
    LETS_ENCRYPT_PRODUCTION, LETS_ENCRYPT_STAGING, MaintenanceConfig, Manager, OcspConfig,
    OnDemandConfig, PreChecker, Revoker, Solver, Storage, TlsAlpn01Solver, ZEROSSL_PRODUCTION,
    ZeroSslIssuer,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Well known ACME challenge path.
pub(crate) const WELL_KNOWN_PATH: &str = "/.well-known/acme-challenge";

/// Challenge type for ACME.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
#[non_exhaustive]
pub enum ChallengeType {
    /// HTTP-01 challenge.
    ///
    /// Reference: <https://letsencrypt.org/docs/challenge-types/#http-01-challenge>
    Http01,
    /// TLS-ALPN-01 challenge.
    ///
    /// Reference: <https://letsencrypt.org/docs/challenge-types/#tls-alpn-01>
    TlsAlpn01,
    /// DNS-01 challenge.
    ///
    /// Reference: <https://letsencrypt.org/docs/challenge-types/#dns-01-challenge>
    Dns01,
}

// ---------------------------------------------------------------------------
// HTTP-01 challenge handler (Salvo Handler implementation)
// ---------------------------------------------------------------------------

/// Handler for HTTP-01 ACME challenges.
///
/// Reads challenge tokens from a shared map that is populated by the ACME
/// issuance flow. This handler should be registered on the router at
/// `/.well-known/acme-challenge/{token}`.
pub struct Http01Handler {
    pub(crate) keys: Arc<RwLock<HashMap<String, String>>>,
}
impl std::fmt::Debug for Http01Handler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Http01Handler").finish()
    }
}

#[async_trait]
impl Handler for Http01Handler {
    async fn handle(
        &self,
        req: &mut Request,
        _depot: &mut Depot,
        res: &mut Response,
        _ctrl: &mut FlowCtrl,
    ) {
        if let Some(token) = req.params().get("token") {
            // First check our local map.
            let keys = self.keys.read().await;
            if let Some(value) = keys.get(token) {
                res.render(value);
                return;
            }
            drop(keys);

            // Fall back to certon's global active challenge map.
            if let Some(value) = certon::solvers::get_active_challenge(token) {
                res.render(value);
                return;
            }

            // Log only the length, not the token itself, so log/APM/SIEM
            // pipelines do not become a credential surface for the ACME
            // challenge flow.
            tracing::error!(
                token_len = token.len(),
                "key not found for ACME challenge token"
            );
            res.render(StatusError::not_found().brief("challenge token not found"));
        } else {
            res.render(StatusError::not_found().brief("missing token"));
        }
    }
}

/// Extension trait for Listener to support ACME.
pub trait AcmeListener {
    /// Enable ACME support for the listener.
    fn acme(self) -> AcmeListenerBuilder<Self>
    where
        Self: Sized;
}

impl<T> AcmeListener for TcpListener<T>
where
    T: ToSocketAddrs + Send + 'static,
{
    fn acme(self) -> AcmeListenerBuilder<Self> {
        AcmeListenerBuilder::new(self)
    }
}

#[cfg(test)]
mod tests {
    use salvo_core::http::StatusCode;
    use salvo_core::prelude::*;
    use salvo_core::test::{ResponseExt, TestClient};

    use super::*;

    #[tokio::test]
    async fn http01_handler_serves_known_token() {
        let keys = Arc::new(RwLock::new(HashMap::from([(
            "known".to_owned(),
            "key-authorization".to_owned(),
        )])));
        let handler = Http01Handler { keys };
        let router = Router::with_path(format!("{WELL_KNOWN_PATH}/{{token}}")).goal(handler);

        let mut response = TestClient::get("http://127.0.0.1/.well-known/acme-challenge/known")
            .send(router)
            .await;

        assert_eq!(response.status_code, Some(StatusCode::OK));
        assert_eq!(response.take_string().await.unwrap(), "key-authorization");
    }

    #[tokio::test]
    async fn http01_handler_rejects_unknown_token() {
        let handler = Http01Handler {
            keys: Arc::new(RwLock::new(HashMap::new())),
        };
        let router = Router::with_path(format!("{WELL_KNOWN_PATH}/{{token}}")).goal(handler);

        let response = TestClient::get("http://127.0.0.1/.well-known/acme-challenge/unknown")
            .send(router)
            .await;

  
```

### Core Architecture Module: `crates/acme/src/listener.rs`
```
use std::fmt::{self, Debug, Formatter};
use std::io::Result as IoResult;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use certon::crypto::KeyType;
use certon::handshake::CertResolver;
use certon::solvers::Solver;
use certon::storage::Storage;
use certon::{AcmeIssuer, FileStorage, OcspConfig, OnDemandConfig, ZeroSslIssuer};
use salvo_core::conn::tcp::{DynTcpAcceptor, TcpCoupler, ToDynTcpAcceptor};
use salvo_core::conn::{Accepted, Acceptor, HandshakeStream, Holding, Listener};
use salvo_core::fuse::ArcFusePolicy;
use salvo_core::http::Version;
use salvo_core::http::uri::Scheme;
use salvo_core::{Result as CoreResult, Router, cfg_feature};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_rustls::TlsAcceptor;
use tokio_rustls::rustls::crypto::CryptoProvider;
use tokio_rustls::rustls::server::ServerConfig;
use tokio_rustls::server::TlsStream;

use super::config::{AcmeConfig, AcmeConfigBuilder};
use super::{ChallengeType, Http01Handler, WELL_KNOWN_PATH};

cfg_feature! {
    #![feature = "quinn"]
    use salvo_core::conn::quinn::QuinnAcceptor;
    use salvo_core::conn::JoinedAcceptor;
    use salvo_core::conn::quinn::QuinnListener;
}

/// ACME TLS-ALPN-01 protocol name.
const ACME_TLS_ALPN_NAME: &[u8] = b"acme-tls/1";

/// Returns the [`CryptoProvider`] used to build the ACME `ServerConfig`.
///
/// Reuses the process level provider when the application installed one, otherwise builds one
/// from this crate's `aws-lc-rs` / `ring` features without installing it globally. Passing the
/// provider explicitly keeps rustls from panicking when feature unification makes both backends
/// available at once. `ring` wins when both are on, matching this crate's default.
fn default_crypto_provider() -> Arc<CryptoProvider> {
    if let Some(provider) = CryptoProvider::get_default() {
        return Arc::clone(provider);
    }

    #[cfg(any(feature = "ring", not(feature = "aws-lc-rs")))]
    {
        Arc::new(tokio_rustls::rustls::crypto::ring::default_provider())
    }
    #[cfg(all(not(feature = "ring"), feature = "aws-lc-rs"))]
    {
        Arc::new(tokio_rustls::rustls::crypto::aws_lc_rs::default_provider())
    }
}

/// A wrapper around an underlying listener which implements ACME.
pub struct AcmeListenerBuilder<T> {
    inner: T,
    config_builder: AcmeConfigBuilder,
    check_duration: Duration,
}

impl<T> Debug for AcmeListenerBuilder<T>
where
    T: Debug,
{
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("AcmeListenerBuilder")
            .field("inner", &self.inner)
            .field("config_builder", &self.config_builder)
            .field("check_duration", &self.check_duration)
            .finish()
    }
}

impl<T> AcmeListenerBuilder<T> {
    /// Create `AcmeListenerBuilder`.
    #[inline]
    #[must_use]
    pub fn new(inner: T) -> Self {
        Self {
            inner,
            config_builder: AcmeConfig::builder(),
            check_duration: Duration::from_secs(10 * 60),
        }
    }

    /// Sets the directory.
    ///
    /// Defaults to Let's Encrypt production.
    #[inline]
    #[must_use]
    pub fn directory(self, name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            config_builder: self.config_builder.directory(name, url),
            ..self
        }
    }

    /// Deprecated alias for [`Self::directory`].
    ///
    /// The `get_` prefix was misleading: this is a setter, not a getter.
    #[deprecated(since = "0.94.0", note = "use `directory` instead")]
    #[inline]
    #[must_use]
    pub fn get_directory(self, name: impl Into<String>, url: impl Into<String>) -> Self {
        self.directory(name, url)
    }

    /// Sets domains.
    #[inline]
    #[must_use]
    pub fn domains(self, domains: impl Into<Vec<String>>) -> Self {
        Self {
            config_builder: self.config_builder.domains(domains),
            ..self
        }
    }

    /// Add a domain.
    #[inline]
    #[must_use]
    pub fn add_domain(self, domain: impl Into<String>) -> Self {
        Self {
            config_builder: self.config_builder.add_domain(domain),
            ..self
        }
    }

    /// Add contact emails for the ACME account.
    #[inline]
    #[must_use]
    pub fn contacts(self, contacts: impl Into<Vec<String>>) -> Self {
        Self {
            config_builder: self.config_builder.contacts(contacts.into()),
            ..self
        }
    }

    /// Add a contact email for the ACME account.
    #[inline]
    #[must_use]
    pub fn add_contact(self, contact: impl Into<String>) -> Self {
        Self {
            config_builder: self.config_builder.add_contact(contact.into()),
            ..self
        }
    }

    /// Create a handler for HTTP-01 challenge.
    #[must_use]
    pub fn http01_challenge(self, router: &mut Router) -> Self {
        let config_builder = self.config_builder.http01_challenge();
        if let Some(keys_for_http01) = &config_builder.keys_for_http01 {
            let handler = Http01Handler {
                keys: keys_for_http01.clone(),
            };
            router.routers.insert(
                0,
                Router::with_path(format!("{WELL_KNOWN_PATH}/{{token}}")).goal(handler),
            );
        } else {
            // `AcmeConfigBuilder::http01_challenge()` always populates
            // `keys_for_http01`, so this branch is an internal invariant violation
            // rather than a user-triggerable error.
            unreachable!("`http01_challenge()` must populate `keys_for_http01`");
        }
        Self {
            config_builder,
            ..self
        }
    }

    /// Create a handler for TLS-ALPN-01 challenge.
    #[inline]
    #[must_use]
    pub fn tls_alpn01_challenge(self) -> Self {
        Self {
            config_builder: self.config_builder.tls_alpn01_challenge(),
            ..self
        }
    }

    /// Configure DNS-01 challenge with a custom solver.
    #[inline]
    #[must_use]
    pub fn dns01_challenge(self, solver: Arc<dyn Solver>) -> Self {
        Self {
            config_builder: self.config_builder.dns01_challenge(solver),
            ..self
        }
    }

    /// Sets the cache path for caching certificates.
    ///
    /// This is not a necessary option. If you do not configure the cache path,
    /// the obtained certificate will be stored in memory and will need to be
    /// obtained again when the server is restarted next time.
    #[inline]
    #[must_use]
    pub fn cache_path(self, path: impl Into<PathBuf>) -> Self {
        Self {
            config_builder: self.config_builder.cache_path(path),
            ..self
        }
    }

    /// Sets the key type for certificate private keys.
    ///
    /// `EcdsaP256` is the default and recommended key type for newly generated
    /// certificates. RSA variants are available for compatibility, but must be
    /// selected explicitly.
    ///
    /// Available types: `EcdsaP256` (default), `EcdsaP384`, `EcdsaP521`,
    /// `Rsa2048`, `Rsa4096`, `Rsa8192`, `Ed25519`.
    #[inline]
    #[must_use]
    pub fn key_type(self, key_type: KeyType) -> Self {
        Self {
            config_builder: self.config_builder.key_type(key_type),
            ..self
        }
    }

    /// Sets the OCSP stapling configuration.
    #[inline]
    #[must_use]
    pub fn ocsp(self, ocsp: OcspConfig) -> Self {
        Self {
            config_builder: self.config_builder.ocsp(ocsp),
            ..self
        }
    }

    /// Configures on-demand TLS.
    #[inline]
    #[must_use]
    pub fn on_demand(self, on_demand: Arc<OnDemandConfig>) -> Self {
        Self {
            config_builder: self.config_builder.on_demand(on_demand),
            ..self
        }
    }

    /// Configures ZeroSSL as an additional issuer.
    #[inline]
    #[must_use]
    pub fn zerossl_api_key(self, api_key: impl Into<String>) -> Self {
        Self {
            config_builder: self.config_builder.zerossl_api_key(api_key),
      
```

### Core Architecture Module: `crates/cache/src/lib.rs`
```
#![cfg_attr(test, allow(clippy::unwrap_used))]
//! Response caching middleware for the Salvo web framework.
//!
//! This middleware intercepts HTTP responses and caches them for subsequent
//! requests, reducing server load and improving response times for cacheable
//! content.
//!
//! # What Gets Cached
//!
//! The cache stores the complete response including:
//! - HTTP status code
//! - Response headers
//! - Response body (except for streaming responses)
//!
//! # Key Components
//!
//! - [`CacheIssuer`]: Determines the cache key for each request
//! - [`CacheStore`]: Backend storage for cached responses
//! - [`Cache`]: The middleware handler
//!
//! # Default Implementations
//!
//! - [`RequestIssuer`]: Generates cache keys from the request URI and method
//! - [`MokaStore`]: High-performance concurrent cache backed by [`moka`]
//!
//! # Example
//!
//! ```ignore
//! use std::time::Duration;
//! use salvo_cache::{Cache, MokaStore, RequestIssuer};
//! use salvo_core::prelude::*;
//!
//! let cache = Cache::new(
//!     MokaStore::builder()
//!         .time_to_live(Duration::from_secs(300))  // Cache for 5 minutes
//!         .build(),
//!     RequestIssuer::default(),
//! );
//!
//! let router = Router::new()
//!     .hoop(cache)
//!     .get(my_expensive_handler);
//! ```
//!
//! # Custom Cache Keys
//!
//! Implement [`CacheIssuer`] to customize cache key generation:
//!
//! ```ignore
//! use salvo_cache::CacheIssuer;
//!
//! struct UserBasedIssuer;
//! impl CacheIssuer for UserBasedIssuer {
//!     type Key = String;
//!
//!     async fn issue(&self, req: &mut Request, depot: &Depot) -> Option<Self::Key> {
//!         // Cache per user + path
//!         let user_id = depot.get::<String>("user_id").ok()?;
//!         Some(format!("{}:{}", user_id, req.uri().path()))
//!     }
//! }
//! ```
//!
//! # Skipping Cache
//!
//! By default, only GET requests are cached. Use the `skipper` method to customize:
//!
//! ```ignore
//! let cache = Cache::new(store, issuer)
//!     .skipper(|req, _depot| req.uri().path().starts_with("/api/"));
//! ```
//!
//! # Concurrent Misses
//!
//! Concurrent misses for the same cache key are coalesced. One request populates
//! the cache, and other in-flight requests reuse the generated cache entry when
//! the response is cacheable. At most [`DEFAULT_MAX_IN_FLIGHT`] distinct cache
//! keys are coalesced at once by default; additional misses bypass coalescing and
//! execute normally until an in-flight slot is released.
//!
//! # Limitations
//!
//! - Streaming responses ([`ResBody::Stream`]) cannot be cached
//! - Error responses are not cached
//!
//! Read more: <https://salvo.rs>
#![doc(html_favicon_url = "https://salvo.rs/favicon-32x32.png")]
#![doc(html_logo_url = "https://salvo.rs/images/logo.svg")]
#![cfg_attr(docsrs, feature(doc_cfg))]

use std::borrow::Borrow;
use std::collections::{HashMap, VecDeque};
use std::error::Error as StdError;
use std::fmt::{self, Debug, Formatter};
use std::hash::Hash;
use std::sync::{Arc, Mutex, MutexGuard};

use bytes::Bytes;
use salvo_core::handler::Skipper;
use salvo_core::http::header::{AUTHORIZATION, CACHE_CONTROL, COOKIE, SET_COOKIE, VARY};
use salvo_core::http::{HeaderMap, ResBody, StatusCode};
use salvo_core::{Depot, Error, FlowCtrl, Handler, Request, Response, async_trait, cfg_feature};
use tokio::sync::Notify;

mod skipper;
pub use skipper::MethodSkipper;

cfg_feature! {
    #![feature = "moka-store"]

    pub mod moka_store;
    pub use moka_store::{MokaStore};
}

/// Issues a cache key for a request, deciding whether the request should be cached.
pub trait CacheIssuer: Send + Sync + 'static {
    /// The key type used to identify a cached entry.
    type Key: Hash + Eq + Send + Sync + 'static;
    /// Issue a key for the request. If it returns `None`, the request will not be cached.
    fn issue(
        &self,
        req: &mut Request,
        depot: &Depot,
    ) -> impl Future<Output = Option<Self::Key>> + Send;
}
impl<F, K> CacheIssuer for F
where
    F: Fn(&mut Request, &Depot) -> Option<K> + Send + Sync + 'static,
    K: Hash + Eq + Send + Sync + 'static,
{
    type Key = K;
    async fn issue(&self, req: &mut Request, depot: &Depot) -> Option<Self::Key> {
        self(req, depot)
    }
}

/// Identify cacheable requests by their URI.
///
/// # Caveats
///
/// The generated key is derived only from the request's scheme, authority,
/// path, query, and (optionally) method. It does **not** include content
/// negotiation headers such as `Accept-Encoding` or `Accept`. If the cached
/// responses vary by those headers — for example when a compression middleware
/// also runs — a client may receive a representation encoded for a different
/// request (e.g. a `gzip` body without `Accept-Encoding: gzip`).
///
/// The cache stores the response produced by the handlers *inside* it (`hoop`s
/// run outer-to-inner and the entry is captured on the way back out), so the
/// negotiating middleware must run **outside** the cache — added to the router
/// *before* the cache hoop — so it re-negotiates on every request, including
/// cache hits. Alternatively, use a custom [`CacheIssuer`] that folds the
/// relevant headers into the key.
///
/// Note that a `Vary` response header is **not** a fix here: the store never
/// evaluates `Vary` at lookup time, so a `Vary` response is never cached (in
/// either `cache_private` mode) — it would otherwise be replayed under the same
/// key regardless of the request's negotiation headers. Fold the relevant headers
/// into a custom [`CacheIssuer`] key instead.
#[derive(Clone, Debug)]
pub struct RequestIssuer {
    use_scheme: bool,
    use_authority: bool,
    use_path: bool,
    use_query: bool,
    use_method: bool,
}
impl Default for RequestIssuer {
    fn default() -> Self {
        Self::new()
    }
}
impl RequestIssuer {
    /// Create a new `RequestIssuer`.
    #[must_use]
    pub fn new() -> Self {
        Self {
            use_scheme: true,
            use_authority: true,
            use_path: true,
            use_query: true,
            use_method: true,
        }
    }
    /// Whether to use the request's URI scheme when generating the key.
    #[must_use]
    pub fn use_scheme(mut self, value: bool) -> Self {
        self.use_scheme = value;
        self
    }
    /// Whether to use the request's URI authority when generating the key.
    #[must_use]
    pub fn use_authority(mut self, value: bool) -> Self {
        self.use_authority = value;
        self
    }
    /// Whether to use the request's URI path when generating the key.
    #[must_use]
    pub fn use_path(mut self, value: bool) -> Self {
        self.use_path = value;
        self
    }
    /// Whether to use the request's URI query when generating the key.
    #[must_use]
    pub fn use_query(mut self, value: bool) -> Self {
        self.use_query = value;
        self
    }
    /// Whether to use the request method when generating the key.
    #[must_use]
    pub fn use_method(mut self, value: bool) -> Self {
        self.use_method = value;
        self
    }
}

impl CacheIssuer for RequestIssuer {
    type Key = String;
    async fn issue(&self, req: &mut Request, _depot: &Depot) -> Option<Self::Key> {
        let mut key = String::with_capacity(req.uri().path().len() + 16);
        if self.use_scheme
            && let Some(scheme) = req.uri().scheme_str()
        {
            key.push_str(scheme);
            key.push_str("://");
        }
        if self.use_authority
            && let Some(authority) = req.uri().authority()
        {
            key.push_str(authority.as_str());
        }
        if self.use_path {
            key.push_str(req.uri().path());
        }
        if self.use_query
            && let Some(query) = req.uri().query()
        {
            key.push('?');
            key.push_str(query);
        }
        if self.use_method {
            key.push('|');
            key.push_str(req.method().as_str());
        }
        Some(k
```

### Core Architecture Module: `crates/cache/src/moka_store.rs`
```
//! Memory store module.
use std::borrow::Borrow;
use std::convert::Infallible;
use std::fmt::{self, Debug, Formatter};
use std::hash::Hash;
use std::sync::Arc;
use std::time::Duration;

use moka::future::Cache as MokaCache;
use moka::future::CacheBuilder as MokaCacheBuilder;
use moka::notification::RemovalCause;

use super::{CacheStore, CachedEntry};

/// A builder for [`MokaStore`].
pub struct Builder<K> {
    inner: MokaCacheBuilder<K, CachedEntry, MokaCache<K, CachedEntry>>,
}

impl<K> Debug for Builder<K> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("Builder").finish()
    }
}
impl<K> Builder<K>
where
    K: Hash + Eq + Send + Sync + Clone + 'static,
{
    /// Sets the initial capacity (number of entries) of the cache.
    #[must_use] pub fn initial_capacity(mut self, capacity: usize) -> Self {
        self.inner = self.inner.initial_capacity(capacity);
        self
    }

    /// Sets the max capacity of the cache.
    ///
    /// By default this counts the **number of entries**, not their total size in
    /// bytes. Since cached entries hold full response bodies, a cache bounded
    /// only by entry count can still grow unbounded in memory when individual
    /// responses are large. To bound by bytes instead, set a [`weigher`] that
    /// returns each entry's size; `max_capacity` is then interpreted as the
    /// maximum total weight.
    ///
    /// [`weigher`]: Self::weigher
    #[must_use] pub fn max_capacity(mut self, capacity: u64) -> Self {
        self.inner = self.inner.max_capacity(capacity);
        self
    }

    /// Sets a weigher that returns the size of each entry, so that
    /// [`max_capacity`](Self::max_capacity) bounds the cache by total weight
    /// (e.g. bytes) rather than entry count.
    ///
    /// A common choice is the cached body's byte length, which keeps memory use
    /// bounded even when a few responses are very large.
    #[must_use]
    pub fn weigher(
        mut self,
        weigher: impl Fn(&K, &CachedEntry) -> u32 + Send + Sync + 'static,
    ) -> Self {
        self.inner = self.inner.weigher(weigher);
        self
    }

    /// Sets the time to idle of the cache.
    ///
    /// A cached entry will expire after the specified duration has passed since `get`
    /// or `insert`.
    ///
    /// # Panics
    ///
    /// `CacheBuilder::build*` methods will panic if the given `duration` is longer
    /// than 1000 years. This is done to protect against overflow when computing key
    /// expiration.
    #[must_use] pub fn time_to_idle(mut self, duration: Duration) -> Self {
        self.inner = self.inner.time_to_idle(duration);
        self
    }

    /// Sets the time to live of the cache.
    ///
    /// A cached entry will expire after the specified duration has passed since
    /// `insert`.
    ///
    /// # Panics
    ///
    /// `CacheBuilder::build*` methods will panic if the given `duration` is longer
    /// than 1000 years. This is done to protect against overflow when computing key
    /// expiration.
    #[must_use] pub fn time_to_live(mut self, duration: Duration) -> Self {
        self.inner = self.inner.time_to_live(duration);
        self
    }

    /// Sets the eviction listener closure to the cache.
    ///
    /// # Panics
    ///
    /// It is very important to ensure the listener closure does not panic. Otherwise,
    /// the cache will stop calling the listener after a panic. This is intended
    /// behavior because the cache cannot know whether it is memory safe to
    /// call the panicked listener again.
    #[must_use]
    pub fn eviction_listener(
        mut self,
        listener: impl Fn(Arc<K>, CachedEntry, RemovalCause) + Send + Sync + 'static,
    ) -> Self {
        self.inner = self.inner.eviction_listener(listener);
        self
    }

    /// Build a [`MokaStore`].
    ///
    /// # Panics
    ///
    /// Panics if configured with either `time_to_live` or `time_to_idle` higher than
    /// 1000 years. This is done to protect against overflow when computing key
    /// expiration.
    #[must_use] pub fn build(self) -> MokaStore<K> {
        MokaStore {
            inner: self.inner.build(),
        }
    }
}
/// A simple in-memory store for the cache.
pub struct MokaStore<K> {
    inner: MokaCache<K, CachedEntry>,
}

impl<K> Debug for MokaStore<K> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("MokaStore").finish()
    }
}
impl<K> MokaStore<K>
where
    K: Hash + Eq + Send + Sync + Clone + 'static,
{
    /// Create a new `MokaStore`.
    #[must_use] pub fn new(max_capacity: u64) -> Self {
        Self {
            inner: MokaCache::new(max_capacity),
        }
    }

    /// Returns a [`Builder`], which can build a `MokaStore`.
    #[must_use] pub fn builder() -> Builder<K> {
        Builder {
            inner: MokaCache::builder(),
        }
    }
}

impl<K> CacheStore for MokaStore<K>
where
    K: Hash + Eq + Send + Sync + Clone + 'static,
{
    type Error = Infallible;
    type Key = K;

    async fn load_entry<Q>(&self, key: &Q) -> Option<CachedEntry>
    where
        Self::Key: Borrow<Q>,
        Q: Hash + Eq + Sync,
    {
        self.inner.get(key).await
    }

    async fn save_entry(&self, key: Self::Key, entry: CachedEntry) -> Result<(), Self::Error> {
        self.inner.insert(key, entry).await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use salvo_core::http::{HeaderMap, StatusCode};
    use crate::{CachedBody, CachedEntry};

    #[tokio::test]
    async fn test_moka_store() {
        let store = MokaStore::new(100);
        let key = "test_key".to_owned();
        let entry = CachedEntry {
            status: Some(StatusCode::OK),
            headers: HeaderMap::new(),
            body: CachedBody::Once("test_body".into()),
        };
        store.save_entry(key.clone(), entry.clone()).await.unwrap();
        let loaded_entry = store.load_entry(&key).await.unwrap();
        assert_eq!(loaded_entry.status, entry.status);
        assert_eq!(loaded_entry.body, entry.body);
    }

    #[tokio::test]
    async fn test_moka_store_builder() {
        let store = MokaStore::<String>::builder()
            .initial_capacity(50)
            .max_capacity(100)
            .time_to_live(Duration::from_secs(1))
            .time_to_idle(Duration::from_secs(1))
            .build();
        let key = "test_key".to_owned();
        let entry = CachedEntry {
            status: Some(StatusCode::OK),
            headers: HeaderMap::new(),
            body: CachedBody::Once("test_body".into()),
        };
        store.save_entry(key.clone(), entry.clone()).await.unwrap();
        let loaded_entry = store.load_entry(&key).await.unwrap();
        assert_eq!(loaded_entry.status, entry.status);
        assert_eq!(loaded_entry.body, entry.body);

        tokio::time::sleep(Duration::from_secs(2)).await;
        let loaded_entry = store.load_entry(&key).await;
        assert!(loaded_entry.is_none());
    }
    
    #[test]
    fn test_builder_debug() {
        let builder = MokaStore::<String>::builder();
        let dbg_str = format!("{builder:?}");
        assert_eq!(dbg_str, "Builder");
    }

    #[test]
    fn test_moka_store_debug() {
        let store = MokaStore::<String>::new(100);
        let dbg_str = format!("{store:?}");
        assert_eq!(dbg_str, "MokaStore");
    }
    
    #[tokio::test]
    async fn test_eviction_listener() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let evicted = Arc::new(AtomicBool::new(false));
        let evicted_clone = evicted.clone();
        let store = MokaStore::<String>::builder()
            .max_capacity(1)
            .eviction_listener(move |_, _, _| {
                evicted_clone.store(true, Ordering::SeqCst);
            })
            .build();
        let entry = CachedEntry {
            status: None,
            headers: HeaderMap::new(),
            body: Cach
```

### Core Architecture Module: `crates/cache/src/skipper.rs`
```
use std::collections::HashSet;

use salvo_core::handler::Skipper;
use salvo_core::http::Method;
use salvo_core::{Depot, Request};

/// Skipper for `Method`. You can use it to skip some methods.
///
/// If the request method is in the skip list, the request will be skipped.
#[derive(Default, Clone, Debug)]
pub struct MethodSkipper {
    skipped_methods: HashSet<Method>,
}
impl MethodSkipper {
    /// Create a new `MethodSkipper`.
    #[must_use]
    pub fn new() -> Self {
        Self {
            skipped_methods: HashSet::new(),
        }
    }
    /// Add the [`Method::GET`] method to skipped methods.
    #[must_use]
    pub fn skip_get(self, value: bool) -> Self {
        self.skip_method(Method::GET, value)
    }
    /// Add the [`Method::POST`] method to skipped methods.
    #[must_use]
    pub fn skip_post(self, value: bool) -> Self {
        self.skip_method(Method::POST, value)
    }
    /// Add the [`Method::PUT`] method to skipped methods.
    #[must_use]
    pub fn skip_put(self, value: bool) -> Self {
        self.skip_method(Method::PUT, value)
    }
    /// Add the [`Method::QUERY`] method to skipped methods.
    #[must_use]
    pub fn skip_query(self, value: bool) -> Self {
        self.skip_method(Method::QUERY, value)
    }
    /// Add the [`Method::DELETE`] method to skipped methods.
    #[must_use]
    pub fn skip_delete(self, value: bool) -> Self {
        self.skip_method(Method::DELETE, value)
    }
    /// Add the [`Method::HEAD`] method to skipped methods.
    #[must_use]
    pub fn skip_head(self, value: bool) -> Self {
        self.skip_method(Method::HEAD, value)
    }
    /// Add the [`Method::PATCH`] method to skipped methods.
    #[must_use]
    pub fn skip_patch(self, value: bool) -> Self {
        self.skip_method(Method::PATCH, value)
    }
    /// Add the [`Method::OPTIONS`] method to skipped methods.
    #[must_use]
    pub fn skip_options(self, value: bool) -> Self {
        self.skip_method(Method::OPTIONS, value)
    }
    /// Add the [`Method::CONNECT`] method to skipped methods.
    #[must_use]
    pub fn skip_connect(self, value: bool) -> Self {
        self.skip_method(Method::CONNECT, value)
    }
    /// Add the [`Method::TRACE`] method to skipped methods.
    #[must_use]
    pub fn skip_trace(self, value: bool) -> Self {
        self.skip_method(Method::TRACE, value)
    }
    /// Add a [`Method`] to skipped methods.
    #[must_use]
    pub fn skip_method(mut self, method: Method, value: bool) -> Self {
        if value {
            self.skipped_methods.insert(method);
        } else {
            self.skipped_methods.remove(&method);
        }
        self
    }
    /// Add all methods to skipped methods.
    #[must_use]
    pub fn skip_all(mut self) -> Self {
        self.skipped_methods = [
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::HEAD,
            Method::PATCH,
            Method::OPTIONS,
            Method::CONNECT,
            Method::TRACE,
            Method::QUERY,
        ]
        .into_iter()
        .collect();
        self
    }
}
impl Skipper for MethodSkipper {
    fn skipped(&self, req: &mut Request, _depot: &Depot) -> bool {
        self.skipped_methods.contains(req.method())
    }
}

#[cfg(test)]
mod tests {
    use salvo_core::http::Method;

    use super::*;

    #[test]
    fn test_method_skipper_new() {
        let skipper = MethodSkipper::new();
        assert!(skipper.skipped_methods.is_empty());
    }

    #[test]
    fn test_method_skipper_default() {
        let skipper = MethodSkipper::default();
        assert!(skipper.skipped_methods.is_empty());
    }

    #[test]
    fn test_skip_get() {
        let skipper = MethodSkipper::new().skip_get(true);
        assert!(skipper.skipped_methods.contains(&Method::GET));

        let skipper = skipper.skip_get(false);
        assert!(!skipper.skipped_methods.contains(&Method::GET));
    }

    #[test]
    fn test_skip_post() {
        let skipper = MethodSkipper::new().skip_post(true);
        assert!(skipper.skipped_methods.contains(&Method::POST));

        let skipper = skipper.skip_post(false);
        assert!(!skipper.skipped_methods.contains(&Method::POST));
    }

    #[test]
    fn test_skip_put() {
        let skipper = MethodSkipper::new().skip_put(true);
        assert!(skipper.skipped_methods.contains(&Method::PUT));

        let skipper = skipper.skip_put(false);
        assert!(!skipper.skipped_methods.contains(&Method::PUT));
    }

    #[test]
    fn test_skip_query() {
        let skipper = MethodSkipper::new().skip_query(true);
        assert!(skipper.skipped_methods.contains(&Method::QUERY));

        let skipper = skipper.skip_query(false);
        assert!(!skipper.skipped_methods.contains(&Method::QUERY));
    }

    #[test]
    fn test_skip_delete() {
        let skipper = MethodSkipper::new().skip_delete(true);
        assert!(skipper.skipped_methods.contains(&Method::DELETE));

        let skipper = skipper.skip_delete(false);
        assert!(!skipper.skipped_methods.contains(&Method::DELETE));
    }

    #[test]
    fn test_skip_head() {
        let skipper = MethodSkipper::new().skip_head(true);
        assert!(skipper.skipped_methods.contains(&Method::HEAD));

        let skipper = skipper.skip_head(false);
        assert!(!skipper.skipped_methods.contains(&Method::HEAD));
    }

    #[test]
    fn test_skip_patch() {
        let skipper = MethodSkipper::new().skip_patch(true);
        assert!(skipper.skipped_methods.contains(&Method::PATCH));

        let skipper = skipper.skip_patch(false);
        assert!(!skipper.skipped_methods.contains(&Method::PATCH));
    }

    #[test]
    fn test_skip_options() {
        let skipper = MethodSkipper::new().skip_options(true);
        assert!(skipper.skipped_methods.contains(&Method::OPTIONS));

        let skipper = skipper.skip_options(false);
        assert!(!skipper.skipped_methods.contains(&Method::OPTIONS));
    }

    #[test]
    fn test_skip_connect() {
        let skipper = MethodSkipper::new().skip_connect(true);
        assert!(skipper.skipped_methods.contains(&Method::CONNECT));

        let skipper = skipper.skip_connect(false);
        assert!(!skipper.skipped_methods.contains(&Method::CONNECT));
    }

    #[test]
    fn test_skip_trace() {
        let skipper = MethodSkipper::new().skip_trace(true);
        assert!(skipper.skipped_methods.contains(&Method::TRACE));

        let skipper = skipper.skip_trace(false);
        assert!(!skipper.skipped_methods.contains(&Method::TRACE));
    }

    #[test]
    fn test_skip_all() {
        let skipper = MethodSkipper::new().skip_all();
        assert!(skipper.skipped_methods.contains(&Method::GET));
        assert!(skipper.skipped_methods.contains(&Method::POST));
        assert!(skipper.skipped_methods.contains(&Method::PUT));
        assert!(skipper.skipped_methods.contains(&Method::DELETE));
        assert!(skipper.skipped_methods.contains(&Method::HEAD));
        assert!(skipper.skipped_methods.contains(&Method::PATCH));
        assert!(skipper.skipped_methods.contains(&Method::OPTIONS));
        assert!(skipper.skipped_methods.contains(&Method::CONNECT));
        assert!(skipper.skipped_methods.contains(&Method::TRACE));
        assert!(skipper.skipped_methods.contains(&Method::QUERY));
        assert_eq!(skipper.skipped_methods.len(), 10);
    }

    #[test]
    fn test_skip_method_chain() {
        let skipper = MethodSkipper::new()
            .skip_get(true)
            .skip_post(true)
            .skip_put(true);
        assert!(skipper.skipped_methods.contains(&Method::GET));
        assert!(skipper.skipped_methods.contains(&Method::POST));
        assert!(skipper.skipped_methods.contains(&Method::PUT));
        assert_eq!(skipper.skipped_methods.len(), 3);
    }

    #[test]
    fn test_skip_all_then_allow_get() {
        let skipper = MethodSkipper::new().skip_all().skip_get(false);
        assert!(!skipper.sk
```

### Core Architecture Module: `crates/compression/src/encoder.rs`
```
//! Compress the body of a response.
use std::io::{Result as IoResult, Write};

#[cfg(feature = "brotli")]
use brotli::CompressorWriter as BrotliEncoder;
use bytes::{Bytes, BytesMut};
#[cfg(feature = "gzip")]
use flate2::write::GzEncoder;
#[cfg(feature = "deflate")]
use flate2::write::ZlibEncoder;
#[cfg(feature = "zstd")]
use zstd::stream::write::Encoder as ZstdEncoder;

use super::{CompressionAlgo, CompressionLevel};

pub(super) struct Writer {
    buf: BytesMut,
}

impl Writer {
    #[allow(dead_code)]
    fn new() -> Self {
        Self {
            buf: BytesMut::with_capacity(8192),
        }
    }

    #[allow(dead_code)]
    fn take(&mut self) -> Bytes {
        self.buf.split().freeze()
    }
}

impl Write for Writer {
    fn write(&mut self, buf: &[u8]) -> IoResult<usize> {
        self.buf.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> IoResult<()> {
        Ok(())
    }
}

impl CompressionLevel {
    #[cfg(feature = "brotli")]
    fn into_brotli(self) -> BrotliEncoder<Writer> {
        let quality = match self {
            Self::Fastest | Self::Default => 0,
            Self::Minsize => 11,
            Self::Precise(quality) => quality.min(11),
        };
        BrotliEncoder::new(
            Writer::new(),
            32 * 1024, // 32 KiB buffer
            quality,   // BROTLI_PARAM_QUALITY
            22,        // BROTLI_PARAM_LGWIN
        )
    }

    #[cfg(feature = "deflate")]
    fn into_deflate(self) -> ZlibEncoder<Writer> {
        let compression = match self {
            Self::Fastest | Self::Default => flate2::Compression::fast(),
            Self::Minsize => flate2::Compression::best(),
            Self::Precise(quality) => flate2::Compression::new(quality.min(10)),
        };
        ZlibEncoder::new(Writer::new(), compression)
    }

    #[cfg(feature = "gzip")]
    fn into_gzip(self) -> GzEncoder<Writer> {
        let compression = match self {
            Self::Fastest | Self::Default => flate2::Compression::fast(),
            Self::Minsize => flate2::Compression::best(),
            Self::Precise(quality) => flate2::Compression::new(quality.min(10)),
        };
        GzEncoder::new(Writer::new(), compression)
    }

    #[cfg(feature = "zstd")]
    fn into_zstd(self) -> ZstdEncoder<'static, Writer> {
        let quality = match self {
            Self::Fastest | Self::Default => 1,
            Self::Minsize => 21,
            Self::Precise(quality) => quality.min(21) as i32,
        };
        ZstdEncoder::new(Writer::new(), quality).expect("`ZstdEncoder::new` returned an error")
    }
}

pub(super) enum Encoder {
    #[cfg(feature = "brotli")]
    Brotli(Box<BrotliEncoder<Writer>>),
    #[cfg(feature = "deflate")]
    Deflate(ZlibEncoder<Writer>),
    #[cfg(feature = "gzip")]
    Gzip(GzEncoder<Writer>),
    #[cfg(feature = "zstd")]
    Zstd(ZstdEncoder<'static, Writer>),
}

impl Encoder {
    #[allow(unused_variables)]
    pub(super) fn new(algo: CompressionAlgo, level: CompressionLevel) -> Self {
        match algo {
            #[cfg(feature = "brotli")]
            CompressionAlgo::Brotli => Self::Brotli(Box::new(level.into_brotli())),
            #[cfg(feature = "deflate")]
            CompressionAlgo::Deflate => Self::Deflate(level.into_deflate()),
            #[cfg(feature = "gzip")]
            CompressionAlgo::Gzip => Self::Gzip(level.into_gzip()),
            #[cfg(feature = "zstd")]
            CompressionAlgo::Zstd => Self::Zstd(level.into_zstd()),
        }
    }
    pub(super) fn take(&mut self) -> IoResult<Bytes> {
        match *self {
            #[cfg(feature = "brotli")]
            Self::Brotli(ref mut encoder) => {
                encoder.flush()?;
                Ok(encoder.get_mut().take())
            }
            #[cfg(feature = "deflate")]
            Self::Deflate(ref mut encoder) => {
                encoder.flush()?;
                Ok(encoder.get_mut().take())
            }
            #[cfg(feature = "gzip")]
            Self::Gzip(ref mut encoder) => {
                encoder.flush()?;
                Ok(encoder.get_mut().take())
            }
            #[cfg(feature = "zstd")]
            Self::Zstd(ref mut encoder) => {
                encoder.flush()?;
                Ok(encoder.get_mut().take())
            }
        }
    }

    pub(super) fn finish(self) -> IoResult<Bytes> {
        match self {
            #[cfg(feature = "brotli")]
            Self::Brotli(mut encoder) => match encoder.flush() {
                Ok(()) => Ok(encoder.into_inner().buf.freeze()),
                Err(err) => Err(err),
            },
            #[cfg(feature = "deflate")]
            Self::Deflate(encoder) => match encoder.finish() {
                Ok(writer) => Ok(writer.buf.freeze()),
                Err(err) => Err(err),
            },
            #[cfg(feature = "gzip")]
            Self::Gzip(encoder) => match encoder.finish() {
                Ok(writer) => Ok(writer.buf.freeze()),
                Err(err) => Err(err),
            },
            #[cfg(feature = "zstd")]
            Self::Zstd(encoder) => match encoder.finish() {
                Ok(writer) => Ok(writer.buf.freeze()),
                Err(err) => Err(err),
            },
        }
    }

    #[allow(unused_variables)]
    pub(super) fn write(&mut self, data: &[u8]) -> IoResult<()> {
        match *self {
            #[cfg(feature = "brotli")]
            Self::Brotli(ref mut encoder) => encoder.write_all(data),
            #[cfg(feature = "deflate")]
            Self::Deflate(ref mut encoder) => encoder.write_all(data),
            #[cfg(feature = "gzip")]
            Self::Gzip(ref mut encoder) => encoder.write_all(data),
            #[cfg(feature = "zstd")]
            Self::Zstd(ref mut encoder) => encoder.write_all(data),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::Read;

    use super::*;

    #[cfg(feature = "gzip")]
    #[test]
    fn test_gzip_encoder() {
        use flate2::read::GzDecoder;
        let mut encoder = Encoder::new(CompressionAlgo::Gzip, CompressionLevel::Default);
        encoder.write(b"hello").unwrap();
        let compressed = encoder.finish().unwrap();

        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut decompressed = String::new();
        decoder.read_to_string(&mut decompressed).unwrap();
        assert_eq!(decompressed, "hello");
    }

    #[cfg(feature = "brotli")]
    #[test]
    fn test_brotli_encoder() {
        use brotli::Decompressor;
        let mut encoder = Encoder::new(CompressionAlgo::Brotli, CompressionLevel::Default);
        encoder.write(b"hello").unwrap();
        let compressed = encoder.finish().unwrap();

        let mut decompressed = [0; 5];
        Decompressor::new(&compressed[..], 4096)
            .read_exact(&mut decompressed)
            .unwrap();
        assert_eq!(decompressed, *b"hello");
    }

    #[cfg(feature = "brotli")]
    #[test]
    fn test_brotli_encoder_finishes_multiblock_stream() {
        use brotli::Decompressor;
        // Larger-than-buffer input written in several chunks, so `finish` must
        // emit a complete (finalized) brotli stream. `read_to_end` fully decodes
        // it and fails if the terminating block is missing.
        let input: Vec<u8> = (0..200_000u32).map(|i| (i % 251) as u8).collect();
        let mut encoder = Encoder::new(CompressionAlgo::Brotli, CompressionLevel::Default);
        for chunk in input.chunks(7000) {
            encoder.write(chunk).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decompressed = Vec::new();
        Decompressor::new(&compressed[..], 4096)
            .read_to_end(&mut decompressed)
            .expect("brotli stream should be a complete, decodable stream");
        assert_eq!(decompressed, input);
    }

    #[cfg(feature = "deflate")]
    #[test]
    fn test_deflate_encoder() {
        use flate2::read::ZlibDecoder;
        let mut encoder = Encoder::new(CompressionAl
```

### Core Architecture Module: `crates/compression/src/lib.rs`
```
#![cfg_attr(docsrs, feature(doc_cfg))]
#![cfg_attr(test, allow(clippy::unwrap_used))]

//! Compression middleware for the Salvo web framework.
//!
//! This middleware automatically compresses HTTP responses using various algorithms,
//! reducing bandwidth usage and improving load times for clients.
//!
//! # Supported Algorithms
//!
//! | Algorithm | Feature | Content-Encoding |
//! |-----------|---------|------------------|
//! | Gzip | `gzip` | `gzip` |
//! | Brotli | `brotli` | `br` |
//! | Deflate | `deflate` | `deflate` |
//! | Zstd | `zstd` | `zstd` |
//!
//! # Example
//!
//! ```no_run
//! use salvo_compression::{Compression, CompressionLevel};
//! use salvo_core::prelude::*;
//!
//! #[handler]
//! async fn hello() -> &'static str {
//!     "hello"
//! }
//!
//! let compression = Compression::new()
//!     .enable_gzip(CompressionLevel::Default)
//!     .min_length(1024); // Only compress responses > 1KB
//!
//! let _router = Router::new().hoop(compression).get(hello);
//! ```
//!
//! # Algorithm Negotiation
//!
//! The middleware negotiates the compression algorithm based on the client's
//! `Accept-Encoding` header. By default, it respects the client's preference order.
//! Use `force_priority(true)` to use the server's configured priority instead.
//!
//! # Compression Levels
//!
//! - [`CompressionLevel::Fastest`]: Fastest compression, larger output
//! - [`CompressionLevel::Default`]: Balanced compression (recommended)
//! - [`CompressionLevel::Minsize`]: Best compression, slower
//! - `CompressionLevel::Precise(u32)`: Fine-grained control
//!
//! # Default Content Types
//!
//! By default, the middleware compresses:
//! - `text/*` (HTML, CSS, plain text, etc.)
//! - `application/javascript`
//! - `application/json`
//! - `application/xml`, `application/rss+xml`
//! - `application/wasm`
//! - `image/svg+xml`
//!
//! Use `.content_types()` to customize which MIME types are compressed.
//!
//! # Minimum Length
//!
//! Small responses may not benefit from compression. Use `.min_length(bytes)`
//! to skip compression for responses smaller than the specified size.
//!
//! Read more: <https://salvo.rs>

use std::fmt::{self, Display, Formatter};
use std::str::FromStr;
use std::sync::LazyLock;

use indexmap::IndexMap;
use salvo_core::http::body::ResBody;
use salvo_core::http::header::{
    ACCEPT_ENCODING, CONTENT_ENCODING, CONTENT_LENGTH, CONTENT_TYPE, HeaderValue,
};
use salvo_core::http::headers::{ContentLength, HeaderMapExt};
use salvo_core::http::{self, Method, Mime, StatusCode, append_vary_header, mime};
use salvo_core::{Depot, FlowCtrl, Handler, Request, Response, async_trait};

mod encoder;
mod stream;
use encoder::Encoder;
use stream::EncodeStream;

/// Level of compression data should be compressed with.
#[non_exhaustive]
#[derive(Clone, Copy, Default, Debug, Eq, PartialEq)]
pub enum CompressionLevel {
    /// Fastest quality of compression, usually produces a bigger size.
    Fastest,
    /// Best quality of compression, usually produces the smallest size.
    Minsize,
    /// Default quality of compression defined by the selected compression algorithm.
    #[default]
    Default,
    /// Precise quality based on the underlying compression algorithms'
    /// qualities. The interpretation of this depends on the algorithm chosen
    /// and the specific implementation backing it.
    /// Qualities are implicitly clamped to the algorithm's maximum.
    Precise(u32),
}

/// CompressionAlgo
#[derive(Eq, PartialEq, Clone, Copy, Debug, Hash)]
#[non_exhaustive]
pub enum CompressionAlgo {
    /// Compress use Brotli algo.
    #[cfg(feature = "brotli")]
    #[cfg_attr(docsrs, doc(cfg(feature = "brotli")))]
    Brotli,

    /// Compress use Deflate algo.
    #[cfg(feature = "deflate")]
    #[cfg_attr(docsrs, doc(cfg(feature = "deflate")))]
    Deflate,

    /// Compress use Gzip algo.
    #[cfg(feature = "gzip")]
    #[cfg_attr(docsrs, doc(cfg(feature = "gzip")))]
    Gzip,

    /// Compress use Zstd algo.
    #[cfg(feature = "zstd")]
    #[cfg_attr(docsrs, doc(cfg(feature = "zstd")))]
    Zstd,
}

impl FromStr for CompressionAlgo {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            #[cfg(feature = "brotli")]
            "br" => Ok(Self::Brotli),
            #[cfg(feature = "brotli")]
            "brotli" => Ok(Self::Brotli),

            #[cfg(feature = "deflate")]
            "deflate" => Ok(Self::Deflate),

            #[cfg(feature = "gzip")]
            "gzip" => Ok(Self::Gzip),

            #[cfg(feature = "zstd")]
            "zstd" => Ok(Self::Zstd),
            _ => Err(format!("unknown compression algorithm: {s}")),
        }
    }
}

impl Display for CompressionAlgo {
    #[allow(unreachable_patterns)]
    #[allow(unused_variables)]
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            #[cfg(feature = "brotli")]
            Self::Brotli => write!(f, "br"),
            #[cfg(feature = "deflate")]
            Self::Deflate => write!(f, "deflate"),
            #[cfg(feature = "gzip")]
            Self::Gzip => write!(f, "gzip"),
            #[cfg(feature = "zstd")]
            Self::Zstd => write!(f, "zstd"),
            _ => unreachable!(),
        }
    }
}

impl From<CompressionAlgo> for HeaderValue {
    #[inline]
    fn from(algo: CompressionAlgo) -> Self {
        match algo {
            #[cfg(feature = "brotli")]
            CompressionAlgo::Brotli => Self::from_static("br"),
            #[cfg(feature = "deflate")]
            CompressionAlgo::Deflate => Self::from_static("deflate"),
            #[cfg(feature = "gzip")]
            CompressionAlgo::Gzip => Self::from_static("gzip"),
            #[cfg(feature = "zstd")]
            CompressionAlgo::Zstd => Self::from_static("zstd"),
        }
    }
}

/// Compression
#[derive(Clone, Debug)]
#[non_exhaustive]
pub struct Compression {
    /// Compression algorithms to use.
    pub algos: IndexMap<CompressionAlgo, CompressionLevel>,
    /// Content types to compress.
    pub content_types: Vec<Mime>,
    /// Minimum body size to compress; bodies smaller than this value are not compressed.
    ///
    /// This threshold only applies to bodies whose length is known up front
    /// (in-memory `Once`/`Chunks` bodies). Streaming bodies (`Hyper`/`Stream`)
    /// have no known length and are always compressed regardless of
    /// `min_length`, so a tiny streamed body can still end up larger after
    /// adding `Content-Encoding` and framing overhead.
    pub min_length: usize,
    /// Ignore the client's algorithm order in `Accept-Encoding` and always use the server's
    /// configured priority.
    pub force_priority: bool,
}

static DEFAULT_CONTENT_TYPES: LazyLock<Vec<Mime>> = LazyLock::new(|| {
    vec![
        mime::TEXT_STAR,
        mime::APPLICATION_JAVASCRIPT,
        mime::APPLICATION_JSON,
        mime::IMAGE_SVG,
        "application/wasm".parse().expect("invalid mime type"),
        "application/xml".parse().expect("invalid mime type"),
        "application/rss+xml".parse().expect("invalid mime type"),
    ]
});

impl Default for Compression {
    fn default() -> Self {
        #[allow(unused_mut)]
        let mut algos = IndexMap::new();
        #[cfg(feature = "zstd")]
        algos.insert(CompressionAlgo::Zstd, CompressionLevel::Default);
        #[cfg(feature = "gzip")]
        algos.insert(CompressionAlgo::Gzip, CompressionLevel::Default);
        #[cfg(feature = "deflate")]
        algos.insert(CompressionAlgo::Deflate, CompressionLevel::Default);
        #[cfg(feature = "brotli")]
        algos.insert(CompressionAlgo::Brotli, CompressionLevel::Default);
        Self {
            algos,
            content_types: DEFAULT_CONTENT_TYPES.clone(),
            min_length: 1024,
            force_priority: false,
        }
    }
}

impl Compression {
    /// Create a new `Compression`.
    #[inline]
    #[must_use]
    pub fn new() -> Self {
        Default::default()
    }

  
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24** (2021-05-02): **master/examples/routing.rs  Compilation fails**
  *Symptoms*: - https://github.com/salvo-rs/salvo/blob/master/examples/routing.rs  **dependencies** ``` rustc 1.51.0 (2fd73fabe 2021-03-23) Deepin GNU/Linux 20.2  [dependencies] salvo = { version = "0.11", features = ["full"] } tokio = { version = "1", features = ["full"] } ```  **code** ``` use salvo::prelude::*;  #[tokio::main] async fn main() {     let debug_mode = true;     let admin_mode = true;     let router = Router::new()         .get(index)         .push(             Router::new()                 .path("users")                 .before(auth)                 .post(create_user)                 .push(Router::new().path(r"<id:num>").post(update_user).delete(delete_user)),         )         .push(             Router::new()                 .path("users")                 .get(list_users)                 .push(Router::new().path(r"<id:num>").get(show_user)),         )         .then(|router| {             if debug_mode {                 router.push(Router::new().path("debug").get(debug))             } else {                 router             }         })         .then(|router| {             if admin_mode {                 router.push(Router::new().path("admin").get(admin))             } else {                 router             }         })         ;      Server::new(router).bind(([0, 0, 0, 0], 7878)).await; }  #[fn_handler] async fn admin(res: &mut Response) {     res.render_plain_text("Admin page"); } #[fn_handler] async fn debu
  **Post-Mortem & Fix Analysis**:
  > Thank you for your report, this is a bug, I have submitted the corresponding fix, hope it will help you 
  > @driftluo Thanks for your PR.  @dollarkillerx You can use latest version 0.11.2. 

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

### Incident Patch 1: `e011f4d2` (2026-09-24)
**Commit Message**: fix(examples): align OpenTelemetry examples with 0.33 (#1710)

**File**: `examples/Cargo.toml` (modified, +1/-2)
```diff
@@ -42,9 +42,8 @@ futures = "0.3.31"
 opentelemetry = "0.33"
 opentelemetry-appender-tracing = "0.33"
 opentelemetry-http = "0.33"
-opentelemetry-otlp = "0.33"
+opentelemetry-otlp = { version = "0.33", default-features = false }
 opentelemetry_sdk = "0.33"
-opentelemetry-semantic-conventions = "0.33"
 
 argon2 = "0.5.3"
 dotenvy = "0.15.6"
```

**File**: `examples/logging-otlp/Cargo.toml` (modified, +1/-3)
```diff
@@ -11,9 +11,7 @@ salvo = { workspace = true, features = ["logging"] }
 tokio = { workspace = true, features = ["macros"] }
 tracing.workspace = true
 tracing-subscriber = { workspace = true, features = ["env-filter"] }
-opentelemetry = { workspace = true }
 opentelemetry-appender-tracing = { workspace = true }
-opentelemetry-otlp = { workspace = true, features = ["grpc-tonic"] }
+opentelemetry-otlp = { workspace = true, features = ["grpc-tonic", "logs"] }
 opentelemetry_sdk = { workspace = true, features = ["rt-tokio"] }
-opentelemetry-semantic-conventions = { workspace = true }
 tracing-appender = { workspace = true }
```

**File**: `examples/otel-jaeger/Cargo.toml` (modified, +2/-7)
```diff
@@ -22,13 +22,8 @@ salvo = { workspace = true, features = ["affix-state", "otel"] }
 tokio = { workspace = true, features = ["macros"] }
 tracing.workspace = true
 tracing-subscriber.workspace = true
-opentelemetry = { workspace = true, features = ["metrics"] }
+opentelemetry = { workspace = true, features = ["trace"] }
 reqwest = { workspace = true }
 opentelemetry-http.workspace = true
 opentelemetry_sdk = { workspace = true, features = ["rt-tokio"] }
-opentelemetry-otlp = { workspace = true, features = [
-    "http-proto",
-    "tonic",
-    "trace",
-    "reqwest",
-] }
+opentelemetry-otlp = { workspace = true, features = ["grpc-tonic", "trace"] }
```

**File**: `examples/otel-jaeger/README.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 First make sure you have a running version of the Jaeger instance you want to send data to:
 
 ```shell
-docker run -d -e COLLECTOR_OTLP_ENABLED=true -p6831:6831/udp -p6832:6832/udp -p16686:16686 -p14268:14268 jaegertracing/all-in-one:latest
+docker run -d -e COLLECTOR_OTLP_ENABLED=true -p16686:16686 -p4317:4317 jaegertracing/all-in-one:latest
 ```
 
 Launch the servers:
```

**File**: `examples/otel-jaeger/src/client.rs` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ fn init_tracer_provider() -> SdkTracerProvider {
     global::set_text_map_propagator(TraceContextPropagator::new());
     let exporter = opentelemetry_otlp::SpanExporter::builder()
         .with_tonic()
-        .with_endpoint("http://localhost:14268/api/traces")
+        .with_endpoint("http://localhost:4317")
         .build()
         .expect("failed to create exporter");
     SdkTracerProvider::builder()
```

---

### Incident Patch 2: `6aec86a8` (2026-09-24)
**Commit Message**: fix(serve-static): block paths beneath dot directories (#1708)

**File**: `crates/serve-static/src/dir.rs` (modified, +2/-6)
```diff
@@ -501,14 +501,10 @@ impl Handler for StaticDir {
         let rel_path = normalize_url_path(rel_path);
         let mut files: HashMap<String, Metadata> = HashMap::new();
         let mut dirs: HashMap<String, Metadata> = HashMap::new();
-        let is_dot_file = Path::new(&rel_path)
-            .file_name()
-            .and_then(|s| s.to_str())
-            .map(|s| s.starts_with('.'))
-            .unwrap_or(false);
+        let has_dot_segment = rel_path.split('/').any(|part| part.starts_with('.'));
         let mut abs_path = None;
         let roots = self.canonical_roots().await;
-        if self.include_dot_files || !is_dot_file {
+        if self.include_dot_files || !has_dot_segment {
             for root in &roots {
                 // Use a single async symlink_metadata call for file type checks, then verify
                 // the canonical target stays under the canonical root before serving it.
```

**File**: `crates/serve-static/src/lib.rs` (modified, +55/-0)
```diff
@@ -160,6 +160,61 @@ mod tests {
         assert_eq!(content, "copy3");
     }
 
+    #[tokio::test]
+    async fn test_static_dir_rejects_dot_directory_ancestors() {
+        let root = tempfile::TempDir::new().unwrap();
+        fs::create_dir_all(root.path().join(".git/objects")).unwrap();
+        fs::write(root.path().join(".git/config"), "token = secret").unwrap();
+        fs::write(root.path().join(".git/objects/data"), "object data").unwrap();
+        fs::write(root.path().join(".env"), "top-level secret").unwrap();
+        fs::write(root.path().join("public.txt"), "public data").unwrap();
+
+        let service = Service::new(
+            Router::with_path("{*path}")
+                .get(StaticDir::new(root.path().to_path_buf()).auto_list(true)),
+        );
+
+        for path in [
+            "/.env",
+            "/.git/config",
+            "/.git/objects/data",
+            "/.git/objects/",
+        ] {
+            let response = TestClient::get(format!("http://127.0.0.1:5801{path}"))
+                .send(&service)
+                .await;
+            assert_eq!(response.status_code, Some(StatusCode::NOT_FOUND), "{path}");
+        }
+
+        let mut response = TestClient::get("http://127.0.0.1:5801/public.txt")
+            .send(&service)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+        assert_eq!(response.take_string().await.unwrap(), "public data");
+
+        let mut response = TestClient::get("http://127.0.0.1:5801/")
+            .add_header("accept", "application/json", true)
+            .send(&service)
+            .await;
+        let listing = response.take_string().await.unwrap();
+        assert!(listing.contains("public.txt"));
+        assert!(!listing.contains(".git"));
+        assert!(!listing.contains(".env"));
+
+        let included_service = Service::new(
+            Router::with_path("{*path}").get(
+                StaticDir::new(root.path().to_path_buf())
+                    .auto_list(true)
+                    .include_dot_files(true),
+            ),
+        );
+        let mut response = TestClient::get("http://127.0.0.1:5801/.git/config")
+            .send(&included_service)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+        assert_eq!(response.take_string().await.unwrap(), "token = secret");
+    }
+
     #[tokio::test]
     async fn test_static_dir_rejects_symlinked_directory_escape() {
         let public = tempfile::TempDir::new().unwrap();
```

---

### Incident Patch 3: `8f5d643f` (2026-09-03)
**Commit Message**: fix(tls): pass the rustls CryptoProvider explicitly instead of relying on crate features (#1699)

* fix(tls): pass the rustls CryptoProvider explicitly

rustls can only choose a cryptographic backend on its own when exactly one of its
`aws-lc-rs` and `ring` features is enabled across the whole dependency graph. As
soon as another crate pulls in the other backend, cargo feature unification makes
the choice ambiguous and rustls panics with "Could not automatically determine the
process-level CryptoProvider from Rustls crate features". That took down
`RustlsListener`, `QuinnListener`, `AcmeListener` and the proxy's default
`HyperClient`.

Select the provider from Salvo's own features and hand it to rustls explicitly,
following the pattern `jwt-auth`'s OIDC client already uses:

- an application that installed a process level provider keeps it, because
  `default_crypto_provider()` returns that one;
- otherwise a provider is built from the crate features and passed to
  `builder_with_provider` without being installed, so the application stays free
  to install whatever it wants, whenever it wants.

Salvo no longer writes the process level default anywhere on these paths. This
also make

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -63,6 +63,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 - `examples/oapi-3-2` demonstrates emitting a 3.2 document with a `QUERY` route.
 - `salvo_core::fs::extension_content_encoding`, which reports the content coding a file
   extension implies, so a handler choosing a file to serve can tell that it already carries one.
+- `salvo_core::conn::rustls::default_crypto_provider`, which reports the rustls `CryptoProvider`
+  Salvo builds its TLS configurations with. Pass it to other rustls based libraries so the whole
+  application agrees on one backend.
 
 ### Changed
 
@@ -96,6 +99,15 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ### Fixed
 
+- TLS setup no longer panics with *"Could not automatically determine the process-level
+  `CryptoProvider` from Rustls crate features"*. rustls can only pick a backend by itself when
+  exactly one of its `aws-lc-rs` and `ring` features is enabled across the whole dependency
+  graph, so pulling in any crate that enables the other one made `RustlsListener`,
+  `QuinnListener`, `AcmeListener` and the proxy's default `HyperClient` panic. Salvo now selects
+  the provider from its own features and passes it to rustls explicitly. An application that
+  installed a process level provider through `CryptoProvider::install_default` still has that
+  one used; Salvo itself never installs one, so applications keep full control over the
+  process level default.
 - `StaticDir` names a download after the file that was requested rather than the precompressed
   sidecar it was served from, so a request for `logo.svg` answered out of `logo.svg.br` no
   longer offers `Content-Disposition: attachment; filename="logo.svg.br"`.
```

**File**: `crates/acme/src/listener.rs` (modified, +25/-1)
```diff
@@ -17,6 +17,7 @@ use salvo_core::http::uri::Scheme;
 use salvo_core::{Result as CoreResult, Router, cfg_feature};
 use tokio::io::{AsyncRead, AsyncWrite};
 use tokio_rustls::TlsAcceptor;
+use tokio_rustls::rustls::crypto::CryptoProvider;
 use tokio_rustls::rustls::server::ServerConfig;
 use tokio_rustls::server::TlsStream;
 
@@ -33,6 +34,27 @@ cfg_feature! {
 /// ACME TLS-ALPN-01 protocol name.
 const ACME_TLS_ALPN_NAME: &[u8] = b"acme-tls/1";
 
+/// Returns the [`CryptoProvider`] used to build the ACME `ServerConfig`.
+///
+/// Reuses the process level provider when the application installed one, otherwise builds one
+/// from this crate's `aws-lc-rs` / `ring` features without installing it globally. Passing the
+/// provider explicitly keeps rustls from panicking when feature unification makes both backends
+/// available at once. `ring` wins when both are on, matching this crate's default.
+fn default_crypto_provider() -> Arc<CryptoProvider> {
+    if let Some(provider) = CryptoProvider::get_default() {
+        return Arc::clone(provider);
+    }
+
+    #[cfg(any(feature = "ring", not(feature = "aws-lc-rs")))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::ring::default_provider())
+    }
+    #[cfg(all(not(feature = "ring"), feature = "aws-lc-rs"))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::aws_lc_rs::default_provider())
+    }
+}
+
 /// A wrapper around an underlying listener which implements ACME.
 pub struct AcmeListenerBuilder<T> {
     inner: T,
@@ -367,7 +389,9 @@ impl<T> AcmeListenerBuilder<T> {
         };
         let cert_resolver = Arc::new(cert_resolver);
 
-        let mut server_config = ServerConfig::builder()
+        let mut server_config = ServerConfig::builder_with_provider(default_crypto_provider())
+            .with_safe_default_protocol_versions()
+            .map_err(salvo_core::Error::other)?
             .with_no_client_auth()
             .with_cert_resolver(cert_resolver.clone());
 
```

**File**: `crates/core/Cargo.toml` (modified, +3/-1)
```diff
@@ -152,7 +152,9 @@ nix = { workspace = true, optional = true, features = ["fs", "user"] }
 [dev-dependencies]
 criterion = { workspace = true }
 fastrand = { workspace = true }
-rustls = { workspace = true, features = ["aws-lc-rs"] }
+# Both backends on purpose: this makes rustls unable to pick a provider from crate features,
+# which is exactly the situation that used to panic. See `conn::rustls::default_crypto_provider`.
+rustls = { workspace = true, features = ["aws-lc-rs", "ring"] }
 tokio = { workspace = true, features = ["macros", "rt"] }
 
 [lints]
```

**File**: `crates/core/src/conn/rustls.rs` (modified, +45/-2)
```diff
@@ -1,7 +1,9 @@
 //! `RustlsListener` and utils.
 use std::io::{Error as IoError, Result as IoResult};
+use std::sync::Arc;
 
 use tokio_rustls::rustls::RootCertStore;
+use tokio_rustls::rustls::crypto::CryptoProvider;
 use tokio_rustls::rustls::pki_types::{CertificateDer, pem::PemObject};
 
 pub(crate) mod config;
@@ -10,6 +12,44 @@ pub use config::{Keycert, RustlsConfig, ServerConfig};
 mod listener;
 pub use listener::{RustlsAcceptor, RustlsListener};
 
+/// Returns the [`CryptoProvider`] used to build rustls configurations.
+///
+/// rustls needs to know which cryptographic backend to use. It can pick one on its own only
+/// when exactly one of its `aws-lc-rs` and `ring` features is enabled in the whole dependency
+/// graph. As soon as another crate pulls in the other backend, cargo feature unification makes
+/// the choice ambiguous and rustls panics with *"Could not automatically determine the
+/// process-level `CryptoProvider` from Rustls crate features"*.
+///
+/// To stay panic free, Salvo never relies on that automatic selection:
+///
+/// - If the application already installed a process level provider through
+///   [`CryptoProvider::install_default`] (a FIPS or HSM backed one, for instance), it is reused
+///   as is.
+/// - Otherwise a provider is built from Salvo's own `aws-lc-rs` / `ring` features and passed
+///   explicitly to rustls. It is **not** installed as the process default, so the application
+///   remains free to install whichever provider it wants, whenever it wants.
+///
+/// `aws-lc-rs` wins when both features are on, matching Salvo's own default and the backend the
+/// certified keys are already signed with in [`RustlsConfig`].
+///
+/// This is also the provider to pass to other rustls based libraries used alongside Salvo, so
+/// that the whole application agrees on a single backend.
+#[must_use]
+pub fn default_crypto_provider() -> Arc<CryptoProvider> {
+    if let Some(provider) = CryptoProvider::get_default() {
+        return Arc::clone(provider);
+    }
+
+    #[cfg(any(feature = "aws-lc-rs", not(feature = "ring")))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::aws_lc_rs::default_provider())
+    }
+    #[cfg(all(not(feature = "aws-lc-rs"), feature = "ring"))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::ring::default_provider())
+    }
+}
+
 pub(crate) fn read_trust_anchor(trust_anchor: &[u8]) -> IoResult<RootCertStore> {
     let certs = CertificateDer::pem_slice_iter(trust_anchor)
         .collect::<Result<Vec<_>, _>>()
@@ -37,7 +77,8 @@ mod tests {
 
     #[tokio::test]
     async fn test_rustls_listener() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
+        // No `CryptoProvider::install_default()` call here on purpose: both the listener and the
+        // client below must work without a process level provider being installed.
         let mut acceptor = TcpListener::new("127.0.0.1:0")
             .rustls(RustlsConfig::new(
                 Keycert::new()
@@ -57,7 +98,9 @@ mod tests {
         tokio::spawn(async move {
             let stream = TcpStream::connect(addr).await.unwrap();
             let trust_anchor = include_bytes!("../../certs/chain.pem");
-            let client_config = ClientConfig::builder()
+            let client_config = ClientConfig::builder_with_provider(default_crypto_provider())
+                .with_safe_default_protocol_versions()
+                .unwrap()
                 .with_root_certificates(read_trust_anchor(trust_anchor.as_slice()).unwrap())
                 .with_no_client_auth();
             let connector = TlsConnector::from(Arc::new(client_config));
```

**File**: `crates/core/src/conn/rustls/config.rs` (modified, +4/-2)
```diff
@@ -21,7 +21,7 @@ pub use tokio_rustls::rustls::server::ServerConfig;
 
 use crate::{IntoVecString, conn::IntoConfigStream};
 
-use super::read_trust_anchor;
+use super::{default_crypto_provider, read_trust_anchor};
 
 /// Private key and certificate
 #[derive(Clone, Debug)]
@@ -291,7 +291,9 @@ impl RustlsConfig {
             }
         };
 
-        let mut config = ServerConfig::builder_with_protocol_versions(self.tls_versions)
+        let mut config = ServerConfig::builder_with_provider(default_crypto_provider())
+            .with_protocol_versions(self.tls_versions)
+            .map_err(|e| IoError::other(format!("failed to build server config: {e}")))?
             .with_client_cert_verifier(client_auth)
             .with_cert_resolver(Arc::new(CertResolver {
                 literal_certified_keys,
```

---

### Incident Patch 4: `d2773533` (2026-08-25)
**Commit Message**: fix(webtransport): generate short-lived certificate at startup (#1698)

* fix(webtransport): generate short-lived certificate at startup

Generate a P-256 development certificate when the example starts and provide its SHA-256 hash to same-origin WebTransport clients.

Remove the checked-in certificate, private key, and expired origin trial token. Reuse the existing AWS-LC backend for certificate generation.

Fixes #1226

* fix(webtransport): resolve relative client URLs

Resolve WebTransport targets against the page URL before checking their origin so relative paths such as /counter continue to work.

**File**: `examples/webtransport/Cargo.toml` (modified, +3/-0)
```diff
@@ -15,3 +15,6 @@ tracing-subscriber.workspace = true
 serde = "1"
 serde_json = "1"
 bytes = "1"
+rcgen = { version = "0.14", default-features = false, features = ["aws_lc_rs", "pem"] }
+sha2 = "0.11"
+time.workspace = true
```

**File**: `examples/webtransport/certs/cert.pem` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
------BEGIN CERTIFICATE-----
-MIIEDDCCAnSgAwIBAgIQLu2TV80hCgYgZe18ovEhmzANBgkqhkiG9w0BAQsFADBZ
-MR4wHAYDVQQKExVta2NlcnQgZGV2ZWxvcG1lbnQgQ0ExFzAVBgNVBAsMDmh1eXV1
-bWlAcmlyaWthMR4wHAYDVQQDDBVta2NlcnQgaHV5dXVtaUByaXJpa2EwHhcNMTkw
-NjAxMDAwMDAwWhcNMzAwNTE5MDM0MjI2WjBCMScwJQYDVQQKEx5ta2NlcnQgZGV2
-ZWxvcG1lbnQgY2VydGlmaWNhdGUxFzAVBgNVBAsMDmh1eXV1bWlAcmlyaWthMIIB
-IjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5fRUIbEv2DjBmK7+syGVvh3I
-FWDlVjU9N7ypxauQbXPHAzpATzghLnpm5CqQFoTnJwA4//A85775djcVlsAUqen2
-ZYi+4jTYeuRLrAJ0dkrUS8/7+T0fGzGZ8obCsII5iSE2BMS7AxbqlQtClDdkNwcK
-rCuzrmIyMA8Bc2V231xIgcWFJ7en8OaZJRlYYK7kp2cJ8g0PbPnVq+9TAfFYcKEy
-FWqJsYYY36bLbWyqYXGMOtAh2bhy+YGYL3Jhk+cw7iMCjye4FbDAIQzt9cH1KGGM
-2VWZFiwn6VJquX1Z+n9KAhfzxuzYQHSrlJ+Rt++gezpTtNw8q15Ko78oiu7CLQID
-AQABo2cwZTAOBgNVHQ8BAf8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDAYD
-VR0TAQH/BAIwADAfBgNVHSMEGDAWgBSljCjB0QNrBG+8BV3nFnUyBn54jjAPBgNV
-HREECDAGhwR/AAABMA0GCSqGSIb3DQEBCwUAA4IBgQAsUrfA8deCaHYy7wB1jEVK
-pNZKRNcDKxqr/PXJQlfwwlq1qZTBzloMNTzfVBRkn/I7y+Bj/b1uYFmjQoQ3qG9s
-tIXFCYOop1cLltmWXC479/UtbEmhz0t+mzK0MFkLhxtbKqwvMGbcGGDFI/2/MGZN
-XFZXL1bclFieZxO5ePEkZSDkPcWvh9uYWCp8r7H6aAd/iwH4lDxfajyhDneRmd/v
-Mq0PgqTZhVHOP7JdVNA+6cewROyPL7ElLs66ujE9hsRvs6eXLjgLZrHOZShnoQxK
-JJv8UfoE90FX1uDt9w9i3raig/O3oePNkU263kJlR+J1rdVdYV+pCCb7L4Vk+1l3
-S4VFVGVHN8x35dISCJwZrtnqPlfpCiLjtEJOu1zJUEY2Q0n7Km3z3zQcs6iCeOQi
-O9MVJ4aiALdNvyCG7lL4+AJ/kWbwHFM6wOAKSrkpZ20msMuEgIlhCOi8PgYlKb+b
-V/lV6IJPVrAOOclgcvtfZ/LdsTxn15yLIieqgR0Lf/s=
------END CERTIFICATE-----
```

**File**: `examples/webtransport/certs/key.pem` (removed, +0/-28)
```diff
@@ -1,28 +0,0 @@
------BEGIN PRIVATE KEY-----
-MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDl9FQhsS/YOMGY
-rv6zIZW+HcgVYOVWNT03vKnFq5Btc8cDOkBPOCEuembkKpAWhOcnADj/8Dznvvl2
-NxWWwBSp6fZliL7iNNh65EusAnR2StRLz/v5PR8bMZnyhsKwgjmJITYExLsDFuqV
-C0KUN2Q3BwqsK7OuYjIwDwFzZXbfXEiBxYUnt6fw5pklGVhgruSnZwnyDQ9s+dWr
-71MB8VhwoTIVaomxhhjfpsttbKphcYw60CHZuHL5gZgvcmGT5zDuIwKPJ7gVsMAh
-DO31wfUoYYzZVZkWLCfpUmq5fVn6f0oCF/PG7NhAdKuUn5G376B7OlO03DyrXkqj
-vyiK7sItAgMBAAECggEBAIabZmAukz4zwwe4cDm1kC0wy73P8Y9sLMCivJKMYkff
-vQBjqd91kN7fIbmwPJYiCBlpZPRU0aIqxWZwyj9rgu0Pmn9G884AdzRAzRcMfNX9
-6ZXTUsFMCRhnCaHRRsgCAuIFwdQ6wOoHERxb8gZHAm+/vHyaPFz4+D3vmr7NBy+p
-fgpdDCGwkltKI73efk6H4oAeyztDwNev/TZ3Y+O3UKuAUfVReBX0us/lYgEf/KXV
-USd7envxACy+PDcqmn/HL6IUnbrc1zB92dmSSUUtLjOz//z1zM05ME/E2keMQwsW
-7LDen0Lm0Nh6AcOCxmnN4u0lJ3nWzU7PsHJKY/LznPUCgYEA5kQq/AG6LlL9Iu1E
-Y55AB1rkvseof41liaqXVccB5tr55IF75d0wPd6jF04W+x6LwmL6EUYPRGkkOdHE
-raz9CDE3a7hWbAghxIwLrI1s+faT5aaHG9o6mTeDyfgEEoBg8X2nQHQJPayDJZcW
-kiXQyHEtj/G4m/Y+WDFXastZz8MCgYEA/6c8+cI3Slvg3CZLG9f6rdAlrOSIQynF
-muXyVeUaxrU0OPC9H3WEwWv7n4adQU2g0L6TBTdlOOiv5SPIsOPQVN2JZVdxwg0V
-n5+7/WRrI9rAXnmu1x0q1e/TZ9Msggmrn5SdHaEfuug4DnHv4nct356joDwYB2i3
-xYl+yCSMd08CgYEAqduvOaasiG9/e7w6rqGV6dcK1hDCIxVSyXKloAjlRj5SCFXb
-53x6kakh9ZcNLMEjp4kLnqJnsLc+mcg7pUHuhZSIpVWdqqN1BV+pXOgWc22JO+bT
-05/vigaBmQLzPhKlcH6YWds+1dfkBl6lr7llgfa6/Wv6GlJTOwtqyMSow7ECgYEA
-zGQ8j8ICymRihh/ndL9cH5KGTI/5kRjYb1rgQGQG4E8HDW8LBRfDp5BZf9Tz7L3P
-kJSMnmMHflQqLJxLW4EHkpH7wxYCUQ589z2R4qhiMCw4GFBYxIsBMEGpVxyyPNTW
-baM3afTjlV8LUiEtlHWMK3h9gSIKZAIIytl+jy0JUGkCgYA3wrpcG3wgXeuEtoie
-ve/kFS5JRaOeV/9OLE2JGaGaumPlN0L14kCVvb6uqLa/P88BwBUxvGQ7FDBdh4sk
-ypuSe9ZPCNDgnsbnfM8QgFqIW6MDdizLtj7no1SKeaUU3JWWc0kH2KWMw/sYZ7ec
-0tcEInxEd7FbssGfMqF9fQtnNw==
------END PRIVATE KEY-----
```

**File**: `examples/webtransport/src/main.rs` (modified, +65/-4)
```diff
@@ -2,9 +2,12 @@ use std::time::Duration;
 
 use anyhow::{Context, Result};
 use bytes::Bytes;
+use rcgen::{CertificateParams, KeyPair};
 use salvo::conn::rustls::{Keycert, RustlsConfig};
 use salvo::prelude::*;
 use salvo::proto::webtransport;
+use sha2::{Digest, Sha256};
+use time::{Duration as TimeDuration, OffsetDateTime};
 use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
 use tokio::pin;
 
@@ -15,6 +18,41 @@ macro_rules! log_result {
         }
     };
 }
+
+#[derive(Debug)]
+struct CertificateHash([u8; 32]);
+
+#[handler]
+impl CertificateHash {
+    async fn handle(&self) -> Json<[u8; 32]> {
+        Json(self.0)
+    }
+}
+
+fn certificate_params(now: OffsetDateTime) -> Result<CertificateParams> {
+    let mut params = CertificateParams::new(vec!["localhost".to_owned(), "127.0.0.1".to_owned()])?;
+    // WebTransport permits certificate hashes only for short-lived certificates. Backdating by
+    // one minute tolerates small clock differences while keeping the total lifetime under 14 days.
+    params.not_before = now - TimeDuration::minutes(1);
+    params.not_after = now + TimeDuration::days(13);
+    Ok(params)
+}
+
+fn generate_certificate() -> Result<(RustlsConfig, CertificateHash)> {
+    let params = certificate_params(OffsetDateTime::now_utc())?;
+    let signing_key = KeyPair::generate()?;
+    let certificate = params.self_signed(&signing_key)?;
+    let certificate_hash = Sha256::digest(certificate.der().as_ref()).into();
+    let keycert = Keycert::new()
+        .cert(certificate.pem().into_bytes())
+        .key(signing_key.serialize_pem().into_bytes());
+
+    Ok((
+        RustlsConfig::new(keycert),
+        CertificateHash(certificate_hash),
+    ))
+}
+
 async fn echo_stream<T, R>(send: T, recv: R) -> anyhow::Result<()>
 where
     T: AsyncWrite,
@@ -116,20 +154,19 @@ where
 }
 
 #[tokio::main]
-async fn main() {
+async fn main() -> Result<()> {
     tracing_subscriber::fmt().init();
 
-    let cert = include_bytes!("../certs/cert.pem").to_vec();
-    let key = include_bytes!("../certs/key.pem").to_vec();
+    let (config, certificate_hash) = generate_certificate()?;
 
     let router = Router::new()
         .push(Router::with_path("counter").goal(connect))
+        .push(Router::with_path("certificate-hash").get(certificate_hash))
         .push(
             Router::with_path("{*path}")
                 .get(StaticDir::new(["webtransport/static", "./static"]).defaults("client.html")),
         );
 
-    let config = RustlsConfig::new(Keycert::new().cert(cert.as_slice()).key(key.as_slice()));
     let listener = TcpListener::new(("0.0.0.0", 8698)).rustls(config.clone());
 
     let acceptor = QuinnListener::new(config, ("0.0.0.0", 8698))
@@ -138,4 +175,28 @@ async fn main() {
         .await;
 
     Server::new(acceptor).serve(router).await;
+    Ok(())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn certificate_parameters_meet_webtransport_requirements() {
+        let now = OffsetDateTime::now_utc();
+        let params = certificate_params(now).unwrap();
+
+        assert!(params.not_before <= now);
+        assert!(params.not_after >= now);
+        assert!(params.not_after - params.not_before < TimeDuration::days(14));
+    }
+
+    #[test]
+    fn generated_certificate_builds_a_quinn_config() {
+        let (config, certificate_hash) = generate_certificate().unwrap();
+
+        assert_ne!(certificate_hash.0, [0; 32]);
+        config.build_quinn_config().unwrap();
+    }
 }
```

**File**: `examples/webtransport/static/client.html` (modified, +4/-3)
```diff
@@ -2,15 +2,16 @@
 <html lang="en">
   <title>WebTransport over HTTP/3 client</title>
   <meta charset="utf-8">
-  <!-- WebTransport origin trial token. See https://developer.chrome.com/origintrials/#/view_trial/793759434324049921 -->
-  <meta http-equiv="origin-trial" content="AkSQvBVsfMTgBtlakApX94hWGyBPQJXerRc2Aq8g/sKTMF+yG62+bFUB2yIxaK1furrNH3KNNeJV00UZSZHicw4AAABceyJvcmlnaW4iOiJodHRwczovL2dvb2dsZWNocm9tZS5naXRodWIuaW86NDQzIiwiZmVhdHVyZSI6IldlYlRyYW5zcG9ydCIsImV4cGlyeSI6MTY0Mzc1OTk5OX0=">
   <script src="client.js"></script>
   <link rel="stylesheet" href="client.css">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <body>
   <div id="top">
     <div id="explanation">
       This tool can be used to connect to an arbitrary WebTransport server.
+      The example generates a short-lived development certificate at startup and
+      automatically supplies its hash to the browser. You may need to accept the
+      HTTPS warning for this page before connecting.
       It has several limitations:
       <ul>
         <li>It can only send an entirety of a stream at once.  Once the stream
@@ -63,4 +64,4 @@ <h2>Event log</h2>
     </div>
   </div>
   </body>
-</html>
\ No newline at end of file
+</html>
```

---

### Incident Patch 5: `1f59eff0` (2026-08-10)
**Commit Message**: Fix closed problem extension schemas (#1692)

**File**: `crates/oapi/src/lib.rs` (modified, +46/-21)
```diff
@@ -801,6 +801,37 @@ fn problem_base_schema(components: &mut Components) -> RefOr<schema::Schema> {
         .into()
 }
 
+#[cfg(feature = "rfc9457")]
+fn problem_schema_with_extensions(
+    components: &Components,
+    base: RefOr<schema::Schema>,
+    extensions: RefOr<schema::Schema>,
+) -> RefOr<schema::Schema> {
+    let extension_schema = match &extensions {
+        RefOr::Type(schema) => Some(schema),
+        RefOr::Ref(reference) => reference
+            .ref_location
+            .strip_prefix("#/components/schemas/")
+            .and_then(|name| components.schemas.get(name))
+            .and_then(|schema| match schema {
+                RefOr::Type(schema) => Some(schema),
+                RefOr::Ref(_) => None,
+            }),
+    };
+
+    if let Some(schema::Schema::Object(extension)) = extension_schema {
+        let RefOr::Type(schema::Schema::Object(base)) = base else {
+            unreachable!("problem base schema must be an object")
+        };
+        let mut extension = extension.clone();
+        extension.properties.extend(base.properties);
+        extension.required.extend(base.required);
+        return RefOr::Type(schema::Schema::Object(extension));
+    }
+
+    schema::AllOf::new().item(base).item(extensions).into()
+}
+
 #[cfg(feature = "rfc9457")]
 impl ToSchema for NoExtensions {
     fn to_schema(_components: &mut Components) -> RefOr<schema::Schema> {
@@ -836,10 +867,9 @@ where
             let schema = if TypeId::of::<Extensions>() == TypeId::of::<NoExtensions>() {
                 problem_base_schema(components)
             } else {
-                schema::AllOf::new()
-                    .item(problem_base_schema(components))
-                    .item(Extensions::to_schema(components))
-                    .into()
+                let extensions = Extensions::to_schema(components);
+                let base = problem_base_schema(components);
+                problem_schema_with_extensions(components, base, extensions)
             };
             components.schemas.insert(name, schema);
         }
@@ -864,7 +894,7 @@ where
                 .first()
                 .cloned()
                 .unwrap_or_else(|| Extensions::compose(components, vec![]));
-            schema::AllOf::new().item(base).item(extensions).into()
+            problem_schema_with_extensions(components, base, extensions)
         }
     }
 }
@@ -1314,7 +1344,8 @@ mod tests {
     #[cfg(feature = "rfc9457")]
     #[test]
     fn test_problem_schema_composes_typed_extensions() {
-        #[derive(ToSchema)]
+        #[derive(serde::Serialize, ToSchema)]
+        #[serde(deny_unknown_fields)]
         #[allow(dead_code)]
         struct ValidationExtensions {
             errors: Vec<String>,
@@ -1336,21 +1367,15 @@ mod tests {
             .expect("typed problem component should exist");
         let schema = serde_json::to_value(schema).expect("schema should serialize");
 
-        assert_eq!(schema["allOf"].as_array().map(Vec::len), Some(2));
-        let extension_ref = schema["allOf"][1]["$ref"]
-            .as_str()
-            .expect("extension schema should use a component reference");
-        let extension_name = extension_ref
-            .rsplit('/')
-            .next()
-            .expect("extension reference should have a name");
-        let extension_schema = components
-            .schemas
-            .get(extension_name)
-            .expect("extension component should exist");
-        let extension_schema =
-            serde_json::to_value(extension_schema).expect("extension schema should serialize");
-        assert_eq!(extension_schema["properties"]["errors"]["type"], "array");
+        assert!(schema.get("allOf").is_none());
+        assert_eq!(schema["type"], "object");
+        assert_eq!(schema["additionalProperties"], false);
+        assert_eq!(schema["properties"]["errors"]["type"], "array");
+        assert_eq!(schema["properties"]["status"]["type"], "integer");
+        
```

---

### Incident Patch 6: `2552db30` (2026-08-06)
**Commit Message**: docs: fix doubled words in oapi endpoint and operation docs (#1689)

**File**: `crates/oapi/docs/endpoint.md` (modified, +4/-4)
```diff
@@ -177,19 +177,19 @@ _**Example request body definitions.**_
 
 * `operation_ref = ...` Define a relative or absolute URI reference to an OAS operation. This field is
   mutually exclusive of the _`operation_id`_ field, and **must** point to an [Operation Object][operation].
-  Value can be be [`str`] or an expression such as [`include_str!`][include_str] or static
+  Value can be [`str`] or an expression such as [`include_str!`][include_str] or static
   [`const`][const] reference.
 
 * `operation_id = ...` Define the name of an existing, resolvable OAS operation, as defined with a unique
   _`operation_id`_. This field is mutually exclusive of the _`operation_ref`_ field.
-  Value can be be [`str`] or an expression such as [`include_str!`][include_str] or static
+  Value can be [`str`] or an expression such as [`include_str!`][include_str] or static
   [`const`][const] reference.
 
 * `parameters(...)` A map representing parameters to pass to an operation as specified with _`operation_id`_
   or identified by _`operation_ref`_. The key is parameter name to be used and value can
   be any value supported by JSON or an [expression][expression] e.g. `$path.id`
     * `name = ...` Define name for the parameter.
-      Value can be be [`str`] or an expression such as [`include_str!`][include_str] or static
+      Value can be [`str`] or an expression such as [`include_str!`][include_str] or static
       [`const`][const] reference.
     * `value` = Any value that can be supported by JSON or an [expression][expression].
 
@@ -204,7 +204,7 @@ _**Example request body definitions.**_
 * `request_body = ...` Define a literal value or an [expression][expression] to be used as request body when
   operation is called
 
-* `description = ...` Define description of the link. Value supports Markdown syntax.Value can be be [`str`] or
+* `description = ...` Define description of the link. Value supports Markdown syntax.Value can be [`str`] or
   an expression such as [`include_str!`][include_str] or static [`const`][const] reference.
 
 * `server(...)` Define [Server][server] object to be used by the target operation.
```

**File**: `crates/oapi/src/openapi/operation.rs` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ pub struct Operation {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub deprecated: Option<Deprecated>,
 
-    /// Declaration which security mechanisms can be used for for the operation. Only one
+    /// Declaration which security mechanisms can be used for the operation. Only one
     /// [`SecurityRequirement`] must be met.
     ///
     /// Security for the [`Operation`] can be set to optional by adding empty security with
```

---

### Incident Patch 7: `96683d71` (2026-07-14)
**Commit Message**: Fix WebTransport session handoff (#1671)

**File**: `crates/core/src/conn/quinn/builder.rs` (modified, +62/-18)
```diff
@@ -18,6 +18,21 @@ use crate::http::Method;
 use crate::http::body::{H3ReqBody, ReqBody};
 use crate::proto::WebTransportSession;
 
+fn take_unique_arc_extension<T>(
+    extensions: &mut http::Extensions,
+    name: &'static str,
+) -> IoResult<Option<T>>
+where
+    T: Send + Sync + 'static,
+{
+    match extensions.remove::<Arc<T>>() {
+        Some(value) => Arc::into_inner(value)
+            .map(Some)
+            .ok_or_else(|| IoError::other(format!("{name} is still shared"))),
+        None => Ok(None),
+    }
+}
+
 /// Builder used to serve HTTP/3 connections.
 pub struct Builder {
     inner: salvo_http3::server::Builder,
@@ -255,9 +270,9 @@ async fn process_web_transport(
 
     let conn;
     let stream;
-    if let Some(session) = response
-        .extensions_mut()
-        .remove::<WebTransportSession<salvo_http3::quinn::Connection, Bytes>>()
+    if let Some(session) = take_unique_arc_extension::<
+        WebTransportSession<salvo_http3::quinn::Connection, Bytes>,
+    >(response.extensions_mut(), "WebTransport session")?
     {
         let (server_conn, connect_stream) = session.split();
 
@@ -268,24 +283,20 @@ async fn process_web_transport(
         );
         stream = Some(connect_stream);
     } else {
-        conn = response
-            .extensions_mut()
-            .remove::<Arc<Mutex<salvo_http3::server::Connection<salvo_http3::quinn::Connection, Bytes>>>>()
+        conn = take_unique_arc_extension::<
+            Mutex<salvo_http3::server::Connection<salvo_http3::quinn::Connection, Bytes>>,
+        >(response.extensions_mut(), "HTTP/3 connection")?
             .map(|c| {
-                Arc::into_inner(c).expect("HTTP/3 connection must exist").into_inner()
-                    .map_err(|e| IoError::other( format!("failed to get conn : {e}")))
+                c.into_inner()
+                    .map_err(|e| IoError::other(format!("failed to get conn : {e}")))
             })
             .transpose()?;
-        stream =
-            response
-                .extensions_mut()
-                .remove::<Arc<
-                    salvo_http3::server::RequestStream<
-                        salvo_http3::quinn::BidiStream<Bytes>,
-                        Bytes,
-                    >,
-                >>()
-                .and_then(Arc::into_inner);
+        stream = take_unique_arc_extension::<
+            salvo_http3::server::RequestStream<
+                salvo_http3::quinn::BidiStream<Bytes>,
+                Bytes,
+            >,
+        >(response.extensions_mut(), "WebTransport request stream")?;
     }
 
     let Some(conn) = conn else {
@@ -390,3 +401,36 @@ where
         .await
         .map_err(|e| IoError::other(format!("failed to finish stream : {e}")))
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[derive(Debug, Eq, PartialEq)]
+    struct NonClone(&'static str);
+
+    #[test]
+    fn take_unique_arc_extension_returns_owned_value() {
+        let mut extensions = http::Extensions::new();
+        extensions.insert(Arc::new(NonClone("session")));
+
+        let value = take_unique_arc_extension::<NonClone>(&mut extensions, "test value")
+            .expect("unique Arc should be unwrapped");
+
+        assert_eq!(value, Some(NonClone("session")));
+        assert!(extensions.get::<Arc<NonClone>>().is_none());
+    }
+
+    #[test]
+    fn take_unique_arc_extension_rejects_shared_value() {
+        let mut extensions = http::Extensions::new();
+        let value = Arc::new(NonClone("session"));
+        let _shared = value.clone();
+        extensions.insert(value);
+
+        let error = take_unique_arc_extension::<NonClone>(&mut extensions, "test value")
+            .expect_err("shared Arc should not be silently discarded");
+
+        assert_eq!(error.to_string(), "test value is still shared");
+    }
+}
```

**File**: `crates/core/src/http/request.rs` (modified, +6/-4)
```diff
@@ -700,8 +700,10 @@ impl Request {
 
         /// Try to get a WebTransport session from the request.
         pub async fn web_transport_mut(&mut self) -> Result<&mut crate::proto::WebTransportSession<salvo_http3::quinn::Connection, Bytes>, crate::Error> {
+            type Session = crate::proto::WebTransportSession<salvo_http3::quinn::Connection, Bytes>;
+
             if self.is_wt_connect() {
-                if self.extensions.get::<crate::proto::WebTransportSession<salvo_http3::quinn::Connection, Bytes>>().is_none() {
+                if self.extensions.get::<Arc<Session>>().is_none() {
                     let conn = self.extensions.remove::<Arc<std::sync::Mutex<salvo_http3::server::Connection<salvo_http3::quinn::Connection, Bytes>>>>();
                     let stream = self.extensions.remove::<Arc<salvo_http3::server::RequestStream<salvo_http3::quinn::BidiStream<Bytes>, Bytes>>>();
                     match (conn, stream) {
@@ -711,7 +713,7 @@ impl Request {
                                     if let Some(stream) = Arc::into_inner(stream) {
                                         let session =  crate::proto::WebTransportSession::accept(stream, conn).await?;
                                         self.extensions.insert(Arc::new(session));
-                                        if let Some(session) = self.extensions.get_mut::<Arc<crate::proto::WebTransportSession<salvo_http3::quinn::Connection, Bytes>>>() {
+                                        if let Some(session) = self.extensions.get_mut::<Arc<Session>>() {
                                             if let Some(session) = Arc::get_mut(session) {
                                                 Ok(session)
                                             } else {
@@ -740,8 +742,8 @@ impl Request {
                         }
                         (None, None) => Err(crate::Error::Other("invalid web transport without connection and stream".into())),
                     }
-                } else if let Some(session) = self.extensions.get_mut::<crate::proto::WebTransportSession<salvo_http3::quinn::Connection, Bytes>>() {
-                    Ok(session)
+                } else if let Some(session) = self.extensions.get_mut::<Arc<Session>>() {
+                    Arc::get_mut(session).ok_or_else(|| crate::Error::Other("web transport session should not used twice".into()))
                 } else {
                     Err(crate::Error::Other("invalid web transport".into()))
                 }
```

---

### Incident Patch 8: `fa3768eb` (2026-07-13)
**Commit Message**: Fix JWT crypto provider feature selection (#1667)

* fix jwt crypto provider feature selection

* keep a provider on the jwt full feature

* fail fast when no jwt crypto provider is enabled

* separate jwt and tls crypto provider features

* select a deterministic jwt crypto provider

* disable jwt defaults for ring provider

* initialize jwt provider in decoder constructor

* initialize rustls provider for oidc

* make jwt provider initialization explicit

* clarify jwt provider initialization timing

**File**: `crates/jwt-auth/Cargo.toml` (modified, +18/-8)
```diff
@@ -19,22 +19,30 @@ all-features = true
 rustdoc-args = ["--cfg", "docsrs"]
 
 [features]
-default = []
-full = ["oidc", "ring"]
+default = ["aws-lc-rs"]
+full = ["oidc", "aws-lc-rs"]
 oidc = [
     "dep:bytes",
     "hyper-rustls",
     "dep:hyper-util",
     "dep:http-body-util",
-    "ring",
+    "dep:rustls",
+]
+aws-lc-rs = [
+    "hyper-rustls?/aws-lc-rs",
+    "rustls?/aws-lc-rs",
+    "jsonwebtoken/aws_lc_rs",
+]
+ring = [
+    "hyper-rustls?/ring",
+    "rustls?/ring",
+    "jsonwebtoken/rust_crypto",
 ]
-# aws-lc-rs = ["hyper-rustls?/aws-lc-rs"]
-ring = ["hyper-rustls?/ring"]
 
 [dependencies]
 base64 = { workspace = true }
 bytes = { workspace = true, optional = true }
-jsonwebtoken = { workspace = true, features = ["aws_lc_rs"] }
+jsonwebtoken = { workspace = true }
 http-body-util = { workspace = true, optional = true }
 hyper-rustls = { workspace = true, optional = true, features = [
     "native-tokio",
@@ -50,6 +58,7 @@ hyper-util = { workspace = true, optional = true, features = [
     "http2",
     "tokio",
 ] }
+rustls = { workspace = true, optional = true }
 salvo_core = { workspace = true, features = ["cookie"] }
 serde = { workspace = true, features = ["derive"] }
 serde_json = { workspace = true }
@@ -59,10 +68,11 @@ tracing = { workspace = true }
 
 [dev-dependencies]
 anyhow.workspace = true
-salvo = { path = "../salvo", features = [
+salvo = { path = "../salvo", default-features = false, features = [
     "http1",
+    "server",
     "test",
-    "jwt-auth",
+    "_jwt-auth",
     "anyhow",
 ] }
 time.workspace = true
```

**File**: `crates/jwt-auth/README.md` (modified, +39/-1)
```diff
@@ -57,14 +57,49 @@ This is an official crate, so you can enable it in `Cargo.toml`:
 salvo = { version = "*", features = ["jwt-auth"] }
 ```
 
+Salvo uses `aws-lc-rs` as its default cryptography provider. To use the
+RustCrypto provider for JWTs instead, disable Salvo's default features and
+select `jwt-auth-ring`. The separate `ring` feature selects ring for Salvo's
+rustls integration:
+
+```toml
+salvo = { version = "*", default-features = false, features = [
+    "server",
+    "http1",
+    "ring",
+    "jwt-auth-ring",
+] }
+```
+
+Enable only one of `jwt-auth` and `jwt-auth-ring` in normal builds. Cargo
+features are additive, so an `--all-features` build or another dependency can
+still enable both `jsonwebtoken` providers. In that case, install Salvo's
+selected provider at the very start of the process, before any JWT operation.
+This includes validation performed internally by `JwtAuth`, `ConstDecoder`, or
+`OidcDecoder`, as well as direct `jsonwebtoken::encode` or
+`jsonwebtoken::decode` calls:
+
+```rust
+fn main() {
+    salvo::jwt_auth::install_crypto_provider()
+        .expect("install the JWT crypto provider before first use");
+
+    // Initialize the rest of the application here.
+}
+```
+
+AWS-LC takes precedence when both Salvo JWT provider features are enabled. If
+the application uses a custom process-wide `jsonwebtoken` provider, install
+that provider itself instead of calling `install_crypto_provider`.
+
 ## Quick Start
 
 Use `HeaderFinder` for the standard `Authorization: Bearer <token>` header.
 `force_passed(true)` lets the request reach your handler so the handler can
 decide how to respond to authorized, unauthorized, and forbidden states.
 
 ```rust
-use salvo::jwt_auth::{ConstDecoder, HeaderFinder, JwtAuthState};
+use salvo::jwt_auth::{ConstDecoder, HeaderFinder, JwtAuthState, install_crypto_provider};
 use salvo::prelude::*;
 use serde::{Deserialize, Serialize};
 
@@ -90,6 +125,9 @@ async fn me(depot: &mut Depot, res: &mut Response) {
 
 #[tokio::main]
 async fn main() {
+    install_crypto_provider()
+        .expect("install the JWT crypto provider before first use");
+
     let auth = JwtAuth::<Claims, _>::new(ConstDecoder::from_secret(SECRET))
         .finders(vec![Box::new(HeaderFinder::new())])
         .force_passed(true);
```

**File**: `crates/jwt-auth/src/decoder.rs` (modified, +1/-4)
```diff
@@ -65,10 +65,7 @@ impl ConstDecoder {
     /// Creates a new decoder with the given decoding key and default validation.
     #[must_use]
     pub fn new(decoding_key: DecodingKey) -> Self {
-        Self {
-            decoding_key,
-            validation: Validation::default(),
-        }
+        Self::with_validation(decoding_key, Validation::default())
     }
 
     /// Creates a new decoder with the given decoding key and custom validation parameters.
```

**File**: `crates/jwt-auth/src/lib.rs` (modified, +59/-37)
```diff
@@ -12,6 +12,15 @@
 //! - OpenID Connect support (behind the `oidc` feature flag)
 //! - Seamless integration with Salvo's middleware system
 //!
+//! # Crypto Providers
+//!
+//! Enable exactly one provider feature in normal builds: `aws-lc-rs` (the
+//! default) or `ring` for RustCrypto. If dependency feature unification enables
+//! both providers, call [`install_crypto_provider`] at the start of `main`,
+//! before any JWT operation. This includes validation performed internally by
+//! [`JwtAuth`], [`ConstDecoder`], or `OidcDecoder`, as well
+//! as direct `jsonwebtoken` encode or decode calls.
+//!
 //! # Security Considerations
 //!
 //! **Warning: avoid passing JWT tokens in URL query parameters in production.**
@@ -35,7 +44,7 @@
 //! ```no_run
 //! use jsonwebtoken::{self, EncodingKey};
 //! use salvo::http::{Method, StatusError};
-//! use salvo::jwt_auth::{ConstDecoder, HeaderFinder};
+//! use salvo::jwt_auth::{ConstDecoder, HeaderFinder, install_crypto_provider};
 //! use salvo::prelude::*;
 //! use serde::{Deserialize, Serialize};
 //! use time::{Duration, OffsetDateTime};
@@ -50,6 +59,9 @@
 //!
 //! #[tokio::main]
 //! async fn main() {
+//!     install_crypto_provider()
+//!         .expect("install the JWT crypto provider before first use");
+//!
 //!     let auth_handler: JwtAuth<JwtClaims, _> = JwtAuth::new(ConstDecoder::from_secret(SECRET_KEY.as_bytes()))
 //!         .finders(vec![Box::new(HeaderFinder::new())])
 //!         .force_passed(true);
@@ -133,6 +145,11 @@
 #![doc(html_logo_url = "https://salvo.rs/images/logo.svg")]
 #![cfg_attr(docsrs, feature(doc_cfg))]
 
+#[cfg(not(any(feature = "aws-lc-rs", feature = "ring")))]
+compile_error!(
+    "salvo-jwt-auth requires a crypto provider; enable either the `aws-lc-rs` (default) or `ring` feature"
+);
+
 use std::fmt::{self, Debug, Formatter};
 use std::marker::PhantomData;
 
@@ -147,6 +164,36 @@ use salvo_core::{Depot, FlowCtrl, Handler, async_trait};
 use serde::de::DeserializeOwned;
 use thiserror::Error;
 
+/// Installs the crypto provider selected by this crate for the current process.
+///
+/// Call this at the start of `main`, before any JWT operation, when dependency
+/// feature unification enables both JWT provider backends. This includes token
+/// validation performed internally by [`JwtAuth`], [`ConstDecoder`], or
+/// `OidcDecoder`, not only direct `jsonwebtoken` calls.
+/// AWS-LC takes precedence when both this crate's provider features are enabled.
+///
+/// Applications that install a custom [`jsonwebtoken::crypto::CryptoProvider`]
+/// should do that instead and must not call this function afterwards.
+///
+/// # Errors
+///
+/// Returns the provider this function attempted to install if a process-wide
+/// provider was already installed or initialized. Since `jsonwebtoken` only
+/// permits one installation, an error means this function was not called early
+/// enough or another provider was intentionally installed first.
+pub fn install_crypto_provider() -> Result<(), &'static jsonwebtoken::crypto::CryptoProvider> {
+    #[cfg(feature = "aws-lc-rs")]
+    {
+        jsonwebtoken::crypto::aws_lc::DEFAULT_PROVIDER.install_default()
+    }
+    #[cfg(all(not(feature = "aws-lc-rs"), feature = "ring"))]
+    {
+        jsonwebtoken::crypto::rust_crypto::DEFAULT_PROVIDER.install_default()
+    }
+    #[cfg(not(any(feature = "aws-lc-rs", feature = "ring")))]
+    unreachable!("a crypto provider feature is required")
+}
+
 mod finder;
 pub use finder::{CookieFinder, FormFinder, HeaderFinder, JwtTokenFinder, QueryFinder};
 
@@ -473,17 +520,17 @@ mod tests {
         exp: i64,
     }
 
+    fn encode_test_token<T: Serialize>(claims: &T, key: &EncodingKey) -> String {
+        let _ = install_crypto_provider();
+        jsonwebtoken::encode(&jsonwebtoken::Header::default(), claims, key).unwrap()
+    }
+
     fn create_test_token(secret: &[u8], exp_days: i64) -> String {
         let claim = JwtClaims {
             user: "test_user".into(),
     
```

**File**: `crates/jwt-auth/src/oidc.rs` (modified, +18/-1)
```diff
@@ -35,7 +35,7 @@ const OIDC_JWKS_MAX_BYTES: usize = 1024 * 1024;
 
 fn default_http_client() -> Result<HyperClient, JwtAuthError> {
     let https = HttpsConnectorBuilder::new()
-        .with_native_roots()
+        .with_provider_and_native_roots(default_rustls_crypto_provider())
         .map_err(|error| JwtAuthError::NativeRootCerts(error.to_string()))?
         .https_only()
         .enable_http1()
@@ -46,6 +46,23 @@ fn default_http_client() -> Result<HyperClient, JwtAuthError> {
     Ok(Client::builder(TokioExecutor::new()).build(https))
 }
 
+fn default_rustls_crypto_provider() -> Arc<rustls::crypto::CryptoProvider> {
+    if let Some(provider) = rustls::crypto::CryptoProvider::get_default() {
+        return Arc::clone(provider);
+    }
+
+    #[cfg(feature = "aws-lc-rs")]
+    {
+        Arc::new(rustls::crypto::aws_lc_rs::default_provider())
+    }
+    #[cfg(all(not(feature = "aws-lc-rs"), feature = "ring"))]
+    {
+        Arc::new(rustls::crypto::ring::default_provider())
+    }
+    #[cfg(not(any(feature = "aws-lc-rs", feature = "ring")))]
+    unreachable!("a crypto provider feature is required")
+}
+
 fn resolve_or_else<T, E>(
     provided: Option<T>,
     build_default: impl FnOnce() -> Result<T, E>,
```

---

### Incident Patch 9: `f71539f8` (2026-07-05)
**Commit Message**: fix(serve-static): entity-escape listing text and drop render-path panics (#1643)

Two hygiene issues in the auto directory listing (off by default):

- Visible text nodes (file/dir names, breadcrumb segments, page title)
  were percent-encoded via `encode_url_path`. That set happens to cover
  the markup-significant characters today, but percent-encoding is a
  URL escaper, not an HTML one — the safety property was incidental
  rather than by construction, and non-ASCII names rendered as
  unreadable `%xx` runs. Text nodes now use the entity escaper
  (`xml_escape`, whose escape set is exactly the five XML/HTML special
  characters); hrefs keep percent-encoding as before.

- Six `OffsetDateTime::format(...).expect("format time failed")` calls
  sat on the serving path. The timestamps come from filesystem
  metadata, not request input, so they are not attacker-triggerable —
  but a panic has no place in a request handler; they now degrade to a
  "-" placeholder.

Adds a renderer test asserting names like `a&b'<c>.txt` appear
entity-escaped and never as raw markup.

Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `crates/serve-static/src/dir.rs` (modified, +46/-17)
```diff
@@ -667,7 +667,7 @@ fn list_xml(current: &CurrentInfo) -> String {
                 xml,
                 "<dir><name>{}</name><modified>{}</modified><link>{}</link></dir>",
                 xml_escape(&dir.name),
-                dir.modified.format(&format).expect("format time failed"),
+                dir.modified.format(&format).unwrap_or_else(|_| "-".into()),
                 encode_url_path(&dir.name),
             );
         }
@@ -676,7 +676,7 @@ fn list_xml(current: &CurrentInfo) -> String {
                 xml,
                 "<file><name>{}</name><modified>{}</modified><size>{}</size><link>{}</link></file>",
                 xml_escape(&file.name),
-                file.modified.format(&format).expect("format time failed"),
+                file.modified.format(&format).unwrap_or_else(|_| "-".into()),
                 file.size,
                 encode_url_path(&file.name),
             );
@@ -694,6 +694,9 @@ fn is_safe_relative_path(path: &str) -> bool {
             .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
 }
 
+/// Escape the five XML special characters. Also used for HTML text nodes and
+/// the page title in the directory listing: the escape set is identical, and
+/// unlike percent-encoding it is an actual markup escaper.
 fn xml_escape(value: &str) -> String {
     let mut escaped = String::with_capacity(value.len());
     for ch in value.chars() {
@@ -735,10 +738,12 @@ fn list_html(current: &CurrentInfo) -> String {
             .trim_end_matches('/')
             .split('/')
         {
-            let encoded = encode_url_path(seg);
+            // URL-encode the href, but entity-escape the visible text: percent
+            // encoding is a URL escaper, not an HTML one, and it also renders
+            // non-ASCII names as unreadable `%xx` runs.
             link.push('/');
-            link.push_str(&encoded);
-            let _ = write!(out, r#"/<a href="{link}">{encoded}</a>"#);
+            link.push_str(&encode_url_path(seg));
+            let _ = write!(out, r#"/<a href="{link}">{}</a>"#, xml_escape(seg));
         }
     }
     let mut html = format!(
@@ -747,7 +752,7 @@ fn list_html(current: &CurrentInfo) -> String {
         <meta name="viewport" content="width=device-width">
         <title>{}</title>
         <style>{}</style></head><body><header><h3>Index of: "#,
-        encode_url_path(&current.path),
+        xml_escape(&current.path),
         HTML_STYLE,
     );
     header_link(&mut html, &current.path);
@@ -765,25 +770,23 @@ fn list_html(current: &CurrentInfo) -> String {
         );
         let format = format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");
         for dir in &current.dirs {
-            let encoded = encode_url_path(&dir.name);
             let _ = write!(
                 html,
                 r#"<tr><td>{}</td><td><a href="./{}/">{}</a></td><td>{}</td><td></td></tr>"#,
                 DIR_ICON,
-                encoded,
-                encoded,
-                dir.modified.format(&format).expect("format time failed"),
+                encode_url_path(&dir.name),
+                xml_escape(&dir.name),
+                dir.modified.format(&format).unwrap_or_else(|_| "-".into()),
             );
         }
         for file in &current.files {
-            let encoded = encode_url_path(&file.name);
             let _ = write!(
                 html,
                 r#"<tr><td>{}</td><td><a href="./{}">{}</a></td><td>{}</td><td>{}</td></tr>"#,
                 FILE_ICON,
-                encoded,
-                encoded,
-                file.modified.format(&format).expect("format time failed"),
+                encode_url_path(&file.name),
+                xml_escape(&file.name),
+                file.modified.format(&format).unwrap_or_else(|_| "-".into()),
                 human_size(file.size)
             );
         }
@@ -803,7 +806,7 @@ fn list_text(current: &CurrentInfo) -> String {
         let
```

---

### Incident Patch 10: `fb424058` (2026-07-05)
**Commit Message**: fix(oapi): accept singular and plural parameter keys interchangeably (#1646)

`#[derive(ToParameters)]` spelled its container config `parameters(...)`
but its field config `parameter(...)`, and each level hard-rejected (or
silently ignored) the other spelling — the container even emitted a
"Did you mean `parameters`?" error. Users had to remember plural-on-
struct, singular-on-field for the same concept.

Both spellings are now accepted at both levels via a small
`find_nested_list_any` helper, so the drift is invisible: whichever you
type works. Fully backward compatible — the previous canonical spellings
are unchanged and still recommended; the opposite spelling is just no
longer an error. Drops the now-obsolete container-level rejection.

response/schema derives already use one spelling at both levels, so they
need no change.

Adds a test driving each level with its alias spelling
(`parameter(...)` on the container, `parameters(...)` on a field).

Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `crates/oapi-macros/src/attribute.rs` (modified, +13/-1)
```diff
@@ -2,10 +2,22 @@ use syn::punctuated::Punctuated;
 use syn::{Attribute, Meta, MetaList, Token};
 
 pub(crate) fn find_nested_list(attr: &Attribute, ident: &str) -> syn::Result<Option<MetaList>> {
+    find_nested_list_any(attr, &[ident])
+}
+
+/// Like [`find_nested_list`], but matches any of several accepted idents.
+///
+/// Used to accept both spellings of keys that historically drifted between
+/// singular and plural (e.g. `parameter` / `parameters`), so the same key works
+/// on both the container and its fields.
+pub(crate) fn find_nested_list_any(
+    attr: &Attribute,
+    idents: &[&str],
+) -> syn::Result<Option<MetaList>> {
     let metas = attr.parse_args_with(Punctuated::<Meta, Token![,]>::parse_terminated)?;
     for meta in metas {
         if let Meta::List(meta) = meta
-            && meta.path.is_ident(ident)
+            && idents.iter().any(|ident| meta.path.is_ident(ident))
         {
             return Ok(Some(meta));
         }
```

**File**: `crates/oapi-macros/src/parameter/derive.rs` (modified, +8/-18)
```diff
@@ -73,12 +73,15 @@ impl TryToTokens for ToParameters {
         ex_generics.params.insert(0, ex_lifetime);
         let ex_impl_generics = ex_generics.split_for_impl().0;
 
+        // Container-level config is spelled `parameters(...)`, but the singular
+        // `parameter(...)` is accepted as an alias so the key matches its
+        // field-level counterpart (see `resolve_field_features`).
         let mut parameters_features = self
             .attrs
             .iter()
             .filter(|attr| attr.path().is_ident("salvo"))
             .filter_map(|attr| {
-                attribute::find_nested_list(attr, "parameters")
+                attribute::find_nested_list_any(attr, &["parameters", "parameter"])
                     .ok()
                     .flatten()
             })
@@ -92,22 +95,6 @@ impl TryToTokens for ToParameters {
             .reduce(|acc, item| acc.merge(item));
         let serde_container = serde_util::parse_container(&self.attrs).map_err(Diagnostic::from)?;
 
-        // #[param] is only supported over fields
-        if self.attrs.iter().any(|attr| {
-            attr.path().is_ident("salvo")
-                && attribute::find_nested_list(attr, "parameter")
-                    .ok()
-                    .flatten()
-                    .is_some()
-        }) {
-            return Err(Diagnostic::spanned(
-                ident.span(),
-                DiagLevel::Error,
-                "found `parameter` attribute in unsupported context",
-            )
-            .help("Did you mean `parameters`?"));
-        }
-
         let names = parameters_features.as_mut().and_then(|features| {
             let to_parameters_names = pop_feature!(features => Feature::ToParametersNames(_));
             IntoInner::<Option<ToParametersNames>>::into_inner(to_parameters_names)
@@ -415,7 +402,10 @@ impl Parameter<'_> {
             .iter()
             .filter_map(|attr| {
                 if attr.path().is_ident("salvo") {
-                    attribute::find_nested_list(attr, "parameter")
+                    // Field-level config is spelled `parameter(...)`; the plural
+                    // `parameters(...)` is accepted as an alias so the key matches
+                    // its container-level counterpart.
+                    attribute::find_nested_list_any(attr, &["parameter", "parameters"])
                         .ok()
                         .flatten()
                         .map(|metas| {
```

**File**: `crates/oapi/src/openapi.rs` (modified, +51/-0)
```diff
@@ -1333,6 +1333,57 @@ mod tests {
         assert_eq!(by_name("keyword").required, Required::False);
     }
 
+    #[test]
+    fn to_parameters_accepts_singular_and_plural_keys() {
+        // The container key was `parameters(...)` and the field key `parameter(...)`;
+        // the opposite spelling used to be a hard error / silently ignored. Both
+        // spellings are now accepted at both levels, so the drift is invisible to
+        // users. This test drives each level with its *alias* spelling.
+        #[derive(Deserialize, crate::ToParameters)]
+        // singular `parameter(...)` on the container (previously an error):
+        #[salvo(parameter(default_parameter_in = Header))]
+        #[allow(dead_code)]
+        struct AliasQuery {
+            page: i32,
+            // plural `parameters(...)` on a field (previously ignored):
+            #[salvo(parameters(rename = "renamed"))]
+            raw: String,
+        }
+
+        #[salvo_oapi::endpoint]
+        async fn list(query: AliasQuery) -> &'static str {
+            let _ = query;
+            "ok"
+        }
+
+        let router = Router::with_path("/alias").get(list);
+        let doc = OpenApi::new("test api", "0.0.1").merge_router(&router);
+        let operation = doc
+            .paths
+            .get("/alias")
+            .and_then(|item| item.operations.get(&PathItemType::Get))
+            .expect("get operation should exist");
+        let names: Vec<&str> = operation
+            .parameters
+            .0
+            .iter()
+            .map(|p| p.name.as_str())
+            .collect();
+
+        // container singular alias honored: every parameter is in `header`.
+        for param in &operation.parameters.0 {
+            assert_eq!(
+                param.parameter_in,
+                ParameterIn::Header,
+                "parameter `{}` should inherit the container `default_parameter_in`",
+                param.name
+            );
+        }
+        // field plural alias honored: `raw` was renamed to `renamed`.
+        assert!(names.contains(&"renamed"), "field rename alias not applied: {names:?}");
+        assert!(!names.contains(&"raw"));
+    }
+
     #[test]
     fn merge_router_skips_route_without_method_filter() {
         #[salvo_oapi::endpoint]
```

#### Recent Merged Pull Requests:
- **PR #1710** (2026-09-24): fix(examples): align OpenTelemetry examples with 0.33 (@chrislearn)
- **PR #1709** (2026-09-24): build(deps): upgrade OpenTelemetry crates to 0.33 together (@chrislearn)
- **PR #1708** (2026-09-24): Fix StaticDir access to files beneath dot directories (@chrislearn)
- **PR #1707** (closed): build(deps): update opentelemetry requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #1706** (closed): build(deps): update opentelemetry_sdk requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #1705** (closed): build(deps): update opentelemetry-semantic-conventions requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #1704** (closed): build(deps): update opentelemetry-http requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #1703** (2026-09-08): build(deps): update zstd requirement from 0.13 to 0.14 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
