# Forensic Learning Record (Deep Inspection): gardener/gardener

> **Canonical Artifact**: `07_PROJECT_LEARNING/gardener-gardener-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gardener/gardener](https://github.com/gardener/gardener))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:21.615Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gardener/gardener`
- **Description**: Homogeneous Kubernetes clusters at scale on any infrastructure using hosted control planes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3460 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/utils/initrun/initrun.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

// This file has been deliberately moved into its own package since it imports k8s.io/component-base/version/verflag
// which automatically registers the `--version` flag as soon as the packages is (transitively) imported.
// In order to prevent this from happening accidentally, it's safer to keep it in its own package.

package initrun

import (
	"fmt"

	"github.com/go-logr/logr"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/component-base/version"
	"k8s.io/component-base/version/verflag"
	"k8s.io/klog/v2"
	logf "sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/gardener/gardener/pkg/logger"
)

// Options is an interface for options.
type Options interface {
	// Complete completes the options.
	Complete() error
	// Validate validates the options.
	Validate() error
	// LogConfig returns the logging config.
	LogConfig() (logLevel, logFormat string)
}

// InitRun initializes the run command by completing and validating the options, creating and settings a logger,
// printing all command line flags, and configuring command settings.
func InitRun(cmd *cobra.Command, opts Options, name string) (logr.Logger, error) {
	verflag.PrintAndExitIfRequested()

	if err := opts.Complete(); err != nil {
		return logr.Discard(), err
	}

	if err := opts.Validate(); err != nil {
		return logr.Discard(), err
	}

	logLevel, logFormat := opts.LogConfig()
	log, err := logger.NewZapLogger(logLevel, logFormat)
	if err != nil {
		return logr.Discard(), fmt.Errorf("error instantiating zap logger: %w", err)
	}

	logf.SetLogger(log)
	klog.SetLogger(log)

	log.Info("Starting "+name, "version", version.Get()) //nolint:logcheck
	cmd.Flags().VisitAll(func(flag *pflag.Flag) {
		log.Info(fmt.Sprintf("FLAG: --%s=%s", flag.Name, flag.Value)) //nolint:logcheck
	})

	// don't output usage on further errors raised during execution
	cmd.SilenceUsage = true
	// further errors will be logged properly, don't duplicate
	cmd.SilenceErrors = true

	return log, nil
}

```

### Core Architecture Module: `cmd/utils/warnings.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package utils

import (
	"os"

	"k8s.io/client-go/rest"
)

// DeduplicateWarnings configures a client-go warning handler that deduplicates API warnings in order to not spam
// production logs of gardener components.
func DeduplicateWarnings() {
	rest.SetDefaultWarningHandler(
		rest.NewWarningWriter(os.Stderr, rest.WarningWriterOptions{
			// only print a given warning the first time we receive it
			Deduplicate: true,
		}),
	)
}

```

### Core Architecture Module: `extensions/pkg/controller/backupbucket/util.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package backupbucket

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v1beta1constants "github.com/gardener/gardener/pkg/apis/core/v1beta1/constants"
	extensionsv1alpha1 "github.com/gardener/gardener/pkg/apis/extensions/v1alpha1"
)

// GeneratedSecretObjectMeta returns the metadata for the generated secret.
func GeneratedSecretObjectMeta(backupBucket *extensionsv1alpha1.BackupBucket) metav1.ObjectMeta {
	namespace := v1beta1constants.GardenNamespace
	if v, ok := backupBucket.Annotations[v1beta1constants.AnnotationBackupBucketGeneratedSecretNamespace]; ok {
		namespace = v
	}

	return metav1.ObjectMeta{
		Name:      v1beta1constants.SecretPrefixGeneratedBackupBucket + backupBucket.Name,
		Namespace: namespace,
	}
}

```

### Core Architecture Module: `extensions/pkg/controller/backupentry/util.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package backupentry

import (
	"strings"

	v1beta1constants "github.com/gardener/gardener/pkg/apis/core/v1beta1/constants"
)

// ExtractShootDetailsFromBackupEntryName returns Shoot resource technicalID and UID from provided <backupEntryName>.
func ExtractShootDetailsFromBackupEntryName(backupEntryName string) (shootTechnicalID, shootUID string) {
	backupEntryName = strings.TrimPrefix(backupEntryName, v1beta1constants.BackupSourcePrefix+"-")
	tokens := strings.Split(backupEntryName, "--")
	shootUID = tokens[len(tokens)-1]
	shootTechnicalID = strings.TrimSuffix(backupEntryName, "--"+shootUID)
	return shootTechnicalID, shootUID
}

```

### Core Architecture Module: `extensions/pkg/controller/controlplane/utils.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package controlplane

import (
	"maps"

	corev1 "k8s.io/api/core/v1"

	"github.com/gardener/gardener/pkg/utils"
)

// MergeSecretMaps merges the 2 given secret maps.
func MergeSecretMaps(a, b map[string]*corev1.Secret) map[string]*corev1.Secret {
	x := make(map[string]*corev1.Secret, len(a))
	for _, m := range []map[string]*corev1.Secret{a, b} {
		maps.Copy(x, m)
	}
	return x
}

// ComputeChecksums computes and returns SAH256 checksums for the given secrets and configmaps.
func ComputeChecksums(secrets map[string]*corev1.Secret, cms map[string]*corev1.ConfigMap) map[string]string {
	checksums := make(map[string]string, len(secrets)+len(cms))
	for name, secret := range secrets {
		checksums[name] = utils.ComputeChecksum(secret.Data)
	}
	for name, cm := range cms {
		checksums[name] = utils.ComputeChecksum(cm.Data)
	}
	return checksums
}

```

### Core Architecture Module: `extensions/pkg/controller/dnsrecord/utils.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package dnsrecord

import (
	"strings"
)

const (
	// metaRecordPrefix is the prefix of meta DNS records that may exist if the shoot was previously reconciled
	// with the dns-external controller.
	metaRecordPrefix = "comment-"
)

// MatchesDomain returns true if the given name matches (is a subdomain) of the given domain, false otherwise.
func MatchesDomain(name, domain string) bool {
	return strings.HasSuffix(name, "."+domain) || domain == name
}

// FindZoneForName returns the zone ID for the longest zone domain from the given zones map that is matched by the given name.
// If the given name doesn't match any of the zone domains in the given zones map, an empty string is returned.
func FindZoneForName(zones map[string]string, name string) string {
	longestZoneName, result := "", ""
	for zoneName, zoneId := range zones {
		if MatchesDomain(name, zoneName) && len(zoneName) > len(longestZoneName) {
			longestZoneName, result = zoneName, zoneId
		}
	}
	return result
}

// GetMetaRecordName returns the meta record name for the given name.
func GetMetaRecordName(name string) string {
	if strings.HasPrefix(name, "*.") {
		return "*." + metaRecordPrefix + name[2:]
	}
	return metaRecordPrefix + name
}

```

### Core Architecture Module: `extensions/pkg/controller/healthcheck/general/statefulsets.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package general

import (
	"context"
	"fmt"

	"github.com/go-logr/logr"
	appsv1 "k8s.io/api/apps/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/gardener/gardener/extensions/pkg/controller/healthcheck"
	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
	"github.com/gardener/gardener/pkg/utils/kubernetes/health"
)

// statefulSetHealthChecker contains all the information for the StatefulSet HealthCheck
type statefulSetHealthChecker struct {
	logger logr.Logger
	client client.Client
	name   string
}

// SeedStatefulSetHealthChecker is a healthCheck for StatefulSets in the Seed cluster
type SeedStatefulSetHealthChecker struct {
	statefulSetHealthChecker
}

// ShootStatefulSetHealthChecker is a healthCheck for StatefulSets in the Shoot cluster
type ShootStatefulSetHealthChecker struct {
	statefulSetHealthChecker
}

var (
	_ healthcheck.HealthCheck  = (*SeedStatefulSetHealthChecker)(nil)
	_ healthcheck.SourceClient = (*SeedStatefulSetHealthChecker)(nil)
	_ healthcheck.HealthCheck  = (*ShootStatefulSetHealthChecker)(nil)
	_ healthcheck.TargetClient = (*ShootStatefulSetHealthChecker)(nil)
)

// NewSeedStatefulSetChecker is a healthCheck function to check StatefulSets in the Seed cluster
func NewSeedStatefulSetChecker(name string) *SeedStatefulSetHealthChecker {
	return &SeedStatefulSetHealthChecker{
		statefulSetHealthChecker: statefulSetHealthChecker{
			name: name,
		},
	}
}

// NewShootStatefulSetChecker is a healthCheck function to check StatefulSets in the Shoot cluster
func NewShootStatefulSetChecker(name string) *ShootStatefulSetHealthChecker {
	return &ShootStatefulSetHealthChecker{
		statefulSetHealthChecker: statefulSetHealthChecker{
			name: name,
		},
	}
}

// InjectSourceClient injects the seed client
func (h *SeedStatefulSetHealthChecker) InjectSourceClient(sourceClient client.Client) {
	h.client = sourceClient
}

// InjectTargetClient injects the shoot client
func (h *ShootStatefulSetHealthChecker) InjectTargetClient(targetClient client.Client) {
	h.client = targetClient
}

// SetLoggerSuffix injects the logger
func (h *statefulSetHealthChecker) SetLoggerSuffix(provider, extension string) {
	h.logger = log.Log.WithName("healthcheck-statefulset").WithValues("provider", provider, "extension", extension)
}

// Check executes the health check
func (h *statefulSetHealthChecker) Check(ctx context.Context, request types.NamespacedName) (*healthcheck.SingleCheckResult, error) {
	statefulSet := &appsv1.StatefulSet{}

	if err := h.client.Get(ctx, client.ObjectKey{Namespace: request.Namespace, Name: h.name}, statefulSet); err != nil {
		if apierrors.IsNotFound(err) {
			return &healthcheck.SingleCheckResult{
				Status: gardencorev1beta1.ConditionFalse,
				Detail: fmt.Sprintf("StatefulSet %q in namespace %q not found", h.name, request.Namespace),
			}, nil
		}
		err := fmt.Errorf("failed to retrieve StatefulSet %q in namespace %q: %w", h.name, request.Namespace, err)
		h.logger.Error(err, "Health check failed")
		return nil, err
	}
	if isHealthy, err := statefulSetIsHealthy(statefulSet); !isHealthy {
		h.logger.Error(err, "Health check failed")
		return &healthcheck.SingleCheckResult{
			Status: gardencorev1beta1.ConditionFalse,
			Detail: err.Error(),
		}, nil
	}

	return &healthcheck.SingleCheckResult{
		Status: gardencorev1beta1.ConditionTrue,
	}, nil
}

func statefulSetIsHealthy(statefulSet *appsv1.StatefulSet) (bool, error) {
	if err := health.CheckStatefulSet(statefulSet); err != nil {
		err := fmt.Errorf("statefulSet %q in namespace %q is unhealthy: %w", statefulSet.Name, statefulSet.Namespace, err)
		return false, err
	}
	return true, nil
}

```

### Core Architecture Module: `extensions/pkg/controller/healthcheck/message_util.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package healthcheck

import (
	"fmt"
	"strings"
)

// getUnsuccessfulDetailMessage returns a message depending on the number of
// unsuccessful and pending checks
func getUnsuccessfulDetailMessage(unsuccessfulChecks, progressingChecks int, details string) string {
	if progressingChecks > 0 && unsuccessfulChecks > 0 {
		return fmt.Sprintf("%d failing and %d progressing %s: %s", unsuccessfulChecks, progressingChecks, getSingularOrPlural(progressingChecks), details)
	}

	return details
}

// getSingularOrPlural returns the given verb in either singular or plural
func getSingularOrPlural(count int) string {
	if count > 1 {
		return "checks"
	}
	return "check"
}

// appendUnsuccessfulChecksDetails appends a formatted detail message to the given string builder
func (h *checkResultForConditionType) appendUnsuccessfulChecksDetails(details *strings.Builder) error {
	if len(h.unsuccessfulChecks) > 0 && (len(h.progressingChecks) != 0 || len(h.failedChecks) != 0) {
		if _, err := fmt.Fprintf(details, "Failed %s: ", getSingularOrPlural(len(h.unsuccessfulChecks))); err != nil {
			return err
		}
	}

	if len(h.unsuccessfulChecks) == 1 {
		if _, err := fmt.Fprintf(details, "%s ", ensureTrailingDot(h.unsuccessfulChecks[0].detail)); err != nil {
			return err
		}
		return nil
	}

	for index, check := range h.unsuccessfulChecks {
		if _, err := fmt.Fprintf(details, "%d) %s ", index+1, ensureTrailingDot(check.detail)); err != nil {
			return err
		}
	}

	return nil
}

// appendProgressingChecksDetails appends a formatted detail message to the given string builder
func (h *checkResultForConditionType) appendProgressingChecksDetails(details *strings.Builder) error {
	if len(h.progressingChecks) > 0 && (len(h.unsuccessfulChecks) != 0 || len(h.failedChecks) != 0) {
		if _, err := fmt.Fprintf(details, "Progressing %s: ", getSingularOrPlural(len(h.progressingChecks))); err != nil {
			return err
		}
	}

	if len(h.progressingChecks) == 1 {
		if _, err := fmt.Fprintf(details, "%s ", ensureTrailingDot(h.progressingChecks[0].detail)); err != nil {
			return err
		}
		return nil
	}

	for index, check := range h.progressingChecks {
		if _, err := fmt.Fprintf(details, "%d) %s ", index+1, ensureTrailingDot(check.detail)); err != nil {
			return err
		}
	}

	return nil
}

// appendFailedChecksDetails appends a formatted detail message to the given string builder
func (h *checkResultForConditionType) appendFailedChecksDetails(details *strings.Builder) error {
	if len(h.failedChecks) > 0 && (len(h.unsuccessfulChecks) != 0 || len(h.progressingChecks) != 0) {
		if _, err := fmt.Fprintf(details, "Unable to execute %s: ", getSingularOrPlural(len(h.failedChecks))); err != nil {
			return err
		}
	}

	if len(h.failedChecks) == 1 {
		if _, err := fmt.Fprintf(details, "%s ", ensureTrailingDot(h.failedChecks[0].Error())); err != nil {
			return err
		}
		return nil
	}

	for index, check := range h.failedChecks {
		if _, err := fmt.Fprintf(details, "%d) %s ", index+1, ensureTrailingDot(check.Error())); err != nil {
			return err
		}
	}

	return nil
}

// ensureTrailingDot adds a trailing dot if it does not exist
func ensureTrailingDot(details string) string {
	if !strings.HasSuffix(details, ".") {
		return fmt.Sprintf("%s.", details)
	}
	return details
}

// trimTrailingWhitespace removes a trailing whitespace character
func trimTrailingWhitespace(details string) string {
	return strings.TrimSuffix(details, " ")
}

```

### Core Architecture Module: `extensions/pkg/controller/healthcheck/worker/helpers.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package worker

import (
	"fmt"

	machinev1alpha1 "github.com/gardener/machine-controller-manager/pkg/apis/machine/v1alpha1"

	"github.com/gardener/gardener/pkg/utils/kubernetes/health"
)

func checkMachineDeploymentsHealthy(machineDeployments []machinev1alpha1.MachineDeployment) (bool, error) {
	for _, deployment := range machineDeployments {
		for _, failedMachine := range deployment.Status.FailedMachines {
			return false, fmt.Errorf("machine %q failed: %s", failedMachine.Name, failedMachine.LastOperation.Description)
		}

		if err := health.CheckMachineDeployment(&deployment); err != nil {
			return false, fmt.Errorf("machine deployment %q in namespace %q is unhealthy: %w", deployment.Name, deployment.Namespace, err)
		}
	}

	return true, nil
}

func getDesiredMachineCount(machineDeployments []machinev1alpha1.MachineDeployment) int {
	desiredMachines := 0
	for _, deployment := range machineDeployments {
		if deployment.DeletionTimestamp == nil {
			desiredMachines += int(deployment.Spec.Replicas)
		}
	}
	return desiredMachines
}

```

### Core Architecture Module: `extensions/pkg/controller/healthcheck/worker/nodes.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package worker

import (
	"context"
	"fmt"
	"time"

	machinev1alpha1 "github.com/gardener/machine-controller-manager/pkg/apis/machine/v1alpha1"
	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/gardener/gardener/extensions/pkg/controller/healthcheck"
	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
)

const (
	// AnnotationKeyNotManagedByMCM is a constant for an annotation on the node resource that indicates that
	// the node is not handled by MCM.
	AnnotationKeyNotManagedByMCM = "node.machine.sapcloud.io/not-managed-by-mcm"
)

// DefaultHealthChecker all the information for the Worker HealthCheck.
// This check assumes that the MachineControllerManager (https://github.com/gardener/machine-controller-manager) has been
// deployed by the Worker extension controller.
type DefaultHealthChecker struct {
	logger logr.Logger
	// Needs to be set by actuator before calling the Check function
	sourceClient client.Client
	// make sure target/shoot client is instantiated
	targetClient client.Client
	// scaleUpProgressingThreshold is the progressing threshold when the health check detects a scale-up situation.
	scaleUpProgressingThreshold *time.Duration
	// scaleDownProgressingThreshold is the progressing threshold when the health check detects a scale-down situation.
	scaleDownProgressingThreshold *time.Duration
}

var (
	_ healthcheck.HealthCheck  = (*DefaultHealthChecker)(nil)
	_ healthcheck.SourceClient = (*DefaultHealthChecker)(nil)
	_ healthcheck.TargetClient = (*DefaultHealthChecker)(nil)
)

// NewNodesChecker is a health check function which performs certain checks about the nodes registered in the cluster.
// It implements the healthcheck.HealthCheck interface.
func NewNodesChecker() *DefaultHealthChecker {
	scaleUpProgressingThreshold := 5 * time.Minute
	scaleDownProgressingThreshold := 15 * time.Minute

	return &DefaultHealthChecker{
		scaleUpProgressingThreshold:   &scaleUpProgressingThreshold,
		scaleDownProgressingThreshold: &scaleDownProgressingThreshold,
	}
}

// WithScaleUpProgressingThreshold sets the scaleUpProgressingThreshold property.
func (h *DefaultHealthChecker) WithScaleUpProgressingThreshold(d time.Duration) *DefaultHealthChecker {
	h.scaleUpProgressingThreshold = &d
	return h
}

// WithScaleDownProgressingThreshold sets the scaleDownProgressingThreshold property.
func (h *DefaultHealthChecker) WithScaleDownProgressingThreshold(d time.Duration) *DefaultHealthChecker {
	h.scaleDownProgressingThreshold = &d
	return h
}

// InjectSourceClient injects the seed client.
func (h *DefaultHealthChecker) InjectSourceClient(sourceClient client.Client) {
	h.sourceClient = sourceClient
}

// InjectTargetClient injects the shoot client.
func (h *DefaultHealthChecker) InjectTargetClient(targetClient client.Client) {
	h.targetClient = targetClient
}

// SetLoggerSuffix injects the logger.
func (h *DefaultHealthChecker) SetLoggerSuffix(provider, extension string) {
	h.logger = log.Log.WithName("healthcheck-nodes").WithValues("provider", provider, "extension", extension)
}

// Check executes the health check.
func (h *DefaultHealthChecker) Check(ctx context.Context, request types.NamespacedName) (*healthcheck.SingleCheckResult, error) {
	machineDeploymentList := &machinev1alpha1.MachineDeploymentList{}
	if err := h.sourceClient.List(ctx, machineDeploymentList, client.InNamespace(request.Namespace)); err != nil {
		err := fmt.Errorf("unable to check nodes. Failed to list machine deployments in namespace %q: %w", request.Namespace, err)
		h.logger.Error(err, "Health check failed")
		return nil, err
	}

	nodeList := &corev1.NodeList{}
	if err := h.targetClient.List(ctx, nodeList); err != nil {
		err := fmt.Errorf("unable to check nodes. Failed to list shoot nodes: %w", err)
		h.logger.Error(err, "Health check failed")
		return nil, err
	}

	var (
		readyNodes          int
		registeredNodes     = len(nodeList.Items)
		desiredMachines     = getDesiredMachineCount(machineDeploymentList.Items)
		nodeNotManagedByMCM int
	)

	for _, node := range nodeList.Items {
		if metav1.HasAnnotation(node.ObjectMeta, AnnotationKeyNotManagedByMCM) && node.Annotations[AnnotationKeyNotManagedByMCM] == "1" {
			nodeNotManagedByMCM++
			continue
		}
		if node.Spec.Unschedulable {
			continue
		}
		for _, condition := range node.Status.Conditions {
			if condition.Type == corev1.NodeReady && condition.Status == corev1.ConditionTrue {
				readyNodes++
			}
		}
	}

	// only nodes that are managed by MCM is considered
	registeredNodes = registeredNodes - nodeNotManagedByMCM

	machineList := &machinev1alpha1.MachineList{}
	if registeredNodes != desiredMachines || readyNodes != desiredMachines {
		if err := h.sourceClient.List(ctx, machineList, client.InNamespace(request.Namespace)); err != nil {
			err := fmt.Errorf("unable to check nodes. Failed to list machines in namespace %q: %w", request.Namespace, err)
			h.logger.Error(err, "Health check failed")
			return nil, err
		}
	}

	for _, deployment := range machineDeploymentList.Items {
		for _, failedMachine := range deployment.Status.FailedMachines {
			err := fmt.Errorf("machine %q failed: %s", failedMachine.Name, failedMachine.LastOperation.Description)
			h.logger.Error(err, "Health check failed")
			return &healthcheck.SingleCheckResult{
				Status: gardencorev1beta1.ConditionFalse,
				Detail: err.Error(),
			}, nil
		}
	}

	if isHealthy, err := checkMachineDeploymentsHealthy(machineDeploymentList.Items); !isHealthy {
		h.logger.Error(err, "Health check failed")
		return &healthcheck.SingleCheckResult{
			Status: gardencorev1beta1.ConditionFalse,
			Detail: err.Error(),
		}, nil
	}

	return &healthcheck.SingleCheckResult{Status: gardencorev1beta1.ConditionTrue}, nil
}

```

### Core Architecture Module: `extensions/pkg/controller/operatingsystemconfig/utils.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package operatingsystemconfig

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	extensionsv1alpha1 "github.com/gardener/gardener/pkg/apis/extensions/v1alpha1"
)

// SecretObjectMetaForConfig returns the object meta structure that can be used inside the
// secret that shall contain the generated OSC output.
func SecretObjectMetaForConfig(config *extensionsv1alpha1.OperatingSystemConfig) metav1.ObjectMeta {
	var (
		name      = fmt.Sprintf("osc-result-%s", config.Name)
		namespace = config.Namespace
	)

	if cloudConfig := config.Status.CloudConfig; cloudConfig != nil {
		name = cloudConfig.SecretRef.Name
		namespace = cloudConfig.SecretRef.Namespace
	}

	return metav1.ObjectMeta{
		Name:      name,
		Namespace: namespace,
	}
}

```

### Core Architecture Module: `extensions/pkg/controller/utils.go`
```
// SPDX-FileCopyrightText: Contributors to the Gardener project
//
// SPDX-License-Identifier: Apache-2.0

package controller

import (
	"context"
	"fmt"
	"reflect"

	autoscalingv1 "k8s.io/api/autoscaling/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	vpaautoscalingv1 "k8s.io/autoscaler/vertical-pod-autoscaler/pkg/apis/autoscaling.k8s.io/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/manager"

	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
	v1beta1constants "github.com/gardener/gardener/pkg/apis/core/v1beta1/constants"
	extensionsv1alpha1 "github.com/gardener/gardener/pkg/apis/extensions/v1alpha1"
	resourcesv1alpha1 "github.com/gardener/gardener/pkg/apis/resources/v1alpha1"
	securityv1alpha1 "github.com/gardener/gardener/pkg/apis/security/v1alpha1"
	kubernetesutils "github.com/gardener/gardener/pkg/utils/kubernetes"
)

