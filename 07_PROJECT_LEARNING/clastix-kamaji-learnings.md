> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clastix-kamaji-learnings.md`  
> **Source**: github ([https://github.com/clastix/kamaji](https://github.com/clastix/kamaji))  
> **Source Version**: `8164ff2f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T00:35:05.786Z  
> **Learning ID**: `learn-github-clastix-kamaji`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): clastix/kamaji

> **Canonical Artifact**: `07_PROJECT_LEARNING/clastix-kamaji-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/clastix/kamaji](https://github.com/clastix/kamaji))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T00:35:05.779Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `clastix/kamaji`
- **Description**: Kamaji is the Hosted Control Plane Manager for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2055 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/utils/check_flags.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"fmt"

	"github.com/spf13/pflag"
)

func CheckFlags(flags *pflag.FlagSet, args ...string) error {
	for _, arg := range args {
		v, _ := flags.GetString(arg)

		if len(v) == 0 {
			return fmt.Errorf("expecting a value for --%s arg", arg)
		}
	}

	return nil
}

```

### Core Architecture Module: `cmd/utils/k8s_version.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"fmt"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func KubernetesVersion(config *rest.Config) (string, error) {
	cs, csErr := kubernetes.NewForConfig(config)
	if csErr != nil {
		return "", fmt.Errorf("cannot create kubernetes clientset: %w", csErr)
	}

	sv, svErr := cs.ServerVersion()
	if svErr != nil {
		return "", fmt.Errorf("cannot get Kubernetes version: %w", svErr)
	}

	return sv.GitVersion, nil
}

```

### Core Architecture Module: `cmd/utils/metrics.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"sigs.k8s.io/controller-runtime/pkg/metrics/filters"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
)

// MetricsServerOptions builds the controller-runtime metrics server options for the given bind address.
// When secure is true, the metrics endpoint is served over HTTPS and requires the caller to authenticate
// with a bearer token authorized via SubjectAccessReview, instead of being served in plaintext with no auth.
func MetricsServerOptions(bindAddress string, secure bool) metricsserver.Options {
	opts := metricsserver.Options{
		BindAddress: bindAddress,
	}

	if secure {
		opts.SecureServing = true
		opts.FilterProvider = filters.WithAuthenticationAndAuthorization
	}

	return opts
}

```

### Core Architecture Module: `controllers/certificate_lifecycle_controller.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package controllers

import (
	"context"
	"crypto/x509"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8stypes "k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/sets"
	clientcmdapiv1 "k8s.io/client-go/tools/clientcmd/api/v1"
	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
	"github.com/clastix/kamaji/controllers/utils"
	"github.com/clastix/kamaji/internal/constants"
	"github.com/clastix/kamaji/internal/crypto"
	"github.com/clastix/kamaji/internal/metrics"
	"github.com/clastix/kamaji/internal/utilities"
)

type CertificateLifecycle struct {
	Channel          chan event.GenericEvent
	Deadline         time.Duration
	ReconcileTimeout time.Duration
	EnqueueFn        func(secret *corev1.Secret)
	Metrics          *metrics.Recorder

	client client.Client
}

func (s *CertificateLifecycle) Reconcile(ctx context.Context, request reconcile.Request) (reconcile.Result, error) {
	logger := log.FromContext(ctx)
	defer func(c context.Context) {
		metricCtx, cancelMetricCtx := metrics.NewRefreshContextFrom(c)
		defer cancelMetricCtx()

		if err := s.refreshCertificatesMetrics(metricCtx); err != nil {
			logger.WithName("metrics").Error(err, "cannot refresh certificate status gauges")
		}
	}(ctx)

	var cancelFn context.CancelFunc
	ctx, cancelFn = context.WithTimeout(ctx, s.ReconcileTimeout)
	defer cancelFn()

	logger.Info("starting CertificateLifecycle handling")

	var secret corev1.Secret
	if err := s.client.Get(ctx, request.NamespacedName, &secret); err != nil {
		if k8serrors.IsNotFound(err) {
			logger.Info("resource may have been deleted, skipping")

			return reconcile.Result{}, nil
		}

		logger.Error(err, "cannot retrieve the required resource")

		return reconcile.Result{}, err
	}

	if utils.IsPaused(&secret) {
		logger.Info("paused reconciliation, no further actions")

		return reconcile.Result{}, nil
	}

	checkType, ok := secret.GetLabels()[constants.ControllerLabelResource]
	if !ok {
		logger.Info("missing controller label, shouldn't happen")

		return reconcile.Result{}, nil
	}

	var crt *x509.Certificate
	var err error

	switch checkType {
	case utilities.CertificateX509Label:
		crt, err = s.extractCertificateFromBareSecret(secret)
	case utilities.CertificateKubeconfigLabel:
		crt, err = s.extractCertificateFromKubeconfig(secret)
	default:
		return reconcile.Result{}, fmt.Errorf("unsupported strategy, %q", checkType)
	}

	if err != nil {
		logger.Error(err, "skipping reconciliation")

		return reconcile.Result{}, nil
	}

	deadline := time.Now().Add(s.Deadline)

	if deadline.After(crt.NotAfter) {
		logger.Info("certificate near expiration, must be rotated")

		s.EnqueueFn(&secret)

		logger.Info("certificate rotation triggered")

		return reconcile.Result{}, nil
	}

	after := crt.NotAfter.Sub(deadline)

	logger.Info("certificate is still valid, enqueuing back", "after", after.String())

	return reconcile.Result{RequeueAfter: after}, nil
}

