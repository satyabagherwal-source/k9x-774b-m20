# Agent Contract: Agent Contract: vercel-labs-agent-desktop-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "vercel-labs-agent-desktop-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T21:44:45.402Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vercel-labs-agent-desktop-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vercel-labs-agent-desktop-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T21:44:45.402Z`  
> **Learning ID**: `LEARN-EVO-vercel-labs-agent-desktop-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `vercel-labs-agent-desktop-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vercel-labs-agent-desktop-learnings.md`  
> **Source**: github ([https://github.com/vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop))  
> **Source Version**: `8ffecc1d`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-15T21:44:15.054Z  
> **Learning ID**: `learn-github-vercel-labs-agent-desktop`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): vercel-labs/agent-desktop

---

## 1. Executive Forensic Architecture & System Mechanics

`agent-desktop` solves cross-platform programmatic GUI automation for autonomous agents without multimodal computer-vision or screenshot-to-coordinate inference models. Rather than inspecting pixels via Vision-Language Models (VLMs) and guessing pixel coordinates, the engine communicates directly with OS-level Accessibility (a11y) frameworks across macOS (`ApplicationServices`/`HIServices`), Windows (`UIAutomationCore`), and Linux (`AT-SPI2`/`D-Bus`).

```
                    +------------------------------------+
                    |        Caller / AI Agent           |
                    | (Stdio JSON / MCP / C Foreign API) |
                    +-----------------+------------------+
                                      |
                                      v
                         +--------------------------+
                         | agent-desktop CLI Engine |
                         | (crates/core - Rust 2024)|
                         +------------+-------------+
                                      |
       +------------------------------+------------------------------+
       |                              |                              |
       v                              v                              v
+---------------+             +----------------+             +---------------+
| crates/macos  |             | crates/windows |             | crates/linux  |
| (AXUIElement) |             | (UIAutomation) |             | (AT-SPI2)     |
+-------+-------+             +-------+--------+             +-------+-------+
        |                             |                              |
        v                             v                              v
+---------------+             +----------------+             +---------------+
|   macOS App   |             |  Win32/UWP App |             |  GTK/Qt App   |
+---------------+             +----------------+             +---------------+
```

### Core Subsystems & Boundaries

1. **Deterministic Ref System (`@<snapshot_id>:<ref_id>`)**:
   Instead of exposing volatile native pointers or volatile dynamic handles across boundaries, the engine freezes the UI tree into a discrete snapshot id (e.g., `s8f3k2p9`). Nodes are assigned ephemeral alphanumeric ref identifiers (`@s8f3k2p9:e8`). Invocations referencing non-existent, cross-snapshot, or un-prefixed tokens (`@e8`) are rejected before touching native drivers. When UI changes invalidate geometry or hierarchy, queries surface strict `STALE_REF` errors rather than performing blind input.

2. **Live Arena Query Evaluator (`resolve_query`)**:
   Historically, UI queries required serializing the entire OS window tree into an in-memory DOM representation (`AccessibilityNode`) and walking it recursively. The modern architecture utilizes a live arena traversal pipeline (`LocatorResolveRequest`) that directly evaluates AST-based `LocatorQuery` expressions against live OS handles using short-circuit pruning, predicate memoization (`memo_cells`), and match-only ref materialization (`LocatorMaterialization::SelectedMatches`).

3. **Hypervisor & Guest Agent Boundary (`providers/macos`)**:
   To isolate untrusted actions on desktop environments, the system abstracts macOS sandboxing into local Virtualization Framework machines (`vmhost.swift`). The communication path rejects host-side disk mounts and SSH pipes in favor of a specialized host-to-guest UNIX domain socket multiplexer (`guestagent.swift`), communicating with an in-guest daemon launched strictly in the `Aqua` GUI session context under Launchd.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Inode/Device-Bound Symlink Traversal Verification (O_NOFOLLOW & Same-Device Pinning)

**RULE**:
When writing into untrusted or externally mounted filesystem trees, the caller **MUST NOT** use recursive path resolution or standard shell redirection (`>`). The process **MUST** open every path segment individually using `O_NOFOLLOW | O_NONBLOCK`, verify with `fstat(2)` that each segment resides on the exact target volume root device (`st_dev`), confirm directory types via `S_ISDIR`, and verify target file types via `S_ISREG` before performing zero-truncation or writing.

**WHY**:
An untrusted guest or unprivileged worker can create a symbolic link targeting arbitrary host files (e.g., `/etc/passwd`, `~/.ssh/authorized_keys`, or host kernel artifacts). Simple operations like `cat key > $mount/private/etc/ssh/ssh_host_ed25519_key` resolve the symlink on the host kernel, causing arbitrary host file overwrite (arbitrary file write / host compromise).

**WHEN TO APPLY**:
Any orchestration system, container agent, hypervisor host, or build tool that modifies guest disks, virtual machine volume mounts, or non-root user workspaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```perl
use strict;
use warnings;
use Fcntl qw(:mode O_WRONLY O_CREAT O_NOFOLLOW O_NONBLOCK);

