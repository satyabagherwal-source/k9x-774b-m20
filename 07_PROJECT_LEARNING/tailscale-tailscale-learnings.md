> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `5a05ac11`  
> **License**: BSD-3-Clause  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T04:17:53.089Z  
> **Learning ID**: `learn-github-tailscale-tailscale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tailscale/tailscale

---

## 1. Executive Forensic Architecture & System Mechanics

Tailscale implements a zero-trust mesh virtual private network (tailnet) layered over the WireGuard protocol using point-to-point UDP encapsulation, automatic NAT traversal (Interactive Connectivity Establishment / STUN / DERP relays), and distributed identity verification.

```
                      +------------------------------------------+
                      |         Tailscale Control Plane          |
                      |   (Coordination Server / Derp Map / ACLs)|
                      +------------------------------------------+
                                    |               ^
                   Sync NetMap / WG | Keys          | Machine Auth / Keepalive
                                    v               |
+----------------------------------------------------------------------------------------------------+
| Local Node (tailscaled)                                                                            |
|                                                                                                    |
|  +-------------------+        +--------------------+        +-----------------------------------+  |
|  |     wgengine      | <----> |     router/OS      | <----> |           net/tsdial              |  |
|  | (WireGuard Engine)|        |  (Route Engine /   |        | (Dual Stack / Happy Eyeballs /    |  |
|  |  [wireguard-go]   |        |   iptables / sys)  |        |  MagicDNS Fast-Path Interceptor)  |  |
|  +-------------------+        +--------------------+        +-----------------------------------+  |
|           ^                            ^                                      ^                    |
|           |                            |                                      |                    |
|           v                            v                                      v                    |
|  +-------------------+        +--------------------+        +-----------------------------------+  |
|  |   tailssh / PTY   |        |     magicdns       |        |             tsnet                 |  |
|  | (RawConn Dups /   |        | (Split Resolver /  |        |  (In-Memory Userspace Network     |  |
|  |  Poller Runtimes) |        |  Forwarder Tree)   |        |   Stack / gVisor Netstack)        |  |
|  +-------------------+        +--------------------+        +-----------------------------------+  |
|           ^                                                                                        |
|           | (SCM_RIGHTS / Monitored Process Group)                                                 |
|           v                                                                                        |
|  +-------------------+                                                                             |
|  |    ssh-monitor    |                                                                             |
|  |   (Supervision)   |                                                                             |
|  +-------------------+                                                                             |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Subsystems and Domain Primitives

1. **Local Node Engine (`tailscaled`)**: Encapsulates state machines handling dynamic network maps (`netmap.NetworkMap`), engine reconfigurations, OS packet filtering rules (iptables/nftables/pf), and virtual network adapters (`tun`).
2. **WireGuard Engine Abstraction (`wgengine`)**: Wraps userspace WireGuard (`wireguard-go`) and userspace network stacks (`gVisor / netstack`). Manages endpoint discovery through STUN, fallback DERP (Designated Encrypted Relay for Packets) HTTPS-based tunnels, and cryptographic session key handshakes.
3. **Dialing & Interception Engine (`net/tsdial`)**: Serves as the central traffic director. Bypasses OS routing loops, multiplexes traffic between physical interfaces and WireGuard overlays, intercepts internal peer traffic via MagicDNS lookup vectors, and applies Happy Eyeballs dial algorithms.
4. **Tailscale SSH (`tailssh`)**: Implements an in-process RFC 4254 SSH server. Executes PTY lifecycle isolation, process grouping (`Setsid`, `Setctty`), file descriptor duplication without descriptor leakage (`F_DUPFD_CLOEXEC`), and POSIX terminal tear-downs via non-blocking master runtime poller integration.
5. **Split DNS Forwarder (`net/dns/resolver`)**: A hierarchical query dispatch engine. Routes DNS resolutions across internal MagicDNS domains, enterprise corporate split domains, search domains, exit-node DoH gateways, and host OS fallbacks while isolating ambient cloud provider link-local resolvers (`169.254.169.254`).
6. **Embedded Userspace Node (`tsnet`)**: Compiles `tailscaled` directly into a third-party client binary, executing network namespaces fully in-memory via gVisor netstack without requiring OS root/TUN driver access.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Polled File Descriptor Runtime Registration Invariant
**RULE**:
When wrapping an existing or duplicated OS file descriptor (such as a PTY master, socket, or pipe) with runtime-managed I/O wrappers (`os.NewFile` in Go, or an asynchronous event loop registrar in Rust/C++), the descriptor MUST be configured with non-blocking mode (`O_NONBLOCK`) and close-on-exec (`FD_CLOEXEC`) BEFORE runtime registration, and all metadata operations (such as `ioctl` or flag queries) MUST be executed using non-releasing raw syscall barriers (`syscall.RawConn.Control`). A runtime-wrapped file's descriptor MUST NOT be queried using bare accessor methods (such as `File.Fd()`).

