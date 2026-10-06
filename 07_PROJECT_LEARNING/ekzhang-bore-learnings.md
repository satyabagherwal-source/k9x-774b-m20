# Forensic Learning Record (Deep Inspection): ekzhang/bore

> **Canonical Artifact**: `07_PROJECT_LEARNING/ekzhang-bore-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ekzhang/bore](https://github.com/ekzhang/bore))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:09.167Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ekzhang/bore`
- **Description**: 🕳 bore is a simple CLI tool for making tunnels to localhost
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 11523 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/auth.rs`
```
//! Auth implementation for bore client and server.

use anyhow::{bail, ensure, Result};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncRead, AsyncWrite};
use uuid::Uuid;

use crate::shared::{ClientMessage, Delimited, ServerMessage};

/// Wrapper around a MAC used for authenticating clients that have a secret.
pub struct Authenticator(Hmac<Sha256>);

impl Authenticator {
    /// Generate an authenticator from a secret.
    pub fn new(secret: &str) -> Self {
        let hashed_secret = Sha256::new().chain_update(secret).finalize();
        Self(Hmac::new_from_slice(&hashed_secret).expect("HMAC can take key of any size"))
    }

    /// Generate a reply message for a challenge.
    pub fn answer(&self, challenge: &Uuid) -> String {
        let mut hmac = self.0.clone();
        hmac.update(challenge.as_bytes());
        hex::encode(hmac.finalize().into_bytes())
    }

    /// Validate a reply to a challenge.
    ///
    /// ```
    /// use bore_cli::auth::Authenticator;
    /// use uuid::Uuid;
    ///
    /// let auth = Authenticator::new("secret");
    /// let challenge = Uuid::new_v4();
    ///
    /// assert!(auth.validate(&challenge, &auth.answer(&challenge)));
    /// assert!(!auth.validate(&challenge, "wrong answer"));
    /// ```
    pub fn validate(&self, challenge: &Uuid, tag: &str) -> bool {
        if let Ok(tag) = hex::decode(tag) {
            let mut hmac = self.0.clone();
            hmac.update(challenge.as_bytes());
            hmac.verify_slice(&tag).is_ok()
        } else {
            false
        }
    }

    /// As the server, send a challenge to the client and validate their response.
    pub async fn server_handshake<T: AsyncRead + AsyncWrite + Unpin>(
        &self,
        stream: &mut Delimited<T>,
    ) -> Result<()> {
        let challenge = Uuid::new_v4();
        stream.send(ServerMessage::Challenge(challenge)).await?;
        match stream.recv_timeout().await? {
            Some(ClientMessage::Authenticate(tag)) => {
                ensure!(self.validate(&challenge, &tag), "invalid secret");
                Ok(())
            }
            _ => bail!("server requires secret, but no secret was provided"),
        }
    }

    /// As the client, answer a challenge to attempt to authenticate with the server.
    pub async fn client_handshake<T: AsyncRead + AsyncWrite + Unpin>(
        &self,
        stream: &mut Delimited<T>,
    ) -> Result<()> {
        let challenge = match stream.recv_timeout().await? {
            Some(ServerMessage::Challenge(challenge)) => challenge,
            _ => bail!("expected authentication challenge, but no secret was required"),
        };
        let tag = self.answer(&challenge);
        stream.send(ClientMessage::Authenticate(tag)).await?;
        Ok(())
    }
}

```

### Core Architecture Module: `src/client.rs`
```
//! Client implementation for the `bore` service.

use std::sync::Arc;

use anyhow::{bail, Context, Result};
use tokio::{io::AsyncWriteExt, net::TcpStream, time::timeout};
use tracing::{error, info, info_span, warn, Instrument};
use uuid::Uuid;

use crate::auth::Authenticator;
use crate::shared::{ClientMessage, Delimited, ServerMessage, CONTROL_PORT, NETWORK_TIMEOUT};

/// State structure for the client.
pub struct Client {
    /// Control connection to the server.
    conn: Option<Delimited<TcpStream>>,

    /// Destination address of the server.
    to: String,

    // Local host that is forwarded.
    local_host: String,

    /// Local port that is forwarded.
    local_port: u16,

    /// Port that is publicly available on the remote.
    remote_port: u16,

    /// Optional secret used to authenticate clients.
    auth: Option<Authenticator>,
}

