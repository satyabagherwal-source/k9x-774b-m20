# Forensic Learning Record (Deep Inspection): smol-rs/smol

> **Canonical Artifact**: `07_PROJECT_LEARNING/smol-rs-smol-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/smol-rs/smol](https://github.com/smol-rs/smol))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:36:31.985Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `smol-rs/smol`
- **Description**: A small and fast async runtime for Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5079 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/async-h1-client.rs`
```
//! An HTTP+TLS client based on `async-h1` and `async-native-tls`.
//!
//! Run with:
//!
//! ```
//! cargo run --example async-h1-client
//! ```

use std::net::{TcpStream, ToSocketAddrs};

use anyhow::{bail, Context as _, Error, Result};
use http_types::{Method, Request, Response};
use smol::{prelude::*, Async};
use url::Url;

/// Sends a request and fetches the response.
async fn fetch(req: Request) -> Result<Response> {
    // Figure out the host and the port.
    let host = req.url().host().context("cannot parse host")?.to_string();
    let port = req
        .url()
        .port_or_known_default()
        .context("cannot guess port")?;

    // Connect to the host.
    let socket_addr = {
        let host = host.clone();
        smol::unblock(move || (host.as_str(), port).to_socket_addrs())
            .await?
            .next()
            .context("cannot resolve address")?
    };
    let stream = Async::<TcpStream>::connect(socket_addr).await?;

    // Send the request and wait for the response.
    let resp = match req.url().scheme() {
        "http" => async_h1::connect(stream, req).await.map_err(Error::msg)?,
        "https" => {
            // In case of HTTPS, establish a secure TLS connection first.
            let stream = async_native_tls::connect(&host, stream).await?;
            async_h1::connect(stream, req).await.map_err(Error::msg)?
        }
        scheme => bail!("unsupported scheme: {}", scheme),
    };
    Ok(resp)
}

fn main() -> Result<()> {
    smol::block_on(async {
        // Create a request.
        let addr = "https://www.rust-lang.org";
        let req = Request::new(Method::Get, Url::parse(addr)?);

        // Fetch the response.
        let mut resp = fetch(req).await?;
        println!("{:#?}", resp);

        // Read the message body.
        let mut body = Vec::new();
        resp.read_to_end(&mut body).await?;
        println!("{}", String::from_utf8_lossy(&body));

        Ok(())
    })
}

```

### Core Architecture Module: `examples/async-h1-server.rs`
```
//! An HTTP+TLS server based on `async-h1` and `async-native-tls`.
//!
//! Run with:
//!
//! ```
//! cargo run --example async-h1-server
//! ```
//!
//! Open in the browser any of these addresses:
//!
//! - http://localhost:8000/
//! - https://localhost:8001/ (accept the security prompt in the browser)
//!
//! Refer to `README.md` to see how the TLS certificate was generated.

use std::net::TcpListener;

use anyhow::Result;
use async_native_tls::{Identity, TlsAcceptor};
use http_types::{Request, Response, StatusCode};
use smol::{future, Async};

/// Serves a request and returns a response.
async fn serve(req: Request) -> http_types::Result<Response> {
    println!("Serving {}", req.url());

    let mut res = Response::new(StatusCode::Ok);
    res.insert_header("Content-Type", "text/plain");
    res.set_body("Hello from async-h1!");
    Ok(res)
}

/// Listens for incoming connections and serves them.
async fn listen(listener: Async<TcpListener>, tls: Option<TlsAcceptor>) -> Result<()> {
    // Format the full host address.
    let host = match &tls {
        None => format!("http://{}", listener.get_ref().local_addr()?),
        Some(_) => format!("https://{}", listener.get_ref().local_addr()?),
    };
    println!("Listening on {}", host);

    loop {
        // Accept the next connection.
        let (stream, _) = listener.accept().await?;

        // Spawn a background task serving this connection.
        let task = match &tls {
            None => {
                let stream = async_dup::Arc::new(stream);
                smol::spawn(async move {
                    if let Err(err) = async_h1::accept(stream, serve).await {
                        println!("Connection error: {:#?}", err);
                    }
                })
            }
            Some(tls) => {
                // In case of HTTPS, establish a secure TLS connection first.
                match tls.accept(stream).await {
                    Ok(stream) => {
                        let stream = async_dup::Arc::new(async_dup::Mutex::new(stream));
                        smol::spawn(async move {
                            if let Err(err) = async_h1::accept(stream, serve).await {
                                println!("Connection error: {:#?}", err);
                            }
                        })
                    }
                    Err(err) => {
                        println!("Failed to establish secure TLS connection: {:#?}", err);
                        continue;
                    }
                }
            }
        };

        // Detach the task to let it run in the background.
        task.detach();
    }
}

fn main() -> Result<()> {
    // Initialize TLS with the local certificate, private key, and password.
    let identity = Identity::from_pkcs12(include_bytes!("identity.pfx"), "password")?;
    let tls = TlsAcceptor::from(native_tls::TlsAcceptor::new(identity)?);

    // Start HTTP and HTTPS servers.
    smol::block_on(async {
        let http = listen(Async::<TcpListener>::bind(([127, 0, 0, 1], 8000))?, None);
        let https = listen(
            Async::<TcpListener>::bind(([127, 0, 0, 1], 8001))?,
            Some(tls),
        );
        future::try_zip(http, https).await?;
        Ok(())
    })
}

```

### Core Architecture Module: `examples/chat-client.rs`
```
//! A TCP chat client.
//!
//! First start a server:
//!
//! ```
//! cargo run --example chat-server
//! ```
//!
//! Then start clients:
//!
//! ```
//! cargo run --example chat-client
//! ```

use std::net::TcpStream;

use smol::{future, io, Async, Unblock};

fn main() -> io::Result<()> {
    smol::block_on(async {
        // Connect to the server and create async stdin and stdout.
        let stream = Async::<TcpStream>::connect(([127, 0, 0, 1], 6000)).await?;
        let stdin = Unblock::new(std::io::stdin());
        let mut stdout = Unblock::new(std::io::stdout());

        // Intro messages.
        println!("Connected to {}", stream.get_ref().peer_addr()?);
        println!("My nickname: {}", stream.get_ref().local_addr()?);
        println!("Type a message and hit enter!\n");

        let reader = &stream;
        let mut writer = &stream;

        // Wait until the standard input is closed or the connection is closed.
        future::race(
            async {
                let res = io::copy(stdin, &mut writer).await;
                println!("Quit!");
                res
            },
            async {
                let res = io::copy(reader, &mut stdout).await;
                println!("Server disconnected!");
                res
            },
        )
        .await?;

        Ok(())
    })
}

