# Forensic Learning Record (Deep Inspection): flux-iac/tofu-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/flux-iac-tofu-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/flux-iac/tofu-controller](https://github.com/flux-iac/tofu-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:59:47.928Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flux-iac/tofu-controller`
- **Description**: A GitOps OpenTofu and Terraform controller for Flux
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1704 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/plan/gzip.go`
```
package plan

import (
	"bytes"
	"compress/gzip"
	"io"
)

func GzipEncode(tfplan []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)

	_, err := w.Write(tfplan)
	if err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func GzipDecode(encodedPlan []byte) ([]byte, error) {
	re := bytes.NewReader(encodedPlan)

	gr, err := gzip.NewReader(re)
	if err != nil {
		return nil, err
	}

	o, err := io.ReadAll(gr)
	if err != nil {
		return nil, err
	}

	if err = gr.Close(); err != nil {
		return nil, err
	}

	return o, nil
}

```

### Core Architecture Module: `api/plan/plan.go`
```
package plan

import (
	"crypto/sha256"
	"fmt"
	"strconv"

	infrav1 "github.com/flux-iac/tofu-controller/api/v1alpha2"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

const (
	// Kubernetes Label names associated with Terraform Plans
	TFPlanNameLabel      = "infra.contrib.fluxcd.io/plan-name"
	TFPlanWorkspaceLabel = "infra.contrib.fluxcd.io/plan-workspace"

	// Kubernetes Annotation names associated with Terraform Plans
	TFPlanFullNameAnnotation      = "infra.contrib.fluxcd.io/plan-full-name"
	TFPlanFullWorkspaceAnnotation = "infra.contrib.fluxcd.io/plan-full-workspace"
	TFPlanChunkAnnotation         = "infra.contrib.fluxcd.io/plan-chunk"
	TFPlanHashAnnotation          = "infra.contrib.fluxcd.io/plan-hash"
	TFPlanSavedAnnotation         = "savedPlan"

	TFPlanName = "tfplan"

	// resourceDataMaxSizeBytes defines the maximum size of data
	// that can be stored in a Kubernetes Secret or ConfigMap
	resourceDataMaxSizeBytes = 1 * 1024 * 1024 // 1MB
)

// SafeLabelValue returns a string that is safe to use as a Kubernetes label value.
func SafeLabelValue(value string) string {
	// Values that are equal to or less than 63 characters are already good
	if len(value) <= 63 {
		return value
	}

	// Create haash
	checksum := sha256.Sum256([]byte(value))

	// Build a prefix to append to end of truncated value
	checksumPrefix := fmt.Sprintf("-%x", checksum[:8])

	prefix := value[:63-len(checksumPrefix)]

	return prefix + checksumPrefix
}

type Plan struct {
	name      string
	namespace string
	workspace string
	uuid      string
	planID    string

	bytes []byte
}

// NewFromBytes create a new Plan from bytes, while enforcing the maximum size restriction.
func NewFromBytes(name string, namespace string, workspace string, uuid string, planID string, bytes []byte) (*Plan, error) {
	return &Plan{
		name:      name,
		namespace: namespace,
		workspace: workspace,
		uuid:      uuid,
		planID:    planID,
		bytes:     bytes,
	}, nil
}

// NewFromSecrets reconstructs a Plan from a set of Kubernetes Secrets.
func NewFromSecrets(name string, namespace string, uuid string, secrets []v1.Secret) (*Plan, error) {
	// To store the individual plan chunks by index
	chunkMap := make(map[int][]byte)

	var workspaceName, planID string

	for _, secret := range secrets {
		planStr, ok := secret.Data["tfplan"]
		if !ok {
			return nil, fmt.Errorf("secret %s missing key tfplan", secret.Name)
		}

		// Grab the chunk index from the secret annotation
		chunkIndex := 0
		if idxStr, ok := secret.Annotations[TFPlanChunkAnnotation]; ok && idxStr != "" {
			var err error
			chunkIndex, err = strconv.Atoi(idxStr)
			if err != nil {
				return nil, fmt.Errorf("invalid chunk index annotation found on secret %s: %s", secret.Name, err)
			}
		}

		// Attempt to get the workspace name from the annotation first (which we don't truncate),
		// but then fallback to label if it is not found.
		workspaceName, ok = secret.Annotations[TFPlanFullWorkspaceAnnotation]
		if !ok {
			workspaceName, ok = secret.Labels[TFPlanWorkspaceLabel]
			if !ok {
				return nil, fmt.Errorf("missing plan workspace label and annotation on secret %s", secret.Name)
			}
		}

		planID, ok = secret.Annotations[TFPlanSavedAnnotation]
		if !ok {
			return nil, fmt.Errorf("missing plan ID annotation on secret %s", secret.Name)
		}

		chunkMap[chunkIndex] = planStr
	}

	var planBytes []byte

	// we know the number of chunks we "should" have, so work
	// up til there checking we have each chunk
	for i := 0; i < len(chunkMap); i++ {
		chunk, ok := chunkMap[i]
		if !ok {
			return nil, fmt.Errorf("missing chunk %d for terraform %s", i, name)
		}
		planBytes = append(planBytes, chunk...)
	}

	data, err := GzipDecode(planBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decode plan for resources %s: %s", name, err)
	}

	return &Plan{
		name:      name,
		namespace: namespace,
		workspace: workspaceName,
		uuid:      uuid,
		planID:    planID,
		bytes:     data,
	}, nil
}

// NewFromConfigMaps reconstructs a Plan from a set of Kubernetes ConfigMaps.
func NewFromConfigMaps(name string, namespace string, uuid string, configmaps []v1.ConfigMap) (*Plan, error) {
	// To store the individual plan chunks by index
	chunkMap := make(map[int]string)

	var workspaceName, planID string

	for _, configmap := range configmaps {
		planStr, ok := configmap.Data["tfplan"]
		if !ok {
			return nil, fmt.Errorf("configmap %s missing key tfplan", configmap.Name)
		}

		// Grab the chunk index from the configmap annotation
		chunkIndex := 0
		if idxStr, ok := configmap.Annotations[TFPlanChunkAnnotation]; ok && idxStr != "" {
			var err error
			chunkIndex, err = strconv.Atoi(idxStr)
			if err != nil {
				return nil, fmt.Errorf("invalid chunk index annotation found on configmap %s: %s", configmap.Name, err)
			}
		}

		// Attempt to get the workspace name from the annotation first (which we don't truncate),
		// but then fallback to label if it is not found.
		workspaceName, ok = configmap.Annotations[TFPlanFullWorkspaceAnnotation]
		if !ok {
			workspaceName, ok = configmap.Labels[TFPlanWorkspaceLabel]
			if !ok {
				return nil, fmt.Errorf("missing plan workspace label and annotation on configmap %s", configmap.Name)
			}
		}

		planID, ok = configmap.Annotations[TFPlanSavedAnnotation]
		if !ok {
			return nil, fmt.Errorf("missing plan ID annotation on secret %s", configmap.Name)
		}

		chunkMap[chunkIndex] = planStr
	}

	var planBytes []byte

	// we know the number of chunks we "should" have, so work
	// up til there checking we have each chunk
	for i := 0; i < len(chunkMap); i++ {
		chunk, ok := chunkMap[i]
		if !ok {
			return nil, fmt.Errorf("missing chunk %d for terraform %s", i, name)
		}
		planBytes = append(planBytes, chunk...)
	}

	return &Plan{
		name:      name,
		namespace: namespace,
		workspace: workspaceName,
		uuid:      uuid,
		planID:    planID,
		bytes:     planBytes,
	}, nil
}

// ToSecret converts a Terraform Plan into a (set of) Kubernetes Secret(s).
func (p *Plan) ToSecret(suffix string) ([]*v1.Secret, error) {
	// Build a standard name prefix for the secrets
	secretIdentifier := fmt.Sprintf("tfplan-%s-%s", p.workspace, p.name+suffix)

	encoded, err := GzipEncode(p.bytes)
	if err != nil {
		return nil, fmt.Errorf("unable to gzip encode the plan: %s", err)
	}

	// Check whether the Plan is large enough to be split into multiple secrets
	if len(encoded) <= resourceDataMaxSizeBytes {
		data := map[string][]byte{TFPlanName: encoded}

		// Build an individual secret containing the whole plan
		secret := &v1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretIdentifier,
				Namespace: p.namespace,
				Annotations: map[string]string{
					"encoding":                    "gzip",
					TFPlanFullNameAnnotation:      p.name + suffix,
					TFPlanFullWorkspaceAnnotation: p.workspace,
					TFPlanSavedAnnotation:         p.planID,
					TFPlanHashAnnotation:          fmt.Sprintf("%x", sha256.Sum256(p.bytes)),
				},
				Labels: map[string]string{
					TFPlanNameLabel:      SafeLabelValue(p.name + suffix),
					TFPlanWorkspaceLabel: SafeLabelValue(p.workspace),
				},
				OwnerReferences: []metav1.OwnerReference{
					{
						APIVersion: infrav1.GroupVersion.Group + "/" + infrav1.GroupVersion.Version,
						Kind:       infrav1.TerraformKind,
						Name:       p.name,
						UID:        types.UID(p.uuid),
					},
				},
			},
			Type: v1.SecretTypeOpaque,
			Data: data,
		}
		return []*v1.Secret{secret}, nil
	}

	numChunks := (uint64(len(encoded)) + resourceDataMaxSizeBytes - 1) / resourceDataMaxSizeBytes

	secrets := make([]*v1.Secret, 0, numChunks)

	for chunk := range numChunks {
		start := chunk * resourceDataMaxSizeBytes
		end := min(start+resourceDataMaxSizeBytes, uint64(len(encoded)))

		planData := encoded[start:end]

		data := map[string][]byte{TFPlanName: planData}

		secret := &v1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-%d", secretId
```

### Core Architecture Module: `api/planid/plain_id.go`
```
package planid

import (
	"fmt"
	"strings"
)

// getPlanIDv0 parses old revision format: master/b8e362c206e3d0cbb7ed22ced771a0056455a2fb
func getPlanIDv0(revision string) string {
	parts := strings.Split(revision, "/")
	if len(parts) != 2 {
		if len(revision) > 10 {
			hash := revision[:10]
			return "plan-" + hash
		}
		return "plan-" + revision
	}

	branch := parts[0]
	hash := parts[1]
	if len(hash) > 10 {
		hash = hash[:10]
	}

	planID := "plan-" + branch + "-" + hash
	return planID
}

// GetPlanID parses revision in ${branch}@${algo}:${hash}
// to plan ID is plan-${branch}-${hash 10 digits}
func GetPlanID(revision string) string {
	parts := strings.Split(revision, "@")
	if len(parts) != 2 {
		return getPlanIDv0(revision)
	}

	branch := parts[0]

	// parts[1] is now "${algo}:${hash}"
	hashParts := strings.Split(parts[1], ":")
	hash := hashParts[1]

	if len(hash) > 10 {
		hash = hash[:10]
	}

	planID := "plan-" + branch + "-" + hash
	return planID
}

func GetApproveMessage(planId string, message string) string {
	approveMessage := fmt.Sprintf("%s: set approvePlan: \"%s\" to approve this plan.", message, planId)
	return approveMessage
}

```

### Core Architecture Module: `api/typeinfo/type_info.go`
```
package typeinfo

const Suffix = "__type"

```

### Core Architecture Module: `api/v1alpha1/condition_types.go`
```
/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

// These constants are the Condition Types that the Terraform Resource works with
const (
	ConditionTypeApply       = "Apply"
	ConditionTypeHealthCheck = "HealthCheck"
	ConditionTypeOutput      = "Output"
	ConditionTypePlan        = "Plan"
	ConditionTypeStateLocked = "StateLocked"
)

const (
	// ArtifactFailedReason represents the fact that the artifact download
	// for the Teraform failed.
	ArtifactFailedReason = "ArtifactFailed"

	// DeletionBlockedByDependantsReason represents the fact that the
	// Terraform resource could not be deleted because there are
	// still resources depending on it.
	DeletionBlockedByDependants = "DeletionBlockedByDependantsReason"

	// DependencyNotReadyReason represents the fact that
	// one of the dependencies is not ready.
	DependencyNotReadyReason = "DependencyNotReady"

	// DriftDetectedReason represents the fact that drift was
	// detected during Terraform reconciliation.
	DriftDetectedReason = "DriftDetected"

	// DriftDetectionFailedReason represents the fact that
	// drift detection failed during reconciliation.
	DriftDetectionFailedReason = "DriftDetectionFailed"

	// HealthChecksPassedReason represents the fact that one or more
	// health checks failed during reconciliation.
	HealthChecksFailedReason = "HealthChecksFailed"

	// NoDriftReason represents the fact that during reconcilliation
	// no drift was detected.
	NoDriftReason = "NoDrift"

	// OutputsWritingFailedReason represents the fact that writing
	// outputs for the Terraform resource status failed.
	OutputsWritingFailedReason = "OutputsWritingFailed"

	// PlannedNoChangesReason represents the fact that Terraform
	// planned no changes during reconciliation.
	PlannedNoChangesReason = "TerraformPlannedNoChanges"

	// PlannedWithChangesReason represents the fact that Terraform
	// planned changes during reconciliation.
	PlannedWithChangesReason = "TerraformPlannedWithChanges"

	// PostPlanningWebhookFailedReason represents the fact that
	// the post-planning webhook failed during reconciliation.
	PostPlanningWebhookFailedReason = "PostPlanningWebhookFailed"

	// TFExecApplyFailedReason represents the fact that the execution
	// of 'terraform apply' failed.
	TFExecApplyFailedReason = "TFExecApplyFailed"

	// TFExecApplySucceedReason represents the fact that the execution
	// of 'terraform apply' succeeded.
	TFExecApplySucceedReason = "TerraformAppliedSucceed"

	// TFExecForceUnlockReason represents the fact that the controller
	// is attempting to force unlock the Terraform state.
	TFExecForceUnlockReason = "ForceUnlock"

	// TFExecInitFailedReason represents the fact that the an error
	// occured while initializing Terraform.
	TFExecInitFailedReason = "TFExecInitFailed"

	// TFExecLockHeldReason represents the fact that the Terraform
	// state lock is held by another process.
	TFExecLockHeldReason = "LockHeld"

	// TFExecNewFailedReason represents the fact that the creation
	// of the Terraform process failed.
	TFExecNewFailedReason = "TFExecNewFailed"

	// TFExecOutputFailedReason represents the fact that the execution
	// of 'terraform output' failed.
	TFExecOutputFailedReason = "TFExecOutputFailed"

	// TFExecPlanFailedReason represents the fact that the execution
	// of 'terraform plan' failed.
	TFExecPlanFailedReason = "TFExecPlanFailed"

	// TemplateGenerationFailedReason represents the fact that
	// the generation of the Terraform .tf template failed.
	TemplateGenerationFailedReason = "TemplateGenerationFailed"

	// VarsGenerationFailedReason represents the fact that
	// the generation of the Terraform variables failed.
	VarsGenerationFailedReason = "VarsGenerationFailed"

	// WorkspaceSelectFailedReason represents the fact that selecting
	// a Terraform workspace failed.
	WorkspaceSelectFailedReason = "SelectWorkspaceFailed"
)

```

### Core Architecture Module: `api/v1alpha1/doc.go`
```
/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// +kubebuilder:object:generate=true
// +groupName=infra.contrib.fluxcd.io
package v1alpha1

```

### Core Architecture Module: `api/v1alpha1/groupversion_info.go`
```
/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package v1alpha1 contains API Schema definitions for the infra v1alpha1 API group
//+kubebuilder:object:generate=true
//+groupName=infra.contrib.fluxcd.io
package v1alpha1

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

var (
	// GroupVersion is group version used to register these objects
	GroupVersion = schema.GroupVersion{Group: "infra.contrib.fluxcd.io", Version: "v1alpha1"}

	// SchemeBuilder is used to add go types to the GroupVersionKind scheme
	SchemeBuilder = &scheme.Builder{GroupVersion: GroupVersion}

	// AddToScheme adds the types in this group-version to the given scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

```

### Core Architecture Module: `api/v1alpha1/inventory_types.go`
```
/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

// ResourceInventory contains a list of Kubernetes resource object references that have been applied by a Kustomization.
type ResourceInventory struct {
	// Entries of Kubernetes resource object references.
	Entries []ResourceRef `json:"entries"`
}

// ResourceRef contains the information necessary to locate a resource within a cluster.
type ResourceRef struct {
	// Terraform resource's name.
	Name string `json:"n"`

	// Type is Terraform resource's type
	Type string `json:"t"`

	// ID is the resource identifier. This is cloud-specific. For example, ARN is an ID on AWS.
	Identifier string `json:"id"`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1895** (2026-09-28): **chore(deps): bump the go-minor group across 3 directories with 18 updates**
  *Symptoms*: Bumps the go-minor group with 10 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) | `1.45.1` | `1.47.0` | | [github.com/aws/aws-sdk-go-v2/service/dynamodb](https://github.com/aws/aws-sdk-go-v2) | `1.65.1` | `1.69.0` | | [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2) | `1.109.1` | `1.113.1` | | [github.com/fluxcd/pkg/apis/meta](https://github.com/fluxcd/pkg) | `1.31.0` | `1.32.0` | | [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) | `0.111.0` | `0.113.0` | | [github.com/jenkins-x/go-scm](https://github.com/jenkins-x/go-scm) | `1.15.36` | `1.16.3` | | [github.com/maxbrunsfeld/counterfeiter/v6](https://github.com/maxbrunsfeld/counterfeiter) | `6.12.2` | `6.13.0` | | [google.golang.org/grpc](https://github.com/grpc/grpc-go) | `1.83.2` | `1.84.0` | | google.golang.org/protobuf | `1.36.12-0.20260120151049-f2248ac996af` | `1.36.12` | | [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) | `0.24.1` | `0.25.0` | | [github.com/fluxcd/pkg/apis/meta](https://github.com/fluxcd/pkg) | `1.31.0` | `1.32.0` | | [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) | `0.111.0` | `0.113.0` | | [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) | `0.24.1` | `0.25.0` | | [github.com/fluxcd/pkg/apis/meta](https://github.com/fluxcd/pkg) | `1.31.0` | `1.32.0` | | [sigs.k8s.io/co
  **Post-Mortem & Fix Analysis**:
  > Superseded by #1898.

- **Issue #1894** (2026-09-28): **chore(deps): bump the go-patch group across 3 directories with 6 updates**
  *Symptoms*: Bumps the go-patch group with 5 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2) | `1.33.1` | `1.33.5` | | [github.com/aws/aws-sdk-go-v2/credentials](https://github.com/aws/aws-sdk-go-v2) | `1.20.1` | `1.20.5` | | [github.com/elgohr/go-localstack](https://github.com/elgohr/go-localstack) | `1.0.169` | `1.0.172` | | [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) | `1.9.4` | `1.9.5` | | [github.com/onsi/gomega](https://github.com/onsi/gomega) | `1.43.0` | `1.43.1` | | [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) | `1.9.4` | `1.9.5` | | [github.com/onsi/gomega](https://github.com/onsi/gomega) | `1.43.0` | `1.43.1` | | [github.com/onsi/gomega](https://github.com/onsi/gomega) | `1.43.0` | `1.43.1` |  Bumps the go-patch group with 2 updates in the /api directory: [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) and [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery). Bumps the go-patch group with 1 update in the /tfctl directory: [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery).  Updates `github.com/aws/aws-sdk-go-v2/config` from 1.33.1 to 1.33.5 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/4e0240a139dc4638067f89502ea38ba465fef164"><code>4e0240a</code></a> Release 2026-09-14</li> 
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1891** (2026-09-21): **test: fix flakiness observed with the mTLS CA rotations**
  *Symptoms*: ## Motivation  Fix flakiness observed with `Test_009990_mtls_generate_creds_test` on #1890 

- **Issue #1888** (2026-09-21): **chore(deps): bump the gh-minor group across 1 directory with 9 updates**
  *Symptoms*: Bumps the gh-minor group with 9 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [fluxcd/pkg/actions/kustomize](https://github.com/fluxcd/pkg) | `1.39.0` | `1.40.0` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `4.2.0` | `4.3.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `4.2.0` | `4.3.0` | | [docker/login-action](https://github.com/docker/login-action) | `4.5.1` | `4.6.0` | | [fluxcd/pkg/actions/kubectl](https://github.com/fluxcd/pkg) | `1.39.0` | `1.40.0` | | [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` | | [github/codeql-action/init](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` | | [github/codeql-action/autobuild](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` | | [github/codeql-action/analyze](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` |   Updates `fluxcd/pkg/actions/kustomize` from 1.39.0 to 1.40.0 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/fluxcd/pkg/commit/992c220c423e137a6c1808828d8bc569249abc12"><code>992c220</code></a> Merge pull request <a href="https://redirect.github.com/fluxcd/pkg/issues/1283">#1283</a> from fluxcd/release-main</li> <li><a href="https://github.com/fluxcd/pkg/commit/a26a27bb1e2419e6754eff046a0035a144d73a69"><code>a26a27b</code></a> Prepare for release</li> <li><a href="https://github.com/fluxcd/pkg/commit/6864165f4
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1887** (2026-09-21): **chore(deps): bump the go-minor group across 3 directories with 14 updates**
  *Symptoms*: Bumps the go-minor group with 7 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) | `1.45.1` | `1.47.0` | | [github.com/aws/aws-sdk-go-v2/service/dynamodb](https://github.com/aws/aws-sdk-go-v2) | `1.65.1` | `1.68.0` | | [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2) | `1.109.1` | `1.113.0` | | [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) | `0.111.0` | `0.112.0` | | [github.com/jenkins-x/go-scm](https://github.com/jenkins-x/go-scm) | `1.15.36` | `1.16.0` | | [github.com/maxbrunsfeld/counterfeiter/v6](https://github.com/maxbrunsfeld/counterfeiter) | `6.12.2` | `6.13.0` | | [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) | `0.24.1` | `0.25.0` |  Bumps the go-minor group with 4 updates in the /api directory: [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg), [github.com/onsi/gomega](https://github.com/onsi/gomega), [k8s.io/apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver) and [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime). Bumps the go-minor group with 4 updates in the /tfctl directory: [github.com/onsi/gomega](https://github.com/onsi/gomega), [k8s.io/cli-runtime](https://github.com/kubernetes/cli-runtime), [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) and [github.com/fluxcd
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1886** (2026-09-21): **chore(deps): bump the go-patch group across 2 directories with 5 updates**
  *Symptoms*: Bumps the go-patch group with 3 updates in the / directory: [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2), [github.com/elgohr/go-localstack](https://github.com/elgohr/go-localstack) and [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller). Bumps the go-patch group with 1 update in the /api directory: [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller).  Updates `github.com/aws/aws-sdk-go-v2/config` from 1.33.1 to 1.33.4 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/b189f382f4924bc6c948c9942e17c547553faf0d"><code>b189f38</code></a> Release 2026-09-09</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/0905d5f8a9a88708ad8c7ee4554ae51a38e532f2"><code>0905d5f</code></a> Regenerated Clients</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/9cc4bc539469ec525c3a58fa35072ef1c92237f3"><code>9cc4bc5</code></a> Update API model</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/126fe2d5e82a59ea5d231bdbc5ff71421ab73476"><code>126fe2d</code></a> fix GetObject deadlock (<a href="https://redirect.github.com/aws/aws-sdk-go-v2/issues/3554">#3554</a>)</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/512688512cb733cab94c9e8b24361b952acb0f48"><code>5126885</code></a> Remove retry metrics header middleware (<a href="https://redirect.github.com/aws/aws-sdk-go-v2/issues/3546">#3546</a>)</li> <li><a href=
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1882** (2026-09-21): **chore(deps): bump google.golang.org/protobuf from 1.36.12-0.20260120151049-f2248ac996af to 1.36.12**
  *Symptoms*: Bumps google.golang.org/protobuf from 1.36.12-0.20260120151049-f2248ac996af to 1.36.12.   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=google.golang.org/protobuf&package-manager=go_modules&previous-version=1.36.12-0.20260120151049-f2248ac996af&new-version=1.36.12)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this dependency` wil
  **Post-Mortem & Fix Analysis**:
  > Superseded by #1895.

- **Issue #1881** (2026-09-14): **chore(deps): bump the go-minor group across 3 directories with 6 updates**
  *Symptoms*: Bumps the go-minor group with 4 updates in the / directory: [github.com/aws/aws-sdk-go-v2/service/dynamodb](https://github.com/aws/aws-sdk-go-v2), [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2), [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) and [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime). Bumps the go-minor group with 4 updates in the /api directory: [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg), [github.com/onsi/gomega](https://github.com/onsi/gomega), [k8s.io/apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver) and [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime). Bumps the go-minor group with 2 updates in the /tfctl directory: [github.com/onsi/gomega](https://github.com/onsi/gomega) and [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime).  Updates `github.com/aws/aws-sdk-go-v2/service/dynamodb` from 1.65.1 to 1.66.0 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/ebfeafa763ea779f26076c10c910d0c09eef04d0"><code>ebfeafa</code></a> Release 2024-10-16</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/e0fa20e2064d7b547479a6301913dc01242e8d1b"><code>e0fa20e</code></a> Regenerated Clients</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/ccc6c9ce1d18ab9f6f0e69fcf5a262ed16731954"><code>ccc6c9c</cod
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

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

### Incident Patch 1: `8fc67730` (2026-09-21)
**Commit Message**: fix(test): stop the mTLS CA rotations sharing a second (#1891)

Runner TLS Secret names carry the validity of the CA that signed them, at
second resolution, so the two back-to-back rotations of this test claim a
single name whenever they land in the same second. The second Create then
fails with AlreadyExists, the runner Secret is never rewritten, and the
test waits 90s for a certificate that cannot change.

Wait out the second between the two rotations.

**File**: `controllers/tc009990_mtls_generate_creds_test.go` (modified, +4/-0)
```diff
@@ -35,6 +35,7 @@ func Test_009990_mtls_generate_creds_test(t *testing.T) {
 	rotator.TriggerCARotation <- mtls.Trigger{Namespace: "", Ready: readyCh}
 	result := <-readyCh
 	g.Expect(result.Err).To(BeNil())
+	firstRotationAt := time.Now()
 
 	caSecret := result.Secret
 	g.Expect(len(caSecret.Data)).To(Equal(4))
@@ -162,6 +163,9 @@ func Test_009990_mtls_generate_creds_test(t *testing.T) {
 	g.Expect(tlsValid).To(BeFalse())
 
 	By("rotating the CA should renew the server cert")
+	// runner TLS Secret names carry the CA validity at second resolution, so a CA
+	// rotated within the same second as the one it replaces never writes its own.
+	time.Sleep(time.Until(firstRotationAt.Truncate(time.Second).Add(time.Second)))
 	rotator.ResetCACache()
 	renewedReadyCh := make(chan *mtls.TriggerResult)
 	rotator.TriggerCARotation <- mtls.Trigger{Namespace: "", Ready: renewedReadyCh}
```

---

### Incident Patch 2: `787be900` (2026-09-01)
**Commit Message**: fix: list only open GitLab merge requests (#1865)

**File**: `internal/git/provider/gitlab_provider.go` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ func (p *GitLabProvider) ListPullRequestChanges(ctx context.Context, pr PullRequ
 func (p *GitLabProvider) ListPullRequests(ctx context.Context, repo Repository) ([]PullRequest, error) {
 	var prs []PullRequest
 
-	opts := scm.PullRequestListOptions{Page: 1, Size: defaultPageSize}
+	opts := scm.PullRequestListOptions{Page: 1, Size: defaultPageSize, Open: true}
 	for {
 		prList, res, err := p.client.PullRequests.List(ctx, repo.String(), &opts)
 		if err != nil {
```

**File**: `internal/git/provider/gitlab_provider_test.go` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+package provider
+
+import (
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/jenkins-x/go-scm/scm/driver/gitlab"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestGitLabProviderListPullRequestsRequestsOnlyOpen(t *testing.T) {
+	state := make(chan string, 1)
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		state <- r.URL.Query().Get("state")
+		w.Header().Set("Content-Type", "application/json")
+		_, err := io.WriteString(w, "[]")
+		assert.NoError(t, err)
+	}))
+	t.Cleanup(server.Close)
+
+	client, err := gitlab.New(server.URL)
+	require.NoError(t, err)
+
+	p := &GitLabProvider{client: client}
+	prs, err := p.ListPullRequests(t.Context(), Repository{Org: "example", Name: "infrastructure"})
+	require.NoError(t, err)
+	assert.Empty(t, prs)
+	assert.Equal(t, "opened", <-state)
+}
```

---

### Incident Patch 3: `20a1a4d7` (2026-08-31)
**Commit Message**: fix(deps): remove libcrypto3 pin (#1874)

**File**: `.github/workflows/build-and-publish.yaml` (modified, +0/-6)
```diff
@@ -11,7 +11,6 @@ permissions:
 env:
   CONTROLLER: ${{ github.event.repository.name }}
   REGISTRY_OWNER: ${{ github.repository_owner }}
-  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   test:
@@ -79,8 +78,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/${{ env.CONTROLLER }}:${{ steps.prep.outputs.VERSION }}
@@ -99,7 +96,6 @@ jobs:
           context: .
           file: ./runner-base.Dockerfile
           build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
             BUILD_VERSION=${{ steps.prep.outputs.BUILD_VERSION }}
             BUILD_SHA=${{ steps.prep.outputs.BUILD_SHA }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
@@ -139,8 +135,6 @@ jobs:
           context: .
           file: ./planner.Dockerfile
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/branch-planner:${{ steps.prep.outputs.VERSION }}
           labels: |
```

**File**: `.github/workflows/release-runners.yaml` (modified, +0/-4)
```diff
@@ -18,7 +18,6 @@ permissions:
 env:
   VERSION: ${{ github.event.inputs.version || github.event.client_payload.version }}
   BUILD_DATE: ${{ github.event.inputs.build_date || github.event.client_payload.build_date }}
-  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   release-base:
@@ -53,8 +52,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./runner-base.Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/flux-iac/tf-runner:${{ env.VERSION }}-base
@@ -106,7 +103,6 @@ jobs:
           build-args: |
             BASE_IMAGE=ghcr.io/flux-iac/tf-runner:${{ env.VERSION }}-base
             TF_VERSION=${{ matrix.tf_version }}
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           tags: |
             ghcr.io/flux-iac/tf-runner:${{ env.VERSION }}-tf-${{ matrix.tf_version }}
           labels: |
```

**File**: `.github/workflows/release.yaml` (modified, +0/-7)
```diff
@@ -16,7 +16,6 @@ permissions:
 env:
   CONTROLLER: ${{ github.event.repository.name }}
   REGISTRY_OWNER: ${{ github.repository_owner }}
-  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   build-push:
@@ -72,8 +71,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/${{ env.CONTROLLER }}:${{ steps.prep.outputs.VERSION }}
@@ -92,8 +89,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./runner-base.Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/tf-runner:${{ steps.prep.outputs.VERSION }}-base
@@ -154,8 +149,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./planner.Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7 - azure-cli does not install correctly on 32 bit arm
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/branch-planner:${{ steps.prep.outputs.VERSION }}
```

**File**: `.go-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.26.5
+1.26.6
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-ARG GO_VERSION=1.26.5
+ARG GO_VERSION=1.26.6
 FROM --platform=$BUILDPLATFORM golang:${GO_VERSION} AS builder
 
 WORKDIR /build
```

---

### Incident Patch 4: `35fa3c1b` (2026-08-06)
**Commit Message**: fix(deps): bump python packages (#1858)

**File**: `.github/workflows/helm-test.yaml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ jobs:
 
       - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
         with:
-          python-version: "3.10"
+          python-version: 3.x
 
       - name: Set up chart-testing
         uses: helm/chart-testing-action@6ec842c01de15ebb84c8627d2744a0c2f2755c9f # v2.8.0
```

**File**: `runner-azure.Dockerfile` (modified, +12/-1)
```diff
@@ -5,7 +5,14 @@ FROM ghcr.io/opentofu/opentofu:${TOFU_VERSION}-minimal AS tofu
 
 FROM $BASE_IMAGE
 
-ARG AZURE_CLI_VERSION=2.86.0
+ARG AZURE_CLI_VERSION=2.89.0
+
+# azure-cli-core pins msal==1.36.0, which caps cryptography at <49 and leaves the
+# image on 48.x (CVE-2026-69247, CVE-2026-69249). Upgraded as a set below; drop
+# these once azure-cli moves to msal >= 1.37.0.
+ARG CRYPTOGRAPHY_VERSION=50.0.0
+ARG PYOPENSSL_VERSION=26.4.0
+ARG MSAL_VERSION=1.37.0
 
 # Switch to root temporarily for package installation (base image runs as 65532).
 USER root
@@ -17,6 +24,10 @@ USER root
 RUN apk add --no-cache python3 py3-virtualenv gcc python3-dev musl-dev linux-headers && \
     python3 -m venv /opt/az && \
     /opt/az/bin/pip install --no-cache-dir setuptools azure-cli==${AZURE_CLI_VERSION} && \
+    /opt/az/bin/pip install --no-cache-dir --no-deps --upgrade \
+        cryptography==${CRYPTOGRAPHY_VERSION} \
+        pyOpenSSL==${PYOPENSSL_VERSION} \
+        msal==${MSAL_VERSION} && \
     ln -s /opt/az/bin/az /usr/local/bin/az && \
     apk del gcc python3-dev musl-dev linux-headers
 
```

---

### Incident Patch 5: `ef76ba7f` (2026-08-05)
**Commit Message**: fix: reconcile every interval, not every restart, for stable objects (#1681) (#1857)

**File**: `api/v1alpha2/terraform_types.go` (modified, +5/-0)
```diff
@@ -416,6 +416,11 @@ type TerraformStatus struct {
 	// +optional
 	LastPlanAt *metav1.Time `json:"lastPlanAt,omitempty"`
 
+	// LastSuccessfulReconcileAt is the time when the last successful
+	// reconciliation was completed, regardless of whether a plan was generated.
+	// +optional
+	LastSuccessfulReconcileAt *metav1.Time `json:"lastSuccessfulReconcileAt,omitempty"`
+
 	// LastDriftDetectedAt is the time when the last drift was detected
 	// +optional
 	LastDriftDetectedAt *metav1.Time `json:"lastDriftDetectedAt,omitempty"`
```

**File**: `api/v1alpha2/zz_generated.deepcopy.go` (modified, +4/-0)
```diff
@@ -661,6 +661,10 @@ func (in *TerraformStatus) DeepCopyInto(out *TerraformStatus) {
 		in, out := &in.LastPlanAt, &out.LastPlanAt
 		*out = (*in).DeepCopy()
 	}
+	if in.LastSuccessfulReconcileAt != nil {
+		in, out := &in.LastSuccessfulReconcileAt, &out.LastSuccessfulReconcileAt
+		*out = (*in).DeepCopy()
+	}
 	if in.LastDriftDetectedAt != nil {
 		in, out := &in.LastDriftDetectedAt, &out.LastDriftDetectedAt
 		*out = (*in).DeepCopy()
```

**File**: `charts/tofu-controller/crds/crds.yaml` (modified, +6/-0)
```diff
@@ -11395,6 +11395,12 @@ spec:
                   LastPlannedRevision is the revision used by the last planning process.
                   The result could be either no plan change or a new plan generated.
                 type: string
+              lastSuccessfulReconcileAt:
+                description: |-
+                  LastSuccessfulReconcileAt is the time when the last successful
+                  reconciliation was completed, regardless of whether a plan was generated.
+                format: date-time
+                type: string
               lock:
                 description: LockStatus defines the observed state of a Terraform
                   State Lock
```

**File**: `config/crd/bases/infra.contrib.fluxcd.io_terraforms.yaml` (modified, +6/-0)
```diff
@@ -11395,6 +11395,12 @@ spec:
                   LastPlannedRevision is the revision used by the last planning process.
                   The result could be either no plan change or a new plan generated.
                 type: string
+              lastSuccessfulReconcileAt:
+                description: |-
+                  LastSuccessfulReconcileAt is the time when the last successful
+                  reconciliation was completed, regardless of whether a plan was generated.
+                format: date-time
+                type: string
               lock:
                 description: LockStatus defines the observed state of a Terraform
                   State Lock
```

**File**: `controllers/tf_controller.go` (modified, +8/-2)
```diff
@@ -277,6 +277,7 @@ func (r *TerraformReconciler) Reconcile(ctx context.Context, req ctrl.Request) (
 		log.Info("Skipping reconciliation",
 			"reason", reason,
 			"lastPlanAt", terraform.Status.LastPlanAt,
+			"lastSuccessfulReconcileAt", terraform.Status.LastSuccessfulReconcileAt,
 			"nextAttempt", time.Now().Add(requeueAfter),
 			"requeueAfter", requeueAfter)
 
@@ -563,6 +564,7 @@ func (r *TerraformReconciler) Reconcile(ctx context.Context, req ctrl.Request) (
 	if reconcileErr == nil {
 		log.Info("Reset reconciliation failures count. Reason: successful reconciliation")
 		terraform = infrav1.TerraformResetRetry(reconciledTerraform)
+		terraform.Status.LastSuccessfulReconcileAt = &metav1.Time{Time: time.Now()}
 	} else {
 		terraform = reconciledTerraform
 		terraform.IncrementReconciliationFailures()
@@ -680,10 +682,14 @@ func (r *TerraformReconciler) shouldReconcile(terraform *infrav1.Terraform, sour
 		return true, "retry interval has elapsed since last failed reconciliation", 0
 	}
 
-	nextReconcile := terraform.Status.LastPlanAt.Add(terraform.Spec.Interval.Duration)
+	if terraform.Status.LastSuccessfulReconcileAt == nil {
+		return true, "never successfuly reconciled before", 0
+	}
+
+	nextReconcile := terraform.Status.LastSuccessfulReconcileAt.Add(terraform.Spec.Interval.Duration)
 	requeueAfter := time.Until(nextReconcile)
 	if requeueAfter > 0 {
-		return false, "interval has not elapsed since last plan", requeueAfter
+		return false, "interval has not elapsed since last successful reconciliation", requeueAfter
 	}
 
 	return true, "", 0
```

---

### Incident Patch 6: `e9b005dd` (2026-07-29)
**Commit Message**: fix: prevent permanent reconcile hang when a runner pod dies mid-reconcile (#1838)

**File**: `cmd/manager/main.go` (modified, +6/-0)
```diff
@@ -91,6 +91,7 @@ func main() {
 		rotationCheckFrequency    time.Duration
 		runnerGRPCPort            int
 		runnerCreationTimeout     time.Duration
+		runnerRPCTimeout          time.Duration
 		runnerGRPCMaxMessageSize  int
 		allowBreakTheGlass        bool
 		clusterDomain             string
@@ -118,6 +119,10 @@ func main() {
 		"The interval that the mTLS certificate rotator should check the certificate validity.")
 	flag.IntVar(&runnerGRPCPort, "runner-grpc-port", 30000, "The port which will be exposed on the runner pod for gRPC connections.")
 	flag.DurationVar(&runnerCreationTimeout, "runner-creation-timeout", 120*time.Second, "Timeout for creating a runner pod.")
+	flag.DurationVar(&runnerRPCTimeout, "runner-rpc-timeout", 30*time.Minute,
+		"Maximum duration for the batch of runner RPCs that set up Terraform (upload, "+
+			"backend config, init, workspace select). Bounds the reconcile so a runner pod "+
+			"that dies mid-RPC surfaces as an error and requeues instead of hanging forever.")
 	flag.IntVar(&runnerGRPCMaxMessageSize, "runner-grpc-max-message-size", 4, "The maximum message size for gRPC connections in MiB.")
 	flag.BoolVar(&allowBreakTheGlass, "allow-break-the-glass", false, "Allow break the glass mode.")
 	flag.StringVar(&clusterDomain, "cluster-domain", "cluster.local", "The cluster domain used by the cluster.")
@@ -253,6 +258,7 @@ func main() {
 		CertRotator:               rotator,
 		RunnerGRPCPort:            runnerGRPCPort,
 		RunnerCreationTimeout:     runnerCreationTimeout,
+		RunnerRPCTimeout:          runnerRPCTimeout,
 		RunnerGRPCMaxMessageSize:  runnerGRPCMaxMessageSize,
 		AllowBreakTheGlass:        allowBreakTheGlass,
 		ClusterDomain:             clusterDomain,
```

**File**: `controllers/suite_test.go` (modified, +1/-0)
```diff
@@ -179,6 +179,7 @@ func TestMain(m *testing.M) {
 		CertRotator:               rotator,
 		RunnerGRPCPort:            30000,
 		RunnerCreationTimeout:     120 * time.Second,
+		RunnerRPCTimeout:          30 * time.Minute,
 		RunnerGRPCMaxMessageSize:  4,
 		UsePodSubdomainResolution: false,
 	}
```

**File**: `controllers/tf_controller.go` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ type TerraformReconciler struct {
 	CertRotator               *mtls.CertRotator
 	RunnerGRPCPort            int
 	RunnerCreationTimeout     time.Duration
+	RunnerRPCTimeout          time.Duration
 	RunnerGRPCMaxMessageSize  int
 	AllowBreakTheGlass        bool
 	ClusterDomain             string
```

**File**: `controllers/tf_controller_backend.go` (modified, +11/-3)
```diff
@@ -28,6 +28,17 @@ func (r *TerraformReconciler) backendCompletelyDisable(terraform *infrav1.Terraf
 func (r *TerraformReconciler) setupTerraform(ctx context.Context, patchHelper *patch.SerialPatcher, runnerClient runner.RunnerClient, terraform *infrav1.Terraform, sourceObj sourcev1.Source, revision string, reconciliationLoopID string) (*infrav1.Terraform, string, string, error) {
 	log := ctrl.LoggerFrom(ctx)
 
+	// Bound the runner RPCs below (UploadAndExtract ... Init ... SelectWorkspace).
+	// The runner gRPC client is created with waitForReady:true, so an RPC on a
+	// channel that cannot connect (e.g. the runner pod was killed by a node reboot
+	// mid-reconcile) blocks until its context is done. Without a deadline the call
+	// blocks forever, and because controller-runtime does not start a new Reconcile
+	// for a key while the previous one is still running, that Terraform object is
+	// never reconciled again and a worker slot is leaked permanently. A generous,
+	// configurable ceiling turns "never" into "requeue after RunnerRPCTimeout".
+	ctx, cancel := context.WithTimeout(ctx, r.RunnerRPCTimeout)
+	defer cancel()
+
 	tfInstance := "0"
 	tmpDir := ""
 
@@ -48,9 +59,6 @@ func (r *TerraformReconciler) setupTerraform(ctx context.Context, patchHelper *p
 		), tfInstance, tmpDir, err
 	}
 
-	// we fix timeout of UploadAndExtract to be 30s
-	// ctx30s, cancelCtx30s := context.WithTimeout(ctx, 30*time.Second)
-	// defer cancelCtx30s()
 	uploadAndExtractReply, err := runnerClient.UploadAndExtract(ctx, &runner.UploadAndExtractRequest{
 		Namespace: terraform.Namespace,
 		Name:      terraform.Name,
```

**File**: `controllers/tf_controller_runner.go` (modified, +24/-0)
```diff
@@ -328,6 +328,7 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 	type state string
 	const (
 		stateUnknown       state = "unknown"
+		stateFailed        state = "failed"
 		stateRunning       state = "running"
 		stateNotFound      state = "not-found"
 		stateMustBeDeleted state = "must-be-deleted"
@@ -397,6 +398,7 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 		podState = stateNotFound
 	} else if err != nil {
 		traceLog.Error(err, "Error getting the Runner Pod", "runner-pod-key", runnerPodKey)
+		return "", fmt.Errorf("failed to get the runner pod: %w", err)
 	} else if err == nil {
 		label, found := runnerPod.Labels["tf.weave.works/tls-secret-name"]
 		traceLog.Info("Set label and found", "label", label, "found", found)
@@ -412,6 +414,8 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 			podState = stateTerminating
 		} else if runnerPod.Status.Phase == v1.PodRunning {
 			podState = stateRunning
+		} else if runnerPod.Status.Phase == v1.PodFailed {
+			podState = stateFailed
 		}
 	}
 
@@ -469,6 +473,26 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 	case stateRunning:
 		// do nothing
 		traceLog.Info("Pod is running, do nothing")
+	case stateFailed:
+		// A failed pod will never serve gRPC again, so delete it and create a
+		// replacement. Other non-running phases are left alone to continue
+		// starting up.
+		log.Info("runner pod failed, force-deleting", "name", terraform.Name)
+		if err := r.Delete(ctx, &runnerPod,
+			client.GracePeriodSeconds(1), // force kill = 1 second
+			client.PropagationPolicy(metav1.DeletePropagationForeground),
+		); err != nil && !errors.IsNotFound(err) {
+			traceLog.Error(err, "Hit an error")
+			return "", err
+		}
+		if err := waitForPodToBeTerminated(); err != nil {
+			traceLog.Error(err, "Hit an error")
+			return "", fmt.Errorf("failed to wait for the stale pod termination: %v", err)
+		}
+		if err := createNewPod(); err != nil {
+			traceLog.Error(err, "Hit an error")
+			return "", err
+		}
 	}
 
 	// wait for pod ip
```

---

### Incident Patch 7: `07392f87` (2026-07-26)
**Commit Message**: fix: add controller ownerReference to tf-runner pods (#1835)

**File**: `controllers/tc000260_runner_pod_test.go` (modified, +13/-0)
```diff
@@ -14,6 +14,7 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/utils/ptr"
 )
 
 // +kubebuilder:docs-gen:collapse=Imports
@@ -43,6 +44,7 @@ func Test_000260_runner_pod_test(t *testing.T) {
 		ObjectMeta: metav1.ObjectMeta{
 			Name:      terraformName,
 			Namespace: "flux-system",
+			UID:       types.UID("f24960a2-6156-49d4-a2d1-b56d92146c9e"),
 		},
 		Spec: infrav1.TerraformSpec{
 			ApprovePlan: "auto",
@@ -92,6 +94,17 @@ func Test_000260_runner_pod_test(t *testing.T) {
 	}()).To(BeTrue())
 
 	g.Expect(podTemplate.Labels["app.kubernetes.io/instance"]).To(Equal("tf-runner-c7fd0cc6"))
+
+	By("checking that the runner pod is owned by the Terraform object, so that observability tools classify it as a managed pod and GC can clean it up")
+	g.Expect(podTemplate.OwnerReferences).To(Equal([]metav1.OwnerReference{
+		{
+			APIVersion: infrav1.GroupVersion.String(),
+			Kind:       infrav1.TerraformKind,
+			Name:       terraformName,
+			UID:        helloWorldTF.UID,
+			Controller: ptr.To(true),
+		},
+	}))
 }
 
 func Test_000260_runner_pod_test_env_vars(t *testing.T) {
```

**File**: `controllers/tf_controller_runner.go` (modified, +14/-0)
```diff
@@ -17,6 +17,7 @@ import (
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/wait"
 	"k8s.io/apimachinery/pkg/watch"
+	"k8s.io/utils/ptr"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
@@ -52,6 +53,19 @@ func runnerPodTemplate(terraform *infrav1.Terraform, secretName string, revision
 		ObjectMeta: metav1.ObjectMeta{
 			Namespace: podNamespace,
 			Name:      podName,
+			// The controller ownerReference classifies the runner as a managed pod
+			// (kube-state-metrics' created_by_kind) rather than a bare pod that appears
+			// to restart on every reconcile, and lets Kubernetes GC the runner if the
+			// Terraform object is deleted.
+			OwnerReferences: []metav1.OwnerReference{
+				{
+					APIVersion: infrav1.GroupVersion.String(),
+					Kind:       infrav1.TerraformKind,
+					Name:       terraform.Name,
+					UID:        terraform.UID,
+					Controller: ptr.To(true),
+				},
+			},
 			Labels: map[string]string{
 				"app.kubernetes.io/created-by":   "tofu-controller",
 				"app.kubernetes.io/name":         "tf-runner",
```

---

### Incident Patch 8: `adbb4711` (2026-07-26)
**Commit Message**: fix(github): use api.github.com base URL for GitHub App auth (#1823) (#1843)

The Setup() function was incorrectly using the web host (https://github.com)
instead of the API host (https://api.github.com) when creating the go-scm
client for GitHub App authentication. This caused 404 errors when the
branch-planner attempted to list pull requests.

For GitHub.com:
- Now uses https://api.github.com (was: https://github.com)

For GHE:
- Now uses <server>/api/v3 for both transport.BaseURL and github.New()
- Previously only set transport.BaseURL, but still passed the web host to New()

This mirrors the pattern used in the token auth path where factory.NewClient
properly calls ensureGHEEndpoint.

Fixes #1823

**File**: `internal/git/provider/github_provider.go` (modified, +4/-2)
```diff
@@ -211,11 +211,13 @@ func (p *GitHubProvider) Setup() error {
 			return fmt.Errorf("failed to create github app transport: %w", err)
 		}
 
+		apiURL := "https://api.github.com"
 		if p.hostname != "github.com" {
-			transport.BaseURL = serverURL + "/api/v3"
+			apiURL = serverURL + "/api/v3"
+			transport.BaseURL = apiURL
 		}
 
-		p.client, err = github.New(serverURL)
+		p.client, err = github.New(apiURL)
 		if err != nil {
 			return fmt.Errorf("failed to create github client: %w", err)
 		}
```

---

### Incident Patch 9: `273b7aa9` (2026-06-22)
**Commit Message**: fix: install libc6-compat in runner image to fix boundary provider plan (#1825)

**File**: `runner-base.Dockerfile` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ RUN apk update && \
     busybox \
     ca-certificates \
     git \
+    libc6-compat \
     gnupg \
     libcrypto3=${LIBCRYPTO_VERSION} \
     libssl3=${LIBCRYPTO_VERSION} \
```

---

### Incident Patch 10: `bb44bbbe` (2026-06-19)
**Commit Message**: fix: stop injecting CR metadata labels into Kubernetes backend state Secret selector (#1808)

* fix: use backend-native labels for Kubernetes backend state Secret lookup

Replace getLabelsAsHCL(terraform.Labels) with a stable two-label selector
using the labels the Terraform kubernetes backend already writes onto every
state Secret it creates:

  tfstateSecretSuffix = <secret_suffix>   (CR name or BackendConfig.SecretSuffix)
  tfstateWorkspace    = <workspace>

These labels are present on every existing state Secret so no migration is
required. The selector is independent of CR metadata.labels, so changes
made by Flux, Helm, kustomize overlays or kubectl label can no longer cause
the controller to bootstrap empty Terraform state.

The fix is also Velero backup/restore safe: neither value depends on the CR
UID, which Velero reassigns on restore.

Closes: https://github.com/flux-iac/tofu-controller/issues/1774

* fix: explicit BackendConfig path uses BackendConfig.Labels for HCL block

For the explicit BackendConfig path, delegate label control to the user
via BackendConfig.Labels rather than auto-generating tfstateSecretSuffix
and tfstateWorkspace. Users who provide a BackendConfig 

**File**: `config/testdata/assert-helpers.sh` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+#!/usr/bin/env bash
+# Shared assertion helpers for local-e2e.sh test sections.
+# Source this file before using the functions below.
+
+# assert_label_absent <namespace> <secret> <label-key>
+# Fails if the label key is present (any value) on the Secret.
+assert_label_absent() {
+  local ns=$1 secret=$2 key=$3
+  local val
+  val=$(kubectl -n "$ns" get secret "$secret" \
+        -o jsonpath="{.metadata.labels.$key}" 2>/dev/null || true)
+  if [[ -n "$val" ]]; then
+    echo "FAIL: secret $secret in $ns has unexpected label $key=$val" >&2
+    exit 1
+  fi
+}
+
+# assert_label_present <namespace> <secret> <label-key> <expected-value>
+# Fails if the label key is absent or has a different value on the Secret.
+assert_label_present() {
+  local ns=$1 secret=$2 key=$3 expected=$4
+  local val
+  val=$(kubectl -n "$ns" get secret "$secret" \
+        -o jsonpath="{.metadata.labels.$key}" 2>/dev/null || true)
+  if [[ "$val" != "$expected" ]]; then
+    echo "FAIL: secret $secret in $ns: label $key expected '$expected', got '$val'" >&2
+    exit 1
+  fi
+}
```

**File**: `config/testdata/state-secret-label/backend-labels-expand.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+# Regression test for BackendConfig.Labels expansion.
+# Verifies that expanding BackendConfig.Labels after the state Secret already exists
+# reuses the same Secret (state is not lost) and the new labels land on the Secret
+# after the next apply — triggered here by a variable change to force real drift.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-backend-labels-expand
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    helm.toolkit.fluxcd.io/name: my-release
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+  backendConfig:
+    secretSuffix: backend-labels-expand
+    labels:
+      env: staging
```

**File**: `config/testdata/state-secret-label/label-drift.yaml` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Regression test for label-drift state loss.
+# The CR carries Flux labels that Flux routinely changes (e.g. on each kustomization sync).
+# After the label change the controller must reuse the same state Secret — not create a new
+# empty one — because the HCL labels block no longer mirrors CR metadata labels.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-drift
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-v1
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: my-release-v1
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
```

**File**: `config/testdata/state-secret-label/same-ns-multi.yaml` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# Two Terraform CRs in the same namespace sharing the same secretSuffix but using
+# different workspaces. The Kubernetes backend must differentiate their state Secrets
+# via tfstateWorkspace, not CR metadata labels. Both Secrets must be label-clean.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-ws-dev
+  labels:
+    kustomize.toolkit.fluxcd.io/name: shared-stack
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: shared-release
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  workspace: dev
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-ws-prd
+  labels:
+    kustomize.toolkit.fluxcd.io/name: shared-stack
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: shared-release
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  workspace: prd
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
```

**File**: `config/testdata/state-secret-label/test.yaml` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# Scenario A: default backend (no BackendConfig), CR carries Flux/Helm labels.
+# The state Secret must NOT inherit any of these CR metadata labels.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-default
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: my-release
+    helm.toolkit.fluxcd.io/namespace: flux-system
+spec:
+  interval: 30s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+
+# Scenario B: explicit BackendConfig present but Labels omitted.
+# Same expectation as A — no CR metadata labels on the state Secret.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-backendconfig-nolabels
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    helm.toolkit.fluxcd.io/name: my-release
+spec:
+  interval: 30s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+  backendConfig:
+    secretSuffix: state-label-bc-nolabels
+
+# Scenario C: explicit BackendConfig with custom Labels set.
+# The state Secret must carry exactly those labels and still none of the CR metadata labels.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-backendconfig-labels
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    helm.toolkit.fluxcd.io/name: my-release
+spec:
+  interval: 30s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+  backendConfig:
+    secretSuffix: state-label-bc-labels
+    labels:
+      env: staging
+      app: my-service
```

#### Recent Merged Pull Requests:
- **PR #1895** (closed): chore(deps): bump the go-minor group across 3 directories with 18 updates (@dependabot[bot])
- **PR #1894** (closed): chore(deps): bump the go-patch group across 3 directories with 6 updates (@dependabot[bot])
- **PR #1891** (2026-09-21): test: fix flakiness observed with the mTLS CA rotations (@mloiseleur)
- **PR #1888** (closed): chore(deps): bump the gh-minor group across 1 directory with 9 updates (@dependabot[bot])
- **PR #1887** (closed): chore(deps): bump the go-minor group across 3 directories with 14 updates (@dependabot[bot])
- **PR #1886** (closed): chore(deps): bump the go-patch group across 2 directories with 5 updates (@dependabot[bot])
- **PR #1882** (closed): chore(deps): bump google.golang.org/protobuf from 1.36.12-0.20260120151049-f2248ac996af to 1.36.12 (@dependabot[bot])
- **PR #1881** (closed): chore(deps): bump the go-minor group across 3 directories with 6 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
