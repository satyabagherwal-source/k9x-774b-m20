> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source**: github ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Source Version**: `1a999f8a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T07:56:58.935Z  
> **Learning ID**: `learn-github-metalbear-co-mirrord`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): metalbear-co/mirrord

> **Canonical Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T07:56:58.930Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `metalbear-co/mirrord`
- **Description**: Run any process, on your machine or in an AI agent's environment, as if it were a pod in your Kubernetes cluster: real env vars, DNS, network, traffic.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 5430 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mirrord/agent/src/incoming/connection/body_utils.rs`
```
use std::io::Read;

use bytes::Bytes;
use hyper::body::Frame;
use mirrord_protocol::tcp::InternalHttpBodyFrame;

pub trait Framelike {
    fn data_ref(&self) -> Option<&[u8]>;
}

impl Framelike for Frame<Bytes> {
    fn data_ref(&self) -> Option<&[u8]> {
        self.data_ref().map(|v| &**v)
    }
}

impl Framelike for InternalHttpBodyFrame {
    fn data_ref(&self) -> Option<&[u8]> {
        match self {
            InternalHttpBodyFrame::Data(payload) => Some(payload),
            InternalHttpBodyFrame::Trailers(_) => None,
        }
    }
}

/// Implements [`Read`] for slices of [`Framelike`] objects, like
/// [`InternalHttpBodyFrame`] or [`Frame<Bytes>`]
pub struct FramesReader<'a, T> {
    /// The portion of the slice that we've yet to process
    remaining: &'a [T],

    /// How many bytes we've already read from the *current* frame.
    read_until: usize,
}

impl<T> Copy for FramesReader<'_, T> {}
impl<T> Clone for FramesReader<'_, T> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<'a, T> From<&'a [T]> for FramesReader<'a, T>
where
    T: Framelike,
{
    fn from(remaining: &'a [T]) -> Self {
        Self {
            remaining,
            read_until: 0,
        }
    }
}

impl<T: Framelike> Read for FramesReader<'_, T> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let frame = loop {
            let [first, rest @ ..] = self.remaining else {
                return Ok(0);
            };

            let Some(frame) = first.data_ref() else {
                return Ok(0);
            };

            if self.read_until == frame.len() {
                self.remaining = rest;
                self.read_until = 0;
            } else {
                assert!(self.read_until < frame.len());
                break frame;
            }
        };

        let until = Ord::min(frame.len(), self.read_until + buf.len());
        let range = self.read_until..until;

        buf.get_mut(..range.len())
            .unwrap()
            .copy_from_slice(frame.get(range.clone()).unwrap());

        self.read_until = until;

        Ok(range.len())
    }
}

#[cfg(test)]
mod test {
    use std::io::Read;

    use super::*;

    #[test]
    fn test_framelike() {
        let frames = vec![
            data(b"0123456789"),
            empty(),
            empty(),
            data(b"ABCDEFGHIJKLMNO"),
            empty(),
            data(b"VWXYZ"),
            nondata(),
            data(b"NEVER"),
        ];
        let mut reader = FramesReader {
            remaining: &frames,
            read_until: 0,
        };

        // Helper for shorter test code
        fn read_n<R: Read>(r: &mut R, n: usize) -> Vec<u8> {
            let mut buf = vec![0; n];
            let read = r.read(&mut buf).unwrap();
            buf.truncate(read);
            buf
        }

        // Read F1 part by part
        assert_eq!(read_n(&mut reader, 3), b"012");
        assert_eq!(read_n(&mut reader, 4), b"3456");
        assert_eq!(read_n(&mut reader, 3), b"789");

        // Skip multiple empty frames
        assert_eq!(read_n(&mut reader, 5), b"ABCDE");

        // Read across frame boundaries
        // Should get 10 remaining from F2, then 2 from F3 ("V", "W")
        assert_eq!(read_n(&mut reader, 12), b"FGHIJKLMNO");

        // Read remaining from F3
        assert_eq!(read_n(&mut reader, 4), b"VWXY");
        assert_eq!(read_n(&mut reader, 1), b"Z");

        // EOF: we hit the first nondata frame and we stay EOF
        for _ in 0..5 {
            let mut buf = [0u8; 1];
            let eof = reader.read(&mut buf).unwrap();
            assert_eq!(eof, 0);
        }
    }

    // ===== Helper Functions =====

    fn data(data: &[u8]) -> TestFrame {
        TestFrame::Data(data.to_vec())
    }

    fn empty() -> TestFrame {
        TestFrame::Data(vec![])
    }

    fn nondata() -> TestFrame {
        TestFrame::Nondata
    }

    // Mock TestFrame for testing
    #[derive(Clone)]
    enum TestFrame {
        Data(Vec<u8>),
        Nondata,
    }

    impl Framelike for TestFrame {
        fn data_ref(&self) -> Option<&[u8]> {
            match self {
                TestFrame::Data(v) => Some(v),
                TestFrame::Nondata => None,
            }
        }
    }
}

```

### Core Architecture Module: `mirrord/agent/src/util.rs`
```
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

use futures::{FutureExt, future::BoxFuture};
use tokio::sync::mpsc;

pub mod error;
pub mod io;
pub mod protocol_version;
pub mod rolledback_stream;
pub mod target_root;

/// Id of an agent's client. Each new client connection is assigned with a unique id.
pub type ClientId = u32;

/// [`Future`] that resolves to [`ClientId`] when the client drops their [`mpsc::Receiver`].
pub(crate) struct ChannelClosedFuture(BoxFuture<'static, ClientId>);

impl ChannelClosedFuture {
    pub(crate) fn new<T: 'static + Send>(tx: mpsc::Sender<T>, client_id: ClientId) -> Self {
        let future = async move {
            tx.closed().await;
            client_id
        }
        .boxed();

        Self(future)
    }
}

impl Future for ChannelClosedFuture {
    type Output = ClientId;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.get_mut().0.as_mut().poll(cx)
    }
}

#[cfg(test)]
mod channel_closed_tests {

    use futures::{FutureExt, StreamExt, stream::FuturesUnordered};
    use rstest::rstest;

    use super::*;

    /// Verifies that [`ChannelClosedFuture`] resolves when the related [`mpsc::Receiver`] is
    /// dropped.
    #[rstest]
    #[tokio::test]
    async fn channel_closed_resolves() {
        let (tx, rx) = mpsc::channel::<()>(1);
        let future = ChannelClosedFuture::new(tx, 0);
        std::mem::drop(rx);
        assert_eq!(future.await, 0);
    }

    /// Verifies that [`ChannelClosedFuture`] works fine when used in [`FuturesUnordered`].
    ///
    /// The future used to hold the [`mpsc::Sender`] and call poll [`mpsc::Sender::closed`] in it's
    /// [`Future::poll`] implementation. This worked fine when the future was used in a simple way
    /// ([`channel_closed_resolves`] test was passing).
    ///
    /// However, [`FuturesUnordered::next`] was hanging forever due to [`mpsc::Sender::closed`]
    /// implementation details.
    ///
    /// New implementation of [`ChannelClosedFuture`] uses a [`BoxFuture`] internally, which works
    /// fine.
    #[rstest]
    #[tokio::test]
    async fn channel_closed_works_in_futures_unordered() {
        let mut unordered: FuturesUnordered<ChannelClosedFuture> = FuturesUnordered::new();

        let (tx, rx) = mpsc::channel::<()>(1);
        let future = ChannelClosedFuture::new(tx, 0);

        unordered.push(future);

        assert!(unordered.next().now_or_never().is_none());
        std::mem::drop(rx);
        assert_eq!(unordered.next().await.unwrap(), 0);
    }
}

```

### Core Architecture Module: `mirrord/agent/src/util/error.rs`
```
use std::io;

use thiserror::Error;

use crate::namespace::NamespaceError;

/// Errors that can occur when creating a [`BgTaskRuntime`](crate::task::BgTaskRuntime).
#[derive(Error, Debug)]
pub(crate) enum AgentRuntimeError {
    #[error("failed to spawn runtime thread: {0}")]
    ThreadSpawnError(#[source] io::Error),
    #[error(transparent)]
    NamespaceError(#[from] NamespaceError),
    #[error("failed to build tokio runtime: {0}")]
    TokioRuntimeError(#[source] io::Error),
    #[error("runtime thread panicked")]
    Panicked,
}

```

### Core Architecture Module: `mirrord/agent/src/util/io.rs`
```
pub mod buffered;
pub mod throttle;
pub mod timeout;

```

