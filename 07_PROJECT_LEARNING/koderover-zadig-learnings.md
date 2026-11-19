> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/koderover-zadig-learnings.md`  
> **Source**: github ([https://github.com/koderover/zadig](https://github.com/koderover/zadig))  
> **Source Version**: `0b80d9e7`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-19T22:07:03.882Z  
> **Learning ID**: `learn-github-koderover-zadig`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): koderover/zadig

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Domain & Mission Scope
Zadig is an open-source, cloud-native DevOps orchestration platform designed for microservice environments, multi-cluster Kubernetes topologies, and multi-tenant delivery pipelines. It solves the impedance mismatch between GitOps/Helm packaging models, distributed cloud infrastructure, and continuous integration/deployment cycles. 

Specifically, Zadig bridges:
1. **Dynamic Environment Management**: Generating, updating, isolating, and tearing down ephemeral or production Kubernetes/Helm environments across arbitrary clusters.
2. **Coordinated Multi-Service Workflows**: Managing concurrent pipeline executions that build, test, scan, and deploy microservice sets while maintaining strict data consistency across MongoDB (metadata), Redis (distributed state locks), and Kubernetes APIServers (actual runtime state).
3. **Multi-Tenant Security Boundaries**: Enforcing granular project-level and cluster-level role-based access control (RBAC), ensuring that cluster inventory inspection permissions do not leak internal workflow topologies or cross-tenant cluster assets.
4. **Agent-Assisted Automation (Halman / AI Copilot)**: Ingesting cluster diagnostics, log excerpts, and project onboarding schemas into structured LLM toolchains to resolve operational failures autonomously.

### 1.2 System Topology & Subsystem Boundaries

```
                 +-------------------------------------------------------------+
                 |                       Web UI / zgctl                        |
                 +-------------------------------------------------------------+
                                                |
                                                v
+---------------------------------------------------------------------------------------------+
|                                  Aslan Core (API Gateway)                                   |
|  - Auth & RBAC Evaluator (System vs Project Scopes)                                         |
|  - Environment Lifecycle Controller                                                         |
|  - Workflow Orchestration Engine                                                            |
|  - Template & RenderSet Engine                                                              |
+---------------------------------------------------------------------------------------------+
         |                                |                                   |
         v                                v                                   v
+-------------------+           +-------------------+               +-------------------+
|  Metadata Tier    |           | Distributed Lock  |               |  Execution Pods   |
|  MongoDB Cluster  |           | Redis Cluster     |               |  (Reaper/Agent)   |
|  - Environments   |           | - Env Write Locks |               |  - Helm Runner    |
|  - RenderSets     |           | - Pipeline Locks  |               |  - Docker/Kaniko  |
|  - Projects/RBAC  |           |                   |               |  - Test Executors |
+-------------------+           +-------------------+               +-------------------+
         |                                                                    |
         +---------------------------------+----------------------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |    Target Kubernetes Infrastructure   |
                       | - Dynamic Namespaces (dev, qa, prod)  |
                       | - Helm Release Controller / Secrets   |
                       | - Pod Workloads / Ingresses           |
                       +---------------------------------------+