impl Client {
    /// Create a new client.
    pub async fn new(
        local_host: &str,
        local_port: u16,
        to: &str,
        port: u16,
        secret: Option<&str>,
    ) -> Result<Self> {
        let mut stream = Delimited::new(connect_with_timeout(to, CONTROL_PORT).await?);
        let auth = secret.map(Authenticator::new);
        if let Some(auth) = &auth {
            auth.client_handshake(&mut stream).await?;
        }

        stream.send(ClientMessage::Hello(port)).await?;
        let remote_port = match stream.recv_timeout().await? {
            Some(ServerMessage::Hello(remote_port)) => remote_port,
            Some(ServerMessage::Error(message)) => bail!("server error: {message}"),
            Some(ServerMessage::Challenge(_)) => {
                bail!("server requires authentication, but no client secret was provided");
            }
            Some(_) => bail!("unexpected initial non-hello message"),
            None => bail!("unexpected EOF"),
        };
        info!(remote_port, "connected to server");
        info!("listening at {to}:{remote_port}");

        Ok(Client {
            conn: Some(stream),
            to: to.to_string(),
            local_host: local_host.to_string(),
            local_port,
            remote_port,
            auth,
        })
    }

    /// Returns the port publicly available on the remote.
    pub fn remote_port(&self) -> u16 {
        self.remote_port
    }

    /// Start the client, listening for new connections.
    pub async fn listen(mut self) -> Result<()> {
        let mut conn = self.conn.take().unwrap();
        let this = Arc::new(self);
        loop {
            match conn.recv().await? {
                Some(ServerMessage::Hello(_)) => warn!("unexpected hello"),
                Some(ServerMessage::Challenge(_)) => warn!("unexpected challenge"),
                Some(ServerMessage::Heartbeat) => (),
                Some(ServerMessage::Connection(id)) => {
                    let this = Arc::clone(&this);
                    tokio::spawn(
                        async move {
                            info!("new connection");
                            match this.handle_connection(id).await {
                                Ok(_) => info!("connection exited"),
                                Err(err) => warn!(%err, "connection exited with error"),
                            }
                        }
                        .instrument(info_span!("proxy", %id)),
                    );
                }
                Some(ServerMessage::Error(err)) => error!(%err, "server error"),
                None => return Ok(()),
            }
        }
    }

    async fn handle_connection(&self, id: Uuid) -> Result<()> {
        let mut remote_conn =
            Delimited::new(connect_with_timeout(&self.to[..], CONTROL_PORT).await?);
        if let Some(auth) = &self.auth {
            auth.client_handshake(&mut remote_conn).await?;
        }
        remote_conn.send(ClientMessage::Accept(id)).await?;
        let mut local_conn = connect_with_timeout(&self.local_host, self.local_port).await?;
        let mut parts = remote_conn.into_parts();
        debug_assert!(parts.write_buf.is_empty(), "framed write buffer not empty");
        local_conn.write_all(&parts.read_buf).await?; // mostly of the cases, this will be empty
        tokio::io::copy_bidirectional(&mut local_conn, &mut parts.io).await?;
        Ok(())
    }
}

async fn connect_with_timeout(to: &str, port: u16) -> Result<TcpStream> {
    match timeout(NETWORK_TIMEOUT, TcpStream::connect((to, port))).await {
        Ok(res) => res,
        Err(err) => Err(err.into()),
    }
    .with_context(|| format!("could not connect to {to}:{port}"))
}

```

### Core Architecture Module: `src/lib.rs`
```
//! A modern, simple TCP tunnel in Rust that exposes local ports to a remote
//! server, bypassing standard NAT connection firewalls.
//!
//! This is the library crate documentation. If you're looking for usage
//! information about the binary, see the command below.
//!
//! ```shell
//! $ bore help
//! ```
//!
//! There are two components to the crate, offering implementations of the
//! server network daemon and client local forwarding proxy. Both are public
//! members and can be run programmatically with a Tokio 1.0 runtime.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod auth;
pub mod client;
pub mod server;
pub mod shared;

```

### Core Architecture Module: `src/main.rs`
```
use std::net::IpAddr;

use anyhow::Result;
use bore_cli::{client::Client, server::Server};
use clap::{error::ErrorKind, CommandFactory, Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(author, version, about)]
struct Args {
    #[clap(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Starts a local proxy to the remote server.
    Local {
        /// The local port to expose.
        #[clap(env = "BORE_LOCAL_PORT")]
        local_port: u16,

        /// The local host to expose.
        #[clap(short, long, value_name = "HOST", default_value = "localhost")]
        local_host: String,

        /// Address of the remote server to expose local ports to.
        #[clap(short, long, env = "BORE_SERVER")]
        to: String,

        /// Optional port on the remote server to select.
        #[clap(short, long, default_value_t = 0)]
        port: u16,

        /// Optional secret for authentication.
        #[clap(short, long, env = "BORE_SECRET", hide_env_values = true)]
        secret: Option<String>,
    },

