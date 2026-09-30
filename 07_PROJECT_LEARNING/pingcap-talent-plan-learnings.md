# Forensic Learning Record (Deep Inspection): pingcap/talent-plan

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-talent-plan-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/talent-plan](https://github.com/pingcap/talent-plan))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:33:42.280Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/talent-plan`
- **Description**: open source training courses about distributed database and distributed systems
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11008 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `courses/dss/labcodec/demonstration/expanded_fixture.rs`
```
/// A simple protobuf message.
pub struct Msg {
    #[prost(enumeration = "msg::Type", tag = "1")]
    pub r#type: i32,
    #[prost(uint64, tag = "2")]
    pub id: u64,
    #[prost(string, tag = "3")]
    pub name: std::string::String,
    #[prost(bytes, repeated, tag = "4")]
    pub paylad: ::std::vec::Vec<std::vec::Vec<u8>>,
}
#[automatically_derived]
#[allow(unused_qualifications)]
impl ::core::clone::Clone for Msg {
    #[inline]
    fn clone(&self) -> Msg {
        match *self {
            Msg {
                r#type: ref __self_0_0,
                id: ref __self_0_1,
                name: ref __self_0_2,
                paylad: ref __self_0_3,
            } => Msg {
                r#type: ::core::clone::Clone::clone(&(*__self_0_0)),
                id: ::core::clone::Clone::clone(&(*__self_0_1)),
                name: ::core::clone::Clone::clone(&(*__self_0_2)),
                paylad: ::core::clone::Clone::clone(&(*__self_0_3)),
            },
        }
    }
}
impl ::core::marker::StructuralPartialEq for Msg {}
#[automatically_derived]
#[allow(unused_qualifications)]
impl ::core::cmp::PartialEq for Msg {
    #[inline]
    fn eq(&self, other: &Msg) -> bool {
        match *other {
            Msg {
                r#type: ref __self_1_0,
                id: ref __self_1_1,
                name: ref __self_1_2,
                paylad: ref __self_1_3,
            } => match *self {
                Msg {
                    r#type: ref __self_0_0,
                    id: ref __self_0_1,
                    name: ref __self_0_2,
                    paylad: ref __self_0_3,
                } => {
                    (*__self_0_0) == (*__self_1_0)
                        && (*__self_0_1) == (*__self_1_1)
                        && (*__self_0_2) == (*__self_1_2)
                        && (*__self_0_3) == (*__self_1_3)
                }
            },
        }
    }
    #[inline]
    fn ne(&self, other: &Msg) -> bool {
        match *other {
            Msg {
                r#type: ref __self_1_0,
                id: ref __self_1_1,
                name: ref __self_1_2,
                paylad: ref __self_1_3,
            } => match *self {
                Msg {
                    r#type: ref __self_0_0,
                    id: ref __self_0_1,
                    name: ref __self_0_2,
                    paylad: ref __self_0_3,
                } => {
                    (*__self_0_0) != (*__self_1_0)
                        || (*__self_0_1) != (*__self_1_1)
                        || (*__self_0_2) != (*__self_1_2)
                        || (*__self_0_3) != (*__self_1_3)
                }
            },
        }
    }
}
impl ::prost::Message for Msg {
    #[allow(unused_variables)]
    fn encode_raw<B>(&self, buf: &mut B)
    where
        B: ::prost::bytes::BufMut,
    {
        if self.r#type != msg::Type::default() as i32 {
            ::prost::encoding::int32::encode(1u32, &self.r#type, buf);
        }
        if self.id != 0u64 {
            ::prost::encoding::uint64::encode(2u32, &self.id, buf);
        }
        if self.name != "" {
            ::prost::encoding::string::encode(3u32, &self.name, buf);
        }
        ::prost::encoding::bytes::encode_repeated(4u32, &self.paylad, buf);
    }
    #[allow(unused_variables)]
    fn merge_field<B>(
        &mut self,
        tag: u32,
        wire_type: ::prost::encoding::WireType,
        buf: &mut B,
        ctx: ::prost::encoding::DecodeContext,
    ) -> ::std::result::Result<(), ::prost::DecodeError>
    where
        B: ::prost::bytes::Buf,
    {
        const STRUCT_NAME: &'static str = "Msg";
        match tag {
            1u32 => {
                let mut value = &mut self.r#type;
                ::prost::encoding::int32::merge(wire_type, value, buf, ctx).map_err(|mut error| {
                    error.push(STRUCT_NAME, "r#type");
                    error
                })
            }
            2u32 => {
                let mut value = &mut self.id;
                ::prost::encoding::uint64::merge(wire_type, value, buf, ctx).map_err(|mut error| {
                    error.push(STRUCT_NAME, "id");
                    error
                })
            }
            3u32 => {
                let mut value = &mut self.name;
                ::prost::encoding::string::merge(wire_type, value, buf, ctx).map_err(|mut error| {
                    error.push(STRUCT_NAME, "name");
                    error
                })
            }
            4u32 => {
                let mut value = &mut self.paylad;
                ::prost::encoding::bytes::merge_repeated(wire_type, value, buf, ctx).map_err(
                    |mut error| {
                        error.push(STRUCT_NAME, "paylad");
                        error
                    },
                )
            }
            _ => ::prost::encoding::skip_field(wire_type, tag, buf, ctx),
        }
    }
    #[inline]
    fn encoded_len(&self) -> usize {
        0 + if self.r#type != msg::Type::default() as i32 {
            ::prost::encoding::int32::encoded_len(1u32, &self.r#type)
        } else {
            0
        } + if self.id != 0u64 {
            ::prost::encoding::uint64::encoded_len(2u32, &self.id)
        } else {
            0
        } + if self.name != "" {
            ::prost::encoding::string::encoded_len(3u32, &self.name)
        } else {
            0
        } + ::prost::encoding::bytes::encoded_len_repeated(4u32, &self.paylad)
    }
    fn clear(&mut self) {
        self.r#type = msg::Type::default() as i32;
        self.id = 0u64;
        self.name.clear();
        self.paylad.clear();
    }
}
impl Default for Msg {
    fn default() -> Msg {
        Msg {
            r#type: msg::Type::default() as i32,
            id: 0u64,
            name: ::std::string::String::new(),
            paylad: ::std::vec::Vec::new(),
        }
    }
}
impl ::std::fmt::Debug for Msg {
    fn fmt(&self, f: &mut ::std::fmt::Formatter) -> ::std::fmt::Result {
        let mut builder = f.debug_struct("Msg");
        let builder = {
            let wrapper = {
                struct ScalarWrapper<'a>(&'a i32);
                impl<'a> ::std::fmt::Debug for ScalarWrapper<'a> {
                    fn fmt(&self, f: &mut ::std::fmt::Formatter) -> ::std::fmt::Result {
                        match msg::Type::from_i32(*self.0) {
                            None => ::std::fmt::Debug::fmt(&self.0, f),
                            Some(en) => ::std::fmt::Debug::fmt(&en, f),
                        }
                    }
                }
                ScalarWrapper(&self.r#type)
            };
            builder.field("r#type", &wrapper)
        };
        let builder = {
            let wrapper = {
                fn ScalarWrapper<T>(v: T) -> T {
                    v
                }
                ScalarWrapper(&self.id)
            };
            builder.field("id", &wrapper)
        };
        let builder = {
            let wrapper = {
                fn ScalarWrapper<T>(v: T) -> T {
                    v
                }
                ScalarWrapper(&self.name)
            };
            builder.field("name", &wrapper)
        };
        let builder = {
            let wrapper = {
                struct ScalarWrapper<'a>(&'a ::std::vec::Vec<::std::vec::Vec<u8>>);
                impl<'a> ::std::fmt::Debug for ScalarWrapper<'a> {
                    fn fmt(&self, f: &mut ::std::fmt::Formatter) -> ::std::fmt::Result {
                        let mut vec_builder = f.debug_list();
                        for v in self.0 {
                            fn Inner<T>(v: T) -> T {
                                v
                            }
                            vec_builder.entry(&Inner(v));
                        }
                        vec_builder.finish()
                    }
                }
                ScalarWrapper(&self.paylad)
            };
            builder.field("paylad", &wrapper)
        };
        
```

### Core Architecture Module: `courses/dss/labcodec/src/lib.rs`
```
//! A thin wrapper of [prost](https://docs.rs/prost/0.6.1/prost/)

/// A labcodec message.
pub trait Message: prost::Message + Default {}
impl<T: prost::Message + Default> Message for T {}

/// A message encoding error.
pub type EncodeError = prost::EncodeError;
/// A message decoding error.
pub type DecodeError = prost::DecodeError;

/// Encodes the message to a `Vec<u8>`.
pub fn encode<M: Message>(message: &M, buf: &mut Vec<u8>) -> Result<(), EncodeError> {
    buf.reserve(message.encoded_len());
    message.encode(buf)?;
    Ok(())
}

/// Decodes an message from the buffer.
pub fn decode<M: Message>(buf: &[u8]) -> Result<M, DecodeError> {
    M::decode(buf)
}

#[cfg(test)]
mod tests {
    mod fixture {
        // The generated rust file:
        // labs6824/target/debug/build/labcodec-hashhashhashhash/out/fixture.rs
        //
        // It looks like:
        //
        // ```no_run
        // /// A simple protobuf message.
        // #[derive(Clone, PartialEq, Message)]
        // pub struct Msg {
        //     #[prost(enumeration="msg::Type", tag="1")]
        //     pub type_: i32,
        //     #[prost(uint64, tag="2")]
        //     pub id: u64,
        //     #[prost(string, tag="3")]
        //     pub name: String,
        //     #[prost(bytes, repeated, tag="4")]
        //     pub paylad: ::std::vec::Vec<Vec<u8>>,
        // }
        // pub mod msg {
        //     #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Enumeration)]
        //     pub enum Type {
        //         Unknown = 0,
        //         Put = 1,
        //         Get = 2,
        //         Del = 3,
        //     }
        // }
        // ```
        include!(concat!(env!("OUT_DIR"), "/fixture.rs"));
    }

    use super::{decode, encode};

    #[test]
    fn test_basic_encode_decode() {
        let msg = fixture::Msg {
            r#type: fixture::msg::Type::Put as _,
            id: 42,
            name: "the answer".to_owned(),
            paylad: vec![vec![7; 3]; 2],
        };
        let mut buf = vec![];
        encode(&msg, &mut buf).unwrap();
        let msg1 = decode(&buf).unwrap();
        assert_eq!(msg, msg1);
    }

    #[test]
    fn test_default() {
        let msg = fixture::Msg::default();
        let msg1 = decode(&[]).unwrap();
        assert_eq!(msg, msg1);
    }
}