var (
	localSchemeBuilder = runtime.NewSchemeBuilder(
		scheme.AddToScheme,
		extensionsv1alpha1.AddToScheme,
		resourcesv1alpha1.AddToScheme,
	)

	// AddToScheme adds the Kubernetes and extension scheme to the given scheme.
	AddToScheme = localSchemeBuilder.AddToScheme

	// ExtensionsScheme is the default scheme for extensions, consisting of all Kubernetes built-in
	// schemes (client-go/kubernetes/scheme) and the extensions/v1alpha1 scheme.
	ExtensionsScheme = runtime.NewScheme()
)

func init() {
	utilruntime.Must(AddToScheme(ExtensionsScheme))
}

// AddToManagerBuilder aggregates various AddToManager functions.
type AddToManagerBuilder []func(context.Context, manager.Manager) error

// NewAddToManagerBuilder creates a new AddToManagerBuilder and registers the given functions.
func NewAddToManagerBuilder(funcs ...func(context.Context, manager.Manager) error) AddToManagerBuilder {
	var builder AddToManagerBuilder

	builder.Register(funcs...)
	return builder
}

// Register registers the given functions in this builder.
func (a *AddToManagerBuilder) Register(funcs ...func(context.Context, manager.Manager) error) {
	*a = append(*a, funcs...)
}

// AddToManager traverses over all AddToManager-functions of this builder, sequentially applying
// them. It exits on the first error and returns it.
func (a *AddToManagerBuilder) AddToManager(c context.Context, m manager.Manager) error {
	for _, f := range *a {
		if err := f(c, m); err != nil {
			return err
		}
	}
	return nil
}

// GetSecretByReference returns the Secret object matching the given SecretReference.
var GetSecretByReference = kubernetesutils.GetSecretByReference

// WatchBuilder holds various functions which add watch controls to the passed Controller.
type WatchBuilder []func(controller.Controller) error

// NewWatchBuilder creates a new WatchBuilder and registers the given functions.
func NewWatchBuilder(funcs ...func(controller.Controller) error) WatchBuilder {
	var builder WatchBuilder

	builder.Register(funcs...)
	return builder
}

// Register adds a function which add watch controls to the passed Controller to the WatchBuilder.
func (w *WatchBuilder) Register(funcs ...func(controller.Controller) error) {
	*w = append(*w, funcs...)
}

// AddToController adds the registered watches to the passed controller.
func (w *WatchBuilder) AddToController(ctrl controller.Controller) error {
	for _, f := range *w {
		if err := f(ctrl); err != nil {
			return err
		}
	}
	return nil
}

// UnsafeGuessKind makes an unsafe guess what is the kind of the given object.
//
// The argument to this method _has_ to be a pointer, otherwise it panics.
func UnsafeGuessKind(obj runtime.Object) string {
	t := reflect.TypeOf(obj)
	if t.Kind() != reflect.Pointer {
		panic(fmt.Sprintf("kind of obj %T is not pointer", obj))
	}

	return t.Elem().Name()
}

// GetVerticalPodAutoscalerObject returns unstructured.Unstructured representing vpaautoscalingv1.VerticalPodAutoscaler
func GetVerticalPodAutoscalerObject() *unstructured.Unstructured {
	obj := &unstructured.Unstructured{}
	obj.SetAPIVersion(vpaautoscalingv1.SchemeGroupVersion.String())
	obj.SetKind("VerticalPodAutoscaler")
	return obj
}

// RemoveAnnotation removes an annotation key passed as annotation
func RemoveAnnotation(ctx context.Context, c client.Client, obj client.Object, annotation string) error {
	withAnnotation := obj.DeepCopyObject().(client.Object)

	annotations := obj.GetAnnotations()
	delete(annotations, annotation)
	obj.SetAnnotations(annotations)

	return c.Patch(ctx, obj, client.MergeFrom(withAnnotation))
}

// IsMigrated checks if an extension object has been migrated
func IsMigrated(obj extensionsv1alpha1.Object) bool {
	lastOp := obj.GetExtensionStatus().GetLastOperation()
	return lastOp != nil &&
		lastOp.Type == gardencorev1beta1.LastOperationTypeMigrate &&
		lastOp.State == gardencorev1beta1.LastOperationStateSucceeded
}

// ShouldSkipOperation checks if the current operation should be skipped depending on the lastOperation of the extension object.
func ShouldSkipOperation(operationType gardencorev1beta1.LastOperationType, obj extensionsv1alpha1.Object) bool {
	return operationType != gardencorev1beta1.LastOperationTypeMigrate && operationType != gardencorev1beta1.LastOperationTypeRestore && IsMigrated(obj)
}