    /// Runs the remote proxy server.
    Server {
        /// Minimum accepted TCP port number.
        #[clap(long, default_value_t = 1024, env = "BORE_MIN_PORT")]
        min_port: u16,

        /// Maximum accepted TCP port number.
        #[clap(long, default_value_t = 65535, env = "BORE_MAX_PORT")]
        max_port: u16,

        /// Optional secret for authentication.
        #[clap(short, long, env = "BORE_SECRET", hide_env_values = true)]
        secret: Option<String>,

        /// IP address to bind to, clients must reach this.
        #[clap(long, default_value = "0.0.0.0")]
        bind_addr: IpAddr,

        /// IP address where tunnels will listen on, defaults to --bind-addr.
        #[clap(long)]
        bind_tunnels: Option<IpAddr>,
    },
}

#[tokio::main]
async fn run(command: Command) -> Result<()> {
    match command {
        Command::Local {
            local_host,
            local_port,
            to,
            port,
            secret,
        } => {
            let client = Client::new(&local_host, local_port, &to, port, secret.as_deref()).await?;
            client.listen().await?;
        }
        Command::Server {
            min_port,
            max_port,
            secret,
            bind_addr,
            bind_tunnels,
        } => {
            let port_range = min_port..=max_port;
            if port_range.is_empty() {
                Args::command()
                    .error(ErrorKind::InvalidValue, "port range is empty")
                    .exit();
            }
            let mut server = Server::new(port_range, secret.as_deref());
            server.set_bind_addr(bind_addr);
            server.set_bind_tunnels(bind_tunnels.unwrap_or(bind_addr));
            server.listen().await?;
        }
    }

    Ok(())
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    run(Args::parse().command)
}

```

### Core Architecture Module: `src/server.rs`
```
//! Server implementation for the `bore` service.

use std::net::{IpAddr, Ipv4Addr};
use std::{io, ops::RangeInclusive, sync::Arc, time::Duration};

use anyhow::Result;
use dashmap::DashMap;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{sleep, timeout};
use tracing::{info, info_span, warn, Instrument};
use uuid::Uuid;

use crate::auth::Authenticator;
use crate::shared::{ClientMessage, Delimited, ServerMessage, CONTROL_PORT};

/// State structure for the server.
pub struct Server {
    /// Range of TCP ports that can be forwarded.
    port_range: RangeInclusive<u16>,

    /// Optional secret used to authenticate clients.
    auth: Option<Authenticator>,

    /// Concurrent map of IDs to incoming connections.
    conns: Arc<DashMap<Uuid, TcpStream>>,

    /// IP address where the control server will bind to.
    bind_addr: IpAddr,

    /// IP address where tunnels will listen on.
    bind_tunnels: IpAddr,
}

impl Server {
    /// Create a new server with a specified minimum port number.
    pub fn new(port_range: RangeInclusive<u16>, secret: Option<&str>) -> Self {
        assert!(!port_range.is_empty(), "must provide at least one port");
        Server {
            port_range,
            conns: Arc::new(DashMap::new()),
            auth: secret.map(Authenticator::new),
            bind_addr: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            bind_tunnels: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
        }
    }

    /// Set the IP address where tunnels will listen on.
    pub fn set_bind_addr(&mut self, bind_addr: IpAddr) {
        self.bind_addr = bind_addr;
    }

    /// Set the IP address where the control server will bind to.
    pub fn set_bind_tunnels(&mut self, bind_tunnels: IpAddr) {
        self.bind_tunnels = bind_tunnels;
    }

    /// Start the server, listening for new connections.
    pub async fn listen(self) -> Result<()> {
        let this = Arc::new(self);
        let listener = TcpListener::bind((this.bind_addr, CONTROL_PORT)).await?;
        info!(addr = ?this.bind_addr, "server listening");

        loop {
            let (stream, addr) = listener.accept().await?;
            let this = Arc::clone(&this);
            tokio::spawn(
                async move {
                    info!("incoming connection");
                    if let Err(err) = this.handle_connection(stream).await {
                        warn!(%err, "connection exited with error");
                    } else {
                        info!("connection exited");
                    }
                }
                .instrument(info_span!("control", ?addr)),
            );
        }
    }

