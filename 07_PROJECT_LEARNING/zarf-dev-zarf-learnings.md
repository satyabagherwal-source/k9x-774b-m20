> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zarf-dev-zarf-learnings.md`  
> **Source**: github ([https://github.com/zarf-dev/zarf](https://github.com/zarf-dev/zarf))  
> **Source Version**: `b17ad042`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T02:32:49.362Z  
> **Learning ID**: `learn-github-zarf-dev-zarf`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zarf-dev/zarf

> **Canonical Artifact**: `07_PROJECT_LEARNING/zarf-dev-zarf-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zarf-dev/zarf](https://github.com/zarf-dev/zarf))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T02:32:49.058Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zarf-dev/zarf`
- **Description**: The Airgap Native Package Manager for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2087 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/cmd/utils.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package cmd contains the CLI commands for Zarf.
package cmd

import (
	"strings"

	"github.com/spf13/cobra"
)

// ReplaceCommandName recursively replaces all references of one string with another in the Example string
// code credit, deckhouse/deckhouse-cli
// https://github.com/deckhouse/deckhouse-cli/blob/7e0c1e743b16c82134a062985dde161178bd45f6/cmd/commands/utils.go#L25
func ReplaceCommandName(from, to string, c *cobra.Command) *cobra.Command {
	c.Example = strings.ReplaceAll(c.Example, from, to)
	for _, sub := range c.Commands() {
		ReplaceCommandName(from, to, sub)
	}
	return c
}

```

### Core Architecture Module: `src/internal/agent/hooks/argocd-application.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"fmt"

	"github.com/zarf-dev/zarf/src/config/lang"
	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/helpers"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/state"
	"github.com/zarf-dev/zarf/src/pkg/transform"
	v1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Application is a definition of an ArgoCD Application resource.
// The ArgoCD Application structs in this file have been partially copied from upstream.
//
// https://github.com/argoproj/argo-cd/blob/v2.11.0/pkg/apis/application/v1alpha1/types.go
//
// There were errors encountered when trying to import argocd as a Go package.
//
// For more information: https://argo-cd.readthedocs.io/en/stable/user-guide/import/
type Application struct {
	Spec              ApplicationSpec `json:"spec"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
}

// ApplicationSpec represents desired application state. Contains link to repository with application definition.
type ApplicationSpec struct {
	// Source is a reference to the location of the application's manifests or chart.
	Source  *ApplicationSource  `json:"source,omitempty"`
	Sources []ApplicationSource `json:"sources,omitempty"`
}

// ApplicationSource contains all required information about the source of an application.
type ApplicationSource struct {
	// RepoURL is the URL to the repository (Git or Helm) that contains the application manifests.
	RepoURL string `json:"repoURL"`
}

// NewApplicationMutationHook creates a new instance of the ArgoCD Application mutation hook.
func NewApplicationMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, app *Application) (*operations.Result, error) {
		return mutateApplication(ctx, r, c, app)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateApplication mutates the repository url to point to the repository URL defined in the ZarfState.
func mutateApplication(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, app *Application) (*operations.Result, error) {
	l := logger.From(ctx)

	s, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}

	var urls []string
	if app.Spec.Source != nil {
		urls = append(urls, app.Spec.Source.RepoURL)
	}
	for _, src := range app.Spec.Sources {
		urls = append(urls, src.RepoURL)
	}
	requiresGit, requiresRegistry := classifyURLSchemes(urls)

	if !anyZarfServiceUsable(requiresGit, requiresRegistry, s) {
		l.Debug("no Zarf services configured for source URL schemes, skipping ArgoCD Application mutation")
		return &operations.Result{Allowed: true}, nil
	}

	// Get the registry service info if this is a NodePort service to use the internal kube-dns
	registryAddress, clusterIP, err := c.GetServiceInfoFromRegistryAddress(ctx, s.RegistryInfo)
	if err != nil {
		return nil, err
	}

	l.Info("mutating the ArgoCD Application",
		"name", app.Name,
		"operation", r.Operation,
		"gitServer", s.GitServer.Address,
		"registry", registryAddress)

	patches := make([]operations.PatchOperation, 0)
	if app.Spec.Source != nil {
		patchedURL, err := getPatchedRepoURL(ctx, app.Spec.Source.RepoURL, registryAddress, clusterIP, s.GitServer)
		if err != nil {
			return nil, err
		}
		patches = populateSingleSourceArgoApplicationPatchOperations(patchedURL, patches)
	}

	if len(app.Spec.Sources) > 0 {
		for idx, source := range app.Spec.Sources {
			patchedURL, err := getPatchedRepoURL(ctx, source.RepoURL, registryAddress, clusterIP, s.GitServer)
			if err != nil {
				return nil, err
			}
			patches = populateMultipleSourceArgoApplicationPatchOperations(idx, patchedURL, patches)
		}
	}

	patches = append(patches, getLabelPatch(app.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

func getPatchedRepoURL(ctx context.Context, repoURL, registryAddress, clusterIP string, gs state.GitServerInfo) (string, error) {
	l := logger.From(ctx)

	if helpers.IsOCIURL(repoURL) {
		if registryAddress == "" {
			l.Debug("no Zarf registry configured, skipping OCI repoURL mutation", "url", repoURL)
			return repoURL, nil
		}
		isPatched, err := helpers.DoHostnamesMatch(helpers.OCIURLPrefix+registryAddress, repoURL)
		if err != nil {
			return "", fmt.Errorf(lang.AgentErrHostnameMatch, err)
		}
		if isPatched {
			l.Debug("skipping mutation, ArgoCD Application OCI repoURL already points to Zarf registry", "url", repoURL)
			return repoURL, nil
		}
		var isPatchedClusterIP bool
		if clusterIP != "" {
			isPatchedClusterIP, err = helpers.DoHostnamesMatch(helpers.OCIURLPrefix+clusterIP, repoURL)
			if err != nil {
				return "", fmt.Errorf(lang.AgentErrHostnameMatch, err)
			}
		}
		return mutateOCIURL(ctx, repoURL, registryAddress, isPatchedClusterIP)
	}

	if !gs.IsConfigured() {
		l.Debug("no Zarf git server configured, skipping git repoURL mutation", "url", repoURL)
		return repoURL, nil
	}
	isPatched, err := helpers.DoHostnamesMatch(gs.Address, repoURL)
	if err != nil {
		return "", fmt.Errorf(lang.AgentErrHostnameMatch, err)
	}
	if isPatched {
		l.Debug("skipping mutation, ArgoCD Application repoURL already points to Zarf git server", "url", repoURL)
		return repoURL, nil
	}
	return mutateGitURL(ctx, repoURL, gs)
}

func mutateOCIURL(ctx context.Context, repoURL, registryAddress string, isPatchedClusterIP bool) (string, error) {
	l := logger.From(ctx)
	var patchedSrc string
	var err error

	if isPatchedClusterIP {
		patchedSrc, err = transform.ImageTransformHostWithoutChecksum(registryAddress, repoURL)
		if err != nil {
			return "", fmt.Errorf("%s: %w", AgentErrTransformOCIURL, err)
		}
	} else {
		patchedSrc, err = transform.ImageTransformHost(registryAddress, repoURL)
		if err != nil {
			return "", fmt.Errorf("%s: %w", AgentErrTransformOCIURL, err)
		}
	}

	patchedRefInfo, err := transform.ParseImageRef(patchedSrc)
	if err != nil {
		return "", fmt.Errorf("%s: %w", AgentErrTransformOCIURL, err)
	}

	patchedURL := helpers.OCIURLPrefix + patchedRefInfo.Name
	l.Debug("mutated ArgoCD application OCI repoURL to the Zarf Registry URL", "original", repoURL, "mutated", patchedURL)
	return patchedURL, nil
}

func mutateGitURL(ctx context.Context, repoURL string, gs state.GitServerInfo) (string, error) {
	l := logger.From(ctx)
	transformedURL, err := transform.GitURL(gs.Address, repoURL, gs.PushUsername)
	if err != nil {
		return "", fmt.Errorf("%s: %w", AgentErrTransformGitURL, err)
	}
	patchedURL := transformedURL.String()
	l.Debug("mutated ArgoCD application repoURL to the Zarf URL", "original", repoURL, "mutated", patchedURL)
	return patchedURL, nil
}

// Patch updates of the Argo source spec.
func populateSingleSourceArgoApplicationPatchOperations(repoURL string, patches []operations.PatchOperation) []operations.PatchOperation {
	return append(patches, operations.ReplacePatchOperation("/spec/source/repoURL", repoURL))
}

// Patch updates of the Argo sources spec.
func populateMultipleSourceArgoApplicationPatchOperations(idx int, repoURL string, patches []operations.PatchOperation) []operations.PatchOperation {
	return append(patches, operations.ReplacePatchOperation(fmt.Sprintf("/spec/sources/%d/repoURL", idx), repoURL))
}

```

### Core Architecture Module: `src/internal/agent/hooks/argocd-applicationset.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"fmt"

	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/state"
	v1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ApplicationSet is a definition of an ArgoCD ApplicationSet resource.
// The ArgoCD ApplicationSet structs in this file have been partially copied from upstream.
//
// https://github.com/argoproj/argo-cd/blob/v2.11.0/pkg/apis/application/v1alpha1/applicationset_types.go
//
// There were errors encountered when trying to import argocd as a Go package.
//
// For more information: https://argo-cd.readthedocs.io/en/stable/user-guide/import/
type ApplicationSet struct {
	Spec              ApplicationSetSpec `json:"spec"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
}

// ApplicationSetSpec represents a class of application set state.
type ApplicationSetSpec struct {
	Generators []ApplicationSetGenerator `json:"generators,omitempty"`
}

// ApplicationSetGenerator represents a generator at the top level of an ApplicationSet.
type ApplicationSetGenerator struct {
	Git *GitGenerator `json:"git,omitempty"`
}

// GitGenerator represents a class of git generator.
type GitGenerator struct {
	RepoURL string `json:"repoURL"`
}

// NewApplicationSetMutationHook creates a new instance of the ArgoCD ApplicationSet mutation hook.
func NewApplicationSetMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, appSet *ApplicationSet) (*operations.Result, error) {
		return mutateApplicationSet(ctx, r, c, appSet)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateApplicationSet mutates the git repository urls to point to the repository URL defined in the ZarfState.
func mutateApplicationSet(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, appSet *ApplicationSet) (*operations.Result, error) {
	l := logger.From(ctx)

	s, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}

	var urls []string
	for _, generator := range appSet.Spec.Generators {
		if generator.Git != nil && generator.Git.RepoURL != "" {
			urls = append(urls, generator.Git.RepoURL)
		}
	}
	requiresGit, requiresRegistry := classifyURLSchemes(urls)

	if !anyZarfServiceUsable(requiresGit, requiresRegistry, s) {
		l.Debug("no Zarf services configured for source URL schemes, skipping ArgoCD ApplicationSet mutation")
		return &operations.Result{Allowed: true}, nil
	}

	// Get the registry service info if this is a NodePort service to use the internal kube-dns
	registryAddress, clusterIP, err := c.GetServiceInfoFromRegistryAddress(ctx, s.RegistryInfo)
	if err != nil {
		return nil, err
	}

	l.Info("mutating the ArgoCD ApplicationSet",
		"name", appSet.Name,
		"operation", r.Operation,
		"gitServer", s.GitServer.Address,
		"registry", registryAddress)

	patches := make([]operations.PatchOperation, 0)

	for genIdx, generator := range appSet.Spec.Generators {
		if generator.Git != nil && generator.Git.RepoURL != "" {
			patchedURL, err := getPatchedRepoURL(ctx, generator.Git.RepoURL, registryAddress, clusterIP, s.GitServer)
			if err != nil {
				return nil, err
			}
			patches = append(patches, operations.ReplacePatchOperation(fmt.Sprintf("/spec/generators/%d/git/repoURL", genIdx), patchedURL))
		}
	}

	patches = append(patches, getLabelPatch(appSet.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

```

### Core Architecture Module: `src/internal/agent/hooks/argocd-appproject.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"fmt"
	"strings"

	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/state"
	v1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AppProject is a definition of an ArgoCD AppProject resource.
// The ArgoCD AppProject structs in this file have been partially copied from upstream.
// https://github.com/argoproj/argo-cd/blob/v2.11.0/pkg/apis/application/v1alpha1/app_project_types.go
type AppProject struct {
	metav1.ObjectMeta `json:"metadata" protobuf:"bytes,1,opt,name=metadata"`
	Spec              AppProjectSpec `json:"spec" protobuf:"bytes,2,opt,name=spec"`
}

// AppProjectSpec is the specification of an AppProject
// The ArgoCD AppProjectSpec struct in this file have been partially copied from upstream.
// https://github.com/argoproj/argo-cd/blob/v2.11.0/pkg/apis/application/v1alpha1/types.go
type AppProjectSpec struct {
	// SourceRepos contains list of repository URLs which can be used for deployment
	SourceRepos []string `json:"sourceRepos,omitempty" protobuf:"bytes,1,name=sourceRepos"`
}

// NewAppProjectMutationHook creates a new mutation hook for ArgoCD AppProjects.
func NewAppProjectMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, proj *AppProject) (*operations.Result, error) {
		return mutateAppProject(ctx, r, c, proj)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateAppProject mutates the sourceRepos in ArgoCD AppProject to point to the Zarf git server.
func mutateAppProject(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, proj *AppProject) (*operations.Result, error) {
	l := logger.From(ctx)

	s, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}

	requiresGit, requiresRegistry := classifyURLSchemes(proj.Spec.SourceRepos)

	if !anyZarfServiceUsable(requiresGit, requiresRegistry, s) {
		l.Debug("no Zarf services configured for source URL schemes, skipping ArgoCD AppProject mutation")
		return &operations.Result{Allowed: true}, nil
	}

	registryAddress, clusterIP, err := c.GetServiceInfoFromRegistryAddress(ctx, s.RegistryInfo)
	if err != nil {
		return nil, err
	}

	l.Info("mutating the ArgoCD AppProject",
		"name", proj.Name,
		"operation", r.Operation,
		"gitServer", s.GitServer.Address,
		"registry", registryAddress)

	patches := make([]operations.PatchOperation, 0)

	for idx, repo := range proj.Spec.SourceRepos {
		patchedURL, err := getPatchedRepoURL(ctx, repo, registryAddress, clusterIP, s.GitServer)
		// The AppProject can also include source repositories like '*' (as in the default project),
		// which results in an error because '*' cannot be found in Git
		// For this reason, we will ignore these entries and only patch the Git repositories that are found
		if err != nil {
			if strings.Contains(err.Error(), AgentErrTransformGitURL) {
				continue
			}

			return nil, err
		}

		patches = populateAppProjectPatchOperations(idx, patchedURL, patches)
	}

	patches = append(patches, getLabelPatch(proj.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

// populateAppProjectPatchOperations creates patch operations for each mutated sourceRepo.
func populateAppProjectPatchOperations(idx int, repoURL string, patches []operations.PatchOperation) []operations.PatchOperation {
	return append(patches, operations.ReplacePatchOperation(fmt.Sprintf("/spec/sourceRepos/%d", idx), repoURL))
}

```

### Core Architecture Module: `src/internal/agent/hooks/argocd-repository.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/helpers"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/pki"
	"github.com/zarf-dev/zarf/src/pkg/state"
	v1 "k8s.io/api/admission/v1"
	corev1 "k8s.io/api/core/v1"
)

// RepoCreds holds the definition for repository credentials.
// This has been partially copied from upstream.
//
// https://github.com/argoproj/argo-cd/blob/v2.11.0/pkg/apis/application/v1alpha1/repository_types.go
//
// There were errors encountered when trying to import argocd as a Go package.
//
// For more information: https://argo-cd.readthedocs.io/en/stable/user-guide/import/
type RepoCreds struct {
	// URL is the URL that this credential matches to.
	URL string `json:"url"`
}

// NewRepositorySecretMutationHook creates a new instance of the ArgoCD repository secret mutation hook.
func NewRepositorySecretMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, secret *corev1.Secret) (*operations.Result, error) {
		return mutateRepositorySecret(ctx, r, c, secret)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateRepositorySecret mutates the git URL in the ArgoCD repository secret to point to the repository URL defined in the ZarfState.
func mutateRepositorySecret(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, secret *corev1.Secret) (*operations.Result, error) {
	l := logger.From(ctx)

	s, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}

	url, exists := secret.Data["url"]
	if !exists {
		return nil, fmt.Errorf("url field not found in argocd repository secret data")
	}

	var repoCreds RepoCreds
	repoCreds.URL = string(url)

	isOCIURL := helpers.IsOCIURL(repoCreds.URL)
	requiresGit, requiresRegistry := classifyURLSchemes([]string{repoCreds.URL})

	if !anyZarfServiceUsable(requiresGit, requiresRegistry, s) {
		l.Debug("no Zarf services configured for source URL schemes, skipping ArgoCD repository secret mutation")
		return &operations.Result{Allowed: true}, nil
	}

	l.Info("mutating the ArgoCD repository secret",
		"name", secret.Name,
		"operation", r.Operation)

	// Get the registry service info if this is a NodePort service to use the internal kube-dns
	registryAddress, clusterIP, err := c.GetServiceInfoFromRegistryAddress(ctx, s.RegistryInfo)
	if err != nil {
		return nil, err
	}

	patchedURL, err := getPatchedRepoURL(ctx, repoCreds.URL, registryAddress, clusterIP, s.GitServer)
	if err != nil {
		return nil, err
	}

	useMTLS := s.RegistryInfo.ShouldUseMTLS()
	var certs pki.GeneratedPKI
	if useMTLS && isOCIURL {
		certs, err = c.GetRegistryClientMTLSCert(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to find registry client mTLS secret: %w", err)
		}
	}

	patches := populateArgoRepositoryPatchOperations(patchedURL, s.GitServer, s.RegistryInfo, isOCIURL, useMTLS, certs)
	patches = append(patches, getLabelPatch(secret.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

// Patch updates of the Argo Repository Secret.
func populateArgoRepositoryPatchOperations(repoURL string, gitServer state.GitServerInfo, registryInfo state.RegistryInfo, isOCIURL bool, useMTLS bool, cert pki.GeneratedPKI) []operations.PatchOperation {
	var patches []operations.PatchOperation
	username, password := getCreds(isOCIURL, gitServer, registryInfo)

	patches = append(patches, operations.ReplacePatchOperation("/data/url", base64.StdEncoding.EncodeToString([]byte(repoURL))))
	patches = append(patches, operations.ReplacePatchOperation("/data/username", base64.StdEncoding.EncodeToString([]byte(username))))
	patches = append(patches, operations.ReplacePatchOperation("/data/password", base64.StdEncoding.EncodeToString([]byte(password))))

	if isOCIURL && registryInfo.IsInternal() && !useMTLS {
		patches = append(patches, operations.ReplacePatchOperation("/data/insecureOCIForceHttp", base64.StdEncoding.EncodeToString([]byte("true"))))
	}

	if useMTLS && isOCIURL {
		patches = append(patches, operations.ReplacePatchOperation("/data/tlsClientCertData", cert.Cert))
		patches = append(patches, operations.ReplacePatchOperation("/data/tlsClientCertKey", cert.Key))
	}

	return patches
}

// Helper for getting either git server of registry creds
func getCreds(isOCIURL bool, gitServer state.GitServerInfo, registry state.RegistryInfo) (string, string) {
	if isOCIURL {
		return registry.PullUsername, registry.PullPassword
	}
	return gitServer.PullUsername, gitServer.PullPassword
}

```

### Core Architecture Module: `src/internal/agent/hooks/common.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/zarf-dev/zarf/src/config/lang"
	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/helpers"
	"github.com/zarf-dev/zarf/src/pkg/ocischeme"
	"github.com/zarf-dev/zarf/src/pkg/state"
	admission "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"oras.land/oras-go/v2"
	"oras.land/oras-go/v2/registry"
	orasRemote "oras.land/oras-go/v2/registry/remote"
	"oras.land/oras-go/v2/registry/remote/auth"
	orasRetry "oras.land/oras-go/v2/registry/remote/retry"
)

const (
	// AgentErrTransformGitURL is thrown when the agent fails to make the git url a Zarf compatible url
	AgentErrTransformGitURL = "unable to transform the git url"
	// AgentErrTransformOCIURL is thrown when the agent fails to make the OCI url a Zarf compatible url
	AgentErrTransformOCIURL = "unable to transform the OCIRepo URL"
)

// withMutationGuard returns an AdmitFunc that unmarshals the request object,
// checks namespace labels and ShouldMutate, then delegates to fn.
func withMutationGuard[T any, PT interface {
	*T
	metav1.Object
}](
	c *cluster.Cluster,
	mode state.MutationPolicy,
	fn func(ctx context.Context, r *admission.AdmissionRequest, obj PT) (*operations.Result, error),
) operations.AdmitFunc {
	return func(ctx context.Context, r *admission.AdmissionRequest) (*operations.Result, error) {
		obj := PT(new(T))
		if err := json.Unmarshal(r.Object.Raw, obj); err != nil {
			return nil, fmt.Errorf(lang.ErrUnmarshal, err)
		}
		var nsLabels map[string]string
		if r.Namespace != "" {
			var err error
			nsLabels, err = getNamespaceLabels(ctx, c, r.Namespace)
			if err != nil {
				return nil, err
			}
		}
		if !operations.ShouldMutate(obj.GetLabels(), nsLabels, mode) {
			return &operations.Result{Allowed: true, PatchOps: []operations.PatchOperation{}}, nil
		}
		return fn(ctx, r, obj)
	}
}

func getNamespaceLabels(ctx context.Context, c *cluster.Cluster, name string) (map[string]string, error) {
	ns, err := c.Clientset.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace %s: %w", name, err)
	}
	return ns.Labels, nil
}

func getLabelPatch(currLabels map[string]string) operations.PatchOperation {
	if currLabels == nil {
		currLabels = make(map[string]string)
	}
	currLabels["zarf-agent"] = "patched"
	return operations.ReplacePatchOperation("/metadata/labels", currLabels)
}

// classifyURLSchemes reports whether any of the given repository URLs require
// the Zarf git server or the Zarf registry (OCI).
func classifyURLSchemes(urls []string) (requiresGit, requiresRegistry bool) {
	for _, u := range urls {
		if helpers.IsOCIURL(u) {
			requiresRegistry = true
		} else {
			requiresGit = true
		}
	}
	return
}

// anyZarfServiceUsable returns true when at least one required Zarf service is
// configured in the given state. Use this to decide whether a mutation hook
// should proceed.
func anyZarfServiceUsable(requiresGit, requiresRegistry bool, s *state.State) bool {
	return (requiresGit && s.GitServer.IsConfigured()) || (requiresRegistry && s.RegistryInfo.IsConfigured())
}

func getManifestConfigMediaType(ctx context.Context, zarfState *state.State, transport http.RoundTripper, imageAddress string) (string, error) {
	ref, err := registry.ParseReference(imageAddress)
	if err != nil {
		return "", err
	}

	client := &auth.Client{
		Client: &http.Client{
			Transport: transport,
		},
		Cache: auth.NewCache(),
		Credential: auth.StaticCredential(ref.Registry, auth.Credential{
			Username: zarfState.RegistryInfo.PullUsername,
			Password: zarfState.RegistryInfo.PullPassword,
		}),
	}

	// Negotiate only when the registry's scheme isn't already known, since the
	// negotiation itself is a probe over the same connection the real fetch depends on.
	plainHTTP, ok := zarfState.RegistryInfo.KnownPlainHTTP()
	if !ok {
		// Reuse the same transport the real fetch will use, but stripped of any
		// retry wrapper: probing must stay fast, not retry with backoff on every
		// connection failure.
		probeTransport := unwrapRetryTransport(transport)
		plainHTTP, err = ocischeme.New(ocischeme.Options{}).UsePlainHTTP(ctx, ref.Registry, ocischeme.ProbeOptions{Transport: probeTransport})
		if err != nil {
			return "", err
		}
	}

	b, err := fetchManifestBytes(ctx, ref, client, plainHTTP, imageAddress)
	if err != nil {
		return "", fmt.Errorf("got an error when trying to access the manifest for %s, error %w", imageAddress, err)
	}

	var manifest ocispec.Manifest
	if err := json.Unmarshal(b, &manifest); err != nil {
		return "", fmt.Errorf("unable to unmarshal the manifest json for %s", imageAddress)
	}

	return manifest.Config.MediaType, nil
}

// unwrapRetryTransport returns rt's underlying RoundTripper if rt is an oras-go
// retry.Transport, so a scheme probe never inherits its retry/backoff behavior:
// probing must fail fast on a connection error, not retry it into a multi-second
// stall.
func unwrapRetryTransport(rt http.RoundTripper) http.RoundTripper {
	if retryRT, ok := rt.(*orasRetry.Transport); ok && retryRT.Base != nil {
		return retryRT.Base
	}
	return rt
}

func fetchManifestBytes(ctx context.Context, ref registry.Reference, client *auth.Client, plainHTTP bool, imageAddress string) ([]byte, error) {
	repo := &orasRemote.Repository{
		PlainHTTP: plainHTTP,
		Reference: ref,
		Client:    client,
	}
	_, b, err := oras.FetchBytes(ctx, repo, imageAddress, oras.DefaultFetchBytesOptions)
	return b, err
}

```

### Core Architecture Module: `src/internal/agent/hooks/flux-gitrepo.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"fmt"

	fluxmeta "github.com/fluxcd/pkg/apis/meta"
	flux "github.com/fluxcd/source-controller/api/v1"
	"github.com/zarf-dev/zarf/src/config"
	"github.com/zarf-dev/zarf/src/config/lang"
	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/helpers"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/state"
	"github.com/zarf-dev/zarf/src/pkg/transform"
	v1 "k8s.io/api/admission/v1"
)

// NewGitRepositoryMutationHook creates a new instance of the git repo mutation hook.
func NewGitRepositoryMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, repo *flux.GitRepository) (*operations.Result, error) {
		return mutateGitRepo(ctx, r, c, repo)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateGitRepo mutates the git repository url to point to the repository URL defined in the ZarfState.
func mutateGitRepo(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, repo *flux.GitRepository) (*operations.Result, error) {
	l := logger.From(ctx)
	var patches []operations.PatchOperation

	s, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}
	if !s.GitServer.IsConfigured() {
		l.Debug("no Zarf git server configured, skipping Flux GitRepository mutation")
		return &operations.Result{Allowed: true}, nil
	}

	l.Info("using the Zarf git server URL to mutate the Flux GitRepository",
		"name", repo.Name,
		"operation", r.Operation,
		"gitServer", s.GitServer.Address)

	// Skip mutation if the URL already points to the Zarf git server to prevent double-hashing
	// on resource recreation (e.g. Helm rollback, GitOps reconciliation).
	isPatched, err := helpers.DoHostnamesMatch(s.GitServer.Address, repo.Spec.URL)
	if err != nil {
		return nil, fmt.Errorf(lang.AgentErrHostnameMatch, err)
	}

	patchedURL := repo.Spec.URL

	if isPatched {
		l.Debug("skipping mutation, Flux GitRepository URL already points to Zarf git server",
			"url", repo.Spec.URL,
			"operation", r.Operation)
	} else {
		transformedURL, err := transform.GitURL(s.GitServer.Address, patchedURL, s.GitServer.PushUsername)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", AgentErrTransformGitURL, err)
		}
		patchedURL = transformedURL.String()
		l.Debug("mutating the Flux GitRepository URL to the Zarf URL", "original", repo.Spec.URL, "mutated", patchedURL)
	}

	// Patch updates of the repo spec
	patches = populatePatchOperations(patchedURL)
	patches = append(patches, getLabelPatch(repo.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

// Patch updates of the repo spec.
func populatePatchOperations(repoURL string) []operations.PatchOperation {
	var patches []operations.PatchOperation
	patches = append(patches, operations.ReplacePatchOperation("/spec/url", repoURL))

	newSecretRef := fluxmeta.LocalObjectReference{Name: config.ZarfGitServerSecretName}
	patches = append(patches, operations.AddPatchOperation("/spec/secretRef", newSecretRef))

	return patches
}

```

### Core Architecture Module: `src/internal/agent/hooks/flux-helmrepo.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"fmt"
	"strings"

	"github.com/fluxcd/pkg/apis/meta"
	flux "github.com/fluxcd/source-controller/api/v1"
	"github.com/zarf-dev/zarf/src/config"
	"github.com/zarf-dev/zarf/src/config/lang"
	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/helpers"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/state"
	"github.com/zarf-dev/zarf/src/pkg/transform"
	v1 "k8s.io/api/admission/v1"
)

// NewHelmRepositoryMutationHook creates a new instance of the helm repo mutation hook.
func NewHelmRepositoryMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, src *flux.HelmRepository) (*operations.Result, error) {
		return mutateHelmRepo(ctx, r, c, src)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateHelmRepo mutates the repository url to point to the repository URL defined in the ZarfState.
func mutateHelmRepo(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, src *flux.HelmRepository) (*operations.Result, error) {
	l := logger.From(ctx)

	// If we see a type of helm repo other than OCI we should flag a warning and return
	if strings.ToLower(src.Spec.Type) != "oci" {
		l.Warn("skipping HelmRepository mutation because the type is not OCI", "type", src.Spec.Type)
		return &operations.Result{Allowed: true}, nil
	}

	zarfState, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}

	// Get the registry service info if this is a NodePort service to use the internal kube-dns
	registryAddress, clusterIP, err := c.GetServiceInfoFromRegistryAddress(ctx, zarfState.RegistryInfo)
	if err != nil {
		return nil, err
	}

	l.Info("using the Zarf registry URL to mutate the Flux HelmRepository",
		"name", src.Name,
		"operation", r.Operation,
		"registry", registryAddress)

	patchedURL := src.Spec.URL

	// Skip mutation if the URL already points to the Zarf registry to prevent double-transformation
	// on resource recreation (e.g. Helm rollback, GitOps reconciliation).
	zarfStateAddress := helpers.OCIURLPrefix + registryAddress
	isPatched, err := helpers.DoHostnamesMatch(zarfStateAddress, src.Spec.URL)
	if err != nil {
		return nil, fmt.Errorf(lang.AgentErrHostnameMatch, err)
	}
	var isPatchedClusterIP bool
	if clusterIP != "" {
		zarfStateClusterIPAddress := helpers.OCIURLPrefix + clusterIP
		isPatchedClusterIP, err = helpers.DoHostnamesMatch(zarfStateClusterIPAddress, src.Spec.URL)
		if err != nil {
			return nil, fmt.Errorf(lang.AgentErrHostnameMatch, err)
		}
	}

	if isPatched {
		l.Debug("skipping mutation, Flux HelmRepository URL already points to Zarf registry",
			"url", src.Spec.URL,
			"operation", r.Operation)
	} else {
		var patchedSrc string
		if isPatchedClusterIP {
			patchedSrc, err = transform.ImageTransformHostWithoutChecksum(registryAddress, src.Spec.URL)
			if err != nil {
				return nil, fmt.Errorf("unable to transform existing patched HelmRepo ClusterIP to %s: %w", registryAddress, err)
			}
		} else {
			patchedSrc, err = transform.ImageTransformHost(registryAddress, src.Spec.URL)
			if err != nil {
				return nil, fmt.Errorf("unable to transform the HelmRepo URL to %s: %w", registryAddress, err)
			}
		}

		patchedRefInfo, err := transform.ParseImageRef(patchedSrc)
		if err != nil {
			return nil, fmt.Errorf("unable to parse the HelmRepo URL: %w", err)
		}
		patchedURL = helpers.OCIURLPrefix + patchedRefInfo.Name
		l.Debug("mutating the Flux HelmRepository URL to the Zarf URL", "original", src.Spec.URL, "mutated", patchedURL)
	}

	var patches []operations.PatchOperation

	useMTLS := zarfState.RegistryInfo.ShouldUseMTLS()
	if useMTLS {
		_, err = c.GetRegistryClientMTLSCert(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to find registry client mTLS secret: %w", err)
		}
	}

	patches = populateHelmRepoPatchOperations(patchedURL, zarfState.RegistryInfo.IsInternal(), useMTLS)
	patches = append(patches, getLabelPatch(src.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

func populateHelmRepoPatchOperations(repoURL string, isInternal bool, useMTLS bool) []operations.PatchOperation {
	var patches []operations.PatchOperation
	patches = append(patches, operations.ReplacePatchOperation("/spec/url", repoURL))

	if isInternal && !useMTLS {
		patches = append(patches, operations.ReplacePatchOperation("/spec/insecure", true))
	}

	if useMTLS {
		patches = append(patches, operations.AddPatchOperation("/spec/certSecretRef", meta.LocalObjectReference{Name: state.RegistryClientTLSSecret}))
	}

	patches = append(patches, operations.AddPatchOperation("/spec/secretRef", meta.LocalObjectReference{Name: config.ZarfImagePullSecretName}))

	return patches
}

```

### Core Architecture Module: `src/internal/agent/hooks/flux-ocirepo.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks contains the mutation hooks for the Zarf agent.
package hooks

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/fluxcd/pkg/apis/meta"
	flux "github.com/fluxcd/source-controller/api/v1"
	"github.com/zarf-dev/zarf/src/config"
	"github.com/zarf-dev/zarf/src/config/lang"
	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/helpers"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/pki"
	"github.com/zarf-dev/zarf/src/pkg/state"
	"github.com/zarf-dev/zarf/src/pkg/transform"
	v1 "k8s.io/api/admission/v1"
	orasRetry "oras.land/oras-go/v2/registry/remote/retry"
)

const (
	helmMediaTypeManifest = "application/vnd.cncf.helm.config.v1+json"
	registryFetchTimeout  = 10 * time.Second
)

// NewOCIRepositoryMutationHook creates a new instance of the oci repo mutation hook.
func NewOCIRepositoryMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, src *flux.OCIRepository) (*operations.Result, error) {
		return mutateOCIRepo(ctx, r, c, src)
	})
	return operations.Hook{Create: admit, Update: admit}
}

// mutateOCIRepo mutates the oci repository url to point to the repository URL defined in the ZarfState.
func mutateOCIRepo(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, src *flux.OCIRepository) (*operations.Result, error) {
	l := logger.From(ctx)
	var (
		patches            []operations.PatchOperation
		isPatched          bool
		isPatchedClusterIP bool

		isCreate = r.Operation == v1.Create
		isUpdate = r.Operation == v1.Update
	)

	if src.Spec.Reference == nil {
		src.Spec.Reference = &flux.OCIRepositoryRef{}
	}

	// If we have a semver we want to continue since we will still have the upstream tag
	// but should warn that we can't guarantee there won't be collisions
	if src.Spec.Reference.SemVer != "" {
		l.Warn("Detected a semver OCI ref, continuing but will be unable to guarantee against collisions if multiple OCI artifacts with the same name are brought in from different registries", "ref", src.Spec.Reference.SemVer)
	}

	zarfState, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}

	// Get the registry service info if this is a NodePort service to use the internal kube-dns
	registryAddress, clusterIP, err := c.GetServiceInfoFromRegistryAddress(ctx, zarfState.RegistryInfo)
	if err != nil {
		return nil, err
	}

	// For the internal registry this will be the ip & port of the service, it may look like 10.43.36.151:5000
	l.Info("using the Zarf registry URL to mutate the Flux OCIRepository",
		"name", src.Name,
		"registry", registryAddress)

	patchedURL := src.Spec.URL
	patchedRef := src.Spec.Reference
	useMTLS := false

	// Check if this is an update operation and the hostname is different from what we have in the zarfState
	// NOTE: We mutate on updates IF AND ONLY IF the hostname in the request is different than the hostname in the zarfState
	// NOTE: We are checking if the hostname is different before because we do not want to potentially mutate a URL that has already been mutated.
	if isUpdate {
		zarfStateAddress := helpers.OCIURLPrefix + registryAddress
		isPatched, err = helpers.DoHostnamesMatch(zarfStateAddress, src.Spec.URL)
		if err != nil {
			return nil, fmt.Errorf(lang.AgentErrHostnameMatch, err)
		}
		if clusterIP != "" {
			zarfStateClusterIPAddress := helpers.OCIURLPrefix + clusterIP
			isPatchedClusterIP, err = helpers.DoHostnamesMatch(zarfStateClusterIPAddress, src.Spec.URL)
			if err != nil {
				return nil, fmt.Errorf(lang.AgentErrHostnameMatch, err)
			}
		}
	}

	// Mutate the oci repo URL if necessary
	if isCreate || (isUpdate && !isPatched) {
		if src.Spec.Reference.Digest != "" {
			patchedURL = fmt.Sprintf("%s@%s", patchedURL, src.Spec.Reference.Digest)
		} else if src.Spec.Reference.Tag != "" {
			patchedURL = fmt.Sprintf("%s:%s", patchedURL, src.Spec.Reference.Tag)
		}

		var patchedSrc string
		// If it's patched with a cluster IP then we transform it without a checksum to the DNS name
		if isPatchedClusterIP {
			patchedSrc, err = transform.ImageTransformHostWithoutChecksum(registryAddress, patchedURL)
			if err != nil {
				return nil, fmt.Errorf("%s: %w", AgentErrTransformOCIURL, err)
			}
		} else {
			patchedSrc, err = transform.ImageTransformHost(registryAddress, patchedURL)
			if err != nil {
				return nil, fmt.Errorf("%s: %w", AgentErrTransformOCIURL, err)
			}
		}

		var certs pki.GeneratedPKI
		useMTLS = zarfState.RegistryInfo.ShouldUseMTLS()
		if useMTLS {
			certs, err = c.GetRegistryClientMTLSCert(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to find registry client mTLS secret: %w", err)
			}
		}

		timeoutCtx, cancel := context.WithTimeout(ctx, registryFetchTimeout)
		defer cancel()

		var transport http.RoundTripper
		if useMTLS {
			transport, err = pki.TransportWithKey(certs)
			if err != nil {
				return nil, fmt.Errorf("failed to create transport from client cert: %w", err)
			}
		} else {
			transport = orasRetry.DefaultClient.Transport
		}

		// Get the media type of the oci image
		mediaType, err := getManifestConfigMediaType(timeoutCtx, zarfState, transport, patchedSrc)

		// If we get an error, we fall back to existing mutation logic
		if err != nil {
			l.Error("unable to determine mediaType", "error", err.Error())
			mediaType = ""
		}

		l.Debug("got the following media type", "mediaType", mediaType, "registryAddress", registryAddress)

		// Check the mediaType of the oci-artifact and if it is a helm chart we patch the crc to remove the crc32 hash
		if isChart(mediaType) {
			patchedSrc, err = transform.ImageTransformHostWithoutChecksum(registryAddress, patchedURL)
			if err != nil {
				return nil, fmt.Errorf("%s: %w", AgentErrTransformOCIURL, err)
			}
		}

		patchedRefInfo, err := transform.ParseImageRef(patchedSrc)
		if err != nil {
			return nil, fmt.Errorf("unable to parse the transformed OCIRepo URL: %w", err)
		}

		patchedURL = helpers.OCIURLPrefix + patchedRefInfo.Name

		if patchedRefInfo.Digest != "" {
			patchedRef.Digest = patchedRefInfo.Digest
		} else if patchedRefInfo.Tag != "" {
			patchedRef.Tag = patchedRefInfo.Tag
		}
	}

	l.Debug("mutating the Flux OCIRepository URL to the Zarf URL", "original", src.Spec.URL, "mutated", patchedURL)
	patches = populateOCIRepoPatchOperations(patchedURL, zarfState.RegistryInfo.IsInternal(), useMTLS, patchedRef)
	patches = append(patches, getLabelPatch(src.Labels))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

func populateOCIRepoPatchOperations(repoURL string, isInternal bool, useMTLS bool, ref *flux.OCIRepositoryRef) []operations.PatchOperation {
	var patches []operations.PatchOperation
	patches = append(patches, operations.ReplacePatchOperation("/spec/url", repoURL))

	patches = append(patches, operations.AddPatchOperation("/spec/secretRef", meta.LocalObjectReference{Name: config.ZarfImagePullSecretName}))

	if isInternal && !useMTLS {
		patches = append(patches, operations.ReplacePatchOperation("/spec/insecure", true))
	}

	if useMTLS {
		patches = append(patches, operations.AddPatchOperation("/spec/certSecretRef", meta.LocalObjectReference{Name: state.RegistryClientTLSSecret}))
	}

	// If semver is used we don't want to add the ":latest" tag + crc to the spec
	if ref.SemVer != "" {
		return patches
	}

	if ref.Tag != "" {
		patches = append(patches, operations.ReplacePatchOperation("/spec/ref/tag", ref.Tag))
	}

	return patches
}

func isChart(mediaType string) bool {
	switch mediaType {
	case helmMediaTypeManifest:
		return true
	}
	return false
}

```

### Core Architecture Module: `src/internal/agent/hooks/pods.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package hooks provides HTTP handlers for the mutating webhook.
package hooks

import (
	"context"
	"fmt"
	"strings"

	"github.com/zarf-dev/zarf/src/config"
	"github.com/zarf-dev/zarf/src/internal/agent/operations"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/state"
	"github.com/zarf-dev/zarf/src/pkg/transform"
	v1 "k8s.io/api/admission/v1"
	corev1 "k8s.io/api/core/v1"
)

const annotationPrefix = "zarf.dev"

// NewPodMutationHook creates a new instance of pods mutation hook.
func NewPodMutationHook(c *cluster.Cluster, mode state.MutationPolicy) operations.Hook {
	admit := withMutationGuard(c, mode, func(ctx context.Context, r *v1.AdmissionRequest, pod *corev1.Pod) (*operations.Result, error) {
		return mutatePod(ctx, r, c, pod)
	})
	return operations.Hook{Create: admit, Update: admit}
}

func getImageAnnotationKey(ctx context.Context, containerName string) string {
	return getAnnotationKey(ctx, "image-"+containerName)
}

func getVolumeAnnotationKey(ctx context.Context, volumeName string) string {
	return getAnnotationKey(ctx, "volume-"+volumeName)
}

func getAnnotationKey(ctx context.Context, image string) string {
	annotationName := fmt.Sprintf("original-%s", image)
	// The name segment is required and must be 63 characters or less, beginning and ending with
	// an alphanumeric character ([a-z0-9A-Z]) with dashes (-), underscores (_), dots (.), and alphanumerics between.
	// https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/#syntax-and-character-set
	if len(annotationName) > 63 {
		logger.From(ctx).Debug("truncating container name to fit Kubernetes 63 character annotation name limit", "container", image)
		annotationName = annotationName[:63]
	}
	// container names follow RFC 1123 which allows only lowercase alphanumeric characters and hyphens
	// this ensures we don't end with a hyphen
	annotationName = strings.TrimRight(annotationName, "-")
	key := fmt.Sprintf("%s/%s", annotationPrefix, annotationName)
	return key
}

func mutatePod(ctx context.Context, r *v1.AdmissionRequest, c *cluster.Cluster, pod *corev1.Pod) (*operations.Result, error) {
	l := logger.From(ctx)

	if r.SubResource != "" {
		return mutatePodSubresource(ctx, r, c, pod)
	}

	if pod.Labels != nil && pod.Labels["zarf-agent"] == "patched" {
		// We've already played with this pod, just keep swimming 🐟
		return &operations.Result{
			Allowed:  true,
			PatchOps: []operations.PatchOperation{},
		}, nil
	}

	state, err := c.LoadState(ctx)
	if err != nil {
		return nil, err
	}
	registryURL := state.RegistryInfo.Address

	// Pods do not have a metadata.name at the time of admission if from a deployment so we don't log the name
	l.Info("using the Zarf registry URL to mutate the Pod", "registry", registryURL)

	var patches []operations.PatchOperation

	// Add the zarf secret to the podspec
	zarfSecret := []corev1.LocalObjectReference{{Name: config.ZarfImagePullSecretName}}
	patches = append(patches, operations.ReplacePatchOperation("/spec/imagePullSecrets", zarfSecret))

	updatedAnnotations := pod.Annotations
	if updatedAnnotations == nil {
		updatedAnnotations = make(map[string]string)
	}

	// update the image host for each init container
	for idx, container := range pod.Spec.InitContainers {
		path := fmt.Sprintf("/spec/initContainers/%d/image", idx)
		replacement, err := transform.ImageTransformHost(registryURL, container.Image)
		if err != nil {
			return nil, err
		}
		updatedAnnotations[getImageAnnotationKey(ctx, container.Name)] = container.Image
		patches = append(patches, operations.ReplacePatchOperation(path, replacement))
	}

	// update the image host for each normal container
	for idx, container := range pod.Spec.Containers {
		path := fmt.Sprintf("/spec/containers/%d/image", idx)
		replacement, err := transform.ImageTransformHost(registryURL, container.Image)
		if err != nil {
			return nil, err
		}
		updatedAnnotations[getImageAnnotationKey(ctx, container.Name)] = container.Image
		patches = append(patches, operations.ReplacePatchOperation(path, replacement))
	}

	// update the image host for each volume that contains an "image" reference
	for idx, volume := range pod.Spec.Volumes {
		if volume.Image != nil {
			if volume.Image.Reference == "" {
				return nil, fmt.Errorf("volume %q (index %d) has an ImageVolumeSource with empty reference - this is invalid and must be specified", volume.Name, idx)
			}
			path := fmt.Sprintf("/spec/volumes/%d/image/reference", idx)
			replacement, err := transform.ImageTransformHost(registryURL, volume.Image.Reference)
			if err != nil {
				return nil, fmt.Errorf("failed to transform volume %q (index %d) image reference %q: %w", volume.Name, idx, volume.Image.Reference, err)
			}
			updatedAnnotations[getVolumeAnnotationKey(ctx, volume.Name)] = volume.Image.Reference
			patches = append(patches, operations.ReplacePatchOperation(path, replacement))
		}
	}

	// Add the "zarf-agent"="patched" label patch
	patches = append(patches, getLabelPatch(pod.Labels))

	// Add the annotations label patch
	patches = append(patches, operations.ReplacePatchOperation("/metadata/annotations", updatedAnnotations))

	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

// mutatePodSubresource handles pod subresource mutation
func mutatePodSubresource(ctx context.Context, r *v1.AdmissionRequest, cluster *cluster.Cluster, pod *corev1.Pod) (*operations.Result, error) {
	switch res := r.SubResource; res {
	case "ephemeralcontainers":
		return mutateEphemeralContainers(ctx, cluster, pod)
	default:
		// this likely won't be hit as the MutatingWebhookConfiguration would need to be modified - but this can help ensure they stay synchronized
		return nil, fmt.Errorf("attempted mutation of unsupported subresource: %s", res)
	}
}

func mutateEphemeralContainers(ctx context.Context, cluster *cluster.Cluster, pod *corev1.Pod) (*operations.Result, error) {
	l := logger.From(ctx)

	state, err := cluster.LoadState(ctx)
	if err != nil {
		return nil, err
	}
	registryURL := state.RegistryInfo.Address

	// Pods do not have a metadata.name at the time of admission if from a deployment so we don't log the name
	l.Info("using the Zarf registry URL to mutate the Pod", "registry", registryURL)

	updatedAnnotations := pod.Annotations
	if updatedAnnotations == nil {
		updatedAnnotations = make(map[string]string)
	}

	var patches []operations.PatchOperation

	// update the image host for each ephemeral container
	for idx, container := range pod.Spec.EphemeralContainers {
		path := fmt.Sprintf("/spec/ephemeralContainers/%d/image", idx)
		replacement, err := transform.ImageTransformHost(registryURL, container.Image)
		if err != nil {
			return nil, err
		}
		updatedAnnotations[getImageAnnotationKey(ctx, container.Name)] = container.Image
		patches = append(patches, operations.ReplacePatchOperation(path, replacement))
	}

	// Add the annotations label patch
	patches = append(patches, operations.ReplacePatchOperation("/metadata/annotations", updatedAnnotations))

	// Return the result of the subresource mutation
	return &operations.Result{
		Allowed:  true,
		PatchOps: patches,
	}, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5625** (2026-11-07): **fix: exclude state authoritative values**
  *Symptoms*: ## Description  Setting any of the state authoritative values separate from their defaults through package values does not synchronize with zarf state - these should be excluded and we should pursue https://github.com/zarf-dev/proposals/pull/64  ## Related Issue   ## Checklist before merging  - [x] Test, docs, adr added or updated as needed - [x] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* canceled.   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 42ed7d40cf3261ac2368635aafe18774a3b236b5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6aeebaea63891c5c03a41ebc |
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5625?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :white_check_mark: All modified and coverable lines are covered by tests. <details><summary> :rocket: New features to boost your workflow: </summary>  - :snowflake: [Test Analytics](https://docs.codecov.com/docs/test-analytics): Detect flaky tests, report on failures, and find test suite problems. - :package: [JS Bundle Analysis](https://docs.codecov.com/docs/javascript-bundle-analysis): Save yourself from yourself by tracking and limiting bundle sizes in JS merges. </details>

- **Issue #5621** (2026-11-08): **feat!: error when package secret write fails**
  *Symptoms*: ## Description  Error when package secret write fails.   Also because we now compress state, I'm less worried about failed packages on overblown size. I kept the pre-flight checks, but simplified them so they check against the kubernetes secret limit (no extra room for deployment config in the pre-flight check)  ## Related Issue  Fixes #5517  ## Checklist before merging  - [ ] Test, docs, adr added or updated as needed - [ ] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | e9e9e1cd31885b297371c7e424bf14e9ebfda3ab | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6aee00814fb779510b36377c | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5621--zarf-docs.netlify.app](https://deploy-preview-5621--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU2MjEtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.7UqruZcyBwt_zShs9sy-hztnL2iOB1iMO-9U1TdK810)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5621--zarf-docs.netlify.app) --> _To e
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 8ad77c0f1f6a022f9423f8b23b0be159b4abe30c | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6aee582079cee9020f8c86df | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5621--zarf-docs.netlify.app](https://deploy-preview-5621--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU2MjEtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.7UqruZcyBwt_zShs9sy-hztnL2iOB1iMO-9U1TdK810)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5621--zarf-docs.netlify.app) --> _To e

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

### Incident Patch 1: `b17ad042` (2026-11-07)
**Commit Message**: feat!: error when package secret write fails (#5621)

Signed-off-by: Austin Abro <[REDACTED_EMAIL]>

**File**: `src/pkg/cluster/zarf.go` (modified, +10/-0)
```diff
@@ -131,6 +131,13 @@ func (c *Cluster) StoreDeployedPackage(ctx context.Context, depPkg state.Deploye
 	return nil
 }
 
+// ValidateDeployedPackageSecretSize returns an error if the compressed deployment record
+// exceeds Kubernetes' Secret data limit. It does not access the cluster.
+func ValidateDeployedPackageSecretSize(depPkg state.DeployedPackage) error {
+	_, err := encodeDeployedPackage(depPkg)
+	return err
+}
+
 func encodeDeployedPackage(depPkg state.DeployedPackage) ([]byte, error) {
 	data, err := json.Marshal(depPkg)
 	if err != nil {
@@ -147,6 +154,9 @@ func encodeDeployedPackage(depPkg state.DeployedPackage) ([]byte, error) {
 	if err := writer.Close(); err != nil {
 		return nil, err
 	}
+	if buf.Len() > corev1.MaxSecretSize {
+		return nil, fmt.Errorf("package %q compressed deployment metadata is %d bytes, exceeding Kubernetes' %d-byte Secret data limit; reduce the package definition size or deployment overrides", depPkg.Name, buf.Len(), corev1.MaxSecretSize)
+	}
 	return buf.Bytes(), nil
 }
 
```

**File**: `src/pkg/cluster/zarf_test.go` (modified, +41/-0)
```diff
@@ -8,14 +8,18 @@ import (
 	"bytes"
 	"compress/gzip"
 	"context"
+	"encoding/base64"
 	"encoding/json"
 	"io"
 	"log/slog"
+	"math/rand/v2"
+	"strings"
 	"testing"
 	"time"
 
 	"github.com/stretchr/testify/require"
 	corev1 "k8s.io/api/core/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/client-go/kubernetes/fake"
 
@@ -25,8 +29,45 @@ import (
 	"github.com/zarf-dev/zarf/src/api/v1beta1"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/state"
+	"github.com/zarf-dev/zarf/src/pkg/value"
 )
 
+func TestUpdateDeployedPackageSecretSize(t *testing.T) {
+	t.Parallel()
+	rng := rand.New(rand.NewPCG(1, 2))
+	data := make([]byte, 1_100_000)
+	for i := range data {
+		data[i] = byte(rng.Uint32())
+	}
+	for _, tt := range []struct {
+		name      string
+		input     string
+		wantError bool
+	}{
+		{name: "large compressible values", input: strings.Repeat("a", 2_000_000)},
+		{name: "compressed values over limit", input: base64.StdEncoding.EncodeToString(data), wantError: true},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := t.Context()
+			c := &Cluster{Clientset: fake.NewClientset()}
+			deployed := state.DeployedPackage{Name: "secret-size"}
+			deployed.SetDeployConfig(state.DeployConfig{Values: value.Values{"input": tt.input}})
+			err := c.StoreDeployedPackage(ctx, deployed)
+			if tt.wantError {
+				require.ErrorContains(t, err, "1048576-byte Secret data limit")
+				_, err = c.GetDeployedPackage(ctx, deployed.Name)
+				require.True(t, kerrors.IsNotFound(err), "oversized state must not be written")
+				return
+			}
+			require.NoError(t, err)
+			loaded, err := c.GetDeployedPackage(ctx, deployed.Name)
+			require.NoError(t, err)
+			require.Equal(t, deployed, *loaded)
+		})
+	}
+}
+
 func TestGetDeployedPackageWarnsOnUnrecognizedAPIVersion(t *testing.T) {
 	t.Parallel()
 
```

**File**: `src/pkg/packager/create.go` (modified, +8/-17)
```diff
@@ -5,14 +5,14 @@ package packager
 
 import (
 	"context"
-	"encoding/json"
 	"errors"
 	"fmt"
 	"path/filepath"
 
 	"github.com/zarf-dev/zarf/src/api"
 	"github.com/zarf-dev/zarf/src/api/v1beta1"
 	"github.com/zarf-dev/zarf/src/config"
+	"github.com/zarf-dev/zarf/src/pkg/cluster"
 	"github.com/zarf-dev/zarf/src/pkg/feature"
 	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/images"
@@ -28,9 +28,6 @@ import (
 	"github.com/zarf-dev/zarf/src/types"
 )
 
-// Leave headroom below Kubernetes' 1 MiB Secret limit for deployment metadata.
-const packageSecretSizeLimit = 1_000_000
-
 // CreateOptions are the optional parameters to create.
 type CreateOptions struct {
 	// Architecture overrides package metadata. Empty falls back to metadata, then the host.
@@ -132,7 +129,7 @@ func Create(ctx context.Context, packagePath string, output string, opts CreateO
 	defer func() {
 		err = errors.Join(err, pkgLayout.Cleanup())
 	}()
-	if err := validatePackageSecretSize(pkgLayout.Definition(), pkgLayout.Digest()); err != nil {
+	if err := validatePackageSecretSize(pkgLayout.Definition(), pkgLayout.Digest(), state.DeployConfig{}); err != nil {
 		return "", err
 	}
 
@@ -182,9 +179,9 @@ func Create(ctx context.Context, packagePath string, output string, opts CreateO
 	return packageLocation, nil
 }
 
-// Check the persisted definition, including compatibility copies and component status,
-// before writing a created package.
-func validatePackageSecretSize(pkg api.Package, digest string) error {
+// Check the compressed deployment record, including compatibility copies, component
+// status, and saved overrides, before creating or deploying a package.
+func validatePackageSecretSize(pkg api.Package, digest string, deployConfig state.DeployConfig) error {
 	components := make([]state.DeployedComponent, 0, len(pkg.Components))
 	for _, component := range pkg.Components {
 		components = append(components, state.DeployedComponent{
@@ -193,16 +190,10 @@ func validatePackageSecretSize(pkg api.Package, digest string) error {
 			ObservedGeneration: 1,
 		})
 	}
-	deployed, err := state.NewDeployedPackage(pkg, digest, config.CLIVersion, components, 1)
+	deployed, err := state.NewDeployedPackage(pkg, digest, config.CLIVersion, components, 1, state.WithPackageNamespaceOverride(deployConfig.NamespaceOverride))
 	if err != nil {
 		return err
 	}
-	data, err := json.Marshal(deployed)
-	if err != nil {
-		return err
-	}
-	if len(data) > packageSecretSizeLimit {
-		return fmt.Errorf("package %q cannot be created: its deployment metadata is %d bytes, exceeding Zarf's %d-byte limit for Kubernetes Secret storage; reduce the package definition size", pkg.Metadata.Name, len(data), packageSecretSizeLimit)
-	}
-	return nil
+	deployed.SetDeployConfig(deployConfig)
+	return cluster.ValidateDeployedPackageSecretSize(*deployed)
 }
```

**File**: `src/pkg/packager/create_test.go` (modified, +29/-9)
```diff
@@ -4,7 +4,9 @@
 package packager
 
 import (
+	"encoding/base64"
 	"fmt"
+	"math/rand/v2"
 	"os"
 	"path/filepath"
 	"runtime"
@@ -20,22 +22,36 @@ import (
 	"github.com/zarf-dev/zarf/src/test/testutil"
 )
 
+// Use deterministic high-entropy text to exercise compressed Secret limits.
+func deploymentStateText(size int) string {
+	rng := rand.New(rand.NewPCG(1, 2))
+	data := make([]byte, size)
+	for i := range data {
+		data[i] = byte(rng.Uint32())
+	}
+	return base64.StdEncoding.EncodeToString(data)
+}
+
 func TestPackageCreateSecretSize(t *testing.T) {
 	t.Parallel()
+	large := deploymentStateText(1_100_000)
+	medium := deploymentStateText(600_000)
 	for _, tt := range []struct {
 		name        string
 		apiVersion  string
 		description string
+		values      string
 		wantError   bool
 	}{
-		{name: "implicit-alpha-over-limit", description: strings.Repeat("a", 1_000_000), wantError: true},
-		{name: "alpha-below-limit", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("a", 900_000)},
-		{name: "alpha-over-limit", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("a", 1_000_000), wantError: true},
-		// Ampersands exercise JSON escaping and remain quoted when the definition is written as YAML.
-		{name: "alpha-json-escaping-exceeds-limit", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("&", 180_000), wantError: true},
-		{name: "beta-below-limit", apiVersion: v1beta1.APIVersion, description: strings.Repeat("a", 450_000)},
-		// The beta definition fits alone, but its alpha compatibility copy pushes the secret over the limit.
-		{name: "beta-compatibility-copy-exceeds-limit", apiVersion: v1beta1.APIVersion, description: strings.Repeat("a", 600_000), wantError: true},
+		{name: "implicit-alpha-compressed-over-limit", description: large, wantError: true},
+		{name: "alpha-compressed-below-limit", apiVersion: v1alpha1.APIVersion, description: medium},
+		{name: "alpha-large-compressible-definition", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("a", 2_000_000)},
+		{name: "alpha-compressed-over-limit", apiVersion: v1alpha1.APIVersion, description: large, wantError: true},
+		{name: "alpha-compressible-json-escaping", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("&", 180_000)},
+		{name: "beta-large-compressible-definition", apiVersion: v1beta1.APIVersion, description: strings.Repeat("a", 2_000_000)},
+		// The beta definition fits alone, but its alpha compatibility copy pushes the compressed Secret over the limit.
+		{name: "beta-compatibility-copy-exceeds-limit", apiVersion: v1beta1.APIVersion, description: medium, wantError: true},
+		{name: "package-default-values-are-not-saved", apiVersion: v1beta1.APIVersion, values: large},
 	} {
 		t.Run(tt.name, func(t *testing.T) {
 			t.Parallel()
@@ -52,13 +68,17 @@ components:
 			if tt.apiVersion != "" {
 				definition = "apiVersion: " + tt.apiVersion + "\n" + definition
 			}
+			if tt.values != "" {
+				definition += "values:\n  files:\n    - values.yaml\n"
+				require.NoError(t, os.WriteFile(filepath.Join(packageDir, "values.yaml"), []byte("input: "+tt.values+"\n"), 0o600))
+			}
 			require.NoError(t, os.WriteFile(filepath.Join(packageDir, layout.ZarfYAML), []byte(definition), 0o600))
 			packagePath, err := Create(ctx, packageDir, outputDir, CreateOptions{
 				CachePath: t.TempDir(),
 				SkipSBOM:  true,
 			})
 			if tt.wantError {
-				require.ErrorContains(t, err, "1000000-byte limit")
+				require.ErrorContains(t, err, "1048576-byte Secret data limit")
 				require.Empty(t, packagePath)
 				entries, err := os.ReadDir(outputDir)
 				require.NoError(t, err)
```

**File**: `src/pkg/packager/deploy.go` (modified, +24/-24)
```diff
@@ -117,6 +117,18 @@ func (opts DeployOptions) Validate(pkg api.Package) error {
 	return nil
 }
 
+func (opts DeployOptions) deployConfig(pkg api.Package) state.DeployConfig {
+	selectors, _ := pkg.ComponentSelectors()
+	return state.DeployConfig{
+		SetVariables:       opts.SetVariables,
+		Values:             opts.Values,
+		NamespaceOverride:  opts.NamespaceOverride,
+		ValuesOverridesMap: opts.ValuesOverridesMap,
+		ComponentSelectors: selectors,
+		Connectivity:       opts.Connectivity,
+	}
+}
+
 // deployer tracks mutable fields across deployments. Because components can create a cluster and create state
 // any of these fields are subject to change from one component to the next
 type deployer struct {
@@ -148,6 +160,9 @@ func Deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts DeployOpt
 	if err := opts.Validate(pkg); err != nil {
 		return DeployResult{}, err
 	}
+	if err := validatePackageSecretSize(pkg, pkgLayout.Digest(), opts.deployConfig(pkg)); err != nil {
+		return DeployResult{}, err
+	}
 
 	// Validate operational requirements before proceeding
 	if !opts.SkipVersionCheck {
@@ -297,15 +312,7 @@ func (d *deployer) startDeploymentState(ctx context.Context, pkgLayout *layout.P
 	deployedPkg.CLIVersion = config.CLIVersion
 	deployedPkg.NamespaceOverride = opts.NamespaceOverride
 
-	selectors, _ := pkg.ComponentSelectors()
-	d.deployConfig = state.DeployConfig{
-		SetVariables:       opts.SetVariables,
-		Values:             opts.Values,
-		NamespaceOverride:  opts.NamespaceOverride,
-		ValuesOverridesMap: opts.ValuesOverridesMap,
-		ComponentSelectors: selectors,
-		Connectivity:       opts.Connectivity,
-	}
+	d.deployConfig = opts.deployConfig(pkg)
 	d.configDigest, err = d.deployConfig.Digest()
 	if err != nil {
 		return fmt.Errorf("digest deploy config: %w", err)
@@ -433,7 +440,7 @@ func (d *deployer) deployComponents(ctx context.Context, pkgLayout *layout.Packa
 			}
 		}
 		if err := d.persistDeploymentState(ctx, deployedComponents); err != nil {
-			l.Error("unable to record package deployment", "component", component.Name, "error", err.Error())
+			return nil, err
 		}
 		if pkg.IsInitConfig() {
 			charts, deployErr = d.deployInitComponent(ctx, pkgLayout, component, opts)
@@ -469,7 +476,7 @@ func (d *deployer) deployComponents(ctx context.Context, pkgLayout *layout.Packa
 		}
 
 		if deployErr != nil {
-			cleanup := func(ctx context.Context) {
+			cleanup := func(ctx context.Context) error {
 				onFailure()
 				l.Debug("component deployment failed", "component", component.Name, "error", deployErr.Error())
 				deployedComponents[idx].Status = state.ComponentStatusFailed //nolint:staticcheck // Legacy status remains persisted for compatibility.
@@ -478,18 +485,14 @@ func (d *deployer) deployComponents(ctx context.Context, pkgLayout *layout.Packa
 				if d.deployedPkg != nil {
 					d.deployedPkg.AppendEvent(d.deployPackageEvent(pkgLayout, opts, state.EventOutcomeFailed))
 				}
-				if err := d.persistDeploymentState(ctx, deployedComponents); err != nil {
-					l.Error("unable to record package deployment", "component", component.Name, "error", err.Error())
-				}
+				return d.persistDeploymentState(ctx, deployedComponents)
 			}
 			select {
 			case <-ctx.Done():
 				// Use background context here in order to ensure the cleanup logic can run when the context is cancelled.
-				cleanup(context.Background())
-				return nil, fmt.Errorf("context cancelled while deploying component %q: %w", component.Name, deployErr)
+				return nil, fmt.Errorf("context cancelled while deploying component %q: %w", component.Name, errors.Join(deployErr, cleanup(context.Background())))
 			default:
-				cleanup(ctx)
-				return nil, fmt.Errorf("unable to deploy component %q: %w", component.Name, deployErr)
+				return nil, fmt.Errorf("unable to deploy component %q: %w", component.Name, errors.Join(deployErr, cleanup(ctx)))
 			}
 		}
 
@@ -498,7 +501,7 @@ func (d *deployer) deployComponents(ctx context.Context, pkgLayout *layout.Packa
 		deployedComponents[idx].Status = state.ComponentStatusSucceeded //nolint:staticcheck // Legacy status remains persisted for compatibility.
 		deployedComponents[idx].LastEvent = state.ComponentEvent{Type: state.EventTypeDeploy, Outcome: state.EventOutcomeSucceeded, Timestamp: time.Now()}
 		if err := d.persistDeploymentState(ctx, deployedComponents); err != nil {
-			l.Error("unable to record package deployment", "component", component.Name, "error", err.Error())
+			return nil, err
 		}
 
 		// Alpha success hooks observe the saved successful deployment.
@@ -508,10 +511,7 @@ func (d *deployer) deployComponents(ctx context.Context, pkgLayout *layout.Packa
 				if d.deployedPkg != nil {
 					d.deployedPkg.AppendEvent(d.deployPackageEvent(pkgLayout, opts, state.EventOutcomeFailed))
 				}
-				if persistErr := d.persistDeploymentState(ctx, deployedComponents); persistErr != nil {
-					l.Error("unable to record package deployment", "component", component
```

**File**: `src/pkg/packager/deploy_test.go` (modified, +53/-0)
```diff
@@ -6,6 +6,7 @@ package packager
 import (
 	"bytes"
 	"context"
+	"fmt"
 	"net/http"
 	"net/http/httptest"
 	"os"
@@ -42,6 +43,58 @@ import (
 	"sigs.k8s.io/cli-utils/pkg/kstatus/status"
 )
 
+func TestDeploySecretSize(t *testing.T) {
+	t.Parallel()
+	large := deploymentStateText(1_100_000)
+	medium := deploymentStateText(600_000)
+	for _, tt := range []struct {
+		name          string
+		apiVersion    string
+		description   string
+		defaultValues value.Values
+		opts          DeployOptions
+		wantError     bool
+	}{
+		{name: "legacy compressed over limit", description: large, wantError: true},
+		{name: "alpha compressed over limit", apiVersion: v1alpha1.APIVersion, description: large, wantError: true},
+		{name: "compressible definition", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("a", 2_000_000)},
+		{name: "compressible JSON escaping", apiVersion: v1alpha1.APIVersion, description: strings.Repeat("&", 180_000)},
+		{name: "beta compatibility copy", apiVersion: v1beta1.APIVersion, description: medium, wantError: true},
+		{name: "values overrides", apiVersion: v1beta1.APIVersion, opts: DeployOptions{Values: value.Values{"input": large}}, wantError: true},
+		{name: "chart values overrides", opts: DeployOptions{ValuesOverridesMap: ValuesOverrides{"local": {"chart": value.Values{"input": large}}}}, wantError: true},
+		{name: "variable overrides", opts: DeployOptions{SetVariables: map[string]string{"INPUT": large}}, wantError: true},
+		{name: "definition and values combined", apiVersion: v1alpha1.APIVersion, description: medium, opts: DeployOptions{Values: value.Values{"input": medium}}, wantError: true},
+		{name: "compressible values overrides", apiVersion: v1beta1.APIVersion, opts: DeployOptions{Values: value.Values{"input": strings.Repeat("a", 2_000_000)}}},
+		{name: "package default values are not saved", apiVersion: v1beta1.APIVersion, defaultValues: value.Values{"input": large}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := testutil.TestContext(t)
+			marker := filepath.Join(t.TempDir(), "deployed")
+			pkg := api.Package{
+				APIVersion: tt.apiVersion,
+				Kind:       api.ZarfPackageConfig,
+				Metadata:   api.PackageMetadata{Name: "oversized", Description: tt.description},
+				Components: []api.Component{{Name: "local", Actions: api.ComponentActions{OnDeploy: api.ActionSet{
+					Before: []api.Action{{Cmd: fmt.Sprintf("touch %q", marker)}},
+				}}}},
+			}
+			pkgLayout, err := assemble.AssemblePackage(ctx, &load.ResolvedPackage{Definition: pkg, Resources: load.NewResourceSet(t.TempDir()), Values: tt.defaultValues}, assemble.AssembleOptions{SkipSBOM: true})
+			require.NoError(t, err)
+			t.Cleanup(func() { require.NoError(t, pkgLayout.Cleanup()) })
+
+			_, err = Deploy(ctx, pkgLayout, tt.opts)
+			if tt.wantError {
+				require.ErrorContains(t, err, "1048576-byte Secret data limit")
+				require.NoFileExists(t, marker, "size validation must precede even local components")
+				return
+			}
+			require.NoError(t, err)
+			require.FileExists(t, marker)
+		})
+	}
+}
+
 func TestDeployLeavesComponentSelectionToCaller(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 2: `c2423271` (2026-11-07)
**Commit Message**: feat!: compress Zarf state (#5619)

Signed-off-by: Austin Abro <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@ test-proxy:
 test-upgrade: ## Run the Zarf CLI E2E tests for an external registry and cluster
 	@test -s $(ZARF_BIN) || $(MAKE)
 	[ -n "$(shell zarf version)" ] || (echo "Zarf must be installed prior to the upgrade test" && exit 1)
-	[ -n "$(shell zarf package list 2>&1 | grep test-upgrade-package)" ] || (echo "Zarf must be initialized and have the 6.3.3 upgrade-test package installed prior to the upgrade test" && exit 1)
+	[ -n "$(shell $(ZARF_BIN) package list 2>&1 | grep test-upgrade-package)" ] || (echo "Zarf must be initialized and have the 6.3.3 upgrade-test package installed prior to the upgrade test" && exit 1)
 	@test -s "zarf-package-test-upgrade-package-amd64-6.3.4.tar.zst" || zarf package create src/test/upgrade/ --set PODINFO_VERSION=6.3.4 --confirm
 	cd src/test/upgrade && go test -failfast -v -timeout 30m
 
```

**File**: `site/src/content/docs/ref/packages.mdx` (modified, +16/-4)
```diff
@@ -77,14 +77,26 @@ A remote tarball is a Zarf package tarball that is hosted on a web server that i
 
 An OCI package is one that has been published to an OCI compatible registry using `zarf package publish` or the `-o` option on `zarf package create`.  These packages live within a given registry and you can learn more about them in our [Publish & Deploy Packages w/OCI Tutorial](/tutorials/6-publish-and-deploy/).
 
-:::note
+### Deployed Packages
 
-In addition to the traditional sources outlined above, there is also a special "Cluster" source available on `inspect` and `remove` that allows for referencing a deployed package via its name:
+{/*TODO probably worth having a published package state schema to link to and a drop down example verified against said schema*/}
 
-- `zarf package inspect <package name>`
+When a package is deployed to a cluster, Zarf stores its definition and deployment state in a `zarf-package-*` Secret in the `zarf` namespace. This state is used to list, inspect, update, and remove deployed packages.
+
+Deployed packages can be referenced by name as a "Cluster" source for `inspect` and `remove`:
+
+- `zarf package inspect definition|digest|images <package name> `
 - `zarf package remove <package name>`
 
-Additionally, inspecting a package deployed to a cluster will not be able to show the package's SBOMs, as they are not currently persisted to the cluster.
+Deployed packages are stored as gzip-compressed JSON data in a Kubernetes secret. To inspect it directly:
+
+```sh
+zarf tools kubectl get secret -n zarf zarf-package-<package-name> -o jsonpath='{.data.data}' | base64 -d | gzip -dc
+```
+
+:::caution
+
+Pre-v1.0 versions of Zarf only recognized uncompressed state and will fail to read deployment state written by v1.0+ CLIs.
 
 :::
 
```

**File**: `src/pkg/cluster/zarf.go` (modified, +65/-20)
```diff
@@ -5,10 +5,13 @@
 package cluster
 
 import (
+	"bytes"
+	"compress/gzip"
 	"context"
 	"encoding/json"
 	"errors"
 	"fmt"
+	"io"
 	"slices"
 	"sort"
 	"strings"
@@ -26,6 +29,8 @@ import (
 	"github.com/zarf-dev/zarf/src/pkg/state"
 )
 
+const packageCompressionFormatAnnotation = "zarf.dev/compression-format"
+
 // GetDeployedZarfPackages gets metadata information about packages that have been deployed to the cluster.
 // We determine what packages have been deployed to the cluster by looking for specific secrets in the Zarf namespace.
 // Returns a list of DeployedPackage structs and a list of errors.
@@ -45,9 +50,9 @@ func (c *Cluster) GetDeployedZarfPackages(ctx context.Context) ([]state.Deployed
 		}
 		var deployedPackage state.DeployedPackage
 		// Process the k8s secret into our internal structs
-		err := json.Unmarshal(secret.Data["data"], &deployedPackage)
+		err := decodeDeployedPackage(&secret, &deployedPackage)
 		if err != nil {
-			errs = append(errs, fmt.Errorf("unable to unmarshal the secret %s/%s", secret.Namespace, secret.Name))
+			errs = append(errs, fmt.Errorf("unable to decode the secret %s/%s: %w", secret.Namespace, secret.Name, err))
 			continue
 		}
 		warnOnUnrecognizedPackageAPIVersions(ctx, deployedPackage)
@@ -78,9 +83,9 @@ func (c *Cluster) GetDeployedPackage(ctx context.Context, packageName string, op
 		return nil, err
 	}
 
-	err = json.Unmarshal(secret.Data["data"], deployedPackage)
+	err = decodeDeployedPackage(secret, deployedPackage)
 	if err != nil {
-		return nil, err
+		return nil, fmt.Errorf("unable to decode the secret %s/%s: %w", secret.Namespace, secret.Name, err)
 	}
 	warnOnUnrecognizedPackageAPIVersions(ctx, *deployedPackage)
 	return deployedPackage, nil
@@ -101,28 +106,68 @@ func warnOnUnrecognizedPackageAPIVersions(ctx context.Context, deployedPackage s
 	logger.From(ctx).Warn("deployed package contains an API version this version of Zarf does not recognize; operations may use an older converted API version", "package", deployedPackage.Name, "apiVersions", unknown)
 }
 
-// UpdateDeployedPackage updates the deployed package metadata.
-func (c *Cluster) UpdateDeployedPackage(ctx context.Context, depPkg state.DeployedPackage) error {
-	if err := c.applyDeployedPackage(ctx, depPkg); err != nil {
-		return fmt.Errorf("unable to apply the deployed package secret: %w", err)
-	}
-	return nil
-}
-
-func (c *Cluster) applyDeployedPackage(ctx context.Context, depPkg state.DeployedPackage) error {
-	packageSecretData, err := json.Marshal(depPkg)
+// StoreDeployedPackage creates or updates the deployed package metadata Secret.
+func (c *Cluster) StoreDeployedPackage(ctx context.Context, depPkg state.DeployedPackage) error {
+	packageSecretData, err := encodeDeployedPackage(depPkg)
 	if err != nil {
-		return err
+		return fmt.Errorf("unable to apply the deployed package secret: %w", err)
 	}
 	packageSecret := v1ac.Secret(depPkg.GetSecretName(), state.ZarfNamespaceName).
 		WithLabels(map[string]string{
 			state.ZarfManagedByLabel:   "zarf",
 			state.ZarfPackageInfoLabel: depPkg.Name,
-		}).WithData(map[string][]byte{
-		"data": packageSecretData,
-	}).WithType(corev1.SecretTypeOpaque)
+		}).
+		WithAnnotations(map[string]string{
+			packageCompressionFormatAnnotation: "gzip",
+		}).
+		WithData(map[string][]byte{
+			"data": packageSecretData,
+		}).
+		WithType(corev1.SecretTypeOpaque)
 	_, err = c.Clientset.CoreV1().Secrets(*packageSecret.Namespace).Apply(ctx, packageSecret, metav1.ApplyOptions{Force: true, FieldManager: FieldManagerName})
-	return err
+	if err != nil {
+		return fmt.Errorf("unable to apply the deployed package secret: %w", err)
+	}
+	return nil
+}
+
+func encodeDeployedPackage(depPkg state.DeployedPackage) ([]byte, error) {
+	data, err := json.Marshal(depPkg)
+	if err != nil {
+		return nil, err
+	}
+	var buf bytes.Buffer
+	writer, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
+	if err != nil {
+		return nil, err
+	}
+	if _, err := writer.Write(data); err != nil {
+		return nil, errors.Join(err, writer.Close())
+	}
+	if err := writer.Close(); err != nil {
+		return nil, err
+	}
+	return buf.Bytes(), nil
+}
+
+func decodeDeployedPackage(secret *corev1.Secret, depPkg *state.DeployedPackage) error {
+	data := secret.Data["data"]
+	switch format := secret.Annotations[packageCompressionFormatAnnotation]; format {
+	case "":
+		// Packages stored before compression was introduced contain plain JSON.
+	case "gzip":
+		reader, err := gzip.NewReader(bytes.NewReader(data))
+		if err != nil {
+			return err
+		}
+		data, err = io.ReadAll(reader)
+		if err = errors.Join(err, reader.Close()); err != nil {
+			return err
+		}
+	default:
+		return fmt.Errorf("unsupported deployed package compression format %q", format)
+	}
+	return json.Unmarshal(data, depPkg)
 }
 
 // DeleteDeployedPackage removes the metadata for the deployed package.
@@ -185,7 +230,7 @@ func (c *Cluster) RecordPackageDeployment(ctx context.Context, pkg api.Package,
 		return nil, e
```

**File**: `src/pkg/cluster/zarf_test.go` (modified, +88/-17)
```diff
@@ -6,8 +6,10 @@ package cluster
 
 import (
 	"bytes"
+	"compress/gzip"
 	"context"
 	"encoding/json"
+	"io"
 	"log/slog"
 	"testing"
 	"time"
@@ -105,11 +107,17 @@ func TestRecordPackageDefinitionDeployment(t *testing.T) {
 
 	secret, err := c.Clientset.CoreV1().Secrets(state.ZarfNamespaceName).Get(ctx, recorded.GetSecretName(), metav1.GetOptions{})
 	require.NoError(t, err)
+	require.Equal(t, "gzip", secret.Annotations["zarf.dev/compression-format"])
+	reader, err := gzip.NewReader(bytes.NewReader(secret.Data["data"]))
+	require.NoError(t, err)
+	secretData, err := io.ReadAll(reader)
+	require.NoError(t, reader.Close())
+	require.NoError(t, err)
 	var serialized struct {
 		Data        v1alpha1.ZarfPackage       `json:"data"`
 		PackageData map[string]json.RawMessage `json:"packageData"`
 	}
-	require.NoError(t, json.Unmarshal(secret.Data["data"], &serialized))
+	require.NoError(t, json.Unmarshal(secretData, &serialized))
 	require.Equal(t, convert.PackageToV1alpha1(definition), serialized.Data)
 	require.Len(t, serialized.PackageData, 1)
 	require.Contains(t, serialized.PackageData, v1beta1.APIVersion)
@@ -190,22 +198,27 @@ func TestGetDeployedPackage(t *testing.T) {
 	}
 
 	for _, p := range packages {
-		b, err := json.Marshal(p)
-		require.NoError(t, err)
-		secret := corev1.Secret{
-			ObjectMeta: metav1.ObjectMeta{
-				Name:      p.GetSecretName(),
-				Namespace: "zarf",
-				Labels: map[string]string{
-					state.ZarfPackageInfoLabel: p.Name,
+		if p.NamespaceOverride != "" {
+			require.NoError(t, c.StoreDeployedPackage(ctx, p))
+		} else {
+			// Existing uncompressed state must remain readable alongside new state.
+			b, err := json.Marshal(p)
+			require.NoError(t, err)
+			secret := corev1.Secret{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      p.GetSecretName(),
+					Namespace: "zarf",
+					Labels: map[string]string{
+						state.ZarfPackageInfoLabel: p.Name,
+					},
 				},
-			},
-			Data: map[string][]byte{
-				"data": b,
-			},
+				Data: map[string][]byte{
+					"data": b,
+				},
+			}
+			_, err = c.Clientset.CoreV1().Secrets("zarf").Create(ctx, &secret, metav1.CreateOptions{})
+			require.NoError(t, err)
 		}
-		_, err = c.Clientset.CoreV1().Secrets("zarf").Create(ctx, &secret, metav1.CreateOptions{})
-		require.NoError(t, err)
 		actual, err := c.GetDeployedPackage(ctx, p.Name, state.WithPackageNamespaceOverride(p.NamespaceOverride))
 		require.NoError(t, err)
 		require.Equal(t, p, *actual)
@@ -228,6 +241,63 @@ func TestGetDeployedPackage(t *testing.T) {
 	require.ElementsMatch(t, packages, actualList)
 }
 
+func TestGetDeployedPackageCompressedState(t *testing.T) {
+	t.Parallel()
+
+	var buf bytes.Buffer
+	writer := gzip.NewWriter(&buf)
+	_, err := writer.Write([]byte(`{"name":"compressed"}`))
+	require.NoError(t, err)
+	require.NoError(t, writer.Close())
+	compressed := buf.Bytes()
+	badChecksum := bytes.Clone(compressed)
+	badChecksum[len(badChecksum)-8] ^= 0xff
+
+	for name, tt := range map[string]struct {
+		format string
+		data   []byte
+		err    string
+	}{
+		"valid":                   {"gzip", compressed, ""},
+		"truncated header":        {"gzip", []byte{0x1f, 0x8b, 0x08}, io.ErrUnexpectedEOF.Error()},
+		"truncated gzip":          {"gzip", compressed[:len(compressed)-1], io.ErrUnexpectedEOF.Error()},
+		"invalid checksum":        {"gzip", badChecksum, gzip.ErrChecksum.Error()},
+		"uncompressed gzip data":  {"gzip", []byte(`{"name":"compressed"}`), gzip.ErrHeader.Error()},
+		"unsupported compression": {"zstd", []byte(`{"name":"compressed"}`), `unsupported deployed package compression format "zstd"`},
+	} {
+		t.Run(name, func(t *testing.T) {
+			t.Parallel()
+			secret := &corev1.Secret{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      "zarf-package-compressed",
+					Namespace: state.ZarfNamespaceName,
+					Labels:    map[string]string{state.ZarfPackageInfoLabel: "compressed"},
+					Annotations: map[string]string{
+						"zarf.dev/compression-format": tt.format,
+					},
+				},
+				Data: map[string][]byte{"data": tt.data},
+			}
+			c := &Cluster{Clientset: fake.NewClientset(secret)}
+			loaded, err := c.GetDeployedPackage(t.Context(), "compressed")
+			listed, listErr := c.GetDeployedZarfPackages(t.Context())
+			if tt.err == "" {
+				require.NoError(t, err)
+				require.NoError(t, listErr)
+				require.Equal(t, &state.DeployedPackage{Name: "compressed"}, loaded)
+				require.Equal(t, []state.DeployedPackage{*loaded}, listed)
+				return
+			}
+			require.ErrorContains(t, err, tt.err)
+			require.ErrorContains(t, err, "zarf/zarf-package-compressed")
+			require.Nil(t, loaded)
+			require.ErrorContains(t, listErr, tt.err)
+			require.ErrorContains(t, listErr, "zarf/zarf-package-compressed")
+			require.Nil(t, listed)
+		})
+	}
+}
+
 func TestInternalGitServerExists(t *testing.T) {
 	tests := []struct {
 		name          string
@@ -283,11 +353,11 @@ func TestUpdateDeployedPackagePreservesLifecycleState(t *testing.T) {
 	require.NoError(t, err)
 	depl
```

**File**: `src/pkg/packager/deploy.go` (modified, +2/-2)
```diff
@@ -312,7 +312,7 @@ func (d *deployer) startDeploymentState(ctx context.Context, pkgLayout *layout.P
 	}
 	deployedPkg.AppendEvent(d.deployPackageEvent(pkgLayout, opts, state.EventOutcomeInProgress))
 	d.deployedPkg = deployedPkg
-	return d.c.UpdateDeployedPackage(ctx, *d.deployedPkg)
+	return d.c.StoreDeployedPackage(ctx, *d.deployedPkg)
 }
 
 func (d *deployer) prepareDeploymentState(ctx context.Context, pkgLayout *layout.PackageLayout, opts DeployOptions) error {
@@ -351,7 +351,7 @@ func (d *deployer) persistDeploymentState(ctx context.Context, components []stat
 		return nil
 	}
 	d.deployedPkg.SetDeployedComponents(components)
-	return d.c.UpdateDeployedPackage(ctx, *d.deployedPkg)
+	return d.c.StoreDeployedPackage(ctx, *d.deployedPkg)
 }
 
 func (d *deployer) deployComponents(ctx context.Context, pkgLayout *layout.PackageLayout, opts DeployOptions) (deployedComponents []state.DeployedComponent, err error) {
```

**File**: `src/pkg/packager/remove.go` (modified, +6/-6)
```diff
@@ -141,7 +141,7 @@ func Remove(ctx context.Context, definition api.Package, opts RemoveOptions) err
 	}
 	if persistState {
 		depPkg.AppendEvent(removePackageEvent(state.EventOutcomeInProgress))
-		if err := opts.Cluster.UpdateDeployedPackage(ctx, *depPkg); err != nil {
+		if err := opts.Cluster.StoreDeployedPackage(ctx, *depPkg); err != nil {
 			l.Warn("unable to update secret for package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", err.Error())
 		}
 	}
@@ -170,7 +170,7 @@ func Remove(ctx context.Context, definition api.Package, opts RemoveOptions) err
 		depComp.Status = state.ComponentStatusRemoving //nolint:staticcheck // Legacy status remains persisted for compatibility.
 		depComp.LastEvent = state.ComponentEvent{Type: state.EventTypeRemove, Outcome: state.EventOutcomeInProgress, Timestamp: time.Now()}
 		if persistState {
-			if err := opts.Cluster.UpdateDeployedPackage(ctx, *depPkg); err != nil {
+			if err := opts.Cluster.StoreDeployedPackage(ctx, *depPkg); err != nil {
 				l.Warn("unable to update secret for package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", err.Error())
 			}
 		}
@@ -200,7 +200,7 @@ func Remove(ctx context.Context, definition api.Package, opts RemoveOptions) err
 					// remove the helm chart from the installed charts slice.
 					depComp.InstalledCharts = slices.Delete(depComp.InstalledCharts, j, j+1)
 
-					err = opts.Cluster.UpdateDeployedPackage(ctx, *depPkg)
+					err = opts.Cluster.StoreDeployedPackage(ctx, *depPkg)
 					if err != nil {
 						// We warn and ignore errors because we may have removed the cluster that this package was inside of
 						l.Warn("unable to update secret for package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", err.Error())
@@ -228,7 +228,7 @@ func Remove(ctx context.Context, definition api.Package, opts RemoveOptions) err
 			// Remove completed components locally even when no deployment record exists.
 			depPkg.DeployedComponents = slices.Delete(depPkg.DeployedComponents, i, i+1)
 			if persistState {
-				err = opts.Cluster.UpdateDeployedPackage(ctx, *depPkg)
+				err = opts.Cluster.StoreDeployedPackage(ctx, *depPkg)
 				if err != nil {
 					// We warn and ignore errors because we may have removed the cluster that this package was inside of
 					l.Warn("unable to update secret package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", err.Error())
@@ -241,7 +241,7 @@ func Remove(ctx context.Context, definition api.Package, opts RemoveOptions) err
 				depComp.Status = state.ComponentStatusFailed //nolint:staticcheck // Legacy status remains persisted for compatibility.
 				depComp.LastEvent = state.ComponentEvent{Type: state.EventTypeRemove, Outcome: state.EventOutcomeFailed, Timestamp: time.Now()}
 				depPkg.AppendEvent(removePackageEvent(state.EventOutcomeFailed))
-				if updateErr := opts.Cluster.UpdateDeployedPackage(ctx, *depPkg); updateErr != nil {
+				if updateErr := opts.Cluster.StoreDeployedPackage(ctx, *depPkg); updateErr != nil {
 					l.Warn("unable to update secret for package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", updateErr.Error())
 				}
 			}
@@ -265,7 +265,7 @@ func Remove(ctx context.Context, definition api.Package, opts RemoveOptions) err
 			if err != nil {
 				l.Warn("unable to delete secret for package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", err.Error())
 			}
-		} else if err := opts.Cluster.UpdateDeployedPackage(ctx, *depPkg); err != nil {
+		} else if err := opts.Cluster.StoreDeployedPackage(ctx, *depPkg); err != nil {
 			l.Warn("unable to update secret for package, this may be normal if the cluster was removed", "pkgName", depPkg.Name, "error", err.Error())
 		}
 	}
```

**File**: `src/pkg/packager/remove_test.go` (modified, +2/-2)
```diff
@@ -98,7 +98,7 @@ func TestRemovePersistsChartProgress(t *testing.T) {
 			require.NoError(t, err)
 			deployed.SetDeployConfig(DeployConfig{SetVariables: map[string]string{"VARIABLE": "value"}})
 			deployed.AppendEvent(state.PackageEvent{Type: state.EventTypeDeploy, Outcome: state.EventOutcomeSucceeded})
-			require.NoError(t, c.UpdateDeployedPackage(ctx, *deployed))
+			require.NoError(t, c.StoreDeployedPackage(ctx, *deployed))
 			opts := RemoveOptions{Cluster: c}
 
 			// Both the initial failure and a retry must retain only the outstanding chart.
@@ -326,7 +326,7 @@ func TestRemoveLocalComponentPreservesRecordedPackage(t *testing.T) {
 			recorded.SetDeployConfig(config)
 			initialEvent := state.PackageEvent{Type: state.EventTypeDeploy, Outcome: state.EventOutcomeSucceeded, Timestamp: time.Unix(1, 0).UTC()}
 			recorded.AppendEvent(initialEvent)
-			require.NoError(t, c.UpdateDeployedPackage(ctx, *recorded))
+			require.NoError(t, c.StoreDeployedPackage(ctx, *recorded))
 			removeConfig := RemoveConfig{ComponentSelectors: []string{"local"}, NamespaceOverride: "tenant"}
 
 			err = Remove(ctx, pkg, RemoveOptions{Cluster: c, RemoveConfig: removeConfig})
```

**File**: `src/test/e2e/37_component_status_test.go` (modified, +12/-0)
```diff
@@ -5,9 +5,13 @@
 package test
 
 import (
+	"bytes"
+	"compress/gzip"
 	"encoding/base64"
 	"encoding/json"
+	"errors"
 	"fmt"
+	"io"
 	"path/filepath"
 	"sync"
 	"testing"
@@ -98,6 +102,14 @@ func getDeployedPackage(secret string) (*state.DeployedPackage, error) {
 	if err != nil {
 		return nil, err
 	}
+	reader, err := gzip.NewReader(bytes.NewReader(decoded))
+	if err != nil {
+		return nil, err
+	}
+	decoded, err = io.ReadAll(reader)
+	if err = errors.Join(err, reader.Close()); err != nil {
+		return nil, err
+	}
 	err = json.Unmarshal(decoded, &deployedPackage)
 	if err != nil {
 		return nil, err
```

#### Recent Merged Pull Requests:
- **PR #5625** (closed): fix: exclude state authoritative values (@brandtkeller)
- **PR #5621** (2026-11-08): feat!: error when package secret write fails (@AustinAbro321)
- **PR #5620** (2026-11-07): chore(deps): update github.com/andybalholm/brotli from v1.2.0 to v1.2.8 (@dwertent)
- **PR #5619** (2026-11-08): feat!: compress Zarf state (@AustinAbro321)
- **PR #5613** (2026-11-06): feat!: removed deprecated k8s api migration (@AustinAbro321)
- **PR #5611** (2026-11-05): chore(deps): bump the k8s group across 1 directory with 6 updates (@dependabot[bot])

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

## X. feat!: error when package secret write fails (#5621)

**RULE**:
When implementing operations in `src/pkg/cluster/zarf.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zarf-dev/zarf. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b17ad042`: feat!: error when package secret write fails (#5621). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/pkg/cluster/zarf.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// ValidateDeployedPackageSecretSize returns an error if the compressed deployment record
// exceeds Kubernetes' Secret data limit. It does not access the cluster.
func ValidateDeployedPackageSecretSize(depPkg state.DeployedPackage) error {
	_, err := encodeDeployedPackage(depPkg)
	return err
}

	if buf.Len() > corev1.MaxSecretSize {
		return nil, fmt.Errorf("package %q compressed deployment metadata is %d bytes, exceeding Kubernetes' %d-byte Secret data limit; reduce the package definition size or deployment overrides", depPkg.Name, buf.Len(), corev1.MaxSecretSize)
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b17ad042` are properly handled with clean fallback behavior.
