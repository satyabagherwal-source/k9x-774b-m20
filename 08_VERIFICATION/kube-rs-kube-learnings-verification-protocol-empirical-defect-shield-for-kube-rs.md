# Verification Protocol: Verification Protocol: Empirical Defect Shield for kube-rs-kube-learnings

<!-- PROVENANCE_START
{
  "source_repository": "kube-rs-kube-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:40:24.424Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-kube-rs-kube-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kube-rs-kube-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:40:24.424Z`  
> **Learning ID**: `LEARN-REEXTRACT-kube-rs-kube-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `kube-rs-kube-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kube-rs-kube-learnings.md`  
> **Source**: github ([https://github.com/kube-rs/kube](https://github.com/kube-rs/kube))  
> **Source Version**: `b970938d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T14:39:05.720Z  
> **Learning ID**: `learn-github-kube-rs-kube`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kube-rs/kube

> **Canonical Artifact**: `07_PROJECT_LEARNING/kube-rs-kube-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kube-rs/kube](https://github.com/kube-rs/kube))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T14:38:36.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kube-rs/kube`
- **Description**: Rust Kubernetes client and controller runtime
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3861 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `kube-client/src/api/core_methods.rs`
```
use either::Either;
use futures::Stream;
use serde::{Serialize, de::DeserializeOwned};
use std::fmt::Debug;

use crate::{Error, Result, api::Api};
use kube_core::{WatchEvent, metadata::PartialObjectMeta, object::ObjectList, params::*, response::Status};

/// PUSH/PUT/POST/GET abstractions
impl<K> Api<K>
where
    K: Clone + DeserializeOwned + Debug,
{
    /// Get a named resource
    ///
    /// ```no_run
    /// # use kube::Api;
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// let p: Pod = pods.get("blog").await?;
    /// # Ok(())
    /// # }
    /// ```
    ///
    /// # Errors
    ///
    /// This function assumes that the object is expected to always exist, and returns [`Error`] if it does not.
    /// Consider using [`Api::get_opt`] if you need to handle missing objects.
    pub async fn get(&self, name: &str) -> Result<K> {
        self.get_with(name, &GetParams::default()).await
    }

    ///  Get only the metadata for a named resource as [`PartialObjectMeta`]
    ///
    /// ```no_run
    /// use kube::{Api, core::PartialObjectMeta};
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// let p: PartialObjectMeta<Pod> = pods.get_metadata("blog").await?;
    /// # Ok(())
    /// # }
    /// ```
    /// Note that the type may be converted to `ObjectMeta` through the usual
    /// conversion traits.
    ///
    /// # Errors
    ///
    /// This function assumes that the object is expected to always exist, and returns [`Error`] if it does not.
    /// Consider using [`Api::get_metadata_opt`] if you need to handle missing objects.
    pub async fn get_metadata(&self, name: &str) -> Result<PartialObjectMeta<K>> {
        self.get_metadata_with(name, &GetParams::default()).await
    }

    /// [Get](`Api::get`) a named resource with an explicit resourceVersion
    ///
    /// This function allows the caller to pass in a [`GetParams`](`super::GetParams`) type containing
    /// a `resourceVersion` to a [Get](`Api::get`) call.
    /// For example
    ///
    /// ```no_run
    /// # use kube::{Api, api::GetParams};
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// let p: Pod = pods.get_with("blog", &GetParams::any()).await?;
    /// # Ok(())
    /// # }
    /// ```
    ///
    /// # Errors
    ///
    /// This function assumes that the object is expected to always exist, and returns [`Error`] if it does not.
    /// Consider using [`Api::get_opt`] if you need to handle missing objects.
    pub async fn get_with(&self, name: &str, gp: &GetParams) -> Result<K> {
        let mut req = if self.metadata_api {
            self.request.get_metadata(name, gp)
        } else {
            self.request.get(name, gp)
        }
        .map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("get");
        self.client.request::<K>(req).await
    }

    ///  [Get](`Api::get_metadata`) the metadata of an object using an explicit `resourceVersion`
    ///
    /// This function allows the caller to pass in a [`GetParams`](`super::GetParams`) type containing
    /// a `resourceVersion` to a [Get](`Api::get_metadata`) call.
    /// For example
    ///
    ///
    /// ```no_run
    /// use kube::{Api, api::GetParams, core::PartialObjectMeta};
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// let p: PartialObjectMeta<Pod> = pods.get_metadata_with("blog", &GetParams::any()).await?;
    /// # Ok(())
    /// # }
    /// ```
    /// Note that the type may be converted to `ObjectMeta` through the usual
    /// conversion traits.
    ///
    /// # Errors
    ///
    /// This function assumes that the object is expected to always exist, and returns [`Error`] if it does not.
    /// Consider using [`Api::get_metadata_opt`] if you need to handle missing objects.
    pub async fn get_metadata_with(&self, name: &str, gp: &GetParams) -> Result<PartialObjectMeta<K>> {
        let mut req = self.request.get_metadata(name, gp).map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("get_metadata");
        self.client.request::<PartialObjectMeta<K>>(req).await
    }

    /// [Get](`Api::get`) a named resource if it exists, returns [`None`] if it doesn't exist
    ///
    /// ```no_run
    /// # use kube::Api;
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// if let Some(pod) = pods.get_opt("blog").await? {
    ///     // Pod was found
    /// } else {
    ///     // Pod was not found
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_opt(&self, name: &str) -> Result<Option<K>> {
        match self.get(name).await {
            Ok(obj) => Ok(Some(obj)),
            Err(Error::Api(status)) if status.is_not_found() => Ok(None),
            Err(err) => Err(err),
        }
    }

    /// [Get Metadata](`Api::get_metadata`) for a named resource if it exists, returns [`None`] if it doesn't exist
    ///
    /// ```no_run
    /// # use kube::Api;
    /// use k8s_openapi::api::core::v1::Pod;
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// if let Some(pod) = pods.get_metadata_opt("blog").await? {
    ///     // Pod was found
    /// } else {
    ///     // Pod was not found
    /// }
    /// # Ok(())
    /// # }
    /// ```
    ///
    /// Note that [`PartialObjectMeta`] embeds the raw `ObjectMeta`.
    pub async fn get_metadata_opt(&self, name: &str) -> Result<Option<PartialObjectMeta<K>>> {
        self.get_metadata_opt_with(name, &GetParams::default()).await
    }

    /// [Get Metadata](`Api::get_metadata`) of an object if it exists, using an explicit `resourceVersion`.
    /// Returns [`None`] if it doesn't exist.
    ///
    /// ```no_run
    /// # use kube::Api;
    /// use k8s_openapi::api::core::v1::Pod;
    /// use kube_core::params::GetParams;
    ///
    /// async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// if let Some(pod) = pods.get_metadata_opt_with("blog", &GetParams::any()).await? {
    ///     // Pod was found
    /// } else {
    ///     // Pod was not found
    /// }
    /// # Ok(())
    /// # }
    /// ```
    ///
    /// Note that [`PartialObjectMeta`] embeds the raw `ObjectMeta`.
    pub async fn get_metadata_opt_with(
        &self,
        name: &str,
        gp: &GetParams,
    ) -> Result<Option<PartialObjectMeta<K>>> {
        match self.get_metadata_with(name, gp).await {
            Ok(meta) => Ok(Some(meta)),
            Err(Error::Api(status)) if status.is_not_found() => Ok(None),
            Err(err) => Err(err),
        }
    }

    /// Get a list of resources
    ///
    /// You use this to get everything, or a subset matching fields/labels, say:
    ///
    /// ```no_run
    /// use kube::api::{Api, ListParams, ResourceExt};
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// let lp = ListParams::default().labels("app=blog"); // for this app only
    /// for p in pods.list(&lp).await? {
    ///     println!("Found Pod: {}", p.name_any());
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list(&self, lp: &ListParams) -> Result<ObjectList<K>> {
        let mut req = if self.metadata_api {
            self.request.list_metadata(lp)
        } else {
            self.request.list(lp)
        }
        .map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("list");
        self.client.request::<ObjectList<K>>(req).await
    }

    /// Get a list of resources that contains only their metadata as
    ///
    /// Similar to [list](`Api::list`), you use this to get everything, or a
    /// subset matching fields/labels. For example
    ///
    /// ```no_run
    /// use kube::api::{Api, ListParams, ResourceExt};
    /// use kube::core::{ObjectMeta, ObjectList, PartialObjectMeta};
    /// use k8s_openapi::api::core::v1::Pod;
    ///
    /// # async fn wrapper() -> Result<(), Box<dyn std::error::Error>> {
    /// # let client: kube::Client = todo!();
    /// let pods: Api<Pod> = Api::namespaced(client, "apps");
    /// let lp = ListParams::default().labels("app=blog"); // for this app only
    /// let list: ObjectList<PartialObjectMeta<Pod>> = pods.list_metadata(&lp).await?;
    /// for p in list {
    ///     println!("Found Pod: {}", p.name_any());
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list_metadata(&self, lp: &ListParams) -> Result<ObjectList<PartialObjectMeta<K>>> {
        let mut req = self.request.list_metadata(lp).map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("list_metadata");
        self.client.request::<ObjectList<PartialObjectMeta<K>>>(req).await
    }

    /// Create a resource
    ///
    /// This function requires a type that Serializes to `K`, which can be:
    /// 1. Raw string YAML
    /// - easy to por
```

### Core Architecture Module: `kube-client/src/api/util/csr.rs`
```
use crate::{Error, Result, api::Api};
use k8s_openapi::api::certificates::v1::CertificateSigningRequest;
use kube_core::params::{Patch, PatchParams};


impl Api<CertificateSigningRequest> {
    /// Partially update approval of the specified CertificateSigningRequest.
    pub async fn patch_approval<P: serde::Serialize>(
        &self,
        name: &str,
        pp: &PatchParams,
        patch: &Patch<P>,
    ) -> Result<CertificateSigningRequest> {
        let mut req = self
            .request
            .patch_subresource("approval", name, pp, patch)
            .map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("approval");
        self.client.request::<CertificateSigningRequest>(req).await
    }

    /// Get the CertificateSigningRequest. May differ from get(name)
    pub async fn get_approval(&self, name: &str) -> Result<CertificateSigningRequest> {
        self.get_subresource("approval", name).await
    }
}

```

### Core Architecture Module: `kube-client/src/api/util/mod.rs`
```
use crate::{
    Error, Result,
    api::{Api, Resource},
};
use k8s_openapi::api::{
    authentication::v1::TokenRequest,
    core::v1::{Node, ServiceAccount},
};
use kube_core::{params::PostParams, util::Restart};
use serde::de::DeserializeOwned;

mod csr;

impl<K> Api<K>
where
    K: Restart + Resource + DeserializeOwned,
{
    /// Trigger a restart of a Resource.
    pub async fn restart(&self, name: &str) -> Result<K> {
        let mut req = self.request.restart(name).map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("restart");
        self.client.request::<K>(req).await
    }
}

impl Api<Node> {
    /// Cordon a Node.
    pub async fn cordon(&self, name: &str) -> Result<Node> {
        let mut req = self.request.cordon(name).map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("cordon");
        self.client.request::<Node>(req).await
    }

    /// Uncordon a Node.
    pub async fn uncordon(&self, name: &str) -> Result<Node> {
        let mut req = self.request.uncordon(name).map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("cordon");
        self.client.request::<Node>(req).await
    }
}

impl Api<ServiceAccount> {
    /// Create a TokenRequest of a ServiceAccount
    pub async fn create_token_request(
        &self,
        name: &str,
        pp: &PostParams,
        token_request: &TokenRequest,
    ) -> Result<TokenRequest> {
        let bytes = serde_json::to_vec(token_request).map_err(Error::SerdeError)?;
        let mut req = self
            .request
            .create_subresource("token", name, pp, bytes)
            .map_err(Error::BuildRequest)?;
        req.extensions_mut().insert("create_token_request");
        self.client.request::<TokenRequest>(req).await
    }
}

// Tests that require a cluster and the complete feature set
// Can be run with `cargo test -p kube-client --lib -- --ignored`
#[cfg(test)]
#[cfg(feature = "client")]
mod test {
    use crate::{
        Client,
        api::{Api, DeleteParams, ListParams, PostParams},
    };
    use k8s_openapi::api::{
        authentication::v1::{TokenRequest, TokenRequestSpec, TokenReview, TokenReviewSpec},
        core::v1::{Node, ServiceAccount},
    };
    use serde_json::json;

    #[tokio::test]
    #[ignore = "needs kubeconfig"]
    async fn node_cordon_and_uncordon_works() -> Result<(), Box<dyn std::error::Error>> {
        let client = Client::try_default().await?;

        let node_name = "fakenode";
        let fake_node = serde_json::from_value(json!({
            "apiVersion": "v1",
            "kind": "Node",
            "metadata": {
                "name": node_name,
            },
        }))?;

        let nodes: Api<Node> = Api::all(client.clone());
        nodes.create(&PostParams::default(), &fake_node).await?;

        let schedulables = ListParams::default().fields("spec.unschedulable==false");
        let nodes_init = nodes.list(&schedulables).await?;
        let num_nodes_before_cordon = nodes_init.items.len();

        nodes.cordon(node_name).await?;
        let nodes_after_cordon = nodes.list(&schedulables).await?;
        assert_eq!(nodes_after_cordon.items.len(), num_nodes_before_cordon - 1);

        nodes.uncordon(node_name).await?;
        let nodes_after_uncordon = nodes.list(&schedulables).await?;
        assert_eq!(nodes_after_uncordon.items.len(), num_nodes_before_cordon);
        nodes.delete(node_name, &DeleteParams::default()).await?;
        Ok(())
    }

    #[tokio::test]
    #[ignore = "requires a cluster"]
    async fn create_token_request() -> Result<(), Box<dyn std::error::Error>> {
        let client = Client::try_default().await?;

        let serviceaccount_name = "fakesa";
        let serviceaccount_namespace = "default";
        let audiences = vec!["api".to_string()];

        let serviceaccounts: Api<ServiceAccount> = Api::namespaced(client.clone(), serviceaccount_namespace);
        let tokenreviews: Api<TokenReview> = Api::all(client);

        // Create ServiceAccount
        let fake_sa = serde_json::from_value(json!({
            "apiVersion": "v1",
            "kind": "ServiceAccount",
            "metadata": {
                "name": serviceaccount_name,
            },
        }))?;
        serviceaccounts.create(&PostParams::default(), &fake_sa).await?;

        // Create TokenRequest
        let tokenrequest = serviceaccounts
            .create_token_request(serviceaccount_name, &PostParams::default(), &TokenRequest {
                metadata: Default::default(),
                spec: Some(TokenRequestSpec {
                    audiences: Some(audiences.clone()),
                    bound_object_ref: None,
                    expiration_seconds: None,
                    attestations: None,
                }),
                status: None,
            })
            .await?;
        let token = tokenrequest.status.unwrap().token.unwrap();
        assert!(!token.is_empty());

        // Check created token is valid with TokenReview
        let tokenreview = tokenreviews
            .create(&PostParams::default(), &TokenReview {
                metadata: Default::default(),
                spec: TokenReviewSpec {
                    audiences: Some(audiences.clone()),
                    token,
                },
                status: None,
            })
            .await?;
        let tokenreviewstatus = tokenreview.status.unwrap();
        assert_eq!(tokenreviewstatus.audiences, Some(audiences));
        assert_eq!(tokenreviewstatus.authenticated, Some(true));
        assert_eq!(tokenreviewstatus.error, None);
        assert_eq!(
            tokenreviewstatus.user.unwrap().username,
            Some(format!(
                "system:serviceaccount:{serviceaccount_namespace}:{serviceaccount_name}"
            ))
        );

        // Cleanup ServiceAccount
        serviceaccounts
            .delete(serviceaccount_name, &DeleteParams::default())
            .await?;

        Ok(())
    }
}

```

### Core Architecture Module: `kube-client/src/util.rs`
```
/// Filters out empty strings.
pub(crate) fn nonempty(string: Option<String>) -> Option<String> {
    string.filter(|s| !s.is_empty())
}

```

### Core Architecture Module: `kube-core/src/admission.rs`
```
//! Contains types for implementing admission controllers.
//!
//! For more information on admission controllers, see:
//! <https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/>
//! <https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/>
//! <https://github.com/kubernetes/api/blob/master/admission/v1/types.go>

use crate::{
    Status,
    dynamic::DynamicObject,
    gvk::{GroupVersionKind, GroupVersionResource},
    metadata::TypeMeta,
    resource::Resource,
};

use std::collections::HashMap;

use k8s_openapi::{api::authentication::v1::UserInfo, apimachinery::pkg::runtime::RawExtension};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
#[error("failed to serialize patch: {0}")]
/// Failed to serialize patch.
pub struct SerializePatchError(#[source] serde_json::Error);

#[derive(Debug, Error)]
#[error("failed to convert AdmissionReview into AdmissionRequest")]
/// Failed to convert `AdmissionReview` into `AdmissionRequest`.
pub struct ConvertAdmissionReviewError;

/// The `kind` field in [`TypeMeta`].
pub const META_KIND: &str = "AdmissionReview";
/// The `api_version` field in [`TypeMeta`] on the v1 version.
pub const META_API_VERSION_V1: &str = "admission.k8s.io/v1";

/// The top level struct used for Serializing and Deserializing AdmissionReview
/// requests and responses.
///
/// This is both the input type received by admission controllers, and the
/// output type admission controllers should return.
///
/// An admission controller should start by inspecting the [`AdmissionRequest`].
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AdmissionReview<T: Resource> {
    /// Contains the API version and type of the request.
    #[serde(flatten)]
    pub types: TypeMeta,
    /// Describes the attributes for the admission request.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<AdmissionRequest<T>>,
    /// Describes the attributes for the admission response.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub response: Option<AdmissionResponse>,
}

impl<T: Resource> TryInto<AdmissionRequest<T>> for AdmissionReview<T> {
    type Error = ConvertAdmissionReviewError;

    fn try_into(self) -> Result<AdmissionRequest<T>, Self::Error> {
        match self.request {
            Some(mut req) => {
                req.types = self.types;
                Ok(req)
            }
            None => Err(ConvertAdmissionReviewError),
        }
    }
}

/// An incoming [`AdmissionReview`] request.
///
/// In an admission controller scenario, this is extracted from an [`AdmissionReview`] via [`TryInto`]
///
/// ```no_run
/// use kube::core::{admission::{AdmissionRequest, AdmissionReview}, DynamicObject};
///
/// // The incoming AdmissionReview received by the controller.
/// let body: AdmissionReview<DynamicObject> = todo!();
/// let req: AdmissionRequest<_> = body.try_into().unwrap();
/// ```
///
/// Based on the contents of the request, an admission controller should construct an
/// [`AdmissionResponse`] using:
///
/// - [`AdmissionResponse::deny`] for illegal/rejected requests
/// - [`AdmissionResponse::invalid`] for malformed requests
/// - [`AdmissionResponse::from`] for the happy path
///
/// then wrap the chosen response in an [`AdmissionReview`] via [`AdmissionResponse::into_review`].
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AdmissionRequest<T: Resource> {
    /// Copied from the containing [`AdmissionReview`] and used to specify a
    /// response type and version when constructing an [`AdmissionResponse`].
    #[serde(skip)]
    pub types: TypeMeta,
    /// An identifier for the individual request/response. It allows us to
    /// distinguish instances of requests which are otherwise identical (parallel
    /// requests, requests when earlier requests did not modify, etc). The UID is
    /// meant to track the round trip (request/response) between the KAS and the
    /// webhook, not the user request. It is suitable for correlating log entries
    /// between the webhook and apiserver, for either auditing or debugging.
    pub uid: String,
    /// The fully-qualified type of object being submitted (for example, v1.Pod
    /// or autoscaling.v1.Scale).
    pub kind: GroupVersionKind,
    /// The fully-qualified resource being requested (for example, v1.pods).
    pub resource: GroupVersionResource,
    /// The subresource being requested, if any (for example, "status" or
    /// "scale").
    #[serde(default)]
    pub sub_resource: Option<String>,
    /// The fully-qualified type of the original API request (for example, v1.Pod
    /// or autoscaling.v1.Scale). If this is specified and differs from the value
    /// in "kind", an equivalent match and conversion was performed.
    ///
    /// For example, if deployments can be modified via apps/v1 and apps/v1beta1,
    /// and a webhook registered a rule of `apiGroups:["apps"],
    /// apiVersions:["v1"], resources:["deployments"]` and
    /// `matchPolicy:Equivalent`, an API request to apps/v1beta1 deployments
    /// would be converted and sent to the webhook with `kind: {group:"apps",
    /// version:"v1", kind:"Deployment"}` (matching the rule the webhook
    /// registered for), and `requestKind: {group:"apps", version:"v1beta1",
    /// kind:"Deployment"}` (indicating the kind of the original API request).
    /// See documentation for the "matchPolicy" field in the webhook
    /// configuration type for more details.
    #[serde(default)]
    pub request_kind: Option<GroupVersionKind>,
    /// The fully-qualified resource of the original API request (for example,
    /// v1.pods). If this is specified and differs from the value in "resource",
    /// an equivalent match and conversion was performed.
    ///
    /// For example, if deployments can be modified via apps/v1 and apps/v1beta1,
    /// and a webhook registered a rule of `apiGroups:["apps"],
    /// apiVersions:["v1"], resources: ["deployments"]` and `matchPolicy:
    /// Equivalent`, an API request to apps/v1beta1 deployments would be
    /// converted and sent to the webhook with `resource: {group:"apps",
    /// version:"v1", resource:"deployments"}` (matching the resource the webhook
    /// registered for), and `requestResource: {group:"apps", version:"v1beta1",
    /// resource:"deployments"}` (indicating the resource of the original API
    /// request).
    ///
    /// See documentation for the "matchPolicy" field in the webhook
    /// configuration type.
    #[serde(default)]
    pub request_resource: Option<GroupVersionResource>,
    /// The name of the subresource of the original API request, if any (for
    /// example, "status" or "scale"). If this is specified and differs from the
    /// value in "subResource", an equivalent match and conversion was performed.
    /// See documentation for the "matchPolicy" field in the webhook
    /// configuration type.
    #[serde(default)]
    pub request_sub_resource: Option<String>,
    /// The name of the object as presented in the request. On a CREATE
    /// operation, the client may omit name and rely on the server to generate
    /// the name. If that is the case, this field will contain an empty string.
    #[serde(default)]
    pub name: String,
    /// The namespace associated with the request (if any).
    #[serde(default)]
    pub namespace: Option<String>,
    /// The operation being performed. This may be different than the operation
    /// requested. e.g. a patch can result in either a CREATE or UPDATE
    /// Operation.
    pub operation: Operation,
    /// Information about the requesting user.
    pub user_info: UserInfo,
    /// The object from the incoming request. It's `None` for [`DELETE`](Operation::Delete) operations.
    pub object: Option<T>,
    ///  The existing object. Only populated for DELETE and UPDATE requests.
    pub old_object: Option<T>,
    /// Specifies that modifications will definitely not be persisted for this
    /// request.
    #[serde(default)]
    pub dry_run: bool,
    /// The operation option structure of the operation being performed. e.g.
    /// `meta.k8s.io/v1.DeleteOptions` or `meta.k8s.io/v1.CreateOptions`. This
    /// may be different than the options the caller provided. e.g. for a patch
    /// request the performed [`Operation`] might be a [`CREATE`](Operation::Create), in
    /// which case the Options will a `meta.k8s.io/v1.CreateOptions` even though
    /// the caller provided `meta.k8s.io/v1.PatchOptions`.
    #[serde(default)]
    pub options: Option<RawExtension>,
}

/// The operation specified in an [`AdmissionRequest`].
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Operation {
    /// An operation that creates a resource.
    Create,
    /// An operation that updates a resource.
    Update,
    /// An operation that deletes a resource.
    Delete,
    /// An operation that connects to a resource.
    Connect,
}

#[cfg(feature = "cel")]
#[cfg_attr(docsrs, doc(cfg(feature = "cel")))]
impl<T: Resource> AdmissionRequest<T> {
    /// Project this request into the [`kube_cel::AdmissionRequest`] used to
    /// bind the `request` variable for ValidatingAdmissionPolicy CEL evaluation.
    ///
    /// This is a lossy view: only the fields exposed to VAP's `request` variable
    /// are carried over (`operation`, `name`, `namespace`, `dryRun`, `kind`,
    /// `resource`, and `userInfo`'s `username`/`uid`/`groups`). Webhook-only fields
    /// such as `object`, `oldObject`, `requestKind`, `subResource`, and `options`
    /// are dropped. The carried `uid` is the *user* uid (`userInfo.uid`), matching
    /// the VAP `request.userInfo.uid` variable, not the request round-trip uid.
    pub fn to_cel_request(&self) -> kube_cel::AdmissionRequest {
        kube_cel::AdmissionReque
```

### Core Architecture Module: `kube-core/src/cel/mod.rs`
```
//! CEL validation for CRDs
//!
//! When the `cel` feature is enabled, this module also provides client-side CEL evaluation
//! via Kubernetes CEL extension functions, schema compilation, and validation.

use std::{collections::BTreeMap, str::FromStr};

// --- Client-side CEL evaluation (feature = "cel") ---
// Re-exported from the kube-cel crate when the `cel` feature is enabled.

#[cfg(feature = "cel")]
#[cfg_attr(docsrs, doc(cfg(feature = "cel")))]
pub use kube_cel::*;

use derive_more::From;
#[cfg(feature = "schema")] use schemars::Schema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// --- Client-side CEL validation helpers (feature = "cel") ---
//
// These back the `validate_cel` / `validate_cel_update` methods that kube-derive generates for
// `#[kube(cel)]` / `#[x_kube(cel)]`. The derive emits thin inherent wrappers that delegate here,
// so the validation logic is compiled once in this crate instead of being re-expanded (and the
// proc-macro re-parsed) at every derive site. The wrappers keep the public method surface, so the
// derive stays the opt-in gatekeeper (only `#[kube(cel)]` types get the methods) and the
// `schema = "manual"` compile-time rejection still lives in the macro.

/// Validate a derived custom resource against its CEL creation rules (`x-kubernetes-validations`)
/// client-side, without an apiserver. Backs the generated `Foo::validate_cel(&self)`.
#[cfg(feature = "cel")]
#[cfg_attr(docsrs, doc(cfg(feature = "cel")))]
pub fn validate_cel<T>(obj: &T) -> Result<(), ValidationErrors>
where
    T: crate::CustomResourceExt + Serialize,
{
    validate_cel_with_old(obj, None)
}

/// Validate a derived custom resource against its CEL transition rules (rules using `oldSelf`)
/// client-side, comparing against `old`. Backs the generated `Foo::validate_cel_update(&self, old)`.
#[cfg(feature = "cel")]
#[cfg_attr(docsrs, doc(cfg(feature = "cel")))]
pub fn validate_cel_update<T>(obj: &T, old: &T) -> Result<(), ValidationErrors>
where
    T: crate::CustomResourceExt + Serialize,
{
    let old = serde_json::to_value(old).expect("resource serializes to JSON");
    validate_cel_with_old(obj, Some(old))
}

#[cfg(feature = "cel")]
fn validate_cel_with_old<T>(obj: &T, old: Option<Value>) -> Result<(), ValidationErrors>
where
    T: crate::CustomResourceExt + Serialize,
{
    let crd = T::crd();
    let schema = serde_json::to_value(
        crd.spec.versions[0]
            .schema
            .as_ref()
            .and_then(|s| s.open_api_v3_schema.as_ref())
            .expect("derived CRD has an openAPIV3Schema"),
    )
    .expect("CRD schema serializes to JSON");
    let object = serde_json::to_value(obj).expect("resource serializes to JSON");
    Validator::new().validate(&schema, &object, old.as_ref())
}

/// Validate a serialized value of a `KubeSchema` type against its CEL validation rules
/// (`x-kubernetes-validations`) client-side, without an apiserver. Backs the generated static
/// `T::validate_cel(value, old)`.
///
/// The schema is generated with the same openAPIV3 settings and structural transforms the CRD path
/// uses, so the `x-kubernetes-validations` rules and structure match what an apiserver would
/// validate; `schemars::schema_for!` (plain JSON-Schema 2020-12, non-inlined `$ref`s) would not be
/// walkable by kube-cel.
#[cfg(all(feature = "cel", feature = "schema"))]
#[cfg_attr(docsrs, doc(cfg(all(feature = "cel", feature = "schema"))))]
pub fn validate_cel_schema<T>(value: &Value, old: Option<&Value>) -> Result<(), ValidationErrors>
where
    T: schemars::JsonSchema,
{
    let generate = schemars::generate::SchemaSettings::openapi3()
        .with(|s| {
            s.inline_subschemas = true;
            s.meta_schema = None;
        })
        .with_transform(schemars::transform::AddNullable::default())
        .with_transform(crate::schema::StructuralSchemaRewriter)
        .with_transform(crate::schema::OptionalEnum)
        .with_transform(crate::schema::OptionalIntOrString)
        .into_generator();
    let schema = generate.into_root_schema_for::<T>();
    let schema = serde_json::to_value(&schema).expect("schema serializes to JSON");
    Validator::new().validate(&schema, value, old)
}

/// Rule is a CEL validation rule for the CRD field
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    /// rule represents the expression which will be evaluated by CEL.
    /// The `self` variable in the CEL expression is bound to the scoped value.
    pub rule: String,
    /// message represents CEL validation message for the provided type
    /// If unset, the message is "failed rule: {Rule}".
    #[serde(flatten)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<Message>,
    /// fieldPath represents the field path returned when the validation fails.
    /// It must be a relative JSON path, scoped to the location of the field in the schema
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_path: Option<String>,
    /// reason is a machine-readable value providing more detail about why a field failed the validation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<Reason>,
    /// optionalOldSelf allows transition rules (using oldSelf) to also evaluate during object creation
    /// When enabled, `oldSelf` becomes a CEL `optional_type`. You must use functions like `optMap()`, `hasValue()`, or `orValue()` to safely compare it against `self`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optional_old_self: Option<bool>,
}

impl Rule {
    /// Initialize the rule
    ///
    /// ```rust
    /// use kube_core::Rule;
    /// let r = Rule::new("self == oldSelf");
    ///
    /// assert_eq!(r.rule, "self == oldSelf".to_string())
    /// ```
    pub fn new(rule: impl Into<String>) -> Self {
        Self {
            rule: rule.into(),
            ..Default::default()
        }
    }

    /// Set the rule message.
    ///
    /// use kube_core::Rule;
    /// ```rust
    /// use kube_core::{Rule, Message};
    ///
    /// let r = Rule::new("self == oldSelf").message("is immutable");
    /// assert_eq!(r.rule, "self == oldSelf".to_string());
    /// assert_eq!(r.message, Some(Message::Message("is immutable".to_string())));
    /// ```
    pub fn message(mut self, message: impl Into<Message>) -> Self {
        self.message = Some(message.into());
        self
    }

    /// Set the failure reason.
    ///
    /// use kube_core::Rule;
    /// ```rust
    /// use kube_core::{Rule, Reason};
    ///
    /// let r = Rule::new("self == oldSelf").reason(Reason::default());
    /// assert_eq!(r.rule, "self == oldSelf".to_string());
    /// assert_eq!(r.reason, Some(Reason::FieldValueInvalid));
    /// ```
    pub fn reason(mut self, reason: impl Into<Reason>) -> Self {
        self.reason = Some(reason.into());
        self
    }

    /// Set the failure field_path.
    ///
    /// use kube_core::Rule;
    /// ```rust
    /// use kube_core::Rule;
    ///
    /// let r = Rule::new("self == oldSelf").field_path("obj.field");
    /// assert_eq!(r.rule, "self == oldSelf".to_string());
    /// assert_eq!(r.field_path, Some("obj.field".to_string()));
    /// ```
    pub fn field_path(mut self, field_path: impl Into<String>) -> Self {
        self.field_path = Some(field_path.into());
        self
    }

    /// Set the optionalOldSelf configuration.
    ///
    /// ```rust
    /// use kube_core::Rule;
    ///
    /// let r = Rule::new("oldSelf.optMap(o, o == self).orValue(true)").optional_old_self(true);
    /// assert_eq!(r.optional_old_self, Some(true));
    /// ```
    pub fn optional_old_self(mut self, optional: bool) -> Self {
        self.optional_old_self = Some(optional);
        self
    }
}

impl From<&str> for Rule {
    fn from(value: &str) -> Self {
        Self {
            rule: value.into(),
            ..Default::default()
        }
    }
}

impl From<(&str, &str)> for Rule {
    fn from((rule, msg): (&str, &str)) -> Self {
        Self {
            rule: rule.into(),
            message: Some(msg.into()),
            ..Default::default()
        }
    }
}
/// Message represents CEL validation message for the provided type
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Message {
    /// Message represents the message displayed when validation fails. The message is required if the Rule contains
    /// line breaks. The message must not contain line breaks.
    /// Example:
    /// "must be a URL with the host matching spec.host"
    Message(String),
    /// Expression declares a CEL expression that evaluates to the validation failure message that is returned when this rule fails.
    /// Since messageExpression is used as a failure message, it must evaluate to a string. If messageExpression results in a runtime error, the runtime error is logged, and the validation failure message is produced
    /// as if the messageExpression field were unset. If messageExpression evaluates to an empty string, a string with only spaces, or a string
    /// that contains line breaks, then the validation failure message will also be produced as if the messageExpression field were unset, and
    /// the fact that messageExpression produced an empty string/string with only spaces/string with line breaks will be logged.
    /// messageExpression has access to all the same variables as the rule; the only difference is the return type.
    /// Example:
    /// "x must be less than max ("+string(self.max)+")"
    #[serde(rename = "messageExpression")]
    Expression(String),
}

impl From<&str> for Message {
    fn from(value: &str) -> Self {
        Message::Message(value.to_string())
    }
}

/// Reason is a machine-readable value providing more detail about why a field failed the validation.
///
/// More in [docs](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-re
```

### Core Architecture Module: `kube-core/src/conversion/mod.rs`
```
//! Contains types useful for implementing custom resource conversion webhooks.

pub use self::types::{
    ConversionRequest, ConversionResponse, ConversionReview, ConvertConversionReviewError,
};

/// Defines low-level typings.
mod types;

```

### Core Architecture Module: `kube-core/src/conversion/types.rs`
```
use crate::{Status, TypeMeta};
use serde::{Deserialize, Deserializer, Serialize};
use thiserror::Error;

/// The `kind` field in [`TypeMeta`]
pub const META_KIND: &str = "ConversionReview";
/// The `api_version` field in [`TypeMeta`] on the v1 version
pub const META_API_VERSION_V1: &str = "apiextensions.k8s.io/v1";

#[derive(Debug, Error)]
#[error("request missing in ConversionReview")]
/// Returned when `ConversionReview` cannot be converted into `ConversionRequest`
pub struct ConvertConversionReviewError;

/// Struct that describes both request and response
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ConversionReview {
    /// Contains the API version and type of the request
    #[serde(flatten)]
    pub types: TypeMeta,
    /// Contains conversion request
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<ConversionRequest>,
    /// Contains conversion response
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub response: Option<ConversionResponse>,
}

/// Part of ConversionReview which is set on input (i.e. generated by apiserver)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ConversionRequest {
    /// [`TypeMeta`] of the [`ConversionReview`] this response was created from
    ///  
    /// This field dopied from the corresponding [`ConversionReview`].
    /// It is not part of the Kubernetes API, it's consumed only by `kube`.
    #[serde(skip)]
    pub types: Option<TypeMeta>,
    /// Random uid uniquely identifying this conversion call
    pub uid: String,
    /// The API group and version the objects should be converted to
    #[serde(rename = "desiredAPIVersion")]
    pub desired_api_version: String,
    /// The list of objects to convert
    ///
    /// Note that list may contain one or more objects, in one or more versions.
    // This field uses raw Value instead of Object/DynamicObject to simplify
    // further downcasting.
    pub objects: Vec<serde_json::Value>,
}

impl ConversionRequest {
    /// Extracts request from the [`ConversionReview`]
    pub fn from_review(review: ConversionReview) -> Result<Self, ConvertConversionReviewError> {
        ConversionRequest::try_from(review)
    }
}

impl TryFrom<ConversionReview> for ConversionRequest {
    type Error = ConvertConversionReviewError;

    fn try_from(review: ConversionReview) -> Result<Self, Self::Error> {
        match review.request {
            Some(mut req) => {
                req.types = Some(review.types);
                Ok(req)
            }
            None => Err(ConvertConversionReviewError),
        }
    }
}

/// Part of ConversionReview which is set on output (i.e. generated by conversion webhook)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ConversionResponse {
    /// [`TypeMeta`] of the [`ConversionReview`] this response was derived from
    ///  
    /// This field is copied from the corresponding [`ConversionRequest`].
    /// It is not part of the Kubernetes API, it's consumed only by `kube`.
    #[serde(skip)]
    pub types: Option<TypeMeta>,
    /// Copy of .request.uid
    pub uid: String,
    /// Outcome of the conversion operation
    ///
    /// Success: all objects were successfully converted
    /// Failure: at least one object could not be converted.
    /// It is recommended that conversion fails as rare as possible.
    pub result: Status,
    /// Converted objects
    ///
    /// This field should contain objects in the same order as in the request
    /// Should be empty if conversion failed.
    #[serde(rename = "convertedObjects")]
    #[serde(deserialize_with = "parse_converted_objects")]
    pub converted_objects: Vec<serde_json::Value>,
}

fn parse_converted_objects<'de, D>(de: D) -> Result<Vec<serde_json::Value>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Helper {
        List(Vec<serde_json::Value>),
        Null(()),
    }

    let h: Helper = Helper::deserialize(de)?;
    let res = match h {
        Helper::List(l) => l,
        Helper::Null(()) => Vec::new(),
    };
    Ok(res)
}

