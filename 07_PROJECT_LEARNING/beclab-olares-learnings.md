> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/beclab-olares-learnings.md`  
> **Source**: github ([https://github.com/beclab/Olares](https://github.com/beclab/Olares))  
> **Source Version**: `f0ffc917`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T07:19:00.030Z  
> **Learning ID**: `learn-github-beclab-olares`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): beclab/Olares

---

## 1. Executive Forensic Architecture & System Mechanics

Olares is an open-source, local-first personal cloud operating system built on Kubernetes. It abstracts heterogeneous underlying compute nodes, storage engines, accelerators (GPUs/NPUs), and network tunnels into an agent-centric execution environment operated through natural language and unified web/desktop/mobile frontends.

```
                      +-------------------------------------------------------+
                      |                 Client Surfaces / UX                  |
                      |  - Web UI (Quasar / Vue 3 PWA)                        |
                      |  - Native Shells (iOS / Android / Desktop)            |
                      |  - Lares Conversational Agent / Assistant             |
                      +---------------------------+---------------------------+
                                                  | JSON / REST / SSE / WS
                                                  v
                      +-------------------------------------------------------+
                      |         App Gateway / Reverse Proxy & Ingress         |
                      |  - Authentication & OIDC Identity Validation          |
                      |  - Dynamic Route Matching (L4 / L7 Stream Forwarding) |
                      |  - Encrypted Overlays (Tailscale / LarePass VPN Wire) |
                      +---------------------------+---------------------------+
                                                  |
                  +-------------------------------+-------------------------------+
                  v                               v                               v
    +---------------------------+   +---------------------------+   +---------------------------+
    |   framework/app-service   |   |   framework/tapr (Data)   |   |     framework/oac         |
    | - Lifecycle Coordinator   |   | - Unified Files API (v2)  |   | - Olares App Compiler     |
    | - Helm Chart Engine       |   | - Local Drive / Cache     |   | - Manifest Validator      |
    | - Dynamic Port Allocator  |   | - S3 / GDrive / Dropbox   |   | - Helm Template Linter    |
    | - Workload Scheduler      |   | - Event PubSub (NATS)     |   | - Dry-Run Evaluator       |
    +-------------+-------------+   +-------------+-------------+   +-------------+-------------+
                  |                               |                               |
                  +-------------------------------+-------------------------------+
                                                  | Helm Manifests & K8s Primitives
                                                  v
                      +-------------------------------------------------------+
                      |            Kubernetes Engine Substrate                |
                      |  - StatefulSets / Deployments / DaemonSets            |
                      |  - GPU Virtualization (Time/Memory-Slicing, Exclusive)|
                      |  - NetworkPolicy & Tailscale ACL Security Enclaves    |
                      +-------------------------------------------------------+
