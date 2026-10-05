# Forensic Learning Record (Deep Inspection): kube-rs/kube

> **Canonical Artifact**: `07_PROJECT_LEARNING/kube-rs-kube-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kube-rs/kube](https://github.com/kube-rs/kube))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:23:05.351Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kube-rs/kube`
- **Description**: Rust Kubernetes client and controller runtime
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3839 stars

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
            .create_token_request(
                serviceaccount_name,
                &PostParams::default(),
                &TokenRequest {
                    metadata: Default::default(),
                    spec: Some(TokenRequestSpec {
                        audiences: Some(audiences.clone()),
                        bound_object_ref: None,
                        expiration_seconds: None,
                    }),
                    status: None,
                },
            )
            .await?;
        let token = tokenrequest.status.unwrap().token.unwrap();
        assert!(!token.is_empty());

        // Check created token is valid with TokenReview
        let tokenreview = tokenreviews
            .create(
                &PostParams::default(),
                &TokenReview {
                    metadata: Default::default(),
                    spec: TokenReviewSpec {
                        audiences: Some(audiences.clone()),
                        token,
                    },
                    status: None,
                },
            )
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

### Core Architecture Module: `kube-core/src/discovery/v2.rs`
```
//! Types for the Aggregated Discovery API (apidiscovery.k8s.io/v2)
//!
//! These types are not part of the Kubernetes OpenAPI spec, so they are defined here
//! rather than in k8s-openapi. They mirror the types from k8s.io/api/apidiscovery/v2.
//!
//! The Aggregated Discovery API is available since Kubernetes 1.26 (beta) and stable in 1.30+.

use k8s_openapi::apimachinery::pkg::apis::meta::v1::{ListMeta, ObjectMeta};
use serde::{Deserialize, Serialize};

/// Content negotiation Accept header for Aggregated Discovery API v2
pub const ACCEPT_AGGREGATED_DISCOVERY_V2: &str = "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json";

/// APIGroupDiscoveryList is a resource containing a list of APIGroupDiscovery.
/// This is one of the types that can be returned from the /api and /apis endpoint
/// and contains an aggregated list of API resources (built-ins, Custom Resource Definitions, resources from aggregated servers)
/// that a cluster supports.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct APIGroupDiscoveryList {
    /// Standard list metadata
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ListMeta>,

    /// items is the list of groups for discovery.
    /// The groups are listed in priority order.
    #[serde(default)]
    pub items: Vec<APIGroupDiscovery>,
}

/// APIGroupDiscovery holds information about which resources are being served for all version of the API Group.
/// It contains a list of APIVersionDiscovery that holds a list of APIResourceDiscovery types served for a version.
/// Versions are in descending order of preference, with the first version being the preferred entry.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct APIGroupDiscovery {
    /// Standard object's metadata.
    /// The only field populated will be name. It will be the name of the API group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ObjectMeta>,

    /// versions are the versions supported in this group.
    /// They are sorted in descending order of preference,
    /// with the preferred version being the first entry.
    #[serde(default)]
    pub versions: Vec<APIVersionDiscovery>,
}

/// APIVersionDiscovery holds a list of APIResourceDiscovery types that are served for a particular version within an API Group.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct APIVersionDiscovery {
    /// version is the name of the version within a group version.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,

    /// resources is a list of APIResourceDiscovery objects for the corresponding group version.
    #[serde(default)]
    pub resources: Vec<APIResourceDiscovery>,

    /// freshness marks whether a group version's discovery document is up to date.
    /// "Current" indicates the discovery document was recently refreshed.
    /// "Stale" indicates the discovery document could not be retrieved and
    /// the returned discovery document may be significantly out of date.
    /// Clients that require the latest version of the discovery information
    /// should not use the aggregated document.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub freshness: Option<String>,
}

/// APIResourceDiscovery provides information about an API resource for discovery.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct APIResourceDiscovery {
    /// resource is the plural name of the resource.
    /// This is used in the URL path and is the unique identifier for this resource across all versions in the API group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource: Option<String>,

    /// responseKind describes the group, version, and kind of the serialization schema for the object type this endpoint typically returns.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_kind: Option<GroupVersionKind>,

    /// scope indicates the scope of a resource, either "Cluster" or "Namespaced".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,

    /// singularResource is the singular name of the resource.
    /// This allows clients to handle plural and singular opaquely.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub singular_resource: Option<String>,

    /// verbs is a list of supported API operation types (this includes but is not limited to get, list, watch, create, update, patch, delete, deletecollection, and proxy).
    #[serde(default)]
    pub verbs: Vec<String>,

    /// shortNames is a list of suggested short names of the resource.
    #[serde(default)]
    pub short_names: Vec<String>,

    /// categories is a list of the grouped resources this resource belongs to (e.g. 'all').
    /// Clients may use this to simplify acting on multiple resource types at once.
    #[serde(default)]
    pub categories: Vec<String>,

    /// subresources is a list of subresources provided by this resource.
    /// Subresources are located at /api/v1/namespaces/{namespace}/{resource}/{name}/{subresource}
    #[serde(default)]
    pub subresources: Vec<APISubresourceDiscovery>,
}

/// APISubresourceDiscovery provides information about an API subresource for discovery.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct APISubresourceDiscovery {
    /// subresource is the name of the subresource.
    /// This is used in the URL path and is the unique identifier for this resource across all versions.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subresource: Option<String>,

    /// responseKind describes the group, version, and kind of the serialization schema for the object type this endpoint typically returns.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_kind: Option<GroupVersionKind>,

    /// acceptedTypes describes the kinds that this endpoint accepts.
    /// Subresources may accept the parent's kind (for update, patch) or its own kind (for create).
    #[serde(default)]
    pub accepted_types: Vec<GroupVersionKind>,

    /// verbs is a list of supported API operation types (this includes but is not limited to get, list, watch, create, update, patch, delete).
    #[serde(default)]
    pub verbs: Vec<String>,
}

/// GroupVersionKind unambiguously identifies a kind.
/// This is a local copy for use in discovery types.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupVersionKind {
    /// group is the group of the resource.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,

    /// version is the version of the resource.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,

    /// kind is the kind of the resource.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_api_group_discovery_list() {
        // Sample response similar to what Kubernetes returns from /apis with aggregated discovery
        let json = r#"{
            "kind": "APIGroupDiscoveryList",
            "apiVersion": "apidiscovery.k8s.io/v2",
            "metadata": {},
            "items": [
                {
                    "metadata": {
                        "name": "apps"
                    },
                    "versions": [
                        {
                            "version": "v1",
                            "freshness": "Current",
                            "resources": [
                                {
                                    "resource": "deployments",
                                    "responseKind": {
                                        "group": "apps",
                                        "version": "v1",
                                        "kind": "Deployment"
                                    },
                                    "scope": "Namespaced",
                                    "singularResource": "deployment",
                                    "verbs": ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"],
                                    "shortNames": ["deploy"],
                                    "categories": ["all"],
                                    "subresources": [
                                        {
                                            "subresource": "status",
                                            "responseKind": {
                                                "group": "apps",
                                                "version": "v1",
                                                "kind": "Deployment"
                                            },
                                            "verbs": ["get", "patch", "update"]
                                        },
                                        {
                                            "subresource": "scale",
                                            "responseKind": {
                                                "group": "autoscaling",
                                                "version": "v1",
                                                "kind": "Scale"
                                            },
                                            "verbs": ["get", "patch", "update"]
                                        }
                              
```