```

### Core Architecture Module: `courses/dss/labrpc/benches/rpc.rs`
```
use std::sync::{Arc, Mutex};

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use futures::executor::block_on;
use prost_derive::Message;

use labrpc::{service, Network, Result, Server, ServerBuilder};

service! {
    /// A simple bench-purpose service.
    service bench {
        /// Doc comments.
        rpc handler(BenchArgs) returns (BenchReply);
    }
}
use bench::{add_service, Client as BenchClient, Service};

// Hand-written protobuf messages.
#[derive(Clone, PartialEq, Message)]
pub struct BenchArgs {
    #[prost(int64, tag = "1")]
    pub x: i64,
}

#[derive(Clone, PartialEq, Message)]
pub struct BenchReply {
    #[prost(string, tag = "1")]
    pub x: String,
}

#[derive(Default)]
struct BenchInner {
    log2: Vec<i64>,
}
#[derive(Clone)]
pub struct BenchService {
    inner: Arc<Mutex<BenchInner>>,
}
impl BenchService {
    fn new() -> BenchService {
        BenchService {
            inner: Arc::default(),
        }
    }
}

#[async_trait::async_trait]
impl Service for BenchService {
    async fn handler(&self, args: BenchArgs) -> Result<BenchReply> {
        self.inner.lock().unwrap().log2.push(args.x);
        Ok(BenchReply {
            x: format!("handler-{}", args.x),
        })
    }
}

fn bench_suit() -> (Network, Server, BenchService) {
    let net = Network::new();
    let server_name = "test_server".to_owned();
    let mut builder = ServerBuilder::new(server_name);
    let bench_server = BenchService::new();
    add_service(bench_server.clone(), &mut builder).unwrap();
    let server = builder.build();
    net.add_server(server.clone());
    (net, server, bench_server)
}

fn bench_rpc(c: &mut Criterion) {
    let (net, server, _bench_server) = bench_suit();
    let server_name = server.name();
    let client_name = "client";
    let client = BenchClient::new(net.create_client(client_name.to_owned()));
    net.connect(client_name, server_name);
    net.enable(client_name, true);

    c.bench_function("rpc", |b| {
        b.iter(|| {
            black_box(block_on(async {
                client.handler(&BenchArgs { x: 111 }).await.unwrap()
            }));
        })
        // i7-8650U, 13 microseconds per RPC
    });
}

criterion_group!(benches, bench_rpc);
criterion_main!(benches);

