# Forensic Learning Record (Deep Inspection): Kong/kubernetes-ingress-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/kong-kubernetes-ingress-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kong/kubernetes-ingress-controller](https://github.com/Kong/kubernetes-ingress-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:59:10.249Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kong/kubernetes-ingress-controller`
- **Description**: :gorilla: Kong for Kubernetes: The official Ingress Controller for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2414 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hack/cleanup/gke_clusters.go`
```
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	container "cloud.google.com/go/container/apiv1"
	"cloud.google.com/go/container/apiv1/containerpb"
	"github.com/go-logr/logr"
	"google.golang.org/api/option"

	"github.com/kong/kubernetes-ingress-controller/v3/test/e2e"
)

const timeUntilClusterOrphaned = time.Hour

func cleanupGKEClusters(ctx context.Context, log logr.Logger) error {
	var creds map[string]string
	if err := json.Unmarshal([]byte(gkeCreds), &creds); err != nil {
		return fmt.Errorf("invalid credentials: %w", err)
	}

	credsOpt := option.WithAuthCredentialsJSON(option.ServiceAccount, []byte(gkeCreds))
	mgrc, err := container.NewClusterManagerClient(ctx, credsOpt)
	if err != nil {
		return fmt.Errorf("failed to create cluster manager client: %w", err)
	}
	defer mgrc.Close()

	clusterNames, err := findOrphanedClusters(ctx, log, mgrc)
	if err != nil {
		return fmt.Errorf("could not find orphaned clusters: %w", err)
	}

	if len(clusterNames) < 1 {
		log.Info("No clusters to clean up")
		return nil
	}

	var errs []error
	for _, clusterName := range clusterNames {
		log.Info("Cleaning up cluster", "name", clusterName)
		err := deleteCluster(ctx, mgrc, gkeProject, gkeLocation, clusterName)
		if err != nil {
			errs = append(errs, err)
			continue
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to cleanup all clusters: %w", errors.Join(errs...))
	}

	return nil
}

func deleteCluster(ctx context.Context, mgrc *container.ClusterManagerClient, project, location, name string) error {
	fullname := fmt.Sprintf("projects/%s/locations/%s/clusters/%s", project, location, name)
	op, err := mgrc.DeleteCluster(ctx, &containerpb.DeleteClusterRequest{Name: fullname})
	if err != nil {
		return fmt.Errorf("failed to call delete cluster for %q: %w", name, err)
	}
	if op.Error != nil {
		return fmt.Errorf("failed to remove cluster %q: %s", name, op.Error)
	}

	return nil
}

func findOrphanedClusters(ctx context.Context, log logr.Logger, mgrc *container.ClusterManagerClient) ([]string, error) {
	clusterListReq := containerpb.ListClustersRequest{
		Parent: fmt.Sprintf("projects/%s/locations/%s", gkeProject, gkeLocation),
	}
	clusterListResp, err := mgrc.ListClusters(ctx, &clusterListReq)
	if err != nil {
		return nil, err
	}

	var orphanedClusterNames []string
	for _, cluster := range clusterListResp.Clusters {
		if !e2e.IsGKETestCluster(cluster) {
			log.Info("Non test cluster found and skipped", "name", cluster.Name, "built_at", cluster.GetCreateTime())
			continue
		}

		createdAt, err := time.Parse(time.RFC3339, cluster.CreateTime)
		if err != nil {
			return nil, err
		}

		orphanTime := createdAt.Add(timeUntilClusterOrphaned)
		if time.Now().UTC().After(orphanTime) {
			orphanedClusterNames = append(orphanedClusterNames, cluster.Name)
		} else {
			log.Info("Cluster skipped", "name", cluster.Name, "build_in_last", timeUntilClusterOrphaned)
		}
	}

	return orphanedClusterNames, nil
}

```

### Core Architecture Module: `hack/cleanup/konnect_control_planes.go`
```
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/go-logr/logr"
	"github.com/samber/lo"

	sdkkonnectgo "github.com/Kong/sdk-konnect-go"
	sdkkonnectops "github.com/Kong/sdk-konnect-go/models/operations"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/konnect/sdk"
	"github.com/kong/kubernetes-ingress-controller/v3/test"
)

const (
	konnectControlPlanesLimit     = int64(100)
	timeUntilControlPlaneOrphaned = time.Hour
)

// cleanupKonnectControlPlanes deletes orphaned control planes created by the tests and their roles.
func cleanupKonnectControlPlanes(ctx context.Context, log logr.Logger) error {
	// NOTE: The domain for global endpoints is overridden in cleanup.yaml workflow.
	// See https://github.com/Kong/sdk-konnect-go/issues/20 for details
	sdk := sdk.New(konnectAccessToken,
		sdkkonnectgo.WithServerURL(test.KonnectServerURL()),
	)

	me, err := sdk.Me.GetUsersMe(ctx)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}
	if me.User == nil || me.User.ID == nil {
		return errors.New("failed to get user info, user is nil")
	}

	orphanedCPs, err := findOrphanedControlPlanes(ctx, log, sdk.ControlPlanes)
	if err != nil {
		return fmt.Errorf("failed to find orphaned control planes: %w", err)
	}
	if err := deleteControlPlanes(ctx, log, sdk.ControlPlanes, orphanedCPs); err != nil {
		return fmt.Errorf("failed to delete control planes: %w", err)
	}

	userID := *me.User.ID

	// We have to manually delete roles created for the control plane because Konnect doesn't do it automatically.
	// If we don't do it, we will eventually hit a problem with Konnect APIs answering our requests with 504s
	// because of a performance issue when there's too many roles for the account
	// (see https://konghq.atlassian.net/browse/TPS-1319).
	//
	// We can drop this once the automated cleanup is implemented on Konnect side:
	// https://konghq.atlassian.net/browse/TPS-1453.
	rolesToDelete, err := findOrphanedRolesToDelete(ctx, log, sdk.Roles, orphanedCPs, userID)
	if err != nil {
		return fmt.Errorf("failed to list control plane roles to delete: %w", err)
	}
	if err := deleteRoles(ctx, log, sdk.Roles, *me.User.ID, rolesToDelete); err != nil {
		return fmt.Errorf("failed to delete control plane roles: %w", err)
	}

	return nil
}

