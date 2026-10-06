# Forensic Learning Record (Deep Inspection): zarf-dev/zarf

> **Canonical Artifact**: `07_PROJECT_LEARNING/zarf-dev-zarf-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zarf-dev/zarf](https://github.com/zarf-dev/zarf))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:21:50.934Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zarf-dev/zarf`
- **Description**: The Airgap Native Package Manager for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2062 stars

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

### Core Architecture Module: `src/internal/agent/operations/hook.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package operations provides functions for the mutating webhook.
package operations

import (
	"context"
	"fmt"

	"github.com/zarf-dev/zarf/src/config/lang"
	admission "k8s.io/api/admission/v1"
)

// Result contains the result of an admission request.
type Result struct {
	Allowed  bool
	Msg      string
	PatchOps []PatchOperation
}

// AdmitFunc defines how to process an admission request.
type AdmitFunc func(ctx context.Context, request *admission.AdmissionRequest) (*Result, error)

// Hook represents the set of functions for each operation in an admission webhook.
type Hook struct {
	Create  AdmitFunc
	Delete  AdmitFunc
	Update  AdmitFunc
	Connect AdmitFunc
}

// Execute evaluates the request and try to execute the function for operation specified in the request.
func (h *Hook) Execute(ctx context.Context, r *admission.AdmissionRequest) (*Result, error) {
	switch r.Operation {
	case admission.Create:
		return wrapperExecution(ctx, h.Create, r)
	case admission.Update:
		return wrapperExecution(ctx, h.Update, r)
	case admission.Delete:
		return wrapperExecution(ctx, h.Delete, r)
	case admission.Connect:
		return wrapperExecution(ctx, h.Connect, r)
	}

	return &Result{Msg: fmt.Sprintf(lang.AgentErrInvalidOp, r.Operation)}, nil
}

// If the mutatingwebhook calls for an operation with no bound function--go tell on them.
func wrapperExecution(ctx context.Context, fn AdmitFunc, r *admission.AdmissionRequest) (*Result, error) {
	if fn == nil {
		return nil, fmt.Errorf(lang.AgentErrInvalidOp, r.Operation)
	}
	return fn(ctx, r)
}

```

### Core Architecture Module: `src/internal/packager/helm/post-render.go`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2021-Present The Zarf Authors

// Package helm contains operations for working with helm charts.
package helm

import (
	"bytes"
	"context"
	"fmt"
	"slices"

	"github.com/zarf-dev/zarf/src/pkg/state"

	"github.com/zarf-dev/zarf/src/api"
	"github.com/zarf-dev/zarf/src/config"
	"github.com/zarf-dev/zarf/src/pkg/cluster"
	"github.com/zarf-dev/zarf/src/pkg/logger"
	"github.com/zarf-dev/zarf/src/pkg/variables"
	"helm.sh/helm/v4/pkg/action"
	releaseutil "helm.sh/helm/v4/pkg/release/v1/util"
	"sigs.k8s.io/yaml"

	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type renderer struct {
	chart api.Chart

	takeOwnership   bool
	cluster         *cluster.Cluster
	connectedDeploy bool
	state           *state.State
	actionConfig    *action.Configuration
	variableConfig  *variables.VariableConfig

	connectStrings    state.ConnectStrings
	namespaces        map[string]*corev1.Namespace
	pkgName           string
	namespaceOverride string
}

func newRenderer(ctx context.Context, chart api.Chart, takeOwnership bool, c *cluster.Cluster, connectedDeploy bool, s *state.State, actionConfig *action.Configuration, variableConfig *variables.VariableConfig, pkgName string, namespaceOverride string) (*renderer, error) {
	if actionConfig == nil {
		return nil, fmt.Errorf("action configuration required to run post renderer")
	}
	if variableConfig == nil {
		return nil, fmt.Errorf("variable configuration required to run post renderer")
	}
	if pkgName == "" {
		return nil, fmt.Errorf("package name required to run post renderer")
	}
	// Update secrets when not in connected mode, as connected packages in hybrid / air-gap clusters could rely on pulling from the registry with ###ZARF_REGISTRY###
	rend := &renderer{
		chart:             chart,
		takeOwnership:     takeOwnership,
		cluster:           c,
		connectedDeploy:   connectedDeploy,
		state:             s,
		actionConfig:      actionConfig,
		variableConfig:    variableConfig,
		connectStrings:    state.ConnectStrings{},
		namespaces:        map[string]*corev1.Namespace{},
		pkgName:           pkgName,
		namespaceOverride: namespaceOverride,
	}

	namespace, err := rend.cluster.Clientset.CoreV1().Namespaces().Get(ctx, rend.chart.Namespace, metav1.GetOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return nil, fmt.Errorf("unable to check for existing namespace %q in cluster: %w", rend.chart.Namespace, err)
	}
	if kerrors.IsNotFound(err) {
		rend.namespaces[rend.chart.Namespace] = cluster.NewZarfManagedNamespace(rend.chart.Namespace)
	} else if rend.takeOwnership {
		delete(namespace.Labels, cluster.AgentLabel)
		namespace.Labels = cluster.AdoptZarfManagedLabels(namespace.Labels)
		rend.namespaces[rend.chart.Namespace] = namespace
	}

	return rend, nil
}

// Run satisfies the Helm post-renderer interface. It templates the Zarf variables, finds connect strings, adopts namespaces, and applies Zarf state secrets
func (r *renderer) Run(renderedManifests *bytes.Buffer) (*bytes.Buffer, error) {
	// This is very low cost and consistent for how we replace elsewhere, also good for debugging
	hooks, resources, err := getTemplatedManifests(renderedManifests, r.variableConfig, r.actionConfig)
	if err != nil {
		return nil, err
	}
	finalManifestsOutput := bytes.NewBuffer(nil)
	ctx := context.Background()

	for _, hook := range hooks {
		fmt.Fprintf(finalManifestsOutput, "---\n# Source: %s\n%s\n", hook.Path, hook.Manifest)
	}

	if err := r.editHelmResources(ctx, resources, finalManifestsOutput); err != nil {
		return nil, err
	}
	if err := r.adoptAndUpdateNamespaces(ctx); err != nil {
		return nil, err
	}
	// Send the bytes back to helm
	return finalManifestsOutput, nil
}

func (r *renderer) adoptAndUpdateNamespaces(ctx context.Context) error {
	l := logger.From(ctx)
	c := r.cluster
	namespaceList, err := r.cluster.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return err
	}
	for name, namespace := range r.namespaces {
		// Check to see if this namespace already exists
		var existingNamespace bool
		for _, serverNamespace := range namespaceList.Items {
			if serverNamespace.Name == name {
				existingNamespace = true
				break
			}
		}
		// If the namespace doesn't exist then create it. If it does exist and is already managed by Zarf then update the labels with
		// the new package and namespace override labels.
		if !existingNamespace {
			// This is a new namespace, add it
			_, err := c.Clientset.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
			if err != nil {
				return fmt.Errorf("unable to create the missing namespace %s", name)
			}
		} else if r.takeOwnership {
			// Refuse to adopt namespace if it is one of four initial Kubernetes namespaces.
			// https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/#initial-namespaces
			if slices.Contains([]string{"default", "kube-node-lease", "kube-public", "kube-system"}, name) {
				l.Warn("refusing to adopt initial namespace", "name", name)
			} else {
				// This is an existing namespace to adopt
				_, err := c.Clientset.CoreV1().Namespaces().Update(ctx, namespace, metav1.UpdateOptions{})
				if err != nil {
					return fmt.Errorf("unable to adopt the existing namespace %s", name)
				}
			}
		}

		if r.state.RegistryInfo.IsConfigured() {
			validRegistrySecret, err := c.GenerateRegistryPullCreds(ctx, name, config.ZarfImagePullSecretName, r.state.RegistryInfo)
			if err != nil {
				return err
			}
			_, err = c.Clientset.CoreV1().Secrets(*validRegistrySecret.Namespace).Apply(ctx, validRegistrySecret, metav1.ApplyOptions{Force: true, FieldManager: cluster.FieldManagerName})
			if err != nil {
				return fmt.Errorf("problem applying registry secret for the %s namespace: %w", name, err)
			}
			if r.state.RegistryInfo.ShouldUseMTLS() {
				clientPKI, err := c.GetRegistryClientMTLSCert(ctx)
				if err != nil {
					return fmt.Errorf("failed to get registry client certs: %w", err)
				}
				if err := c.ApplyRegistryClientCertSecret(ctx, clientPKI, name); err != nil {
					return fmt.Errorf("failed to apply registry client secret to ns: %s: %w", name, err)
				}
			}
		}
		if r.state.GitServer.IsConfigured() {
			gitServerSecret := c.GenerateGitPullCreds(name, config.ZarfGitServerSecretName, r.state.GitServer)
			_, err = c.Clientset.CoreV1().Secrets(*gitServerSecret.Namespace).Apply(ctx, gitServerSecret, metav1.ApplyOptions{Force: true, FieldManager: cluster.FieldManagerName})
			if err != nil {
				return fmt.Errorf("problem applying git server secret for the %s namespace: %w", name, err)
			}
		}
	}
	return nil
}

func (r *renderer) shouldAddAgentIgnoreLabels() bool {
	return r.connectedDeploy && r.state != nil && r.state.AgentInfo.IsConfigured()
}

func (r *renderer) editHelmResources(ctx context.Context, resources []releaseutil.Manifest, finalManifestsOutput *bytes.Buffer) error {
	l := logger.From(ctx)
	resources, err := flattenHelmResources(resources)
	if err != nil {
		return err
	}
	for _, resource := range resources {
		// parse to unstructured to have access to more data than just the name
		newContent, rawData, err := processManifestContent(resource.Content, func(obj *unstructured.Unstructured) error {
			// Add the package label to all resources
			labels := obj.GetLabels()
			if labels == nil {
				labels = map[string]string{}
			}
			obj.SetLabels(r.setPackageLabels(labels))
			// Add the package label to the pod template of anything that has one
			if err := r.addPodTemplateLabels(obj); err != nil {
				return fmt.Errorf("failed to add labels to pod template: %w", err)
			}
			// In connected or YOLO mode, add agent ignore labels so the webhook doesn't mutate resources
			if r.shouldAddAgentIgnoreLabels() {
				if err := addAgentIgnoreLabels(obj); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return err
		}
		resource.Content = newContent

		// If the object is empty, it's a blank resource, so we skip it.
		if len(rawData.Object) == 0 {
			continue
		}

		switch rawData.GetKind() {
		case "Namespace":
			namespace := &corev1.Namespace{}
			// parse the namespace resource so it can be applied out-of-band by zarf instead of helm to avoid helm ns shenanigans
			if err := runtime.DefaultUnstructuredConverter.FromUnstructured(rawData.UnstructuredContent(), namespace); err != nil {
				l.Warn("failed to parse namespace", "name", rawData.GetName(), "error", err)
			} else {
				l.Debug("matched helm namespace for zarf annotation", "name", namespace.Name)
				namespace.Labels = cluster.AdoptZarfManagedLabels(namespace.Labels)
				// Add it to the stack
				r.namespaces[namespace.Name] = namespace
			}
			// skip so we can strip namespaces from helm's brain
			continue

		case "Service":
			// Check service resources for the zarf-connect label
			labels := rawData.GetLabels()
			if labels == nil {
				labels = map[string]string{}
			}
			annotations := rawData.GetAnnotations()
			if annotations == nil {
				annotations = map[string]string{}
			}
			if key, keyExists := labels[cluster.ZarfConnectLabelName]; keyExists {
				// If there is a zarf-connect label
				l.Debug("match helm service for zarf connection", "service", rawData.GetName(), "connectionKey", key)

				// Add the connectString for processing later in the deployment
				r.connectStrings[key] = state.ConnectString{
					Description: annotations[cluster.ZarfConnectAnnotationDescription],
					URL:         annotations[cluster.ZarfConnectAnnotationURL],
				}
			}
		}

		namespace := rawData.GetNamespace()
		if _, exists := r.namespaces[namespace]; !exists && namespace != "" {
			// if this is the first time seeing this ns, we need to track that to create it as well
			r.namespaces[namespace] = cluster.New
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5435** (2026-10-04): **chore(deps): bump the codeql group with 3 updates**
  *Symptoms*: Bumps the codeql group with 3 updates: [github/codeql-action/upload-sarif](https://github.com/github/codeql-action), [github/codeql-action/init](https://github.com/github/codeql-action) and [github/codeql-action/analyze](https://github.com/github/codeql-action).  Updates `github/codeql-action/upload-sarif` from 4.38.1 to 4.38.2 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/upload-sarif's releases</a>.</em></p> <blockquote> <h2>v4.38.2</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.1">2.27.1</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4160">#4160</a></li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action/upload-sarif's changelog</a>.</em></p> <blockquote> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>[UNRELEASED]</h2> <p>No user facing changes.</p> <h2>4.38.2 - 24 Sept 2026</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.1">2.27.1</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4160">#4160<
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* canceled.   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 349be22a035f0f9ebc79ad86dafc7ee72b6abb4b | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6ac1a216d477120008e928ec |

- **Issue #5434** (2026-10-04): **chore(deps): bump devalue from 5.8.1 to 5.9.4 in /site**
  *Symptoms*: Bumps [devalue](https://github.com/sveltejs/devalue) from 5.8.1 to 5.9.4. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/sveltejs/devalue/releases">devalue's releases</a>.</em></p> <blockquote> <h2>v5.9.4</h2> <h3>Patch Changes</h3> <ul> <li>067b125: perf: annotate module-level <code>Object.freeze</code> calls as pure so unused operation tables tree-shake</li> </ul> <h2>v5.9.3</h2> <h3>Patch Changes</h3> <ul> <li>6861dbb: fix: avoid scanning sparse array holes in <code>uneval</code> traversal and shared-array population</li> <li>9ec5130: fix: reject non-string null-prototype object keys in <code>parse</code> and <code>unflatten</code> to prevent bypassing the <code>__proto__</code> check</li> <li>dae8153: fix: prevent unhandled internal rejections in <code>stringifyAsync</code> when serializing multiple promises</li> <li>84f6f67: fix: prevent quadratic <code>uneval</code> output expansion for repeated strings and bigints</li> <li>6861dbb: fix: avoid eager allocation when evaluating sparse arrays emitted by <code>uneval</code></li> <li>8f8d78e: fix: validate revived backing buffers before constructing typed arrays</li> <li>46dc877: fix: serialize only the visible bytes of Node Buffers in <code>stringify</code>, <code>stringifyAsync</code> and <code>uneval</code>, preventing disclosure of unrelated data from their shared allocation pool</li> </ul> <h2>v5.9.2</h2> <h3>Patch Changes</h3> <ul> <li>8b2a456: fix: reject out-of-bounds indic
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | c7a2ee53649a912b78582ae03065fa70cb457675 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6ac0e67cd477120008a8f7e4 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5434--zarf-docs.netlify.app](https://deploy-preview-5434--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MzQtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.jbt224ZwSNXpzTewOf1ejZu7wK_yPo9sTMH6-ex3iEw)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5434--zarf-docs.netlify.app) --> _To e

- **Issue #5420** (2026-09-29): **chore(deps-dev): bump undici from 7.29.0 to 7.30.0 in /site**
  *Symptoms*: Bumps [undici](https://github.com/nodejs/undici) from 7.29.0 to 7.30.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/nodejs/undici/releases">undici's releases</a>.</em></p> <blockquote> <h2>v7.30.0</h2> <h2>What's Changed</h2> <ul> <li>[Backport v7.x] fix: selectively re-enable SIMD for ppc64 by <a href="https://github.com/github-actions"><code>@​github-actions</code></a>[bot] in <a href="https://redirect.github.com/nodejs/undici/pull/5794">nodejs/undici#5794</a></li> <li>Backport upgrade diagnostics lifecycle fixes to v7.x by <a href="https://github.com/BridgeAR"><code>@​BridgeAR</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5783">nodejs/undici#5783</a></li> <li>[Backport v7.x] fix: honor backpressure in decompression interceptor by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5837">nodejs/undici#5837</a></li> <li>fix: close rejected HTTP/2 WebSocket streams on v7.x by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5876">nodejs/undici#5876</a></li> <li>test(fetch): make pull-dont-push exceed any socket buffer by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5889">nodejs/undici#5889</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/nodejs/undici/
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | ba6d10d581fcd4e6ec66800d37851f2c9f1a4ccb | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc1b76cd98de000825377f | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5420--zarf-docs.netlify.app](https://deploy-preview-5420--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MjAtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.kf3FkpUD5wSSl_FvY2bneUTXjeLFEnGgULwfM0on5Fw)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5420--zarf-docs.netlify.app) --> _To e

- **Issue #5419** (2026-10-04): **chore(deps): bump markdown-it and markdownlint-cli2 in /site**
  *Symptoms*: Bumps [markdown-it](https://github.com/markdown-it/markdown-it) to 15.0.1 and updates ancestor dependency [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2). These dependencies need to be updated together.  Updates `markdown-it` from 14.3.0 to 15.0.1 <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/markdown-it/markdown-it/blob/master/CHANGELOG.md">markdown-it's changelog</a>.</em></p> <blockquote> <h2>[15.0.1] - 2026-08-27</h2> <h3>Changed</h3> <ul> <li>doc: replace oxide theme with custom one.</li> </ul> <h3>Fixed</h3> <ul> <li>Fixed code span parsing after lookaheads for unclosed link and image labels, <a href="https://redirect.github.com/markdown-it/markdown-it/issues/1201">#1201</a>.</li> <li>Preserve spaces in code spans whose content consists only of spaces, <a href="https://redirect.github.com/markdown-it/markdown-it/issues/1180">#1180</a>.</li> <li>Preserve brackets around IPv6 address literals when normalizing links, <a href="https://redirect.github.com/markdown-it/markdown-it/issues/1204">#1204</a>.</li> </ul> <h3>Security</h3> <ul> <li>Fixed quadratic complexity when replacing fuzzy links.</li> <li>Fixed quadratic complexity in scheme backscan (inline linkify rule).</li> </ul> <h2>[15.0.0] - 2026-07-30</h2> <h3>Added</h3> <ul> <li>Exposed parser internals classes as static properties on <code>markdownit</code>.</li> <li>Bundled TypeScript declarations. Remove <code>@types/markdown-it</code> if you used it.</li
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 0665684a5708fc55a4fd13fdc5cd18f363f1f169 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc2f0ab6fb650008d6e65a | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5419--zarf-docs.netlify.app](https://deploy-preview-5419--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MTktLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.7sYWPViHUFSx8dB6PcF2uPa6YgWRaqZOkmRMrekAGTA)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5419--zarf-docs.netlify.app) --> _To e

- **Issue #5418** (2026-10-02): **feat(get-creds): only print credentials for configured services**
  *Symptoms*: ## Description  I noticed a stale TODO that's simple to implement now. We print the credentials when the service is configured.   I also now have us print registry credentials even when the service is not internal. I think this makes sense. My guess would be that this wasn't done before because we used to print credentials after every init, but now it is something explicitly asked for.  ## Checklist before merging  - [ ] Test, docs, adr added or updated as needed - [ ] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* canceled.   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | bfb7f9044d18624e6f99754e5ed98eea42153926 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc11ca4fce2f00079e1a63 |
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5418?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :white_check_mark: All modified and coverable lines are covered by tests.  | [Files with missing lines](https://app.codecov.io/gh/zarf-dev/zarf/pull/5418?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) | Coverage Δ | | |---|---|---| | [src/cmd/zarf\_tools.go](https://app.codecov.io/gh/zarf-dev/zarf/pull/5418?src=pr&el=tree&filepath=src%2Fcmd%2Fzarf_tools.go&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev#diff-c3JjL2NtZC96YXJmX3Rvb2xzLmdv) | `39.95% <100.00%> (+4.80%)` | :arrow_up: |  ... and [1 file with indirect coverage changes](https://app.codecov.io/gh/zarf-dev/zarf/pull/5418/indirect-changes?src=pr&el=tree-more&utm_medium=referral&utm_source=gi
  > @brandtkeller that makes sense to me. The command already has a `--output-format` flag, however it has no effect when specific credentials are requested. We could easily have it print in a json and yaml format with the username

- **Issue #5417** (2026-09-29): **feat!: disable artifact server by default**
  *Symptoms*: ## Description  Turns the artifact server off by default unless the feature flag `--features=artifact-server=true` is on  ## Related Issue  Relates to #5005   ## Checklist before merging  - [ ] Test, docs, adr added or updated as needed - [ ] [Contributor Guide Steps](https://github.com/zarf-dev/zarf/blob/main/CONTRIBUTING.md#developer-workflow) followed 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* canceled.   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 7e2d5314837e0c56ae6b5bb2d453beb3864cccc7 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc0fd45dfc3e00086d6a04 |
  > ## [Codecov](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) Report :x: Patch coverage is `70.00000%` with `3 lines` in your changes missing coverage. Please review.  | [Files with missing lines](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev) | Patch % | Lines | |---|---|---| | [src/pkg/packager/deploy.go](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?src=pr&el=tree&filepath=src%2Fpkg%2Fpackager%2Fdeploy.go&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zarf-dev#diff-c3JjL3BrZy9wYWNrYWdlci9kZXBsb3kuZ28=) | 0.00% | [2 Missing and 1 partial :warning: ](https://app.codecov.io/gh/zarf-dev/zarf/pull/5417?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=commen

- **Issue #5416** (2026-09-30): **Inspect one component’s Helm values before building a package**
  *Symptoms*: ### Is your feature request related to a problem? Please describe.  I use `zarf dev inspect values-files` to check Helm values while developing a package, before building it. My package has two components that use the same upstream Helm chart. The command prints values for both components, but labels each document only with the chart name, so the output does not clearly identify which values belong to which component.  `zarf package inspect values-files` supports component selection, but using it requires building the package first.  ### Describe the behavior you'd like  - **Given** a source package definition with multiple components using the same chart - **When** I run `zarf dev inspect values-files --components=<component-name>` - **Then** I see the values for charts in that component only, without building a package  The option should use the same component selection syntax as `zarf package inspect values-files`.  ### Describe alternatives you've considered  I can build the package and use `zarf package inspect values-files --components`, but that adds a build step to each values check. Reading the unfiltered dev output is ambiguous when both components use the same chart name.  ### Additional context  Addressed by PR #5413. 

- **Issue #5414** (2026-10-04): **chore(deps): bump js-yaml and markdownlint-cli2 in /site**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) to 5.4.1 and updates ancestor dependency [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2). These dependencies need to be updated together.  Updates `js-yaml` from 5.2.2 to 5.4.1 <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>[5.4.1] - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> <h2>[5.4.0] - 2026-08-25</h2> <h3>Added</h3> <ul> <li>Added the <code>scalarStyleRules</code> dumper option to customize string formatting. See <a href="https://github.com/nodeca/js-yaml/blob/master/docs/scalar_styling.md">Scalar styling</a> for details.</li> </ul> <h3>Changed</h3> <ul> <li>[breaking] Flattened the low-level AST node style representation. Scalar and collection nodes now use <code>SCALAR_STYLE</code> and <code>COLLECTION_STYLE</code> values; explicit tags use the separate <code>tagged</code> property. Alias nodes now contain only <code>kind</code> and <code>anchor</code>. This only affects code that directly constructs or edits AST nodes.</li> <li>[breaking] The <code>sortKeys</code> option was rewritten using AST mutation to avoid si
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *zarf-docs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 08dfb2968286c8e71fd2c095361cd23454986d8a | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/zarf-docs/deploys/6abc04b3dd1c9a00088de3a9 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5414--zarf-docs.netlify.app](https://deploy-preview-5414--zarf-docs.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU0MTQtLXphcmYtZG9jcy5uZXRsaWZ5LmFwcCJ9.vwxYtW6sM27ukeyRC8PWC-0_zmFhFVXEU8BniFy33pc)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [zarf-docs Preview](https://deploy-preview-5414--zarf-docs.netlify.app) --> _To e
  > Looks like these dependencies are up-to-date now, so this is no longer needed.

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

### Incident Patch 1: `9213afdc` (2026-09-30)
**Commit Message**: fix(values): preserve inferred types across null overlays (#5412)

Signed-off-by: Gabe Scarberry <[REDACTED_EMAIL]>

**File**: `src/cmd/dev.go` (modified, +66/-37)
```diff
@@ -94,12 +94,6 @@ type devGenerateSchemaOptions struct {
 	deleteNotFound bool
 }
 
