# Forensic Learning Record (Deep Inspection): kumahq/kuma

> **Canonical Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:37:33.423Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kumahq/kuma`
- **Description**: 🐻 The multi-zone service mesh for containers, Kubernetes and VMs. Built with Envoy. CNCF Sandbox Project.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4012 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/common/v1alpha1/datasource/datasource.go`
```
// +kubebuilder:object:generate=true
package datasource

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kumahq/kuma/v3/pkg/core/resources/apis/system"
	"github.com/kumahq/kuma/v3/pkg/core/resources/manager"
	core_store "github.com/kumahq/kuma/v3/pkg/core/resources/store"
	"github.com/kumahq/kuma/v3/pkg/core/validators"
)

// +kubebuilder:validation:Enum=File;Secret;EnvVar;InsecureInline
type SecureDataSourceType string

const (
	SecureDataSourceFile      SecureDataSourceType = "File"
	SecureDataSourceSecretRef SecureDataSourceType = "Secret"
	SecureDataSourceEnvVar    SecureDataSourceType = "EnvVar"
	SecureDataSourceInline    SecureDataSourceType = "InsecureInline"
)

// SecureDataSource is a way to securely provide data to the component
type SecureDataSource struct {
	// +kuma:discriminator
	Type           SecureDataSourceType `json:"type"`
	File           *File                `json:"file,omitempty"`
	EnvVar         *EnvVar              `json:"envVar,omitempty"`
	InsecureInline *Inline              `json:"insecureInline,omitempty"`
	SecretRef      *SecretRef           `json:"secretRef,omitempty"`
}

// +kubebuilder:validation:Enum=File;EnvVar;Inline
type DataSourceType string

// DataSource is just a way to provide data. Not necessarily secrets,
// can be any data, i.e. certs, configs, OPA policies written in rego, lua plugins etc.
type DataSource struct {
	// +kuma:discriminator
	Type   DataSourceType `json:"type"`
	File   *File          `json:"file,omitempty"`
	EnvVar *EnvVar        `json:"envVar,omitempty"`
	Inline *Inline        `json:"inline,omitempty"`
}

type File struct {
	Path string `json:"path"`
}

type EnvVar struct {
	Name string `json:"name"`
}

// +kubebuilder:validation:Enum=Secret
type RefType string

const (
	SecretRefType RefType = "Secret"
)

type SecretRef struct {
	Kind RefType `json:"kind"`
	Name string  `json:"name"`
}

type Inline struct {
	Value string `json:"value"`
}

// validateFilePath validates that a file path is safe to read from.
// It prevents directory traversal attacks and other malicious file access patterns.
func validateFilePath(path string) error {
	if path == "" {
		return fmt.Errorf("file path cannot be empty")
	}

	// Check for directory traversal attempts in the original path
	// We need to check before cleaning because Clean() resolves .. elements
	if strings.Contains(path, "..") {
		return fmt.Errorf("file path contains directory traversal sequence: %s", path)
	}

	// Ensure the path is absolute to prevent relative path attacks
	if !filepath.IsAbs(path) {
		return fmt.Errorf("file path must be absolute: %s", path)
	}

	return nil
}

func (sds *SecureDataSource) ReadByControlPlane(ctx context.Context, secretManager manager.ReadOnlyResourceManager, mesh string) ([]byte, error) {
	switch sds.Type {
	case SecureDataSourceFile:
		if err := validateFilePath(sds.File.Path); err != nil {
			return nil, fmt.Errorf("invalid file path: %w", err)
		}
		return os.ReadFile(sds.File.Path)
	case SecureDataSourceEnvVar:
		value, found := os.LookupEnv(sds.EnvVar.Name)
		if !found {
			return nil, fmt.Errorf("environment variable: %s is not defined", sds.EnvVar.Name)
		}
		return []byte(value), nil
	case SecureDataSourceInline:
		return []byte(sds.InsecureInline.Value), nil
	case SecureDataSourceSecretRef:
		if secretManager == nil {
			return nil, errors.New("resource manager is not defined")
		}
		resource := system.NewSecretResource()
		if err := secretManager.Get(ctx, resource, core_store.GetByKey(sds.SecretRef.Name, mesh)); err != nil {
			return nil, err
		}
		return resource.Spec.GetData().GetValue(), nil
	default:
		return nil, fmt.Errorf("datasource type: %s is not supported", sds.Type)
	}
}

func (s *SecureDataSource) ValidateSecureDataSource(path validators.PathBuilder) validators.ValidationError {
	var verr validators.ValidationError
	if s == nil {
		return verr
	}
	switch s.Type {
	case SecureDataSourceEnvVar:
		if s.EnvVar == nil {
			verr.AddViolationAt(path.Field("envVar"), validators.MustBeDefined)
		} else if s.EnvVar.Name == "" {
			verr.AddViolationAt(path.Field("envVar").Field("name"), validators.MustBeDefined)
		}
	case SecureDataSourceInline:
		if s.InsecureInline == nil {
			verr.AddViolationAt(path.Field("insecureInline"), validators.MustBeDefined)
		} else if s.InsecureInline.Value == "" {
			verr.AddViolationAt(path.Field("insecureInline").Field("value"), validators.MustBeDefined)
		}
	case SecureDataSourceFile:
		if s.File == nil {
			verr.AddViolationAt(path.Field("file"), validators.MustBeDefined)
		} else if s.File.Path == "" {
			verr.AddViolationAt(path.Field("file").Field("path"), validators.MustBeDefined)
		} else if err := validateFilePath(s.File.Path); err != nil {
			verr.AddViolationAt(path.Field("file").Field("path"), err.Error())
		}
	case SecureDataSourceSecretRef:
		if s.SecretRef == nil {
			verr.AddViolationAt(path.Field("secretRef"), validators.MustBeDefined)
		}
		if s.SecretRef != nil {
			if s.SecretRef.Kind != SecretRefType {
				verr.AddViolationAt(path.Field("secretRef").Field("kind"), validators.MustBeOneOf(string(s.SecretRef.Kind), string(SecretRefType)))
			}
			if s.SecretRef.Name == "" {
				verr.AddViolationAt(path.Field("secretRef").Field("name"), validators.MustBeDefined)
			}
		}
	default:
		verr.AddViolationAt(path.Field("type"), validators.MustBeOneOf(string(s.Type), string(SecureDataSourceEnvVar), string(SecureDataSourceInline), string(SecureDataSourceFile), string(SecureDataSourceSecretRef)))
	}
	return verr
}

```

### Core Architecture Module: `api/common/v1alpha1/datasource/zz_generated.deepcopy.go`
```
//go:build !ignore_autogenerated

// Code generated by controller-gen. DO NOT EDIT.

package datasource

import ()

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *DataSource) DeepCopyInto(out *DataSource) {
	*out = *in
	if in.File != nil {
		in, out := &in.File, &out.File
		*out = new(File)
		**out = **in
	}
	if in.EnvVar != nil {
		in, out := &in.EnvVar, &out.EnvVar
		*out = new(EnvVar)
		**out = **in
	}
	if in.Inline != nil {
		in, out := &in.Inline, &out.Inline
		*out = new(Inline)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new DataSource.
func (in *DataSource) DeepCopy() *DataSource {
	if in == nil {
		return nil
	}
	out := new(DataSource)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *EnvVar) DeepCopyInto(out *EnvVar) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new EnvVar.
func (in *EnvVar) DeepCopy() *EnvVar {
	if in == nil {
		return nil
	}
	out := new(EnvVar)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *File) DeepCopyInto(out *File) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new File.
func (in *File) DeepCopy() *File {
	if in == nil {
		return nil
	}
	out := new(File)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Inline) DeepCopyInto(out *Inline) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new Inline.
func (in *Inline) DeepCopy() *Inline {
	if in == nil {
		return nil
	}
	out := new(Inline)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SecretRef) DeepCopyInto(out *SecretRef) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SecretRef.
func (in *SecretRef) DeepCopy() *SecretRef {
	if in == nil {
		return nil
	}
	out := new(SecretRef)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SecureDataSource) DeepCopyInto(out *SecureDataSource) {
	*out = *in
	if in.File != nil {
		in, out := &in.File, &out.File
		*out = new(File)
		**out = **in
	}
	if in.EnvVar != nil {
		in, out := &in.EnvVar, &out.EnvVar
		*out = new(EnvVar)
		**out = **in
	}
	if in.InsecureInline != nil {
		in, out := &in.InsecureInline, &out.InsecureInline
		*out = new(Inline)
		**out = **in
	}
	if in.SecretRef != nil {
		in, out := &in.SecretRef, &out.SecretRef
		*out = new(SecretRef)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SecureDataSource.
func (in *SecureDataSource) DeepCopy() *SecureDataSource {
	if in == nil {
		return nil
	}
	out := new(SecureDataSource)
	in.DeepCopyInto(out)
	return out
}

```

### Core Architecture Module: `api/common/v1alpha1/decimal.go`
```
package v1alpha1

import (
	"fmt"

	"github.com/shopspring/decimal"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func NewDecimalFromIntOrString(intOrString intstr.IntOrString) (decimal.Decimal, error) {
	switch intOrString.Type {
	case intstr.Int:
		return decimal.NewFromInt(int64(intOrString.IntVal)), nil
	case intstr.String:
		return decimal.NewFromString(intOrString.String())
	default:
		return decimal.Zero, fmt.Errorf("invalid IntOrString '%s'", intOrString.String())
	}
}

```