    async fn create_listener(&self, port: u16) -> Result<TcpListener, &'static str> {
        let try_bind = |port: u16| async move {
            TcpListener::bind((self.bind_tunnels, port))
                .await
                .map_err(|err| match err.kind() {
                    io::ErrorKind::AddrInUse => "port already in use",
                    io::ErrorKind::PermissionDenied => "permission denied",
                    _ => "failed to bind to port",
                })
        };
        if port > 0 {
            // Client requests a specific port number.
            if !self.port_range.contains(&port) {
                return Err("client port number not in allowed range");
            }
            try_bind(port).await
        } else {
            // Client requests any available port in range.
            //
            // In this case, we bind to 150 random port numbers. We choose this value because in
            // order to find a free port with probability at least 1-δ, when ε proportion of the
            // ports are currently available, it suffices to check approximately -2 ln(δ) / ε
            // independently and uniformly chosen ports (up to a second-order term in ε).
            //
            // Checking 150 times gives us 99.999% success at utilizing 85% of ports under these
            // conditions, when ε=0.15 and δ=0.00001.
            for _ in 0..150 {
                let port = fastrand::u16(self.port_range.clone());
                match try_bind(port).await {
                    Ok(listener) => return Ok(listener),
                    Err(_) => continue,
                }
            }
            Err("failed to find an available port")
        }
    }

    async fn handle_connection(&self, stream: TcpStream) -> Result<()> {
        let mut stream = Delimited::new(stream);
        if let Some(auth) = &self.auth {
            if let Err(err) = auth.server_handshake(&mut stream).await {
                warn!(%err, "server handshake failed");
                stream.send(ServerMessage::Error(err.to_string())).await?;
                return Ok(());
            }
        }

        match stream.recv_timeout().await? {
            Some(ClientMessage::Authenticate(_)) => {
                warn!("unexpected authenticate");
                Ok(())
            }
            Some(ClientMessage::Hello(port)) => {
                let listener = match self.create_listener(port).await {
                    Ok(listener) => listener,
                    Err(err) => {
                        stream.send(ServerMessage::Error(err.into())).await?;
                        return Ok(());
                    }
                };
                let host = listener.local_addr()?.ip();
                let port = listener.local_addr()?.port();
                info!(?host, ?port, "new client");
                stream.send(ServerMessage::Hello(port)).await?;

                loop {
                    if stream.send(ServerMessage::Heartbeat).await.is_err() {
                        // Assume that the TCP connection has been dropped.
                        return Ok(());
                    }
                    const TIMEOUT: Duration = Duration::from_millis(500);
                    if let Ok(result) = timeout(TIMEOUT, listener.accept()).await {
                        let (stream2, addr) = result?;
                        info!(?addr, ?port, "new connection");

                        let id = Uuid::new_v4();
                        let conns = Arc::clone(&self.conns);

                        conns.insert(id, stream2);
                        tokio::spawn(async move {
                            // Remove stale entries to avoid memory leaks.
                            sleep(Duration::from_secs(10)).await;
                            if conns.remove(&id).is_some() {
                                warn!(%id, "removed stale connection");
                            }
                        });
                        stream.send(ServerMessage::Connection(id)).await?;
                    }
                }
            }
            Some(ClientMessage::Accept(id)) => {
                info!(%id, "forwarding connection");
                match self.conns.remove(&id) {
                    Some((_, mut stream2)) => {
                        let mut parts = stream.into_parts();
                        debug_assert!(parts.write_buf.is_empty(), "framed write buffer not empty");
                        stream2.write_all(&parts.read_buf).await?;
                        tokio::io::copy_bidirectional(&mut parts.io, &mut stream2).await?;
                    }
                    None => warn!(%id, "missing connection"),
                }
                Ok(())
            }
            None => Ok(()),
        }
    }
}

```

### Core Architecture Module: `src/shared.rs`
```
//! Shared data structures, utilities, and protocol definitions.

use std::time::Duration;

use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::time::timeout;
use tokio_util::codec::{AnyDelimiterCodec, Framed, FramedParts};
use tracing::trace;
use uuid::Uuid;

/// TCP port used for control connections with the server.
pub const CONTROL_PORT: u16 = 7835;

/// Maximum byte length for a JSON frame in the stream.
pub const MAX_FRAME_LENGTH: usize = 256;

/// Timeout for network connections and initial protocol messages.
pub const NETWORK_TIMEOUT: Duration = Duration::from_secs(3);

/// A message from the client on the control connection.
#[derive(Debug, Serialize, Deserialize)]
pub enum ClientMessage {
    /// Response to an authentication challenge from the server.
    Authenticate(String),

    /// Initial client message specifying a port to forward.
    Hello(u16),

    /// Accepts an incoming TCP connection, using this stream as a proxy.
    Accept(Uuid),
}

/// A message from the server on the control connection.
#[derive(Debug, Serialize, Deserialize)]
pub enum ServerMessage {
    /// Authentication challenge, sent as the first message, if enabled.
    Challenge(Uuid),

    /// Response to a client's initial message, with actual public port.
    Hello(u16),

    /// No-op used to test if the client is still reachable.
    Heartbeat,

    /// Asks the client to accept a forwarded TCP connection.
    Connection(Uuid),

    /// Indicates a server error that terminates the connection.
    Error(String),
}

/// Transport stream with JSON frames delimited by null characters.
pub struct Delimited<U>(Framed<U, AnyDelimiterCodec>);

