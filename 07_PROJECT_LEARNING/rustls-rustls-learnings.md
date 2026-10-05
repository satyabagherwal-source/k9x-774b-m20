# Forensic Learning Record (Deep Inspection): rustls/rustls

> **Canonical Artifact**: `07_PROJECT_LEARNING/rustls-rustls-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rustls/rustls](https://github.com/rustls/rustls))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:54.833Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rustls/rustls`
- **Description**: A modern TLS library in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7654 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ci-bench/src/util.rs`
```
pub(crate) mod async_io {
    //! Async IO building blocks required for sharing code between the instruction count and
    //! wall-time benchmarks

    use core::cell::{Cell, RefCell};
    use core::future::Future;
    use core::pin::{Pin, pin};
    use core::task::{Poll, RawWaker, RawWakerVTable, Waker};
    use core::{ptr, task};
    use std::collections::VecDeque;
    use std::fs::File;
    use std::io;
    use std::rc::Rc;

    use async_trait::async_trait;

    /// Block on a future that should complete in a single poll.
    ///
    /// Safe to use when the underlying futures are blocking (e.g. waiting for an IO operation to
    /// complete, and returning Poll::Ready afterwards, without yielding in between).
    ///
    /// Useful when counting CPU instructions, because the server and the client side of the
    /// connection run in two separate processes and communicate through stdio using blocking
    /// operations.
    pub(crate) fn block_on_single_poll(
        future: impl Future<Output = anyhow::Result<()>>,
    ) -> anyhow::Result<()> {
        // We don't need a waker, because the future will complete in one go
        let waker = noop_waker();
        let mut ctx = task::Context::from_waker(&waker);

        match pin!(future).poll(&mut ctx) {
            Poll::Ready(result) => result,
            Poll::Pending => {
                panic!("the provided future did not finish after one poll!")
            }
        }
    }

    /// Block on two futures that are run concurrently and return their results.
    ///
    /// Useful when measuring wall-time, because the server and the client side of the connection
    /// run in a single process _and_ thread to minimize noise. Each side of the connection runs
    /// inside its own future and they are polled in turns.
    ///
    /// Using this together with blocking futures can lead to deadlocks (i.e. when one of the
    /// futures is blocked while it waits on a message from the other).
    pub(crate) fn block_on_concurrent(
        x: impl Future<Output = anyhow::Result<()>>,
        y: impl Future<Output = anyhow::Result<()>>,
    ) -> (anyhow::Result<()>, anyhow::Result<()>) {
        let mut x = pin!(x);
        let mut y = pin!(y);

        // The futures won't complete right away, but since there are only two of them we can poll
        // them in turns without a more complex waking mechanism.
        let waker = noop_waker();
        let mut ctx = task::Context::from_waker(&waker);

        let mut x_output = None;
        let mut y_output = None;

        // Fuel makes sure we can exit a potential infinite loop if the futures are endlessly
        // waiting on each other due to a bug (e.g. a read without a corresponding write)
        let mut fuel = 1_000;
        loop {
            let futures_done = x_output.is_some() && y_output.is_some();
            if futures_done || fuel == 0 {
                break;
            }

            fuel -= 1;

            if x_output.is_none() {
                match x.as_mut().poll(&mut ctx) {
                    Poll::Ready(output) => x_output = Some(output),
                    Poll::Pending => {}
                }
            }

            if y_output.is_none() {
                match y.as_mut().poll(&mut ctx) {
                    Poll::Ready(output) => y_output = Some(output),
                    Poll::Pending => {}
                }
            }
        }

        match (x_output, y_output) {
            (Some(x_output), Some(y_output)) => (x_output, y_output),
            _ => panic!("at least one of the futures seems to be stuck"),
        }
    }

    // Copied from Waker::noop, which we cannot use directly because it hasn't been stabilized
    fn noop_waker() -> Waker {
        const VTABLE: RawWakerVTable = RawWakerVTable::new(|_| RAW, |_| {}, |_| {}, |_| {});
        const RAW: RawWaker = RawWaker::new(ptr::null(), &VTABLE);
        unsafe { Waker::from_raw(RAW) }
    }

    /// Read bytes asynchronously
    #[async_trait(?Send)]
    pub(crate) trait AsyncRead {
        async fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>;
        async fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()>;
    }

    /// Write bytes asynchronously
    #[async_trait(?Send)]
    pub(crate) trait AsyncWrite {
        async fn write_all(&mut self, buf: &[u8]) -> io::Result<()>;
        async fn flush(&mut self) -> io::Result<()>;
    }

    // Blocking implementation of AsyncRead for files (used to read from stdin)
    #[async_trait(?Send)]
    impl AsyncRead for File {
        async fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            io::Read::read(self, buf)
        }

        async fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
            io::Read::read_exact(self, buf)
        }
    }

    // Blocking implementation of AsyncWrite for files (used to write to stdout)
    #[async_trait(?Send)]
    impl AsyncWrite for File {
        async fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
            io::Write::write_all(self, buf)
        }

        async fn flush(&mut self) -> io::Result<()> {
            io::Write::flush(self)
        }
    }

    /// Creates an unidirectional byte pipe of the given capacity, suitable for async reading and
    /// writing
    pub(crate) fn async_pipe(capacity: usize) -> (AsyncSender, AsyncReceiver) {
        let open = Rc::new(Cell::new(true));
        let buf = Rc::new(RefCell::new(VecDeque::with_capacity(capacity)));
        (
            AsyncSender {
                inner: AsyncPipeSide {
                    open: Rc::clone(&open),
                    buf: Rc::clone(&buf),
                },
            },
            AsyncReceiver {
                inner: AsyncPipeSide { open, buf },
            },
        )
    }

    /// The sender end of an asynchronous byte pipe
    pub(crate) struct AsyncSender {
        inner: AsyncPipeSide,
    }

    /// The receiver end of an asynchronous byte pipe
    pub(crate) struct AsyncReceiver {
        inner: AsyncPipeSide,
    }

    struct AsyncPipeSide {
        open: Rc<Cell<bool>>,
        buf: Rc<RefCell<VecDeque<u8>>>,
    }

    impl Drop for AsyncPipeSide {
        fn drop(&mut self) {
            self.open.set(false);
        }
    }

    #[async_trait(?Send)]
    impl AsyncRead for AsyncReceiver {
        async fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            AsyncPipeReadFuture {
                reader: self,
                user_buf: buf,
            }
            .await
        }

        async fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
            let mut read = 0;
            while read < buf.len() {
                read += self.read(&mut buf[read..]).await?;
            }

            Ok(())
        }
    }

    #[async_trait(?Send)]
    impl AsyncWrite for AsyncSender {
        async fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
            AsyncPipeWriteFuture {
                writer: self,
                user_buf: buf,
            }
            .await
        }

        async fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    struct AsyncPipeReadFuture<'a> {
        reader: &'a AsyncReceiver,
        user_buf: &'a mut [u8],
    }

    impl Future for AsyncPipeReadFuture<'_> {
        type Output = io::Result<usize>;

        fn poll(mut self: Pin<&mut Self>, _: &mut task::Context<'_>) -> Poll<Self::Output> {
            let inner_buf = &mut self.reader.inner.buf.borrow_mut();
            if inner_buf.is_empty() {
                return if self.reader.inner.open.get() {
                    // Wait for data to arrive, or EOF
                    Poll::Pending
                } else {
                    // EOF
                    Poll::Ready(Ok(0))
                };
            }

            let bytes_to_write = inner_buf.len().min(self.user_buf.len());

            // This is a convoluted way to copy the bytes from the inner buffer into the user's
            // buffer
            let (first_half, second_half) = inner_buf.as_slices();
            let bytes_to_write_from_first_half = first_half.len().min(bytes_to_write);
            let bytes_to_write_from_second_half =
                bytes_to_write.saturating_sub(bytes_to_write_from_first_half);
            self.user_buf[..bytes_to_write_from_first_half]
                .copy_from_slice(&first_half[..bytes_to_write_from_first_half]);
            self.user_buf[bytes_to_write_from_first_half..bytes_to_write]
                .copy_from_slice(&second_half[..bytes_to_write_from_second_half]);

            inner_buf.drain(..bytes_to_write);

            Poll::Ready(Ok(bytes_to_write))
        }
    }

    struct AsyncPipeWriteFuture<'a> {
        writer: &'a AsyncSender,
        user_buf: &'a [u8],
    }

    impl Future for AsyncPipeWriteFuture<'_> {
        type Output = io::Result<()>;

        fn poll(mut self: Pin<&mut Self>, _: &mut task::Context<'_>) -> Poll<Self::Output> {
            if !self.writer.inner.open.get() {
                return Poll::Ready(Err(io::Error::other("channel was closed")));
            }

            let mut pipe_buf = self.writer.inner.buf.borrow_mut();
            let capacity_left = pipe_buf.capacity() - pipe_buf.len();
            let bytes_to_write = self.user_buf.len().min(capacity_left);
            pipe_buf.extend(&self.user_buf[..bytes_to_write]);

            if self.user_buf.len() > capacity_left {
                self.user_buf = &self.user_buf[bytes_to_write..];

                // Continue writing later once capacity is available
                Poll::Pending
            } else {
                Poll::Ready(Ok(()))
            }
        }
    }

    #[cfg(test)]
    mod test {
        use super::*;

        #[test]
        fn test_block_on_concurrent_minimal_capacity() {
            test_block_on_concurrent(1);
        }

        #[test]
        fn test_block_on_concurrent_enough_capacity() {
   
```

### Core Architecture Module: `rustls-util/src/key_log_file.rs`
```
use core::fmt::{Debug, Formatter};
use std::env::var_os;
use std::ffi::OsString;
use std::fs::{File, OpenOptions};
use std::io;
use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::sync::Mutex;

use rustls::KeyLog;
#[cfg(feature = "tracing")]
use tracing::warn;

// Internal mutable state for KeyLogFile
struct KeyLogFileInner {
    file: Option<File>,
    buf: Vec<u8>,
}

impl KeyLogFileInner {
    fn new(var: Option<OsString>) -> Self {
        let Some(path) = &var else {
            return Self {
                file: None,
                buf: Vec::new(),
            };
        };

        let mut options = OpenOptions::new();
        options.append(true).create(true);
        // Key material is extremely sensitive. On Unix, create with owner-only
        // access so a default umask does not leave the file world-readable.
        #[cfg(unix)]
        options.mode(0o600);

        #[cfg_attr(not(feature = "tracing"), expect(clippy::manual_ok_err))]
        let file = match options.open(path) {
            Ok(f) => Some(f),
            #[cfg_attr(not(feature = "tracing"), expect(unused_variables))]
            Err(e) => {
                #[cfg(feature = "tracing")]
                warn!("unable to create key log file {path:?}: {e}");
                None
            }
        };

        Self {
            file,
            buf: Vec::new(),
        }
    }

    fn try_write(&mut self, label: &str, client_random: &[u8], secret: &[u8]) -> io::Result<()> {
        let Some(file) = &mut self.file else {
            return Ok(());
        };

        self.buf.clear();
        write!(self.buf, "{label} ")?;
        for b in client_random.iter() {
            write!(self.buf, "{b:02x}")?;
        }
        write!(self.buf, " ")?;
        for b in secret.iter() {
            write!(self.buf, "{b:02x}")?;
        }
        writeln!(self.buf)?;
        file.write_all(&self.buf)
    }
}

impl Debug for KeyLogFileInner {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("KeyLogFileInner")
            // Note: we omit self.buf deliberately as it may contain key data.
            .field("file", &self.file)
            .finish_non_exhaustive()
    }
}

/// [`KeyLog`] implementation that opens a file whose name is
/// given by the `SSLKEYLOGFILE` environment variable, and writes
/// keys into it.
///
/// If `SSLKEYLOGFILE` is not set, this does nothing.
///
/// If such a file cannot be opened, or cannot be written then
/// this does nothing but logs errors at warning-level.
///
/// # Security
///
/// Key material is extremely sensitive. Prefer not enabling `KeyLog`
/// outside of local debugging. On Unix, files created by this type use
/// owner-only permissions (`0o600`).
///
/// This type reads `SSLKEYLOGFILE` from the process environment with a
/// normal environment lookup. In a setuid/setgid (or otherwise elevated)
/// process, that variable may have been inherited from an untrusted parent
/// and could point at an attacker-chosen path. Applications that raise
/// privileges should clear sensitive environment variables, avoid compiling
/// key-log support into production builds, or supply their own [`KeyLog`]
/// implementation.
///
/// This util is intentionally small. It does not attempt a full
/// `secure_getenv`-style environment filter.
pub struct KeyLogFile(Mutex<KeyLogFileInner>);

impl KeyLogFile {
    /// Makes a new [`KeyLogFile`].
    ///
    /// The environment variable is inspected and the named file is opened during this call.
    pub fn new() -> Self {
        let var = var_os("SSLKEYLOGFILE");
        Self(Mutex::new(KeyLogFileInner::new(var)))
    }
}

impl KeyLog for KeyLogFile {
    fn log(&self, label: &str, client_random: &[u8], secret: &[u8]) {
        match self
            .0
            .lock()
            .unwrap()
            .try_write(label, client_random, secret)
        {
            Ok(()) => {}
            #[cfg_attr(not(feature = "tracing"), expect(unused_variables))]
            Err(e) => {
                #[cfg(feature = "tracing")]
                warn!("error writing to key log file: {e}");
            }
        }
    }
}

impl Debug for KeyLogFile {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        match self.0.try_lock() {
            Ok(key_log_file) => write!(f, "{key_log_file:?}"),
            Err(_) => write!(f, "KeyLogFile {{ <locked> }}"),
        }
    }
}

#[cfg(all(test, any(target_os = "linux", target_os = "macos")))]
mod tests {
    use std::os::unix::fs::PermissionsExt;
    use std::time::{SystemTime, UNIX_EPOCH};
    use std::{env, fs, process};

    use super::*;

    #[test]
    fn test_env_var_is_not_set() {
        let mut inner = KeyLogFileInner::new(None);
        assert!(
            inner
                .try_write("label", b"random", b"secret")
                .is_ok()
        );
    }

    #[test]
    fn test_env_var_cannot_be_opened() {
        let mut inner = KeyLogFileInner::new(Some("/dev/does-not-exist".into()));
        assert!(
            inner
                .try_write("label", b"random", b"secret")
                .is_ok()
        );
    }

    #[test]
    fn test_env_var_cannot_be_written() {
        #[cfg(target_os = "linux")]
        const UNWRITABLE_FILE: &str = "/dev/full";

        #[cfg(target_os = "macos")]
        const UNWRITABLE_FILE: &str = "/dev/urandom";

        let mut inner = KeyLogFileInner::new(Some(UNWRITABLE_FILE.into()));
        assert!(
            inner
                .try_write("label", b"random", b"secret")
                .is_err()
        );
    }

    #[test]
    fn test_created_file_has_owner_only_permissions() {
        let path = env::temp_dir().join(format!(
            "rustls-keylog-perm-{}-{}",
            process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_file(&path);

        let inner = KeyLogFileInner::new(Some(path.clone().into()));
        assert!(inner.file.is_some(), "key log file should open");

        let mode = fs::metadata(&path)
            .expect("metadata")
            .permissions()
            .mode()
            & 0o777;
        let _ = fs::remove_file(&path);

        assert_eq!(
            mode, 0o600,
            "SSLKEYLOGFILE must be created with mode 0o600, got {mode:#o}"
        );
    }
}

```

### Core Architecture Module: `rustls-util/src/lib.rs`
```
use std::io;

use rustls::{Connection, VecInput};

mod key_log_file;
pub use key_log_file::KeyLogFile;

mod stream;
pub use crate::stream::{Stream, StreamOwned};

/// This function uses `io` to complete any outstanding IO for
/// the connection.
///
/// This is a convenience function which solely uses other parts
/// of the public API.
///
/// `output` holds TLS data waiting to be sent to the peer: records
/// generated by the connection (for example by [`read_tls()`])
/// are appended to it, and bytes written to `io` are drained from its front.
///
/// What this means depends on the connection state:
///
/// - If the connection [`is_handshaking()`], then IO is performed until
///   the handshake is complete.
/// - Otherwise, if `output` is not empty, it is written until it is
///   all written.
/// - Otherwise, if [`wants_read()`] is true, [`VecInput::read()`] is invoked
///   once.
///
/// The return value is the number of bytes read from and written
/// to `io`, respectively. Once both `read()` and `write()` yield `WouldBlock`,
/// this function will propagate the error.
///
/// Errors from TLS record handling (i.e., from [`read_tls()`])
/// are wrapped in an `io::ErrorKind::InvalidData`-kind error.
///
/// [`is_handshaking()`]: rustls::CommonState::is_handshaking
/// [`wants_read()`]: rustls::Connection::wants_read
/// [`read_tls()`]: rustls::Connection::read_tls
pub fn complete_io(
    io: &mut (impl io::Read + io::Write),
    input: &mut VecInput,
    received_plaintext: &mut Vec<u8>,
    output: &mut Vec<u8>,
    conn: &mut impl Connection,
) -> Result<(usize, usize), io::Error> {
    let mut eof = false;
    let mut wrlen = 0;
    let mut rdlen = 0;
    loop {
        let (mut blocked_write, mut blocked_read) = (None, None);
        let until_handshaked = conn.is_handshaking();

        if output.is_empty() && !conn.wants_read() {
            // We will make no further progress.
            return Ok((rdlen, wrlen));
        }

        let mut sent = 0;
        while sent < output.len() {
            match io.write(&output[sent..]) {
                Ok(0) => {
                    output.drain(..sent);
                    io.flush()?;
                    return Ok((rdlen, wrlen)); // EOF.
                }
                Ok(n) if n > output.len() - sent => {
                    // This is really unrecoverable, since the amount of data written
                    // is now unknown.  Consume all the potentially-written data in
                    // case the caller ignores the error.
                    // See <https://github.com/rustls/rustls/issues/2316> for background.
                    let available = output.len() - sent;
                    output.clear();
                    return Err(io::Error::other(format!(
                        "illegal write() return value ({n} > {available})"
                    )));
                }
                Ok(n) => {
                    wrlen += n;
                    sent += n;
                }
                Err(err) if err.kind() == io::ErrorKind::WouldBlock => {
                    blocked_write = Some(err);
                    break;
                }
                Err(err) => {
                    output.drain(..sent);
                    return Err(err);
                }
            }
        }
        output.drain(..sent);
        if wrlen > 0 {
            io.flush()?;
        }

        if !until_handshaked && wrlen > 0 {
            return Ok((rdlen, wrlen));
        }

        // If we want to write, but are WouldBlocked by the underlying IO, *and*
        // have no desire to read; that is everything.
        if let (Some(_), false) = (&blocked_write, conn.wants_read()) {
            return match wrlen {
                0 => Err(blocked_write.unwrap()),
                _ => Ok((rdlen, wrlen)),
            };
        }

        while !eof && conn.wants_read() {
            let read_size = match input.read(io) {
                Ok(0) => {
                    eof = true;
                    Some(0)
                }
                Ok(n) => {
                    rdlen += n;
                    Some(n)
                }
                Err(err) if err.kind() == io::ErrorKind::WouldBlock => {
                    blocked_read = Some(err);
                    break;
                }
                Err(err) if err.kind() == io::ErrorKind::Interrupted => None, // nothing to do
                Err(err) => return Err(err),
            };
            if read_size.is_some() {
                break;
            }
        }

        let error = conn
            .read_tls(input, output)
            .handle_all(received_plaintext)
            .err();

        if let Some(e) = error {
            // In case we have an alert to send describing this error, try a last-gasp
            // write -- but don't predate the primary error.
            let _ignored = write_and_drain(io, output);
            let _ignored = io.flush();
            return Err(io::Error::new(io::ErrorKind::InvalidData, e));
        };

        // If we want to read, but are WouldBlocked by the underlying IO, *and*
        // have no desire to write; that is everything.
        if output.is_empty()
            && let Some(error) = blocked_read
        {
            return match rdlen {
                0 => Err(error),
                _ => Ok((rdlen, wrlen)),
            };
        }

        // if we're doing IO until handshaked, and we believe we've finished handshaking,
        // but read_tls() has queued TLS data to send, loop around again to write
        // the queued messages.
        if until_handshaked && !conn.is_handshaking() && !output.is_empty() {
            continue;
        }

        let blocked = blocked_write.zip(blocked_read);
        match (eof, until_handshaked, conn.is_handshaking(), blocked) {
            (_, true, false, _) => return Ok((rdlen, wrlen)),
            (_, _, _, Some((e, _))) if rdlen == 0 && wrlen == 0 => return Err(e),
            (_, _, _, Some(_)) => return Ok((rdlen, wrlen)),
            (_, false, _, _) => return Ok((rdlen, wrlen)),
            (true, true, true, _) => return Err(io::Error::from(io::ErrorKind::UnexpectedEof)),
            _ => {}
        }
    }
}

/// Write the front of `output` to `io`, draining the bytes that were written.
fn write_and_drain(io: &mut dyn io::Write, output: &mut Vec<u8>) -> io::Result<usize> {
    let n = io.write(output)?;
    if n > output.len() {
        // This is really unrecoverable, since the amount of data written
        // is now unknown.  Consume all the potentially-written data in
        // case the caller ignores the error.
        // See <https://github.com/rustls/rustls/issues/2316> for background.
        let available = output.len();
        output.clear();
        return Err(io::Error::other(format!(
            "illegal write() return value ({n} > {available})"
        )));
    }
    output.drain(..n);
    Ok(n)
}

```

### Core Architecture Module: `rustls-util/src/stream.rs`
```
#![allow(clippy::std_instead_of_core)] // awaits core::io::IoSlice in stable (1.98)
use std::io::{BufRead, Error, ErrorKind, IoSlice, Read, Result, Write};

use rustls::crypto::cipher::OutboundPlain;
use rustls::{Connection, TlsInputBuffer, VecInput};

use crate::complete_io;

/// This type implements `io::Read` and `io::Write`, encapsulating
/// a Connection `C` and an underlying transport `T`, such as a socket.
///
/// Relies on [`complete_io()`] to perform the necessary I/O.
///
/// This allows you to use a rustls Connection like a normal stream.
///
/// [`complete_io()`]: crate::complete_io()
#[expect(clippy::exhaustive_structs)]
#[derive(Debug)]
pub struct Stream<'a, C: 'a + ?Sized, T: 'a + Read + Write + ?Sized> {
    /// Our TLS connection
    pub conn: &'a mut C,

    /// The underlying transport, like a socket
    pub sock: &'a mut T,

    /// The input buffer
    pub input: &'a mut VecInput,

    /// The buffer to store received plaintext
    pub received_plaintext: &'a mut Vec<u8>,

    /// The output buffer, holding TLS data waiting to be sent
    pub output: &'a mut Vec<u8>,

    /// Limit on the size of `output`, in bytes
    ///
    /// If the transport does not accept data fast enough, buffered TLS output accumulates in
    /// `output`. Once its size reaches this limit, `write()` encrypts only as much plaintext as
    /// fits under the limit and returns the resulting short write count, or fails with
    /// [`ErrorKind::WouldBlock`] if nothing can be buffered. `output` may exceed the limit by the
    /// encryption overhead of the final record.
    ///
    /// Defaults to 64KB.
    pub limit: usize,
}

impl<'a, C, T> Stream<'a, C, T>
where
    C: 'a + Connection,
    T: 'a + Read + Write,
{
    /// Make a new Stream using the Connection `conn` and socket-like object
    /// `sock`.  This does not fail and does no IO.
    pub fn new(
        input: &'a mut VecInput,
        received_plaintext: &'a mut Vec<u8>,
        output: &'a mut Vec<u8>,
        conn: &'a mut C,
        sock: &'a mut T,
    ) -> Self {
        Self {
            conn,
            sock,
            input,
            received_plaintext,
            output,
            limit: DEFAULT_BUFFER_LIMIT,
        }
    }

    /// If we're handshaking, complete all the IO for that.
    /// If we have data to write, write it all.
    fn complete_prior_io(&mut self) -> Result<()> {
        if self.conn.is_handshaking() {
            complete_io(
                self.sock,
                self.input,
                self.received_plaintext,
                self.output,
                self.conn,
            )?;
        }

        if !self.output.is_empty() {
            complete_io(
                self.sock,
                self.input,
                self.received_plaintext,
                self.output,
                self.conn,
            )?;
        }

        Ok(())
    }

    fn prepare_read(&mut self) -> Result<()> {
        self.complete_prior_io()?;

        // We call complete_io() in a loop since a single call may read only
        // a partial packet from the underlying transport. A full packet is
        // needed to get more plaintext, which we must do if EOF has not been
        // hit. We stop as soon as we have some plaintext to return, since
        // `wants_read()` stays true even when plaintext is available.
        while self.received_plaintext.is_empty() && self.conn.wants_read() {
            if complete_io(
                self.sock,
                self.input,
                self.received_plaintext,
                self.output,
                self.conn,
            )?
            .0 == 0
            {
                break;
            }
        }

        // If we have no plaintext to return and the peer closed the connection without
        // sending a `close_notify`, surface that as an unexpected EOF.  A clean closure
        // (via `close_notify`) is instead reported as `Ok(0)`/an empty buffer.
        if self.received_plaintext.is_empty() && self.input.has_seen_eof() {
            return Err(Error::new(
                ErrorKind::UnexpectedEof,
                "peer closed connection without sending TLS close_notify",
            ));
        }

        Ok(())
    }
}

impl<'a, C, T> Read for Stream<'a, C, T>
where
    C: 'a + Connection,
    T: 'a + Read + Write,
{
    fn read(&mut self, buf: &mut [u8]) -> Result<usize> {
        self.prepare_read()?;
        let len = Ord::min(buf.len(), self.received_plaintext.len());
        let Some((src, _)) = self
            .received_plaintext
            .split_at_checked(len)
        else {
            return Ok(0);
        };

        let Some((dst, _)) = buf.split_at_mut_checked(len) else {
            return Ok(0);
        };

        dst.copy_from_slice(src);
        self.received_plaintext.drain(..len);
        Ok(len)
    }
}

impl<'a, C, T> BufRead for Stream<'a, C, T>
where
    C: 'a + Connection,
    T: 'a + Read + Write,
{
    fn fill_buf(&mut self) -> Result<&[u8]> {
        self.prepare_read()?;
        Ok(self.received_plaintext)
    }

    fn consume(&mut self, amt: usize) {
        self.received_plaintext.drain(..amt);
    }
}

impl<'a, C, T> Write for Stream<'a, C, T>
where
    C: 'a + Connection,
    T: 'a + Read + Write,
{
    fn write(&mut self, buf: &[u8]) -> Result<usize> {
        self.complete_prior_io()?;
        if self.conn.is_handshaking() {
            return Err(ErrorKind::WouldBlock.into());
        }

        let len = Ord::min(
            buf.len(),
            self.limit
                .saturating_sub(self.output.len()),
        );
        if len == 0 && !buf.is_empty() {
            return Err(ErrorKind::WouldBlock.into());
        }

        self.conn
            .write((&buf[..len]).into(), self.output)
            .map_err(|err| Error::new(ErrorKind::InvalidData, err))?;

        // Try to write the underlying transport here, but don't let
        // any errors mask the fact we've consumed `buf[..len]`.
        // Callers will learn of permanent errors on the next call.
        let _ = complete_io(
            self.sock,
            self.input,
            self.received_plaintext,
            self.output,
            self.conn,
        );

        Ok(len)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> Result<usize> {
        self.complete_prior_io()?;
        if self.conn.is_handshaking() {
            return Err(ErrorKind::WouldBlock.into());
        }

        let mut available = self
            .limit
            .saturating_sub(self.output.len());
        let mut len = 0;
        let mut slices = Vec::with_capacity(bufs.len());
        for buf in bufs {
            let take = Ord::min(buf.len(), available);
            slices.push(&buf[..take]);
            len += take;
            available -= take;
        }

        if len == 0 && bufs.iter().any(|buf| !buf.is_empty()) {
            return Err(ErrorKind::WouldBlock.into());
        }

        self.conn
            .write(OutboundPlain::new(&slices), self.output)
            .map_err(|err| Error::new(ErrorKind::InvalidData, err))?;

        // Try to write the underlying transport here, but don't let
        // any errors mask the fact we've consumed `len` bytes.
        // Callers will learn of permanent errors on the next call.
        let _ = complete_io(
            self.sock,
            self.input,
            self.received_plaintext,
            self.output,
            self.conn,
        );

        Ok(len)
    }

    fn flush(&mut self) -> Result<()> {
        self.complete_prior_io()
    }
}

/// This type implements `io::Read` and `io::Write`, encapsulating
/// and owning a Connection `C` and an underlying transport `T`, such as a socket.
///
/// Relies on [`complete_io()`] to perform the necessary I/O.
///
/// This allows you to use a rustls Connection like a normal stream.
///
/// [`complete_io()`]: crate::complete_io()
#[expect(clippy::exhaustive_structs)]
#[derive(Debug)]
pub struct StreamOwned<C: Sized, T: Read + Write + Sized> {
    /// Our connection
    pub conn: C,

    /// The underlying transport, like a socket
    pub sock: T,

    /// The input buffer
    pub input: VecInput,

    /// The buffer to store received plaintext
    pub received_plaintext: Vec<u8>,

    /// The output buffer, holding TLS data waiting to be sent
    pub output: Vec<u8>,

    /// Limit on the size of `output`, in bytes
    ///
    /// If the transport does not accept data fast enough, buffered TLS output accumulates in
    /// `output`. Once its size reaches this limit, `write()` encrypts only as much plaintext as
    /// fits under the limit and returns the resulting short write count, or fails with
    /// [`ErrorKind::WouldBlock`] if nothing can be buffered. `output` may exceed the limit by the
    /// encryption overhead of the final record.
    ///
    /// Defaults to 64KB.
    pub limit: usize,
}

impl<C, T> StreamOwned<C, T>
where
    C: Connection,
    T: Read + Write,
{
    /// Make a new StreamOwned taking the Connection `conn` and socket-like
    /// object `sock`.  This does not fail and does no IO.
    ///
    /// `output` may contain TLS data already generated by the connection,
    /// such as the initial `ClientHello`.
    ///
    /// This is the same as `Stream::new` except `conn` and `sock` are
    /// moved into the StreamOwned.
    pub fn new(conn: C, sock: T, output: Vec<u8>) -> Self {
        Self {
            conn,
            sock,
            input: VecInput::default(),
            received_plaintext: Vec::new(),
            output,
            limit: DEFAULT_BUFFER_LIMIT,
        }
    }

    /// Get a reference to the underlying socket
    pub fn get_ref(&self) -> &T {
        &self.sock
    }

    /// Get a mutable reference to the underlying socket
    pub fn get_mut(&mut self) -> &mut T {
        &mut self.sock
    }

    /// Destructure this object into its `conn` and `sock` parts
    pub fn into_parts(self) -> 
```

### Core Architecture Module: `rustls/src/common_state.rs`
```
use alloc::boxed::Box;
use alloc::vec::Vec;
use core::fmt;
use core::ops::{Deref, DerefMut, Range};

use pki_types::{DnsName, FipsStatus};

use crate::client::EchStatus;
use crate::conn::{DataKind, Exporter, KeyingMaterialExporter, ReceivePath, SendOutput, SendPath};
use crate::crypto::cipher::{EncodableVersion, Payload};
use crate::crypto::kx::SupportedKxGroup;
use crate::enums::{ApplicationProtocol, ProtocolVersion};
use crate::error::{AlertDescription, ApiMisuse, Error};
use crate::hash_hs::HandshakeHash;
use crate::msgs::{
    AlertLevel, Codec, Delocator, HandshakeMessagePayload, Locator, Message, MessagePayload,
};
use crate::quic::{self, QuicOutput};
use crate::suites::SupportedCipherSuite;
use crate::verify::VerifiedIdentity;

/// Connection state common to both client and server connections.
pub struct CommonState {
    pub(crate) outputs: ConnectionOutputs,
    pub(crate) send: SendPath,
    pub(crate) recv: ReceivePath,
    pub(crate) fips: FipsStatus,
}

impl CommonState {
    pub(crate) fn new(side: Side, fips: FipsStatus) -> Self {
        Self {
            outputs: ConnectionOutputs::default(),
            send: SendPath::default(),
            recv: ReceivePath::new(side),
            fips,
        }
    }

    pub(crate) fn early_exporter(&mut self) -> Result<KeyingMaterialExporter, Error> {
        match self.early_exporter.take() {
            Some(inner) => Ok(KeyingMaterialExporter { inner }),
            None => Err(ApiMisuse::ExporterAlreadyUsed.into()),
        }
    }

    /// Writes a `close_notify` warning alert to into the `tls` buffer.
    ///
    /// This informs the peer that the connection is being closed. Does nothing if any
    /// `close_notify` or fatal alert was already sent.
    pub fn send_close_notify(&mut self, tls: &mut Vec<u8>) -> Result<(), Error> {
        self.send.send_close_notify(tls)
    }

    /// Returns true if the connection is currently performing the TLS handshake.
    ///
    /// During this time plaintext written to the connection is buffered in memory. After
    /// [`Connection::read_tls()`] has been called, this might start to return `false`
    /// while the final handshake packets still need to be extracted from the connection's buffers.
    ///
    /// [`Connection::read_tls()`]: crate::Connection::read_tls
    pub fn is_handshaking(&self) -> bool {
        !(self.send.may_send_application_data && self.recv.may_receive_application_data)
    }
}

impl Deref for CommonState {
    type Target = ConnectionOutputs;

    fn deref(&self) -> &Self::Target {
        &self.outputs
    }
}

impl DerefMut for CommonState {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.outputs
    }
}

impl fmt::Debug for CommonState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CommonState")
            .finish_non_exhaustive()
    }
}

