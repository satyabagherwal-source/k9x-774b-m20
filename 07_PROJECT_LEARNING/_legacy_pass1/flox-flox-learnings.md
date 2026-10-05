# Forensic Learning Record (Deep Inspection): flox/flox

> **Canonical Artifact**: `07_PROJECT_LEARNING/flox-flox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/flox/flox](https://github.com/flox/flox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:13:51.823Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flox/flox`
- **Description**: The Deterministic Foundation for your SDLC
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4149 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/catalog-api-v1/src/client.rs`
```
#[allow(unused_imports)]
pub use progenitor_client::{ByteStream, ClientInfo, Error, ResponseValue};
#[allow(unused_imports)]
use progenitor_client::{encode_path, ClientHooks, OperationInfo, RequestBuilderExt};
/// Types used as operation parameters and responses.
#[allow(clippy::all)]
pub mod types {
    /// Error types.
    pub mod error {
        /// Error from a `TryFrom` or `FromStr` implementation.
        pub struct ConversionError(::std::borrow::Cow<'static, str>);
        impl ::std::error::Error for ConversionError {}
        impl ::std::fmt::Display for ConversionError {
            fn fmt(
                &self,
                f: &mut ::std::fmt::Formatter<'_>,
            ) -> Result<(), ::std::fmt::Error> {
                ::std::fmt::Display::fmt(&self.0, f)
            }
        }
        impl ::std::fmt::Debug for ConversionError {
            fn fmt(
                &self,
                f: &mut ::std::fmt::Formatter<'_>,
            ) -> Result<(), ::std::fmt::Error> {
                ::std::fmt::Debug::fmt(&self.0, f)
            }
        }
        impl From<&'static str> for ConversionError {
            fn from(value: &'static str) -> Self {
                Self(value.into())
            }
        }
        impl From<String> for ConversionError {
            fn from(value: String) -> Self {
                Self(value.into())
            }
        }
    }
    ///`BaseCatalogInfo`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BaseCatalogInfo",
    ///  "type": "object",
    ///  "required": [
    ///    "base_url",
    ///    "scraped_pages",
    ///    "stabilities"
    ///  ],
    ///  "properties": {
    ///    "base_url": {
    ///      "title": "Base Url",
    ///      "type": "string"
    ///    },
    ///    "scraped_pages": {
    ///      "title": "Scraped Pages",
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/PageInfo"
    ///      }
    ///    },
    ///    "stabilities": {
    ///      "title": "Stabilities",
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/StabilityInfo"
    ///      }
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
    pub struct BaseCatalogInfo {
        pub base_url: ::std::string::String,
        pub scraped_pages: ::std::vec::Vec<PageInfo>,
        pub stabilities: ::std::vec::Vec<StabilityInfo>,
    }
    impl ::std::convert::From<&BaseCatalogInfo> for BaseCatalogInfo {
        fn from(value: &BaseCatalogInfo) -> Self {
            value.clone()
        }
    }
    /**Request body for the /build-inputs/lookup endpoint.

A lookup names a `stability` (required) and one or more `groups` of
references to resolve, optionally anchored at a `reference_point`.  It is
system-independent — the response is source revs + DAG edges, which carry
no system — so the request body has no system field.*/
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BuildInputsLookupRequest",
    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names a `stability` (required) and one or more `groups` of\nreferences to resolve, optionally anchored at a `reference_point`.  It is\nsystem-independent — the response is source revs + DAG edges, which carry\nno system — so the request body has no system field.",
    ///  "type": "object",
    ///  "required": [
    ///    "groups",
    ///    "stability"
    ///  ],
    ///  "properties": {
    ///    "groups": {
    ///      "title": "Groups",
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/LookupGroup"
    ///      },
    ///      "maxItems": 256
    ///    },
    ///    "reference_point": {
    ///      "oneOf": [
    ///        {
    ///          "type": "null"
    ///        },
    ///        {
    ///          "allOf": [
    ///            {
    ///              "$ref": "#/components/schemas/ReferencePoint"
    ///            }
    ///          ]
    ///        }
    ///      ]
    ///    },
    ///    "stability": {
    ///      "title": "Stability",
    ///      "type": "string",
    ///      "minLength": 1
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
    pub struct BuildInputsLookupRequest {
        pub groups: ::std::vec::Vec<LookupGroup>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub reference_point: ::std::option::Option<ReferencePoint>,
        pub stability: Stability,
    }
    impl ::std::convert::From<&BuildInputsLookupRequest> for BuildInputsLookupRequest {
        fn from(value: &BuildInputsLookupRequest) -> Self {
            value.clone()
        }
    }
    ///Response body for the /build-inputs/lookup endpoint.
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BuildInputsLookupResponse",
    ///  "description": "Response body for the /build-inputs/lookup endpoint.",
    ///  "type": "object",
    ///  "required": [
    ///    "groups"
    ///  ],
    ///  "properties": {
    ///    "groups": {
    ///      "title": "Groups",
    ///      "type": "object",
    ///      "additionalProperties": {
    ///        "$ref": "#/components/schemas/GroupResult"
    ///      }
    ///    },
    ///    "version": {
    ///      "title": "Version",
    ///      "default": 1,
    ///      "type": "integer"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
    pub struct BuildInputsLookupResponse {
        pub groups: ::std::collections::HashMap<::std::string::String, GroupResult>,
        #[serde(default = "defaults::default_u64::<i64, 1>")]
        pub version: i64,
    }
    impl ::std::convert::From<&BuildInputsLookupResponse> for BuildInputsLookupResponse {
        fn from(value: &BuildInputsLookupResponse) -> Self {
            value.clone()
        }
    }
    ///Reference to a specific build by catalog, attr_path, and revision.
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BuildRef",
    ///  "description": "Reference to a specific build by catalog, attr_path, and revision.",
    ///  "type": "object",
    ///  "required": [
    ///    "attr_path",
    ///    "catalog",
    ///    "rev"
    ///  ],
    ///  "properties": {
    ///    "attr_path": {
    ///      "title": "Attr Path",
    ///      "type": "string"
    ///    },
    ///    "catalog": {
    ///      "title": "Catalog",
    ///      "type": "string"
    ///    },
    ///    "rev": {
    ///      "title": "Rev",
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
    pub struct BuildRef {
        pub attr_path: ::std::string::String,
        pub catalog: ::std::string::String,
        pub rev: ::std::string::String,
    }
    impl ::std::convert::From<&BuildRef> for BuildRef {
        fn from(value: &BuildRef) -> Self {
            value.clone()
        }
    }
    ///Source provenance for a published package.
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BuildSource",
    ///  "description": "Source provenance for a published package.",
    ///  "type": "object",
    ///  "required": [
    ///    "rev",
    ///    "url"
    ///  ],
    ///  "properties": {
    ///    "dir": {
    ///      "title": "Dir",
    ///      "default": ".flox",
    ///      "type": "string"
    ///    },
    ///    "ref": {
    ///      "title": "Ref",
    ///      "type": [
    ///        "str
```

### Core Architecture Module: `cli/catalog-api-v1/src/error.rs`
```
use std::hash::Hash;

use serde::{Deserialize, Serialize};

/// Type of the error returned by the catalog API
/// Since we were unable to represent earlier error structures returned by the API
/// using the progenitor client generator,
/// errors are now serialized as a blob of values
/// (`context` in [crate::ResolutionMessageGeneral]).
///
/// The context may be parsed into a higher level structure later,
/// or ignored in which case the `message` field in [crate::ResolutionMessageGeneral]
/// is expected to provide a relevant fallback message.
#[derive(Clone, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
pub enum MessageType {
    #[serde(rename = "general")]
    General,
    #[serde(rename = "resolution_trace")]
    ResolutionTrace,
    #[serde(rename = "constraints_too_tight")]
    ConstraintsTooTight,
    #[serde(rename = "attr_path_not_found.not_in_catalog")]
    AttrPathNotFoundNotInCatalog,
    #[serde(rename = "attr_path_not_found.systems_not_on_same_page")]
    AttrPathNotFoundSystemsNotOnSamePage,
    #[serde(rename = "attr_path_not_found.not_found_for_all_systems")]
    AttrPathNotFoundNotFoundForAllSystems,
    // Although attr_path_not_found is in the API, the catalog server should
    // never return it,
    // so we'll let that fall through to Unknown.

    #[serde(untagged)]
    Unknown(String),
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serde_json::json;

    use super::*;
    #[test]
    #[ignore = "useful when developing"]
    fn deserializes_known_and_unknown_variants() {
        let map: HashMap<String, MessageType> = serde_json::from_value(json!({
         "known_type": "constraints_too_tight",
         "unknown_type": "something unknown"
        }))
        .unwrap();

        assert_eq!(map["known_type"], MessageType::ConstraintsTooTight);
        assert_eq!(
            map["unknown_type"],
            MessageType::Unknown("something unknown".to_string())
        );
    }
}

```

### Core Architecture Module: `cli/catalog-api-v1/src/hooks.rs`
```
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use progenitor_client::{ClientHooks, ClientInfo, Error, OperationInfo};
use reqwest::StatusCode;
use reqwest::header::RETRY_AFTER;
use tracing::warn;

const MAX_SERVICE_UNAVAILABLE_RETRIES: usize = 2;
const DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY: Duration = Duration::from_secs(2);

fn parse_retry_after(value: &str, now: DateTime<Utc>) -> Option<Duration> {
    if let Ok(seconds) = value.parse::<u64>() {
        return Some(Duration::from_secs(seconds));
    }

    let Ok(retry_at) = DateTime::parse_from_rfc2822(value) else {
        return None;
    };
    Some(
        retry_at
            .with_timezone(&Utc)
            .signed_duration_since(now)
            .to_std()
            .unwrap_or_default(),
    )
}

fn retry_after_delay(response: &reqwest::Response) -> Duration {
    let Some(value) = response.headers().get(RETRY_AFTER) else {
        return DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY;
    };
    let Ok(value) = value.to_str() else {
        warn!(
            retry_after = ?value,
            "Retry-After header is not valid text; using the default retry delay"
        );
        return DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY;
    };
    parse_retry_after(value, Utc::now()).unwrap_or_else(|| {
        warn!(
            retry_after = value,
            "Could not parse Retry-After header; using the default retry delay"
        );
        DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY
    })
}

/// Per-instance request hooks embedded in the generated `Client` via
/// `with_inner_type`.
///
/// This replaces the former global `Mutex<Option<Hook>>` in
/// `pre_request_hook.rs`, giving each `Client` instance its own hook without
/// shared mutable state.
///
/// # Error handling
///
/// The `pre_request` hook is infallible by design: errors (e.g. a failed
/// Kerberos token acquisition) are silently swallowed and the request proceeds
/// without the auth header. This means auth failures will surface as HTTP 401
/// responses rather than client-side errors. Keep this in mind when debugging
/// authentication issues.
pub struct RequestHooks {
    pub pre_request: Arc<dyn Fn(&mut reqwest::Request) + Send + Sync>,
}

impl Clone for RequestHooks {
    fn clone(&self) -> Self {
        Self {
            pre_request: Arc::clone(&self.pre_request),
        }
    }
}

impl std::fmt::Debug for RequestHooks {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RequestHooks")
            .field("pre_request", &"<closure>")
            .finish()
    }
}

impl Default for RequestHooks {
    fn default() -> Self {
        Self {
            pre_request: Arc::new(|_| {}),
        }
    }
}

impl ClientHooks<RequestHooks> for crate::Client {
    async fn pre<E>(
        &self,
        request: &mut reqwest::Request,
        _info: &OperationInfo,
    ) -> Result<(), Error<E>> {
        (self.inner.pre_request)(request);
        Ok(())
    }

    async fn exec(
        &self,
        request: reqwest::Request,
        _info: &OperationInfo,
    ) -> reqwest::Result<reqwest::Response> {
        let mut request = request;
        for attempt in 0..=MAX_SERVICE_UNAVAILABLE_RETRIES {
            let retry_request = request.try_clone();
            let response = self.client().execute(request).await?;
            if response.status() != StatusCode::SERVICE_UNAVAILABLE
                || attempt == MAX_SERVICE_UNAVAILABLE_RETRIES
            {
                return Ok(response);
            }

            let Some(next_request) = retry_request else {
                return Ok(response);
            };
            tokio::time::sleep(retry_after_delay(&response)).await;
            request = next_request;
        }

        unreachable!("retry loop always returns on its final attempt")
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    #[test]
    fn retry_after_parses_seconds() {
        let now = Utc.with_ymd_and_hms(2026, 9, 4, 12, 0, 0).unwrap();

        assert_eq!(
            parse_retry_after("12", now),
            Some(Duration::from_secs(12))
        );
    }

    #[test]
    fn retry_after_parses_http_date() {
        let now = Utc.with_ymd_and_hms(2026, 9, 4, 12, 0, 0).unwrap();

        assert_eq!(
            parse_retry_after("Fri, 04 Sep 2026 12:00:12 GMT", now),
            Some(Duration::from_secs(12))
        );
    }

    #[test]
    fn retry_after_distinguishes_past_dates_from_invalid_values() {
        let now = Utc.with_ymd_and_hms(2026, 9, 4, 12, 0, 0).unwrap();

        assert_eq!(
            (
                parse_retry_after("Fri, 04 Sep 2026 11:59:59 GMT", now),
                parse_retry_after("not a delay", now),
            ),
            (Some(Duration::ZERO), None)
        );
    }
}

```

### Core Architecture Module: `cli/catalog-api-v1/src/lib.rs`
```
//! This module contains the generated OpenAPI client for the Catalog API.
//!
//! The client is generated from the OpenAPI spec in `openapi.json` using the `progenitor` crate.
//! The spec is managed by the Catalog API team and is updated when the upstream API changes.

mod client;
mod error;
pub mod hooks;
pub use client::*;
pub use hooks::RequestHooks;

pub mod types {
    pub use crate::client::types::*;
    pub use crate::error::MessageType;

    use serde::{Deserialize, Serialize};
    /// Progenitor doesn't know how to use a discriminator as a tag, so add this
    /// enum manually.
    ///
    /// We still embed the underlying variant types, which have an extraneous
    /// `store_type` field, so that we don't shadow changes in the catalog API.
    #[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
    #[serde(tag = "store_type", rename_all = "kebab-case")]
    pub enum CatalogStoreConfig {
        /// The catalog store has not yet been configured
        Null,
        /// The user has configured the catalog for metadata only publishes
        MetaOnly,
        /// Store to copy to with `nix copy`
        NixCopy(CatalogStoreConfigNixCopy),
        /// Not yet supported
        Publisher(CatalogStoreConfigPublisher),
    }
}

#[cfg(test)]
mod tests {
    use crate::types::{
        CatalogStoreConfig, CatalogStoreConfigNixCopy, CatalogStoreConfigPublisher,
    };

    #[test]
    fn deserialize_catalog_store_config_null() {
        let response_string = r#"{
            "store_type": "null"
        }"#;

        let store_config = serde_json::from_str::<CatalogStoreConfig>(response_string).unwrap();
        assert_eq!(store_config, CatalogStoreConfig::Null)
    }

    #[test]
    fn deserialize_catalog_store_config_meta_only() {
        let response_string = r#"{
            "store_type": "meta-only"
        }"#;

        let store_config = serde_json::from_str::<CatalogStoreConfig>(response_string).unwrap();
        assert_eq!(store_config, CatalogStoreConfig::MetaOnly)
    }

    #[test]
    fn deserialize_catalog_store_config_nix_copy() {
        let response_string = r#"{
           "store_type": "nix-copy",
           "ingress_uri": "s3://example",
           "egress_uri": "s3://example"
        }"#;

        let store_config = serde_json::from_str::<CatalogStoreConfig>(response_string).unwrap();
        assert_eq!(
            store_config,
            CatalogStoreConfig::NixCopy(CatalogStoreConfigNixCopy {
                ingress_uri: "s3://example".into(),
                egress_uri: "s3://example".into(),
                store_type: "nix-copy".into(),
            })
        )
    }

    #[test]
    fn deserialize_catalog_store_config_publisher() {
        let response_string = r#"{
           "store_type": "publisher",
           "publisher_url": "s3://example"
        }"#;

        let store_config = serde_json::from_str::<CatalogStoreConfig>(response_string).unwrap();
        assert_eq!(
            store_config,
            CatalogStoreConfig::Publisher(CatalogStoreConfigPublisher {
                publisher_url: Some("s3://example".to_string()),
                store_type: "publisher".into(),
            })
        )
    }
}

