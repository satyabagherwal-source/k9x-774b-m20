# Verification Protocol: Verification Protocol: Empirical Defect Shield for grpc-grpc-rust-learnings

<!-- PROVENANCE_START
{
  "source_repository": "grpc-grpc-rust-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T01:24:02.654Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-grpc-grpc-rust-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [grpc-grpc-rust-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T01:24:02.654Z`  
> **Learning ID**: `LEARN-EVO-grpc-grpc-rust-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `grpc-grpc-rust-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/grpc-grpc-rust-learnings.md`  
> **Source**: github ([https://github.com/grpc/grpc-rust](https://github.com/grpc/grpc-rust))  
> **Source Version**: `831ba3d9`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T01:23:45.712Z  
> **Learning ID**: `learn-github-grpc-grpc-rust`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): grpc/grpc-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/grpc-grpc-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/grpc/grpc-rust](https://github.com/grpc/grpc-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T01:23:45.701Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `grpc/grpc-rust`
- **Description**: A native gRPC client & server implementation with async/await support.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12558 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `grpc-benchmark/src/worker.rs`
```
/*
 *
 * Copyright 2026 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

use std::pin::Pin;
use std::result::Result;
use std::sync::Arc;
use std::thread::available_parallelism;

use tokio::sync::Notify;
use tokio_stream::Stream;
use tokio_stream::StreamExt;
use tonic::Request;
use tonic::Response;
use tonic::Status;
use tonic::Streaming;

use crate::client::BenchmarkClient;
use crate::generated::services::grpc::testing::ClientArgs;
use crate::generated::services::grpc::testing::ClientStatus;
use crate::generated::services::grpc::testing::CoreRequest;
use crate::generated::services::grpc::testing::CoreResponse;
use crate::generated::services::grpc::testing::ServerArgs;
use crate::generated::services::grpc::testing::ServerStatus;
use crate::generated::services::grpc::testing::Void;
use crate::generated::services::grpc::testing::client_args::Argtype as ClientArgType;
use crate::generated::services::grpc::testing::server_args::Argtype;
use crate::generated::services::grpc::testing::worker_service_server::WorkerService;
use crate::server::BenchmarkServer;

pub struct WorkerServer {
    quit_notify: Arc<Notify>,
}

impl WorkerServer {
    pub fn new(quit_notify: Arc<Notify>) -> Self {
        WorkerServer { quit_notify }
    }
}

fn core_count() -> Result<i32, Status> {
    let cores = available_parallelism()
        .map_err(|e| Status::internal(format!("failed to determine core count: {e}")))?
        .get() as i32;

    Ok(cores)
}

#[tonic::async_trait]
impl WorkerService for WorkerServer {
    // Server streaming response type for the RunServer method.
    type RunServerStream =
        Pin<Box<dyn Stream<Item = Result<ServerStatus, Status>> + Send + 'static>>;

    async fn run_server(
        &self,
        request: Request<Streaming<ServerArgs>>,
    ) -> Result<Response<Self::RunServerStream>, Status> {
        println!("Handling server stream.");
        let mut stream = request.into_inner();

        let output = async_stream::try_stream! {
            let mut benchmark_server: Option<BenchmarkServer> = None;

            while let Some(request) = stream.next().await {
                let request = request?;
                let mut reset_stats = false;

                let argtype = request.argtype
                    .ok_or_else(|| Status::invalid_argument("missing request.argtype"))?;

                match argtype {
                    Argtype::Setup(server_config) => {
                        println!("Server creation requested.");

                        if benchmark_server.is_some() {
                             Err(Status::already_exists("server already started"))?;
                        }

                        let server = BenchmarkServer::start(server_config).await.map_err(|status| {
                            println!("Error while creating server: {:?}", status);
                            status
                        })?;

                        benchmark_server = Some(server);
                    }
                    Argtype::Mark(mark) => {
                        println!("Server stats requested.");

                        benchmark_server.as_ref().ok_or_else(|| {
                            Status::invalid_argument("server does not exist when mark received")
                        })?;

                        reset_stats = mark.reset;
                    }
                };

                let server = benchmark_server.as_mut().unwrap();
                let stats = server.get_stats(reset_stats)?;

                yield ServerStatus {
                    stats: Some(stats),
                    cores: core_count()?,
                    port: server.port() as i32,
                };
            }
        };

        Ok(Response::new(Box::pin(output) as Self::RunServerStream))
    }

    type RunClientStream =
        Pin<Box<dyn Stream<Item = Result<ClientStatus, Status>> + Send + 'static>>;

    async fn run_client(
        &self,
        request: Request<Streaming<ClientArgs>>,
    ) -> Result<Response<Self::RunClientStream>, Status> {
        println!("Handling client stream.");
        let mut stream = request.into_inner();

        let output = async_stream::try_stream! {
            let mut benchmark_client: Option<BenchmarkClient> = None;
            while let Some(request) = stream.next().await {
                let request = request?;
                let mut reset_stats = false;
                let argtype = request.argtype
                    .ok_or(Status::invalid_argument("missing request.argtype"))?;
                match  argtype {
                    ClientArgType::Setup(client_config) => {
                        if benchmark_client.is_some() {
                             Err(Status::already_exists("client already started"))?;
                        }
                        match BenchmarkClient::start(client_config) {
                            Ok(client) => {
                                benchmark_client = Some(client);
                            },
                            Err(status) => {
                                println!("Error while creating client: {:?}", status);
                                Err(status)?;
                            }
                        }
                    },
                    ClientArgType::Mark(mark) => {
                        benchmark_client.as_ref()
                            .ok_or(Status::invalid_argument("client does not exist when mark received"))?;
                        reset_stats = mark.reset;
                    }
                };
                let stats = benchmark_client.as_mut().unwrap().get_stats(reset_stats).await?;
                yield ClientStatus {
                    stats: Some(stats),
                };
            }
        };

        Ok(Response::new(Box::pin(output) as Self::RunClientStream))
    }

    async fn core_count(
        &self,
        _request: Request<CoreRequest>,
    ) -> Result<Response<CoreResponse>, Status> {
        Ok(Response::new(CoreResponse {
            cores: core_count()?,
        }))
    }

    async fn quit_worker(&self, _request: Request<Void>) -> Result<Response<Void>, Status> {
        self.quit_notify.notify_one();
        Ok(Response::new(Void {}))
    }
}

```

### Core Architecture Module: `grpc-xds/src/dependency_manager/state.rs`
```
/*
 *
 * Copyright 2026 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! The cached state of each watched xDS resource or DNS target.

use std::sync::Arc;

use xds_client::ProcessingDone;
use xds_client::ResourceEvent;

/// The latest known state of one watched resource or DNS target.
///
/// Follows gRFC A88: a *resource error* (the resource itself is bad) drops
/// the cached value, while an *ambient error* (such as a broken stream) keeps
/// it and only adds a note.
///
/// `T` may be unsized so that DNS watches can hold `[EndpointAddress]`
/// (`Arc<[EndpointAddress]>`).
#[derive(Debug, PartialEq, Eq)]
pub(super) enum WatchState<T: ?Sized> {
    /// The watch has started but nothing has been received yet.
    Pending,
    /// A usable value. `note` holds the latest ambient error, if any; the next
    /// valid update clears it.
    Ready {
        value: Arc<T>,
        note: Option<Arc<str>>,
    },
    /// Nothing usable: the resource does not exist, is invalid, or an error
    /// arrived before the first valid value.
    Failed(Arc<str>),
}

// Manual `Clone` avoids `#[derive(Clone)]`'s `T: Clone` bound, which unsized
// values like `[EndpointAddress]` cannot satisfy even though `Arc<T>: Clone`.
impl<T: ?Sized> Clone for WatchState<T> {
    fn clone(&self) -> Self {
        match self {
            Self::Pending => Self::Pending,
            Self::Ready { value, note } => Self::Ready {
                value: Arc::clone(value),
                note: note.clone(),
            },
            Self::Failed(reason) => Self::Failed(Arc::clone(reason)),
        }
    }
}

impl<T: ?Sized> WatchState<T> {
    /// Applies an XdsClient event, and returns its flow-control token.
    ///
    /// `describe` turns the event's error into the reason or note to store.
    pub(super) fn apply(
        &mut self,
        event: ResourceEvent<T>,
        describe: impl FnOnce(xds_client::Error) -> Arc<str>,
    ) -> ProcessingDone
    where
        T: Sized,
    {
        match event {
            ResourceEvent::ResourceChanged { result, done } => {
                self.on_changed(result.map_err(describe));
                done
            }
            ResourceEvent::AmbientError { error, done } => {
                self.on_ambient_error(describe(error));
                done
            }
        }
    }

    /// Applies a `ResourceChanged` event. An `Err` discards any cached value.
    fn on_changed(&mut self, result: Result<Arc<T>, Arc<str>>) {
        *self = match result {
            Ok(value) => Self::Ready { value, note: None },
            Err(reason) => Self::Failed(reason),
        };
    }

    /// Applies an `AmbientError` event: attaches `reason` to the cached value
    /// as a note.
    ///
    /// The XdsClient sends ambient errors only once a value is cached, and
    /// otherwise sends a `ResourceChanged` error (gRFC A88). Any other ambient
    /// error is ignored, so that it can't hide the reason a watch failed.
    fn on_ambient_error(&mut self, reason: Arc<str>) {
        if let Self::Ready { note, .. } = self {
            *note = Some(reason);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
    enum Event {
        Changed(Result<u32, &'static str>),
        Ambient(&'static str),
    }

    fn ready(value: u32, note: Option<&str>) -> WatchState<u32> {
        WatchState::Ready {
            value: Arc::new(value),
            note: note.map(Arc::from),
        }
    }

    fn failed(reason: &str) -> WatchState<u32> {
        WatchState::Failed(reason.into())
    }

    #[test]
    fn events_follow_a88_transitions() {
        use Event::Ambient;
        use Event::Changed;
        use WatchState::Pending;

        for (start, event, expected) in [
            // A valid resource always replaces the state and clears the note.
            (Pending, Changed(Ok(2)), ready(2, None)),
            (ready(1, Some("old")), Changed(Ok(2)), ready(2, None)),
            (failed("old"), Changed(Ok(2)), ready(2, None)),
            // A resource error always discards the cached value.
            (Pending, Changed(Err("gone")), failed("gone")),
            (ready(1, None), Changed(Err("gone")), failed("gone")),
            (failed("old"), Changed(Err("gone")), failed("gone")),
            // An ambient error keeps a cached value and only replaces its note.
            (ready(1, None), Ambient("down"), ready(1, Some("down"))),
            (
                ready(1, Some("old")),
                Ambient("down"),
                ready(1, Some("down")),
            ),
            // Without a cached value, it's ignored, keeping the failure reason.
            (Pending, Ambient("down"), Pending),
            (failed("gone"), Ambient("down"), failed("gone")),
        ] {
            let mut state = start.clone();
            match &event {
                Changed(result) => state.on_changed((*result).map(Arc::new).map_err(Arc::from)),
                Ambient(reason) => state.on_ambient_error(Arc::from(*reason)),
            }
            assert_eq!(state, expected, "{start:?} after {event:?}");
        }
    }

    #[test]
    fn supports_unsized_slice_values() {
        let mut state: WatchState<[u32]> = WatchState::Pending;
        state.on_changed(Ok(Arc::from([1, 2])));
        state.on_ambient_error(Arc::from("stale"));

        let cloned = state.clone();
        assert_eq!(
            cloned,
            WatchState::Ready {
                value: Arc::from([1, 2]),
                note: Some(Arc::from("stale")),
            }
        );
    }
}

```

### Core Architecture Module: `grpc/src/client/metadata_utils.rs`
```
/*
 *
 * Copyright 2026 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! Interceptors providing client-side access to metadata.

use tokio::sync::oneshot;

use crate::client::CallOptions;
use crate::client::InvokeOnce;
use crate::client::RecvStream;
use crate::client::RequestHeaders;
use crate::client::interceptor::Intercept;
use crate::client::interceptor::InterceptOnce;
use crate::metadata::MetadataMap;

/// An interceptor that attaches metadata to outgoing RPC headers.
pub struct AttachHeadersInterceptor {
    md: MetadataMap,
}

impl AttachHeadersInterceptor {
    /// Creates a new interceptor that will attach `md` to the client's outgoing
    /// headers.
    pub fn new(md: MetadataMap) -> Self {
        Self { md }
    }
}

impl<I: InvokeOnce> Intercept<I> for AttachHeadersInterceptor {
    type SendStream = I::SendStream;
    type RecvStream = I::RecvStream;

    async fn intercept(
        &self,
        mut headers: RequestHeaders,
        options: CallOptions,
        next: I,
    ) -> (Self::SendStream, Self::RecvStream) {
        let incoming_meta = headers.metadata_mut();
        incoming_meta.reserve(self.md.len());
        for kv in self.md.iter() {
            match kv {
                crate::metadata::KeyAndValueRef::Ascii(key, value) => {
                    incoming_meta.append(key, value.clone());
                }
                crate::metadata::KeyAndValueRef::Binary(key, value) => {
                    incoming_meta.append_bin(key, value.clone());
                }
            }
        }
        next.invoke_once(headers, options).await
    }
}

/// An interceptor to read the metadata received in the server's headers.
pub struct CaptureHeadersInterceptor {
    tx: oneshot::Sender<MetadataMap>,
}

impl CaptureHeadersInterceptor {
    /// Creates an interceptor and a paired [`oneshot::Receiver`].  When the
    /// interceptor is attached to a call, the server headers' metadata is sent
    /// when it is available.  If the call completes without receiving headers
    /// (e.g. it times out or is a trailers-only response), the matching
    /// [`oneshot::Sender`] will be dropped and the `Receiver` will see an error
    /// instead.
    pub fn new() -> (Self, oneshot::Receiver<MetadataMap>) {
        let (tx, rx) = oneshot::channel();
        (Self { tx }, rx)
    }
}

impl<I: InvokeOnce> InterceptOnce<I> for CaptureHeadersInterceptor {
    type SendStream = I::SendStream;
    type RecvStream = CaptureHeadersRecvStream<I::RecvStream>;

    async fn intercept_once(
        self,
        headers: RequestHeaders,
        options: CallOptions,
        next: I,
    ) -> (Self::SendStream, Self::RecvStream) {
        let (tx, rx) = next.invoke_once(headers, options).await;
        (tx, CaptureHeadersRecvStream::new(rx, self.tx))
    }
}

/// The [`RecvStream`] portion of a [`CaptureHeadersInterceptor`].
pub struct CaptureHeadersRecvStream<R> {
    rx: R,
    tx: Option<oneshot::Sender<MetadataMap>>,
}

impl<R> CaptureHeadersRecvStream<R> {
    fn new(rx: R, tx: oneshot::Sender<MetadataMap>) -> Self {
        Self { rx, tx: Some(tx) }
    }
}

impl<R: RecvStream> RecvStream for CaptureHeadersRecvStream<R> {
    async fn recv(&mut self, msg: &mut dyn super::RecvMessage) -> super::ResponseStreamItem {
        let res = self.rx.recv(msg).await;
        if let super::ResponseStreamItem::Headers(headers) = &res
            && let Some(tx) = self.tx.take()
        {
            _ = tx.send(headers.metadata().clone());
        }
        res
    }
}

/// An interceptor to read the metadata received in the server's trailers.
pub struct CaptureTrailersInterceptor {
    tx: oneshot::Sender<MetadataMap>,
}

impl CaptureTrailersInterceptor {
    /// Creates an interceptor and a paired [`oneshot::Receiver`].  When the
    /// interceptor is attached to a call, the server trailers' metadata is sent
    /// when it is available.  If the call is terminated before trailers are
    /// received, the matching [`oneshot::Sender`] will be dropped, causing the
    /// `Receiver` to error.
    pub fn new() -> (Self, oneshot::Receiver<MetadataMap>) {
        let (tx, rx) = oneshot::channel();
        (Self { tx }, rx)
    }
}

impl<I: InvokeOnce> InterceptOnce<I> for CaptureTrailersInterceptor {
    type SendStream = I::SendStream;
    type RecvStream = CaptureTrailersRecvStream<I::RecvStream>;

    async fn intercept_once(
        self,
        headers: RequestHeaders,
        options: CallOptions,
        next: I,
    ) -> (Self::SendStream, Self::RecvStream) {
        let (tx, rx) = next.invoke_once(headers, options).await;
        (tx, CaptureTrailersRecvStream::new(rx, self.tx))
    }
}

/// The [`RecvStream`] portion of a [`CaptureTrailersInterceptor`].
pub struct CaptureTrailersRecvStream<R> {
    rx: R,
    tx: Option<oneshot::Sender<MetadataMap>>,
}

impl<R> CaptureTrailersRecvStream<R> {
    fn new(rx: R, tx: oneshot::Sender<MetadataMap>) -> Self {
        Self { rx, tx: Some(tx) }
    }
}

impl<R: RecvStream> RecvStream for CaptureTrailersRecvStream<R> {
    async fn recv(&mut self, msg: &mut dyn super::RecvMessage) -> super::ResponseStreamItem {
        let res = self.rx.recv(msg).await;
        if let super::ResponseStreamItem::Trailers(trailers) = &res
            && let Some(tx) = self.tx.take()
        {
            _ = tx.send(trailers.metadata().clone());
        }
        res
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::ResponseHeaders;
    use crate::client::ResponseStreamItem;
    use crate::client::Trailers;
    use crate::client::test_util::MockInvoker;
    use crate::client::test_util::NopRecvMessage;
    use crate::metadata::BinaryMetadataValue;

    #[tokio::test]
    async fn test_attach_headers_interceptor() {
        // Create test interceptor with metadata to attach.
        let mut md = MetadataMap::new();
        md.insert("x-test-header", "test-value".parse().unwrap());
        md.insert_bin(
            "x-test-header-bin",
            BinaryMetadataValue::from_bytes(b"test-bin"),
        );
        let interceptor = AttachHeadersInterceptor::new(md);

        // Call the interceptor with additional headers in place.
        let (invoker, _) = MockInvoker::new();
        let mut initial_headers = RequestHeaders::default();
        initial_headers
            .metadata_mut()
            .insert("x-initial-header", "initial".parse().unwrap());
        let _ = interceptor
            .intercept(initial_headers, CallOptions::default(), &invoker)
            .await;

        // Verify the received headers include all values.
        let final_headers = invoker.req_headers.lock().unwrap().take().unwrap();
        assert_eq!(
            final_headers.metadata().get("x-test-header").unwrap(),
            "test-value"
        );
        assert_eq!(
            final_headers
                .metadata()
                .get_bin("x-test-header-bin")
                .unwrap(),
            b"test-bin".as_slice()
        );
        assert_eq!(
            final_headers.metadata().get("x-initial-header").unwrap(),
            "initial"
        );
    }

    #[tokio::test]
    async fn test_capture_headers_interceptor() {
        // Create test interceptor.
        let (interceptor, rx) = CaptureHeadersInterceptor::new();

        // Start a call through the interceptor.
        let (invoker, mut controller) = MockInvoker::new();
        let (_, mut recv_stream) = interceptor
            .intercept_once(RequestHeaders::default(), CallOptions::default(), &invoker)
            .await;

        // Send a Headers response on the call.
        let mut resp_md = MetadataMap::new();
        resp_md.insert("x-resp-header", "resp-value".parse().unwrap());
        let mut headers = ResponseHeaders::new(crate::core::test_connection_info());
        *headers.metadata_mut() = resp_md;
        controller
            .send_resp(ResponseStreamItem::Headers(headers))
            .await;

        // Receive the sent Headers response.
        let res = recv_stream.recv(&mut NopRecvMessage).await;
        assert!(matches!(res, ResponseStreamItem::Headers(_)));

        // Verify the received headers are correct.
        let captured_md = rx.await.unwrap();
        assert_eq!(captured_md.get("x-resp-header").unwrap(), "resp-value");
    }

    #[tokio::test]
    async fn test_capture_trailers_interceptor() {
        // Create test interceptor.
        let (interceptor, rx) = CaptureTrailersInterceptor::new();

        // Start a call through the interceptor.
        let (invoker, mut controller) = MockInvoker::new();
        let (_, mut recv_stream) = interceptor
            .intercept_once(RequestHeaders::default(), CallOptions::default(), &invoker)
            .await;

        // Send a Trailers response on the call.
        let mut trailers_md = MetadataMap::new();
        trailers_md.insert("x-trailer", "trailer-value".parse().unwrap());
        let mut trail
```

### Core Architecture Module: `grpc/src/client/stream_util.rs`
```
/*
 *
 * Copyright 2026 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! Interceptors providing client-side stream validation.

use crate::StatusCodeError;
use crate::StatusError;
use crate::client::CallOptions;
use crate::client::InvokeOnce;
use crate::client::RecvStream;
use crate::client::RequestHeaders;
use crate::client::ResponseStreamItem;
use crate::client::SendOptions;
use crate::client::SendStream;
use crate::client::Trailers;
use crate::client::boxed::BoxRecvStream;
use crate::client::boxed::BoxSendStream;
use crate::client::interceptor::Intercept;
use crate::client::load_balancing::CallOutcome;
use crate::client::load_balancing::CompletionCallback;
use crate::core::ConnectionInfo;
use crate::core::RecvMessage;
use crate::core::SendMessage;
use crate::core::StreamEnded;

/// An interceptor that wraps the underlying invoker's [`RecvStream`] in a
/// [`RecvStreamValidator`].
#[derive(Clone)]
pub struct ResponseValidator {
    unary: bool,
}

impl ResponseValidator {
    /// Creates an instance of a `ResponseValidator` that simply wraps all
    /// invocations' [`RecvStream`s](InvokeOnce::RecvStream) in a
    /// [`RecvStreamValidator`] with `unary` propagated to it.
    pub fn new(unary: bool) -> Self {
        Self { unary }
    }
}

impl<I: InvokeOnce> Intercept<I> for ResponseValidator {
    type SendStream = I::SendStream;
    type RecvStream = RecvStreamValidator<I::RecvStream>;

    async fn intercept(
        &self,
        headers: RequestHeaders,
        options: CallOptions,
        next: I,
    ) -> (Self::SendStream, Self::RecvStream) {
        let (tx, rx) = next.invoke_once(headers, options).await;
        (tx, RecvStreamValidator::new(rx, self.unary))
    }
}

/// Wraps a client's [`RecvStream`] and performs protocol validation on it.
pub struct RecvStreamValidator<R> {
    recv_stream: R,
    state: RecvStreamState,
    unary: bool,
}

enum RecvStreamState {
    AwaitingHeaders,
    AwaitingMessagesOrTrailers,
    AwaitingTrailers,
    Done,
}

impl<R> RecvStreamValidator<R>
where
    R: RecvStream,
{
    /// Wraps `recv_stream` and performs protocol validation when it is
    /// accessed.
    ///
    /// If a protocol violation occurs, an error will be synthesized as
    /// [`Trailers`].  Any calls to the [`RecvStream::recv`] method beyond
    /// [`ResponseStreamItem::Trailers`] will not be propagated and will
    /// immediately return [`ResponseStreamItem::StreamClosed`].
    ///
    /// If `unary` is set, expects the server to send exactly one response
    /// message (after headers), or a trailers-only response.
    pub fn new(recv_stream: R, unary: bool) -> Self {
        Self {
            recv_stream,
            state: RecvStreamState::AwaitingHeaders,
            unary,
        }
    }

    /// Sets the state to Done and produces a synthesized trailer item
    /// containing the error message.
    fn error(&mut self, s: impl Into<String>) -> ResponseStreamItem {
        self.state = RecvStreamState::Done;
        ResponseStreamItem::Trailers(Trailers::new(Err(StatusError::new(
            StatusCodeError::Internal,
            s,
        ))))
    }
}

impl<R> RecvStream for RecvStreamValidator<R>
where
    R: RecvStream,
{
    async fn recv(&mut self, msg: &mut dyn RecvMessage) -> ResponseStreamItem {
        // Never call the underlying RecvStream if done.
        if matches!(self.state, RecvStreamState::Done) {
            return ResponseStreamItem::StreamClosed;
        }

        let item = self.recv_stream.recv(msg).await;

        match item {
            ResponseStreamItem::Headers(_) => {
                if matches!(self.state, RecvStreamState::AwaitingHeaders) {
                    self.state = RecvStreamState::AwaitingMessagesOrTrailers;
                    item
                } else {
                    self.error("stream received multiple headers")
                }
            }
            ResponseStreamItem::Message => {
                if matches!(self.state, RecvStreamState::AwaitingMessagesOrTrailers) {
                    if self.unary {
                        self.state = RecvStreamState::AwaitingTrailers;
                    }
                    item
                } else if matches!(self.state, RecvStreamState::AwaitingTrailers) {
                    self.error("unary stream received multiple messages")
                } else {
                    self.error("stream received messages without headers")
                }
            }
            ResponseStreamItem::Trailers(t) => {
                if self.unary
                    && !matches!(self.state, RecvStreamState::AwaitingTrailers)
                    && t.status().is_ok()
                {
                    return self.error("unary stream received zero messages");
                }
                // Always return a trailers result immediately - it is valid any
                // time but sets the stream's state to Done.
                self.state = RecvStreamState::Done;
                ResponseStreamItem::Trailers(t)
            }
            ResponseStreamItem::StreamClosed => {
                // Trailers were never received or we would be Done.
                self.error("stream ended without trailers")
            }
        }
    }
}

struct NopSendStream;

impl SendStream for NopSendStream {
    async fn send(
        &mut self,
        msg: &dyn SendMessage,
        options: SendOptions,
    ) -> Result<(), StreamEnded> {
        Err(StreamEnded)
    }
}

pub(crate) struct FailingRecvStream {
    status: Option<StatusError>,
    connection_info: Option<ConnectionInfo>,
}

impl RecvStream for FailingRecvStream {
    async fn recv(&mut self, msg: &mut dyn RecvMessage) -> ResponseStreamItem {
        match self.status.take() {
            Some(status) => ResponseStreamItem::Trailers(
                Trailers::new(Err(status)).with_connection_info(self.connection_info.take()),
            ),
            None => ResponseStreamItem::StreamClosed,
        }
    }
}

impl FailingRecvStream {
    pub(crate) fn new_stream_pair(
        status: StatusError,
        connection_info: Option<ConnectionInfo>,
    ) -> (BoxSendStream, BoxRecvStream) {
        (
            BoxSendStream::new(NopSendStream),
            BoxRecvStream::new(Self {
                status: Some(status),
                connection_info,
            }),
        )
    }
}

/// Wraps a client's [`RecvStream`] and invokes an LB policy's
/// [`CompletionCallback`] (from [`Pick::on_complete`]) exactly once when the
/// RPC completes.
///
/// The RPC is considered complete when trailers are received, in which case
/// the callback receives the trailers' status and metadata. If the stream is
/// closed without trailers, or dropped before completing (e.g. the RPC was
/// cancelled or abandoned by the application), the callback receives an error
/// status and no trailing metadata.
///
/// Note that an application that drops the stream after reading its last
/// message but before reading trailers is reported as `CANCELLED`, so LB
/// policies (e.g. for LRS load reports) count such RPCs as failed. This
/// matches gRPC C-core, where the call is likewise cancelled if the
/// application stops before receiving the status.
///
/// [`Pick::on_complete`]: crate::client::load_balancing::Pick::on_complete
pub(crate) struct CompletionRecvStream<R> {
    recv_stream: R,
    on_complete: Option<CompletionCallback>,
}

impl<R> CompletionRecvStream<R> {
    pub(crate) fn new(recv_stream: R, on_complete: CompletionCallback) -> Self {
        Self {
            recv_stream,
            on_complete: Some(on_complete),
        }
    }

    fn complete(&mut self, outcome: CallOutcome<'_>) {
        if let Some(on_complete) = self.on_complete.take() {
            on_complete(&outcome);
        }
    }

    fn complete_with_error(&mut self, code: StatusCodeError, message: &str) {
        if self.on_complete.is_some() {
            let status = Err(StatusError::new(code, message));
            self.complete(CallOutcome::new(&status));
        }
    }
}

impl<R> RecvStream for CompletionRecvStream<R>
where
    R: RecvStream,
{
    async fn recv(&mut self, msg: &mut dyn RecvMessage) -> ResponseStreamItem {
        let item = self.recv_stream.recv(msg).await;
        match &item {
            ResponseStreamItem::Trailers(trailers) => self.complete(
                CallOutcome::new(trailers.status()).with_trailing_metadata(trailers.metadata()),
            ),
            ResponseStreamItem::StreamClosed
            | ResponseStreamItem::Headers(_)
            | ResponseStreamItem::Message => {}
        }
        item
    }
}

impl<R> Drop for CompletionRecvStream<R> {
    fn drop(&mut self) {
        self.complete_with_error(
            StatusCodeError::Cancelled,
            "RPC abandoned before completion",
        );
    }
}

#[cfg(test)]
mod test {
    use std::mem::discriminant;
    use std::vec;

    use super::
```

### Core Architecture Module: `grpc/src/core/mod.rs`
```
/*
 *
 * Copyright 2026 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! Core gRPC types common to clients and servers.
//!
//! This module provides the fundamental types used in gRPC communication, such
//! as message traits.
//!
//! Most applications should not need to use these types directly, as they are
//! typically used by generated code.  However, they may be necessary when
//! implementing custom interceptors or advanced features.
//!
//! # Key Concepts
//!
//! - **[`SendMessage`] / [`RecvMessage`]:** Traits for encoding and decoding
//!   messages.
//! - **[`StreamEnded`]:** Returned when sending on a stream that has ended.
//! - **[`StreamError`]:** Returned when receiving on a server stream that
//!   terminated early.

use std::any::TypeId;
use std::fmt::Display;
use std::fmt::Formatter;
use std::fmt::Result as FmtResult;
use std::hash::Hash;

use bytes::Buf;

use crate::attributes::Attributes;
use crate::byte_str::ByteStr;
use crate::credentials::SecurityInfo;

/// Represents a message sent by either a client or a server.
#[allow(unused)]
pub trait SendMessage: Send + Sync {
    /// Encodes the message (`self`) as binary data.
    fn encode(&self) -> Result<Box<dyn Buf + Send + Sync>, String>;

    #[doc(hidden)]
    unsafe fn _ptr_for(&self, id: TypeId) -> Option<*const ()> {
        None
    }
}

/// Represents a message received by either a client or a server.
#[allow(unused)]
pub trait RecvMessage: Send + Sync {
    /// Encodes `data` into `self`.
    fn decode(&mut self, data: &mut dyn Buf) -> Result<(), String>;

    #[doc(hidden)]
    unsafe fn _ptr_for(&mut self, id: TypeId) -> Option<*mut ()> {
        None
    }
}

/// The error returned by stream send operations when the stream has ended.
///
/// This error carries no details.  On the client, the RPC's final status, which
/// explains why the stream ended, is reported separately on the
/// [`RecvStream`](crate::client::RecvStream).  On the server, the stream may
/// have been cancelled by the client, reached its deadline, or encountered an
/// I/O error.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub struct StreamEnded;

impl Display for StreamEnded {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        f.write_str("stream ended")
    }
}

impl std::error::Error for StreamEnded {}

/// The error returned by server stream receive operations when the RPC
/// terminated before the client closed its sending side of the stream.
///
/// This error carries no details.  Scenarios that could result in this error
/// include: the client cancelled the RPC, the deadline expired, an I/O error
/// occurred, or the server handler sent the trailers.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub struct StreamError;

impl Display for StreamError {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        f.write_str("stream terminated before client finished sending")
    }
}

impl std::error::Error for StreamError {}

/// Describes what underlying message is inside a [`SendMessage`] or
/// [`RecvMessage`] so that it can be downcast, e.g. by interceptors.
///
/// Allows for safe downcasting to views containing a lifetime.
pub trait MessageType {
    /// The message view's type, which may have a lifetime.
    type Target<'a>;
}

fn msg_type_id<T: MessageType>() -> TypeId
where
    T::Target<'static>: 'static,
{
    TypeId::of::<T::Target<'static>>()
}

impl dyn SendMessage + '_ {
    /// Downcasts the SendMessage to T::Target if the SendMessage contains a T.
    pub fn downcast_ref<T: MessageType>(&self) -> Option<&T::Target<'_>>
    where
        T::Target<'static>: 'static,
    {
        unsafe {
            if let Some(ptr) = self._ptr_for(msg_type_id::<T>()) {
                Some(&*(ptr as *mut T::Target<'_>))
            } else {
                None
            }
        }
    }
}

#[allow(unused)]
impl dyn RecvMessage + '_ {
    /// Downcasts the RecvMessage to T::Target if the RecvMessage contains a T.
    pub fn downcast_mut<T: MessageType>(&mut self) -> Option<&mut T::Target<'_>>
    where
        T::Target<'static>: 'static,
    {
        unsafe {
            if let Some(ptr) = self._ptr_for(msg_type_id::<T>()) {
                Some(&mut *(ptr as *mut T::Target<'_>))
            } else {
                None
            }
        }
    }
}

/// An Address is an identifier that indicates how to connect to a server.
#[non_exhaustive]
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Address {
    /// The network type is used to identify what kind of transport to create
    /// when connecting to this address.  Typically TCP_IP_ADDRESS_TYPE.
    pub network_type: &'static str,

    /// The address itself is passed to the transport in order to create a
    /// connection to it.
    pub address: ByteStr,

    /// Attributes contains arbitrary data about this address intended for
    /// consumption by the subchannel.
    pub attributes: Attributes,
}

impl Hash for Address {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.network_type.hash(state);
        self.address.hash(state);
    }
}

impl Display for Address {
    #[allow(clippy::to_string_in_format_args)]
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        write!(f, "{}:{}", self.network_type, self.address.to_string())
    }
}

/// Information about the connection to the RPC's peer (from the client/server
/// pair).
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    local_address: Address,
    remote_address: Address,
    security_info: SecurityInfo,
}

impl ConnectionInfo {
    /// Constructs a new instance with the given fields.
    pub fn new(
        local_address: Address,
        remote_address: Address,
        security_info: SecurityInfo,
    ) -> Self {
        Self {
            local_address,
            remote_address,
            security_info,
        }
    }

    /// Returns the connection's local address.
    pub fn local_address(&self) -> &Address {
        &self.local_address
    }

    /// Returns the peer's address.
    pub fn remote_address(&self) -> &Address {
        &self.remote_address
    }

    /// Returns the connection's security information (e.g. TLS parameters).
    pub fn security_info(&self) -> &SecurityInfo {
        &self.security_info
    }
}

#[cfg(test)]
pub(crate) fn test_connection_info() -> ConnectionInfo {
    ConnectionInfo {
        local_address: Address {
            network_type: "",
            address: ByteStr::default(),
            attributes: Attributes::new(),
        },
        remote_address: Address {
            network_type: "",
            address: ByteStr::default(),
            attributes: Attributes::new(),
        },
        security_info: SecurityInfo::new(""),
    }
}

```

### Core Architecture Module: `tonic-xds/src/client/loadbalance/channel_state.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! Type-state wrappers for endpoint channel lifecycle management.
//!
//! Each state is a separate struct, and transitions consume the old state (move semantics).
//! This prevents using a channel in an invalid state at compile time.
//!
//! ```text
//!                +-----------+
//!                |           |
//!                v           |
//! Idle --> Connecting --> Ready <--+--> Ejected
//!                ^                       |
//!                |                       |
//!                +-----------------------+
//! ```
//!
//! State changes are all one-shot. [`ConnectingChannel`] and [`EjectedChannel`] are
//! [`Future`]. The caller (typically a pool) uses [`KeyedFutures`] to
//! manage multiple in-flight state changes and handle cancellation by key.
//!
//! The state types hold the raw service `S` directly. In-flight tracking and
//! load reporting are the inner service's concern (see
//! [`EndpointChannel`](crate::client::endpoint::EndpointChannel)).
//!
//! [`KeyedFutures`]: crate::client::loadbalance::keyed_futures::KeyedFutures

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use pin_project_lite::pin_project;
use tower::Service;
use tower::load::Load;

use crate::client::endpoint::{Connector, EndpointAddress, XdsEndpoint};
use crate::client::loadbalance::outlier_detection::OutlierStatsRegistry;
use crate::common::async_util::BoxFuture;

// ---------------------------------------------------------------------------
// EndpointCounters / OutlierChannelState
// ---------------------------------------------------------------------------

/// Lock-free success/failure counter for one endpoint. Records RPC
/// outcomes from the data path; the outlier-detection actor reads and
/// resets between intervals.
#[derive(Debug, Default)]
pub(crate) struct EndpointCounters {
    success: AtomicU64,
    failure: AtomicU64,
}

impl EndpointCounters {
    pub(crate) fn record_success(&self) {
        self.success.fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn record_failure(&self) {
        self.failure.fetch_add(1, Ordering::Relaxed);
    }

    /// Read and zero both counters. The two swaps are not atomic against
    /// each other; bias from in-flight RPCs is bounded and well below
    /// the precision of the failure-percentage threshold.
    pub(crate) fn snapshot_and_reset(&self) -> (u64, u64) {
        let s = self.success.swap(0, Ordering::Relaxed);
        let f = self.failure.swap(0, Ordering::Relaxed);
        (s, f)
    }
}

/// Per-channel outlier-detection state, shared via `Arc` between the
/// data path (per-RPC outcome recording + threshold-based ejection)
/// and the housekeeping actor.
///
/// Ejection state is encoded in [`Self::ejected_at_nanos`]: zero means
/// not ejected, non-zero is the nanos-since-epoch of the ejection's
/// start. [`Self::try_eject`] / [`Self::try_uneject`] use CAS so callers
/// can update registry-level counters exactly once per transition.
#[derive(Debug)]
pub(crate) struct OutlierChannelState {
    addr: EndpointAddress,
    counters: EndpointCounters,
    /// Bumped on each ejection; decremented (saturating) on each
    /// healthy interval.
    ejection_multiplier: AtomicU32,
    /// `0` when not ejected; otherwise nanos since [`Self::epoch`] of
    /// the current ejection's start.
    ejected_at_nanos: AtomicU64,
    /// Origin for `ejected_at_nanos`. Set at construction.
    epoch: Instant,
}

impl OutlierChannelState {
    pub(crate) fn new(addr: EndpointAddress) -> Self {
        Self {
            addr,
            counters: EndpointCounters::default(),
            ejection_multiplier: AtomicU32::new(0),
            ejected_at_nanos: AtomicU64::new(0),
            epoch: Instant::now(),
        }
    }

    /// Endpoint address this state belongs to.
    pub(crate) fn addr(&self) -> &EndpointAddress {
        &self.addr
    }

    pub(crate) fn record_success(&self) {
        self.counters.record_success();
    }

    pub(crate) fn record_failure(&self) {
        self.counters.record_failure();
    }

    /// Per-RPC entry point. Bumps the success or failure counter
    /// depending on the RPC's outcome. Ejection decisions are deferred
    /// to the next sweep (gRFC A50 §6).
    pub(crate) fn record_outcome(&self, success: bool) {
        if success {
            self.record_success();
        } else {
            self.record_failure();
        }
    }

    /// Returns `(success, failure)` without resetting. The two reads
    /// are not atomic together; bias is bounded by in-flight RPCs.
    pub(crate) fn counters(&self) -> (u64, u64) {
        let s = self.counters.success.load(Ordering::Relaxed);
        let f = self.counters.failure.load(Ordering::Relaxed);
        (s, f)
    }

    /// Read and zero the counters. Returns `(success, failure)`.
    pub(crate) fn snapshot_and_reset(&self) -> (u64, u64) {
        self.counters.snapshot_and_reset()
    }

    /// Atomically mark this channel as ejected starting at `now`.
    /// Returns `true` on the not-ejected → ejected transition and
    /// bumps the multiplier; `false` if already ejected.
    pub(crate) fn try_eject(&self, now: Instant) -> bool {
        let nanos = now
            .saturating_duration_since(self.epoch)
            .as_nanos()
            .min(u64::MAX as u128) as u64;
        // 0 means "not ejected"; use 1 as a sentinel if the channel
        // was created at exactly `now`.
        let stamp = nanos.max(1);
        if self
            .ejected_at_nanos
            .compare_exchange(0, stamp, Ordering::AcqRel, Ordering::Relaxed)
            .is_err()
        {
            return false;
        }
        self.ejection_multiplier.fetch_add(1, Ordering::Relaxed);
        true
    }

    /// Atomically clear the ejection. Returns `true` on the
    /// ejected → not-ejected transition.
    pub(crate) fn try_uneject(&self) -> bool {
        self.ejected_at_nanos.swap(0, Ordering::AcqRel) != 0
    }

    /// Current ejection state.
    pub(crate) fn is_ejected(&self) -> bool {
        self.ejected_at_nanos.load(Ordering::Acquire) != 0
    }

    /// Returns the elapsed time since this channel was ejected, or
    /// `None` if it is not currently ejected.
    pub(crate) fn ejected_duration(&self, now: Instant) -> Option<Duration> {
        let nanos = self.ejected_at_nanos.load(Ordering::Relaxed);
        if nanos == 0 {
            return None;
        }
        let ejected_at = self.epoch + Duration::from_nanos(nanos);
        Some(now.saturating_duration_since(ejected_at))
    }

    /// Current ejection multiplier.
    pub(crate) fn ejection_multiplier(&self) -> u32 {
        self.ejection_multiplier.load(Ordering::Relaxed)
    }

    /// Decrement the multiplier, saturating at zero. Atomic against
    /// concurrent `try_eject` and other decrements.
    pub(crate) fn decrement_multiplier(&self) {
        // TODO: Switch to `try_update` and remove this allow once MSRV >= 1.95.
        #[allow(deprecated)]
        let _ = self
            .ejection_multiplier
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| {
                if v > 0 { Some(v - 1) } else { None }
            });
    }

    /// Clear the multiplier. Only meant for the sweep task, which is the sole
    /// writer that raises it, so the plain store can't lose an ejection.
    pub(crate) fn reset_multiplier(&self) {
        self.ejection_multiplier.store(0, Ordering::Relaxed);
    }

    /// Test-only multiplier setter for driving housekeeping without
    /// going through `try_eject`.
    #[cfg(test)]
    pub(crate) fn set_ejection_multiplier(&self, value: u32) {
        self.ejection_multiplier.store(value, Ordering::Relaxed);
    }
}

/// Configuration for an ejected channel.
#[derive(Debug, Clone)]
pub(crate) struct EjectionConfig {
    /// How long the channel is ejected before it can return to service.
    pub timeout: Duration,
    /// Whether the channel needs a fresh connection after ejection expires (e.g. after consecutive timeouts).
    pub needs_reconnect: bool,
}

/// Result of an ejection expiring.
pub(crate) enum UnejectedChannel<S> {
    /// Cooldown elapsed; the original connection is reused with its
    /// outlier state reattached.
    Ready(ReadyChannel<S>),
    /// A fresh connection has been started.
    Connecting(ConnectingChannel<S>),
}

// ---------------------------------------------------------------------------
// IdleChannel
// ---------------------------------------------------------------------------

/// An idle channel that only stores its endpoint. It is the entry point for
/// starting a connection attempt.
pub(crate) struct IdleChannel {
    endpoint: Arc<XdsEndpoint>,
}

impl IdleChannel {
    #[cfg(test)]
  
```

### Core Architecture Module: `tonic-xds/src/common/async_util.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! Utilities for async operations.

use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

use futures_core::Stream;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

/// A pinned, boxed, `Send` future.
///
/// This is the boxed future type surfaced by the public transport (connector)
/// and load-balancing service interfaces (e.g. [`Connector::connect`]).
///
/// [`Connector::connect`]: crate::Connector::connect
pub type BoxFuture<T> = Pin<Box<dyn Future<Output = T> + Send + 'static>>;

/// A [`tokio::task::JoinHandle`] wrapper that aborts the task when dropped.
pub(crate) struct AbortOnDrop(pub(crate) tokio::task::JoinHandle<()>);

impl Drop for AbortOnDrop {
    fn drop(&mut self) {
        self.0.abort();
    }
}

/// A stream fed by a spawned producer task that the stream owns.
///
/// Dropping the stream aborts the producer.
pub(crate) struct TaskStream<T> {
    rx: ReceiverStream<T>,
    _task: AbortOnDrop,
}

impl<T> TaskStream<T> {
    /// Spawns `producer` with the sending half of a channel of `capacity`
    /// and returns the stream of what it sends.
    pub(crate) fn spawn<P, F>(capacity: usize, producer: P) -> Self
    where
        P: FnOnce(mpsc::Sender<T>) -> F,
        F: Future<Output = ()> + Send + 'static,
    {
        let (tx, rx) = mpsc::channel(capacity);
        let task = tokio::spawn(producer(tx));
        Self {
            rx: ReceiverStream::new(rx),
            _task: AbortOnDrop(task),
        }
    }
}

impl<T> Stream for TaskStream<T> {
    type Item = T;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<T>> {
        Pin::new(&mut self.rx).poll_next(cx)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.rx.size_hint()
    }
}

```

### Core Architecture Module: `tonic/benches-disabled/benchmarks/utils.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};

pub fn generate_rnd_string(string_size: usize) -> Result<String, Box<dyn std::error::Error>> {
    let rand_name: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(string_size)
        .collect();

    Ok(rand_name)
}

```

### Core Architecture Module: `tonic/src/util.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! Various utilities used throughout tonic.

// some combinations of features might cause things here not to be used
#![allow(dead_code)]

pub(crate) mod base64 {
    use base64::{
        alphabet,
        engine::{
            DecodePaddingMode,
            general_purpose::{GeneralPurpose, GeneralPurposeConfig},
        },
    };

    pub(crate) const STANDARD: GeneralPurpose = GeneralPurpose::new(
        &alphabet::STANDARD,
        GeneralPurposeConfig::new()
            .with_encode_padding(true)
            .with_decode_padding_mode(DecodePaddingMode::Indifferent),
    );

    pub(crate) const STANDARD_NO_PAD: GeneralPurpose = GeneralPurpose::new(
        &alphabet::STANDARD,
        GeneralPurposeConfig::new()
            .with_encode_padding(false)
            .with_decode_padding_mode(DecodePaddingMode::Indifferent),
    );
}

```

### Core Architecture Module: `xds-client/src/client/worker.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

//! ADS worker that manages the xDS stream.
//!
//! The worker processes watcher and transport events serially. It owns resource
//! subscriptions, the cache, versions, and nonces, and dispatches
//! watcher notifications and ACK/NACK requests.
//!
//! A separate transport task owns retry state, connects, waits for backoff, and reads
//! and writes the ADS stream concurrently. Network waits and watcher processing
//! do not block the worker from registering watchers or replaying cached resources.

use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::sync::Arc;
use std::sync::atomic::AtomicU64;
use std::sync::atomic::Ordering;
use std::time::Duration;
use std::time::SystemTime;

use bytes::Bytes;
use tokio::sync::mpsc;
use tokio::sync::oneshot;

use crate::client::config::ClientConfig;
use crate::client::config::ServerConfig;
use crate::client::retry::Backoff;
use crate::client::retry::RetryPolicy;
use crate::client::snapshot::AcceptedResource;
use crate::client::snapshot::RejectedUpdate;
use crate::client::snapshot::ResourceSnapshot;
use crate::client::snapshot::ResourceStatus;
use crate::client::watch::ProcessingDone;
use crate::client::watch::ResourceEvent;
use crate::codec::XdsCodec;
use crate::error::Error;
use crate::error::Result;
use crate::message::DiscoveryRequest;
use crate::message::DiscoveryResponse;
use crate::message::ErrorDetail;
use crate::message::Node;
use crate::metrics::KeyValue;
use crate::metrics::MetricsRecorder;
use crate::metrics::{self};
use crate::resource::DecodedResource;
use crate::resource::DecoderFn;
use crate::runtime::Runtime;
use crate::transport::ADS_METHOD;
use crate::transport::Transport;
use crate::transport::TransportBuilder;
use crate::transport::TransportReceiver;
use crate::transport::TransportSender;

/// Per-client A78 metric attributes (`grpc.target` + `grpc.xds.server`).
///
/// Both values are stored as `Arc<str>` so each emission clones them as a
/// cheap atomic op (via the `StringValue::RefCounted` variant) instead of
/// allocating a new `String` per attribute slot.
struct ClientAttrs {
    target: Arc<str>,
    server: Arc<str>,
}

impl ClientAttrs {
    /// Sentinel `grpc.xds.authority` value used for the unnamed top-level
    /// (non-federated) authority.
    ///
    /// Matches grpc-go's top-level placeholder.
    ///
    /// TODO: once federated bootstrap support lands, derive the authority from
    /// the resource name (`xdstp://<authority>/...`) on a per-resource basis.
    const TOP_LEVEL_AUTHORITY: &'static str = "#old";

    fn connection_attrs(&self) -> [KeyValue; 2] {
        [
            KeyValue::str(metrics::attrs::GRPC_TARGET, Arc::clone(&self.target)),
            KeyValue::str(metrics::attrs::GRPC_XDS_SERVER, Arc::clone(&self.server)),
        ]
    }

    fn type_attrs(&self, type_url: &Arc<str>) -> [KeyValue; 3] {
        [
            KeyValue::str(metrics::attrs::GRPC_TARGET, Arc::clone(&self.target)),
            KeyValue::str(metrics::attrs::GRPC_XDS_SERVER, Arc::clone(&self.server)),
            KeyValue::str(metrics::attrs::GRPC_XDS_RESOURCE_TYPE, Arc::clone(type_url)),
        ]
    }

    fn cache_state_attrs(&self, type_url: &Arc<str>, cache_state: &'static str) -> [KeyValue; 4] {
        [
            KeyValue::str(metrics::attrs::GRPC_TARGET, Arc::clone(&self.target)),
            KeyValue::str(
                metrics::attrs::GRPC_XDS_AUTHORITY,
                Self::TOP_LEVEL_AUTHORITY,
            ),
            KeyValue::str(metrics::attrs::GRPC_XDS_RESOURCE_TYPE, Arc::clone(type_url)),
            KeyValue::str(metrics::attrs::GRPC_XDS_CACHE_STATE, cache_state),
        ]
    }
}

/// Worker-side wrapper around an optional [`MetricsRecorder`] backend.
pub(crate) struct RecorderHandle {
    recorder: Option<Arc<dyn MetricsRecorder>>,
    attrs: ClientAttrs,
    /// Last-emitted `grpc.xds_client.resources` gauge value per
    /// `resource_type -> cache_state`. Used to diff against the live
    /// cache snapshot so we only push buckets whose count changed; the cache in
    /// the worker remains the single source of truth.
    resource_counts: HashMap<Arc<str>, HashMap<&'static str, i64>>,
}

impl RecorderHandle {
    pub(crate) fn new(recorder: Option<Arc<dyn MetricsRecorder>>, target: Arc<str>) -> Self {
        Self {
            recorder,
            attrs: ClientAttrs {
                target,
                server: Arc::from(""),
            },
            resource_counts: HashMap::new(),
        }
    }

    /// Update the `grpc.xds.server` attribute for subsequent emissions.
    pub(crate) fn set_server(&mut self, server: Arc<str>) {
        self.attrs.server = server;
    }

    /// `grpc.xds_client.connected` — 1 for connected, 0 for disconnected.
    fn record_connected(&self, connected: bool) {
        let Some(recorder) = &self.recorder else {
            return;
        };
        recorder.record_gauge_i64(
            &metrics::instruments::XDS_CLIENT_CONNECTED,
            if connected { 1 } else { 0 },
            &self.attrs.connection_attrs(),
        );
    }

    /// `grpc.xds_client.server_failure` — incremented once per failed connection cycle.
    fn record_server_failure(&self) {
        let Some(recorder) = &self.recorder else {
            return;
        };
        recorder.add_counter_u64(
            &metrics::instruments::XDS_CLIENT_SERVER_FAILURE,
            1,
            &self.attrs.connection_attrs(),
        );
    }

    /// `grpc.xds_client.resource_updates_valid` + `_invalid`, with aggregated
    /// counts from a single response.
    fn record_resource_updates(&self, type_url: &Arc<str>, valid: u64, invalid: u64) {
        let Some(recorder) = &self.recorder else {
            return;
        };
        if valid == 0 && invalid == 0 {
            return;
        }
        let type_attrs = self.attrs.type_attrs(type_url);
        if valid > 0 {
            recorder.add_counter_u64(
                &metrics::instruments::XDS_CLIENT_RESOURCE_UPDATES_VALID,
                valid,
                &type_attrs,
            );
        }
        if invalid > 0 {
            recorder.add_counter_u64(
                &metrics::instruments::XDS_CLIENT_RESOURCE_UPDATES_INVALID,
                invalid,
                &type_attrs,
            );
        }
    }

    /// Reconcile the `grpc.xds_client.resources` gauge for `type_url` against an
    /// authoritative cache snapshot (`cache_state` label -> current count).
    ///
    /// The worker's resource cache is the single source of truth; this only
    /// diffs the snapshot against the values last emitted for `type_url` and
    /// pushes the buckets that changed. Buckets that dropped out of the snapshot
    /// are pushed as `0`, because a push gauge would otherwise retain a stale
    /// non-zero reading for a bucket that has emptied. Idempotent: calling it
    /// with an unchanged snapshot emits nothing.
    fn sync_resource_counts(&mut self, type_url: &Arc<str>, counts: &HashMap<&'static str, i64>) {
        let Some(recorder) = &self.recorder else {
            return;
        };
        let last = self
            .resource_counts
            .entry(Arc::clone(type_url))
            .or_default();

        // New or changed buckets.
        for (&state, &count) in counts {
            if last.get(&state) != Some(&count) {
                recorder.record_gauge_i64(
                    &metrics::instruments::XDS_CLIENT_RESOURCES,
                    count,
                    &self.attrs.cache_state_attrs(type_url, state),
                );
            }
        }
        // Buckets that emptied since the last snapshot — reset to 0.
        for &state in last.keys() {
            if !counts.contains_key(&state) {
                recorder.record_gauge_i64(
                    &metrics::instruments::XDS_CLIENT_RESOURCES,
                    0,
                    &self.attrs.cache_state_attrs(type_url, state),
                );
            }
        }

        *last = counts.clone();
    }
}

/// Global counter for generating unique watcher IDs.
static NEXT_WATCHER_ID: AtomicU64 = AtomicU64::new(1);

/// Unique identifier for a watcher.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct WatcherId(u64);

impl WatcherId {
    /// Create a new unique watcher ID.
    pub fn new() -> Self {
        Self(NEXT_WATCHER_ID.fetch_add(1, Ordering::Relaxed))
    }
}

impl Default for WatcherId {
    fn default() -> Self {
        Self::new()
    }
}

/// Represents the subscription mode for a resource type.
///
/// This enum captures the mutually exclusive subscription states:
/// - Wildcard: receive all resources of this type
/// - Named: receive only specific resources by name
#[derive(Debug, Clone, PartialEq, Eq)]
enum SubscriptionMode {
    /// Wildcard subscription - receive
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3060** (2026-11-20): **ci: use an example binary to locate protoc-gen-grpc-rust files**
  *Symptoms*: We have a few options here:  - Use either the old path or the new path - Use jq to parse cargo output to find the output directory - This one -- make a binary print the path  This one felt the nicest to me, but LMK what you think.

- **Issue #3058** (2026-11-20): **ci: create protoc-cache before copying the protoc build into it**
  *Symptoms*: The "Populate cache directory" step was relying on cp to create protoc-cache/. That depends on platform-specific cp behavior, and fails on the macOS runner with "cp: protoc-cache: No such file or directory".  It went unnoticed because the step only runs when the protoc binaries cache misses.  This change restores the behavior pre-#2685 and creates the directory first before copying the contents of install/ to it, which produces the same protoc-cache/bin layout on every platform. 
  **Post-Mortem & Fix Analysis**:
  > the CI blocker is due to Rust 1.100's change in build path. Need to update the CI script to be able to find both the old path (`build/protoc-gen-grpc-rust-<hash>/out`) and the new (`build/protoc-gen-grpc-rust/<hash>/out`) path

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

### Incident Patch 1: `10337899` (2026-11-20)
**Commit Message**: grpc: early channel dispatch fixes (#3047)

1. Make RPCs fail if they make it to the subchannel when it's not READY
(was `todo!()`)
2. Handle `Drop` results from pickers (was `todo!()`)
3. Handle the race where pickers can return recently-not-ready
subchannels (was missing)

**File**: `grpc/src/client/channel.rs` (modified, +208/-12)
```diff
@@ -42,6 +42,7 @@ use crate::StatusError;
 use crate::client::CallOptions;
 use crate::client::ConnectivityState;
 use crate::client::Invoke;
+use crate::client::InvokeOnce;
 use crate::client::RecvStream;
 use crate::client::RequestHeaders;
 use crate::client::ResponseStreamItem;
@@ -505,29 +506,54 @@ impl Invoke for LbInvoker {
                 .pick(PickOptions::new(&headers, &options))
             {
                 PickResult::Pick(mut pr) => {
-                    let on_complete = pr.on_complete.take();
                     let Some(sc) = pr.subchannel.downcast_ref::<InternalSubchannel>() else {
                         panic!(
                             "picked subchannel is not an implementation provided by the channel"
                         );
                     };
-                    let (tx, rx) = sc.invoke(headers, options).await;
-                    // Notify the LB policy when the RPC completes (or is
-                    // abandoned) so it can release any per-call state.
-                    let rx = match on_complete {
-                        Some(on_complete) => {
-                            BoxRecvStream::new(CompletionRecvStream::new(rx, on_complete))
-                        }
-                        None => rx,
-                    };
-                    return (tx, rx);
+                    if let Ok(invoker) = sc.ready_invoker() {
+                        let on_complete = pr.on_complete.take();
+                        let (tx, rx) = invoker.invoke_once(headers, options).await;
+                        // Notify the LB policy when the RPC completes (or is
+                        // abandoned) so it can release any per-call state.
+                        let rx = match on_complete {
+                            Some(on_complete) => {
+                                BoxRecvStream::new(CompletionRecvStream::new(rx, on_complete))
+                            }
+                            None => rx,
+                        };
+                        return (tx, rx);
+                    }
+                    // The subchannel likely left READY before the LB policy
+                    // updated its picker, so queue the pick and wait for a new
+                    // picker.  Dropping the pick drops its completion callback
+                    // without invoking it, since the RPC never started.
                 }
                 PickResult::Queue => {}
                 PickResult::Fail(status) => {
+                    // TODO: Check wait-for-ready and queue instead.
+                    if status.is_restricted_control_plane_code() {
+                        return FailingRecvStream::new_stream_pair(
+                            StatusError::new(
+                                StatusCodeError::Internal,
+                                format!("picker returned illegal status: {status}"),
+                            ),
+                            None,
+                        );
+                    }
                     return FailingRecvStream::new_stream_pair(status, None);
                 }
                 PickResult::Drop(status) => {
-                    todo!("dropped pick: {:?}", status);
+                    if status.is_restricted_control_plane_code() {
+                        return FailingRecvStream::new_stream_pair(
+                            StatusError::new(
+                                StatusCodeError::Internal,
+                                format!("picker returned illegal status: {status}"),
+                            ),
+                            None,
+                        );
+                    }
+                    return FailingRecvStream::new_stream_pair(status, None);
                 }
             }
             // Queued: wait for this snapshot to be superseded, then retry the
@@ -874,10 +900,19 @@ fn setup_registeries() {
 #[cfg(test)]
 mod tests {
     use std::sync::Barrier;
+    use std::sync::atomic::AtomicBool;
+    use std::sync::atomic::Ordering;
     use std::time::Duration;
 
     use super::*;
+    use crate::client::load_balancing::Pick;
+    use crate::client::load_balancing::test_utils::StubPolicyFuncs;
+    use crate::client::load_balancing::test_utils::reg_stub_policy;
+    use crate::client::name_resolution::Endpoint;
+    use crate::client::name_resolution::test_utils::FakeResolverBuilder;
+    use crate::client::test_util::NopRecvMessage;
     use crate::credentials::LocalChannelCredentials;
+    use crate::metadata::MetadataMap;
 
     fn new_channel() -> Channel {
         Channel::builder(
@@ -1011,4 +1046,165 @@ mod tests {
         let snapshot = assert_next(snapshot.next()).await;
         assert_eq!(*snapshot.value(), 1);
     }
+
+    // Sets its flag when dropped.
+    struct DropFlag(Arc<AtomicBool>);
+    impl Drop for DropFlag {
+        fn drop(&mut self) {
+            self.0.store(true, Ordering::SeqCst);
+        }
+    }
+
+    // Picks `subchannel`, with a completion callba
```

**File**: `grpc/src/client/name_resolution/config_selector.rs` (modified, +2/-99)
```diff
@@ -136,7 +136,6 @@ mod tests {
 
     use bytes::Bytes;
     use tokio::sync::mpsc;
-    use tokio::sync::oneshot;
     use tokio::sync::watch;
     use tokio::task::JoinHandle;
     use tonic_prost::prost::Message as _;
@@ -158,15 +157,10 @@ mod tests {
     use crate::client::boxed::BoxRecvStream;
     use crate::client::boxed::BoxSendStream;
     use crate::client::interceptor::Intercept;
-    use crate::client::name_resolution::ChannelController;
     use crate::client::name_resolution::Endpoint;
-    use crate::client::name_resolution::Resolver;
-    use crate::client::name_resolution::ResolverBuilder;
-    use crate::client::name_resolution::ResolverOptions;
     use crate::client::name_resolution::TCP_IP_NETWORK_TYPE;
-    use crate::client::name_resolution::Target;
-    use crate::client::name_resolution::WorkScheduler;
-    use crate::client::name_resolution::global_registry;
+    use crate::client::name_resolution::test_utils::FakeResolverBuilder;
+    use crate::client::name_resolution::test_utils::FakeResolverHandle;
     use crate::client::test_util::ByteRecvMsg;
     use crate::client::test_util::ByteSendMsg;
     use crate::core::Address;
@@ -284,97 +278,6 @@ mod tests {
         }
     }
 
-    /// Returns a resolver scheme that is unique within the test binary.
-    /// Resolvers can't be removed from the global registry, so each test
-    /// registers its own.
-    fn unique_scheme() -> String {
-        static NEXT_ID: AtomicUsize = AtomicUsize::new(0);
-        format!(
-            "config-selector-test-{}",
-            NEXT_ID.fetch_add(1, Ordering::Relaxed)
-        )
-    }
-
-    /// A resolver update, and a sender for the channel's result of applying
-    /// it.
-    type PendingUpdate = (ResolverUpdate, oneshot::Sender<Result<(), String>>);
-
-    /// Builds [`FakeResolver`]s, sending a handle to each one to the test.
-    struct FakeResolverBuilder {
-        scheme: String,
-        handle_tx: mpsc::UnboundedSender<FakeResolverHandle>,
-    }
-
-    impl FakeResolverBuilder {
-        /// Registers a new builder in the global registry. Returns its scheme
-        /// and a receiver for the handles of the resolvers it builds.
-        fn register() -> (String, mpsc::UnboundedReceiver<FakeResolverHandle>) {
-            let scheme = unique_scheme();
-            let (handle_tx, handle_rx) = mpsc::unbounded_channel();
-            global_registry().add_builder(Box::new(Self {
-                scheme: scheme.clone(),
-                handle_tx,
-            }));
-            (scheme, handle_rx)
-        }
-    }
-
-    impl ResolverBuilder for FakeResolverBuilder {
-        fn build(&self, _target: &Target, options: ResolverOptions) -> Box<dyn Resolver> {
-            let (update_tx, update_rx) = mpsc::unbounded_channel();
-            let _ = self.handle_tx.send(FakeResolverHandle {
-                work_scheduler: options.work_scheduler,
-                update_tx,
-            });
-            Box::new(FakeResolver { update_rx })
-        }
-
-        fn scheme(&self) -> &str {
-            &self.scheme
-        }
-
-        fn is_valid_uri(&self, _target: &Target) -> bool {
-            true
-        }
-    }
-
-    /// Lets the test push updates to the channel through a [`FakeResolver`].
-    struct FakeResolverHandle {
-        work_scheduler: Arc<dyn WorkScheduler>,
-        update_tx: mpsc::UnboundedSender<PendingUpdate>,
-    }
-
-    impl FakeResolverHandle {
-        /// Sends `update` to the channel and returns the channel's result of
-        /// applying it.
-        async fn update(&self, update: ResolverUpdate) -> Result<(), String> {
-            let (result_tx, result_rx) = oneshot::channel();
-            self.update_tx.send((update, result_tx)).unwrap();
-            self.work_scheduler.schedule_work();
-            GrpcRuntime::default()
-                .timeout(DEFAULT_TEST_TIMEOUT, result_rx)
-                .await
-                .expect("timed out waiting for the channel to apply the update")
-                .unwrap()
-        }
-    }
-
-    /// A resolver that sends the channel the updates pushed through its
-    /// [`FakeResolverHandle`].
-    struct FakeResolver {
-        update_rx: mpsc::UnboundedReceiver<PendingUpdate>,
-    }
-
-    impl Resolver for FakeResolver {
-        fn resolve_now(&mut self) {}
-
-        fn work(&mut self, channel_controller: &mut dyn ChannelController) {
-            while let Ok((update, result_tx)) = self.update_rx.try_recv() {
-                let _ = result_tx.send(channel_controller.update(update));
-            }
-        }
-    }
-
     /// Local channel credentials that hold every handshake until
     /// [`open`](Self::open) is called. Until then, the channel's subchannels
     /// stay CONNECTING, so its RPCs stay queued waiting for a pick.
```

**File**: `grpc/src/client/name_resolution/mod.rs` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ pub(crate) mod dns;
 pub(crate) use registry::global_registry;
 
 #[cfg(test)]
-mod test_utils;
+pub(crate) mod test_utils;
 
 pub(crate) mod proxy_resolver;
 
```

**File**: `grpc/src/client/name_resolution/test_utils.rs` (modified, +101/-0)
```diff
@@ -23,14 +23,24 @@
  */
 
 use std::sync::Arc;
+use std::sync::atomic::AtomicUsize;
+use std::sync::atomic::Ordering;
+use std::time::Duration;
 
 use tokio::sync::mpsc;
+use tokio::sync::oneshot;
 
 use crate::client::name_resolution::ChannelController;
+use crate::client::name_resolution::Resolver;
+use crate::client::name_resolution::ResolverBuilder;
+use crate::client::name_resolution::ResolverOptions;
 use crate::client::name_resolution::ResolverUpdate;
+use crate::client::name_resolution::Target;
 use crate::client::name_resolution::WorkScheduler;
+use crate::client::name_resolution::global_registry;
 use crate::client::service_config::ParseResult;
 use crate::client::service_config::ServiceConfig;
+use crate::rt::GrpcRuntime;
 
 /// A work scheduler for testing.
 pub(crate) struct TestWorkScheduler {
@@ -85,3 +95,94 @@ impl ChannelController for TestChannelController {
         ServiceConfig::parse(config)
     }
 }
+
+/// Returns a resolver scheme that is unique within the test binary.
+/// Resolvers can't be removed from the global registry, so each test
+/// registers its own.
+fn unique_scheme() -> String {
+    static NEXT_ID: AtomicUsize = AtomicUsize::new(0);
+    format!(
+        "fake-resolver-test-{}",
+        NEXT_ID.fetch_add(1, Ordering::Relaxed)
+    )
+}
+
+/// A resolver update, and a sender for the channel's result of applying
+/// it.
+type PendingUpdate = (ResolverUpdate, oneshot::Sender<Result<(), String>>);
+
+/// Builds [`FakeResolver`]s, sending a handle to each one to the test.
+pub(crate) struct FakeResolverBuilder {
+    scheme: String,
+    handle_tx: mpsc::UnboundedSender<FakeResolverHandle>,
+}
+
+impl FakeResolverBuilder {
+    /// Registers a new builder in the global registry. Returns its scheme
+    /// and a receiver for the handles of the resolvers it builds.
+    pub(crate) fn register() -> (String, mpsc::UnboundedReceiver<FakeResolverHandle>) {
+        let scheme = unique_scheme();
+        let (handle_tx, handle_rx) = mpsc::unbounded_channel();
+        global_registry().add_builder(Box::new(Self {
+            scheme: scheme.clone(),
+            handle_tx,
+        }));
+        (scheme, handle_rx)
+    }
+}
+
+impl ResolverBuilder for FakeResolverBuilder {
+    fn build(&self, _target: &Target, options: ResolverOptions) -> Box<dyn Resolver> {
+        let (update_tx, update_rx) = mpsc::unbounded_channel();
+        let _ = self.handle_tx.send(FakeResolverHandle {
+            work_scheduler: options.work_scheduler,
+            update_tx,
+        });
+        Box::new(FakeResolver { update_rx })
+    }
+
+    fn scheme(&self) -> &str {
+        &self.scheme
+    }
+
+    fn is_valid_uri(&self, _target: &Target) -> bool {
+        true
+    }
+}
+
+/// Lets the test push updates to the channel through a [`FakeResolver`].
+pub(crate) struct FakeResolverHandle {
+    work_scheduler: Arc<dyn WorkScheduler>,
+    update_tx: mpsc::UnboundedSender<PendingUpdate>,
+}
+
+impl FakeResolverHandle {
+    /// Sends `update` to the channel and returns the channel's result of
+    /// applying it.
+    pub(crate) async fn update(&self, update: ResolverUpdate) -> Result<(), String> {
+        let (result_tx, result_rx) = oneshot::channel();
+        self.update_tx.send((update, result_tx)).unwrap();
+        self.work_scheduler.schedule_work();
+        GrpcRuntime::default()
+            .timeout(Duration::from_secs(10), result_rx)
+            .await
+            .expect("timed out waiting for the channel to apply the update")
+            .unwrap()
+    }
+}
+
+/// A resolver that sends the channel the updates pushed through its
+/// [`FakeResolverHandle`].
+struct FakeResolver {
+    update_rx: mpsc::UnboundedReceiver<PendingUpdate>,
+}
+
+impl Resolver for FakeResolver {
+    fn resolve_now(&mut self) {}
+
+    fn work(&mut self, channel_controller: &mut dyn ChannelController) {
+        while let Ok((update, result_tx)) = self.update_rx.try_recv() {
+            let _ = result_tx.send(channel_controller.update(update));
+        }
+    }
+}
```

**File**: `grpc/src/client/subchannel.rs` (modified, +61/-21)
```diff
@@ -41,6 +41,7 @@ use crate::StatusError;
 use crate::client::CallOptions;
 use crate::client::ConnectivityState;
 use crate::client::Invoke;
+use crate::client::InvokeOnce;
 use crate::client::RequestHeaders;
 use crate::client::boxed::BoxInvoker;
 use crate::client::boxed::BoxRecvStream;
@@ -60,6 +61,7 @@ use crate::client::transport::TransportOptions;
 use crate::client::transport::http_connect::HttpConnectHandshaker;
 use crate::core::Address;
 use crate::core::ConnectionInfo;
+use crate::credentials::call::CallCredentials;
 use crate::credentials::call::CallDetails;
 use crate::credentials::call::ClientConnectionSecurityInfo as CallClientConnectionSecurityInfo;
 use crate::credentials::common::Authority;
@@ -172,37 +174,36 @@ impl PartialEq for InternalSubchannelState {
     }
 }
 
