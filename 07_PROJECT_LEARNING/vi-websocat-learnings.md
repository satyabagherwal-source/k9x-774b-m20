# Forensic Learning Record (Deep Inspection): vi/websocat

> **Canonical Artifact**: `07_PROJECT_LEARNING/vi-websocat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vi/websocat](https://github.com/vi/websocat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:51:11.767Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vi/websocat`
- **Description**: Command-line client for WebSockets, like netcat (or curl) for ws:// with advanced socat-like functions
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 8708 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/util.rs`
```
use super::{
    futures, AsyncRead, AsyncWrite, BoxedNewPeerFuture, BoxedNewPeerStream, L2rUser, Peer,
    PeerConstructor, Rc, HupToken,
};
use super::{Future, Stream};

pub fn wouldblock<T>() -> std::io::Result<T> {
    Err(std::io::Error::new(std::io::ErrorKind::WouldBlock, ""))
}
pub fn brokenpipe<T>() -> std::io::Result<T> {
    Err(std::io::Error::new(std::io::ErrorKind::BrokenPipe, ""))
}
pub fn io_other_error<E: std::error::Error + Send + Sync + 'static>(e: E) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, e)
}

#[allow(clippy::redundant_closure)]
impl PeerConstructor {
    pub fn map<F>(self, func: F) -> Self
    where
        F: Fn(Peer, L2rUser) -> BoxedNewPeerFuture + 'static,
    {
        let f = Rc::new(func);
        use crate::PeerConstructor::*;
        match self {
            Error(e) => Error(e),
            ServeOnce(x) => Overlay1(x, f),
            ServeMultipleTimes(s) => OverlayM(s, f),
            Overlay1(x, mapper) => Overlay1(
                x,
                Rc::new(move |p, l2r| {
                    let ff = f.clone();
                    let l2rc = l2r.clone();
                    Box::new(mapper(p, l2r).and_then(move |x| ff(x, l2rc)))
                }),
            ),
            OverlayM(x, mapper) => OverlayM(
                x,
                Rc::new(move |p, l2r| {
                    let ff = f.clone();
                    let l2rc = l2r.clone();
                    Box::new(mapper(p, l2r).and_then(move |x| ff(x, l2rc)))
                }),
            ), // This implementation (without Overlay{1,M} cases)
               // causes task to be spawned too late (before establishing ws upgrade)
               // when serving clients:

               //ServeOnce(x) => ServeOnce(Box::new(x.and_then(f)) as BoxedNewPeerFuture),
               //ServeMultipleTimes(s) => {
               //    ServeMultipleTimes(Box::new(s.and_then(f)) as BoxedNewPeerStream)
               //}
        }
    }

    pub fn get_only_first_conn(self, l2r: L2rUser) -> BoxedNewPeerFuture {
        use crate::PeerConstructor::*;
        match self {
            Error(e) => Box::new(futures::future::err(e)) as BoxedNewPeerFuture,
            ServeMultipleTimes(stre) => Box::new(
                stre.into_future()
                    .map(move |(std_peer, _)| std_peer.expect("Nowhere to connect it"))
                    .map_err(|(e, _)| e),
            ) as BoxedNewPeerFuture,
            ServeOnce(futur) => futur,
            Overlay1(futur, mapper) => {
                Box::new(futur.and_then(move |p| mapper(p, l2r))) as BoxedNewPeerFuture
            }
            OverlayM(stre, mapper) => Box::new(
                stre.into_future()
                    .map(move |(std_peer, _)| std_peer.expect("Nowhere to connect it"))
                    .map_err(|(e, _)| e)
                    .and_then(move |p| mapper(p, l2r)),
            ) as BoxedNewPeerFuture,
        }
    }
}

pub fn once(x: BoxedNewPeerFuture) -> PeerConstructor {
    PeerConstructor::ServeOnce(x)
}
pub fn multi(x: BoxedNewPeerStream) -> PeerConstructor {
    PeerConstructor::ServeMultipleTimes(x)
}

pub fn peer_err<E: std::error::Error + 'static>(e: E) -> BoxedNewPeerFuture {
    Box::new(futures::future::err(
        Box::new(e) as Box<dyn std::error::Error>
    )) as BoxedNewPeerFuture
}
pub fn peer_err2(e: Box<dyn std::error::Error>) -> BoxedNewPeerFuture {
    Box::new(futures::future::err(
        e
    )) as BoxedNewPeerFuture
}
pub fn peer_err_s<E: std::error::Error + 'static>(e: E) -> BoxedNewPeerStream {
    Box::new(futures::stream::iter_result(vec![Err(
        Box::new(e) as Box<dyn std::error::Error>
    )])) as BoxedNewPeerStream
}
pub fn peer_err_sb(e: Box<dyn std::error::Error + 'static>) -> BoxedNewPeerStream {
    Box::new(futures::stream::iter_result(vec![Err(
        e
    )])) as BoxedNewPeerStream
}
pub fn peer_strerr(e: &str) -> BoxedNewPeerFuture {
    let q: Box<dyn std::error::Error> = From::from(e);
    Box::new(futures::future::err(q)) as BoxedNewPeerFuture
}
pub fn simple_err(e: String) -> std::io::Error {
    let e1: Box<dyn std::error::Error + Send + Sync> = e.into();
    ::std::io::Error::new(::std::io::ErrorKind::Other, e1)
}
pub fn simple_err2(e: &'static str) -> Box<dyn std::error::Error> {
    let e1: Box<dyn std::error::Error + Send + Sync> = e.to_string().into();
    e1 as Box<dyn std::error::Error>
}
pub fn box_up_err<E: std::error::Error + 'static>(e: E) -> Box<dyn std::error::Error> {
    Box::new(e) as Box<dyn std::error::Error>
}

impl Peer {
    pub fn new<R: AsyncRead + 'static, W: AsyncWrite + 'static>(r: R, w: W, hup: Option<HupToken>) -> Self {
        Peer(
            Box::new(r) as Box<dyn AsyncRead>,
            Box::new(w) as Box<dyn AsyncWrite>,
            hup,
        )
    }
}

```

### Core Architecture Module: `src/all_peers.rs`
```
// This is an X-Macro.
#[macro_export]
macro_rules! list_of_all_specifier_classes {
    ($your_macro:ident) => {
        $your_macro!($crate::ws_client_peer::WsClientClass);
        #[cfg(feature = "ssl")]
        $your_macro!($crate::ws_client_peer::WsClientSecureClass);
        $your_macro!($crate::ws_server_peer::WsTcpServerClass);
        $your_macro!($crate::ws_server_peer::WsInetdServerClass);
        $your_macro!($crate::ws_server_peer::WsUnixServerClass);
        $your_macro!($crate::ws_server_peer::WsAbstractUnixServerClass);
        $your_macro!($crate::ws_server_peer::WsServerClass);
        $your_macro!($crate::ws_lowlevel_peer::WsLlClientClass);
        $your_macro!($crate::ws_lowlevel_peer::WsLlServerClass);

        #[cfg(feature = "ssl")]
        $your_macro!($crate::ssl_peer::WssListenClass);

        $your_macro!($crate::http_peer::HttpRequestClass);
        $your_macro!($crate::http_peer::HttpClass);
        $your_macro!($crate::http_peer::HttpPostSseClass);
        

        #[cfg(all(unix, feature = "unix_stdio"))]
        $your_macro!($crate::stdio_peer::AsyncStdioClass);
        #[cfg(all(unix, feature = "unix_stdio"))]
        $your_macro!($crate::stdio_peer::InetdClass);
        #[cfg(not(all(unix, feature = "unix_stdio")))]
        $your_macro!($crate::stdio_threaded_peer::InetdClass);

        $your_macro!($crate::net_peer::TcpConnectClass);
        $your_macro!($crate::net_peer::TcpListenClass);

        #[cfg(feature = "ssl")]
        $your_macro!($crate::ssl_peer::TlsConnectClass);
        #[cfg(feature = "ssl")]
        $your_macro!($crate::ssl_peer::TlsAcceptClass);
        #[cfg(feature = "ssl")]
        $your_macro!($crate::ssl_peer::TlsListenClass);

        #[cfg(feature = "tokio-process")]
        $your_macro!($crate::process_peer::ShCClass);
        #[cfg(feature = "tokio-process")]
        $your_macro!($crate::process_peer::CmdClass);
        #[cfg(feature = "tokio-process")]
        $your_macro!($crate::process_peer::ExecClass);

        $your_macro!($crate::file_peer::ReadFileClass);
        $your_macro!($crate::file_peer::WriteFileClass);
        $your_macro!($crate::file_peer::AppendFileClass);

        $your_macro!($crate::primitive_reuse_peer::ReuserClass);
        $your_macro!($crate::broadcast_reuse_peer::BroadcastReuserClass);
        $your_macro!($crate::reconnect_peer::AutoReconnectClass);

        $your_macro!($crate::ws_client_peer::WsConnectClass);

        $your_macro!($crate::net_peer::UdpConnectClass);
        $your_macro!($crate::net_peer::UdpListenClass);

        #[cfg(all(unix, feature = "unix_stdio"))]
        $your_macro!($crate::stdio_peer::OpenAsyncClass);
        #[cfg(all(unix, feature = "unix_stdio"))]
        $your_macro!($crate::stdio_peer::OpenFdAsyncClass);

        $your_macro!($crate::stdio_threaded_peer::ThreadedStdioClass);
        $your_macro!($crate::stdio_threaded_peer::StdioClass);

        #[cfg(unix)]
        $your_macro!($crate::unix_peer::UnixConnectClass);
        #[cfg(unix)]
        $your_macro!($crate::unix_peer::UnixListenClass);
        #[cfg(unix)]
        $your_macro!($crate::unix_peer::UnixDgramClass);
        #[cfg(unix)]
        $your_macro!($crate::unix_peer::AbstractConnectClass);
        #[cfg(unix)]
        $your_macro!($crate::unix_peer::AbstractListenClass);
        #[cfg(unix)]
        $your_macro!($crate::unix_peer::AbstractDgramClass);

        #[cfg(all(windows,feature = "windows_named_pipes"))]
        $your_macro!($crate::windows_np_peer::NamedPipeConnectClass);

        $your_macro!($crate::line_peer::Message2LineClass);
        $your_macro!($crate::line_peer::Line2MessageClass);
        $your_macro!($crate::lengthprefixed_peer::LengthPrefixedClass);
        $your_macro!($crate::foreachmsg_peer::ForeachmsgClass);
        $your_macro!($crate::mirror_peer::MirrorClass);
        $your_macro!($crate::mirror_peer::LiteralReplyClass);
        $your_macro!($crate::trivial_peer::CloggedClass);
        $your_macro!($crate::trivial_peer::LiteralClass);
        $your_macro!($crate::trivial_peer::AssertClass);
        $your_macro!($crate::trivial_peer::Assert2Class);

        $your_macro!($crate::trivial_peer::LogClass);

        #[cfg(all(target_os = "linux", feature = "seqpacket"))]
        $your_macro!($crate::unix_peer::unix_seqpacket_peer::SeqpacketConnectClass);
        #[cfg(all(target_os = "linux", feature = "seqpacket"))]
        $your_macro!($crate::unix_peer::unix_seqpacket_peer::SeqpacketListenClass);

        $your_macro!($crate::jsonrpc_peer::JsonRpcClass);
        $your_macro!($crate::timestamp_peer::TimestampClass);

        $your_macro!($crate::socks5_peer::SocksProxyClass);
        $your_macro!($crate::socks5_peer::SocksBindClass);

        #[cfg(feature = "crypto_peer")]
        $your_macro!($crate::crypto_peer::CryptoClass);

        $your_macro!($crate::trivial_peer::RandomClass);

        #[cfg(feature = "prometheus_peer")]
        $your_macro!($crate::prometheus_peer::PrometheusClass);

        $your_macro!($crate::trivial_peer::ExitOnSpecificByteClass);
        $your_macro!($crate::trivial_peer::DropOnBackpressureClass);

        $your_macro!($crate::reconnect_peer::WaitForDataClass);
    };
}

```

### Core Architecture Module: `src/broadcast_reuse_peer.rs`
```
extern crate futures;
extern crate tokio_io;

use futures::future::ok;
use std::cell::RefCell;
use std::rc::Rc;

use super::{brokenpipe, simple_err, wouldblock, BoxedNewPeerFuture, Peer};

use std::io::{Error as IoError, Read, Write};
use tokio_io::{AsyncRead, AsyncWrite};

use super::{once, ConstructParams, PeerConstructor, Specifier};
use futures::Async;
use futures::AsyncSink;
use futures::Future;
use futures::Sink;
use futures::Stream;
use crate::spawn_hack;
use std::ops::DerefMut;

use futures::unsync::mpsc;

declare_slab_token!(BroadcastClientIndex);
use slab_typesafe::Slab;

#[derive(Debug)]
pub struct BroadcastReuser(pub Rc<dyn Specifier>);
impl Specifier for BroadcastReuser {
    fn construct(&self, p: ConstructParams) -> PeerConstructor {
        let mut reuser = p.global(GlobalState::default).clone();
        let bs = p.program_options.buffer_size;
        let ql = p.program_options.broadcast_queue_len;
        let l2r = p.left_to_right.clone();
        let inner = || self.0.construct(p).get_only_first_conn(l2r);
        once(connection_reuser(&mut reuser, inner, bs, ql))
    }
    specifier_boilerplate!(singleconnect has_subspec globalstate);
    self_0_is_subspecifier!(...);
}

specifier_class!(
    name = BroadcastReuserClass,
    target = BroadcastReuser,
    prefixes = [
        "broadcast:",
        "reuse:",
        "reuse-broadcast:",
        "broadcast-reuse:"
    ],
    arg_handling = subspec,
    overlay = true,
    MessageBoundaryStatusDependsOnInnerType,
    SingleConnect,
    help = r#"
Reuse this connection for serving multiple clients, sending replies to all clients.

Messages from any connected client get directed to inner connection,
replies from the inner connection get duplicated across all connected
clients (and are dropped if there are none).

If WebSocket client is too slow for accepting incoming data,
messages get accumulated up to the configurable --broadcast-buffer, then dropped.

Example: Simple data exchange between connected WebSocket clients

    websocat -E ws-l:0.0.0.0:8800 reuse-broadcast:mirror:
"#
);

type SailingBuffer = Rc<Vec<u8>>;
type Clients = Slab<BroadcastClientIndex, mpsc::Sender<SailingBuffer>>;

pub struct Broadcaster {
    inner_peer: Peer,
    clients: Clients,
}
pub type HBroadCaster = Rc<RefCell<Option<Broadcaster>>>;

pub type GlobalState = HBroadCaster;

struct PeerHandleW(HBroadCaster);
struct PeerHandleR(
    HBroadCaster,
    mpsc::Receiver<SailingBuffer>,
    BroadcastClientIndex,
);
struct InnerPeerReader(HBroadCaster, Vec<u8>);

impl Future for InnerPeerReader {
    type Item = ();
    type Error = ();
    fn poll(&mut self) -> futures::Poll<(), ()> {
        loop {
            let mut meb = self.0.borrow_mut();
            let me = meb.as_mut().expect("Assertion failed 16293");
            match me.inner_peer.0.read(&mut self.1[..]) {
                Ok(0) => {
                    info!("Underlying peer finished");
                    return Ok(futures::Async::Ready(()));
                }
                Ok(n) => {
                    if me.clients.is_empty() {
                        info!("Dropping broadcast due to no clients being connected");
                        continue;
                    };
                    let sb = Rc::new(self.1[0..n].to_vec());
                    for (_, client) in me.clients.iter_mut() {
                        match client.start_send(sb.clone()) {
                            Ok(AsyncSink::Ready) => match client.poll_complete() {
                                Ok(Async::Ready(())) => {}
                                Ok(Async::NotReady) => {
                                    warn!("A client's sink is NotReady for poll_complete");
                                }
                                Err(e) => {
                                    warn!("A client's sink is in error state: {}", e);
                                }
                            },
                            Ok(AsyncSink::NotReady(_)) => {
                                warn!("A client's sink is NotReady for start_send");
                            }
                            Err(e) => {
                                warn!("A client's sink is in error state: {}", e);
                            }
                        };
                    }
                }
                Err(e) => {
                    if e.kind() == ::std::io::ErrorKind::WouldBlock {
                        return Ok(Async::NotReady);
                    }
                    error!("Inner peer read failed: {}", e);
                    return Err(());
                }
            }
        }
    }
}

impl Drop for PeerHandleR {
    fn drop(&mut self) {
        self.0
            .borrow_mut()
            .as_mut()
            .expect("Assertion failed 16292")
            .clients
            .remove(self.2);
    }
}

impl Read for PeerHandleR {
    fn read(&mut self, b: &mut [u8]) -> Result<usize, IoError> {
        loop {
            return match self.1.poll() {
                Ok(Async::Ready(Some(v))) => {
                    if v.len() > b.len() {
                        error!("Too big message dropped");
                        continue;
                    }
                    b[0..(v.len())].copy_from_slice(&v[..]);
                    Ok(v.len())
                }
                Ok(Async::Ready(None)) => brokenpipe(),
                Ok(Async::NotReady) => wouldblock(),
                Err(()) => Err(simple_err("Something unexpected".into())),
            };
        }

        /*if let &mut Some(ref mut x) = self.0.borrow_mut().deref_mut() {
            x.inner_peer.0.read(b) // To be changed
        } else {
            unreachable!()
        }*/
    }
}
impl AsyncRead for PeerHandleR {}

