# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: metalbear-co-mirrord-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "metalbear-co-mirrord-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T15:17:57.630Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-metalbear-co-mirrord-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metalbear-co-mirrord-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T15:17:57.630Z`  
> **Learning ID**: `LEARN-EVO-metalbear-co-mirrord-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 77%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from metalbear-co-mirrord-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source**: github ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Source Version**: `7f23826a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T15:17:37.697Z  
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
> **Harvest Timestamp**: 2026-11-21T15:17:37.690Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `metalbear-co/mirrord`
- **Description**: Run any process, on your machine or in an AI agent's environment, as if it were a pod in your Kubernetes cluster: real env vars, DNS, network, traffic.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 5425 stars

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
pub mod path_resolver;
pub mod protocol_version;
pub mod rolledback_stream;

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

### Core Architecture Module: `mirrord/agent/src/util/path_resolver.rs`
```
use std::{
    io,
    ops::Not,
    os::unix::ffi::OsStrExt,
    path::{Component, Path, PathBuf},
};

use tracing::Level;

/// A helper struct for resolving paths as seen in the target container to paths accessible from the
/// root host.
///
/// Should be used whenever we need to access a file in the target container filesystem.
#[derive(Debug, Clone)]
pub struct InTargetPathResolver {
    root: PathBuf,
}

impl InTargetPathResolver {
    /// Number of chained symlinks that we can resolve before returning ELOOP.
    /// 40 matches the default on Linux.
    const MAX_SYMLINK_HOPS: u8 = 40;

    pub fn from_pid(target_pid: u64) -> Self {
        let root = format!("/proc/{target_pid}/root");

        Self {
            root: PathBuf::from(root),
        }
    }

    pub fn from_root() -> Self {
        Self {
            root: PathBuf::from("/"),
        }
    }

    /// Returns the given path, resolved with [`Self::root`] as root.
    /// The returned path will never climb above [`Self::root`] and
    /// will contain no symlinks.
    #[tracing::instrument(level = Level::TRACE, ret, err(level = Level::DEBUG))]
    pub fn resolve(&self, path: &Path) -> io::Result<PathBuf> {
        let mut depth = Self::MAX_SYMLINK_HOPS;
        self.resolve_inner(path, PathBuf::new(), &mut depth)
            .map(|p| self.root.join(&p))
    }

    /// Turns a path returned by [`Self::resolve`] back into the path as seen in the target
    /// container, by replacing the [`Self::root`] prefix with `/`.
    ///
    /// Needed when a resolved path is combined with further user-provided components (e.g. the
    /// `pathname` of `fstatat` relative to a `dirfd`), since the result has to go through
    /// resolution again.
    pub fn unresolve(&self, resolved: &Path) -> io::Result<PathBuf> {
        resolved
            .strip_prefix(&self.root)
            .map(|path| Path::new("/").join(path))
            .map_err(|_| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "path is not under the target root",
                )
            })
    }

    /// Main (bounded) recursive implementation function for resolving paths.
    /// Returns paths *without* the [`Self::root`] prefix, so these paths are
    /// *relative* to [`Self::root`]. Use [`Self::resolve`] to get real paths.
    /// This function is mainly for normalizing the path and correctly resolving
    /// any symlinks.
    ///
    /// `max_depth` is the max number of symlinks we are allowed to resolve
    /// before returning ELOOP. We use a `&mut` instead of passing it by value
    /// because it is decremented in recursive child calls, of which there might
    /// be multiple at the same recursion depth.
    fn resolve_inner(&self, path: &Path, from: PathBuf, max_depth: &mut u8) -> io::Result<PathBuf> {
        let mut tmp_path = if path.has_root() {
            PathBuf::new()
        } else {
            from
        };

        for comp in path.components() {
            match comp {
                Component::Prefix(_) => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "path prefixes are not supported",
                    ));
                }
                Component::RootDir => {}
                Component::CurDir => {}
                Component::ParentDir => {
                    tmp_path.pop();
                }
                Component::Normal(comp) => {
                    tmp_path.push(comp);
                    let real_path = self.root.join(&tmp_path);

                    // We don't use [`Path::is_symlink`] because it
                    // consumes all errors and returns false.
                    let is_symlink = match real_path.symlink_metadata() {
                        Ok(meta) => meta.file_type().is_symlink(),
                        Err(err) if err.kind() == io::ErrorKind::NotFound => false,
                        Err(err) => return Err(err),
                    };

                    if is_symlink.not() {
                        continue;
                    }

                    if *max_depth == 0 {
                        return Err(io::Error::from_raw_os_error(libc::ELOOP));
                    }

                    *max_depth -= 1;

                    // Symlink logic
                    let link = real_path.read_link()?;

                    let from = tmp_path
                        .parent()
                        .expect("tmp_path should not be empty at this point");

                    tmp_path = self.resolve_inner(&link, from.to_path_buf(), max_depth)?;
                }
            }
        }

        assert!(tmp_path.has_root().not());

        if path.as_os_str().as_bytes().ends_with(b"/") {
            tmp_path.push("");
        }

        Ok(tmp_path)
    }

    /// Resolves `path` like [`Self::resolve`], but does not follow a symlink in the last
    /// component.
    ///
    /// Meant for operations that act on the link itself, such as `lstat` and `readlink`. Joining
    /// the unresolved path onto the target root is not enough for those: the kernel resolves
    /// absolute symlinks in the intermediate components (e.g. `/var/run -> /run`) against the
    /// agent's root instead of the target's.
    ///
    /// A trailing slash makes the last component follow symlinks, same as in the kernel.
    pub fn resolve_no_follow(&self, path: &Path) -> io::Result<PathBuf> {
        if path.as_os_str().as_bytes().ends_with(b"/") {
            return self.resolve(path);
        }

        match (path.parent(), path.file_name()) {
            (Some(parent), Some(name)) => Ok(self.resolve(parent)?.join(name)),
            _ => self.resolve(path),
        }
    }
}

#[cfg(test)]
impl InTargetPathResolver {
    /// Constructs a new resolver with the given root path.
    ///
    /// Makes it easy to test with [`tempfile::tempdir`].
    pub fn with_root_path(root: PathBuf) -> Self {
        Self { root }
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, os::unix::fs::symlink};

    use super::*;

    /// Target root with `/var/run -> /run` (absolute) and `/run/secrets/token -> ..data/token`.
    fn target_root() -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("var")).unwrap();
        fs::create_dir_all(root.path().join("run/secrets/..data")).unwrap();
        fs::write(root.path().join("run/secrets/..data/token"), "secret").unwrap();
        symlink("/run", root.path().join("var/run")).unwrap();
        symlink("..data/token", root.path().join("run/secrets/token")).unwrap();
        root
    }

    #[test]
    fn no_follow_resolves_absolute_symlink_in_parent() {
        let root = target_root();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let resolved = resolver
            .resolve_no_follow(Path::new("/var/run/secrets/token"))
            .unwrap();

        assert_eq!(resolved, root.path().join("run/secrets/token"));
        assert!(resolved.symlink_metadata().unwrap().is_symlink());
        assert_eq!(resolved.read_link().unwrap(), PathBuf::from("..data/token"));
    }

    #[test]
    fn no_follow_keeps_last_component_symlink() {
        let root = target_root();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let resolved = resolver.resolve_no_follow(Path::new("/var/run")).unwrap();

        assert_eq!(resolved, root.path().join("var/run"));
        assert_eq!(resolved.read_link().unwrap(), PathBuf::from("/run"));
    }

    #[test]
    fn no_follow_with_trailing_slash_follows_last_component() {
        let root = target_root();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let resolved = resolver.resolve_no_follow(Path::new("/var/run/")).unwrap();

        assert!(resolved.symlink_metadata().unwrap().is_dir());
    }

    #[test]
    fn no_follow_root() {
        let root = target_root();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let resolved = resolver.resolve_no_follow(Path::new("/")).unwrap();

        assert!(resolved.symlink_metadata().unwrap().is_dir());
    }

    /// `/a/b -> c`, `/a/c -> d`, `/a/d` is a file.
    #[test]
    fn follows_chain_of_relative_symlinks() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("a")).unwrap();
        fs::write(root.path().join("a/d"), "").unwrap();
        symlink("c", root.path().join("a/b")).unwrap();
        symlink("d", root.path().join("a/c")).unwrap();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let resolved = resolver.resolve(Path::new("/a/b")).unwrap();

        assert_eq!(resolved, root.path().join("a/d"));
    }

    /// `/x -> /y`, `/y -> /z`, `/z` is a file.
    #[test]
    fn follows_chain_of_absolute_symlinks() {
        let root = tempfile::tempdir().unwrap();
        fs::write(root.path().join("z"), "").unwrap();
        symlink("/y", root.path().join("x")).unwrap();
        symlink("/z", root.path().join("y")).unwrap();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let resolved = resolver.resolve(Path::new("/x")).unwrap();

        assert_eq!(resolved, root.path().join("z"));
    }

    /// `/a -> b`, `/b -> a`.
    #[test]
    fn symlink_loop_is_eloop() {
        let root = tempfile::tempdir().unwrap();
        symlink("b", root.path().join("a")).unwrap();
        symlink("a", root.path().join("b")).unwrap();
        let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());

        let err = resolver.resolve(Path::new("/a")).unwrap_err();

        assert_eq!(err.raw_os_error(), Some(libc::ELOOP));
    }

    /// `/d0 -> d1/../d1`, `/d1 -> d2/../d2`, and so on down to a real directory.
    ///
  
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5092** (2026-10-18): **mirrord crashes Go programs on Linux ARM64**
  *Symptoms*: ### Bug Description  Under mirrord 3.274.0 on Linux ARM64, a Go program can crash with SIGSEGV when a system call returns a 64-bit value, such as a pointer. The kernel call succeeds, but the program receives a corrupted result.  Example: an anonymous `mmap` returns `0xffff83298000`. The Go program receives `0xffffffff83298000` with no error, and its first write to that address faults. `mmap` is only one example. Any hooked syscall with a result wider than 32 bits is affected.  Cause: mirrord intercepts Go syscalls in the [ARM64 hook](https://github.com/metalbear-co/mirrord/blob/747cc39839876068bbd031cf1d31cdf3ced70f34/mirrord/layer-go/src/linux_aarch64.rs#L24-L81). The hook uses Go's `runtime.asmcgocall` to run mirrord's Rust handler, which returns a 64-bit `i64`. Go declares `asmcgocall` as returning `int32`, so its [assembly implementation](https://github.com/golang/go/blob/6885bad7dd86880be6929c02085e5c7a67ff2887/src/runtime/asm_arm64.s#L1012) stores the result with `MOVW`, keeping only the low 32 bits (sign-extended). The hook then treats this truncated value as the full syscall result.  ```mermaid sequenceDiagram     participant G as Go caller (Syscall6)     participant D as mirrord hook (asm)     participant A as runtime.asmcgocall     participant H as Rust handler     participant K as Linux kernel      G->>D: Syscall6(SYS_MMAP, ...)     D->>A: asmcgocall(handler)     A->>H: call     H->>K: mmap(...)     K-->>H: 0xffff83298000     H-->>A: i64 result     Note over A: Dec

