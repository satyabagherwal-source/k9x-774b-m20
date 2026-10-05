# Forensic Learning Record (Deep Inspection): fujiapple852/trippy

> **Canonical Artifact**: `07_PROJECT_LEARNING/fujiapple852-trippy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fujiapple852/trippy](https://github.com/fujiapple852/trippy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:38:50.157Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fujiapple852/trippy`
- **Description**: A network diagnostic tool 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 7969 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/trippy-core/src/config.rs`
```
use crate::types::Port;
use crate::{
    MaxInflight, MaxRounds, PacketSize, PayloadPattern, Sequence, TimeToLive, TraceId,
    TypeOfService,
};
use std::fmt::{Display, Formatter};
use std::net::{IpAddr, Ipv4Addr};
use std::time::Duration;

/// Default values for configuration.
pub mod defaults {
    use crate::config::IcmpExtensionParseMode;
    use crate::{MultipathStrategy, PrivilegeMode, Protocol};
    use std::time::Duration;

    /// The default value for `unprivileged`.
    pub const DEFAULT_PRIVILEGE_MODE: PrivilegeMode = PrivilegeMode::Privileged;

    /// The default value for `protocol`.
    pub const DEFAULT_STRATEGY_PROTOCOL: Protocol = Protocol::Icmp;

    /// The default value for `multipath-strategy`.
    pub const DEFAULT_STRATEGY_MULTIPATH: MultipathStrategy = MultipathStrategy::Classic;

    /// The default value for `icmp-extensions`.
    pub const DEFAULT_ICMP_EXTENSION_PARSE_MODE: IcmpExtensionParseMode =
        IcmpExtensionParseMode::Disabled;

    /// The default value for `max-inflight`.
    pub const DEFAULT_STRATEGY_MAX_INFLIGHT: u8 = 24;

    /// The default value for `first-ttl`.
    pub const DEFAULT_STRATEGY_FIRST_TTL: u8 = 1;

    /// The default value for `max-ttl`.
    pub const DEFAULT_STRATEGY_MAX_TTL: u8 = 64;

    /// The default value for `packet-size`.
    pub const DEFAULT_STRATEGY_PACKET_SIZE: u16 = 84;

    /// The default value for `payload-pattern`.
    pub const DEFAULT_STRATEGY_PAYLOAD_PATTERN: u8 = 0;

    /// The default value for `min-round-duration`.
    pub const DEFAULT_STRATEGY_MIN_ROUND_DURATION: Duration = Duration::from_millis(1000);

    /// The default value for `max-round-duration`.
    pub const DEFAULT_STRATEGY_MAX_ROUND_DURATION: Duration = Duration::from_millis(1000);

    /// The default value for `initial-sequence`.
    pub const DEFAULT_STRATEGY_INITIAL_SEQUENCE: u16 = 33434;

    /// The default value for `tos`.
    pub const DEFAULT_STRATEGY_TOS: u8 = 0;

    /// The default value for `read-timeout`.
    pub const DEFAULT_STRATEGY_READ_TIMEOUT: Duration = Duration::from_millis(10);

    /// The default value for `grace-duration`.
    pub const DEFAULT_STRATEGY_GRACE_DURATION: Duration = Duration::from_millis(100);

    /// The default TCP connect timeout.
    pub const DEFAULT_STRATEGY_TCP_CONNECT_TIMEOUT: Duration = Duration::from_millis(1000);

    /// The default value for `max-samples`.
    pub const DEFAULT_MAX_SAMPLES: usize = 256;

    /// The default value for `max-flows`.
    pub const DEFAULT_MAX_FLOWS: usize = 64;
}

/// The privilege mode.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum PrivilegeMode {
    /// Privileged mode.
    Privileged,
    /// Unprivileged mode.
    Unprivileged,
}

impl PrivilegeMode {
    #[must_use]
    pub const fn is_unprivileged(self) -> bool {
        match self {
            Self::Privileged => false,
            Self::Unprivileged => true,
        }
    }
}

impl Display for PrivilegeMode {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Privileged => write!(f, "privileged"),
            Self::Unprivileged => write!(f, "unprivileged"),
        }
    }
}

/// The ICMP extension parsing mode.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum IcmpExtensionParseMode {
    /// Do not parse ICMP extensions.
    Disabled,
    /// Parse ICMP extensions.
    Enabled,
}

impl IcmpExtensionParseMode {
    #[must_use]
    pub const fn is_enabled(self) -> bool {
        match self {
            Self::Disabled => false,
            Self::Enabled => true,
        }
    }
}

impl Display for IcmpExtensionParseMode {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Disabled => write!(f, "disabled"),
            Self::Enabled => write!(f, "enabled"),
        }
    }
}

/// The tracing protocol.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum Protocol {
    /// Internet Control Message Protocol
    Icmp,
    /// User Datagram Protocol
    Udp,
    /// Transmission Control Protocol
    Tcp,
}

impl Display for Protocol {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Icmp => write!(f, "icmp"),
            Self::Udp => write!(f, "udp"),
            Self::Tcp => write!(f, "tcp"),
        }
    }
}

/// The [Equal-cost Multi-Path](https://en.wikipedia.org/wiki/Equal-cost_multi-path_routing) routing strategy.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum MultipathStrategy {
    /// The src or dest port is used to store the sequence number.
    ///
    /// This does _not_ allow fixing both the src and dest port and so `PortDirection::Both` and
    /// `SequenceField::Port` are mutually exclusive.
    Classic,
    /// The UDP `checksum` field is used to store the sequence number.
    ///
    /// a.k.a. [`paris`](https://github.com/libparistraceroute/libparistraceroute/wiki/Checksum) traceroute approach.
    ///
    /// This requires that the UDP payload contains a well-chosen value to ensure the UDP checksum
    /// remains valid for the packet and therefore this cannot be used along with a custom
    /// payload pattern.
    Paris,
    /// The IP `identifier` field is used to store the sequence number.
    ///
    /// a.k.a. [`dublin`](https://github.com/insomniacslk/dublin-traceroute) traceroute approach.
    ///
    /// The allow either the src or dest or both ports to be fixed.
    ///
    /// If either of the src or dest port may vary (i.e. `PortDirection::FixedSrc` or
    /// `PortDirection::FixedDest`) then the port number is set to be the `initial_sequence`
    /// plus the round number to ensure that there is a fixed `flowid` (protocol, src ip/port,
    /// dest ip/port) for all packets in a given tracing round.  Each round may
    /// therefore discover different paths.
    ///
    /// If both src and dest ports are fixed (i.e. `PortDirection::FixedBoth`) then every packet in
    /// every round will share the same `flowid` and thus only a single path will be
    /// discovered.
    Dublin,
}

impl Display for MultipathStrategy {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Classic => write!(f, "classic"),
            Self::Paris => write!(f, "paris"),
            Self::Dublin => write!(f, "dublin"),
        }
    }
}

/// Whether to fix the src, dest or both ports for a trace.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum PortDirection {
    /// Trace without any source or destination port (i.e. for ICMP tracing).
    None,
    /// Trace from a fixed source port to a variable destination port (i.e. 5000 -> *).
    ///
    /// This is the default direction for UDP tracing.
    FixedSrc(Port),
    /// Trace from a variable source port to a fixed destination port (i.e. * -> 80).
    ///
    /// This is the default direction for TCP tracing.
    FixedDest(Port),
    /// Trace from a fixed source port to a fixed destination port (i.e. 5000 -> 80).
    ///
    /// When both ports are fixed another element of the IP header is required to vary per probe
    /// such that probes can be identified.  Typically, this is only used for UDP, whereby the
    /// checksum is manipulated by adjusting the payload and therefore used as the identifier.
    ///
    /// Note that this case is not currently implemented.
    FixedBoth(Port, Port),
}

impl PortDirection {
    #[must_use]
    pub const fn new_fixed_src(src: u16) -> Self {
        Self::FixedSrc(Port(src))
    }

    #[must_use]
    pub const fn new_fixed_dest(dest: u16) -> Self {
        Self::FixedDest(Port(dest))
    }

    #[must_use]
    pub const fn new_fixed_both(src: u16, dest: u16) -> Self {
        Self::FixedBoth(Port(src), Port(dest))
    }