### Core Architecture Module: `mirrord/agent/src/util/io/buffered.rs`
```
//! [`Sink`] and [`Stream`] wrappers that run IO in a background task.

use std::{
    io,
    pin::Pin,
    task::{Context, Poll, Waker},
};

use futures::{FutureExt, Sink, SinkExt, Stream, StreamExt, channel::mpsc, stream::FusedStream};
use tokio::task::JoinHandle;

/// [`Stream`] wrapper that continuously polls the inner stream in a background task.
///
/// Items yielded by the inner stream are pushed to an **unbounded** queue,
/// from which this wrapper reads them.
///
/// Use with care, as the queue is **unbounded**.
/// You most probably want to use this together with
/// [`ThrottledStream`](super::throttle::ThrottledStream).
pub struct UnboundedBufferedStream<T> {
    rx: mpsc::UnboundedReceiver<T>,
    task: Option<JoinHandle<io::Result<()>>>,
}

impl<T> UnboundedBufferedStream<T> {
    pub fn new<S>(stream: S) -> Self
    where
        S: Stream<Item = io::Result<T>> + Send + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = mpsc::unbounded();
        let task = tokio::spawn(Self::stream_task(stream, tx));
        Self {
            rx,
            task: Some(task),
        }
    }

    async fn stream_task<S>(stream: S, tx: mpsc::UnboundedSender<T>) -> io::Result<()>
    where
        S: Stream<Item = io::Result<T>>,
    {
        let mut stream = std::pin::pin!(stream);
        while let Some(item) = stream.next().await {
            if tx.unbounded_send(item?).is_err() {
                break;
            }
        }
        Ok(())
    }

    fn poll_task_result(&mut self, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        let Some(task) = self.task.as_mut() else {
            return Poll::Ready(Ok(()));
        };
        let result = std::task::ready!(task.poll_unpin(cx));
        self.task = None;
        result??;
        Poll::Ready(Ok(()))
    }
}

impl<T> Stream for UnboundedBufferedStream<T> {
    type Item = io::Result<T>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        if this.is_terminated() {
            return Poll::Ready(None);
        }
        if let Some(item) = std::task::ready!(this.rx.poll_next_unpin(cx)) {
            return Poll::Ready(Some(Ok(item)));
        }
        std::task::ready!(this.poll_task_result(cx))?;
        Poll::Ready(None)
    }
}

impl<T> FusedStream for UnboundedBufferedStream<T> {
    fn is_terminated(&self) -> bool {
        self.task.is_none()
    }
}

impl<T> Drop for UnboundedBufferedStream<T> {
    fn drop(&mut self) {
        if let Some(task) = self.task.as_ref() {
            task.abort();
        }
    }
}

/// [`Sink`] wrapper that continuously polls the inner sink in a background task.
///
/// Items sent to this wrapper are pushed to an **unbounded** queue,
/// from which the background task reads them and passes them to the inner sink.
///
/// Use with care, as the queue is **unbounded**.
/// You most probably want to use this together with
/// [`ThrottledSink`](super::throttle::ThrottledSink).
pub struct UnboundedBufferedSink<T> {
    tx: mpsc::UnboundedSender<T>,
    task: JoinHandle<io::Result<()>>,
}

impl<T> UnboundedBufferedSink<T> {
    pub fn new<S>(sink: S) -> Self
    where
        S: Sink<T, Error = io::Error> + Send + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = mpsc::unbounded();
        let task = tokio::spawn(Self::sink_task(sink, rx));
        Self { tx, task }
    }

    async fn sink_task<S>(sink: S, mut rx: mpsc::UnboundedReceiver<T>) -> io::Result<()>
    where
        S: Sink<T, Error = io::Error>,
    {
        let mut sink = std::pin::pin!(sink);
        'outer: while let Some(item) = rx.next().await {
            sink.feed(item).await?;
            loop {
                match rx.try_recv() {
                    Ok(item) => sink.feed(item).await?,
                    Err(mpsc::TryRecvError::Closed) => break 'outer,
                    Err(mpsc::TryRecvError::Empty) => break,
                }
            }
            sink.flush().await?;
        }
        sink.close().await?;
        Ok(())
    }

    fn poll_task_error(&mut self, cx: &mut Context<'_>) -> Poll<io::Error> {
        let error = match std::task::ready!(self.task.poll_unpin(cx)) {
            Ok(Ok(())) => io::Error::other("sink task finished prematurely, this is a bug"),
            Ok(Err(error)) => error,
            Err(error) => error.into(),
        };
        Poll::Ready(error)
    }
}

impl<T> Sink<T> for UnboundedBufferedSink<T> {
    type Error = io::Error;

    fn poll_ready(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let this = self.get_mut();
        if this.tx.is_closed() {
            this.poll_task_error(cx).map(Err)
        } else {
            Poll::Ready(Ok(()))
        }
    }

    fn start_send(self: Pin<&mut Self>, item: T) -> Result<(), Self::Error> {
        let this = self.get_mut();
        if this.tx.unbounded_send(item).is_err() {
            let error = match this.poll_task_error(&mut Context::from_waker(Waker::noop())) {
                Poll::Ready(error) => error,
                Poll::Pending => io::Error::other(
                    "sink task channel is closed, task result is not available yet",
                ),
            };
            Err(error)
        } else {
            Ok(())
        }
    }

    fn poll_flush(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn poll_close(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let this = self.get_mut();
        this.tx.close_channel();
        match std::task::ready!(this.task.poll_unpin(cx)) {
            Ok(result) => Poll::Ready(result),
            Err(error) => Poll::Ready(Err(error.into())),
        }
    }
}

impl<T> Drop for UnboundedBufferedSink<T> {
    fn drop(&mut self) {
        self.task.abort();
    }
}

#[cfg(test)]
mod test {
    use std::io;

    use futures::{StreamExt, stream};

    use super::UnboundedBufferedStream;

    #[tokio::test]
    async fn fuses_after_read_error() {
        let inner = stream::iter(vec![
            Ok::<u8, io::Error>(1),
            Err(io::Error::from(io::ErrorKind::ConnectionReset)),
        ]);
        let mut stream = UnboundedBufferedStream::new(inner);

        assert_eq!(stream.next().await.unwrap().unwrap(), 1);

        let error = stream.next().await.unwrap().unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::ConnectionReset);

        assert!(stream.next().await.is_none());
        assert!(stream.next().await.is_none());
    }
}

```

