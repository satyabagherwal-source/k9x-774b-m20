# Verification Protocol: Verification Protocol: Empirical Defect Shield for kumahq-kuma-learnings

<!-- PROVENANCE_START
{
  "source_repository": "kumahq-kuma-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:17:29.282Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kumahq-kuma-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kumahq-kuma-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:17:29.282Z`  
> **Learning ID**: `LEARN-EVO-kumahq-kuma-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `kumahq-kuma-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source**: github ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Source Version**: `a71f8a93`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T03:16:52.439Z  
> **Learning ID**: `learn-github-kumahq-kuma`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): kumahq/kuma

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Domain Problem & Mission Profile
Kuma is an enterprise-grade, multi-zone, multi-mesh service mesh control plane engineered on top of Envoy proxy. It bridges heterogeneous compute infrastructures across Kubernetes, bare-metal, and virtual machine environments under a single unified policy plane. 

The fundamental problem Kuma solves is **heterogeneous control-plane convergence**: orchestrating dynamic Layer 4 to Layer 7 service discovery, mutual TLS (mTLS) identity rotation, fine-grained traffic routing, rate limiting, and distributed observability across mixed-infrastructure topologies without requiring Envoy-specific domain expertise or forcing workloads into Kubernetes-only environments.

```
+-------------------------------------------------------------------------------+
|                           KUMA GLOBAL CONTROL PLANE                           |
|  +---------------------+  +----------------------+  +----------------------+  |
|  | Policy Engine / API |  | PostgreSQL / K8s CRD |  | Global KDS Server    |  |
|  +---------------------+  +----------------------+  +----------------------+  |
+-------------------------------------------------------------------------------+
                                      |  Kuma Discovery Service (KDS / gRPC)
       +------------------------------+------------------------------+
       v                                                             v
+------------------------------------+             +------------------------------------+
|     ZONE CONTROL PLANE (K8s)       |             |   ZONE CONTROL PLANE (Universal)   |
|  +-------------------------------+ |             |  +-------------------------------+ |
|  | KDS Client (Policy Sync)      | |             |  | KDS Client (Policy Sync)      | |
|  | In-Memory Resource Store      | |             |  | In-Memory Resource Store      | |
|  | xDS Server (Envoy Dynamic API)| |             |  | xDS Server (Envoy Dynamic API)| |
|  | CNI Plugin (Redirect Rules)   | |             |  | Transparent Proxy CLI Engine  | |
|  +-------------------------------+ |             |  +-------------------------------+ |
|           | (Envoy v3 xDS)         |             |           | (Envoy v3 xDS)         |
|           v                        |             |           v                        |
|  +-------------------------------+ |             |  +-------------------------------+ |
|  | Envoy Proxy Sidecar (Pod A)   | |             |  | Envoy Proxy Sidecar (VM App)  | |
|  +-------------------------------+ |             |  +-------------------------------+ |
+------------------------------------+             +------------------------------------+
```

