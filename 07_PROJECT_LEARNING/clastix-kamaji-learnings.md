# Forensic Learning Record (Deep Inspection): clastix/kamaji

> **Canonical Artifact**: `07_PROJECT_LEARNING/clastix-kamaji-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/clastix/kamaji](https://github.com/clastix/kamaji))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:13:46.908Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `clastix/kamaji`
- **Description**: Kamaji is the Hosted Control Plane Manager for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2038 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/v1alpha1/datastore_funcs.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// GetContent is the resolver for the container of the Secret.
// The bare content has priority over the external reference.
func (in *ContentRef) GetContent(ctx context.Context, client client.Client) ([]byte, error) {
	if content := in.Content; len(content) > 0 {
		return content, nil
	}

	secretRef := in.SecretRef

	if secretRef == nil {
		return nil, fmt.Errorf("no bare content and no external Secret reference")
	}

	secret, namespacedName := &corev1.Secret{}, types.NamespacedName{Name: secretRef.Name, Namespace: secretRef.Namespace}
	if err := client.Get(ctx, namespacedName, secret); err != nil {
		return nil, err
	}

	v, ok := secret.Data[string(secretRef.KeyPath)]
	if !ok {
		return nil, fmt.Errorf("secret %s does not have key %s", namespacedName.String(), secretRef.KeyPath)
	}

	return v, nil
}

```

### Core Architecture Module: `api/v1alpha1/datastore_types.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

//+kubebuilder:validation:Enum=etcd;MySQL;PostgreSQL;NATS
//+kubebuilder:validation:XValidation:rule="self == oldSelf",message="Datastore driver is immutable"

type Driver string

var (
	EtcdDriver           Driver = "etcd"
	KineMySQLDriver      Driver = "MySQL"
	KinePostgreSQLDriver Driver = "PostgreSQL"
	KineNatsDriver       Driver = "NATS"
)

//+kubebuilder:validation:MinItems=1
//+kubebuilder:validation:MaxItems=64
//+kubebuilder:validation:items:MaxLength=256
//+kubebuilder:validation:XValidation:rule="self.all(e, e.startsWith('[') || e.split(':').size() <= 2)",message="an IPv6 endpoint address must be bracketed, e.g. [2001:db8::1]:2379"

type Endpoints []string

// DataStoreSpec defines the desired state of DataStore.
// +kubebuilder:validation:XValidation:rule="(self.driver == \"etcd\") ? (self.tlsConfig != null && (has(self.tlsConfig.certificateAuthority.privateKey.secretReference) || has(self.tlsConfig.certificateAuthority.privateKey.content))) : true", message="certificateAuthority privateKey must have secretReference or content when driver is etcd"
// +kubebuilder:validation:XValidation:rule="(self.driver == \"etcd\") ? (self.tlsConfig != null && (has(self.tlsConfig.clientCertificate.certificate.secretReference) || has(self.tlsConfig.clientCertificate.certificate.content))) : true", message="clientCertificate must have secretReference or content when driver is etcd"
// +kubebuilder:validation:XValidation:rule="(self.driver == \"etcd\") ? (self.tlsConfig != null && (has(self.tlsConfig.clientCertificate.privateKey.secretReference) || has(self.tlsConfig.clientCertificate.privateKey.content))) : true", message="clientCertificate privateKey must have secretReference or content when driver is etcd"
// +kubebuilder:validation:XValidation:rule="(self.driver != \"etcd\" && has(self.tlsConfig) && has(self.tlsConfig.clientCertificate)) ? (((has(self.tlsConfig.clientCertificate.certificate.secretReference) || has(self.tlsConfig.clientCertificate.certificate.content)))) : true", message="When driver is not etcd and tlsConfig exists, clientCertificate must be null or contain valid content"
// +kubebuilder:validation:XValidation:rule="(self.driver != \"etcd\" && has(self.basicAuth)) ? ((has(self.basicAuth.username.secretReference) || has(self.basicAuth.username.content))) : true", message="When driver is not etcd and basicAuth exists, username must have secretReference or content"
// +kubebuilder:validation:XValidation:rule="(self.driver != \"etcd\" && has(self.basicAuth)) ? ((has(self.basicAuth.password.secretReference) || has(self.basicAuth.password.content))) : true", message="When driver is not etcd and basicAuth exists, password must have secretReference or content"
// +kubebuilder:validation:XValidation:rule="(self.driver != \"etcd\") ? (has(self.tlsConfig) || has(self.basicAuth)) : true", message="When driver is not etcd, either tlsConfig or basicAuth must be provided"
// +kubebuilder:validation:XValidation:rule="oldSelf == null || self.driver == oldSelf.driver", message="driver is immutable and cannot be changed after creation"
type DataStoreSpec struct {
	// The driver to use to connect to the shared datastore.
	Driver Driver `json:"driver"`
	// List of the endpoints to connect to the shared datastore.
	// No need for protocol, just bare IP/FQDN and port.
	Endpoints Endpoints `json:"endpoints"`
	// In case of authentication enabled for the given data store, specifies the username and password pair.
	// This value is optional.
	BasicAuth *BasicAuth `json:"basicAuth,omitempty"`
	// Defines the TLS/SSL configuration required to connect to the data store in a secure way.
	// This value is optional.
	TLSConfig *TLSConfig `json:"tlsConfig,omitempty"`
}

// TLSConfig contains the information used to connect to the data store using a secured connection.
type TLSConfig struct {
	// Retrieve the Certificate Authority certificate and private key, such as bare content of the file, or a SecretReference.
	// The key reference is required since etcd authentication is based on certificates, and Kamaji is responsible in creating this.
	CertificateAuthority CertKeyPair `json:"certificateAuthority"`
	// Specifies the SSL/TLS key and private key pair used to connect to the data store.
	ClientCertificate *ClientCertificate `json:"clientCertificate,omitempty"`
}

type ClientCertificate struct {
	Certificate ContentRef `json:"certificate"`
	PrivateKey  ContentRef `json:"privateKey"`
}

type CertKeyPair struct {
	Certificate ContentRef  `json:"certificate"`
	PrivateKey  *ContentRef `json:"privateKey,omitempty"`
}

// BasicAuth contains the required information to perform the connection using user credentials to the data store.
type BasicAuth struct {
	Username ContentRef `json:"username"`
	Password ContentRef `json:"password"`
}

type ContentRef struct {
	// Bare content of the file, base64 encoded.
	// It has precedence over the SecretReference value.
	Content   []byte           `json:"content,omitempty"`
	SecretRef *SecretReference `json:"secretReference,omitempty"`
}

// +kubebuilder:validation:MinLength=1
type secretReferKeyPath string

type SecretReference struct {
	corev1.SecretReference `json:",inline"`
	// Name of the key for the given Secret reference where the content is stored.
	// This value is mandatory.
	KeyPath secretReferKeyPath `json:"keyPath"`
}

const (
	DataStoreTCPFinalizer = "kamaji.clastix.io/TenantControlPlane"

	DataStoreConditionValidType           = "kamaji.clastix.io/DataStoreValidation"
	DataStoreConditionAllowedDeletionType = "kamaji.clastix.io/DataStoreAllowedDeletion"
)