impl Write for PeerHandleW {
    fn write(&mut self, b: &[u8]) -> Result<usize, IoError> {
        if let Some(ref mut x) = *self.0.borrow_mut().deref_mut() {
            x.inner_peer.1.write(b)
        } else {
            unreachable!()
        }
    }
    fn flush(&mut self) -> Result<(), IoError> {
        if let Some(ref mut x) = *self.0.borrow_mut().deref_mut() {
            x.inner_peer.1.flush()
        } else {
            unreachable!()
        }
    }
}
impl AsyncWrite for PeerHandleW {
    fn shutdown(&mut self) -> futures::Poll<(), IoError> {
        if let Some(ref mut _x) = *self.0.borrow_mut().deref_mut() {
            // Ignore shutdown attempts
            Ok(futures::Async::Ready(()))
        //_x.1.shutdown()
        } else {
            unreachable!()
        }
    }
}

fn makeclient(ps: HBroadCaster, queue_len: usize) -> Peer {
    let (send, recv) = mpsc::channel(queue_len);
    let k = ps
        .borrow_mut()
        .as_mut()
        .expect("Assertion failed 16291")
        .clients
        .insert(send);
    let ph1 = PeerHandleR(ps.clone(), recv, k);
    let ph2 = PeerHandleW(ps);
    Peer::new(ph1, ph2, None /* TODO */)
}

pub fn connection_reuser<F: FnOnce() -> BoxedNewPeerFuture>(
    s: &mut GlobalState,
    inner_peer: F,
    buffer_size: usize,
    queue_len: usize,
) -> BoxedNewPeerFuture {
    let need_init = s.borrow().is_none();

    let rc = s.clone();
    if need_init {
        info!("Initializing");
        Box::new(inner_peer().and_then(move |inner| {
            {
                let mut b = rc.borrow_mut();
                let x: &mut Option<Broadcaster> = b.deref_mut();
                *x = Some(Broadcaster {
                    inner_peer: inner,
                    clients: Clients::new(),
                });
                spawn_hack(InnerPeerReader(rc.clone(), vec![0; buffer_size]));
            }

            let ps: HBroadCaster = rc.clone();
            ok(makeclient(ps, queue_len))
        })) as BoxedNewPeerFuture
    } else {
        info!("Reusing");
        let ps: HBroadCaster = rc.clone();
        Box::new(ok(makeclient(ps, queue_len))) as BoxedNewPeerFuture
    }
}

```

### Core Architecture Module: `src/crypto_peer.rs`
```
use argon2::Argon2;
use futures::Async;
use futures::future::ok;

use std::rc::Rc;

use super::{BoxedNewPeerFuture, Peer};
use super::{ConstructParams, PeerConstructor, Specifier};

use std::io::{Read, Write};
use tokio_io::{AsyncRead, AsyncWrite};

use std::io::Error as IoError;

use chacha20poly1305::ChaCha20Poly1305;
use chacha20poly1305::Nonce;
use chacha20poly1305::aead::NewAead;
use chacha20poly1305::aead::Aead;
use rand::RngCore;

#[derive(Debug)]
pub struct Crypto<T: Specifier>(pub T);
impl<T: Specifier> Specifier for Crypto<T> {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        let inner = self.0.construct(cp.clone());
        let mut key = [0u8; 32];
        if let Some(k) = cp.program_options.crypto_key {
            key = k;
        } else {
            log::error!("You are using `crypto:` without `--crypto-key`. This uses a hard coded key and is insecure.")
        }
        inner.map(move |p, _| crypto_peer(p, key, cp.program_options.crypto_reverse))
    }
    specifier_boilerplate!(noglobalstate has_subspec);
    self_0_is_subspecifier!(proxy_is_multiconnect);
}
specifier_class!(
    name = CryptoClass,
    target = Crypto,
    prefixes = ["crypto:"],
    arg_handling = subspec,
    overlay = true,
    MessageOriented,
    MulticonnectnessDependsOnInnerType,
    help = r#"
[A] Encrypts written messages and decrypts (and verifies) read messages with a static key, using ChaCha20-Poly1305 algorithm.

Do not not use in stream mode - packet boundaries are significant.

Note that attacker may duplicate, drop or reorder messages, including between different Websocat sessions with the same key.

Each encrypted message is 12 bytes bigger than original message.

Associated --crypto-key option accepts the following prefixes:

- `file:` prefix means that Websocat should read 32-byte file and use it as a key.
- `base64:` prefix means the rest of the value is base64-encoded 32-byte buffer
- `pwd:` means Websocat should use argon2 derivation from the specified password as a key

Use `--crypto-reverse` option to swap encryption and decryption.

Note that `crypto:` specifier is absent in usual Websocat builds.
You may need to build Websocat from source code with `--features=crypto_peer` for it to be available.
"#
);

#[derive(Clone, Copy)]
enum Mode {
    Encrypt,
    Decrypt,
}

pub fn crypto_peer(inner_peer: Peer, key: [u8; 32], reverse: bool) -> BoxedNewPeerFuture {
    let (mode_r, mode_w) = if reverse {
        (Mode::Encrypt, Mode::Decrypt)
    } else {
        (Mode::Decrypt, Mode::Encrypt)
    };
    let crypto = ChaCha20Poly1305::new(chacha20poly1305::Key::from_slice(&key));
    let filtered_r = CryptoWrapperR(inner_peer.0, crypto.clone(), mode_r);
    let filtered_w = CryptoWrapperW(inner_peer.1, crypto, mode_w);
    let thepeer = Peer::new(filtered_r, filtered_w, inner_peer.2);
    Box::new(ok(thepeer)) as BoxedNewPeerFuture
}
struct CryptoWrapperR(Box<dyn AsyncRead>, ChaCha20Poly1305, Mode);

impl Read for CryptoWrapperR {
    fn read(&mut self, b: &mut [u8]) -> Result<usize, IoError> {
        let mut l = b.len();

        assert!(l > 12);

        if matches!(self.2, Mode::Encrypt) {
            l -= 12;
        }

        let n = match self.0.read(&mut b[..l]) {
            Ok(x) => x,
            Err(e) => return Err(e),
        };

        if n == 0 { return Ok(0) }

        let data = process_data(&b[..n], &self.1, self.2)?;

        let m = data.len();
        b[..m].copy_from_slice(&data[..m]);

        Ok(m)
    }
}
impl AsyncRead for CryptoWrapperR {}

struct CryptoWrapperW(Box<dyn AsyncWrite>, ChaCha20Poly1305, Mode);

impl Write for CryptoWrapperW {
    fn write(&mut self, b: &[u8]) -> Result<usize, IoError> {
        let l = b.len();

        let data = process_data(b, &self.1, self.2)?;

        let n = match self.0.write(&data[..]) {
            Ok(x) => x,
            Err(e) => return Err(e),
        };

        if n != data.len() {
            log::error!("Short write when using `crypto:` specifier");
        }

        Ok(l)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.0.flush()
    }
}
impl AsyncWrite for CryptoWrapperW {
    fn shutdown(&mut self) -> std::result::Result<Async<()>, std::io::Error> {
        self.0.shutdown()
    }
}

fn process_data(buf: &[u8], crypto: &ChaCha20Poly1305, mode: Mode) -> Result<Vec<u8>, IoError>  {
    let l = buf.len();
    match mode {
        Mode::Encrypt => {
            let mut nonce = [0u8; 12];
            rand::thread_rng().fill_bytes(&mut nonce[..]);
            let mut data: Vec<u8> = crypto
                .encrypt(Nonce::from_slice(&nonce), &buf[..])
                .unwrap();
            data.extend_from_slice(&nonce[..]);
            Ok(data)
        }
        Mode::Decrypt => {
            if l < 12 {
                log::error!("Insufficient packet length for `crypto:` specifier's decryption");
                return Err(std::io::ErrorKind::Other.into()); 
            }
            let mut nonce = [0u8; 12];
            nonce.copy_from_slice(&buf[l-12..l]);
            match crypto.decrypt(Nonce::from_slice(&nonce), &buf[..(l-12)]) {
                Ok(x) => Ok(x),
                Err(_) => {
                    log::error!("crypto: decryption failed");
                    return Err(std::io::ErrorKind::Other.into())
                }
            }
        }
    }
}

pub fn interpret_opt(x: &str) -> crate::Result<[u8; 32]> {
    let mut key = [0u8; 32];
    if x.starts_with("base64:") {
        let mut buf = Vec::with_capacity(32);
        base64::decode_config_buf(&x[7..], base64::STANDARD, &mut buf)?;
        if buf.len() != 32 {
            log::error!("Expected 32 bytes, got {} bytes", buf.len());
            return Err("Non 32-byte buffer specified".into());
        }
        key.copy_from_slice(&buf[..]);

    } else if x.starts_with("file:") {
        let buf = std::fs::read(&x[5..])?;
        if buf.len() != 32 {
            log::error!("Expected 32 bytes, got {} bytes", buf.len());
            return Err("Non 32-byte buffer specified".into());
        }
        key.copy_from_slice(&buf[..])
    } else if x.starts_with("pwd:") {
        let argon2 = Argon2::default();
        const SALT : &'static [u8] = &[0x81, 0x65, 0x0c, 0xc7, 0x09, 0x76, 0xc1, 0x12, 0x6b, 0x5b, 0x5f, 0x04,
        0x08, 0x61, 0xf6, 0x1b, 0xd6, 0xab, 0x88, 0xa2, 0xee, 0x67, 0x47, 0xc1,
        0xbe, 0x12, 0xd7, 0xd7, 0x2d, 0xb8, 0x39, 0xcf];
        argon2.hash_password_into(x[4..].as_bytes(),SALT,&mut key[..]).unwrap();
    } else {
        return Err("--crypto-key's value must start with `base64:`, `file:` or `pwd:`".into());
    }
    Ok(key)
}

```

### Core Architecture Module: `src/file_peer.rs`
```
use futures;
use futures::Async;
use std;
use std::io::Result as IoResult;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tokio_io::{AsyncRead, AsyncWrite};

use std::fs::{File, OpenOptions};
use std::rc::Rc;

use super::{BoxedNewPeerFuture, Peer, Result};

use super::{once, ConstructParams, PeerConstructor, Specifier};

#[derive(Clone, Debug)]
pub struct ReadFile(pub PathBuf);
impl Specifier for ReadFile {
    fn construct(&self, _: ConstructParams) -> PeerConstructor {
        fn gp(p: &Path) -> Result<Peer> {
            let f = File::open(p)?;
            Ok(Peer::new(ReadFileWrapper(f), super::trivial_peer::DevNull, None))
        }
        once(Box::new(futures::future::result(gp(&self.0))) as BoxedNewPeerFuture)
    }
    specifier_boilerplate!(noglobalstate singleconnect no_subspec);
}
specifier_class!(
    name = ReadFileClass,
    target = ReadFile,
    prefixes = ["readfile:"],
    arg_handling = into,
    overlay = false,
    StreamOriented,
    SingleConnect,
    help = r#"
Synchronously read a file. Argument is a file path.

Blocking on operations with the file pauses the whole process

Example: Serve the file once per connection, ignore all replies.

    websocat ws-l:127.0.0.1:8000 readfile:hello.json

"#
);

#[derive(Clone, Debug)]
pub struct WriteFile(pub PathBuf);
impl Specifier for WriteFile {
    fn construct(&self, _: ConstructParams) -> PeerConstructor {
        fn gp(p: &Path) -> Result<Peer> {
            let f = File::create(p)?;
            Ok(Peer::new(super::trivial_peer::DevNull, WriteFileWrapper(f), None))
        }
        once(Box::new(futures::future::result(gp(&self.0))) as BoxedNewPeerFuture)
    }
    specifier_boilerplate!(noglobalstate singleconnect no_subspec);
}
specifier_class!(
    name = WriteFileClass,
    target = WriteFile,
    prefixes = ["writefile:"],
    arg_handling = into,
    overlay = false,
    StreamOriented,
    SingleConnect,
    help = r#"

Synchronously truncate and write a file.

Blocking on operations with the file pauses the whole process

Example:

    websocat ws-l:127.0.0.1:8000 writefile:data.txt

"#
);

#[derive(Clone, Debug)]
pub struct AppendFile(pub PathBuf);
impl Specifier for AppendFile {
    fn construct(&self, _: ConstructParams) -> PeerConstructor {
        fn gp(p: &Path) -> Result<Peer> {
            let f = OpenOptions::new().create(true).append(true).open(p)?;
            Ok(Peer::new(super::trivial_peer::DevNull, WriteFileWrapper(f), None))
        }
        once(Box::new(futures::future::result(gp(&self.0))) as BoxedNewPeerFuture)
    }
    specifier_boilerplate!(noglobalstate singleconnect no_subspec);
}
specifier_class!(
    name = AppendFileClass,
    target = AppendFile,
    prefixes = ["appendfile:"],
    arg_handling = into,
    overlay = false,
    StreamOriented,
    SingleConnect,
    help = r#"

Synchronously append a file.

Blocking on operations with the file pauses the whole process

Example: Logging all incoming data from WebSocket clients to one file

    websocat -u ws-l:127.0.0.1:8000 reuse:appendfile:log.txt
"#
);

pub struct ReadFileWrapper(pub File);

impl AsyncRead for ReadFileWrapper {}
impl Read for ReadFileWrapper {
    fn read(&mut self, buf: &mut [u8]) -> std::result::Result<usize, std::io::Error> {
        self.0.read(buf)
    }
}

struct WriteFileWrapper(File);

impl AsyncWrite for WriteFileWrapper {
    fn shutdown(&mut self) -> futures::Poll<(), std::io::Error> {
        Ok(Async::Ready(()))
    }
}
impl Write for WriteFileWrapper {
    fn write(&mut self, buf: &[u8]) -> IoResult<usize> {
        self.0.write(buf)
    }
    fn flush(&mut self) -> IoResult<()> {
        self.0.flush()
    }
}

```

### Core Architecture Module: `src/foreachmsg_peer.rs`
```
use futures::future::ok;

use std::rc::Rc;

use super::{BoxedNewPeerFuture, Peer};
use super::{ConstructParams, PeerConstructor, Specifier};

use std::cell::RefCell;

use std::io::{Error as IoError, Read, Write};
use tokio_io::{AsyncRead, AsyncWrite};

use super::{once, simple_err, wouldblock};
use futures::{Async, Future, Poll};

#[derive(Debug)]
pub struct Foreachmsg(pub Rc<dyn Specifier>);
impl Specifier for Foreachmsg {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        once(foreachmsg_peer(self.0.clone(), cp))
    }
    specifier_boilerplate!(singleconnect noglobalstate has_subspec);
    self_0_is_subspecifier!(...);
}
specifier_class!(
    name = ForeachmsgClass,
    target = Foreachmsg,
    prefixes = ["foreachmsg:"],
    arg_handling = subspec,
    overlay = true,
    MessageBoundaryStatusDependsOnInnerType,
    SingleConnect,
    help = r#"
Execute something for each incoming message.

Somewhat the reverse of the `autoreconnect:`.

Example:

    websocat -t -u ws://server/listen_for_updates foreachmsg:writefile:status.txt

This keeps only recent incoming message in file and discards earlier messages.
"#
);

#[derive(Default)]
struct State2 {
    already_warned: bool,
}

#[derive(Clone)]
enum Phase {
    Idle,
    WriteDebt(Vec<u8>),
    Flushing,
    Closing,
    WaitingForReadToFinish,
}

struct State {
    s: Rc<dyn Specifier>,
    p: Option<Peer>,
    n: Option<BoxedNewPeerFuture>,
    cp: ConstructParams,
    aux: State2,
    ph: Phase,
    finished_reading: bool,
    read_waiter_tx: Option<futures::sync::oneshot::Sender<()>>,
    read_waiter_rx: Option<futures::sync::oneshot::Receiver<()>>,
    wait_for_new_peer_tx: Option<futures::sync::oneshot::Sender<()>>,
    wait_for_new_peer_rx: Option<futures::sync::oneshot::Receiver<()>>,
    need_wait_for_reading: bool,
}

/// This implementation's poll is to be reused many times, both after returning item and error
impl State {
    //type Item = &'mut Peer;
    //type Error = Box<::std::error::Error>;

    fn poll(&mut self) -> Poll<&mut Peer, Box<dyn (::std::error::Error)>> {
        let pp = &mut self.p;
        let nn = &mut self.n;

        let aux = &mut self.aux;

        loop {
            let cp = self.cp.clone();
            if let Some(ref mut p) = *pp {
                return Ok(Async::Ready(p));
            }

            // Peer is not present: trying to create a new one

            if let Some(mut bnpf) = nn.take() {
                match bnpf.poll() {
                    Ok(Async::Ready(p)) => {
                        *pp = Some(p);
                        if let Some(tx) = self.wait_for_new_peer_tx.take() {
                            let _ = tx.send(());
                        }
                        continue;
                    }
                    Ok(Async::NotReady) => {
                        *nn = Some(bnpf);
                        return Ok(Async::NotReady);
                    }
                    Err(_x) => {
                        // Stop on error:
                        //return Err(_x);

                        // Just reconnect again on error

                        if !aux.already_warned {
                            aux.already_warned = true;
                            error!("Reconnecting failed. Trying again in tight endless loop.");
                        }
                    }
                }
            }
            let l2r = cp.left_to_right.clone();
            let pc: PeerConstructor = self.s.construct(cp);
            *nn = Some(pc.get_only_first_conn(l2r));
            self.finished_reading = false;
            self.ph = Phase::Idle;
            self.read_waiter_tx = None;
            self.read_waiter_rx = None;
        }
    }
}