```

### Core Architecture Module: `examples/chat-server.rs`
```
//! A TCP chat server.
//!
//! First start a server:
//!
//! ```
//! cargo run --example chat-server
//! ```
//!
//! Then start clients:
//!
//! ```
//! cargo run --example chat-client
//! ```

use std::collections::HashMap;
use std::net::{SocketAddr, TcpListener, TcpStream};

use async_channel::{bounded, Receiver, Sender};
use async_dup::Arc;
use smol::{io, prelude::*, Async};

/// An event on the chat server.
enum Event {
    /// A client has joined.
    Join(SocketAddr, Arc<Async<TcpStream>>),

    /// A client has left.
    Leave(SocketAddr),

    /// A client sent a message.
    Message(SocketAddr, String),
}

/// Dispatches events to clients.
async fn dispatch(receiver: Receiver<Event>) -> io::Result<()> {
    // Currently active clients.
    let mut map = HashMap::<SocketAddr, Arc<Async<TcpStream>>>::new();

    // Receive incoming events.
    while let Ok(event) = receiver.recv().await {
        // Process the event and format a message to send to clients.
        let output = match event {
            Event::Join(addr, stream) => {
                map.insert(addr, stream);
                format!("{} has joined\n", addr)
            }
            Event::Leave(addr) => {
                map.remove(&addr);
                format!("{} has left\n", addr)
            }
            Event::Message(addr, msg) => format!("{} says: {}\n", addr, msg),
        };

        // Display the event in the server process.
        print!("{}", output);

        // Send the event to all active clients.
        for stream in map.values_mut() {
            // Ignore errors because the client might disconnect at any point.
            stream.write_all(output.as_bytes()).await.ok();
        }
    }
    Ok(())
}

/// Reads messages from the client and forwards them to the dispatcher task.
async fn read_messages(sender: Sender<Event>, client: Arc<Async<TcpStream>>) -> io::Result<()> {
    let addr = client.get_ref().peer_addr()?;
    let mut lines = io::BufReader::new(client).lines();

    while let Some(line) = lines.next().await {
        let line = line?;
        sender.send(Event::Message(addr, line)).await.ok();
    }
    Ok(())
}

fn main() -> io::Result<()> {
    smol::block_on(async {
        // Create a listener for incoming client connections.
        let listener = Async::<TcpListener>::bind(([127, 0, 0, 1], 6000))?;

        // Intro messages.
        println!("Listening on {}", listener.get_ref().local_addr()?);
        println!("Start a chat client now!\n");

        // Spawn a background task that dispatches events to clients.
        let (sender, receiver) = bounded(100);
        smol::spawn(dispatch(receiver)).detach();

        loop {
            // Accept the next connection.
            let (stream, addr) = listener.accept().await?;
            let client = Arc::new(stream);
            let sender = sender.clone();

            // Spawn a background task reading messages from the client.
            smol::spawn(async move {
                // Client starts with a `Join` event.
                sender.send(Event::Join(addr, client.clone())).await.ok();

                // Read messages from the client and ignore I/O errors when the client quits.
                read_messages(sender.clone(), client).await.ok();

                // Client ends with a `Leave` event.
                sender.send(Event::Leave(addr)).await.ok();
            })
            .detach();
        }
    })
}

```

### Core Architecture Module: `examples/ctrl-c.rs`
```
//! Uses the `ctrlc` crate to catch the Ctrl-C signal.
//!
//! Run with:
//!
//! ```
//! cargo run --example ctrl-c
//! ```

fn main() {
    // Set a handler that sends a message through a channel.
    let (s, ctrl_c) = async_channel::bounded(100);
    let handle = move || {
        s.try_send(()).ok();
    };
    ctrlc::set_handler(handle).unwrap();

    smol::block_on(async {
        println!("Waiting for Ctrl-C...");

        // Receive a message that indicates the Ctrl-C signal occurred.
        ctrl_c.recv().await.ok();

        println!("Done!");
    })
}

```

### Core Architecture Module: `examples/get-request.rs`
```
//! Connect to an HTTP website, make a GET request, and pipe the response to the standard output.
//!
//! Run with:
//!
//! ```
//! cargo run --example get-request
//! ```

use smol::{io, prelude::*, Async, Unblock};
use std::net::{TcpStream, ToSocketAddrs};

fn main() -> io::Result<()> {
    smol::block_on(async {
        // Connect to http://example.com
        let mut addrs = smol::unblock(move || ("example.com", 80).to_socket_addrs()).await?;
        let addr = addrs.next().unwrap();
        let mut stream = Async::<TcpStream>::connect(addr).await?;

        // Send an HTTP GET request.
        let req = b"GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n";
        stream.write_all(req).await?;

        // Read the response and pipe it to the standard output.
        let mut stdout = Unblock::new(std::io::stdout());
        io::copy(&stream, &mut stdout).await?;
        Ok(())
    })
}

```

### Core Architecture Module: `examples/hyper-client.rs`
```
//! An HTTP+TLS client based on `hyper` and `async-native-tls`.
//!
//! Run with:
//!
//! ```
//! cargo run --example hyper-client
//! ```

use std::pin::Pin;
use std::task::{Context, Poll};

use anyhow::{bail, Context as _, Result};
use async_native_tls::TlsStream;
use http_body_util::{BodyStream, Empty};
use hyper::body::Incoming;
use hyper::{Request, Response};
use macro_rules_attribute::apply;
use smol::{io, net::TcpStream, prelude::*, Executor};
use smol_hyper::rt::FuturesIo;
use smol_macros::main;

/// Sends a request and fetches the response.
async fn fetch(
    ex: &Executor<'static>,
    req: Request<Empty<&'static [u8]>>,
) -> Result<Response<Incoming>> {
    // Connect to the HTTP server.
    let io = {
        let host = req.uri().host().context("cannot parse host")?;

        match req.uri().scheme_str() {
            Some("http") => {
                let stream = {
                    let port = req.uri().port_u16().unwrap_or(80);
                    TcpStream::connect((host, port)).await?
                };
                SmolStream::Plain(stream)
            }
            Some("https") => {
                // In case of HTTPS, establish a secure TLS connection first.
                let stream = {
                    let port = req.uri().port_u16().unwrap_or(443);
                    TcpStream::connect((host, port)).await?
                };
                let stream = async_native_tls::connect(host, stream).await?;
                SmolStream::Tls(stream)
            }
            scheme => bail!("unsupported scheme: {:?}", scheme),
        }
    };

    // Spawn the HTTP/1 connection.
    let (mut sender, conn) = hyper::client::conn::http1::handshake(FuturesIo::new(io)).await?;
    ex.spawn(async move {
        if let Err(e) = conn.await {
            println!("Connection failed: {:?}", e);
        }
    })
    .detach();

    // Get the result
    let result = sender.send_request(req).await?;
    Ok(result)
}

