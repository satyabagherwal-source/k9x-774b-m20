# Forensic Learning Record (Deep Inspection): grpc/grpc-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/grpc-grpc-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/grpc/grpc-rust](https://github.com/grpc/grpc-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:22.587Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `grpc/grpc-rust`
- **Description**: A native gRPC client & server implementation with async/await support.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12492 stars

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
use crate::transport::{Transport, TransportBuilder, TransportStream};

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
/// This enum captures the mutua
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

### Core Architecture Module: `examples/generated/helloworld/generated.rs`
```
#[path = "helloworld.u.pb.rs"]
#[allow(nonstandard_style, unused, unreachable_pub)]
#[doc(hidden)]
mod internal_do_not_use_helloworld;
#[allow(nonstandard_style, unused)]
#[doc(inline)]
pub use internal_do_not_use_helloworld::*;
#[allow(nonstandard_style, unused)]
pub mod __unstable {
    pub static HELLOWORLD_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
        descriptor: b"\n\x10helloworld.proto\x12\nhelloworld\"\x1c\n\x0cHelloRequest\x12\x0c\n\x04name\x18\x01 \x01(\t\"\x1d\n\nHelloReply\x12\x0f\n\x07message\x18\x01 \x01(\t2I\n\x07Greeter\x12>\n\x08SayHello\x12\x18.helloworld.HelloRequest\x1a\x16.helloworld.HelloReply\"\x00\x42\x30\n\x1bio.grpc.examples.helloworldB\x0fHelloWorldProtoP\x01\x62\x06proto3",
        deps: &[],
    };
}

```

### Core Architecture Module: `examples/generated/helloworld/helloworld.u.pb.rs`
```
const _: () = ::protobuf::__internal::assert_compatible_gencode_version(
    "4.35.1-release",
);
pub(crate) static mut helloworld__HelloRequest_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr = ::protobuf::__internal::runtime::MiniTableInitPtr(
    ::protobuf::__internal::runtime::MiniTablePtr::dangling(),
);
#[allow(non_camel_case_types)]
pub struct HelloRequest {
    inner: ::protobuf::__internal::runtime::OwnedMessageInner<HelloRequest>,
}
impl ::protobuf::Message for HelloRequest {
    type MessageView<'msg> = HelloRequestView<'msg>;
    type MessageMut<'msg> = HelloRequestMut<'msg>;
}
impl ::std::default::Default for HelloRequest {
    fn default() -> Self {
        Self::new()
    }
}
impl ::std::fmt::Debug for HelloRequest {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
unsafe impl ::std::marker::Sync for HelloRequest {}
unsafe impl ::std::marker::Send for HelloRequest {}
impl ::protobuf::Proxied for HelloRequest {
    type View<'msg> = HelloRequestView<'msg>;
}
impl ::protobuf::__internal::SealedInternal for HelloRequest {}
impl ::protobuf::MutProxied for HelloRequest {
    type Mut<'msg> = HelloRequestMut<'msg>;
}
#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct HelloRequestView<'msg> {
    inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, HelloRequest>,
}
impl<'msg> ::protobuf::__internal::SealedInternal for HelloRequestView<'msg> {}
impl<'msg> ::protobuf::MessageView<'msg> for HelloRequestView<'msg> {
    type Message = HelloRequest;
}
impl ::std::fmt::Debug for HelloRequestView<'_> {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
impl ::std::default::Default for HelloRequestView<'_> {
    fn default() -> HelloRequestView<'static> {
        ::protobuf::__internal::runtime::MessageViewInner::default().into()
    }
}
impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, HelloRequest>>
for HelloRequestView<'msg> {
    fn from(
        inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, HelloRequest>,
    ) -> Self {
        Self { inner }
    }
}
#[allow(dead_code)]
impl<'msg> HelloRequestView<'msg> {
    pub fn to_owned(&self) -> HelloRequest {
        ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
    }
    pub fn name(self) -> ::protobuf::View<'msg, ::protobuf::ProtoString> {
        let str_view = unsafe { self.inner.ptr().get_string_at_index(0, (b"").into()) };
        ::protobuf::ProtoStr::from_utf8_unchecked(unsafe { str_view.as_ref() })
    }
}
unsafe impl ::std::marker::Sync for HelloRequestView<'_> {}
unsafe impl ::std::marker::Send for HelloRequestView<'_> {}
impl<'msg> ::protobuf::AsView for HelloRequestView<'msg> {
    type Proxied = HelloRequest;
    fn as_view(&self) -> ::protobuf::View<'msg, HelloRequest> {
        *self
    }
}
impl<'msg> ::protobuf::IntoView<'msg> for HelloRequestView<'msg> {
    fn into_view<'shorter>(self) -> HelloRequestView<'shorter>
    where
        'msg: 'shorter,
    {
        self
    }
}
impl<'msg> ::protobuf::IntoProxied<HelloRequest> for HelloRequestView<'msg> {
    fn into_proxied(self, _private: ::protobuf::__internal::Private) -> HelloRequest {
        let mut dst = HelloRequest::new();
        assert!(
            unsafe { dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena()) }
        );
        dst
    }
}
impl<'msg> ::protobuf::IntoProxied<HelloRequest> for HelloRequestMut<'msg> {
    fn into_proxied(self, _private: ::protobuf::__internal::Private) -> HelloRequest {
        ::protobuf::IntoProxied::into_proxied(
            ::protobuf::IntoView::into_view(self),
            _private,
        )
    }
}
impl ::protobuf::__internal::EntityType for HelloRequest {
    type Tag = ::protobuf::__internal::entity_tag::MessageTag;
}
impl<'msg> ::protobuf::__internal::EntityType for HelloRequestView<'msg> {
    type Tag = ::protobuf::__internal::entity_tag::ViewProxyTag;
}
impl<'msg> ::protobuf::__internal::EntityType for HelloRequestMut<'msg> {
    type Tag = ::protobuf::__internal::entity_tag::MutProxyTag;
}
#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct HelloRequestMut<'msg> {
    inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest>,
}
impl<'msg> ::protobuf::__internal::SealedInternal for HelloRequestMut<'msg> {}
impl<'msg> ::protobuf::MessageMut<'msg> for HelloRequestMut<'msg> {
    type Message = HelloRequest;
}
impl ::std::fmt::Debug for HelloRequestMut<'_> {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest>>
for HelloRequestMut<'msg> {
    fn from(
        inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest>,
    ) -> Self {
        Self { inner }
    }
}
#[allow(dead_code)]
impl<'msg> HelloRequestMut<'msg> {
    #[doc(hidden)]
    pub fn as_message_mut_inner(
        &mut self,
        _private: ::protobuf::__internal::Private,
    ) -> ::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest> {
        self.inner.reborrow()
    }
    pub fn to_owned(&self) -> HelloRequest {
        ::protobuf::AsView::as_view(self).to_owned()
    }
    pub fn name(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
        let str_view = unsafe { self.inner.ptr().get_string_at_index(0, (b"").into()) };
        ::protobuf::ProtoStr::from_utf8_unchecked(unsafe { str_view.as_ref() })
    }
    pub fn set_name(
        &mut self,
        val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>,
    ) {
        unsafe {
            ::protobuf::__internal::runtime::message_set_string_field(
                ::protobuf::AsMut::as_mut(self).inner,
                0,
                val,
            );
        }
    }
}
unsafe impl ::std::marker::Send for HelloRequestMut<'_> {}
unsafe impl ::std::marker::Sync for HelloRequestMut<'_> {}
impl<'msg> ::protobuf::AsView for HelloRequestMut<'msg> {
    type Proxied = HelloRequest;
    fn as_view(&self) -> ::protobuf::View<'_, HelloRequest> {
        self.inner.as_view().into()
    }
}
impl<'msg> ::protobuf::IntoView<'msg> for HelloRequestMut<'msg> {
    fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, HelloRequest>
    where
        'msg: 'shorter,
    {
        self.inner.as_view().into()
    }
}
impl<'msg> ::protobuf::AsMut for HelloRequestMut<'msg> {
    type MutProxied = HelloRequest;
    fn as_mut(&mut self) -> HelloRequestMut<'msg> {
        self.inner.reborrow().into()
    }
}
impl<'msg> ::protobuf::IntoMut<'msg> for HelloRequestMut<'msg> {
    fn into_mut<'shorter>(self) -> HelloRequestMut<'shorter>
    where
        'msg: 'shorter,
    {
        self
    }
}
#[allow(dead_code)]
impl HelloRequest {
    pub fn new() -> Self {
        Self {
            inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new(),
        }
    }
    #[doc(hidden)]
    pub fn as_message_mut_inner(
        &mut self,
        _private: ::protobuf::__internal::Private,
    ) -> ::protobuf::__internal::runtime::MessageMutInner<'_, HelloRequest> {
        ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
    }
    pub fn as_view(&self) -> HelloRequestView<'_> {
        ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner)
            .into()
    }
    pub fn as_mut(&mut self) -> HelloRequestMut<'_> {
        ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
            .into()
    }
    pub fn name(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
        let str_view = unsafe { self.inner.ptr().get_string_at_index(0, (b"").into()) };
        ::protobuf::ProtoStr::from_utf8_unchecked(unsafe { str_view.as_ref() })
    }
    pub fn set_name(
        &mut self,
        val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>,
    ) {
        unsafe {
            ::protobuf::__internal::runtime::message_set_string_field(
                ::protobuf::AsMut::as_mut(self).inner,
                0,
                val,
            );
        }
    }
}
impl ::std::ops::Drop for HelloRequest {
    #[inline]
    fn drop(&mut self) {}
}
impl ::std::clone::Clone for HelloRequest {
    fn clone(&self) -> Self {
        self.as_view().to_owned()
    }
}
impl ::protobuf::AsView for HelloRequest {
    type Proxied = Self;
    fn as_view(&self) -> HelloRequestView<'_> {
        self.as_view()
    }
}
impl ::protobuf::AsMut for HelloRequest {
    type MutProxied = Self;
    fn as_mut(&mut self) -> HelloRequestMut<'_> {
        self.as_mut()
    }
}
unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for HelloRequest {
    fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
        static ONCE_LOCK: ::std::sync::OnceLock<
            ::protobuf::__internal::runtime::MiniTableInitPtr,
        > = ::std::sync::OnceLock::new();
        unsafe {
            ONCE_LOCK
                .get_or_init(|| {
                    super::helloworld__HelloRequest_msg_init.0 = ::protobuf::__internal::runtime::build_mini_table(
                        "$M1P",
                    );
                    ::protobuf::__internal::runtime::link_mini_table(
                        super::helloworld__HelloRequest_msg_init.0,
                        &[],
                        &[],
                    );
                    ::protobuf::__internal::runtime::MiniTableInitPtr(
                        super::helloworld__HelloRequest_msg_init.0,
                    )
                })
                .0
        }
    }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for HelloRequest {
    fn get_arena(
        &mut self,
        _private: ::proto
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2916** (2026-10-05): **tonic-xds: add connection jitter for newly discovered endpoints**
  *Symptoms*: Tracking issue: #2444  ## Motivation  When a new host joins a cluster, every client learns about it from the same EDS update, at about the same time. Each client adds the host to its load balancer right away, so the host gets connections and first requests from all clients at once. With many clients, that burst can overload a host that has just started.  ## Solution  Have each client wait a random delay before it uses a new endpoint. Each client picks its own delay, so the load on the new host is spread across the delay window instead of arriving all at once.  This is opt-in through `XdsChannelConfig::with_connection_jitter(max_jitter, max_delayed_ratio)`:  - `max_jitter`: each new endpoint waits a random delay in `[0, max_jitter)`. - `max_delayed_ratio`: at most this fraction of a cluster's endpoints may wait at once. Without this limit, a cluster whose endpoints are all new, such as on first discovery, would have no endpoint to send requests to. Endpoints over the limit are used right away, and if removals push the cluster over the limit, waiting endpoints are released early.  A small adapter, `ConnectionJitter`, wraps the stream of endpoint changes that `XdsClusterDiscovery` passes to the load balancer. It delays the insert of each new endpoint, and cancels it if the endpoint is removed first. Every other change passes through unchanged. The built-in connector connects on first use, so delaying the insert also delays the connection. 

- **Issue #2909** (2026-10-04): **xds-client: reconnect block new watch**
  *Symptoms*: WIP

- **Issue #2904** (2026-10-01): **tonic-xds: allow deprecated fetch_update until MSRV >= 1.95**
  *Symptoms*: ## Motivation  CI blocked because of Rust 1.99 clippy now warns on use of deprecated `fetch_upate` in favor of `try_update`. However `fetch_upate` is only stable since 1.95 which is above the current msrv.  ## Solution  `#[allow(deprecated)]` with TODO reminders to delete later when msrv bumps.

- **Issue #2903** (2026-10-02): **grpc/load_balancing: Update error reporting in child manager.**
  *Symptoms*: ## Motivation  When working on cluster manager and weighted target LBs, noticed there was no way to identify which error came from which child. (The errors just get joined together.)   ## Solution  To avoid erasing the error origins, concatenate the child identifier with it's error before they are all joined together.   ### Notes * I think the mapping of error to string was redundant, so I removed it. 
  **Post-Mortem & Fix Analysis**:
  > The CI error is being fixed in #2904. Will re-run and merge after that lands (or is otherwise resolved). (And after review, of course.)

- **Issue #2902** (2026-10-01): **xds-client: Parse message before considering it received**
  *Symptoms*: gRFC A57 and A78 wait until receiving the first message on an ADS streaming before resetting backoff and considerng the ADS stream healthy. Normally when receiving a message in gRPC it will be decoded automatically by the framework, but the xds transport is designed to separate message handling from the raw transport.  While it is highly unlikely to matter in practice, a proto decoding failure would be a very significant error and could repeat for each new stream. Let's include decoding the top-level message as part of the "receive a message" definition. This behavior will match what Java does implicitly, Go may have done accidentally, and C++ does explicitly.  ------  CC @W4lspirit

- **Issue #2900** (2026-09-29): **grpc/lb: simplify and unify tests via new TestEnv**
  *Symptoms*: This change is pretty huge, but I'm not really sure how to break it up.  It unifies all the existing LB policy tests so they use the new `TestEnv`.  Maybe you can also use this for your priority policy tests?  Review-wise: it's probably best to start at test_utils.rs and look at the new stuff, then hopefully the tests themselves are pretty easy to skim since the transformations are mostly mechanical.

- **Issue #2899** (2026-09-30): **grpc/service_config: Handle deserialization edge cases**
  *Symptoms*: ## Motivation  There are a couple of cases where the expected behavior doesn't match the actual behavior:  ### GrpcDuration (The "timeout" field) | Input | Expected per Protobuf JSON spec | Actual (current) result | | :--- | :--- | :--- | | `"+1s"` | `Err` (leading `+` is not valid) | `Ok(1s)` | | `"1.+5s"` | `Err` (`+` is not valid in fractional seconds) | `Ok(1.05s)` | | `"315576000001s"` | `Err` (exceeds Protobuf max of `315_576_000_000s`) | `Ok(315576000001s)` |  ### SerdeU32 (e.g. "maxRequestMessageBytes" field) | Input | Expected per Protobuf JSON spec  | Actual (current) result  | | :--- | :--- | :--- | | `"+5"` | `Err` (leading `+` is not valid in a `uint32` string) | `Ok(5)` | | `1024.0` | `Ok(1024)` (integer-valued floats for int fields allowed) | `Err("invalid type: floating point \`1024.0\`...")` | | `1e3` | `Ok(1000)` (exp. notation for int fields allowed) | `Err("invalid type: floating point \`1000.0\`...")` |  <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution  Small fixes to the parsing, update the test cases to cover this. 

