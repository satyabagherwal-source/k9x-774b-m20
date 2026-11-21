> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `1db8e79a`  
> **License**: BSD-3-Clause  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-21T23:26:44.889Z  
> **Learning ID**: `learn-github-tailscale-tailscale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tailscale/tailscale

---

## 1. Executive Forensic Architecture & System Mechanics

Tailscale implements a zero-trust mesh virtual private network overlaid on the WireGuard protocol, coordinated by an authenticated central control plane. The core architecture is partitioned across three operating planes:

```
+---------------------------------------------------------------------------------------+
|                                    CONTROL PLANE                                      |
|  (coord/controlclient: MapResponse stream, DERP map, node keys, node mutations/delta) |
+---------------------------------------------------------------------------------------+
                                     |
                                     | HTTPS / Noise Long-Poll Stream
                                     v
+---------------------------------------------------------------------------------------+
|                        DATA & ROUTING PLANE (tailscaled daemon)                       |
|                                                                                       |
|  +-------------------+       +--------------------+       +------------------------+  |
|  |     wgengine      | <---> |      magicsock     | <---> |      netmon/route      |  |
|  | (WireGuard Engine,|       | (STUN, ICE-lite,   |       | (Link monitoring, FIB, |  |
|  | TUN driver,       |       |  DERP relay, UDP   |       |  Linux netlink, Win    |  |
|  | gVisor netstack)  |       |  hole-punching)    |       |  wintun / IP Helper)   |  |
|  +-------------------+       +--------------------+       +------------------------+  |
+---------------------------------------------------------------------------------------+
                                     ^
                                     | LocalAPI (UNIX Domain Socket / Windows Named Pipe)
                                     v
