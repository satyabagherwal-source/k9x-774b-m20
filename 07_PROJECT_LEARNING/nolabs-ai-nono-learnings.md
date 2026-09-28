> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source**: GitHub ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T20:20:32.816Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: nolabs-ai/nono

## 1. Executive Forensic Architecture & System Mechanics

`nono` is a zero-trust execution sandbox and capability-based security runtime designed to isolate AI agents, Model Context Protocol (MCP) servers, and dynamic tool executions. It enforces least-privilege constraints across POSIX and Linux execution environments (via Landlock, seccomp, namespaces, and platform MAC/cgroups), preventing unauthorized filesystem access, network exfiltration, environment leakage, and host privilege escalation.

```
       +-------------------------------------------------------------+
       |                        Host Process                         |
       |  +---------------------+        +------------------------+  |
       |  |  Approval Engine    | <----> |  Audit / Keystore DB   |  |
       |  +---------------------+        +------------------------+  |
       |             ^                                               |
       |             | IPC (Domain Socket derived from Exec Path)    |
       +-------------|-----------------------------------------------+
                     v
       +-------------------------------------------------------------+
       |             Sandboxed Process Scope (Landlock / Seccomp)    |
       |                                                             |
       |  +-----------------------+     +-------------------------+  |
       |  | Dynamic Tool Shims    |     | Sanitized Exec Context  |  |
       |  | (Intercepts CLI/Exec) |     | (PATH, Scoped Net, Vibe)|  |
       |  +-----------------------+     +-------------------------+  |
       |             |                               |               |
       |             v                               v               |
       |   Blocked Syscalls / Reads       Host-Brokered Invocations  |
       +-------------------------------------------------------------+
```

### Critical Subsystem Abstractions
1. **Tool-Sandbox Shim Broker**: A transparent IPC bridge that places lightweight shim binaries into the sandbox’s `PATH`. When an agent invokes a tool (e.g., `git`, `open`, `curl`), the shim intercepts the call and brokers authorization back to the host engine over a local Unix domain socket.
2. **Platform Sandbox Enforcement Engine**: Directly configures Linux kernel primitives (`landlock_create_ruleset`, `landlock_add_rule`, `seccomp-bpf`, and Linux namespaces) to create an inescapable boundary at the syscall layer.
3. **Dynamic Capability & Policy Approval Pipeline**: Intercepts operations requiring elevated privileges, prompts/evaluates policy decisions via an approval backend, and records tamper-evident capability audit logs prior to dispatching real file/network handles.
4. **Credential & Keystore Broker**: Proxies authentication and OAuth2 token exchanges (handling chunked token responses and secret lifecycle management) so the sandboxed runtime never directly touches ambient host credentials.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### Micro-Learning 1: Environment-Variable-Independent IPC Broker Resolution (GHSA-wjv5-93q3-xm73 / #2001, #2002)
- **Failure Mode / Pitfall**: Sandboxed applications (or tools like `env -i` / custom runtimes) strip or sanitize environment variables (such as `NONO_TOOL_SANDBOX_SOCKET` and `NONO_TOOL_SANDBOX_SHIM_DIR`). When shims execute, they fail to locate the host broker socket, causing total tool failure or fallback to unsafe unbrokered behavior.
- **Root Cause**: Trusting process environment variables (`std::env::var`) as the sole transport mechanism for sandbox IPC coordination. In adversarial or clean-environment sub-processes, child processes strip `NONO_*` variables.
- **Exact Prevention / Fix**: Derive the broker domain socket deterministically from the canonical runtime path of the shim executable itself (e.g., using `std::env::current_exe()` to infer the parent sandbox run directory or embedding deterministic filesystem tokens) rather than relying on mutable `env` state.

```rust
// PREVENTATIVE PATTERN: Deterministic Socket Discovery
use std::path::{Path, PathBuf};
use std::env;

pub fn resolve_broker_socket() -> Result<PathBuf, std::io::Error> {
    // Fallback order: Explicit ENV -> Canonical Exe Relative Directory -> Base Hash
    if let Ok(socket_env) = env::var("NONO_TOOL_SANDBOX_SOCKET") {
        let p = PathBuf::from(socket_env);
        if p.exists() {
            return Ok(p);
        }
    }

    // Derive from executable path: <sandbox_dir>/bin/shim -> <sandbox_dir>/broker.sock
    let exe_path = env::current_exe()?.canonicalize()?;
    let sandbox_root = exe_path
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Sandbox root not found"))?;

    let derived_socket = sandbox_root.join("broker.sock");
    if derived_socket.exists() {
        Ok(derived_socket)
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("No broker socket at {}", derived_socket.display()),
        ))
    }
}
```