/// Facts about the connection learned through the handshake.
#[derive(Default)]
pub struct ConnectionOutputs {
    negotiated_version: Option<ProtocolVersion>,
    handshake_kind: Option<HandshakeKind>,
    suite: Option<SupportedCipherSuite>,
    negotiated_kx_group: Option<&'static dyn SupportedKxGroup>,
    alpn_protocol: Option<ApplicationProtocol<'static>>,
    peer_identity: Option<VerifiedIdentity<'static>>,
    extended_main_secret: Option<bool>,
    pub(crate) exporter: Option<Box<dyn Exporter>>,
    pub(crate) early_exporter: Option<Box<dyn Exporter>>,
}

impl ConnectionOutputs {
    /// Retrieves the certificate chain or the raw public key used by the peer to authenticate.
    ///
    /// This is made available for both full and resumed handshakes.
    ///
    /// For clients, this is the identity of the server. For servers, this is the identity of the
    /// client, if client authentication was completed.
    ///
    /// The return value is None until this value is available.
    pub fn peer_identity(&self) -> Option<&VerifiedIdentity<'static>> {
        self.peer_identity.as_ref()
    }

    /// Retrieves the protocol agreed with the peer via ALPN.
    ///
    /// A return value of `None` after handshake completion
    /// means no protocol was agreed (because no protocols
    /// were offered or accepted by the peer).
    pub fn alpn_protocol(&self) -> Option<&ApplicationProtocol<'static>> {
        self.alpn_protocol.as_ref()
    }

    /// Retrieves the cipher suite agreed with the peer.
    ///
    /// This returns None until the cipher suite is agreed.
    pub fn negotiated_cipher_suite(&self) -> Option<SupportedCipherSuite> {
        self.suite
    }

    /// Retrieves the key exchange group agreed with the peer.
    ///
    /// This function may return `None` depending on the state of the connection,
    /// the type of handshake, and the protocol version.
    ///
    /// If [`CommonState::is_handshaking()`] is true this function will return `None`.
    /// Similarly, if the [`ConnectionOutputs::handshake_kind()`] is [`HandshakeKind::Resumed`]
    /// and the [`ConnectionOutputs::protocol_version()`] is TLS 1.2, then no key exchange will have
    /// occurred and this function will return `None`.
    pub fn negotiated_key_exchange_group(&self) -> Option<&'static dyn SupportedKxGroup> {
        self.negotiated_kx_group
    }

    /// Retrieves the protocol version agreed with the peer.
    ///
    /// This returns `None` until the version is agreed.
    pub fn protocol_version(&self) -> Option<ProtocolVersion> {
        self.negotiated_version
    }

    /// Whether the Extended Main Secret extension was negotiated.
    ///
    /// Returns:
    /// - `None` until the handshake reaches the point where this is known.
    /// - `None` for TLS 1.3, where the extension does not apply.
    /// - `Some(true)` for TLS 1.2 if the extension was negotiated.
    /// - `Some(false)` otherwise.
    pub fn extended_main_secret(&self) -> Option<bool> {
        self.extended_main_secret
    }

    /// Which kind of handshake was performed.
    ///
    /// This tells you whether the handshake was a resumption or not.
    ///
    /// This will return `None` before it is known which sort of
    /// handshake occurred.
    pub fn handshake_kind(&self) -> Option<HandshakeKind> {
        self.handshake_kind
    }

    pub(super) fn into_kernel_parts(self) -> Option<(ProtocolVersion, SupportedCipherSuite)> {
        let Self {
            negotiated_version,
            suite,
            ..
        } = self;

        match (negotiated_version, suite) {
            (Some(version), Some(suite)) => Some((version, suite)),
            _ => None,
        }
    }
}

impl ConnectionOutput for ConnectionOutputs {
    fn handle(&mut self, ev: OutputEvent<'_>) {
        match ev {
            OutputEvent::ApplicationProtocol(protocol) => {
                self.alpn_protocol = Some(ApplicationProtocol::from(protocol.as_ref()).to_owned())
            }
            OutputEvent::CipherSuite(suite) => self.suite = Some(suite),
            OutputEvent::EarlyExporter(exporter) => self.early_exporter = Some(exporter),
            OutputEvent::Exporter(exporter) => self.exporter = Some(exporter),
            OutputEvent::ExtendedMainSecret(ems) => self.extended_main_secret = Some(ems),
            OutputEvent::HandshakeKind(hk) => {
                assert!(self.handshake_kind.is_none());
                self.handshake_kind = Some(hk);
            }
            OutputEvent::KeyExchangeGroup(kxg) => {
                assert!(self.negotiated_kx_group.is_none());
                self.negotiated_kx_group = Some(kxg);
            }
            OutputEvent::PeerIdentity(identity) => self.peer_identity = Some(identity),
            OutputEvent::ProtocolVersion(ver) => {
                self.negotiated_version = Some(ver);
            }
        }
    }
}

impl fmt::Debug for ConnectionOutputs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self {
            negotiated_version,
            handshake_kind,
            suite,
            negotiated_kx_group,
            alpn_protocol,
            peer_identity,
            extended_main_secret,
            exporter: _,
            early_exporter: _,
        } = self;
        f.debug_struct("ConnectionOutputs")
            .field("negotiated_version", negotiated_version)
            .field("handshake_kind", handshake_kind)
            .field("suite", suite)
            .field("negotiated_kx_group", negotiated_kx_group)
            .field("alpn_protocol", alpn_protocol)
            .field("peer_identity", peer_identity)
            .field("extended_main_secret", extended_main_secret)
            .finish_non_exhaustive()
    }
}

/// Send an alert via `output` if `error` specifies one.
pub(crate) fn maybe_send_fatal_alert(
    send: &mut dyn SendOutput,
    error: &Error,
    tls: &mut Vec<u8>,
) -> Result<(), Error> {
    let Ok(alert) = AlertDescription::try_from(error) else {
        return Ok(());
    };
    send.send_alert(AlertLevel::Fatal, alert, tls)
}

/// Describes which sort of handshake happened.
#[derive(Debug, PartialEq, Clone, Copy)]
#[non_exhaustive]
pub enum HandshakeKind {
    /// A full handshake.
    ///
    /// This is the typical TLS connection initiation process when resumption is
    /// not available, and the initial `ClientHello` was accepted by the server.
    Full,

    /// A full TLS1.3 handshake, with an extra round-trip for a `HelloRetryRequest`.
    ///
    /// The server can respond with a `HelloRetryRequest` if the initial `ClientHello`
    /// is unacceptable for several reasons, the most likely being if no supported key
    /// shares were offered by the client.
    FullWithHelloRetryRequest,

    /// A resumed handshake.
    ///
    /// Resumed handshakes involve fewer round trips and less cryptography than
    /// full ones, but can only happen when the peers have previously done a full
    /// handshake together, and then remember data about it.
    Resumed,

    /// A resumed handshake, with a
```

### Core Architecture Module: `admin/threads-seq.rs`
```
#!/usr/bin/env -S cargo +nightly --quiet -Zscript

//! # `admin/thread-seq N`
//!
//! This program prints a sequence of N integers for multithreaded
//! performance testing.  The integers are numbers of threads to
//! be sampled in a test.  The goal is to assist in graphing
//! how per-thread throughput relates to concurrency.
//!
//! The sequence is (at most) length N, starts at 2, includes the
//! number of CPU cores, and ends at 1.5 the number of CPU cores.
//! It does not have repeated items.
//!
//! We exceed the number of cores specifically to see the
//! "elbow" in the graph, when the number of threads tested
//! exceeds the number of cores.  (This is good because otherwise
//! -- assuming the software under test is perfectly scalable --
//! the graph would be a straight line parallel with the x axis.)

use std::{cmp, env, error, num::NonZeroUsize, str::FromStr, thread};

fn main() -> Result<(), Box<dyn error::Error + Send + Sync + 'static>> {
    let mut args = env::args();
    args.next(); // skip argv[0]
    let count = args
        .next()
        .map(|c| NonZeroUsize::from_str(&c))
        .transpose()?
        .unwrap_or(NonZeroUsize::new(16).unwrap())
        .get();

    let default_cpus = thread::available_parallelism()?;
    let cpus = env::var("CPU_COUNT")
        .map(|c| NonZeroUsize::from_str(&c))
        .unwrap_or(Ok(default_cpus))?
        .get();

    let end = (cpus as f64 * 1.5).floor() as usize;

    let before_count = (count as f64 * 0.75).floor() as usize;
    let after_count = count - before_count;

    let before = (2..cpus).step_by(cmp::max(1, cpus / before_count));
    let after = (cpus..end).step_by(cmp::max(1, (end - cpus) / after_count));

    for x in before.chain(after) {
        print!("{} ", x);
    }
    println!();
    Ok(())
}

```

### Core Architecture Module: `bogo/check.py`
```
"""
This script post-processes bogo pass/fail logs to help
maintain config.json.

Run:

    $ ./runme | python check.py
"""

import re
import json
import fnmatch
import sys

config = json.load(open("config.json"))
test_error_set = set(config["TestErrorMap"].keys())
test_local_error_set = set(config["TestLocalErrorMap"].keys())

all_tests = set()
failing_tests = set()
unimpl_tests = set()
disabled_tests = set()
passed_tests = set()

for line in sys.stdin:
    m = re.match(r"^(PASSED|UNIMPLEMENTED|FAILED|DISABLED) \((.*)\)$", line.strip())
    if m:
        status, name = m.groups()
        if name in test_error_set:
            test_error_set.remove(name)
        if name in test_local_error_set:
            test_local_error_set.remove(name)
        all_tests.add(name)
        if status == "FAILED":
            failing_tests.add(name)
        elif status == "UNIMPLEMENTED":
            unimpl_tests.add(name)
        elif status == "DISABLED":
            disabled_tests.add(name)
        elif status == "PASSED":
            passed_tests.add(name)

if disabled_tests:
    for disabled_glob in sorted(config["DisabledTests"].keys()):
        tests_matching_glob = fnmatch.filter(disabled_tests, disabled_glob)
        if not tests_matching_glob:
            print("DisabledTests glob", disabled_glob, "matches no tests")
else:
    # to check DisabledTests, apply patch below to bogo
    print("(DisabledTests unchecked)")

print(len(all_tests), "total tests")
print(len(passed_tests), "passed")
print(len(failing_tests), "tests failing")
print(len(unimpl_tests), "tests not supported")

if test_error_set:
    print("unknown TestErrorMap keys", list(sorted(test_error_set)))
if test_local_error_set:
    print("unknown TestLocalErrorMap keys", list(sorted(test_local_error_set)))

MENTION_DISABLED_TESTS_PATCH = """
diff --git a/ssl/test/runner/runner.go b/ssl/test/runner/runner.go
index eb6cc53..e51649a 100644
--- a/ssl/test/runner/runner.go
+++ b/ssl/test/runner/runner.go
@@ -20830,6 +20830,7 @@ func main() {
                                }

                                if isDisabled {
+                                       fmt.Printf("DISABLED (%s)\n", testCases[i].name)
                                        matched = false
                                        break
                                }
"""

```

### Core Architecture Module: `bogo/src/client.rs`
```
use core::fmt;
use core::hash::Hasher;
use core::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use rustls::client::danger::{HandshakeSignatureValid, ServerIdentity, ServerVerifier};
use rustls::client::{
    self, ClientSessionKey, CredentialRequest, EchConfig, EchGreaseConfig, EchMode, Resumption,
    Tls12Resumption, Tls13Session, WebPkiServerVerifier,
};
use rustls::crypto::hpke::HpkePublicKey;
use rustls::crypto::kx::NamedGroup;
use rustls::crypto::{
    Credentials, CryptoProvider, Identity, SelectedCredential, SignatureScheme, Signer, SigningKey,
    VerifiedIdentity,
};
use rustls::enums::{ApplicationProtocol, CertificateType};
use rustls::error::{ApiMisuse, CertificateError, EncryptedClientHelloError};
use rustls::pki_types::{ServerName, SubjectPublicKeyInfoDer};
use rustls::server::danger::SignatureVerificationInput;
use rustls::{ClientConfig, DistinguishedName, Error};

use super::compress::{CompressionAlgs, ExpandingAlgorithm, RandomAlgorithm, ShrinkingAlgorithm};
use super::opts::Options;
use super::{
    ALL_HPKE_SUITES, Credential, GREASE_25519_PUBKEY, GREASE_HPKE_SUITE, KeyLogMemo,
    load_root_certs, lookup_scheme, quit,
};

pub(crate) fn config(opts: &Options, key_log: &Arc<KeyLogMemo>) -> Arc<ClientConfig> {
    let provider = Arc::new(opts.provider());
    let cfg = ClientConfig::builder(provider.clone());

    let cfg = if opts.selected_provider.supports_ech() {
        let ech_cfg = ClientConfig::builder(
            CryptoProvider {
                tls12_cipher_suites: Default::default(),
                ..opts.provider()
            }
            .into(),
        );

        if let Some(ech_config_list) = &opts.ech_config_list {
            let ech_mode = match EchConfig::new(ech_config_list.clone(), ALL_HPKE_SUITES) {
                Ok(ech_config) => EchMode::from(ech_config),
                Err(Error::InvalidEncryptedClientHello(
                    EncryptedClientHelloError::NoCompatibleConfig,
                )) if opts.reject_unusable_ech_config => quit(":UNUSABLE_ECH_CONFIG_LIST:"),
                Err(_) => quit(":INVALID_ECH_CONFIG_LIST:"),
            };

            ech_cfg.with_ech(ech_mode)
        } else if opts.reject_unusable_ech_config {
            // no ech_config_list is a trivial rejection (boringssl has a more complex API that is tested here)
            quit(":UNUSABLE_ECH_CONFIG_LIST:");
        } else if opts.enable_ech_grease {
            let ech_mode = EchMode::Grease(EchGreaseConfig::new(
                GREASE_HPKE_SUITE,
                HpkePublicKey(GREASE_25519_PUBKEY.to_vec()),
            ));

            ech_cfg.with_ech(ech_mode)
        } else {
            cfg
        }
    } else {
        cfg
    };

    let cfg = cfg
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(DummyServerAuth::new(
            &opts.trusted_cert_file,
            opts.ocsp,
            opts.expected_server_names(),
            &provider,
        )));

    let mut cfg = match opts.credentials.configured() {
        true => {
            let mut resolver = MultipleClientCredentialResolver {
                expect_selected: opts.credentials.expect_selected,
                ..Default::default()
            };

            if opts.credentials.default.configured() {
                let cred = &opts.credentials.default;
                resolver.set_default(cred.load_from_file(&provider), cred)
            }

            for cred in opts.credentials.additional.iter() {
                resolver.add(cred.load_from_file(&provider), cred);
            }

            cfg.with_client_credential_resolver(Arc::new(resolver))
                .unwrap()
        }
        false => match cfg.with_no_client_auth() {
            Ok(cfg) => cfg,
            Err(Error::ApiMisuse(ApiMisuse::NoCipherSuitesConfigured))
                if opts.reject_unusable_ech_config =>
            {
                quit(":UNUSABLE_ECH_CONFIG_LIST:")
            }
            Err(other) => panic!("unexpected error {other:?}"),
        },
    };

    cfg.resumption = Resumption::store(ClientCacheWithSpecificKxHints::new(
        opts.resumption_delay,
        opts.server_supported_group_hint,
    ))
    .tls12_resumption(match opts.tickets {
        true => Tls12Resumption::SessionIdOrTickets,
        false => Tls12Resumption::SessionIdOnly,
    });
    cfg.enable_sni = opts.use_sni;
    cfg.max_fragment_size = opts.max_fragment;
    cfg.require_ems = opts.require_ems;
    if opts.export_traffic_secrets {
        cfg.key_log = key_log.clone();
    }

    if !opts.protocols.is_empty() {
        cfg.alpn_protocols = opts
            .protocols
            .iter()
            .map(|proto| ApplicationProtocol::from(proto.as_bytes()).to_owned())
            .collect();
    }

    if opts.enable_early_data {
        cfg.enable_early_data = true;
    }

    match opts.install_cert_compression_algs {
        CompressionAlgs::All => {
            cfg.cert_decompressors =
                vec![&ExpandingAlgorithm, &ShrinkingAlgorithm, &RandomAlgorithm];
            cfg.cert_compressors = vec![&ExpandingAlgorithm, &ShrinkingAlgorithm, &RandomAlgorithm];
        }
        CompressionAlgs::One(ShrinkingAlgorithm::ALGORITHM) => {
            cfg.cert_decompressors = vec![&ShrinkingAlgorithm];
            cfg.cert_compressors = vec![&ShrinkingAlgorithm];
        }
        CompressionAlgs::None => {}
        _ => unimplemented!(),
    }

    Arc::new(cfg)
}

#[derive(Debug)]
struct DummyServerAuth {
    parent: Arc<dyn ServerVerifier>,
    ocsp: OcspValidation,
    expect_server_names: Vec<ServerName<'static>>,
    server_name_index: AtomicUsize,
}

impl DummyServerAuth {
    fn new(
        trusted_cert_file: &str,
        ocsp: OcspValidation,
        expect_server_names: Vec<ServerName<'static>>,
        provider: &CryptoProvider,
    ) -> Self {
        Self {
            parent: Arc::new(
                WebPkiServerVerifier::builder(load_root_certs(trusted_cert_file), provider)
                    .build()
                    .unwrap(),
            ),
            ocsp,
            expect_server_names,
            server_name_index: AtomicUsize::new(0),
        }
    }
}