### Core Architecture Module: `kube-core/src/duration.rs`
```
//! Kubernetes [`Duration`]s.
use serde::{Deserialize, Deserializer, Serialize, Serializer, de};
#[cfg(feature = "schema")] use std::borrow::Cow;
use std::{cmp::Ordering, fmt, str::FromStr, time};

/// A Kubernetes duration.
///
/// This is equivalent to the [`metav1.Duration`] type in the Go Kubernetes
/// apimachinery package. A [`metav1.Duration`] is serialized in YAML and JSON
/// as a string formatted in the format accepted by the Go standard library's
/// [`time.ParseDuration()`] function. This type is a similar wrapper around
/// Rust's [`std::time::Duration`] that can be serialized and deserialized using
/// the same format as `metav1.Duration`.
///
/// # On Signedness
///
/// Go's [`time.Duration`] type is a signed integer type, while Rust's
/// [`std::time::Duration`] is unsigned. Therefore, this type is also capable of
/// representing both positive and negative durations. This is implemented by
/// storing whether or not the parsed duration was negative as a boolean field
/// in the wrapper type. The [`Duration::is_negative`] method returns this
/// value, and when a [`Duration`] is serialized, the negative sign is included
/// if the duration is negative.
///
/// [`Duration`]s can be compared with [`std::time::Duration`]s. If the
/// [`Duration`] is negative, it will always be considered less than the
/// [`std::time::Duration`]. Similarly, because [`std::time::Duration`]s are
/// unsigned, a negative [`Duration`] will never be equal to a
/// [`std::time::Duration`], even if the wrapped [`std::time::Duration`] (the
/// negative duration's absolute value) is equal.
///
/// When converting a [`Duration`] into a [`std::time::Duration`], be aware that
/// *this information is lost*: if a negative [`Duration`] is converted into a
/// [`std::time::Duration`] and then that [`std::time::Duration`] is converted
/// back into a [`Duration`], the second [`Duration`] will *not* be negative.
///
/// [`metav1.Duration`]: https://pkg.go.dev/k8s.io/apimachinery/pkg/apis/meta/v1#Duration
/// [`time.Duration`]: https://pkg.go.dev/time#Duration
/// [`time.ParseDuration()`]: https://pkg.go.dev/time#ParseDuration
#[derive(Copy, Clone, PartialEq, Eq)]
pub struct Duration {
    duration: time::Duration,
    is_negative: bool,
}

/// Errors returned by the [`FromStr`] implementation for [`Duration`].

#[derive(Debug, thiserror::Error, Eq, PartialEq)]
#[non_exhaustive]
pub enum ParseError {
    /// An invalid unit was provided. Units must be one of 'ns', 'us', 'μs',
    /// 's', 'ms', 's', 'm', or 'h'.
    #[error("invalid unit: {}", EXPECTED_UNITS)]
    InvalidUnit,

    /// No unit was provided.
    #[error("missing a unit: {}", EXPECTED_UNITS)]
    NoUnit,

    /// The number associated with a given unit was invalid.
    #[error("invalid floating-point number: {}", .0)]
    NotANumber(#[from] std::num::ParseFloatError),
}

const EXPECTED_UNITS: &str = "expected one of 'ns', 'us', '\u{00b5}s', 'ms', 's', 'm', or 'h'";

impl From<time::Duration> for Duration {
    fn from(duration: time::Duration) -> Self {
        Self {
            duration,
            is_negative: false,
        }
    }
}

impl From<Duration> for time::Duration {
    fn from(Duration { duration, .. }: Duration) -> Self {
        duration
    }
}

impl Duration {
    /// Returns `true` if this `Duration` is negative.
    #[inline]
    #[must_use]
    pub fn is_negative(&self) -> bool {
        self.is_negative
    }
}

impl fmt::Debug for Duration {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use std::fmt::Write;
        if self.is_negative {
            f.write_char('-')?;
        }
        fmt::Debug::fmt(&self.duration, f)
    }
}

impl fmt::Display for Duration {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use std::fmt::Write;
        if self.is_negative {
            f.write_char('-')?;
        }
        fmt::Debug::fmt(&self.duration, f)
    }
}

impl FromStr for Duration {
    type Err = ParseError;

    fn from_str(mut s: &str) -> Result<Self, Self::Err> {
        // implements the same format as
        // https://cs.opensource.google/go/go/+/refs/tags/go1.20.4:src/time/format.go;l=1589
        const MINUTE: time::Duration = time::Duration::from_secs(60);

        // Go durations are signed. Rust durations aren't.
        let is_negative = s.starts_with('-');
        s = s.trim_start_matches('+').trim_start_matches('-');

        let mut total = time::Duration::from_secs(0);
        while !s.is_empty() && s != "0" {
            let unit_start = s.find(|c: char| c.is_alphabetic()).ok_or(ParseError::NoUnit)?;

            let (val, rest) = s.split_at(unit_start);
            let val = val.parse::<f64>()?;
            let unit = if let Some(next_numeric_start) = rest.find(|c: char| !c.is_alphabetic()) {
                let (unit, rest) = rest.split_at(next_numeric_start);
                s = rest;
                unit
            } else {
                s = "";
                rest
            };

            // https://cs.opensource.google/go/go/+/refs/tags/go1.20.4:src/time/format.go;l=1573
            let base = match unit {
                "ns" => time::Duration::from_nanos(1),
                // U+00B5 is the "micro sign" while U+03BC is "Greek letter mu"
                "us" | "\u{00b5}s" | "\u{03bc}s" => time::Duration::from_micros(1),
                "ms" => time::Duration::from_millis(1),
                "s" => time::Duration::from_secs(1),
                "m" => MINUTE,
                "h" => MINUTE * 60,
                _ => return Err(ParseError::InvalidUnit),
            };

            total += base.mul_f64(val);
        }

        Ok(Duration {
            duration: total,
            is_negative,
        })
    }
}

impl Serialize for Duration {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.collect_str(self)
    }
}

impl<'de> Deserialize<'de> for Duration {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct Visitor;
        impl de::Visitor<'_> for Visitor {
            type Value = Duration;

            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("a string in Go `time.Duration.String()` format")
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                let val = value.parse::<Duration>().map_err(de::Error::custom)?;
                Ok(val)
            }
        }
        deserializer.deserialize_str(Visitor)
    }
}

impl PartialEq<time::Duration> for Duration {
    fn eq(&self, other: &time::Duration) -> bool {
        // Since `std::time::Duration` is unsigned, a negative `Duration` is
        // never equal to a `std::time::Duration`.
        if self.is_negative {
            return false;
        }

        self.duration == *other
    }
}

impl PartialEq<time::Duration> for &'_ Duration {
    fn eq(&self, other: &time::Duration) -> bool {
        // Since `std::time::Duration` is unsigned, a negative `Duration` is
        // never equal to a `std::time::Duration`.
        if self.is_negative {
            return false;
        }

        self.duration == *other
    }
}

impl PartialEq<Duration> for time::Duration {
    fn eq(&self, other: &Duration) -> bool {
        // Since `std::time::Duration` is unsigned, a negative `Duration` is
        // never equal to a `std::time::Duration`.
        if other.is_negative {
            return false;
        }

        self == &other.duration
    }
}

impl PartialEq<Duration> for &'_ time::Duration {
    fn eq(&self, other: &Duration) -> bool {
        // Since `std::time::Duration` is unsigned, a negative `Duration` is
        // never equal to a `std::time::Duration`.
        if other.is_negative {
            return false;
        }

        *self == &other.duration
    }
}

impl PartialOrd for Duration {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Duration {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self.is_negative, other.is_negative) {
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            // if both durations are negative, the "higher" Duration value is
            // actually the lower one
            (true, true) => self.duration.cmp(&other.duration).reverse(),
            (false, false) => self.duration.cmp(&other.duration),
        }
    }
}

impl PartialOrd<time::Duration> for Duration {
    fn partial_cmp(&self, other: &time::Duration) -> Option<Ordering> {
        // Since `std::time::Duration` is unsigned, a negative `Duration` is
        // always less than the `std::time::Duration`.
        if self.is_negative {
            return Some(Ordering::Less);
        }

        self.duration.partial_cmp(other)
    }
}

#[cfg(feature = "schema")]
impl schemars::JsonSchema for Duration {
    // see
    // https://github.com/kubernetes/apimachinery/blob/756e2227bf3a486098f504af1a0ffb736ad16f4c/pkg/apis/meta/v1/duration.go#L61
    fn schema_name() -> Cow<'static, str> {
        "Duration".into()
    }

    fn inline_schema() -> bool {
        true
    }

    fn json_schema(_: &mut schemars::generate::SchemaGenerator) -> schemars::Schema {
        // the format should *not* be "duration", because "duration" means
        // the duration is formatted in ISO 8601, as described here:
        // https://datatracker.ietf.org/doc/html/draft-handrews-json-schema-validation-02#section-7.3.1
        schemars::json_schema!({
            "type": "string",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_same_as_go() {
        const MINUTE: time::Duration = time::Duration::from_secs(60);
        const HOUR: time::Duration = time::Duration::from_se
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2079** (2026-09-17): **gzip feature breaks all watches against Kubernetes 1.37**
  *Symptoms*: ### Current and expected behavior  With the `gzip` feature enabled, every watch against a 1.37 apiserver fails immediately with:      ReadEvents(Custom { kind: Other, error: Service("there are extra bytes after body has been decompressed") })  Expected: the watch stream decodes as it does on 1.36 and earlier.  Two unrelated changes colliding, both reproduced locally on k3d `rancher/k3s:v1.37.0-k3s1`:  - k8s 1.37 enabled `WatchListCompression` (beta, default on, kubernetes/kubernetes#139308). The writer   closes the gzip stream on every flush (`watch.go:289` @ v1.37.0), so a compressed watch is **one gzip   member per event** — a 4-event capture came back as 4 chunks, each starting `1f 8b` with its own CRC   trailer. v1.36.4 sends no `Content-Encoding` at all. - tower-http 0.6.8 disabled `multiple_members` on the gzip decoder (tower-rs/tower-http#621) and errors   on the leftovers (`compression_utils.rs:248`). `decompression/body.rs:347` is still a bare   `GzipDecoder::new`; zstd keeps it at `:398`. Unchanged in 0.7.1, and our pin resolves to 0.6.11.  The 1.37 changelog says regular watches are unaffected; they are not. `SetListOptionsDefaults` (`internalversion/defaults.go:25`) promotes `watch=true` + rv `""`/`"0"` + `allowWatchBookmarks=true` into a WatchList server-side, and `WatchParams::default()` sets `bookmarks: true` (`kube-core/src/params.rs:404`) and never sends `sendInitialEvents=false`. `watcher()` in `StreamingList` mode is hit too. LIST is unaffected (single memb

- **Issue #2061** (2026-08-29): **"event queue error: watch stream failed: Error deserializing response: invalid type: string" when adding .owns() to a Controller**
  *Symptoms*: ### Current and expected behavior  The full context is here - https://gitlab.cronce.io/foss/archipelago-k8s/-/blob/master/src/controller.rs#L75 - but for a reduced example:  ```rust         let watcher_config = watcher::Config::default().labels(&label_selector);         let pods = Api::<Pod>::default_namespaced(client.clone());         let multiworlds = Api::<MultiWorld>::default_namespaced(client);         let stream = Controller::new(multiworlds, watcher_config.clone())                 .owns(pods, watcher_config.clone())                 .shutdown_on_signal()                 .run(reconcile, handle_error, context)                 .for_each(|result| {                         match result {                                 Ok((obj, _action)) => info!(multiworld.name=%obj.name, "Finished reconciling MultiWorld"),                                 Err(error) => error!(%error, "Failed to reconcile MultiWorld"),                         };                         ready(())                 })                 .await; ```  And for full log statements: ``` 2026-08-27T04:33:54.824064Z ERROR operator::controller: Failed to reconcile MultiWorld error=event queue error: watch stream failed: Error deserializing response: invalid type: string "kind", expected adjacently tagged enum WatchEvent at line 1 column 8 2026-08-27T04:33:56.234435Z ERROR operator::controller: Failed to reconcile MultiWorld error=event queue error: watch stream failed: Error deserializing response: invalid type: string "ap
  **Post-Mortem & Fix Analysis**:
  > The deserialization errors and the use of a crd indicates to me that the crd structs you use in rust are a likely culprit for this. (The error mentions `WatchEvent` which is internal to kube, but that's unlikely to actually have issues - and it will embed your struct).  What does your rust representation of `MultiWorld` look like? Did you use `kopium` to generate it? Do you convert between snake case / camel case?
  > In case it changes your train of thought before reading all the rest, I'll say first - everything works and doesn't throw any errors _without_ the `.owns()` - nothing seems to go wrong until I add those  That said  My CRD struct uses `#[derive(CustomResource)]` [here](https://gitlab.cronce.io/foss/archipelago-k8s/-/blob/master/src/crd.rs), and the CRD manifest itself is generated using `CustomResourceExt::crd()` [here](https://gitlab.cronce.io/foss/archipelago-k8s/-/blob/master/src/crd-gen.rs), I'll paste current copies of both below  I'm not converting between snake and camel case, I stuck with snake for the CRD  Also, thanks for taking a look!  Much appreciated  CRD structs ```rust #[derive(Debug, Clone, CustomResource, Deserialize, Serialize, JsonSchema)] #[kube(group = "archipelago.gg", version = "v1", kind = "MultiWorld", namespaced)] pub struct MultiWorldSpec { 	pub(crate) room_id: String, 	pub(crate) password: Option<String>, 	pub(crate) admin_password: String, 	pub(crate) log_l
  > @clux I found `Client::request_events` never calls `handle_api_errors`, unlike `request_stream`, so a non-2xx watch response gets line-parsed as watch events and the real status is lost. I'll fix it.  @mcronce Your list works but the watch doesn't, so check whether the operator's ServiceAccount has the watch verb, not just get and list, on all five owned resources.

- **Issue #2053** (2026-07-28): **Predicate filter cannot be used with dynamic resource**
  *Symptoms*: ### Current and expected behavior  I cannot use a predicate with a dynamic object, due to lack of a `Default` implementation on `kube::api::Object`. The reproducer uses a literal `DynamicObject`, the project I'm working on uses a `kube::api::Object<_, _>` type, but the error is the same (see below for a reproducer).  ### Possible solution  I think the `Default` trait bound on the predicate filter resource is actually not required - at least removing it _seems_ to work fine, though I'd like someone more familiar with the codebase to sanity check the idea:  ``` impl<St, K, P> Stream for PredicateFilter<St, K, P> where     St: Stream<Item = Result<K, Error>>,     K: Resource,     K::DynamicType: Eq + Hash,     P: Predicate<K>, ```  ### Additional context  Simple reproducer:   ```rust use kube::api::{ApiResource, DynamicObject, GroupVersionKind}; use kube::runtime::{     Controller, PredicateConfig, WatchStreamExt, predicates, reflector, watcher, };  #[allow(unused)] fn repro(client: kube::Client) {     let ar = ApiResource::from_gvk(&GroupVersionKind::gvk("", "v1", "Node"));     let api = kube::Api::<DynamicObject>::all_with(client, &ar);      let writer = reflector::store::Writer::new(ar.clone());     let reader = writer.as_reader();     let stream = watcher(api, watcher::Config::default())         .default_backoff()         .reflect(writer)         .applied_objects()         .predicate_filter(predicates::generation, PredicateConfig::default());      // error[E0277]: the trait 
  **Post-Mortem & Fix Analysis**:
  > thanks for reporting. assigned you on it!
  > I've opened a PR in #2054.

- **Issue #2028** (2026-07-02): **kube-rs doesn't support native certificate store**
  *Symptoms*: ### Current and expected behavior  kube rs doesn't fallback to OS/system root CA store.  When no certificate-authority is set in the kubeconfig, client-go falls back to the system trust store. From transport/transport.go: ``` func rootCertPool(caData []byte) (*x509.CertPool, error) {       if len(caData) == 0 {               ...               return nil, nil   // nil RootCAs → "use system CAs"       }       certPool := x509.NewCertPool()       certPool.AppendCertsFromPEM(caData)       return certPool, nil } ``` And in TLSConfigFor, tlsConfig.RootCAs is set to whatever this returns. A nil RootCAs tells Go's crypto/tls to use the platform system roots (on macOS the Security framework / keychain, on Linux /etc/ssl/certs, on Windows the system cert store). If you provide a CA, that CA becomes the only trust anchor.  ### Possible solution  Add similar fallback  ### Additional context  _No response_  ### Environment  Any  ### Configuration and features  _No response_  ### YAML  _No response_  ### Affected crates  _No response_  ### Would you like to work on fixing this bug?  yes
  **Post-Mortem & Fix Analysis**:
  > I'd like to add similar logic by using the great //github.com/rustls/rustls-platform-verifier
  > Sounds great. Thank you!

- **Issue #2026** (2026-06-29): **Multi-document YAML deserialization error in the `kubectl apply` example**
  *Symptoms*: ### Current and expected behavior  Multi-document YAML deserialization error in the `kubectl apply` example. The program should use `serde_saphyr` to deserialize YAML instead of `serde_json`. ```rust let yaml = std::fs::read(&pth).with_context(|| format!("Failed to read {}", pth.display()))?; let docs = serde_json::Deserializer::from_slice(&yaml)     .into_iter::<DynamicObject>()     .flatten()     .collect::<Vec<_>>(); ```  ### Possible solution  ```rust let values: Vec<serde_json::Value> = serde_saphyr::from_multiple(yaml)?; for value in values {     if value.is_object() {         let doc: DynamicObject = serde_json::from_value(value)?;         ...     } } ```  ### Additional context  _No response_  ### Environment  Client Version: v1.32.3 Kustomize Version: v5.5.0 Server Version: v1.33.12-eks-0247562 alpine:3.24.1  ### Configuration and features  _No response_  ### YAML  _No response_  ### Affected crates  _No response_  ### Would you like to work on fixing this bug?  None
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting

- **Issue #2001** (2026-06-11): **kubectl/rs mismatch - authexec doesn't support yaml output**
  *Symptoms*: ### Current and expected behavior  Based on our customer report where kubectl works fine but [mirrord](https://github.com/metalbear-co/mirrord/issues/4354) doesn't I expect that kube-rs lacks support for auth exec emitting yaml instead of json.  ### Possible solution  _No response_  ### Additional context  _No response_  ### Environment  N/A  ### Configuration and features  _No response_  ### YAML  _No response_  ### Affected crates  _No response_  ### Would you like to work on fixing this bug?  Yes - I created this issue to start investigating, will probably send PR.

- **Issue #1986** (2026-06-16): **Watch events sometimes fail to parse**
  *Symptoms*: ### Current and expected behavior  Sometimes, one of my controllers encounters one of the following errors.  ``` QueueError(WatchFailed(SerdeError(Error("invalid type: string \"kind\", expected adjacently tagged enum WatchEvent", line: 1, column: 8)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"code\", expected adjacently tagged enum WatchEvent", line: 1, column: 8)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"status\", expected adjacently tagged enum WatchEvent", line: 1, column: 10)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"reason\", expected adjacently tagged enum WatchEvent", line: 1, column: 10)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"message\", expected adjacently tagged enum WatchEvent", line: 1, column: 11)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"details\", expected adjacently tagged enum WatchEvent", line: 1, column: 11)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"metadata\", expected adjacently tagged enum WatchEvent", line: 1, column: 12)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"apiVersion\", expected adjacently tagged enum WatchEvent", line: 1, column: 14)))) QueueError(WatchFailed(SerdeError(Error("invalid type: string \"retryAfterSeconds\", expected adjacently tagged enum WatchEvent", line: 1, column: 23)))) ```  As a result, the controller is unable to respond immediately to events and has to 
  **Post-Mortem & Fix Analysis**:
  > > but I can't understand why, nor am I able to see from the debug logs the raw JSON of the events that fail to parse (tcpdump would not help because of TLS).  You can use `kubectl proxy` to expose a plaintext proxy on localhost. (It's not quite 1:1 since it also delegates authn to kubelet, but that should be fine here.)
  > Any indication as to how this can be (somewhat) reliably reproduced, e.g., setup of the watcher etc.? E.g., if you think it might be related to your CR(D) you might want to share it?
  > I just checked the watch api, e.g., from this example: https://kubernetes.io/docs/reference/using-api/api-concepts/#streaming-lists / https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.35/#watchevent-v1-meta  ```json {   "type": "ADDED",   "object": {"kind": "Pod", "apiVersion": "v1", "metadata": {"resourceVersion": "8467", "name": "foo"}, ...} } {   "type": "ADDED",   "object": {"kind": "Pod", "apiVersion": "v1", "metadata": {"resourceVersion": "5726", "name": "bar"}, ...} } ```  I have not looked at the internals of kube-rs for this, but as far as I understand the serde error. This would happen if "type", is missing and object as well, or put more correctly: the inner value of object is being provided. (Assumption, I have not tested this with serde, but the minimal setup would be "easy" I think, use WatchEvent and try to deserialize:  Just this, and see whether it produces this error (note, ... is a placeholder, so dont take literally that json)  ``` {"kind": "Pod", "ap

- **Issue #1980** (2026-05-24): **pod_can_exec_and_write_to_stdin test routinely fails on gha**
  *Symptoms*: ### Current and expected behavior  The test that can be run locally via `cargo test -p kube-client --lib -- pod_can_exec_and_write_to_stdin --ignored` routinely fails in ci at 1.36 k3s. See e.g. [this and its re-runs](https://github.com/kube-rs/kube/actions/runs/25724079337/job/75539406347)  ``` ---- test::pod_can_exec_and_write_to_stdin stdout ---- thread 'test::pod_can_exec_and_write_to_stdin' (5055) panicked at kube-client/src/lib.rs:471:66: called `Option::unwrap()` on a `None` value ```  This corresponds to getting next from stdout if the stream supports it; https://github.com/kube-rs/kube/blob/360c3db6fdf30368dcd2fd3df84d1d019f6acc9f/kube-client/src/lib.rs#L462-L471  I thought maybe this would have something to do with 1.36 since k3d action randomly upgrades us, but trying 1.36 k3d locally it always passes.  ### Possible solution  Not sure what's up here, but will comment out the test for now.  ### Additional context  _No response_  ### Environment  GHA  ### Configuration and features  main  ### YAML  _No response_  ### Affected crates  kube-client  ### Would you like to work on fixing this bug?  no

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

### Incident Patch 1: `1be7f0d9` (2026-10-02)
**Commit Message**: Only save coverage and memory-bench caches on main (#2104)

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>

#2102 added save-if to ci.yml but missed these two, so PRs whose cache key differs from main still save their own tarpaulin (~971MB) and memory-bench (~231MB) entries. Both workflows also run on push to main, so main keeps getting their caches.

**File**: `.github/workflows/coverage.yml` (modified, +2/-0)
```diff
@@ -25,6 +25,8 @@ jobs:
       - name: Install stable toolchain
         uses: dtolnay/rust-toolchain@stable
       - uses: Swatinem/rust-cache@v2
+        with:
+          save-if: ${{ github.ref == 'refs/heads/main' }}
       - name: Install tarpaulin
         uses: taiki-e/install-action@v2
         with:
```

**File**: `.github/workflows/memory-bench.yml` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ jobs:
       - uses: actions/checkout@v7
       - uses: dtolnay/rust-toolchain@stable
       - uses: Swatinem/rust-cache@v2
+        with:
+          save-if: ${{ github.ref == 'refs/heads/main' }}
 
       - name: Run memory benchmark
         run: cargo bench -p kube-runtime --bench memory > bench-result.json
```

---

### Incident Patch 2: `a9789ece` (2026-09-30)
**Commit Message**: Fix Retry-After overflow panic in the default retry policy (#2097)

Fix Retry-After overflow panic in RetryPolicy

A 429/503/504 with a Retry-After too large for Instant + Duration panicked
in the default client retry layer. Use tokio::time::Instant with
checked_add and fall back to the normal backoff on overflow.

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>

**File**: `kube-client/src/client/retry.rs` (modified, +25/-3)
```diff
@@ -30,7 +30,7 @@
 //! # }
 //! ```
 
-use std::time::{Duration, Instant};
+use std::time::Duration;
 
 use http::{Request, Response, StatusCode};
 use tower::{
@@ -41,6 +41,7 @@ use tower::{
     },
     util::rng::HasherRng,
 };
+use tokio::time::Instant;
 
 use super::Body;
 
@@ -154,8 +155,10 @@ impl<Res> Policy<Request<Body>, Response<Res>, BoxError> for RetryPolicy {
                     && let Some(retry_after) = retry_after.parse::<u64>().ok()
                 {
                     let server_delay = Duration::from_secs(retry_after);
-                    let retry_after = Instant::now() + server_delay;
-                    if backoff.deadline().le(&retry_after.into()) {
+                    if Instant::now()
+                        .checked_add(server_delay)
+                        .is_some_and(|retry_after| backoff.deadline() <= retry_after)
+                    {
                         return Some(tokio::time::sleep(server_delay));
                     }
                 }
@@ -223,4 +226,23 @@ mod tests {
         assert!(policy.server_aware);
         assert_eq!(policy.max_retries, 15);
     }
+
+    fn retry_after(policy: &mut RetryPolicy, secs: &str) -> Instant {
+        let mut req = Request::new(Body::empty());
+        let mut res: Result<_, BoxError> = Ok(Response::builder()
+            .status(StatusCode::TOO_MANY_REQUESTS)
+            .header("Retry-After", secs)
+            .body(())
+            .unwrap());
+        policy.retry(&mut req, &mut res).expect("429 is retried").deadline()
+    }
+
+    #[tokio::test(start_paused = true)]
+    async fn retry_after_overflow_falls_back_to_backoff() {
+        let now = Instant::now();
+        let mut policy = RetryPolicy::server_retry();
+        assert_eq!(retry_after(&mut policy, "30"), now + Duration::from_secs(30));
+        // `now + Retry-After` overflows an Instant; must not panic.
+        assert!(retry_after(&mut policy, &u64::MAX.to_string()) < now + Duration::from_secs(1));
+    }
 }
```

---

### Incident Patch 3: `6752745d` (2026-09-29)
**Commit Message**: client: log non-JSON error bodies at debug, not warn (#2070)

* client: log non-JSON error bodies at debug, not warn

`handle_api_errors` falls back to reconstructing a `Status` whenever
the error body it gets back isn't valid JSON. This is expected rather
than exceptional: a non-existent API path (e.g. probing whether a CRD
is installed yet) or a proxy/ingress in front of the apiserver will
often return a plain-text or HTML 404 instead of a JSON `Status`.
Logging this at `warn` makes routine 404s noisy for no actionable
reason, and is inconsistent with the parsed-JSON branch right above it,
which already logs at `debug`.

Also trim the raw body text before using it as the reconstructed
`Status` message, since these bodies commonly end in a trailing
newline (e.g. `"404 page not found\n"`) that otherwise leaks into the
error.

Closes #1604

Signed-off-by: anant <[REDACTED_EMAIL]>

* client: fix handle_api_errors doc comment

Drop the "probably a bug if encountered" line, which contradicts the new
inline comment explaining that non-JSON error bodies are routine, and fix
the "someohow" typo just above it.

Signed-off-by: anant <[REDACTED_EMAIL]>

---------

Signed-off-by: anant <[REDA

**File**: `kube-client/src/client/mod.rs` (modified, +39/-4)
```diff
@@ -545,10 +545,9 @@ impl Client {
 /// Kubernetes returned error handling
 ///
 /// Either kube returned an explicit ApiError struct,
-/// or it someohow returned something we couldn't parse as one.
+/// or it somehow returned something we couldn't parse as one.
 ///
 /// In either case, present an ApiError upstream.
-/// The latter is probably a bug if encountered.
 async fn handle_api_errors(res: Response<Body>) -> Result<Response<Body>> {
     let status = res.status();
     if status.is_client_error() || status.is_server_error() {
@@ -561,8 +560,14 @@ async fn handle_api_errors(res: Response<Body>) -> Result<Response<Body>> {
             tracing::debug!("Unsuccessful: {status:?}");
             Err(Error::Api(status.boxed()))
         } else {
-            tracing::warn!("Unsuccessful data error parse: {text}");
-            let status = Status::failure(&text, "Failed to parse error data").with_code(status.as_u16());
+            // Not every error response is a JSON `Status`. A proxy, ingress
+            // controller, or a bare API path that doesn't exist (e.g. a CRD
+            // that isn't installed yet) can return a plain-text or HTML body
+            // instead. This is routine rather than exceptional, so it's
+            // logged at `debug` like the parsed case above rather than `warn`.
+            let text = text.trim();
+            tracing::debug!("Unsuccessful data error parse: {text}");
+            let status = Status::failure(text, "Failed to parse error data").with_code(status.as_u16());
             tracing::debug!("Unsuccessful: {status:?} (reconstruct)");
             Err(Error::Api(status.boxed()))
         }
@@ -819,4 +824,34 @@ mod tests {
         assert!(matches!(&err, Error::Api(s) if s.code == 403), "got {err:?}");
         spawned.await.unwrap();
     }
+
+    #[tokio::test]
+    async fn test_non_json_error_response_is_reconstructed() {
+        let (mock_service, handle) = mock::pair::<Request<Body>, Response<Body>>();
+        let spawned = tokio::spawn(async move {
+            let mut handle = pin!(handle);
+            let (_request, send) = handle.next_request().await.expect("service not called");
+            // Some routers in front of the apiserver (or a probe for a CRD
+            // that isn't installed yet) return a plain-text 404 instead of a
+            // JSON `Status`.
+            send.send_response(
+                Response::builder()
+                    .status(http::StatusCode::NOT_FOUND)
+                    .body(Body::from(b"404 page not found\n".to_vec()))
+                    .unwrap(),
+            );
+        });
+
+        let pods: Api<Pod> = Api::default_namespaced(Client::new(mock_service, "default"));
+        let Err(err) = pods.get("test").await else {
+            panic!("get with a non-JSON error response should fail");
+        };
+        let Error::Api(status) = &err else {
+            panic!("expected Error::Api, got {err:?}");
+        };
+        assert_eq!(status.code, 404);
+        assert_eq!(status.reason, "Failed to parse error data");
+        assert_eq!(status.message, "404 page not found");
+        spawned.await.unwrap();
+    }
 }
```

---

### Incident Patch 4: `c724be6e` (2026-09-29)
**Commit Message**: Deprecate ListParams::timeout (#2093)

ListParams::timeout has not been sent with list requests since
ListParams and WatchParams were split in #1162, but its docs still
described a list/watch timeout defaulting to 290s.

Refs #334

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>

**File**: `kube-core/src/params.rs` (modified, +14/-6)
```diff
@@ -48,9 +48,13 @@ pub struct ListParams {
     /// Defaults to everything if `None`.
     pub field_selector: Option<String>,
 
-    /// Timeout for the list/watch call.
+    /// Has no effect since this value is not sent with list requests.
     ///
-    /// This limits the duration of the call, regardless of any activity or inactivity.
+    /// To limit the duration of a watch call, use [`WatchParams::timeout`].
+    #[deprecated(
+        since = "5.0.0",
+        note = "has no effect on list requests; use `WatchParams::timeout` for watch calls"
+    )]
     pub timeout: Option<u32>,
 
     /// Limit the number of results.
@@ -129,15 +133,19 @@ impl ListParams {
 /// use kube::api::ListParams;
 /// let lp = ListParams::default()
 ///     .match_any()
-///     .timeout(60)
 ///     .labels("kubernetes.io/lifecycle=spot");
 /// ```
 impl ListParams {
-    /// Configure the timeout for list/watch calls
+    /// Set the timeout field
     ///
-    /// This limits the duration of the call, regardless of any activity or inactivity.
-    /// Defaults to 290s
+    /// Has no effect since this value is not sent with list requests.
+    /// To limit the duration of a watch call, use [`WatchParams::timeout`].
+    #[deprecated(
+        since = "5.0.0",
+        note = "has no effect on list requests; use `WatchParams::timeout` for watch calls"
+    )]
     #[must_use]
+    #[allow(deprecated)]
     pub fn timeout(mut self, timeout_secs: u32) -> Self {
         self.timeout = Some(timeout_secs);
         self
```

**File**: `kube-runtime/src/watcher.rs` (modified, +4/-4)
```diff
@@ -251,10 +251,10 @@ pub struct Config {
     /// Defaults to everything if `None`.
     pub field_selector: Option<String>,
 
-    /// Timeout for the list/watch call.
+    /// Timeout for the watch call.
     ///
     /// This limits the duration of the call, regardless of any activity or inactivity.
-    /// If unset for a watch call, we will use 290s.
+    /// If unset, we will use 290s.
     /// The watcher's dead-connection detection window is this value plus 5s,
     /// so larger values delay noticing a silently dropped connection.
     pub timeout: Option<u32>,
@@ -321,7 +321,7 @@ impl Default for Config {
 ///     .labels("kubernetes.io/lifecycle=spot");
 /// ```
 impl Config {
-    /// Configure the timeout for list/watch calls
+    /// Configure the timeout for watch calls
     ///
     /// This limits the duration of the call, regardless of any activity or inactivity.
     /// Defaults to 290s
@@ -429,12 +429,12 @@ impl Config {
         ListParams {
             label_selector: self.label_selector.clone(),
             field_selector: self.field_selector.clone(),
-            timeout: self.timeout,
             version_match,
             resource_version,
             // The watcher handles pagination internally.
             limit: self.page_size,
             continue_token: None,
+            ..Default::default()
         }
     }
 
```

---

### Incident Patch 5: `800ad338` (2026-09-29)
**Commit Message**: fix(runtime): honor zero watch timeout without idle watchdog (#2068)

* fix(runtime): honor zero watch timeout without idle watchdog

Signed-off-by: centerionware <[REDACTED_EMAIL]>

* docs(runtime): clarify zero watch timeout behavior

Signed-off-by: centerionware <[REDACTED_EMAIL]>

---------

Signed-off-by: centerionware <[REDACTED_EMAIL]>
Signed-off-by: centerionware <[REDACTED_EMAIL]>
Co-authored-by: centerionware <[REDACTED_EMAIL]>

**File**: `kube-runtime/src/watcher.rs` (modified, +18/-1)
```diff
@@ -518,11 +518,16 @@ const WATCH_IDLE_TIMEOUT_MARGIN: Duration = Duration::from_secs(5);
 ///
 /// Returns `None` when the stream ends **or** when no item arrives within
 /// `timeout + WATCH_IDLE_TIMEOUT_MARGIN`, causing the watcher to
-/// treat the connection as dead and reconnect.
+/// treat the connection as dead and reconnect. An explicit zero timeout
+/// disables this client-side idle timeout.
 async fn next_with_idle_timeout<S, T>(stream: &mut S, timeout: Option<u32>) -> Option<T>
 where
     S: Stream<Item = T> + Unpin,
 {
+    if timeout == Some(0) {
+        return stream.next().await;
+    }
+
     let idle_timeout = Duration::from_secs(u64::from(timeout.unwrap_or(290))) + WATCH_IDLE_TIMEOUT_MARGIN;
     match tokio::time::timeout(idle_timeout, stream.next()).await {
         Ok(item) => item,
@@ -1476,6 +1481,18 @@ mod tests {
         assert_eq!(result, Some(1));
     }
 
+    #[tokio::test(start_paused = true)]
+    async fn zero_timeout_does_not_trigger_idle_timeout() {
+        let mut stream = futures::stream::once(async {
+            tokio::time::sleep(Duration::from_secs(6)).await;
+            42
+        })
+        .boxed();
+
+        let result = next_with_idle_timeout(&mut stream, Some(0)).await;
+        assert_eq!(result, Some(42));
+    }
+
     #[tokio::test(start_paused = true)]
     async fn idle_timeout_returns_none_on_dead_connection() {
         let mut stream = futures::stream::pending::<i32>();
```

---

### Incident Patch 6: `fc4669ca` (2026-09-28)
**Commit Message**: core: allow watch timeouts above five minutes (#2069)

* fix(core): allow watch timeouts above five minutes

Remove the stale client-side validation and issue reference while preserving kube-rs’s existing 290-second default for unset watch timeouts.

Signed-off-by: centerionware <[REDACTED_EMAIL]>

* Update kube-core/src/params.rs

Co-authored-by: doxxx <[REDACTED_EMAIL]>
Signed-off-by: centerionware <[REDACTED_EMAIL]>

* Update kube-runtime/src/watcher.rs

Co-authored-by: doxxx <[REDACTED_EMAIL]>
Signed-off-by: centerionware <[REDACTED_EMAIL]>

---------

Signed-off-by: centerionware <[REDACTED_EMAIL]>
Signed-off-by: centerionware <[REDACTED_EMAIL]>
Co-authored-by: centerionware <[REDACTED_EMAIL]>
Co-authored-by: doxxx <[REDACTED_EMAIL]>

**File**: `kube-core/src/params.rs` (modified, +2/-8)
```diff
@@ -319,7 +319,8 @@ pub struct WatchParams {
     ///
     /// This limits the duration of the call, regardless of any activity or inactivity.
     /// If unset for a watch call, we will use 290s.
-    /// We limit this to 295s due to [inherent watch limitations](https://github.com/kubernetes/kubernetes/issues/6513).
+    /// The watcher's dead-connection detection window is this value plus 5s,
+    /// so larger values delay noticing a silently dropped connection.
     pub timeout: Option<u32>,
 
     /// Enables watch events with type "BOOKMARK".
@@ -359,12 +360,6 @@ pub struct WatchParams {
 
 impl WatchParams {
     pub(crate) fn validate(&self) -> Result<(), Error> {
-        if let Some(to) = &self.timeout {
-            // https://github.com/kubernetes/kubernetes/issues/6513
-            if *to >= 295 {
-                return Err(Error::Validation("WatchParams::timeout must be < 295s".into()));
-            }
-        }
         if self.send_initial_events && !self.bookmarks {
             return Err(Error::Validation(
                 "WatchParams::bookmarks must be set when using send_initial_events".into(),
@@ -377,7 +372,6 @@ impl WatchParams {
     pub(crate) fn populate_qp(&self, qp: &mut form_urlencoded::Serializer<String>) {
         qp.append_pair("watch", "true");
 
-        // https://github.com/kubernetes/kubernetes/issues/6513
         qp.append_pair("timeoutSeconds", &self.timeout.unwrap_or(290).to_string());
 
         if let Some(fields) = &self.field_selector {
```

**File**: `kube-core/src/request.rs` (modified, +7/-4)
```diff
@@ -822,10 +822,13 @@ mod test {
     }
 
     #[test]
-    fn watch_timeout_error() {
+    fn watch_timeout_allows_long_duration() {
         let url = corev1::Pod::url_path(&(), Some("ns"));
-        let wp = WatchParams::default().timeout(100000);
-        let err = Request::new(url).watch(&wp, "").unwrap_err();
-        assert!(format!("{err}").contains("timeout must be < 295s"));
+        let wp = WatchParams::default().timeout(1800);
+        let req = Request::new(url).watch(&wp, "0").unwrap();
+        assert_eq!(
+            req.uri(),
+            "/api/v1/namespaces/ns/pods?&watch=true&timeoutSeconds=1800&allowWatchBookmarks=true&resourceVersion=0"
+        );
     }
 }
```

**File**: `kube-runtime/src/watcher.rs` (modified, +2/-1)
```diff
@@ -255,7 +255,8 @@ pub struct Config {
     ///
     /// This limits the duration of the call, regardless of any activity or inactivity.
     /// If unset for a watch call, we will use 290s.
-    /// We limit this to 295s due to [inherent watch limitations](https://github.com/kubernetes/kubernetes/issues/6513).
+    /// The watcher's dead-connection detection window is this value plus 5s,
+    /// so larger values delay noticing a silently dropped connection.
     pub timeout: Option<u32>,
 
     /// Semantics for list calls.
```

---

### Incident Patch 7: `237386c1` (2026-09-26)
**Commit Message**: Update serde-saphyr requirement from 0.0.29 to 1.3.0 (#2086)

Update serde-saphyr requirement from 0.0.29 to 1.0.0

Updating serde-saphry to relax the constraint on smallvec.

Note that serde_saphyr::Error is exposed in kube-client's public API
(KubeconfigError::Parse and auth::Error::AuthExecParse).

Signed-off-by: Jesse Szwedko <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ schemars = "1.0.0"
 secrecy = "0.10.2"
 serde = "1.0.221"
 serde_json = "1.0.127"
-serde-saphyr = "0.0.29"
+serde-saphyr = "1.0.0"
 serde-value = "0.7.0"
 syn = "2.0.98"
 tame-oauth = "0.10.0"
```

**File**: `deny.toml` (modified, +4/-0)
```diff
@@ -74,3 +74,7 @@ name = "rand_core"
 [[bans.skip]]
 # need some time to get the whole ecosystem to syn 3
 name = "syn"
+
+[[bans.skip]]
+# serde-saphyr pulls in base64 0.23 while k8s-openapi/pem/tower-http still use 0.22
+name = "base64"
```

---

### Incident Patch 8: `020ffda1` (2026-09-24)
**Commit Message**: fix minor cargo + clippy lints (#2087)

* fix minor cargo lints

Signed-off-by: clux <[REDACTED_EMAIL]>

* obivously needed

Signed-off-by: clux <[REDACTED_EMAIL]>

* fmt

Signed-off-by: clux <[REDACTED_EMAIL]>

* guess this is too ambitious

Signed-off-by: clux <[REDACTED_EMAIL]>

* ok this as also

Signed-off-by: clux <[REDACTED_EMAIL]>

---------

Signed-off-by: clux <[REDACTED_EMAIL]>

**File**: `e2e/Cargo.toml` (modified, +4/-1)
```diff
@@ -5,7 +5,10 @@ version.workspace = true
 authors.workspace = true
 edition.workspace = true
 license.workspace = true
-lints.workspace = true
+
+[lints.rust]
+missing_docs = "allow"
+unsafe_code = "forbid"
 
 [package.metadata.release]
 release = false
```

**File**: `examples/Cargo.toml` (modified, +4/-1)
```diff
@@ -5,7 +5,10 @@ version.workspace = true
 authors.workspace = true
 edition.workspace = true
 license.workspace = true
-lints.workspace = true
+
+[lints.rust]
+missing_docs = "allow"
+unsafe_code = "forbid"
 
 [package.metadata.release]
 release = false
```

**File**: `kube-core/src/cel/mod.rs` (modified, +1/-0)
```diff
@@ -435,6 +435,7 @@ pub enum MergeStrategy {
 }
 
 impl MergeStrategy {
+    #[allow(dead_code)] // only used in some feature combinations
     fn keys(self) -> serde_json::Result<BTreeMap<String, Value>> {
         if let Self::ListType(ListMerge::Map(keys)) = self {
             let mut data = BTreeMap::new();
```

---

### Incident Patch 9: `b7625b04` (2026-09-23)
**Commit Message**: Install rustls crypto provider in gzip builder test (#2085)

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>

**File**: `kube-client/src/client/builder.rs` (modified, +5/-1)
```diff
@@ -328,7 +328,11 @@ mod tests {
         use http::Uri;
         use std::net::SocketAddr;
         use tokio::net::{TcpListener, TcpStream};
-        
+
+        // make_generic_builder skips the provider install in TryFrom<Config>
+        #[cfg(feature = "aws-lc-rs")]
+        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
+
         // setup a server that echoes back any encoding header value
         let addr: SocketAddr = ([127, 0, 0, 1], 0).into();
         let listener = TcpListener::bind(addr).await?;
```

---

### Incident Patch 10: `660966eb` (2026-07-06)
**Commit Message**: Chore(deps): Update serde-saphyr requirement from 0.0.27 to 0.0.29 (#2032)

Updates the requirements on [serde-saphyr](https://github.com/bourumir-wyngs/serde-saphyr) to permit the latest version.
- [Release notes](https://github.com/bourumir-wyngs/serde-saphyr/releases)
- [Commits](https://github.com/bourumir-wyngs/serde-saphyr/compare/0.0.27...0.0.29)

---
updated-dependencies:
- dependency-name: serde-saphyr
  dependency-version: 0.0.29
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Eirik A <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ schemars = "1.0.0"
 secrecy = "0.10.2"
 serde = "1.0.221"
 serde_json = "1.0.127"
-serde-saphyr = "0.0.27"
+serde-saphyr = "0.0.29"
 serde-value = "0.7.0"
 syn = "2.0.98"
 tame-oauth = "0.10.0"
```

---

### Incident Patch 11: `f671d57e` (2026-07-06)
**Commit Message**: fix deny failures (#2034)

Signed-off-by: clux <[REDACTED_EMAIL]>

**File**: `deny.toml` (modified, +8/-1)
```diff
@@ -46,7 +46,7 @@ exceptions = [
 unknown-registry = "deny"
 unknown-git = "deny"
 allow-registry = ["https://github.com/rust-lang/crates.io-index"]
-allow-git = ["https://github.com/Arnavion/k8s-openapi"]
+# allow-git = ["https://github.com/Arnavion/k8s-openapi"]
 
 [bans]
 multiple-versions = "deny"
@@ -63,3 +63,10 @@ name = "thiserror-impl"
 [[bans.skip]]
 # ahash hasn't had a release in 12mo
 name = "getrandom"
+[[bans.skip]]
+# ahash hasn't had a release in 12mo
+name = "r-efi"
+
+[[bans.skip]]
+# tungstenite needs to bump rand
+name = "rand_core"
```

---

### Incident Patch 12: `8e6c86ee` (2026-06-29)
**Commit Message**: Fix multi-document YAML parsing in kubectl apply example (#2027)

The apply path was deserializing manifests with a `serde_json` stream
parser, which cannot read YAML (key: value syntax, `---` separators).
Worse, `.flatten()` silently discarded every parse error, so
`kubectl apply -f manifest.yaml` applied zero documents with no error.

This was a regression from the serde-yaml -> serde-saphyr migration
(#1975); the rest of the example already uses serde_saphyr. Switch to
`serde_saphyr::from_slice_multiple`, which parses multi-document YAML
directly into `DynamicObject` and propagates errors via `?`.

Fixes #2026

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>

**File**: `examples/kubectl.rs` (modified, +1/-4)
```diff
@@ -170,10 +170,7 @@ impl App {
         let ssapply = PatchParams::apply("kubectl-light").force();
         let pth = self.file.clone().expect("apply needs a -f file supplied");
         let yaml = std::fs::read(&pth).with_context(|| format!("Failed to read {}", pth.display()))?;
-        let docs = serde_json::Deserializer::from_slice(&yaml)
-            .into_iter::<DynamicObject>()
-            .flatten()
-            .collect::<Vec<_>>();
+        let docs: Vec<DynamicObject> = serde_saphyr::from_slice_multiple(&yaml)?;
 
         for obj in docs {
             let namespace = obj.metadata.namespace.as_deref().or(self.namespace.as_deref());
```

---

### Incident Patch 13: `f0937801` (2026-06-27)
**Commit Message**: chore(ci): widen clippy to all targets, fix surfaced lints (#2023)

* chore(ci): widen clippy to all targets, fix surfaced lints

`just clippy` (and the CI job that now calls it) skipped test/example/bench
code (no --all-targets) and only ran --all-features on the kube facade.
Widen to two passes, with no hardcoded feature list so features added later
are linted automatically:

    cargo clippy --workspace --all-features --all-targets --exclude e2e
    cargo clippy --workspace --all-targets

e2e is excluded from the --all-features pass because it enables both
k8s-openapi `latest` and `mk8sv`, panicking the build script; the default
pass lints it and the `#[cfg(not(feature))]` paths instead.

Fixes the lints this surfaced in previously-unlinted code:
- kube-client: box ProviderToken::Oidc (large_enum_variant); the enum is
  private, so this is not a public API change
- kube-core: drop a redundant `&` in a panic! arg
- kube-runtime: drop redundant `as u64` casts; vec! for a >16KB test array
- allow(dead_code) on intentional test/example fixtures

Signed-off-by: doxxx93 <[REDACTED_EMAIL]>

* chore(ci): lint via rs-clippy-check action, not `run: just clippy`

Keep the clippy action so 

**File**: `.github/workflows/clippy.yml` (modified, +5/-1)
```diff
@@ -14,6 +14,10 @@ jobs:
       - uses: dtolnay/rust-toolchain@nightly
         with:
           components: clippy
+      # same two passes as `just clippy` (justfile documents the e2e/feature reasons)
       - uses: clechasseur/rs-clippy-check@v5
         with:
-          args: --workspace
+          args: --workspace --all-features --all-targets --exclude e2e
+      - uses: clechasseur/rs-clippy-check@v5
+        with:
+          args: --workspace --all-targets
```

**File**: `examples/errorbounded_configmap_watcher.rs` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+#![allow(dead_code)] // demo structs: fields define the parse target, not all are read
 use futures::prelude::*;
 use k8s_openapi::api::core::v1::ConfigMap;
 use kube::{
```

**File**: `justfile` (modified, +4/-2)
```diff
@@ -7,8 +7,10 @@ default:
 
 clippy:
   #rustup component add clippy --toolchain nightly
-  cargo +nightly clippy --workspace
-  cargo +nightly clippy --all-features
+  # all features + all targets, minus e2e (its latest+mk8sv = two k8s-openapi versions -> build panic)
+  cargo +nightly clippy --workspace --all-features --all-targets --exclude e2e
+  # default features too, for the #[cfg(not(feature = ...))] paths the first pass can't reach
+  cargo +nightly clippy --workspace --all-targets
 
 fmt:
   #rustup component add rustfmt --toolchain nightly
```

**File**: `kube-client/src/client/auth/mod.rs` (modified, +3/-3)
```diff
@@ -292,7 +292,7 @@ impl TryFrom<&AuthInfo> for Auth {
                 #[cfg(feature = "oidc")]
                 ProviderToken::Oidc(oidc) => {
                     return Ok(Self::RefreshableToken(RefreshableToken::Oidc(Arc::new(
-                        Mutex::new(oidc),
+                        Mutex::new(*oidc),
                     ))));
                 }
 
@@ -377,7 +377,7 @@ impl TryFrom<&AuthInfo> for Auth {
 // We need to differentiate providers because the keys/formats to store token expiration differs.
 enum ProviderToken {
     #[cfg(feature = "oidc")]
-    Oidc(oidc::Oidc),
+    Oidc(Box<oidc::Oidc>), // boxed: largest variant, keeps the enum small (clippy::large_enum_variant)
     #[cfg(not(feature = "oidc"))]
     Oidc(String),
     // "access-token", "expiry" (RFC3339)
@@ -406,7 +406,7 @@ fn token_from_provider(provider: &AuthProviderConfig) -> Result<ProviderToken, E
 fn token_from_oidc_provider(provider: &AuthProviderConfig) -> Result<ProviderToken, Error> {
     oidc::Oidc::from_config(&provider.config)
         .map_err(Error::Oidc)
-        .map(ProviderToken::Oidc)
+        .map(|t| ProviderToken::Oidc(Box::new(t)))
 }
 
 #[cfg(not(feature = "oidc"))]
```

**File**: `kube-core/src/schema.rs` (modified, +1/-1)
```diff
@@ -537,7 +537,7 @@ fn hoist_subschema_properties(
                             panic!(
                                 "Property {:?} has the schema {:?} but was already defined as {:?} in another subschema. The schemas for a property used in multiple subschemas must be identical",
                                 entry.key(),
-                                &property,
+                                property,
                                 entry.get()
                             );
                         }
```

**File**: `kube-derive/tests/resource.rs` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 #![allow(missing_docs)]
+#![allow(dead_code)] // test fixtures: fields exist to exercise the derive, not to be read
 
 use k8s_openapi::{
     ByteString,
```

**File**: `kube-runtime/benches/memory.rs` (modified, +2/-2)
```diff
@@ -207,12 +207,12 @@ fn collect_stats(scenario: &str, results: &mut Vec<BenchMetric>) {
     results.push(BenchMetric {
         name: format!("{scenario} - total_allocated"),
         unit: "bytes",
-        value: stats.total_bytes as u64,
+        value: stats.total_bytes,
     });
     results.push(BenchMetric {
         name: format!("{scenario} - alloc_count"),
         unit: "allocations",
-        value: stats.total_blocks as u64,
+        value: stats.total_blocks,
     });
 }
 
```

**File**: `kube-runtime/src/reflector/dispatcher.rs` (modified, +1/-1)
```diff
@@ -222,7 +222,7 @@ pub(crate) mod test {
         // the cache. Same with a Restarted(vec![delete_item])
         let foo = testpod("foo");
         let bar = testpod("bar");
-        let st = stream::iter([
+        let st = stream::iter(vec![
             Ok(Event::Delete(foo.clone())),
             Ok(Event::Apply(foo.clone())),
             Err(Error::NoResourceVersion),
```

---

### Incident Patch 14: `a795e7e9` (2026-06-22)
**Commit Message**: Chore(deps): Update kube-cel requirement from 0.7.0 to 0.8.0 (#2017)

Updates the requirements on [kube-cel](https://github.com/kube-rs/kube-cel) to permit the latest version.
- [Release notes](https://github.com/kube-rs/kube-cel/releases)
- [Changelog](https://github.com/kube-rs/kube-cel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/kube-rs/kube-cel/compare/v0.7.0...v0.8.0)

---
updated-dependencies:
- dependency-name: kube-cel
  dependency-version: 0.8.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `kube-core/Cargo.toml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ schemars = { workspace = true, optional = true }
 k8s-openapi.workspace = true
 serde-value.workspace = true
 derive_more = { workspace = true, features = ["from"] }
-kube-cel = { version = "0.7.0", optional = true, features = ["validation"] }
+kube-cel = { version = "0.8.0", optional = true, features = ["validation"] }
 
 [dev-dependencies]
 k8s-openapi = { workspace = true, features = ["latest"] }
```

---

### Incident Patch 15: `4dcfd94c` (2026-06-18)
**Commit Message**: fix cargo hack on https proxy feature (#2014)

Signed-off-by: goenning <[REDACTED_EMAIL]>

**File**: `kube-client/src/client/builder.rs` (modified, +4/-3)
```diff
@@ -162,14 +162,12 @@ impl TryFrom<Config> for ClientBuilder<GenericService> {
             }
 
             Some(proxy_url) if proxy_url.scheme_str() == Some("https") => {
-                #[cfg(feature = "http-proxy")]
+                #[cfg(all(feature = "http-proxy", any(feature = "rustls-tls", feature = "openssl-tls")))]
                 {
                     #[cfg(feature = "rustls-tls")]
                     let proxy_connector = config.rustls_https_connector_with_connector(connector)?;
                     #[cfg(all(not(feature = "rustls-tls"), feature = "openssl-tls"))]
                     let proxy_connector = config.openssl_https_connector_with_connector(connector)?;
-                    #[cfg(all(not(feature = "rustls-tls"), not(feature = "openssl-tls")))]
-                    return Err(Error::TlsRequired);
 
                     let connector =
                         hyper_util::client::legacy::connect::proxy::Tunnel::new(proxy_url.clone(), proxy_connector);
@@ -178,6 +176,9 @@ impl TryFrom<Config> for ClientBuilder<GenericService> {
                     make_generic_builder(connector, config)
                 }
 
+                #[cfg(all(feature = "http-proxy", not(any(feature = "rustls-tls", feature = "openssl-tls"))))]
+                return Err(Error::TlsRequired);
+
                 #[cfg(not(feature = "http-proxy"))]
                 Err(Error::ProxyProtocolDisabled {
                     proxy_url: proxy_url.clone(),
```

#### Recent Merged Pull Requests:
- **PR #2104** (2026-10-02): Only save coverage and memory-bench caches on main (@doxxx93)
- **PR #2102** (2026-10-02): Warm PR caches from main and avoid k3d API rate limits (@doxxx93)
- **PR #2101** (closed): chore: run cargo fmt (@cratelyn)
- **PR #2097** (2026-09-30): Fix Retry-After overflow panic in the default retry policy (@doxxx93)
- **PR #2096** (2026-09-30): Box large error payloads to keep kube::Error under 128 bytes (@doxxx93)
- **PR #2095** (2026-09-30): Bump syn to 3 along with darling, prettyplease and educe (@doxxx93)
- **PR #2093** (2026-09-29): Deprecate ListParams::timeout (@doxxx93)
- **PR #2092** (2026-10-02): Document predicate pitfalls around deletes and finalizers (@daemonfire300)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