// GetObjectByReference gets an object by the given reference, in the given namespace.
// If the object kind doesn't match the given reference kind this will result in an error.
func GetObjectByReference(ctx context.Context, c client.Client, ref *autoscalingv1.CrossVersionObjectReference, namespace string, obj client.Object) error {
	prefix := v1beta1constants.ReferencedResourcesPrefix
	if ref.APIVersion == securityv1alpha1.SchemeGroupVersion.String() && ref.Kind == "WorkloadIdentity" {
		prefix = v1beta1constants.ReferencedWorkloadIdentityPrefix
	}
	return c.Get(ctx, client.ObjectKey{Namespace: namespace, Name: prefix + ref.Name}, obj)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15884** (2026-10-04): **Update module sigs.k8s.io/controller-runtime to v0.25.2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [sigs.k8s.io/controller-runtime](https://redirect.github.com/kubernetes-sigs/controller-runtime) | `v0.25.1` → `v0.25.2` | ![age](https://developer.mend.io/api/mc/badges/age/go/sigs.k8s.io%2fcontroller-runtime/v0.25.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/sigs.k8s.io%2fcontroller-runtime/v0.25.1/v0.25.2?slim=true) |  ---  ### Release Notes  <details> <summary>kubernetes-sigs/controller-runtime (sigs.k8s.io/controller-runtime)</summary>  ### [`v0.25.2`](https://redirect.github.com/kubernetes-sigs/controller-runtime/releases/tag/v0.25.2)  [Compare Source](https://redirect.github.com/kubernetes-sigs/controller-runtime/compare/v0.25.1...v0.25.2)  #### What's Changed  - \[release-0.25] 🐛 Fix SubResourceCreateOptions.ApplyToSubResourceCreate by [@&#8203;k8s-infra-cherrypick-robot](https://redirect.github.com/k8s-infra-cherrypick-robot) in [#&#8203;3600](https://redirect.github.com/kubernetes-sigs/controller-runtime/pull/3600) - \[release-0.25] :sparkles: Add metrics handler options by [@&#8203;k8s-infra-cherrypick-robot](https://redirect.github.com/k8s-infra-cherrypick-robot) in [#&#8203;3603](https://redirect.github.com/kubernetes-sigs/controller-runtime/pull/3603) - \[release-0.25] :book: Document that ReadYourWrite doesn't work correctly 
  **Post-Mortem & Fix Analysis**:
  > /label skip-review
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [oliver-goetz](https://github.com/oliver-goetz) for approval. For more information see [the Code Review Process](https://gardener.cloud/docs/contribute/#pull-request-checklist).  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["oliver-goetz"]} -->

- **Issue #15883** (2026-10-03): **Update module github.com/docker/cli to v29.8.2+incompatible**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [github.com/docker/cli](https://redirect.github.com/docker/cli) | `v29.8.1+incompatible` → `v29.8.2+incompatible` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fdocker%2fcli/v29.8.2+incompatible?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fdocker%2fcli/v29.8.1+incompatible/v29.8.2+incompatible?slim=true) |  ---  ### Release Notes  <details> <summary>docker/cli (github.com/docker/cli)</summary>  ### [`v29.8.2+incompatible`](https://redirect.github.com/docker/cli/compare/v29.8.1...v29.8.2)  [Compare Source](https://redirect.github.com/docker/cli/compare/v29.8.1...v29.8.2)  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  **Release note**: ```other dependency NONE ``` <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTkuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjExOS4wIiwidGFyZ2V0QnJhbmNoIjoibWFzdGVyIiwibGFiZWxzIjpbImtpbmQvZW5oY
  **Post-Mortem & Fix Analysis**:
  > /label skip-review
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [timuthy](https://github.com/timuthy) for approval. For more information see [the Code Review Process](https://gardener.cloud/docs/contribute/#pull-request-checklist).  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["timuthy"]} -->

- **Issue #15882** (2026-10-04): **Replace `CEventually` with gomega's `Eventually`**
  *Symptoms*: <!-- Please ensure that you do not include company internal information. -->  **How to categorize this PR?** <!-- Please select area, kind, and priority for this pull request. This helps the community categorizing it. Replace below TODOs or exchange the existing identifiers with those that fit best in your opinion. If multiple identifiers make sense you can also state the commands multiple times, e.g.   /area control-plane   /area auto-scaling   ...  If the PR affects cryptography or security mechanisms (encryption, keys, ciphers, hashes, signatures, etc.), mark it as crypto relevant. /label crypto  "/area" identifiers:     audit-logging|auto-scaling|backup|compliance|control-plane-migration|control-plane|cost|delivery|dev-productivity|disaster-recovery|documentation|high-availability|logging|metering|monitoring|networking|open-source|ops-productivity|os|performance|quality|robustness|scalability|security|storage|testing|usability|user-management "/kind" identifiers:     api-change|bug|cleanup|discussion|enhancement|epic|flake|impediment|poc|post-mortem|question|regression|task|technical-debt|test --> /area testing /kind cleanup  **What this PR does / why we need it**: Gomega's `Eventually` accepts a `context.Context` as the first argument, so the custom `CEventually` helper is obsolete. This PR removes it and switches its only users to `Eventually(ctx, ...)`.  **Which issue(s) this PR fixes**: n/a  **Special notes for your reviewer**:  **Release n
  **Post-Mortem & Fix Analysis**:
  > Thanks! /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/gardener/gardener/pull/15882#issuecomment-5979202484" title="Approved">shafeeqes</a>*  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  The pull request process is described [here](https://gardener.cloud/docs/contribute/#pull-request-checklist)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)~~ [shafeeqes]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > LGTM label has been added.  <details>Git tree hash: 845637e7aed401e5abadd86dd6a211a04cd4222e</details>

- **Issue #15877** (2026-10-03): **Update dependency envoyproxy/envoy to v1.39.2**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [envoyproxy/envoy](https://redirect.github.com/envoyproxy/envoy) | patch | `distroless-v1.39.1` → `v1.39.2` | | envoyproxy/envoy | patch | `v1.39.1` → `v1.39.2` |  > [!TIP] > Updates to this image may depend on merging a pull request in the [ci-infra](https://redirect.github.com/gardener/ci-infra/pulls?q=sort%3Aupdated-desc+is%3Apr+is%3Aopen) repository. Usually, the PRs are auto-merged. However, there is no guarantee that the PRs will be merged in time for this update. If tests fail, please check that the the PR for your component is not stuck and trigger a retest.  ---  ### Release Notes  <details> <summary>envoyproxy/envoy (envoyproxy/envoy)</summary>  ### [`v1.39.2`](https://redirect.github.com/envoyproxy/envoy/releases/tag/v1.39.2)  [Compare Source](https://redirect.github.com/envoyproxy/envoy/compare/v1.39.1...v1.39.2)  **Summary of changes**:  - Security fixes:   - [CVE-2026-35189](https://redirect.github.com/google/boringssl/blob/main/docs/advisories/2026-09-29.md): tls: updated BoringSSL to fix excessive memory allocation when parsing certificates with `nameRelativeToCRLIssuer` CRL Distribution Points, which could be exploited for remote denial of service during TLS handshakes.  - Build/packaging:   - Removed Debian bullseye (11) packaging, as bullseye is end-of-life and its repositories are no longer available on the main Debian mirrors.   - Moved Debian `.changes` and release che
  **Post-Mortem & Fix Analysis**:
  > /label skip-review
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [oliver-goetz](https://github.com/oliver-goetz) for approval. For more information see [the Code Review Process](https://gardener.cloud/docs/contribute/#pull-request-checklist).  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["oliver-goetz"]} -->

- **Issue #15876** (2026-10-03): **[release-v1.152] Increase time for `PersistenVolumeSizeMismatch` alert to `15m`**
  *Symptoms*: This is an automated cherry-pick of #15846  /assign plkokanov  ```other operator github.com/gardener/gardener #15876 @RadaBDimitrova `PersistenVolumeSizeMismatch` alert is now triggered after 15m, instead of 5m to accommodate for larger/slower `pvc-autoscaler` resizes. ```  /kind bug
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/gardener/gardener/pull/15876#pullrequestreview-5399792172" title="Approved">ScheererJ</a>*  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  The pull request process is described [here](https://gardener.cloud/docs/contribute/#pull-request-checklist)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/gardener/gardener/blob/release-v1.152/OWNERS)~~ [ScheererJ]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > LGTM label has been added.  <details>Git tree hash: 4518b41fec24dc3479f5f908466debc36969cf2f</details>

- **Issue #15875** (2026-10-03): **[release-v1.151] Increase time for `PersistenVolumeSizeMismatch` alert to `15m`**
  *Symptoms*: This is an automated cherry-pick of #15846  /assign plkokanov  ```other operator github.com/gardener/gardener #15875 @RadaBDimitrova `PersistenVolumeSizeMismatch` alert is now triggered after 15m, instead of 5m to accommodate for larger/slower `pvc-autoscaler` resizes. ```  /kind bug
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/gardener/gardener/pull/15875#pullrequestreview-5399796336" title="Approved">ScheererJ</a>*  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  The pull request process is described [here](https://gardener.cloud/docs/contribute/#pull-request-checklist)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/gardener/gardener/blob/release-v1.151/OWNERS)~~ [ScheererJ]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > LGTM label has been added.  <details>Git tree hash: 5d8e2faede19ac674a93ed9496df14e667954c83</details>
  > /retest

- **Issue #15870** (2026-10-02): **Fix remote `make seed-up` by making the dev-setup registry CA local-kind-only**
  *Symptoms*: **How to categorize this PR?**  /area dev-productivity /area networking /kind bug  **What this PR does / why we need it**: Fixed `make seed-up` for the remote scenario failing with a missing `secret-registry-ca.yaml`; the local dev-setup registry CA is now scoped to local kind scenarios only.  **Which issue(s) this PR fixes**: Fixes #  **Special notes for your reviewer**:  **Release note**: ```other operator Fixed `make seed-up` for the remote scenario failing with a missing `secret-registry-ca.yaml`; the local dev-setup registry CA is now scoped to local kind scenarios only. ```
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [acumino](https://github.com/acumino) for approval. For more information see [the Code Review Process](https://gardener.cloud/docs/contribute/#pull-request-checklist).  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["acumino"]} -->
  > /retest
  > /retest 

- **Issue #15867** (2026-10-02): **Improve gardener-node-agent lease error message**
  *Symptoms*: <!-- Please ensure that you do not include company internal information. -->  **How to categorize this PR?** <!-- Please select area, kind, and priority for this pull request. This helps the community categorizing it. Replace below TODOs or exchange the existing identifiers with those that fit best in your opinion. If multiple identifiers make sense you can also state the commands multiple times, e.g.   /area control-plane   /area auto-scaling   ...  If the PR affects cryptography or security mechanisms (encryption, keys, ciphers, hashes, signatures, etc.), mark it as crypto relevant. /label crypto  "/area" identifiers:     audit-logging|auto-scaling|backup|compliance|control-plane-migration|control-plane|cost|delivery|dev-productivity|disaster-recovery|documentation|high-availability|logging|metering|monitoring|networking|open-source|ops-productivity|os|performance|quality|robustness|scalability|security|storage|testing|usability|user-management "/kind" identifiers:     api-change|bug|cleanup|discussion|enhancement|epic|flake|impediment|poc|post-mortem|question|regression|task|technical-debt|test --> /area ops-productivity /kind enhancement  **What this PR does / why we need it**: The previous error message `"gardener-node-agent stopped running on node %q"` was misleading and lacking accuracy: a lease expiry can be caused by transient apiserver issue or network connectivity issue, not necessarily a stopped process. This replaces it with a message that ac
  **Post-Mortem & Fix Analysis**:
  > LGTM label has been added.  <details>Git tree hash: e8ae58031dcfefacec9cd4aea8e5595d73f9b35e</details>
  > /test pull-gardener-e2e-kind-migration-ha-multi-node /test pull-gardener-verify-image-build /test pull-gardener-integration /test pull-gardener-e2e-kind-operator
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/gardener/gardener/pull/15867#pullrequestreview-5388757801" title="Approved">timebertt</a>*  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  The pull request process is described [here](https://gardener.cloud/docs/contribute/#pull-request-checklist)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)~~ [timebertt]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

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

### Incident Patch 1: `92a252c0` (2026-10-05)
**Commit Message**: Fix Fluentbit's ServiceMonitor Prometheus label when in garden cluster (#15659)

* Fix fluentbit prometheus label

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Address feedback

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Removed ValiEnabled flag and systemd ClusterOutput from tests

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

---------

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

**File**: `pkg/component/observability/logging/fluentbit/fluentbit.go` (modified, +22/-4)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/gardener/gardener/pkg/component/observability/logging/fluentcustomresources"
 	valiconstants "github.com/gardener/gardener/pkg/component/observability/logging/vali/constants"
 	"github.com/gardener/gardener/pkg/component/observability/monitoring/prometheus/aggregate"
+	"github.com/gardener/gardener/pkg/component/observability/monitoring/prometheus/garden"
 	monitoringutils "github.com/gardener/gardener/pkg/component/observability/monitoring/utils"
 	"github.com/gardener/gardener/pkg/features"
 	"github.com/gardener/gardener/pkg/utils"
@@ -57,6 +58,8 @@ type Values struct {
 	InitContainerImage string
 	// PriorityClassName is the name of the priority class of the fluent-bit.
 	PriorityClassName string
+	// IsGardenCluster specifies whether FluentBit is being deployed in a cluster registered as a Garden.
+	IsGardenCluster bool
 }
 
 type fluentBit struct {
@@ -94,7 +97,7 @@ func (f *fluentBit) Deploy(ctx context.Context) error {
 			},
 		}
 		serviceMonitor = &monitoringv1.ServiceMonitor{
-			ObjectMeta: monitoringutils.ConfigObjectMeta("fluent-bit", f.namespace, aggregate.Label),
+			ObjectMeta: monitoringutils.ConfigObjectMeta("fluent-bit", f.namespace, f.getPrometheusLabel()),
 			Spec: monitoringv1.ServiceMonitorSpec{
 				Selector: metav1.LabelSelector{MatchLabels: getLabels()},
 				Endpoints: []monitoringv1.Endpoint{{
@@ -128,7 +131,7 @@ func (f *fluentBit) Deploy(ctx context.Context) error {
 			},
 		}
 		serviceMonitorPlugin = &monitoringv1.ServiceMonitor{
-			ObjectMeta: monitoringutils.ConfigObjectMeta("fluent-bit-output-plugin", f.namespace, aggregate.Label),
+			ObjectMeta: monitoringutils.ConfigObjectMeta("fluent-bit-output-plugin", f.namespace, f.getPrometheusLabel()),
 			Spec: monitoringv1.ServiceMonitorSpec{
 				Selector: metav1.LabelSelector{MatchLabels: getLabels()},
 				Endpoints: []monitoringv1.Endpoint{{
@@ -193,7 +196,7 @@ func (f *fluentBit) Deploy(ctx context.Context) error {
 			},
 		}
 		prometheusRule = &monitoringv1.PrometheusRule{
-			ObjectMeta: monitoringutils.ConfigObjectMeta("fluent-bit", f.namespace, aggregate.Label),
+			ObjectMeta: monitoringutils.ConfigObjectMeta("fluent-bit", f.namespace, f.getPrometheusLabel()),
 			Spec: monitoringv1.PrometheusRuleSpec{
 				Groups: []monitoringv1.RuleGroup{{
 					Name: "fluent-bit.rules",
@@ -358,10 +361,25 @@ func getCustomResourcesLabels() map[string]string {
 	}
 }
 
+func (f *fluentBit) getPrometheusLabel() string {
+	if f.values.IsGardenCluster {
+		return garden.Label
+	}
+
+	return aggregate.Label
+}
+
 func (f *fluentBit) getFluentBit() *fluentbitv1alpha2.FluentBit {
+	var networkPolicyFromPolicyAnnotationPrefix string
+	if f.values.IsGardenCluster {
+		networkPolicyFromPolicyAnnotationPrefix = v1beta1constants.LabelNetworkPolicyGardenScrapeTargets
+	} else {
+		networkPolicyFromPolicyAnnotationPrefix = v1beta1constants.LabelNetworkPolicySeedScrapeTargets
+	}
+
 	annotations := map[string]string{
 		resourcesv1alpha1.NetworkPolicyFromPolicyAnnotationPrefix +
-			v1beta1constants.LabelNetworkPolicySeedScrapeTargets +
+			networkPolicyFromPolicyAnnotationPrefix +
 			resourcesv1alpha1.NetworkPolicyFromPolicyAnnotationSuffix: `[{"port":2020,"protocol":"TCP"},{"port":2021,"protocol":"TCP"}]`,
 	}
 
```

**File**: `pkg/component/observability/logging/fluentbit/fluentbit_test.go` (modified, +224/-147)
```diff
@@ -43,6 +43,7 @@ var _ = Describe("Fluent Bit", func() {
 			Image:              image,
 			InitContainerImage: image,
 			PriorityClassName:  priorityClassName,
+			IsGardenCluster:    false,
 		}
 
 		c         client.Client
@@ -53,164 +54,144 @@ var _ = Describe("Fluent Bit", func() {
 		customResourcesManagedResource       *resourcesv1alpha1.ManagedResource
 		customResourcesManagedResourceSecret *corev1.Secret
 
-		serviceMonitor = &monitoringv1.ServiceMonitor{
-			ObjectMeta: metav1.ObjectMeta{
-				Name:      "aggregate-fluent-bit",
-				Namespace: namespace,
-				Labels:    map[string]string{"prometheus": "aggregate"},
-			},
-			Spec: monitoringv1.ServiceMonitorSpec{
-				Selector: metav1.LabelSelector{MatchLabels: map[string]string{
-					"app":                              "fluent-bit",
-					"role":                             "logging",
-					"gardener.cloud/role":              "logging",
-					"networking.gardener.cloud/to-dns": "allowed",
-					"networking.gardener.cloud/to-runtime-apiserver":                                               "allowed",
-					"networking.resources.gardener.cloud/to-all-shoots-opentelemetry-collector-collector-tcp-4317": "allowed",
-					"networking.resources.gardener.cloud/to-opentelemetry-collector-collector-tcp-4317":            "allowed",
-				}},
-				Endpoints: []monitoringv1.Endpoint{{
-					Port: "metrics",
-					RelabelConfigs: []monitoringv1.RelabelConfig{
-						{
-							TargetLabel: "__metrics_path__",
-							Replacement: new("/api/v2/metrics/prometheus"),
-						},
-						{
-							Action: "labelmap",
-							Regex:  `__meta_kubernetes_pod_label_(.+)`,
-						},
+		// serviceMonitorSpec and serviceMonitorPluginSpec hold the common spec, reused across seed/garden tests
+		serviceMonitorSpec = monitoringv1.ServiceMonitorSpec{
+			Selector: metav1.LabelSelector{MatchLabels: map[string]string{
+				"app":                              "fluent-bit",
+				"role":                             "logging",
+				"gardener.cloud/role":              "logging",
+				"networking.gardener.cloud/to-dns": "allowed",
+				"networking.gardener.cloud/to-runtime-apiserver":                                               "allowed",
+				"networking.resources.gardener.cloud/to-all-shoots-opentelemetry-collector-collector-tcp-4317": "allowed",
+				"networking.resources.gardener.cloud/to-opentelemetry-collector-collector-tcp-4317":            "allowed",
+			}},
+			Endpoints: []monitoringv1.Endpoint{{
+				Port: "metrics",
+				RelabelConfigs: []monitoringv1.RelabelConfig{
+					{
+						TargetLabel: "__metrics_path__",
+						Replacement: new("/api/v2/metrics/prometheus"),
 					},
-					MetricRelabelConfigs: []monitoringv1.RelabelConfig{{
-						SourceLabels: []monitoringv1.LabelName{"__name__"},
-						Action:       "keep",
-						Regex:        `^(fluentbit_input_bytes_total|fluentbit_input_records_total|fluentbit_output_proc_bytes_total|fluentbit_output_proc_records_total|fluentbit_output_errors_total|fluentbit_output_retries_total|fluentbit_output_retries_failed_total|fluentbit_filter_add_records_total|fluentbit_filter_drop_records_total|fluentbit_storage_mem_chunks|fluentbit_storage_fs_chunks|fluentbit_storage_fs_chunks_up|fluentbit_storage_fs_chunks_down)$`,
-					}},
+					{
+						Action: "labelmap",
+						Regex:  `__meta_kubernetes_pod_label_(.+)`,
+					},
+				},
+				MetricRelabelConfigs: []monitoringv1.RelabelConfig{{
+					SourceLabels: []monitoringv1.LabelName{"__name__"},
+					Action:       "keep",
+					Regex:        `^(fluentbit_input_bytes_total|fluentbit_input_records_total|fluentbit_output_proc_bytes_total|fluentbit_output_proc_records_total|fluentbit_output_errors_total|fluentbit_output_retries_total|fluentbit_output_retries_failed_total|fluentbit_filter_add_records_total|fluentbit_filter_drop_records_total|fluentbit_storage_mem_chunks|fluentbit_storage_fs_chunks|fluentbit_storage_fs_chunks_up|fluentbit_storage_fs_chunks_down)$`,
 				}},
-			},
+			}},
 		}
-		serviceMonitorPlugin = &monitoringv1.ServiceMonitor{
-			ObjectMeta: metav1.ObjectMeta{
-				Name:      "aggregate-fluent-bit-output-plugin",
-				Namespace: namespace,
-				Labels:    map[string]string{"prometheus": "aggregate"},
-			},
-			Spec: monitoringv1.ServiceMonitorSpec{
-				Selector: metav1.LabelSelector{MatchLabels: map[string]string{
-					"app":                              "fluent-bit",
-					"role":                             "logging",
-					"gardener.cloud/role":              "logging",
-					"networking.gardener.cloud/to-dns": "allowed",
-					"networking.gardener.cloud/to-runtime-apiserver":                                               "allowed",
-					"networking.resources.gardener.cloud/to-all-shoots-opentelemetry-collector-collector-tcp-4317": "allowed",
-					"networking.resources.gardener.cloud/to-opentelemetry-collector-collector-tcp-4317":            "allowed",
+		serviceMonitorPluginSpec = monitoringv1.ServiceMonitorSpec{
+			Selector: metav1.LabelSelector{MatchLab
```

**File**: `pkg/component/observability/logging/fluentbit/testdata/garden-fluent-bit.prometheusrule.test.yaml` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+rule_files:
+- garden-fluent-bit.prometheusrule.yaml
+
+evaluation_interval: 30s
+
+tests:
+
+- interval: 30s
+  external_labels:
+    seed: aws
+  input_series:
+  # FluentBitDown
+  - series: 'up{job="fluent-bit"}'
+    values: '0+0x30'
+  alert_rule_test:
+  - eval_time: 15m
+    alertname: FluentBitDown
+    exp_alerts:
+    - exp_labels:
+        service: logging
+        severity: warning
+        type: seed
+        visibility: operator
+      exp_annotations:
+        description: "There are no fluent-bit pods running on seed: aws. No logs will be collected."
+        summary: Fluent-bit is down
+
+- interval: 1m
+  external_labels:
+    seed: aws
+  input_series:
+  # FluentBitDown
+  - series: 'fluentbit_input_bytes_total{pod="fluent-bit-test"}'
+    values: '1+1x3 4+0x370'
+  alert_rule_test:
+  - eval_time: 370m
+    alertname: FluentBitIdleInputPlugins
+    exp_alerts:
+    - exp_labels:
+        service: logging
+        severity: warning
+        type: seed
+        visibility: operator
+        pod: fluent-bit-test
+      exp_annotations:
+        description: The input plugins of Fluent-bit pod fluent-bit-test running on seed aws haven't collected any logs for the last 6 hours.
+        summary: Fluent-bit input plugins haven't process any data for the past 6 hours
+
+- interval: 1m
+  external_labels:
+    seed: aws
+  input_series:
+  # FluentBitReceivesLogsWithoutMetadata
+  - series: 'fluentbit_vali_gardener_logs_without_metadata_total{pod="fluent-bit-test"}'
+    values: '0+0x3 0+1x30'
+  alert_rule_test:
+  - eval_time: 22m
+    alertname: FluentBitReceivesLogsWithoutMetadata
+    exp_alerts:
+    - exp_labels:
+        pod: fluent-bit-test
+        service: logging
+        severity: warning
+        type: seed
+        visibility: operator
+      exp_annotations:
+        description: "fluent-bit-test receives logs without metadata on seed: aws. These logs will be dropped."
+        summary: Fluent-bit receives logs without metadata
+
+- interval: 1m
+  external_labels:
+    seed: aws
+  input_series:
+  # FluentBitSendsOoOLogs
+  - series: 'prometheus_target_scrapes_sample_out_of_order_total{pod="fluent-bit-test"}'
+    values: '0+0x3 0+1x30'
+  alert_rule_test:
+  - eval_time: 22m
+    alertname: FluentBitSendsOoOLogs
+    exp_alerts:
+    - exp_labels:
+        pod: fluent-bit-test
+        service: logging
+        severity: warning
+        type: seed
+        visibility: operator
+      exp_annotations:
+        description: "fluent-bit-test on seed: aws sends OutOfOrder logs to the Vali. These logs will be dropped."
+        summary: Fluent-bit sends OoO logs
+
+- interval: 1m
+  external_labels:
+    seed: aws
+  input_series:
+  # FluentBitGardenerValiPluginErrors
+  - series: 'fluentbit_vali_gardener_errors_total{pod="fluent-bit-test"}'
+    values: '0+0x3 0+1x30'
+  alert_rule_test:
+  - eval_time: 22m
+    alertname: FluentBitGardenerValiPluginErrors
+    exp_alerts:
+    - exp_labels:
+        pod: fluent-bit-test
+        service: logging
+        severity: warning
+        type: seed
+        visibility: operator
+      exp_annotations:
+        description: "There are errors in the fluent-bit-test GardenerVali plugin on seed: aws."
+        summary: Errors in Fluent-bit GardenerVali plugin
+
```

**File**: `pkg/component/shared/fluent_bit.go` (modified, +2/-0)
```diff
@@ -22,6 +22,7 @@ func NewFluentBit(
 	gardenNamespaceName string,
 	enabled bool,
 	priorityClassName string,
+	isGardenCluster bool,
 ) (
 	deployer component.DeployWaiter,
 	err error,
@@ -43,6 +44,7 @@ func NewFluentBit(
 			Image:              fluentBitImage.String(),
 			InitContainerImage: fluentBitInitImageName,
 			PriorityClassName:  priorityClassName,
+			IsGardenCluster:    isGardenCluster,
 		},
 	)
 
```

**File**: `pkg/gardenlet/controller/seed/seed/components.go` (modified, +1/-0)
```diff
@@ -1037,6 +1037,7 @@ func (r *Reconciler) newFluentBit() (component.DeployWaiter, error) {
 		r.GardenNamespace,
 		gardenlethelper.IsLoggingEnabled(&r.Config),
 		v1beta1constants.PriorityClassNameSeedSystem600,
+		false,
 	)
 }
 
```

**File**: `pkg/operator/controller/garden/garden/components.go` (modified, +1/-0)
```diff
@@ -1445,6 +1445,7 @@ func (r *Reconciler) newFluentBit() (component.DeployWaiter, error) {
 		r.GardenNamespace,
 		true,
 		v1beta1constants.PriorityClassNameGardenSystem100,
+		true,
 	)
 }
 
```

---

### Incident Patch 2: `b38f29c0` (2026-10-05)
**Commit Message**: Improve memory consumption for `gardener-admission-controller` (II) (#15837)

* Prevent (un)marshal actions in `resourcesize` validator

Preventing marshalling and unmarshalling reduces the memory allocation during the validation action significantly.

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

* Add field selectors for `CredentialsBinding` and `SecretBinding`

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

* Address review feedback

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

* Exit early in `shootkubeconfigsecretref_validator`

Exit early when Kubeconfig was not removed at all and prevent listing all shoots in the project namespace.
Listing shoots can be an expensive operation since all shoot objects are deeply copied into a new shoot list.

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

* Add field selectors for admission plugin and structured authz

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

* Enhance unit tests

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

---------

Signed-off-by: Tim Usner <[REDACTED_EMAIL]>

**File**: `cmd/gardener-admission-controller/app/app.go` (modified, +8/-0)
```diff
@@ -142,6 +142,14 @@ func addAllFieldIndexes(ctx context.Context, i client.FieldIndexer) error {
 		indexer.AddShootAuditPolicyConfigMapName,
 		indexer.AddShootAuthenticationConfigMapName,
 		indexer.AddShootAuthorizationConfigMapName,
+		indexer.AddShootAdmissionPluginKubeconfigSecretName,
+		indexer.AddShootStructuredAuthorizationKubeconfigSecretName,
+		indexer.AddSecretBindingSecretRefName,
+		indexer.AddSecretBindingSecretRefNamespace,
+		// security API group
+		indexer.AddCredentialsBindingCredentialsRefName,
+		indexer.AddCredentialsBindingCredentialsRefNamespace,
+		indexer.AddCredentialsBindingCredentialsRefKind,
 	} {
 		if err := fn(ctx, i); err != nil {
 			return err
```

**File**: `pkg/admissioncontroller/webhook/admission/providersecretlabels/handler.go` (modified, +16/-10)
```diff
@@ -19,8 +19,10 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
 
 	v1beta1helper "github.com/gardener/gardener/pkg/api/core/v1beta1/helper"
+	gardencore "github.com/gardener/gardener/pkg/apis/core"
 	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
 	v1beta1constants "github.com/gardener/gardener/pkg/apis/core/v1beta1/constants"
+	"github.com/gardener/gardener/pkg/apis/security"
 	securityv1alpha1 "github.com/gardener/gardener/pkg/apis/security/v1alpha1"
 )
 
@@ -102,32 +104,36 @@ func (h *InternalSecretHandler) Default(ctx context.Context, obj runtime.Object)
 
 func (h *Handler) fetchProviderTypesFromSecretBindings(ctx context.Context, name, namespace string) (sets.Set[string], error) {
 	secretBindingList := &gardencorev1beta1.SecretBindingList{}
-	if err := h.Client.List(ctx, secretBindingList); err != nil {
+	if err := h.Client.List(ctx, secretBindingList, client.MatchingFields{
+		gardencore.SecretBindingSecretRefName:      name,
+		gardencore.SecretBindingSecretRefNamespace: namespace,
+	}); err != nil {
 		return nil, fmt.Errorf("failed to list SecretBindings: %w", err)
 	}
 
 	providerTypes := sets.New[string]()
 	for _, secretBinding := range secretBindingList.Items {
-		if secretBinding.SecretRef.Name == name &&
-			secretBinding.SecretRef.Namespace == namespace {
-			providerTypes.Insert(v1beta1helper.GetSecretBindingTypes(&secretBinding)...)
-		}
+		providerTypes.Insert(v1beta1helper.GetSecretBindingTypes(&secretBinding)...)
 	}
 	return providerTypes, nil
 }
 
 func (h *Handler) fetchProviderTypesFromCredentialsBindings(ctx context.Context, apiVersion, kind, name, namespace string) (sets.Set[string], error) {
 	credentialsBindingList := &securityv1alpha1.CredentialsBindingList{}
-	if err := h.Client.List(ctx, credentialsBindingList); err != nil {
+	if err := h.Client.List(ctx, credentialsBindingList, client.MatchingFields{
+		security.CredentialsBindingCredentialsRefName:      name,
+		security.CredentialsBindingCredentialsRefNamespace: namespace,
+		security.CredentialsBindingCredentialsRefKind:      kind,
+	}); err != nil {
 		return nil, fmt.Errorf("failed to list CredentialsBindings: %w", err)
 	}
 
 	providerTypes := sets.New[string]()
 	for _, credentialsBinding := range credentialsBindingList.Items {
-		if credentialsBinding.CredentialsRef.APIVersion == apiVersion &&
-			credentialsBinding.CredentialsRef.Kind == kind &&
-			credentialsBinding.CredentialsRef.Name == name &&
-			credentialsBinding.CredentialsRef.Namespace == namespace {
+		// The API version must be checked explicitly because it is not indexed.
+		// Indexing it is unnecessary, as the same API version is usually used for all kinds
+		// and would therefore provide no meaningful performance benefit.
+		if credentialsBinding.CredentialsRef.APIVersion == apiVersion {
 			providerTypes.Insert(credentialsBinding.Provider.Type)
 		}
 	}
```

**File**: `pkg/admissioncontroller/webhook/admission/providersecretlabels/handler_test.go` (modified, +11/-1)
```diff
@@ -17,7 +17,10 @@ import (
 	logzap "sigs.k8s.io/controller-runtime/pkg/log/zap"
 
 	. "github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/providersecretlabels"
+	"github.com/gardener/gardener/pkg/api/indexer"
+	gardencore "github.com/gardener/gardener/pkg/apis/core"
 	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
+	"github.com/gardener/gardener/pkg/apis/security"
 	securityv1alpha1 "github.com/gardener/gardener/pkg/apis/security/v1alpha1"
 	"github.com/gardener/gardener/pkg/client/kubernetes"
 	"github.com/gardener/gardener/pkg/logger"
@@ -38,7 +41,14 @@ var _ = Describe("handler", func() {
 		ctx = context.Background()
 		log = logger.MustNewZapLogger(logger.DebugLevel, logger.FormatJSON, logzap.WriteTo(GinkgoWriter))
 
-		fakeClient = fakeclient.NewClientBuilder().WithScheme(kubernetes.GardenScheme).Build()
+		fakeClient = fakeclient.NewClientBuilder().
+			WithScheme(kubernetes.GardenScheme).
+			WithIndex(&gardencorev1beta1.SecretBinding{}, gardencore.SecretBindingSecretRefName, indexer.SecretBindingSecretRefNameIndexerFunc).
+			WithIndex(&gardencorev1beta1.SecretBinding{}, gardencore.SecretBindingSecretRefNamespace, indexer.SecretBindingSecretRefNamespaceIndexerFunc).
+			WithIndex(&securityv1alpha1.CredentialsBinding{}, security.CredentialsBindingCredentialsRefName, indexer.CredentialsBindingCredentialsRefNameIndexerFunc).
+			WithIndex(&securityv1alpha1.CredentialsBinding{}, security.CredentialsBindingCredentialsRefNamespace, indexer.CredentialsBindingCredentialsRefNamespaceIndexerFunc).
+			WithIndex(&securityv1alpha1.CredentialsBinding{}, security.CredentialsBindingCredentialsRefKind, indexer.CredentialsBindingCredentialsRefKindIndexerFunc).
+			Build()
 
 		namespace = "test"
 		provider1, provider2 = "provider1", "provider2"
```

**File**: `pkg/admissioncontroller/webhook/admission/resourcesize/handler.go` (modified, +33/-15)
```diff
@@ -6,6 +6,7 @@ package resourcesize
 
 import (
 	"context"
+	stdjson "encoding/json"
 	"errors"
 	"fmt"
 	"net/http"
@@ -112,23 +113,30 @@ func (h *Handler) handle(ctx context.Context, req admission.Request) error {
 }
 
 func (h *Handler) handleSizeLimit(req admission.Request, log logr.Logger, limit *resource.Quantity) error {
-	objectSize, err := relevantObjectSize(req.Object.Raw)
+	// First try to compare the full object size which is faster and avoids decoding the object.
+	fullObjectSize := int64(len(req.Object.Raw))
+	if limit.CmpInt64(fullObjectSize) != -1 {
+		return nil
+	}
+
+	// If the full object size exceeds the limit, we decode the object and calculate the object size without irrelevant fields (status and managedFields) to avoid false positives.
+	reducedObjectSize, err := reducedObjectSize(req.Object.Raw)
 	if err != nil {
 		return err
 	}
-	if limit.CmpInt64(objectSize) == -1 {
+	if limit.CmpInt64(reducedObjectSize) == -1 {
 		if h.Config.OperationMode == nil || *h.Config.OperationMode == admissioncontrollerconfigv1alpha1.AdmissionModeBlock {
-			log.Info("Maximum resource size exceeded, rejected request", "requestObjectSize", objectSize, "limit", limit)
+			log.Info("Maximum resource size exceeded, rejected request", "requestObjectSize", reducedObjectSize, "limit", limit)
 			metrics.RejectedResources.WithLabelValues(
 				fmt.Sprint(req.Operation),
 				req.Kind.Kind,
 				req.Namespace,
 				metricReasonSizeExceeded,
 			).Inc()
-			return apierrors.NewForbidden(schema.GroupResource{Group: req.Resource.Group, Resource: req.Resource.Resource}, req.Name, fmt.Errorf("maximum resource size exceeded! Size in request: %d bytes, max allowed: %s", objectSize, limit))
+			return apierrors.NewForbidden(schema.GroupResource{Group: req.Resource.Group, Resource: req.Resource.Resource}, req.Name, fmt.Errorf("maximum resource size exceeded! Size in request: %d bytes, max allowed: %s", reducedObjectSize, limit))
 		}
 
-		log.Info("Maximum resource size exceeded, request would be denied in blocking mode", "requestObjectSize", objectSize, "limit", limit)
+		log.Info("Maximum resource size exceeded, request would be denied in blocking mode", "requestObjectSize", reducedObjectSize, "limit", limit)
 	}
 
 	return nil
@@ -171,18 +179,28 @@ func (h *Handler) handleCountLimit(ctx context.Context, req admission.Request, l
 	return nil
 }
 
-func relevantObjectSize(rawObject []byte) (int64, error) {
-	var obj map[string]any
-	err := json.Unmarshal(rawObject, &obj)
-	if err != nil {
-		return 0, err
+func reducedObjectSize(rawObject []byte) (int64, error) {
+	var obj map[string]stdjson.RawMessage
+	if err := json.Unmarshal(rawObject, &obj); err != nil {
+		return 0, fmt.Errorf("failed to decode object: %w", err)
 	}
-	delete(obj, "status")
-	if obj["metadata"] != nil {
-		delete(obj["metadata"].(map[string]any), "managedFields")
+
+	objectSize := len(rawObject)
+
+	// Subtract status sub-resource
+	objectSize -= len(obj["status"])
+
+	// Subtract managedFields from metadata
+	if metadata, ok := obj["metadata"]; ok {
+		var metadataObj map[string]stdjson.RawMessage
+		if err := json.Unmarshal(metadata, &metadataObj); err != nil {
+			return 0, fmt.Errorf("failed to decode metadata: %w", err)
+		}
+
+		objectSize -= len(metadataObj["managedFields"])
 	}
-	marshalled, err := json.Marshal(obj)
-	return int64(len(marshalled)), err
+
+	return int64(objectSize), nil
 }
 
 func serviceAccountMatch(userInfo authenticationv1.UserInfo, subjects []rbacv1.Subject) bool {
```

**File**: `pkg/admissioncontroller/webhook/admission/shootkubeconfigsecretref/handler.go` (modified, +37/-37)
```diff
@@ -13,9 +13,11 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	apierrors "k8s.io/apimachinery/pkg/api/errors"
 	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/util/sets"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
 
+	gardencore "github.com/gardener/gardener/pkg/apis/core"
 	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
 	"github.com/gardener/gardener/pkg/client/kubernetes"
 )
@@ -32,43 +34,42 @@ func (h *Handler) ValidateCreate(_ context.Context, _ runtime.Object) (admission
 }
 
 // ValidateUpdate validates that the kubeconfig is not removed from kubeconfig secrets referenced in Shoot resources.
-func (h *Handler) ValidateUpdate(ctx context.Context, _, newObj runtime.Object) (admission.Warnings, error) {
-	var shoots []string
-
-	secret, ok := newObj.(*corev1.Secret)
+func (h *Handler) ValidateUpdate(ctx context.Context, oldObj, newObj runtime.Object) (admission.Warnings, error) {
+	newSecret, ok := newObj.(*corev1.Secret)
 	if !ok {
 		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected *corev1.Secret but got %T", newObj))
 	}
 
+	oldSecret, ok := oldObj.(*corev1.Secret)
+	if !ok {
+		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected *corev1.Secret but got %T", oldObj))
+	}
+
 	req, err := admission.RequestFromContext(ctx)
 	if err != nil {
 		return nil, apierrors.NewInternalError(err)
 	}
 
-	if kubeConfig, ok := secret.Data[kubernetes.KubeConfig]; ok && len(kubeConfig) > 0 {
-		h.Logger.Info("Secret has data `kubeconfig`, no need to check further", "name", secret.Name)
+	// If the new secret still has a non-empty kubeconfig, nothing is removed and there is no need to check further.
+	if kubeConfig, ok := newSecret.Data[kubernetes.KubeConfig]; ok && len(kubeConfig) > 0 {
+		h.Logger.Info("Secret has data `kubeconfig`, no need to check further", "name", newSecret.Name)
 		return nil, nil
 	}
 
-	// lookup if secret is referenced by any shoot in the same namespace
-	shootList := &gardencorev1beta1.ShootList{}
-	if err := h.Client.List(ctx, shootList, client.InNamespace(req.Namespace)); err != nil {
-		return nil, apierrors.NewInternalError(fmt.Errorf("unable to list shoot in namespace: %v", req.Namespace))
+	// If the old secret did not have a non-empty kubeconfig either, nothing is being removed and there is no need to
+	// proceed further.
+	if oldKubeConfig, ok := oldSecret.Data[kubernetes.KubeConfig]; !ok || len(oldKubeConfig) == 0 {
+		return nil, nil
 	}
 
-	for _, shoot := range shootList.Items {
-		if shoot.Spec.Kubernetes.KubeAPIServer == nil {
-			continue
-		}
-
-		if isReferencedInAdmissionPlugins(req.Name, shoot.Spec.Kubernetes.KubeAPIServer.AdmissionPlugins) ||
-			isReferencedInStructuredAuthorization(req.Name, shoot.Spec.Kubernetes.KubeAPIServer.StructuredAuthorization) {
-			shoots = append(shoots, shoot.Name)
-		}
+	// Check if the secret is referenced by any shoot in the same namespace via field-selector-backed indexes.
+	shoots, err := h.referencingShootNames(ctx, req.Namespace, req.Name)
+	if err != nil {
+		return nil, apierrors.NewInternalError(err)
 	}
 
-	if len(shoots) > 0 {
-		return nil, apierrors.NewForbidden(corev1.Resource("Secret"), req.Name, fmt.Errorf("data kubeconfig can't be removed from secret or set to empty because secret is in use by shoots: [%v]", strings.Join(shoots, ", ")))
+	if shoots.Len() > 0 {
+		return nil, apierrors.NewForbidden(corev1.Resource("Secret"), req.Name, fmt.Errorf("data kubeconfig can't be removed from secret or set to empty because secret is in use by shoots: [%v]", strings.Join(sets.List(shoots), ", ")))
 	}
 
 	return nil, nil
@@ -79,25 +80,24 @@ func (h *Handler) ValidateDelete(_ context.Context, _ runtime.Object) (admission
 	return nil, nil
 }
 
-func isReferencedInAdmissionPlugins(secretName string, admissionPlugins []gardencorev1beta1.AdmissionPlugin) bool {
-	for _, plugin := range admissionPlugins {
-		if plugin.KubeconfigSecretName != nil && *plugin.KubeconfigSecretName == secretName {
-			return true
+// referencingShootNames returns the names of the shoots in the given namespace that reference the secret with the
+// given name either via an admission plugin kubeconfig or via a structured authorization kubeconfig.
+func (h *Handler) referencingShootNames(ctx context.Context, namespace, secretName string) (sets.Set[string], error) {
+	shoots := sets.New[string]()
+
+	for _, field := range []string{
+		gardencore.ShootAdmissionPluginKubeconfigSecretName,
+		gardencore.ShootStructuredAuthorizationKubeconfigSecretName,
+	} {
+		shootList := &gardencorev1beta1.ShootList{}
+		if err := h.Client.List(ctx, shootList, client.InNamespace(namespace), client.MatchingFields{field: secretName}); err != nil {
+			return nil, fmt.Errorf("unable to list shoots in namespace %q: %w", namespace, err)
 		}
-	}
-	return false
-}
-
-func isReferencedInStructuredAuthorization(secretName string, structuredAuthorization *gardencorev1beta1.StructuredA
```

**File**: `pkg/admissioncontroller/webhook/admission/shootkubeconfigsecretref/handler_test.go` (modified, +144/-9)
```diff
@@ -18,6 +18,8 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
 
 	. "github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/shootkubeconfigsecretref"
+	"github.com/gardener/gardener/pkg/api/indexer"
+	gardencore "github.com/gardener/gardener/pkg/apis/core"
 	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
 	"github.com/gardener/gardener/pkg/client/kubernetes"
 )
@@ -33,6 +35,7 @@ var _ = Describe("Handler", func() {
 		handler *Handler
 
 		secret         *corev1.Secret
+		oldSecret      *corev1.Secret
 		shoot          *gardencorev1beta1.Shoot
 		secretName     = "test-kubeconfig"
 		shootName      = "fake-shoot-name"
@@ -41,8 +44,12 @@ var _ = Describe("Handler", func() {
 
 	BeforeEach(func() {
 		log = logr.Discard()
-		ctx = admission.NewContextWithRequest(ctx, admission.Request{AdmissionRequest: admissionv1.AdmissionRequest{Name: secretName}})
-		fakeClient = fakeclient.NewClientBuilder().WithScheme(kubernetes.GardenScheme).Build()
+		ctx = admission.NewContextWithRequest(ctx, admission.Request{AdmissionRequest: admissionv1.AdmissionRequest{Name: secretName, Namespace: shootNamespace}})
+		fakeClient = fakeclient.NewClientBuilder().
+			WithScheme(kubernetes.GardenScheme).
+			WithIndex(&gardencorev1beta1.Shoot{}, gardencore.ShootAdmissionPluginKubeconfigSecretName, indexer.ShootAdmissionPluginKubeconfigSecretNameIndexerFunc).
+			WithIndex(&gardencorev1beta1.Shoot{}, gardencore.ShootStructuredAuthorizationKubeconfigSecretName, indexer.ShootStructuredAuthorizationKubeconfigSecretNameIndexerFunc).
+			Build()
 
 		handler = &Handler{Logger: log, Client: fakeClient}
 
@@ -53,6 +60,8 @@ var _ = Describe("Handler", func() {
 			},
 		}
 
+		oldSecret = secret.DeepCopy()
+
 		shoot = &gardencorev1beta1.Shoot{
 			TypeMeta: metav1.TypeMeta{
 				APIVersion: gardencorev1beta1.SchemeGroupVersion.String(),
@@ -77,7 +86,19 @@ var _ = Describe("Handler", func() {
 	})
 
 	It("should pass because no shoot references secret", func() {
-		warning, err = handler.ValidateUpdate(ctx, nil, secret)
+		warning, err = handler.ValidateUpdate(ctx, oldSecret, secret)
+		Expect(warning).To(BeNil())
+		Expect(err).NotTo(HaveOccurred())
+	})
+
+	It("should pass because the old secret did not contain a kubeconfig either", func() {
+		shoot.Spec.Kubernetes.KubeAPIServer.AdmissionPlugins = []gardencorev1beta1.AdmissionPlugin{{
+			Name:                 "plugin-1",
+			KubeconfigSecretName: new(secret.Name),
+		}}
+		Expect(fakeClient.Create(ctx, shoot)).To(Succeed())
+
+		warning, err = handler.ValidateUpdate(ctx, oldSecret, secret)
 		Expect(warning).To(BeNil())
 		Expect(err).NotTo(HaveOccurred())
 	})
@@ -93,7 +114,8 @@ var _ = Describe("Handler", func() {
 			Expect(fakeClient.Create(ctx, shoot)).To(Succeed())
 			Expect(fakeClient.Create(ctx, shoot1)).To(Succeed())
 
-			warning, err = handler.ValidateUpdate(ctx, nil, secret)
+			oldSecret.Data = map[string][]byte{"kubeconfig": []byte("secret-data")}
+			warning, err = handler.ValidateUpdate(ctx, oldSecret, secret)
 			Expect(warning).To(BeNil())
 			Expect(err).To(MatchError(ContainSubstring("Secret \"test-kubeconfig\" is forbidden: data kubeconfig can't be removed from secret or set to empty because secret is in use by shoots: [fake-shoot-name, test-shoot]")))
 		})
@@ -105,8 +127,9 @@ var _ = Describe("Handler", func() {
 			}}
 			Expect(fakeClient.Create(ctx, shoot)).To(Succeed())
 
+			oldSecret.Data = map[string][]byte{"kubeconfig": []byte("secret-data)")}
 			secret.Data = map[string][]byte{"kubeconfig": {}}
-			warning, err = handler.ValidateUpdate(ctx, nil, secret)
+			warning, err = handler.ValidateUpdate(ctx, oldSecret, secret)
 			Expect(warning).To(BeNil())
 			Expect(err).To(MatchError(ContainSubstring("Secret \"test-kubeconfig\" is forbidden: data kubeconfig can't be removed from secret or set to empty because secret is in use by shoots: [fake-shoot-name]")))
 		})
@@ -119,10 +142,37 @@ var _ = Describe("Handler", func() {
 			Expect(fakeClient.Create(ctx, shoot)).To(Succeed())
 
 			secret.Data = map[string][]byte{"kubeconfig": []byte("secret-data")}
-			warning, err = handler.ValidateUpdate(ctx, nil, secret)
+			warning, err = handler.ValidateUpdate(ctx, oldSecret, secret)
 			Expect(warning).To(BeNil())
 			Expect(err).To(Succeed())
 		})
+
+		It("should fail because a shoot references the secret amongst multiple admission plugin secrets", func() {
+			shoot.Spec.Kubernetes.KubeAPIServer.AdmissionPlugins = []gardencorev1beta1.AdmissionPlugin{
+				{Name: "plugin-1", KubeconfigSecretName: new("other-secret-1")},
+				{Name: "plugin-2", KubeconfigSecretName: new(secret.Name)},
+				{Name: "plugin-3", KubeconfigSecretName: new("other-secret-2")},
+			}
+			Expect(fakeClient.Create(ctx, shoot)).To(Succeed())
+
+			oldSecret.Data = map[string][]byte{"kubeconfig": []byte("secret-data")}
+			warning, err = handler.ValidateUpdate(ctx, oldSecret, secret)
+			Expect(warning).To(BeNil())
+			Expect(err).To(M
```

**File**: `pkg/api/indexer/gardener_core.go` (modified, +86/-0)
```diff
@@ -192,6 +192,58 @@ func AddShootAuthorizationConfigMapName(ctx context.Context, indexer client.Fiel
 	return nil
 }
 
+// ShootAdmissionPluginKubeconfigSecretNameIndexerFunc extracts the kubeconfig Secret names referenced by the
+// admission plugins of a Shoot.
+func ShootAdmissionPluginKubeconfigSecretNameIndexerFunc(obj client.Object) []string {
+	var secretNames []string
+	shoot, ok := obj.(*gardencorev1beta1.Shoot)
+	if !ok || shoot.Spec.Kubernetes.KubeAPIServer == nil {
+		return secretNames
+	}
+
+	for _, plugin := range shoot.Spec.Kubernetes.KubeAPIServer.AdmissionPlugins {
+		if plugin.KubeconfigSecretName != nil && *plugin.KubeconfigSecretName != "" {
+			secretNames = append(secretNames, *plugin.KubeconfigSecretName)
+		}
+	}
+
+	return secretNames
+}
+
+// ShootStructuredAuthorizationKubeconfigSecretNameIndexerFunc extracts the kubeconfig Secret names referenced by
+// the structured authorization configuration of a Shoot.
+func ShootStructuredAuthorizationKubeconfigSecretNameIndexerFunc(obj client.Object) []string {
+	var secretNames []string
+	shoot, ok := obj.(*gardencorev1beta1.Shoot)
+	if !ok || shoot.Spec.Kubernetes.KubeAPIServer == nil || shoot.Spec.Kubernetes.KubeAPIServer.StructuredAuthorization == nil {
+		return secretNames
+	}
+
+	for _, kubeconfig := range shoot.Spec.Kubernetes.KubeAPIServer.StructuredAuthorization.Kubeconfigs {
+		if kubeconfig.SecretName != "" {
+			secretNames = append(secretNames, kubeconfig.SecretName)
+		}
+	}
+
+	return secretNames
+}
+
+// AddShootAdmissionPluginKubeconfigSecretName adds an index for core.ShootAdmissionPluginKubeconfigSecretName to the given indexer.
+func AddShootAdmissionPluginKubeconfigSecretName(ctx context.Context, indexer client.FieldIndexer) error {
+	if err := indexer.IndexField(ctx, &gardencorev1beta1.Shoot{}, core.ShootAdmissionPluginKubeconfigSecretName, ShootAdmissionPluginKubeconfigSecretNameIndexerFunc); err != nil {
+		return fmt.Errorf("failed to add indexer for %s to Shoot Informer: %w", core.ShootAdmissionPluginKubeconfigSecretName, err)
+	}
+	return nil
+}
+
+// AddShootStructuredAuthorizationKubeconfigSecretName adds an index for core.ShootStructuredAuthorizationKubeconfigSecretName to the given indexer.
+func AddShootStructuredAuthorizationKubeconfigSecretName(ctx context.Context, indexer client.FieldIndexer) error {
+	if err := indexer.IndexField(ctx, &gardencorev1beta1.Shoot{}, core.ShootStructuredAuthorizationKubeconfigSecretName, ShootStructuredAuthorizationKubeconfigSecretNameIndexerFunc); err != nil {
+		return fmt.Errorf("failed to add indexer for %s to Shoot Informer: %w", core.ShootStructuredAuthorizationKubeconfigSecretName, err)
+	}
+	return nil
+}
+
 // AddShootSeedName adds an index for core.ShootSeedName to the given indexer.
 func AddShootSeedName(ctx context.Context, indexer client.FieldIndexer) error {
 	if err := indexer.IndexField(ctx, &gardencorev1beta1.Shoot{}, core.ShootSeedName, func(obj client.Object) []string {
@@ -329,3 +381,37 @@ func AddNamespacedCloudProfileParentRefName(ctx context.Context, indexer client.
 	}
 	return nil
 }
+
+// SecretBindingSecretRefNameIndexerFunc extracts the .spec.secretRef.name field of a SecretBinding.
+func SecretBindingSecretRefNameIndexerFunc(obj client.Object) []string {
+	secretBinding, ok := obj.(*gardencorev1beta1.SecretBinding)
+	if !ok {
+		return []string{""}
+	}
+	return []string{secretBinding.SecretRef.Name}
+}
+
+// SecretBindingSecretRefNamespaceIndexerFunc extracts the .spec.secretRef.namespace field of a SecretBinding.
+func SecretBindingSecretRefNamespaceIndexerFunc(obj client.Object) []string {
+	secretBinding, ok := obj.(*gardencorev1beta1.SecretBinding)
+	if !ok {
+		return []string{""}
+	}
+	return []string{secretBinding.SecretRef.Namespace}
+}
+
+// AddSecretBindingSecretRefName adds an index for core.SecretBindingSecretRefName to the given indexer.
+func AddSecretBindingSecretRefName(ctx context.Context, indexer client.FieldIndexer) error {
+	if err := indexer.IndexField(ctx, &gardencorev1beta1.SecretBinding{}, core.SecretBindingSecretRefName, SecretBindingSecretRefNameIndexerFunc); err != nil {
+		return fmt.Errorf("failed to add indexer for %s to SecretBinding Informer: %w", core.SecretBindingSecretRefName, err)
+	}
+	return nil
+}
+
+// AddSecretBindingSecretRefNamespace adds an index for core.SecretBindingSecretRefNamespace to the given indexer.
+func AddSecretBindingSecretRefNamespace(ctx context.Context, indexer client.FieldIndexer) error {
+	if err := indexer.IndexField(ctx, &gardencorev1beta1.SecretBinding{}, core.SecretBindingSecretRefNamespace, SecretBindingSecretRefNamespaceIndexerFunc); err != nil {
+		return fmt.Errorf("failed to add indexer for %s to SecretBinding Informer: %w", core.SecretBindingSecretRefNamespace, err)
+	}
+	return nil
+}
```

**File**: `pkg/api/indexer/gardener_core_test.go` (modified, +85/-0)
```diff
@@ -311,4 +311,89 @@ var _ = Describe("Core", func() {
 		Entry("no NamespacedCloudProfile", &corev1.Secret{}, ConsistOf("")),
 		Entry("NamespacedCloudProfile w/ parent", &gardencorev1beta1.NamespacedCloudProfile{Spec: gardencorev1beta1.NamespacedCloudProfileSpec{Parent: gardencorev1beta1.CloudProfileReference{Name: "parent-profile"}}}, ConsistOf("parent-profile")),
 	)
+
+	DescribeTable("#AddSecretBindingSecretRefName",
+		func(obj client.Object, matcher gomegatypes.GomegaMatcher) {
+			Expect(AddSecretBindingSecretRefName(context.TODO(), indexer)).To(Succeed())
+
+			Expect(indexer.obj).To(Equal(&gardencorev1beta1.SecretBinding{}))
+			Expect(indexer.field).To(Equal("spec.secretRef.name"))
+			Expect(indexer.extractValue).NotTo(BeNil())
+			Expect(indexer.extractValue(obj)).To(matcher)
+		},
+
+		Entry("no SecretBinding", &corev1.Secret{}, ConsistOf("")),
+		Entry("SecretBinding w/ secretRef", &gardencorev1beta1.SecretBinding{SecretRef: corev1.SecretReference{Name: "secret", Namespace: "ns"}}, ConsistOf("secret")),
+	)
+
+	DescribeTable("#AddSecretBindingSecretRefNamespace",
+		func(obj client.Object, matcher gomegatypes.GomegaMatcher) {
+			Expect(AddSecretBindingSecretRefNamespace(context.TODO(), indexer)).To(Succeed())
+
+			Expect(indexer.obj).To(Equal(&gardencorev1beta1.SecretBinding{}))
+			Expect(indexer.field).To(Equal("spec.secretRef.namespace"))
+			Expect(indexer.extractValue).NotTo(BeNil())
+			Expect(indexer.extractValue(obj)).To(matcher)
+		},
+
+		Entry("no SecretBinding", &corev1.Secret{}, ConsistOf("")),
+		Entry("SecretBinding w/ secretRef", &gardencorev1beta1.SecretBinding{SecretRef: corev1.SecretReference{Name: "secret", Namespace: "ns"}}, ConsistOf("ns")),
+	)
+
+	DescribeTable("#AddShootAdmissionPluginKubeconfigSecretName",
+		func(obj client.Object, matcher gomegatypes.GomegaMatcher) {
+			Expect(AddShootAdmissionPluginKubeconfigSecretName(context.Background(), indexer)).To(Succeed())
+
+			Expect(indexer.obj).To(Equal(&gardencorev1beta1.Shoot{}))
+			Expect(indexer.field).To(Equal("spec.kubernetes.kubeAPIServer.admissionPlugins.kubeconfigSecretName"))
+			Expect(indexer.extractValue).NotTo(BeNil())
+			Expect(indexer.extractValue(obj)).To(matcher)
+		},
+
+		Entry("no Shoot", &corev1.Secret{}, BeEmpty()),
+		Entry("Shoot w/o kubeAPIServer", &gardencorev1beta1.Shoot{}, BeEmpty()),
+		Entry("Shoot w/o admission plugin kubeconfig references",
+			&gardencorev1beta1.Shoot{Spec: gardencorev1beta1.ShootSpec{Kubernetes: gardencorev1beta1.Kubernetes{KubeAPIServer: &gardencorev1beta1.KubeAPIServerConfig{
+				AdmissionPlugins: []gardencorev1beta1.AdmissionPlugin{{Name: "PodNodeSelector"}},
+			}}}},
+			BeEmpty(),
+		),
+		Entry("Shoot w/ admission plugin kubeconfig references",
+			&gardencorev1beta1.Shoot{Spec: gardencorev1beta1.ShootSpec{Kubernetes: gardencorev1beta1.Kubernetes{KubeAPIServer: &gardencorev1beta1.KubeAPIServerConfig{
+				AdmissionPlugins: []gardencorev1beta1.AdmissionPlugin{
+					{Name: "plugin-1", KubeconfigSecretName: new("secret-1")},
+					{Name: "plugin-2"},
+					{Name: "plugin-3", KubeconfigSecretName: new("secret-2")},
+				},
+			}}}},
+			ConsistOf("secret-1", "secret-2"),
+		),
+	)
+
+	DescribeTable("#AddShootStructuredAuthorizationKubeconfigSecretName",
+		func(obj client.Object, matcher gomegatypes.GomegaMatcher) {
+			Expect(AddShootStructuredAuthorizationKubeconfigSecretName(context.Background(), indexer)).To(Succeed())
+
+			Expect(indexer.obj).To(Equal(&gardencorev1beta1.Shoot{}))
+			Expect(indexer.field).To(Equal("spec.kubernetes.kubeAPIServer.structuredAuthorization.kubeconfigs.secretName"))
+			Expect(indexer.extractValue).NotTo(BeNil())
+			Expect(indexer.extractValue(obj)).To(matcher)
+		},
+
+		Entry("no Shoot", &corev1.Secret{}, BeEmpty()),
+		Entry("Shoot w/o kubeAPIServer", &gardencorev1beta1.Shoot{}, BeEmpty()),
+		Entry("Shoot w/o structured authorization",
+			&gardencorev1beta1.Shoot{Spec: gardencorev1beta1.ShootSpec{Kubernetes: gardencorev1beta1.Kubernetes{KubeAPIServer: &gardencorev1beta1.KubeAPIServerConfig{}}}},
+			BeEmpty(),
+		),
+		Entry("Shoot w/ structured authorization kubeconfig references",
+			&gardencorev1beta1.Shoot{Spec: gardencorev1beta1.ShootSpec{Kubernetes: gardencorev1beta1.Kubernetes{KubeAPIServer: &gardencorev1beta1.KubeAPIServerConfig{
+				StructuredAuthorization: &gardencorev1beta1.StructuredAuthorization{Kubeconfigs: []gardencorev1beta1.AuthorizerKubeconfigReference{
+					{AuthorizerName: "webhook-1", SecretName: "secret-1"},
+					{AuthorizerName: "webhook-2", SecretName: "secret-2"},
+				}},
+			}}}},
+			ConsistOf("secret-1", "secret-2"),
+		),
+	)
 })
```

---

### Incident Patch 3: `e53f100a` (2026-10-04)
**Commit Message**: Fixes for changed kube-apiserver health dashboard (#15828)

* feat(dashboard): expand all sections and enable shared crosshair

Signed-off-by: Marco Voelz <[REDACTED_EMAIL]>

* feat(dashboard): resize panels to half-width and arrange two per row

All graph panels resized from w=8 or w=24 to w=12, arranged as pairs
side by side. Panels within each section are paired by their original
(y, x) order, keeping semantically related panels together (e.g. read
vs write latency, APF seat utilization vs rejections, cache increases
vs decreases). Y coordinates recalculated to compact the layout.

Signed-off-by: Marco Voelz <[REDACTED_EMAIL]>

* fix(dashboard): fix APF Seat Utilization PromQL error and shorten 429 legend label

Signed-off-by: Marco Voelz <[REDACTED_EMAIL]>

* fix(dashboard): show restart and OOM kill counts for the selected time range

The stat panels previously showed the raw counter value of the currently
running pod, which read 0 after a pod replacement even if a restart had
occurred within the visible time window.

Switch to increase(...[$__range]) so the counters reflect the total number
of events visible in the graph for the selected time range. ceil() is applied
to avoid



---

### Incident Patch 4: `af7edf21` (2026-10-02)
**Commit Message**: Fix inverted condition in shoot e2e tests (#15864)

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

**File**: `test/e2e/gardener/shoot/shoot.go` (modified, +5/-1)
```diff
@@ -357,8 +357,12 @@ func ItShouldWaitForPodsInShootToBeReady(s *ShootContext, namespace string, podL
 				return err
 			}
 
+			if len(podList.Items) == 0 {
+				return fmt.Errorf("no pods found in %s with labels %s", namespace, podLabels)
+			}
+
 			for _, pod := range podList.Items {
-				if health.IsPodReady(&pod) {
+				if !health.IsPodReady(&pod) {
 					return fmt.Errorf("pod %s/%s is not running", pod.Namespace, pod.Name)
 				}
 			}
```

---

### Incident Patch 5: `591f71f3` (2026-09-30)
**Commit Message**: Fix node-agent getting stuck in lease renewal (#15716)

* Fix node-agent lease renewal stuck on stale cache.
The node-agent lease used CreateOrUpdate with a cached client and then
issues a patch with optimistic locking. If the clients cache freezes
(we observed the watch stream being left half-open), this patch always
fails, because the cached client keeps returning old leases and never
gets corrected.

This commit replaces the cached get with a direct get and the patch with
optimistic locking with a direct patch (because the node-agent is the
only writer).

Signed-off-by: Jan Meis <[REDACTED_EMAIL]>

* Fix a similar error in lease for OperatingSystemConfig.
The lease renewal here also has a get through a cached client.
Full disclosure: I found this by asking claude to find similar errors.

Signed-off-by: Jan Meis <[REDACTED_EMAIL]>

* Replace patch with update.
Patch is blocked by the node-agent authorizer webhook. Update does
optimistic locking, while patch doesn't. However, we are the only
writer, and we do a direct get right before, so we should never
conflict. In case of conflict, we should recover during the lease
duration in a retry anyways.

Signed-off-by: Jan Meis <[REDACT

**File**: `pkg/nodeagent/controller/lease/add.go` (modified, +3/-0)
```diff
@@ -9,11 +9,13 @@ import (
 
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/util/workqueue"
 	"k8s.io/utils/clock"
 	"sigs.k8s.io/controller-runtime/pkg/builder"
 	"sigs.k8s.io/controller-runtime/pkg/controller"
 	"sigs.k8s.io/controller-runtime/pkg/manager"
 	"sigs.k8s.io/controller-runtime/pkg/predicate"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
 	predicateutils "github.com/gardener/gardener/pkg/controllerutils/predicate"
 )
@@ -42,6 +44,7 @@ func (r *Reconciler) AddToManager(mgr manager.Manager, nodePredicate predicate.P
 		For(&corev1.Node{}, builder.WithPredicates(nodePredicate, predicateutils.ForEventTypes(predicateutils.Create))).
 		WithOptions(controller.Options{
 			MaxConcurrentReconciles: 1,
+			RateLimiter:             workqueue.NewTypedItemExponentialFailureRateLimiter[reconcile.Request](time.Millisecond, 2*time.Minute),
 			ReconciliationTimeout:   time.Duration(r.LeaseDurationSeconds) * time.Second,
 		}).
 		Complete(r)
```

**File**: `pkg/nodeagent/controller/lease/reconciler.go` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@ import (
 	logf "sigs.k8s.io/controller-runtime/pkg/log"
 	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
+	"github.com/gardener/gardener/pkg/controllerutils"
 	gardenerutils "github.com/gardener/gardener/pkg/utils/gardener"
 )
 
@@ -44,7 +45,7 @@ func (r *Reconciler) Reconcile(ctx context.Context, request reconcile.Request) (
 		},
 	}
 
-	op, err := controllerutil.CreateOrUpdate(ctx, r.Client, lease, func() error {
+	op, err := controllerutils.CreateOrGetAndMergePatch(ctx, r.Client, lease, func() error {
 		if err := controllerutil.SetControllerReference(node, lease, r.Client.Scheme()); err != nil {
 			log.Error(err, "Unable to set controller reference for Lease", "lease", client.ObjectKeyFromObject(lease))
 		}
```

**File**: `pkg/nodeagent/controller/lease/reconciler_test.go` (modified, +84/-0)
```diff
@@ -5,9 +5,23 @@
 package lease_test
 
 import (
+	"context"
+	"time"
+
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	. "github.com/onsi/gomega/gstruct"
+	coordinationv1 "k8s.io/api/coordination/v1"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	testclock "k8s.io/utils/clock/testing"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	fakeclient "sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
+	"github.com/gardener/gardener/pkg/client/kubernetes"
+	"github.com/gardener/gardener/pkg/nodeagent/controller/lease"
 	gardenerutils "github.com/gardener/gardener/pkg/utils/gardener"
 )
 
@@ -17,4 +31,74 @@ var _ = Describe("Reconciler", func() {
 			Expect(gardenerutils.NodeAgentLeaseName("foo")).To(Equal("gardener-node-agent-foo"))
 		})
 	})
+
+	Describe("#Reconcile", func() {
+		const nodeName = "foo"
+
+		var (
+			ctx        = context.Background()
+			c          client.Client
+			node       *corev1.Node
+			fakeClock  *testclock.FakeClock
+			reconciler *lease.Reconciler
+			request    reconcile.Request
+			leaseKey   client.ObjectKey
+		)
+
+		BeforeEach(func() {
+			node = &corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: nodeName, UID: types.UID("node-uid")}}
+			c = fakeclient.NewClientBuilder().
+				WithScheme(kubernetes.SeedScheme).
+				WithObjects(node).
+				Build()
+			fakeClock = testclock.NewFakeClock(metav1.Now().Time)
+
+			reconciler = &lease.Reconciler{
+				Client:               c,
+				LeaseDurationSeconds: 40,
+				Namespace:            metav1.NamespaceSystem,
+				Clock:                fakeClock,
+			}
+
+			request = reconcile.Request{NamespacedName: client.ObjectKey{Name: nodeName}}
+			leaseKey = client.ObjectKey{Namespace: metav1.NamespaceSystem, Name: gardenerutils.NodeAgentLeaseName(nodeName)}
+		})
+
+		It("should create the heartbeat lease with the expected fields and owner reference", func() {
+			result, err := reconciler.Reconcile(ctx, request)
+			Expect(err).NotTo(HaveOccurred())
+			Expect(result.RequeueAfter).To(Equal(10 * time.Second)) // 40s / 4 = 10s
+
+			l := &coordinationv1.Lease{}
+			Expect(c.Get(ctx, leaseKey, l)).To(Succeed())
+			Expect(l.Spec.HolderIdentity).To(PointTo(Equal(l.Name)))
+			Expect(l.Spec.LeaseDurationSeconds).To(PointTo(Equal(int32(40))))
+			Expect(l.Spec.RenewTime).NotTo(BeNil())
+			Expect(l.OwnerReferences).To(ConsistOf(metav1.OwnerReference{
+				APIVersion:         "v1",
+				Kind:               "Node",
+				Name:               nodeName,
+				UID:                types.UID("node-uid"),
+				Controller:         new(true),
+				BlockOwnerDeletion: new(true),
+			}))
+		})
+
+		It("should renew the lease on a subsequent reconcile", func() {
+			_, err := reconciler.Reconcile(ctx, request)
+			Expect(err).NotTo(HaveOccurred())
+
+			before := &coordinationv1.Lease{}
+			Expect(c.Get(ctx, leaseKey, before)).To(Succeed())
+
+			fakeClock.Step(10 * time.Second)
+
+			_, err = reconciler.Reconcile(ctx, request)
+			Expect(err).NotTo(HaveOccurred())
+
+			after := &coordinationv1.Lease{}
+			Expect(c.Get(ctx, leaseKey, after)).To(Succeed())
+			Expect(after.Spec.RenewTime.Time).To(BeTemporally(">", before.Spec.RenewTime.Time))
+		})
+	})
 })
```

**File**: `pkg/resourcemanager/webhook/nodeagentauthorizer/authorizer.go` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ func (a *authorizer) authorizeLease(ctx context.Context, log logr.Logger, machin
 		return auth.DecisionDeny, reason, nil
 	}
 
-	allowedVerbs := []string{"get", "list", "watch", "create", "update"}
+	allowedVerbs := []string{"get", "list", "watch", "create", "update", "patch"}
 	if allowed, reason := a.checkVerb(log, attrs, allowedVerbs...); !allowed {
 		return auth.DecisionDeny, reason, nil
 	}
```

**File**: `pkg/resourcemanager/webhook/nodeagentauthorizer/authorizer_test.go` (modified, +3/-2)
```diff
@@ -386,6 +386,7 @@ var _ = Describe("Authorizer", func() {
 			},
 				Entry("get", "get"),
 				Entry("update", "update"),
+				Entry("patch", "patch"),
 				Entry("list", "list"),
 				Entry("watch", "watch"),
 			)
@@ -436,6 +437,7 @@ var _ = Describe("Authorizer", func() {
 				},
 					Entry("get", "get"),
 					Entry("update", "update"),
+					Entry("patch", "patch"),
 					Entry("list", "list"),
 					Entry("watch", "watch"),
 				)
@@ -499,9 +501,8 @@ var _ = Describe("Authorizer", func() {
 
 				Expect(err).NotTo(HaveOccurred())
 				Expect(decision).To(Equal(auth.DecisionDeny))
-				Expect(reason).To(ContainSubstring("only the following verbs are allowed for this resource type: [get list watch create update]"))
+				Expect(reason).To(ContainSubstring("only the following verbs are allowed for this resource type: [get list watch create update patch]"))
 			},
-				Entry("patch", "patch"),
 				Entry("delete", "delete"),
 				Entry("deletecollection", "deletecollection"),
 			)
```

**File**: `test/integration/resourcemanager/nodeagentauthorizer/nodeagentauthorizer_test.go` (modified, +17/-1)
```diff
@@ -292,14 +292,30 @@ var _ = Describe("NodeAgentAuthorizer tests", func() {
 					lease.SetLabels(map[string]string{"foo": "bar"})
 					ExpectWithOffset(1, testClientNodeAgent.Patch(ctx, lease.DeepCopy(), patch)).To(BeForbiddenError())
 				},
-				Entry("forbid own gardener-node-agent", nodeAgentLeaseName, "kube-system", true),
 				Entry("forbid if no own node", nodeAgentLeaseName, "kube-system", false),
 				Entry("forbid other gardener-node-agent", otherNodeAgentLeaseName, "kube-system", true),
 				Entry("forbid other gardener-node-agent if no own node", otherNodeAgentLeaseName, "kube-system", false),
 				Entry("forbid in default namespace", "foo-bar", "default", true),
 				Entry("forbid in default namespace without node", "foo-bar", "default", false),
 			)
 
+			It("should allow patching own gardener-node-agent lease", func() {
+				createNode(node, machine)
+				lease := &coordinationv1.Lease{
+					ObjectMeta: metav1.ObjectMeta{
+						Name:      nodeAgentLeaseName,
+						Namespace: "kube-system",
+					},
+				}
+				Expect(testClient.Create(ctx, lease)).To(Succeed())
+				DeferCleanup(func() {
+					Expect(testClient.Delete(ctx, lease)).To(Or(Succeed(), BeNotFoundError()))
+				})
+				patch := client.MergeFrom(lease)
+				lease.SetLabels(map[string]string{"foo": "bar"})
+				Expect(testClientNodeAgent.Patch(ctx, lease.DeepCopy(), patch)).To(Succeed())
+			})
+
 			DescribeTable("#delete",
 				func(name, namespace string, withNode bool) {
 					if withNode {
```

---

### Incident Patch 6: `f8d853f1` (2026-09-29)
**Commit Message**: chore: clean up equinix metal references (#15799)

Signed-off-by: Rick Rackow <[REDACTED_EMAIL]>

**File**: `docs/development/new-cloud-provider.md` (modified, +2/-2)
```diff
@@ -9,9 +9,9 @@ Gardener is composed of 2 or more Kubernetes clusters:
 * Shoot: These are the end-user clusters, the regular Kubernetes clusters you have seen. They provide places for your workloads to run.
 * Seed: This is the "management" cluster. It manages the control planes of shoots by running them as native Kubernetes workloads.
 
-These two clusters can run in the same cloud provider, but they do not need to. For example, you could run your Seed in AWS, while having one shoot in Azure, two in Google, two in Alicloud, and three in Equinix Metal.
+These two clusters can run in the same cloud provider, but they do not need to. For example, you could run your Seed in AWS, while having one shoot in Azure, two in Google and two in Alicloud.
 
-The Seed cluster deploys and manages the Shoot clusters. Importantly, for this discussion, the `etcd` data store backing each Shoot runs as workloads inside the Seed. Thus, to use the above example, the clusters in Azure, Google, Alicloud and Equinix Metal will have their worker nodes and master nodes running in those clouds, but the `etcd` clusters backing them will run as separate [deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) in the Seed Kubernetes cluster on AWS.
+The Seed cluster deploys and manages the Shoot clusters. Importantly, for this discussion, the `etcd` data store backing each Shoot runs as workloads inside the Seed. Thus, to use the above example, the clusters in Azure, Google and Alicloud will have their worker nodes and master nodes running in those clouds, but the `etcd` clusters backing them will run as separate [deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) in the Seed Kubernetes cluster on AWS.
 
 This distinction becomes important when preparing the integration to a new cloud provider.
 
```

**File**: `docs/extensions/resources/dnsrecord.md` (modified, +0/-2)
```diff
@@ -146,7 +146,6 @@ The following table contains information about the provider extension version th
 | provider-gcp                                 | `v1.18.0`|
 | provider-openstack                           | `v1.21.0`|
 | provider-vsphere                             |    N/A   |
-| provider-equinix-metal                       |    N/A   |
 | provider-kubevirt                            |    N/A   |
 | provider-openshift                           |    N/A   |
 
@@ -162,7 +161,6 @@ The following table contains information about the provider extension version th
 | provider-gcp           | N/A       |
 | provider-openstack     | N/A       |
 | provider-vsphere       | N/A       |
-| provider-equinix-metal | N/A       |
 | provider-kubevirt      | N/A       |
 | provider-openshift     | N/A       |
 | provider-local         | `v1.63.0` |
```

**File**: `example/90-shoot.yaml` (modified, +0/-2)
```diff
@@ -19,15 +19,13 @@ spec:
       # https://github.com/gardener/gardener-extension-provider-azure/blob/master/example/30-infrastructure.yaml#L63-L75
       # https://github.com/gardener/gardener-extension-provider-gcp/blob/master/example/30-infrastructure.yaml#L51-L65
       # https://github.com/gardener/gardener-extension-provider-openstack/blob/master/example/30-infrastructure.yaml#L59-L65
-      # https://github.com/gardener/gardener-extension-provider-equinix-metal/blob/master/example/30-infrastructure.yaml#L48-L49
     controlPlaneConfig:
       <some-provider-specific-controlplane-config>
       # https://github.com/gardener/gardener-extension-provider-alicloud/blob/master/example/30-controlplane.yaml#L58-L63
       # https://github.com/gardener/gardener-extension-provider-aws/blob/master/example/30-controlplane.yaml#L58-L62
       # https://github.com/gardener/gardener-extension-provider-azure/blob/master/example/30-controlplane.yaml#L60-L64
       # https://github.com/gardener/gardener-extension-provider-gcp/blob/master/example/30-controlplane.yaml#L57-L62
       # https://github.com/gardener/gardener-extension-provider-openstack/blob/master/example/30-controlplane.yaml#L66-L72
-      # https://github.com/gardener/gardener-extension-provider-equinix-metal/blob/master/example/30-controlplane.yaml#L57-L58
     workers:
     - name: cpu-worker
     # cri:
```

**File**: `extensions/README.md` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ Check out these repositories for implementations of the Gardener Extension contr
 - [Alibaba Cloud](https://github.com/gardener/gardener-extension-provider-alicloud)
 - [AWS](https://github.com/gardener/gardener-extension-provider-aws)
 - [Azure](https://github.com/gardener/gardener-extension-provider-azure)
-- [Equinix Metal](https://github.com/gardener/gardener-extension-provider-equinix-metal)
 - [GCP](https://github.com/gardener/gardener-extension-provider-gcp)
 - [Hetzner Cloud](https://github.com/23technologies/gardener-extension-provider-hcloud)
 - [IronCore](https://github.com/ironcore-dev/gardener-extension-provider-ironcore)
```

---

### Incident Patch 7: `f64fc749` (2026-09-29)
**Commit Message**: Fix `gardener-apiserver` ETCD encryption key rotation due to stale cache (#15809)

* Use `APIReader` in `gardenerAPIServer.Wait` to avoid stale cache

During credentials rotation, the `OLD-NEW` → `NEW-OLD` rollout of
`gardener-apiserver` completes from the operator's perspective via a
cached `ManagedResource` status read. The cache can return a healthy
status before all `OLD-NEW` pods have terminated, causing
`rewriteResourcesAddLabel` to start while those pods are still serving
requests — re-encrypting resources with the old key as primary.

Using `APIReader` for both `WaitUntilHealthyAndNotProgressing` and
`WaitUntilHealthy` in `Wait` forces a live API server read, matching
the existing pattern in `kubeAPIServer.Wait`.

Assisted-by: Claude <[REDACTED_EMAIL]>

Signed-off-by: rfranzke <[REDACTED_EMAIL]>

* Keep old ETCD encryption key after `RotationCompleting` for DR

After `RotationCompleting`, the old key is inert for encryption — all
objects have been re-encrypted with the new key. Dropping it immediately
means a cluster that was never snapshotted during the rotation window
cannot recover objects that were somehow missed. Keeping it as the
second (decryption-only) provider cost

**File**: `pkg/component/apiserver/encryptionconfiguration.go` (modified, +0/-4)
```diff
@@ -153,10 +153,6 @@ func ReconcileSecretETCDEncryptionConfiguration(
 		secretsmanager.Rotate(secretsmanager.KeepOld),
 	}
 
-	if config.RotationPhase == gardencorev1beta1.RotationCompleting {
-		options = append(options, secretsmanager.IgnoreOldSecrets())
-	}
-
 	currentEncryptionProvider := config.EncryptionProvider
 	// The "aescbc" provider type has been the only available provider type.
 	// Since [secretsutils.ETCDEncryptionKeySecretConfig] had no provider field before (implicitly "aescbc"),
```

**File**: `pkg/component/apiserver/types.go` (modified, +0/-2)
```diff
@@ -79,8 +79,6 @@ type AuditWebhook struct {
 
 // ETCDEncryptionConfig contains configuration for the encryption of resources in etcd.
 type ETCDEncryptionConfig struct {
-	// RotationPhase specifies the credentials rotation phase of the encryption key.
-	RotationPhase gardencorev1beta1.CredentialsRotationPhase
 	// EncryptWithCurrentKey specifies whether the current encryption key should be used for encryption. If this is
 	// false and if there are two keys then the old key will be used for encryption while the current/new key will only
 	// be used for decryption.
```

**File**: `pkg/component/gardener/apiserver/apiserver.go` (modified, +5/-3)
```diff
@@ -102,9 +102,10 @@ type AutoscalingConfig struct {
 }
 
 // New creates a new instance of DeployWaiter for the gardener-apiserver.
-func New(client client.Client, namespace string, secretsManager secretsmanager.Interface, values Values) Interface {
+func New(client client.Client, apiReader client.Reader, namespace string, secretsManager secretsmanager.Interface, values Values) Interface {
 	return &gardenerAPIServer{
 		client:         client,
+		apiReader:      apiReader,
 		namespace:      namespace,
 		secretsManager: secretsManager,
 		values:         values,
@@ -113,6 +114,7 @@ func New(client client.Client, namespace string, secretsManager secretsmanager.I
 
 type gardenerAPIServer struct {
 	client         client.Client
+	apiReader      client.Reader
 	namespace      string
 	secretsManager secretsmanager.Interface
 	values         Values
@@ -267,14 +269,14 @@ func (g *gardenerAPIServer) Wait(ctx context.Context) error {
 	// virtual resources. This is important for credentials rotation since we want all GAPI pods to run with the new
 	// server certificate before we drop the old CA from the bundle in the APIServices (which get deployed via the
 	// virtual resources).
-	if err := managedresources.WaitUntilHealthyAndNotProgressing(timeoutCtx, g.client, g.namespace, ManagedResourceNameRuntime); err != nil {
+	if err := managedresources.WaitUntilHealthyAndNotProgressing(timeoutCtx, g.apiReader, g.namespace, ManagedResourceNameRuntime); err != nil {
 		return err
 	}
 
 	timeoutCtx, cancel = context.WithTimeout(ctx, TimeoutWaitForManagedResource)
 	defer cancel()
 
-	return managedresources.WaitUntilHealthy(timeoutCtx, g.client, g.namespace, ManagedResourceNameVirtual)
+	return managedresources.WaitUntilHealthy(timeoutCtx, g.apiReader, g.namespace, ManagedResourceNameVirtual)
 }
 
 func (g *gardenerAPIServer) WaitCleanup(ctx context.Context) error {
```

**File**: `pkg/component/gardener/apiserver/apiserver_test.go` (modified, +17/-15)
```diff
@@ -66,6 +66,7 @@ var _ = Describe("GardenerAPIServer", func() {
 		clusterIP = "1.2.3.4"
 
 		fakeClient        client.Client
+		fakeAPIReader     client.Client
 		fakeSecretManager secretsmanager.Interface
 		values            Values
 		deployer          Interface
@@ -123,6 +124,7 @@ var _ = Describe("GardenerAPIServer", func() {
 		Expect(testSchemeBuilder.AddToScheme(testScheme)).To(Succeed())
 
 		fakeClient = fakeclient.NewClientBuilder().WithScheme(testScheme).Build()
+		fakeAPIReader = fakeclient.NewClientBuilder().WithScheme(testScheme).Build()
 		fakeSecretManager = fakesecretsmanager.New(fakeClient, namespace)
 		values = Values{
 			Values: apiserver.Values{
@@ -145,7 +147,7 @@ var _ = Describe("GardenerAPIServer", func() {
 			WorkloadIdentityTokenIssuer:       workloadIdentityIssuer,
 			TargetVersion:                     semver.MustParse("1.33.1"),
 		}
-		deployer = New(fakeClient, namespace, fakeSecretManager, values)
+		deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, values)
 		consistOf = NewManagedResourceConsistOfObjectsMatcher(fakeClient)
 
 		fakeOps = &retryfake.Ops{MaxAttempts: 2}
@@ -804,7 +806,7 @@ resources:
 
 					DescribeTable("successfully deploy the ETCD encryption configuration secret resource w/ old key",
 						func(encryptWithCurrentKey bool) {
-							deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+							deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 								Values: apiserver.Values{
 									ETCDEncryption: apiserver.ETCDEncryptionConfig{EncryptWithCurrentKey: encryptWithCurrentKey, ResourcesToEncrypt: []string{"shootstates.core.gardener.cloud"}},
 									RuntimeVersion: semver.MustParse("1.33.1"),
@@ -922,7 +924,7 @@ resources:
 						auditConfig = &apiserver.AuditConfig{Webhook: &apiserver.AuditWebhook{Kubeconfig: kubeconfig}}
 					)
 
-					deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+					deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 						Values: apiserver.Values{
 							Audit:          auditConfig,
 							RuntimeVersion: semver.MustParse("1.33.1"),
@@ -983,7 +985,7 @@ resources:
 							{AdmissionPlugin: gardencorev1beta1.AdmissionPlugin{Name: "Baz"}, Kubeconfig: []byte("foo")},
 						}
 
-						deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+						deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 							Values: apiserver.Values{
 								EnabledAdmissionPlugins: admissionPlugins,
 								RuntimeVersion:          semver.MustParse("1.33.1"),
@@ -1051,7 +1053,7 @@ rules:
 							auditConfig = &apiserver.AuditConfig{Policy: &policy}
 						)
 
-						deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+						deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 							Values: apiserver.Values{
 								Audit:          auditConfig,
 								RuntimeVersion: semver.MustParse("1.33.1"),
@@ -1133,7 +1135,7 @@ kubeConfigFile: /etc/kubernetes/foobar.yaml
 							},
 						}
 
-						deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+						deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 							Values: apiserver.Values{
 								EnabledAdmissionPlugins: admissionPlugins,
 								RuntimeVersion:          semver.MustParse("1.33.1"),
@@ -1207,7 +1209,7 @@ kubeConfigFile: /etc/kubernetes/foobar.yaml
 							},
 						}
 
-						deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+						deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 							Values: apiserver.Values{
 								EnabledAdmissionPlugins: admissionPlugins,
 								RuntimeVersion:          semver.MustParse("1.33.1"),
@@ -1271,7 +1273,7 @@ kubeConfigFile: ""
 							},
 						}
 
-						deployer = New(fakeClient, namespace, fakeSecretManager, Values{
+						deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, Values{
 							Values: apiserver.Values{
 								EnabledAdmissionPlugins: admissionPlugins,
 								RuntimeVersion:          semver.MustParse("1.33.1"),
@@ -1413,7 +1415,7 @@ kubeConfigFile: /etc/kubernetes/admission-kubeconfigs/validatingadmissionwebhook
 				Context("Kubernetes version >= 1.34", func() {
 					BeforeEach(func() {
 						values.RuntimeVersion = semver.MustParse("1.34.0")
-						deployer = New(fakeClient, namespace, fakeSecretManager, values)
+						deployer = New(fakeClient, fakeAPIReader, namespace, fakeSecretManager, values)
 					})
 
 					It("should successfully deploy all resources", func() {
@@ -1458,7 +1460,7 @@ kubeConfigFile: /etc/kubernetes/admission-kubeconfigs/validatingadmissionwebhook
 			})
 
 			It("should fail because the runtime ManagedResource is unhealthy", func() {
-				Expect(fakeClient.Create(ctx, &resourcesv1alpha1.ManagedResource{
+				Expect(fakeAPIReader.Create(ctx, &resourcesv1alpha1.ManagedResource{
 					ObjectMeta: metav1.Obj
```

**File**: `pkg/component/shared/apiserver.go` (modified, +0/-1)
```diff
@@ -254,7 +254,6 @@ func computeAPIServerETCDEncryptionConfig(
 	error,
 ) {
 	config := apiserver.ETCDEncryptionConfig{
-		RotationPhase:         etcdEncryptionKeyRotationPhase,
 		EncryptWithCurrentKey: true,
 		ResourcesToEncrypt:    resourcesToEncrypt,
 		EncryptedResources:    encryptedResources,
```

**File**: `pkg/component/shared/gardenerapiserver.go` (modified, +2/-0)
```diff
@@ -28,6 +28,7 @@ import (
 func NewGardenerAPIServer(
 	ctx context.Context,
 	runtimeClient client.Client,
+	runtimeAPIReader client.Reader,
 	runtimeNamespace string,
 	objectMeta metav1.ObjectMeta,
 	runtimeVersion *semver.Version,
@@ -88,6 +89,7 @@ func NewGardenerAPIServer(
 
 	return gardenerapiserver.New(
 		runtimeClient,
+		runtimeAPIReader,
 		runtimeNamespace,
 		secretsManager,
 		gardenerapiserver.Values{
```

**File**: `pkg/component/shared/gardenerapiserver_test.go` (modified, +14/-19)
```diff
@@ -38,6 +38,7 @@ var _ = Describe("GardenerAPIServer", func() {
 		ctx = context.TODO()
 
 		runtimeClient               client.Client
+		runtimeAPIReader            client.Reader
 		namespace                   = "foo"
 		clusterIdentity             = "cluster-id"
 		encryptionProviderType      = gardencorev1beta1.EncryptionProviderTypeAESCBC
@@ -49,6 +50,7 @@ var _ = Describe("GardenerAPIServer", func() {
 
 	BeforeEach(func() {
 		runtimeClient = fakeclient.NewClientBuilder().WithScheme(kubernetes.SeedScheme).Build()
+		runtimeAPIReader = fakeclient.NewClientBuilder().WithScheme(kubernetes.SeedScheme).Build()
 		apiServerConfig = nil
 	})
 
@@ -93,7 +95,7 @@ var _ = Describe("GardenerAPIServer", func() {
 				func(configuredPlugins []gardencorev1beta1.AdmissionPlugin, expectedPlugins []apiserver.AdmissionPluginConfig) {
 					apiServerConfig.AdmissionPlugins = configuredPlugins
 
-					gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
+					gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, runtimeAPIReader, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
 					Expect(err).NotTo(HaveOccurred())
 					Expect(gardenerAPIServer.GetValues().EnabledAdmissionPlugins).To(Equal(expectedPlugins))
 				},
@@ -130,7 +132,7 @@ var _ = Describe("GardenerAPIServer", func() {
 				var expectedDisabledPlugins []gardencorev1beta1.AdmissionPlugin
 
 				AfterEach(func() {
-					gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
+					gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, runtimeAPIReader, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
 					Expect(err).NotTo(HaveOccurred())
 					Expect(gardenerAPIServer.GetValues().DisabledAdmissionPlugins).To(Equal(expectedDisabledPlugins))
 				})
@@ -197,7 +199,7 @@ var _ = Describe("GardenerAPIServer", func() {
 						prepTest()
 					}
 
-					gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
+					gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, runtimeAPIReader, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
 					Expect(err).To(errMatcher)
 					if gardenerAPIServer != nil {
 						Expect(gardenerAPIServer.GetValues().Audit).To(Equal(expectedConfig))
@@ -330,7 +332,7 @@ var _ = Describe("GardenerAPIServer", func() {
 
 		Describe("FeatureGates", func() {
 			It("should set the field to nil by default", func() {
-				gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
+				gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, runtimeAPIReader, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
 				Expect(err).NotTo(HaveOccurred())
 				Expect(gardenerAPIServer.GetValues().FeatureGates).To(BeNil())
 			})
@@ -344,15 +346,15 @@ var _ = Describe("GardenerAPIServer", func() {
 					},
 				}
 
-				gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
+				gardenerAPIServer, err := NewGardenerAPIServer(ctx, runtimeClient, runtimeAPIReader, namespace, objectMeta, runtimeVersion, sm, apiServerConfig, autoscalingConfig, auditWebhookConfig, topologyAwareRoutingEnabled, clusterIdentity, workloadIdentityTokenIssuer, &goAwayChance, targetVersion)
 				Expect(err).NotTo(HaveOccurred())
 				Expect(gardenerAPIServer.GetValues().FeatureGates).To(Equal(featureGates))
 			})
 		})
 
 		Describe("Requests", func() {
 			It("should set
```

**File**: `pkg/component/shared/kubeapiserver_test.go` (modified, +0/-6)
```diff
@@ -1404,7 +1404,6 @@ authorizers:
 					})).To(Succeed())
 				},
 				apiserver.ETCDEncryptionConfig{
-					RotationPhase:         gardencorev1beta1.RotationPreparing,
 					EncryptWithCurrentKey: true,
 					ResourcesToEncrypt:    []string{"secrets"},
 					EncryptedResources:    []string{"secrets"},
@@ -1426,7 +1425,6 @@ authorizers:
 					kubeAPIServer.EXPECT().Wait(ctx)
 
 					kubeAPIServer.EXPECT().SetETCDEncryptionConfig(apiserver.ETCDEncryptionConfig{
-						RotationPhase:         gardencorev1beta1.RotationPreparing,
 						EncryptWithCurrentKey: true,
 						ResourcesToEncrypt:    []string{"secrets"},
 						EncryptedResources:    []string{"secrets"},
@@ -1435,7 +1433,6 @@ authorizers:
 					kubeAPIServer.EXPECT().Deploy(ctx)
 				},
 				apiserver.ETCDEncryptionConfig{
-					RotationPhase:         gardencorev1beta1.RotationPreparing,
 					EncryptWithCurrentKey: false,
 					ResourcesToEncrypt:    []string{"secrets"},
 					EncryptedResources:    []string{"secrets"},
@@ -1451,7 +1448,6 @@ authorizers:
 				gardencorev1beta1.RotationPrepared,
 				nil,
 				apiserver.ETCDEncryptionConfig{
-					RotationPhase:         gardencorev1beta1.RotationPrepared,
 					EncryptWithCurrentKey: true,
 					ResourcesToEncrypt:    []string{"secrets"},
 					EncryptedResources:    []string{"secrets"},
@@ -1472,7 +1468,6 @@ authorizers:
 					})).To(Succeed())
 				},
 				apiserver.ETCDEncryptionConfig{
-					RotationPhase:         gardencorev1beta1.RotationCompleting,
 					EncryptWithCurrentKey: true,
 					ResourcesToEncrypt:    []string{"secrets"},
 					EncryptedResources:    []string{"secrets"},
@@ -1488,7 +1483,6 @@ authorizers:
 				gardencorev1beta1.RotationCompleted,
 				nil,
 				apiserver.ETCDEncryptionConfig{
-					RotationPhase:         gardencorev1beta1.RotationCompleted,
 					EncryptWithCurrentKey: true,
 					ResourcesToEncrypt:    []string{"secrets"},
 					EncryptedResources:    []string{"secrets"},
```

---

### Incident Patch 8: `0b8f018f` (2026-09-25)
**Commit Message**: Update module github.com/containerd/containerd/v2 to v2.3.6 [SECURITY] (#15818)

* Update module github.com/containerd/containerd/v2 to v2.3.6 [SECURITY]

Signed-off-by: gardener-ci-robot <[REDACTED_EMAIL]>

* Run make tidy

---------

Signed-off-by: gardener-ci-robot <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 module github.com/gardener/gardener
 
-go 1.26.5
+go 1.26.8
 
 require (
 	github.com/Masterminds/semver/v3 v3.5.0
 	github.com/Masterminds/sprig/v3 v3.3.0
 	github.com/VictoriaMetrics/operator/api v0.74.1
 	github.com/andybalholm/brotli v1.2.5
 	github.com/bramvdbogaerde/go-scp v1.6.0
-	github.com/containerd/containerd/v2 v2.3.5
+	github.com/containerd/containerd/v2 v2.3.6
 	github.com/containerd/errdefs v1.0.0
 	github.com/coreos/go-systemd/v22 v22.7.0
 	github.com/distribution/distribution/v3 v3.1.2
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -162,8 +162,8 @@ github.com/containerd/cgroups/v3 v3.1.3 h1:eUNflyMddm18+yrDmZPn3jI7C5hJ9ahABE5q6
 github.com/containerd/cgroups/v3 v3.1.3/go.mod h1:PKZ2AcWmSBsY/tJUVhtS/rluX0b1uq1GmPO1ElCmbOw=
 github.com/containerd/containerd/api v1.11.1 h1:h8nfoDW9+fNsC/9TwiAHj8B1GzXKtR4eFtkhi/X5RLU=
 github.com/containerd/containerd/api v1.11.1/go.mod h1:CaQFRu+N1MtbgL6JDOJLUB1hCKESU1lD6MuTJhgtdlw=
-github.com/containerd/containerd/v2 v2.3.5 h1:9MYlI81gUcOZ0WsCkSMtvOU7rTR3hqAoa2eCzhoLlkA=
-github.com/containerd/containerd/v2 v2.3.5/go.mod h1:RXDyLPaI3zoO7dFdAW9/54W4cix+z3A6larieufC9mg=
+github.com/containerd/containerd/v2 v2.3.6 h1:huoqZXaDW1x1kgPvFC4rMwxv92vUJnqgq7I5b1rSddM=
+github.com/containerd/containerd/v2 v2.3.6/go.mod h1:qaUSWKk9EchqbudSbhv1MxI8dXKGYHLpZtMQdkEkVZ4=
 github.com/containerd/continuity v0.5.0 h1:7a85HZpCSs+1Zps0Ee3DPSuAWY+0SJM1JNM51nlEVDg=
 github.com/containerd/continuity v0.5.0/go.mod h1:/lNJvtJKUQStBzpVQ1+rasXO1LAWtUQssk28EZvJ3nE=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
```

**File**: `go.work` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-go 1.26.5
+go 1.26.8
 
 use (
 	./
```

---

### Incident Patch 9: `166f90fb` (2026-09-25)
**Commit Message**: Fix golangci-lint plugin builds failing to load on macOS 16+ due to DWARF segment mismatch (#15762)

Signed-off-by: Dobromir Peev <[REDACTED_EMAIL]>

**File**: `hack/tools.mk` (modified, +3/-3)
```diff
@@ -225,16 +225,16 @@ $(KUSTOMIZE): $(call tool_version_file,$(KUSTOMIZE),$(KUSTOMIZE_VERSION))
 # marker on $(GOLANGCI_LINT), which guarantees both invalidate together.
 ifeq ($(IS_GARDENER),true)
 $(LOGCHECK): $(call tool_version_file,$(LOGCHECK),$(LOGCHECK_VERSION)) $(GOLANGCI_LINT)
-	cd $(GARDENER_LOGCHECK_DIR); GOTOOLCHAIN=$(shell go version -m -json $(GOLANGCI_LINT) | jq -r .GoVersion) CGO_ENABLED=1 go build -o $(abspath $(LOGCHECK)) -buildmode=plugin ./plugin
+	cd $(GARDENER_LOGCHECK_DIR); GOTOOLCHAIN=$(shell go version -m -json $(GOLANGCI_LINT) | jq -r .GoVersion) CGO_ENABLED=1 go build -ldflags="-w" -o $(abspath $(LOGCHECK)) -buildmode=plugin ./plugin
 else
 $(LOGCHECK): $(call tool_version_file,$(LOGCHECK),$(LOGCHECK_VERSION)) $(GOLANGCI_LINT)
 	@[ -n "$(GARDENER_LOGCHECK_DIR)" ] || { echo "GARDENER_LOGCHECK_DIR is not set, cannot build logcheck plugin. Consider adding github.com/gardener/gardener/hack/tools/logcheck as dependency if errors occur." >&2; exit 1; }
-	GOTOOLCHAIN=$(shell go version -m -json $(GOLANGCI_LINT) | jq -r .GoVersion) CGO_ENABLED=1 go build -o $(LOGCHECK) -buildmode=plugin $(GARDENER_LOGCHECK_DIR)/plugin
+	GOTOOLCHAIN=$(shell go version -m -json $(GOLANGCI_LINT) | jq -r .GoVersion) CGO_ENABLED=1 go build -ldflags="-w" -o $(LOGCHECK) -buildmode=plugin $(GARDENER_LOGCHECK_DIR)/plugin
 endif
 
 # Build kube-api-linter plugin with the same toolchain as golangci-lint (required for plugin loading).
 $(KUBE_API_LINTER): $(call tool_version_file,$(KUBE_API_LINTER),$(KUBE_API_LINTER_VERSION)) $(GOLANGCI_LINT)
-	cd $(GARDENER_TOOL_DIR)/kube-api-linter; GOTOOLCHAIN=$(shell go version -m -json $(GOLANGCI_LINT) | jq -r .GoVersion) CGO_ENABLED=1 go build -o $(abspath $(KUBE_API_LINTER)) -buildmode=plugin ./plugin
+	cd $(GARDENER_TOOL_DIR)/kube-api-linter; GOTOOLCHAIN=$(shell go version -m -json $(GOLANGCI_LINT) | jq -r .GoVersion) CGO_ENABLED=1 go build -ldflags="-w" -o $(abspath $(KUBE_API_LINTER)) -buildmode=plugin ./plugin
 
 $(PROMTOOL): $(call tool_version_file,$(PROMTOOL),$(PROMTOOL_VERSION))
 	@PROMTOOL_VERSION=$(PROMTOOL_VERSION) $(GARDENER_TOOL_DIR)/install-promtool.sh
```

---

### Incident Patch 10: `59bd15fb` (2026-09-24)
**Commit Message**: fix misdirected request detection logic for envoy (#15331)

* simplify misdirected request detection logic

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

* update conditional formatting and port suffix parsing

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

* only strip 443 port in authority header

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

* remove safeguards since envoy already handles this when accepting the HTTP/2 connection

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

* handle certificate SANs

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

* use string slicing to check wildcard certs

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

---------

Signed-off-by: Claus-Theodor Riegg <[REDACTED_EMAIL]>

**File**: `pkg/component/networking/istio/charts/istio/istio-ingress/templates/misdirected-requests-envoy-filter.yaml` (modified, +31/-12)
```diff
@@ -1,8 +1,9 @@
 # Envoy proxy and istio do not support HTTP/2 client connection coalescing natively.
 # Clients, especially web browsers, may open a single HTTP/2 connection and send requests
 # targeted at different hosts all backed by the same IP address and wildcard certificate.
-# Returning 421 for requests where the server name and the authority header do not match
-# indicates to the client that it should open a new connection for the request.
+# Returning 421 for requests where the authority header matches the certificate SANs but
+# differs from the requested server name indicates to the client that it should open a new
+# connection for the request.
 # Issues:
 # - https://github.com/envoyproxy/envoy/issues/6767
 # - https://github.com/istio/istio/issues/13589
@@ -34,18 +35,36 @@ spec:
           inlineCode: |
             function envoy_on_request(request_handle)
               local streamInfo = request_handle:streamInfo()
-              if streamInfo:requestedServerName() ~= "" then
-                -- Handle wildcard in the requested server name
-                if (string.sub(streamInfo:requestedServerName(), 1, 2) == "*." and not string.find(request_handle:headers():get(":authority"), string.sub(streamInfo:requestedServerName(), 2), 1, true)) then
+              local rsn = streamInfo:requestedServerName()
+              local authority = request_handle:headers():get(":authority")
+
+              authority = authority:gsub(":443$", "")
+
+              -- If the requested SNI matches the authority, the request is on the expected connection.
+              if rsn == authority then
+                return
+              end
+
+              local sslInfo = streamInfo:downstreamSslConnection()
+              local sans = sslInfo:dnsSansLocalCertificate()
+
+              for _, san in ipairs(sans) do
+                -- Exact match: The certificate covers this exact domain, but the connection was
+                -- opened with a different SNI (rsn). This indicates HTTP/2 connection coalescing.
+                if san == authority then
                   request_handle:respond({[":status"] = "421"}, "Misdirected Request")
-                end
-                -- Handle mismatch between requested server name and :authority header
-                if (string.sub(streamInfo:requestedServerName(), 1, 2) ~= "*." and streamInfo:requestedServerName() ~= request_handle:headers():get(":authority")) then
-                  -- Check if the difference is just the port (443) as suffix in the :authority header
-                  local portSuffix = ":443"
-                  local portSuffixLen = string.len(portSuffix)
-                  if (not(string.find(string.sub(request_handle:headers():get(":authority"), -portSuffixLen), portSuffix, 1, true) and streamInfo:requestedServerName() == string.sub(request_handle:headers():get(":authority"), 1, -portSuffixLen - 1))) then
+                  return
+
+                -- Wildcard match: Handle wildcard certificates (e.g. "*.example.com").
+                -- The wildcard only matches a single leftmost label
+                -- (e.g. "foo.example.com" matches, but "sub.foo.example.com" does not).
+                elseif san:sub(1, 2) == "*." then
+                  local wildcardDomain = san:sub(3)
+                  local dotIndex = authority:find(".", 1, true)
+
+                  if dotIndex and authority:sub(dotIndex + 1) == wildcardDomain then
                     request_handle:respond({[":status"] = "421"}, "Misdirected Request")
+                    return
                   end
                 end
               end
```

**File**: `pkg/component/networking/istio/test_charts/ingress_misdirected_requests_envoyfilter.yaml` (modified, +31/-12)
```diff
@@ -1,8 +1,9 @@
 # Envoy proxy and istio do not support HTTP/2 client connection coalescing natively.
 # Clients, especially web browsers, may open a single HTTP/2 connection and send requests
 # targeted at different hosts all backed by the same IP address and wildcard certificate.
-# Returning 421 for requests where the server name and the authority header do not match
-# indicates to the client that it should open a new connection for the request.
+# Returning 421 for requests where the authority header matches the certificate SANs but
+# differs from the requested server name indicates to the client that it should open a new
+# connection for the request.
 # Issues:
 # - https://github.com/envoyproxy/envoy/issues/6767
 # - https://github.com/istio/istio/issues/13589
@@ -34,18 +35,36 @@ spec:
           inlineCode: |
             function envoy_on_request(request_handle)
               local streamInfo = request_handle:streamInfo()
-              if streamInfo:requestedServerName() ~= "" then
-                -- Handle wildcard in the requested server name
-                if (string.sub(streamInfo:requestedServerName(), 1, 2) == "*." and not string.find(request_handle:headers():get(":authority"), string.sub(streamInfo:requestedServerName(), 2), 1, true)) then
+              local rsn = streamInfo:requestedServerName()
+              local authority = request_handle:headers():get(":authority")
+
+              authority = authority:gsub(":443$", "")
+
+              -- If the requested SNI matches the authority, the request is on the expected connection.
+              if rsn == authority then
+                return
+              end
+
+              local sslInfo = streamInfo:downstreamSslConnection()
+              local sans = sslInfo:dnsSansLocalCertificate()
+
+              for _, san in ipairs(sans) do
+                -- Exact match: The certificate covers this exact domain, but the connection was
+                -- opened with a different SNI (rsn). This indicates HTTP/2 connection coalescing.
+                if san == authority then
                   request_handle:respond({[":status"] = "421"}, "Misdirected Request")
-                end
-                -- Handle mismatch between requested server name and :authority header
-                if (string.sub(streamInfo:requestedServerName(), 1, 2) ~= "*." and streamInfo:requestedServerName() ~= request_handle:headers():get(":authority")) then
-                  -- Check if the difference is just the port (443) as suffix in the :authority header
-                  local portSuffix = ":443"
-                  local portSuffixLen = string.len(portSuffix)
-                  if (not(string.find(string.sub(request_handle:headers():get(":authority"), -portSuffixLen), portSuffix, 1, true) and streamInfo:requestedServerName() == string.sub(request_handle:headers():get(":authority"), 1, -portSuffixLen - 1))) then
+                  return
+
+                -- Wildcard match: Handle wildcard certificates (e.g. "*.example.com").
+                -- The wildcard only matches a single leftmost label
+                -- (e.g. "foo.example.com" matches, but "sub.foo.example.com" does not).
+                elseif san:sub(1, 2) == "*." then
+                  local wildcardDomain = san:sub(3)
+                  local dotIndex = authority:find(".", 1, true)
+
+                  if dotIndex and authority:sub(dotIndex + 1) == wildcardDomain then
                     request_handle:respond({[":status"] = "421"}, "Misdirected Request")
+                    return
                   end
                 end
               end
```

---

### Incident Patch 11: `f7d25391` (2026-09-23)
**Commit Message**: Enable kube-api-linter linters that require no adaptation (#15684)

Signed-off-by: Dobromir Peev <[REDACTED_EMAIL]>

**File**: `.golangci.yaml.in` (modified, +2/-0)
```diff
@@ -278,7 +278,9 @@ linters:
             disable:
               - "*"
             enable:
+              - defaultorrequired
               - jsontags
+              - nonullable
   exclusions:
     generated: lax
     rules:
```

---

### Incident Patch 12: `a2970263` (2026-09-22)
**Commit Message**: [GEP-28] Reserve `extension-shoot--` `ServiceAccount` name prefix for self-hosted shoot gardenlets (#15743)

* Prefactor: extract `ParseExtensionShootServiceAccountName` and `ExtensionShootServiceAccountName` helpers

Both the gardenlet identity parser and the graph event handler open-code
the same two-step parse (TrimPrefix + Cut) for the `extension-shoot--`
ServiceAccount name format. Centralise this in `pkg/utils/gardener` so
callers share a single implementation.

We'll use this in the next commit.

Assisted-by: Claude <[REDACTED_EMAIL]>
Signed-off-by: rfranzke <[REDACTED_EMAIL]>

* [admissioncontroller] Add `shoot-serviceaccounts` admission plugin

Reserve the `extension-shoot--` `ServiceAccount` name prefix and its
token subresource for self-hosted shoot gardenlets in project namespaces.
Any other caller attempting to create such a `ServiceAccount` or request
a token for one receives a `403 Forbidden` response.

Assisted-by: Claude <[REDACTED_EMAIL]>
Signed-off-by: rfranzke <[REDACTED_EMAIL]>

* [operator] Register `shoot-serviceaccounts` admission webhook

Register the `shoot-serviceaccounts.gardener.cloud` validating webhook.
The webhook intercepts `serviceaccounts` and `se

**File**: `dev-setup/skaffold-operator.yaml` (modified, +1/-0)
```diff
@@ -839,6 +839,7 @@ build:
             - pkg/admissioncontroller/webhook/admission/seedrestriction
             - pkg/admissioncontroller/webhook/admission/shootkubeconfigsecretref
             - pkg/admissioncontroller/webhook/admission/shootrestriction
+            - pkg/admissioncontroller/webhook/admission/shootserviceaccounts
             - pkg/admissioncontroller/webhook/admission/updaterestriction
             - pkg/admissioncontroller/webhook/auth
             - pkg/admissioncontroller/webhook/auth/seed
```

**File**: `docs/concepts/admission-controller.md` (modified, +6/-0)
```diff
@@ -124,6 +124,12 @@ Please refer to [Scoped API Access for Gardenlets](../deployment/gardenlet_api_a
 This handler restricts requests made by gardenlets running in self-hosted shoots.
 It ensures that shoot gardenlets can only access resources that belong to their own shoot, preventing unauthorized access to other shoots' resources.
 
+### ShootServiceAccounts
+
+`ServiceAccount` names starting with `extension-shoot--` are reserved for extensions running on self-hosted shoots.
+This handler ensures that only a self-hosted shoot gardenlet may create such `ServiceAccount`s or request tokens for them in project namespaces.
+Any other caller receives a `403 Forbidden` response.
+
 ### UpdateRestriction
 
 Gardener stores public data regarding shoot clusters, i.e. certificate authority bundles, OIDC discovery documents, etc.
```

**File**: `pkg/admissioncontroller/gardenletidentity/shoot/identity.go` (modified, +2/-10)
```diff
@@ -110,20 +110,12 @@ func getIdentityForServiceAccountsGroup(u user.Info) (namespace string, name str
 		return "", "", false, ""
 	}
 
-	// The SA must be in the garden namespace or a project namespace (garden-<project>).
 	if saNamespace != v1beta1constants.GardenNamespace && !strings.HasPrefix(saNamespace, gardenerutils.ProjectNamespacePrefix) {
 		return "", "", false, ""
 	}
 
-	// The SA name must start with the extension-shoot-- prefix.
-	if !strings.HasPrefix(saName, v1beta1constants.ExtensionShootServiceAccountPrefix) {
-		return "", "", false, ""
-	}
-
-	// Parse: extension-shoot--<shoot-name>--<controller-installation-name>.
-	withoutPrefix := strings.TrimPrefix(saName, v1beta1constants.ExtensionShootServiceAccountPrefix)
-	shootName, _, found := strings.Cut(withoutPrefix, "--")
-	if !found || shootName == "" {
+	shootName, ok := gardenerutils.ParseExtensionShootServiceAccountName(saName)
+	if !ok {
 		return "", "", false, ""
 	}
 
```

**File**: `pkg/admissioncontroller/webhook/add.go` (modified, +7/-0)
```diff
@@ -22,6 +22,7 @@ import (
 	"github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/seedrestriction"
 	"github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/shootkubeconfigsecretref"
 	"github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/shootrestriction"
+	"github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/shootserviceaccounts"
 	"github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/updaterestriction"
 	seedauthorizer "github.com/gardener/gardener/pkg/admissioncontroller/webhook/auth/seed"
 	shootauthorizer "github.com/gardener/gardener/pkg/admissioncontroller/webhook/auth/shoot"
@@ -121,6 +122,12 @@ func AddToManager(
 		return fmt.Errorf("failed adding %s webhook handler: %w", shootrestriction.HandlerName, err)
 	}
 
+	if err := (&shootserviceaccounts.Handler{
+		Logger: mgr.GetLogger().WithName("webhook").WithName(shootserviceaccounts.HandlerName),
+	}).AddToManager(ctx, mgr); err != nil {
+		return fmt.Errorf("failed adding %s webhook handler: %w", shootserviceaccounts.HandlerName, err)
+	}
+
 	if err := (&shootkubeconfigsecretref.Handler{
 		Logger: mgr.GetLogger().WithName("webhook").WithName(shootkubeconfigsecretref.HandlerName),
 		Client: mgr.GetClient(),
```

**File**: `pkg/admissioncontroller/webhook/admission/shootserviceaccounts/add.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+// SPDX-FileCopyrightText: Contributors to the Gardener project
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package shootserviceaccounts
+
+import (
+	"context"
+
+	"sigs.k8s.io/controller-runtime/pkg/manager"
+	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
+)
+
+const (
+	// HandlerName is the name of this admission webhook handler.
+	HandlerName = "shootserviceaccounts"
+	// WebhookPath is the HTTP handler path for this admission webhook handler.
+	WebhookPath = "/webhooks/admission/shootserviceaccounts"
+)
+
+// AddToManager adds Handler to the given manager.
+func (h *Handler) AddToManager(_ context.Context, mgr manager.Manager) error {
+	webhook := &admission.Webhook{
+		Handler:      h,
+		RecoverPanic: new(true),
+	}
+
+	mgr.GetWebhookServer().Register(WebhookPath, webhook)
+	return nil
+}
```

**File**: `pkg/admissioncontroller/webhook/admission/shootserviceaccounts/handler.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+// SPDX-FileCopyrightText: Contributors to the Gardener project
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package shootserviceaccounts
+
+import (
+	"context"
+	"fmt"
+	"net/http"
+
+	"github.com/go-logr/logr"
+	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
+
+	"github.com/gardener/gardener/pkg/admissioncontroller/gardenletidentity"
+	shootidentity "github.com/gardener/gardener/pkg/admissioncontroller/gardenletidentity/shoot"
+	admissionwebhook "github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission"
+	v1beta1constants "github.com/gardener/gardener/pkg/apis/core/v1beta1/constants"
+	gardenerutils "github.com/gardener/gardener/pkg/utils/gardener"
+)
+
+// Handler enforces that the `extension-shoot--` ServiceAccount name prefix is reserved for self-hosted shoot gardenlets
+// in project namespaces.
+type Handler struct {
+	Logger logr.Logger
+}
+
+// Handle denies the request and logs the caller when the name prefix is reserved but the caller is not the owning
+// shoot gardenlet.
+func (h *Handler) Handle(_ context.Context, request admission.Request) admission.Response {
+	requestResource := schema.GroupResource{Group: request.Resource.Group, Resource: request.Resource.Resource}
+	if requestResource != corev1.Resource("serviceaccounts") {
+		return admission.Errored(http.StatusBadRequest, fmt.Errorf("unexpected resource: %q", requestResource))
+	}
+
+	var (
+		shootName, isExtensionServiceAccount                                = gardenerutils.ParseExtensionShootServiceAccountName(request.Name)
+		gardenletNamespace, gardenletShootName, isSelfHostedShoot, userType = shootidentity.FromAuthenticationV1UserInfo(request.UserInfo)
+	)
+
+	if !isExtensionServiceAccount || !isSelfHostedShoot || userType != gardenletidentity.UserTypeGardenlet ||
+		gardenletNamespace != request.Namespace || gardenletShootName != shootName {
+		h.Logger.Info("Denied request for reserved ServiceAccount name prefix",
+			"name", request.Name,
+			"namespace", request.Namespace,
+			"username", request.UserInfo.Username,
+		)
+		return admission.Errored(http.StatusForbidden, fmt.Errorf(
+			"the %q prefix is reserved for the self-hosted shoot gardenlet responsible for %q and may not be used by other clients",
+			v1beta1constants.ExtensionShootServiceAccountPrefix+shootName, shootName,
+		))
+	}
+
+	return admissionwebhook.Allowed("")
+}
```

**File**: `pkg/admissioncontroller/webhook/admission/shootserviceaccounts/handler_test.go` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+// SPDX-FileCopyrightText: Contributors to the Gardener project
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package shootserviceaccounts_test
+
+import (
+	"context"
+	"net/http"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	admissionv1 "k8s.io/api/admission/v1"
+	authenticationv1 "k8s.io/api/authentication/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	logzap "sigs.k8s.io/controller-runtime/pkg/log/zap"
+	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
+
+	"github.com/gardener/gardener/pkg/admissioncontroller/webhook/admission/shootserviceaccounts"
+	"github.com/gardener/gardener/pkg/logger"
+)
+
+var _ = Describe("handler", func() {
+	var (
+		ctx     = context.TODO()
+		handler admission.Handler
+		request admission.Request
+
+		responseAllowed = admission.Response{
+			AdmissionResponse: admissionv1.AdmissionResponse{
+				Allowed: true,
+				Result:  &metav1.Status{Code: int32(http.StatusOK)},
+			},
+		}
+
+		gardenletUser = authenticationv1.UserInfo{
+			Username: "gardener.cloud:system:shoot:garden-myproject:myshoot",
+			Groups:   []string{"gardener.cloud:system:shoots"},
+		}
+
+		extensionUser = authenticationv1.UserInfo{
+			Username: "system:serviceaccount:garden-myproject:extension-shoot--myshoot--foo",
+			Groups:   []string{"system:serviceaccounts", "system:serviceaccounts:garden-myproject"},
+		}
+
+		projectMemberUser = authenticationv1.UserInfo{
+			Username: "alice",
+			Groups:   []string{"system:authenticated"},
+		}
+	)
+
+	BeforeEach(func() {
+		log := logger.MustNewZapLogger(logger.DebugLevel, logger.FormatJSON, logzap.WriteTo(GinkgoWriter))
+		handler = &shootserviceaccounts.Handler{Logger: log}
+		request = admission.Request{
+			AdmissionRequest: admissionv1.AdmissionRequest{
+				Operation: admissionv1.Create,
+				Namespace: "garden-myproject",
+				Resource:  metav1.GroupVersionResource{Group: "", Version: "v1", Resource: "serviceaccounts"},
+			},
+		}
+	})
+
+	Describe("#Handle", func() {
+		It("should return a bad request error when the resource is not serviceaccounts", func() {
+			request.Resource = metav1.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}
+			request.Name = "extension-shoot--myshoot--controller"
+			request.UserInfo = gardenletUser
+
+			response := handler.Handle(ctx, request)
+
+			Expect(response.Allowed).To(BeFalse())
+			Expect(response.Result.Code).To(Equal(int32(http.StatusBadRequest)))
+		})
+
+		When("the ServiceAccount name carries the reserved prefix", func() {
+			BeforeEach(func() {
+				request.Name = "extension-shoot--myshoot--controller"
+			})
+
+			It("should allow when the caller is the gardenlet for this shoot", func() {
+				request.UserInfo = gardenletUser
+
+				Expect(handler.Handle(ctx, request)).To(Equal(responseAllowed))
+			})
+
+			It("should deny when the ServiceAccount name is malformed (no second --)", func() {
+				request.Name = "extension-shoot--malformed"
+				request.UserInfo = gardenletUser
+
+				response := handler.Handle(ctx, request)
+
+				Expect(response.Allowed).To(BeFalse())
+				Expect(response.Result.Code).To(Equal(int32(http.StatusForbidden)))
+			})
+
+			It("should deny when the caller is a gardenlet for a different shoot", func() {
+				request.UserInfo = authenticationv1.UserInfo{
+					Username: "gardener.cloud:system:shoot:garden-myproject:other-shoot",
+					Groups:   []string{"gardener.cloud:system:shoots"},
+				}
+
+				response := handler.Handle(ctx, request)
+
+				Expect(response.Allowed).To(BeFalse())
+				Expect(response.Result.Code).To(Equal(int32(http.StatusForbidden)))
+			})
+
+			It("should deny when the caller is a gardenlet in a different namespace", func() {
+				request.UserInfo = authenticationv1.UserInfo{
+					Username: "gardener.cloud:system:shoot:garden-other:myshoot",
+					Groups:   []string{"gardener.cloud:system:shoots"},
+				}
+
+				response := handler.Handle(ctx, request)
+
+				Expect(response.Allowed).To(BeFalse())
+				Expect(response.Result.Code).To(Equal(int32(http.StatusForbidden)))
+			})
+
+			It("should deny when the caller is a project member", func() {
+				request.UserInfo = projectMemberUser
+
+				response := handler.Handle(ctx, request)
+
+				Expect(response.Allowed).To(BeFalse())
+				Expect(response.Result.Code).To(Equal(int32(http.StatusForbidden)))
+				Expect(response.Result.Message).To(ContainSubstring("extension-shoot--"))
+			})
+
+			It("should deny when the caller is an extension service account", func() {
+				request.UserInfo = extensionUser
+
+				response := handler.Handle(ctx, request)
+
+				Expect(response.Allowed).To(BeFalse())
+				Expect(response.Result.Code).To(Equal(int32(http.StatusForbidden)))
+			})
+		})
+
+		When("the token subresource is requested for a reserved-prefix ServiceAccount", func() {
+			BeforeEach(func() {
+				request.Name = "extension-shoot--myshoot--controller"
+				request.SubResource = "token"
+			})
+
+			It("should allow when the caller is 
```

**File**: `pkg/admissioncontroller/webhook/admission/shootserviceaccounts/shootserviceaccounts_suite_test.go` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+// SPDX-FileCopyrightText: Contributors to the Gardener project
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package shootserviceaccounts_test
+
+import (
+	"testing"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+)
+
+func TestShootServiceAccounts(t *testing.T) {
+	RegisterFailHandler(Fail)
+	RunSpecs(t, "AdmissionController Webhook Admission ShootServiceAccounts Suite")
+}
```

---

### Incident Patch 13: `7c96f6f7` (2026-09-20)
**Commit Message**: Fix shoot maintenance dryrun conflict (#15756)

* Do not fail shoot maintenance on conflict during dry-run update

Signed-off-by: Juan Diego Cabrera Soler <[REDACTED_EMAIL]>

* Address review feedback: fix linter errors and add regression test

Signed-off-by: Juan Diego Cabrera Soler <[REDACTED_EMAIL]>

---------

Signed-off-by: Juan Diego Cabrera Soler <[REDACTED_EMAIL]>

**File**: `pkg/controllermanager/controller/shoot/maintenance/reconciler.go` (modified, +4/-0)
```diff
@@ -342,6 +342,10 @@ func (r *Reconciler) reconcile(ctx context.Context, log logr.Logger, shoot *gard
 		if err := r.Client.Update(ctx, maintainedShoot.DeepCopy(), &client.UpdateOptions{
 			DryRun: []string{metav1.DryRunAll},
 		}); err != nil {
+			if apierrors.IsConflict(err) {
+				return err
+			}
+
 			// If shoot maintenance is triggered by `gardener.cloud/operation=maintain` annotation and if it fails in dry run,
 			// `maintain` operation annotation needs to be removed so that if reason for failure is fixed and maintenance is triggered
 			// again via `maintain` operation annotation then it should not fail with the reason that annotation is already present.
```

**File**: `pkg/controllermanager/controller/shoot/maintenance/reconciler_test.go` (modified, +166/-0)
```diff
@@ -6,17 +6,22 @@ package maintenance
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"time"
 
 	"github.com/go-logr/logr"
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
 	corev1 "k8s.io/api/core/v1"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	testclock "k8s.io/utils/clock/testing"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	fakeclient "sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
 
 	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
 	v1beta1constants "github.com/gardener/gardener/pkg/apis/core/v1beta1/constants"
@@ -2540,6 +2545,167 @@ var _ = Describe("Shoot Maintenance", func() {
 			Expect(allShootConditionsTrue(shoot)).To(BeTrue())
 		})
 	})
+
+	Describe("#reconcile", func() {
+		var (
+			ctx          = context.Background()
+			scheme       *runtime.Scheme
+			cloudProfile *gardencorev1beta1.CloudProfile
+			shoot        *gardencorev1beta1.Shoot
+		)
+
+		BeforeEach(func() {
+			scheme = runtime.NewScheme()
+			Expect(gardencorev1beta1.AddToScheme(scheme)).To(Succeed())
+
+			cloudProfile = &gardencorev1beta1.CloudProfile{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "test-profile",
+				},
+				Spec: gardencorev1beta1.CloudProfileSpec{
+					Kubernetes: gardencorev1beta1.KubernetesSettings{
+						Versions: []gardencorev1beta1.ExpirableVersion{
+							{Version: "1.30.0"},
+							{Version: "1.30.1"},
+						},
+					},
+				},
+			}
+
+			shoot = &gardencorev1beta1.Shoot{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      "test-shoot",
+					Namespace: "test-namespace",
+					Annotations: map[string]string{
+						v1beta1constants.GardenerOperation: v1beta1constants.ShootOperationMaintain,
+					},
+				},
+				Spec: gardencorev1beta1.ShootSpec{
+					CloudProfileName: new("test-profile"),
+					Kubernetes: gardencorev1beta1.Kubernetes{
+						Version: "1.30.0",
+					},
+					Maintenance: &gardencorev1beta1.Maintenance{
+						AutoUpdate: &gardencorev1beta1.MaintenanceAutoUpdate{
+							KubernetesVersion:   true,
+							MachineImageVersion: new(false),
+						},
+					},
+				},
+				Status: gardencorev1beta1.ShootStatus{
+					LastOperation: &gardencorev1beta1.LastOperation{
+						State: gardencorev1beta1.LastOperationStateSucceeded,
+					},
+				},
+			}
+		})
+
+		It("should return conflict error when dry-run update encounters conflict so controller re-enqueues", func() {
+			conflictErr := apierrors.NewConflict(schema.GroupResource{Group: "core.gardener.cloud", Resource: "shoots"}, shoot.Name, errors.New("the object has been modified"))
+
+			fakeClient := fakeclient.NewClientBuilder().
+				WithScheme(scheme).
+				WithObjects(cloudProfile, shoot).
+				WithStatusSubresource(&gardencorev1beta1.Shoot{}).
+				WithInterceptorFuncs(interceptor.Funcs{
+					Update: func(_ context.Context, _ client.WithWatch, _ client.Object, opts ...client.UpdateOption) error {
+						updateOpts := &client.UpdateOptions{}
+						updateOpts.ApplyOptions(opts)
+						if len(updateOpts.DryRun) > 0 && updateOpts.DryRun[0] == metav1.DryRunAll {
+							return conflictErr
+						}
+						return nil
+					},
+				}).
+				Build()
+
+			r := &Reconciler{
+				Client: fakeClient,
+				Clock:  testclock.NewFakeClock(time.Now()),
+			}
+
+			err := r.reconcile(ctx, log, shoot)
+			Expect(err).To(MatchError(conflictErr))
+			Expect(apierrors.IsConflict(err)).To(BeTrue())
+			Expect(shoot.Status.LastMaintenance.State).NotTo(Equal(gardencorev1beta1.LastOperationStateFailed))
+
+			fetchedShoot := &gardencorev1beta1.Shoot{}
+			Expect(fakeClient.Get(ctx, client.ObjectKeyFromObject(shoot), fetchedShoot)).To(Succeed())
+			Expect(fetchedShoot.Status.LastMaintenance).To(BeNil())
+		})
+
+		It("should not strip the maintain operation annotation on conflict error", func() {
+			conflictErr := apierrors.NewConflict(schema.GroupResource{Group: "core.gardener.cloud", Resource: "shoots"}, shoot.Name, errors.New("the object has been modified"))
+
+			fakeClient := fakeclient.NewClientBuilder().
+				WithScheme(scheme).
+				WithObjects(cloudProfile, shoot).
+				WithStatusSubresource(&gardencorev1beta1.Shoot{}).
+				WithInterceptorFuncs(interceptor.Funcs{
+					Update: func(_ context.Context, _ client.WithWatch, _ client.Object, opts ...client.UpdateOption) error {
+						updateOpts := &client.UpdateOptions{}
+						updateOpts.ApplyOptions(opts)
+						if len(updateOpts.DryRun) > 0 && updateOpts.DryRun[0] == metav1.DryRunAll {
+							return conflictErr
+						}
+						return nil
+					},
+				}).
+				Build()
+
+			r := &Reconciler{
+				Client: fakeClient,
+				Clock:  testclock.NewFakeClock(time.Now()),
+			}
+
+			err := r.reconcile(ctx, log, shoot)
+			Expect(err).To(MatchError(conflictErr))
+			Expect(shoot.Annotations).To(HaveKeyWithValue(v1beta1constants.GardenerOperation, v1beta1constants.Sh
```

---

### Incident Patch 14: `35adc1a8` (2026-09-18)
**Commit Message**: Fix `DeploymentHasExactNumberOfPods` to only count pods owned by the Deployment (#15692)

* Fix DeploymentHasExactNumberOfPods to only count pods owned by the Deployment

Motivation:
health.DeploymentHasExactNumberOfPods lists Pods purely by matching
.spec.selector.matchLabels, without checking that the Pods are actually
owned (via a ReplicaSet) by the given Deployment. This function backs the
resource-manager's Progressing health check for Deployments. An unrelated
Deployment in the same namespace that happens to create Pods with the same
labels (e.g. a workload placed into kube-system on a Shoot cluster,
matching a Gardener-managed Deployment's selector) is silently counted
alongside the real Pods. Since that count then never matches
.spec.replicas, the owning ManagedResource gets stuck in Progressing
state permanently.

Approach:
List the ReplicaSets in the Deployment's namespace matching its selector
labels, keep only those actually controlled by the Deployment (via
metav1.IsControlledBy), and then, when counting Pods, only count a Pod if
its controller reference points to one of those owned ReplicaSets. Pods
belonging to any other Deployment (directly or via their own ReplicaS

**File**: `pkg/component/kubernetes/apiserver/apiserver_test.go` (modified, +14/-3)
```diff
@@ -4471,11 +4471,22 @@ anonymous:
 			Expect(fakeClient.Create(ctx, deploy)).To(Succeed())
 			Expect(fakeClient.Get(ctx, client.ObjectKeyFromObject(deploy), deploy)).To(Succeed())
 
+			replicaSet := &appsv1.ReplicaSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:            "replicaset",
+					Namespace:       deployment.Namespace,
+					Labels:          GetLabels(),
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deploy, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
+				},
+			}
+			Expect(fakeClient.Create(ctx, replicaSet)).To(Succeed())
+
 			Expect(fakeClient.Create(ctx, &corev1.Pod{
 				ObjectMeta: metav1.ObjectMeta{
-					Name:      "pod",
-					Namespace: deployment.Namespace,
-					Labels:    GetLabels(),
+					Name:            "pod",
+					Namespace:       deployment.Namespace,
+					Labels:          GetLabels(),
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
 				},
 			})).To(Succeed())
 
```

**File**: `pkg/component/kubernetes/controllermanager/controllermanager_test.go` (modified, +14/-3)
```diff
@@ -949,11 +949,22 @@ namespace: kube-system
 			Expect(c.Create(ctx, deploy)).To(Succeed())
 			Expect(c.Get(ctx, client.ObjectKeyFromObject(deploy), deploy)).To(Succeed())
 
+			replicaSet := &appsv1.ReplicaSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:            "replicaset",
+					Namespace:       deployment.Namespace,
+					Labels:          labels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deploy, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
+				},
+			}
+			Expect(c.Create(ctx, replicaSet)).To(Succeed())
+
 			Expect(c.Create(ctx, &corev1.Pod{
 				ObjectMeta: metav1.ObjectMeta{
-					Name:      "pod",
-					Namespace: deployment.Namespace,
-					Labels:    labels,
+					Name:            "pod",
+					Namespace:       deployment.Namespace,
+					Labels:          labels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
 				},
 			})).To(Succeed())
 
```

**File**: `pkg/component/nodemanagement/machinecontrollermanager/machine_controller_manager_test.go` (modified, +14/-3)
```diff
@@ -740,11 +740,22 @@ subjects:
 			Expect(fakeClient.Create(ctx, deploy)).To(Succeed())
 			Expect(fakeClient.Get(ctx, client.ObjectKeyFromObject(deploy), deploy)).To(Succeed())
 
+			replicaSet := &appsv1.ReplicaSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:            "replicaset",
+					Namespace:       deployment.Namespace,
+					Labels:          deployment.Spec.Selector.MatchLabels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deploy, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
+				},
+			}
+			Expect(fakeClient.Create(ctx, replicaSet)).To(Succeed())
+
 			Expect(fakeClient.Create(ctx, &corev1.Pod{
 				ObjectMeta: metav1.ObjectMeta{
-					Name:      "pod",
-					Namespace: deployment.Namespace,
-					Labels:    deployment.Spec.Selector.MatchLabels,
+					Name:            "pod",
+					Namespace:       deployment.Namespace,
+					Labels:          deployment.Spec.Selector.MatchLabels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
 				},
 			})).To(Succeed())
 
```

**File**: `pkg/resourcemanager/controller/health/progressing/add_test.go` (modified, +7/-1)
```diff
@@ -115,7 +115,13 @@ var _ = Describe("Add", func() {
 						deploy := obj.(*appsv1.Deployment)
 						deploy.Generation++
 
-						pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{GenerateName: "pod-", Labels: map[string]string{"foo": "bar"}}}
+						replicaSet := &appsv1.ReplicaSet{ObjectMeta: metav1.ObjectMeta{GenerateName: "replicaset-", Labels: map[string]string{"foo": "bar"}, OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deploy, appsv1.SchemeGroupVersion.WithKind("Deployment"))}}}
+						Expect(fakeClient.Create(ctx, replicaSet)).To(Succeed())
+						DeferCleanup(func() {
+							Expect(fakeClient.Delete(ctx, replicaSet)).To(Succeed())
+						})
+
+						pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{GenerateName: "pod-", Labels: map[string]string{"foo": "bar"}, OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))}}}
 						Expect(fakeClient.Create(ctx, pod)).To(Succeed())
 						DeferCleanup(func() {
 							Expect(fakeClient.Delete(ctx, pod)).To(Succeed())
```

**File**: `pkg/utils/kubernetes/health/deployment.go` (modified, +22/-2)
```diff
@@ -11,6 +11,9 @@ import (
 
 	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/apimachinery/pkg/util/sets"
 	"k8s.io/utils/ptr"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
@@ -136,16 +139,33 @@ func IsDeploymentUpdated(reader client.Reader, deployment *appsv1.Deployment) fu
 	}
 }
 
-// DeploymentHasExactNumberOfPods returns true when there are exactly as many pods as the .spec.replicas field of the
-// deployment mandates.
+// DeploymentHasExactNumberOfPods returns true when there are exactly as many pods owned by the deployment (via its
+// ReplicaSets) as the .spec.replicas field of the deployment mandates.
 func DeploymentHasExactNumberOfPods(ctx context.Context, reader client.Reader, deployment *appsv1.Deployment) (bool, error) {
+	replicaSetList := &metav1.PartialObjectMetadataList{}
+	replicaSetList.SetGroupVersionKind(appsv1.SchemeGroupVersion.WithKind("ReplicaSetList"))
+	if err := reader.List(ctx, replicaSetList, client.InNamespace(deployment.Namespace), client.MatchingLabels(deployment.Spec.Selector.MatchLabels)); err != nil {
+		return false, err
+	}
+
+	ownedReplicaSetUIDs := sets.New[types.UID]()
+	for _, replicaSet := range replicaSetList.Items {
+		if metav1.IsControlledBy(&replicaSet, deployment) {
+			ownedReplicaSetUIDs.Insert(replicaSet.UID)
+		}
+	}
+
 	podList := &corev1.PodList{}
 	if err := reader.List(ctx, podList, client.InNamespace(deployment.Namespace), client.MatchingLabels(deployment.Spec.Selector.MatchLabels)); err != nil {
 		return false, err
 	}
 
 	var numberOfRelevantPods int32
 	for _, pod := range podList.Items {
+		if controller := metav1.GetControllerOf(&pod); controller == nil || !ownedReplicaSetUIDs.Has(controller.UID) {
+			continue
+		}
+
 		if !IsPodTerminal(pod.Status.Phase) && !IsPodStale(pod.Status.Reason) && !IsPodCompleted(pod.Status.Conditions) && !IsPodDisrupted(pod.Status.Conditions) {
 			numberOfRelevantPods++
 		}
```

**File**: `pkg/utils/kubernetes/health/deployment_test.go` (modified, +91/-11)
```diff
@@ -160,6 +160,7 @@ var _ = Describe("Deployment", func() {
 				ObjectMeta: metav1.ObjectMeta{
 					Name:      "deploy",
 					Namespace: "namespace",
+					UID:       "deploy-uid",
 				},
 				Spec: appsv1.DeploymentSpec{
 					Replicas: new(int32(1)),
@@ -182,11 +183,23 @@ var _ = Describe("Deployment", func() {
 
 			Expect(fakeClient.Create(ctx, deployment)).To(Succeed())
 
+			replicaSet := &appsv1.ReplicaSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:            "replicaset",
+					Namespace:       deployment.Namespace,
+					UID:             "replicaset-uid",
+					Labels:          labels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deployment, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
+				},
+			}
+			Expect(fakeClient.Create(ctx, replicaSet)).To(Succeed())
+
 			Expect(fakeClient.Create(ctx, &corev1.Pod{
 				ObjectMeta: metav1.ObjectMeta{
-					Name:      "pod",
-					Namespace: deployment.Namespace,
-					Labels:    labels,
+					Name:            "pod",
+					Namespace:       deployment.Namespace,
+					Labels:          labels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
 				},
 			})).To(Succeed())
 
@@ -209,12 +222,24 @@ var _ = Describe("Deployment", func() {
 
 			Expect(fakeClient.Create(ctx, deployment)).To(Succeed())
 
+			replicaSet := &appsv1.ReplicaSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:            "replicaset",
+					Namespace:       deployment.Namespace,
+					UID:             "replicaset-uid",
+					Labels:          labels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deployment, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
+				},
+			}
+			Expect(fakeClient.Create(ctx, replicaSet)).To(Succeed())
+
 			for i := range 2 {
 				Expect(fakeClient.Create(ctx, &corev1.Pod{
 					ObjectMeta: metav1.ObjectMeta{
-						Name:      fmt.Sprintf("pod%d", i),
-						Namespace: deployment.Namespace,
-						Labels:    labels,
+						Name:            fmt.Sprintf("pod%d", i),
+						Namespace:       deployment.Namespace,
+						Labels:          labels,
+						OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
 					},
 				})).To(Succeed())
 			}
@@ -267,6 +292,7 @@ var _ = Describe("Deployment", func() {
 			fakeClient client.Client
 
 			deployment *appsv1.Deployment
+			replicaSet *appsv1.ReplicaSet
 			pod        *corev1.Pod
 		)
 
@@ -277,21 +303,34 @@ var _ = Describe("Deployment", func() {
 				ObjectMeta: metav1.ObjectMeta{
 					Name:      "deploy",
 					Namespace: "namespace",
+					UID:       "deploy-uid",
 				},
 				Spec: appsv1.DeploymentSpec{
 					Replicas: new(int32(1)),
 					Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"foo": "bar"}},
 				},
 			}
-			pod = &corev1.Pod{
+			Expect(fakeClient.Create(ctx, deployment)).To(Succeed())
+
+			replicaSet = &appsv1.ReplicaSet{
 				ObjectMeta: metav1.ObjectMeta{
-					GenerateName: "pod-",
-					Namespace:    deployment.Namespace,
-					Labels:       deployment.Spec.Selector.MatchLabels,
+					Name:            "replicaset",
+					Namespace:       deployment.Namespace,
+					UID:             "replicaset-uid",
+					Labels:          deployment.Spec.Selector.MatchLabels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deployment, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
 				},
 			}
+			Expect(fakeClient.Create(ctx, replicaSet)).To(Succeed())
 
-			Expect(fakeClient.Create(ctx, deployment)).To(Succeed())
+			pod = &corev1.Pod{
+				ObjectMeta: metav1.ObjectMeta{
+					GenerateName:    "pod-",
+					Namespace:       deployment.Namespace,
+					Labels:          deployment.Spec.Selector.MatchLabels,
+					OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
+				},
+			}
 		})
 
 		It("should consider the deployment as updated", func() {
@@ -368,5 +407,46 @@ var _ = Describe("Deployment", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(ok).To(BeTrue())
 		})
+
+		It("should not consider pods of an unrelated Deployment sharing the same selector labels", func() {
+			Expect(fakeClient.Create(ctx, pod)).To(Succeed())
+
+			otherDeployment := &appsv1.Deployment{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      "other-deploy",
+					Namespace: deployment.Namespace,
+					UID:       "other-deploy-uid",
+				},
+				Spec: appsv1.DeploymentSpec{
+					Selector: &metav1.LabelSelector{MatchLabels: deployment.Spec.Selector.MatchLabels},
+				},
+			}
+			Expect(fakeClient.Create(ctx, otherDeployment)).To(Succeed())
+
+			otherReplicaSet := &appsv1.ReplicaSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:            "other-replicaset",
+					Namespace:       deployment.Namespace,
+					UID:             "other-replicaset-uid",
+					Labels:          
```

**File**: `test/integration/resourcemanager/health/health_test.go` (modified, +27/-6)
```diff
@@ -360,6 +360,7 @@ var _ = Describe("Health controller tests", func() {
 		Context("with existing resources", func() {
 			var (
 				deployment   *appsv1.Deployment
+				replicaSet   *appsv1.ReplicaSet
 				pod          *corev1.Pod
 				statefulSet  *appsv1.StatefulSet
 				daemonSet    *appsv1.DaemonSet
@@ -377,7 +378,10 @@ var _ = Describe("Health controller tests", func() {
 				deployment.Status = *deploymentStatus
 				Expect(testClient.Status().Update(ctx, deployment)).To(Succeed())
 
-				pod = generatePodForDeployment(deployment)
+				replicaSet = generateReplicaSetForDeployment(deployment)
+				Expect(testClient.Create(ctx, replicaSet)).To(Succeed())
+
+				pod = generatePodForDeployment(replicaSet)
 				Expect(testClient.Create(ctx, pod)).To(Succeed())
 
 				statefulSet = generateStatefulSetTestResource(managedResource.Name)
@@ -419,6 +423,7 @@ var _ = Describe("Health controller tests", func() {
 				DeferCleanup(func() {
 					By("Delete test resources")
 					Expect(testClient.Delete(ctx, pod)).To(Or(Succeed(), BeNotFoundError()))
+					Expect(testClient.Delete(ctx, replicaSet)).To(Or(Succeed(), BeNotFoundError()))
 					Expect(testClient.Delete(ctx, deployment)).To(Or(Succeed(), BeNotFoundError()))
 					Expect(testClient.Delete(ctx, statefulSet)).To(Or(Succeed(), BeNotFoundError()))
 					Expect(testClient.Delete(ctx, daemonSet)).To(Or(Succeed(), BeNotFoundError()))
@@ -519,7 +524,7 @@ var _ = Describe("Health controller tests", func() {
 			})
 
 			It("sets Progressing to true as Deployment still has non-terminated pods", func() {
-				pod2 := generatePodForDeployment(deployment)
+				pod2 := generatePodForDeployment(replicaSet)
 				Expect(testClient.Create(ctx, pod2)).To(Succeed())
 				DeferCleanup(func() {
 					Expect(testClient.Delete(ctx, pod2)).To(Or(Succeed(), BeNotFoundError()))
@@ -780,12 +785,28 @@ func generateDeploymentTestResource(name string) *appsv1.Deployment {
 	}
 }
 
-func generatePodForDeployment(deployment *appsv1.Deployment) *corev1.Pod {
+func generateReplicaSetForDeployment(deployment *appsv1.Deployment) *appsv1.ReplicaSet {
+	return &appsv1.ReplicaSet{
+		ObjectMeta: metav1.ObjectMeta{
+			GenerateName:    deployment.Name + "-rs-",
+			Namespace:       deployment.Namespace,
+			Labels:          deployment.Spec.Selector.MatchLabels,
+			OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(deployment, appsv1.SchemeGroupVersion.WithKind("Deployment"))},
+		},
+		Spec: appsv1.ReplicaSetSpec{
+			Selector: deployment.Spec.Selector,
+			Template: deployment.Spec.Template,
+		},
+	}
+}
+
+func generatePodForDeployment(replicaSet *appsv1.ReplicaSet) *corev1.Pod {
 	return &corev1.Pod{
 		ObjectMeta: metav1.ObjectMeta{
-			GenerateName: deployment.Name + "-pod-",
-			Namespace:    deployment.Namespace,
-			Labels:       deployment.Spec.Selector.MatchLabels,
+			GenerateName:    replicaSet.Name + "-pod-",
+			Namespace:       replicaSet.Namespace,
+			Labels:          replicaSet.Labels,
+			OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(replicaSet, appsv1.SchemeGroupVersion.WithKind("ReplicaSet"))},
 		},
 		Spec: corev1.PodSpec{
 			Containers: []corev1.Container{{
```

---

### Incident Patch 15: `96700316` (2026-09-18)
**Commit Message**: Fix default cluster output depending on vali enabled flag (#15562)

* Move default cluster output to fluent bit custom resources

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Remove unused isValiEnabled bool flag

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Fix test

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Remove redundant valiEnabled variable

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Rename custom resource

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

* Rename journald cluster output

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

---------

Signed-off-by: TeodorDichev <[REDACTED_EMAIL]>

**File**: `pkg/component/observability/logging/fluentbit/fluentbit.go` (modified, +0/-6)
```diff
@@ -55,8 +55,6 @@ type Values struct {
 	Image string
 	// InitContainerImage is the fluent-bit init container image.
 	InitContainerImage string
-	// VailEnabled specifies whether vali is used and should be configured as a ClusterOutput.
-	ValiEnabled bool
 	// PriorityClassName is the name of the priority class of the fluent-bit.
 	PriorityClassName string
 }
@@ -287,10 +285,6 @@ func (f *fluentBit) Deploy(ctx context.Context) error {
 		prometheusRule,
 	}
 
-	if f.values.ValiEnabled {
-		resources = append(resources, fluentcustomresources.GetDefaultClusterOutput(getCustomResourcesLabels()))
-	}
-
 	for _, clusterInput := range fluentcustomresources.GetClusterInputs(getCustomResourcesLabels()) {
 		resources = append(resources, clusterInput)
 	}
```

**File**: `pkg/component/observability/logging/fluentbit/fluentbit_test.go` (modified, +1/-14)
```diff
@@ -42,7 +42,6 @@ var _ = Describe("Fluent Bit", func() {
 		values            = Values{
 			Image:              image,
 			InitContainerImage: image,
-			ValiEnabled:        true,
 			PriorityClassName:  priorityClassName,
 		}
 
@@ -275,7 +274,7 @@ var _ = Describe("Fluent Bit", func() {
 			Expect(c.Get(ctx, client.ObjectKeyFromObject(customResourcesManagedResourceSecret), customResourcesManagedResourceSecret)).To(Succeed())
 			manifests, err := test.ExtractManifestsFromManagedResourceData(customResourcesManagedResourceSecret.Data)
 			Expect(err).NotTo(HaveOccurred())
-			Expect(manifests).To(HaveLen(12))
+			Expect(manifests).To(HaveLen(11))
 			Expect(customResourcesManagedResourceSecret.Type).To(Equal(corev1.SecretTypeOpaque))
 			Expect(customResourcesManagedResourceSecret.Immutable).To(Equal(new(true)))
 			Expect(customResourcesManagedResourceSecret.Labels["resources.gardener.cloud/garbage-collectable-reference"]).To(Equal("true"))
@@ -288,21 +287,9 @@ var _ = Describe("Fluent Bit", func() {
 			test.ExpectKindWithNameAndNamespace(manifests, "ClusterFilter", "02-add-tag-to-record", "")
 			test.ExpectKindWithNameAndNamespace(manifests, "ClusterFilter", "zz-modify-severity", "")
 			test.ExpectKindWithNameAndNamespace(manifests, "ClusterParser", "containerd-parser", "")
-			test.ExpectKindWithNameAndNamespace(manifests, "ClusterOutput", "systemd", "")
 
 			componenttest.PrometheusRule(prometheusRule, "testdata/fluent-bit.prometheusrule.test.yaml")
 		})
-
-		Context("with vali disabled", func() {
-			JustBeforeEach(func() {
-				values.ValiEnabled = false
-			})
-			It("should not deploy vali ClusterOutputs", func() {
-				Expect(component.Deploy(ctx)).To(Succeed())
-				Expect(customResourcesManagedResourceSecret.Data).NotTo(HaveKey("clusteroutput____systemd.yaml"))
-			})
-
-		})
 	})
 
 	Describe("#Destroy", func() {
```

**File**: `pkg/component/observability/logging/fluentcustomresources/cluster_outputs.go` (modified, +2/-2)
```diff
@@ -17,8 +17,8 @@ import (
 
 const (
 	// Output names
-	outputNameJournald      = "journald"
-	outputNameSystemd       = "systemd"
+	outputNameJournald      = "journald-default"
+	outputNameSystemd       = "systemd-default"
 	outputNameVali          = "gardener-vali"
 	outputNameOpenTelemetry = "opentelemetry"
 	outputNameStaticVali    = "static-vali"
```

**File**: `pkg/component/observability/logging/fluentcustomresources/cluster_outputs_test.go` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ var _ = Describe("Logging", func() {
 			Expect(fluentBitClusterOutputs).To(Equal(
 				&fluentbitv1alpha2.ClusterOutput{
 					ObjectMeta: metav1.ObjectMeta{
-						Name:   "systemd",
+						Name:   "systemd-default",
 						Labels: labels,
 					},
 					Spec: fluentbitv1alpha2.OutputSpec{
```

**File**: `pkg/component/shared/fluent_bit.go` (modified, +0/-2)
```diff
@@ -21,7 +21,6 @@ func NewFluentBit(
 	c client.Client,
 	gardenNamespaceName string,
 	enabled bool,
-	valiEnabled bool,
 	priorityClassName string,
 ) (
 	deployer component.DeployWaiter,
@@ -43,7 +42,6 @@ func NewFluentBit(
 		fluentbit.Values{
 			Image:              fluentBitImage.String(),
 			InitContainerImage: fluentBitInitImageName,
-			ValiEnabled:        valiEnabled,
 			PriorityClassName:  priorityClassName,
 		},
 	)
```

**File**: `pkg/component/shared/fluent_custom_resources.go` (modified, +1/-6)
```diff
@@ -19,7 +19,7 @@ func NewFluentOperatorCustomResources(
 	enabled bool,
 	suffix string,
 	centralLoggingConfigurations []component.CentralLoggingConfiguration,
-	output *fluentbitv1alpha2.ClusterOutput,
+	outputs []*fluentbitv1alpha2.ClusterOutput,
 ) (
 	deployer component.DeployWaiter,
 	err error,
@@ -28,7 +28,6 @@ func NewFluentOperatorCustomResources(
 		inputs  []*fluentbitv1alpha2.ClusterInput
 		filters []*fluentbitv1alpha2.ClusterFilter
 		parsers []*fluentbitv1alpha2.ClusterParser
-		outputs []*fluentbitv1alpha2.ClusterOutput
 	)
 
 	// Fetch component specific logging configurations
@@ -51,10 +50,6 @@ func NewFluentOperatorCustomResources(
 		}
 	}
 
-	if output != nil {
-		outputs = append(outputs, output)
-	}
-
 	deployer = fluentcustomresources.New(
 		c,
 		gardenNamespaceName,
```

**File**: `pkg/gardenlet/controller/seed/seed/components.go` (modified, +4/-4)
```diff
@@ -873,9 +873,10 @@ func (r *Reconciler) newFluentCustomResources(seedIsGarden bool) (deployer compo
 		centralLoggingConfigurations = append(centralLoggingConfigurations, eventlogger.CentralLoggingConfiguration)
 	}
 
-	var output *fluentbitv1alpha2.ClusterOutput
+	var outputs []*fluentbitv1alpha2.ClusterOutput
 	if gardenlethelper.IsValiEnabled(&r.Config) || features.DefaultFeatureGate.Enabled(features.OpenTelemetryCollector) {
-		output = fluentcustomresources.GetDynamicClusterOutput(map[string]string{v1beta1constants.LabelKeyCustomLoggingResource: v1beta1constants.LabelValueCustomLoggingResource})
+		outputs = append(outputs, fluentcustomresources.GetDynamicClusterOutput(map[string]string{v1beta1constants.LabelKeyCustomLoggingResource: v1beta1constants.LabelValueCustomLoggingResource}))
+		outputs = append(outputs, fluentcustomresources.GetDefaultClusterOutput(map[string]string{v1beta1constants.LabelKeyCustomLoggingResource: v1beta1constants.LabelValueCustomLoggingResource}))
 	}
 
 	return sharedcomponent.NewFluentOperatorCustomResources(
@@ -884,7 +885,7 @@ func (r *Reconciler) newFluentCustomResources(seedIsGarden bool) (deployer compo
 		gardenlethelper.IsLoggingEnabled(&r.Config),
 		"",
 		centralLoggingConfigurations,
-		output,
+		outputs,
 	)
 }
 
@@ -1024,7 +1025,6 @@ func (r *Reconciler) newFluentBit() (component.DeployWaiter, error) {
 		r.SeedClientSet.Client(),
 		r.GardenNamespace,
 		gardenlethelper.IsLoggingEnabled(&r.Config),
-		gardenlethelper.IsValiEnabled(&r.Config),
 		v1beta1constants.PriorityClassNameSeedSystem600,
 	)
 }
```

**File**: `pkg/operator/controller/garden/garden/components.go` (modified, +8/-4)
```diff
@@ -13,6 +13,7 @@ import (
 	"time"
 
 	"github.com/Masterminds/semver/v3"
+	fluentbitv1alpha2 "github.com/fluent/fluent-operator/v3/apis/fluentbit/v1alpha2"
 	"github.com/go-logr/logr"
 	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
 	monitoringv1alpha1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1alpha1"
@@ -1441,17 +1442,20 @@ func (r *Reconciler) newFluentBit() (component.DeployWaiter, error) {
 		r.RuntimeClientSet.Client(),
 		r.GardenNamespace,
 		true,
-		true,
 		v1beta1constants.PriorityClassNameGardenSystem100,
 	)
 }
 
 func (r *Reconciler) newFluentCustomResources() (component.DeployWaiter, error) {
 	customResourcesLabels := map[string]string{v1beta1constants.LabelKeyCustomLoggingResource: v1beta1constants.LabelValueCustomLoggingResource}
 
-	output := fluentcustomresources.GetStaticClusterOutput(customResourcesLabels)
+	// The gardener-operator has no option to disable logging, so the default output is always included.
+	outputs := []*fluentbitv1alpha2.ClusterOutput{fluentcustomresources.GetDefaultClusterOutput(customResourcesLabels)}
+
 	if features.DefaultFeatureGate.Enabled(features.OpenTelemetryCollector) {
-		output = fluentcustomresources.GetDynamicClusterOutput(customResourcesLabels)
+		outputs = append(outputs, fluentcustomresources.GetDynamicClusterOutput(customResourcesLabels))
+	} else {
+		outputs = append(outputs, fluentcustomresources.GetStaticClusterOutput(customResourcesLabels))
 	}
 
 	return sharedcomponent.NewFluentOperatorCustomResources(
@@ -1460,7 +1464,7 @@ func (r *Reconciler) newFluentCustomResources() (component.DeployWaiter, error)
 		true,
 		"-garden",
 		logging.GardenCentralLoggingConfigurations,
-		output,
+		outputs,
 	)
 }
 
```

#### Recent Merged Pull Requests:
- **PR #15884** (2026-10-04): Update module sigs.k8s.io/controller-runtime to v0.25.2 (@gardener-ci-robot)
- **PR #15883** (2026-10-03): Update module github.com/docker/cli to v29.8.2+incompatible (@gardener-ci-robot)
- **PR #15882** (2026-10-04): Replace `CEventually` with gomega's `Eventually` (@timebertt)
- **PR #15877** (2026-10-03): Update dependency envoyproxy/envoy to v1.39.2 (@gardener-ci-robot)
- **PR #15876** (2026-10-03): [release-v1.152] Increase time for `PersistenVolumeSizeMismatch` alert to `15m` (@gardener-ci-robot)
- **PR #15875** (2026-10-03): [release-v1.151] Increase time for `PersistenVolumeSizeMismatch` alert to `15m` (@gardener-ci-robot)
- **PR #15870** (closed): Fix remote `make seed-up` by making the dev-setup registry CA local-kind-only (@DockToFuture)
- **PR #15867** (2026-10-02): Improve gardener-node-agent lease error message (@etiennnr)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