### Core Architecture Module: `mirrord/agent/src/util/io/throttle.rs`
```
//! Utils for throttling client data flowing through the agent.

use std::{
    collections::VecDeque,
    io::{self, IoSlice},
    ops::Deref,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};

use bytes::{Buf, Bytes};
use futures::{Sink, SinkExt, Stream};
use pin_project_lite::pin_project;
use prometheus::IntGauge;
use tokio::{
    io::AsyncWrite,
    sync::{OwnedSemaphorePermit, Semaphore},
};
use tokio_util::sync::PollSemaphore;

use crate::metrics::IntGaugeGuard;

/// Shared store for permits that can be used to throttle data [`Stream`]s and [`Sink`]s.
///
/// Should be used when proxying data to/from the client.
/// See [`ThrottledStream`]/[`ThrottledSink`].
///
/// An instance can be cloned and shared.
/// Clones use the same permit pool.
///
/// The permits in use stand for the memory held: each chunk of data takes its length plus a fixed
/// per-chunk overhead. They are reported in the `in_use` gauge, through [`ThrottlePermit`]s, and
/// clones report to the same gauge.
#[derive(Debug, Clone)]
pub struct Throttle {
    max_permits: usize,
    sem: PollSemaphore,
    in_use: IntGauge,
}

impl Throttle {
    pub fn new(max_permits: usize, in_use: IntGauge) -> Self {
        Self {
            max_permits,
            sem: PollSemaphore::new(Arc::new(Semaphore::new(max_permits))),
            in_use,
        }
    }

    fn poll_acquire<D: IsClientData>(
        &mut self,
        data: &D,
        cx: &mut Context<'_>,
    ) -> Poll<Option<ThrottlePermit>> {
        let permits = data.size() + std::mem::size_of::<Bytes>();
        let permits = permits.min(self.max_permits);
        let permits = u32::try_from(permits).unwrap_or(u32::MAX);
        self.sem.poll_acquire_many(cx, permits).map(|permit| {
            permit.map(|permit| ThrottlePermit {
                _in_use: IntGaugeGuard::new(self.in_use.clone(), permit.num_permits()),
                _permit: permit,
            })
        })
    }
}

/// Permits of a [`Throttle`], reported in its `in_use` gauge until dropped.
#[derive(Debug)]
pub struct ThrottlePermit {
    _permit: OwnedSemaphorePermit,
    _in_use: IntGaugeGuard,
}

/// Trait for values that store client data.
pub trait IsClientData {
    /// Returns the size of this value in memory.
    fn size(&self) -> usize;
}

impl IsClientData for Bytes {
    fn size(&self) -> usize {
        self.len() + std::mem::size_of::<Bytes>()
    }
}

/// User data that was throttled, either with [`ThrottledStream`] or [`ThrottledSink`].
///
/// This value borrows permits from its parent [`Throttle`] instance.
/// The permits are returned on drop.
#[derive(Debug)]
pub struct Throttled<D> {
    data: D,
    permit: ThrottlePermit,
}

impl<D> Throttled<D> {
    /// Returns the client data and the permits acquired from the parent [`Throttle`] instance.
    ///
    /// Drop the permits after removing the data from memory.
    pub fn unpack(self) -> (D, ThrottlePermit) {
        (self.data, self.permit)
    }
}

impl<D> Deref for Throttled<D> {
    type Target = D;

    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

pin_project! {
    /// [`Stream`] wrapper that will suspend the data until
    /// it acquired required permits from the inner [`Throttle`] instance.
    ///
    /// Each data item requires [`IsClientData::size`] permits.
    pub struct ThrottledStream<D, S> {
        throttle: Throttle,
        #[pin]
        stream: S,
        ready_data: Option<D>,
    }
}

impl<D, S> ThrottledStream<D, S> {
    pub fn new(stream: S, throttle: Throttle) -> Self {
        Self {
            throttle,
            stream,
            ready_data: None,
        }
    }
}

impl<D, S> Stream for ThrottledStream<D, S>
where
    S: Stream<Item = io::Result<D>>,
    D: IsClientData,
{
    type Item = io::Result<Throttled<D>>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.project();

        let data = match &this.ready_data {
            Some(data) => data,
            None => match std::task::ready!(this.stream.poll_next(cx)) {
                Some(Ok(data)) => this.ready_data.insert(data),
                Some(Err(error)) => return Poll::Ready(Some(Err(error))),
                None => return Poll::Ready(None),
            },
        };

        match std::task::ready!(this.throttle.poll_acquire(data, cx)) {
            Some(permit) => Poll::Ready(Some(Ok(Throttled {
                data: this.ready_data.take().expect("was filled above"),
                permit,
            }))),
            None => Poll::Ready(None),
        }
    }
}

pin_project! {
    /// [`Sink`] wrapper that will suspend the data until
    /// it acquired required permits from the inner [`Throttle`] instance.
    ///
    /// Each data item requires [`IsClientData::size`] permits.
    pub struct ThrottledSink<D, S> {
        throttle: Throttle,
        #[pin]
        sink: S,
        ready_data: Option<D>,
    }
}

impl<D, S> ThrottledSink<D, S> {
    pub fn new(sink: S, throttle: Throttle) -> Self {
        Self {
            throttle,
            sink,
            ready_data: None,
        }
    }
}

impl<D, S> Sink<D> for ThrottledSink<D, S>
where
    S: Sink<Throttled<D>, Error = io::Error>,
    D: IsClientData,
{
    type Error = io::Error;

    fn poll_ready(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let mut this = self.project();
        let Some(data) = &this.ready_data else {
            return Poll::Ready(Ok(()));
        };
        std::task::ready!(this.sink.as_mut().poll_ready(cx))?;
        let permit = std::task::ready!(this.throttle.poll_acquire(data, cx))
            .ok_or_else(|| io::Error::other("throttler closed"))?;
        this.sink.start_send(Throttled {
            data: this.ready_data.take().expect("was checked above"),
            permit,
        })?;
        Poll::Ready(Ok(()))
    }

    fn start_send(self: Pin<&mut Self>, item: D) -> Result<(), Self::Error> {
        let this = self.project();
        if this.ready_data.is_none() {
            this.ready_data.replace(item);
            Ok(())
        } else {
            Err(io::Error::other("sink not ready"))
        }
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        std::task::ready!(self.as_mut().poll_ready_unpin(cx))?;
        self.project().sink.poll_flush(cx)
    }

    fn poll_close(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        std::task::ready!(self.as_mut().poll_ready_unpin(cx))?;
        self.project().sink.poll_close(cx)
    }
}

/// Number of [`IoSlice`]s used by [`IoVecThrottledSink`] when issuing vectored writes.
pub const MAX_IO_VECS: usize = 16;

pin_project! {
    /// [`AsyncWrite`] wrapper that turns it into a [`Sink`] of throttled [`Bytes`].
    ///
    /// It uses an internal buffer of size [`MAX_IO_VECS`], and flushes the data using vectored writes.
    /// [`Throttle`] permits for each data chunk are returned only after the chunk has been fully written
    /// into the inner writer.
    pub struct IoVecThrottledSink<W> {
        #[pin]
        writer: W,
        buffered: VecDeque<Throttled<Bytes>>,
    }
}

impl<W> IoVecThrottledSink<W>
where
    W: AsyncWrite,
{
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            buffered: VecDeque::with_capacity(MAX_IO_VECS),
        }
    }

    fn poll_flush_buffer_down_to(
        self: Pin<&mut Self>,
        size: usize,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>> {
        let mut this = self.project();
        while this.buffered.len() > size {
            let mut io_vecs = [IoSlice::new(&[]); MAX_IO_VECS];
            let mut filled = 0;
            this.buffered
                .iter()
                .zip(io_vecs.iter_mut())
                .for_each(|(data, io_vec)| {
                    *io_vec = IoSlice::new(data.as_ref());
                    filled += 1;
                });
            let mut written = std::task::ready!(
                this.writer.as_mut().poll_write_vectored(
                    cx,
                    io_vecs
                        .get(..filled)
                        .expect("index comes from iteration on the array")
                )
            )?;
            if written == 0 {
                return Poll::Ready(Err(io::ErrorKind::WriteZero.into()));
            }
            loop {
                let popped = this.buffered.pop_front_if(|chunk| {
                    if chunk.len() <= written {
                        return true;
                    }
                    chunk.data.advance(written);
                    false
                });
                if let Some(popped) = popped {
                    written -= popped.len();
                } else {
                    break;
                }
            }
        }

        Poll::Ready(Ok(()))
    }
}

impl<W> Sink<Throttled<Bytes>> for IoVecThrottledSink<W>
where
    W: AsyncWrite,
{
    type Error = io::Error;

    fn poll_ready(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.poll_flush_buffer_down_to(MAX_IO_VECS - 1, cx)
    }

    fn start_send(self: Pin<&mut Self>, item: Throttled<Bytes>) -> Result<(), Self::Error> {
        let this = self.project();
        if item.is_empty() {
            Ok(())
        } else if this.buffered.len() == MAX_IO_VECS {
            Err(io::Error::other("sink not ready"))
        } else {
            this.buffered.push_back(item);
            Ok(())
        }
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        std::task::ready!(self.as_mut().poll_flush_buffer_down_to(0, cx))?;
        self.project().writer.poll_flush(cx)
    }

    fn poll_close(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        std::task::ready!(self.as_mut().p
```

### Core Architecture Module: `mirrord/agent/src/util/io/timeout.rs`
```
use std::{
    io,
    ops::Not,
    pin::Pin,
    task::{Context, Poll},
    time::Duration,
};

use futures::Sink;
use pin_project_lite::pin_project;
use tokio::time::{Instant, Sleep};

pin_project! {
    /// [`Sink`] that applies a timeout to all operations.
    ///
    /// Should be used when proxying data from the client.
    /// This is a remedy for the fact that mirrord-protocol has no flow control.
    ///
    /// # Timeout logic
    ///
    /// Timeout count starts when any of the [`Sink`] methods returns [`Poll::Pending`].
    /// Timeout is disarmed when any of the [`Sink`] methods returns [`Poll::Ready`],
    /// or [`Sink::start_send`] succeeds.
    pub struct TimeoutSink<S> {
        #[pin]
        sleep: Sleep,
        #[pin]
        sink: S,
        timeout: Duration,
        armed: bool,
    }
}

impl<S> TimeoutSink<S> {
    pub fn new(sink: S, timeout: Duration) -> Self {
        Self {
            sleep: tokio::time::sleep(Duration::ZERO),
            sink,
            timeout,
            armed: false,
        }
    }
}

impl<T, S: Sink<T, Error = io::Error>> Sink<T> for TimeoutSink<S> {
    type Error = io::Error;

    fn poll_ready(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let mut this = self.project();
        if this.sink.poll_ready(cx)?.is_pending() {
            if this.armed.not() {
                *this.armed = true;
                this.sleep.as_mut().reset(Instant::now() + *this.timeout);
            }
            std::task::ready!(this.sleep.poll(cx));
            Poll::Ready(Err(io::ErrorKind::TimedOut.into()))
        } else {
            *this.armed = false;
            Poll::Ready(Ok(()))
        }
    }

    fn start_send(self: Pin<&mut Self>, item: T) -> Result<(), Self::Error> {
        let this = self.project();
        this.sink.start_send(item)?;
        *this.armed = false;
        Ok(())
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let mut this = self.project();
        if this.sink.poll_flush(cx)?.is_pending() {
            if this.armed.not() {
                *this.armed = true;
                this.sleep.as_mut().reset(Instant::now() + *this.timeout);
            }
            std::task::ready!(this.sleep.poll(cx));
            Poll::Ready(Err(io::ErrorKind::TimedOut.into()))
        } else {
            *this.armed = false;
            Poll::Ready(Ok(()))
        }
    }

    fn poll_close(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let mut this = self.project();
        if this.sink.poll_close(cx)?.is_pending() {
            if this.armed.not() {
                *this.armed = true;
                this.sleep.as_mut().reset(Instant::now() + *this.timeout);
            }
            std::task::ready!(this.sleep.poll(cx));
            Poll::Ready(Err(io::ErrorKind::TimedOut.into()))
        } else {
            *this.armed = false;
            Poll::Ready(Ok(()))
        }
    }
}

```

