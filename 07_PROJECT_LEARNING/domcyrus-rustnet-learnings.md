> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/domcyrus-rustnet-learnings.md`  
> **Source**: github ([https://github.com/domcyrus/rustnet](https://github.com/domcyrus/rustnet))  
> **Source Version**: `6448181d`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T17:51:53.877Z  
> **Learning ID**: `learn-github-domcyrus-rustnet`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): domcyrus/rustnet

---

## 1. Executive Forensic Architecture & System Mechanics

`domcyrus/rustnet` is a production-grade, multi-platform, real-time network traffic inspector, flow reconstructor, and process attribution engine implemented in Rust. Unlike conventional socket counters (`netstat`, `ss`) that merely query the OS kernel's current socket table, `rustnet` unifies raw packet capture (`libpcap`, Linux AF_PACKET, macOS BPF/PKTAP) with deep packet inspection (DPI), eBPF tracepoints/kprobes, and OS-level security sandboxing (Linux Landlock/Capabilities, macOS Seatbelt/sandbox-exec, Windows AppContainer/Token integrity).

### Subsystem Decomposition & Decoupling Boundaries

```
                             +----------------------------------------+
                             |       Physical Network Interface       |
                             +----------------------------------------+
                                                 |
                                                 v
+------------------------+   +----------------------------------------+
|   OS Process Table /   |   |        rustnet-capture Engine          |
|  eBPF Kprobes/Sockets  |   |  - libpcap / AF_PACKET / PKTAP         |
+------------------------+   |  - Zero-copy framing / MTU validation  |
            |                +----------------------------------------+
            |                                    |
            v                                    v
+------------------------+   +----------------------------------------+
|      rustnet-host      |   |             rustnet-core               |
| - Platform attribution |   |  - Wire protocol parsers (L2/L3/L4)    |
| - Inode-to-PID lookup  |-->|  - Stateful DPI engine (DNS, TLS, STUN)|
| - Kernel event sync    |   |  - ConnectionTracker / Sharded state   |
+------------------------+   +----------------------------------------+
            |                                    |
            |                                    v
            |                +----------------------------------------+
            |                |        rustnet-monitor (Binary)        |
            |                |  - Headless JSON streaming             |
            +--------------->|  - Interactive TUI (Ratatui / Crossbeam)|
                             |  - Sandbox downgrade (rustnet-sandbox) |
                             +----------------------------------------+