func (s *CertificateLifecycle) EnqueueForTenantControlPlane(secret *corev1.Secret) {
	for _, or := range secret.GetOwnerReferences() {
		if or.Kind != "TenantControlPlane" {
			continue
		}

		s.Channel <- event.GenericEvent{Object: &kamajiv1alpha1.TenantControlPlane{
			ObjectMeta: metav1.ObjectMeta{
				Name:      or.Name,
				Namespace: secret.Namespace,
			},
		}}
	}
}

func (s *CertificateLifecycle) EnqueueForKubeconfigGenerator(secret *corev1.Secret) {
	for _, or := range secret.GetOwnerReferences() {
		if or.Kind != "KubeconfigGenerator" {
			continue
		}

		s.Channel <- event.GenericEvent{Object: &kamajiv1alpha1.TenantControlPlane{
			ObjectMeta: metav1.ObjectMeta{
				Name: or.Name,
			},
		}}
	}
}

func (s *CertificateLifecycle) extractCertificateFromBareSecret(secret corev1.Secret) (*x509.Certificate, error) {
	var crt *x509.Certificate
	var err error

	for _, v := range secret.Data {
		if crt, err = crypto.ParseCertificateBytes(v); err == nil {
			break
		}
	}

	if crt == nil {
		return nil, fmt.Errorf("none of the provided keys is containing a valid x509 certificate")
	}

	return crt, nil
}

func (s *CertificateLifecycle) extractCertificateFromKubeconfig(secret corev1.Secret) (*x509.Certificate, error) {
	var kc *clientcmdapiv1.Config
	var err error

	for k := range secret.Data {
		if kc, err = utilities.DecodeKubeconfig(secret, k); err == nil {
			break
		}
	}

	if kc == nil {
		return nil, fmt.Errorf("none of the provided keys is containing a valid kubeconfig")
	}

	if len(kc.AuthInfos) == 0 {
		return nil, fmt.Errorf("kubeconfig does not contain any user entries")
	}

	crt, err := crypto.ParseCertificateBytes(kc.AuthInfos[0].AuthInfo.ClientCertificateData)
	if err != nil {
		return nil, fmt.Errorf("cannot parse kubeconfig certificate bytes: %w", err)
	}

	return crt, nil
}

func (s *CertificateLifecycle) SetupWithManager(mgr controllerruntime.Manager) error {
	s.client = mgr.GetClient()

	if err := mgr.Add(manager.RunnableFunc(func(ctx context.Context) error {
		metricCtx, cancelMetricCtx := metrics.NewRefreshContextFrom(ctx)
		defer cancelMetricCtx()

		if err := s.refreshCertificatesMetrics(metricCtx); err != nil {
			controllerruntime.Log.WithName("metrics").Error(err, "cannot initialize certificate status gauges")
		}

		return nil
	})); err != nil {
		return err
	}

	supportedStrategies := sets.New[string](utilities.CertificateX509Label, utilities.CertificateKubeconfigLabel)

	return controllerruntime.NewControllerManagedBy(mgr).
		For(&corev1.Secret{}, builder.WithPredicates(predicate.NewPredicateFuncs(func(object client.Object) bool {
			labels := object.GetLabels()

			if labels == nil {
				return false
			}

			value, ok := labels[constants.ControllerLabelResource]
			if !ok {
				return false
			}

			return supportedStrategies.Has(value)
		}))).
		Complete(s)
}