```

1. **`aslan` (Core Engine)**: Houses business logic for project orchestration, multi-cluster dispatch, and environment modeling. Governed by Gin HTTP routers, internal repo packages (`commonrepo`), and service layers (`helmservice`, `envservice`).
2. **`zadig-agent` & `hub-server`/`hub-agent`**: Daemon agents running on target execution nodes or remote K8s clusters to pull tasks, execute local container actions, stream logs back via WebSockets/REST, and manage artifact workspaces.
3. **`upgradeassistant` (`ua`)**: Standalone migration tool orchestrating non-breaking database schema changes, webhook secret rotations across VCS providers (GitHub, GitLab, Gitee), and render-set data transformations.
4. **`halman` (AI Diagnostic Engine)**: Context-aware diagnostic service evaluating Grafana/Prometheus alert streams, querying job log excerpts, and generating repair plans for failing release pipelines.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Delta Merge Invariant for Distributed State Write-Backs

**RULE**:
When an asynchronous, long-running orchestrator (such as a Helm release manager or cloud provisioner) updates a sub-entity collection within a persistent document, it **MUST NOT** write back an in-memory snapshot of the collection taken at job invocation. The write-back operation **MUST** acquire a resource-level distributed lock, fetch the latest document state within a transactional session, calculate and apply only the *handled deltas*, and explicitly reconcile deletions.

**WHY**:
In distributed systems where updates take seconds or minutes (e.g., waiting for Kubernetes deployments or Helm chart releases), concurrent operations (such as a developer adding or editing another service) mutate the underlying collection in MongoDB. If the long-running worker finishes and overwrites the entire document or collection with its stale pre-execution snapshot, any concurrently added services or updated configurations are silently destroyed ("lost updates").

**WHEN TO APPLY**:
Apply to any long-running workflow, reconciliation loop, or orchestrator in Go/Python/Node/Java where an operation starts with a read of a composite state (e.g., microservices in an environment, nodes in a cluster) and persists mutations upon completion.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From zadig: pkg/microservice/aslan/core/common/service/helm/helm.go
func updateEnvServices(productName, envName string, production bool, updateBy string, 
    mutate func(env *commonmodels.Product, orchestration [][]string)) error {
    
    session := mongo.Session()
    defer session.EndSession(context.TODO())

    if err := mongo.StartTransaction(session); err != nil {
        return err
    }

    productColl := commonrepo.NewProductCollWithSession(session)

    // 1. Acquire distributed lock across independent processes
    envLock := cache.NewRedisLock(fmt.Sprintf("%s:%s:%s", UpdateHelmEnvLockKey, productName, envName))
    envLock.Lock()
    defer envLock.Unlock()

    // 2. Fetch fresh orchestrator template and target environment within transaction
    templateProduct, err := template.NewProductCollWithSess(session).Find(productName)
    if err != nil {
        mongo.AbortTransaction(session)
        return errors.Wrapf(err, "failed to find template product %s", productName)
    }
    orchestration := templateProduct.Services
    if production {
        orchestration = templateProduct.ProductionServices
    }

    env, err := productColl.Find(&commonrepo.ProductFindOptions{
        Name:       productName,
        EnvName:    envName,
        Production: &production,
    })
    if err != nil {
        mongo.AbortTransaction(session)
        return errors.Wrapf(err, "failed to find environment %s/%s", productName, envName)
    }

    // 3. Mutate only targeted delta records, preserving concurrent insertions
    mutate(env, orchestration)

    // 4. Commit atomic update
    if err = productColl.UpdateAllServices(productName, envName, env.Services, updateBy); err != nil {
        mongo.AbortTransaction(session)
        return fmt.Errorf("failed to update %s/%s product services, err %s", productName, envName, err)
    }

    return mongo.CommitTransaction(session)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: NEVER persist an entire stale array snapshot over a shared resource
func BuggyDeployWriteback(productName, envName string, initialSnapshot []*ProductService) error {
    // initialSnapshot was read 2 minutes ago before helm install started
    // Any service added by another user during those 2 minutes is wiped out!
    return db.Collection("products").UpdateOne(
        context.TODO(),
        bson.M{"name": productName, "env_name": envName},
        bson.M{"$set": bson.M{"services": initialSnapshot}},
    )
}
```

**VERIFICATION METHOD**:
Run a high-concurrency race integration test:
1. Initialize an environment with services `[A, B]`.
2. Trigger long-running Helm update on service `A` (artificially delayed by 2 seconds).
3. Concurrently invoke API endpoint to insert service `C`.
4. Allow update of `A` to complete.
5. Assert document contains `[A, B, C]`. An unhandled overwrite will produce `[A, B]`, failing the test.

---

### 2. Disambiguation Guard for Multi-Identity Resource Resolution

**RULE**:
When an API exposes retrieval or manipulation of a resource by a polymorphic or non-unique identifier (e.g., resolving a service by `ServiceName` OR `ReleaseName`), the lookup **MUST NOT** stop at the first match and **MUST NOT** fallback silently. It **MUST** scan the entire candidate namespace, count total identity collisions, and immediately abort with a 400 Bad Request if the target matches multiple distinct entities.