#[apply(main!)]
async fn main(ex: &Executor<'static>) -> Result<()> {
    // Create a request.
    let url: hyper::Uri = "https://www.rust-lang.org".try_into()?;
    let req = Request::builder()
        .header(
            hyper::header::HOST,
            url.authority().unwrap().clone().as_str(),
        )
        .uri(url)
        .body(Empty::new())?;

    // Fetch the response.
    let resp = fetch(ex, req).await?;
    println!("{:#?}", resp);

    // Read the message body.
    let body: Vec<u8> = BodyStream::new(resp.into_body())
        .try_fold(Vec::new(), |mut body, chunk| {
            if let Some(chunk) = chunk.data_ref() {
                body.extend_from_slice(chunk);
            }
            Ok(body)
        })
        .await?;
    println!("{}", String::from_utf8_lossy(&body));

    Ok(())
}

/// A TCP or TCP+TLS connection.
enum SmolStream {
    /// A plain TCP connection.
    Plain(TcpStream),

    /// A TCP connection secured by TLS.
    Tls(TlsStream<TcpStream>),
}

impl AsyncRead for SmolStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut [u8],
    ) -> Poll<io::Result<usize>> {
        match &mut *self {
            SmolStream::Plain(stream) => Pin::new(stream).poll_read(cx, buf),
            SmolStream::Tls(stream) => Pin::new(stream).poll_read(cx, buf),
        }
    }
}

impl AsyncWrite for SmolStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        match &mut *self {
            SmolStream::Plain(stream) => Pin::new(stream).poll_write(cx, buf),
            SmolStream::Tls(stream) => Pin::new(stream).poll_write(cx, buf),
        }
    }

    fn poll_close(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        match &mut *self {
            SmolStream::Plain(stream) => Pin::new(stream).poll_close(cx),
            SmolStream::Tls(stream) => Pin::new(stream).poll_close(cx),
        }
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        match &mut *self {
            SmolStream::Plain(stream) => Pin::new(stream).poll_flush(cx),
            SmolStream::Tls(stream) => Pin::new(stream).poll_flush(cx),
        }
    }
}

```

### Core Architecture Module: `examples/hyper-server.rs`
```
//! An HTTP+TLS server based on `hyper` and `async-native-tls`.
//!
//! Run with:
//!
//! ```
//! cargo run --example hyper-server
//! ```
//!
//! Open in the browser any of these addresses:
//!
//! - http://localhost:8000/
//! - https://localhost:8001/ (accept the security prompt in the browser)
//!
//! Refer to `README.md` to see how the TLS certificate was generated.

use std::net::{TcpListener, TcpStream};
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use anyhow::Result;
use async_native_tls::{Identity, TlsAcceptor, TlsStream};
use http_body_util::Full;
use hyper::body::Incoming;
use hyper::service::service_fn;
use hyper::{Request, Response};
use macro_rules_attribute::apply;
use smol::{future, io, prelude::*, Async, Executor};
use smol_hyper::rt::{FuturesIo, SmolTimer};
use smol_macros::main;

/// Serves a request and returns a response.
async fn serve(req: Request<Incoming>) -> Result<Response<Full<&'static [u8]>>> {
    println!("Serving {}", req.uri());
    Ok(Response::new(Full::new("Hello from hyper!".as_bytes())))
}

/// Handle a new client.
async fn handle_client(client: Async<TcpStream>, tls: Option<TlsAcceptor>) -> Result<()> {
    // Wrap it in TLS if necessary.
    let client = match &tls {
        None => SmolStream::Plain(client),
        Some(tls) => {
            // In case of HTTPS, establish a secure TLS connection.
            SmolStream::Tls(tls.accept(client).await?)
        }
    };

    // Build the server.
    hyper::server::conn::http1::Builder::new()
        .timer(SmolTimer::new())
        .serve_connection(FuturesIo::new(client), service_fn(serve))
        .await?;

    Ok(())
}

/// Listens for incoming connections and serves them.
async fn listen(
    ex: &Arc<Executor<'static>>,
    listener: Async<TcpListener>,
    tls: Option<TlsAcceptor>,
) -> Result<()> {
    // Format the full host address.
    let host = &match tls {
        None => format!("http://{}", listener.get_ref().local_addr()?),
        Some(_) => format!("https://{}", listener.get_ref().local_addr()?),
    };
    println!("Listening on {}", host);

    loop {
        // Wait for a new client.
        let (client, _) = listener.accept().await?;

        // Spawn a task to handle this connection.
        ex.spawn({
            let tls = tls.clone();
            async move {
                if let Err(e) = handle_client(client, tls).await {
                    println!("Error while handling client: {}", e);
                }
            }
        })
        .detach();
    }
}

#[apply(main!)]
async fn main(ex: &Arc<Executor<'static>>) -> Result<()> {
    // Initialize TLS with the local certificate, private key, and password.
    let identity = Identity::from_pkcs12(include_bytes!("identity.pfx"), "password")?;
    let tls = TlsAcceptor::from(native_tls::TlsAcceptor::new(identity)?);

    // Start HTTP and HTTPS servers.
    let http = listen(
        ex,
        Async::<TcpListener>::bind(([127, 0, 0, 1], 8000))?,
        None,
    );
    let https = listen(
        ex,
        Async::<TcpListener>::bind(([127, 0, 0, 1], 8001))?,
        Some(tls),
    );
    future::try_zip(http, https).await?;
    Ok(())
}

/// A TCP or TCP+TLS connection.
enum SmolStream {
    /// A plain TCP connection.
    Plain(Async<TcpStream>),

    /// A TCP connection secured by TLS.
    Tls(TlsStream<Async<TcpStream>>),
}

impl AsyncRead for SmolStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut [u8],
    ) -> Poll<io::Result<usize>> {
        match &mut *self {
            Self::Plain(s) => Pin::new(s).poll_read(cx, buf),
            Self::Tls(s) => Pin::new(s).poll_read(cx, buf),
        }
    }
}

