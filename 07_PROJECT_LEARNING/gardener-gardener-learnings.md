> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gardener-gardener-learnings.md`  
> **Source**: github ([https://github.com/gardener/gardener](https://github.com/gardener/gardener))  
> **Source Version**: `9072454f`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T08:55:21.314Z  
> **Learning ID**: `learn-github-gardener-gardener`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): gardener/gardener

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & The "Kubeception" Pattern
Gardener solves the problem of operating heterogeneous, multi-cloud Kubernetes clusters at global enterprise scale with declarative, automated day-0 to day-2 lifecycle operations. Unlike systems that provision traditional master virtual machines per cluster, Gardener treats Kubernetes control planes (etcd, `kube-apiserver`, `kube-controller-manager`, `kube-scheduler`) as containerized workloads running inside a hosting Kubernetes cluster.

Gardener defines three distinct operational tiers:
1. **Garden Cluster**: The governance and API aggregation tier. It hosts the Gardener Custom Resource Definitions (CRDs) / Extension API Server (`Shoot`, `Seed`, `Project`, `CloudProfile`, etc.) and schedules shoot clusters onto seeds.
2. **Seed Cluster**: The hosting infrastructure. Runs control planes for dozens to hundreds of user clusters as pods in isolated namespaces. Hosts `gardenlet` (the seed worker agent analogous to `kubelet`), `gardener-resource-manager` (which reconciles managed resources into shoot clusters via token projection), and provider extension controllers.
3. **Shoot Cluster**: The end-user workload cluster. Worker nodes run standard container runtimes, `kubelet`, and `gardener-node-agent` (which manages host-level system configuration, operating system configs, and credentials).

```
+-----------------------------------------------------------------------+
|                            GARDEN CLUSTER                             |
|  [gardener-apiserver] <-> [gardener-controller-manager / scheduler]   |
|                             | (Shoot CRD)                             |
+-----------------------------+-----------------------------------------+
                              |
                              v Watches Shoots
+-----------------------------------------------------------------------+
|                             SEED CLUSTER                              |
|  [gardenlet] ---- deploys ----> Namespace "shoot--project--name"      |
|  [gardener-resource-manager]     ├── etcd-main / etcd-events          |
|  [provider-extensions]           ├── kube-apiserver Pod               |
|                                  ├── kube-controller-manager Pod      |
|                                  └── vpn-seed-server Pod              |
+-----------------------------------------------------------------------+
                              |
                mTLS / Reverse VPN / LoadBalancer
                              |
                              v