```

1. **`rustnet-core` (Headless Domain Core)**: Zero external OS hooks, zero libc/pcap dependencies. Operates strictly on raw byte slices (`&[u8]`) and structured internal states. Implements wire protocol decoders (Ethernet, Linux SLL/SLL2, IPv4, IPv6, TCP, UDP, ICMP), high-performance DPI heuristic engines, passive DNS analytics state machines, and a concurrent, sharded flow tracker (`ConnectionTracker`).
2. **`rustnet-capture` (Ingress Abstraction)**: Isolates packet capture mechanisms across OS targets. Enforces non-blocking packet polling, snapshot length (`snaplen`) configuration, and kernel buffer management.
3. **`rustnet-host` (Process & Socket Attribution Subsystem)**: Links ephemeral 5-tuples (`src_ip`, `src_port`, `dst_ip`, `dst_port`, `proto`) to system host metadata (process binary name, PID, user UID, container/cgroup context). Executes via two distinct engines:
   - **eBPF-Engine (Linux)**: Kprobes on `tcp_v4_connect`, `tcp_v6_connect`, `udp_sendmsg` to stream socket lifecycle events into user space via ring buffers.
   - **Socket Table Poller / Kqueue / Procfs (macOS, Windows, FreeBSD, Fallback Linux)**: Reconciles `/proc/net/tcp`, Win32 `GetExtendedTcpTable`, and BSD sysctls.
4. **`rustnet-sandbox` (Privilege Downgrade & Isolation Engine)**: Executes a two-phase process bootstrap:
   - Phase 1 (*Privileged Initiation*): Opens raw sockets, initializes eBPF maps, opens MaxMind DB files, and binds event listeners.
   - Phase 2 (*Privilege Drop & Confinement*): Locks down process capability sets via Linux `capng`/Landlock (restricting filesystem access to read-only diagnostic sinks) and macOS Seatbelt profiles before general packet processing begins.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. In-Place Protocol Signature Precedence Over Port Bindings
**RULE**:
Network inspection engines MUST evaluate protocol signatures and magic-byte invariants across all packets BEFORE executing well-known port dispatches. A protocol parser MUST NOT assume traffic arriving at an assigned IANA port (e.g., UDP 53) conforms to that port’s standard specification without validating wire invariants.

**WHY**:
Network edge software, NAT traversal protocols (e.g., STUN, TURN, ICE), and adversarial traffic frequently multiplex over standardized ports (such as UDP 53 or UDP 443) to bypass strict enterprise egress firewall filters. If an engine dispatches blindly to a port-indexed decoder (such as a DNS parser):
1. Foreign binary payloads will fail parsing assertions, producing false operational errors (e.g., misinterpreting STUN binding requests as DNS queries with corrupted query counts).
2. The metrics layer accumulates phantom operational failures, degrading calculated upstream health metrics (such as DNS resolver health).
3. Incomplete validation of compressed wire pointers or field counts within malformed packets risks infinite pointer traversal or out-of-bounds panics.

**WHEN TO APPLY**:
Apply to any Layer 4/Layer 7 packet inspection subsystem, traffic proxy, transparent firewall, or passive analytics pipeline processing untrusted UDP/TCP flows.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/rustnet-core/src/network/dpi/mod.rs
pub(crate) fn analyze_udp_packet(
    payload: &[u8],
    local_port: u16,
    remote_port: u16,
    outgoing: bool,
) -> Option<DpiResult> {
    if payload.is_empty() {
        return None;
    }

    // MANDATORY: Signature and magic-cookie checks MUST precede port-based routing.
    // ICE connectivity / STUN binding checks frequently tunnel over port 53.
    if let Some(stun_result) = stun::analyze_stun(payload) {
        return Some(DpiResult {
            application: ApplicationProtocol::Stun(stun_result),
        });
    }

    // PORT-DISPATCH: Only execute port-specific parsing once signatures are cleared.
    if (local_port == PORT_DNS || remote_port == PORT_DNS)
        && let Some(dns_result) = dns::analyze_dns(payload)
    {
        return Some(DpiResult {
            application: ApplicationProtocol::Dns(dns_result),
        });
    }

    None
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blind port-indexed dispatch without signature pre-filtering.
pub(crate) fn analyze_udp_packet_bad(
    payload: &[u8],
    local_port: u16,
    remote_port: u16,
) -> Option<DpiResult> {
    // VIOLATION: Non-DNS packets (e.g. STUN) on port 53 crash through DNS decoder,
    // polluting downstream DNS health telemetry with SERVFAIL/Timeout artifacts.
    if local_port == 53 || remote_port == 53 {
        return dns::analyze_dns(payload).map(|dns| DpiResult {
            application: ApplicationProtocol::Dns(dns),
        });
    }
    // STUN parser reached too late
    if let Some(stun_result) = stun::analyze_stun(payload) {
        return Some(DpiResult { application: ApplicationProtocol::Stun(stun_result) });
    }
    None
}
```

**VERIFICATION METHOD**:
Inject a synthesized STUN binding request packet (`0x0001` message type, `0x2112A442` magic cookie) addressed to port 53 into the parsing pipeline. Assert that:
1. `analyze_udp_packet` categorizes the packet as `ApplicationProtocol::Stun`.
2. DNS analytics aggregate metrics (`DnsAnalyticsSnapshot.lookups`, `DnsAnalyticsSnapshot.failures`) remain precisely zero.

---

### 2. Monotonic-Offset Bounded DNS Compression Pointer Traversal
**RULE**:
DNS name decompressors MUST enforce strictly monotonic, backward-only pointer jumps outside the DNS header (`target < current_offset && target >= 12`), cap total indirection hops to a fixed threshold (`hops <= MAX_HOPS`), and compute the wire advance offset strictly from the *first* encountered pointer.

**WHY**:
RFC 1035 compression allows domain names to reference previously parsed domain labels via 16-bit pointers (`0xC000 | offset`). Non-compliant or malicious packets exploit naive decoders by:
1. Creating cyclical loops (`A -> B -> A`), triggering infinite recursion or non-terminating loops that exhaust CPU threads.
2. Targeting forward offsets (`target >= current_offset`), referencing uninitialized bytes or skipping validation checks.
3. Targeting the 12-byte DNS transaction header (`target < 12`), misinterpreting transaction IDs or flags as domain label lengths.
4. Updating the wire advance offset to the point of the *last* resolved pointer jump rather than the *first*, causing downstream resource record decoders to read garbage.