```

### Core Architecture Module: `courses/dss/labrpc/examples/echo.rs`
```
use futures::executor::block_on;
use prost_derive::Message;

use labrpc::*;

/// A Hand-written protobuf messages
#[derive(Clone, PartialEq, Message)]
pub struct Echo {
    #[prost(int64, tag = "1")]
    pub x: i64,
}

service! {
    service echo {
        rpc ping(Echo) returns (Echo);
    }
}
use echo::{add_service, Client, Service};

#[derive(Clone)]
struct EchoService;

#[async_trait::async_trait]
impl Service for EchoService {
    async fn ping(&self, input: Echo) -> Result<Echo> {
        Ok(input)
    }
}

fn main() {
    let rn = Network::new();
    let server_name = "echo_server";
    let mut builder = ServerBuilder::new(server_name.to_owned());
    add_service(EchoService, &mut builder).unwrap();
    let server = builder.build();
    rn.add_server(server);

    let client_name = "client";
    let client = Client::new(rn.create_client(client_name.to_owned()));
    rn.enable(client_name, true);
    rn.connect(client_name, server_name);

    let reply = block_on(async { client.ping(&Echo { x: 777 }).await.unwrap() });
    assert_eq!(reply, Echo { x: 777 });
    println!("{:?}", reply);
}

```

### Core Architecture Module: `courses/dss/labrpc/src/client.rs`
```
use std::fmt;
use std::sync::{Arc, Mutex};

use futures::channel::mpsc::UnboundedSender;
use futures::channel::oneshot;
use futures::executor::ThreadPool;
use futures::future::{self, FutureExt};

use crate::error::{Error, Result};
use crate::server::RpcFuture;

pub struct Rpc {
    pub(crate) client_name: String,
    pub(crate) fq_name: &'static str,
    pub(crate) req: Option<Vec<u8>>,
    pub(crate) resp: Option<oneshot::Sender<Result<Vec<u8>>>>,
    pub(crate) hooks: Arc<Mutex<Option<Arc<dyn RpcHooks>>>>,
}

impl Rpc {
    pub(crate) fn take_resp_sender(&mut self) -> Option<oneshot::Sender<Result<Vec<u8>>>> {
        self.resp.take()
    }
}

impl fmt::Debug for Rpc {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.debug_struct("Rpc")
            .field("client_name", &self.client_name)
            .field("fq_name", &self.fq_name)
            .finish()
    }
}

pub trait RpcHooks: Sync + Send + 'static {
    fn before_dispatch(&self, fq_name: &str, req: &[u8]) -> Result<()>;
    fn after_dispatch(&self, fq_name: &str, resp: Result<Vec<u8>>) -> Result<Vec<u8>>;
}

#[derive(Clone)]
pub struct Client {
    // this end-point's name
    pub(crate) name: String,
    // copy of Network.sender
    pub(crate) sender: UnboundedSender<Rpc>,
    pub(crate) hooks: Arc<Mutex<Option<Arc<dyn RpcHooks>>>>,

    pub worker: ThreadPool,
}

impl Client {
    pub fn call<Req, Rsp>(&self, fq_name: &'static str, req: &Req) -> RpcFuture<Result<Rsp>>
    where
        Req: labcodec::Message,
        Rsp: labcodec::Message + 'static,
    {
        let mut buf = vec![];
        if let Err(e) = labcodec::encode(req, &mut buf) {
            return Box::pin(future::err(Error::Encode(e)));
        }

        let (tx, rx) = oneshot::channel();
        let rpc = Rpc {
            client_name: self.name.clone(),
            fq_name,
            req: Some(buf),
            resp: Some(tx),
            hooks: self.hooks.clone(),
        };

        // Sends requests and waits responses.
        if self.sender.unbounded_send(rpc).is_err() {
            return Box::pin(future::err(Error::Stopped));
        }

        Box::pin(rx.then(|res| async move {
            match res {
                Ok(Ok(resp)) => labcodec::decode(&resp).map_err(Error::Decode),
                Ok(Err(e)) => Err(e),
                Err(e) => Err(Error::Recv(e)),
            }
        }))
    }

    pub fn set_hooks(&self, hooks: Arc<dyn RpcHooks>) {
        *self.hooks.lock().unwrap() = Some(hooks);
    }

    pub fn clear_hooks(&self) {
        *self.hooks.lock().unwrap() = None;
    }
}

```

### Core Architecture Module: `courses/dss/labrpc/src/error.rs`
```
use std::{error, fmt, result};

use futures::channel::oneshot::Canceled;

use labcodec::{DecodeError, EncodeError};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Unimplemented(String),
    Encode(EncodeError),
    Decode(DecodeError),
    Recv(Canceled),
    Timeout,
    Stopped,
    Other(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl error::Error for Error {
    fn source(&self) -> Option<&(dyn error::Error + 'static)> {
        match *self {
            Error::Encode(ref e) => Some(e),
            Error::Decode(ref e) => Some(e),
            Error::Recv(ref e) => Some(e),
            _ => None,
        }
    }
}

pub type Result<T> = result::Result<T, Error>;

```

### Core Architecture Module: `courses/dss/labrpc/src/lib.rs`
```
#![allow(clippy::new_without_default)]

mod client;
mod error;
#[macro_use]
mod macros;
mod network;
mod server;

pub use self::client::{Client, Rpc, RpcHooks};
pub use self::error::{Error, Result};
pub use self::network::Network;
pub use self::server::{Handler, HandlerFactory, RpcFuture, Server, ServerBuilder};

#[cfg(test)]
pub mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Arc, Mutex, Once};
    use std::thread;
    use std::time::{Duration, Instant};

    use futures::channel::oneshot::Canceled;
    use futures::executor::{block_on, ThreadPool};
    use futures::stream::StreamExt;
    use futures_timer::Delay;
    use prost_derive::Message;

    use super::*;

    service! {
        /// A simple test-purpose service.
        service junk {
            /// Doc comments.
            rpc handler2(JunkArgs) returns (JunkReply);
            rpc handler3(JunkArgs) returns (JunkReply);
            rpc handler4(JunkArgs) returns (JunkReply);
        }
    }
    use junk::{add_service, Client as JunkClient, Service as Junk};

    // Hand-written protobuf messages.
    #[derive(Clone, PartialEq, Message)]
    pub struct JunkArgs {
        #[prost(int64, tag = "1")]
        pub x: i64,
    }
    #[derive(Clone, PartialEq, Message)]
    pub struct JunkReply {
        #[prost(string, tag = "1")]
        pub x: String,
    }