    #[must_use]
    pub const fn src(&self) -> Option<Port> {
        match *self {
            Self::FixedSrc(src) | Self::FixedBoth(src, _) => Some(src),
            _ => None,
        }
    }
    #[must_use]
  
```

### Core Architecture Module: `crates/trippy-core/src/constants.rs`
```
/// The maximum time-to-live value allowed.
///
/// The IP `ttl` is an u8 (0..255) but since a `ttl` of zero isn't useful we only allow 254 distinct
/// hops (1..255).
pub const MAX_TTL: u8 = 254;

/// The maximum number of sequence numbers allowed per round.
///
/// This is set to be far larger than the `MAX_TTL` to allow for the re-issue of probes (with the
/// next sequence number, but the same ttl) which can occur for some protocols such as TCP when it
/// cannot bind to a given port.
pub const MAX_SEQUENCE_PER_ROUND: u16 = 512;

/// The maximum _starting_ sequence number allowed.
///
/// This ensures that there are sufficient sequence numbers available for at least _two_ rounds.  We
/// require two rounds to ensure that delayed probe responses from the immediate prior round can be
/// detected and excluded.
pub const MAX_INITIAL_SEQUENCE: u16 = u16::MAX - (MAX_SEQUENCE_PER_ROUND * 2);

```

### Core Architecture Module: `crates/trippy-core/src/error.rs`
```
use std::fmt::{Display, Formatter};
use std::io;
use std::net::{IpAddr, SocketAddr};
use thiserror::Error;

/// A tracer error result.
pub type Result<T> = std::result::Result<T, Error>;

/// A tracer error.
#[derive(Error, Debug)]
pub enum Error {
    #[error("invalid packet size: {0}")]
    InvalidPacketSize(usize),
    #[error("invalid packet: {0}")]
    PacketError(#[from] trippy_packet::error::Error),
    #[error("unknown interface: {0}")]
    UnknownInterface(String),
    #[error("invalid config: {0}")]
    BadConfig(String),
    #[error("IO error: {0}")]
    IoError(#[from] IoError),
    #[error("Probe failed to send: {0}")]
    ProbeFailed(IoError),
    #[error("insufficient buffer capacity")]
    InsufficientCapacity,
    #[error("address {0} in use")]
    AddressInUse(SocketAddr),
    #[error("source IP address {0} could not be bound")]
    InvalidSourceAddr(IpAddr),
    #[error("missing address from socket call")]
    MissingAddr,
    #[error("connect callback error: {0}")]
    PrivilegeError(#[from] trippy_privilege::Error),
    #[error("tracer error: {0}")]
    Other(String),
}

/// Custom IO error result.
pub type IoResult<T> = std::result::Result<T, IoError>;

/// Custom IO error.
#[derive(Error, Debug)]
pub enum IoError {
    #[error("Bind error for {1}: {0}")]
    Bind(io::Error, SocketAddr),
    #[error("Connect error for {1}: {0}")]
    Connect(io::Error, SocketAddr),
    #[error("Sendto error for {1}: {0}")]
    SendTo(io::Error, SocketAddr),
    #[error("Failed to {0}: {1}")]
    Other(io::Error, IoOperation),
}

impl IoError {
    /// Get the custom error kind.
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::Bind(e, _) | Self::Connect(e, _) | Self::SendTo(e, _) | Self::Other(e, _) => {
                ErrorKind::from(e)
            }
        }
    }
}

/// Custom error kind.
///
/// This includes additional error kinds that are not part of the standard [`io::ErrorKind`].
#[derive(Debug, Eq, PartialEq)]
pub enum ErrorKind {
    InProgress,
    HostUnreachable,
    NetUnreachable,
    Std(io::ErrorKind),
}

/// Io operation.
#[derive(Debug)]
pub enum IoOperation {
    NewSocket,
    SetNonBlocking,
    Select,
    RecvFrom,
    Read,
    Shutdown,
    LocalAddr,
    PeerAddr,
    TakeError,
    SetTos,
    SetTclassV6,
    SetTtl,
    SetReusePort,
    SetHeaderIncluded,
    SetUnicastHopsV6,
    WSACreateEvent,
    WSARecvFrom,
    WSAEventSelect,
    WSAResetEvent,
    WSAGetOverlappedResult,
    WaitForSingleObject,
    SetTcpFailConnectOnIcmpError,
    TcpIcmpErrorInfo,
    ConvertSocketAddress,
    SioRoutingInterfaceQuery,
    Startup,
}

impl Display for IoOperation {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NewSocket => write!(f, "create new socket"),
            Self::SetNonBlocking => write!(f, "set non-blocking"),
            Self::Select => write!(f, "select"),
            Self::RecvFrom => write!(f, "recv from"),
            Self::Read => write!(f, "read"),
            Self::Shutdown => write!(f, "shutdown"),
            Self::LocalAddr => write!(f, "local addr"),
            Self::PeerAddr => write!(f, "peer addr"),
            Self::TakeError => write!(f, "take error"),
            Self::SetTos => write!(f, "set TOS"),
            Self::SetTclassV6 => write!(f, "set TCLASS v6"),
            Self::SetTtl => write!(f, "set TTL"),
            Self::SetReusePort => write!(f, "set reuse port"),
            Self::SetHeaderIncluded => write!(f, "set header included"),
            Self::SetUnicastHopsV6 => write!(f, "set unicast hops v6"),
            Self::WSACreateEvent => write!(f, "WSA create event"),
            Self::WSARecvFrom => write!(f, "WSA recv from"),
            Self::WSAEventSelect => write!(f, "WSA event select"),
            Self::WSAResetEvent => write!(f, "WSA reset event"),
            Self::WSAGetOverlappedResult => write!(f, "WSA get overlapped result"),
            Self::WaitForSingleObject => write!(f, "wait for single object"),
            Self::SetTcpFailConnectOnIcmpError => write!(f, "set TCP failed connect on ICMP error"),
            Self::TcpIcmpErrorInfo => write!(f, "get TCP ICMP error info"),
            Self::ConvertSocketAddress => write!(f, "convert socket address"),
            Self::SioRoutingInterfaceQuery => write!(f, "SIO routing interface query"),
            Self::Startup => write!(f, "startup"),
        }
    }
}

```

### Core Architecture Module: `crates/trippy-core/src/flows.rs`
```
use derive_more::{Add, AddAssign, Sub, SubAssign};
use itertools::{EitherOrBoth, Itertools};
use std::fmt::{Debug, Display, Formatter};
use std::net::IpAddr;
use tracing::instrument;

/// Identifies a tracing `Flow`.
#[derive(
    Debug,
    Clone,
    Copy,
    Default,
    Ord,
    PartialOrd,
    Eq,
    PartialEq,
    Hash,
    Add,
    AddAssign,
    Sub,
    SubAssign,
)]
pub struct FlowId(pub u64);

impl Display for FlowId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A register of tracing `Flows`.
#[derive(Debug, Clone, Default)]
pub struct FlowRegistry {
    /// The id to assign to the next flow registered.
    next_flow_id: FlowId,
    /// The registry of flows observed.
    flows: Vec<(Flow, FlowId)>,
}

impl FlowRegistry {
    /// Create a new `FlowRegistry`.
    pub const fn new() -> Self {
        Self {
            flows: Vec::new(),
            next_flow_id: FlowId(1),
        }
    }

    /// Register a `Flow` with the `FlowRegistry`.
    ///
    /// If the flow matches a flow that has previously been observed by the registry then
    /// the id of that flow is return.  Otherwise, a new flow id is created and
    /// returned and the corresponding flow is stored in the registry.
    ///
    /// If the flow matches but also contains additional data not previously
    /// observed for that flow then the existing flow will be updated to
    /// merge the data.  In this case the existing flow id will be reused.
    ///
    /// If a flow matches more than one existing flow then only the first
    /// matching flow will be updated.
    #[instrument(skip(self), level = "trace")]
    pub fn register(&mut self, flow: Flow) -> FlowId {
        for (entry, id) in &mut self.flows {
            let status = entry.check(&flow);
            match status {
                CheckStatus::Match => {
                    return *id;
                }
                CheckStatus::NoMatch => {}
                CheckStatus::MatchMerge => {
                    entry.merge(&flow);
                    return *id;
                }
            }
        }
        let flow_id = self.next_flow_id;
        self.flows.push((flow, flow_id));
        self.next_flow_id.0 += 1;
        flow_id
    }