impl<U: AsyncRead + AsyncWrite + Unpin> Delimited<U> {
    /// Construct a new delimited stream.
    pub fn new(stream: U) -> Self {
        let codec = AnyDelimiterCodec::new_with_max_length(vec![0], vec![0], MAX_FRAME_LENGTH);
        Self(Framed::new(stream, codec))
    }

    /// Read the next null-delimited JSON instruction from a stream.
    pub async fn recv<T: DeserializeOwned>(&mut self) -> Result<Option<T>> {
        trace!("waiting to receive json message");
        if let Some(next_message) = self.0.next().await {
            let byte_message = next_message.context("frame error, invalid byte length")?;
            let serialized_obj =
                serde_json::from_slice(&byte_message).context("unable to parse message")?;
            Ok(serialized_obj)
        } else {
            Ok(None)
        }
    }

    /// Read the next null-delimited JSON instruction, with a default timeout.
    ///
    /// This is useful for parsing the initial message of a stream for handshake or
    /// other protocol purposes, where we do not want to wait indefinitely.
    pub async fn recv_timeout<T: DeserializeOwned>(&mut self) -> Result<Option<T>> {
        timeout(NETWORK_TIMEOUT, self.recv())
            .await
            .context("timed out waiting for initial message")?
    }

    /// Send a null-terminated JSON instruction on a stream.
    pub async fn send<T: Serialize>(&mut self, msg: T) -> Result<()> {
        trace!("sending json message");
        self.0.send(serde_json::to_string(&msg)?).await?;
        Ok(())
    }