sub secure_write_volume_file {
    my ($volume_root, $relative_dir_path, $file_name, $content) = @_;

    chdir $volume_root or die "Cannot chdir to target volume: $!";
    my @root_stat = stat "." or die "Cannot stat volume root: $!";
    my $volume_dev = $root_stat[0]; # st_dev

    my @segments = split m{/+}, $relative_dir_path;
    for my $segment (@segments) {
        next if $segment eq '' || $segment eq '.';
        die "Path traversal attempt detected" if $segment eq '..';

        my @lstat_info = lstat $segment or die "Failed lstat for $segment: $!";
        # Invariant 1: Must belong to identical device/volume
        $lstat_info[0] == $volume_dev or die "Symlink or bind mount crossed device boundary: $segment";
        # Invariant 2: Segment MUST be a directory, never a link
        S_ISDIR($lstat_info[2]) or die "$segment is not a directory";

        chdir $segment or die "Failed chdir into $segment: $!";
        my @entered = stat "." or die "Failed stat inside $segment: $!";
        ($entered[0] == $lstat_info[0] && $entered[1] == $lstat_info[1])
            or die "TOCTOU race detected while stepping into $segment";
    }

    # Open file strictly without following symlinks and non-blocking
    sysopen(my $out, $file_name, O_WRONLY | O_CREAT | O_NOFOLLOW | O_NONBLOCK, 0644)
        or die "Refusing to open file (possible symlink): $!";

    my @held = stat $out or die "stat failed on opened descriptor: $!";
    (S_ISREG($held[2]) && $held[0] == $volume_dev)
        or die "Opened file is not a regular file on the designated volume";

    truncate($out, 0) or die "Failed to truncate destination: $!";
    my $written = syswrite($out, $content);
    defined $written && $written == length($content)
        or die "Incomplete write to target: $!";
    close($out) or die "Failed to flush/close descriptor: $!";
}
```

**NEGATIVE CONSTRAINT**:
```bash
# FATAL ANTI-PATTERN: Blindly writing into an untrusted guest/container mount point
mount -o loop guest_disk.img /mnt/guest
# If guest ran: ln -s /Users/host_user/.ssh/authorized_keys /private/etc/ssh/ssh_host_ed25519_key
# The line below overwrites the host's credentials!
cat "$HOST_SSH_KEY" > /mnt/guest/private/etc/ssh/ssh_host_ed25519_key
```

**VERIFICATION METHOD**:
Set up an integration harness that creates malicious symbolic links at each path depth:
```bash
ln -s /etc/shadow $FAKE_VOLUME/private/etc/ssh/ssh_host_ed25519_key
# Run the key rotation routine. It MUST fail with exit code 1 or 2,
# verify that /etc/shadow is untouched, and confirm the guest disk is detached.
```

---

### 2. Dual-Channel Exit-Status and Pipe-Cap Buffering

**RULE**:
When capturing command execution output from potentially untrusted or unverified sub-shells/RPC bridges, the consumer **MUST NOT** buffer `stdout`/`stderr` unbounded into memory, and **MUST NOT** execute probe commands without hard consumption caps. Consumers **MUST** decouple the remote status code transmission from the remote data stream using a separate file descriptor pipe (e.g., `FD 3`), while truncating the data stream to an exact byte ceiling (`head -c 65536`) on a separate descriptor (e.g., `FD 4`).

**WHY**:
If a guest or probe command outputs an infinite loop of noise (e.g., `/dev/zero` or a run-away stack trace), capturing stdout directly via shell variable assignment (`output=$(cmd)`) exhausts host memory, triggering the OS OOM killer. Moreover, terminating stdout via `head -c` breaks traditional pipeline status capture (`$?` reflects `head`, losing the process crash code).

**WHEN TO APPLY**:
Subprocess runners, agent probing loops, container telemetry probes, and SSH/RPC host-guest agents.

**VERIFIED IMPLEMENTATION PATTERN**:
```bash
PROBE_REPLY_LIMIT=65536