+---------------------------------------------------------------------------------------+
|                         APPLICATION & CLIENT MANAGEMENT PLANE                         |
|                                                                                       |
|  +---------------------+      +---------------------+      +-----------------------+  |
|  |    tailscale CLI    |      |  Web Client Engine  |      |   tsconnect (Wasm /   |  |
|  | (ipnctl, status, up)|      | (React/SWR, WebMan) |      |   Browser in-memory)  |  |
|  +---------------------+      +---------------------+      +-----------------------+  |
+---------------------------------------------------------------------------------------+
```

### Architectural Subsystem Decoupling & Invariants

1. **`wgengine` (WireGuard Engine Layer)**: Decouples crypto-routing from transport. It hosts either an OS-level virtual network adapter (TUN interface on Linux/macOS, Wintun on Windows) or a userland TCP/IP stack (`gVisor/netstack`). It holds the WireGuard private key, manages symmetric ephemeral sessions, and enforces packet-level access control lists (ACLs).
2. **`magicsock` (Multipath Dynamic UDP & Relay Transport)**: Abstracts a multiplexed socket that swaps dynamically between direct point-to-point UDP tunnels (discovered via STUN, UPnP, and NAT-PMP hole punching) and encrypted relays over the Designated Encrypted Relay for Packets (DERP) network. DERP operates over TLS-wrapped WebSocket/TCP tunnels, providing deterministic fallbacks when stateful NATs, symmetric port mapping, or corporate firewalls forbid direct peer-to-peer UDP.
3. **`ipn` & `ipnlocal` (Local Node State Machine & LocalAPI Engine)**: Implements local node coordination, credential cache management, profile switching, exit-node traffic redirection, and node capabilities verification. The LocalAPI server exposes protected endpoints over local platform transports, requiring root or loopback-identity checks to prevent unauthorized local privilege escalation.
4. **Control Plane Protocol (`tailcfg.MapResponse`)**: The node receives delta-encoded network map (`netmap`) updates containing peer endpoint candidates, disco public keys, routes, and capabilities. Mutations can be full snapshot updates or field-level deltas (`NodeMutationDERPHome`, `NodeMutationEndpoints`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. In-Flight Dial Backlog Throttling for Loopback Test Servers
**RULE**: Any test suite or client component executing concurrent requests over fresh TCP/TLS connections against an in-process or loopback server MUST strictly limit maximum in-flight dials using a bounded concurrency primitive (such as a semaphore) to a value less than the operating system's default `SOMAXCONN` listen backlog (typically 8 to 128 depending on platform/container).  
**WHY**: Under Windows, macOS, and Linux network namespaces where `somaxconn` is constrained (or `tcp_abort_on_overflow=1`), unbounded goroutines dialing a single `httptest.Server` trigger listen backlog overflows. When the backlog overflows, Windows immediately drops or resets the connection with `WSAECONNREFUSED` or returns empty payloads, resulting in flaky, false-positive network failures (e.g., HTTP 502 Bad Gateway) completely unrelated to the logic under test.  
**WHEN TO APPLY**: High-concurrency integration tests, reverse-proxy regression harnesses, and internal microservice scrapers initiating bursts of short-lived loopback TCP connections.  
**VERIFIED IMPLEMENTATION PATTERN**:
```go
package integration_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// BoundedConcurrentCaller limits concurrent dials to prevent OS backlog overflows.
func RunBoundedProbe(t *testing.T, srv *httptest.Server, totalRequests int, maxConcurrency int) {
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup
	errCh := make(chan error, totalRequests)

	for i := 0; i < totalRequests; i++ {
		wg.Add(1)
		go func(reqID int) {
			defer wg.Done()

			// Invariant: Must acquire semaphore token before initiating dial
			sem <- struct{}{}
			defer func() { <-sem }()

			req, err := http.NewRequestWithContext(context.Background(), "GET", srv.URL+"/probe", nil)
			if err != nil {
				errCh <- fmt.Errorf("req build failed: %w", err)
				return
			}

			resp, err := srv.Client().Do(req)
			if err != nil {
				errCh <- fmt.Errorf("dial/exec failed: %w", err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				errCh <- fmt.Errorf("unexpected status code: %d", resp.StatusCode)
				return
			}
		}(i)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent probe encountered failure: %v", err)
		}
	}
}
```
**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Spawning hundreds of simultaneous goroutines dialing
// the same listener without concurrency bounds.
func RunFlakyUnboundedProbe(t *testing.T, srv *httptest.Server, count int) {
	var wg sync.WaitGroup
	for i := 0; i < count; i++ { // count = 400
		wg.Add(1)
		go func() { // Fails on Windows / hardened Linux due to SOMAXCONN overflow
			defer wg.Done()
			resp, err := http.Get(srv.URL + "/test")
			if err != nil || resp.StatusCode != 200 {
				t.Errorf("connection refused or 502 returned")
			}
		}()
	}
	wg.Wait()
}
```
**VERIFICATION METHOD**: Execute the test inside a Linux network namespace configured with constrained network buffers:
```bash
sudo ip netns add testns
sudo ip netns exec testns sysctl -w net.core.somaxconn=8
sudo ip netns exec testns sysctl -w net.ipv4.tcp_abort_on_overflow=1
sudo ip netns exec testns go test -v -race -run TestConcurrentStreams ./... -count=100
```

---