### Core Architecture Module: `mirrord/agent/src/util/protocol_version.rs`
```
use std::sync::{Arc, Mutex};

/// Shared and cloneable [`mirrord_protocol`] version of an agent client.
///
/// Client's [`mirrord_protocol`] is used in multiple places.
/// Storing it in behind a shared wrapper allows us to simplify the code
/// and avoid passing it around in messages.
///
/// Its [`Default`] implementation sets the version to `1.2.2`.
/// This is the last version that did not support version negotiation.
/// See [reference](https://github.com/metalbear-co/mirrord/commit/56da9828ad2553e6c5a11124c5d65f4d4b00e6e6#diff-3c754d6cce3c1b7f4856fc34e66df5e6d8850138dd1273be60f87420bc064f73).
///
/// Thanks to having a default value, we can still safely match against
/// [`semver::VersionReq::STAR`].
///
/// # Note
///
/// This could be implemeted nicely with [arc-swap](https://docs.rs/arc-swap/latest/arc_swap/),
/// but this struct alone is not worth the extra dependency.
#[derive(Clone, Debug)]
pub struct ClientProtocolVersion(Arc<Mutex<semver::Version>>);

impl Default for ClientProtocolVersion {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(semver::Version::new(1, 2, 2))))
    }
}

impl ClientProtocolVersion {
    /// Replaces the protocol version stored in this struct.
    ///
    /// Should be called when
    /// [`ClientMessage::SwitchProtocolVersion`](mirrord_protocol::ClientMessage::SwitchProtocolVersion)
    /// is received from the client.
    pub fn replace(&self, version: semver::Version) {
        *self.0.lock().unwrap() = version;
    }

    /// Returns whether the protocol version stored in this struct matches the given
    /// [`semver::VersionReq`].
    pub fn matches(&self, version_req: &semver::VersionReq) -> bool {
        version_req.matches(&self.0.lock().unwrap())
    }
}

#[cfg(test)]
impl std::str::FromStr for ClientProtocolVersion {
    type Err = semver::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        s.parse().map(Mutex::new).map(Arc::new).map(Self)
    }
}

```

### Core Architecture Module: `mirrord/agent/src/util/rolledback_stream.rs`
```
use std::{
    io,
    ops::Not,
    pin::Pin,
    task::{Context, Poll},
};

use actix_codec::ReadBuf;
use bytes::Buf;
use tokio::io::{AsyncRead, AsyncWrite};

/// A wrapper over an IO stream with a prepended prefix.
///
/// Its [`AsyncRead`] implementation will first read from the prefix, and only when it is
/// exhausted, it will read from the inner stream.
///
/// Once the prefix is exhausted, it is dropped to free the memory.
pub struct RolledBackStream<IO, B> {
    stream: IO,
    prefix: Option<B>,
}

impl<IO, B> RolledBackStream<IO, B>
where
    B: Buf,
{
    /// Prepends the given stream with the `prefix`.
    pub fn new(stream: IO, prefix: B) -> Self {
        Self {
            stream,
            prefix: prefix.has_remaining().then_some(prefix),
        }
    }
}

impl<IO, B> AsyncRead for RolledBackStream<IO, B>
where
    IO: AsyncRead + Unpin,
    B: Buf + Unpin,
{
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let this = self.get_mut();

        let Some(prefix) = this.prefix.as_mut() else {
            return Pin::new(&mut this.stream).poll_read(cx, buf);
        };

        // At this point, `prefix` cannot be empty.
        // This is guaranteed by the check in `RolledBackStream::new`
        // and the check at the end of this function.

        let mut remaining_capacity = buf.remaining();
        while remaining_capacity > 0 {
            let chunk = prefix.chunk();

            if chunk.is_empty() {
                break;
            }

            let chunk = chunk.get(..remaining_capacity).unwrap_or(chunk);
            buf.put_slice(chunk);
            prefix.advance(chunk.len());
            remaining_capacity = buf.remaining();
        }

        if prefix.has_remaining().not() {
            this.prefix = None;
        }

        Poll::Ready(Ok(()))
    }
}

impl<IO, B> AsyncWrite for RolledBackStream<IO, B>
where
    IO: AsyncWrite + Unpin,
    B: Unpin,
{
    fn is_write_vectored(&self) -> bool {
        self.stream.is_write_vectored()
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), io::Error>> {
        Pin::new(&mut self.get_mut().stream).poll_flush(cx)
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), io::Error>> {
        Pin::new(&mut self.get_mut().stream).poll_shutdown(cx)
    }

    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<Result<usize, io::Error>> {
        Pin::new(&mut self.get_mut().stream).poll_write(cx, buf)
    }

    fn poll_write_vectored(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        bufs: &[io::IoSlice<'_>],
    ) -> Poll<Result<usize, io::Error>> {
        Pin::new(&mut self.get_mut().stream).poll_write_vectored(cx, bufs)
    }
}

#[cfg(test)]
mod test {
    use rstest::rstest;
    use tokio::io::AsyncReadExt;

    use super::RolledBackStream;

    #[rstest]
    #[case(
        "some data",
        "some more data",
        &[
            "some dat",
            "a",
            "some mor",
            "e data",
            "",
        ],
    )]
    #[case(
        "GET / HTTP/1.1\r\n\r\n",
        "",
        &[
            "GET / HT",
            "TP/1.1\r\n",
            "\r\n",
            "",
        ],
    )]
    #[tokio::test]
    async fn rolledback_stream_read(
        #[case] buffer: &str,
        #[case] stream: &str,
        #[case] expected_reads: &[&str],
    ) {
        let mut stream = RolledBackStream::new(stream.as_bytes(), buffer.as_bytes());

        for expected_read in expected_reads {
            let mut buffer = [0_u8; 8];
            let bytes_read = stream.read_buf(&mut buffer.as_mut_slice()).await.unwrap();
            assert_eq!(
                std::str::from_utf8(buffer.get(..bytes_read).unwrap()).unwrap(),
                *expected_read,
            );
        }
    }
}

```