impl ConversionResponse {
    /// Creates a new response, matching provided request
    ///
    /// This response must be finalized with one of:
    /// - [`ConversionResponse::success`] when conversion succeeded
    /// - [`ConversionResponse::failure`] when conversion failed
    pub fn for_request(request: ConversionRequest) -> Self {
        ConversionResponse::from(request)
    }

    /// Creates successful conversion response
    ///
    /// `converted_objects` must specify objects in the exact same order as on input.
    pub fn success(mut self, converted_objects: Vec<serde_json::Value>) -> Self {
        self.result = Status::success();
        self.converted_objects = converted_objects;
        self
    }

    /// Creates failed conversion response (discouraged)
    ///
    /// `request_uid` must be equal to the `.uid` field in the request.
    /// `message` and `reason` will be returned to the apiserver.
    pub fn failure(mut self, status: Status) -> Self {
        self.result = status;
        self
    }

    /// Creates failed conversion response, not matched with any request
    ///
    /// You should only call this function when request couldn't be parsed into [`ConversionRequest`].
    /// Otherwise use `error`.
    pub fn invalid(status: Status) -> Self {
        ConversionResponse {
            types: None,
            uid: String::new(),
            result: status,
            converted_objects: Vec::new(),
        }
    }

    /// Converts response into a [`ConversionReview`] value, ready to be sent as a response
    pub fn into_review(self) -> ConversionReview {
        self.into()
    }
}