impl AsyncWrite for SmolStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        match &mut *self {
            Self::Plain(s) => Pin::new(s).poll_write(cx, buf),
            Self::Tls(s) => Pin::new(s).poll_write(cx, buf),
        }
    }

    fn poll_close(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        match &mut *self {
            Self::Plain(s) => Pin::new(s).poll_close(cx),
            Self::Tls(s) => Pin::new(s).poll_close(cx),
        }
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        match &mut *self {
            Self::Plain(s) => Pin::new(s).poll_close(cx),
            Self::Tls(s) => Pin::new(s).poll_close(cx),
        }
    }
}

```

### Core Architecture Module: `examples/linux-inotify.rs`
```
//! Uses the `inotify` crate to watch for changes in the current directory.
//!
//! Run with:
//!
//! ```
//! cargo run --example linux-inotify
//! ```

#[cfg(target_os = "linux")]
fn main() -> std::io::Result<()> {
    use std::ffi::OsString;
    use std::os::unix::io::AsFd;

    use inotify::{EventMask, Inotify, WatchMask};
    use smol::{io, Async};

    type Event = (OsString, EventMask);

    /// Reads some events without blocking.
    ///
    /// If there are no events, an [`io::ErrorKind::WouldBlock`] error is returned.
    fn read_op(inotify: &mut Inotify) -> io::Result<Vec<Event>> {
        let mut buffer = [0; 1024];
        let events = inotify
            .read_events(&mut buffer)?
            .filter_map(|ev| ev.name.map(|name| (name.to_owned(), ev.mask)))
            .collect::<Vec<_>>();

        if events.is_empty() {
            Err(io::ErrorKind::WouldBlock.into())
        } else {
            Ok(events)
        }
    }

    smol::block_on(async {
        // Watch events in the current directory.
        let mut inotify = Inotify::init()?;
        let source = Async::new(inotify.as_fd().try_clone_to_owned()?)?;
        inotify.watches().add(".", WatchMask::ALL_EVENTS)?;
        println!("Watching for filesystem events in the current directory...");
        println!("Try opening a file to trigger some events.");
        println!();

        // Wait for events in a loop and print them on the screen.
        loop {
            for event in source.read_with(|_| read_op(&mut inotify)).await? {
                println!("{:?}", event);
            }
        }
    })
}

#[cfg(not(target_os = "linux"))]
fn main() {
    println!("This example works only on Linux!");
}

```

### Core Architecture Module: `examples/linux-timerfd.rs`
```
//! Uses the `timerfd` crate to sleep using an OS timer.
//!
//! Run with:
//!
//! ```
//! cargo run --example linux-timerfd
//! ```

#[cfg(target_os = "linux")]
fn main() -> std::io::Result<()> {
    use std::time::{Duration, Instant};

    use smol::{io, Async};
    use timerfd::{SetTimeFlags, TimerFd, TimerState};

    /// Sleeps using an OS timer.
    async fn sleep(dur: Duration) -> io::Result<()> {
        // Create an OS timer.
        let mut timer = TimerFd::new()?;
        timer.set_state(TimerState::Oneshot(dur), SetTimeFlags::Default);

        // When the OS timer fires, a 64-bit integer can be read from it.
        Async::new(timer)?
            .read_with(|t| rustix::io::read(t, &mut [0u8; 8]).map_err(io::Error::from))
            .await?;
        Ok(())
    }

    smol::block_on(async {
        let start = Instant::now();
        println!("Sleeping...");

        // Sleep for a second using an OS timer.
        sleep(Duration::from_secs(1)).await?;

        println!("Woke up after {:?}", start.elapsed());
        Ok(())
    })
}

#[cfg(not(target_os = "linux"))]
fn main() {
    println!("This example works only on Linux!");
}

```

### Core Architecture Module: `examples/simple-client.rs`
```
//! A simple HTTP+TLS client based on `async-native-tls`.
//!
//! Run with:
//!
//! ```
//! cargo run --example simple-client
//! ```

use std::net::{TcpStream, ToSocketAddrs};

use anyhow::{bail, Context as _, Result};
use smol::{prelude::*, Async};
use url::Url;

/// Sends a GET request and fetches the response.
async fn fetch(addr: &str) -> Result<Vec<u8>> {
    // Parse the URL.
    let url = Url::parse(addr)?;
    let host = url.host().context("cannot parse host")?.to_string();
    let port = url.port_or_known_default().context("cannot guess port")?;
    let path = url.path().to_string();
    let query = match url.query() {
        Some(q) => format!("?{}", q),
        None => String::new(),
    };

    // Construct a request.
    let req = format!(
        "GET {}{} HTTP/1.1\r\nHost: {}\r\nAccept: */*\r\nConnection: close\r\n\r\n",
        path, query, host,
    );

    // Connect to the host.
    let socket_addr = {
        let host = host.clone();
        smol::unblock(move || (host.as_str(), port).to_socket_addrs())
            .await?
            .next()
            .context("cannot resolve address")?
    };
    let mut stream = Async::<TcpStream>::connect(socket_addr).await?;

    // Send the request and wait for the response.
    let mut resp = Vec::new();
    match url.scheme() {
        "http" => {
            stream.write_all(req.as_bytes()).await?;
            stream.read_to_end(&mut resp).await?;
        }
        "https" => {
            // In case of HTTPS, establish a secure TLS connection first.
            let mut stream = async_native_tls::connect(&host, stream).await?;
            stream.write_all(req.as_bytes()).await?;
            stream.read_to_end(&mut resp).await?;
        }
        scheme => bail!("unsupported scheme: {}", scheme),
    }

    Ok(resp)
}

fn main() -> Result<()> {
    smol::block_on(async {
        let addr = "https://www.rust-lang.org";
        let resp = fetch(addr).await?;
        println!("{}", String::from_utf8_lossy(&resp));
        Ok(())
    })
}

```

### Core Architecture Module: `examples/simple-server.rs`
```
//! A simple HTTP+TLS server based on `async-native-tls`.
//!
//! Run with:
//!
//! ```
//! cargo run --example simple-server
//! ```
//!
//! Open in the browser any of these addresses:
//!
//! - http://localhost:8000/
//! - https://localhost:8001/ (accept the security prompt in the browser)
//!
//! Refer to `README.md` to see how the TLS certificate was generated.

use std::net::{TcpListener, TcpStream};

use anyhow::Result;
use async_native_tls::{Identity, TlsAcceptor};
use smol::{future, prelude::*, Async};

const RESPONSE: &[u8] = br#"
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 47

<!DOCTYPE html><html><body>Hello!</body></html>
"#;