    /// All recorded flows.
    pub fn flows(&self) -> &[(Flow, FlowId)] {
        &self.flows
    }
}

/// Represents a single tracing path over a number of (possibly unknown) hops.
#[derive(Debug, Clone, Eq, PartialEq, Hash)]
pub struct Flow {
    pub entries: Vec<FlowEntry>,
}

impl Flow {
    /// Create a new Flow from a slice of hops.
    ///
    /// Note that each entry is implicitly associated with a `ttl`.  For
    /// example `hops[0]` would have a `ttl` of 1, `hops[1]` would have a
    /// `ttl` of 2 and so on.
    pub fn from_hops(hops: impl IntoIterator<Item = Option<IpAddr>>) -> Self {
        let entries = hops
            .into_iter()
            .map(|addr| {
                if let Some(addr) = addr {
                    FlowEntry::Known(addr)
                } else {
                    FlowEntry::Unknown
                }
            })
            .collect();
        Self { entries }
    }

    /// Check if a given `Flow` matches this `Flow`.
    ///
    /// Two flows are said to match _unless_ they contain different IP
    /// addresses for the _same_ position (i.e. the same `ttl`).
    ///
    /// This is true even for flows of differing lengths.
    ///
    /// In the even of a match, if the flow being checked contains
    /// `FlowEntry::Known` entries which are `FlowEntry::Unknown` in the
    /// current flow then `CheckStatus::MatchMerge` is returned to indicate
    /// the two flows should be merged.
    ///
    /// This will also be the case if the flow being checked matches and is
    /// longer than the existing flow.
    #[instrument(skip(self), level = "trace")]
    pub fn check(&self, flow: &Self) -> CheckStatus {
        let mut additions = 0;
        for (old, new) in self.entries.iter().zip(&flow.entries) {
            match (old, new) {
                (FlowEntry::Known(fst), FlowEntry::Known(snd)) if fst != snd => {
                    return CheckStatus::NoMatch;
                }
                (FlowEntry::Unknown, FlowEntry::Known(_)) => additions += 1,
                _ => {}
            }
        }
        if flow.entries.len() > self.entries.len() || additions > 0 {
            CheckStatus::MatchMerge
        } else {
            CheckStatus::Match
        }
    }

    /// Marge the entries from the given `Flow` into our `Flow`.
    #[instrument(skip(self), level = "trace")]
    fn merge(&mut self, flow: &Self) {
        self.entries = self
            .entries
            .iter()
            .zip_longest(flow.entries.iter())
            .map(|eob| match eob {
                EitherOrBoth::Both(left, right) => match (left, right) {
                    (FlowEntry::Unknown, FlowEntry::Known(_)) => *right,
                    _ => *left,
                },
                EitherOrBoth::Left(left) => *left,
                EitherOrBoth::Right(right) => *right,
            })
            .collect::<Vec<_>>();
    }
}

impl Display for Flow {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.entries.iter().format(", "))
    }
}

/// The result of a `Flow` comparison check.
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum CheckStatus {
    /// The flows match.
    Match,
    /// The flows do not match.
    NoMatch,
    /// The flows match but should be merged.
    MatchMerge,
}

/// An entry in a `Flow`.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash)]
pub enum FlowEntry {
    /// An unknown flow entry.
    Unknown,
    /// A known flow entry with an `IpAddr`.
    Known(IpAddr),
}

impl Display for FlowEntry {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unknown => f.write_str("*"),
            Self::Known(addr) => {
                write!(f, "{addr}")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;
    use std::str::FromStr;

    #[test]
    fn test_single_flow() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1")]);
        let flow_id = registry.register(flow1);
        assert_eq!(FlowId(1), flow_id);
        assert_eq!(
            &[(Flow::from_hops([addr("1.1.1.1")]), FlowId(1))],
            registry.flows()
        );
    }