# Captures status and bounded payload without host memory starvation
guest_probe() {
  {
    reply_status=$(
      {
        {
          probe_status=0
          guest_transport ssh "$@" 2>/dev/null 3>&- 4>&- || probe_status=$?
          printf '%s\n' "$probe_status" >&3
        } | head -c "$PROBE_REPLY_LIMIT" >&4
      } 3>&1
    )
  } 4>&1
  return "${reply_status:-255}"
}
```

**NEGATIVE CONSTRAINT**:
```bash
# FATAL ANTI-PATTERN: Captures unbounded output and loses exit status on truncation
result=$(guest_ssh "cat /var/log/unbounded.log") # Host OOMs if log is > 8GB!

# FLAWED TRUNCATION: Always returns 0 (head's exit status), masking remote failure
result=$(guest_ssh "failing_command" | head -c 65536)
if [ $? -ne 0 ]; then
  # This block is NEVER reached because head exits 0!
  handle_error
fi
```

**VERIFICATION METHOD**:
Test with an integration fake that spews 32MB of `/dev/zero` data while returning an explicit failure status code (e.g., `7`):
```bash
head -c 33554432 /dev/zero | tr '\0' 'x'
# Assert that memory consumption never exceeds 64KiB and probe returns exit status 7.
```

---

### 3. Dynamic TCC/Security Identity Attribution via Dynamic Symbol Loading

**RULE**:
When building command-line utilities that interface with OS-level privacy/entitlement subsystems (such as Apple's TCC: Transparency, Consent, and Control), diagnostic and guidance tools **MUST NOT** assume the immediate process parent (`getppid()`) is the principal security debtor. The system **MUST** resolve the actual responsible process via dynamic library linkage (`dlsym(libc::RTLD_DEFAULT, "responsibility_get_pid_responsible_for_pid")`), falling back to an ancestor tree walk only if dynamic loading returns `NULL`.

**WHY**:
Terminal multiplexers (such as `tmux` or `screen`) detach their servers and become reparented to system init (`launchd` or `systemd`, PID 1). Walking parent PIDs returns PID 1 or an orphaned shell, causing permission diagnostics to report the wrong executable bundle or prompt the user to authorize binary paths that the kernel does not honor.

**WHEN TO APPLY**:
Security permission verifiers, CLI accessibility assistants, and GUI session hooks on macOS 10.14+.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};

pub fn resolve_responsible_app() -> Option<PathBuf> {
    let current_pid = i32::try_from(std::process::id()).ok()?;
    host_app_of(current_pid, responsible_pid)
}

fn host_app_of(pid: i32, responsible_lookup: impl Fn(i32) -> Option<i32>) -> Option<PathBuf> {
    responsible_lookup(pid)
        .and_then(app_of)
        .or_else(|| ancestor_app(pid))
}

fn app_of(pid: i32) -> Option<PathBuf> {
    executable_path(pid)
        .as_deref()
        .and_then(outermost_app)
}

fn responsible_pid(pid: i32) -> Option<i32> {
    // Dynamically resolve private libSystem symbol to avoid static linkage failures on older OS versions
    let symbol = unsafe {
        libc::dlsym(
            libc::RTLD_DEFAULT,
            c"responsibility_get_pid_responsible_for_pid".as_ptr(),
        )
    };
    if symbol.is_null() {
        return None;
    }
    let responsible_fn: unsafe extern "C" fn(libc::pid_t) -> libc::pid_t =
        unsafe { std::mem::transmute(symbol) };
    let resp = unsafe { responsible_fn(pid) };
    (resp > 0).then_some(resp)
}

fn ancestor_app(mut pid: i32) -> Option<PathBuf> {
    const MAX_ANCESTORS: usize = 32;
    for _ in 0..MAX_ANCESTORS {
        if pid <= 1 {
            return None;
        }
        if let Some(app) = app_of(pid) {
            return Some(app);
        }
        pid = parent_pid(pid)?;
    }
    None
}
```