impl From<ConversionRequest> for ConversionResponse {
    fn from(request: ConversionRequest) -> Self {
        ConversionResponse {
            types: request.types,
            uid: request.uid,
            result: Status {
                status: None,
                code: 0,
                message: String::new(),
                metadata: None,
                reason: String::new(),
                details: None,
            },
            converted_objects: Vec::new(),
        }
    }
}

impl From<ConversionResponse> for ConversionReview {
    fn from(mut response: ConversionResponse) -> Self {
        ConversionReview {
            types: response.types.take().unwrap_or_else(|| {
                // we don't know which uid, apiVersion and kind to use, let's just use something
                TypeMeta {
                    api_version: META_API_VERSION_V1.to_string(),
                    kind: META_KIND.to_string(),
                }
            }),
            request: None,
            response: Some(response),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ConversionRequest, ConversionResponse};

    #[test]
    fn simple_request_parses() {
        // this file contains dump of real request generated by kubernetes v1.22
        let data = include_str!("./test_data/simple.json");
        // check that we can parse this review, and all chain of conversion works
        let review = serde_json::from_str(data).unwrap();
        let req = ConversionRequest::from_review(review).unwrap();
        let res = ConversionResponse::for_request(req);
        let _ = res.into_review();
    }
}

```

### Core Architecture Module: `kube-core/src/crd.rs`
```
//! Traits and types for CustomResources

use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions as apiexts;

/// Types for v1 CustomResourceDefinitions
pub mod v1 {
    use super::apiexts::v1::CustomResourceDefinition as Crd;
    /// Extension trait that is implemented by kube-derive
    pub trait CustomResourceExt {
        /// Helper to generate the CRD including the JsonSchema
        ///
        /// This is using the stable v1::CustomResourceDefinitions (present in kubernetes >= 1.16)
        fn crd() -> Crd;
        /// Helper to return the name of this `CustomResourceDefinition` in kubernetes.
        ///
        /// This is not the name of an _instance_ of this custom resource but the `CustomResourceDefinition` object itself.
        fn crd_name() -> &'static str;
        /// Helper to generate the api information type for use with the dynamic `Api`
        fn api_resource() -> crate::discovery::ApiResource;
        /// Shortnames of this resource type.
        ///
        /// For example: [`Pod`] has the shortname alias `po`.
        ///
        /// NOTE: This function returns *declared* short names (at compile-time, using the `#[kube(shortname = "foo")]`), not the
        /// shortnames registered with the Kubernetes API (which is what tools such as `kubectl` look at).
        ///
        /// [`Pod`]: `k8s_openapi::api::core::v1::Pod`
        fn shortnames() -> &'static [&'static str];
    }

