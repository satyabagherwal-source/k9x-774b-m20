# Forensic Learning Record (Deep Inspection): build-trust/ockam

> **Canonical Artifact**: `07_PROJECT_LEARNING/build-trust-ockam-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/build-trust/ockam](https://github.com/build-trust/ockam))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:43:19.494Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `build-trust/ockam`
- **Description**: Orchestrate end-to-end encryption, cryptographic identities, mutual authentication, and authorization policies between distributed applications – at massive scale.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4635 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `implementations/rust/examples/get_started/examples/02-worker.rs`
```
// This node creates a worker, sends it a message, and receives a reply.

use hello_ockam::Echoer;
use ockam::{node, Context, Result};

#[ockam::node]
async fn main(ctx: Context) -> Result<()> {
    // Create a node with default implementations
    let mut node = node(ctx).await?;

    // Start a worker, of type Echoer, at address "echoer"
    node.start_worker("echoer", Echoer)?;

    // Send a message to the worker at address "echoer".
    node.send("echoer", "Hello Ockam!".to_string()).await?;

    // Wait to receive a reply and print it.
    let reply = node.receive::<String>().await?;
    println!("App Received: {}", reply.into_body()?); // should print "Hello Ockam!"

    // Stop all workers, stop the node, cleanup and return.
    node.shutdown().await
}

```

### Core Architecture Module: `implementations/rust/examples/mitm_node/src/tcp_interceptor/transport/lifecycle.rs`
```
use ockam_core::{Result, TryClone};
use ockam_node::Context;

use crate::tcp_interceptor::{TcpMitmRegistry, TcpMitmTransport};

impl TcpMitmTransport {
    pub fn create(ctx: &Context) -> Result<Self> {
        let tcp = Self {
            ctx: ctx.try_clone()?,
            registry: Default::default(),
        };
        Ok(tcp)
    }
}

impl TcpMitmTransport {
    pub fn ctx(&self) -> &Context {
        &self.ctx
    }

    pub fn registry(&self) -> &TcpMitmRegistry {
        &self.registry
    }
}

```

### Core Architecture Module: `implementations/rust/examples/mitm_node/src/tcp_interceptor/workers/listener.rs`
```
use crate::tcp_interceptor::{Role, TcpMitmProcessor, TcpMitmRegistry, TcpMitmTransport};
use ockam_core::{async_trait, compat::net::SocketAddr};
use ockam_core::{Address, Processor, Result};
use ockam_node::Context;
use ockam_transport_core::TransportError;
use tokio::net::{TcpListener, TcpStream};
use tracing::debug;

pub(crate) struct TcpMitmListenProcessor {
    inner: TcpListener,
    registry: TcpMitmRegistry,
    tcp: TcpMitmTransport,
    target_addr: SocketAddr,
}

impl TcpMitmListenProcessor {
    pub(crate) async fn start(
        ctx: &Context,
        registry: TcpMitmRegistry,
        addr: SocketAddr,
        tcp: TcpMitmTransport,
        target_addr: SocketAddr,
    ) -> Result<(SocketAddr, Address)> {
        debug!("Binding TcpListener to {}", addr);
        let inner = TcpListener::bind(addr).await.map_err(TransportError::from)?;
        let saddr = inner.local_addr().map_err(TransportError::from)?;

        let address = Address::random_tagged("TcpListenProcessor");

        let processor = Self {
            inner,
            registry,
            tcp,
            target_addr,
        };

        ctx.start_processor(address.clone(), processor)?;

        Ok((saddr, address))
    }
}

#[async_trait]
impl Processor for TcpMitmListenProcessor {
    type Context = Context;

    async fn initialize(&mut self, ctx: &mut Context) -> Result<()> {
        self.registry.add_listener(ctx.primary_address());

        Ok(())
    }

    async fn shutdown(&mut self, ctx: &mut Self::Context) -> Result<()> {
        self.registry.remove_listener(ctx.primary_address());

        Ok(())
    }

    async fn process(&mut self, ctx: &mut Self::Context) -> Result<bool> {
        debug!("Waiting for incoming TCP connection...");

        let (stream, _peer) = self.inner.accept().await.map_err(TransportError::from)?;
        debug!("TCP connection accepted");

        // Connection to the target
        let (target_read_half, target_write_half) = TcpStream::connect(self.target_addr).await.unwrap().into_split();

        // Connection from the source
        let (read_half, write_half) = stream.into_split();

        let address1 = Address::random_tagged("receiver_read_target");
        let address2 = Address::random_tagged("receiver_read_source");

        // Forward from the target connection to the source
        TcpMitmProcessor::start(
            ctx,
            Role::ReadTarget,
            address1.clone(),
            address2.clone(),
            target_read_half,
            write_half,
            self.registry.clone(),
        )?;

        // Forward from the source connection to the target
        TcpMitmProcessor::start(
            ctx,
            Role::ReadSource,
            address2,
            address1,
            read_half,
            target_write_half,
            self.registry.clone(),
        )?;

        Ok(true)
    }
}

```

### Core Architecture Module: `implementations/rust/examples/mitm_node/src/tcp_interceptor/workers/mod.rs`
```
mod listener;
mod processor;

pub(crate) use listener::*;
pub(crate) use processor::*;

```

### Core Architecture Module: `implementations/rust/examples/mitm_node/src/tcp_interceptor/workers/processor.rs`
```
use crate::tcp_interceptor::{Role, TcpMitmRegistry};
use ockam_core::compat::sync::Arc;
use ockam_core::{async_trait, Address, AllowAll};
use ockam_core::{Processor, Result};
use ockam_node::compat::asynchronous::Mutex;
use ockam_node::Context;
use tokio::io::AsyncWriteExt;
use tokio::net::tcp::OwnedWriteHalf;
use tokio::{io::AsyncReadExt, net::tcp::OwnedReadHalf};
use tracing::debug;

pub(crate) struct TcpMitmProcessor {
    address_of_other_processor: Address,
    role: Role,
    read_half: OwnedReadHalf,
    write_half: Arc<Mutex<OwnedWriteHalf>>,
    registry: TcpMitmRegistry,
}

impl TcpMitmProcessor {
    fn new(
        address_of_other_processor: Address,
        role: Role,
        read_half: OwnedReadHalf,
        write_half: Arc<Mutex<OwnedWriteHalf>>,
        registry: TcpMitmRegistry,
    ) -> Self {
        Self {
            address_of_other_processor,
            role,
            read_half,
            write_half,
            registry,
        }
    }

    pub fn start(
        ctx: &Context,
        role: Role,
        address: Address,
        address_of_other_processor: Address,
        read_half: OwnedReadHalf,
        write_half: OwnedWriteHalf,
        registry: TcpMitmRegistry,
    ) -> Result<()> {
        let write_half = Arc::new(Mutex::new(write_half));

        let receiver = Self::new(address_of_other_processor, role, read_half, write_half, registry);

        ctx.start_processor_with_access_control(address, receiver, AllowAll, AllowAll)?;

        Ok(())
    }
}

#[async_trait]
impl Processor for TcpMitmProcessor {
    type Context = Context;

    async fn initialize(&mut self, ctx: &mut Context) -> Result<()> {
        self.registry
            .add_processor(ctx.primary_address(), self.role, self.write_half.clone());

        debug!("Initialize {}", ctx.primary_address());

        Ok(())
    }

    async fn shutdown(&mut self, ctx: &mut Self::Context) -> Result<()> {
        self.registry.remove_processor(ctx.primary_address());

        debug!("Shutdown {}", ctx.primary_address());

        Ok(())
    }

    async fn process(&mut self, ctx: &mut Context) -> Result<bool> {
        let mut buf = vec![0; 1024];

        let len = match self.read_half.read(&mut buf).await {
            Ok(l) if l != 0 => l,
            _ => {
                debug!("Connection was closed; dropping stream {}", ctx.primary_address());

                let _ = ctx.stop_address(&self.address_of_other_processor);

                return Ok(false);
            }
        };

        match self.write_half.lock().await.write_all(&buf[..len]).await {
            Ok(_) => {
                debug!("Forwarded {} bytes from {}", len, ctx.primary_address());
            }
            _ => {
                debug!("Connection was closed; dropping stream {}", ctx.primary_address());

                let _ = ctx.stop_address(&self.address_of_other_processor);

                return Ok(false);
            }
        }

        Ok(true)
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam/src/remote/lifecycle.rs`
```
use crate::remote::{Addresses, RemoteRelay, RemoteRelayInfo, RemoteRelayOptions};
use crate::Context;
use ockam_core::compat::string::{String, ToString};
use ockam_core::compat::sync::Arc;
use ockam_core::flow_control::FlowControlId;
use ockam_core::{
    AllowAll, AllowSourceAddress, DenyAll, Mailbox, Mailboxes, OutgoingAccessControl, Result, Route,
};
use ockam_node::WorkerBuilder;
use tracing::debug;

#[derive(Clone, Copy)]
pub(super) enum RelayType {
    Static,
    Ephemeral,
}

impl RelayType {
    pub fn str(&self) -> &'static str {
        match self {
            RelayType::Static => "static",
            RelayType::Ephemeral => "ephemeral",
        }
    }
}

impl RemoteRelay {
    fn mailboxes(
        addresses: Addresses,
        outgoing_access_control: Arc<dyn OutgoingAccessControl>,
    ) -> Mailboxes {
        let main_internal = Mailbox::new(
            addresses.main_internal,
            None,
            Arc::new(DenyAll),
            outgoing_access_control,
        );

        let main_remote = Mailbox::new(
            addresses.main_remote,
            None,
            Arc::new(AllowAll),
            Arc::new(AllowAll),
        );

        Mailboxes::new(main_internal, vec![main_remote])
    }
}

impl RemoteRelay {
    fn new(
        addresses: Addresses,
        registration_route: Route,
        registration_payload: String,
        flow_control_id: Option<FlowControlId>,
    ) -> Self {
        Self {
            addresses,
            completion_msg_sent: false,
            registration_route,
            registration_payload,
            flow_control_id,
        }
    }

    /// Create and start static RemoteRelay at predefined address with given Ockam Orchestrator route
    pub async fn create_static(
        ctx: &Context,
        orchestrator_route: impl Into<Route>,
        alias: impl Into<String>,
        options: RemoteRelayOptions,
    ) -> Result<RemoteRelayInfo> {
        let addresses = Addresses::generate(RelayType::Static);

        let mut callback_ctx = ctx.new_detached_with_mailboxes(Mailboxes::primary(
            addresses.completion_callback.clone(),
            Arc::new(AllowSourceAddress(addresses.main_remote.clone())),
            Arc::new(DenyAll),
        ))?;

        let registration_route = orchestrator_route.into() + "static_forwarding_service";

        let flow_control_id =
            options.setup_flow_control(ctx.flow_controls(), &addresses, registration_route.next()?);
        let outgoing_access_control =
            options.create_access_control(ctx.flow_controls(), flow_control_id.clone());

        let relay = Self::new(
            addresses.clone(),
            registration_route,
            alias.into(),
            flow_control_id,
        );

        debug!("Starting static RemoteRelay at {}", &addresses.main_remote);
        let mailboxes = Self::mailboxes(addresses, outgoing_access_control);
        WorkerBuilder::new(relay)
            .with_mailboxes(mailboxes)
            .start(ctx)?;

        let resp = callback_ctx
            .receive::<RemoteRelayInfo>()
            .await?
            .into_body()?;

        Ok(resp)
    }

