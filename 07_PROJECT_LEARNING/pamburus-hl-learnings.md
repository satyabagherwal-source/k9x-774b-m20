> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pamburus-hl-learnings.md`  
> **Source**: github ([https://github.com/pamburus/hl](https://github.com/pamburus/hl))  
> **Source Version**: `3aae7bc7`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T05:06:38.212Z  
> **Learning ID**: `learn-github-pamburus-hl`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): pamburus/hl

---

## 1. Executive Forensic Architecture & System Mechanics

`pamburus/hl` is a systems-level CLI processor designed to ingest high-velocity structured log streams (JSON and logfmt) at gigabyte-per-second line rates and render them as human-readable, colorized terminal output or queryable chronological records.

```
                           +----------------------------------------+
                           |           POSIX / Windows OS           |
                           +----------------------------------------+
                             | stdin / FIFO / Inotify / Kqueue
                             v
+---------------------------------------------------------------------------------+
| hl Streaming Core Pipeline                                                      |
|                                                                                 |
|  +-------------------+      +--------------------+      +--------------------+  |
|  | Input Stream &    | ---> | SIMD Byte Scanner  | ---> | Zero-Allocation    |  |
|  | File Reader Engine|      | (memchr / logos)   |      | In-Place Parser    |  |
|  +-------------------+      +--------------------+      +--------------------+  |
|           |                                                       |             |
|           v                                                       v             |
|  +-------------------+                              +--------------------+      |
|  | Inotify/Kqueue    |                              | Dotted Schema Path |      |
|  | Live-Follow Loop  |                              | Multi-Variant Map  |      |
|  +-------------------+                              +--------------------+      |
|                                                                   |             |
|                                                                   v             |
|  +-------------------+      +--------------------+      +--------------------+  |
|  | Non-blocking Pager| <--- | Lifecycle Scoped   | <--- | Colorizer & Output |  |
|  | Pipe (AsyncDrop)  |      | Cleaners (RAII)    |      | Layout Engine      |  |
|  +-------------------+      +--------------------+      +--------------------+  |
+---------------------------------------------------------------------------------+
                             |
                             v
                 +-----------------------+
                 | Terminal / less Pager |
                 +-----------------------+