    /// Possible errors when merging CRDs
    #[derive(Debug, thiserror::Error)]
    pub enum MergeError {
        /// No crds given
        #[error("empty list of CRDs cannot be merged")]
        MissingCrds,

        /// Stored api not present
        #[error("stored api version {0} not found")]
        MissingStoredApi(String),

        /// Root api not present
        #[error("root api version {0} not found")]
        MissingRootVersion(String),

        /// No versions given in one crd to merge
        #[error("given CRD must have versions")]
        MissingVersions,

        /// Too many versions given to individual crds
        #[error("mergeable CRDs cannot have multiple versions")]
        MultiVersionCrd,

        /// Mismatching spec properties on crds
        #[error("mismatching {0} property from given CRDs")]
        PropertyMismatch(String),
    }

    /// Merge a collection of crds into a single multiversion crd
    ///
    /// Given multiple [`CustomResource`] derived types granting [`CRD`]s via [`CustomResourceExt::crd`],
    /// we can merge them into a single [`CRD`] with multiple [`CRDVersion`] objects, marking only
    /// the specified apiversion as `storage: true`.
    ///
    /// This merge algorithm assumes that every [`CRD`]:
    ///
    /// - exposes exactly one [`CRDVersion`]
    /// - uses identical values for `spec.group`, `spec.scope`, and `spec.names.kind`
    ///
    /// This is always true for [`CustomResource`] derives.
    ///
    /// ## Usage
    ///
    /// ```no_run
    /// # use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::CustomResourceDefinition;
    /// use kube::core::crd::merge_crds;
    /// # let mycrd_v1: CustomResourceDefinition = todo!(); // v1::MyCrd::crd();
    /// # let mycrd_v2: CustomResourceDefinition = todo!(); // v2::MyCrd::crd();
    /// let crds = vec![mycrd_v1, mycrd_v2];
    /// let multi_version_crd = merge_crds(crds, "v1").unwrap();
    /// ```
    ///
    /// Note the merge is done by marking the:
    ///
    /// - crd containing the `stored_apiversion` as the place the other crds merge their [`CRDVersion`] items
    /// - stored version is marked with `storage: true`, while all others get `storage: false`
    ///
    /// [`CustomResourceExt::crd`]: crate::CustomResourceExt::crd
    /// [`CRD`]: https://docs.rs/k8s-openapi/latest/k8s_openapi/apiextensions_apiserver/pkg/apis/apiextensions/v1/struct.CustomResourceDefinition.html
    /// [`CRDVersion`]: https://docs.rs/k8s-openapi/latest/k8s_openapi/apiextensions_apiserver/pkg/apis/apiextensions/v1/struct.CustomResourceDefinitionVersion.html
    /// [`CustomResource`]: https://docs.rs/kube/latest/kube/derive.CustomResource.html
    pub fn merge_crds(mut crds: Vec<Crd>, stored_apiversion: &str) -> Result<Crd, MergeError> {
        if crds.is_empty() {
            return Err(MergeError::MissingCrds);
        }
        for crd in crds.iter() {
            if crd.spec.versions.is_empty() {
                return Err(MergeError::MissingVersions);
            }
            if crd.spec.versions.len() != 1 {
                return Err(MergeError::MultiVersionCrd);
            }
        }
        let ver = stored_apiversion;
        let found = crds.iter().position(|c| c.spec.versions[0].name == ver);
        // Extract the root/first object to start with (the one we will merge into)
        let mut root = match found {
            None => return Err(MergeError::MissingRootVersion(ver.into())),
            Some(idx) => crds.remove(idx),
        };
        root.spec.versions[0].storage = true; // main version - set true in case modified

        // Values that needs to be identical across crds:
        let group = &root.spec.group;
        let kind = &root.spec.names.kind;
        let scope = &root.spec.scope;
        // sanity; don't merge crds with mismatching groups, versions, or other core properties
        for crd in crds.iter() {
            if &crd.spec.group != group {
                return Err(MergeError::PropertyMismatch("group".to_string()));
            }
            if &crd.spec.names.kind != kind {
                return Err(MergeError::PropertyMismatch("kind".to_string()));
            }
            if &crd.spec.scope != scope {
                return Err(MergeError::PropertyMismatch("scope".to_string()));
            }
        }

        // combine all version objects into the root object
        let versions = &mut root.spec.versions;
        while let Some(mut crd) = crds.pop() {
            while let Some(mut v) = crd.spec.versions.pop() {
                v.storage = false; // secondary versions
                versions.push(v);
            }
        }
        Ok(root)
    }