    /// Create and start new ephemeral RemoteRelay at random address with given Ockam Orchestrator route
    pub async fn create(
        ctx: &Context,
        orchestrator_route: impl Into<Route>,
        options: RemoteRelayOptions,
    ) -> Result<RemoteRelayInfo> {
        let addresses = Addresses::generate(RelayType::Ephemeral);

        let mut callback_ctx = ctx.new_detached_with_mailboxes(Mailboxes::primary(
            addresses.completion_callback.clone(),
            Arc::new(AllowSourceAddress(addresses.main_remote.clone())),
            Arc::new(DenyAll),
        ))?;

        let registration_route = orchestrator_route.into() + "forwarding_service";

        let flow_control_id =
            options.setup_flow_control(ctx.flow_controls(), &addresses, registration_route.next()?);
        let outgoing_access_control =
            options.create_access_control(ctx.flow_controls(), flow_control_id.clone());

        let relay = Self::new(
            addresses.clone(),
            registration_route,
            "register".to_string(),
            flow_control_id,
        );

        debug!(
            "Starting ephemeral RemoteRelay at {}",
            &addresses.main_internal
        );
        let mailboxes = Self::mailboxes(addresses, outgoing_access_control);
        WorkerBuilder::new(relay)
            .with_mailboxes(mailboxes)
            .start(ctx)?;

        let resp = callback_ctx
            .receive::<RemoteRelayInfo>()
            .await?
            .into_body()?;

        Ok(resp)
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam/src/remote/worker.rs`
```
use crate::remote::{RemoteRelay, RemoteRelayInfo};
use crate::{Context, OckamError};
use ockam_core::compat::{
    boxed::Box,
    string::{String, ToString},
};
use ockam_core::{Any, Decodable, Result, Routed, Worker};
use tracing::{debug, info};

#[crate::worker]
impl Worker for RemoteRelay {
    type Context = Context;
    type Message = Any;

    async fn initialize(&mut self, ctx: &mut Self::Context) -> Result<()> {
        debug!(registration_route = %self.registration_route, "RemoteRelay initializing...");

        ctx.send_from_address(
            self.registration_route.clone(),
            self.registration_payload.clone(),
            self.addresses.main_remote.clone(),
        )
        .await?;

        debug!(registration_route = %self.registration_route, "RemoteRelay initialized");

        Ok(())
    }

    async fn handle_message(
        &mut self,
        ctx: &mut Context,
        msg: Routed<Self::Message>,
    ) -> Result<()> {
        if msg.msg_addr() == &self.addresses.main_remote {
            let mut local_message = msg.into_local_message();

            // Remove my address from the onward_route
            local_message = local_message.pop_front_onward_route()?;

            match local_message.onward_route().next() {
                Err(_) => {
                    debug!(registration_route = %self.registration_route, "RemoteRelay received service message");

                    let payload = String::decode(local_message.payload())
                        .map_err(|_| OckamError::InvalidResponseFromRelayService)?;
                    // using ends_with() instead of == to allow for prefixes
                    if self.registration_payload != "register"
                        && !payload.ends_with(&self.registration_payload)
                    {
                        return Err(OckamError::InvalidResponseFromRelayService)?;
                    }

                    if !self.completion_msg_sent {
                        info!(registration_route = %self.registration_route, "RemoteRelay registered with route: {}", local_message.return_route);
                        let address = match local_message
                            .return_route
                            .recipient()?
                            .to_string()
                            .strip_prefix("0#")
                        {
                            Some(addr) => addr.to_string(),
                            None => return Err(OckamError::InvalidResponseFromRelayService)?,
                        };

                        ctx.send_from_address(
                            self.addresses.completion_callback.clone(),
                            RemoteRelayInfo::new(
                                local_message.return_route,
                                address,
                                self.addresses.main_remote.clone(),
                                self.flow_control_id.clone(),
                            ),
                            self.addresses.main_remote.clone(),
                        )
                        .await?;

                        self.completion_msg_sent = true;
                    }

                    Ok(())
                }
                Ok(next) if next == &self.addresses.main_remote => {
                    // Explicitly check that we don't forward to ourselves as this would somewhat
                    // overcome our outgoing access control, even though it shouldn't be possible
                    // to exploit it in any way
                    return Err(OckamError::UnknownForwarderNextHopAddress)?;
                }
                Ok(_) => {
                    // Forwarding the message
                    debug!(registration_route = %self.registration_route, "RemoteRelay received payload message");

                    // Send the message on its onward_route
                    ctx.forward_from_address(local_message, self.addresses.main_internal.clone())
                        .await?;

                    Ok(())
                }
            }
        } else {
            Err(OckamError::UnknownForwarderDestinationAddress)?
        }
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam_api/src/authenticator/credential_issuer/credential_issuer_worker.rs`
```
use core::time::Duration;
use tracing::trace;

use crate::authenticator::credential_issuer::CredentialIssuer;
use crate::authenticator::direct::AccountAuthorityInfo;
use crate::authenticator::AuthorityMembersRepository;
use ockam::identity::{Credentials, Identifier, IdentitiesAttributes};
use ockam_core::api::{Method, Request, Response};
use ockam_core::compat::boxed::Box;
use ockam_core::compat::sync::Arc;
use ockam_core::compat::vec::Vec;
use ockam_core::identity::SecureChannelLocalInfo;
use ockam_core::{Result, Routed, Worker};
use ockam_node::Context;

/// This struct runs as a Worker to issue credentials based on a request/response protocol
pub struct CredentialIssuerWorker {
    credential_issuer: CredentialIssuer,
}

impl CredentialIssuerWorker {
    /// Create a new credentials issuer
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        members: Arc<dyn AuthorityMembersRepository>,
        identities_attributes: Arc<IdentitiesAttributes>,
        credentials: Arc<Credentials>,
        issuer: &Identifier,
        project_identifier: String,
        credential_ttl: Option<Duration>,
        account_authority: Option<AccountAuthorityInfo>,
        disable_trust_context_id: bool,
    ) -> Self {
        Self {
            credential_issuer: CredentialIssuer::new(
                members,
                identities_attributes,
                credentials,
                issuer,
                project_identifier,
                credential_ttl,
                account_authority,
                disable_trust_context_id,
            ),
        }
    }
}

#[ockam_core::worker]
impl Worker for CredentialIssuerWorker {
    type Context = Context;
    type Message = Request<Vec<u8>>;

    async fn handle_message(&mut self, c: &mut Context, m: Routed<Self::Message>) -> Result<()> {
        let secure_channel_info = match SecureChannelLocalInfo::find_info(m.local_message()) {
            Ok(secure_channel_info) => secure_channel_info,
            Err(_e) => {
                let resp =
                    Response::bad_request_no_request("secure channel required").encode_body()?;
                c.send(m.return_route().clone(), resp).await?;
                return Ok(());
            }
        };

        let from = Identifier::from(secure_channel_info.their_identifier());
        let return_route = m.return_route().clone();
        let request = m.into_body()?;
        let header = request.header();
        trace! {
            target: "credential_issuer",
            from   = %from,
            id     = %header.id(),
            method = ?header.method(),
            path   = %header.path(),
            body   = %header.has_body(),
            "request"
        }
        let res = match (header.method(), header.path()) {
            (Some(Method::Post), "/") | (Some(Method::Post), "/credential") => {
                match self.credential_issuer.issue_credential(&from).await {
                    Ok(Some(crd)) => Response::ok()
                        .with_headers(header)
                        .body(crd)
                        .encode_body()?,
                    Ok(None) => Response::forbidden(header, "unauthorized member").encode_body()?,
                    Err(error) => {
                        Response::internal_error(header, &error.to_string()).encode_body()?
                    }
                }
            }
            _ => Response::unknown_path(header).encode_body()?,
        };

        c.send(return_route, res).await
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam_api/src/authenticator/direct/direct_authenticator_worker.rs`
```
use either::Either;
use tracing::trace;

use ockam::identity::models::IdentifierList;
use ockam::identity::{Identifier, IdentitiesAttributes};
use ockam_core::api::{Method, Request, Response};
use ockam_core::compat::sync::Arc;
use ockam_core::identity::SecureChannelLocalInfo;
use ockam_core::{Decodable, Result, Routed, Worker};
use ockam_node::Context;

use crate::authenticator::direct::types::{AddMember, MemberList};
use crate::authenticator::direct::DirectAuthenticator;
use crate::authenticator::AuthorityMembersRepository;

use super::AccountAuthorityInfo;

pub struct DirectAuthenticatorWorker {
    authenticator: DirectAuthenticator,
}

impl DirectAuthenticatorWorker {
    pub fn new(
        authority: &Identifier,
        members: Arc<dyn AuthorityMembersRepository>,
        identities_attributes: Arc<IdentitiesAttributes>,
        account_authority: Option<AccountAuthorityInfo>,
    ) -> Self {
        Self {
            authenticator: DirectAuthenticator::new(
                authority,
                members,
                identities_attributes,
                account_authority,
            ),
        }
    }
}

#[ockam_core::worker]
impl Worker for DirectAuthenticatorWorker {
    type Message = Request<Vec<u8>>;
    type Context = Context;

    async fn handle_message(&mut self, c: &mut Context, m: Routed<Self::Message>) -> Result<()> {
        let secure_channel_info = match SecureChannelLocalInfo::find_info(m.local_message()) {
            Ok(secure_channel_info) => secure_channel_info,
            Err(_e) => {
                let resp =
                    Response::bad_request_no_request("secure channel required").encode_body()?;
                c.send(m.return_route().clone(), resp).await?;
                return Ok(());
            }
        };

        let from = Identifier::from(secure_channel_info.their_identifier());
        let return_route = m.return_route().clone();
        let request = m.into_body()?;
        let (header, body) = request.into_parts();
        trace! {
            target: "direct_authenticator",
            from   = %from,
            id     = %header.id(),
            method = ?header.method(),
            path   = %header.path(),
            body   = %header.has_body(),
            "request"
        }
        let path_segments = header.path_segments::<5>();
        let res: Response<Vec<u8>> = match (header.method(), path_segments.as_slice()) {
            (Some(Method::Post), [""]) | (Some(Method::Post), ["members"]) => {
                let add = AddMember::decode(&body.unwrap_or_default())?;
                let res = self
                    .authenticator
                    .add_member(&from, add.member(), add.attributes())
                    .await?;
                match res {
                    Either::Left(_) => Response::ok().with_headers(&header).encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            (Some(Method::Get), ["member_ids"]) => {
                let res = self.authenticator.list_members(&from).await?;
                match res {
                    Either::Left(entries) => {
                        let ids: Vec<Identifier> = entries.into_keys().collect();
                        Response::ok()
                            .with_headers(&header)
                            .body(IdentifierList(ids))
                            .encode_body()?
                    }
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            (Some(Method::Get), [""]) | (Some(Method::Get), ["members"]) => {
                let res = self.authenticator.list_members(&from).await?;

                match res {
                    Either::Left(entries) => Response::ok()
                        .with_headers(&header)
                        .body(MemberList(entries))
                        .encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            (Some(Method::Get), [id]) | (Some(Method::Get), ["members", id]) => {
                let identifier = Identifier::try_from(id.to_string())?;
                let res = self.authenticator.show_member(&from, &identifier).await?;

                match res {
                    Either::Left(body) => Response::ok()
                        .with_headers(&header)
                        .body(body)
                        .encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            (Some(Method::Delete), ["members"]) => {
                let res = self.authenticator.delete_all_members(&from).await?;
                match res {
                    Either::Left(_) => Response::ok().with_headers(&header).encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            (Some(Method::Delete), [id]) | (Some(Method::Delete), ["members", id]) => {
                let identifier = Identifier::try_from(id.to_string())?;
                let res = self.authenticator.delete_member(&from, &identifier).await?;

                match res {
                    Either::Left(_) => Response::ok().with_headers(&header).encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            _ => Response::unknown_path(&header).encode_body()?,
        };

        c.send(return_route, res).await?;

        Ok(())
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam_api/src/authenticator/enrollment_tokens/acceptor_worker.rs`
```
use crate::authenticator::enrollment_tokens::EnrollmentTokenAcceptor;
use crate::authenticator::one_time_code::OneTimeCode;
use crate::authenticator::{AuthorityEnrollmentTokenRepository, AuthorityMembersRepository};
use either::Either;
use ockam::identity::Identifier;
use ockam_core::api::{Method, Request, Response};
use ockam_core::compat::sync::Arc;
use ockam_core::identity::SecureChannelLocalInfo;
use ockam_core::{Decodable, Result, Routed, Worker};
use ockam_node::Context;
use tracing::trace;

pub struct EnrollmentTokenAcceptorWorker {
    pub(super) acceptor: EnrollmentTokenAcceptor,
}

impl EnrollmentTokenAcceptorWorker {
    pub fn new(
        authority: &Identifier,
        tokens: Arc<dyn AuthorityEnrollmentTokenRepository>,
        members: Arc<dyn AuthorityMembersRepository>,
    ) -> Self {
        Self {
            acceptor: EnrollmentTokenAcceptor::new(authority, tokens, members),
        }
    }
}

#[ockam_core::worker]
impl Worker for EnrollmentTokenAcceptorWorker {
    type Context = Context;
    type Message = Request<Vec<u8>>;

    async fn handle_message(&mut self, c: &mut Context, m: Routed<Self::Message>) -> Result<()> {
        let secure_channel_info = match SecureChannelLocalInfo::find_info(m.local_message()) {
            Ok(secure_channel_info) => secure_channel_info,
            Err(_e) => {
                let resp =
                    Response::bad_request_no_request("secure channel required").encode_body()?;
                c.send(m.return_route().clone(), resp).await?;
                return Ok(());
            }
        };

        let from = Identifier::from(secure_channel_info.their_identifier());
        let return_route = m.return_route().clone();
        let request = m.into_body()?;
        let (header, body) = request.into_parts();
        trace! {
            target: "enrollment_token_acceptor",
            from   = %from,
            id     = %header.id(),
            method = ?header.method(),
            path   = %header.path(),
            body   = %header.has_body(),
            "request"
        }
        let res = match (header.method(), header.path()) {
            (Some(Method::Post), "/") | (Some(Method::Post), "/credential") => {
                let otc = OneTimeCode::decode(&body.unwrap_or_default())?;
                let res = self.acceptor.accept_token(otc, &from).await?;
                match res {
                    Either::Left(_) => Response::ok().with_headers(&header).encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            _ => Response::unknown_path(&header).encode_body()?,
        };
        c.send(return_route, res).await
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam_api/src/authenticator/enrollment_tokens/issuer_worker.rs`
```
use either::Either;
use tracing::trace;

use ockam::identity::{Identifier, IdentitiesAttributes};
use ockam_core::api::{Method, Request, Response};
use ockam_core::compat::sync::Arc;
use ockam_core::compat::time::Duration;
use ockam_core::identity::SecureChannelLocalInfo;
use ockam_core::{Decodable, Result, Routed, Worker};
use ockam_node::Context;

use crate::authenticator::direct::types::CreateToken;
use crate::authenticator::direct::AccountAuthorityInfo;
use crate::authenticator::enrollment_tokens::EnrollmentTokenIssuer;
use crate::authenticator::{AuthorityEnrollmentTokenRepository, AuthorityMembersRepository};

pub struct EnrollmentTokenIssuerWorker {
    pub(super) issuer: EnrollmentTokenIssuer,
}

impl EnrollmentTokenIssuerWorker {
    pub fn new(
        authority: &Identifier,
        tokens: Arc<dyn AuthorityEnrollmentTokenRepository>,
        members: Arc<dyn AuthorityMembersRepository>,
        identities_attributes: Arc<IdentitiesAttributes>,
        account_authority: Option<AccountAuthorityInfo>,
    ) -> Self {
        Self {
            issuer: EnrollmentTokenIssuer::new(
                authority,
                tokens,
                members,
                identities_attributes,
                account_authority,
            ),
        }
    }
}

#[ockam_core::worker]
impl Worker for EnrollmentTokenIssuerWorker {
    type Context = Context;
    type Message = Request<Vec<u8>>;

    async fn handle_message(&mut self, c: &mut Context, m: Routed<Self::Message>) -> Result<()> {
        let secure_channel_info = match SecureChannelLocalInfo::find_info(m.local_message()) {
            Ok(secure_channel_info) => secure_channel_info,
            Err(_e) => {
                let resp =
                    Response::bad_request_no_request("secure channel required").encode_body()?;
                c.send(m.return_route().clone(), resp).await?;
                return Ok(());
            }
        };

        let from = Identifier::from(secure_channel_info.their_identifier());
        let return_route = m.return_route().clone();
        let request = m.into_body()?;
        let (header, body) = request.into_parts();
        trace! {
            target: "enrollment_token_issuer",
            from   = %from,
            id     = %header.id(),
            method = ?header.method(),
            path   = %header.path(),
            body   = %header.has_body(),
            "request"
        }
        let res = match (header.method(), header.path()) {
            (Some(Method::Post), "/") | (Some(Method::Post), "/tokens") => {
                let att: CreateToken = CreateToken::decode(&body.unwrap_or_default())?;
                let duration = att.ttl_secs().map(Duration::from_secs);
                let ttl_count = att.ttl_count();

                let res = self
                    .issuer
                    .issue_token(&from, att.into_owned_attributes(), duration, ttl_count)
                    .await?;

                match res {
                    Either::Left(otc) => Response::ok()
                        .with_headers(&header)
                        .body(otc)
                        .encode_body()?,
                    Either::Right(error) => Response::forbidden(&header, &error.0).encode_body()?,
                }
            }
            _ => Response::unknown_path(&header).encode_body()?,
        };
        c.send(return_route, res).await
    }
}

```

### Core Architecture Module: `implementations/rust/ockam/ockam_api/src/cli_state/cli_state.rs`
```
use rand::random;
use std::path::{Path, PathBuf};
use tokio::sync::broadcast::{channel, Receiver, Sender};

use ockam::SqlxDatabase;
use ockam_core::env::get_env_with_default;
use ockam_node::database::{DatabaseConfiguration, DatabaseConfigurationMode, DatabaseType};

use crate::cli_state::error::Result;
use crate::cli_state::CliStateError;
use crate::logs::ExportingEnabled;
use crate::terminal::notification::Notification;

pub const OCKAM_HOME: &str = "OCKAM_HOME";

/// Maximum number of notifications present in the channel
const NOTIFICATIONS_CHANNEL_CAPACITY: usize = 16;

/// The CliState struct manages all the data persisted locally.
///
/// The data is saved to several files:
///
/// - The "nodes" database file. That file contains most of the configuration for the nodes running locally: project, node,
///   inlets, outlets, etc... That file is deleted when the `ockam reset` command is executed
///
/// - The "application" database file. That file stores the tracing data which needs to persist across all commands
///   including reset
///
/// - One file per additional vault created with the `ockam vault create` command
///
/// The database files are accessed with the SqlxDatabase struct, and use different migration files to define their
/// schema.
///
/// On top of each SqlxDatabase, there are different repositories. A Repository encapsulates SQL queries for
/// creating / updating / deleting entities. Some examples of entities that are persisted: Project, Space, Vault, Identity, etc...
///
/// The repositories themselves are not accessible from the `CliState` directly since it is often
/// necessary to use more than one repository to implement a given behaviour. For example deleting
/// an identity requires to query the nodes that are using that identity and only delete it if no
/// node is using that identity
///
#[derive(Debug, Clone)]
pub struct CliState {
    pub mode: CliStateMode,
    database: SqlxDatabase,
    application_database: SqlxDatabase,
    exporting_enabled: ExportingEnabled,
    /// Broadcast channel to be notified of major events during a process supported by the CliState API
    notifications: Sender<Notification>,
}

impl CliState {
    pub fn dir(&self) -> Result<PathBuf> {
        match &self.mode {
            CliStateMode::Persistent(dir) => Ok(dir.to_path_buf()),
            CliStateMode::InMemory => Self::default_dir(),
        }
    }

    pub fn database(&self) -> SqlxDatabase {
        self.database.clone()
    }

    pub fn database_ref(&self) -> &SqlxDatabase {
        &self.database
    }

    pub fn database_configuration(&self) -> Result<DatabaseConfiguration> {
        Self::make_database_configuration(&self.mode)
    }

    pub fn is_using_in_memory_database(&self) -> Result<bool> {
        match self.database_configuration()?.mode() {
            DatabaseConfigurationMode::SqliteInMemory { .. } => Ok(true),
            _ => Ok(false),
        }
    }

    pub fn is_database_path(&self, path: &Path) -> bool {
        let database_configuration = self.database_configuration().ok();
        match database_configuration {
            Some(c) => c.path() == Some(path.to_path_buf()),
            None => false,
        }
    }

    pub fn application_database(&self) -> SqlxDatabase {
        self.application_database.clone()
    }

    pub fn application_database_configuration(&self) -> Result<DatabaseConfiguration> {
        Self::make_application_database_configuration(&self.mode)
    }

    pub fn subscribe_to_notifications(&self) -> Receiver<Notification> {
        self.notifications.subscribe()
    }

    pub fn notify_message(&self, message: impl Into<String>) {
        self.notify(Notification::message(message));
    }

    pub fn notify_progress(&self, message: impl Into<String>) {
        self.notify(Notification::progress(message));
    }

    pub fn notify_progress_finish(&self, message: impl Into<String>) {
        self.notify(Notification::progress_finish(Some(message.into())));
    }

    pub fn notify_progress_finish_and_clear(&self) {
        self.notify(Notification::progress_finish(None));
    }

    fn notify(&self, notification: Notification) {
        let _ = self.notifications.send(notification);
    }
}

/// These functions allow to create and reset the local state
impl CliState {
    /// Return a new CliState using a default directory to store its data or
    /// using an in-memory storage if the OCKAM_SQLITE_IN_MEMORY environment variable is set to true
    pub async fn new(in_memory: bool) -> Result<Self> {
        let mode = if in_memory {
            CliStateMode::InMemory
        } else {
            CliStateMode::with_default_dir()?
        };

        Self::create(mode).await
    }

    /// Stop nodes and remove all the directories storing state
    /// Don't touch the database data if Postgres is used and reset was called accidentally.
    pub async fn reset(&self) -> Result<()> {
        if Self::make_database_configuration(&self.mode)?.database_type() == DatabaseType::Postgres
        {
            Ok(self.database().truncate_all_postgres_tables().await?)
        } else {
            self.delete_all_named_identities().await?;
            self.delete_all_nodes().await?;
            self.delete_all_named_vaults().await?;
            self.delete().await
        }
    }

    /// Removes all the directories storing state without loading the current state
    /// The database data is only removed if the database is a SQLite one
    pub fn hard_reset() -> Result<()> {
        let dir = Self::default_dir()?;
        Self::delete_at(&dir)
    }

    /// Delete the local database and log files
    pub async fn delete(&self) -> Result<()> {
        self.delete_local_data()
    }

    /// Delete the local data on disk: sqlite database file and log files
    pub fn delete_local_data(&self) -> Result<()> {
        if let CliStateMode::Persistent(dir) = &self.mode {
            Self::delete_at(dir)?;
        }
        Ok(())
    }

    /// Reset all directories and return a new CliState
    pub async fn recreate(&self) -> Result<CliState> {
        self.reset().await?;
        Self::create(self.mode.clone()).await
    }

    /// Backup and reset is used to save aside
    /// some corrupted local state for later inspection and then reset the state.
    /// The database is backed-up only if it is a SQLite database.
    pub async fn backup_and_reset() -> Result<()> {
        let dir = Self::default_dir()?;

        // Reset backup directory
        let backup_dir = Self::backup_default_dir()?;
        if backup_dir.exists() {
            let _ = std::fs::remove_dir_all(&backup_dir);
        }
        std::fs::create_dir_all(&backup_dir)?;

        // Move state to backup directory
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let from = entry.path();
            let to = backup_dir.join(entry.file_name());
            std::fs::rename(from, to)?;
        }

        // Reset state
        Self::delete_at(&dir)?;
        Self::create(CliStateMode::Persistent(dir.clone())).await?;

        let backup_dir = CliState::backup_default_dir()?;
        eprintln!("The {dir:?} directory has been reset and has been backed up to {backup_dir:?}");
        Ok(())
    }

    /// Returns the default backup directory for the CLI state.
    pub fn backup_default_dir() -> Result<PathBuf> {
        let dir = Self::default_dir()?;
        let dir_name = dir.file_name().and_then(|n| n.to_str()).ok_or_else(|| {
            CliStateError::InvalidOperation(
                "The $OCKAM_HOME directory does not have a valid name".to_string(),
            )
        })?;
        let parent = dir.parent().ok_or_else(|| {
            CliStateError::InvalidOperation(
                "The $OCKAM_HOME directory does not a valid parent directory".to_string(),
            )
        })?;
        Ok(parent.join(format!("{dir_name}.bak")))
    }
}

/// Low-level functions for creating / deleting CliState files
impl CliState {
    /// Create a new CliState where the data is stored at a given path
    pub async fn create(mode: CliStateMode) -> Result<Self> {
        if let CliStateMode::Persistent(ref dir) = mode {
            std::fs::create_dir_all(dir.as_path())?;
        }
        let database = SqlxDatabase::create(&Self::make_database_configuration(&mode)?).await?;
        debug!("Opened the main database with options {:?}", database);

        // TODO: This should not be called unless we're running the App
        let application_database = SqlxDatabase::create_application_database(
            &Self::make_application_database_configuration(&mode)?,
        )
        .await?;
        debug!(
            "Opened the application database with options {:?}",
            application_database
        );

        let (notifications, _) = channel::<Notification>(NOTIFICATIONS_CHANNEL_CAPACITY);

        let state = Self {
            mode,
            database,
            application_database,
            // We initialize the CliState with no tracing.
            // Once the logging/tracing options have been determined, then
            // the function set_tracing_enabled can be used to enable tracing, which
            // is eventually used to trace user journeys.
            exporting_enabled: ExportingEnabled::Off,
            notifications,
        };

        Ok(state)
    }

    pub fn is_tracing_enabled(&self) -> bool {
        self.exporting_enabled == ExportingEnabled::On
    }

    pub fn set_tracing_enabled(self, enabled: bool) -> CliState {
        CliState {
            exporting_enabled: if enabled {
                ExportingEnabled::On
            } else {
                ExportingEnabled::Off
            },
            ..self
        }
    }

    /// If the postgres database is configured, return the postgres configuration
    ///
    pub(super) fn make_database_configuration(
        mode: &CliStateMode,
    ) -> Result<DatabaseConfigura
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9257** (2026-03-16): **fix: bump bytes to 1.11.1 and time to 0.3.47 for CVE remediation**
  *Symptoms*: Bumps pinned dependency versions for CVE remediation: - bytes 1.9.0 → 1.11.1 (CVE-2026-25541, due Apr 4) - time 0.3.39 → 0.3.47 (CVE-2026-25727, due Apr 6)  Cargo.lock needs regeneration via cargo update -p bytes -p time.

- **Issue #9254** (2025-10-30): **ci: bump github/codeql-action from 3.28.17 to 4.31.0**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 3.28.17 to 4.31.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.31.0</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>4.31.0 - 24 Oct 2025</h2> <ul> <li>Bump minimum CodeQL bundle version to 2.17.6. <a href="https://redirect.github.com/github/codeql-action/pull/3223">#3223</a></li> <li>When SARIF files are uploaded by the <code>analyze</code> or <code>upload-sarif</code> actions, the CodeQL Action automatically performs post-processing steps to prepare the data for the upload. Previously, these post-processing steps were only performed before an upload took place. We are now changing this so that the post-processing steps will always be performed, even when the SARIF files are not uploaded. This does not change anything for the <code>upload-sarif</code> action. For <code>analyze</code>, this may affect Advanced Setup for CodeQL users who specify a value other than <code>always</code> for the <code>upload</code> input. <a href="https://redirect.github.com/github/codeql-action/pull/3222">#3222</a></li> </ul> <p>See the full <a href="https://github.com/github/codeql-action/blob/v4.31.0/CHANGELOG.md">CHANGELOG.md</a> for
  **Post-Mortem & Fix Analysis**:
  > Superseded by #9256.

- **Issue #9253** (2025-10-24): **ci: bump github/codeql-action from 3.28.17 to 4.30.9**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 3.28.17 to 4.30.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.30.9</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>4.30.9 - 17 Oct 2025</h2> <ul> <li>Update default CodeQL bundle version to 2.23.3. <a href="https://redirect.github.com/github/codeql-action/pull/3205">#3205</a></li> <li>Experimental: A new <code>setup-codeql</code> action has been added which is similar to <code>init</code>, except it only installs the CodeQL CLI and does not initialize a database. Do not use this in production as it is part of an internal experiment and subject to change at any time. <a href="https://redirect.github.com/github/codeql-action/pull/3204">#3204</a></li> </ul> <p>See the full <a href="https://github.com/github/codeql-action/blob/v4.30.9/CHANGELOG.md">CHANGELOG.md</a> for more information.</p> <h2>v4.30.8</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>4.30.8 - 10 Oct 2025</h2> <p>No user facing changes.</p> <p>See the full <a href="https://github.com/github/codeql-action/bl
  **Post-Mortem & Fix Analysis**:
  > Superseded by #9254.

- **Issue #9252** (2025-10-26): **First Start**
  *Symptoms*: Will begin the workflow job that been get true.  <!-- Thank you for sending a pull request :heart: -->  ## Current behavior  <!-- Please describe the current behavior of the code before the changes in this pull request are applied. -->  ## Proposed changes  <!-- Please describe the changes proposed in this pull request. --> <!-- If this pull request resolves an already recorded bug or a feature request, please add a link to that issue. -->  ## Checks  <!-- To help us review and merge this pull request quickly, please confirm the following by replacing the [ ] in front of each bullet point below with [x] -->  - [x] All commits in this Pull Request are [signed](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits) and Verified by Github. - [x] All commits in this Pull Request follow the Ockam [commit message convention](https://github.com/build-trust/.github/blob/main/CONTRIBUTING.md#commit-messages). - [x] There are no Merge commits in this Pull Request. Ockam repo maintains a linear commit history. We merge Pull Requests by rebasing them onto the develop branch. Rebasing to the latest develop branch and force pushing to your Pull Request branch is okay. - [x] I have read and accept the Ockam Community [Code of Conduct](https://github.com/build-trust/.github/blob/main/CODE_OF_CONDUCT.md). - [x] I have read and accepted the Ockam [Contributor License Agreement](https://github.com/build-trust/.github/blob/main/C

- **Issue #9251** (2025-10-17): **ci: bump github/codeql-action from 3.28.17 to 4.30.8**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 3.28.17 to 4.30.8. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.30.8</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>4.30.8 - 10 Oct 2025</h2> <p>No user facing changes.</p> <p>See the full <a href="https://github.com/github/codeql-action/blob/v4.30.8/CHANGELOG.md">CHANGELOG.md</a> for more information.</p> <h2>v4.30.7</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>4.30.7 - 06 Oct 2025</h2> <ul> <li>[v4+ only] The CodeQL Action now runs on Node.js v24. <a href="https://redirect.github.com/github/codeql-action/pull/3169">#3169</a></li> </ul> <p>See the full <a href="https://github.com/github/codeql-action/blob/v4.30.7/CHANGELOG.md">CHANGELOG.md</a> for more information.</p> <h2>v3.30.8</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>3.30.8 - 10 Oct 2025</h2> <p>No user facing changes.</p> <p>See the full <a href="https://gi
  **Post-Mortem & Fix Analysis**:
  > Superseded by #9253.

- **Issue #9248** (2025-10-10): **ci: bump github/codeql-action from 3.28.17 to 4.30.7**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 3.28.17 to 4.30.7. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.30.7</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>4.30.7 - 06 Oct 2025</h2> <ul> <li>[v4+ only] The CodeQL Action now runs on Node.js v24. <a href="https://redirect.github.com/github/codeql-action/pull/3169">#3169</a></li> </ul> <p>See the full <a href="https://github.com/github/codeql-action/blob/v4.30.7/CHANGELOG.md">CHANGELOG.md</a> for more information.</p> <h2>v3.30.7</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>3.30.7 - 06 Oct 2025</h2> <p>No user facing changes.</p> <p>See the full <a href="https://github.com/github/codeql-action/blob/v3.30.7/CHANGELOG.md">CHANGELOG.md</a> for more information.</p> <h2>v3.30.6</h2> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>3.30.6 - 02 Oct 2025</h2> <ul> <li>Update default CodeQL bundle version to 2.23.2. <a href="
  **Post-Mortem & Fix Analysis**:
  > Superseded by #9251.

- **Issue #9247** (2025-10-08): **ci: bump crate-ci/typos from 1.32.0 to 1.38.0**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.32.0 to 1.38.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.38.0</h2> <h2>[1.38.0] - 2025-10-06</h2> <h3>Features</h3> <ul> <li>Update type list</li> </ul> <h3>Fixes</h3> <ul> <li>Don't correct <code>typ</code></li> <li>Consistently error on unused config fields</li> </ul> <h2>v1.37.3</h2> <h2>[1.37.3] - 2025-10-06</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>PN</code> for <code>bitbake</code> file types</li> </ul> <h2>v1.37.2</h2> <h2>[1.37.2] - 2025-10-03</h2> <h3>Fixes</h3> <ul> <li>Don't suggest <code>diagnostic</code> for <code>diagnotics</code>, preferring <code>diagnostics</code></li> </ul> <h2>v1.37.1</h2> <h2>[1.37.1] - 2025-10-01</h2> <h3>Fixes</h3> <ul> <li>Don't offer corrections to <code>&quot;&quot;</code></li> </ul> <h2>v1.37.0</h2> <h2>[1.37.0] - 2025-09-30</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1370">September 2025</a> changes</li> <li>Pull in other dictionary updates</li> </ul> <h2>v1.36.3</h2> <h2>[1.36.3] - 2025-09-25</h2> <h3>Fixes</h3> <ul> <li>Fix typo in correction to <code>analysises</code></li> </ul> <h2>v1.36.2</h2> <h2>[1.36.2] - 2025-09-04</h2> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </details> <details> <summary>Changelog</summary> <p><em>Sourc
  **Post-Mortem & Fix Analysis**:
  > Superseded by #9249.

- **Issue #9246** (2025-10-07): **ci: bump crate-ci/typos from 1.32.0 to 1.37.2**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.32.0 to 1.37.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.37.2</h2> <h2>[1.37.2] - 2025-10-03</h2> <h3>Fixes</h3> <ul> <li>Don't suggest <code>diagnostic</code> for <code>diagnotics</code>, preferring <code>diagnostics</code></li> </ul> <h2>v1.37.1</h2> <h2>[1.37.1] - 2025-10-01</h2> <h3>Fixes</h3> <ul> <li>Don't offer corrections to <code>&quot;&quot;</code></li> </ul> <h2>v1.37.0</h2> <h2>[1.37.0] - 2025-09-30</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1370">September 2025</a> changes</li> <li>Pull in other dictionary updates</li> </ul> <h2>v1.36.3</h2> <h2>[1.36.3] - 2025-09-25</h2> <h3>Fixes</h3> <ul> <li>Fix typo in correction to <code>analysises</code></li> </ul> <h2>v1.36.2</h2> <h2>[1.36.2] - 2025-09-04</h2> <h3>Fixes</h3> <ul> <li>Fix regression from 1.36.1 when rendering an error for a line with invalid UTF-8</li> </ul> <h2>v1.36.1</h2> <h2>[1.36.1] - 2025-09-03</h2> <h3>Fixes</h3> <ul> <li>Replaced the error rendering for various quality of life improvements</li> </ul> <h2>v1.36.0</h2> <h2>[1.36.0] - 2025-09-02</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1345">August 2025</a> changes</li> </ul> <!-- raw HTML omitt
  **Post-Mortem & Fix Analysis**:
  > Superseded by #9247.

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

### Incident Patch 1: `0435d8d7` (2026-01-04)
**Commit Message**: Fix dev enrollment ticket response decoding

The orchestrator returns a CBOR-encoded Ticket struct for the dev-ticket
endpoint (same as regular enrollment tickets), but the controller_client
was trying to deserialize it as a raw String.

Update create_dev_enrollment_ticket to decode the response as a Ticket
struct and extract the ticket field.

**File**: `implementations/rust/ockam/ockam_api/src/orchestrator/ai_platform/controller_client.rs` (modified, +2/-2)
```diff
@@ -243,12 +243,12 @@ impl AiPlatformApi for ControllerClient {
     ) -> miette::Result<String> {
         trace!("creating dev enrollment ticket");
         let req = Request::post("/v0/dev-ticket");
-        let ticket: String = self
+        let ticket: Ticket = self
             .get_secure_client()
             .ask(ctx, "zones", req)
             .await
             .into_diagnostic()?
             .miette_success("create dev enrollment ticket")?;
-        Ok(ticket)
+        Ok(ticket.ticket)
     }
 }
```

---

### Incident Patch 2: `0a952246` (2026-01-04)
**Commit Message**: Use DOCKER_BUILDKIT=0 for zone dev image builds

Set DOCKER_BUILDKIT=0 for better compatibility across different
Docker/Podman setups. This avoids issues with buildx caching where
images aren't loaded into the local daemon.

**File**: `implementations/rust/ockam/ockam_command/src/zone/dev.rs` (modified, +3/-0)
```diff
@@ -481,8 +481,11 @@ impl DevCommand {
 
                 args.push(context_path);
 
+                // Use DOCKER_BUILDKIT=0 for better compatibility across different
+                // Docker/Podman setups - avoids issues with buildx caching
                 let output = tokio::process::Command::new(&self.runtime)
                     .args(&args)
+                    .env("DOCKER_BUILDKIT", "0")
                     .stdout(Stdio::piped())
                     .stderr(Stdio::piped())
                     .output()
```

---

### Incident Patch 3: `ba8ceea9` (2026-01-03)
**Commit Message**: Use simple 'gateway' relay name instead of cluster-prefixed name

**File**: `implementations/rust/ockam/ockam_command/src/zone/dev.rs` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ impl InMemoryNodeCommand for DevNodeCommand {
         } else {
             // Start the gateway portal node in a background task
             // This creates a TCP inlet that tunnels to the gateway via Ockam relay
-            let relay_name = format!("{}-gateway", cluster);
+            let relay_name = "gateway".to_string();
             let inlet_addr = format!("127.0.0.1:{}", self.gateway_inlet_port);
 
             self.opts.terminal.write_line(fmt_log!(
```

---

### Incident Patch 4: `79668526` (2026-01-02)
**Commit Message**: fix: add encode_format feature to ockam_api dependency

The EncodeFormat enum requires clap traits (ValueEnum) which are only
available when the encode_format feature is enabled. This was previously
included transitively through the ui feature.

**File**: `implementations/rust/ockam/ockam_command/Cargo.toml` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ ockam = { path = "../ockam", version = "^0.157.0", features = [
 ockam_abac = { path = "../ockam_abac", version = "0.84.0", features = ["std"] }
 ockam_api = { path = "../ockam_api", version = "0.100.0", default-features = false, features = [
   "std",
+  "encode_format",
 ] }
 ockam_core = { path = "../ockam_core", version = "^0.126.0" }
 ockam_multiaddr = { path = "../ockam_multiaddr", version = "0.71.0", features = [
```

---

### Incident Patch 5: `49076282` (2026-01-02)
**Commit Message**: build: make ui feature optional in ockam_command

The r3bl_rs_utils_core and r3bl_tui dependencies use the size-of crate
which has a compatibility issue with newer Rust versions. Make these
dependencies optional behind a 'ui' feature flag so that downstream
consumers can opt-out if they don't need the colorized header display.

**File**: `implementations/rust/ockam/ockam_command/Cargo.toml` (modified, +3/-3)
```diff
@@ -78,7 +78,6 @@ ockam = { path = "../ockam", version = "^0.157.0", features = [
 ockam_abac = { path = "../ockam_abac", version = "0.84.0", features = ["std"] }
 ockam_api = { path = "../ockam_api", version = "0.100.0", default-features = false, features = [
   "std",
-  "ui",
 ] }
 ockam_core = { path = "../ockam_core", version = "^0.126.0" }
 ockam_multiaddr = { path = "../ockam_multiaddr", version = "0.71.0", features = [
@@ -93,8 +92,8 @@ once_cell = "1.21"
 open = "5.3.0"
 opentelemetry = { version = "0.27", features = ["metrics", "trace"] }
 pem-rfc7468 = { version = "0.7.0", features = ["std"] }
-r3bl_rs_utils_core = "0.9.12"
-r3bl_tui = "0.5.8"
+r3bl_rs_utils_core = { version = "0.9.12", optional = true }
+r3bl_tui = { version = "0.5.8", optional = true }
 rand = "0.8"
 regex = "1.10.6"
 reqwest = { version = "0.12", default-features = false, features = [
@@ -141,6 +140,7 @@ serial_test = "3.0.0"
 
 [features]
 default = ["rust-crypto", "privileged_portals"]
+ui = ["ockam_api/ui", "r3bl_rs_utils_core", "r3bl_tui"]
 privileged_portals = ["ockam_api/privileged_portals"]
 aws-lc = ["ockam_vault/aws-lc", "ockam_api/aws-lc", "rustls/aws-lc-rs"]
 rust-crypto = [
```

**File**: `implementations/rust/ockam/ockam_command/src/enroll/handler.rs` (modified, +19/-7)
```diff
@@ -1,7 +1,9 @@
 use async_trait::async_trait;
 use colorful::Colorful;
 use miette::{miette, IntoDiagnostic, WrapErr};
+#[cfg(feature = "ui")]
 use r3bl_rs_utils_core::UnicodeString;
+#[cfg(feature = "ui")]
 use r3bl_tui::{
     ColorWheel, ColorWheelConfig, ColorWheelSpeed, GradientGenerationPolicy, TextColorizationPolicy,
 };
@@ -273,6 +275,7 @@ impl EnrollHandler {
         Ok(user_info)
     }
 
+    #[cfg(feature = "ui")]
     fn display_header(&self) {
         let ockam_header = include_str!("../../static/ockam_ascii.txt").trim();
         let gradient_steps = Vec::from(
@@ -299,6 +302,15 @@ impl EnrollHandler {
             .write_line(format!("{}\n", colored_header));
     }
 
+    #[cfg(not(feature = "ui"))]
+    fn display_header(&self) {
+        let ockam_header = include_str!("../../static/ockam_ascii.txt").trim();
+        let _ = self
+            .opts
+            .terminal
+            .write_line(format!("{}\n", ockam_header));
+    }
+
     fn ctrlc_handler(&self) {
         if !self.enable_ctrlc_signal {
             return;
@@ -309,21 +321,21 @@ impl EnrollHandler {
         ctrlc::set_handler(move || {
             if is_confirmation.load(Ordering::Relaxed) {
                 let message = fmt_ok!(
-                "Received Ctrl+C again. Canceling {}. Please try again.",
-                "autonomy cluster enroll".bold().light_yellow()
-            );
+                    "Received Ctrl+C again. Canceling {}. Please try again.",
+                    "autonomy cluster enroll".bold().light_yellow()
+                );
                 let _ = terminal.write_line(format!("\n{}", message).as_str());
                 process::exit(2);
             } else {
                 let message = fmt_warn!(
-                "{} is still in progress. Please press Ctrl+C again to stop the enrollment process.",
-                "autonomy cluster enroll".bold().light_yellow()
-            );
+                    "{} is still in progress. Please press Ctrl+C again to stop the enrollment process.",
+                    "autonomy cluster enroll".bold().light_yellow()
+                );
                 let _ = terminal.write_line(format!("\n{}", message).as_str());
                 is_confirmation.store(true, Ordering::Relaxed);
             }
         })
-            .expect("Error setting Ctrl-C handler");
+        .expect("Error setting Ctrl-C handler");
     }
 
     #[instrument(skip_all, level = Level::TRACE)]
```

---

### Incident Patch 6: `1b864d0c` (2026-01-02)
**Commit Message**: fix: update tracing-subscriber to 0.3.20 to fix ANSI escape sequence injection vulnerability

**File**: `implementations/rust/ockam/ockam_api/Cargo.toml` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ tracing-appender = "0.2.2"
 tracing-core = { version = "0.1.32", default-features = false }
 tracing-error = "0.2.0"
 tracing-opentelemetry = "0.28"
-tracing-subscriber = { version = "0.3", features = ["json"] }
+tracing-subscriber = { version = "0.3.20", features = ["json"] }
 url = "2.5.2"
 utoipa = { version = "^5.3", features = ["yaml", "openapi_extensions", "non_strict_integers"] }
 
```

**File**: `implementations/rust/ockam/ockam_core/Cargo.toml` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ tinyvec = { version = "1.8.0", features = ["rustc_1_57"] }
 tracing = { version = "0.1", default-features = false, features = ["log"] }
 tracing-error = { version = "0.2", default-features = false, optional = true }
 tracing-opentelemetry = { version = "0.28", optional = true }
-tracing-subscriber = { version = "0.3", features = ["fmt", "env-filter"], optional = true }
+tracing-subscriber = { version = "0.3.20", features = ["fmt", "env-filter"], optional = true }
 # Wasn't tested on no_std
 utcnow = { version = "0.2.5", default-features = false, features = ["fallback"], optional = true }
 
```

**File**: `implementations/rust/ockam/ockam_node/Cargo.toml` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ tokio-retry = { version = "0.3.0", optional = true }
 tracing = { version = "0.1", default-features = false }
 tracing-error = { version = "0.2", optional = true }
 tracing-opentelemetry = { version = "0.28", optional = true }
-tracing-subscriber = { version = "0.3", features = ["fmt", "env-filter"], optional = true }
+tracing-subscriber = { version = "0.3.20", features = ["fmt", "env-filter"], optional = true }
 
 [dev-dependencies]
 hex = { version = "0.4", default-features = false }
```

**File**: `tools/docs/example_test_helper/Cargo.toml` (modified, +1/-1)
```diff
@@ -15,4 +15,4 @@ shellwords = "1.1"
 tempfile = "3"
 thiserror = "2.0.9"
 tracing = "0.1"
-tracing-subscriber = { version = "0.3", features = ["env-filter"] }
+tracing-subscriber = { version = "0.3.20", features = ["env-filter"] }
```

---

### Incident Patch 7: `32c068ed` (2025-11-01)
**Commit Message**: build: make ui deps optional

**File**: `implementations/rust/ockam/ockam_api/Cargo.toml` (modified, +6/-4)
```diff
@@ -44,6 +44,8 @@ storage = ["ockam/storage"]
 aws-lc = ["ockam_vault/aws-lc", "ockam_transport_tcp/aws-lc"]
 rust-crypto = ["ockam_vault/rust-crypto", "ockam_transport_tcp/ring"]
 privileged_portals = ["ockam_transport_tcp/privileged_portals"]
+encode_format = ["clap"]
+ui = ["encode_format", "r3bl_rs_utils_core", "r3bl_tui", "r3bl_tuify"]
 
 [[bin]]
 name = "node_control_api_schema"
@@ -57,7 +59,7 @@ base64-url = "3.0.0"
 bytes = { version = "=1.9.0", default-features = false, features = ["serde"] }
 cfg-if = "1.0.0"
 chrono = { version = "0.4" }
-clap = { version = "4.5", default-features = false, features = ["derive"] }
+clap = { version = "4.5", default-features = false, features = ["derive", "std"], optional = true }
 colorful = "0.3"
 colors-transform = "0.2"
 dialoguer = "0.11"
@@ -92,9 +94,9 @@ opentelemetry-proto = { version = "0.27", features = ["full"] }
 opentelemetry-semantic-conventions = { version = "0.28", features = ["semconv_experimental"] }
 opentelemetry_sdk = { version = "0.27", features = ["logs", "metrics", "trace", "rt-tokio", "rt-tokio-current-thread", "testing"], default-features = false }
 petname = { version = "2.0.2", default-features = false, features = ["default-rng", "default-words"] }
-r3bl_rs_utils_core = "0.9"
-r3bl_tui = "0.5"
-r3bl_tuify = "0.1"
+r3bl_rs_utils_core = { version = "0.9", optional = true }
+r3bl_tui = { version = "0.5", optional = true }
+r3bl_tuify = { version = "0.1", optional = true }
 rand = "0.8"
 regex = "1.10.6"
 reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls-native-roots"] }
```

**File**: `implementations/rust/ockam/ockam_api/src/lib.rs` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@
 #[macro_use]
 extern crate tracing;
 
+
+
 pub mod address;
 pub mod authenticator;
 pub mod cli_state;
```

**File**: `implementations/rust/ockam/ockam_api/src/ui/mod.rs` (modified, +87/-0)
```diff
@@ -1,4 +1,91 @@
+#[cfg(feature = "ui")]
 pub mod colors;
+
+#[cfg(not(feature = "ui"))]
+pub mod colors {
+    use colorful::{core::color_string::CString, Colorful, RGB};
+    use std::fmt::Display;
+
+    #[derive(Copy, Clone, PartialEq, Eq, Debug)]
+    pub enum OckamColor {
+        OckamBlue,
+        HeaderGradient,
+        PrimaryResource,
+        Success,
+        Failure,
+        FmtOKBackground,
+        FmtINFOBackground,
+        FmtWARNBackground,
+        FmtERRORBackground,
+        FmtLISTBackground,
+    }
+
+    impl OckamColor {
+        /// Hex string value for this color (kept consistent w/ full UI feature version).
+        pub fn value(&self) -> &'static str {
+            match self {
+                OckamColor::OckamBlue => "#52c7ea",
+                OckamColor::HeaderGradient => "#4FDAB8",
+                OckamColor::PrimaryResource => "#4FDAB8",
+                OckamColor::Success => "#A8C97D",
+                OckamColor::Failure => "#ff0000",
+                OckamColor::FmtOKBackground => "#A8C97D",
+                OckamColor::FmtINFOBackground => "#0DCAF0",
+                OckamColor::FmtWARNBackground => "#ff9a00",
+                OckamColor::FmtERRORBackground => "#FF0000",
+                OckamColor::FmtLISTBackground => "#0DCAF0",
+            }
+        }
+        pub fn color(&self) -> RGB {
+            // Provide simple, hard-coded fallback colors that don't require r3bl_* crates.
+            match self {
+                OckamColor::OckamBlue => RGB::new(0x52, 0xC7, 0xEA),
+                OckamColor::HeaderGradient => RGB::new(0x4F, 0xDA, 0xB8),
+                OckamColor::PrimaryResource => RGB::new(0x4F, 0xDA, 0xB8),
+                OckamColor::Success => RGB::new(0xA8, 0xC9, 0x7D),
+                OckamColor::Failure => RGB::new(0xFF, 0x00, 0x00),
+                OckamColor::FmtOKBackground => RGB::new(0xA8, 0xC9, 0x7D),
+                OckamColor::FmtINFOBackground => RGB::new(0x0D, 0xCA, 0xF0),
+                OckamColor::FmtWARNBackground => RGB::new(0xFF, 0x9A, 0x00),
+                OckamColor::FmtERRORBackground => RGB::new(0xFF, 0x00, 0x00),
+                OckamColor::FmtLISTBackground => RGB::new(0x0D, 0xCA, 0xF0),
+            }
+        }
+    }
+
+    // Re-exported macro to keep parity w/ full UI feature.
+    #[macro_export]
+    macro_rules! color {
+        ($text:expr, $color:expr) => {
+            $text.to_string().color($color.color())
+        };
+    }
+
+    pub fn color_primary(input: impl Display) -> CString {
+        input.to_string().color(OckamColor::PrimaryResource.color())
+    }
+    pub fn color_primary_alt(input: impl Display) -> String {
+        // Fallback: no gradient, just plain text
+        input.to_string()
+    }
+    pub fn color_ok(input: impl Display) -> CString {
+        input.to_string().color(OckamColor::FmtOKBackground.color())
+    }
+    pub fn color_warn(input: impl Display) -> CString {
+        input.to_string().color(OckamColor::FmtWARNBackground.color())
+    }
+    pub fn color_error(input: impl Display) -> CString {
+        input.to_string().color(OckamColor::FmtERRORBackground.color())
+    }
+    pub fn color_email(input: impl Display) -> CString {
+        input.to_string().color(OckamColor::PrimaryResource.color())
+    }
+    pub fn color_uri(input: impl Display) -> String {
+        // Fallback: no gradient
+        input.to_string()
+    }
+}
+
 pub mod command;
 pub mod output;
 pub mod terminal;
```

**File**: `implementations/rust/ockam/ockam_api/src/ui/output/mod.rs` (modified, +17/-0)
```diff
@@ -1,11 +1,28 @@
 mod branding;
+#[cfg(feature = "encode_format")]
 mod encode_format;
 mod ockam_abac;
 mod output_format;
 mod utils;
 
 pub use branding::OutputBranding;
+#[cfg(feature = "encode_format")]
 pub use encode_format::EncodeFormat;
+
+#[cfg(not(feature = "encode_format"))]
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum EncodeFormat {
+    Plain,
+    Hex,
+}
+
+#[cfg(not(feature = "encode_format"))]
+impl EncodeFormat {
+    pub fn encode_value<T: Output>(&self, value: &T) -> crate::Result<String> {
+        // Fallback: without the encode_format feature, both variants just return the plain item.
+        value.item()
+    }
+}
 pub use output_format::OutputFormat;
 pub use utils::*;
 
```

**File**: `implementations/rust/ockam/ockam_api/src/ui/terminal/fmt.rs` (modified, +17/-9)
```diff
@@ -8,16 +8,24 @@ pub const MIETTE_PADDING: &str = "  ";
 pub const INDENTATION: &str = "  ";
 
 pub fn get_separator_width() -> usize {
-    // If we can't get the terminal width, use the default width
-    let mut terminal_width = r3bl_tuify::get_terminal_width();
-    if terminal_width == 0 {
-        terminal_width = r3bl_tuify::DEFAULT_WIDTH;
+    // When the full UI feature is enabled, use dynamic terminal sizing from r3bl_tuify.
+    #[cfg(feature = "ui")]
+    {
+        let mut terminal_width = r3bl_tuify::get_terminal_width();
+        if terminal_width == 0 {
+            terminal_width = r3bl_tuify::DEFAULT_WIDTH;
+        }
+        let terminal_width = std::cmp::max(terminal_width, 2 * PADDING.len());
+        return std::cmp::min(terminal_width - PADDING.len(), r3bl_tuify::DEFAULT_WIDTH);
+    }
+
+    // Fallback when `ui` feature (and thus r3bl_tuify) is disabled: use a fixed width.
+    #[cfg(not(feature = "ui"))]
+    {
+        // Pick a sane default (80 cols) minus left padding, but never under 10.
+        let width = 80usize.saturating_sub(PADDING.len());
+        std::cmp::max(width, 10)
     }
-    // Make sure the separator width is at least twice the length of the padding.
-    // We want to show a small separator even if the terminal is too narrow.
-    let terminal_width = std::cmp::max(terminal_width, 2 * PADDING.len());
-    // Limit the separator width to the default width
-    std::cmp::min(terminal_width - PADDING.len(), r3bl_tuify::DEFAULT_WIDTH)
 }
 
 #[test]
```

**File**: `implementations/rust/ockam/ockam_api/src/ui/terminal/highlighting.rs` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ use syntect::util::{as_24_bit_terminal_escaped, LinesWithEndings};
 pub static SYNTAX_SET_NEWLINES: Lazy<SyntaxSet> = Lazy::new(SyntaxSet::load_defaults_newlines);
 
 pub static THEME: Lazy<Theme> = Lazy::new(|| {
-    let mut theme_set = ThemeSet::load_defaults();
+    let mut theme_set = ThemeSet::default();
     let default_theme = theme_set.themes.remove("base16-ocean.dark").unwrap_or(
         theme_set.themes.remove("base16-ocean.light").unwrap_or(
             theme_set
```

**File**: `implementations/rust/ockam/ockam_api/src/ui/terminal/mod.rs` (modified, +37/-1)
```diff
@@ -15,8 +15,24 @@ use indicatif::{ProgressBar, ProgressDrawTarget, ProgressStyle};
 use jaq_interpret::{Ctx, FilterT, ParseCtx, RcIter, Val};
 use miette::{miette, IntoDiagnostic};
 use ockam_core::env::get_env_with_default;
+#[cfg(feature = "ui")]
+#[allow(unused_imports)]
 use r3bl_rs_utils_core::{ch, ChUnit};
+
+
+#[cfg(feature = "ui")]
 use r3bl_tuify::{get_size, select_from_list, SelectionMode, StyleSheet};
+#[cfg(not(feature = "ui"))]
+#[allow(dead_code)]
+pub(crate) fn get_size() -> (usize, usize) {
+    (80, 24)
+}
+#[cfg(not(feature = "ui"))]
+#[allow(dead_code)]
+pub(crate) fn select_from_list<T: Clone>(_: &str, items: &[T]) -> Option<T> {
+    items.first().cloned()
+}
+
 use serde::Serialize;
 use std::fmt::Write as _;
 use std::fmt::{Debug, Display};
@@ -139,7 +155,13 @@ impl<W: TerminalWriter + Debug> Terminal<W> {
         let no_input = Self::should_disable_user_input(no_input);
         let stdout = W::stdout(no_color, OutputBranding::default());
         let stderr = W::stderr(no_color, OutputBranding::default());
-        let max_width_col_count = get_size().map(|it| it.col_count).unwrap_or(ch!(80)).into();
+        #[cfg(feature = "ui")]
+        let max_width_col_count: usize = get_size().map(|it| it.col_count.into()).unwrap_or(80);
+        #[cfg(not(feature = "ui"))]
+        let max_width_col_count = {
+            let (cols, _rows) = get_size();
+            cols
+        };
         Self {
             stdout,
             stderr,
@@ -186,6 +208,7 @@ impl<W: TerminalWriter + Debug> Terminal<W> {
         }
     }
 
+    #[cfg(feature = "ui")]
     pub fn confirm_interactively(&self, header: String) -> bool {
         let user_input = select_from_list(
             header,
@@ -202,8 +225,15 @@ impl<W: TerminalWriter + Debug> Terminal<W> {
         }
     }
 
+    #[cfg(not(feature = "ui"))]
+    pub fn confirm_interactively(&self, header: String) -> bool {
+        let user_input = select_from_list(&header, &["YES".to_string(), "NO".to_string()]);
+        matches!(user_input, Some(ref it) if it == "YES")
+    }
+
     /// Returns the selected items by the user, or an empty `Vec` if the user did not select any item
     /// or if the user is not able to select an item (e.g. not a TTY, `--no-input` flag, etc.).
+    #[cfg(feature = "ui")]
     pub fn select_multiple(&self, header: String, items: Vec<String>) -> Vec<String> {
         if !self.can_ask_for_user_input() {
             return Vec::new();
@@ -221,6 +251,12 @@ impl<W: TerminalWriter + Debug> Terminal<W> {
         user_selected_list.unwrap_or_default()
     }
 
+    #[cfg(not(feature = "ui"))]
+    pub fn select_multiple(&self, _header: String, _items: Vec<String>) -> Vec<String> {
+        // Fallback: interactive multi-selection unavailable without `ui` feature.
+        Vec::new()
+    }
+
     pub fn can_ask_for_user_input(&self) -> bool {
         !self.no_input && self.stderr.is_tty() && !self.quiet
     }
```

**File**: `implementations/rust/ockam/ockam_command/Cargo.toml` (modified, +2/-0)
```diff
@@ -77,6 +77,7 @@ ockam = { path = "../ockam", version = "^0.157.0", features = [
 ockam_abac = { path = "../ockam_abac", version = "0.84.0", features = ["std"] }
 ockam_api = { path = "../ockam_api", version = "0.100.0", default-features = false, features = [
   "std",
+  "ui",
 ] }
 ockam_core = { path = "../ockam_core", version = "^0.126.0" }
 ockam_multiaddr = { path = "../ockam_multiaddr", version = "0.71.0", features = [
@@ -130,6 +131,7 @@ zip-extract = "0.2.3"
 assert_cmd = "2"
 mockito = "1.5.0"
 ockam_api = { path = "../ockam_api", version = "0.100.0", default-features = false, features = [
+  "ui",
   "test-utils",
 ] }
 ockam_macros = { path = "../ockam_macros", version = "^0.39.0" }
```

---

### Incident Patch 8: `02e9b51d` (2025-07-01)
**Commit Message**: fix: fix an initialization error when using set_log_level

**File**: `implementations/python/python/ockam/logging/logging.py` (modified, +4/-1)
```diff
@@ -4,7 +4,6 @@
 import logging.config
 from typing import Protocol
 
-
 DEFAULT_LOG_FORMAT = os.getenv(
     "DEFAULT_LOG_FORMAT", "%(asctime)s %(log_color)s%(levelname)5s%(reset)s %(name)-14s %(message)s"
 )
@@ -39,11 +38,15 @@ def set_log_level(module_name: str, level: str):
     Set the log level for a specific module.
     """
     global LOG_LEVELS
+    if not LOG_LEVELS:
+        LOG_LEVELS = create_log_levels(None)
     LOG_LEVELS[module_name] = level.upper()
 
 
 def set_log_levels(log_levels: str):
     global LOG_LEVELS
+    if not LOG_LEVELS:
+        LOG_LEVELS = create_log_levels(None)
     LOG_LEVELS = create_log_levels(log_levels)
 
     # By default, silence the Ockam rust modules
```

**File**: `implementations/python/python/ockam/models/model.py` (modified, +13/-13)
```diff
@@ -260,9 +260,9 @@ def __init__(self, name, max_input_tokens=None, **kwargs):
         # Extract the model identifier for both bedrock and litellm_proxy paths
         model_identifier = None
         if self.name.startswith("bedrock/"):
-            model_identifier = self.name[len("bedrock/"):]
+            model_identifier = self.name[len("bedrock/") :]
         elif self.name.startswith("litellm_proxy/"):
-            model_identifier = self.name[len("litellm_proxy/"):]
+            model_identifier = self.name[len("litellm_proxy/") :]
 
         # Apply inference profile if needed
         if model_identifier and "model_id" not in kwargs:
@@ -283,7 +283,7 @@ def __init__(self, name, max_input_tokens=None, **kwargs):
                         )
 
     def count_tokens(
-            self, messages: List[dict] | List[ConversationMessage], is_thinking: bool = False, tools=None
+        self, messages: List[dict] | List[ConversationMessage], is_thinking: bool = False, tools=None
     ) -> int:
         messages, kwargs = self.prepare_llm_call(messages, is_thinking)
 
@@ -313,11 +313,11 @@ def support_forced_assistant_answer(self):
         return "bedrock" not in self.name and "litellm_proxy" not in self.name
 
     async def complete_chat(
-            self,
-            messages: List[dict] | List[ConversationMessage],
-            stream: bool = False,
-            is_thinking: bool = False,
-            **kwargs,
+        self,
+        messages: List[dict] | List[ConversationMessage],
+        stream: bool = False,
+        is_thinking: bool = False,
+        **kwargs,
     ):
         """
         Send a chat completion request to the model.
@@ -402,7 +402,7 @@ async def _complete_chat(self, messages: List[dict], **kwargs):
         end_think_tag = response.choices[0].message.content.find("</think>")
         if end_think_tag != -1:
             thinking_content = response.choices[0].message.content[:end_think_tag].replace("<think>", "")
-            non_thinking_content = response.choices[0].message.content[end_think_tag + len("</think>"):]
+            non_thinking_content = response.choices[0].message.content[end_think_tag + len("</think>") :]
 
             response.choices[0].message.reasoning_content = thinking_content
             response.choices[0].message.content = non_thinking_content
@@ -449,10 +449,10 @@ def router(self):
 
 
 def normalize_messages(
-        messages: List[dict] | List[ConversationMessage],
-        is_thinking: bool,
-        tools_supported: bool,
-        forced_assistant_answer_supported: bool,
+    messages: List[dict] | List[ConversationMessage],
+    is_thinking: bool,
+    tools_supported: bool,
+    forced_assistant_answer_supported: bool,
 ) -> List[dict]:
     messages = deepcopy(messages)
 
```

---

### Incident Patch 9: `7890c5df` (2025-06-30)
**Commit Message**: fix: only persist memory in the database if env. variables are defined

**File**: `implementations/python/python/ockam/memory/memory.py` (modified, +17/-13)
```diff
@@ -32,7 +32,9 @@ def __init__(self):
         self.instructions = []
         self.conversations = defaultdict(lambda: defaultdict(list[dict]))
 
-        self.initialize_database()
+        if "OCKAM_DATABASE_INSTANCE" in environ:
+            self.initialize_database()
+
         self.load_conversations()
 
     def initialize_database(self):
@@ -47,12 +49,13 @@ def initialize_database(self):
         self.connection: psycopg.Connection[dict] = psycopg.connect(self.db_url, row_factory=dict_row)
 
     def load_conversations(self):
-        with self.connection.cursor() as cur:  # pylint: disable=E1101
-            cur.execute("SELECT scope, conversation, message FROM conversation")
-            rows = cur.fetchall()
-            for row in rows:
-                message = json.loads(row["message"])
-                self.conversations[row["scope"]][row["conversation"]].append(message)
+        if self.connection:
+            with self.connection.cursor() as cur:  # pylint: disable=E1101
+                cur.execute("SELECT scope, conversation, message FROM conversation")
+                rows = cur.fetchall()
+                for row in rows:
+                    message = json.loads(row["message"])
+                    self.conversations[row["scope"]][row["conversation"]].append(message)
 
     def set_instructions(self, instructions: dict):
         with self.lock:
@@ -61,12 +64,13 @@ def set_instructions(self, instructions: dict):
     def add_message(self, scope: str, conversation: str, message: dict):
         with self.lock:
             self.conversations[scope][conversation].append(message)
-            with self.connection.cursor() as cur:  # pylint: disable=E1101
-                cur.execute(
-                    "INSERT INTO conversation (tenant_id, scope, conversation, message) VALUES (%s, %s, %s, %s)",
-                    (self.tenant_id, scope, conversation, json.dumps(message)),
-                )
-                self.connection.commit()  # pylint: disable=E1101
+            if self.connection:
+                with self.connection.cursor() as cur:  # pylint: disable=E1101
+                    cur.execute(
+                        "INSERT INTO conversation (tenant_id, scope, conversation, message) VALUES (%s, %s, %s, %s)",
+                        (self.tenant_id, scope, conversation, json.dumps(message)),
+                    )
+                    self.connection.commit()  # pylint: disable=E1101
 
     def get_messages(self, scope: str, conversation: str) -> list[dict]:
         with self.lock:
```

---

### Incident Patch 10: `118ee123` (2025-06-30)
**Commit Message**: fix: output for `zone list` when there are no zones for a cluster

**File**: `implementations/rust/ockam/ockam_command/src/zone/list.rs` (modified, +13/-11)
```diff
@@ -56,17 +56,19 @@ impl InMemoryNodeCommand for ListNodeCommand {
             cluster: cluster.clone(),
             zones: zones.clone(),
         };
-        let mut plain = fmt_ok!("Your cluster {}\n", color_primary(&cluster));
-        if !zones.is_empty() {
-            plain += &fmt_log!(
-                "has the zones: {}",
-                zones
-                    .iter()
-                    .map(|z| color_primary(z).to_string())
-                    .collect::<Vec<_>>()
-                    .join(", ")
-            );
-        }
+        let plain = if !zones.is_empty() {
+            fmt_ok!("Your cluster {}\n", color_primary(&cluster))
+                + &fmt_log!(
+                    "has the zones: {}",
+                    zones
+                        .iter()
+                        .map(|z| color_primary(z).to_string())
+                        .collect::<Vec<_>>()
+                        .join(", ")
+                )
+        } else {
+            fmt_log!("Your cluster {} has no zones", color_primary(&cluster))
+        };
         self.opts
             .terminal
             .clone()
```

---

### Incident Patch 11: `c564ac15` (2025-06-30)
**Commit Message**: fix: install script when there is a running ockam process

Instead of replacing the old binary with curl, we first download it
to a temporary file, set the permissions, and then use `mv` to
replace the old binary.

**File**: `tools/install.sh` (modified, +7/-4)
```diff
@@ -198,12 +198,15 @@ download() {
 
   _url="$_download_base_url/$_version/$_binary_file_name"
 
+  # Download to a temporary file first
   info "Downloading $_url"
-  curl --proto '=https' --tlsv1.2 --location --silent --fail --show-error --output "$install_path/bin/ockam" "$_url"
-  info "Downloaded ockam binary at the specified directory: $install_path/bin/ockam"
+  curl --proto '=https' --tlsv1.2 --location --silent --fail --show-error --output "$install_path/bin/ockam.new" "$_url"
 
-  info "Granting permission to execute: chmod u+x $install_path/bin/ockam"
-  chmod u+x "$install_path/bin/ockam"
+  info "Granting permission to execute"
+  chmod u+x "$install_path/bin/ockam.new"
+
+  # Replace the old binary
+  mv -f "$install_path/bin/ockam.new" "$install_path/bin/ockam"
 }
 
 create_bin() {
```

---

### Incident Patch 12: `7f4235bc` (2025-06-27)
**Commit Message**: feat: add timeout to `zone inlet/outlet` creation when waiting for the portal to be up

**File**: `implementations/rust/ockam/ockam_command/src/node/util.rs` (modified, +2/-2)
```diff
@@ -259,7 +259,7 @@ pub async fn wait_for_node_callback_process(
     );
     tokio::select! {
         res = handle.wait() => {
-            trace!(?res, "node output drained");
+            trace!(?res, "node process exited");
             let status = res.into_diagnostic()?;
             if !status.success() {
                 std::process::exit(status.code().unwrap_or(1));
@@ -282,7 +282,7 @@ pub async fn wait_for_node_callback_future(
     );
     tokio::select! {
         res = handle => {
-            trace!(?res, "node output drained");
+            trace!(?res, "node process exited");
             res.into_diagnostic()?
         }
         res = node_callback.wait_for_signal() => {
```

**File**: `implementations/rust/ockam/ockam_command/src/zone/attach.rs` (modified, +1/-6)
```diff
@@ -2,9 +2,7 @@ use crate::cluster::common_args::HttpApiArgs;
 use crate::entry_point::RUNTIME;
 use crate::node_command::InMemoryNodeCommand;
 use crate::util::port_is_free_guard;
-use crate::zone::common_args::{
-    EnrollmentTicketConfigArg, ZoneConfigArg, ZoneInletsArgs, ZoneNameOrConfigArg,
-};
+use crate::zone::common_args::{ZoneConfigArg, ZoneInletsArgs, ZoneNameOrConfigArg};
 use crate::zone::ctrlc::ZoneCtrlcHandler;
 use crate::zone::get_cluster_name::GetClusterName;
 use crate::zone::repl::ReplCommand;
@@ -200,9 +198,6 @@ impl AttachCommand {
             zone: ZoneNameOrConfigArg::from_zone_name(zone_name.to_string()),
             http_api: self.http_api.clone(),
             pod: Some(pod_name.to_string()),
-            enrollment_ticket: EnrollmentTicketConfigArg {
-                enrollment_ticket: None,
-            },
             from: Some(from.clone()),
             to: Some(to.to_string()),
             background: true,
```

**File**: `implementations/rust/ockam/ockam_command/src/zone/common_args.rs` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ pub struct EnrollmentTicketConfigArg {
     #[arg(long, env = "ENROLLMENT_TICKET", value_name = "ENROLLMENT TICKET")]
     #[arg(help = docs::about("\
     A path, URL or inlined hex-encoded enrollment ticket to use for the Ockam Identity associated to this node. \
-    If ommited one will be created automatically with default attributes
+    If omitted, one will be created automatically with default attributes
     "))]
     pub enrollment_ticket: Option<String>,
 }
```

**File**: `implementations/rust/ockam/ockam_command/src/zone/inlet.rs` (modified, +17/-2)
```diff
@@ -20,6 +20,7 @@ use ockam_api::CliState;
 use ockam_node::Context;
 use std::str::FromStr;
 use std::sync::Arc;
+use std::time::Duration;
 
 const LONG_ABOUT: &str = include_str!("./static/inlet/long_about.txt");
 const PREVIEW_TAG: &str = include_str!("../static/preview_tag.txt");
@@ -102,9 +103,10 @@ impl InMemoryNodeCommand for InletNodeCommand {
             .await?;
         let relay_name = format!("{}-{}-{}", cluster, zone_name, self.command.pod());
         let outlet_name = self.command.to.as_deref().unwrap_or(self.command.pod());
+        let inlet_from = self.command.from();
         let mut node_config = serde_json::json!({
             "tcp-inlet": {
-                "from": self.command.from().to_string(),
+                "from": inlet_from.to_string(),
                 "to": outlet_name,
                 "via": relay_name
             }
@@ -143,7 +145,20 @@ impl InMemoryNodeCommand for InletNodeCommand {
             res
         });
         if let Some(node_callback) = node_callback {
-            wait_for_node_callback_future(handle, node_callback).await?;
+            tokio::select! {
+                res = wait_for_node_callback_future(handle, node_callback) => {
+                    res
+                },
+                _ = tokio::time::sleep(Duration::from_secs(60)) => {
+                    // Check if the outlet address is reachable or return an error
+                    let addr = inlet_from.hostname_port().to_string();
+                    if let Err(e) = tokio::net::TcpStream::connect(&addr).await {
+                        Err(miette::miette!(e).wrap_err(miette::miette!("Inlet failed to start at {}", addr)))
+                    } else {
+                        Ok(())
+                    }
+                }
+            }?
         } else {
             handle.await.into_diagnostic()??;
         }
```

**File**: `implementations/rust/ockam/ockam_command/src/zone/outlet.rs` (modified, +17/-3)
```diff
@@ -19,6 +19,7 @@ use ockam_api::nodes::InMemoryNode;
 use ockam_api::CliState;
 use ockam_node::Context;
 use std::sync::Arc;
+use std::time::Duration;
 
 const LONG_ABOUT: &str = include_str!("./static/outlet/long_about.txt");
 const PREVIEW_TAG: &str = include_str!("../static/preview_tag.txt");
@@ -111,8 +112,8 @@ impl InMemoryNodeCommand for OutletNodeCommand {
         let mut node_config = serde_json::json!({
             "relay": relay_name,
             "tcp-outlet": {
-                "to": self.command.to.to_string(),
-                }
+              "to": self.command.to.to_string(),
+            }
         });
         let from = &self.command.from.as_ref().unwrap_or(&self.command.relay);
         node_config["tcp-outlet"]["from"] = from.to_string().into();
@@ -150,7 +151,20 @@ impl InMemoryNodeCommand for OutletNodeCommand {
             res
         });
         if let Some(node_callback) = node_callback {
-            wait_for_node_callback_future(handle, node_callback).await?;
+            tokio::select! {
+                res = wait_for_node_callback_future(handle, node_callback) => {
+                    res
+                },
+                _ = tokio::time::sleep(Duration::from_secs(60)) => {
+                    // Check if the outlet address is reachable or return an error
+                    let addr = self.command.to.to_string();
+                    if let Err(e) = tokio::net::TcpStream::connect(&addr).await {
+                        Err(miette::miette!(e).wrap_err(miette::miette!("Outlet failed to start at {}", addr)))
+                    } else {
+                        Ok(())
+                    }
+                }
+            }?
         } else {
             handle.await.into_diagnostic()??;
         }
```

---

### Incident Patch 13: `54dd2830` (2025-06-26)
**Commit Message**: fix: default logs outlet port

**File**: `implementations/rust/ockam/ockam_command/src/zone/zone_config.rs` (modified, +2/-2)
```diff
@@ -221,7 +221,7 @@ impl ZoneConfig {
                 .for_each(|pod| {
                     pod.portals.outlets.push(Outlet {
                         name: Some("logs".to_string()),
-                        to: "localhost:3000".to_string(),
+                        to: "localhost:32101".to_string(),
                         pod_name: Some("logs-pod".to_string()),
                         ..Default::default()
                     })
@@ -642,7 +642,7 @@ pods:
             .iter()
             .find(|o| o.name.as_deref() == Some("logs"))
             .expect("Default logs outlet not found");
-        assert_eq!(logs_outlet.to, "localhost:3000");
+        assert_eq!(logs_outlet.to, "localhost:32101");
         assert_eq!(logs_outlet.pod_name, Some("logs-pod".to_string()));
     }
 
```

---

### Incident Patch 14: `33940d8e` (2025-06-26)
**Commit Message**: fix: store user when importing an identity

**File**: `implementations/rust/ockam/ockam_api/src/cli_state/users.rs` (modified, +13/-0)
```diff
@@ -33,4 +33,17 @@ impl CliState {
             ))?,
         }
     }
+
+    #[instrument(skip_all, level = Level::TRACE)]
+    pub async fn get_user(&self, email: &EmailAddress) -> Result<UserInfo> {
+        let repository = self.users_repository();
+        match repository.get_user(email).await? {
+            Some(user) => Ok(user),
+            None => Err(Error::new(
+                Origin::Api,
+                Kind::NotFound,
+                format!("there is no user with email {email}"),
+            ))?,
+        }
+    }
 }
```

**File**: `implementations/rust/ockam/ockam_api/src/nodes/service/in_memory_node.rs` (modified, +4/-0)
```diff
@@ -63,6 +63,10 @@ impl InMemoryNode {
         self.node_manager.ctx()
     }
 
+    pub fn name(&self) -> &str {
+        &self.node_manager.node_name
+    }
+
     pub fn state(&self) -> Arc<CliState> {
         self.node_manager.state()
     }
```

**File**: `implementations/rust/ockam/ockam_command/src/identity/export.rs` (modified, +111/-2)
```diff
@@ -4,6 +4,7 @@ use clap::Args;
 use miette::IntoDiagnostic;
 use ockam::identity::Identity;
 use ockam_api::orchestrator::email_address::EmailAddress;
+use ockam_api::orchestrator::enroll::auth0::UserInfo;
 use ockam_node::Context;
 use ockam_vault::SigningSecret;
 use serde::{Deserialize, Serialize};
@@ -35,6 +36,11 @@ impl Command for ExportCommand {
             .get_identity_enrollment(&identity_name)
             .await?
             .and_then(|i| i.status().email().cloned());
+        let enrolled_user = match enrolled_email.as_ref() {
+            Some(email) => Some(opts.state.get_user(email).await?),
+            None => None,
+        };
+
         let named_identity = opts.state.get_named_identity(&identity_name).await?;
         let named_vault = opts
             .state
@@ -55,8 +61,13 @@ impl Command for ExportCommand {
             .identity_vault
             .export_key(&signing_secret_key_handle)
             .await?;
-        let exported_identity =
-            ExportedIdentity::new(&identity_name, enrolled_email, identity, signing_secret_key)?;
+        let exported_identity = ExportedIdentity::new(
+            &identity_name,
+            enrolled_email,
+            enrolled_user,
+            identity,
+            signing_secret_key,
+        )?;
         let as_string = exported_identity.export()?;
         opts.terminal.to_stdout().machine(as_string).write_line()?;
         Ok(())
@@ -66,7 +77,11 @@ impl Command for ExportCommand {
 #[derive(Serialize, Deserialize)]
 pub(super) struct ExportedIdentity {
     pub name: String,
+    // Kept for backward compatibility
+    #[serde(skip_serializing_if = "Option::is_none")]
     pub enrolled_email: Option<String>,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub enrolled_user: Option<String>,
     pub change_history: String,
     signing_secret: String,
     signing_secret_type: u8,
@@ -76,12 +91,16 @@ impl ExportedIdentity {
     pub fn new(
         name: &str,
         enrolled_email: Option<EmailAddress>,
+        enrolled_user: Option<UserInfo>,
         identity: Identity,
         signing_secret: SigningSecret,
     ) -> miette::Result<Self> {
         Ok(ExportedIdentity {
             name: name.to_string(),
             enrolled_email: enrolled_email.map(|e| e.to_string()),
+            enrolled_user: enrolled_user
+                .map(|e| serde_json::to_string(&e).into_diagnostic())
+                .transpose()?,
             change_history: identity.export_as_string()?,
             signing_secret: hex::encode(signing_secret.key()),
             signing_secret_type: signing_secret.type_as_u8(),
@@ -108,4 +127,94 @@ impl ExportedIdentity {
         let key_type = self.signing_secret_type;
         SigningSecret::from_key(&key, key_type).into_diagnostic()
     }
+
+    pub fn user_email(&self) -> miette::Result<Option<EmailAddress>> {
+        if let Some(email) = &self.enrolled_email {
+            Ok(Some(EmailAddress::parse(email)?))
+        } else {
+            Ok(None)
+        }
+    }
+
+    pub fn user(&self) -> miette::Result<Option<UserInfo>> {
+        if let Some(user_json) = &self.enrolled_user {
+            let user: UserInfo = serde_json::from_str(user_json).into_diagnostic()?;
+            Ok(Some(user))
+        } else {
+            Ok(None)
+        }
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_backward_compatibility_missing_enrolled_user() -> miette::Result<()> {
+        let json = r#"{"name":"test","enrolled_email":"user@example.com","change_history":"history","signing_secret":"secret123","signing_secret_type":1}"#;
+        let hex_encoded = hex::encode(json);
+
+        let deserialized = ExportedIdentity::from_hex(&hex_encoded)?;
+        assert_eq!(deserialized.name, "test");
+        assert_eq!(
+            deserialized.enrolled_email,
+            Some("user@example.com".to_string())
+        );
+        assert_eq!(deserialized.enrolled_user, None);
+        assert_eq!(deserialized.change_history, "history");
+        assert_eq!(deserialized.signing_secret, "secret123");
+        assert_eq!(deserialized.signing_secret_type, 1);
+
+        Ok(())
+    }
+
+    #[test]
+    fn test_exported_identity_optional_fields_serialization() -> miette::Result<()> {
+        // Only enrolled_email is defined
+        let identity1 = ExportedIdentity {
+            name: "id1".to_string(),
+            enrolled_email: Some("user@example.com".to_string()),
+            enrolled_user: None,
+            change_history: "history1".to_string(),
+            signing_secret: "secret1".to_string(),
+            signing_secret_type: 1,
+        };
+
+        // Only enrolled_user is defined
+        let identity2 = ExportedIdentity {
+            name: "id2".to_string(),
+            enrolled_email: None,
+            enrolled_user: Some(r#"{"name":"User Name","email":"user@example.com"}"#.to_string()),
+            change_history: "history2".to_string(),
+
```

**File**: `implementations/rust/ockam/ockam_command/src/identity/import.rs` (modified, +10/-4)
```diff
@@ -4,7 +4,6 @@ use colorful::Colorful;
 use ockam_api::cli_state::random_name;
 use ockam_api::colors::color_primary;
 use ockam_api::fmt_ok;
-use ockam_api::orchestrator::email_address::EmailAddress;
 use ockam_node::Context;
 
 use crate::identity::export::ExportedIdentity;
@@ -31,7 +30,8 @@ impl Command for ImportCommand {
         let exported_identity = ExportedIdentity::from_hex(&self.exported)?;
         let signing_secret = exported_identity.signing_secret()?;
         let change_history = exported_identity.hex_decoded_change_history()?;
-        let enrolled_email = exported_identity.enrolled_email;
+        let user_email = exported_identity.user_email()?;
+        let user = exported_identity.user()?;
         let identity_name = if opts
             .state
             .get_named_identity(&exported_identity.name)
@@ -60,11 +60,17 @@ impl Command for ImportCommand {
             .store_named_identity(&identifier, &identity_name, &vault_name)
             .await?;
 
-        if let Some(email) = enrolled_email {
+        if let Some(user_email) = user_email.as_ref() {
             opts.state
-                .set_identifier_as_enrolled(&identifier, &EmailAddress::parse(&email)?)
+                .set_identifier_as_enrolled(&identifier, user_email)
                 .await?;
         }
+        if let Some(user) = user {
+            opts.state
+                .set_identifier_as_enrolled(&identifier, &user.email)
+                .await?;
+            opts.state.store_user(&user).await?;
+        }
 
         opts.terminal
             .to_stdout()
```

**File**: `implementations/rust/ockam/ockam_command/src/status/mod.rs` (modified, +16/-4)
```diff
@@ -2,6 +2,7 @@ use async_trait::async_trait;
 use clap::Args;
 use colorful::Colorful;
 use miette::IntoDiagnostic;
+use ockam_api::orchestrator::project::ProjectsOrchestratorApi;
 use serde::Serialize;
 use std::fmt::Display;
 use std::sync::Arc;
@@ -23,7 +24,7 @@ use ockam_api::nodes::models::node::NodeResources;
 use ockam_api::nodes::{BackgroundNodeClient, InMemoryNode};
 use ockam_api::orchestrator::project::models::OrchestratorVersionInfo;
 use ockam_api::orchestrator::project::Project;
-use ockam_api::orchestrator::space::Space;
+use ockam_api::orchestrator::space::{Space, Spaces};
 use ockam_api::output::Output;
 use ockam_api::{fmt_heading, fmt_log, fmt_separator, fmt_warn};
 
@@ -64,15 +65,26 @@ impl InMemoryNodeCommand for StatusNodeCommand {
         let nodes = self
             .command
             .get_nodes_resources(node.ctx(), &self.opts)
-            .await?;
+            .await?
+            .into_iter()
+            .filter(|n| n.name != node.name())
+            .collect::<Vec<_>>();
         let controller = node.create_controller().await?;
         let orchestrator_version = controller
             .get_orchestrator_version_info(node.ctx())
             .await
             .map_err(|e| warn!(%e, "Failed to retrieve orchestrator version"))
             .unwrap_or_default();
-        let spaces = self.opts.state.get_spaces().await?;
-        let projects = self.opts.state.projects().get_projects().await?;
+        let spaces = if let Ok(spaces) = node.get_spaces().await {
+            spaces
+        } else {
+            self.opts.state.get_spaces().await?
+        };
+        let projects = if let Ok(projects) = node.get_admin_projects().await {
+            projects
+        } else {
+            self.opts.state.projects().get_projects().await?
+        };
         let status = StatusData::from_parts(
             orchestrator_version,
             spaces,
```

---

### Incident Patch 15: `327828ef` (2025-06-26)
**Commit Message**: fix(python): fix non-streaming agent logging

**File**: `implementations/python/python/ockam/agents/agent.py` (modified, +7/-5)
```diff
@@ -503,11 +503,13 @@ async def complete_chat(
             f"Sending {len(input_context)} messages from agent '{self.name}' to model '{self.model.original_name}'"
         )
         response = await self.model.complete_chat(tools=self.tool_specs, messages=input_context, stream=stream)
-        messages = [choice.message for choice in response.choices]
-        plural = "s" if len(messages) > 1 else ""
-        self.logger.info(
-            f"Received {len(messages)} message{plural} from model '{self.model.original_name}' for agent '{self.name}'"
-        )
+
+        if not stream:
+            messages = [choice.message for choice in response.choices]
+            plural = "s" if len(messages) > 1 else ""
+            self.logger.info(
+                f"Received {len(messages)} message{plural} from model '{self.model.original_name}' for agent '{self.name}'"
+            )
 
         if stream:
             tool_calls: Dict[int, ToolCall] = {}
```

#### Recent Merged Pull Requests:
- **PR #9257** (closed): fix: bump bytes to 1.11.1 and time to 0.3.47 for CVE remediation (@lucasthahn)
- **PR #9254** (closed): ci: bump github/codeql-action from 3.28.17 to 4.31.0 (@dependabot[bot])
- **PR #9253** (closed): ci: bump github/codeql-action from 3.28.17 to 4.30.9 (@dependabot[bot])
- **PR #9252** (closed): First Start (@sammyachon96-gif)
- **PR #9251** (closed): ci: bump github/codeql-action from 3.28.17 to 4.30.8 (@dependabot[bot])
- **PR #9248** (closed): ci: bump github/codeql-action from 3.28.17 to 4.30.7 (@dependabot[bot])
- **PR #9247** (closed): ci: bump crate-ci/typos from 1.32.0 to 1.38.0 (@dependabot[bot])
- **PR #9246** (closed): ci: bump crate-ci/typos from 1.32.0 to 1.37.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