    #[test]
    fn test_two_different_flows() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1")]);
        let flow1_id = registry.register(flow1.clone());
        let flow2 = Flow::from_hops([addr("2.2.2.2")]);
        let flow2_id = registry.register(flow2.clone());
        assert_eq!(FlowId(1), flow1_id);
        assert_eq!(FlowId(2), flow2_id);
        assert_eq!(&[(flow1, flow1_id), (flow2, flow2_id)], registry.flows());
    }

    #[test]
    fn test_two_same_flows() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1")]);
        let flow1_id = registry.register(flow1.clone());
        let flow2 = Flow::from_hops([addr("1.1.1.1")]);
        let flow2_id = registry.register(flow2);
        assert_eq!(FlowId(1), flow1_id);
        assert_eq!(FlowId(1), flow2_id);
        assert_eq!(&[(flow1, flow1_id)], registry.flows());
    }

    #[test]
    fn test_two_same_one_different_flows() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1")]);
        let flow1_id = registry.register(flow1.clone());
        let flow2 = Flow::from_hops([addr("2.2.2.2")]);
        let flow2_id = registry.register(flow2.clone());
        let flow3 = Flow::from_hops([addr("1.1.1.1")]);
        let flow3_id = registry.register(flow3);
        assert_eq!(FlowId(1), flow1_id);
        assert_eq!(FlowId(2), flow
```

### Core Architecture Module: `crates/trippy-core/src/lib.rs`
```
//! Trippy - A network tracing library.
//!
//! This crate provides the core network tracing facility used by the
//! standalone [Trippy](https://trippy.rs) application.
//!
//! Note: the public API is not stable and is highly likely to change
//! in the future.
//!
//! # Example
//!
//! The following example builds and runs a tracer with default configuration
//! and prints out the tracing data for each round:
//!
//! ```no_run
//! # fn main() -> anyhow::Result<()> {
//! # use std::net::IpAddr;
//! # use std::str::FromStr;
//! use trippy_core::Builder;
//!
//! let addr = IpAddr::from_str("1.1.1.1")?;
//! Builder::new(addr)
//!     .build()?
//!     .run_with(|round| println!("{:?}", round))?;
//! # Ok(())
//! # }
//! ```
//!
//! The following example traces using the UDP protocol with the Dublin ECMP
//! strategy with fixed src and dest ports.  It also operates in unprivileged
//! mode (only supported on some platforms):
//!
//! ```no_run
//! # fn main() -> anyhow::Result<()> {
//! # use std::net::IpAddr;
//! # use std::str::FromStr;
//! use trippy_core::{Builder, MultipathStrategy, Port, PortDirection, PrivilegeMode, Protocol};
//!
//! let addr = IpAddr::from_str("1.1.1.1")?;
//! Builder::new(addr)
//!     .privilege_mode(PrivilegeMode::Unprivileged)
//!     .protocol(Protocol::Udp)
//!     .multipath_strategy(MultipathStrategy::Dublin)
//!     .port_direction(PortDirection::FixedBoth(Port(33434), Port(3500)))
//!     .build()?
//!     .run_with(|round| println!("{:?}", round))?;
//! # Ok(())
//! # }
//! ```
//!
//! # See Also
//!
//! - [`Builder`] - Build a [`Tracer`].
//! - [`Tracer::run`] - Run the tracer on the current thread.
//! - [`Tracer::run_with`] - Run the tracer with a custom round handler.
//! - [`Tracer::spawn`] - Run the tracer on a new thread.
//! - [`Tracer::spawn_with`] - Run the tracer on a new thread with a custom round handler.

mod builder;
mod config;
mod constants;
mod error;
mod flows;
mod net;
mod probe;
mod state;
mod strategy;
mod tracer;
mod types;

use net::channel::Channel;
use net::source::SourceAddr;

pub use builder::Builder;
pub use config::{
    IcmpExtensionParseMode, MultipathStrategy, PortDirection, PrivilegeMode, Protocol, defaults,
};
pub use constants::MAX_TTL;
pub use error::Error;
pub use flows::{FlowEntry, FlowId};
pub use probe::{
    Extension, Extensions, IcmpPacketType, MplsLabelStack, MplsLabelStackMember, Probe,
    ProbeComplete, ProbeStatus, UnknownExtension,
};
pub use state::{Hop, NatStatus, State};
pub use strategy::{Action, CompletionReason, Round, Strategy};
pub use tracer::Tracer;
pub use types::{
    Dscp, Ecn, Flags, MaxInflight, MaxRounds, PacketSize, PayloadPattern, Port, RoundId, Sequence,
    TimeToLive, TraceId, TypeOfService,
};

```

### Core Architecture Module: `crates/trippy-core/src/net.rs`
```
use crate::error::Result;
use crate::probe::{Probe, Response};

/// Common types and helper functions.
mod common;

/// IPv4 implementation.
mod ipv4;

/// IPv6 implementation.
mod ipv6;

/// ICMP extensions.
mod extension;

/// Platform specific network code.
mod platform;

/// A network socket.
mod socket;

/// A channel for sending and receiving probes.
pub mod channel;

/// Determine the source address.
pub mod source;

/// The platform specific socket type.
pub use platform::{PlatformImpl, SocketImpl};

/// An abstraction over a network interface for tracing.
#[cfg_attr(test, mockall::automock)]
pub trait Network {
    /// Send a `Probe`.
    fn send_probe(&mut self, probe: Probe) -> Result<()>;

    /// Receive the next Icmp packet and return a `ProbeResponse`.
    ///
    /// Returns `None` if the read times out or the packet read is not one of the types expected.
    fn recv_probe(&mut self) -> Result<Option<Response>>;
}

```

### Core Architecture Module: `crates/trippy-core/src/net/channel.rs`
```
use crate::config::ChannelConfig;
use crate::error::{Error, Result};
use crate::net::socket::Socket;
use crate::net::{Network, ipv4::Ipv4, ipv6::Ipv6, platform};
use crate::probe::{Probe, Response};
use crate::{Port, PrivilegeMode, Protocol};
use arrayvec::ArrayVec;
use std::net::IpAddr;
use std::time::{Duration, SystemTime};
use tracing::instrument;

/// The maximum size of the IP packet we allow.
pub const MAX_PACKET_SIZE: usize = 1024;

/// The maximum number of TCP probes we allow.
const MAX_TCP_PROBES: usize = 256;

/// A channel for sending and receiving `Probe` packets.
pub struct Channel<S: Socket> {
    protocol: Protocol,
    read_timeout: Duration,
    tcp_connect_timeout: Duration,
    send_socket: Option<S>,
    recv_socket: S,
    tcp_probes: ArrayVec<TcpProbe<S>, MAX_TCP_PROBES>,
    family_config: FamilyConfig,
}

/// The IP family configuration for the channel.
enum FamilyConfig {
    V4(Ipv4),
    V6(Ipv6),
}

impl<S: Socket> Channel<S> {
    /// Create an `IcmpChannel`.
    ///
    /// This operation requires the `CAP_NET_RAW` capability on Linux.
    #[instrument(skip_all, level = "trace")]
    pub fn connect(config: &ChannelConfig) -> Result<Self> {
        tracing::debug!(?config);
        if usize::from(config.packet_size.0) > MAX_PACKET_SIZE {
            return Err(Error::InvalidPacketSize(usize::from(config.packet_size.0)));
        }
        let raw = config.privilege_mode == PrivilegeMode::Privileged;
        platform::startup()?;
        let ipv4_length_order = platform::Ipv4ByteOrder::for_address(config.source_addr)?;
        let send_socket = match config.protocol {
            Protocol::Icmp => Some(make_icmp_send_socket(config.source_addr, raw)?),
            Protocol::Udp => Some(make_udp_send_socket(config.source_addr, raw)?),
            Protocol::Tcp => None,
        };
        let recv_socket = make_recv_socket(config.source_addr, raw)?;
        let family_config = match (config.source_addr, config.target_addr) {
            (IpAddr::V4(src_addr), IpAddr::V4(dest_addr)) => FamilyConfig::V4(Ipv4 {
                src_addr,
                dest_addr,
                byte_order: ipv4_length_order,
                packet_size: config.packet_size,
                payload_pattern: config.payload_pattern,
                privilege_mode: config.privilege_mode,
                tos: config.tos,
                protocol: config.protocol,
                icmp_extension_mode: config.icmp_extension_parse_mode,
            }),
            (IpAddr::V6(src_addr), IpAddr::V6(dest_addr)) => FamilyConfig::V6(Ipv6 {
                src_addr,
                dest_addr,
                packet_size: config.packet_size,
                payload_pattern: config.payload_pattern,
                privilege_mode: config.privilege_mode,
                tos: config.tos,
                protocol: config.protocol,
                icmp_extension_mode: config.icmp_extension_parse_mode,
                initial_sequence: config.initial_sequence,
            }),
            _ => unreachable!(),
        };
        Ok(Self {
            protocol: config.protocol,
            read_timeout: config.read_timeout,
            tcp_connect_timeout: config.tcp_connect_timeout,
            send_socket,
            recv_socket,
            tcp_probes: ArrayVec::new(),
            family_config,
        })
    }
}

impl<S: Socket> Network for Channel<S> {
    #[instrument(skip(self), level = "trace")]
    fn send_probe(&mut self, probe: Probe) -> Result<()> {
        tracing::debug!(?probe);
        match self.protocol {
            Protocol::Icmp => self.dispatch_icmp_probe(&probe),
            Protocol::Udp => self.dispatch_udp_probe(&probe),
            Protocol::Tcp => self.dispatch_tcp_probe(&probe),
        }
    }
    #[instrument(skip_all, level = "trace")]
    fn recv_probe(&mut self) -> Result<Option<Response>> {
        let prob_response = match self.protocol {
            Protocol::Icmp | Protocol::Udp => self.recv_icmp_probe(),
            Protocol::Tcp => match self.recv_tcp_sockets()? {
                None => self.recv_icmp_probe(),
                resp => Ok(resp),
            },
        }?;
        if let Some(resp) = &prob_response {
            tracing::debug!(?resp);
        }
        Ok(prob_response)
    }
}

impl<S: Socket> Channel<S> {
    /// Dispatch a ICMP probe.
    #[instrument(skip_all, level = "trace")]
    fn dispatch_icmp_probe(&mut self, probe: &Probe) -> Result<()> {
        match (&self.family_config, self.send_socket.as_mut()) {
            (FamilyConfig::V4(ipv4), Some(socket)) => ipv4.dispatch_icmp_probe(socket, probe),
            (FamilyConfig::V6(ipv6), Some(socket)) => ipv6.dispatch_icmp_probe(socket, probe),
            _ => unreachable!(),
        }
    }

    /// Dispatch a UDP probe.
    #[instrument(skip_all, level = "trace")]
    fn dispatch_udp_probe(&mut self, probe: &Probe) -> Result<()> {
        match (&self.family_config, self.send_socket.as_mut()) {
            (FamilyConfig::V4(ipv4), Some(socket)) => ipv4.dispatch_udp_probe(socket, probe),
            (FamilyConfig::V6(ipv6), Some(socket)) => ipv6.dispatch_udp_probe(socket, probe),
            _ => unreachable!(),
        }
    }

    /// Dispatch a TCP probe.
    #[instrument(skip_all, level = "trace")]
    fn dispatch_tcp_probe(&mut self, probe: &Probe) -> Result<()> {
        let socket = match &self.family_config {
            FamilyConfig::V4(ipv4) => ipv4.dispatch_tcp_probe(probe),
            FamilyConfig::V6(ipv6) => ipv6.dispatch_tcp_probe(probe),
        }?;
        self.tcp_probes.push(TcpProbe::new(
            socket,
            probe.src_port,
            probe.dest_port,
            SystemTime::now(),
        ));
        Ok(())
    }

    /// Generate a `ProbeResponse` for the next available ICMP packet, if any
    #[instrument(skip(self), level = "trace")]
    fn recv_icmp_probe(&mut self) -> Result<Option<Response>> {
        if self.recv_socket.is_readable(self.read_timeout)? {
            match &self.family_config {
                FamilyConfig::V4(ipv4) => ipv4.recv_icmp_probe(&mut self.recv_socket),
                FamilyConfig::V6(ipv6) => ipv6.recv_icmp_probe(&mut self.recv_socket),
            }
        } else {
            Ok(None)
        }
    }

    /// Generate synthetic `ProbeResponse` if a TCP socket is connected or if the connection was
    /// refused.
    ///
    /// Any TCP socket which has not connected or failed after a timeout will be removed.
    #[instrument(skip(self), level = "trace")]
    fn recv_tcp_sockets(&mut self) -> Result<Option<Response>> {
        self.tcp_probes
            .retain(|probe| probe.start.elapsed().unwrap_or_default() < self.tcp_connect_timeout);
        let found_index = self
            .tcp_probes
            .iter_mut()
            .enumerate()
            .find_map(|(index, probe)| {
                if probe.socket.is_writable().unwrap_or_default() {
                    Some(index)
                } else {
                    None
                }
            });
        if let Some(i) = found_index {
            let mut probe = self.tcp_probes.remove(i);
            match &self.family_config {
                FamilyConfig::V4(ipv4) => {
                    ipv4.recv_tcp_socket(&mut probe.socket, probe.src_port, probe.dest_port)
                }
                FamilyConfig::V6(ipv6) => {
                    ipv6.recv_tcp_socket(&mut probe.socket, probe.src_port, probe.dest_port)
                }
            }
        } else {
            Ok(None)
        }
    }
}

/// An entry in the TCP probes array.
struct TcpProbe<S: Socket> {
    socket: S,
    src_port: Port,
    dest_port: Port,
    start: SystemTime,
}

impl<S: Socket> TcpProbe<S> {
    pub const fn new(socket: S, src_port: Port, dest_port: Port, start: SystemTime) -> Self {
        Self {
            socket,
            src_port,
            dest_port,
            start,
        }
    }
}

/// Make a socket for sending ra
```

### Core Architecture Module: `crates/trippy-core/src/net/common.rs`
```
use crate::error::ErrorKind;
use crate::error::{Error, Result};
use std::net::SocketAddr;

/// Utility methods to map errors.
pub struct ErrorMapper;

impl ErrorMapper {
    /// Convert [`ErrorKind::InProgress`] to [`Ok`].
    pub fn in_progress(err: Error) -> Result<()> {
        match err {
            Error::IoError(io_err) => match io_err.kind() {
                ErrorKind::InProgress => Ok(()),
                _ => Err(Error::IoError(io_err)),
            },
            err => Err(err),
        }
    }

    /// Convert [`io::ErrorKind::AddrInUse`] to [`Error::AddressInUse`].
    #[must_use]
    pub fn addr_in_use(err: Error, addr: SocketAddr) -> Error {
        match err {
            Error::IoError(io_err) => match io_err.kind() {
                ErrorKind::Std(std::io::ErrorKind::AddrInUse) => Error::AddressInUse(addr),
                _ => Error::IoError(io_err),
            },
            err => err,
        }
    }

    /// Convert a given [`ErrorKind`] to [`Error::ProbeFailed`].
    #[expect(clippy::needless_pass_by_value)]
    pub fn probe_failed(err: Error, kind: ErrorKind) -> Error {
        match err {
            Error::IoError(io_err) if io_err.kind() == kind => Error::ProbeFailed(io_err),
            _ => err,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::IoError;
    use std::io;
    use std::net::{Ipv4Addr, SocketAddrV4};

    const ADDR: SocketAddr = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0));

    #[test]
    fn test_in_progress() {
        let io_err = io::Error::from(ErrorKind::InProgress);
        let err = Error::IoError(IoError::Bind(io_err, ADDR));
        assert!(ErrorMapper::in_progress(err).is_ok());
    }

    #[test]
    fn test_not_in_progress() {
        let io_err = io::Error::from(ErrorKind::Std(io::ErrorKind::Other));
        let err = Error::IoError(IoError::Bind(io_err, ADDR));
        assert!(ErrorMapper::in_progress(err).is_err());
    }

    #[test]
    fn test_addr_in_use() {
        let io_err = io::Error::from(ErrorKind::Std(io::ErrorKind::AddrInUse));
        let err = Error::IoError(IoError::Bind(io_err, ADDR));
        let addr_in_use_err = ErrorMapper::addr_in_use(err, ADDR);
        assert!(matches!(addr_in_use_err, Error::AddressInUse(ADDR)));
    }

    #[test]
    fn test_not_addr_in_use() {
        let io_err = io::Error::from(ErrorKind::Std(io::ErrorKind::Other));
        let err = Error::IoError(IoError::Bind(io_err, ADDR));
        let addr_in_use_err = ErrorMapper::addr_in_use(err, ADDR);
        assert!(matches!(addr_in_use_err, Error::IoError(_)));
    }

    #[test]
    fn test_probe_failed() {
        let io_err = io::Error::from(ErrorKind::HostUnreachable);
        let err = Error::IoError(IoError::Bind(io_err, ADDR));
        let probe_err = ErrorMapper::probe_failed(err, ErrorKind::HostUnreachable);
        assert!(matches!(probe_err, Error::ProbeFailed(_)));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1793** (2026-04-18): **keep Windows `WSARecvFrom` flags alive**
  *Symptoms*: Sim tests crash on Windows with Rust 1.95  See: https://github.com/fujiapple852/trippy/actions/runs/24526729292/job/71766060138  ``` thread 'tokio-rt-worker' (5996) panicked at /rustc/59807616e1fa2540724bfbac14d7976d7e4a3860/library\alloc\src\raw_vec\mod.rs:641:30: unsafe precondition(s) violated: Layout::from_size_align_unchecked requires that align is a power of 2 and the rounded-up allocation size does not exceed isize::MAX  This indicates a bug in the program. This Undefined Behavior check is optional, and cannot be relied on for safety. note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace thread caused non-unwinding panic. aborting. 2026-04-17T04:23:43.223814Z  INFO sim::tracer: 0 2 fd00:10::102 2026-04-17T04:23:43.223824Z  INFO sim::tracer: 0 3 fd00:10::103 error: test failed, to rerun pass `-p trippy-core --test sim`  Caused by:   process didn't exit successfully: `D:\a\trippy\trippy\target\x86_64-pc-windows-msvc\debug\deps\sim-276160054c9e564d.exe --exact --nocapture` (exit code: 0xc0000409, STATUS_STACK_BUFFER_OVERRUN) ```
  **Post-Mortem & Fix Analysis**:
  > See https://github.com/fujiapple852/trippy/issues/1517 for a similar issue with Rust 1.85
  > Issue identified (full credit to [OpenAI Codex](https://openai.com/codex/)).  The call to [`WSARecvFrom`](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsarecvfrom) was passing `lpFlags` as `&mut 0` which is a pointer to stack-backed value for an overlapped operation. Once the function returned, Winsock could complete into invalid stack memory, producing the crash.  The fix was to keep the receive flags in `SocketImpl` and passing that to `WSARecvFrom` as `addr_of_mut!(self.recv_flags)` 
  > @zarkdav FYI ^^^

- **Issue #1729** (2026-04-05): **Trippy fails to use system locale**
  *Symptoms*: **Describe the bug** Trippy fails to use the system locale correctly  **To Reproduce** 1: Set a locale, see my locale settings below for reference: $ env | grep 'LC_\|LANG' | sort GDM_LANG=en_US.utf8 LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ADDRESS=sv_SE.UTF-8 LC_COLLATE=sv_SE.UTF-8 LC_CTYPE=sv_SE.UTF-8 LC_IDENTIFICATION=sv_SE.UTF-8 LC_MEASUREMENT=en_GB.UTF-8 LC_MESSAGES=en_US.UTF-8 LC_MONETARY=sv_SE.UTF-8 LC_NAME=sv_SE.UTF-8 LC_NUMERIC=sv_SE.UTF-8 LC_PAPER=en_GB.UTF-8 LC_TELEPHONE=sv_SE.UTF-8 LC_TIME=en_GB.UTF-8  2 - Run `trip 8.8.8.8`  3 - Watch trippy displayed in swedish  **Expected behavior** Trippy should start and display english language.  **Screenshots**  <!-- If applicable, add screenshots to help explain your problem. -->  **Environment Info**  - OS: Debian trixie - Trippy version: trip 0.12.2 - Installation method: apt install trippy - Terminal / Console: terminator 2.1.4  **Additional context**  <!-- Add any other context about the problem here. --> 
  **Post-Mortem & Fix Analysis**:
  > @snackiz just to check, are you running `trip` via `sudo`? Perhaps the language is set differently for the `root` user. 
  > @snackiz can you confirm re: running via `sudo`? 
  > @fujiapple852 I was not running it via sudo, but doing so gets the same result.

- **Issue #1677** (2025-10-31): **Wrong chart y-axis scaling with samples < 1ms.**
  *Symptoms*: **Describe the bug**  Y-Axis scale is miscalculated and jumping if all samples are lower 1ms.  **To Reproduce**  `trip localhost -i 100ms` + press C  **Expected behavior**  y-axis should scale from 0 to max.  **Screenshots**  https://github.com/user-attachments/assets/a675787d-dfda-4016-9e69-f8125afc9e53  **Environment Info**  - OS: _all_ - Trippy version: trip 0.13.0 - Installation method: _all_ - Terminal / Console: _all_   _edit: fix command_
  **Post-Mortem & Fix Analysis**:
  > When I try that command I get an error message asking for a unit. I assumed `ms` and tried that and was able to reproduce what you showed in the video.  ``` trip localhost -i 100   error: invalid value '100' for '--min-round-duration <MIN_ROUND_DURATION>': time unit needed, for example 100sec or 100ms ```  Only thing is it looks like it is showing from 0 to max for the values on screen which when they go out of range changes. Maybe what we need is a small margin above the max so that they are still able to be shown.
  > Yes you are right, `trip localhost -i 100ms` is correct.  The error is caused by this [line](https://github.com/fujiapple852/trippy/blob/master/crates/trippy-tui/src/frontend/render/chart.rs#L31) since `(|&c| c as u64)` drops the decimals.  It returns 0 for all values lower than 1. If the series only consists of values < 1 the last value of the series is returned according to the docs.  https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.max_by_key > Returns the element that gives the maximum value from the specified function. > If several elements are equally maximum, the last element is returned [...]  I did raise a PR to fix this issue.  As you stated - another possible fix would be to simply increase the value of `max_sample` by 1ms. But i think this might result in a too large value considering modern hardware is able to archive latencies in the 100ns range. 
  > Thanks for the bug report and PR @DaVarga !  I can reproduce the issue locally. I think the proposed fix is sound and works well.  aside: `-i` (`--min-round-duration`) doesn't impact the RTT of the probe and so isn't needed here at all; the issue can be reproduced without it.

- **Issue #1635** (2025-08-02): **Default `system` `address-family` to `ipv4-then-ipv6` for non-`system` resolvers**
  *Symptoms*: See #1469 specifically [this](https://github.com/fujiapple852/trippy/issues/1469#issuecomment-3146231894) comment.

- **Issue #1631** (2025-08-08): **locale parsing fails for valid BCP 47 language tags**
  *Symptoms*: Example that is not correctly handled is `zh-Hant-TW`  https://unicode.org/reports/tr35/#Unicode_language_identifier

- **Issue #1580** (2025-05-25): **Warning during `cargo publish`**
  *Symptoms*: Warning during `cargo publish` :  ``` warning: readme `../../README.md` appears to be a path outside of the package, but there is already a file named `README.md` in the root of the package. The archived crate will contain the copy in the root of the package. Update the readme to point to the path relative to the root of the package to remove this warning. ```  
  **Post-Mortem & Fix Analysis**:
  > Caused by https://github.com/fujiapple852/trippy/pull/1267  

- **Issue #1561** (2025-04-23): **Tracer panic for large icmp packets**
  *Symptoms*: **Describe the bug**  Current master (6dd89be0c8d7d3e101803c0a0947eda3e0a3f3b3) fails to execute the following invocation: sudo target/debug/trip --mode tui --icmp-extensions --dns-lookup-as-info --tui-address-mode both --tui-icmp-extension-mode all --tui-preserve-screen --dns-resolve-method cloudflare -4 152.19.134.196  --tui-custom-columns holsravbwdtKM --icmp --tos 181  thread 'tracer-27605' panicked at crates/trippy-packet/src/icmpv4.rs:866:38: attempt to multiply with overflow note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace    **To Reproduce**  For me this invocation triggers the issue reliably: sudo target/debug/trip --mode tui --icmp-extensions --dns-lookup-as-info --tui-address-mode both --tui-icmp-extension-mode all --tui-preserve-screen --dns-resolve-method cloudflare -4 152.19.134.196  --tui-custom-columns holsravbwdtKM --icmp --tos 181  **Expected behavior**  I expect the TUI interface to show, or trippy bowing out with a meaningful error message explaining why the command could not be executed.  **Environment Info**  - OS: Macos 13.4.1, apple silicon - Trippy version: trip 0.13.0-dev - Installation method:cargo - Terminal / Console: Apple system Terminal   Here is the rust backtrace ``` user@123-1234567 trippy % sudo RUST_BACKTRACE=full target/debug/trip --mode tui --icmp-extensions --dns-lookup-as-info --tui-address-mode both --tui-icmp-extension-mode all --tui-preserve-screen --dns-resolve-method cloudflare -4 152.19.134.196  --tui
  **Post-Mortem & Fix Analysis**:
  > Thanks for the bug report @moeller0 !  The code in question is: https://github.com/fujiapple852/trippy/blob/6dd89be0c8d7d3e101803c0a0947eda3e0a3f3b3/crates/trippy-packet/src/icmpv4.rs#L866  From:  ```rust         fn split_payload_extension(&self) -> (&[u8], Option<&[u8]>) {             // From rfc4884:             //             // "For ICMPv4 messages, the length attribute represents 32-bit words             let length = usize::from(self.get_length() * 4);             let icmp_payload = &self.buf.as_slice()[Self::minimum_packet_size()..];             split(length, icmp_payload)         } ```  Would you be able and willing to capture a packet dump (i.e. wireshark or enable trace logging into Trippy) the offending incoming ICMP message? I'd be very keen to see the extensions.
  > I'm slightly surprised (and embarrassed) to learn that `usize::from(64_u8 * 4)` does not "auto promote" to `usize`, TIL.  So the incoming ICMP packet here must have a `length` of >= 64 (256 bytes).  An easy fix, however I will check for other places where this bug may exist.
  > Fix in https://github.com/fujiapple852/trippy/pull/1562

- **Issue #1558** (2025-04-20): **Premature drop of buffer in `routing_interface_query`**
  *Symptoms*: 

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

### Incident Patch 1: `e18d1c30` (2026-07-17)
**Commit Message**: docs: fix locale listings

**File**: `docs/src/content/docs/index.mdx` (modified, +2/-2)
```diff
@@ -65,8 +65,8 @@ import { Icon } from '@astrojs/starlight/components';
 	</Card>
 
 	<Card title="Trace in your language" icon="translate">
-	    TUI available in 10 languages:
-	    - Chinese 🇨🇳, English 🇺🇸, French 🇫🇷, German 🇩🇪, Italian 🇮🇹, Portuguese 🇵🇹, Russian 🇷🇺, Spanish 🇪🇸, Swedish 🇸🇪 and Turkish 🇹🇷
+	    TUI available in 11 languages:
+	    - Chinese 🇨🇳, English 🇺🇸, French 🇫🇷, German 🇩🇪, Italian 🇮🇹, Japanese 🇯🇵, Portuguese 🇵🇹, Russian 🇷🇺, Spanish 🇪🇸, Swedish 🇸🇪 and Turkish 🇹🇷
 
 		![Trippy main screen in Chinese](../../assets/help_screen_zh.png)
 	</Card>
```

**File**: `docs/src/content/docs/reference/locale.md` (modified, +14/-13)
```diff
@@ -8,19 +8,20 @@ sidebar:
 The following table lists the supported locales for the Tui. These can be overridden with the `--tui-locale` command
 line option or in the `tui-locale` attribute in the `tui` section of the configuration file.
 
-| Locale | Language   | Region |
-| ------ | ---------- | ------ |
-| `zh`   | Chinese    | all    |
-| `en`   | English    | all    |
-| `fr`   | French     | all    |
-| `de`   | German     | all    |
-| `it`   | Italian    | all    |
-| `ja`   | Japanese   | all    |
-| `pt`   | Portuguese | all    |
-| `ru`   | Russian    | all    |
-| `es`   | Spanish    | all    |
-| `sv`   | Swedish    | all    |
-| `tr`   | Turkish    | all    |
+| Locale  | Language   | Region |
+| ------- | ---------- | ------ |
+| `zh`    | Chinese    | all    |
+| `zh-TW` | Chinese    | Taiwan |
+| `en`    | English    | all    |
+| `fr`    | French     | all    |
+| `de`    | German     | all    |
+| `it`    | Italian    | all    |
+| `ja`    | Japanese   | all    |
+| `pt`    | Portuguese | all    |
+| `ru`    | Russian    | all    |
+| `es`    | Spanish    | all    |
+| `sv`    | Swedish    | all    |
+| `tr`    | Turkish    | all    |
 
 :::note
 If you are able to help validate translations for Trippy, or if you wish to add translations for any additional
```

---

### Incident Patch 2: `8e31fd9d` (2026-07-13)
**Commit Message**: fix: remove redundant hostname borrow

**File**: `examples/toy-traceroute/src/main.rs` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ fn main() -> anyhow::Result<()> {
         .build()?;
     println!(
         "traceroute to {} ({}), {} hops max, {} byte packets",
-        &hostname,
+        hostname,
         tracer.target_addr(),
         tracer.max_ttl().0,
         tracer.packet_size().0
```

---

### Incident Patch 3: `842c5c2a` (2026-04-05)
**Commit Message**: feat(core): add post-round trace action to `run_with` and `spawn_with` callbacks (#1771)

**File**: `crates/trippy-core/src/lib.rs` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ pub use probe::{
     ProbeComplete, ProbeStatus, UnknownExtension,
 };
 pub use state::{Hop, NatStatus, State};
-pub use strategy::{CompletionReason, Round, Strategy};
+pub use strategy::{Action, CompletionReason, Round, Strategy};
 pub use tracer::Tracer;
 pub use types::{
     Dscp, Ecn, Flags, MaxInflight, MaxRounds, PacketSize, PayloadPattern, Port, RoundId, Sequence,
```

**File**: `crates/trippy-core/src/strategy.rs` (modified, +37/-17)
```diff
@@ -49,14 +49,29 @@ pub enum CompletionReason {
     RoundTimeLimitExceeded,
 }
 
+/// The action to take after the completion of a round.
+#[derive(Debug, Copy, Clone, Eq, PartialEq)]
+pub enum Action {
+    /// Continue tracing.
+    Continue,
+    /// Stop tracing.
+    Stop,
+}
+
+impl From<()> for Action {
+    fn from((): ()) -> Self {
+        Self::Continue
+    }
+}
+
 /// Trace a path to a target.
 #[derive(Debug, Clone)]
 pub struct Strategy<F> {
     config: StrategyConfig,
     publish: F,
 }
 
-impl<F: Fn(&Round<'_>)> Strategy<F> {
+impl<F: Fn(&Round<'_>) -> Action> Strategy<F> {
     #[instrument(skip_all, level = "trace")]
     pub fn new(config: &StrategyConfig, publish: F) -> Self {
         tracing::debug!(?config);
@@ -192,8 +207,8 @@ impl<F: Fn(&Round<'_>)> Strategy<F> {
         let round_max = round_duration > self.config.max_round_duration;
         let target_found = st.target_found();
         if round_min && grace_exceeded && target_found || round_max {
-            self.publish_trace(st);
-            st.advance_round(self.config.first_ttl);
+            let action = self.publish_trace(st);
+            st.advance_round(self.config.first_ttl, action);
         }
     }
 
@@ -202,7 +217,7 @@ impl<F: Fn(&Round<'_>)> Strategy<F> {
     /// If the round completed without receiving an `EchoReply` from the target host then we also
     /// publish the next `ProbeStatus` which is assumed to represent the TTL of the target host.
     #[instrument(skip(self, state), level = "trace")]
-    fn publish_trace(&self, state: &TracerState) {
+    fn publish_trace(&self, state: &TracerState) -> Action {
         let max_received_ttl = if let Some(target_ttl) = state.target_ttl() {
             target_ttl
         } else {
@@ -220,7 +235,7 @@ impl<F: Fn(&Round<'_>)> Strategy<F> {
         } else {
             CompletionReason::RoundTimeLimitExceeded
         };
-        (self.publish)(&Round::new(probes, largest_ttl, reason));
+        (self.publish)(&Round::new(probes, largest_ttl, reason))
     }
 
     /// Check if the `TraceId` matches the expected value for this tracer.
@@ -840,7 +855,7 @@ mod tests {
             protocol: Protocol::Tcp,
             ..Default::default()
         };
-        let tracer = Strategy::new(&config, |_| {});
+        let tracer = Strategy::new(&config, |_| Action::Continue);
         let mut state = TracerState::new(config);
         tracer.send_request(&mut network, &mut state)?;
         tracer.recv_response(&mut network, &mut state)?;
@@ -870,7 +885,7 @@ mod state {
     use crate::probe::{Probe, ProbeStatus};
     use crate::strategy::{StrategyConfig, StrategyResponse};
     use crate::types::{MaxRounds, Port, RoundId, Sequence, TimeToLive, TraceId};
-    use crate::{Flags, MultipathStrategy, PortDirection, Protocol};
+    use crate::{Action, Flags, MultipathStrategy, PortDirection, Protocol};
     use std::array::from_fn;
     use std::net::IpAddr;
     use std::time::SystemTime;
@@ -929,6 +944,8 @@ mod state {
         target_ttl: Option<TimeToLive>,
         /// The timestamp of the echo response packet.
         received_time: Option<SystemTime>,
+        /// The action to take before starting the next round.
+        next_round_action: Action,
     }
 
     impl TracerState {
@@ -945,6 +962,7 @@ mod state {
                 max_received_ttl: None,
                 target_ttl: None,
                 received_time: None,
+                next_round_action: Action::Continue,
             }
         }
 
@@ -995,11 +1013,12 @@ mod state {
         }
 
         /// Are all rounds complete?
-        pub const fn finished(&self, max_rounds: Option<MaxRounds>) -> bool {
-            match max_rounds {
+        pub fn finished(&self, max_rounds: Option<MaxRounds>) -> bool {
+            let complete = match max_rounds {
                 None => false,
                 Some(max_rounds) => self.round.0 > max_rounds.0.get() - 1,
-            }
+            };
+            self.next_roun
```

**File**: `crates/trippy-core/src/tracer.rs` (modified, +87/-14)
```diff
@@ -1,6 +1,6 @@
 use crate::error::Result;
 use crate::{
-    Error, IcmpExtensionParseMode, MaxInflight, MaxRounds, MultipathStrategy, PacketSize,
+    Action, Error, IcmpExtensionParseMode, MaxInflight, MaxRounds, MultipathStrategy, PacketSize,
     PayloadPattern, PortDirection, PrivilegeMode, Protocol, Round, Sequence, State, TimeToLive,
     TraceId, TypeOfService,
 };
@@ -137,9 +137,12 @@ impl Tracer {
     /// retrieved using the [`Tracer::snapshot`] method.
     ///
     /// This method will additionally call the provided function for each round
-    /// that is completed.  This can be useful if you want to gather round state
+    /// that is completed. This can be useful if you want to gather round state
     /// manually if the tracer is run indefinitely (by not setting
-    /// [`crate::Builder::max_rounds`])
+    /// [`crate::Builder::max_rounds`]).
+    ///
+    /// The callback may either return `()` to continue tracing, or return
+    /// [`Action`] to decide whether tracing should continue after each round.
     ///
     /// # Example
     ///
@@ -159,10 +162,39 @@ impl Tracer {
     /// # }
     /// ```
     ///
+    /// The following will stop after the first round for which `stop` is set:
+    ///
+    /// # Example
+    ///
+    /// ```no_run
+    /// # fn main() -> anyhow::Result<()> {
+    /// # use std::net::IpAddr;
+    /// # use std::str::FromStr;
+    /// # use std::sync::atomic::{AtomicBool, Ordering};
+    /// use trippy_core::{Builder, Action};
+    ///
+    /// let addr = IpAddr::from_str("1.1.1.1")?;
+    /// let stop = AtomicBool::new(false);
+    /// let tracer = Builder::new(addr).build()?;
+    /// tracer.run_with(|_| {
+    ///     if stop.load(Ordering::Relaxed) {
+    ///         Action::Stop
+    ///     } else {
+    ///         Action::Continue
+    ///     }
+    /// })?;
+    /// # Ok(())
+    /// # }
+    /// ```
+    ///
     /// # See Also
     ///
     /// - [`Tracer::run`] - Run the tracer without a custom round handler.
-    pub fn run_with<F: Fn(&Round<'_>)>(&self, func: F) -> Result<()> {
+    pub fn run_with<F, R>(&self, func: F) -> Result<()>
+    where
+        F: Fn(&Round<'_>) -> R,
+        R: Into<Action>,
+    {
         self.inner.run_with(func)
     }
 
@@ -249,13 +281,47 @@ impl Tracer {
     /// # }
     /// ```
     ///
+    /// The callback may either return `()` to continue tracing, or return
+    /// [`Action`] to decide whether tracing should continue after each round.
+    ///
+    /// # Example
+    ///
+    /// ```no_run
+    /// # fn main() -> anyhow::Result<()> {
+    /// # use std::net::IpAddr;
+    /// # use std::str::FromStr;
+    /// # use std::sync::{
+    /// #     Arc,
+    /// #     atomic::{AtomicBool, Ordering},
+    /// # };
+    /// use trippy_core::{Builder, Action};
+    ///
+    /// let addr = IpAddr::from_str("1.1.1.1")?;
+    /// let stop = Arc::new(AtomicBool::new(false));
+    /// let stop_for_trace = Arc::clone(&stop);
+    /// let (tracer, handle) = Builder::new(addr)
+    ///     .build()?
+    ///     .spawn_with(move |_| {
+    ///         if stop_for_trace.load(Ordering::Relaxed) {
+    ///             Action::Stop
+    ///         } else {
+    ///             Action::Continue
+    ///         }
+    ///     })?;
+    /// stop.store(true, Ordering::Relaxed);
+    /// handle.join().unwrap()?;
+    /// # Ok(())
+    /// # }
+    /// ```
+    ///
     /// # See Also
     ///
     /// - [`Tracer::spawn`] - Spawn the tracer on a new thread without a custom round handler.
-    pub fn spawn_with<F: Fn(&Round<'_>) + Send + 'static>(
-        self,
-        func: F,
-    ) -> Result<(Self, JoinHandle<Result<()>>)> {
+    pub fn spawn_with<F, R>(self, func: F) -> Result<(Self, JoinHandle<Result<()>>)>
+    where
+        F: Fn(&Round<'_>) -> R + Send + 'static,
+        R: Into<Action> + Send + 'static,
+    {
         let tracer = self.clone();
         let handle = thread::Builder::new()
             .name(format!("tracer-{}", self.trace
```

---

### Incident Patch 4: `2887058b` (2026-04-19)
**Commit Message**: chore: fix typo in `CHANGELOG.md`

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -414,7 +414,7 @@ to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
   Tui ([#72](https://github.com/fujiapple852/trippy/issues/72))
 - Added ability to enable and disable the `AS` lookup from the
   Tui ([#126](https://github.com/fujiapple852/trippy/issues/126))
-- Added ability to switch between hop address display modes (ip, hostname or both) in thr
+- Added ability to switch between hop address display modes (ip, hostname or both) in the
   Tui ([#124](https://github.com/fujiapple852/trippy/issues/124))
 - Added ability to expand and collapse the number of hosts displays per hop in the
   Tui ([#124](https://github.com/fujiapple852/trippy/issues/124))
```

---

### Incident Patch 5: `76a76c01` (2026-04-18)
**Commit Message**: fix: unpin windows sim test Rust version

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ jobs:
           - build: windows-stable
             os: windows-2022
             target: x86_64-pc-windows-msvc
-            rust: "1.94"
+            rust: stable
     steps:
       - uses: actions/checkout@v4
       - uses: dtolnay/rust-toolchain@stable
```

---

### Incident Patch 6: `0b3c85ba` (2026-04-18)
**Commit Message**: fix(core): keep Windows `WSARecvFrom` flags alive (#1793)

**File**: `crates/trippy-core/src/net/platform/windows.rs` (modified, +4/-1)
```diff
@@ -96,6 +96,7 @@ pub struct SocketImpl {
     buf: Box<[u8]>,
     from: Box<SOCKADDR_STORAGE>,
     from_len: i32,
+    recv_flags: u32,
     bytes_read: u32,
 }
 
@@ -123,6 +124,7 @@ impl SocketImpl {
             buf,
             from,
             from_len,
+            recv_flags: 0,
             bytes_read: 0,
         })
     }
@@ -218,13 +220,14 @@ impl SocketImpl {
             len: MAX_PACKET_SIZE as u32,
             buf: self.buf.as_mut_ptr(),
         };
+        self.recv_flags = 0;
         syscall!(
             WSARecvFrom(
                 self.inner.as_raw_socket() as usize,
                 addr_of!(wbuf),
                 1,
                 null_mut(),
-                &mut 0,
+                addr_of_mut!(self.recv_flags),
                 addr_of_mut!(*self.from).cast(),
                 addr_of_mut!(self.from_len),
                 addr_of_mut!(*self.ol),
```

---

### Incident Patch 7: `b78dfdc1` (2026-04-18)
**Commit Message**: fix: temporarily pin windows sim test on Rust 1.94

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ jobs:
           - build: windows-stable
             os: windows-2022
             target: x86_64-pc-windows-msvc
-            rust: stable
+            rust: "1.94"
     steps:
       - uses: actions/checkout@v4
       - uses: dtolnay/rust-toolchain@stable
```

---

### Incident Patch 8: `e7cb7680` (2026-03-24)
**Commit Message**: fix(tui): add Japanese (ja) to locale test and docs

**File**: `crates/trippy-tui/src/locale.rs` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ mod tests {
         assert_eq!(
             available_locales(),
             vec![
-                "de", "en", "es", "fr", "it", "pt", "ru", "sv", "tr", "zh", "zh-TW"
+                "de", "en", "es", "fr", "it", "ja", "pt", "ru", "sv", "tr", "zh", "zh-TW"
             ]
         );
     }
```

**File**: `docs/src/content/docs/reference/locale.md` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ line option or in the `tui-locale` attribute in the `tui` section of the configu
 | `fr`   | French     | all    |
 | `de`   | German     | all    |
 | `it`   | Italian    | all    |
+| `ja`   | Japanese   | all    |
 | `pt`   | Portuguese | all    |
 | `ru`   | Russian    | all    |
 | `es`   | Spanish    | all    |
```

---

### Incident Patch 9: `ae8de6c8` (2026-03-07)
**Commit Message**: chore: fix clippy lints from Rust 1.94.0

**File**: `crates/trippy-core/src/net/platform/windows.rs` (modified, +1/-1)
```diff
@@ -671,7 +671,7 @@ fn sockaddrptr_to_ipaddr(sockaddr: *mut SOCKADDR_STORAGE) -> StdIoResult<IpAddr>
 
 #[expect(unsafe_code)]
 fn sockaddr_to_socketaddr(sockaddr: &SOCKADDR_STORAGE) -> StdIoResult<SocketAddr> {
-    let ptr = sockaddr as *const SOCKADDR_STORAGE;
+    let ptr = std::ptr::from_ref(sockaddr);
     let af = sockaddr.ss_family;
     if af == AF_INET {
         let sockaddr_in_ptr = ptr.cast::<SOCKADDR_IN>();
```

#### Recent Merged Pull Requests:
- **PR #1883** (closed): chore: try to reproduce Windows crash bug (@fujiapple852)
- **PR #1882** (2026-09-26): ci: bump GitLab Windows runner to `windows-2025` (@fujiapple852)
- **PR #1880** (closed): chore: bump maxminddb from 0.28.1 to 0.31.0 (@dependabot[bot])
- **PR #1879** (2026-09-26): chore: bump serde_with from 3.22.0 to 3.23.0 (@dependabot[bot])
- **PR #1878** (2026-09-26): chore: bump toml from 1.1.4+spec-1.1.0 to 1.1.6+spec-1.1.0 (@dependabot[bot])
- **PR #1875** (2026-09-12): chore: bump crossbeam from 0.8.4 to 0.8.5 (@dependabot[bot])
- **PR #1873** (closed): chore: bump tun-rs from 2.8.8 to 2.8.9 (@dependabot[bot])
- **PR #1872** (closed): chore: bump toml from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
