# Forensic Learning Record (Deep Inspection): imsnif/bandwhich

> **Canonical Artifact**: `07_PROJECT_LEARNING/imsnif-bandwhich-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/imsnif/bandwhich](https://github.com/imsnif/bandwhich))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:42:08.011Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `imsnif/bandwhich`
- **Description**: Terminal bandwidth utilization tool
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11995 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/display/ui_state.rs`
```
use std::{
    cmp,
    collections::{HashMap, HashSet, VecDeque},
    hash::Hash,
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
};

use log::warn;

use crate::{
    display::BandwidthUnitFamily,
    network::{Connection, LocalSocket, Utilization},
    os::ProcessInfo,
};

static RECALL_LENGTH: usize = 5;
static MAX_BANDWIDTH_ITEMS: usize = 1000;

pub trait Bandwidth {
    fn get_total_bytes_downloaded(&self) -> u128;
    fn get_total_bytes_uploaded(&self) -> u128;
    fn combine_bandwidth(&mut self, other: &Self);
    fn divide_by(&mut self, amount: u128);
}

#[derive(Clone, Default)]
pub struct NetworkData {
    pub total_bytes_downloaded: u128,
    pub total_bytes_uploaded: u128,
    pub connection_count: u128,
}

#[derive(Clone, Default)]
pub struct ConnectionData {
    pub total_bytes_downloaded: u128,
    pub total_bytes_uploaded: u128,
    pub process_name: String,
    pub interface_name: String,
}

impl Bandwidth for NetworkData {
    fn get_total_bytes_downloaded(&self) -> u128 {
        self.total_bytes_downloaded
    }
    fn get_total_bytes_uploaded(&self) -> u128 {
        self.total_bytes_uploaded
    }
    fn combine_bandwidth(&mut self, other: &NetworkData) {
        self.total_bytes_downloaded += other.get_total_bytes_downloaded();
        self.total_bytes_uploaded += other.get_total_bytes_uploaded();
        self.connection_count = other.connection_count;
    }
    fn divide_by(&mut self, amount: u128) {
        self.total_bytes_downloaded /= amount;
        self.total_bytes_uploaded /= amount;
    }
}

impl Bandwidth for ConnectionData {
    fn get_total_bytes_downloaded(&self) -> u128 {
        self.total_bytes_downloaded
    }
    fn get_total_bytes_uploaded(&self) -> u128 {
        self.total_bytes_uploaded
    }
    fn combine_bandwidth(&mut self, other: &ConnectionData) {
        self.total_bytes_downloaded += other.get_total_bytes_downloaded();
        self.total_bytes_uploaded += other.get_total_bytes_uploaded();
    }
    fn divide_by(&mut self, amount: u128) {
        self.total_bytes_downloaded /= amount;
        self.total_bytes_uploaded /= amount;
    }
}

pub struct UtilizationData {
    connections_to_procs: HashMap<LocalSocket, ProcessInfo>,
    network_utilization: Utilization,
}

#[derive(Default)]
pub struct UIState {
    /// The interface name in single-interface mode. `None` means all interfaces.
    pub interface_name: Option<String>,
    pub processes: Vec<(ProcessInfo, NetworkData)>,
    pub remote_addresses: Vec<(IpAddr, NetworkData)>,
    pub connections: Vec<(Connection, ConnectionData)>,
    pub total_bytes_downloaded: u128,
    pub total_bytes_uploaded: u128,
    pub cumulative_mode: bool,
    pub show_dns: bool,
    pub unit_family: BandwidthUnitFamily,
    pub utilization_data: VecDeque<UtilizationData>,
    pub processes_map: HashMap<ProcessInfo, NetworkData>,
    pub remote_addresses_map: HashMap<IpAddr, NetworkData>,
    pub connections_map: HashMap<Connection, ConnectionData>,
    /// Used for reducing logging noise.
    known_orphan_sockets: VecDeque<LocalSocket>,
}

impl UIState {
    pub fn update(
        &mut self,
        connections_to_procs: HashMap<LocalSocket, ProcessInfo>,
        network_utilization: Utilization,
    ) {
        self.utilization_data.push_back(UtilizationData {
            connections_to_procs,
            network_utilization,
        });
        if self.utilization_data.len() > RECALL_LENGTH {
            self.utilization_data.pop_front();
        }
        let mut processes: HashMap<ProcessInfo, NetworkData> = HashMap::new();
        let mut remote_addresses: HashMap<IpAddr, NetworkData> = HashMap::new();
        let mut connections: HashMap<Connection, ConnectionData> = HashMap::new();
        let mut total_bytes_downloaded: u128 = 0;
        let mut total_bytes_uploaded: u128 = 0;

        let mut seen_connections = HashSet::new();
        for state in self.utilization_data.iter().rev() {
            let connections_to_procs = &state.connections_to_procs;
            let network_utilization = &state.network_utilization;

            for (connection, connection_info) in &network_utilization.connections {
                let connection_previously_seen = !seen_connections.insert(connection);
                let connection_data = connections.entry(*connection).or_default();
                let data_for_remote_address = remote_addresses
                    .entry(connection.remote_socket.ip)
                    .or_default();
                connection_data.total_bytes_downloaded += connection_info.total_bytes_downloaded;
                connection_data.total_bytes_uploaded += connection_info.total_bytes_uploaded;
                connection_data
                    .interface_name
                    .clone_from(&connection_info.interface_name);
                data_for_remote_address.total_bytes_downloaded +=
                    connection_info.total_bytes_downloaded;
                data_for_remote_address.total_bytes_uploaded +=
                    connection_info.total_bytes_uploaded;
                if !connection_previously_seen {
                    data_for_remote_address.connection_count += 1;
                }
                total_bytes_downloaded += connection_info.total_bytes_downloaded;
                total_bytes_uploaded += connection_info.total_bytes_uploaded;

                let data_for_process = {
                    let local_socket = connection.local_socket;
                    let proc_info = get_proc_info(connections_to_procs, &local_socket);

                    // only log each orphan connection once
                    if proc_info.is_none() && !self.known_orphan_sockets.contains(&local_socket) {
                        // newer connections go in the front so that searches are faster
                        // basically recency bias
                        self.known_orphan_sockets.push_front(local_socket);
                        self.known_orphan_sockets.truncate(10_000); // arbitrary maximum backlog

                        match connections_to_procs
                            .iter()
                            .find(|(&LocalSocket { port, protocol, .. }, _)| {
                                port == local_socket.port && protocol == local_socket.protocol
                            })
                            .and_then(|(local_conn_lookalike, info)| {
                                network_utilization
                                    .connections
                                    .keys()
                                    .find(|conn| &conn.local_socket == local_conn_lookalike)
                                    .map(|conn| (conn, info))
                            }) {
                            Some((lookalike, proc_info)) => {
                                warn!(
                                    r#""{0}" owns a similar looking connection, but its local ip doesn't match."#,
                                    proc_info.name
                                );
                                warn!("Looking for: {connection:?}; found: {lookalike:?}");
                            }
                            None => {
                                warn!("Cannot determine which process owns {connection:?}");
                            }
                        };
                    }

                    let proc_info = proc_info
                        .cloned()
                        .unwrap_or_else(|| ProcessInfo::new("<UNKNOWN>", 0));
                    connection_data.process_name.clone_from(&proc_info.name);
                    processes.entry(proc_info).or_default()
                };

                data_for_process.total_bytes_downloaded += connection_info.total_bytes_downloaded;
                data_for_process.total_bytes_uploaded += connection_info.total_bytes_uploaded;
                if !connection_previously_seen {
                    data_for_process.connection_count += 1;
                }
            }
        }
        let divide_by = if self.utilization_data.is_empty() {
            1_u128
        } else {
            self.utilization_data.len() as u128
        };
        for network_data in processes.values_mut() {
            network_data.divide_by(divide_by)
        }
        for network_data in remote_addresses.values_mut() {
            network_data.divide_by(divide_by)
        }
        for connection_data in connections.values_mut() {
            connection_data.divide_by(divide_by)
        }

        if self.cumulative_mode {
            merge_bandwidth(&mut self.processes_map, processes);
            merge_bandwidth(&mut self.remote_addresses_map, remote_addresses);
            merge_bandwidth(&mut self.connections_map, connections);
            self.total_bytes_downloaded += total_bytes_downloaded / divide_by;
            self.total_bytes_uploaded += total_bytes_uploaded / divide_by;
        } else {
            self.processes_map = processes;
            self.remote_addresses_map = remote_addresses;
            self.connections_map = connections;
            self.total_bytes_downloaded = total_bytes_downloaded / divide_by;
            self.total_bytes_uploaded = total_bytes_uploaded / divide_by;
        }
        self.processes = sort_and_prune(&mut self.processes_map);
        self.remote_addresses = sort_and_prune(&mut self.remote_addresses_map);
        self.connections = sort_and_prune(&mut self.connections_map);
    }
}

fn get_proc_info<'a>(
    connections_to_procs: &'a HashMap<LocalSocket, ProcessInfo>,
    local_socket: &LocalSocket,
) -> Option<&'a ProcessInfo> {
    connections_to_procs
        // direct match
        .get(local_socket)
        // IPv4-mapped IPv6 addresses
        .or_else(|| {
            let swapped: IpAddr = match local_socket.ip {
                IpAddr::V4(v4) => v4.to_ipv6_mapped().into(),
                IpAddr::V6(v6) => v6.to_ipv4_mapped()?.into(),
            };
            connections_to_procs.get(&LocalSocket {

```

### Core Architecture Module: `src/network/utilization.rs`
```
use std::collections::HashMap;

use crate::network::{Connection, Direction, Segment};

#[derive(Clone)]
pub struct ConnectionInfo {
    pub interface_name: String,
    pub total_bytes_downloaded: u128,
    pub total_bytes_uploaded: u128,
}

#[derive(Clone)]
pub struct Utilization {
    pub connections: HashMap<Connection, ConnectionInfo>,
}

impl Utilization {
    pub fn new() -> Self {
        let connections = HashMap::new();
        Utilization { connections }
    }
    pub fn clone_and_reset(&mut self) -> Self {
        let clone = self.clone();
        self.connections.clear();
        clone
    }
    pub fn ingest(&mut self, seg: Segment) {
        let total_bandwidth = self
            .connections
            .entry(seg.connection)
            .or_insert(ConnectionInfo {
                interface_name: seg.interface_name,
                total_bytes_downloaded: 0,
                total_bytes_uploaded: 0,
            });
        match seg.direction {
            Direction::Download => {
                total_bandwidth.total_bytes_downloaded += seg.data_length;
            }
            Direction::Upload => {
                total_bandwidth.total_bytes_uploaded += seg.data_length;
            }
        }
    }
}

```