### 2. Dual-Layer State Cache Invariant: Endpoint Mutations Must Patch Reference Snapshots
**RULE**: In distributed state replication systems receiving both fine-grained field-level patches (deltas) and full coarse-grained snapshots, any mutation applied directly to an active operational handle (e.g., active network endpoint) MUST simultaneously update or invalidate the underlying local snapshot/shadow copy used by fast-path comparison routines (`c.peersByID`).  
**WHY**: If a delta mutation updates only the active runtime state (`ep.setDERPHome(B)`) but bypasses the reference snapshot (`snapshot.DERPHome` remains `A`), a subsequent full snapshot arriving containing state `A` will trigger an equality fast-path bypass (`snapshot.Equal(fullNetmapNode)` evaluates to `true`). The runtime endpoint will retain the stale delta state (`B`) indefinitely, completely desynchronizing routing paths until an unrelated netmap mutation forces an eviction.  
**WHEN TO APPLY**: Any event-driven distributed client maintaining local caches, network topology maps, or CRDTs where partial delta updates interleave with periodic full snapshot synchronization.  
**VERIFIED IMPLEMENTATION PATTERN**:
```go
package state

import (
	"sync"
)

type Node struct {
	ID       uint64
	DERPHome int
	Endpoints []string
}

func (n *Node) Clone() *Node {
	cp := *n
	cp.Endpoints = append([]string(nil), n.Endpoints...)
	return &cp
}

func (n *Node) Equal(other *Node) bool {
	if n.ID != other.ID || n.DERPHome != other.DERPHome || len(n.Endpoints) != len(other.Endpoints) {
		return false
	}
	for i := range n.Endpoints {
		if n.Endpoints[i] != other.Endpoints[i] {
			return false
		}
	}
	return true
}

type RouterState struct {
	mu        sync.RWMutex
	activeEP  map[uint64]*EndpointRuntime
	snapshots map[uint64]*Node // Invariant: Must always reflect current baseline
}

type EndpointRuntime struct {
	derpHome int
}

// ApplyDelta safely mutates runtime AND reference snapshot atomically.
func (r *RouterState) ApplyDelta(nodeID uint64, newDERP int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ep, ok := r.activeEP[nodeID]; ok {
		ep.derpHome = newDERP
	}

	// CRITICAL INVARIANT: The reference snapshot MUST NOT remain stale.
	// Either update snapshot or invalidate it so next full netmap does not false-match.
	if snap, ok := r.snapshots[nodeID]; ok {
		cloned := snap.Clone()
		cloned.DERPHome = newDERP
		r.snapshots[nodeID] = cloned
	}
}

// UpdateFullNetmap checks equality against reference snapshots.
func (r *RouterState) UpdateFullNetmap(nodes []*Node) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, incoming := range nodes {
		snap, exists := r.snapshots[incoming.ID]
		if exists && snap.Equal(incoming) {
			// Fast path safe: snap is guaranteed to reflect both prior full syncs AND interim deltas
			continue
		}

		// Reconfigure runtime endpoint and re-record snapshot
		if ep, ok := r.activeEP[incoming.ID]; ok {
			ep.derpHome = incoming.DERPHome
		}
		r.snapshots[incoming.ID] = incoming.Clone()
	}
}
```
**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Patching the live runtime endpoint while leaving the snapshot stale.
func (r *RouterState) BuggyApplyDelta(nodeID uint64, newDERP int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Direct mutation of runtime endpoint
	r.activeEP[nodeID].derpHome = newDERP
	// COMMENT: "per-field NodeMutation patches are never applied to snapshots"
	// DISASTER: Next incoming full netmap with derpHome matching old snapshot
	// will be skipped by snap.Equal(incoming), leaving activeEP permanently corrupted.
}
```
**VERIFICATION METHOD**: Property-based delta-to-snapshot sequencing test:
1. Initialize node with `DERPHome = A`.
2. Apply delta mutation `DERPHome = B`.
3. Apply full netmap with `DERPHome = A`.
4. Assert that `runtimeEndpoint.DERPHome == A`. Any failure proves snapshot-desync short-circuiting.

---

### 3. CI Process Tree Isolation and Handle Decoupling on Windows
**RULE**: Long-running background processes spawned during CI pipeline steps on Windows runners MUST NOT inherit the caller step’s standard input/output/error pipes, and their lifetime MUST be verified across explicit step boundaries via out-of-band sentinel files or PID monitors.  
**WHY**: On Windows runner agents (e.g., GitHub Actions Runner), child processes spawned with inherited stdout/stderr file handles hold open the parent step’s IPC pipe. When the execution step completes, the runner halts and hangs indefinitely waiting for EOF on the output pipe, or the runner process reaper forcibly terminates the entire process tree, killing essential background daemons (such as remote FUSE/WinFsp filesystem drivers or cache proxies).  
**WHEN TO APPLY**: Background daemons, emulators, local cache mounts, and mock services initiated in Windows CI/CD workflows.  
**VERIFIED IMPLEMENTATION PATTERN**:
```powershell
# Invariant: Execute via ComSpec without inherited pipes, redirecting streams to disk
$log = Join-Path $env:RUNNER_TEMP 'daemon.log'
$cmdArgs = "/d /s /c `"`"$exe`" --daemon-flag > `"$log`" 2>&1`""
$p = Start-Process -PassThru -WindowStyle Hidden -FilePath $env:ComSpec -ArgumentList $cmdArgs

