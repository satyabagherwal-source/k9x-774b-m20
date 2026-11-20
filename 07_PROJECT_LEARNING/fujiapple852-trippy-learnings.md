> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fujiapple852-trippy-learnings.md`  
> **Source**: github ([https://github.com/fujiapple852/trippy](https://github.com/fujiapple852/trippy))  
> **Source Version**: `42a3508e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T06:10:47.962Z  
> **Learning ID**: `learn-github-fujiapple852-trippy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): fujiapple852/trippy

> **Canonical Artifact**: `07_PROJECT_LEARNING/fujiapple852-trippy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fujiapple852/trippy](https://github.com/fujiapple852/trippy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T06:10:47.792Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fujiapple852/trippy`
- **Description**: A network diagnostic tool 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 8175 stars

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
    PeekSender,
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
            Self::PeekSender => write!(f, "peek sender"),
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1897** (2026-10-25): **Tracing an IPv4 target fails during IPv4 byte order on Android**
  *Symptoms*: 

- **Issue #1793** (2026-04-18): **keep Windows `WSARecvFrom` flags alive**
  *Symptoms*: Sim tests crash on Windows with Rust 1.95  See: https://github.com/fujiapple852/trippy/actions/runs/24526729292/job/71766060138  ``` thread 'tokio-rt-worker' (5996) panicked at /rustc/59807616e1fa2540724bfbac14d7976d7e4a3860/library\alloc\src\raw_vec\mod.rs:641:30: unsafe precondition(s) violated: Layout::from_size_align_unchecked requires that align is a power of 2 and the rounded-up allocation size does not exceed isize::MAX  This indicates a bug in the program. This Undefined Behavior check is optional, and cannot be relied on for safety. note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace thread caused non-unwinding panic. aborting. 2026-04-17T04:23:43.223814Z  INFO sim::tracer: 0 2 fd00:10::102 2026-04-17T04:23:43.223824Z  INFO sim::tracer: 0 3 fd00:10::103 error: test failed, to rerun pass `-p trippy-core --test sim`  Caused by:   process didn't exit successfully: `D:\a\trippy\trippy\target\x86_64-pc-windows-msvc\debug\deps\sim-276160054c9e564d.exe --exact --nocapture` (exit code: 0xc0000409, STATUS_STACK_BUFFER_OVERRUN) ```

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

### Incident Patch 1: `42a3508e` (2026-11-19)
**Commit Message**: refactor(tui): replace unmaintained `humantime` with `jiff`

**File**: `Cargo.lock` (modified, +0/-7)
```diff
@@ -1186,12 +1186,6 @@ dependencies = [
  "tracing",
 ]
 
-[[package]]
-name = "humantime"
-version = "2.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "15cdd26707701c53297e2fa6afb323d55fbc1d0810c3aec078ae3ef0424c3c15"
-
 [[package]]
 name = "icu_collections"
 version = "2.4.0"
@@ -3368,7 +3362,6 @@ dependencies = [
  "csv",
  "encoding_rs_io",
  "etcetera",
- "humantime",
  "insta",
  "itertools 0.15.0",
  "jiff",
```

**File**: `Cargo.toml` (modified, +0/-1)
```diff
@@ -48,7 +48,6 @@ etcetera = "0.11.0"
 futures-concurrency = "7.6.3"
 hex-literal = "1.1.0"
 hickory-resolver = "0.26.3"
-humantime = "2.3.0"
 indexmap = { version = "2.14.0", default-features = false }
 insta = "1.47.2"
 itertools = "0.15.0"
```

**File**: `crates/trippy-tui/Cargo.toml` (modified, +0/-1)
```diff
@@ -26,7 +26,6 @@ crossterm = { workspace = true, default-features = false, features = ["events",
 csv.workspace = true
 encoding_rs_io.workspace = true
 etcetera.workspace = true
-humantime.workspace = true
 itertools.workspace = true
 jiff = { workspace = true, features = ["serde"] }
 maxminddb.workspace = true
```

**File**: `crates/trippy-tui/src/config.rs` (modified, +8/-8)
```diff
@@ -1315,11 +1315,11 @@ mod tests {
     #[test_case("trip example.com", Ok(cfg().min_round_duration(Duration::from_millis(1000)).build()); "default min round duration")]
     #[test_case("trip example.com --min-round-duration 250ms", Ok(cfg().min_round_duration(Duration::from_millis(250)).build()); "custom min round duration")]
     #[test_case("trip example.com -i 250ms", Ok(cfg().min_round_duration(Duration::from_millis(250)).build()); "custom min round duration short")]
-    #[test_case("trip example.com --min-round-duration 0", Ok(cfg().min_round_duration(Duration::from_millis(0)).build()); "zero min round duration")]
+    #[test_case("trip example.com --min-round-duration 0s", Ok(cfg().min_round_duration(Duration::from_millis(0)).build()); "zero min round duration")]
     #[test_case("trip example.com", Ok(cfg().min_round_duration(Duration::from_millis(1000)).build()); "default max round duration")]
     #[test_case("trip example.com --max-round-duration 1250ms", Ok(cfg().max_round_duration(Duration::from_millis(1250)).build()); "custom max round duration")]
     #[test_case("trip example.com -T 2s", Ok(cfg().max_round_duration(Duration::from_millis(2000)).build()); "custom max round duration short")]
-    #[test_case("trip example.com --max-round-duration 0", Err(anyhow!("max-round-duration (0ns) must not be less than min-round-duration (1s)")); "invalid format max round duration")]
+    #[test_case("trip example.com --max-round-duration 0s", Err(anyhow!("max-round-duration (0ns) must not be less than min-round-duration (1s)")); "invalid format max round duration")]
     #[test_case("trip example.com -i 250ms -T 250ms", Ok(cfg().min_round_duration(Duration::from_millis(250)).max_round_duration(Duration::from_millis(250)).build()); "custom min and max round duration")]
     #[test_case("trip example.com -i 300ms -T 250ms", Err(anyhow!("max-round-duration (250ms) must not be less than min-round-duration (300ms)")); "min round duration greater than max")]
     fn test_round_duration(cmd: &str, expected: anyhow::Result<TrippyConfig>) {
@@ -1329,7 +1329,7 @@ mod tests {
     #[test_case("trip example.com", Ok(cfg().grace_duration(Duration::from_millis(100)).build()); "default grace duration")]
     #[test_case("trip example.com --grace-duration 10ms", Ok(cfg().grace_duration(Duration::from_millis(10)).build()); "custom grace duration")]
     #[test_case("trip example.com -g 50ms", Ok(cfg().grace_duration(Duration::from_millis(50)).build()); "custom grace duration short")]
-    #[test_case("trip example.com --grace-duration 0", Err(anyhow!("grace-duration (0ns) must be between 10ms and 1s inclusive")); "invalid format grace duration")]
+    #[test_case("trip example.com --grace-duration 0s", Err(anyhow!("grace-duration (0ns) must be between 10ms and 1s inclusive")); "invalid format grace duration")]
     #[test_case("trip example.com --grace-duration 9ms", Err(anyhow!("grace-duration (9ms) must be between 10ms and 1s inclusive")); "invalid low grace duration")]
     #[test_case("trip example.com --grace-duration 1001ms", Err(anyhow!("grace-duration (1.001s) must be between 10ms and 1s inclusive")); "invalid high grace duration")]
     fn test_grace_duration(cmd: &str, expected: anyhow::Result<TrippyConfig>) {
@@ -1373,7 +1373,7 @@ mod tests {
 
     #[test_case("trip example.com", Ok(cfg().read_timeout(Duration::from_millis(10)).build()); "default read timeout")]
     #[test_case("trip example.com --read-timeout 20ms", Ok(cfg().read_timeout(Duration::from_millis(20)).build()); "custom read timeout")]
-    #[test_case("trip example.com --read-timeout 20", Err(anyhow!("error: invalid value '20' for '--read-timeout <READ_TIMEOUT>': time unit needed, for example 20sec or 20ms For more information, try '--help'.")); "invalid custom read timeout")]
+    #[test_case("trip example.com --read-timeout 20", Err(anyhow!("error: invalid value '20' for '--read-timeout <READ_TIMEOUT>': failed to parse input in the \"friendly\" duration format: expected to find unit designator suffix (e.g., `years` or `secs`) after parsing integer For more information, try '--help'.")); "invalid custom read timeout")]
     #[test_case("trip example.com --read-timeout 9ms", Err(anyhow!("read-timeout (9ms) must be between 10ms and 100ms inclusive")); "invalid low custom read timeout")]
     #[test_case("trip example.com --read-timeout 101ms", Err(anyhow!("read-timeout (101ms) must be between 10ms and 100ms inclusive")); "invalid high custom read timeout")]
     fn test_read_timeout(cmd: &str, expected: anyhow::Result<TrippyConfig>) {
@@ -1420,14 +1420,14 @@ mod tests {
 
     #[test_case("trip example.com", Ok(cfg().dns_timeout(Duration::from_millis(5000)).build()); "default dns timeout")]
     #[test_case("trip example.com --dns-timeout 20ms", Ok(cfg().dns_timeout(Duration::from_millis(20)).build()); "custom dns timeout")]
-    #[test_case("trip example.com --dns-timeout 20", Err(anyhow!("error: invalid value '20' for '--dns-timeout <DNS_T
```

**File**: `crates/trippy-tui/src/config/cmd.rs` (modified, +2/-1)
```diff
@@ -8,6 +8,7 @@ use crate::config::{
 use anyhow::anyhow;
 use clap::Parser;
 use clap_complete::Shell;
+use jiff::fmt::friendly::SpanParser;
 use std::net::IpAddr;
 use std::str::FromStr;
 use std::time::Duration;
@@ -317,7 +318,7 @@ fn parse_tui_binding_value(value: &str) -> anyhow::Result<(TuiCommandItem, TuiKe
 }
 
 fn parse_duration(value: &str) -> anyhow::Result<Duration> {
-    Ok(humantime::parse_duration(value)?)
+    Ok(SpanParser::new().parse_unsigned_duration(value)?)
 }
 
 fn parse_addr(value: &str) -> anyhow::Result<IpAddr> {
```

**File**: `crates/trippy-tui/src/config/file.rs` (modified, +7/-16)
```diff
@@ -140,15 +140,15 @@ pub struct ConfigStrategy {
     pub source_address: Option<IpAddr>,
     pub interface: Option<String>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub min_round_duration: Option<Duration>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub max_round_duration: Option<Duration>,
     pub initial_sequence: Option<u16>,
     pub multipath_strategy: Option<MultipathStrategyConfig>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub grace_duration: Option<Duration>,
     pub max_inflight: Option<u8>,
     pub first_ttl: Option<u8>,
@@ -158,7 +158,7 @@ pub struct ConfigStrategy {
     pub tos: Option<u8>,
     pub icmp_extensions: Option<bool>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub read_timeout: Option<Duration>,
     pub max_samples: Option<usize>,
     pub max_flows: Option<usize>,
@@ -202,10 +202,10 @@ pub struct ConfigDns {
     pub dns_resolve_all: Option<bool>,
     pub dns_lookup_as_info: Option<bool>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub dns_timeout: Option<Duration>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub dns_ttl: Option<Duration>,
 }
 
@@ -240,7 +240,7 @@ impl Default for ConfigReport {
 pub struct ConfigTui {
     pub tui_preserve_screen: Option<bool>,
     #[serde(default)]
-    #[serde(deserialize_with = "humantime_deser")]
+    #[serde(with = "jiff::fmt::serde::unsigned_duration::optional")]
     pub tui_refresh_rate: Option<Duration>,
     pub tui_privacy_max_ttl: Option<u8>,
     pub tui_address_mode: Option<AddressMode>,
@@ -467,15 +467,6 @@ impl Default for ConfigBindings {
     }
 }
 
-fn humantime_deser<'de, D>(deserializer: D) -> Result<Option<Duration>, D::Error>
-where
-    D: serde::Deserializer<'de>,
-{
-    humantime::parse_duration(&String::deserialize(deserializer)?)
-        .map_err(serde::de::Error::custom)
-        .map(Some)
-}
-
 fn addr_deser<'de, D>(deserializer: D) -> Result<Option<IpAddr>, D::Error>
 where
     D: serde::Deserializer<'de>,
```

**File**: `crates/trippy-tui/src/frontend/render/header.rs` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
+use crate::frontend::render::util;
 use crate::frontend::tui_app::TuiApp;
 use crate::t;
-use humantime::format_duration;
 use jiff::Timestamp;
 use jiff::fmt::temporal::DateTimePrinter;
 use jiff::tz::TimeZone;
@@ -274,7 +274,7 @@ fn render_status(app: &TuiApp) -> String {
     if app.selected_tracer_data.error().is_some() {
         String::from(t!("status_failed"))
     } else if let Some(start) = app.frozen_start {
-        let frozen = format_duration(Duration::from_secs(
+        let frozen = util::format_duration(Duration::from_secs(
             start.elapsed().unwrap_or_default().as_secs(),
         ));
         format!("{} ({frozen}){failures}", t!("status_frozen"))
```

**File**: `crates/trippy-tui/src/frontend/render/settings.rs` (modified, +7/-8)
```diff
@@ -3,7 +3,6 @@ use crate::frontend::render::util;
 use crate::frontend::theme;
 use crate::frontend::tui_app::TuiApp;
 use crate::t;
-use humantime::format_duration;
 use ratatui::Frame;
 use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
 use ratatui::style::{Modifier, Style};
@@ -185,7 +184,7 @@ fn format_tui_settings(app: &TuiApp) -> Vec<SettingsItem> {
         ),
         SettingsItem::new(
             "tui-refresh-rate",
-            format!("{}", format_duration(app.tui_config.refresh_rate)),
+            format!("{}", util::format_duration(app.tui_config.refresh_rate)),
         ),
         SettingsItem::new(
             "tui-privacy-max-ttl",
@@ -246,15 +245,15 @@ fn format_trace_settings(app: &TuiApp) -> Vec<SettingsItem> {
         SettingsItem::new("max-ttl", format!("{}", cfg.data.max_ttl().0)),
         SettingsItem::new(
             "min-round-duration",
-            format!("{}", format_duration(cfg.data.min_round_duration())),
+            format!("{}", util::format_duration(cfg.data.min_round_duration())),
         ),
         SettingsItem::new(
             "max-round-duration",
-            format!("{}", format_duration(cfg.data.max_round_duration())),
+            format!("{}", util::format_duration(cfg.data.max_round_duration())),
         ),
         SettingsItem::new(
             "grace-duration",
-            format!("{}", format_duration(cfg.data.grace_duration())),
+            format!("{}", util::format_duration(cfg.data.grace_duration())),
         ),
         SettingsItem::new("max-inflight", format!("{}", cfg.data.max_inflight().0)),
         SettingsItem::new(
@@ -263,7 +262,7 @@ fn format_trace_settings(app: &TuiApp) -> Vec<SettingsItem> {
         ),
         SettingsItem::new(
             "read-timeout",
-            format!("{}", format_duration(cfg.data.read_timeout())),
+            format!("{}", util::format_duration(cfg.data.read_timeout())),
         ),
         SettingsItem::new("packet-size", format!("{}", cfg.data.packet_size().0)),
         SettingsItem::new(
@@ -298,11 +297,11 @@ fn format_dns_settings(app: &TuiApp) -> Vec<SettingsItem> {
     vec![
         SettingsItem::new(
             "dns-timeout",
-            format!("{}", format_duration(app.resolver.config().timeout)),
+            format!("{}", util::format_duration(app.resolver.config().timeout)),
         ),
         SettingsItem::new(
             "dns-ttl",
-            format!("{}", format_duration(app.resolver.config().ttl)),
+            format!("{}", util::format_duration(app.resolver.config().ttl)),
         ),
         SettingsItem::new(
             "dns-resolve-method",
```

---

### Incident Patch 2: `63d99098` (2026-11-19)
**Commit Message**: refactor(tui): replace unmaintained `chrono` with `jiff`

**File**: `Cargo.lock` (modified, +74/-99)
```diff
@@ -30,15 +30,6 @@ version = "0.2.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "683d7910e743518b0e34f1186f92494becacb047c7b6bf616c96772180fef923"
 
-[[package]]
-name = "android_system_properties"
-version = "0.1.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ae221649c9976a6f6c56ae1facf410f3ddb33cc661c4b7b61020a912d4237fbc"
-dependencies = [
- "libc",
-]
-
 [[package]]
 name = "anstream"
 version = "1.0.0"
@@ -299,28 +290,6 @@ dependencies = [
  "rand_core 0.10.1",
 ]
 
-[[package]]
-name = "chrono"
-version = "0.4.45"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1aa79e62e7697b8e29b513a68abacf485adcd1fe8284a4316c5ae868e6633327"
-dependencies = [
- "iana-time-zone",
- "num-traits",
- "serde",
- "windows-link 0.2.1",
-]
-
-[[package]]
-name = "chrono-tz"
-version = "0.10.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a6139a8597ed92cf816dfb33f5dd6cf0bb93a6adc938f11039f371bc5bcd26c3"
-dependencies = [
- "chrono",
- "phf 0.12.1",
-]
-
 [[package]]
 name = "clap"
 version = "4.6.7"
@@ -616,7 +585,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "eb2a7d3066da2de787b7f032c736763eb7ae5d355f81a68bab2675a96008b0bf"
 dependencies = [
  "lab",
- "phf 0.11.3",
+ "phf",
 ]
 
 [[package]]
@@ -1223,30 +1192,6 @@ version = "2.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "15cdd26707701c53297e2fa6afb323d55fbc1d0810c3aec078ae3ef0424c3c15"
 
-[[package]]
-name = "iana-time-zone"
-version = "0.1.65"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e31bc9ad994ba00e440a8aa5c9ef0ec67d5cb5e5cb0cc7f8b744a35b389cc470"
-dependencies = [
- "android_system_properties",
- "core-foundation-sys",
- "iana-time-zone-haiku",
- "js-sys",
- "log",
- "wasm-bindgen",
- "windows-core 0.62.2",
-]
-
-[[package]]
-name = "iana-time-zone-haiku"
-version = "0.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f31827a206f56af32e590ba56d5d2d085f558508192593743f16b2306495269f"
-dependencies = [
- "cc",
-]
-
 [[package]]
 name = "icu_collections"
 version = "2.4.0"
@@ -1460,6 +1405,59 @@ version = "1.0.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3bd1574e617a9a6c1f8f8181bd7e841e1f20e4277607ef28945765188d6284d4"
 
+[[package]]
+name = "jiff"
+version = "1.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ed5d126d72eb017f10b302e73bdeca446bea405ee449af4d9e7866d6b082d83e"
+dependencies = [
+ "jiff-core",
+ "jiff-static",
+ "jiff-tzdb",
+ "jiff-tzdb-platform",
+ "log",
+ "portable-atomic",
+ "portable-atomic-util",
+ "serde_core",
+ "windows-link 0.2.1",
+]
+
+[[package]]
+name = "jiff-core"
+version = "1.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b6b46a105a9874634dd96231021526bf24ca04955a5998c59a9c7666e634b7b8"
+dependencies = [
+ "log",
+]
+
+[[package]]
+name = "jiff-static"
+version = "1.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c0127e9bde3c6130d6169e7d8d68676e4be69c4bf7573c308b6f960a5089c428"
+dependencies = [
+ "jiff-core",
+ "proc-macro2",
+ "quote",
+ "syn 3.0.10",
+]
+
+[[package]]
+name = "jiff-tzdb"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "12e71a1b68a875a44a33bb7a1dd84392cb77145a3367a552a3cfe6a4f5cf3afc"
+
+[[package]]
+name = "jiff-tzdb-platform"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "dc65b284afcfa8f6cf189c7274c805505314a7ab975c60e1f548bff56525420e"
+dependencies = [
+ "jiff-tzdb",
+]
+
 [[package]]
 name = "jni"
 version = "0.22.4"
@@ -2096,16 +2094,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1fd6780a80ae0c52cc120a26a1a42c1ae51b247a253e4e06113d23d2c2edd078"
 dependencies = [
  "phf_macros",
- "phf_shared 0.11.3",
-]
-
-[[package]]
-name = "phf"
-version = "0.12.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "913273894cec178f401a31ec4b656318d95473527be05c0752cc41cdc32be8b7"
-dependencies = [
- "phf_shared 0.12.1",
+ "phf_shared",
 ]
 
 [[package]]
@@ -2115,7 +2104,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "aef8048c789fa5e851558d709946d6d79a8ff88c0440c587967f8e94bfb1216a"
 dependencies = [
  "phf_generator",
- "phf_shared 0.11.3",
+ "phf_shared",
 ]
 
 [[package]]
@@ -2124,7 +2113,7 @@ version = "0.11.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3c80231409c20246a13fddb31776fb942c38553c51e871f8cbd687a4cfb5843d"
 dependencies = [
- "phf_shared 0.11.3",
+ "phf_shared",
  "rand 0.8.8",
 ]
 
@@ -2135,7 +2124,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f84ac04429c13a7ff43785d75ad27569f2951ce0ffd30a3321230db2fc727216"
 dependencies = [
  
```

**File**: `Cargo.toml` (modified, +1/-2)
```diff
@@ -33,8 +33,6 @@ anyhow = "1.0.91"
 arrayvec = { version = "0.7.6", default-features = false }
 bitflags = "2.13.0"
 caps = "0.5.6"
-chrono = { version = "0.4.45", default-features = false }
-chrono-tz = "0.10.4"
 clap = { version = "4.5.60", default-features = false }
 clap-cargo = "0.19.0"
 clap_complete = "4.6.0"
@@ -54,6 +52,7 @@ humantime = "2.3.0"
 indexmap = { version = "2.14.0", default-features = false }
 insta = "1.47.2"
 itertools = "0.15.0"
+jiff = { version = "1.0.1", features = ["tzdb-bundle-always"] }
 maxminddb = "0.33.0"
 mockall = "0.15.0"
 nix = { version = "0.31.3", default-features = false }
```

**File**: `crates/trippy-tui/Cargo.toml` (modified, +1/-2)
```diff
@@ -18,8 +18,6 @@ trippy-core.workspace = true
 trippy-privilege.workspace = true
 trippy-dns.workspace = true
 anyhow.workspace = true
-chrono = { workspace = true, default-features = false, features = ["clock", "serde"] }
-chrono-tz.workspace = true
 clap = { workspace = true, default-features = false, features = ["cargo", "derive", "wrap_help", "usage", "unstable-styles", "color", "suggestions", "error-context", "env"] }
 clap_complete.workspace = true
 clap_mangen.workspace = true
@@ -30,6 +28,7 @@ encoding_rs_io.workspace = true
 etcetera.workspace = true
 humantime.workspace = true
 itertools.workspace = true
+jiff = { workspace = true, features = ["serde"] }
 maxminddb.workspace = true
 petgraph.workspace = true
 ratatui.workspace = true
```

**File**: `crates/trippy-tui/src/app.rs` (modified, +1/-1)
```diff
@@ -221,7 +221,7 @@ fn make_tui_config(args: &TrippyConfig, locale: String) -> TuiConfig {
         args.geoip_mmdb_file.clone(),
         args.dns_resolve_all,
         locale,
-        args.tui_timezone,
+        args.tui_timezone.clone(),
     )
 }
 
```

**File**: `crates/trippy-tui/src/config.rs` (modified, +6/-6)
```diff
@@ -3,10 +3,10 @@ use clap::ValueEnum;
 use clap_complete::Shell;
 use file::ConfigFile;
 use itertools::Itertools;
+use jiff::tz::TimeZone;
 use serde::Deserialize;
 use std::collections::HashMap;
 use std::net::IpAddr;
-use std::str::FromStr;
 use std::time::Duration;
 use trippy_core::{
     IcmpExtensionParseMode, MAX_TTL, MultipathStrategy, PortDirection, PrivilegeMode, Protocol,
@@ -323,7 +323,7 @@ pub struct TrippyConfig {
     pub tui_geoip_mode: GeoIpMode,
     pub tui_max_addrs: Option<u8>,
     pub tui_locale: Option<String>,
-    pub tui_timezone: Option<chrono_tz::Tz>,
+    pub tui_timezone: Option<TimeZone>,
     pub tui_theme: TuiTheme,
     pub tui_bindings: TuiBindings,
     pub mode: Mode,
@@ -549,7 +549,7 @@ impl TrippyConfig {
         let timezone = cfg_layer_opt(args.tui_timezone, cfg_file_tui.tui_timezone);
         let tui_timezone = timezone
             .as_deref()
-            .map(chrono_tz::Tz::from_str)
+            .map(|name| TimeZone::get(name).map_err(|_| anyhow!("failed to parse timezone")))
             .transpose()?;
         let dns_lookup_as_info = cfg_layer_bool_flag(
             args.dns_lookup_as_info,
@@ -1503,8 +1503,8 @@ mod tests {
     }
 
     #[test_case("trip example.com", Ok(cfg().tui_timezone(None).build()); "default tui timezone")]
-    #[test_case("trip example.com --tui-timezone UTC", Ok(cfg().tui_timezone(Some(chrono_tz::Tz::UTC)).build()); "custom tui timezone UTC")]
-    #[test_case("trip example.com --tui-timezone Antarctica/South_Pole", Ok(cfg().tui_timezone(Some(chrono_tz::Tz::Antarctica__South_Pole)).build()); "custom tui timezone Antarctica/South_Pole")]
+    #[test_case("trip example.com --tui-timezone UTC", Ok(cfg().tui_timezone(Some(TimeZone::UTC)).build()); "custom tui timezone UTC")]
+    #[test_case("trip example.com --tui-timezone Antarctica/South_Pole", Ok(cfg().tui_timezone(Some(TimeZone::get("Antarctica/South_Pole").unwrap())).build()); "custom tui timezone Antarctica/South_Pole")]
     #[test_case("trip example.com --tui-timezone xxx", Err(anyhow!("failed to parse timezone")); "invalid tui timezone")]
     fn test_tui_timezone(cmd: &str, expected: anyhow::Result<TrippyConfig>) {
         compare(parse_config(cmd), expected);
@@ -2097,7 +2097,7 @@ mod tests {
             }
         }
 
-        pub fn tui_timezone(self, tui_timezone: Option<chrono_tz::Tz>) -> Self {
+        pub fn tui_timezone(self, tui_timezone: Option<TimeZone>) -> Self {
             Self {
                 config: TrippyConfig {
                     tui_timezone,
```

**File**: `crates/trippy-tui/src/frontend/config.rs` (modified, +3/-3)
```diff
@@ -3,7 +3,7 @@ use crate::config::{IcmpExtensionMode, TuiBindings};
 use crate::frontend::binding::Bindings;
 use crate::frontend::columns::Columns;
 use crate::frontend::theme::Theme;
-use chrono_tz::Tz;
+use jiff::tz::TimeZone;
 use std::time::Duration;
 
 /// Tui configuration.
@@ -37,7 +37,7 @@ pub struct TuiConfig {
     pub dns_resolve_all: bool,
     /// The current locale.
     pub locale: String,
-    pub timezone: Option<Tz>,
+    pub timezone: Option<TimeZone>,
 }
 
 impl TuiConfig {
@@ -58,7 +58,7 @@ impl TuiConfig {
         geoip_mmdb_file: Option<String>,
         dns_resolve_all: bool,
         locale: String,
-        timezone: Option<Tz>,
+        timezone: Option<TimeZone>,
     ) -> Self {
         Self {
             refresh_rate,
```

**File**: `crates/trippy-tui/src/frontend/render/header.rs` (modified, +13/-9)
```diff
@@ -1,7 +1,9 @@
 use crate::frontend::tui_app::TuiApp;
 use crate::t;
-use chrono::SecondsFormat;
 use humantime::format_duration;
+use jiff::Timestamp;
+use jiff::fmt::temporal::DateTimePrinter;
+use jiff::tz::TimeZone;
 use ratatui::Frame;
 use ratatui::layout::{Alignment, Rect};
 use ratatui::style::{Modifier, Style};
@@ -27,14 +29,16 @@ pub fn render(f: &mut Frame<'_>, app: &TuiApp, rect: Rect) {
                 .bg(app.tui_config.theme.bg)
                 .fg(app.tui_config.theme.text),
         );
-    let now = if let Some(tz) = &app.tui_config.timezone {
-        chrono::Utc::now()
-            .with_timezone(tz)
-            .to_rfc3339_opts(SecondsFormat::Secs, true)
-    } else {
-        chrono::Local::now().to_rfc3339_opts(SecondsFormat::Secs, true)
-    };
-    let clock_span = Line::from(Span::raw(now));
+    let timezone = app
+        .tui_config
+        .timezone
+        .clone()
+        .unwrap_or_else(TimeZone::system);
+    let now = Timestamp::now().to_zoned_datetime(timezone);
+    let clock = DateTimePrinter::new()
+        .precision(Some(0))
+        .timestamp_with_offset_to_string(&now.timestamp(), now.offset());
+    let clock_span = Line::from(Span::raw(clock));
     let bold = Style::default().add_modifier(Modifier::BOLD);
 
     let help_binding = app.tui_config.bindings.toggle_help.to_string();
```

**File**: `crates/trippy-tui/src/frontend/render/settings.rs` (modified, +3/-1)
```diff
@@ -220,7 +220,9 @@ fn format_tui_settings(app: &TuiApp) -> Vec<SettingsItem> {
             "tui-timezone",
             app.tui_config
                 .timezone
-                .map_or_else(|| t!("auto").to_string(), |tz| tz.to_string()),
+                .as_ref()
+                .and_then(jiff::tz::TimeZone::iana_name)
+                .map_or_else(|| t!("auto").to_string(), str::to_string),
         ),
     ]
 }
```

#### Recent Merged Pull Requests:
- **PR #1930** (2026-11-19): refactor(tui): replace unmaintained `chrono` and `humantime` with `jiff` (@fujiapple852)
- **PR #1925** (2026-11-15): Ci pin GitHub actions (@fujiapple852)
- **PR #1923** (2026-11-15): ci: run simulation tests on FreeBSD, NetBSD and OpenBSD (@fujiapple852)
- **PR #1920** (2026-11-15): refactor(core): remove unsafe `recv_from_info_buf` (@fujiapple852)
- **PR #1919** (2026-11-14): Chore upgrade deps (@fujiapple852)
- **PR #1918** (2026-11-14): chore: bump MSRV to 1.92 (#1917) (@fujiapple852)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