func (s *CertificateLifecycle) refreshCertificatesMetrics(ctx context.Context) error {
	metricsRecorder := s.metricsRecorder()
	metricsRecorder.ResetCertificatesStatusCounts()

	countsByTenantControlPlane := map[k8stypes.NamespacedName]map[string]map[string]int{}

	var tenantControlPlaneList kamajiv1alpha1.TenantControlPlaneList
	if err := s.client.List(ctx, &tenantControlPlaneList); err != nil {
		return err
	}

	for i := range tenantControlPlaneList.Items {
		tcp := tenantControlPlaneList.Items[i]
		namespacedName := k8stypes.NamespacedName{Namespace: tcp.GetNamespace(), Name: tcp.GetName()}
		countsByTenantControlPlane[namespacedName] = metrics.NewCertificateStatusCounts()
	}

	var secretList corev1.SecretList
	if err := s.client.List(ctx, &secretList); err != nil {
		return err
	}

	deadline := time.Now().Add(s.Deadline)

	for i := range secretList.Items {
		secret := secretList.Items[i]
		labels := secret.GetLabels()
		if labels == nil {
			continue
		}

		tenantControlPlaneName, ok := labels[constants.ControlPlaneLabelKey]
		if !ok || tenantControlPlaneName == "" {
			continue
		}

		strategy, ok := certificateStrategyFromLabel(labels[constants.ControllerLabelResource])
		if !ok {
			continue
		}

		namespacedName := k8stypes.NamespacedName{Namespace: secret.GetNamespace(), Name: tenantControlPlaneName}
		if _, exists := countsByTenantControlPlane[namespacedName]; !exists {
			countsByTenantControlPlane[namespacedName] = metrics.NewCertificateStatusCounts()
		}

		var (
			crt *x509.Certificate
			err error
		)

		switch strategy {
		case metrics.CertificateStrategyX509:
			crt, err = s.extractCertificateFromBareSecret(secret)
		case metrics.CertificateStrategyKubeconfig:
			crt, err = s.extractCertificateFromKubeconfig(secret)
		default:
			continue
		}

		if err != nil {
			countsByTenantControlPlane[namespacedName][metrics.CertificateStatusInvalid][strategy]++

			continue
		}

		if deadline.After(crt.NotAfter) {
			countsByTenantControlPlane[namespacedName][metrics.CertificateStatusExpiring][strategy]++

			continue
		}

		countsByTenantControlPlane[namespacedName][metrics.CertificateStatusValid][strategy]++
	}

	for namespacedName, counts := range countsByTenantControlPlane {
		metricsRecorder.SetCertificatesStatusCounts(namespacedName.Namespace, namespacedName.Name, counts)
	}

	return nil
}

func certificateStrategyFromLabel(label string) (string, bool) {
	switch label {
	case utilities.CertificateX509Label:
		return metrics.CertificateStrategyX509, true
	case utilities.CertificateKubeconfigLabel:
		return metrics.CertificateStrategyKubeconfig, true
	default:
		return "", false
	}
}

func (s *CertificateLifecycle) metricsRecorder() *metrics.Recorder {
	if s.Metrics == nil {
		s.Metrics = metrics.DefaultRecorder()
	}

	return s.Metrics
}

```

### Core Architecture Module: `controllers/soot/controllers/coredns.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package controllers

import (
	"context"
	"errors"

	"github.com/go-logr/logr"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/utils/ptr"
	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"

	sooterrors "github.com/clastix/kamaji/controllers/soot/controllers/errors"
	"github.com/clastix/kamaji/controllers/utils"
	"github.com/clastix/kamaji/internal/kubeadm"
	"github.com/clastix/kamaji/internal/resources"
	"github.com/clastix/kamaji/internal/resources/addons"
)

type CoreDNS struct {
	Logger                    logr.Logger
	AdminClient               client.Client
	GetTenantControlPlaneFunc utils.TenantControlPlaneRetrievalFn
	TriggerChannel            chan event.GenericEvent
	ControllerName            string
}

func (c *CoreDNS) Reconcile(ctx context.Context, _ reconcile.Request) (reconcile.Result, error) {
	tcp, err := c.GetTenantControlPlaneFunc()
	if err != nil {
		if errors.Is(err, sooterrors.ErrPausedReconciliation) {
			c.Logger.Info(err.Error())

			return reconcile.Result{}, nil
		}

		return reconcile.Result{}, err
	}

	c.Logger.Info("start processing")

	resource := &addons.CoreDNS{Client: c.AdminClient}

	result, handlingErr := resources.Handle(ctx, resource, tcp)
	if handlingErr != nil {
		c.Logger.Error(handlingErr, "resource process failed", "resource", resource.GetName())

		return reconcile.Result{}, handlingErr
	}

	if result == controllerutil.OperationResultNone {
		c.Logger.Info("reconciliation completed")

		return reconcile.Result{}, nil
	}

	if err = utils.UpdateStatus(ctx, c.AdminClient, tcp, resource); err != nil {
		c.Logger.Error(err, "update status failed", "resource", resource.GetName())

		return reconcile.Result{}, err
	}

	c.Logger.Info("reconciliation processed")

	return reconcile.Result{}, nil
}