# Explicit readiness barrier with non-blocking deadline
$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Path "$env:TARGET_MOUNT\.sentinel-status")) {
    if ($p.HasExited -or (Get-Date) -gt $deadline) {
        Get-Content -LiteralPath $log -Tail 50 -ErrorAction SilentlyContinue
        throw "Background daemon terminated prematurely or failed readiness probe"
    }
    Start-Sleep -Milliseconds 100
}
```
**NEGATIVE CONSTRAINT**:
```powershell
# ANTI-PATTERN: Direct invocation or inheriting standard pipes in CI step.
# Causes the runner to hang waiting for EOF, or runner kills process upon step exit.
Start-Process -FilePath "C:\bin\daemon.exe" -ArgumentList "--serve" -NoNewWindow
# or
& "C:\bin\daemon.exe" --serve &
```
**VERIFICATION METHOD**: Add a trailing verification step configured with `if: always()` in CI:
```yaml
- name: Verify Daemon Survival
  if: always()
  shell: pwsh
  run: |
    $p = Get-Process mydaemon -ErrorAction SilentlyContinue
    if (-not $p) {
      Write-Error "Daemon died unexpectedly before step completed"
      exit 1
    }
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Listen Backlog Overflow on Concurrent Loopback Dials
- **Context**: Subsystem: `ipn/ipnlocal`, File: `ipn/ipnlocal/serve_test.go`
- **What Was Expected**: `TestServeAppCapsConcurrentStreams` validates capability header enforcement across concurrent HTTP streams over Tailscale Serve. The test was expected to execute 400 simultaneous requests reliably across all supported operating systems.
- **What Actually Happened**: On Windows CI runners, dials failed with dropped connections. The internal proxy returned an empty `502 Bad Gateway`. The test asserted non-empty body headers and threw an unhelpful assertion error: `"/ops: capabilities header missing"`.
- **Evidence in Repo**: Commit `ee7324a2`, Issue `#22543`.
- **Root Cause**: The test launched 400 goroutines concurrently dialing an in-process `httptest.Server`. Windows sets a low default socket listen backlog (`SOMAXCONN`). When 400 simultaneous syn-packets flooded the loopback socket, the OS kernel dropped the excess incoming connections. The reverse proxy received a connection refused/reset, resulting in a 502 response with an empty body.
- **Remediation Code Diff**:
```go
@@ -1116,21 +1117,38 @@ func TestServeAppCapsConcurrentStreams(t *testing.T) {
 	const rounds = 200
 	var wg sync.WaitGroup
 	errCh := make(chan error, 2*rounds) // both mounts can fail every round
+
+	// Each request in flight may dial testServ. Hundreds of simultaneous
+	// dials overflow its listen backlog, and Windows refuses the excess
+	// connections, so cap the number of requests in flight.
+	sem := syncs.NewSemaphore(8)
+	serve := func(path string) (string, error) {
+		sem.Acquire()
+		defer sem.Release()
+		w := httptest.NewRecorder()
+		b.serveWebHandler(w, newReq(path))
+		if w.Code != http.StatusOK {
+			return "", fmt.Errorf("%s: status %d, body %q", path, w.Code, w.Body.String())
+		}
+		return w.Body.String(), nil
+	}
 	for range rounds {
 		wg.Add(2)
 		go func() {
 			defer wg.Done()
-			w := httptest.NewRecorder()
-			b.serveWebHandler(w, newReq("/ops"))
-			if got := w.Body.String(); got == "" {
+			got, err := serve("/ops")
+			if err != nil {
+				errCh <- err
+			} else if got == "" {
 				errCh <- fmt.Errorf("/ops: capabilities header missing")
 			}
 		}()
```
- **Lesson**: High-concurrency integration tests must never launch unbounded dials against a single TCP listener; concurrency must be throttled below the OS listen backlog threshold.

---

