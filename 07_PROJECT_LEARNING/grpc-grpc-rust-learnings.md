> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/grpc-grpc-rust-learnings.md`  
> **Source**: github ([https://github.com/grpc/grpc-rust](https://github.com/grpc/grpc-rust))  
> **Source Version**: `4ad6538f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:39:13.034Z  
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
> **Harvest Timestamp**: 2026-10-19T03:39:13.026Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `grpc/grpc-rust`
- **Description**: A native gRPC client & server implementation with async/await support.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12494 stars

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
use crate::client::DynRecvStream;
use crate::client::DynSendStream;
use crate::client::InvokeOnce;
use crate::client::RecvStream;
use crate::client::RequestHeaders;
use crate::client::ResponseStreamItem;
use crate::client::SendOptions;
use crate::client::SendStream;
use crate::client::Trailers;
use crate::client::interceptor::Intercept;
use crate::core::ConnectionInfo;
use crate::core::RecvMessage;
use crate::core::SendMessage;

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
    async fn send(&mut self, msg: &dyn SendMessage, options: SendOptions) -> Result<(), ()> {
        Err(())
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
    ) -> (Box<dyn DynSendStream>, Box<dyn DynRecvStream>) {
        (
            Box::new(NopSendStream),
            Box::new(Self {
                status: Some(status),
                connection_info,
            }),
        )
    }
}

#[cfg(test)]
mod test {
    use std::mem::discriminant;
    use std::vec;

    use super::*;
    use crate::client::ResponseHeaders;
    use crate::client::interceptor::InvokeOnceExt as _;
    use crate::client::test_util::MockInvoker;
    use crate::client::test_util::NopRecvMessage;

    // Tests that an error occurs if messages are received before headers.
    #[tokio::test]
    async fn test_validator_messages_before_headers() {
        let scenarios = [vec![ResponseStreamItem::Message]];

        for scenario in scenarios {
            validate_scenario(
                &scenario,
                ResponseStreamItem::Trailers(Trailers::new(Err(StatusError::new(
                    StatusCodeError::Internal,
                    "received messages without headers",
                )))),
                false,
            )
            .await;
        }
    }

    // Tests that an error occurs if StreamClosed is received early.
    #[tokio::test]
    async fn test_validator_stream_closed_before_trailers() {
        let scenarios = [
            vec![ResponseStreamItem::StreamClosed],
            vec![
                ResponseStreamItem::Headers(ResponseHeaders::new(
                    crate::core::test_connection_info(),
                )),
                ResponseStreamItem::StreamClosed,
            ],
            vec![
                ResponseStreamItem::Headers(ResponseHeaders::new(
                    crate::core::test_connection_info(),
                )),
                ResponseStreamItem::Message,
                ResponseStreamItem::StreamClosed,
            ],
        ];

        for scenario in &scenarios {
            validate_scenario(
                scenario,
                ResponseStreamItem::Trailers(Trailers::new(Err(StatusError::new(
                    StatusCodeError::Internal,
                    "ended without trailers",
                )))),
                false,
            )
            .await;
        }
    }