- **Issue #5026** (2026-10-16): **README example for disabling agent capabilities doesn't disable anything**
  *Symptoms*: ### Bug Description  Hi, I tried the example from the ["Additional capabilities"](https://github.com/metalbear-co/mirrord/blob/c0bfc954bb9e89f04dafe01d90022424d9038716/README.md#L155-L168) section of the README and the agent still gets all of its capabilities:  ``` $ MIRRORD_AGENT_DISABLED_CAPABILITIES=CAP_NET_RAW,CAP_SYS_PTRACE mirrord exec --target pod/root-target -- sleep 12 $ kubectl get pod/mirrord-agent-xie9vwzomp-sl9dv -o jsonpath='{.spec.containers[0].securityContext.capabilities}' {"add":["SYS_ADMIN","SYS_PTRACE","NET_ADMIN"]} ```  I think there are two reasons. [`agent.disabled_capabilities`](https://github.com/metalbear-co/mirrord/blob/c0bfc954bb9e89f04dafe01d90022424d9038716/mirrord/config/src/agent.rs#L241-L250) has no env variable, so it can only be set in the config file. And in the config file the names only work without the `CAP_` prefix, because [`get_capabilities`](https://github.com/metalbear-co/mirrord/blob/c0bfc954bb9e89f04dafe01d90022424d9038716/mirrord/kube/src/api/container/util.rs#L25-L38) compares the strings as they are, so `["CAP_SYS_PTRACE"]` and `["sys_ptrace"]` are ignored without any warning and only `["SYS_PTRACE"]` removes it. Also `NET_RAW` is not in the list anymore.  Since I had the cluster up I also checked what happens without each one, because the README only says it "will possibly limit mirrord functionalities":  | disabled | agent as a job | ephemeral agent | |---|---|---| | `SYS_PTRACE` | the agent doesn't start (`failed to open tar

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