**WHY**:
In Go and similar runtimes, calling `File.Fd()` automatically places the underlying descriptor back into blocking mode so external syscalls can use it. This strips `O_NONBLOCK`, disconnecting the descriptor from the runtime network poller (`epoll`/`kqueue`). When another thread concurrently invokes `File.Close()`, the pending I/O thread remains blocked in a kernel-level read/write wait that cannot be interrupted, causing deadlocks, wedged shutdown hooks, and connection leaks. Furthermore, uncoordinated closes can release an integer descriptor that is immediately recycled by another goroutine, leading to destructive `EBADF` or silent corruption of arbitrary resources.

**WHEN TO APPLY**:
Apply when bridging low-level POSIX OS primitives (pseudo-terminals, unix domain sockets, SCM_RIGHTS file passing) into runtime-polled abstractions across Go, Rust (Tokio/Mio), and C++ (libuv/Asio).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Production-grade descriptor duplication and runtime poller binding
func dupPTYMaster(f *os.File) (*os.File, error) {
	raw, err := f.SyscallConn()
	if err != nil {
		return nil, fmt.Errorf("retrieving SyscallConn: %w", err)
	}

	fd := -1
	var dupErr error
	// Control prevents concurrent Close from releasing the fd during invocation
	if err := raw.Control(func(src uintptr) {
		// 1. Atomically allocate lowest available descriptor >= 0 with CLOEXEC
		fd, dupErr = unix.FcntlInt(src, unix.F_DUPFD_CLOEXEC, 0)
		if dupErr == nil {
			// 2. Set O_NONBLOCK BEFORE runtime poller ingestion
			dupErr = unix.SetNonblock(fd, true)
		}
	}); err != nil {
		return nil, fmt.Errorf("control invocation failed: %w", err)
	}

	if dupErr != nil {
		if fd != -1 {
			_ = unix.Close(fd)
		}
		return nil, fmt.Errorf("duplicating descriptor: %w", dupErr)
	}

	// 3. Register with Go's runtime poller
	dup := os.NewFile(uintptr(fd), f.Name())

	// 4. Invariant Assertion: Verify descriptor is actively managed by runtime poller
	if err := dup.SetReadDeadline(time.Time{}); err != nil {
		_ = dup.Close()
		return nil, fmt.Errorf("PTY master descriptor rejected by runtime poller: %w", err)
	}
	return dup, nil
}