### Core Architecture Module: `src/os/lsof_utils.rs`
```
use std::{ffi::OsStr, net::IpAddr, process::Command};

use log::warn;
use once_cell::sync::Lazy;
use regex::Regex;

use crate::{
    network::{LocalSocket, Protocol},
    os::ProcessInfo,
};

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct RawConnection {
    remote_ip: String,
    local_ip: String,
    local_port: String,
    remote_port: String,
    protocol: String,
    pub proc_info: ProcessInfo,
}

fn get_null_addr(ip_type: &str) -> &str {
    if ip_type.contains('4') {
        "0.0.0.0"
    } else {
        "::0"
    }
}

impl RawConnection {
    pub fn new(raw_line: &str) -> Option<RawConnection> {
        // Example row
        // com.apple   664     user  198u  IPv4 0xeb179a6650592b8d      0t0    TCP 192.168.1.187:58535->1.2.3.4:443 (ESTABLISHED)
        let columns: Vec<&str> = raw_line.split_ascii_whitespace().collect();
        if columns.len() < 9 {
            return None;
        }
        let process_name = columns[0].replace("\\x20", " ");
        let pid = columns[1].parse().ok()?;
        let proc_info = ProcessInfo::new(&process_name, pid);
        // Unneeded
        // let username = columns[2];
        // let fd = columns[3];

        // IPv4 or IPv6
        let ip_type = columns[4];
        // let device = columns[5];
        // let size = columns[6];
        // UDP/TCP
        let protocol = columns[7].to_ascii_uppercase();
        if protocol != "TCP" && protocol != "UDP" {
            return None;
        }
        let connection_str = columns[8];
        // "(LISTEN)" or "(ESTABLISHED)",  this column may or may not be present
        // let connection_state = columns[9];

        static CONNECTION_REGEX: Lazy<Regex> =
            Lazy::new(|| Regex::new(r"\[?([^\s\]]*)\]?:(\d+)->\[?([^\s\]]*)\]?:(\d+)").unwrap());
        static LISTEN_REGEX: Lazy<Regex> =
            Lazy::new(|| Regex::new(r"\[?([^\s\[\]]*)\]?:(.*)").unwrap());
        // If this socket is in a "connected" state
        if let Some(caps) = CONNECTION_REGEX.captures(connection_str) {
            // Example
            // 192.168.1.187:64230->0.1.2.3:5228
            // *:*
            // *:4567
            let local_ip = String::from(caps.get(1).unwrap().as_str());
            let local_port = String::from(caps.get(2).unwrap().as_str());
            let remote_ip = String::from(caps.get(3).unwrap().as_str());
            let remote_port = String::from(caps.get(4).unwrap().as_str());
            let connection = RawConnection {
                local_ip,
                local_port,
                remote_ip,
                remote_port,
                protocol,
                proc_info,
            };
            Some(connection)
        } else if let Some(caps) = LISTEN_REGEX.captures(connection_str) {
            let local_ip = if caps.get(1).unwrap().as_str() == "*" {
                get_null_addr(ip_type)
            } else {
                caps.get(1).unwrap().as_str()
            };
            let local_ip = String::from(local_ip);
            let local_port = String::from(if caps.get(2).unwrap().as_str() == "*" {
                "0"
            } else {
                caps.get(2).unwrap().as_str()
            });
            let remote_ip = String::from(get_null_addr(ip_type));
            let remote_port = String::from("0");
            let connection = RawConnection {
                local_ip,
                local_port,
                remote_ip,
                remote_port,
                protocol,
                proc_info,
            };
            Some(connection)
        } else {
            None
        }
    }

    pub fn get_protocol(&self) -> Option<Protocol> {
        Protocol::from_str(&self.protocol)
    }

    pub fn get_local_ip(&self) -> Option<IpAddr> {
        self.local_ip.parse().ok()
    }

    pub fn get_local_port(&self) -> Option<u16> {
        self.local_port.parse::<u16>().ok()
    }

    pub fn as_local_socket(&self) -> Option<LocalSocket> {
        let process = &self.proc_info.name;

        let Some(ip) = self.get_local_ip() else {
            warn!(r#"Failed to get the local IP of a connection belonging to "{process}"."#);
            return None;
        };
        let Some(port) = self.get_local_port() else {
            warn!(r#"Failed to get the local port of a connection belonging to "{process}"."#);
            return None;
        };
        let Some(protocol) = self.get_protocol() else {
            warn!(r#"Failed to get the protocol of a connection belonging to "{process}"."#);
            return None;
        };

        Some(LocalSocket { ip, port, protocol })
    }
}

pub fn get_connections() -> RawConnections {
    let content = run(["-n", "-P", "-i4", "-i6", "+c", "0"]);
    RawConnections::new(content)
}

fn run<I, S>(args: I) -> String
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("lsof")
        .args(args)
        .output()
        .expect("failed to execute process");

    String::from_utf8_lossy(&output.stdout).into_owned()
}

pub struct RawConnections {
    content: Vec<RawConnection>,
}

impl RawConnections {
    pub fn new(content: String) -> RawConnections {
        let lines: Vec<RawConnection> = content.lines().flat_map(RawConnection::new).collect();

        RawConnections { content: lines }
    }
}

impl Iterator for RawConnections {
    type Item = RawConnection;

    fn next(&mut self) -> Option<Self::Item> {
        self.content.pop()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const IPV6_LINE_RAW_OUTPUT: &str = "ProcessName     29266 user    9u  IPv6 0x5d53dfe5445cee01      0t0  UDP [fe80:4::aede:48ff:fe00:1122]:1111->[fe80:4::aede:48ff:fe33:4455]:2222";
    const LINE_RAW_OUTPUT: &str = "ProcessName 29266 user   39u  IPv4 0x28ffb9c0021196bf      0t0  UDP 192.168.0.1:1111->198.252.206.25:2222";
    const FULL_RAW_OUTPUT: &str = r#"
com.apple   590 etoledom  193u  IPv4 0x28ffb9c041115627      0t0  TCP 192.168.1.37:60298->31.13.83.36:443 (ESTABLISHED)
com.apple   590 etoledom  198u  IPv4 0x28ffb9c04110ea8f      0t0  TCP 192.168.1.37:60299->31.13.83.8:443 (ESTABLISHED)
com.apple   590 etoledom  203u  IPv4 0x28ffb9c04110ea8f      0t0  TCP 192.168.1.37:60299->31.13.83.8:443 (ESTABLISHED)
com.apple   590 etoledom  204u  IPv4 0x28ffb9c04111253f      0t0  TCP 192.168.1.37:60374->140.82.114.26:443
"#;

    #[test]
    fn test_iterator_multiline() {
        let iterator = RawConnections::new(String::from(FULL_RAW_OUTPUT));
        let connections: Vec<RawConnection> = iterator.collect();
        assert_eq!(connections.len(), 4);
    }

    #[test]
    fn test_raw_connection_is_created_from_raw_output_ipv4() {
        test_raw_connection_is_created_from_raw_output(LINE_RAW_OUTPUT);
    }
    #[test]
    fn test_raw_connection_is_created_from_raw_output_ipv6() {
        test_raw_connection_is_created_from_raw_output(IPV6_LINE_RAW_OUTPUT);
    }
    fn test_raw_connection_is_created_from_raw_output(raw_output: &str) {
        let connection = RawConnection::new(raw_output);
        assert!(connection.is_some());
    }

    #[test]
    fn test_raw_connection_is_not_created_from_wrong_raw_output() {
        let connection = RawConnection::new("not a process");
        assert!(connection.is_none());
    }

    #[test]
    fn test_raw_connection_parse_local_port_ipv4() {
        test_raw_connection_parse_local_port(LINE_RAW_OUTPUT);
    }
    #[test]
    fn test_raw_connection_parse_local_port_ipv6() {
        test_raw_connection_parse_local_port(IPV6_LINE_RAW_OUTPUT);
    }
    fn test_raw_connection_parse_local_port(raw_output: &str) {
        let connection = RawConnection::new(raw_output).unwrap();
        assert_eq!(connection.get_local_port(), Some(1111));
    }

    #[test]
    fn test_raw_connection_parse_protocol_ipv4() {
        test_raw_connection_parse_protocol(LINE_RAW_OUTPUT);
    }
    #[test]
    fn test_raw_connection_parse_protocol_ipv6() {
        test_raw_connection_parse_protocol(IPV6_LINE_RAW_OUTPUT);
    }
    fn test_raw_connection_parse_protocol(raw_line: &str) {
        let connection = RawConnection::new(raw_line).unwrap();
        assert_eq!(connection.get_protocol(), Some(Protocol::Udp));
    }

    #[test]
    fn test_raw_connection_parse_process_name_ipv4() {
        test_raw_connection_parse_process_name(LINE_RAW_OUTPUT);
    }
    #[test]
    fn test_raw_connection_parse_process_name_ipv6() {
        test_raw_connection_parse_process_name(IPV6_LINE_RAW_OUTPUT);
    }
    fn test_raw_connection_parse_process_name(raw_line: &str) {
        let connection = RawConnection::new(raw_line).unwrap();
        assert_eq!(connection.proc_info.name, String::from("ProcessName"));
    }
}

```

### Core Architecture Module: `src/cli.rs`
```
use std::{net::Ipv4Addr, path::PathBuf};

use clap::{Args, Parser, ValueEnum, ValueHint};
use clap_verbosity_flag::{InfoLevel, Verbosity};
use derive_more::Debug;
use strum::EnumIter;

#[derive(Clone, Debug, Parser, Default)]
#[command(name = "bandwhich", version)]
pub struct Opt {
    #[arg(short, long)]
    /// The network interface to listen on, eg. eth0
    pub interface: Option<String>,

    #[arg(short, long)]
    /// Machine friendlier output
    pub raw: bool,

    #[arg(short, long)]
    /// Do not attempt to resolve IPs to their hostnames
    pub no_resolve: bool,

    #[arg(short, long)]
    /// Show DNS queries
    pub show_dns: bool,

    #[arg(short, long)]
    /// A dns server ip to use instead of the system default
    pub dns_server: Option<Ipv4Addr>,

    #[arg(long, value_hint = ValueHint::FilePath)]
    /// Enable debug logging to a file
    pub log_to: Option<PathBuf>,

    #[command(flatten)]
    pub verbosity: Verbosity<InfoLevel>,

    #[command(flatten)]
    pub render_opts: RenderOpts,
}

#[derive(Copy, Clone, Debug, Default, Args)]
pub struct RenderOpts {
    #[arg(short, long)]
    /// Show processes table only
    pub processes: bool,

    #[arg(short, long)]
    /// Show connections table only
    pub connections: bool,

    #[arg(short, long)]
    /// Show remote addresses table only
    pub addresses: bool,

    #[arg(short, long, value_enum, default_value_t)]
    /// Choose a specific family of units
    pub unit_family: UnitFamily,

    #[arg(short, long)]
    /// Show total (cumulative) usages
    pub total_utilization: bool,
}

// IMPRV: it would be nice if we can `#[cfg_attr(not(build), derive(strum::EnumIter))]` this
// unfortunately there is no configuration option for build script detection
#[derive(Copy, Clone, Debug, Default, Eq, PartialEq, ValueEnum, EnumIter)]
pub enum UnitFamily {
    #[default]
    /// bytes, in powers of 2^10
    BinBytes,
    /// bits, in powers of 2^10
    BinBits,
    /// bytes, in powers of 10^3
    SiBytes,
    /// bits, in powers of 10^3
    SiBits,
}

```

### Core Architecture Module: `src/display/components/display_bandwidth.rs`
```
use std::fmt;

use derive_more::Debug;

use crate::cli::UnitFamily;

#[derive(Copy, Clone, Debug)]
pub struct DisplayBandwidth {
    // Custom format for reduced precision.
    // Workaround for FP calculation discrepancy between Unix and Windows.
    // See https://github.com/rust-lang/rust/issues/111405#issuecomment-2055964223.
    #[debug("{bandwidth:.10e}")]
    pub bandwidth: f64,
    pub unit_family: BandwidthUnitFamily,
}

impl fmt::Display for DisplayBandwidth {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (div, suffix) = self.unit_family.get_unit_for(self.bandwidth);
        write!(f, "{:.2}{suffix}", self.bandwidth / div)
    }
}

/// Type wrapper around [`UnitFamily`] to provide extra functionality.
#[derive(Copy, Clone, Debug, Default, Eq, PartialEq)]
#[debug("{_0:?}")]
pub struct BandwidthUnitFamily(UnitFamily);
impl From<UnitFamily> for BandwidthUnitFamily {
    fn from(value: UnitFamily) -> Self {
        Self(value)
    }
}
impl BandwidthUnitFamily {
    #[inline]
    /// Returns an array of tuples, corresponding to the steps of this unit family.
    ///
    /// Each step contains a divisor, an upper bound, and a unit suffix.
    fn steps(&self) -> [(f64, f64, &'static str); 6] {
        /// The fraction of the next unit the value has to meet to step up.
        const STEP_UP_FRAC: f64 = 0.95;
        /// Binary base: 2^10.
        const BB: f64 = 1024.0;

        use UnitFamily as F;
        // probably could macro this stuff, but I'm too lazy
        match self.0 {
            F::BinBytes => [
                (1.0, BB * STEP_UP_FRAC, "B"),
                (BB, BB.powi(2) * STEP_UP_FRAC, "KiB"),
                (BB.powi(2), BB.powi(3) * STEP_UP_FRAC, "MiB"),
                (BB.powi(3), BB.powi(4) * STEP_UP_FRAC, "GiB"),
                (BB.powi(4), BB.powi(5) * STEP_UP_FRAC, "TiB"),
                (BB.powi(5), f64::MAX, "PiB"),
            ],
            F::BinBits => [
                (1.0 / 8.0, BB / 8.0 * STEP_UP_FRAC, "b"),
                (BB / 8.0, BB.powi(2) / 8.0 * STEP_UP_FRAC, "Kib"),
                (BB.powi(2) / 8.0, BB.powi(3) / 8.0 * STEP_UP_FRAC, "Mib"),
                (BB.powi(3) / 8.0, BB.powi(4) / 8.0 * STEP_UP_FRAC, "Gib"),
                (BB.powi(4) / 8.0, BB.powi(5) / 8.0 * STEP_UP_FRAC, "Tib"),
                (BB.powi(5) / 8.0, f64::MAX, "Pib"),
            ],
            F::SiBytes => [
                (1.0, 1e3 * STEP_UP_FRAC, "B"),
                (1e3, 1e6 * STEP_UP_FRAC, "kB"),
                (1e6, 1e9 * STEP_UP_FRAC, "MB"),
                (1e9, 1e12 * STEP_UP_FRAC, "GB"),
                (1e12, 1e15 * STEP_UP_FRAC, "TB"),
                (1e15, f64::MAX, "PB"),
            ],
            F::SiBits => [
                (1.0 / 8.0, 1e3 / 8.0 * STEP_UP_FRAC, "b"),
                (1e3 / 8.0, 1e6 / 8.0 * STEP_UP_FRAC, "kb"),
                (1e6 / 8.0, 1e9 / 8.0 * STEP_UP_FRAC, "Mb"),
                (1e9 / 8.0, 1e12 / 8.0 * STEP_UP_FRAC, "Gb"),
                (1e12 / 8.0, 1e15 / 8.0 * STEP_UP_FRAC, "Tb"),
                (1e15 / 8.0, f64::MAX, "Pb"),
            ],
        }
    }

    /// Select a unit for a given value, returning its divisor and suffix.
    fn get_unit_for(&self, bytes: f64) -> (f64, &'static str) {
        let Some((div, _, suffix)) = self
            .steps()
            .into_iter()
            .find(|&(_, bound, _)| bound >= bytes)
        else {
            panic!("Cannot select an appropriate unit for {bytes:.2}B.")
        };

        (div, suffix)
    }
}

#[cfg(test)]
mod tests {
    use std::fmt::Write;

    use insta::assert_snapshot;
    use itertools::Itertools;
    use strum::IntoEnumIterator;

    use crate::{cli::UnitFamily, display::DisplayBandwidth};

    #[test]
    fn bandwidth_formatting() {
        let test_bandwidths_formatted = UnitFamily::iter()
            .map_into()
            .cartesian_product(
                // I feel like this is a decent selection of values
                (-6..60)
                    .map(|exp| 2f64.powi(exp))
                    .chain((-5..45).map(|exp| 2.5f64.powi(exp)))
                    .chain((-4..38).map(|exp| 3f64.powi(exp)))
                    .chain((-3..26).map(|exp| 5f64.powi(exp))),
            )
            .map(|(unit_family, bandwidth)| DisplayBandwidth {
                bandwidth,
                unit_family,
            })
            .fold(String::new(), |mut buf, b| {
                let _ = writeln!(buf, "{b:?}: {b}");
                buf
            });

        assert_snapshot!(test_bandwidths_formatted);
    }
}

```

### Core Architecture Module: `src/display/components/header_details.rs`
```
use std::time::{Duration, Instant};

use ratatui::{
    layout::{Alignment, Rect},
    style::{Color, Modifier, Style},
    text::Span,
    widgets::Paragraph,
    Frame,
};
use unicode_width::UnicodeWidthStr;

use crate::display::{DisplayBandwidth, UIState};

pub fn elapsed_time(last_start_time: Instant, cumulative_time: Duration, paused: bool) -> Duration {
    if paused {
        cumulative_time
    } else {
        cumulative_time + last_start_time.elapsed()
    }
}

fn format_duration(d: Duration) -> String {
    let s = d.as_secs();
    let days = match s / 86400 {
        0 => "".to_string(),
        1 => "1 day, ".to_string(),
        n => format!("{n} days, "),
    };
    format!(
        "{days}{:02}:{:02}:{:02}",
        (s / 3600) % 24,
        (s / 60) % 60,
        s % 60,
    )
}

pub struct HeaderDetails<'a> {
    pub state: &'a UIState,
    pub elapsed_time: Duration,
    pub paused: bool,
}