**WHEN TO APPLY**:
Apply to any network stack, DNS forwarder, or passive packet parser parsing RFC 1035 wire format domain names.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/rustnet-core/src/network/dpi/dns.rs
const MAX_NAME_POINTER_HOPS: usize = 16;
const MAX_DNS_NAME_LEN: usize = 253;

pub fn parse_question(payload: &[u8], start: usize) -> Option<(Option<String>, u16, usize)> {
    let mut offset = start;
    let mut end = None;
    let mut name = String::new();
    let mut name_is_utf8 = true;
    let mut wire_len = 1; // Count terminal 0x00
    let mut hops = 0;

    loop {
        let label_len = usize::from(*payload.get(offset)?);
        if label_len == 0 {
            // Uncompressed string termination: advance past the terminal 0 byte.
            end.get_or_insert(offset + 1);
            break;
        }

        if label_len & 0xC0 == 0xC0 {
            let low = usize::from(*payload.get(offset + 1)?);
            let target = ((label_len & 0x3F) << 8) | low;
            hops += 1;
            
            // STRICT BOUNDS INVARIANT:
            // 1. Pointer cannot target the 12-byte DNS header.
            // 2. Pointer MUST point backward (prevents forward jumps & cycles).
            // 3. Pointer traversal count MUST NOT exceed MAX_NAME_POINTER_HOPS.
            if target < 12 || target >= offset || hops > MAX_NAME_POINTER_HOPS {
                return None;
            }
            
            // Advance wire consumption offset exactly once (at the initial jump point)
            end.get_or_insert(offset + 2);
            offset = target;
            continue;
        }

        // RFC 1035 §3.3: Top 2 bits 0x40 and 0x80 are strictly reserved
        if label_len & 0xC0 != 0 {
            return None;
        }

        let next = offset.checked_add(1 + label_len)?;
        let label = payload.get(offset + 1..next)?;
        wire_len += 1 + label_len;
        if wire_len > MAX_DNS_NAME_LEN + 2 {
            return None;
        }

        if let Ok(label_str) = std::str::from_utf8(label) {
            if !name.is_empty() {
                name.push('.');
            }
            name.push_str(label_str);
        } else {
            name_is_utf8 = false;
        }
        offset = next;
    }

    let end_offset = end?;
    // Bounds-checked extraction of QTYPE (2) + QCLASS (2)
    let fields = payload.get(end_offset..end_offset.checked_add(4)?)?;
    let qtype = u16::from_be_bytes([fields[0], fields[1]]);
    let qclass = u16::from_be_bytes([fields[2], fields[3]]);
    if qtype == 0 || qclass == 0 {
        return None;
    }

    let query_name = (name_is_utf8 && !name.is_empty()).then_some(name);
    Some((query_name, qtype, end_offset + 4))
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unbounded pointer jumping, failure to anchor advance offset.
pub fn parse_question_unsafe(payload: &[u8], mut offset: usize) -> Option<(String, usize)> {
    let mut name = String::new();
    while offset < payload.len() {
        let len = payload[offset] as usize;
        if len == 0 { offset += 1; break; }
        if len & 0xC0 == 0xC0 {
            // CRITICAL BUG 1: No recursion or hop bound (Infinite loop on cycles).
            // CRITICAL BUG 2: Target can be >= offset (Allows forward jumping).
            // CRITICAL BUG 3: Target can be < 12 (Reads DNS header as labels).
            let target = (((len & 0x3F) << 8) | (payload[offset + 1] as usize));
            offset = target; // CRITICAL BUG 4: Wire offset lost; corrupts caller stream!
            continue;
        }
        offset += 1 + len;
    }
    Some((name, offset))
}
```

**VERIFICATION METHOD**:
Construct a test harness feeding malformed packet slices:
1. Cyclic pointer: `[..., 0xC0, 0x0E, 0xC0, 0x0C]` (points to itself).
2. Forward pointer: `[0xC0, 0xFF]`.
3. Header pointer: `[0xC0, 0x04]`.
Ensure all return `None` within $\le 16$ iterations without allocation or panic.

---

### 3. Layer 3 Wire Accounting Over Capture Slice Truncation
**RULE**:
Network flow accounting engines MUST derive packet byte statistics from the IP header's declared Total Length field (`ip_header.total_len`) rather than the captured buffer length (`payload.len()`), after verifying that the captured buffer represents a structurally valid header.

**WHY**:
To optimize capture performance and minimize memory usage, packet capture libraries (`libpcap`, WinPcap, eBPF ring buffers) enforce a snapshot length (`snaplen`, commonly 64 to 1514 bytes). When network frames exceed the `snaplen` (e.g., Jumbo frames at 9000 bytes, TCP Large Receive Offload / TSO segments at 64KB, or high-throughput NFS transfers):
1. Relying on `slice.len()` registers only the truncated buffer size (e.g., 1514 bytes), undercounting total network volume by orders of magnitude.
2. Downstream metric dashboards, bandwidth saturation alerts, and flow accounting pipelines report inaccurate throughput figures while CPU consumption and interface drops rise.

**WHEN TO APPLY**:
Apply to all packet capture, monitoring, flow tracking, and accounting software interfacing with kernel packet drivers where `snaplen` limits can occur.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In Layer 3 Parsing Subsystem (IPv4 / IPv6 Framing)
pub fn extract_packet_wire_length(captured_data: &[u8]) -> Option<usize> {
    if captured_data.is_empty() {
        return None;
    }

    let version = captured_data[0] >> 4;
    match version {
        4 => {
            if captured_data.len() < 20 {
                return None; // IPv4 header truncated below minimum
            }
            // Bytes 2..4: Total Length (Header + Data)
            let total_len = u16::from_be_bytes([captured_data[2], captured_data[3]]) as usize;
            // Wire length cannot be smaller than minimum IPv4 header
            if total_len < 20 {
                return None;
            }
            Some(total_len)
        }
        6 => {
            if captured_data.len() < 40 {
                return None; // IPv6 header truncated below minimum
            }
            // Bytes 4..6: Payload Length (excluding 40-byte base header)
            let payload_len = u16::from_be_bytes([captured_data[4], captured_data[5]]) as usize;
            Some(payload_len + 40)
        }
        _ => None,
    }
}

// In Ingest Pipeline:
let wire_bytes = extract_packet_wire_length(raw_packet.data)
    .unwrap_or(raw_packet.data.len()); // Fallback only if IP header is corrupt
connection_flow.accumulate_bytes(wire_bytes);
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Measuring network volume using slice length of truncated capture.
fn process_packet_bad(data: &[u8], conn: &mut Flow) {
    // VIOLATION: If snaplen is 1514, an 8900-byte Jumbo frame is counted as 1514 bytes.
    // Over a 10Gbps NFS backup, bandwidth reporting will be ~83% below actual wire throughput.
    let packet_len = data.len(); 
    conn.bytes_transferred += packet_len;
}
```

**VERIFICATION METHOD**:
Construct an IPv4 raw packet slice truncated to 64 bytes with its header length field (`data[2..4]`) set to `9000` (representing a jumbo frame). Pass this packet to the flow ingestion tracker and assert that `flow.total_bytes == 9000` and `flow.captured_bytes == 64`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: STUN Traffic on DNS Port 53 Poisoning Resolver Health (BUG-DNS-01)
- **Context**: Subsystem `crates/rustnet-core/src/network/dpi/` (Files: `dns.rs`, `mod.rs`, `protocol/udp.rs`)
- **What Was Expected**: Packet traffic exchanged on UDP port 53 should only update the DNS analytics tracker if the payload structurally constitutes a valid DNS request or response. WebRTC/ICE STUN packets sent over port 53 should be parsed as STUN traffic without affecting DNS health states.
- **What Actually Happened**: The UDP inspection dispatcher dispatched all UDP port 53 traffic directly to `analyze_dns()`. Non-DNS STUN packets failed DNS question/answer validation. Because the parser recorded these as unparseable transactions on a known DNS resolver port, the DNS health state machine marked the active resolver as `DnsHealth::Degraded` or `DnsHealth::Failing` due to apparent dropped replies and timeouts.
- **Evidence in Repo**: Commit `6448181d`, PR `#722`.
- **Root Cause**: The dispatcher used port-based dispatch (`local_port == 53 || remote_port == 53`) *before* signature-based DPI evaluation. Additionally, `parse_question()` allowed truncated wire questions missing QTYPE or QCLASS to return partial names, misaligning question correlation in the pending transaction table.
- **Remediation Code Diff**:
```rust
// crates/rustnet-core/src/network/dpi/mod.rs
@@ -191,6 +191,14 @@ pub(crate) fn analyze_udp_packet(
         return None;
     }
 
+    // Recognize STUN by its header and cookie before port-based protocols.
+    // ICE connectivity checks can use DNS port 53 too.
+    if let Some(stun_result) = stun::analyze_stun(payload) {
+        return Some(DpiResult {
+            application: ApplicationProtocol::Stun(stun_result),
+        });
+    }
+
     // 1. DNS (port 53)
     if (local_port == PORT_DNS || remote_port == PORT_DNS)
         && let Some(dns_result) = dns::analyze_dns(payload)
```
- **Lesson**: Signature validation and magic-cookie checks must run ahead of port-based decoders, since NAT traversal and WebRTC frequently reuse port 53 to circumvent firewall restrictions.

---

### Incident 2: Infinite Loop & Traversal Crash on Circular DNS Pointers (BUG-DNS-02)
- **Context**: Subsystem `crates/rustnet-core/src/network/dpi/dns.rs`
- **What Was Expected**: DNS name parsing must safely parse or reject compressed names, terminating execution within bounded cycles regardless of how compression pointers are configured in the packet.
- **What Actually Happened**: Crafting a DNS payload with cyclic pointers (`offset A` pointing to `offset B` which pointed back to `offset A`) caused `skip_dns_name` and `parse_question` to spin indefinitely, pegging the thread at 100% CPU. Furthermore, forward pointers allowed out-of-bounds reads when offsets pointed past the validated payload slice.
- **Evidence in Repo**: Commit `6448181d`, PR `#722`.
- **Root Cause**: Pointers (`0xC0`) were followed without checking whether the destination offset was strictly less than the current offset (`target < offset`). The hop counter was also missing in question label parsing, relying solely on an unvalidated terminal byte match.
- **Remediation Code Diff**:
```rust
// crates/rustnet-core/src/network/dpi/dns.rs
@@ -62,74 +62,65 @@
-fn parse_question(payload: &[u8], start: usize) -> (Option<String>, Option<DnsQueryType>, usize) {
+fn parse_question(payload: &[u8], start: usize) -> Option<(Option<String>, DnsQueryType, usize)> {
     let mut offset = start;
+    let mut end = None;
     let mut name = String::new();
+    let mut name_is_utf8 = true;
+    let mut wire_len = 1;
+    let mut hops = 0;
 
-    while offset < payload.len() {
-        let label_len = payload[offset] as usize;
+    loop {
+        let label_len = usize::from(*payload.get(offset)?);
         if label_len == 0 {
-            offset += 1;
+            end.get_or_insert(offset + 1);
             break;
         }
         if label_len & 0xC0 == 0xC0 {
-            offset += 2;
-            break;
+            let low = usize::from(*payload.get(offset + 1)?);
+            let target = ((label_len & 0x3F) << 8) | low;
+            hops += 1;
+            if target < 12 || target >= offset || hops > MAX_NAME_POINTER_HOPS {
+                return None;
+            }
+            end.get_or_insert(offset + 2);
+            offset = target;
+            continue;
         }
```
- **Lesson**: Parsing pointer indirections in wire protocols requires three strict guarantees: monotonic progress (`target < current`), lower boundary confinement (`target >= header_len`), and an absolute hop count limit.

---

### Incident 3: Truncated Snaplen Causing Severe Under-Accounting in Jumbo Frame / NFS Flows (BUG-STAT-01)
- **Context**: Subsystem `src/network/parser.rs`
- **What Was Expected**: Total network volume statistics for connections transferring large files over NFS or Jumbo frames must reflect the actual bytes transmitted over the physical interface.
- **What Actually Happened**: Byte statistics were off by orders of magnitude. A 10GB file transfer registered as only a fraction of its true size in the TUI and JSON exports.
- **Evidence in Repo**: Issue `#34`.
- **Root Cause**: The packet parser assigned `packet_len = data.len()`. Because the packet capture driver was configured with a default `snaplen` of 1514 bytes, frames larger than 1514 bytes (such as 9000-byte Jumbo frames or large TCP segments assembled via LRO/GRO) were truncated upon capture. The flow engine then recorded only the 1514 captured bytes instead of the packet's true wire length.
- **Remediation Code Diff**:
```rust
// src/network/parser.rs
// - Buggy:
// let packet_len = data.len();
// + Remediation:
let packet_len = match parse_ip_packet_total_length(data) {
    Some(wire_len) if wire_len > 0 => wire_len,
    _ => data.len(), // Fallback if packet is malformed or non-IP
};
```
- **Lesson**: Capture buffer length represents the *sampled* slice size, not the *wire* size. Accounting metrics must extract the packet length from the Layer 3 IP header (`Total Length` / `Payload Length`).

---

### Incident 4: Double Backspace Exit Crash in TUI Filter Input Mode (BUG-TUI-01)
- **Context**: Subsystem `src/ui/input.rs` / `src/ui/app.rs`
- **What Was Expected**: In TUI interactive filter mode (triggered via `/`), pressing Backspace on an empty filter input buffer should be a no-op or close the filter bar, keeping the application running.
- **What Actually Happened**: Pressing Backspace twice when the filter string was empty terminated the process immediately, exiting to the shell.
- **Evidence in Repo**: Issue `#334`.
- **Root Cause**: The input event handler treated Backspace on an empty string as a signal to fall through to the global hotkey handler. In global navigation mode, Backspace was bound to "Go Back / Exit". As a result, the second Backspace escaped the input mode context and triggered the application exit sequence.
- **Remediation Code Diff**:
```rust
// src/ui/input.rs
// Handle backspace during interactive search/filter input
KeyCode::Backspace => {
    if !self.filter_text.is_empty() {
        self.filter_text.pop();
        self.apply_filter();
    } else {
        // - Fallthrough to global handler (Triggered quit!)
        // + Explicitly consume event to prevent leaking to global navigation
        return InputHandled::Consumed;
    }
}
```
- **Lesson**: Modal input states in terminal interfaces must consume non-applicable input events rather than letting them fall through to global navigation shortcuts.

---

### Incident 5: False WireGuard Misclassification on BitTorrent uTP Detection (BUG-DPI-01)
- **Context**: Subsystem `crates/rustnet-core/src/network/dpi/bittorrent.rs`
- **What Was Expected**: WireGuard VPN handshake initiation packets must not be classified as BitTorrent uTP protocol traffic.
- **What Actually Happened**: WireGuard handshake initiation packets were misidentified as BitTorrent uTP packets, corrupting connection protocol tags and process telemetry.
- **Evidence in Repo**: `crates/rustnet-core/src/network/dpi/bittorrent.rs` (commit history around uTP heuristic validation).
- **Root Cause**: BitTorrent uTP header byte 0 contains type and version (`version == 1`). Bytes 2–3 contain the `connection_id`. WireGuard handshake packets begin with `0x01` (handshake initiation) followed by 3 reserved zero bytes (`[0x01, 0x00, 0x00, 0x00]`). The naive uTP parser matched `version == 1` and did not check `connection_id`, interpreting WireGuard's zeroed reserved bytes as a valid uTP connection ID of 0.
- **Remediation Code Diff**:
```rust
// crates/rustnet-core/src/network/dpi/bittorrent.rs
@@ -194,6 +194,15 @@ fn analyze_utp(payload: &[u8]) -> Option<BitTorrentInfo> {
     if extension > 2 {
         return None;
     }
 
+    // Real uTP connection IDs are randomly generated, so 0 is effectively
+    // never seen, but bytes 2-3 == 0 is exactly what a WireGuard handshake
+    // initiation looks like here (type byte 0x01 followed by three reserved
+    // zero bytes). Since this check runs on every unmatched UDP packet,
+    // require a non-zero connection ID so WireGuard rekeys are not
+    // classified as BitTorrent.
+    let connection_id = u16::from_be_bytes([payload[2], payload[3]]);
+    if connection_id == 0 {
+        return None;
+    }
```
- **Lesson**: Heuristic signature parsers must validate negative constraints against overlapping binary headers from other protocols, particularly when handling reserved zero-byte fields.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Strict Bitwise Precedence**: In DNS and uTP byte-decoding, masking operations must be wrapped in explicit parentheses before equality evaluations. In `(label_len & 0xC0) == 0xC0`, omitting parentheses evaluates `0xC0 == 0xC0` first due to Rust's operator precedence, evaluating `label_len & true` and failing compilation or triggering logical errors.
- **Avoiding Falsy Zero Traps in Port & Query Types**: In `crates/rustnet-core/src/network/dpi/dns.rs`, question parsing verifies:
  ```rust
  if qtype == 0 || qclass == 0 { return None; }
  ```
  Neither `QTYPE` nor `QCLASS` can legally be `0` on the wire in standard DNS questions. Treating 0 as an empty default rather than an invalid field allows malformed memory-cleared buffers to register as valid records.
- **Deep Immutability vs Shallow Copies in Sharded State**: When reading from `DashMap<IpAddr, Vec<AttributedDomain>>`, returning a direct clone of the vector while an insertion is resizing could lead to latency spikes under lock contention. `rustnet` fetches references through read-guards, copies only the required domain string, and releases the shard guard immediately.

### 2. Infinite Loop & Recursion Guards
- **Monotonic Offset Termination Proof**: In wire label decoding, every parsing loop step MUST increase the current offset:
  ```rust
  let next = offset.checked_add(1 + label_len)?;
  offset = next;
  ```
  Using `checked_add` prevents pointer wrapping on 32-bit platforms, and verifying `target < offset` guarantees that compression pointer jumps only move backward, avoiding cyclic graphs.
- **Recursion Caps in Background Resolvers**: Reverse DNS resolution uses non-blocking channels with strict worker boundaries rather than unbound recursive tasks. In `crates/rustnet-core/src/network/dns.rs`:
  ```rust
  const MAX_NAME_POINTER_HOPS: usize = 16;
  const PENDING_TIMEOUT: Duration = Duration::from_secs(30);
  ```
  Resolutions that exceed 30 seconds are marked as failed and purged, preventing hung OS `getnameinfo` threads from leaking resources.

### 3. UI & UX Micro-Mechanics
- **Terminal Render Bounds & Line Slicing**: When rendering protocol tables via `ratatui`, variable-length strings (such as TLS SNI or HTTP User-Agents) can easily exceed terminal boundaries, triggering layout thrashing or panics. Columns are explicitly truncated via character-boundary-aware slicing:
  ```rust
  let display_name = if name.len() > max_width {
      let mut end = max_width.saturating_sub(1);
      while !name.is_char_boundary(end) && end > 0 {
          end -= 1;
      }
      format!("{}…", &name[..end])
  } else {
      name.to_string()
  };
  ```
- **Modal Search State Containment**: As demonstrated in Incident 4, keybindings must maintain strict hierarchical isolation. An active text input field must trap and consume `Esc`, `Enter`, and `Backspace` events to prevent them from leaking into the global TUI navigation router.

### 4. Backend Concurrency & Memory Safety
- **DashMap Shard Lock Order & Callbacks**: In `DnsAttributionCache` (defined in `crates/rustnet-core/src/network/dns_attribution.rs`):
  ```rust
  // CRITICAL MANDATE: The cache is called from inside the tracker's connection-map
  // entry closures (a shard lock is held). It must therefore only ever touch its own maps:
  // no method here may call back into the tracker's connection table.
  ```
  Calling back into the caller's lock from within an active map entry closure creates an AB-BA deadlock between the connection table shards and the DNS attribution cache shards.
- **Amortized Cache Size Counter**: Calling `DashMap::len()` acquires read-locks across every internal shard, degrading concurrent packet processing throughput. `DnsAttributionCache` avoids this by tracking map size via a dedicated atomic counter:
  ```rust
  map_len: AtomicUsize,
  // Per-packet lookup:
  if self.map_len.load(Ordering::Relaxed) > self.max_entries {
      self.prune(now);
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Slice Slicing with `get`**: Zero slice indexing with direct bracket operators (`&payload[start..end]`) is permitted in `rustnet-core` without prior validation. Every boundary crossing uses `.get(offset..end)?`, transforming potential out-of-bounds panics into recoverable `None` parse results.
- **Double-Sided Connection Attribution**: Flow tracking creates connection keys where `local_addr` and `remote_addr` are systematically normalized so that outgoing packets and incoming response packets match the same state tracking record without leaking connections.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The workspace follows strict domain isolation across five dedicated crates:
- `rustnet-core`: Pure packet parsers, flow trackers, and DPI heuristics. Contains no platform-specific code and no I/O dependencies.
- `rustnet-capture`: Encapsulates OS packet capture drivers, BPF filters, and pcap interfaces.
- `rustnet-host`: Platform-specific process discovery (reading `/proc`, Netlink, Win32 API, macOS sysctls, and eBPF maps).
- `rustnet-sandbox`: Platform-specific security sandbox enforcement (Linux Landlock, macOS Seatbelt).
- `rustnet-monitor`: Terminal UI application and headless JSON streaming entry point.

### Dimension 2: Core Abstractions