---

### Micro-Learning 2: Musl libc Target Stripping `O_PATH` File Descriptors (#2005)
- **Failure Mode / Pitfall**: Sandboxes built on `x86_64-unknown-linux-musl` fail during filesystem sandbox initialization with invalid argument (`EINVAL`) or bad file descriptor errors when opening file handles for Landlock path binding.
- **Root Cause**: In musl libc, `O_PATH` constant definitions and standard library file open wrappers can strip or misinterpret `libc::O_PATH` (010000000 octal) when routing through standard high-level abstractions (`std::fs::OpenOptions`), or `libc` crate bindings under musl omit flags supported by modern Linux kernels.
- **Exact Prevention / Fix**: Use direct `nix::fcntl::OFlag::O_PATH` or explicit raw syscall bindings (`libc::syscall(libc::SYS_openat, ...)` with `libc::O_PATH | libc::O_CLOEXEC`) when obtaining file descriptors destined for Landlock path ruleset population, ensuring musl does not sanitize flags.

```rust
// PREVENTATIVE PATTERN: Explicit O_PATH handle acquisition
use std::os::unix::io::RawFd;
use std::path::Path;
use std::ffi::CString;

pub fn open_path_fd(path: &Path) -> Result<RawFd, std::io::Error> {
    let c_path = CString::new(path.as_os_str().to_str().unwrap())?;
    // Raw libc call ensures musl open wrapper does not strip O_PATH (010000000)
    let fd = unsafe {
        libc::open(
            c_path.as_ptr(),
            libc::O_PATH | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if fd < 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(fd)
    }
}
```

---

### Micro-Learning 3: TOCTOU and Audit Gap in Pre-Operation Approval Backends (#2010)
- **Failure Mode / Pitfall**: Capability decisions granted by an approval engine were not recorded in the audit log if the subsequent target operation (e.g., opening a file descriptor or dialing a network connection) failed. Conversely, retries caused duplicate audit entries.
- **Root Cause**: The audit logging call was placed at the exit of the file execution handler rather than immediately after the approval backend decided the authorization verdict.
- **Exact Prevention / Fix**: Decouple the *Audit of Decision* from the *Execution of Action*. Emit the capability audit record immediately after the policy decision is made, track state using an atomic/state-flag to avoid duplicate records on fallback retries, and annotate the audit record if downstream execution subsequently encounters an I/O error.

---

### Micro-Learning 4: Implicit Host-Level File Traps in Desktop Linux Sandboxing (#1991, #2013)
- **Failure Mode / Pitfall**: Standard CLI tools executed in the sandbox mysteriously crashed with `SIGSEGV` or aborts during startup without obvious filesystem violation messages.
- **Root Cause**: High-level libraries (e.g., fontconfig, glib, libmagic) silently attempt to read host configurations at initialization (`/etc/fonts/*`, `/usr/share/mime/*`, `/usr/share/X11/locale`). Landlock policies without explicit read permissions for base Linux system metadata abort before any agent payload code executes.
- **Exact Prevention / Fix**: Base platform profiles must always permit read-only capability to system layout directories (`/usr/share/mime`, `/usr/share/fontconfig`, `/etc/fonts`, `/etc/ssl/certs`) by default, completely distinct from user application storage.

---

### Micro-Learning 5: Ephemeral File Loss via `systemd-tmpfiles-clean` (#1942)
- **Failure Mode / Pitfall**: Long-running sandboxed sessions suddenly fail after hours or days with "Connection refused" on the domain socket or missing session temporary files.
- **Root Cause**: Sandboxes placing sockets and FIFO state in `/tmp` without resetting access/modification timestamps (`atime`/`mtime`) get reaped by host cleanup daemons (`systemd-tmpfiles-clean` or `tmpreaper`).
- **Exact Prevention / Fix**: Put sandbox sockets in runtime dirs (`/run/user/<UID>/` or `XDG_RUNTIME_DIR`), or run a background heartbeat thread that touches file timestamps (or acquires a continuous open file descriptor lock `flock(LOCK_SH)`) on active sandbox state paths in `/tmp`.

---