/// Reads a request from the client and sends it a response.
async fn serve(mut stream: Async<TcpStream>, tls: Option<TlsAcceptor>) -> Result<()> {
    match tls {
        None => {
            println!("Serving http://{}", stream.get_ref().local_addr()?);
            stream.write_all(RESPONSE).await?;
        }
        Some(tls) => {
            println!("Serving https://{}", stream.get_ref().local_addr()?);

            // In case of HTTPS, establish a secure TLS connection first.
            match tls.accept(stream).await {
                Ok(mut stream) => {
                    stream.write_all(RESPONSE).await?;
                    stream.flush().await?;
                    stream.close().await?;
                }
                Err(err) => println!("Failed to establish secure TLS connection: {:#?}", err),
            }
        }
    }
    Ok(())
}

/// Listens for incoming connections and serves them.
async fn listen(listener: Async<TcpListener>, tls: Option<TlsAcceptor>) -> Result<()> {
    // Display the full host address.
    match &tls {
        None => println!("Listening on http://{}", listener.get_ref().local_addr()?),
        Some(_) => println!("Listening on https://{}", listener.get_ref().local_addr()?),
    }

    loop {
        // Accept the next connection.
        let (stream, _) = listener.accept().await?;
        let tls = tls.clone();

        // Spawn a background task serving this connection.
        smol::spawn(async move {
            if let Err(err) = serve(stream, tls).await {
                println!("Connection error: {:#?}", err);
            }
        })
        .detach();
    }
}