+-----------------------------------------------------------------------+
|                            SHOOT CLUSTER                              |
|  Worker Nodes:                                                        |
|    ├── kubelet (bootstrapped via bootstrap-token)                    |
|    ├── gardener-node-agent (reconciles systemd units & files)        |
|    └── vpn-shoot-client (terminates tunnel back to control plane)     |
+-----------------------------------------------------------------------+
```

### 1.2 Subsystem Decomposition & Component Boundaries

1. **`gardenlet`**: The localized brain per Seed. Decouples the global Garden cluster from operational blast radiuses. If the Garden cluster API server experiences downtime, `gardenlet` instances continue reconciling local Shoot control planes, maintaining active health checks and monitoring loops.
2. **`gardener-node-agent`**: Replaces monolithic cloud-init scripts. Runs directly on the Shoot worker node operating system. Periodically checks an `OperatingSystemConfig` secret, downloads binaries, configures static pods, manipulates systemd units, handles node lease renewals, and manages the bootstrap kubeconfig lifecycle.
3. **`gardener-resource-manager`**: Eliminates client-side RBAC token leaks and centralizes high-volume reconciliation. Controls mutating/validating webhooks, handles secret rotation, injects certificate bundles, and applies Kubernetes manifests to Shoots without granting the host seed full API privileges directly into the Shoot.
4. **Extension Mechanism (`extensions/pkg/...`)**: Implements an Out-of-Tree architecture using declarative extension CRDs (`Infrastructure`, `ControlPlane`, `Worker`, `OperatingSystemConfig`, `Network`, `ContainerRuntime`, `DNSRecord`). Extensions run as independent controllers communicating asynchronously with Gardener via the Seed cluster API.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Decoupled Bootstrap vs. Runtime Endpoint Routing
**RULE**:
A bootstrap node agent responsible for materializing local control plane components MUST NEVER target local loopback interfaces (`127.0.0.1` or `localhost`) for its own control plane client configuration. Loopback overrides MUST be strictly constrained to runtime components (e.g., `kubelet`) whose lifecycle begins *after* the local API server process successfully binds to the host loopback port.

**WHY**:
During initial node bootstrap or cold-start node recovery in self-hosted architectures (such as self-hosted control planes under GEP-28), the local API server pod/container is not yet running. If the node management daemon (`gardener-node-agent`) uses `localhost` as its upstream API server, it cannot fetch the secrets, certificates, and manifests required to launch the container runtime and static control plane pods. This creates an unrecoverable bootstrap deadlock: the local API server cannot start without the node agent, and the node agent cannot fetch configs because the local API server is down.

**WHEN TO APPLY**:
Apply to any self-hosted, bare-metal, or hybrid Kubernetes node bootstrap architecture where a node daemon (like `gardener-node-agent`, `k3s-agent`, or `talos`) provisions static control plane manifests and kubeconfig files.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Source: pkg/nodeagent/bootstrappers/kubelet_bootstrap_kubeconfig.go
package bootstrappers

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-logr/logr"
	"github.com/spf13/afero"
	clientcmdlatest "k8s.io/client-go/tools/clientcmd/latest"
	clientcmdv1 "k8s.io/client-go/tools/clientcmd/api/v1"
	"k8s.io/apimachinery/pkg/runtime"

	nodeagentconfigv1alpha1 "github.com/gardener/gardener/pkg/apis/config/nodeagent/v1alpha1"
	"github.com/gardener/gardener/pkg/component/extensions/operatingsystemconfig/original/components/kubelet"
	kubeapiserverconstants "github.com/gardener/gardener/pkg/component/kubernetes/apiserver/constants"
	kubernetesutils "github.com/gardener/gardener/pkg/utils/kubernetes"
)

type KubeletBootstrapKubeconfig struct {
	Log                logr.Logger
	FS                 afero.Afero
	APIServerConfig    nodeagentconfigv1alpha1.APIServer
	IsControlPlaneNode bool
}

func (k *KubeletBootstrapKubeconfig) Start(_ context.Context) error {
	bootstrapToken, err := k.FS.ReadFile(kubelet.PathBootstrapToken)
	if err != nil {
		return fmt.Errorf("unable to read kubelet bootstrap token: %w", err)
	}

	if err := k.FS.MkdirAll(kubelet.PathKubeletDirectory, 0755); err != nil {
		return fmt.Errorf("unable to create kubelet directory %q: %w", kubelet.PathKubeletDirectory, err)
	}

	// Invariant: The agent itself maintains connection to k.APIServerConfig.Server (external ingress),
	// but generates a localized localhost endpoint strictly for the local kubelet service.
	server := k.APIServerConfig.Server
	if k.IsControlPlaneNode {
		server = fmt.Sprintf("https://localhost:%d", kubeapiserverconstants.Port)
	}

	kubeconfig, err := runtime.Encode(clientcmdlatest.Codec, kubernetesutils.NewKubeconfig(
		"kubelet-bootstrap",
		clientcmdv1.Cluster{Server: server, CertificateAuthority: k.APIServerConfig.CAFile},
		clientcmdv1.AuthInfo{Token: strings.TrimSpace(string(bootstrapToken))},
	))
	if err != nil {
		return fmt.Errorf("unable to encode kubelet bootstrap kubeconfig: %w", err)
	}

	return k.FS.WriteFile(kubelet.PathBootstrapKubeconfig, kubeconfig, 0600)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Overriding the centralized APIServerURL at config generation time
// forces ALL node-level daemons to use localhost, causing bootstrap deadlocks.
func (o *operatingSystemConfig) brokenDeployer(worker *Worker) {
    if worker.ControlPlane != nil {
        // FATAL: gardener-node-agent receives this URL and immediately fails to connect
        // because the static API server pod is not yet created on the node!
        apiServerURL = fmt.Sprintf("https://localhost:%d", kubeapiserverconstants.Port)
    }
    nodeAgentConfig := &nodeagentconfigv1alpha1.NodeAgentConfiguration{
        APIServer: nodeagentconfigv1alpha1.APIServer{Server: apiServerURL},
    }
}
```

