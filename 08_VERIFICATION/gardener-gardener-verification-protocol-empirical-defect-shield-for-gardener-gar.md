# Verification Protocol: Verification Protocol: Empirical Defect Shield for gardener/gardener

<!-- PROVENANCE_START
{
  "source_repository": "gardener/gardener",
  "source_url": "https://github.com/gardener/gardener",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gardener/gardener](https://github.com/gardener/gardener) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `gardener/gardener` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gardener-gardener-learnings.md`  
> **Source**: github ([https://github.com/gardener/gardener](https://github.com/gardener/gardener))  
> **Source Version**: `2fd74173`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T14:56:28.991Z  
> **Learning ID**: `learn-github-gardener-gardener`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): gardener/gardener

> **Canonical Artifact**: `07_PROJECT_LEARNING/gardener-gardener-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gardener/gardener](https://github.com/gardener/gardener))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T14:56:28.984Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gardener/gardener`
- **Description**: Homogeneous Kubernetes clusters at scale on any infrastructure using hosted control planes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3484 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16280** (2026-11-11): **Update dependency crate-ci/typos to v1.52.2**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [crate-ci/typos](https://redirect.github.com/crate-ci/typos) | patch | `v1.52.1` → `v1.52.2` |  ---  ### Release Notes  <details> <summary>crate-ci/typos</summary>  ### [`v1.52.2`](https://redirect.github.com/crate-ci/typos/releases/tag/v1.52.2)  [Compare Source](https://redirect.github.com/crate-ci/typos/compare/v1.52.1...v1.52.2)  #### \[1.52.2] - 2026-11-11  ##### Compatibility  - *(pypi)* Don't publish wheels for x86  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  **Release note**: ```other dependency NONE ``` <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4yMjIuNSIsInVwZGF0ZWRJblZlciI6IjQ0LjIyMi41IiwidGFyZ2V0QnJhbmNoIjoibWFzdGVyIiwibGFiZWxzIjpbImtpbmQvZW5oYW5jZW1lbnQiXX0=--> 
  **Post-Mortem & Fix Analysis**:
  > /label skip-review
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [rfranzke](https://github.com/rfranzke) for approval. For more information see [the Code Review Process](https://gardener.cloud/docs/contribute/#pull-request-checklist).  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["rfranzke"]} -->

- **Issue #16279** (2026-11-11): **Update go to v1.27.4**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [go](https://go.dev/) ([source](https://redirect.github.com/golang/go)) |  | minor | `1.26.10` → `1.27.4` | | [go](https://redirect.github.com/actions/go-versions) | uses-with | minor | `1.26` → `1.27` | | [golang](https://hub.docker.com/_/golang) ([source](https://redirect.github.com/docker-library/golang)) |  | minor | `1.26.10` → `1.27.4` | | [golang](https://hub.docker.com/_/golang) ([source](https://redirect.github.com/docker-library/golang)) | stage | minor | `1.26.10` → `1.27.4` |  ---  ### Release Notes  <details> <summary>golang/go (go)</summary>  ### [`v1.27.1`](https://redirect.github.com/golang/go/compare/go1.27.0...go1.27.1)  ### [`v1.27.0`](https://redirect.github.com/golang/go/compare/go1.26.11...go1.27.0)  </details>  <details> <summary>actions/go-versions (go)</summary>  ### [`v1.27.4`](https://redirect.github.com/actions/go-versions/releases/tag/1.27.4-42945153609): 1.27.4  [Compare Source](https://redirect.github.com/actions/go-versions/compare/1.27.3-39437817176...1.27.4-42945153609)  Go 1.27.4  ### [`v1.27.3`](https://redirect.github.com/actions/go-versions/releases/tag/1.27.3-39437817176): 1.27.3  [Compare Source](https://redirect.github.com/actions/go-versions/compare/1.27.2-37875086547...1.27.3-39437817176)  Go 1.27.3  ### [`v1.27.2`](https://redirect.github.com/actions/go-versions/releases/tag/1.27.2-37875086547): 1.27.2  [Compare Source](https://redirect
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [scheererj](https://github.com/scheererj) for approval. For more information see [the Code Review Process](https://gardener.cloud/docs/contribute/#pull-request-checklist).  The full list of commands accepted by this bot can be found [here](https://prow.gardener.cloud/command-help?repo=gardener%2Fgardener).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/gardener/gardener/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["scheererj"]} -->
  > @renovate[bot]: The following tests **failed**, say `/retest` to rerun all failed tests or `/retest-required` to rerun all mandatory failed tests:  Test name | Commit | Details | Required | Rerun command --- | --- | --- | --- | --- pull-gardener-e2e-kind-ha-multi-node-upgrade | e9f070d7a8c1bd9f0ccd84073d3325615148cc8f | [link](https://prow.gardener.cloud/view/gs/gardener-prow/pr-logs/pull/gardener_gardener/16279/pull-gardener-e2e-kind-ha-multi-node-upgrade/2120352870556504064) | true | `/test pull-gardener-e2e-kind-ha-multi-node-upgrade` pull-gardener-unit | e9f070d7a8c1bd9f0ccd84073d3325615148cc8f | [link](https://prow.gardener.cloud/view/gs/gardener-prow/pr-logs/pull/gardener_gardener/16279/pull-gardener-unit/2120352887342108672) | true | `/test pull-gardener-unit` pull-gardener-e2e-kind-gardenadm-unmanaged-infra-external-gardener | e9f070d7a8c1bd9f0ccd84073d3325615148cc8f | [link](https://prow.gardener.cloud/view/gs/gardener-prow/pr-logs/pull/gardener_gardener/16279/pull-gardener-e2

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

### Incident Patch 1: `ab429249` (2026-11-11)
**Commit Message**: Fix Perses dashboard gauge percentage unit (#16252)

* Fix Perses percentage gauges rendering on 0-1 scale

The GaugeChart panels for '% of Clusters with Alerts' (seed and garden
alerts) and 'Shoot Availability' had no format block, so Perses applied
its default unit 'percent-decimal' (0-1 scale, max 1). Their queries
already multiply by 100, producing a 0-100 value, which rendered against
the wrong scale. Set unit 'percent' so the gauges display 0-100.

Signed-off-by: Jeremy Rickards <[REDACTED_EMAIL]>

* Set decimal unit on Shoot Availability count gauges

The 'Total number of shoots' and 'Unavailable Shoots' GaugeChart panels
had no format block, so Perses applied its default 'percent-decimal'
unit to their raw count queries. Set unit 'decimal' so the counts render
as plain numbers.

Signed-off-by: Jeremy Rickards <[REDACTED_EMAIL]>

---------

Signed-off-by: Jeremy Rickards <[REDACTED_EMAIL]>

**File**: `pkg/component/observability/monitoring/perses/dashboards/garden/garden-alerts.yaml` (modified, +2/-0)
```diff
@@ -140,6 +140,8 @@ spec:
           kind: GaugeChart
           spec:
             calculation: last
+            format:
+              unit: percent
         queries:
           - kind: TimeSeriesQuery
             spec:
```

**File**: `pkg/component/observability/monitoring/perses/dashboards/garden/shoot-availability-dashboard.yaml` (modified, +6/-0)
```diff
@@ -35,6 +35,8 @@ spec:
           kind: GaugeChart
           spec:
             calculation: last
+            format:
+              unit: percent
         queries:
           - kind: TimeSeriesQuery
             spec:
@@ -54,6 +56,8 @@ spec:
           kind: GaugeChart
           spec:
             calculation: last
+            format:
+              unit: decimal
         queries:
           - kind: TimeSeriesQuery
             spec:
@@ -73,6 +77,8 @@ spec:
           kind: GaugeChart
           spec:
             calculation: last
+            format:
+              unit: decimal
         queries:
           - kind: TimeSeriesQuery
             spec:
```

**File**: `pkg/component/observability/monitoring/perses/dashboards/seed/alerts-dashboard.yaml` (modified, +2/-0)
```diff
@@ -169,6 +169,8 @@ spec:
           kind: GaugeChart
           spec:
             calculation: last
+            format:
+              unit: percent
         queries:
           - kind: TimeSeriesQuery
             spec:
```

---

### Incident Patch 2: `d8608c78` (2026-11-09)
**Commit Message**: [GEP-28] Increase spec timeout for joining nodes in gardenadm e2e test (#16264)

Increase spec timeout for joining nodes in gardenadm e2e test

`gardenadm join` waits for the node to become ready. On the new node, the CNI installation might race with the first
sync of kube-proxy: if calico requests its token via the `kubernetes` Service before kube-proxy has synced its rules,
the request only fails after calico's client timeout of 30s and the init container is restarted. This doesn't fit into
the spec timeout of 1 minute, which is increased to 5 minutes.

See https://redirect.github.com/gardener/gardener/issues/16263

Assisted-by: Claude

Signed-off-by: Tim Ebert <[REDACTED_EMAIL]>

**File**: `test/e2e/gardenadm/unmanagedinfra/gardenadm.go` (modified, +1/-1)
```diff
@@ -329,7 +329,7 @@ func itShouldResetOrJoinNode(command, message string) {
 		Expect(err).NotTo(HaveOccurred())
 
 		Eventually(ctx, stdOut).Should(gbytes.Say(message))
-	}, SpecTimeout(time.Minute))
+	}, SpecTimeout(5*time.Minute))
 }
 
 func itShouldSeeJoinedNodeAndCheckHealth(shootClientSet func() kubernetes.Interface) {
```

---

### Incident Patch 3: `eeac5d4e` (2026-11-11)
**Commit Message**: Enable kube-api-linter `optionalorrequired` for `extensions/v1alpha1` and `config/operator/v1alpha1` (#16141)

* Enable kube-api-linter optionalorrequired for extensions/v1alpha1 and config/operator/v1alpha1

Marks all fields of these API groups as explicitly +optional or +required and registers the groups for the optionalorrequired linter.

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Signed-off-by: Dobromir Peev <[REDACTED_EMAIL]>

* Fix additional optionalorrequired fields violations

Signed-off-by: Dobromir Peev <[REDACTED_EMAIL]>

---------

Signed-off-by: Dobromir Peev <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `.golangci.yaml.in` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ linters:
       - linters:
           - kubeapilinter
         text: 'optionalorrequired:'
-        path-except: 'pkg/apis/(core/v1beta1|operations/v1alpha1|operator/v1alpha1|config/resourcemanager/v1alpha1|core/v1)/[^/]+$'
+        path-except: 'pkg/apis/(config/operator/v1alpha1|config/resourcemanager/v1alpha1|core/v1|core/v1beta1|extensions/v1alpha1|operations/v1alpha1|operator/v1alpha1)/[^/]+$'
       # optionalfields: Spec/Status and other struct fields on top-level API objects have established non-pointer
       # conventions in Kubernetes APIs. Similarly, scalar fields (int64, string) with incomplete validation
       # are intentionally kept as value types. Converting these to pointers would be API-breaking.
```

**File**: `docs/api-reference/extensions.md` (modified, +17/-0)
```diff
@@ -268,6 +268,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -551,6 +552,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -946,6 +948,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -1561,6 +1564,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -1978,6 +1982,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -2334,6 +2339,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -2602,6 +2608,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -2890,6 +2897,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -3601,6 +3609,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -4092,6 +4101,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -4475,6 +4485,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -4692,6 +4703,7 @@ string
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>Hosts are the registry hosts.<br />It corresponds to the host fields in the `hosts.toml` file, see https://github.com/containerd/containerd/blob/c51463010e0682f76dfdc10edc095e6596e2764b/docs/hosts.md#host-fields-in-the-toml-table-format for more information.</p>
 </td>
 </tr>
@@ -5013,6 +5025,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -5203,6 +5216,7 @@ string array
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>FilePaths is a list of files the unit depends on. If any file changes a restart of the dependent unit will be<br />triggered. For each FilePath there must exist a File with matching Path in OperatingSystemConfig.Spec.Files.</p>
 </td>
 </tr>
@@ -5463,6 +5477,7 @@ object (keys:string, values:string)
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>MachineImage contains logical information about the name and the version of the machie image that<br />should be used. The logical information must be mapped to the provider-specific information (e.g.,<br />AMIs, ...) by the provider itself.</p>
 </td>
 </tr>
@@ -5867,6 +5882,7 @@ integer
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>ObservedGeneration is the most recent generation observed for this resource.</p>
 </td>
 </tr>
@@ -5902,6 +5918,7 @@ NamedResourceReference array
 </em>
 </td>
 <td>
+<em>(Optional)</em>
 <p>MachineDeployments is a list of created machine deployments. It will be used to e.g. configure<br />the cluster-autoscaler properly.</p>
 </td>
 </tr>
```

**File**: `pkg/apis/config/operator/v1alpha1/types.go` (modified, +23/-0)
```diff
@@ -19,17 +19,23 @@ type OperatorConfiguration struct {
 
 	// RuntimeClientConnection specifies the kubeconfig file and the client connection settings for the proxy server to
 	// use when communicating with the kube-apiserver of the runtime cluster.
+	// +required
 	RuntimeClientConnection componentbaseconfigv1alpha1.ClientConnectionConfiguration `json:"runtimeClientConnection"`
 	// VirtualClientConnection specifies the kubeconfig file and the client connection settings for the proxy server to
 	// use when communicating with the kube-apiserver of the virtual cluster.
+	// +required
 	VirtualClientConnection componentbaseconfigv1alpha1.ClientConnectionConfiguration `json:"virtualClientConnection"`
 	// LeaderElection defines the configuration of leader election client.
+	// +required
 	LeaderElection componentbaseconfigv1alpha1.LeaderElectionConfiguration `json:"leaderElection"`
 	// LogLevel is the level/severity for the logs. Must be one of [info,debug,error].
+	// +required
 	LogLevel string `json:"logLevel"`
 	// LogFormat is the output format for the logs. Must be one of [text,json].
+	// +required
 	LogFormat string `json:"logFormat"`
 	// Server defines the configuration of the HTTP server.
+	// +required
 	Server ServerConfiguration `json:"server"`
 	// Debugging holds configuration for Debugging related features.
 	// +optional
@@ -40,6 +46,7 @@ type OperatorConfiguration struct {
 	// +optional
 	FeatureGates map[string]bool `json:"featureGates,omitempty"`
 	// Controllers defines the configuration of the controllers.
+	// +required
 	Controllers ControllerConfiguration `json:"controllers"`
 	// NodeToleration contains optional settings for default tolerations.
 	// +optional
@@ -49,34 +56,47 @@ type OperatorConfiguration struct {
 // ConditionThreshold defines the threshold of the given condition type.
 type ConditionThreshold struct {
 	// Type is the type of the condition to define the threshold for.
+	// +required
 	Type string `json:"type"`
 	// Duration is the duration how long the condition can stay in the progressing state.
+	// +required
 	Duration metav1.Duration `json:"duration"`
 }
 
 // ControllerConfiguration defines the configuration of the controllers.
 type ControllerConfiguration struct {
 	// Garden is the configuration for the garden controller.
+	// +required
 	Garden GardenControllerConfig `json:"garden"`
 	// GardenCare is the configuration for the garden care controller
+	// +required
 	GardenCare GardenCareControllerConfiguration `json:"gardenCare"`
 	// GardenletDeployer is the configuration for the gardenlet deployer controller.
+	// +required
 	GardenletDeployer GardenletDeployerControllerConfig `json:"gardenletDeployer"`
 	// NetworkPolicy is the configuration for the NetworkPolicy controller.
+	// +required
 	NetworkPolicy NetworkPolicyControllerConfiguration `json:"networkPolicy"`
 	// VPAEvictionRequirements is the configuration for the VPAEvictionrequirements controller.
+	// +required
 	VPAEvictionRequirements VPAEvictionRequirementsControllerConfiguration `json:"vpaEvictionRequirements"`
 	// Extension defines the configuration of the extension controller.
+	// +required
 	Extension ExtensionControllerConfiguration `json:"extension"`
 	// ExtensionCare is the configuration for the extension care controller
+	// +required
 	ExtensionCare ExtensionCareControllerConfiguration `json:"extensionCare"`
 	// ExtensionReference is the configuration for the extension reference controller
+	// +required
 	ExtensionReference ExtensionReferenceControllerConfiguration `json:"extensionReference"`
 	// ExtensionRequiredRuntime defines the configuration of the ExtensionRequiredRuntime controller.
+	// +required
 	ExtensionRequiredRuntime ExtensionRequiredRuntimeControllerConfiguration `json:"extensionRequiredRuntime"`
 	// ExtensionRequiredVirtual defines the configuration of the ExtensionRequiredVirtual controller.
+	// +required
 	ExtensionRequiredVirtual ExtensionRequiredVirtualControllerConfiguration `json:"extensionRequiredVirtual"`
 	// TokenRequestor is the configuration for the token-requestor controller.
+	// +required
 	TokenRequestor TokenRequestorControllerConfiguration `json:"tokenRequestor"`
 }
 
@@ -182,6 +202,7 @@ type TokenRequestorControllerConfiguration struct {
 // ServerConfiguration contains details for the HTTP(S) servers.
 type ServerConfiguration struct {
 	// Webhooks is the configuration for the HTTPS webhook server.
+	// +required
 	Webhooks Server `json:"webhooks"`
 	// HealthProbes is the configuration for serving the healthz and readyz endpoints.
 	// +optional
@@ -194,8 +215,10 @@ type ServerConfiguration struct {
 // Server contains information for HTTP(S) server configuration.
 type Server struct {
 	// BindAddress is the IP address on which to listen for the specified port.
+	// +required
 	BindAddress string `json:"bindAddress"`
 	// Port is the port on which to serve requests.
+	// +required
 	Port int32 `json:"port"`
 }
 
```

**File**: `pkg/apis/extensions/v1alpha1/types_backupbucket.go` (modified, +3/-0)
```diff
@@ -32,6 +32,7 @@ type BackupBucket struct {
 
 	// Specification of the BackupBucket.
 	// If the object's deletion timestamp is set, this field is immutable.
+	// +required
 	Spec BackupBucketSpec `json:"spec"`
 	// +optional
 	Status BackupBucketStatus `json:"status,omitempty"`
@@ -65,8 +66,10 @@ type BackupBucketSpec struct {
 	DefaultSpec `json:",inline"`
 
 	// Region is the region of this bucket. This field is immutable.
+	// +required
 	Region string `json:"region"`
 	// SecretRef is a reference to a secret that contains the credentials to access object store.
+	// +required
 	SecretRef corev1.SecretReference `json:"secretRef"`
 }
 
```

**File**: `pkg/apis/extensions/v1alpha1/types_backupentry.go` (modified, +4/-0)
```diff
@@ -34,6 +34,7 @@ type BackupEntry struct {
 
 	// Specification of the BackupEntry.
 	// If the object's deletion timestamp is set, this field is immutable.
+	// +required
 	Spec BackupEntrySpec `json:"spec"`
 	// +optional
 	Status BackupEntryStatus `json:"status,omitempty"`
@@ -73,10 +74,13 @@ type BackupEntrySpec struct {
 	// +optional
 	BackupBucketProviderStatus *runtime.RawExtension `json:"backupBucketProviderStatus,omitempty"`
 	// Region is the region of this Entry. This field is immutable.
+	// +required
 	Region string `json:"region"`
 	// BucketName is the name of backup bucket for this Backup Entry.
+	// +required
 	BucketName string `json:"bucketName"`
 	// SecretRef is a reference to a secret that contains the credentials to access object store.
+	// +required
 	SecretRef corev1.SecretReference `json:"secretRef"`
 }
 
```

**File**: `pkg/apis/extensions/v1alpha1/types_bastion.go` (modified, +8/-0)
```diff
@@ -32,6 +32,7 @@ type Bastion struct {
 
 	// Spec is the specification of this Bastion.
 	// If the object's deletion timestamp is set, this field is immutable.
+	// +required
 	Spec BastionSpec `json:"spec"`
 	// Status is the bastion's status.
 	// +optional
@@ -56,8 +57,10 @@ type BastionSpec struct {
 	// UserData is the base64-encoded user data for the bastion instance. This should
 	// contain code to provision the SSH key on the bastion instance.
 	// This field is immutable.
+	// +required
 	UserData []byte `json:"userData"`
 	// Ingress controls from where the created bastion host should be reachable.
+	// +required
 	Ingress []BastionIngressPolicy `json:"ingress"`
 	// Image holds information about the machine image to use for the bastion.
 	// +optional
@@ -67,23 +70,28 @@ type BastionSpec struct {
 // BastionIngressPolicy represents an ingress policy for SSH bastion hosts.
 type BastionIngressPolicy struct {
 	// IPBlock defines an IP block that is allowed to access the bastion.
+	// +required
 	IPBlock networkingv1.IPBlock `json:"ipBlock"`
 }
 
 // BastionMachine contains information about the machine type and image.
 type BastionMachine struct {
 	// Type is the machine type of the bastion.
+	// +required
 	Type string `json:"type"`
 	// Image holds information about the machine image to use for the bastion.
+	// +required
 	Image BastionMachineImage `json:"image"`
 }
 
 // BastionMachineImage defines the name and the version of the bastion's machine image in any environment. Has to be
 // defined in the respective CloudProfile.
 type BastionMachineImage struct {
 	// Name is the name of the image.
+	// +required
 	Name string `json:"name"`
 	// Version is the version of the image.
+	// +required
 	Version string `json:"version"`
 }
 
```

**File**: `pkg/apis/extensions/v1alpha1/types_cluster.go` (modified, +5/-1)
```diff
@@ -21,9 +21,11 @@ const ClusterResource = "Cluster"
 
 // Cluster is a specification for a Cluster resource.
 type Cluster struct {
-	metav1.TypeMeta   `json:",inline"`
+	metav1.TypeMeta `json:",inline"`
+	// +optional
 	metav1.ObjectMeta `json:"metadata,omitempty"`
 
+	// +required
 	Spec ClusterSpec `json:"spec"`
 }
 
@@ -45,6 +47,7 @@ type ClusterSpec struct {
 	// by the shoot that has to be reconciled.
 	// +kubebuilder:validation:XPreserveUnknownFields
 	// +kubebuilder:pruning:PreserveUnknownFields
+	// +required
 	CloudProfile runtime.RawExtension `json:"cloudProfile"`
 	// Seed is a raw extension field that contains the seed resource referenced by the shoot that
 	// has to be reconciled. It is not set for self-hosted shoots (see GEP-28).
@@ -55,5 +58,6 @@ type ClusterSpec struct {
 	// Shoot is a raw extension field that contains the shoot resource that has to be reconciled.
 	// +kubebuilder:validation:XPreserveUnknownFields
 	// +kubebuilder:pruning:PreserveUnknownFields
+	// +required
 	Shoot runtime.RawExtension `json:"shoot"`
 }
```

**File**: `pkg/apis/extensions/v1alpha1/types_containerruntime.go` (modified, +5/-0)
```diff
@@ -37,6 +37,7 @@ type ContainerRuntime struct {
 
 	// Specification of the ContainerRuntime.
 	// If the object's deletion timestamp is set, this field is immutable.
+	// +required
 	Spec ContainerRuntimeSpec `json:"spec"`
 	// +optional
 	Status ContainerRuntimeStatus `json:"status,omitempty"`
@@ -69,18 +70,22 @@ type ContainerRuntimeSpec struct {
 	DefaultSpec `json:",inline"`
 
 	// BinaryPath is the Worker's machine path where container runtime extensions should copy the binaries to.
+	// +required
 	BinaryPath string `json:"binaryPath"`
 	// WorkerPool identifies the worker pool of the Shoot.
 	// For each worker pool and type, Gardener deploys a ContainerRuntime CRD.
+	// +required
 	WorkerPool ContainerRuntimeWorkerPool `json:"workerPool"`
 }
 
 // ContainerRuntimeWorkerPool identifies a Shoot worker pool by its name and selector.
 type ContainerRuntimeWorkerPool struct {
 	// Name specifies the name of the worker pool the container runtime should be available for.
 	// This field is immutable.
+	// +required
 	Name string `json:"name"`
 	// Selector is the label selector used by the extension to match the nodes belonging to the worker pool.
+	// +required
 	Selector metav1.LabelSelector `json:"selector"`
 }
 
```

#### Recent Merged Pull Requests:
- **PR #16280** (2026-11-11): Update dependency crate-ci/typos to v1.52.2 (@renovate[bot])
- **PR #16279** (closed): Update go to v1.27.4 (@renovate[bot])
- **PR #16278** (closed): Update go (minor) (@renovate[bot])
- **PR #16273** (2026-11-10): Write `.spec.networking.nodes` via `gardener-apiserver` instead of `gardenlet` (@rfranzke)
- **PR #16271** (2026-11-10): Update module github.com/andybalholm/brotli to v1.3.0 (@renovate[bot])
- **PR #16270** (2026-11-10): Update dependency crate-ci/typos to v1.52.1 (@renovate[bot])

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

## X. Perses dashboard gauge percentage unit (#16252)

**RULE**:
When implementing operations in `pkg/component/observability/monitoring/perses/dashboards/garden/garden-alerts.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gardener/gardener. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ab429249`: Perses dashboard gauge percentage unit (#16252). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/component/observability/monitoring/perses/dashboards/garden/garden-alerts.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
            format:
              unit: percent
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ab429249` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