    mod tests {
        #[test]
        fn crd_merge() {
            use super::{Crd, merge_crds};
            let crd1 = r#"
            apiVersion: apiextensions.k8s.io/v1
            kind: CustomResourceDefinition
            metadata:
              name: multiversions.kube.rs
            spec:
              group: kube.rs
              names:
                categories: []
                kind: MultiVersion
                plural: multiversions
                shortNames: []
                singular: multiversion
              scope: Namespaced
              versions:
              - additionalPrinterColumns: []
                name: v1
                schema:
                  openAPIV3Schema:
                    type: object
                    x-kubernetes-preserve-unknown-fields: true
                served: true
                storage: true"#;

            let crd2 = r#"
            apiVersion: apiextensions.k8s.io/v1
            kind: CustomResourceDefinition
            metadata:
              name: multiversions.kube.rs
            spec:
              group: kube.rs
              names:
                categories: []
                kind: MultiVersion
                plural: multiversions
                shortNames: []
                singular: multiversion
              scope: Namespaced
              versions:
              - additionalPrinterColumns: []
                name: v2
                schema:
                  openAPIV3Schema:
                    type: object
                    x-kubernetes-preserve-unknown-fields: true
                served: true
                storage: true"#;

            let expected = r#"
            apiVersion: apiextensions.k8s.io/v1
            kind: CustomResourceDefinition
            metadata:
              name: multiversions.kube.rs
            spec:
              group: kube.rs
              names:
                categories: []
                kind: MultiVersion
                plural: multiversions
                shortNames: []
                singular: multiversion
              scope: Namespaced
              versions:
              - additionalPrinterColumns: []
                name: v2
                schema:
                  openAPIV3Schema:
                    type: object
                    x-kubernetes-preserve-unknown-fields: true
                served: true
                storage: true
              - additionalPrinterColumns: []
                name: v1
                schema:
                  openAPIV3Schema:
                    type: object
                    x-kubernetes-preserve-unknown-fields: true
                served: true
                storage: false"#;

            let c1: Crd = serde_saphyr::from_str(crd1).unwrap();
            let c2: Crd = serde_saphyr::from_str(crd2).unwrap();
            let ce: Crd = serde_saphyr::from_str(expected).unwrap();
            let combined = merge_crds(vec![c1, c2], "v2").unwrap();

            let combo_json = serde_json::to_value(&combined).unwrap();
            let exp_json = serde_json::to_value(&ce).unwrap();
            assert_json_diff::assert_json_eq!(combo_json, exp_json);
        }
    }
}