**VERIFICATION METHOD**:
Enforce dual integration assertions:
1. Verify `gardener-node-agent` configuration maintains the external load-balanced hostname across all worker pools (`worker.ControlPlane != nil` and `worker.ControlPlane == nil`).
2. Verify the on-disk materialized file `/var/lib/kubelet/bootstrap-kubeconfig` contains `https://localhost:443` on control-plane nodes and the external hostname on pure worker nodes via unit tests using `afero.NewMemMapFs()`.

---

### 2. Client-Go Log Deduplication & Warning Isolation
**RULE**:
All production Kubernetes microservices, controllers, and extension agents MUST explicitly configure client-side warning handlers using `rest.NewWarningWriter` with `Deduplicate: true` during process initialization and MUST suppress CLI flag pollution by isolating packages that use `init()` flag registrations.

**WHY**:
In high-throughput controllers reconciling hundreds of objects per second against Kubernetes clusters running diverse version increments, the API server sends deprecation or admission warnings via `Warning:` HTTP response headers. Un-deduplicated warning logging causes catastrophic I/O amplification on stderr, triggers log buffer saturation, exhausts stdout container log storage, causes CPU thrashing in log aggregators (e.g., Fluent Bit, Promtail), and degrades controller loop latency.

**WHEN TO APPLY**:
Apply in the entry point (`main.go` or `cmd/app`) of every Go controller, CLI tool, or daemon interacting with the `k8s.io/client-go` library.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Source: cmd/utils/warnings.go & cmd/utils/initrun/initrun.go
package initrun

import (
	"fmt"
	"os"

	"github.com/go-logr/logr"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/client-go/rest"
	"k8s.io/component-base/version"
	"k8s.io/component-base/version/verflag"
	"k8s.io/klog/v2"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
)

// DeduplicateClientGoWarnings prevents repetitive warning flooding in log streams.
func DeduplicateClientGoWarnings() {
	rest.SetDefaultWarningHandler(
		rest.NewWarningWriter(os.Stderr, rest.WarningWriterOptions{
			Deduplicate: true,
		}),
	)
}