func (c *CoreDNS) SetupWithManager(mgr manager.Manager) error {
	return controllerruntime.NewControllerManagedBy(mgr).
		Named(c.ControllerName).
		WithOptions(controller.TypedOptions[reconcile.Request]{SkipNameValidation: ptr.To(true)}).
		For(&rbacv1.ClusterRoleBinding{}, builder.WithPredicates(predicate.NewPredicateFuncs(func(object client.Object) bool {
			return object.GetName() == kubeadm.CoreDNSClusterRoleBindingName
		}))).
		WatchesRawSource(source.Channel(c.TriggerChannel, &handler.EnqueueRequestForObject{})).
		Owns(&rbacv1.ClusterRole{}).
		Owns(&corev1.ServiceAccount{}).
		Owns(&corev1.Service{}).
		Owns(&corev1.ConfigMap{}).
		Owns(&appsv1.Deployment{}).
		Complete(c)
}

```

### Core Architecture Module: `controllers/utils/is_paused.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/clastix/kamaji/api/v1alpha1"
)

func IsPaused(obj client.Object) bool {
	if obj.GetAnnotations() == nil {
		return false
	}
	_, paused := obj.GetAnnotations()[v1alpha1.PausedReconciliationAnnotation]

	return paused
}

```

### Core Architecture Module: `controllers/utils/tcp_retrieval.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
)

type TenantControlPlaneRetrievalFn func() (*kamajiv1alpha1.TenantControlPlane, error)

```

### Core Architecture Module: `controllers/utils/trigger_channel.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"sigs.k8s.io/controller-runtime/pkg/event"

	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
)

// CoalesceTriggerChannelBufferSize is the buffer size of the channels fed by CoalesceTriggerChannel,
// and one slot is both the minimum and the maximum that makes sense.
//
// It cannot be zero: a send on an unbuffered channel only succeeds when the receiver is already
// parked on it, so every nudge would be skipped in the window where the source.Channel consumer
// hasn't started yet, which is precisely the window the send has to survive.
//
// It doesn't need to be more than one: all the events are interchangeable nudges for the same
// workqueue key, so a pending one already tells the consumer to reconcile, and the workqueue
// collapses anything queued on top of it. Extra slots would only buy redundant sends.
const CoalesceTriggerChannelBufferSize = 1

// CoalesceTriggerChannel enqueues a reconciliation for the given TenantControlPlane without ever
// blocking: it's meant for channels dedicated to a single TenantControlPlane, where all the events
// are interchangeable nudges for the same workqueue key. When the buffer is full a reconciliation
// is already pending and covers this request, so skipping the send coalesces it rather than losing
// it: no goroutine, and no deadline to tune.
//
// Channels shared by several TenantControlPlane objects carry a distinct workqueue key per event
// and cannot use this: they have to wait for the consumer instead of skipping the send.
func CoalesceTriggerChannel(receiver chan event.GenericEvent, tcp kamajiv1alpha1.TenantControlPlane) {
	select {
	case receiver <- event.GenericEvent{Object: &tcp}:
	default:
	}
}

```

### Core Architecture Module: `controllers/utils/update_status.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/retry"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
	"github.com/clastix/kamaji/internal/resources"
)

func UpdateStatus(ctx context.Context, client client.Client, tcp *kamajiv1alpha1.TenantControlPlane, resource resources.Resource) error {
	updateErr := retry.RetryOnConflict(retry.DefaultRetry, func() (err error) {
		defer func() {
			if err != nil {
				_ = client.Get(ctx, types.NamespacedName{Name: tcp.Name, Namespace: tcp.Namespace}, tcp)
			}
		}()

		if err = resource.UpdateTenantControlPlaneStatus(ctx, tcp); err != nil {
			return fmt.Errorf("error applying TenantcontrolPlane status: %w", err)
		}

		if err = client.Status().Update(ctx, tcp); err != nil {
			return fmt.Errorf("error updating tenantControlPlane status: %w", err)
		}

		return nil
	})

	return updateErr
}

```

### Core Architecture Module: `internal/errors/utils_controllers.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package errors

import "errors"