```

### Core Architecture Module: `cli/factory-api-v1/src/client.rs`
```
#[allow(unused_imports)]
pub use progenitor_client::{ByteStream, ClientInfo, Error, ResponseValue};
#[allow(unused_imports)]
use progenitor_client::{encode_path, ClientHooks, OperationInfo, RequestBuilderExt};
/// Types used as operation parameters and responses.
#[allow(clippy::all)]
pub mod types {
    /// Error types.
    pub mod error {
        /// Error from a `TryFrom` or `FromStr` implementation.
        pub struct ConversionError(::std::borrow::Cow<'static, str>);
        impl ::std::error::Error for ConversionError {}
        impl ::std::fmt::Display for ConversionError {
            fn fmt(
                &self,
                f: &mut ::std::fmt::Formatter<'_>,
            ) -> Result<(), ::std::fmt::Error> {
                ::std::fmt::Display::fmt(&self.0, f)
            }
        }
        impl ::std::fmt::Debug for ConversionError {
            fn fmt(
                &self,
                f: &mut ::std::fmt::Formatter<'_>,
            ) -> Result<(), ::std::fmt::Error> {
                ::std::fmt::Debug::fmt(&self.0, f)
            }
        }
        impl From<&'static str> for ConversionError {
            fn from(value: &'static str) -> Self {
                Self(value.into())
            }
        }
        impl From<String> for ConversionError {
            fn from(value: String) -> Self {
                Self(value.into())
            }
        }
    }
    ///`AttrPathItem`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "string",
    ///  "minLength": 1
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
    #[serde(transparent)]
    pub struct AttrPathItem(::std::string::String);
    impl ::std::ops::Deref for AttrPathItem {
        type Target = ::std::string::String;
        fn deref(&self) -> &::std::string::String {
            &self.0
        }
    }
    impl ::std::convert::From<AttrPathItem> for ::std::string::String {
        fn from(value: AttrPathItem) -> Self {
            value.0
        }
    }
    impl ::std::convert::From<&AttrPathItem> for AttrPathItem {
        fn from(value: &AttrPathItem) -> Self {
            value.clone()
        }
    }
    impl ::std::str::FromStr for AttrPathItem {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            if value.chars().count() < 1usize {
                return Err("shorter than 1 characters".into());
            }
            Ok(Self(value.to_string()))
        }
    }
    impl ::std::convert::TryFrom<&str> for AttrPathItem {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for AttrPathItem {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for AttrPathItem {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl<'de> ::serde::Deserialize<'de> for AttrPathItem {
        fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
        where
            D: ::serde::Deserializer<'de>,
        {
            ::std::string::String::deserialize(deserializer)?
                .parse()
                .map_err(|e: self::error::ConversionError| {
                    <D::Error as ::serde::de::Error>::custom(e.to_string())
                })
        }
    }
    ///Paginated list of builds.
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BuildListResponse",
    ///  "description": "Paginated list of builds.",
    ///  "type": "object",
    ///  "required": [
    ///    "builds",
    ///    "page",
    ///    "page_size",
    ///    "total"
    ///  ],
    ///  "properties": {
    ///    "builds": {
    ///      "title": "Builds",
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/BuildResponse"
    ///      }
    ///    },
    ///    "page": {
    ///      "title": "Page",
    ///      "type": "integer"
    ///    },
    ///    "page_size": {
    ///      "title": "Page Size",
    ///      "type": "integer"
    ///    },
    ///    "total": {
    ///      "title": "Total",
    ///      "type": "integer"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
    pub struct BuildListResponse {
        pub builds: ::std::vec::Vec<BuildResponse>,
        pub page: i64,
        pub page_size: i64,
        pub total: i64,
    }
    impl ::std::convert::From<&BuildListResponse> for BuildListResponse {
        fn from(value: &BuildListResponse) -> Self {
            value.clone()
        }
    }
    /**Build-specific details with optional task sub-object.

The task field is None for undispatched builds (task_id IS NULL
in factory_builds).

The status field is the build's effective current status — the
EffectiveBuildStatus vocabulary — computed server-side from the
freshest authoritative source:

- Pre-dispatch (task_id IS NULL): computed from
  factory_builds.cancelled_at — ``"cancelled"`` when set, else
  ``"pending"``. Neither word is stored; the timestamp is the only
  persisted pre-dispatch state.
- Dispatched: tasks.status (``"running"``, ``"completed"``,
  ``"failed"``, ``"cancelled"``), with ``"timed_out"``
  reconstructed from the persisted footprint of an execution
  timeout (status='failed' + error_class='timeout'). A submit-time
  ``dispatch_timeout`` is a different failure — the build never
  observably started — and reads as ``"failed"``.
- On cancel responses: Build Coordinator's returned status, which
  is fresher than the local row (which lags until BC's callback
  lands), put through the same derivation — BC's ``timed_out``
  surfaces as ``"timed_out"``, agreeing with what a subsequent GET
  reconstructs once the callback persists the footprint. The field
  never carries a word outside the effective vocabulary.

Staleness: after handoff the field tracks tasks.status, which only
advances when Build Coordinator's terminal callback lands. When
callbacks are disabled (no callback base URL configured — a
supported worker configuration), the post-handoff status stays at
the last persisted value (typically ``"running"``) indefinitely;
a cancel response is then the only place a fresher
coordinator-reported status appears.*/
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "title": "BuildResponse",
    ///  "description": "Build-specific details with optional task sub-object.\n\nThe task field is None for undispatched builds (task_id IS NULL\nin factory_builds).\n\nThe status field is the build's effective current status — the\nEffectiveBuildStatus vocabulary — computed server-side from the\nfreshest authoritative source:\n\n- Pre-dispatch (task_id IS NULL): computed from\n  factory_builds.cancelled_at — ``\"cancelled\"`` when set, else\n  ``\"pending\"``. Neither word is stored; the timestamp is the only\n  persisted pre-dispatch state.\n- Dispatched: tasks.status (``\"running\"``, ``\"completed\"``,\n  ``\"failed\"``, ``\"cancelled\"``), with ``\"timed_out\"``\n  reconstructed from the persisted footprint of an execution\n  timeout (status='failed' + error_class='timeout'). A submit-time\n  ``dispatch_timeout`` is a different failure 
```

### Core Architecture Module: `cli/factory-api-v1/src/hooks.rs`
```
use std::sync::Arc;

use progenitor_client::{ClientHooks, Error, OperationInfo};

/// Per-instance request hooks embedded in the generated `Client` via
/// `with_inner_type`. Each `Client` instance owns its own hook without
/// shared mutable state.
///
/// # Error handling
///
/// The `pre_request` hook is infallible by design: errors (e.g. a failed
/// Kerberos token acquisition) are silently swallowed and the request proceeds
/// without the auth header. This means auth failures will surface as HTTP 401
/// responses rather than client-side errors. Keep this in mind when debugging
/// authentication issues.
pub struct RequestHooks {
    pub pre_request: Arc<dyn Fn(&mut reqwest::Request) + Send + Sync>,
}

impl Clone for RequestHooks {
    fn clone(&self) -> Self {
        Self {
            pre_request: Arc::clone(&self.pre_request),
        }
    }
}

impl std::fmt::Debug for RequestHooks {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RequestHooks")
            .field("pre_request", &"<closure>")
            .finish()
    }
}

impl Default for RequestHooks {
    fn default() -> Self {
        Self {
            pre_request: Arc::new(|_| {}),
        }
    }
}

impl ClientHooks<RequestHooks> for crate::Client {
    async fn pre<E>(
        &self,
        request: &mut reqwest::Request,
        _info: &OperationInfo,
    ) -> Result<(), Error<E>> {
        (self.inner.pre_request)(request);
        Ok(())
    }
}

```

### Core Architecture Module: `cli/factory-api-v1/src/lib.rs`
```
//! Generated OpenAPI client for the Factory Service API.
//!
//! The client is generated from the OpenAPI spec in `openapi.json` using the
//! `progenitor` crate. The spec is a 3.0.2-converted snapshot of the Factory
//! Service's runtime `app.openapi()` output. It is refreshed by running
//! `just factory openapi-export` in the floxhub repository and copying the
//! output here.
//!
//! `src/client.rs` is generated and checked in — regenerate it by running
//! `cargo build -p factory-api-v1` after updating `openapi.json`.

mod client;
pub mod hooks;
mod status;
pub use client::*;
pub use hooks::RequestHooks;

pub mod types {
    pub use crate::client::types::*;
    pub use crate::status::EffectiveBuildStatus;
}

```

### Core Architecture Module: `cli/factory-api-v1/src/status.rs`
```
//! Hand-written, tolerant replacement for the generated `BuildResponse.status`
//! enum.
//!
//! The Factory Service computes an effective build status server-side. We
//! deserialize it into a closed set of known variants plus an open
//! [`EffectiveBuildStatus::Unknown`] catch-all: a status the server adds in the
//! future renders as `unknown: <value>` rather than failing the whole response
//! and blanking the build list. Progenitor generates the endpoint bindings; this
//! type is spliced in via `with_replacement` in `build.rs` so the same tolerance
//! covers both the response body and the `status` query-param filter.

use std::fmt;

use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;

/// The server-computed status of a build.
///
/// Known variants serialize to their wire word (e.g. `TimedOut` ⇄ `timed_out`).
/// Any value outside the known set deserializes into [`Self::Unknown`] and
/// serializes back to the same string, so unknown statuses round-trip.
///
/// The two directions are deliberately asymmetric: deserialization (serde) is
/// tolerant so a response never fails on a new server status, while `FromStr`
/// (derived by strum, with [`Self::Unknown`] disabled) is strict so user input
/// is rejected unless it names a known status; the [`ParseStatusError`] it
/// returns names the accepted values. Iteration (`EnumIter`, also skipping the
/// disabled [`Self::Unknown`]) yields the known statuses in the order the
/// OpenAPI schema documents them.
#[derive(
    Clone,
    Debug,
    Deserialize,
    Serialize,
    PartialEq,
    Eq,
    Hash,
    strum::EnumIter,
    strum::EnumString,
)]
#[serde(rename_all = "snake_case")]
#[strum(
    serialize_all = "snake_case",
    parse_err_fn = unknown_status,
    parse_err_ty = ParseStatusError
)]
pub enum EffectiveBuildStatus {
    Pending,
    Running,
    Completed,
    Failed,
    TimedOut,
    Cancelled,
    /// Any value outside the known statuses. MUST stay last: serde requires
    /// an untagged variant to trail the tagged ones so the known words are
    /// tried first.
    #[serde(untagged)]
    #[strum(disabled)]
    Unknown(String),
}

impl EffectiveBuildStatus {
    /// The wire word for this status. For [`Self::Unknown`] this is the
    /// original, unrecognized value.
    pub fn as_str(&self) -> &str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::TimedOut => "timed_out",
            Self::Cancelled => "cancelled",
            Self::Unknown(value) => value,
        }
    }
}

impl fmt::Display for EffectiveBuildStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Rejection of a word outside the known status vocabulary.
///
/// Produced by the enum's `FromStr`; the message names the accepted values,
/// so a caller can show it to a user as-is.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParseStatusError(String);

impl fmt::Display for ParseStatusError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let valid = EffectiveBuildStatus::iter()
            .map(|status| status.to_string())
            .collect::<Vec<_>>()
            .join(", ");
        write!(f, "Invalid status '{}'; valid values are: {valid}.", self.0)
    }
}

impl std::error::Error for ParseStatusError {}

/// The `parse_err_fn` for the strum-derived `FromStr`.
fn unknown_status(s: &str) -> ParseStatusError {
    ParseStatusError(s.to_string())
}

#[cfg(test)]
mod tests {
    use strum::IntoEnumIterator;

    use super::*;