    #[derive(Default)]
    struct JunkInner {
        log2: Vec<i64>,
    }
    #[derive(Clone)]
    struct JunkService {
        inner: Arc<Mutex<JunkInner>>,
    }
    impl JunkService {
        fn new() -> JunkService {
            JunkService {
                inner: Arc::default(),
            }
        }
    }
    #[async_trait::async_trait]
    impl Junk for JunkService {
        async fn handler2(&self, args: JunkArgs) -> Result<JunkReply> {
            self.inner.lock().unwrap().log2.push(args.x);
            Ok(JunkReply {
                x: format!("handler2-{}", args.x),
            })
        }
        async fn handler3(&self, args: JunkArgs) -> Result<JunkReply> {
            Delay::new(Duration::from_secs(20)).await;
            Ok(JunkReply {
                x: format!("handler3-{}", -args.x),
            })
        }
        async fn handler4(&self, _: JunkArgs) -> Result<JunkReply> {
            Ok(JunkReply {
                x: "pointer".to_owned(),
            })
        }
    }

    fn init_logger() {
        static LOGGER_INIT: Once = Once::new();
        LOGGER_INIT.call_once(env_logger::init);
    }

    #[test]
    fn test_service_dispatch() {
        init_logger();

        let mut builder = ServerBuilder::new("test".to_owned());
        let junk = JunkService::new();
        add_service(junk.clone(), &mut builder).unwrap();
        let prev_len = builder.services.len();
        add_service(junk, &mut builder).unwrap_err();
        assert_eq!(builder.services.len(), prev_len);
        let server = builder.build();

        let buf = block_on(async { server.dispatch("junk.handler4", &[]).await.unwrap() });
        let rsp = labcodec::decode(&buf).unwrap();
        assert_eq!(
            JunkReply {
                x: "pointer".to_owned(),
            },
            rsp,
        );

        block_on(async {
            server
                .dispatch("junk.handler4", b"bad message")
                .await
                .unwrap_err();

            server.dispatch("badjunk.handler4", &[]).await.unwrap_err();

            server.dispatch("junk.badhandler", &[]).await.unwrap_err();
        });
    }

    #[test]
    fn test_network_client_rpc() {
        init_logger();

        let mut builder = ServerBuilder::new("test".to_owned());
        let junk = JunkService::new();
        add_service(junk, &mut builder).unwrap();
        let server = builder.build();

        let (net, incoming) = Network::create();
        net.add_server(server);

        let client = JunkClient::new(net.create_client("test_client".to_owned()));
        let (tx, rx) = mpsc::channel();
        let cli = client.clone();
        client.spawn(async move {
            let reply = cli.handler4(&JunkArgs { x: 777 }).await;
            tx.send(reply).unwrap();
        });
        let (mut rpc, incoming) = block_on(async {
            match incoming.into_future().await {
                (Some(rpc), s) => (rpc, s),
                _ => panic!("unexpected error"),
            }
        });
        let reply = JunkReply {
            x: "boom!!!".to_owned(),
        };
        let mut buf = vec![];
        labcodec::encode(&reply, &mut buf).unwrap();
        let resp = rpc.take_resp_sender().unwrap();
        resp.send(Ok(buf)).unwrap();
        assert_eq!(rpc.client_name, "test_client");
        assert_eq!(rpc.fq_name, "junk.handler4");
        assert!(!rpc.req.as_ref().unwrap().is_empty());
        assert_eq!(rx.recv().unwrap(), Ok(reply));

        let (tx, rx) = mpsc::channel();
        let cli = client.clone();
        client.spawn(async move {
            let reply = cli.handler4(&JunkArgs { x: 777 }).await;
            tx.send(reply).unwrap();
        });
        let (rpc, incoming) = block_on(async {
            match incoming.into_future().await {
                (Some(rpc), s) => (rpc, s),
                _ => panic!("unexpected error"),
            }
        });
        drop(rpc.resp);
        assert_eq!(rx.recv().unwrap(), Err(Error::Recv(Canceled)));

        drop(incoming);
        assert_eq!(
            block_on(async { client.handler4(&JunkArgs::default()).await }),
            Err(Error::Stopped)
        );
    }

    fn junk_suit() -> (Network, Server, JunkService) {
        let net = Network::new();
        let server_name = "test_server".to_owned();
        let mut builder = ServerBuilder::new(server_name);
        let junk_server = JunkService::new();
        add_service(junk_server.clone(), &mut builder).unwrap();
        let server = builder.build();
        net.add_server(server.clone());
        (net, server, junk_server)
    }

    #[test]
    fn test_basic() {
        init_logger();

        let (net, _, _) = junk_suit();

        let client = JunkClient::new(net.create_client("test_client".to_owned()));
        net.connect("test_client", "test_server");
        net.enable("test_client", true);

        let rsp = block_on(async { client.handler4(&JunkArgs::default()).await.unwrap() });
        assert_eq!(
            JunkReply {
                x: "pointer".to_owned(),
            },
            rsp,
        );
    }

    // does net.Enable(endname, false) really disconnect a client?
    #[test]
    fn test_disconnect() {
        init_logger();

        let (net, _, _) = junk_suit();

        let client = JunkClient::new(net.create_client("test_client".to_owned()));
        net.connect("test_client", "test_server");

        block_on(async { client.handler4(&JunkArgs::default()).await.unwrap_err() });

        net.enable("test_client", true);
        let rsp = block_on(async { client.handler4(&JunkArgs::default()).await.unwrap() });

        assert_eq!(
            JunkReply {
                x: "pointer".to_owned(),
            },
            rsp,
        );
    }

    // test net.GetCount()
    #[test]
    fn test_count() {
        init_logger();

        let (net, _, _) = junk_suit();

        let client = JunkClient::new(net.create_client("test_client".to_owned()));
        net.connect("test_client", "test_server");
        net.enable("test_client", true);

        for i in 0..=16 {
            let reply = block_on(async { client.handler2(&JunkArgs { x: i }).await.unwrap() });
            assert_eq!(reply.x, format!("handler2-{}", i));
        }

        assert_eq!(net.count("test_server"), 17);
    }