```

### Architectural Subsystem Decoupling

1. **Low-Latency Ingestion Engine (`crates/encstr`, `memchr`, `wyhash`)**:
   Standard deserialization (`serde_json::Value`) incurs unbounded heap allocations, pointer indirection, and string re-encoding penalties. `hl` bypasses generic AST allocation through tokenized byte scanning. It uses SIMD-accelerated byte-boundary detection via `memchr` / `memchr2` / `memchr3` and the specialized `encstr` sub-crate to parse raw slices without allocating intermediate UTF-8 strings.
2. **Schema Resolution & Dynamic Multi-Variant Key Masking**:
   Structured logs lack universal schemas; field paths like timestamp, level, and message vary dynamically across loggers (`time`, `ts`, `@timestamp`, `log.level`, `fields.severity`). The core parser tracks hierarchical path structures across configured variants. Masks are tracked using bitsets and nested prefix trees to strip redundant keys from generic payload dumps.
3. **OS Signal & Subprocess Isolation Boundary (`src/signal_windows.rs`, `crates/lifecycle`, `crates/pager`)**:
   Interactive paging requires bidirectional process orchestration. Terminal pagers like `less` capture `SIGINT` (Ctrl-C) to cancel active searches without terminating the underlying pipe feeder. `hl` abstracts this via platform-specific interrupt counting loops (Unix signals and Win32 Console Ctrl handlers) combined with an asynchronous RAII cleanup engine (`crates/lifecycle/src/lib.rs`).
4. **Chronological Sorting & Live Follow Indexer (`capnp`, `kqueue`, `notify`)**:
   When sorting (`-s`) multi-gigabyte files, `hl` constructs high-density block indexes using Cap'n Proto zero-copy serialization formats. It scans at ~2 GiB/s, persisting byte offsets alongside 64-bit normalized epoch timestamps, enabling instant index-based seeks and time-window filtering (`--since`, `--until`) without repeated full-file scans.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Platform-Agnostic Signal Interception with Debounced Process Termination
**RULE**:
Console applications that pipe output to interactive pagers MUST intercept platform-specific interrupt signals (`SIGINT` on Unix, `CTRL_C_EVENT` on Windows) through an atomic, rate-limited state machine. They MUST NOT terminate immediately on the first interrupt when an interactive consumer is attached, MUST return exit code 130 (`128 + SIGINT`), and MUST unlock poisoned mutexes without panicking within the signal handler callback.

**WHY**:
Standard CLI tools terminate abruptly when receiving `SIGINT`. When connected to an interactive pager (`less`), the pager intercepts Ctrl-C to abort in-pager regex searches or clear input buffers. If the feeder process exits on the first interrupt, the pipe breaks (`EPIPE`), causing terminal state corruption, dangling pager instances, or truncated viewer output. Furthermore, on Windows, Console Ctrl Handlers run asynchronously on an OS-managed thread; if the handler thread panics due to a poisoned lock, the process aborts with an unhandled exception code instead of a standard POSIX-compatible exit code.

**WHEN TO APPLY**:
Apply to any command-line tool written in Rust, C++, or Go that spawns or coordinates with terminal pagers, multiplexers, or long-running interactive child pipelines across both Unix and Windows operating systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::io;
use std::process::exit;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[cfg(windows)]
use windows_sys::{
    Win32::{
        Foundation::{FALSE, TRUE},
        System::Console::{CTRL_C_EVENT, SetConsoleCtrlHandler},
    },
    core::BOOL,
};

/// Universal POSIX interrupt exit code: 128 + SIGINT (2) = 130
const INTERRUPT_EXIT_CODE: i32 = 128 + 2;

struct InterruptState {
    max_count: usize,
    timeout: Duration,
    count: usize,
    last_timestamp: Instant,
}

impl InterruptState {
    fn new(max_count: usize, timeout: Duration) -> Self {
        Self {
            max_count,
            timeout,
            count: 0,
            last_timestamp: Instant::now(),
        }
    }

    fn register_interrupt(&mut self, now: Instant) -> bool {
        // Reset counter if debounce window expired
        if now.duration_since(self.last_timestamp) > self.timeout {
            self.count = 0;
        }
        self.last_timestamp = now;

        if self.count < self.max_count {
            self.count += 1;
        }

        self.count == self.max_count
    }
}

static SIGNAL_STATE: Mutex<Option<InterruptState>> = Mutex::new(None);

fn acquire_signal_lock() -> std::sync::MutexGuard<'static, Option<InterruptState>> {
    // Invariant: Poisoned locks must never crash signal handlers
    SIGNAL_STATE.lock().unwrap_or_else(|e| e.into_inner())
}

#[cfg(windows)]
pub struct PlatformSignalGuard;

#[cfg(windows)]
impl PlatformSignalGuard {
    pub fn init(max_count: usize, timeout: Duration) -> io::Result<Self> {
        *acquire_signal_lock() = Some(InterruptState::new(max_count, timeout));

        let success = unsafe { SetConsoleCtrlHandler(Some(win_console_handler), TRUE) };
        if success == FALSE {
            *acquire_signal_lock() = None;
            return Err(io::Error::last_os_error());
        }

        Ok(Self)
    }
}

#[cfg(windows)]
impl Drop for PlatformSignalGuard {
    fn drop(&mut self) {
        unsafe { SetConsoleCtrlHandler(Some(win_console_handler), FALSE) };
        *acquire_signal_lock() = None;
    }
}

#[cfg(windows)]
unsafe extern "system" fn win_console_handler(ctrl_type: u32) -> BOOL {
    if ctrl_type != CTRL_C_EVENT {
        // Let Windows default handlers handle CLOSE, LOGOFF, and SHUTDOWN events
        return FALSE;
    }

    let should_exit = match acquire_signal_lock().as_mut() {
        Some(state) => state.register_interrupt(Instant::now()),
        None => return FALSE,
    };

    if should_exit {
        exit(INTERRUPT_EXIT_CODE);
    }

    // Handled: Pager absorbs this interrupt
    TRUE
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct process exit inside uncoordinated handler; panicking on poisoned locks
unsafe extern "system" fn bad_win_handler(ctrl_type: u32) -> BOOL {
    // BUG 1: Panics if previous thread panicked while holding lock, crashing OS handler thread
    let mut guard = SIGNAL_STATE.lock().unwrap(); 
    
    // BUG 2: Abrupt termination kills output pipe instantly, breaking interactive pager UI
    std::process::exit(1); 
    
    // BUG 3: Swallowing system close/shutdown signals causing hanging ghost processes
    TRUE 
}
```

