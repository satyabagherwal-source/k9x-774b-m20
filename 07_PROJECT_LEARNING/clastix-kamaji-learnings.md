# Forensic Learning Record (Deep Inspection): clastix/kamaji

> **Canonical Artifact**: `07_PROJECT_LEARNING/clastix-kamaji-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/clastix/kamaji](https://github.com/clastix/kamaji))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:40:56.709Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `clastix/kamaji`
- **Description**: Kamaji is the Hosted Control Plane Manager for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2043 stars

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

### Core Architecture Module: `internal/resources/addons/coredns.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package addons

import (
	"bytes"
	"context"
	"fmt"
	"net"

	"github.com/prometheus/client_golang/prometheus"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
	"github.com/clastix/kamaji/internal/constants"
	"github.com/clastix/kamaji/internal/kubeadm"
	"github.com/clastix/kamaji/internal/resources"
	addons_utils "github.com/clastix/kamaji/internal/resources/addons/utils"
	"github.com/clastix/kamaji/internal/resources/utils"
	"github.com/clastix/kamaji/internal/utilities"
)

type CoreDNS struct {
	Client client.Client

	deployment         *appsv1.Deployment
	configMap          *corev1.ConfigMap
	service            *corev1.Service
	clusterRole        *rbacv1.ClusterRole
	clusterRoleBinding *rbacv1.ClusterRoleBinding
	serviceAccount     *corev1.ServiceAccount
}

func (c *CoreDNS) GetHistogram() prometheus.Histogram {
	coreDNSCollector = resources.LazyLoadHistogramFromResource(coreDNSCollector, c)

	return coreDNSCollector
}

func (c *CoreDNS) Define(context.Context, *kamajiv1alpha1.TenantControlPlane) error {
	c.deployment = &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      kubeadm.CoreDNSName,
			Namespace: kubeadm.KubeSystemNamespace,
		},
	}
	c.configMap = &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      kubeadm.CoreDNSName,
			Namespace: kubeadm.KubeSystemNamespace,
		},
	}
	c.service = &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      kubeadm.CoreDNSServiceName,
			Namespace: kubeadm.KubeSystemNamespace,
		},
	}
	c.clusterRole = &rbacv1.ClusterRole{
		ObjectMeta: metav1.ObjectMeta{
			Name: kubeadm.CoreDNSClusterRoleName,
		},
	}
	c.clusterRoleBinding = &rbacv1.ClusterRoleBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name: kubeadm.CoreDNSClusterRoleBindingName,
		},
	}
	c.serviceAccount = &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name:      kubeadm.CoreDNSName,
			Namespace: kubeadm.KubeSystemNamespace,
		},
	}

	return nil
}

func (c *CoreDNS) ShouldCleanup(tcp *kamajiv1alpha1.TenantControlPlane) bool {
	return tcp.Spec.Addons.CoreDNS == nil && tcp.Status.Addons.CoreDNS.Enabled
}

func (c *CoreDNS) CleanUp(ctx context.Context, tcp *kamajiv1alpha1.TenantControlPlane) (bool, error) {
	logger := log.FromContext(ctx, "resource", "kubeadm_addons", "addon", c.GetName())

	tenantClient, err := utilities.GetTenantClient(ctx, c.Client, tcp)
	if err != nil {
		logger.Error(err, "cannot generate Tenant client")

		return false, err
	}

	var deleted bool

	for _, obj := range []client.Object{c.serviceAccount, c.clusterRoleBinding, c.clusterRole, c.service, c.configMap, c.deployment} {
		objectKey := client.ObjectKeyFromObject(obj)

		if err = tenantClient.Get(ctx, objectKey, obj); err != nil {
			if k8serrors.IsNotFound(err) {
				continue
			}
		}
		// Don't delete resource if it is not managed by Kamaji
		if labels := obj.GetLabels(); labels == nil || labels[constants.ProjectNameLabelKey] != constants.ProjectNameLabelValue {
			continue
		}

		if err = tenantClient.Delete(ctx, obj); err != nil {
			if k8serrors.IsNotFound(err) {
				continue
			}

			return false, err
		}

		deleted = true
	}

	return deleted, nil
}

func (c *CoreDNS) CreateOrUpdate(ctx context.Context, tcp *kamajiv1alpha1.TenantControlPlane) (controllerutil.OperationResult, error) {
	logger := log.FromContext(ctx, "addon", c.GetName())

	if tcp.Spec.Addons.CoreDNS == nil {
		return controllerutil.OperationResultNone, nil
	}

	tenantClient, err := utilities.GetTenantClient(ctx, c.Client, tcp)
	if err != nil {
		logger.Error(err, "cannot generate Tenant client")

		return controllerutil.OperationResultNone, err
	}

	if err = c.decodeManifests(ctx, tcp); err != nil {
		logger.Error(err, "manifest decoding failed")

		return controllerutil.OperationResultNone, err
	}

	var operationResult controllerutil.OperationResult

	reconciliationResult := controllerutil.OperationResultNone
	// ClusterRoleBinding
	operationResult, err = c.mutateClusterRoleBinding(ctx, tenantClient)
	if err != nil {
		logger.Error(err, "ClusterRoleBinding reconciliation failed")

		return controllerutil.OperationResultNone, err
	}
	reconciliationResult = utils.UpdateOperationResult(reconciliationResult, operationResult)
	// Deployment
	operationResult, err = c.mutateDeployment(ctx, tenantClient)
	if err != nil {
		logger.Error(err, "Deployment reconciliation failed")

		return controllerutil.OperationResultNone, err
	}
	reconciliationResult = utils.UpdateOperationResult(reconciliationResult, operationResult)
	// ConfigMap
	operationResult, err = c.mutateConfigMap(ctx, tenantClient)
	if err != nil {
		logger.Error(err, "ConfigMap reconciliation failed")

		return controllerutil.OperationResultNone, err
	}
	reconciliationResult = utils.UpdateOperationResult(reconciliationResult, operationResult)
	// Service
	operationResult, err = c.mutateService(ctx, tenantClient)
	if err != nil {
		logger.Error(err, "Service reconciliation failed")

		return controllerutil.OperationResultNone, err
	}
	reconciliationResult = utils.UpdateOperationResult(reconciliationResult, operationResult)
	// ClusterRole
	operationResult, err = c.mutateClusterRole(ctx, tenantClient)
	if err != nil {
		logger.Error(err, "ClusterRole reconciliation failed")

		return controllerutil.OperationResultNone, err
	}
	reconciliationResult = utils.UpdateOperationResult(reconciliationResult, operationResult)
	// ServiceAccount
	operationResult, err = c.mutateServiceAccount(ctx, tenantClient)
	if err != nil {
		logger.Error(err, "ServiceAccount reconciliation failed")

		return controllerutil.OperationResultNone, err
	}
	reconciliationResult = utils.UpdateOperationResult(reconciliationResult, operationResult)

	return reconciliationResult, nil
}

func (c *CoreDNS) GetName() string {
	return "coredns"
}

func (c *CoreDNS) ShouldStatusBeUpdated(_ context.Context, tcp *kamajiv1alpha1.TenantControlPlane) bool {
	return tcp.Spec.Addons.CoreDNS != nil && !tcp.Status.Addons.CoreDNS.Enabled
}

func (c *CoreDNS) UpdateTenantControlPlaneStatus(_ context.Context, tcp *kamajiv1alpha1.TenantControlPlane) error {
	tcp.Status.Addons.CoreDNS.Enabled = tcp.Spec.Addons.CoreDNS != nil
	tcp.Status.Addons.CoreDNS.LastUpdate = metav1.Now()

	return nil
}