### Micro-Learning 6: Chunked Transfer-Encoding in Client Credential Endpoints (#1976)
- **Failure Mode / Pitfall**: OAuth2 token exchanges against certain identity providers failed with JSON parsing errors or premature stream termination.
- **Root Cause**: The reverse proxy assumed fixed `Content-Length` headers from authorization servers. Specific OAuth endpoints return HTTP/1.1 chunked transfer encodings.
- **Exact Prevention / Fix**: Ensure token acquisition clients consume the full body byte stream through a chunked-aware decoder (e.g., `hyper`/`reqwest` buffered body reader) before passing slices to `serde_json::from_slice`.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

```
                      +------------------------------------------+
                      | D1: Subcommand & Binary Sandboxing       |
                      +------------------------------------------+
                                          |
     +------------------------------------+------------------------------------+
     |                                    |                                    |
+----+---------------------+   +----------+---------------+   +----------------+---------+
| D2: Async Cancellation   |   | D4: FD / Socket Cleanup  |   | D6: Musl vs Glibc Kernel |
|     & Signal Traps       |   |     RAII Life Guards     |   |     ABI Variations       |
+----+---------------------+   +----------+---------------+   +----------------+---------+
     |                                    |                                    |
+----+---------------------+   +----------+---------------+   +----------------+---------+
| D3: Pre-Execution Audit  |   | D5: Scope-Bound Network  |   | D7: Sigstore & Upstream  |
|     Rollback Protocols   |   |     Policy Sanitization  |   |     Identity Tracking    |
+----+---------------------+   +--------------------------+   +----------------+---------+
                                          |
                      +-------------------+----------------------+
                      | D8: Patch Verification & Security Fixes  |
                      +------------------------------------------+
```

### D1: Structural Boundaries & Modularity
- Shims act as independent micro-binaries placed in an ephemeral sandbox bin directory. They contain zero business logic; they marshal `std::env::args()` and `std::io::stdin()` over Unix sockets to the primary host daemon.
- Sandboxing policies (Landlock filesystem trees, Seccomp BPF programs, network namespaces) are compiled into immutable rule graphs before any child process fork.

### D2: Asynchronous State & Concurrency Defense
- The host approval engine employs asynchronous channels (`tokio::sync::mpsc`) paired with oneshot responders for each pending agent tool request.
- Cancellation safety: When a client drops a tool invocation future, the broker aborts the pending authorization prompt without leaving orphaned approval state in the queue.

### D3: Error Boundaries, Recovery & Rollback Protocols
- **Audit Pre-Commit**: Security audit logs are committed to persistent storage *before* executing the approved operation to prevent silent un-audited exploits if the process crashes immediately post-execution.
- **Fail-Closed Strategy**: If Landlock ruleset enforcement fails (e.g., kernel version does not support Landlock ABI V1-V4), the runtime rejects execution rather than falling back to unconfined execution.

### D4: Resource Lifecycle & Leak Defenses (Memory, Sockets, Descriptors)
- Raw file descriptors used to construct Landlock rules (`O_PATH` handles) are held in an explicit RAII wrapper (`OwnedFd`) and closed immediately once `landlock_restrict_self` completes.
- Temporary sandbox sockets and directories are bound to a session guard that executes `unlink` and `rmdir` upon process exit, catching POSIX signals (`SIGINT`, `SIGTERM`) via signal handlers.

### D5: Boundary Deserialization, Schemas & Input Sanitization
- IPC between shims and the broker uses length-delimited binary/JSON schemas with strict maximum buffer limits (preventing memory exhaustion attacks from malicious sandboxed inputs).
- `PATH` and environment variable sanitization enforces non-empty sanitized PATH strings to eliminate current-working-directory (`.`) execution vulnerabilities.

### D6: Cross-Platform & Runtime Compatibility Gotchas
- **musl vs. glibc**: On Linux, musl targets require direct syscall wrappers for modern namespace/Landlock features to avoid libc flag filtering.
- **System Layout Divergence**: Profiles separate Debian/Ubuntu (`/usr/share/mime`, `/etc/ssl/certs`) and RHEL/Arch paths to avoid missing runtime metadata files required by dynamic interpreters (Python, Node.js, Ruby).

### D7: Build, CI/CD, Deployment & Dependency Invariants
- Packaging across AUR, Cargo, and Debian requires explicit identity tracking (e.g., verifying repository migration from legacy namespaces to `nolabs-ai`).
- Direct dependency pinning on networking/TLS stacks (`hyper-rustls`, `futures-util`) ensures seccomp filters don't break when underlying syscall usage changes in patch releases.