impl HeaderDetails<'_> {
    pub fn render(&self, frame: &mut Frame, rect: Rect) {
        let bandwidth = self.bandwidth_string();
        let color = if self.paused {
            Color::Yellow
        } else {
            Color::Green
        };

        // do not render time in tests, otherwise the output becomes non-deterministic
        // see: https://github.com/imsnif/bandwhich/issues/303
        if cfg!(not(test)) && self.state.cumulative_mode {
            let elapsed_time = format_duration(self.elapsed_time);
            // only render if there is enough width
            if bandwidth.width() + 1 + elapsed_time.width() <= rect.width as usize {
                self.render_elapsed_time(frame, rect, &elapsed_time, color);
            }
        }

        self.render_bandwidth(frame, rect, &bandwidth, color);
    }

    fn render_bandwidth(&self, frame: &mut Frame, rect: Rect, bandwidth: &str, color: Color) {
        let bandwidth_text = Span::styled(
            bandwidth,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        );

        let paragraph = Paragraph::new(bandwidth_text).alignment(Alignment::Left);
        frame.render_widget(paragraph, rect);
    }

    fn bandwidth_string(&self) -> String {
        let intrf = self.state.interface_name.as_deref().unwrap_or("all");
        let t = if self.state.cumulative_mode {
            "Data"
        } else {
            "Rate"
        };
        let unit_family = self.state.unit_family;
        let up = DisplayBandwidth {
            bandwidth: self.state.total_bytes_uploaded as f64,
            unit_family,
        };
        let down = DisplayBandwidth {
            bandwidth: self.state.total_bytes_downloaded as f64,
            unit_family,
        };
        let paused = if self.paused { " [PAUSED]" } else { "" };
        format!("IF: {intrf} | Total {t} (Up / Down): {up} / {down}{paused}")
    }

    fn render_elapsed_time(&self, frame: &mut Frame, rect: Rect, elapsed_time: &str, color: Color) {
        let elapsed_time_text = Span::styled(
            elapsed_time,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        );
        let paragraph = Paragraph::new(elapsed_time_text).alignment(Alignment::Right);
        frame.render_widget(paragraph, rect);
    }
}

```

### Core Architecture Module: `src/display/components/help_text.rs`
```
use ratatui::{
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::Span,
    widgets::Paragraph,
    Frame,
};

pub struct HelpText {
    pub paused: bool,
    pub show_dns: bool,
}

const FIRST_WIDTH_BREAKPOINT: u16 = 76;
const SECOND_WIDTH_BREAKPOINT: u16 = 54;

const TEXT_WHEN_PAUSED: &str = " Press <SPACE> to resume.";
const TEXT_WHEN_NOT_PAUSED: &str = " Press <SPACE> to pause.";
const TEXT_WHEN_DNS_NOT_SHOWN: &str = " (DNS queries hidden).";
const TEXT_WHEN_DNS_SHOWN: &str = " (DNS queries shown).";
const TEXT_TAB_TIP: &str = " Use <TAB> to rearrange tables.";

impl HelpText {
    pub fn render(&self, frame: &mut Frame, rect: Rect) {
        let pause_content = if self.paused {
            TEXT_WHEN_PAUSED
        } else {
            TEXT_WHEN_NOT_PAUSED
        };

        let dns_content = if rect.width <= FIRST_WIDTH_BREAKPOINT {
            ""
        } else if self.show_dns {
            TEXT_WHEN_DNS_SHOWN
        } else {
            TEXT_WHEN_DNS_NOT_SHOWN
        };

        let tab_text = if rect.width <= SECOND_WIDTH_BREAKPOINT {
            ""
        } else {
            TEXT_TAB_TIP
        };

        let text = Span::styled(
            [pause_content, tab_text, dns_content].concat(),
            Style::default().add_modifier(Modifier::BOLD),
        );
        let paragraph = Paragraph::new(text).alignment(Alignment::Left);
        frame.render_widget(paragraph, rect);
    }
}

```

### Core Architecture Module: `src/display/components/layout.rs`
```
use ratatui::{
    layout::{Constraint, Direction, Rect},
    Frame,
};

use crate::display::{HeaderDetails, HelpText, Table};

const FIRST_HEIGHT_BREAKPOINT: u16 = 30;
const FIRST_WIDTH_BREAKPOINT: u16 = 120;

fn top_app_and_bottom_split(rect: Rect) -> (Rect, Rect, Rect) {
    let parts = ratatui::layout::Layout::default()
        .direction(Direction::Vertical)
        .margin(0)
        .constraints(
            [
                Constraint::Length(1),
                Constraint::Length(rect.height - 2),
                Constraint::Length(1),
            ]
            .as_ref(),
        )
        .split(rect);
    (parts[0], parts[1], parts[2])
}

pub struct Layout<'a> {
    pub header: HeaderDetails<'a>,
    pub children: Vec<Table>,
    pub footer: HelpText,
}

impl Layout<'_> {
    fn progressive_split(&self, rect: Rect, splits: Vec<Direction>) -> Vec<Rect> {
        splits
            .into_iter()
            .fold(vec![rect], |mut layout, direction| {
                let last_rect = layout.pop().unwrap();
                let halves = ratatui::layout::Layout::default()
                    .direction(direction)
                    .margin(0)
                    .constraints([Constraint::Percentage(50), Constraint::Percentage(50)].as_ref())
                    .split(last_rect);
                layout.append(&mut halves.to_vec());
                layout
            })
    }

    fn build_two_children_layout(&self, rect: Rect) -> Vec<Rect> {
        // if there are two elements
        if rect.height < FIRST_HEIGHT_BREAKPOINT && rect.width < FIRST_WIDTH_BREAKPOINT {
            // if the space is not enough, we drop one element
            vec![rect]
        } else if rect.width < FIRST_WIDTH_BREAKPOINT {
            // if the horizontal space is not enough, we drop one element and we split horizontally
            self.progressive_split(rect, vec![Direction::Vertical])
        } else {
            // by default we display two elements splitting vertically
            self.progressive_split(rect, vec![Direction::Horizontal])
        }
    }

    fn build_three_children_layout(&self, rect: Rect) -> Vec<Rect> {
        // if there are three elements
        if rect.height < FIRST_HEIGHT_BREAKPOINT && rect.width < FIRST_WIDTH_BREAKPOINT {
            //if the space is not enough, we drop two elements
            vec![rect]
        } else if rect.height < FIRST_HEIGHT_BREAKPOINT {
            // if the vertical space is not enough, we drop one element and we split vertically
            self.progressive_split(rect, vec![Direction::Horizontal])
        } else if rect.width < FIRST_WIDTH_BREAKPOINT {
            // if the horizontal space is not enough, we drop one element and we split horizontally
            self.progressive_split(rect, vec![Direction::Vertical])
        } else {
            // default layout
            let halves = ratatui::layout::Layout::default()
                .direction(Direction::Vertical)
                .margin(0)
                .constraints([Constraint::Percentage(50), Constraint::Percentage(50)].as_ref())
                .split(rect);
            let top_quarters = ratatui::layout::Layout::default()
                .direction(Direction::Horizontal)
                .margin(0)
                .constraints([Constraint::Percentage(50), Constraint::Percentage(50)].as_ref())
                .split(halves[0]);

            vec![top_quarters[0], top_quarters[1], halves[1]]
        }
    }

    fn build_layout(&self, rect: Rect) -> Vec<Rect> {
        if self.children.len() == 1 {
            // if there's only one element to render, it can take the whole frame
            vec![rect]
        } else if self.children.len() == 2 {
            self.build_two_children_layout(rect)
        } else {
            self.build_three_children_layout(rect)
        }
    }

    pub fn render(&self, frame: &mut Frame, rect: Rect, table_cycle_offset: usize) {
        let (top, app, bottom) = top_app_and_bottom_split(rect);
        let layout_slots = self.build_layout(app);
        for i in 0..layout_slots.len() {
            if let Some(rect) = layout_slots.get(i) {
                if let Some(child) = self
                    .children
                    .get((i + table_cycle_offset) % self.children.len())
                {
                    child.render(frame, *rect);
                }
            }
        }
        self.header.render(frame, top);
        self.footer.render(frame, bottom);
    }
}

```

### Core Architecture Module: `src/display/components/mod.rs`
```
mod display_bandwidth;
mod header_details;
mod help_text;
mod layout;
mod table;

pub use display_bandwidth::*;
pub use header_details::*;
pub use help_text::*;
pub use layout::*;
pub use table::*;

```

### Core Architecture Module: `src/display/components/table.rs`
```
use std::{collections::HashMap, net::IpAddr, ops::Index, rc::Rc};

use derive_more::Debug;
use itertools::Itertools;
use ratatui::{
    layout::{Constraint, Rect},
    style::{Color, Style},
    widgets::{Block, Borders, Row},
    Frame,
};
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

use crate::{
    display::{Bandwidth, BandwidthUnitFamily, DisplayBandwidth, UIState},
    network::{display_connection_string, display_ip_or_host},
};

/// The displayed layout choice of a table.
/// Each value in the array is the width of each column.
///
/// Note that this only determines how a table is displayed, not what data it contains.
///
/// If we intend to display different number of columns in the future,
/// then new variants should be added.
#[derive(Copy, Clone, Debug)]
pub enum DisplayLayout {
    /// Show 2 columns.
    C2([u16; 2]),
    /// Show 3 columns.
    C3([u16; 3]),
    /// Show 4 columns.
    C4([u16; 4]),
}

impl Index<usize> for DisplayLayout {
    type Output = u16;

    fn index(&self, i: usize) -> &Self::Output {
        match self {
            Self::C2(arr) => &arr[i],
            Self::C3(arr) => &arr[i],
            Self::C4(arr) => &arr[i],
        }
    }
}

impl DisplayLayout {
    #[inline]
    fn columns_count(&self) -> usize {
        match self {
            Self::C2(_) => 2,
            Self::C3(_) => 3,
            Self::C4(_) => 4,
        }
    }

    #[inline]
    fn iter(&self) -> impl Iterator<Item = &u16> {
        match self {
            Self::C2(ws) => ws.iter(),
            Self::C3(ws) => ws.iter(),
            Self::C4(ws) => ws.iter(),
        }
    }

    #[inline]
    fn widths_sum(&self) -> u16 {
        self.iter().sum()
    }

    /// Returns the computed actual width and the spacer width.
    ///
    /// See [`Table`] for layout rules.
    fn compute_actual_widths(&self, available: u16) -> (Self, u16) {
        let columns_count = self.columns_count() as u16;
        let desired_min = self.widths_sum();

        // spacer max width is 2
        let spacer = if available > desired_min {
            ((available - desired_min) / (columns_count - 1)).min(2)
        } else {
            0
        };
        let available_without_spacers = available - spacer * (columns_count - 1);

        // multiplier
        let m = available_without_spacers as f64 / desired_min as f64;

        // remainder width is arbitrarily given to column 0
        let computed = match *self {
            Self::C2([_w0, w1]) => {
                let w1_new = (w1 as f64 * m).trunc() as u16;
                Self::C2([available_without_spacers - w1_new, w1_new])
            }
            Self::C3([_w0, w1, w2]) => {
                let w1_new = (w1 as f64 * m).trunc() as u16;
                let w2_new = (w2 as f64 * m).trunc() as u16;
                Self::C3([available_without_spacers - w1_new - w2_new, w1_new, w2_new])
            }
            Self::C4([_w0, w1, w2, w3]) => {
                let w1_new = (w1 as f64 * m).trunc() as u16;
                let w2_new = (w2 as f64 * m).trunc() as u16;
                let w3_new = (w3 as f64 * m).trunc() as u16;
                Self::C4([
                    available_without_spacers - w1_new - w2_new - w3_new,
                    w1_new,
                    w2_new,
                    w3_new,
                ])
            }
        };

        (computed, spacer)
    }
}

/// All data of a table.
///
/// If tables with different number of columns are added in the future,
/// then new variants should be added.
#[derive(Clone, Debug)]
enum TableData {
    /// A table with 3 columns.
    C3(NColsTableData<3>),
    /// A table with 4 columns.
    C4(NColsTableData<4>),
}

impl From<NColsTableData<3>> for TableData {
    fn from(data: NColsTableData<3>) -> Self {
        Self::C3(data)
    }
}

impl From<NColsTableData<4>> for TableData {
    fn from(data: NColsTableData<4>) -> Self {
        Self::C4(data)
    }
}

impl TableData {
    fn column_names(&self) -> &[&str] {
        match self {
            Self::C3(inner) => &inner.column_names,
            Self::C4(inner) => &inner.column_names,
        }
    }

    fn rows(&self) -> Vec<&[String]> {
        match self {
            Self::C3(inner) => inner.rows.iter().map(|r| r.as_slice()).collect(),
            Self::C4(inner) => inner.rows.iter().map(|r| r.as_slice()).collect(),
        }
    }

    fn column_selector(&self) -> &dyn Fn(&DisplayLayout) -> Vec<usize> {
        match self {
            Self::C3(inner) => inner.column_selector.as_ref(),
            Self::C4(inner) => inner.column_selector.as_ref(),
        }
    }
}