func (c *CoreDNS) decodeManifests(ctx context.Context, tcp *kamajiv1alpha1.TenantControlPlane) error {
	tcpClient, config, err := resources.GetKubeadmManifestDeps(ctx, c.Client, tcp)
	if err != nil {
		return fmt.Errorf("unable to create manifests dependencies: %w", err)
	}

	// If CoreDNS addon is enabled and with an override, adding these to the kubeadm init configuration
	config.Parameters.CoreDNSOptions = &kubeadm.AddonOptions{}

	if len(tcp.Spec.Addons.CoreDNS.ImageRepository) > 0 {
		config.Parameters.CoreDNSOptions.Repository = tcp.Spec.Addons.CoreDNS.ImageRepository
	}

	if len(tcp.Spec.Addons.CoreDNS.ImageRepository) > 0 {
		config.Parameters.CoreDNSOptions.Tag = tcp.Spec.Addons.CoreDNS.ImageTag
	}

	manifests, err := kubeadm.AddCoreDNS(tcpClient, config)
	if err != nil {
		return fmt.Errorf("unable to generate manifests: %w", err)
	}

	parts := bytes.Split(manifests, []byte("---"))

	if err = utilities.DecodeFromYAML(string(parts[1]), c.deployment); err != nil {
		return fmt.Errorf("unable to decode Deployment manifest: %w", err)
	}
	addons_utils.SetKamajiManagedLabels(c.deployment)

	if err = utilities.DecodeFromYAML(string(parts[2]), c.configMap); err != nil {
		return fmt.Errorf("unable to decode ConfigMap manifest: %w", err)
	}
	addons_utils.SetKamajiManagedLabels(c.configMap)

	if err = utilities.DecodeFromYAML(string(parts[3]), c.service); err != nil {
		return fmt.Errorf("unable to decode Service manifest: %w", err)
	}
	addons_utils.SetKamajiManagedLabels(c.service)

	// If multiple service CIDRs are defined, CoreDNS needs multiple service addresses
	// with matching IP families. This must run AFTER decoding the kubeadm Service
	// manifest: that manifest carries a single-family ClusterIP (derived from the
	// primary service subnet), which would otherwise overwrite ClusterIPs[0] and leave
	// ClusterIP != ClusterIPs[0] — rejected by the API server for a dual-stack Service.
	if len(tcp.Spec.NetworkProfile.DNSServiceIPs) > 1 {
		c.service.Spec.ClusterIP = tcp.Spec.NetworkProfile.DNSServiceIPs[0]
		c.service.Spec.ClusterIPs = tcp.Spec.NetworkProfile.DNSServiceIPs

		families := make([]corev1.IPFamily, 0, len(tcp.Spec.NetworkProfile.DNSServiceIPs))

		for _, ip := range tcp.Spec.NetworkProfile.DNSServiceIPs {
			parsedIP := net.ParseIP(ip)

			if parsedIP.To4() != nil {
				families = append(families, corev1.IPv4Protocol)
			} else if parsedIP.To16() != nil {
				families = append(families, corev1.IPv6Protocol)
			}
		}

		policy := corev1.IPFamilyPolicyPreferDualStack

		c.service.Spec.IPFamilies = families
		c.service.Spec.IPFamilyPolicy = &policy
	}

	if err = utilities.DecodeFromYAML(string(parts[4]), c.clusterRole); err != nil {
		return fmt.Errorf("unable to decode ClusterRole manifest: %w", err)
	}
	addons_utils.SetKamajiManagedLabels(c.clusterRole)

	if err = utilities.DecodeFromYAML(string(parts[5]), c.clusterRoleBinding); err != nil {
		return fmt.Errorf("unable to decode ClusterRoleBinding manifest: %w", err)
	}
	addons_utils.SetKamajiManagedLabels(c.clusterRoleBinding)

	if err = utilities.DecodeFromYAML(string(parts[6]), c.serviceAccount); err != nil {
		return fmt.Errorf("unable to decode ServiceAccount manifest: %w", err)
	}
	addons_utils.SetKamajiManagedLabels(c.serviceAccount)

	return nil
}

func (c *CoreDNS) mutateClusterRoleBinding(ctx context.Context, tenantClient client.Client) (controlleruti
```

### Core Architecture Module: `internal/resources/addons/utils/managed_labels.go`
```
// Copyright 2022 Clastix Labs
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/clastix/kamaji/internal/constants"
	"github.com/clastix/kamaji/internal/utilities"
)