// DataStoreStatus defines the observed state of DataStore.
type DataStoreStatus struct {
	// ObservedGeneration represents the .metadata.generation that was last reconciled.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
	// List of the Tenant Control Planes, namespaced named, using this data store.
	UsedBy []string `json:"usedBy,omitempty"`
	// Conditions contains the validation conditions for the given Datastore.
	Conditions []metav1.Condition `json:"conditions,omitempty"`
	// Ready returns if the DataStore is accepted and ready to get used:
	// Kamaji will ensure certificates are available, or correctly referenced.
	Ready bool `json:"ready"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:resource:scope=Cluster
//+kubebuilder:printcolumn:name="Driver",type="string",JSONPath=".spec.driver",description="Kamaji data store driver"
//+kubebuilder:printcolumn:name="Ready",type="boolean",JSONPath=".status.ready",description="DataStore validated and ready for use"
//+kubebuilder:printcolumn:name="Age",type="date",JSONPath=".metadata.creationTimestamp",description="Age"
//+kubebuilder:metadata:annotations={"cert-manager.io/inject-ca-from=kamaji-system/kamaji-serving-cert"}

// DataStore is the Schema for the datastores API.
type DataStore struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   DataStoreSpec   `json:"spec,omitempty"`
	Status DataStoreStatus `json:"status,omitempty"`
}

//+kubebuilder:object:root=true

// DataStoreList contains a list of DataStore.
type DataStoreList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []DataStore `json:"items"`
}

```

### Core Architecture Module: `api/v1alpha1/groupversion_info.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

// Package v1alpha1 contains API Schema definitions for the kamaji v1alpha1 API group
// +kubebuilder:object:generate=true
// +groupName=kamaji.clastix.io
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	// GroupVersion is group version used to register these objects.
	GroupVersion = schema.GroupVersion{Group: "kamaji.clastix.io", Version: "v1alpha1"}

	// SchemeBuilder is used to add go types to the GroupVersionKind scheme.
	SchemeBuilder = runtime.NewSchemeBuilder(func(scheme *runtime.Scheme) error {
		scheme.AddKnownTypes(GroupVersion,
			&DataStore{}, &DataStoreList{},
			&TenantControlPlane{}, &TenantControlPlaneList{},
			&KubeconfigGenerator{}, &KubeconfigGeneratorList{},
		)

		metav1.AddToGroupVersion(scheme, GroupVersion)

		return nil
	})

	// AddToScheme adds the types in this group-version to the given scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

```

### Core Architecture Module: `api/v1alpha1/indexer_datastore_usedsecret.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

import (
	"context"
	"fmt"

	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	DatastoreUsedSecretNamespacedNameKey = "secretRef"
)

type DatastoreUsedSecret struct{}

func (d *DatastoreUsedSecret) SetupWithManager(ctx context.Context, mgr controllerruntime.Manager) error {
	return mgr.GetFieldIndexer().IndexField(ctx, d.Object(), d.Field(), d.ExtractValue())
}

func (d *DatastoreUsedSecret) Object() client.Object {
	return &DataStore{}
}

func (d *DatastoreUsedSecret) Field() string {
	return DatastoreUsedSecretNamespacedNameKey
}

func (d *DatastoreUsedSecret) ExtractValue() client.IndexerFunc {
	return func(object client.Object) (res []string) {
		ds := object.(*DataStore) //nolint:forcetypeassert

		if ds.Spec.BasicAuth != nil {
			if ds.Spec.BasicAuth.Username.SecretRef != nil {
				res = append(res, d.namespacedName(*ds.Spec.BasicAuth.Username.SecretRef))
			}

			if ds.Spec.BasicAuth.Password.SecretRef != nil {
				res = append(res, d.namespacedName(*ds.Spec.BasicAuth.Password.SecretRef))
			}
		}

		if ds.Spec.TLSConfig != nil {
			if ds.Spec.TLSConfig.CertificateAuthority.Certificate.SecretRef != nil {
				res = append(res, d.namespacedName(*ds.Spec.TLSConfig.CertificateAuthority.Certificate.SecretRef))
			}

			if ds.Spec.TLSConfig.CertificateAuthority.PrivateKey != nil && ds.Spec.TLSConfig.CertificateAuthority.PrivateKey.SecretRef != nil {
				res = append(res, d.namespacedName(*ds.Spec.TLSConfig.CertificateAuthority.PrivateKey.SecretRef))
			}

			if ds.Spec.TLSConfig.ClientCertificate != nil {
				if ds.Spec.TLSConfig.ClientCertificate.Certificate.SecretRef != nil {
					res = append(res, d.namespacedName(*ds.Spec.TLSConfig.ClientCertificate.Certificate.SecretRef))
				}

				if ds.Spec.TLSConfig.ClientCertificate.PrivateKey.SecretRef != nil {
					res = append(res, d.namespacedName(*ds.Spec.TLSConfig.ClientCertificate.PrivateKey.SecretRef))
				}
			}
		}

		return res
	}
}

func (d *DatastoreUsedSecret) namespacedName(ref SecretReference) string {
	return fmt.Sprintf("%s/%s", ref.Namespace, ref.Name)
}

```

### Core Architecture Module: `api/v1alpha1/indexer_gateway_listener.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

import (
	"context"
	"fmt"

	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

const (
	GatewayListenerNameKey = "spec.listeners.name"
)

type GatewayListener struct{}

func (g *GatewayListener) Object() client.Object {
	return &gatewayv1.Gateway{}
}

func (g *GatewayListener) Field() string {
	return GatewayListenerNameKey
}

func (g *GatewayListener) ExtractValue() client.IndexerFunc {
	return func(object client.Object) []string {
		gateway := object.(*gatewayv1.Gateway) //nolint:forcetypeassert

		listenerNames := make([]string, 0, len(gateway.Spec.Listeners))
		for _, listener := range gateway.Spec.Listeners {
			// Create a composite key: namespace/gatewayName/listenerName
			// This allows us to look up gateways by listener name while ensuring uniqueness
			key := fmt.Sprintf("%s/%s/%s", gateway.Namespace, gateway.Name, listener.Name)
			listenerNames = append(listenerNames, key)
		}

		return listenerNames
	}
}

func (g *GatewayListener) SetupWithManager(ctx context.Context, mgr controllerruntime.Manager) error {
	return mgr.GetFieldIndexer().IndexField(ctx, g.Object(), g.Field(), g.ExtractValue())
}

```

### Core Architecture Module: `api/v1alpha1/indexer_tenantcontrolplane_useddatastore.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

import (
	"context"

	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	TenantControlPlaneUsedDataStoreKey = "status.storage.dataStoreName"
)

type TenantControlPlaneStatusDataStore struct{}

func (t *TenantControlPlaneStatusDataStore) Object() client.Object {
	return &TenantControlPlane{}
}

func (t *TenantControlPlaneStatusDataStore) Field() string {
	return TenantControlPlaneUsedDataStoreKey
}

func (t *TenantControlPlaneStatusDataStore) ExtractValue() client.IndexerFunc {
	return func(object client.Object) []string {
		tcp := object.(*TenantControlPlane) //nolint:forcetypeassert

		return []string{tcp.Status.Storage.DataStoreName}
	}
}

func (t *TenantControlPlaneStatusDataStore) SetupWithManager(ctx context.Context, mgr controllerruntime.Manager) error {
	return mgr.GetFieldIndexer().IndexField(ctx, t.Object(), t.Field(), t.ExtractValue())
}

```

### Core Architecture Module: `api/v1alpha1/kubeconfiggenerator_types.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	ManagedByLabel  = "kamaji.clastix.io/managed-by"
	ManagedForLabel = "kamaji.clastix.io/managed-for"
)

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:printcolumn:name="Age",type="date",JSONPath=".metadata.creationTimestamp",description="Age"
//+kubebuilder:metadata:annotations={"cert-manager.io/inject-ca-from=kamaji-system/kamaji-serving-cert"}
//+kubebuilder:resource:scope=Cluster,shortName=kc,categories=kamaji

// KubeconfigGenerator is the Schema for the kubeconfiggenerators API.
type KubeconfigGenerator struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   KubeconfigGeneratorSpec   `json:"spec,omitempty"`
	Status KubeconfigGeneratorStatus `json:"status,omitempty"`
}

// CompoundValue allows defining a static, or a dynamic value.
// Options are mutually exclusive, just one should be picked up.
// +kubebuilder:validation:XValidation:rule="(has(self.stringValue) || has(self.fromDefinition)) && !(has(self.stringValue) && has(self.fromDefinition))",message="Either stringValue or fromDefinition must be set, but not both."
type CompoundValue struct {
	// StringValue is a static string value.
	StringValue string `json:"stringValue,omitempty"`
	// FromDefinition is used to generate a dynamic value,
	// it uses the dot notation to access fields from the referenced TenantControlPlane object:
	// e.g.: metadata.name
	FromDefinition string `json:"fromDefinition,omitempty"`
}

type KubeconfigGeneratorSpec struct {
	// NamespaceSelector is used to filter Namespaces from which the generator should extract TenantControlPlane objects.
	NamespaceSelector metav1.LabelSelector `json:"namespaceSelector,omitempty"`
	// TenantControlPlaneSelector is used to filter the TenantControlPlane objects that should be address by the generator.
	TenantControlPlaneSelector metav1.LabelSelector `json:"tenantControlPlaneSelector,omitempty"`
	// Groups is resolved a set of strings used to assign the x509 organisations field.
	// It will be recognised by Kubernetes as user groups.
	Groups []CompoundValue `json:"groups,omitempty"`
	// User resolves to a string to identify the client, assigned to the x509 Common Name field.
	User CompoundValue `json:"user"`
	// ControlPlaneEndpointFrom is the key used to extract the Tenant Control Plane endpoint that must be used by the generator.
	// The targeted Secret is the `${TCP}-admin-kubeconfig` one, default to `admin.svc`.
	//+kubebuilder:default="admin.svc"
	ControlPlaneEndpointFrom string `json:"controlPlaneEndpointFrom,omitempty"`
}

type KubeconfigGeneratorStatusError struct {
	// Resource is the Namespaced name of the errored resource.
	//+kubebuilder:validation:Required
	Resource string `json:"resource"`
	// Message is the error message recorded upon the last generator run.
	//+kubebuilder:validation:Required
	Message string `json:"message"`
}

// KubeconfigGeneratorStatus defines the observed state of KubeconfigGenerator.
type KubeconfigGeneratorStatus struct {
	// ObservedGeneration represents the .metadata.generation that was last reconciled.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
	// Resources is the sum of targeted TenantControlPlane objects.
	//+kubebuilder:default=0
	Resources int `json:"resources"`
	// AvailableResources is the sum of successfully generated resources.
	// In case of a different value compared to Resources, check the field errors.
	//+kubebuilder:default=0
	AvailableResources int `json:"availableResources"`
	// Errors is the list of failed kubeconfig generations.
	Errors []KubeconfigGeneratorStatusError `json:"errors,omitempty"`
}

//+kubebuilder:object:root=true

// KubeconfigGeneratorList contains a list of TenantControlPlane.
type KubeconfigGeneratorList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []KubeconfigGenerator `json:"items"`
}

```

### Core Architecture Module: `api/v1alpha1/tenantcontrolplane_const.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package v1alpha1