### Core Architecture Module: `api/common/v1alpha1/header.go`
```
// +kubebuilder:object:generate=true
package v1alpha1

// +kubebuilder:validation:MinLength=1
// +kubebuilder:validation:MaxLength=256
// +kubebuilder:validation:Pattern=`^[a-z0-9!#$%&'*+\-.^_\x60|~]+$`
type HeaderName string

type HeaderValue string

// +kubebuilder:validation:Enum=Exact;Present;RegularExpression;Absent;Prefix
type HeaderMatchType string

// HeaderMatchType constants.
const (
	HeaderMatchExact             HeaderMatchType = "Exact"
	HeaderMatchPresent           HeaderMatchType = "Present"
	HeaderMatchRegularExpression HeaderMatchType = "RegularExpression"
	HeaderMatchAbsent            HeaderMatchType = "Absent"
	HeaderMatchPrefix            HeaderMatchType = "Prefix"
)

// HeaderMatch describes how to select an HTTP route by matching HTTP request
// headers.
type HeaderMatch struct {
	// Type specifies how to match against the value of the header.
	// +optional
	Type *HeaderMatchType `json:"type,omitempty"`

	// Name is the name of the HTTP Header to be matched. Name MUST be lower case
	// as they will be handled with case insensitivity (See https://tools.ietf.org/html/rfc7230#section-3.2).
	Name HeaderName `json:"name"`

	// Value is the value of HTTP Header to be matched.
	Value *HeaderValue `json:"value,omitempty"`
}

```

### Core Architecture Module: `api/common/v1alpha1/jsonpatch.go`
```
package v1alpha1

import (
	"encoding/json"
	"strconv"

	"github.com/evanphx/json-patch/v5"
)

// JsonPatchBlock is one json patch operation block.
type JsonPatchBlock struct {
	// Op is a jsonpatch operation string.
	// +required
	// +kubebuilder:validation:Enum=add;remove;replace;move;copy
	Op string `json:"op"`
	// Path is a jsonpatch path string.
	// +required
	Path string `json:"path"`
	// Value must be a valid json value used by replace and add operations.
	// +kubebuilder:validation:Schemaless
	// +kubebuilder:pruning:PreserveUnknownFields
	// +kuma:nolint // json.RawMessage is already nilable, so an unset value stays distinguishable from an empty one without wrapping it in a pointer
	Value json.RawMessage `json:"value,omitempty"`
	// From is a jsonpatch from string, used by move and copy operations.
	From *string `json:"from,omitempty"`
}

func ToJsonPatch(in []JsonPatchBlock) jsonpatch.Patch {
	var res []jsonpatch.Operation

	for _, o := range in {
		var fromString string
		if o.From != nil {
			fromString = *o.From
		}

		op := json.RawMessage(strconv.Quote(o.Op))
		from := json.RawMessage(strconv.Quote(fromString))
		path := json.RawMessage(strconv.Quote(o.Path))
		value := o.Value

		res = append(res, jsonpatch.Operation{
			"op":    &op,
			"path":  &path,
			"from":  &from,
			"value": &value,
		})
	}

	return res
}

```

### Core Architecture Module: `api/common/v1alpha1/match.go`
```
package v1alpha1

type Match struct {
	// SpiffeID defines a matcher configuration for SpiffeID matching
	SpiffeID *SpiffeIDMatch `json:"spiffeID,omitempty"`
	// SNI defines a matcher configuration for matching by SNI value carried on the TLS connection
	SNI *SNIMatch `json:"sni,omitempty"`
}

// +kubebuilder:validation:Enum=Exact;Prefix
type SpiffeIDMatchType string

const (
	ExactMatchType  SpiffeIDMatchType = "Exact"
	PrefixMatchType SpiffeIDMatchType = "Prefix"
)

type SpiffeIDMatch struct {
	// Type defines how to match incoming traffic by SpiffeID. `Exact` or `Prefix` are allowed.
	Type SpiffeIDMatchType `json:"type"`
	// Value is SpiffeID of a client that needs to match for the configuration to be applied
	Value string `json:"value"`
}

// +kubebuilder:validation:Enum=Exact
type SNIMatchType string

const SNIExactMatchType SNIMatchType = "Exact"

type SNIMatch struct {
	// Type defines how to match traffic by SNI. Only `Exact` is supported.
	Type SNIMatchType `json:"type"`
	// Value is the SNI carried on the TLS connection that needs to match for the configuration to be applied
	Value string `json:"value"`
}

```

### Core Architecture Module: `api/common/v1alpha1/selector.go`
```
// +kubebuilder:object:generate=true
package v1alpha1

import "github.com/kumahq/kuma/v3/pkg/util/pointer"

type LabelSelector struct {
	MatchLabels *map[string]string `json:"matchLabels,omitempty"`
}

func (s LabelSelector) Matches(labels map[string]string) bool {
	for tag, matchValue := range pointer.Deref(s.MatchLabels) {
		labelValue, exist := labels[tag]
		if !exist {
			return false
		}
		if matchValue != labelValue {
			return false
		}
	}
	return true
}

```

### Core Architecture Module: `api/common/v1alpha1/status.go`
```
// +kubebuilder:object:generate=true
package v1alpha1

import (
	kube_meta "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	GeneratedCondition           string = "Generated"
	BackendRefsResolvedCondition string = "BackendRefsResolved"
)

const (
	GeneratedReason              string = "Generated"
	TemplateErrorReason          string = "TemplateError"
	CollisionReason              string = "Collision"
	AllBackendRefsResolvedReason string = "AllBackendRefsResolved"
	UnresolvedBackendRefsReason  string = "UnresolvedBackendRefs"
)

type Condition struct {
	// type of condition in CamelCase or in foo.example.com/CamelCase.
	// ---
	// Many .condition.type values are consistent across resources like Available, but because arbitrary conditions can be
	// useful (see .node.status.conditions), the ability to deconflict is important.
	// The regex it matches is (dns1123SubdomainFmt/)?(qualifiedNameFmt)
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Pattern=`^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*/)?(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])$`
	// +kubebuilder:validation:MaxLength=316
	Type string `json:"type"`
	// status of the condition, one of True, False, Unknown.
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Enum=True;False;Unknown
	Status kube_meta.ConditionStatus `json:"status"`
	// reason contains a programmatic identifier indicating the reason for the condition's last transition.
	// Producers of specific condition types may define expected values and meanings for this field,
	// and whether the values are considered a guaranteed API.
	// The value should be a CamelCase string.
	// This field may not be empty.
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MaxLength=1024
	// +kubebuilder:validation:MinLength=1
	// +kubebuilder:validation:Pattern=`^[A-Za-z]([A-Za-z0-9_,:]*[A-Za-z0-9_])?$`
	Reason string `json:"reason"`
	// message is a human readable message indicating details about the transition.
	// This may be an empty string.
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MaxLength=32768
	Message string `json:"message"`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18924** (2026-09-30): **chore(merge): release-3.0 branch to master**
  *Symptoms*: **Do NOT squash on merging.** Allow merge commit first in the [repository settings](https://github.com/kumahq/kuma/settings).  Generated by [action](https://github.com/kumahq/kuma/actions/runs/36692562450)

- **Issue #18923** (2026-09-30): **ci(merge): use newest release branch for merge**
  *Symptoms*: ## Motivation  The "Merge release to master" workflow still merges `release-2.14` into master and ignores `release-3.0`.  `LATEST_RELEASE_BRANCH` is read from `versions.yml`, which `release-tool` only regenerates when a version ships. Between cutting a release branch and releasing it, the file still points at the previous branch. Pushes to `release-2.14` try to merge it into master (and fail on conflicts), while pushes to `release-3.0` are skipped.  ## Implementation information  - Derive `LATEST_RELEASE_BRANCH` from `origin/release-X.Y` refs sorted by version instead of `versions.yml`. The workflow checks out with `fetch-depth: 0`, so all release branches are present - Only exact `release-X.Y` names match, so branches like `renovate/release-2.14-...` are ignored - After the merge, rename `RUNNERS_RELEASE_X_Y_` back to `RUNNERS_MASTER_` in workflows. Release branches rename them after the cut (#18918 on `release-3.0`), and merging that into master fails the runner slug check in `validate-workflows-and-scripts.yaml`. Conflicted files are left unstaged so the merge still fails instead of committing conflict markers  Adding a 3.0 entry to `versions.yml` by hand was discarded: it's generated, and docs and e2e compatibility tests read it too.  The downstream project includes `mk/dev.mk` from the pinned version of this repo, so it picks up the fix with the next bump.  ## Supporting documentation  > Changelog: skip 

- **Issue #18922** (2026-09-30): **docs(MADR): clean up MADRs after 3.0**
  *Symptoms*: ## Motivation  `docs/madr/decisions/` serves as the map of why the current design looks the way it does. After 3.0, some MADRs describe features that no longer exist, and many others still hold but mention things 3.0 removed, which makes that map misleading.  ## Implementation information  ### Removed MADRs  MADRs whose subject is entirely gone in 3.0, or that were already superseded:  - `006-additional-retry-logic`: `retryOn` on the legacy `Retry` policy - `024-gateway-custom-deploy`: `PodTemplate` for `MeshGatewayInstance` (built-in gateway removed) - `025-disable-default-policies`: `skipCreatingInitialPolicies` (default policies removed) - `027-meshgateway-targetref`: `targetRef.kind: MeshGateway` - `033-deprecate-standalone`: `standalone` mode is removed - `036-internal-listeners`: already superseded by 077 - `037-configure-all-gateways`: `proxyTypes` on targetRef - `040-transition-to-new-policies`: shadow-mode migration from legacy policies - `045-meshhttproute-meshgateway`: routes on `MeshGateway` - `046-route-transition`: `TrafficRoute` vs `Mesh*Route` precedence - `060-meshservice-migration`: already superseded; `meshServices.mode` gating - `093-disallow-multiple-meshes-per-k8s-ns`: already superseded by 099  The MADRs that linked to removed files (070, 077, 085, 094, 099) now link to a permalink at the last commit that has them, and the removed entries were dropped from front-matter `related` lists.  ### New `outdated` front-matter field  MADRs whose decision still h

- **Issue #18918** (2026-09-29): **ci(runners): use release-3.0 runner variables**
  *Symptoms*: ## Motivation  `release-3.0` was cut from master with the workflows still reading `vars.RUNNERS_MASTER_<ARCH>`. `validate-workflows-and-scripts.yaml` fails every pull request against the branch until the slug matches, as described in `.github/workflows/README.md` under "Cutting a release branch".  ## Implementation information  - Replaced `RUNNERS_MASTER_` with `RUNNERS_RELEASE_3_0_` across the workflow YAML files on `release-3.0`, comments included. - Left `.github/workflows/README.md` alone, since it documents the master form and the cut procedure itself. - No `RUNNERS_*` variables are set on the repo or the org, so there is nothing to create alongside the rename.  > Changelog: skip 
  **Post-Mortem & Fix Analysis**:
  > ✅ **KSAI Review: Finished** 1. **`10:21 UTC`** Examining diff and workflow configs, checking conventions and references  ---  <details> <summary>Run report (federated) · 1 paid run · $0.2447 total</summary>  | # | Engine | Result | Model | Turns | Cost | | --- | --- | --- | --- | --- | --- | | [1](https://github.com/kumahq/kuma/actions/runs/36554739427) | `opencode` | `success` | `glm-5.3/high` | `24` | $0.2446 |  Reviewing cost $0.2446; deciding how to run it cost $0.0001  </details>  <!-- ksai-run-state:{"v":1,"flow":"review","conclusion":"success","stopped_by":null,"reviewed_commit":"c38f0a7500a68bec34bf3686c7716c7cf28c747e","model":"zai-org/GLM-5.3","effort":"high","selected_by":"input","dials_arm":null,"triage":{"source":"report","proposed_tier":"flagship","skipped_by":null,"skills":[],"reviewable_files":23,"reviewable_lines":80,"risk":true,"api_surface":false},"engine":"opencode","review_protocol":{"head_sha":"c38f0a7500a68bec34bf3686c7716c7cf28c747e","base_sha":"6ffae77bd3a33cc1

- **Issue #18917** (2026-09-29): **fix(xds): speed up Envoy stats tag extraction (backport of #18910)**
  *Symptoms*: Automatic cherry-pick of #18910 for branch release-2.11  Generated by [action](https://github.com/kumahq/kuma/actions/runs/36548711317)  cherry-picked commit 6ffae77bd3a33cc1f7f6db691df34e8ef213abf3  :warning: :warning: :warning: Conflicts happened when cherry-picking! :warning: :warning: :warning: ``` On branch release-2.11 Your branch is up to date with 'origin/release-2.11'.  You are currently cherry-picking commit 6ffae77bd3.   (fix conflicts and run "git cherry-pick --continue")   (use "git cherry-pick --skip" to skip this patch)   (use "git cherry-pick --abort" to cancel the cherry-pick operation)  Changes to be committed: 	modified:   pkg/xds/bootstrap/template_v3.go  Unmerged paths:   (use "git add <file>..." to mark resolution) 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.k8s.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.overridden.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.universal.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.custom-config-minimal-request.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.custom-config.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config-minimal-request.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config-token-path.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config.kubern

- **Issue #18916** (2026-09-29): **fix(xds): speed up Envoy stats tag extraction (backport of #18910)**
  *Symptoms*: Automatic cherry-pick of #18910 for branch master  Generated by [action](https://github.com/kumahq/kuma/actions/runs/36548711317)  cherry-picked commit 6ffae77bd3a33cc1f7f6db691df34e8ef213abf3

- **Issue #18915** (2026-09-29): **fix(xds): speed up Envoy stats tag extraction (backport of #18910)**
  *Symptoms*: Automatic cherry-pick of #18910 for branch release-2.9  Generated by [action](https://github.com/kumahq/kuma/actions/runs/36548711317)  cherry-picked commit 6ffae77bd3a33cc1f7f6db691df34e8ef213abf3  :warning: :warning: :warning: Conflicts happened when cherry-picking! :warning: :warning: :warning: ``` On branch release-2.9 Your branch is up to date with 'origin/release-2.9'.  You are currently cherry-picking commit 6ffae77bd3.   (fix conflicts and run "git cherry-pick --continue")   (use "git cherry-pick --skip" to skip this patch)   (use "git cherry-pick --abort" to cancel the cherry-pick operation)  Changes to be committed: 	modified:   pkg/xds/bootstrap/template_v3.go  Unmerged paths:   (use "git add <file>..." to mark resolution) 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.k8s.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.overridden.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.universal.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.custom-config-minimal-request.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.custom-config.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config-minimal-request.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config-token-path.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config.kubernete

- **Issue #18914** (2026-09-29): **fix(xds): speed up Envoy stats tag extraction (backport of #18910)**
  *Symptoms*: Automatic cherry-pick of #18910 for branch release-2.7  Generated by [action](https://github.com/kumahq/kuma/actions/runs/36548711317)  cherry-picked commit 6ffae77bd3a33cc1f7f6db691df34e8ef213abf3  :warning: :warning: :warning: Conflicts happened when cherry-picking! :warning: :warning: :warning: ``` On branch release-2.7 Your branch is up to date with 'origin/release-2.7'.  You are currently cherry-picking commit 6ffae77bd3.   (fix conflicts and run "git cherry-pick --continue")   (use "git cherry-pick --skip" to skip this patch)   (use "git cherry-pick --abort" to cancel the cherry-pick operation)  Changes to be committed: 	modified:   pkg/xds/bootstrap/template_v3.go  Unmerged paths:   (use "git add <file>..." to mark resolution) 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.gateway.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.k8s.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.overridden.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/bootstrap.universal.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.custom-config-minimal-request.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.custom-config.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config-minimal-request.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config-token-path.golden.yaml 	both modified:   pkg/xds/bootstrap/testdata/generator.default-config.golden.yaml 	bot

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

### Incident Patch 1: `6ffae77b` (2026-09-29)
**Commit Message**: fix(xds): speed up Envoy stats tag extraction (#18910)

Signed-off-by: Bart Smykla <bartek@smykla.com>

**File**: `pkg/xds/bootstrap/template_v3.go` (modified, +18/-4)
```diff
@@ -106,22 +106,36 @@ func genConfig(parameters configParameters, enableReloadableTokens bool, _ *core
 			Layers: runtimeLayers,
 		},
 		StatsConfig: &envoy_metrics_v3.StatsConfig{
+			// Envoy runs a regex tag (std::regex) on every stat name unless the regex starts with "^<token>\.", so scope tags to a root token
 			StatsTags: []*envoy_metrics_v3.TagSpecifier{
 				{
 					TagName:  "name",
 					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^grpc\\.((.+)\\.)"},
 				},
 				{
 					TagName:  "status",
-					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^grpc.*streams_closed(_([0-9]+))"},
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^grpc\\..*streams_closed(_([0-9]+))"},
 				},
 				{
 					TagName:  "worker",
-					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "(worker_([0-9]+)\\.)"},
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^listener\\..*?(worker_([0-9]+)\\.)"},
 				},
 				{
-					TagName:  "listener",
-					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "((.+?)\\.)rbac\\."},
+					TagName:  "worker",
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^listener_manager\\..*?(worker_([0-9]+)\\.)"},
+				},
+				{
+					TagName:  "worker",
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^server\\..*?(worker_([0-9]+)\\.)"},
+				},
+				{
+					TagName:  "worker",
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^thread_local_cluster_manager\\..*?(worker_([0-9]+)\\.)"},
+				},
+				{
+					TagName: "listener",
+					// no root token (network RBAC stats start with the listener stat prefix), "^" at least avoids a quadratic retry at every offset
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^((.+?)\\.)rbac\\."},
 				},
 			},
 		},
```

**File**: `pkg/xds/bootstrap/testdata/bootstrap.k8s.golden.yaml` (modified, +9/-3)
```diff
@@ -129,9 +129,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/bootstrap.overridden.golden.yaml` (modified, +9/-3)
```diff
@@ -141,9 +141,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/bootstrap.universal.golden.yaml` (modified, +9/-3)
```diff
@@ -129,9 +129,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/generator.custom-config-minimal-request.golden.yaml` (modified, +9/-3)
```diff
@@ -135,9 +135,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

---

### Incident Patch 2: `0d668b4e` (2026-09-28)
**Commit Message**: fix(kuma-dp): avoid double scrape on otel export (backport of #18871) (#18906)

Signed-off-by: Bart Smykla <bartek@smykla.com>
Co-authored-by: Bart Smykla <bartek@smykla.com>

**File**: `app/kuma-dp/pkg/dataplane/metrics/server.go` (modified, +4/-2)
```diff
@@ -221,12 +221,14 @@ func (s *Hijacker) Start(stop <-chan struct{}) error {
 		ErrorLog:          adapter.ToStd(logger),
 	}
 
-	promExporter, err := prometheus.New(prometheus.WithProducer(s.producer), prometheus.WithTranslationStrategy(otlptranslator.UnderscoreEscapingWithoutSuffixes))
+	// not the default registry: the OTel self metrics bridge gathers it and would scrape applications again
+	registry := prom_client.NewRegistry()
+	promExporter, err := prometheus.New(prometheus.WithRegisterer(registry), prometheus.WithProducer(s.producer), prometheus.WithTranslationStrategy(otlptranslator.UnderscoreEscapingWithoutSuffixes))
 	if err != nil {
 		return err
 	}
 	sdkmetric.NewMeterProvider(sdkmetric.WithReader(promExporter))
-	s.prometheusHandler = promhttp.HandlerFor(prom_client.DefaultGatherer, promhttp.HandlerOpts{
+	s.prometheusHandler = promhttp.HandlerFor(prom_client.Gatherers{prom_client.DefaultGatherer, registry}, promhttp.HandlerOpts{
 		ErrorHandling: promhttp.ContinueOnError,
 	})
 
```

**File**: `app/kuma-dp/pkg/dataplane/metrics/server_test.go` (modified, +76/-0)
```diff
@@ -2,16 +2,23 @@ package metrics
 
 import (
 	"io"
+	"net"
 	"net/http"
+	"net/http/httptest"
 	"net/url"
 	"os"
 	"path"
+	"path/filepath"
+	"strconv"
+	"sync/atomic"
 
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	prom_client "github.com/prometheus/client_golang/prometheus"
 	"github.com/prometheus/common/expfmt"
 
 	"github.com/kumahq/kuma/v3/pkg/plugins/policies/meshmetric/api/v1alpha1"
+	meshmetric_plugin "github.com/kumahq/kuma/v3/pkg/plugins/policies/meshmetric/plugin/v1alpha1"
 )
 
 var (
@@ -91,6 +98,75 @@ var _ = Describe("Rewriting the metrics URL", func() {
 	)
 })
 
+var _ = Describe("MeshMetric Prometheus endpoint", func() {
+	var hits atomic.Int64
+	var body string
+
+	BeforeEach(func() {
+		hits.Store(0)
+		app := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
+			hits.Add(1)
+			w.Header().Set(hdrContentType, "text/plain; charset=UTF-8")
+			_, _ = w.Write([]byte("# TYPE test_app_requests counter\ntest_app_requests 1\n"))
+		}))
+		DeferCleanup(app.Close)
+		host, portStr, err := net.SplitHostPort(app.Listener.Addr().String())
+		Expect(err).ToNot(HaveOccurred())
+		port, err := strconv.ParseUint(portStr, 10, 32)
+		Expect(err).ToNot(HaveOccurred())
+
+		producer := NewAggregatedMetricsProducer([]ApplicationToScrape{{
+			Name:              "app",
+			Address:           host,
+			Port:              uint32(port),
+			Path:              "/metrics",
+			QueryModifier:     RemoveQueryParameters,
+			MeshMetricMutator: AggregatedOtelMutator(),
+		}}, false, "dev")
+
+		// not GinkgoT().TempDir(), unix socket paths are capped at ~104 chars on macOS
+		dir, err := os.MkdirTemp("", "hijacker")
+		Expect(err).ToNot(HaveOccurred())
+		DeferCleanup(os.RemoveAll, dir)
+		socketPath := filepath.Join(dir, "metrics.sock")
+
+		stop := make(chan struct{})
+		hijacker := New(socketPath, nil, false, producer)
+		go func() {
+			defer GinkgoRecover()
+			Expect(hijacker.Start(stop)).To(Succeed())
+		}()
+		DeferCleanup(func() { close(stop) })
+		Eventually(func() error {
+			_, err := os.Stat(socketPath)
+			return err
+		}).Should(Succeed())
+
+		client := createHTTPClientForUDS(socketPath)
+		resp, err := client.Get("http://localhost" + meshmetric_plugin.PrometheusDataplaneStatsPath)
+		Expect(err).ToNot(HaveOccurred())
+		defer resp.Body.Close()
+		b, err := io.ReadAll(resp.Body)
+		Expect(err).ToNot(HaveOccurred())
+		body = string(b)
+	})
+
+	It("should serve application and kuma-dp metrics", func() {
+		Expect(body).To(ContainSubstring("test_app_requests"))
+		Expect(body).To(ContainSubstring("go_goroutines"))
+		Expect(hits.Load()).To(BeEquivalentTo(1))
+	})
+
+	It("should not scrape applications when the default gatherer is gathered", func() {
+		hits.Store(0)
+
+		_, err := prom_client.DefaultGatherer.Gather()
+
+		Expect(err).ToNot(HaveOccurred())
+		Expect(hits.Load()).To(BeZero())
+	})
+})
+
 var _ = Describe("Select Content Type", func() {
 	var reqHeader http.Header
 	BeforeEach(func() {
```

---

### Incident Patch 3: `fc365032` (2026-09-28)
**Commit Message**: chore(lint): fix golangci-lint 2.14.0 findings (#18904)

Signed-off-by: Ilya Lobkov <ilya.lobkov@konghq.com>

**File**: `app/kuma-dp/pkg/dataplane/metrics/metrics_format_mapper.go` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ func FromPrometheusMetrics(appMetrics map[string]*io_prometheus_client.MetricFam
 			case io_prometheus_client.MetricType_HISTOGRAM:
 				scopedAggregations = scopedHistograms(prometheusMetric.Metric, kumaVersion, extraAttributes, requestTime)
 			default:
-				log.Info("got unsupported metric type", "type", prometheusMetric.Type)
+				log.Info("got unsupported metric type", "type", prometheusMetric.GetType())
 			}
 			for scope, aggregations := range scopedAggregations {
 				scopedMetrics[scope] = append(scopedMetrics[scope], metricdata.Metrics{
```

**File**: `pkg/kds/client/stream.go` (modified, +2/-3)
```diff
@@ -285,10 +285,9 @@ func (s *stream) NACK(resourceType core_model.ResourceType, err error) error {
 func (s *stream) mapRemovedResources(removedResourceNames []string) []core_model.ResourceKey {
 	removed := []core_model.ResourceKey{}
 	for _, resourceName := range removedResourceNames {
-		index := strings.LastIndex(resourceName, ".")
 		var rk core_model.ResourceKey
-		if index != -1 {
-			rk = core_model.WithMesh(resourceName[index+1:], resourceName[:index])
+		if name, mesh, found := strings.CutLast(resourceName, "."); found {
+			rk = core_model.WithMesh(mesh, name)
 		} else {
 			rk = core_model.WithoutMesh(resourceName)
 		}
```

**File**: `pkg/kds/mux/zone_watch.go` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ func (zw *ZoneWatch) cleanupStaleConnections(zone zoneTenant, zoneInsight *syste
 			ctx := multitenant.WithTenant(context.TODO(), zone.tenantID)
 			log := kuma_log.AddFieldsFromCtx(zw.log, ctx, zw.extensions)
 			log.Info("the same zone has connected but the previous connection wasn't closed, closing",
-				"zone", zone.zone, "streamType", stream, "previouslyConnected", connOpenTime, "currentlyConnected", activeStreamConnTime)
+				"zone", zone.zone, "streamType", stream, "previouslyConnected", connOpenTime, "currentlyConnected", *activeStreamConnTime)
 			zw.bus.Send(service.StreamCancelled{
 				Zone:     zone.zone,
 				TenantID: zone.tenantID,
```

**File**: `pkg/util/k8s/name_converter.go` (modified, +4/-5)
```diff
@@ -11,16 +11,15 @@ import (
 )
 
 func CoreNameToK8sName(coreName string) (string, string, error) {
-	idx := strings.LastIndex(coreName, ".")
-	if idx == -1 {
+	// namespace cannot contain "." therefore it's always the last part
+	name, namespace, found := strings.CutLast(coreName, ".")
+	if !found {
 		return "", "", errors.Errorf(`name %q must include namespace after the dot, ex. "name.namespace"`, coreName)
 	}
-	// namespace cannot contain "." therefore it's always the last part
-	namespace := coreName[idx+1:]
 	if namespace == "" {
 		return "", "", errors.New("namespace must be non-empty")
 	}
-	return coreName[:idx], namespace, nil
+	return name, namespace, nil
 }
 
 func K8sNamespacedNameToCoreName(name, namespace string) string {
```

---

### Incident Patch 4: `4d0f6aae` (2026-09-28)
**Commit Message**: fix(meshservice): reconcile generated selector (#18876)

Signed-off-by: Lukasz Dziedziak <lukidzi@gmail.com>

**File**: `pkg/core/resources/apis/meshservice/generate/generator.go` (modified, +4/-1)
```diff
@@ -196,8 +196,11 @@ func checkMeshServicesConsistency(
 	return conflicting, meshService
 }
 
+// servicesDiffer compares the selector too: a MeshService generated from a
+// kuma.io/service tag keeps its name under kuma.io/workload generation, so only
+// the selector shows it no longer matches its Dataplanes.
 func servicesDiffer(a, b *meshservice_api.MeshService) bool {
-	return !reflect.DeepEqual(a.Ports, b.Ports)
+	return !reflect.DeepEqual(a.Ports, b.Ports) || !reflect.DeepEqual(a.Selector, b.Selector)
 }
 
 func desiredLabels(mesh, name, zone string, propagated map[string]string) map[string]string {
```

**File**: `pkg/core/resources/apis/meshservice/generate/generator_test.go` (modified, +31/-0)
```diff
@@ -475,6 +475,37 @@ var _ = Describe("MeshService generator", func() {
 		}, "2s", "100ms").Should(Succeed())
 	})
 
+	// A MeshService generated from kuma.io/service inbound tags keeps its name when
+	// generation switches to kuma.io/workload, so only the selector tells it apart.
+	It("should rewrite the selector of a MeshService whose ports already match", func() {
+		stale := meshservice_api.NewMeshServiceResource()
+		stale.Spec.Ports = []meshservice_api.Port{{
+			Name:        pointer.To("80"),
+			Port:        80,
+			TargetPort:  pointer.To(intstr.FromInt(80)),
+			AppProtocol: core_meta.ProtocolTCP,
+		}}
+		Expect(resManager.Create(context.Background(), stale,
+			store.CreateByKey("backend", model.DefaultMesh),
+			store.CreateWithLabels(map[string]string{
+				mesh_proto.ManagedByLabel:      "meshservice-generator",
+				mesh_proto.ResourceOriginLabel: string(mesh_proto.ZoneResourceOrigin),
+				mesh_proto.ZoneTag:             "zone",
+			}),
+		)).To(Succeed())
+
+		Expect(createBackendDataplane(backendDataplane())).To(Succeed())
+
+		Eventually(func(g Gomega) {
+			ms := meshservice_api.NewMeshServiceResource()
+			g.Expect(resManager.Get(context.Background(), ms, store.GetByKey("backend", model.DefaultMesh))).To(Succeed())
+			g.Expect(ms.Spec.Selector.DataplaneLabels).ToNot(BeNil())
+			g.Expect(ms.Spec.Selector.DataplaneLabels.MatchLabels).To(HaveValue(Equal(map[string]string{
+				metadata.KumaWorkload: "backend",
+			})))
+		}, "2s", "100ms").Should(Succeed())
+	})
+
 	It("should emit metric", func() {
 		Eventually(func(g Gomega) {
 			g.Expect(test_metrics.FindMetric(metrics, "component_meshservice_generator")).ToNot(BeNil())
```

---

### Incident Patch 5: `1d618a5b` (2026-09-28)
**Commit Message**: fix(meshpassthrough): correct validator typo (#18879)

Signed-off-by: Lukasz Dziedziak <lukidzi@gmail.com>

**File**: `pkg/plugins/policies/meshpassthrough/api/v1alpha1/testdata/full-invalid.output.yaml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ violations:
 - field: spec.default.appendMatch[7].value
   message: provided DNS has incorrect value, partial wildcard is currently not supported
 - field: spec.default.appendMatch[9].value
-  message: value google.com is already defiend for this port and protocol
+  message: value google.com is already defined for this port and protocol
 - field: spec.default.appendMatch[10].port
   message: wildcard domains doesn't work for all ports and layer 7 protocol
 - field: spec.default.appendMatch[11].protocol
```

**File**: `pkg/plugins/policies/meshpassthrough/api/v1alpha1/validator.go` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ func validateDefault(conf Conf) validators.ValidationError {
 			}
 			if _, found := uniqueDomains[key]; found {
 				if _, found := uniqueDomains[key][match.Value]; found {
-					verr.AddViolationAt(validators.RootedAt("appendMatch").Index(i).Field("value"), fmt.Sprintf("value %s is already defiend for this port and protocol", match.Value))
+					verr.AddViolationAt(validators.RootedAt("appendMatch").Index(i).Field("value"), fmt.Sprintf("value %s is already defined for this port and protocol", match.Value))
 				} else {
 					uniqueDomains[key][match.Value] = true
 				}
```

---

### Incident Patch 6: `c122f5f7` (2026-09-28)
**Commit Message**: fix(kds): keep 2.14 zones serving MeshServices behind a 3.0 global (#18870)

Signed-off-by: Bart Smykla <bartek@smykla.com>

**File**: `UPGRADE.md` (modified, +18/-4)
```diff
@@ -1102,14 +1102,28 @@ already behaviourally identical, so no other changes are required.
 
 ### `meshServices` removed from the `Mesh` schema
 
-The `meshServices` field (and its `mode` enum) has been removed from the
-`Mesh` resource spec. Unified resource naming is now unconditional,
+The `meshServices` field (and its `mode` enum) no longer has any effect on
+the `Mesh` resource. Unified resource naming is now unconditional,
 regardless of what the mesh's former `meshServices.mode` was set to.
 
+The field remains in the schema as deprecated so that stored values survive
+the upgrade and keep syncing to zones over KDS: zones before 3.0 read a
+missing field as `Disabled`, which makes them delete every generated
+`MeshService`, skip mesh-scoped zone proxy listeners, and stop serving
+`MeshService` outbounds and DNS. Zones on 3.0 ignore the field, and writes
+setting it to any mode other than `Exclusive` are rejected, because that
+mode would silently behave as `Exclusive`.
+
 **Action required**
 
-None. A `Mesh` spec that still sets `meshServices` continues to apply
-successfully; the field is silently ignored by the control plane.
+Set `meshServices.mode: Exclusive` on every mesh before upgrading the
+global control plane, including meshes that never set the field: a 2.x
+zone reads a missing field as `Disabled`. The 3.0 global then keeps syncing
+the stored mode, and 2.x zones keep serving `MeshServices` until they are
+upgraded. A mesh that still carries another mode when the global is
+upgraded is rejected by 3.0 zones over KDS until it is set to `Exclusive`.
+A write that carries the field with `Exclusive` still applies and returns a
+deprecation warning; drop the field from your manifests.
 
 ### `routing.zoneEgress` removed from the `Mesh` schema
 
```

**File**: `api/mesh/v1alpha1/mesh.pb.go` (modified, +143/-14)
```diff
@@ -22,9 +22,72 @@ const (
 	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
 )
 
+type Mesh_MeshServices_Mode int32
+
+const (
+	// MeshServices aren't generated
+	Mesh_MeshServices_Disabled Mesh_MeshServices_Mode = 0
+	// MeshServices are generated and used for configuration
+	Mesh_MeshServices_Everywhere Mesh_MeshServices_Mode = 1
+	// MeshServices are generated but only used for configuration where
+	// configured via reachableBackends
+	Mesh_MeshServices_ReachableBackends Mesh_MeshServices_Mode = 2
+	// MeshServices are generated, used for configuration and kuma.io/services
+	// are not used
+	Mesh_MeshServices_Exclusive Mesh_MeshServices_Mode = 3
+)
+
+// Enum value maps for Mesh_MeshServices_Mode.
+var (
+	Mesh_MeshServices_Mode_name = map[int32]string{
+		0: "Disabled",
+		1: "Everywhere",
+		2: "ReachableBackends",
+		3: "Exclusive",
+	}
+	Mesh_MeshServices_Mode_value = map[string]int32{
+		"Disabled":          0,
+		"Everywhere":        1,
+		"ReachableBackends": 2,
+		"Exclusive":         3,
+	}
+)
+
+func (x Mesh_MeshServices_Mode) Enum() *Mesh_MeshServices_Mode {
+	p := new(Mesh_MeshServices_Mode)
+	*p = x
+	return p
+}
+
+func (x Mesh_MeshServices_Mode) String() string {
+	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
+}
+
+func (Mesh_MeshServices_Mode) Descriptor() protoreflect.EnumDescriptor {
+	return file_api_mesh_v1alpha1_mesh_proto_enumTypes[0].Descriptor()
+}
+
+func (Mesh_MeshServices_Mode) Type() protoreflect.EnumType {
+	return &file_api_mesh_v1alpha1_mesh_proto_enumTypes[0]
+}
+
+func (x Mesh_MeshServices_Mode) Number() protoreflect.EnumNumber {
+	return protoreflect.EnumNumber(x)
+}
+
+// Deprecated: Use Mesh_MeshServices_Mode.Descriptor instead.
+func (Mesh_MeshServices_Mode) EnumDescriptor() ([]byte, []int) {
+	return file_api_mesh_v1alpha1_mesh_proto_rawDescGZIP(), []int{0, 0, 0}
+}
+
 // Mesh defines configuration of a single mesh.
 type Mesh struct {
-	state         protoimpl.MessageState `protogen:"open.v1"`
+	state protoimpl.MessageState `protogen:"open.v1"`
+	// Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+	// Kept only so pre-3.0 zones keep receiving the mode over KDS.
+	//
+	// Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+	MeshServices  *Mesh_MeshServices `protobuf:"bytes,9,opt,name=meshServices,proto3" json:"meshServices,omitempty"`
 	unknownFields protoimpl.UnknownFields
 	sizeCache     protoimpl.SizeCache
 }
@@ -59,15 +122,75 @@ func (*Mesh) Descriptor() ([]byte, []int) {
 	return file_api_mesh_v1alpha1_mesh_proto_rawDescGZIP(), []int{0}
 }
 
+// Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+func (x *Mesh) GetMeshServices() *Mesh_MeshServices {
+	if x != nil {
+		return x.MeshServices
+	}
+	return nil
+}
+
+type Mesh_MeshServices struct {
+	state         protoimpl.MessageState `protogen:"open.v1"`
+	Mode          Mesh_MeshServices_Mode `protobuf:"varint,1,opt,name=mode,proto3,enum=kuma.mesh.v1alpha1.Mesh_MeshServices_Mode" json:"mode,omitempty"`
+	unknownFields protoimpl.UnknownFields
+	sizeCache     protoimpl.SizeCache
+}
+
+func (x *Mesh_MeshServices) Reset() {
+	*x = Mesh_MeshServices{}
+	mi := &file_api_mesh_v1alpha1_mesh_proto_msgTypes[1]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
+}
+
+func (x *Mesh_MeshServices) String() string {
+	return protoimpl.X.MessageStringOf(x)
+}
+
+func (*Mesh_MeshServices) ProtoMessage() {}
+
+func (x *Mesh_MeshServices) ProtoReflect() protoreflect.Message {
+	mi := &file_api_mesh_v1alpha1_mesh_proto_msgTypes[1]
+	if x != nil {
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		if ms.LoadMessageInfo() == nil {
+			ms.StoreMessageInfo(mi)
+		}
+		return ms
+	}
+	return mi.MessageOf(x)
+}
+
+// Deprecated: Use Mesh_MeshServices.ProtoReflect.Descriptor instead.
+func (*Mesh_MeshServices) Descriptor() ([]byte, []int) {
+	return file_api_mesh_v1alpha1_mesh_proto_rawDescGZIP(), []int{0, 0}
+}
+
+func (x *M
```

**File**: `api/mesh/v1alpha1/mesh.proto` (modified, +20/-1)
```diff
@@ -42,5 +42,24 @@ message Mesh {
   reserved 8;
   reserved "skipCreatingInitialPolicies";
 
-  reserved 9; // formerly meshServices
+  // Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+  // Kept only so pre-3.0 zones keep receiving the mode over KDS.
+  MeshServices meshServices = 9 [deprecated = true];
+
+  message MeshServices {
+    Mode mode = 1;
+
+    enum Mode {
+      // MeshServices aren't generated
+      Disabled = 0;
+      // MeshServices are generated and used for configuration
+      Everywhere = 1;
+      // MeshServices are generated but only used for configuration where
+      // configured via reachableBackends
+      ReachableBackends = 2;
+      // MeshServices are generated, used for configuration and kuma.io/services
+      // are not used
+      Exclusive = 3;
+    }
+  }
 }
```

**File**: `api/mesh/v1alpha1/mesh/rest.yaml` (modified, +15/-0)
```diff
@@ -66,6 +66,21 @@ components:
           additionalProperties:
             type: string
           type: object
+        meshServices:
+          description: |-
+            Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+            Kept only so pre-3.0 zones keep receiving the mode over KDS.
+
+            Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+          properties:
+            mode:
+              enum:
+              - Disabled
+              - Everywhere
+              - ReachableBackends
+              - Exclusive
+              type: string
+          type: object
         modificationTime:
           description: Time at which the resource was updated
           format: date-time
```

**File**: `api/mesh/v1alpha1/meshoverview/schema.yaml` (modified, +16/-1)
```diff
@@ -4,7 +4,22 @@ components:
       description: MeshOverview defines the projected state of a Mesh.
       properties:
         mesh:
-          properties: {}
+          properties:
+            meshServices:
+              description: |-
+                Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+                Kept only so pre-3.0 zones keep receiving the mode over KDS.
+
+                Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+              properties:
+                mode:
+                  enum:
+                  - Disabled
+                  - Everywhere
+                  - ReachableBackends
+                  - Exclusive
+                  type: string
+              type: object
           type: object
         meshInsight:
           properties:
```

---

### Incident Patch 7: `b1af7b03` (2026-09-28)
**Commit Message**: fix(xds): validate labels of the Dataplane passed to kuma-dp run (#18898)

Signed-off-by: Ilya Lobkov <ilya.lobkov@konghq.com>

**File**: `UPGRADE.md` (modified, +2/-1)
```diff
@@ -20,8 +20,8 @@ None for most meshes. TLS 1.3 cipher suites are not configurable, so `tlsCiphers
 
 From now on, `kuma.io/` and `k8s.kuma.io/` are reserved label prefixes.
 Every unknown label under these prefixes will be rejected on create and update.
+On Universal this includes the labels of the `Dataplane` passed to `kuma-dp run`: a proxy whose `Dataplane` carries an unknown reserved label, such as a leftover `kuma.io/gateway: "true"`, or an invalid label value fails to register until the label is fixed.
 
-<<<<<<< HEAD
 ### Zone Token issuance moved to the KDS auth configuration
 
 A Zone Token now has one job, authenticating a Zone CP to a Global CP over KDS, so the setting that gates its issuance sits with the rest of the KDS authentication configuration. `dpServer.authn.zoneProxy` is removed, it configured the authentication of zone proxies, which are ordinary data plane proxies authenticating with a dataplane token since 3.0.0.
@@ -40,6 +40,7 @@ A Zone Token now has one job, authenticating a Zone CP to a Global CP over KDS,
 **Action required**
 
 Only if you set `enableIssuer` to `false` to mint Zone Tokens offline. Move it to `multizone.global.kds.auth.zoneToken.enableIssuer` on the Global CP, the removed setting is ignored and the issuer is enabled again. The other removed settings had no effect, `dpServer.authn.zoneProxy.zoneToken.validator` was read by nothing and `dpServer.authn.zoneProxy.type` was autoconfigured and never consumed.
+
 ### Resources with fields that are not in the schema are rejected
 
 Applying a policy or resource with a field that does not exist in its schema now fails with `400` listing every unknown field, for example `spec.from: unknown field`. Previously such fields were silently dropped, so a policy written for an older version, such as a `MeshTrafficPermission` with `spec.from` instead of `spec.rules`, was stored without it and looked applied while doing nothing. The check covers policies and resources with a generated schema; legacy resources without one, such as `Mesh`, still drop unknown fields silently. It applies to the Kuma API server and `kumactl apply`. On Kubernetes, `kubectl apply` behavior is unchanged: the API server prunes unknown fields and prints a warning.
```

**File**: `pkg/xds/server/callbacks/dataplane_lifecycle.go` (modified, +14/-0)
```diff
@@ -12,6 +12,7 @@ import (
 	mesh_proto "github.com/kumahq/kuma/v3/api/mesh/v1alpha1"
 	"github.com/kumahq/kuma/v3/pkg/core"
 	core_mesh "github.com/kumahq/kuma/v3/pkg/core/resources/apis/mesh"
+	resource_labels "github.com/kumahq/kuma/v3/pkg/core/resources/labels"
 	"github.com/kumahq/kuma/v3/pkg/core/resources/manager"
 	core_model "github.com/kumahq/kuma/v3/pkg/core/resources/model"
 	"github.com/kumahq/kuma/v3/pkg/core/resources/store"
@@ -39,6 +40,7 @@ type DataplaneLifecycle struct {
 	deregistrationDelay time.Duration
 	cpInstanceID        string
 	cacheExpirationTime time.Duration
+	cp                  resource_labels.ControlPlane
 }
 
 type proxyInfo struct {
@@ -56,6 +58,7 @@ func NewDataplaneLifecycle(
 	deregistrationDelay time.Duration,
 	cpInstanceID string,
 	cacheExpirationTime time.Duration,
+	cp resource_labels.ControlPlane,
 ) *DataplaneLifecycle {
 	return &DataplaneLifecycle{
 		resManager:          resManager,
@@ -65,6 +68,7 @@ func NewDataplaneLifecycle(
 		deregistrationDelay: deregistrationDelay,
 		cpInstanceID:        cpInstanceID,
 		cacheExpirationTime: cacheExpirationTime,
+		cp:                  cp,
 	}
 }
 
@@ -81,6 +85,16 @@ func (d *DataplaneLifecycle) OnProxyConnected(streamID core_xds.StreamID, proxyK
 	if err := d.validateProxyKey(proxyKey, md.Resource); err != nil {
 		return err
 	}
+	if verr := resource_labels.Validate(resource_labels.Write{
+		Descriptor:  md.Resource.Descriptor(),
+		Spec:        md.Resource.GetSpec(),
+		Namespace:   resource_labels.UnsetNamespace,
+		Mesh:        md.Resource.GetMeta().GetMesh(),
+		DisplayName: md.Resource.GetMeta().GetName(),
+		Labels:      md.Resource.GetMeta().GetLabels(),
+	}, d.cp); verr.HasViolations() {
+		return errors.Wrap(&verr, "invalid labels of the proxy resource passed in kuma-dp run")
+	}
 	return d.register(ctx, streamID, proxyKey, md)
 }
 
```

**File**: `pkg/xds/server/callbacks/dataplane_lifecycle_test.go` (modified, +54/-1)
```diff
@@ -16,7 +16,9 @@ import (
 	"google.golang.org/protobuf/types/known/structpb"
 
 	mesh_proto "github.com/kumahq/kuma/v3/api/mesh/v1alpha1"
+	config_core "github.com/kumahq/kuma/v3/pkg/config/core"
 	core_mesh "github.com/kumahq/kuma/v3/pkg/core/resources/apis/mesh"
+	resource_labels "github.com/kumahq/kuma/v3/pkg/core/resources/labels"
 	core_manager "github.com/kumahq/kuma/v3/pkg/core/resources/manager"
 	core_model "github.com/kumahq/kuma/v3/pkg/core/resources/model"
 	core_store "github.com/kumahq/kuma/v3/pkg/core/resources/store"
@@ -53,7 +55,7 @@ var _ = Describe("Dataplane Lifecycle", func() {
 		resManager = core_manager.NewResourceManager(store)
 		ctx, cancel = context.WithCancel(context.Background())
 
-		dpLifecycle := NewDataplaneLifecycle(ctx, resManager, authenticator, 0*time.Second, cpInstanceID, 0*time.Second)
+		dpLifecycle := NewDataplaneLifecycle(ctx, resManager, authenticator, 0*time.Second, cpInstanceID, 0*time.Second, resource_labels.ControlPlane{Mode: config_core.Zone, Zone: "zone-1"})
 		callbacks = util_xds_v3.AdaptDeltaCallbacks(DataplaneCallbacksToXdsCallbacks(dpLifecycle))
 
 		err := resManager.Create(context.Background(), core_mesh.NewMeshResource(), core_store.CreateByKey(core_model.DefaultMesh, core_model.NoMesh))
@@ -176,6 +178,57 @@ var _ = Describe("Dataplane Lifecycle", func() {
             `),
 	)
 
+	DescribeTable("should reject a DP with invalid labels instead of registering it", func(labels string, expectedErr string) {
+		// given
+		req := envoy_sd.DeltaDiscoveryRequest{
+			Node: &envoy_core.Node{
+				Id: "default.backend-01",
+				Metadata: &structpb.Struct{
+					Fields: map[string]*structpb.Value{
+						"dataplane.resource": {
+							Kind: &structpb.Value_StringValue{
+								StringValue: fmt.Sprintf(`
+                                {
+                                  "type": "Dataplane",
+                                  "mesh": "default",
+                                  "name": "backend-01",
+                                  "labels": %s,
+                                  "networking": {
+                                    "address": "127.0.0.1",
+                                    "inbound": [
+                                      {
+                                        "port": 22022,
+                                        "servicePort": 8443
+                                      }
+                                    ]
+                                  }
+                                }
+                                `, labels),
+							},
+						},
+					},
+				},
+			},
+		}
+		const streamId = 123
+		ctx := metadata.NewIncomingContext(context.Background(), map[string][]string{
+			"authorization": {"token"},
+		})
+		Expect(callbacks.OnDeltaStreamOpen(ctx, streamId, "")).To(Succeed())
+
+		// when
+		err := callbacks.OnStreamDeltaRequest(streamId, &req)
+
+		// then
+		Expect(err).To(MatchError(ContainSubstring(expectedErr)))
+		err = resManager.Get(context.Background(), core_mesh.NewDataplaneResource(), core_store.GetByKey("backend-01", "default"))
+		Expect(core_store.IsNotFound(err)).To(BeTrue())
+	},
+		Entry("unknown reserved key", `{"kuma.io/gateway": "true"}`, `label "kuma.io/gateway" is reserved and not known to this control plane`),
+		Entry("control plane owned label with a wrong value", `{"kuma.io/zone": "zone-2"}`, `kuma.io/zone label should have zone-1 value`),
+		Entry("malformed value", `{"app": "not valid!!"}`, `a valid label must be an empty string or consist of alphanumeric characters`),
+	)
+
 	It("should not override extisting DP with different service", func() {
 		// given already created DP
 		dp := &core_mesh.DataplaneResource{
```

**File**: `pkg/xds/server/v3/components.go` (modified, +2/-1)
```diff
@@ -12,6 +12,7 @@ import (
 	"google.golang.org/protobuf/types/known/structpb"
 
 	"github.com/kumahq/kuma/v3/pkg/core"
+	resource_labels "github.com/kumahq/kuma/v3/pkg/core/resources/labels"
 	core_runtime "github.com/kumahq/kuma/v3/pkg/core/runtime"
 	util_xds "github.com/kumahq/kuma/v3/pkg/util/xds"
 	util_xds_v3 "github.com/kumahq/kuma/v3/pkg/util/xds/v3"
@@ -39,7 +40,7 @@ func RegisterXDS(
 	workloadLabelValidator := xds_callbacks.DataplaneCallbacksToXdsCallbacks(xds_callbacks.NewWorkloadLabelValidator(rt.ReadOnlyResourceManager(), rt.Config().Environment))
 
 	dpLifecycle := xds_callbacks.DataplaneCallbacksToXdsCallbacks(
-		xds_callbacks.NewDataplaneLifecycle(rt.AppContext(), rt.ResourceManager(), authenticator, rt.Config().XdsServer.DataplaneDeregistrationDelay.Duration, rt.GetInstanceId(), rt.Config().Store.Cache.ExpirationTime.Duration))
+		xds_callbacks.NewDataplaneLifecycle(rt.AppContext(), rt.ResourceManager(), authenticator, rt.Config().XdsServer.DataplaneDeregistrationDelay.Duration, rt.GetInstanceId(), rt.Config().Store.Cache.ExpirationTime.Duration, resource_labels.ControlPlaneFromConfig(rt.Config())))
 	reconciler := DefaultReconciler(rt, xdsContext, statsCallbacks, xdsMetrics)
 	otelStatusCache := otelstatus.NewCache()
 	watchdogFactory, err := xds_sync.DefaultDataplaneWatchdogFactory(rt, reconciler, xdsMetrics, envoyCpCtx, otelStatusCache, envoy_common.APIV3)
```

---

### Incident Patch 8: `fdddb3db` (2026-09-28)
**Commit Message**: fix(meshtls): allow TLS 1.3 on outbound mTLS (#18865)

Signed-off-by: Lukasz Dziedziak <lukidzi@gmail.com>

**File**: `UPGRADE.md` (modified, +8/-0)
```diff
@@ -8,6 +8,14 @@ does not have any particular instructions.
 
 ## Upgrade to `3.0.0`
 
+### Outbound mTLS negotiates TLS 1.3
+
+Outbound mesh mTLS connections now allow TLS 1.3. Previously Envoy's client default capped them at TLS 1.2, so mesh traffic negotiated TLS 1.2 even though inbound listeners accepted TLS 1.3. A `MeshTLS` or `MeshExternalService` `tlsVersion.max` that is unset or `TLSAuto` now resolves to TLS 1.3 on the client side, which also fixes `min: TLS13` without `max` failing every connection with `NO_SUPPORTED_VERSIONS_ENABLED`.
+
+**Action required**
+
+None for most meshes. TLS 1.3 cipher suites are not configurable, so `tlsCiphers` no longer restricts connections that negotiate TLS 1.3. To keep outbound traffic on TLS 1.2, set `tlsVersion.max: TLS12` in `MeshTLS` or `MeshExternalService`.
+
 ### Reserved label prefixes
 
 From now on, `kuma.io/` and `k8s.kuma.io/` are reserved label prefixes.
```

**File**: `api/common/v1alpha1/tls/tls.go` (modified, +7/-0)
```diff
@@ -80,6 +80,13 @@ func ToTlsVersion(version *TlsVersion) tlsv3.TlsParameters_TlsProtocol {
 	}
 }
 
+func ToUpstreamMaxTlsVersion(version *TlsVersion) tlsv3.TlsParameters_TlsProtocol {
+	if version == nil || *version == TLSVersionAuto {
+		return tlsv3.TlsParameters_TLSv1_3
+	}
+	return ToTlsVersion(version)
+}
+
 // +kubebuilder:validation:Enum=ECDHE-ECDSA-AES128-GCM-SHA256;ECDHE-ECDSA-AES256-GCM-SHA384;ECDHE-ECDSA-CHACHA20-POLY1305;ECDHE-RSA-AES128-GCM-SHA256;ECDHE-RSA-AES256-GCM-SHA384;ECDHE-RSA-CHACHA20-POLY1305
 type TlsCipher string
 
```

**File**: `pkg/plugins/policies/core/xds/meshroute/clusters.go` (modified, +3/-1)
```diff
@@ -6,6 +6,7 @@ import (
 	envoy_tls "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
 	"github.com/pkg/errors"
 
+	common_tls "github.com/kumahq/kuma/v3/api/common/v1alpha1/tls"
 	"github.com/kumahq/kuma/v3/pkg/core/kri"
 	core_meta "github.com/kumahq/kuma/v3/pkg/core/metadata"
 	"github.com/kumahq/kuma/v3/pkg/core/resources/apis/core"
@@ -192,7 +193,8 @@ func UpstreamTLSContext(proxy *core_xds.Proxy, sni string, sans []string) (*envo
 				proxy.WorkloadIdentity.IdentitySourceConfigurer(),
 			),
 		})).
-		Configure(bldrs_tls.KumaAlpnProtocol())
+		Configure(bldrs_tls.KumaAlpnProtocol()).
+		Configure(bldrs_tls.TlsMaxVersion(pointer.To(common_tls.TLSVersion13)))
 	return bldrs_tls.NewUpstreamTLSContext().
 		Configure(bldrs_tls.SNI(sni)).
 		Configure(bldrs_tls.UpstreamCommonTlsContext(commonTlsContext)).
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/default-meshexternalservice-mesh-scoped-zone.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.extsvc.default.remote-zone.ext-backend.9000
     type: EDS
     typedExtensionProtocolOptions:
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/default-meshmultizoneservice-mesh-scoped-zone.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.mzsvc.default.multi-backend.80
     type: EDS
     typedExtensionProtocolOptions:
```

---

### Incident Patch 9: `4e446ee6` (2026-09-28)
**Commit Message**: fix(xds): empty reachable labels select all (#18860)

Signed-off-by: Lukasz Dziedziak <lukidzi@gmail.com>

**File**: `pkg/core/resources/apis/mesh/dataplane_validator.go` (modified, +2/-2)
```diff
@@ -181,8 +181,8 @@ func validateTransparentProxying(tp *mesh_proto.Dataplane_Networking_Transparent
 			default:
 				result.AddViolationAt(path.Index(i).Field("kind"), fmt.Sprintf("invalid value. Available values are: %s", strings.Join(maps.SortedKeys(allowedKinds), ",")))
 			}
-			if len(backendRef.Labels) == 0 {
-				result.AddViolationAt(path.Index(i).Field("labels"), validators.MustNotBeEmpty)
+			if len(backendRef.Labels) == 0 && backendRef.Port != nil {
+				result.AddViolationAt(path.Index(i).Field("port"), "must not be set when labels are empty")
 			}
 		}
 	}
```

**File**: `pkg/core/resources/apis/mesh/dataplane_validator_test.go` (modified, +6/-3)
```diff
@@ -235,7 +235,9 @@ var _ = Describe("Dataplane", func() {
                       k8s.kuma.io/namespace: es1
                   - kind: MeshService
                     labels:
-                      kuma.io/test: abc`,
+                      kuma.io/test: abc
+                  - kind: MeshMultiZoneService
+                    labels: {}`,
 		),
 		Entry("dataplane with backend ref with labels", `
             type: Dataplane
@@ -801,14 +803,15 @@ var _ = Describe("Dataplane", func() {
                     labels:
                       kuma.io/test: test
                   - kind: MeshService
+                    labels: {}
                     port: 80
 `,
 			expected: `
                 violations:
                 - field: networking.transparentProxing.reachableBackends.refs[0].kind
                   message: 'invalid value. Available values are: MeshExternalService,MeshMultiZoneService,MeshService'
-                - field: networking.transparentProxing.reachableBackends.refs[1].labels
-                  message: must not be empty`,
+                - field: networking.transparentProxing.reachableBackends.refs[1].port
+                  message: must not be set when labels are empty`,
 		}),
 		Entry("listener missing address", testCase{
 			dataplane: `
```

**File**: `pkg/plugins/runtime/k8s/controllers/pod_converter.go` (modified, +6/-0)
```diff
@@ -128,6 +128,12 @@ func (p *PodConverter) dataplaneFor(
 		if err := yaml.UnmarshalStrict([]byte(v), &refs); err != nil {
 			return nil, errors.Wrapf(err, "cannot parse, %s has invalid format", metadata.KumaReachableBackends)
 		}
+		// proto cannot tell omitted labels from empty ones, so require `labels: {}` here to select every backend
+		for i, ref := range refs.Refs {
+			if ref.Labels == nil {
+				return nil, errors.Errorf("%s: refs[%d].labels is required, use {} to select every %s", metadata.KumaReachableBackends, i, ref.Kind)
+			}
+		}
 
 		tp.ReachableBackends = &mesh_proto.Dataplane_Networking_TransparentProxying_ReachableBackends{
 			Refs: processReachableBackendRefs(refs),
```

**File**: `pkg/plugins/runtime/k8s/controllers/pod_converter_test.go` (modified, +4/-0)
```diff
@@ -392,6 +392,10 @@ var _ = Describe("PodToDataplane(..)", func() {
 			pod:         "50.pod.yaml",
 			expectedErr: "kuma.io/reachable-backends has invalid format",
 		}),
+		Entry("51. Pod with a reachable backend ref without labels", testCase{
+			pod:         "51.pod.yaml",
+			expectedErr: "refs[0].labels is required",
+		}),
 	)
 })
 
```

**File**: `pkg/plugins/runtime/k8s/controllers/testdata/28.dataplane.yaml` (modified, +1/-0)
```diff
@@ -38,3 +38,4 @@ spec:
         - kind: MeshExternalService
           labels:
             kuma.io/display-name: httpbin
+        - kind: MeshMultiZoneService
```

---

### Incident Patch 10: `901a1062` (2026-09-25)
**Commit Message**: fix(xds): drop MES with unloadable TLS material (#18873)

Signed-off-by: Lukasz Dziedziak <lukidzi@gmail.com>

**File**: `pkg/xds/topology/outbound.go` (modified, +17/-0)
```diff
@@ -2,6 +2,8 @@ package topology
 
 import (
 	"context"
+	crypto_tls "crypto/tls"
+	"crypto/x509"
 	"maps"
 	"net"
 	"slices"
@@ -372,6 +374,21 @@ func setTlsConfiguration(ctx context.Context, tls *meshexternalservice_api.Tls,
 			es.SkipHostnameVerification = true
 		}
 	}
+	return validateTLSMaterial(es)
+}
+
+// validateTLSMaterial rejects material Envoy cannot load. Envoy NACKs the whole cluster
+// update for one bad cluster, so a single broken MeshExternalService would otherwise stop
+// config delivery for every other cluster on the proxy (the zone egress serves all meshes).
+func validateTLSMaterial(es *core_xds.ExternalService) error {
+	if len(es.CaCert) > 0 && !x509.NewCertPool().AppendCertsFromPEM(es.CaCert) {
+		return errors.New("caCert does not contain a PEM encoded certificate")
+	}
+	if len(es.ClientCert) > 0 || len(es.ClientKey) > 0 {
+		if _, err := crypto_tls.X509KeyPair(es.ClientCert, es.ClientKey); err != nil {
+			return errors.Wrap(err, "clientCert and clientKey are not a valid key pair")
+		}
+	}
 	return nil
 }
 
```

**File**: `pkg/xds/topology/outbound_test.go` (modified, +109/-9)
```diff
@@ -2,6 +2,14 @@ package topology_test
 
 import (
 	"context"
+	"crypto/ecdsa"
+	"crypto/elliptic"
+	"crypto/rand"
+	"crypto/x509"
+	"crypto/x509/pkix"
+	"encoding/pem"
+	"math/big"
+	"time"
 
 	tlsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
 	. "github.com/onsi/ginkgo/v2"
@@ -30,6 +38,48 @@ import (
 	. "github.com/kumahq/kuma/v3/pkg/xds/topology"
 )
 
+var testCertPEM, testKeyPEM = selfSignedPEM()
+
+func selfSignedPEM() (string, string) {
+	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
+	if err != nil {
+		panic(err)
+	}
+	tmpl := &x509.Certificate{
+		SerialNumber:          big.NewInt(1),
+		Subject:               pkix.Name{CommonName: "example.com"},
+		NotBefore:             time.Now().Add(-time.Hour),
+		NotAfter:              time.Now().Add(time.Hour),
+		IsCA:                  true,
+		BasicConstraintsValid: true,
+	}
+	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
+	if err != nil {
+		panic(err)
+	}
+	keyDER, err := x509.MarshalECPrivateKey(key)
+	if err != nil {
+		panic(err)
+	}
+	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})),
+		string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
+}
+
+func mesWithVerification(name string, verification *meshexternalservice_api.Verification) *meshexternalservice_api.MeshExternalServiceResource {
+	return &meshexternalservice_api.MeshExternalServiceResource{
+		Meta: &test_model.ResourceMeta{Mesh: "default", Name: name},
+		Spec: &meshexternalservice_api.MeshExternalService{
+			Match: meshexternalservice_api.Match{
+				Type:     meshexternalservice_api.HostnameGeneratorType,
+				Port:     10000,
+				Protocol: core_meta.ProtocolTCP,
+			},
+			Endpoints: &[]meshexternalservice_api.Endpoint{{Address: "example.com", Port: 443}},
+			Tls:       &meshexternalservice_api.Tls{Enabled: true, Verification: verification},
+		},
+	}
+}
+
 var _ = Describe("TrafficRoute", func() {
 	const defaultMeshName = "default"
 	var dataSourceLoader datasource.Loader
@@ -249,15 +299,15 @@ var _ = Describe("TrafficRoute", func() {
 									},
 									CaCert: &datasource_api.SecureDataSource{
 										Type:           datasource_api.SecureDataSourceInline,
-										InsecureInline: &datasource_api.Inline{Value: "ca"},
+										InsecureInline: &datasource_api.Inline{Value: testCertPEM},
 									},
 									ClientCert: &datasource_api.SecureDataSource{
 										Type:           datasource_api.SecureDataSourceInline,
-										InsecureInline: &datasource_api.Inline{Value: "cert"},
+										InsecureInline: &datasource_api.Inline{Value: testCertPEM},
 									},
 									ClientKey: &datasource_api.SecureDataSource{
 										Type:           datasource_api.SecureDataSourceInline,
-										InsecureInline: &datasource_api.Inline{Value: "key"},
+										InsecureInline: &datasource_api.Inline{Value: testKeyPEM},
 									},
 								},
 							},
@@ -341,9 +391,9 @@ var _ = Describe("TrafficRoute", func() {
 								Protocol:                 core_meta.ProtocolHTTP,
 								TLSEnabled:               true,
 								FallbackToSystemCa:       true,
-								CaCert:                   []byte("ca"),
-								ClientCert:               []byte("cert"),
-								ClientKey:                []byte("key"),
+								CaCert:                   []byte(testCertPEM),
+								ClientCert:               []byte(testCertPEM),
+								ClientKey:                []byte(testKeyPEM),
 								AllowRenegotiation:       true,
 								SkipHostnameVerification: false,
 								ServerName:               "example.com",
@@ -369,6 +419,56 @@ var _ = Describe("TrafficRoute", func() {
 					},
 				},
 			}),
+			Entry("skips only the MeshExternalService with unparsable TLS material", testCase{
+				meshExternalServices: []*meshexternalservice_api.MeshExternalServiceResource{
+					mesWithVerification("bad-ca", &meshexternalservice_api.Verification{
+						CaCert: &datasource_api
```

#### Recent Merged Pull Requests:
- **PR #18924** (2026-09-30): chore(merge): release-3.0 branch to master (@kumahq[bot])
- **PR #18923** (2026-09-30): ci(merge): use newest release branch for merge (@bartsmykla)
- **PR #18922** (2026-09-30): docs(MADR): clean up MADRs after 3.0 (@lobkovilya)
- **PR #18918** (2026-09-29): ci(runners): use release-3.0 runner variables (@bartsmykla)
- **PR #18917** (2026-09-29): fix(xds): speed up Envoy stats tag extraction (backport of #18910) (@kumahq[bot])
- **PR #18916** (closed): fix(xds): speed up Envoy stats tag extraction (backport of #18910) (@kumahq[bot])
- **PR #18915** (2026-09-29): fix(xds): speed up Envoy stats tag extraction (backport of #18910) (@kumahq[bot])
- **PR #18914** (2026-09-29): fix(xds): speed up Envoy stats tag extraction (backport of #18910) (@kumahq[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