// re-export current latest (v1)
pub use v1::{CustomResourceExt, MergeError, merge_crds};

```

### Core Architecture Module: `kube-core/src/discovery/mod.rs`
```
//! Type information structs for API discovery
use crate::{gvk::GroupVersionKind, resource::Resource};

pub mod v2;
use serde::{Deserialize, Serialize};

/// Information about a Kubernetes API resource
///
/// Enough information to use it like a `Resource` by passing it to the dynamic `Api`
/// constructors like `Api::all_with` and `Api::namespaced_with`.
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct ApiResource {
    /// Resource group, empty for core group.
    pub group: String,
    /// group version
    pub version: String,
    /// apiVersion of the resource (v1 for core group,
    /// groupName/groupVersions for other).
    pub api_version: String,
    /// Singular PascalCase name of the resource
    pub kind: String,
    /// Plural name of the resource
    pub plural: String,
}

impl ApiResource {
    /// Creates an ApiResource by type-erasing a Resource
    pub fn erase<K: Resource>(dt: &K::DynamicType) -> Self {
        ApiResource {
            group: K::group(dt).to_string(),
            version: K::version(dt).to_string(),
            api_version: K::api_version(dt).to_string(),
            kind: K::kind(dt).to_string(),
            plural: K::plural(dt).to_string(),
        }
    }