/// All data of a table with `C` columns.
///
/// Note that the number of columns here is independent of the number of columns
/// being actually shown. If width-constrained, we might only show some of the columns.
#[derive(Clone, Debug)]
struct NColsTableData<const C: usize> {
    /// The name of each column.
    column_names: [&'static str; C],
    /// All rows of data.
    rows: Vec<[String; C]>,
    /// Function to determine which columns to show for a given layout.
    ///
    /// This function should return a vector of column indices.
    /// The indices should be less than `C`; otherwise this will cause a runtime panic.
    #[debug("Rc</* function pointer */>")]
    column_selector: Rc<ColumnSelectorFn>,
}

/// Clippy wanted me to write this. 💢
type ColumnSelectorFn = dyn Fn(&DisplayLayout) -> Vec<usize>;

/// A table displayed by bandwhich.
#[derive(Clone, Debug)]
pub struct Table {
    title: &'static str,
    /// A layout mapping between minimum available width and the width of each column.
    ///
    /// Note that the width of each column here is the "desired minimum width".
    ///
    /// - Wt = available width of table
    /// - Wd = sum of desired minimum width of each column
    ///
    /// - If `Wt >= Wd`, spacers with a maximum width of `2` will be inserted
    ///   between columns; and then the columns will proportionally expand.
    /// - If `Wt < Wd`, columns will proportionally shrink.
    width_cutoffs: Vec<(u16, DisplayLayout)>,
    data: TableData,
}

impl Table {
    pub fn create_connections_table(state: &UIState, ip_to_host: &HashMap<IpAddr, String>) -> Self {
        use DisplayLayout as D;

        let title = "Utilization by connection";
        let width_cutoffs = vec![
            (0, D::C2([32, 18])),
            (80, D::C3([36, 12, 18])),
            (100, D::C3([54, 18, 22])),
            (120, D::C3([72, 24, 22])),
        ];

        let column_names = [
            "Connection",
            "Process",
            if state.cumulative_mode {
                "Data (Up / Down)"
            } else {
                "Rate (Up / Down)"
            },
        ];
        let rows = state
            .connections
            .iter()
            .map(|(connection, connection_data)| {
                [
                    display_connection_string(
                        connection,
                        ip_to_host,
                        &connection_data.interface_name,
                    ),
                    connection_data.process_name.to_string(),
                    display_upload_and_download(
                        connection_data,
                        state.unit_family,
                        state.cumulative_mode,
                    ),
                ]
            })
            .collect();
        let column_selector = Rc::new(|layout: &D| match layout {
            D::C2(_) => vec![0, 2],
            D::C3(_) => vec![0, 1, 2],
            D::C4(_) => unreachable!(),
        });

        Table {
            title,
            width_cutoffs,
            data: NColsTableData {
                column_names,
                rows,
                column_selector,
            }
            .into(),
        }
    }

    pub fn create_processes_table(state: &UIState) -> Self {
        use DisplayLayout as D;

        let title = "Utilization by process name";
        let width_cutoffs = vec![
            (0, D::C2([16, 18])),
            (50, D::C3([16, 12, 20])),
            (60, D::C3([24, 12, 20])),
            (80, D::C4([28, 12, 12, 24])),
        ];

        let column_names = [
            "Process",
            "PID",
            "Connections",
            if state.cumulative_mode {
                "Data (Up / Down)"
            } else {
                "Rate (Up / Down)"
            },
        ];
        let rows = state
            .processes
            .iter()
            .map(|(proc_info, data_for_process)| {
                [
                    proc_info.name.to_string(),
                    proc_info.pid.to_string(),
                    data_for_process.connection_count.to_string(),
                    display_upload_and_download(
                        data_for_process,
                        state.unit_family,
                        state.cumulative_mode,
                    ),
                ]
            })
            .collect();
        let column_selector = Rc::new(|layout: &D| match layout {
            D::C2(_) => vec![0, 3],
            D::C3(_) => vec![0, 2, 3],
            D::C4(_) => vec![0, 1, 2, 3],
        });

        Table {
            title,
            width_cutoffs,
            data: NColsTableData {
                column_names,
                rows,
                column_selector,
            }
            .into(),
        }
    }