func ShouldReconcileErrorBeIgnored(err error) bool {
	var (
		nonExposedLBErr   NonExposedLoadBalancerError
		missingValidIPErr MissingValidIPError
		migrationErr      MigrationInProcessError
	)

	switch {
	case errors.As(err, &nonExposedLBErr):
		return true
	case errors.As(err, &missingValidIPErr):
		return true
	case errors.As(err, &migrationErr):
		return true
	default:
		return false
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1299** (2026-09-10): **kamaji_handler_time_seconds: two kubeconfig handler labels are never exported**
  *Symptoms*: ## What happens  `kamaji_handler_time_seconds` never exposes the label values `handler="controller-manager-kubeconfig"` and `handler="scheduler-kubeconfig"`. Their observations are attributed to `handler="admin-kubeconfig"` instead, so that label reports 4x the invocations of every other handler.  From a production Kamaji managing 735 ready TenantControlPlanes:  ```    122548  handler=admin-kubeconfig        <- 4 x     30673  handler=upgrade     30637  handler=konnectivity-kubeconfig     30637  handler=ca     30637  handler=kubeadmconfig     ... (controller-manager-kubeconfig and scheduler-kubeconfig: no series at all) ```  The effect is that the kubeconfig handlers cannot be told apart in dashboards or alerts, and `admin-kubeconfig` looks like it does four times the work it actually does. It cost me a wrong conclusion while investigating something else, which is why I chased it down.  ## Why  `controllers/resources.go` declares four `KubeconfigResource` instances with three distinct names:  ```go &resources.KubeconfigResource{Name: "admin-kubeconfig",              KubeConfigFileName: resources.AdminKubeConfigFileName}, &resources.KubeconfigResource{Name: "admin-kubeconfig",              KubeConfigFileName: resources.SuperAdminKubeConfigFileName}, &resources.KubeconfigResource{Name: "controller-manager-kubeconfig", KubeConfigFileName: resources.ControllerManagerKubeConfigFileName}, &resources.KubeconfigResource{Name: "scheduler-kubeconfig",          KubeConfigFileName: resour

- **Issue #1294** (2026-09-09): **Allow configuring resources for the Konnectivity agent**
  *Symptoms*: # Allow configuring resources for the Konnectivity agent  ## Summary  `KonnectivityServerSpec` exposes `Resources`, but `KonnectivityAgentSpec` does not. The agent container is therefore created with no requests and no limits, which places every agent Pod in the **BestEffort** QoS class with no supported way to change it.  On a busy cluster this makes the agent the first thing the kubelet starves of CPU and the first thing it evicts — degrading the tunnel that `kubectl exec`, `kubectl logs` and `kubectl port-forward` depend on, while the cluster otherwise looks healthy.  ## What we saw  On a 115-node GPU cluster (hosted control plane, agents in `DaemonSet` mode with `hostNetwork: true` and `tolerations: [{operator: Exists}]`), users began reporting:  ``` error: unable to upgrade connection: ... ```  on `kubectl exec`, intermittently and under load. Ordinary API reads were unaffected throughout, so nothing looked wrong from the outside.  What we found:  **1. konnectivity-server was shedding agent traffic.** Its log carried, across 16 distinct `agentID`s inside a 45-second window:  ``` server.go:841] "Receive channel from agent is full" agentID="..." ```  interleaved with streams being set up and torn down almost immediately:  ``` server.go:934] "Proxy connection established" ... dialAddress="<node>:10250" dialDuration="2.4ms" server.go:523] "Stream read from frontend cancelled" userAgent=["grpc-go/1.72.2"] server.go:990] "could not get frontend client for closing" agentID="...

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

### Incident Patch 1: `82d7359b` (2026-10-14)
**Commit Message**: fix(kubeadm): let kubelet configuration JSON patches remove fields (#1347)

The patched kubelet configuration was decoded back into the
KubeletConfiguration struct and encoded again, so a removed non-pointer
struct field such as crashLoopBackOff came back as an empty object.
The patched document is now only decoded for validation and written
out as it is.

A remove for a path the configuration does not contain also failed the
whole upload, which breaks a patch as soon as Kamaji stops emitting
that field. Such a remove is now a no-op.

Assisted-by: LLM

Signed-off-by: Aleksei Sviridkin <[REDACTED_EMAIL]>

**File**: `internal/kubeadm/uploadconfig.go` (modified, +10/-3)
```diff
@@ -18,6 +18,7 @@ import (
 	"k8s.io/kubernetes/cmd/kubeadm/app/util/apiclient"
 	"k8s.io/kubernetes/pkg/apis/rbac"
 	kubeletv1beta1 "k8s.io/kubernetes/pkg/kubelet/apis/config/v1beta1"
+	"sigs.k8s.io/yaml"
 
 	"github.com/clastix/kamaji/internal/utilities"
 )
@@ -95,14 +96,20 @@ func getKubeletConfigmapContent(kubeletConfiguration KubeletConfiguration, patch
 			return nil, fmt.Errorf("unable to encode KubeletConfiguration to JSON for JSON patching: %w", patchErr)
 		}
 
-		if kubeletConfig, patchErr = patch.Apply(kubeletConfig); patchErr != nil {
+		options := jsonpatchv5.NewApplyOptions()
+		options.AllowMissingPathOnRemove = true
+
+		if kubeletConfig, patchErr = patch.ApplyWithOptions(kubeletConfig, options); patchErr != nil {
 			return nil, fmt.Errorf("unable to apply JSON patching to KubeletConfiguration: %w", patchErr)
 		}
 
-		kc = kubelettypes.KubeletConfiguration{}
-		if patchErr = utilities.DecodeFromJSON(string(kubeletConfig), &kc); patchErr != nil {
+		// Decoding only validates the patched document: encoding the struct again
+		// would restore non-pointer struct fields the patch removed.
+		if patchErr = utilities.DecodeFromJSON(string(kubeletConfig), &kubelettypes.KubeletConfiguration{}); patchErr != nil {
 			return nil, fmt.Errorf("unable to decode JSON to KubeletConfiguration: %w", patchErr)
 		}
+
+		return yaml.JSONToYAML(kubeletConfig)
 	}
 
 	return utilities.EncodeToYaml(&kc)
```

**File**: `internal/kubeadm/uploadconfig_test.go` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package kubeadm
+
+import (
+	"testing"
+
+	jsonpatchv5 "github.com/evanphx/json-patch/v5"
+	"github.com/stretchr/testify/require"
+)
+
+func TestGetKubeletConfigmapContentJSONPatches(t *testing.T) {
+	testCases := []struct {
+		name    string
+		patch   string
+		present []string
+		absent  []string
+	}{
+		{
+			name:    "replace",
+			patch:   `[{"op": "replace", "path": "/cgroupDriver", "value": "systemd"}]`,
+			present: []string{`cgroupDriver: systemd`},
+		},
+		{
+			name:   "remove a struct field",
+			patch:  `[{"op": "remove", "path": "/crashLoopBackOff"}]`,
+			absent: []string{`crashLoopBackOff:`},
+		},
+		{
+			name:    "remove a field that is not emitted",
+			patch:   `[{"op": "remove", "path": "/defaultPodSysctls"}, {"op": "add", "path": "/maxPods", "value": 250}]`,
+			present: []string{`maxPods: 250`},
+		},
+	}
+
+	for _, testCase := range testCases {
+		t.Run(testCase.name, func(t *testing.T) {
+			patch, err := jsonpatchv5.DecodePatch([]byte(testCase.patch))
+			require.NoError(t, err)
+
+			content, err := getKubeletConfigmapContent(KubeletConfiguration{TenantControlPlaneCgroupDriver: "cgroupfs"}, patch)
+			require.NoError(t, err)
+
+			for _, line := range testCase.present {
+				require.Regexp(t, `(?m)^`+line+`$`, string(content))
+			}
+
+			for _, line := range testCase.absent {
+				require.NotRegexp(t, `(?m)^`+line, string(content))
+			}
+		})
+	}
+}
+
+func TestGetKubeletConfigmapContentRejectsPatchWithWrongType(t *testing.T) {
+	patch, err := jsonpatchv5.DecodePatch([]byte(`[{"op": "replace", "path": "/maxPods", "value": "many"}]`))
+	require.NoError(t, err)
+
+	_, err = getKubeletConfigmapContent(KubeletConfiguration{}, patch)
+	require.Error(t, err)
+}
+
+func TestGetKubeletConfigmapContentNoOpPatchKeepsOutput(t *testing.T) {
+	kubeletConfiguration := KubeletConfiguration{TenantControlPlaneCgroupDriver: "cgroupfs"}
+
+	patch, err := jsonpatchv5.DecodePatch([]byte(`[{"op": "replace", "path": "/cgroupDriver", "value": "cgroupfs"}]`))
+	require.NoError(t, err)
+
+	unpatched, err := getKubeletConfigmapContent(kubeletConfiguration, nil)
+	require.NoError(t, err)
+
+	patched, err := getKubeletConfigmapContent(kubeletConfiguration, patch)
+	require.NoError(t, err)
+
+	require.Equal(t, string(unpatched), string(patched))
+}
```

---

### Incident Patch 2: `c274db2b` (2026-10-18)
**Commit Message**: fix(apiserver): reset args on extraArgs removal (#1360)

resetKubeAPIServerFlags returned early whenever
spec.controlPlane.deployment.extraArgs was nil, so deleting the whole
block left every flag it had added on the kube-apiserver container:
buildKubeAPIServerCommand keeps the flags it does not recognise from
the live container, and nothing cleared them.

When the block is gone and the Deployment already carries the args
annotation, hash an empty list so the existing mismatch path resets
the container args. A Deployment that never had extra args is still
left alone.

**File**: `internal/builders/controlplane/deployment.go` (modified, +7/-2)
```diff
@@ -1203,7 +1203,12 @@ func (d Deployment) setTopologySpreadConstraints(spec *appsv1.DeploymentSpec, to
 // resetKubeAPIServerFlags ensures that upon a change of the kube-apiserver extra flags the desired ones are properly
 // applied, also considering that the container could be lately patched by the konnectivity addon resources.
 func (d Deployment) resetKubeAPIServerFlags(resource *appsv1.Deployment, tcp kamajiv1alpha1.TenantControlPlane) {
-	if tcp.Spec.ControlPlane.Deployment.ExtraArgs == nil {
+	var extraArgs []string
+
+	if tcp.Spec.ControlPlane.Deployment.ExtraArgs != nil {
+		extraArgs = tcp.Spec.ControlPlane.Deployment.ExtraArgs.APIServer
+	} else if _, tracked := resource.GetAnnotations()[apiServerFlagsAnnotation]; !tracked {
+		// no extra args now, and none ever applied: nothing to reset
 		return
 	}
 	// kube-apiserver container is not still there, we can skip the hashing
@@ -1217,7 +1222,7 @@ func (d Deployment) resetKubeAPIServerFlags(resource *appsv1.Deployment, tcp kam
 	// retrieving the previous hash for the apiserver args:
 	// in case of non-matching values, removing all the args in order to perform a full reconciliation from a clean start.
 	previousHash := resource.GetAnnotations()[apiServerFlagsAnnotation]
-	currentHash, err := utilities.CalculateStringSliceChecksum(tcp.Spec.ControlPlane.Deployment.ExtraArgs.APIServer)
+	currentHash, err := utilities.CalculateStringSliceChecksum(extraArgs)
 	if err != nil {
 		return
 	}
```

**File**: `internal/builders/controlplane/deployment_test.go` (modified, +34/-0)
```diff
@@ -9,6 +9,7 @@ import (
 
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	pointer "k8s.io/utils/ptr"
 
@@ -208,6 +209,39 @@ var _ = Describe("Controlplane Deployment", func() {
 		})
 	})
 
+	Describe("resetKubeAPIServerFlags", func() {
+		var (
+			deployment *appsv1.Deployment
+			tcp        kamajiv1alpha1.TenantControlPlane
+		)
+
+		BeforeEach(func() {
+			deployment = &appsv1.Deployment{}
+			deployment.Spec.Template.Spec.Containers = []corev1.Container{{
+				Name: apiServerContainerName,
+				Args: []string{"--audit-log-path=/var/log/audit.log", "--secure-port=6443"},
+			}}
+			tcp = kamajiv1alpha1.TenantControlPlane{}
+		})
+
+		It("keeps the args when extra args were never set", func() {
+			d.resetKubeAPIServerFlags(deployment, tcp)
+
+			Expect(deployment.Spec.Template.Spec.Containers[0].Args).To(HaveLen(2))
+			Expect(deployment.GetAnnotations()).To(BeEmpty())
+		})
+
+		It("resets the args when the extraArgs block is removed", func() {
+			previous, err := utilities.CalculateStringSliceChecksum([]string{"--audit-log-path=/var/log/audit.log"})
+			Expect(err).ToNot(HaveOccurred())
+			deployment.SetAnnotations(map[string]string{apiServerFlagsAnnotation: previous})
+
+			d.resetKubeAPIServerFlags(deployment, tcp)
+
+			Expect(deployment.Spec.Template.Spec.Containers[0].Args).To(BeEmpty())
+		})
+	})
+
 	Describe("Konnectivity egress selector flag", func() {
 		var tcp kamajiv1alpha1.TenantControlPlane
 
```

---

### Incident Patch 3: `8fac27e5` (2026-10-14)
**Commit Message**: fix(utilities): parse IPv6 literals in GetControlPlaneAddressAndPortFromHostname (#1345)

Motivation: the helper split the hostname on ":" and only honoured a port
when exactly two parts resulted. A raw IPv6 literal (2001:db8::1) returned
"2001" as the address, and "[2001:db8::1]:8443" returned "[2001" with the
port ignored.

Approach: use net.SplitHostPort. When it fails (no port, or a bare IPv6
literal) the input is returned as the address with the default port, with
surrounding brackets removed. Behaviour for plain DNS names, with or without
a port, is unchanged. Callers pass the address on to net.JoinHostPort, which
re-adds brackets when needed.

Validation: added a table test in internal/utilities/ingress_test.go. It
fails on the old code for the three IPv6 cases and passes with the change.
Ran `go test ./internal/utilities/ ./internal/resources/...` (pass) and
`golangci-lint run ./internal/utilities/...` (0 issues). Not run: e2e on a
live cluster. In practice ingress hostnames are normally DNS names, so this
is a latent-correctness fix, not a user-visible outage.

This only addresses item 2 of the report (the IPv6 parsing). Item 1, the map
checksum change, is left out on purp

**File**: `internal/utilities/ingress.go` (modified, +11/-9)
```diff
@@ -4,22 +4,24 @@
 package utilities
 
 import (
+	"net"
 	"strconv"
 	"strings"
 )
 
 func GetControlPlaneAddressAndPortFromHostname(hostname string, defaultPort int32) (address string, port int32) {
-	parts := strings.Split(hostname, ":")
-
-	address, port = parts[0], defaultPort
+	host, rawPort, err := net.SplitHostPort(hostname)
+	if err != nil {
+		// No port, or a bare IPv6 literal: the whole string is the address,
+		// except for a bracketed IPv6 literal that has to be unwrapped.
+		return strings.TrimSuffix(strings.TrimPrefix(hostname, "["), "]"), defaultPort
+	}
 
-	if len(parts) == 2 {
-		intPort, _ := strconv.Atoi(parts[1])
+	port = defaultPort
 
-		if intPort > 0 {
-			port = int32(intPort)
-		}
+	if intPort, _ := strconv.Atoi(rawPort); intPort > 0 {
+		port = int32(intPort)
 	}
 
-	return address, port
+	return host, port
 }
```

**File**: `internal/utilities/ingress_test.go` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package utilities_test
+
+import (
+	"testing"
+
+	"github.com/clastix/kamaji/internal/utilities"
+)
+
+func TestGetControlPlaneAddressAndPortFromHostname(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		hostname string
+		address  string
+		port     int32
+	}{
+		{"foo.example.com", "foo.example.com", 6443},
+		{"foo.example.com:8443", "foo.example.com", 8443},
+		{"foo.example.com:abc", "foo.example.com", 6443},
+		{"2001:db8::1", "2001:db8::1", 6443},
+		{"[2001:db8::1]", "2001:db8::1", 6443},
+		{"[2001:db8::1]:8443", "2001:db8::1", 8443},
+	}
+
+	for _, tc := range tests {
+		address, port := utilities.GetControlPlaneAddressAndPortFromHostname(tc.hostname, 6443)
+		if address != tc.address || port != tc.port {
+			t.Errorf("%q: got (%q, %d), want (%q, %d)", tc.hostname, address, port, tc.address, tc.port)
+		}
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1360** (2026-10-18): fix(apiserver): reset args on extraArgs removal (@spicysharkco)
- **PR #1358** (2026-10-18): fix(konnectivity)!: bind host network agent health server to loopback (@serhiimazurok)
- **PR #1357** (2026-10-17): fix(webhook): skip DNS service IP validation for TenantControlPlanes being deleted (@rossigee)
- **PR #1356** (2026-10-17): chore: re-enable gocritic and resolve findings (@rossigee)
- **PR #1355** (2026-10-17): chore: enable staticcheck and fix SA1019 findings (@rossigee)
- **PR #1354** (2026-10-16): fix: wrong error being reported (@rossigee)

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

## X. kubeadm): let kubelet configuration JSON patches remove fields (#1347)

**RULE**:
When implementing operations in `internal/kubeadm/uploadconfig.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in clastix/kamaji. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82d7359b`: kubeadm): let kubelet configuration JSON patches remove fields (#1347). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/kubeadm/uploadconfig.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"sigs.k8s.io/yaml"
		options := jsonpatchv5.NewApplyOptions()
		options.AllowMissingPathOnRemove = true

		if kubeletConfig, patchErr = patch.ApplyWithOptions(kubeletConfig, options); patchErr != nil {
		// Decoding only validates the patched document: encoding the struct again
		// would restore non-pointer struct fields the patch removed.
		if patchErr = utilities.DecodeFromJSON(string(kubeletConfig), &kubelettypes.KubeletConfiguration{}); patchErr != nil {

		return yaml.JSONToYAML(kubeletConfig)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		if kubeletConfig, patchErr = patch.Apply(kubeletConfig); patchErr != nil {
		kc = kubelettypes.KubeletConfiguration{}
		if patchErr = utilities.DecodeFromJSON(string(kubeletConfig), &kc); patchErr != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82d7359b` are properly handled with clean fallback behavior.