fn main() -> Result<()> {
    // Initialize TLS with the local certificate, private key, and password.
    let identity = Identity::from_pkcs12(include_bytes!("identity.pfx"), "password")?;
    let tls = TlsAcceptor::from(native_tls::TlsAcceptor::new(identity)?);

    // Start HTTP and HTTPS servers.
    smol::block_on(async {
        let http = listen(Async::<TcpListener>::bind(([127, 0, 0, 1], 8000))?, None);
        let https = listen(
            Async::<TcpListener>::bind(([127, 0, 0, 1], 8001))?,
            Some(tls),
        );
        future::try_zip(http, https).await?;
        Ok(())
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #384** (2026-08-03): **Update async-tungstenite requirement from 0.34 to 0.35**
  *Symptoms*: Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md">async-tungstenite's changelog</a>.</em></p> <blockquote> <h2>[0.35.0] - 2026-07-28</h2> <h3>Fixed</h3> <ul> <li>Fix docs.rs build.</li> </ul> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.30.</li> <li>Update to rustls-platform-verifier 0.7.</li> <li>Switch examples from async-std to smol.</li> <li>Deprecate async-tls and async-std related features.</li> </ul> <h2>[0.34.1] - 2026-04-02</h2> <h3>Added</h3> <ul> <li>New <code>futures-rustls</code> features for rustls support via the smol runtime.</li> </ul> <h3>Fixed</h3> <ul> <li>Various docs and cargo-feature related fixes.</li> </ul> <h3>Changed</h3> <ul> <li>Add deprecation notice for async-std.</li> </ul> <h2>[0.34.0] - 2026-03-20</h2> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.29.</li> <li>Update to async-native-tls 0.6.</li> </ul> <h3>Added</h3> <ul> <li>smol runtime support including smol-native-tls.</li> </ul> <h2>[0.33.0] - 2026-02-20</h2> <h3>Changed</h3> <ul> <li>Update GLib/gio support to version 0.22 of the bindings.</li> <li>Update MSRV to 1.85.</li> </ul> <h2>[0.32.1] - 2026-01-05</h2> <h3>Added</h3> <ul> <li>Add <code>tokio-rustls-platform-verifier</code> feature to use that crate for certificate verification.</li> </ul> <h2>[0.32.0] - 2025-10-3

- **Issue #382** (2026-06-27): **fix: reject zero SMOL_THREADS value**
  *Symptoms*: SMOL_THREADS=0 creates a range `1..=0` which yields no worker threads, causing tasks spawned with `smol::spawn` to hang forever.  Non-numeric values already fall back to 1 because `parse::<usize>` fails, but `0` parsed successfully and produced an empty range.  Add `.filter(|&n| n > 0)` so that a zero value falls back to the default of 1, matching the behavior for invalid values.  Closes #381

- **Issue #381** (2026-06-27): **SMOL_THREADS=0 or negative can leave the global executor without worker threads**
  *Symptoms*: ## Summary  `SMOL_THREADS` currently accepts non-positive integer values. When set to `0` or a negative value such as `-1`, the global executor starts with no worker threads. Tasks spawned with `smol::spawn` can then hang forever when awaited.  ## Reproduction  Run the existing `spawn` doctest with different `SMOL_THREADS` values:  ```sh SMOL_THREADS=1 cargo test spawn --doc timeout 8 env SMOL_THREADS=0 cargo test spawn --doc timeout 8 env SMOL_THREADS=-1 cargo test spawn --doc ```  ## Observed Behavior  - `SMOL_THREADS=1` completes successfully. - `SMOL_THREADS=0` times out before the spawned task completes. - `SMOL_THREADS=-1` times out before the spawned task completes.  I also checked a non-numeric value:  ```sh timeout 20 env SMOL_THREADS=not-a-number cargo test spawn --doc ```  That completes successfully because parse failures fall back to the default value of `1`.  ## Expected Behavior  Non-positive `SMOL_THREADS` values should not create a zero-worker global executor. They should either be rejected or treated like other invalid values and fall back to the default of `1`.  ## Likely Cause  In `src/spawn.rs`, `SMOL_THREADS` is parsed without enforcing a positive thread count:  ```rust let num_threads = {     // Parse SMOL_THREADS or default to 1.     std::env::var("SMOL_THREADS")         .ok()         .and_then(|s| s.parse().ok())         .unwrap_or(1) };  for n in 1..=num_threads {     thread::Builder::new()         .name(format!("smol-{}", n))         .spawn(|| loop 
  **Post-Mortem & Fix Analysis**:
  > If this issue is valid, I wanna work on it.
  > I wanted to do this 😭  Anyway, happy to know someone did it. Time for finding next issue ✨

- **Issue #380** (2026-05-31): **RUSTSEC-2026-0097: Rand is unsound with a custom logger using `rand::rng()`**
  *Symptoms*:  > Rand is unsound with a custom logger using `rand::rng()`  | Details             |                                                | | ------------------- | ---------------------------------------------- | | Status              | unsound                | | Package             | `rand`                      | | Version             | `0.7.3`                   | | URL                 | [https://github.com/rust-random/rand/pull/1763](https://github.com/rust-random/rand/pull/1763) | | Date                | 2026-04-09                         |  It has been reported (by @lopopolo) that the `rand` library is [unsound](https://rust-lang.github.io/unsafe-code-guidelines/glossary.html#soundness-of-code--of-a-library) (i.e. that safe code using the public API can cause Undefined Behaviour) when all the following conditions are met:  - The `log` and `thread_rng` features are enabled - A [custom logger](https://docs.rs/log/latest/log/#implementing-a-logger) is defined - The custom logger accesses `rand::rng()` (previously `rand::thread_rng()`) and calls any `TryRng` (previously `RngCore`) methods on `ThreadRng` - The `ThreadRng` (attempts to) reseed while called from the custom logger (this happens every 64 kB of generated data) - Trace-level logging is enabled or warn-level logging is enabled and the random source (the `getrandom` crate) is unable to provide a new seed  `TryRng` (previously `RngCore`) methods for `ThreadRng` use `unsafe` code to cast `*mut BlockRng&lt;ReseedingCore&gt;` t
  **Post-Mortem & Fix Analysis**:
  > This is only used in examples.  ```console $ cargo tree -i -p rand error: specification `rand` is ambiguous help: re-run this command with one of the following specifications   rand@0.7.3   rand@0.8.6   rand@0.9.4 zsh: exit 101   cargo tree -i -p rand  $ cargo tree -i -p rand@0.9.4 rand v0.9.4 └── tungstenite v0.29.0     └── async-tungstenite v0.34.1         [dev-dependencies]         └── smol v2.0.2 (/Users/taiki/projects/sources/smol-rs/smol)  $ cargo tree -i -p rand@0.8.6 rand v0.8.6 └── cookie v0.14.4     └── http-types v2.12.0         ├── async-h1 v2.3.4         │   └── http-client v6.5.3         │       └── surf v2.3.2         │           [dev-dependencies]         │           └── smol v2.0.2 (/Users/taiki/projects/sources/smol-rs/smol)         │   [dev-dependencies]         │   └── smol v2.0.2 (/Users/taiki/projects/sources/smol-rs/smol)         ├── http-client v6.5.3 (*)         └── surf v2.3.2 (*)         [dev-dependencies]         └── smol v2.0.2 (/Users/taiki/projects/source

- **Issue #378** (2026-05-13): **Update scraper requirement from 0.26 to 0.27**
  *Symptoms*: Updates the requirements on [scraper](https://github.com/rust-scraper/scraper) to permit the latest version. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rust-scraper/scraper/releases">scraper's releases</a>.</em></p> <blockquote> <h2>v0.27.0</h2> <h2>What's Changed</h2> <ul> <li>Bump dependencies including selectors and cssparser.</li> <li>Avoid exposing optional dependencies as implicit features.</li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/rust-scraper/scraper/compare/v0.26.0...v0.27.0">https://github.com/rust-scraper/scraper/compare/v0.26.0...v0.27.0</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/rust-scraper/scraper/commit/9c1eff304e45a8bccb463968268ce6758703e821"><code>9c1eff3</code></a> Bump selectors and cssparser together.</li> <li><a href="https://github.com/rust-scraper/scraper/commit/429d8a1b333baa1a441875984e09d0f09e9b5cc1"><code>429d8a1</code></a> Avoid exposing optional dependencies as implicit features.</li> <li><a href="https://github.com/rust-scraper/scraper/commit/8038521fea61c3a732db75e6ecd4ae94635369fa"><code>8038521</code></a> Add categories as suggested by lib.rs maintainer dashboard.</li> <li><a href="https://github.com/rust-scraper/scraper/commit/f2d0e5001ef3661cf25dccbb4a6965ae6f8cdd0c"><code>f2d0e50</code></a> Bump selectors from 0.36.1 to 0.37.0</li> <li><a href="https://github.com/rust-scraper/scraper/commit/21035

- **Issue #374** (2026-03-23): **Update scraper requirement from 0.25 to 0.26**
  *Symptoms*: Updates the requirements on [scraper](https://github.com/rust-scraper/scraper) to permit the latest version. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rust-scraper/scraper/releases">scraper's releases</a>.</em></p> <blockquote> <h2>v0.26.0</h2> <h2>What's Changed</h2> <ul> <li>fix dom manipulation example by <a href="https://github.com/JayceFayne"><code>@​JayceFayne</code></a> in <a href="https://redirect.github.com/rust-scraper/scraper/pull/292">rust-scraper/scraper#292</a></li> <li>Bump selectors from 0.33.0 to 0.35.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/rust-scraper/scraper/pull/298">rust-scraper/scraper#298</a></li> <li>Bump indexmap from 2.12.1 to 2.13.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/rust-scraper/scraper/pull/294">rust-scraper/scraper#294</a></li> <li>Upgrade ego-tree to 0.11.0 and html5ever to 0.37.1 by <a href="https://github.com/cfvescovo"><code>@​cfvescovo</code></a> in <a href="https://redirect.github.com/rust-scraper/scraper/pull/300">rust-scraper/scraper#300</a></li> <li>Bump html5ever from 0.37.1 to 0.38.0 by <a href="https://github.com/mohe2015"><code>@​mohe2015</code></a> in <a href="https://redirect.github.com/rust-scraper/scraper/pull/303">rust-scraper/scraper#303</a></li> <li>Bump selectors from 0.35.0 to 0.36.0 by <a href="https://github.com/d

- **Issue #373** (2026-03-23): **Update async-tungstenite requirement from 0.33 to 0.34**
  *Symptoms*: Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md">async-tungstenite's changelog</a>.</em></p> <blockquote> <h2>[0.34.0] - 2026-03-20</h2> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.29.</li> <li>Update to async-native-tls 0.6.</li> </ul> <h3>Added</h3> <ul> <li>smol runtime support including smol-native-tls.</li> </ul> <h2>[0.33.0] - 2026-02-20</h2> <h3>Changed</h3> <ul> <li>Update GLib/gio support to version 0.22 of the bindings.</li> <li>Update MSRV to 1.85.</li> </ul> <h2>[0.32.1] - 2026-01-05</h2> <h3>Added</h3> <ul> <li>Add <code>tokio-rustls-platform-verifier</code> feature to use that crate for certificate verification.</li> </ul> <h2>[0.32.0] - 2025-10-31</h2> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.28.</li> </ul> <h3>Added</h3> <ul> <li>Add <code>WebSocketStream::into_inner()</code> to get the underlying stream.</li> </ul> <h2>[0.31.0] - 2025-08-09</h2> <h3>Changed</h3> <ul> <li><code>WebSocketSender::send()</code> and <code>close()</code> require a mutable reference now.</li> </ul> <h2>[0.30.0] - 2025-07-15</h2> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.27.</li> <li>Update to webpki-roots to 1.0.</li> <li>Update to glib / gio 0.21.</li> </ul> <h3>Added</h3> <ul> <li>Add support for splitting a <code>WebSocketStream</code> into a sender

- **Issue #372** (2026-02-23): **Update async-tungstenite requirement from 0.32 to 0.33**
  *Symptoms*: Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md">async-tungstenite's changelog</a>.</em></p> <blockquote> <h2>[0.33.0] - 2026-02-20</h2> <h3>Changed</h3> <ul> <li>Update GLib/gio support to version 0.22 of the bindings.</li> <li>Update MSRV to 1.85.</li> </ul> <h2>[0.32.1] - 2026-01-05</h2> <h3>Added</h3> <ul> <li>Add <code>tokio-rustls-platform-verifier</code> feature to use that crate for certificate verification.</li> </ul> <h2>[0.32.0] - 2025-10-31</h2> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.28.</li> </ul> <h3>Added</h3> <ul> <li>Add <code>WebSocketStream::into_inner()</code> to get the underlying stream.</li> </ul> <h2>[0.31.0] - 2025-08-09</h2> <h3>Changed</h3> <ul> <li><code>WebSocketSender::send()</code> and <code>close()</code> require a mutable reference now.</li> </ul> <h2>[0.30.0] - 2025-07-15</h2> <h3>Changed</h3> <ul> <li>Update to tungstenite 0.27.</li> <li>Update to webpki-roots to 1.0.</li> <li>Update to glib / gio 0.21.</li> </ul> <h3>Added</h3> <ul> <li>Add support for splitting a <code>WebSocketStream</code> into a sender and receiver type without making use of the future's <code>Sink</code> trait, and re-combining them again into a single value.</li> </ul> <h2>[0.29.1] - 2025-02-18</h2> <h3>Added</h3> <ul> <li> <p>Added wrappers that al
  **Post-Mortem & Fix Analysis**:
  > @dependabot rebase

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

### Incident Patch 1: `4892eb0d` (2026-08-03)
**Commit Message**: Update async-tungstenite requirement from 0.34 to 0.35 (#384)

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.34.0...0.35.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-version: 0.35.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.6"
-async-tungstenite = { version = "0.34", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.35", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

---

### Incident Patch 2: `6176d8e5` (2026-05-13)
**Commit Message**: Update scraper requirement from 0.26 to 0.27 (#378)

Updates the requirements on [scraper](https://github.com/rust-scraper/scraper) to permit the latest version.
- [Release notes](https://github.com/rust-scraper/scraper/releases)
- [Commits](https://github.com/rust-scraper/scraper/compare/v0.26.0...v0.27.0)

---
updated-dependencies:
- dependency-name: scraper
  dependency-version: 0.27.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ http-types = "2"
 hyper = { version = "1.0", default-features = false, features = ["client", "http1", "server"] }
 macro_rules_attribute = "0.2.0"
 native-tls = "0.2"
-scraper = "0.26"
+scraper = "0.27"
 signal-hook = "0.4"
 smol-hyper = "0.1.0"
 smol-macros = "0.1.0"
```

---

### Incident Patch 3: `4af083b2` (2026-03-23)
**Commit Message**: Update async-tungstenite requirement from 0.33 to 0.34 (#373)

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.33.0...0.34.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-version: 0.34.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.6"
-async-tungstenite = { version = "0.33", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.34", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

---

### Incident Patch 4: `5bbe7eb2` (2026-03-23)
**Commit Message**: Update scraper requirement from 0.25 to 0.26 (#374)

Updates the requirements on [scraper](https://github.com/rust-scraper/scraper) to permit the latest version.
- [Release notes](https://github.com/rust-scraper/scraper/releases)
- [Commits](https://github.com/rust-scraper/scraper/compare/v0.25.0...v0.26.0)

---
updated-dependencies:
- dependency-name: scraper
  dependency-version: 0.26.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ http-types = "2"
 hyper = { version = "1.0", default-features = false, features = ["client", "http1", "server"] }
 macro_rules_attribute = "0.2.0"
 native-tls = "0.2"
-scraper = "0.25"
+scraper = "0.26"
 signal-hook = "0.4"
 smol-hyper = "0.1.0"
 smol-macros = "0.1.0"
```

---

### Incident Patch 5: `38e96d73` (2026-02-23)
**Commit Message**: Update async-tungstenite requirement from 0.32 to 0.33 (#372)

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.32.0...0.33.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-version: 0.33.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.6"
-async-tungstenite = { version = "0.32", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.33", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

---

### Incident Patch 6: `5590f33b` (2026-02-23)
**Commit Message**: Update async-native-tls requirement from 0.5 to 0.6 (#371)

Updates the requirements on [async-native-tls](https://github.com/async-email/async-native-tls) to permit the latest version.
- [Commits](https://github.com/async-email/async-native-tls/compare/v0.5.0...v0.6.0)

---
updated-dependencies:
- dependency-name: async-native-tls
  dependency-version: 0.6.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ async-process = "2.0.0"
 anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
-async-native-tls = "0.5"
+async-native-tls = "0.6"
 async-tungstenite = { version = "0.32", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
```

---

### Incident Patch 7: `9d27afe9` (2026-01-20)
**Commit Message**: Update signal-hook requirement from 0.3 to 0.4 (#363)

Updates the requirements on [signal-hook](https://github.com/vorner/signal-hook) to permit the latest version.
- [Changelog](https://github.com/vorner/signal-hook/blob/master/CHANGELOG.md)
- [Commits](https://github.com/vorner/signal-hook/compare/v0.3.0...v0.4.1)

---
updated-dependencies:
- dependency-name: signal-hook
  dependency-version: 0.4.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Taiki Endo <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ hyper = { version = "1.0", default-features = false, features = ["client", "http
 macro_rules_attribute = "0.2.0"
 native-tls = "0.2"
 scraper = "0.25"
-signal-hook = "0.3"
+signal-hook = "0.4"
 smol-hyper = "0.1.0"
 smol-macros = "0.1.0"
 surf = { version = "2", default-features = false, features = ["h1-client"] }
```

**File**: `examples/unix-signal.rs` (modified, +2/-2)
```diff
@@ -8,15 +8,15 @@
 
 #[cfg(unix)]
 fn main() -> std::io::Result<()> {
-    use std::os::unix::{io::AsRawFd, net::UnixStream};
+    use std::os::unix::net::UnixStream;
 
     use smol::{prelude::*, Async};
 
     smol::block_on(async {
         // Create a Unix stream that receives a byte on each signal occurrence.
         let (a, mut b) = Async::<UnixStream>::pair()?;
         // Async isn't IntoRawFd, but it is AsRawFd, so let's pass the raw fd directly.
-        signal_hook::low_level::pipe::register_raw(signal_hook::consts::SIGINT, a.as_raw_fd())?;
+        signal_hook::low_level::pipe::register_raw(signal_hook::consts::SIGINT, a.try_into()?)?;
         println!("Waiting for Ctrl-C...");
 
         // Receive a byte that indicates the Ctrl-C signal occurred.
```

---

### Incident Patch 8: `5abe211f` (2025-12-08)
**Commit Message**: Update async-tungstenite requirement from 0.31 to 0.32 (#358)

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.31.0...0.32.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-version: 0.32.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.5"
-async-tungstenite = { version = "0.31", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.32", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

---

### Incident Patch 9: `42db9c2c` (2025-12-08)
**Commit Message**: Update scraper requirement from 0.24 to 0.25 (#361)

Updates the requirements on [scraper](https://github.com/rust-scraper/scraper) to permit the latest version.
- [Release notes](https://github.com/rust-scraper/scraper/releases)
- [Commits](https://github.com/rust-scraper/scraper/compare/v0.24.0...v0.25.0)

---
updated-dependencies:
- dependency-name: scraper
  dependency-version: 0.25.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ http-types = "2"
 hyper = { version = "1.0", default-features = false, features = ["client", "http1", "server"] }
 macro_rules_attribute = "0.2.0"
 native-tls = "0.2"
-scraper = "0.24"
+scraper = "0.25"
 signal-hook = "0.3"
 smol-hyper = "0.1.0"
 smol-macros = "0.1.0"
```

---

### Incident Patch 10: `2b870728` (2025-08-23)
**Commit Message**: Update scraper requirement from 0.23 to 0.24 (#350)

Updates the requirements on [scraper](https://github.com/causal-agent/scraper) to permit the latest version.
- [Release notes](https://github.com/causal-agent/scraper/releases)
- [Commits](https://github.com/causal-agent/scraper/compare/v0.23.0...v0.24.0)

---
updated-dependencies:
- dependency-name: scraper
  dependency-version: 0.24.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ http-types = "2"
 hyper = { version = "1.0", default-features = false, features = ["client", "http1", "server"] }
 macro_rules_attribute = "0.2.0"
 native-tls = "0.2"
-scraper = "0.23"
+scraper = "0.24"
 signal-hook = "0.3"
 smol-hyper = "0.1.0"
 smol-macros = "0.1.0"
```

---

### Incident Patch 11: `0a8c32dc` (2025-08-12)
**Commit Message**: Update async-tungstenite requirement from 0.30 to 0.31 (#349)

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.30.0...0.31.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-version: 0.31.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.5"
-async-tungstenite = { version = "0.30", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.31", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

---

### Incident Patch 12: `cabafaf7` (2025-07-21)
**Commit Message**: Update async-tungstenite requirement from 0.29 to 0.30

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.29.0...0.30.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-version: 0.30.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.5"
-async-tungstenite = { version = "0.29", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.30", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

---

### Incident Patch 13: `d9d93336` (2025-03-10)
**Commit Message**: Update rustix requirement from 0.38 to 1.0

Updates the requirements on [rustix](https://github.com/bytecodealliance/rustix) to permit the latest version.
- [Release notes](https://github.com/bytecodealliance/rustix/releases)
- [Changelog](https://github.com/bytecodealliance/rustix/blob/main/CHANGES.md)
- [Commits](https://github.com/bytecodealliance/rustix/compare/v0.38.0...v1.0.1)

---
updated-dependencies:
- dependency-name: rustix
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ url = "2"
 
 [target.'cfg(target_os = "linux")'.dev-dependencies]
 inotify = { version = "0.11", default-features = false }
-rustix = "0.38"
+rustix = "1.0"
 timerfd = "1"
 
 [target.'cfg(windows)'.dev-dependencies]
```

---

### Incident Patch 14: `462e0a77` (2025-02-24)
**Commit Message**: Update scraper requirement from 0.22 to 0.23

Updates the requirements on [scraper](https://github.com/causal-agent/scraper) to permit the latest version.
- [Release notes](https://github.com/causal-agent/scraper/releases)
- [Commits](https://github.com/causal-agent/scraper/compare/v0.22.0...v0.23.1)

---
updated-dependencies:
- dependency-name: scraper
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ http-types = "2"
 hyper = { version = "1.0", default-features = false, features = ["client", "http1", "server"] }
 macro_rules_attribute = "0.2.0"
 native-tls = "0.2"
-scraper = "0.22"
+scraper = "0.23"
 signal-hook = "0.3"
 smol-hyper = "0.1.0"
 smol-macros = "0.1.0"
```

---

### Incident Patch 15: `cda19f04` (2025-02-17)
**Commit Message**: Update async-tungstenite requirement from 0.28 to 0.29

Updates the requirements on [async-tungstenite](https://github.com/sdroege/async-tungstenite) to permit the latest version.
- [Changelog](https://github.com/sdroege/async-tungstenite/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sdroege/async-tungstenite/compare/0.28.0...0.29.0)

---
updated-dependencies:
- dependency-name: async-tungstenite
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ anyhow = "1"
 async-dup = "1"
 async-h1 = "2"
 async-native-tls = "0.5"
-async-tungstenite = { version = "0.28", features = ["async-native-tls"] }
+async-tungstenite = { version = "0.29", features = ["async-native-tls"] }
 ctrlc = "3"
 doc-comment = "0.3"
 futures = "0.3"
```

#### Recent Merged Pull Requests:
- **PR #384** (2026-08-03): Update async-tungstenite requirement from 0.34 to 0.35 (@dependabot[bot])
- **PR #382** (2026-06-27): fix: reject zero SMOL_THREADS value (@cschanhniem)
- **PR #378** (2026-05-13): Update scraper requirement from 0.26 to 0.27 (@dependabot[bot])
- **PR #374** (2026-03-23): Update scraper requirement from 0.25 to 0.26 (@dependabot[bot])
- **PR #373** (2026-03-23): Update async-tungstenite requirement from 0.33 to 0.34 (@dependabot[bot])
- **PR #372** (2026-02-23): Update async-tungstenite requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #371** (2026-02-23): Update async-native-tls requirement from 0.5 to 0.6 (@dependabot[bot])
- **PR #369** (2026-02-15): Update MSRV in readme (@taiki-e)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