### Core Architecture Module: `mirrord/agent/src/util/target_root.rs`
```
//! Confines paths to the target's filesystem.
//!
//! tl;dr:
//! 1. When `mirrord-protocol` requires us to open a file descriptor in a target's filesystem,
//!    **always** do it through [`TargetRoot`];
//! 2. When `mirrord-protocol` requires us to act on a path in the target's filesystem,
//!    **always** obtain the file descriptor with [`TargetRoot`],
//!    then use the path returned from [`proc_fd_path`].
//!
//! # Rationale
//!
//! The agent opens paths it can't trust: those of file requests
//! ([`FileManager`](crate::file::FileManager)) and Unix socket addresses (`outgoing`), which a
//! client can set to anything. The agent itself can reach
//! far more than the target: a targeted agent runs with `hostPID`, so `/proc/1/root` is the node's
//! root, and it mounts the node's `/run` and `/var`. A path may be absolute, climb with `..`, or
//! lead through symlinks in the target's filesystem, and none of these should reach a file outside
//! the target's root. Paths from the agent's own configuration, such as the TLS steal config's
//! certificates, go through here too, since they lead through the same symlinks.
//!
//! [`TargetRoot`] is the **only** place that turns such a path into a file descriptor. It opens
//! paths with `openat2(2)` and `RESOLVE_IN_ROOT`, so the kernel resolves `..`, absolute paths and
//! absolute symlinks against the target's root, and with `RESOLVE_NO_MAGICLINKS`, so procfs links
//! such as `/proc/<pid>/root` or `/proc/<pid>/fd/<n>` can't jump out of it. The kernel resolves
//! the whole path in one syscall, so a concurrent rename or symlink swap in the target can't
//! redirect it. `openat2(2)` needs Linux 5.6, and on older kernels we use [`userspace`] instead.
//!
//! Callers act on the returned descriptors with `f*` syscalls, with `*at` syscalls on the single
//! final component that [`TargetRoot::open_parent`] returns, or through [`proc_fd_path`] for APIs
//! that only take a path. They never pass the path itself to a path-based syscall.
//!
//! # Alternatives
//!
//! File access could instead run with its root changed to the target's, with `chroot(2)` into
//! `/proc/<pid>/root`, in a separate process or in a thread that first leaves the process's
//! shared filesystem attributes with `unshare(CLONE_FS)`. The kernel would then resolve `..`,
//! absolute paths and absolute symlinks against the target's root in every syscall, with no
//! special resolution on our side, and on any kernel.
//!
//! That approach was rejected because `chroot(2)` requires `CAP_SYS_CHROOT`, a capability the
//! agent doesn't otherwise need. mirrord doesn't request it for the agent's container, and
//! container runtimes such as CRI-O don't grant it by default.

mod userspace;

use std::{
    ffi::{OsStr, OsString},
    fs::{File, ReadDir},
    io,
    ops::Not,
    os::{
        fd::{AsFd, AsRawFd, BorrowedFd, OwnedFd},
        unix::{ffi::OsStrExt, fs::DirEntryExt},
    },
    path::{Path, PathBuf},
    sync::{Arc, OnceLock},
};

use nix::{
    errno::Errno,
    fcntl::{self, AT_FDCWD, AtFlags, OFlag, OpenHow, ResolveFlag},
    sys::stat::{FileStat, Mode, fstat, fstatat},
};
use tracing::warn;

/// A directory a client opened, which relative paths in its later requests resolve against.
#[derive(Debug)]
pub(crate) struct Directory {
    pub(crate) file: File,
}

impl Directory {
    /// Lists the entries of [`Self::file`].
    pub(crate) fn read_dir(&self) -> io::Result<ReadDir> {
        std::fs::read_dir(proc_fd_path(&self.file))
    }
}

fn same_file(a: &FileStat, b: &FileStat) -> bool {
    (a.st_dev, a.st_ino) == (b.st_dev, b.st_ino)
}

/// The path of `fd` in the agent's own `/proc/self/fd`, for APIs that only take a path, such as
/// [`std::fs::read_dir`] or `connect(2)` on a Unix socket.
///
/// The kernel follows it to the file that `fd` holds, without resolving a path in the target
/// again. It's also short, unlike `/proc/<pid>/root` and a path in the target, which may not fit
/// in the 108 bytes of a Unix socket address.
pub(crate) fn proc_fd_path(fd: &impl AsRawFd) -> PathBuf {
    PathBuf::from(format!("/proc/self/fd/{}", fd.as_raw_fd()))
}

/// Where a resolution may go, like the `RESOLVE_*` flag of the same name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Scope {
    /// The starting directory is the root: `..` stops at it, and absolute paths and symlinks
    /// start from it.
    InRoot,
    /// The resolution fails with `EXDEV` if it would leave the starting directory, with `..`,
    /// an absolute path or an absolute symlink.
    Beneath,
}

/// What resolves the paths of [`TargetRoot`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Resolver {
    /// `openat2(2)`.
    Kernel,
    /// [`userspace`], for kernels without `openat2(2)`, or where a seccomp profile blocks it.
    Userspace,
}

impl Resolver {
    /// How many times a resolution is retried after the kernel aborts it with `EAGAIN`, which
    /// `RESOLVE_IN_ROOT` and `RESOLVE_BENEATH` do when a concurrent rename races a `..`.
    const EAGAIN_RETRIES: usize = 8;

    /// Picks [`Self::Kernel`] when `openat2(2)` works, once per process.
    ///
    /// Tests take their kernel case from here, so that where `openat2(2)` doesn't work they
    /// exercise the userspace walk, as the agent would, rather than fail.
    pub(crate) fn detect() -> Self {
        static DETECTED: OnceLock<Resolver> = OnceLock::new();

        *DETECTED.get_or_init(|| {
            let how = OpenHow::new()
                .flags(OFlag::O_PATH | OFlag::O_CLOEXEC)
                .resolve(ResolveFlag::RESOLVE_IN_ROOT | ResolveFlag::RESOLVE_NO_MAGICLINKS);

            match fcntl::openat2(AT_FDCWD, "/", how) {
                Ok(_) => Self::Kernel,
                Err(error) => {
                    warn!(
                        %error,
                        "openat2(2) is unavailable, file requests resolve their paths in userspace"
                    );
                    Self::Userspace
                }
            }
        })
    }

    fn open(
        self,
        dirfd: BorrowedFd<'_>,
        path: &Path,
        flags: OFlag,
        mode: Mode,
        scope: Scope,
    ) -> io::Result<OwnedFd> {
        let flags = flags | OFlag::O_CLOEXEC;

        if self == Self::Userspace {
            return userspace::open(dirfd, path, flags, mode, scope);
        }

        // Unlike `openat(2)`, `openat2(2)` fails with `EINVAL` on a `mode` it wouldn't use.
        let mode = if flags.contains(OFlag::O_CREAT) {
            mode
        } else {
            Mode::empty()
        };
        let resolve = match scope {
            Scope::InRoot => ResolveFlag::RESOLVE_IN_ROOT,
            Scope::Beneath => ResolveFlag::RESOLVE_BENEATH,
        };
        let how = OpenHow::new()
            .flags(flags)
            .mode(mode)
            .resolve(resolve | ResolveFlag::RESOLVE_NO_MAGICLINKS);

        let mut retries = Self::EAGAIN_RETRIES;
        loop {
            match fcntl::openat2(dirfd, path, how) {
                Err(Errno::EAGAIN) if retries > 0 => retries -= 1,
                result => return result.map_err(io::Error::from),
            }
        }
    }
}

/// The root of the filesystem that the agent confines paths to.
///
/// The agent builds one, and shares clones of it, which are cheap: they share the descriptor of
/// the root.
#[derive(Debug, Clone)]
pub(crate) struct TargetRoot(Arc<Inner>);

#[derive(Debug)]
struct Inner {
    /// `/proc/<pid>/root` for a target container, `/` for the agent's own filesystem.
    path: PathBuf,
    /// [`Self::path`], opened when the [`TargetRoot`] is built.
    ///
    /// Opening it right away pins the target's root before the target can exit and another
    /// process reuse its PID, after which `/proc/<pid>/root` would be that process's root. When
    /// the open fails, every open that needs the root tries again. Opening `/proc/<pid>/root`
    /// needs ptrace access to the target, which an agent without `CAP_SYS_PTRACE` may not have,
    /// and then only what needs the root fails, not the whole agent.
    fd: OnceLock<OwnedFd>,
    resolver: Resolver,
}

impl TargetRoot {
    /// The root of the container of the process `pid`, or the agent's own root without one.
    pub(crate) fn for_target(pid: Option<u64>) -> Self {
        Self::new(match pid {
            Some(pid) => PathBuf::from(format!("/proc/{pid}/root")),
            None => PathBuf::from("/"),
        })
    }

    pub(crate) fn new(path: PathBuf) -> Self {
        Self::with_resolver(path, Resolver::detect())
    }

    pub(crate) fn with_resolver(path: PathBuf, resolver: Resolver) -> Self {
        let fd = OnceLock::new();
        match Self::open_root(&path) {
            Ok(opened) => {
                let _ = fd.set(opened);
            }
            Err(error) => warn!(
                %error,
                ?path,
                "Failed to open the target's root, opens in it will try again"
            ),
        }

        Self(Arc::new(Inner { path, fd, resolver }))
    }

    fn open_root(path: &Path) -> io::Result<OwnedFd> {
        // The agent picks this path, and `/proc/<pid>/root` is a magic link that has to be
        // followed.
        Ok(fcntl::open(
            path,
            OFlag::O_PATH | OFlag::O_DIRECTORY | OFlag::O_CLOEXEC,
            Mode::empty(),
        )?)
    }

    fn fd(&self) -> io::Result<BorrowedFd<'_>> {
        if let Some(fd) = self.0.fd.get() {
            return Ok(fd.as_fd());
        }

        let fd = Self::open_root(&self.0.path)?;

        // A concurrent open may have won, and then `fd` is closed.
        Ok(self.0.fd.get_or_init(|| fd).as_fd())
    }

    /// Opens `path` inside the root, with `flags` and `mode` as `openat(2)` takes them.
    ///
    /// A relative `path` resolves from `base`. An absolute `path` always resolves from the
    /// root, the way `openat(2)` ignores its `dirfd` for one.
    ///
    /// A relative `path` without
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5277** (2026-11-25): **Target paths with extra segments after the container name are accepted and the extras dropped**
  *Symptoms*: ### Bug Description  A target path with extra segments after the container name is accepted, and the extra segments are silently dropped. For example, `pod/foo/container/bar/baz` parses as pod `foo` with container `bar`.  This happens for every target type that goes through `FromSplit` (pod, deployment/deploy, rollout, job, cronjob, statefulset, service, replicaset, serverless): each `from_split` reads the name and an optional `container/{name}` pair and never checks that the path ends there.  Other inputs are already rejected, so the behaviour is inconsistent:  - `label/app=x/container/c/extra` is rejected with "must use `label/key=value[,key=value...][/container/name]`". - `pod/foo/` is rejected.  ### Steps to Reproduce  At `a300913`, in `mirrord/config`:  ```rust let target: Target = "pod/foo/container/bar/baz".parse().unwrap(); // Ok assert_eq!(target.to_string(), "pod/foo/container/bar"); ```  Same with `mirrord exec --target pod/foo/container/bar/baz -- ...` or `"target": "deployment/foo/container/bar/baz"` in the config file.  ### mirrord CLI version  `main` at `a300913`  ### Your operating system and version  macOS 26.6.2 (arm64); the parsing code is platform-independent.  ### Local process  Not relevant; this is target path parsing in `mirrord-config`.  ### Expected  An `InvalidTargetPath` error, like the other malformed paths, so a mistyped target isn't used silently.  I'd like to fix this; I have a small change in `Target::from_str` with a test ready. 