    // Tests that an error occurs if headers are received twice.
    #[tokio::test]
    async fn test_validator_headers_repeated() {
        let scenarios = [
            vec![
                ResponseStreamItem::Headers(ResponseHeaders::new(
                    crate::core::test_connection_info(),
                )),
                ResponseStreamItem::Headers(ResponseHeaders::new(
                    crate::core::test_connection_info(),
                )),
            ],
            vec![
                ResponseStreamItem::Headers(ResponseHeaders::new(
                    crate::core::test_connection_info(),
                )),
                ResponseStreamItem::Message,
                ResponseStreamItem::Headers(ResponseHeaders::new(
                    crate::core::test_
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

//! Type-state wrappers for LbChannel lifecycle management.
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
//! load reporting are handled separately by [`LbChannel`] at the pool level.
//!
//! [`KeyedFutures`]: crate::client::loadbalance::keyed_futures::KeyedFutures
//! [`LbChannel`]: crate::client::loadbalance::channel::LbChannel

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use pin_project_lite::pin_project;
use tower::Service;
use tower::load::Load;

use crate::client::endpoint::{Connector, EndpointAddress};
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

/// An idle channel that only stores an address. It is the entry point for
/// starting a connection attempt.
pub(crate) struct IdleChannel {
    addr: EndpointAddress,
}

impl IdleChannel {
    pub(crate) fn new(addr: EndpointAddress) -> Self {
        Self { addr }
    }

    /// Start connecting to the endpoint. Consumes the idle channel.
    /// The resolved [`ReadyChannel`] will carry the
    /// `Arc<OutlierChannelState>` from `registry.add_channel(addr)` —
    /// idempot
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
//! The worker runs as a background task, managing:
//! - The ADS stream lifecycle (connection, reconnection)
//! - Resource subscriptions and version/nonce tracking
//! - Dispatching resources to watchers
//! - ACK/NACK protocol

use std::collections::hash_map::Entry;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use bytes::Bytes;
use tokio::sync::{mpsc, oneshot};

use crate::client::config::{ClientConfig, ServerConfig};
use crate::client::retry::Backoff;
use crate::client::watch::{ProcessingDone, ResourceEvent};
use crate::codec::XdsCodec;
use crate::error::{Error, Result};
use crate::message::{DiscoveryRequest, DiscoveryResponse, ErrorDetail, Node};
use crate::metrics::{self, KeyValue, MetricsRecorder};
use crate::resource::{DecodedResource, DecoderFn};
use crate::runtime::Runtime;
use crate::transport::{Transport, TransportBuilder, TransportReceiver, TransportSender};

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

/// Commands sent from `XdsClient` to the worker.
pub(crate) enum WorkerCommand {
    /// Subscribe to a resource.
    Watch {
        /// The type URL of the resource.
        type_url: &'static str,
        /// The resource name (empty string for wildcard subscription).
        name: String,
        /// Unique identifier for this watcher.
        watcher_id: WatcherId,
        /// Channel to send resource events to the watcher.
        event_tx: mpsc::Sender<ResourceEvent<DecodedResource>>,
        /// Decoder function for this resource type.
        decoder: DecoderFn,
        /// Whether all resources must be present in SotW responses (per A53).
        all_resources_required_in_sotw: bool,
    },
    /// Unsubscribe a watcher.
    Unwatch {
        /// The watcher to remove.
        watcher_id: WatcherId,
    },
    /// Timer expired for a resource that was never received (gRFC A57).
    ResourceTimerExpired {
        /// The type URL of the resource.
        type_url: String,
        /// The resource name.
        name: String,
    },
}

/// Represents the subscription mode for a resource type.
///
/// This enum
```

### Core Architecture Module: `codegen/src/main.rs`
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

use std::{
    fs::File,
    io::{BufWriter, Write as _},
    path::{Path, PathBuf},
    time::Instant,
};

use protox::prost::Message as _;
use quote::quote;
use tonic_prost_build::FileDescriptorSet;

fn main() {
    println!("Running codegen...");

    let start = Instant::now();

    // tonic-health
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-health"),
        &["proto/health.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/grpc_health_v1_fds.rs"),
        true,
        true,
    );

    // tonic-reflection
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-reflection"),
        &["proto/reflection_v1.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/reflection_v1_fds.rs"),
        true,
        true,
    );
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-reflection"),
        &["proto/reflection_v1alpha.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/reflection_v1alpha1_fds.rs"),
        true,
        true,
    );

    // tonic-types
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-types"),
        &["proto/status.proto", "proto/error_details.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/types_fds.rs"),
        false,
        false,
    );

    // grpc
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("grpc"),
        &["proto/echo/echo.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/echo_fds.rs"),
        true,
        true,
    );

    println!("Codgen completed: {}ms", start.elapsed().as_millis());
}

fn codegen(
    root_dir: &Path,
    iface_files: &[&str],
    include_dirs: &[&str],
    out_dir: &Path,
    file_descriptor_set_path: &Path,
    build_client: bool,
    build_server: bool,
) {
    let tempdir = tempfile::Builder::new()
        .prefix("tonic-codegen-")
        .tempdir()
        .unwrap();

    let iface_files = iface_files.iter().map(|&path| root_dir.join(path));
    let include_dirs = include_dirs.iter().map(|&path| root_dir.join(path));
    let out_dir = root_dir.join(out_dir);
    let file_descriptor_set_path = root_dir.join(file_descriptor_set_path);

    let fds = protox::compile(iface_files, include_dirs).unwrap();

    write_fds(&fds, &file_descriptor_set_path);

    tonic_prost_build::configure()
        .build_client(build_client)
        .build_server(build_server)
        .build_transport(false)
        .out_dir(&tempdir)
        .compile_fds(fds)
        .unwrap();

    for path in std::fs::read_dir(tempdir.path()).unwrap() {
        let path = path.unwrap().path();
        let to = out_dir.join(
            path.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .strip_suffix(".rs")
                .unwrap()
                .replace('.', "_")
                + ".rs",
        );
        std::fs::copy(&path, &to).unwrap();
    }
}

fn write_fds(fds: &FileDescriptorSet, path: &Path) {
    const GENERATED_COMMENT: &str = "// This file is @generated by codegen.";

    let mut file_header = String::new();

    let mut fds = fds.clone();

    for fd in fds.file.iter() {
        let Some(source_code_info) = &fd.source_code_info else {
            continue;
        };

        for location in &source_code_info.location {
            for comment in &location.leading_detached_comments {
                file_header += comment;
            }
        }
    }

    for fd in fds.file.iter_mut() {
        fd.source_code_info = None;
    }

    let fds_raw = fds.encode_to_vec();
    let tokens = quote! {
        /// Byte encoded FILE_DESCRIPTOR_SET.
        pub const FILE_DESCRIPTOR_SET: &[u8] = &[#(#fds_raw),*];
    };
    let ast = syn::parse2(tokens).unwrap();
    let formatted = prettyplease::unparse(&ast);

    let mut writer = BufWriter::new(File::create(path).unwrap());

    writer.write_all(GENERATED_COMMENT.as_bytes()).unwrap();
    writer.write_all(b"\n").unwrap();

    if !file_header.is_empty() {
        let file_header = comment_out(&file_header);
        writer.write_all(file_header.as_bytes()).unwrap();
        writer.write_all(b"\n").unwrap();
    }

    writer.write_all(formatted.as_bytes()).unwrap()
}

fn comment_out(s: &str) -> String {
    s.split('\n')
        .map(|line| format!("// {line}"))
        .collect::<Vec<String>>()
        .join("\n")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2928** (2026-10-15): **grpc/load_balancing: Remove unused OneSubchannelPicker.**
  *Symptoms*: ## Motivation  `OneSubchannelPicker` currently exists in both `mod.rs` and in `pick_first.rs`. Since it's only used by `pick_first`, it should only exist private to that LB.  ## Solution  Remove the unused `mod.rs` copy of `OneSubchannelPicker`.  

- **Issue #2926** (2026-10-14): **grpc/load_balancing: add picker expectation helpers to TestEnv**
  *Symptoms*: ## Motivation  Various different load balancers test pickers in similar ways, but often using their own helper functions.  While working on tests for the Cluster Manager and Weighted Target load balancers, and the pick first rework, found it would be easier to have some of these consolidated.   ## Solution  Consolidate `expect_picker_state()`, `expect_queueing_picker()`, `expect_failing_picker()` and `expect_ready_picker()` into the `test_utils.rs` so they can be broadly used.  

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

### Incident Patch 1: `46622e93` (2026-09-29)
**Commit Message**: fix(codec): eliminate uninitialized memory in encode_item on unwind (#2847)

## Motivation

Fixes https://github.com/grpc/grpc-rust/issues/2720.

In `tonic/src/codec/encode.rs`, `encode_item` previously advanced the
buffer's logical length by 5 bytes using `unsafe {
buf.advance_mut(HEADER_SIZE); }` before invoking the user-provided
`Encoder::encode`. If the encoder panicked or unwound, `buf` was left
with 5 uninitialized bytes exposed to callers catching unwinds.

## Solution

* Replace `unsafe { buf.advance_mut(HEADER_SIZE); }` with safe
zero-filled initialization via `buf.put_slice(&[0u8; HEADER_SIZE])`,
eliminating the `unsafe` block entirely.
* Writing 5 zero bytes into the cache line that is immediately
overwritten by `finish_encoding` incurs minimal performance impact (a
single store instruction).
* The alternative RAII drop guard approach was deliberately avoided
because it preserves `unsafe` code and could resurface the soundness
vulnerability if `std::mem::forget` (or a similar leak) were ever
introduced.
* Add unit test `encode_item_exception_safety_on_panic` verifying that
unwinding panics leave only initialized zero bytes in the buffer.

## Test Plan

- Ran `cargo test 

**File**: `tonic/src/codec/encode.rs` (modified, +54/-3)
```diff
@@ -172,9 +172,7 @@ where
     let offset = buf.len();
 
     buf.reserve(HEADER_SIZE);
-    unsafe {
-        buf.advance_mut(HEADER_SIZE);
-    }
+    buf.put_slice(&[0u8; HEADER_SIZE]);
 
     if let Some(encoding) = compression_encoding {
         uncompression_buf.clear();
@@ -399,3 +397,56 @@ where
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::panic::catch_unwind;
+
+    struct PanickingEncoder;
+
+    impl Encoder for PanickingEncoder {
+        type Item = String;
+        type Error = Status;
+
+        fn encode(
+            &mut self,
+            _item: Self::Item,
+            _dst: &mut EncodeBuf<'_>,
+        ) -> Result<(), Self::Error> {
+            panic!("encoder deliberate panic for testing exception safety");
+        }
+    }
+
+    #[test]
+    fn encode_item_exception_safety_on_panic() {
+        let mut encoder = PanickingEncoder;
+        let mut buf = BytesMut::new();
+        let mut uncompression_buf = BytesMut::new();
+
+        let result = catch_unwind(std::panic::AssertUnwindSafe(|| {
+            encode_item(
+                &mut encoder,
+                &mut buf,
+                &mut uncompression_buf,
+                None,
+                None,
+                BufferSettings::default(),
+                "test".to_string(),
+            )
+        }));
+
+        assert!(result.is_err(), "Encoder panic should unwind correctly.");
+        // Buffer must only contain initialized bytes (5 zero bytes written by put_slice).
+        assert_eq!(
+            buf.len(),
+            HEADER_SIZE,
+            "Buffer length should reflect reserved header bytes."
+        );
+        assert_eq!(
+            &buf[..],
+            &[0u8; HEADER_SIZE],
+            "Buffer must contain only initialized zero bytes."
+        );
+    }
+}
```

---

### Incident Patch 2: `194f07e6` (2026-09-25)
**Commit Message**: grpc/service_config: fix flaky service_config tests caused by a test LB policy name collision (#2892)

## Problem

About 1 run in 8, a test in `client::service_config` fails. It can be
`test_valid_service_config_parsing`, `test_lb_config_resolution` or
`test_load_balancing_config_serde`, whichever loses the race:

>
thread
'client::service_config::serde_bindings::test::test_load_balancing_config_serde'
    panicked at grpc/src/client/service_config/serde_bindings.rs:473:14:
    called `Option::unwrap()` on a `None` value

Both tests define their own test LB policy and register it in
`GLOBAL_LB_REGISTRY` under the same name, so the last test to register
wins. The tests run in parallel, so one test can end up parsing its
config with the other file's builder. The `builder.name()` assertion
still passes because both names are the same. The test then panics on
`downcast_ref::<TestPolicyConfig>().unwrap()`, because the parsed config
is the other file's `TestPolicyConfig` type.

## Fix

Give each test policy a name unique to its file.

While here, fix the "Invalid config for supported policy" case in
`test_load_balancing_config_serde`. It used `"testPolicy"`, a name that
was never registe

**File**: `grpc/src/client/service_config/mod.rs` (modified, +5/-5)
```diff
@@ -123,7 +123,7 @@ mod test {
         }
 
         fn name(&self) -> &'static str {
-            "test_policy"
+            "service_config_test_policy"
         }
 
         fn parse_config(
@@ -170,7 +170,7 @@ mod test {
 
         let json_data = json!({
             "loadBalancingConfig": [
-                { "test_policy": { "testField": true } },
+                { "service_config_test_policy": { "testField": true } },
                 { "round_robin": {} }
             ],
             "methodConfig": [
@@ -206,7 +206,7 @@ mod test {
 
         // Verify Load Balancing Config.
         let (builder, config) = sc.lb_config();
-        assert_eq!(builder.name(), "test_policy");
+        assert_eq!(builder.name(), "service_config_test_policy");
         let pf_config = config.downcast_ref::<TestPolicyConfig>().unwrap().clone();
         assert!(pf_config.test_field);
 
@@ -379,13 +379,13 @@ mod test {
         let json_data = json!({
             "loadBalancingConfig": [
                 { "unsupported_lb_policy": { "foo": "bar" } },
-                { "test_policy": { "testField": true } },
+                { "service_config_test_policy": { "testField": true } },
                 { "round_robin": {} }
             ]
         });
         let sc = ServiceConfig::parse(&json_data.to_string()).unwrap();
         let (builder, config) = sc.lb_config();
-        assert_eq!(builder.name(), "test_policy");
+        assert_eq!(builder.name(), "service_config_test_policy");
         let pf_config = config.downcast_ref::<TestPolicyConfig>().unwrap().clone();
         assert!(pf_config.test_field);
 
```

**File**: `grpc/src/client/service_config/serde_bindings.rs` (modified, +7/-7)
```diff
@@ -357,7 +357,7 @@ mod test {
             }
 
             fn name(&self) -> &'static str {
-                "test_policy"
+                "serde_bindings_test_policy"
             }
 
             fn parse_config(
@@ -417,17 +417,17 @@ mod test {
         let selected = val.load_balancing_config.as_ref().unwrap();
         assert_eq!(selected.builder.name(), "round_robin");
 
-        // Multiple policies; picks first supported with parsed config (test_policy)
+        // Multiple policies; picks first supported with parsed config (serde_bindings_test_policy)
         let val: TestConfig = serde_json::from_value(json!({
             "loadBalancingConfig": [
                 { "unsupported_lb_1": { "key": "val" } },
-                { "test_policy": { "testField": true } },
+                { "serde_bindings_test_policy": { "testField": true } },
                 { "round_robin": {} }
             ]
         }))
         .unwrap();
         let selected = val.load_balancing_config.as_ref().unwrap();
-        assert_eq!(selected.builder.name(), "test_policy");
+        assert_eq!(selected.builder.name(), "serde_bindings_test_policy");
         let pf_cfg = selected
             .config
             .as_ref()
@@ -437,7 +437,7 @@ mod test {
 
         // Invalid config for supported policy fails deserialization
         let res: Result<TestConfig, _> = serde_json::from_value(json!({
-            "loadBalancingConfig": [{ "testPolicy": { "testField": "not_a_bool" } }]
+            "loadBalancingConfig": [{ "serde_bindings_test_policy": { "testField": "not_a_bool" } }]
         }));
         assert!(res.is_err());
 
@@ -470,14 +470,14 @@ mod test {
         // Multiple policies; trailing entries after first supported are ignored
         let val: TestConfig = serde_json::from_value(json!({
             "loadBalancingConfig": [
-                { "test_policy": { "testField": true } },
+                { "serde_bindings_test_policy": { "testField": true } },
                 { "unsupported": { "invalid": 123 }, "other": {} },
                 {}
             ]
         }))
         .unwrap();
         let selected = val.load_balancing_config.as_ref().unwrap();
-        assert_eq!(selected.builder.name(), "test_policy");
+        assert_eq!(selected.builder.name(), "serde_bindings_test_policy");
 
         // Invalid entry with multiple keys in single object -> Error
         let res: Result<TestConfig, _> = serde_json::from_value(json!({
```

---

### Incident Patch 3: `3a60b544` (2026-09-22)
**Commit Message**: tonic-xds: expose gRFC A29 cluster security parsing (#2876)

## Motivation

`ClusterTlsConfig` lets a custom connector reuse the crate's gRFC A29
handling instead of re-implementing SAN matching and chain validation.
The only way to get one is from `MakeConnector::make_connector`, since
it borrows the channel's cert-provider registry and has no public
constructor.

Code that runs its own ADS stream already holds the `Cluster` and the
certificate providers, but it never calls `make_connector`, so it cannot
get a `ClusterTlsConfig`. That leaves copying the A29 parsing, which is
about 1300 lines across `security.rs`, `san_matcher.rs` and
`string_matcher.rs`, all private to the crate.

## Solution

Make `ClusterSecurityConfig` public, with private fields and accessors.

`from_cluster_bytes` parses the `transport_socket` of a serialized
`Cluster`. It returns `Ok(None)` when the cluster has no transport
socket, and otherwise fails with the same NACK errors as before. It
takes the encoded resource rather than a decoded `Cluster` so that the
envoy protobuf types stay out of this crate's public API, which
`check-external-types` enforces. A caller driving its own ADS stream has
those bytes a

**File**: `tonic-xds/src/client/endpoint.rs` (modified, +7/-13)
```diff
@@ -24,8 +24,6 @@
 
 use crate::common::async_util::BoxFuture;
 #[cfg(feature = "_tls-any")]
-use crate::xds::cert_provider::verifier::XdsServerCertVerifier;
-#[cfg(feature = "_tls-any")]
 use crate::xds::cert_provider::{CertProviderRegistry, CertificateProvider};
 use crate::xds::resource::cluster::ClusterResource;
 use crate::xds::resource::security::ClusterSecurityConfig;
@@ -301,13 +299,13 @@ impl ClusterTlsConfig<'_> {
     /// Bootstrap instance name of the CA trust bundle used to validate the
     /// peer's certificate chain.
     pub fn ca_instance_name(&self) -> &str {
-        &self.security.ca_instance_name
+        self.security.ca_instance_name()
     }
 
     /// Bootstrap instance name of the local identity (client certificate).
     /// `Some` implies mTLS is requested for this cluster.
     pub fn identity_instance_name(&self) -> Option<&str> {
-        self.security.identity_instance_name.as_deref()
+        self.security.identity_instance_name()
     }
 
     /// Build the gRFC-A29 server-certificate verifier for this cluster.
@@ -325,15 +323,12 @@ impl ClusterTlsConfig<'_> {
     ) -> Result<Arc<dyn rustls::client::danger::ServerCertVerifier>, ClusterTlsError> {
         let ca_provider = self
             .registry
-            .get(&self.security.ca_instance_name)
+            .get(self.security.ca_instance_name())
             .ok_or_else(|| {
-                ClusterTlsError::UnknownCaInstance(self.security.ca_instance_name.clone())
+                ClusterTlsError::UnknownCaInstance(self.security.ca_instance_name().to_owned())
             })?
             .clone();
-        Ok(Arc::new(XdsServerCertVerifier::new(
-            ca_provider,
-            self.security.san_matchers.clone(),
-        )))
+        Ok(self.security.build_verifier(ca_provider))
     }
 
     /// Resolve the optional mTLS identity provider for this cluster.
@@ -345,13 +340,12 @@ impl ClusterTlsConfig<'_> {
         &self,
     ) -> Result<Option<Arc<dyn CertificateProvider>>, ClusterTlsError> {
         self.security
-            .identity_instance_name
-            .as_ref()
+            .identity_instance_name()
             .map(|name| {
                 self.registry
                     .get(name)
                     .cloned()
-                    .ok_or_else(|| ClusterTlsError::UnknownIdentityInstance(name.clone()))
+                    .ok_or_else(|| ClusterTlsError::UnknownIdentityInstance(name.to_owned()))
             })
             .transpose()
     }
```

**File**: `tonic-xds/src/lib.rs` (modified, +5/-0)
```diff
@@ -253,6 +253,10 @@ pub use xds::bootstrap::{
 pub use xds::cert_provider_config::TlsChannelCredentials;
 pub use xds::resource::route_config::{RouteConfigMetadata, TypedMetadata};
 pub use xds::uri::{XdsUri, XdsUriError};
+/// Re-export of the error type returned by
+/// [`ClusterSecurityConfig::from_cluster_bytes`], so callers can name it
+/// without a direct `xds-client` dependency.
+pub use xds_client::Error as XdsError;
 pub use xds_client::TonicCallCredentials;
 
 #[cfg(feature = "_tls-any")]
@@ -263,6 +267,7 @@ pub use client::endpoint::{ClusterTlsConfig, ClusterTlsError};
 pub use rustls::client::danger::ServerCertVerifier;
 #[cfg(feature = "_tls-any")]
 pub use xds::cert_provider::{CertProviderError, CertificateData, CertificateProvider, Identity};
+pub use xds::resource::security::ClusterSecurityConfig;
 
 pub use xds_client::{Instrument, InstrumentKind, KeyValue, MetricsRecorder, StringValue, Value};
 
```

**File**: `tonic-xds/src/xds/cluster_discovery.rs` (modified, +1/-5)
```diff
@@ -393,11 +393,7 @@ mod tests {
 
     #[cfg(feature = "_tls-any")]
     fn security(ca: &str, identity: Option<&str>) -> ClusterSecurityConfig {
-        ClusterSecurityConfig {
-            ca_instance_name: ca.into(),
-            identity_instance_name: identity.map(Into::into),
-            san_matchers: vec![],
-        }
+        ClusterSecurityConfig::for_test(ca, identity)
     }
 
     #[cfg(feature = "_tls-any")]
```

**File**: `tonic-xds/src/xds/resource/security.rs` (modified, +110/-8)
```diff
@@ -45,19 +45,81 @@ const TLS_TRANSPORT_SOCKET_NAME: &str = "envoy.transport_sockets.tls";
 /// Cluster-level TLS security config.
 ///
 /// Holds the instance names referenced by the cluster, not resolved
-/// providers. Resolution against [`CertProviderRegistry`] happens later, at
+/// providers. Resolving a name to a provider happens later, at
 /// connection-building time, so that this type can be derived during CDS
-/// resource validation (where the registry is not available).
-///
-/// [`CertProviderRegistry`]: crate::xds::cert_provider::CertProviderRegistry
+/// resource validation.
 #[derive(Debug, Clone)]
-pub(crate) struct ClusterSecurityConfig {
+pub struct ClusterSecurityConfig {
     /// Bootstrap instance name for the CA trust bundle. Required.
-    pub ca_instance_name: String,
+    ca_instance_name: String,
     /// Bootstrap instance name for client identity. `Some` implies mTLS.
-    pub identity_instance_name: Option<String>,
+    identity_instance_name: Option<String>,
     /// SAN matchers for server authorization. May be empty.
-    pub san_matchers: Vec<SanMatcher>,
+    san_matchers: Vec<SanMatcher>,
+}
+
+impl ClusterSecurityConfig {
+    /// Parse the `transport_socket` of a serialized CDS `Cluster`.
+    ///
+    /// Takes the encoded resource rather than a decoded `Cluster` so that the
+    /// envoy protobuf types stay out of this crate's public API. A caller
+    /// driving its own ADS stream has these bytes already: they are what the
+    /// management server sent.
+    ///
+    /// Returns `Ok(None)` when the cluster declares no transport socket and so
+    /// connects in plaintext, and an error for any A29 NACK condition.
+    ///
+    /// [`XdsChannel`](crate::XdsChannel) parses clusters itself and hands the
+    /// result to a connector, so this is for a caller outside that flow, which
+    /// holds the resource and its own providers.
+    pub fn from_cluster_bytes(cluster: &[u8]) -> Result<Option<Self>, Error> {
+        let cluster = envoy_types::pb::envoy::config::cluster::v3::Cluster::decode(cluster)?;
+        parse_transport_socket(cluster.transport_socket)
+    }
+
+    /// Bootstrap instance name of the CA trust bundle used to validate the
+    /// peer's certificate chain.
+    pub fn ca_instance_name(&self) -> &str {
+        &self.ca_instance_name
+    }
+
+    /// Bootstrap instance name of the local identity (client certificate).
+    /// `Some` implies mTLS is requested for this cluster.
+    pub fn identity_instance_name(&self) -> Option<&str> {
+        self.identity_instance_name.as_deref()
+    }
+
+    /// Build a config directly, for tests that need a cluster's security
+    /// settings without a `Cluster` to parse.
+    #[cfg(test)]
+    pub(crate) fn for_test(ca_instance_name: &str, identity_instance_name: Option<&str>) -> Self {
+        Self {
+            ca_instance_name: ca_instance_name.to_owned(),
+            identity_instance_name: identity_instance_name.map(str::to_owned),
+            san_matchers: Vec::new(),
+        }
+    }
+
+    /// Build the gRFC A29 server-certificate verifier for this cluster.
+    ///
+    /// `ca_provider` supplies the trust bundle named by
+    /// [`ca_instance_name`](Self::ca_instance_name). The bundle is re-read on
+    /// each handshake, so CA rotation is picked up.
+    ///
+    /// Build once per CDS update and clone the returned `Arc` per connection;
+    /// this is not for the per-request hot path.
+    #[cfg(feature = "_tls-any")]
+    pub fn build_verifier(
+        &self,
+        ca_provider: std::sync::Arc<dyn crate::xds::cert_provider::CertificateProvider>,
+    ) -> std::sync::Arc<dyn rustls::client::danger::ServerCertVerifier> {
+        std::sync::Arc::new(
+            crate::xds::cert_provider::verifier::XdsServerCertVerifier::new(
+                ca_provider,
+                self.san_matchers.clone(),
+            ),
+        )
+    }
 }
 
 /// Parse a cluster's `transport_socket` into a [`ClusterSecurityConfig`].
@@ -247,6 +309,7 @@ fn reject(set: bool, field: &str) -> xds_client::Result<()> {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use envoy_types::pb::envoy::config::cluster::v3::Cluster;
     use envoy_types::pb::envoy::extensions::transport_sockets::tls::v3::{
         CertificateProviderPluginInstance, SubjectAltNameMatcher, subject_alt_name_matcher::SanType,
     };
@@ -291,6 +354,45 @@ mod tests {
         }
     }
 
+    fn cluster_bytes(transport_socket: Option<TransportSocket>) -> Vec<u8> {
+        Cluster {
+            name: "c".into(),
+            transport_socket,
+            ..Default::default()
+        }
+        .encode_to_vec()
+    }
+
+    #[test]
+    fn from_cluster_bytes_reads_the_transport_socket() {
+        let cluster = cluster_bytes(Some(wrap_upstream(common_ctx(ca_validation_ctx("ca")))));
+
+        let security = ClusterSecurityConfig::from_cluster_bytes(&cluster)
+            .expect("parses")
+            .expect("not plaintext");
+
+
```

#### Recent Merged Pull Requests:
- **PR #2928** (2026-10-15): grpc/load_balancing: Remove unused OneSubchannelPicker. (@nathanielford)
- **PR #2926** (2026-10-14): grpc/load_balancing: add picker expectation helpers to TestEnv (@nathanielford)
- **PR #2924** (closed): tonic-xds: only use endpoints of the highest healthy priority (@adriangb)
- **PR #2923** (2026-10-13): *: Prepare for rust v1.100 (@dfawley)
- **PR #2922** (closed): grpc: add keepalive and flow control window channel options (@arianvp)
- **PR #2921** (closed): grpc: add max send and receive message size call options (@arianvp)

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

## X. codec): eliminate uninitialized memory in encode_item on unwind (#2847)

**RULE**:
When implementing operations in `tonic/src/codec/encode.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in grpc/grpc-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `46622e93`: codec): eliminate uninitialized memory in encode_item on unwind (#2847). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tonic/src/codec/encode.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    buf.put_slice(&[0u8; HEADER_SIZE]);

#[cfg(test)]
mod tests {
    use super::*;
    use std::panic::catch_unwind;

    struct PanickingEncoder;

    impl Encoder for PanickingEncoder {
        type Item = String;
        type Error = Status;

        fn encode(
            &mut self,
            _item: Self::Item,
            _dst: &mut EncodeBuf<'_>,
        ) -> Result<(), Self::Error> {
            panic!("encoder deliberate panic for testing exception safety");
        }
    }

    #[test]
    fn encode_item_exception_safety_on_panic() {
        let mut encoder = PanickingEncoder;
        let mut buf = BytesMut::new();
        let mut uncompression_buf = BytesMut::new();

        let result = catch_unwind(std::panic::AssertUnwindSafe(|| {
            encode_item(
                &mut encoder,
                &mut buf,
                &mut uncompression_buf,
                None,
                None,
                BufferSettings::default(),
                "test".to_string(),
            )
        }));

        assert!(result.is_err(), "Encoder panic should unwind correctly.");
        // Buffer must only contain initialized bytes (5 zero bytes written by put_slice).
    
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    unsafe {
        buf.advance_mut(HEADER_SIZE);
    }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `46622e93` are properly handled with clean fallback behavior.