-impl Invoke for InternalSubchannel {
+/// Starts one RPC on the connection a subchannel had when
+/// [`InternalSubchannel::ready_invoker`] was called.
+///
+/// Holding this keeps that connection's service alive, so it must be used
+/// immediately.  It is only [`InvokeOnce`], so it can't be reused.
+pub(crate) struct ReadyInvoker {
+    state: Arc<ReadyState>,
+    call_creds: Option<Arc<dyn CallCredentials>>,
+}
+
+/// An error returned by [`InternalSubchannel::ready_invoker`] when the
+/// subchannel is not READY.
+#[derive(Debug)]
+pub(crate) struct SubchannelNotReady;
+
+impl InvokeOnce for ReadyInvoker {
     type SendStream = BoxSendStream;
     type RecvStream = BoxRecvStream;
 
-    async fn invoke(
-        &self,
+    async fn invoke_once(
+        self,
         mut headers: RequestHeaders,
         options: CallOptions,
     ) -> (Self::SendStream, Self::RecvStream) {
-        let (state, call_creds) = {
-            let data = self.data.lock().unwrap();
-
-            let state = match &data.state {
-                InternalSubchannelState::Ready(state) => state.clone(),
-                _ => todo!("handle non-READY subchannel"),
-            };
-
-            let creds = data
-                .security_opts
-                .credentials
-                .get_call_credentials(private::UnstableToken)
-                .cloned();
-
-            (state, creds)
-        };
-
+        let state = self.state;
         let fail_with = |status| -> (BoxSendStream, BoxRecvStream) {
             FailingRecvStream::new_stream_pair(status, Some(state.connection_info.clone()))
         };
 
-        if let Some(call_creds) = call_creds {
+        if let Some(call_creds) = self.call_creds {
             if call_creds.minimum_channel_security_level()
                 > state.connection_info.security_info().security_level()
             {
@@ -244,6 +245,28 @@ impl Invoke for InternalSubchannel {
     }
 }
 
+impl Invoke for InternalSubchannel {
+    type SendStream = BoxSendStream;
+    type RecvStream = BoxRecvStream;
+
+    async fn invoke(
+        &self,
+        headers: RequestHeaders,
+        options: CallOptions,
+    ) -> (Self::SendStream, Self::RecvStream) {
+        match self.ready_invoker() {
+            Ok(invoker) => invoker.invoke_once(headers, options).await,
+            Err(SubchannelNotReady) => FailingRecvStream::new_stream_pair(
+                StatusError::new(
+                    StatusCodeError::Unavailable,
+                    format!("subchannel for {} is not READY", self.address),
+                ),
+                None,
+            ),
+        }
+    }
+}
+
 pub(crate) struct InternalSubchannel {
     address: Address,
     data: Arc<Mutex<InternalSubchannelData>>,
@@ -311,6 +334,23 @@ impl PartialEq for InternalSubchannel {
 }
 
 impl InternalSubchannel {
+    /// Returns an invoker for the subchannel's current connection, or an error
+    /// if the subchannel is not READY.
+    pub(crate) fn ready_invoker(&self) -> Result<ReadyInvoker, SubchannelNotReady> {
+        let data = self.data.lock().unwrap();
+        let InternalSubchannelState::Ready(state) = &data.state else {
+            return Err(SubchannelNotReady);
+        };
+        Ok(ReadyInvoker {
+            state: state.clone(),
+            call_creds: data
+                .security_opts
+                .credentials
+                .get_call_credentials(private::UnstableToken)
+                .cloned(),
+        })
+    }
+
     pub(super) fn new_arc(
         address: Address,
         transport: ArcTransport,
```

#### Recent Merged Pull Requests:
- **PR #3060** (2026-11-20): ci: use an example binary to locate protoc-gen-grpc-rust files (@dfawley)
- **PR #3058** (closed): ci: create protoc-cache before copying the protoc build into it (@dfawley)
- **PR #3057** (2026-11-20): grpc: make GrpcRuntime pub; move unstable rt APIs to rt::unstable (@dfawley)
- **PR #3055** (2026-11-19): grpc: move Listener types from runtime to server; and a minor tweak to accommodate errors better (@dfawley)
- **PR #3054** (2026-11-19): grpc: remove tower from the tonic client transport (@dfawley)
- **PR #3048** (2026-11-19): Connection Attempt Delay timer tests. (@nathanielford)

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

## X. grpc: early channel dispatch fixes

**RULE**:
When implementing operations in `grpc/src/client/channel.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in grpc/grpc-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `10337899`: grpc: early channel dispatch fixes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `grpc/src/client/channel.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::client::InvokeOnce;
                    if let Ok(invoker) = sc.ready_invoker() {
                        let on_complete = pr.on_complete.take();
                        let (tx, rx) = invoker.invoke_once(headers, options).await;
                        // Notify the LB policy when the RPC completes (or is
                        // abandoned) so it can release any per-call state.
                        let rx = match on_complete {
                            Some(on_complete) => {
                                BoxRecvStream::new(CompletionRecvStream::new(rx, on_complete))
                            }
                            None => rx,
                        };
                        return (tx, rx);
                    }
                    // The subchannel likely left READY before the LB policy
                    // updated its picker, so queue the pick and wait for a new
                    // picker.  Dropping the pick drops its completion callback
                    // without invoking it, since the RPC never started.
                    // TODO: Check wait-for-ready and queue instead.
                    if status.is_restricted_control_plane_code() {
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    let on_complete = pr.on_complete.take();
                    let (tx, rx) = sc.invoke(headers, options).await;
                    // Notify the LB policy when the RPC completes (or is
                    // abandoned) so it can release any per-call state.
                    let rx = match on_complete {
                        Some(on_complete) => {
                            BoxRecvStream::new(CompletionRecvStream::new(rx, on_complete))
                        }
                        None => rx,
                    };
                    return (tx, rx);
                    todo!("dropped pick: {:?}", status);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `10337899` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