const (
	// PausedReconciliationAnnotation is an annotation that can be applied to
	// Tenant Control Plane objects to prevent the controller from processing such a resource.
	PausedReconciliationAnnotation = "kamaji.clastix.io/paused"

	// DefaultKubernetesVersion is the default Kubernetes version used in e2e tests.
	DefaultKubernetesVersion = "v1.37.0"
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1299** (2026-09-10): **kamaji_handler_time_seconds: two kubeconfig handler labels are never exported**
  *Symptoms*: ## What happens  `kamaji_handler_time_seconds` never exposes the label values `handler="controller-manager-kubeconfig"` and `handler="scheduler-kubeconfig"`. Their observations are attributed to `handler="admin-kubeconfig"` instead, so that label reports 4x the invocations of every other handler.  From a production Kamaji managing 735 ready TenantControlPlanes:  ```    122548  handler=admin-kubeconfig        <- 4 x     30673  handler=upgrade     30637  handler=konnectivity-kubeconfig     30637  handler=ca     30637  handler=kubeadmconfig     ... (controller-manager-kubeconfig and scheduler-kubeconfig: no series at all) ```  The effect is that the kubeconfig handlers cannot be told apart in dashboards or alerts, and `admin-kubeconfig` looks like it does four times the work it actually does. It cost me a wrong conclusion while investigating something else, which is why I chased it down.  ## Why  `controllers/resources.go` declares four `KubeconfigResource` instances with three distinct names:  ```go &resources.KubeconfigResource{Name: "admin-kubeconfig",              KubeConfigFileName: resources.AdminKubeConfigFileName}, &resources.KubeconfigResource{Name: "admin-kubeconfig",              KubeConfigFileName: resources.SuperAdminKubeConfigFileName}, &resources.KubeconfigResource{Name: "controller-manager-kubeconfig", KubeConfigFileName: resources.ControllerManagerKubeConfigFileName}, &resources.KubeconfigResource{Name: "scheduler-kubeconfig",          KubeConfigFileName: resour

- **Issue #1294** (2026-09-09): **Allow configuring resources for the Konnectivity agent**
  *Symptoms*: # Allow configuring resources for the Konnectivity agent  ## Summary  `KonnectivityServerSpec` exposes `Resources`, but `KonnectivityAgentSpec` does not. The agent container is therefore created with no requests and no limits, which places every agent Pod in the **BestEffort** QoS class with no supported way to change it.  On a busy cluster this makes the agent the first thing the kubelet starves of CPU and the first thing it evicts — degrading the tunnel that `kubectl exec`, `kubectl logs` and `kubectl port-forward` depend on, while the cluster otherwise looks healthy.  ## What we saw  On a 115-node GPU cluster (hosted control plane, agents in `DaemonSet` mode with `hostNetwork: true` and `tolerations: [{operator: Exists}]`), users began reporting:  ``` error: unable to upgrade connection: ... ```  on `kubectl exec`, intermittently and under load. Ordinary API reads were unaffected throughout, so nothing looked wrong from the outside.  What we found:  **1. konnectivity-server was shedding agent traffic.** Its log carried, across 16 distinct `agentID`s inside a 45-second window:  ``` server.go:841] "Receive channel from agent is full" agentID="..." ```  interleaved with streams being set up and torn down almost immediately:  ``` server.go:934] "Proxy connection established" ... dialAddress="<node>:10250" dialDuration="2.4ms" server.go:523] "Stream read from frontend cancelled" userAgent=["grpc-go/1.72.2"] server.go:990] "could not get frontend client for closing" agentID="...

- **Issue #1282** (2026-09-12): **preferredAddressTypes is declared +listType=set but its order is significant**
  *Symptoms*: ## What  `TenantControlPlaneSpec.kubernetes.kubelet.preferredAddressTypes` is declared as a `set`:  ```go // Ordered list of the preferred NodeAddressTypes to use for kubelet connections. // Default to InternalIP, ExternalIP, Hostname. //+kubebuilder:default={"InternalIP","ExternalIP","Hostname"} //+kubebuilder:validation:MinItems=1 //+listType=set PreferredAddressTypes []KubeletPreferredAddressType `json:"preferredAddressTypes,omitempty"` ```  The marker came in with #812 ("relying on k8s list set for unique items") to get server-side uniqueness validation for free. It does that — but `x-kubernetes-list-type: set` declares the entries to be an *unordered* collection, and the order of this list is part of its meaning. It is also the only `listType=set` in the API today.  ## The order is significant  - The godoc says so: "**Ordered** list of the preferred NodeAddressTypes to use for kubelet connections." - Kamaji joins the entries in order into the API server flag (`internal/builders/controlplane/deployment.go:729`):   ```go   "--kubelet-preferred-address-types": strings.Join(kubeletPreferredAddressTypes, ","),   ``` - The API server walks that list in order and takes the first address type the node reports (`k8s.io/kubernetes/pkg/util/node/node.go`):   ```go   func GetPreferredNodeAddress(node *v1.Node, preferredAddressTypes []v1.NodeAddressType) (string, error) {       for _, addressType := range preferredAddressTypes {           for _, address := range node.Status.Addresses

- **Issue #1281** (2026-09-12): **Non-deterministic ordering of `kube-apiserver` flags causes an extra, no-op rollout of every TenantControlPlane**
  *Symptoms*: ## Summary  Creating a `TenantControlPlane` produces **three** ReplicaSets and takes the Deployment to `generation: 3`, within a few seconds. Two of the three rollouts are expected-ish; the third is not.  The pod template of revision 3 differs from revision 2 **only in the order of the `kube-apiserver` container's args**. Same flags, same values, different positions — which changes the pod-template hash, so the Deployment controller rolls every control-plane pod a second time for no functional change.  On a 2-replica control plane this discards pods that have already been scheduled and started.  ## Environment  | | | |---|---| | Kamaji | `clastix/kamaji:26.8.3-edge` (chart `kamaji-0.0.0_latest`) | | Management cluster | Kubernetes v1.36.2 | | Datastore | etcd | | Tenant version | v1.30.2 |  ## Reproduce  Create any `TenantControlPlane` **with konnectivity enabled** and 2 replicas:  ```yaml apiVersion: kamaji.clastix.io/v1alpha1 kind: TenantControlPlane metadata:   name: demo   namespace: my-project spec:   dataStore: my-datastore   controlPlane:     deployment:       replicas: 2     service:       serviceType: ClusterIP   kubernetes:     version: v1.30.2     kubelet:       cgroupfs: systemd   networkProfile:     podCidr: 10.244.0.0/16     serviceCidr: 10.96.0.0/16   addons:     coreDNS: {}     kubeProxy: {}     konnectivity:       server:         port: 8132 ```  Then, a few seconds later:  ```console $ kubectl -n my-project get rs NAME             DESIRED   CURRENT   READY   

- **Issue #1200** (2026-06-27): **Datastore etcd certificate rotation does not trigger kube-apiserver pod rollout**
  *Symptoms*: When the datastore CA secret is updated, Kamaji correctly regenerates the etcd client certificate for each TenantControlPlane and updates the `Storage.Certificate.Checksum` in the TCP status (`internal/resources/datastore/datastore_certificate.go:82`). The TenantControlPlane controller is triggered via `TenantControlPlaneTrigger` channel (`controllers/datastore_controller.go:147`) and re-enters reconciliation.  However, the Deployment's PodTemplate is never modified, so no rollout occurs:  - The PodTemplate annotation `storage.kamaji.clastix.io/config` references only `Status.Storage.Config.Checksum` (`internal/builders/controlplane/deployment.go:84`). The `Storage.Certificate.Checksum` is not included. - The `templateLabels()` function (`internal/builders/controlplane/deployment.go:1150-1172`) includes MD5 hashes for all internal PKI certificate secrets (CA, API server, front-proxy, SA, kubeconfigs) but **not** for the datastore certificate secret (`tcp.Status.Storage.Certificate.SecretName`).  As a result, when the etcd mTLS certificate is rotated: 1. The new certificate is written into the tenant's `datastore-certificate` Secret. 2. Kubelet updates the projected volume files inside the running pod. 3. But **kube-apiserver does not reload** `--etcd-certfile`/`--etcd-keyfile` at runtime — it reads them only at startup. 4. The Deployment is not rolled out, so the pod continues with the old certificate.  Please correct me if I'm wrong anywhere.  **Version:** `b3068f8` (tag `26
  **Post-Mortem & Fix Analysis**:
  > Thanks for the bug. I was able to get this replicated, and I already have the fix.

- **Issue #1197** (2026-06-24): **networkProfile.advertiseAddress accepts a hostname but silently breaks the API server (no validation + misleading docs)**
  *Symptoms*: ## Summary  `spec.networkProfile.advertiseAddress` is passed verbatim to the API server's `--advertise-address` flag, which only accepts an **IP address**. However:  1. There is **no validation** (neither CEL `XValidation` on the CRD nor a webhook)    rejecting a hostname in this field. 2. The **field documentation does not mention** that the value lands in    `--advertise-address`, and even implies hostname-friendly uses    (`ControlPlaneEndpoint`, `cluster-info`, `admin.conf`).  As a result, a user who sets a DNS name there gets a valid-looking resource that is accepted by the API, but the tenant `kube-apiserver` enters `CrashLoopBackOff` with an error that is three layers removed from the actual misconfiguration:  ``` Error: invalid argument "testhcp.kubeapi.example.com" for "--advertise-address" flag: failed to parse IP: "testhcp.kubeapi.example.com" ```  ## Steps to reproduce  1. Create a `TenantControlPlane` exposed via a `LoadBalancer` Service. 2. Set a DNS name instead of an IP:    ```yaml    spec:      networkProfile:        advertiseAddress: testhcp.kubeapi.example.com    ``` 3. The TCP is admitted without error. 4. The `kube-apiserver` container crashloops with the `failed to parse IP` error above.  ## Root cause  `advertiseAddress` is forwarded unmodified to `--advertise-address`:  `internal/builders/controlplane/deployment.go` (~L672-695): ```go // Use the advertiseAddress (tenant-facing VIP) for --advertise-address when set. apiAdvertiseAddress := address if adv
  **Post-Mortem & Fix Analysis**:
  > I like both proposals. Are you up to contributing to those? It seems Claude already did the work.

- **Issue #1192** (2026-06-23): **kube-scheduler / kube-controller-manager readiness probe config is accepted but silently ignored**
  *Symptoms*: ## Summary  The `TenantControlPlane` CRD exposes `spec.controlPlane.deployment.probes.scheduler.readiness` and `spec.controlPlane.deployment.probes.controllerManager.readiness` (as well as the global `probes.readiness`). For **kube-scheduler** and **kube-controller-manager** these fields are validated and accepted by the API server but have **no effect**: no readiness probe is ever rendered on those containers, and the configured override values are never applied. Only **kube-apiserver** actually receives a readiness probe.  As a result, a `kubectl apply` that sets `scheduler.readiness` (or `controllerManager.readiness`) validates successfully and then silently does nothing — a configuration foot-gun, with no warning event or log.  ## How it got here  PR #1086 ("expand configurable probes to all probe types") introduced the `Probes` configuration. Its commit message advertises *"liveness, readiness, and startup probes,"* and the generated CRD schema exposes a `readiness` block under `apiServer`, `controllerManager` **and** `scheduler` alike.  However, in the deployment builder the readiness wiring was only ever added for kube-apiserver. Scheduler and controller-manager got liveness + startup overrides only. The `readiness` field for these two components has **never had any effect since it was introduced** — it was not removed later, it was simply never wired up.  ## Root cause  In `internal/builders/controlplane/deployment.go`:  - `buildKubeAPIServer()` creates a base `Readin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the bug report, @Jakob3xD: definitely something we didn't pay attention to: it happens with external contributions.  We also appreciate the proactive PR: just wondering if you used any assisted AI tool to write the code, and if your contributions are provided individually or on behalf of Hetzner, being a Kamaji adopter/evaluator.
  > >We also appreciate the proactive PR: just wondering if you used any assisted AI tool to write the code, and if your contributions are provided individually or on behalf of Hetzner, being a Kamaji adopter/evaluator.  Yes, I used Claude-code for this. I am contributing this during my work time as I am currently evaluating/testing kamaji.
  > > Yes, I used Claude-code for this.  Thanks for being open to that: I regularly use AI tools, especially with complicated code bases like the Kamaji one.  When dealing with AI, I prefer having Claude Code as a co-author: this would be relevant for our stats to determine the ownership of the code.

- **Issue #1190** (2026-06-24): **Soot manager keeps using stale admin kubeconfig after rotation by cert lifecycle controller**
  *Symptoms*: Soot [starts a long-lived manager per TCP using the TCP's admin kubeconfig](https://github.com/clastix/kamaji/blob/5e576071f010baa587f8de9027b66324dcea7af5/controllers/soot/manager.go#L238), and [only tears it down on CA rotation or NotReady status of the TCP](https://github.com/clastix/kamaji/blob/5e576071f010baa587f8de9027b66324dcea7af5/controllers/soot/manager.go#L183).  The NotReady status of the TCP is set [when readyReplicas of the TCP deployment is equal to 0](https://github.com/clastix/kamaji/blob/5e576071f010baa587f8de9027b66324dcea7af5/internal/resources/k8s_deployment_resource.go#L159). With the default blue/green deployment strategy of maxSurge 100% and maxUnavailable 0, a running TCP deployment would never reach readyReplicas 0 during rollout under normal conditions, and thus would never reach NotReady status.  Now when a cert/kubeconfig rotation happens (without a CA rotation, so with the original CA), this causes the existing Soot manager to keep running using expired credentials until Kamaji is restarted.  A possible solution could be to include the admin kubeconfig checksum in the sootMap and  `case tcp.Status.KubeConfig.Admin.Checksum != "" && tcp.Status.KubeConfig.Admin.Checksum != v.kubeconfigChecksum` -> m.cleanup.  If this checks out i will gladly file a PR with a fix.
  **Post-Mortem & Fix Analysis**:
  > @hrak thanks for the bug report. I already raised a PR, wondering if it's the same you thought of.
  > Yes, exactly. Thanks very much!

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

### Incident Patch 1: `6572a053` (2026-09-24)
**Commit Message**: fix(manager): add webhook readyz check (#1324)

**File**: `cmd/manager/cmd.go` (modified, +5/-0)
```diff
@@ -305,6 +305,11 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 
 				return err
 			}
+			if err = mgr.AddReadyzCheck("webhook", mgr.GetWebhookServer().StartedChecker()); err != nil {
+				setupLog.Error(err, "unable to set up webhook ready check")
+
+				return err
+			}
 
 			setupLog.Info("starting manager")
 			if err = mgr.Start(ctx); err != nil {
```

---

### Incident Patch 2: `baa99fb2` (2026-09-15)
**Commit Message**: Fix README.md link (#1316)

This MR fixes a broken link to the https://clastix.io/post/the-rise-of-hosted-control-plane-in-kubernetes/ article.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 ### 🤔 What is Kamaji?
 
-**Kamaji** is the **Kubernetes Control Plane Manager** leveraging on the concept of [**Hosted Control Plane**](https://clastix.io/post/the-raise-of-hosted-control-plane-in-kubernetes/).
+**Kamaji** is the **Kubernetes Control Plane Manager** leveraging on the concept of [**Hosted Control Plane**](https://clastix.io/post/the-rise-of-hosted-control-plane-in-kubernetes/).
 
 Kamaji's approach is based on running the Kubernetes Control Plane components in Pods instead of dedicated machines.
 This allows operating Kubernetes clusters at scale, with a fraction of the operational burden.
```

---

### Incident Patch 3: `b45878e6` (2026-09-12)
**Commit Message**: fix(konnectivity): render egress selector flag in deterministic position (#1311)

The egress selector config flag was appended at the end of the
kube-apiserver args by the Konnectivity addon builder, while the
deployment builder re-emitted foreign flags inside its sorted
Kamaji-owned segment. The two serialisations of the same command line
changed the pod template hash on the reconcile after the addon was
applied, causing an extra no-op rollout of every TenantControlPlane.

The flag is now rendered as a managed flag, in sorted position, from
the very first deployment build, making the rendered args a
deterministic function of the TenantControlPlane spec.

Closes #1281

**File**: `internal/builders/controlplane/deployment.go` (modified, +9/-2)
```diff
@@ -763,6 +763,13 @@ func (d Deployment) buildKubeAPIServerCommand(tenantControlPlane kamajiv1alpha1.
 	if len(d.DataStoreOverrides) != 0 {
 		managed["--etcd-servers-overrides"] = d.etcdServersOverrides()
 	}
+	// The Konnectivity addon flag is rendered together with the managed flags,
+	// in sorted position, so that the argument list is deterministic from the
+	// first reconcile pass. Appending it later (as done previously) caused a
+	// second, no-op rollout of every TenantControlPlane (clastix/kamaji#1281).
+	if tenantControlPlane.Spec.Addons.Konnectivity != nil {
+		managed[egressSelectorConfigurationFlag] = konnectivityEgressSelectorConfigurationPath
+	}
 
 	return mergeAPIServerArgs(current, userExtras, safeDefaults, managed)
 }
@@ -772,8 +779,8 @@ func (d Deployment) buildKubeAPIServerCommand(tenantControlPlane kamajiv1alpha1.
 // - user ExtraArgs are preserved verbatim, duplicates included for repeatable flags;
 // - safe defaults fill in only for flag names the user didn't provide.
 //
-// Flags already on the container that Kamaji doesn't own and the user didn't set are kept
-// (e.g. --egress-selector-config-file injected by the Konnectivity addon).
+// Flags already on the container that Kamaji doesn't own and the user didn't set are kept,
+// e.g. flags injected by addons on a previous pass.
 func mergeAPIServerArgs(current, userExtras []string, safeDefaults, managed map[string]string) []string {
 	userFlags := sets.New[string]()
 	// sanitizedExtras will contain the userExtras arguments,
```

**File**: `internal/builders/controlplane/deployment_test.go` (modified, +41/-0)
```diff
@@ -4,6 +4,7 @@
 package controlplane
 
 import (
+	"slices"
 	"testing"
 
 	. "github.com/onsi/ginkgo/v2"
@@ -207,6 +208,46 @@ var _ = Describe("Controlplane Deployment", func() {
 		})
 	})
 
+	Describe("Konnectivity egress selector flag", func() {
+		var tcp kamajiv1alpha1.TenantControlPlane
+
+		JustBeforeEach(func() {
+			tcp = kamajiv1alpha1.TenantControlPlane{}
+			tcp.Spec.Addons.Konnectivity = &kamajiv1alpha1.KonnectivitySpec{}
+			tcp.Spec.NetworkProfile.Port = 7443
+		})
+
+		It("renders the flag in sorted position when the addon is enabled", func() {
+			got := d.buildKubeAPIServerCommand(tcp, "1.2.3.4", nil)
+
+			Expect(got).To(ContainElement(egressSelectorConfigurationFlag + "=" + konnectivityEgressSelectorConfigurationPath))
+			Expect(slices.IsSorted(got)).To(BeTrue())
+			// In the sorted segment, the egress selector flag lands between
+			// --client-ca-file and --enable-admission-plugins.
+			Expect(utilities.ArgsFromSliceToMap(got)).To(HaveKey(egressSelectorConfigurationFlag))
+		})
+
+		It("omits the flag when the addon is disabled", func() {
+			tcp.Spec.Addons.Konnectivity = nil
+
+			got := d.buildKubeAPIServerCommand(tcp, "1.2.3.4", nil)
+
+			Expect(got).NotTo(ContainElement(ContainSubstring(egressSelectorConfigurationFlag + "=")))
+		})
+
+		It("is deterministic across reconciler passes, regardless of the current args ordering", func() {
+			first := d.buildKubeAPIServerCommand(tcp, "1.2.3.4", nil)
+			// Simulate the previous buggy flow: the addon appended the flag at
+			// the end of the rendered args on a second pass.
+			dst := slices.Clone(first)
+			dst = append(dst, egressSelectorConfigurationFlag+"="+konnectivityEgressSelectorConfigurationPath)
+			// The next reconcile must not reorder the flags: same spec, same args.
+			second := d.buildKubeAPIServerCommand(tcp, "1.2.3.4", dst)
+
+			Expect(second).To(Equal(first))
+		})
+	})
+
 	Describe("control plane probes", func() {
 		// helper: find a container by name in a built PodSpec
 		containerByName := func(spec *corev1.PodSpec, name string) corev1.Container {
```

**File**: `internal/builders/controlplane/konnectivity_server.go` (modified, +6/-23)
```diff
@@ -23,6 +23,7 @@ const (
 	CertCommonName = "system:konnectivity-server"
 
 	konnectivityEgressSelectorConfigurationPath = "/etc/kubernetes/konnectivity/configurations/egress-selector-configuration.yaml"
+	egressSelectorConfigurationFlag             = "--egress-selector-config-file"
 	konnectivityServerName                      = "konnectivity-server"
 	konnectivityServerPath                      = "/run/konnectivity"
 
@@ -179,7 +180,7 @@ func (k Konnectivity) RemovingKubeAPIServerContainerArg(podSpec *corev1.PodSpec)
 	var parsedArgs []string
 
 	for _, v := range podSpec.Containers[index].Args {
-		if strings.HasPrefix(v, "--egress-selector-config-file") || strings.HasPrefix(v, "--egress-selector-config-file=") {
+		if strings.HasPrefix(v, egressSelectorConfigurationFlag) || strings.HasPrefix(v, egressSelectorConfigurationFlag+"=") {
 			continue
 		}
 
@@ -205,28 +206,10 @@ func (k Konnectivity) buildVolumeMounts(podSpec *corev1.PodSpec) {
 	if !found {
 		return
 	}
-	// Adding the egress selector config file flag:
-	// we can't rely on maps since not preserving order of arguments,
-	// api-server has sensitive parameters.
-	egressConfigFlag := fmt.Sprintf("--egress-selector-config-file=%s", konnectivityEgressSelectorConfigurationPath)
-
-	var foundFlag bool
-
-	for i, v := range podSpec.Containers[index].Args {
-		if !strings.HasPrefix(v, "--egress-selector-config-file") {
-			continue
-		}
-
-		if v != egressConfigFlag {
-			podSpec.Containers[index].Args[i] = egressConfigFlag
-		}
-
-		foundFlag = true
-	}
-
-	if !foundFlag {
-		podSpec.Containers[index].Args = append(podSpec.Containers[index].Args, egressConfigFlag)
-	}
+	// The --egress-selector-config-file flag is rendered by the kube-apiserver
+	// command builder as a managed flag once the Konnectivity addon is enabled,
+	// so that the resulting argument list stays deterministic from the very
+	// first reconcile pass (no reordering on subsequent reconciles).
 
 	vFound, vIndex := false, 0 //nolint:wastedassign
 	// Patching the volume mounts
```

---

### Incident Patch 4: `01914220` (2026-09-12)
**Commit Message**: fix(api): preferredAddressTypes is an ordered list (#1315)

The field was declared +listType=set, which tells the API server the
entries are an unordered collection. The order is significant: it is
joined verbatim into --kubelet-preferred-address-types and the API server
uses the first address type a node reports. Under server-side apply,
structured-merge-diff interleaves a set with the live object rather than
taking the applier's list, so a second field manager owning entries in
the same list loses its ordering silently.

Declare the list atomic, keeping the uniqueness the set marker gave with
a CEL rule.

Closes #1282

**File**: `api/v1alpha1/kubelet_preferred_address_types_test.go` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package v1alpha1
+
+import (
+	"context"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+var _ = Describe("Kubelet preferredAddressTypes", func() {
+	var (
+		ctx context.Context
+		tcp *TenantControlPlane
+	)
+
+	BeforeEach(func() {
+		ctx = context.Background()
+		tcp = &TenantControlPlane{
+			ObjectMeta: metav1.ObjectMeta{
+				Name:      "tcp-preferred-address-types",
+				Namespace: "default",
+			},
+			Spec: TenantControlPlaneSpec{},
+		}
+		tcp.Spec.ControlPlane.Service.ServiceType = ServiceTypeClusterIP
+	})
+
+	AfterEach(func() {
+		if err := k8sClient.Delete(ctx, tcp); err != nil && !apierrors.IsNotFound(err) {
+			Expect(err).NotTo(HaveOccurred())
+		}
+	})
+
+	It("keeps the applied order when a second field manager owns entries too", func() {
+		apply := func(manager string, addressTypes ...KubeletPreferredAddressType) {
+			obj := &TenantControlPlane{
+				TypeMeta:   metav1.TypeMeta{APIVersion: GroupVersion.String(), Kind: "TenantControlPlane"},
+				ObjectMeta: metav1.ObjectMeta{Name: tcp.Name, Namespace: tcp.Namespace},
+			}
+			obj.Spec.ControlPlane.Service.ServiceType = ServiceTypeClusterIP
+			obj.Spec.Kubernetes.Kubelet.PreferredAddressTypes = addressTypes
+
+			Expect(k8sClient.Patch(ctx, obj, client.Apply, client.FieldOwner(manager), client.ForceOwnership)).ToNot(HaveOccurred())
+		}
+
+		apply("manager-a", NodeInternalIP, NodeExternalIP, NodeHostName)
+		apply("manager-b", NodeHostName, NodeInternalDNS)
+
+		Expect(k8sClient.Get(ctx, types.NamespacedName{Name: tcp.Name, Namespace: tcp.Namespace}, tcp)).ToNot(HaveOccurred())
+		Expect(tcp.Spec.Kubernetes.Kubelet.PreferredAddressTypes).To(Equal([]KubeletPreferredAddressType{
+			NodeHostName, NodeInternalDNS,
+		}))
+	})
+
+	It("rejects duplicated entries", func() {
+		tcp.Spec.Kubernetes.Kubelet.PreferredAddressTypes = []KubeletPreferredAddressType{
+			NodeInternalIP, NodeExternalIP, NodeInternalIP,
+		}
+
+		err := k8sClient.Create(ctx, tcp)
+		Expect(err).To(HaveOccurred())
+		Expect(err.Error()).To(ContainSubstring("preferredAddressTypes entries must be unique"))
+	})
+})
```

**File**: `api/v1alpha1/tenantcontrolplane_types.go` (modified, +3/-1)
```diff
@@ -118,7 +118,9 @@ type KubeletSpec struct {
 	// Default to InternalIP, ExternalIP, Hostname.
 	//+kubebuilder:default={"InternalIP","ExternalIP","Hostname"}
 	//+kubebuilder:validation:MinItems=1
-	//+listType=set
+	//+kubebuilder:validation:MaxItems=5
+	//+kubebuilder:validation:XValidation:rule="self.all(x, self.exists_one(y, y == x))",message="preferredAddressTypes entries must be unique"
+	//+listType=atomic
 	PreferredAddressTypes []KubeletPreferredAddressType `json:"preferredAddressTypes,omitempty"`
 	// CGroupFS defines the cgroup driver for Kubelet
 	// https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/configure-cgroup-driver/
```

**File**: `charts/kamaji-crds/hack/kamaji.clastix.io_tenantcontrolplanes_spec.yaml` (modified, +5/-1)
```diff
@@ -8888,9 +8888,13 @@ versions:
                             - InternalDNS
                             - ExternalDNS
                           type: string
+                        maxItems: 5
                         minItems: 1
                         type: array
-                        x-kubernetes-list-type: set
+                        x-kubernetes-list-type: atomic
+                        x-kubernetes-validations:
+                          - message: preferredAddressTypes entries must be unique
+                            rule: self.all(x, self.exists_one(y, y == x))
                     type: object
                   version:
                     description: Kubernetes Version for the tenant control plane
```

**File**: `charts/kamaji/crds/kamaji.clastix.io_tenantcontrolplanes.yaml` (modified, +5/-1)
```diff
@@ -8896,9 +8896,13 @@ spec:
                               - InternalDNS
                               - ExternalDNS
                             type: string
+                          maxItems: 5
                           minItems: 1
                           type: array
-                          x-kubernetes-list-type: set
+                          x-kubernetes-list-type: atomic
+                          x-kubernetes-validations:
+                            - message: preferredAddressTypes entries must be unique
+                              rule: self.all(x, self.exists_one(y, y == x))
                       type: object
                     version:
                       description: Kubernetes Version for the tenant control plane
```

---

### Incident Patch 5: `02030999` (2026-09-10)
**Commit Message**: chore(samples): JSONPatch regression fix under TCP sample (#1310)

**File**: `config/samples/kamaji_v1alpha1_tenantcontrolplane.yaml` (modified, +4/-4)
```diff
@@ -1,25 +1,25 @@
 apiVersion: kamaji.clastix.io/v1alpha1
 kind: TenantControlPlane
 metadata:
-  name: k8s-133
+  name: k8s-136
   labels:
-    tenant.clastix.io: k8s-133
+    tenant.clastix.io: k8s-136
 spec:
   controlPlane:
     deployment:
       replicas: 2
     service:
       serviceType: LoadBalancer
   kubernetes:
-    version: "v1.35.7"
+    version: "v1.36.3"
     kubelet:
       configurationJSONPatches:
         - op: add
           path: /featureGates
           value:
             KubeletCrashLoopBackOffMax: false
             KubeletEnsureSecretPulledImages: false
-        - op: replace
+        - op: add
           path: /cgroupDriver
           value: systemd
   networkProfile:
```

---

### Incident Patch 6: `f149dbfe` (2026-09-10)
**Commit Message**: fix(networking)!: dual-stack / IPv6 correctness fixes (bind-address, CoreDNS, endpoint & CIDR validation) (#1308)

* fix(networking)!: default component bind-address to :: and set dual-stack node CIDR masks

kube-scheduler and kube-controller-manager now default --bind-address to the
IPv6 wildcard "::" (which also serves IPv4 on a dual-stack pod via v4-mapped
addresses on the default bindv6only=0), so an IPv6-only or dual-stack control
plane is reachable on its healthz/metrics endpoints. The scheduler now applies
extraArgs last (like kube-controller-manager) so the default is overridable; on
hosts with IPv6 disabled in the kernel, operators set 0.0.0.0 via extraArgs.

For a dual-stack pod network, kube-controller-manager also gets
--node-cidr-mask-size-ipv4/-ipv6 (24/64), since the legacy single mask flag
only covers one family. Both stay overridable.

BREAKING CHANGE: the default --bind-address for kube-scheduler and
kube-controller-manager changes from 0.0.0.0 to ::. It serves IPv4 too on the
default Linux bindv6only=0; only hosts where the IPv6 kernel module is disabled
at boot must override it back to 0.0.0.0 via
spec.controlPlane.deployment.extraArgs.

Co-authored-by: Claude <

**File**: `api/v1alpha1/cidr_families_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package v1alpha1
+
+import (
+	"context"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+)
+
+var _ = Describe("ServiceCIDRs and PodCIDRs IP families", func() {
+	var (
+		ctx context.Context
+		tcp *TenantControlPlane
+	)
+
+	BeforeEach(func() {
+		ctx = context.Background()
+		tcp = &TenantControlPlane{
+			ObjectMeta: metav1.ObjectMeta{GenerateName: "cidr-families-", Namespace: "default"},
+			Spec:       TenantControlPlaneSpec{},
+		}
+		tcp.Spec.ControlPlane.Service.ServiceType = ServiceTypeClusterIP
+	})
+
+	AfterEach(func() {
+		if tcp.GetName() != "" {
+			if err := k8sClient.Delete(ctx, tcp); err != nil && !apierrors.IsNotFound(err) {
+				Expect(err).NotTo(HaveOccurred())
+			}
+		}
+	})
+
+	It("accepts a single-stack serviceCidrs", func() {
+		tcp.Spec.NetworkProfile.ServiceCIDRs = []string{"10.96.0.0/16"}
+		Expect(k8sClient.Create(ctx, tcp)).To(Succeed())
+	})
+
+	It("accepts a dual-stack serviceCidrs", func() {
+		tcp.Spec.NetworkProfile.ServiceCIDRs = []string{"10.96.0.0/16", "fd00::/108"}
+		Expect(k8sClient.Create(ctx, tcp)).To(Succeed())
+	})
+
+	It("denies two same-family serviceCidrs", func() {
+		tcp.Spec.NetworkProfile.ServiceCIDRs = []string{"10.96.0.0/16", "10.97.0.0/16"}
+
+		err := k8sClient.Create(ctx, tcp)
+		Expect(err).To(HaveOccurred())
+		Expect(err.Error()).To(ContainSubstring("serviceCidrs must not contain two CIDRs of the same IP family"))
+	})
+
+	It("accepts a dual-stack podCidrs", func() {
+		tcp.Spec.NetworkProfile.PodCIDRs = []string{"10.244.0.0/16", "fd00:244::/56"}
+		Expect(k8sClient.Create(ctx, tcp)).To(Succeed())
+	})
+
+	It("denies two same-family podCidrs", func() {
+		tcp.Spec.NetworkProfile.PodCIDRs = []string{"fd00:244::/56", "fd00:245::/56"}
+
+		err := k8sClient.Create(ctx, tcp)
+		Expect(err).To(HaveOccurred())
+		Expect(err.Error()).To(ContainSubstring("podCidrs must not contain two CIDRs of the same IP family"))
+	})
+})
```

**File**: `api/v1alpha1/datastore_types.go` (modified, +3/-0)
```diff
@@ -21,6 +21,9 @@ var (
 )
 
 //+kubebuilder:validation:MinItems=1
+//+kubebuilder:validation:MaxItems=64
+//+kubebuilder:validation:items:MaxLength=256
+//+kubebuilder:validation:XValidation:rule="self.all(e, e.startsWith('[') || e.split(':').size() <= 2)",message="an IPv6 endpoint address must be bracketed, e.g. [2001:db8::1]:2379"
 
 type Endpoints []string
 
```

**File**: `api/v1alpha1/datastore_types_test.go` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package v1alpha1
+
+import (
+	"context"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+)
+
+var _ = Describe("DataStore endpoints validation", func() {
+	var (
+		ctx context.Context
+		ds  *DataStore
+	)
+
+	BeforeEach(func() {
+		ctx = context.Background()
+		ds = &DataStore{
+			ObjectMeta: metav1.ObjectMeta{GenerateName: "ds-endpoints-"},
+			Spec: DataStoreSpec{
+				Driver: KinePostgreSQLDriver,
+				// basicAuth with inline content satisfies the non-etcd auth CEL rules.
+				BasicAuth: &BasicAuth{
+					Username: ContentRef{Content: []byte("user")},
+					Password: ContentRef{Content: []byte("pass")},
+				},
+			},
+		}
+	})
+
+	AfterEach(func() {
+		if ds.GetName() != "" {
+			if err := k8sClient.Delete(ctx, ds); err != nil && !apierrors.IsNotFound(err) {
+				Expect(err).NotTo(HaveOccurred())
+			}
+		}
+	})
+
+	It("accepts an IPv4 host:port endpoint", func() {
+		ds.Spec.Endpoints = Endpoints{"10.0.0.1:2379"}
+		Expect(k8sClient.Create(ctx, ds)).To(Succeed())
+	})
+
+	It("accepts an FQDN host:port endpoint", func() {
+		ds.Spec.Endpoints = Endpoints{"postgresql.example.com:5432"}
+		Expect(k8sClient.Create(ctx, ds)).To(Succeed())
+	})
+
+	It("accepts a bracketed IPv6 host:port endpoint", func() {
+		ds.Spec.Endpoints = Endpoints{"[2001:db8::1]:2379"}
+		Expect(k8sClient.Create(ctx, ds)).To(Succeed())
+	})
+
+	It("denies a bare (unbracketed) IPv6 endpoint", func() {
+		ds.Spec.Endpoints = Endpoints{"2001:db8::1:2379"}
+
+		err := k8sClient.Create(ctx, ds)
+		Expect(err).To(HaveOccurred())
+		Expect(err.Error()).To(ContainSubstring("an IPv6 endpoint address must be bracketed"))
+	})
+})
```

**File**: `api/v1alpha1/tenantcontrolplane_types.go` (modified, +11/-2)
```diff
@@ -70,6 +70,7 @@ type NetworkProfileSpec struct {
 	// +kubebuilder:validation:MinItems=1
 	// +kubebuilder:validation:MaxItems=2
 	// +kubebuilder:validation:XValidation:rule="self.all(x, isCIDR(x))",message="all serviceCidrs entries must be valid CIDRs"
+	// +kubebuilder:validation:XValidation:rule="size(self) < 2 || cidr(self[0]).ip().family() != cidr(self[1]).ip().family()",message="serviceCidrs must not contain two CIDRs of the same IP family"
 	ServiceCIDRs []string `json:"serviceCidrs,omitempty"`
 	// CIDR for Kubernetes Pods: if empty, defaulted to 10.244.0.0/16.
 	// Deprecated: use PodCIDRs instead.
@@ -84,6 +85,7 @@ type NetworkProfileSpec struct {
 	// +kubebuilder:validation:MinItems=1
 	// +kubebuilder:validation:MaxItems=2
 	// +kubebuilder:validation:XValidation:rule="self.all(x, isCIDR(x))",message="all podCidrs entries must be valid CIDRs"
+	// +kubebuilder:validation:XValidation:rule="size(self) < 2 || cidr(self[0]).ip().family() != cidr(self[1]).ip().family()",message="podCidrs must not contain two CIDRs of the same IP family"
 	PodCIDRs []string `json:"podCidrs,omitempty"`
 	// The DNS Service for internal resolution, it must match the Service CIDR.
 	// In case of an empty value, it is automatically computed according to the Service CIDR, e.g.:
@@ -343,10 +345,17 @@ type AdditionalVolumeMounts struct {
 }
 
 // ControlPlaneExtraArgs allows specifying additional arguments to the Control Plane components.
+// Extra arguments are applied last and override the defaults Kamaji sets.
 type ControlPlaneExtraArgs struct {
-	APIServer         []string `json:"apiServer,omitempty"`
+	APIServer []string `json:"apiServer,omitempty"`
+	// ControllerManager extra args. Kamaji sets --bind-address to the IPv6 wildcard "::"
+	// (which also serves IPv4 on a dual-stack pod); on hosts with IPv6 disabled in the
+	// kernel, override it to "0.0.0.0" here.
 	ControllerManager []string `json:"controllerManager,omitempty"`
-	Scheduler         []string `json:"scheduler,omitempty"`
+	// Scheduler extra args. Kamaji sets --bind-address to the IPv6 wildcard "::"
+	// (which also serves IPv4 on a dual-stack pod); on hosts with IPv6 disabled in the
+	// kernel, override it to "0.0.0.0" here.
+	Scheduler []string `json:"scheduler,omitempty"`
 	// Available only if Kamaji is running using Kine as backing storage.
 	Kine []string `json:"kine,omitempty"`
 }
```

**File**: `charts/kamaji-crds/hack/kamaji.clastix.io_datastores_spec.yaml` (modified, +5/-0)
```diff
@@ -123,9 +123,14 @@ versions:
                   List of the endpoints to connect to the shared datastore.
                   No need for protocol, just bare IP/FQDN and port.
                 items:
+                  maxLength: 256
                   type: string
+                maxItems: 64
                 minItems: 1
                 type: array
+                x-kubernetes-validations:
+                  - message: an IPv6 endpoint address must be bracketed, e.g. [2001:db8::1]:2379
+                    rule: self.all(e, e.startsWith('[') || e.split(':').size() <= 2)
               tlsConfig:
                 description: |-
                   Defines the TLS/SSL configuration required to connect to the data store in a secure way.
```

---

### Incident Patch 7: `03dc9860` (2026-09-10)
**Commit Message**: fix: scope kubeconfig handler histogram to the resource name (#1302)

KubeconfigResource.GetHistogram() cached its observer in the package-level
kubeconfigCollector variable, but LazyLoadHistogramFromResource only reads
resource.GetName() when the collector passed in is nil. The first instance to
call GetHistogram() therefore bound the variable to WithLabelValues of its own
name, and the three remaining instances got that same observer back.

With four instances declared in controllers/resources.go over three distinct
names, kamaji_handler_time_seconds never exported the label values
controller-manager-kubeconfig and scheduler-kubeconfig: their observations were
attributed to admin-kubeconfig, which consequently reported four times the
invocations of every other handler.

Return the vector lookup directly, as the metrics test's fakeResource already
does, and drop the now-unused package-level variable. KubeconfigResource is the
only resource whose GetName() is per-instance and not handled explicitly;
KubeadmPhase switches over the phase to keep one collector per label value.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `internal/resources/kubeconfig.go` (modified, +4/-3)
```diff
@@ -43,9 +43,10 @@ type KubeconfigResource struct {
 }
 
 func (r *KubeconfigResource) GetHistogram() prometheus.Histogram {
-	kubeconfigCollector = LazyLoadHistogramFromResource(kubeconfigCollector, r)
-
-	return kubeconfigCollector
+	// Unlike the other resources, the handler name is per-instance rather than a constant:
+	// caching the observer in a package-level variable would bind every KubeconfigResource
+	// to the name of the first one calling this function.
+	return LazyLoadHistogramFromResource(nil, r)
 }
 
 func (r *KubeconfigResource) ShouldStatusBeUpdated(_ context.Context, tcp *kamajiv1alpha1.TenantControlPlane) bool {
```

**File**: `internal/resources/metrics.go` (modified, +0/-1)
```diff
@@ -22,7 +22,6 @@ var (
 	serviceCollector                   prometheus.Histogram
 	kubeadmconfigCollector             prometheus.Histogram
 	kubeadmupgradeCollector            prometheus.Histogram
-	kubeconfigCollector                prometheus.Histogram
 	serviceaccountcertificateCollector prometheus.Histogram
 
 	kubeadmphaseUploadConfigKubeadmCollector prometheus.Histogram
```

**File**: `internal/resources/metrics_test.go` (modified, +33/-0)
```diff
@@ -62,6 +62,39 @@ func TestHandlerHistogramUsesSingleMetricWithHandlerLabel(t *testing.T) {
 	}
 }
 
+func TestKubeconfigHandlerHistogramIsScopedToResourceName(t *testing.T) {
+	handlerCollector.Reset()
+
+	names := []string{"admin-kubeconfig", "controller-manager-kubeconfig", "scheduler-kubeconfig"}
+
+	for _, name := range names {
+		resource := KubeconfigResource{Name: name}
+
+		resource.GetHistogram().Observe(0.10)
+	}
+
+	families, err := metrics.Registry.Gather()
+	if err != nil {
+		t.Fatalf("failed to gather metric families: %v", err)
+	}
+
+	for _, family := range families {
+		if family.GetName() != "kamaji_handler_time_seconds" {
+			continue
+		}
+
+		for _, name := range names {
+			if !hasLabelValueForFamily(family, "handler", name) {
+				t.Errorf("expected handler label value %s in kamaji_handler_time_seconds", name)
+			}
+		}
+
+		return
+	}
+
+	t.Fatalf("metric family kamaji_handler_time_seconds not found")
+}
+
 func hasLabelValueForFamily(family *io_prometheus_client.MetricFamily, labelName, labelValue string) bool {
 	for _, metric := range family.GetMetric() {
 		for _, label := range metric.GetLabel() {
```

---

### Incident Patch 8: `da047f9c` (2026-09-10)
**Commit Message**: fix(e2e): watch the migration freeze webhook instead of polling for it (#1303)

* fix(e2e): seed the source DataStore so the migration freeze window is observable

The migration spec waits for the kamaji-freeze ValidatingWebhookConfiguration to
appear in the tenant cluster, but that object only exists while the migration Job
is running. MigrationInProcessError short-circuits the reconcile chain for the
duration, so the tenant API server is not repointed at the target DataStore until
the copy is done. Once the Job completes the chain proceeds, the API server moves
to the target, and the webhook - which lives in the tenant's own data - is gone,
because the source DataStore has stopped being authoritative.

The assertion therefore samples a window rather than waiting for a settled state,
and once that window has shut no timeout can recover it. On an otherwise empty
tenant cluster the copy is effectively instantaneous, leaving the window dominated
by the Job's Pod startup, and every sample inside it competes with a tenant API
server being starved on a 2-vCPU runner. Lose every sample and the spec burns its
full five minutes against an object that no longer exists.

Seed the source Data

**File**: `e2e/tcp_migration_test.go` (modified, +76/-11)
```diff
@@ -13,16 +13,47 @@ import (
 	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/fields"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/rand"
+	"k8s.io/apimachinery/pkg/watch"
+	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/tools/clientcmd"
 	pointer "k8s.io/utils/ptr"
 	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
 
 	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
+	ds "github.com/clastix/kamaji/internal/resources/datastore"
 	"github.com/clastix/kamaji/internal/utilities"
 )
 
+// migrationFixtures is kept small on purpose: objects written here land in the Kamaji
+// manager's soot cache, which shares that process's 100Mi limit.
+const migrationFixtures = 5
+
+// awaitFreezeWebhook drains freeze webhook events until the object is seen. The watch must
+// already be open before the migration is triggered: the webhook exists only while the
+// migration Job runs, and polling for it loses the race whenever the tenant API server is
+// contended, which on a 2-vCPU runner is most of that window.
+func awaitFreezeWebhook(w watch.Interface, timeout time.Duration) error {
+	deadline := time.After(timeout)
+
+	for {
+		select {
+		case event, open := <-w.ResultChan():
+			if !open {
+				return fmt.Errorf("watch closed before %s was observed", ds.FreezeWebhookName)
+			}
+
+			if event.Type == watch.Added || event.Type == watch.Modified {
+				return nil
+			}
+		case <-deadline:
+			return fmt.Errorf("timed out waiting for %s", ds.FreezeWebhookName)
+		}
+	}
+}
+
 func featureTestMigration(driver string) {
 	var tcp *kamajiv1alpha1.TenantControlPlane
 	// Create a TenantControlPlane resource into the cluster
@@ -82,10 +113,34 @@ func featureTestMigration(driver string) {
 		tcpClient, err := ctrlclient.New(restConfig, ctrlclient.Options{})
 		Expect(err).ToNot(HaveOccurred())
 
+		tcpClientset, err := kubernetes.NewForConfig(restConfig)
+		Expect(err).ToNot(HaveOccurred())
+
 		ns := &corev1.Namespace{}
 		ns.SetName("kamaji-test")
 		Expect(tcpClient.Create(context.Background(), ns)).ToNot(HaveOccurred())
 
+		By("writing fixtures the migration has to carry across")
+		fixtures := make([]string, 0, migrationFixtures)
+
+		for i := range migrationFixtures {
+			cm := &corev1.ConfigMap{
+				ObjectMeta: metav1.ObjectMeta{Name: fmt.Sprintf("migration-fixture-%d", i), Namespace: ns.GetName()},
+				Data:       map[string]string{"payload": rand.String(256)},
+			}
+			Expect(tcpClient.Create(context.Background(), cm)).ToNot(HaveOccurred())
+
+			fixtures = append(fixtures, cm.GetName())
+		}
+
+		By("opening a watch on the freeze webhook before the migration can install it")
+		freezeWatch, err := tcpClientset.AdmissionregistrationV1().ValidatingWebhookConfigurations().Watch(context.Background(), metav1.ListOptions{
+			FieldSelector: fields.OneTermEqualSelector("metadata.name", ds.FreezeWebhookName).String(),
+		})
+		Expect(err).ToNot(HaveOccurred())
+
+		defer freezeWatch.Stop()
+
 		By("start migration to a new DataStore")
 		Eventually(func() error {
 			if err := k8sClient.Get(context.Background(), types.NamespacedName{Namespace: tcp.GetNamespace(), Name: tcp.GetName()}, tcp); err != nil {
@@ -101,17 +156,15 @@ func featureTestMigration(driver string) {
 		StatusMustEqualTo(tcp, kamajiv1alpha1.VersionMigrating)
 
 		By("waiting for the webhook installation")
-		// Measured directly in CI (GitHub Actions run 30307341733): the whole manager
-		// process - the host-side tenantcontrolplane controller across every TCP in the
-		// suite, plus this tenant's own soot sub-manager - went completely silent for
-		// 2m16s (21:45:45 to 21:48:01 UTC) with no errors logged, consistent with the
-		// process being starved of CPU on the 2-vCPU runner rather than any Kamaji-side
-		// bug: many tenant control planes, datastores, and their apiservers all compete
-		// for the same two cores
```

---

### Incident Patch 9: `157bddee` (2026-09-08)
**Commit Message**: fix: wire kubeconfig-generator reconcile timeout and add secure metrics option (#1229) (#1276)

**File**: `cmd/kubeconfig-generator/cmd.go` (modified, +14/-8)
```diff
@@ -21,8 +21,8 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/event"
 	"sigs.k8s.io/controller-runtime/pkg/healthz"
 	"sigs.k8s.io/controller-runtime/pkg/log/zap"
-	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
 
+	cmdutils "github.com/clastix/kamaji/cmd/utils"
 	"github.com/clastix/kamaji/controllers"
 	"github.com/clastix/kamaji/internal"
 	"github.com/clastix/kamaji/internal/metrics"
@@ -32,6 +32,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 	// CLI flags
 	var (
 		metricsBindAddress            string
+		metricsSecure                 bool
 		healthProbeBindAddress        string
 		leaderElect                   bool
 		controllerReconcileTimeout    time.Duration
@@ -54,6 +55,10 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 				return fmt.Errorf("certificate expiration deadline must be at least 24 hours")
 			}
 
+			if controllerReconcileTimeout.Seconds() == 0 {
+				return fmt.Errorf("the controller reconcile timeout must be greater than zero")
+			}
+
 			return nil
 		},
 		RunE: func(*cobra.Command, []string) error {
@@ -68,10 +73,8 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 			setupLog.Info(fmt.Sprintf("Go OS/Arch: %s/%s", goRuntime.GOOS, goRuntime.GOARCH))
 
 			ctrlOpts := ctrl.Options{
-				Scheme: scheme,
-				Metrics: metricsserver.Options{
-					BindAddress: metricsBindAddress,
-				},
+				Scheme:                  scheme,
+				Metrics:                 cmdutils.MetricsServerOptions(metricsBindAddress, metricsSecure),
 				HealthProbeBindAddress:  healthProbeBindAddress,
 				LeaderElection:          leaderElect,
 				LeaderElectionNamespace: managerNamespace,
@@ -107,7 +110,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 				}
 			}
 
-			certController := &controllers.CertificateLifecycle{Channel: triggerChan, Deadline: certificateExpirationDeadline, Metrics: metricsRecorder}
+			certController := &controllers.CertificateLifecycle{Channel: triggerChan, Deadline: certificateExpirationDeadline, ReconcileTimeout: controllerReconcileTimeout, Metrics: metricsRecorder}
 			certController.EnqueueFn = certController.EnqueueForKubeconfigGenerator
 			if err = certController.SetupWithManager(mgr); err != nil {
 				setupLog.Error(err, "unable to create controller", "controller", "CertificateLifecycle")
@@ -116,8 +119,9 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 			}
 
 			if err = (&controllers.KubeconfigGeneratorWatcher{
-				Client:        mgr.GetClient(),
-				GeneratorChan: triggerChan,
+				Client:           mgr.GetClient(),
+				GeneratorChan:    triggerChan,
+				ReconcileTimeout: controllerReconcileTimeout,
 			}).SetupWithManager(mgr); err != nil {
 				setupLog.Error(err, "unable to create controller", "controller", "KubeconfigGeneratorWatcher")
 
@@ -127,6 +131,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 			if err = (&controllers.KubeconfigGeneratorReconciler{
 				Client:            mgr.GetClient(),
 				NotValidThreshold: certificateExpirationDeadline,
+				ReconcileTimeout:  controllerReconcileTimeout,
 				CertificateChan:   triggerChan,
 			}).SetupWithManager(mgr); err != nil {
 				setupLog.Error(err, "unable to create controller", "controller", "KubeconfigGenerator")
@@ -154,6 +159,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))
 	// Setting CLI flags
 	cmd.Flags().StringVar(&metricsBindAddress, "metrics-bind-address", ":8090", "The address the metric endpoint binds to.")
+	cmd.Flags().BoolVar(&metricsSecure, "metrics-secure", false, "If set, the metrics endpoint is served over HTTPS and requires a bearer token authorized against the manager's kamaji-metrics-reader ClusterRole, instead of being served in plaintext without authentication.")
 	cmd.Flags().StringVar(&healthProbeBindAddress, "health-probe-bind-address", ":8091", "The address the probe endpoint binds to.")
 	cmd.Flags().BoolVar(&leaderElect, "leader-elect", true, "Enable leader el
```

**File**: `cmd/manager/cmd.go` (modified, +4/-5)
```diff
@@ -24,7 +24,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/event"
 	"sigs.k8s.io/controller-runtime/pkg/healthz"
 	"sigs.k8s.io/controller-runtime/pkg/log/zap"
-	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
 	ctrlwebhook "sigs.k8s.io/controller-runtime/pkg/webhook"
 
 	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
@@ -45,6 +44,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 	// CLI flags
 	var (
 		metricsBindAddress            string
+		metricsSecure                 bool
 		healthProbeBindAddress        string
 		pprofBindAddress              string
 		leaderElect                   bool
@@ -111,10 +111,8 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 			}
 
 			ctrlOpts := ctrl.Options{
-				Scheme: scheme,
-				Metrics: metricsserver.Options{
-					BindAddress: metricsBindAddress,
-				},
+				Scheme:           scheme,
+				Metrics:          cmdutils.MetricsServerOptions(metricsBindAddress, metricsSecure),
 				PprofBindAddress: pprofBindAddress,
 				WebhookServer: ctrlwebhook.NewServer(ctrlwebhook.Options{
 					Port: 9443,
@@ -329,6 +327,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))
 	// Setting CLI flags
 	cmd.Flags().StringVar(&metricsBindAddress, "metrics-bind-address", ":8080", "The address the metric endpoint binds to.")
+	cmd.Flags().BoolVar(&metricsSecure, "metrics-secure", false, "If set, the metrics endpoint is served over HTTPS and requires a bearer token authorized against the manager's kamaji-metrics-reader ClusterRole, instead of being served in plaintext without authentication.")
 	cmd.Flags().StringVar(&healthProbeBindAddress, "health-probe-bind-address", ":8081", "The address the probe endpoint binds to.")
 	cmd.Flags().StringVar(&pprofBindAddress, "pprof-bind-address", "", "The address the pprof profiler binds to.")
 	cmd.Flags().BoolVar(&leaderElect, "leader-elect", true, "Enable leader election for controller manager. Enabling this will ensure there is only one active controller manager.")
```

**File**: `cmd/utils/metrics.go` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package utils
+
+import (
+	"sigs.k8s.io/controller-runtime/pkg/metrics/filters"
+	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
+)
+
+// MetricsServerOptions builds the controller-runtime metrics server options for the given bind address.
+// When secure is true, the metrics endpoint is served over HTTPS and requires the caller to authenticate
+// with a bearer token authorized via SubjectAccessReview, instead of being served in plaintext with no auth.
+func MetricsServerOptions(bindAddress string, secure bool) metricsserver.Options {
+	opts := metricsserver.Options{
+		BindAddress: bindAddress,
+	}
+
+	if secure {
+		opts.SecureServing = true
+		opts.FilterProvider = filters.WithAuthenticationAndAuthorization
+	}
+
+	return opts
+}
```

**File**: `cmd/utils/metrics_test.go` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package utils
+
+import "testing"
+
+func TestMetricsServerOptions(t *testing.T) {
+	t.Parallel()
+
+	insecure := MetricsServerOptions(":8080", false)
+
+	if insecure.BindAddress != ":8080" {
+		t.Fatalf("expected bind address to be preserved, got %q", insecure.BindAddress)
+	}
+	if insecure.SecureServing {
+		t.Fatalf("expected SecureServing to be false when secure is false")
+	}
+	if insecure.FilterProvider != nil {
+		t.Fatalf("expected no FilterProvider when secure is false")
+	}
+
+	secure := MetricsServerOptions(":8090", true)
+
+	if secure.BindAddress != ":8090" {
+		t.Fatalf("expected bind address to be preserved, got %q", secure.BindAddress)
+	}
+	if !secure.SecureServing {
+		t.Fatalf("expected SecureServing to be true when secure is true")
+	}
+	if secure.FilterProvider == nil {
+		t.Fatalf("expected FilterProvider to be set when secure is true")
+	}
+}
```

**File**: `controllers/certificate_lifecycle_controller.go` (modified, +9/-4)
```diff
@@ -33,10 +33,11 @@ import (
 )
 
 type CertificateLifecycle struct {
-	Channel   chan event.GenericEvent
-	Deadline  time.Duration
-	EnqueueFn func(secret *corev1.Secret)
-	Metrics   *metrics.Recorder
+	Channel          chan event.GenericEvent
+	Deadline         time.Duration
+	ReconcileTimeout time.Duration
+	EnqueueFn        func(secret *corev1.Secret)
+	Metrics          *metrics.Recorder
 
 	client client.Client
 }
@@ -52,6 +53,10 @@ func (s *CertificateLifecycle) Reconcile(ctx context.Context, request reconcile.
 		}
 	}(ctx)
 
+	var cancelFn context.CancelFunc
+	ctx, cancelFn = context.WithTimeout(ctx, s.ReconcileTimeout)
+	defer cancelFn()
+
 	logger.Info("starting CertificateLifecycle handling")
 
 	var secret corev1.Secret
```

---

### Incident Patch 10: `d4c809a5` (2026-09-08)
**Commit Message**: fix(networkprofile)!: preserve the order of podCidrs/serviceCidrs (#1284)

The order of `networkProfile.podCidrs` / `serviceCidrs` is significant: for a
dual-stack tenant the first CIDR selects the primary IP family, and it is
propagated in order to `--service-cluster-ip-range` / `--cluster-cidr` and the
kubeadm service/pod subnets.

`GetEffectiveCIDRs` passed the list through `UniqueStrings`, which deduplicates
via a set and then calls `sort.Strings` to make `UnsortedList()` deterministic.
That sort is lexicographic, so the caller's order was silently discarded and the
primary family ended up decided by the leading characters of the CIDR strings:

    ["fd00:96::/108", "10.96.0.0/16"]   -> ["10.96.0.0/16", "fd00:96::/108"]
    ["2001:db8::/48", "99.0.0.0/8"]     -> ["2001:db8::/48", "99.0.0.0/8"]

The first is the common case and looks like an "IPv4 first" rule; the second
shows it is not one. On an IPv6-primary management cluster the tenant
kube-apiserver then refuses to start:

    "command failed" err="service IP family \"10.96.0.0/16\" must match public
    address family \"fd00:cafe:f00d::10\""

which makes IPv6-primary dual-stack tenants impossible to express.

`UniqueString

**File**: `internal/utilities/utilities.go` (modified, +19/-5)
```diff
@@ -6,7 +6,6 @@ package utilities
 import (
 	"bytes"
 	"fmt"
-	"sort"
 
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/runtime/serializer/json"
@@ -118,6 +117,11 @@ func EncodeToJSON(o runtime.Object) ([]byte, error) {
 //
 // If the new CIDRs field is populated, it is considered authoritative.
 // The deprecated field is only used as a fallback for backward compatibility.
+//
+// The order of the returned CIDRs is significant and is preserved as supplied:
+// for a dual-stack cluster the FIRST entry selects the primary IP family of the
+// tenant, so reordering them changes the meaning of the spec. Duplicates are
+// removed, keeping the first occurrence.
 func GetEffectiveCIDRs(deprecated string, current []string) []string {
 	if len(current) > 0 {
 		return UniqueStrings(current)
@@ -130,12 +134,22 @@ func GetEffectiveCIDRs(deprecated string, current []string) []string {
 	return nil
 }
 
-// UniqueStrings returns a slice of unique strings from the provided slice.
+// UniqueStrings returns the unique values of the provided slice, keeping the
+// first occurrence of each in its original position. The order is preserved
+// because callers such as GetEffectiveCIDRs carry order-significant values.
 func UniqueStrings(input []string) []string {
-	unique := sets.New[string](input...)
+	seen := sets.New[string]()
+	result := make([]string, 0, len(input))
+
+	for _, item := range input {
+		if seen.Has(item) {
+			continue
+		}
 
-	result := unique.UnsortedList()
-	sort.Strings(result)
+		seen.Insert(item)
+
+		result = append(result, item)
+	}
 
 	return result
 }
```

**File**: `internal/utilities/utilities_test.go` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package utilities
+
+import (
+	"slices"
+	"testing"
+)
+
+func TestGetEffectiveCIDRsPreservesOrder(t *testing.T) {
+	tests := []struct {
+		name       string
+		deprecated string
+		current    []string
+		expect     []string
+	}{
+		// The primary IP family of a dual-stack cluster is decided by the FIRST
+		// CIDR, so both orders must survive verbatim.
+		{
+			name:    "IPv6-primary dual-stack is preserved",
+			current: []string{"fd00:96::/108", "10.96.0.0/16"},
+			expect:  []string{"fd00:96::/108", "10.96.0.0/16"},
+		},
+		{
+			name:    "IPv4-primary dual-stack is preserved",
+			current: []string{"10.96.0.0/16", "fd00:96::/108"},
+			expect:  []string{"10.96.0.0/16", "fd00:96::/108"},
+		},
+		// A lexicographic sort would move the IPv4 entry first here.
+		{
+			name:    "IPv6-primary is not reordered by lexicographic comparison",
+			current: []string{"fd00:244::/56", "10.244.0.0/16"},
+			expect:  []string{"fd00:244::/56", "10.244.0.0/16"},
+		},
+		// The input is already in lexicographic order, so a sorting
+		// implementation and an order-preserving one agree on the order and the
+		// only thing this case can fail on is WHICH occurrence is kept: keeping
+		// the last one would yield ["fd00:96::/108", "10.96.0.0/16"].
+		{
+			name:    "duplicates are removed keeping the first occurrence",
+			current: []string{"10.96.0.0/16", "fd00:96::/108", "10.96.0.0/16"},
+			expect:  []string{"10.96.0.0/16", "fd00:96::/108"},
+		},
+		{
+			name:    "duplicates are removed and the order is preserved",
+			current: []string{"fd00:96::/108", "10.96.0.0/16", "fd00:96::/108"},
+			expect:  []string{"fd00:96::/108", "10.96.0.0/16"},
+		},
+		{
+			name:    "single stack is preserved",
+			current: []string{"fd00:96::/108"},
+			expect:  []string{"fd00:96::/108"},
+		},
+		{
+			name:       "the plural field takes precedence over the deprecated one",
+			deprecated: "10.96.0.0/16",
+			current:    []string{"fd00:96::/108", "10.96.0.0/16"},
+			expect:     []string{"fd00:96::/108", "10.96.0.0/16"},
+		},
+		{
+			name:       "the deprecated field is the fallback",
+			deprecated: "10.96.0.0/16",
+			expect:     []string{"10.96.0.0/16"},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			got := GetEffectiveCIDRs(tc.deprecated, tc.current)
+			if !slices.Equal(got, tc.expect) {
+				t.Errorf("expected %+v, but got %+v", tc.expect, got)
+			}
+		})
+	}
+}
+
+func TestGetEffectiveCIDRsNoCIDRsYieldsNil(t *testing.T) {
+	// slices.Equal(nil, []string{}) is true, so the nil-ness has to be asserted
+	// explicitly rather than through a comparison with an expected value.
+	if got := GetEffectiveCIDRs("", nil); got != nil {
+		t.Errorf("expected nil, but got %#v", got)
+	}
+
+	if got := GetEffectiveCIDRs("", []string{}); got != nil {
+		t.Errorf("expected nil for an empty slice, but got %#v", got)
+	}
+}
+
+func TestGetEffectiveCIDRsDoesNotMutateInput(t *testing.T) {
+	current := []string{"fd00:96::/108", "10.96.0.0/16"}
+	original := slices.Clone(current)
+
+	GetEffectiveCIDRs("", current)
+
+	if !slices.Equal(current, original) {
+		t.Errorf("expected the input slice to be untouched, but it became %+v", current)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1324** (2026-09-24): fix(manager): add webhook readyz check (@mridulgain)
- **PR #1323** (2026-09-24): feat(deps): bump github.com/nats-io/nats.go from 1.53.1 to 1.54.0 (@dependabot[bot])
- **PR #1322** (2026-09-24): feat(deps): bump github.com/onsi/ginkgo/v2 from 2.32.2 to 2.33.0 (@dependabot[bot])
- **PR #1321** (2026-09-24): feat(deps): bump github.com/onsi/gomega from 1.43.0 to 1.43.1 (@dependabot[bot])
- **PR #1320** (2026-09-18): feat(deps): bump sigs.k8s.io/controller-runtime from 0.25.0 to 0.25.1 (@dependabot[bot])
- **PR #1319** (2026-09-18): feat(e2e): split e2e Make task to make local testing faster (@rossigee)
- **PR #1318** (closed): fix: implement webhook validation for CIDR families and kubelet address types (@rossigee)
- **PR #1317** (2026-09-15): feat(deps): bump github.com/onsi/ginkgo/v2 from 2.32.1 to 2.32.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