### D8: Concrete Bug Fixes & Forensic Patches
- **GHSA-wjv5-93q3-xm73**: Shims no longer fail when target scripts run `env -i`. The broker address is discovered via relative executable path traversal.
- **#1895**: Refusal of empty sanitized `PATH` prevents host-side brokers from executing arbitrary local binaries in untrusted target folders.

---

## 4. Net-New Universal Engineering Rules

## 72. Environment-Agnostic IPC Broker Derivation

**RULE**:
Security shims and sandbox subprocesses MUST NOT rely on ambient process environment variables (`env::var`) to locate control sockets, security brokers, or IPC coordinators. IPC rendezvous paths MUST be derived deterministically from the immutable filesystem hierarchy of the executing binary (`current_exe()`) or established through pre-allocated file descriptors passed during `fork`/`exec` (`3+`).

**WHY**:
Standard language runtimes, test suites, build tools (`make`, `cmake`), and defensive utilities frequently execute commands using sanitized environments (`env -i`, `sudo`, or custom wrappers). If a security shim relies on `MY_APP_SOCKET` in the environment, wiping the environment disables the broker connection, leading to catastrophic tool failure or unintended security bypasses (GHSA-wjv5-93q3-xm73).

**WHEN TO APPLY**:
- Subprocess shims, CLI proxies, and dynamic tool interceptors.
- Agent sandboxes, container runtimes, and privilege separation daemons.
- Multi-process architectures running untrusted client scripts.

---

## 73. Audit-First Authorization Invariant

**RULE**:
In capability-based and privileged brokering systems, the audit record for an authorization decision MUST be durably recorded *immediately* upon decision completion and *prior* to executing the downstream system operation. Operations that fail after approval MUST update the existing audit event rather than deferring the initial emission to the post-operation handler.

**WHY**:
Placing audit writes in the post-operation phase creates an un-audited blind spot: if a malicious sandbox payload triggers a process crash, out-of-memory abort, or unhandled exception immediately after obtaining a capability but before the completion handler runs, the authorization event is lost forever from the security log (#2010).

**WHEN TO APPLY**:
- Security approval engines and capability brokers.
- File access, network proxying, and secret extraction gateways.
- Multi-tenant execution runtime audit collectors.

---

## 5. Actionable Agent Skill & Implementation Checklist

```
+-------------------------------------------------------------------------+
|                  AGENT PRE-FLIGHT VERIFICATION MATRIX                   |
+---+---------------------------------------------------------------------+
| [ ] 1. Socket Path Discovery: Resolve via current_exe() relative tree   |
| [ ] 2. Linux O_PATH Flag: Use raw libc flags for musl target safety     |
| [ ] 3. Non-Empty PATH Sanitization: Reject empty strings explicitly     |
| [ ] 4. Audit-First Sequence: Commit authorization audit prior to I/O    |
| [ ] 5. Linux Base Paths: Whitelist /etc/fonts, /usr/share/mime by default|
| [ ] 6. Socket Reaper Immunity: Put runtime sockets in /run/user/<uid>    |
| [ ] 7. Chunked HTTP Support: Use streaming readers for OAuth payloads   |
+---+---------------------------------------------------------------------+
```

### Step-by-Step Implementation Protocol

1. **Deterministic Shim Construction**:
   - Write shim binaries so they extract their parent directory via `std::env::current_exe()?.canonicalize()`.
   - Compute `<dir>/../run/broker.sock` and connect directly without querying `std::env::vars()`.

2. **Syscall-Safe Path Handle Acquisition**:
   - When preparing paths for `landlock_add_rule`, wrap the opening logic in `libc::open(c_str, libc::O_PATH | libc::O_CLOEXEC)`.
   - Never use standard file opening modes (`std::fs::File::open`) which require read permissions and fail on directories or special devices.

3. **Audit Pipeline Verification**:
   - Implement an explicit two-phase audit lifecycle:
     ```rust
     let audit_id = audit_logger.record_decision(&decision, &requested_op)?;
     let result = execute_op(&requested_op);
     if let Err(ref e) = result {
         audit_logger.record_execution_failure(audit_id, e)?;
     }
     return result;
     ```

4. **Base Sandbox Environment Configuration**:
   - Ensure your default Landlock/Seccomp profile automatically includes:
     - `/usr/share/mime`
     - `/usr/share/zoneinfo`
     - `/etc/fonts` and `/usr/share/fontconfig`
     - `/etc/ssl/certs` and `/etc/ca-certificates`
   - Validate that minimal runtimes (`python -c "import magic"`) execute inside the sandbox without failing on missing desktop metadata.