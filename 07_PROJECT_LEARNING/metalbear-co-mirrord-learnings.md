# Forensic Learning Record (Deep Inspection): metalbear-co/mirrord

> **Canonical Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:24.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `metalbear-co/mirrord`
- **Description**: Run any process, on your machine or in an AI agent's environment, as if it were a pod in your Kubernetes cluster: real env vars, DNS, network, traffic.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 5353 stars

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
use tokio::{
    io::AsyncWrite,
    sync::{OwnedSemaphorePermit, Semaphore},
};
use tokio_util::sync::PollSemaphore;

/// Shared store for permits that can be used to throttle data [`Stream`]s and [`Sink`]s.
///
/// Should be used when proxying data to/from the client.
/// See [`ThrottledStream`]/[`ThrottledSink`].
///
/// An instance can be cloned and shared.
/// Clones use the same permit pool.
#[derive(Debug, Clone)]
pub struct Throttle {
    max_permits: usize,
    sem: PollSemaphore,
}

impl Throttle {
    pub fn new(max_permits: usize) -> Self {
        Self {
            max_permits,
            sem: PollSemaphore::new(Arc::new(Semaphore::new(max_permits))),
        }
    }

    fn poll_acquire<D: IsClientData>(
        &mut self,
        data: &D,
        cx: &mut Context<'_>,
    ) -> Poll<Option<OwnedSemaphorePermit>> {
        let permits = data.size() + std::mem::size_of::<Bytes>();
        let permits = permits.min(self.max_permits);
        let permits = u32::try_from(permits).unwrap_or(u32::MAX);
        self.sem.poll_acquire_many(cx, permits)
    }
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
    permit: OwnedSemaphorePermit,
}

impl<D> Throttled<D> {
    /// Returns the client data and the permits acquired from the parent [`Throttle`] instance.
    ///
    /// Drop the permits after removing the data from memory.
    pub fn unpack(self) -> (D, OwnedSemaphorePermit) {
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
        std::task::ready!(self.as_mut().poll_flush_buffer_down_to(0, cx))?;
        self.project().writer.poll_shutdown(cx)
    }
}

#[cfg(test)]
mod test {
    use futures::SinkExt;
    use tokio::io::AsyncWrite;

    use super::*;

    /// Accepts at most a fixed number of bytes per
    /// [`AsyncWrite::poll_write`]/[`AsyncWrite::poll_write_vectored`] call, forcing the
    /// [`IoVecThrottledSink`] to handle partial writes.
    struct ShortWriter {
        max_per_write: usize,
        written: Vec<u8>,
    }