func SetKamajiManagedLabels(obj client.Object) {
	obj.SetLabels(utilities.MergeMaps(obj.GetLabels(), map[string]string{
		constants.ProjectNameLabelKey: constants.ProjectNameLabelValue,
	}))
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

- **Issue #1285** (2026-10-03): **MySQL: default datastore username (UID) exceeds MySQL's 32-character limit**
  *Symptoms*: ### What happened  Creating a new `TenantControlPlane` backed by a MySQL DataStore never provisions. It stays in Provisioning with no control-plane pods, and the manager logs:  ``` ERROR unable to create the DataStore user {"resource": "datastore-setup",   "error": "unable to create the user: cannot create user:    Error 1470 (HY000): String 'f647f1f5-3ea2-42a0-9475-7fc1bace3217' is too long    for user name (should be no longer than 32 characters)"} ```  `status.storage.setup` stays empty and the TCP never progresses.  ### Cause  #1235 changed the datastore defaults in `api/v1alpha1/tenantcontrolplane_funcs.go` from `<namespace>_<name>` to the raw Kubernetes UID:  func (in *TenantControlPlane) GetDefaultDatastoreUsername() string { 	return string(in.UID) }  A Kubernetes UID is a 36-character UUID. MySQL stores account names in a `char(32)` column, so `CREATE USER` is rejected. PostgreSQL's limit is NAMEDATALEN-1 = 63, which is why this doesn't reproduce there and the datastore e2e coverage appears to be PostgreSQL-based (`e2e/tcp_postgres_datastore_config_secret_test.go`).  Note the schema name is not affected in practice: MySQL allows 64-character database names.  ### Affected versions  - First affected release: 26.7.4-edge. 26.7.3-edge is the last unaffected tag.  ### Not affected  Pre-existing tenants keep working: `internal/resources/datastore/datastore_storage_config.go` adopts `status.storage.setup.{user,schema}` before falling back to the defaults, so already-provisio
  **Post-Mortem & Fix Analysis**:
  > This is a bug. The e2e isn't catching this because we're assuming MySQL, but we're testing with MariaDB.  It would be great if we could address this, rather: https://github.com/clastix/kamaji/blob/80f32baafe34cba9d739c41208c21090dbe1827d/internal/resources/datastore/datastore_storage_config.go#L187-L192  We could have a switch statement and perform the `strings.ReplaceAll` only for MySQL.

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

### Incident Patch 1: `4ee7eed6` (2026-10-05)
**Commit Message**: fix: guard kubeconfig indexing against empty cluster and user entries (#1286)

Signed-off-by: Sai Asish Y <[REDACTED_EMAIL]>

**File**: `controllers/certificate_lifecycle_controller.go` (modified, +4/-0)
```diff
@@ -182,6 +182,10 @@ func (s *CertificateLifecycle) extractCertificateFromKubeconfig(secret corev1.Se
 		return nil, fmt.Errorf("none of the provided keys is containing a valid kubeconfig")
 	}
 
+	if len(kc.AuthInfos) == 0 {
+		return nil, fmt.Errorf("kubeconfig does not contain any user entries")
+	}
+
 	crt, err := crypto.ParseCertificateBytes(kc.AuthInfos[0].AuthInfo.ClientCertificateData)
 	if err != nil {
 		return nil, fmt.Errorf("cannot parse kubeconfig certificate bytes: %w", err)
```

**File**: `controllers/kubeconfiggenerator_controller.go` (modified, +3/-0)
```diff
@@ -309,6 +309,9 @@ func (r *KubeconfigGeneratorReconciler) generate(ctx context.Context, generator
 	}
 
 	clientCert, clientKey, err := pkiutil.NewCertAndKey(caCert, caKey, &clientCertConfig)
+	if err != nil {
+		return fmt.Errorf("cannot generate client certificate and key: %w", err)
+	}
 
 	contextUserName := generator.Name
 
```

**File**: `internal/utilities/tenant_client.go` (modified, +4/-0)
```diff
@@ -59,6 +59,10 @@ func GetRESTClientConfig(ctx context.Context, client client.Client, tenantContro
 		return nil, err
 	}
 
+	if len(kubeconfig.Clusters) == 0 || len(kubeconfig.AuthInfos) == 0 {
+		return nil, fmt.Errorf("kubeconfig is missing cluster or user entries")
+	}
+
 	config := &restclient.Config{
 		Host: fmt.Sprintf("https://%s.%s.svc:%d", tenantControlPlane.GetName(), tenantControlPlane.GetNamespace(), tenantControlPlane.Spec.NetworkProfile.Port),
 		TLSClientConfig: restclient.TLSClientConfig{
```

**File**: `internal/utilities/tenant_client_test.go` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package utilities
+
+import (
+	"context"
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	kubeadmconstants "k8s.io/kubernetes/cmd/kubeadm/app/constants"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+
+	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
+)
+
+func TestGetRESTClientConfigEmptyKubeconfig(t *testing.T) {
+	t.Parallel()
+
+	scheme := runtime.NewScheme()
+	if err := corev1.AddToScheme(scheme); err != nil {
+		t.Fatalf("failed adding corev1 scheme: %v", err)
+	}
+
+	secret := &corev1.Secret{
+		ObjectMeta: metav1.ObjectMeta{Name: "admin-kubeconfig", Namespace: "default"},
+		Data: map[string][]byte{
+			kubeadmconstants.SuperAdminKubeConfigFileName: []byte("apiVersion: v1\nkind: Config\n"),
+		},
+	}
+
+	c := fake.NewClientBuilder().WithScheme(scheme).WithObjects(secret).Build()
+
+	tcp := &kamajiv1alpha1.TenantControlPlane{
+		ObjectMeta: metav1.ObjectMeta{Name: "tcp", Namespace: "default"},
+	}
+	tcp.Status.KubeConfig.Admin.SecretName = secret.Name
+
+	if _, err := GetRESTClientConfig(context.Background(), c, tcp); err == nil {
+		t.Fatal("expected an error for a kubeconfig without cluster or user entries, got nil")
+	}
+}
```

---

### Incident Patch 2: `4e740da1` (2026-10-03)
**Commit Message**: fix(datastore): shorten default MySQL username to fit 32 chars (#1331)

Motivation:
The default DataStore username is the raw TenantControlPlane UID, a
36-character UUID. MySQL limits account names to 32 characters, so
CREATE USER fails with Error 1470 and a new TenantControlPlane without
spec.dataStoreUsername stays in Provisioning on MySQL. PostgreSQL
(limit 63) is not affected. MySQL schema names (limit 64) are not
affected either.

Approach:
When the DataStore driver is MySQL and the resolved username equals the
default (the UID, whether filled in by the defaulting webhook or by the
fallback), drop the hyphens, giving exactly 32 characters. Other drivers
keep the current behaviour, as suggested by the maintainer. Usernames
adopted from status or set explicitly to something else are untouched.
The webhook-populated spec value is not rewritten; the secret
(DB_USER, which datastore-setup uses) carries the shortened name.

Validation:
- Added a test in datastore_storage_config_test.go. It fails without the
  change (DB_USER is the hyphenated UID) and passes with it.
- go test ./internal/resources/datastore/... : ok
- golangci-lint run ./internal/resources/datastore/... : 0 issues
-

**File**: `internal/resources/datastore/datastore_storage_config.go` (modified, +6/-0)
```diff
@@ -6,6 +6,7 @@ package datastore
 import (
 	"context"
 	"fmt"
+	"strings"
 
 	"github.com/google/uuid"
 	"github.com/prometheus/client_golang/prometheus"
@@ -167,6 +168,11 @@ func (r *Config) mutate(ctx context.Context, tenantControlPlane *kamajiv1alpha1.
 			default:
 				username = []byte(tenantControlPlane.GetDefaultDatastoreUsername())
 			}
+			// MySQL account names are limited to 32 characters, a hyphenated UID is 36:
+			// the default username (also populated in the spec by the defaulting webhook) must drop the hyphens.
+			if r.DataStore.Spec.Driver == kamajiv1alpha1.KineMySQLDriver && len(tenantControlPlane.UID) > 0 && string(username) == tenantControlPlane.GetDefaultDatastoreUsername() {
+				username = []byte(strings.ReplaceAll(string(username), "-", ""))
+			}
 		}
 
 		var dataStoreSchema string
```

**File**: `internal/resources/datastore/datastore_storage_config_test.go` (modified, +21/-0)
```diff
@@ -77,6 +77,27 @@ var _ = Describe("DatastoreStorageConfig", func() {
 		})
 	})
 