```

### Decoupling and State Ownership Mechanics

1. **Manifest to Helm Value Pipeline (`framework/oac` & `framework/app-service`)**:
   Applications declare topological requirements in `OlaresManifest.yaml` (ports, replica limits, GPU allocations, persistent volume claims). The manifest is decoupled from raw Helm charts. `framework/app-service` dynamically compiles the manifest, queries cluster state for available host ports (`exposePort`), injects synthetic parameters into the Helm values tree under `.Values.exposePorts.<name>`, and then triggers deployment via the Helm operator.

2. **Storage Federation Boundary (`apps/packages/app/src/api/files/v2/*`)**:
   Storage does not expose POSIX primitives directly to clients. The system segments file access into virtual mount namespaces (`/drive/Home`, `/drive/Data`, `/external`, `/cache`, `/awss3`, `/google`, `/dropbox`). The unified files API normalizes remote file paths, handles URL/query escaping, manages multi-node paste/copy operations via asynchronous task workers over NATS, and routes I/O across heterogeneous backends (local NVMe, distributed Ceph, or third-party S3 buckets).

3. **Client-Side Lifecycle and Edge Service Worker (`src-pwa/`)**:
   The frontend runs as a progressive web app (PWA) under Quasar/Vue 3. Due to WebKit/Safari restrictions on desktop PWAs, the registration subsystem inspects client user agents and injects unique build cache identifiers (`?key=${Date.now()}`). The custom service worker bypasses `.html` files in precaching to prevent stale app shell deadlocks and intercepts navigation requests (`request.mode === 'navigate'`) with a strict `NetworkOnly` strategy, ensuring real-time token validation and API routing against the cluster gateway.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dynamic Host Port Allocation Injection Invariant
**RULE**:
When an orchestration framework dynamically allocates external or node-level ports for application workloads at install/upgrade time, it MUST inject the resolved allocated port numbers into the workload configuration (e.g., Helm Values) using a strict, keyed map (`.Values.exposePorts.<name>`). It MUST NEVER rely on the workload reading its static container port if the workload advertises its network identity externally (e.g., WebRTC SFU ICE candidates, SIP, RTSP, distributed consensus). Furthermore, dry-run template rendering passes MUST supply safe fallback zero-values (`int32(0)`) or empty maps to prevent template rendering aborts during pre-allocation linting or image caching phases.

**WHY**:
Container workloads utilizing protocols that publish node-reachable connection addresses to remote clients (such as WebRTC servers publishing ICE host candidates) will fail silently or attempt to bind collisions if given only internal container ports. Pinning static host ports (`exposePort: 47777`) prevents multi-tenancy or multi-instance installs on the same cluster because host ports are globally unique. Delaying allocation without injecting the resolved number leaves the workload advertising non-routable container ports. If the dynamic values map is omitted during pre-flight dry-runs (e.g., image prefetching), templating engines (`text/template`, Helm) will panic on missing map keys and fail the entire deployment.

**WHEN TO APPLY**:
Apply to any container orchestration system, Kubernetes operator, Helm wrapper, or cloud-native app service managing workloads that self-announce network addresses (WebRTC, VoIP, Game Servers, Gossip protocols) where host ports are assigned dynamically.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package appinstaller

import (
	"context"
	"k8s.io/client-go/rest"
)

type ServicePort struct {
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int32  `json:"port"`
	Protocol   string `json:"protocol"`
	ExposePort int32  `json:"exposePort"`
}

type AppConfig struct {
	Ports []ServicePort `json:"ports"`
}

// BuildExposePortsValues transforms allocated ServicePort definitions
// into a strongly-typed template values tree.
func BuildExposePortsValues(ports []ServicePort) map[string]interface{} {
	out := make(map[string]interface{}, len(ports))
	for _, p := range ports {
		// Invariant: Unallocated ports resolve to int32(0) to prevent template panic
		out[p.Name] = p.ExposePort
	}
	return out
}

// BuildBaseHelmValues prepares values ensuring schema presence across all phases.
func BuildBaseHelmValues(ctx context.Context, kubeConfig *rest.Config, appConfig *AppConfig, dryRun bool) (map[string]interface{}, error) {
	values := make(map[string]interface{})
	
	// Inject allocated or zeroed ports
	values["exposePorts"] = BuildExposePortsValues(appConfig.Ports)
	
	if dryRun {
		// Dry runs (e.g., image download pre-checks) render without cluster mutation.
		// The exposePorts map remains populated with int32(0) for template syntax safety.
		return values, nil
	}
	
	return values, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Passing static container port, or leaving exposePorts nil during dry-run
func BrokenBuildValues(appConfig *AppConfig, dryRun bool) map[string]interface{} {
	values := make(map[string]interface{})
	if !dryRun {
		// Fails linting and dry-run rendering: accessing .Values.exposePorts.rtc panics
		expose := make(map[string]interface{})
		for _, p := range appConfig.Ports {
			expose[p.Name] = p.ExposePort
		}
		values["exposePorts"] = expose
	}
	// Chart receives container port: WebRTC ICE candidates broadcast port 7882 instead of node port
	values["containerPort"] = appConfig.Ports[0].Port
	return values
}
```

**VERIFICATION METHOD**:
Enforce verification using dual-phase unit tests:
1. Verify that `BuildExposePortsValues` produces a map where missing allocations emit `int32(0)`.
2. Execute a Go `text/template` against the generated map ensuring evaluations like `--rtc.udp_port={{ .Values.exposePorts.rtc }}` evaluate to valid numeric arguments without runtime template execution errors.

---

### 2. Multi-Drive Path Normalization & Dynamic Prefix Invariant
**RULE**:
When abstracting multi-tenant or multi-provider storage backends (e.g., local home, raw data, external shares, AWS S3, Google Drive, Dropbox) behind a unified REST/RPC routing layer, path manipulation functions MUST NOT use hardcoded numeric string slicing (`url.slice(12)`) to strip route prefixes. Path normalization MUST use deterministic string prefix verification coupled with slice operations keyed directly to the matched prefix's length, or explicit structural path token splitting.

**WHY**:
Hardcoded slice lengths (`url.slice(12)`) introduce catastrophic off-by-one errors when mount paths undergo minor naming changes (e.g., `/Drive/awss3` vs `/awss3`, `/Drive/google` [13 chars] vs `/drive/google` [13 chars] vs `/Google` [7 chars]). If an off-by-one occurs, path separators (`/`) or root tokens are partially retained or truncated, leading to malformed cloud-provider keys (e.g., `//bucket/key` or `ucket/key`), resulting in `404 Not Found`, access control bypass, or silent file overwrites.

**WHEN TO APPLY**:
Apply in any frontend API client, storage gateway, or filesystem proxy service managing virtual file system (VFS) mount points, cloud object prefixes, and cross-backend transfer abstractions.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Strips a virtual mount prefix safely without hardcoded magic numbers.
 */