-type mappedChartSchema struct {
-	sourcePath  value.Path
-	schema      map[string]any
-	excludePath []value.Path
-}
-
 func newDevGenerateSchemaCommand(v *viper.Viper) *cobra.Command {
 	o := &devGenerateSchemaOptions{}
 
@@ -156,12 +150,13 @@ func (o *devGenerateSchemaOptions) run(ctx context.Context, args []string) error
 	}()
 	pkg := loaded.Definition
 
-	// Step 1: Merge default values.files to create initial set of default Zarf values
-	zarfValues := loaded.Values.DeepCopy()
+	// Step 1: Copy package defaults
+	packageValues := loaded.Values.DeepCopy()
 
-	var mappedSchemas []mappedChartSchema
+	var mappedSchemas []map[string]any
+	var mappedInferredSchemas []map[string]any
 
-	// Step 2: Discover source target mappings and load defaults from chart values where Zarf Value defaults aren't specified
+	// Step 2: Collect chart value schemas
 	tmpDir, err := utils.MakeTempDir(config.CommonOptions.TempDirectory)
 	if err != nil {
 		return err
@@ -190,6 +185,11 @@ func (o *devGenerateSchemaOptions) run(ctx context.Context, args []string) error
 			}
 
 			appliedValues := helpers.MergeMapRecursive(helmChart.Values, valuesFilesValues)
+			inferredSchema := value.GenerateJSONSchema(value.Values(helmChart.Values))
+			valuesFilesSchema := value.GenerateJSONSchema(value.Values(valuesFilesValues))
+			if err := value.MergeJSONSchemaAtPath(inferredSchema, value.Path("."), valuesFilesSchema); err != nil {
+				return fmt.Errorf("unable to apply valuesFiles for chart %q: %w", chart.Name, err)
+			}
 			var chartSchema map[string]any
 			if len(helmChart.Schema) > 0 {
 				if err := json.Unmarshal(helmChart.Schema, &chartSchema); err != nil {
@@ -206,18 +206,30 @@ func (o *devGenerateSchemaOptions) run(ctx context.Context, args []string) error
 				}
 			}
 
-			// Map ChartValues' Source to Target and merge into zarfValues if not already present
+			// Map chart schemas from target paths to package value source paths.
 			for _, cv := range chart.Values {
 				if cv.SourcePath == "" || cv.TargetPath == "" {
 					return fmt.Errorf("chart %q value mapping has empty sourcePath or targetPath", chart.Name)
 				}
-				val, err := value.Values(appliedValues).Extract(value.Path(cv.TargetPath))
+				mappedValue, err := value.Values(appliedValues).Extract(value.Path(cv.TargetPath))
 				if err != nil {
 					return fmt.Errorf("unable to extract chart %q value at targetPath %q: %w", chart.Name, cv.TargetPath, err)
 				}
-
-				if err := zarfValues.Set(value.Path(cv.SourcePath), val); err != nil {
-					return fmt.Errorf("unable to set chart %q value at sourcePath %q: %w", chart.Name, cv.SourcePath, err)
+				targetInferredSchema, found, err := value.ExtractJSONSchema(inferredSchema, value.Path(cv.TargetPath))
+				if err != nil {
+					return fmt.Errorf("unable to inspect chart %q values at targetPath %q: %w", chart.Name, cv.TargetPath, err)
+				}
+				if found {
+					mappedValues := value.Values{}
+					if err := mappedValues.Set(value.Path(cv.SourcePath), mappedValue); err != nil {
+						return fmt.Errorf("unable to set chart %q value at sourcePath %q: %w", chart.Name, cv.SourcePath, err)
+					}
+					mappedSchema := value.GenerateJSONSchema(mappedValues)
+					mappedSchema, err = mapSchemaToSource(mappedSchema, targetInferredSchema, value.Path(cv.SourcePath), cv.ExcludePaths)
+					if err != nil {
+						return fmt.Errorf("unable to map inferred schema for chart %q: %w", chart.Name, err)
+					}
+					mappedInferredSchemas = append(mappedInferredSchemas, mappedSchema)
 				}
 
 				if chartSchema != nil {
@@ -226,38 +238,33 @@ func (o *devGenerateSchemaOptions) run(ctx context.Context, args []string) error
 						return fmt.Errorf("unable to inspect chart %q schema at targetPath %q: %w", chart.Name, cv.TargetPath, err)
 					}
 					if found {
-						excludes := make([]value.Path, len(cv.ExcludePaths))
-						for i, excludePath := range cv.ExcludePaths {
-							excludes[i] = value.Path(excludePath)
+						mappedSchema, err := mapSchemaToSource(nil, targetSchema, value.Path(cv.SourcePath), cv.ExcludePaths)
+						if err != nil {
+							return fmt.Errorf("unable to map Helm schema for chart %q: %w", chart.Name, err)
 						}
-						mappedSchemas = append(mappedSchemas, mappedChartSchema{
-							sourcePath:  value.Path(cv.SourcePath),
-							schema:      targetSchema,
-							excludePath: excludes,
-						})
+						mappedSchemas = append(mappedSchemas, mappedSchema)
 					} else {
 						l.Warn("chart values schema does not define mapped target; falling back to inferred types", "chart", chart.Name, "targetPath", cv.TargetPath)
 					}
 				}
-				for _, excludePath := range cv.ExcludePaths {
-					if err := zarfValues.Delete(value.Path(excludePath)); err != nil {
-						return fmt.Errorf("unable to exclude path %q from schema for chart %q: %w", excludePath, chart.Name, err)
-					}
-				}
 			}
 		}
 	}
 
-	// Step 3: Generate JS
```

**File**: `src/pkg/value/generate.go` (modified, +17/-11)
```diff
@@ -106,15 +106,22 @@ func ExtractJSONSchema(schema map[string]any, path Path) (map[string]any, bool,
 	return current, true, nil
 }
 