- **Issue #2898** (2026-09-30): **xds-client: Correct grpc.xds_client.connected metric lifecycle**
  *Symptoms*: As defined by gRFC A78: - Set grpc.xds_client.connected to 1 initially for the configured server. - When an ADS stream reconnects after failure, transition connected back to 1 upon receiving the first response on the new stream. - When the worker event loop exits, clear the connected gauge to 0 if it was currently marked healthy.  The tests needed parts of flow_control_tests, so it was integrated with the rest of the unit tests; there didn't seem to be a need for it to be a separate mod. The tests found a bug where command_tx was being held by AdsWorker::run(), and thus AdsWorker::run() would not exit.  ----  CC @W4lspirit 

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

### Incident Patch 3: `62a08c2b` (2026-09-22)
**Commit Message**: grpc/lb: require LbConfig in resolver_update (#2880)

This API change allows policies to not need to handle the "no config"
case. This in practice was only happening in tests (or if `parse_config`
returned `None`, which was the default implementation). It's easy enough
for those LB policies to declare that `()` is their config and return
that from `parse_config`, so I've done that here (for round robin).

**File**: `grpc/src/client/channel.rs` (modified, +1/-1)
```diff
@@ -451,7 +451,7 @@ impl name_resolution::ChannelController for ResolverChannelController {
         let gsb_config = GracefulSwitchLbConfig::new(builder, config);
 
         self.lb_policy
-            .resolver_update(update, Some(&gsb_config), &mut self.lb_channel_controller)
+            .resolver_update(update, &gsb_config, &mut self.lb_channel_controller)
     }
 
     fn parse_service_config(&self, config: &str) -> ParseResult {
```

**File**: `grpc/src/client/load_balancing/child_manager.rs` (modified, +5/-8)
```diff
@@ -80,10 +80,7 @@ pub struct ChildUpdate<'a, T, B: LbPolicyBuilder = Arc<DynLbPolicyBuilder>> {
     /// None, then resolver_update will not be called on the child.  Should
     /// generally be Some for any new children, otherwise they will not be
     /// called.
-    pub child_update: Option<(
-        ResolverUpdate,
-        Option<&'a <B::LbPolicy as LbPolicy>::LbConfig>,
-    )>,
+    pub child_update: Option<(ResolverUpdate, &'a <B::LbPolicy as LbPolicy>::LbConfig)>,
 }
 
 impl<T, B> ChildManager<T, B>
@@ -279,7 +276,7 @@ where
     pub fn resolver_update(
         &mut self,
         resolver_update: ResolverUpdate,
-        config: Option<&<B::LbPolicy as LbPolicy>::LbConfig>,
+        config: &<B::LbPolicy as LbPolicy>::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), Box<dyn Error + Send + Sync>> {
         let mut errs = Vec::with_capacity(self.children.len());
@@ -512,6 +509,7 @@ mod test {
         builder: Arc<DynLbPolicyBuilder>,
         tcc: &mut dyn ChannelController,
     ) -> Result<(), String> {
+        let cfg = Arc::new(()) as DynLbConfig;
         let updates = endpoints.iter().map(|e| ChildUpdate {
             child_identifier: e.clone(),
             child_policy_builder: builder.clone(),
@@ -522,7 +520,7 @@ mod test {
                     service_config: Ok(None),
                     resolution_note: None,
                 },
-                None,
+                &cfg,
             )),
         });
 
@@ -829,7 +827,6 @@ mod test {
                     .unwrap();
                 assert!(!stubdata.requested_work);
                 if lbcfg
-                    .unwrap()
                     .downcast_ref::<Mutex<HashMap<&'static str, ()>>>()
                     .unwrap()
                     .lock()
@@ -896,7 +893,7 @@ mod test {
             ChildUpdate {
                 child_identifier: (),
                 child_policy_builder,
-                child_update: Some((ResolverUpdate::default(), Some(&cfg))),
+                child_update: Some((ResolverUpdate::default(), &cfg)),
             }
         });
         child_manager.update(updates.clone(), &mut tcc).unwrap();
```

**File**: `grpc/src/client/load_balancing/graceful_switch.rs` (modified, +18/-20)
```diff
@@ -40,12 +40,12 @@ use crate::rt::GrpcRuntime;
 #[derive(Debug, Clone)]
 pub struct GracefulSwitchLbConfig {
     child_builder: Arc<DynLbPolicyBuilder>,
-    child_config: Option<DynLbConfig>,
+    child_config: DynLbConfig,
 }
 
 impl GracefulSwitchLbConfig {
     /// Creates a new [`GracefulSwitchLbConfig`].
-    pub fn new(child_builder: Arc<DynLbPolicyBuilder>, child_config: Option<DynLbConfig>) -> Self {
+    pub fn new(child_builder: Arc<DynLbPolicyBuilder>, child_config: DynLbConfig) -> Self {
         Self {
             child_builder,
             child_config,
@@ -73,11 +73,9 @@ impl LbPolicy for GracefulSwitchPolicy {
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&Self::LbConfig>,
+        config: &Self::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
-        let config = config.ok_or("graceful switch received no config")?;
-
         if self.active_child_builder.is_none() {
             // When there are no children yet, the current update immediately
             // becomes the active child.
@@ -91,7 +89,7 @@ impl LbPolicy for GracefulSwitchPolicy {
         children.push(ChildUpdate {
             child_policy_builder: config.child_builder.clone(),
             child_identifier: (),
-            child_update: Some((update, config.child_config.as_ref())),
+            child_update: Some((update, &config.child_config)),
         });
 
         // Include the active child if it does not match the updated child so
@@ -243,7 +241,7 @@ mod test {
 
     fn stub_lb_config(name: &str) -> GracefulSwitchLbConfig {
         let builder = GLOBAL_LB_REGISTRY.get_policy(name).unwrap();
-        GracefulSwitchLbConfig::new(builder, None)
+        GracefulSwitchLbConfig::new(builder, Arc::new(()))
     }
 
     struct TestSubchannelList {
@@ -481,7 +479,7 @@ mod test {
             ..Default::default()
         };
         graceful_switch
-            .resolver_update(update.clone(), Some(&parsed_config), &mut *tcc)
+            .resolver_update(update.clone(), &parsed_config, &mut *tcc)
             .unwrap();
 
         let subchannel = verify_subchannel_creation_from_policy(&mut rx_events);
@@ -525,7 +523,7 @@ mod test {
         };
 
         graceful_switch
-            .resolver_update(update.clone(), Some(&parsed_config), &mut *tcc)
+            .resolver_update(update.clone(), &parsed_config, &mut *tcc)
             .unwrap();
 
         // Subchannel creation and ready
@@ -548,7 +546,7 @@ mod test {
         let new_parsed_config =
             stub_lb_config("stub-gracefulswitch_switching_to_resolver_update-two");
         graceful_switch
-            .resolver_update(update.clone(), Some(&new_parsed_config), &mut *tcc)
+            .resolver_update(update.clone(), &new_parsed_config, &mut *tcc)
             .unwrap();
 
         // Simulate subchannel creation and ready for pending
@@ -588,7 +586,7 @@ mod test {
             ..Default::default()
         };
         graceful_switch
-            .resolver_update(update.clone(), Some(&parsed_config), &mut *tcc)
+            .resolver_update(update.clone(), &parsed_config, &mut *tcc)
             .unwrap();
         let subchannel = verify_subchannel_creation_from_policy(&mut rx_events);
         move_subchannel_to_state(
@@ -605,7 +603,7 @@ mod test {
 
         let parsed_config2 = stub_lb_config("stub-gracefulswitch_two_policies_same_type-one");
         graceful_switch
-            .resolver_update(update.clone(), Some(&parsed_config2), &mut *tcc)
+            .resolver_update(update.clone(), &parsed_config2, &mut *tcc)
             .unwrap();
         let subchannel = verify_subchannel_creation_from_policy(&mut rx_events);
         assert_eq!(&*subchannel.address().address, "127.0.0.1:1234");
@@ -642,7 +640,7 @@ mod test {
 
         // Switch to first one (current)
         graceful_switch
-            .resolver_update(update.clone(), Some(&parsed_config), &mut *tcc)
+            .resolver_update(update.clone(), &parsed_config, &mut *tcc)
             .unwrap();
 
         let current_subchannels = verify_subchannel_creation_from_policy(&mut rx_events);
@@ -655,7 +653,7 @@ mod test {
         let new_parsed_config =
             stub_lb_config("stub-gracefulswitch_current_not_ready_pending_update-two");
         graceful_switch
-            .resolver_update(second_update.clone(), Some(&new_parsed_config), &mut *tcc)
+            .resolver_update(second_update.clone(), &new_parsed_config, &mut *tcc)
             .unwrap();
 
         let second_subchannel = verify_subchannel_creation_from_policy(&mut rx_events);
@@ -699,7 +697,7 @@ mod test {
 
         // Switch to first one (current)
         graceful_switch
-            .resolver_update(update.clone(), Some(&parsed_config), &mut *tcc)
+            .resolver_update(update.clone(), &parsed_config, &mut *tcc)
             .unwrap();
 
         let current_subchannel = verify_subchannel_cre
```

**File**: `grpc/src/client/load_balancing/lazy.rs` (modified, +13/-7)
```diff
@@ -63,7 +63,7 @@ enum Inner<T: LbPolicyBuilder> {
 struct Pending<T: LbPolicyBuilder> {
     delegate_builder: T,
     options: LbPolicyOptions,
-    latest_state: Option<(ResolverUpdate, Option<<T::LbPolicy as LbPolicy>::LbConfig>)>,
+    latest_state: Option<(ResolverUpdate, <T::LbPolicy as LbPolicy>::LbConfig)>,
 }
 
 impl<T: LbPolicyBuilder> Lazy<T> {
@@ -97,13 +97,13 @@ where
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&Self::LbConfig>,
+        config: &Self::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
         match &mut self.inner {
             Inner::Void => unreachable!(),
             Inner::Pending(pending) => {
-                pending.latest_state = Some((update, config.cloned()));
+                pending.latest_state = Some((update, config.clone()));
                 Ok(())
             }
             Inner::Built(delegate) => delegate.resolver_update(update, config, channel_controller),
@@ -139,7 +139,7 @@ where
         // If there is a pending update, send it now.  Otherwise just exit_idle.
         if let Some((update, config)) = latest_state {
             if delegate
-                .resolver_update(update, config.as_ref(), channel_controller)
+                .resolver_update(update, &config, channel_controller)
                 .is_err()
             {
                 // Notify the channel that it should try to retrieve a new update.
@@ -222,7 +222,7 @@ mod tests {
         assert_eq!(lb_state.connectivity_state, ConnectivityState::Idle);
 
         // Give lazy an update.
-        lazy.resolver_update(ResolverUpdate::default(), None, &mut cc)
+        lazy.resolver_update(ResolverUpdate::default(), &Arc::new(()), &mut cc)
             .unwrap();
 
         // Ensure delegate is not built yet.
@@ -263,7 +263,7 @@ mod tests {
         };
 
         // Give lazy an update.
-        lazy.resolver_update(ResolverUpdate::default(), None, &mut cc)
+        lazy.resolver_update(ResolverUpdate::default(), &Arc::new(()), &mut cc)
             .unwrap();
 
         // Call pick on the picker.
@@ -423,6 +423,12 @@ mod tests {
         fn name(&self) -> &'static str {
             "mock"
         }
+        fn parse_config(
+            &self,
+            _config: &crate::client::load_balancing::ParsedJsonLbConfig,
+        ) -> Result<<Self::LbPolicy as LbPolicy>::LbConfig, String> {
+            Ok(())
+        }
     }
 
     impl LbPolicy for MockPolicy {
@@ -431,7 +437,7 @@ mod tests {
         fn resolver_update(
             &mut self,
             _update: ResolverUpdate,
-            _config: Option<&()>,
+            _config: &(),
             _channel_controller: &mut dyn ChannelController,
         ) -> Result<(), String> {
             self.tx.send(MockEvent::ResolverUpdate).unwrap();
```

**File**: `grpc/src/client/load_balancing/mod.rs` (modified, +4/-6)
```diff
@@ -79,9 +79,7 @@ pub trait LbPolicyBuilder: Send + Sync + Debug + 'static {
     fn parse_config(
         &self,
         _config: &ParsedJsonLbConfig,
-    ) -> Result<Option<<Self::LbPolicy as LbPolicy>::LbConfig>, String> {
-        Ok(None)
-    }
+    ) -> Result<<Self::LbPolicy as LbPolicy>::LbConfig, String>;
 }
 
 /// An LB policy instance.
@@ -97,7 +95,7 @@ pub trait LbPolicy: Send + Sync + Debug + 'static {
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&Self::LbConfig>,
+        config: &Self::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String>;
 
@@ -448,7 +446,7 @@ impl<T: LbPolicy + ?Sized> LbPolicy for Box<T> {
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&Self::LbConfig>,
+        config: &Self::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
         (**self).resolver_update(update, config, channel_controller)
@@ -477,7 +475,7 @@ impl<B: LbPolicyBuilder + ?Sized> LbPolicyBuilder for Arc<B> {
     fn parse_config(
         &self,
         config: &ParsedJsonLbConfig,
-    ) -> Result<Option<<B::LbPolicy as LbPolicy>::LbConfig>, String> {
+    ) -> Result<<B::LbPolicy as LbPolicy>::LbConfig, String> {
         (**self).parse_config(config)
     }
 }
```

**File**: `grpc/src/client/load_balancing/pick_first.rs` (modified, +16/-16)
```diff
@@ -61,13 +61,13 @@ pub static POLICY_NAME: &str = "pick_first";
 type ShufflerFn = dyn Fn(&mut [Endpoint]) + Send + Sync + 'static;
 
 #[derive(Debug, serde::Deserialize, Clone, Default)]
-pub struct PickFirstConfig {
+pub(crate) struct PickFirstConfig {
     #[serde(default, rename = "shuffleAddressList")]
-    pub shuffle_address_list: bool,
+    shuffle_address_list: bool,
 }
 
 #[derive(Debug)]
-pub struct PickFirstBuilder {}
+pub(crate) struct PickFirstBuilder {}
 
 impl LbPolicyBuilder for PickFirstBuilder {
     type LbPolicy = PickFirstPolicy;
@@ -92,17 +92,17 @@ impl LbPolicyBuilder for PickFirstBuilder {
         POLICY_NAME
     }
 
-    fn parse_config(&self, config: &ParsedJsonLbConfig) -> Result<Option<PickFirstConfig>, String> {
+    fn parse_config(&self, config: &ParsedJsonLbConfig) -> Result<PickFirstConfig, String> {
         let config: PickFirstConfig = config.convert_to().map_err(|e| e.to_string())?;
-        Ok(Some(config))
+        Ok(config)
     }
 }
 
 pub(crate) fn reg() {
     super::GLOBAL_LB_REGISTRY.add_builder(PickFirstBuilder {});
 }
 
-pub struct PickFirstPolicy {
+pub(crate) struct PickFirstPolicy {
     work_scheduler: Arc<dyn WorkScheduler>,
     runtime: GrpcRuntime,
     connectivity_state: ConnectivityState,
@@ -401,11 +401,11 @@ impl PickFirstPolicy {
     fn compile_address(
         &mut self,
         mut endpoints: Vec<Endpoint>,
-        config: Option<&PickFirstConfig>,
+        config: &PickFirstConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Vec<Address> {
         // Shuffle endpoints if enabled.
-        if config.is_some_and(|c| c.shuffle_address_list) {
+        if config.shuffle_address_list {
             (self.shuffler)(&mut endpoints);
         }
 
@@ -542,7 +542,7 @@ impl LbPolicy for PickFirstPolicy {
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&Self::LbConfig>,
+        config: &Self::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
         self.timer = None;
@@ -882,7 +882,7 @@ mod test {
                     endpoints: Ok(endpoints),
                     ..Default::default()
                 },
-                None,
+                &PickFirstConfig::default(),
                 controller.as_mut(),
             )
             .unwrap();
@@ -1015,7 +1015,7 @@ mod test {
                     endpoints: Ok(endpoints_new),
                     ..Default::default()
                 },
-                None,
+                &PickFirstConfig::default(),
                 controller.as_mut(),
             )
             .unwrap();
@@ -1115,7 +1115,7 @@ mod test {
                     endpoints: Ok(endpoints),
                     ..Default::default()
                 },
-                Some(&config),
+                &config,
                 controller.as_mut(),
             )
             .unwrap();
@@ -1186,7 +1186,7 @@ mod test {
                     endpoints: Ok(endpoints),
                     ..Default::default()
                 },
-                None,
+                &PickFirstConfig::default(),
                 controller.as_mut(),
             )
             .unwrap();
@@ -1226,7 +1226,7 @@ mod test {
                 endpoints: Ok(vec![]),
                 ..Default::default()
             },
-            None,
+            &PickFirstConfig::default(),
             controller.as_mut(),
         );
 
@@ -1474,7 +1474,7 @@ mod test {
                     endpoints: Ok(endpoints_updated),
                     ..Default::default()
                 },
-                None,
+                &PickFirstConfig::default(),
                 controller.as_mut(),
             )
             .unwrap();
@@ -1512,7 +1512,7 @@ mod test {
                     endpoints: Err(resolver_error.clone()),
                     ..Default::default()
                 },
-                None,
+                &PickFirstConfig::default(),
                 controller.as_mut(),
             )
             .unwrap();
```

**File**: `grpc/src/client/load_balancing/registry.rs` (modified, +6/-8)
```diff
@@ -102,10 +102,10 @@ impl<T: LbPolicyBuilder> LbPolicyBuilder for DynAdapter<T> {
         self.0.name()
     }
 
-    fn parse_config(&self, config: &ParsedJsonLbConfig) -> Result<Option<DynLbConfig>, String> {
+    fn parse_config(&self, config: &ParsedJsonLbConfig) -> Result<DynLbConfig, String> {
         // Call the real parse config and then wrap its result in a DynLbConfig if it is Ok(Some)
         let cfg = self.0.parse_config(config)?;
-        Ok(cfg.map(|c| Arc::new(c) as DynLbConfig))
+        Ok(Arc::new(cfg) as DynLbConfig)
     }
 }
 
@@ -115,14 +115,12 @@ impl<T: LbPolicy> LbPolicy for DynAdapter<T> {
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&DynLbConfig>,
+        config: &DynLbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
-        let config = config.map(|c| {
-            c.downcast_ref::<T::LbConfig>().unwrap_or_else(|| {
-                panic!("LB config type should be {}", type_name::<T::LbConfig>())
-            })
-        });
+        let config = config
+            .downcast_ref::<T::LbConfig>()
+            .unwrap_or_else(|| panic!("LB config type should be {}", type_name::<T::LbConfig>()));
         self.0.resolver_update(update, config, channel_controller)
     }
 
```

**File**: `grpc/src/client/load_balancing/round_robin.rs` (modified, +28/-12)
```diff
@@ -43,14 +43,18 @@ use crate::client::load_balancing::WorkData;
 use crate::client::load_balancing::child_manager::ChildManager;
 use crate::client::load_balancing::child_manager::ChildUpdate;
 use crate::client::load_balancing::pick_first::PickFirstBuilder;
+use crate::client::load_balancing::pick_first::PickFirstConfig;
 use crate::client::name_resolution::Endpoint;
 use crate::client::name_resolution::ResolverUpdate;
 
 pub static POLICY_NAME: &str = "round_robin";
 static START: Once = Once::new();
 
+#[derive(Debug, Default)]
+pub(crate) struct RoundRobinConfig(PickFirstConfig);
+
 #[derive(Debug)]
-pub struct RoundRobinBuilder {}
+pub(crate) struct RoundRobinBuilder {}
 
 impl LbPolicyBuilder for RoundRobinBuilder {
     type LbPolicy = RoundRobinPolicy;
@@ -63,10 +67,17 @@ impl LbPolicyBuilder for RoundRobinBuilder {
     fn name(&self) -> &'static str {
         POLICY_NAME
     }
+
+    fn parse_config(
+        &self,
+        _config: &super::ParsedJsonLbConfig,
+    ) -> Result<<Self::LbPolicy as LbPolicy>::LbConfig, String> {
+        Ok(RoundRobinConfig::default())
+    }
 }
 
 #[derive(Debug)]
-pub struct RoundRobinPolicy {
+pub(crate) struct RoundRobinPolicy {
     child_manager: ChildManager<Endpoint, PickFirstBuilder>,
 }
 
@@ -117,6 +128,7 @@ impl RoundRobinPolicy {
     fn handle_resolver_error(
         &mut self,
         resolver_update: ResolverUpdate,
+        config: &RoundRobinConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
         let err = format!(
@@ -131,22 +143,22 @@ impl RoundRobinPolicy {
         // Forward the error to each child, ignoring their responses.
         let _ = self
             .child_manager
-            .resolver_update(resolver_update, None, channel_controller);
+            .resolver_update(resolver_update, &config.0, channel_controller);
         self.update_picker(channel_controller);
         Err(err)
     }
 }
 
 impl LbPolicy for RoundRobinPolicy {
-    type LbConfig = ();
+    type LbConfig = RoundRobinConfig;
     fn resolver_update(
         &mut self,
         update: ResolverUpdate,
-        config: Option<&Self::LbConfig>,
+        config: &Self::LbConfig,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
         if update.endpoints.is_err() {
-            return self.handle_resolver_error(update, channel_controller);
+            return self.handle_resolver_error(update, config, channel_controller);
         }
 
         // Shard the update by endpoint.
@@ -160,7 +172,7 @@ impl LbPolicy for RoundRobinPolicy {
             ChildUpdate {
                 child_identifier: e.clone(),
                 child_policy_builder: PickFirstBuilder {},
-                child_update: Some((update, None)),
+                child_update: Some((update, &config.0)),
             }
         });
         self.child_manager
@@ -285,15 +297,15 @@ mod test {
 
     // Sends a resolver update to the LB policy with the specified endpoint.
     fn send_resolver_update_to_policy(
-        lb_policy: &mut impl LbPolicy,
+        lb_policy: &mut RoundRobinPolicy,
         endpoints: Vec<Endpoint>,
         tcc: &mut dyn ChannelController,
     ) {
         let update = ResolverUpdate {
             endpoints: Ok(endpoints),
             ..Default::default()
         };
-        let _ = lb_policy.resolver_update(update, None, tcc);
+        let _ = lb_policy.resolver_update(update, &RoundRobinConfig::default(), tcc);
     }
 
     fn send_resolver_error_to_policy(
@@ -305,7 +317,7 @@ mod test {
             endpoints: Err(err),
             ..Default::default()
         };
-        let _ = lb_policy.resolver_update(update, None, tcc);
+        let _ = lb_policy.resolver_update(update, &RoundRobinConfig::default(), tcc);
     }
 
     // Simulates a state change of `subchannel` and delivers the resulting work
@@ -684,7 +696,7 @@ mod test {
             endpoints: Ok(vec![]),
             ..Default::default()
         };
-        let _ = lb_policy.resolver_update(update, None, tcc);
+        let _ = lb_policy.resolver_update(update, &RoundRobinConfig::default(), tcc);
         let want_error = "Received empty address list from the name resolver";
         verify_transient_failure_picker(&mut rx_events, want_error.to_string());
         verify_resolution_request(&mut rx_events);
@@ -961,7 +973,11 @@ mod test {
             endpoints: Ok(vec![]),
             ..Default::default()
         };
-        assert!(lb_policy.resolver_update(update, None, tcc).is_err());
+        assert!(
+            lb_policy
+                .resolver_update(update, &RoundRobinConfig::default(), tcc)
+                .is_err()
+        );
         verify_transient_failure_picker(
             &mut rx_events,
             "Received empty address list from the name resolver".to_string(),
```

---

### Incident Patch 4: `3a60b544` (2026-09-22)
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

---

### Incident Patch 5: `bdd3f147` (2026-09-16)
**Commit Message**: fix(types): Serialize `BadRequest::FieldViolation` `reason` and `localized_message` (#2461)

## Motivation

fix #2460

Fields `reason` and `localized_message` from
`BadRequest::FieldViolation` are not serialized into the underlying
protobuf message and therefore never make it onto the wire.

## Solution

Fix the conversion from `FieldViolation` to the prost-generated
`pb::bad_request::FieldViolation` by explicitly forwarding both the
`reason` and `localized_message` fields instead of leaving them at their
default values.

A new test is added to ensure that behavior.

**File**: `tonic-types/src/richer_error/std_messages/bad_request.rs` (modified, +16/-10)
```diff
@@ -77,7 +77,8 @@ impl From<FieldViolation> for pb::bad_request::FieldViolation {
         pb::bad_request::FieldViolation {
             field: value.field,
             description: value.description,
-            ..Default::default()
+            reason: value.reason,
+            localized_message: value.localized_message.map(Into::into),
         }
     }
 }
@@ -183,12 +184,12 @@ impl From<BadRequest> for pb::BadRequest {
 #[cfg(test)]
 mod tests {
     use super::super::super::{FromAny, IntoAny};
-    use super::BadRequest;
+    use super::{BadRequest, FieldViolation, LocalizedMessage};
 
     #[test]
     fn gen_bad_request() {
-        let mut br_details = BadRequest::new(Vec::new());
-        let formatted = format!("{br_details:?}");
+        let empty_br_details = BadRequest::new(Vec::new());
+        let formatted = format!("{empty_br_details:?}");
 
         let expected = "BadRequest { field_violations: [] }";
 
@@ -198,17 +199,22 @@ mod tests {
         );
 
         assert!(
-            br_details.is_empty(),
+            empty_br_details.is_empty(),
             "empty BadRequest returns 'false' from .is_empty()"
         );
 
-        br_details
-            .add_violation("field_a", "description_a")
-            .add_violation("field_b", "description_b");
+        let mut br_details = BadRequest::new(vec![FieldViolation {
+            field: "field_a".to_string(),
+            description: "description_a".to_string(),
+            reason: "REASON".to_string(),
+            localized_message: Some(LocalizedMessage::new("en-US", "localized error")),
+        }]);
+
+        br_details.add_violation("field_b", "description_b");
 
         let formatted = format!("{br_details:?}");
 
-        let expected_filled = "BadRequest { field_violations: [FieldViolation { field: \"field_a\", description: \"description_a\", reason: \"\", localized_message: None }, FieldViolation { field: \"field_b\", description: \"description_b\", reason: \"\", localized_message: None }] }";
+        let expected_filled = "BadRequest { field_violations: [FieldViolation { field: \"field_a\", description: \"description_a\", reason: \"REASON\", localized_message: Some(LocalizedMessage { locale: \"en-US\", message: \"localized error\" }) }, FieldViolation { field: \"field_b\", description: \"description_b\", reason: \"\", localized_message: None }] }";
 
         assert!(
             formatted.eq(expected_filled),
@@ -223,7 +229,7 @@ mod tests {
         let gen_any = br_details.into_any();
         let formatted = format!("{gen_any:?}");
 
-        let expected = "Any { type_url: \"type.googleapis.com/google.rpc.BadRequest\", value: [10, 24, 10, 7, 102, 105, 101, 108, 100, 95, 97, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 97, 10, 24, 10, 7, 102, 105, 101, 108, 100, 95, 98, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 98] }";
+        let expected = "Any { type_url: \"type.googleapis.com/google.rpc.BadRequest\", value: [10, 58, 10, 7, 102, 105, 101, 108, 100, 95, 97, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 97, 26, 6, 82, 69, 65, 83, 79, 78, 34, 24, 10, 5, 101, 110, 45, 85, 83, 18, 15, 108, 111, 99, 97, 108, 105, 122, 101, 100, 32, 101, 114, 114, 111, 114, 10, 24, 10, 7, 102, 105, 101, 108, 100, 95, 98, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 98] }";
 
         assert!(
             formatted.eq(expected),
```

---

### Incident Patch 6: `ce328eb0` (2026-09-16)
**Commit Message**: Fix Code-QL breakage with CI configuration. (#2870)

## Motivation

The repo has a `Security and Quality` error flag (see below) that is
being caused by Code-QL being broken. This was broken when we migrated
from the hyperium organization to the grpc organization.

<img width="3282" height="1542" alt="image"
src="https://github.com/user-attachments/assets/fdf97471-ad7b-4410-98f2-92329ec3c817"
/>


## Solution

Add configuration to run Code QL over the github Actions and the rust
code. This is parity with what the Tonic library had before the org
move. There is an alternative method to fix this in a 'basic' form, but
requires an organization admin.

**File**: `.github/workflows/CI.yml` (modified, +24/-0)
```diff
@@ -34,6 +34,30 @@ jobs:
     - uses: actions/checkout@v6
     - run: python3 tools/check_license.py
 
+  codeql:
+    name: CodeQL
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      security-events: write
+    strategy:
+      fail-fast: false
+      matrix:
+        language: [actions, rust]
+    steps:
+      - uses: actions/checkout@v6
+
+      - name: Initialize CodeQL
+        uses: github/codeql-action/init@v3
+        with:
+          languages: ${{ matrix.language }}
+          build-mode: none
+
+      - name: Perform CodeQL Analysis
+        uses: github/codeql-action/analyze@v3
+        with:
+          category: "/language:${{ matrix.language }}"
+
   build-protoc-plugin:
     runs-on: ${{ matrix.os }}
     strategy:
```

---

### Incident Patch 7: `079db1a8` (2026-09-11)
**Commit Message**: grpc: fix broken rustdoc links in the server module (#2865)

Fix reference to private interceptor and remove now deleted call. 

We may need to revisit making `Identity` and `Interceptor` public at
some point, since we expose a private symbol `Identity` via
`ServerBuilder` public. Ideally, this may require making interceptors
pub instead of pub crate

**File**: `grpc/src/server/mod.rs` (modified, +1/-2)
```diff
@@ -37,7 +37,6 @@
 //!
 //! # Additional Types
 //!
-//! - **[`Call`]:** Represents an incoming RPC accepted by a [`Listener`].
 //! - **[`SendStream`] / [`RecvStream`]:** Represent the sending and receiving
 //!   sides of a server-side RPC.
 //! - **[`RequestHeaders`]:** Represents gRPC headers sent by the client to
@@ -196,7 +195,7 @@ impl GracefulCoordinator {
 }
 
 impl Server {
-    /// Creates a new [`ServerBuilder`] with an [`Identity`] (no-op) interceptor.
+    /// Creates a new [`ServerBuilder`] with a no-op interceptor.
     pub fn builder() -> ServerBuilder<Identity> {
         ServerBuilder::new()
     }
```

---

### Incident Patch 8: `a850ef1f` (2026-09-10)
**Commit Message**: fix(grpc): remove reference to private RouterBuilder in Identity doc (#2861)

Remove reference to private RouteBuilder altogether from Identity , treating it like an independent entity.
Update the Server::Builder docs pointing out to some details of the Identity interceptor.

**File**: `grpc/src/server/interceptor.rs` (modified, +0/-3)
```diff
@@ -89,9 +89,6 @@ pub trait HandleExt: Handle + Sized {
 impl<T: Handle + Sized> HandleExt for T {}
 
 /// A no-op interceptor that simply delegates to the next handler.
-///
-/// This is the default interceptor used by `RouterBuilder` when no interceptor
-/// has been added.
 #[derive(Clone, Copy)]
 pub struct Identity;
 
```

**File**: `grpc/src/server/mod.rs` (modified, +9/-5)
```diff
@@ -49,6 +49,7 @@ use std::future::Future;
 use std::pin::Pin;
 use std::sync::Arc;
 
+use tokio::sync::watch;
 use tonic::async_trait;
 
 use crate::core::ConnectionInfo;
@@ -63,6 +64,9 @@ pub(crate) mod interceptor;
 pub(crate) mod router;
 pub mod service;
 
+use builder::ServerBuilder;
+use interceptor::Identity;
+
 /// Settings to configure RPCs sent using the [`Handle`] trait.
 ///
 /// Most applications will not need this type, and will set options via the
@@ -153,12 +157,12 @@ pub trait Transport: Send + 'static {
 /// Each connection is watched via `watch()`. When `shutdown()` is called,
 /// all watched connections receive a `graceful_shutdown()` signal.
 struct GracefulCoordinator {
-    tx: tokio::sync::watch::Sender<()>,
+    tx: watch::Sender<()>,
 }
 
 impl GracefulCoordinator {
     fn new() -> Self {
-        let (tx, _) = tokio::sync::watch::channel(());
+        let (tx, _) = watch::channel(());
         Self { tx }
     }
 
@@ -192,9 +196,9 @@ impl GracefulCoordinator {
 }
 
 impl Server {
-    /// Creates a [`ServerBuilder`](builder::ServerBuilder) with no interceptors.
-    pub fn builder() -> builder::ServerBuilder<interceptor::Identity> {
-        builder::ServerBuilder::new()
+    /// Creates a new [`ServerBuilder`] with an [`Identity`] (no-op) interceptor.
+    pub fn builder() -> ServerBuilder<Identity> {
+        ServerBuilder::new()
     }
 
     /// Creates a new server with the given handler and runtime.
```

---

### Incident Patch 9: `900ff055` (2026-09-10)
**Commit Message**: grpc-google: fix cargo toml for publishing (#2854)

This change also unexports the `TokenProvider` trait, which was only
used to mock credential-fetching logic in tests.

**File**: `grpc-google/Cargo.toml` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grpc-google"
-version = "0.0.0-alpha"
+version = "0.10.0"
 edition = "2024"
 authors = ["gRPC authors"]
 license = "MIT"
@@ -14,9 +14,9 @@ allowed_external_types = ["grpc::*"]
 
 [dependencies]
 google-cloud-auth = { version = "1.9", default-features = false }
-grpc = { path = "../grpc", default-features = false }
+grpc = { version = "0.10.0", path = "../grpc", default-features = false }
 tonic = { version = "0.14.6", path = "../tonic", default-features = false }
-trait-variant = "0.1"
+trait-variant = { version = "0.1", default-features = false }
 
 [dev-dependencies]
 tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

**File**: `grpc-google/src/lib.rs` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ const DEFAULT_CLOUD_PLATFORM_SCOPE: &str = "https://www.googleapis.com/auth/clou
 
 /// An abstraction for fetching authentication tokens.
 #[trait_variant::make(Send)]
-pub trait TokenProvider: Sync + Debug + 'static {
+trait TokenProvider: Sync + Debug + 'static {
     /// Returns an authentication token.
     async fn get_token(&self) -> Result<String, String>;
 }
```

---

### Incident Patch 10: `53733ecb` (2026-09-10)
**Commit Message**: feat(grpc): add ServerBuilder, registration, interceptors, and routing (#2789)

Introduce the server-side handle/router API for building a gRPC `Server`
from a fluent builder.

- ServerBuilder: fluent construction via `Server::builder()`, with
`add_service`, `interceptor`and `build`.
- Service + ServiceExt: `Service` trait for method registration, plus
`with_interceptor` to wrap all of a service's methods
(InterceptedService).
- Interceptors: `Intercept` trait, no-op `Identity`, and
`InterceptExt::chain` for composing interceptors into an
`InterceptorChain` (first added runs outermost).
- Descriptors: `ServiceDescriptor`, `MethodDescriptor`, and
`MethodType`.
- Routing: `RouterBuilder` maps method paths to `DynHandle`s.
- Options: `ServerOptions` currently empty, but a kitchen sink for
options.

**File**: `grpc/src/server/builder.rs` (added, +284/-0)
```diff
@@ -0,0 +1,284 @@
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Permission is hereby granted, free of charge, to any person obtaining a copy
+ * of this software and associated documentation files (the "Software"), to
+ * deal in the Software without restriction, including without limitation the
+ * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
+ * sell copies of the Software, and to permit persons to whom the Software is
+ * furnished to do so, subject to the following conditions:
+ *
+ * The above copyright notice and this permission notice shall be included in
+ * all copies or substantial portions of the Software.
+ *
+ * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+ * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+ * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+ * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+ * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+ * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
+ * IN THE SOFTWARE.
+ *
+ */
+
+use crate::rt::GrpcRuntime;
+use crate::server::Server;
+use crate::server::interceptor::Identity;
+use crate::server::interceptor::Intercept;
+use crate::server::interceptor::InterceptorChain;
+use crate::server::router::RouterBuilder;
+use crate::server::service::Service;
+
+/// A fluent builder for constructing a [`Server`].
+///
+/// Register services with [`add_service()`](ServerBuilder::add_service) and add
+/// global interceptors with [`interceptor()`](ServerBuilder::interceptor), then
+/// finish with [`build()`](ServerBuilder::build).
+pub struct ServerBuilder<I = Identity> {
+    router: RouterBuilder<I>,
+}
+
+// ---------------------------------------------------------------------------
+// Constructor
+// ---------------------------------------------------------------------------
+
+impl ServerBuilder<Identity> {
+    /// Creates a new `ServerBuilder` with no interceptors.
+    pub(crate) fn new() -> Self {
+        ServerBuilder {
+            router: RouterBuilder::new(),
+        }
+    }
+}
+
+// ---------------------------------------------------------------------------
+// Setters — available on any ServerBuilder<I>
+// ---------------------------------------------------------------------------
+
+impl<I: Intercept + Clone + Send + Sync + 'static> ServerBuilder<I> {
+    /// Adds a global interceptor applied to every registered method.
+    ///
+    /// May be called repeatedly to compose multiple interceptors.
+    pub fn interceptor<J>(self, next: J) -> ServerBuilder<InterceptorChain<I, J>>
+    where
+        J: Intercept + Clone + Send + Sync + 'static,
+    {
+        ServerBuilder {
+            router: self.router.chain_interceptor(next),
+        }
+    }
+
+    /// Registers all methods from a [`Service`].
+    pub fn add_service(mut self, service: impl Service) -> Self {
+        self.router = self.router.add_service(service);
+        self
+    }
+
+    /// Builds the [`Server`] with the explicitly provided runtime.
+    ///
+    /// Always available. When the `_runtime-tokio` feature is enabled,
+    /// [`build()`](ServerBuilder::build) can be used instead to use the default
+    /// Tokio runtime.
+    pub fn build_with_runtime(self, runtime: GrpcRuntime) -> Server {
+        Server::new(self.router.build(), runtime)
+    }
+}
+
+// ---------------------------------------------------------------------------
+// build() — uses the default runtime when _runtime-tokio is enabled
+// ---------------------------------------------------------------------------
+
+#[cfg(feature = "_runtime-tokio")]
+impl<I: Intercept + Clone + Send + Sync + 'static> ServerBuilder<I> {
+    /// Builds the [`Server`] using the default Tokio runtime.
+    ///
+    /// Available only when the `_runtime-tokio` feature is enabled. Without it,
+    /// use [`build_with_runtime()`](ServerBuilder::build_with_runtime).
+    pub fn build(self) -> Server {
+        Server::new(self.router.build(), crate::rt::default_runtime())
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use std::sync::Arc;
+
+    use tokio::sync::Mutex;
+
+    use crate::core::RecvMessage;
+    use crate::server::CallOptions;
+    use crate::server::DynHandle;
+    use crate::server::Handle;
+    use crate::server::RecvStream;
+    use crate::server::RequestHeaders;
+    use crate::server::ResponseStreamItem;
+    use crate::server::SendOptions;
+    use crate::server::SendStream;
+    use crate::server::Server;
+    use crate::server::Trailers;
+    use crate::server::descriptor::MethodDescriptor;
+    use crate::server::descriptor::ServiceDescriptor;
+    use crate::server::interceptor::Intercept;
+    use crate::server::interceptor::InterceptExt;
+    use crate::server::service::Service;
+
+    struct MockSendStream;
+    impl SendStream for MockSendStream {
+        async fn send<'a>(
+           
```

**File**: `grpc/src/server/descriptor.rs` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Permission is hereby granted, free of charge, to any person obtaining a copy
+ * of this software and associated documentation files (the "Software"), to
+ * deal in the Software without restriction, including without limitation the
+ * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
+ * sell copies of the Software, and to permit persons to whom the Software is
+ * furnished to do so, subject to the following conditions:
+ *
+ * The above copyright notice and this permission notice shall be included in
+ * all copies or substantial portions of the Software.
+ *
+ * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+ * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+ * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+ * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+ * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+ * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
+ * IN THE SOFTWARE.
+ *
+ */
+
+/// Pure metadata about a single gRPC method.
+///
+/// This is a data class — it carries no handler logic. It describes what a
+/// method looks like (its path) without specifying how it's implemented.
+#[derive(Debug, Clone)]
+#[non_exhaustive]
+pub struct MethodDescriptor {
+    /// Full method path, e.g., `"/helloworld.Greeter/SayHello"`.
+    full_path: String,
+}
+
+impl MethodDescriptor {
+    /// Creates a descriptor for the given method path.
+    pub fn new(full_path: impl Into<String>) -> Self {
+        Self {
+            full_path: full_path.into(),
+        }
+    }
+
+    /// Returns the full method path, e.g., `"/helloworld.Greeter/SayHello"`.
+    pub fn full_path(&self) -> &str {
+        &self.full_path
+    }
+
+    /// Consumes the descriptor, returning its owned full method path.
+    pub fn into_full_path(self) -> String {
+        self.full_path
+    }
+}
+
+/// Pure metadata about a gRPC service.
+///
+/// This is a data class — it carries no handler logic. It describes what a
+/// service looks like (its name and the methods it contains) without
+/// specifying how they're implemented.
+#[derive(Debug, Clone)]
+#[non_exhaustive]
+pub struct ServiceDescriptor {
+    /// Fully qualified service name, e.g., `"helloworld.Greeter"`.
+    name: String,
+    /// Descriptors for all methods in this service.
+    methods: Vec<MethodDescriptor>,
+}
+
+impl ServiceDescriptor {
+    /// Creates a descriptor for the given service name and methods.
+    pub fn new(name: impl Into<String>, methods: Vec<MethodDescriptor>) -> Self {
+        Self {
+            name: name.into(),
+            methods,
+        }
+    }
+
+    /// Returns the fully qualified service name, e.g., `"helloworld.Greeter"`.
+    pub fn name(&self) -> &str {
+        &self.name
+    }
+
+    /// Returns the descriptors for all methods in this service.
+    pub fn methods(&self) -> &[MethodDescriptor] {
+        &self.methods
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn method_descriptor_exposes_path() {
+        let desc = MethodDescriptor::new("/pkg.Svc/Method");
+        assert_eq!(desc.full_path(), "/pkg.Svc/Method");
+    }
+
+    #[test]
+    fn method_descriptor_new_accepts_string() {
+        let desc = MethodDescriptor::new("/pkg.Svc/Method".to_string());
+        assert_eq!(desc.full_path(), "/pkg.Svc/Method");
+    }
+
+    #[test]
+    fn method_descriptor_into_full_path() {
+        let desc = MethodDescriptor::new("/pkg.Svc/Method");
+        assert_eq!(desc.into_full_path(), "/pkg.Svc/Method");
+    }
+
+    #[test]
+    fn method_descriptor_clone() {
+        let desc = MethodDescriptor::new("/pkg.Svc/Method");
+        let cloned = desc.clone();
+        assert_eq!(cloned.full_path(), desc.full_path());
+    }
+
+    #[test]
+    fn service_descriptor_exposes_name_and_methods() {
+        let desc = ServiceDescriptor::new(
+            "pkg.Svc",
+            vec![
+                MethodDescriptor::new("/pkg.Svc/M1"),
+                MethodDescriptor::new("/pkg.Svc/M2"),
+            ],
+        );
+        assert_eq!(desc.name(), "pkg.Svc");
+        assert_eq!(desc.methods().len(), 2);
+        assert_eq!(desc.methods()[0].full_path(), "/pkg.Svc/M1");
+    }
+
+    #[test]
+    fn service_descriptor_empty_methods() {
+        let desc = ServiceDescriptor::new("pkg.Empty", vec![]);
+        assert_eq!(desc.methods().len(), 0);
+    }
+
+    #[test]
+    fn service_descriptor_clone() {
+        let desc = ServiceDescriptor::new("pkg.Svc", vec![MethodDescriptor::new("/pkg.Svc/M1")]);
+        let cloned = desc.clone();
+        assert_eq!(cloned.name(), desc.name());
+        assert_eq!(cloned.methods().len(), desc.methods().len());
+    }
+}
```

**File**: `grpc/src/server/interceptor.rs` (modified, +285/-3)
```diff
@@ -63,16 +63,15 @@ where
     H: Handle + 'static,
     I: Intercept + 'static,
 {
-    async fn handle(
+    fn handle(
         &self,
         headers: RequestHeaders,
         options: CallOptions,
         tx: &mut impl SendStream,
         rx: impl RecvStream + 'static,
-    ) -> Trailers {
+    ) -> impl std::future::Future<Output = Trailers> + Send {
         self.intercept
             .intercept(headers, options, tx, rx, &self.handle)
-            .await
     }
 }
 
@@ -89,6 +88,102 @@ pub trait HandleExt: Handle + Sized {
 
 impl<T: Handle + Sized> HandleExt for T {}
 
+/// A no-op interceptor that simply delegates to the next handler.
+///
+/// This is the default interceptor used by [`RouterBuilder`](crate::server::RouterBuilder)
+/// when no interceptor has been added.
+#[derive(Clone, Copy)]
+pub struct Identity;
+
+impl Intercept for Identity {
+    fn intercept(
+        &self,
+        headers: RequestHeaders,
+        options: CallOptions,
+        tx: &mut impl SendStream,
+        rx: impl RecvStream + 'static,
+        next: &impl Handle,
+    ) -> impl std::future::Future<Output = Trailers> + Send {
+        next.handle(headers, options, tx, rx)
+    }
+}
+
+/// Extension trait for chaining [`Intercept`] implementations.
+///
+/// Provides the [`chain`](InterceptExt::chain) method, which composes two
+/// interceptors into a single [`InterceptorChain`] that itself implements
+/// `Intercept`. Chains nest naturally via repeated calls.
+pub trait InterceptExt: Intercept + Sized {
+    /// Chains `self` with `next`, returning an [`InterceptorChain`] where
+    /// `self` runs first and `next` runs second.
+    fn chain<I: Intercept>(self, next: I) -> InterceptorChain<Self, I> {
+        InterceptorChain {
+            first: self,
+            second: next,
+        }
+    }
+}
+
+impl<T: Intercept + Sized> InterceptExt for T {}
+
+/// Two interceptors chained together, where `first` runs before `second`.
+///
+/// Created via [`InterceptExt::chain`]. Itself implements [`Intercept`], so
+/// chains compose recursively:
+/// `InterceptorChain<A, InterceptorChain<B, C>>` runs A → B → C.
+#[derive(Clone)]
+pub struct InterceptorChain<A, B> {
+    first: A,
+    second: B,
+}
+
+impl<A, B> Intercept for InterceptorChain<A, B>
+where
+    A: Intercept,
+    B: Intercept,
+{
+    async fn intercept(
+        &self,
+        headers: RequestHeaders,
+        options: CallOptions,
+        tx: &mut impl SendStream,
+        rx: impl RecvStream + 'static,
+        next: &impl Handle,
+    ) -> Trailers {
+        // Build a temporary Handle that runs `second` then delegates to `next`.
+        let inner = SecondThenNext {
+            second: &self.second,
+            next,
+        };
+        self.first.intercept(headers, options, tx, rx, &inner).await
+    }
+}
+
+/// A temporary Handle adapter used inside [`InterceptorChain`].
+///
+/// When called, it runs `second.intercept(...)` with `next` as the
+/// downstream handler, achieving the chained execution order.
+struct SecondThenNext<'a, B, N: ?Sized> {
+    second: &'a B,
+    next: &'a N,
+}
+
+impl<B, N> Handle for SecondThenNext<'_, B, N>
+where
+    B: Intercept,
+    N: Handle,
+{
+    fn handle(
+        &self,
+        headers: RequestHeaders,
+        options: CallOptions,
+        tx: &mut impl SendStream,
+        rx: impl RecvStream + 'static,
+    ) -> impl std::future::Future<Output = Trailers> + Send {
+        self.second.intercept(headers, options, tx, rx, self.next)
+    }
+}
+
 #[cfg(test)]
 mod test {
     use std::sync::Arc;
@@ -101,6 +196,8 @@ mod test {
     use crate::server::RequestHeaders;
     use crate::server::ResponseStreamItem;
     use crate::server::SendOptions;
+    use crate::status::StatusCodeError;
+    use crate::status::StatusError;
 
     struct MockSendStream;
     impl SendStream for MockSendStream {
@@ -261,4 +358,189 @@ mod test {
         let final_order = order.lock().await;
         assert_eq!(*final_order, vec![1, 2, 0]);
     }
+
+    // --- Chaining tests exercising `InterceptExt::chain` / `InterceptorChain` ---
+
+    /// Records its `id` when run, then delegates to `next`.
+    struct TrackingInterceptor {
+        id: usize,
+        order: Arc<Mutex<Vec<usize>>>,
+    }
+
+    impl Intercept for TrackingInterceptor {
+        async fn intercept(
+            &self,
+            headers: RequestHeaders,
+            options: CallOptions,
+            tx: &mut impl SendStream,
+            rx: impl RecvStream + 'static,
+            next: &impl Handle,
+        ) -> Trailers {
+            self.order.lock().await.push(self.id);
+            next.handle(headers, options, tx, rx).await
+        }
+    }
+
+    /// Records `id` and returns without calling `next` (short-circuit).
+    struct ShortCircuitInterceptor {
+        id: usize,
+        order: Arc<Mutex<Vec<usize>>>,
+    }
+
+    impl Intercept for ShortCircuitInterceptor {
+        async fn intercept(
+            &self,
+         
```

**File**: `grpc/src/server/mod.rs` (modified, +59/-24)
```diff
@@ -57,7 +57,11 @@ use crate::core::SendMessage;
 use crate::metadata::MetadataMap;
 use crate::rt::GrpcRuntime;
 
+pub mod builder;
+pub mod descriptor;
 pub(crate) mod interceptor;
+pub(crate) mod router;
+pub mod service;
 
 /// Settings to configure RPCs sent using the [`Handle`] trait.
 ///
@@ -188,20 +192,22 @@ impl GracefulCoordinator {
 }
 
 impl Server {
-    /// Creates a new server with no handler.
-    pub fn new() -> Self {
+    /// Creates a [`ServerBuilder`](builder::ServerBuilder) with no interceptors.
+    pub fn builder() -> builder::ServerBuilder<interceptor::Identity> {
+        builder::ServerBuilder::new()
+    }
+
+    /// Creates a new server with the given handler and runtime.
+    pub(crate) fn new(handler: impl Handle + 'static, runtime: GrpcRuntime) -> Self {
         Self {
-            handler: None,
-            runtime: crate::rt::default_runtime(),
+            handler: Some(Arc::new(handler)),
+            runtime,
         }
     }
 
-    /// Sets the RPC handler for this server.
-    pub fn set_handler<H>(&mut self, h: H)
-    where
-        H: Handle + Send + Sync + 'static,
-    {
-        self.handler = Some(Arc::new(h))
+    /// Returns the runtime used by this server.
+    pub fn runtime(&self) -> &GrpcRuntime {
+        &self.runtime
     }
 
     /// Serves on the given listener until it stops producing connections.
@@ -271,7 +277,10 @@ impl Server {
 
 impl Default for Server {
     fn default() -> Self {
-        Self::new()
+        Self {
+            handler: None,
+            runtime: crate::rt::default_runtime(),
+        }
     }
 }
 
@@ -640,7 +649,6 @@ mod tests {
 
     use super::*;
     use crate::core::test_connection_info;
-
     /// A mock connection whose completion is controlled by a [`Notify`],
     /// and which records whether [`graceful_shutdown`] was called.
     struct MockConnection {
@@ -739,7 +747,7 @@ mod tests {
     #[tokio::test]
     async fn server_stops_on_shutdown_signal() {
         let listener = crate::inmemory::InMemoryListener::new();
-        let server = Server::new();
+        let server = Server::builder().build();
 
         let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
 
@@ -765,7 +773,7 @@ mod tests {
     #[tokio::test]
     async fn server_stops_when_listener_closes() {
         let listener = crate::inmemory::InMemoryListener::new();
-        let server = Server::new();
+        let server = Server::builder().build();
 
         let listener_for_serve = listener.clone();
         let server_handle = tokio::spawn(async move {
@@ -809,7 +817,7 @@ mod tests {
     #[tokio::test]
     async fn dropping_serve_future_force_closes_connection() {
         let listener = crate::inmemory::InMemoryListener::new();
-        let server = Server::new();
+        let server = Server::builder().build();
 
         // A never-resolving signal future (we won't signal gracefully, we will drop the serve future directly).
         let (_signal_tx, signal_rx) = tokio::sync::oneshot::channel::<()>();
@@ -969,7 +977,7 @@ mod tests {
                 let rx = BoxedRecvStream(Box::new(NopRecvStream));
                 let _ = handler
                     .dyn_handle(
-                        RequestHeaders::new("", test_connection_info()),
+                        RequestHeaders::new("/test.Draining/Method", test_connection_info()),
                         CallOptions::new(),
                         &mut tx,
                         rx,
@@ -983,12 +991,12 @@ mod tests {
     #[tokio::test]
     async fn listener_dropped_when_shutdown_signal_fires() {
         let (listener, dropped, _tx) = MockListener::new();
-        let server = Server::new();
 
         let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
 
         let server_handle = tokio::spawn(async move {
-            server
+            Server::builder()
+                .build()
                 .serve_with_shutdown(listener, async {
                     let _ = shutdown_rx.await;
                 })
@@ -1019,11 +1027,12 @@ mod tests {
         use crate::server::RequestHeaders;
         use crate::server::SendStream;
         use crate::server::Trailers;
+        use crate::server::descriptor::MethodDescriptor;
+        use crate::server::descriptor::ServiceDescriptor;
+        use crate::server::service::Service;
 
         let (listener, dropped, tx) = MockListener::new();
 
-        let mut server = Server::new();
-
         let handler_started = Arc::new(AtomicBool::new(false));
         let (unblock_tx, unblock_rx) = tokio::sync::oneshot::channel::<()>();
         let unblock_rx = Arc::new(tokio::sync::Mutex::new(Some(unblock_rx)));
@@ -1049,10 +1058,36 @@ mod tests {
             }
         }
 
-        server.set_handler(DrainingHandler {
-            started: handler_started.clone(),
-            unblock: unblock_rx,
-        });
+        struct DrainingService {
+            started: Arc<AtomicBool>,
+            unblock: 
```

**File**: `grpc/src/server/router.rs` (added, +705/-0)
```diff
@@ -0,0 +1,705 @@
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Permission is hereby granted, free of charge, to any person obtaining a copy
+ * of this software and associated documentation files (the "Software"), to
+ * deal in the Software without restriction, including without limitation the
+ * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
+ * sell copies of the Software, and to permit persons to whom the Software is
+ * furnished to do so, subject to the following conditions:
+ *
+ * The above copyright notice and this permission notice shall be included in
+ * all copies or substantial portions of the Software.
+ *
+ * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+ * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+ * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+ * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+ * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+ * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
+ * IN THE SOFTWARE.
+ *
+ */
+
+use std::collections::HashMap;
+use std::sync::Arc;
+
+use crate::StatusCodeError;
+use crate::StatusError;
+use crate::server::BoxedRecvStream;
+use crate::server::CallOptions;
+use crate::server::DynHandle;
+use crate::server::DynRecvStream;
+use crate::server::DynSendStream;
+use crate::server::Handle;
+use crate::server::RecvStream;
+use crate::server::RequestHeaders;
+use crate::server::SendStream;
+use crate::server::Trailers;
+use crate::server::descriptor::MethodDescriptor;
+use crate::server::descriptor::ServiceDescriptor;
+use crate::server::interceptor::Identity;
+use crate::server::interceptor::Intercept;
+use crate::server::interceptor::InterceptExt;
+use crate::server::interceptor::InterceptorChain;
+use crate::server::service::Service;
+
+/// A builder for constructing an immutable [`Router`].
+pub(crate) struct RouterBuilder<I> {
+    handlers: HashMap<String, Arc<dyn DynHandle>>,
+    descriptors: Vec<ServiceDescriptor>,
+    interceptor: I,
+}
+
+impl RouterBuilder<Identity> {
+    /// Creates a new, empty `RouterBuilder` with no interceptors.
+    pub(crate) fn new() -> RouterBuilder<Identity> {
+        RouterBuilder {
+            handlers: HashMap::new(),
+            descriptors: Vec::new(),
+            interceptor: Identity,
+        }
+    }
+}
+
+impl<I> RouterBuilder<I>
+where
+    I: Intercept + Clone + Send + Sync + 'static,
+{
+    /// Chains an additional interceptor after the existing stack.
+    pub(crate) fn chain_interceptor<J>(self, next: J) -> RouterBuilder<InterceptorChain<I, J>>
+    where
+        J: Intercept + Clone + Send + Sync + 'static,
+    {
+        RouterBuilder {
+            handlers: self.handlers,
+            descriptors: self.descriptors,
+            interceptor: self.interceptor.chain(next),
+        }
+    }
+
+    /// Registers `handler` for the given method (last-one-wins on duplicate paths).
+    pub(crate) fn add_method<H>(mut self, descriptor: MethodDescriptor, handler: H) -> Self
+    where
+        H: Handle + Send + Sync + 'static,
+    {
+        self.handlers
+            .insert(descriptor.into_full_path(), Arc::new(handler));
+        self
+    }
+
+    /// Registers all methods from a [`Service`].
+    pub(crate) fn add_service(mut self, service: impl Service) -> Self {
+        self.descriptors.push(service.descriptor());
+        for (path, handler) in service.register_methods() {
+            self.handlers.insert(path, handler);
+        }
+        self
+    }
+
+    /// Consumes this builder and produces an immutable [`Router`].
+    pub(crate) fn build(self) -> Router<I> {
+        Router {
+            handlers: self.handlers,
+            interceptor: self.interceptor,
+        }
+    }
+}
+
+impl Default for RouterBuilder<Identity> {
+    fn default() -> Self {
+        Self::new()
+    }
+}
+
+/// Routes incoming gRPC RPCs to the correct handler based on the request's
+/// method name.
+///
+/// `Router` implements [`Handle`], so it can be used as the handler for a
+/// [`Server`](crate::server::Server). For most use cases, prefer
+/// [`Server::builder()`](crate::server::Server::builder) which constructs
+/// both the router and server together.
+///
+/// A `Router` is immutable once built; use [`RouterBuilder`] to construct one.
+pub struct Router<I> {
+    handlers: HashMap<String, Arc<dyn DynHandle>>,
+    interceptor: I,
+}
+
+impl<I> Handle for Router<I>
+where
+    I: Intercept + Send + Sync + 'static,
+{
+    async fn handle(
+        &self,
+        headers: RequestHeaders,
+        options: CallOptions,
+        tx: &mut impl SendStream,
+        rx: impl RecvStream + 'static,
+    ) -> Trailers {
+        // Resolve the method first: unknown methods short-circuit to
+        // UNIMPLEMENTED without running the interceptor stack.
+        let Some(handler) = self.handlers.ge
```

**File**: `grpc/src/server/service.rs` (added, +296/-0)
```diff
@@ -0,0 +1,296 @@
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Permission is hereby granted, free of charge, to any person obtaining a copy
+ * of this software and associated documentation files (the "Software"), to
+ * deal in the Software without restriction, including without limitation the
+ * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
+ * sell copies of the Software, and to permit persons to whom the Software is
+ * furnished to do so, subject to the following conditions:
+ *
+ * The above copyright notice and this permission notice shall be included in
+ * all copies or substantial portions of the Software.
+ *
+ * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+ * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+ * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+ * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+ * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+ * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
+ * IN THE SOFTWARE.
+ *
+ */
+
+use std::sync::Arc;
+
+use crate::server::DynHandle;
+use crate::server::DynHandleWrapper;
+use crate::server::descriptor::ServiceDescriptor;
+use crate::server::interceptor::HandleExt;
+use crate::server::interceptor::Intercept;
+
+/// A gRPC service that can register its methods with a server router.
+///
+/// Implementations return their descriptor metadata via [`descriptor()`](Service::descriptor)
+/// and produce their method handlers via [`register_methods()`](Service::register_methods).
+pub trait Service: Send + 'static {
+    /// Returns the service descriptor (pure metadata).
+    ///
+    /// This provides service and method metadata without registering handlers,
+    /// enabling use cases like server reflection and service listing.
+    fn descriptor(&self) -> ServiceDescriptor;
+
+    /// Produces all method handlers for this service as type-erased dynamic handlers
+    /// paired with their full method path (e.g. `"/mypackage.Echo/UnaryEcho"`).
+    fn register_methods(self) -> Vec<(String, Arc<dyn DynHandle>)>;
+}
+
+/// A service wrapped with an interceptor that applies to all its methods.
+///
+/// Created by [`ServiceExt::with_interceptor()`]. The interceptor is applied
+/// to each method handler at registration time.
+pub struct InterceptedService<S, I> {
+    service: S,
+    interceptor: I,
+}
+
+impl<S, I> Service for InterceptedService<S, I>
+where
+    S: Service,
+    I: Intercept + Clone + Send + Sync + 'static,
+{
+    fn descriptor(&self) -> ServiceDescriptor {
+        self.service.descriptor()
+    }
+
+    fn register_methods(self) -> Vec<(String, Arc<dyn DynHandle>)> {
+        let methods = self.service.register_methods();
+        methods
+            .into_iter()
+            .map(|(path, handler)| {
+                let intercepted =
+                    DynHandleWrapper(handler).with_interceptor(self.interceptor.clone());
+                (path, Arc::new(intercepted) as Arc<dyn DynHandle>)
+            })
+            .collect()
+    }
+}
+
+/// Extension trait for composing interceptors on services.
+pub trait ServiceExt: Service + Sized {
+    /// Wraps this service with an interceptor that applies to all its methods.
+    ///
+    /// This is a pre-registration transformation: the interceptor is applied
+    /// when the service registers its methods, not at call time.
+    ///
+    /// Equivalent to Java's `ServerInterceptors.intercept(service, interceptor)`.
+    fn with_interceptor<I: Intercept>(self, interceptor: I) -> InterceptedService<Self, I> {
+        InterceptedService {
+            service: self,
+            interceptor,
+        }
+    }
+}
+
+impl<T: Service> ServiceExt for T {}
+
+#[cfg(test)]
+mod tests {
+    use std::sync::Arc;
+
+    use tokio::sync::Mutex;
+
+    use super::*;
+    use crate::core::RecvMessage;
+    use crate::core::test_connection_info;
+    use crate::server::CallOptions;
+    use crate::server::Handle;
+    use crate::server::RecvStream;
+    use crate::server::RequestHeaders;
+    use crate::server::ResponseStreamItem;
+    use crate::server::SendOptions;
+    use crate::server::SendStream;
+    use crate::server::Trailers;
+    use crate::server::descriptor::MethodDescriptor;
+    use crate::server::descriptor::ServiceDescriptor;
+    use crate::server::interceptor::Intercept;
+    use crate::server::router::RouterBuilder;
+
+    struct MockSendStream;
+    impl SendStream for MockSendStream {
+        async fn send<'a>(
+            &mut self,
+            _item: ResponseStreamItem<'a>,
+            _options: SendOptions,
+        ) -> Result<(), ()> {
+            Ok(())
+        }
+    }
+
+    struct MockRecvStream;
+    impl RecvStream for MockRecvStream {
+        async fn next(&mut self, _msg: &mut dyn RecvMessage) -> Option<Result<(), ()>> {
+            None
+        }
+  
```

---

### Incident Patch 11: `ddd75093` (2026-09-09)
**Commit Message**: grpc/child_manager: use generic child builder (#2851)

Contributes to: https://github.com/grpc/grpc-rust/issues/2761

Make `ChildManager` generic over the `LbPolicyBuilder` type it manages.

Previously, type checking for LB policies and their configuration types
relied on runtime invariants enforced by `DynAdapter`. Parameterizing
`ChildManager` provides compile-time guarantees for these types.

As a result:
- `RoundRobin` now manages concrete, non-type-erased `PickFirst`
children.
-
[`Priority`](https://github.com/grpc/grpc-rust/compare/master...arjan-bal:hierarchy)
will manage `GracefulSwitch` children.

### Additional Changes

- Updated `RoundRobin` tests to use the real `PickFirst` balancer rather
than test stubs.

**File**: `grpc/src/client/load_balancing/child_manager.rs` (modified, +23/-21)
```diff
@@ -34,9 +34,9 @@ use std::sync::Arc;
 
 use crate::client::ConnectivityState;
 use crate::client::load_balancing::ChannelController;
-use crate::client::load_balancing::DynLbConfig;
-use crate::client::load_balancing::DynLbPolicy;
 use crate::client::load_balancing::DynLbPolicyBuilder;
+use crate::client::load_balancing::LbPolicy;
+use crate::client::load_balancing::LbPolicyBuilder;
 use crate::client::load_balancing::LbPolicyOptions;
 use crate::client::load_balancing::LbState;
 use crate::client::load_balancing::Subchannel;
@@ -50,44 +50,48 @@ use crate::rt::GrpcRuntime;
 
 // An LbPolicy implementation that manages multiple children.
 #[derive(Debug)]
-pub struct ChildManager<T: Debug> {
+pub struct ChildManager<T: Debug, B: LbPolicyBuilder = Arc<DynLbPolicyBuilder>> {
     subchannel_to_child_idx: HashMap<WeakSubchannel, usize>,
     handle_to_child_idx: HashMap<ChildHandle, usize>,
-    children: Vec<Child<T>>,
+    children: Vec<Child<T, B>>,
     runtime: GrpcRuntime,
     updated: bool, // Set when any child updates its picker; cleared when accessed.
     work_scheduler: Arc<dyn WorkScheduler>,
 }
 
 #[non_exhaustive]
 #[derive(Debug)]
-pub struct Child<T> {
+pub struct Child<T, B: LbPolicyBuilder = Arc<DynLbPolicyBuilder>> {
     pub identifier: T,
-    pub builder: Arc<DynLbPolicyBuilder>,
+    pub builder: B,
     pub state: LbState,
-    policy: Box<DynLbPolicy>,
+    policy: B::LbPolicy,
     work_scheduler: Arc<ChildWorkScheduler>,
 }
 
 /// A collection of data sent to a child of the ChildManager.
-pub struct ChildUpdate<'a, T> {
+pub struct ChildUpdate<'a, T, B: LbPolicyBuilder = Arc<DynLbPolicyBuilder>> {
     /// The identifier the ChildManager should use for this child.
     pub child_identifier: T,
     /// The builder the ChildManager should use to create this child if it does
     /// not exist.  The child_policy_builder's name is effectively a part of the
     /// child_identifier.  If two identifiers are identical but have different
     /// builder names, they are treated as different children.
-    pub child_policy_builder: Arc<DynLbPolicyBuilder>,
+    pub child_policy_builder: B,
     /// The relevant ResolverUpdate and LbConfig to send to this child.  If
     /// None, then resolver_update will not be called on the child.  Should
     /// generally be Some for any new children, otherwise they will not be
     /// called.
-    pub child_update: Option<(ResolverUpdate, Option<&'a DynLbConfig>)>,
+    pub child_update: Option<(
+        ResolverUpdate,
+        Option<&'a <B::LbPolicy as LbPolicy>::LbConfig>,
+    )>,
 }
 
-impl<T> ChildManager<T>
+impl<T, B> ChildManager<T, B>
 where
     T: Debug + PartialEq + Hash + Eq + Send + Sync + 'static,
+    B: LbPolicyBuilder,
 {
     /// Creates a new ChildManager LB policy.  shard_update is called whenever a
     /// resolver_update operation occurs.
@@ -103,7 +107,7 @@ where
     }
 
     /// Returns data for all current children.
-    pub fn children(&self) -> impl Iterator<Item = &Child<T>> {
+    pub fn children(&self) -> impl Iterator<Item = &Child<T, B>> {
         self.children.iter()
     }
 
@@ -176,10 +180,7 @@ where
     ///
     /// If an ID is provided that does not exist in the ChildManager, it will be
     /// ignored.
-    pub fn retain_children(
-        &mut self,
-        ids_builders: impl IntoIterator<Item = (T, Arc<DynLbPolicyBuilder>)>,
-    ) {
+    pub fn retain_children(&mut self, ids_builders: impl IntoIterator<Item = (T, B)>) {
         self.reset_children(ids_builders, true);
     }
 
@@ -189,7 +190,7 @@ where
     /// otherwise a new child will be built for it.
     fn reset_children(
         &mut self,
-        ids_builders: impl IntoIterator<Item = (T, Arc<DynLbPolicyBuilder>)>,
+        ids_builders: impl IntoIterator<Item = (T, B)>,
         retain_only: bool,
     ) {
         // Replace self.children with an empty vec.
@@ -283,7 +284,7 @@ where
     /// children not present in child_updates will be removed.
     pub fn update<'a>(
         &mut self,
-        child_updates: impl IntoIterator<Item = ChildUpdate<'a, T>>,
+        child_updates: impl IntoIterator<Item = ChildUpdate<'a, T, B>>,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), String> {
         // Split the child updates into the IDs and builders, and the
@@ -332,7 +333,7 @@ where
     pub fn resolver_update(
         &mut self,
         resolver_update: ResolverUpdate,
-        config: Option<&DynLbConfig>,
+        config: Option<&<B::LbPolicy as LbPolicy>::LbConfig>,
         channel_controller: &mut dyn ChannelController,
     ) -> Result<(), Box<dyn Error + Send + Sync>> {
         let mut errs = Vec::with_capacity(self.children.len());
@@ -497,6 +498,7 @@ mod test {
     use std::sync::Mutex;
     use std::sync::mpsc;
 
+    use crate::attributes::Attributes;
     use crate::client::ConnectivityState;
     use crate::client::load_balancing::ChannelController;
     use crate::client::load_balancing::Dy
```

**File**: `grpc/src/client/load_balancing/mod.rs` (modified, +19/-0)
```diff
@@ -460,3 +460,22 @@ impl<T: LbPolicy + ?Sized> LbPolicy for Box<T> {
         (**self).exit_idle(channel_controller)
     }
 }
+
+impl<B: LbPolicyBuilder + ?Sized> LbPolicyBuilder for Arc<B> {
+    type LbPolicy = B::LbPolicy;
+
+    fn build(&self, options: LbPolicyOptions) -> Self::LbPolicy {
+        (**self).build(options)
+    }
+
+    fn name(&self) -> &'static str {
+        (**self).name()
+    }
+
+    fn parse_config(
+        &self,
+        config: &ParsedJsonLbConfig,
+    ) -> Result<Option<<B::LbPolicy as LbPolicy>::LbConfig>, String> {
+        (**self).parse_config(config)
+    }
+}
```

**File**: `grpc/src/client/load_balancing/round_robin.rs` (modified, +181/-468)
```diff
@@ -31,7 +31,6 @@ use std::sync::atomic::Ordering;
 use crate::client::ConnectivityState;
 use crate::client::RequestHeaders;
 use crate::client::load_balancing::ChannelController;
-use crate::client::load_balancing::DynLbPolicyBuilder;
 use crate::client::load_balancing::FailingPicker;
 use crate::client::load_balancing::GLOBAL_LB_REGISTRY;
 use crate::client::load_balancing::LbPolicy;
@@ -45,7 +44,7 @@ use crate::client::load_balancing::SubchannelState;
 use crate::client::load_balancing::WorkData;
 use crate::client::load_balancing::child_manager::ChildManager;
 use crate::client::load_balancing::child_manager::ChildUpdate;
-use crate::client::load_balancing::pick_first;
+use crate::client::load_balancing::pick_first::PickFirstBuilder;
 use crate::client::name_resolution::Endpoint;
 use crate::client::name_resolution::ResolverUpdate;
 
@@ -60,16 +59,7 @@ impl LbPolicyBuilder for RoundRobinBuilder {
 
     fn build(&self, options: LbPolicyOptions) -> Self::LbPolicy {
         let child_manager = ChildManager::new(options.runtime, options.work_scheduler);
-        // TODO: do we want to use the pick first builder directly instead of
-        // going through the dynamic-converting registry?  That requires either
-        // making the RR policy generic or making it non-configurable, which the
-        // current tests take advantage of.
-        RoundRobinPolicy::new(
-            child_manager,
-            GLOBAL_LB_REGISTRY
-                .get_policy(pick_first::POLICY_NAME)
-                .unwrap(),
-        )
+        RoundRobinPolicy::new(child_manager)
     }
 
     fn name(&self) -> &'static str {
@@ -79,19 +69,12 @@ impl LbPolicyBuilder for RoundRobinBuilder {
 
 #[derive(Debug)]
 pub struct RoundRobinPolicy {
-    child_manager: ChildManager<Endpoint>,
-    pick_first_builder: Arc<DynLbPolicyBuilder>,
+    child_manager: ChildManager<Endpoint, PickFirstBuilder>,
 }
 
 impl RoundRobinPolicy {
-    fn new(
-        child_manager: ChildManager<Endpoint>,
-        pick_first_builder: Arc<DynLbPolicyBuilder>,
-    ) -> Self {
-        Self {
-            child_manager,
-            pick_first_builder,
-        }
+    fn new(child_manager: ChildManager<Endpoint, PickFirstBuilder>) -> Self {
+        Self { child_manager }
     }
 
     // Sets the policy's state to TRANSIENT_FAILURE with a picker returning the
@@ -178,7 +161,7 @@ impl LbPolicy for RoundRobinPolicy {
             };
             ChildUpdate {
                 child_identifier: e.clone(),
-                child_policy_builder: self.pick_first_builder.clone(),
+                child_policy_builder: PickFirstBuilder {},
                 child_update: Some((update, None)),
             }
         });
@@ -253,39 +236,16 @@ impl Picker for RoundRobinPicker {
 
 #[cfg(test)]
 mod test {
-    use std::collections::HashSet;
     use std::panic;
-    use std::sync::Arc;
     use std::sync::mpsc;
 
+    use super::*;
     use crate::StatusCodeError;
-    use crate::client::ConnectivityState;
-    use crate::client::RequestHeaders;
-    use crate::client::load_balancing::ChannelController;
-    use crate::client::load_balancing::FailingPicker;
-    use crate::client::load_balancing::GLOBAL_LB_REGISTRY;
-    use crate::client::load_balancing::LbPolicy;
-    use crate::client::load_balancing::LbState;
-    use crate::client::load_balancing::Pick;
-    use crate::client::load_balancing::PickResult;
-    use crate::client::load_balancing::Picker;
-    use crate::client::load_balancing::QueuingPicker;
-    use crate::client::load_balancing::Subchannel;
-    use crate::client::load_balancing::SubchannelState;
-    use crate::client::load_balancing::child_manager::ChildManager;
-    use crate::client::load_balancing::pick_first;
-    use crate::client::load_balancing::round_robin::RoundRobinPolicy;
-    use crate::client::load_balancing::round_robin::{self};
-    use crate::client::load_balancing::test_utils::StubPolicyData;
-    use crate::client::load_balancing::test_utils::StubPolicyFuncs;
+    use crate::client::load_balancing::test_utils;
     use crate::client::load_balancing::test_utils::TestChannelController;
     use crate::client::load_balancing::test_utils::TestEvent;
     use crate::client::load_balancing::test_utils::TestWorkScheduler;
-    use crate::client::load_balancing::test_utils::{self};
-    use crate::client::name_resolution::Endpoint;
-    use crate::client::name_resolution::ResolverUpdate;
     use crate::core::Address;
-    use crate::metadata::MetadataMap;
     use crate::rt::default_runtime;
 
     const DEFAULT_TEST_SHORT_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(100);
@@ -295,9 +255,7 @@ mod test {
     // Performs the following:
     // 1. Creates a work scheduler.
     // 2. Creates a fake channel that acts as a channel controller.
-    // 3. Creates an StubPolicyBuilder with StubFuncs and the name of the test
-    //    passed in.
-    // 4. Create a Round Robin policy with the StubPolicyBuilder.
+
```

---

### Incident Patch 12: `16f1b9a9` (2026-08-26)
**Commit Message**: test: enable missing feature for test build (#2820)

Add missing feature flags to fix `cargo test` when run inside individual
crate directories.

CI previously missed this issue because running `cargo nextest` from the
workspace root automatically unifies workspace features.

Additionally, because the `grpc-gcp` example depends on
`protoc-gen-rust-grpc` (unlike `tonic` examples), this PR removes
`grpc-gcp` from the default features so `cargo test` works out of the
box. Note that `examples` crate has no tests.

**File**: `examples/Cargo.toml` (modified, +2/-3)
```diff
@@ -291,11 +291,10 @@ grpc-gcp = [ "dep:protobuf", "dep:grpc-protobuf", "dep:grpc", "dep:grpc-google",
 "dep:rustls", "dep:protobuf-well-known-types" ]
 grpc-routeguide = ["dep:grpc", "dep:grpc-protobuf", "dep:protobuf", "dep:rand"]
 grpc-helloworld = ["dep:grpc", "dep:grpc-protobuf", "dep:protobuf"]
-full = ["gcp", "routeguide", "reflection", "autoreload", "health", "grpc-web",
+default = ["gcp", "routeguide", "reflection", "autoreload", "health", "grpc-web",
 "tracing", "uds", "streaming", "mock", "json-codec", "compression", "tls",
 "tls-rustls", "tls-client-auth", "types", "cancellation", "h2c",
-"grpc-routeguide", "grpc-helloworld", "grpc-gcp"]
-default = ["full"]
+"grpc-routeguide", "grpc-helloworld"]
 # Workaround for cargo-udeps bug.
 # TODO: Remove once the fix is released: https://github.com/est31/cargo-udeps/pull/338
 h2 = []
```

**File**: `examples/README.md` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ Once your credentials are set up, you will need your GCP Project ID, which can
 be found on the main dashboard of the Google Cloud Console. With both of these
 ready, you can run the example like so:
 ```bash
-$ cargo run --bin grpc-gcp-client -- <project-id>
+$ cargo run --bin grpc-gcp-client --features grpc-gcp -- <project-id>
 ```
 
 [Application Default Credentials]: https://docs.cloud.google.com/docs/authentication/application-default-credentials
```

**File**: `tonic-reflection/Cargo.toml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ tonic-prost = { version = "0.14.6", path = "../tonic-prost", default-features =
 
 [dev-dependencies]
 tokio-stream = {version = "0.1", default-features = false, features = ["net"]}
-tonic = { version = "0.14.6", path = "../tonic", default-features = false, features = ["transport"] }
+tonic = { version = "0.14.6", path = "../tonic", default-features = false, features = ["transport", "router"] }
 
 [lints]
 workspace = true
```

---

### Incident Patch 13: `5cf749d1` (2026-08-25)
**Commit Message**: feat(tonic-xds): add public bootstrap config builder & release alpha.3 (#2825)

## Motivation

Releasing alpha.3 to include the recent custom transport API additions,
in order to test in other crates.

## Solution

One gap identified while assessing the API production readiness:
currently the only way to construct a bootstrap config to instantiate an
xDS channel from is to go through a A27-formatted JSON string. This is
more error prone than a typed builder, which is now introduced in this
PR. We acknowledge that other gRPC implementations such as grpc-go
explicitly marked its typed config builder as test only / experimental
in anticipation of needing to change the config shapes, so here we
marked relevant enums and fields as `#[non_exhaustive]` and guarded them
with checks to ensure forward compatibility.

**File**: `grpc-xds/Cargo.toml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ allowed_external_types = []
 protobuf = "4.35.1-release"
 protobuf-well-known-types = "4.35.1-release"
 bytes = "1.11.0"
-xds-client = { version = "0.1.0-alpha.2", path = "../xds-client", default-features = false }
+xds-client = { version = "0.1.0-alpha.3", path = "../xds-client", default-features = false }
 regex = "1"
 
 [build-dependencies]
```

**File**: `tonic-xds/Cargo.toml` (modified, +5/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "tonic-xds"
-version = "0.1.0-alpha.2"
+version = "0.1.0-alpha.3"
 edition = "2024"
 rust-version.workspace = true
 homepage = "https://github.com/hyperium/tonic"
@@ -33,7 +33,7 @@ url = "2.5.8"
 futures-core = "0.3.31"
 futures-util = "0.3"
 bytes = "1"
-xds-client = { version = "0.1.0-alpha.2", path = "../xds-client" }
+xds-client = { version = "0.1.0-alpha.3", path = "../xds-client" }
 serde = { version = "1", features = ["derive"] }
 serde_json = "1"
 envoy-types = "0.7"
@@ -56,13 +56,13 @@ rustls = { version = "0.23", default-features = false, features = ["std", "tls12
 rustls-pemfile = { version = "2", optional = true }
 x509-parser = { version = "0.17", optional = true }
 opentelemetry = { version = "0.32", optional = true, default-features = false, features = ["metrics"] }
-xds-client-opentelemetry = { version = "0.1.0-alpha.2", path = "../xds-client-opentelemetry", optional = true }
+xds-client-opentelemetry = { version = "0.1.0-alpha.3", path = "../xds-client-opentelemetry", optional = true }
 
 [lints]
 workspace = true
 
 [dev-dependencies]
-xds-client = { version = "0.1.0-alpha.2", path = "../xds-client", features = ["test-util"] }
+xds-client = { version = "0.1.0-alpha.3", path = "../xds-client", features = ["test-util"] }
 xds-test-util = { path = "../xds-test-util" }
 tokio = { version = "1", features = ["rt-multi-thread", "macros", "net", "test-util"] }
 tonic = { version = "0.14", features = [ "server", "channel", "tls-ring" ] }
@@ -123,5 +123,6 @@ allowed_external_types = [
     "tower::util::boxed_clone_sync::BoxCloneSyncService",
     "url::parser::ParseError",
     "serde_core::de::Deserialize",
+    "serde_core::ser::Serialize",
     "serde_json::error::Error",
 ]
```

**File**: `tonic-xds/examples/channel.rs` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@
 //! cargo run -p tonic-xds --example xds_server
 //!
 //! # Terminal 3: xDS client
-//! GRPC_XDS_BOOTSTRAP_CONFIG='{"xds_servers":[{"server_uri":"http://localhost:18000"}],"node":{"id":"test"}}' \
+//! GRPC_XDS_BOOTSTRAP_CONFIG='{"xds_servers":[{"server_uri":"http://localhost:18000","channel_creds":[{"type":"insecure"}]}],"node":{"id":"test"}}' \
 //!     cargo run -p tonic-xds --example channel --features testutil
 //! ```
 //!
```

**File**: `tonic-xds/examples/run_xds_example.sh` (modified, +1/-1)
```diff
@@ -25,5 +25,5 @@ XDS_PID=$!
 sleep 2
 
 # 3. Run xDS-aware client
-GRPC_XDS_BOOTSTRAP_CONFIG='{"xds_servers":[{"server_uri":"http://localhost:18000"}],"node":{"id":"test"}}' \
+GRPC_XDS_BOOTSTRAP_CONFIG='{"xds_servers":[{"server_uri":"http://localhost:18000","channel_creds":[{"type":"insecure"}]}],"node":{"id":"test"}}' \
     cargo run -p tonic-xds --example channel --features testutil 2>&1 | prefix "client"
```

**File**: `tonic-xds/src/client/xds_e2e.rs` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ mod test {
     /// target resolves the listener `listener_name`.
     fn build_channel(cp_addr: SocketAddr, listener_name: &str) -> XdsChannelGrpc {
         let bootstrap_json = format!(
-            r#"{{"xds_servers":[{{"server_uri":"http://{cp_addr}"}}],"node":{{"id":"test"}}}}"#
+            r#"{{"xds_servers":[{{"server_uri":"http://{cp_addr}","channel_creds":[{{"type":"insecure"}}]}}],"node":{{"id":"test"}}}}"#
         );
         let bootstrap = BootstrapConfig::from_json(&bootstrap_json).expect("parse bootstrap");
         let target = XdsUri::parse(&format!("xds:///{listener_name}")).expect("parse target");
```

**File**: `tonic-xds/src/lib.rs` (modified, +40/-7)
```diff
@@ -38,8 +38,9 @@
 //!
 //! 1. **Provide a bootstrap configuration** that tells the client where
 //!    the xDS management server lives and what node identity to present.
-//!    The format matches [gRFC A27] — a JSON object with `xds_servers`
-//!    and an optional `node`.
+//!    The format matches [gRFC A27] — a JSON object with `xds_servers`,
+//!    each entry carrying a `server_uri` and the `channel_creds` types the
+//!    client may offer, plus an optional `node`.
 //!
 //! 2. **Build the channel** with [`XdsChannelBuilder`], pointing it at
 //!    an `xds:///` target URI.
@@ -54,7 +55,8 @@
 //!
 //! | Method | How |
 //! |--------|-----|
-//! | Programmatic | [`BootstrapConfig::from_json`] then [`XdsChannelConfig::with_bootstrap`] |
+//! | Programmatic (builder) | [`BootstrapConfig::builder`] then [`XdsChannelConfig::with_bootstrap`] |
+//! | Programmatic (JSON) | [`BootstrapConfig::from_json`] then [`XdsChannelConfig::with_bootstrap`] |
 //! | Environment (explicit) | [`XdsChannelConfig::with_bootstrap_from_env`] |
 //! | Environment (implicit) | Omit bootstrap; the builder loads from env vars automatically |
 //!
@@ -66,7 +68,10 @@
 //!
 //! ```json
 //! {
-//!   "xds_servers": [{"server_uri": "xds.example.com:443"}],
+//!   "xds_servers": [{
+//!     "server_uri": "xds.example.com:443",
+//!     "channel_creds": [{"type": "tls"}]
+//!   }],
 //!   "node": {"id": "my-node"}
 //! }
 //! ```
@@ -93,7 +98,10 @@
 //! use tonic_xds::{BootstrapConfig, XdsChannelBuilder, XdsChannelConfig, XdsUri};
 //!
 //! let bootstrap = BootstrapConfig::from_json(r#"{
-//!     "xds_servers": [{"server_uri": "xds.example.com:443"}],
+//!     "xds_servers": [{
+//!         "server_uri": "xds.example.com:443",
+//!         "channel_creds": [{"type": "tls"}]
+//!     }],
 //!     "node": {"id": "my-node", "cluster": "my-cluster"}
 //! }"#).unwrap();
 //!
@@ -105,6 +113,26 @@
 //! // let client = MyServiceClient::new(channel);
 //! ```
 //!
+//! ### Using the builder
+//!
+//! ```rust,no_run
+//! use tonic_xds::{BootstrapConfig, ChannelCredentialType, XdsChannelBuilder, XdsChannelConfig, XdsUri};
+//!
+//! let bootstrap = BootstrapConfig::builder("xds.example.com:443")
+//!     .channel_creds([ChannelCredentialType::Tls])
+//!     .node_id("my-node")
+//!     .node_cluster("my-cluster")
+//!     .build()
+//!     .unwrap();
+//!
+//! let target = XdsUri::parse("xds:///myservice:50051").unwrap();
+//! let channel = XdsChannelBuilder::new(
+//!     XdsChannelConfig::new(target).with_bootstrap(bootstrap),
+//! ).build_grpc_channel().unwrap();
+//!
+//! // let client = MyServiceClient::new(channel);
+//! ```
+//!
 //! ## TLS Security (gRFC A29)
 //!
 //! Upstream data-plane TLS is enabled when:
@@ -121,7 +149,10 @@
 //!
 //! ```json
 //! {
-//!   "xds_servers": [{"server_uri": "xds.example.com:443"}],
+//!   "xds_servers": [{
+//!     "server_uri": "xds.example.com:443",
+//!     "channel_creds": [{"type": "tls"}]
+//!   }],
 //!   "certificate_providers": {
 //!     "root_ca":  { "plugin_name": "file_watcher", "config": {
 //!       "ca_certificate_file": "/etc/certs/ca.pem"
@@ -182,7 +213,9 @@ pub use client::retry::{
 pub use client::route::PreRouteInterceptor;
 pub use common::async_util::BoxFuture;
 pub use shared_http_body::SharedBody;
-pub use xds::bootstrap::{BootstrapConfig, BootstrapError};
+pub use xds::bootstrap::{
+    BootstrapConfig, BootstrapConfigBuilder, BootstrapError, ChannelCredentialType,
+};
 pub use xds::resource::route_config::{RouteConfigMetadata, TypedMetadata};
 pub use xds::uri::{XdsUri, XdsUriError};
 pub use xds_client::TonicCallCredentials;
```

**File**: `tonic-xds/src/xds/bootstrap.rs` (modified, +887/-74)
```diff
@@ -53,22 +53,65 @@ const ENV_BOOTSTRAP_CONFIG: &str = "GRPC_XDS_BOOTSTRAP_CONFIG";
 /// let config = BootstrapConfig::from_env().unwrap();
 ///
 /// // From a JSON string:
-/// let json = r#"{"xds_servers":[{"server_uri":"xds.example.com:443"}]}"#;
+/// let json = r#"{
+///   "xds_servers": [{
+///     "server_uri": "xds.example.com:443",
+///     "channel_creds": [{"type": "tls"}]
+///   }]
+/// }"#;
 /// let config = BootstrapConfig::from_json(json).unwrap();
 /// ```
 ///
+/// # Inspecting
+///
+/// The fields are private so new bootstrap keys can be added without breaking
+/// changes. The accessors below report what a loaded config will act on.
+///
+/// ```rust
+/// use tonic_xds::BootstrapConfig;
+///
+/// let json = r#"{
+///   "xds_servers": [{
+///     "server_uri": "xds.example.com:443",
+///     "channel_creds": [{"type": "tls"}]
+///   }],
+///   "node": {"id": "node-1"}
+/// }"#;
+/// let config = BootstrapConfig::from_json(json).unwrap();
+/// assert_eq!(config.server_uri(), "xds.example.com:443");
+/// assert_eq!(config.node_id(), "node-1");
+/// assert!(config.use_tls());
+/// ```
+///
+/// # Building programmatically
+///
+/// [`BootstrapConfig::builder`] constructs a config from typed values,
+/// without needing a JSON string. It covers the
+/// same bootstrap keys [`from_json`] acts on, per gRFC A27.
+///
+/// ```rust
+/// use tonic_xds::{BootstrapConfig, ChannelCredentialType};
+///
+/// let config = BootstrapConfig::builder("xds.example.com:443")
+///     .channel_creds([ChannelCredentialType::Tls])
+///     .node_id("node-1")
+///     .build()
+///     .unwrap();
+///
+/// assert_eq!(config.server_uri(), "xds.example.com:443");
+/// assert!(config.use_tls());
+/// ```
+///
+/// [`from_env`]: BootstrapConfig::from_env
+/// [`from_json`]: BootstrapConfig::from_json
 /// [gRFC A27]: https://github.com/grpc/proposal/blob/master/A27-xds-global-load-balancing.md
-// TODO: Design a public builder API for constructing BootstrapConfig
-// programmatically (not just from JSON). The current `new()` is pub(crate);
-// a public API should use the builder pattern to accommodate future fields
-// without breaking changes.
-#[derive(Debug, Clone, Deserialize)]
+#[derive(Debug, Clone, PartialEq, Deserialize)]
+#[serde(try_from = "BootstrapConfigDe")]
 #[non_exhaustive]
 pub struct BootstrapConfig {
     /// xDS management servers to connect to.
     pub(crate) xds_servers: Vec<XdsServerConfig>,
     /// Node identity sent to the xDS server.
-    #[serde(default)]
     pub(crate) node: NodeConfig,
     /// Certificate provider plugin instances, keyed by instance name.
     ///
@@ -77,19 +120,50 @@ pub struct BootstrapConfig {
     /// See gRFC A29 for details.
     ///
     /// [`CertificateProviderPluginInstance`]: https://github.com/envoyproxy/envoy/blob/main/api/envoy/extensions/transport_sockets/tls/v3/common.proto
-    #[serde(default)]
     // Consumed by `CertProviderRegistry::from_bootstrap` only under TLS
     // features; parsed regardless so non-TLS builds accept the same JSON.
     #[cfg_attr(not(feature = "_tls-any"), allow(dead_code))]
     pub(crate) certificate_providers: HashMap<String, CertProviderPluginConfig>,
 }
 
+/// Wire form of [`BootstrapConfig`].
+///
+/// [`BootstrapConfig`] deserializes through this type via `serde(try_from)`,
+/// so a config a caller obtains by embedding it in their own config struct
+/// goes through [`validate`](BootstrapConfig::validate) too.
+#[derive(Deserialize)]
+pub(crate) struct BootstrapConfigDe {
+    xds_servers: Vec<XdsServerConfig>,
+    #[serde(default)]
+    node: NodeConfig,
+    #[serde(default)]
+    certificate_providers: HashMap<String, CertProviderPluginConfig>,
+}
+
+impl TryFrom<BootstrapConfigDe> for BootstrapConfig {
+    type Error = BootstrapError;
+
+    fn try_from(de: BootstrapConfigDe) -> Result<Self, Self::Error> {
+        let config = Self {
+            xds_servers: de.xds_servers,
+            node: de.node,
+            certificate_providers: de.certificate_providers,
+        };
+        config.validate()?;
+        Ok(config)
+    }
+}
+
 /// Configuration for a single xDS management server.
-#[derive(Debug, Clone, Deserialize)]
+#[derive(Debug, Clone, PartialEq, Deserialize)]
 pub(crate) struct XdsServerConfig {
     /// URI of the xDS server (e.g., `"xds.example.com:443"`).
     pub server_uri: String,
     /// Ordered list of channel credentials. The client uses the first supported type.
+    ///
+    /// gRFC A27 requires the key. `#[serde(default)]` routes a missing list to
+    /// [`BootstrapConfig::validate`], which reports it with the same message it
+    /// gives an empty or unknown-only one.
     #[serde(default)]
     pub channel_creds: Vec<ChannelCredentialConfig>,
     /// Server features (e.g., `["xds_v3"]`).
@@ -99,28 +173,82 @@ pub(crate) struct XdsServerConfig {
     pub server_features: Vec<String>,
 }
 
+impl XdsServerConfig {
+    /// First credential type this client supports, per gRFC A27.

```

**File**: `tonic-xds/src/xds/cert_provider/mod.rs` (modified, +4/-1)
```diff
@@ -281,7 +281,10 @@ mod tests {
     #[test]
     fn unknown_plugin_rejected_at_registry_build() {
         let json = r#"{
-            "xds_servers": [{"server_uri": "localhost:5000"}],
+            "xds_servers": [{
+                "server_uri": "localhost:5000",
+                "channel_creds": [{"type": "insecure"}]
+            }],
             "certificate_providers": {
                 "test": {
                     "plugin_name": "unknown_plugin",
```

---

### Incident Patch 14: `f58169b3` (2026-08-20)
**Commit Message**: fix(ci): exclude grpc crates from automated releases (#2828)

## Motivation

The tonic release PR currently includes the publishable gRPC crates
because release-plz manages publishable workspace members by default.
These crates need to remain manually publishable without being included
in automated tonic releases.

## Solution

Configure `grpc`, `grpc-protobuf`, `grpc-protobuf-build`, and
`protoc-gen-rust-grpc` with `release = false`. This disables release-plz
processing while preserving Cargo's default manual publishing behavior.

## Test plan

- [x] Run `git diff --check`
- [x] Verify every publishable gRPC-family crate has an explicit
release-plz exclusion
- [ ] Confirm the next release-plz refresh removes the gRPC crates from
the release PR

Made with [Cursor](https://cursor.com)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `release-plz.toml` (modified, +16/-3)
```diff
@@ -54,6 +54,19 @@ release = false
 name = "xds-client-opentelemetry"
 release = false
 
-# grpc group (single crate)
-#[[package]]
-#name = "grpc"
+# grpc crates: published manually for now
+[[package]]
+name = "grpc"
+release = false
+
+[[package]]
+name = "grpc-protobuf"
+release = false
+
+[[package]]
+name = "grpc-protobuf-build"
+release = false
+
+[[package]]
+name = "protoc-gen-rust-grpc"
+release = false
```

---

### Incident Patch 15: `ccadfd8a` (2026-08-20)
**Commit Message**: fix(transport): drop listener before draining connections (#2824)

## Motivation

`Server::serve_with_incoming_shutdown` stops polling the accept stream
when the shutdown signal completes. It then waits for already-accepted
connections to drain. The incoming stream itself was not dropped until
that drain finished.

For `TcpIncoming`, keeping the stream alive keeps the listen socket
open. The kernel continues to accept TCP handshakes into the backlog.
Those connections are never passed to the HTTP/2 or TLS stack. A new
client completes TCP, then waits until its own request deadline.

`shutdown_closes_listener_before_drain` fails on current `master` with:

```
new connect must fail promptly after shutdown, while drain is still in progress: Elapsed(())
```

A new `TcpStream::connect` still succeeds for the full 500 ms after
shutdown while an in-flight RPC is held. grpc-go `GracefulStop` closes
every listener first, then drains transports. `net/http.Server.Shutdown`
does the same.

## Solution

Scope the accept loop so `incoming` is dropped as soon as the shutdown
signal fires. `TcpIncoming`'s `Drop` closes the listen socket.
Already-accepted connections are then drained as before.

`s

**File**: `tests/integration_tests/tests/connection.rs` (modified, +111/-1)
```diff
@@ -23,9 +23,13 @@
  */
 
 use integration_tests::pb::{test_client::TestClient, test_server, Input, Output};
+use std::io;
+use std::pin::Pin;
 use std::sync::{Arc, Mutex};
+use std::task::{Context, Poll};
 use std::time::Duration;
-use tokio::{net::TcpListener, sync::oneshot};
+use tokio::{net::TcpListener, net::TcpStream, sync::oneshot};
+use tokio_stream::Stream;
 use tonic::{
     transport::{server::TcpIncoming, Endpoint, Server},
     Code, Request, Response, Status,
@@ -137,3 +141,109 @@ async fn connect_lazy_reconnects_after_first_failure() {
 
     jh.await.unwrap();
 }
+
+/// A unary handler. The call waits until `hold` is received.
+struct HoldSvc {
+    started: Mutex<Option<oneshot::Sender<()>>>,
+    hold: Mutex<Option<oneshot::Receiver<()>>>,
+}
+
+#[tonic::async_trait]
+impl test_server::Test for HoldSvc {
+    async fn unary_call(&self, _: Request<Input>) -> Result<Response<Output>, Status> {
+        let started = self.started.lock().unwrap().take();
+        if let Some(tx) = started {
+            let _ = tx.send(());
+        }
+        let hold = self.hold.lock().unwrap().take();
+        if let Some(rx) = hold {
+            let _ = rx.await;
+        }
+        Ok(Response::new(Output {}))
+    }
+}
+
+/// Forwards polls to `inner`. Sends on `on_drop` when this value is dropped.
+struct NotifyOnDrop<S> {
+    inner: S,
+    on_drop: Option<oneshot::Sender<()>>,
+}
+
+impl<S> Drop for NotifyOnDrop<S> {
+    fn drop(&mut self) {
+        if let Some(tx) = self.on_drop.take() {
+            let _ = tx.send(());
+        }
+    }
+}
+
+impl<S: Stream + Unpin> Stream for NotifyOnDrop<S> {
+    type Item = S::Item;
+
+    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
+        Pin::new(&mut self.inner).poll_next(cx)
+    }
+}
+
+/// Shutdown must drop `incoming` before in-flight RPCs complete.
+/// If `incoming` is a `TcpIncoming`, drop closes the listen socket.
+#[tokio::test]
+async fn shutdown_closes_listener_before_drain() {
+    let (started_tx, started_rx) = oneshot::channel();
+    let (hold_tx, hold_rx) = oneshot::channel();
+    let (shutdown_tx, shutdown_rx) = oneshot::channel();
+    let (dropped_tx, dropped_rx) = oneshot::channel();
+
+    let svc = test_server::TestServer::new(HoldSvc {
+        started: Mutex::new(Some(started_tx)),
+        hold: Mutex::new(Some(hold_rx)),
+    });
+
+    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let addr = listener.local_addr().unwrap();
+    let incoming = NotifyOnDrop {
+        inner: TcpIncoming::from(listener).with_nodelay(Some(true)),
+        on_drop: Some(dropped_tx),
+    };
+
+    let jh = tokio::spawn(async move {
+        Server::builder()
+            .add_service(svc)
+            .serve_with_incoming_shutdown(incoming, async { drop(shutdown_rx.await) })
+            .await
+            .unwrap();
+    });
+
+    let mut client = TestClient::connect(format!("http://{addr}")).await.unwrap();
+    let call = tokio::spawn(async move { client.unary_call(Request::new(Input {})).await });
+    started_rx.await.unwrap();
+
+    shutdown_tx.send(()).unwrap();
+
+    // Wait until `incoming` is dropped.
+    // Do not call connect in a loop before that.
+    // A connect loop can make `incoming.next()` ready.
+    // Then `select!` can accept the connection and ignore shutdown.
+    // The timeout is only a hang guard. On an unfixed server, drop
+    // waits for drain, and drain waits for `hold`.
+    tokio::time::timeout(Duration::from_secs(1), dropped_rx)
+        .await
+        .expect("incoming was not dropped before drain")
+        .unwrap();
+
+    let err = TcpStream::connect(addr)
+        .await
+        .expect_err("connect succeeded after incoming drop");
+    assert!(
+        matches!(
+            err.kind(),
+            io::ErrorKind::ConnectionRefused | io::ErrorKind::ConnectionReset
+        ),
+        "connect error was {:?}, not refused or reset",
+        err.kind()
+    );
+
+    hold_tx.send(()).unwrap();
+    call.await.unwrap().unwrap();
+    jh.await.unwrap();
+}
```

**File**: `tonic/src/transport/server/mod.rs` (modified, +45/-31)
```diff
@@ -745,6 +745,10 @@ impl<L> Server<L> {
     }
 
     /// Serve the service with the signal on the provided incoming stream.
+    ///
+    /// When `signal` completes, this function drops `incoming`.
+    /// If `incoming` is a [`TcpIncoming`], drop closes the listen socket.
+    /// The function then waits for accepted connections to close.
     pub async fn serve_with_incoming_shutdown<S, I, F, IO, IE, ResBody>(
         self,
         svc: S,
@@ -853,37 +857,44 @@ impl<L> Server<L> {
 
         let graceful = signal.is_some();
         let mut sig = pin!(Fuse { inner: signal });
-        let mut incoming = pin!(incoming);
-
-        loop {
-            tokio::select! {
-                _ = &mut sig => {
-                    trace!("signal received, shutting down");
-                    break;
-                },
-                io = incoming.next() => {
-                    let io = match io {
-                        Some(Ok(io)) => io,
-                        Some(Err(e)) => {
-                            trace!("error accepting connection: {}", DisplayErrorStack(&*e));
-                            continue;
-                        },
-                        None => {
-                            break
-                        },
-                    };
-
-                    trace!("connection accepted");
-
-                    let req_svc = svc
-                        .call(&io)
-                        .await
-                        .map_err(super::Error::from_source)?;
-
-                    let hyper_io = TokioIo::new(io);
-                    let hyper_svc = TowerToHyperService::new(req_svc.map_request(|req: Request<Incoming>| req.map(Body::new)));
-
-                    serve_connection(hyper_io, hyper_svc, server.clone(), graceful.then(|| signal_rx.clone()), max_connection_age, max_connection_age_grace);
+
+        // Scope the accept loop so `incoming` is dropped as soon as we stop
+        // accepting. For `TcpIncoming` that closes the listen socket immediately
+        // (kernel stops SYN-ACKing). Holding it until after drain leaves the
+        // port bound: new clients complete TCP, then hang until their deadline.
+        {
+            let mut incoming = pin!(incoming);
+
+            loop {
+                tokio::select! {
+                    _ = &mut sig => {
+                        trace!("signal received, shutting down");
+                        break;
+                    },
+                    io = incoming.next() => {
+                        let io = match io {
+                            Some(Ok(io)) => io,
+                            Some(Err(e)) => {
+                                trace!("error accepting connection: {}", DisplayErrorStack(&*e));
+                                continue;
+                            },
+                            None => {
+                                break
+                            },
+                        };
+
+                        trace!("connection accepted");
+
+                        let req_svc = svc
+                            .call(&io)
+                            .await
+                            .map_err(super::Error::from_source)?;
+
+                        let hyper_io = TokioIo::new(io);
+                        let hyper_svc = TowerToHyperService::new(req_svc.map_request(|req: Request<Incoming>| req.map(Body::new)));
+
+                        serve_connection(hyper_io, hyper_svc, server.clone(), graceful.then(|| signal_rx.clone()), max_connection_age, max_connection_age_grace);
+                    }
                 }
             }
         }
@@ -1114,6 +1125,9 @@ impl<L> Router<L> {
     /// `serve_with_shutdown` this method will also take a signal future to
     /// gracefully shutdown the server.
     ///
+    /// When `signal` completes, `incoming` is dropped immediately (closing a
+    /// TCP listener) and already-accepted connections are then drained.
+    ///
     /// This method discards any provided [`Server`] TCP configuration.
     ///
     /// [`Server`]: struct.Server.html
```

#### Recent Merged Pull Requests:
- **PR #2916** (closed): tonic-xds: add connection jitter for newly discovered endpoints (@mingley)
- **PR #2909** (closed): xds-client: reconnect block new watch (@W4lspirit)
- **PR #2904** (2026-10-01): tonic-xds: allow deprecated fetch_update until MSRV >= 1.95 (@YutaoMa)
- **PR #2903** (2026-10-02): grpc/load_balancing: Update error reporting in child manager. (@nathanielford)
- **PR #2902** (2026-10-01): xds-client: Parse message before considering it received (@ejona86)
- **PR #2900** (2026-09-29): grpc/lb: simplify and unify tests via new TestEnv (@dfawley)
- **PR #2899** (2026-09-30): grpc/service_config: Handle deserialization edge cases (@nathanielford)
- **PR #2898** (2026-09-30): xds-client: Correct grpc.xds_client.connected metric lifecycle (@ejona86)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