impl ServerVerifier for DummyServerAuth {
    fn verify_identity<'a>(
        &self,
        identity: &ServerIdentity<'a, '_>,
    ) -> Result<VerifiedIdentity<'a>, Error> {
        if !self.expect_server_names.is_empty() {
            let expect_server_name = &self.expect_server_names[self
                .server_name_index
                .fetch_add(1, Ordering::SeqCst)];
            assert_eq!(identity.server_name, expect_server_name);
        }
        if let OcspValidation::Reject = self.ocsp {
            return Err(CertificateError::InvalidOcspResponse.into());
        }
        Ok(VerifiedIdentity::assertion(identity.identity.clone()))
    }

    fn verify_tls12_signature(
        &self,
        input: &SignatureVerificationInput<'_>,
    ) -> Result<HandshakeSignatureValid, Error> {
        self.parent
            .verify_tls12_signature(input)
    }

    fn verify_tls13_signature(
        &self,
        input: &SignatureVerificationInput<'_>,
    ) -> Result<HandshakeSignatureValid, Error> {
        self.parent
            .verify_tls13_signature(input)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.parent.supported_verify_schemes()
    }

    fn request_ocsp_response(&self) -> bool {
        true
    }

    fn hash_config(&self, h: &mut dyn Hasher) {
        self.parent.hash_config(h)
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub(crate) enum OcspValidation {
    /// Totally ignore `ocsp_response` value
    #[default]
    None,

    /// Return an error (irrespective of `ocsp_response` value)
    Reject,
}

#[derive(Debug, Default)]
struct MultipleClientCredentialResolver {
    additional: Vec<ClientCert>,
    default: Option<ClientCert>,
    expect_selected: Option<isize>,
}

impl MultipleClientCredentialResolver {
    fn add(&mut self, key: Credentials, meta: &Credential) {
        self.additional
            .push(ClientCert::new(key, meta));
    }

    fn set_default(&mut self, key: Credentials, meta: &Credential) {
        self.default = Some(ClientCert::new(key, meta));
    }
}

impl client::ClientCredentialResolver for MultipleClientCredentialResolver {
    fn resolve(&self, request: &CredentialRequest<'_>) -> Option<SelectedCredential> {
        // `sig_schemes` is in server preference order, so respect that.
        let sig_schemes = request.signature_schemes();
        let root_hint_subjects = request.root_hint_subjects();
        for sig_scheme in sig_schemes.iter().copied() {
            for (i, cert) in self.additional.iter().enumerate() {
                // if the server sends any issuer hints, respect them
                if cert.must_match_issuer && !cert.any_issuer_matches_hints(root_hint_subjects) {
                    continue;
                }

                if let Some(signer) = cert.certkey.signer(&[sig_scheme]) {
                    assert!(
                        Some(i as isize) == self.expect_selected || self.expect_selected.is_none()
                    );
                    return Some(signer);
                }
            }
        }

        if let Some(cert) = &self.default
            && let Some(signer) = cert.certkey.signer(sig_schemes)
        {
            assert!(matches!(self.expect_selected, Some(-1) | None));
            return Some(signer);
        }

        assert_eq!(self.expect_selected, None);

        let all_must_match_issuer = self
            .additional
            .iter()
            .chain(self.default.iter())
            .all(|item| item.must_match_issuer);

        quit(match all_must_match_issuer {
            true => ":NO_MATCHING_ISSUER:",
            false => ":NO_COMMON_SIGNATURE_ALGORITHMS:",
        })
    }

    fn supported_certificate_types(&self) -> &'static [CertificateType] {
        match self.de
```

### Core Architecture Module: `bogo/src/compress.rs`
```
use rustls::compress;
use rustls::enums::CertificateCompressionAlgorithm;

#[derive(Debug, PartialEq)]
pub(crate) enum CompressionAlgs {
    None,
    All,
    One(u16),
}

#[derive(Debug)]
pub(crate) struct ShrinkingAlgorithm;

impl ShrinkingAlgorithm {
    pub(crate) const ALGORITHM: u16 = 0xff01;
}

impl compress::CertDecompressor for ShrinkingAlgorithm {
    fn algorithm(&self) -> CertificateCompressionAlgorithm {
        CertificateCompressionAlgorithm(Self::ALGORITHM)
    }

    fn decompress(
        &self,
        input: &[u8],
        output: &mut [u8],
    ) -> Result<(), compress::DecompressionFailed> {
        if output.len() != input.len() + 2 {
            return Err(compress::DecompressionFailed);
        }
        output[..2].copy_from_slice(&[0, 0]);
        output[2..].copy_from_slice(input);
        Ok(())
    }
}

impl compress::CertCompressor for ShrinkingAlgorithm {
    fn algorithm(&self) -> CertificateCompressionAlgorithm {
        CertificateCompressionAlgorithm(Self::ALGORITHM)
    }

    fn compress(
        &self,
        mut input: Vec<u8>,
        _: compress::CompressionLevel,
    ) -> Result<Vec<u8>, compress::CompressionFailed> {
        assert_eq!(input[..2], [0, 0]);
        input.drain(0..2);
        Ok(input)
    }
}

#[derive(Debug)]
pub(crate) struct ExpandingAlgorithm;

impl compress::CertDecompressor for ExpandingAlgorithm {
    fn algorithm(&self) -> CertificateCompressionAlgorithm {
        CertificateCompressionAlgorithm(0xff02)
    }

    fn decompress(
        &self,
        input: &[u8],
        output: &mut [u8],
    ) -> Result<(), compress::DecompressionFailed> {
        if output.len() + 4 != input.len() {
            return Err(compress::DecompressionFailed);
        }
        if input[..4] != [1, 2, 3, 4] {
            return Err(compress::DecompressionFailed);
        }
        output.copy_from_slice(&input[4..]);
        Ok(())
    }
}

impl compress::CertCompressor for ExpandingAlgorithm {
    fn algorithm(&self) -> CertificateCompressionAlgorithm {
        CertificateCompressionAlgorithm(0xff02)
    }

    fn compress(
        &self,
        mut input: Vec<u8>,
        _: compress::CompressionLevel,
    ) -> Result<Vec<u8>, compress::CompressionFailed> {
        input.insert(0, 1);
        input.insert(1, 2);
        input.insert(2, 3);
        input.insert(3, 4);
        Ok(input)
    }
}

#[derive(Debug)]
pub(crate) struct RandomAlgorithm;

impl compress::CertDecompressor for RandomAlgorithm {
    fn algorithm(&self) -> CertificateCompressionAlgorithm {
        CertificateCompressionAlgorithm(0xff03)
    }

    fn decompress(
        &self,
        input: &[u8],
        output: &mut [u8],
    ) -> Result<(), compress::DecompressionFailed> {
        if output.len() + 1 != input.len() {
            return Err(compress::DecompressionFailed);
        }
        output.copy_from_slice(&input[1..]);
        Ok(())
    }
}

impl compress::CertCompressor for RandomAlgorithm {
    fn algorithm(&self) -> CertificateCompressionAlgorithm {
        CertificateCompressionAlgorithm(0xff03)
    }

    fn compress(
        &self,
        mut input: Vec<u8>,
        _: compress::CompressionLevel,
    ) -> Result<Vec<u8>, compress::CompressionFailed> {
        let random_byte = {
            let mut bytes = [0];
            // nb. provider is irrelevant for this use
            rustls_ring::DEFAULT_PROVIDER
                .secure_random
                .fill(&mut bytes)
                .unwrap();
            bytes[0]
        };
        input.insert(0, random_byte);
        Ok(input)
    }
}

```

### Core Architecture Module: `bogo/src/main.rs`
```
// This is a test shim for the BoringSSL-Go ('bogo') TLS
// test suite. See bogo/ for this in action.
//
// https://boringssl.googlesource.com/boringssl/+/master/ssl/test
//

use core::any::Any;
use core::fmt::Debug;
use std::borrow::Cow;
use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};
use std::{env, net, process, thread, time};

#[cfg(unix)]
use nix::sys::signal::{self, Signal};
#[cfg(unix)]
use nix::unistd::Pid;
use rustls::client::{ClientConfig, ClientConnection, EchStatus};
use rustls::crypto::hpke::Hpke;
use rustls::crypto::{
    Credentials, CryptoProvider, Identity, SignatureScheme, WebPkiSupportedAlgorithms,
};
use rustls::enums::ProtocolVersion;
use rustls::error::{
    AlertDescription, ApiMisuse, CertificateError, Error, InvalidMessage, PeerIncompatible,
    PeerMisbehaved,
};
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, ServerName};
use rustls::server::{ServerConfig, ServerConnection};
use rustls::{Connection, HandshakeKind, IoState, RootCertStore, TlsInputBuffer, VecInput};
use rustls_aws_lc_rs::{
    ECDSA_P256_SHA256, ECDSA_P256_SHA384, ECDSA_P256_SHA512, ECDSA_P384_SHA256, ECDSA_P384_SHA384,
    ECDSA_P384_SHA512, ECDSA_P521_SHA256, ECDSA_P521_SHA384, ECDSA_P521_SHA512, ED25519,
    RSA_PKCS1_2048_8192_SHA256, RSA_PKCS1_2048_8192_SHA256_ABSENT_PARAMS,
    RSA_PKCS1_2048_8192_SHA384, RSA_PKCS1_2048_8192_SHA384_ABSENT_PARAMS,
    RSA_PKCS1_2048_8192_SHA512, RSA_PKCS1_2048_8192_SHA512_ABSENT_PARAMS,
    RSA_PSS_2048_8192_SHA256_LEGACY_KEY, RSA_PSS_2048_8192_SHA384_LEGACY_KEY,
    RSA_PSS_2048_8192_SHA512_LEGACY_KEY, hpke,
};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, fmt};

pub(crate) mod client;
mod compress;
mod opts;
mod server;

use compress::CompressionAlgs;
use opts::Options;

pub fn main() {
    let mut args: Vec<_> = env::args().collect();
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env())
        .init();

    args.remove(0);

    if !args.is_empty() && args[0] == "-is-handshaker-supported" {
        println!("No");
        process::exit(0);
    }
    println!("options: {args:?}");

    let mut opts = Options::new();

    while !args.is_empty() {
        opts.parse_one(&mut args);
    }

    if opts.side == Side::Client
        && opts.on_initial_expect_curve_id != opts.on_resume_expect_curve_id
    {
        // expecting server to HRR us to its desired curve
        opts.expect_handshake_kind_resumed =
            Some(vec![HandshakeKind::ResumedWithHelloRetryRequest]);
    }

    println!("opts {opts:?}");

    #[cfg(unix)]
    if opts.wait_for_debugger {
        // On Unix systems when -wait-for-debugger is passed from the BoGo runner
        // we should SIGSTOP ourselves to allow a debugger to attach to the shim to
        // continue the testing process.
        signal::kill(Pid::from_raw(process::id() as i32), Signal::SIGSTOP).unwrap();
    }

    let key_log = Arc::new(KeyLogMemo::default());
    let mut config = match opts.side {
        Side::Client => SideConfig::Client(client::config(&opts, &key_log)),
        Side::Server => SideConfig::Server(server::config(&opts, &key_log)),
    };

    for i in 0..opts.resumes + 1 {
        assert!(opts.quic_transport_params.is_empty());
        assert!(
            opts.expect_quic_transport_params
                .is_empty()
        );

        match &config {
            SideConfig::Client(config) => {
                let server_name = ServerName::try_from(opts.host_name.as_str())
                    .unwrap()
                    .to_owned();
                let mut output = Vec::new();
                let sess = config
                    .connect(server_name)
                    .build(&mut output)
                    .unwrap();
                exec(&opts, sess, output, &key_log, i);
            }
            SideConfig::Server(config) => {
                let sess = ServerConnection::new(config.clone()).unwrap();
                exec(&opts, sess, Vec::new(), &key_log, i);
            }
        }

        if opts.resume_with_tickets_disabled {
            opts.tickets = false;

            match &mut config {
                SideConfig::Server(server) => *server = server::config(&opts, &key_log),
                SideConfig::Client(client) => *client = client::config(&opts, &key_log),
            };
        }

        if opts.on_resume_ech_config_list.is_some() {
            opts.ech_config_list
                .clone_from(&opts.on_resume_ech_config_list);
            opts.expect_ech_accept = opts.on_resume_expect_ech_accept;
            if let SideConfig::Client(client_cfg) = &mut config {
                *client_cfg = client::config(&opts, &key_log);
            }
        }

        opts.expect_handshake_kind
            .clone_from(&opts.expect_handshake_kind_resumed);
    }
}

