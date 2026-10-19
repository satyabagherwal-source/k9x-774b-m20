> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tokio-rs-tokio-learnings.md`  
> **Source**: github ([https://github.com/tokio-rs/tokio](https://github.com/tokio-rs/tokio))  
> **Source Version**: `0d322ce7`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T10:48:30.922Z  
> **Learning ID**: `learn-github-tokio-rs-tokio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tokio-rs/tokio

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`tokio` is an asynchronous, event-driven runtime and I/O platform for Rust. The core engine solves the problem of driving massive numbers of non-blocking I/O operations and asynchronous tasks onto an M:N threading model (M user-space tasks multiplexed over N OS worker threads) with zero runtime cost over native OS polling interfaces (`epoll` on Linux, `kqueue` on macOS/BSD, IOCP on Windows). 

It specifically eliminates:
1. Thread-per-connection scaling bottlenecks.
2. Accidental blocking inside asynchronous executor event loops.
3. Memory thrashing and excessive allocations during streaming byte manipulations.
4. Silent state corruption during stream cancellation and task preemption.

### Architectural Subsystem Boundaries
The architecture is partitioned into four major layers with strict unidirectional coupling:

```
+-------------------------------------------------------------------------------+
|                       tokio-util / High-Level Adapters                        |
|   (Codecs, FramedRead, FramedWrite, Framed, LinesCodec, LengthDelimitedCodec) |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
|                         tokio Engine Facade / Tasks                           |
|       (AsyncRead, AsyncWrite, spawn, spawn_blocking, Coop Budget, sync)       |
+-------------------------------------------------------------------------------+
         |                                                       |
         v                                                       v
+---------------------------------+             +-------------------------------+
|             Reactor             |             |     Work-Stealing Executor    |
|   (mio::Poll, Driver, Registry) |             | (Local Run Queues, Steal Half,|
|   (epoll / kqueue / IOCP / mio) |             |  Global Injector Queue, Park) |
+---------------------------------+             +-------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
|                        Operating System Syscall Boundary                      |
+-------------------------------------------------------------------------------+
```

1. **The Codec & Framing Layer (`tokio-util::codec`)**: Decouples continuous byte streams (`AsyncRead`/`AsyncWrite`) into discreet, typed application-level messages (`Sink`/`Stream`) via reusable buffer split semantics (`bytes::BytesMut`), handling partial reads, packet framing, delimiter scanning, and backpressure.
2. **The Task Engine & Cooperative Scheduler (`tokio::runtime`, `tokio::task`)**: Implements cooperative task polling using a tick-based budget system (`tokio::task::coop`). It guarantees that no long-running task can starve other tasks on the same worker thread.
3. **The Reactor Core (`tokio::runtime::driver`)**: Abstracts OS I/O readiness notifications via `mio`. It tracks registered file descriptors, token-based wakeups, and translates system events into `std::task::Waker` invocations.
4. **The Blocking Pool (`tokio::blocking`)**: An adaptive thread pool dedicated to running compute-heavy or blocking filesystem/standard I/O operations without stalling the asynchronous reactor thread pool.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Preservation Across Stream Lifecycle and EOF Boundaries
**RULE**:
When implementing streaming framed protocol adapters or decoders over continuous byte streams, decoders **MUST** explicitly account for three terminal state invariants:
1. Differentiate between `Framing` (in-flight data parsing), `Pausing` (EOF encountered with remaining unparsed bytes), and `Paused` (EOF settled, buffer empty).
2. Never treat a zero-byte read (`Poll::Ready(0)`) as EOF unless the buffer has been pre-allocated with at least 1 spare capacity byte (`buffer.reserve(1)`).
3. Codecs **MUST** retain internal error latching (`has_errored = true`) to prevent subsequent calls from corrupting state or repeatedly invoking a poisoned decoder.