-// MergeJSONSchemaAtPath overlays a chart schema at a JSON value path. Chart
-// fields are copied into the inferred schema; authored package schemas are
-// reconciled later and take precedence over conflicting fields.
+// MergeJSONSchemaAtPath overlays supported fields at a JSON value path.
 func MergeJSONSchemaAtPath(schema map[string]any, path Path, overlay map[string]any) error {
+	return mergeJSONSchemaAtPath(schema, path, FilterChartSchema(overlay))
+}
+
+// MergeGeneratedJSONSchemaAtPath overlays an inferred schema without filtering unknown properties.
+func MergeGeneratedJSONSchemaAtPath(schema map[string]any, path Path, overlay map[string]any) error {
+	return mergeJSONSchemaAtPath(schema, path, overlay)
+}
+
+func mergeJSONSchemaAtPath(schema map[string]any, path Path, overlay map[string]any) error {
 	if err := path.Validate(); err != nil {
 		return err
 	}
 	if path == "." {
-		mergeChartSchema(schema, overlay)
+		mergeJSONSchema(schema, overlay)
 		return nil
 	}
 
@@ -126,7 +133,7 @@ func MergeJSONSchemaAtPath(schema map[string]any, path Path, overlay map[string]
 			return fmt.Errorf("schema path %s: key %q is not an object schema", path, part)
 		}
 		if i == len(parts)-1 {
-			mergeChartSchema(child, overlay)
+			mergeJSONSchema(child, overlay)
 			return nil
 		}
 		current = child
@@ -180,8 +187,8 @@ func schemaChild(schema map[string]any, part string) (map[string]any, bool) {
 	return nil, false
 }
 
-func mergeChartSchema(destination, source map[string]any) {
-	for key, sourceValue := range FilterChartSchema(source) {
+func mergeJSONSchema(destination, source map[string]any) {
+	for key, sourceValue := range source {
 		switch key {
 		case "properties":
 			sourceProperties, ok := sourceValue.(map[string]any)
@@ -198,7 +205,7 @@ func mergeChartSchema(destination, source map[string]any) {
 				sourcePropertyMap, sourceIsMap := sourceProperty.(map[string]any)
 				destinationPropertyMap, destinationIsMap := destinationProperties[propertyName].(map[string]any)
 				if sourceIsMap && destinationIsMap {
-					mergeChartSchema(destinationPropertyMap, sourcePropertyMap)
+					mergeJSONSchema(destinationPropertyMap, sourcePropertyMap)
 				} else {
 					destinationProperties[propertyName] = copyValue(sourceProperty)
 				}
@@ -207,13 +214,12 @@ func mergeChartSchema(destination, source map[string]any) {
 			sourceMap, sourceIsMap := sourceValue.(map[string]any)
 			destinationMap, destinationIsMap := destination[key].(map[string]any)
 			if sourceIsMap && destinationIsMap {
-				mergeChartSchema(destinationMap, sourceMap)
+				mergeJSONSchema(destinationMap, sourceMap)
 			} else {
 				destination[key] = copyValue(sourceValue)
 			}
 		default:
-			// Validation keywords are chart-owned at this stage and should be
-			// retained when they describe values supplied by the package.
+			// Preserve validation keywords from the overlay.
 			destination[key] = copyValue(sourceValue)
 		}
 	}
```

**File**: `src/pkg/value/generate_test.go` (modified, +20/-6)
```diff
@@ -163,11 +163,12 @@ func TestMergeJSONSchemaAtPathPreservesNullableObjects(t *testing.T) {
 		},
 	})
 
-	err := MergeJSONSchemaAtPath(schema, Path(".serviceAccount.server.annotations"), map[string]any{
+	overlay := map[string]any{
 		"type":       []any{"object", "null"},
 		"properties": map[string]any{},
 		"required":   []any{"not-imported"},
-	})
+	}
+	err := MergeJSONSchemaAtPath(schema, Path(".serviceAccount.server.annotations"), overlay)
 	require.NoError(t, err)
 
 	annotations, found, err := ExtractJSONSchema(schema, Path(".serviceAccount.server.annotations"))
@@ -288,11 +289,12 @@ func TestMergeJSONSchemaAtPathCopiesValidationFields(t *testing.T) {
 	assert.InDelta(t, float64(1), ports["minItems"], 0)
 	assert.InDelta(t, float64(3), ports["maxItems"], 0)
 
-	err = MergeJSONSchemaAtPath(schema, Path(".config"), map[string]any{
+	overlay := map[string]any{
 		"minProperties": float64(1),
 		"required":      []any{"database"},
 		"allOf":         []any{map[string]any{"const": "postgres"}},
-	})
+	}
+	err = MergeJSONSchemaAtPath(schema, Path(".config"), overlay)
 	require.NoError(t, err)
 	config, found, err := ExtractJSONSchema(schema, Path(".config"))
 	require.NoError(t, err)
@@ -309,7 +311,7 @@ func TestMergeJSONSchemaAtPathKeepsInferredFieldWhenChartRefIsDropped(t *testing
 		},
 	})
 
-	err := MergeJSONSchemaAtPath(schema, Path("."), map[string]any{
+	overlay := map[string]any{
 		"type":                 "object",
 		"additionalProperties": false,
 		"properties": map[string]any{
@@ -322,7 +324,8 @@ func TestMergeJSONSchemaAtPathKeepsInferredFieldWhenChartRefIsDropped(t *testing
 				"$ref": "schemas/external.json",
 			},
 		},
-	})
+	}
+	err := MergeJSONSchemaAtPath(schema, Path("."), overlay)
 	require.NoError(t, err)
 
 	properties, ok := schema["properties"].(map[string]any)
@@ -335,6 +338,17 @@ func TestMergeJSONSchemaAtPathKeepsInferredFieldWhenChartRefIsDropped(t *testing
 	assert.Equal(t, false, schema["additionalProperties"])
 }
 
+func TestMergeGeneratedJSONSchemaAtPathPreservesUnknownProperties(t *testing.T) {
+	schema := GenerateJSONSchema(Values{})
+	overlay := GenerateJSONSchema(Values{"credentials": nil})
+
+	require.NoError(t, MergeGeneratedJSONSchemaAtPath(schema, Path("."), overlay))
+
+	properties, ok := schema["properties"].(map[string]any)
+	require.True(t, ok)
+	require.Equal(t, map[string]any{}, properties["credentials"])
+}
+
 func TestFilterChartSchemaDropsUnsupportedChildSchemas(t *testing.T) {
 	filtered := FilterChartSchema(map[string]any{
 		"properties": map[string]any{
```

**File**: `src/test/e2e/14_zarf_package_generate_test.go` (modified, +42/-5)
```diff
@@ -71,7 +71,7 @@ func TestZarfDevGenerate(t *testing.T) {
 
 		aReplicas, ok := appProps["replicas"].(map[string]any)
 		require.True(t, ok)
-		require.Equal(t, "number", aReplicas["type"])
+		require.Equal(t, "integer", aReplicas["type"])
 		// .app.replicas should take the description from the parent values.schema.json
 		require.Equal(t, "Replica count", aReplicas["description"])
 
@@ -89,10 +89,42 @@ func TestZarfDevGenerate(t *testing.T) {
 
 		bReplicas, ok := backendProps["replicaCount"].(map[string]any)
 		require.True(t, ok)
-		require.Equal(t, "number", bReplicas["type"])
+		require.Equal(t, "integer", bReplicas["type"])
 		// .backend.replicas should take the description from the child values.schema.json
 		require.Equal(t, "Replica count", bReplicas["description"])
 
+		packageOverride, ok := backendProps["packageOverride"].(map[string]any)
+		require.True(t, ok)
+		require.Equal(t, "string", packageOverride["type"])
+
+		packageNull, ok := backendProps["packageNull"].(map[string]any)
+		require.True(t, ok)
+		require.Equal(t, "boolean", packageNull["type"])
+
+		valuesFileOverride, ok := backendProps["valuesFileOverride"].(map[string]any)
+		require.True(t, ok)
+		require.Equal(t, "string", valuesFileOverride["type"])
+
+		native, ok := backendProps["native"].(map[string]any)
+		require.True(t, ok)
+		require.Equal(t, map[string]any{
+			"type": "object",
+			"properties": map[string]any{
+				"object":  map[string]any{"type": "object"},
+				"array":   map[string]any{"type": "array"},
+				"boolean": map[string]any{"type": "boolean"},
+				"integer": map[string]any{"type": "number"},
+				"number":  map[string]any{"type": "number"},
+				"nullable": map[string]any{
+					"type": "object",
+					"properties": map[string]any{
+						"enabled": map[string]any{"type": "boolean"},
+					},
+				},
+				"overlayOnly": map[string]any{"type": "boolean"},
+			},
+		}, native)
+
 		// .backend.service.port should be pulled in from the child's mapped chart
 		bService, ok := backendProps["service"].(map[string]any)
 		require.True(t, ok)
@@ -131,9 +163,14 @@ func TestZarfDevGenerate(t *testing.T) {
 		require.NotContains(t, fallback, "type")
 		require.Equal(t, "Value without an inferred type", fallback["description"])
 
-		// .backend.image should be dropped because it is excluded from the chart mapping.
-		_, hasExcludedImage := backendProps["image"]
-		require.False(t, hasExcludedImage)
+		require.Equal(t, map[string]any{}, props["credentials"])
+
+		image, ok := backendProps["image"].(map[string]any)
+		require.True(t, ok)
+		imageProps, ok := image["properties"].(map[string]any)
+		require.True(t, ok)
+		require.Equal(t, map[string]any{"type": "string"}, imageProps["ref"])
+		require.NotContains(t, backendProps, "excludedOnly")
 
 		// .oldField should be dropped from the values.schema.json
 		_, hasOldField := props["oldField"]
```

**File**: `src/test/packages/14-generate-schema/chart/values.yaml` (modified, +14/-0)
```diff
@@ -5,8 +5,22 @@ service:
 image:
   ref: nginx:latest
 
+excludedOnly: true
+
 configMap:
   annotations:
   labels:
 
 fallback:
+
+native:
+  object: {}
+  array: []
+  boolean: true
+  integer: 1
+  number: 1.5
+  nullable:
+
+packageOverride: false
+packageNull: true
+valuesFileOverride: false
```

**File**: `src/test/packages/14-generate-schema/common/chart-values.yaml` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+native:
+  object:
+  array:
+  boolean:
+  integer:
+  number:
+  nullable:
+    enabled: true
+  overlayOnly: true
+
+valuesFileOverride: overlay
```

**File**: `src/test/packages/14-generate-schema/common/values.yaml` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
 backend:
   name: schema-app
   replicaCount: 2
+  packageOverride: package
+  packageNull:
```

**File**: `src/test/packages/14-generate-schema/common/zarf.yaml` (modified, +5/-0)
```diff
@@ -17,8 +17,13 @@ components:
         releaseName: backend-chart
         namespace: backend-test
         localPath: ../chart
+        valuesFiles:
+          - chart-values.yaml
         values:
           - sourcePath: ".backend"
             targetPath: "."
             excludePaths:
               - ".backend.image"
+              - ".backend.excludedOnly"
+          - sourcePath: ".backend.image"
+            targetPath: ".image"
```

---

### Incident Patch 2: `1653ca22` (2026-09-30)
**Commit Message**: fix!: remove images and repositories from package secret during connected deploys (#5402)

Signed-off-by: Austin Abro <[REDACTED_EMAIL]>

**File**: `src/cmd/crane.go` (modified, +3/-0)
```diff
@@ -387,6 +387,9 @@ func doPruneImagesForPackages(ctx context.Context, options []crane.Option, s *st
 	// Determine which image digests are currently used by Zarf packages
 	pkgImages := map[string]bool{}
 	for _, depPkg := range zarfPackages {
+		if depPkg.GetPackageConnectivity() == state.PackageConnectivityConnected {
+			continue
+		}
 		deployedComponents := map[string]bool{}
 		for _, depComponent := range depPkg.DeployedComponents {
 			deployedComponents[depComponent.Name] = true
```

**File**: `src/cmd/crane_test.go` (modified, +36/-0)
```diff
@@ -10,13 +10,49 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/google/go-containerregistry/pkg/crane"
 	"github.com/opencontainers/go-digest"
 	specs "github.com/opencontainers/image-spec/specs-go"
 	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
 	"github.com/stretchr/testify/require"
+	"github.com/zarf-dev/zarf/src/api/v1alpha1"
+	"github.com/zarf-dev/zarf/src/pkg/state"
 	"github.com/zarf-dev/zarf/src/test/testutil"
+	"oras.land/oras-go/v2/errdef"
 )
 
+func TestRegistryPruneSkipsConnectedDeploys(t *testing.T) {
+	ctx := testutil.TestContext(t)
+	address := testutil.SetupInMemoryRegistryDynamic(ctx, t)
+	options := []crane.Option{crane.Insecure}
+
+	keptDigest := testutil.PushImage(ctx, t, address+"/library/kept", "latest")
+	unusedDigest := testutil.PushImage(ctx, t, address+"/library/unused", "latest")
+
+	packages := []state.DeployedPackage{
+		{
+			PackageConnectivity: state.PackageConnectivityConnected,
+			Data: v1alpha1.ZarfPackage{Components: []v1alpha1.ZarfComponent{
+				{Name: "connected", Images: []string{"docker.io/library/connected:latest"}},
+			}},
+			DeployedComponents: []state.DeployedComponent{{Name: "connected"}},
+		},
+		{
+			Data: v1alpha1.ZarfPackage{Components: []v1alpha1.ZarfComponent{
+				{Name: "airgap", Images: []string{"docker.io/library/kept:latest"}},
+			}},
+			DeployedComponents: []state.DeployedComponent{{Name: "airgap"}},
+		},
+	}
+
+	require.NoError(t, doPruneImagesForPackages(ctx, options, &state.State{}, packages, address, true, false))
+	kept, err := testutil.NewRepo(t, address+"/library/kept").Resolve(ctx, "latest")
+	require.NoError(t, err)
+	require.Equal(t, keptDigest, kept.Digest.String())
+	_, err = testutil.NewRepo(t, address+"/library/unused").Resolve(ctx, unusedDigest)
+	require.ErrorIs(t, err, errdef.ErrNotFound)
+}
+
 func TestRegistryCopyPlatform(t *testing.T) {
 	ctx := context.Background()
 
```

**File**: `src/cmd/package.go` (modified, +10/-3)
```diff
@@ -565,7 +565,7 @@ func deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts packager.
 			return nil, err
 		}
 	}
-	err := confirmDeploy(ctx, pkgLayout, setVariables, opts.IsInteractive)
+	err := confirmDeploy(ctx, pkgLayout, setVariables, opts.IsInteractive, opts.Connected)
 	if err != nil {
 		return nil, err
 	}
@@ -589,11 +589,18 @@ func deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts packager.
 	return result.DeployedComponents, nil
 }
 
-func confirmDeploy(ctx context.Context, pkgLayout *layout.PackageLayout, setVariables map[string]string, isInteractive bool) (err error) {
+func confirmDeploy(ctx context.Context, pkgLayout *layout.PackageLayout, setVariables map[string]string, isInteractive bool, connected bool) (err error) {
 	l := logger.From(ctx)
 	pkg := pkgLayout.Definition()
 
-	displayPackage, err := packageForDisplay(pkg)
+	displayPkg := pkg
+	// Operate on temp package so IsSbomAble still works
+	if connected || pkg.Metadata.YOLO {
+		displayPkg.Components = slices.Clone(pkg.Components)
+		displayPkg.RemoveImages()
+		displayPkg.RemoveRepositories()
+	}
+	displayPackage, err := packageForDisplay(displayPkg)
 	if err != nil {
 		return err
 	}
```

**File**: `src/pkg/packager/deploy.go` (modified, +6/-2)
```diff
@@ -156,6 +156,10 @@ func Deploy(ctx context.Context, pkgLayout *layout.PackageLayout, opts DeployOpt
 	if err := pkgLayout.Filter(filters.ByLocalOS(runtime.GOOS)); err != nil {
 		return DeployResult{}, err
 	}
+	if opts.Connected {
+		pkgLayout.RemoveImages()
+		pkgLayout.RemoveRepositories()
+	}
 	pkg = pkgLayout.Definition()
 
 	variableConfig, err := getPopulatedVariableConfig(ctx, pkg, opts.SetVariables, opts.IsInteractive)
@@ -490,10 +494,10 @@ func (d *deployer) deployComponent(ctx context.Context, pkgLayout *layout.Packag
 
 	l.Info("deploying component", "name", component.Name)
 
-	hasImages := len(component.GetImages()) > 0 && !noImgPush && !opts.Connected
+	hasImages := len(component.GetImages()) > 0 && !noImgPush
 	hasCharts := len(component.Charts) > 0
 	hasManifests := len(component.Manifests) > 0
-	hasRepos := len(component.Repositories) > 0 && !opts.Connected
+	hasRepos := len(component.Repositories) > 0
 	hasFiles := len(component.Files) > 0
 
 	onDeploy := component.Actions.OnDeploy
```

**File**: `src/test/e2e/47_connected_deploy_test.go` (modified, +6/-0)
```diff
@@ -29,6 +29,8 @@ func TestConnectedDeploy(t *testing.T) {
 
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "deploy", pkgPath, "--connected", "--confirm")
 	require.NoError(t, err, stdOut, stdErr)
+	require.NotContains(t, stdOut, "images:", "deployment preview should omit images that will not be pushed")
+	require.Contains(t, stdErr, "does NOT contain an SBOM", "deployment preview should still report package SBOM availability")
 
 	// Verify the deployment does not have a mutated pod
 	c, err := cluster.New(t.Context())
@@ -43,6 +45,10 @@ func TestConnectedDeploy(t *testing.T) {
 	deployedPkg, err := c.GetDeployedPackage(t.Context(), "connected-deploy")
 	require.NoError(t, err)
 	require.Equal(t, state.PackageConnectivityConnected, deployedPkg.GetPackageConnectivity(), "package secret should record connected deploy mode")
+	pkg, err := deployedPkg.Definition()
+	require.NoError(t, err)
+	require.Len(t, pkg.Components, 1)
+	require.Empty(t, pkg.Components[0].Images, "deployed definition should omit images that were not pushed")
 
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "remove", "connected-deploy", "--confirm")
 	require.NoError(t, err, stdOut, stdErr)
```

**File**: `src/test/testutil/registry.go` (modified, +5/-1)
```diff
@@ -41,7 +41,11 @@ func SetupInMemoryRegistry(ctx context.Context, t *testing.T, port int) string {
 	config.Log.Level = "error"
 	logrus.SetOutput(io.Discard)
 	config.HTTP.DrainTimeout = 10 * time.Second
-	config.Storage = map[string]configuration.Parameters{"inmemory": map[string]interface{}{}}
+	config.Catalog.MaxEntries = 1000
+	config.Storage = map[string]configuration.Parameters{
+		"inmemory": {},
+		"delete":   {"enabled": true},
+	}
 	ref, err := registry.NewRegistry(ctx, config)
 	require.NoError(t, err)
 	//nolint:errcheck // ignore
```

---

### Incident Patch 3: `7be076ab` (2026-09-30)
**Commit Message**: fix(helm)!: only label pod templates of built-in workload kinds (#5360)

Signed-off-by: Igor de Beijer <[REDACTED_EMAIL]>

**File**: `src/internal/packager/helm/post-render.go` (modified, +73/-22)
```diff
@@ -196,8 +196,8 @@ func (r *renderer) editHelmResources(ctx context.Context, resources []releaseuti
 				labels = map[string]string{}
 			}
 			obj.SetLabels(r.setPackageLabels(labels))
-			// Add the package label to pod templates (for Deployments, StatefulSets, etc.)
-			if err := r.addLabelsToNestedPath(obj, []string{"spec", "template", "metadata", "labels"}); err != nil {
+			// Add the package label to the pod template of anything that has one
+			if err := r.addPodTemplateLabels(obj); err != nil {
 				return fmt.Errorf("failed to add labels to pod template: %w", err)
 			}
 			// In connected or YOLO mode, add agent ignore labels so the webhook doesn't mutate resources
@@ -321,23 +321,77 @@ func flattenListResource(obj *unstructured.Unstructured, addResource func(*unstr
 	})
 }
 
-// addLabelsToNestedPath adds package labels to a nested path in an unstructured object
-func (r *renderer) addLabelsToNestedPath(obj *unstructured.Unstructured, path []string) error {
-	// Check if the nested path exists and get the labels
-	templateLabels, found, err := unstructured.NestedStringMap(obj.Object, path...)
-	if err != nil {
-		return err
-	} else if !found {
-		// Path doesn't exist, nothing to do
+// podTemplateKinds maps the kubernetes kinds that create pods to where their pod template keeps its
+// labels. Only these are labeled: anything may sit at spec.template on a custom resource, and a chart
+// that wants one labeled can set zarf.dev/package={{ .Pkg.Metadata.Name }} itself.
+var podTemplateKinds = map[schema.GroupKind][]string{
+	{Group: "apps", Kind: "Deployment"}:        {"spec", "template", "metadata", "labels"},
+	{Group: "apps", Kind: "StatefulSet"}:       {"spec", "template", "metadata", "labels"},
+	{Group: "apps", Kind: "DaemonSet"}:         {"spec", "template", "metadata", "labels"},
+	{Group: "apps", Kind: "ReplicaSet"}:        {"spec", "template", "metadata", "labels"},
+	{Group: "batch", Kind: "Job"}:              {"spec", "template", "metadata", "labels"},
+	{Group: "batch", Kind: "CronJob"}:          {"spec", "jobTemplate", "spec", "template", "metadata", "labels"},
+	{Group: "", Kind: "ReplicationController"}: {"spec", "template", "metadata", "labels"},
+}
+
+// addPodTemplateLabels adds the package labels to the pod template of a workload resource
+func (r *renderer) addPodTemplateLabels(obj *unstructured.Unstructured) error {
+	path, createsPods := podTemplateKinds[obj.GroupVersionKind().GroupKind()]
+	if !createsPods {
+		return nil
+	}
+	labels, found := ensureLabelsAt(obj, path)
+	if !found {
+		// nothing shaped like a pod template, so nothing to label
 		return nil
 	}
-	if templateLabels == nil {
-		templateLabels = map[string]string{}
+	return unstructured.SetNestedStringMap(obj.Object, r.setPackageLabels(labels), path...)
+}
+
+// objectMetaTail counts the trailing metadata and labels segments every label path ends in, as in
+// spec.template.metadata.labels.
+const objectMetaTail = 2
+
+// ensureLabelsAt returns the label map at path, creating it when the manifest left it out or wrote
+// it as null. Finding none is an answer, not an error: anything may sit at spec.template, and a
+// malformed resource is the API server's to report, not zarf's to fail a deploy over.
+func ensureLabelsAt(obj *unstructured.Unstructured, path []string) (map[string]string, bool) {
+	if len(path) < objectMetaTail {
+		return nil, false
+	}
+	// the route down has to exist already, since writing it in would invent a pod template the
+	// chart never asked for; the ObjectMeta and labels at the end are optional, so those are created
+	parentPath, metaPath := path[:len(path)-objectMetaTail], path[len(path)-objectMetaTail:]
+
+	parent := obj.Object
+	for _, field := range parentPath {
+		nested, isMap := parent[field].(map[string]interface{})
+		if !isMap {
+			return nil, false
+		}
+		parent = nested
+	}
+	for _, field := range metaPath {
+		nested, isMap := parent[field].(map[string]interface{})
+		if !isMap {
+			if parent[field] != nil {
+				return nil, false
+			}
+			nested = map[string]interface{}{}
+			parent[field] = nested
+		}
+		parent = nested
+	}
+	// SetNestedStringMap writes back a map[string]string, so copy out and refuse anything else
+	labels := make(map[string]string, len(parent))
+	for key, value := range parent {
+		text, isString := value.(string)
+		if !isString {
+			return nil, false
+		}
+		labels[key] = text
 	}
-	// Add package labels
-	templateLabels = r.setPackageLabels(templateLabels)
-	// Set the updated labels back
-	return unstructured.SetNestedStringMap(obj.Object, templateLabels, path...)
+	return labels, true
 }
 
 // agentMutatedKinds maps resources mutated by the Zarf agent webhook to the
@@ -374,12 +428,9 @@ func addAgentIgnoreLabels(obj *unstructured.Unstructured) error {
 	}
 
 	for _, path := range labelPaths {
-		labels, found, err := unstructured.NestedStringMap(obj.Object, path...)
-		if err != nil {
-			return err
-		}
-		if !found || labels == nil {
```

**File**: `src/internal/packager/helm/post-render_test.go` (modified, +394/-0)
```diff
@@ -245,6 +245,24 @@ func TestAddAgentIgnoreLabels(t *testing.T) {
 			}},
 			expectLabel: true,
 		},
+		{
+			name: "Deployment with pod template labels written as null",
+			obj: &unstructured.Unstructured{Object: map[string]interface{}{
+				"apiVersion": "apps/v1",
+				"kind":       "Deployment",
+				"metadata": map[string]interface{}{
+					"name": "null-template-labels",
+				},
+				"spec": map[string]interface{}{
+					"template": map[string]interface{}{
+						"metadata": map[string]interface{}{
+							"labels": nil,
+						},
+					},
+				},
+			}},
+			expectLabel: true,
+		},
 		{
 			name: "ArgoCD repository secret gets label",
 			obj: &unstructured.Unstructured{Object: map[string]interface{}{
@@ -758,6 +776,382 @@ items:
 	require.Equal(t, "ignore", templateLabels["zarf.dev/agent"])
 }
 
+func TestEditHelmResourcesPodTemplateLabels(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		manifest string
+		expected map[string]string
+		path     []string
+	}{
+		{
+			name: "pod template labels written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-template-labels
+spec:
+  template:
+    metadata:
+      labels: null
+`,
+			expected: map[string]string{"zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "pod template with no labels of its own",
+			manifest: `apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: no-template-labels
+spec:
+  template:
+    metadata: {}
+`,
+			expected: map[string]string{"zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "pod template labels are kept",
+			manifest: `apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: with-template-labels
+spec:
+  template:
+    metadata:
+      labels:
+        app: mine
+`,
+			expected: map[string]string{"app": "mine", "zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "pod template metadata written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-template-metadata
+spec:
+  template:
+    metadata: null
+    spec:
+      restartPolicy: Never
+      containers:
+        - name: main
+          image: busybox
+`,
+			expected: map[string]string{"zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "replicationcontroller pod template",
+			manifest: `apiVersion: v1
+kind: ReplicationController
+metadata:
+  name: rc
+spec:
+  template:
+    metadata:
+      labels:
+        app: mine
+`,
+			expected: map[string]string{"app": "mine", "zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "template", "metadata", "labels"},
+		},
+		{
+			name: "cronjob keeps its pod template a level deeper",
+			manifest: `apiVersion: batch/v1
+kind: CronJob
+metadata:
+  name: nested-template
+spec:
+  schedule: "* * * * *"
+  jobTemplate:
+    spec:
+      template:
+        metadata:
+          labels:
+            app: mine
+`,
+			expected: map[string]string{"app": "mine", "zarf.dev/package": "test-pkg"},
+			path:     []string{"spec", "jobTemplate", "spec", "template", "metadata", "labels"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+
+			docs := renderManifest(t, newTestRenderer(), tt.manifest)
+			require.Len(t, docs, 1)
+			labels, found, err := unstructured.NestedStringMap(docs[0].Object, tt.path...)
+			require.NoError(t, err)
+			require.True(t, found)
+			require.Equal(t, tt.expected, labels)
+		})
+	}
+}
+
+func TestEditHelmResourcesWithoutAPodTemplateToLabel(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		manifest string
+	}{
+		{
+			name: "pod template written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-template
+spec:
+  template: null
+`,
+		},
+		{
+			name: "spec written as null",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: null-spec
+spec: null
+`,
+		},
+		{
+			name: "no spec at all",
+			manifest: `apiVersion: batch/v1
+kind: Job
+metadata:
+  name: no-spec
+`,
+		},
+		{
+			name: "cronjob with no job template",
+			manifest: `apiVersion: batch/v1
+kind: CronJob
+metadata:
+  name: no-job-template
+spec:
+  schedule: "* * * * *"
+`,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+
+			// there is no pod template here, so writing the path in would invent one
+			docs := renderManifest(t, newTestRenderer(), tt.manifest)
+			require.Len(t, docs, 1)
+			require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+
+			original := &unstructured.Unstructured{}
+			require.NoError(t, yaml.Unmarshal([]byte(tt.manifest), original))
+			require.Equal(t, original.Object["spec"], docs[0].Object["spec"])
+		})
+	}
+}
+
+func TestEdi
```

---

### Incident Patch 4: `379379a2` (2026-09-30)
**Commit Message**: fix: replace github.com/defenseunicorns/pkg with local versions (#5324)

Signed-off-by: Maciej Szulik <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@ require (
 	github.com/anchore/stereoscope v0.3.1
 	github.com/anchore/syft v1.51.1
 	github.com/avast/retry-go/v4 v4.7.0
-	github.com/defenseunicorns/pkg/helpers/v2 v2.0.4
-	github.com/defenseunicorns/pkg/oci v1.3.2
 	github.com/derailed/k9s v0.51.0
 	github.com/distribution/distribution/v3 v3.1.1
 	github.com/distribution/reference v0.6.0
```

**File**: `go.sum` (modified, +0/-4)
```diff
@@ -557,10 +557,6 @@ github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.1 h1:5RVFMOWjMyRy8cARdy79nAmgYw3h
 github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.1/go.mod h1:ZXNYxsqcloTdSy/rNShjYzMhyjf0LaoftYK0p+A3h40=
 github.com/defenseunicorns/gojsonschema v0.0.0-20231116163348-e00f069122d6 h1:gwevOZ0fxT2nzM9hrtdPbsiOHjFqDRIYMzJHba3/G6Q=
 github.com/defenseunicorns/gojsonschema v0.0.0-20231116163348-e00f069122d6/go.mod h1:StKLYMmPj1R5yIs6CK49EkcW1TvUYuw5Vri+LRk7Dy8=
-github.com/defenseunicorns/pkg/helpers/v2 v2.0.4 h1:niBIdhRUpJghWthzJJq/SKr/dYQHW9Mn97UJT5I/2SI=
-github.com/defenseunicorns/pkg/helpers/v2 v2.0.4/go.mod h1:7demM0eE/+nMqPT7PCKgO9/KVUmRSyi9UpDzb0KfYDM=
-github.com/defenseunicorns/pkg/oci v1.3.2 h1:7Ph4DRwcccwGPKrEGDPZTkY4VJaJ1qqZVNmr3G1Hup0=
-github.com/defenseunicorns/pkg/oci v1.3.2/go.mod h1:iXzZXG7jNjkOIt5MqQp12iZH3c762zP0AOVwKTGhNhY=
 github.com/deitch/magic v0.0.0-20240306090643-c67ab88f10cb h1:4W/2rQ3wzEimF5s+J6OY3ODiQtJZ5W1sForSgogVXkY=
 github.com/deitch/magic v0.0.0-20240306090643-c67ab88f10cb/go.mod h1:B3tI9iGHi4imdLi4Asdha1Sc6feLMTfPLXh9IUYmysk=
 github.com/depcheck-test/depcheck-test v0.0.0-20220607135614-199033aaa936 h1:foGzavPWwtoyBvjWyKJYDYsyzy+23iBV7NKTwdk+LRY=
```

**File**: `src/cmd/component.go` (modified, +1/-1)
```diff
@@ -9,11 +9,11 @@ import (
 	"path"
 	"strings"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/spf13/cobra"
 	"github.com/spf13/viper"
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/pkg/component"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/signing"
 	"oras.land/oras-go/v2/registry"
```

**File**: `src/cmd/connect.go` (modified, +1/-1)
```diff
@@ -9,8 +9,8 @@ import (
 	"fmt"
 	"strings"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/spf13/cobra"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/pkg/cluster"
```

**File**: `src/cmd/destroy.go` (modified, +1/-1)
```diff
@@ -11,11 +11,11 @@ import (
 	"os"
 	"regexp"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/internal/packager/helm"
 	"github.com/zarf-dev/zarf/src/pkg/cluster"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/utils/exec"
 
```

**File**: `src/cmd/dev.go` (modified, +1/-1)
```diff
@@ -17,7 +17,6 @@ import (
 	"time"
 
 	"github.com/AlecAivazis/survey/v2"
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	goyaml "github.com/goccy/go-yaml"
 	"github.com/pterm/pterm"
 	"github.com/sergi/go-diff/diffmatchpatch"
@@ -30,6 +29,7 @@ import (
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/internal/packager/helm"
 	"github.com/zarf-dev/zarf/src/pkg/archive"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/lint"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/packager"
```

**File**: `src/cmd/initialize.go` (modified, +1/-1)
```diff
@@ -19,11 +19,11 @@ import (
 	"time"
 
 	"github.com/AlecAivazis/survey/v2"
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/zarf-dev/zarf/src/api"
 	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/pkg/cluster"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/packager"
 	"github.com/zarf-dev/zarf/src/pkg/packager/filters"
```

**File**: `src/cmd/internal.go` (modified, +3/-2)
```diff
@@ -8,18 +8,19 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"hash/crc32"
 	"os"
 	"path/filepath"
 	"strings"
 
-	"github.com/defenseunicorns/pkg/helpers/v2"
 	"github.com/spf13/cobra"
 	"github.com/spf13/cobra/doc"
 	"github.com/spf13/pflag"
 	"github.com/zarf-dev/zarf/src/config/lang"
 	"github.com/zarf-dev/zarf/src/internal/agent"
 	"github.com/zarf-dev/zarf/src/internal/gitea"
 	"github.com/zarf-dev/zarf/src/pkg/cluster"
+	"github.com/zarf-dev/zarf/src/pkg/helpers"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/state"
 )
@@ -421,6 +422,6 @@ func newInternalCrc32Command() *cobra.Command {
 
 func (o *internalCrc32Options) run(_ *cobra.Command, args []string) {
 	text := args[0]
-	hash := helpers.GetCRCHash(text)
+	hash := crc32.ChecksumIEEE([]byte(text))
 	fmt.Printf("%d\n", hash)
 }
```

---

### Incident Patch 5: `d07690ec` (2026-09-28)
**Commit Message**: fix(assemble): cleanup temporary directory on error (#5407)

Signed-off-by: Brandt Keller <[REDACTED_EMAIL]>

**File**: `src/pkg/packager/assemble/assemble.go` (modified, +5/-0)
```diff
@@ -116,6 +116,11 @@ func AssemblePackage(ctx context.Context, resolvedPackage *load.ResolvedPackage,
 	if err != nil {
 		return nil, err
 	}
+	defer func() {
+		if err != nil {
+			err = errors.Join(err, os.RemoveAll(buildPath))
+		}
+	}()
 	for _, component := range pkg.Components {
 		err := assemblePackageComponent(ctx, component, resolvedPackage.Resources, buildPath, opts.CachePath, opts.RemoteOptions)
 		if err != nil {
```

**File**: `src/pkg/packager/assemble/assemble_test.go` (modified, +40/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"github.com/zarf-dev/zarf/src/api/convert"
 	"github.com/zarf-dev/zarf/src/api/v1alpha1"
 	"github.com/zarf-dev/zarf/src/api/v1beta1"
+	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/internal/pkgcfg"
 	"github.com/zarf-dev/zarf/src/pkg/images"
 	"github.com/zarf-dev/zarf/src/pkg/packager/layout"
@@ -558,6 +559,45 @@ components:
 	}
 }
 
+func TestAssemblePackageCleansStagingDirectoryOnSuccessActionFailure(t *testing.T) {
+	// This test configures a process-global temporary directory.
+	tempDirectory := t.TempDir()
+	originalTempDirectory := config.CommonOptions.TempDirectory
+	config.CommonOptions.TempDirectory = tempDirectory
+	t.Cleanup(func() {
+		config.CommonOptions.TempDirectory = originalTempDirectory
+	})
+
+	ctx := testutil.TestContext(t)
+	sourcePath, err := filepath.Abs(filepath.Join("testdata", "zarf-package", "data.txt"))
+	require.NoError(t, err)
+	dir := t.TempDir()
+	definition := fmt.Sprintf(`apiVersion: zarf.dev/v1beta1
+kind: ZarfPackageConfig
+metadata:
+  name: create-actions
+components:
+  - name: component
+    files:
+      - source: %q
+        destination: data.txt
+    actions:
+      onCreate:
+        onSuccess:
+          - cmd: exit 1
+`, sourcePath)
+	require.NoError(t, os.WriteFile(filepath.Join(dir, layout.ZarfYAML), []byte(definition), 0o600))
+
+	loaded, err := load.Package(ctx, dir, load.PackageOptions{})
+	require.NoError(t, err)
+	_, err = AssemblePackage(ctx, loaded, AssembleOptions{SkipSBOM: true})
+	require.ErrorContains(t, err, "unable to run component success action")
+
+	entries, err := os.ReadDir(tempDirectory)
+	require.NoError(t, err)
+	require.Empty(t, entries)
+}
+
 func TestAssemblePackageWritesResolvedValues(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 6: `dd7301bd` (2026-09-28)
**Commit Message**: fix(create): run OnSuccess and OnFailure actions during create (#5406)

Signed-off-by: Austin Abro <[REDACTED_EMAIL]>

**File**: `src/pkg/packager/assemble/assemble.go` (modified, +13/-1)
```diff
@@ -362,6 +362,19 @@ func assemblePackageComponent(ctx context.Context, component api.Component, reso
 	if err != nil {
 		return err
 	}
+	onCreate := component.Actions.OnCreate
+	defer func() {
+		if err == nil {
+			if successErr := actions.Run(ctx, packagePath, onCreate.OnSuccess, actions.RunOptions{DefaultConfig: onCreate.Defaults}); successErr != nil {
+				err = fmt.Errorf("unable to run component success action: %w", successErr)
+			}
+		}
+		if err != nil {
+			if failureErr := actions.Run(ctx, packagePath, onCreate.OnFailure, actions.RunOptions{DefaultConfig: onCreate.Defaults}); failureErr != nil {
+				err = errors.Join(err, fmt.Errorf("unable to run component failure action: %w", failureErr))
+			}
+		}
+	}()
 	tmpBuildPath, err := utils.MakeTempDir(config.CommonOptions.TempDirectory)
 	if err != nil {
 		return err
@@ -375,7 +388,6 @@ func assemblePackageComponent(ctx context.Context, component api.Component, reso
 		return err
 	}
 
-	onCreate := component.Actions.OnCreate
 	if err := actions.Run(ctx, packagePath, onCreate.Before, actions.RunOptions{DefaultConfig: onCreate.Defaults}); err != nil {
 		return fmt.Errorf("unable to run component before action: %w", err)
 	}
```

**File**: `src/pkg/packager/assemble/assemble_test.go` (modified, +84/-0)
```diff
@@ -474,6 +474,90 @@ func writePackageToDisk(t *testing.T, pkg v1alpha1.ZarfPackage, dir string) {
 	require.NoError(t, err)
 }
 
+func TestAssemblePackageOnCreateOutcomeActions(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name        string
+		before      string
+		onSuccess   string
+		wantError   string
+		wantBefore  bool
+		wantSuccess bool
+		wantFailure bool
+	}{
+		{
+			name:        "successful creation",
+			before:      "echo before > before.txt",
+			onSuccess:   "echo success > success.txt",
+			wantBefore:  true,
+			wantSuccess: true,
+		},
+		{
+			name:        "failed before action",
+			before:      "exit 1",
+			onSuccess:   "echo success > success.txt",
+			wantError:   "unable to run component before action",
+			wantFailure: true,
+		},
+		{
+			name:        "failed success action",
+			before:      "echo before > before.txt",
+			onSuccess:   "exit 1",
+			wantError:   "unable to run component success action",
+			wantBefore:  true,
+			wantFailure: true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := testutil.TestContext(t)
+			dir := t.TempDir()
+			definition := fmt.Sprintf(`apiVersion: zarf.dev/v1beta1
+kind: ZarfPackageConfig
+metadata:
+  name: create-actions
+components:
+  - name: component
+    actions:
+      onCreate:
+        before:
+          - cmd: %q
+        onSuccess:
+          - cmd: %q
+        onFailure:
+          - cmd: echo failure > failure.txt
+`, tt.before, tt.onSuccess)
+			require.NoError(t, os.WriteFile(filepath.Join(dir, layout.ZarfYAML), []byte(definition), 0o600))
+
+			loaded, err := load.Package(ctx, dir, load.PackageOptions{})
+			require.NoError(t, err)
+			pkgLayout, err := AssemblePackage(ctx, loaded, AssembleOptions{SkipSBOM: true})
+			if tt.wantError != "" {
+				require.ErrorContains(t, err, tt.wantError)
+			} else {
+				require.NoError(t, err)
+				t.Cleanup(func() { require.NoError(t, pkgLayout.Cleanup()) })
+			}
+
+			for name, want := range map[string]bool{
+				"before.txt":  tt.wantBefore,
+				"success.txt": tt.wantSuccess,
+				"failure.txt": tt.wantFailure,
+			} {
+				path := filepath.Join(dir, name)
+				if want {
+					require.FileExists(t, path)
+				} else {
+					require.NoFileExists(t, path)
+				}
+			}
+		})
+	}
+}
+
 func TestAssemblePackageWritesResolvedValues(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 7: `c18603a9` (2026-09-25)
**Commit Message**: fix(init): propagate secret updates on init mode changes (#5398)

Signed-off-by: Brandt Keller <[REDACTED_EMAIL]>

**File**: `src/pkg/cluster/secrets.go` (modified, +6/-0)
```diff
@@ -5,6 +5,7 @@
 package cluster
 
 import (
+	"bytes"
 	"context"
 	"encoding/base64"
 	"encoding/json"
@@ -142,6 +143,11 @@ func (c *Cluster) UpdateZarfManagedImageSecrets(ctx context.Context, s *state.St
 		if err != nil {
 			return err
 		}
+		// Avoid writes when the credentials already match the target registry state.
+		if currentRegistrySecret.Type == corev1.SecretTypeDockerConfigJson &&
+			bytes.Equal(currentRegistrySecret.Data[".dockerconfigjson"], newRegistrySecret.Data[".dockerconfigjson"]) {
+			continue
+		}
 		l.Info("applying Zarf managed registry secret for namespace", "name", namespace.Name)
 		_, err = c.Clientset.CoreV1().Secrets(*newRegistrySecret.Namespace).Apply(ctx, newRegistrySecret, metav1.ApplyOptions{Force: true, FieldManager: FieldManagerName})
 		if err != nil {
```

**File**: `src/pkg/cluster/secrets_test.go` (modified, +53/-0)
```diff
@@ -207,3 +207,56 @@ func TestUpdateZarfManagedSecrets(t *testing.T) {
 		})
 	}
 }
+
+func TestUpdateZarfManagedImageSecrets_SkipsCurrentSecret(t *testing.T) {
+	ctx := testutil.TestContext(t)
+	clientset := fake.NewClientset()
+	c := &Cluster{Clientset: clientset}
+
+	namespace := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}
+	_, err := clientset.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
+	require.NoError(t, err)
+
+	svc := &corev1.Service{
+		ObjectMeta: metav1.ObjectMeta{Name: "good-service", Namespace: namespace.Name},
+		Spec: corev1.ServiceSpec{
+			Type: corev1.ServiceTypeNodePort,
+			Ports: []corev1.ServicePort{{
+				NodePort: 30001,
+				Port:     3333,
+			}},
+			ClusterIP: "10.11.12.13",
+		},
+	}
+	_, err = clientset.CoreV1().Services(namespace.Name).Create(ctx, svc, metav1.CreateOptions{})
+	require.NoError(t, err)
+
+	s := &state.State{
+		RegistryInfo: state.RegistryInfo{
+			PullUsername: "pull-user",
+			PullPassword: "pull-password",
+			Address:      "127.0.0.1:30001",
+		},
+	}
+	desiredRegistrySecret, err := c.GenerateRegistryPullCreds(ctx, namespace.Name, config.ZarfImagePullSecretName, s.RegistryInfo)
+	require.NoError(t, err)
+	currentRegistrySecret := &corev1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      config.ZarfImagePullSecretName,
+			Namespace: namespace.Name,
+			Labels: map[string]string{
+				state.ZarfManagedByLabel: "zarf",
+			},
+		},
+		Type: corev1.SecretTypeDockerConfigJson,
+		Data: desiredRegistrySecret.Data,
+	}
+	_, err = clientset.CoreV1().Secrets(namespace.Name).Create(ctx, currentRegistrySecret, metav1.CreateOptions{})
+	require.NoError(t, err)
+
+	actionsBefore := len(clientset.Actions())
+	require.NoError(t, c.UpdateZarfManagedImageSecrets(ctx, s))
+	for _, action := range clientset.Actions()[actionsBefore:] {
+		require.NotEqual(t, "patch", action.GetVerb())
+	}
+}
```

**File**: `src/pkg/packager/deploy.go` (modified, +5/-0)
```diff
@@ -459,6 +459,11 @@ func (d *deployer) deployInitComponent(ctx context.Context, pkgLayout *layout.Pa
 	if err != nil {
 		return nil, err
 	}
+	if isRegistry && d.s.RegistryInfo.IsInternal() {
+		if err := d.c.UpdateZarfManagedImageSecrets(ctx, d.s); err != nil {
+			return nil, fmt.Errorf("unable to reconcile Zarf-managed image pull secrets: %w", err)
+		}
+	}
 
 	// Do cleanup for when we inject the seed registry during initialization
 	if isSeedRegistry && d.s.RegistryInfo.RegistryMode == state.RegistryModeNodePort {
```

---

### Incident Patch 8: `7b7a4480` (2026-09-24)
**Commit Message**: docs: fix tagline (#5392)

Signed-off-by: Austin Abro <[REDACTED_EMAIL]>

**File**: `.goreleaser.yaml` (modified, +2/-2)
```diff
@@ -107,7 +107,7 @@ brews:
 
     commit_msg_template: "build(release): upgrade {{ .ProjectName }} to {{ .Tag }}"
     homepage: "https://zarf.dev/"
-    description: "The Airgap Native Packager Manager for Kubernetes"
+    description: "The Airgap Native Package Manager for Kubernetes"
 
   # NOTE: We are using .Version instead of .Tag because homebrew has weird semver parsing rules and won't be able to
   #       install versioned releases that has a `v` character before the version number.
@@ -125,4 +125,4 @@ brews:
           name: homebrew-tap
     commit_msg_template: "build(release): {{ .ProjectName }}@{{ .Tag }}"
     homepage: "https://zarf.dev/"
-    description: "The Airgap Native Packager Manager for Kubernetes"
+    description: "The Airgap Native Package Manager for Kubernetes"
```

**File**: `site/src/content/docs/commands/zarf.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ tableOfContents: false
 
 ## zarf
 
-The Airgap Native Packager Manager for Kubernetes
+The Airgap Native Package Manager for Kubernetes
 
 ### Synopsis
 
```

**File**: `site/src/content/docs/commands/zarf_completion.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ See each sub-command's help for details on how to use the generated script.
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 * [zarf completion bash](/commands/zarf_completion_bash/)	 - Generate the autocompletion script for bash
 * [zarf completion fish](/commands/zarf_completion_fish/)	 - Generate the autocompletion script for fish
 * [zarf completion powershell](/commands/zarf_completion_powershell/)	 - Generate the autocompletion script for powershell
```

**File**: `site/src/content/docs/commands/zarf_connect.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ zarf connect { REGISTRY | GIT | connect-name } [flags]
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 * [zarf connect list](/commands/zarf_connect_list/)	 - Lists all available connection shortcuts
 * [zarf connect resource](/commands/zarf_connect_resource/)	 - Connect to a service or pod in the cluster
 
```

**File**: `site/src/content/docs/commands/zarf_destroy.md` (modified, +1/-1)
```diff
@@ -48,5 +48,5 @@ zarf destroy --confirm [flags]
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 
```

**File**: `site/src/content/docs/commands/zarf_dev.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ Commands useful for developing packages
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 * [zarf dev deploy](/commands/zarf_dev_deploy/)	 - Creates and deploys a Zarf package from a given directory
 * [zarf dev find-images](/commands/zarf_dev_find-images/)	 - Evaluates components in a Zarf file to identify images specified in their helm charts and manifests.
 * [zarf dev generate](/commands/zarf_dev_generate/)	 - Creates a zarf.yaml automatically from a given remote (git) Helm chart
```

**File**: `site/src/content/docs/commands/zarf_init.md` (modified, +1/-1)
```diff
@@ -116,5 +116,5 @@ $ zarf init --git-push-password={PASSWORD} --git-push-username={USERNAME} --git-
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 
```

**File**: `site/src/content/docs/commands/zarf_package.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ Zarf package commands for creating, deploying, and inspecting packages
 
 ### SEE ALSO
 
-* [zarf](/commands/zarf/)	 - The Airgap Native Packager Manager for Kubernetes
+* [zarf](/commands/zarf/)	 - The Airgap Native Package Manager for Kubernetes
 * [zarf package create](/commands/zarf_package_create/)	 - Creates a Zarf package from a given directory or the current directory
 * [zarf package deploy](/commands/zarf_package_deploy/)	 - Deploys a Zarf package from a local file or URL (runs offline)
 * [zarf package inspect](/commands/zarf_package_inspect/)	 - Commands for gathering information from a built package
```

---

### Incident Patch 9: `1f7bbc9f` (2026-09-18)
**Commit Message**: fix(helm): handle charts that render resources inside list kinds (#5344)

Signed-off-by: Igor de Beijer <[REDACTED_EMAIL]>

**File**: `src/internal/packager/helm/post-render.go` (modified, +58/-0)
```diff
@@ -183,6 +183,10 @@ func (r *renderer) shouldAddAgentIgnoreLabels() bool {
 
 func (r *renderer) editHelmResources(ctx context.Context, resources []releaseutil.Manifest, finalManifestsOutput *bytes.Buffer) error {
 	l := logger.From(ctx)
+	resources, err := flattenHelmResources(resources)
+	if err != nil {
+		return err
+	}
 	for _, resource := range resources {
 		// parse to unstructured to have access to more data than just the name
 		newContent, rawData, err := processManifestContent(resource.Content, func(obj *unstructured.Unstructured) error {
@@ -263,6 +267,60 @@ func (r *renderer) editHelmResources(ctx context.Context, resources []releaseuti
 	return nil
 }
 
+// flattenHelmResources replaces every list document with the resources it holds, so that the rest
+// of the post renderer only ever sees one resource per manifest.
+// A list is a wrapper rather than a resource: its metadata is a ListMeta, which has no labels
+// field, so a label written there is rejected by the API server, and everything zarf keys off the
+// kind of a document misses what the list holds. Helm flattens a list into its items before
+// applying it anyway, so the items are what ends up in the cluster either way.
+func flattenHelmResources(resources []releaseutil.Manifest) ([]releaseutil.Manifest, error) {
+	flattened := make([]releaseutil.Manifest, 0, len(resources))
+	for _, resource := range resources {
+		_, rawData, err := processManifestContent(resource.Content, nil)
+		if err != nil {
+			return nil, err
+		}
+		// IsList is the check helm's resource builder uses to decide what to flatten, so zarf and
+		// helm agree on which documents hold more than one resource
+		if len(rawData.Object) == 0 || !rawData.IsList() {
+			flattened = append(flattened, resource)
+			continue
+		}
+		err = flattenListResource(rawData, func(obj *unstructured.Unstructured) error {
+			content, err := yaml.Marshal(obj.Object)
+			if err != nil {
+				return fmt.Errorf("failed to marshal list item: %w", err)
+			}
+			// the item inherits the manifest name zarf writes its own source comment from. helm
+			// tracks the original file with an annotation it puts on the wrapper, which the item
+			// does not carry, so helm files these under a generated name of its own
+			item := resource
+			item.Content = string(content)
+			flattened = append(flattened, item)
+			return nil
+		})
+		if err != nil {
+			return nil, fmt.Errorf("failed to flatten %s: %w", rawData.GetKind(), err)
+		}
+	}
+	return flattened, nil
+}
+
+// flattenListResource calls addResource once for every resource a document holds, walking a list
+// that holds lists all the way down
+func flattenListResource(obj *unstructured.Unstructured, addResource func(*unstructured.Unstructured) error) error {
+	if !obj.IsList() {
+		return addResource(obj)
+	}
+	return obj.EachListItem(func(item runtime.Object) error {
+		listItem, ok := item.(*unstructured.Unstructured)
+		if !ok {
+			return fmt.Errorf("unexpected item of type %T in %s", item, obj.GetKind())
+		}
+		return flattenListResource(listItem, addResource)
+	})
+}
+
 // addLabelsToNestedPath adds package labels to a nested path in an unstructured object
 func (r *renderer) addLabelsToNestedPath(obj *unstructured.Unstructured, path []string) error {
 	// Check if the nested path exists and get the labels
```

**File**: `src/internal/packager/helm/post-render_test.go` (modified, +368/-0)
```diff
@@ -4,6 +4,9 @@
 package helm
 
 import (
+	"bytes"
+	"errors"
+	"io"
 	"os"
 	"path/filepath"
 	"regexp"
@@ -13,9 +16,13 @@ import (
 	"github.com/stretchr/testify/require"
 	"github.com/zarf-dev/zarf/src/pkg/pki"
 	"github.com/zarf-dev/zarf/src/pkg/state"
+	"github.com/zarf-dev/zarf/src/test/testutil"
+	releaseutil "helm.sh/helm/v4/pkg/release/v1/util"
 	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
+	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
 	"k8s.io/apimachinery/pkg/runtime/schema"
+	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
 	"sigs.k8s.io/yaml"
 )
 
@@ -534,3 +541,364 @@ func TestProcessManifestContentEmptyObject(t *testing.T) {
 	require.NotNil(t, rawData)
 	require.Empty(t, rawData.Object)
 }
+
+func TestEditHelmResourcesListDocuments(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		manifest string
+		assert   func(t *testing.T, docs []*unstructured.Unstructured)
+	}{
+		{
+			name: "typed list is replaced by the resources it holds",
+			manifest: `apiVersion: v1
+kind: ConfigMapList
+items:
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: repro-one
+    data:
+      hello: world
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: repro-two
+      labels:
+        grafana_dashboard: "1"
+    data:
+      hello: world
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 2)
+				// a list carries a ListMeta, which has no labels field, so a label written on the
+				// wrapper is rejected by the API server
+				require.Equal(t, "ConfigMap", docs[0].GetKind())
+				require.Equal(t, "ConfigMap", docs[1].GetKind())
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+				require.Equal(t, map[string]string{
+					"grafana_dashboard": "1",
+					"zarf.dev/package":  "test-pkg",
+				}, docs[1].GetLabels(), "existing item labels are kept")
+
+				// nothing else about the item changed
+				data, found, err := unstructured.NestedStringMap(docs[0].Object, "data")
+				require.NoError(t, err)
+				require.True(t, found)
+				require.Equal(t, map[string]string{"hello": "world"}, data)
+			},
+		},
+		{
+			name: "generic list labels pod templates of its items",
+			manifest: `apiVersion: v1
+kind: List
+items:
+  - apiVersion: apps/v1
+    kind: Deployment
+    metadata:
+      name: nested-deploy
+    spec:
+      template:
+        metadata:
+          labels:
+            app: nested
+        spec:
+          containers:
+            - name: main
+              image: nginx
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 1)
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+
+				templateLabels, found, err := unstructured.NestedStringMap(docs[0].Object, "spec", "template", "metadata", "labels")
+				require.NoError(t, err)
+				require.True(t, found)
+				require.Equal(t, map[string]string{
+					"app":              "nested",
+					"zarf.dev/package": "test-pkg",
+				}, templateLabels)
+			},
+		},
+		{
+			name: "list nested in a list is walked all the way down",
+			manifest: `apiVersion: v1
+kind: List
+items:
+  - apiVersion: v1
+    kind: ConfigMapList
+    items:
+      - apiVersion: v1
+        kind: ConfigMap
+        metadata:
+          name: deeply-nested
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 1)
+				require.Equal(t, "ConfigMap", docs[0].GetKind())
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+			},
+		},
+		{
+			name: "list that rendered no items leaves nothing behind",
+			manifest: `apiVersion: v1
+kind: ConfigMapList
+items: []
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Empty(t, docs)
+			},
+		},
+		{
+			name: "list kind whose items is not an array is a resource of its own",
+			manifest: `apiVersion: example.com/v1
+kind: ShoppingList
+metadata:
+  name: groceries
+items:
+  milk: 2
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 1)
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels(),
+					"a resource that is not a list must not be left unlabeled")
+			},
+		},
+		{
+			name: "regular resource is still labeled",
+			manifest: `apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: plain-cm
+`,
+			assert: func(t *testing.T, docs []*unstructured.Unstructured) {
+				require.Len(t, docs, 1)
+				require.Equal(t, map[string]string{"zarf.dev/package": "test-pkg"}, docs[0].GetLabels())
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			tt.assert(t, renderManifest(t, newTestRenderer(), tt.manifest))
+		})
+	}
+}
+
+func TestEditHelmResourcesListWithNonObjectItem(t *testing.T) {
+	t.Parallel()
+
+	manifest
```

**File**: `src/test/e2e/25_helm_test.go` (modified, +51/-0)
```diff
@@ -309,3 +309,54 @@ func TestHelmHooks(t *testing.T) {
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "remove", "helm-hooks", "--confirm")
 	require.NoError(t, err, stdOut, stdErr)
 }
+
+func TestHelmListKinds(t *testing.T) {
+	t.Log("E2E: Helm charts that render list kinds")
+
+	tmpdir := t.TempDir()
+	packagePath := filepath.Join("src", "test", "packages", "25-list-kinds")
+
+	stdOut, stdErr, err := e2e.Zarf(t, "package", "create", packagePath, "-o", tmpdir, "--confirm")
+	require.NoError(t, err, stdOut, stdErr)
+
+	pkgPath := filepath.Join(tmpdir, fmt.Sprintf("zarf-package-list-kinds-%s-0.1.0.tar.zst", e2e.Arch))
+	t.Cleanup(func() {
+		_, _, err := e2e.Kubectl(t, "delete", "namespace", "list-kinds-elsewhere", "list-kinds-nested-ns", "--ignore-not-found", "--grace-period=0")
+		require.NoError(t, err)
+	})
+	stdOut, stdErr, err = e2e.Zarf(t, "package", "deploy", pkgPath, "--confirm")
+	require.NoError(t, err, stdOut, stdErr)
+
+	// the configmaps only exist if helm accepted the list documents, and they only carry the
+	// package label if zarf labeled the items rather than the list wrapping them
+	kubectlOut, _, err := e2e.Kubectl(t, "-n", "list-kinds", "get", "configmaps", "-l", "zarf.dev/package=list-kinds", "-o", "jsonpath={.items[*].metadata.name}")
+	require.NoError(t, err)
+	require.Contains(t, kubectlOut, "list-one")
+	require.Contains(t, kubectlOut, "list-two")
+	require.Contains(t, kubectlOut, "generic-list-config")
+
+	// labels the chart set on an item are kept alongside the ones zarf adds
+	kubectlOut, _, err = e2e.Kubectl(t, "-n", "list-kinds", "get", "configmap", "list-two", "-o", "jsonpath={.metadata.labels.chart-owned}")
+	require.NoError(t, err)
+	require.Equal(t, "true", kubectlOut)
+
+	// an item can name a namespace of its own, which zarf has to create before helm applies it
+	kubectlOut, _, err = e2e.Kubectl(t, "-n", "list-kinds-elsewhere", "get", "configmap", "list-elsewhere", "-o", "jsonpath={.metadata.name}")
+	require.NoError(t, err)
+	require.Equal(t, "list-elsewhere", kubectlOut)
+
+	// a namespace rendered inside a list is zarf's to own, so it carries the zarf labels
+	kubectlOut, _, err = e2e.Kubectl(t, "get", "namespace", "list-kinds-nested-ns", "-o=jsonpath={.metadata.labels.app\\.kubernetes\\.io/managed-by}")
+	require.NoError(t, err)
+	require.Equal(t, "zarf", kubectlOut)
+
+	stdOut, stdErr, err = e2e.Zarf(t, "package", "remove", "list-kinds", "--confirm")
+	require.NoError(t, err, stdOut, stdErr)
+
+	// zarf owns that namespace rather than helm, so removing the package leaves it behind instead
+	// of taking everything living in it with it. a namespace helm deleted would still answer with
+	// its name while terminating, so read the phase rather than the name
+	kubectlOut, _, err = e2e.Kubectl(t, "get", "namespace", "list-kinds-nested-ns", "-o", "jsonpath={.status.phase}")
+	require.NoError(t, err)
+	require.Equal(t, "Active", kubectlOut)
+}
```

**File**: `src/test/packages/25-list-kinds/chart/Chart.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+apiVersion: v2
+name: list-kinds
+description: A chart that renders its resources inside list kinds
+type: application
+version: 0.1.0
+appVersion: "1.0"
```

**File**: `src/test/packages/25-list-kinds/chart/templates/configmaps.yaml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+apiVersion: v1
+kind: ConfigMapList
+items:
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: list-one
+      namespace: {{ .Release.Namespace }}
+    data:
+      message: "first item of a ConfigMapList"
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: list-two
+      namespace: {{ .Release.Namespace }}
+      labels:
+        chart-owned: "true"
+    data:
+      message: "second item of a ConfigMapList"
+---
+apiVersion: v1
+kind: ConfigMapList
+items:
+  # zarf has to create this namespace before helm applies the item, which it can only do if it
+  # reads the namespace off the items rather than off the list
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: list-elsewhere
+      namespace: list-kinds-elsewhere
+    data:
+      message: "an item pointing at a namespace nothing else creates"
```

**File**: `src/test/packages/25-list-kinds/chart/templates/generic-list.yaml` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+apiVersion: v1
+kind: List
+items:
+  - apiVersion: v1
+    kind: ConfigMap
+    metadata:
+      name: generic-list-config
+      namespace: {{ .Release.Namespace }}
+    data:
+      message: "item of a generic List"
```

**File**: `src/test/packages/25-list-kinds/chart/templates/namespaces.yaml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+apiVersion: v1
+kind: NamespaceList
+items:
+  # zarf strips namespaces out of what helm applies so it owns them itself, which it can only do
+  # for an item if the list it came in is flattened first
+  - apiVersion: v1
+    kind: Namespace
+    metadata:
+      name: list-kinds-nested-ns
```

**File**: `src/test/packages/25-list-kinds/zarf.yaml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+kind: ZarfPackageConfig
+metadata:
+  name: list-kinds
+  version: 0.1.0
+
+components:
+  - name: list-kinds
+    required: true
+    charts:
+      - name: list-kinds
+        version: 0.1.0
+        namespace: list-kinds
+        localPath: chart
```

---

### Incident Patch 10: `9a1699ab` (2026-09-17)
**Commit Message**: fix!: move sbom viewer behind disabled feature flag (#5368)

Signed-off-by: Brandt Keller <[REDACTED_EMAIL]>

**File**: `src/pkg/feature/feature.go` (modified, +8/-0)
```diff
@@ -207,6 +207,7 @@ const (
 	RegistryProxy          Name = "registry-proxy"
 	Values                 Name = "values"
 	DockerDaemonDirectPull Name = "docker-daemon-direct-pull"
+	SBOMViewer             Name = "sbom-viewer"
 )
 
 func init() {
@@ -252,6 +253,13 @@ func init() {
 			Since:   "v0.80.0",
 			Stage:   GA,
 		},
+		{
+			Name:        SBOMViewer,
+			Description: "Enables deprecated SBOM viewer HTML generation during package creation.",
+			Enabled:     false,
+			Since:       "v0.86.0",
+			Stage:       Deprecated,
+		},
 	}
 
 	err := setDefault(features)
```

**File**: `src/pkg/packager/assemble/assemble_test.go` (modified, +2/-1)
```diff
@@ -787,8 +787,9 @@ func TestCreateAbsolutePathImports(t *testing.T) {
 	require.NoError(t, err)
 	require.FileExists(t, filepath.Join(importedFileComponent, "0", "file.txt"))
 
-	// Ensure the sbom exists as expected
+	// File-only packages include component SBOMs but not the deprecated viewer by default.
 	err = pkgLayout.GetSBOM(ctx, tmpdir)
 	require.NoError(t, err)
 	require.FileExists(t, filepath.Join(tmpdir, "zarf-component-file-import.json"))
+	require.NoFileExists(t, filepath.Join(tmpdir, "sbom-viewer-zarf-component-file-import.html"))
 }
```

**File**: `src/pkg/packager/assemble/sbom.go` (modified, +28/-17)
```diff
@@ -37,6 +37,7 @@ import (
 	"github.com/zarf-dev/zarf/src/api/v1alpha1"
 	"github.com/zarf-dev/zarf/src/config"
 	"github.com/zarf-dev/zarf/src/pkg/archive"
+	"github.com/zarf-dev/zarf/src/pkg/feature"
 	"github.com/zarf-dev/zarf/src/pkg/images"
 	"github.com/zarf-dev/zarf/src/pkg/logger"
 	"github.com/zarf-dev/zarf/src/pkg/packager/layout"
@@ -60,10 +61,13 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		err = errors.Join(err, os.RemoveAll(outputPath))
 	}()
 
+	sbomViewerEnabled := feature.IsEnabled(feature.SBOMViewer)
 	componentSBOMs := []string{}
-	for _, comp := range pkg.Components {
-		if len(comp.Files) > 0 || len(comp.DataInjections) > 0 {
-			componentSBOMs = append(componentSBOMs, comp.Name)
+	if sbomViewerEnabled {
+		for _, comp := range pkg.Components {
+			if len(comp.Files) > 0 || len(comp.DataInjections) > 0 {
+				componentSBOMs = append(componentSBOMs, comp.Name)
+			}
 		}
 	}
 	type imageSBOMTarget struct {
@@ -88,13 +92,16 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		}
 	}
 
-	identifiers := make([]string, 0, len(targets))
-	for _, t := range targets {
-		identifiers = append(identifiers, t.identifier)
-	}
-	jsonList, err := generateJSONList(componentSBOMs, identifiers)
-	if err != nil {
-		return err
+	var jsonList []byte
+	if sbomViewerEnabled {
+		identifiers := make([]string, 0, len(targets))
+		for _, t := range targets {
+			identifiers = append(identifiers, t.identifier)
+		}
+		jsonList, err = generateJSONList(componentSBOMs, identifiers)
+		if err != nil {
+			return err
+		}
 	}
 
 	for index, t := range targets {
@@ -103,13 +110,15 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		if err != nil {
 			return fmt.Errorf("failed to create image sbom: %w", err)
 		}
-		err = createSBOMViewerAsset(outputPath, t.identifier, b, jsonList)
-		if err != nil {
-			return err
+		if sbomViewerEnabled {
+			err = createSBOMViewerAsset(outputPath, t.identifier, b, jsonList)
+			if err != nil {
+				return err
+			}
 		}
 	}
 
-	// Generate SBOM for each component
+	// Generate SBOM for each component.
 	for _, comp := range pkg.Components {
 		if len(comp.DataInjections) == 0 && len(comp.Files) == 0 {
 			continue
@@ -118,9 +127,11 @@ func generateSBOM(ctx context.Context, pkg v1alpha1.ZarfPackage, buildPath strin
 		if err != nil {
 			return err
 		}
-		err = createSBOMViewerAsset(outputPath, fmt.Sprintf("%s%s", componentPrefix, comp.Name), jsonData, jsonList)
-		if err != nil {
-			return err
+		if sbomViewerEnabled {
+			err = createSBOMViewerAsset(outputPath, fmt.Sprintf("%s%s", componentPrefix, comp.Name), jsonData, jsonList)
+			if err != nil {
+				return err
+			}
 		}
 	}
 
```

**File**: `src/test/e2e/04_create_templating_test.go` (modified, +2/-14)
```diff
@@ -20,7 +20,6 @@ import (
 func TestCreateTemplating(t *testing.T) {
 	t.Log("E2E: Create Templating")
 
-	sbomPath := t.TempDir()
 	outPath := t.TempDir()
 	templatingPath := filepath.Join(outPath, fmt.Sprintf("zarf-package-templating-%s.tar.zst", e2e.Arch))
 	fileFoldersPath := filepath.Join(outPath, fmt.Sprintf("zarf-package-file-folders-templating-sbom-%s.tar.zst", e2e.Arch))
@@ -38,21 +37,10 @@ func TestCreateTemplating(t *testing.T) {
 	expectedConstant := v1alpha1.Constant{Name: "PODINFO_VERSION", Value: "6.4.0", Pattern: "^[\\w\\-\\.]+$"}
 	require.Contains(t, pkgLayout.AsV1alpha1().Constants, expectedConstant)
 
-	// Test that files and file folders template and handle SBOMs correctly
-	_, _, err = e2e.Zarf(t, "package", "create", "src/test/packages/04-file-folders-templating-sbom/", "-o", outPath, "--sbom-out", sbomPath, "--confirm")
+	// Test templating files and folders.
+	_, _, err = e2e.Zarf(t, "package", "create", "src/test/packages/04-file-folders-templating-sbom/", "-o", outPath, "--confirm")
 	require.NoError(t, err)
 
-	// Ensure that the `requirements.txt` files are discovered correctly
-	require.FileExists(t, filepath.Join(sbomPath, "file-folders-templating-sbom", "sbom-viewer-zarf-component-folders.html"))
-	foldersJSON, err := os.ReadFile(filepath.Join(sbomPath, "file-folders-templating-sbom", "zarf-component-folders.json"))
-	require.NoError(t, err)
-	require.Contains(t, string(foldersJSON), "numpy")
-	_, err = os.ReadFile(filepath.Join(sbomPath, "file-folders-templating-sbom", "sbom-viewer-zarf-component-files.html"))
-	require.NoError(t, err)
-	filesJSON, err := os.ReadFile(filepath.Join(sbomPath, "file-folders-templating-sbom", "zarf-component-files.json"))
-	require.NoError(t, err)
-	require.Contains(t, string(filesJSON), "pandas")
-
 	// Deploy the package and look for the variables in the output
 	workingPath := t.TempDir()
 	_, _, err = e2e.ZarfInDir(t, workingPath, "package", "deploy", fileFoldersPath, "--set", "DOGGO=doggy", "--set", "KITTEH=meowza", "--set", "PANDA=pandemonium", "--confirm")
```

**File**: `src/test/e2e/05_tarball_test.go` (modified, +0/-8)
```diff
@@ -408,10 +408,6 @@ func TestPackageTarballDirectoryStructure(t *testing.T) {
 			// |-- sboms
 			// |   |-- ghcr.io_stefanprodan_podinfo_6.4.0.json
 			// |   |-- ghcr.io_stefanprodan_podinfo_6.4.1.json
-			// |   |-- sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.0.html
-			// |   |-- sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.1.html
-			// |   |-- sbom-viewer-zarf-component-test-component-1.html
-			// |   |-- sbom-viewer-zarf-component-test-component-2.html
 			// |   |-- zarf-component-test-component-1.json
 			// |   `-- zarf-component-test-component-2.json
 			// `-- zarf.yaml
@@ -491,10 +487,6 @@ func TestPackageTarballDirectoryStructure(t *testing.T) {
 			wantFiles := []string{
 				"ghcr.io_stefanprodan_podinfo_6.4.0.json",
 				"ghcr.io_stefanprodan_podinfo_6.4.1.json",
-				"sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.0.html",
-				"sbom-viewer-ghcr.io_stefanprodan_podinfo_6.4.1.html",
-				"sbom-viewer-zarf-component-test-component-1.html",
-				"sbom-viewer-zarf-component-test-component-2.html",
 				"zarf-component-test-component-1.json",
 				"zarf-component-test-component-2.json",
 			}
```

**File**: `src/test/e2e/06_create_sbom_test.go` (modified, +58/-28)
```diff
@@ -21,55 +21,85 @@ func TestCreateSBOM(t *testing.T) {
 	t.Parallel()
 	ctx := testutil.TestContext(t)
 
-	outSbomPath := filepath.Join(t.TempDir(), ".sbom-location")
-	buildPath := t.TempDir()
-	tarPath := filepath.Join(buildPath, fmt.Sprintf("zarf-package-dos-games-%s-1.3.0.tar.zst", e2e.Arch))
+	const (
+		imageSBOM   = "ghcr.io_zarf-dev_doom-game_0.0.1.json"
+		sbomViewer  = "sbom-viewer-ghcr.io_zarf-dev_doom-game_0.0.1.html"
+		packageName = "dos-games"
+	)
 
-	expectedFiles := []string{
-		"sbom-viewer-ghcr.io_zarf-dev_doom-game_0.0.1.html",
-		"ghcr.io_zarf-dev_doom-game_0.0.1.json",
+	defaultSBOMPath := t.TempDir()
+	defaultBuildPath := t.TempDir()
+	defaultTarPath := filepath.Join(defaultBuildPath, fmt.Sprintf("zarf-package-%s-%s-1.3.0.tar.zst", packageName, e2e.Arch))
+
+	_, _, err := e2e.Zarf(t, "package", "create", "examples/dos-games", "-o", defaultBuildPath, "--sbom-out", defaultSBOMPath, "--confirm")
+	require.NoError(t, err)
+
+	defaultPkgLayout, err := layout.LoadFromTar(ctx, defaultTarPath, layout.PackageLayoutOptions{})
+	require.NoError(t, err)
+	defaultExtractPath := t.TempDir()
+	err = defaultPkgLayout.GetSBOM(ctx, defaultExtractPath)
+	require.NoError(t, err)
+	for _, sbomPath := range []string{defaultExtractPath, filepath.Join(defaultSBOMPath, packageName)} {
+		require.FileExists(t, filepath.Join(sbomPath, imageSBOM))
+		require.NoFileExists(t, filepath.Join(sbomPath, sbomViewer))
 	}
 
-	_, _, err := e2e.Zarf(t, "package", "create", "examples/dos-games", "-o", buildPath, "--sbom-out", outSbomPath, "--confirm")
+	legacySBOMPath := t.TempDir()
+	legacyBuildPath := t.TempDir()
+	legacyTarPath := filepath.Join(legacyBuildPath, fmt.Sprintf("zarf-package-%s-%s-1.3.0.tar.zst", packageName, e2e.Arch))
+	_, _, err = e2e.Zarf(t, "package", "create", "examples/dos-games", "-o", legacyBuildPath, "--features=sbom-viewer=true", "--sbom-out", legacySBOMPath, "--confirm")
 	require.NoError(t, err)
 
-	pkgLayout, err := layout.LoadFromTar(ctx, tarPath, layout.PackageLayoutOptions{})
+	legacyPkgLayout, err := layout.LoadFromTar(ctx, legacyTarPath, layout.PackageLayoutOptions{})
 	require.NoError(t, err)
-	getSbomPath := t.TempDir()
-	err = pkgLayout.GetSBOM(ctx, getSbomPath)
+	legacyExtractPath := t.TempDir()
+	err = legacyPkgLayout.GetSBOM(ctx, legacyExtractPath)
 	require.NoError(t, err)
-	for _, expectedFile := range expectedFiles {
-		require.FileExists(t, filepath.Join(getSbomPath, expectedFile))
-		require.FileExists(t, filepath.Join(outSbomPath, "dos-games", expectedFile))
+	for _, sbomPath := range []string{legacyExtractPath, filepath.Join(legacySBOMPath, packageName)} {
+		require.FileExists(t, filepath.Join(sbomPath, imageSBOM))
+		require.FileExists(t, filepath.Join(sbomPath, sbomViewer))
 	}
 
-	// Clean the SBOM path so it is force to be recreated
-	err = os.RemoveAll(outSbomPath)
+	fileSBOMPath := t.TempDir()
+	fileBuildPath := t.TempDir()
+	_, _, err = e2e.Zarf(t, "package", "create", "src/test/packages/04-file-folders-templating-sbom", "-o", fileBuildPath, "--features=sbom-viewer=true", "--sbom-out", fileSBOMPath, "--confirm")
 	require.NoError(t, err)
 
-	_, _, err = e2e.Zarf(t, "package", "inspect", "sbom", tarPath, "--output", outSbomPath)
+	fileSBOMDir := filepath.Join(fileSBOMPath, "file-folders-templating-sbom")
+	require.FileExists(t, filepath.Join(fileSBOMDir, "sbom-viewer-zarf-component-folders.html"))
+	foldersJSON, err := os.ReadFile(filepath.Join(fileSBOMDir, "zarf-component-folders.json"))
 	require.NoError(t, err)
+	require.Contains(t, string(foldersJSON), "numpy")
+	require.FileExists(t, filepath.Join(fileSBOMDir, "sbom-viewer-zarf-component-files.html"))
+	filesJSON, err := os.ReadFile(filepath.Join(fileSBOMDir, "zarf-component-files.json"))
+	require.NoError(t, err)
+	require.Contains(t, string(filesJSON), "pandas")
 
-	for _, expectedFile := range expectedFiles {
-		require.FileExists(t, filepath.Join(outSbomPath, "dos-games", expectedFile))
-	}
+	// Clean the SBOM path so it is forced to be recreated by inspect.
+	err = os.RemoveAll(defaultSBOMPath)
+	require.NoError(t, err)
+	_, _, err = e2e.Zarf(t, "package", "inspect", "sbom", defaultTarPath, "--output", defaultSBOMPath)
+	require.NoError(t, err)
+
+	// Test that we preserve the package-name directory.
+	require.FileExists(t, filepath.Join(defaultSBOMPath, packageName, imageSBOM))
+	require.NoFileExists(t, filepath.Join(defaultSBOMPath, packageName, sbomViewer))
 
-	stdOut, _, err := e2e.Zarf(t, "package", "inspect", "images", tarPath)
+	stdOut, _, err := e2e.Zarf(t, "package", "inspect", "images", defaultTarPath)
 	require.NoError(t, err)
 	require.Contains(t, stdOut, "- ghcr.io/zarf-dev/doom-game:0.0.1\n")
 
-	// Pull the current zarf binary version to find the corresponding init package
+	// Pull the current zarf binary version to find the corresponding init package.
 	version, _, err := e2e.Zarf(t, "version")
 	require.NoError(t, err)
 
 	initName := fmt.Sprintf("build/zarf-init-%s-%s.tar.zst", e2e.Arch, st
```

**File**: `src/test/e2e/23_data_injection_test.go` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ func TestDataInjection(t *testing.T) {
 	stdOut, stdErr, err = e2e.Zarf(t, "package", "inspect", "sbom", path, "--output", sbomPath)
 	require.NoError(t, err, stdOut, stdErr)
 
-	require.FileExists(t, filepath.Join(sbomPath, "data-injection", "sbom-viewer-zarf-component-file-server.html"), "The data-injection component should have an SBOM viewer")
+	require.NoFileExists(t, filepath.Join(sbomPath, "data-injection", "sbom-viewer-zarf-component-file-server.html"), "The data-injection component should not have an SBOM viewer by default")
 	require.FileExists(t, filepath.Join(sbomPath, "data-injection", "zarf-component-file-server.json"), "The data-injection component should have an SBOM json")
 }
 
```

---

### Incident Patch 11: `221c4f6c` (2026-09-16)
**Commit Message**: fix(values): infer integer and unknown schema types (#5334)

Signed-off-by: Gabe Scarberry <[REDACTED_EMAIL]>

**File**: `src/pkg/value/generate.go` (modified, +17/-5)
```diff
@@ -3,9 +3,7 @@
 
 package value
 
-import (
-	"fmt"
-)
+import "fmt"
 
 // GenerateJSONSchema infers a JSON schema from the structure and scalar types in values.
 func GenerateJSONSchema(vals Values) map[string]any {
@@ -31,14 +29,20 @@ func ReconcileJSONSchema(existing, inferred map[string]any, deleteNotFound bool)
 	typeVal, hasType := inferred["type"]
 	if hasType {
 		existing["type"] = typeVal
+	} else if deleteNotFound {
+		delete(existing, "type")
 	}
 
 	if schemaTypeIncludes(typeVal, "object") {
 		reconcileSchemaProperties(existing, inferred, deleteNotFound)
+	} else if deleteNotFound {
+		delete(existing, "properties")
 	}
 
 	if schemaTypeIncludes(typeVal, "array") {
 		reconcileSchemaItems(existing, inferred, deleteNotFound)
+	} else if deleteNotFound {
+		delete(existing, "items")
 	}
 
 	if schemaURI, ok := inferred["$schema"]; ok {
@@ -343,6 +347,9 @@ func isChartSchemaKeyword(key string) bool {
 func reconcileSchemaProperties(existing, inferred map[string]any, deleteNotFound bool) {
 	inferredProps, ok := inferred["properties"].(map[string]any)
 	if !ok {
+		if deleteNotFound {
+			delete(existing, "properties")
+		}
 		return
 	}
 
@@ -380,6 +387,9 @@ func reconcileSchemaProperties(existing, inferred map[string]any, deleteNotFound
 func reconcileSchemaItems(existing, inferred map[string]any, deleteNotFound bool) {
 	inferredItems, hasInferredItems := inferred["items"].(map[string]any)
 	if !hasInferredItems {
+		if deleteNotFound {
+			delete(existing, "items")
+		}
 		return
 	}
 
@@ -396,7 +406,9 @@ func inferSchemaType(v any) any {
 	switch val := v.(type) {
 	case string:
 		return map[string]any{"type": "string"}
-	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
+	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
+		return map[string]any{"type": "integer"}
+	case float32, float64:
 		return map[string]any{"type": "number"}
 	case bool:
 		return map[string]any{"type": "boolean"}
@@ -415,6 +427,6 @@ func inferSchemaType(v any) any {
 		}
 		return map[string]any{"type": "array"}
 	default:
-		return map[string]any{"type": "string"}
+		return map[string]any{}
 	}
 }
```

**File**: `src/pkg/value/generate_test.go` (modified, +100/-6)
```diff
@@ -13,10 +13,13 @@ import (
 func TestGenerateJSONSchema(t *testing.T) {
 	t.Run("infers nested types", func(t *testing.T) {
 		vals := Values{
-			"name":     "zarf",
-			"replicas": uint64(3),
-			"enabled":  true,
-			"ports":    []any{uint64(80)},
+			"name":        "zarf",
+			"replicas":    uint64(3),
+			"threshold":   0.75,
+			"percentage":  5.0,
+			"enabled":     true,
+			"ports":       []any{uint64(80)},
+			"annotations": nil,
 			"image": map[string]any{
 				"tag": "v1.2.3",
 			},
@@ -36,7 +39,15 @@ func TestGenerateJSONSchema(t *testing.T) {
 
 		replicas, ok := props["replicas"].(map[string]any)
 		require.True(t, ok)
-		assert.Equal(t, "number", replicas["type"])
+		assert.Equal(t, "integer", replicas["type"])
+
+		threshold, ok := props["threshold"].(map[string]any)
+		require.True(t, ok)
+		assert.Equal(t, "number", threshold["type"])
+
+		percentage, ok := props["percentage"].(map[string]any)
+		require.True(t, ok)
+		assert.Equal(t, "number", percentage["type"])
 
 		enabled, ok := props["enabled"].(map[string]any)
 		require.True(t, ok)
@@ -47,7 +58,11 @@ func TestGenerateJSONSchema(t *testing.T) {
 		assert.Equal(t, "array", ports["type"])
 		items, ok := ports["items"].(map[string]any)
 		require.True(t, ok)
-		assert.Equal(t, "number", items["type"])
+		assert.Equal(t, "integer", items["type"])
+
+		annotations, ok := props["annotations"].(map[string]any)
+		require.True(t, ok)
+		assert.Empty(t, annotations)
 
 		image, ok := props["image"].(map[string]any)
 		require.True(t, ok)
@@ -60,6 +75,85 @@ func TestGenerateJSONSchema(t *testing.T) {
 	})
 }
 
+func TestReconcileJSONSchemaUnknownType(t *testing.T) {
+	existing := map[string]any{
+		"type":        "object",
+		"description": "preserve this",
+		"properties":  map[string]any{"name": map[string]any{"type": "string"}},
+		"items":       map[string]any{"type": "string"},
+	}
+
+	preserved := ReconcileJSONSchema(existing, map[string]any{}, false)
+	assert.Equal(t, existing, preserved)
+
+	pruned := ReconcileJSONSchema(existing, map[string]any{}, true)
+	assert.Equal(t, map[string]any{"description": "preserve this"}, pruned)
+}
+
+func TestReconcileJSONSchemaPrunesStaleStructure(t *testing.T) {
+	tests := []struct {
+		name     string
+		existing map[string]any
+		inferred map[string]any
+	}{
+		{
+			name: "object to array",
+			existing: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"name": map[string]any{"type": "string"}},
+			},
+			inferred: map[string]any{
+				"type":  "array",
+				"items": map[string]any{"type": "integer"},
+			},
+		},
+		{
+			name: "array to object",
+			existing: map[string]any{
+				"type":  "array",
+				"items": map[string]any{"type": "string"},
+			},
+			inferred: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"enabled": map[string]any{"type": "boolean"}},
+			},
+		},
+		{
+			name: "empty object",
+			existing: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"name": map[string]any{"type": "string"}},
+			},
+			inferred: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{},
+			},
+		},
+		{
+			name: "object without properties",
+			existing: map[string]any{
+				"type":       "object",
+				"properties": map[string]any{"name": map[string]any{"type": "string"}},
+			},
+			inferred: map[string]any{"type": "object"},
+		},
+		{
+			name: "empty array",
+			existing: map[string]any{
+				"type":  "array",
+				"items": map[string]any{"type": "string"},
+			},
+			inferred: map[string]any{"type": "array"},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			assert.Equal(t, tc.inferred, ReconcileJSONSchema(tc.existing, tc.inferred, true))
+		})
+	}
+}
+
 func TestMergeJSONSchemaAtPathPreservesNullableObjects(t *testing.T) {
 	schema := GenerateJSONSchema(Values{
 		"serviceAccount": map[string]any{
```

**File**: `src/test/e2e/14_zarf_package_generate_test.go` (modified, +5/-2)
```diff
@@ -71,7 +71,6 @@ func TestZarfDevGenerate(t *testing.T) {
 
 		aReplicas, ok := appProps["replicas"].(map[string]any)
 		require.True(t, ok)
-		// .app.replicas should take the type 'number' from the parent values.yaml
 		require.Equal(t, "number", aReplicas["type"])
 		// .app.replicas should take the description from the parent values.schema.json
 		require.Equal(t, "Replica count", aReplicas["description"])
@@ -90,7 +89,6 @@ func TestZarfDevGenerate(t *testing.T) {
 
 		bReplicas, ok := backendProps["replicaCount"].(map[string]any)
 		require.True(t, ok)
-		// .backend.replicas should take the type 'number' from the child values.yaml
 		require.Equal(t, "number", bReplicas["type"])
 		// .backend.replicas should take the description from the child values.schema.json
 		require.Equal(t, "Replica count", bReplicas["description"])
@@ -128,6 +126,11 @@ func TestZarfDevGenerate(t *testing.T) {
 			require.Equal(t, "string", additionalProperties["type"])
 		}
 
+		fallback, ok := props["fallback"].(map[string]any)
+		require.True(t, ok)
+		require.NotContains(t, fallback, "type")
+		require.Equal(t, "Value without an inferred type", fallback["description"])
+
 		// .backend.image should be dropped because it is excluded from the chart mapping.
 		_, hasExcludedImage := backendProps["image"]
 		require.False(t, hasExcludedImage)
```

**File**: `src/test/packages/14-generate-schema/chart/values.yaml` (modified, +2/-0)
```diff
@@ -8,3 +8,5 @@ image:
 configMap:
   annotations:
   labels:
+
+fallback:
```

**File**: `src/test/packages/14-generate-schema/values.schema.json` (modified, +5/-1)
```diff
@@ -16,9 +16,13 @@
         }
       }
     },
+    "fallback": {
+      "type": "string",
+      "description": "Value without an inferred type"
+    },
     "oldField": {
       "type": "string",
       "description": "Should be removed"
     }
   }
-}
\ No newline at end of file
+}
```

**File**: `src/test/packages/14-generate-schema/zarf.yaml` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@ components:
             targetPath: ".configMap.annotations"
           - sourcePath: ".configMap.labels"
             targetPath: ".configMap.labels"
+          - sourcePath: ".fallback"
+            targetPath: ".fallback"
   
   - name: backend-chart
     required: true
```

---

### Incident Patch 12: `9545b01b` (2026-09-15)
**Commit Message**: fix: interactive template prompts on create (#5362)

Signed-off-by: Austin Abro <[REDACTED_EMAIL]>

**File**: `src/pkg/packager/load/load.go` (modified, +7/-5)
```diff
@@ -111,10 +111,7 @@ func resolve(ctx context.Context, packagePath string, opts DefinitionOptions) (r
 		if err != nil {
 			return resolution{}, err
 		}
-		if err := validatePackageSchemaV1Alpha1(pkg.Metadata.Name, b, opts.SetVariables); err != nil {
-			return resolution{}, err
-		}
-		defined, err = v1alpha1Resolution(ctx, pkg, pkgPath, opts)
+		defined, err = v1alpha1Resolution(ctx, pkg, pkgPath, b, opts)
 		if err != nil {
 			return resolution{}, err
 		}
@@ -126,7 +123,7 @@ func resolve(ctx context.Context, packagePath string, opts DefinitionOptions) (r
 	return defined, nil
 }
 
-func v1alpha1Resolution(ctx context.Context, pkg v1alpha1.ZarfPackage, pkgPath layout.PackagePath, opts DefinitionOptions) (resolution, error) {
+func v1alpha1Resolution(ctx context.Context, pkg v1alpha1.ZarfPackage, pkgPath layout.PackagePath, rawPackage []byte, opts DefinitionOptions) (resolution, error) {
 	pkg.Metadata.Architecture = config.GetArch(pkg.Metadata.Architecture)
 	var err error
 	opts.CachePath, err = utils.ResolveCachePath(opts.CachePath)
@@ -150,6 +147,11 @@ func v1alpha1Resolution(ctx context.Context, pkg v1alpha1.ZarfPackage, pkgPath l
 			return resolution{}, err
 		}
 	}
+	// Validate the original document so fields discarded while decoding are still
+	// Done after package templates have been resolved and prompted.
+	if err := validatePackageSchemaV1Alpha1(pkg.Metadata.Name, rawPackage, opts.SetVariables); err != nil {
+		return resolution{}, err
+	}
 	if err := validateV1alpha1(ctx, pkg, pkgPath.ManifestFile, opts.Flavor); err != nil {
 		return resolution{}, err
 	}
```

**File**: `src/pkg/packager/load/load_test.go` (modified, +24/-3)
```diff
@@ -447,9 +447,9 @@ components:
 		dir := t.TempDir()
 		zarfYAML := `kind: ZarfPackageConfig
 metadata:
-  name: test
+  name: "###ZARF_PKG_TMPL_MYVAR###"
 components:
-  - name: test
+  - name: "###ZARF_PKG_TMPL_MYVAR###"
     required: true
     actions:
       onCreate:
@@ -460,6 +460,27 @@ components:
 		_, err := PackageDefinition(ctx, dir, DefinitionOptions{
 			SetVariables: map[string]string{}, // non-nil triggers fillActiveTemplate; MYVAR is absent
 		})
-		require.ErrorContains(t, err, "MYVAR")
+		require.ErrorContains(t, err, `template "MYVAR" must be '--set' when using the '--confirm' flag`)
+	})
+
+	t.Run("resolves package and component names from package templates", func(t *testing.T) {
+		t.Parallel()
+		dir := t.TempDir()
+		zarfYAML := `kind: ZarfPackageConfig
+metadata:
+  name: "###ZARF_PKG_TMPL_MYVAR###"
+components:
+  - name: "###ZARF_PKG_TMPL_MYVAR###"
+    required: true
+`
+		require.NoError(t, os.WriteFile(filepath.Join(dir, "zarf.yaml"), []byte(zarfYAML), 0o600))
+
+		defined, err := PackageDefinition(ctx, dir, DefinitionOptions{
+			SetVariables: map[string]string{"MYVAR": "test-package"},
+		})
+		require.NoError(t, err)
+		pkg := defined.AsV1alpha1()
+		require.Equal(t, "test-package", pkg.Metadata.Name)
+		require.Equal(t, "test-package", pkg.Components[0].Name)
 	})
 }
```

---

### Incident Patch 13: `22bbb458` (2026-09-14)
**Commit Message**: fix: differing Windows `files` basenames on Linux and Windows (#5359)

Signed-off-by: Wayne Starr <[REDACTED_EMAIL]>

**File**: `src/pkg/packager/layout/layout.go` (modified, +5/-1)
```diff
@@ -6,8 +6,10 @@ package layout
 
 import (
 	"fmt"
+	"path"
 	"path/filepath"
 	"strconv"
+	"strings"
 )
 
 // Constants used in the default package layout.
@@ -71,7 +73,9 @@ func KustomizationFileName(manifestName string, idx int) string {
 // ComponentFileRelPath returns the path, relative to a component's files directory, where the idx-th
 // file's contents are stored.
 func ComponentFileRelPath(idx int, target string) string {
-	return filepath.Join(strconv.Itoa(idx), filepath.Base(target))
+	// replace Windows \ paths with / so that *nix-created packages resolve the same Windows target filename
+	target = strings.ReplaceAll(target, `\`, "/")
+	return filepath.Join(strconv.Itoa(idx), path.Base(target))
 }
 
 // chartStem is the name both of a chart's packaged artifacts are built from:
```

**File**: `src/pkg/packager/layout/layout_test.go` (modified, +17/-3)
```diff
@@ -49,7 +49,21 @@ func TestManifestFileNames(t *testing.T) {
 func TestComponentFileRelPath(t *testing.T) {
 	t.Parallel()
 
-	require.Equal(t, filepath.Join("0", "nginx.conf"), ComponentFileRelPath(0, "/etc/nginx/nginx.conf"),
-		"only the target's base name is kept")
-	require.Equal(t, filepath.Join("2", "data.txt"), ComponentFileRelPath(2, "data.txt"))
+	tests := []struct {
+		name   string
+		idx    int
+		target string
+		want   string
+	}{
+		{name: "POSIX path", idx: 0, target: "/etc/app/file.txt", want: filepath.Join("0", "file.txt")},
+		{name: "Windows path", idx: 1, target: `C:\app\file.txt`, want: filepath.Join("1", "file.txt")},
+		{name: "Windows path with forward slashes", idx: 2, target: "C:/app/file.txt", want: filepath.Join("2", "file.txt")},
+		{name: "file name", idx: 3, target: "file.txt", want: filepath.Join("3", "file.txt")},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			require.Equal(t, tt.want, ComponentFileRelPath(tt.idx, tt.target))
+		})
+	}
 }
```

---

### Incident Patch 14: `aad1ab64` (2026-09-11)
**Commit Message**: docs: fix typo in airgap git URL rewrite sentence (#5342)

Signed-off-by: Adam <[REDACTED_EMAIL]>

**File**: `site/src/content/docs/faq.mdx` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ components:
     - git://somegithost.com/zarf.git
 ```
 
-In the airgap, Zarf with rewrite these URLs to match the scheme and host of the provided airgap `git` server.
+In the airgap, Zarf will rewrite these URLs to match the scheme and host of the provided airgap `git` server.
 
 :::note
 
```

---

### Incident Patch 15: `46018cff` (2026-09-10)
**Commit Message**: fix: introduce more randomization in the fuzzers (#5275)

Signed-off-by: Maciej Szulik <[REDACTED_EMAIL]>

**File**: `src/internal/api/v1alpha1/roundtrip_test.go` (modified, +7/-2)
```diff
@@ -17,6 +17,11 @@ import (
 	"github.com/zarf-dev/zarf/src/test/testutil"
 )
 
+// defaultFuzzIterations specifies number of fuzzing iterations, higher number
+// will quickly raise the time needed to run them. The 20 iterations balances
+// time (currently <60s) with coverage.
+const defaultFuzzIterations = 20
+
 // TestConvertGenericRoundTripLossless asserts that decoding a v1alpha1 package, converting it to
 // the generic representation and back, reproduces the original exactly. layout and zoci load built
 // v1alpha1 packages through this round-trip, so any drift would change packages across build hosts
@@ -158,7 +163,7 @@ func TestConvertGenericRoundTripFuzz(t *testing.T) {
 	t.Parallel()
 
 	rng := rand.New(rand.NewSource(1))
-	for i := range 1000 {
+	for i := range defaultFuzzIterations {
 		var pkg v1alpha1.ZarfPackage
 		testutil.FillValue(reflect.ValueOf(&pkg).Elem(), rng)
 
@@ -180,7 +185,7 @@ func TestConvertV1alpha1V1beta1RoundTripFuzz(t *testing.T) {
 	t.Parallel()
 
 	rng := rand.New(rand.NewSource(1))
-	for i := range 1000 {
+	for i := range defaultFuzzIterations {
 		var pkg v1alpha1.ZarfPackage
 		testutil.FillValue(reflect.ValueOf(&pkg).Elem(), rng)
 		populateValidV1alpha1ChartSources(&pkg, rng, i)
```

**File**: `src/internal/api/v1beta1/roundtrip_test.go` (modified, +7/-2)
```diff
@@ -17,6 +17,11 @@ import (
 	"github.com/zarf-dev/zarf/src/test/testutil"
 )
 
+// defaultFuzzIterations specifies number of fuzzing iterations, higher number
+// will quickly raise the time needed to run them. The 20 iterations balances
+// time (currently <20s) with coverage.
+const defaultFuzzIterations = 20
+
 // TestConvertGenericRoundTripLossless asserts that a v1beta1 package converted to the generic
 // representation and back reproduces the original exactly. layout and zoci load built packages
 // through this round-trip, so any drift would change packages across build hosts.
@@ -194,7 +199,7 @@ func TestConvertGenericRoundTripFuzz(t *testing.T) {
 	t.Parallel()
 
 	rng := rand.New(rand.NewSource(1))
-	for i := range 1000 {
+	for i := range defaultFuzzIterations {
 		var pkg v1beta1.Package
 		testutil.FillValue(reflect.ValueOf(&pkg).Elem(), rng)
 
@@ -253,7 +258,7 @@ func TestConvertV1beta1V1alpha1RoundTripFuzz(t *testing.T) {
 	t.Parallel()
 
 	rng := rand.New(rand.NewSource(1))
-	for i := range 1000 {
+	for i := range defaultFuzzIterations {
 		var pkg v1beta1.Package
 		testutil.FillValue(reflect.ValueOf(&pkg).Elem(), rng)
 		// Valid repository url with only one source so that it can roundtrip
```

**File**: `src/test/testutil/fuzz.go` (modified, +35/-9)
```diff
@@ -4,9 +4,24 @@
 package testutil
 
 import (
-	"fmt"
 	"math/rand"
 	"reflect"
+	"strings"
+)
+
+const (
+	// maxElements specifies maximum number of elements in array/slice
+	maxElements = 10
+	// maxStringLen specifies maximum string length
+	maxStringLen = 20
+
+	// the following unicode range covers:
+	// - Latin-1 Supplement (0x00A0–0x00FF),
+	// - Latin Extended-A (0x0100–0x017F),
+	// - Latin Extended-B (0x0180–0x024F),
+	// - IPA Extensions (0x0250–0x02AF).
+	unicodeRangeLo = 0x00A0
+	unicodeRangeHi = 0x02AF
 )
 
 // FillValue recursively populates v for round-trip fuzz tests. Struct fields that cannot be set via
@@ -21,25 +36,26 @@ func FillValue(v reflect.Value, rng *rand.Rand) {
 		case 1:
 			v.Set(reflect.New(v.Type().Elem()))
 			return
+		default:
+			v.Set(reflect.New(v.Type().Elem()))
+			FillValue(v.Elem(), rng)
 		}
-		v.Set(reflect.New(v.Type().Elem()))
-		FillValue(v.Elem(), rng)
 	case reflect.Struct:
 		for i := range v.NumField() {
 			if f := v.Field(i); f.CanSet() {
 				FillValue(f, rng)
 			}
 		}
 	case reflect.Slice:
-		n := 1 + rng.Intn(2)
+		n := 1 + rng.Intn(maxElements)
 		s := reflect.MakeSlice(v.Type(), n, n)
 		for i := range n {
 			FillValue(s.Index(i), rng)
 		}
 		v.Set(s)
 	case reflect.Map:
 		m := reflect.MakeMap(v.Type())
-		for range 1 + rng.Intn(2) {
+		for range 1 + rng.Intn(maxElements) {
 			key := reflect.New(v.Type().Key()).Elem()
 			FillValue(key, rng)
 			val := reflect.New(v.Type().Elem()).Elem()
@@ -48,14 +64,24 @@ func FillValue(v reflect.Value, rng *rand.Rand) {
 		}
 		v.Set(m)
 	case reflect.String:
-		v.SetString(fmt.Sprintf("s%d", rng.Intn(1<<30)))
+		v.SetString(randString(rng, rng.Intn(maxStringLen)))
 	case reflect.Bool:
 		v.SetBool(rng.Intn(2) == 1)
 	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
-		v.SetInt(int64(1 + rng.Intn(1000)))
+		v.SetInt(int64(rng.Int31()))
 	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
-		v.SetUint(uint64(1 + rng.Intn(1000)))
+		v.SetUint(uint64(rng.Uint32()))
 	case reflect.Float32, reflect.Float64:
-		v.SetFloat(float64(1 + rng.Intn(1000)))
+		v.SetFloat(rng.Float64())
+	}
+}
+
+func randString(rng *rand.Rand, n int) string {
+	var sb strings.Builder
+	span := int(unicodeRangeHi-unicodeRangeLo) + 1
+	for range n {
+		r := unicodeRangeLo + rune(rng.Intn(span))
+		sb.WriteRune(r)
 	}
+	return sb.String()
 }
```

#### Recent Merged Pull Requests:
- **PR #5435** (2026-10-04): chore(deps): bump the codeql group with 3 updates (@dependabot[bot])
- **PR #5434** (2026-10-04): chore(deps): bump devalue from 5.8.1 to 5.9.4 in /site (@dependabot[bot])
- **PR #5420** (2026-09-29): chore(deps-dev): bump undici from 7.29.0 to 7.30.0 in /site (@dependabot[bot])
- **PR #5419** (2026-10-04): chore(deps): bump markdown-it and markdownlint-cli2 in /site (@dependabot[bot])
- **PR #5418** (2026-10-02): feat(get-creds): only print credentials for configured services (@AustinAbro321)
- **PR #5417** (2026-09-29): feat!: disable artifact server by default (@AustinAbro321)
- **PR #5414** (closed): chore(deps): bump js-yaml and markdownlint-cli2 in /site (@dependabot[bot])
- **PR #5413** (2026-09-30): feat(dev): add --components flag to dev inspect values-files (@dalehenries)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
