# Forensic Learning Record (Deep Inspection): fujiapple852/trippy

> **Canonical Artifact**: `07_PROJECT_LEARNING/fujiapple852-trippy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fujiapple852/trippy](https://github.com/fujiapple852/trippy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:55:19.816Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fujiapple852/trippy`
- **Description**: A network diagnostic tool 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 7983 stars

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
    pub const fn dest(&self) -> Option<Port> {
        match *self {
            Self::FixedDest(dest) | Self::FixedBoth(_, dest) => Some(dest),
            _ => None,
        }
    }
}

/// Tracer state configuration.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub struct StateConfig {
    /// The maximum number of samples to record per hop.
    ///
    /// Once the maximum number of samples has been reached the oldest sample
    /// is discarded (FIFO).
    pub max_samples: usize,
    /// The maximum number of flows to record.
    ///
    /// Once the maximum number of flows has been reached no new flows will be
    /// created, existing flows are updated and are never removed.
    pub max_flows: usize,
}

impl Default for StateConfig {
    fn default() -> Self {
        Self {
            max_samples: defaults::DEFAULT_MAX_SAMPLES,
            max_flows: defaults::DEFAULT_MAX_FLOWS,
        }
    }
}

/// Tracer network channel configuration.
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub struct ChannelConfig {
    pub privilege_mode: PrivilegeMode,
    pub protocol: Protocol,
    pub source_addr: IpAddr,
    pub target_addr: IpAddr,
    pub packet_size: PacketSize,
    pub payload_pattern: PayloadPattern,
    pub initial_sequence: Sequence,
    pub tos: TypeOfService,
    pub icmp_extension_parse_mode: IcmpExtensionParseMode,
    pub read_timeout: Duration,
    pub tcp_connect_timeout: Duration,
}

impl Default for ChannelConfig {
    fn default() -> Self {
        Self {
            privilege_mode: defaults::DEFAULT_PRIVILEGE_MODE,
            protocol: defaults::DEFAULT_STRATEGY_PROTOCOL,
            source_addr: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            target_addr: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            packet_size: PacketSize(defaults::DEFAULT_STRATEGY_PACKET_SIZE),
            payload_pattern: PayloadPattern(defaults::DEFAULT_STRATEGY_PAYLOAD_PATTERN),
            initial_sequence: Sequence(defaults::DEFAULT_STRATEGY_INITIAL_SEQUENCE),
      
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
        assert_eq!(FlowId(2), flow2_id);
        assert_eq!(FlowId(1), flow3_id);
        assert_eq!(&[(flow1, flow1_id), (flow2, flow2_id)], registry.flows());
    }

    #[test]
    fn test_merge_flow1() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1")]);
        let flow1_id = registry.register(flow1);
        let flow2 = Flow::from_hops([addr("1.1.1.1"), addr("2.2.2.2")]);
        let flow2_id = registry.register(flow2);
        let flow3 = Flow::from_hops([addr("1.1.1.1"), addr("2.2.2.2")]);
        let flow3_id = registry.register(flow3);
        let flow4 = Flow::from_hops([addr("1.1.1.1"), addr("3.3.3.3")]);
        let flow4_id = registry.register(flow4);
        let flow5 = Flow::from_hops([addr("1.1.1.1")]);
        let flow5_id = registry.register(flow5);
        assert_eq!(FlowId(1), flow1_id);
        assert_eq!(FlowId(1), flow2_id);
        assert_eq!(FlowId(1), flow3_id);
        assert_eq!(FlowId(2), flow4_id);
        assert_eq!(FlowId(1), flow5_id);
    }