#[derive(Clone)]
struct PeerHandle(Rc<RefCell<State>>);

macro_rules! getpeer {
    ($state:ident -> $p:ident) => {
        let $p: &mut Peer = match $state.poll() {
            Ok(Async::Ready(p)) => p,
            Ok(Async::NotReady) => return wouldblock(),
            Err(e) => {
                return Err(simple_err(format!("{}", e)));
            }
        };
    };
}

impl State {
    fn reconnect(&mut self) {
        info!("Reconnect");
        self.p = None;
        self.ph = Phase::Idle;
        self.finished_reading = false;
        self.read_waiter_tx = None;
        self.read_waiter_rx = None;
    }
}

impl Read for PeerHandle {
    fn read(&mut self, b: &mut [u8]) -> Result<usize, IoError> {
        let mut state = self.0.borrow_mut();
        loop {
            if let Some(w) = state.wait_for_new_peer_rx.as_mut() {
                match w.poll() {
                    Ok(Async::NotReady) => return wouldblock(),
                    _ => {
                        state.wait_for_new_peer_rx = None;
                    }
                }
            }
            let p : &mut Peer = match state.poll() {
                Ok(Async::Ready(p)) => p,
                Ok(Async::NotReady) => return wouldblock(),
                Err(e) => {
                    return Err(simple_err(format!("{}", e)));
                }
            };
            #[allow(unused_assignments)]
            let mut finished_but_loop_around = false;
            match p.0.read(b) {
                Ok(0) => { 
                    state.finished_reading = true;
                    if state.need_wait_for_reading {
                        finished_but_loop_around = true;
                    } else {
                        return Ok(0);
                    }
                }
                Err(e) => {
                    if e.kind() == ::std::io::ErrorKind::WouldBlock {
                        return Err(e);
                    }
                    state.finished_reading = true;
                    warn!("{}", e);

                    if state.need_wait_for_reading {
                        // Get a new peer to read from
                        finished_but_loop_around = true;
                    } else {
                        return Err(e);
                    }
                }
                Ok(x) => {
                    return Ok(x);
                }
            }
            if finished_but_loop_around {
                state.finished_reading = true;
                let (tx,rx) = futures::sync::oneshot::channel();
                state.wait_for_new_peer_tx = Some(tx);
                state.wait_for_new_peer_rx = Some(rx);
                if let Some(rw) = state.read_waiter_tx.take() {
                    let _ = rw.send(());
                }
            }
        }
    }
}
impl AsyncRead for PeerHandle {}