+	When("TCP uses the default UID-based names on a MySQL DataStore", func() {
+		BeforeEach(func() {
+			tcp.UID = "f647f1f5-3ea2-42a0-9475-7fc1bace3217"
+			tcp.Spec.DataStoreUsername = tcp.GetDefaultDatastoreUsername()
+			tcp.Spec.DataStoreSchema = tcp.GetDefaultDatastoreSchema()
+			ds.Spec.Driver = kamajiv1alpha1.KineMySQLDriver
+		})
+
+		It("should strip the hyphens from the username to fit the 32 characters limit", func() {
+			op, err := resources.Handle(ctx, dsc, tcp)
+			Expect(err).ToNot(HaveOccurred())
+			Expect(op).To(Equal(controllerutil.OperationResultCreated))
+
+			secrets := &corev1.SecretList{}
+			Expect(fakeClient.List(ctx, secrets)).To(Succeed())
+			Expect(secrets.Items).To(HaveLen(1))
+			Expect(secrets.Items[0].Data["DB_USER"]).To(Equal([]byte("f647f1f53ea242a094757fc1bace3217")))
+			Expect(secrets.Items[0].Data["DB_SCHEMA"]).To(Equal([]byte(tcp.UID)))
+		})
+	})
+
 	When("TCP has dataStoreSchema and dataStoreUsername set in spec", func() {
 		BeforeEach(func() {
 			tcp.Spec.DataStoreSchema = "custom-prefix"
```

---

### Incident Patch 3: `8e6df49d` (2026-10-03)
**Commit Message**: fix(crypto): harden client certificate template and datastore TLS config (#1330)

Motivation: NewCertificateTemplate, used for datastore (system:masters)
and konnectivity client certificates, granted ServerAuth and CodeSigning
extended key usages that a client-auth certificate does not need, used a
non-cryptographic math/rand serial number, and a hardcoded SubjectKeyId
shared by every certificate. The datastore TLS config also left
MinVersion implicit.

Approach:
- restrict ExtKeyUsage to ClientAuth
- generate a random 128-bit serial with crypto/rand
- drop the static SubjectKeyId (the template has no public key to derive
  one from; none of the code references the old value)
- set MinVersion: tls.VersionTLS12 on the datastore tls.Config
- the konnectivity certificate validity check verified the certificate
  with ServerAuth; it is a client certificate, so it now verifies with
  ClientAuth (otherwise it would fail verification and be regenerated
  on each reconcile)

Impact: hardening only. Newly issued certificates are narrower; already
issued certificates are not modified. Go's client default TLS floor is
already 1.2, so MinVersion has no behavior change today.

Validation: added

**File**: `internal/crypto/crypto.go` (modified, +9/-7)
```diff
@@ -13,7 +13,6 @@ import (
 	"encoding/pem"
 	"fmt"
 	"math/big"
-	mathrand "math/rand"
 	"net"
 	"time"
 
@@ -270,20 +269,23 @@ func checkPublicKeys(a crypto.PublicKey, b crypto.Signer) bool {
 // NewCertificateTemplate returns the template that must be used to generate a certificate,
 // used to perform the authentication against the DataStore.
 func NewCertificateTemplate(commonName string) *x509.Certificate {
+	// A random 128-bit serial number, as recommended by RFC 5280.
+	serialNumber, err := cryptorand.Int(cryptorand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
+	if err != nil {
+		panic(fmt.Errorf("cannot generate the certificate serial number: %w", err))
+	}
+
 	return &x509.Certificate{
 		PublicKeyAlgorithm: x509.RSA,
-		SerialNumber:       big.NewInt(mathrand.Int63()),
+		SerialNumber:       serialNumber,
 		Subject: pkix.Name{
 			CommonName:   commonName,
 			Organization: []string{"system:masters"},
 		},
-		NotBefore:    time.Now(),
-		NotAfter:     time.Now().AddDate(10, 0, 0),
-		SubjectKeyId: []byte{1, 2, 3, 4, 6},
+		NotBefore: time.Now(),
+		NotAfter:  time.Now().AddDate(10, 0, 0),
 		ExtKeyUsage: []x509.ExtKeyUsage{
 			x509.ExtKeyUsageClientAuth,
-			x509.ExtKeyUsageServerAuth,
-			x509.ExtKeyUsageCodeSigning,
 		},
 		KeyUsage: x509.KeyUsageDigitalSignature,
 	}
```

**File**: `internal/crypto/crypto_test.go` (modified, +17/-0)
```diff
@@ -120,3 +120,20 @@ func GenerateSelfSignedCA() ([]byte, []byte, error) {
 
 	return certPEM, keyPEM, nil
 }
+
+func TestNewCertificateTemplate(t *testing.T) {
+	a := NewCertificateTemplate("a")
+	b := NewCertificateTemplate("b")
+
+	if len(a.ExtKeyUsage) != 1 || a.ExtKeyUsage[0] != x509.ExtKeyUsageClientAuth {
+		t.Errorf("expected only the client auth extended key usage, got %v", a.ExtKeyUsage)
+	}
+
+	if a.SerialNumber.Cmp(b.SerialNumber) == 0 {
+		t.Errorf("expected distinct serial numbers, got %v twice", a.SerialNumber)
+	}
+
+	if len(a.SubjectKeyId) != 0 {
+		t.Errorf("expected no static SubjectKeyId, got %v", a.SubjectKeyId)
+	}
+}
```

**File**: `internal/datastore/datastore.go` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ func NewConnectionConfig(ctx context.Context, client client.Client, ds kamajiv1a
 		}
 
 		tlsConfig = &tls.Config{
-			RootCAs: rootCAs,
+			RootCAs:    rootCAs,
+			MinVersion: tls.VersionTLS12,
 		}
 	}
 
```

**File**: `internal/resources/konnectivity/certificate_resource.go` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ func (r *CertificateResource) mutate(ctx context.Context, tenantControlPlane *ka
 		isRotationRequested := utilities.IsRotationRequested(r.resource)
 
 		if checksum := tenantControlPlane.Status.Addons.Konnectivity.Certificate.Checksum; !isRotationRequested && (len(checksum) > 0 && checksum == utilities.CalculateMapChecksum(r.resource.Data)) {
-			isCAValid, err := crypto.VerifyCertificate(r.resource.Data[corev1.TLSCertKey], secretCA.Data[kubeadmconstants.CACertName], x509.ExtKeyUsageServerAuth)
+			isCAValid, err := crypto.VerifyCertificate(r.resource.Data[corev1.TLSCertKey], secretCA.Data[kubeadmconstants.CACertName], x509.ExtKeyUsageClientAuth)
 			if err != nil {
 				logger.Info(fmt.Sprintf("certificate-authority verify failed: %s", err.Error()))
 			}
```

---

### Incident Patch 4: `6572a053` (2026-09-24)
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

### Incident Patch 5: `baa99fb2` (2026-09-15)
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

### Incident Patch 6: `b45878e6` (2026-09-12)
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

### Incident Patch 7: `01914220` (2026-09-12)
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

### Incident Patch 8: `02030999` (2026-09-10)
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

### Incident Patch 9: `f149dbfe` (2026-09-10)
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

**File**: `charts/kamaji-crds/hack/kamaji.clastix.io_tenantcontrolplanes_spec.yaml` (modified, +12/-0)
```diff
@@ -7188,6 +7188,10 @@ versions:
                               type: string
                             type: array
                           controllerManager:
+                            description: |-
+                              ControllerManager extra args. Kamaji sets --bind-address to the IPv6 wildcard "::"
+                              (which also serves IPv4 on a dual-stack pod); on hosts with IPv6 disabled in the
+                              kernel, override it to "0.0.0.0" here.
                             items:
                               type: string
                             type: array
@@ -7197,6 +7201,10 @@ versions:
                               type: string
                             type: array
                           scheduler:
+                            description: |-
+                              Scheduler extra args. Kamaji sets --bind-address to the IPv6 wildcard "::"
+                              (which also serves IPv4 on a dual-stack pod); on hosts with IPv6 disabled in the
+                              kernel, override it to "0.0.0.0" here.
                             items:
                               type: string
                             type: array
@@ -8992,6 +9000,8 @@ versions:
                     x-kubernetes-validations:
                       - message: all podCidrs entries must be valid CIDRs
                         rule: self.all(x, isCIDR(x))
+                      - message: podCidrs must not contain two CIDRs of the same IP family
+                        rule: size(self) < 2 || cidr(self[0]).ip().family() != cidr(self[1]).ip().family()
                   port:
                     default: 6443
                     description: Port where API server will be exposed
@@ -9019,6 +9029,8 @@ versions:
                     x-kubernetes-validations:
                       - message: all serviceCidrs entries must be valid CIDRs
                         rule: self.all(x, isCIDR(x))
+                      - message: serviceCidrs must not contain two CIDRs of the same IP family
+                        rule: size(self) < 2 || cidr(self[0]).ip().family() != cidr(self[1]).ip().family()
                 type: object
               writePermissions:
                 description: |-
```

**File**: `charts/kamaji/crds/kamaji.clastix.io_datastores.yaml` (modified, +5/-0)
```diff
@@ -132,9 +132,14 @@ spec:
                     List of the endpoints to connect to the shared datastore.
                     No need for protocol, just bare IP/FQDN and port.
                   items:
+                    maxLength: 256
                     type: string
+                  maxItems: 64
                   minItems: 1
                   type: array
+                  x-kubernetes-validations:
+                    - message: an IPv6 endpoint address must be bracketed, e.g. [2001:db8::1]:2379
+                      rule: self.all(e, e.startsWith('[') || e.split(':').size() <= 2)
                 tlsConfig:
                   description: |-
                     Defines the TLS/SSL configuration required to connect to the data store in a secure way.
```

**File**: `charts/kamaji/crds/kamaji.clastix.io_tenantcontrolplanes.yaml` (modified, +12/-0)
```diff
@@ -7196,6 +7196,10 @@ spec:
                                 type: string
                               type: array
                             controllerManager:
+                              description: |-
+                                ControllerManager extra args. Kamaji sets --bind-address to the IPv6 wildcard "::"
+                                (which also serves IPv4 on a dual-stack pod); on hosts with IPv6 disabled in the
+                                kernel, override it to "0.0.0.0" here.
                               items:
                                 type: string
                               type: array
@@ -7205,6 +7209,10 @@ spec:
                                 type: string
                               type: array
                             scheduler:
+                              description: |-
+                                Scheduler extra args. Kamaji sets --bind-address to the IPv6 wildcard "::"
+                                (which also serves IPv4 on a dual-stack pod); on hosts with IPv6 disabled in the
+                                kernel, override it to "0.0.0.0" here.
                               items:
                                 type: string
                               type: array
@@ -9000,6 +9008,8 @@ spec:
                       x-kubernetes-validations:
                         - message: all podCidrs entries must be valid CIDRs
                           rule: self.all(x, isCIDR(x))
+                        - message: podCidrs must not contain two CIDRs of the same IP family
+                          rule: size(self) < 2 || cidr(self[0]).ip().family() != cidr(self[1]).ip().family()
                     port:
                       default: 6443
                       description: Port where API server will be exposed
@@ -9027,6 +9037,8 @@ spec:
                       x-kubernetes-validations:
                         - message: all serviceCidrs entries must be valid CIDRs
                           rule: self.all(x, isCIDR(x))
+                        - message: serviceCidrs must not contain two CIDRs of the same IP family
+                          rule: size(self) < 2 || cidr(self[0]).ip().family() != cidr(self[1]).ip().family()
                   type: object
                 writePermissions:
                   description: |-
```

---

### Incident Patch 10: `03dc9860` (2026-09-10)
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

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

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

### Incident Patch 11: `da047f9c` (2026-09-10)
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
-		// for the same two cores. One minute sits well inside that observed stall, so
-		// the wait is widened to five for headroom above it.
-		Eventually(func() error {
-			return tcpClient.Get(context.Background(), types.NamespacedName{Name: "kamaji-freeze"}, &admissionregistrationv1.ValidatingWebhookConfiguration{})
-		}, 5*time.Minute, time.Second).Should(Succeed())
+		// The webhook is pushed to the watch opened above the instant Kamaji installs it,
+		// so a contended API server delays the event rather than hiding it. If the watch
+		// drops - the API server is restarted at the end of the migration - fall back to
+		// a direct read, which still succeeds while the window is open.
+		if err := awaitFreezeWebhook(freezeWatch, 5*time.Minute); err != nil {
+			Eventually(func() error {
+				return tcpClient.Get(context.Background(), types.NamespacedName{Name: ds.FreezeWebhookName}, &admissionregistrationv1.ValidatingWebhookConfiguration{})
+			}, time.Minute, time.Second).Should(Succeed(), "%s never observed: %
```

---

### Incident Patch 12: `157bddee` (2026-09-08)
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
 	cmd.Flags().BoolVar(&leaderElect, "leader-elect", true, "Enable leader election for controller manager. Enabling this will ensure there is only one active controller manager.")
 	cmd.Flags().DurationVar(&controllerReconcileTimeout, "controller-reconcile-timeout", 30*time.Second, "The reconciliation request timeout before the controller withdraw the external resource calls, such as dealing with the Datastore, or the Tenant Control Plane API endpoint.")
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

**File**: `controllers/certificate_lifecycle_controller_reconcile_test.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package controllers
+
+import (
+	"testing"
+	"time"
+
+	"github.com/prometheus/client_golang/prometheus"
+	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
+
+	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
+	"github.com/clastix/kamaji/internal/metrics"
+)
+
+func TestCertificateLifecycleReconcileAppliesReconcileTimeout(t *testing.T) {
+	t.Parallel()
+
+	scheme := runtime.NewScheme()
+	if err := corev1.AddToScheme(scheme); err != nil {
+		t.Fatalf("failed adding corev1 scheme: %v", err)
+	}
+	if err := kamajiv1alpha1.AddToScheme(scheme); err != nil {
+		t.Fatalf("failed adding kamaji scheme: %v", err)
+	}
+
+	capturing := &contextCapturingClient{Client: fake.NewClientBuilder().WithScheme(scheme).Build()}
+
+	const reconcileTimeout = 5 * time.Second
+
+	s := &CertificateLifecycle{
+		Deadline:         24 * time.Hour,
+		ReconcileTimeout: reconcileTimeout,
+		Metrics:          metrics.NewRecorder(prometheus.NewRegistry()),
+		client:           capturing,
+	}
+
+	if _, err := s.Reconcile(t.Context(), reconcile.Request{NamespacedName: types.NamespacedName{Namespace: "default", Name: "missing"}}); err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+
+	assertContextDeadlineWithin(t, capturing.capturedDeadline, capturing.hasDeadline, reconcileTimeout)
+}
```

**File**: `controllers/kubeconfiggenerator_controller.go` (modified, +5/-0)
```diff
@@ -47,6 +47,7 @@ import (
 type KubeconfigGeneratorReconciler struct {
 	Client            client.Client
 	NotValidThreshold time.Duration
+	ReconcileTimeout  time.Duration
 	CertificateChan   chan event.GenericEvent
 }
 
@@ -58,6 +59,10 @@ type KubeconfigGeneratorReconciler struct {
 func (r *KubeconfigGeneratorReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
 	logger := log.FromContext(ctx)
 
+	var cancelFn context.CancelFunc
+	ctx, cancelFn = context.WithTimeout(ctx, r.ReconcileTimeout)
+	defer cancelFn()
+
 	logger.Info("reconciling resource")
 
 	var generator kamajiv1alpha1.KubeconfigGenerator
```

**File**: `controllers/kubeconfiggenerator_controller_reconcile_test.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package controllers
+
+import (
+	"testing"
+	"time"
+
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/event"
+
+	kamajiv1alpha1 "github.com/clastix/kamaji/api/v1alpha1"
+)
+
+func TestKubeconfigGeneratorReconcilerReconcileAppliesReconcileTimeout(t *testing.T) {
+	t.Parallel()
+
+	scheme := runtime.NewScheme()
+	if err := kamajiv1alpha1.AddToScheme(scheme); err != nil {
+		t.Fatalf("failed adding kamaji scheme: %v", err)
+	}
+
+	capturing := &contextCapturingClient{Client: fake.NewClientBuilder().WithScheme(scheme).Build()}
+
+	const reconcileTimeout = 2 * time.Second
+
+	r := &KubeconfigGeneratorReconciler{
+		Client:            capturing,
+		NotValidThreshold: time.Hour,
+		ReconcileTimeout:  reconcileTimeout,
+		CertificateChan:   make(chan event.GenericEvent, 1),
+	}
+
+	if _, err := r.Reconcile(t.Context(), ctrl.Request{NamespacedName: types.NamespacedName{Name: "missing"}}); err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+
+	assertContextDeadlineWithin(t, capturing.capturedDeadline, capturing.hasDeadline, reconcileTimeout)
+}
```

---

### Incident Patch 13: `d4c809a5` (2026-09-08)
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

---

### Incident Patch 14: `80f32baa` (2026-08-26)
**Commit Message**: fix: install freeze webhook synchronously before datastore migration job (#1277)

The soot Migrate controller installs the tenant-side kamaji-freeze
ValidatingWebhookConfiguration, but it is level-triggered: it reads the
TenantControlPlane's current status rather than the status at the time
its trigger fired. If the migration Job runs to completion (status flips
Migrating -> Ready) faster than that controller's first reconcile after
the transition, it observes Ready directly and never installs the
webhook at all - the migration then runs with no write protection on
the source datastore.

Install the webhook in the host-side Migrate resource, synchronously and
before the Job is created, so that by the time anything can observe
VersionMigrating the webhook already exists. The webhook definitions are
shared with the soot controller via a common builder in the datastore
package, and the manager's webhook CA bundle is plumbed through the
TenantControlPlane reconciler to reach it.

This completes the freeze guarantee requested in #208.

**File**: `cmd/manager/cmd.go` (modified, +1/-0)
```diff
@@ -174,6 +174,7 @@ func NewCmd(scheme *runtime.Scheme) *cobra.Command {
 				KamajiServiceAccount:    managerServiceAccountName,
 				KamajiService:           managerServiceName,
 				KamajiMigrateImage:      migrateJobImage,
+				KamajiMigrateCABundle:   webhookCABundle,
 				MaxConcurrentReconciles: maxConcurrentReconciles,
 				DiscoveryClient:         discoveryClient,
 			}
```

**File**: `controllers/resources.go` (modified, +4/-2)
```diff
@@ -39,6 +39,7 @@ type GroupResourceBuilderConfiguration struct {
 	KamajiServiceAccount          string
 	KamajiService                 string
 	KamajiMigrateImage            string
+	KamajiMigrateCABundle         []byte
 	DiscoveryClient               discovery.DiscoveryInterface
 }
 
@@ -57,7 +58,7 @@ type GroupDeletableResourceBuilderConfiguration struct {
 func GetResources(ctx context.Context, config GroupResourceBuilderConfiguration) []resources.Resource {
 	resources := []resources.Resource{}
 
-	resources = append(resources, getDataStoreMigratingResources(config.client, config.KamajiNamespace, config.KamajiMigrateImage, config.KamajiServiceAccount, config.KamajiService)...)
+	resources = append(resources, getDataStoreMigratingResources(config.client, config.KamajiNamespace, config.KamajiMigrateImage, config.KamajiServiceAccount, config.KamajiService, config.KamajiMigrateCABundle)...)
 	resources = append(resources, getUpgradeResources(config.client)...)
 	resources = append(resources, getKubernetesServiceResources(config.client)...)
 	resources = append(resources, getKubeadmConfigResources(config.client, getTmpDirectory(config.tcpReconcilerConfig.TmpBaseDirectory, config.tenantControlPlane), config.DataStore)...)
@@ -111,14 +112,15 @@ func getDataStoreMigratingCleanup(c client.Client, kamajiNamespace string) []res
 	}
 }
 
-func getDataStoreMigratingResources(c client.Client, kamajiNamespace, migrateImage string, kamajiServiceAccount, kamajiService string) []resources.Resource {
+func getDataStoreMigratingResources(c client.Client, kamajiNamespace, migrateImage string, kamajiServiceAccount, kamajiService string, migrateCABundle []byte) []resources.Resource {
 	return []resources.Resource{
 		&ds.Migrate{
 			Client:               c,
 			MigrateImage:         migrateImage,
 			KamajiNamespace:      kamajiNamespace,
 			KamajiServiceAccount: kamajiServiceAccount,
 			KamajiServiceName:    kamajiService,
+			WebhookCABundle:      migrateCABundle,
 		},
 	}
 }
```

**File**: `controllers/soot/controllers/migrate.go` (modified, +3/-90)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/clastix/kamaji/api/v1alpha1"
 	sooterrors "github.com/clastix/kamaji/controllers/soot/controllers/errors"
 	"github.com/clastix/kamaji/controllers/utils"
+	ds "github.com/clastix/kamaji/internal/resources/datastore"
 	"github.com/clastix/kamaji/internal/utilities"
 )
 
@@ -90,95 +91,7 @@ func (m *Migrate) createOrUpdate(ctx context.Context) error {
 	obj := m.object()
 
 	_, err := utilities.CreateOrUpdateWithConflict(ctx, m.Client, obj, func() error {
-		obj.Webhooks = []admissionregistrationv1.ValidatingWebhook{
-			{
-				Name: "leases.migrate.kamaji.clastix.io",
-				ClientConfig: admissionregistrationv1.WebhookClientConfig{
-					URL:      pointer.To(fmt.Sprintf("https://%s.%s.svc:443/migrate", m.WebhookServiceName, m.WebhookNamespace)),
-					CABundle: m.WebhookCABundle,
-				},
-				Rules: []admissionregistrationv1.RuleWithOperations{
-					{
-						Operations: []admissionregistrationv1.OperationType{
-							admissionregistrationv1.Create,
-							admissionregistrationv1.Delete,
-						},
-						Rule: admissionregistrationv1.Rule{
-							APIGroups:   []string{"*"},
-							APIVersions: []string{"*"},
-							Resources:   []string{"*"},
-							Scope: func(v admissionregistrationv1.ScopeType) *admissionregistrationv1.ScopeType {
-								return &v
-							}(admissionregistrationv1.NamespacedScope),
-						},
-					},
-				},
-				FailurePolicy: func(v admissionregistrationv1.FailurePolicyType) *admissionregistrationv1.FailurePolicyType {
-					return &v
-				}(admissionregistrationv1.Fail),
-				MatchPolicy: func(v admissionregistrationv1.MatchPolicyType) *admissionregistrationv1.MatchPolicyType {
-					return &v
-				}(admissionregistrationv1.Equivalent),
-				NamespaceSelector: &metav1.LabelSelector{
-					MatchExpressions: []metav1.LabelSelectorRequirement{
-						{
-							Key:      "kubernetes.io/metadata.name",
-							Operator: metav1.LabelSelectorOpIn,
-							Values: []string{
-								"kube-node-lease",
-							},
-						},
-					},
-				},
-				SideEffects: func(v admissionregistrationv1.SideEffectClass) *admissionregistrationv1.SideEffectClass {
-					return &v
-				}(admissionregistrationv1.SideEffectClassNoneOnDryRun),
-				AdmissionReviewVersions: []string{"v1"},
-			},
-			{
-				Name: "catchall.migrate.kamaji.clastix.io",
-				ClientConfig: admissionregistrationv1.WebhookClientConfig{
-					URL:      pointer.To(fmt.Sprintf("https://%s.%s.svc:443/migrate", m.WebhookServiceName, m.WebhookNamespace)),
-					CABundle: m.WebhookCABundle,
-				},
-				Rules: []admissionregistrationv1.RuleWithOperations{
-					{
-						Operations: []admissionregistrationv1.OperationType{admissionregistrationv1.OperationAll},
-						Rule: admissionregistrationv1.Rule{
-							APIGroups:   []string{"*"},
-							APIVersions: []string{"*"},
-							Resources:   []string{"*"},
-							Scope: func(v admissionregistrationv1.ScopeType) *admissionregistrationv1.ScopeType {
-								return &v
-							}(admissionregistrationv1.AllScopes),
-						},
-					},
-				},
-				FailurePolicy: func(v admissionregistrationv1.FailurePolicyType) *admissionregistrationv1.FailurePolicyType {
-					return &v
-				}(admissionregistrationv1.Fail),
-				MatchPolicy: func(v admissionregistrationv1.MatchPolicyType) *admissionregistrationv1.MatchPolicyType {
-					return &v
-				}(admissionregistrationv1.Equivalent),
-				NamespaceSelector: &metav1.LabelSelector{
-					MatchExpressions: []metav1.LabelSelectorRequirement{
-						{
-							Key:      "kubernetes.io/metadata.name",
-							Operator: metav1.LabelSelectorOpNotIn,
-							Values: []string{
-								"kube-system",
-								"kube-node-lease",
-							},
-						},
-					},
-				},
-				SideEffects: func(v admissionregistrationv1.SideEffectClass) *admissionregistrationv1.SideEffectClass {
-					return &v
-				}(admissionregistrationv1.SideEffectClassNoneOnDryRun),
-				TimeoutSeconds:          nil,
-				AdmissionReviewVersions: []string{"v1"},
-			},
-		}
+		obj.Webhooks = ds.BuildFreezeValidatingWebhookConfiguration(m.WebhookNamespace, m.WebhookServiceName, m.WebhookCABundle)
 
 		return nil
 	})
@@ -202,7 +115,7 @@ func (m *Migrate) SetupWithManager(mgr manager.Manager) error {
 func (m *Migrate) object() *admissionregistrationv1.ValidatingWebhookConfiguration {
 	return &admissionregistrationv1.ValidatingWebhookConfiguration{
 		ObjectMeta: metav1.ObjectMeta{
-			Name: "kamaji-freeze",
+			Name: ds.FreezeWebhookName,
 		},
 	}
 }
```

**File**: `controllers/tenantcontrolplane_controller.go` (modified, +2/-0)
```diff
@@ -59,6 +59,7 @@ type TenantControlPlaneReconciler struct {
 	KamajiServiceAccount    string
 	KamajiService           string
 	KamajiMigrateImage      string
+	KamajiMigrateCABundle   []byte
 	MaxConcurrentReconciles int
 	ReconcileTimeout        time.Duration
 	DiscoveryClient         discovery.DiscoveryInterface
@@ -238,6 +239,7 @@ func (r *TenantControlPlaneReconciler) Reconcile(ctx context.Context, req ctrl.R
 		KamajiServiceAccount:          r.KamajiServiceAccount,
 		KamajiService:                 r.KamajiService,
 		KamajiMigrateImage:            r.KamajiMigrateImage,
+		KamajiMigrateCABundle:         r.KamajiMigrateCABundle,
 		DiscoveryClient:               r.DiscoveryClient,
 	}
 	registeredResources := GetResources(ctx, groupResourceBuilderConfiguration)
```

**File**: `internal/resources/datastore/datastore_migrate.go` (modified, +43/-0)
```diff
@@ -10,6 +10,7 @@ import (
 	"time"
 
 	"github.com/prometheus/client_golang/prometheus"
+	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
 	batchv1 "k8s.io/api/batch/v1"
 	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/api/errors"
@@ -31,6 +32,10 @@ type Migrate struct {
 	KamajiServiceName    string
 	ShouldCleanUp        bool
 	MigrateImage         string
+	// WebhookCABundle is the CA bundle for the manager's admission webhook server, required to
+	// install the tenant-side "kamaji-freeze" ValidatingWebhookConfiguration prior to starting
+	// the migration Job: see ensureFreezeWebhook for why this must happen synchronously here.
+	WebhookCABundle []byte
 
 	actualDatastore  *kamajiv1alpha1.DataStore
 	desiredDatastore *kamajiv1alpha1.DataStore
@@ -103,6 +108,12 @@ func (d *Migrate) CreateOrUpdate(ctx context.Context, tenantControlPlane *kamaji
 		return controllerutil.OperationResultNone, nil
 	}
 
+	// The freeze webhook must be active in the tenant cluster before the migration Job is allowed
+	// to start copying data: see ensureFreezeWebhook for why this has to be synchronous.
+	if err := d.ensureFreezeWebhook(ctx, tenantControlPlane); err != nil {
+		return controllerutil.OperationResultNone, fmt.Errorf("unable to install freeze webhook prior to migration: %w", err)
+	}
+
 	res, err := utilities.CreateOrUpdateWithConflict(ctx, d.Client, d.job, func() error {
 		d.job.SetLabels(map[string]string{
 			"tcp.kamaji.clastix.io/name":      tenantControlPlane.GetName(),
@@ -185,3 +196,35 @@ func (d *Migrate) UpdateTenantControlPlaneStatus(_ context.Context, tenantContro
 
 	return nil
 }
+
+// ensureFreezeWebhook installs the tenant-side "kamaji-freeze" ValidatingWebhookConfiguration
+// and waits for it to be persisted before the caller is allowed to start the migration Job.
+//
+// The soot Migrate controller also reacts to VersionMigrating and installs the same webhook,
+// but it is level-triggered: it always reads the TenantControlPlane's *current* status rather
+// than the status at the time its trigger fired. If the migration Job runs to completion (status
+// flips Migrating -> Ready) faster than that controller's first reconcile after the transition,
+// it observes Ready directly and never installs the webhook at all - the migration then runs
+// with no write protection on the source datastore. Installing it here, synchronously and
+// before the Job (and therefore before VersionMigrating is ever observable by any watcher),
+// closes that race: by the time anything can see VersionMigrating, the webhook already exists.
+func (d *Migrate) ensureFreezeWebhook(ctx context.Context, tenantControlPlane *kamajiv1alpha1.TenantControlPlane) error {
+	tenantClient, err := utilities.GetTenantClient(ctx, d.Client, tenantControlPlane)
+	if err != nil {
+		return fmt.Errorf("unable to build tenant client: %w", err)
+	}
+
+	webhook := &admissionregistrationv1.ValidatingWebhookConfiguration{
+		ObjectMeta: metav1.ObjectMeta{
+			Name: FreezeWebhookName,
+		},
+	}
+
+	_, err = utilities.CreateOrUpdateWithConflict(ctx, tenantClient, webhook, func() error {
+		webhook.Webhooks = BuildFreezeValidatingWebhookConfiguration(d.KamajiNamespace, d.KamajiServiceName, d.WebhookCABundle)
+
+		return nil
+	})
+
+	return err
+}
```

**File**: `internal/resources/datastore/freeze_webhook.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package datastore
+
+import (
+	"fmt"
+
+	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	pointer "k8s.io/utils/ptr"
+)
+
+// FreezeWebhookName is the name of the ValidatingWebhookConfiguration installed in the tenant
+// cluster to block writes while a datastore migration is in progress.
+const FreezeWebhookName = "kamaji-freeze"
+
+// BuildFreezeValidatingWebhookConfiguration returns the desired Webhooks for the tenant-side
+// "kamaji-freeze" ValidatingWebhookConfiguration. Shared by the host-side Migrate resource,
+// which installs it synchronously before starting the migration Job, and the soot Migrate
+// controller, which removes it once the TenantControlPlane is Ready again.
+func BuildFreezeValidatingWebhookConfiguration(namespace, serviceName string, caBundle []byte) []admissionregistrationv1.ValidatingWebhook {
+	url := pointer.To(fmt.Sprintf("https://%s.%s.svc:443/migrate", serviceName, namespace))
+
+	return []admissionregistrationv1.ValidatingWebhook{
+		{
+			Name: "leases.migrate.kamaji.clastix.io",
+			ClientConfig: admissionregistrationv1.WebhookClientConfig{
+				URL:      url,
+				CABundle: caBundle,
+			},
+			Rules: []admissionregistrationv1.RuleWithOperations{
+				{
+					Operations: []admissionregistrationv1.OperationType{
+						admissionregistrationv1.Create,
+						admissionregistrationv1.Delete,
+					},
+					Rule: admissionregistrationv1.Rule{
+						APIGroups:   []string{"*"},
+						APIVersions: []string{"*"},
+						Resources:   []string{"*"},
+						Scope:       pointer.To(admissionregistrationv1.NamespacedScope),
+					},
+				},
+			},
+			FailurePolicy: pointer.To(admissionregistrationv1.Fail),
+			MatchPolicy:   pointer.To(admissionregistrationv1.Equivalent),
+			NamespaceSelector: &metav1.LabelSelector{
+				MatchExpressions: []metav1.LabelSelectorRequirement{
+					{
+						Key:      "kubernetes.io/metadata.name",
+						Operator: metav1.LabelSelectorOpIn,
+						Values: []string{
+							"kube-node-lease",
+						},
+					},
+				},
+			},
+			SideEffects:             pointer.To(admissionregistrationv1.SideEffectClassNoneOnDryRun),
+			AdmissionReviewVersions: []string{"v1"},
+		},
+		{
+			Name: "catchall.migrate.kamaji.clastix.io",
+			ClientConfig: admissionregistrationv1.WebhookClientConfig{
+				URL:      url,
+				CABundle: caBundle,
+			},
+			Rules: []admissionregistrationv1.RuleWithOperations{
+				{
+					Operations: []admissionregistrationv1.OperationType{admissionregistrationv1.OperationAll},
+					Rule: admissionregistrationv1.Rule{
+						APIGroups:   []string{"*"},
+						APIVersions: []string{"*"},
+						Resources:   []string{"*"},
+						Scope:       pointer.To(admissionregistrationv1.AllScopes),
+					},
+				},
+			},
+			FailurePolicy: pointer.To(admissionregistrationv1.Fail),
+			MatchPolicy:   pointer.To(admissionregistrationv1.Equivalent),
+			NamespaceSelector: &metav1.LabelSelector{
+				MatchExpressions: []metav1.LabelSelectorRequirement{
+					{
+						Key:      "kubernetes.io/metadata.name",
+						Operator: metav1.LabelSelectorOpNotIn,
+						Values: []string{
+							"kube-system",
+							"kube-node-lease",
+						},
+					},
+				},
+			},
+			SideEffects:             pointer.To(admissionregistrationv1.SideEffectClassNoneOnDryRun),
+			TimeoutSeconds:          nil,
+			AdmissionReviewVersions: []string{"v1"},
+		},
+	}
+}
```

---

### Incident Patch 15: `cf504f1e` (2026-08-26)
**Commit Message**: fix(kubeadm): restore kube-proxy CIDR (#1291)

**File**: `internal/kubeadm/configuration.go` (modified, +9/-7)
```diff
@@ -8,6 +8,7 @@ import (
 	"strings"
 
 	kubeadmapi "k8s.io/kubernetes/cmd/kubeadm/app/apis/kubeadm"
+	"k8s.io/kubernetes/cmd/kubeadm/app/componentconfigs"
 	kubeadmconstants "k8s.io/kubernetes/cmd/kubeadm/app/constants"
 	"k8s.io/kubernetes/cmd/kubeadm/app/util/config"
 
@@ -109,13 +110,14 @@ func GetKubeadmInitConfigurationFromMap(conf map[string]string) (*Configuration,
 	if err := utilities.DecodeFromJSON(clusterConfigurationString, &initConfiguration.ClusterConfiguration); err != nil {
 		return nil, err
 	}
-	// Due to some weird issues with unmarshaling of the ComponentConfigs struct,
-	// we have to extract the default value and assign it directly.
-	defaults, err := config.DefaultedStaticInitConfiguration()
-	if err != nil {
-		return nil, err
-	}
-	initConfiguration.ClusterConfiguration.ComponentConfigs = defaults.ComponentConfigs
+	// ComponentConfigs are omitted from storage because their interface values cannot be unmarshaled.
+	// Recreate them after the decoder loads the cluster configuration.
+	// This sequence applies the configured network settings.
+	componentconfigs.Default(
+		&initConfiguration.ClusterConfiguration,
+		&initConfiguration.LocalAPIEndpoint,
+		&initConfiguration.NodeRegistration,
+	)
 
 	return &Configuration{InitConfiguration: initConfiguration}, nil
 }
```

**File**: `internal/kubeadm/configuration_test.go` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+// Copyright 2022 Clastix Labs
+// SPDX-License-Identifier: Apache-2.0
+
+package kubeadm
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	kubeproxyconfig "k8s.io/kube-proxy/config/v1alpha1"
+	"k8s.io/kubernetes/cmd/kubeadm/app/componentconfigs"
+)
+
+func TestGetKubeadmInitConfigurationFromMapDefaultsKubeProxyClusterCIDR(t *testing.T) {
+	testCases := []struct {
+		name     string
+		podCIDRs []string
+		expected string
+	}{
+		{
+			name:     "IPv4",
+			podCIDRs: []string{"10.244.0.0/16"},
+			expected: "10.244.0.0/16",
+		},
+		{
+			name:     "dual stack",
+			podCIDRs: []string{"10.244.0.0/16", "fd00:10:244::/56"},
+			expected: "10.244.0.0/16,fd00:10:244::/56",
+		},
+	}
+
+	for _, testCase := range testCases {
+		t.Run(testCase.name, func(t *testing.T) {
+			created, err := CreateKubeadmInitConfiguration(Parameters{
+				TenantControlPlaneName:          "tenant",
+				TenantControlPlaneNamespace:     "default",
+				TenantControlPlaneAddress:       "192.0.2.1",
+				TenantControlPlanePort:          6443,
+				TenantControlPlaneClusterDomain: "cluster.local",
+				TenantControlPlanePodCIDR:       testCase.podCIDRs,
+				TenantControlPlaneServiceCIDR:   []string{"10.96.0.0/12"},
+				TenantControlPlaneVersion:       "v1.36.1",
+				ETCDs:                           []string{"http://etcd.default.svc:2379"},
+			})
+			require.NoError(t, err)
+
+			stored, err := GetKubeadmInitConfigurationMap(*created)
+			require.NoError(t, err)
+
+			restored, err := GetKubeadmInitConfigurationFromMap(stored)
+			require.NoError(t, err)
+
+			componentConfig, ok := restored.InitConfiguration.ClusterConfiguration.ComponentConfigs[componentconfigs.KubeProxyGroup]
+			require.True(t, ok)
+
+			proxyConfig, ok := componentConfig.Get().(*kubeproxyconfig.KubeProxyConfiguration)
+			require.True(t, ok)
+			require.Equal(t, testCase.expected, proxyConfig.ClusterCIDR)
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1331** (2026-10-03): fix(datastore): shorten default MySQL username to fit 32 chars (@pujitha24)
- **PR #1330** (2026-10-03): fix(crypto): harden client certificate template and datastore TLS config (@pujitha24)
- **PR #1329** (2026-10-03): feat(deps): bump github.com/onsi/gomega from 1.43.1 to 1.44.0 (@dependabot[bot])
- **PR #1328** (2026-10-03): feat(deps): bump the k8s group with 2 updates (@dependabot[bot])
- **PR #1324** (2026-09-24): fix(manager): add webhook readyz check (@mridulgain)
- **PR #1323** (2026-09-24): feat(deps): bump github.com/nats-io/nats.go from 1.53.1 to 1.54.0 (@dependabot[bot])
- **PR #1322** (2026-09-24): feat(deps): bump github.com/onsi/ginkgo/v2 from 2.32.2 to 2.33.0 (@dependabot[bot])
- **PR #1321** (2026-09-24): feat(deps): bump github.com/onsi/gomega from 1.43.0 to 1.43.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