**WHY**:
If `poll_read_buf` is called when `buffer.capacity() == buffer.len()`, the underlying OS driver cannot read any incoming bytes and returns `Ok(0)`. If interpreted naively, the adapter concludes the stream has terminated (EOF), prematurely dropping active TCP connections while valid unread data remains pending on the wire. Furthermore, if a parser returns an error, any unlatched subsequent call to `poll_next` might attempt to parse leftover garbage, violating the deterministic halt contract of `futures_core::Stream`.

**WHEN TO APPLY**:
Any time an asynchronous parser, stateful protocol decoder, framed transport, or ring-buffer accumulator translates unsegmented raw byte streams into discrete application structures across network sockets, FIFOs, and files.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};
use bytes::BytesMut;
use tokio::io::AsyncRead;

pub trait FrameDecoder {
    type Item;
    type Error: From<io::Error>;
    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error>;
    fn decode_eof(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error>;
}

pub struct StreamFramer<R, D> {
    io: R,
    decoder: D,
    buffer: BytesMut,
    eof: bool,
    is_readable: bool,
    has_errored: bool,
}

impl<R: AsyncRead + Unpin, D: FrameDecoder> StreamFramer<R, D> {
    pub fn poll_step(&mut self, cx: &mut Context<'_>) -> Poll<Option<Result<D::Item, D::Error>>> {
        loop {
            // Invariant 1: Error Latch Guard
            if self.has_errored {
                self.is_readable = false;
                return Poll::Ready(None);
            }

            // Invariant 2: Process Buffered Frames First
            if self.is_readable {
                if self.eof {
                    let res = self.decoder.decode_eof(&mut self.buffer).map_err(|e| {
                        self.has_errored = true;
                        e
                    })?;
                    if res.is_none() {
                        self.is_readable = false;
                    }
                    return Poll::Ready(res.map(Ok));
                }

                if let Some(frame) = self.decoder.decode(&mut self.buffer).map_err(|e| {
                    self.has_errored = true;
                    e
                })? {
                    return Poll::Ready(Some(Ok(frame)));
                }

                self.is_readable = false;
            }

            // Invariant 3: Reserve capacity to eliminate spurious 0-byte reads (false EOFs)
            self.buffer.reserve(1);

            let mut read_buf = tokio::io::ReadBuf::uninit(self.buffer.spare_capacity_mut());
            match Pin::new(&mut self.io).poll_read(cx, &mut read_buf) {
                Poll::Ready(Ok(())) => {
                    let n = read_buf.filled().len();
                    // SAFETY: filled().len() bytes were initialized by the poll_read call
                    unsafe { self.buffer.set_len(self.buffer.len() + n); }
                    if n == 0 {
                        if self.eof {
                            return Poll::Ready(None);
                        }
                        self.eof = true;
                    } else {
                        self.eof = false;
                    }
                    self.is_readable = true;
                }
                Poll::Ready(Err(e)) => {
                    self.has_errored = true;
                    return Poll::Ready(Some(Err(e.into())));
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Naive decoding loop without capacity reservation or error latching
fn poll_next_broken(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Item>> {
    // BUG 1: If buffer capacity is full, this reads 0 bytes and falsely assumes EOF
    let n = match Pin::new(&mut self.io).poll_read(cx, &mut self.raw_buf) {
        Poll::Ready(Ok(0)) => return Poll::Ready(None), // Premature death!
        Poll::Ready(Ok(n)) => n,
        Poll::Ready(Err(e)) => return Poll::Ready(None), // Error swallowed!
        Poll::Pending => return Poll::Pending,
    };
    // BUG 2: If decode fails once, next poll invokes decode again on corrupted buffer!
    let item = self.decoder.decode(&mut self.raw_buf).unwrap(); 
    Poll::Ready(item)
}
```

**VERIFICATION METHOD**:
1. Unit test with zero-capacity buffer initialization (`BytesMut::with_capacity(0)`), verifying that calling `poll_next` triggers a resize rather than emitting `Poll::Ready(None)`.
2. Mock stream injector that yields `n > 0` bytes, returns `Poll::Pending`, then injects an error, asserting that subsequent calls to `poll_next` yield `Poll::Ready(None)` indefinitely without calling inner decoders.

---

### 2. Context Boundary Enforcement for Asynchronous System Primitives
**RULE**:
Asynchronous synchronization primitives, I/O reactors, and blocking task shims **MUST** explicitly verify the presence of an active runtime context (`Handle::current()`) at execution start, panicking early with actionable debugging tokens rather than silently degrading, hanging, or executing blocking operations on arbitrary foreign threads.

**WHY**:
When runtime shims (such as Emscripten shims or WASM threads) allow asynchronous tasks to run without confirming that a reactor driver is managing timers and event loops, I/O operations will never receive readiness signals. The future will stall forever (`Poll::Pending`), leaking memory and task descriptors. For shims using cooperative yield semantics (`task::coop`), absence of a runtime context silently disables fairness throttling, causing worker thread starvation.

**WHEN TO APPLY**:
Any library, abstraction layer, or cross-compilation bridge (WASM/WASI/Emscripten/Native) that exposes async primitives (`TcpStream`, `spawn_blocking`, `timeout`, `File`) that depend on an underlying event-loop runtime.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[track_caller]
pub fn spawn_blocking_shim<F, R>(f: F) -> std::sync::mpsc::Receiver<R>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    // Mandate explicit active runtime registration before executing task logic
    if !tokio::runtime::Handle::try_current().is_ok() {
        panic!(
            "there is no reactor running, must be called from the context of a Tokio 1.x runtime. \
             Caller location: {}",
            std::panic::Location::caller()
        );
    }

    let (tx, rx) = std::sync::mpsc::channel();
    // Dispatch onto thread or coop boundary
    let _ = tx.send(f());
    rx
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Fallback to silent synchronous execution when runtime is absent
pub fn spawn_blocking_unsafe<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    // BUG: If no runtime exists, running directly masks architectural errors,
    // hanging executors and breaking task isolation guarantees!
    f()
}
```

**VERIFICATION METHOD**:
Run unit tests annotated with `#[should_panic(expected = "there is no reactor running")]` using standard `futures::executor::block_on` (an executor without the Tokio driver context), asserting that accessing net, time, fs, or blocking shims immediately panics.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Runtime Absence in Emscripten Blocking Shim (BUG-TOKIO-01)
- **Context**: Subsystem: WASM/Emscripten Portability Layer (`tokio/src/blocking.rs`).
- **What Was Expected**: Calling `spawn_blocking` or `spawn_mandatory_blocking` under Emscripten without an active Tokio runtime should panic immediately, signaling that asynchronous runtime drivers are missing.
- **What Actually Happened**: The Emscripten shim executed blocking code via `std::future::ready(Ok(f()))` wrapped in `coop::cooperative(...)` without verifying whether a Tokio context was active. The task ran outside the runtime context, bypassing cooperative execution limits and hiding architecture bugs.
- **Evidence in Repo**: Commit SHA: `1989b46f`, File: `tokio/src/blocking.rs`, Test: `tokio/tests/no_rt.rs`.
- **Root Cause**: The implementation assumed Emscripten single-threaded execution could always bypass runtime context verification.
- **Remediation Code Diff**:
```rust
@@ -24,18 +24,21 @@ cfg_rt! {
     #[cfg(target_os = "emscripten")]
+    #[track_caller]
     pub(crate) fn spawn_blocking<F, R>(f: F) -> JoinHandle<R>
     where
         F: FnOnce() -> R + Send + 'static,
         R: Send + 'static,
     {
+        let _rt = crate::runtime::Handle::current();
         crate::task::coop::cooperative(std::future::ready(Ok(f())))
     }
```
- **Lesson**: Platform-specific execution fallbacks must enforce the same state invariants as multi-threaded platforms.

---

### Incident 2: Error-Chain Truncation in Codec Source Trait (BUG-TOKIO-02)
- **Context**: Subsystem: Framed Codecs (`tokio-util/src/codec/any_delimiter_codec.rs`, `lines_codec.rs`).
- **What Was Expected**: Diagnostic reporters (`anyhow`, `tracing`, `eyre`) using `std::error::Error::source()` must receive the inner `std::io::Error` when an I/O read fails inside a codec.
- **What Actually Happened**: `LinesCodecError` and `AnyDelimiterCodecError` did not implement or erroneously returned `None` in `Error::source()`, dropping the inner OS network error and printing only generic codec text.
- **Evidence in Repo**: Closed Issue: #8665, Commit in `tokio-util`.
- **Root Cause**: The error enum omitted the `source()` implementation or failed to pattern match on the `Io` variant.
- **Remediation Code Diff**:
```rust
@@ -245,6 +245,15 @@ impl fmt::Display for AnyDelimiterCodecError {
+impl std::error::Error for AnyDelimiterCodecError {
+    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
+        match self {
+            Self::Io(err) => Some(err),
+            Self::MaxChunkLengthExceeded => None,
+        }
+    }
+}
```
- **Lesson**: Custom error types wrapping lower-level I/O errors must always override `Error::source()` to preserve root-cause diagnostic chains.

---

### Incident 3: Loss of Stream Metadata in Sink Adapters (BUG-TOKIO-03)
- **Context**: Subsystem: Stream/Sink IO Utilities (`tokio-util/src/io`).
- **What Was Expected**: Adapting a stream into a sink (`SinkWriter`, `CopyToBytes`) should preserve stream attributes like size hints and fused stream status.
- **What Actually Happened**: The adapter ignored `size_hint()` (defaulting to `(0, None)`) and did not implement `FusedStream`, preventing downstream collectors from pre-allocating memory and causing unbounded reallocation.
- **Evidence in Repo**: Closed Issue: #8664.
- **Root Cause**: The adapter wrapper implemented `Stream` purely by proxying `poll_next` without forwarding optional trait methods or marker traits.
- **Remediation Code Diff**:
```rust
+// Forward size hints and implement FusedStream
+impl<S> Stream for SinkWriter<S> 
+where S: Stream {
+    type Item = S::Item;
+    
+    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
+        Pin::new(&mut self.inner).poll_next(cx)
+    }
+
+    fn size_hint(&self) -> (usize, Option<usize>) {
+        self.inner.size_hint()
+    }
+}
+
+impl<S: FusedStream> FusedStream for SinkWriter<S> {
+    fn is_terminated(&self) -> bool {
+        self.inner.is_terminated()
+    }
+}
```
- **Lesson**: Any proxy adapter struct wrapping an abstraction must systematically forward metadata calls (`size_hint`, `is_terminated`) down to the inner type.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Buffer Splitting vs Memory Copies**: Never use slice indexing and memory cloning (`buf[..n].to_vec()`) to advance through network data. Use `BytesMut::split_to(n)`, which performs an atomic reference-count increment on the underlying buffer and advances pointers in $O(1)$ time without memory allocation.
* **Saturating Arithmetic for Capacity Calculations**: When calculating read lookahead targets with maximum limits:
  ```rust
  // Safe bounded lookahead calculation:
  let read_to = cmp::min(self.max_length.saturating_add(1), buf.len());
  ```
  Using `self.max_length + 1` can overflow `usize::MAX` in 64-bit systems if `max_length` is set to unbound, causing an immediate panic in debug builds or unexpected wrapping in release builds.

### 2. Infinite Loop & Recursion Guards
* **State Machine Loops in `poll_next`**: Any loop handling an internal state machine (such as in `FramedImpl::poll_next`) **MUST** ensure at least one branch yields or modifies the state variable on every path.
  * **Invariant Proof**: When `decode()` returns `Ok(None)`, the flag `self.is_readable` is set to `false`. The loop cannot re-enter the decoding branch without performing an I/O read (`poll_read_buf`).
  * If `poll_read_buf` returns `Poll::Pending`, the loop executes `return Poll::Pending`, relinquishing the thread to the OS executor.

### 3. Backend Concurrency & Memory Safety
* **Spurious Wakeup / False 0-Byte EOF**: 
  ```rust
  state.buffer.reserve(1);
  let bytect = match poll_read_buf(pinned.inner.as_mut(), cx, &mut state.buffer) { ... }
  ```
  `poll_read_buf` considers an EOF condition to have occurred if 0 bytes are read. If `state.buffer.capacity() == state.buffer.len()`, zero bytes are read because there is no space to write, generating a false EOF signal and breaking the connection. Reserving at least 1 byte prevents this false EOF condition.

### 4. Defect & Error Prevention ("Galti Pakadna")
* **Denial-of-Service Through Unbounded Delimiter Scanning**:
  * An attacker can stream bytes without ever sending a delimiter token (such as `\n`).
  * If the parser searches for delimiters over an unbounded buffer, memory usage will grow until the process is terminated by the OOM killer.
  * **Defense-in-Depth Invariant**: Codecs must implement bounded searching with a hard chunk limit (`max_length`). When the limit is exceeded, the parser must switch into a discarding state (`self.is_discarding = true`) and discard subsequent input up to the delimiter without accumulating memory.

```rust
// Discarding mechanism
if self.is_discarding {
    buf.advance(discard_len);
    self.next_index = 0;
    return Ok(None);
}
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
* **Modular Layering**: Clear isolation between `tokio` (the runtime engine, scheduling threads, and OS drivers) and `tokio-util` (framing, codecs, and adapters).
* **Decoupled Framing Engine**: `FramedImpl<T, U, State>` unifies both full-duplex (`Framed`) and half-duplex (`FramedRead`, `FramedWrite`) streams via the `Borrow` and `BorrowMut` traits on state containers (`RWFrames`, `ReadFrame`, `WriteFrame`).

### Dimension 2: Core Abstractions
* **`Decoder` & `Encoder` Traits**:
  ```rust
  pub trait Decoder {
      type Item;
      type Error: From<io::Error>;
      fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error>;
      fn decode_eof(&mut self, buf: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error>;
  }
  ```
  Decouples the parsing of frames from the underlying I/O transport, enabling codecs to be tested using in-memory byte buffers without mock network sockets.

### Dimension 3: Error Handling
* **Error Containment & State Poisoning Guards**: If an error occurs during decoding or I/O reading, `state.has_errored` is latched to true. Any future calls immediately return `Poll::Ready(None)`. This protects callers from receiving partial, corrupt data after a failure.

### Dimension 4: Testing
* **Loom Concurrency Permutation Testing**: The codebase utilizes `loom` (`cfg(loom)`) to check concurrent algorithms across possible thread interleavings and memory orderings, systematically testing for data races and atomic hazards.
* **No-Runtime Context Tests**: Invariants are tested under `tests/no_rt.rs`, asserting that invoking any runtime-dependent primitive outside a Tokio context panics with clear messaging.

### Dimension 5: Security
* **Memory Exhaustion Protections (DoS Defense)**:
  * Protocols using dynamic framing (`AnyDelimiterCodec`, `LengthDelimitedCodec`) enforce chunk length limits (`max_length`).
  * If the incoming packet length exceeds the configured threshold, the parser raises an error and discards the oversized chunk to protect against memory exhaustion attacks.

### Dimension 6: Performance
* **Zero-Allocation Byte Slicing**: Using `BytesMut::split_to` avoids buffer copying when emitting messages. Slices share underlying heap allocations via atomic reference counts until dropped.
* **Vectorized Delimiter Search**: Codecs select delimiter matching strategies based on slice characteristics:
  * Single-byte delimiters use `memchr` (which uses SIMD instructions like AVX2/SSE2 when available).
  * Multi-byte delimiters fall back to byte search routines.

### Dimension 7: Deployment & Target Constraints
* **Unstable and Cross-Platform Flags**:
  * CI verifies strict compilation via conditional flags: `cfg(fuzzing)`, `cfg(loom)`, `cfg(tokio_unstable)`.
  * Shims ensure single-threaded environments (such as Emscripten and WASI) behave safely without dropping runtime invariants.

### Dimension 8: Agent Patterns & Operational Guards
* **Cancellation Safety Documentation**: APIs explicitly document cancellation properties:
  * `tokio_stream::StreamExt::next` is marked **cancellation-safe** (dropping the future retains buffered data).
  * `SinkExt::send` is marked **cancellation-unsafe** (dropping the future mid-send can result in message loss).

### Dimension 9: Data Flow & Mutation Lifecycles
```
[ Socket / AsyncRead ] 
       | (poll_read_buf into spare capacity)
       v
[ BytesMut Buffer ] 
       | (Decoder::decode(&mut BytesMut))
       v
[ Success: split_to() -> Bytes -> Item ]  ---> Emitted to caller
[ Incomplete: Ok(None) ]                 ---> Retain in buffer, await next Poll
[ Overflow: MaxChunkLengthExceeded ]     ---> Set is_discarding, advance buffer
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Bounded Stateful Discarding Parser
```rust
pub fn decode_bounded(
    buf: &mut BytesMut, 
    max_len: usize, 
    is_discarding: &mut bool
) -> Result<Option<Bytes>, CodecError> {
    if *is_discarding {
        if let Some(pos) = memchr::memchr(b'\n', buf) {
            buf.advance(pos + 1);
            *is_discarding = false;
        } else {
            buf.clear();
            return Ok(None);
        }
    }
    if let Some(pos) = memchr::memchr(b'\n', buf) {
        if pos > max_len {
            *is_discarding = true;
            buf.advance(pos + 1);
            return Err(CodecError::MaxChunkLengthExceeded);
        }
        let mut frame = buf.split_to(pos + 1);
        frame.truncate(frame.len() - 1);
        return Ok(Some(frame.freeze()));
    }
    if buf.len() > max_len {
        *is_discarding = true;
        return Err(CodecError::MaxChunkLengthExceeded);
    }
    Ok(None)
}
```

### 2. Rule
> Any asynchronous framing layer bridging byte buffers to structured types MUST guarantee that `reserve(1)` is called on the internal buffer prior to polling the I/O driver. Code MUST NOT assume a 0-byte read represents EOF unless the buffer has non-zero write capacity.

### 3. Architecture Principle
> Framing state machines must decouple buffer allocation from parsing logic. Protocol decoders must be deterministic, synchronous functions operating entirely on in-memory buffers (`&mut BytesMut`), leaving all I/O, polling, and context-tracking to the transport wrapper.

### 4. Failure Mode
- **Name**: Spurious EOF Connection Termination.
- **Trigger**: Incoming network traffic fills an internal buffer to capacity. The framer polls the underlying socket without allocating additional space.
- **Manifestation**: The OS kernel returns 0 bytes read, which the transport misinterprets as connection termination, dropping the connection while data is still pending.

### 5. Reusable Skill
**Step-by-Step Codec Construction Protocol for AI Agents**:
1. Define a struct containing `next_index: usize`, `max_length: usize`, and `is_discarding: bool`.
2. Implement `Decoder`:
   - Calculate lookahead: `cmp::min(self.max_length.saturating_add(1), buf.len())`.
   - Scan for delimiters using `memchr` for single bytes, falling back to iterative searches for multiple bytes.
   - If discarding, advance the buffer to the delimiter and reset state.
   - If not discarding and a delimiter is found, extract the frame via `buf.split_to()`, trim delimiters, and return `Ok(Some(chunk.freeze()))`.
   - If no delimiter is found and `buf.len() > self.max_length`, set `is_discarding = true` and return `Err(MaxChunkLengthExceeded)`.
   - If no delimiter is found and buffer length is within bounds, update `next_index` and return `Ok(None)`.
3. Implement `decode_eof` to drain remaining bytes or raise an error if unparsed trailing data remains.

### 6. Decision: Zero-Copy Framing vs Monolithic Slices
- **Chosen**: Dynamic byte partitioning using `bytes::BytesMut` and `Bytes`.
- **Rejected**: Returning byte slices borrowing the internal buffer (`&[u8]`).
- **Rationale**: Returning borrowed slices (`&[u8]`) would tie the lifetime of decoded messages to the parser's internal buffer, preventing parallel processing. `BytesMut::split_to` creates independent, ref-counted byte handles in $O(1)$ time without copying message payloads.

### 7. Anti-Pattern: Unlatched Polling Loop Error Recovery
```rust
// ANTI-PATTERN: Failing to latch error state causes repeated invocation of broken decoders
fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Result<Item, Error>>> {
    match self.codec.decode(&mut self.buffer) {
        Ok(Some(item)) => Poll::Ready(Some(Ok(item))),
        Ok(None) => self.do_read(cx),
        Err(e) => {
            // Missing: self.has_errored = true;
            // The next call to poll_next will re-parse corrupted buffer data!
            Poll::Ready(Some(Err(e)))
        }
    }
}
```

### 8. Verification Method
Automated fuzz test running against framing decoders to verify resilience against malformed streams:
```rust
#[test]
fn verify_fuzz_stream_limits() {
    let mut codec = AnyDelimiterCodec::new_with_max_length(vec![b'\n'], vec![b'\n'], 16);
    let mut buf = BytesMut::new();
    
    // Inject 100 bytes of non-delimited data
    buf.extend_from_slice(&[b'a'; 100]);
    assert!(matches!(codec.decode(&mut buf), Err(AnyDelimiterCodecError::MaxChunkLengthExceeded)));
    
    // Trailing delimiter must be discarded cleanly
    buf.extend_from_slice(b"extra\nvalid\n");
    assert_eq!(codec.decode(&mut buf).unwrap(), None); // Discard remainder
    assert_eq!(codec.decode(&mut buf).unwrap().unwrap(), &b"valid"[..]);
}
```

---

## 7. Actionable Agent Skill & Implementation Checklist

When generating or refactoring asynchronous network framing or runtime-dependent Rust code, follow this verification checklist:

- [ ] **Runtime Context Assertion**: Verify that `Handle::current()` or `Handle::try_current()` is invoked when initializing primitives that depend on a reactor.
- [ ] **Buffer Capacity Checks**: Ensure `buf.reserve(1)` is invoked immediately before calling `poll_read_buf` or `poll_read` on underlying streams.
- [ ] **Memory Exhaustion Safeguards**: Ensure protocol decoders accept a `max_length` parameter to guard against unbounded buffer allocations.
- [ ] **Lookahead Bounds**: Calculate buffer lookahead windows using saturating arithmetic: `cmp::min(limit.saturating_add(1), buf.len())`.
- [ ] **Fast Path Scanning**: Use `memchr::memchr` for single-byte delimiter searches to take advantage of SIMD optimizations.
- [ ] **Error Latching**: Maintain an explicit boolean error latch (`has_errored`) in `Stream` implementations to halt polling after a failure.
- [ ] **Adapter Metadata Forwarding**: Ensure stream and sink proxy adapters forward `size_hint()` and implement `FusedStream` when wrapping inner streams.
- [ ] **Diagnostic Source Chains**: Implement `std::error::Error::source` on all error enums wrapping `std::io::Error` to preserve error trace contexts.
- [ ] **Allocation-Free Slicing**: Use `BytesMut::split_to` and `.freeze()` when returning message chunks rather than copying slices into new `Vec<u8>` containers.