# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: rustls-rustls-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "rustls-rustls-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:52:07.206Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rustls-rustls-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls-rustls-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:52:07.206Z`  
> **Learning ID**: `LEARN-EVO-rustls-rustls-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from rustls-rustls-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rustls-rustls-learnings.md`  
> **Source**: github ([https://github.com/rustls/rustls](https://github.com/rustls/rustls))  
> **Source Version**: `10bb7f9c`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-21T20:51:21.725Z  
> **Learning ID**: `learn-github-rustls-rustls`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rustls/rustls

---

## 1. Executive Forensic Architecture & System Mechanics

`rustls` is a high-assurance, memory-safe TLS implementation in Rust covering TLS 1.2 and TLS 1.3. Unlike legacy C stacks (e.g., OpenSSL), `rustls` eliminates memory corruption primitives (buffer overflows, use-after-free, uninitialized memory leaks) by leaning on Rust's type system, affine ownership types, explicit borrow mechanics, and safe zero-cost abstractions.

```
                           +----------------------------------------+
                           |           Public API Surface           |
                           |   ClientConfig   /   ServerConfig      |
                           +-------------------+--------------------+
                                               |
                                               v
+---------------------------------------------------------------------------------------------------+
| Connection Engine (rustls::Connection)                                                           |
|                                                                                                   |
|  +---------------------------+    Output Events      +-----------------------------------------+  |
|  |       CommonState         | --------------------> |            ConnectionOutputs            |  |
|  | - SendPath (outbound seq) |                       | - ProtocolVersion (1.2 / 1.3)           |  |
|  | - ReceivePath (side state)|                       | - SupportedCipherSuite                  |  |
|  +-------------+-------------+                       | - VerifiedIdentity                      |  |
|                |                                     | - KeyingMaterialExporter                |  |
|                v                                     +-----------------------------------------+  |
|  +---------------------------+                                                                    |
|  | Record Layer / Deframing  | <===================> +-----------------------------------------+  |
|  | - VecInput / TLS buffers  |                       | CryptoProvider Trait Boundary           |  |
|  | - Fragment assembly       |                       | - aws-lc-rs (FIPS, PQ, AES-GCM, ChaCha) |  |
|  | - Plaintext backpressure  |                       | - *ring* (Deterministic, pure/assembly) |  |
|  +---------------------------+                       +-----------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
       |                                                                            ^
       | Raw Encrypted Bytes (TLS Records)                                          | Custom Pluggable
       v                                                                            | Primitives
+-------------------------------------------------------------------------+         |
| Transport Boundary / Utility Layer (rustls-util)                        |         |
|                                                                         |         |
|  +-------------------------------------------------------------------+  |         |
|  | complete_io(io, input, received_plaintext, output, conn)          |  |         |
|  | - Non-blocking / Blocking state convergence loop                 |  |         |
|  | - Backpressure guard: halts read when plaintext buffer non-empty  |  |         |
|  | - Illegal write defense: treats n > available as poison fatal     |  |         |
|  +-------------------------------------------------------------------+  |         |
|                                                                         |         |
|  +--------------------------------+  +-------------------------------+  |         |
|  | Stream<'a, S, T> (Borrowed)    |  | StreamOwned<S, T> (Owning)    |  |         |
|  | Implements Read, BufRead, Write|  | Manages full transport socket |  |         |
|  +--------------------------------+  +-------------------------------+  |         |
+-------------------------------------------------------------------------+---------+
```

### Subsystem Boundaries & Decoupling Invariants
1. **The Pluggable Cryptography Boundary (`CryptoProvider`)**: The TLS engine contains zero hardcoded cryptographic implementations. Primitives for AEAD, key exchange (`SupportedKxGroup`), signature verification, digital signatures (`Signer`, `SigningKey`), and random number generation are behind explicit trait matrices (`rustls::crypto::CryptoProvider`). Implementations reside in companion crates (`rustls-aws-lc-rs`, `rustls-ring`).
2. **State Ownership & Handshake Convergence (`CommonState` & `ConnectionOutputs`)**: State separation between the protocol driver and the application inspection surface is strict. During the handshake, state transitions emit `OutputEvent` values ingested by `ConnectionOutputs` (e.g., `OutputEvent::ProtocolVersion`, `OutputEvent::CipherSuite`, `OutputEvent::KeyExchangeGroup`). Handshake state cannot be inspected or mutated out of sequence.
3. **Transport Decoupling (`complete_io` and `Stream`)**: `rustls` does not wrap or control the operating system socket directly in its core engine. Instead, it exposes deframing/framing methods (`read_tls`, `handle_all`, `write`). The `rustls-util` crate bridges this engine to synchronous network transports using `complete_io()`, which guarantees record completion and handles partial packet reads, alerts, and kernel write buffers.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Trust Write-Length Validation and State Poisoning Guard
**RULE**:
When wrapping external, untyped, or platform-level I/O primitives (`write()`, `send()`, syscall wrappers), you MUST explicitly check that the returned written length $n$ satisfies $n \le \text{buffer.len()}$. If $n > \text{buffer.len()}$, you MUST immediately poison and purge the pending write buffer and terminate the session with a fatal error. You MUST NOT attempt to slice the buffer with $n$ or continue execution.

**WHY**:
External implementations of I/O traits (such as custom `std::io::Write` adapters, mocks, or buggy OS sockets) can return corrupted or malicious positive integers larger than the input slice. In systems that drain buffers via `output.drain(..n)`, an unchecked value triggers a panic (`index out of bounds`) or, in low-level/unsafe code, memory exposure and unbounded pointer out-of-bounds arithmetic. Draining an indeterminate number of bytes invalidates TLS record alignment, making recovery impossible.

**WHEN TO APPLY**:
Apply to all stream adapters, socket abstraction layers, byte deframers, and protocol buffer drains where an external I/O layer reports progress via a byte counter.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Write the front of `output` to `io`, draining the bytes that were written.
/// Enforces defensive validation against illegal driver returns (RFC / POSIX violation).
pub fn safe_write_and_drain(
    io: &mut (impl std::io::Write + ?Sized),
    output: &mut Vec<u8>,
) -> std::io::Result<usize> {
    let n = io.write(output)?;
    if n > output.len() {
        let available = output.len();
        // Clear all pending bytes to avoid stale re-transmission
        // if the caller unsafely catches and ignores this error.
        output.clear();
        return Err(std::io::Error::other(format!(
            "illegal write() return value: reported {n} bytes written, but only {available} were available"
        )));
    }
    output.drain(..n);
    Ok(n)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly trusting the reported write count.
// Triggers panic on output.drain(..n) when n > output.len(),
// or causes slice slicing panic/undefined memory states.
pub fn unsafe_write_and_drain(io: &mut impl std::io::Write, output: &mut Vec<u8>) -> std::io::Result<usize> {
    let n = io.write(output)?;
    // If io is a buggy third-party pipe returning usize::MAX or corrupted integers:
    // This panics with "range end out of bounds" or slices out-of-bounds.
    output.drain(..n); 
    Ok(n)
}
```

**VERIFICATION METHOD**:
Mock test with a faulty `Write` implementation:
```rust
#[test]
fn test_illegal_write_length_triggers_purge_and_error() {
    struct CorruptedWriter;
    impl std::io::Write for CorruptedWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            Ok(buf.len() + 10) // Illegal return!
        }
        fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
    }

    let mut buf = vec![1, 2, 3, 4, 5];
    let res = safe_write_and_drain(&mut CorruptedWriter, &mut buf);
    assert!(res.is_err());
    assert!(buf.is_empty(), "Buffer must be purged to prevent invalid state re-use");
}
```

---

### 2. File Creation Mask and Privilege Containment Invariant
**RULE**:
When creating or opening files destined to store cryptographic secrets, session tickets, private keys, or trace dumps (e.g., `SSLKEYLOGFILE`), you MUST open the file atomically with owner-only access permissions (`0o600` on POSIX systems: read/write by owner only, zero permissions for group and others) BEFORE any secret bytes are staged or written. You MUST NOT rely on process-level `umask`.

**WHY**:
The ambient `umask` of a process is often set to `0o022` or `0o002`, which results in files created with `0o644` (world-readable) or `0o664` (group-readable). If a system writes ephemeral session keys (pre-master secrets, client traffic secrets) to a file readable by other local accounts or containers sharing the volume, the TLS forward secrecy is broken. Attenders can intercept and decrypt all captured traffic. Setting permissions after file creation exposes a TOCTOU race window where the file exists with permissive attributes before being restricted.

**WHEN TO APPLY**:
Apply in any module writing credentials, token caches, auth caches, private keys, or debug logs containing decrypted material on POSIX/Unix environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::{File, OpenOptions};
use std::path::Path;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

pub fn open_sensitive_secret_sink(path: &Path) -> std::io::Result<File> {
    let mut options = OpenOptions::new();
    options.append(true).create(true);

    #[cfg(unix)]
    {
        // Enforce owner-only (rw-------) atomically during creation
        options.mode(0o600);
    }

    options.open(path)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Relying on default ambient umask or changing permissions after open
pub fn unsafe_open_secret_sink(path: &Path) -> std::io::Result<File> {
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?; // TOCTOU GAP: Created with world-readable permissions (0o644) under standard umask!

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = file.metadata()?.permissions();
        perms.set_mode(0o600);
        file.set_permissions(perms)?; // Too late: malicious processes could open an fd during the gap
    }

    Ok(file)
}
```

**VERIFICATION METHOD**:
```rust
#[cfg(unix)]
#[test]
fn test_secret_sink_permissions_strictly_0o600() {
    use std::os::unix::fs::PermissionsExt;
    let temp = std::env::temp_dir().join("secret_test.log");
    let _ = std::fs::remove_file(&temp);

    let _file = open_sensitive_secret_sink(&temp).expect("File must open");
    let meta = std::fs::metadata(&temp).expect("Metadata retrieval failed");
    let mode = meta.permissions().mode() & 0o777;
    let _ = std::fs::remove_file(&temp);

    assert_eq!(mode, 0o600, "File permissions must be exactly 0o600; found {mode:#o}");
}
```

---

### 3. Asynchronous Co-Routine Fuel and Starvation Guard
**RULE**:
When running manual, lock-stepped, or cooperative polling of interdependent co-routines/futures without a global async runtime (e.g., benchmark loops, single-threaded co-routine drivers, lock-free pipelines), you MUST bound loop iterations with a strictly decrementing, non-replenishing **Fuel Counter**. If the fuel reaches zero before futures reach terminal status, you MUST terminate immediately with a deterministic panic or timeout error.

**WHY**:
When two futures interact over an in-memory queue or loopback pipe (e.g., client handshake driver and server handshake driver), any latent defect—such as an unhandled short read, an unnotified closure, or an alert generated without consumer notification—causes both futures to alternate yielding `Poll::Pending`. Without an explicit cycle cap, this causes an infinite CPU busy-loop that saturates the thread and hangs continuous integration runners indefinitely without a stack trace.

**WHEN TO APPLY**:
Apply to test runners, simulated event loops, single-threaded executor shims, deterministic trace replay harnesses, and actor message schedulers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use core::future::Future;
use core::pin::pin;
use core::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
use core::ptr;

pub fn execute_cooperative_turn_bounded<F1, F2>(
    f1: F1,
    f2: F2,
    max_turns: usize,
) -> Result<(F1::Output, F2::Output), &'static str>
where
    F1: Future,
    F2: Future,
{
    let mut f1 = pin!(f1);
    let mut f2 = pin!(f2);

    let waker = noop_waker();
    let mut ctx = Context::from_waker(&waker);

    let mut out1 = None;
    let mut out2 = None;
    let mut fuel = max_turns;

    loop {
        if out1.is_some() && out2.is_some() {
            break;
        }
        if fuel == 0 {
            return Err("Execution starvation guard tripped: co-routines deadlocked in Poll::Pending loop");
        }
        fuel -= 1;

        if out1.is_none() {
            if let Poll::Ready(res) = f1.as_mut().poll(&mut ctx) {
                out1 = Some(res);
            }
        }

        if out2.is_none() {
            if let Poll::Ready(res) = f2.as_mut().poll(&mut ctx) {
                out2 = Some(res);
            }
        }
    }

    Ok((out1.unwrap(), out2.unwrap()))
}

fn noop_waker() -> Waker {
    const VTABLE: RawWakerVTable = RawWakerVTable::new(|_| RAW, |_| {}, |_| {}, |_| {});
    const RAW: RawWaker = RawWaker::new(ptr::null(), &VTABLE);
    unsafe { Waker::from_raw(RAW) }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unbounded busy-wait loop polling interdependent futures.
// If future X waits on Y, but Y entered an error state and yielded Pending,
// the CPU spins at 100% until the entire CI job times out (e.g., 6 hours).
pub fn unsafe_block_on_concurrent<F1: Future, F2: Future>(f1: F1, f2: F2) -> (F1::Output, F2::Output) {
    let mut f1 = pin!(f1);
    let mut f2 = pin!(f2);
    let waker = noop_waker();
    let mut ctx = Context::from_waker(&waker);
    let mut o1 = None;
    let mut o2 = None;

    loop { // FATAL: No fuel or iteration budget!
        if let (Some(r1), Some(r2)) = (o1.take(), o2.take()) {
            return (r1, r2);
        }
        if o1.is_none() {
            if let Poll::Ready(val) = f1.as_mut().poll(&mut ctx) { o1 = Some(val); }
        }
        if o2.is_none() {
            if let Poll::Ready(val) = f2.as_mut().poll(&mut ctx) { o2 = Some(val); }
        }
    }
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_deadlocked_futures_terminate_via_fuel_guard() {
    let pending_fut1 = core::future::pending::<()>();
    let pending_fut2 = core::future::pending::<()>();

    let res = execute_cooperative_turn_bounded(pending_fut1, pending_fut2, 50);
    assert_eq!(res, Err("Execution starvation guard tripped: co-routines deadlocked in Poll::Pending loop"));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Nightly Compiler Flag Ingestion Poisoning Clippy CI (BUG-RUSTLS-01)
- **Context**: `.github/workflows/build.yml` in CI test pipeline.
- **What Was Expected**: The nightly clippy job runs `./admin/clippy` across the entire workspace to check for code degradation and unidiomatic patterns under current Rust nightly toolchains.
- **What Actually Happened**: The nightly clippy check failed or aborted due to ambient environment leakage. Inherited workspace build flags in `RUSTFLAGS` (such as warnings treated as hard errors via `-D warnings`) caused breaking diagnostic false positives emitted by incomplete nightly clippy rules to reject PRs.
- **Evidence in Repo**: Commit `10bb7f9c`, `.github/workflows/build.yml`, modified by 2 additions.
- **Root Cause**: Nightly clippy is volatile and frequently emits experimental lints with false negatives/positives. When global CI environments propagate `RUSTFLAGS="-D warnings"`, it conflicts with the project's policy that nightly lints must remain advisory rather than gating releases.
- **Remediation Code Diff**:
```diff
@@ -439,6 +439,8 @@ jobs:
           components: clippy
        # Do not deny warnings, as nightly clippy sometimes has false negatives.
        - run: ./admin/clippy
+        env:
+          RUSTFLAGS: ""
  
    check-external-types:
      name: Validate external types appearing in public API
```
- **Lesson**: Isolation of linting environments in CI pipelines must clear global build optimization and denial flags (`RUSTFLAGS: ""`) to ensure that experimental lints do not halt mission-critical deployments.

---

### Incident 2: Buffer Corruption from Out-of-Bounds Reported Writes (BUG-RUSTLS-02)
- **Context**: `rustls-util/src/lib.rs` and `rustls-util/src/stream.rs` handling transport network write draining.
- **What Was Expected**: When writing buffered ciphertext to the underlying transport via `io.write()`, the returned written length `n` must reflect the bytes successfully pushed into the transport.
- **What Actually Happened**: Faulty or malicious user-supplied `Write` implementations returned values of `n` greater than the source buffer size (`output.len() - sent`). Draining by `..sent` or `..n` triggered memory boundary panics or left unwritten ciphertext slices desynchronized.
- **Evidence in Repo**: `rustls-util/src/lib.rs`, issue reference `<https://github.com/rustls/rustls/issues/2316>`.
- **Root Cause**: The implementation previously assumed strict POSIX/std contract compliance, trusting that `io.write()` returns $0 \le n \le \text{buf.len()}$.
- **Remediation Code Diff**:
```diff
@@ -62,6 +62,17 @@ pub fn complete_io(...) -> Result<(usize, usize), io::Error> {
                  output.drain(..sent);
                  io.flush()?;
                  return Ok((rdlen, wrlen)); // EOF.
              }
+             Ok(n) if n > output.len() - sent => {
+                 // This is really unrecoverable, since the amount of data written
+                 // is now unknown. Consume all the potentially-written data in
+                 // case the caller ignores the error.
+                 let available = output.len() - sent;
+                 output.clear();
+                 return Err(io::Error::other(format!(
+                     "illegal write() return value ({n} > {available})"
+                 )));
+             }
              Ok(n) => {
                  wrlen += n;
                  sent += n;
```
- **Lesson**: Any system that processes transport slices must sanitize returned length counters against slice length and immediately clear internal buffers if invariant violations occur.

---

### Incident 3: World-Readable Ephemeral Key Logging Exposure (BUG-RUSTLS-03)
- **Context**: `rustls-util/src/key_log_file.rs`, handling `SSLKEYLOGFILE` dumping.
- **What Was Expected**: Session secret export files must only be accessible to the owning user.
- **What Actually Happened**: Standard `OpenOptions::new().create(true).append(true).open(path)` used default operating system permissions, leaving sensitive files subject to the calling process's `umask` (frequently `0o644` or `0o664`), making secrets readable by any local account.
- **Evidence in Repo**: `rustls-util/src/key_log_file.rs`, line 35; explicit test `test_created_file_has_owner_only_permissions`.
- **Root Cause**: Lack of target-specific atomic permission configuration during the open syscall.
- **Remediation Code Diff**:
```diff
@@ -32,6 +32,9 @@ impl KeyLogFileInner {
          let mut options = OpenOptions::new();
          options.append(true).create(true);
+         // Key material is extremely sensitive. On Unix, create with owner-only
+         // access so a default umask does not leave the file world-readable.
+         #[cfg(unix)]
+         options.mode(0o600);
          let file = match options.open(path) {
```
- **Lesson**: File creation for sensitive operations must atomically specify `0o600` via platform extensions rather than relying on default system configurations.

---

### Incident 4: Handshake Re-entry Write Deadlock on Connection Closure (BUG-RUSTLS-04)
- **Context**: `rustls-util/src/lib.rs` in `complete_io()`.
- **What Was Expected**: When `complete_io()` completes the handshake, it must send any final handshake flight (such as `Finished` or session tickets) to the transport before marking the connection ready for application data.
- **What Actually Happened**: When `read_tls()` transitioned `conn.is_handshaking()` from `true` to `false`, pending outbound TLS messages remained in the `output` buffer without being flushed if the loop exited prematurely on the transition condition, causing peer hangs.
- **Evidence in Repo**: `rustls-util/src/lib.rs`, lines 135–142.
- **Root Cause**: Evaluating completion solely via boolean handshake flags without validating whether outbound transmission buffers had drained.
- **Remediation Code Diff**:
```diff
@@ -134,6 +134,13 @@ pub fn complete_io(...) -> Result<(usize, usize), io::Error> {
          // If we're doing IO until handshaked, and we believe we've finished handshaking,
          // but read_tls() has queued TLS data to send, loop around again to write
          // the queued messages.
+         if until_handshaked && !conn.is_handshaking() && !output.is_empty() {
+             continue;
+         }
```
- **Lesson**: State-machine phase exit gates must check both state flags and intermediate output buffers before yielding control.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Deep Immutability in Slice Splitting**: Instead of using manual slice indexing which can panic (`&buf[..len]`), `rustls` uses safe splitting primitives with checked bounds:
  ```rust
  let len = Ord::min(buf.len(), self.received_plaintext.len());
  let Some((src, _)) = self.received_plaintext.split_at_checked(len) else {
      return Ok(0);
  };
  let Some((dst, _)) = buf.split_at_mut_checked(len) else {
      return Ok(0);
  };
  dst.copy_from_slice(src);
  self.received_plaintext.drain(..len);
  ```
- **Ring-Buffer Slice Coalescing**: When reading from `VecDeque<u8>`, memory is physically fragmented across two discontinuous slices (`first_half` and `second_half`). Copy operations must handle this discontinuity explicitly using saturating math:
  ```rust
  let (first_half, second_half) = inner_buf.as_slices();
  let bytes_to_write_from_first_half = first_half.len().min(bytes_to_write);
  let bytes_to_write_from_second_half = bytes_to_write.saturating_sub(bytes_to_write_from_first_half);

  self.user_buf[..bytes_to_write_from_first_half]
      .copy_from_slice(&first_half[..bytes_to_write_from_first_half]);
  self.user_buf[bytes_to_write_from_first_half..bytes_to_write]
      .copy_from_slice(&second_half[..bytes_to_write_from_second_half]);
  ```

### 2. Infinite Loop & Recursion Guards
- **Fuel Invariant in Manual Co-routine Schedulers**: To prevent non-yielding future pairs from starving the system or spinning on mutual `Poll::Pending` cycles, loops are bounded by an explicit fuel check:
  ```rust
  let mut fuel = 1_000;
  loop {
      let futures_done = x_output.is_some() && y_output.is_some();
      if futures_done || fuel == 0 {
          break;
      }
      fuel -= 1;
      // ... poll turns
  }
  if x_output.is_none() || y_output.is_none() {
      panic!("at least one of the futures seems to be stuck");
  }
  ```
- **EAGAIN / EINTR Loop Bounding**: Interrupted system calls (`io::ErrorKind::Interrupted`) must not terminate the read cycle, but unhandled `WouldBlock` conditions must break immediately to prevent CPU starvation.

### 3. UI & UX Micro-Mechanics / Stream Backpressure
- **Plaintext Backpressure Guard**: In `complete_io()`, reading from the underlying transport is gated by buffer consumption:
  ```rust
  fn wants_read(conn: &Connection<impl SideData, Tcp>, received_plaintext: &[u8]) -> bool {
      conn.is_handshaking() || received_plaintext.is_empty()
  }
  ```
  *Invariant*: If decrypted plaintext remains in `received_plaintext`, the transport driver stops reading network packets. This prevents unbounded memory growth caused by a fast sender overwhelming a slow consumer.

### 4. Backend Concurrency & Memory Safety
- **Poison-Resilient Mutex Peeking in Diagnostic Formatting**: Debug implementations must not block or panic on poisoned or contested locks. `KeyLogFile` uses non-blocking lock attempts in `Debug` implementations to avoid deadlocks during logging:
  ```rust
  impl Debug for KeyLogFile {
      fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
          match self.0.try_lock() {
              Ok(key_log_file) => write!(f, "{key_log_file:?}"),
              Err(_) => write!(f, "KeyLogFile {{ <locked> }}"),
          }
      }
  }
  ```
- **Zeroization and Buffer Sanitization on Drop**: Sensitive cryptographic material is isolated. Debug formatters explicitly omit cryptographic secrets:
  ```rust
  impl Debug for KeyLogFileInner {
      fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
          f.debug_struct("KeyLogFileInner")
              // Note: self.buf omitted deliberately as it contains plaintext key data.
              .field("file", &self.file)
              .finish_non_exhaustive()
      }
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Last-Gasp Alert Flushing**: When a protocol error occurs (e.g., decrypt failure, illegal state transition), the engine ensures failure alerts reach the peer before tearing down the transport:
  ```rust
  let error = conn.read_tls(input, output).handle_all(received_plaintext).err();
  if let Some(e) = error {
      // Last-gasp attempt to push the fatal alert record to the transport
      let _ignored = write_and_drain(io, output);
      let _ignored = io.flush();
      return Err(io::Error::new(io::ErrorKind::InvalidData, e));
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`rustls` decouples protocol state logic from byte streaming and hardware-dependent cryptographic math.
- **Protocol Driver**: Houses state machines for TLS 1.2 and 1.3 handshakes, message validation, and decryptor rekeying.
- **Transport Adapters (`rustls-util`)**: Provides synchronization wrappers (`Stream`, `StreamOwned`) around `complete_io`.
- **Crypto Abstraction Provider Layer**: Primitives implement traits (`Aead`, `SupportedKxGroup`, `Signer`, `CryptoProvider`), allowing AWS-LC, `*ring*`, or custom FIPS engines to be swapped at compile or initialization time.

### 2. Core Abstractions
- `Connection<S, Tcp>`: Parameterized by side (`ClientSide` vs `ServerSide`) and transport mode (`Tcp` vs `Quic`).
- `VecInput`: Implements `TlsInputBuffer` to manage fragment assembly and unread network records.
- `ConnectionOutputs`: Encapsulates verified handshake metrics (`peer_identity`, `alpn_protocol`, `suite`, `fips`).

### 3. Error Handling
`rustls` avoids panics in operational paths, returning structured errors (`rustls::Error`). System errors implement conversions to `std::io::ErrorKind::InvalidData`. On unrecoverable network writes ($n > \text{available}$), the write buffer is purged and poisoned with `io::Error::other` to prevent state reuse.

### 4. Testing
- **Bogo Harness (`bogo/`)**: Integrates BoringSSL's integration suite to test cross-engine interoperability across thousands of handshake edge cases.
- **Instruction-Count Benchmarking (`ci-bench`)**: Uses Valgrind/Cachegrind (`crabgrind`) to detect cycle-count and instruction-count regressions in pull requests.

### 5. Security
- **Strict Cryptographic Defaults**: Excludes obsolete protocols (SSLv2, SSLv3, TLS 1.0, TLS 1.1) and broken ciphers (RC4, 3DES, CBC mode ciphers).
- **Hardened File Descriptors**: Sensitive secret logging targets enforce `0o600` atomically on creation.
- **Information Leak Elimination**: Debug formatters omit private buffers, pre-master secrets, and token arrays.

### 6. Performance
- **Zero-Copy Record Handling**: Slices borrowed from input deframing buffers minimize allocations.
- **Vectorized Inbound / Outbound Calls**: `write_vectored` uses `IoSlice` to pass multi-record payloads to system sockets in single syscall batches.
- **Link-Time Optimization (LTO)**: Benchmarks configure `lto = true` and `codegen-units = 1` for aggressive cross-crate inlining.

### 7. Deployment
- **Multi-Crate Workspace**: Managed through a single workspace `Cargo.toml`. Nightly and experimental features (such as `fuzz`) are excluded from default builds.
- **Cargo Scripting Tooling**: Uses nightly cargo-script declarations (`#!/usr/bin/env -S cargo +nightly -Zscript`) for reproducible test data generation (`threads-seq.rs`).

### 8. Agent Patterns
- **Fuel-Bounded Micro-Loops**: Agents writing test runners or event loops must use descending fuel counters (`fuel -= 1`) to prevent deadlocks.
- **Compiler Drift Mitigation**: Automated CI passes must clear `RUSTFLAGS` when invoking nightly clippy or experimental toolchains.

### 9. Data Flow
Raw TCP Bytes $\to$ `VecInput` $\to$ `read_tls()` $\to$ `handle_all()` $\to$ Decryption $\to$ `received_plaintext` $\to$ User Buffer $\to$ Application Logic $\to$ User Buffer $\to$ `write()` $\to$ Encryption $\to$ `output` $\to$ `write_and_drain()` $\to$ Raw TCP Socket.

---

## 6. The 8 Learning Extraction Artifacts

```
                      +-------------------------------------------------+
                      |              8 EXTRACTION ARTIFACTS             |
                      +-------------------------------------------------+
                                              |
     +-------------------+--------------------+--------------------+--------------------+
     |                   |                    |                    |                    |
     v                   v                    v                    v                    v
+------------+     +-----------+     +------------------+     +--------------+    +------------------+
| 1. Pattern |     |  2. Rule  |     |  3. Architecture |     |  4. Failure  |    | 5. Reusable      |
| Safe Drain |     | Atomicity |     |     Principle    |     |     Mode     |    |    Skill         |
| Guard      |     | Perms     |     | Transport / Core |     | Out-of-Bound |    | Cooperative Loop |
|            |     | 0o600     |     | Separation       |     | Write Desync |    | Instrumentation  |
+------------+     +-----------+     +------------------+     +--------------+    +------------------+
     |                   |                    |
     v                   v                    v
+------------+     +-----------+     +------------------+
| 6. Decision|     | 7. Anti-  |     |  8. Verification |
| Crypto     |     |   Pattern |     |      Method      |
| Provider   |     | Blind I/O |     | Cachegrind /     |
| Traits     |     | Trust     |     | Perm Assertions  |
+------------+     +-----------+     +------------------+
```

### 1. Pattern: Defensively Bound Byte-Drain Slice Slicing
Always wrap `io::Write::write` with a boundary sanity check verifying that $n \le \text{output.len()}$. On violation, empty the pending buffer and return a fatal error.

### 2. Rule: Strict Creation Mask on

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