    // test RPCs from concurrent Clients
    #[test]
    fn test_concurrent_many() {
        init_logger();

        let (net, server, _) = junk_suit();
        let server_name = server.name();

        let pool = ThreadPool::new().unwrap();
        let (tx, rx) = mpsc::channel:
```

### Core Architecture Module: `courses/dss/labrpc/src/macros.rs`
```
#[macro_export]
macro_rules! service {
    () => {
        compile_error!("empty service is not allowed");
    };
    (
        $(#[$service_attr:meta])*
        service $svc_name:ident {
            $(
                $(#[$method_attr:meta])*
                rpc $method_name:ident($input:ty) returns ($output:ty);
            )*
        }
    ) => {
        $(#[$service_attr])*
        pub mod $svc_name {
            // In order to find input and output.
            use super::*;
            // $( use super::$input; )*
            // $( use super::$output;)*

            extern crate futures as __futures;

            #[async_trait::async_trait]
            pub trait Service: Clone + Send + 'static {
                $(
                    $(#[$method_attr])*
                    async fn $method_name(&self, req: $input) -> $crate::Result<$output>;
                )*
            }

            #[derive(Clone)]
            pub struct Client {
                client: $crate::Client,
            }
            impl Client {
                pub fn new(client: $crate::Client) -> Client {
                    Client { client }
                }

                pub fn spawn<F>(&self, f: F)
                where F: __futures::Future<Output = ()> + Send + 'static
                {
                    self.client.worker.spawn_ok(f);
                }

                $(pub fn $method_name(&self, args: &$input) -> $crate::RpcFuture<$crate::Result<$output>> {
                    let fq_name = concat!(stringify!($svc_name), ".", stringify!($method_name));
                    self.client.call(fq_name, args)
                })*
            }

            pub fn add_service<T: Service>(svc: T, builder: &mut $crate::ServerBuilder) -> $crate::Result<()> {
                use ::std::sync::Mutex;
                struct Factory<S> {
                    svc: Mutex<S>,
                }
                impl<S: Service> $crate::HandlerFactory for Factory<S> {
                    fn handler(&self, name: &'static str) -> Box<$crate::Handler> {
                        let s = self.svc.lock().unwrap().clone();
                        Box::new(move |req| {
                            match name {
                                $(stringify!($method_name) => {
                                    let request = match labcodec::decode(req) {
                                        Ok(req) => req,
                                        Err(e) => return Box::pin(__futures::future::err(
                                            $crate::Error::Decode(e)
                                        )),
                                    };
                                    Box::pin(async move {
                                        let f = s.$method_name(request);
                                        let resp = f.await;
                                        match resp {
                                            Ok(resp) => {
                                                let mut rsp = vec![];
                                                labcodec::encode(&resp, &mut rsp).map_err($crate::Error::Encode)?;
                                                Ok(rsp)
                                            }
                                            Err(e) => Err(e),
                                        }
                                    })
                                })*
                                other => {
                                    Box::pin(__futures::future::err(
                                        $crate::Error::Unimplemented(
                                            format!("unknown {} in {}", other, stringify!($svc_name))
                                        )
                                    ))
                                }
                            }
                        })
                    }
                }

                let fact = Factory {
                    svc: Mutex::new(svc),
                };

                builder.add_service(stringify!($svc_name), Box::new(fact))
            }
        }
    };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #470** (2026-07-11): **courses/dss: fixed compilation errors and clippy warnings**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Fixed compilation errors and resolved clippy warnings that were appearing while running `make test_others`

- **Issue #468** (2024-12-16): **Jchen/raft lab2a leader election**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Issue number: close #xxx <!-- remove this line if no issue to close --> - Breif description of the problem:  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - Unit test  - Integration test  - Manual test (add detailed scripts or steps below)  - No code  Side effects   - Possible performance regression  - Increased code complexity  Related changes   - Need to update the documentation 

- **Issue #467** (2024-12-16): **Fixing the clippy**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Issue number: close #xxx <!-- remove this line if no issue to close --> - Breif description of the problem:  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - Unit test  - Integration test  - Manual test (add detailed scripts or steps below)  - No code  Side effects   - Possible performance regression  - Increased code complexity  Related changes   - Need to update the documentation 

- **Issue #460** (2023-09-18): **Mine**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Issue number: close #xxx <!-- remove this line if no issue to close --> - Breif description of the problem:  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - Unit test  - Integration test  - Manual test (add detailed scripts or steps below)  - No code  Side effects   - Possible performance regression  - Increased code complexity  Related changes   - Need to update the documentation 

- **Issue #458** (2026-04-05): **Project 3: Sled db reopen could fail on `could not acquire lock on ....` on Linux**
  *Symptoms*: Should we add some timeouts after we kill the server process?  ``` let handle = thread::spawn(move || {     let _ = receiver.recv(); // wait for main thread to finish     child.kill().expect("server exited before killed"); }); ```  When we kill the child process in which server is running, if open the sled db immediately before `LOCK_UN` takes effect, we probably will get this error.  Maybe adding some timeouts like 50ms or so in between can make the test `cli_access_server_sled_engine` more reliable. 
  **Post-Mortem & Fix Analysis**:
  > Also see the issue for sled here: https://github.com/spacejam/sled/issues/1234

- **Issue #457** (2023-02-26): **Update tp102-how-to-use-git-github.md**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Breif description of the problem: the learning course uri is invalid  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - No code   Related changes   - Need to update the documentation 

- **Issue #456** (2023-01-26): **(WIP) raft with rust**
  *Symptoms*: 

- **Issue #455** (2024-03-14): **rust project-3 tests/cli.rs: revise mistyped "get", **
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  In rust project-3 tests/cli.rs `cli_invalid_set` function, the fifth command should test "set" command, while testing "get".  ### What is changed and how it works?  Replace "get" with "set".  ### Tests I suppose this PR do not need further tests.

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

### Incident Patch 1: `2c02b586` (2022-06-06)
**Commit Message**: fix clippy error (#414)

fix clippy error: this expression borrows a reference that is
immediately dereferenced by the compiler

**File**: `courses/dss/labrpc/src/network.rs` (modified, +1/-1)
```diff
@@ -350,7 +350,7 @@ async fn server_dead(
 ) {
     loop {
         Delay::new(interval).await;
-        if net.is_server_dead(&client_name, &server_name, server_id) {
+        if net.is_server_dead(client_name, server_name, server_id) {
             debug!("{:?} is dead", server_name);
             return;
         }
```

**File**: `courses/dss/raft/src/kvraft/tests.rs` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ fn generic_test(
                                 j += 1;
                             } else {
                                 debug!("{}: client new get {:?}", cli, key);
-                                let v = get(&cfg1, &myck, &key);
+                                let v = get(&cfg1, myck, &key);
                                 if v != last {
                                     panic!(
                                         "get wrong value, key {:?}, wanted:\n{:?}\n, got\n{:?}",
```

---

### Incident Patch 2: `3d9d3d7f` (2022-06-06)
**Commit Message**: fix link about Talent Plan Site (#415)

**File**: `talent-plan-1.0/README-CN.md` (modified, +6/-6)
```diff
@@ -11,10 +11,10 @@ Talent Plan 1.0 课程中共有 2 条学习路径供大家选择，分别是：
 >
 > Talent Plan 2.0 课程已正式上线，相比 1.0 版本，新增了用 Go 语言全新设计的分布式关系型数据库 TinySQL 课程和分布式 Key-value 数据库 TinyKV 课程，并结合大家的兴趣爱好和知识背景全新规划了 5 条推荐的学习路径，分别是：
 >
-> * 路径 1：[实现一个 Mini 版本的分布式关系型数据库](https://university.pingcap.com/talent-plan/implement-a-mini-distributed-relational-database)
-> * 路径 2：[实现一个 Mini 版本的分布式 Key-value 数据库](https://university.pingcap.com/talent-plan/implement-a-mini-distributed-key-value-database)
-> * 路径 3：[参与工业级开源分布式关系型数据库 TiDB 的开发实践](https://university.pingcap.com/talent-plan/become-a-tidb-contributor)
-> * 路径 4：[参与工业级开源分布式 Key-value 数据库 TiKV 的开发实践](https://university.pingcap.com/talent-plan/become-a-tikv-contributor)
-> * 路径 5：[Rust 编程原理与实践](https://university.pingcap.com/talent-plan/rust-programming)
+> * 路径 1：[实现一个 Mini 版本的分布式关系型数据库](https://learn.pingcap.com/learner/talent-plan/implement-a-mini-distributed-relational-database)
+> * 路径 2：[实现一个 Mini 版本的分布式 Key-value 数据库](https://learn.pingcap.com/learner/talent-plan/implement-a-mini-distributed-key-value-database)
+> * 路径 3：[参与工业级开源分布式关系型数据库 TiDB 的开发实践](https://learn.pingcap.com/learner/talent-plan/become-a-tidb-contributor)
+> * 路径 4：[参与工业级开源分布式 Key-value 数据库 TiKV 的开发实践](https://learn.pingcap.com/learner/talent-plan/become-a-tikv-contributor)
+> * 路径 5：[Rust 编程原理与实践](>https://learn.pingcap.com/learner/talent-plan/rust-programming)
 >
-> 小伙伴们也可直接通过 [Talent Plan 官网](https://university.pingcap.com/talent-plan/) 开始 Talent Plan 2.0 课程的学习。
+> 小伙伴们也可直接通过 [Talent Plan 官网](https://learn.pingcap.com/learner/talent-plan) 开始 Talent Plan 2.0 课程的学习。
```

---

### Incident Patch 3: `a41b846b` (2022-04-06)
**Commit Message**: README.md: fix the link error (#410)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ We love our community and take great care to ensure it is fun, safe and rewardin
 
 ## We're here to help
 
-If you have questions about building (or taking) courses, you can ask in the channel **#wg-talent-plan-courses** of the [tidbcommunity](https://pingcap.com/tidbslack/) slack workspace.
+If you have questions about building (or taking) courses, you can ask in the channel **#wg-talent-plan-courses** of the [tidbcommunity](https://tidbcommunity.slack.com/join/shared_invite/enQtNzc0MzI4ODExMDc4LWYwYmIzMjZkYzJiNDUxMmZlN2FiMGJkZjAyMzQ5NGU0NGY0NzI3NTYwMjAyNGQ1N2I2ZjAxNzc1OGUwYWM0NzE#/shared-invite/email) slack workspace.
 
 ## License
 
```

---

### Incident Patch 4: `e37ab243` (2021-08-26)
**Commit Message**: Fix bug: remove unnecessary nested match from clippy (#387)

When compiling with rustc 1.50.0, clippy issues the error: `Unnecessary nested match` for the file raft/src/raft/tests.rs:693:17.



---

### Incident Patch 5: `477c9446` (2021-07-12)
**Commit Message**: fix typo (#388)

**File**: `courses/rust/building-blocks/bb-3.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Read all the readings and perform all the exercises.
   about how logging works in Rust.
 
 - **[Reading: `slog` crate API][sl]**. Another popular logging crate, designed
-  for "structured loging". Again, just read the crate-level docs, to compare to
+  for "structured logging". Again, just read the crate-level docs, to compare to
   `log`. You might also want to look at ["Introduction to structured logging
   with slog"][sli].
 
```

---

### Incident Patch 6: `a5dccffb` (2021-02-06)
**Commit Message**: courses/rust/projects/project-[3-4]: fix errors due to crate compatibility (#384)

* update version of sled and criterion to fix some errors with latest rust

* Modify the code corresponding to project3 and update version of crossbeam-skiplist

**File**: `courses/rust/projects/project-3/Cargo.lock` (modified, +595/-436)
```diff
@@ -2,1068 +2,1227 @@
 # It is not intended for manual editing.
 [[package]]
 name = "aho-corasick"
-version = "0.7.3"
+version = "0.7.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7404febffaa47dac81aa44dba71523c9d069b1bdc50a77db41195149e17f68e5"
 dependencies = [
- "memchr 2.2.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "memchr",
 ]
 
 [[package]]
 name = "ansi_term"
 version = "0.11.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ee49baf6cb617b853aa8d93bf420db2383fab46d314482ca2803b40d5fde979b"
 dependencies = [
- "winapi 0.3.7 (registry+https://github.com/rust-lang/crates.io-index)",
-]
-
-[[package]]
-name = "arrayvec"
-version = "0.4.10"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-dependencies = [
- "nodrop 0.1.13 (registry+https://github.com/rust-lang/crates.io-index)",
+ "winapi",
 ]
 
 [[package]]
 name = "assert_cmd"
 version = "0.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "2dc477793bd82ec39799b6f6b3df64938532fdf2ab0d49ef817eac65856a5a1e"
 dependencies = [
- "escargot 0.4.0 (registry+https://github.com/rust-lang/crates.io-index)",
- "predicates 1.0.1 (registry+https://github.com/rust-lang/crates.io-index)",
- "predicates-core 1.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
- "predicates-tree 1.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "escargot",
+ "predicates",
+ "predicates-core",
+ "predicates-tree",
 ]
 
 [[package]]
 name = "atty"
 version = "0.2.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9a7d5b8723950951411ee34d271d99dddcc2035a16ab25310ea2c8cfd4369652"
 dependencies = [
- "libc 0.2.58 (registry+https://github.com/rust-lang/crates.io-index)",
- "termion 1.5.2 (registry+https://github.com/rust-lang/crates.io-index)",
- "winapi 0.3.7 (registry+https://github.com/rust-lang/crates.io-index)",
+ "libc",
+ "termion",
+ "winapi",
 ]
 
 [[package]]
 name = "autocfg"
 version = "0.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0e49efa51329a5fd37e7c79db4621af617cd4e3e5bc224939808d076077077bf"
+
+[[package]]
+name = "autocfg"
+version = "1.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cdb031dd78e28731d87d56cc8ffef4a8f36ca26c38fe2de700543e627f8a464a"
 
 [[package]]
 name = "backtrace"
 version = "0.3.30"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ada4c783bb7e7443c14e0480f429ae2cc99da95065aeab7ee1b81ada0419404f"
 dependencies = [
- "autocfg 0.1.4 (registry+https://github.com/rust-lang/crates.io-index)",
- "backtrace-sys 0.1.28 (registry+https://github.com/rust-lang/crates.io-index)",
- "cfg-if 0.1.9 (registry+https://github.com/rust-lang/crates.io-index)",
- "libc 0.2.58 (registry+https://github.com/rust-lang/crates.io-index)",
- "rustc-demangle 0.1.15 (registry+https://github.com/rust-lang/crates.io-index)",
+ "autocfg 0.1.4",
+ "backtrace-sys",
+ "cfg-if 0.1.9",
+ "libc",
+ "rustc-demangle",
 ]
 
 [[package]]
 name = "backtrace-sys"
 version = "0.1.28"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "797c830ac25ccc92a7f8a7b9862bde440715531514594a6154e3d4a54dd769b6"
 dependencies = [
- "cc 1.0.37 (registry+https://github.com/rust-lang/crates.io-index)",
- "libc 0.2.58 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cc",
+ "libc",
 ]
 
 [[package]]
-name = "bincode"
-version = "1.1.4"
+name = "bitflags"
+version = "1.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3d155346769a6855b86399e9bc3814ab343cd3d62c7e985113d46a0ec3c281fd"
+
+[[package]]
+name = "bstr"
+version = "0.2.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "473fc6b38233f9af7baa94fb5852dca389e3d95b8e21c8e3719301462c5d9faf"
 dependencies = [
- "autocfg 0.1.4 (registry+https://github.com/rust-lang/crates.io-index)",
-
```

**File**: `courses/rust/projects/project-3/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ serde = { version = "1.0.89", features = ["derive"] }
 serde_json = "1.0.39"
 log = "0.4.6"
 env_logger = "0.6.1"
-sled = "0.22.1"
+sled = "0.34.6"
 
 [dev-dependencies]
 assert_cmd = "0.11"
-criterion = "0.2.11"
+criterion = "0.3"
 predicates = "1.0.0"
 rand = "0.6.5"
 tempfile = "3.0.7"
```

**File**: `courses/rust/projects/project-3/benches/engine_bench.rs` (modified, +40/-46)
```diff
@@ -1,37 +1,30 @@
-#[macro_use]
-extern crate criterion;
-
-use criterion::{BatchSize, Criterion, ParameterizedBenchmark};
+use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
 use kvs::{KvStore, KvsEngine, SledKvsEngine};
 use rand::prelude::*;
-use sled::Db;
-use std::iter;
+use sled;
 use tempfile::TempDir;
 
 fn set_bench(c: &mut Criterion) {
-    let bench = ParameterizedBenchmark::new(
-        "kvs",
-        |b, _| {
-            b.iter_batched(
-                || {
-                    let temp_dir = TempDir::new().unwrap();
-                    (KvStore::open(temp_dir.path()).unwrap(), temp_dir)
-                },
-                |(mut store, _temp_dir)| {
-                    for i in 1..(1 << 12) {
-                        store.set(format!("key{}", i), "value".to_string()).unwrap();
-                    }
-                },
-                BatchSize::SmallInput,
-            )
-        },
-        iter::once(()),
-    )
-    .with_function("sled", |b, _| {
+    let mut group = c.benchmark_group("set_bench");
+    group.bench_function("kvs", |b| {
         b.iter_batched(
             || {
                 let temp_dir = TempDir::new().unwrap();
-                (SledKvsEngine::new(Db::start_default(&temp_dir).unwrap()), temp_dir)
+                (KvStore::open(temp_dir.path()).unwrap(), temp_dir)
+            },
+            |(mut store, _temp_dir)| {
+                for i in 1..(1 << 12) {
+                    store.set(format!("key{}", i), "value".to_string()).unwrap();
+                }
+            },
+            BatchSize::SmallInput,
+        )
+    });
+    group.bench_function("sled", |b| {
+        b.iter_batched(
+            || {
+                let temp_dir = TempDir::new().unwrap();
+                (SledKvsEngine::new(sled::open(&temp_dir).unwrap()), temp_dir)
             },
             |(mut db, _temp_dir)| {
                 for i in 1..(1 << 12) {
@@ -41,13 +34,13 @@ fn set_bench(c: &mut Criterion) {
             BatchSize::SmallInput,
         )
     });
-    c.bench("set_bench", bench);
+    group.finish();
 }
 
 fn get_bench(c: &mut Criterion) {
-    let bench = ParameterizedBenchmark::new(
-        "kvs",
-        |b, i| {
+    let mut group = c.benchmark_group("get_bench");
+    for i in &vec![8, 12, 16, 20] {
+        group.bench_with_input(format!("kvs_{}", i), i, |b, i| {
             let temp_dir = TempDir::new().unwrap();
             let mut store = KvStore::open(temp_dir.path()).unwrap();
             for key_i in 1..(1 << i) {
@@ -61,22 +54,23 @@ fn get_bench(c: &mut Criterion) {
                     .get(format!("key{}", rng.gen_range(1, 1 << i)))
                     .unwrap();
             })
-        },
-        vec![8, 12, 16, 20],
-    )
-    .with_function("sled", |b, i| {
-        let temp_dir = TempDir::new().unwrap();
-        let mut db = SledKvsEngine::new(Db::start_default(&temp_dir).unwrap());
-        for key_i in 1..(1 << i) {
-            db.set(format!("key{}", key_i), "value".to_string())
-                .unwrap();
-        }
-        let mut rng = SmallRng::from_seed([0; 16]);
-        b.iter(|| {
-            db.get(format!("key{}", rng.gen_range(1, 1 << i))).unwrap();
-        })
-    });
-    c.bench("get_bench", bench);
+        });
+    }
+    for i in &vec![8, 12, 16, 20] {
+        group.bench_with_input(format!("sled_{}", i), i, |b, i| {
+            let temp_dir = TempDir::new().unwrap();
+            let mut db = SledKvsEngine::new(sled::open(&temp_dir).unwrap());
+            for key_i in 1..(1 << i) {
+                db.set(format!("key{}", key_i), "value".to_string())
+                    .unwrap();
+            }
+            let mut rng = SmallRng::from_seed([0; 16]);
+            b.iter(|| {
+                db.get(format!("key{}", rng.gen_range(1, 1 << i))).unwrap();
+            })
+        });
+    }
+    group.finish();
 }
 
 criterion_group!(benches, set_bench, get_bench);
```

**File**: `courses/rust/projects/project-3/src/bin/kvs-server.rs` (modified, +3/-9)
```diff
@@ -1,10 +1,7 @@
-#[macro_use]
-extern crate log;
-#[macro_use]
-extern crate clap;
-
+use clap::arg_enum;
 use kvs::*;
 use log::LevelFilter;
+use log::{error, info, warn};
 use std::env::current_dir;
 use std::fs;
 use std::net::SocketAddr;
@@ -73,10 +70,7 @@ fn run(opt: Opt) -> Result<()> {
 
     match engine {
         Engine::kvs => run_with_engine(KvStore::open(current_dir()?)?, opt.addr),
-        Engine::sled => run_with_engine(
-            SledKvsEngine::new(sled::Db::start_default(current_dir()?)?),
-            opt.addr,
-        ),
+        Engine::sled => run_with_engine(SledKvsEngine::new(sled::open(current_dir()?)?), opt.addr),
     }
 }
 
```

**File**: `courses/rust/projects/project-3/src/engines/sled.rs` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ impl SledKvsEngine {
 impl KvsEngine for SledKvsEngine {
     fn set(&mut self, key: String, value: String) -> Result<()> {
         let tree: &Tree = &self.0;
-        tree.set(key, value.into_bytes()).map(|_| ())?;
+        tree.insert(key, value.into_bytes()).map(|_| ())?;
         tree.flush()?;
         Ok(())
     }
@@ -32,7 +32,7 @@ impl KvsEngine for SledKvsEngine {
 
     fn remove(&mut self, key: String) -> Result<()> {
         let tree: &Tree = &self.0;
-        tree.del(key)?.ok_or(KvsError::KeyNotFound)?;
+        tree.remove(key)?.ok_or(KvsError::KeyNotFound)?;
         tree.flush()?;
         Ok(())
     }
```

---

### Incident Patch 7: `b59c6456` (2021-02-03)
**Commit Message**: courses/dss/raft: fix wrong Duration used in RPC Delay (#382)

**File**: `courses/dss/labrpc/src/network.rs` (modified, +1/-1)
```diff
@@ -279,7 +279,7 @@ async fn process_rpc(
 ) -> Result<Vec<u8>> {
     // Dispatch ===============================================================
     if let Some(delay) = delay {
-        Delay::new(Duration::from_secs(delay)).await;
+        Delay::new(Duration::from_millis(delay)).await;
     }
     // We has finished the delay, take it out to prevent polling
     // twice.
```

---

### Incident Patch 8: `8af037ce` (2020-07-09)
**Commit Message**: update mentee of project Reduce memory consumption of stats data (#365)

**File**: `talent-challenge-program/selected-projects.md` (modified, +1/-0)
```diff
@@ -95,6 +95,7 @@ The difficulty of the project is divided into three levels: Very hard, Hard, and
 * Description: When there're lots of tables in a TiDB cluster, caching all the stats data into a single TiDB server may cause a high memory consumption when the TiDB server bootstrapped. It increases the OOM risk of the TiDB server.
 * Recommended Skills: Go
 * Mentor(s): @SunRunAway
+* Mentee: @[miamiaoxyz](https://github.com/miamia0)
 * Upstream Issue or RFC (URL): https://github.com/pingcap/tidb/issues/16572
 * Difficulty: Medium
  
```

---

### Incident Patch 9: `ecdfbf4b` (2020-06-23)
**Commit Message**: dss: fix redundant closure (#360)

Signed-off-by: Neil Shen <overvenus@gmail.com>

**File**: `courses/dss/linearizability/src/models.rs` (modified, +3/-3)
```diff
@@ -35,7 +35,7 @@ impl Model for KvModel {
     ) -> Vec<Operations<Self::Input, Self::Output>> {
         let mut map = HashMap::new();
         for op in history {
-            let v = map.entry(op.input.key.clone()).or_insert_with(|| vec![]);
+            let v = map.entry(op.input.key.clone()).or_insert_with(Vec::new);
             (*v).push(op);
         }
         let mut ret = vec![];
@@ -56,11 +56,11 @@ impl Model for KvModel {
                 EventKind::CallEvent => {
                     let key = event.value.input().key.clone();
                     matched.insert(event.id, key.clone());
-                    m.entry(key).or_insert_with(|| vec![]).push(event);
+                    m.entry(key).or_insert_with(Vec::new).push(event);
                 }
                 EventKind::ReturnEvent => {
                     let key = matched[&event.id].clone();
-                    m.entry(key).or_insert_with(|| vec![]).push(event);
+                    m.entry(key).or_insert_with(Vec::new).push(event);
                 }
             }
         }
```

---

### Incident Patch 10: `0f69bac0` (2020-05-10)
**Commit Message**: fix course number (#349)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@ Two courses are included in this series, which are:
 
 Two courses are included in this series, which are:
 
-- [TP 301: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
-- [TP 302: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 301: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 302: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
 
 ### Series 4: Deep Dive into TiDB Ecosystems 
 
```

**File**: `courses/README.md` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ Here we list all public courses of Talent Plan, including:
 - [TP 103: Build a welcoming community](tp103-open-source-community.md)
 - [TP 201: Practical Networked Applications in Rust](rust/README.md)
 - [TP 202: Distributed Systems in Rust](dss/README.md)
-- [TP 301: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
-- [TP 302: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 301: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 302: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
 - TP 401: Deep Dive into TiDB(WIP)
 - TP 402: Deep Dive into TiKV(WIP)
```

#### Recent Merged Pull Requests:
- **PR #470** (closed): courses/dss: fixed compilation errors and clippy warnings (@kumarlokesh)
- **PR #468** (closed): Jchen/raft lab2a leader election (@drinkbeer)
- **PR #467** (closed): Fixing the clippy (@drinkbeer)
- **PR #460** (closed): Mine (@joema-m)
- **PR #457** (closed): Update tp102-how-to-use-git-github.md (@RTCFoundation)
- **PR #456** (closed): (WIP) raft with rust (@WenyXu)
- **PR #455** (closed): rust project-3 tests/cli.rs: revise mistyped "get",  (@Adamska1008)
- **PR #450** (closed): Update README.md (@Binlogo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