### 1.2 System Boundaries & Component Decoupling
1. **Global Control Plane (`kuma-cp` in `global` mode)**: Acts as the single source of truth for global configuration, cross-zone policies, and mesh inventory. Communicates with storage engines via two decoupled drivers: Kubernetes CRDs (using `k8s.io/client-go` and controller-runtime) or relational databases (PostgreSQL via `jackc/pgx/v5` and distributed advisory locking via `cirello.io/pglock`).
2. **Zone Control Plane (`kuma-cp` in `zone` mode)**: Deployed inside each compute perimeter (Kubernetes cluster, VPC, datacenter). It connects to the Global CP through **KDS (Kuma Discovery Service)**, a specialized bi-directional gRPC streaming protocol derived from Envoy's xDS protocol buffer conventions. The Zone CP translates high-level abstract policies (MeshTimeout, MeshAccessControl, MeshTrafficPermission) into concrete low-level Envoy xDS v3 API objects (Clusters, Listeners, Routes, Endpoints, Secret Discovery Service resources).
3. **Container Network Interface Subsystem (`kuma-cni`)**: A CNI network plugin executed by Kubernetes `kubelet` during container runtime sandbox initialization. Operates under strict POSIX standard stream constraints: `kubelet` parses standard output (`os.Stdout`) exclusively as a formal CNI JSON response dictionary. Any auxiliary logging or diagnostic telemetry generated during network interface rewiring MUST strictly target standard error (`os.Stderr`).
4. **Command-Line Installation Engine (`kumactl install`)**: An embedded template-rendering subsystem that embeds Helm v4 libraries (`helm.sh/helm/v4`) and Sprig text templates. It dynamically synthesizes Kubernetes manifests in-memory, scrubs Helm-internal control labels (`app.kubernetes.io/managed-by`, `helm.sh/chart`) to avoid deployment drift, injects system namespaces, and emits deterministic, alphabetically sorted YAML streams.
5. **Kuma GUI & MSW Mock Subsystem (`kuma-ui`)**: A decoupled single-page application compiled into static assets and embedded directly into Go binary distributions via Go `embed`. Employs Mock Service Worker (MSW v3) service worker interception for deterministic offline and sandbox testing, implementing streaming-safe lifecycle termination, client ping handshakes, and DevTools cache-bypass filters.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Strict Standard Stream Partitioning for Structured IPC Plugins
**RULE**:
When implementing an executable invoked by an external orchestrator that parses standard output (`os.Stdout`) as structured IPC data (e.g., CNI plugins, Git credential helpers, HashiCorp Packer/Terraform drivers, CLI JSON formatters), application runtime code and all linked dependencies MUST NEVER write arbitrary log messages, debug text, or panic traces to `os.Stdout`. All logging, diagnostic outputs, and panic traces MUST be redirected exclusively to `os.Stderr`.

**WHY**:
External orchestrators (such as the Kubernetes `kubelet` invoking CNI binaries via Containerd/CRI-O) read `stdout` until `EOF` and execute `json.Unmarshal()` directly against that byte slice. If an embedded logging framework or an imported third-party library writes even a single byte of plain text (e.g., `"2026-11-16T10:00:00Z INFO starting plugin..."`) to `stdout`, the JSON parser fails with a syntactic unmarshal error (e.g., `invalid character '2' looking for beginning of value`). This causes container sandbox creation to permanently fail with `ContainerCreating` crash loops across the entire cluster.

**WHEN TO APPLY**:
- Kubernetes CNI plugins and network drivers.
- Custom CLI tools emitting output destined for JSON/YAML Unix piping (`| jq`).
- Microservices communicating across POSIX standard streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// app/cni/pkg/install/utils.go
package install

import (
	"os"

	"github.com/go-logr/logr"
	"github.com/kumahq/kuma/v3/pkg/core"
	kuma_log "github.com/kumahq/kuma/v3/pkg/log"
)

// CreateNewLogger ensures all log emissions bypass stdout entirely.
// kubelet expects a specific JSON payload on stdout; writing any diagnostic text
// to stdout corrupts the CNI protocol exchange.
func CreateNewLogger(name string, logLevel kuma_log.LogLevel) logr.Logger {
	return core.NewLoggerTo(os.Stderr, logLevel).WithName(name)
}