    /// Consume this object, returning current buffers and the inner transport.
    pub fn into_parts(self) -> FramedParts<U, AnyDelimiterCodec> {
        self.0.into_parts()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #32** (2022-04-22): **Unbounded byte buffer in read_until**
  *Symptoms*: calling read_until reads all until it reaches null byte. it will cause memory leaks.  Use [AnyDelimiterCodec](https://docs.rs/tokio-util/0.7.1/tokio_util/codec/struct.AnyDelimiterCodec.html) ```rust let mut framed_stream = Framed::new(connect_with_timeout(to, CONTROL_PORT).await?, AnyDelimiterCodec::new_with_max_length(vec![0], vec![0], 200)); ```  ref: https://github.com/ekzhang/bore/blob/e25f021505fdc3f4e7f5f32c1a4d4b865bd84357/src/shared.rs#L73
  **Post-Mortem & Fix Analysis**:
  > Can you give an example of a memory leak? I don't believe the line you linked leaks memory, since `buf` is dropped properly regardless of what happens in `read_util`.  Edit: Upon rereading I understand what you're saying. This isn't a memory leak, but an attacker could potentially send an unbounded stream of bytes without including the null byte. This is indeed a minor security issue. I don't believe your suggested solution works because the stream needs to support both `read_until` and normal reading after the initial message, but we should look for a way to limit the length of the `read_until` call.
  > Framed manages read_until via `.next` call.   it also can set limit to all upcoming frames and fails with `AnyDelimiterCodecError` if length is overflowed.  Here is my approach https://github.com/ekzhang/bore/pull/33. 
  > > Framed manages read_until via `.next` call. it also can set limit to all upcoming frames and fails with `AnyDelimiterCodecError` if length is overflowed. >  > Here is my approach #33.  nice, looks clean

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

### Incident Patch 1: `00a735a8` (2026-02-04)
**Commit Message**: updated slab (fixes out-of-bound access in get_disjoint_mut) (#171)

https://github.com/tokio-rs/slab/pull/152

**File**: `Cargo.lock` (modified, +3/-6)
```diff
@@ -1,6 +1,6 @@
 # This file is automatically @generated by Cargo.
 # It is not intended for manual editing.
-version = 3
+version = 4
 
 [[package]]
 name = "addr2line"
@@ -748,12 +748,9 @@ dependencies = [
 
 [[package]]
 name = "slab"
-version = "0.4.8"
+version = "0.4.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6528351c9bc8ab22353f9d776db39a20288e8d6c37ef8cfe3317cf875eecfc2d"
-dependencies = [
- "autocfg",
-]
+checksum = "7a2ae44ef20feb57a68b23d846850f861394c2e02dc425a50098ae8c90267589"
 
 [[package]]
 name = "smallvec"
```

---

### Incident Patch 2: `8ad7ee21` (2025-04-14)
**Commit Message**: Fix actions/cache action deprecation

**File**: `.github/workflows/mean_bean_deploy.yml` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ jobs:
 
       # Cache files between builds
       - name: Setup | Cache Cargo
-        uses: actions/cache@v2
+        uses: actions/cache@v4
         with:
           path: |
             ~/.cargo/registry
```

---

### Incident Patch 3: `03f2e53f` (2025-04-14)
**Commit Message**: docs: update installation instructions for Linux (#152)

* docs: update installation instructions for Linux

* Nits

* More nits

---------

Co-authored-by: Eric Zhang <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +29/-1)
```diff
@@ -23,20 +23,48 @@ Similar to [localtunnel](https://github.com/localtunnel/localtunnel) and [ngrok]
 
 ## Installation
 
-If you're on macOS, `bore` is packaged as a Homebrew core formula.
+### macOS
+
+`bore` is packaged as a Homebrew core formula.
 
 ```shell
 brew install bore-cli
 ```
 
+### Linux
+
+#### Arch Linux
+
+`bore` is available in the AUR as `bore`.
+
+```shell
+yay -S bore # or your favorite AUR helper
+```
+
+#### Gentoo Linux
+
+`bore` is available in the [gentoo-zh](https://github.com/microcai/gentoo-zh) overlay.
+
+```shell
+sudo eselect repository enable gentoo-zh
+sudo emerge --sync gentoo-zh
+sudo emerge net-proxy/bore
+```
+
+### Binary Distribution
+
 Otherwise, the easiest way to install bore is from prebuilt binaries. These are available on the [releases page](https://github.com/ekzhang/bore/releases) for macOS, Windows, and Linux. Just unzip the appropriate file for your platform and move the `bore` executable into a folder on your PATH.
 
+### Cargo
+
 You also can build `bore` from source using [Cargo](https://doc.rust-lang.org/cargo/), the Rust package manager. This command installs the `bore` binary at a user-accessible path.
 
 ```shell
 cargo install bore-cli
 ```
 
+### Docker
+
 We also publish versioned Docker images for each release. The image is built for an AMD 64-bit architecture. They're tagged with the specific version and allow you to run the statically-linked `bore` binary from a minimal "scratch" container.
 
 ```shell
```

---

### Incident Patch 4: `e1373572` (2025-04-14)
**Commit Message**: Fix tests and run cargo fmt

**File**: `tests/e2e_test.rs` (modified, +15/-2)
```diff
@@ -19,7 +19,15 @@ lazy_static! {
 
 /// Spawn the server, giving some time for the control port TcpListener to start.
 async fn spawn_server(secret: Option<&str>) {
-    tokio::spawn(Server::new(1024..=65535, secret).listen());
+    tokio::spawn(
+        Server::new(
+            1024..=65535,
+            secret,
+            "0.0.0.0".to_string(),
+            "0.0.0.0".to_string(),
+        )
+        .listen(),
+    );
     time::sleep(Duration::from_millis(50)).await;
 }
 
@@ -125,5 +133,10 @@ async fn very_long_frame() -> Result<()> {
 fn empty_port_range() {
     let min_port = 5000;
     let max_port = 3000;
-    let _ = Server::new(min_port..=max_port, None);
+    let _ = Server::new(
+        min_port..=max_port,
+        None,
+        "0.0.0.0".to_string(),
+        "0.0.0.0".to_string(),
+    );
 }
```

---

### Incident Patch 5: `b23beb98` (2025-01-10)
**Commit Message**: Fix Dockerfile (#151)

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM rust:alpine as builder
+FROM rust:alpine AS builder
 WORKDIR /home/rust/src
 RUN apk --no-cache add musl-dev
 COPY . .
```

---

### Incident Patch 6: `82acea34` (2024-06-11)
**Commit Message**: Fix CI runners (#118)

macos-latest has been switched to use arm64 mac instances

**File**: `.github/workflows/mean_bean_ci.yml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ jobs:
       matrix:
         channel: [stable]
         target:
-          - x86_64-apple-darwin
+          - aarch64-apple-darwin
 
     steps:
       - name: Setup | Checkout
```

---

### Incident Patch 7: `32a7233c` (2023-07-27)
**Commit Message**: Fix clippy lint on recent Rust versions

**File**: `tests/e2e_test.rs` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+#![allow(clippy::items_after_test_module)]
+
 use std::net::SocketAddr;
 use std::time::Duration;
 
```

---

### Incident Patch 8: `3ae14209` (2023-04-29)
**Commit Message**: Fix typo, Maxmium -> Maximum (#81)

Found via `codespell -L crate`

**File**: `src/shared.rs` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ use uuid::Uuid;
 /// TCP port used for control connections with the server.
 pub const CONTROL_PORT: u16 = 7835;
 
-/// Maxmium byte length for a JSON frame in the stream.
+/// Maximum byte length for a JSON frame in the stream.
 pub const MAX_FRAME_LENGTH: usize = 256;
 
 /// Timeout for network connections and initial protocol messages.
```

---

### Incident Patch 9: `931f2aa2` (2023-01-01)
**Commit Message**: Fix badge in README

See <https://github.com/badges/shields/issues/8671>.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # bore
 
-[![Build status](https://img.shields.io/github/workflow/status/ekzhang/bore/CI)](https://github.com/ekzhang/bore/actions)
+[![Build status](https://img.shields.io/github/actions/workflow/status/ekzhang/bore/ci.yml)](https://github.com/ekzhang/bore/actions)
 [![Crates.io](https://img.shields.io/crates/v/bore-cli.svg)](https://crates.io/crates/bore-cli)
 
 A modern, simple TCP tunnel in Rust that exposes local ports to a remote server, bypassing standard NAT connection firewalls. **That's all it does: no more, and no less.**
```

---

### Incident Patch 10: `e6136291` (2022-04-21)
**Commit Message**: Fix Windows cargo test (#35)

**File**: `src/server.rs` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ impl Server {
                     return Ok(());
                 }
                 info!(?port, "new client");
-                let listener = match TcpListener::bind(("::", port)).await {
+                let listener = match TcpListener::bind(("0.0.0.0", port)).await {
                     Ok(listener) => listener,
                     Err(_) => {
                         warn!(?port, "could not bind to local port");
```

**File**: `tests/e2e_test.rs` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ async fn spawn_client(secret: Option<&str>) -> Result<(TcpListener, SocketAddr)>
     let listener = TcpListener::bind("localhost:0").await?;
     let local_port = listener.local_addr()?.port();
     let client = Client::new("localhost", local_port, "localhost", 0, secret).await?;
-    let remote_addr = ([0, 0, 0, 0], client.remote_port()).into();
+    let remote_addr = ([127, 0, 0, 1], client.remote_port()).into();
     tokio::spawn(client.listen());
     Ok((listener, remote_addr))
 }
```

---

### Incident Patch 11: `634af3f6` (2022-04-11)
**Commit Message**: Fix CI Docker build and bump version to 0.2.3

**File**: `.github/workflows/docker.yml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ jobs:
         id: docker_build
         uses: docker/build-push-action@v2
         with:
-          platforms: linux/amd64,linux/arm64,linux/arm/v7
+          platforms: linux/amd64,linux/arm64
           push: true
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
```

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ dependencies = [
 
 [[package]]
 name = "bore-cli"
-version = "0.2.2"
+version = "0.2.3"
 dependencies = [
  "anyhow",
  "clap",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "bore-cli"
-version = "0.2.2"
+version = "0.2.3"
 authors = ["Eric Zhang <ekzhang1@gmail.com>"]
 license = "MIT"
 description = "A modern, simple TCP tunnel in Rust that exposes local ports to a remote server, bypassing standard NAT connection firewalls."
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -29,7 +29,7 @@ You can build the `bore` CLI command from source using [Cargo](https://doc.rust-
 cargo install bore-cli
 ```
 
-We also publish versioned Docker images for each release. Each image is built for AMD 64-bit, Arm 64-bit, and Armv7 architectures. They're tagged with the specific version and allow you to run the statically-linked `bore` binary from a minimal "scratch" container.
+We also publish versioned Docker images for each release. Each image is built for AMD 64-bit and Arm 64-bit architectures. They're tagged with the specific version and allow you to run the statically-linked `bore` binary from a minimal "scratch" container.
 
 ```shell
 docker run -it --init --rm --network host ekzhang/bore <ARGS>
@@ -52,7 +52,7 @@ You can optionally pass in a `--port` option to pick a specific port on the remo
 The full options are shown below.
 
 ```shell
-bore-local 0.2.2
+bore-local 0.2.3
 Starts a local proxy to the remote server
 
 USAGE:
@@ -82,7 +82,7 @@ That's all it takes! After the server starts running at a given address, you can
 The full options for the `bore server` command are shown below.
 
 ```shell
-bore-server 0.2.2
+bore-server 0.2.3
 Runs the remote proxy server
 
 USAGE:
```

---

### Incident Patch 12: `c154a846` (2022-04-11)
**Commit Message**: Add a Dockerfile for building a container image (#8)

* Add a Dockerfile

* Reduce image size from ~75MB to ~6MB

* Add Dockerignore and README documentation

* Add Docker build action to CI

Co-authored-by: Eric Zhang <[REDACTED_EMAIL]>

**File**: `.dockerignore` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+/target
```

**File**: `.github/workflows/docker.yml` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+name: Docker
+
+on:
+  push:
+    tags:
+      - "v*.*.*"
+
+jobs:
+  build_deploy:
+    name: Build and Deploy
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v2
+
+      - name: Docker meta
+        id: meta
+        uses: docker/metadata-action@v3
+        with:
+          images: ekzhang/bore
+          tags: |
+            type=semver,pattern={{version}}
+            type=semver,pattern={{major}}.{{minor}}
+
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v1
+        with:
+          platforms: arm64
+
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v1
+
+      - name: Login to DockerHub
+        uses: docker/login-action@v1
+        with:
+          username: ${{ secrets.DOCKERHUB_USERNAME }}
+          password: ${{ secrets.DOCKERHUB_TOKEN }}
+
+      - name: Build and push
+        id: docker_build
+        uses: docker/build-push-action@v2
+        with:
+          platforms: linux/amd64,linux/arm64,linux/arm/v7
+          push: true
+          tags: ${{ steps.meta.outputs.tags }}
+          labels: ${{ steps.meta.outputs.labels }}
+
+      - name: Image digest
+        run: echo ${{ steps.docker_build.outputs.digest }}
```

**File**: `Dockerfile` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+FROM rust:alpine as builder
+WORKDIR /home/rust/src
+RUN apk --no-cache add musl-dev
+COPY . .
+RUN cargo install --path .
+
+FROM scratch
+COPY --from=builder /usr/local/cargo/bin/bore .
+USER 1000:1000
+ENTRYPOINT ["./bore"]
```

**File**: `README.md` (modified, +16/-0)
```diff
@@ -21,6 +21,22 @@ Similar to [localtunnel](https://github.com/localtunnel/localtunnel) and [ngrok]
 
 (`bore` totals less than 400 lines of safe, async Rust code and is trivial to set up — just run a single binary for the client and server.)
 
+## Installation
+
+You can build the `bore` CLI command from source using [Cargo](https://crates.io/), which is bundled with the latest stable Rust toolchain. This command and will install the release `bore` binary at a user-accessible path.
+
+```shell
+cargo install bore-cli
+```
+
+If you have Docker installed on your computer, you can alternatively run the `bore` binary from a minimal "scratch" container.
+
+```shell
+docker run -it --init --rm --network host ekzhang/bore <ARGS>
+```
+
+We publish versioned Docker images for each release, in addition to the `latest` tag. Each image is built for AMD 64-bit, Arm 64-bit, and Armv7 architectures.
+
 ## Detailed Usage
 
 This section describes detailed usage for the `bore` CLI command.
```

---

### Incident Patch 13: `d4e7c429` (2022-04-10)
**Commit Message**: Minor grammar fix. (#5)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ OPTIONS:
 
 ### Self-Hosting
 
-As mentioned in the startup instructions, there is an public instance of the `bore` server running at `bore.pub`. However, if you want to self-host `bore` on your own network, you can do so with the following command:
+As mentioned in the startup instructions, there is a public instance of the `bore` server running at `bore.pub`. However, if you want to self-host `bore` on your own network, you can do so with the following command:
 
 ```shell
 bore server
```

---

### Incident Patch 14: `e84bd34b` (2022-04-08)
**Commit Message**: Fix failing doc test

**File**: `src/auth.rs` (modified, +3/-3)
```diff
@@ -28,13 +28,13 @@ impl Authenticator {
     /// Validate a reply to a challenge.
     ///
     /// ```
-    /// use uuid:Uuid;
-    /// use crate::auth::Authenticator;
+    /// use bore_cli::auth::Authenticator;
+    /// use uuid::Uuid;
     ///
     /// let auth = Authenticator::new("secret");
     /// let challenge = Uuid::new_v4();
     ///
-    /// assert!(auth.validate(&challenge, auth.answer(&challenge)));
+    /// assert!(auth.validate(&challenge, &auth.answer(&challenge)));
     /// assert!(!auth.validate(&challenge, "wrong answer"));
     /// ```
     pub fn validate(&self, challenge: &Uuid, tag: &str) -> bool {
```

---

### Incident Patch 15: `f00281f2` (2022-04-06)
**Commit Message**: Fix minor bug in server error handling

**File**: `src/server.rs` (modified, +5/-1)
```diff
@@ -73,7 +73,11 @@ impl Server {
                     Ok(listener) => listener,
                     Err(_) => {
                         warn!(?port, "could not bind to local port");
-                        send_json(&mut stream, "port already in use").await?;
+                        send_json(
+                            &mut stream,
+                            ServerMessage::Error("port already in use".into()),
+                        )
+                        .await?;
                         return Ok(());
                     }
                 };
```

#### Recent Merged Pull Requests:
- **PR #201** (closed): routing support (@jmanm)
- **PR #197** (closed): Authentication changes (@jmanm)
- **PR #193** (closed): build(deps): Update dependencies (@yonas)
- **PR #192** (closed): Add QR rendering to bore local (@jackcrane)
- **PR #173** (closed): Dev (@0xKaeruIO)
- **PR #172** (closed): fix(): Connection stability issues with auto-reconnect and keep-alive (@Rastrian)
- **PR #171** (2026-02-04): Updated slab (fixes out-of-bound access in get_disjoint_mut) (@ink-splatters)
- **PR #168** (closed): Enable json logging (@riccio8)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