    impl AsyncWrite for ShortWriter {
        fn poll_write(
            self: Pin<&mut Self>,
            _: &mut Context<'_>,
            buf: &[u8],
        ) -> Poll<io::Result<usize>> {
            let this = self.get_mut();
            let accepted = buf.g
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

### Core Architecture Module: `mirrord/cli/src/queue_splitting.rs`
```
use std::collections::{BTreeSet, HashMap, HashSet};

use mirrord_config::{LayerConfig, feature::split_queues::QueueKind};
use mirrord_progress::{IdeAction, IdeMessage, NotificationLevel, Progress, utm_medium};
use strum::IntoEnumIterator;

use crate::CliResult;

/// Landing page for the queue splitting documentation.
const QUEUE_SPLITTING_DOCS: &str =
    "https://metalbear.com/mirrord/docs/sharing-the-cluster/queue-splitting";

/// Notification id, mapped to the `promptQueueSplitting` config entry in the vscode extension.
const QUEUE_SPLITTING_HINT_ID: &str = "queue_splitting_hint";

/// Detects queue kinds hinted at by the target's environment.
///
/// Tokens are matched case-insensitively as whole words in both env keys and values.
fn detect_queue_kinds(env: &HashMap<String, String>) -> BTreeSet<QueueKind> {
    QueueKind::iter()
        .filter(|kind| {
            let tokens: &[&str] = match kind {
                QueueKind::Sqs => &["sqs"],
                QueueKind::Kafka => &["kafka"],
                QueueKind::Rmq => &["rabbitmq", "rmq", "amqp"],
                QueueKind::GcpPubSub => &["pubsub"],
                QueueKind::RedisPubSub => &["redis"],
                QueueKind::AzureServiceBus => &["servicebus"],
                QueueKind::Temporal => &["temporal"],
                QueueKind::BullMq => &["bullmq"],
                QueueKind::Nats => &["nats", "jetstream"],
                // The detection nudge cannot tell JetStream apps from core
                // pub/sub apps by env alone; the JetStream tokens above
                // already cover the "uses NATS" suggestion.
                QueueKind::NatsPubSub => &[],
                QueueKind::Unknown => &[],
            };

            tokens.iter().any(|token| {
                env.iter().any(|(key, value)| {
                    contains_whole_word(key, token) || contains_whole_word(value, token)
                })
            })
        })
        .collect()
}

/// Whether `token` appears in `haystack` as a whole word, case-insensitively.
///
/// Words are maximal runs of ASCII alphanumerics.
fn contains_whole_word(haystack: &str, token: &str) -> bool {
    haystack
        .split(|c: char| !c.is_ascii_alphanumeric())
        .any(|word| word.eq_ignore_ascii_case(token))
}

/// Nudges the user toward queue splitting when the target uses any supported queues.
///
/// Does nothing when queue splitting is already configured or no supported queue is detected.
pub fn suggest_queue_splitting<P: Progress>(
    config: &LayerConfig,
    env: &HashMap<String, String>,
    uses_operator: bool,
    progress: &mut P,
) -> CliResult<()> {
    if config.feature.split_queues.is_set() {
        return Ok(());
    }

    let detected = detect_queue_kinds(env)
        .iter()
        .filter_map(|kind| match kind {
            QueueKind::Sqs => Some("Amazon SQS"),
            QueueKind::Kafka => Some("Kafka"),
            QueueKind::Rmq => Some("RabbitMQ"),
            QueueKind::GcpPubSub => Some("GCP Pub/Sub"),
            QueueKind::RedisPubSub => Some("Redis Pub/Sub"),
            QueueKind::AzureServiceBus => Some("Azure Service Bus"),
            QueueKind::Temporal => Some("Temporal"),
            QueueKind::BullMq => Some("BullMQ"),
            QueueKind::Nats => Some("NATS"),
            QueueKind::NatsPubSub => Some("NATS Pub/Sub"),
            QueueKind::Unknown => None,
        })
        .collect::<Vec<_>>();

    let Some((last, rest)) = detected.split_last() else {
        return Ok(());
    };

    let names = match rest {
        [] => last.to_string(),
        [single] => format!("{single} and {last}"),
        more => format!("{}, and {}", more.join(", "), last),
    };

    let (offer, cta) = if uses_operator {
        ("mirrord can split these queues", "Set it up")
    } else {
        (
            "With mirrord for Teams you can split these queues",
            "Learn more",
        )
    };

    let text = format!(
        "mirrord detected that your target uses {names}. {offer}, so your local run only receives \
the messages you filter for while your teammates keep getting theirs."
    );

    let mut actions = HashSet::new();

    actions.insert(IdeAction::Link {
        label: "Queue splitting docs".to_owned(),
        link: format!("{QUEUE_SPLITTING_DOCS}?utm_medium={}", utm_medium()),
    });

    progress.ide(serde_json::to_value(IdeMessage {
        id: QUEUE_SPLITTING_HINT_ID.to_owned(),
        level: NotificationLevel::Info,
        text: text.clone(),
        actions,
    })?);

    progress.add_to_print_buffer(&format!("\n\n{text}\n>> {cta}: {QUEUE_SPLITTING_DOCS}\n"));

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_word_matching() {
        assert!(contains_whole_word("KAFKA_BROKERS", "kafka"));
        assert!(contains_whole_word("sqs.us-east-1.amazonaws.com", "sqs"));
        assert!(contains_whole_word("my_sqs", "sqs"));
        assert!(contains_whole_word("SQS", "sqs"));
        assert!(!contains_whole_word("kafkaesque", "kafka"));
        assert!(!contains_whole_word("bullmq1337", "bullmq"));
        assert!(!contains_whole_word("abcsqsabc", "sqs"));
        assert!(!contains_whole_word("", "sqs"));
    }

    #[test]
    fn detects_from_keys_and_values() {
        let env = HashMap::from([
            (
                "KAFKA_BOOTSTRAP_SERVERS".to_owned(),
                "broker:9092".to_owned(),
            ),
            (
                "QUEUE_URL".to_owned(),
                "https://sqs.us-east-1.amazonaws.com/1/orders".to_owned(),
            ),
            ("DATABASE_URL".to_owned(), "postgres://db".to_owned()),
        ]);

        let detected = detect_queue_kinds(&env);

        assert_eq!(detected, BTreeSet::from([QueueKind::Sqs, QueueKind::Kafka]));
    }

    #[test]
    fn ignores_substring_false_positives() {
        let env = HashMap::from([(
            "DESCRIPTION".to_owned(),
            "a kafkaesque bureaucracy".to_owned(),
        )]);

        assert!(detect_queue_kinds(&env).is_empty());
    }
}

```

### Core Architecture Module: `mirrord/cli/src/queues.rs`
```
use std::time::Duration;

use k8s_openapi::jiff::Timestamp;
use kube::{Api, Resource};
use mirrord_config::{LayerConfig, config::ConfigContext};
use mirrord_operator::crd::{
    queue_split::{
        QueueSplit, QueueSplitFilter, QueueSplitQueue, QueueSplitTargetPod, QueueSplitTmpQueue,
    },
    session::SessionTarget,
};
use mirrord_progress::{Progress, ProgressTracker};
use prettytable::{Cell, Row, Table, format};
use strum::IntoEnumIterator;
use strum_macros::{Display, EnumIter};

use crate::{
    CliResult,
    config::{QueuesArgs, QueuesCommand},
    kube::{get_resource_if_defined, kube_client_from_layer_config, list_resource_if_defined},
};

/// Columns of the `mirrord queues` status table. Keeping them in one enum means
/// the header and every data row are built from the same list in same order.
#[derive(Display, EnumIter, Clone, Copy)]
enum Column {
    #[strum(serialize = "NAME")]
    Name,
    #[strum(serialize = "SESSION")]
    Session,
    #[strum(serialize = "USER")]
    User,
    #[strum(serialize = "NAMESPACE")]
    Namespace,
    #[strum(serialize = "TARGET")]
    Target,
    #[strum(serialize = "PHASE")]
    Phase,
    #[strum(serialize = "DURATION")]
    Duration,
    /// Only listed when `--temp-queues` is given, see [`Column::selected`].
    #[strum(serialize = "TEMP QUEUES")]
    TempQueues,
}

impl Column {
    /// Columns of the status table, in print order. The temporary queues are
    /// opt-in: their names are long and most users only care about them when
    /// tracing a resource they see in the broker back to its session.
    fn selected(temp_queues: bool) -> impl Iterator<Item = Self> {
        Self::iter().filter(move |column| temp_queues || !matches!(column, Self::TempQueues))
    }

    /// The cell value for this column for a given queue split.
    fn value(self, split: &QueueSplit) -> String {
        let spec = &split.spec;
        let status = split.status.as_ref();
        let phase = status.map(|s| s.phase.as_str()).unwrap_or("-");
        match self {
            Self::Name => split.meta().name.clone().unwrap_or_default(),
            Self::Session => spec.session.clone(),
            Self::User => spec.owner.to_string(),
            Self::Namespace => split.meta().namespace.clone().unwrap_or_default(),
            Self::Target => match &spec.target {
                SessionTarget::KubeResource(target) => {
                    format!("{}/{}", target.kind, target.name)
                }
                target @ SessionTarget::PodSet(_) => target.display_name().into_owned(),
            },
            Self::Phase => phase.to_owned(),
            Self::Duration => render_duration(split),
            Self::TempQueues => status
                .map(|s| s.tmp_queues.as_slice())
                .unwrap_or_default()
                .iter()
                .map(|tmp| short_name(&tmp.name))
                .collect::<Vec<_>>()
                .join("\n"),
        }
    }
}

/// How long the session has been running, derived from when the view object was
/// created. Falls back to `-` if the timestamp is missing.
fn render_duration(split: &QueueSplit) -> String {
    split
        .meta()
        .creation_timestamp
        .as_ref()
        .map(|created| {
            let secs = Timestamp::now().duration_since(created.0).as_secs().max(0) as u64;
            humantime::format_duration(Duration::from_secs(secs)).to_string()
        })
        .unwrap_or_else(|| "-".to_owned())
}

pub(crate) async fn queues_command(args: QueuesArgs) -> CliResult<()> {
    match &args.command {
        QueuesCommand::Status { .. } => status_command(args).await,
    }
}

async fn status_command(args: QueuesArgs) -> CliResult<()> {
    let QueuesCommand::Status {
        name,
        namespace,
        all_namespaces,
        temp_queues,
    } = &args.command;
    let name = name.clone();
    let namespace = namespace.clone();
    let all_namespaces = *all_namespaces;
    let temp_queues = *temp_queues;

    let mut progress = ProgressTracker::from_env("Queue Splitting Status");
    let mut fetch_progress = progress.subtask("fetching queue splits");

    let mut cfg_context = ConfigContext::default()
        .override_env_opt(LayerConfig::FILE_PATH_ENV, args.config_file)
        .override_env_opt("MIRRORD_TARGET_NAMESPACE", namespace);
    let layer_config = crate::util::resolve_layer_config(&mut cfg_context).await?;

    let client = kube_client_from_layer_config(&layer_config).await?;

    // A single split is fetched by name, so it must live in one namespace; `-A`
    // would have nowhere to look it up.
    if let Some(name) = name {
        if all_namespaces {
            progress.failure(Some(
                "Looking up a split by name needs a single namespace (-n or the default); -A only applies when listing",
            ));
            return Ok(());
        }

        let namespace = resolve_namespace(&layer_config, &client);
        let api: Api<QueueSplit> = Api::namespaced(client, &namespace);
        let split = get_resource_if_defined(&api, &name, &mut fetch_progress).await?;
        fetch_progress.success(None);

        let Some(split) = split else {
            progress.failure(Some(&format!(
                "No queue-splitting session named '{name}' in namespace '{namespace}'"
            )));
            return Ok(());
        };

        progress.success(None);
        print_detail(&split);
        return Ok(());
    }

    // We list a single namespace by default and only span every namespace when
    // `-A` is passed. A namespaced list still includes splits the primary
    // aggregates from other clusters for that namespace.
    let api: Api<QueueSplit> = if all_namespaces {
        Api::all(client)
    } else {
        let namespace = resolve_namespace(&layer_config, &client);
        Api::namespaced(client, &namespace)
    };
    let splits = list_resource_if_defined(&api, &mut fetch_progress)
        .await?
        .unwrap_or_default();
    fetch_progress.success(None);

    print_table(progress, &splits, temp_queues)
}

/// Namespace to query when not spanning all namespaces, first match wins:
/// - `target.namespace` from the mirrord config (set by the `-n` flag)
/// - kubeconfig default namespace
fn resolve_namespace(layer_config: &LayerConfig, client: &kube::Client) -> String {
    layer_config
        .target
        .namespace
        .clone()
        .unwrap_or_else(|| client.default_namespace().to_owned())
}

/// Prints the one-row-per-session summary table used when no name is given.
fn print_table(
    mut progress: ProgressTracker,
    splits: &[QueueSplit],
    temp_queues: bool,
) -> CliResult<()> {
    if splits.is_empty() {
        progress.success(Some("No active queue-splitting sessions found"));
        return Ok(());
    }

    let table = build_status_table(splits, temp_queues);

    progress.success(None);
    table.printstd();

    Ok(())
}

/// One row per session, with the columns [`Column::selected`] picks.
fn build_status_table(splits: &[QueueSplit], temp_queues: bool) -> Table {
    let mut table = Table::new();
    table.add_row(Row::new(
        Column::selected(temp_queues)
            .map(|c| Cell::new(&c.to_string()))
            .collect(),
    ));

    for split in splits {
        table.add_row(Row::new(
            Column::selected(temp_queues)
                .map(|c| Cell::new(&c.value(split)))
                .collect(),
        ));
    }

    table
}

/// Fields of the single-split summary block, in print order. The variant name
/// is the label (via `Display`), and `value` returns `None` for fields that are
/// absent (like `Message`) so they are skipped. Adding a line is one variant
/// plus one match arm.
#[derive(Display, EnumIter, Clone, Copy)]
enum DetailField {
    Session,
    Namespace,
    User,
    Target,
    Phase,
    Duration,
    Message,
}

impl DetailField {
    fn value(self, split: &QueueSplit) -> Option<String> {
        let spec = &split.spec;
        let status = split.status.as_ref();
        match self {
            Self::Session => Some(spec.session.clone()),
            Self::Namespace => Some(split.meta().namespace.clone().unwrap_or_else(dash)),
            Self::User => Some(split.spec.owner.to_string()),
            Self::Target => Some(render_target(&spec.target)),
            Self::Phase => Some(status.map(|s| s.phase.clone()).unwrap_or_else(dash)),
            Self::Duration => Some(render_duration(split)),
            Self::Message => status.and_then(|s| s.message.clone()),
        }
    }
}

/// Broker-specific fields of a requested filter, shown together in the table's
/// `DETAILS` cell as `key=value`. `id` and `type` are their own columns, so
/// only the parts that differ per broker live here. Adding one is one variant
/// plus one match arm.
#[derive(Display, EnumIter, Clone, Copy)]
#[strum(serialize_all = "lowercase")]
enum FilterDetail {
    Filter,
    Jq,
}

impl FilterDetail {
    fn value(self, filter: &QueueSplitFilter) -> Option<String> {
        match self {
            Self::Filter => filter.message_filter().map(|filter| filter.to_string()),
            Self::Jq => filter.jq_filter.clone(),
        }
    }
}

/// Broker-specific fields of a resolved queue, shown together in the table's
/// `DETAILS` cell. Each broker fills only the ones it has (SQS has `queue`,
/// Kafka has `topic`/`group`), so there are no empty columns.
#[derive(Display, EnumIter, Clone, Copy)]
#[strum(serialize_all = "lowercase")]
enum QueueDetail {
    Queue,
    Topic,
    Group,
    Subscription,
}

impl QueueDetail {
    fn value(self, queue: &QueueSplitQueue) -> Option<String> {
        match self {
            Self::Queue => queue.queue.clone(),
            Self::Topic => queue.topic.clone(),
            Self::Group => queue.consumer_group.clone(),
            Self::Subscription => queue.subscription.clone(),
        }
    }
}

/// Fields of a temporary resource, shown together in the table's `DETA
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4762** (2026-08-25): **Teams trial onboarding uses incompatible `sudo sh` installer command**
  *Symptoms*: ### Bug Description  Hello! The teams trial onboarding uses a "sudo sh" installer command:  ```curl -fsSL https://raw.githubusercontent.com/metalbear-co/mirrord/main/scripts/install.sh | sudo sh```  This fails on Ubuntu 24.04 because /bin/sh resolves to Dash. I was able to get around this with:  ```curl -fsSL https://raw.githubusercontent.com/metalbear-co/mirrord/main/scripts/install.sh | bash```  I'd recommend updating the onboarding page to invoke Bash explicitly!  ### Steps to Reproduce  1. Sign up for a free trial here; https://app.metalbear.com/account/sign-up?_gl=1*1yvpoqp*_gcl_au*NTY3ODA4MzIuMTc4NzU2MTUyNg.. 2. Add your details 3. Verify Account 4. Follow the steps until you get to the point where you install the mirrord cli above. When selecting Linux this appears.  ### Backtrace  ```shell  ```  ### mirrord layer logs  ```shell  ```  ### mirrord intproxy logs  ```shell  ```  ### mirrord agent logs  ```shell  ```  ### mirrord config  ```json  ```  ### mirrord CLI version  mirrord 3.247.0  ### mirrord-agent version  _No response_  ### mirrord-operator version (if relevant)  _No response_  ### plugin kind and version (if relevant)  _No response_  ### Your operating system and version  Ubuntu 24.04  ### Local process  Install mirrord cli  ### Local process version  _No response_  ### Additional Info  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-2059">MBE-2059</a></p>

- **Issue #4672** (2026-09-02): **steal/mirror silently misses ClusterIP traffic on Cilium with BPF host routing (kube-proxy replacement)**
  *Symptoms*: # steal/mirror silently misses ClusterIP traffic on Cilium with BPF host routing (kube-proxy replacement)  ## Summary  With Cilium as kube-proxy replacement and BPF host routing (the default, `enable-host-legacy-routing` unset), the agent starts fine and reports `agent ready`, but **traffic that reaches the target pod through a Service ClusterIP is never stolen** — it is served by the original container. Traffic that reaches the same pod through its **pod IP** (e.g. `kubectl port-forward`) *is* stolen correctly.  There is no error, no warning and no timeout: the session looks completely healthy, which makes this very hard to notice. You just never see the requests you expect.  This contradicts the assumption in #2777 ("we don't know of any limitation ... mirrord works on a container level and doesn't touch or play with the kubeproxy rules"), which was closed without anyone reporting back measurements.  ## Environment  | | | | --- | --- | | mirrord | 3.244.1 (agent job mode, `agent.namespace: mirrord-agents`) | | client | mirrord VS Code extension on Windows (native), target `deployment/<app>` | | incoming mode | `steal` (same behaviour observed with `mirror`) | | Kubernetes | v1.36.2+k3s1 (single node) | | Cilium | v1.20.0-rc.0, `kube-proxy-replacement=true`, `routing-mode=tunnel`, `bpf-lb-sock=false`, `enable-host-legacy-routing` **unset** (= BPF host routing) | | Node | Debian 13 (trixie), kernel 6.12.95+deb13-arm64 |  ## How the two paths were told apart  The local process
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-2034">MBE-2034</a></p>
  > Hello @Raphael2b3! Thanks for the detailed write-up 🙏   We'll re-open the investigation on our side and try to reproduce the setup. If you do get to test the `bpf.hostLegacyRouting=true` workaround, please let us know. We'll be happy to document it in the meantime. 
  > Hey, i am happy to confirm, that the hostLegacyRouting=true workaround did work! 

- **Issue #4622** (2026-07-29): **Layer's internal-proxy socket can be allocated to fd 0, then broken when `libuv` sets `0_NONBLOCK` on `stdin`**
  *Symptoms*: ### Bug Description  On MacOS, if a process is `exec`'d with fd 0 closed, `ProxyConnection::new`'s `TcpStream::connect` is handed fd 0. The layer runs in the `dylib` constructor before runtime init, so fd 0 is the lowest free descriptor. The codec's `try_clone` dups it to fd 3.  Node then treats fd 0 as `stdin`. Once anything touches `process.stdin`, `libuv` wraps that fd and sets `0_NONBLOCK` on it. `0_NONBLOCK` lives on the open file description, so the dup on fd 3 is affected too - the layer's socket is now non-blocking on both fds.  The layer's next blocking read returns `EAGAIN`, which surfaces as:  ``` Proxy error, connectivity issue or a bug: io failed: Resource temporarily unavailable (os error 35). ```  `graceful_exit!` then SIGKILLs the process.  This needs a parent that closes fd 0 before `exec`, and a child that touches `stdin`.  ### Steps to Reproduce  `repro.js`:  ```js if (process.env.TOUCH_STDIN === "1") {   process.stdin.resume();   console.log("touched process.stdin"); } setTimeout(() => {   require("dns").lookup("example.com", () => { console.log("layer survived"); process.exit(0); }); }, 400); setTimeout(() => { console.log("timeout"); process.exit(2); }, 8000); ```  `exec 0<&-` closes fd 0 immediately before `exec`, which is what matters - closing `stdin` on the `mirrord` process itself doesn't seem to be enough.  ```bash #fails: exit 137, "os error 35" mirrord exec -f config.json -- sh -c 'exec 0<&- ; exec env TOUCH_STDIN=1 node repro.js'  #passes: exit 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-1990">MBE-1990</a></p>
  > Confirming this appears to be working as expected now with `experimental.guard_std_fds` 🙌 
  > > Confirming this appears to be working as expected now with `experimental.guard_std_fds` 🙌  Thanks for the update. We will shortly enable it by default :)

- **Issue #4354** (2026-07-06): **kubeconfig parsing issue with AWS_DEFAULT_OUTPUT=yaml**
  *Symptoms*: ### Bug Description  when AWS_DEFAULT_OUTPUT=yaml - running mirrord returns either > Failed resolving target while using the mirrord-operator: auth error: failed to parse auth exec output: expected value at line 1 column 1  or > EERROR mirrord::connection: error: Failed to create mirrord-agent: auth error: failed to parse auth exec output: expected value at line 1 column 1  (as long as kube/config's exec function doesn't have --output json)  ### Steps to Reproduce  make sure .kube/config's exec command doesn't contain "--output json" export AWS_DEFAULT_OUTPUT=yaml  run mirrord  ### Backtrace  ```shell  ```  ### mirrord layer logs  ```shell  ```  ### mirrord intproxy logs  ```shell  ```  ### mirrord agent logs  ```shell  ```  ### mirrord config  ```json  ```  ### mirrord CLI version  mirrord 3.216.0  ### mirrord-agent version  _No response_  ### mirrord-operator version (if relevant)  _No response_  ### plugin kind and version (if relevant)  _No response_  ### Your operating system and version  macos  ### Local process  bash  ### Local process version  _No response_  ### Additional Info  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-1934">MBE-1934</a></p>
  > Thanks for reporting! We'll send a PR upstream to fix it.
  > We will upgrade to kube rs once it's released so it'll be fixed.

- **Issue #4265** (2026-05-13): **io error: Address family not supported by protocol**
  *Symptoms*: ### Bug Description  Starting with release 3.205.0 I'm seeing the following error on MacOS: > `ERROR mirrord_agent::entrypoint: error: io error: Address family not supported by protocol (os error 97) at mirrord/agent/src/entrypoint.rs:866 on ThreadId(1)`  Several of my coworkers are seeing the same issue. I haven't checked whether people using Linux are having issues.  The last image that works is `3.204.1`. I've tested all versions up to and including `3.209.2`.  ### Steps to Reproduce  Run `mirrord exec --ephemeral-container --target deployment/D/container/C -- echo testing`  ### Backtrace  ```shell  ```  ### mirrord layer logs  ```shell  ```  ### mirrord intproxy logs  ```shell  ```  ### mirrord agent logs  ```shell 1: POD_NAME › AGENT_NAME 2: POD_NAME AGENT_NAME   2026-05-12T20:43:49.214255Z DEBUG mirrord_agent::entrypoint: main -> Initializing mirrord-agent, version 3.205.0. 3: POD_NAME AGENT_NAME     at mirrord/agent/src/entrypoint.rs:1251 on ThreadId(1) 4: POD_NAME AGENT_NAME 5: POD_NAME AGENT_NAME   2026-05-12T20:43:49.214523Z DEBUG mirrord_agent::entrypoint: start_iptable_guard -> Initializing iptable-guard. 6: POD_NAME AGENT_NAME     at mirrord/agent/src/entrypoint.rs:1143 on ThreadId(1) 7: POD_NAME AGENT_NAME 8: POD_NAME AGENT_NAME   2026-05-12T20:43:49.214588Z DEBUG mirrord_agent::entrypoint: new 9: POD_NAME AGENT_NAME     at mirrord/agent/src/entrypoint.rs:166 on ThreadId(1) 10: POD_NAME AGENT_NAME     in mirrord_agent::entrypoint::new with args: Args { mode: Eph
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-1748">MBE-1748</a></p>
  > @Phantal Hi, thanks for reporting this to us. I am almost sure this is because we now create a ipv6 agent connection listener unconditionally. Do you know if you have ipv6 disabled in the cluster? A few tests to run from a pod of your cluster: ```bash cat /proc/sys/net/ipv6/conf/all/disable_ipv6 cat /proc/sys/net/ipv6/conf/default/disable_ipv6 ```  1 means disabled, 0 means not.  Also `test -f /proc/net/if_inet6 && echo 'ipv6 proc present' || echo 'ipv6 proc not present'`.
  > @Phantal Hi, we have released a fix for this issue in 3.210.0. Can you try again and let us know if the latest release fixes the issue for you?

- **Issue #4231** (2026-05-19): **Install script produces an error message from curl**
  *Symptoms*: ### Bug Description  Running the install script in regular way produces a curl error: `curl: (23) Failure writing output to destination`  This seems to occur due to this line in the install script (1):      curl -fsSL https://github.com/metalbear-co/mirrord/raw/latest/Cargo.toml | grep -m 1 version | cut -d' ' -f3 | tr -d '\"'  When curl is piped into grep, grep is closing the pipe earlier than all response is written out.  Possible solutions to this could be a. piping additionally through cat, e.g. `curl ... | cat | grep ...` b. removing the `-S` ("show error") flag from curl command -- but this is potentially risking silencing other meaningful errors   ^1. https://github.com/metalbear-co/mirrord/blob/v3.174.0/scripts/install.sh#L20  ### Steps to Reproduce  1. Run the update script the regular way 2. Update completes successfully, `curl` error message is produced in the output.  ### Backtrace  ```shell Example from a recent update I run on my machine.   $ curl -fsSL https://raw.githubusercontent.com/metalbear-co/mirrord/main/scripts/install.sh | bash curl: (23) Failure writing output to destination, passed 1378 returned 1311 Installing version 3.207.0 mirrord installed! Have fun! For feedback and support, join our Slack: https://metalbear.co/slack , open an issue or discussion on our GitHub: https://github.com/metalbear-co/mirrord/ or send us an email at hi@metalbear.co ```  ### mirrord layer logs  ```shell  ```  ### mirrord intproxy logs  ```shell  ```  ### mirrord agent lo
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-1742/install-script-produces-an-error-message-from-curl">MBE-1742</a></p>
  > It's an intermittent issue, right? Only if curl fails unexpectadly? 
  > @aviramha I don't think so. It can be reproduced reliably, even when the command is run separately (just `curl ... | grep`.  From my understanding, this is inherent from how curl and grep treat pipe (see more details in my original message)

- **Issue #4225** (2026-04-30): **[Draft][Windows] mirrord agent started but cannot access service on k8s from local process**
  *Symptoms*: ### Bug Description  Env: Win10 with wsl enabled.  Scenario: java microservices debugging (vscode mirrord plugin) Version: 3.207.0 (agent)  When I started springcloud program with mirrord enabled, the process still cannot connect(timeout) to a clusterIP of another microservices (using nacos for service discovery).  What do you guys need to investigate this issue? I can't bring the project codes here due to company network constraints.   --- I'll upload some agent trace log when I'm available.   ### Steps to Reproduce  1. Have a spring cloud microservices on K8S with nacos as service discovery component. 2. Launch a service locally to replace the deployment of one microservices on K8S. 3. Let local process to make feign request to other microservices. -- then you will have local process hung there till timeout  ### Backtrace  ```shell  ```  ### mirrord layer logs  ```shell  ```  ### mirrord intproxy logs  ```shell  ```  ### mirrord agent logs  ```shell  ```  ### mirrord config  ```json  ```  ### mirrord CLI version  _No response_  ### mirrord-agent version  _No response_  ### mirrord-operator version (if relevant)  _No response_  ### plugin kind and version (if relevant)  VSCode, 3.69.4  ### Your operating system and version  Windows 10 professional 22H2  ### Local process  Java?  ### Local process version  _No response_  ### Additional Info  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-1741/draftwindows-mirrord-agent-started-but-cannot-access-service-on-k8s">MBE-1741</a></p>
  > Incoming mode steal or mirror, behave the same way, which is not receiving traffic at all. The request was forwarded by the  gateway not by mirrord. 
  > Mirrord can't acquire local process PID on windows, causing mirror agents hung after local process exited.

- **Issue #4187** (2026-04-20): **PyCharm plugin v3.72.0 fails to run**
  *Symptoms*: ### Bug Description  On process start I'm getting following errors:  ERROR: ld.so: object '/tmp/mirrord/7472081276785238198-libmirrord_layer.toml' from LD_PRELOAD cannot be preloaded (invalid ELF header): ignored. ERROR: ld.so: object '/tmp/mirrord/7472081276785238198-libmirrord_layer.toml' from LD_PRELOAD cannot be preloaded (invalid ELF header): ignored.  and then my code fails to resolve in-cluster dns names.  Previous version worked ok  ### Steps to Reproduce  1. run the script with plugin enabled  ### Backtrace  ```shell  ```  ### mirrord layer logs  ```shell  ```  ### mirrord intproxy logs  ```shell  ```  ### mirrord agent logs  ```shell  ```  ### mirrord config  ```json  ```  ### mirrord CLI version  _No response_  ### mirrord-agent version  _No response_  ### mirrord-operator version (if relevant)  _No response_  ### plugin kind and version (if relevant)  _No response_  ### Your operating system and version  Ubuntu Linux 25.10  ### Local process  python  ### Local process version  _No response_  ### Additional Info  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/metalbear/issue/MBE-1735/3720-fails-to-run">MBE-1735</a></p>
  > The issue seems to be with the binaries released yesterday, 3.203.0 and 3.202.0 seem to be broken and mirrord always gets the latest binary.  I was able to workaround this by pinning the binary version on VS Code to 3.201.0  mirrord binary version can be pinned by updating settings.json with this:  On VS Code: CTRL + P/ Command + P -> Open User Settings(Json)  {   "mirrord.autoUpdate": "3.201.0" }  https://metalbear.com/mirrord/docs/getting-started/installing-mirrord/vscode#managing-the-mirrord-binary
  > downgrading to 3.71.4 didn't help. might be some config corruption?

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

### Incident Patch 1: `230864bd` (2026-09-30)
**Commit Message**: Merge pull request #4980 from metalbear-co/meowchinist/cor-1923-ensure-mirrord-ui-daemon-process-only-if-db-branching-is

COR-1923: start the UI daemon only for DB branching and detach it from Ctrl+C

**File**: `AGENTS.md` (modified, +5/-0)
```diff
@@ -68,6 +68,11 @@ mirrord is actively maintained by dozens of people, it is not a greenfield proje
 maximize simplicity. Reuse existing abstractions and codepaths instead of introducing new ones. Every new path is
 something someone has to understand, maintain, and keep compatible.
 
+Avoid extracting trivial, self-contained logic into a function used only once. Keep it near its point of use when the
+helper would merely add indirection or exist to make a tiny test possible. Extract a function when it is reused or hides
+non-obvious details that would distract from the surrounding flow. Test meaningful behavior rather than trivial
+wrappers around a library API.
+
 ## Comments and Documentation
 
 Don't write comments explaining what code does, the code should speak for itself. Instead, focus on _why_ something
```

**File**: `changelog.d/+ui-daemon-branch-startup.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Start the local UI daemon for DB branch port forwarding only when needed, and keep it running when the process that started it receives Ctrl+C.
```

**File**: `mirrord/cli/src/internal_proxy.rs` (modified, +3/-6)
```diff
@@ -385,14 +385,11 @@ pub(crate) async fn proxy(
         needs_db_portforwards,
     )
     .await;
-    let daemon = crate::ui::ensure_daemon().await;
-    if let Err(error) = &daemon {
-        tracing::warn!(%error, "failed to start the local mirrord daemon");
-    }
-
     if needs_db_portforwards
         && let Some(session_id) = operator_session_id
-        && let Ok(daemon) = daemon
+        && let Ok(daemon) = crate::ui::ensure_daemon().await.inspect_err(|error| {
+            tracing::warn!(%error, "failed to start the local mirrord daemon");
+        })
         && let Err(err) = db_portforwards::setup(
             &config,
             &mut agent_conn,
```

**File**: `mirrord/cli/src/ui/daemon.rs` (modified, +9/-5)
```diff
@@ -38,6 +38,7 @@ use serde::{Deserialize, Serialize};
 use tokio::{
     fs::create_dir_all,
     io::{AsyncBufReadExt, BufReader},
+    process::Command,
     sync::{Mutex, broadcast},
 };
 use tokio_util::sync::CancellationToken;
@@ -321,14 +322,17 @@ pub(super) async fn ui_start(
         env_vars.insert("MIRRORD_LOG".to_owned(), "mirrord=debug".to_owned());
     }
 
-    let mut child = tokio::process::Command::new(mirrord_binary)
-        .args(vec!["ui"])
+    let mut command = Command::new(mirrord_binary);
+    command
+        .arg("ui")
         .envs(env_vars)
         .stdin(Stdio::null())
         .stdout(Stdio::piped())
-        .stderr(File::create(&std_err_file)?)
-        .kill_on_drop(false)
-        .spawn()?;
+        .stderr(File::create(&std_err_file)?);
+    // The daemon must survive terminal signals sent to the foreground command's process group.
+    #[cfg(unix)]
+    command.process_group(0);
+    let mut child = command.spawn()?;
 
     let mut stdout = BufReader::new(child.stdout.take().expect("was piped")).lines();
 
```

---

### Incident Patch 2: `42e045a3` (2026-09-30)
**Commit Message**: Use Vale-recognized wording in agent guidance

**File**: `AGENTS.md` (modified, +2/-2)
```diff
@@ -68,8 +68,8 @@ mirrord is actively maintained by dozens of people, it is not a greenfield proje
 maximize simplicity. Reuse existing abstractions and codepaths instead of introducing new ones. Every new path is
 something someone has to understand, maintain, and keep compatible.
 
-Avoid extracting trivial, self-contained logic into a function used only once. Keep it at the callsite when the helper
-would merely add indirection or exist to make a tiny test possible. Extract a function when it is reused or hides
+Avoid extracting trivial, self-contained logic into a function used only once. Keep it near its point of use when the
+helper would merely add indirection or exist to make a tiny test possible. Extract a function when it is reused or hides
 non-obvious details that would distract from the surrounding flow. Test meaningful behavior rather than trivial
 wrappers around a library API.
 
```

---

### Incident Patch 3: `2def6c44` (2026-09-30)
**Commit Message**: Merge branch 'main' into meowchinist/cor-1923-ensure-mirrord-ui-daemon-process-only-if-db-branching-is

**File**: `changelog.d/+session-list-json.added.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Added `mirrord session list --format json` so scripts can select sessions without parsing a table.
```

**File**: `mirrord/cli/src/config.rs` (modified, +12/-0)
```diff
@@ -2082,6 +2082,10 @@ impl Default for LocalSessionCommand {
 /// Arguments for listing local and in-cluster mirrord sessions.
 #[derive(Args, Debug, Default)]
 pub struct SessionListArgs {
+    /// Format output for terminal display or scripting.
+    #[arg(long, default_value_t)]
+    pub format: SessionListFormat,
+
     /// Only list sessions started with this `key`.
     ///
     /// `key` is the session identifier set via `mirrord exec --key`, `MIRRORD_KEY`, or the
@@ -2092,6 +2096,14 @@ pub struct SessionListArgs {
     pub key: Option<String>,
 }
 
+#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, ValueEnum, Display)]
+#[strum(serialize_all = "lowercase")]
+pub enum SessionListFormat {
+    #[default]
+    Pretty,
+    Json,
+}
+
 /// Arguments for deleting local mirrord sessions.
 #[derive(Args, Debug)]
 pub struct SessionDeleteArgs {
```

**File**: `mirrord/cli/src/session.rs` (modified, +66/-26)
```diff
@@ -16,12 +16,13 @@ use mirrord_session_monitor_client::{
 };
 use mirrord_session_monitor_protocol::{ProcessInfo, SessionInfo};
 use prettytable::{Table, row};
+use serde::Serialize;
 use tracing::Level;
 
 use crate::{
     config::{
         KillArgs, LocalSessionCommand, SessionArgs, SessionCommonArgs, SessionDeleteArgs,
-        SessionListArgs,
+        SessionListArgs, SessionListFormat,
     },
     error::CliError,
     util::remove_proxy_env,
@@ -35,6 +36,45 @@ struct MergedSessionRow {
     remote: Option<OperatorStatusSession>,
 }
 
+#[derive(Serialize)]
+struct JsonSessionRow<'a> {
+    session_id: &'a str,
+    process_id: Option<u32>,
+    key: Option<&'a str>,
+    target: Option<&'a str>,
+    namespace: Option<&'a str>,
+    user: Option<&'a str>,
+    process_name: Option<&'a str>,
+    command_line: Option<String>,
+    time_up: Option<String>,
+}
+
+impl<'a> From<&'a MergedSessionRow> for JsonSessionRow<'a> {
+    fn from(row: &'a MergedSessionRow) -> Self {
+        let process = row.local.as_ref().and_then(primary_process);
+
+        Self {
+            session_id: &row.session_id,
+            process_id: process.map(|process| process.pid),
+            key: row
+                .local
+                .as_ref()
+                .and_then(|session| session.key.as_deref())
+                .or_else(|| {
+                    row.remote
+                        .as_ref()
+                        .and_then(|session| session.key.as_deref())
+                }),
+            target: row.target_value(),
+            namespace: row.namespace_value(),
+            user: row.remote.as_ref().map(|session| session.user.as_str()),
+            process_name: process.map(|process| process.process_name.as_str()),
+            command_line: process.map(|process| format_cmdline(Some(process))),
+            time_up: row.time_up_value(),
+        }
+    }
+}
+
 enum RemoteKillResult {
     Killed,
     NotFound,
@@ -60,6 +100,12 @@ pub async fn kill_command(args: KillArgs) -> Result<(), CliError> {
 async fn list_command(common: &SessionCommonArgs, args: SessionListArgs) -> Result<(), CliError> {
     let (rows, operator_not_found) = merged_sessions(common, &args).await?;
 
+    if args.format == SessionListFormat::Json {
+        let rows: Vec<_> = rows.iter().map(JsonSessionRow::from).collect();
+        println!("{}", serde_json::to_string(&rows)?);
+        return Ok(());
+    }
+
     if operator_not_found {
         println!(
             "Operator not found, showing local sessions only. Get started with operator at app.metalbear.com/?utm_source=sessions-list&utm_medium=cli\n\
@@ -96,14 +142,14 @@ async fn list_command(common: &SessionCommonArgs, args: SessionListArgs) -> Resu
                 .as_ref()
                 .and_then(|session| session.key.as_deref())
                 .unwrap_or(NOT_AVAILABLE),
-            row.target(),
-            row.namespace(),
-            row.user(),
+            row.target_value().unwrap_or(NOT_AVAILABLE),
+            row.namespace_value().unwrap_or(NOT_AVAILABLE),
+            row.user_value().unwrap_or_else(|| NOT_AVAILABLE.to_owned()),
             process
                 .map(|process| process.process_name.as_str())
                 .unwrap_or(NOT_AVAILABLE),
             format_cmdline(process),
-            row.time_up()
+            row.time_up_value().unwrap_or_else(|| "unknown".to_owned())
         ]);
     }
 
@@ -537,14 +583,13 @@ fn format_cmdline(process: Option<&ProcessInfo>) -> String {
     }
 }
 
-fn format_uptime(started_at: &str) -> String {
+fn format_uptime(started_at: &str) -> Option<String> {
     humantime::parse_rfc3339_weak(started_at)
         .ok()
         .and_then(|started_at| SystemTime::now().duration_since(started_at).ok())
         .map(|duration| {
             humantime::format_duration(Duration::from_secs(duration.as_secs())).to_string()
         })
-        .unwrap_or_else(|| "unknown".to_owned())
 }
 
 impl MergedSessionRow {
@@ -555,15 +600,14 @@ impl MergedSessionRow {
             .unwrap_or_else(|| self.session_id.clone())
     }
 
-    fn target(&self) -> &str {
+    fn target_value(&self) -> Option<&str> {
         self.local
             .as_ref()
             .map(|session| session.target.as_str())
             .or_else(|| self.remote.as_ref().map(|session| session.target.as_str()))
-            .unwrap_or(NOT_AVAILABLE)
     }
 
-    fn namespace(&self) -> &str {
+    fn namespace_value(&self) -> Option<&str> {
         self.local
             .as_ref()
             .and_then(|session| session.namespace.as_deref())
@@ -572,27 +616,23 @@ impl MergedSessionRow {
                     .as_ref()
                     .and_then(|session| session.namespace.as_deref())
             })
-            .unwrap_or(NOT_AVAILABLE)
     }
 
-    fn user(&self) -> String {
+    fn user_value(&self) -> Option<String> {
         match (&self.local, &self.remote) {
-            (Some(_), Some(session)) => format!("You ({})", sess
```

---

### Incident Patch 4: `8a019b86` (2026-09-30)
**Commit Message**: Test UI daemon startup gate and document the fix

**File**: `changelog.d/+ui-daemon-branch-startup.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Start the local UI daemon for DB branch port forwarding only when needed, and keep it running when the process that started it receives Ctrl+C.
```

**File**: `mirrord/cli/src/internal_proxy.rs` (modified, +19/-3)
```diff
@@ -281,6 +281,13 @@ async fn start_session_monitor(
     (proxy_monitor_tx, ChaosWatcherRx::new(chaos_rx))
 }
 
+fn daemon_operator_session_id(
+    needs_db_portforwards: bool,
+    operator_session_id: Option<u64>,
+) -> Option<u64> {
+    operator_session_id.filter(|_| needs_db_portforwards)
+}
+
 /// Main entry point for the internal proxy.
 /// It listens for inbound layer connect and forwards to agent.
 #[tracing::instrument(level = Level::INFO, skip_all, err)]
@@ -385,8 +392,7 @@ pub(crate) async fn proxy(
         needs_db_portforwards,
     )
     .await;
-    if needs_db_portforwards
-        && let Some(session_id) = operator_session_id
+    if let Some(session_id) = daemon_operator_session_id(needs_db_portforwards, operator_session_id)
         && let Ok(daemon) = crate::ui::ensure_daemon().await.inspect_err(|error| {
             tracing::warn!(%error, "failed to start the local mirrord daemon");
         })
@@ -541,7 +547,17 @@ mod tests {
         process::Command,
     };
 
-    use super::{arm_ci_shutdown_watchdog, install_ci_shutdown_handler};
+    use super::{
+        arm_ci_shutdown_watchdog, daemon_operator_session_id, install_ci_shutdown_handler,
+    };
+
+    #[test]
+    fn daemon_starts_only_for_operator_backed_db_branches() {
+        assert_eq!(daemon_operator_session_id(false, None), None);
+        assert_eq!(daemon_operator_session_id(false, Some(1)), None);
+        assert_eq!(daemon_operator_session_id(true, None), None);
+        assert_eq!(daemon_operator_session_id(true, Some(1)), Some(1));
+    }
 
     /// The test runner must be a separate process because the watchdog's signal kills its owner.
     #[test]
```

---

### Incident Patch 5: `8d54282a` (2026-09-30)
**Commit Message**: Only start UI daemon for DB branching and isolate its process group

**File**: `mirrord/cli/src/internal_proxy.rs` (modified, +3/-6)
```diff
@@ -385,14 +385,11 @@ pub(crate) async fn proxy(
         needs_db_portforwards,
     )
     .await;
-    let daemon = crate::ui::ensure_daemon().await;
-    if let Err(error) = &daemon {
-        tracing::warn!(%error, "failed to start the local mirrord daemon");
-    }
-
     if needs_db_portforwards
         && let Some(session_id) = operator_session_id
-        && let Ok(daemon) = daemon
+        && let Ok(daemon) = crate::ui::ensure_daemon().await.inspect_err(|error| {
+            tracing::warn!(%error, "failed to start the local mirrord daemon");
+        })
         && let Err(err) = db_portforwards::setup(
             &config,
             &mut agent_conn,
```

**File**: `mirrord/cli/src/ui/daemon.rs` (modified, +104/-8)
```diff
@@ -38,6 +38,7 @@ use serde::{Deserialize, Serialize};
 use tokio::{
     fs::create_dir_all,
     io::{AsyncBufReadExt, BufReader},
+    process::{Child, Command},
     sync::{Mutex, broadcast},
 };
 use tokio_util::sync::CancellationToken;
@@ -282,6 +283,14 @@ pub(super) async fn ui_run_server(port: u16) -> Result<(), UiServerError> {
     }
 }
 
+/// The daemon must survive both its parent's exit and terminal signals sent to the parent's group.
+fn spawn_daemon(command: &mut Command) -> std::io::Result<Child> {
+    #[cfg(unix)]
+    command.process_group(0);
+
+    command.kill_on_drop(false).spawn()
+}
+
 /// Starts or reuses the local daemon and optionally opens its browser-facing UI.
 ///
 /// The foreground process spawns another mirrord executable with
@@ -321,14 +330,14 @@ pub(super) async fn ui_start(
         env_vars.insert("MIRRORD_LOG".to_owned(), "mirrord=debug".to_owned());
     }
 
-    let mut child = tokio::process::Command::new(mirrord_binary)
-        .args(vec!["ui"])
-        .envs(env_vars)
-        .stdin(Stdio::null())
-        .stdout(Stdio::piped())
-        .stderr(File::create(&std_err_file)?)
-        .kill_on_drop(false)
-        .spawn()?;
+    let mut child = spawn_daemon(
+        Command::new(mirrord_binary)
+            .args(["ui"])
+            .envs(env_vars)
+            .stdin(Stdio::null())
+            .stdout(Stdio::piped())
+            .stderr(File::create(&std_err_file)?),
+    )?;
 
     let mut stdout = BufReader::new(child.stdout.take().expect("was piped")).lines();
 
@@ -734,8 +743,95 @@ pub(super) fn router(state: AppState) -> Router<AppState> {
 
 #[cfg(test)]
 mod tests {
+    #[cfg(unix)]
+    use nix::{
+        sys::signal::killpg,
+        unistd::{getpgid, getpgrp},
+    };
+
     use super::*;
 
+    #[cfg(unix)]
+    #[tokio::test]
+    async fn daemon_has_its_own_process_group() {
+        let mut child = spawn_daemon(
+            Command::new("sleep")
+                .arg("30")
+                .stdin(Stdio::null())
+                .stdout(Stdio::null())
+                .stderr(Stdio::null()),
+        )
+        .unwrap();
+        let pid = Pid::from_raw(child.id().unwrap() as i32);
+        let group = getpgid(Some(pid));
+        // Reap the child before asserting so a failed assertion cannot leave it running.
+        child.kill().await.unwrap();
+        assert_eq!(group.unwrap(), pid);
+        assert_ne!(pid, getpgrp());
+    }
+
+    /// Isolate terminal-style signals from the test runner's own process group.
+    #[cfg(unix)]
+    #[tokio::test]
+    async fn daemon_signal_worker() {
+        if env::var_os("MIRRORD_DAEMON_SIGNAL_TEST_WORKER").is_none() {
+            return;
+        }
+
+        let mut interrupt =
+            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt()).unwrap();
+        let mut child = spawn_daemon(
+            Command::new("sleep")
+                .arg("30")
+                .stdin(Stdio::null())
+                .stdout(Stdio::null())
+                .stderr(Stdio::null()),
+        )
+        .unwrap();
+        println!("ready");
+        let received = tokio::time::timeout(Duration::from_secs(5), interrupt.recv()).await;
+        // Allow a child that inherited the foreground group to process the same interrupt.
+        tokio::time::sleep(Duration::from_millis(100)).await;
+        let status = child.try_wait().unwrap();
+        child.kill().await.unwrap();
+        assert!(received.unwrap().is_some());
+        assert!(status.is_none(), "daemon exited after foreground SIGINT");
+    }
+
+    #[cfg(unix)]
+    #[tokio::test]
+    async fn daemon_survives_foreground_group_interrupt() {
+        let mut worker = Command::new(env::current_exe().unwrap())
+            .args([
+                "--exact",
+                "ui::daemon::tests::daemon_signal_worker",
+                "--nocapture",
+            ])
+            .env("MIRRORD_DAEMON_SIGNAL_TEST_WORKER", "1")
+            .process_group(0)
+            .stdout(Stdio::piped())
+            .kill_on_drop(true)
+            .spawn()
+            .unwrap();
+        let mut stdout = BufReader::new(worker.stdout.take().unwrap()).lines();
+        tokio::time::timeout(Duration::from_secs(5), async {
+            loop {
+                let line = stdout.next_line().await.unwrap().expect("worker exited");
+                if line == "ready" {
+                    break;
+                }
+            }
+        })
+        .await
+        .expect("worker installs signal handler and starts daemon");
+        killpg(Pid::from_raw(worker.id().unwrap() as i32), Signal::SIGINT).unwrap();
+        let status = tokio::time::timeout(Duration::from_secs(10), worker.wait())
+            .await
+            .expect("worker cleans up daemon and exits")
+            .unwrap();
+        assert!(status.success());
+    }
+
     fn paths(dir: &tempfile::TempDir) -> (PathBuf, PathBuf, PathBuf) {
         (
             dir.path().join("
```

#### Recent Merged Pull Requests:
- **PR #5017** (2026-10-05): Release 3.270.0 (@cubby-mb[bot])
- **PR #5009** (2026-10-05): Release 3.269.0 (@cubby-mb[bot])
- **PR #5006** (2026-10-05): Adjust operator not found error message (@0x00A5)
- **PR #4999** (2026-10-02): nix: update lockfile (@iniw)
- **PR #4992** (2026-10-05): cli+analytics: report runs of `mirrord operator install` and `uninstall` (@iniw)
- **PR #4990** (2026-10-05): cli: add `mirrord operator uninstall` (@iniw)
- **PR #4989** (2026-10-05): cli: add a prompt and `--context` to `mirrord operator install` (@iniw)
- **PR #4988** (closed): cli, sip: prepare for Rosetta EOL on macOS 27 (@gememma)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