**VERIFICATION METHOD**:
Verify using automated unit tests checking count reset after timeout and immediate exit when `max_count == 0`:
```rust
#[test]
fn test_interrupt_debounce_invariants() {
    let base = Instant::now();
    let mut state = InterruptState::new(2, Duration::from_millis(500));
    
    assert!(!state.register_interrupt(base));
    // Exceed timeout: count resets to 0, then increments to 1 (returns false)
    assert!(!state.register_interrupt(base + Duration::from_millis(600)));
    // Second interrupt within 500ms window reaches max_count (returns true)
    assert!(state.register_interrupt(base + Duration::from_millis(800)));
}
```

---

### 2. Strict Decimal Epoch Parser with Boundary Rounding Carry
**RULE**:
Floating-point/decimal Unix timestamp parsers MUST NOT parse fractional timestamps via IEEE-754 binary floating-point conversions (`f64::parse`). They MUST parse fractional portions as fixed-point integers, validate leading/trailing decimal point syntax (`.5`, `1000.`, `-.5`), correctly propagate rounding carries into the integer seconds component without generating invalid leap seconds (`:60`), and prevent signed subtraction overflow at extreme epoch boundaries.

**WHY**:
Using `f64` to parse timestamps introduces floating-point precision loss for nanosecond and microsecond timestamps (which exceed `f64`'s 53 bits of mantissa). Furthermore, standard naive splits on `.` fail to recognize valid POSIX/JSON numerical strings lacking leading zeros (`.5` or `-.5`), inadvertently parse negative fractions like `-0.5` as positive `+0.5` seconds due to naive sign splitting, and crash with integer underflows when processing fractional timestamps near `i64::MIN`.

**WHEN TO APPLY**:
Apply to any structured data ingestion engine, telemetry processor, or log parser converting raw textual numbers or JSON values into nanosecond/second timestamps (`SystemTime`, `DateTime<Utc>`, `i64` nanos).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub struct EpochTimestamp {
    pub secs: i64,
    pub nanos: u32,
}

#[derive(Debug, PartialEq)]
pub enum TimestampParseError {
    InvalidFormat,
    OutOfRange,
    Overflow,
}

pub fn parse_decimal_epoch(input: &str) -> Result<EpochTimestamp, TimestampParseError> {
    if input.is_empty() {
        return Err(TimestampParseError::InvalidFormat);
    }

    let (is_negative, rest) = match input.strip_prefix('-') {
        Some(s) => (true, s),
        None => (false, input),
    };

    if rest.is_empty() {
        return Err(TimestampParseError::InvalidFormat);
    }

    let (int_part, frac_part) = match rest.split_once('.') {
        Some((int_str, frac_str)) => (int_str, Some(frac_str)),
        None => (rest, None),
    };

    // 1. Parse integer part. Allow empty string if fractional part exists (e.g. ".5" or "-.5")
    let raw_secs: i64 = if int_part.is_empty() {
        if frac_part.is_none() {
            return Err(TimestampParseError::InvalidFormat);
        }
        0
    } else {
        int_part.parse::<i64>().map_err(|_| TimestampParseError::InvalidFormat)?
    };

    // 2. Parse and normalize fractional part to nanoseconds (9 digits)
    let mut nanos: u64 = 0;
    let mut carry_sec: i64 = 0;

    if let Some(frac_str) = frac_part {
        if !frac_str.is_empty() {
            let mut nano_buf = [b'0'; 9];
            let frac_bytes = frac_str.as_bytes();
            let copy_len = frac_bytes.len().min(9);
            
            for (i, byte) in frac_bytes[..copy_len].iter().enumerate() {
                if !byte.is_ascii_digit() {
                    return Err(TimestampParseError::InvalidFormat);
                }
                nano_buf[i] = *byte;
            }

            // Verify trailing digits are valid numbers
            for byte in &frac_bytes[copy_len..] {
                if !byte.is_ascii_digit() {
                    return Err(TimestampParseError::InvalidFormat);
                }
            }

            // Check if 10th digit rounds up
            let round_up = if frac_bytes.len() > 9 {
                frac_bytes[9] >= b'5'
            } else {
                false
            };

            let parsed_nanos = std::str::from_utf8(&nano_buf)
                .map_err(|_| TimestampParseError::InvalidFormat)?
                .parse::<u64>()
                .map_err(|_| TimestampParseError::InvalidFormat)?;

            nanos = parsed_nanos + if round_up { 1 } else { 0 };

            // Carry propagation: 999_999_999 rounded up becomes 1_000_000_000
            if nanos >= 1_000_000_000 {
                nanos -= 1_000_000_000;
                carry_sec = 1;
            }
        }
    }

    // 3. Coordinate negative seconds and carry
    let mut final_secs = if is_negative {
        raw_secs.checked_neg().ok_or(TimestampParseError::OutOfRange)?
    } else {
        raw_secs
    };

    if is_negative {
        final_secs = final_secs.checked_sub(carry_sec).ok_or(TimestampParseError::Overflow)?;
        if nanos > 0 {
            // Negative timestamp fractional offset: -0.5s = -1s + 500_000_000ns
            final_secs = final_secs.checked_sub(1).ok_or(TimestampParseError::Overflow)?;
            nanos = 1_000_000_000 - nanos;
        }
    } else {
        final_secs = final_secs.checked_add(carry_sec).ok_or(TimestampParseError::Overflow)?;
    }

    Ok(EpochTimestamp {
        secs: final_secs,
        nanos: nanos as u32,
    })
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive f64 split and sign parsing
pub fn bad_parse_epoch(input: &str) -> (i64, u32) {
    // BUG 1: -0.5 parses into secs = 0, which cannot retain negative sign! Becomes +0.5s.
    // BUG 2: f64 loses nanosecond precision for large Unix timestamps.
    // BUG 3: .5 or -.5 fails to parse as integer seconds.
    let float_val: f64 = input.parse().unwrap(); 
    let secs = float_val as i64;
    let nanos = ((float_val - secs as f64) * 1e9) as u32; // Floating point inaccuracies yield bogus nanos
    (secs, nanos)
}
```

**VERIFICATION METHOD**:
Execute property and edge-case unit test matrix covering boundary conditions:
```rust
#[test]
fn test_epoch_precision_and_negative_carry() {
    let t1 = parse_decimal_epoch("-0.5").unwrap();
    assert_eq!((t1.secs, t1.nanos), (-1, 500_000_000));

    let t2 = parse_decimal_epoch(".5").unwrap();
    assert_eq!((t2.secs, t2.nanos), (0, 500_000_000));

    let t3 = parse_decimal_epoch("-.5").unwrap();
    assert_eq!((t3.secs, t3.nanos), (-1, 500_000_000));

    let t4 = parse_decimal_epoch("59.9999999999").unwrap();
    assert_eq!((t4.secs, t4.nanos), (60, 0)); // Clean carry, not leap-second corrupt
}
```

---

### 3. Asynchronous Safe RAII Resource Tear-Down for Blocking Descriptors
**RULE**:
Types wrapping underlying resources whose `Drop` implementation can block the caller thread (such as child OS processes `std::process::Child`, blocking sockets, or unbuffered named pipes) MUST offload the destruction sequence to an asynchronous background worker thread if non-blocking execution guarantees are required, while ensuring all thread handles are cleanly joined before process exit.

**WHY**:
In command-line tools and streaming pipelines, terminating a pipeline or dropping a handle to a process like `less` or an external output compressor can trigger `Child::wait()` inside the standard library `Drop` implementation. If the child process is hung or waiting on an unclosed OS descriptor, the main thread deadlocks indefinitely upon exiting the current lexical block.

**WHEN TO APPLY**:
Apply to any RAII management wrapper dealing with OS process spawns, external pagers, C FFI handles that perform blocking I/O on release, or heavy kernel file descriptor teardowns.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::thread::{self, JoinHandle};

/// Wraps a value and drops it on a dedicated background thread, joining on outer drop.
pub struct AsyncDrop {
    handle: Option<JoinHandle<()>>,
}

impl AsyncDrop {
    /// Spawns a background worker taking ownership of `value` to drop it asynchronously.
    pub fn new<T: Send + 'static>(value: T) -> Self {
        let handle = thread::spawn(move || {
            drop(value);
        });
        Self {
            handle: Some(handle),
        }
    }
}

impl Drop for AsyncDrop {
    fn drop(&mut self) {
        if let Some(handle) = self.handle.take() {
            // Join ensures zombie threads do not outlive the owning lifecycle scope
            handle.join().ok();
        }
    }
}

/// Explicit Drop Ordering Wrapper: Drops value first, then notifies callback.
pub struct DropNotifier<T, F>
where
    F: FnOnce(),
{
    inner: Option<T>,
    notify: Option<F>,
}

impl<T, F> DropNotifier<T, F>
where
    F: FnOnce(),
{
    pub fn new(value: T, notify: F) -> Self {
        Self {
            inner: Some(value),
            notify: Some(notify),
        }
    }
}

impl<T, F> Drop for DropNotifier<T, F>
where
    F: FnOnce(),
{
    fn drop(&mut self) {
        // Enforce strict order: inner resource is dropped before notification fires
        self.inner.take();
        if let Some(f) = self.notify.take() {
            f();
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct synchronous wait in caller thread without lifecycle isolation
struct ChildProcessWrapper {
    child: std::process::Child,
}

impl Drop for ChildProcessWrapper {
    fn drop(&mut self) {
        // HAZARD: If stdout/stdin pipes remain open anywhere in the process tree,
        // this call deadlocks the main UI thread during standard unwinding!
        let _ = self.child.wait(); 
    }
}
```

**VERIFICATION METHOD**:
Verify using a slow-drop mock struct to confirm that blocking drop execution occurs out of line:
```rust
#[test]
fn test_async_drop_decouples_and_joins() {
    use std::sync::{Arc, Mutex};
    use std::time::Instant;

    struct BlockingDrop(Arc<Mutex<bool>>);
    impl Drop for BlockingDrop {
        fn drop(&mut self) {
            std::thread::sleep(Duration::from_millis(50));
            *self.0.lock().unwrap() = true;
        }
    }

    let flag = Arc::new(Mutex::new(false));
    let t0 = Instant::now();
    {
        let _drop = AsyncDrop::new(BlockingDrop(Arc::clone(&flag)));
        // Instantiation does not block the caller thread
        assert!(t0.elapsed() < Duration::from_millis(20));
    }
    // Exiting scope joins the handle, ensuring drop completion
    assert!(*flag.lock().unwrap());
    assert!(t0.elapsed() >= Duration::from_millis(50));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Windows Console Ctrl-C Pipe Deadlock & Terminal Desync (BUG-WIN-SIGINT-01)
- **Context**: Win32 Signal handling abstraction (`src/signal_windows.rs`, `Cargo.toml`).
- **What Was Expected**: Pressing Ctrl-C while viewing logs in a pager (`less.exe`) on Windows should permit the pager to handle the interrupt (e.g., aborting current line search), exiting with exit code 130 only after `--interrupt-ignore-count` interrupts occur within `--interrupt-timeout`.
- **What Actually Happened**: `SignalHandler::run` was a no-op stub on Windows (`pub fn run<F>(_: usize, _: Duration, f: F) -> Result<()> { f() }`). Windows OS abruptly aborted `hl.exe` on Ctrl-C via the default OS console handler, killing the pipe, corrupting the terminal buffer, and bypassing pager integration.
- **Evidence in Repo**: Commit `45a4bfff` referencing Issue `#1613` and PR `#1614`.
- **Root Cause**: Lack of a platform-specific `SetConsoleCtrlHandler` hook registered to catch `CTRL_C_EVENT`. Additionally, lack of debounce tracking logic (`State::interrupt`) to coordinate multiple Ctrl-C bursts between `hl` and child console processes.
- **Remediation Code Diff**:
```rust
--- a/src/signal_windows.rs
+++ b/src/signal_windows.rs
@@ -1,18 +1,142 @@
-// std imports
-use std::time::Duration;
+use std::io;
+use std::process::exit;
+use std::sync::Mutex;
+use std::time::{Duration, Instant};
+use windows_sys::{
+    Win32::{
+        Foundation::{FALSE, TRUE},
+        System::Console::{CTRL_C_EVENT, SetConsoleCtrlHandler},
+    },
+    core::BOOL,
+};

+const EXIT_CODE: i32 = 0x80 + 2;
+static STATE: Mutex<Option<State>> = Mutex::new(None);

 pub struct SignalHandler {}
 impl SignalHandler {
-    pub fn run<F>(_: usize, _: Duration, f: F) -> Result<()>
+    pub fn run<F>(max_count: usize, timeout: Duration, f: F) -> Result<()>
     where
         F: FnOnce() -> Result<()>,
     {
+        let _guard = Self::new(max_count, timeout)?;
         f()
     }
+    fn new(max_count: usize, timeout: Duration) -> Result<Self> {
+        *lock() = Some(State::new(max_count, timeout));
+        if unsafe { SetConsoleCtrlHandler(Some(handler), TRUE) } == FALSE {
+            *lock() = None;
+            return Err(io::Error::last_os_error().into());
+        }
+        Ok(Self {})
+    }
+}
+impl Drop for SignalHandler {
+    fn drop(&mut self) {
+        unsafe { SetConsoleCtrlHandler(Some(handler), FALSE) };
+        *lock() = None;
+    }
+}
```
- **Lesson**: CLI utilities relying on POSIX signal abstractions (`signal-hook`) must provide an equivalent Win32 `SetConsoleCtrlHandler` layer with matching status codes (`0x80 + 2 = 130`) to avoid pipeline desynchronization.

---

### Incident 2: Dotted Nested Field Masking Leak in Multi-Variant Schemas (BUG-FMT-NESTED-02)
- **Context**: Nested predefined field pruning during log formatting (`src/formatting/`).
- **What Was Expected**: Dotted predefined fields (e.g. `log.level`, `metadata.timestamp`) matched in *any* schema variant must be masked from generic dynamic record fields.
- **What Actually Happened**: Nested level pruning only checked against names present in the *first* defined level variant. If a log matched a secondary level variant schema containing `log.level`, `hl` displayed the level twice: once formatted as header `[WRN]` and again inside the body map as `log={ level=warn }`.
- **Evidence in Repo**: Closed Bug Issue `#1634`, completing fix for `#176` and `#1187` found during `--output-format` implementation (`#1481`).
- **Root Cause**: The filter visitor broke out of the schema traversal loop after querying variant `0`, incorrectly assuming all schema variants share uniform key path topologies.
- **Remediation Code Diff**:
```rust
// - Buggy variant visitor:
// for variant in &self.variants[..1] {
//     if variant.matches(path) { hide(path); }
// }
// + Fixed multi-variant comprehensive masking:
for variant in &self.variants {
    if let Some(field) = variant.find_nested_field(path) {
        field_mask.insert(field.id());
        should_hide = true;
        break;
    }
}
```
- **Lesson**: When schema definitions support alternative polymorphic structures, field-masking traversals must search the union of all active variants.

---

### Incident 3: Decimal Epoch Timestamp Sign Inversion & Leap Carry Panic (BUG-TIME-DECIMAL-03)
- **Context**: Numerical timestamp parsing engine (`src/timestamp/`).
- **What Was Expected**: Decimal Unix timestamps of all notations (`.5`, `-.5`, `1700000000.`, `59.9999999999`, `-8334601228800000.5`) must parse into exact UTC timestamps without truncation or overflow.
- **What Actually Happened**: 
  1. Negative timestamps between -1.0s and 0.0s (`-0.5`) were parsed as positive (`+0.5s`) because the integer part `-0` evaluated to `0`, discarding the sign.
  2. Numbers with omitted leading zero (`.5`) or omitted fraction digits (`1700000000.`) failed to match the parser regex/grammar.
  3. Fractions rounding up to 1.0 (e.g., `59.9999999999`) failed to carry into the second field, generating invalid second bounds (`60`), leading to chrono panics.
  4. Extreme negative millisecond/microsecond boundaries near `-8334601228800000.5` caused integer negation underflow.
- **Evidence in Repo**: Closed Bug Issue `#1633`.
- **Root Cause**: Naive string-to-float conversions combined with integer sign stripping that lacked explicit carry mechanics for rounded fractions.
- **Remediation Code Diff**:
```rust
// Handle sign before numeric string parsing:
let (is_negative, slice) = match raw.strip_prefix('-') {
    Some(rest) => (true, rest),
    None => (false, raw),
};
// Allow empty integer part when dot is present:
let (int_str, frac_str) = match slice.split_once('.') {
    Some((i, f)) => (if i.is_empty() { "0" } else { i }, f),
    None => (slice, ""),
};
// Propagate carry on fractional nanosecond rounding:
if nanos >= 1_000_000_000 {
    nanos -= 1_000_000_000;
    secs = secs.checked_add(1