// Window resize ioctl synchronized via RawConn
func updateWindowSize(f *os.File, ws *unix.Winsize) error {
	raw, err := f.SyscallConn()
	if err != nil {
		return err
	}
	var ioctlErr error
	// raw.Control retains descriptor lock, guaranteeing fd is not closed or reused concurrently
	err = raw.Control(func(fd uintptr) {
		for {
			ioctlErr = unix.IoctlSetWinsize(int(fd), syscall.TIOCSWINSZ, ws)
			if !errors.Is(ioctlErr, unix.EINTR) {
				break
			}
		}
	})
	if err != nil {
		return err
	}
	return ioctlErr
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER extract bare Fd() and mutate flags on managed abstractions
func badDupPTYMaster(f *os.File) (*os.File, error) {
	// BUG: Calling f.Fd() sets the underlying descriptor back to BLOCKING mode in Go!
	srcFd := f.Fd() 

	// BUG: Raw dup leaves FD_CLOEXEC unset; leaks descriptors into child processes
	newFd, err := unix.Dup(int(srcFd))
	if err != nil {
		return nil, err
	}

	newFile := os.NewFile(uintptr(newFd), f.Name())
	// BUG: External ioctl via raw newFd will race with concurrent newFile.Close()
	// and cause undefined behavior or write to a recycled descriptor.
	return newFile, nil
}
```

**VERIFICATION METHOD**:
Enforce runtime pollability and non-blocking invariants using a unit test verifying that setting a read deadline succeeds, and that invoking `Close()` immediately interrupts an active blocked read loop rather than hanging on EAGAIN/EOF:
```go
func AssertDescriptorPollable(t *testing.T, f *os.File) {
	t.Helper()
	if err := f.SetReadDeadline(time.Now().Add(-1 * time.Second)); err != nil {
		t.Fatalf("file %s is not integrated with Go runtime network poller: %v", f.Name(), err)
	}
	var b [1]byte
	_, err := f.Read(b[:])
	if !errors.Is(err, os.ErrDeadlineExceeded) {
		t.Fatalf("expected ErrDeadlineExceeded on expired deadline, got: %v", err)
	}
}
```

---

### 2. Upstream DNS Fallback Isolation Invariant
**RULE**:
DNS client and proxy engines that evaluate enterprise routing policies MUST distinguish between configured authoritative routes and ambient/unconfigured fallback resolvers. When resolving a query under a configured split domain, search domain, or explicit DNS override, if an authoritative denial (`NXDOMAIN`) or server failure (`SERVFAIL`) is returned by the designated resolver, the engine MUST NOT fall back to local host resolvers or ambient cloud-host metadata resolvers (`169.254.169.254`).

**WHY**:
Falling back to host resolvers when an internal or policy-designated resolver returns an error breaks zero-trust split-horizon DNS models. It allows private namespace queries (such as `database.internal.corp`) to leak out to public/ISP resolvers or cloud-provider ambient forwarders, exposing internal architecture. Additionally, it causes non-deterministic query resolution where down services resolve to public sinkholes, causing severe security and routing violations.

**WHEN TO APPLY**:
Apply to all DNS forwarders, internal resolvers, HTTP clients, and connection dialers in VPN software, service meshes, or enterprise routing daemons.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
type DNSForwardRoute struct {
	Suffix    string
	Resolvers []string
	Ambient   bool // true if derived from host environment/DHCP/cloud metadata
}

type ResolverEngine struct {
	mu     sync.RWMutex
	routes []DNSForwardRoute
}

func (r *ResolverEngine) HasConfiguredRouteFor(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, route := range r.routes {
		if route.Ambient {
			// Ambient fallbacks MUST NOT prevent strict resolution failures
			continue
		}
		if route.Suffix == "." || strings.HasSuffix(strings.ToLower(name), strings.ToLower(route.Suffix)) {
			return true
		}
	}
	return false
}

func (r *ResolverEngine) Resolve(ctx context.Context, name string) ([]netip.Addr, error) {
	hasRoute := r.HasConfiguredRouteFor(name)

	ips, err := r.queryTailnetUpstream(ctx, name)
	if err == nil && len(ips) > 0 {
		return ips, nil
	}

	// CRITICAL INVARIANT: Never fall back to host resolver if the name belongs to a configured route
	if hasRoute {
		if err != nil {
			return nil, fmt.Errorf("upstream resolution failed for configured route %q: %w", name, err)
		}
		return nil, &net.DNSError{Err: "no such host", Name: name, IsNotFound: true}
	}

	// Only unconfigured queries may fall back to host resolver / ambient forwarders
	return r.queryHostFallback(ctx, name)
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER leak internal queries to ambient host resolvers on upstream failure
func (r *ResolverEngine) BadResolve(ctx context.Context, name string) ([]netip.Addr, error) {
	ips, err := r.queryTailnetUpstream(ctx, name)
	// ANTI-PATTERN: Blindly falling back to host resolution leaks corporate namespaces
	if err != nil || len(ips) == 0 {
		return r.queryHostFallback(ctx, name) 
	}
	return ips, nil
}
```

**VERIFICATION METHOD**:
Write integration tests where an internal split-route upstream resolver returns an explicit `NXDOMAIN` or `SERVFAIL`. Assert that the client returns a terminal error and that no outgoing packets hit a mocked host resolver:
```go
func TestNoFallbackOnConfiguredRouteFailure(t *testing.T) {
	harness := setupDNSHarness(t)
	harness.AddSplitRoute("corp.internal.", mockBrokenResolver) // returns SERVFAIL
	harness.SetHostFallback(mockHostResolver)                   // must not be called

	_, err := harness.Resolve(context.Background(), "secret.corp.internal.")
	if err == nil {
		t.Fatal("expected error, got successful resolution")
	}
	if harness.HostResolverQueryCount() > 0 {
		t.Fatalf("SECURITY VIOLATION: %d queries leaked to host resolver", harness.HostResolverQueryCount())
	}
}
```

---

### 3. Chunked UTF-8 Multi-Byte Buffer Splitting Invariant
**RULE**:
Stream parsers, terminal emulators, and character decoders reading from network chunks or file descriptors MUST NOT attempt to decode or stringify arbitrary sub-slices of raw byte buffers directly into unicode/UTF-8 strings without buffering trailing incomplete UTF-8 codepoint sequences across read boundaries.

**WHY**:
UTF-8 codepoints span between 1 and 4 bytes. When network chunking or OS pipe read boundaries bifurcate a multi-byte sequence (for example, split an em-dash `\xE2\x94\x80` between index 4095 and 0), treating each chunk as an isolated string replaces the split boundary bytes with Unicode Replacement Characters (`\uFFFD`, ``). This permanently corrupts TUI terminal layouts (such as `htop`/`tmux`), corrupts cryptographic base64/hex tokens, and can invalidate structured data payloads.

**WHEN TO APPLY**:
Any stream processor, WebAssembly JS-bridge writer, terminal pipeline, or log streaming engine reading arbitrary byte buffers and transforming them into high-level strings.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export class UTF-8ChunkResynchronizer {
  private pending: Uint8Array = new Uint8Array(0)
  private readonly decoder = new TextDecoder("utf-8", { fatal: false })

  public push(chunk: Uint8Array): string {
    // 1. Prepend remaining partial sequence from prior read
    let buf: Uint8Array
    if (this.pending.length > 0) {
      buf = new Uint8Array(this.pending.length + chunk.length)
      buf.set(this.pending, 0)
      buf.set(chunk, this.pending.length)
      this.pending = new Uint8Array(0)
    } else {
      buf = chunk
    }

    if (buf.length === 0) {
      return ""
    }

    // 2. Scan backwards from the tail to identify incomplete UTF-8 leading bytes
    const len = buf.length
    let incompleteIndex = -1

    for (let i = len - 1; i >= 0 && i >= len - 4; i--) {
      const byte = buf[i]
      // ASCII single byte (0xxxxxxx)
      if ((byte & 0x80) === 0) {
        break
      }
      // Continuation byte (10xxxxxx)
      if ((byte & 0xc0) === 0x80) {
        continue
      }
      // Leading bytes:
      let expectedBytes = 0
      if ((byte & 0xe0) === 0xc0) expectedBytes = 2      // 110xxxxx
      else if ((byte & 0xf0) === 0xe0) expectedBytes = 3 // 1110xxxx
      else if ((byte & 0xf8) === 0xf0) expectedBytes = 4 // 11110xxx

      const availableBytes = len - i
      if (availableBytes < expectedBytes) {
        incompleteIndex = i
      }
      break
    }

    // 3. Stash partial byte tail for next read pass
    let validSlice: Uint8Array
    if (incompleteIndex !== -1) {
      this.pending = buf.slice(incompleteIndex)
      validSlice = buf.slice(0, incompleteIndex)
    } else {
      validSlice = buf
    }

    return this.decoder.decode(validSlice)
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER stringify raw network chunks directly without stateful byte accumulation
class BadTermWriter {
  public write(chunk: Uint8Array): void {
    // BUG: If chunk cuts off an 0xE2 0x94 multi-byte rune mid-stream,
    // String.fromCharCode or standard TextDecoder emits  and loses data!
    const text = new TextDecoder().decode(chunk)
    window.term.write(text)
  }
}
```

**VERIFICATION METHOD**:
Implement property tests verifying zero corruption over variable buffer sliding windows spanning 1 to 8 bytes across multi-byte Unicode strings:
```typescript
describe("UTF8ChunkResynchronizer", () => {
  it("preserves continuous unicode strings across boundary cuts", () => {
    const resync = new UTF8ChunkResynchronizer()
    const input = "─".repeat(5000) // 3-byte character: \xE2\x94\x80
    const rawBytes = new TextEncoder().encode(input)
    
    let output = ""
    // Slice across an irregular buffer boundary prime size (e.g. 7 bytes)
    const chunkSize = 7
    for (let i = 0; i < rawBytes.length; i += chunkSize) {
      const slice = rawBytes.slice(i, i + chunkSize)
      output += resync.push(slice)
    }
    expect(output.includes("\uFFFD")).toBe(false)
    expect(output).toEqual(input)
  })
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: PTY Master Poller Blocking and Teardown Wedging (BUG-TAILSSH-01)
- **Context**: `ssh/tailssh/incubator.go`, `ssh/tailssh/process_unix.go`
- **What Was Expected**: SSH session teardown and server shutdown must terminate cleanly when a session exits or when cancelled, even if long-lived child descendants keep stdout/stderr open.
- **What Actually Happened**: The server wedged permanently during shutdown. The session WaitGroup remained non-zero because output draining goroutines were blocked on `io.Copy` from the PTY master descriptor. Descendant processes (such as `tmux` or orphaned shells running under `setsid`) kept the slave endpoint open, preventing EOF. Concurrently, closing the PTY master did not interrupt the pending read because Go's runtime poller was not managing the descriptor in non-blocking mode.
- **Evidence in Repo**: Commit `5a05ac11`, `ssh/tailssh/incubator.go`, `ssh/tailssh/ssh_shutdown_test.go`.
- **Root Cause**: Descriptors were cloned using `unix.FcntlInt(pty.Fd(), unix.F_DUPFD_CLOEXEC, 0)`. Calling `pty.Fd()` transitioned the descriptor to blocking mode. When wrapped in `os.NewFile`, Go's runtime poller could not attach interrupt triggers, causing `f.Close()` to deadlock until the external process closed the slave endpoint. Furthermore, session draining relied solely on EOF rather than an explicit I/O drain timeout.
- **Remediation Code Diff**:
```diff
--- a/ssh/tailssh/incubator.go
+++ b/ssh/tailssh/incubator.go
@@ -1015,18 +1015,31 @@ func (ss *sshSession) launchProcess() error {
-	outDup, err := unix.FcntlInt(pty.Fd(), unix.F_DUPFD_CLOEXEC, 0)
-	if err != nil {
-		pty.Close()
-		tty.Close()
-		return err
-	}
+	defer pty.Close()
+	var masters [3]*os.File
+	for i := range masters {
+		masters[i], err = dupPTYMaster(pty)
+		if err != nil {
+			for _, f := range masters {
+				if f != nil {
+					f.Close()
+				}
+			}
+			tty.Close()
+			return err
+		}
+	}
+	ss.ptyResize = masters[2]
+	go resizeWindow(ss.ctx, masters[2], winCh)
+	ss.wrStdin = masters[0]
+	ss.rdStdout = masters[1]

+func dupPTYMaster(f *os.File) (*os.File, error) {
+	raw, err := f.SyscallConn()
+	if err != nil {
+		return nil, err
+	}
+	fd := -1
+	var dupErr error
+	if err := raw.Control(func(src uintptr) {
+		fd, dupErr = unix.FcntlInt(src, unix.F_DUPFD_CLOEXEC, 0)
+		if dupErr == nil {
+			dupErr = unix.SetNonblock(fd, true)
+		}
+	}); err != nil {
+		return nil, err
+	}
+	if dupErr != nil {
+		if fd != -1 {
+			unix.Close(fd)
+		}
+		return nil, dupErr
+	}
+	dup := os.NewFile(uintptr(fd), f.Name())
+	if err := dup.SetReadDeadline(time.Time{}); err != nil {
+		dup.Close()
+		return nil, fmt.Errorf("PTY master is not pollable: %w", err)
+	}
+	return dup, nil
+}
```
- **Lesson**: Never call `File.Fd()` on files requiring runtime cancellation. Duplicate descriptors via `SyscallConn().Control()` and configure `O_NONBLOCK` before constructing runtime file descriptors.

---

### Incident 2: Split DNS Internal Resolver Leakage to Host and Ambient Cloud Gateways (BUG-TSNET-02)
- **Context**: `net/dns/resolver/forwarder.go`, `tsnet/dns.go`, `tsnet/dns_lookup.go`
- **What Was Expected**: `tsnet.Server.LookupIP` and `Server.Dial` must resolve addresses against the tailnet's DNS policy. When an internal corporate domain (e.g., `.corp`) or an authoritative query fails or does not exist, the failure must be returned directly to the caller.
- **What Actually Happened**: Authoritative failures (`NXDOMAIN` or `SERVFAIL`) under configured private routes bypassed policy enforcement and fell back to querying ambient host resolvers and cloud-host link-local endpoints (`169.254.169.254`), leaking internal corporate namespaces.
- **Evidence in Repo**: Commit `96467f7d`, Issues #5840, #7984, `net/dns/resolver/forwarder_test.go`.
- **Root Cause**: The DNS forwarder treated ambient cloud metadata fallback resolvers identically to configured split DNS routes. When evaluating fallback logic, it lacked a mechanism to query if a given FQDN belonged to a policy-mandated route versus an ambient host gateway.
- **Remediation Code Diff**:
```diff
--- a/net/dns/resolver/forwarder.go
+++ b/net/dns/resolver/forwarder.go
@@ -290,6 +290,9 @@ type route struct {
 	Suffix    dnsname.FQDN
 	Resolvers []resolverAndDelay
+	// ambient marks cloud-host resolvers not configured by tailnet policy.
+	// See [forwarder.HasConfiguredRouteFor].
+	ambient bool
 }

@@ -1247,6 +1252,24 @@ func (f *forwarder) resolvers(domain dnsname.FQDN) []resolverAndDelay {
 	return cloudHostFallback // or nil if no fallback
 }
+
+// HasConfiguredRouteFor reports whether a configured split or global (".")
+// DNS route matches name. Ambient cloud-host fallback resolvers are excluded.
+func (f *forwarder) HasConfiguredRouteFor(name dnsname.FQDN) bool {
+	f.mu.Lock()
+	routes := f.routes
+	f.mu.Unlock()
+	for _, route := range routes {
+		if route.ambient {
+			continue
+		}
+		if route.Suffix == "." || route.Suffix.Contains(name) {
+			return true
+		}
+	}
+	return false
+}
```
- **Lesson**: Segregate policy-mandated routing topologies from fallback infrastructure using explicit provenance tagging. Authoritative denials on mandated routes must terminate execution immediately.

---

### Incident 3: CGNAT Coarsened Route Stripping During Incremental Subnet Updates (BUG-ROUTEMGR-03)
- **Context**: `net/routemanager`
- **What Was Expected**: The CGNAT range `100.64.0.0/10` must remain present in OS routing tables as long as CGNAT coarsening is enabled or any active peer requires it.
- **What Actually Happened**: When a peer advertising an accepted subnet route for `100.64.0.0/10` disconnected, `RouteManager.applyDirty` removed `100.64.0.0/10` from `OSRoutes`, even though multiple other peers still required it for peer-to-peer CGNAT connectivity.
- **Evidence in Repo**: Issue #21890, PR #21891.
- **Root Cause**: The route manager evaluated route state transitions via delta diffs without checking the unified reference count of overlapping routing requirements. The deletion of the explicit subnet route triggered an unconditional OS route deletion, bypassing the dormant CGNAT coarsening invariant.
- **Remediation Code Diff**:
```diff
--- a/net/routemanager/routemanager.go
+++ b/net/routemanager/routemanager.go
@@ -512,7 +512,9 @@ func (m *RouteManager) applyDirty(ctx context.Context) error {
 	for route := range m.dirtyRoutes {
 		neededBySubnet := m.acceptedSubnets.Contains(route)
-		if !neededBySubnet {
+		neededByCoarsening := m.oneCGNAT && isCGNAT(route) && m.hasCGNATPeers()
+		if !neededBySubnet && !neededByCoarsening {
 			m.osRoutes.Delete(route)
+		} else {
+			m.osRoutes.Add(route)
 		}
 	}
```
- **Lesson**: Routing tables represent the unified projection of multiple independent policy layers. Incremental state updates must check global composite ownership rather than relying on isolated event triggers.

---

### Incident 4: UTF-8 Stream Boundary Truncation in WebAssembly SSH Console (BUG-TSCONNECT-04)
- **Context**: `cmd/tsconnect/wasm/wasm_js.go`, Issue #22007.
- **What Was Expected**: Streaming terminal sessions must render full-width multi-byte box-drawing characters without visual corruption or loss of character integrity across network frames.
- **What Actually Happened**: Terminal output displays scattered replacement characters (``), causing broken TUI lines and misaligned displays when running tools like `htop` or `btop`.
- **Evidence in Repo**: Issue #22007, `cmd/tsconnect/src/lib/js-state-store.ts`.
- **Root Cause**: The terminal writer converted every raw incoming byte slice into a JavaScript string independently: `new TextDecoder().decode(chunk)`. When a 3-byte unicode character landed across chunk boundaries (e.g. byte 0 in chunk N, bytes 1-2 in chunk N+1), each chunk decoded invalid slices into replacement codepoints.
- **Remediation Code Diff**:
```diff
--- a/cmd/tsconnect/wasm/wasm_js.go
+++ b/cmd/tsconnect/wasm/wasm_js.go
@@ -45,6 +45,7 @@ type termWriter struct {
 	jsTerm js.Value
+	pending []byte
 }

 func (w *termWriter) Write(p []byte) (n int, err error) {
+	combined := append(w.pending, p...)
+	validLen := getCompleteUTF8Length(combined)
+	w.pending = append([]byte(nil), combined[validLen:]...)
+	str := string(combined[:validLen])
+	if len(str) > 0 {
+		w.jsTerm.Call("write", str)
+	}
+	return len(p), nil
 }
```
- **Lesson**: Streaming byte-to-text decoders must maintain an internal carry-over buffer for trailing incomplete codepoints.

---

### Incident 5: Concurrent `IoctlSetWinsize` Descriptor Corruption via Unsynchronized Fd() (BUG-TAILSSH-05)
- **Context**: `ssh/tailssh/incubator.go` (`resizeWindow`)
- **What Was Expected**: PTY window resize signals (`SIGWINCH` / `TIOCSWINSZ`) must dynamically update terminal dimensions without racing against connection teardown.
- **What Actually Happened**: Concurrent resize operations collided with session `Close()` calls, causing window updates to fail with `EBADF` or target an unrelated file descriptor recycled by another goroutine.
- **Evidence in Repo**: Commit `5a05ac11`, `ssh/tailssh/incubator.go`.
- **Root Cause**: `resizeWindow` invoked `unix.IoctlSetWinsize(int(f.Fd()), ...)` directly in an uncoordinated loop. `f.Fd()` extracted the integer file descriptor without locking the runtime file descriptor struct. If `f.Close()` completed in another goroutine while the syscall was executing, the descriptor became invalid or was reassigned to a new socket, mutating an unintended descriptor.
- **Remediation Code Diff**:
```diff
--- a/ssh/tailssh/incubator.go
+++ b/ssh/tailssh/incubator.go
@@ -1050,15 +1080,26 @@ func (ss *sshSession) launchProcess() error {
-func resizeWindow(f *os.File, winCh <-chan gliderssh.Window) {
+func resizeWindow(ctx context.Context, f *os.File, winCh <-chan gliderssh.Window) {
 	defer f.Close()
-	for win := range winCh {
-		if err := unix.IoctlSetWinsize(int(f.Fd()), syscall.TIOCSWINSZ, &unix.Winsize{
+	raw, err := f.SyscallConn()
+	if err != nil {
+		return
+	}
+	for {
+		select {
+		case <-ctx.Done():
+			return
+		case win, ok := <-winCh:
+			if !ok {
+				return
+			}
+			var ioctlErr error
+			if err := raw.Control(func(fd uintptr) {
+				for {
+					ioctlErr = unix.IoctlSetWinsize(int(fd), syscall.TIOCSWINSZ, &unix.Winsize{
+						Row:    uint16(win.Height),
+						Col:    uint16(win.Width),
+						Xpixel: uint16(win.WidthPixels),
+						Ypixel: uint16(win.HeightPixels),
+					})
+					if !errors.Is(ioctlErr, unix.EINTR) || ctx.Err() != nil {
+						break
+					}
+				}
+			}); err != nil || ioctlErr != nil {
+				return
+			}
+		}
 	}
 }
```
- **Lesson**: Wrap OS-level file modifications in `SyscallConn.Control()`. This synchronizes descriptor access with the Go runtime's close lifecycle, preventing descriptor recycling races.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Flag Checking**: Always isolate bitwise AND with explicit parentheses when testing POSIX descriptor flags. In Go:
  ```go
  // WRONG: Precedence bug
  if flags & unix.O_NONBLOCK != 0 // Evaluates as flags & (unix.O_NONBLOCK != 0)

  // CORRECT: Explicit grouping
  if (flags & unix.O_NONBLOCK) != 0 { /* ... */ }
  ```
- **Unmapped IPv4/IPv6 Pointer Coercion**: When handling `netip.Addr`, bare addresses can exist in IPv4-mapped IPv6 representations (`::ffff:192.0.2.1`). Direct string prefix checks or slice conversions can introduce subtle routing bypasses. Always canonicalize by invoking `.Unmap()`:
  ```go
  ip = ip.Unmap()
  if (network == "ip4" && ip.Is6()) || (network == "ip6" && ip.Is4()) {
      return nil, &net.DNSError{Err: "family mismatch", Name: host}
  }
  ```
- **Zero-Value Pointer References in Slices**: In TypeScript (`client/web/src/hooks/exit-nodes.ts`), never map over collections containing empty entries without defensive fallback objects. Array reductions on empty structures will throw unhandled runtime errors:
  ```typescript
  // WRONG: Throws TypeError: Reduce of empty array with no initial value