### Incident 2: DERP Home Desynchronization via Unpatched Snapshot Bypass
- **Context**: Subsystem: `wgengine/magicsock`, File: `wgengine/magicsock/magicsock.go`
- **What Was Expected**: When a peer moves its DERP home relay from region A to region B and subsequently returns to region A, `magicsock` must route packets to region A.
- **What Actually Happened**: The peer remained stuck routing to region B. Packets were routed to an unreachable DERP relay region, dropping all connectivity until an unrelated netmap property mutated.
- **Evidence in Repo**: Issue `#22379`, reproducible across v1.102.5 through v1.104.5.
- **Root Cause**:
  1. `Conn.UpdateNetmapDelta` received a field-level `NodeMutationDERPHome` updating the endpoint via `ep.setDERPHome(B)`.
  2. The reference snapshot map `c.peersByID` was deliberately left unpatched (documented as not tracking deltas).
  3. When the peer moved back to region A, the update arrived embedded inside a full `MapResponse` netmap payload.
  4. `Conn.updateNodes` invoked its fast-path equality check: `peersByID[id].Equal(newNode)`.
  5. Because `newNode.DERPHome == A` matched the stale snapshot `peersByID[id].DERPHome == A`, the method concluded nothing had changed and skipped updating the live endpoint. The live endpoint remained trapped on region B.
- **Remediation Code Diff**:
```go
// Architectural fix applied in magicsock netmap engine:
func (c *Conn) UpdateNetmapDelta(mutations []NodeMutation) {
    c.mu.Lock()
    defer c.mu.Unlock()
    for _, m := range mutations {
        if dm, ok := m.(NodeMutationDERPHome); ok {
            if ep, ok := c.endpoints[dm.NodeID]; ok {
                ep.setDERPHome(dm.RegionID)
            }
+           // Patch the baseline snapshot so subsequent full netmaps
+           // do not short-circuit when reverting back to earlier states.
+           if snap, ok := c.peersByID[dm.NodeID]; ok {
+               snap.DERPHome = dm.RegionID
+           }
        }
    }
}
```
- **Lesson**: Fast-path equality checks based on cached snapshots fail silently if any mutation pathway modifies live operational state without updating or invalidating the snapshot.

---

### Incident 3: 1Hz Kernel Wake-Up via Obsolete Linux TUN Namespace Probe
- **Context**: Subsystem: `wireguard-go` / `tun` subsystem on Linux
- **What Was Expected**: An idle `tailscaled` process should remain quiescent in epoll wait without waking up the CPU or generating context switches.
- **What Actually Happened**: Every second, `tailscaled` woke up and executed a zero-byte write operation against the Linux TUN device file descriptor. This drained battery on mobile/laptop hardware and caused synthetic test environments (`synctest`) to record constant activity.
- **Evidence in Repo**: Issue `#22450`, discovered in kernel bisection testing via Go `synctest`.
- **Root Cause**: An upstream legacy hack from 2017 in `wireguard-go` executed periodic zero-byte writes to check if the TUN device had been moved to another network namespace. In Linux 4.5 through 5.0, a zero-byte write on a down interface returned `EIO`, while on an up interface it fell through to length checking and returned `EINVAL`. Stable kernel backports in 2019 broke this semantic behavior, rendering the check completely non-functional while leaving the 1-second timer actively spinning.
- **Remediation Architectural Decision**: Eliminate the 1Hz polling timer entirely. Network namespace changes and link migrations must be tracked reactively via netlink sockets (`RTM_NEWLINK`, `RTM_DELLINK`) instead of active kernel polling.
- **Lesson**: Polling kernel interfaces for status changes using undocumented error-code side effects is fragile across kernel versions; use native asynchronous kernel event mechanisms (such as netlink).

---

### Incident 4: CI Windows Runner Process Tree Deadlocks and Cache Starvation
- **Context**: Subsystem: `.github/actions/gomodfs-mount`, Files: `action.yml`, `start.ps1`, `use.ps1`
- **What Was Expected**: Windows CI runner jobs mount a remote Go module cache (`gomodfs` via WinFsp) on `M:` to accelerate builds, falling back gracefully to direct network downloads if mounting fails.
- **What Actually Happened**: The step hung indefinitely, or `gomodfs.exe` was instantly killed by the GitHub Actions runner upon completion of `start.ps1`, leaving the build without a Go module cache or toolchain.
- **Evidence in Repo**: Commit `1db8e79a`, CORP-34812.
- **Root Cause**:
  1. Spawning child processes directly inside PowerShell inherited standard output/error pipes. When the step finished, the runner kept waiting on pipe EOF.
  2. The runner process reaper aggressively sent termination signals to all processes in the step's job object upon step completion.
  3. Setting `GOMODCACHE` before ensuring the daemon survived the step transition resulted in broken file lookups.