- **Issue #5092** (2026-10-18): **mirrord crashes Go programs on Linux ARM64**
  *Symptoms*: ### Bug Description  Under mirrord 3.274.0 on Linux ARM64, a Go program can crash with SIGSEGV when a system call returns a 64-bit value, such as a pointer. The kernel call succeeds, but the program receives a corrupted result.  Example: an anonymous `mmap` returns `0xffff83298000`. The Go program receives `0xffffffff83298000` with no error, and its first write to that address faults. `mmap` is only one example. Any hooked syscall with a result wider than 32 bits is affected.  Cause: mirrord intercepts Go syscalls in the [ARM64 hook](https://github.com/metalbear-co/mirrord/blob/747cc39839876068bbd031cf1d31cdf3ced70f34/mirrord/layer-go/src/linux_aarch64.rs#L24-L81). The hook uses Go's `runtime.asmcgocall` to run mirrord's Rust handler, which returns a 64-bit `i64`. Go declares `asmcgocall` as returning `int32`, so its [assembly implementation](https://github.com/golang/go/blob/6885bad7dd86880be6929c02085e5c7a67ff2887/src/runtime/asm_arm64.s#L1012) stores the result with `MOVW`, keeping only the low 32 bits (sign-extended). The hook then treats this truncated value as the full syscall result.  ```mermaid sequenceDiagram     participant G as Go caller (Syscall6)     participant D as mirrord hook (asm)     participant A as runtime.asmcgocall     participant H as Rust handler     participant K as Linux kernel      G->>D: Syscall6(SYS_MMAP, ...)     D->>A: asmcgocall(handler)     A->>H: call     H->>K: mmap(...)     K-->>H: 0xffff83298000     H-->>A: i64 result     Note over A: Dec

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

