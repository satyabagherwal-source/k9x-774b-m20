> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clastix-kamaji-learnings.md`  
> **Source**: github ([https://github.com/clastix/kamaji](https://github.com/clastix/kamaji))  
> **Source Version**: `38c2563a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T06:02:54.983Z  
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
> **Harvest Timestamp**: 2026-10-23T06:02:54.664Z  
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

### Incident Patch 1: `34dd780a` (2026-10-21)
**Commit Message**: fix(cmd): bind the zap logger flags on the root command (#1383)

The manager and kubeconfig-generator commands built the zap logger and
called ctrl.SetLogger while the command was constructed, before cobra
parsed the command line. The --zap-* flags were bound to options that
were already copied, so they never changed the logger. The migrate
command had no zap flags and logged through whichever logger the other
two commands had set.

Bind the zap flags once on the root command's persistent flags and call
ctrl.SetLogger in the root PersistentPreRun, which runs after the flags
are parsed. Drop the per-command blocks. The default stays development
mode with the console encoder, and migrate now accepts the same flags.

Signed-off-by: spicysharkco <[REDACTED_EMAIL]>

**File**: `cmd/kubeconfig-generator/cmd.go` (modified, +0/-10)
```diff
@@ -4,7 +4,6 @@
 package kubeconfiggenerator
 
 import (
-	"flag"
 	"fmt"
 	"io"
 	"os"
@@ -20,7 +19,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/cache"
 	"sigs.k8s.io/controller-runtime/pkg/event"
 	"sigs.k8s.io/controller-runtime/pkg/healthz"
-	"sigs.k8s.io/controller-runtime/pkg/log/zap"
 
 	cmdutils "github.com/clastix/kamaji/cmd/utils"
 	"github.com/clastix/kamaji/controllers"
@@ -149,14 +147,6 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 			return nil
 		},
 	}
-	// Setting zap logger
-	zapfs := flag.NewFlagSet("zap", flag.ExitOnError)
-	opts := zap.Options{
-		Development: true,
-	}
-	opts.BindFlags(zapfs)
-	cmd.Flags().AddGoFlagSet(zapfs)
-	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))
 	// Setting CLI flags
 	cmd.Flags().StringVar(&metricsBindAddress, "metrics-bind-address", ":8090", "The address the metric endpoint binds to.")
 	cmd.Flags().BoolVar(&metricsSecure, "metrics-secure", false, "If set, the metrics endpoint is served over HTTPS and requires a bearer token authorized against the manager's kamaji-metrics-reader ClusterRole, instead of being served in plaintext without authentication.")
```

**File**: `cmd/manager/cmd.go` (modified, +0/-10)
```diff
@@ -4,7 +4,6 @@
 package manager
 
 import (
-	"flag"
 	"fmt"
 	"io"
 	"net/http"
@@ -23,7 +22,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/cache"
 	"sigs.k8s.io/controller-runtime/pkg/event"
 	"sigs.k8s.io/controller-runtime/pkg/healthz"
-	"sigs.k8s.io/controller-runtime/pkg/log/zap"
 	ctrlwebhook "sigs.k8s.io/controller-runtime/pkg/webhook"
 	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
 
@@ -336,14 +334,6 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 		},
 	}
 
-	// Setting zap logger
-	zapfs := flag.NewFlagSet("zap", flag.ExitOnError)
-	opts := zap.Options{
-		Development: true,
-	}
-	opts.BindFlags(zapfs)
-	cmd.Flags().AddGoFlagSet(zapfs)
-	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))
 	// Setting CLI flags
 	cmd.Flags().StringVar(&metricsBindAddress, "metrics-bind-address", ":8080", "The address the metric endpoint binds to.")
 	cmd.Flags().BoolVar(&metricsSecure, "metrics-secure", false, "If set, the metrics endpoint is served over HTTPS and requires a bearer token authorized against the manager's kamaji-metrics-reader ClusterRole, instead of being served in plaintext without authentication.")
```

**File**: `cmd/root.go` (modified, +15/-1)
```diff
@@ -4,22 +4,33 @@
 package cmd
 
 import (
+	"flag"
+
 	"github.com/spf13/cobra"
 	_ "go.uber.org/automaxprocs" // Automatically set `GOMAXPROCS` to match Linux container CPU quota.
 	"k8s.io/apimachinery/pkg/runtime"
 	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
 	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
 	appsv1 "k8s.io/kubernetes/pkg/apis/apps/v1"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/log/zap"
 	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
 
 	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
 )
 
 func NewCmd(scheme *runtime.Scheme) *cobra.Command {
-	return &cobra.Command{
+	zapfs := flag.NewFlagSet("zap", flag.ExitOnError)
+	opts := zap.Options{
+		Development: true,
+	}
+	opts.BindFlags(zapfs)
+
+	cmd := &cobra.Command{
 		Use:   "kamaji",
 		Short: "Build and operate Kubernetes at scale with a fraction of operational burden.",
 		PersistentPreRun: func(*cobra.Command, []string) {
+			ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))
 			utilruntime.Must(clientgoscheme.AddToScheme(scheme))
 			utilruntime.Must(kamajiv1alpha1.AddToScheme(scheme))
 			utilruntime.Must(appsv1.RegisterDefaults(scheme))
@@ -28,4 +39,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 			utilruntime.Must(gatewayv1.Install(scheme))
 		},
 	}
+	cmd.PersistentFlags().AddGoFlagSet(zapfs)
+
+	return cmd
 }
```

---

### Incident Patch 2: `c2e28336` (2026-10-22)
**Commit Message**: fix(e2e): wait for freeze webhook enforcement before asserting writes (#1387)

A freshly created ValidatingWebhookConfiguration is enforced asynchronously
by the tenant API server admission plugin, so a write issued right after the
webhook is observed can bypass it: the Consistently assertion failed after
4ms with a nil error on a first delete that never reached the webhook.

Probe with a throwaway Namespace until blocking is effective before
asserting it stays effective for the migration window.

**File**: `e2e/tcp_migration_test.go` (modified, +15/-0)
```diff
@@ -176,6 +176,21 @@ func featureTestMigration(driver string) {
 		}
 
 		By("ensuring changes are not allowed")
+		// A freshly created ValidatingWebhookConfiguration is enforced asynchronously by
+		// the API server admission plugin: a write issued right after the webhook has
+		// been observed can bypass it entirely. Probe with a throwaway Namespace until
+		// blocking is effective - the probe must be disposable, since a bypassed delete
+		// succeeds and removes the object - before asserting blocking is consistent.
+		Eventually(func() error {
+			probe := &corev1.Namespace{}
+			probe.SetName(fmt.Sprintf("freeze-probe-%s", rand.String(5)))
+
+			if err := tcpClient.Create(context.Background(), probe); err != nil {
+				return err
+			}
+
+			return tcpClient.Delete(context.Background(), probe)
+		}, time.Minute, time.Second).Should(HaveOccurred())
 		Consistently(func() error {
 			return tcpClient.Delete(context.Background(), ns)
 		}, 10*time.Second, time.Second).Should(HaveOccurred())
```

---

### Incident Patch 3: `38c2563a` (2026-10-23)
**Commit Message**: fix(tcp): clear removed DataStore overrides (#1389)

Removing dataStoreOverrides left the previous etcd-servers-overrides
argument on kube-apiserver because the argument merge kept it once
it was no longer managed. Drop it from the previous arguments when
no overrides remain. Values in extraArgs.apiServer are still applied.

Signed-off-by: spicysharkco <[REDACTED_EMAIL]>

**File**: `internal/builders/controlplane/deployment.go` (modified, +7/-0)
```diff
@@ -8,6 +8,7 @@ import (
 	"crypto/md5"
 	"fmt"
 	"path"
+	"slices"
 	"sort"
 	"strings"
 
@@ -763,6 +764,12 @@ func (d Deployment) buildKubeAPIServerCommand(tenantControlPlane kamajiv1alpha1.
 
 	if len(d.DataStoreOverrides) != 0 {
 		managed["--etcd-servers-overrides"] = d.etcdServersOverrides()
+	} else {
+		current = slices.DeleteFunc(current, func(arg string) bool {
+			flag, _, _ := strings.Cut(arg, "=")
+
+			return flag == "--etcd-servers-overrides"
+		})
 	}
 	// The Konnectivity addon flag is rendered together with the managed flags,
 	// in sorted position, so that the argument list is deterministic from the
```

**File**: `internal/builders/controlplane/deployment_test.go` (modified, +30/-0)
```diff
@@ -38,6 +38,36 @@ var _ = Describe("Controlplane Deployment", func() {
 	})
 
 	Describe("DataStoreOverrides flag generation", func() {
+		It("drops the flag after DataStoreOverrides are removed", func() {
+			d.DataStore.Spec.Driver = kamajiv1alpha1.EtcdDriver
+			tcp := kamajiv1alpha1.TenantControlPlane{}
+			first := d.buildKubeAPIServerCommand(tcp, "192.0.2.1", nil)
+			Expect(first).To(ContainElement("--etcd-servers-overrides=/events#https://etcd-0;https://etcd-1;https://etcd-2"))
+
+			d.DataStoreOverrides = nil
+			current := append(first, "--watch-cache=false")
+			got := d.buildKubeAPIServerCommand(tcp, "192.0.2.1", current)
+			Expect(got).To(ContainElement("--watch-cache=false"))
+			Expect(got).To(Equal(d.buildKubeAPIServerCommand(tcp, "192.0.2.1", []string{"--watch-cache=false"})))
+		})
+
+		It("keeps user extraArgs after DataStoreOverrides are emptied", func() {
+			d.DataStore.Spec.Driver = kamajiv1alpha1.EtcdDriver
+			extraArgs := []string{
+				"--service-account-issuer=https://issuer-two.example.com",
+				"--service-account-issuer=https://issuer-one.example.com",
+				"--etcd-servers-overrides=/events#https://custom-etcd",
+			}
+			tcp := kamajiv1alpha1.TenantControlPlane{}
+			tcp.Spec.ControlPlane.Deployment.ExtraArgs = &kamajiv1alpha1.ControlPlaneExtraArgs{APIServer: extraArgs}
+			first := d.buildKubeAPIServerCommand(tcp, "192.0.2.1", nil)
+
+			d.DataStoreOverrides = []DataStoreOverrides{}
+			got := d.buildKubeAPIServerCommand(tcp, "192.0.2.1", first)
+			Expect(got).To(Equal(d.buildKubeAPIServerCommand(tcp, "192.0.2.1", nil)))
+			Expect(got[len(got)-len(extraArgs):]).To(Equal(extraArgs))
+		})
+
 		It("should generate valid --etcd-servers-overrides value", func() {
 			etcdSerVersOverrides := d.etcdServersOverrides()
 			Expect(etcdSerVersOverrides).To(Equal("/events#https://etcd-0;https://etcd-1;https://etcd-2"))
```

#### Recent Merged Pull Requests:
- **PR #1389** (2026-10-23): fix(tcp): clear removed DataStore overrides (@spicysharkco)
- **PR #1387** (2026-10-22): fix(e2e): wait for freeze webhook enforcement before asserting writes (@Sphinxgaia)
- **PR #1386** (2026-10-22): feat: headless control plane service support (@Sphinxgaia)
- **PR #1383** (2026-10-21): fix(cmd): bind the zap logger flags on the root command (@spicysharkco)
- **PR #1381** (2026-10-20): docs(reference): fix --datastore and --migrate-image rows (@spicysharkco)
- **PR #1379** (2026-10-20): docs(guides): fix write permissions field names (@spicysharkco)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