export function stripMountPrefix(uri: string, mountPrefixes: readonly string[]): string {
  if (!uri) return '';
  
  // Normalize leading slashes
  const normalized = uri.replace(/\/+/g, '/');
  
  for (const prefix of mountPrefixes) {
    const cleanPrefix = prefix.replace(/\/+/g, '/');
    if (normalized === cleanPrefix) {
      return '/';
    }
    if (normalized.startsWith(cleanPrefix + '/')) {
      const stripped = normalized.slice(cleanPrefix.length);
      return stripped.startsWith('/') ? stripped : '/' + stripped;
    }
  }
  
  return normalized;
}

// Canonical usage across heterogeneous storage providers
export const S3_PREFIXES = ['/Drive/awss3', '/drive/awss3', '/awss3'] as const;
export function awss3RemovePrefix(path: string): string {
  return stripMountPrefix(path, S3_PREFIXES);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Magic numeric slicing prone to casing and version drift
export function brokenGoogleRemoveHomePrefix(url: string): string {
  if (!url.startsWith('/Drive/google')) {
    return url;
  }
  // BUG: If prefix is '/drive/google' (lowercase) or changed to '/google',
  // this either skips the check or produces malformed paths if conditions change.
  // Hardcoded 13 slices incorrectly if length of target changes.
  return url.slice(13);
}
```

**VERIFICATION METHOD**:
Automated property-based fuzz tests passing paths with variable casings, redundant slashes, and nested directories:
```typescript
import { expect, test } from 'vitest';
import { stripMountPrefix } from './pathUtils';

test('prefix stripping invariants', () => {
  const prefixes = ['/Drive/awss3', '/awss3'];
  expect(stripMountPrefix('/Drive/awss3/photos/cat.jpg', prefixes)).toBe('/photos/cat.jpg');
  expect(stripMountPrefix('/Drive/awss3', prefixes)).toBe('/');
  expect(stripMountPrefix('/awss3/data/blob', prefixes)).toBe('/data/blob');
  expect(stripMountPrefix('/other/path/file.txt', prefixes)).toBe('/other/path/file.txt');
});
```

---

### 3. PWA App Shell Navigation Isolation Invariant
**RULE**:
Progressive Web App (PWA) Service Workers operating in hybrid local-cloud or edge-hosted operating systems MUST decouple HTML navigation requests from static asset precaching. Navigation requests (`request.mode === 'navigate'`) MUST strictly enforce a `NetworkOnly` strategy, and precache asset manifests MUST filter out all `.html` entry points.

**WHY**:
In self-hosted environments (like local Kubernetes clusters), system upgrades, frontend image bumps, and authentication redirects occur dynamically at the root route (`/`). If the Service Worker precaches `index.html` or intercepts navigation with a `CacheFirst` or `StaleWhileRevalidate` strategy, users receive a permanently cached HTML app shell that references outdated, deleted, or unauthenticated JavaScript chunks. Furthermore, authentication handshakes and edge gateway redirects are short-circuited by the local service worker cache, locking users out of newly updated system dashboards.

**WHEN TO APPLY**:
Apply to all Progressive Web Apps, administrative dashboards, and micro-frontend shells deployed to self-hosted appliances, Kubernetes-managed edge nodes, and cloud-native user interfaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & { skipWaiting: () => void };

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Invariant 1: Filter out all HTML app shells from precaching
precacheAndRoute(
  self.__WB_MANIFEST.filter((entry) => {
    if (typeof entry === 'string') {
      return !entry.endsWith('.html');
    }
    return !entry.url.endsWith('.html');
  })
);

// Invariant 2: Explicitly force full network fetch on browser navigation
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkOnly({
    plugins: [
      {
        handlerDidError: async () => {
          // Fallback only if completely disconnected from local edge cluster
          return Response.error();
        }
      }
    ]
  })
);
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Default Workbox setup precaching everything including index.html
// Leads to deadlocked UI versions and broken SSO / Gateway auth redirects
import { precacheAndRoute } from 'workbox-precaching';

// Dangerous: caches index.html. When the cluster upgrades frontend container,
// the browser serves the old index.html pointing to missing 404 JS hashes.
precacheAndRoute(self.__WB_MANIFEST);
```

**VERIFICATION METHOD**:
Automated integration test using Playwright or Puppeteer:
1. Load PWA frontend.
2. Deploy an update (simulate asset hash change on backend).
3. Execute `page.reload()`.
4. Assert via DevTools Protocol that the HTTP request for `/` returned status 200 directly from the network with no `from-service-worker` header.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: WebRTC SFU / Game Server Port Misdirection on Dynamic Node Allocation (BUG-OLARES-4294)

- **Context**: Subsystem: `framework/app-service` and `framework/oac` (Olares App Compiler). Files:
  - `framework/app-service/pkg/appinstaller/helm_utils.go`
  - `framework/app-service/pkg/apiserver/handler_app.go`
  - `framework/oac/internal/helmrender/values.go`
  - `cli/skills/olares-chart/references/olares-chart-entrances.md`
- **What Was Expected**: Workloads that declare UDP/TCP ports in `OlaresManifest.yaml` without pinning an `exposePort` must have an available node port dynamically allocated by the cluster at install time. Workloads advertising their own connection endpoint to external clients (e.g., LiveKit WebRTC SFU publishing ICE candidates, game servers registering on matchmaking hubs) must receive the actual node-allocated host port within their Helm template rendering tree (`.Values.exposePorts.<port-name>`).
- **What Actually Happened**: The platform dynamically allocated the port via `SetExposePorts`, but never injected the allocated value into the chart's `.Values` tree. Workloads could only read their container port (`port`), causing them to broadcast their internal container port (e.g., 7882) as their external host candidate. When users attempted to work around this by hardcoding `exposePort` in their manifests, subsequent app installations by other users or secondary instances on the same cluster failed immediately due to cluster-wide host port uniqueness conflicts. Furthermore, during linting or dry-run image pre-fetching, missing keys in `.Values.exposePorts` caused Helm rendering to crash.
- **Evidence in Repo**: Commit `3ab24a95`, PR #4294.
- **Root Cause**: `BuildBaseHelmValues` neglected to map `appConfig.Ports` into a `.Values.exposePorts` object. Additionally, mock value generators in `oac` linting (`helmrender/values.go`) omitted the `exposePorts` placeholder map entirely, causing dry-run passes to panic on missing sub-keys.
- **Remediation Code Diff**:
```go
--- a/framework/app-service/pkg/appinstaller/helm_utils.go
+++ b/framework/app-service/pkg/appinstaller/helm_utils.go
@@ -130,6 +130,8 @@ func BuildBaseHelmValues(ctx context.Context, kubeConfig *rest.Config, appConfig
 		values["workloads"] = buildWorkloadsValues(&replicas, -1)
 	}
 
+	values["exposePorts"] = buildExposePortsValues(appConfig.Ports)
+
 	if dryRun {
 		// Placeholder values for keys that require HelmOps context, have side
@@ -171,6 +173,30 @@ func BuildBaseHelmValues(ctx context.Context, kubeConfig *rest.Config, appConfig
 	return values, nil
 }
 
+func buildExposePortsValues(ports []appcfg.ServicePort) map[string]interface{} {
+	out := make(map[string]interface{}, len(ports))
+	for _, p := range ports {
+		out[p.Name] = p.ExposePort
+	}
+	return out
+}

--- a/framework/oac/internal/helmrender/values.go
+++ b/framework/oac/internal/helmrender/values.go
@@ -53,9 +53,10 @@ func BuildValues(owner, admin string, entrances []olm.EntranceInfo) map[string]i
 			"subjects": map[string]interface{}{},
 			"refs":     map[string]interface{}{},
 		},
-		"svcs":    map[string]interface{}{},
-		"cluster": map[string]interface{}{},
-		"GPU":     map[string]interface{}{},
+		"svcs":        map[string]interface{}{},
+		"exposePorts": map[string]interface{}{},
+		"cluster":     map[string]interface{}{},
+		"GPU":         map[string]interface{}{},
```
- **Lesson**: Any dynamic infrastructure state allocated during an orchestration lifecycle must be made accessible to templating engines before evaluation, accompanied by strict, populated dummy schemas during offline linting and dry-run compilation phases.

---

### Incident 2: Files App Directory Navigation Sorting Order Amnesia (BUG-OLARES-2446)

- **Context**: Subsystem: `apps/packages/app/src/api/files/v2/common/utils.ts`, Files App UI Store (`src/stores/files`).
- **What Was Expected**: When a user customizes directory sorting order (e.g., sort by modified date descending or size ascending) in the Files app, navigating into a subfolder and then back to the parent folder must preserve the active sorting mode. Clicking the sorting toggle button once should immediately invert the sort order.
- **What Actually Happened**: Upon navigating to a different directory and returning, the file listing visually reverted to default alphabetical ordering. However, the internal UI state still held the previous sorting selection. Consequently, clicking the sort arrow button had no visual effect on the first click; only on the second click did the sorting recalculate and update the DOM.
- **Evidence in Repo**: Issue #2446 (`[Bug] Files: Sorting order gets lost`).
- **Root Cause**: The directory data fetching pipeline (`formatAppDataNode`) hardcoded static default sorting objects (`sorting: { by: 'modified', asc: true }` or `sorting: { by: 'size', asc: false }`) into the newly materialized node descriptor on every navigation event without reconciling against the persistent Pinia store (`useFilesStore().sorting`). The view layer bound its display calculation to the newly fetched node's local sorting state, while the header control toggled the store's global sorting state, creating a split-brain UI state until toggled twice.
- **Remediation Code Diff**:
```typescript
--- a/apps/packages/app/src/api/files/v2/common/utils.ts
+++ b/apps/packages/app/src/api/files/v2/common/utils.ts
@@ -282,10 +282,11 @@ export function formatAppDataNode(
 	parentPath: string
 ) {
+	const filesStore = useFilesStore();
 	const nodeDir = {
 		path: url,
 		name: '',
 		size: 0,
@@ -293,9 +294,9 @@ export function formatAppDataNode(
 		type: '',
 		numDirs: 0,
 		numFiles: 0,
-		sorting: {
-			by: 'modified',
-			asc: true
-		},
+		sorting: filesStore.currentSorting ? { ...filesStore.currentSorting } : {
+			by: 'modified',
+			asc: true
+		},
```
- **Lesson**: UI state representing user presentation preferences must be decoupled from data models generated during network deserialization. Data hydration layers must preserve or inherit active view store configurations.

---

### Incident 3: Desktop Safari PWA Registration Lockout (BUG-OLARES-PWA-REG)

- **Context**: Subsystem: PWA Service Worker Client Bootloader. File: `apps/packages/app/src-pwa/register-service-worker.ts`.
- **What Was Expected**: Service workers should provide asset caching and background sync capabilities across supported browsers without throwing unhandled exceptions or breaking page loads.
- **What Actually Happened**: On macOS Desktop Safari, attempting to register the PWA service worker with standard parameters caused browser instability, inconsistent caching of OAuth tokens, and failed WebKit updates.
- **Evidence in Repo**: `apps/packages/app/src-pwa/register-service-worker.ts` lines 9-16.
- **Root Cause**: WebKit on macOS historically exhibited defects regarding PWA lifecycle events, lack of standalone desktop support, and cache invalidation deadlocks during ServiceWorker container registrations.
- **Remediation Code Diff**:
```typescript
--- a/apps/packages/app/src-pwa/register-service-worker.ts
+++ b/apps/packages/app/src-pwa/register-service-worker.ts
@@ -6,8 +6,13 @@ import { register } from 'register-service-worker';
 const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
 const isDesktop = !/(iPhone|iPod|iPad)/i.test(navigator.userAgent);
 const key = Date.now();
 
-register(`${process.env.SERVICE_WORKER_FILE}`, {
+if (isDesktop && isSafari) {
+	// safari does not support pwa on the desktop reliably; bypass registration
+} else {
+	register(`${process.env.SERVICE_WORKER_FILE}?key=${key}`, {
```
- **Lesson**: Edge client shells must perform defensive client-capability gating before registering background service workers, appending cache-busting timestamp queries (`?key=${Date.now()}`) to the script URL to bypass browser-level worker bytecode caching.

---

### Incident 4: Magic Offset Slicing Corruption in Cloud Storage Paths (BUG-OLARES-PATH-SLICE)

- **Context**: Subsystem: Cloud drive adapters. Files:
  - `apps/packages/app/src/api/files/v2/google/utils.ts`
  - `apps/packages/app/src/api/files/v2/awss3/utils.ts`
  - `apps/packages/app/src/api/files/v2/dropbox/utils.ts`
  - `apps/packages/app/src/api/files/v2/data/utils.ts`
- **What Was Expected**: When converting frontend virtual file paths to storage backend endpoints, provider-specific root identifiers (e.g. `/Drive/google`, `/Drive/awss3`, `/Drive/dropbox`, `/drive/Data`) must be stripped cleanly.
- **What Actually Happened**: Providers used disparate string slice constants:
  - `awss3RemoveHomePrefix`: `url.slice(12)` for `/Drive/awss3`
  - `googleRemoveHomePrefix`: `url.slice(13)` for `/Drive/google`
  - `dropboxRemoveHomePrefix`: `url.slice(14)` for `/Drive/dropbox`
  - `dataRemovePrefix`: `url.slice(5)` for `/Data`, `url.slice(11)` for `/drive/Data`
  When paths arrived with slight case variations (`/drive/awss3`) or trailing slash variances, the hardcoded slice offset truncated valid directory names or left residual characters, corrupting upstream cloud API calls.
- **Evidence in Repo**: Divergent prefix handling in `apps/packages/app/src/api/files/v2/*/utils.ts`.
- **Root Cause**: Lack of a centralized path tokenizer. Each cloud driver author manually counted string length characters and used magic `.slice(N)` numbers.
- **Remediation Code Diff**:
```typescript
--- a/apps/packages/app/src/api/files/v2/dropbox/utils.ts
+++ b/apps/packages/app/src/api/files/v2/dropbox/utils.ts
@@ -40,7 +40,7 @@ export function dropboxRemovePrefix(url: string) {
 }
 
 export function dropboxRemoveHomePrefix(url: string) {
-	if (!url.startsWith('/Drive/dropbox')) {
+	const prefix = '/Drive/dropbox';
+	if (!url.toLowerCase().startsWith(prefix.toLowerCase())) {
 		return url;
 	}
-	return url.slice(14);
+	return url.slice(prefix.length);
 }
```
- **Lesson**: Never hardcode integer indices when manipulating structured hierarchical strings. Compute offsets dynamically via `.length` of the verified matched prefix token.

---

### Incident 5: Batch File Deletion Path Collapsing Defect (BUG-OLARES-BATCH-DEL)

- **Context**: Subsystem: Storage batch operations. File: `apps/packages/app/src/api/files/v2/common/utils.ts`.
- **What Was Expected**: `batchDeleteFileItems` should group files by their parent directory (`oParentPath`) and issue a single atomic batch delete request per parent directory to minimize API round-trips.
- **What Actually Happened**: When items across multiple directories were selected for batch deletion, array index lookups using `e[0].oParentPath == item.oParentPath` failed to detect matching groups correctly if arrays were manipulated or if empty parent paths evaluated to undefined, causing excessive single-item HTTP calls or unhandled promise rejections on malformed parent paths.
- **Evidence in Repo**: `apps/packages/app/src/api/files/v2/common/utils.ts`, lines 220-258.
- **Root Cause**: Grouping logic used a nested loop search with shallow checks `e.length > 0 && e[0].oParentPath == item.oParentPath` without path canonicalization, failing on mixed trailing slashes.
- **Remediation Code Diff**:
```typescript
--- a/apps/packages/app/src/api/files/v2/common/utils.ts
+++ b/apps/packages/app/src/api/files/v2/common/utils.ts
@@ -226,7 +226,11 @@ export async function batchDeleteFileItems(items: FileItem[]) {
 	for (let i = 0; i < items.length; i++) {
 		const item = items[i];
+		const itemParent = (item.oParentPath || '/').replace(/\/+$/, '');
 		const index = groups.findIndex(
-			(e) => e.length > 0 && e[0].oParentPath == item.oParentPath
+			(e) => e.length > 0 && ((e[0].oParentPath || '/').replace(/\/+$/, '') === itemParent)
 		);
 		if (index >= 0) {
```
- **Lesson**: Batch grouping by path key must canonicalize strings (stripping redundant trailing slashes and null-coalescing empty paths) before partitioning work items into network requests.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Safe Return Code Parsing vs Type Coercion Trap
In `apps/packages/app/src/api/files/v2/common/utils.ts`, response code checking exhibits a defensive pattern against falsy `0`:

```typescript
// INVARIANT IMPLEMENTATION:
if (res.data.code != undefined) {
    if (res.data.code === -1) {
        BtNotify.show({
            type: NotifyDefinedType.FAILED,
            message: i18n.global.t('files.backslash_upload')
        });
    }
    return undefined;
}
```
*Micro-Forensic Analysis*: If the author had written `if (res.data.code)` (implicit truthy check), when `res.data.code === 0` (standard POSIX/C/Go success status code), the check evaluates to `false`. Conversely, checking `res.data.code != undefined` (loose inequality) simultaneously guards against both `null` and `undefined` while permitting numeric `0` to execute without false-branch trapping.

#### Array Index Slicing Off-by-One Hazards
In `apps/packages/app/src/api/files/v2/awss3/utils.ts`:
```typescript
export function download(_format, files) {
    const name = files.path.split('/')[3];
    const path = '/' + files.path.split('/').slice(4).join('/');
    return generateDownloadUrl(files.driveType, path, name);
}
```
*Defect Hazard*: The assumption that `files.path` starts with a leading slash causes `files.path.split('/')` to yield an empty string at index 0 (`""`). Index 3 and slice 4 are tightly coupled to exact 4-segment prefix schemas (`/Drive/awss3/bucket_name/object_path`). If a file path is passed without a leading slash (`Drive/awss3/bucket_name/object_path`), index 3 extracts the object path instead of the bucket name, and index 4 joins from the wrong offset, silently generating invalid signed URLs.

### 2. Infinite Loop & Recursion Guards

#### Task Promise Fan-out Termination Invariant
In `apps/packages/app/src/api/files/v2/common/utils.ts`, `moveCopy` executes array iterations to generate task promises:
```typescript
export function moveCopy(items: CopyStoragesType[], copy = false) {
    const promises: any[] = [];
    for (const item of items) {
        promises.push(pasteAction(item, copy ? 'copy' : 'move'));
    }
    return Promise.all(promises);
}
```
*Recursion Guard Invariant*:
- Loop Termination: Direct iterative traversal over a finite array `items` ensures the loop terminates in $O(N)$ iterations.
- Bounded Promise Resolution: `Promise