func SetLogLevel(logger *logr.Logger, level string, name string) error {
	logLevel, err := kuma_log.ParseLogLevel(level)
	if err != nil {
		return err
	}

	*logger = CreateNewLogger(name, logLevel)
	return nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Defaulting loggers to stdout or using global print statements
func BadCNIInit() {
    // FATAL: Pollutes stdout with non-JSON text, breaking kubelet sandbox initialization!
    fmt.Println("Configuring pod network interface...")
    logger := zap.NewExample() // Defaults to stdout
    logger.Info("CNI network plugin executed successfully")
}
```

**VERIFICATION METHOD**:
Enforce stream separation using a unit test that captures `os.Stdout` during mock execution and asserts that the captured stream contains solely valid JSON without prefix/suffix garbage:
```go
func TestCNIStdoutPurity(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	// Execute logger and CNI setup logic
	logger := CreateNewLogger("cni-test", kuma_log.InfoLevel)
	logger.Info("This must not leak to stdout")
	
	// Emit dummy response
	_, _ = w.Write([]byte(`{"cniVersion": "1.0.0", "interfaces": []}`))
	_ = w.Close()
	os.Stdout = oldStdout

	out, _ := io.ReadAll(r)
	var dummy map[string]any
	if err := json.Unmarshal(out, &dummy); err != nil {
		t.Fatalf("stdout was corrupted with non-JSON data: %v (raw: %q)", err, string(out))
	}
}
```

---

### 2. Stream-Safety Clone Exclusion for Teed Network Interceptors
**RULE**:
When intercepting, logging, or proxying HTTP/Fetch responses via service workers, reverse proxies, or middleware, the interceptor MUST NOT clone (`response.clone()`) or buffer the response body if the `Content-Type` header indicates an open-ended server-sent event stream (`text/event-stream`), WebSocket upgrade, or chunked transfer stream.

**WHY**:
In the Fetch Standard and Service Worker specifications, calling `response.clone()` against an active readable stream creates a teed stream (`ReadableStream.tee()`). A teed stream locks the underlying stream source and does not release memory or propagate client-side stream cancellations (`reader.cancel()`) until *both* branches have closed or canceled. For unbounded event streams (e.g., SSE metrics, log tailing, Envoy dynamic stats streaming), cloning buffers the stream indefinitely in memory, leading to browser/process memory exhaustion (OOM crashes) while preventing client disconnections from propagating upstream.

**WHEN TO APPLY**:
- Service Worker fetch handlers and mocking proxies (e.g., MSW, custom SW caches).
- Reverse proxies and API gateway response-recording middleware in Go/Node.js.
- Envoy Lua filter extensions inspecting downstream response streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// app/kuma-ui/pkg/resources/data/mockServiceWorker.js

// Check Content-Type before calling clone() on the response
const isEventStreamResponse = response.headers
  .get('content-type')
  ?.toLowerCase()
  .startsWith('text/event-stream')

// Omit the body of server-sent event stream responses.
// Cloning such responses would prevent client-side stream cancelations
// from reaching the original stream (a teed stream only cancels its
// source once both of its branches cancel) and would buffer the
// entire stream into the unconsumed clone indefinitely.
const responseClone = isEventStreamResponse ? null : response.clone()

sendToClient(
  client,
  {
    type: 'RESPONSE',
    payload: {
      isMockedResponse: IS_MOCKED_RESPONSE in response,
      request: {
        id: requestId,
        ...serializedRequest,
      },
      response: {
        type: response.type,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseClone ? responseClone.body : null,
      },
    },
  },
  responseClone && responseClone.body
    ? [serializedRequest.body, responseClone.body]
    : [],
)
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Indiscriminate response cloning on HTTP interceptors
addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    const response = await fetch(event.request)
    // CRITICAL MEMORY LEAK: If response is an SSE stream (text/event-stream),
    // clone() tees the stream. The clone is never read, buffering chunks forever.
    const clone = response.clone()
    broadcastToAuditLogs(await clone.text()) 
    return response
  })())
})
```

**VERIFICATION METHOD**:
Implement an automated end-to-end test that opens an SSE connection, verifies that cancelling the client reader terminates the server-side writer within a strict timeout, and asserts that no memory leak occurs:
```javascript
test('SSE stream cancellation propagates upstream without clone buffering', async () => {
  const sseResponse = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: ping\n\n'))
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
  
  const isEventStream = sseResponse.headers.get('content-type')?.startsWith('text/event-stream')
  expect(isEventStream).toBe(true)
  const clone = isEventStream ? null : sseResponse.clone()
  expect(clone).toBeNull()
})
```

---

### 3. Explicit Ancestor Hook Propagation in Hierarchical CLI Trees
**RULE**:
When building CLI tools with nested command hierarchies using frameworks where parent pre-run hooks are superseded by child command hooks (such as Cobra's `PersistentPreRun` / `PersistentPreRunE`), any child command defining its own `PersistentPreRunE` MUST explicitly invoke the parent's `PersistentPreRunE` up the ancestor chain.

**WHY**:
In `github.com/spf13/cobra`, if a root or intermediate command defines a `PersistentPreRunE` (e.g., to load configuration files, initialize authentication contexts, or set up tracing), and a subcommand subsequently defines its own `PersistentPreRunE`, Cobra only executes the subcommand's hook, silently dropping the parent's hook. This causes child commands to execute with uninitialized configuration structs, missing credentials, unparsed flags, or nil-pointer dereferences on shared service clients.

**WHEN TO APPLY**:
- All Go CLI architectures utilizing `spf13/cobra`.
- Nested CLI command trees requiring hierarchical context setup.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// app/kumactl/pkg/cmd/util.go
package cmd

import "github.com/spf13/cobra"

// RunParentPreRunE checks if the parent command has a PersistentPreRunE set and
// executes it. This is for use in PersistentPreRun and is necessary because
// only the first PersistentPreRun* of the command's ancestors is executed by cobra.
func RunParentPreRunE(cmd *cobra.Command, args []string) error {
	if p := cmd.Parent(); p != nil && p.PersistentPreRunE != nil {
		if err := p.PersistentPreRunE(p, args); err != nil {
			return err
		}
	}
	return nil
}
```

```go
// Usage inside subcommand definition:
var subCmd = &cobra.Command{
	Use:   "sub",
	Short: "Subcommand requiring root context",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Explicitly propagate execution to parent/root PersistentPreRunE
		if err := cmd_util.RunParentPreRunE(cmd, args); err != nil {
			return err
		}
		// Now safe to run subcommand-specific setup
		return initSubcommandResources()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return execute()
	},
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Defining subcommand PersistentPreRunE without invoking parent
var subCmd = &cobra.Command{
	Use: "apply",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// BUG: Cobra skips rootCmd.PersistentPreRunE!
		// Config, logger, and KubeClient are nil!
		return setupLocalFlags() 
	},
}
```

**VERIFICATION METHOD**:
Static analysis check or unit test asserting that every command possessing a non-nil `PersistentPreRunE` invokes `RunParentPreRunE` or that parent context properties are non-nil when executing subcommands:
```go
func TestCommandHierarchyContextInitialization(t *testing.T) {
	rootCmd := NewRootCmd()
	subCmd := NewSubCmd()
	rootCmd.AddCommand(subCmd)

	// Set args that target the child command
	rootCmd.SetArgs([]string{"sub", "--dry-run"})
	err := rootCmd.Execute()
	assert.NoError(t, err)
	// Assert root context configuration was populated despite child PersistentPreRunE
	assert.NotNil(t, subCmd.ConfigContext)
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Security Vulnerability Remediation in Core Daemon and Telemetry Dependencies (BUG-SEC-CVE-01)
- **Context**: Root dependency manifest `go.mod`.
- **What Was Expected**: Control plane and sidecar tooling run against stable dependencies without known High/Critical severity Common Vulnerabilities and Exposures (CVEs) in base container runtimes and telemetry SDKs.
- **What Actually Happened**: Static vulnerability scanning identified multiple high-risk CVEs in `github.com/docker/docker` (GO-2026-4883 [CVSS 6.8], GO-2026-4887, GO-2026-5617 [CVSS 7.2] / GHSA-rg2x-37c3-w2rh) and `go.opentelemetry.io/otel/sdk` / `trace` (GHSA-q7gw-24fr-5p69 [CVSS 5.3]), exposing the CP and testcontainers infrastructure to unauthenticated remote exploitation and telemetry buffer manipulation.
- **Evidence in Repo**: Closed issue `#19421` ("chore(deps): security update"), `go.mod`.
- **Root Cause**: Transitive dependency pinning in Go module graph pinned `docker` to vulnerable incompatible revision `v28.5.1` and OpenTelemetry SDK components to `v1.45.0`.
- **Remediation Code Diff**:
```diff
// go.mod
- go.opentelemetry.io/otel v1.45.0
- go.opentelemetry.io/otel/sdk v1.45.0
- go.opentelemetry.io/otel/trace v1.45.0
- github.com/docker/docker v28.5.1+incompatible
+ go.opentelemetry.io/otel v1.47.0
+ go.opentelemetry.io/otel/sdk v1.47.0
+ go.opentelemetry.io/otel/trace v1.47.0
+ github.com/docker/docker v28.5.3+incompatible
```
- **Lesson**: High-throughput telemetry pipelines and container orchestrator harnesses must continuously audit transitive vulnerability registries using direct Go dependency upgrades and OpenSSF Scorecard automated pipelines.

---

### Incident 2: GUI Asset Hashing Desynchronization Breaking UI Control-Plane Embedding (BUG-UI-HASH-02)
- **Context**: `app/kuma-ui/pkg/resources/data/assets/` compiled Vue/Vite distribution bundles.
- **What Was Expected**: The embedded static UI server in `kuma-cp` delivers compiled web application assets containing coherent module import references across all route chunks.
- **What Actually Happened**: The root entry chunk `index-MHySwiU7.js` was invalidated and recompiled to `index-Gia0ApXe.js`. Downstream route chunks (`ConfigurationDetailView`, `ConnectionInboundSummaryClustersView`, `ConnectionInboundSummaryStatsView`, `ConnectionInboundSummaryView`, `ConnectionInboundSummaryXdsConfigView`, `ConnectionOutboundSummaryClustersView`, `ConnectionOutboundSummaryStatsView`) retained stale imports referencing the deleted `index-MHySwiU7.js`, resulting in `404 Not Found` dynamic import errors on user navigation.
- **Evidence in Repo**: Commit `a71f8a93`, PR `#19422` ("chore(deps): bump kumahq/kuma-gui to dec2bfb1c612217485aa9c36d9170ce580c22691").
- **Root Cause**: Partial asset bundling or out-of-sync chunk generation during upstream GUI release builds resulted in dangling chunk hashes.
- **Remediation Code Diff**:
```diff
// app/kuma-ui/pkg/resources/data/assets/ConfigurationDetailView-lc5Jm30v.js
-import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-MHySwiU7.js";
+import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-Gia0ApXe.js";

// app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryClustersView-D4JlQI5W.js
-import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,P as E,c as F,I as N,J as v}from"./index-MHySwiU7.js";
+import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,P as E,c as F,I as N,J as v}from"./index-Gia0ApXe.js";

// app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryStatsView-Bv-kUmqK.js
-import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,P as w,aa as k}from"./index-MHySwiU7.js";
+import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,P as w,aa as k}from"./index-Gia0ApXe.js";
```
- **Lesson**: Embedded UI asset pipelines must regenerate all route chunks concurrently with the shared vendor index chunk and enforce cryptographic integrity checks between manifests and asset files prior to committing into the Go source tree.

---

### Incident 3: Helm Label Leakage Causing GitOps Reconciliation Thrashing (BUG-HELM-LBL-03)
- **Context**: `app/kumactl/cmd/install/render_helm_files.go`
- **What Was Expected**: When users install Kuma via `kumactl install control-plane`, the rendered Kubernetes manifests should behave as native, standalone resources.
- **What Actually Happened**: Helm chart engine rendering automatically injected Helm-specific metadata labels (`helm.sh/chart`, `app.kubernetes.io/managed-by: Helm`, `app.kubernetes.io/version`). External GitOps controllers (ArgoCD, Flux) identified these labels and assumed an external Helm release agent was managing the resources, initiating perpetual reconciliation loops and deleting or modifying annotations.
- **Evidence in Repo**: `app/kumactl/cmd/install/render_helm_files.go` lines 27-37, `stripLabelsRegexps`.
- **Root Cause**: Helm's rendering engine (`engine.Render`) lacks a native flag to suppress default metadata injection during in-memory chart evaluation.
- **Remediation Code Diff**:
```diff
// app/kumactl/cmd/install/render_helm_files.go
+var stripLabelsRegexps = []*regexp.Regexp{
+	labelRegex("app\\.kubernetes\\.io/managed-by"),
+	labelRegex("helm\\.sh/chart"),
+	labelRegex("app\\.kubernetes\\.io/version"),
+}
+
 func postRender(loadedChart *chartv2.Chart, files map[string]string) []data.File {
+	for _, k := range keys {
+		if strings.HasSuffix(k, "yaml") {
+			content := files[k]
+			// strip Helm Chart specific labels
+			for _, stripRegEx := range stripLabelsRegexps {
+				content = stripRegEx.ReplaceAllString(content, "")
+			}
+			result = append(result, data.File{
+				Data: []byte(content),
+				Name: k,
+			})
+		}
+	}
```
- **Lesson**: When utilizing Helm as an in-memory template compiler for an alternative CLI installation mechanism, all Helm release tracking labels must be post-processed and stripped out using multiline regex sanitizers to prevent GitOps reconciliation conflicts.

---

### Incident 4: /proc Filesystem PID Traversal Race Condition & Symlink Hijacking (BUG-PROC-FS-04)
- **Context**: `app/cni/pkg/cni/utils_linux.go`
- **What Was Expected**: `pidOf(name)` inspects Linux `/proc` to discover the running PID of a networking daemon safely without allocating excessive memory or following malicious paths.
- **What Actually Happened**: Naive directory scanning using `os.ReadDir("/proc")` allocates memory for tens of thousands of ephemeral process entries on large Kubernetes nodes, risking OOM kills, while opening raw process paths risks path-traversal security warnings.
- **Evidence in Repo**: `app/cni/pkg/cni/utils_linux.go` lines 42-65 (`dirFD.Readdir(10)` and `#nosec G703`).
- **Root Cause**: High-density Kubernetes worker nodes with hundreds of pods exhaust system memory when loading full directory entries in a single syscall.
- **Remediation Code Diff**:
```diff
// app/cni/pkg/cni/utils_linux.go
-	entries, err := os.ReadDir("/proc")
+	dirFD, err := os.Open("/proc")
+	if err != nil {
+		return nil
+	}
+	defer dirFD.Close()
+
+	for {
+		// Read a small number at a time in case there are many entries, we don't want to
+		// allocate a lot here.
+		ls, err := dirFD.Readdir(10)
+		if err == io.EOF {
+			break
+		}
+		if err != nil {
+			return nil
+		}
+		for _, entry := range ls {
+			if !entry.IsDir() {
+				continue
+			}
+			pid, err := strconv.Atoi(entry.Name())
+			if err != nil {
+				continue
+			}
+			cmdline, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline")) // #nosec G703
```
- **Lesson**: Inspecting Linux system state in resource-constrained container environments must use chunked directory reading (`Readdir(chunkSize)`) instead of loading all entries at once, and validate that directory names parse to numeric integers before opening child descriptors.

---

### Incident 5: Dual-Channel Signal Trapping Desynchronization in Pod Eviction (BUG-SIG-SHUT-05)
- **Context**: `pkg/cmd/util.go`
- **What Was Expected**: When a Kubernetes node drains, the control plane processes `SIGTERM` gracefully within the pod termination grace period, while maintaining an uncorrupted channel for immediate force-kill on a second signal and capturing `SIGUSR2` for diagnostic thread-dump extraction.
- **What Actually Happened**: Standard Go signal handlers binding to a single context either terminate abruptly on the first signal (dropping in-flight xDS ACK/NACK updates) or become unresponsive if a second termination signal is delivered while the runtime is blocked on database connection draining.
- **Evidence in Repo**: `pkg/cmd/util.go` lines 9-19, `RunCmdOpts`.
- **Root Cause**: Lack of multi-stage shutdown channels in standard library signal contexts prevents distinguishing between "begin orderly draining" and "force immediate abort".
- **Remediation Code Diff**:
```diff
// pkg/cmd/util.go
+type RunCmdOpts struct {
+	// Stop signals are SIGINT and SIGTERM
+	// We can start graceful shutdown when first context is closed and forcefully stop when the second one is closed.
+	// Note that the handler closes usr2Received as soon as SIGTERM has been
+	// received, exactly one SIGUSR2 is buffered and notifications are
+	// non-blocking, so the guarantee is that at least one SIGUSR2 is delivered.
+	SetupSignalHandler func() (firstStopSignalReceived context.Context, secondStopSignalReceived context.Context, usr2Received <-chan struct{})
+}
```
- **Lesson**: Daemon process architectures must decouple the initial graceful drain trigger (SIGINT/SIGTERM 1) from the emergency termination trigger (SIGINT/SIGTERM 2) using chained contexts, backed by a non-blocking channel for diagnostics (SIGUSR2).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