    pub fn create_remote_addresses_table(
        state: &UIState,
        ip_to_host: &HashMap<IpAddr, String>,
    ) -> Self {
        use DisplayLayout as D;

        let title = "Utilization by remote address";
        let width_cutoffs = vec![
            (0, D::C2([16, 16])),
            (40, D::C2([20, 16])),
            (60, D::C3([24, 10, 20])),
            (100, D::C3([54, 16, 24])),
        ];

        let column_names = [
            "Remote Address",
            "Connections",
            if state.cumulative_mode {
                "Data 
```

### Core Architecture Module: `src/display/mod.rs`
```
mod components;
mod raw_terminal_backend;
mod ui;
mod ui_state;

pub use components::*;
pub use raw_terminal_backend::*;
pub use ui::*;
pub use ui_state::*;

```

### Core Architecture Module: `src/display/raw_terminal_backend.rs`
```
// this is a bit of a hack:
// the TUI backend used by this app changes stdout to raw byte mode.
// this is not desired when we do not use it (in our --raw mode),
// since it makes writing to stdout overly complex
//
// so what we do here is provide a fake backend (RawTerminalBackend)
// that implements the Backend TUI trait, but does nothing
// this way, we don't need to create the TermionBackend
// and thus skew our stdout when we don't need it

use std::io;

use ratatui::{
    backend::{Backend, WindowSize},
    buffer::Cell,
    layout::{Position, Size},
    prelude::backend::ClearType,
};

pub struct RawTerminalBackend {}

impl Backend for RawTerminalBackend {
    type Error = io::Error;

    fn draw<'a, I>(&mut self, _content: I) -> io::Result<()>
    where
        I: Iterator<Item = (u16, u16, &'a Cell)>,
    {
        Ok(())
    }

    fn hide_cursor(&mut self) -> io::Result<()> {
        Ok(())
    }

    fn show_cursor(&mut self) -> io::Result<()> {
        Ok(())
    }

    fn get_cursor_position(&mut self) -> io::Result<Position> {
        Ok(Position::new(0, 0))
    }

    fn set_cursor_position<P: Into<Position>>(&mut self, _position: P) -> io::Result<()> {
        Ok(())
    }

    fn clear(&mut self) -> io::Result<()> {
        Ok(())
    }

    fn clear_region(&mut self, _clear_type: ClearType) -> Result<(), Self::Error> {
        Ok(())
    }

    fn size(&self) -> io::Result<Size> {
        Ok(Size::new(0, 0))
    }

    fn window_size(&mut self) -> io::Result<WindowSize> {
        Ok(WindowSize {
            columns_rows: Size::default(),
            pixels: Size::default(),
        })
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #365** (2024-02-21): **crash as soon as executed on FreeBSD 13.2**
  *Symptoms*: pkg install bandwhich bandwhich immediately resulted in >>  thread 'display_handler' panicked at src/os/lsof_utils.rs:110:31:                                                                  called `Result::unwrap()` on an `Err` value: AddrParseError(Ip)                                                                                                                                 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace                            Abort (core dumped)
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #217, #254, and #291. This was fixed in #288 and released in 0.21.1.  Please don't forget to search for existing issues before submitting, thanks.
  > thank you and sorry for the duplicate. I didn't realise that by being on FreeBSD-13.2 I was not getting the latest version of bandwhich. 

- **Issue #295** (2023-10-06): **--version / -V no longer working**
  *Symptoms*: I can no longer get the installed version by running `bandwhich -V` or with `--version`. I use this to upgrade to newer versions.  ![image](https://github.com/imsnif/bandwhich/assets/13314239/94240e89-4a4d-4214-86dd-e301b5775a24)  This used to work for v 0.20.0.
  **Post-Mortem & Fix Analysis**:
  > Hello, this problem was already solved in #290, release 0.21.0 has version again =]. ![image](https://github.com/imsnif/bandwhich/assets/75655486/035e29ec-51e8-4bf0-bd70-6c14141b2f94) 
  > Do you compile it differently to set the version? I just downloaded `bandwhich-v0.21.0-x86_64-unknown-linux-musl.tar.gz` from the releases and from that binary I don't get the version: ``` ./bandwhich --version error: unexpected argument '--version' found  Usage: bandwhich [OPTIONS]  For more information, try '--help'. ``` I built mine from source: `cargo build --release` I also built using the src rpm on COPR. There is no version output.
  > i built mine from source too, i will clone the repo again to test.  Edit: in the main branch it's working and in the release tag v0.21.0 it's not really working. ![image](https://github.com/imsnif/bandwhich/assets/75655486/548f86eb-ca2e-460b-a41f-dadc311519ff) As you can see, v0.21.0 has no version yet, it will probably be fixed in the next version. Sorry for my previous analysis

- **Issue #291** (2023-09-21): **freebsd pkg crashes**
  *Symptoms*: ``` pkg install bandwhich bandwhich ```  ``` thread 'display_handler' panicked at 'called `Result::unwrap()` on an `Err` value: AddrParseError(Ip)', src/os/lsof_utils.rs:110:31 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace                                                                                                                                                                                                                 [1]    58069 abort (core dumped)  bandwhich ```  with RUST_BACKTRACE=1 ``` thread 'display_handler' panicked at 'called `Result::unwrap()` on an `Err` value: AddrParseError(Ip)', src/os/lsof_utils.rs:110:31 stack backtrace: note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.                                                                                                                                                                                                                                     [1]    58103 abort (core dumped)  RUST_BACKTRACE=1 bandwhich ``` thread 'display_handler' panicked at 'called `Result::unwrap()` on an `Err` value: AddrParseError(Ip)', src/os/lsof_utils.rs:110:31                                                                                                                                    stack backtrace:                                                                                                                                      
  **Post-Mortem & Fix Analysis**:
  > See #217.

- **Issue #284** (2023-10-16): **Bandwhich appears to have a serious memory leak**
  *Symptoms*: I built and ran bandwhich on a few machines. After a while of running, it dies. I see this in my logs  ```bash [Sat Sep  9 14:11:34 2023] [ 910813]     0 910813 25425140  6316768 76255232  3166464           200 bandwhich [Sat Sep  9 14:11:34 2023] oom-kill:constraint=CONSTRAINT_NONE,nodemask=(null),cpuset=zerotier-one.service,mems_allowed=0,global_oom,task_memcg=/system.slice/snap.bandwhich.bandwhich-92de3b50-fb9a-430c-9645-eac2cde77fe0.scope,task=bandwhich,pid=910813,uid=0 [Sat Sep  9 14:11:34 2023] Out of memory: Killed process 910813 (bandwhich) total-vm:101700560kB, anon-rss:25267072kB, file-rss:0kB, shmem-rss:0kB, UID:0 pgtables:74468kB oom_score_adj:200 [Sat Sep  9 14:11:37 2023] oom_reaper: reaped process 910813 (bandwhich), now anon-rss:88kB, file-rss:0kB, shmem-rss:0kB ```  While I've seen this on remote, small servers. I have also seen it on my workstation which has 32GB RAM and 22GB swap. 
  **Post-Mortem & Fix Analysis**:
  > ![image](https://github.com/imsnif/bandwhich/assets/1841272/a0828f79-da6f-494d-adbc-1f9048208bc3)  Caught a picture from [bottom](https://github.com/ClementTsang/bottom).  Note the purple line shoots up (that's bandwhich eating RAM) then the yellow line climbs as it eats all the swap, then gets killed by the OOM killer...
  > Is this problem happening on `main`?  Bandwhich itself does not use any unsafe code, so it's likely that the memory leak was caused by a dependency. We had lots of dependency bumps since the last release, so this may have been already solved if indeed that's the version you are seeing problems on.
  > I was using whatever was in `main` when I filed the issue, yes. Happy to test again after the changes that landed today, but that all looks like CD pipeline stuff?   I found it quite easily reproducible on multiple machines for me. Just leave it running for a while and eventually, it blows up. Might take many minutes or hours, depending on traffic volume, maybe.   I built it with rust 1.70.0 if that makes any difference?

- **Issue #237** (2023-09-20): **Process displays as <UNNOWN>**
  *Symptoms*: Running Bandwhich under OpenWrt.  Known processes are shown, the rest are listed as `<UNKNOWN>` ``` root@gateway:~# bandwhich -V bandwhich 0.20.0 root@gateway:~# ```  Any suggestions on what might actually make the process show?  ![image](https://user-images.githubusercontent.com/4427558/168245261-60f5a099-1ebb-4071-9791-ab93aa44f4cf.png) 
  **Post-Mortem & Fix Analysis**:
  > See also:   * #196  * #209  * FreeBSD bug [251510 – net-mgmt/bandwhich process `<UNKNOWN>`](https://bugs.freebsd.org/bugzilla/show_bug.cgi?id=251510)
  > Hit the same issue! Has any PR been made regarding this? Is it possible to see _PID_?
  > Moving discussion to #196.

- **Issue #235** (2023-10-07): **systemd-resolved v250 & bandwhich  failing DNS**
  *Symptoms*: Error message  ``` Error: Could not initialize the DNS resolver. Are you offline?  Reason: ResolveError { inner: Custom { kind: Other, error: "Error parsing resolv.conf: InvalidOption(21)" }  io error } ```  bandwhich version ``` >  bandwhich --version bandwhich 0.20.0 ```  system-resolved version: ``` >  rpm -q systemd-resolved systemd-resolved-250.3-8.fc36.x86_64 ```   OS: Fedora release 36 (Thirty Six) x86_64  Kernel: 5.17.4-300.fc36.x86_64
  **Post-Mortem & Fix Analysis**:
  > same here after  ``` cargo install bandwhich sudo ~/.cargo/bin/bandwhich ```  `/etc/resolv.conf` looks fine:  ``` # This is /run/systemd/resolve/stub-resolv.conf managed by man:systemd-resolved(8). # Do not edit. # # This file might be symlinked as /etc/resolv.conf. If you're looking at # /etc/resolv.conf and seeing this text, you have followed the symlink. # # This is a dynamic resolv.conf file for connecting local clients to the # internal DNS stub resolver of systemd-resolved. This file lists all # configured search domains. # # Run "resolvectl status" to see details about the uplink DNS servers # currently in use. # # Third party programs should typically not access this file directly, but only # through the symlink at /etc/resolv.conf. To manage man:resolv.conf(5) in a # different way, replace this symlink by a static file or a different symlink. # # See man:systemd-resolved.service(8) for details about the supported modes of # operation for /etc/resolv
  > Needs to be updated trust-dns-resolver: https://github.com/imsnif/bandwhich/blob/main/Cargo.lock#L2131
  > Having the same problem. Ubuntu 22.04.3 LTS. bandwhich 0.20.0 (installed moments ago). 

- **Issue #223** (2023-09-20): **High CPU usage**
  *Symptoms*: Hello! This is more of a question. I was wondering what's the expected CPU usage for `bandwhich`? I'm asking because I couldn't help but notice the high usage. On an `i7-8700K` the utility usually uses around 7% of teh CPU (as reported by `htop`). This seems very large to me, all the more so since it's not uncommon for it to jump to 11% and often sits at 9% for a few seconds.
  **Post-Mortem & Fix Analysis**:
  > On my machine (i7-10710U `Linux 6.5.3-arch1-1 x86_64`) CPU usage hovers around 1% of 1 core, so what you are seeing would be considered abnormal I think.  But first, can you please see if this issue persists for you on v0.21.0? There have been lots of dependency bumps so it might have magically™️ resolved.  If not, can you please provide a bit more info on your OS versions? Thanks.
  > You are right, upgrading bandwhich fixed the issue for me. Thanks for the fix, somewhere along the commits.

- **Issue #217** (2023-10-11): **Fails to start on MacOS Big Sur**
  *Symptoms*: I'm running into an issue running bandwhich on macOS Big Sur 11.3.1.  It installed just fine via `brew install bandwhich`.  After starting it up using `sudo bandwhich`, I get this error in the terminal:  ``` thread 'display_handler' panicked at 'called `Result::unwrap()` on an `Err` value: AddrParseError(())', src/os/lsof_utils.rs:110:31  note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace ```  I resize the terminal window and then I see the 3 pane bandwhich appear, but each section is empty.  Hit `q` to exit and see another error message appear:  ``` thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: Any', src/main.rs:311:31 ```  ![ScreenFlow](https://user-images.githubusercontent.com/554791/118568041-932c3200-b73c-11eb-950e-8cf6701929cb.gif)    **2021-06-01 UPDATE:**  Here's the backtrace in case it's of any help.  ``` thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: Any', src/main.rs:311:31 stack backtrace:    0:        0x106413ede - <std::sys_common::backtrace::_print::DisplayBacktrace as core::fmt::Display>::fmt::h0afb3dc3ec8cd05f    1:        0x10644a3fe - core::fmt::write::h39441ef24fae20ea    2:        0x106413c79 - std::io::Write::write_fmt::h2ffecc964e3c3ddd    3:        0x106430de5 - std::panicking::default_hook::{{closure}}::h1a491655bcf6394f    4:        0x106430b0c - std::panicking::default_hook::h038c301fad559a62    5:        0x1064312f5 - std::panicking::rust_panic_
  **Post-Mortem & Fix Analysis**:
  > I'm getting an error as well on macOS Big Sur 1.4  Bandwhich won't show up actually, I just get the below error  ``` ❯ bandwhich Error:   lo0: No such file or directory (os error 2)  en0: No such file or directory (os error 2)  awdl0: No such file or directory (os error 2)  llw0: No such file or directory (os error 2)  utun0: No such file or directory (os error 2)  utun1: No such file or directory (os error 2)  en5: No such file or directory (os error 2) ```  UPDATE:  ```sh ✗ RUST_BACKTRACE=full bandwhich -i bridge0                                                                      22:59:19 thread 'main' panicked at 'asked to collect errors but found no errors', src/os/shared.rs:143:14 stack backtrace:    0:        0x10b572ede - <std::sys_common::backtrace::_print::DisplayBacktrace as core::fmt::Display>::fmt::h0afb3dc3ec8cd05f    1:        0x10b5a93fe - core::fmt::write::h39441ef24fae20ea    2:        0x10b572c79 - std::io::Write::write_fmt::h2ffecc964e3c3dd
  > @fredericrous works with sudo for me on 11.3.1
  > Same error here on macOS Monterey v12.2.1.

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

### Incident Patch 1: `cdf3f0a5` (2026-05-14)
**Commit Message**: Fix clippy nightly lints

**File**: `src/display/ui_state.rs` (modified, +3/-3)
```diff
@@ -198,13 +198,13 @@ impl UIState {
         } else {
             self.utilization_data.len() as u128
         };
-        for (_, network_data) in processes.iter_mut() {
+        for network_data in processes.values_mut() {
             network_data.divide_by(divide_by)
         }
-        for (_, network_data) in remote_addresses.iter_mut() {
+        for network_data in remote_addresses.values_mut() {
             network_data.divide_by(divide_by)
         }
-        for (_, connection_data) in connections.iter_mut() {
+        for connection_data in connections.values_mut() {
             connection_data.divide_by(divide_by)
         }
 
```

**File**: `src/os/shared.rs` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ pub(crate) fn get_datalink_channel(
             )),
             _ => Err(GetInterfaceError::OtherError(format!(
                 "{}: {e}",
-                &interface.name
+                interface.name
             ))),
         },
     }
```

---

### Incident Patch 2: `cbcffe88` (2026-02-11)
**Commit Message**: Merge pull request #491 from chiranjeevi-max/fix/input-sigint-handling

fix(input): handle Ctrl+C via SIGINT signal instead of keypress

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 ### Fixed
 
+* Fix Ctrl+C handling to use SIGINT signal instead of keypress #491 - @chiranjeevi-max
 * Update CONTRIBUTING information #438 - @YJDoc2 @cyqsimon
 * Fix new clippy lint #457 - @cyqsimon
 * Apply new clippy lints #468 - @cyqsimon
```

**File**: `Cargo.lock` (modified, +91/-10)
```diff
@@ -166,6 +166,7 @@ dependencies = [
  "clap_complete",
  "clap_mangen",
  "crossterm 0.29.0",
+ "ctrlc",
  "derive_more",
  "eyre",
  "http_req",
@@ -240,6 +241,15 @@ dependencies = [
  "generic-array",
 ]
 
+[[package]]
+name = "block2"
+version = "0.6.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cdeb9d870516001442e364c5220d3574d2da8dc765554b4a617230d33fa58ef5"
+dependencies = [
+ "objc2",
+]
+
 [[package]]
 name = "bumpalo"
 version = "3.19.0"
@@ -318,6 +328,12 @@ version = "1.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9555578bc9e57714c812a1f84e4fc5b4d21fcb063490c624de019f7464c91268"
 
+[[package]]
+name = "cfg_aliases"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
+
 [[package]]
 name = "chrono"
 version = "0.4.41"
@@ -329,7 +345,7 @@ dependencies = [
  "js-sys",
  "num-traits",
  "wasm-bindgen",
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -577,6 +593,17 @@ dependencies = [
  "typenum",
 ]
 
+[[package]]
+name = "ctrlc"
+version = "3.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e0b1fab2ae45819af2d0731d60f2afe17227ebb1a1538a236da84c93e9a60162"
+dependencies = [
+ "dispatch2",
+ "nix",
+ "windows-sys 0.61.2",
+]
+
 [[package]]
 name = "darling"
 version = "0.20.11"
@@ -688,6 +715,18 @@ dependencies = [
  "subtle",
 ]
 
+[[package]]
+name = "dispatch2"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "89a09f22a6c6069a18470eb92d2298acf25463f14256d24778e1230d789a2aec"
+dependencies = [
+ "bitflags 2.9.1",
+ "block2",
+ "libc",
+ "objc2",
+]
+
 [[package]]
 name = "displaydoc"
 version = "0.2.5"
@@ -1251,9 +1290,9 @@ dependencies = [
 
 [[package]]
 name = "libc"
-version = "0.2.174"
+version = "0.2.180"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1171693293099992e19cddea4e8b849964e9846f4acee11b3948bcc337be8776"
+checksum = "bcc35a38544a891a5f7c865aca548a982ccb3b8650a5b06d0fd33a10283c56fc"
 
 [[package]]
 name = "libloading"
@@ -1467,6 +1506,18 @@ dependencies = [
  "thiserror 2.0.12",
 ]
 
+[[package]]
+name = "nix"
+version = "0.31.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "225e7cfe711e0ba79a68baeddb2982723e4235247aefce1482f2f16c27865b66"
+dependencies = [
+ "bitflags 2.9.1",
+ "cfg-if",
+ "cfg_aliases",
+ "libc",
+]
+
 [[package]]
 name = "no-std-net"
 version = "0.6.0"
@@ -1527,6 +1578,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "objc2"
+version = "0.6.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b7c2599ce0ec54857b29ce62166b0ed9b4f6f1a70ccc9a71165b6154caca8c05"
+dependencies = [
+ "objc2-encode",
+]
+
 [[package]]
 name = "objc2-core-foundation"
 version = "0.3.1"
@@ -1536,6 +1596,12 @@ dependencies = [
  "bitflags 2.9.1",
 ]
 
+[[package]]
+name = "objc2-encode"
+version = "4.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ef25abbcd74fb2609453eb695bd2f860d389e457f67dc17cafc8b8cbc89d0c33"
+
 [[package]]
 name = "objc2-io-kit"
 version = "0.3.1"
@@ -2788,7 +2854,7 @@ dependencies = [
  "windows-collections",
  "windows-core",
  "windows-future",
- "windows-link",
+ "windows-link 0.1.3",
  "windows-numerics",
 ]
 
@@ -2809,7 +2875,7 @@ checksum = "c0fdd3ddb90610c7638aa2b3a3ab2904fb9e5cdbecc643ddb3647212781c4ae3"
 dependencies = [
  "windows-implement",
  "windows-interface",
- "windows-link",
+ "windows-link 0.1.3",
  "windows-result",
  "windows-strings",
 ]
@@ -2821,7 +2887,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fc6a41e98427b19fe4b73c550f060b59fa592d7d686537eebf9385621bfbad8e"
 dependencies = [
  "windows-core",
- "windows-link",
+ "windows-link 0.1.3",
  "windows-threading",
 ]
 
@@ -2853,14 +2919,20 @@ version = "0.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5e6ad25900d524eaabdbbb96d20b4311e1e7ae1699af4fb28c17ae66c80d798a"
 
+[[package]]
+name = "windows-link"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"
+
 [[package]]
 name = "windows-numerics"
 version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9150af68066c4c5c07ddc0ce30421554771e528bde427614c61038bc2c92c2b1"
 dependencies = [
  "windows-core",
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -2869,7 +2941,7 @@ version = "0.3.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "56f42bd332cc6c8eac5af113fc0c1fd6a8fd2aa08a0119358686e5160d0586c6"
 dependencies = [
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -2878,7 +2950,7 @@ version = "0.4.2"
 source = "registry+https://github.com/rust-lang/cra
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ chrono = "0.4"
 clap-verbosity-flag = "3.0.3"
 clap = { version = "4.5.41", features = ["derive"] }
 crossterm = "0.29.0"
+ctrlc = "3.4"
 derive_more = { version = "2.0.1", features = ["debug"] }
 eyre = "0.6.12"
 itertools = "0.14.0"
```

**File**: `src/main.rs` (modified, +21/-7)
```diff
@@ -70,6 +70,11 @@ fn main() -> eyre::Result<()> {
         let _ = crossterm::execute!(&mut stdout, terminal::EnterAlternateScreen);
         let terminal_backend = CrosstermBackend::new(stdout);
         start(terminal_backend, os_input, opts);
+
+        // Ensure terminal is restored after exit (handles SIGINT case).
+        // These operations are idempotent, so safe to call even if 'q' already cleaned up.
+        let _ = terminal::disable_raw_mode();
+        let _ = crossterm::execute!(std::io::stdout(), terminal::LeaveAlternateScreen);
     }
     Ok(())
 }
@@ -96,6 +101,17 @@ where
     let cumulative_time = Arc::new(RwLock::new(Duration::new(0, 0)));
     let table_cycle_offset = Arc::new(AtomicUsize::new(0));
 
+    // handle SIGINT properly instead of as a keypress
+    // see https://github.com/imsnif/bandwhich/issues/487
+    #[cfg(not(test))]
+    {
+        let running = running.clone();
+        ctrlc::set_handler(move || {
+            running.store(false, Ordering::Release);
+        })
+        .expect("failed to set SIGINT handler");
+    }
+
     let mut active_threads = vec![];
 
     let terminal_events = os_input.terminal_events;
@@ -175,7 +191,11 @@ where
             let display_handler = display_handler.thread().clone();
 
             move || {
-                for evt in terminal_events {
+                let mut terminal_events = terminal_events;
+                while running.load(Ordering::Acquire) {
+                    let Some(evt) = terminal_events.next() else {
+                        continue;
+                    };
                     let mut ui = ui.lock().unwrap();
 
                     match evt {
@@ -192,12 +212,6 @@ where
                             );
                         }
                         Event::Key(KeyEvent {
-                            modifiers: KeyModifiers::CONTROL,
-                            code: KeyCode::Char('c'),
-                            kind: KeyEventKind::Press,
-                            ..
-                        })
-                        | Event::Key(KeyEvent {
                             modifiers: KeyModifiers::NONE,
                             code: KeyCode::Char('q'),
                             kind: KeyEventKind::Press,
```

**File**: `src/os/shared.rs` (modified, +16/-3)
```diff
@@ -1,10 +1,10 @@
 use std::{
     io::{self, ErrorKind, Write},
     net::Ipv4Addr,
-    time,
+    time::{self, Duration},
 };
 
-use crossterm::event::{read, Event};
+use crossterm::event::{poll, read, Event};
 use eyre::{bail, eyre};
 use itertools::Itertools;
 use log::{debug, warn};
@@ -35,12 +35,25 @@ impl ProcessInfo {
     }
 }
 
+/// Poll timeout for terminal events.
+/// This allows the event loop to periodically check the `running` flag
+/// for graceful shutdown on SIGINT.
+const POLL_TIMEOUT: Duration = Duration::from_millis(100);
+
 pub struct TerminalEvents;
 
 impl Iterator for TerminalEvents {
     type Item = Event;
+    /// Returns the next terminal event, or `None` if no event is available
+    /// within the poll timeout.
+    ///
+    /// Note: `None` here means "no event right now", not "iteration complete".
+    /// The consumer should use `while running` instead of `for evt in ...`.
     fn next(&mut self) -> Option<Event> {
-        read().ok()
+        match poll(POLL_TIMEOUT) {
+            Ok(true) => read().ok(),
+            Ok(false) | Err(_) => None,
+        }
     }
 }
 
```

**File**: `src/tests/cases/test_utils.rs` (modified, +4/-4)
```diff
@@ -25,8 +25,8 @@ use crate::{
 pub fn sleep_and_quit_events(sleep_num: usize) -> Box<TerminalEvents> {
     let events = iter::repeat_n(None, sleep_num)
         .chain([Some(Event::Key(KeyEvent::new(
-            KeyCode::Char('c'),
-            KeyModifiers::CONTROL,
+            KeyCode::Char('q'),
+            KeyModifiers::NONE,
         )))])
         .collect();
     Box::new(TerminalEvents::new(events))
@@ -37,8 +37,8 @@ pub fn sleep_resize_and_quit_events(sleep_num: usize) -> Box<TerminalEvents> {
         .chain([
             Some(Event::Resize(100, 100)),
             Some(Event::Key(KeyEvent::new(
-                KeyCode::Char('c'),
-                KeyModifiers::CONTROL,
+                KeyCode::Char('q'),
+                KeyModifiers::NONE,
             ))),
         ])
         .collect();
```

---

### Incident Patch 3: `5a870ffe` (2026-02-11)
**Commit Message**: fix: graceful shutdown on SIGINT

**File**: `Cargo.lock` (modified, +91/-10)
```diff
@@ -166,6 +166,7 @@ dependencies = [
  "clap_complete",
  "clap_mangen",
  "crossterm 0.29.0",
+ "ctrlc",
  "derive_more",
  "eyre",
  "http_req",
@@ -240,6 +241,15 @@ dependencies = [
  "generic-array",
 ]
 
+[[package]]
+name = "block2"
+version = "0.6.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cdeb9d870516001442e364c5220d3574d2da8dc765554b4a617230d33fa58ef5"
+dependencies = [
+ "objc2",
+]
+
 [[package]]
 name = "bumpalo"
 version = "3.19.0"
@@ -318,6 +328,12 @@ version = "1.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9555578bc9e57714c812a1f84e4fc5b4d21fcb063490c624de019f7464c91268"
 
+[[package]]
+name = "cfg_aliases"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
+
 [[package]]
 name = "chrono"
 version = "0.4.41"
@@ -329,7 +345,7 @@ dependencies = [
  "js-sys",
  "num-traits",
  "wasm-bindgen",
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -577,6 +593,17 @@ dependencies = [
  "typenum",
 ]
 
+[[package]]
+name = "ctrlc"
+version = "3.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e0b1fab2ae45819af2d0731d60f2afe17227ebb1a1538a236da84c93e9a60162"
+dependencies = [
+ "dispatch2",
+ "nix",
+ "windows-sys 0.61.2",
+]
+
 [[package]]
 name = "darling"
 version = "0.20.11"
@@ -688,6 +715,18 @@ dependencies = [
  "subtle",
 ]
 
+[[package]]
+name = "dispatch2"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "89a09f22a6c6069a18470eb92d2298acf25463f14256d24778e1230d789a2aec"
+dependencies = [
+ "bitflags 2.9.1",
+ "block2",
+ "libc",
+ "objc2",
+]
+
 [[package]]
 name = "displaydoc"
 version = "0.2.5"
@@ -1251,9 +1290,9 @@ dependencies = [
 
 [[package]]
 name = "libc"
-version = "0.2.174"
+version = "0.2.180"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1171693293099992e19cddea4e8b849964e9846f4acee11b3948bcc337be8776"
+checksum = "bcc35a38544a891a5f7c865aca548a982ccb3b8650a5b06d0fd33a10283c56fc"
 
 [[package]]
 name = "libloading"
@@ -1467,6 +1506,18 @@ dependencies = [
  "thiserror 2.0.12",
 ]
 
+[[package]]
+name = "nix"
+version = "0.31.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "225e7cfe711e0ba79a68baeddb2982723e4235247aefce1482f2f16c27865b66"
+dependencies = [
+ "bitflags 2.9.1",
+ "cfg-if",
+ "cfg_aliases",
+ "libc",
+]
+
 [[package]]
 name = "no-std-net"
 version = "0.6.0"
@@ -1527,6 +1578,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "objc2"
+version = "0.6.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b7c2599ce0ec54857b29ce62166b0ed9b4f6f1a70ccc9a71165b6154caca8c05"
+dependencies = [
+ "objc2-encode",
+]
+
 [[package]]
 name = "objc2-core-foundation"
 version = "0.3.1"
@@ -1536,6 +1596,12 @@ dependencies = [
  "bitflags 2.9.1",
 ]
 
+[[package]]
+name = "objc2-encode"
+version = "4.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ef25abbcd74fb2609453eb695bd2f860d389e457f67dc17cafc8b8cbc89d0c33"
+
 [[package]]
 name = "objc2-io-kit"
 version = "0.3.1"
@@ -2788,7 +2854,7 @@ dependencies = [
  "windows-collections",
  "windows-core",
  "windows-future",
- "windows-link",
+ "windows-link 0.1.3",
  "windows-numerics",
 ]
 
@@ -2809,7 +2875,7 @@ checksum = "c0fdd3ddb90610c7638aa2b3a3ab2904fb9e5cdbecc643ddb3647212781c4ae3"
 dependencies = [
  "windows-implement",
  "windows-interface",
- "windows-link",
+ "windows-link 0.1.3",
  "windows-result",
  "windows-strings",
 ]
@@ -2821,7 +2887,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fc6a41e98427b19fe4b73c550f060b59fa592d7d686537eebf9385621bfbad8e"
 dependencies = [
  "windows-core",
- "windows-link",
+ "windows-link 0.1.3",
  "windows-threading",
 ]
 
@@ -2853,14 +2919,20 @@ version = "0.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5e6ad25900d524eaabdbbb96d20b4311e1e7ae1699af4fb28c17ae66c80d798a"
 
+[[package]]
+name = "windows-link"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"
+
 [[package]]
 name = "windows-numerics"
 version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9150af68066c4c5c07ddc0ce30421554771e528bde427614c61038bc2c92c2b1"
 dependencies = [
  "windows-core",
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -2869,7 +2941,7 @@ version = "0.3.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "56f42bd332cc6c8eac5af113fc0c1fd6a8fd2aa08a0119358686e5160d0586c6"
 dependencies = [
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -2878,7 +2950,7 @@ version = "0.4.2"
 source = "registry+https://github.com/rust-lang/cra
```

**File**: `src/main.rs` (modified, +10/-1)
```diff
@@ -70,6 +70,11 @@ fn main() -> eyre::Result<()> {
         let _ = crossterm::execute!(&mut stdout, terminal::EnterAlternateScreen);
         let terminal_backend = CrosstermBackend::new(stdout);
         start(terminal_backend, os_input, opts);
+
+        // Ensure terminal is restored after exit (handles SIGINT case).
+        // These operations are idempotent, so safe to call even if 'q' already cleaned up.
+        let _ = terminal::disable_raw_mode();
+        let _ = crossterm::execute!(std::io::stdout(), terminal::LeaveAlternateScreen);
     }
     Ok(())
 }
@@ -186,7 +191,11 @@ where
             let display_handler = display_handler.thread().clone();
 
             move || {
-                for evt in terminal_events {
+                let mut terminal_events = terminal_events;
+                while running.load(Ordering::Acquire) {
+                    let Some(evt) = terminal_events.next() else {
+                        continue;
+                    };
                     let mut ui = ui.lock().unwrap();
 
                     match evt {
```

**File**: `src/os/shared.rs` (modified, +13/-3)
```diff
@@ -1,10 +1,10 @@
 use std::{
     io::{self, ErrorKind, Write},
     net::Ipv4Addr,
-    time,
+    time::{self, Duration},
 };
 
-use crossterm::event::{read, Event};
+use crossterm::event::{poll, read, Event};
 use eyre::{bail, eyre};
 use itertools::Itertools;
 use log::{debug, warn};
@@ -35,12 +35,22 @@ impl ProcessInfo {
     }
 }
 
+/// Poll timeout for terminal events.
+/// This allows the event loop to periodically check the `running` flag
+/// for graceful shutdown on SIGINT.
+const POLL_TIMEOUT: Duration = Duration::from_millis(100);
+
 pub struct TerminalEvents;
 
 impl Iterator for TerminalEvents {
     type Item = Event;
     fn next(&mut self) -> Option<Event> {
-        read().ok()
+        // Poll with timeout instead of blocking read to allow
+        // the caller to check for shutdown signals
+        match poll(POLL_TIMEOUT) {
+            Ok(true) => read().ok(),
+            Ok(false) | Err(_) => None,
+        }
     }
 }
 
```

---

### Incident Patch 4: `22271722` (2026-02-11)
**Commit Message**: fix(test): skip SIGINT handler registration during tests

**File**: `src/main.rs` (modified, +1/-0)
```diff
@@ -98,6 +98,7 @@ where
 
     // handle SIGINT properly instead of as a keypress
     // see https://github.com/imsnif/bandwhich/issues/487
+    #[cfg(not(test))]
     {
         let running = running.clone();
         ctrlc::set_handler(move || {
```

---

### Incident Patch 5: `5909d45b` (2026-02-10)
**Commit Message**: fix(input): handle Ctrl+C via SIGINT signal instead of keypress

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 ### Fixed
 
+* Fix Ctrl+C handling to use SIGINT signal instead of keypress #491 - @chiranjeevi-max
 * Update CONTRIBUTING information #438 - @YJDoc2 @cyqsimon
 * Fix new clippy lint #457 - @cyqsimon
 * Apply new clippy lints #468 - @cyqsimon
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ chrono = "0.4"
 clap-verbosity-flag = "3.0.3"
 clap = { version = "4.5.41", features = ["derive"] }
 crossterm = "0.29.0"
+ctrlc = "3.4"
 derive_more = { version = "2.0.1", features = ["debug"] }
 eyre = "0.6.12"
 itertools = "0.14.0"
```

**File**: `src/main.rs` (modified, +10/-6)
```diff
@@ -96,6 +96,16 @@ where
     let cumulative_time = Arc::new(RwLock::new(Duration::new(0, 0)));
     let table_cycle_offset = Arc::new(AtomicUsize::new(0));
 
+    // handle SIGINT properly instead of as a keypress
+    // see https://github.com/imsnif/bandwhich/issues/487
+    {
+        let running = running.clone();
+        ctrlc::set_handler(move || {
+            running.store(false, Ordering::Release);
+        })
+        .expect("failed to set SIGINT handler");
+    }
+
     let mut active_threads = vec![];
 
     let terminal_events = os_input.terminal_events;
@@ -192,12 +202,6 @@ where
                             );
                         }
                         Event::Key(KeyEvent {
-                            modifiers: KeyModifiers::CONTROL,
-                            code: KeyCode::Char('c'),
-                            kind: KeyEventKind::Press,
-                            ..
-                        })
-                        | Event::Key(KeyEvent {
                             modifiers: KeyModifiers::NONE,
                             code: KeyCode::Char('q'),
                             kind: KeyEventKind::Press,
```

**File**: `src/tests/cases/test_utils.rs` (modified, +4/-4)
```diff
@@ -25,8 +25,8 @@ use crate::{
 pub fn sleep_and_quit_events(sleep_num: usize) -> Box<TerminalEvents> {
     let events = iter::repeat_n(None, sleep_num)
         .chain([Some(Event::Key(KeyEvent::new(
-            KeyCode::Char('c'),
-            KeyModifiers::CONTROL,
+            KeyCode::Char('q'),
+            KeyModifiers::NONE,
         )))])
         .collect();
     Box::new(TerminalEvents::new(events))
@@ -37,8 +37,8 @@ pub fn sleep_resize_and_quit_events(sleep_num: usize) -> Box<TerminalEvents> {
         .chain([
             Some(Event::Resize(100, 100)),
             Some(Event::Key(KeyEvent::new(
-                KeyCode::Char('c'),
-                KeyModifiers::CONTROL,
+                KeyCode::Char('q'),
+                KeyModifiers::NONE,
             ))),
         ])
         .collect();
```

---

### Incident Patch 6: `5100a46b` (2025-07-10)
**Commit Message**: Merge pull request #468 from imsnif/clippy-fixes

Apply new clippy lints

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 * Update CONTRIBUTING information #438 - @YJDoc2 @cyqsimon
 * Fix new clippy lint #457 - @cyqsimon
+* Apply new clippy lints #468 - @cyqsimon
 
 ### Changed
 
```

**File**: `src/network/sniffer.rs` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@ impl Sniffer {
     }
     pub fn reset_channel(&mut self) -> Result<()> {
         self.network_frames = get_datalink_channel(&self.network_interface)
-            .map_err(|_| io::Error::new(io::ErrorKind::Other, "Interface not available"))?;
+            .map_err(|_| io::Error::other("Interface not available"))?;
         Ok(())
     }
     fn handle_v6(ip_packet: Ipv6Packet, network_interface: &NetworkInterface) -> Option<Segment> {
```

**File**: `src/os/shared.rs` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ fn get_interface(interface_name: &str) -> Option<NetworkInterface> {
 fn create_write_to_stdout() -> Box<dyn FnMut(&str) + Send> {
     let mut stdout = io::stdout();
     Box::new({
-        move |output| match writeln!(stdout, "{}", output) {
+        move |output| match writeln!(stdout, "{output}") {
             Ok(_) => (),
             Err(e) if e.kind() == ErrorKind::BrokenPipe => {
                 // A process that was listening to bandwhich stdout has exited
```

**File**: `src/tests/cases/test_utils.rs` (modified, +1/-1)
```diff
@@ -261,7 +261,7 @@ pub fn os_input_output_factory(
         Some(stdout) => Box::new({
             move |output| {
                 let mut stdout = stdout.lock().unwrap();
-                writeln!(&mut stdout, "{}", output).unwrap();
+                writeln!(&mut stdout, "{output}").unwrap();
             }
         }),
         None => Box::new(|_output| {}),
```

---

### Incident Patch 7: `25f58b0d` (2025-02-04)
**Commit Message**: Fix new clippy lint

**File**: `src/os/shared.rs` (modified, +1/-4)
```diff
@@ -40,10 +40,7 @@ pub struct TerminalEvents;
 impl Iterator for TerminalEvents {
     type Item = Event;
     fn next(&mut self) -> Option<Event> {
-        match read() {
-            Ok(ev) => Some(ev),
-            Err(_) => None,
-        }
+        read().ok()
     }
 }
 
```

---

### Incident Patch 8: `c9ce4d99` (2024-12-03)
**Commit Message**: Bump `pnet` & `packet-builder`

Switched to a branch for `packet-builder` with matching `pnet` version

**File**: `Cargo.lock` (modified, +20/-20)
```diff
@@ -600,13 +600,13 @@ dependencies = [
 
 [[package]]
 name = "derive-new"
-version = "0.5.9"
+version = "0.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3418329ca0ad70234b9735dc4ceed10af4df60eff9c8e7b06cb5e520d92c3535"
+checksum = "2cdc8d50f426189eef89dac62fabfa0abb27d5cc008f25bf4156a0203325becc"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 1.0.109",
+ "syn 2.0.90",
 ]
 
 [[package]]
@@ -1439,7 +1439,7 @@ dependencies = [
 [[package]]
 name = "packet-builder"
 version = "0.7.0"
-source = "git+https://github.com/cyqsimon/packet_builder.git?branch=patch-update#bf5a89ba75795f5067bb03fa8de00b833ffe4eae"
+source = "git+https://github.com/cyqsimon/packet_builder.git?branch=patch-pnet-0.35#9911566055bba746a4d9b8189e3657ac818beb4d"
 dependencies = [
  "derive-new",
  "ipnetwork",
@@ -1518,9 +1518,9 @@ checksum = "953ec861398dccce10c670dfeaf3ec4911ca479e9c02154b3a215178c5f566f2"
 
 [[package]]
 name = "pnet"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "130c5b738eeda2dc5796fe2671e49027e6935e817ab51b930a36ec9e6a206a64"
+checksum = "682396b533413cc2e009fbb48aadf93619a149d3e57defba19ff50ce0201bd0d"
 dependencies = [
  "ipnetwork",
  "pnet_base",
@@ -1532,18 +1532,18 @@ dependencies = [
 
 [[package]]
 name = "pnet_base"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fe4cf6fb3ab38b68d01ab2aea03ed3d1132b4868fa4e06285f29f16da01c5f4c"
+checksum = "ffc190d4067df16af3aba49b3b74c469e611cad6314676eaf1157f31aa0fb2f7"
 dependencies = [
  "no-std-net",
 ]
 
 [[package]]
 name = "pnet_datalink"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ad5854abf0067ebbd3967f7d45ebc8976ff577ff0c7bd101c4973ae3c70f98fe"
+checksum = "e79e70ec0be163102a332e1d2d5586d362ad76b01cec86f830241f2b6452a7b7"
 dependencies = [
  "ipnetwork",
  "libc",
@@ -1554,9 +1554,9 @@ dependencies = [
 
 [[package]]
 name = "pnet_macros"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "688b17499eee04a0408aca0aa5cba5fc86401d7216de8a63fdf7a4c227871804"
+checksum = "13325ac86ee1a80a480b0bc8e3d30c25d133616112bb16e86f712dcf8a71c863"
 dependencies = [
  "proc-macro2",
  "quote",
@@ -1566,18 +1566,18 @@ dependencies = [
 
 [[package]]
 name = "pnet_macros_support"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "eea925b72f4bd37f8eab0f221bbe4c78b63498350c983ffa9dd4bcde7e030f56"
+checksum = "eed67a952585d509dd0003049b1fc56b982ac665c8299b124b90ea2bdb3134ab"
 dependencies = [
  "pnet_base",
 ]
 
 [[package]]
 name = "pnet_packet"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a9a005825396b7fe7a38a8e288dbc342d5034dac80c15212436424fef8ea90ba"
+checksum = "4c96ebadfab635fcc23036ba30a7d33a80c39e8461b8bd7dc7bb186acb96560f"
 dependencies = [
  "glob",
  "pnet_base",
@@ -1587,19 +1587,19 @@ dependencies = [
 
 [[package]]
 name = "pnet_sys"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "417c0becd1b573f6d544f73671070b039051e5ad819cc64aa96377b536128d00"
+checksum = "7d4643d3d4db6b08741050c2f3afa9a892c4244c085a72fcda93c9c2c9a00f4b"
 dependencies = [
  "libc",
  "winapi",
 ]
 
 [[package]]
 name = "pnet_transport"
-version = "0.34.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2637e14d7de974ee2f74393afccbc8704f3e54e6eb31488715e72481d1662cc3"
+checksum = "5f604d98bc2a6591cf719b58d3203fd882bdd6bf1db696c4ac97978e9f4776bf"
 dependencies = [
  "libc",
  "pnet_base",
```

**File**: `Cargo.toml` (modified, +4/-4)
```diff
@@ -36,8 +36,8 @@ ipnetwork = "0.20.0"
 itertools = "0.13.0"
 log = "0.4.22"
 once_cell = "1.20.2"
-pnet = "0.34.0"
-pnet_macros_support = "0.34.0"
+pnet = "0.35.0"
+pnet_macros_support = "0.35.0"
 ratatui = "0.29.0"
 resolv-conf = "0.7.0"
 simplelog = "0.12.2"
@@ -60,8 +60,8 @@ sysinfo = "0.32.1"
 
 [dev-dependencies]
 insta = "1.41.1"
-packet-builder = { version = "0.7.0", git = "https://github.com/cyqsimon/packet_builder.git", branch = "patch-update" }
-pnet_base = "0.34.0"
+packet-builder = { version = "0.7.0", git = "https://github.com/cyqsimon/packet_builder.git", branch = "patch-pnet-0.35" }
+pnet_base = "0.35.0"
 regex = "1.11.1"
 rstest = "0.23.0"
 
```

---

### Incident Patch 9: `5274322b` (2024-12-03)
**Commit Message**: Revert `pnet` bump

**File**: `Cargo.lock` (modified, +19/-110)
```diff
@@ -178,9 +178,9 @@ dependencies = [
  "netstat2",
  "once_cell",
  "packet-builder",
- "pnet 0.35.0",
- "pnet_base 0.35.0",
- "pnet_macros_support 0.35.0",
+ "pnet",
+ "pnet_base",
+ "pnet_macros_support",
  "procfs",
  "ratatui",
  "regex",
@@ -1443,8 +1443,8 @@ source = "git+https://github.com/cyqsimon/packet_builder.git?branch=patch-update
 dependencies = [
  "derive-new",
  "ipnetwork",
- "pnet 0.34.0",
- "pnet_datalink 0.34.0",
+ "pnet",
+ "pnet_datalink",
 ]
 
 [[package]]
@@ -1523,25 +1523,11 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "130c5b738eeda2dc5796fe2671e49027e6935e817ab51b930a36ec9e6a206a64"
 dependencies = [
  "ipnetwork",
- "pnet_base 0.34.0",
- "pnet_datalink 0.34.0",
- "pnet_packet 0.34.0",
- "pnet_sys 0.34.0",
- "pnet_transport 0.34.0",
-]
-
-[[package]]
-name = "pnet"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "682396b533413cc2e009fbb48aadf93619a149d3e57defba19ff50ce0201bd0d"
-dependencies = [
- "ipnetwork",
- "pnet_base 0.35.0",
- "pnet_datalink 0.35.0",
- "pnet_packet 0.35.0",
- "pnet_sys 0.35.0",
- "pnet_transport 0.35.0",
+ "pnet_base",
+ "pnet_datalink",
+ "pnet_packet",
+ "pnet_sys",
+ "pnet_transport",
 ]
 
 [[package]]
@@ -1553,15 +1539,6 @@ dependencies = [
  "no-std-net",
 ]
 
-[[package]]
-name = "pnet_base"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ffc190d4067df16af3aba49b3b74c469e611cad6314676eaf1157f31aa0fb2f7"
-dependencies = [
- "no-std-net",
-]
-
 [[package]]
 name = "pnet_datalink"
 version = "0.34.0"
@@ -1570,21 +1547,8 @@ checksum = "ad5854abf0067ebbd3967f7d45ebc8976ff577ff0c7bd101c4973ae3c70f98fe"
 dependencies = [
  "ipnetwork",
  "libc",
- "pnet_base 0.34.0",
- "pnet_sys 0.34.0",
- "winapi",
-]
-
-[[package]]
-name = "pnet_datalink"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e79e70ec0be163102a332e1d2d5586d362ad76b01cec86f830241f2b6452a7b7"
-dependencies = [
- "ipnetwork",
- "libc",
- "pnet_base 0.35.0",
- "pnet_sys 0.35.0",
+ "pnet_base",
+ "pnet_sys",
  "winapi",
 ]
 
@@ -1600,34 +1564,13 @@ dependencies = [
  "syn 2.0.90",
 ]
 
-[[package]]
-name = "pnet_macros"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "13325ac86ee1a80a480b0bc8e3d30c25d133616112bb16e86f712dcf8a71c863"
-dependencies = [
- "proc-macro2",
- "quote",
- "regex",
- "syn 2.0.90",
-]
-
 [[package]]
 name = "pnet_macros_support"
 version = "0.34.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "eea925b72f4bd37f8eab0f221bbe4c78b63498350c983ffa9dd4bcde7e030f56"
 dependencies = [
- "pnet_base 0.34.0",
-]
-
-[[package]]
-name = "pnet_macros_support"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "eed67a952585d509dd0003049b1fc56b982ac665c8299b124b90ea2bdb3134ab"
-dependencies = [
- "pnet_base 0.35.0",
+ "pnet_base",
 ]
 
 [[package]]
@@ -1637,21 +1580,9 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a9a005825396b7fe7a38a8e288dbc342d5034dac80c15212436424fef8ea90ba"
 dependencies = [
  "glob",
- "pnet_base 0.34.0",
- "pnet_macros 0.34.0",
- "pnet_macros_support 0.34.0",
-]
-
-[[package]]
-name = "pnet_packet"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c96ebadfab635fcc23036ba30a7d33a80c39e8461b8bd7dc7bb186acb96560f"
-dependencies = [
- "glob",
- "pnet_base 0.35.0",
- "pnet_macros 0.35.0",
- "pnet_macros_support 0.35.0",
+ "pnet_base",
+ "pnet_macros",
+ "pnet_macros_support",
 ]
 
 [[package]]
@@ -1664,38 +1595,16 @@ dependencies = [
  "winapi",
 ]
 
-[[package]]
-name = "pnet_sys"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7d4643d3d4db6b08741050c2f3afa9a892c4244c085a72fcda93c9c2c9a00f4b"
-dependencies = [
- "libc",
- "winapi",
-]
-
 [[package]]
 name = "pnet_transport"
 version = "0.34.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2637e14d7de974ee2f74393afccbc8704f3e54e6eb31488715e72481d1662cc3"
 dependencies = [
  "libc",
- "pnet_base 0.34.0",
- "pnet_packet 0.34.0",
- "pnet_sys 0.34.0",
-]
-
-[[package]]
-name = "pnet_transport"
-version = "0.35.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5f604d98bc2a6591cf719b58d3203fd882bdd6bf1db696c4ac97978e9f4776bf"
-dependencies = [
- "libc",
- "pnet_base 0.35.0",
- "pnet_packet 0.35.0",
- "pnet_sys 0.35.0",
+ "pnet_base",
+ "pnet_packet",
+ "pnet_sys",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -36,8 +36,8 @@ ipnetwork = "0.20.0"
 itertools = "0.13.0"
 log = "0.4.22"
 once_cell = "1.20.2"
-pnet = "0.35.0"
-pnet_macros_support = "0.35.0"
+pnet = "0.34.0"
+pnet_macros_support = "0.34.0"
 ratatui = "0.29.0"
 resolv-conf = "0.7.0"
 simplelog = "0.12.2"
@@ -61,7 +61,7 @@ sysinfo = "0.32.1"
 [dev-dependencies]
 insta = "1.41.1"
 packet-builder = { version = "0.7.0", git = "https://github.com/cyqsimon/packet_builder.git", branch = "patch-update" }
-pnet_base = "0.35.0"
+pnet_base = "0.34.0"
 regex = "1.11.1"
 rstest = "0.23.0"
 
```

---

### Incident Patch 10: `de4bdc5a` (2024-10-17)
**Commit Message**: fix order of imports in display_bandwidth

Signed-off-by: Yashodhan Joshi <[REDACTED_EMAIL]>

**File**: `src/display/components/display_bandwidth.rs` (modified, +4/-2)
```diff
@@ -1,7 +1,9 @@
-use crate::cli::UnitFamily;
-use derive_more::Debug;
 use std::fmt;
 
+use derive_more::Debug;
+
+use crate::cli::UnitFamily;
+
 #[derive(Copy, Clone, Debug)]
 pub struct DisplayBandwidth {
     // Custom format for reduced precision.
```

---

### Incident Patch 11: `2193cf93` (2024-01-30)
**Commit Message**: Rename `ui_offset` -> `table_cycle_offset`

**File**: `src/display/components/layout.rs` (modified, +5/-2)
```diff
@@ -99,12 +99,15 @@ impl Layout<'_> {
         }
     }
 
-    pub fn render(&self, frame: &mut Frame, rect: Rect, ui_offset: usize) {
+    pub fn render(&self, frame: &mut Frame, rect: Rect, table_cycle_offset: usize) {
         let (top, app, bottom) = top_app_and_bottom_split(rect);
         let layout_slots = self.build_layout(app);
         for i in 0..layout_slots.len() {
             if let Some(rect) = layout_slots.get(i) {
-                if let Some(child) = self.children.get((i + ui_offset) % self.children.len()) {
+                if let Some(child) = self
+                    .children
+                    .get((i + table_cycle_offset) % self.children.len())
+                {
                     child.render(frame, *rect);
                 }
             }
```

**File**: `src/display/ui.rs` (modified, +2/-2)
```diff
@@ -127,7 +127,7 @@ where
         write_to_stdout("");
     }
 
-    pub fn draw(&mut self, paused: bool, elapsed_time: Duration, ui_offset: usize) {
+    pub fn draw(&mut self, paused: bool, elapsed_time: Duration, table_cycle_offset: usize) {
         let layout = Layout {
             header: HeaderDetails {
                 state: &self.state,
@@ -141,7 +141,7 @@ where
             },
         };
         self.terminal
-            .draw(|frame| layout.render(frame, frame.area(), ui_offset))
+            .draw(|frame| layout.render(frame, frame.area(), table_cycle_offset))
             .unwrap();
     }
 
```

**File**: `src/main.rs` (modified, +7/-7)
```diff
@@ -93,7 +93,7 @@ where
     let paused = Arc::new(AtomicBool::new(false));
     let last_start_time = Arc::new(RwLock::new(Instant::now()));
     let cumulative_time = Arc::new(RwLock::new(Duration::new(0, 0)));
-    let ui_offset = Arc::new(AtomicUsize::new(0));
+    let table_cycle_offset = Arc::new(AtomicUsize::new(0));
 
     let mut active_threads = vec![];
 
@@ -112,7 +112,7 @@ where
         .spawn({
             let running = running.clone();
             let paused = paused.clone();
-            let ui_offset = ui_offset.clone();
+            let table_cycle_offset = table_cycle_offset.clone();
 
             let network_utilization = network_utilization.clone();
             let last_start_time = last_start_time.clone();
@@ -138,7 +138,7 @@ where
                     {
                         let mut ui = ui.lock().unwrap();
                         let paused = paused.load(Ordering::SeqCst);
-                        let ui_offset = ui_offset.load(Ordering::SeqCst);
+                        let table_cycle_offset = table_cycle_offset.load(Ordering::SeqCst);
                         if !paused {
                             ui.update_state(sockets_to_procs, utilization, ip_to_host);
                         }
@@ -151,7 +151,7 @@ where
                         if raw_mode {
                             ui.output_text(&mut write_to_stdout);
                         } else {
-                            ui.draw(paused, elapsed_time, ui_offset);
+                            ui.draw(paused, elapsed_time, table_cycle_offset);
                         }
                     }
                     let render_duration = render_start_time.elapsed();
@@ -187,7 +187,7 @@ where
                                     *cumulative_time.read().unwrap(),
                                     paused,
                                 ),
-                                ui_offset.load(Ordering::SeqCst),
+                                table_cycle_offset.load(Ordering::SeqCst),
                             );
                         }
                         Event::Key(KeyEvent {
@@ -248,8 +248,8 @@ where
                                 paused,
                             );
                             let table_count = ui.get_table_count();
-                            let new = ui_offset.load(Ordering::SeqCst) + 1 % table_count;
-                            ui_offset.store(new, Ordering::SeqCst);
+                            let new = table_cycle_offset.load(Ordering::SeqCst) + 1 % table_count;
+                            table_cycle_offset.store(new, Ordering::SeqCst);
                             ui.draw(paused, elapsed_time, new);
                         }
                         _ => (),
```

---

### Incident Patch 12: `dfd9d93e` (2024-01-30)
**Commit Message**: Move `show_dns` into `UIState`

- Plus some variable naming cleanup

**File**: `src/display/ui.rs` (modified, +6/-2)
```diff
@@ -36,6 +36,7 @@ where
             state.interface_name.clone_from(&opts.interface);
             state.unit_family = opts.render_opts.unit_family.into();
             state.cumulative_mode = opts.render_opts.total_utilization;
+            state.show_dns = opts.show_dns;
             state
         };
         Ui {
@@ -126,15 +127,18 @@ where
         write_to_stdout("");
     }
 
-    pub fn draw(&mut self, paused: bool, show_dns: bool, elapsed_time: Duration, ui_offset: usize) {
+    pub fn draw(&mut self, paused: bool, elapsed_time: Duration, ui_offset: usize) {
         let layout = Layout {
             header: HeaderDetails {
                 state: &self.state,
                 elapsed_time,
                 paused,
             },
             children: self.get_tables_to_display(),
-            footer: HelpText { paused, show_dns },
+            footer: HelpText {
+                paused,
+                show_dns: self.state.show_dns,
+            },
         };
         self.terminal
             .draw(|frame| layout.render(frame, frame.area(), ui_offset))
```

**File**: `src/display/ui_state.rs` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ pub struct UIState {
     pub total_bytes_downloaded: u128,
     pub total_bytes_uploaded: u128,
     pub cumulative_mode: bool,
+    pub show_dns: bool,
     pub unit_family: BandwidthUnitFamily,
     pub utilization_data: VecDeque<UtilizationData>,
     pub processes_map: HashMap<ProcessInfo, NetworkData>,
```

**File**: `src/main.rs` (modified, +2/-4)
```diff
@@ -94,7 +94,6 @@ where
     let last_start_time = Arc::new(RwLock::new(Instant::now()));
     let cumulative_time = Arc::new(RwLock::new(Duration::new(0, 0)));
     let ui_offset = Arc::new(AtomicUsize::new(0));
-    let dns_shown = opts.show_dns;
 
     let mut active_threads = vec![];
 
@@ -152,7 +151,7 @@ where
                         if raw_mode {
                             ui.output_text(&mut write_to_stdout);
                         } else {
-                            ui.draw(paused, dns_shown, elapsed_time, ui_offset);
+                            ui.draw(paused, elapsed_time, ui_offset);
                         }
                     }
                     let render_duration = render_start_time.elapsed();
@@ -183,7 +182,6 @@ where
                             let paused = paused.load(Ordering::SeqCst);
                             ui.draw(
                                 paused,
-                                dns_shown,
                                 elapsed_time(
                                     *last_start_time.read().unwrap(),
                                     *cumulative_time.read().unwrap(),
@@ -252,7 +250,7 @@ where
                             let table_count = ui.get_table_count();
                             let new = ui_offset.load(Ordering::SeqCst) + 1 % table_count;
                             ui_offset.store(new, Ordering::SeqCst);
-                            ui.draw(paused, dns_shown, elapsed_time, new);
+                            ui.draw(paused, elapsed_time, new);
                         }
                         _ => (),
                     };
```

**File**: `src/network/sniffer.rs` (modified, +5/-5)
```diff
@@ -93,19 +93,19 @@ macro_rules! extract_transport_protocol {
 pub struct Sniffer {
     network_interface: NetworkInterface,
     network_frames: Box<dyn DataLinkReceiver>,
-    dns_shown: bool,
+    show_dns: bool,
 }
 
 impl Sniffer {
     pub fn new(
         network_interface: NetworkInterface,
         network_frames: Box<dyn DataLinkReceiver>,
-        dns_shown: bool,
+        show_dns: bool,
     ) -> Self {
         Sniffer {
             network_interface,
             network_frames,
-            dns_shown,
+            show_dns,
         }
     }
     pub fn next(&mut self) -> Option<Segment> {
@@ -138,7 +138,7 @@ impl Sniffer {
         let version = ip_packet.get_version();
 
         match version {
-            4 => Self::handle_v4(ip_packet, &self.network_interface, self.dns_shown),
+            4 => Self::handle_v4(ip_packet, &self.network_interface, self.show_dns),
             6 => Self::handle_v6(
                 Ipv6Packet::new(&bytes[payload_offset..])?,
                 &self.network_interface,
@@ -149,7 +149,7 @@ impl Sniffer {
                     EtherTypes::Ipv4 => Self::handle_v4(
                         Ipv4Packet::new(pkg.payload())?,
                         &self.network_interface,
-                        self.dns_shown,
+                        self.show_dns,
                     ),
                     EtherTypes::Ipv6 => {
                         Self::handle_v6(Ipv6Packet::new(pkg.payload())?, &self.network_interface)
```

---

### Incident Patch 13: `cd81be8c` (2024-10-09)
**Commit Message**: Fix changelog

- 0.23.1 section added retroactively
- Incorrect title levels fixed

**File**: `CHANGELOG.md` (modified, +13/-11)
```diff
@@ -6,20 +6,22 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 ## [Unreleased]
 
+### Changed
+
+* Add build optimizations for release binary #434 - @pando85
+
+## [0.23.1] - 2024-10-09
+
 ### Fixed
 
 * CI: Use Powershell Compress-Archive to create Windows binary zip #424 - @cyqsimon
 * Exit gracefully when there is a broken pipe error #429 - @sigmaSd
 * Fix breaking changes of sysinfo crate #431 - @cyqsimon
 * Fix `clippy::needless_lifetimes` warnings on nightly #432 - @cyqsimon
 
-### Changed
-
-* Add build optimizations for release binary #434 - @pando85
-
 ## [0.23.0] - 2024-08-17
 
-## Fixed
+### Fixed
 
 * Remove redundant imports #377 - @cyqsimon
 * CI: use GitHub API to exempt dependabot from changelog requirement #378 - @cyqsimon
@@ -29,7 +31,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 * Support build for `target_os` `android` #384 - @flxo
 * Fix Windows FP discrepancy issue in test #400 - @cyqsimon
 
-## Added
+### Added
 
 * CI: include generated assets in release archive #359 - @cyqsimon
 * Add PID column to the process table #379 - @notjedi
@@ -38,7 +40,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 * CI: Enable more cross-compiled builds #401 - @cyqsimon
 * CI: use sccache to speed up CI #408 - @cyqsimon
 
-## Changed
+### Changed
 
 * CI: strip release binaries for all targets #358 - @cyqsimon
 * Bump MSRV to 1.74 (required by clap 4.5; see #373)
@@ -48,19 +50,19 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 * Update README #407 - @cyqsimon
 * Update usage in README #409 - @cyqsimon
 
-## Removed
+### Removed
 
 * CI: Remove musl-tools install step #402 - @cyqsimon
 
 ## [0.22.2] - 2024-01-28
 
-## Added
+### Added
 
 * Generate completion & manpage #357 - @cyqsimon
 
 ## [0.22.1] - 2024-01-28
 
-## Fixed
+### Fixed
 
 * Hot fix a Windows compile issue #356 - @cyqsimon
 
@@ -78,7 +80,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 * Table formatting logic overhaul #305 - @cyqsimon
 * Refactor OsInputOutput (combine interfaces & frames into single Vec) #310 - @cyqsimon
 
-## Removed
+### Removed
 
 * Reorganise & cleanup packaging code/resources #329 - @cyqsimon
 
```

---

### Incident Patch 14: `8f3a8cfc` (2024-10-08)
**Commit Message**: Add build optimizations for release binary (#434)

* Add build optimizations for release binary

* Put changelog entry in `Changed` section

---------

Co-authored-by: cyqsimon <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 * Fix breaking changes of sysinfo crate #431 - @cyqsimon
 * Fix `clippy::needless_lifetimes` warnings on nightly #432 - @cyqsimon
 
+### Changed
+
+* Add build optimizations for release binary #434 - @pando85
+
 ## [0.23.0] - 2024-08-17
 
 ## Fixed
```

**File**: `Cargo.toml` (modified, +7/-0)
```diff
@@ -77,3 +77,10 @@ strum = { version = "0.26.3", features = ["derive"] }
 [target.'cfg(target_os = "windows")'.build-dependencies]
 http_req = "0.12.0"
 zip = "2.2.0"
+
+[profile.release]
+codegen-units = 1
+opt-level = 3
+lto = "fat"
+panic = "abort"
+strip = "symbols"
```

---

### Incident Patch 15: `75122fa6` (2024-10-08)
**Commit Message**: Fix `clippy::needless_lifetimes` warnings on nightly

The warnings in `derivative`'s derived code are not something we can fix.

**File**: `src/display/components/header_details.rs` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ pub struct HeaderDetails<'a> {
     pub paused: bool,
 }
 
-impl<'a> HeaderDetails<'a> {
+impl HeaderDetails<'_> {
     pub fn render(&self, frame: &mut Frame, rect: Rect) {
         let bandwidth = self.bandwidth_string();
         let color = if self.paused {
```

**File**: `src/display/components/layout.rs` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ pub struct Layout<'a> {
     pub footer: HelpText,
 }
 
-impl<'a> Layout<'a> {
+impl Layout<'_> {
     fn progressive_split(&self, rect: Rect, splits: Vec<Direction>) -> Vec<Rect> {
         splits
             .into_iter()
```

#### Recent Merged Pull Requests:
- **PR #519** (closed): chore(deps): bump the dependencies group across 1 directory with 9 updates (@dependabot[bot])
- **PR #518** (closed): chore(deps): bump actions/checkout from 6 to 7 in the github-actions group (@dependabot[bot])
- **PR #517** (closed): chore(deps): bump the dependencies group with 3 updates (@dependabot[bot])
- **PR #512** (2026-05-14): Deps: remove direct dependency on async-trait (@cyqsimon)
- **PR #511** (2026-05-14): Fix clippy nightly lints (@cyqsimon)
- **PR #510** (2026-05-14): Deps: migrate from trust-dns-resolver to hickory-resolver (@cyqsimon)
- **PR #509** (2026-05-14): chore(deps): bump the dependencies group across 1 directory with 5 updates (@dependabot[bot])
- **PR #503** (closed): chore(deps): bump openssl from 0.10.78 to 0.10.79 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