**NEGATIVE CONSTRAINT**:
```rust
// FATAL ANTI-PATTERN: Relying strictly on getppid()
fn get_security_debtor_bad() -> PathBuf {
    let ppid = unsafe { libc::getppid() };
    // If running under tmux, ppid is 1 (launchd), returning None or /sbin/launchd!
    executable_path(ppid).unwrap()
}
```

**VERIFICATION METHOD**:
Spawn a detached shell child in a unit test:
```rust
let orphan = Command::new("/bin/sh")
    .args(["-c", "/bin/sleep 30 >/dev/null 2>&1 & echo $!"])
    .output().unwrap();
// Wait until parent_pid(orphan) == Some(1)
// Verify responsible_pid(orphan) returns the parent test binary, NOT 1.
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Host Compromise via Symlink Traversal on Guest Disk Mount (BUG-SANDBOX-01)
- **Context**: `providers/macos/provider.sh` - `rotate_host_key` function.
- **What Was Expected**: The host VM provider mounts the guest disk image locally to write fresh SSH host keys (`ssh_host_ed25519_key`) into `/private/etc/ssh` without executing untrusted guest binaries.
- **What Actually Happened**: The script wrote keys using direct redirection: `cat "$tmp/key" > "$dir/private/etc/ssh/ssh_host_ed25519_key"`. A malicious guest operating system could replace `/private/etc/ssh/ssh_host_ed25519_key` with a symbolic link pointing to a file on the host machine. When the host ran `rotate_host_key`, it followed the link and overwrote arbitrary files on the host filesystem.
- **Evidence in Repo**: Commit `2a63c28b`, PR `#673`.
- **Root Cause**: Failure to enforce device boundary and non-dereference checks (`O_NOFOLLOW`) when writing into a directory structure controlled by an untrusted partition.
- **Remediation Code Diff**:
```diff
-  if ! cat "$tmp/key" > "$dir/private/etc/ssh/ssh_host_ed25519_key" || \
-    ! cat "$tmp/key.pub" > "$dir/private/etc/ssh/ssh_host_ed25519_key.pub"; then
-    detach_guest_disk "$disk"
-    rm -rf "$tmp"
-    return 1
-  fi
+  write_guest_host_key() {
+    perl -e '
+      use Fcntl qw(:mode O_WRONLY O_CREAT O_NOFOLLOW O_NONBLOCK);
+      # Traverse private -> etc -> ssh confirming each is S_ISDIR and stat[0] == volume
+      # sysopen with O_NOFOLLOW | O_NONBLOCK and verify S_ISREG
+      sysopen(my $out, $name, O_WRONLY | O_NOFOLLOW | O_NONBLOCK | $create, 0644) or exit(2);
+    ' "$1" "$2" "$3"
+  }
```
- **Lesson**: Never perform unchecked filesystem writes across boundary layers (host-to-guest). Enforce `lstat` path walk validation and `O_NOFOLLOW`.