    #[test]
    fn deserializes_known_variant() {
        let status: EffectiveBuildStatus = serde_json::from_str(r#""timed_out""#).unwrap();
        assert_eq!(status, EffectiveBuildStatus::TimedOut);
    }

    #[test]
    fn deserializes_unknown_variant_tolerantly() {
        let status: EffectiveBuildStatus = serde_json::from_str(r#""queued""#).unwrap();
        assert_eq!(status, EffectiveBuildStatus::Unknown("queued".to_string()));
    }

    #[test]
    fn serializes_known_and_unknown_to_wire_word() {
        assert_eq!(
            serde_json::to_string(&EffectiveBuildStatus::Cancelled).unwrap(),
            r#""cancelled""#,
        );
        assert_eq!(
            serde_json::to_string(&EffectiveBuildStatus::Unknown("frobnicated".to_string()))
                .unwrap(),
            r#""frobnicated""#,
        );
    }

    #[test]
    fn display_matches_as_str() {
        assert_eq!(EffectiveBuildStatus::Pending.to_string(), "pending");
        assert_eq!(
            EffectiveBuildStatus::Unknown("weird".to_string()).to_string(),
            "weird",
        );
    }

    /// `FromStr` is the strict direction: known wire words parse, anything
    /// else is rejected rather than falling into `Unknown`. Pins the strum
    /// wiring (`serialize_all` casing and the disabled catch-all) and the
    /// rejection message naming the accepted values.
    #[test]
    fn from_str_parses_known_words_and_rejects_the_rest() {
        assert_eq!("timed_out".parse(), Ok(EffectiveBuildStatus::TimedOut));
        assert_eq!(
            "queued".parse::<EffectiveBuildStatus>().unwrap_err().to_string(),
            "Invalid status 'queued'; valid values are: pending, running, completed, failed, timed_out, cancelled."
        );
        assert!("".parse::<EffectiveBuildStatus>().is_err());
    }

    /// Pins the known variants to the schema the client is generated from. If
    /// the server adds or reorders a status, this fails loudly so the enum is
    /// updated deliberately rather than the new value silently falling into
    /// `Unknown`.
    #[test]
    fn known_matches_openapi_schema() {
        let spec: serde_json::Value =
            serde_json::from_str(include_str!("../openapi.json")).unwrap();
        let schema_values: Vec<String> = spec["components"]["schemas"]["EffectiveBuildStatus"]
            ["enum"]
            .as_array()
            .expect("EffectiveBuildStatus.enum is an array")
            .iter()
            .map(|value| {
                value
                    .as_str()
                    .expect("enum value is a string")
                    .to_string()
            })
            .collect();
        let known: Vec<String> = EffectiveBuildStatus::iter()
            .map(|status| status.to_string())
            .collect();
        assert_eq!(schema_values, known);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4741** (2026-09-29): **flox build rejects namespaced catalog packages in runtime-packages with misleading package-group error**
  *Symptoms*: ## Describe the bug  When a namespaced catalog package is listed in `build.<name>.runtime-packages`, `flox build` fails even though the lockfile correctly assigns the package to the `toplevel` group.  ## Steps to reproduce  Given an available catalog package `example-owner/example-tool` (placeholder names), use:  ```toml schema-version = "1.17.0"  [install] example-tool.pkg-path = "example-owner/example-tool"  [build.example] version = "0.0.1" runtime-packages = ["example-tool"] command = """   mkdir -p "$out"   touch "$out/hello" """ ```  Run `flox build`.  ### Actual behavior  The environment build fails with:  ```text ❌ ERROR: package 'example-tool' is not in 'toplevel' pkg-group ```  The corresponding lockfile entry has these fields:  ```json {   "install_id": "example-tool",   "attr_path": "example-tool",   "group": "toplevel" } ```  ### Expected behavior  The build should resolve the runtime dependency by its install ID and recognize that it belongs to `toplevel`.  ## Suspected cause  In `buildenv/builder.pl`, runtime-package validation compares the lockfile's `attr_path` directly with the manifest's `pkg-path`:  ```perl grep { $_->{"attr_path"} eq $install->{$name}{"pkg-path"} } @toplevelPackages ```  For namespaced catalog packages, these values differ: `example-tool` versus `example-owner/example-tool`. The failed comparison produces a misleading group-membership error. Subsequent runtime-package filtering also uses attribute paths.  This logic was confirmed in the i

- **Issue #4659** (2026-09-11): **`flox config -l` omits the computed default for `auto_activate`**
  *Symptoms*: **Describe the bug:**  `flox config -l` omits `auto_activate` when the setting is absent from the configuration files and environment. The effective behavior is the documented default, `prompt`.  The [Flox 1.15 manual](https://github.com/flox/flox/blob/v1.15.0/cli/flox/doc/flox-config.md) says that `flox config` shows "all options with their computed value" and describes `-l` as listing "the current values of all options." Omitting the default makes it difficult for scripts to distinguish the default from an unsupported or unavailable setting.  **Steps to reproduce:**  1. Run Flox with isolated empty user and system configuration:     ```sh    config_dir="$(mktemp -d)"    FLOX_CONFIG_DIR="${config_dir}" FLOX_SYSTEM_CONFIG_DIR="" \        flox config -l | grep '^auto_activate'    ```  2. Explicitly set the value to its default and list the same keys again:     ```sh    FLOX_CONFIG_DIR="${config_dir}" FLOX_SYSTEM_CONFIG_DIR="" \        flox config --set auto_activate prompt    FLOX_CONFIG_DIR="${config_dir}" FLOX_SYSTEM_CONFIG_DIR="" \        flox config -l | grep '^auto_activate'    ```  Result:  ```text # Empty configuration auto_activate_environments = {}  # Explicit prompt value auto_activate = "prompt" auto_activate_environments = {} ```  Expected:  The empty configuration should include the computed default:  ```text auto_activate = "prompt" auto_activate_environments = {} ```  Alternatively, the manual should state that optional settings with defaults are omitted until e
  **Post-Mortem & Fix Analysis**:
  > Thanks for catching this and for the detailed report! Sorry the docs don’t match the current behavior here—we’re fixing that now.  We’re also discussing whether to change how `flox config -l` displays defaults and other configuration values. We don’t want to promise anything just yet, but we agree there’s room to make this clearer and more useful. 

- **Issue #4629** (2026-08-24): **`flox activate --start-services` cannot recover from a stale process-compose socket**
  *Symptoms*: ## Observed behavior  When an activation with `--start-services` is terminated uncleanly (SIGKILL of the process group, power loss — anything that prevents process-compose from removing its unix socket), the socket file is left behind in the cache directory, e.g.:  ``` $XDG_CACHE_HOME/flox/run/flox.ccfa6fbc.sock ```  Every subsequent `flox activate --start-services` for that environment then fails permanently:  ``` ERROR flox_activations::start: failed to stop process-compose err=process-compose down failed:   FTL failed to stop project error="Post \"http://unix/project/stop/\": dial unix …/flox.ccfa6fbc.sock: connect: connection refused" ✘ ERROR: Failed to start services: process-compose socket not ready ```  flox first notices the stale activation state and tries `process-compose down` against the dead socket (connection refused), then attempts to start services and fails with "socket not ready". The cycle never resolves on its own; recovery requires manually deleting the socket file, after which activation succeeds immediately.  Observed with flox 1.14.1 running as a systemd service (a killed service cgroup reproduces it reliably: `systemctl kill -s SIGKILL <unit>` on a unit whose ExecStart is `flox activate --start-services -- flox services logs --follow`, then restart). Without intervention the unit crash-loops indefinitely.  ## Expected behavior  A socket that refuses connections has no live process-compose behind it. After the `down` attempt fails with `ECONNREFUSED`, 

- **Issue #4489** (2026-08-26): **`brew install flox` does not make `flox` binary available on `macos`**
  *Symptoms*: **Describe the bug:**  The `flox` binary is not available after `brew install flox`.  **Installer logs**  ``` brew reinstall flox ==> Would reinstall 1 cask: flox ==> Fetching downloads for: flox ✔︎ Cask flox (1.13.1)                                                                                                                                      Verified     53.2MB/ 53.2MB ==> Uninstalling Cask flox ==> Removing launchctl service org.nixos.darwin-store Password: ==> Removing launchctl service org.nixos.nix-daemon ==> Running uninstall script /usr/local/share/flox/scripts/uninstall Warning: uninstall script /usr/local/share/flox/scripts/uninstall does not exist; skipping. ==> Uninstalling packages with `sudo` (which may request your password)... ==> Purging files for version 1.13.1 of Cask flox ==> Installing Cask flox ==> Running installer for flox with `sudo` (which may request your password)... installer: Package name is Flox installer: Installing at base path / installer: The install was successful. 🍺  flox was successfully installed!  $ flox fish: Unknown command: flox  ```  If on macOS, attach logs for the install from `/var/log/install.log`. That should include everything from the first to the last mention of `com.floxdev.flox`, redacting anything sensitive.  ``` 2026-07-11 10:33:41+02 Mac installer[76672]: Product archive /opt/homebrew/Caskroom/flox/1.13.1/flox-1.13.1.aarch64-darwin.pkg trustLevel=202 2026-07-11 10:33:41+02 Mac installer[76672]: External component 
  **Post-Mortem & Fix Analysis**:
  > @montekki thanks for the report. would like to get some more info from you if possible. for what it's worth, I just ran through installing flox from brew on a vanilla freshly-installed macOS 26 system which seemed to work fine, but wondering if there's something with our packaging that is not playing nice with your setup, and if there are some adaptations we should make to our install process.  would you mind sharing what the value of your `PATH` environment variable is? and additionally, does `/usr/local/bin/flox` exist on your system after installation? wondering if somehow you don't have `/usr/local/bin` on PATH, or if the flox binary is not there for some reason.  thanks in advance!
  > I independently reproduced this with Flox 1.14.0 on Apple Silicon, with Lix 2.94.0 managed by nix-darwin.  This is not a PATH issue:  - `PATH` includes both `/usr/local/bin` and `/opt/homebrew/bin`. - Homebrew reports `flox 1.14.0` as an installed cask. - `/usr/local/bin/flox` and `/opt/homebrew/bin/flox` do not exist. - No Flox macOS package receipt was created.  Inspecting the package choices shows the cause: when existing Nix is detected, the regular `Flox` choice is hidden and unselected, while `flox.take.over` is visible but also unselected. The noninteractive Homebrew installation therefore selects no component, returns success, and records the cask without installing the Flox payload.  This appears to be the same underlying issue as #4083 and is consistent with #3926. The behavior remains present in the 1.14.0 package.
  > @devusb just did an upgrade from `brew`, the `/usr/local/bin/flox` path does not exist, upgrade ended up with an error also:  ``` ==> Upgrading 1 outdated package: flox 1.13.1 -> 1.14.0 ==> Fetching downloads for: flox ✔︎ Cask flox (1.14.0)                                                                                                                                      Downloaded   55.3MB/ 55.3MB ==> Upgrading flox   1.13.1 -> 1.14.0 ==> Removing launchctl service org.nixos.darwin-store Password: ==> Removing launchctl service org.nixos.nix-daemon ==> Running uninstall script /usr/local/share/flox/scripts/uninstall ==> Purging files for version 1.14.0 of Cask flox Error: flox: uninstall script /usr/local/share/flox/scripts/uninstall does not exist.   exa /usr/local/bin/flox "/usr/local/bin/flox": No such file or directory (os error 2)  ```

- **Issue #4458** (2026-07-13): **Activation drops the default search path from INFOPATH**
  *Symptoms*: **Describe the bug:**  If you use emacs, you can use the built-in `info` browser to read the built-in emacs manual. This relies on `INFOPATH` for locating `info` manuals. Launching emacs from within an activated Flox environment removes the default search path, which removes the emacs info manual.  **Background:** The semantics of `INFOPATH` are described in the GNU Info/TexInfo manual here: https://www.gnu.org/software/texinfo/manual/texinfo/html_node/Other-Info-Directories.html  The relevant portion is shown below (emphasis mine):  > However you set INFOPATH, if its last character is a colon (on MS-DOS/MS-Windows systems, use a semicolon instead), this is replaced by the default (compiled-in) path. This gives you a way to augment the default path with new directories without having to list all the standard places. For example (using sh syntax): > > INFOPATH=/home/bob/info: > export INFOPATH > > will search /home/bob/info first, then the standard directories. **Leading or doubled colons are not treated specially.**  Similar to `MANPATH`, a trailing `:` indicates that the contents of `INFOPATH` should be prepended to the default search path. Otherwise, when `INFOPATH` is set, it will be used as the complete search path. _Different_ from `MANPATH`, a leading `:` or a `::` anywhere in `INFOPATH` has no special meaning.  Flox sets `INFOPATH` here with no trailing `:`: https://github.com/flox/flox/blob/66a4c004ac2f1febbd03f07c873df4053e5957b1/assets/environment-interpreter/common
  **Post-Mortem & Fix Analysis**:
  > The fix should preserve the special meaning of an empty `INFOPATH` entry, since a leading or trailing separator includes GNU Info’s compiled-in default directories. A regression test could cover `INFOPATH` being unset, empty, and explicitly extended, confirming that the built-in Emacs manual remains discoverable. 

- **Issue #4336** (2026-06-05): **buildenv: multi-package download failures aggregate to Other and bypass transient retry**
  *Symptoms*: ## Background  When more than one package fails during `realise_lockfile`, `join_realise_results` collapses the errors into `BuildEnvError::Other(...)` (see `buildenv.rs` around line 643). `Other` is not classified as transient, so `materialise_with_retry` never retries the build — even when every underlying failure is a transient `BuildPublishedPackage`.  This means the scenario where retry is most valuable — a network blip that knocks out two or more downloads simultaneously — is exactly the scenario where retry never fires.  ## Reproduction  1. Have an environment with two or more custom-catalog packages. 2. Trigger a condition where both `nix copy` calls fail transiently (e.g., substituter briefly unreachable). 3. Observe: the build fails immediately with `Other(...)` rather than retrying.  ## Proposed fix  Options: - Change `join_realise_results` to propagate a representative transient error (e.g., the first `BuildPublishedPackage`) when all failures are transient, rather than wrapping in `Other`. - Add `BuildEnvError::MultipleDownloadFailures { attempts }` that `is_transient()` can classify correctly.  ## References  - PR #4324 (introduced transient retry; `join_realise_results` aggregation identified as gap) - Forge review: https://github.com/flox/flox/pull/4324#issuecomment-4611944991
  **Post-Mortem & Fix Analysis**:
  > ## Closing — root cause identified; error aggregation and classification no longer needed  After further analysis with @dcarley, the root cause of `materialise_with_retry` failures has been identified: Nix store DB entries can lag behind the filesystem. The correct approach is to call `buildenv.nix` optimistically after a `stat()` pass, then fall back to `nix path-info` only on failure to check path availability. Retry decisions are driven by the post-failure path check, not by error type — so the aggregation behaviour of `join_realise_results` no longer determines whether retries fire.  When multiple packages fail to download, the post-failure `nix path-info` check will detect missing or unregistered paths and trigger a retry regardless of how the errors were aggregated at the `join_realise_results` level. `BuildEnvError::Other` wrapping does not suppress the retry because the retry decision is made by inspecting path state, not by calling `is_transient()`.  Closing as superseded. The

- **Issue #4327** (2026-06-05): **bug(buildenv): race condition causes valid builds to be misclassified as deterministic failures**
  *Symptoms*: ## Summary  `materialise_with_retry` has a race condition that causes a transient Nix DB registration lag to be permanently misclassified as a deterministic build failure. The environment is never retried despite the store path being valid and fully present.  ## Observed in CI  Test: `providers::build::tests::build_can_use_cmake_sandbox_pure`  ``` DEBUG all store paths present per stat(), calling buildenv.nix       attempt=1 MAX_RETRIES=3       paths=[..., "/nix/store/xmyh14d786955sjzgv48ry485sd1fyn6-cmake-4.1.2", ...]  WARN  buildenv.nix failed with all paths confirmed in Nix store — treating as deterministic       error: path '/nix/store/xmyh14d786955sjzgv48ry485sd1fyn6-cmake-4.1.2'              is required, but there is no substituter that can build it       attempt=1 MAX_RETRIES=3 ```  buildenv.nix's `builtins.storePath` checks the **Nix daemon's SQLite database**, not the filesystem. The path was on disk (so `stat()` passed) but had not yet been recorded in the DB (so `builtins.storePath` threw).  ## Race condition sequence  ``` A. cmake store path directory is populated on disk B. stat() succeeds → buildenv.nix is invoked C. builtins.storePath fails: cmake on disk but not yet in Nix DB D. cmake registration completes: path now in Nix DB E. post-failure stat() succeeds (path still on disk) F. nix path-info succeeds (path now in DB — race window has closed) G. code concludes: "all paths confirmed → deterministic" → returns error, no retry ```  The invariant assumed by the
  **Post-Mortem & Fix Analysis**:
  > ## Closing — this issue *is* the root cause; corrected approach addresses it  This issue correctly identifies the core race condition: a store path is on disk (so `stat()` passes) but not yet registered in the Nix daemon's SQLite database (so `builtins.storePath` inside `buildenv.nix` fails), and by the time `nix path-info` runs post-failure the registration has completed, causing the failure to be misclassified as deterministic.  After discussion with @dcarley, this race is the root cause of the broader class of failures that motivated the retry/backoff/classification work in #4302, #4304, #4305, and #4324. The `stat()` + `nix path-info` verification loop introduced in #4282 addresses it, but the current implementation still wraps this in a fixed-count retry loop (`MAX_RETRIES = 3`) and backoff machinery that were designed for a misdiagnosed problem.  The correct approach is to call `buildenv.nix` optimistically after a `stat()` pass on the first attempt, then fall back to `nix path-i

- **Issue #4252** (2026-06-18): **FloxHub onboarding wiki suggests invalid command `flox activate --default`**
  *Symptoms*: **Describe the bug:** The onboarding instructions on FloxHub say to use `flox activate --default -m run`, but this appears to be invalid   <img width="1039" height="390" alt="Image" src="https://github.com/user-attachments/assets/26df7c96-76d4-4bb9-88a6-57f7fd537ee6" />  **Steps to reproduce:** 1. Install Flox on MacOS with nix via `nix profile install  --experimental-features "nix-command flakes" --accept-flake-config 'github:flox/flox/latest'` 2. Create a new environment on hub.flox.dev 3. Run `flox activate --default -m run` as instructed  Result: ``` ✘ ERROR: `--default` is not expected in this context ```  Expected: To be dropped into a dev environment for the default environment   **Flox Version (run `flox --version` if possible):** 1.12.0-gdab5625  **`uname -a` output:** ``` Darwin TheBamagen.local 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:54:55 PST 2026; root:xnu-12377.91.3~2/RELEASE_ARM64_T6031 arm64 ``` 
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging we'll get this fixed
  > Thanks for the report. This isn't a bug — the reason you experienced this is your version was right before we deployed a release that included this flag. Upgrade and `flox activate --default -m run` will work as documented. Closing this out.

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

### Incident Patch 1: `e7a26d23` (2026-09-30)
**Commit Message**: build(treefmt): format lock-scanner fixtures, exclude the unparseable two (#4726)

`treefmt -f nix` over the tree exits non-zero and rewrites thirteen of
the lock scanner's fixtures on the way. Three branches hit this in one
week and each reverted the fixtures by hand before committing.

## What changed

**Two fixtures excluded.** `catalog_refs/invalid-syntax.nix` and
`catalog_refs/parse-error-import/broken.nix` hold deliberately invalid
Nix so the scanner's parse-error paths can be exercised. nixfmt does not
rewrite them — it cannot parse them, leaves the bytes alone, and exits
non-zero:

```
cli/.../parse-error-import/broken.nix:4:12:
formatted 0 files (0 changed)
Error: failed to finalise formatting: formatting failures detected
```

So the exclusion buys a clean exit, not protection from damage.

**Thirteen fixtures formatted**, so a later run over the tree is a
no-op.

**Three test expectations updated.**
`import_unreadable_target_fails_scan` and `root_wildcard_fails_the_scan`
assert the line and column an error is reported at. nixfmt joins the
argument pattern onto the body line, which moves them:

```diff
-{ catalogs }:
-import ./no-such-helper.nix { inherit catalogs; }
+{ c

**File**: `cli/nef-lock-catalog/src/scan/analyze.rs` (modified, +5/-2)
```diff
@@ -3073,10 +3073,13 @@ mod tests {
         // fails rather than silently under-locking — for both forwarding
         // shapes.
         let cases = [
-            ("test_data/catalog_refs/import-entry-unreadable.nix", (4, 1)),
+            (
+                "test_data/catalog_refs/import-entry-unreadable.nix",
+                (3, 15),
+            ),
             (
                 "test_data/catalog_refs/import-entry-unreadable-whole.nix",
-                (5, 1),
+                (4, 15),
             ),
         ];
         // The scan names files canonically. The missing target has no
```

**File**: `cli/nef-lock-catalog/src/scan/mod.rs` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ mod tests {
             err,
             ScanError::UnlockableReference { file, position, reason }
                 if file == Path::new("escaping-root.nix")
-                    && position == Some((4, 3))
+                    && position == Some((3, 20))
                     && reason == "'catalogs.*' references the whole catalog namespace"
         );
     }
```

**File**: `cli/nef-lock-catalog/test_data/catalog_refs/dep-entry-wrapped.nix` (modified, +2/-1)
```diff
@@ -3,4 +3,5 @@
 let
   version = "1.0";
 in
-{ catalogs, dep-helper }: catalogs.myorg.toolkit.readVersion
+{ catalogs, dep-helper }:
+catalogs.myorg.toolkit.readVersion
```

**File**: `cli/nef-lock-catalog/test_data/catalog_refs/escaping-root.nix` (modified, +1/-2)
```diff
@@ -1,4 +1,3 @@
 # The whole namespace escapes into an opaque function, widening to a root
 # wildcard, which names nothing the server can resolve.
-{ catalogs, f }:
-f catalogs
+{ catalogs, f }: f catalogs
```

**File**: `cli/nef-lock-catalog/test_data/catalog_refs/import-dir/default.nix` (modified, +1/-2)
```diff
@@ -1,3 +1,2 @@
 # Reached via `import ./import-dir` (directory import).
-{ catalogs }:
-catalogs.myorg.dir-pkg
+{ catalogs }: catalogs.myorg.dir-pkg
```

---

### Incident Patch 2: `9bbe4061` (2026-09-29)
**Commit Message**: fix(activate): decide at replay whether traced growth is a list delta (#4714)

## Proposed Changes

Replaces #4707, which fixed the same bug inside the vendored
bash-envtrace patch. Following Michael's feedback, the tracer is left
alone and the decision moves to replay: its `prepend`/`append` records
are descriptive, and every record already carries the old value, so
replay has everything it needs to decide how to apply a growth record.

### The bug

The bash-envtrace tracer classifies growth textually: a
`prepend`/`append` record only says that the new value starts or ends
with the old one and what was added. Replay applied every such delta
onto the target shell's own value, which is right for `PATH`-style lists
and wrong for a value that was replaced by one that happens to start
with it.

The real-world case is a hook that evals `nix print-dev-env`, which
turns `TMPDIR=/var/folders/…/T/` into `…/T/nix-shell.abc`, recorded as
`append nix-shell.abc`. A nested `flox activate -- cmd` from the
activated shell attached and grew the already-grown value again, so the
nested command saw `TMPDIR=…/T/nix-shell.abcnix-shell.abc`, which does
not exist, and `just`, `mktemp` and anything else w

**File**: `cli/flox-activations/src/env_trace.rs` (modified, +402/-30)
```diff
@@ -16,10 +16,11 @@
 //! variable existed or are the single byte `@` when it did not.
 //!
 //! Unlike a before/after environment diff, a trace records *how* each value
-//! was built: `prepend`/`append` records carry only the delta, so replaying
-//! the trace onto a different shell's environment extends that shell's own
-//! value instead of clobbering it with the value captured in the shell that
-//! ran the activation.
+//! was built: `prepend`/`append` records carry the old value and only the
+//! added text, so a replay onto a different shell's environment can either
+//! extend that shell's own value or reconstruct the exact value the
+//! recording shell ended with. Which of the two is right for a given record
+//! is decided at replay time; see [`apply_growth`].
 
 use std::collections::HashMap;
 use std::path::Path;
@@ -159,9 +160,8 @@ pub enum TraceOp {
 /// One parsed trace record.
 ///
 /// The timestamp and pre/post export digits are validated during parsing but
-/// not retained: replay only needs the operation, the variable, and the
-/// operand. The recorded old value is retained for diagnostics but never
-/// replayed — it belongs to the start shell's context.
+/// not retained: replay only needs the operation, the variable, the operand
+/// and, for `prepend`/`append`, the old value (see [`apply_growth`]).
 #[derive(Debug, Clone, PartialEq)]
 pub struct TraceRecord {
     pub op: TraceOp,
@@ -293,12 +293,11 @@ fn unescape(escaped: &str) -> Result<String> {
 /// replays a trace.
 ///
 /// Application is semantic, not blind overwrite: `set`/`updated`/`reset`
-/// assign their operand, `prepend`/`append` apply their delta to the value
-/// the base environment currently holds (an empty base when it has none —
-/// the recorded old value is the start shell's and is never replayed),
-/// `unset` removes, `tempenv` is a no-op, and `set-if-absent` (a
-/// same-value assignment without declared reset intent) is applied only
-/// when the base has no value at all.
+/// assign their operand, `prepend`/`append` extend the value the base
+/// environment currently holds or reconstruct the recorded value (see
+/// [`apply_growth`]), `unset` removes, `tempenv` is a no-op, and
+/// `set-if-absent` (a same-value assignment without declared reset intent)
+/// is applied only when the base has no value at all.
 fn generate_diff_from_trace(
     records: &[TraceRecord],
     base_env: &HashMap<String, String>,
@@ -336,19 +335,7 @@ fn generate_diff_from_trace(
                 VarEffect::Set(record.operand.clone().expect("validated at parse time"))
             },
             TraceOp::Unset => VarEffect::Unset,
-            TraceOp::Prepend | TraceOp::Append => {
-                let delta = record.operand.clone().expect("validated at parse time");
-                // When the target has no value the base is EMPTY, not the
-                // recorded old value: the old value is the *start* shell's
-                // and replaying it would leak that shell's stack into a
-                // target that never had the variable — the exact class of
-                // bug the trace exists to eliminate.
-                let base = current.unwrap_or_default();
-                match record.op {
-                    TraceOp::Prepend => VarEffect::Set(format!("{delta}{base}")),
-                    _ => VarEffect::Set(format!("{base}{delta}")),
-                }
-            },
+            TraceOp::Prepend | TraceOp::Append => VarEffect::Set(apply_growth(record, current)),
         };
         effects.insert(record.name.clone(), effect);
     }
@@ -367,6 +354,135 @@ fn generate_diff_from_trace(
     env_diff
 }
 
+/// The character that joins the elements of a list-valued variable.
+///
+/// Only the POSIX `:` is recognized, for every variable. Those lists are
+/// search paths, where an element the target already has can be skipped.
+/// Whitespace-joined flag lists repeat tokens (`-isystem /a -isystem /b`),
+/// so treating them 
```

**File**: `cli/tests/activate.bats` (modified, +36/-0)
```diff
@@ -4132,6 +4132,42 @@ EOF
   assert_output "HOOKVAR=mine"
 }
 
+# A hook that grows a single value by plain text must not have that growth
+# spliced onto an attaching shell's own value. The real-world case is
+# TMPDIR=/tmp/ becoming /tmp/nix-shell.abc through `nix print-dev-env`: a
+# nested activation's shell already holds the grown value, so splicing the
+# growth again would point TMPDIR at /tmp/nix-shell.abcnix-shell.abc, which
+# does not exist. A list element is spliced, but never a second time.
+# bats test_tags=activate,activate:attach
+@test "attach does not re-apply textual growth of a non-list value" {
+  # We don't need an environment, but we do need wait_for_activations to have a
+  # PROJECT_DIR to look for
+  project_setup_common
+
+  "$FLOX_BIN" init -d proj
+  MANIFEST_CONTENTS="$(cat << "EOF"
+    version = 1
+
+    [hook]
+    on-activate = """
+      export GROWN="${GROWN}nix-shell.abc"
+      export LISTED="$LISTED:/added"
+    """
+EOF
+  )"
+  echo "$MANIFEST_CONTENTS" | "$FLOX_BIN" edit -d proj -f -
+
+  # Shell #1 starts the activation from the base values. Shell #2 activates
+  # from inside it, so it attaches while its own GROWN and LISTED already
+  # carry the hook's growth.
+  GROWN=/base/ LISTED=/base FLOX_SHELL=bash "$FLOX_BIN" activate -d proj -c \
+    "FLOX_SHELL=bash \"$FLOX_BIN\" activate -d proj -c 'echo \"GROWN=\$GROWN\"; echo \"LISTED=\$LISTED\"' > output"
+  run cat output
+  assert_success
+  assert_line "GROWN=/base/nix-shell.abc"
+  assert_line "LISTED=/base:/added"
+}
+
 # Export-attribute changes made through `declare -x`, `declare +x`, and
 # function-local `local -x` funnel through different code paths in bash
 # than the `export` builtin. An attaching shell must see their net
```

---

### Incident Patch 3: `7256c59f` (2026-09-29)
**Commit Message**: fix(activate): decide at replay whether traced growth is a list delta

The bash-envtrace tracer classifies growth textually: a `prepend`/`append`
record only says that the new value starts or ends with the old one and
what was added. Replay applied every such delta onto the target shell's
own value, which is right for PATH-style lists and wrong for a value
that was replaced by one that happens to start with it. The real-world
case is `nix print-dev-env` turning `TMPDIR=/T/` into `/T/nix-shell.abc`:
a nested `flox activate -- cmd` from the activated shell attached and
grew the already-grown value again, so the nested command saw a TMPDIR
that does not exist and `just`, `mktemp` and anything else writing to it
failed. The same happened to any non-list value a hook extends without
a separator.

The added text is now treated as list elements only when it meets the
old value at `:`, whether the separator sits on the added text or on the
old value's edge. Anything else replays the exact value the recording
shell ended with, which the record carries. That is correct on a fresh
activation and on a nested attach; a cross-context attach replaces such
a value rather than merging it. There is 

**File**: `cli/flox-activations/src/env_trace.rs` (modified, +402/-30)
```diff
@@ -16,10 +16,11 @@
 //! variable existed or are the single byte `@` when it did not.
 //!
 //! Unlike a before/after environment diff, a trace records *how* each value
-//! was built: `prepend`/`append` records carry only the delta, so replaying
-//! the trace onto a different shell's environment extends that shell's own
-//! value instead of clobbering it with the value captured in the shell that
-//! ran the activation.
+//! was built: `prepend`/`append` records carry the old value and only the
+//! added text, so a replay onto a different shell's environment can either
+//! extend that shell's own value or reconstruct the exact value the
+//! recording shell ended with. Which of the two is right for a given record
+//! is decided at replay time; see [`apply_growth`].
 
 use std::collections::HashMap;
 use std::path::Path;
@@ -159,9 +160,8 @@ pub enum TraceOp {
 /// One parsed trace record.
 ///
 /// The timestamp and pre/post export digits are validated during parsing but
-/// not retained: replay only needs the operation, the variable, and the
-/// operand. The recorded old value is retained for diagnostics but never
-/// replayed — it belongs to the start shell's context.
+/// not retained: replay only needs the operation, the variable, the operand
+/// and, for `prepend`/`append`, the old value (see [`apply_growth`]).
 #[derive(Debug, Clone, PartialEq)]
 pub struct TraceRecord {
     pub op: TraceOp,
@@ -293,12 +293,11 @@ fn unescape(escaped: &str) -> Result<String> {
 /// replays a trace.
 ///
 /// Application is semantic, not blind overwrite: `set`/`updated`/`reset`
-/// assign their operand, `prepend`/`append` apply their delta to the value
-/// the base environment currently holds (an empty base when it has none —
-/// the recorded old value is the start shell's and is never replayed),
-/// `unset` removes, `tempenv` is a no-op, and `set-if-absent` (a
-/// same-value assignment without declared reset intent) is applied only
-/// when the base has no value at all.
+/// assign their operand, `prepend`/`append` extend the value the base
+/// environment currently holds or reconstruct the recorded value (see
+/// [`apply_growth`]), `unset` removes, `tempenv` is a no-op, and
+/// `set-if-absent` (a same-value assignment without declared reset intent)
+/// is applied only when the base has no value at all.
 fn generate_diff_from_trace(
     records: &[TraceRecord],
     base_env: &HashMap<String, String>,
@@ -336,19 +335,7 @@ fn generate_diff_from_trace(
                 VarEffect::Set(record.operand.clone().expect("validated at parse time"))
             },
             TraceOp::Unset => VarEffect::Unset,
-            TraceOp::Prepend | TraceOp::Append => {
-                let delta = record.operand.clone().expect("validated at parse time");
-                // When the target has no value the base is EMPTY, not the
-                // recorded old value: the old value is the *start* shell's
-                // and replaying it would leak that shell's stack into a
-                // target that never had the variable — the exact class of
-                // bug the trace exists to eliminate.
-                let base = current.unwrap_or_default();
-                match record.op {
-                    TraceOp::Prepend => VarEffect::Set(format!("{delta}{base}")),
-                    _ => VarEffect::Set(format!("{base}{delta}")),
-                }
-            },
+            TraceOp::Prepend | TraceOp::Append => VarEffect::Set(apply_growth(record, current)),
         };
         effects.insert(record.name.clone(), effect);
     }
@@ -367,6 +354,135 @@ fn generate_diff_from_trace(
     env_diff
 }
 
+/// The character that joins the elements of a list-valued variable.
+///
+/// Only the POSIX `:` is recognized, for every variable. Those lists are
+/// search paths, where an element the target already has can be skipped.
+/// Whitespace-joined flag lists repeat tokens (`-isystem /a -isystem /b`),
+/// so treating them 
```

**File**: `cli/tests/activate.bats` (modified, +36/-0)
```diff
@@ -4132,6 +4132,42 @@ EOF
   assert_output "HOOKVAR=mine"
 }
 
+# A hook that grows a single value by plain text must not have that growth
+# spliced onto an attaching shell's own value. The real-world case is
+# TMPDIR=/tmp/ becoming /tmp/nix-shell.abc through `nix print-dev-env`: a
+# nested activation's shell already holds the grown value, so splicing the
+# growth again would point TMPDIR at /tmp/nix-shell.abcnix-shell.abc, which
+# does not exist. A list element is spliced, but never a second time.
+# bats test_tags=activate,activate:attach
+@test "attach does not re-apply textual growth of a non-list value" {
+  # We don't need an environment, but we do need wait_for_activations to have a
+  # PROJECT_DIR to look for
+  project_setup_common
+
+  "$FLOX_BIN" init -d proj
+  MANIFEST_CONTENTS="$(cat << "EOF"
+    version = 1
+
+    [hook]
+    on-activate = """
+      export GROWN="${GROWN}nix-shell.abc"
+      export LISTED="$LISTED:/added"
+    """
+EOF
+  )"
+  echo "$MANIFEST_CONTENTS" | "$FLOX_BIN" edit -d proj -f -
+
+  # Shell #1 starts the activation from the base values. Shell #2 activates
+  # from inside it, so it attaches while its own GROWN and LISTED already
+  # carry the hook's growth.
+  GROWN=/base/ LISTED=/base FLOX_SHELL=bash "$FLOX_BIN" activate -d proj -c \
+    "FLOX_SHELL=bash \"$FLOX_BIN\" activate -d proj -c 'echo \"GROWN=\$GROWN\"; echo \"LISTED=\$LISTED\"' > output"
+  run cat output
+  assert_success
+  assert_line "GROWN=/base/nix-shell.abc"
+  assert_line "LISTED=/base:/added"
+}
+
 # Export-attribute changes made through `declare -x`, `declare +x`, and
 # function-local `local -x` funnel through different code paths in bash
 # than the `export` builtin. An attaching shell must see their net
```

---

### Incident Patch 4: `c2dce80f` (2026-09-29)
**Commit Message**: fix(edit): skip outputs-default warning on purely additive schema bumps

The "Package output defaults may have changed" caveat is only true when
upgrading from `version = 1`. The v1 to 1.10.0 migration sets
`outputs = "all"` on every package descriptor that did not pin its
outputs -- the only non-lossless migration boundary in the chain.
Every migration from 1.10.0 onward adds optional fields only and
cannot change existing output selections.

Before this change the warning fired on every schema bump, including
purely additive ones such as adding `description` to a 1.16.0
manifest. The new `KnownSchemaVersion::upgrade_may_change_outputs`
predicate encodes the lossy-boundary fact in the manifest crate where
the migrations live, and `edit.rs` gates the third warning line on it.

Unit tests in `parsed::common::tests` cover V1 (true) and V1_10_0,
V1_16_0, and latest() (all false). Integration tests in `edit.bats`
assert the caveat appears on a v1 bump, does not appear on the existing
1.10.0 to 1.11.0 bump, and does not appear on a new 1.16.0 to 1.17.0
(description) bump.

Refs: DEV-342
Forge-Agent: implementation-worker (076f87f6)
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.co

**File**: `cli/flox-manifest/src/parsed/common.rs` (modified, +29/-0)
```diff
@@ -96,6 +96,23 @@ impl KnownSchemaVersion {
         }
     }
 
+    /// Returns whether upgrading from this schema version may change package
+    /// output defaults.
+    ///
+    /// Only the V1 → 1.10.0 boundary is non-lossless: that migration sets
+    /// `outputs = "all"` on every package descriptor that did not already
+    /// pin its outputs, which changes what gets built for packages that
+    /// previously relied on per-derivation defaults.
+    /// See `migrate/v1_to_v1_10_0.rs`.
+    ///
+    /// Every migration above 1.10.0 is additive (optional fields only), so
+    /// they cannot change existing output selections. If a future migration
+    /// introduces another non-lossless boundary, extend this predicate to
+    /// cover it.
+    pub fn upgrade_may_change_outputs(&self) -> bool {
+        matches!(self, KnownSchemaVersion::V1)
+    }
+
     /// Returns the version as it is written in a manifest: the full
     /// `key = value` TOML declaration. The legacy form is an unquoted
     /// integer (`version = 1`); every other version is a quoted string
@@ -707,6 +724,18 @@ mod tests {
 
     use super::*;
 
+    #[test]
+    fn v1_upgrade_may_change_outputs() {
+        assert!(KnownSchemaVersion::V1.upgrade_may_change_outputs());
+    }
+
+    #[test]
+    fn post_v1_upgrade_does_not_change_outputs() {
+        assert!(!KnownSchemaVersion::V1_10_0.upgrade_may_change_outputs());
+        assert!(!KnownSchemaVersion::V1_16_0.upgrade_may_change_outputs());
+        assert!(!KnownSchemaVersion::latest().upgrade_may_change_outputs());
+    }
+
     #[test]
     fn toml_declaration_renders_legacy_and_versioned_forms() {
         assert_eq!(KnownSchemaVersion::V1.toml_declaration(), "version = 1");
```

**File**: `cli/flox/src/commands/edit.rs` (modified, +12/-5)
```diff
@@ -250,11 +250,18 @@ impl Edit {
             } => {
                 if let Some((from, to)) = schema_bumped {
                     let declared = from.toml_declaration();
-                    message::warning(formatdoc! {"
-                        Manifest declared {declared}, but its contents use fields from a newer schema.
-                        Upgraded it to schema-version = \"{to}\" to apply your edit.
-                        Package output defaults may have changed for packages that did not set 'outputs'.
-                    "});
+                    if from.upgrade_may_change_outputs() {
+                        message::warning(formatdoc! {"
+                            Manifest declared {declared}, but its contents use fields from a newer schema.
+                            Upgraded it to schema-version = \"{to}\" to apply your edit.
+                            Package output defaults may have changed for packages that did not set 'outputs'.
+                        "});
+                    } else {
+                        message::warning(formatdoc! {"
+                            Manifest declared {declared}, but its contents use fields from a newer schema.
+                            Upgraded it to schema-version = \"{to}\" to apply your edit.
+                        "});
+                    }
                 }
 
                 if result.reactivate_required()?
```

**File**: `cli/tests/edit.bats` (modified, +38/-0)
```diff
@@ -492,6 +492,10 @@ EOF
   assert_output --partial 'Manifest declared version = 1'
   assert_output --partial 'Upgraded it to schema-version = "1.17.0"'
 
+  # Upgrading from v1 crosses the only non-lossless boundary (v1 -> 1.10.0
+  # sets output defaults), so the caveat must appear.
+  assert_output --partial "Package output defaults may have changed"
+
   # The manifest on disk must carry the bumped schema-version key.
   run grep 'schema-version' "$MANIFEST_PATH"
   assert_success
@@ -523,12 +527,46 @@ EOF
   assert_output --partial 'Manifest declared schema-version = "1.10.0"'
   assert_output --partial 'Upgraded it to schema-version = "1.11.0"'
 
+  # This is a purely additive bump (1.10.0 -> 1.11.0), so the outputs
+  # caveat must not appear.
+  refute_output --partial "Package output defaults may have changed"
+
   # The manifest on disk must carry 1.11.0, not a later version.
   run grep 'schema-version' "$MANIFEST_PATH"
   assert_success
   assert_output --partial 'schema-version = "1.11.0"'
 }
 
+# bats test_tags=edit:schema-upgrade
+# When a manifest at schema-version 1.16.0 uses 'description' (introduced in
+# 1.17.0), the schema bump is purely additive and must NOT warn about output
+# default changes — only the v1 -> 1.10.0 boundary is non-lossless.
+@test "'flox edit' does not warn about output defaults on additive schema bumps" {
+  "$FLOX_BIN" init
+
+  # description was introduced in schema-version 1.17.0.
+  # Using it in a 1.16.0 manifest is a purely additive bump.
+  cat << "EOF" > "$TMP_MANIFEST_PATH"
+schema-version = "1.16.0"
+
+description = "my test environment"
+EOF
+
+  run "$FLOX_BIN" edit -f "$TMP_MANIFEST_PATH"
+  assert_success
+
+  assert_output --partial 'Manifest declared schema-version = "1.16.0"'
+  assert_output --partial 'Upgraded it to schema-version = "1.17.0"'
+
+  # Purely additive bump — output defaults cannot change.
+  refute_output --partial "Package output defaults may have changed"
+
+  # The manifest on disk must carry the bumped schema-version key.
+  run grep 'schema-version' "$MANIFEST_PATH"
+  assert_success
+  assert_output --partial 'schema-version = "1.17.0"'
+}
+
 # bats test_tags=edit:schema-upgrade:invalid
 # A manifest with genuinely invalid syntax (not just a version mismatch) must
 # still fail — the schema-upgrade fallback must not swallow real errors.
```

---

### Incident Patch 5: `d3c82bad` (2026-09-29)
**Commit Message**: fix(buildenv): match runtime-packages by install_id, not attr_path/pkg-path (#4742)

## Proposed Changes

`flox build` rejected a namespaced catalog package listed in
`build.<name>.runtime-packages` with a misleading error —

```text
❌ ERROR: package '<name>' is not in 'toplevel' pkg-group
```

— even though the lockfile placed that package in the `toplevel` group.
This changes the `runtime-packages` validation to match by install ID.

Fixes flox/flox#4741. Refs CLI-236.

### Root cause

`buildenv/builder.pl` validated and filtered `runtime-packages` by
comparing the lockfile's `attr_path` against the manifest's `pkg-path`:

```perl
grep { $_->{"attr_path"} eq $install->{$name}{"pkg-path"} } @toplevelPackages
```

Those are two different fields. `attr_path` is the bare catalog
attribute copied verbatim from the resolver; `pkg-path` is user input in
`[install]` and keeps the `owner/` prefix for namespaced (user-catalog)
packages. The two are equal only when a package has no namespace, so
plain packages worked and namespaced ones failed. The follow-on closure
filter compared against `attr_path` the same way.

### Fix

Match on `install_id`, which every locked package carries and whic

**File**: `buildenv/builder.pl` (modified, +11/-7)
```diff
@@ -723,18 +723,22 @@ sub addPkg {
                 # to be installed.
                 if (defined $builds->{$build}{"runtime-packages"}) {
                     my @buildPackageNames = @{$builds->{$build}{"runtime-packages"}};
-                    # Derive the corresponding package attr-paths.
-                    my @buildPackageAttrPaths;
+                    # Collect the install_ids of packages selected for this build.
+                    # install_id is the canonical key: attr_path is the bare catalog
+                    # attribute and pkg-path is user input (which may carry an owner
+                    # prefix for namespaced packages), so neither is a reliable match
+                    # against the other across all cases.
+                    my @buildPackageInstallIds;
                     foreach my $name (@buildPackageNames) {
                         if (exists $install->{$name}) {
                             # Skip over any packages referenced in "runtime-packages" that
                             # are not installed for this system type.
                             if (exists $install->{$name}{'systems'}) {
                                 next unless grep { $_ eq $system } @{$install->{$name}{'systems'}};
                             }
-                            # First confirm that the pkg-path can be found in @toplevelPackages
-                            if (grep { $_->{"attr_path"} eq $install->{$name}{"pkg-path"} } @toplevelPackages) {
-                                push @buildPackageAttrPaths, $install->{$name}{"pkg-path"};
+                            # Confirm the install_id is present in @toplevelPackages.
+                            if (grep { $_->{"install_id"} eq $name } @toplevelPackages) {
+                                push @buildPackageInstallIds, $name;
                             } else {
                                 die "package '$name' is not in 'toplevel' pkg-group\n";
                             }
@@ -743,10 +747,10 @@ sub addPkg {
                         }
                     }
                     # Filter packages found in the "toplevel" pkg-group to include only
-                    # those packages found in `$buildPackageAttrPaths`.
+                    # those packages found in `@buildPackageInstallIds`.
                     my @buildPackages;
                     foreach my $package (@toplevelPackages) {
-                        if (grep { $_ eq $package->{"attr_path"} } @buildPackageAttrPaths) {
+                        if (grep { $_ eq $package->{"install_id"} } @buildPackageInstallIds) {
                             push @buildPackages, $package;
                         }
                     }
```

**File**: `cli/flox-rust-sdk/src/providers/buildenv.rs` (modified, +30/-0)
```diff
@@ -2872,6 +2872,36 @@ mod buildenv_tests {
         );
     }
 
+    /// A namespaced package (pkg-path `floxexamples/hello`) has an install_id
+    /// (`myhello`) that differs from its attr_path (`hello`). The old code
+    /// compared attr_path against pkg-path, so both mismatched and the build
+    /// failed with "package 'myhello' is not in 'toplevel' pkg-group". This
+    /// test verifies that matching on install_id fixes the regression.
+    #[test]
+    fn verify_build_closure_accepts_namespaced_package_in_runtime_packages() {
+        let buildenv = buildenv_instance();
+        let lockfile_path = MANUALLY_GENERATED
+            .join("buildenv/lockfiles/runtime-packages-namespaced-hello/manifest.lock");
+        let client = MockClient::new();
+        let result = buildenv.build(&client, &lockfile_path, None, None).unwrap();
+
+        let runtime = result.run.as_ref();
+        let develop = result.dev.as_ref();
+        let build_myhello = result.manifest_build_runtimes.get("build-myhello").unwrap();
+
+        // The namespaced hello package (install_id=myhello, attr_path=hello,
+        // pkg-path=floxexamples/hello) must appear in all closures.
+        assert!(runtime.join("bin/hello").is_executable_file());
+        assert!(develop.join("bin/hello").is_executable_file());
+        assert!(build_myhello.join("bin/hello").is_executable_file());
+
+        // coreutils is in toplevel but not listed in runtime-packages, so it
+        // must be absent from the build closure while present in run/dev.
+        assert!(runtime.join("bin/coreutils").is_executable_file());
+        assert!(develop.join("bin/coreutils").is_executable_file());
+        assert!(!build_myhello.join("bin/coreutils").exists());
+    }
+
     #[test]
     fn default_outputs_include_man() {
         let buildenv = buildenv_instance();
```

**File**: `test_data/manually_generated/buildenv/lockfiles/runtime-packages-namespaced-hello/manifest.lock` (added, +209/-0)
```diff
@@ -0,0 +1,209 @@
+{
+  "lockfile-version": 1,
+  "manifest": {
+    "schema-version": "1.14.0",
+    "install": {
+      "myhello": {
+        "pkg-path": "floxexamples/hello",
+        "outputs": "all"
+      },
+      "coreutils": {
+        "pkg-path": "coreutils",
+        "outputs": "all"
+      }
+    },
+    "options": {},
+    "build": {
+      "myhello": {
+        "command": "    mkdir -p $out/bin\n    echo echo hello foo > $out/bin/hello\n    echo exec hello >> $out/bin/hello\n    chmod +x $out/bin/hello\n",
+        "runtime-packages": [
+          "myhello"
+        ]
+      }
+    }
+  },
+  "packages": [
+    {
+      "attr_path": "coreutils",
+      "broken": false,
+      "derivation": "/nix/store/i1ym91acw8k71km03m1yc7k5n72s1jdb-coreutils-9.11.drv",
+      "description": "GNU Core Utilities",
+      "install_id": "coreutils",
+      "license": "GPL-3.0-or-later",
+      "locked_url": "https://github.com/flox/nixpkgs?rev=2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "name": "coreutils-9.11",
+      "pname": "coreutils",
+      "rev": "2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "rev_count": 1051473,
+      "rev_date": "2026-08-10T17:52:38Z",
+      "scrape_date": "2026-08-12T05:00:26.596310Z",
+      "stabilities": [
+        "unstable"
+      ],
+      "unfree": false,
+      "version": "9.11",
+      "outputs_to_install": [
+        "out"
+      ],
+      "outputs": {
+        "info": "/nix/store/dbcgkq5rzijsfxzd8k39rkdb8rf1wf0s-coreutils-9.11-info",
+        "out": "/nix/store/f0100xb3jh1wz822ngh721h898nqpwj7-coreutils-9.11"
+      },
+      "system": "aarch64-darwin",
+      "group": "toplevel",
+      "priority": 5
+    },
+    {
+      "attr_path": "coreutils",
+      "broken": false,
+      "derivation": "/nix/store/qmldn6aqr74hf89xpskl3sz24gpka5zj-coreutils-9.11.drv",
+      "description": "GNU Core Utilities",
+      "install_id": "coreutils",
+      "license": "GPL-3.0-or-later",
+      "locked_url": "https://github.com/flox/nixpkgs?rev=2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "name": "coreutils-9.11",
+      "pname": "coreutils",
+      "rev": "2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "rev_count": 1051473,
+      "rev_date": "2026-08-10T17:52:38Z",
+      "scrape_date": "2026-08-12T05:34:35.618927Z",
+      "stabilities": [
+        "unstable"
+      ],
+      "unfree": false,
+      "version": "9.11",
+      "outputs_to_install": [
+        "out",
+        "out"
+      ],
+      "outputs": {
+        "debug": "/nix/store/95qha5hcgfr3n1mxqqc53ijvs8h3vz90-coreutils-9.11-debug",
+        "info": "/nix/store/sygh7ax8hnnmakyzr5kmmfn60yddc2il-coreutils-9.11-info",
+        "out": "/nix/store/p79fmimbb698sv4c135kbdwlhjcqpd3p-coreutils-9.11"
+      },
+      "system": "aarch64-linux",
+      "group": "toplevel",
+      "priority": 5
+    },
+    {
+      "attr_path": "coreutils",
+      "broken": false,
+      "derivation": "/nix/store/wpdcwb9xd1gy3lhr514q4xzpy7s188v8-coreutils-9.11.drv",
+      "description": "GNU Core Utilities",
+      "install_id": "coreutils",
+      "license": "GPL-3.0-or-later",
+      "locked_url": "https://github.com/flox/nixpkgs?rev=2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "name": "coreutils-9.11",
+      "pname": "coreutils",
+      "rev": "2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "rev_count": 1051473,
+      "rev_date": "2026-08-10T17:52:38Z",
+      "scrape_date": "2026-08-12T06:14:57.292119Z",
+      "stabilities": [
+        "unstable"
+      ],
+      "unfree": false,
+      "version": "9.11",
+      "outputs_to_install": [
+        "out",
+        "out",
+        "out"
+      ],
+      "outputs": {
+        "debug": "/nix/store/5mpx87dpbzxk5js203akrn63q8zns9pc-coreutils-9.11-debug",
+        "info": "/nix/store/ml2c8ssa5g8pm4xydjkx95nl0yqb4686-coreutils-9.11-info",
+        "out": "/nix/store/di26b1kkbammy0sj70nq5qzvfrh78wxl-coreutils-9.11"
+      },
+      "system": "x86_64-linux",
+      "group": "toplevel",
+      "priority
```

---

### Incident Patch 6: `0971b005` (2026-09-28)
**Commit Message**: fix(buildenv): match runtime-packages by install_id, not attr_path/pkg-path

When a manifest install entry uses a namespaced pkg-path
(e.g. `floxexamples/hello`) the lockfile's attr_path is the bare
catalog attribute (`hello`), not the namespace-prefixed user input.
The old validation compared attr_path against pkg-path, so the two
never matched for namespaced packages and `flox build` rejected the
runtime-packages entry with a misleading "not in 'toplevel' pkg-group"
error.

install_id is set in every locked catalog package and uniquely
identifies the install entry in the manifest; both the membership
check and the follow-on closure filter are changed to use it:

- grep { $_->{"install_id"} eq $name } for the toplevel check
- @buildPackageInstallIds (was @buildPackageAttrPaths) as the
  selection list keyed by install_id throughout

This makes the match robust for the general case where install_id,
attr_path, and pkg-path all differ.

TDD: RED-GREEN-REFACTOR followed
- RED: new test verify_build_closure_accepts_namespaced_package_in_runtime_packages
  fails before the fix with "package 'myhello' is not in 'toplevel' pkg-group"
- GREEN: fix applied; test passes
- Existing runtime-p

**File**: `buildenv/builder.pl` (modified, +11/-7)
```diff
@@ -723,18 +723,22 @@ sub addPkg {
                 # to be installed.
                 if (defined $builds->{$build}{"runtime-packages"}) {
                     my @buildPackageNames = @{$builds->{$build}{"runtime-packages"}};
-                    # Derive the corresponding package attr-paths.
-                    my @buildPackageAttrPaths;
+                    # Collect the install_ids of packages selected for this build.
+                    # install_id is the canonical key: attr_path is the bare catalog
+                    # attribute and pkg-path is user input (which may carry an owner
+                    # prefix for namespaced packages), so neither is a reliable match
+                    # against the other across all cases.
+                    my @buildPackageInstallIds;
                     foreach my $name (@buildPackageNames) {
                         if (exists $install->{$name}) {
                             # Skip over any packages referenced in "runtime-packages" that
                             # are not installed for this system type.
                             if (exists $install->{$name}{'systems'}) {
                                 next unless grep { $_ eq $system } @{$install->{$name}{'systems'}};
                             }
-                            # First confirm that the pkg-path can be found in @toplevelPackages
-                            if (grep { $_->{"attr_path"} eq $install->{$name}{"pkg-path"} } @toplevelPackages) {
-                                push @buildPackageAttrPaths, $install->{$name}{"pkg-path"};
+                            # Confirm the install_id is present in @toplevelPackages.
+                            if (grep { $_->{"install_id"} eq $name } @toplevelPackages) {
+                                push @buildPackageInstallIds, $name;
                             } else {
                                 die "package '$name' is not in 'toplevel' pkg-group\n";
                             }
@@ -743,10 +747,10 @@ sub addPkg {
                         }
                     }
                     # Filter packages found in the "toplevel" pkg-group to include only
-                    # those packages found in `$buildPackageAttrPaths`.
+                    # those packages found in `@buildPackageInstallIds`.
                     my @buildPackages;
                     foreach my $package (@toplevelPackages) {
-                        if (grep { $_ eq $package->{"attr_path"} } @buildPackageAttrPaths) {
+                        if (grep { $_ eq $package->{"install_id"} } @buildPackageInstallIds) {
                             push @buildPackages, $package;
                         }
                     }
```

**File**: `cli/flox-rust-sdk/src/providers/buildenv.rs` (modified, +30/-0)
```diff
@@ -2872,6 +2872,36 @@ mod buildenv_tests {
         );
     }
 
+    /// A namespaced package (pkg-path `floxexamples/hello`) has an install_id
+    /// (`myhello`) that differs from its attr_path (`hello`). The old code
+    /// compared attr_path against pkg-path, so both mismatched and the build
+    /// failed with "package 'myhello' is not in 'toplevel' pkg-group". This
+    /// test verifies that matching on install_id fixes the regression.
+    #[test]
+    fn verify_build_closure_accepts_namespaced_package_in_runtime_packages() {
+        let buildenv = buildenv_instance();
+        let lockfile_path = MANUALLY_GENERATED
+            .join("buildenv/lockfiles/runtime-packages-namespaced-hello/manifest.lock");
+        let client = MockClient::new();
+        let result = buildenv.build(&client, &lockfile_path, None, None).unwrap();
+
+        let runtime = result.run.as_ref();
+        let develop = result.dev.as_ref();
+        let build_myhello = result.manifest_build_runtimes.get("build-myhello").unwrap();
+
+        // The namespaced hello package (install_id=myhello, attr_path=hello,
+        // pkg-path=floxexamples/hello) must appear in all closures.
+        assert!(runtime.join("bin/hello").is_executable_file());
+        assert!(develop.join("bin/hello").is_executable_file());
+        assert!(build_myhello.join("bin/hello").is_executable_file());
+
+        // coreutils is in toplevel but not listed in runtime-packages, so it
+        // must be absent from the build closure while present in run/dev.
+        assert!(runtime.join("bin/coreutils").is_executable_file());
+        assert!(develop.join("bin/coreutils").is_executable_file());
+        assert!(!build_myhello.join("bin/coreutils").exists());
+    }
+
     #[test]
     fn default_outputs_include_man() {
         let buildenv = buildenv_instance();
```

**File**: `test_data/manually_generated/buildenv/lockfiles/runtime-packages-namespaced-hello/manifest.lock` (added, +209/-0)
```diff
@@ -0,0 +1,209 @@
+{
+  "lockfile-version": 1,
+  "manifest": {
+    "schema-version": "1.14.0",
+    "install": {
+      "myhello": {
+        "pkg-path": "floxexamples/hello",
+        "outputs": "all"
+      },
+      "coreutils": {
+        "pkg-path": "coreutils",
+        "outputs": "all"
+      }
+    },
+    "options": {},
+    "build": {
+      "myhello": {
+        "command": "    mkdir -p $out/bin\n    echo echo hello foo > $out/bin/hello\n    echo exec hello >> $out/bin/hello\n    chmod +x $out/bin/hello\n",
+        "runtime-packages": [
+          "myhello"
+        ]
+      }
+    }
+  },
+  "packages": [
+    {
+      "attr_path": "coreutils",
+      "broken": false,
+      "derivation": "/nix/store/i1ym91acw8k71km03m1yc7k5n72s1jdb-coreutils-9.11.drv",
+      "description": "GNU Core Utilities",
+      "install_id": "coreutils",
+      "license": "GPL-3.0-or-later",
+      "locked_url": "https://github.com/flox/nixpkgs?rev=2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "name": "coreutils-9.11",
+      "pname": "coreutils",
+      "rev": "2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "rev_count": 1051473,
+      "rev_date": "2026-08-10T17:52:38Z",
+      "scrape_date": "2026-08-12T05:00:26.596310Z",
+      "stabilities": [
+        "unstable"
+      ],
+      "unfree": false,
+      "version": "9.11",
+      "outputs_to_install": [
+        "out"
+      ],
+      "outputs": {
+        "info": "/nix/store/dbcgkq5rzijsfxzd8k39rkdb8rf1wf0s-coreutils-9.11-info",
+        "out": "/nix/store/f0100xb3jh1wz822ngh721h898nqpwj7-coreutils-9.11"
+      },
+      "system": "aarch64-darwin",
+      "group": "toplevel",
+      "priority": 5
+    },
+    {
+      "attr_path": "coreutils",
+      "broken": false,
+      "derivation": "/nix/store/qmldn6aqr74hf89xpskl3sz24gpka5zj-coreutils-9.11.drv",
+      "description": "GNU Core Utilities",
+      "install_id": "coreutils",
+      "license": "GPL-3.0-or-later",
+      "locked_url": "https://github.com/flox/nixpkgs?rev=2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "name": "coreutils-9.11",
+      "pname": "coreutils",
+      "rev": "2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "rev_count": 1051473,
+      "rev_date": "2026-08-10T17:52:38Z",
+      "scrape_date": "2026-08-12T05:34:35.618927Z",
+      "stabilities": [
+        "unstable"
+      ],
+      "unfree": false,
+      "version": "9.11",
+      "outputs_to_install": [
+        "out",
+        "out"
+      ],
+      "outputs": {
+        "debug": "/nix/store/95qha5hcgfr3n1mxqqc53ijvs8h3vz90-coreutils-9.11-debug",
+        "info": "/nix/store/sygh7ax8hnnmakyzr5kmmfn60yddc2il-coreutils-9.11-info",
+        "out": "/nix/store/p79fmimbb698sv4c135kbdwlhjcqpd3p-coreutils-9.11"
+      },
+      "system": "aarch64-linux",
+      "group": "toplevel",
+      "priority": 5
+    },
+    {
+      "attr_path": "coreutils",
+      "broken": false,
+      "derivation": "/nix/store/wpdcwb9xd1gy3lhr514q4xzpy7s188v8-coreutils-9.11.drv",
+      "description": "GNU Core Utilities",
+      "install_id": "coreutils",
+      "license": "GPL-3.0-or-later",
+      "locked_url": "https://github.com/flox/nixpkgs?rev=2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "name": "coreutils-9.11",
+      "pname": "coreutils",
+      "rev": "2fcb964de67fcf60b43471c55d5d99e61a9ccb5a",
+      "rev_count": 1051473,
+      "rev_date": "2026-08-10T17:52:38Z",
+      "scrape_date": "2026-08-12T06:14:57.292119Z",
+      "stabilities": [
+        "unstable"
+      ],
+      "unfree": false,
+      "version": "9.11",
+      "outputs_to_install": [
+        "out",
+        "out",
+        "out"
+      ],
+      "outputs": {
+        "debug": "/nix/store/5mpx87dpbzxk5js203akrn63q8zns9pc-coreutils-9.11-debug",
+        "info": "/nix/store/ml2c8ssa5g8pm4xydjkx95nl0yqb4686-coreutils-9.11-info",
+        "out": "/nix/store/di26b1kkbammy0sj70nq5qzvfrh78wxl-coreutils-9.11"
+      },
+      "system": "x86_64-linux",
+      "group": "toplevel",
+      "priority
```

---

### Incident Patch 7: `02744fe2` (2026-09-25)
**Commit Message**: fix(envs): hide remote-env cache checkout from inactive list (#4731)

## Proposed Changes

### What

`flox envs` listed an activated remote environment twice: once correctly
under Active as a remote, and again under Inactive with its local cache
path (`~/.cache/flox/remote/<owner>/<name>`). This drops the second
entry.

### Why

Activating a remote environment opens an inner managed environment
checked out under the cache directory, and opening any managed
environment registers it in the env registry. `flox envs` reads that
registry to build its Inactive list, so the cache checkout surfaced as a
separate environment — leaking an internal path and duplicating the
active remote.

### Approach

The registry entry stays. Garbage collection relies on it to prune the
remote's floxmeta branch, and `flox delete -r` deregisters through it;
removing the registration would break both. So the fix filters the cache
checkout out of the `flox envs` listing rather than suppressing the
registration.

Detection is anchored to the current `flox.cache_dir`: an entry is a
backing checkout when its path equals
`<cache_dir>/remote/<owner>/<name>/.flox` for its own pointer. The cache
root is canonicalized

**File**: `cli/flox-rust-sdk/src/models/environment/remote_environment.rs` (modified, +149/-0)
```diff
@@ -115,6 +115,30 @@ impl RemoteEnvironment {
         Self::checkout_path(flox, pointer).join(DOT_FLOX).exists()
     }
 
+    /// Whether `dot_flox_path` is the flox-managed cache checkout that backs the
+    /// remote environment named by `pointer`: the `.flox` at
+    /// `<cache_dir>/remote/<owner>/<name>`. `flox envs` uses this to hide those
+    /// internal checkouts from its listing.
+    ///
+    /// Anchored to the current `Flox::cache_dir` so a user's own managed
+    /// environment pulled to an arbitrary path (even one ending in
+    /// `remote/<owner>/<name>/.flox`) is not mistaken for a cache checkout. The
+    /// cache root is canonicalized before comparison because it may be
+    /// non-canonical (e.g. macOS `$TMPDIR`) while registry paths are always
+    /// canonical, so a raw comparison would spuriously miss.
+    pub fn is_checkout_of(flox: &Flox, dot_flox_path: &Path, pointer: &ManagedPointer) -> bool {
+        let cache_root = flox
+            .cache_dir
+            .canonicalize()
+            .unwrap_or_else(|_| flox.cache_dir.clone());
+        let expected = cache_root
+            .join(REMOTE_ENVIRONMENT_BASE_DIR)
+            .join(pointer.owner.as_ref())
+            .join(pointer.name.as_ref())
+            .join(DOT_FLOX);
+        expected == *dot_flox_path
+    }
+
     /// Pull a remote environment into a flox-provided managed environment
     /// at [RemoteEnvironment::checkout_path].
     ///
@@ -776,4 +800,129 @@ mod tests {
 
         assert_eq!(history_kind, &HistoryKind::Initialize);
     }
+
+    /// A canonical registry path equal to `canonicalize(flox.cache_dir)/remote/<owner>/<name>/.flox`
+    /// is recognised as the cache checkout for that pointer.
+    ///
+    /// The test constructs the path via `canonicalize(cache_dir)` to exercise the
+    /// canonicalization path — registry paths are always canonical while
+    /// `flox.cache_dir` may not be (e.g. macOS `$TMPDIR`).
+    #[test]
+    fn is_checkout_of_true_for_canonical_cache_checkout() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        // Construct the canonical path a registry entry would hold: start from the
+        // real (canonical) cache root, as `ManagedEnvironment::open` stores it.
+        let canonical_cache = flox
+            .cache_dir
+            .canonicalize()
+            .unwrap_or_else(|_| flox.cache_dir.clone());
+        let dot_flox = canonical_cache
+            .join(REMOTE_ENVIRONMENT_BASE_DIR)
+            .join(pointer.owner.as_ref())
+            .join(pointer.name.as_ref())
+            .join(DOT_FLOX);
+        assert!(RemoteEnvironment::is_checkout_of(
+            &flox, &dot_flox, &pointer
+        ));
+    }
+
+    /// A managed env pulled to an arbitrary path that happens to end with
+    /// `remote/<owner>/<name>/.flox` but lives outside `flox.cache_dir` must NOT
+    /// be mistaken for a cache checkout (regression guard for DEV-337).
+    ///
+    /// Repro: `flox pull -d /tmp/x/remote/owner/myenv owner/myenv` then
+    /// `flox envs` — the env must appear in the listing, not be hidden.
+    #[test]
+    fn is_checkout_of_false_for_user_env_outside_cache_dir() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        // A path with the right trailing shape but rooted outside flox.cache_dir.
+        // This simulates `flox pull -d /tmp/x/remote/owner/myenv owner/myenv`.
+        let outside_cache = PathBuf::from("/tmp/x/remote/owner/myenv/.flox");
+        assert!(!RemoteEnv
```

**File**: `cli/flox/src/commands/envs.rs` (modified, +108/-1)
```diff
@@ -8,6 +8,7 @@ use crossterm::style::Stylize;
 use flox_manifest::interfaces::AsLatestSchema;
 use flox_rust_sdk::flox::Flox;
 use flox_rust_sdk::models::env_registry::{EnvRegistry, garbage_collect};
+use flox_rust_sdk::models::environment::remote_environment::RemoteEnvironment;
 use flox_rust_sdk::models::environment::{DotFlox, EnvironmentPointer, ManagedPointer};
 use serde_json::json;
 use tracing::instrument;
@@ -109,6 +110,11 @@ impl Envs {
         active: ActiveEnvironments,
         registered: impl Iterator<Item = UninitializedEnvironment>,
     ) -> Result<()> {
+        // Strip cache-checkout entries that back remote environments before
+        // computing the inactive set.  The registry entry itself is preserved
+        // — GC pruning and `flox delete -r` depend on it — only the display
+        // is filtered.
+        let registered = registered.filter(|env| !is_cached_remote_backing(flox, env));
         let inactive = get_inactive_environments(registered, active.iter())?;
 
         if self.json {
@@ -320,6 +326,30 @@ fn format_path(path: &Path) -> String {
     path.parent().unwrap_or(path).to_string_lossy().to_string()
 }
 
+/// True when `env` is the managed-environment cache checkout that backs a
+/// remote environment.
+///
+/// Activating a [`RemoteEnvironment`] creates an inner [`ManagedEnvironment`]
+/// under `<cache_root>/remote/<owner>/<name>/.flox` and registers it in the
+/// env-registry.  That registration is load-bearing (GC pruning and
+/// `flox delete -r` rely on it), but the cache entry must not appear as a
+/// second inactive entry in `flox envs` alongside the remote.
+///
+/// Detection uses [`RemoteEnvironment::is_checkout_of`], anchored to the
+/// current `Flox::cache_dir` so a user-managed environment pulled to an
+/// arbitrary path (even one ending in `remote/<owner>/<name>/.flox`) is not
+/// mistaken for a cache checkout.
+fn is_cached_remote_backing(flox: &Flox, env: &UninitializedEnvironment) -> bool {
+    let UninitializedEnvironment::DotFlox(DotFlox {
+        path,
+        pointer: EnvironmentPointer::Managed(mp),
+    }) = env
+    else {
+        return false;
+    };
+    RemoteEnvironment::is_checkout_of(flox, path, mp)
+}
+
 fn get_registered_environments(
     registry: &EnvRegistry,
 ) -> impl Iterator<Item = UninitializedEnvironment> + '_ {
@@ -356,7 +386,8 @@ mod tests {
 
     use flox_core::data::environment_ref::{EnvironmentName, EnvironmentOwner};
     use flox_core::floxhub::Floxhub;
-    use flox_rust_sdk::models::environment::PathPointer;
+    use flox_rust_sdk::flox::test_helpers::flox_instance_with_optional_floxhub;
+    use flox_rust_sdk::models::environment::{DOT_FLOX, PathPointer};
     use indoc::formatdoc;
     use pretty_assertions::assert_eq;
 
@@ -441,4 +472,80 @@ mod tests {
             name_path  /envs/path
         "});
     }
+
+    /// A canonical registry path under `flox.cache_dir` is identified as the
+    /// cache checkout for its pointer.
+    #[test]
+    fn is_cached_remote_backing_true_for_cache_checkout() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _tempdir) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        // Construct a canonical path as the registry would store it: start
+        // from the real (canonical) cache root.
+        let canonical_cache = flox
+            .cache_dir
+            .canonicalize()
+            .unwrap_or_else(|_| flox.cache_dir.clone());
+        let checkout_dot_flox = canonical_cache
+            .join("remote")
+            .join(pointer.owner.as_ref())
+            .join(pointer.name.as_ref())
+            .join(DOT_FLOX);
+
+        let env = UninitializedEnvironment::DotFlox(DotFlox {
+            path: checkout_dot_flox,
+            pointer: EnvironmentPointer::Managed(pointer),
+        });
+   
```

**File**: `cli/tests/environment-remote.bats` (modified, +25/-0)
```diff
@@ -499,3 +499,28 @@ EOF
   ensure_remote_environment_built "$OWNER/test"
   _FLOX_TESTING_NO_WRITABLE=true "$FLOX_BIN" activate --trust -r "$OWNER/test" -- true
 }
+
+# bats test_tags=hermetic,remote,remote:envs
+# Regression test for DEV-337: activating a remote environment must not cause
+# the backing cache checkout to appear as an inactive managed environment in
+# `flox envs` output.
+@test "activated remote env appears once under Active, not under Inactive" {
+  make_empty_remote_env
+
+  export FLOX_CACHE_DIR="$(realpath $FLOX_CACHE_DIR)"
+
+  # Capture `flox envs` output from inside the activated remote environment.
+  # The `-c` command is executed with _FLOX_ACTIVE_ENVIRONMENTS set, so
+  # `flox envs` sees the remote as active.
+  run "$FLOX_BIN" activate --trust --reference "$OWNER/test" \
+    -c "$FLOX_BIN envs"
+  assert_success
+
+  # The remote must appear in the Active section.
+  assert_output --partial "Active environments:"
+  assert_output --partial "$OWNER/test"
+
+  # The cache checkout path must not appear anywhere — it must not leak into
+  # the Inactive section as a second entry for the same environment.
+  refute_output --partial "$FLOX_CACHE_DIR/remote/$OWNER/test"
+}
```

---

### Incident Patch 8: `198ee7a3` (2026-09-25)
**Commit Message**: fix(envs): anchor remote cache-checkout detection to cache_dir

The trailing-path-shape match in `is_checkout_of` was too broad:
any managed environment pulled to a path ending in
`remote/<owner>/<name>/.flox` — including a user env created with
`flox pull -d /tmp/x/remote/owner/myenv owner/myenv` — was wrongly
hidden from `flox envs`.

Re-anchors detection to the canonical `Flox::cache_dir`:
`is_checkout_of` now builds the one expected path
(`canonicalize(cache_dir)/remote/<owner>/<name>/.flox`) and
compares it with the registry path rather than matching on trailing
path components. Canonicalization of the cache root is needed
because macOS `$TMPDIR` is non-canonical while registry paths (stored
via `CanonicalPath`) are always canonical — a raw comparison would
spuriously miss.

Removes the two tests that asserted a different-cache-root path
still matched (the incorrect behaviour), and replaces them with:
- a true case constructed from `canonicalize(cache_dir)` to exercise
  the canonicalization path
- a false/regression-guard case for a user env outside `cache_dir`
  that shares the right trailing shape

Also fixes the `is_cached_remote_backing` doc to drop the word
"active" — th

**File**: `cli/flox-rust-sdk/src/models/environment/remote_environment.rs` (modified, +84/-40)
```diff
@@ -115,27 +115,28 @@ impl RemoteEnvironment {
         Self::checkout_path(flox, pointer).join(DOT_FLOX).exists()
     }
 
-    /// Whether `dot_flox_path` has the layout of the cache checkout that backs
-    /// the remote environment named by `pointer`: it ends with
-    /// `remote/<owner>/<name>/.flox`. Independent of the current cache root,
-    /// because `XDG_CACHE_HOME` (hence `Flox::cache_dir`) can differ between
-    /// the session that created the checkout and the one now listing it.
-    /// `flox envs` uses this to hide those backing environments from its list.
-    pub fn is_checkout_of(dot_flox_path: &Path, pointer: &ManagedPointer) -> bool {
-        let expected = [
-            REMOTE_ENVIRONMENT_BASE_DIR,
-            pointer.owner.as_ref(),
-            pointer.name.as_ref(),
-            DOT_FLOX,
-        ];
-        let mut actual = dot_flox_path.components().rev();
-        for want in expected.iter().rev() {
-            match actual.next() {
-                Some(std::path::Component::Normal(got)) if got == std::ffi::OsStr::new(want) => {},
-                _ => return false,
-            }
-        }
-        true
+    /// Whether `dot_flox_path` is the flox-managed cache checkout that backs the
+    /// remote environment named by `pointer`: the `.flox` at
+    /// `<cache_dir>/remote/<owner>/<name>`. `flox envs` uses this to hide those
+    /// internal checkouts from its listing.
+    ///
+    /// Anchored to the current `Flox::cache_dir` so a user's own managed
+    /// environment pulled to an arbitrary path (even one ending in
+    /// `remote/<owner>/<name>/.flox`) is not mistaken for a cache checkout. The
+    /// cache root is canonicalized before comparison because it may be
+    /// non-canonical (e.g. macOS `$TMPDIR`) while registry paths are always
+    /// canonical, so a raw comparison would spuriously miss.
+    pub fn is_checkout_of(flox: &Flox, dot_flox_path: &Path, pointer: &ManagedPointer) -> bool {
+        let cache_root = flox
+            .cache_dir
+            .canonicalize()
+            .unwrap_or_else(|_| flox.cache_dir.clone());
+        let expected = cache_root
+            .join(REMOTE_ENVIRONMENT_BASE_DIR)
+            .join(pointer.owner.as_ref())
+            .join(pointer.name.as_ref())
+            .join(DOT_FLOX);
+        expected == *dot_flox_path
     }
 
     /// Pull a remote environment into a flox-provided managed environment
@@ -800,33 +801,56 @@ mod tests {
         assert_eq!(history_kind, &HistoryKind::Initialize);
     }
 
-    /// A path ending with `remote/<owner>/<name>/.flox` is recognised as the
-    /// checkout backing that pointer, regardless of the leading cache root.
+    /// A canonical registry path equal to `canonicalize(flox.cache_dir)/remote/<owner>/<name>/.flox`
+    /// is recognised as the cache checkout for that pointer.
+    ///
+    /// The test constructs the path via `canonicalize(cache_dir)` to exercise the
+    /// canonicalization path — registry paths are always canonical while
+    /// `flox.cache_dir` may not be (e.g. macOS `$TMPDIR`).
     #[test]
-    fn is_checkout_of_true_for_own_dot_flox() {
+    fn is_checkout_of_true_for_canonical_cache_checkout() {
         let owner = EnvironmentOwner::from_str("owner").unwrap();
         let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
         let name = EnvironmentName::from_str("myenv").unwrap();
         let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
 
-        let dot_flox = RemoteEnvironment::checkout_path(&flox, &pointer).join(DOT_FLOX);
-        assert!(RemoteEnvironment::is_checkout_of(&dot_flox, &pointer));
+        // Construct the canonical path a registry entry would hold: start from the
+        // real (canonical) cache root, as `ManagedEnvironment::open` stores it.
+        let canonical_cache = flox
+            .cache_dir
+            .canonicalize()
+            .unwrap_or_else(|_| flox.cache_dir.clone());
+ 
```

**File**: `cli/flox/src/commands/envs.rs` (modified, +40/-29)
```diff
@@ -110,11 +110,11 @@ impl Envs {
         active: ActiveEnvironments,
         registered: impl Iterator<Item = UninitializedEnvironment>,
     ) -> Result<()> {
-        // Strip cache-checkout entries that back active remote environments
-        // before computing the inactive set.  The registry entry itself is
-        // preserved — GC pruning and `flox delete -r` depend on it — only the
-        // display is filtered.
-        let registered = registered.filter(|env| !is_cached_remote_backing(env));
+        // Strip cache-checkout entries that back remote environments before
+        // computing the inactive set.  The registry entry itself is preserved
+        // — GC pruning and `flox delete -r` depend on it — only the display
+        // is filtered.
+        let registered = registered.filter(|env| !is_cached_remote_backing(flox, env));
         let inactive = get_inactive_environments(registered, active.iter())?;
 
         if self.json {
@@ -326,28 +326,28 @@ fn format_path(path: &Path) -> String {
     path.parent().unwrap_or(path).to_string_lossy().to_string()
 }
 
-/// True when `env` is the managed-environment cache checkout that backs an
-/// active remote environment.
+/// True when `env` is the managed-environment cache checkout that backs a
+/// remote environment.
 ///
 /// Activating a [`RemoteEnvironment`] creates an inner [`ManagedEnvironment`]
 /// under `<cache_root>/remote/<owner>/<name>/.flox` and registers it in the
 /// env-registry.  That registration is load-bearing (GC pruning and
 /// `flox delete -r` rely on it), but the cache entry must not appear as a
-/// second inactive entry in `flox envs` alongside the active remote.
+/// second inactive entry in `flox envs` alongside the remote.
 ///
-/// Detection uses [`RemoteEnvironment::is_checkout_of`], which matches on the
-/// trailing path shape rather than the current `flox.cache_dir`, so it works
-/// even when `XDG_CACHE_HOME` differs between the session that activated the
-/// environment and the one now running `flox envs`.
-fn is_cached_remote_backing(env: &UninitializedEnvironment) -> bool {
+/// Detection uses [`RemoteEnvironment::is_checkout_of`], anchored to the
+/// current `Flox::cache_dir` so a user-managed environment pulled to an
+/// arbitrary path (even one ending in `remote/<owner>/<name>/.flox`) is not
+/// mistaken for a cache checkout.
+fn is_cached_remote_backing(flox: &Flox, env: &UninitializedEnvironment) -> bool {
     let UninitializedEnvironment::DotFlox(DotFlox {
         path,
         pointer: EnvironmentPointer::Managed(mp),
     }) = env
     else {
         return false;
     };
-    RemoteEnvironment::is_checkout_of(path, mp)
+    RemoteEnvironment::is_checkout_of(flox, path, mp)
 }
 
 fn get_registered_environments(
@@ -387,7 +387,6 @@ mod tests {
     use flox_core::data::environment_ref::{EnvironmentName, EnvironmentOwner};
     use flox_core::floxhub::Floxhub;
     use flox_rust_sdk::flox::test_helpers::flox_instance_with_optional_floxhub;
-    use flox_rust_sdk::models::environment::remote_environment::RemoteEnvironment;
     use flox_rust_sdk::models::environment::{DOT_FLOX, PathPointer};
     use indoc::formatdoc;
     use pretty_assertions::assert_eq;
@@ -474,39 +473,51 @@ mod tests {
         "});
     }
 
-    /// A `DotFlox::Managed` whose path ends with `remote/<owner>/<name>/.flox`
-    /// is identified as a backing entry.
+    /// A canonical registry path under `flox.cache_dir` is identified as the
+    /// cache checkout for its pointer.
     #[test]
     fn is_cached_remote_backing_true_for_cache_checkout() {
         let owner = EnvironmentOwner::from_str("owner").unwrap();
         let (flox, _tempdir) = flox_instance_with_optional_floxhub(Some(&owner));
         let name = EnvironmentName::from_str("myenv").unwrap();
         let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
-        let checkout_dot_flox = RemoteEnvironment::checkout_path(&flox, &pointer).join(DOT_FLOX);

```

---

### Incident Patch 9: `8337881a` (2026-09-24)
**Commit Message**: fix(envs): detect remote cache checkouts independent of cache root

RemoteEnvironment::is_checkout_of previously compared the registered
.flox path against checkout_path(flox, pointer).join(DOT_FLOX), which
anchors to flox.cache_dir. When XDG_CACHE_HOME differs between the
session that activated a remote environment and the one running
flox envs, the paths never match, so every cache checkout leaks into
the inactive list as a bare ~/.cache/... entry.

Replace the equality check with a trailing-component match:
remote/<owner>/<name>/.flox. This is the structural contract a remote
cache checkout must satisfy regardless of which cache root it lives
under, and it requires no filesystem I/O.

Drop the flox parameter from is_checkout_of and from
is_cached_remote_backing in envs.rs; handle_all's filter no longer
captures flox for this purpose. Add regression tests asserting that a
path under a different cache root matches correctly.

Refs: DEV-337
Forge-Agent: implementation-worker (8ffbc156)
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `cli/flox-rust-sdk/src/models/environment/remote_environment.rs` (modified, +70/-24)
```diff
@@ -115,16 +115,27 @@ impl RemoteEnvironment {
         Self::checkout_path(flox, pointer).join(DOT_FLOX).exists()
     }
 
-    /// True when `dot_flox_path` is the cache checkout backing `pointer`.
-    ///
-    /// `flox envs` uses this to suppress the inner managed environment that
-    /// [RemoteEnvironment::new] registers in the env-registry: that entry is
-    /// load-bearing for GC pruning and `flox delete -r`, but must not appear
-    /// as a second "inactive" entry alongside the active remote.
-    ///
-    /// Pure path computation — no filesystem I/O.
-    pub fn is_checkout_of(flox: &Flox, dot_flox_path: &Path, pointer: &ManagedPointer) -> bool {
-        Self::checkout_path(flox, pointer).join(DOT_FLOX) == *dot_flox_path
+    /// Whether `dot_flox_path` has the layout of the cache checkout that backs
+    /// the remote environment named by `pointer`: it ends with
+    /// `remote/<owner>/<name>/.flox`. Independent of the current cache root,
+    /// because `XDG_CACHE_HOME` (hence `Flox::cache_dir`) can differ between
+    /// the session that created the checkout and the one now listing it.
+    /// `flox envs` uses this to hide those backing environments from its list.
+    pub fn is_checkout_of(dot_flox_path: &Path, pointer: &ManagedPointer) -> bool {
+        let expected = [
+            REMOTE_ENVIRONMENT_BASE_DIR,
+            pointer.owner.as_ref(),
+            pointer.name.as_ref(),
+            DOT_FLOX,
+        ];
+        let mut actual = dot_flox_path.components().rev();
+        for want in expected.iter().rev() {
+            match actual.next() {
+                Some(std::path::Component::Normal(got)) if got == std::ffi::OsStr::new(want) => {},
+                _ => return false,
+            }
+        }
+        true
     }
 
     /// Pull a remote environment into a flox-provided managed environment
@@ -789,7 +800,8 @@ mod tests {
         assert_eq!(history_kind, &HistoryKind::Initialize);
     }
 
-    /// The checkout's own `.flox` directory is recognised as its backing path.
+    /// A path ending with `remote/<owner>/<name>/.flox` is recognised as the
+    /// checkout backing that pointer, regardless of the leading cache root.
     #[test]
     fn is_checkout_of_true_for_own_dot_flox() {
         let owner = EnvironmentOwner::from_str("owner").unwrap();
@@ -798,9 +810,23 @@ mod tests {
         let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
 
         let dot_flox = RemoteEnvironment::checkout_path(&flox, &pointer).join(DOT_FLOX);
-        assert!(RemoteEnvironment::is_checkout_of(
-            &flox, &dot_flox, &pointer
-        ));
+        assert!(RemoteEnvironment::is_checkout_of(&dot_flox, &pointer));
+    }
+
+    /// The same trailing shape under a different cache root still matches —
+    /// this is the regression `XDG_CACHE_HOME` variance introduced.
+    #[test]
+    fn is_checkout_of_true_for_different_cache_root() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        // Construct the path under a completely different cache root than
+        // `flox.cache_dir` — what happens when XDG_CACHE_HOME changes between
+        // the session that created the checkout and the one now listing it.
+        let other_root = PathBuf::from("/some/other/root/remote/owner/myenv/.flox");
+        assert!(RemoteEnvironment::is_checkout_of(&other_root, &pointer));
     }
 
     /// An unrelated path is not identified as a checkout of this pointer.
@@ -811,13 +837,11 @@ mod tests {
         let name = EnvironmentName::from_str("myenv").unwrap();
         let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
 
-        let unrelated = std::path::PathBuf::from("/some/other/path/.flox");
-        assert!(!RemoteEnvir
```

**File**: `cli/flox/src/commands/envs.rs` (modified, +32/-13)
```diff
@@ -114,7 +114,7 @@ impl Envs {
         // before computing the inactive set.  The registry entry itself is
         // preserved — GC pruning and `flox delete -r` depend on it — only the
         // display is filtered.
-        let registered = registered.filter(|env| !is_cached_remote_backing(flox, env));
+        let registered = registered.filter(|env| !is_cached_remote_backing(env));
         let inactive = get_inactive_environments(registered, active.iter())?;
 
         if self.json {
@@ -330,23 +330,24 @@ fn format_path(path: &Path) -> String {
 /// active remote environment.
 ///
 /// Activating a [`RemoteEnvironment`] creates an inner [`ManagedEnvironment`]
-/// under `~/.cache/flox/remote/<owner>/<name>/.flox` and registers it in the
+/// under `<cache_root>/remote/<owner>/<name>/.flox` and registers it in the
 /// env-registry.  That registration is load-bearing (GC pruning and
 /// `flox delete -r` rely on it), but the cache entry must not appear as a
 /// second inactive entry in `flox envs` alongside the active remote.
 ///
-/// Detection is pointer-derived: the path must equal
-/// `RemoteEnvironment::checkout_path(flox, pointer).join(".flox")`, not just
-/// a prefix match on the cache dir.
-fn is_cached_remote_backing(flox: &Flox, env: &UninitializedEnvironment) -> bool {
+/// Detection uses [`RemoteEnvironment::is_checkout_of`], which matches on the
+/// trailing path shape rather than the current `flox.cache_dir`, so it works
+/// even when `XDG_CACHE_HOME` differs between the session that activated the
+/// environment and the one now running `flox envs`.
+fn is_cached_remote_backing(env: &UninitializedEnvironment) -> bool {
     let UninitializedEnvironment::DotFlox(DotFlox {
         path,
         pointer: EnvironmentPointer::Managed(mp),
     }) = env
     else {
         return false;
     };
-    RemoteEnvironment::is_checkout_of(flox, path, mp)
+    RemoteEnvironment::is_checkout_of(path, mp)
 }
 
 fn get_registered_environments(
@@ -473,8 +474,8 @@ mod tests {
         "});
     }
 
-    /// A `DotFlox::Managed` whose path matches the remote-environment cache
-    /// checkout is identified as a backing entry.
+    /// A `DotFlox::Managed` whose path ends with `remote/<owner>/<name>/.flox`
+    /// is identified as a backing entry.
     #[test]
     fn is_cached_remote_backing_true_for_cache_checkout() {
         let owner = EnvironmentOwner::from_str("owner").unwrap();
@@ -487,7 +488,25 @@ mod tests {
             path: checkout_dot_flox,
             pointer: EnvironmentPointer::Managed(pointer),
         });
-        assert!(is_cached_remote_backing(&flox, &env));
+        assert!(is_cached_remote_backing(&env));
+    }
+
+    /// A path under a different cache root but with the same trailing shape is
+    /// also identified as a backing entry — the regression this change fixes.
+    #[test]
+    fn is_cached_remote_backing_true_for_different_cache_root() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _tempdir) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        // Simulate a checkout recorded under a different XDG_CACHE_HOME.
+        let other_root_path = PathBuf::from("/some/other/root/remote/owner/myenv/.flox");
+        let env = UninitializedEnvironment::DotFlox(DotFlox {
+            path: other_root_path,
+            pointer: EnvironmentPointer::Managed(pointer),
+        });
+        assert!(is_cached_remote_backing(&env));
     }
 
     /// A plain managed env at an arbitrary path is not a backing entry.
@@ -502,20 +521,20 @@ mod tests {
             path: PathBuf::from("/projects/myenv/.flox"),
             pointer: EnvironmentPointer::Managed(pointer),
         });
-        assert!(!is_cached_remote_backing(&flox, &env));
+        assert!(!is_cached_remote_backing(&env));
     }
 
     /// A 
```

---

### Incident Patch 10: `b975d4e4` (2026-09-24)
**Commit Message**: fix(envs): hide remote-env cache checkout from inactive list

Activating a RemoteEnvironment checks out a ManagedEnvironment under
~/.cache/flox/remote/<owner>/<name>/.flox and registers it in the
env-registry. That registration is load-bearing (GC branch pruning and
`flox delete -r` depend on it), but the cache entry appeared as a
second inactive entry in `flox envs`, leaking the internal cache path.

Adds `RemoteEnvironment::is_checkout_of` -- a pure path predicate --
and `is_cached_remote_backing` in envs.rs, then filters the registered
iterator in `handle_all` before computing the inactive set. Both the
human-readable and `--json` outputs now suppress the cache entry.
Detection is pointer-derived (path equals
`checkout_path(flox, pointer).join(".flox")`), not a prefix match on
the cache dir, to avoid false positives.

TDD: RED-GREEN-REFACTOR
- SDK unit tests: is_checkout_of_{true,false} (3 cases)
- CLI unit tests: is_cached_remote_backing_{true,false} (3 cases)
- Integration test: activated remote env appears once under Active,
  not under Inactive (environment-remote.bats, hermetic tag)

Refs: DEV-337
Forge-Agent: implementation-worker (7beb2583)
Co-Authored-By: Claude Sonnet 

**File**: `cli/flox-rust-sdk/src/models/environment/remote_environment.rs` (modified, +59/-0)
```diff
@@ -115,6 +115,18 @@ impl RemoteEnvironment {
         Self::checkout_path(flox, pointer).join(DOT_FLOX).exists()
     }
 
+    /// True when `dot_flox_path` is the cache checkout backing `pointer`.
+    ///
+    /// `flox envs` uses this to suppress the inner managed environment that
+    /// [RemoteEnvironment::new] registers in the env-registry: that entry is
+    /// load-bearing for GC pruning and `flox delete -r`, but must not appear
+    /// as a second "inactive" entry alongside the active remote.
+    ///
+    /// Pure path computation — no filesystem I/O.
+    pub fn is_checkout_of(flox: &Flox, dot_flox_path: &Path, pointer: &ManagedPointer) -> bool {
+        Self::checkout_path(flox, pointer).join(DOT_FLOX) == *dot_flox_path
+    }
+
     /// Pull a remote environment into a flox-provided managed environment
     /// at [RemoteEnvironment::checkout_path].
     ///
@@ -776,4 +788,51 @@ mod tests {
 
         assert_eq!(history_kind, &HistoryKind::Initialize);
     }
+
+    /// The checkout's own `.flox` directory is recognised as its backing path.
+    #[test]
+    fn is_checkout_of_true_for_own_dot_flox() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        let dot_flox = RemoteEnvironment::checkout_path(&flox, &pointer).join(DOT_FLOX);
+        assert!(RemoteEnvironment::is_checkout_of(
+            &flox, &dot_flox, &pointer
+        ));
+    }
+
+    /// An unrelated path is not identified as a checkout of this pointer.
+    #[test]
+    fn is_checkout_of_false_for_unrelated_path() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+
+        let unrelated = std::path::PathBuf::from("/some/other/path/.flox");
+        assert!(!RemoteEnvironment::is_checkout_of(
+            &flox, &unrelated, &pointer
+        ));
+    }
+
+    /// The checkout path for a different pointer is not identified as this pointer's checkout.
+    #[test]
+    fn is_checkout_of_false_for_different_pointer() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _temp_dir_handle) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name_a = EnvironmentName::from_str("env-a").unwrap();
+        let name_b = EnvironmentName::from_str("env-b").unwrap();
+        let pointer_a = ManagedPointer::new(owner.clone(), name_a, &flox.floxhub);
+        let pointer_b = ManagedPointer::new(owner, name_b, &flox.floxhub);
+
+        // env-a's checkout should not match pointer_b
+        let dot_flox_a = RemoteEnvironment::checkout_path(&flox, &pointer_a).join(DOT_FLOX);
+        assert!(!RemoteEnvironment::is_checkout_of(
+            &flox,
+            &dot_flox_a,
+            &pointer_b
+        ));
+    }
 }
```

**File**: `cli/flox/src/commands/envs.rs` (modified, +78/-1)
```diff
@@ -8,6 +8,7 @@ use crossterm::style::Stylize;
 use flox_manifest::interfaces::AsLatestSchema;
 use flox_rust_sdk::flox::Flox;
 use flox_rust_sdk::models::env_registry::{EnvRegistry, garbage_collect};
+use flox_rust_sdk::models::environment::remote_environment::RemoteEnvironment;
 use flox_rust_sdk::models::environment::{DotFlox, EnvironmentPointer, ManagedPointer};
 use serde_json::json;
 use tracing::instrument;
@@ -109,6 +110,11 @@ impl Envs {
         active: ActiveEnvironments,
         registered: impl Iterator<Item = UninitializedEnvironment>,
     ) -> Result<()> {
+        // Strip cache-checkout entries that back active remote environments
+        // before computing the inactive set.  The registry entry itself is
+        // preserved — GC pruning and `flox delete -r` depend on it — only the
+        // display is filtered.
+        let registered = registered.filter(|env| !is_cached_remote_backing(flox, env));
         let inactive = get_inactive_environments(registered, active.iter())?;
 
         if self.json {
@@ -320,6 +326,29 @@ fn format_path(path: &Path) -> String {
     path.parent().unwrap_or(path).to_string_lossy().to_string()
 }
 
+/// True when `env` is the managed-environment cache checkout that backs an
+/// active remote environment.
+///
+/// Activating a [`RemoteEnvironment`] creates an inner [`ManagedEnvironment`]
+/// under `~/.cache/flox/remote/<owner>/<name>/.flox` and registers it in the
+/// env-registry.  That registration is load-bearing (GC pruning and
+/// `flox delete -r` rely on it), but the cache entry must not appear as a
+/// second inactive entry in `flox envs` alongside the active remote.
+///
+/// Detection is pointer-derived: the path must equal
+/// `RemoteEnvironment::checkout_path(flox, pointer).join(".flox")`, not just
+/// a prefix match on the cache dir.
+fn is_cached_remote_backing(flox: &Flox, env: &UninitializedEnvironment) -> bool {
+    let UninitializedEnvironment::DotFlox(DotFlox {
+        path,
+        pointer: EnvironmentPointer::Managed(mp),
+    }) = env
+    else {
+        return false;
+    };
+    RemoteEnvironment::is_checkout_of(flox, path, mp)
+}
+
 fn get_registered_environments(
     registry: &EnvRegistry,
 ) -> impl Iterator<Item = UninitializedEnvironment> + '_ {
@@ -356,7 +385,9 @@ mod tests {
 
     use flox_core::data::environment_ref::{EnvironmentName, EnvironmentOwner};
     use flox_core::floxhub::Floxhub;
-    use flox_rust_sdk::models::environment::PathPointer;
+    use flox_rust_sdk::flox::test_helpers::flox_instance_with_optional_floxhub;
+    use flox_rust_sdk::models::environment::remote_environment::RemoteEnvironment;
+    use flox_rust_sdk::models::environment::{DOT_FLOX, PathPointer};
     use indoc::formatdoc;
     use pretty_assertions::assert_eq;
 
@@ -441,4 +472,50 @@ mod tests {
             name_path  /envs/path
         "});
     }
+
+    /// A `DotFlox::Managed` whose path matches the remote-environment cache
+    /// checkout is identified as a backing entry.
+    #[test]
+    fn is_cached_remote_backing_true_for_cache_checkout() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _tempdir) = flox_instance_with_optional_floxhub(Some(&owner));
+        let name = EnvironmentName::from_str("myenv").unwrap();
+        let pointer = ManagedPointer::new(owner, name, &flox.floxhub);
+        let checkout_dot_flox = RemoteEnvironment::checkout_path(&flox, &pointer).join(DOT_FLOX);
+
+        let env = UninitializedEnvironment::DotFlox(DotFlox {
+            path: checkout_dot_flox,
+            pointer: EnvironmentPointer::Managed(pointer),
+        });
+        assert!(is_cached_remote_backing(&flox, &env));
+    }
+
+    /// A plain managed env at an arbitrary path is not a backing entry.
+    #[test]
+    fn is_cached_remote_backing_false_for_arbitrary_managed_path() {
+        let owner = EnvironmentOwner::from_str("owner").unwrap();
+        let (flox, _tempdir) = flox_instance_with_optiona
```

**File**: `cli/tests/environment-remote.bats` (modified, +25/-0)
```diff
@@ -499,3 +499,28 @@ EOF
   ensure_remote_environment_built "$OWNER/test"
   _FLOX_TESTING_NO_WRITABLE=true "$FLOX_BIN" activate --trust -r "$OWNER/test" -- true
 }
+
+# bats test_tags=hermetic,remote,remote:envs
+# Regression test for DEV-337: activating a remote environment must not cause
+# the backing cache checkout to appear as an inactive managed environment in
+# `flox envs` output.
+@test "activated remote env appears once under Active, not under Inactive" {
+  make_empty_remote_env
+
+  export FLOX_CACHE_DIR="$(realpath $FLOX_CACHE_DIR)"
+
+  # Capture `flox envs` output from inside the activated remote environment.
+  # The `-c` command is executed with _FLOX_ACTIVE_ENVIRONMENTS set, so
+  # `flox envs` sees the remote as active.
+  run "$FLOX_BIN" activate --trust --reference "$OWNER/test" \
+    -c "$FLOX_BIN envs"
+  assert_success
+
+  # The remote must appear in the Active section.
+  assert_output --partial "Active environments:"
+  assert_output --partial "$OWNER/test"
+
+  # The cache checkout path must not appear anywhere — it must not leak into
+  # the Inactive section as a second entry for the same environment.
+  refute_output --partial "$FLOX_CACHE_DIR/remote/$OWNER/test"
+}
```

#### Recent Merged Pull Requests:
- **PR #4742** (2026-09-29): fix(buildenv): match runtime-packages by install_id, not attr_path/pkg-path (@stephenyeargin)
- **PR #4732** (2026-09-29): feat(manifest): per-environment upgrade notifications opt-out (@djsauble)
- **PR #4731** (2026-09-25): fix(envs): hide remote-env cache checkout from inactive list (@stephenyeargin)
- **PR #4729** (closed): build: Update FloxHub API schemas to bb4a0564 (@floxbot)
- **PR #4728** (closed): build: Update FloxHub API schemas to fad7a8a2 (@floxbot)
- **PR #4727** (2026-09-24): build(nix): drop deprecated nixpkgs aliases in the dev shell (@ysndr)
- **PR #4726** (2026-09-30): build(treefmt): format lock-scanner fixtures, exclude the unparseable two (@ysndr)
- **PR #4725** (2026-09-24): feat(telemetry): DEV-341 flush via detached child, unblock hook-env prompt (@stephenyeargin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