impl Write for PeerHandle {
    fn write(&mut self, b: &[u8]) -> Result<usize, IoError> {
        let mut state = self.0.borrow_mut();
        
        let mut do_reconnect = false;
        let mut finished = false;
        loop {
            if do_reconnect {
                state.reconnect();
                do_reconnect = false;
            } else if finished {
                state.p = None;
                state.ph = Phase::Idle;
                return Ok(b.len());
            } else {
                let mut ph = state.ph.clone();
                {
                    getpeer!(state -> p);

                    match ph {
                        Phase::Idle => {
                            match p.1.write(b) {
                                Ok(0) => { 
                                    info!("End-of-file write?");
                                    return Ok(0);
                                }
                                Err(e) => {
                                    if e.kind() == ::std::io::ErrorKind::WouldBlock {
                                        return Err(e);
                                    }
                                    warn!("{}", e);
                                    return Err(e);
                                }
                                Ok(x) if x == b.len() => {
                                    debug!("Full write");
                                    // A successful write. Flushing and closing the peer.
                                    ph = Phase::Flushing;
                                },
                                Ok(x) => {
                                    debug!("Partial write of {} bytes", x);
                                    // A partial write. Creating write debt.
                                    let debt = b[x..b.len()].to_vec();
                                    ph = Phase::WriteDebt(debt);
                                }
                            }
                        },
                        Phase::WriteDebt(d) => {
                            match p.1.write(&d[..]) {
                                Ok(0) => { 
                                    info!("End-of-file write v2?");
                                    return Ok(0);
                                }
                                Err(e) => {
                                    if e.kind() == ::std::io::ErrorKind::WouldBlock {
                                        return Err(e);
                                    }
                                    warn!("{}", e);
                                    return Err(e);
                                }
                                Ok(x) if x == d.len() => {
                                    debug!("Closing the debt");
                                    // A successful write. Flushing and closing the peer.
                                    ph = Phase::Flushing;
                                },
                                Ok(x) => {
                                    debug!("Partial write of {} debt bytes", x);
                                    // A partial write. Retaining the write debt.
                                    let debt = d[x..d.len()].to_vec();
                                    ph = Phase::WriteDebt(debt);
                                }
                            }
                        },
                  
```

### Core Architecture Module: `src/help.rs`
```
use super::{Opt, SpecifierClass, StructOpt};

fn spechelp(sc: &dyn SpecifierClass, overlays: bool, advanced: bool) {
    if !advanced && sc.help().contains("[A]") {
        return;
    }
    if overlays ^ sc.is_overlay() {
        return;
    }

    let first_prefix = sc.get_prefixes()[0];

    let mut first_help_line = None;
    for l in sc.help().lines() {
        if !l.trim().is_empty() {
            first_help_line = Some(l);
            break;
        }
    }
    if let Some(fhl) = first_help_line {
        println!("\t{:16}\t{}", first_prefix, fhl);
    }
}

// https://github.com/rust-lang/rust/issues/51942
#[allow(clippy::nonminimal_bool)]
pub fn shorthelp() {
    //use std::io::Write;
    use std::io::{BufRead, BufReader};
    let mut b = vec![];
    if Opt::clap().write_help(&mut b).is_err() {
        eprintln!("Error displaying the help message");
    }
    let mut lines_to_display = vec![];
    let mut do_display = true;
    BufReader::new(&b[..]).lines().for_each(|l| {
        if let Ok(l) = l {
            {
                let lt = l.trim();
                let new_paragraph_start = false || lt.starts_with('-') || l.is_empty();
                if lt.starts_with("--help") {
                    // Allowed to output [A] regardless
                    do_display = true;
                } else if l.contains("[A]") {
                    do_display = false;
                    if l.trim().starts_with("[A]") {
                        // Also retroactively retract the previous line
                        let nl = lines_to_display.len() - 1;
                        lines_to_display.truncate(nl);
                    }
                } else if new_paragraph_start {
                    do_display = true;
                };
            }
            let mut additional_line = None;

            if l == "FLAGS:" {
                additional_line = Some("    (some flags are hidden, see --help=long)".to_string());
            };
            if l == "OPTIONS:" {
                additional_line =
                    Some("    (some options are hidden, see --help=long)".to_string());
            };

            if do_display {
                lines_to_display.push(l);
                if let Some(x) = additional_line {
                    lines_to_display.push(x);
                }
            };
        }
    });
    for l in lines_to_display {
        println!("{}", l);
    }

    println!("\nPartial list of address types:");

    macro_rules! my {
        ($x:expr) => {
            spechelp(&$x, false, false);
        };
    }
    list_of_all_specifier_classes!(my);

    println!("Partial list of overlays:");

    macro_rules! my {
        ($x:expr) => {
            spechelp(&$x, true, false);
        };
    }
    list_of_all_specifier_classes!(my);

    println!("See more address types with the --help=long option.");
    println!("See short examples and --dump-spec names for most address types and overlays with --help=doc option");
}

pub fn longhelp() {
    //let q = Opt::from_iter(vec!["-"]);
    let mut a = Opt::clap();

    let _ = a.print_help();

    println!("\n\nFull list of address types:");

    macro_rules! my {
        ($x:expr) => {
            spechelp(&$x, false, true);
        };
    }
    list_of_all_specifier_classes!(my);

    println!("Full list of overlays:");

    macro_rules! my {
        ($x:expr) => {
            spechelp(&$x, true, true);
        };
    }
    list_of_all_specifier_classes!(my);
}

fn specdoc(sc: &dyn SpecifierClass, overlays: bool) {
    if sc.is_overlay() ^ overlays {
        return;
    }

    let first_prefix = sc.get_prefixes()[0];
    let spec_name = sc.get_name().replace("Class", "");

    let other_prefixes = sc.get_prefixes()[1..]
        .iter()
        .map(|x| format!("`{}`", x))
        .collect::<Vec<_>>()
        .join(", ");

    println!(r#"### `{}`"#, first_prefix);
    println!();
    if !other_prefixes.is_empty() {
        println!("Aliases: {}  ", other_prefixes);
    }
    println!("Internal name for --dump-spec: {}", spec_name);
    println!();

    let help = 
        sc
        .help()
        //.lines()
        //.map(|x|format!("    {}",x))
        //.collect::<Vec<_>>()
        //.join("\n")
        ;
    println!("{}\n", help);
}

pub fn dochelp() {
    println!(r#"
# Websocat Reference (in progress)

Websocat has many command-line options and special format for positional arguments.

There are three main modes of websocat invocation:

* Simple client mode: `websocat wss://your.server/url`
* Simple server mode: `websocat -s 127.0.0.1:8080`
* Advanced [socat][1]-like mode: `websocat -t ws-l:127.0.0.1:8080 mirror:`

Ultimately in any of those modes websocat creates two connections and exchanges data between them.
If one of the connections is bytestream-oriented (for example the terminal stdin/stdout or a TCP connection), but the other is message-oriented (for example, a WebSocket or UDP) then websocat operates in lines: each line correspond to a message. Details of this are configurable by various options.

`ws-l:` or `mirror:` above are examples of address types. With the exception of special cases like WebSocket URL `ws://1.2.3.4/` or stdio `-`, websocat's positional argument is defined by this rule:

```
<specifier> ::= ( <overlay> ":" )* <addrtype> ":" [address]
```

Some address types may be "aliases" to other address types or combinations of overlays and address types.

[1]:http://www.dest-unreach.org/socat/doc/socat.html

# `--help=long`

"Advanced" options and flags are denoted by `[A]` marker.


```
"#);

    let mut a = Opt::clap();

    let _ = a.print_help();

    println!(
        r#"

```

# Full list of address types

"Advanced" address types are denoted by `[A]` marker.

"#
    );

    macro_rules! my {
        ($x:expr) => {
            specdoc(&$x, false);
        };
    }
    list_of_all_specifier_classes!(my);

    println!(
        r#"

# Full list of overlays

"Advanced" overlays denoted by `[A]` marker.

"#
    );

    macro_rules! my {
        ($x:expr) => {
            specdoc(&$x, true);
        };
    }
    list_of_all_specifier_classes!(my);

    println!(
        r#"
  
### Address types or specifiers to be implemented later:

`sctp:`, `speedlimit:`, `quic:`

### Final example

Final example just for fun: wacky mode

    websocat ws-c:ws-l:ws-c:- tcp:127.0.0.1:5678
    
Connect to a websocket using stdin/stdout as a transport,
then accept a websocket connection over the previous websocket used as a transport,
then connect to a websocket using previous step as a transport,
then forward resulting connection to the TCP port.

(Exercise to the reader: manage to make it actually connect to 5678).
"#
    );
}

```

### Core Architecture Module: `src/http_peer.rs`
```

#![allow(unused)]
#![allow(clippy::needless_pass_by_value,clippy::cast_lossless,clippy::identity_op)]
use futures::future::{err, ok, Future};

use std::rc::Rc;

use super::{box_up_err, peer_strerr, BoxedNewPeerFuture, Peer};
use super::{ConstructParams, L2rUser, PeerConstructor, Specifier};
use tokio_io::io::{read_exact, write_all};
use tokio_io::{AsyncRead,AsyncWrite};

use std::io::Write;
use std::net::{IpAddr, Ipv4Addr};

use std::ffi::OsString;

extern crate http_bytes;
use http_bytes::http;

use http_bytes::{Request,Response};
use crate::http::Uri;
use crate::http::Method;
use crate::util::peer_err2;

#[derive(Debug)]
pub struct HttpRequest<T: Specifier>(pub T);
impl<T: Specifier> Specifier for HttpRequest<T> {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        let inner = self.0.construct(cp.clone());
        inner.map(move |p, l2r| {
            let mut b = crate::http::request::Builder::default();
            if let Some(uri) = cp.program_options.request_uri.as_ref() {
                b.uri(uri);
            }
            if let Some(method) = cp.program_options.request_method.as_ref() {
                b.method(method);
            }
            for (hn, hv) in &cp.program_options.request_headers {
                b.header(hn, hv);
            }
            let request = b.body(()).unwrap();
            http_request_peer(&request, p, l2r)
        })
    }
    specifier_boilerplate!(noglobalstate has_subspec);
    self_0_is_subspecifier!(proxy_is_multiconnect);
}
specifier_class!(
    name = HttpRequestClass,
    target = HttpRequest,
    prefixes = ["http-request:"],
    arg_handling = subspec,
    overlay = true,
    StreamOriented,
    MulticonnectnessDependsOnInnerType,
    help = r#"
[A] Issue HTTP request, receive a 1xx or 2xx reply, then pass
the torch to outer peer, if any - lowlevel version.

Content you write becomes body, content you read is body that server has sent.

URI is specified using a separate command-line parameter

Example:

    websocat -Ub - http-request:tcp:example.com:80 --request-uri=http://example.com/ --request-header 'Connection: close'
"#
);

/// Inner peer is a TCP peer configured to this host
#[derive(Debug)]
pub struct Http<T: Specifier>(pub T, pub Uri);
impl<T: Specifier> Specifier for Http<T> {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        let inner = self.0.construct(cp.clone());
        let uri = self.1.clone();
        inner.map(move |p, l2r| {
            let mut b = crate::http::request::Builder::default();
            b.uri(uri.clone());
            if let Some(method) = cp.program_options.request_method.as_ref() {
                b.method(method);
            }
            for (hn, hv) in &cp.program_options.request_headers {
                b.header(hn, hv);
            }
            let request = b.body(()).unwrap();
            http_request_peer(&request, p, l2r)
        })
    }
    specifier_boilerplate!(noglobalstate has_subspec);
    self_0_is_subspecifier!(proxy_is_multiconnect);
}
specifier_class!(
    name = HttpClass,
    target = Http,
    prefixes = ["http:"],
    arg_handling = {
        fn construct(self: &HttpClass, arg: &str) -> super::Result<Rc<dyn Specifier>> {
            let uri : Uri = format!("http:{}", arg).parse()?;
            let tcp_peer;
            {
                let auth = uri.authority_part().unwrap();
                let host = auth.host();
                let port = auth.port_part();
                let addr = if let Some(p) = port {
                    format!("tcp:{}:{}", host, p)
                } else {
                    format!("tcp:{}:80", host)
                };
                tcp_peer = crate::spec(addr.as_ref())?;
            }
            Ok(Rc::new(Http(tcp_peer, uri)))
        }
        fn construct_overlay(
            self: &HttpClass,
            _inner: Rc<dyn Specifier>,
        ) -> super::Result<Rc<dyn Specifier>> {
            panic!("Error: construct_overlay called on non-overlay specifier class")
        }
    },
    overlay = false,
    StreamOriented,
    SingleConnect,
    help = r#"
[A] Issue HTTP request, receive a 1xx or 2xx reply, then pass
the torch to outer peer, if any - highlevel version.

Content you write becomes body, content you read is body that server has sent.

URI is specified inline.

Example:

    websocat  -b - http://example.com < /dev/null
"#
);



#[derive(Copy,Clone,PartialEq,Debug)]
enum HttpHeaderEndDetectionState {
    Neutral,
    FirstCr,
    FirstLf,
    SecondCr,
    FoundHeaderEnd,
}

struct WaitForHttpHead<R : AsyncRead>
{
    buf: Option<Vec<u8>>,
    offset : usize,
    state: HttpHeaderEndDetectionState,
    io : Option<R>,
}

struct WaitForHttpHeadResult {
    buf: Vec<u8>,
    // Before the offset is header, after the offset is debt
    offset: usize,
}

impl<R:AsyncRead> WaitForHttpHead<R> {
    pub fn new(r:R) -> WaitForHttpHead<R> {
        WaitForHttpHead {
            buf: Some(Vec::with_capacity(512)),
            offset: 0,
            state: HttpHeaderEndDetectionState::Neutral,
            io: Some(r),
        }
    }
}

impl<R:AsyncRead> Future for WaitForHttpHead<R> {
    type Item = (WaitForHttpHeadResult, R);
    type Error = Box<dyn std::error::Error>;

    fn poll(&mut self) -> ::futures::Poll<Self::Item, Self::Error> {
        loop {
            if self.buf.is_none() || self.io.is_none() {
                Err("WaitForHttpHeader future polled after completion")?;
            }
            let ret;
            {
                let buf = self.buf.as_mut().unwrap();
                let io = self.io.as_mut().unwrap();
                if buf.len() < self.offset + 1024 {
                    buf.resize(self.offset + 1024, 0u8);
                }
                ret = try_nb!(io.read(&mut buf[self.offset..]));

                if ret == 0 {
                    Err("Trimmed HTTP head")?;
                }
            }

            // parse
            for i in self.offset..(self.offset+ret) {
                let x = self.buf.as_ref().unwrap()[i];
                use self::HttpHeaderEndDetectionState::*;
                //eprint!("{:?} -> ", self.state);
                self.state = match (self.state, x) {
                    (Neutral, b'\r') => FirstCr,
                    (FirstCr, b'\n') => FirstLf,
                    (FirstLf, b'\r') => SecondCr,
                    (SecondCr, b'\n') => FoundHeaderEnd,
                    _ => Neutral,
                };
                //eprintln!("{:?}", self.state);
                if self.state == FoundHeaderEnd {
                    let io = self.io.take().unwrap();
                    let mut buf = self.buf.take().unwrap();
                    buf.resize(self.offset + ret, 0u8);
                    return Ok(::futures::Async::Ready((
                        WaitForHttpHeadResult { buf, offset: i+1},
                        io,
                    )));
                }
            }

            self.offset += ret;

            if self.offset > 60_000 {
                Err("HTTP head too long")?;
            }
        }
    }
}

pub fn http_request_peer(
    request: &Request,
    inner_peer: Peer,
    _l2r: L2rUser,
) -> BoxedNewPeerFuture {
    let request = ::http_bytes::request_header_to_vec(request);

    let (r, w, hup) = (inner_peer.0, inner_peer.1, inner_peer.2);

    info!("Issuing HTTP request");
    let f = ::tokio_io::io::write_all(w, request)
        .map_err(box_up_err)
        .and_then(move |(w, request)| {
            WaitForHttpHead::new(r).and_then(|(res, r)|{
                debug!("Got HTTP response head");
                let ret = (move||{
                    {
                        let headbuf = &res.buf[0..res.offset];
                        trace!("{:?}",headbuf);
                        let p = http_bytes::parse_response_header_easy(headbuf)?;
                        if p.is_none() {
                            Err("Something wrong with response HTTP head")?;
                        }
                        let p = p.unwrap();
                        if !p.1.is_empty() {
                            Err("Something wrong with parsing HTTP")?;
                        }
                        let response = p.0;
                        let status = response.status();
                        info!("HTTP response status: {}", status);
                        debug!("{:#?}", response);
                        if status.is_success() || status.is_informational() {
                            // OK
                        } else {
                            Err("HTTP response indicates failure")?;
                        }
                    }
                    let remaining = res.buf.len() - res.offset;
                    if remaining == 0 {
                        Ok(Peer::new(r,w,hup))
                    } else {
                        debug!("{} bytes of debt to be read", remaining);
                        let r = super::trivial_peer::PrependRead {
                            inner: r,
                            header: res.buf,
                            remaining,
                        };
                        Ok(Peer::new(r,w,hup))
                    }
                })();
                ::futures::future::result(ret)
            })
        })
    ;

    Box::new(f) as BoxedNewPeerFuture
}


#[derive(Debug)]
pub struct HttpPostSse<T: Specifier>(pub T);
impl<T: Specifier> Specifier for HttpPostSse<T> {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        let inner = self.0.construct(cp.clone());
        inner.map(move |p, l2r| {
            http_response_post_sse_peer(p, l2r)
        })
    }
    specifier_boilerplate!(noglobalstate has_subspec);
    self_0_is_subspecifier!(proxy_is_multiconnect);
}
specifier_class!(
    name = HttpPostSseClass,
    target = HttpPostSse,
    prefixes = ["http-post-sse:"],
    arg_handling = subspec,
    overlay = true,
    MessageOriented,
    Multiconnectne
```

### Core Architecture Module: `src/http_serve.rs`
```
use self::hyper::http::h1::Incoming;
use self::hyper::method::Method;
use self::hyper::uri::RequestUri;
use self::hyper::uri::RequestUri::AbsolutePath;
use super::hyper;

use futures::future::Future;
use std::fs::File;
use std::rc::Rc;

use crate::options::StaticFile;
use crate::trivial_peer::get_literal_peer_now;
use crate::Peer;

use crate::my_copy::{copy, CopyOptions};

const BAD_REQUEST :&[u8] = b"HTTP/1.1 400 Bad Request\r\nServer: websocat\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nOnly WebSocket connections are welcome here\n";

const NOT_FOUND: &[u8] = b"HTTP/1.1 404 Not Found\r\nServer: websocat\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nURI does not match any -F option and is not a WebSocket connection.\n";

const NOT_FOUND2: &[u8] = b"HTTP/1.1 500 Not Found\r\nServer: websocat\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nFailed to open the file on server side.\n";

const BAD_METHOD :&[u8] = b"HTTP/1.1 400 Bad Request\r\nServer: websocat\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nHTTP method should be GET\n";

const BAD_URI_FORMAT :&[u8] = b"HTTP/1.1 400 Bad Request\r\nServer: websocat\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nURI should be an absolute path\n";

pub fn get_static_file_reply(len: Option<u64>, ct: &str) -> Vec<u8> {
    let mut q = Vec::with_capacity(256);
    q.extend_from_slice(b"HTTP/1.1 200 OK\r\nServer: websocat\r\nContent-Type: ");
    q.extend_from_slice(ct.as_bytes());
    q.extend_from_slice(b"\r\n");
    if let Some(x) = len {
        q.extend_from_slice(b"Content-Length: ");
        q.extend_from_slice(format!("{}", x).as_bytes());
        q.extend_from_slice(b"\r\n");
    }
    q.extend_from_slice(b"\r\n");
    q
}

#[allow(clippy::needless_pass_by_value)]
pub fn http_serve(
    p: Peer,
    incoming: Option<Incoming<(Method, RequestUri)>>,
    serve_static_files: Rc<Vec<StaticFile>>,
) -> Box<dyn Future<Item = (), Error = ()>> {
    let mut serve_file = None;
    let content = if serve_static_files.is_empty() {
        BAD_REQUEST.to_vec()
    } else if let Some(inc) = incoming {
        info!("HTTP-serving {:?}", inc.subject);
        if inc.subject.0 == Method::Get {
            match inc.subject.1 {
                AbsolutePath(x) => {
                    let mut reply = None;
                    for sf in &*serve_static_files {
                        if sf.uri == x {
                            match File::open(&sf.file) {
                                Ok(f) => {
                                    let fs = match f.metadata() {
                                        Err(_) => None,
                                        Ok(x) => Some(x.len()),
                                    };
                                    reply = Some(get_static_file_reply(fs, &sf.content_type));
                                    serve_file = Some(f);
                                }
                                Err(_) => {
                                    reply = Some(NOT_FOUND2.to_vec());
                                }
                            }
                        }
                    }
                    reply.unwrap_or_else(|| NOT_FOUND.to_vec())
                }
                _ => BAD_URI_FORMAT.to_vec(),
            }
        } else {
            BAD_METHOD.to_vec()
        }
    } else {
        BAD_REQUEST.to_vec()
    };
    let reply = get_literal_peer_now(content);

    let co = CopyOptions {
        buffer_size: 1024,
        once: false,
        stop_on_reader_zero_read: true,
        skip: false,
        max_ops: None,
    };

    if let Some(f) = serve_file {
        Box::new(
            copy(reply, p.1, co, vec![])
                .map_err(drop)
                .and_then(move |(_len, _, conn)| {
                    let co2 = CopyOptions {
                        buffer_size: 65536,
                        once: false,
                        stop_on_reader_zero_read: true,
                        skip: false,
                        max_ops: None,
                    };
                    let wr = crate::file_peer::ReadFileWrapper(f);
                    copy(wr, conn, co2, vec![]).map(|_| ()).map_err(drop)
                }),
        )
    } else {
        Box::new(copy(reply, p.1, co, vec![]).map(|_| ()).map_err(drop))
    }
}

```

### Core Architecture Module: `src/jsonrpc_peer.rs`
```
use futures::future::ok;

use std::rc::Rc;

use super::{BoxedNewPeerFuture, Peer};
use super::{ConstructParams, PeerConstructor, Specifier};

use std::io::Read;
use tokio_io::AsyncRead;

use std::io::Error as IoError;

#[derive(Debug)]
pub struct JsonRpc<T: Specifier>(pub T);
impl<T: Specifier> Specifier for JsonRpc<T> {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        let inner = self.0.construct(cp.clone());
        inner.map(move |p, _| jsonrpc_peer(p, cp.program_options.jsonrpc_omit_jsonrpc))
    }
    specifier_boilerplate!(noglobalstate has_subspec);
    self_0_is_subspecifier!(proxy_is_multiconnect);
}
specifier_class!(
    name = JsonRpcClass,
    target = JsonRpc,
    prefixes = ["jsonrpc:"],
    arg_handling = subspec,
    overlay = true,
    MessageOriented,
    MulticonnectnessDependsOnInnerType,
    help = r#"
[A] Turns messages like `abc 1,2` into `{"jsonrpc":"2.0","id":412, "method":"abc", "params":[1,2]}`.

For simpler manual testing of websocket-based JSON-RPC services

Example: TODO
"#
);

pub fn jsonrpc_peer(inner_peer: Peer, omit_jsonrpc: bool) -> BoxedNewPeerFuture {
    let filtered = JsonRpcWrapper(inner_peer.0, 1, omit_jsonrpc);
    let thepeer = Peer::new(filtered, inner_peer.1, inner_peer.2);
    Box::new(ok(thepeer)) as BoxedNewPeerFuture
}
struct JsonRpcWrapper(Box<dyn AsyncRead>, u64, bool);

impl Read for JsonRpcWrapper {
    fn read(&mut self, b: &mut [u8]) -> Result<usize, IoError> {
        let l = b.len();
        assert!(l > 1);
        let n = self.0.read(&mut b[..l])?;
        if n == 0 {
            return Ok(0);
        }
        let mut method = Vec::with_capacity(20);
        let mut params = Vec::with_capacity(20);
        enum PS {
            BeforeMethodName,
            InsideMethodName,
            AfterMethodName,
            InsideParams,
        }
        let mut s = PS::BeforeMethodName;
        for &c in b[..n].iter() {
            match s {
                PS::BeforeMethodName => {
                    if c == b' ' || c == b'\t' || c == b'\n' {
                        // ignore
                    } else {
                        method.push(c);
                        s = PS::InsideMethodName;
                    }
                }
                PS::InsideMethodName => {
                    if c == b' ' || c == b'\t' || c == b'\n' {
                        s = PS::AfterMethodName;
                    } else {
                        method.push(c);
                    }
                }
                PS::AfterMethodName => {
                    if c == b' ' || c == b'\t' || c == b'\n' {
                        // ignore
                    } else {
                        params.push(c);
                        s = PS::InsideParams;
                    }
                }
                PS::InsideParams => {
                    params.push(c);
                }
            }
        }

        let mut bb = ::std::io::Cursor::new(b);
        use std::io::Write;
        //{"jsonrpc":"2.0","id":412, "method":"abc", "params":[1,2]}
        if self.2 {
            let _ = bb.write_all(b"{\"id\":");
        } else {
            let _ = bb.write_all(b"{\"jsonrpc\":\"2.0\",\"id\":");
        }
        let _ = bb.write_all(format!("{}", self.1).as_bytes());
        self.1 += 1;
        let _ = bb.write_all(b", \"method\":\"");
        let _ = bb.write_all(&method);
        let _ = bb.write_all(b"\", \"params\":");
        let needs_brackets = params.is_empty() || params[0] != b'{' && params[0] != b'[';
        if !params.is_empty() && params[params.len() - 1] == b'\n' {
            let l = params.len() - 1;
            params.truncate(l);
        }
        if !params.is_empty() && params[params.len() - 1] == b'\r' {
            let l = params.len() - 1;
            params.truncate(l);
        }
        if needs_brackets {
            let _ = bb.write_all(b"[");
        }
        let _ = bb.write_all(&params);
        if needs_brackets {
            let _ = bb.write_all(b"]");
        }
        let _ = bb.write_all(b"}\n");
        if bb.position() as usize == l {
            warn!("Buffer too small, JSON RPC message may be truncated.");
        }
        Ok(bb.position() as usize)
    }
}
impl AsyncRead for JsonRpcWrapper {}

```

### Core Architecture Module: `src/lengthprefixed_peer.rs`
```
use futures::future::ok;

use std::rc::Rc;

use crate::{io_other_error, simple_err, peer_strerr};

use super::{BoxedNewPeerFuture, Peer};
use super::{ConstructParams, PeerConstructor, Specifier};

use std::io::{Read, Write};
use tokio_io::{AsyncRead, AsyncWrite};

use std::io::Error as IoError;

#[derive(Debug)]
pub struct LengthPrefixed<T: Specifier>(pub T);
impl<T: Specifier> Specifier for LengthPrefixed<T> {
    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
        let inner = self.0.construct(cp.clone());
        inner.map(move |p, _| {
            lengthprefixed_peer(
                p,
                cp.program_options.lengthprefixed_header_bytes,
                cp.program_options.lengthprefixed_little_endian,
                cp.program_options.lengthprefixed_skip_read_direction,
                cp.program_options.lengthprefixed_skip_write_direction,
            )
        })
    }
    specifier_boilerplate!(noglobalstate has_subspec);
    self_0_is_subspecifier!(proxy_is_multiconnect);
}
specifier_class!(
    name = LengthPrefixedClass,
    target = LengthPrefixed,
    prefixes = ["lengthprefixed:"],
    arg_handling = subspec,
    overlay = true,
    MessageOriented,
    MulticonnectnessDependsOnInnerType,
    help = r#"
Turn stream of bytes to/from data packets with length-prefixed framing.  [A]

You can choose the number of header bytes (1 to 8) and endianness. Default is 4 bytes big endian.

This affects both reading and writing - attach this overlay to stream specifier to turn it into a packet-orineted specifier.

Mind the buffer size (-B). All packets should fit in there.

Examples:

    websocat -u -b udp-l:127.0.0.1:1234 lengthprefixed:writefile:test.dat

    websocat -u -b lengthprefixed:readfile:test.dat udp:127.0.0.1:1235

This would save incoming UDP packets to a file, then replay the datagrams back to UDP socket

    websocat -b lengthprefixed:- ws://127.0.0.1:1234/ --binary-prefix=B --text-prefix=T

This allows to mix and match text and binary WebSocket messages to and from stdio without the base64 overhead.
"#
);

pub fn lengthprefixed_peer(
    inner_peer: Peer,
    num_bytes_in_length_prefix: usize,
    little_endian: bool,
    lengthprefixed_skip_read_direction: bool,
    lengthprefixed_skip_write_direction: bool,
) -> BoxedNewPeerFuture {
    if !(1..=8).contains(&num_bytes_in_length_prefix) {
        return peer_strerr("Number of header bytes for lengthprefixed overlay should be from 1 to 8");
    }

    let (length_starting_pos, length_ending_pos) = if little_endian {
        (0, num_bytes_in_length_prefix)
    } else {
        (8 - num_bytes_in_length_prefix, 8)
    };
    let reader = Lengthprefixed2PacketWrapper {
        inner: inner_peer.0,
        length_buffer: [0; 8],
        length_starting_pos,
        length_pos: length_starting_pos,
        length_ending_pos,
        little_endian,
        data_read_so_far: 0,
    };
    let writer = Packet2LengthPrefixedWrapper {
        inner: inner_peer.1,
        length_buffer: [0; 8],
        length_starting_pos,
        length_pos: length_starting_pos,
        length_ending_pos,
        little_endian,
        data_written_so_far: 0,
    };
    let thepeer = match (lengthprefixed_skip_read_direction, lengthprefixed_skip_write_direction) {
        (true, true)   => Peer::new(reader.inner, writer.inner, inner_peer.2),
        (true, false)  => Peer::new(reader.inner, writer,       inner_peer.2),
        (false, true)  => Peer::new(reader,       writer.inner, inner_peer.2),
        (false, false) => Peer::new(reader,       writer,       inner_peer.2),
    };
    Box::new(ok(thepeer)) as BoxedNewPeerFuture
}
struct Lengthprefixed2PacketWrapper {
    inner: Box<dyn AsyncRead>,
    length_buffer: [u8; 8],
    length_starting_pos: usize,
    length_ending_pos: usize,
    length_pos: usize,
    little_endian: bool,
    data_read_so_far: usize,
}
impl Read for Lengthprefixed2PacketWrapper {
    fn read(&mut self, buf: &mut [u8]) -> Result<usize, IoError> {
        loop {
            assert!(self.length_pos <= self.length_ending_pos);
            assert!(self.length_pos >= self.length_starting_pos);
            if self.length_ending_pos != self.length_pos {
                match self
                    .inner
                    .read(&mut self.length_buffer[self.length_pos..self.length_ending_pos])
                {
                    Err(e) => return Err(e),
                    Ok(0) => {
                        if self.length_pos != self.length_starting_pos {
                            error!("Possibly trimmed length-prefixed data.")
                        }
                        return Ok(0);
                    }
                    Ok(n) => {
                        self.length_pos += n;
                        continue;
                    }
                }
            } else {
                let packet_len = if self.little_endian {
                    u64::from_le_bytes(self.length_buffer)
                } else {
                    u64::from_be_bytes(self.length_buffer)
                };
                if packet_len >= (buf.len() as u64) {
                    error!("Failed to process too big packet. You may need to increase the -B buffer size.");
                    return Err(io_other_error(simple_err("Packet length overflow".into())));
                }
                let packet_len = packet_len as usize;
                if packet_len == 0 {
                    return Ok(0);
                }

                if self.data_read_so_far == packet_len {
                    self.data_read_so_far = 0;
                    self.length_buffer = [0; 8];
                    self.length_pos = self.length_starting_pos;
                    return Ok(packet_len);
                }

                // Assume we are called with the same buffer until we return success, so we
                // can use buffer as a persistent scratch space
                match self.inner.read(&mut buf[self.data_read_so_far..packet_len]) {
                    Err(e) => return Err(e),
                    Ok(0) => {
                        return Err(io_other_error(simple_err("Data trimmed".into())));
                    }
                    Ok(n) => {
                        self.data_read_so_far += n;
                        continue;
                    }
                }
            }
        }
    }
}
impl AsyncRead for Lengthprefixed2PacketWrapper {}

struct Packet2LengthPrefixedWrapper {
    inner: Box<dyn AsyncWrite>,
    length_buffer: [u8; 8],
    length_starting_pos: usize,
    length_ending_pos: usize,
    length_pos: usize,
    little_endian: bool,
    data_written_so_far: usize,
}

impl Write for Packet2LengthPrefixedWrapper {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        // Assuming `write` is retried with the same buffer when we return WouldBlock
        loop {
            if self.length_pos == self.length_starting_pos {
                if self.little_endian {
                    self.length_buffer = (buf.len() as u64).to_le_bytes()
                } else {
                    self.length_buffer = (buf.len() as u64).to_be_bytes()
                }
            }
            if self.length_pos < self.length_ending_pos {
                match self
                    .inner
                    .write(&self.length_buffer[self.length_pos..self.length_ending_pos])
                {
                    Err(x) => return Err(x),
                    Ok(n) => self.length_pos += n,
                }
                continue;
            }

            if self.data_written_so_far == buf.len() {
                self.data_written_so_far = 0;
                self.length_pos = self.length_starting_pos;
                self.length_buffer = [0; 8];
                return Ok(buf.len());
            }

            match self.inner.write(&buf[self.data_written_so_far..]) {
                Err(e) => return Err(e),
                Ok(n) => self.data_written_so_far += n,
            }
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

impl AsyncWrite for Packet2LengthPrefixedWrapper {
    fn shutdown(&mut self) -> futures::Poll<(), std::io::Error> {
        self.inner.shutdown()
    }
}

```

### Core Architecture Module: `src/lib.rs`
```
//! Note: library usage is not semver/API-stable
//!
//! Type evolution of a websocat run:
//!
//! 1. `&str` - string as passed to command line. When it meets the list of `SpecifierClass`es, there appears:
//! 2. `SpecifierStack` - specifier class, final string argument and vector of overlays.
//! 3. `Specifier` - more rigid version of SpecifierStack, with everything parsable parsed. May be nested. When `construct` is called, we get:
//! 4. `PeerConstructor` - a future or stream that returns one or more connections. After completion, we get one or more of:
//! 5. `Peer` - an active connection. Once we have two of them, we can start a:
//! 6. `Session` with two `Transfer`s - forward and reverse.

#![allow(renamed_and_removed_lints)]

extern crate futures;
#[macro_use]
extern crate tokio_io;
extern crate tokio_current_thread;
extern crate tokio_reactor;
extern crate tokio_tcp;
extern crate tokio_udp;
extern crate tokio_codec;
extern crate tokio_timer;
extern crate websocket;
extern crate websocket_base;
extern crate http_bytes;
extern crate anymap;
pub use http_bytes::http;

extern crate tk_listen;
extern crate net2;

#[macro_use]
extern crate log;

#[macro_use]
extern crate slab_typesafe;

#[macro_use]
extern crate smart_default;
#[macro_use]
extern crate derivative;

use futures::future::Future;
use tokio_io::{AsyncRead, AsyncWrite};

use futures::Stream;

use std::cell::RefCell;
use std::rc::Rc;
use std::str::FromStr;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

/// First representation of websocat command-line, partially parsed.
pub struct WebsocatConfiguration1 {
    pub opts: Options,
    pub addr1: String,
    pub addr2: String,
}

impl WebsocatConfiguration1 {
    /// Is allowed to call blocking calls
    /// happens only at start of websocat
    pub fn parse1(self) -> Result<WebsocatConfiguration2> {
        Ok(WebsocatConfiguration2 {
            opts: self.opts,
            s1: SpecifierStack::from_str(self.addr1.as_str())?,
            s2: SpecifierStack::from_str(self.addr2.as_str())?,
        })
    }
}

/// Second representation of websocat configuration: everything
/// (e.g. socket addresses) should already be parsed and verified
/// A structural form: two chains of specifier nodes.
/// Futures/async is not yet involved at this stage, but everything
/// should be checked and ready to do to start it (apart from OS errors)
/// 
/// This form is designed to be editable by lints and command-line options.
pub struct WebsocatConfiguration2 {
    pub opts: Options,
    pub s1: SpecifierStack,
    pub s2: SpecifierStack,
}

impl WebsocatConfiguration2 {
    pub fn parse2(self) -> Result<WebsocatConfiguration3> {
        Ok(WebsocatConfiguration3 {
            opts: self.opts,
            s1: <dyn Specifier>::from_stack(&self.s1)?,
            s2: <dyn Specifier>::from_stack(&self.s2)?,
        })
    }
}

/// An immutable chain of functions that results in a `Future`s or `Streams` that rely on each other.
/// This is somewhat like a frozen form of `WebsocatConfiguration2`.
pub struct WebsocatConfiguration3 {
    pub opts: Options,
    pub s1: Rc<dyn Specifier>,
    pub s2: Rc<dyn Specifier>,
}

impl WebsocatConfiguration3 {
    pub fn serve<OE>(self, onerror: std::rc::Rc<OE>) -> impl Future<Item = (), Error = ()>
    where
        OE: Fn(Box<dyn std::error::Error>) + 'static,
    {
        serve(self.s1, self.s2, self.opts, onerror)
    }
}

pub mod options;
pub use crate::options::Options;

#[derive(SmartDefault)]
pub struct ProgramState(
    #[default(anymap::AnyMap::with_capacity(2))]
    anymap::AnyMap
);

/// Some information passed from the left specifier Peer to the right
#[derive(Default, Clone)]
pub struct LeftSpecToRightSpec {
    /// URI the client requested when connecting to WebSocket
    uri: Option<String>,
    /// Address:port of connecting client, if it is TCP
    client_addr: Option<String>,
    /// All incoming HTTP headers
    headers: Vec<(String, String)>,
}

pub type L2rWriter = Rc<RefCell<LeftSpecToRightSpec>>;
pub type L2rReader = Rc<LeftSpecToRightSpec>;

#[derive(Clone)]
pub enum L2rUser {
    FillIn(L2rWriter),
    ReadFrom(L2rReader),
}

/// Resolves if/when TCP socket gets reset
pub type HupToken = Box<dyn Future<Item=(), Error=Box<dyn std::error::Error>>>;

pub struct Peer(Box<dyn AsyncRead>, Box<dyn AsyncWrite>, Option<HupToken>);

pub type BoxedNewPeerFuture = Box<dyn Future<Item = Peer, Error = Box<dyn std::error::Error>>>;
pub type BoxedNewPeerStream = Box<dyn Stream<Item = Peer, Error = Box<dyn std::error::Error>>>;

#[macro_use]
pub mod specifier;
pub use crate::specifier::{
    ClassMessageBoundaryStatus, ClassMulticonnectStatus, ConstructParams, Specifier,
    SpecifierClass, SpecifierStack,
};

#[macro_use]
pub mod all_peers;

pub mod lints;
mod my_copy;

pub use crate::util::{brokenpipe, io_other_error, simple_err2, wouldblock};

#[cfg(all(unix, feature = "unix_stdio"))]
pub mod stdio_peer;

pub mod file_peer;
pub mod mirror_peer;
pub mod net_peer;
pub mod stdio_threaded_peer;
pub mod trivial_peer;
pub mod ws_client_peer;
pub mod ws_peer;
pub mod ws_server_peer;
pub mod ws_lowlevel_peer;
pub mod http_peer;

#[cfg(feature = "tokio-process")]
pub mod process_peer;


#[cfg(all(windows,feature = "windows_named_pipes"))]
pub mod windows_np_peer;

#[cfg(unix)]
pub mod unix_peer;

pub mod broadcast_reuse_peer;
pub mod jsonrpc_peer;
pub mod timestamp_peer;
pub mod line_peer;
pub mod lengthprefixed_peer;
pub mod foreachmsg_peer;
pub mod primitive_reuse_peer;
pub mod reconnect_peer;

pub mod socks5_peer;
#[cfg(feature = "ssl")]
pub mod ssl_peer;

#[cfg(feature = "crypto_peer")]
pub mod crypto_peer;

#[cfg(feature = "prometheus_peer")]
pub mod prometheus_peer;

pub mod specparse;

pub type PeerOverlay = Rc<dyn Fn(Peer, L2rUser) -> BoxedNewPeerFuture>;

pub enum PeerConstructor {
    ServeOnce(BoxedNewPeerFuture),
    ServeMultipleTimes(BoxedNewPeerStream),
    Overlay1(BoxedNewPeerFuture, PeerOverlay),
    OverlayM(BoxedNewPeerStream, PeerOverlay),
    Error(Box<dyn std::error::Error>),
}

/// A remnant of the hack
pub fn spawn_hack<T>(f: T)
where
    T: Future<Item = (), Error = ()> + 'static,
{
    tokio_current_thread::TaskExecutor::current()
        .spawn_local(Box::new(f))
        .unwrap()
}

pub mod util;
pub use crate::util::{box_up_err, multi, once, peer_err, peer_err_s, peer_strerr, simple_err};

pub mod readdebt;

pub use crate::specparse::spec;

pub struct Transfer {
    from: Box<dyn AsyncRead>,
    to: Box<dyn AsyncWrite>,
}
pub struct Session {
    t1: Transfer,
    t2: Transfer,
    opts: Rc<Options>,
    hup1: Option<HupToken>,
    hup2: Option<HupToken>,
}

pub mod sessionserve;
pub use crate::sessionserve::serve;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #311** (2026-07-26): **websocat fails to build with OpenSSL 4.0**
  *Symptoms*: ## websocat Version  websocat HEAD https://github.com/vi/websocat/commit/d54697e2639cd7b17341e6f3903d71a55b0fda20  ## System information Arch Linux Rolling  ## Describe the bug websocat fails to build with OpenSSL 4.0.  ## Additional information Steps to reproduce: ``` $ git clone https://github.com/vi/websocat.git $ cd websocat $ cargo build ....   --- stderr    thread 'main' (2702) panicked at /build/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/openssl-sys-0.9.104/build/main.rs:423:5:     This crate is only compatible with OpenSSL (version 1.0.1 through 1.1.1, or 3), or LibreSSL 2.5   through 4.0.x, but a different version of OpenSSL was found. The build is now aborting   due to this version mismatch.     note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace warning: build failed, waiting for other jobs to finish... ``` - [websocat-openssl-4.0-build-failure.log](https://github.com/user-attachments/files/30386740/websocat-openssl-4.0-build-failure.log) - [openssl-sys 0.9.114](https://github.com/rust-openssl/rust-openssl/compare/openssl-sys-v0.9.113...openssl-sys-v0.9.114) - [openssl 0.10.78](https://github.com/rust-openssl/rust-openssl/compare/openssl-v0.10.77...openssl-v0.10.78)  @anthraxx @pierres 
  **Post-Mortem & Fix Analysis**:
  > Updated locked `openssl-sys` dependency - please check if it builds with OpenSSL 4 now.  Note that `vendored_openssl` mode would still use OpenSSL 3.6.3 instead of 4.x
  > > Updated locked `openssl-sys` dependency - please check if it builds with OpenSSL 4 now.  Thank you for the fast response. The openssl crate needs to be updated as well: ``` error[E0308]: mismatched types     --> /build/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/openssl-0.10.64/src/x509/mod.rs:1347:37      | 1347 |             Asn1StringRef::from_ptr(data)      |             ----------------------- ^^^^ types differ in mutability      |             |      |             arguments to this function are incorrect      |      = note: expected raw pointer `*mut ASN1_STRING`                 found raw pointer `*const ASN1_STRING` note: associated function defined here     --> /build/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/foreign-types-shared-0.1.1/src/lib.rs:36:15      |   36 |     unsafe fn from_ptr<'a>(ptr: *mut Self::CType) -> &'a Self {      |               ^^^^^^^^  error[E0308]: mismatched types     --> /build/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/
  > Updated `openssl` too.  Note: previous commit has been overwritten by a forced push.

- **Issue #310** (2026-07-22): **Handle canceled pinger in ws_peer.rs**
  *Symptoms*: Prevent unneeded warnings `[WARN  websocat::ws_peer] unsync/oneshot: oneshot canceled`  [oneshot::Reciever](https://docs.smithy.rs/futures/unsync/oneshot/struct.Receiver.html#method.close) `poll` has a special return case called Canceled.  > If Canceled is returned from poll then no message was sent.  This should proably be ignored.  
  **Post-Mortem & Fix Analysis**:
  > Thank you! This can most probably close #205.

- **Issue #309** (2026-04-29): **Add writefile_ts:, readfile_ts:, and readfile_ts_loop: specifiers**
  *Symptoms*: writefile_ts: captures each incoming chunk to a binary file prefixed with a 16-byte header (magic 0xC0DEBABE, microsecond timestamp, length).  readfile_ts: replays such a file to a peer with the original inter-chunk timing preserved via tokio_timer::Delay. Use --binary to suppress automatic line-mode wrapping.  readfile_ts_loop: is identical but restarts from the first chunk after the last one is sent, replaying indefinitely.
  **Post-Mortem & Fix Analysis**:
  > > writefile_ts:  > prefixed with a 16-byte header   Seems to be close to `lengthprefixed:writefile:`, though it does not handle timestamps.  In general it seems too integrated - deals simultaneously with file IO, headers, and timestamps. It is unlikely to be added to Websocat as is.  My vision of the feature design is like this:  1. `timestamps:` overlay that records timestamps to metadata 2. More advanced `lengthprefixed:` overlay that can also add timestamp fields 3. `loop:` overlay to loop arbitrary underlying specifier 4. `timestamp-replay:` to sleep based on timestamps.  `readfile_ts_loop:` may be then alias to something like `loop:timestamp-replay:lengthprefixed:readfile:`.  I am unlikely to implement all of this in Websocat1 scope.  Websocat4 branch already has some of the pieces (somewhat more powerful `lengthprefixed:`) and may be in general more suitable for experimenting with various ideas.  ---  Recording and replaying Websocket sessions can also happ
  > Yes, I suspected this PR would be a bit too specific for my current needs. I will see if get time to implement it according your vision later on. Thanks for providing a great tool anyway.

- **Issue #308** (2026-04-09): **Automatically and conditionally respond to request from server**
  *Symptoms*: Hello!  There is an extension on Twitch (StreamSocket Events) that I am trying to set up, which sends a websocket message to a server when someone presses a button on that extension. The server then sends a message to the persistent client on my PC. Connecting to the server and interacting with it manually works fine.  I am trying to write a bash script to automate the actions that need to be taken depending on the payload of the received websocket message. In general, this works. However, the server sends a request to check the connection every 10 or so seconds, and if a specific payload isn't received by the server, it ends the connection. The issue I am running into is automatically responding to this request over the existing client. Is there a way to send a payload automatically to a server in response to a request?  What I'm currently doing is the following  `./Downloads/websocat.x86_64-unknown-linux-musl wss://streamsocket.kadokta.com/api/v1/streamer/custom/channel/XXXXXXXXXX | while read line ; do echo $line; done` , where `echo $line` would be replaced with an if-statement assessing the payload. Of course, in the case of the request, it should respond with the correct payload, though I haven't been able to figure out a way to actually do that last part so far. I imagine there may be a better way to do this with overlays, but I must admit I am a bit overwhelmed at the moment 😅
  **Post-Mortem & Fix Analysis**:
  > Maybe it's time to move from Websocat+bash towards a dedicated (e.g. Python) script that keeps connection with the server while also accepting external events?  If that "a request to check" is a Websocket ping frame then Websocat should respond to it automatically. But if it requires processing (e.g. decoding a JSON) then Websocat overlays are of little help.
  > Yeah, I was thinking of python as a contingency, but wanted to see if there was a (practical) way for it to work with websocat. Python it is.  The request sent by the server is sent as a websocket message, so the message has to be parsed and the response based on that.

- **Issue #307** (2026-04-01): **Support SSLKEYLOGFILE for TLS session key logging**
  *Symptoms*: When the SSLKEYLOGFILE environment variable is set, bypass native-tls and use the openssl crate directly to enable SSL_CTX_set_keylog_callback. This writes TLS session keys in NSS key log format, allowing Wireshark and similar tools to decrypt captured TLS traffic for debugging.  Coverage includes all three TLS code paths: ssl-connect/ssl-accept overlays, wss-listen, and wss:// client URLs. When SSLKEYLOGFILE is unset, the existing native-tls behavior is completely unchanged.
  **Post-Mortem & Fix Analysis**:
  > # Failed cross-compilation targets  By itself, it fails compilation of  `i686-pc-windows-gnu` and MacOS cross-compilation targets, which does not normally depend on OpenSSL.  # Separate flag  I think should be a separate Cargo crate feature flag (not joined with the regular `ssl`).  # Modularity, code duplication and correctness  Maybe those "keylog" things should be in e.g. `ssl_keylog.rs` instead of mixed together with regular mode?  Also `get_ws_client_peer_openssl` feels like repeats something also present elsewhere.  Are you sure all modes and features are really supported in the `SSLKEYLOGFILE` mode?  For example,  `SSLKEYLOGFILE=qqq websocat wss://[2a0d:7c40:3000:1326::2]/mirror` behaves differently (incorrectly) than `websocat wss://[2a0d:7c40:3000:1326::2]/mirror`.  # Websocat4  Though there is already some SSLKEYLOGFILE support in Websocat4 branch, it is not enabled by default and only works for rustls mode.  Similar (but cleaner and more narrow) pull re

- **Issue #306** (2026-03-24): **Support SSLKEYLOGFILE for TLS session key logging**
  *Symptoms*: When the SSLKEYLOGFILE environment variable is set, bypass native-tls and use the openssl crate directly to enable SSL_CTX_set_keylog_callback. This writes TLS session keys in NSS key log format, allowing Wireshark and similar tools to decrypt captured TLS traffic for debugging.  Coverage includes all three TLS code paths: ssl-connect/ssl-accept overlays, wss-listen, and wss:// client URLs. When SSLKEYLOGFILE is unset, the existing native-tls behavior is completely unchanged.

- **Issue #300** (2025-10-09): **Error while building websocat on Gentoo Linux: error[E0119]: conflicting implementations of trait `Trait` for type `(dyn Send + Sync + 'static)`**
  *Symptoms*: <img width="1148" height="526" alt="Image" src="https://github.com/user-attachments/assets/a99523ed-2c92-487f-93c9-94fb35ad0f23" />  I tried to install websocat by emerge on my machine with Gentoo Linux? but it finished with error on screenshot. I am not rust developer. how i can fix it?   
  **Post-Mortem & Fix Analysis**:
  > Ebuild may be outdated: it tries to build older version of Websocat using a new Rust toolkit.  `traitobject` dependency should be version `0.1.1` to avoid the error (I'm not sure how to fix it in Gentoo though).
  > Thanks. I installed actual `websocat` throw cargo

- **Issue #298** (2025-07-24): **Log response headers**
  *Symptoms*: This adds logging of the HTTP response headers For diagnostics with the `-v` flag it is helpful to see the response headers from the server.

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

### Incident Patch 1: `29c8c54d` (2025-12-27)
**Commit Message**: Update OpenSSL to 3.5.4 for the pre-built executables

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -864,9 +864,9 @@ checksum = "ff011a302c396a5197692431fc1948019154afc178baf7d8e37367442a4601cf"
 
 [[package]]
 name = "openssl-src"
-version = "300.4.0+3.4.0"
+version = "300.5.4+3.5.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a709e02f2b4aca747929cca5ed248880847c650233cf8b8cdc48f40aaf4898a6"
+checksum = "a507b3792995dae9b0df8a1c1e3771e8418b7c2d9f0baeba32e6fe8b06c7cb72"
 dependencies = [
  "cc",
 ]
```

---

### Incident Patch 2: `d4455623` (2025-05-23)
**Commit Message**: Update traitobject dependency to fix compilation on new Rust versions

Addresses #293.

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1768,9 +1768,9 @@ dependencies = [
 
 [[package]]
 name = "traitobject"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "efd1f82c56340fdf16f2a953d7bda4f8fdffba13d93b00844c25572110b26079"
+checksum = "04a79e25382e2e852e8da874249358d382ebaf259d0d34e75d8db16a7efabbc7"
 
 [[package]]
 name = "typeable"
```

---

### Incident Patch 3: `ccd35b30` (2025-05-07)
**Commit Message**: Fix clippy issues

**File**: `src/help.rs` (modified, +3/-4)
```diff
@@ -23,7 +23,7 @@ fn spechelp(sc: &dyn SpecifierClass, overlays: bool, advanced: bool) {
 }
 
 // https://github.com/rust-lang/rust/issues/51942
-#[cfg_attr(feature = "cargo-clippy", allow(nonminimal_bool))]
+#[allow(clippy::nonminimal_bool)]
 pub fn shorthelp() {
     //use std::io::Write;
     use std::io::{BufRead, BufReader};
@@ -33,8 +33,7 @@ pub fn shorthelp() {
     }
     let mut lines_to_display = vec![];
     let mut do_display = true;
-    #[allow(non_snake_case)]
-    for l in BufReader::new(&b[..]).lines() {
+    BufReader::new(&b[..]).lines().for_each(|l| {
         if let Ok(l) = l {
             {
                 let lt = l.trim();
@@ -70,7 +69,7 @@ pub fn shorthelp() {
                 }
             };
         }
-    }
+    });
     for l in lines_to_display {
         println!("{}", l);
     }
```

**File**: `src/http_peer.rs` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 
 #![allow(unused)]
-#![cfg_attr(feature="cargo-clippy",allow(needless_pass_by_value,cast_lossless,identity_op))]
+#![allow(clippy::needless_pass_by_value,clippy::cast_lossless,clippy::identity_op)]
 use futures::future::{err, ok, Future};
 
 use std::rc::Rc;
@@ -233,7 +233,7 @@ pub fn http_request_peer(
     inner_peer: Peer,
     _l2r: L2rUser,
 ) -> BoxedNewPeerFuture {
-    let request = ::http_bytes::request_header_to_vec(&request);
+    let request = ::http_bytes::request_header_to_vec(request);
 
     let (r, w, hup) = (inner_peer.0, inner_peer.1, inner_peer.2);
 
@@ -252,7 +252,7 @@ pub fn http_request_peer(
                             Err("Something wrong with response HTTP head")?;
                         }
                         let p = p.unwrap();
-                        if p.1.len() > 0 {
+                        if !p.1.is_empty() {
                             Err("Something wrong with parsing HTTP")?;
                         }
                         let response = p.0;
@@ -349,7 +349,7 @@ pub fn http_response_post_sse_peer(
                     Err("Something wrong with request HTTP head")?;
                 }
                 let p = p.unwrap();
-                if p.1.len() > 0 {
+                if !p.1.is_empty() {
                     Err("Something wrong with parsing HTTP request")?;
                 }
                 request = p.0;
@@ -552,4 +552,4 @@ fn test_basic_sse_stream() {
     {
         let mut ss = SseStream::new(std::io::Cursor::new(&mut v));
     }
-}
\ No newline at end of file
+}
```

**File**: `src/http_serve.rs` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ pub fn get_static_file_reply(len: Option<u64>, ct: &str) -> Vec<u8> {
     q
 }
 
-#[cfg_attr(feature = "cargo-clippy", allow(needless_pass_by_value))]
+#[allow(clippy::needless_pass_by_value)]
 pub fn http_serve(
     p: Peer,
     incoming: Option<Incoming<(Method, RequestUri)>>,
```

**File**: `src/jsonrpc_peer.rs` (modified, +1/-4)
```diff
@@ -48,10 +48,7 @@ impl Read for JsonRpcWrapper {
     fn read(&mut self, b: &mut [u8]) -> Result<usize, IoError> {
         let l = b.len();
         assert!(l > 1);
-        let n = match self.0.read(&mut b[..l]) {
-            Ok(x) => x,
-            Err(e) => return Err(e),
-        };
+        let n = self.0.read(&mut b[..l])?;
         if n == 0 {
             return Ok(0);
         }
```

**File**: `src/lengthprefixed_peer.rs` (modified, +3/-3)
```diff
@@ -68,7 +68,7 @@ pub fn lengthprefixed_peer(
     lengthprefixed_skip_read_direction: bool,
     lengthprefixed_skip_write_direction: bool,
 ) -> BoxedNewPeerFuture {
-    if num_bytes_in_length_prefix < 1 || num_bytes_in_length_prefix > 8 {
+    if !(1..=8).contains(&num_bytes_in_length_prefix) {
         return peer_strerr("Number of header bytes for lengthprefixed overlay should be from 1 to 8");
     }
 
@@ -82,7 +82,7 @@ pub fn lengthprefixed_peer(
         length_buffer: [0; 8],
         length_starting_pos,
         length_pos: length_starting_pos,
-        length_ending_pos: length_ending_pos,
+        length_ending_pos,
         little_endian,
         data_read_so_far: 0,
     };
@@ -91,7 +91,7 @@ pub fn lengthprefixed_peer(
         length_buffer: [0; 8],
         length_starting_pos,
         length_pos: length_starting_pos,
-        length_ending_pos: length_ending_pos,
+        length_ending_pos,
         little_endian,
         data_written_so_far: 0,
     };
```

**File**: `src/lib.rs` (modified, +1/-3)
```diff
@@ -10,8 +10,6 @@
 //! 6. `Session` with two `Transfer`s - forward and reverse.
 
 #![allow(renamed_and_removed_lints)]
-#![allow(unknown_lints)]
-#![cfg_attr(feature = "cargo-clippy", allow(deprecated_cfg_attr))]
 
 extern crate futures;
 #[macro_use]
@@ -106,7 +104,7 @@ pub struct WebsocatConfiguration3 {
 impl WebsocatConfiguration3 {
     pub fn serve<OE>(self, onerror: std::rc::Rc<OE>) -> impl Future<Item = (), Error = ()>
     where
-        OE: Fn(Box<dyn std::error::Error>) -> () + 'static,
+        OE: Fn(Box<dyn std::error::Error>) + 'static,
     {
         serve(self.s1, self.s2, self.opts, onerror)
     }
```

**File**: `src/line_peer.rs` (modified, +4/-10)
```diff
@@ -95,10 +95,7 @@ impl Read for Packet2LineWrapper {
     fn read(&mut self, b: &mut [u8]) -> Result<usize, IoError> {
         let l = b.len();
         assert!(l > 1);
-        let mut n = match self.0.read(&mut b[..(l - 1)]) {
-            Ok(x) => x,
-            Err(e) => return Err(e),
-        };
+        let mut n = self.0.read(&mut b[..(l - 1)])?;
         if n == 0 {
             return Ok(n);
         }
@@ -169,7 +166,7 @@ struct Line2PacketWrapper {
 }
 
 impl Line2PacketWrapper {
-    #[cfg_attr(feature = "cargo-clippy", allow(collapsible_if))]
+    #[allow(clippy::collapsible_if)]
     fn deliver_the_line(&mut self, buf: &mut [u8], mut n: usize) -> Option<usize> {
         if n > buf.len() {
             if self.drop_too_long_lines {
@@ -203,7 +200,7 @@ impl Line2PacketWrapper {
 }
 
 impl Read for Line2PacketWrapper {
-    #[cfg_attr(feature = "cargo-clippy", allow(collapsible_if))]
+    #[allow(clippy::collapsible_if)]
     fn read(&mut self, buf: &mut [u8]) -> Result<usize, IoError> {
         //eprint!("ql={} ", self.queue.len());
         if self.eof {
@@ -229,10 +226,7 @@ impl Read for Line2PacketWrapper {
                 self.read(buf)
             }
         } else {
-            let mut n = match self.inner.read(buf) {
-                Ok(x) => x,
-                Err(e) => return Err(e),
-            };
+            let mut n = self.inner.read(buf)?;
 
             if n == 0 {
                 self.eof = true;
```

**File**: `src/lints.rs` (modified, +13/-20)
```diff
@@ -1,4 +1,4 @@
-#![cfg_attr(feature="cargo-clippy", allow(collapsible_if,needless_pass_by_value))]
+#![allow(clippy::collapsible_if,clippy::needless_pass_by_value)]
 
 use super::{Options, Result, SpecifierClass, SpecifierStack, WebsocatConfiguration2};
 use super::specifier::SpecifierNode;
@@ -30,9 +30,9 @@ trait ClassExt {
     fn is_reuser(&self) -> bool;
 }
 
-pub type OnWarning = Box<dyn for<'a> Fn(&'a str) -> () + 'static>;
+pub type OnWarning = Box<dyn for<'a> Fn(&'a str) + 'static>;
 
-#[cfg_attr(rustfmt, rustfmt_skip)]
+#[rustfmt::skip]
 impl ClassExt for Rc<dyn SpecifierClass> {
     fn is_stdio(&self) -> bool {
         [
@@ -159,8 +159,8 @@ impl WebsocatConfiguration2 {
         self.contains_class("InetdClass")
     }
 
-    #[cfg_attr(rustfmt, rustfmt_skip)]
-    #[cfg_attr(feature="cargo-clippy", allow(nonminimal_bool))]
+    #[rustfmt::skip]
+    #[allow(clippy::nonminimal_bool)]
     pub fn websocket_used(&self) -> bool {
         false 
         || self.contains_class("WsConnectClass")
@@ -169,8 +169,8 @@ impl WebsocatConfiguration2 {
         || self.contains_class("WsServerClass")
     }
 
-    #[cfg_attr(rustfmt, rustfmt_skip)]
-    #[cfg_attr(feature="cargo-clippy", allow(nonminimal_bool))]
+    #[rustfmt::skip]
+    #[allow(clippy::nonminimal_bool)]
     pub fn exec_used(&self) -> bool {
         false 
         || self.contains_class("ExecClass")
@@ -540,13 +540,10 @@ impl WebsocatConfiguration2 {
 
     fn l_proto(&mut self, _on_warning: &OnWarning) -> Result<()> {
         if self.opts.websocket_protocol.is_some() {
-            if false
-                || self.contains_class("WsConnectClass")
+            if !(self.contains_class("WsConnectClass")
                 || self.contains_class("WsClientClass")
-                || self.contains_class("WsClientSecureClass")
+                || self.contains_class("WsClientSecureClass"))
             {
-                // OK
-            } else {
                 if self.contains_class("WsServerClass") {
                     _on_warning("--protocol option is unused. Maybe you want --server-protocol?")
                 } else {
@@ -594,10 +591,8 @@ impl WebsocatConfiguration2 {
                     return Err("--udp-multicast-iface-v6 option mush be specified the same number of times as IPv6 addresses for --udp-multicast (alternatively --udp-multicast-iface-* options should be not specified at all)")?;
                 }
             }
-        } else {
-            if self.opts.udp_multicast_loop {
-                return Err("--udp-multicast-loop is not applicable without --udp-multicast")?;
-            }
+        } else  if self.opts.udp_multicast_loop {
+            return Err("--udp-multicast-loop is not applicable without --udp-multicast")?;
         }
         Ok(())
     }
@@ -616,10 +611,8 @@ impl WebsocatConfiguration2 {
             if !self.contains_class("PrometheusClass") {
                 self.s2.overlays.insert(0, SpecifierNode { cls: Rc::new(crate::prometheus_peer::PrometheusClass) });
             }
-        } else {
-            if self.contains_class("PrometheusClass") {
-                _on_warning("Using `prometheus:` overlay without `--prometheus` option is meaningless");
-            }
+        } else if self.contains_class("PrometheusClass") {
+            _on_warning("Using `prometheus:` overlay without `--prometheus` option is meaningless");
         }
         Ok(())
     }
```

---

### Incident Patch 4: `cc94a0a3` (2025-02-27)
**Commit Message**: Merge pull request #283 from chase-qi/build-arm64

ci: build container image for arm64

**File**: `.github/workflows/container-image-buildah.yml` (modified, +69/-5)
```diff
@@ -47,18 +47,38 @@ permissions:
 
 jobs:
   buildah:
-    runs-on: ubuntu-latest
+    strategy:
+      matrix:
+        include:
+          - architecture: amd64
+            runner: ubuntu-latest
+          - architecture: arm64
+            runner: ubuntu-24.04-arm
+    runs-on: ${{ matrix.runner }}
     steps:
       - name: Sanitize Platforms
         id: platforms
         run: |
-          platforms="${{ inputs.platforms == '' && 'linux/amd64' || inputs.platforms }}"
-          archs="$( sed -e 's#linux/##g' <<< $platforms )"
+          platforms="${{ inputs.platforms == '' && 'linux/amd64,linux/arm64' || inputs.platforms }}"
+          if [ "${{ matrix.architecture }}" = "arm64" ]; then
+            platforms="linux/arm64"
+          else
+            platforms="$( sed -e 's#linux/arm64,##g' -e 's#,linux/arm64##g' -e 's#linux/arm64##g' <<< $platforms)"
+            archs="$( sed -e 's#linux/##g' <<< $platforms )"
+            echo "archs=$archs" >> $GITHUB_OUTPUT
+          fi
           echo "platforms=$platforms" >> $GITHUB_OUTPUT
-          echo "archs=$archs" >> $GITHUB_OUTPUT
+
+      - name: Install Podman on ubuntu-24.04-arm
+        if: matrix.architecture == 'arm64'
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y podman
+          echo -e "[registries.search]\nregistries = ['docker.io']" | sudo tee /etc/containers/registries.conf
 
       # Allow multi-target builds
       - name: Set up QEMU
+        if: matrix.architecture == 'amd64'
         uses: docker/setup-qemu-action@v3
         with:
           platforms: ${{ steps.platforms.outputs.archs }}
@@ -77,7 +97,7 @@ jobs:
         id: meta
         uses: docker/metadata-action@v5
         with:
-          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
+          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.architecture }}
           tags: |
             type=schedule
             type=raw,value=latest,enable=${{ github.ref_name == 'master' }}
@@ -152,3 +172,47 @@ jobs:
 
       - name: Print image url
         run: echo "Image pushed to ${{ steps.push-to-container-registry.outputs.registry-paths }}"
+
+  merge-archs:
+    runs-on: ubuntu-latest
+    needs: buildah
+    steps:
+      - name: Log into registry ${{ env.REGISTRY }}
+        if: github.event_name != 'pull_request'
+        uses: redhat-actions/podman-login@v1
+        with:
+          registry: ${{ env.REGISTRY }}
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+
+      - name: Docker meta
+        id: meta
+        uses: docker/metadata-action@v5
+        with:
+          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
+          tags: |
+            type=schedule
+            type=raw,value=latest,enable=${{ github.ref_name == 'master' }}
+            ${{ github.ref_name == 'master' && 'type=raw,value=nightly' }}
+            type=ref,event=branch,enable=${{ github.ref_name != 'master' && inputs.custom_tag == '' }}
+            ${{ inputs.custom_tag }}
+            type=ref,event=tag
+            type=ref,event=pr
+
+      - name: Create and push manifest
+        run: |
+          set -x
+
+          img="${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}"
+          podman manifest create $img
+
+          archs="amd64 arm64"
+          for arch in $archs; do
+            podman manifest add $img "${img}-${arch}:latest"
+          done
+
+          tags="${{ steps.meta.outputs.tags }}"
+          for tag in $tags; do
+            podman tag $img $tag
+            podman manifest push --all $tag
+          done
```

---

### Incident Patch 5: `bd2b03c3` (2025-02-12)
**Commit Message**: ci: build container image for arm64

Signed-off-by: Chase Qi <[REDACTED_EMAIL]>

**File**: `.github/workflows/container-image-buildah.yml` (modified, +69/-5)
```diff
@@ -47,18 +47,38 @@ permissions:
 
 jobs:
   buildah:
-    runs-on: ubuntu-latest
+    strategy:
+      matrix:
+        include:
+          - architecture: amd64
+            runner: ubuntu-latest
+          - architecture: arm64
+            runner: ubuntu-24.04-arm
+    runs-on: ${{ matrix.runner }}
     steps:
       - name: Sanitize Platforms
         id: platforms
         run: |
-          platforms="${{ inputs.platforms == '' && 'linux/amd64' || inputs.platforms }}"
-          archs="$( sed -e 's#linux/##g' <<< $platforms )"
+          platforms="${{ inputs.platforms == '' && 'linux/amd64,linux/arm64' || inputs.platforms }}"
+          if [ "${{ matrix.architecture }}" = "arm64" ]; then
+            platforms="linux/arm64"
+          else
+            platforms="$( sed -e 's#linux/arm64,##g' -e 's#,linux/arm64##g' -e 's#linux/arm64##g' <<< $platforms)"
+            archs="$( sed -e 's#linux/##g' <<< $platforms )"
+            echo "archs=$archs" >> $GITHUB_OUTPUT
+          fi
           echo "platforms=$platforms" >> $GITHUB_OUTPUT
-          echo "archs=$archs" >> $GITHUB_OUTPUT
+
+      - name: Install Podman on ubuntu-24.04-arm
+        if: matrix.architecture == 'arm64'
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y podman
+          echo -e "[registries.search]\nregistries = ['docker.io']" | sudo tee /etc/containers/registries.conf
 
       # Allow multi-target builds
       - name: Set up QEMU
+        if: matrix.architecture == 'amd64'
         uses: docker/setup-qemu-action@v3
         with:
           platforms: ${{ steps.platforms.outputs.archs }}
@@ -77,7 +97,7 @@ jobs:
         id: meta
         uses: docker/metadata-action@v5
         with:
-          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
+          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.architecture }}
           tags: |
             type=schedule
             type=raw,value=latest,enable=${{ github.ref_name == 'master' }}
@@ -152,3 +172,47 @@ jobs:
 
       - name: Print image url
         run: echo "Image pushed to ${{ steps.push-to-container-registry.outputs.registry-paths }}"
+
+  merge-archs:
+    runs-on: ubuntu-latest
+    needs: buildah
+    steps:
+      - name: Log into registry ${{ env.REGISTRY }}
+        if: github.event_name != 'pull_request'
+        uses: redhat-actions/podman-login@v1
+        with:
+          registry: ${{ env.REGISTRY }}
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+
+      - name: Docker meta
+        id: meta
+        uses: docker/metadata-action@v5
+        with:
+          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
+          tags: |
+            type=schedule
+            type=raw,value=latest,enable=${{ github.ref_name == 'master' }}
+            ${{ github.ref_name == 'master' && 'type=raw,value=nightly' }}
+            type=ref,event=branch,enable=${{ github.ref_name != 'master' && inputs.custom_tag == '' }}
+            ${{ inputs.custom_tag }}
+            type=ref,event=tag
+            type=ref,event=pr
+
+      - name: Create and push manifest
+        run: |
+          set -x
+
+          img="${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}"
+          podman manifest create $img
+
+          archs="amd64 arm64"
+          for arch in $archs; do
+            podman manifest add $img "${img}-${arch}:latest"
+          done
+
+          tags="${{ steps.meta.outputs.tags }}"
+          for tag in $tags; do
+            podman tag $img $tag
+            podman manifest push --all $tag
+          done
```

---

### Incident Patch 6: `025ade09` (2024-11-11)
**Commit Message**: Revert attempt to provide CI-built aarch64

**File**: `.github/workflows/container-image-buildah.yml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ jobs:
       - name: Sanitize Platforms
         id: platforms
         run: |
-          platforms="${{ inputs.platforms == '' && 'linux/amd64,linux/arm64' || inputs.platforms }}"
+          platforms="${{ inputs.platforms == '' && 'linux/amd64' || inputs.platforms }}"
           archs="$( sed -e 's#linux/##g' <<< $platforms )"
           echo "platforms=$platforms" >> $GITHUB_OUTPUT
           echo "archs=$archs" >> $GITHUB_OUTPUT
```

**File**: `Dockerfile` (modified, +5/-10)
```diff
@@ -1,15 +1,13 @@
 # Build stage
-FROM rust:1.72.1-bookworm AS cargo-build
+FROM rust:1.72-alpine3.18 AS cargo-build
 
-RUN apt-get update
-RUN apt-get install -y libgcc-12-dev libc6-dev pkg-config libssl-dev
+RUN apk add --no-cache musl-dev pkgconfig openssl-dev
 
 WORKDIR /src/websocat
 ENV RUSTFLAGS='-Ctarget-feature=-crt-static'
 
 COPY Cargo.toml Cargo.toml
-# ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
-ARG CARGO_OPTS="--features=ssl,workaround1,seqpacket,unix_stdio,prometheus_peer,prometheus/process,crypto_peer"
+ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
 
 RUN mkdir src/ &&\
     echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
@@ -21,12 +19,9 @@ RUN cargo build --release $CARGO_OPTS && \
     strip target/release/websocat
 
 # Final stage
-FROM debian:bookworm
+FROM alpine:3.18
 
-RUN apt-get update
-RUN apt-get install -y libssl3
-RUN apt-get clean && \
-    rm -rf /var/lib/apt/lists/*
+RUN apk add --no-cache libgcc
 
 WORKDIR /
 COPY --from=cargo-build /src/websocat/target/release/websocat /usr/local/bin/
```

**File**: `Dockerfile.debian` (renamed, +10/-5)
```diff
@@ -1,13 +1,15 @@
 # Build stage
-FROM rust:1.72-alpine3.18 AS cargo-build
+FROM rust:1.72.1-bookworm AS cargo-build
 
-RUN apk add --no-cache musl-dev pkgconfig openssl-dev
+RUN apt-get update
+RUN apt-get install -y libgcc-12-dev libc6-dev pkg-config libssl-dev
 
 WORKDIR /src/websocat
 ENV RUSTFLAGS='-Ctarget-feature=-crt-static'
 
 COPY Cargo.toml Cargo.toml
-ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
+# ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
+ARG CARGO_OPTS="--features=ssl,workaround1,seqpacket,unix_stdio,prometheus_peer,prometheus/process,crypto_peer"
 
 RUN mkdir src/ &&\
     echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
@@ -19,9 +21,12 @@ RUN cargo build --release $CARGO_OPTS && \
     strip target/release/websocat
 
 # Final stage
-FROM alpine:3.18
+FROM debian:bookworm
 
-RUN apk add --no-cache libgcc
+RUN apt-get update
+RUN apt-get install -y libssl3
+RUN apt-get clean && \
+    rm -rf /var/lib/apt/lists/*
 
 WORKDIR /
 COPY --from=cargo-build /src/websocat/target/release/websocat /usr/local/bin/
```

---

### Incident Patch 7: `1af4bd8f` (2024-11-04)
**Commit Message**: try a debian arm build

**File**: `.github/workflows/container-image-buildah.yml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ jobs:
       - name: Sanitize Platforms
         id: platforms
         run: |
-          platforms="${{ inputs.platforms == '' && 'linux/amd64' || inputs.platforms }}"
+          platforms="${{ inputs.platforms == '' && 'linux/amd64,linux/arm64' || inputs.platforms }}"
           archs="$( sed -e 's#linux/##g' <<< $platforms )"
           echo "platforms=$platforms" >> $GITHUB_OUTPUT
           echo "archs=$archs" >> $GITHUB_OUTPUT
```

**File**: `Dockerfile` (modified, +10/-5)
```diff
@@ -1,13 +1,15 @@
 # Build stage
-FROM rust:1.72-alpine3.18 AS cargo-build
+FROM rust:1.72.1-bookworm AS cargo-build
 
-RUN apk add --no-cache musl-dev pkgconfig openssl-dev
+RUN apt-get update
+RUN apt-get install -y libgcc-12-dev libc6-dev pkg-config libssl-dev
 
 WORKDIR /src/websocat
 ENV RUSTFLAGS='-Ctarget-feature=-crt-static'
 
 COPY Cargo.toml Cargo.toml
-ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
+# ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
+ARG CARGO_OPTS="--features=ssl,workaround1,seqpacket,unix_stdio,prometheus_peer,prometheus/process,crypto_peer"
 
 RUN mkdir src/ &&\
     echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
@@ -19,9 +21,12 @@ RUN cargo build --release $CARGO_OPTS && \
     strip target/release/websocat
 
 # Final stage
-FROM alpine:3.18
+FROM debian:bookworm
 
-RUN apk add --no-cache libgcc
+RUN apt-get update
+RUN apt-get install -y libssl3
+RUN apt-get clean && \
+    rm -rf /var/lib/apt/lists/*
 
 WORKDIR /
 COPY --from=cargo-build /src/websocat/target/release/websocat /usr/local/bin/
```

---

### Incident Patch 8: `93a2f5b9` (2024-10-31)
**Commit Message**: arm64 builds timeout

**File**: `.github/workflows/container-image-buildah.yml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ on:
   workflow_dispatch:
     inputs:
       platforms:
-        description: "comma-separated list of platforms to build for, e.g. linux/amd64,linux/s390x,linux/ppc64le,linux/riscv64 (leave empty for defaults)"
+        description: "comma-separated list of platforms to build for, e.g. linux/amd64,linux/arm64,linux/s390x,linux/ppc64le,linux/riscv64 (leave empty for defaults)"
         default: ''
       custom_tag:
         description: optional custom tag on remote repo you want image to be tagged with
@@ -52,7 +52,7 @@ jobs:
       - name: Sanitize Platforms
         id: platforms
         run: |
-          platforms="${{ inputs.platforms == '' && 'linux/amd64,linux/arm64' || inputs.platforms }}"
+          platforms="${{ inputs.platforms == '' && 'linux/amd64' || inputs.platforms }}"
           archs="$( sed -e 's#linux/##g' <<< $platforms )"
           echo "platforms=$platforms" >> $GITHUB_OUTPUT
           echo "archs=$archs" >> $GITHUB_OUTPUT
```

---

### Incident Patch 9: `34ddb4d1` (2024-06-20)
**Commit Message**: Attempt to disable excessive Github Actions builds

The built typically fails because of timeout
and I don't know why.

And most Dependabot pull requests are unsatisfiable anyway
(at least until websocat4 goes mainline).

**File**: `.github/workflows/container-image-buildah.yml` (modified, +5/-5)
```diff
@@ -19,15 +19,15 @@ on:
         required: false
         default: ''
         type: string
-  schedule:
-    # every Wednesday morning
-    - cron: 7 7 * * 3
+  #schedule:
+  #  # every Wednesday morning
+  #  - cron: 7 7 * * 3
   push:
     branches: [ master ]
     tags:
       - '*'           # Push events to every tag not containing /
-  pull_request:
-    types: [opened, reopened, synchronize]
+  #pull_request:
+  #  types: [opened, reopened, synchronize]
 
 concurrency:
   group: ci-container-build-${{ github.ref }}-1
```

---

### Incident Patch 10: `87e7b99d` (2024-04-01)
**Commit Message**: multi-platform tested build

**File**: `.github/dependabot.yml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+# see https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
+
+version: 2
+updates:
+
+  # Maintain dependencies for GitHub Actions
+  - package-ecosystem: "github-actions"
+    directory: "/"
+    schedule:
+      interval: "weekly"
+      day: friday
+
+  # Maintain dependencies for Bundler
+  - package-ecosystem: "cargo"
+    directory: "/"
+    schedule:
+      interval: "weekly"
+      day: wednesday
```

**File**: `.github/workflows/container-image-buildah.yml` (modified, +59/-5)
```diff
@@ -1,8 +1,24 @@
 name: Container Image
 
 on:
-  workflow_dispatch: {}
-  workflow_call: {}
+  workflow_dispatch:
+    inputs:
+      platforms:
+        description: "comma-separated list of platforms to build for, e.g. linux/amd64,linux/s390x,linux/ppc64le,linux/riscv64 (leave empty for defaults)"
+        default: ''
+      custom_tag:
+        description: optional custom tag on remote repo you want image to be tagged with
+        default: scratch
+  workflow_call:
+    inputs:
+      platforms:
+        required: false
+        default: ''
+        type: string
+      custom_tag:
+        required: false
+        default: ''
+        type: string
   schedule:
     # every Wednesday morning
     - cron: 7 7 * * 3
@@ -33,11 +49,19 @@ jobs:
   buildah:
     runs-on: ubuntu-latest
     steps:
+      - name: Sanitize Platforms
+        id: platforms
+        run: |
+          platforms="${{ inputs.platforms == '' && 'linux/amd64,linux/arm64' || inputs.platforms }}"
+          archs="$( sed -e 's#linux/##g' <<< $platforms )"
+          echo "platforms=$platforms" >> $GITHUB_OUTPUT
+          echo "archs=$archs" >> $GITHUB_OUTPUT
+
       # Allow multi-target builds
       - name: Set up QEMU
         uses: docker/setup-qemu-action@v2
         with:
-          platforms: arm64
+          platforms: ${{ steps.platforms.outputs.archs }}
       # Login against a Docker registry except on PR
       # https://github.com/docker/login-action
       - name: Log into registry ${{ env.REGISTRY }}
@@ -57,7 +81,9 @@ jobs:
           tags: |
             type=schedule
             type=raw,value=latest,enable=${{ github.ref_name == 'master' }}
-            ${{ github.ref_name == 'master' && 'type=raw,value=nightly' || 'type=ref,event=branch' }}
+            ${{ github.ref_name == 'master' && 'type=raw,value=nightly' }}
+            type=ref,event=branch,enable=${{ github.ref_name != 'master' && inputs.custom_tag == '' }}
+            ${{ inputs.custom_tag }}
             type=ref,event=tag
             type=ref,event=pr
 
@@ -69,7 +95,7 @@ jobs:
         uses: redhat-actions/buildah-build@v2
         with:
           tags: ${{ steps.meta.outputs.tags }}
-          platforms: linux/amd64
+          platforms: ${{ steps.platforms.outputs.platforms }}
           labels: ${{ steps.meta.outputs.labels }}
           layers: false
           oci: true
@@ -89,6 +115,34 @@ jobs:
       - name: Check images created
         run: buildah images
 
+      - name: Smoke test the images
+        run: |
+          set -ex
+          # accessing a mapped port from a container did not work so lets
+          # create a pod where both - server and client have same localhost
+          podman pod create > podid
+          platforms="${{ steps.platforms.outputs.platforms }}"
+
+          test_tag () {
+            podman run -d --pod-id-file=podid --name=listener -u 14:0 "${{ steps.build-image.outputs.image-with-tag }}$1" -s 0.0.0.0:1234
+            sleep 3
+            podman logs listener
+            podman run --pod-id-file=podid --rm -i "${{ steps.build-image.outputs.image-with-tag }}$1" ws://127.0.0.1:1234/ <<< "Test Message $1"
+            echo Expecting "\"Test Message $1\"" in listener log..
+            podman logs listener | tee /dev/stderr | grep -q "Test Message $1"
+            podman rm -f listener
+          }
+
+          if [ x$( sed -E -e 's#[^/]##g' <<< $platforms ) != "x/" ]; then
+            # if we are here, user has selected more than one build platform
+            arch_tags=$( tr ',' ' ' <<< $platforms | tr -d '/' )
+            # removed slashes to produce "linuxamd64 linuxs390x linuxppc64le"
+            for tag in $arch_tags; do test_tag -$tag; done
+          else
+            # if we are here, user has selected a single build platform
+            test_tag
+          fi
+
       - name: Push To Container Registry
         id: push-to-container-registry
         uses: redhat-actions/push-to-registry@v2
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 Netcat, curl and socat for [WebSockets](https://en.wikipedia.org/wiki/WebSocket).
 
 [![Gitter](https://badges.gitter.im/websocat.svg)](https://gitter.im/websocat/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=body_badge)
+[![image-build](https://github.com/vi/websocat/actions/workflows/container-image-buildah.yml/badge.svg)](https://github.com/vi/websocat/pkgs/container/websocat)
 
 ## Examples
 
```

---

### Incident Patch 11: `84834f7b` (2024-03-31)
**Commit Message**: --lengthprefixed-skip-read-direction, --lengthprefixed-skip-write-direction

**File**: `src/lengthprefixed_peer.rs` (modified, +10/-1)
```diff
@@ -22,6 +22,8 @@ impl<T: Specifier> Specifier for LengthPrefixed<T> {
                 p,
                 cp.program_options.lengthprefixed_header_bytes,
                 cp.program_options.lengthprefixed_little_endian,
+                cp.program_options.lengthprefixed_skip_read_direction,
+                cp.program_options.lengthprefixed_skip_write_direction,
             )
         })
     }
@@ -63,6 +65,8 @@ pub fn lengthprefixed_peer(
     inner_peer: Peer,
     num_bytes_in_length_prefix: usize,
     little_endian: bool,
+    lengthprefixed_skip_read_direction: bool,
+    lengthprefixed_skip_write_direction: bool,
 ) -> BoxedNewPeerFuture {
     if num_bytes_in_length_prefix < 1 || num_bytes_in_length_prefix > 8 {
         return peer_strerr("Number of header bytes for lengthprefixed overlay should be from 1 to 8");
@@ -91,7 +95,12 @@ pub fn lengthprefixed_peer(
         little_endian,
         data_written_so_far: 0,
     };
-    let thepeer = Peer::new(reader, writer, inner_peer.2);
+    let thepeer = match (lengthprefixed_skip_read_direction, lengthprefixed_skip_write_direction) {
+        (true, true)   => Peer::new(reader.inner, writer.inner, inner_peer.2),
+        (true, false)  => Peer::new(reader.inner, writer,       inner_peer.2),
+        (false, true)  => Peer::new(reader,       writer.inner, inner_peer.2),
+        (false, false) => Peer::new(reader,       writer,       inner_peer.2),
+    };
     Box::new(ok(thepeer)) as BoxedNewPeerFuture
 }
 struct Lengthprefixed2PacketWrapper {
```

**File**: `src/main.rs` (modified, +10/-0)
```diff
@@ -664,6 +664,14 @@ struct Opt {
     /// [A] Use little-endian framing headers instead of big-endian for `lengthprefixed:` overlay.
     #[structopt(long = "--lengthprefixed-little-endian")]
     pub lengthprefixed_little_endian: bool,
+
+    /// [A] Only affect one direction of the `lengthprefixed:` overlay, bypass tranformation for the other one.
+    #[structopt(long = "--lengthprefixed-skip-read-direction")]
+    pub lengthprefixed_skip_read_direction: bool,
+
+    /// [A] Only affect one direction of the `lengthprefixed:` overlay, bypass tranformation for the other one.
+    #[structopt(long = "--lengthprefixed-skip-write-direction")]
+    pub lengthprefixed_skip_write_direction: bool,
 }
 
 // TODO: make it byte-oriented/OsStr?
@@ -951,6 +959,8 @@ fn run() -> Result<()> {
             max_sent_pings
             lengthprefixed_header_bytes
             lengthprefixed_little_endian
+            lengthprefixed_skip_read_direction
+            lengthprefixed_skip_write_direction
         );
         #[cfg(feature = "ssl")]
         {
```

**File**: `src/options.rs` (modified, +3/-0)
```diff
@@ -155,4 +155,7 @@ pub struct Options {
 
     pub lengthprefixed_header_bytes: usize,
     pub lengthprefixed_little_endian: bool,
+    pub lengthprefixed_skip_read_direction: bool,
+    pub lengthprefixed_skip_write_direction: bool,
+
 }
```

---

### Incident Patch 12: `250d5df5` (2023-10-22)
**Commit Message**: lengthprefixed:

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 
 * `waitfordata:` overlay to delay connection initiation until first data is attempted to be written to it
 * Dockerfile updates
+* `lengthprefixed:` overlay - alternative to base64 mode
 
 <a name="v1.12.0"></a>
 # [Maintainance release (v1.12.0)](https://github.com/vi/websocat/releases/tag/v1.12.0) - 17 Sep 2023
```

**File**: `src/all_peers.rs` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ macro_rules! list_of_all_specifier_classes {
 
         $your_macro!($crate::line_peer::Message2LineClass);
         $your_macro!($crate::line_peer::Line2MessageClass);
+        $your_macro!($crate::lengthprefixed_peer::LengthPrefixedClass);
         $your_macro!($crate::foreachmsg_peer::ForeachmsgClass);
         $your_macro!($crate::mirror_peer::MirrorClass);
         $your_macro!($crate::mirror_peer::LiteralReplyClass);
```

**File**: `src/lengthprefixed_peer.rs` (added, +223/-0)
```diff
@@ -0,0 +1,223 @@
+use futures::future::ok;
+
+use std::rc::Rc;
+
+use crate::{io_other_error, simple_err, peer_strerr};
+
+use super::{BoxedNewPeerFuture, Peer};
+use super::{ConstructParams, PeerConstructor, Specifier};
+
+use std::io::{Read, Write};
+use tokio_io::{AsyncRead, AsyncWrite};
+
+use std::io::Error as IoError;
+
+#[derive(Debug)]
+pub struct LengthPrefixed<T: Specifier>(pub T);
+impl<T: Specifier> Specifier for LengthPrefixed<T> {
+    fn construct(&self, cp: ConstructParams) -> PeerConstructor {
+        let inner = self.0.construct(cp.clone());
+        inner.map(move |p, _| {
+            lengthprefixed_peer(
+                p,
+                cp.program_options.lengthprefixed_header_bytes,
+                cp.program_options.lengthprefixed_little_endian,
+            )
+        })
+    }
+    specifier_boilerplate!(noglobalstate has_subspec);
+    self_0_is_subspecifier!(proxy_is_multiconnect);
+}
+specifier_class!(
+    name = LengthPrefixedClass,
+    target = LengthPrefixed,
+    prefixes = ["lengthprefixed:"],
+    arg_handling = subspec,
+    overlay = true,
+    MessageOriented,
+    MulticonnectnessDependsOnInnerType,
+    help = r#"
+Turn stream of bytes to/from data packets with length-prefixed framing.  [A]
+
+You can choose the number of header bytes (1 to 8) and endianness. Default is 4 bytes big endian.
+
+This affects both reading and writing - attach this overlay to stream specifier to turn it into a packet-orineted specifier.
+
+Mind the buffer size (-B). All packets should fit in there.
+
+Examples:
+
+    websocat -u -b udp-l:127.0.0.1:1234 lengthprefixed:writefile:test.dat
+
+    websocat -u -b lengthprefixed:readfile:test.dat udp:127.0.0.1:1235
+
+This would save incoming UDP packets to a file, then replay the datagrams back to UDP socket
+
+    websocat -b lengthprefixed:- ws://127.0.0.1:1234/ --binary-prefix=B --text-prefix=T
+
+This allows to mix and match text and binary WebSocket messages to and from stdio without the base64 overhead.
+"#
+);
+
+pub fn lengthprefixed_peer(
+    inner_peer: Peer,
+    num_bytes_in_length_prefix: usize,
+    little_endian: bool,
+) -> BoxedNewPeerFuture {
+    if num_bytes_in_length_prefix < 1 || num_bytes_in_length_prefix > 8 {
+        return peer_strerr("Number of header bytes for lengthprefixed overlay should be from 1 to 8");
+    }
+
+    let (length_starting_pos, length_ending_pos) = if little_endian {
+        (0, num_bytes_in_length_prefix)
+    } else {
+        (8 - num_bytes_in_length_prefix, 8)
+    };
+    let reader = Lengthprefixed2PacketWrapper {
+        inner: inner_peer.0,
+        length_buffer: [0; 8],
+        length_starting_pos,
+        length_pos: length_starting_pos,
+        length_ending_pos: length_ending_pos,
+        little_endian,
+        data_read_so_far: 0,
+    };
+    let writer = Packet2LengthPrefixedWrapper {
+        inner: inner_peer.1,
+        length_buffer: [0; 8],
+        length_starting_pos,
+        length_pos: length_starting_pos,
+        length_ending_pos: length_ending_pos,
+        little_endian,
+        data_written_so_far: 0,
+    };
+    let thepeer = Peer::new(reader, writer, inner_peer.2);
+    Box::new(ok(thepeer)) as BoxedNewPeerFuture
+}
+struct Lengthprefixed2PacketWrapper {
+    inner: Box<dyn AsyncRead>,
+    length_buffer: [u8; 8],
+    length_starting_pos: usize,
+    length_ending_pos: usize,
+    length_pos: usize,
+    little_endian: bool,
+    data_read_so_far: usize,
+}
+impl Read for Lengthprefixed2PacketWrapper {
+    fn read(&mut self, buf: &mut [u8]) -> Result<usize, IoError> {
+        loop {
+            assert!(self.length_pos <= self.length_ending_pos);
+            assert!(self.length_pos >= self.length_starting_pos);
+            if self.length_ending_pos != self.length_pos {
+                match self
+                    .inner
+                    .read(&mut self.length_buffer[self.length_pos..self.length_ending_pos])
+                {
+                    Err(e) => return Err(e),
+                    Ok(0) => {
+                        if self.length_pos != self.length_starting_pos {
+                            error!("Possibly trimmed length-prefixed data.")
+                        }
+                        return Ok(0);
+                    }
+                    Ok(n) => {
+                        self.length_pos += n;
+                        continue;
+                    }
+                }
+            } else {
+                let packet_len = if self.little_endian {
+                    u64::from_le_bytes(self.length_buffer)
+                } else {
+                    u64::from_be_bytes(self.length_buffer)
+                };
+                if packet_len >= (buf.len() as u64) {
+                    error!("Failed to process too big packet. You may need to increase the -B buffer size.");
+                    return Err(io_other_error(simple_err("Packet length overflow".into())));
+                }
+                let packet
```

**File**: `src/lib.rs` (modified, +1/-0)
```diff
@@ -192,6 +192,7 @@ pub mod broadcast_reuse_peer;
 pub mod jsonrpc_peer;
 pub mod timestamp_peer;
 pub mod line_peer;
+pub mod lengthprefixed_peer;
 pub mod foreachmsg_peer;
 pub mod primitive_reuse_peer;
 pub mod reconnect_peer;
```

**File**: `src/main.rs` (modified, +10/-0)
```diff
@@ -656,6 +656,14 @@ struct Opt {
     /// [A] Stop sending pings after this number of sent pings
     #[structopt(long = "max-sent-pings")]
     pub max_sent_pings: Option<usize>,
+
+    /// [A] Use this number of length header bytes for `lengthprefixed:` overlay.
+    #[structopt(long = "--lengthprefixed-nbytes", default_value = "4")]
+    pub lengthprefixed_header_bytes: usize,
+
+    /// [A] Use little-endian framing headers instead of big-endian for `lengthprefixed:` overlay.
+    #[structopt(long = "--lengthprefixed-little-endian")]
+    pub lengthprefixed_little_endian: bool,
 }
 
 // TODO: make it byte-oriented/OsStr?
@@ -941,6 +949,8 @@ fn run() -> Result<()> {
             jsonrpc_omit_jsonrpc
             inhibit_pongs
             max_sent_pings
+            lengthprefixed_header_bytes
+            lengthprefixed_little_endian
         );
         #[cfg(feature = "ssl")]
         {
```

**File**: `src/options.rs` (modified, +3/-0)
```diff
@@ -152,4 +152,7 @@ pub struct Options {
     pub jsonrpc_omit_jsonrpc: bool,
     pub inhibit_pongs: Option<usize>,
     pub max_sent_pings: Option<usize>,
+
+    pub lengthprefixed_header_bytes: usize,
+    pub lengthprefixed_little_endian: bool,
 }
```

---

### Incident Patch 13: `17bb292a` (2023-07-07)
**Commit Message**: workflow to build container images

**File**: `.github/workflows/container-image-buildah.yml` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+name: Container Image
+
+on:
+  workflow_dispatch: {}
+  workflow_call: {}
+  schedule:
+    # every Wednesday morning
+    - cron: 7 7 * * 3
+  push:
+    branches: [ master ]
+    tags:
+      - '*'           # Push events to every tag not containing /
+  pull_request:
+    types: [opened, reopened, synchronize]
+
+concurrency:
+  group: ci-container-build-${{ github.ref }}-1
+  cancel-in-progress: true
+
+env:
+  # Use docker.io for Docker Hub if empty
+  REGISTRY: ghcr.io
+  # github.repository as <account>/<repo>
+  IMAGE_NAME: ${{ github.repository }}
+
+# Sets permissions of the GITHUB_TOKEN to allow deployment to ghcr.io
+permissions:
+  contents: read
+  packages: write
+  id-token: write
+
+jobs:
+  buildah:
+    runs-on: ubuntu-latest
+    steps:
+      # Allow multi-target builds
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v2
+        with:
+          platforms: arm64
+      # Login against a Docker registry except on PR
+      # https://github.com/docker/login-action
+      - name: Log into registry ${{ env.REGISTRY }}
+        if: github.event_name != 'pull_request'
+        uses: redhat-actions/podman-login@v1
+        with:
+          registry: ${{ env.REGISTRY }}
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+      # Extract metadata (tags, labels) for Docker
+      # https://github.com/docker/metadata-action
+      - name: Docker meta
+        id: meta
+        uses: docker/metadata-action@v4
+        with:
+          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
+          tags: |
+            type=schedule
+            type=raw,value=latest,enable=${{ github.ref_name == 'master' }}
+            ${{ github.ref_name == 'master' && 'type=raw,value=nightly' || 'type=ref,event=branch' }}
+            type=ref,event=tag
+            type=ref,event=pr
+
+      # https://github.com/actions/checkout
+      - uses: actions/checkout@v3
+
+      - name: Build image
+        id: build-image
+        uses: redhat-actions/buildah-build@v2
+        with:
+          tags: ${{ steps.meta.outputs.tags }}
+          platforms: linux/amd64,linux/arm64
+          labels: ${{ steps.meta.outputs.labels }}
+          layers: false
+          oci: true
+          tls-verify: true
+          extra-args: |
+            --squash
+            --jobs=3
+          containerfiles: |
+            Dockerfile
+
+      - name: Echo Outputs
+        run: |
+          echo "Image: ${{ steps.build-image.outputs.image }}"
+          echo "Tags: ${{ steps.build-image.outputs.tags }}"
+          echo "Tagged Image: ${{ steps.build-image.outputs.image-with-tag }}"
+
+      - name: Check images created
+        run: buildah images
+
+      - name: Push To Container Registry
+        id: push-to-container-registry
+        uses: redhat-actions/push-to-registry@v2
+        if: github.event_name != 'pull_request'
+        with:
+          tags: ${{ steps.build-image.outputs.tags }}
+
+      - name: Print image url
+        run: echo "Image pushed to ${{ steps.push-to-container-registry.outputs.registry-paths }}"
```

---

### Incident Patch 14: `dc0e921a` (2023-09-17)
**Commit Message**: Update and fix Dockerfile

**File**: `.dockerignore` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+target
```

**File**: `Dockerfile` (modified, +10/-7)
```diff
@@ -1,26 +1,29 @@
 # Build stage
-FROM rust:1.60-alpine3.15 as cargo-build
+FROM rust:1.72-alpine3.18 as cargo-build
 
 RUN apk add --no-cache musl-dev pkgconfig openssl-dev
 
 WORKDIR /src/websocat
+ENV RUSTFLAGS='-Ctarget-feature=-crt-static'
 
 COPY Cargo.toml Cargo.toml
 ARG CARGO_OPTS="--features=workaround1,seqpacket,prometheus_peer,prometheus/process,crypto_peer"
 
 RUN mkdir src/ &&\
     echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
-    cargo build --release --target=x86_64-unknown-linux-musl $CARGO_OPTS && \
-    rm -f target/x86_64-unknown-linux-musl/release/deps/websocat*
+    cargo build --release $CARGO_OPTS && \
+    rm -f target/release/deps/websocat*
 
 COPY src src
-RUN cargo build --release --target=x86_64-unknown-linux-musl $CARGO_OPTS && \
-    strip target/x86_64-unknown-linux-musl/release/websocat
+RUN cargo build --release $CARGO_OPTS && \
+    strip target/release/websocat
 
 # Final stage
-FROM alpine:3.15
+FROM alpine:3.18
+
+RUN apk add --no-cache libgcc
 
 WORKDIR /
-COPY --from=cargo-build /src/websocat/target/x86_64-unknown-linux-musl/release/websocat /usr/local/bin
+COPY --from=cargo-build /src/websocat/target/release/websocat /usr/local/bin/
 
 ENTRYPOINT ["/usr/local/bin/websocat"]
```

---

### Incident Patch 15: `734cc58e` (2023-08-30)
**Commit Message**: Fix reversed logic on --exec-exit-on-disconnect

**File**: `src/process_peer.rs` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ impl AsyncWrite for ProcessPeer {
 impl Drop for ForgetfulProcess {
     fn drop(&mut self) {
         let mut chld = self.chld.take().unwrap();
-        if ! self.exit_on_disconnect {
+        if self.exit_on_disconnect {
             debug!("Forcing child process to exit");
             match chld.kill() {
                 Ok(()) => (),
```

#### Recent Merged Pull Requests:
- **PR #310** (2026-07-22): Handle canceled pinger in ws_peer.rs (@zobo)
- **PR #309** (closed): Add writefile_ts:, readfile_ts:, and readfile_ts_loop: specifiers (@eriang)
- **PR #307** (closed): Support SSLKEYLOGFILE for TLS session key logging (@uglykitty)
- **PR #306** (closed): Support SSLKEYLOGFILE for TLS session key logging (@uglykitty)
- **PR #298** (2025-07-24): Log response headers (@jacob-pro)
- **PR #294** (2025-05-25): docs: Add Bindings and initially link to related Node.js project to README (@vorburger)
- **PR #291** (2025-05-08): Add ci and fix clippy warnings (@kuznetsss)
- **PR #285** (2025-03-05): Bump rust version to 1.80.1 (@chase-qi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