---

### Incident 2: Host Memory Exhaustion (OOM) via Unbounded Guest Probe Streams (BUG-SANDBOX-02)
- **Context**: `providers/macos/provider.sh` - `check_guest_setup` and `do_exec`.
- **What Was Expected**: Probing the guest for setup verification (such as permissions checks and binary SHA hashes) would quickly read string values via SSH.
- **What Actually Happened**: `permissions=$(guest_transport ssh "$target" '...' 2>/dev/null)` captured standard output into a bash variable. A compromised or buggy guest emitting continuous stdout filled host RAM until memory was exhausted.
- **Evidence in Repo**: Commit `2a63c28b`, PR `#673`.
- **Root Cause**: Missing upper-bound windowing on input streams from unauthenticated or semi-trusted remote execution endpoints.
- **Remediation Code Diff**:
```diff
-  permissions=$(guest_transport ssh "$target" 'if [ ! -x ~/.local/bin/agent-desktop ]; then exit 3; fi; ~/.local/bin/agent-desktop permissions' 2>/dev/null) || probe_status=$?
+  PROBE_REPLY_LIMIT=65536
+  guest_probe() {
+    {
+      reply_status=$(
+        {
+          {
+            probe_ssh_status=0
+            guest_transport ssh "$@" 2>/dev/null 3>&- 4>&- || probe_ssh_status=$?
+            printf '%s\n' "$probe_ssh_status" >&3
+          } | head -c "$PROBE_REPLY_LIMIT" >&4
+        } 3>&1
+      )
+    } 4>&1
+    return "${reply_status:-255}"
+  }
+  permissions=$(guest_probe "$target" 'if [ ! -x ~/.local/bin/agent-desktop ]; then exit 3; fi; ~/.local/bin/agent-desktop permissions') || probe_status=$?
```
- **Lesson**: All external stream ingestions must have strict byte caps enforced at the kernel pipe level, while preserving out-of-band error return channels.

---

### Incident 3: TCC Responsibility Attribution Failure in Multiplexed Sessions (BUG-PERM-01)
- **Context**: `crates/macos/src/system/permissions/permission_guide.rs`.
- **What Was Expected**: `agent-desktop permissions --guide` identifies the user's terminal application (e.g., `Ghostty.app`, `iTerm2.app`) so the user can grant Accessibility permissions.
- **What Actually Happened**: Under `tmux`, the tmux server process daemonizes, severing its parent relationship to the terminal and reparenting to `launchd` (PID 1). The ancestor walk returned no app bundle, causing the CLI to display the raw CLI binary `agent-desktop`, which does not receive TCC GUI prompts.
- **Evidence in Repo**: Commit `8ffecc1d`, PR `#681`.
- **Root Cause**: Conflating process parentage (`PPID`) with kernel-level task responsibility attribution (`responsibility_get_pid_responsible_for_pid`).
- **Remediation Code Diff**:
```diff
-fn host_app() -> Option<PathBuf> {
-    let mut pid = i32::try_from(std::process::id()).ok()?;
-    for _ in 0..MAX_ANCESTORS {
-        if pid <= 1 { return None; }
-        let app = crate::system::renderer_kind::executable_path(pid)
-            .as_deref().and_then(outermost_app);
-        if app.is_some() { return app; }
-        pid = parent_pid(pid)?;
-    }
-    None
-}
+fn host_app() -> Option<PathBuf> {
+    host_app_of(i32::try_from(std::process::id()).ok()?, responsible_pid)
+}
+fn host_app_of(pid: i32, responsible: impl Fn(i32) -> Option<i32>) -> Option<PathBuf> {
+    responsible(pid).and_then(app_of).or_else(|| ancestor_app(pid))
+}
```
- **Lesson**: Operating system security sub-frameworks assign credentials through internal attribution trees, not POSIX ancestor graphs. Use platform-specific responsibility APIs when resolving security identities.