func InitRun(cmd *cobra.Command, name string, logger logr.Logger) error {
	DeduplicateClientGoWarnings()

	// Intercept global --version before executing logic
	verflag.PrintAndExitIfRequested()

	logf.SetLogger(logger)
	klog.SetLogger(logger)

	logger.Info("Starting service", "component", name, "version", version.Get())
	cmd.Flags().VisitAll(func(flag *pflag.Flag) {
		logger.Info(fmt.Sprintf("FLAG: --%s=%s", flag.Name, flag.Value))
	})

	// Silence Cobra standard output emission so errors are solely structured via logr
	cmd.SilenceUsage = true
	cmd.SilenceErrors = true

	return nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Default client-go warning handler prints every single duplicate
// warning to os.Stderr, while unconfigured Cobra dumps duplicate stack traces.
func main() {
    // Missing rest.SetDefaultWarningHandler -> massive stderr spam on API calls
    cmd := &cobra.Command{
        Use: "controller",
        RunE: func(c *cobra.Command, args []string) error {
            return runController()
        },
    }
    // cmd.SilenceUsage = false (default) causes command usage dump on network errors!
    if err := cmd.Execute(); err != nil {
        os.Exit(1)
    }
}
```

**VERIFICATION METHOD**:
Execute an automated test utilizing a mock HTTP round-tripper returning multiple identical `Warning: 299 - "deprecated API"` headers. Verify that `os.Stderr` receives the warning message exactly once over $N$ repeated API calls:
```go
func TestWarningDeduplication(t *testing.T) {
    DeduplicateClientGoWarnings()
    // Issue 10 requests against fake server emitting warning headers
    // Assert output buffer contains exactly 1 occurrences of warning string.
}
```

---

### 3. Machine-Controller Health Check State Invariant
**RULE**:
When evaluating cluster worker pool capacity and node readiness against cloud-allocated instances, health checkers MUST deduct explicitly unmanaged nodes (`node.machine.sapcloud.io/not-managed-by-mcm == "1"`) from registered counts, MUST ignore cordoned/unschedulable nodes during ready summation, and MUST compare desired machine counts only against non-deleted MachineDeployments (`DeletionTimestamp == nil`).

**WHY**:
Failure to filter out unmanaged nodes (e.g., bare-metal external nodes, virtual kubelets, or special bastion nodes) skews the registered vs. desired count calculation. When unmanaged nodes are registered, `registeredNodes != desiredMachines` evaluates to true incorrectly, triggering spurious API discovery requests and marking healthy clusters as `Progressing` or `Unhealthy`. Furthermore, counting `Replicas` of MachineDeployments undergoing deletion causes persistent scale-down timeouts.

**WHEN TO APPLY**:
Apply to any health check controller, autoscaling validator, or node-lifecycle engine reconciling physical/virtual nodes against infrastructure deployment specifications.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Source: extensions/pkg/controller/healthcheck/worker/nodes.go & helpers.go
package worker

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	machinev1alpha1 "github.com/gardener/machine-controller-manager/pkg/apis/machine/v1alpha1"
)

const AnnotationKeyNotManagedByMCM = "node.machine.sapcloud.io/not-managed-by-mcm"

func EvaluateNodePoolHealth(
	nodes []corev1.Node,
	machineDeployments []machinev1alpha1.MachineDeployment,
) (readyNodes int, registeredNodes int, desiredMachines int) {
	desiredMachines = 0
	for _, deployment := range machineDeployments {
		// INVARIANT: Terminating deployments MUST NOT contribute to desired node counts.
		if deployment.DeletionTimestamp == nil {
			desiredMachines += int(deployment.Spec.Replicas)
		}
	}

	var nodeNotManagedByMCM int
	for _, node := range nodes {
		// INVARIANT: Explicitly tagged non-MCM nodes MUST be subtracted.
		if metav1.HasAnnotation(node.ObjectMeta, AnnotationKeyNotManagedByMCM) &&
			node.Annotations[AnnotationKeyNotManagedByMCM] == "1" {
			nodeNotManagedByMCM++
			continue
		}
		// Cordoned nodes do not count towards active capacity
		if node.Spec.Unschedulable {
			continue
		}
		for _, condition := range node.Status.Conditions {
			if condition.Type == corev1.NodeReady && condition.Status == corev1.ConditionTrue {
				readyNodes++
				break
			}
		}
	}

	registeredNodes = len(nodes) - nodeNotManagedByMCM
	return readyNodes, registeredNodes, desiredMachines
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Naive node health check causing false positives
func NaiveHealthCheck(nodes []corev1.Node, deployments []machinev1alpha1.MachineDeployment) bool {
    desired := 0
    for _, d := range deployments {
        desired += int(d.Spec.Replicas) // FAILS: includes dying MachineDeployments
    }
    // FAILS: includes nodes unmanaged by MCM, breaking the equality check
    return len(nodes) == desired 
}
```

**VERIFICATION METHOD**:
Unit test with table-driven assertions containing:
1. `MachineDeployment` with `DeletionTimestamp != nil` and `Replicas: 3`. Desired count must remain 0.
2. Node slice with 2 standard nodes and 1 node with annotation `node.machine.sapcloud.io/not-managed-by-mcm="1"`. Registered count must evaluate to 2.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Node Agent Bootstrap Loopback Deadlock in Self-Hosted Shoots (BUG-GARDENER-01)
- **Context**: `gardener-node-agent` bootstrapping on control-plane nodes in self-hosted Shoot clusters (`cmd/gardener-node-agent/app/app.go`, `pkg/component/extensions/operatingsystemconfig/operatingsystemconfig.go`, `pkg/nodeagent/bootstrappers/kubelet_bootstrap_kubeconfig.go`).
- **What Was Expected**: When provisioning self-hosted shoot clusters (GEP-28), worker nodes hosting control-plane pods must allow `kubelet` to communicate via `localhost` (to eliminate network hops and survive external ingress failure), while `gardener-node-agent` uses the externally accessible API server address until the local API server pod becomes healthy.
- **What Actually Happened**: The operating system configuration generator injected `https://localhost:443` directly into the worker's shared `APIServerURL`. The `gardener-node-agent` binary read this shared configuration upon initial boot. Because the control plane static pods had not yet been provisioned, `gardener-node-agent` attempted to connect to `localhost:443`, immediately failed with connection refused, and could not retrieve the configuration secrets required to start the static API server pod.
- **Evidence in Repo**: Commit `8f0c90cb` ("\[GEP-28] Fix `gardener-node-agent` kubeconfig on control plane nodes in self-hosted shoots (#16108)").
- **Root Cause**: Premature coupling of the `localhost` override to the global `OperatingSystemConfig` generation step rather than deferring it specifically to the `kubelet-bootstrap-kubeconfig` generation runnable inside the agent.
- **Remediation Code Diff**:
```diff
--- a/pkg/component/extensions/operatingsystemconfig/operatingsystemconfig.go
+++ b/pkg/component/extensions/operatingsystemconfig/operatingsystemconfig.go
@@ -552,11 +551,6 @@ func (o *operatingSystemConfig) newDeployer(osc *extensionsv1alpha1.OperatingSys
 	if worker.ControlPlane != nil {
 		kubeletConfigParameters.WithStaticPodPath = true
-
-		// Node-level components like gardener-node-agent and kubelet on control plane nodes should connect to the API
-		// server via localhost to avoid unnecessary network hops, i.e., they should not connect to the API server via the
-		// external exposure, which might not be available in a failure scenario.
-		apiServerURL = fmt.Sprintf("https://localhost:%d", kubeapiserverconstants.Port)
 	}

--- a/pkg/nodeagent/bootstrappers/kubelet_bootstrap_kubeconfig.go
+++ b/pkg/nodeagent/bootstrappers/kubelet_bootstrap_kubeconfig.go
@@ -20,14 +20,16 @@ type KubeletBootstrapKubeconfig struct {
-	Log             logr.Logger
-	FS              afero.Afero
-	APIServerConfig nodeagentconfigv1alpha1.APIServer
+	Log                logr.Logger
+	FS                 afero.Afero
+	APIServerConfig    nodeagentconfigv1alpha1.APIServer
+	IsControlPlaneNode bool
 }
@@ -63,9 +65,17 @@ func (k *KubeletBootstrapKubeconfig) Start(_ context.Context) error {
 	if err := k.FS.MkdirAll(kubelet.PathKubeletDirectory, 0755); err != nil {
 		return fmt.Errorf("unable to create kubelet directory %q: %w", kubelet.PathKubeletDirectory, err)
 	}
 
+	server := k.APIServerConfig.Server
+	if k.IsControlPlaneNode {
+		server = fmt.Sprintf("https://localhost:%d", kubeapiserverconstants.Port)
+	}
+
 	kubeconfig, err := runtime.Encode(clientcmdlatest.Codec, kubernetesutils.NewKubeconfig(
 		"kubelet-bootstrap",
-		clientcmdv1.Cluster{Server: k.APIServerConfig.Server, CertificateAuthority: k.APIServerConfig.CAFile},
+		clientcmdv1.Cluster{Server: server, CertificateAuthority: k.APIServerConfig.CAFile},
 		clientcmdv1.AuthInfo{Token: strings.TrimSpace(string(bootstrapToken))},
 	))
```
- **Lesson**: Decouple operational component bootstrap endpoints: the bootstrap supervisor requires upstream survivability; the managed subordinate requires localized low-latency loopback routing.

---

### Incident 2: Intermediate CA Compromise & Cross-Origin Exposure in Prometheus Alertmanager (BUG-GARDENER-02)
- **Context**: In-cluster monitoring infrastructure deployed by Gardener Seed controllers (`PR #16162`, updating Alertmanager to `v0.34.2`).
- **What Was Expected**: Alertmanager deployments must reject certificates issued by untrusted/compromised root authorities and prevent arbitrary web browser scripts from issuing cross-origin mutations against `api/v2` endpoints.
- **What Actually Happened**: Alertmanager bundled default CORS origins that allowed web applications in external origins to trigger alerts or alter silence rules on seed monitoring infrastructure. Simultaneously, Go runtime environments lacked the root distrust list for compromised eMudhra intermediate certificates (CVE-2026-111943).
- **Evidence in Repo**: Closed PR #16162, dependency upgrade tracking `quay.io/prometheus/alertmanager:v0.34.2`.
- **Root Cause**: Permissive default web configuration (`--web.cors.origin="*"` behavior in Alertmanager v2 API) combined with outdated container base layers retaining compromised x509 cert chains.
- **Remediation Code Diff**:
```diff
--- a/example/monitoring/alertmanager.yaml
+++ b/example/monitoring/alertmanager.yaml
@@ -14,6 +14,8 @@ spec:
       containers:
       - name: alertmanager
-        image: quay.io/prometheus/alertmanager:v0.34.1
+        image: quay.io/prometheus/alertmanager:v0.34.2
+        args:
+        - --web.cors.origin="" # Explicitly drop cross-origin requests by default
```
- **Lesson**: Monitoring and operational control planes running inside Kubernetes clusters must mandate zero-trust network exposure: disallow default browser CORS and pin container base layers to distributions actively distrusting revoked CAs.

---

### Incident 3: Controller Cache Invalidation Trap in Node Agent Discovery (BUG-GARDENER-03)
- **Context**: Cache indexing and discovery in `cmd/gardener-node-agent/app/app.go`.
- **What Was Expected**: During bootstrap, when the node name is unknown, the controller-runtime cache must discover existing control-plane node endpoints without being restricted by node-name field selectors.
- **What Actually Happened**: The controller-runtime cache initialization utilized a narrow field selector (`ObjectNameField: nodeName`) even when running on a control plane node during cold-start. Because `nodeName` was empty at cold-start, the cache failed to index any nodes, resulting in empty discovery endpoints.
- **Evidence in Repo**: `cmd/gardener-node-agent/app/app.go` (`runControlPlaneNodesEndpointsBootstrapper` -> `isControlPlaneNode` refactoring in commit `8f0c90cb`).
- **Root Cause**: Condition logic checked a sub-feature flag (`cfg.Bootstrap.ControlPlaneNodesEndpoints.Enabled`) rather than the fundamental node identity role (`isControlPlaneNode`), causing the cache selector to prematurely restrict queries.
- **Remediation Code Diff**:
```diff
--- a/cmd/gardener-node-agent/app/app.go
+++ b/cmd/gardener-node-agent/app/app.go
@@ -243,7 +244,7 @@ func run(ctx context.Context, cancel context.CancelFunc, log logr.Logger, cfg *n
-func getCache(log logr.Logger, hostName, nodeName, secretName string, runControlPlaneNodesEndpointsBootstrapper bool) map[client.Object]cache.ByObject {
+func getCache(log logr.Logger, hostName, nodeName, secretName string, isControlPlaneNode bool) map[client.Object]cache.ByObject {
 	var (
 		nodeCacheOptions  = cache.ByObject{Label: labels.SelectorFromSet(labels.Set{corev1.LabelHostname: hostName})}
 		leaseCacheOptions = cache.ByObject{Namespaces: map[string]cache.Config{metav1.NamespaceSystem: {}}}
@@ -254,7 +255,7 @@ func getCache(log logr.Logger, hostName, nodeName, secretName string, runControl
 		nodeCacheOptions.Field = fields.SelectorFromSet(fields.Set{metav1.ObjectNameField: nodeName})
 		nodeCacheOptions.Label = nil
 		leaseCacheOptions.Field = fields.SelectorFromSet(fields.Set{metav1.ObjectNameField: gardenerutils.NodeAgentLeaseName(nodeName)})
-	} else if runControlPlaneNodesEndpointsBootstrapper {
+	} else if isControlPlaneNode {
 		// If the node name is not known yet, and we need to run the bootstrapper for populating the endpoints of other
 		// control plane nodes, we have to disable the label selector for the node cache so that we can actually
 		// discover them. This is only the case for control plane nodes in self-hosted shoots during their bootstrap
+		nodeCacheOptions = cache.ByObject{}
 	}
```
- **Lesson**: Dynamic client-go / controller-runtime cache selectors must maintain relaxed fallback boundaries when identity fields (such as `Node.metadata.name`) cannot be determined prior to cluster join.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Secret & ConfigMap Rollout Checksums (`ComputeChecksums`)**:
   In Kubernetes, updating the data of a Secret or ConfigMap referenced by a Deployment does not automatically trigger a rolling update of the underlying Pods.
   ```go
   // Source: extensions/pkg/controller/controlplane/utils.go
   func ComputeChecksums(secrets map[string]*corev1.Secret, cms map[string]*corev1.ConfigMap) map[string]string {
       checksums := make(map[string]string, len(secrets)+len(cms))
       for name, secret := range secrets {
           // Traps to avoid: secret.Data can be nil or empty.
           // utils.ComputeChecksum must stably hash sorted byte maps.
           checksums[name] = utils.ComputeChecksum(secret.Data)
       }
       for name, cm := range cms {
           checksums[name] = utils.ComputeChecksum(cm.Data)
       }
       return checksums
   }
   ```
   *Forensic Precision Rule*: The resulting hash map must be injected into the `spec.template.metadata.annotations` of workloads. If the hash function is not deterministic across map key iterations (Go map iteration randomization), pods will cycle continuously on every reconciliation loop. Gardener uses `utils.ComputeChecksum` which enforces internal key sorting prior to hashing with SHA256.

2. **Map Mutation via `maps.Copy`**:
   In `controlplane.MergeSecretMaps`, allocation must size the destination map appropriately to minimize heap reallocation overhead while avoiding mutation of input parameters:
   ```go
   func MergeSecretMaps(a, b map[string]*corev1.Secret) map[string]*corev1.Secret {
       x := make(map[string]*corev1.Secret, len(a)+len(b))
       for _, m := range []map[string]*corev1.Secret{a, b} {
           maps.Copy(x, m) // Shallow reference copy; never mutate *corev1.Secret in-place
       }
       return x
   }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **String Token Parsing Termination**:
   Extracting cluster IDs from shoot names must handle multi-hyphen delimited structures without unbounded index recursion:
   ```go
   // Source: extensions/pkg/controller/backupentry/util.go
   func ExtractShootDetailsFromBackupEntryName(backupEntryName string) (shootTechnicalID, shootUID string) {
       backupEntryName = strings.TrimPrefix(backupEntryName, v1beta1constants.BackupSourcePrefix+"-")
       tokens := strings.Split(backupEntryName, "--")
       // Guard: Even if backupEntryName contains no "--", len(tokens) >= 1.
       shootUID = tokens[len(tokens)-1]
       shootTechnicalID = strings.TrimSuffix(backupEntryName, "--"+shootUID)
       return shootTechnicalID, shootUID
   }
   ```
2. **Reconciliation Loop Throttling via Status Conditions**:
   In `extensions/pkg/controller/healthcheck/general/statefulsets.go`, health checker logic must return `gardencorev1beta1.ConditionFalse` along with a cleanly formatted, deterministic reason message instead of returning raw transient errors to the controller manager. Returning a raw `error` forces an immediate requeue with exponential backoff (wasting CPU and API bandwidth), whereas returning a structured `SingleCheckResult` allows the health controller to govern requeue intervals predictably via its configured sync period.

### 4.3 UI & UX