fn exec(
    opts: &Options,
    mut sess: impl Connection + 'static,
    mut output: Vec<u8>,
    key_log: &KeyLogMemo,
    count: usize,
) {
    let mut sent_message = false;

    let addrs = [
        net::SocketAddr::from((net::Ipv6Addr::LOCALHOST, opts.port)),
        net::SocketAddr::from((net::Ipv4Addr::LOCALHOST, opts.port)),
    ];
    let mut conn = net::TcpStream::connect(&addrs[..]).expect("cannot connect");
    let mut sent_shutdown = false;
    let mut sent_exporter = false;
    let mut sent_key_update = false;
    let mut quench_writes = false;
    let mut pending = Vec::new();

    conn.write_all(&opts.shim_id.to_le_bytes())
        .unwrap();

    let mut input = VecInput::default();
    loop {
        let mut buf = Vec::with_capacity(1024);
        let mut state = None;
        if !sent_message && (opts.queue_data || (opts.queue_data_on_resume && count > 0)) {
            if !opts
                .queue_early_data_after_received_messages
                .is_empty()
            {
                flush(&mut output, &mut conn);
                for message_size_estimate in &opts.queue_early_data_after_received_messages {
                    state = read_n_bytes(
                        &mut buf,
                        opts,
                        &mut input,
                        &mut output,
                        &mut pending,
                        &mut sess,
                        &mut conn,
                        *message_size_estimate,
                    );
                }
                println!("now ready for early data");
            }

            let (message, repeat) = opts.initial_write(count);

            if count > 0 && opts.enable_early_data {
                for _ in 0..repeat {
                    let len = client(&mut sess)
                        .early_data()
                        .expect("0rtt not available")
                        .write(message.into(), &mut output)
                        .unwrap();
                    write_or_queue(&mut sess, &message[len..], &mut pending, &mut output).unwrap();
                }
                sent_message = true;
            } else if !opts.only_write_one_byte_after_handshake {
                for _ in 0..repeat {
                    let _ = write_or_queue(&mut sess, message, &mut pending, &mut output);
                }
                sent_message = true;
            }
        }

        if !quench_writes {
            flush(&mut output, &mut conn);
        }

        if sess.wants_read() {
            state = read_all_bytes(
                &mut buf,
                opts,
                &mut input,
                &mut output,
                &mut pending,
                &mut sess,
                &mut conn,
            );
        }

        if let Some(state) = state {
            if state.peer_has_closed() {
                if opts.check_close_notify {
                    println!("close notify ok");
                }
                println!("EOF (tls)");
                return;
            } else if input.has_seen_eof() {
                if opts.check_close_notify {
                    quit_err(":CLOSE_WITHOUT_CLOSE_NOTIFY:");
                }
                println!("EOF (tcp)");
                return;
            }
        }

        if !sess.is_handshaking() && opts.export_keying_material > 0 && !sent_exporter {
            let mut export = vec![0; opts.export_keying_material];
            sess.exporter()
                .unwrap()
                .derive(
                    opts.export_keying_material_label
                        .as_bytes(),
                    if opts.export_keying_material_context_used {
                        Some(
                            opts.export_keying_material_context
                                .as_bytes(),
                        )
                    } else {
                        None
                    },
                    &mut export,
                )
                .unwrap();
            sess.write((&export).into(), &mut output)
                .unwrap();
            sent_exporter = true;
        }

        if !sess.is_handshaking() && opts.export_traffic_secrets && !sent_exporter {
            let secrets = key_log.clone_inner();
            assert_eq!(
                secrets.client_traffic_secret.len(),
                secrets.server_traffic_secret.len()
            );
            sess.write(
                (&(secrets.client_traffic_secret.len() as u16).to_le_bytes()).into(),
                &mut output,
            )
            .unwrap();
            sess.write((&secrets.server_traffic_secret).into(), &mut output)
                .unwrap();
            sess.write((&secrets.client_traffic_secret).into(), &mut output)
                .unwrap();
            sent_exporter = true;
        }

        if opts.send_key_update && !sent_key_update && !sess.is_handshaking() {
            sess.refresh_traffic_keys(&mut output)
                .unwrap();
            sent_key_update = true;
        }

  
```

### Core Architecture Module: `bogo/src/opts.rs`
```
use std::sync::Arc;
use std::{env, process};

use base64::prelude::{BASE64_STANDARD, Engine};
use rustls::crypto::kx::NamedGroup;
use rustls::crypto::{CryptoProvider, SignatureScheme};
use rustls::enums::ProtocolVersion;
use rustls::pki_types::{EchConfigListBytes, ServerName};
use rustls::{DistinguishedName, HandshakeKind};

use super::client::OcspValidation;
use super::{
    BOGO_NACK, CompressionAlgs, Credential, CredentialSet, SelectedProvider, Side, align_time,
    lookup_scheme,
};

#[derive(Debug)]
pub(crate) struct Options {
    pub(crate) check_close_notify: bool,
    pub(crate) credentials: CredentialSet,
    pub(crate) ech_config_list: Option<EchConfigListBytes<'static>>,
    pub(crate) enable_early_data: bool,
    pub(crate) enable_ech_grease: bool,
    pub(crate) expect_accept_early_data: bool,
    pub(crate) expect_curve_id: Option<NamedGroup>,
    pub(crate) expect_ech_accept: bool,
    pub(crate) expect_ech_name_override: Option<String>,
    pub(crate) expect_ech_retry_configs: Option<EchConfigListBytes<'static>>,
    pub(crate) expect_handshake_kind: Option<Vec<HandshakeKind>>,
    pub(crate) expect_handshake_kind_resumed: Option<Vec<HandshakeKind>>,
    pub(crate) expect_no_ech_name_override: bool,
    pub(crate) expect_no_ech_retry_configs: bool,
    pub(crate) expect_quic_transport_params: Vec<u8>,
    pub(crate) expect_reject_early_data: bool,
    pub(crate) expect_ticket_supports_early_data: bool,
    pub(crate) expect_version: u16,
    pub(crate) export_keying_material: usize,
    pub(crate) export_keying_material_context: String,
    pub(crate) export_keying_material_context_used: bool,
    pub(crate) export_keying_material_label: String,
    pub(crate) export_traffic_secrets: bool,
    pub(crate) groups: Option<Vec<NamedGroup>>,
    pub(crate) host_name: String,
    pub(crate) initial_write_on_resume: Option<Vec<u8>>,
    pub(crate) install_cert_compression_algs: CompressionAlgs,
    pub(crate) max_fragment: Option<usize>,
    pub(crate) max_version: Option<ProtocolVersion>,
    pub(crate) min_version: Option<ProtocolVersion>,
    pub(crate) ocsp: OcspValidation,
    pub(crate) offer_no_client_cas: bool,
    pub(crate) on_initial_expect_curve_id: Option<NamedGroup>,
    pub(crate) on_initial_expect_ech_accept: bool,
    pub(crate) on_resume_ech_config_list: Option<EchConfigListBytes<'static>>,
    pub(crate) on_resume_expect_curve_id: Option<NamedGroup>,
    pub(crate) on_resume_expect_ech_accept: bool,
    pub(crate) on_retry_expect_ech_name_override: Option<String>,
    pub(crate) only_write_one_byte_after_handshake: bool,
    pub(crate) only_write_one_byte_after_handshake_on_resume: bool,
    pub(crate) port: u16,
    pub(crate) protocols: Vec<String>,
    pub(crate) provider: CryptoProvider,
    pub(crate) queue_data: bool,
    pub(crate) queue_data_on_resume: bool,
    pub(crate) queue_early_data_after_received_messages: Vec<usize>,
    pub(crate) quic_transport_params: Vec<u8>,
    pub(crate) read_size: usize,
    pub(crate) reject_alpn: bool,
    pub(crate) reject_unusable_ech_config: bool,
    pub(crate) repeat_initial_write_on_resume: usize,
    pub(crate) require_any_client_cert: bool,
    pub(crate) require_ems: bool,
    pub(crate) resume_with_tickets_disabled: bool,
    pub(crate) resumes: usize,
    pub(crate) resumption_delay: u32,
    pub(crate) root_hint_subjects: Vec<DistinguishedName>,
    pub(crate) selected_provider: SelectedProvider,
    pub(crate) send_key_update: bool,
    pub(crate) server_ocsp_response: Arc<[u8]>,
    pub(crate) server_preference: bool,
    pub(crate) server_supported_group_hint: Option<NamedGroup>,
    pub(crate) shim_id: u64,
    pub(crate) shut_down_after_handshake: bool,
    pub(crate) side: Side,
    pub(crate) support_tls12: bool,
    pub(crate) support_tls13: bool,
    pub(crate) tickets: bool,
    pub(crate) trusted_cert_file: String,
    pub(crate) use_sni: bool,
    pub(crate) verify_peer: bool,
    pub(crate) verify_prefs: Option<SignatureScheme>,
    pub(crate) wait_for_debugger: bool,
}

impl Options {
    pub(crate) fn new() -> Self {
        let selected_provider = match env::var("BOGO_SHIM_PROVIDER")
            .ok()
            .as_deref()
        {
            None | Some("aws-lc-rs") => SelectedProvider::AwsLcRs,
            #[cfg(feature = "fips")]
            Some("aws-lc-rs-fips") => SelectedProvider::AwsLcRsFips,
            Some("ring") => SelectedProvider::Ring,
            Some(other) => panic!("unrecognized value for BOGO_SHIM_PROVIDER: {other:?}"),
        };

        Self {
            check_close_notify: false,
            credentials: CredentialSet::default(),
            ech_config_list: None,
            enable_early_data: false,
            enable_ech_grease: false,
            expect_accept_early_data: false,
            expect_curve_id: None,
            expect_ech_accept: false,
            expect_ech_name_override: None,
            expect_ech_retry_configs: None,
            expect_handshake_kind: None,
            expect_handshake_kind_resumed: Some(vec![HandshakeKind::Resumed]),
            expect_no_ech_name_override: false,
            expect_no_ech_retry_configs: false,
            expect_quic_transport_params: vec![],
            expect_reject_early_data: false,
            expect_ticket_supports_early_data: false,
            expect_version: 0,
            export_keying_material: 0,
            export_keying_material_context: "".to_string(),
            export_keying_material_context_used: false,
            export_keying_material_label: "".to_string(),
            export_traffic_secrets: false,
            groups: None,
            host_name: "example.com".to_string(),
            initial_write_on_resume: None,
            install_cert_compression_algs: CompressionAlgs::None,
            max_fragment: None,
            max_version: None,
            min_version: None,
            ocsp: OcspValidation::default(),
            offer_no_client_cas: false,
            on_initial_expect_curve_id: None,
            on_initial_expect_ech_accept: false,
            on_resume_ech_config_list: None,
            on_resume_expect_curve_id: None,
            on_resume_expect_ech_accept: false,
            on_retry_expect_ech_name_override: None,
            only_write_one_byte_after_handshake: false,
            only_write_one_byte_after_handshake_on_resume: false,
            port: 0,
            protocols: vec![],
            provider: selected_provider.provider(),
            queue_data: false,
            queue_data_on_resume: false,
            queue_early_data_after_received_messages: vec![],
            quic_transport_params: vec![],
            read_size: 512,
            reject_alpn: false,
            reject_unusable_ech_config: false,
            repeat_initial_write_on_resume: 1,
            require_any_client_cert: false,
            require_ems: false,
            resume_with_tickets_disabled: false,
            resumes: 0,
            resumption_delay: 0,
            root_hint_subjects: vec![],
            selected_provider,
            send_key_update: false,
            server_ocsp_response: Arc::from([]),
            server_preference: false,
            server_supported_group_hint: None,
            shim_id: 0,
            shut_down_after_handshake: false,
            side: Side::Client,
            support_tls12: true,
            support_tls13: true,
            tickets: true,
            trusted_cert_file: "".to_string(),
            use_sni: false,
            verify_peer: false,
            verify_prefs: None,
            wait_for_debugger: false,
        }
    }

    /// The message the shim writes first, and how many times it writes it.
    pub(crate) fn initial_write(&self, count: usize) -> (&[u8], usize) {
        match (count > 0, &self.initial_write_on_resume) {
            (true, Some(message)) => (message, self.repeat_initial_write_on_resume),
            _ => (b"hello", 1),
        }
    }

    fn version_allowed(&self, vers: ProtocolVersion) -> bool {
        (self.min_version.is_none() || u16::from(vers) >= u16::from(self.min_version.unwrap()))
            && (self.max_version.is_none()
                || u16::from(vers) <= u16::from(self.max_version.unwrap()))
    }

    fn tls13_supported(&self) -> bool {
        self.support_tls13 && self.version_allowed(ProtocolVersion::TLSv1_3)
    }

    fn tls12_supported(&self) -> bool {
        self.support_tls12 && self.version_allowed(ProtocolVersion::TLSv1_2)
    }

    pub(crate) fn expected_server_names(&self) -> Vec<ServerName<'static>> {
        let mut names = vec![];

        let name = match (
            &self.expect_ech_name_override,
            self.expect_no_ech_name_override,
        ) {
            (Some(override_name), _) => override_name,
            (None, true) => &self.host_name,
            (None, false) => return names,
        };

        names.push(
            ServerName::try_from(name.as_str())
                .expect("invalid expected server name")
                .to_owned(),
        );

        if let Some(on_retry) = &self.on_retry_expect_ech_name_override {
            names.push(
                ServerName::try_from(on_retry.as_str())
                    .expect("invalid expected server name")
                    .to_owned(),
            );
        }

        names
    }

    pub(crate) fn provider(&self) -> CryptoProvider {
        let mut provider = self.provider.clone();

        if !matches!(self.selected_provider, SelectedProvider::Ring)
            && let Some(
                SignatureScheme::ML_DSA_44
                | SignatureScheme::ML_DSA_65
                | SignatureScheme::ML_DSA_87,
            ) = self.verify_prefs
        {
            // ML-DSA is disabled by default, enable for preferred verification scheme
            provider.signature_verification_algorithms = rustls_aws_lc_rs::SUPPORTED_SIG_ALGS;
        }

        if let Some(groups) = &self.groups {
            provider
    
```

### Core Architecture Module: `bogo/src/server.rs`
```
use std::sync::Arc;

use rustls::client::danger::HandshakeSignatureValid;
use rustls::crypto::{
    Credentials, CryptoProvider, SelectedCredential, SignatureScheme, SingleCredential,
    VerifiedIdentity,
};
use rustls::enums::ApplicationProtocol;
use rustls::error::PeerIncompatible;
use rustls::server::danger::{ClientIdentity, ClientVerifier, SignatureVerificationInput};
use rustls::server::{
    self, ClientHello, PreferClientOrder, PreferServerOrder, ServerSessionKey, Tls13Tickets,
    WebPkiClientVerifier,
};
use rustls::{DistinguishedName, Error, ServerConfig};

use super::opts::Options;
use super::{KeyLogMemo, load_root_certs};
use crate::compress::{CompressionAlgs, ExpandingAlgorithm, RandomAlgorithm, ShrinkingAlgorithm};
use crate::lookup_scheme;

pub(crate) fn config(opts: &Options, key_log: &Arc<KeyLogMemo>) -> Arc<ServerConfig> {
    let provider = opts.provider();
    let client_auth =
        if opts.verify_peer || opts.offer_no_client_cas || opts.require_any_client_cert {
            Arc::new(DummyClientAuth::new(
                &opts.trusted_cert_file,
                opts.require_any_client_cert,
                Arc::from(opts.root_hint_subjects.clone()),
                &provider,
            ))
        } else {
            WebPkiClientVerifier::no_client_auth()
        };

    assert!(
        opts.credentials.additional.is_empty(),
        "TODO: server certificate switching not implemented yet"
    );
    let cred = &opts.credentials.default;
    let mut credentials = cred.load_from_file(&provider);
    credentials.ocsp = Some(opts.server_ocsp_response.clone());

    let cert_resolver = match cred.use_signing_scheme {
        Some(scheme) => Arc::new(FixedSignatureSchemeServerCertResolver {
            credentials,
            scheme: lookup_scheme(scheme),
        }) as Arc<dyn server::ServerCredentialResolver>,
        None => Arc::new(SingleCredential::from(credentials)),
    };

    let mut cfg = ServerConfig::builder(Arc::new(provider))
        .with_client_cert_verifier(client_auth)
        .with_server_credential_resolver(cert_resolver)
        .unwrap();

    cfg.session_storage = ServerCacheWithResumptionDelay::new(opts.resumption_delay);
    cfg.max_fragment_size = opts.max_fragment;
    cfg.send_tls13_tickets = Tls13Tickets { default: 1, max: 1 };
    cfg.require_ems = opts.require_ems;
    cfg.cipher_suite_selector = match opts.server_preference {
        true => &PreferServerOrder,
        false => &PreferClientOrder,
    };

    if opts.export_traffic_secrets {
        cfg.key_log = key_log.clone();
    }

    if opts.tickets {
        cfg.ticketer = Some(
            cfg.provider()
                .ticketer_factory
                .ticketer()
                .unwrap(),
        );
    } else if opts.resumes == 0 {
        cfg.session_storage = Arc::new(server::NoServerSessionStorage {});
    }

    if !opts.protocols.is_empty() {
        cfg.alpn_protocols = opts
            .protocols
            .iter()
            .map(|proto| ApplicationProtocol::from(proto.as_bytes()).to_owned())
            .collect::<Vec<_>>();
    }

    if opts.reject_alpn {
        cfg.alpn_protocols = vec![ApplicationProtocol::from(b"invalid")];
    }

    if opts.enable_early_data {
        // see kMaxEarlyDataAccepted in boringssl, which bogo validates
        cfg.max_early_data_size = 14336;
        cfg.send_half_rtt_data = true;
    }

    match opts.install_cert_compression_algs {
        CompressionAlgs::All => {
            cfg.cert_compressors = vec![&ExpandingAlgorithm, &ShrinkingAlgorithm, &RandomAlgorithm];
            cfg.cert_decompressors =
                vec![&ExpandingAlgorithm, &ShrinkingAlgorithm, &RandomAlgorithm];
        }
        CompressionAlgs::One(ShrinkingAlgorithm::ALGORITHM) => {
            cfg.cert_compressors = vec![&ShrinkingAlgorithm];
            cfg.cert_decompressors = vec![&ShrinkingAlgorithm];
        }
        CompressionAlgs::None => {}
        _ => unimplemented!(),
    }

    Arc::new(cfg)
}

#[derive(Debug)]
pub(crate) struct DummyClientAuth {
    mandatory: bool,
    root_hint_subjects: Arc<[DistinguishedName]>,
    parent: Arc<dyn ClientVerifier>,
}

impl DummyClientAuth {
    fn new(
        trusted_cert_file: &str,
        mandatory: bool,
        root_hint_subjects: Arc<[DistinguishedName]>,
        provider: &CryptoProvider,
    ) -> Self {
        Self {
            mandatory,
            root_hint_subjects,
            parent: Arc::new(
                WebPkiClientVerifier::builder(load_root_certs(trusted_cert_file), provider)
                    .build()
                    .unwrap(),
            ),
        }
    }
}

impl ClientVerifier for DummyClientAuth {
    fn verify_identity<'a>(
        &self,
        identity: &ClientIdentity<'a, '_>,
    ) -> Result<VerifiedIdentity<'a>, Error> {
        Ok(VerifiedIdentity::assertion(identity.identity.clone()))
    }

    fn verify_tls12_signature(
        &self,
        input: &SignatureVerificationInput<'_>,
    ) -> Result<HandshakeSignatureValid, Error> {
        self.parent
            .verify_tls12_signature(input)
    }

    fn verify_tls13_signature(
        &self,
        input: &SignatureVerificationInput<'_>,
    ) -> Result<HandshakeSignatureValid, Error> {
        self.parent
            .verify_tls13_signature(input)
    }

    fn root_hint_subjects(&self) -> Arc<[DistinguishedName]> {
        self.root_hint_subjects.clone()
    }

    fn client_auth_mandatory(&self) -> bool {
        self.mandatory
    }

    fn offer_client_auth(&self) -> bool {
        true
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.parent.supported_verify_schemes()
    }
}

#[derive(Debug)]
struct FixedSignatureSchemeServerCertResolver {
    credentials: Credentials,
    scheme: SignatureScheme,
}

impl server::ServerCredentialResolver for FixedSignatureSchemeServerCertResolver {
    fn resolve(&self, client_hello: &ClientHello<'_>) -> Result<SelectedCredential, Error> {
        if !client_hello
            .signature_schemes()
            .contains(&self.scheme)
        {
            return Err(Error::PeerIncompatible(
                PeerIncompatible::NoSignatureSchemesInCommon,
            ));
        }

        self.credentials
            .signer(&[self.scheme])
            .ok_or(Error::PeerIncompatible(
                PeerIncompatible::NoSignatureSchemesInCommon,
            ))
    }
}

#[derive(Debug)]
struct ServerCacheWithResumptionDelay {
    delay: u32,
    storage: Arc<dyn server::StoresServerSessions>,
}

impl ServerCacheWithResumptionDelay {
    fn new(delay: u32) -> Arc<Self> {
        Arc::new(Self {
            delay,
            storage: server::ServerSessionMemoryCache::new(32),
        })
    }
}

impl server::StoresServerSessions for ServerCacheWithResumptionDelay {
    fn put(&self, key: ServerSessionKey<'_>, mut value: Vec<u8>) -> bool {
        // The creation time should be stored directly after the 2-byte version discriminant.
        let creation_time_sec = &mut value[2..10];
        let original = u64::from_be_bytes(creation_time_sec.try_into().unwrap());
        let delayed = original - self.delay as u64;
        creation_time_sec.copy_from_slice(&delayed.to_be_bytes());
        self.storage.put(key, value)
    }

    fn get(&self, key: ServerSessionKey<'_>) -> Option<Vec<u8>> {
        self.storage.get(key)
    }

    fn take(&self, key: ServerSessionKey<'_>) -> Option<Vec<u8>> {
        self.storage.take(key)
    }

    fn can_cache(&self) -> bool {
        self.storage.can_cache()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3328** (2026-10-04): **Update crabgrind to 0.4**
  *Symptoms*: This needed some handholding due to  - https://github.com/rust-lang/rust-bindgen/issues/3448  Replaces:  - https://github.com/rustls/rustls/pull/3327
  **Post-Mortem & Fix Analysis**:
  >   # Benchmark results  ## Instruction counts    #### Significant differences    ⚠️ There are significant instruction count differences  <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_ecdsap384_chacha_server | 2281172 | 2274409 | ✅ [-6763](https://bench.rustls.dev/comparisons/5ab438ff2327743787db4ec723ab54e3f00084b6:5d6417fbe54f4cb8bfdaef5bcbf594bdc057d387/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_ecdsap384_chacha_server) (-0.30%) | 0.20% |   </details>    #### Other differences    <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_ecdsap384_chacha_client | 8797869 | 8765948 | [-31921](https://bench.rustls.dev/comparisons/5ab438ff2327743787db4ec723ab54e3f00084b6:5d6417fbe54f4cb8bfdaef5bcbf594bdc057d38
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3328?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`5ab438f`](https://app.codecov.io/gh/rustls/rustls/commit/5ab438ff2327743787db4ec723ab54e3f00084b6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`5d6417f`](https://app.codecov.io/gh/rustls/rustls/commit/5d6417fbe54f4cb8bfdaef5bcbf594bdc057d387?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main    #3328   +/-   ## ======================================= 

- **Issue #3327** (2026-10-04): **Update Rust crate crabgrind to 0.4**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [crabgrind](https://redirect.github.com/2dav/crabgrind) | workspace.dependencies | minor | `0.3` → `0.4` |  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR is behind base branch, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/rustls/rustls). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6WyJkZXBlbmRlbmNpZXMiXX0=--> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3327?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`5ab438f`](https://app.codecov.io/gh/rustls/rustls/commit/5ab438ff2327743787db4ec723ab54e3f00084b6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`6e62466`](https://app.codecov.io/gh/rustls/rustls/commit/6e624663ddaa7bc3fb8f7fec91af9baaae60f2a8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main    #3327   +/-   ## ======================================= 
  > See  - #3328
  > ### Renovate Ignore Notification  Because you closed this PR without merging, Renovate will ignore this update (`0.4`). You will get a PR once a newer version is released. To ignore this dependency forever, add it to the `ignoreDeps` array of your Renovate config.  If you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.

- **Issue #3326** (2026-10-04): **Update dependency rust to 1.99**
  *Symptoms*: > ℹ️ **Note** >  > This PR body was truncated due to platform limits.  This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [rust](https://rust-lang.org/) ([source](https://redirect.github.com/rust-lang/rust), [changelog](https://redirect.github.com/rust-lang/rust/blob/main/RELEASES.md)) | uses-with | minor | `1.85` → `1.99` |  ---  ### Release Notes  <details> <summary>rust-lang/rust (rust)</summary>  ### [`v1.99.0`](https://redirect.github.com/rust-lang/rust/blob/HEAD/RELEASES.md#Version-1990-2026-10-01)  [Compare Source](https://redirect.github.com/rust-lang/rust/compare/1.98.1...1.99.0)  \==========================  <a id="1.99.0-Language"></a>  ## Language  - [Add allow-by-default `raw_borrows_via_references` lint that checks for references that decay immediately into raw borrows](https://redirect.github.com/rust-lang/rust/pull/138230) - [Extend `unconditional_panic` lint to function calls that panic when the chunks/windows size is zero](https://redirect.github.com/rust-lang/rust/pull/153563) - [Stabilize C-variadic function definitions](https://redirect.github.com/rust-lang/rust/pull/155697) - [Stabilize the ability to use `#[unsafe(naked)]` functions to define C-variadic functions (`#![feature(c_variadic_naked_functions)]`).](https://redirect.github.com/rust-lang/rust/pull/159746) - [Trait methods are now resolved on an adjusted never type (producing a FCW)](https://redirect.github.com/rust-lang/rust/pull/156047) - [Coerce f
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3326?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`5ab438f`](https://app.codecov.io/gh/rustls/rustls/commit/5ab438ff2327743787db4ec723ab54e3f00084b6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`7592654`](https://app.codecov.io/gh/rustls/rustls/commit/75926549b2637ba3dac4ab22fa7d22ecdf9e7c78?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main    #3326   +/-   ## ======================================= 
  > ### Renovate Ignore Notification  Because you closed this PR without merging, Renovate will ignore this update (`1.99`). You will get a PR once a newer version is released. To ignore this dependency forever, add it to the `ignoreDeps` array of your Renovate config.  If you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.

- **Issue #3323** (2026-10-03): **Drop remaining references to hashbrown**
  *Symptoms*: This was used in the unbuffered API, which was removed in  - https://github.com/rustls/rustls/pull/2905  We also used it for our caches but those seem to be using `std`'s `HashMap` now.
  **Post-Mortem & Fix Analysis**:
  >   # Benchmark results  ## Instruction counts    #### Significant differences    _There are no significant instruction count differences_    #### Other differences    <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_rsa_aes_server | 10939738 | 10876280 | [-63458](https://bench.rustls.dev/comparisons/3a97cf4bb83bf348307dfdc5368df84c1dd6910f:2959f966064bd7d2e8c40a5f42c5e596236ecb0b/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_rsa_aes_server) (-0.58%) | 0.79% | | handshake_no_resume_aws_lc_rs_1.3_rsa_chacha_server | 10939509 | 10906344 | [-33165](https://bench.rustls.dev/comparisons/3a97cf4bb83bf348307dfdc5368df84c1dd6910f:2959f966064bd7d2e8c40a5f42c5e596236ecb0b/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_rsa_chacha_server) (-0.30%) | 1.18% | | handshake_no_resume_aws_lc_rs_1.3_ecdsap384_aes_client | 8755608 | 8780486 | [24878](h
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3323?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`3a97cf4`](https://app.codecov.io/gh/rustls/rustls/commit/3a97cf4bb83bf348307dfdc5368df84c1dd6910f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`2959f96`](https://app.codecov.io/gh/rustls/rustls/commit/2959f966064bd7d2e8c40a5f42c5e596236ecb0b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main    #3323   +/-   ## ======================================= 

- **Issue #3321** (2026-10-03): **Support client-side early data sending for `ClientHandshake`**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  >   # Benchmark results  ## Instruction counts    #### Significant differences    ⚠️ There are significant instruction count differences  <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_ecdsap256_aes_server | 1346533 | 1353069 | ⚠️ [6536](https://bench.rustls.dev/comparisons/3a97cf4bb83bf348307dfdc5368df84c1dd6910f:eccf1e5462e652d7493c59eb0c07154a8ed56742/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_ecdsap256_aes_server) (0.49%) | 0.20% |   </details>    #### Other differences    <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_ecdsap384_aes_client | 8760641 | 8801528 | [40887](https://bench.rustls.dev/comparisons/3a97cf4bb83bf348307dfdc5368df84c1dd6910f:eccf1e5462e652d7493c59eb0c07154a8ed56742/cachegrin
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3321?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :x: Patch coverage is `90.90909%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 95.51%. Comparing base ([`1e894af`](https://app.codecov.io/gh/rustls/rustls/commit/1e894afa51117d8db4a0c6aed34a18b0413455de?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`eccf1e5`](https://app.codecov.io/gh/rustls/rustls/commit/eccf1e5462e652d7493c59eb0c07154a8ed56742?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)). :warning: Report is 1 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/rustls/rustls/pull/3321?dropdown=coverage&src=pr&el=tree&utm_medium=

- **Issue #3320** (2026-10-02): **Remove unused function**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  >   # Benchmark results  ## Instruction counts    #### Significant differences    ⚠️ There are significant instruction count differences  <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_rsa_chacha_client | 2385087 | 2398244 | ⚠️ [13157](https://bench.rustls.dev/comparisons/1e894afa51117d8db4a0c6aed34a18b0413455de:ed73341a69622fc955a4293583991649224ba921/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_rsa_chacha_client) (0.55%) | 0.20% | | handshake_no_resume_aws_lc_rs_1.3_ecdsap256_chacha_server | 1349652 | 1356247 | ⚠️ [6595](https://bench.rustls.dev/comparisons/1e894afa51117d8db4a0c6aed34a18b0413455de:ed73341a69622fc955a4293583991649224ba921/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_ecdsap256_chacha_server) (0.49%) | 0.20% | | handshake_no_resume_aws_lc_rs_1.3_ecdsap256_chacha_client | 3555277 | 3567050 | ⚠️ [11773](https://bench.ru
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3320?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`1e894af`](https://app.codecov.io/gh/rustls/rustls/commit/1e894afa51117d8db4a0c6aed34a18b0413455de?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`ed73341`](https://app.codecov.io/gh/rustls/rustls/commit/ed73341a69622fc955a4293583991649224ba921?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main    #3320      +/-   ## ==================================

- **Issue #3319** (2026-10-02): **msgs: move code up above tests module**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  >   # Benchmark results  ## Instruction counts    #### Significant differences    _There are no significant instruction count differences_    #### Other differences    <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.3_rsa_aes_server | 10969053 | 10929505 | [-39548](https://bench.rustls.dev/comparisons/5c9a6502da1ad63754a7f455af195b31d3d201ab:d44bc9ec3d4cb52f52301e1a0da9ae904695e7e6/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_rsa_aes_server) (-0.36%) | 1.02% | | handshake_no_resume_aws_lc_rs_1.3_ecdsap384_aes_client | 8792928 | 8763553 | [-29375](https://bench.rustls.dev/comparisons/5c9a6502da1ad63754a7f455af195b31d3d201ab:d44bc9ec3d4cb52f52301e1a0da9ae904695e7e6/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_ecdsap384_aes_client) (-0.33%) | 0.94% | | handshake_tickets_1.2_no_crypto_server | 902959 | 901969 | [-990](https://bench.ru
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3319?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`99f2358`](https://app.codecov.io/gh/rustls/rustls/commit/99f2358cae2954837dbb866faf6727de75489ab9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`d44bc9e`](https://app.codecov.io/gh/rustls/rustls/commit/d44bc9ec3d4cb52f52301e1a0da9ae904695e7e6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)). :warning: Report is 16 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main    #3

- **Issue #3318** (2026-10-02): **compress: reject trailing input in zlib and brotli decompressors**
  *Symptoms*: `cargo test -p rustls --all-features`, after appending `b"trailing data"` to a valid stream in the existing `test_compressor()` helper:      ---- compress::tests::test_zlib stdout ----     thread 'compress::tests::test_zlib' panicked at rustls/src/compress.rs:541:     called `Result::unwrap_err()` on an `Ok` value: ()      ---- compress::tests::test_brotli stdout ----     thread 'compress::tests::test_brotli' panicked at rustls/src/compress.rs:541:     called `Result::unwrap_err()` on an `Ok` value: ()  `decompress_slice()` reports `ReturnCode::Ok` at the end of the deflate stream without saying how much of `input` it read, and `BrotliDecompressStream` leaves the unread remainder in `available_in`. Both decompressors therefore accept a `compressed_certificate_message` that is a valid compression of the peer's Certificate followed by arbitrary bytes, where the trait contract ("if the `input` is in any way malformed") and RFC 8879 section 4 call for `DecompressionFailed`. Distinct from #3162, which covered leftovers in the decompressed buffer; this is leftovers in the compressed one, which the decompressor never looks at.  The zlib side moves to `Inflate` so `total_in()` is available; brotli checks `available_in`. These are the only two `CertDecompressor`s in the library. 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/rustls/rustls/pull/3318?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 95.51%. Comparing base ([`7dcbe4c`](https://app.codecov.io/gh/rustls/rustls/commit/7dcbe4c1ae12185237d22e9197583329630a2014?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)) to head ([`c04a7e3`](https://app.codecov.io/gh/rustls/rustls/commit/c04a7e3ad8a95239d15b0c344dcf0d2b1ec7e515?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rustls)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main    #3318   +/-   ## ======================================= 
  >   # Benchmark results  ## Instruction counts    #### Significant differences    ⚠️ There are significant instruction count differences  <details> <summary>Click to expand</summary>  | Scenario | Baseline | Candidate | Diff | Threshold | | --- | ---: | ---: | ---: | ---: | | handshake_no_resume_aws_lc_rs_1.2_rsa_aes_server | 10350957 | 10461080 | ⚠️ [110123](https://bench.rustls.dev/comparisons/7dcbe4c1ae12185237d22e9197583329630a2014:c04a7e3ad8a95239d15b0c344dcf0d2b1ec7e515/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.2_rsa_aes_server) (1.06%) | 1.00% | | handshake_no_resume_aws_lc_rs_1.3_ecdsap256_aes_server | 1346593 | 1353138 | ⚠️ [6545](https://bench.rustls.dev/comparisons/7dcbe4c1ae12185237d22e9197583329630a2014:c04a7e3ad8a95239d15b0c344dcf0d2b1ec7e515/cachegrind-diff/handshake_no_resume_aws_lc_rs_1.3_ecdsap256_aes_server) (0.49%) | 0.20% |   </details>    #### Other differences    <details> <summary>Click to expand</summary>  | Scenario | Base

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `2943375d` (2026-09-28)
**Commit Message**: Add regression test for sending data after ECH rejection

**File**: `rustls-test/src/lib.rs` (modified, +29/-0)
```diff
@@ -2273,10 +2273,12 @@ pub mod macros {
 
 /// Deeply inefficient, test-only TLS encoding helpers
 pub mod encoding {
+    use rustls::crypto::hpke::HpkeSuite;
     use rustls::crypto::kx::NamedGroup;
     use rustls::crypto::{CipherSuite, SignatureScheme};
     use rustls::enums::{ContentType, HandshakeType, ProtocolVersion};
     use rustls::error::AlertDescription;
+    use rustls::pki_types::EchConfigListBytes;
 
     /// Return a client hello with mandatory extensions added to `extensions`
     ///
@@ -2523,6 +2525,32 @@ pub mod encoding {
         )
     }
 
+    /// Return an `ECHConfigList` containing a single `ECHConfig` for `public_name`
+    ///
+    /// See <https://www.rfc-editor.org/rfc/rfc9849#section-4>.
+    pub fn ech_config_list(
+        suite: HpkeSuite,
+        public_key: &[u8],
+        public_name: &str,
+    ) -> EchConfigListBytes<'static> {
+        let mut contents = vec![0]; // config_id
+        contents.extend_from_slice(&suite.kem.to_array());
+        contents.extend(len_u16(public_key.to_vec()));
+        contents.extend(len_u16(vector_of([
+            suite.sym.kdf_id.to_array(),
+            suite.sym.aead_id.to_array(),
+        ])));
+        contents.push(0); // maximum_name_length
+        contents.extend(len_u8(public_name.as_bytes().to_vec()));
+        contents.extend(len_u16(vec![])); // extensions
+
+        let mut config = ECH_CONFIG_VERSION
+            .to_be_bytes()
+            .to_vec();
+        config.extend(len_u16(contents));
+        EchConfigListBytes::from(len_u16(config))
+    }
+
     /// Prefix with u8 length
     pub fn len_u8(mut body: Vec<u8>) -> Vec<u8> {
         body.splice(0..0, [body.len() as u8]);
@@ -2551,6 +2579,7 @@ pub mod encoding {
 
     const ALERT_LEVEL_WARNING: u8 = 1;
     const ALERT_LEVEL_FATAL: u8 = 2;
+    const ECH_CONFIG_VERSION: u16 = 0xfe0d;
 }
 
 /// A tracing subscriber that collects everything which was logged.
```

**File**: `rustls-test/tests/api/api.rs` (modified, +69/-1)
```diff
@@ -9,7 +9,7 @@ use std::sync::{Arc, Mutex};
 
 use pki_types::{DnsName, FipsStatus, SubjectPublicKeyInfoDer};
 use provider::cipher_suite;
-use rustls::client::{EchConfig, EchGreaseConfig, EchMode, Resumption};
+use rustls::client::{EchConfig, EchGreaseConfig, EchMode, EchStatus, Resumption};
 use rustls::crypto::cipher::{EncodableVersion, Payload, Record};
 use rustls::crypto::kx::NamedGroup;
 use rustls::crypto::{
@@ -1840,6 +1840,74 @@ fn test_client_fips_service_indicator_includes_ech_hpke_suite() {
     }
 }
 
+#[test]
+fn test_client_sends_no_application_data_after_ech_rejection() {
+    // The server has no ECH keys, so it rejects ECH and completes the outer handshake
+    // with a certificate that is valid for the ECH config's `public_name` only.
+    let suite = ALL_SUPPORTED_SUITES[0];
+    let (public_key, _) = suite.generate_key_pair().unwrap();
+    let ech_config = EchConfig::new(
+        encoding::ech_config_list(suite.suite(), &public_key.0, "testserver.com"),
+        &[suite],
+    )
+    .unwrap();
+
+    let provider = provider::DEFAULT_TLS13_PROVIDER;
+    let client_config = ClientConfig::builder(provider.clone().into())
+        .with_ech(EchMode::Enable(ech_config))
+        .finish(KeyType::default());
+    let server_config = make_server_config(KeyType::default(), &provider);
+
+    let mut client_output = Vec::new();
+    let mut server_output = Vec::new();
+    let mut client = Arc::new(client_config)
+        .connect(server_name("private.example"))
+        .build(&mut client_output)
+        .unwrap();
+    let mut server = ServerConnection::new(Arc::new(server_config)).unwrap();
+    let mut client_input = VecInput::default();
+    let mut server_input = VecInput::default();
+
+    let err = do_handshake_until_error(
+        &mut client_input,
+        &mut client_output,
+        &mut client,
+        &mut server_input,
+        &mut server_output,
+        &mut server,
+    )
+    .unwrap_err();
+    assert!(matches!(err, ErrorFromPeer::Client(Error::RejectedEch(_))));
+    assert_eq!(client.data().ech_status(), EchStatus::Rejected);
+
+    // The connection is only authenticated for the `public_name`, so it must not become
+    // usable for application data intended for the inner server name.
+    assert!(client.is_handshaking());
+    assert!(client.peer_identity().is_none());
+    assert_eq!(client.exporter().unwrap_err(), Error::HandshakeNotComplete);
+
+    let queued = client_output.len();
+    assert_eq!(
+        client
+            .write(b"ech-inner-secret".into(), &mut client_output)
+            .unwrap_err(),
+        ApiMisuse::WriteTlsBeforeHandshakeComplete.into()
+    );
+    assert_eq!(client_output.len(), queued);
+
+    let mut server_received = Vec::new();
+    transfer(&mut client_output, &mut server_input);
+    let err = server
+        .read_tls(&mut server_input, &mut server_output)
+        .handle_all(&mut server_received)
+        .unwrap_err();
+    assert_eq!(
+        err,
+        Error::AlertReceived(AlertDescription::EncryptedClientHelloRequired)
+    );
+    assert!(server_received.is_empty());
+}
+
 #[test]
 fn test_illegal_server_renegotiation_attempt_after_tls13_handshake() {
     let provider = provider::DEFAULT_TLS13_PROVIDER;
```

---

### Incident Patch 2: `38296e3a` (2026-09-30)
**Commit Message**: Avoid unused `derive(Debug)` for internal types

The previous commits had as a root cause a type becoming public
without revisiting suitability for that.  Instead of leaving a trap
of an internal type which prints secrets, just avoid that systematically
by removing latent Debug impls.

**File**: `rustls/src/crypto/cipher/record_layer.rs` (modified, +0/-1)
```diff
@@ -266,7 +266,6 @@ impl DecryptionState {
 }
 
 /// Result of decryption.
-#[derive(Debug)]
 pub(crate) struct Decrypted<'a> {
     /// Whether the peer appears to be getting close to encrypting too many records with this key.
     pub(crate) want_close_before_decrypt: bool,
```

**File**: `rustls/src/limited_cache.rs` (modified, +2/-3)
```diff
@@ -1,6 +1,5 @@
 use alloc::collections::VecDeque;
 use core::borrow::Borrow;
-use core::fmt::Debug;
 use core::hash::Hash;
 
 use crate::hash_map::{Entry, HashMap};
@@ -20,7 +19,7 @@ pub(crate) struct LimitedCache<K, V> {
     oldest: VecDeque<K>,
 }
 
-impl<K: Eq + Hash + Clone + Debug, V> LimitedCache<K, V> {
+impl<K: Eq + Hash + Clone, V> LimitedCache<K, V> {
     /// Create a new LimitedCache with the given rough capacity.
     pub(crate) fn new(capacity_order_of_magnitude: usize) -> Self {
         Self {
@@ -86,7 +85,7 @@ impl<K: Eq + Hash + Clone + Debug, V> LimitedCache<K, V> {
     }
 }
 
-impl<K: Eq + Hash + Clone + Debug, V: Default> LimitedCache<K, V> {
+impl<K: Eq + Hash + Clone, V: Default> LimitedCache<K, V> {
     pub(crate) fn get_or_insert_default_and_edit(&mut self, k: K, edit: impl FnOnce(&mut V)) {
         let inserted_new_item = match self.map.entry(k) {
             Entry::Occupied(value) => {
```

**File**: `rustls/src/msgs/client_hello.rs` (modified, +1/-1)
```diff
@@ -629,7 +629,7 @@ fn trim_hostname_trailing_dot_for_sni(dns_name: &DnsName<'_>) -> DnsName<'static
     }
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone)]
 pub(crate) enum HostNamePayload {
     HostName(DnsName<'static>),
     IpAddress(SizedPayload<'static, u16, NonEmpty>),
```

**File**: `rustls/src/msgs/codec.rs` (modified, +4/-4)
```diff
@@ -214,12 +214,12 @@ impl TlsListElement for SubjectPublicKeyInfoDer<'_> {
 ///
 /// All uses _MUST_ exhaust the iterator, as errors may be delayed
 /// until the last element.
-pub(crate) struct TlsListIter<'a, T: Codec<'a> + TlsListElement + Debug> {
+pub(crate) struct TlsListIter<'a, T: Codec<'a> + TlsListElement> {
     sub: Reader<'a>,
     _t: PhantomData<T>,
 }
 
-impl<'a, T: Codec<'a> + TlsListElement + Debug> TlsListIter<'a, T> {
+impl<'a, T: Codec<'a> + TlsListElement> TlsListIter<'a, T> {
     pub(crate) fn new(r: &mut Reader<'a>) -> Result<Self, InvalidMessage> {
         let len = T::SIZE_LEN.read(r)?;
         let sub = r.sub(len)?;
@@ -230,7 +230,7 @@ impl<'a, T: Codec<'a> + TlsListElement + Debug> TlsListIter<'a, T> {
     }
 }
 
-impl<'a, T: Codec<'a> + TlsListElement + Debug> Iterator for TlsListIter<'a, T> {
+impl<'a, T: Codec<'a> + TlsListElement> Iterator for TlsListIter<'a, T> {
     type Item = Result<T, InvalidMessage>;
 
     fn next(&mut self) -> Option<Self::Item> {
@@ -412,7 +412,7 @@ impl Codec<'_> for () {
 
 /// Trait for implementing encoding and decoding functionality
 /// on something.
-pub(crate) trait Codec<'a>: Debug + Sized {
+pub(crate) trait Codec<'a>: Sized {
     /// Function for encoding itself by appending itself to
     /// the provided vec of bytes.
     fn encode(&self, bytes: &mut Vec<u8>);
```

**File**: `rustls/src/msgs/deframer/buffers.rs` (modified, +0/-1)
```diff
@@ -46,7 +46,6 @@ impl<'b> Delocator<'b> {
 
 /// Conversion from a slice within a larger buffer into
 /// a `Range` offset within.
-#[derive(Debug)]
 pub(crate) struct Locator {
     bounds: Range<*const u8>,
 }
```

**File**: `rustls/src/msgs/handshake.rs` (modified, +1/-3)
```diff
@@ -809,12 +809,11 @@ impl Codec<'_> for EcParameters {
     }
 }
 
-pub(crate) trait KxDecode<'a>: fmt::Debug + Sized {
+pub(crate) trait KxDecode<'a>: Sized {
     /// Decode a key exchange message given the key_exchange `algo`
     fn decode(r: &mut Reader<'a>, algo: KeyExchangeAlgorithm) -> Result<Self, InvalidMessage>;
 }
 
-#[derive(Debug)]
 pub(crate) enum ClientKeyExchangeParams {
     Ecdh(ClientEcdhParams),
     Dh(ClientDhParams),
@@ -846,7 +845,6 @@ impl KxDecode<'_> for ClientKeyExchangeParams {
     }
 }
 
-#[derive(Debug)]
 pub(crate) struct ClientEcdhParams {
     /// RFC 4492: `opaque point <1..2^8-1>;`
     pub(crate) public: SizedPayload<'static, u8, NonEmpty>,
```

**File**: `rustls/src/server/mod.rs` (modified, +0/-2)
```diff
@@ -49,7 +49,6 @@ pub mod danger {
 #[cfg(test)]
 mod test;
 
-#[derive(Debug)]
 pub(crate) enum ServerSessionValue<'a> {
     Tls12(Tls12ServerSessionValue<'a>),
     Tls13(Tls13ServerSessionValue<'a>),
@@ -78,7 +77,6 @@ impl<'a> Codec<'a> for ServerSessionValue<'a> {
     }
 }
 
-#[derive(Debug)]
 pub(crate) struct CommonServerSessionValue<'a> {
     pub(crate) creation_time_sec: u64,
     pub(crate) sni: Option<DnsName<'a>>,
```

**File**: `rustls/src/server/test.rs` (modified, +0/-19)
```diff
@@ -42,25 +42,6 @@ use crate::tls13::{Tls13CipherSuite, Tls13ProtocolSuite};
 use crate::verify::VerifiedIdentity;
 use crate::version::TLS12_VERSION;
 
-#[test]
-fn serversessionvalue_is_debug() {
-    use std::{println, vec};
-    let ssv = ServerSessionValue::Tls13(Tls13ServerSessionValue::new(
-        CommonServerSessionValue::new(
-            None,
-            CipherSuite::TLS13_AES_128_GCM_SHA256,
-            None,
-            None,
-            vec![4, 5, 6],
-            UnixTime::now(),
-        ),
-        &[1, 2, 3],
-        0x12345678,
-    ));
-    println!("{ssv:?}");
-    println!("{:#04x?}", ssv.get_encoding());
-}
-
 #[test]
 fn serversessionvalue_no_sni() {
     let bytes = [
```

---

### Incident Patch 3: `f5f7bf50` (2026-09-30)
**Commit Message**: Eliminate secrets from impl Debug for `Tls1[23]Session`

**File**: `rustls/src/client/mod.rs` (modified, +92/-2)
```diff
@@ -1,4 +1,5 @@
 use alloc::vec::Vec;
+use core::fmt;
 use core::ops::Deref;
 use core::time::Duration;
 
@@ -117,7 +118,6 @@ impl<T> Deref for Retrieved<T> {
 }
 
 /// A stored TLS 1.3 client session value.
-#[derive(Debug)]
 pub struct Tls13Session {
     suite: Tls13ProtocolSuite,
     secret: Zeroizing<SizedPayload<'static, u8>>,
@@ -215,6 +215,26 @@ impl Deref for Tls13Session {
     }
 }
 
+impl fmt::Debug for Tls13Session {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        let Self {
+            suite,
+            secret: _,
+            age_add,
+            max_early_data_size,
+            common,
+            quic_params,
+        } = self;
+        f.debug_struct("Tls13Session")
+            .field("suite", suite)
+            .field("age_add", age_add)
+            .field("max_early_data_size", max_early_data_size)
+            .field("common", common)
+            .field("quic_params", quic_params)
+            .finish_non_exhaustive()
+    }
+}
+
 /// A "template" for future TLS1.3 client session values.
 #[derive(Clone)]
 pub(crate) struct Tls13ClientSessionInput {
@@ -224,7 +244,7 @@ pub(crate) struct Tls13ClientSessionInput {
 }
 
 /// A stored TLS 1.2 client session value.
-#[derive(Debug, Clone)]
+#[derive(Clone)]
 pub struct Tls12Session {
     suite: &'static Tls12CipherSuite,
     pub(crate) session_id: SessionId,
@@ -302,6 +322,24 @@ impl Deref for Tls12Session {
     }
 }
 
+impl fmt::Debug for Tls12Session {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        let Self {
+            suite,
+            session_id,
+            master_secret: _,
+            extended_ms,
+            common,
+        } = self;
+        f.debug_struct("Tls12Session")
+            .field("suite", suite)
+            .field("session_id", session_id)
+            .field("extended_ms", extended_ms)
+            .field("common", common)
+            .finish_non_exhaustive()
+    }
+}
+
 /// Common data for stored client sessions.
 #[derive(Debug, Clone)]
 pub struct ClientSessionCommon {
@@ -445,3 +483,55 @@ impl ClientAuthDetails {
 }
 
 static MAX_TICKET_LIFETIME: Duration = Duration::from_secs(7 * 24 * 60 * 60);
+
+#[cfg(test)]
+mod tests {
+    use alloc::format;
+
+    use pki_types::SubjectPublicKeyInfoDer;
+
+    use super::*;
+    use crate::crypto::{TEST_PROVIDER, tls12_suite};
+
+    #[test]
+    fn debug_of_session_types() {
+        let tls12 = Tls12Session::new(
+            tls12_suite(CipherSuite(0xff12), &TEST_PROVIDER),
+            SessionId::empty(),
+            Arc::new(SizedPayload::empty()),
+            &[0xa5; 48],
+            VerifiedIdentity::assertion(Identity::RawPublicKey(SubjectPublicKeyInfoDer::from(
+                &b"spki"[..],
+            ))),
+            UnixTime::since_unix_epoch(Duration::from_secs(1)),
+            Duration::from_secs(2),
+            true,
+        );
+        assert_eq!(
+            format!("{tls12:?}"),
+            "Tls12Session { suite: Tls12CipherSuite { suite: 0xff12, .. }, session_id: , extended_ms: true, common: ClientSessionCommon { ticket: , epoch: 1, lifetime: 2s, peer_identity: VerifiedIdentity(RawPublicKey(SubjectPublicKeyInfoDer(0x73706b69))) }, .. }"
+        );
+
+        let tls13 = Tls13Session::new(
+            &NewSessionTicketPayloadTls13::new(
+                Duration::from_secs(2),
+                3,
+                [4u8; 32],
+                Vec::from([5]),
+            ),
+            Tls13ClientSessionInput {
+                suite: Tls13ProtocolSuite::Tcp(TEST_PROVIDER.tls13_cipher_suites[0]),
+                peer_identity: VerifiedIdentity::assertion(Identity::RawPublicKey(
+                    SubjectPublicKeyInfoDer::from(&b"spki"[..]),
+                )),
+                quic_params: None,
+            },
+            &[0xa5; 32],
+            UnixTime::since_unix_epoch(Duration::from_secs(1)),
+        );
+        assert_eq!(
+            format!("{tls13:?}"),
+            "Tls13Session { suite: Tcp(Tls13CipherSuite { suite: 0xff13, .. }), age_add: 3, max_early_data_size: 0, common: ClientSessionCommon { ticket: 05, epoch: 1, lifetime: 2s, peer_identity: VerifiedIdentity(RawPublicKey(SubjectPublicKeyInfoDer(0x73706b69))) }, quic_params: , .. }"
+        );
+    }
+}
```

---

### Incident Patch 4: `7edd643d` (2026-08-24)
**Commit Message**: Share handshake state dispatch between QUIC and TCP

`ServerNext` and `ClientNext` name the states a handshake can be in for
any transport, so each public `TryFrom` impl becomes a mapping from those
onto its own transport's handshake enum.

**File**: `rustls/src/client/connection.rs` (modified, +11/-21)
```diff
@@ -1,6 +1,6 @@
 use alloc::vec::Vec;
+use core::fmt;
 use core::ops::Deref;
-use core::{fmt, mem};
 
 use pki_types::{FipsStatus, ServerName};
 
@@ -11,8 +11,8 @@ use crate::common_state::{CommonState, ConnectionOutputs, EarlyDataEvent, Event,
 use crate::conn::private::SideOutput;
 use crate::conn::split::SplitConnection;
 use crate::conn::{
-    Connection, ConnectionCommon, Core, KeyingMaterialExporter, MessageHandler, SideCommonOutput,
-    SideData, StateMachine, Tcp, VerifyPeerIdentity,
+    ClientNext, Connection, ConnectionCommon, Core, KeyingMaterialExporter, MessageHandler,
+    SideCommonOutput, SideData, Tcp, VerifyPeerIdentity,
 };
 #[cfg(doc)]
 use crate::crypto;
@@ -308,26 +308,16 @@ pub enum ClientHandshake {
     Complete(SplitConnection<ClientSide>),
 }
 
-impl TryFrom<ConnectionCommon<ClientSide>> for ClientHandshake {
+impl TryFrom<Core<ClientSide, Tcp>> for ClientHandshake {
     type Error = Error;
 
-    fn try_from(mut inner: ConnectionCommon<ClientSide>) -> Result<Self, Error> {
-        const MISUSED: Error = Error::Unreachable("forgot to restore state");
+    fn try_from(core: Core<ClientSide, Tcp>) -> Result<Self, Error> {
+        Ok(match ClientNext::try_from(core)? {
+            ClientNext::NeedsInput(core) => Self::NeedsInput(NeedsInput(core)),
 
-        Ok(match mem::replace(&mut inner.state, Err(MISUSED))? {
-            ClientState::VerifyServerIdentity(verify_identity) => Self::VerifyServerIdentity(
-                VerifyPeerIdentity::new(Core::new(inner, Tcp), verify_identity),
-            ),
+            ClientNext::VerifyServerIdentity(verify) => Self::VerifyServerIdentity(verify),
 
-            state if state.is_traffic() => {
-                inner.state = Ok(state);
-                Self::Complete(SplitConnection::try_from(inner)?)
-            }
-
-            state => {
-                inner.state = Ok(state);
-                Self::NeedsInput(NeedsInput::new(inner))
-            }
+            ClientNext::Complete(core) => Self::Complete(SplitConnection::try_from(core.inner)?),
         })
     }
 }
@@ -446,8 +436,8 @@ impl SideData for ClientSide {
     type PeerIdentity<'a> = ServerIdentity<'static, 'a>;
 
     #[expect(private_interfaces)]
-    fn tcp_handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error> {
-        ClientHandshake::try_from(common)
+    fn tcp_handshake_from_core(core: Core<Self, Tcp>) -> Result<Self::Handshake, Error> {
+        ClientHandshake::try_from(core)
     }
 
     #[expect(private_interfaces)]
```

**File**: `rustls/src/client/mod.rs` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ mod handy;
 pub use handy::ClientSessionMemoryCache;
 
 mod hs;
-pub(crate) use hs::ClientHandler;
+pub(crate) use hs::{ClientHandler, ClientState};
 
 mod tls12;
 pub(crate) use tls12::TLS12_HANDLER;
```

**File**: `rustls/src/conn/handshake.rs` (modified, +82/-22)
```diff
@@ -9,20 +9,23 @@
 
 use alloc::boxed::Box;
 use alloc::vec::Vec;
-use core::fmt;
+use core::{fmt, mem};
 
 use super::{
     ConnectionCommon, MessageIter, MessageIterMode, NeedsInput, SideCommonOutput, SideData,
-    VerifySidePeerIdentity,
+    StateMachine, VerifySidePeerIdentity,
 };
 use crate::TlsInputBuffer;
+use crate::client::{ClientSide, ClientState};
 use crate::common_state::maybe_send_fatal_alert;
 use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::Payload;
 use crate::error::Error;
 use crate::msgs::{ServerExtensionsInput, TransportParameters};
 use crate::quic::{self, Quic, QuicEvent, QuicOutput};
-use crate::server::{ChooseConfig, ClientHello, ServerConfig, ServerHandshake, ServerSide};
+use crate::server::{
+    ChooseConfig, ClientHello, ServerConfig, ServerHandshake, ServerSide, ServerState,
+};
 use crate::sync::Arc;
 use crate::tracing::trace;
 
@@ -74,6 +77,80 @@ impl<Side: SideData, T: Transport> Core<Side, T> {
     }
 }
 
+/// The states a server handshake can be in, for any transport.
+pub(crate) enum ServerNext<T: Transport> {
+    NeedsInput(Core<ServerSide, T>),
+    ChooseConfig(Accepted<T>),
+    VerifyClientIdentity(VerifyPeerIdentity<ServerSide, T>),
+    Complete(Core<ServerSide, T>),
+}
+
+impl<T: Transport> TryFrom<Core<ServerSide, T>> for ServerNext<T> {
+    type Error = Error;
+
+    fn try_from(mut core: Core<ServerSide, T>) -> Result<Self, Error> {
+        const MISUSED: Error = Error::Unreachable("forgot to restore state");
+
+        Ok(match mem::replace(&mut core.inner.state, Err(MISUSED))? {
+            ServerState::ChooseConfig(choose_config) => Self::ChooseConfig(Accepted {
+                core,
+                choose_config,
+            }),
+
+            ServerState::VerifyClientIdentity(verify_identity) => {
+                Self::VerifyClientIdentity(VerifyPeerIdentity {
+                    core,
+                    verify_identity,
+                })
+            }
+
+            state if state.is_traffic() => {
+                core.inner.state = Ok(state);
+                Self::Complete(core)
+            }
+
+            state => {
+                core.inner.state = Ok(state);
+                Self::NeedsInput(core)
+            }
+        })
+    }
+}
+
+/// The states a client handshake can be in, for any transport.
+pub(crate) enum ClientNext<T: Transport> {
+    NeedsInput(Core<ClientSide, T>),
+    VerifyServerIdentity(VerifyPeerIdentity<ClientSide, T>),
+    Complete(Core<ClientSide, T>),
+}
+
+impl<T: Transport> TryFrom<Core<ClientSide, T>> for ClientNext<T> {
+    type Error = Error;
+
+    fn try_from(mut core: Core<ClientSide, T>) -> Result<Self, Error> {
+        const MISUSED: Error = Error::Unreachable("forgot to restore state");
+
+        Ok(match mem::replace(&mut core.inner.state, Err(MISUSED))? {
+            ClientState::VerifyServerIdentity(verify_identity) => {
+                Self::VerifyServerIdentity(VerifyPeerIdentity {
+                    core,
+                    verify_identity,
+                })
+            }
+
+            state if state.is_traffic() => {
+                core.inner.state = Ok(state);
+                Self::Complete(core)
+            }
+
+            state => {
+                core.inner.state = Ok(state);
+                Self::NeedsInput(core)
+            }
+        })
+    }
+}
+
 /// Represents that a `ClientHello` message has been received.
 ///
 /// The handshake can be progressed by choosing a [`ServerConfig`] based on
@@ -85,13 +162,6 @@ pub struct Accepted<T: Transport> {
 }
 
 impl<T: Transport> Accepted<T> {
-    pub(crate) fn new(core: Core<ServerSide, T>, choose_config: Box<ChooseConfig>) -> Self {
-        Self {
-            core,
-            choose_config,
-        }
-    }
-
     /// Get the [`ClientHello`] for this connection.
     pub fn client_hello(&self) -> ClientHello<'_> {
         let ch = self.choose_config.client_hello();
@@ -139,7 +209,7 @@ impl Accepted<Tcp> {
         tls: &mut Vec<u8>,
     ) -> Result<ServerHandshake, Error> {
         let core = self.partial_choose_config(config, ServerExtensionsInput::default(), tls)?;
-        Ok(ServerHandshake::NeedsInput(NeedsInput::new(core.inner)))
+        Ok(ServerHandshake::NeedsInput(NeedsInput(core)))
     }
 }
 
@@ -218,16 +288,6 @@ pub struct VerifyPeerIdentity<Side: SideData, T: Transport> {
 }
 
 impl<Side: SideData, T: Transport> VerifyPeerIdentity<Side, T> {
-    pub(crate) fn new(
-        core: Core<Side, T>,
-        verify_identity: Box<dyn VerifySidePeerIdentity<Side>>,
-    ) -> Self {
-        Self {
-            core,
-            verify_identity,
-        }
-    }
-
     /// Inspect the identity that the peer has provided.
     pub fn presented_identity(&self) -> Result<Side::PeerIdentity<'_>, Error> {
         self.verify_identity
@@ -256,7 +316,7 @@ impl<Side: SideData> VerifyPeerIdentity<Side, Tcp> {
         tls: &mut Vec<u8>,
     ) -> Result<Side::Handshake, Error> {
      
```

**File**: `rustls/src/conn/mod.rs` (modified, +4/-4)
```diff
@@ -25,7 +25,7 @@ pub mod kernel;
 
 mod handshake;
 pub use handshake::{Accepted, Tcp, Transport, VerifyPeerIdentity};
-pub(crate) use handshake::{Core, sealed};
+pub(crate) use handshake::{ClientNext, Core, ServerNext, sealed};
 
 mod receive;
 pub(crate) use receive::{
@@ -144,7 +144,7 @@ pub trait Connection: fmt::Debug + Deref<Target = ConnectionOutputs> {
 /// More data needs to be supplied to make progress.
 ///
 /// Provide the data to [`Self::process()`].
-pub struct NeedsInput<Side: SideData>(Core<Side, Tcp>);
+pub struct NeedsInput<Side: SideData>(pub(crate) Core<Side, Tcp>);
 
 impl<Side: SideData> NeedsInput<Side> {
     pub(crate) fn new(inner: ConnectionCommon<Side>) -> Self {
@@ -168,7 +168,7 @@ impl<Side: SideData> NeedsInput<Side> {
         input: &mut dyn TlsInputBuffer,
         tls: &mut Vec<u8>,
     ) -> Result<Side::Handshake, Error> {
-        Side::tcp_handshake_from_inner(self.0.process(input, tls)?.inner)
+        Side::tcp_handshake_from_core(self.0.process(input, tls)?)
     }
 }
 
@@ -712,7 +712,7 @@ pub trait SideData: private::Side + Sized {
 
     #[doc(hidden)]
     #[expect(private_interfaces)]
-    fn tcp_handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error>;
+    fn tcp_handshake_from_core(core: Core<Self, Tcp>) -> Result<Self::Handshake, Error>;
 
     #[doc(hidden)]
     #[expect(private_interfaces)]
```

**File**: `rustls/src/quic.rs` (modified, +16/-42)
```diff
@@ -11,13 +11,13 @@ pub use crate::common_state::Side;
 use crate::common_state::{CommonState, ConnectionOutputs, Protocol};
 use crate::conn::{
     Accepted, ConnectionCommon, Core, KeyingMaterialExporter, MessageIter, MessageIterMode,
-    SideData, StateMachine, Transport, VerifyPeerIdentity,
+    ServerNext, SideData, Transport, VerifyPeerIdentity,
 };
 use crate::crypto::cipher::{AeadKey, Iv, Payload};
 use crate::crypto::tls13::{Hkdf, HkdfExpander, OkmBlock};
 use crate::error::{ApiMisuse, Error};
 use crate::msgs::{Message, MessagePayload, ServerExtensionsInput, TransportParameters};
-use crate::server::{ServerConfig, ServerSide, ServerState};
+use crate::server::{ServerConfig, ServerSide};
 use crate::suites::SupportedCipherSuite;
 use crate::sync::Arc;
 use crate::tls13::Tls13CipherSuite;
@@ -333,45 +333,23 @@ impl ServerHandshake {
     }
 
     pub(crate) fn from_core(
-        core: Core<ServerSide, Quic>,
+        mut core: Core<ServerSide, Quic>,
         output: &mut Vec<QuicEvent>,
     ) -> Result<Self, Error> {
-        let Core {
-            inner,
-            mut transport,
-        } = core;
+        output.extend(core.transport.events());
 
-        output.extend(transport.events());
-        Self::try_from(QuicCommon::new(inner, transport))
-    }
-}
+        Ok(match ServerNext::try_from(core)? {
+            ServerNext::NeedsInput(core) => Self::NeedsInput(NeedsInput(core)),
 
-impl TryFrom<QuicCommon<ServerSide>> for ServerHandshake {
-    type Error = Error;
+            ServerNext::ChooseConfig(accepted) => Self::Accepted(accepted),
 
-    fn try_from(mut inner: QuicCommon<ServerSide>) -> Result<Self, Error> {
-        const MISUSED: Error = Error::Unreachable("forgot to restore state");
+            ServerNext::VerifyClientIdentity(verify) => Self::VerifyClientIdentity(verify),
 
-        Ok(match mem::replace(&mut inner.common.state, Err(MISUSED))? {
-            ServerState::ChooseConfig(choose_config) => {
-                let QuicCommon { common, quic } = inner;
-                Self::Accepted(Accepted::new(Core::new(common, quic), choose_config))
-            }
-
-            ServerState::VerifyClientIdentity(verify) => {
-                let QuicCommon { common, quic } = inner;
-                Self::VerifyClientIdentity(VerifyPeerIdentity::new(Core::new(common, quic), verify))
-            }
-
-            state if state.is_traffic() => {
-                inner.common.state = Ok(state);
-                Self::Complete(ServerConnection { inner })
-            }
-
-            state => {
-                inner.common.state = Ok(state);
-                let QuicCommon { common, quic } = inner;
-                Self::NeedsInput(NeedsInput(Core::new(common, quic)))
+            ServerNext::Complete(core) => {
+                let Core { inner, transport } = core;
+                Self::Complete(ServerConnection {
+                    inner: QuicCommon::new(inner, transport),
+                })
             }
         })
     }
@@ -424,6 +402,8 @@ impl NeedsInput {
     /// - a [`ServerHandshake::NeedsInput`] if more data is required.
     /// - a [`ServerHandshake::Accepted`] if a whole `ClientHello` has been received,
     ///   and a choice of [`ServerConfig`] is required to continue.
+    /// - a [`ServerHandshake::VerifyClientIdentity`] if the client's identity requires
+    ///   verification.
     /// - a [`ServerHandshake::Complete`] if the handshake is complete.
     ///
     /// `output` has any resulting handshake messages or key changes appended to it.
@@ -438,13 +418,7 @@ impl NeedsInput {
             .deframer
             .input_quic(input.slice_mut())?;
 
-        let Core {
-            inner,
-            mut transport,
-        } = self.0.process(input, &mut Vec::new())?;
-
-        output.extend(transport.events());
-        ServerHandshake::try_from(QuicCommon::new(inner, transport))
+        ServerHandshake::from_core(self.0.process(input, &mut Vec::new())?, output)
     }
 }
 
```

**File**: `rustls/src/server/connection.rs` (modified, +11/-23)
```diff
@@ -1,7 +1,7 @@
 use alloc::boxed::Box;
 use alloc::vec::Vec;
+use core::fmt;
 use core::ops::Deref;
-use core::{fmt, mem};
 
 use pki_types::{DnsName, FipsStatus};
 
@@ -11,7 +11,7 @@ use crate::conn::private::SideOutput;
 use crate::conn::split::SplitConnection;
 use crate::conn::{
     Accepted, Connection, ConnectionCommon, Core, KeyingMaterialExporter, MessageHandler,
-    NeedsInput, SideData, StateMachine, Tcp, TlsInputBuffer, VerifyPeerIdentity,
+    NeedsInput, ServerNext, SideData, Tcp, TlsInputBuffer, VerifyPeerIdentity,
 };
 #[cfg(doc)]
 use crate::crypto;
@@ -266,30 +266,18 @@ impl ServerHandshake {
     }
 }
 
-impl TryFrom<ConnectionCommon<ServerSide>> for ServerHandshake {
+impl TryFrom<Core<ServerSide, Tcp>> for ServerHandshake {
     type Error = Error;
 
-    fn try_from(mut inner: ConnectionCommon<ServerSide>) -> Result<Self, Error> {
-        const MISUSED: Error = Error::Unreachable("forgot to restore state");
+    fn try_from(core: Core<ServerSide, Tcp>) -> Result<Self, Error> {
+        Ok(match ServerNext::try_from(core)? {
+            ServerNext::NeedsInput(core) => Self::NeedsInput(NeedsInput(core)),
 
-        Ok(match mem::replace(&mut inner.state, Err(MISUSED))? {
-            ServerState::ChooseConfig(choose_config) => {
-                Self::Accepted(Accepted::new(Core::new(inner, Tcp), choose_config))
-            }
+            ServerNext::ChooseConfig(accepted) => Self::Accepted(accepted),
 
-            ServerState::VerifyClientIdentity(verify_identity) => Self::VerifyClientIdentity(
-                VerifyPeerIdentity::new(Core::new(inner, Tcp), verify_identity),
-            ),
+            ServerNext::VerifyClientIdentity(verify) => Self::VerifyClientIdentity(verify),
 
-            state if state.is_traffic() => {
-                inner.state = Ok(state);
-                Self::Complete(SplitConnection::try_from(inner)?)
-            }
-
-            state => {
-                inner.state = Ok(state);
-                Self::NeedsInput(NeedsInput::new(inner))
-            }
+            ServerNext::Complete(core) => Self::Complete(SplitConnection::try_from(core.inner)?),
         })
     }
 }
@@ -306,8 +294,8 @@ impl SideData for ServerSide {
     type PeerIdentity<'a> = ClientIdentity<'static, 'a>;
 
     #[expect(private_interfaces)]
-    fn tcp_handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error> {
-        ServerHandshake::try_from(common)
+    fn tcp_handshake_from_core(core: Core<Self, Tcp>) -> Result<Self::Handshake, Error> {
+        ServerHandshake::try_from(core)
     }
 
     #[expect(private_interfaces)]
```

---

### Incident Patch 5: `48875943` (2026-09-02)
**Commit Message**: Share peer identity verification type between QUIC and TCP

**File**: `rustls-test/tests/api/client_cert_verifier.rs` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@ use rustls::enums::ProtocolVersion;
 use rustls::error::{AlertDescription, CertificateError, Error, InvalidMessage, PeerMisbehaved};
 use rustls::server::{ServerHandshake, ServerSide};
 use rustls::{
-    ClientConfig, Connection, ServerConfig, ServerConnection, SliceInput, VecInput,
+    ClientConfig, Connection, ServerConfig, ServerConnection, SliceInput, Tcp, VecInput,
     VerifyPeerIdentity,
 };
 use rustls_test::{
@@ -260,7 +260,7 @@ fn server_external_verifier_test_setup(
     client_config: Arc<ClientConfig>,
     server_config: Arc<ServerConfig>,
 ) -> (
-    VerifyPeerIdentity<ServerSide>,
+    VerifyPeerIdentity<ServerSide, Tcp>,
     Vec<u8>,
     ClientConnection,
     Vec<u8>,
```

**File**: `rustls-test/tests/api/server_cert_verifier.rs` (modified, +2/-2)
```diff
@@ -22,7 +22,7 @@ use rustls::error::{
 use rustls::server::{ClientHello, ParsedCertificate, ServerCredentialResolver};
 use rustls::{
     ClientConfig, Connection, DistinguishedName, RootCertStore, ServerConfig, ServerConnection,
-    SliceInput, VecInput, VerifyPeerIdentity,
+    SliceInput, Tcp, VecInput, VerifyPeerIdentity,
 };
 use rustls_test::{
     ErrorFromPeer, KeyType, MockServerVerifier, MultiTest, certificate_error_expecting_name,
@@ -298,7 +298,7 @@ fn client_external_verifier_test_setup(
     client_config: Arc<ClientConfig>,
     server_config: Arc<ServerConfig>,
 ) -> (
-    VerifyPeerIdentity<ClientSide>,
+    VerifyPeerIdentity<ClientSide, Tcp>,
     Vec<u8>,
     ServerConnection,
     Vec<u8>,
```

**File**: `rustls/src/client/connection.rs` (modified, +17/-10)
```diff
@@ -11,8 +11,8 @@ use crate::common_state::{CommonState, ConnectionOutputs, EarlyDataEvent, Event,
 use crate::conn::private::SideOutput;
 use crate::conn::split::SplitConnection;
 use crate::conn::{
-    Connection, ConnectionCommon, KeyingMaterialExporter, MessageHandler, SideCommonOutput,
-    SideData, StateMachine, VerifyPeerIdentity,
+    Connection, ConnectionCommon, Core, KeyingMaterialExporter, MessageHandler, SideCommonOutput,
+    SideData, StateMachine, Tcp, VerifyPeerIdentity,
 };
 #[cfg(doc)]
 use crate::crypto;
@@ -300,7 +300,7 @@ pub enum ClientHandshake {
     /// The server's presented identity must be verified.
     ///
     /// See [`VerifyPeerIdentity`] for how to proceed.
-    VerifyServerIdentity(VerifyPeerIdentity<ClientSide>),
+    VerifyServerIdentity(VerifyPeerIdentity<ClientSide, Tcp>),
 
     /// The handshake is complete.
     ///
@@ -315,12 +315,9 @@ impl TryFrom<ConnectionCommon<ClientSide>> for ClientHandshake {
         const MISUSED: Error = Error::Unreachable("forgot to restore state");
 
         Ok(match mem::replace(&mut inner.state, Err(MISUSED))? {
-            ClientState::VerifyServerIdentity(verify_identity) => {
-                Self::VerifyServerIdentity(VerifyPeerIdentity {
-                    inner,
-                    verify_identity,
-                })
-            }
+            ClientState::VerifyServerIdentity(verify_identity) => Self::VerifyServerIdentity(
+                VerifyPeerIdentity::new(Core::new(inner, Tcp), verify_identity),
+            ),
 
             state if state.is_traffic() => {
                 inner.state = Ok(state);
@@ -444,12 +441,22 @@ pub struct ClientSide;
 
 impl SideData for ClientSide {
     type Handshake = ClientHandshake;
+    type QuicHandshake = ();
+
     type PeerIdentity<'a> = ServerIdentity<'static, 'a>;
 
     #[expect(private_interfaces)]
-    fn handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error> {
+    fn tcp_handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error> {
         ClientHandshake::try_from(common)
     }
+
+    #[expect(private_interfaces)]
+    fn quic_handshake_from_core(
+        _core: Core<Self, Quic>,
+        _output: &mut Vec<quic::QuicEvent>,
+    ) -> Result<Self::QuicHandshake, Error> {
+        todo!("nyi")
+    }
 }
 
 impl crate::conn::private::Side for ClientSide {
```

**File**: `rustls/src/conn/handshake.rs` (modified, +154/-13)
```diff
@@ -1,23 +1,27 @@
 //! Transport-generic handshake machinery.
 //!
-//! [`Accepted`] is public and generic over [`Transport`].
+//! [`Accepted`] and [`VerifyPeerIdentity`] are public and generic over [`Transport`].
 //!
-//! The remaining public handshake types (`rustls::{NeedsInput, VerifyPeerIdentity,
-//! ClientHandshake, ServerHandshake}` and their `rustls::quic` counterparts) are thin shims
-//! over the types in this module.  The shims own the public signatures and documentation; the
-//! shared underlying logic lives here, parameterised by [`Transport`].
+//! The remaining public handshake types (`rustls::{NeedsInput, ClientHandshake,
+//! ServerHandshake}` and their `rustls::quic` counterparts) are thin shims over the types
+//! in this module.  The shims own the public signatures and documentation; the shared
+//! underlying logic lives here, parameterised by [`Transport`].
 
 use alloc::boxed::Box;
 use alloc::vec::Vec;
 use core::fmt;
 
-use super::{ConnectionCommon, MessageIter, MessageIterMode, NeedsInput, SideData};
+use super::{
+    ConnectionCommon, MessageIter, MessageIterMode, NeedsInput, SideCommonOutput, SideData,
+    VerifySidePeerIdentity,
+};
 use crate::TlsInputBuffer;
 use crate::common_state::maybe_send_fatal_alert;
+use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::Payload;
 use crate::error::Error;
 use crate::msgs::{ServerExtensionsInput, TransportParameters};
-use crate::quic::{self, Quic, QuicCommon, QuicEvent, QuicOutput};
+use crate::quic::{self, Quic, QuicEvent, QuicOutput};
 use crate::server::{ChooseConfig, ClientHello, ServerConfig, ServerHandshake, ServerSide};
 use crate::sync::Arc;
 use crate::tracing::trace;
@@ -166,15 +170,11 @@ impl Accepted<Quic> {
         };
 
         let mut tls = Vec::new();
-        let Core {
-            inner,
-            mut transport,
-        } = self.partial_choose_config(config, exts, &mut tls)?;
+        let core = self.partial_choose_config(config, exts, &mut tls)?;
 
         // In QUIC mode, handshake output is emitted via `QuicEvent`s, not `tls`.
         debug_assert!(tls.is_empty());
-        output.extend(transport.events());
-        quic::ServerHandshake::try_from(QuicCommon::new(inner, transport))
+        quic::ServerHandshake::from_core(core, output)
     }
 }
 
@@ -185,6 +185,147 @@ impl<T: Transport> fmt::Debug for Accepted<T> {
     }
 }
 
+/// The peer's presented identity must be verified.
+///
+/// The caller has three choices:
+///
+/// - Call [`Self::with_config()`].  This calls the configured verifier trait
+///   ([`ClientVerifier::verify_identity()`][] or [`ServerVerifier::verify_identity()`][])
+///   synchronously.
+///
+/// - Call [`Self::presented_identity()`] to obtain the peer's presented identity,
+///   verify that outside the library (perhaps asynchronously), and then continue the handshake with
+///   [`Self::continue_with()`].
+///
+///   If the verification fails, the error can be passed into [`Self::continue_with()`] to follow
+///   a uniform error handling path.
+///
+/// - Abandon the handshake by discarding this object.
+///
+/// The returned object is a further handshake state for this side.  Commonly this will
+/// contain a [`ServerHandshake::NeedsInput`][], [`ClientHandshake::NeedsInput`][] or [`quic::ServerHandshake::NeedsInput`][]
+/// which will accept and process further data.
+///
+/// [`ClientVerifier::verify_identity()`]: crate::verify::ClientVerifier::verify_identity
+/// [`ServerVerifier::verify_identity()`]: crate::verify::ServerVerifier::verify_identity
+/// [`ServerHandshake::NeedsInput`]: crate::server::ServerHandshake::NeedsInput
+/// [`ClientHandshake::NeedsInput`]: crate::client::ClientHandshake::NeedsInput
+/// [`quic::ServerHandshake::NeedsInput`]: crate::quic::ServerHandshake::NeedsInput
+pub struct VerifyPeerIdentity<Side: SideData, T: Transport> {
+    // invariant: `core.inner.state` is `Err(_)` and requires restoring
+    core: Core<Side, T>,
+    verify_identity: Box<dyn VerifySidePeerIdentity<Side>>,
+}
+
+impl<Side: SideData, T: Transport> VerifyPeerIdentity<Side, T> {
+    pub(crate) fn new(
+        core: Core<Side, T>,
+        verify_identity: Box<dyn VerifySidePeerIdentity<Side>>,
+    ) -> Self {
+        Self {
+            core,
+            verify_identity,
+        }
+    }
+
+    /// Inspect the identity that the peer has provided.
+    pub fn presented_identity(&self) -> Result<Side::PeerIdentity<'_>, Error> {
+        self.verify_identity
+            .presented_identity()
+    }
+}
+
+impl<Side: SideData> VerifyPeerIdentity<Side, Tcp> {
+    /// Progress the handshake by calling the pre-configured certificate verification trait.
+    pub fn with_config(self, tls: &mut Vec<u8>) -> Result<Side::Handshake, Error> {
+        let result = self
+            .verify_identity
+            .verify_with_config();
+        self.continue_with(result, tls)
+    }
+
+    /// Progress the handshake by incorporating the result of an external verifi
```

**File**: `rustls/src/conn/mod.rs` (modified, +14/-93)
```diff
@@ -8,14 +8,13 @@ use pki_types::FipsStatus;
 
 use crate::common_state::{
     CommonState, ConnectionOutput, ConnectionOutputs, Event, Output, OutputEvent,
-    maybe_send_fatal_alert,
 };
 use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::{OutboundPlain, Payload};
 use crate::error::{ApiMisuse, Error};
 use crate::kernel::KernelState;
 use crate::msgs::{Delocator, Message, Random, ServerExtensionsInput};
-use crate::quic::QuicOutput;
+use crate::quic::{Quic, QuicEvent, QuicOutput};
 use crate::server::{ChooseConfig, ServerConfig, ServerSide};
 use crate::suites::{ExtractedSecrets, PartiallyExtractedSecrets};
 use crate::sync::Arc;
@@ -25,7 +24,7 @@ use crate::tls13::key_schedule::KeyScheduleTrafficSend;
 pub mod kernel;
 
 mod handshake;
-pub use handshake::{Accepted, Tcp, Transport};
+pub use handshake::{Accepted, Tcp, Transport, VerifyPeerIdentity};
 pub(crate) use handshake::{Core, sealed};
 
 mod receive;
@@ -169,7 +168,7 @@ impl<Side: SideData> NeedsInput<Side> {
         input: &mut dyn TlsInputBuffer,
         tls: &mut Vec<u8>,
     ) -> Result<Side::Handshake, Error> {
-        Side::handshake_from_inner(self.0.process(input, tls)?.inner)
+        Side::tcp_handshake_from_inner(self.0.process(input, tls)?.inner)
     }
 }
 
@@ -180,93 +179,6 @@ impl<S: SideData> fmt::Debug for NeedsInput<S> {
     }
 }
 
-/// The peer's presented identity must be verified.
-///
-/// The caller has three choices:
-///
-/// - Call [`Self::with_config()`].  This calls the configured verifier trait
-///   ([`ClientVerifier::verify_identity()`][] or [`ServerVerifier::verify_identity()`][])
-///   synchronously.
-///
-/// - Call [`Self::presented_identity()`] to obtain the peer's presented identity,
-///   verify that outside the library (perhaps asynchronously), and then continue the handshake with
-///   [`Self::continue_with()`].
-///
-///   If the verification fails, the error can be passed into [`Self::continue_with()`] to follow
-///   a uniform error handling path.
-///
-/// - Abandon the handshake by discarding this object.
-///
-/// The returned object is a further handshake state for this side.  Commonly this will
-/// contain a [`NeedsInput`] which will accept and process further data.
-///
-/// [`ClientVerifier::verify_identity()`]: crate::verify::ClientVerifier::verify_identity
-/// [`ServerVerifier::verify_identity()`]: crate::verify::ServerVerifier::verify_identity
-pub struct VerifyPeerIdentity<Side: SideData> {
-    // invariant: `inner.state` is `Err(_)` and requires restoring
-    pub(crate) inner: ConnectionCommon<Side>,
-    pub(crate) verify_identity: Box<dyn VerifySidePeerIdentity<Side>>,
-}
-
-impl<Side: SideData> VerifyPeerIdentity<Side> {
-    /// Progress the handshake by calling the pre-configured certificate verification trait.
-    pub fn with_config(self, tls: &mut Vec<u8>) -> Result<Side::Handshake, Error> {
-        let verified = self
-            .verify_identity
-            .verify_with_config();
-        self.continue_with(verified, tls)
-    }
-
-    /// Progress the handshake by incorporating the result of an external verification.
-    ///
-    /// Further data to send to the peer may be appended to `tls`.
-    ///
-    /// If `verification_result` is an error, this error is returned and the handshake terminates.
-    /// An alert may be appended to `tls` for sending to the peer.
-    pub fn continue_with(
-        self,
-        verification_result: Result<VerifiedIdentity<'static>, Error>,
-        tls: &mut Vec<u8>,
-    ) -> Result<Side::Handshake, Error> {
-        let Self {
-            mut inner,
-            verify_identity,
-        } = self;
-
-        let result = verification_result.and_then(|verified| {
-            verify_identity.continue_with(
-                verified,
-                &mut SideCommonOutput {
-                    side: &mut inner.side,
-                    quic: None,
-                    common: &mut inner.common,
-                    tls,
-                },
-            )
-        });
-
-        if let Err(err) = &result {
-            maybe_send_fatal_alert(&mut inner.common.send, err, tls);
-        }
-
-        inner.state = result;
-        Side::handshake_from_inner(inner)
-    }
-
-    /// Inspect the identity that the peer has provided.
-    pub fn presented_identity(&self) -> Result<Side::PeerIdentity<'_>, Error> {
-        self.verify_identity
-            .presented_identity()
-    }
-}
-
-impl<Side: SideData> fmt::Debug for VerifyPeerIdentity<Side> {
-    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
-        f.debug_struct("VerifyPeerIdentity")
-            .finish_non_exhaustive()
-    }
-}
-
 /// Dynamically-dispatched state machine, to maintain static unreachability of
 /// per-protocol-version code.
 pub(crate) trait State<Side: SideData>: Send + Sync {
@@ -790,15 +702,24 @@ impl<'q> Output<'_> for SideCommonOutput<'_, 'q> {
 /// Data specific to the peer's side (client or server).
 #[expect(priva
```

**File**: `rustls/src/quic.rs` (modified, +18/-87)
```diff
@@ -11,9 +11,8 @@ pub use crate::common_state::Side;
 use crate::common_state::{CommonState, ConnectionOutputs, Protocol};
 use crate::conn::{
     Accepted, ConnectionCommon, Core, KeyingMaterialExporter, MessageIter, MessageIterMode,
-    SideCommonOutput, SideData, StateMachine, Transport, VerifySidePeerIdentity,
+    SideData, StateMachine, Transport, VerifyPeerIdentity,
 };
-use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::{AeadKey, Iv, Payload};
 use crate::crypto::tls13::{Hkdf, HkdfExpander, OkmBlock};
 use crate::error::{ApiMisuse, Error};
@@ -25,7 +24,6 @@ use crate::tls13::Tls13CipherSuite;
 use crate::tls13::key_schedule::{
     hkdf_expand_label, hkdf_expand_label_aead_key, hkdf_expand_label_block,
 };
-use crate::verify::ClientIdentity;
 
 /// A QUIC client or server connection.
 pub trait Connection: fmt::Debug + Deref<Target = ConnectionOutputs> {
@@ -307,8 +305,8 @@ pub enum ServerHandshake {
 
     /// The client's presented identity must be verified.
     ///
-    /// See [`VerifyClientIdentity`] for how to proceed.
-    VerifyClientIdentity(VerifyClientIdentity),
+    /// See [`VerifyPeerIdentity<ServerSide, Quic>`] for how to proceed.
+    VerifyClientIdentity(VerifyPeerIdentity<ServerSide, Quic>),
 
     /// The handshake is complete.
     Complete(ServerConnection),
@@ -333,6 +331,19 @@ impl ServerHandshake {
             },
         ))
     }
+
+    pub(crate) fn from_core(
+        core: Core<ServerSide, Quic>,
+        output: &mut Vec<QuicEvent>,
+    ) -> Result<Self, Error> {
+        let Core {
+            inner,
+            mut transport,
+        } = core;
+
+        output.extend(transport.events());
+        Self::try_from(QuicCommon::new(inner, transport))
+    }
 }
 
 impl TryFrom<QuicCommon<ServerSide>> for ServerHandshake {
@@ -348,7 +359,8 @@ impl TryFrom<QuicCommon<ServerSide>> for ServerHandshake {
             }
 
             ServerState::VerifyClientIdentity(verify) => {
-                Self::VerifyClientIdentity(VerifyClientIdentity { inner, verify })
+                let QuicCommon { common, quic } = inner;
+                Self::VerifyClientIdentity(VerifyPeerIdentity::new(Core::new(common, quic), verify))
             }
 
             state if state.is_traffic() => {
@@ -471,87 +483,6 @@ pub(crate) fn check_server_config(config: &ServerConfig) -> Result<(), Error> {
     Ok(())
 }
 
-/// The client's presented identity must be verified.
-///
-/// The caller has three choices:
-///
-/// - Call [`Self::with_config()`].  This calls [`ClientVerifier::verify_identity()`][]
-///   synchronously.
-///
-/// - Call [`Self::presented_identity()`] to obtain the peer's presented identity,
-///   verify that outside the library (perhaps asynchronously), and then continue the handshake with
-///   [`Self::continue_with()`].
-///
-///   If the verification fails, the error can be passed into [`Self::continue_with()`] to follow
-///   a uniform error handling path.
-///
-/// - Abandon the handshake by discarding this object.
-///
-/// The returned object is a further [`ServerHandshake`].  Commonly this will be a
-/// [`ServerHandshake::NeedsInput`] which will accept and process further data.
-///
-/// [`ClientVerifier::verify_identity()`]: crate::verify::ClientVerifier::verify_identity
-pub struct VerifyClientIdentity {
-    // invariant: `inner.state` is `Err(_)` and requires restoring
-    inner: QuicCommon<ServerSide>,
-    verify: Box<dyn VerifySidePeerIdentity<ServerSide>>,
-}
-
-impl VerifyClientIdentity {
-    /// Progress the handshake by calling the pre-configured certificate verification trait.
-    ///
-    /// Events are appended to `output`.
-    pub fn with_config(self, output: &mut Vec<QuicEvent>) -> Result<ServerHandshake, Error> {
-        let verified = self.verify.verify_with_config();
-        self.continue_with(verified, output)
-    }
-
-    /// Progress the handshake by incorporating the result of an external verification.
-    ///
-    /// If `verification_result` is an error, this error is returned and the handshake terminates.
-    ///
-    /// Events are appended to `output`.
-    pub fn continue_with(
-        self,
-        verification_result: Result<VerifiedIdentity<'static>, Error>,
-        output: &mut Vec<QuicEvent>,
-    ) -> Result<ServerHandshake, Error> {
-        let Self { mut inner, verify } = self;
-
-        let mut tls = Vec::new();
-        let result = verification_result.and_then(|verified| {
-            verify.continue_with(
-                verified,
-                &mut SideCommonOutput {
-                    side: &mut inner.common.side,
-                    quic: Some(&mut inner.quic),
-                    common: &mut inner.common.common,
-                    tls: &mut tls,
-                },
-            )
-        });
-
-        // In QUIC mode, handshake output is emitted via `QuicEvent`s, not `tls`.
-        debug_assert!(tls.is_empty());
-
-        inner.common.state = result;
-        output.exte
```

**File**: `rustls/src/server/connection.rs` (modified, +15/-8)
```diff
@@ -18,6 +18,7 @@ use crate::crypto;
 use crate::crypto::cipher::OutboundPlain;
 use crate::error::Error;
 use crate::msgs::ServerExtensionsInput;
+use crate::quic::{Quic, QuicEvent, ServerHandshake as QuicServerHandshake};
 use crate::server::hs::{ExpectClientHello, ReadClientHello, ServerState};
 use crate::suites::ExtractedSecrets;
 use crate::sync::Arc;
@@ -242,7 +243,7 @@ pub enum ServerHandshake {
     /// The client's presented identity must be verified.
     ///
     /// See [`VerifyPeerIdentity`] for how to proceed.
-    VerifyClientIdentity(VerifyPeerIdentity<ServerSide>),
+    VerifyClientIdentity(VerifyPeerIdentity<ServerSide, Tcp>),
 
     /// The handshake is complete.
     ///
@@ -276,12 +277,9 @@ impl TryFrom<ConnectionCommon<ServerSide>> for ServerHandshake {
                 Self::Accepted(Accepted::new(Core::new(inner, Tcp), choose_config))
             }
 
-            ServerState::VerifyClientIdentity(verify_identity) => {
-                Self::VerifyClientIdentity(VerifyPeerIdentity {
-                    inner,
-                    verify_identity,
-                })
-            }
+            ServerState::VerifyClientIdentity(verify_identity) => Self::VerifyClientIdentity(
+                VerifyPeerIdentity::new(Core::new(inner, Tcp), verify_identity),
+            ),
 
             state if state.is_traffic() => {
                 inner.state = Ok(state);
@@ -303,13 +301,22 @@ pub struct ServerSide;
 
 impl SideData for ServerSide {
     type Handshake = ServerHandshake;
+    type QuicHandshake = QuicServerHandshake;
 
     type PeerIdentity<'a> = ClientIdentity<'static, 'a>;
 
     #[expect(private_interfaces)]
-    fn handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error> {
+    fn tcp_handshake_from_inner(common: ConnectionCommon<Self>) -> Result<Self::Handshake, Error> {
         ServerHandshake::try_from(common)
     }
+
+    #[expect(private_interfaces)]
+    fn quic_handshake_from_core(
+        core: Core<Self, Quic>,
+        outputs: &mut Vec<QuicEvent>,
+    ) -> Result<Self::QuicHandshake, Error> {
+        QuicServerHandshake::from_core(core, outputs)
+    }
 }
 
 impl crate::conn::private::Side for ServerSide {
```

---

### Incident Patch 6: `3a86e235` (2026-09-02)
**Commit Message**: Share `Accepted` type between QUIC and TCP

**File**: `fuzz/fuzzers/server.rs` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ use std::io;
 use std::sync::Arc;
 
 use rustls::server::{Accepted, ServerHandshake};
-use rustls::{Connection, Error, ServerConfig, ServerConnection, VecInput};
+use rustls::{Connection, Error, ServerConfig, ServerConnection, Tcp, VecInput};
 
 fuzz_target!(|data: &[u8]| {
     match data.split_first() {
@@ -57,7 +57,7 @@ fn fuzz_handshake_api(data: &[u8]) {
     }
 }
 
-fn choose_config(accepted: Accepted, output: &mut Vec<u8>) -> Result<ServerHandshake, Error> {
+fn choose_config(accepted: Accepted<Tcp>, output: &mut Vec<u8>) -> Result<ServerHandshake, Error> {
     accepted.choose_config(
         Arc::new(
             ServerConfig::builder(rustls_fuzzing_provider::PROVIDER.into())
```

**File**: `rustls/src/conn/handshake.rs` (modified, +144/-12)
```diff
@@ -1,18 +1,26 @@
 //! Transport-generic handshake machinery.
 //!
-//! The public handshake types (`rustls::{NeedsInput, VerifyPeerIdentity, Accepted,
-//! ClientHandshake, ServerHandshake}` and their `rustls::quic` counterparts) are thin
-//! shims over the types in this module.
+//! [`Accepted`] is public and generic over [`Transport`].
 //!
-//! The shims own the public signatures and documentation; the shared underlying logic lives
-//! here, parameterised by [`Transport`].
+//! The remaining public handshake types (`rustls::{NeedsInput, VerifyPeerIdentity,
+//! ClientHandshake, ServerHandshake}` and their `rustls::quic` counterparts) are thin shims
+//! over the types in this module.  The shims own the public signatures and documentation; the
+//! shared underlying logic lives here, parameterised by [`Transport`].
 
+use alloc::boxed::Box;
 use alloc::vec::Vec;
+use core::fmt;
 
-use super::{ConnectionCommon, MessageIter, MessageIterMode, SideData};
+use super::{ConnectionCommon, MessageIter, MessageIterMode, NeedsInput, SideData};
 use crate::TlsInputBuffer;
+use crate::common_state::maybe_send_fatal_alert;
+use crate::crypto::cipher::Payload;
 use crate::error::Error;
-use crate::quic::QuicOutput;
+use crate::msgs::{ServerExtensionsInput, TransportParameters};
+use crate::quic::{self, Quic, QuicCommon, QuicEvent, QuicOutput};
+use crate::server::{ChooseConfig, ClientHello, ServerConfig, ServerHandshake, ServerSide};
+use crate::sync::Arc;
+use crate::tracing::trace;
 
 pub(crate) struct Core<Side: SideData, T: Transport> {
     pub(crate) inner: ConnectionCommon<Side>,
@@ -62,15 +70,139 @@ impl<Side: SideData, T: Transport> Core<Side, T> {
     }
 }
 
+/// Represents that a `ClientHello` message has been received.
+///
+/// The handshake can be progressed by choosing a [`ServerConfig`] based on
+/// [`Self::client_hello()`] and providing it to [`Self::choose_config()`].
+pub struct Accepted<T: Transport> {
+    // invariant: `core.inner.state` is `Err(_)` and requires restoring
+    core: Core<ServerSide, T>,
+    choose_config: Box<ChooseConfig>,
+}
+
+impl<T: Transport> Accepted<T> {
+    pub(crate) fn new(core: Core<ServerSide, T>, choose_config: Box<ChooseConfig>) -> Self {
+        Self {
+            core,
+            choose_config,
+        }
+    }
+
+    /// Get the [`ClientHello`] for this connection.
+    pub fn client_hello(&self) -> ClientHello<'_> {
+        let ch = self.choose_config.client_hello();
+        trace!("Accepted::client_hello(): {ch:#?}");
+        ch
+    }
+
+    fn partial_choose_config(
+        self,
+        config: Arc<ServerConfig>,
+        exts: ServerExtensionsInput,
+        tls: &mut Vec<u8>,
+    ) -> Result<Core<ServerSide, T>, Error> {
+        let Self {
+            core: Core {
+                mut inner,
+                mut transport,
+            },
+            choose_config,
+        } = self;
+
+        let result = inner.accepted(choose_config, exts, T::quic(&mut transport), config, tls);
+
+        let send_path = &mut inner.common.send;
+
+        if let Err(err) = &result {
+            maybe_send_fatal_alert(send_path, err, tls);
+        }
+
+        result?;
+        Ok(Core { inner, transport })
+    }
+}
+
+impl Accepted<Tcp> {
+    /// Choose a [`ServerConfig`] to progress the handshake.
+    ///
+    /// Output to send to the peer is appended to `tls`.  Typically, this is the `ServerHello`,
+    /// but it may also be an `Alert` if an error is returned.
+    ///
+    /// Returns an error if configuration-dependent validation of the received `ClientHello` message fails.
+    pub fn choose_config(
+        self,
+        config: Arc<ServerConfig>,
+        tls: &mut Vec<u8>,
+    ) -> Result<ServerHandshake, Error> {
+        let core = self.partial_choose_config(config, ServerExtensionsInput::default(), tls)?;
+        Ok(ServerHandshake::NeedsInput(NeedsInput::new(core.inner)))
+    }
+}
+
+impl Accepted<Quic> {
+    /// Choose a [`ServerConfig`] to progress the handshake.
+    ///
+    /// Resolves an [`Accepted`], providing the [`ServerConfig`] that should be used for
+    /// the session, and the TLS-encoded QUIC transport parameters to send.
+    ///
+    /// Returns an error if configuration-dependent validation of the received
+    /// `ClientHello` message fails.
+    ///
+    /// Events are appended to `output`.
+    pub fn choose_config(
+        self,
+        config: Arc<ServerConfig>,
+        params: Vec<u8>,
+        output: &mut Vec<QuicEvent>,
+    ) -> Result<quic::ServerHandshake, Error> {
+        quic::check_server_config(&config)?;
+
+        let exts = ServerExtensionsInput {
+            transport_parameters: Some(match self.core.transport.version {
+                quic::Version::V1 | quic::Version::V2 => {
+                    TransportParameters::Quic(Payload::new(params))
+                }
+            }),
+        };
+
+        let mut tls = Vec::new();
+        let Core {
+            inner,
+            
```

**File**: `rustls/src/conn/mod.rs` (modified, +2/-1)
```diff
@@ -25,7 +25,8 @@ use crate::tls13::key_schedule::KeyScheduleTrafficSend;
 pub mod kernel;
 
 mod handshake;
-pub(crate) use handshake::{Core, Tcp, Transport};
+pub use handshake::{Accepted, Tcp, Transport};
+pub(crate) use handshake::{Core, sealed};
 
 mod receive;
 pub(crate) use receive::{
```

**File**: `rustls/src/lib.rs` (modified, +1/-1)
```diff
@@ -393,7 +393,7 @@ pub use crate::builder::{ConfigBuilder, ConfigSide, WantsVerifier};
 pub use crate::common_state::{CommonState, ConnectionOutputs, HandshakeKind, Protocol};
 pub use crate::conn::{
     Connection, IoState, KeyingMaterialExporter, MessageHandler, NeedsInput, SideData, SliceInput,
-    TlsInputBuffer, VecInput, VerifyPeerIdentity, kernel,
+    Tcp, TlsInputBuffer, Transport, VecInput, VerifyPeerIdentity, kernel,
 };
 /// Types related to "split" mode.
 ///
```

**File**: `rustls/src/quic.rs` (modified, +13/-72)
```diff
@@ -10,15 +10,15 @@ use crate::client::ClientSide;
 pub use crate::common_state::Side;
 use crate::common_state::{CommonState, ConnectionOutputs, Protocol};
 use crate::conn::{
-    ConnectionCommon, Core, KeyingMaterialExporter, MessageIter, MessageIterMode, SideCommonOutput,
-    SideData, StateMachine, Transport, VerifySidePeerIdentity,
+    Accepted, ConnectionCommon, Core, KeyingMaterialExporter, MessageIter, MessageIterMode,
+    SideCommonOutput, SideData, StateMachine, Transport, VerifySidePeerIdentity,
 };
 use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::{AeadKey, Iv, Payload};
 use crate::crypto::tls13::{Hkdf, HkdfExpander, OkmBlock};
 use crate::error::{ApiMisuse, Error};
 use crate::msgs::{Message, MessagePayload, ServerExtensionsInput, TransportParameters};
-use crate::server::{ChooseConfig, ClientHello, ServerConfig, ServerSide, ServerState};
+use crate::server::{ServerConfig, ServerSide, ServerState};
 use crate::suites::SupportedCipherSuite;
 use crate::sync::Arc;
 use crate::tls13::Tls13CipherSuite;
@@ -303,7 +303,7 @@ pub enum ServerHandshake {
     ///
     /// The handshake can be progressed by choosing a [`ServerConfig`] based on
     /// [`Accepted::client_hello()`] and providing it to [`Accepted::choose_config()`].
-    Accepted(Accepted),
+    Accepted(Accepted<Quic>),
 
     /// The client's presented identity must be verified.
     ///
@@ -342,10 +342,10 @@ impl TryFrom<QuicCommon<ServerSide>> for ServerHandshake {
         const MISUSED: Error = Error::Unreachable("forgot to restore state");
 
         Ok(match mem::replace(&mut inner.common.state, Err(MISUSED))? {
-            ServerState::ChooseConfig(choose_config) => Self::Accepted(Accepted {
-                inner,
-                choose_config,
-            }),
+            ServerState::ChooseConfig(choose_config) => {
+                let QuicCommon { common, quic } = inner;
+                Self::Accepted(Accepted::new(Core::new(common, quic), choose_config))
+            }
 
             ServerState::VerifyClientIdentity(verify) => {
                 Self::VerifyClientIdentity(VerifyClientIdentity { inner, verify })
@@ -451,68 +451,7 @@ impl fmt::Debug for NeedsInput {
     }
 }
 
-/// Represents that a `ClientHello` message has been received.
-///
-/// The handshake can be progressed by choosing a [`ServerConfig`] based on
-/// [`Accepted::client_hello()`] and providing it to [`Accepted::choose_config()`].
-pub struct Accepted {
-    // invariant: `inner.core.state` is `Err(_)` and requires restoring
-    inner: QuicCommon<ServerSide>,
-    choose_config: Box<ChooseConfig>,
-}
-
-impl Accepted {
-    /// Get the [`ClientHello`] for this connection.
-    pub fn client_hello(&self) -> ClientHello<'_> {
-        self.choose_config.client_hello()
-    }
-
-    /// Choose a [`ServerConfig`] to progress the handshake.
-    ///
-    /// Resolves an [`Accepted`], providing the [`ServerConfig`] that should be used for
-    /// the session, and the TLS-encoded QUIC transport parameters to send.
-    ///
-    /// Returns an error if configuration-dependent validation of the received
-    /// `ClientHello` message fails.
-    ///
-    /// Events are appended to `output`.
-    pub fn choose_config(
-        mut self,
-        config: Arc<ServerConfig>,
-        params: Vec<u8>,
-        output: &mut Vec<QuicEvent>,
-    ) -> Result<ServerHandshake, Error> {
-        check_server_config(&config)?;
-
-        let mut tls = Vec::new();
-        self.inner.common.accepted(
-            self.choose_config,
-            ServerExtensionsInput {
-                transport_parameters: Some(match self.inner.quic.version {
-                    Version::V1 | Version::V2 => TransportParameters::Quic(Payload::new(params)),
-                }),
-            },
-            Some(&mut self.inner.quic),
-            config,
-            &mut tls,
-        )?;
-
-        // In QUIC mode, handshake output is emitted via `QuicEvent`s, not `tls`.
-        debug_assert!(tls.is_empty());
-        output.extend(self.inner.events());
-
-        ServerHandshake::try_from(self.inner)
-    }
-}
-
-impl fmt::Debug for Accepted {
-    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
-        f.debug_struct("quic::Accepted")
-            .finish_non_exhaustive()
-    }
-}
-
-fn check_server_config(config: &ServerConfig) -> Result<(), Error> {
+pub(crate) fn check_server_config(config: &ServerConfig) -> Result<(), Error> {
     let suites = &config.provider.tls13_cipher_suites;
     if suites.is_empty() {
         return Err(ApiMisuse::QuicRequiresTls13Support.into());
@@ -689,7 +628,7 @@ impl<Side: SideData> DerefMut for QuicCommon<Side> {
 
 /// The QUIC transport: TLS handshake messages and key changes delivered as [`QuicEvent`]s.
 #[derive(Default)]
-pub(crate) struct Quic {
+pub struct Quic {
     pub(crate) version: Version,
     /// QUIC transport parameters received from the peer during the handshake
     pub(crate) params: Option
```

**File**: `rustls/src/server/connection.rs` (modified, +9/-69)
```diff
@@ -5,25 +5,22 @@ use core::{fmt, mem};
 
 use pki_types::{DnsName, FipsStatus};
 
-use super::config::{ClientHello, ServerConfig};
-use crate::common_state::{
-    CommonState, ConnectionOutputs, EarlyDataEvent, Event, Protocol, Side, maybe_send_fatal_alert,
-};
+use super::config::ServerConfig;
+use crate::common_state::{CommonState, ConnectionOutputs, EarlyDataEvent, Event, Protocol, Side};
 use crate::conn::private::SideOutput;
 use crate::conn::split::SplitConnection;
 use crate::conn::{
-    Connection, ConnectionCommon, KeyingMaterialExporter, MessageHandler, NeedsInput, SideData,
-    StateMachine, TlsInputBuffer, VerifyPeerIdentity,
+    Accepted, Connection, ConnectionCommon, Core, KeyingMaterialExporter, MessageHandler,
+    NeedsInput, SideData, StateMachine, Tcp, TlsInputBuffer, VerifyPeerIdentity,
 };
 #[cfg(doc)]
 use crate::crypto;
 use crate::crypto::cipher::OutboundPlain;
 use crate::error::Error;
 use crate::msgs::ServerExtensionsInput;
-use crate::server::hs::{ChooseConfig, ExpectClientHello, ReadClientHello, ServerState};
+use crate::server::hs::{ExpectClientHello, ReadClientHello, ServerState};
 use crate::suites::ExtractedSecrets;
 use crate::sync::Arc;
-use crate::tracing::trace;
 use crate::verify::ClientIdentity;
 
 /// This represents a single TLS server connection.
@@ -240,7 +237,7 @@ pub enum ServerHandshake {
     ///
     /// The handshake can be progressed by choosing a [`ServerConfig`] based on
     /// [`Accepted::client_hello()`] and providing it to [`Accepted::choose_config()`].
-    Accepted(Accepted),
+    Accepted(Accepted<Tcp>),
 
     /// The client's presented identity must be verified.
     ///
@@ -275,10 +272,9 @@ impl TryFrom<ConnectionCommon<ServerSide>> for ServerHandshake {
         const MISUSED: Error = Error::Unreachable("forgot to restore state");
 
         Ok(match mem::replace(&mut inner.state, Err(MISUSED))? {
-            ServerState::ChooseConfig(choose_config) => Self::Accepted(Accepted {
-                inner,
-                choose_config,
-            }),
+            ServerState::ChooseConfig(choose_config) => {
+                Self::Accepted(Accepted::new(Core::new(inner, Tcp), choose_config))
+            }
 
             ServerState::VerifyClientIdentity(verify_identity) => {
                 Self::VerifyClientIdentity(VerifyPeerIdentity {
@@ -300,62 +296,6 @@ impl TryFrom<ConnectionCommon<ServerSide>> for ServerHandshake {
     }
 }
 
-/// Represents a `ClientHello` message.
-///
-/// The handshake can be progressed by choosing a [`ServerConfig`] based on
-/// [`Accepted::client_hello()`] and providing it to [`Accepted::choose_config()`].
-pub struct Accepted {
-    // invariant: `inner.state` is `Err(_)` and requires restoring
-    inner: ConnectionCommon<ServerSide>,
-    choose_config: Box<ChooseConfig>,
-}
-
-impl Accepted {
-    /// Get the [`ClientHello`] for this connection.
-    pub fn client_hello(&self) -> ClientHello<'_> {
-        let ch = self.choose_config.client_hello();
-        trace!("Accepted::client_hello(): {ch:#?}");
-        ch
-    }
-
-    /// Choose a [`ServerConfig`] to progress the handshake.
-    ///
-    /// Output to send to the peer is appended to `tls`.  Typically, this is the `ServerHello`,
-    /// but it may also be an `Alert` if an error is returned.
-    ///
-    /// Returns an error if configuration-dependent validation of the received `ClientHello` message fails.
-    pub fn choose_config(
-        mut self,
-        config: Arc<ServerConfig>,
-        tls: &mut Vec<u8>,
-    ) -> Result<ServerHandshake, Error> {
-        let result = self.inner.accepted(
-            self.choose_config,
-            ServerExtensionsInput::default(),
-            None,
-            config,
-            tls,
-        );
-
-        let send_path = &mut self.inner.common.send;
-
-        if let Err(err) = &result {
-            maybe_send_fatal_alert(send_path, err, tls);
-        }
-
-        result?;
-
-        Ok(ServerHandshake::NeedsInput(NeedsInput::new(self.inner)))
-    }
-}
-
-impl fmt::Debug for Accepted {
-    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
-        f.debug_struct("Accepted")
-            .finish_non_exhaustive()
-    }
-}
-
 /// State associated with a server connection.
 #[expect(clippy::exhaustive_structs)]
 #[derive(Debug)]
```

**File**: `rustls/src/server/mod.rs` (modified, +3/-1)
```diff
@@ -21,7 +21,9 @@ pub use config::{
 };
 
 mod connection;
-pub use connection::{Accepted, ReadEarlyData, ServerConnection, ServerHandshake, ServerSide};
+pub use connection::{ReadEarlyData, ServerConnection, ServerHandshake, ServerSide};
+
+pub use crate::conn::Accepted;
 
 pub(crate) mod handy;
 #[cfg(feature = "webpki")]
```

---

### Incident Patch 7: `45814920` (2026-09-02)
**Commit Message**: Share `NeedsInput` internals between QUIC and TCP

This introduces `conn::handshake`, which will hold the transport-generic
version of each handshake type, parameterised by the new `Transport`
trait: `Tcp` writes TLS records into a caller-supplied buffer, `Quic`
emits `QuicEvent`s instead.

**File**: `rustls/src/client/connection.rs` (modified, +9/-11)
```diff
@@ -277,16 +277,14 @@ impl ClientConnectionBuilder {
         } = self;
 
         let alpn_protocols = alpn_protocols.unwrap_or_else(|| config.alpn_protocols.clone());
-        Ok(NeedsInput {
-            inner: ConnectionCommon::for_client(
-                config,
-                name,
-                ClientExtensionsInput::from_alpn(alpn_protocols),
-                None,
-                Protocol::Tcp,
-                tls,
-            )?,
-        })
+        Ok(NeedsInput::new(ConnectionCommon::for_client(
+            config,
+            name,
+            ClientExtensionsInput::from_alpn(alpn_protocols),
+            None,
+            Protocol::Tcp,
+            tls,
+        )?))
     }
 }
 
@@ -331,7 +329,7 @@ impl TryFrom<ConnectionCommon<ClientSide>> for ClientHandshake {
 
             state => {
                 inner.state = Ok(state);
-                Self::NeedsInput(NeedsInput { inner })
+                Self::NeedsInput(NeedsInput::new(inner))
             }
         })
     }
```

**File**: `rustls/src/conn/buffered.rs` (added, +487/-0)
```diff
@@ -0,0 +1,487 @@
+use alloc::vec::Vec;
+use core::fmt;
+use core::mem;
+use core::ops::{Deref, DerefMut};
+
+use pki_types::FipsStatus;
+
+use super::split::{Joined, ReceivedPayload, SplitConnection};
+use super::{ConnectionCommon, Core, Driven, IoState, SideData, Tcp, TlsInputBuffer};
+use crate::common_state::ConnectionOutputs;
+use crate::crypto::cipher::{OutboundPlain, Payload};
+use crate::error::{ApiMisuse, Error};
+use crate::suites::ExtractedSecrets;
+
+/// A buffered TLS connection, for either side.
+///
+/// This drives a handshake (see [`ClientHandshake`] and [`ServerHandshake`]) to completion
+/// as data is received, and then the resulting [`SplitConnection`], behind a single object.
+///
+/// Encrypt data destined for the peer using [`Self::write()`].
+/// Process received data from the peer using [`Self::read_tls()`].
+///
+/// [`ClientHandshake`]: crate::client::ClientHandshake
+/// [`ServerHandshake`]: crate::server::ServerHandshake
+pub struct Connection<Side: SideData> {
+    state: State<Side>,
+}
+
+impl<Side: SideData> Connection<Side> {
+    pub(crate) fn new_common(common: ConnectionCommon<Side>) -> Self {
+        Self {
+            state: State::Handshaking(Core::new(common, ())),
+        }
+    }
+
+    /// Writes the application data from `plaintext` into TLS records and appends them to `tls`.
+    ///
+    /// Any data appended to `tls` should be sent to the peer.
+    ///
+    /// This will fail if either the handshake is not complete yet (because we don't yet have the
+    /// keys to encrypt application data) or if the send path has been closed by sending a
+    /// `close_notify` alert.
+    pub fn write(&mut self, plaintext: OutboundPlain<'_>, tls: &mut Vec<u8>) -> Result<(), Error> {
+        let traffic = match &mut self.state {
+            State::Handshaking(core) => return core.inner.write(plaintext, tls),
+            State::Traffic(traffic) => traffic,
+            State::Poisoned => return Err(Error::Unreachable(POISONED)),
+        };
+
+        if plaintext.is_empty() {
+            return Ok(());
+        } else if traffic
+            .split
+            .send
+            .has_sent_close_notify()
+        {
+            return Err(ApiMisuse::WriteTlsAfterSendPathClosed.into());
+        }
+
+        traffic.split.send.write(plaintext, tls);
+        Ok(())
+    }
+
+    /// Build a [`MessageHandler`] to process messages from the `input` buffer.
+    ///
+    /// Any data appended to `tls` should be sent to the peer.
+    pub fn read_tls<'a, 'm>(
+        &'a mut self,
+        input: &'m mut dyn TlsInputBuffer,
+        tls: &'a mut Vec<u8>,
+    ) -> MessageHandler<'a, 'm, Side> {
+        MessageHandler {
+            conn: self,
+            tls,
+            input: Input::Free(input),
+            done: false,
+        }
+    }
+
+    /// Sends a TLS1.3 `key_update` message into `tls` to refresh a connection's keys.
+    ///
+    /// The main reason to call this manually is to roll keys when it is known
+    /// a connection will be idle for a long period.
+    ///
+    /// rustls implicitly and automatically refreshes traffic keys when needed
+    /// according to the selected cipher suite's cryptographic constraints.  There
+    /// is therefore no need to call this manually to avoid cryptographic keys
+    /// "wearing out".
+    ///
+    /// This call refreshes our encryption keys. Once the peer receives the message,
+    /// it refreshes _its_ encryption and decryption keys and sends a response.
+    /// Once we receive that response, we refresh our decryption keys to match.
+    /// At the end of this process, keys in both directions have been refreshed.
+    ///
+    /// This fails with [`Error::HandshakeNotComplete`] if called before the initial
+    /// handshake is complete, or if a version prior to TLS1.3 is negotiated.
+    ///
+    /// # Usage advice
+    /// Note that other implementations (including rustls) may enforce limits on
+    /// the number of `key_update` messages allowed on a given connection to prevent
+    /// denial of service.  Therefore, this should be called sparingly.
+    ///
+    /// rustls only allows one outstanding request at a time; this function succeeds
+    /// but sends nothing if a request is already in-flight.
+    pub fn refresh_traffic_keys(&mut self, tls: &mut Vec<u8>) -> Result<(), Error> {
+        match &mut self.state {
+            State::Handshaking(core) => core.inner.refresh_traffic_keys(tls),
+            State::Traffic(traffic) => traffic
+                .split
+                .send
+                .refresh_traffic_keys(tls),
+            State::Poisoned => Err(Error::Unreachable(POISONED)),
+        }
+    }
+
+    /// Writes a `close_notify` warning alert into `tls`.
+    ///
+    /// This informs the peer that the connection is being closed.
+    ///
+    /// Does nothing if any `close_notify` or fatal alert was already sent.
+    pub fn send_close_notify(&mut self, tls: &mut Vec<u8>) {
+    
```

**File**: `rustls/src/conn/handshake.rs` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+//! Transport-generic handshake machinery.
+//!
+//! The public handshake types (`rustls::{NeedsInput, VerifyPeerIdentity, Accepted,
+//! ClientHandshake, ServerHandshake}` and their `rustls::quic` counterparts) are thin
+//! shims over the types in this module.
+//!
+//! The shims own the public signatures and documentation; the shared underlying logic lives
+//! here, parameterised by [`Transport`].
+
+use alloc::vec::Vec;
+
+use super::{ConnectionCommon, MessageIter, MessageIterMode, SideData};
+use crate::TlsInputBuffer;
+use crate::error::Error;
+use crate::quic::QuicOutput;
+
+pub(crate) struct Core<Side: SideData, T: Transport> {
+    pub(crate) inner: ConnectionCommon<Side>,
+    pub(crate) transport: T,
+}
+
+impl<Side: SideData, T: Transport> Core<Side, T> {
+    pub(crate) fn new(inner: ConnectionCommon<Side>, transport: T) -> Self {
+        Self { inner, transport }
+    }
+
+    pub(crate) fn process(
+        self,
+        input: &mut dyn TlsInputBuffer,
+        tls: &mut Vec<u8>,
+    ) -> Result<Self, Error> {
+        let Self {
+            mut inner,
+            mut transport,
+        } = self;
+
+        let mut iter = MessageIter::new(
+            input,
+            tls,
+            transport.quic(),
+            &mut inner,
+            MessageIterMode::Handshake,
+        );
+        let result = loop {
+            match iter.next(false) {
+                Some(Ok(_)) => {}
+                Some(Err(e)) => break Err(e),
+                None => break Ok(()),
+            };
+        };
+
+        input.discard(
+            inner
+                .common
+                .recv
+                .deframer
+                .take_discard(),
+        );
+
+        result?;
+        Ok(Self { inner, transport })
+    }
+}
+
+/// The aspects of a handshake that depend on the underlying transport.
+pub(crate) trait Transport: Sized {
+    /// The sink for QUIC-specific events.
+    fn quic(&mut self) -> Option<&mut dyn QuicOutput>;
+}
+
+pub(crate) struct Tcp;
+
+impl Transport for Tcp {
+    fn quic(&mut self) -> Option<&mut dyn QuicOutput> {
+        None
+    }
+}
```

**File**: `rustls/src/conn/mod.rs` (modified, +10/-30)
```diff
@@ -24,6 +24,9 @@ use crate::tls13::key_schedule::KeyScheduleTrafficSend;
 // pub so that it can be re-exported from the crate root
 pub mod kernel;
 
+mod handshake;
+pub(crate) use handshake::{Core, Tcp, Transport};
+
 mod receive;
 pub(crate) use receive::{
     DataKind, Input, MessageIter, MessageIterMode, ReceivePath, TrafficTemperCounters,
@@ -141,11 +144,13 @@ pub trait Connection: fmt::Debug + Deref<Target = ConnectionOutputs> {
 /// More data needs to be supplied to make progress.
 ///
 /// Provide the data to [`Self::process()`].
-pub struct NeedsInput<Side: SideData> {
-    pub(crate) inner: ConnectionCommon<Side>,
-}
+pub struct NeedsInput<Side: SideData>(Core<Side, Tcp>);
 
 impl<Side: SideData> NeedsInput<Side> {
+    pub(crate) fn new(inner: ConnectionCommon<Side>) -> Self {
+        Self(Core::new(inner, Tcp))
+    }
+
     /// Progress the handshake by receiving further data.
     ///
     /// The data is obtained via `input`.  Any output produced is appended to `tls` and
@@ -159,36 +164,11 @@ impl<Side: SideData> NeedsInput<Side> {
     /// the connection.  If this contains another [`NeedsInput`] object then obtaining more
     /// input (eg, from a socket or other source) is certainly necessary.
     pub fn process(
-        mut self,
+        self,
         input: &mut dyn TlsInputBuffer,
         tls: &mut Vec<u8>,
     ) -> Result<Side::Handshake, Error> {
-        let mut iter = MessageIter::new(
-            input,
-            tls,
-            None,
-            &mut self.inner,
-            MessageIterMode::Handshake,
-        );
-
-        let result = loop {
-            match iter.next(false) {
-                Some(Ok(_)) => {}
-                Some(Err(e)) => break Err(e),
-                None => break Ok(()),
-            };
-        };
-
-        input.discard(
-            self.inner
-                .common
-                .recv
-                .deframer
-                .take_discard(),
-        );
-
-        result?;
-        Side::handshake_from_inner(self.inner)
+        Side::handshake_from_inner(self.0.process(input, tls)?.inner)
     }
 }
 
```

**File**: `rustls/src/quic.rs` (modified, +42/-35)
```diff
@@ -10,8 +10,8 @@ use crate::client::ClientSide;
 pub use crate::common_state::Side;
 use crate::common_state::{CommonState, ConnectionOutputs, Protocol};
 use crate::conn::{
-    ConnectionCommon, KeyingMaterialExporter, MessageIter, MessageIterMode, SideCommonOutput,
-    SideData, StateMachine, VerifySidePeerIdentity,
+    ConnectionCommon, Core, KeyingMaterialExporter, MessageIter, MessageIterMode, SideCommonOutput,
+    SideData, StateMachine, Transport, VerifySidePeerIdentity,
 };
 use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::{AeadKey, Iv, Payload};
@@ -119,8 +119,7 @@ impl Connection for ClientConnection {
     }
 
     fn read_hs(&mut self, input: &mut dyn TlsInputBuffer) -> Result<(), Error> {
-        self.inner
-            .read_hs(input, MessageIterMode::All)
+        self.inner.read_hs(input)
     }
 
     fn events(&mut self) -> impl Iterator<Item = QuicEvent> {
@@ -266,8 +265,7 @@ impl Connection for ServerConnection {
     }
 
     fn read_hs(&mut self, input: &mut dyn TlsInputBuffer) -> Result<(), Error> {
-        self.inner
-            .read_hs(input, MessageIterMode::All)
+        self.inner.read_hs(input)
     }
 
     fn events(&mut self) -> impl Iterator<Item = QuicEvent> {
@@ -327,15 +325,13 @@ impl ServerHandshake {
     ///
     /// The returned object should be fed data from a single potential client.
     pub fn start(version: Version) -> NeedsInput {
-        NeedsInput {
-            inner: QuicCommon::new(
-                ConnectionCommon::for_acceptor(Protocol::Quic(version)),
-                Quic {
-                    version,
-                    ..Quic::default()
-                },
-            ),
-        }
+        NeedsInput(Core::new(
+            ConnectionCommon::for_acceptor(Protocol::Quic(version)),
+            Quic {
+                version,
+                ..Quic::default()
+            },
+        ))
     }
 }
 
@@ -362,7 +358,8 @@ impl TryFrom<QuicCommon<ServerSide>> for ServerHandshake {
 
             state => {
                 inner.common.state = Ok(state);
-                Self::NeedsInput(NeedsInput { inner })
+                let QuicCommon { common, quic } = inner;
+                Self::NeedsInput(NeedsInput(Core::new(common, quic)))
             }
         })
     }
@@ -374,9 +371,7 @@ impl TryFrom<QuicCommon<ServerSide>> for ServerHandshake {
 ///
 /// This type dereferences to [`ConnectionOutputs`]. Individual outputs are `None`
 /// until they are learned during the handshake.
-pub struct NeedsInput {
-    inner: QuicCommon<ServerSide>,
-}
+pub struct NeedsInput(Core<ServerSide, Quic>);
 
 impl NeedsInput {
     /// Return the TLS-encoded transport parameters received from the peer.
@@ -385,19 +380,19 @@ impl NeedsInput {
     /// they cannot be fully trusted until then. Reliance on them should be minimized.
     /// Any tampering with the parameters will cause the handshake to fail.
     pub fn quic_transport_parameters(&self) -> Option<&[u8]> {
-        self.inner.quic.transport_parameters()
+        self.0.transport.transport_parameters()
     }
 
     /// Compute the keys for decrypting 0-RTT packets, if available.
     pub fn zero_rtt_keys(&self) -> Option<DirectionalKeys> {
-        self.inner
-            .quic
-            .zero_rtt_keys(&self.inner)
+        self.0
+            .transport
+            .zero_rtt_keys(&self.0.inner)
     }
 
     /// Retrieves the server name supplied by the client, if any.
     pub fn server_name(&self) -> Option<&DnsName<'_>> {
-        self.inner.common.side.server_name()
+        self.0.inner.side.server_name()
     }
 
     /// Progress the handshake by receiving further unencrypted TLS handshake data.
@@ -425,18 +420,27 @@ impl NeedsInput {
         input: &mut dyn TlsInputBuffer,
         output: &mut Vec<QuicEvent>,
     ) -> Result<ServerHandshake, Error> {
-        self.inner
-            .read_hs(input, MessageIterMode::Handshake)?;
-        output.extend(self.inner.events());
-        ServerHandshake::try_from(self.inner)
+        self.0
+            .inner
+            .recv
+            .deframer
+            .input_quic(input.slice_mut())?;
+
+        let Core {
+            inner,
+            mut transport,
+        } = self.0.process(input, &mut Vec::new())?;
+
+        output.extend(transport.events());
+        ServerHandshake::try_from(QuicCommon::new(inner, transport))
     }
 }
 
 impl Deref for NeedsInput {
     type Target = ConnectionOutputs;
 
     fn deref(&self) -> &Self::Target {
-        &self.inner
+        self.0.inner.deref()
     }
 }
 
@@ -632,11 +636,7 @@ impl<Side: SideData> QuicCommon<Side> {
         Self { common, quic }
     }
 
-    fn read_hs(
-        &mut self,
-        input: &mut dyn TlsInputBuffer,
-        mode: MessageIterMode,
-    ) -> Result<(), Error> {
+    fn read_hs(&mut self, input: &mut dyn TlsInputBuffer) -> Result<(), Error> {
         self.common
             .common
             .recv
@@ -649,7 +649,7 @@ impl<Side: 
```

**File**: `rustls/src/server/connection.rs` (modified, +3/-7)
```diff
@@ -264,9 +264,7 @@ impl ServerHandshake {
     ///
     /// The returned object should be fed data from a single potential client.
     pub fn start() -> NeedsInput<ServerSide> {
-        NeedsInput {
-            inner: ConnectionCommon::for_acceptor(Protocol::Tcp),
-        }
+        NeedsInput::new(ConnectionCommon::for_acceptor(Protocol::Tcp))
     }
 }
 
@@ -296,7 +294,7 @@ impl TryFrom<ConnectionCommon<ServerSide>> for ServerHandshake {
 
             state => {
                 inner.state = Ok(state);
-                Self::NeedsInput(NeedsInput { inner })
+                Self::NeedsInput(NeedsInput::new(inner))
             }
         })
     }
@@ -347,9 +345,7 @@ impl Accepted {
 
         result?;
 
-        Ok(ServerHandshake::NeedsInput(NeedsInput {
-            inner: self.inner,
-        }))
+        Ok(ServerHandshake::NeedsInput(NeedsInput::new(self.inner)))
     }
 }
 
```

---

### Incident Patch 8: `a78685e2` (2026-09-21)
**Commit Message**: Raise common functions from `QuicCommon` into transport

**File**: `rustls/src/quic.rs` (modified, +36/-35)
```diff
@@ -109,11 +109,13 @@ impl ClientConnection {
 
 impl Connection for ClientConnection {
     fn quic_transport_parameters(&self) -> Option<&[u8]> {
-        self.inner.quic_transport_parameters()
+        self.inner.quic.transport_parameters()
     }
 
     fn zero_rtt_keys(&self) -> Option<DirectionalKeys> {
-        self.inner.zero_rtt_keys()
+        self.inner
+            .quic
+            .zero_rtt_keys(&self.inner)
     }
 
     fn read_hs(&mut self, input: &mut dyn TlsInputBuffer) -> Result<(), Error> {
@@ -254,11 +256,13 @@ impl ServerConnection {
 
 impl Connection for ServerConnection {
     fn quic_transport_parameters(&self) -> Option<&[u8]> {
-        self.inner.quic_transport_parameters()
+        self.inner.quic.transport_parameters()
     }
 
     fn zero_rtt_keys(&self) -> Option<DirectionalKeys> {
-        self.inner.zero_rtt_keys()
+        self.inner
+            .quic
+            .zero_rtt_keys(&self.inner)
     }
 
     fn read_hs(&mut self, input: &mut dyn TlsInputBuffer) -> Result<(), Error> {
@@ -381,12 +385,14 @@ impl NeedsInput {
     /// they cannot be fully trusted until then. Reliance on them should be minimized.
     /// Any tampering with the parameters will cause the handshake to fail.
     pub fn quic_transport_parameters(&self) -> Option<&[u8]> {
-        self.inner.quic_transport_parameters()
+        self.inner.quic.transport_parameters()
     }
 
     /// Compute the keys for decrypting 0-RTT packets, if available.
     pub fn zero_rtt_keys(&self) -> Option<DirectionalKeys> {
-        self.inner.zero_rtt_keys()
+        self.inner
+            .quic
+            .zero_rtt_keys(&self.inner)
     }
 
     /// Retrieves the server name supplied by the client, if any.
@@ -626,35 +632,6 @@ impl<Side: SideData> QuicCommon<Side> {
         Self { common, quic }
     }
 
-    fn quic_transport_parameters(&self) -> Option<&[u8]> {
-        self.quic
-            .params
-            .as_ref()
-            .map(|v| v.as_ref())
-    }
-
-    fn zero_rtt_keys(&self) -> Option<DirectionalKeys> {
-        let suite = self
-            .common
-            .common
-            .negotiated_cipher_suite()
-            .and_then(|suite| match suite {
-                SupportedCipherSuite::Tls13(suite) => Some(suite),
-                _ => None,
-            })?;
-
-        let suite = Suite {
-            inner: suite,
-            quic: suite.quic?,
-        };
-
-        Some(DirectionalKeys::new(
-            suite,
-            self.quic.early_secret.as_ref()?,
-            self.quic.version,
-        ))
-    }
-
     fn read_hs(
         &mut self,
         input: &mut dyn TlsInputBuffer,
@@ -742,6 +719,30 @@ impl Quic {
     pub(crate) fn events(&mut self) -> impl Iterator<Item = QuicEvent> {
         mem::take(&mut self.events).into_iter()
     }
+
+    fn zero_rtt_keys(&self, outputs: &ConnectionOutputs) -> Option<DirectionalKeys> {
+        let suite = outputs
+            .negotiated_cipher_suite()
+            .and_then(|suite| match suite {
+                SupportedCipherSuite::Tls13(suite) => Some(suite),
+                _ => None,
+            })?;
+
+        let suite = Suite {
+            inner: suite,
+            quic: suite.quic?,
+        };
+
+        Some(DirectionalKeys::new(
+            suite,
+            self.early_secret.as_ref()?,
+            self.version,
+        ))
+    }
+
+    fn transport_parameters(&self) -> Option<&[u8]> {
+        self.params.as_ref().map(|v| v.as_ref())
+    }
 }
 
 impl QuicOutput for Quic {
```

---

### Incident Patch 9: `0b02c2a6` (2026-09-02)
**Commit Message**: Emit QUIC events from client identity verification

**File**: `rustls-test/tests/api/quic.rs` (modified, +8/-2)
```diff
@@ -354,7 +354,10 @@ fn test_quic_acceptor() {
                 assert!(expect.client_auth);
                 println!("{verify:?}");
                 println!("identity: {:?}", verify.presented_identity());
-                let ServerHandshake::NeedsInput(server) = verify.with_config().unwrap() else {
+                let ServerHandshake::NeedsInput(server) = verify
+                    .with_config(&mut server_flight)
+                    .unwrap()
+                else {
                     panic!("unexpected state");
                 };
                 let ServerHandshake::Complete(server) = server
@@ -477,7 +480,10 @@ fn test_quic_acceptor_external_verifier_rejects_client_cert() {
         };
 
         let err = verify_client
-            .continue_with(Err(CertificateError::UnknownIssuer.into()))
+            .continue_with(
+                Err(CertificateError::UnknownIssuer.into()),
+                &mut server_flight,
+            )
             .unwrap_err();
         assert_eq!(err, CertificateError::UnknownIssuer.into());
         assert_eq!(
```

**File**: `rustls/src/quic.rs` (modified, +8/-2)
```diff
@@ -550,17 +550,22 @@ pub struct VerifyClientIdentity {
 
 impl VerifyClientIdentity {
     /// Progress the handshake by calling the pre-configured certificate verification trait.
-    pub fn with_config(self) -> Result<ServerHandshake, Error> {
+    ///
+    /// Events are appended to `output`.
+    pub fn with_config(self, output: &mut Vec<QuicEvent>) -> Result<ServerHandshake, Error> {
         let verified = self.verify.verify_with_config();
-        self.continue_with(verified)
+        self.continue_with(verified, output)
     }
 
     /// Progress the handshake by incorporating the result of an external verification.
     ///
     /// If `verification_result` is an error, this error is returned and the handshake terminates.
+    ///
+    /// Events are appended to `output`.
     pub fn continue_with(
         self,
         verification_result: Result<VerifiedIdentity<'static>, Error>,
+        output: &mut Vec<QuicEvent>,
     ) -> Result<ServerHandshake, Error> {
         let Self { mut inner, verify } = self;
 
@@ -581,6 +586,7 @@ impl VerifyClientIdentity {
         debug_assert!(tls.is_empty());
 
         inner.common.state = result;
+        output.extend(inner.events());
         ServerHandshake::try_from(inner)
     }
 
```

---

### Incident Patch 10: `eba6ba2e` (2026-09-18)
**Commit Message**: ci: fix daily-tests post-quantum client package

The example moved from rustls-post-quantum to rustls-aws-lc-rs.

**File**: `.github/workflows/daily-tests.yml` (modified, +2/-2)
```diff
@@ -121,8 +121,8 @@ jobs:
           cargo run --locked -p rustls-examples --bin ech-client -- --path "/" public.tls-ech.dev tls-ech.dev |
             grep 'You are using ECH.'
 
-      - name: Check rustls-post-quantum client
-        run: cargo run --locked -p rustls-post-quantum --example client | grep 'kex=X25519MLKEM768'
+      - name: Check post-quantum client
+        run: cargo run --locked -p rustls-aws-lc-rs --example client | grep 'kex=X25519MLKEM768'
 
       - name: Smoke test for secp256r1mlkem768 interop
         run: cargo run --locked -p rustls-examples --bin tls-client-mio -- --http --key-exchange secp256r1mlkem768 --verbose openquantumsafe.org
```

---

### Incident Patch 11: `0049b7be` (2026-09-18)
**Commit Message**: chore: Fix some incorrect documentation comments about FIPS

**File**: `rustls-aws-lc-rs/src/kx.rs` (modified, +2/-2)
```diff
@@ -183,8 +183,8 @@ struct KxGroup {
 
     /// Whether the algorithm is allowed by FIPS
     ///
-    /// `SupportedKxGroup::fips()` is true if and only if the algorithm is allowed,
-    /// _and_ the implementation is FIPS-validated.
+    /// `SupportedKxGroup::fips()` is FIPS-validated if and only if the algorithm
+    /// is allowed, _and_ the implementation is FIPS-validated.
     fips_allowed: bool,
 
     /// aws-lc-rs 1.9 and later accepts more formats of public keys than
```

**File**: `rustls-ring/src/kx.rs` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ struct KxGroup {
 
     /// Whether the algorithm is allowed by FIPS
     ///
-    /// `SupportedKxGroup::fips()` is true if and only if the algorithm is allowed,
-    /// _and_ the implementation is FIPS-validated.
+    /// `SupportedKxGroup::fips()` is FIPS-validated if and only if the algorithm
+    /// is allowed, _and_ the implementation is FIPS-validated.
     fips_allowed: bool,
 
     /// aws-lc-rs 1.9 and later accepts more formats of public keys than
```

**File**: `rustls/src/client/ech.rs` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ pub enum EchMode {
 }
 
 impl EchMode {
-    /// Returns true if the ECH mode will use a FIPS approved HPKE suite.
+    /// Returns the FIPS status of the HPKE suite that will be used.
     pub fn fips(&self) -> FipsStatus {
         match self {
             Self::Enable(ech_config) => ech_config.suite.fips(),
```

**File**: `rustls/src/crypto/cipher/mod.rs` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ pub trait Tls13AeadAlgorithm: Send + Sync {
         iv: Iv,
     ) -> Result<ConnectionTrafficSecrets, UnsupportedOperationError>;
 
-    /// Return `true` if this is backed by a FIPS-approved implementation.
+    /// Return the FIPS validation status of this implementation.
     fn fips(&self) -> FipsStatus {
         FipsStatus::Unvalidated
     }
```

**File**: `rustls/src/crypto/kx/mod.rs` (modified, +1/-1)
```diff
@@ -272,7 +272,7 @@ pub trait SupportedKxGroup: Send + Sync + Debug {
     /// you can create one locally, eg `NamedGroup(420)`.
     fn name(&self) -> NamedGroup;
 
-    /// Return `true` if this is backed by a FIPS-approved implementation.
+    /// Return the FIPS validation status of this implementation.
     fn fips(&self) -> FipsStatus {
         FipsStatus::Unvalidated
     }
```

**File**: `rustls/src/crypto/mod.rs` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ pub use crate::suites::CipherSuiteCommon;
 /// Call [`CryptoProvider::fips()`] to determine the FIPS status of a given provider.
 ///
 /// You can verify the configuration at runtime by checking
-/// [`ServerConfig::fips()`]/[`ClientConfig::fips()`] return `true`.
+/// [`ServerConfig::fips()`]/[`ClientConfig::fips()`].
 #[expect(clippy::exhaustive_structs)]
 #[derive(Debug, Clone)]
 pub struct CryptoProvider {
```

**File**: `rustls/src/manual/fips.rs` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ You could, for example:
 
 ```rust,ignore
 # let client_config = unreachable!();
-assert!(client_config.fips());
+assert!(matches!(client_config.fips(), FipsStatus::Certified { .. }));
 ```
 
 But maybe your application has an error handling or health-check strategy better than panicking.
```

**File**: `rustls/src/quic.rs` (modified, +1/-1)
```diff
@@ -934,7 +934,7 @@ pub trait Algorithm: Send + Sync {
     /// This controls the size of `AeadKey`s presented to `packet_key()` and `header_protection_key()`.
     fn aead_key_len(&self) -> usize;
 
-    /// Whether this algorithm is FIPS-approved.
+    /// The FIPS validation status of this algorithm.
     fn fips(&self) -> FipsStatus {
         FipsStatus::Unvalidated
     }
```

---

### Incident Patch 12: `a78c510f` (2026-09-16)
**Commit Message**: Fix ClientConnection::early_data() docs

**File**: `rustls/src/client/connection.rs` (modified, +1/-2)
```diff
@@ -61,8 +61,7 @@ impl ClientConnection {
         self.inner.split()
     }
 
-    /// Returns an `io::Write` implementer you can write bytes to
-    /// to send TLS1.3 early data (a.k.a. "0-RTT data") to the server.
+    /// Allows reading TLS1.3 0RTT/"early" data received from a client.
     ///
     /// This returns None in many circumstances when the capability to
     /// send early data is not available, including but not limited to:
```

---

### Incident Patch 13: `3c0b3057` (2026-09-16)
**Commit Message**: Fix and align the documentation on Client/ServerConnection

**File**: `rustls/src/client/connection.rs` (modified, +3/-0)
```diff
@@ -28,6 +28,9 @@ use crate::verify::ServerIdentity;
 use crate::{NeedsInput, TlsInputBuffer};
 
 /// This represents a single TLS client connection.
+///
+/// Encrypt data destined for the peer using [`Connection::write()`].
+/// Process received data from the peer using [`Connection::read_tls()`].
 pub struct ClientConnection {
     inner: ConnectionCommon<ClientSide>,
 }
```

**File**: `rustls/src/server/connection.rs` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@ use crate::verify::ClientIdentity;
 
 /// This represents a single TLS server connection.
 ///
-/// Send TLS-protected data to the peer using the `io::Write` trait implementation.
-/// Read data from the peer using the `io::Read` trait implementation.
+/// Encrypt data destined for the peer using [`Connection::write()`].
+/// Process received data from the peer using [`Connection::read_tls()`].
 pub struct ServerConnection {
     pub(super) inner: ConnectionCommon<ServerSide>,
 }
```

---

### Incident Patch 14: `dfe19f64` (2026-08-17)
**Commit Message**: Fix inconsistent import of `fmt::Debug`

**File**: `rustls/src/conn/mod.rs` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 use alloc::boxed::Box;
 use alloc::vec::Vec;
-use core::fmt::{self, Debug};
+use core::fmt;
 use core::ops::{Deref, DerefMut};
 
 use kernel::KernelConnection;
@@ -33,7 +33,7 @@ pub(crate) mod split;
 use split::SplitConnection;
 
 /// A trait generalizing over buffered client or server connections.
-pub trait Connection: Debug + Deref<Target = ConnectionOutputs> {
+pub trait Connection: fmt::Debug + Deref<Target = ConnectionOutputs> {
     /// The side (client or server) that this type implements.
     type Side: SideData;
 
@@ -400,7 +400,7 @@ impl<'a, 'm, Side: SideData + private::Side> Drop for MessageHandler<'a, 'm, Sid
     }
 }
 
-impl<S: SideData> Debug for MessageHandler<'_, '_, S> {
+impl<S: SideData> fmt::Debug for MessageHandler<'_, '_, S> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.debug_struct("MessageHandler")
             .field("done", &self.done)
@@ -446,7 +446,7 @@ impl KeyingMaterialExporter {
     }
 }
 
-impl Debug for KeyingMaterialExporter {
+impl fmt::Debug for KeyingMaterialExporter {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.debug_struct("KeyingMaterialExporter")
             .finish_non_exhaustive()
@@ -574,7 +574,7 @@ pub trait SideData: private::Side {}
 pub(crate) mod private {
     use super::*;
 
-    pub(crate) trait Side: Debug {
+    pub(crate) trait Side: fmt::Debug {
         /// Data storage type.
         type Data: SideOutput;
         /// State machine type.
```

---

### Incident Patch 15: `ccb598f7` (2026-09-12)
**Commit Message**: quic: builder API for QUIC

**File**: `rustls-test/tests/api/quic.rs` (modified, +78/-135)
```diff
@@ -67,13 +67,10 @@ fn test_quic_handshake() {
     let server_params = &b"server params"[..];
 
     // full handshake
-    let mut client = quic::ClientConnection::new(
-        client_config.clone(),
-        quic::Version::V1,
-        server_name("localhost"),
-        client_params.into(),
-    )
-    .unwrap();
+    let mut client = client_config
+        .connect(server_name("localhost"))
+        .build_quic(quic::Version::V1, client_params.into())
+        .unwrap();
     assert_eq!(client.fips(), client_config.fips());
 
     let mut server = quic::ServerConnection::new(
@@ -117,13 +114,10 @@ fn test_quic_handshake() {
     assert_eq!(client.tls13_tickets_received(), 2);
 
     // 0-RTT handshake
-    let mut client = quic::ClientConnection::new(
-        client_config.clone(),
-        quic::Version::V1,
-        server_name("localhost"),
-        client_params.into(),
-    )
-    .unwrap();
+    let mut client = client_config
+        .connect(server_name("localhost"))
+        .build_quic(quic::Version::V1, client_params.into())
+        .unwrap();
     assert!(
         client
             .negotiated_cipher_suite()
@@ -153,13 +147,10 @@ fn test_quic_handshake() {
     assert!(client.is_early_data_accepted());
 
     // failed handshake
-    let mut client = quic::ClientConnection::new(
-        client_config,
-        quic::Version::V1,
-        server_name("example.com"),
-        client_params.into(),
-    )
-    .unwrap();
+    let mut client = client_config
+        .connect(server_name("example.com"))
+        .build_quic(quic::Version::V1, client_params.into())
+        .unwrap();
 
     let mut server =
         quic::ServerConnection::new(server_config, quic::Version::V1, server_params.into())
@@ -227,13 +218,10 @@ fn test_quic_handshake_with_hello_retry_request() {
         &provider,
     );
 
-    let mut client = quic::ClientConnection::new(
-        Arc::new(client_config),
-        quic::Version::V1,
-        server_name("localhost"),
-        b"client params".to_vec(),
-    )
-    .unwrap();
+    let mut client = Arc::new(client_config)
+        .connect(server_name("localhost"))
+        .build_quic(quic::Version::V1, b"client params".to_vec())
+        .unwrap();
     let mut server = quic::ServerConnection::new(
         Arc::new(server_config),
         quic::Version::V1,
@@ -279,13 +267,10 @@ fn test_quic_acceptor() {
         let client_params = &b"client params"[..];
         let server_params = &b"server params"[..];
 
-        let mut client = quic::ClientConnection::new(
-            client_config,
-            quic::Version::V1,
-            server_name("localhost"),
-            client_params.into(),
-        )
-        .unwrap();
+        let mut client = client_config
+            .connect(server_name("localhost"))
+            .build_quic(quic::Version::V1, client_params.into())
+            .unwrap();
         assert_eq!(client.fips(), client_fips);
 
         let needs_input = ServerHandshake::start(quic::Version::V1);
@@ -413,13 +398,10 @@ fn test_quic_acceptor_exposes_zero_rtt_keys_before_completion() {
     let client_params: &[u8] = b"client params";
     let server_params: &[u8] = b"server params";
 
-    let mut client = quic::ClientConnection::new(
-        client_config.clone(),
-        quic::Version::V1,
-        server_name("localhost"),
-        client_params.to_vec(),
-    )
-    .unwrap();
+    let mut client = client_config
+        .connect(server_name("localhost"))
+        .build_quic(quic::Version::V1, client_params.into())
+        .unwrap();
     let mut server = quic::ServerConnection::new(
         server_config.clone(),
         quic::Version::V1,
@@ -431,13 +413,10 @@ fn test_quic_acceptor_exposes_zero_rtt_keys_before_completion() {
     quic_transfer(&mut client, &mut server).unwrap();
     assert!(client.tls13_tickets_received() > 0);
 
-    let mut client = quic::ClientConnection::new(
-        client_config,
-        quic::Version::V1,
-        server_name("localhost"),
-        client_params.to_vec(),
-    )
-    .unwrap();
+    let mut client = client_config
+        .connect(server_name("localhost"))
+        .build_quic(quic::Version::V1, client_params.into())
+        .unwrap();
 
     let mut client_initial = flatten_events(&mut client);
     assert!(client.zero_rtt_keys().is_some());
@@ -464,13 +443,10 @@ fn test_quic_acceptor_external_verifier_rejects_client_cert() {
     for (client_config, server_config, _) in
         MultiTest::new(provider::DEFAULT_TLS13_PROVIDER).require_client_auth()
     {
-        let mut client = quic::ClientConnection::new(
-            client_config,
-            quic::Version::V1,
-            server_name("localhost"),
-            b"client params".into(),
-        )
-        .unwrap();
+        let mut client = client_config
+            .connect(server_name("localhost"))
+            .build_quic(quic::Version::V1, b"client params".into())
+            .unwrap();
 
         let needs_input = S
```

**File**: `rustls/src/client/connection.rs` (modified, +62/-4)
```diff
@@ -17,11 +17,11 @@ use crate::conn::{
 };
 #[cfg(doc)]
 use crate::crypto;
-use crate::crypto::cipher::OutboundPlain;
+use crate::crypto::cipher::{OutboundPlain, Payload};
 use crate::enums::ApplicationProtocol;
-use crate::error::Error;
-use crate::msgs::ClientExtensionsInput;
-use crate::quic::QuicOutput;
+use crate::error::{ApiMisuse, Error};
+use crate::msgs::{ClientExtensionsInput, TransportParameters};
+use crate::quic::{self, ClientConnection as QuicClientConnection, Quic, QuicCommon, QuicOutput};
 use crate::suites::ExtractedSecrets;
 use crate::sync::Arc;
 use crate::tracing::trace;
@@ -197,6 +197,64 @@ impl ClientConnectionBuilder {
             )?,
         })
     }
+
+    /// Finalize the builder and create a QUIC `ClientConnection`.
+    ///
+    /// This differs from `ClientConnectionBuilder::build()` in that it takes an extra `params`
+    /// argument, which contains the TLS-encoded transport parameters to send, and an extra
+    /// `version` argument, specifying the QUIC protocol version.
+    pub fn build_quic(
+        self,
+        version: quic::Version,
+        params: Vec<u8>,
+    ) -> Result<QuicClientConnection, Error> {
+        let suites = &self
+            .config
+            .provider()
+            .tls13_cipher_suites;
+        if suites.is_empty() {
+            return Err(ApiMisuse::QuicRequiresTls13Support.into());
+        }
+
+        if !suites
+            .iter()
+            .any(|scs| scs.quic.is_some())
+        {
+            return Err(ApiMisuse::NoQuicCompatibleCipherSuites.into());
+        }
+
+        let exts = ClientExtensionsInput {
+            transport_parameters: Some(match version {
+                quic::Version::V1 | quic::Version::V2 => {
+                    TransportParameters::Quic(Payload::new(params))
+                }
+            }),
+
+            ..ClientExtensionsInput::from_alpn(
+                self.alpn_protocols
+                    .unwrap_or_else(|| self.config.alpn_protocols.clone()),
+            )
+        };
+
+        let mut quic = Quic {
+            version,
+            ..Quic::default()
+        };
+
+        let mut tls = Vec::new();
+        let inner = ConnectionCommon::for_client(
+            self.config,
+            self.name,
+            exts,
+            Some(&mut quic),
+            Protocol::Quic(version),
+            &mut tls,
+        )?;
+
+        // In QUIC mode, handshake output is emitted via `QuicEvent`s, not `tls`.
+        debug_assert!(tls.is_empty());
+        Ok(QuicClientConnection::from(QuicCommon::new(inner, quic)))
+    }
 }
 
 /// Allows writing of early data in resumed TLS 1.3 connections.
```

**File**: `rustls/src/quic.rs` (modified, +11/-72)
```diff
@@ -3,21 +3,18 @@ use alloc::vec::Vec;
 use core::ops::{Deref, DerefMut};
 use core::{fmt, mem};
 
-use pki_types::{DnsName, FipsStatus, ServerName};
+use pki_types::{DnsName, FipsStatus};
 
 use crate::TlsInputBuffer;
-use crate::client::{ClientConfig, ClientSide};
+use crate::client::ClientSide;
 pub use crate::common_state::Side;
 use crate::common_state::{CommonState, ConnectionOutputs, Protocol};
 use crate::conn::{ConnectionCommon, KeyingMaterialExporter, MessageIter, SideData, StateMachine};
 use crate::crypto::VerifiedIdentity;
 use crate::crypto::cipher::{AeadKey, Iv, Payload};
 use crate::crypto::tls13::{Hkdf, HkdfExpander, OkmBlock};
-use crate::enums::ApplicationProtocol;
 use crate::error::{ApiMisuse, Error};
-use crate::msgs::{
-    ClientExtensionsInput, Message, MessagePayload, ServerExtensionsInput, TransportParameters,
-};
+use crate::msgs::{Message, MessagePayload, ServerExtensionsInput, TransportParameters};
 use crate::server::{
     ChooseConfig, ClientHello, HandshakeVerifyClientIdentity, ServerConfig, ServerSide, ServerState,
 };
@@ -66,70 +63,6 @@ pub struct ClientConnection {
 }
 
 impl ClientConnection {
-    /// Make a new QUIC ClientConnection.
-    ///
-    /// This differs from `ClientConnection::new()` in that it takes an extra `params` argument,
-    /// which contains the TLS-encoded transport parameters to send.
-    pub fn new(
-        config: Arc<ClientConfig>,
-        quic_version: Version,
-        name: ServerName<'static>,
-        params: Vec<u8>,
-    ) -> Result<Self, Error> {
-        let alpn_protocols = config.alpn_protocols.clone();
-        Self::new_with_alpn(config, quic_version, name, params, alpn_protocols)
-    }
-
-    /// Make a new QUIC ClientConnection with custom ALPN protocols.
-    pub fn new_with_alpn(
-        config: Arc<ClientConfig>,
-        version: Version,
-        name: ServerName<'static>,
-        params: Vec<u8>,
-        alpn_protocols: Vec<ApplicationProtocol<'static>>,
-    ) -> Result<Self, Error> {
-        let suites = &config.provider().tls13_cipher_suites;
-        if suites.is_empty() {
-            return Err(ApiMisuse::QuicRequiresTls13Support.into());
-        }
-
-        if !suites
-            .iter()
-            .any(|scs| scs.quic.is_some())
-        {
-            return Err(ApiMisuse::NoQuicCompatibleCipherSuites.into());
-        }
-
-        let exts = ClientExtensionsInput {
-            transport_parameters: Some(match version {
-                Version::V1 | Version::V2 => TransportParameters::Quic(Payload::new(params)),
-            }),
-
-            ..ClientExtensionsInput::from_alpn(alpn_protocols)
-        };
-
-        let mut quic = Quic {
-            version,
-            ..Quic::default()
-        };
-
-        let mut tls = Vec::new();
-        let inner = ConnectionCommon::for_client(
-            config,
-            name,
-            exts,
-            Some(&mut quic),
-            Protocol::Quic(version),
-            &mut tls,
-        )?;
-
-        // In QUIC mode, handshake output is emitted via `QuicEvent`s, not `tls`.
-        debug_assert!(tls.is_empty());
-        Ok(Self {
-            inner: QuicCommon::new(inner, quic),
-        })
-    }
-
     /// Return the FIPS validation status of the connection.
     pub fn fips(&self) -> FipsStatus {
         self.inner.fips
@@ -210,6 +143,12 @@ impl fmt::Debug for ClientConnection {
     }
 }
 
+impl From<QuicCommon<ClientSide>> for ClientConnection {
+    fn from(inner: QuicCommon<ClientSide>) -> Self {
+        Self { inner }
+    }
+}
+
 /// A QUIC server connection.
 pub struct ServerConnection {
     inner: QuicCommon<ServerSide>,
@@ -658,13 +597,13 @@ pub enum QuicEvent {
 }
 
 /// A shared interface for QUIC connections.
-struct QuicCommon<Side: SideData> {
+pub(crate) struct QuicCommon<Side: SideData> {
     common: ConnectionCommon<Side>,
     quic: Quic,
 }
 
 impl<Side: SideData> QuicCommon<Side> {
-    fn new(common: ConnectionCommon<Side>, quic: Quic) -> Self {
+    pub(crate) fn new(common: ConnectionCommon<Side>, quic: Quic) -> Self {
         Self { common, quic }
     }
 
```

#### Recent Merged Pull Requests:
- **PR #3328** (2026-10-04): Update crabgrind to 0.4 (@djc)
- **PR #3327** (closed): Update Rust crate crabgrind to 0.4 (@renovate-bot)
- **PR #3326** (closed): Update dependency rust to 1.99 (@renovate-bot)
- **PR #3323** (2026-10-03): Drop remaining references to hashbrown (@djc)
- **PR #3321** (2026-10-03): Support client-side early data sending for `ClientHandshake` (@ctz)
- **PR #3320** (2026-10-02): Remove unused function (@ctz)
- **PR #3319** (2026-10-02): msgs: move code up above tests module (@djc)
- **PR #3318** (2026-10-02): compress: reject trailing input in zlib and brotli decompressors (@Mounika2456)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