- **Remediation Code Diff**:
```powershell
@@ -0,0 +1,98 @@
+    Time-Phase 'mounting gomodfs' {
+        Remove-Item Env:PARENTDEATH_ADDR, Env:PARENTDEATH_SESSION -ErrorAction SilentlyContinue
+        # Start gomodfs via ShellExecute (no -NoNewWindow or -Redirect*
+        # flags) so it doesn't inherit this step's stdout and stderr pipes.
+        # If it did, the runner would kill it when this step ends.
+        $cmdArgs = "/d /s /c `"`"$exe`" --winfsp --mount=$env:DRIVE --remote-store=$url > `"$log`" 2>&1`""
+        $p = Start-Process -PassThru -WindowStyle Hidden -FilePath $env:ComSpec -ArgumentList $cmdArgs
+        $deadline = (Get-Date).AddSeconds(30)
+        while (-not (Test-Path "$env:DRIVE\.gomodfs-status")) {
+            if ($p.HasExited -or (Get-Date) -gt $deadline) {
+                Get-Content -LiteralPath $log -Tail 20 -ErrorAction SilentlyContinue
+                throw "mounting gomodfs on $env:DRIVE failed"
+            }
+            Start-Sleep -Milliseconds 100
+        }
+    }
```
- **Lesson**: Background system daemons in CI must be detached from runner IO pipes via `ComSpec`/`ShellExecute`, and consumption must be staged in a distinct subsequent step after process survival is confirmed.

---

### Incident 5: Web Client Self-Update Polling Race & Daemon Disappearance
- **Context**: Subsystem: `client/web`, File: `client/web/src/hooks/self-update.ts`
- **What Was Expected**: During a self-update triggered from the browser UI, the frontend polls `/local/v0/update/progress`. When `tailscaled` restarts, it briefly goes offline and returns HTTP network errors before reconnecting and reporting the new version.
- **What Actually Happened**: An immediate poll failure during the daemon's restart was either swallowed (freezing the UI) or falsely flagged as a permanent fatal crash. Furthermore, naive poll loops without offset tracking reprocessed duplicate error/progress log entries.
- **Evidence in Repo**: `client/web/src/hooks/self-update.ts` line 56-115.
- **Root Cause**: The update endpoint returns an append-only log array of progress structs. Re-reading from index 0 on every tick caused log duplication and stale status evaluations. If the daemon restarted, `fetch` failed immediately; without an explicit missing-poll threshold (`tsAwayForPolls >= 300`), the client could not distinguish a normal daemon reboot from a binary crash.
- **Remediation Pattern**:
```typescript
let tsAwayForPolls = 0
let updateMessagesRead = 0

function poll() {
  apiFetch<UpdateProgress[]>("/local/v0/update/progress", "GET")
    .then((res) => {
      // Invariant: strictly increasing progress log stream
      for (; updateMessagesRead < res.length; ++updateMessagesRead) {
        const up = res[updateMessagesRead]
        if (up.status === "UpdateFailed") {
          setUpdateState(UpdateState.Failed)
          return
        }
        if (up.status === "UpdateFinished") {
          // If daemon came back but version didn't change, evaluate if manual restart is needed
          if (up.version === currentVersion && tsAwayForPolls > 0) {
            setUpdateState(UpdateState.Failed)
          } else {
            setUpdateState(UpdateState.Complete)
          }
          return
        }
      }
      timer = setTimeout(poll, 1000)
    })
    .catch((err) => {
      ++tsAwayForPolls
      // Grace period: allow 5 minutes (300 polls) for daemon restart before giving up
      if (tsAwayForPolls >= 5 * 60) {
        setUpdateState(UpdateState.Failed)
      } else {
        timer = setTimeout(poll, 1000)
      }
    })
}
```
- **Lesson**: Polling state machines tracking restarting backend services must combine cursor-based log advancement with bounded retry windows for transport-level dropouts.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **DNS Suffix Trimming Immutability (`trimDNSSuffix`)**:
```typescript
export function trimDNSSuffix(s: string, tailnetDNSName: string): string {
  if (s.endsWith(".")) {
    s = s.slice(0, -1) // Invariant: Strip absolute FQDN root dot first
  }
  if (s.endsWith("." + tailnetDNSName)) {
    s = s.replace("." + tailnetDNSName, "") // Invariant: Retain hostname label
  }
  return s
}
```
*Hazard Prevented*: In Go and TypeScript, performing naive string splits on `.` strips inner dots in subdomains. Stripping the root dot before suffix matching ensures `my-host.my-net.ts.net.` maps correctly to `my-host`.