    #[test]
    fn test_merge_flow2() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1"), addr("2.2.2.2"), addr("3.3.3.3")]);
        let flow1_id = registry.register(flow1);
        let flow2 = Flow::from_hops([addr("1.1.1.1"), addr("2.2.2.2")]);
        let flow2_id = registry.register(flow2);
        let flow3 = Flow::from_hops([addr("1.1.1.1"), addr("2.2.2.2")]);
        let flow3_id = registry.register(flow3);
        let flow4 = Flow::from_hops([addr("1.1.1.1"), addr("2.2.2.2"), addr("3.3.3.3")]);
        let flow4_id = registry.register(flow4);
        assert_eq!(FlowId(1), flow1_id);
        assert_eq!(FlowId(1), flow2_id);
        assert_eq!(FlowId(1), flow3_id);
        assert_eq!(FlowId(1), flow4_id);
    }

    #[test]
    fn test_merge_flow3() {
        let mut registry = FlowRegistry::new();
        let flow1 = Flow::from_hops([addr("1.1.1.1"), None, addr("3.3.3.3")]);
        let flow1_id = registry.register(f
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

/// Make a socket for sending raw `ICMP` packets.
#[instrument(level = "trace")]
fn make_icmp_send_socket<S: Socket>(addr: IpAddr, raw: bool) -> Result<S> {
    Ok(match addr {
        IpAddr::V4(_) => S::new_icmp_send_socket_ipv4(raw),
        IpAddr::V6(_) => S::new_icmp_send_socket_ipv6(raw),
    }?)
}

/// Make a socket for sending `UDP` packets.
#[instrument(level = "trace")]
fn make_udp_send_socket<S: Socket>(addr: IpAddr, raw: bool) -> Result<S> {
    Ok(match addr {
        IpAddr::V4(_) => S::new_udp_send_socket_ipv4(raw),
        IpAddr::V6(_) => S::new_udp_send_socket_ipv6(raw),
    }?)
}

/// Make a socket for receiving raw `ICMP` packets.
#[instrument(level = "trace")]
fn make_recv_socket<S: Socket>(addr: IpAddr, raw: bool) -> Result<S> {
    Ok(match addr {
        IpAddr::V4(ipv4addr) => S::new_recv_socket_ipv4(ipv4addr, raw),
        IpAddr::V6(ipv6addr) => S::new_recv_socket_ipv6(ipv6addr, raw),
    }?)
}

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

### Core Architecture Module: `crates/trippy-core/src/net/extension.rs`
```
use crate::error::Error;
use crate::probe::{Extension, Extensions, MplsLabelStack, MplsLabelStackMember, UnknownExtension};
use trippy_packet::icmp_extension::extension_header::ExtensionHeaderPacket;
use trippy_packet::icmp_extension::extension_object::{ClassNum, ExtensionObjectPacket};
use trippy_packet::icmp_extension::extension_structure::ExtensionsPacket;
use trippy_packet::icmp_extension::mpls_label_stack::MplsLabelStackPacket;
use trippy_packet::icmp_extension::mpls_label_stack_member::MplsLabelStackMemberPacket;

/// The supported ICMP extension version number.
const ICMP_EXTENSION_VERSION: u8 = 2;

impl TryFrom<&[u8]> for Extensions {
    type Error = Error;

    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        Self::try_from(ExtensionsPacket::new_view(value)?)
    }
}

impl TryFrom<ExtensionsPacket<'_>> for Extensions {
    type Error = Error;

    fn try_from(value: ExtensionsPacket<'_>) -> Result<Self, Self::Error> {
        let header = ExtensionHeaderPacket::new_view(value.header())?;
        if header.get_version() != ICMP_EXTENSION_VERSION {
            return Ok(Self::default());
        }
        let extensions = value
            .objects()
            .flat_map(ExtensionObjectPacket::new_view)
            .map(|obj| match obj.get_class_num() {
                ClassNum::MultiProtocolLabelSwitchingLabelStack => {
                    MplsLabelStackPacket::new_view(obj.payload())
                        .map(|mpls| Extension::Mpls(MplsLabelStack::from(mpls)))
                }
                _ => Ok(Extension::Unknown(UnknownExtension::from(obj))),
            })
            .collect::<Result<_, _>>()?;
        Ok(Self { extensions })
    }
}

impl From<MplsLabelStackPacket<'_>> for MplsLabelStack {
    fn from(value: MplsLabelStackPacket<'_>) -> Self {
        Self {
            members: value
                .members()
                .flat_map(MplsLabelStackMemberPacket::new_view)
                .map(MplsLabelStackMember::from)
                .collect(),
        }
    }
}

impl From<MplsLabelStackMemberPacket<'_>> for MplsLabelStackMember {
    fn from(value: MplsLabelStackMemberPacket<'_>) -> Self {
        Self {
            label: value.get_label(),
            exp: value.get_exp(),
            bos: value.get_bos(),
            ttl: value.get_ttl(),
        }
    }
}

impl From<ExtensionObjectPacket<'_>> for UnknownExtension {
    fn from(value: ExtensionObjectPacket<'_>) -> Self {
        Self {
            class_num: value.get_class_num().id(),
            class_subtype: value.get_class_subtype().0,
            bytes: value.payload().to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Convert a single MPLS extension which contains two labels.
    #[test]
    fn test_convert_mpls_extensions() {
        let buf = hex_literal::hex!("20 00 96 53 00 0c 01 01 06 9f 18 01 00 00 29 ff");
        let exts = Extensions::try_from(buf.as_slice()).unwrap();
        assert_eq!(1, exts.extensions.len());
        match &exts.extensions[0] {
            Extension::Mpls(mpls) => {
                assert_eq!(2, mpls.members.len());
                assert_eq!(27121, mpls.members[0].label);
                assert_eq!(1, mpls.members[0].ttl);
                assert_eq!(4, mpls.members[0].exp);
                assert_eq!(0, mpls.members[0].bos);
                assert_eq!(2, mpls.members[1].label);
                assert_eq!(255, mpls.members[1].ttl);
                assert_eq!(4, mpls.members[1].exp);
                assert_eq!(1, mpls.members[1].bos);
            }
            Extension::Unknown(_) => panic!("expected Extension::Mpls"),
        }
    }

    /// Convert a single unknown extension.
    #[test]
    fn test_convert_unknown_extensions() {
        let buf = hex_literal::hex!("20 00 96 53 00 0c 99 01 06 9f 18 01 00 00 29 ff");
        let exts = Extensions::try_from(buf.as_slice()).unwrap();
        assert_eq!(1, exts.extensions.len());
        match &exts.extensions[0] {
            Extension::Unknown(unknown) => {
                assert_eq!(0x99, unknown.class_num);
                assert_eq!(0x01, unknown.class_subtype);
                assert_eq!(
                    hex_literal::hex!("06 9f 18 01 00 00 29 ff"),
                    unknown.bytes.as_slice()
                );
            }
            Extension::Mpls(_) => panic!("expected Extension::Unknown"),
        }
    }

    /// Convert an extension with an unknown header version.
    #[test]
    fn test_convert_unknown_version() {
        let buf = hex_literal::hex!("30 00 96 53 00 0c 99 01 06 9f 18 01 00 00 29 ff");
        let exts = Extensions::try_from(buf.as_slice()).unwrap();
        assert_eq!(0, exts.extensions.len());
    }
}

```

### Core Architecture Module: `crates/trippy-core/src/net/ipv4.rs`
```
use crate::config::IcmpExtensionParseMode;
use crate::error::{Error, ErrorKind, Result};
use crate::net::channel::MAX_PACKET_SIZE;
use crate::net::common::ErrorMapper;
use crate::net::platform;
use crate::net::socket::{Socket, SocketError};
use crate::probe::{
    Extensions, IcmpPacketCode, IcmpProtocolResponse, Probe, ProtocolResponse, Response,
    ResponseData, TcpProtocolResponse, UdpProtocolResponse,
};
use crate::types::{PacketSize, PayloadPattern, Sequence, TraceId, TypeOfService};
use crate::{Flags, Port, PrivilegeMode, Protocol};
use std::io;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::SystemTime;
use tracing::instrument;
use trippy_packet::IpProtocol;
use trippy_packet::checksum::{icmp_ipv4_checksum, udp_ipv4_checksum};
use trippy_packet::icmpv4::destination_unreachable::DestinationUnreachablePacket;
use trippy_packet::icmpv4::echo_reply::EchoReplyPacket;
use trippy_packet::icmpv4::echo_request::EchoRequestPacket;
use trippy_packet::icmpv4::time_exceeded::TimeExceededPacket;
use trippy_packet::icmpv4::{IcmpCode, IcmpPacket, IcmpTimeExceededCode, IcmpType};
use trippy_packet::ipv4::Ipv4Packet;
use trippy_packet::tcp::TcpPacket;
use trippy_packet::udp::UdpPacket;

/// The maximum size of UDP packet we allow.
const MAX_UDP_PACKET_BUF: usize = MAX_PACKET_SIZE - Ipv4Packet::minimum_packet_size();

/// The maximum size of UDP payload we allow.
const MAX_UDP_PAYLOAD_BUF: usize = MAX_UDP_PACKET_BUF - UdpPacket::minimum_packet_size();

/// The maximum size of ICMP packet we allow.
const MAX_ICMP_PACKET_BUF: usize = MAX_PACKET_SIZE - Ipv4Packet::minimum_packet_size();

/// The maximum size of ICMP payload we allow.
const MAX_ICMP_PAYLOAD_BUF: usize = MAX_ICMP_PACKET_BUF - IcmpPacket::minimum_packet_size();

/// The minimum size of ICMP packets we allow.
const MIN_PACKET_SIZE_ICMP: usize =
    Ipv4Packet::minimum_packet_size() + IcmpPacket::minimum_packet_size();

/// The minimum size of UDP packets we allow.
const MIN_PACKET_SIZE_UDP: usize =
    Ipv4Packet::minimum_packet_size() + UdpPacket::minimum_packet_size();

/// The value for the IPv4 `flags_and_fragment_offset` field to set the `Don't fragment` bit.
///
/// 0100 0000 0000 0000
const DONT_FRAGMENT: u16 = 0x4000;

/// IPv4 configuration.
#[derive(Debug)]
pub struct Ipv4 {
    pub src_addr: Ipv4Addr,
    pub dest_addr: Ipv4Addr,
    pub byte_order: platform::Ipv4ByteOrder,
    pub packet_size: PacketSize,
    pub payload_pattern: PayloadPattern,
    pub privilege_mode: PrivilegeMode,
    pub tos: TypeOfService,
    pub protocol: Protocol,
    pub icmp_extension_mode: IcmpExtensionParseMode,
}

impl Default for Ipv4 {
    fn default() -> Self {
        Self {
            src_addr: Ipv4Addr::UNSPECIFIED,
            dest_addr: Ipv4Addr::UNSPECIFIED,
            byte_order: platform::Ipv4ByteOrder::Network,
            packet_size: PacketSize(0),
            payload_pattern: PayloadPattern(0),
            privilege_mode: PrivilegeMode::Privileged,
            tos: TypeOfService(0),
            protocol: Protocol::Icmp,
            icmp_extension_mode: IcmpExtensionParseMode::Disabled,
        }
    }
}

impl Ipv4 {
    /// Dispatch an ICMP probe.
    #[instrument(skip(self, icmp_send_socket), level = "trace")]
    pub fn dispatch_icmp_probe<S: Socket>(
        &self,
        icmp_send_socket: &mut S,
        probe: &Probe,
    ) -> Result<()> {
        let mut ipv4_buf = [0_u8; MAX_PACKET_SIZE];
        let mut icmp_buf = [0_u8; MAX_ICMP_PACKET_BUF];
        let packet_size = usize::from(self.packet_size.0);
        if !(MIN_PACKET_SIZE_ICMP..=MAX_PACKET_SIZE).contains(&packet_size) {
            return Err(Error::InvalidPacketSize(packet_size));
        }
        let echo_request = self.make_echo_request_icmp_packet(
            &mut icmp_buf,
            probe.identifier,
            probe.sequence,
            icmp_payload_size(packet_size),
        )?;
        let ipv4 = self.make_ipv4_packet(
            &mut ipv4_buf,
            IpProtocol::Icmp,
            probe.ttl.0,
            0,
            echo_request.packet(),
        )?;
        let remote_addr = SocketAddr::new(IpAddr::V4(self.dest_addr), 0);
        icmp_send_socket
            .send_to(ipv4.packet(), remote_addr)
            .map_err(Error::IoError)
            .map_err(|err| ErrorMapper::probe_failed(err, ErrorKind::HostUnreachable))
            .map_err(|err| ErrorMapper::probe_failed(err, ErrorKind::NetUnreachable))
            .map_err(|err| ErrorMapper::probe_failed(err, INVALID_INPUT_KIND))?;
        Ok(())
    }

    /// Dispatch a UDP probe.
    #[instrument(skip(self, raw_send_socket), level = "trace")]
    pub fn dispatch_udp_probe<S: Socket>(
        &self,
        raw_send_socket: &mut S,
        probe: &Probe,
    ) -> Result<()> {
        let packet_size = usize::from(self.packet_size.0);
        if !(MIN_PACKET_SIZE_UDP..=MAX_PACKET_SIZE).contains(&packet_size) {
            return Err(Error::InvalidPacketSize(packet_size));
        }
        let payload_size = udp_payload_size(packet_size);
        let payload = &[self.payload_pattern.0; MAX_UDP_PAYLOAD_BUF][0..payload_size];
        match self.privilege_mode {
            PrivilegeMode::Privileged => {
                self.dispatch_udp_probe_raw(raw_send_socket, probe, payload)
            }
            PrivilegeMode::Unprivileged => self.dispatch_udp_probe_non_raw::<S>(probe, payload),
        }
    }

    /// Dispatch a UDP probe using a raw socket with `IP_HDRINCL` set.
    ///
    /// As `IP_HDRINCL` is set we must supply the IP and UDP headers which allows us to set custom
    /// values for certain fields such as the checksum as required by the Paris tracing strategy.
    #[instrument(skip(self, raw_send_socket), level = "trace")]
    fn dispatch_udp_probe_raw<S: Socket>(
        &self,
        raw_send_socket: &mut S,
        probe: &Probe,
        payload: &[u8],
    ) -> Result<()> {
        let mut ipv4_buf = [0_u8; MAX_PACKET_SIZE];
        let mut udp_buf = [0_u8; MAX_UDP_PACKET_BUF];
        let payload_paris = probe.sequence.0.to_be_bytes();
        let payload = if probe.flags.contains(Flags::PARIS_CHECKSUM) {
            payload_paris.as_slice()
        } else {
            payload
        };
        let mut udp =
            self.make_udp_packet(&mut udp_buf, probe.src_port.0, probe.dest_port.0, payload)?;
        if probe.flags.contains(Flags::PARIS_CHECKSUM) {
            let checksum = udp.get_checksum().to_be_bytes();
            let payload = u16::from_be_bytes(core::array::from_fn(|i| udp.payload()[i]));
            udp.set_checksum(payload);
            udp.set_payload(&checksum);
        }
        let ipv4 = self.make_ipv4_packet(
            &mut ipv4_buf,
            IpProtocol::Udp,
            probe.ttl.0,
            probe.identifier.0,
            udp.packet(),
        )?;
        let remote_addr = SocketAddr::new(IpAddr::V4(self.dest_addr), probe.dest_port.0);
        raw_send_socket
            .send_to(ipv4.packet(), remote_addr)
            .map_err(Error::IoError)
            .map_err(|err| ErrorMapper::probe_failed(err, ErrorKind::HostUnreachable))
            .map_err(|err| ErrorMapper::probe_failed(err, ErrorKind::NetUnreachable))?;
        Ok(())
    }

    /// Dispatch a UDP probe using a new UDP datagram socket.
    #[instrument(skip(self), level = "trace")]
    fn dispatch_udp_probe_non_raw<S: Socket>(&self, probe: &Probe, payload: &[u8]) -> Result<()> {
        let local_addr = SocketAddr::new(IpAddr::V4(self.src_addr), probe.src_port.0);
        let remote_addr = SocketAddr::new(IpAddr::V4(self.dest_addr), probe.dest_port.0);
        let mut socket = S::new_udp_send_socket_ipv4(false)?;
        socket
            .bind(local_addr)
            .map_err(Error::IoError)
            .or_else(ErrorMapper::in_progress)
            .map_err(|err| ErrorMapper::addr_in_use(err, local_addr))
            .map_err(|err| ErrorMapper::probe_failed(err, ADDR_NOT_AVAILABLE_KIND))?;
        socket.set_ttl(u32::from(probe.ttl.0))?;
        socket.set_tos(u32::from(self.tos.0))?;
        socket.send_to(payload, remote_addr)?;
        Ok(())
    }

    /// Dispatch a TCP probe.
    #[instrument(skip(self), level = "trace")]
    pub fn dispatch_tcp_probe<S: Socket>(&self, probe: &Probe) -> Result<S> {
        let mut socket = S::new_stream_socket_ipv4()?;
        let local_addr = SocketAddr::new(IpAddr::V4(self.src_addr), probe.src_port.0);
        socket
            .bind(local_addr)
            .map_err(Error::IoError)
            .or_else(ErrorMapper::in_progress)
            .map_err(|err| ErrorMapper::addr_in_use(err, local_addr))
            .map_err(|err| ErrorMapper::probe_failed(err, ADDR_NOT_AVAILABLE_KIND))?;
        socket.set_ttl(u32::from(probe.ttl.0))?;
        socket.set_tos(u32::from(self.tos.0))?;
        let remote_addr = SocketAddr::new(IpAddr::V4(self.dest_addr), probe.dest_port.0);
        socket
            .connect(remote_addr)
            .map_err(Error::IoError)
            .or_else(ErrorMapper::in_progress)
            .map_err(|err| ErrorMapper::addr_in_use(err, remote_addr))
            .map_err(|err| ErrorMapper::probe_failed(err, ErrorKind::NetUnreachable))?;
        Ok(socket)
    }

    /// Receive an ICMP probe response.
    #[instrument(skip(self, recv_socket), level = "trace")]
    pub fn recv_icmp_probe<S: Socket>(&self, recv_socket: &mut S) -> Result<Option<Response>> {
        let mut buf = [0_u8; MAX_PACKET_SIZE];
        match recv_socket.read(&mut buf) {
            Ok(bytes_read) => {
                let ipv4 = Ipv4Packet::new_view(&buf[..bytes_read])?;
                Ok(self.extract_probe_resp(&ipv4)?)
            }
            Err(err) => match err.kind() {
                ErrorKind::Std(io::ErrorKind::WouldBlock) => Ok(None),
                _ => Err(Error::IoError(err)),
            },
        }
    }

    /// Receive a TCP probe response.
    #[instrument(skip(self, tcp_socket), level = "trace")]
    pub fn recv_tcp_socket<S: Soc
```

### Core Architecture Module: `crates/trippy-core/src/net/ipv6.rs`
```
use crate::config::IcmpExtensionParseMode;
use crate::error::{Error, ErrorKind, Result};
use crate::net::channel::MAX_PACKET_SIZE;
use crate::net::common::ErrorMapper;
use crate::net::socket::{Socket, SocketError};
use crate::probe::{
    Extensions, IcmpPacketCode, IcmpProtocolResponse, Probe, ProtocolResponse, Response,
    ResponseData, TcpProtocolResponse, UdpProtocolResponse,
};
use crate::types::{PacketSize, PayloadPattern, Sequence, TraceId};
use crate::{Flags, Port, PrivilegeMode, Protocol, TypeOfService};
use std::io;
use std::net::{IpAddr, Ipv6Addr, SocketAddr};
use std::time::SystemTime;
use tracing::instrument;
use trippy_packet::IpProtocol;
use trippy_packet::checksum::{icmp_ipv6_checksum, udp_ipv6_checksum};
use trippy_packet::icmpv6::destination_unreachable::DestinationUnreachablePacket;
use trippy_packet::icmpv6::echo_reply::EchoReplyPacket;
use trippy_packet::icmpv6::echo_request::EchoRequestPacket;
use trippy_packet::icmpv6::time_exceeded::TimeExceededPacket;
use trippy_packet::icmpv6::{IcmpCode, IcmpPacket, IcmpTimeExceededCode, IcmpType};
use trippy_packet::ipv6::Ipv6Packet;
use trippy_packet::tcp::TcpPacket;
use trippy_packet::udp::UdpPacket;

/// The maximum size of UDP packet we allow.
const MAX_UDP_PACKET_BUF: usize = MAX_PACKET_SIZE - Ipv6Packet::minimum_packet_size();

/// The maximum size of UDP payload we allow.
const MAX_UDP_PAYLOAD_BUF: usize = MAX_UDP_PACKET_BUF - UdpPacket::minimum_packet_size();

/// The maximum size of UDP packet we allow.
const MAX_ICMP_PACKET_BUF: usize = MAX_PACKET_SIZE - Ipv6Packet::minimum_packet_size();

/// The maximum size of ICMP payload we allow.
const MAX_ICMP_PAYLOAD_BUF: usize = MAX_ICMP_PACKET_BUF - IcmpPacket::minimum_packet_size();

/// The minimum size of ICMP packets we allow.
const MIN_PACKET_SIZE_ICMP: usize =
    Ipv6Packet::minimum_packet_size() + IcmpPacket::minimum_packet_size();

/// The minimum size of UDP packets we allow.
const MIN_PACKET_SIZE_UDP: usize =
    Ipv6Packet::minimum_packet_size() + UdpPacket::minimum_packet_size();

/// Magic prefix for IPv6/UDP/Dublin payloads.
const MAGIC: &[u8] = b"trippy";

/// IPv6 configuration.
#[derive(Debug)]
pub struct Ipv6 {
    pub src_addr: Ipv6Addr,
    pub dest_addr: Ipv6Addr,
    pub packet_size: PacketSize,
    pub payload_pattern: PayloadPattern,
    pub privilege_mode: PrivilegeMode,
    pub tos: TypeOfService,
    pub protocol: Protocol,
    pub icmp_extension_mode: IcmpExtensionParseMode,
    pub initial_sequence: Sequence,
}

impl Default for Ipv6 {
    fn default() -> Self {
        Self {
            src_addr: Ipv6Addr::UNSPECIFIED,
            dest_addr: Ipv6Addr::UNSPECIFIED,
            packet_size: PacketSize(0),
            payload_pattern: PayloadPattern(0),
            privilege_mode: PrivilegeMode::Privileged,
            tos: TypeOfService(0),
            protocol: Protocol::Icmp,
            icmp_extension_mode: IcmpExtensionParseMode::Disabled,
            initial_sequence: Sequence(0),
        }
    }
}

impl Ipv6 {
    /// Dispatch an ICMP probe.
    #[instrument(skip(self, icmp_send_socket), level = "trace")]
    pub fn dispatch_icmp_probe<S: Socket>(
        &self,
        icmp_send_socket: &mut S,
        probe: &Probe,
    ) -> Result<()> {
        let mut icmp_buf = [0_u8; MAX_ICMP_PACKET_BUF];
        let packet_size = usize::from(self.packet_size.0);
        if !(MIN_PACKET_SIZE_ICMP..=MAX_PACKET_SIZE).contains(&packet_size) {
            return Err(Error::InvalidPacketSize(packet_size));
        }
        let echo_request = self.make_echo_request_icmp_packet(
            &mut icmp_buf,
            probe.identifier,
            probe.sequence,
            icmp_payload_size(packet_size),
        )?;
        icmp_send_socket.set_unicast_hops_v6(probe.ttl.0)?;
        icmp_send_socket.set_tclass_v6(u32::from(self.tos.0))?;
        let remote_addr = SocketAddr::new(IpAddr::V6(self.dest_addr), 0);
        icmp_send_socket.send_to(echo_request.packet(), remote_addr)?;
        Ok(())
    }

    /// Dispatch a UDP probe.
    #[instrument(skip(self, raw_send_socket), level = "trace")]
    pub fn dispatch_udp_probe<S: Socket>(
        &self,
        raw_send_socket: &mut S,
        probe: &Probe,
    ) -> Result<()> {
        let packet_size = usize::from(self.packet_size.0);
        if !(MIN_PACKET_SIZE_UDP..=MAX_PACKET_SIZE).contains(&packet_size) {
            return Err(Error::InvalidPacketSize(packet_size));
        }
        let payload_size = udp_payload_size(packet_size);
        let payload = &[self.payload_pattern.0; MAX_UDP_PAYLOAD_BUF][0..payload_size];
        match self.privilege_mode {
            PrivilegeMode::Privileged => {
                self.dispatch_udp_probe_raw(raw_send_socket, probe, payload)
            }
            PrivilegeMode::Unprivileged => self.dispatch_udp_probe_non_raw::<S>(probe, payload),
        }
    }

    #[instrument(skip(self, udp_send_socket), level = "trace")]
    fn dispatch_udp_probe_raw<S: Socket>(
        &self,
        udp_send_socket: &mut S,
        probe: &Probe,
        payload: &[u8],
    ) -> Result<()> {
        let mut udp_buf = [0_u8; MAX_UDP_PACKET_BUF];
        let mut dublin_payload = [self.payload_pattern.0; MAX_UDP_PAYLOAD_BUF];
        let payload_paris = probe.sequence.0.to_be_bytes();
        let payload = if probe.flags.contains(Flags::PARIS_CHECKSUM) {
            payload_paris.as_slice()
        } else if probe.flags.contains(Flags::DUBLIN_IPV6_PAYLOAD_LENGTH) {
            let payload_len = probe.sequence.0 - self.initial_sequence.0;
            dublin_payload[..MAGIC.len()].copy_from_slice(MAGIC);
            &dublin_payload[..usize::from(payload_len) + MAGIC.len()]
        } else {
            payload
        };
        let mut udp =
            self.make_udp_packet(&mut udp_buf, probe.src_port.0, probe.dest_port.0, payload)?;
        if probe.flags.contains(Flags::PARIS_CHECKSUM) {
            let checksum = udp.get_checksum().to_be_bytes();
            let payload = u16::from_be_bytes(core::array::from_fn(|i| udp.payload()[i]));
            udp.set_checksum(payload);
            udp.set_payload(&checksum);
        }
        udp_send_socket.set_unicast_hops_v6(probe.ttl.0)?;
        udp_send_socket.set_tclass_v6(u32::from(self.tos.0))?;
        // Note that we set the port to be 0 in the remote `SocketAddr` as the target port is
        // encoded in the `UDP` packet.  If we (redundantly) set the target port here then
        // the `send_to` will fail with `EINVAL`.
        let remote_addr = SocketAddr::new(IpAddr::V6(self.dest_addr), 0);
        udp_send_socket.send_to(udp.packet(), remote_addr)?;
        Ok(())
    }

    #[instrument(skip(self), level = "trace")]
    fn dispatch_udp_probe_non_raw<S: Socket>(&self, probe: &Probe, payload: &[u8]) -> Result<()> {
        let local_addr = SocketAddr::new(IpAddr::V6(self.src_addr), probe.src_port.0);
        let remote_addr = SocketAddr::new(IpAddr::V6(self.dest_addr), probe.dest_port.0);
        let mut socket = S::new_udp_send_socket_ipv6(false)?;
        socket
            .bind(local_addr)
            .map_err(Error::IoError)
            .or_else(ErrorMapper::in_progress)
            .map_err(|err| ErrorMapper::addr_in_use(err, local_addr))?;
        socket.set_unicast_hops_v6(probe.ttl.0)?;
        socket.set_tclass_v6(u32::from(self.tos.0))?;
        socket.send_to(payload, remote_addr)?;
        Ok(())
    }

    /// Dispatch a TCP probe.
    #[instrument(skip(self), level = "trace")]
    pub fn dispatch_tcp_probe<S: Socket>(&self, probe: &Probe) -> Result<S> {
        let mut socket = S::new_stream_socket_ipv6()?;
        let local_addr = SocketAddr::new(IpAddr::V6(self.src_addr), probe.src_port.0);
        socket
            .bind(local_addr)
            .map_err(Error::IoError)
            .or_else(ErrorMapper::in_progress)
            .map_err(|err| ErrorMapper::addr_in_use(err, local_addr))?;
        socket.set_unicast_hops_v6(probe.ttl.0)?;
        socket.set_tclass_v6(u32::from(self.tos.0))?;
        let remote_addr = SocketAddr::new(IpAddr::V6(self.dest_addr), probe.dest_port.0);
        socket
            .connect(remote_addr)
            .map_err(Error::IoError)
            .or_else(ErrorMapper::in_progress)
            .map_err(|err| ErrorMapper::addr_in_use(err, remote_addr))?;
        Ok(socket)
    }

    /// Receive an ICMP probe.
    #[instrument(skip(self, recv_socket), level = "trace")]
    pub fn recv_icmp_probe<S: Socket>(&self, recv_socket: &mut S) -> Result<Option<Response>> {
        let mut buf = [0_u8; MAX_PACKET_SIZE];
        match recv_socket.recv_from(&mut buf) {
            Ok((bytes_read, addr)) => {
                let icmp_v6 = IcmpPacket::new_view(&buf[..bytes_read])?;
                let src_addr = match addr.as_ref().ok_or(Error::MissingAddr)? {
                    SocketAddr::V6(addr) => addr.ip(),
                    SocketAddr::V4(_) => panic!(),
                };
                Ok(self.extract_probe_resp(&icmp_v6, *src_addr)?)
            }
            Err(err) => match err.kind() {
                ErrorKind::Std(io::ErrorKind::WouldBlock) => Ok(None),
                _ => Err(Error::IoError(err)),
            },
        }
    }

    /// Receive a TCP probe.
    #[instrument(skip(self, tcp_socket), level = "trace")]
    pub fn recv_tcp_socket<S: Socket>(
        &self,
        tcp_socket: &mut S,
        src_port: Port,
        dest_port: Port,
    ) -> Result<Option<Response>> {
        let proto_resp = ProtocolResponse::Tcp(TcpProtocolResponse::new(
            IpAddr::V6(self.dest_addr),
            src_port.0,
            dest_port.0,
            None,
        ));
        match tcp_socket.take_error()? {
            None => {
                let addr = tcp_socket.peer_addr()?.ok_or(Error::MissingAddr)?.ip();
                tcp_socket.shutdown()?;
                return Ok(Some(Response::TcpReply(ResponseData::new(
                    SystemTime::now(),
                    addr,
             
```

### Core Architecture Module: `crates/trippy-core/src/net/platform.rs`
```
pub mod byte_order;

pub use byte_order::Ipv4ByteOrder;
use std::net::IpAddr;

#[cfg(unix)]
mod unix;

use crate::error::Result;
#[cfg(unix)]
pub use unix::*;

#[cfg(windows)]
mod windows;

#[cfg(windows)]
pub use self::windows::*;

/// Platform specific operations.
#[cfg_attr(test, mockall::automock)]
pub trait Platform {
    /// Determine the required byte ordering for IPv4 header fields.
    fn byte_order_for_address(addr: IpAddr) -> Result<Ipv4ByteOrder>;

    /// Lookup an `IpAddr` for an interface.
    ///
    /// If the interface has more than one address then an arbitrary address
    /// is selected and returned.
    fn lookup_interface_addr(addr: IpAddr, name: &str) -> Result<IpAddr>;

    /// Discover a local `IpAddr` which can route to the target address.
    fn discover_local_addr(target_addr: IpAddr, port: u16) -> Result<IpAddr>;
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

### Incident Patch 1: `d7ab50ac` (2026-07-15)
**Commit Message**: chore: bump ratatui from 0.30.1 to 0.30.2

Bumps [ratatui](https://github.com/ratatui/ratatui) from 0.30.1 to 0.30.2.
- [Release notes](https://github.com/ratatui/ratatui/releases)
- [Changelog](https://github.com/ratatui/ratatui/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ratatui/ratatui/compare/ratatui-v0.30.1...ratatui-v0.30.2)

---
updated-dependencies:
- dependency-name: ratatui
  dependency-version: 0.30.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +46/-22)
```diff
@@ -62,7 +62,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -73,7 +73,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -784,7 +784,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -1797,7 +1797,7 @@ version = "0.50.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7957b9740744892f114936ab4a57b3f487491bbeafaf8083688b16841a4240e5"
 dependencies = [
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -2229,30 +2229,30 @@ checksum = "63b8176103e19a2643978565ca18b50549f6101881c443590420e4dc998a3c69"
 
 [[package]]
 name = "ratatui"
-version = "0.30.1"
+version = "0.30.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1695748e3a735b34968c887ceea5a380b43545903868ae8f5b666593100f6b68"
+checksum = "3274ba0a2c5e1bcad2a2005d20f4dc59dad26b2eb0940fb094500dba4099d57d"
 dependencies = [
  "instability",
  "ratatui-core",
  "ratatui-crossterm",
  "ratatui-macros",
+ "ratatui-termina",
  "ratatui-termwiz",
  "ratatui-widgets",
  "serde",
 ]
 
 [[package]]
 name = "ratatui-core"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "42d3603f354bba8c595fa47860e60142d7372b7210c27044c6a7d0e1a4336b44"
+checksum = "cbb175c433c8e28a809d1f5773a2ae96e68c0ce40db865cbab1020bf33ae479c"
 dependencies = [
  "bitflags 2.13.0",
  "compact_str",
  "critical-section",
  "hashbrown 0.17.1",
- "indoc",
  "itertools 0.14.0",
  "kasuari",
  "lru",
@@ -2267,9 +2267,9 @@ dependencies = [
 
 [[package]]
 name = "ratatui-crossterm"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2b2867bedcbd6a690ca4f8672a687b730ec07660c79844517b084311b529980c"
+checksum = "567584a3b0e6a8203c23de40b4861497266725eb5363dbfd18a1edd603cca9f0"
 dependencies = [
  "cfg-if",
  "crossterm",
@@ -2279,29 +2279,40 @@ dependencies = [
 
 [[package]]
 name = "ratatui-macros"
-version = "0.7.1"
+version = "0.7.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "80fac59720679490d89d200df411faa249be728681adcabed3d047ae72c48f1d"
+checksum = "ed7dc68daa7498a43e4d68e0eb078427e10c38fbcfbb1e42d955f1fa2140d814"
 dependencies = [
  "ratatui-core",
  "ratatui-widgets",
 ]
 
+[[package]]
+name = "ratatui-termina"
+version = "0.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c0bf912d9e66f057a759d92e386a280ea886b352ab757d6ac4d653c7ed2c43c2"
+dependencies = [
+ "instability",
+ "ratatui-core",
+ "termina",
+]
+
 [[package]]
 name = "ratatui-termwiz"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "386b8ff8f74ed749509391c56d549761a2fcdb408e1f42e467286bcb7dac8967"
+checksum = "faf03e0380b7744054d6cb74224fe3adf062a029754933f575ca1e3b4c2ce977"
 dependencies = [
  "ratatui-core",
  "termwiz",
 ]
 
 [[package]]
 name = "ratatui-widgets"
-version = "0.3.1"
+version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7ef4f17dd7ac3abf5adc2b920a03c61eee4bfe6a88fa5191936895525371d79c"
+checksum = "66e3d19bcc9130ca376277d93b60767ff121ace3be06f5f95f81dd68956407d1"
 dependencies = [
  "bitflags 2.13.0",
  "hashbrown 0.17.1",
@@ -2400,7 +2411,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -2589,7 +2600,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "52d1cfed4120b4d927bf7c0f86d2087a4a7d6027c906d9f9d525a80573b9be51"
 dependencies = [
  "libc",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -2702,7 +2713,20 @@ dependencies = [
  "getrandom 0.4.2",
  "once_cell",
  "rustix",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
+]
+
+[[package]]
+name = "termina"
+version = "0.3.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9048a889effe34a5cddee0af7f53285198b16dca3be510858d38dfdb3e62a04e"
+dependencies = [
+ "bitflags 2.13.0",
+ "parking_lot",
+ "rustix",
+ "signal-hook",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -2712,7 +2736,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "230a1b821ccbd75b185820a1f1ff7b14d21da1e442e22c0863ea5f08771a8874"
 dependencies = [
  "rustix",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -3894,7 +3918,7 @@ source = "registry+https:/
```

---

### Incident Patch 2: `e18d1c30` (2026-07-17)
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

### Incident Patch 3: `8e31fd9d` (2026-07-13)
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

### Incident Patch 4: `92516bc4` (2026-06-10)
**Commit Message**: chore: bump ratatui from 0.30.0 to 0.30.1

Bumps [ratatui](https://github.com/ratatui/ratatui) from 0.30.0 to 0.30.1.
- [Release notes](https://github.com/ratatui/ratatui/releases)
- [Changelog](https://github.com/ratatui/ratatui/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ratatui/ratatui/compare/ratatui-v0.30.0...ratatui-v0.30.1)

---
updated-dependencies:
- dependency-name: ratatui
  dependency-version: 0.30.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +88/-42)
```diff
@@ -82,6 +82,15 @@ version = "1.0.102"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
+[[package]]
+name = "approx"
+version = "0.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cab112f0a86d568ea0e627cc1d6be74a1e9cd55214684db5561995f6dad897c6"
+dependencies = [
+ "num-traits",
+]
+
 [[package]]
 name = "arrayvec"
 version = "0.7.6"
@@ -199,6 +208,12 @@ version = "3.20.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5d20789868f4b01b2f2caec9f5c4e0213b41e3e5702a50157d699ae31ced2fcb"
 
+[[package]]
+name = "by_address"
+version = "1.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "64fa3c856b712db6612c019f14756e64e4bcea13337a6b33b696333a9eaa2d06"
+
 [[package]]
 name = "bytemuck"
 version = "1.25.0"
@@ -474,6 +489,12 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "critical-section"
+version = "1.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "790eea4361631c5e7d22598ecd5723ff611904e3344ce8720784c93e3d83d40b"
+
 [[package]]
 name = "crossbeam"
 version = "0.8.4"
@@ -837,6 +858,12 @@ dependencies = [
  "regex",
 ]
 
+[[package]]
+name = "fast-srgb8"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "dd2e7510819d6fbf51a5545c8f922716ecfb14df168a3242f7d33e0239efe6a1"
+
 [[package]]
 name = "fastrand"
 version = "2.4.1"
@@ -1085,6 +1112,11 @@ name = "hashbrown"
 version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
+dependencies = [
+ "allocator-api2",
+ "equivalent",
+ "foldhash 0.2.0",
+]
 
 [[package]]
 name = "heck"
@@ -1488,6 +1520,12 @@ dependencies = [
  "windows-link 0.2.1",
 ]
 
+[[package]]
+name = "libm"
+version = "0.2.16"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
+
 [[package]]
 name = "line-clipping"
 version = "0.3.7"
@@ -1538,11 +1576,11 @@ checksum = "5e5032e24019045c762d3c0f28f5b6b8bbf38563a65908389bf7978758920897"
 
 [[package]]
 name = "lru"
-version = "0.16.4"
+version = "0.18.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7f66e8d5d03f609abc3a39e6f08e4164ebf1447a732906d39eb9b99b7919ef39"
+checksum = "8a860605968fce16869fd239cf4237a82f3ac470723415db603b0e8b6c8d4fb9"
 dependencies = [
- "hashbrown 0.16.1",
+ "hashbrown 0.17.1",
 ]
 
 [[package]]
@@ -1830,6 +1868,30 @@ dependencies = [
  "num-traits",
 ]
 
+[[package]]
+name = "palette"
+version = "0.7.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4cbf71184cc5ecc2e4e1baccdb21026c20e5fc3dcf63028a086131b3ab00b6e6"
+dependencies = [
+ "approx",
+ "fast-srgb8",
+ "libm",
+ "palette_derive",
+]
+
+[[package]]
+name = "palette_derive"
+version = "0.7.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f5030daf005bface118c096f510ffb781fc28f9ab6a32ab224d8631be6851d30"
+dependencies = [
+ "by_address",
+ "proc-macro2",
+ "quote",
+ "syn 2.0.106",
+]
+
 [[package]]
 name = "parking"
 version = "2.2.1"
@@ -2179,32 +2241,36 @@ checksum = "63b8176103e19a2643978565ca18b50549f6101881c443590420e4dc998a3c69"
 
 [[package]]
 name = "ratatui"
-version = "0.30.0"
+version = "0.30.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d1ce67fb8ba4446454d1c8dbaeda0557ff5e94d39d5e5ed7f10a65eb4c8266bc"
+checksum = "1695748e3a735b34968c887ceea5a380b43545903868ae8f5b666593100f6b68"
 dependencies = [
  "instability",
  "ratatui-core",
  "ratatui-crossterm",
  "ratatui-macros",
  "ratatui-termwiz",
  "ratatui-widgets",
+ "serde",
 ]
 
 [[package]]
 name = "ratatui-core"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5ef8dea09a92caaf73bff7adb70b76162e5937524058a7e5bff37869cbbec293"
+checksum = "42d3603f354bba8c595fa47860e60142d7372b7210c27044c6a7d0e1a4336b44"
 dependencies = [
  "bitflags 2.13.0",
  "compact_str",
- "hashbrown 0.16.1",
+ "critical-section",
+ "hashbrown 0.17.1",
  "indoc",
  "itertools",
  "kasuari",
  "lru",
- "strum 0.27.2",
+ "palette",
+ "serde",
+ "strum",
  "thiserror 2.0.18",
  "unicode-segmentation",
  "unicode-truncate",
@@ -2213,9 +2279,9 @@ dependencies = [
 
 [[package]]
 name = "ratatui-crossterm"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "577c9b9f652b4c121fb25c6a391dd06406d3b092ba68827e6d2f09550edc54b3"
+checksum = "2b2867bedcbd6a690ca4f8672a687b730ec07660c79844517b084311b529980c"
 dependencies = [
  "cfg-if",
  "crossterm",
@@ -2225,38 +2291,39 @@ dependencies = [
 
 [[package]]
 name = "ratatui-macros"
-version = "0.7.0"
+version = "0.7.1"
 source = "registry+https://github.com/ru
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ paste = "1.0.15"
 petgraph = "0.8.3"
 pretty_assertions = "1.4.1"
 rand = "0.10.1"
-ratatui = "0.30.0"
+ratatui = "0.30.1"
 serde = { version = "1.0.201", default-features = false }
 serde_json = { version = "1.0.117", default-features = false }
 serde_with = { version = "3.21.0", default-features = false, features = ["macros"] }
```

---

### Incident Patch 5: `345f2e19` (2025-11-16)
**Commit Message**: feat(tui): add support for scrolling the list of flows (#1820)

**File**: `crates/trippy-tui/src/frontend/render/flows.rs` (modified, +79/-15)
```diff
@@ -4,14 +4,51 @@ use ratatui::Frame;
 use ratatui::layout::{Alignment, Rect};
 use ratatui::style::{Modifier, Style};
 use ratatui::text::Line;
-use ratatui::widgets::{Bar, BarChart, BarGroup, Block, BorderType, Borders};
+use ratatui::widgets::{Bar, BarChart, BarGroup, Block, BorderType, Borders, Paragraph};
+
+const FLOW_BAR_WIDTH: u16 = 4;
+const FLOW_BAR_GAP: u16 = 1;
 
 /// Render the flows.
-pub fn render(f: &mut Frame<'_>, rect: Rect, app: &TuiApp) {
+pub fn render(f: &mut Frame<'_>, rect: Rect, app: &mut TuiApp) {
+    let block = Block::default()
+        .title(Line::raw(t!("title_flows")))
+        .title_alignment(Alignment::Left)
+        .borders(Borders::ALL)
+        .border_type(BorderType::Rounded)
+        .border_style(Style::default().fg(app.tui_config.theme.border))
+        .style(
+            Style::default()
+                .bg(app.tui_config.theme.bg)
+                .fg(app.tui_config.theme.text),
+        );
+
+    let inner = block.inner(rect);
+    let visible_bars =
+        usize::from((inner.width + FLOW_BAR_GAP) / (FLOW_BAR_WIDTH + FLOW_BAR_GAP)).max(1);
+    let total_flows = app.flow_counts.len();
+    let selected_index = app
+        .flow_counts
+        .iter()
+        .position(|(flow_id, _)| *flow_id == app.selected_flow)
+        .unwrap_or(0);
+    let mut start_index = app
+        .flows_start_index
+        .min(total_flows.saturating_sub(visible_bars));
+    if selected_index < start_index {
+        start_index = selected_index;
+    } else if selected_index >= start_index + visible_bars {
+        start_index = selected_index + 1 - visible_bars;
+    }
+    app.flows_start_index = start_index;
     let round_flow_id = app.tracer_data().round_flow_id();
+    let show_left_indicator = start_index > 0;
+    let show_right_indicator = start_index + visible_bars < total_flows;
     let data: Vec<_> = app
         .flow_counts
         .iter()
+        .skip(start_index)
+        .take(visible_bars)
         .map(|(flow_id, count)| {
             let bar_color = if flow_id == &app.selected_flow {
                 app.tui_config.theme.flows_chart_bar_selected
@@ -35,22 +72,49 @@ pub fn render(f: &mut Frame<'_>, rect: Rect, app: &TuiApp) {
                 )
         })
         .collect();
-    let block = Block::default()
-        .title(Line::raw(t!("title_flows")))
-        .title_alignment(Alignment::Left)
-        .borders(Borders::ALL)
-        .border_type(BorderType::Rounded)
-        .border_style(Style::default().fg(app.tui_config.theme.border))
-        .style(
-            Style::default()
-                .bg(app.tui_config.theme.bg)
-                .fg(app.tui_config.theme.text),
-        );
     let group = BarGroup::default().bars(&data);
     let flow_counts = BarChart::default()
         .block(block)
         .data(group)
-        .bar_width(4)
-        .bar_gap(1);
+        .bar_width(FLOW_BAR_WIDTH)
+        .bar_gap(FLOW_BAR_GAP);
     f.render_widget(flow_counts, rect);
+    render_scroll_indicators(f, inner, show_left_indicator, show_right_indicator, app);
+}
+
+fn render_scroll_indicators(
+    f: &mut Frame<'_>,
+    inner_rect: Rect,
+    show_left_indicator: bool,
+    show_right_indicator: bool,
+    app: &TuiApp,
+) {
+    if inner_rect.width == 0 || inner_rect.height == 0 {
+        return;
+    }
+
+    let indicator_style = Style::default()
+        .fg(app.tui_config.theme.border)
+        .add_modifier(Modifier::BOLD);
+    let indicator_y = inner_rect.y + inner_rect.height / 2;
+    if show_left_indicator {
+        let left_rect = Rect {
+            x: inner_rect.x,
+            y: indicator_y,
+            width: 1,
+            height: 1,
+        };
+        let indicator = Paragraph::new(Line::raw("◀")).style(indicator_style);
+        f.render_widget(indicator, left_rect);
+    }
+    if show_right_indicator {
+        let right_rect = Rect {
+            x: inner_rect.x + inner_rect.width.saturating_sub(1),
+            y: indicator_y,
+            width: 1,
+            height: 1,
+        };
+        let indicator = Paragraph::new(Line::raw("▶")).style(indicator_style);
+        f.render_widget(indicator, right_rect);
+    }
 }
```

**File**: `crates/trippy-tui/src/frontend/tui_app.rs` (modified, +5/-0)
```diff
@@ -32,6 +32,8 @@ pub struct TuiApp {
     pub selected_flow: FlowId,
     /// Ordered flow ids with counts.
     pub flow_counts: Vec<(FlowId, usize)>,
+    /// The index of the first visible flow in the flows chart.
+    pub flows_start_index: usize,
     pub resolver: DnsResolver,
     pub geoip_lookup: GeoIpLookup,
     pub show_help: bool,
@@ -62,6 +64,7 @@ impl TuiApp {
             selected_hop_address: 0,
             selected_flow: State::default_flow_id(),
             flow_counts: vec![],
+            flows_start_index: 0,
             resolver,
             geoip_lookup,
             show_help: false,
@@ -370,10 +373,12 @@ impl TuiApp {
                 self.selected_flow = FlowId(0);
                 self.show_flows = false;
                 self.selected_hop_address = 0;
+                self.flows_start_index = 0;
             } else if self.flow_count() > 0 {
                 self.selected_flow = FlowId(1);
                 self.show_flows = true;
                 self.selected_hop_address = 0;
+                self.flows_start_index = 0;
             }
         }
     }
```

---

### Incident Patch 6: `842c5c2a` (2026-04-05)
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
+            self.next_round_action == Action::Stop || complete
         }
 
         /// Create and return the next `Probe` at the current `sequence` and `ttl`.
@@ -1257,7 +1276,8 @@ mod state {
         /// reset it here. We do this here to avoid having to deal with the sequence number
         /// wrapping during a round, which is more problematic.
         #[instrument(skip(self), level = "trace")]
-        pub fn advance_round(&mut self, first_ttl: TimeToLive) {
+        pub fn advance_round(&mut self, first_ttl: TimeToLive, next_round_action: Action) {
+            self.next_round_action = next_round_action;
             if self.sequence >= self.max_sequence() {
                 self.sequence = self.config.initial_sequence;
             }
@@ -1375,7 +1395,7 @@ mod state {
             }
 
             // Advance to the next round
-            state.advance_round(TimeToLive(1));
+            state.advance_round(TimeToLive(1), Action::Continue);
 
             // Validate the `TracerState` after the round up
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
             .name(format!("tracer-{}", self.trace_identifier().0))
@@ -425,7 +491,7 @@ mod inner {
     use crate::error::Result;
     use crate::net::{PlatformImpl, SocketImpl};
     use crate::{
-        Channel, Error, IcmpExtensionParseMode, MaxInflight, MaxRounds, MultipathStrategy,
+        Action, Channel, Error, IcmpExtensionParseMode, MaxInflight, MaxRounds, MultipathStrategy,
         PacketSize, PayloadPattern, PortDirection, PrivilegeMode, Protocol, Round, Sequence,
         SourceAddr, State, Strategy, TimeToLive, TraceId, TypeOfService,
     };
@@ -530,12 +596,15 @@ mod inner {
 
         #[instrument(skip_all, level = "trace")]
         pub(super) fn run(&self) -> Result<()> {
-            self.run_internal(|_| ())
-                .map_err(|err| self.handle_error(err))
+            self.run_with(|_| ())
         }
 
         #[instrument(skip_all, level = "trace")]
-        pub(super) fn run_with<F: Fn(&Round<'_>)>(&self, func: F) -> Result<()> {
+        pub(super) fn run_with<F, R>(&self, func: F) -> Result<()>
+   
```

---

### Incident Patch 7: `dc362e7f` (2025-12-24)
**Commit Message**: chore: bump `ratatui` to `0.30.0`

Bumps [tun](https://github.com/meh/rust-tun) from 0.8.4 to 0.8.5.
- [Release notes](https://github.com/meh/rust-tun/releases)
- [Commits](https://github.com/meh/rust-tun/commits/v0.8.5)

---
updated-dependencies:
- dependency-name: tun
  dependency-version: 0.8.5
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +799/-129)
```diff
@@ -114,7 +114,16 @@ checksum = "9035ad2d096bed7955a320ee7e2230574d28fd3c3a0f186cbea1ff3c7eed5dbb"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn",
+ "syn 2.0.106",
+]
+
+[[package]]
+name = "atomic"
+version = "0.6.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a89cbf775b137e9b968e67227ef7f775587cde3fd31b0d8599dbd0f598a48340"
+dependencies = [
+ "bytemuck",
 ]
 
 [[package]]
@@ -129,12 +138,48 @@ version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
+[[package]]
+name = "base64"
+version = "0.22.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
+
+[[package]]
+name = "bit-set"
+version = "0.5.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0700ddab506f33b20a03b13996eccd309a48e5ff77d0d95926aa0210fb4e95f1"
+dependencies = [
+ "bit-vec",
+]
+
+[[package]]
+name = "bit-vec"
+version = "0.6.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "349f9b6a179ed607305526ca489b34ad0a41aed5f7980fa90eb03160b69598fb"
+
+[[package]]
+name = "bitflags"
+version = "1.3.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
+
 [[package]]
 name = "bitflags"
 version = "2.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
 
+[[package]]
+name = "block-buffer"
+version = "0.10.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
+dependencies = [
+ "generic-array",
+]
+
 [[package]]
 name = "blocking"
 version = "1.6.2"
@@ -154,6 +199,12 @@ version = "3.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "46c5e41b57b8bba42a04676d81cb89e9ee8e859a1a66f80a5a72e1cb76b34d43"
 
+[[package]]
+name = "bytemuck"
+version = "1.25.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c8efb64bd706a16a1bdde310ae86b351e4d21550d98d056f22f8a7f7a2183fec"
+
 [[package]]
 name = "byteorder"
 version = "1.5.0"
@@ -183,7 +234,7 @@ checksum = "153187c06ed005d5cb75ed9f0a2f274836f54f6b2efdc1f45136e728764875f9"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn",
+ "syn 2.0.106",
  "unicode-ident",
 ]
 
@@ -196,12 +247,6 @@ dependencies = [
  "libc",
 ]
 
-[[package]]
-name = "cassowary"
-version = "0.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df8670b8c7b9dae1793364eafadf7239c40d669904660c5960d74cfd80b46a53"
-
 [[package]]
 name = "castaway"
 version = "0.2.4"
@@ -240,7 +285,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "6f8d983286843e49675a4b7a2d174efe136dc93a18d69130dd18198a6c167601"
 dependencies = [
  "cfg-if",
- "cpufeatures",
+ "cpufeatures 0.3.0",
  "rand_core 0.10.0",
 ]
 
@@ -263,7 +308,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6139a8597ed92cf816dfb33f5dd6cf0bb93a6adc938f11039f371bc5bcd26c3"
 dependencies = [
  "chrono",
- "phf",
+ "phf 0.12.1",
 ]
 
 [[package]]
@@ -317,7 +362,7 @@ dependencies = [
  "heck",
  "proc-macro2",
  "quote",
- "syn",
+ "syn 2.0.106",
 ]
 
 [[package]]
@@ -349,14 +394,14 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b03b7db8e0b4b2fdad6c551e634134e99ec000e5c8c3b6856c65e8bbaded7a3b"
 dependencies = [
  "unicode-segmentation",
- "unicode-width 0.2.0",
+ "unicode-width",
 ]
 
 [[package]]
 name = "compact_str"
-version = "0.8.1"
+version = "0.9.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3b79c4069c6cad78e2e0cdfcbd26275770669fb39fd308a752dc110e83b9af32"
+checksum = "3fdb1325a1cece981e8a296ab8f0f9b63ae357bd0784a9faaf548cc7b480707a"
 dependencies = [
  "castaway",
  "cfg-if",
@@ -386,6 +431,15 @@ dependencies = [
  "windows-sys 0.61.2",
 ]
 
+[[package]]
+name = "convert_case"
+version = "0.10.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "633458d4ef8c78b72454de2d54fd6ab2e60f9e02be22f3c6104cdc8a4e0fceb9"
+dependencies = [
+ "unicode-segmentation",
+]
+
 [[package]]
 name = "core-foundation"
 version = "0.9.4"
@@ -402,6 +456,15 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
+[[package]]
+name = "cpufeatures"
+version = "0.2.17"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "59ed5838eebb26a2bb2e58f6d5b5316989ae9d08bab10e0e6d103e656d1b0280"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "cpufeatures"
 version = "0.3.0"
@@ -469,15 +532,17 @@ checksum = "d0a5c400df2834b80a4c3327b3aad3a4c4cd4de0629
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -41,7 +41,7 @@ clap_complete = "4.6.0"
 clap_mangen = "0.3.0"
 comfy-table = { version = "7.1.4", default-features = false }
 crossbeam = "0.8.4"
-crossterm = { version = "0.28.1", default-features = false }
+crossterm = { version = "0.29.0", default-features = false }
 csv = "1.4.0"
 derive_more = { version = "2.1.1", default-features = false }
 dns-lookup = "3.0.1"
@@ -62,7 +62,7 @@ paste = "1.0.15"
 petgraph = "0.8.3"
 pretty_assertions = "1.4.1"
 rand = "0.10.1"
-ratatui = "0.29.0"
+ratatui = "0.30.0"
 serde = { version = "1.0.201", default-features = false }
 serde_json = { version = "1.0.117", default-features = false }
 serde_with = { version = "3.19.0", default-features = false, features = ["macros"] }
```

**File**: `crates/trippy-tui/src/frontend.rs` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ use crossterm::{
 };
 use ratatui::layout::Position;
 use ratatui::{
-    Terminal,
+    DefaultTerminal, Terminal,
     backend::{Backend, CrosstermBackend},
 };
 use std::io;
@@ -69,7 +69,7 @@ enum ExitAction {
 }
 
 #[expect(clippy::too_many_lines)]
-fn run_app<B: Backend>(terminal: &mut Terminal<B>, app: &mut TuiApp) -> io::Result<ExitAction> {
+fn run_app(terminal: &mut DefaultTerminal, app: &mut TuiApp) -> io::Result<ExitAction> {
     loop {
         if app.frozen_start.is_none() {
             app.snapshot_trace_data();
```

---

### Incident Patch 8: `2b003a64` (2026-05-04)
**Commit Message**: build(deps): bump serde_with from 3.17.0 to 3.19.0

Bumps [serde_with](https://github.com/jonasbb/serde_with) from 3.17.0 to 3.19.0.
- [Release notes](https://github.com/jonasbb/serde_with/releases)
- [Commits](https://github.com/jonasbb/serde_with/compare/v3.17.0...v3.19.0)

---
updated-dependencies:
- dependency-name: serde_with
  dependency-version: 3.19.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +14/-15)
```diff
@@ -525,12 +525,12 @@ dependencies = [
 
 [[package]]
 name = "darling"
-version = "0.21.3"
+version = "0.23.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9cdf337090841a411e2a7f3deb9187445851f91b309c0c0a29e05f74a00a48c0"
+checksum = "25ae13da2f202d56bd7f91c25fba009e7717a1e4a1cc98a76d844b65ae912e9d"
 dependencies = [
- "darling_core 0.21.3",
- "darling_macro 0.21.3",
+ "darling_core 0.23.0",
+ "darling_macro 0.23.0",
 ]
 
 [[package]]
@@ -549,11 +549,10 @@ dependencies = [
 
 [[package]]
 name = "darling_core"
-version = "0.21.3"
+version = "0.23.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1247195ecd7e3c85f83c8d2a366e4210d588e802133e1e355180a9870b517ea4"
+checksum = "9865a50f7c335f53564bb694ef660825eb8610e0a53d3e11bf1b0d3df31e03b0"
 dependencies = [
- "fnv",
  "ident_case",
  "proc-macro2",
  "quote",
@@ -574,11 +573,11 @@ dependencies = [
 
 [[package]]
 name = "darling_macro"
-version = "0.21.3"
+version = "0.23.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d38308df82d1080de0afee5d069fa14b0326a88c14f15c5ccda35b4a6c414c81"
+checksum = "ac3984ec7bd6cfa798e62b4a642426a5be0e68f9401cfc2a01e3fa9ea2fcdb8d"
 dependencies = [
- "darling_core 0.21.3",
+ "darling_core 0.23.0",
  "quote",
  "syn",
 ]
@@ -2005,21 +2004,21 @@ dependencies = [
 
 [[package]]
 name = "serde_with"
-version = "3.17.0"
+version = "3.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "381b283ce7bc6b476d903296fb59d0d36633652b633b27f64db4fb46dcbfc3b9"
+checksum = "f05839ce67618e14a09b286535c0d9c94e85ef25469b0e13cb4f844e5593eb19"
 dependencies = [
  "serde_core",
  "serde_with_macros",
 ]
 
 [[package]]
 name = "serde_with_macros"
-version = "3.17.0"
+version = "3.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a6d4e30573c8cb306ed6ab1dca8423eec9a463ea0e155f45399455e0368b27e0"
+checksum = "cf2ebbe86054f9b45bc3881e865683ccfaccce97b9b4cb53f3039d67f355a334"
 dependencies = [
- "darling 0.21.3",
+ "darling 0.23.0",
  "proc-macro2",
  "quote",
  "syn",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ rand = "0.10.1"
 ratatui = "0.29.0"
 serde = { version = "1.0.201", default-features = false }
 serde_json = { version = "1.0.117", default-features = false }
-serde_with = { version = "3.17.0", default-features = false, features = ["macros"] }
+serde_with = { version = "3.19.0", default-features = false, features = ["macros"] }
 socket2 = "0.6.3"
 strum = { version = "0.28.0", default-features = false }
 sys-locale = "0.3.2"
```

---

### Incident Patch 9: `5ad8c74e` (2026-05-05)
**Commit Message**: build(deps): bump tokio from 1.52.1 to 1.52.2

Bumps [tokio](https://github.com/tokio-rs/tokio) from 1.52.1 to 1.52.2.
- [Release notes](https://github.com/tokio-rs/tokio/releases)
- [Commits](https://github.com/tokio-rs/tokio/compare/tokio-1.52.1...tokio-1.52.2)

---
updated-dependencies:
- dependency-name: tokio
  dependency-version: 1.52.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2364,9 +2364,9 @@ checksum = "1f3ccbac311fea05f86f61904b462b55fb3df8837a366dfc601a0161d0532f20"
 
 [[package]]
 name = "tokio"
-version = "1.52.1"
+version = "1.52.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b67dee974fe86fd92cc45b7a95fdd2f99a36a6d7b0d431a231178d3d670bbcc6"
+checksum = "110a78583f19d5cdb2c5ccf321d1290344e71313c6c37d43520d386027d18386"
 dependencies = [
  "bytes",
  "libc",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ strum = { version = "0.28.0", default-features = false }
 sys-locale = "0.3.2"
 test-case = "3.3.1"
 thiserror = "2.0.3"
-tokio = "1.52.1"
+tokio = "1.52.2"
 tokio-util = "0.7.18"
 toml = { version = "1.1.2", default-features = false, features = ["serde"] }
 tracing = "0.1.44"
```

---

### Incident Patch 10: `31136aa2` (2026-04-27)
**Commit Message**: build(deps): bump maxminddb from 0.27.3 to 0.28.1

Bumps [maxminddb](https://github.com/oschwald/maxminddb-rust) from 0.27.3 to 0.28.1.
- [Release notes](https://github.com/oschwald/maxminddb-rust/releases)
- [Changelog](https://github.com/oschwald/maxminddb-rust/blob/main/CHANGELOG.md)
- [Commits](https://github.com/oschwald/maxminddb-rust/compare/v0.27.3...v0.28.1)

---
updated-dependencies:
- dependency-name: maxminddb
  dependency-version: 0.28.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1359,9 +1359,9 @@ dependencies = [
 
 [[package]]
 name = "maxminddb"
-version = "0.27.3"
+version = "0.28.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "76371bd37ce742f8954daabd0fde7f1594ee43ac2200e20c003ba5c3d65e2192"
+checksum = "faf6467428ad055b71e588bcedcbaf2ff605b3251deb0c52be4a04b674c546dd"
 dependencies = [
  "ipnetwork",
  "log",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ humantime = "2.3.0"
 indexmap = { version = "2.14.0", default-features = false }
 insta = "1.47.2"
 itertools = "0.14.0"
-maxminddb = "0.27.3"
+maxminddb = "0.28.1"
 mockall = "0.14.0"
 nix = { version = "0.31.2", default-features = false }
 parking_lot = "0.12.5"
```

---

### Incident Patch 11: `85e81ac5` (2026-04-24)
**Commit Message**: build(deps): bump tokio from 1.52.0 to 1.52.1

Bumps [tokio](https://github.com/tokio-rs/tokio) from 1.52.0 to 1.52.1.
- [Release notes](https://github.com/tokio-rs/tokio/releases)
- [Commits](https://github.com/tokio-rs/tokio/compare/tokio-1.52.0...tokio-1.52.1)

---
updated-dependencies:
- dependency-name: tokio
  dependency-version: 1.52.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2364,9 +2364,9 @@ checksum = "1f3ccbac311fea05f86f61904b462b55fb3df8837a366dfc601a0161d0532f20"
 
 [[package]]
 name = "tokio"
-version = "1.52.0"
+version = "1.52.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a91135f59b1cbf38c91e73cf3386fca9bb77915c45ce2771460c9d92f0f3d776"
+checksum = "b67dee974fe86fd92cc45b7a95fdd2f99a36a6d7b0d431a231178d3d670bbcc6"
 dependencies = [
  "bytes",
  "libc",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ strum = { version = "0.28.0", default-features = false }
 sys-locale = "0.3.2"
 test-case = "3.3.1"
 thiserror = "2.0.3"
-tokio = "1.52.0"
+tokio = "1.52.1"
 tokio-util = "0.7.18"
 toml = { version = "1.1.2", default-features = false, features = ["serde"] }
 tracing = "0.1.44"
```

---

### Incident Patch 12: `d55e0501` (2026-04-21)
**Commit Message**: build(deps): bump tun-rs from 2.8.2 to 2.8.3

Bumps [tun-rs](https://github.com/tun-rs/tun-rs) from 2.8.2 to 2.8.3.
- [Release notes](https://github.com/tun-rs/tun-rs/releases)
- [Commits](https://github.com/tun-rs/tun-rs/compare/2.8.2...2.8.3)

---
updated-dependencies:
- dependency-name: tun-rs
  dependency-version: 2.8.3
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +6/-6)
```diff
@@ -2651,9 +2651,9 @@ dependencies = [
 
 [[package]]
 name = "tun-rs"
-version = "2.8.2"
+version = "2.8.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5aed038a26d2b6a7906a62b3d0c42fb77541b0a695b9c2b9489a0c25c093ce8b"
+checksum = "d81d4007ae1904e2e00028dc0215f0d2ca5af18acdf8664fb75ae6c9a20b98c7"
 dependencies = [
  "blocking",
  "byteorder",
@@ -2672,7 +2672,7 @@ dependencies = [
  "tokio",
  "widestring",
  "windows-sys 0.61.2",
- "winreg 0.55.0",
+ "winreg 0.56.0",
 ]
 
 [[package]]
@@ -3292,12 +3292,12 @@ dependencies = [
 
 [[package]]
 name = "winreg"
-version = "0.55.0"
+version = "0.56.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cb5a765337c50e9ec252c2069be9bf91c7df47afb103b642ba3a53bf8101be97"
+checksum = "7d6f32a0ff4a9f6f01231eb2059cc85479330739333e0e58cadf03b6af2cca10"
 dependencies = [
  "cfg-if",
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ toml = { version = "1.1.2", default-features = false, features = ["serde"] }
 tracing = "0.1.44"
 tracing-chrome = "0.7.2"
 tracing-subscriber = { version = "0.3.23", default-features = false }
-tun-rs = "2.8.2"
+tun-rs = "2.8.3"
 unic-langid = "0.9.6"
 unicode-width = "0.2.0"
 widestring = "1.2.1"
```

---

### Incident Patch 13: `2887058b` (2026-04-19)
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

### Incident Patch 14: `ec974510` (2026-04-15)
**Commit Message**: build(deps): bump tokio from 1.51.1 to 1.52.0

Bumps [tokio](https://github.com/tokio-rs/tokio) from 1.51.1 to 1.52.0.
- [Release notes](https://github.com/tokio-rs/tokio/releases)
- [Commits](https://github.com/tokio-rs/tokio/compare/tokio-1.51.1...tokio-1.52.0)

---
updated-dependencies:
- dependency-name: tokio
  dependency-version: 1.52.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2364,9 +2364,9 @@ checksum = "1f3ccbac311fea05f86f61904b462b55fb3df8837a366dfc601a0161d0532f20"
 
 [[package]]
 name = "tokio"
-version = "1.51.1"
+version = "1.52.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f66bf9585cda4b724d3e78ab34b73fb2bbaba9011b9bfdf69dc836382ea13b8c"
+checksum = "a91135f59b1cbf38c91e73cf3386fca9bb77915c45ce2771460c9d92f0f3d776"
 dependencies = [
  "bytes",
  "libc",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ strum = { version = "0.28.0", default-features = false }
 sys-locale = "0.3.2"
 test-case = "3.3.1"
 thiserror = "2.0.3"
-tokio = "1.51.1"
+tokio = "1.52.0"
 tokio-util = "0.7.18"
 toml = { version = "1.1.2", default-features = false, features = ["serde"] }
 tracing = "0.1.44"
```

---

### Incident Patch 15: `8331a911` (2026-04-15)
**Commit Message**: build(deps): bump bitflags from 2.11.0 to 2.11.1

Bumps [bitflags](https://github.com/bitflags/bitflags) from 2.11.0 to 2.11.1.
- [Release notes](https://github.com/bitflags/bitflags/releases)
- [Changelog](https://github.com/bitflags/bitflags/blob/main/CHANGELOG.md)
- [Commits](https://github.com/bitflags/bitflags/compare/2.11.0...2.11.1)

---
updated-dependencies:
- dependency-name: bitflags
  dependency-version: 2.11.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -131,9 +131,9 @@ checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
 [[package]]
 name = "bitflags"
-version = "2.11.0"
+version = "2.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "843867be96c8daad0d758b57df9392b6d8d271134fce549de6ce169ff98a92af"
+checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
 
 [[package]]
 name = "blocking"
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ trippy-dns = { version = "0.14.0-dev", path = "crates/trippy-dns" }
 trippy-packet = { version = "0.14.0-dev", path = "crates/trippy-packet" }
 anyhow = "1.0.91"
 arrayvec = { version = "0.7.6", default-features = false }
-bitflags = "2.11.0"
+bitflags = "2.11.1"
 caps = "0.5.6"
 chrono = { version = "0.4.44", default-features = false }
 chrono-tz = "0.10.4"
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