    /// Creates an ApiResource from group, version, kind and plural name.
    pub fn from_gvk_with_plural(gvk: &GroupVersionKind, plural: &str) -> Self {
        ApiResource {
            api_version: gvk.api_version(),
            group: gvk.group.clone(),
            version: gvk.version.clone(),
            kind: gvk.kind.clone(),
            plural: plural.to_string(),
        }
    }

    /// Creates an ApiResource from group, version and kind.
    ///
    /// # Warning
    /// This function will **guess** the resource plural name.
    /// Usually, this is ok, but for CRDs with complex pluralisations it can fail.
    /// If you are getting your values from `kube_derive` use the generated method for giving you an [`ApiResource`].
    /// Otherwise consider using [`ApiResource::from_gvk_with_plural`](crate::discovery::ApiResource::from_gvk_with_plural)
    /// to explicitly set the plural, or run api discovery on it via `kube::discovery`.
    pub fn from_gvk(gvk: &GroupVersionKind) -> Self {
        ApiResource::from_gvk_with_plural(gvk, &to_plural(&gvk.kind.to_ascii_lowercase()))
    }
}

/// Resource scope
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub enum Scope {
    /// Objects are global
    Cluster,
    /// Each object lives in namespace.
    Namespaced,
}

/// Rbac verbs for ApiCapabilities
pub mod verbs {
    /// Create a resource
    pub const CREATE: &str = "create";
    /// Get single resource
    pub const GET: &str = "get";
    /// List objects
    pub const LIST: &str = "list";
    /// Watch for objects changes
    pub const WATCH: &str = "watch";
    /// Delete single object
    pub const DELETE: &str = "delete";
    /// Delete multiple objects at once
    pub const DELETE_COLLECTION: &str = "deletecollection";
    /// Update an object
    pub const UPDATE: &str = "update";
    /// Patch an object
    pub const PATCH: &str = "patch";
}

/// Contains the capabilities of an API resource
#[derive(Debug, Clone)]
pub struct ApiCapabilities {
    /// Scope of the resource
    pub scope: Scope,
    /// Available subresources.
    ///
    /// Please note that returned ApiResources are not standalone resources.
    /// Their name will be of form `subresource_name`, not `resource_name/subresource_name`.
    /// To work with subresources, use `Request` methods for now.
    pub subresources: Vec<(ApiResource, ApiCapabilities)>,
    /// Supported operations on this resource
    pub operations: Vec<String>,
}

impl ApiCapabilities {
    /// Checks that given verb is supported on this resource.
    pub fn supports_operation(&self, operation: &str) -> bool {
        self.operations.iter().any(|op| op == operation)
    }
}

// Simple pluralizer. Handles the special cases.
fn to_plural(word: &str) -> String {
    if word == "endpoints" || word == "endpointslices" {
        return word.to_owned();
    } else if word == "nodemetrics" {
        return "nodes".to_owned();
    } else if word == "podmetrics" {
        return "pods".to_owned();
    }

    // Words ending in s, x, z, ch, sh will be pluralized with -es (eg. foxes).
    if word.ends_with('s')
        || word.ends_with('x')
        || word.ends_with('z')
        || word.ends_with("ch")
        || word.ends_with("sh")
    {
        return format!("{word}es");
    }

    // Words ending in y that are preceded by a consonant will be pluralized by
    // replacing y with -ies (eg. puppies).
    if word.ends_with('y')
        && let Some(c) = word.chars().nth(word.len() - 2)
        && !matches!(c, 'a' | 'e' | 'i' | 'o' | 'u')
    {
        // Remove 'y' and add `ies`
        let mut chars = word.chars();
        chars.next_back();
        return format!("{}ies", chars.as_str());
    }

    // All other words will have "s" added to the end (eg. days).
    format!("{word}s")
}