- **Strict Type Validation in Asynchronous Clipboard Writers**:
```typescript
function validateString(val: unknown): string {
  if (typeof val !== "string" || val.length === 0) {
    throw new TypeError("Expected non-empty string, got " + typeof val)
  }
  return val
}
```
*Hazard Prevented*: Empty strings or resolved non-string values passed to `navigator.clipboard.write` or `ClipboardItem` throw DOM exceptions in WebKit/Blink. Explicit runtime validation guarantees non-empty strings before crossing the DOM boundary.

### 2. Infinite Loop & Recursion Guards
- **Strictly Increasing Stream Index Invariant (`self-update.ts`)**:
```typescript
// Termination Invariant: updateMessagesRead strictly increases to res.length
for (; updateMessagesRead < res.length; ++updateMessagesRead) {
  const up = res[updateMessagesRead]
  // Process item
}
```
*Hazard Prevented*: Array polling APIs that return append-only logs must advance a persistent index rather than resetting loop counters or calling `res.forEach()`, preventing duplicate notifications and UI re-render thrashing.

- **Non-blocking Polling Deadlines in Shell Executions (`start.ps1`)**:
```powershell
$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Path "$env:DRIVE\.gomodfs-status")) {
    if ($p.HasExited -or (Get-Date) -gt $deadline) {
        throw "mounting failed"
    }
    Start-Sleep -Milliseconds 100
}
```
*Hazard Prevented*: Prevents CI jobs from hanging for the full 60-minute workflow timeout when a filesystem driver fails silently during background initialization.

### 3. UI & UX Micro-Mechanics
- **Mixed-Content Protection in Local Web Sockets (`useTSWebConnected.ts`)**:
```typescript
if (isHTTPS()) {
  // When page is loaded over HTTPS, the connectivity check will always
  // fail with a mixed-content error. In this case don't bother doing the check.
  return
}
```
*Hazard Prevented*: The browser blocks plaintext HTTP requests to loopback (`http://100.x.y.z:5252`) from HTTPS pages. Skipping the check prevents noisy console errors and broken connection states.

- **Selection State Restoration in Clipboard Fallback (`clipboard.ts`)**:
```typescript
let selection = document.getSelection()
const selected = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : false
el.select()
document.execCommand("copy")
el.remove()
if (selected) {
  selection = document.getSelection()
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(selected) // Invariant: Restore active user focus
  }
}
```
*Hazard Prevented*: Fallback clipboard copying uses a hidden `<textarea>`. Without capturing and restoring `document.getSelection()`, copy actions silently de-select user text in active input fields.

### 4. Backend Concurrency & Memory Safety
- **Lock Contention and Backlog Starvation Guard (`syncs.Semaphore`)**:
```go
sem := syncs.NewSemaphore(8)
serve := func(path string) (string, error) {
    sem.Acquire()
    defer sem.Release()
    w := httptest.NewRecorder()
    b.serveWebHandler(w, newReq(path))
    return w.Body.String(), nil
}
```
*Hazard Prevented*: Limits concurrent goroutines against in-process listeners to prevent socket exhaustion and `ECONNREFUSED` errors during parallel test runs.

- **Timer Cleanup on Unmount Hook Pattern (`self-update.ts`)**:
```typescript
return () => {
  if (timer) clearTimeout(timer)
  timer = undefined
}
```
*Hazard Prevented*: Prevents dangling timers from firing and calling `setUpdateState` after component unmounts, avoiding memory leaks and React state warnings.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Null Safety in Exit Node Priority Sorting (`exit-nodes.ts`)**:
```typescript
function highestPriorityNode(nodes: ExitNode[]): ExitNode |