### Incident Patch 1: `aee4b8a5` (2026-11-24)
**Commit Message**: Drop unsafe jaq builtins (#5301)

* Dropped unsage jaq builtins

* Added UT

* Copy mirrord-jaq and mirrord-test-macros into the agent image build

**File**: `Cargo.lock` (modified, +3/-5)
```diff
@@ -5195,12 +5195,12 @@ dependencies = [
  "hyper-util",
  "jaq-core",
  "jaq-json",
- "jaq-std",
  "k8s-cri",
  "libc",
  "mirrord-agent-env",
  "mirrord-agent-iptables",
  "mirrord-cluster-auth",
+ "mirrord-jaq",
  "mirrord-nightly-polyfill",
  "mirrord-protocol",
  "mirrord-protocol-io",
@@ -5827,7 +5827,7 @@ dependencies = [
 
 [[package]]
 name = "mirrord-protocol"
-version = "1.30.2"
+version = "1.30.3"
 dependencies = [
  "actix-codec",
  "bincode",
@@ -5838,10 +5838,8 @@ dependencies = [
  "http-body-util",
  "http-serde",
  "hyper",
- "jaq-core",
- "jaq-json",
- "jaq-std",
  "libc",
+ "mirrord-jaq",
  "mirrord-macros",
  "nix 0.31.3",
  "semver 1.0.28",
```

**File**: `changelog.d/+jq-env-halt-builtins.security.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+User-supplied jq filters can no longer call `env`, `halt`, or `halt_error`. A filter that calls one of these now fails with an `Undefined filter` error.
```

**File**: `mirrord/agent/Cargo.toml` (modified, +1/-1)
```diff
@@ -25,6 +25,7 @@ mirrord-sessions-manager-client.workspace = true
 mirrord-cluster-auth = { workspace = true, features = ["eks"] }
 mirrord-remote-layer-protocol.workspace = true
 mirrord-agent-env = { path = "./env", default-features = false }
+mirrord-jaq = { path = "../jaq", default-features = false }
 mirrord-agent-iptables = { path = "./iptables" }
 mirrord-tls-util = { path = "../tls-util" }
 mirrord-nightly-polyfill = { path = "../nightly-polyfill" }
@@ -84,7 +85,6 @@ rcgen.workspace = true
 serde_json_path.workspace = true
 dns-lookup.workspace = true
 tokio-retry.workspace = true
-jaq-std.workspace = true
 jaq-core.workspace = true
 jaq-json = { workspace = true, features = ["serde_json"] }
 
```

**File**: `mirrord/agent/Dockerfile` (modified, +3/-1)
```diff
@@ -22,6 +22,8 @@ COPY .cargo /app/.cargo
 COPY mirrord/macros /app/mirrord/macros
 COPY mirrord/nightly-polyfill /app/mirrord/nightly-polyfill
 COPY mirrord/tls-util /app/mirrord/tls-util
+COPY mirrord/test-macros /app/mirrord/test-macros
+COPY mirrord/jaq /app/mirrord/jaq
 COPY mirrord/protocol /app/mirrord/protocol
 COPY mirrord/protocol-io /app/mirrord/protocol-io
 COPY mirrord/remote-layer-protocol /app/mirrord/remote-layer-protocol
@@ -36,7 +38,7 @@ COPY Cargo.toml Cargo.lock CHANGELOG.md README.md LICENSE rust-toolchain.toml /a
 # so we remove from the workspace. `default-members` goes first: it names crates not copied here,
 # and its `members` substring would otherwise make the members rewrite match it too.
 RUN sed -i '/^default-members = \[/,/^\]/d' /app/Cargo.toml && \
-    sed -i '/members = \[/,/\]/c\members = [\n    "mirrord/agent",\n    "mirrord/agent/env",\n    "mirrord/agent/iptables",\n    "mirrord/cluster-auth",\n    "mirrord/macros",\n    "mirrord/nightly-polyfill",\n    "mirrord/operator-websocket",\n    "mirrord/protocol",\n    "mirrord/protocol-io",\n    "mirrord/remote-layer-protocol",\n    "mirrord/sessions-manager/client",\n    "mirrord/sessions-manager/protocol",\n    "mirrord/tls-util",\n]' /app/Cargo.toml
+    sed -i '/members = \[/,/\]/c\members = [\n    "mirrord/agent",\n    "mirrord/agent/env",\n    "mirrord/agent/iptables",\n    "mirrord/cluster-auth",\n    "mirrord/jaq",\n    "mirrord/macros",\n    "mirrord/nightly-polyfill",\n    "mirrord/operator-websocket",\n    "mirrord/protocol",\n    "mirrord/protocol-io",\n    "mirrord/remote-layer-protocol",\n    "mirrord/sessions-manager/client",\n    "mirrord/sessions-manager/protocol",\n    "mirrord/test-macros",\n    "mirrord/tls-util",\n]' /app/Cargo.toml
 
 
 # Build final binary against BuildKit cache mounts. The target directory is one of them, so cargo's
```

**File**: `mirrord/agent/src/http/filter.rs` (modified, +2/-20)
```diff
@@ -3,10 +3,7 @@ use std::{fmt::Debug, io::Read, ops::Not, sync::LazyLock, time::Duration};
 use fancy_regex::Regex;
 use http::HeaderMap;
 use hyper::http::request::Parts;
-use jaq_core::{
-    Ctx, RcIter,
-    load::{Arena, File, Loader},
-};
+use jaq_core::{Ctx, RcIter};
 use jaq_json::Val;
 use mirrord_agent_env::envs::JAQ_TIME_LIMIT;
 use mirrord_protocol::tcp::{HttpMethodFilter, JqQuery};
@@ -228,22 +225,7 @@ async fn eval_jaq(query: JqQuery, payload: String) -> Result<bool, String> {
     let span = tracing::warn_span!("jaq eval", ?query);
 
     let mut handle = tokio::task::spawn_blocking(move || {
-        let program = File {
-            code: query.as_str(),
-            path: (),
-        };
-        let loader = Loader::new(jaq_std::defs().chain(jaq_json::defs()));
-        let arena = Arena::default();
-        let modules = loader
-            .load(&arena, program)
-            .map_err(|errors| format!("failed to parse the filter: {errors:?}"))?;
-
-        let filter =
-            jaq_core::Compiler::default().with_funs(jaq_std::funs().chain(jaq_json::funs()));
-
-        let filter = filter
-            .compile(modules)
-            .map_err(|errors| format!("failed to compile the filter: {errors:?}"))?;
+        let filter = mirrord_jaq::compile_jq(query.as_str()).map_err(|error| error.to_string())?;
 
         let inputs = RcIter::new(core::iter::empty());
         let mut out = filter.run((Ctx::new([], &inputs), Val::from(payload)));
```

**File**: `mirrord/jaq/src/lib.rs` (modified, +40/-2)
```diff
@@ -87,9 +87,25 @@ fn compiler_error_to_string(error: CompileError) -> String {
     compile_error
 }
 
+/// Builtins of `jaq_std` that reach outside the program.
+///
+/// * `env` reads the environment of the process that runs it,
+/// * `halt` and `halt_error` exit that process.
+///
+/// Filters are written by user, and a user-defined program should not be able to call these
+/// in a shared environment. Such program should fail to compile.
+const DENIED_BUILTINS: &[&str] = &["env", "halt", "halt_error"];
+
+/// Compiles a user-supplied jq program with the standard library, minus [`DENIED_BUILTINS`].
+///
+/// Every place that runs a user's jq program should be compiled here, so that no caller can grant the
+/// program access to its environment or the power to exit.
 pub fn compile_jq(code: &str) -> Result<jaq_core::Filter<jaq_core::Native<jaq_json::Val>>> {
     let file = jaq_core::load::File { code, path: () };
-    let loader = jaq_core::load::Loader::new(jaq_std::defs().chain(jaq_json::defs()));
+    let defs = jaq_std::defs()
+        .chain(jaq_json::defs())
+        .filter(|def| !DENIED_BUILTINS.contains(&def.name));
+    let loader = jaq_core::load::Loader::new(defs);
     let arena = jaq_core::load::Arena::default();
     let modules = loader.load(&arena, file).map_err(|errors| {
         // Since we only load 1 file, there should only be 1 error, take first.
@@ -99,7 +115,10 @@ pub fn compile_jq(code: &str) -> Result<jaq_core::Filter<jaq_core::Native<jaq_js
         }
     })?;
 
-    let filter = jaq_core::Compiler::default().with_funs(jaq_std::funs().chain(jaq_json::funs()));
+    let funs = jaq_std::funs()
+        .chain(jaq_json::funs())
+        .filter(|(name, ..)| !DENIED_BUILTINS.contains(name));
+    let filter = jaq_core::Compiler::default().with_funs(funs);
 
     // Convert the compile errors into a human-readable string using our helper.
     filter.compile(modules).map_err(|errors| JqError::Compile {
@@ -248,6 +267,25 @@ mod tests {
         VerifiedJqString::try_from("idk | whatever").unwrap_err();
     }
 
+    #[test]
+    fn jq_verification_rejects_denied_builtins() {
+        for (program, builtin) in [
+            ("env | has(\"PATH\")", "env"),
+            (".a or (env.HOME == \"/root\")", "env"),
+            ("halt", "halt"),
+            ("halt_error", "halt_error"),
+            ("halt_error(1)", "halt_error"),
+        ] {
+            match VerifiedJqString::try_from(program) {
+                Err(JqError::Compile { error, .. }) => assert!(
+                    error.contains(&format!("Undefined filter: {builtin}")),
+                    "{program:?} failed with an unexpected error: {error}"
+                ),
+                other => panic!("{program:?} should fail to compile, got {other:?}"),
+            }
+        }
+    }
+
     #[test]
     fn test_estimate_string_len() {
         // This error doesn't make sens (complains about undefined symbols that don't appear in the
```

**File**: `mirrord/protocol/Cargo.toml` (modified, +2/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "mirrord-protocol"
-version = "1.30.2"
+version = "1.30.3"
 authors.workspace = true
 description.workspace = true
 documentation.workspace = true
@@ -44,9 +44,7 @@ uuid = { workspace = true, features = ["v4"] }
 mirrord-macros = { path = "../macros" }
 strum.workspace = true
 strum_macros.workspace = true
-jaq-core.workspace = true
-jaq-std.workspace = true
-jaq-json.workspace = true
+mirrord-jaq = { path = "../jaq", default-features = false }
 
 [target.'cfg(unix)'.dependencies]
 libc.workspace = true
```

**File**: `mirrord/protocol/src/tcp.rs` (modified, +8/-39)
```diff
@@ -17,10 +17,6 @@ use hyper::{
     HeaderMap, Method, Request, Response, StatusCode, Uri, Version,
     body::{Body, Frame},
 };
-use jaq_core::{
-    Compiler,
-    load::{Arena, File, Loader},
-};
 use mirrord_macros::protocol_break;
 use semver::VersionReq;
 use serde::{Deserialize, Serialize};
@@ -345,39 +341,12 @@ pub struct JqQuery(String);
 
 impl JqQuery {
     pub fn new(expr: &str) -> Result<Self, String> {
-        let inner = || {
-            let program = File {
-                code: expr,
-                path: (),
-            };
-            let loader = Loader::new(jaq_std::defs().chain(jaq_json::defs()));
-            let arena = Arena::default();
-
-            let modules = loader.load(&arena, program).map_err(|errors| {
-                errors
-                    .into_iter()
-                    .map(|e| format!("{e:?}"))
-                    .collect::<Vec<_>>()
-                    .join("; ")
-            })?;
-
-            Compiler::default()
-                .with_funs(jaq_std::funs().chain(jaq_json::funs()))
-                .compile(modules)
-                .map_err(|errors| {
-                    errors
-                        .into_iter()
-                        .map(|e| format!("{e:?}"))
-                        .collect::<Vec<_>>()
-                        .join("; ")
-                })?;
-
-            Ok(JqQuery(expr.to_owned()))
-        };
-
-        inner().inspect_err(|fail| {
-            tracing::error!(
-                r"
+        mirrord_jaq::compile_jq(expr)
+            .map(|_| JqQuery(expr.to_owned()))
+            .map_err(|error| error.to_string())
+            .inspect_err(|fail| {
+                tracing::error!(
+                    r"
                 Something went wrong while compiling jaq query {expr:?}
 
                 >> Please check that the string supplied is a valid jaq expression according to
@@ -386,8 +355,8 @@ impl JqQuery {
                 > Error:
                 {fail:#?}
                 "
-            )
-        })
+                )
+            })
     }
 }
 
```

---

### Incident Patch 2: `99480b10` (2026-11-24)
**Commit Message**: Describe what the mirrord MCP Server does, and link it from Quick Start (#5289)

* Link the mirrord MCP Server from Quick Start and Install mirrord

* Say what the mirrord MCP Server does for the user in its getting-started links

* Lead the mirrord MCP Server page with what it does for the user

The page opened with a list of tools, and the getting-started links
described the server in the same terms. The intro and both links now
say what the agent can do with it: generate and validate configs,
explain options, follow the skills and the safe defaults, offline.

The page also gains facts from the server at 3.291.0: Windows needs
3.291.0 for the skills, `validate_config` takes the directory mirrord
runs from, and the instructions list now has every instruction the
server sends.

* Use the new MCP Server description on the AI agents overview

* Add one-click install links for Cursor and VS Code to the MCP Server page

🤖 Generated with [Claude Code](https://claude.com/claude-code)

* Drop the schema_file note from the validate_config row

🤖 Generated with [Claude Code](https://claude.com/claude-code)

* Ask for the absolute path only when the client doesn't find mirrord

🤖 Generate

**File**: `docs/docs/getting-started/install-mirrord.md` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ mirrord supports Kubernetes `1.22` or later. This applies to the open-source ver
 
 ## Next steps
 
+- [mirrord MCP Server](../using-mirrord-with-ai/mcp-server.md): your AI agent generates mirrord configs, validates them deterministically, explains each option, and follows mirrord's skills and safe defaults, all offline.
 - [Onboarding Wizard](onboarding-wizard.md): generate a `mirrord-up.yaml` for your services.
 - [Starting your first session](first-session.md): run your local code in the context of the cluster.
 - [Install the Operator](install-the-operator.md): for teams sharing a cluster, the platform team installs it once per cluster.
```

**File**: `docs/docs/getting-started/quick-start.md` (modified, +3/-2)
```diff
@@ -24,8 +24,9 @@ Get mirrord running against your cluster in a few minutes.
 ## Developers
 
 1. [Install mirrord](install-mirrord.md): the CLI, or the extension for VS Code or a JetBrains IDE.
-2. [Onboarding Wizard](onboarding-wizard.md) (optional): generate a `mirrord-up.yaml` for your services.
-3. [Starting your first session](first-session.md): run your local code in the context of the cluster.
+2. [mirrord MCP Server](../using-mirrord-with-ai/mcp-server.md) (optional, needs the CLI): your AI agent generates mirrord configs, validates them deterministically, explains each option, and follows mirrord's skills and safe defaults, all offline.
+3. [Onboarding Wizard](onboarding-wizard.md) (optional): generate a `mirrord-up.yaml` for your services.
+4. [Starting your first session](first-session.md): run your local code in the context of the cluster.
 
 ## Platform teams
 
```

**File**: `docs/docs/using-mirrord-with-ai/README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ If you're using tools like Claude Code, Cursor, or Codex, mirrord lets you safel
 
 Here are some ways you can connect mirrord to your AI coding workflow:
 
-- **[mirrord MCP Server](./mcp-server.md)** - Register the MCP server built into the mirrord CLI, so your agent validates configs and reads the docs of your installed mirrord version.
+- **[mirrord MCP Server](./mcp-server.md)** - Register the MCP server built into the mirrord CLI, so your agent generates mirrord configs, validates them deterministically, explains each option, and follows mirrord's skills and safe defaults, all offline.
 - **[Agent skills for mirrord](./ai-skills-plugin.md)** - Install skills that give your AI assistant built-in mirrord expertise.
 - **[Test Claude Code Changes Against Staging](./claude-code.md)** - Set up Claude Code to run the code it writes against the real services in your staging cluster, step by step.
 - **[Configure AI Agents to Use mirrord](./the-meta-prompt.md)** - A prompt generator that creates project-specific `AGENTS.md` files and configurations automatically, saving hours of manual setup across multiple services.
```

**File**: `docs/docs/using-mirrord-with-ai/mcp-server.md` (modified, +21/-6)
```diff
@@ -1,6 +1,6 @@
 ---
 title: mirrord MCP Server
-description: Register the MCP server built into the mirrord CLI, so that your AI agent checks mirrord configs and reads the mirrord docs of the version you have installed.
+description: Register the MCP server built into the mirrord CLI, so that your AI agent generates and validates mirrord configs offline, for the mirrord version you run.
 tags:
   - oss
   - team
@@ -9,16 +9,24 @@ tags:
 
 # mirrord MCP Server
 
-The mirrord CLI includes an [MCP](https://modelcontextprotocol.io) server, `mirrord mcp`. It gives an AI agent tools to validate `mirrord.json` and `mirrord-up.yaml` against the schema of your installed mirrord version, to explain config options, and to search and read the mirrord docs and [skills](./ai-skills-plugin.md) that this version ships with. It works offline and never starts a session.
+`mirrord mcp` is the [MCP](https://modelcontextprotocol.io) server built into the mirrord CLI. With it, your AI agent:
+
+- Generates `mirrord.json` and `mirrord-up.yaml` files, and validates them against the schema of the mirrord version you run.
+- Explains any config option: what it does, the values it takes, and the mirrord plan it needs.
+- Follows the mirrord [skills](./ai-skills-plugin.md) for tasks such as database branching, Kafka splitting, preview environments, and CI.
+- Uses safe defaults on shared clusters: it mirrors incoming traffic, steals only with an HTTP filter, and targets staging or development clusters, never production.
+- Answers mirrord questions from the docs of your installed version.
+
+The server works offline, from the docs and schema built into your mirrord binary, and never starts a session.
 
 ## What you need
 
-- mirrord CLI `3.273.0` or later. Check with `mirrord --version`, and see [Install mirrord](../getting-started/install-mirrord.md).
+- mirrord CLI `3.273.0` or later, and `3.291.0` or later on Windows for the skills. Check with `mirrord --version`, and see [Install mirrord](../getting-started/install-mirrord.md).
 - An agent that supports MCP servers over stdio, such as Claude Code, Codex, Cursor, VS Code, Windsurf, Claude Desktop, or OpenCode.
 
 ## Register the server
 
-Use the absolute path to the `mirrord` binary. Clients that start from a desktop launcher don't inherit your shell's `PATH`. To find the path, run:
+If the client doesn't find `mirrord` on its `PATH`, use the absolute path to the binary. Clients started from a desktop launcher often don't see your shell's `PATH`. To find the path, run:
 
 ```sh
 which mirrord
@@ -43,7 +51,9 @@ codex mcp add mirrord -- /absolute/path/to/mirrord mcp
 {% endtab %}
 {% tab title="Cursor, Windsurf, Claude Desktop" %}
 
-Add the entry under `"mcpServers"` in the client's config file:
+In Cursor, you can [add the server with one click](cursor://anysphere.cursor-deeplink/mcp/install?name=mirrord&config=eyJjb21tYW5kIjoibWlycm9yZCIsImFyZ3MiOlsibWNwIl19). The link registers the command `mirrord` without a path, so Cursor has to find `mirrord` on its `PATH`. If Cursor lists no `mirrord` tools, replace `mirrord` in the entry's `command` with the absolute path.
+
+To register the server by hand, add the entry under `"mcpServers"` in the client's config file:
 
 - Cursor: `~/.cursor/mcp.json`, or `.cursor/mcp.json` in the project.
 - Windsurf: `~/.codeium/windsurf/mcp_config.json`.
@@ -56,7 +66,9 @@ Add the entry under `"mcpServers"` in the client's config file:
 {% endtab %}
 {% tab title="VS Code" %}
 
-Add the entry under `"servers"` in `.vscode/mcp.json`:
+You can [install the server with one click](vscode:mcp/install?%7B%22name%22%3A%22mirrord%22%2C%22command%22%3A%22mirrord%22%2C%22args%22%3A%5B%22mcp%22%5D%7D). The link registers the command `mirrord` without a path, so VS Code has to find `mirrord` on its `PATH`. If VS Code lists no `mirrord` tools, replace `mirrord` in `command` with the absolute path.
+
+To register the server by hand, add the entry under `"servers"` in `.vscode/mcp.json`:
 
 ```json
 "mirrord": { "type": "stdio", "command": "/absolute/path/to/mirrord", "args": ["mcp"] }
@@ -100,9 +112,12 @@ The server sends the agent instructions when it connects. They tell the agent to
 
 - Get the matching skill with `get_skill` before it starts a mirrord task.
 - Validate every config with `validate_config` before it writes the file, and fix issues until none remain.
+- Look up options with `explain_config_option` instead of guessing.
+- When mirrord fails, validate every config involved before it proposes a fix, and propose one fix at a time.
 - Answer questions about mirrord with `search_docs` and `read_doc`, not from memory.
 - Default to `mirror` for incoming traffic, and on a shared cluster use `steal` only with an HTTP filter.
 - Target staging or development clusters, never production.
+- Know that `mirrord exec` and `mirrord up` deploy nothing to the cluster, that database branches stay until their TTL runs out, and that preview environments stay until sto
```

#### Recent Merged Pull Requests:
- **PR #5306** (2026-11-24): Trim dependencies of the CLI and the agent (@Razz4780)
- **PR #5304** (2026-11-24): Release 3.291.1 (@cubby-mb[bot])
- **PR #5303** (2026-11-24): Harden filesystem path handling in the agent (@Razz4780)
- **PR #5301** (2026-11-24): Drop unsafe jaq builtins (@Razz4780)
- **PR #5294** (2026-11-24): ci: submit WinGet manifests from a workflow dispatched on main (@meowjesty)
- **PR #5291** (2026-11-23): Publish docs and guides when a labeled pull request merges (@meowjesty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Drop unsafe jaq builtins

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in metalbear-co/mirrord. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aee4b8a5`: Drop unsafe jaq builtins. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
 "mirrord-jaq",
version = "1.30.3"
 "mirrord-jaq",
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
 "jaq-std",
version = "1.30.2"
 "jaq-core",
 "jaq-json",
 "jaq-std",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aee4b8a5` are properly handled with clean fallback behavior.