**WHY**:
In Kubernetes/Helm management platforms, a service named `api` can coexist with a Helm chart release named `api` backing a completely different service named `chart`. If lookup returns the first match arbitrarily, an update, restart, or delete command intended for the Helm release can silently delete or restart the wrong microservice pod, causing critical production outages.

**WHEN TO APPLY**:
Any entity lookup routine where queries accept alternative identity keys (e.g., Slug vs UUID, ReleaseName vs ServiceName, DNS name vs Container ID).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From zadig: pkg/microservice/aslan/core/environment/service/service.go
func getHelmServiceByName(env *commonmodels.Product, serviceName string, log *zap.SugaredLogger) (*commonservice.SvcResp, error) {
    var matched *commonmodels.ProductService
    for _, svc := range env.GetSvcList() {
        // Evaluate identity criteria across both namespaces
        if svc.ServiceName != serviceName && (svc.FromZadig() || svc.ReleaseName != serviceName) {
            continue
        }
        // Ambiguity guard: If already matched a previous entity, abort immediately!
        if matched != nil {
            return nil, e.ErrInvalidParam.AddDesc(fmt.Sprintf("%s matches multiple Helm services in env %s", serviceName, env.EnvName))
        }
        matched = svc
    }
    if matched == nil {
        return nil, fmt.Errorf("failed to find service %s", serviceName)
    }
    result, err := getHelmServiceRuntimeResources(env, serviceName, log)
    if err != nil {
        return nil, err
    }
    result.ReleaseName = matched.ReleaseName
    result.IsHelmChart = util.GetBoolPointer(!matched.FromZadig())
    return result, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: First-match-wins on overlapping namespaces
func GetAmbiguousService(env *Product, name string) *ProductService {
    for _, svc := range env.Services {
        if svc.ServiceName == name || svc.ReleaseName == name {
            return svc // HAZARD: Silent collision; returns wrong resource if name overlaps!
        }
    }
    return nil
}
```

**VERIFICATION METHOD**:
Table-driven unit test verifying collision handling:
```go
func TestAmbiguityRejection(t *testing.T) {
    env := &Product{
        Services: []*ProductService{
            {ServiceName: "api", Type: "helm"},
            {ServiceName: "chart", ReleaseName: "api", Type: "helmChart"},
        },
    }
    _, err := getHelmServiceByName(env, "api", zap.NewNop().Sugar())
    require.Error(t, err)
    require.Contains(t, err.Error(), "matches multiple Helm services")
}
```

---

### 3. Separation of Infrastructure Inventory vs Project Resource Authorization

**RULE**:
Cluster infrastructure inventory permissions (e.g., viewing connected Kubernetes clusters) **MUST NOT** be automatically treated as authorization to view or select cluster namespaces and workload candidates for CI/CD pipelines. Workload and namespace access **MUST** be verified against explicitly assigned project-level scopes (`ProjectActions.Env` or `ProjectActions.Workflow`).

**WHY**:
In enterprise multi-tenant platforms, infrastructure administrators register clusters globally. Developers or pipeline operators granted read-only visibility into cluster health or names must not inherit the ability to read namespaces, list active deployments, or deploy pipelines into namespaces belonging to unrelated tenants or business units sharing that physical cluster.

**WHEN TO APPLY**:
Multi-cluster Kubernetes management, multi-tenant cloud consoles, and any access-control system bridging infrastructure-level nodes with project-level runtime assets.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From zadig: pkg/microservice/aslan/core/multicluster/service/kube_authorization.go
func CanReadAllKubeResources(resources *user.AuthorizedResources, permission KubeResourcePermission) bool {
    actions := resources.SystemActions
    if actions == nil {
        return false
    }
    // Cluster visibility alone ONLY grants inventory list access, NOT workflow/namespace inspection.
    if permission == KubeClusterInventory &&
        actions.ClusterManagement != nil && actions.ClusterManagement.View {
        return true
    }
    // Workflow template operations require explicit template system-level authorisations.
    return permission == KubeWorkflowCandidates &&
        actions.Template != nil && (actions.Template.Create || actions.Template.Edit)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Leaking infrastructure-wide resources because user has cluster view access
func CanSelectNamespaces(user *User) bool {
    // BROKEN: Anyone with basic cluster view can now enumerate all enterprise namespaces
    if user.HasSystemPermission("ClusterManagement.View") {
        return true
    }
    return user.HasProjectPermission(...)
}
```

**VERIFICATION METHOD**:
Automated RBAC suite testing identity permutation:
```go
func TestClusterViewerDeniedNamespaceSelector(t *testing.T) {
    ctx := &user.AuthorizedResources{
        SystemActions: &user.SystemActions{
            ClusterManagement: &user.ClusterManagementActions{View: true},
        },
    }
    assert.True(t, CanReadAllKubeResources(ctx, KubeClusterInventory))
    assert.False(t, CanReadAllKubeResources(ctx, KubeNamespaceCandidates))
    assert.False(t, CanReadAllKubeResources(ctx, KubeWorkflowCandidates))
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Drop of Concurrently Added Services During Helm Retry (BUG-ZADIG-01)
- **Context**: `pkg/microservice/aslan/core/common/service/helm/helm.go`, `kube/helm.go`, `environment/service/environment.go`
- **What Was Expected**: When a multi-service Helm deployment is executed, retrying services or long deployment cycles should update their release records without altering or dropping microservices newly introduced to the environment by concurrent operations.
- **What Actually Happened**: `DeployMultiHelmRelease` retrieved the full environment record at the start of deployment. Once finished, it invoked `UpdateServicesGroupInEnv`, passing the entire in-memory slice of services. If another service was added to the environment during the deployment/retry loop, the write-back overwrote the collection with the initial snapshot, silently dropping the new service from the database while leaving its Helm release orphan in the cluster.
- **Evidence in Repo**: Commit `5b93a125`, PR #5105.
- **Root Cause**: Coarse-grained snapshot replacement over an aggregated state array without delta isolation or atomic merging under lock.
- **Remediation Code Diff**:
```go
// In pkg/microservice/aslan/core/common/service/kube/helm.go
- err := helmservice.UpdateServicesGroupInEnv(productName, envName, groupIndex, groupServices, productResp.Production, user)
+ // only services handled by this operation are written back
+ handledServices := make([]*commonmodels.ProductService, 0)
+ for _, prodSvc := range groupServices {
+     // ... filter checks ...
+     handledServices = append(handledServices, prodSvc)
+ }
+ err := helmservice.MergeServicesInEnv(productName, envName, groupIndex, groupServices, handledServices, productResp.Production, user)
```
- **Lesson**: Never persist state arrays via whole-document replacement when operations have non-negligible duration. Segregate mutated subsets ("handled") and perform read-modify-write inside a distributed lock.

---

### Incident 2: Cross-Tenant Target Selector Leakage via Unchecked Cluster Queries (BUG-ZADIG-02)
- **Context**: `pkg/microservice/aslan/core/multicluster/handler/clusters.go` and `pkg/microservice/aslan/core/multicluster/service/cluster_selector.go`
- **What Was Expected**: Non-admin users selecting Kubernetes clusters for deployment targets should only see clusters explicitly bound to their specific project via `ProjectClusterRelation`.
- **What Actually Happened**: The endpoint accepted `?scene=selector`. If a non-admin lacked global permissions, it allowed querying candidates with flawed authorization bypass routines in `ListClusterSelectors`, returning cluster connection metadata without verifying valid project binding for the requesting user context.
- **Evidence in Repo**: Commit `d74cc159`, PR #5095.
- **Root Cause**: Blurring of concerns between infrastructure management (`KubeClusterInventory`) and tenant workflow selection (`KubeWorkflowCandidates`), leading to an entire unneeded endpoint and authorization helper that bypassed standard project checks.
- **Remediation Code Diff**:
```go
// In pkg/microservice/aslan/core/multicluster/handler/clusters.go
- if c.Query("scene") == "selector" {
-     args := service.KubeResourceArgs{}
-     if err := c.ShouldBindQuery(&args); err != nil {
-         ctx.RespErr = e.ErrInvalidParam.AddErr(err)
-         return
-     }
-     candidates, err := service.ListClusterSelectors(ctx, clusters, args)
-     // ...
- }

// Entire pkg/microservice/aslan/core/multicluster/service/cluster_selector.go DELETED (104 lines removed)
// Replaced with strict project binding checks in core handlers.
```
- **Lesson**: Do not introduce ad-hoc "selector" or "quick-list" endpoints that short-circuit foundational domain authorization models. Delete speculative convenience code.

---

### Incident 3: Halman AI Diagnostic Hangs and Microtask Starvation on Non-Log Job Types (BUG-ZADIG-03)
- **Context**: `pkg/microservice/aslan/config/consts.go` and `pkg/microservice/aslan/core/log/handler/excerpt.go`
- **What Was Expected**: When the AI diagnostic copilot or user inspects a failed pipeline, requesting log excerpts for arbitrary failed jobs should return immediately or indicate lack of logs.
- **What Actually Happened**: Non-executing or metadata-only job types (e.g., custom webhooks, Apisix route syncs) do not produce archived execution log streams. Calling `GetWorkflowLogExcerpt` caused the storage provider to search or stream against nonexistent log objects, causing timeouts, high retry loops, and blocking onboarding flows.
- **Evidence in Repo**: Commit `0b80d9e7`, PR #5100.
- **Root Cause**: Missing type predicate determining whether a pipeline stage/job is capable of producing container execution stdout/stderr logs.
- **Remediation Code Diff**:
```go
// In pkg/microservice/aslan/config/consts.go
+ func JobHasExecutionLogs(jobType JobType) bool {
+     switch jobType {
+     case JobBuild, JobZadigBuild, JobZadigVMDeploy, JobFreestyle,
+          JobZadigTesting, JobZadigScanning, JobZadigDistributeImage,
+          JobZadigDeploy, JobZadigHelmDeploy, JobPlugin:
+          return true
+     default:
+          return false
+     }
+ }

// In pkg/microservice/aslan/core/log/handler/excerpt.go
+ if !logSupported {
+     c.JSON(http.StatusOK, logservice.LogExcerpt{Offset: offset, NextOffset: offset, Unsupported: true})
+     return
+ }
```
- **Lesson**: Before dispatching expensive I/O operations for artifact retrieval, validate domain type capabilities using explicit compile-time/static predicates.

---

### Incident 4: Arbitrary File System Path Traversal in Agent Directory Pruning (BUG-ZADIG-04)
- **Context**: `pkg/cli/zadig-agent/util/dir.go`
- **What Was Expected**: The agent helper function `DeletePathToRoot(rootDir, subDir)` must safely delete child directories inside a workspace directory tree upwards to `rootDir` without crossing into system folders.
- **What Actually Happened**: If an unvalidated `subDir` containing relative backtracking paths (e.g., `/workspace/build/../../etc`) was passed, it could compute invalid boundaries and attempt recursive deletion of critical host filesystem paths outside `rootDir`.
- **Evidence in Repo**: `pkg/cli/zadig-agent/util/dir.go` lines 46–54.
- **Root Cause**: Directory containment check lacked prefix-level relative path validation.
- **Remediation Code Diff**:
```go
// In pkg/cli/zadig-agent/util/dir.go
func DeletePathToRoot(rootDir, subDir string) error {
-   // No containment verification
+   // Ensure that the subdirectory is a subdirectory of the root directory
+   if !isSubdirectory(rootDir, subDir) {
+       return fmt.Errorf("The subdirectory is not a subdirectory of the root directory.")
+   }
    for subDir != rootDir {
        err := os.RemoveAll(subDir)
        // ...
        subDir = filepath.Dir(subDir)
    }
    return nil
}

+ func isSubdirectory(rootDir, subDir string) bool {
+     rel, err := filepath.Rel(rootDir, subDir)
+     if err != nil {
+         return false
+     }
+     return !strings.HasPrefix(rel, "..") && !strings.HasPrefix(rel, ".")
+ }
```
- **Lesson**: When performing destructive filesystem operations, strictly enforce relative path containment using `filepath.Rel` and assert no `..` or `.` prefix traversal exists.

---

### Incident 5: Secret Exposure via VCS HTTP Error Responses during Webhook Rotation (BUG-ZADIG-05)
- **Context**: `pkg/cli/upgradeassistant/internal/rotation/webhook.go`
- **What Was Expected**: When rotating webhook tokens across GitHub, GitLab, and Gitee, network errors or API authentication failures should log human-readable diagnostic messages without leaking payload secrets.
- **What Actually Happened**: Standard HTTP client loggers print full error response structs (`gh.Response`, `gitlab.ErrorResponse`). When updating a hook secret via `UpdateHook` / `EditProjectHook`, the request body contains the plaintext shared secret and token. Unfiltered logging of the response or error structure dumped the updated secrets into system console and migration logs.
- **Evidence in Repo**: `pkg/cli/upgradeassistant/internal/rotation/webhook.go` lines 45–66.
- **Root Cause**: Direct stringification of external vendor API error structs without redaction.
- **Remediation Code Diff**:
```go
// In pkg/cli/upgradeassistant/internal/rotation/webhook.go
func (a *hookAction) failure(operation string, err error) error {
-   // fmt.Sprintf("failed: %v", err) -> Dumps SDK internal structures with secret payload
+   // Never print SDK response bodies: they may contain credentials or the new secret.
+   reason := "request failed; verify connectivity and token permissions"
+   var gh *githubapi.ErrorResponse
+   var gl *gitlabapi.ErrorResponse
+   var response *httpclient.Error
+   switch {
+   case errors.Is(err, context.Canceled):
+       reason = "request canceled"
+   case errors.Is(err, context.DeadlineExceeded):
+       reason = "request timed out"
+   case errors.As(err, &gh) && gh.Response != nil:
+       reason = fmt.Sprintf("HTTP %d", gh.Response.StatusCode)
+   case errors.As(err, &gl) && gl.Response != nil:
+       reason = fmt.Sprintf("HTTP %d", gl.Response.StatusCode)
+   case errors.As(err, &response):
+       reason = fmt.Sprintf("HTTP %d", response.Code)
+   }
+   return fmt.Errorf("webhook %s/%s, code host %d(%s), hook %s: %s: %s", 
+       a.hook.Owner, a.hook.Repo, a.host.ID, a.host.Alias, a.hook.HookID, operation, reason)
}
```
- **Lesson**: SDK response objects for authentication and webhook management endpoints are high-risk credential vectors; map them exclusively to HTTP status codes and static descriptions in error returns.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
- **Slice Sub-slicing Reslice Mutation**: In `mergeServicesIntoGroups`, service deletion is done in-place via:
  ```go
  groups[gi] = append(groups[gi][:si], groups[gi][si+1:]...)
  ```
  *Hazard*: In Go, `append(a[:si], a[si+1:]...)` mutates the underlying array backing `groups[gi]`. If any reference retains a slice pointing to that storage, its values mutate unpredictably. *Invariant*: When mutating a nested 2D slice (`[][]*ProductService`), always assign the result back directly to `groups[gi]`, and ensure no outer loop holds a stale subslice iterator pointer.
- **Pointer Set Tracking Hazard**: In `mergeServicesIntoGroups`:
  ```go
  handledSet := make(map[*commonmodels.ProductService]bool, len(handled))
  ```
  *Hazard*: Mapping by pointer `*ProductService` checks reference equality, NOT value identity (`ServiceName`). If `handled` items were instantiated anew from a different decoding path or database query, pointer checks evaluate to `false` even if the service name matches. *Invariant*: Only use pointer key maps if both sets are guaranteed to share pointers within the same memory scope; otherwise, map by composite key `fmt.Sprintf("%s/%s", svc.ServiceName, svc.Type)`.
- **64-bit to 32-bit Integer Truncation (Gitee Hook API)**:
  ```go
  id, err := strconv.ParseInt(hook.HookID, 10, 64)
  if id > math.MaxInt32 {
      return nil, fmt.Errorf("... hook ID exceeds Gitee API range ...")
  }
  ```
  *Hazard*: Gitee SDK expects `int32(id)`. Silently casting `int32(id)` when `id > 2147483647` wraps the integer to negative values, causing 404/400 errors or updating the wrong webhook.

### 4.2 Infinite Loop & Recursion Guards
- **Termination Invariants in Directory Ascent**:
  ```go
  for subDir != rootDir {
      err := os.RemoveAll(subDir)
      subDir = filepath.Dir(subDir)
  }
  ```
  *Hazard*: On Windows or POSIX, if `subDir` is root (`/` or `C:\`) or an unrooted path (`foo`), `filepath.Dir("foo")` returns `"."`. If `rootDir` is `""`, the loop runs infinitely.
  *Guaranteed Termination Proof*:
  1. Base precondition `isSubdirectory(rootDir, subDir)` proves `subDir` strictly descends from `rootDir`.
  2. In every iteration, `filepath.Dir(subDir)` produces a strictly shorter path string closer to `rootDir`.
  3. When `subDir == rootDir`, equality terminates execution.
- **Log Excerpt NextOffset Pagination Loop**:
  In `pkg/microservice/aslan/core/log/handler/excerpt.go`:
  When a job type does not produce execution logs (`!logSupported`), setting `NextOffset: offset` with `Unsupported: true` prevents consumer UI/polling agents from creating infinite retry query loops.

### 4.3 UI & UX Micro-Mechanics
- **Multi-Helm Service Disambiguation Feedback**: When a user inputs a query string in the environment console, matching both an internal service and a deployed Helm chart triggers an explicit `400 Bad Request` with descriptive text (`%s matches multiple Helm services in env %s`), preventing ambiguous UI tabs from rendering broken state.
- **Status Reason Categorization for Agent HTTP Responses**:
  In `pkg/cli/zadig-agent/util/client/errors.go`, HTTP response status codes are converted into canonical `StatusReason` types (`StatusReasonConflict`, `StatusReasonAlreadyExists`, `StatusReasonInvalid`, `StatusReasonTooManyRequests`). This allows downstream UIs and CLI prompts to distinguish between retriable 409s (concurrent modification requiring re-fetch) and non-retriable 409s (entity name already exists).

### 4.4 Backend Concurrency & Memory Safety
- **Two-Tier Distributed Locking (Redis + Mongo Transaction)**:
  `updateEnvServices` wraps mutations inside both a Redis key lock (`UpdateHelmEnvLockKey:productName:envName`) and a MongoDB transactional session (`mongo.StartTransaction(session)`).
  *Invariant*: The Redis distributed lock protects against high-frequency CPU-bound race conditions across disparate Aslan pods; the MongoDB transaction ensures ACID rollback if the database connection drops or validation fails midway.
- **Client Goroutine Timeout & Transport Invariant**:
  ```go
  r.SetTimeout(TimeoutSeconds * time.Second)
  ```
  Agent HTTP clients explicitly configure both a default 60s timeout and a dedicated transport. When performing unbounded streaming (`Download`), timeout is explicitly removed via `UnsetTimeout()` while wrapping the file sink in a deferred close to prevent file descriptor leaks.

### 4.5 Defect & Error Prevention ("Galti Pakadna")
- **Nil Option Dereferencing in MongoDB Queries**:
  In `pkg/cli/upgradeassistant/internal/repository/mongodb/render_set.go`:
  ```go
  func (c *RenderSetColl) Find(opt *RenderSetFindOption) (*models.RenderSet, error) {
      if opt == nil {
          return nil, errors.New("RenderSetFindOption cannot be nil")
      }
      // ...
  }
  ```
  Guards against silent nil dereferences when option builders fail or pass nil parameters.
- **Reflection BSON Tag Mapping Shield**:
  In `pkg/cli/upgradeassistant/cmd/migrate/utils.go`:
  `getMigrationFieldBsonTag` compares memory addresses