---

### Incident 4: Elimination of Attack Surface by Replacing SSH with Native Socket Device (BUG-SANDBOX-03)
- **Context**: Architecture of macOS VM isolation in `crates/core` and `providers/macos`.
- **What Was Expected**: Provide a zero-configuration, secure channel between host CLI and isolated macOS sandbox.
- **What Actually Happened**: Using SSH required manually enabling "Remote Login" in System Settings, assigning per-sandbox DHCP IP leases, managing `known_hosts` key pinning, and granting Accessibility to `sshd-keygen-wrapper`—a shared daemon that granted any incoming SSH session arbitrary desktop control.
- **Evidence in Repo**: Commit `46d2adf8`, PR `#675`.
- **Root Cause**: Over-reliance on general-purpose network protocols (SSH) for point-to-point hypervisor IPC.
- **Remediation Code Diff**:
```diff
-  # Host mounted guest disk, manipulated authorized_keys, ran commands via SSH
-  guest_transport ssh "$user@$ip" "$@"
+  # Host talks directly to the hypervisor socket device (virtio-console / vsock equivalent)
+  # Inside the guest, agent-desktop-guest.app runs as a Launchd Aqua GUI agent
+  # sandbox exec communicates via direct Unix socket in sandbox directory
```
- **Lesson**: Point-to-point virtual machine execution should use hypervisor socket devices (`vsock`/virtio-serial) rather than network protocols with shared daemons and dynamic routing layers.

---