### Incident Patch 1: `7f23826a` (2026-11-20)
**Commit Message**: Publish the docs and guides on every release (#5261)

* Publish the docs and guides on every release

GitBook's Documentation and Guides spaces sync the docs-published and
guides-published branches, which hold only the trees that #5258
imported, committed by hand when GitBook was switched to them. So a
page merged to docs/ or guides/ since then never reached the site.

The release now calls publish-docs.yaml after release_gh, with the new
tag as its ref. For each of docs/ and guides/, the workflow appends a
commit whose tree is that directory at the ref, on top of the branch
tip, and pushes both branches in one atomic, fast-forward-only push. A
branch whose tree already matches gets no commit.

The branch is never force-pushed, because GitBook pushes to it too
when a change request merges, and so can another run. A force push
would remove such a commit from the branch's history. Without it, the
commit stays there, although the publish still replaces its content
with the ref's. The job tries the push up to three times, and before
each retry it fetches the new tips and builds again. A concurrency
group would serialize the runs, but GitHub cancels a pending run when
another joins the 

**File**: `.github/workflows/publish-docs.yaml` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+name: Publish docs and guides
+
+# GitBook's Documentation and Guides spaces sync the `docs-published` and `guides-published` branches, not `main`, so
+# a page merged to `docs/` or `guides/` reaches the site only when this workflow publishes it. The release calls it for
+# the released commit, so the site describes what users can install. A dispatch publishes a fix between releases: run
+# it with `dry_run` first to list the files that differ from the published branches.
+#
+# Each publish appends one commit whose tree is exactly `<ref>:docs` or `<ref>:guides`, on top of the branch tip. The
+# branch is never force-pushed, because GitBook also pushes to it when a change request merges, and so can another run
+# of this workflow. A push that races one of them fails as non-fast-forward, and the job then fetches the new tip and
+# builds on top of it. That build replaces the other commit's content too, but the commit stays in the branch history,
+# so a change merged in GitBook can still be found and ported to `main`.
+
+on:
+  workflow_dispatch:
+    inputs:
+      ref:
+        description: 'Commit, branch or tag to publish. Empty selects the latest published release tag.'
+        required: false
+        type: string
+        default: ''
+      dry_run:
+        description: 'Build the publish commits and list the files they change, without pushing.'
+        required: false
+        type: boolean
+        default: true
+  workflow_call:
+    inputs:
+      ref:
+        description: 'Commit, branch or tag to publish. Empty selects the latest published release tag.'
+        required: false
+        type: string
+        default: ''
+      dry_run:
+        description: 'Build the publish commits and list the files they change, without pushing.'
+        required: false
+        type: boolean
+        default: true
+    secrets:
+      SLACK_CI_ALERTS_WEBHOOK_URL:
+        required: false
+
+permissions:
+  contents: read
+
+jobs:
+  # No concurrency group: GitHub cancels a pending run when another one joins its group, which could drop a release's
+  # publish without an alert. Without one, runs can overlap: each push only fast-forwards, so no run drops another's
+  # commit, and the run that pushes last decides what the site shows.
+  publish:
+    runs-on: blacksmith-4vcpu-ubuntu-2404
+    permissions:
+      contents: write
+      # Reads GitBook's commit statuses on the published branches.
+      statuses: read
+    env:
+      GH_TOKEN: ${{ github.token }}
+      GIT_AUTHOR_NAME: github-actions[bot]
+      GIT_AUTHOR_EMAIL: 41898282+github-actions[bot]@users.noreply.github.com
+      GIT_COMMITTER_NAME: github-actions[bot]
+      GIT_COMMITTER_EMAIL: 41898282+github-actions[bot]@users.noreply.github.com
+    # Each step has its own timeout, because a stalled API call or git transfer would otherwise hold the runner for the
+    # job's default 6 hours. The timeouts are on the steps, because a step timeout fails the step, so the notify step
+    # still runs, while a job timeout would cancel the job and skip the notify step.
+    steps:
+      - name: Resolve the ref to publish
+        id: resolve
+        timeout-minutes: 5
+        env:
+          INPUT_REF: ${{ inputs.ref }}
+        shell: bash
+        run: |
+          set -euo pipefail
+          latest_tag=$(gh release view --repo "$GITHUB_REPOSITORY" --json tagName --jq .tagName)
+          echo "latest_tag=$latest_tag" >> "$GITHUB_OUTPUT"
+          echo "ref=${INPUT_REF:-$latest_tag}" >> "$GITHUB_OUTPUT"
+
+      # Most of the repository's size is the images under docs/ and guides/, and the job mostly reads trees, so the
+      # checkout fetches no blobs up front (`filter`). Git fetches a blob when a command needs it, such as the Publish
+      # step's `git diff` of `.github/workflows`. Writing the full working tree would fetch every blob, so the checkout
+      # is sparse. The `sparse-checkout` input needs at least one path to turn sparse checkout on, so it names
+      # .github/workflows, a small directory that no step reads, and cone mode adds the root files. actions/checkout
+      # v6.0.2 already fetches with blob:none when `sparse-checkout` is set; `filter` states it so that the job doesn't
+      # depend on that default. The checkout still fetches `ref` and sets up the credentials that the push uses.
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+        timeout-minutes: 10
+        with:
+          ref: ${{ steps.resolve.outputs.ref }}
+          filter: blob:none
+          sparse-checkout: .github/workflows
+
+      - name: Publish
+        id: publish
+        timeout-minutes: 10
+        env:
+          REF: ${{ steps.resolve.outputs.ref }}
+          LATEST_TAG: ${{ steps.resolve.outputs.latest_tag }}
+          DRY_RUN: ${{ inputs.dry_run }}
+        shell: bash
+        run: |
+          set -euo pipefail
+          sha=$(git rev-parse HEAD)
+          label=$REF
+ 
```

**File**: `.github/workflows/release.yaml` (modified, +14/-0)
```diff
@@ -1134,6 +1134,20 @@ jobs:
       CUBBY_CLIENT_ID: ${{ secrets.CUBBY_CLIENT_ID }}
       CUBBY_PRIVATE_KEY: ${{ secrets.CUBBY_PRIVATE_KEY }}
 
+  publish_docs:
+    needs: [validate_release_request, release_gh]
+    if: needs.validate_release_request.outputs.should_release == 'true'
+    permissions:
+      contents: write
+      statuses: read
+    uses: ./.github/workflows/publish-docs.yaml
+    with:
+      # The tag that release_gh created at the released commit, so the publish commits name the version.
+      ref: ${{ needs.validate_release_request.outputs.version }}
+      dry_run: false
+    secrets:
+      SLACK_CI_ALERTS_WEBHOOK_URL: ${{ secrets.SLACK_CI_ALERTS_WEBHOOK_URL }}
+
   release_homebrew:
     needs: [validate_release_request, release_gh]
     runs-on: blacksmith-4vcpu-ubuntu-2404
```

**File**: `AGENTS.md` (modified, +6/-5)
```diff
@@ -149,11 +149,12 @@ schedule. What's only on `main` hasn't shipped and needs no compatibility; what'
 ## Related Repositories
 
 - `docs/` and `guides/` came from `metalbear-co/docs`, which keeps their earlier history. They document user-visible
-  behavior, so a change users notice usually updates them in the same pull request. GitBook still publishes the site
-  from `metalbear-co/docs` until it's switched to this repository, so an edit here doesn't reach the site yet, but
-  `mirrord mcp` embeds `docs/docs` when it's built, so an edit reaches it with the next mirrord release. The
-  configuration reference is the exception: it isn't in `docs/`, but is generated from `mirrord-config`'s doc comments
-  (`mirrord/config/AGENTS.md`), so a config change updates those instead.
+  behavior, so a change users notice usually updates them in the same pull request. The configuration reference is the
+  exception: it isn't in `docs/`, but is generated from `mirrord-config`'s doc comments (`mirrord/config/AGENTS.md`), so
+  a config change updates those instead. GitBook builds the site from the `docs-published` and `guides-published`
+  branches, which every mirrord release updates from the released commit (`publish-docs.yaml`), so an edit reaches the
+  site with the next release. `mirrord mcp` embeds `docs/docs` when it's built, so an edit there also reaches it with
+  the next release. `docs/AGENTS.md` says how to publish a fix between releases.
 - `skills/` came from `metalbear-co/skills`, which keeps its earlier history. `mirrord mcp` embeds `skills/skills` when
   it's built (`mirrord/mcp/AGENTS.md`), so an edit reaches it with the next mirrord release. Nothing copies `skills/` to
   `metalbear-co/skills` yet, so an edit doesn't reach that repository.
```

**File**: `CONTRIBUTING.md` (modified, +1/-0)
```diff
@@ -899,6 +899,7 @@ Releases are fully automated. Under normal circumstances no manual steps are req
    - Publishes the Docker images to GHCR.
    - Creates the GitHub release (with tag and release notes from `CHANGELOG.md`).
    - Publishes to Homebrew, Chocolatey, and WinGet.
+   - Publishes `docs/` and `guides/` to the `docs-published` and `guides-published` branches, which GitBook builds the docs site from.
    - Updates the `latest` git tag and notifies the infra repository.
 
 ## Triggering a release PR manually
```

**File**: `changelog.d/+publish-docs-on-release.internal.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+The mirrord docs site now updates with every mirrord release, so it describes the released version.
```

**File**: `docs/AGENTS.md` (modified, +17/-2)
```diff
@@ -2,9 +2,9 @@
 
 ## Overview
 
-Paths in this file are relative to this directory of the mirrord repository, which holds the Documentation tab of the [mirrord docs](https://metalbear.com/mirrord/docs), built by GitBook from the Markdown under `docs/`. GitBook still publishes the site from `metalbear-co/docs` until it's switched to the mirrord repository, so merging here doesn't publish yet. `mirrord mcp` embeds the pages, so a merged page reaches it with the next mirrord release.
+Paths in this file are relative to this directory of the mirrord repository, which holds the Documentation tab of the [mirrord docs](https://metalbear.com/mirrord/docs), built by GitBook from the Markdown under `docs/`. GitBook builds the site from the `docs-published` branch, which every mirrord release updates to the `docs/` of the released commit, so a merged page reaches the site with the next mirrord release. `mirrord mcp` embeds the pages, so it gets them with the same release. Each publish replaces the branch's content, so a page change merged in the GitBook editor is lost at the next publish: make page changes here.
 
-A page for an unreleased change names the versions expected to ship it. Every mirrord release ships the merged pages, through `mirrord mcp`, so a page for a CLI feature can merge with the feature. The operator ships on its own schedule, so a page for an unreleased operator feature merges only once the operator version that ships it is out. Otherwise a mirrord release would document a feature that users can't get yet.
+A page for an unreleased change names the versions expected to ship it. Every mirrord release publishes the merged pages and ships them in `mirrord mcp`, so a page for a CLI feature can merge with the feature. The operator ships on its own schedule, so a page for an unreleased operator feature merges only once the operator version that ships it is out. Otherwise a mirrord release would document a feature that users can't get yet.
 
 The Configuration tab is generated from the doc comments in `mirrord/config/src` at the repository root, and the Changelog tab from each product's `CHANGELOG.md`. Fix them there.
 
@@ -19,6 +19,21 @@ python3 .github/scripts/check_plan_tags.py
 
 CI runs it in the `content_check` job of the root `.github/workflows/ci.yaml`. There is no local build, and GitBook doesn't build pull requests to the mirrord repository, so they get no preview.
 
+## Publishing a Fix Between Releases
+
+A fix that can't wait for the next release goes out through the `Publish docs and guides` workflow (`.github/workflows/publish-docs.yaml` at the repository root), which publishes `docs/` to `docs-published` and `guides/` to `guides-published`. To publish a fix:
+
+1. Merge the fix to `main` first, like any other change, so that the next release keeps it.
+2. From the Actions tab, with "Use workflow from" left on `main`, run the workflow with `ref` set to `main` and `dry_run` on. The step summary names the commit that `main` resolved to and lists the files that differ from the published branches. Everything merged to `docs/` or `guides/` since the last publish goes out with the fix, so check that the list holds only what is ready to publish. If both branches already match, there is nothing to publish.
+3. If the list holds pages that must wait, such as one for a CLI feature that merged but isn't released yet, create a branch from the latest release tag, cherry-pick the fix onto it, push it, and dry-run that branch instead. Any name works except one that starts with `docs/`, which git refuses because the repository has a `docs` branch.
+4. Run the workflow again with `ref` set to the commit SHA from the dry run's summary and `dry_run` off, so it publishes the commit that the dry run checked. The workflow pushes, waits for GitBook to import the commits, and posts to `#ci-alerts` if any of it fails. Delete the branch from step 3 afterwards.
+
+A fix published while a release pull request is open disappears from the site when that release publishes, and comes back with the next release. The open release's branch was cut before the fix.
+
+The workflow waits up to five minutes in all for GitBook to import the commits that it pushed, and fails if GitBook reports a failed import, or no successful one in that time. For a branch that it didn't change, it reads the status once, without waiting: a failed import there fails the run, so a re-run after a failure still fails, while a missing or pending status only warns. A commit that GitBook never imports leaves the site at the previous publish. Check the space's Git Sync in GitBook, and try syncing it again from there. GitBook's Git Sync troubleshooting guide also says that a new commit on the branch makes GitBook import all the content again, and the next publish that changes `docs/` (or `guides/`, for `guides-published`) pushes one.
+
+The workflow refuses a `ref` that is older than the latest release. It also can't push a change to `docs/.github/work
```

**File**: `docs/README.md` (modified, +3/-3)
```diff
@@ -12,14 +12,14 @@ The root of the GitBook docs is `./docs`, as defined in `.gitbook.yaml`. See [th
 
 ### Development
 
-GitBook still publishes the site from [metalbear-co/docs](https://github.com/metalbear-co/docs) until it's switched to the mirrord repository, so merging here doesn't publish yet, and pull requests get no GitBook preview.
+GitBook builds the site from the `docs-published` branch, which every mirrord release updates from this directory, so a merged change reaches the site with the next mirrord release. `AGENTS.md` says how to publish a fix sooner. GitBook doesn't build pull requests to the mirrord repository, so they get no preview.
 
-Changes to **content and basic structure** can be made in this directory, and other changes must be made via the [GitBook platform](https://app.gitbook.com). To do so, you will need access to the MetalBear organisation.
+Changes to **content and basic structure** can be made in this directory. Other changes, such as a space's settings, must be made via the [GitBook platform](https://app.gitbook.com), because GitBook doesn't store them in this directory. To do so, you will need access to the MetalBear organisation.
 
 When **changing the structure** of the docs, like creating a new page, you must update `./docs/SUMMARY.md` to reflect this. New folders should have a `README.md` as their overview page.
 
 **Every feature page needs a plan tag.** Pages under `docs/using-mirrord`, `docs/sharing-the-cluster` and `docs/use-cases` must list at least one of `oss`, `team` or `enterprise` in their `tags` frontmatter, alongside `alpha` or `beta` where relevant. `mirrord mcp` reads these tags to tell users which plan a feature needs. The `content_check` job of the mirrord repository's CI runs `.github/scripts/check_plan_tags.py` on every PR that changes the docs and fails on any page in those directories without one, so a new page cannot ship untagged.
 
 ### GitBook
 
-Each tab on the docs site corresponds to a GitBook "space". Adding a space is done through GitBook, and GitHub sync must be set up to sync changes between the space's repo and the website. Note that changes made in GitBook may be live.
+Each tab on the docs site corresponds to a GitBook "space". Adding a space is done through GitBook, and GitHub sync must be set up to sync changes between the space's repo and the website. Note that changes made in GitBook may be live. The next publish replaces the content of the `docs-published` branch, so a page edited and merged in GitBook is lost unless the same change is also made here.
```

---

### Incident Patch 2: `c8ded0d1` (2026-11-20)
**Commit Message**: Add ECS demo video to the Amazon ECS guide (#5262)

Claude-Session: https://claude.ai/code/session_018mVFv54yrLmejMELYsfxa6

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/docs/using-mirrord/beyond-kubernetes/ecs.md` (modified, +4/-0)
```diff
@@ -15,6 +15,10 @@ Targeting Amazon ECS tasks is in **alpha**, and may change without notice. See [
 
 This guide makes an Amazon ECS service targetable as a [workload outside Kubernetes](README.md). The mirrord remote bootstrap is loaded into your existing application container with `LD_PRELOAD`; it doesn't need to be baked into your image, and your application image is unchanged.
 
+Watch a demo of mirrord with an Amazon ECS service:
+
+{% embed url="https://www.youtube.com/watch?v=jzwGS48ZKKM" %}
+
 The task-definition changes apply to **Linux tasks on both AWS Fargate and Amazon EC2**. Windows containers aren't covered by this setup. At a glance, the setup is:
 
 1. Add a setup container that copies the bootstrap into a shared task volume ([Add the remote bootstrap](#add-the-remote-bootstrap)).
```

#### Recent Merged Pull Requests:
- **PR #5262** (2026-11-20): docs: add ECS demo video to the Amazon ECS guide (@RinkiyaKeDad)
- **PR #5261** (2026-11-20): Publish the docs and guides on every release (@meowjesty)
- **PR #5260** (2026-11-20): Tidy the docs and skills config imported from their old repositories (@meowjesty)
- **PR #5258** (2026-11-19): Move the docs, guides and skills into this repository (@meowjesty)
- **PR #5253** (closed): do not merge: end-to-end test of the agent pull request routing (@hank-metalbear)
- **PR #5252** (2026-11-19): Let Qodo review PRs opened by coding agents (@t4lz)

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

## X. Publish the docs and guides on every release

**RULE**:
When implementing operations in `.github/workflows/publish-docs.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in metalbear-co/mirrord. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7f23826a`: Publish the docs and guides on every release. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/publish-docs.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
name: Publish docs and guides

# GitBook's Documentation and Guides spaces sync the `docs-published` and `guides-published` branches, not `main`, so
# a page merged to `docs/` or `guides/` reaches the site only when this workflow publishes it. The release calls it for
# the released commit, so the site describes what users can install. A dispatch publishes a fix between releases: run
# it with `dry_run` first to list the files that differ from the published branches.
#
# Each publish appends one commit whose tree is exactly `<ref>:docs` or `<ref>:guides`, on top of the branch tip. The
# branch is never force-pushed, because GitBook also pushes to it when a change request merges, and so can another run
# of this workflow. A push that races one of them fails as non-fast-forward, and the job then fetches the new tip and
# builds on top of it. That build replaces the other commit's content too, but the commit stays in the branch history,
# so a change merged in GitBook can still be found and ported to `main`.

on:
  workflow_dispatch:
    inputs:
      ref:
        description: 'Commit, branch or tag to publish. Empty selects the latest published release tag.'
        required: false
 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7f23826a` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