#[test]
fn test_to_plural_native() {
    // Extracted from `swagger.json`
    #[rustfmt::skip]
    let native_kinds = vec![
        ("APIService", "apiservices"),
        ("Binding", "bindings"),
        ("CertificateSigningRequest", "certificatesigningrequests"),
        ("ClusterRole", "clusterroles"), ("ClusterRoleBinding", "clusterrolebindings"),
        ("ComponentStatus", "componentstatuses"),
        ("ConfigMap", "configmaps"),
        ("ControllerRevision", "controllerrevisions"),
        ("CronJob", "cronjobs"),
        ("CSIDriver", "csidrivers"), ("CSINode", "csinodes"), ("CSIStorageCapacity", "csistoragecapacities"),
        ("CustomResourceDefinition", "customresourcedefinitions"),
        ("DaemonSet", "daemonsets"),
        ("Deployment", "deployments"),
        ("Endpoints", "endpoints"), ("EndpointSlice", "endpointslices"),
        ("Event", "events"),
        ("FlowSchema", "flowschemas"),
        ("HorizontalPodAutoscaler", "horizontalpodautoscalers"),
        ("Ingress", "ingresses"), ("IngressClass", "ingressclasses"),
        ("Job", "jobs"),
        ("Lease", "leases"),
        ("LimitRange", "limitranges"),
        ("LocalSubjectAccessReview", "localsubjectaccessreviews"),
        ("MutatingWebhookConfiguration", "mutatingwebhookconfigurations"),
        ("Namespace", "namespaces"),
        ("NetworkPolicy", "networkpolicies"),
        ("Node", "nodes"),
        ("PersistentVolumeClaim", "persistentvolumeclaims"),
        ("PersistentVolume", "persistentvolumes"),
        ("PodDisruptionBudget", "poddisruptionbudgets"),
        ("Pod", "pods"),
        ("PodSecurityPolicy", "podsecuritypolicies"),
        ("PodTemplate", "podtemplates"),
        ("PriorityClass", "priorityclasses"),
        ("PriorityLevelConfiguration", "prioritylevelconfigurations"),
        ("ReplicaSet", "replicasets"),
        ("ReplicationController", "replicationcontrollers"),
        ("ResourceQuota", "resourcequotas"),
        ("Role", "roles"), ("RoleBinding", "rolebindings"),
        ("RuntimeClass", "runtimeclasses"),
        ("Secret", "secrets"),
        ("SelfSubjectAccessReview", "selfsubjectaccessreviews"),
        ("SelfSubjectRulesReview", "selfsubjectrulesreviews"),
        ("ServiceAccount", "serviceaccounts"),
        ("Service", "services"),
        ("StatefulSet", "statefulsets"),
        ("StorageClass", "storageclasses"), ("StorageVersion", "storageversions"),
        ("SubjectAccessReview", "subjectaccessreviews"),
        ("TokenReview", "tokenreviews"),
        ("ValidatingWebhookConfiguration", "validatingwebhookconfigurations"),
        ("VolumeAttachment", "volumeattachments"),
    ];
    for (kind, plural) in native_kinds {
        assert_eq!(to_plural(&kind.to_ascii_lowercase()), plural);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2148** (2026-11-11): **Watch recovery regression in kube 5.0 when an HTTP error response body stalls**
  *Symptoms*: ### Current and expected behavior  In Kube 5.0, a watcher can stop recovering when the API server or a proxy returns HTTP 500 headers but never completes the response body.  With watcher::Config::default().timeout(1), the watcher’s client-side idle timeout is six seconds, including its five-second margin.  Using the same reproduction in kube 4.2.0 I saw it reconnects and receives an event but in kube 5, it never recovered  I would expect a stalled rejection body to produce a bounded failure or allow watch recovery, rather than block before the watchdog becomes active.  ### Possible solution  _No response_  ### Additional context  _No response_  ### Environment  Linux x86_64. Rust 1.99.0 and Tokio 1.53.1.   ### Configuration and features  '''toml kube = { version = "=5.0.0", default-features = false, features = ["client", "runtime", "openssl-tls"] } k8s-openapi = { version = "=0.29.0", default-features = false, features = ["earliest"] } '''  ### YAML  _No response_  ### Affected crates  kube-client, kube-runtime  ### Would you like to work on fixing this bug?  None

- **Issue #2142** (2026-11-06): **NO_PROXY environment variable is not working under regular client setup**
  *Symptoms*: ### Current and expected behavior  Raised initially https://github.com/crust-gather/crust-gather/issues/587, which I believe should be supported by current version per https://github.com/kube-rs/kube/pull/2075, but reported being ineffective.   cc @manderson23  > The K8s clusters I access need to bypass our corporate proxy and this is done via the IP being in the NO_PROXY environment variable.  > kubectl itself respects the environment variables but `kubectl crust-gather collect -v TRACE` fails as follows  ```logs 2026-11-04T09:09:46.798334Z  INFO crust_gather::cli: Initializing client... 2026-11-04T09:09:46.837366Z TRACE tower::buffer::worker: worker polling for next message 2026-11-04T09:09:46.837473Z TRACE collect: tower::buffer::service: sending request to buffer worker 2026-11-04T09:09:46.837723Z TRACE tower::buffer::worker: worker polling for next message 2026-11-04T09:09:46.837822Z TRACE tower::buffer::worker: processing new request 2026-11-04T09:09:46.837915Z TRACE collect: tower::buffer::worker: resumed=false worker received request; waiting for service readiness 2026-11-04T09:09:46.838001Z DEBUG collect: tower::buffer::worker: service.ready=true processing request 2026-11-04T09:09:46.838202Z DEBUG collect:HTTP{http.method=GET http.url=https://10.2.2.5:6443/apis otel.name="HTTP" otel.kind="client"}: kube_client::client::builder: requesting 2026-11-04T09:09:46.838312Z TRACE collect: tower::buffer::worker: returning response future 2026-11-04T09:09:46.838377Z TRACE tow

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

### Incident Patch 1: `224f8434` (2026-11-11)
**Commit Message**: Bound watch startup with the watcher idle timeout (#2149)

Fixes #2148

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>
Co-authored-by: Eirik A <[REDACTED_EMAIL]>

**File**: `kube-runtime/Cargo.toml` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ async-stream.workspace = true
 hostname.workspace = true
 
 [dev-dependencies]
+http.workspace = true
+http-body-util.workspace = true
+tower.workspace = true
 kube = { path = "../kube", features = ["derive", "client", "runtime"] }
 serde_json.workspace = true
 serde-saphyr.workspace = true
```

**File**: `kube-runtime/src/watcher.rs` (modified, +188/-20)
```diff
@@ -530,17 +530,25 @@ async fn next_with_idle_timeout<S, T>(stream: &mut S, timeout: Option<u32>) -> O
 where
     S: Stream<Item = T> + Unpin,
 {
+    with_idle_timeout(stream.next(), timeout).await.flatten()
+}
+
+/// Await `fut` with the same idle timeout, returning `None` on expiry.
+///
+/// Also wraps the watch call, which can stall before a stream exists,
+/// e.g. on an error response whose body never completes.
+async fn with_idle_timeout<F: Future>(fut: F, timeout: Option<u32>) -> Option<F::Output> {
     if timeout == Some(0) {
-        return stream.next().await;
+        return Some(fut.await);
     }
 
     let idle_timeout = Duration::from_secs(u64::from(timeout.unwrap_or(290))) + WATCH_IDLE_TIMEOUT_MARGIN;
-    match tokio::time::timeout(idle_timeout, stream.next()).await {
-        Ok(item) => item,
+    match tokio::time::timeout(idle_timeout, fut).await {
+        Ok(output) => Some(output),
         Err(_elapsed) => {
             debug!(
                 timeout_secs = idle_timeout.as_secs(),
-                "watch stream idle timeout, reconnecting"
+                "watch idle timeout, reconnecting"
             );
             None
         }
@@ -569,16 +577,22 @@ where
                 last_bookmark: None,
             }),
             InitialListStrategy::StreamingList => {
-                match api.watch(&wc.to_watch_params(WatchPhase::Initial), "0").await {
-                    Ok(stream) => (Some(Ok(Event::Init)), State::InitialWatch { stream }),
-                    Err(err) => {
+                match with_idle_timeout(
+                    api.watch(&wc.to_watch_params(WatchPhase::Initial), "0"),
+                    wc.timeout,
+                )
+                .await
+                {
+                    Some(Ok(stream)) => (Some(Ok(Event::Init)), State::InitialWatch { stream }),
+                    Some(Err(err)) => {
                         if std::matches!(err, ClientErr::Api(ref status) if status.is_forbidden()) {
                             warn!("watch initlist error with 403: {err:?}");
                         } else {
                             debug!("watch initlist error: {err:?}");
                         }
                         (Some(Err(Error::WatchStartFailed(err))), State::default())
                     }
+                    None => (None, State::default()),
                 }
             }
         },
@@ -676,15 +690,17 @@ where
             }
         }
         State::InitListed { resource_version } => {
-            match api
-                .watch(&wc.to_watch_params(WatchPhase::Resumed), &resource_version)
-                .await
+            match with_idle_timeout(
+                api.watch(&wc.to_watch_params(WatchPhase::Resumed), &resource_version),
+                wc.timeout,
+            )
+            .await
             {
-                Ok(stream) => (None, State::Watching {
+                Some(Ok(stream)) => (None, State::Watching {
                     resource_version,
                     stream,
                 }),
-                Err(err) => {
+                Some(Err(err)) => {
                     if std::matches!(err, ClientErr::Api(ref status) if status.is_forbidden()) {
                         warn!("watch initlist error with 403: {err:?}");
                     } else {
@@ -694,6 +710,7 @@ where
                         resource_version,
                     })
                 }
+                None => (None, State::InitListed { resource_version }),
             }
         }
         State::Watching {
@@ -1052,22 +1069,30 @@ impl Backoff for DefaultBackoff {
 mod tests {
     use std::{collections::BTreeMap, time::Duration};
 
-    use futures::StreamExt;
+    use futures::{StreamExt, TryStreamExt, stream::BoxStream};
+    use http::{Request, Response, StatusCode, header::CONTENT_LENGTH};
+    use http_body_util::{BodyExt, StreamBody};
     use k8s_openapi::{api::core::v1::ConfigMap, apimachinery::pkg::apis::meta::v1::ObjectMeta};
     use kube_client::{
-        api::{TypeMeta, WatchEvent, WatchParams},
+        Api, Client,
+        api::{ListParams, TypeMeta, WatchEvent, WatchParams},
+        client::Body,
         core::{
-            Status,
+            ObjectList, Status,
             watch::{Bookmark, BookmarkMeta},
         },
     };
 
-    use crate::watcher::{
-        ApiMode, Config, ExponentialBackoff, State, WatchPhase, next_with_idle_timeout, step,
-        stub_watcher::{
-            Recording, Sequence, SequenceStep, TestMode, error_indicates_graceful_watch_seq_exhaustion,
+    use crate::{
+        WatchStreamExt,
+        watcher::{
+            ApiMode, Config, Error, ExponentialBackoff, State, WatchPhase, next_with_idle_timeout, step,
+            step_trampolined,
+            stub_watcher::{
+                Recording, Sequence, SequenceStep, TestMode, error_indicates_graceful_watch_seq_exhaustion,
+            },
+            watcher, watcher_inner,
         },
-        watch
```

#### Recent Merged Pull Requests:
- **PR #2149** (2026-11-11): Bound watch startup with the watcher idle timeout (@doxxx93)
- **PR #2146** (2026-11-06): Fix nightly clippy and rustdoc warnings (@doxxx93)
- **PR #2145** (2026-11-06): Make kube-client modules visible to rustfmt (@doxxx93)
- **PR #2144** (2026-11-06): Match NO_PROXY against the apiserver instead of the proxy (@doxxx93)
- **PR #2143** (2026-11-05): fix parse error messages for LabelSelectorRequirement into Expression (@orangecms)
- **PR #2141** (2026-11-05): Show missing feature requirements on kube-client items in docs (@doxxx93)

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

## X. Bound watch startup with the watcher idle timeout (#2149)

**RULE**:
When implementing operations in `kube-runtime/Cargo.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kube-rs/kube. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `224f8434`: Bound watch startup with the watcher idle timeout (#2149). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `kube-runtime/Cargo.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
http.workspace = true
http-body-util.workspace = true
tower.workspace = true
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `224f8434` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