// findOrphanedControlPlanes finds control planes that were created by the tests and are older than timeUntilControlPlaneOrphaned.
func findOrphanedControlPlanes(
	ctx context.Context,
	log logr.Logger,
	c *sdkkonnectgo.ControlPlanes,
) ([]string, error) {
	response, err := c.ListControlPlanes(ctx, sdkkonnectops.ListControlPlanesRequest{
		PageSize: lo.ToPtr(konnectControlPlanesLimit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list control planes: %w", err)
	}
	if response.ListControlPlanesResponse == nil {
		body, err := io.ReadAll(response.RawResponse.Body)
		if err != nil {
			body = []byte(err.Error())
		}
		return nil, fmt.Errorf("failed to list control planes, status: %d, body: %s", response.GetStatusCode(), body)
	}

	var orphanedControlPlanes []string
	for _, ControlPlane := range response.ListControlPlanesResponse.Data {
		if ControlPlane.Labels[test.KonnectControlPlaneLabelCreatedInTests] != "true" {
			log.Info("Control plane was not created by the tests, skipping", "name", ControlPlane.Name)
			continue
		}
		if ControlPlane.CreatedAt.IsZero() {
			log.Info("Control plane has no creation timestamp, skipping", "name", ControlPlane.Name)
			continue
		}
		orphanedAfter := ControlPlane.CreatedAt.Add(timeUntilControlPlaneOrphaned)
		if !time.Now().After(orphanedAfter) {
			log.Info("Control plane is not old enough to be considered orphaned, skipping",
				"name", ControlPlane.Name, "created_at", ControlPlane.CreatedAt,
			)
			continue
		}
		orphanedControlPlanes = append(orphanedControlPlanes, ControlPlane.ID)
	}
	return orphanedControlPlanes, nil
}

// deleteControlPlanes deletes control planes by their IDs.
func deleteControlPlanes(
	ctx context.Context,
	log logr.Logger,
	sdk *sdkkonnectgo.ControlPlanes,
	cpsIDs []string,
) error {
	if len(cpsIDs) < 1 {
		log.Info("No control planes to clean up")
		return nil
	}

	var errs []error
	for _, cpID := range cpsIDs {
		log.Info("Deleting control plane", "name", cpID)
		if _, err := sdk.DeleteControlPlane(ctx, cpID); err != nil {
			errs = append(errs, fmt.Errorf("failed to delete control plane %s: %w", cpID, err))
		}
	}
	return errors.Join(errs...)
}

// findOrphanedRolesToDelete gets a list of roles that belong to the orphaned control planes.
func findOrphanedRolesToDelete(
	ctx context.Context,
	log logr.Logger,
	sdk *sdkkonnectgo.Roles,
	orphanedCPsIDs []string,
	userID string,
) ([]string, error) {
	if len(orphanedCPsIDs) < 1 {
		log.Info("No control planes to clean up, skipping listing roles")
		return nil, nil
	}

	resp, err := sdk.ListUserRoles(ctx, userID,
		// NOTE: Sadly we can't do filtering here (yet?) because ListUserRolesQueryParamFilter
		// can only match by exact name and we match against a list of orphaned control plane IDs.
		&sdkkonnectops.ListUserRolesQueryParamFilter{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list user roles: %w", err)
	}

	if resp == nil || resp.AssignedRoleCollection == nil {
		return nil, errors.New("failed to list user roles, response is nil")
	}

	var rolesIDsToDelete []string
	for _, role := range resp.AssignedRoleCollection.GetData() {
		log.Info("User role", "id", role.ID, "entity_id", role.EntityID)
		belongsToOrphanedControlPlane := lo.ContainsBy(orphanedCPsIDs, func(cpID string) bool {
			if role.EntityID == nil {
				return false
			}
			return cpID == *role.EntityID
		})
		if !belongsToOrphanedControlPlane {
			continue
		}
		rolesIDsToDelete = append(rolesIDsToDelete, *role.ID)
	}

	return rolesIDsToDelete, nil
}

// deleteRoles deletes roles by their IDs.
func deleteRoles(
	ctx context.Context,
	log logr.Logger,
	sdk *sdkkonnectgo.Roles,
	userID string,
	rolesIDsToDelete []string,
) error {
	if len(rolesIDsToDelete) == 0 {
		log.Info("No roles to delete")
		return nil
	}

	var errs []error
	for _, roleID := range rolesIDsToDelete {
		log.Info("Deleting role", "id", roleID)
		_, err := sdk.UsersRemoveRole(ctx, userID, roleID)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to delete role %s: %w", roleID, err))
		}
	}

	return errors.Join(errs...)
}

```

### Core Architecture Module: `hack/cleanup/main.go`
```
// This script cleans up orphaned GKE clusters and Konnect runtime
// groups that were created by the e2e tests (caued by e.g. unexpected
// crash that didn't allow a test's teardown to be completed correctly).
// It's meant to be installed as a cronjob and run repeatedly throughout
// the day to catch any orphaned resources: however tests should be trying to
// delete the resources they create themselves.
//
// A cluster is considered orphaned when all conditions are satisfied:
// 1. Its name begins with a predefined prefix (`gke-e2e-`).
// 2. It was created more than 1h ago.
//
// A control plane is considered orphaned when all conditions are satisfied:
// 1. It has a label `created_in_tests` with value `true`.
// 2. It was created more than 1h ago.
//
// Usage: `go run ./hack/cleanup [mode]`
// Where `mode` is one of:
// - `all` (default): clean up both GKE clusters and Konnect control planes
// - `gke`: clean up only GKE clusters
// - `konnect`: clean up only Konnect control planes
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/go-logr/logr"
	"github.com/go-logr/zapr"
	"github.com/kong/kubernetes-testing-framework/pkg/clusters/types/gke"
	"go.uber.org/zap"
)

const (
	konnectAccessTokenVar = "TEST_KONG_KONNECT_ACCESS_TOKEN" //nolint:gosec

	cleanupModeAll     = "all"
	cleanupModeGKE     = "gke"
	cleanupModeKonnect = "konnect"
)

var (
	gkeCreds           = os.Getenv(gke.GKECredsVar)
	gkeProject         = os.Getenv(gke.GKEProjectVar)
	gkeLocation        = os.Getenv(gke.GKELocationVar)
	konnectAccessToken = os.Getenv(konnectAccessTokenVar)
)

func main() {
	zaplog, err := zap.NewDevelopment()
	if err != nil {
		os.Exit(1)
	}
	log := zapr.NewLogger(zaplog)

	mode, err := getCleanupMode()
	if err != nil {
		log.Error(err, "error getting cleanup mode")
		os.Exit(1)
	}

	if err := validateVars(mode); err != nil {
		log.Error(err, "error validating vars")
		os.Exit(1)
	}

	cleanupFuncs := resolveCleanupFuncs(mode)
	ctx := context.Background()
	for _, f := range cleanupFuncs {
		if err := f(ctx, log); err != nil {
			log.Error(err, "error running cleanup function")
			os.Exit(1)
		}
	}
}

func getCleanupMode() (string, error) {
	if len(os.Args) < 2 {
		return cleanupModeAll, nil
	}

	switch os.Args[1] {
	case cleanupModeGKE:
	case cleanupModeKonnect:
	default:
		return "", fmt.Errorf("invalid cleanup mode: %s", os.Args[1])
	}

	return os.Args[1], nil
}

func resolveCleanupFuncs(mode string) []func(context.Context, logr.Logger) error {
	switch mode {
	case cleanupModeGKE:
		return []func(context.Context, logr.Logger) error{
			cleanupGKEClusters,
		}
	case cleanupModeKonnect:
		return []func(context.Context, logr.Logger) error{
			cleanupKonnectControlPlanes,
		}
	default:
		return []func(context.Context, logr.Logger) error{
			cleanupGKEClusters,
			cleanupKonnectControlPlanes,
		}
	}
}

func validateVars(mode string) error {
	switch mode {
	case cleanupModeGKE:
		return validateGKEVars()
	case cleanupModeKonnect:
		return validateKonnectVars()
	default:
		if err := validateGKEVars(); err != nil {
			return err
		}
		if err := validateKonnectVars(); err != nil {
			return err
		}
		return nil
	}
}

func validateKonnectVars() error {
	return notEmpty(konnectAccessTokenVar, konnectAccessToken)
}

func validateGKEVars() error {
	if err := notEmpty(gke.GKECredsVar, gkeCreds); err != nil {
		return err
	}
	if err := notEmpty(gke.GKEProjectVar, gkeProject); err != nil {
		return err
	}
	return notEmpty(gke.GKELocationVar, gkeLocation)
}

func notEmpty(name, value string) error {
	if value == "" {
		return fmt.Errorf("%s was empty", name)
	}
	return nil
}

```

### Core Architecture Module: `hack/generators/cache-stores/main.go`
```
package main

import (
	"bytes"
	"fmt"
	"os"
	"text/template"

	"github.com/Masterminds/sprig/v3"
	"github.com/samber/lo"
)

type cacheStoreSupportedType struct {
	// Type is the name of the type that the store supports (e.g. Ingress, Service, etc.).
	Type string

	// Package is the package name of the type (e.g. gatewayapi, netv1, etc.).
	Package string

	// KeyFunc is a function to be used as the type's store's KeyFunc.
	// Defaults to `namespacedKeyFunc` if not provided.
	KeyFunc string

	// StoreField is the name of the field in the CacheStores struct that holds the cache store.
	// Optional: if not provided, the field name will be the same as the type name.
	StoreField string
}

const (
	clusterWideKeyFunc string = "clusterWideKeyFunc"
)

func main() {
	lo.Must0(renderTemplate(cacheStoresTemplate, cacheStoresOutputFile))
	lo.Must0(renderTemplate(cacheStoresTestTemplate, cacheStoresTestOutputFile))
}

func renderTemplate(templateContent string, outputFile string) error {
	tpl, err := template.New("tpl").Funcs(sprig.TxtFuncMap()).Parse(templateContent)
	if err != nil {
		return fmt.Errorf("failed to parse template for %s: %w", outputFile, err)
	}
	contents := &bytes.Buffer{}
	if err := tpl.Execute(contents, supportedTypes); err != nil {
		return fmt.Errorf("failed to execute template for %s: %w", outputFile, err)
	}
	if err := os.WriteFile(outputFile, contents.Bytes(), 0o600); err != nil {
		return fmt.Errorf("failed to write file %s: %w", outputFile, err)
	}
	return nil
}

```

### Core Architecture Module: `hack/generators/cache-stores/templates.go`
```
package main

const (
	cacheStoresOutputFile = "zz_generated.cache_stores.go"
	cacheStoresTemplate   = `// Code generated by hack/generators/cache-stores/main.go; DO NOT EDIT.
// If you want to add a new type to the cache store, you need to add a new entry to the supportedTypes list in spec.go.
package store

import (
	"fmt"
	"sync"

	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	netv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
	kongv1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1"
	kongv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1alpha1"
	kongv1beta1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1beta1"
	incubatorv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/incubator/v1alpha1"

)

// CacheStores stores cache.Store for all Kinds of k8s objects that
// the Ingress Controller reads.
type CacheStores struct {
	{{- range . }}
	{{ .StoreField | default .Type }} cache.Store
	{{- end }}

	l *sync.RWMutex
}

// NewCacheStores is a convenience function for CacheStores to initialize all attributes with new cache stores.
func NewCacheStores() CacheStores {
	return CacheStores{
		{{- range . }}
		{{ .StoreField | default .Type }}: cache.NewStore({{ if eq .KeyFunc "clusterWideKeyFunc" }}clusterWideKeyFunc{{ else }}namespacedKeyFunc{{ end }}),
		{{- end }}

		l: &sync.RWMutex{},
	}
}

// Get checks whether or not there's already some version of the provided object present in the cache.
func (c CacheStores) Get(obj runtime.Object) (item interface{}, exists bool, err error) {
	c.l.RLock()
	defer c.l.RUnlock()

	switch obj := obj.(type) {
	{{- range . }}
	case *{{ .Package }}.{{ .Type }}:
		return c.{{ .StoreField | default .Type }}.Get(obj)
	{{- end }}
	}
	return nil, false, fmt.Errorf("%T is not a supported cache object type", obj)
}

// Add stores a provided runtime.Object into the CacheStore if it's of a supported type.
// The CacheStore must be initialized (see NewCacheStores()) or this will panic.
func (c CacheStores) Add(obj runtime.Object) error {
	c.l.Lock()
	defer c.l.Unlock()

	switch obj := obj.(type) {
	{{- range . }}
	case *{{ .Package }}.{{ .Type }}:
		return c.{{ .StoreField | default .Type }}.Add(obj)
	{{- end }}
	}
	return fmt.Errorf("cannot add unsupported kind %q to the store", obj.GetObjectKind().GroupVersionKind())
}

// Delete removes a provided runtime.Object from the CacheStore if it's of a supported type.
// The CacheStore must be initialized (see NewCacheStores()) or this will panic.
func (c CacheStores) Delete(obj runtime.Object) error {
	c.l.Lock()
	defer c.l.Unlock()

	switch obj := obj.(type) {
	{{- range . }}
	case *{{ .Package }}.{{ .Type }}:
		return c.{{ .StoreField | default .Type }}.Delete(obj)
	{{- end }}
	}
	return fmt.Errorf("cannot delete unsupported kind %q from the store", obj.GetObjectKind().GroupVersionKind())
}

// ListAllStores returns a list of all cache stores embedded in the struct.
func (c CacheStores) ListAllStores() []cache.Store {
	return []cache.Store{
		{{- range . }}
		c.{{ .StoreField | default .Type }},
		{{- end }}
	}
}

// SupportedTypes returns a list of supported types for the cache.
func (c CacheStores) SupportedTypes() []client.Object {
	return []client.Object{
		{{- range . }}
		&{{ .Package }}.{{ .Type }}{},
		{{- end }}
	}
}
`

	cacheStoresTestOutputFile = "zz_generated.cache_stores_test.go"
	cacheStoresTestTemplate   = `// Code generated by hack/generators/cache-stores/main.go; DO NOT EDIT.
// If you want to add a new type to the cache store, you need to add a new entry to the supportedTypes list in spec.go.
package store_test

import (
	"testing"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
	kongv1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1"
	kongv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1alpha1"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	netv1 "k8s.io/api/networking/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/store"
	kongv1beta1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1beta1"
	incubatorv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/incubator/v1alpha1"
)

func TestCacheStores(t *testing.T) {
	testCases := []struct {
		name          string
		objectToStore client.Object
	}{
		{{ range . }}
		{
			name: "{{ .Type }}",
			objectToStore: &{{ .Package }}.{{ .Type }}{},
		},
		{{ end }}
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := store.NewCacheStores()
			err := s.Add(tc.objectToStore)
			require.NoError(t, err)

			storedObj, ok, err := s.Get(tc.objectToStore)
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, tc.objectToStore, storedObj)

			err = s.Delete(tc.objectToStore)
			require.NoError(t, err)

			_, ok, err = s.Get(tc.objectToStore)
			require.NoError(t, err, err)
			require.False(t, ok)
		})
	}
}
`
)

```

### Core Architecture Module: `hack/generators/controllers/networking/main.go`
```
package main

import (
	"bytes"
	"fmt"
	"os"
	"text/template"

	"github.com/Masterminds/sprig/v3"
)

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

const (
	outputFile = "../../internal/controllers/configuration/zz_generated.controllers.go"

	corev1      = "k8s.io/api/core/v1"
	discoveryv1 = "k8s.io/api/discovery/v1"
	netv1       = "k8s.io/api/networking/v1"

	kongv1       = "github.com/kong/kubernetes-configuration/v2/api/configuration/v1"
	kongv1beta1  = "github.com/kong/kubernetes-ingress-controller/v3/api/configuration/v1beta1"
	kongv1alpha1 = "github.com/kong/kubernetes-ingress-controller/v3/api/configuration/v1alpha1"

	incubatorv1alpha1 = "github.com/kong/kubernetes-ingress-controller/v3/api/incubator/v1alpha1"
)

// inputControllersNeeded is a list of the supported Types for the
// Kong Kubernetes Ingress Controller. If you need to add a new type
// for support, add it here and a new controller will be generated
// when you run `make controllers`.
var inputControllersNeeded = &typesNeeded{
	typeNeeded{
		Group:                             "\"\"",
		Version:                           "v1",
		Kind:                              "Service",
		PackageImportAlias:                "corev1",
		PackageAlias:                      "CoreV1",
		Package:                           corev1,
		Plural:                            "services",
		CacheType:                         "Service",
		NeedsStatusPermissions:            true,
		AcceptsIngressClassNameAnnotation: false,
		AcceptsIngressClassNameSpec:       false,
		NeedsUpdateReferences:             true,
		RBACVerbs:                         []string{"get", "list", "watch"},
	},
	typeNeeded{
		Group:                             "discovery.k8s.io",
		Version:                           "v1",
		Kind:                              "EndpointSlice",
		PackageImportAlias:                "discoveryv1",
		PackageAlias:                      "DiscoveryV1",
		Package:                           discoveryv1,
		Plural:                            "endpointslices",
		CacheType:                         "EndpointSlice",
		NeedsStatusPermissions:            false,
		AcceptsIngressClassNameAnnotation: false,
		AcceptsIngressClassNameSpec:       false,
		RBACVerbs:                         []string{"list", "watch"},
	},
	typeNeeded{
		Group:                             "networking.k8s.io",
		Version:                           "v1",
		Kind:                              "Ingress",
		PackageImportAlias:                "netv1",
		PackageAlias:                      "NetV1",
		Package:                           netv1,
		Plural:                            "ingresses",
		CacheType:                         "IngressV1",
		NeedsStatusPermissions:            true,
		ConfigStatusNotificationsEnabled:  true,
		IngressAddressUpdatesEnabled:      true,
		AcceptsIngressClassNameAnnotation: true,
		AcceptsIngressClassNameSpec:       true,
		NeedsUpdateReferences:             true,
		RBACVerbs:                         []string{"get", "list", "watch"},
	},
	typeNeeded{
		Group:                             "networking.k8s.io",
		Version:                           "v1",
		Kind:                              "IngressClass",
		PackageImportAlias:                "netv1",
		PackageAlias:                      "NetV1",
		Package:                           netv1,
		Plural:                            "ingressclasses",
		CacheType:                         "IngressV1",
		NeedsStatusPermissions:            false,
		AcceptsIngressClassNameAnnotation: false,
		AcceptsIngressClassNameSpec:       false,
		RBACVerbs:                         []string{"get", "list", "watch"},
	},
	typeNeeded{
		Group:                             "configuration.konghq.com",
		Version:                           "v1",
		Kind:                              "KongIngress",
		PackageImportAlias:                "kongv1",
		PackageAlias:                      "KongV1",
		Package:                           kongv1,
		Plural:                            "kongingresses",
		CacheType:                         "KongIngress",
		NeedsStatusPermissions:            true,
		AcceptsIngressClassNameAnnotation: false,
		AcceptsIngressClassNameSpec:       false,
		RBACVerbs:                         []string{"get", "list", "watch"},
	},
	typeNeeded{
		Group:                            "configuration.konghq.com",
		Version:                          "v1",
		Kind:                             "KongPlugin",
		PackageImportAlias:               "kongv1",
		PackageAlias:                     "KongV1",
		Package:                          kongv1,
		Plural:                           "kongplugins",
		CacheType:                        "Plugin",
		NeedsStatusPermissions:           true,
		ConfigStatusNotificationsEnabled: false, // TODO: https://github.com/Kong/kubernetes-ingress-controller/issues/4578
		ProgrammedCondition: ProgrammedConditionConfiguration{
			UpdatesEnabled: false, // TODO: https://github.com/Kong/kubernetes-ingress-controller/issues/4578
		},
		AcceptsIngressClassNameAnnotation: false,
		AcceptsIngressClassNameSpec:       false,
		NeedsUpdateReferences:             true,
		RBACVerbs:                         []string{"get", "list", "watch"},
	},
	typeNeeded{
		Group:                            "configuration.konghq.com",
		Version:                          "v1",
		Kind:                             "KongClusterPlugin",
		PackageImportAlias:               "kongv1",
		PackageAlias:                     "KongV1",
		Package:                          kongv1,
		Plural:                           "kongclusterplugins",
		CacheType:                        "ClusterPlugin",
		NeedsStatusPermissions:           true,
		ConfigStatusNotificationsEnabled: false, // TODO true after https://github.com/Kong/kubernetes-ingress-controller/issues/4578
		ProgrammedCondition: ProgrammedConditionConfiguration{
			UpdatesEnabled: false, // TODO: https://github.com/Kong/kubernetes-ingress-controller/issues/4578
		},
		AcceptsIngressClassNameAnnotation: true,
		AcceptsIngressClassNameSpec:       false,
		NeedsUpdateReferences:             true,
		RBACVerbs:                         []string{"get", "list", "watch"},
	},
	typeNeeded{
		Group:                             "configuration.konghq.com",
		Version:                           "v1",
		Kind:                              "KongConsumer",
		PackageImportAlias:                "kongv1",
		PackageAlias:                      "KongV1",
		Package:                           kongv1,
		Plural:                            "kongconsumers",
		CacheType:                         "Consumer",
		NeedsStatusPermissions:            true,
		AcceptsIngressClassNameAnnotation: true,
		AcceptsIngressClassNameSpec:       false,
		NeedsUpdateReferences:             true,
		RBACVerbs:                         []string{"get", "list", "watch"},
		ConfigStatusNotificationsEnabled:  true,
		ProgrammedCondition: ProgrammedConditionConfiguration{
			UpdatesEnabled: true,
		},
		HasControlPlaneReference: true,
	},
	typeNeeded{
		Group:                            "configuration.konghq.com",
		Version:                          "v1beta1",
		Kind:                             "KongConsumerGroup",
		PackageImportAlias:               "kongv1beta1",
		PackageAlias:                     "KongV1Beta1",
		Package:                          kongv1beta1,
		Plural:                           "kongconsumergroups",
		CacheType:                        "ConsumerGroup",
		NeedsStatusPermissions:           true,
		ConfigStatusNotificationsEnabled: true,
		ProgrammedCondition: ProgrammedConditionConfiguration{
			UpdatesEnabled: true,
		},
		AcceptsIngressClassNameAnnotation: true,
		AcceptsIngressClassNameSpec:       false,
		NeedsUpdateReferences:             true,
		RBACVerbs:                         []string{"get", "list", "watch"},
		HasControlPlaneReference:          true,
	},
	typeNeeded{
		Group:                          
```

### Core Architecture Module: `internal/adminapi/backoff_strategy.go`
```
package adminapi

// UpdateBackoffStrategy keeps state of an update backoff strategy.
type UpdateBackoffStrategy interface {
	// CanUpdate tells whether we're allowed to make an update attempt for a given config hash.
	// In case it returns false, the second return value is a human-readable explanation of why the update cannot
	// be performed at this point in time.
	CanUpdate([]byte) (bool, string)

	// RegisterUpdateSuccess resets the backoff strategy, effectively making it allow next update straight away.
	RegisterUpdateSuccess()

	// RegisterUpdateFailure registers an update failure along with its failure reason passed as a generic error, and
	// a config hash that we failed to push.
	RegisterUpdateFailure(failureReason error, configHash []byte)
}

```

### Core Architecture Module: `internal/adminapi/backoff_strategy_konnect.go`
```
package adminapi

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jpillora/backoff"
	"github.com/kong/go-kong/kong"
	"github.com/samber/lo"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/dataplane/deckerrors"
)

const (
	KonnectBackoffInitialInterval = time.Second * 3
	KonnectBackoffMaxInterval     = time.Minute * 15
	KonnectBackoffMultiplier      = 2
)

type Clock interface {
	Now() time.Time
}

// KonnectBackoffStrategy keeps track of Konnect config push backoffs.
//
// It takes into account:
// - a regular exponential backoff that is incremented on every Update failure,
// - a last failed configuration hash (where we skip Update until a config changes).
//
// It's important to note that KonnectBackoffStrategy can use the latter (config hash)
// because of the nature of the one-directional integration where KIC is the only
// component responsible for populating configuration of Konnect's Control Plane.
// In case that changes in the future (e.g. manual modifications to parts of the
// configuration are allowed on Konnect side for some reason), we might have to
// drop this part of the backoff strategy.
type KonnectBackoffStrategy struct {
	b                    *backoff.Backoff
	nextAttempt          time.Time
	clock                Clock
	lastFailedConfigHash []byte

	lock sync.RWMutex
}

func NewKonnectBackoffStrategy(clock Clock) *KonnectBackoffStrategy {
	exponentialBackoff := &backoff.Backoff{
		Min:    KonnectBackoffInitialInterval,
		Max:    KonnectBackoffMaxInterval,
		Factor: KonnectBackoffMultiplier,
	}
	exponentialBackoff.Reset()

	return &KonnectBackoffStrategy{
		b:     exponentialBackoff,
		clock: clock,
	}
}

func (s *KonnectBackoffStrategy) CanUpdate(configHash []byte) (bool, string) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	// The exponential backoff duration is satisfied.
	// In case of the first attempt it will be satisfied as s.nextAttempt will be a zero value which is always in the past.
	timeLeft := s.nextAttempt.Sub(s.clock.Now())
	exponentialBackoffSatisfied := timeLeft <= 0

	// The configuration we're attempting to update is not the same faulty config we've already tried pushing.
	isTheSameFaultyConfig := s.lastFailedConfigHash != nil && bytes.Equal(s.lastFailedConfigHash, configHash)

	// In case both conditions are satisfied, we're good to make an attempt.
	if exponentialBackoffSatisfied && !isTheSameFaultyConfig {
		return true, ""
	}

	// Otherwise, we build a human-readable explanation of why the update cannot be performed at this point in time.
	return false, s.whyCannotUpdate(timeLeft, isTheSameFaultyConfig)
}

func (s *KonnectBackoffStrategy) RegisterUpdateFailure(err error, configHash []byte) {
	s.lock.Lock()
	defer s.lock.Unlock()

	apiErrs := deckerrors.ExtractAPIErrors(err)
	tooManyRequestsErr, isTooManyRequests := lo.Find(apiErrs, func(err *kong.APIError) bool {
		return err.Code() == http.StatusTooManyRequests
	})
	if isTooManyRequests {
		s.handleTooManyRequests(tooManyRequestsErr)
		return
	}

	isClientError := lo.ContainsBy(apiErrs, func(err *kong.APIError) bool {
		return err.Code() >= 400 && err.Code() < 500
	})
	if isClientError {
		s.handleGenericClientError(configHash)
		return
	}

	// If it's neither of the specific cases above, we just increment the standard exponential backoff.
	s.incrementExponentialBackoff()
}

func (s *KonnectBackoffStrategy) RegisterUpdateSuccess() {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.b.Reset()
	s.nextAttempt = time.Time{}
	s.lastFailedConfigHash = nil
}

func (s *KonnectBackoffStrategy) handleTooManyRequests(tooManyRequestsErr *kong.APIError) {
	if details, ok := tooManyRequestsErr.Details().(kong.ErrTooManyRequestsDetails); ok && details.RetryAfter != 0 {
		// In case we get 429 with details embedded, we just retry after the suggested Retry-After time.
		s.nextAttempt = s.clock.Now().Add(details.RetryAfter)
	} else {
		// In case the details for 429 are missing, we retry after the standard exponential backoff time.
		s.incrementExponentialBackoff()
	}

	// Despite whether we've got details or not, we prune the last failed config hash to not block update after the
	// period we set up above.
	s.lastFailedConfigHash = nil
}

func (s *KonnectBackoffStrategy) handleGenericClientError(configHash []byte) {
	// We increment the standard exponential backoff time and store the faulty config hash to prevent pushing it again.
	s.incrementExponentialBackoff()
	s.lastFailedConfigHash = configHash
}

func (s *KonnectBackoffStrategy) incrementExponentialBackoff() {
	// Backoff.Duration() call returns backoff time we need to wait until next attempt.
	// It also increments the internal attempts counter so the next time we call it, the
	// duration will be multiplied accordingly.
	timeLeft := s.b.Duration()

	// We're storing the exact point in time after which we'll be allowed to perform the next update attempt.
	s.nextAttempt = s.clock.Now().Add(timeLeft)
}

func (s *KonnectBackoffStrategy) whyCannotUpdate(
	timeLeft time.Duration,
	isTheSameFaultyConfig bool,
) string {
	var reasons []string

	if isTheSameFaultyConfig {
		reasons = append(reasons, fmt.Sprintf(
			"Config has to be changed: %q hash has already failed to be pushed with a client error",
			hex.EncodeToString(s.lastFailedConfigHash),
		))
	}

	if timeLeft > 0 {
		reasons = append(reasons, fmt.Sprintf("next attempt allowed in %s", timeLeft))
	}

	return strings.Join(reasons, ", ")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7869** (2026-06-12): **3.4.12 breaks clusters with Kong OSS (3.9)**
  *Symptoms*: Hi, while I can understand you are pivoting business model and [deprecating the Kong OSS & free versions](https://github.com/Kong/kong/discussions/14628), it seems you released a version of KIC breaking all the clusters running Kong v3.9.  However, from the PR in question (#7853), you knew this would happen (cf. https://github.com/Kong/kubernetes-ingress-controller/blob/247aeb9006abd52f92ae6d7ee306842bae098a54/internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer-ee/note.txt).  You still proceeded without any care for anyone working in the field, and released your backwards-incompatible version as a **patch** that would auto-update with the default tag in the Helm chart being `3.4`.  This kind of predatory behavior is one you should be ashamed of.  ---  For anyone stumbling into this issue, the fix is to lock the KIC to the `3.4.11` tag, maybe even with the hash to prevent any further breakage from upstream.  Further remediation will be to completely switch away from this software altogether.
  **Post-Mortem & Fix Analysis**:
  > This caused some significant downtime for our test environment yesterday, and it's only by sheer luck that it didn't happen in production. Not only is it insane to release a breaking change in a patch release, but the `kong` chart only pins the minor version in the image tag for the controller! As Helm themselves say [in their docs](https://helm.sh/docs/chart_best_practices/pods#images), the image tag should not be "floating".
  > This broke our production for several hours. 😢
  > The change that caused this (https://github.com/Kong/kubernetes-ingress-controller/pull/7853) has been merged to mitigate an issue (https://github.com/Kong/kubernetes-ingress-controller/issues/7831) which has been inaccurately triaged: it aimed to fix a related issue which only affected 3.9.x versions where an invalid part of the config (e.g. invalid CA) would cause errors for SNIs with certificate backreference. SNI certificate backreferences are optional in 3.10.x (they are not required in db less mode) and later versions of Kong but are required in 3.9 and older (due to a bug which was fixed in 3.10) hence this only breaking 3.9 (or older versions).  We've released [3.4.13](https://github.com/Kong/kubernetes-ingress-controller/releases/tag/v3.4.13) (and will release 3.5.6) reverting aforementioned change to mitigate the issue for 3.9.x users.  I'm going to leave this open for a while to monitor if there are any further reports about this. 

- **Issue #7859** (2026-03-16): **`protocols` field in transalated Kong routes are not set when expression based routes enbled**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  From FTI-7350. In the expression based translator, KIC does not add the `protocols` field but uses the default value. In Kong gateway 3.14+ the default protocols for routes changed to `https` only. So when running with expression based router, the integration/e2e tests fails.  ### Expected Behavior  The integration/e2e tests against Kong 3.14 passes.  ### Steps To Reproduce  ```markdown  Run integration tests/e2e tests with Kong gateway 3.14.x: $ export TEST_KONG_IMAGE="kong/kong-gateway-dev" $ export TEST_KONG_TAG="3.14.0.0-rc.1" $ export TEST_KONG_EFFECTIVE_VERSION="3.14.0" $ make test.integration.dbless   ```  ### Kong Ingress Controller version  ```shell 3.4.x ```  ### Kubernetes version  ```shell  ```  ### Anything else?  _No response_

- **Issue #7855** (2026-03-13): **KIC 3.5.4 — Liveness/Readiness probes failing: dial tcp :10254: connect: connection refused**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  In Kong Ingress Controller 3.5.4, the container repeatedly fails both liveness and readiness probes: Liveness probe failed: dial tcp :10254: connect: connection refused Readiness probe failed: dial tcp :10254: connect: connection refused  This results in the controller going into CrashLoopBackOff. The issue happens immediately after pod start — the controller never opens port 10254, which is the expected health endpoint. i have open the network policy for both pods still same issue and kong-proxy-server is up and running   ### Expected Behavior  _No response_  ### Steps To Reproduce  ```markdown  ```  ### Kong Ingress Controller version  ```shell Environment  KIC Version: 3.5.4 (Confirmed from Docker Hub / release tags) Image: kong/kubernetes-ingress-controller:3.5.4 Kubernetes: eks 1.32 Helm Chart: no , manual deployment  Kong Gateway: 3.9.1 ```  ### Kubernetes version  ```shell 1.32 ```  ### Anything else?  _No response_
  **Post-Mortem & Fix Analysis**:
  > @mullasaddam Could you please provide the manifests to deploy KIC? I think it should be a misconfiugration in the manifests.

- **Issue #7831** (2026-02-11): **KIC 3.4.0+ sets certificate foreign key on nested SNIs causing "value must be null" rejection in DB-less mode**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  When KIC pushes declarative config to Kong Gateway in DB-less mode, all certificate entities with nested SNIs are rejected by the gateway with the error "value must be null" at the entity   level. This causes a full sync failure -- both the primary config push and the fallback recovery fail with HTTP 400, putting the controller in an endless error loop. No Kubernetes Events   are emitted for these errors because the certificate entities lack k8s metadata tags in the error response.    The root cause is PR #6660 (commit 9517268c9, shipped in KIC 3.4.0), which sets an explicit certificate back-reference on nested SNI objects in internal/dataplane/deckgen/deckgen.go:50-64:  ```   if kongCert.ID != nil {       kongSNI.Certificate = &kong.Certificate{           ID: kongCert.ID,       }   } ```    In DB-less/declarative mode, Kong's schema transformation (kong/db/schema/others/declarative_config.lua) enforces eq = null on all foreign key fields in nested entities, because the   parent-child relationship is already implied by the nesting. The explicit certificate.id back-reference on nested SNIs violates this constraint.  ### Expected Behavior  The certificate foreign key field on nested SNIs should be omitted (or set to null) when generating declarative config for DB-less mode. The back-reference is redundant in declarative   config since the SNI is already nested inside its p
  **Post-Mortem & Fix Analysis**:
  > This is still issue in 3.5.4
  > No users of DB-less mode? Kong is useless because of this.
  > https://github.com/Kong/kubernetes-ingress-controller/pull/7853 should fix this.

- **Issue #7825** (2026-03-20): **429 Happens in Reconciliation with Konnect**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  When the configuration is large enough (~100k services), the uploading of configuration to Konnect gets the 429 response and the requests keeps being retried. So the configuration cannot be updated on Konnect in time and Konnect receives a high load of requests.  ### Expected Behavior  Requests are sent to Konnect in a proper rate and does not trigger `429`s.  ### Steps To Reproduce  ```markdown  ```  ### Kong Ingress Controller version  ```shell  ```  ### Kubernetes version  ```shell  ```  ### Anything else?  Possible resolutions: - Reduce the concurrency of KIC uploading config to Konnect - Increase the default interval of uploading config to Konnect ~- Interrupt the retries when new round of uploading starts~

- **Issue #7822** (2026-02-06): **Kong gateway Listeners incorrect on hybrid mode**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  When I have   - 1  Control plane -  4 Dataplane - 1 Ingress Controller  The Ingress Controller tries to retrieve the proxy_listeners & stream_listeners from admin_api,   When I ran the call on the Control Plane it returns me :   ```  "proxy_listeners": {}, "stream_listeners": {}, "stream_proxy_ssl_enabled": false, "admin_gui_ssl_enabled": true ```  This call is made by the API Gateway Controller here :  https://github.com/Kong/kubernetes-ingress-controller/blob/92b4ae93001cfec26df4b5a9a58008d30d568be8/internal/dataplane/kong_client.go#L351C33-L362  This behavior is rejecting all my Gateway since KIC v3.5.2 with this status :   ``` spec:   gatewayClassName: kong-ingress   listeners:     - allowedRoutes:         namespaces:           from: All       name: proxy-ssl       port: 8443       protocol: HTTPS       tls:         certificateRefs:           - group: ''             kind: Secret             name: proxy-certificate         mode: Terminate status:   addresses:     - type: IPAddress       value: 0.0.0.0   conditions:     - lastTransitionTime: '2026-01-19T13:16:50Z'       message: this unmanaged gateway has been picked up by the controller and will be processed       observedGeneration: 1       reason: Accepted       status: 'True'       type: Accepted     - lastTransitionTime: '2026-01-19T13:16:50Z'       message: ''       observedGeneration: 1       reason: Programmed 
  **Post-Mortem & Fix Analysis**:
  > Seems to be linked with the modifications made on Kong Gateway v3.13.0.0 here  kong/conf_loader/init.lua  ```   if conf.role == "control_plane" then     -- control plane does not accept proxy traffic, so we disable those listeners     conf.proxy_listen = {"off"}     conf.stream_listen = {"off"}   end ```  
  > Fixed in v3.13.0.1

- **Issue #7819** (2026-01-10): **configuration.konghq.com/v1 KongIngress is deprecated**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  We are testing an upgrade of Kong API Gateway from: kong: 3.6 kubernetes-ingress-controller: 3.2 to: kong: 3.9 kubernetes-ingress-controller: 3.5 After the upgrade, we see the following warnings in the ingress-controller logs: `2026-01-09T14:12:17Z info controller-runtime.cache Warning: configuration.konghq.com/v1beta1 TCPIngress is deprecated {"v": 0}` ` 2026-01-09T14:13:20Z info controller-runtime.cache Warning: configuration.konghq.com/v1beta1 UDPIngress is deprecated {"v": 0}` ` 2026-01-09T14:14:54Z info controller-runtime.cache Warning: configuration.konghq.com/v1 KongIngress is deprecated {"v": 0}`  We do not use the KongIngress object anymore — we have migrated all its configuration to Ingress annotations. However, if we look at custom-resource-definitions.yaml, we can see that these CRDs are still present:  https://github.com/Kong/charts/blob/kong-3.0.2/charts/kong/crds/custom-resource-definitions.yaml#L1096 https://github.com/Kong/charts/blob/kong-3.0.2/charts/kong/crds/custom-resource-definitions.yaml#L3007 https://github.com/Kong/charts/blob/kong-3.0.2/charts/kong/crds/custom-resource-definitions.yaml#L3222  My understanding is that the ingress-controller checks for the presence of these CRDs and emits deprecation warnings even if the corresponding resources are not actually used. Is it expected behavior? Would it make sense (or be recommended) to remove these
  **Post-Mortem & Fix Analysis**:
  > You can get rid of those deprecation notices via the following values:  ``` controller:   ingressController:     env:       enable_controller_kongingress: "false"       enable_controller_tcpingress: "false"       enable_controller_udpingress: "false" ```  Conventionally, deprecated CRDs are kept because their removal would cause issues for users who keep using them (have objects of their types defined in their clusters).  Removing a CRD causes all the CRs of its type to be removed from the system which is considered a breaking behavior (and 3.5 is not a major release to do so).  Hope this clears things up. Since there's no action to perform I'm going to close this. Let us know if there's still something to clarify.
  > @pmalek  this worked thank you

- **Issue #7813** (2025-12-16): **Kong Ingress Controller Restart Loop - Leader Election Timeouts in Gateway Discovery Mode**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  Our team is using the following versions in gateway discovery mode: - Kong Ingress Controller: 2.12.8 - Kong Proxy: 3.3.1 We're experiencing frequent pod restarts (over 40 times in the past two days) due to leader election timeouts with the following error: ``` E1215 07:20:42.964371 1 leaderelection.go:369] Failed to update lock: Put "https://$api_server:443/apis/coordination.k8s.io/v1/namespaces/kong/leases/api-gateway": context deadline exceeded  I1215 07:20:42.964417 1 leaderelection.go:285] failed to renew lease kong/api-gateway: timed out waiting for the condition ``` Our Kong ingress controller has the following probe settings: ```yaml livenessProbe:   failureThreshold: 5   httpGet:     path: /healthz     port: healthz     scheme: HTTP   initialDelaySeconds: 5   periodSeconds: 30   successThreshold: 1   timeoutSeconds: 5 readinessProbe:   failureThreshold: 5   httpGet:     path: /readyz     port: healthz     scheme: HTTP   initialDelaySeconds: 5   periodSeconds: 30   successThreshold: 1   timeoutSeconds: 5 ```  Root Cause Analysis: -  Missing lease configuration: We need exposed lease configuration options to tune leader election behavior  ### Expected Behavior  The leader election can work as expected; the default setting is too aggressive.  ### Requested Changes  1. Add a toggle to control client-side rate limiting (to accommodate the [v0.21.0 breaking change](ht
  **Post-Mortem & Fix Analysis**:
  > Hi @yang-wang11 👋   Thanks for the issue (and the accompanying PR) 🙇  This does seem like a good idea to include the LE configuration knobs but at this moment we're not planning to include any new features to KIC. Further development is being done in KO now: https://github.com/Kong/kong-operator/.  I'm going to close this one for now. I've already created https://github.com/Kong/kong-operator/issues/2894 to track this in KO. Feel free to drop a comment there.

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

### Incident Patch 1: `b6da030f` (2026-09-20)
**Commit Message**: fix(test): Pass kong-effective-version to e2e in validating Kong image tests and fix GKEtest failures (#8089)

* pass kong-effective-version to e2e

* fix istio workflow

* list only live pods

* Use e2-standard-4 node to fix OOMs

**File**: `.github/workflows/_e2e_tests.yaml` (modified, +1/-0)
```diff
@@ -464,6 +464,7 @@ jobs:
           TEST_KONG_LOAD_IMAGES: ${{ inputs.load-local-image }}
           TEST_KONG_IMAGE: ${{ steps.split.outputs.kong-image }}
           TEST_KONG_TAG: ${{ steps.split.outputs.kong-tag }}
+          TEST_KONG_EFFECTIVE_VERSION: ${{ inputs.kong-effective-version }}
           KONG_LICENSE_DATA: ${{ steps.license.outputs.license }}
           KONG_CLUSTER_VERSION: ${{ matrix.kind }}
           ISTIO_VERSION: ${{ matrix.istio }}
```

**File**: `.github/workflows/validate_kong_image.yaml` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ jobs:
       distroless-image: ${{ fromJSON(github.event.inputs.distroless-image) }}
       kic-image: ${{ format('{0}:{1}', github.event.inputs.e2e-controller-image-repo, github.event.inputs.e2e-controller-image-tag) }}
       kong-image: ${{ format('{0}:{1}', github.event.inputs.kong-image-repo, github.event.inputs.kong-image-tag) }}
+      kong-effective-version: ${{ github.event.inputs.kong-effective-version }}
       load-local-image: false
       run-gke: true
       run-istio: true
```

**File**: `test/e2e/helpers_test.go` (modified, +16/-2)
```diff
@@ -228,6 +228,7 @@ func createGKEBuilder(t *testing.T) (*environments.Builder, error) {
 		WithName(name).
 		WithWaitForTeardown(testenv.WaitForClusterDelete()).
 		WithCreateSubnet(true).
+		WithNodeMachineType("e2-standard-4").
 		WithLabels(gkeTestClusterLabels())
 
 	if v := testenv.ClusterVersion(); v != "" {
@@ -868,7 +869,17 @@ func listPodsByLabels(
 	if err != nil {
 		return nil, err
 	}
-	return podList.Items, nil
+
+	// Exclude pods that are already being terminated: they still match the label
+	// selector until fully removed from the API, but callers only ever want live pods.
+	livePods := make([]corev1.Pod, 0, len(podList.Items))
+	for _, pod := range podList.Items {
+		if pod.DeletionTimestamp != nil {
+			continue
+		}
+		livePods = append(livePods, pod)
+	}
+	return livePods, nil
 }
 
 // scaleDeployment scales the deployment to the given number of replicas and waits for the replicas to be ready.
@@ -893,7 +904,10 @@ func scaleDeployment(ctx context.Context, t *testing.T, env environments.Environ
 		if err != nil {
 			return false
 		}
-		return deployment.Status.ReadyReplicas == replicas
+		// Status.Replicas counts all non-terminated pods matched by the selector, including
+		// ones still Terminating from a previous scale-down. Requiring it to match too ensures
+		// stragglers are fully gone before callers proceed, not just that new pods are ready.
+		return deployment.Status.Replicas == replicas && deployment.Status.ReadyReplicas == replicas
 	}, time.Minute*3, time.Second, "deployment %s did not scale to %d replicas", deployment.Name, replicas)
 }
 
```

---

### Incident Patch 2: `5f2cbbc4` (2026-09-18)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace (#8095)

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace](https://github.com/open-telemetry/opentelemetry-go) from 1.33.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.33.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace
  dependency-version: 1.45.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +11/-11)
```diff
@@ -23,7 +23,7 @@ require (
 	github.com/blang/semver/v4 v4.0.0
 	github.com/cnf/structhash v0.0.0-20250313080605-df4c6cc74a9a
 	github.com/dominikbraun/graph v0.23.0
-	github.com/go-logr/logr v1.4.3
+	github.com/go-logr/logr v1.4.4
 	github.com/go-logr/zapr v1.3.0
 	github.com/goccy/go-json v0.10.5
 	github.com/google/go-cmp v0.7.0
@@ -77,18 +77,18 @@ require (
 	github.com/ettle/strcase v0.2.0 // indirect
 	github.com/fsnotify/fsnotify v1.8.0 // indirect
 	github.com/google/cel-go v0.23.2 // indirect
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
 	github.com/moby/go-archive v0.1.0 // indirect
 	github.com/moby/sys/atomicwriter v0.1.0 // indirect
 	github.com/shirou/gopsutil/v4 v4.25.1 // indirect
 	github.com/stoewer/go-strcase v1.3.0 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.4.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.2 // indirect
-	go.yaml.in/yaml/v3 v3.0.3 // indirect
+	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	k8s.io/apiserver v0.33.3 // indirect
 	k8s.io/component-helpers v0.33.3 // indirect
 	sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.31.2 // indirect
@@ -215,9 +215,9 @@ require (
 	github.com/yusufpapurcu/wmi v1.2.4 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.61.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go4.org/netipx v0.0.0-20231129151722-fdeea329fbba // indirect
 	golang.org/x/crypto v0.55.0 // indirect
@@ -232,8 +232,8 @@ require (
 	golang.org/x/time v0.15.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a // indirect
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.12.0 // indirect
```

**File**: `go.sum` (modified, +24/-24)
```diff
@@ -125,8 +125,8 @@ github.com/gammazero/workerpool v1.1.3/go.mod h1:wPjyBLDbyKnUn2XwwyD3EEwo9dHutia
 github.com/go-errors/errors v1.4.2 h1:J6MZopCL4uSllY1OfXM374weqZFFItUbrImctkmUxIA=
 github.com/go-errors/errors v1.4.2/go.mod h1:sIVyrIiJhuEF+Pj9Ebtd6P/rEYROXFi3BopGUQ5a5Og=
 github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
-github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
-github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
+github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/go-logr/zapr v1.3.0 h1:XGdV8XW8zdwFiwOA2Dryh1gj2KRQyOOoNmBy4EplIcQ=
@@ -190,8 +190,8 @@ github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674 h1:JeSE6pjso5T
 github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674/go.mod h1:r4w70xmWCQKmi1ONH4KIaBptdivuRPyosB9RmPlGEwA=
 github.com/gregjones/httpcache v0.0.0-20190611155906-901d90724c79 h1:+ngKgrYPPJrOjhax5N+uePQ0Fh1Z7PheYoUI/0nzkPA=
 github.com/gregjones/httpcache v0.0.0-20190611155906-901d90724c79/go.mod h1:FecbI9+v66THATjSRHfNgh1IVFe/9kFxbXtjV0ctIMA=
-github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0 h1:TmHmbvxPmaegwhDubVz0lICL0J5Ka2vwTzhoePEXsGE=
-github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0/go.mod h1:qztMSjm835F2bXf+5HKAPIS5qsmQDqZna/PgVt4rWtI=
+github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 h1:5VipnvEpbqr2gA2VbM+nYVbkIF28c5ZQfqCBQ5g2xfk=
+github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0/go.mod h1:Hyl3n6Twe1hvtd9XUXDec4pTvgMSEixRuQKPTMH2bNs=
 github.com/hashicorp/go-cleanhttp v0.5.2 h1:035FKYIWjmULyFRBKPs8TBQoi0x6d9G4xc9neXJWAZQ=
 github.com/hashicorp/go-cleanhttp v0.5.2/go.mod h1:kO/YDlP8L1346E6Sodw+PrpBSV4/SoxCXGY6BqNFT48=
 github.com/hashicorp/go-hclog v1.6.3 h1:Qr2kF+eVWjTiYmU7Y31tYlP1h0q/X3Nl3tPGdaB11/k=
@@ -454,24 +454,24 @@ go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.6
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.61.0/go.mod h1:snMWehoOh2wsEwnvvwtDyFCxVeDAODenXHtn5vzrKjo=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 h1:F7Jx+6hwnZ41NSFTO5q4LYDtJRXBf2PD0rNBkeB/lus=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0/go.mod h1:UHB22Z8QsdRDrnAtX4PntOl36ajSxcdUMt1sF7Y6E7Q=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0 h1:Vh5HayB/0HHfOQA7Ctx69E/Y/DcQSMPpKANYVMQ7fBA=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0/go.mod h1:cpgtDBaqD/6ok/UG0jT15/uKjAY8mRA53diogHBg3UI=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0 h1:5pojmb1U1AogINhN3SurB+zm/nIcusopeBNp42f45QM=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0/go.mod h1:57gTHJSE5S1tqg+EKsLPlTWhpHMsWlVmer+LA926XiA=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.28.0 h1:j9+03ymgYhPKmeXGk5Zu+cIZOlVzd9Zv7QIiyItjFBU=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.28.0/go.mod h1:Y5+XiUG4Emn1hTfciPzGPJaSI+RpDts6BnCIir0SLqk=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7
```

---

### Incident Patch 3: `0d1f8fb6` (2026-09-16)
**Commit Message**: Fix(translator): split httproute match by path when they have PathPrefixRewrite filter (#8081)

* split httproute match by path when they have PathPrefixRewrite filter

* update changelog

* fix routes for requestRedirect filter

* update changelog

* update changelog

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -144,6 +144,12 @@ Adding a new version? You'll need three changes:
   creation timestamp, then lowest ID to keep the tags stable in merging certificates
   from multiple `Secret`s with the same certificate content.
   [#8085](https://github.com/Kong/kubernetes-ingress-controller/pull/8085)
+- Generate a distinct Kong route for each match when its parent `HTTPRoute` rule
+  contains `ReplacePrefixMatch` typed `URLRewrite` filter or `requestRedirect` filter.
+  NOTE: This would make the generate routes from the affected `HTTPRoute` rules
+  containing the filters to be deleted and re-created, and the names of the routes
+  are changed.
+  [#8081](https://github.com/Kong/kubernetes-ingress-controller/pull/8081)
 
 ## [3.5.13]
 
```

**File**: `internal/dataplane/translator/subtranslator/httproute.go` (modified, +72/-26)
```diff
@@ -318,6 +318,30 @@ func getHTTPRouteHostnamesAsSliceOfStringPointers(httproute *gatewayapi.HTTPRout
 	})
 }
 
+// filtersContainURLRewriteReplacePrefixMatch reports whether filters contains a URLRewrite filter
+// with a ReplacePrefixMatch path modifier. The rewritten path for such a filter depends on which
+// prefix matched, so matches sharing this filter must never be consolidated into a single Kong
+// route/plugin.
+func filtersContainURLRewriteReplacePrefixMatch(filters []gatewayapi.HTTPRouteFilter) bool {
+	return lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
+		return filter.Type == gatewayapi.HTTPRouteFilterURLRewrite &&
+			filter.URLRewrite.Path != nil &&
+			filter.URLRewrite.Path.Type == gatewayapi.PrefixMatchHTTPPathModifier &&
+			filter.URLRewrite.Path.ReplacePrefixMatch != nil
+	})
+}
+
+// filtersContainRequestRedirect reports whether filters contains a RequestRedirect filter. A
+// RequestRedirect's generated plugin (e.g. its Location header, when no path override is set)
+// generally depends on which match fired, so matches sharing this filter must never be
+// consolidated into a single Kong route/plugin either - see getRoutesFromMatches, which already
+// builds one independent route per match for this reason.
+func filtersContainRequestRedirect(filters []gatewayapi.HTTPRouteFilter) bool {
+	return lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
+		return filter.Type == gatewayapi.HTTPRouteFilterRequestRedirect
+	})
+}
+
 // translateHTTPRouteRulesMetaToKongstateRoutes translate the matches and filters under the rules sharing the same backends
 // to list of kongstate.Route.
 func translateHTTPRouteRulesMetaToKongstateRoutes(
@@ -334,9 +358,17 @@ func translateHTTPRouteRulesMetaToKongstateRoutes(
 		filters := rulesWithSameFilter[0].Rule.Filters
 		// Group the matches for each rule. Then aggregate the matches eligible for the consolidation
 		// into a single match group.
+		//
+		// ReplacePrefixMatch's rewritten path, and RequestRedirect's generated plugin, both depend on
+		// which match fired, so when either is present we must never fold matches from different
+		// rules together - keep every match in its own group.
+		keyFn := httpRouteMatchMeta.getKey
+		if filtersContainURLRewriteReplacePrefixMatch(filters) || filtersContainRequestRedirect(filters) {
+			keyFn = httpRouteMatchMeta.getUniqueKey
+		}
 		matchGroups := make(map[string]httpRouteMatchMetaList)
 		for _, ruleMeta := range rulesWithSameFilter {
-			ruleMatchGroups := groupSliceByKeyFn(ruleMeta.matches(), httpRouteMatchMeta.getKey)
+			ruleMatchGroups := groupSliceByKeyFn(ruleMeta.matches(), keyFn)
 			for matchGroupKey, matchGroup := range ruleMatchGroups {
 				matchGroups[matchGroupKey] = append(matchGroups[matchGroupKey], matchGroup...)
 			}
@@ -631,6 +663,13 @@ func (m httpRouteMatchMeta) getKey() string {
 	return mustMarshalJSON(keySource)
 }
 
+// getUniqueKey computes a key that is unique to this particular HTTPRouteMatch, i.e. it never
+// collides with the key of any other httpRouteMatchMeta. It is used in place of getKey() when
+// matches must not be consolidated with any other match, regardless of how similar they are.
+func (m httpRouteMatchMeta) getUniqueKey() string {
+	return fmt.Sprintf("%s/%s.%d.%d", m.parentRoute.Namespace, m.parentRoute.Name, m.RuleNumber, m.MatchNumber)
+}
+
 type httpRouteMatchMetaList []httpRouteMatchMeta
 
 func (l httpRouteMatchMetaList) httpRouteMatches() (
@@ -744,26 +783,22 @@ func GenerateKongRoutesFromHTTPRouteMatches(
 
 	// Check if the route has a RequestRedirect or URLRewrite with non-nil ReplacePrefixMatch - if it does, we need to
 	// generate a route for each match as the path is used to modify routes and generate plugins.
-	hasRedirectFilter := lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
-		return filter.Type == gatewayapi.HTTPRouteFilterRequestRedirect
-	})
+	hasRedirectFilter := filtersContainRequestRedi
```

**File**: `internal/dataplane/translator/subtranslator/httproute_test.go` (modified, +367/-0)
```diff
@@ -1782,6 +1782,296 @@ func TestTranslateHTTPRouteRulesMetaToKongstateRoutes(t *testing.T) {
 				},
 			},
 		},
+		{
+			// Reproduces a bug where two rules sharing backendRefs and the exact same
+			// URLRewrite/ReplacePrefixMatch filter, but with different match path prefixes, were
+			// consolidated into a single Kong route/plugin - so only the first rule's path prefix
+			// worked and the second 404'd. ReplacePrefixMatch's rewrite depends on which prefix
+			// matched, so Kong cannot express both prefixes as a single route + single plugin.
+			name: "rules sharing backendRefs and an identical URLRewrite ReplacePrefixMatch filter but different paths are kept separate",
+			rulesMeta: []httpRouteRuleMeta{
+				{
+					Rule: gatewayapi.HTTPRouteRule{
+						BackendRefs: backendRefList,
+						Filters: []gatewayapi.HTTPRouteFilter{
+							{
+								Type: gatewayapi.HTTPRouteFilterURLRewrite,
+								URLRewrite: &gatewayapi.HTTPURLRewriteFilter{
+									Path: &gatewayapi.HTTPPathModifier{
+										Type:               gatewayapi.PrefixMatchHTTPPathModifier,
+										ReplacePrefixMatch: lo.ToPtr("/anything"),
+									},
+								},
+							},
+						},
+						Matches: []gatewayapi.HTTPRouteMatch{
+							{
+								Path: &gatewayapi.HTTPPathMatch{
+									Type:  lo.ToPtr(gatewayapi.PathMatchPathPrefix),
+									Value: lo.ToPtr("/path-1"),
+								},
+							},
+						},
+					},
+					RuleNumber:  0,
+					parentRoute: httpRouteWithoutHost,
+				},
+				{
+					Rule: gatewayapi.HTTPRouteRule{
+						BackendRefs: backendRefList,
+						Filters: []gatewayapi.HTTPRouteFilter{
+							{
+								Type: gatewayapi.HTTPRouteFilterURLRewrite,
+								URLRewrite: &gatewayapi.HTTPURLRewriteFilter{
+									Path: &gatewayapi.HTTPPathModifier{
+										Type:               gatewayapi.PrefixMatchHTTPPathModifier,
+										ReplacePrefixMatch: lo.ToPtr("/anything"),
+									},
+								},
+							},
+						},
+						Matches: []gatewayapi.HTTPRouteMatch{
+							{
+								Path: &gatewayapi.HTTPPathMatch{
+									Type:  lo.ToPtr(gatewayapi.PathMatchPathPrefix),
+									Value: lo.ToPtr("/path-2"),
+								},
+							},
+						},
+					},
+					RuleNumber:  1,
+					parentRoute: httpRouteWithoutHost,
+				},
+			},
+			expectedRoutes: []kongstate.Route{
+				{
+					Route: kong.Route{
+						Name:         kong.String("httproute.default.httproute-1.0.0"),
+						Paths:        kong.StringSlice("~/path-1$", "~/path-1(/.*)"),
+						PreserveHost: kong.Bool(true),
+						StripPath:    kong.Bool(false),
+						Protocols:    nil,
+						Tags: []*string{
+							kong.String("k8s-name:httproute-1"),
+							kong.String("k8s-namespace:default"),
+							kong.String("k8s-kind:HTTPRoute"),
+							kong.String("k8s-group:gateway.networking.k8s.io"),
+							kong.String("k8s-version:v1"),
+						},
+					},
+					Plugins: []kong.Plugin{
+						{
+							Name: kong.String("request-transformer"),
+							Config: kong.Configuration{
+								"replace": TransformerPluginReplaceConfig{
+									URI: "/anything$(uri_captures[1])",
+								},
+							},
+							Tags: []*string{
+								kong.String("k8s-name:httproute-1"),
+								kong.String("k8s-namespace:default"),
+								kong.String("k8s-kind:HTTPRoute"),
+								kong.String("k8s-group:gateway.networking.k8s.io"),
+								kong.String("k8s-version:v1"),
+							},
+						},
+					},
+					Ingress: util.FromK8sObject(httpRouteWithoutHost),
+				},
+				{
+					Route: kong.Route{
+						Name:         kong.String("httproute.default.httproute-1.1.0"),
+						Paths:        kong.StringSlice("~/path-2$", "~/path-2(/.*)"),
+						PreserveHost: kong.Bool(true),
+						StripPath:    kong.Bool(false),
+						Protocols:    nil,
+						Tags: []*string{
+							kong.String("k8s-name:httproute-1"),
+							kong.String("k8s-namespace:default"),
+							kong.String("k8s-kind:HTTPRoute"),
+							kong.String("k8s-group:gateway.networking.k8s.io"),
+							kong.String("k8s-version:v1"),
+				
```

---

### Incident Patch 4: `5af2417f` (2026-09-15)
**Commit Message**: fix(translator): set tags to the winning cert in merging certificates (#8085)

* fix: set tags to the winning cert in merging certificates

* add test cases and changelog

* address comments

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -136,6 +136,15 @@ Adding a new version? You'll need three changes:
 - [0.0.5](#005)
 - [0.0.4 and prior](#004-and-prior)
 
+## Unreleased
+
+### Fixed
+
+- Inherit the tags of the translated Kong certificate from the one with earliest
+  creation timestamp, then lowest ID to keep the tags stable in merging certificates
+  from multiple `Secret`s with the same certificate content.
+  [#8085](https://github.com/Kong/kubernetes-ingress-controller/pull/8085)
+
 ## [3.5.13]
 
 > Release date: 2026-08-07
```

**File**: `internal/dataplane/translator/translate_certs.go` (modified, +3/-1)
```diff
@@ -245,14 +245,16 @@ func mergeCerts(logger logr.Logger, certLists ...[]certWrapper) ([]kongstate.Cer
 				current = cw
 			} else {
 				// multiple Secrets that contain identical certificates are collapsed, because we only create one
-				// Kong resource for a given cert+key pair. however, because we reuse the Secret ID and creation time
+				// Kong resource for a given cert+key pair. however, because we reuse the Secret ID, tags and creation time
 				// for the Kong resource equivalents, the selection of those needs to be deterministic to avoid
 				// pointless configuration updates
 				if current.CreationTimestamp.After(cw.CreationTimestamp.Time) {
 					current.cert.ID = cw.cert.ID
+					current.cert.Tags = cw.cert.Tags
 					current.CreationTimestamp = cw.CreationTimestamp
 				} else if current.CreationTimestamp.Time.Equal(cw.CreationTimestamp.Time) && (current.cert.ID == nil || *current.cert.ID > *cw.cert.ID) {
 					current.cert.ID = cw.cert.ID
+					current.cert.Tags = cw.cert.Tags
 					current.CreationTimestamp = cw.CreationTimestamp
 				}
 			}
```

**File**: `internal/dataplane/translator/translate_certs_test.go` (modified, +64/-2)
```diff
@@ -3,6 +3,7 @@ package translator
 import (
 	"sort"
 	"testing"
+	"time"
 
 	"github.com/go-logr/logr"
 	"github.com/kong/go-kong/kong"
@@ -335,6 +336,7 @@ func TestMergeCerts(t *testing.T) {
 		certs        []certWrapper
 		mergedCerts  []kongstate.Certificate
 		idToMergedID certIDToMergedCertID
+		tags         []string
 	}{
 		{
 			name: "single certificate",
@@ -407,23 +409,80 @@ func TestMergeCerts(t *testing.T) {
 			},
 		},
 		{
-			name: "multiple certs with same content should be merged",
+			name: "multiple certs with same content should be merged, and tags should inherit from the cert with the earliest CreationTimestamp",
 			certs: []certWrapper{
 				{
 					identifier: string(crt1) + string(key1),
 					cert: kong.Certificate{
 						ID:   kong.String("certificate-1"),
 						Cert: kong.String(string(crt1)),
 						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag1", "tag2"),
 					},
-					snis: []string{"foo.com"},
+					snis:              []string{"foo.com"},
+					CreationTimestamp: metav1.NewTime(time.Now()),
 				},
 				{
 					identifier: string(crt1) + string(key1),
 					cert: kong.Certificate{
 						ID:   kong.String("certificate-1-1"),
 						Cert: kong.String(string(crt1)),
 						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag3", "tag4"),
+					},
+					snis:              []string{"baz.com"},
+					CreationTimestamp: metav1.NewTime(time.Now().Add(-1 * time.Hour)),
+				},
+			},
+			mergedCerts: []kongstate.Certificate{
+				{
+					Certificate: kong.Certificate{
+						ID:   kong.String("certificate-1-1"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						// SNIs should be sorted
+						SNIs: kong.StringSlice("baz.com", "foo.com"),
+						// tags should inherit from the cert with the earliest CreationTimestamp.
+						Tags: kong.StringSlice("tag3", "tag4"),
+					},
+				},
+			},
+			idToMergedID: certIDToMergedCertID{
+				// the cert with the earliest CreationTimestamp should be the merged cert ID
+				"certificate-1":   "certificate-1-1",
+				"certificate-1-1": "certificate-1-1",
+			},
+		},
+		{
+			name: "multiple certs with same content should be merged, and tags should inherit from the cert with the lowest ID",
+			certs: []certWrapper{
+				{
+					identifier: string(crt1) + string(key1),
+					cert: kong.Certificate{
+						ID:   kong.String("certificate-1-1"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag3", "tag4"),
+					},
+					snis: []string{"baz.com"},
+				},
+				{
+					identifier: string(crt1) + string(key1),
+					cert: kong.Certificate{
+						ID:   kong.String("certificate-1"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag1", "tag2"),
+					},
+					snis: []string{"foo.com"},
+				},
+				{
+					identifier: string(crt1) + string(key1),
+					cert: kong.Certificate{
+						ID:   kong.String("certificate-1-2"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag5", "tag6"),
 					},
 					snis: []string{"baz.com"},
 				},
@@ -436,12 +495,15 @@ func TestMergeCerts(t *testing.T) {
 						Key:  kong.String(string(key1)),
 						// SNIs should be sorted
 						SNIs: kong.StringSlice("baz.com", "foo.com"),
+						// tags should inherit from the cert with the lowest ID.
+						Tags: kong.StringSlice("tag1", "tag2"),
 					},
 				},
 			},
 			idToMergedID: certIDToMergedCertID{
 				"certificate-1":   "certificate-1",
 				"certificate-1-1": "certificate-1",
+				"certificate-1-2": "certificate-1",
 			},
 		},
 	}
```

---

### Incident Patch 5: `bb6b1b7a` (2026-08-04)
**Commit Message**: fix(ci): use correct OSS nightly Kong version (#8047)

Signed-off-by: Jintao Zhang <zhangjintao9020@gmail.com>

**File**: `.github/workflows/e2e_nightly.yaml` (modified, +3/-1)
```diff
@@ -54,7 +54,9 @@ jobs:
     with:
       kong-container-repo: kong/kong-dev
       kong-container-tag: nightly
-      kong-oss-effective-version: "3.15.0"
+      # OSS and Enterprise nightly images report different versions. Keep this
+      # aligned with the version reported by kong/kong-dev:nightly.
+      kong-oss-effective-version: "3.10.0"
       kong-enterprise-container-repo: kong/kong-gateway-dev
       kong-enterprise-container-tag: nightly
       kong-enterprise-effective-version: "3.15.0"
```

---

### Incident Patch 6: `d81ffd3b` (2026-08-02)
**Commit Message**: test: fix Kong version detection for nightly images (#8046)

Signed-off-by: Jintao Zhang <zhangjintao9020@gmail.com>

**File**: `.github/workflows/e2e_nightly.yaml` (modified, +3/-3)
```diff
@@ -43,7 +43,7 @@ jobs:
       # it reports the next release to be released as semver in the version field.
       # ref: https://github.com/Kong/kubernetes-ingress-controller/issues/4014
       kong-image: kong/kong-gateway-dev:nightly
-      kong-effective-version: "3.4.1"
+      kong-effective-version: "3.15.0"
       all-supported-k8s-versions: false
       run-gke: false
       run-istio: false
@@ -54,10 +54,10 @@ jobs:
     with:
       kong-container-repo: kong/kong-dev
       kong-container-tag: nightly
-      kong-oss-effective-version: "3.4.1"
+      kong-oss-effective-version: "3.15.0"
       kong-enterprise-container-repo: kong/kong-gateway-dev
       kong-enterprise-container-tag: nightly
-      kong-enterprise-effective-version: "3.4.1"
+      kong-enterprise-effective-version: "3.15.0"
       log-output-file:  /tmp/integration-tests-kic-logs
 
   test-reports:
```

**File**: `.github/workflows/e2e_targeted.yaml` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@ jobs:
       kic-image: ${{ needs.choose-image.outputs.image }}
       load-local-image: ${{ inputs.controller-image == '' }}
       kong-image: kong/kong-gateway-dev:nightly
+      kong-effective-version: "3.15.0"
       # these do not honor the inputs, as this job is intended to be a minimal
       # test against unreleased kong images, with the main run covering the
       # other test conditions
```

**File**: `test/conformance/suite_test.go` (modified, +6/-1)
```diff
@@ -51,7 +51,12 @@ var (
 )
 
 func TestMain(m *testing.M) {
-	if testenv.IsKongGatewayVersionEnterpriseOnly() && testenv.KongLicenseData() == "" {
+	enterpriseOnly, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+	if err != nil {
+		fmt.Printf("ERROR: failed to determine Kong Gateway version: %v\n", err)
+		os.Exit(1)
+	}
+	if enterpriseOnly && testenv.KongLicenseData() == "" {
 		fmt.Println("ERROR: Kong 3.15+ used and no license provided")
 		os.Exit(1)
 	}
```

**File**: `test/integration/isolated/suite_test.go` (modified, +6/-1)
```diff
@@ -44,7 +44,12 @@ var tenv env.Environment
 // -----------------------------------------------------------------------------
 
 func TestMain(m *testing.M) {
-	if testenv.IsKongGatewayVersionEnterpriseOnly() && testenv.KongLicenseData() == "" {
+	enterpriseOnly, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+	if err != nil {
+		fmt.Printf("ERROR: failed to determine Kong Gateway version: %v\n", err)
+		os.Exit(1)
+	}
+	if enterpriseOnly && testenv.KongLicenseData() == "" {
 		fmt.Println("ERROR: Kong 3.15+ used and no license provided")
 		os.Exit(1)
 	}
```

**File**: `test/integration/suite_test.go` (modified, +6/-1)
```diff
@@ -38,7 +38,12 @@ import (
 var kongGatewayVersion kongversion.Version
 
 func TestMain(m *testing.M) {
-	if testenv.IsKongGatewayVersionEnterpriseOnly() && testenv.KongLicenseData() == "" {
+	enterpriseOnly, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+	if err != nil {
+		fmt.Printf("ERROR: failed to determine Kong Gateway version: %v\n", err)
+		os.Exit(1)
+	}
+	if enterpriseOnly && testenv.KongLicenseData() == "" {
 		fmt.Println("ERROR: Kong 3.15+ used and no license provided")
 		os.Exit(1)
 	}
```

---

### Incident Patch 7: `9c3ef379` (2026-06-22)
**Commit Message**: tests: fix TestDiagnosticsServer_Diffs (#8001)

**File**: `internal/diagnostics/server_test.go` (modified, +28/-5)
```diff
@@ -93,8 +93,24 @@ func TestDiagnosticsServer_Diffs(t *testing.T) {
 		last = diff.Hash
 	}
 
-	// request the diff report
+	// Wait for all diffs to be processed by the collector before making HTTP requests.
+	// This prevents race conditions where the HTTP handler might return data before all
+	// diffs have been stored in the collector's diff map.
 	httpClient := &http.Client{}
+	require.EventuallyWithT(t, func(t *assert.CollectT) {
+		resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report", port))
+		require.NoError(t, err)
+		defer resp.Body.Close()
+
+		got := DiffResponse{}
+		require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
+
+		// Check that all sent diffs have been processed.
+		require.Len(t, got.Available, configDumpsToWrite, "expected all %d diffs to be available", configDumpsToWrite)
+	}, time.Second*5, time.Millisecond*10, "all diffs should be processed")
+
+	// Request the diff report.
+
 	resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report", port))
 	require.NoError(t, err)
 	defer resp.Body.Close()
@@ -125,6 +141,14 @@ func TestDiagnosticsServer_Diffs(t *testing.T) {
 	configDiffs[extra.Hash] = extra
 	diffCh <- extra
 
+	// Wait for the extra diff to be processed before checking the results.
+	require.EventuallyWithT(t, func(t *assert.CollectT) {
+		resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report?hash=%s", port, extra.Hash))
+		require.NoError(t, err)
+		defer resp.Body.Close()
+		require.Equal(t, http.StatusOK, resp.StatusCode, "extra diff should be available")
+	}, time.Second*5, time.Millisecond*10, "extra diff should be processed")
+
 	second, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report", port))
 	require.NoError(t, err)
 	defer second.Body.Close()
@@ -193,13 +217,12 @@ func setupTestServer(ctx context.Context, t *testing.T) (Client, int) {
 	t.Log("Started diagnostics collector")
 
 	// Wait for the server to be ready
-	require.Eventually(t, func() bool {
+	require.EventuallyWithT(t, func(c *assert.CollectT) {
 		conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%d", port))
-		if err != nil {
-			return false
+		if !assert.NoError(c, err) {
+			return
 		}
 		conn.Close()
-		return true
 	}, 5*time.Second, 100*time.Millisecond, "Server should be ready")
 
 	return client, port
```

---

### Incident Patch 8: `287127f9` (2026-06-18)
**Commit Message**: fix: fix missing certificate tags (#7991)

* fix: fix missing certificate tags

* Apply suggestion from @programmer04

Co-authored-by: Jakub Warczarek <jakub.warczarek@konghq.com>

* Apply suggestion from @programmer04

Co-authored-by: Jakub Warczarek <jakub.warczarek@konghq.com>

* chore: fix linter issues

---------

Co-authored-by: Jakub Warczarek <jakub.warczarek@konghq.com>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -134,6 +134,8 @@ Adding a new version? You'll need three changes:
 - Prevent recreating consumer credentials on every Konnect sync when running in
   KIC in Konnect mode.
   [#7978](https://github.com/Kong/kubernetes-ingress-controller/pull/7978)
+- Fix missing certificate tags in generated config.
+  [#7991](https://github.com/Kong/kubernetes-ingress-controller/pull/7991)
 
 ## [3.5.9]
 
```

**File**: `internal/dataplane/deckgen/deckgen.go` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ func GetFCertificateFromKongCert(kongCert kong.Certificate) file.FCertificate {
 	if kongCert.Cert != nil {
 		res.Cert = kong.String(*kongCert.Cert)
 	}
+	res.Tags = kongCert.Tags
 	res.SNIs = getCertsSNIs(kongCert)
 	return res
 }
```

**File**: `internal/dataplane/deckgen/deckgen_test.go` (modified, +58/-0)
```diff
@@ -10,6 +10,64 @@ import (
 	"github.com/kong/kubernetes-ingress-controller/v3/internal/dataplane/deckgen"
 )
 
+func TestGetFCertificateFromKongCert(t *testing.T) {
+	const (
+		certID  = "c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af"
+		certPEM = "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----"
+		keyPEM  = "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----"
+		sniName = "example.com"
+		tag1    = "k8s-name:sooper-secret"
+		tag2    = "k8s-namespace:bar-namespace"
+	)
+
+	testCases := []struct {
+		name     string
+		input    kong.Certificate
+		wantTags []*string
+	}{
+		{
+			name: "copies tags",
+			input: kong.Certificate{
+				ID:   kong.String(certID),
+				Cert: kong.String(certPEM),
+				Key:  kong.String(keyPEM),
+				SNIs: []*string{kong.String(sniName)},
+				Tags: []*string{kong.String(tag1), kong.String(tag2)},
+			},
+			wantTags: []*string{kong.String(tag1), kong.String(tag2)},
+		},
+		{
+			name: "nil tags",
+			input: kong.Certificate{
+				ID:   kong.String(certID),
+				Cert: kong.String(certPEM),
+				Key:  kong.String(keyPEM),
+				SNIs: []*string{kong.String(sniName)},
+				Tags: nil,
+			},
+			wantTags: nil,
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			got := deckgen.GetFCertificateFromKongCert(tc.input)
+
+			require.Equal(t, tc.input.ID, got.ID)
+			require.Equal(t, tc.input.Cert, got.Cert)
+			require.Equal(t, tc.input.Key, got.Key)
+			require.Equal(t, tc.wantTags, got.Tags)
+
+			require.Len(t, got.SNIs, len(tc.input.SNIs))
+			for i, sni := range got.SNIs {
+				require.Equal(t, tc.input.SNIs[i], sni.Name)
+				require.NotNil(t, sni.Certificate)
+				require.Equal(t, tc.input.ID, sni.Certificate.ID)
+			}
+		})
+	}
+}
+
 func TestIsContentEmpty(t *testing.T) {
 	testCases := []struct {
 		name    string
```

**File**: `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer/default_golden.yaml` (modified, +6/-0)
```diff
@@ -37,6 +37,12 @@ certificates:
   - certificate:
       id: c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
     name: 2.example.com
+  tags:
+  - k8s-name:sooper-secret
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
+  - k8s-version:v1
 consumers:
 - basicauth_credentials:
   - password: consumer-1-password
```

**File**: `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer/expression-routes-on_golden.yaml` (modified, +6/-0)
```diff
@@ -37,6 +37,12 @@ certificates:
   - certificate:
       id: c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
     name: 2.example.com
+  tags:
+  - k8s-name:sooper-secret
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
+  - k8s-version:v1
 consumers:
 - basicauth_credentials:
   - password: consumer-1-password
```

---

### Incident Patch 9: `e1f58a00` (2026-06-17)
**Commit Message**: fix data race by using Eventually (#7979)

**File**: `internal/clients/manager_test.go` (modified, +7/-5)
```diff
@@ -519,11 +519,13 @@ func TestAdminAPIClientsManager_PeriodicReadinessReconciliation(t *testing.T) {
 	// Trigger a next readiness check which will make testURL2 ready.
 	readinessChecker.LetChecksReturn(clients.ReadinessCheckResult{ClientsTurnedReady: intoTurnedReady(testURL2)})
 	readinessTicker.Add(managercfg.DefaultDataPlanesReadinessReconciliationInterval)
-	readinessCheckCallEventuallyMatches(readinessCheckCall{
-		AlreadyCreatedURLs: []string{testURL1},
-		PendingURLs:        []string{testURL2},
-	})
-	require.Equal(t, 3, readinessChecker.CallsCount())
+	// Wait for CallsCount to reach 3 instead of relying on readinessCheckCallEventuallyMatches:
+	// the readiness check arguments here are identical to the previous step's (CheckReadiness is
+	// called with the pre-transition lists, so testURL2 is still pending), so LastCall already
+	// matches and would not synchronize with the tick-triggered check made by the manager goroutine.
+	require.Eventually(t, func() bool {
+		return readinessChecker.CallsCount() == 3
+	}, time.Second, time.Millisecond, "expected a third readiness check after the periodic tick")
 	require.True(t, lo.ContainsBy(m.GatewayClients(), func(c *adminapi.Client) bool {
 		return c.BaseRootURL() == testURL2
 	}), "expected to find the new client in the manager's clients list after it became ready")
```

---

### Incident Patch 10: `2af62b1b` (2026-06-16)
**Commit Message**: fix: fix credential recreation on every Konnect sync (#7978)

* fix: fix credential recreation on every Konnect sync

* Update CHANGELOG.md

Co-authored-by: Jintao Zhang <zhangjintao9020@gmail.com>

* chore: rename credentialOps fields

* chore: comment for credential interface

---------

Co-authored-by: Jintao Zhang <zhangjintao9020@gmail.com>

**File**: `CHANGELOG.md` (modified, +19/-1)
```diff
@@ -125,24 +125,42 @@ Adding a new version? You'll need three changes:
 - [0.0.5](#005)
 - [0.0.4 and prior](#004-and-prior)
 
-## [3.5]
+## [3.5.10]
 
 > Release date: TBD
 
 ### Fixed
 
+- Prevent recreating consumer credentials on every Konnect sync when running in
+  KIC in Konnect mode.
+  [#7978](https://github.com/Kong/kubernetes-ingress-controller/pull/7978)
+
+## [3.5.9]
+
+> Release date: 2026-06-04
+
+### Fixed
+
 - Preserve the Admin API client's TLS server name (SNI) when a client turns pending and is
   recreated (e.g. after a gateway Pod restart). Previously the SNI was dropped on recreation,
   which, when gateway service discovery is combined with a mTLS-secured Admin API, caused
   permanent TLS verification failures against the recreated client.
   [#7950](https://github.com/Kong/kubernetes-ingress-controller/pull/7950)
+
+## [3.5.8]
+
+> Release date: 2026-06-01
+
+### Fixed
+
 - Revert plugin config sanitization `--dump-sensitive-config` isn't set.
   Due to plugin configuration being dependent on plugin type controller is not
   able to make an informed decision whether a field is sensitive or not and more
   importantly whether it has a constrained set of allowed values like e.g. HTTP methods.
   Users are suggested to block network access to debug endpoints (which are disabled
   by default) if plugin configuration can contain sensitive information.
   [#7937](https://github.com/Kong/kubernetes-ingress-controller/pull/7937)
+  [#7939](https://github.com/Kong/kubernetes-ingress-controller/pull/7939)
 
 ## [3.5.7]
 
```

**File**: `internal/dataplane/kongstate/consumer_test.go` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ func TestConsumer_SanitizedCopy(t *testing.T) {
 				Plugins: []kong.Plugin{{ID: kong.String("1")}},
 				KeyAuths: []*KeyAuth{
 					{
-						KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}")},
+						KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: deterministicRedactedString("secret")},
 					},
 				},
 				HMACAuths: []*HMACAuth{
```

**File**: `internal/dataplane/kongstate/credentials.go` (modified, +21/-1)
```diff
@@ -1,6 +1,7 @@
 package kongstate
 
 import (
+	"crypto/sha256"
 	"fmt"
 
 	"github.com/kong/go-kong/kong"
@@ -21,6 +22,15 @@ func randRedactedString(uuidGenerator util.UUIDGenerator) *string {
 	return &s
 }
 
+// deterministicRedactedString returns a stable vault-URI redaction derived from seed.
+// It produces the same output for the same seed (no churn on unchanged credentials) while
+// remaining distinct for different seeds. The real secret value is not recoverable from the output.
+func deterministicRedactedString(seed string) *string {
+	sum := sha256.Sum256([]byte(seed))
+	s := fmt.Sprintf("{vault://%x}", sum[:16])
+	return &s
+}
+
 // KeyAuth represents a key-auth credential.
 type KeyAuth struct {
 	kong.KeyAuth
@@ -161,13 +171,23 @@ func NewMTLSAuth(config any) (*MTLSAuth, error) {
 }
 
 // SanitizedCopy returns a shallow copy with sensitive values redacted best-effort.
+// The Key field is replaced with a deterministic vault-URI derived from the real key so that
+// repeated syncs without a key change produce the same redacted value (preventing spurious
+// delete+create churn in go-database-reconciler). When the real key is unavailable the
+// redaction falls back to a random vault-URI.
 func (c *KeyAuth) SanitizedCopy(uuidGenerator util.UUIDGenerator) *KeyAuth {
+	var redactedKey *string
+	if c.Key != nil {
+		redactedKey = deterministicRedactedString(*c.Key)
+	} else {
+		redactedKey = randRedactedString(uuidGenerator)
+	}
 	return &KeyAuth{
 		KeyAuth: kong.KeyAuth{
 			// Consumer field omitted
 			CreatedAt: c.CreatedAt,
 			ID:        c.ID,
-			Key:       randRedactedString(uuidGenerator),
+			Key:       redactedKey,
 			Tags:      c.Tags,
 		},
 	}
```

**File**: `internal/dataplane/kongstate/credentials_test.go` (modified, +32/-2)
```diff
@@ -14,7 +14,7 @@ func TestKeyAuth_SanitizedCopy(t *testing.T) {
 		want KeyAuth
 	}{
 		{
-			name: "fills all fields but Consumer and sanitizes key",
+			name: "fills all fields but Consumer and sanitizes key deterministically",
 			in: KeyAuth{
 				KeyAuth: kong.KeyAuth{
 					Consumer:  &kong.Consumer{Username: kong.String("foo")},
@@ -28,17 +28,47 @@ func TestKeyAuth_SanitizedCopy(t *testing.T) {
 				KeyAuth: kong.KeyAuth{
 					CreatedAt: kong.Int(1),
 					ID:        kong.String("2"),
-					Key:       kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}"),
+					Key:       deterministicRedactedString("3"),
 					Tags:      []*string{kong.String("4.1"), kong.String("4.2")},
 				},
 			},
 		},
+		{
+			name: "sanitizes key to random vault-URI when key is nil",
+			in: KeyAuth{
+				KeyAuth: kong.KeyAuth{
+					ID:  kong.String("2"),
+					Key: nil,
+				},
+			},
+			want: KeyAuth{
+				KeyAuth: kong.KeyAuth{
+					ID:  kong.String("2"),
+					Key: kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}"),
+				},
+			},
+		},
 	} {
 		t.Run(tt.name, func(t *testing.T) {
 			got := *tt.in.SanitizedCopy(StaticUUIDGenerator{UUID: "52fdfc07-2182-454f-963f-5f0f9a621d72"})
 			assert.Equal(t, tt.want, got)
 		})
 	}
+
+	t.Run("deterministic: same key produces same redacted value across calls", func(t *testing.T) {
+		ka := KeyAuth{KeyAuth: kong.KeyAuth{Key: kong.String("mykey")}}
+		got1 := ka.SanitizedCopy(StaticUUIDGenerator{UUID: "x"})
+		got2 := ka.SanitizedCopy(StaticUUIDGenerator{UUID: "y"})
+		assert.Equal(t, got1.Key, got2.Key, "same real key must produce same redacted key regardless of uuidGenerator")
+	})
+
+	t.Run("different keys produce different redacted values", func(t *testing.T) {
+		ka1 := KeyAuth{KeyAuth: kong.KeyAuth{Key: kong.String("keyA")}}
+		ka2 := KeyAuth{KeyAuth: kong.KeyAuth{Key: kong.String("keyB")}}
+		got1 := ka1.SanitizedCopy(StaticUUIDGenerator{UUID: "x"})
+		got2 := ka2.SanitizedCopy(StaticUUIDGenerator{UUID: "x"})
+		assert.NotEqual(t, got1.Key, got2.Key, "different real keys must produce different redacted keys")
+	})
 }
 
 func TestHMACAuth_SanitizedCopy(t *testing.T) {
```

**File**: `internal/dataplane/kongstate/kongstate_test.go` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ func TestKongState_SanitizedCopy(t *testing.T) {
 					{
 						KeyAuths: []*KeyAuth{
 							{
-								KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}")},
+								KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: deterministicRedactedString("secret")},
 							},
 						},
 					},
```

#### Recent Merged Pull Requests:
- **PR #8096** (closed): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #8095** (2026-09-18): chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace from 1.33.0 to 1.45.0 (@dependabot[bot])
- **PR #8093** (2026-09-20): [Backport release/3.4.x] Backport of #8081 and #8085 (@randmonkey)
- **PR #8092** (2026-09-20): [Backport release/3.5.x] Combined backport of #8081 and #8085 (@randmonkey)
- **PR #8091** (2026-09-17): chore(deps): bump google.golang.org/grpc from 1.83.1 to 1.83.2 (@dependabot[bot])
- **PR #8090** (2026-09-17): chore(deps): Bump grpc to 1.83.1 (@randmonkey)
- **PR #8089** (2026-09-20): fix(test): Pass kong-effective-version to e2e in validating Kong image tests and fix GKEtest failures (@randmonkey)
- **PR #8087** (2026-09-11): bump GKE to 1.37.0 (@randmonkey)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