### Incident 5: Subcommand Rejection of Stdio Protocol Flag (BUG-CLI-01)
- **Context**: Subcommand parsing and documentation in `crates/core` (Issue #554).
- **What Was Expected**: Agent tooling documentation advised users to configure MCP client files (`mcp.json`) pointing to `agent-desktop mcp`.
- **What Actually Happened**: The binary CLI driver parser threw `INVALID_ARGS: unrecognized subcommand 'mcp'`, causing agents like Claude Desktop to fail on startup.
- **Evidence in Repo**: Issue #554, closed post-mortem.
- **Root Cause**: Lack of an explicit alias or dedicated subcommand in `clap` derivation when launching the MCP stdio JSON-RPC transport loop.
- **Remediation Code Diff**:
```diff
+// Ensure clap definition supports alias and subcommand for MCP stdio server
+#[derive(Subcommand)]
+enum Commands {
+    #[command(alias = "stdio")]
+    Mcp(McpArgs),
+    Snapshot(SnapshotArgs),
+    Click(ClickArgs),
+}
```
- **Lesson**: Integration surfaces exposed to automated third-party LLM orchestrators must feature strict contract regression testing on CLI entrypoint arguments.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Sub-Pixel Float-to-Integer Hash Drift
In windowing environments, floating-point coordinates from accessibility APIs can jitter on high-DPI displays:

```rust
// WRONG: Direct floating point comparison or naive f64 hashing
if node.bounds.x == target.x && node.bounds.y == target.y { /* ... */ }

// RIGHT: Fixed-precision integer quantization before comparison
fn rect_key(bounds: Rect) -> (i64, i64, i64, i64) {
    (
        (bounds.x * 100.0) as i64,
        (bounds.y * 100.0) as i64,
        (bounds.width * 100.0) as i64,
        (bounds.height * 100.0) as i64,
    )
}
```

#### Whitespace Collapsing and Normalization
Text matching against OS accessibility strings must normalize internal spaces and linebreaks:

```rust
// WRONG: Simple trimming preserves internal carriage returns and variable tabs
if actual.trim().to_lowercase() == expected.to_lowercase() { /* ... */ }

// RIGHT: Token-level whitespace collapsing
fn normalized(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
```

---

### 2. Infinite Loop & Recursion Guards

#### Cyclic Accessibility Trees
Electron and complex Win32 hierarchies can feature cyclical parenting links (e.g., combo-boxes, virtual scroll lists):

```rust
// WRONG: Unbounded recursion leading to stack overflow
fn walk_tree(node: &AccessibilityNode) {
    for child in &node.children {
        walk_tree(child);
    }
}

// RIGHT: Enforced max depth cap and cycle-breaking
pub fn walk_tree_bounded(
    node: &AccessibilityNode,
    current_depth: usize,
    max_depth: usize,
    visited: &mut HashSet<u64>
) -> Result<(), Error> {
    if current_depth > max_depth {
        return Err(Error::MaxDepthExceeded);
    }
    if !visited.insert(node.unique_id) {
        return Ok(()); // Cycle detected and pruned
    }
    for child in &node.children {
        walk_tree_bounded(child, current_depth + 1, max_depth, visited)?;
    }
    Ok(())
}
```

---

### 3. UI & UX Micro-Mechanics

#### Actionability Occlusion Validation
Clicking a ref that is visually covered by another element (modal sheet, notification banner) causes ghost clicks:

```rust
// Occlusion check invariant:
pub(super) fn occluded(
    role: Option<String>,
    name: Option<String>,
    bounds: Option<Rect>,
) -> ActionabilityCheck {
    let reason = role.as_deref().map_or_else(
        || "occluded by another element".to_string(),
        |role| format!("occluded by {role}"),
    );
    ActionabilityCheck {
        check: "receives_events",
        status: ActionabilityStatus::Fail,
        reason: Some(reason),
        occluder: Some(Occluder { role, name, bounds }),
        terminal_code: None,
        hit_test: None,
        stability: None,
    }
}
```

---

### 4. Backend Concurrency & Memory Safety

#### IPC Deadlock Elimination via Deadlines
All synchronous calls across OS accessibility IPC barriers must pass an explicit monotonic deadline:

```rust
pub struct Deadline {
    instant: Instant,
}

impl Deadline {
    pub fn after(millis: u64) -> Result<Self, AppError> {
        Ok(Self { instant: Instant::now() + Duration::from_millis(millis) })
    }

    #[inline]
    pub fn is_expired(&self) -> bool {
        Instant::now() >= self.instant
    }
}
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### Stale Ref Invalidation Invariant
Before executing an action against a cached ref, verify both identity and geometry:

```rust
if node.role != entry.identity.role {
    return Err(AdapterError::new(ErrorCode::StaleRef, "Role changed"));
}
let identity_matches = entry.identity.native_id.as_ref()
    .is_some_and(|identifier| identifier_matches(node, identifier));
let bounds_match = entry.geometry.bounds_hash.is_some()
    && entry.geometry.bounds_hash == node.bounds.bounds_hash();

if !identity_matches && !bounds_match {
    return Err(AdapterError::new(ErrorCode::StaleRef, "Target identity and bounds changed"));
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Layout**: Strict isolation between `crates/core` (pure platform-agnostic business logic, queries, and refs) and platform crates (`crates/macos`, `crates/windows`, `crates/linux`).
- **State Ownership**: Snapshots own the temporary ref maps. Once a new snapshot is generated, older ref tokens expire automatically, avoiding persistent pointer leaks.

### 2. Core Abstractions
- `RefEntry`: Contains element role, identity, geometry hash, process ID, and window ID.
- `ObservationOps`: Trait abstracting tree retrieval across platforms (`observe_tree`, `list_windows`, `resolve_locator_anchor`).
- `ActionOps`: Platform-agnostic click, type, keypress, and scroll dispatchers.

### 3. Error Handling
- **Envelope Protocol**: Every CLI execution returns a typed JSON payload with `ok: true/false`, a machine-readable `error.code`, and recovery instructions in `error.disposition.retry`.
- **Fault Tolerance**: Dynamic symbol resolution (`dlsym`) ensures that missing OS symbols gracefully degrade without binary dynamic link crashes.

### 4. Testing
- **Synthetic Electron Benchmarks**: Benchmarks run multi-frame tests with moving bounding boxes and deep trees without spawning actual Electron processes (`locator_benchmark.rs`).
- **Native Mocks**: `ScriptedAdapter` and bash test harnesses (`test-provider.sh`) intercept and mock low-level system binaries (`hdiutil`, `ssh`, `launchctl`).

### 5. Security
- **Untrusted Guest Defense**: Host-to-guest file writes must strictly check directory inodes via `O_NOFOLLOW | O_NONBLOCK` and verify device ID consistency (`st_dev`).
- **Attribution Accuracy**: macOS TCC permission checks resolve the responsible process PID to prevent privilege confusion under terminal multiplexers.

### 6. Performance
- **Live Arena Traversal**: Replaces whole-tree JSON/DOM serialization with an in-place AST evaluation pipeline that resolves queries in microseconds (`live_direct_path`).
- **Binary Footprint**: Production builds use `opt-level = "z"`, `lto = true`, and `codegen-units = 1` with stripped symbols to minimize binary sizes.

### 7. Deployment
- **Entitlements**: The macOS VM host binary compiles and signs with `com.apple.security.virtualization` entitlements via `codesign`.
- **Packaging**: Ships via npm wrappers with platform-specific native binaries alongside Homebrew distribution manifests.

### 8. Agent Patterns
- **Vision-Free Automation**: Agents observe hierarchical tree structures (`role`, `name`, `available_actions`) instead of raw pixel grids.
- **Loop Guards**: CLI outputs include deterministic `disposition` metadata (`not_delivered`, `retry: safe`), allowing calling agents to distinguish transient system latency from unrecoverable permission errors.

### 9. Data Flow
- **Data Lifecycle**: CLI invocation $\to$ Window enumeration $\to$ Live accessibility query evaluation $\to$ Ref allocation $\to$ Action dispatch $\to$ Monotonic post-action wait $\to$ JSON envelope emission to stdout.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern
Live Arena AST Evaluation Pattern: Resolve queries against native tree nodes via short-circuit predicates without allocating intermediate wrapper nodes for non-matching elements.

### 2. Rule
All multi-hop path writing across hypervisor or container boundaries MUST verify `st_dev` uniformity and deny symlink navigation using `O_NOFOLLOW`.

### 3. Architecture Principle
Decouple target element identity from ephemeral spatial coordinates by combining accessibility identifiers, roles, and quantized geometric hash proofs.

### 4. Failure Mode
Unbounded string capture from child process pipes can lead to host-level OOM crashes during diagnostic checks.

### 5. Reusable Skill
Resolving security debtee process trees on macOS via `responsibility_get_pid_responsible_for_pid` dynamic lookup.

### 6. Decision
Abandoning SSH transport in macOS sandboxes in favor of a specialized guest agent running inside an `Aqua` GUI launchd domain.

### 7. Anti-pattern
Performing shell pipe assignments `VAR=$(command)` on processes whose output volume cannot be guaranteed.

### 8. Verification Method
Synthetic accessibility tree fuzzing using parameterized depth, shifting coordinates, and duplicate role/name trees to guarantee query resolution stability.

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### Pre-Flight Checklist for OS-Level Automation Daemons

- [ ] 1. Enforce monotonic deadlines on all platform API calls to prevent UI hangs.
- [ ] 2. Bound child process output ingestion pipes to 64 KiB maximum buffer limits.
- [ ] 3. Traverse paths using `O_NOFOLLOW | O_NONBLOCK` when interacting with guest/container mounts.
- [ ] 4. Quantize floating-point screen coordinates before computing hash digests.
- [ ] 5. Resolve responsible application PIDs when querying platform security grants (TCC).
- [ ] 6. Expire element refs when the target process, window, or geometry changes.
- [ ] 7. Isolate guest agents inside native GUI session domains (`Aqua`) rather than headless daemons.
- [ ] 8. Emit standard machine-readable JSON envelopes with retry disposition metadata.
```

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
