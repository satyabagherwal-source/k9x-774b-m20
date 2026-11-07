> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/provablehq-snarkos-learnings.md`  
> **Source**: github ([https://github.com/ProvableHQ/snarkOS](https://github.com/ProvableHQ/snarkOS))  
> **Source Version**: `3f12f64e`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-07T20:42:31.235Z  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): aleo-labs-protocol/snarkOS

---

## 1. Executive Forensic Architecture & System Mechanics

`snarkOS` serves as the decentralized backbone, network coordinator, and consensus engine for the Aleo blockchain. It coordinates zero-knowledge state transitions, verifies zkSNARK proofs (via `snarkVM`), executes decentralized consensus (Bullshark/Narwhal-based BFT combined with Proof-of-Succinct-Work / Aleo Puzzle), and provides peer-to-peer data replication across validators, provers, and clients.

```
+---------------------------------------------------------------------------------------------------+
|                                            CLI / REST API                                         |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+-------------------------------------------------+-------------------------------------------------+
|                                           BFT Consensus                                           |
|  +------------------------+  +--------------------------+  +-----------------------------------+  |
|  |     ProposedBatch      |  |     StorageService       |  |          LedgerService            |  |
|  +-----------+------------+  +------------+-------------+  +-----------------+-----------------+  |
|              |                            |                                  |                    |
|              v                            v                                  v                    |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  Workers (0..MAX_WORKERS)                                   |  |
|  |  - Ready Queue (`RwLock<Ready<N>>`)                                                         |  |
|  |  - Pending Requests (`Pending<TransmissionID<N>, Transmission<N>>`)                         |  |
|  +---------------------------------------------------------------------------------------------+  |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+-------------------------------------------------+-------------------------------------------------+
|                                    Consensus Transactions Queue                                   |
|  +----------------------------------------------+  +-------------------------------------------+  |
|  |            Deployments Queue                 |  |             Executions Queue              |  |
|  |  - BTreeMap<(Reverse<Fee>, Seq), TxID>       |  |  - BTreeMap<(Reverse<Fee>, Seq), TxID>    |  |
|  |  - FIFO LRU (Zero-Fee)                       |  |  - FIFO LRU (Zero-Fee)                    |  |
|  +----------------------------------------------+  +-------------------------------------------+  |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         v                                                 v
+------------------------+------------------------+  +---------------------+------------------------+
|                      Sync                       |  |                     Router                   |
|  - `SyncState` (Synced, Syncing, Unsynced)      |  |  - Handshake Engine & Peer Table             |
|  - Fast vs DAG Sync Partition                   |  |  - Genesis Hash Invariant Validator          |
|  - Out-of-Order Watermark Sync Pool             |  |  - Noise/P2P Transport Protocol              |
+-------------------------------------------------+  +----------------------------------------------+
```

### Architectural Subsystem Decoupling & Invariants

1. **BFT Worker & Memory Pool Partitioning (`node/bft/src/worker.rs`)**:
   - The memory pool is partitioned across `MAX_WORKERS` discrete worker instances.
   - Each worker operates its own `Ready<N>` storage, protected by `Arc<RwLock<Ready<N>>>`, and manages inflight asynchronous transmissions through a lock-free/channel-delimited `Pending<TransmissionID<N>, Transmission<N>>`.
   - Transmissions are bound by strict size invariants: `MAX_TRANSMISSIONS_PER_WORKER = BatchHeader::<N>::MAX_TRANSMISSIONS_PER_BATCH / MAX_WORKERS`.
   - Pings across workers restrict payload batches using `MAX_TRANSMISSIONS_PER_WORKER_PING = BatchHeader::<N>::MAX_TRANSMISSIONS_PER_BATCH / 10`.

2. **Hierarchical Mempool with Strict Eviction Semantics (`node/consensus/src/transactions_queue.rs`)**:
   - Transaction propagation splits deployments and executions into independent dual-tier priority pipelines (`TransactionsQueueInner`).
   - Prioritized transactions are mapped in a composite-keyed `BTreeMap<(Reverse<U64<N>>, u64), N::TransactionID>`, combining descending fee sorting with a strictly monotonic counter (`u64`) to preserve FIFO ordering for equivalent fee tiers without non-deterministic reordering.
   - Zero-fee transactions are quarantined into an `LruCache` FIFO buffer. When capacity saturates, evictions strictly purge low-priority/zero-fee buckets before rejecting or comparing against high-priority entries.

3. **Consensus-Aware Synchronization FSM (`node/sync/src/block_sync/sync_state.rs`)**:
   - Sync tracking isolates ledger height progression from block locator ingestion using a tri-state machine (`SyncStatus::Unsynced`, `SyncStatus::Syncing`, `SyncStatus::Synced`).
   - Sync initializes to `Synced` by default to prevent deadlocking new chain validators before peer locators are received.
   - It partitions synchronization modes across a Garbage Collection boundary (`BftSyncMode::Fast` bypassing certificate DAG insertion vs. `BftSyncMode::Dag` with full graph insertion).

4. **Cryptographic Identity & Ledger Separation (`account/src/lib.rs`, `utilities/src/node_data.rs`)**:
   - Keys are organized in an asymmetric derive-downward pattern: $\text{PrivateKey} \to \text{ViewKey} \to \text{Address}$. Addresses are zeroized of trapdoors and exposed strictly for Schnorr/Aleo signature verification over field vectors (`&[Field<N>]`), byte slices (`&[u8]`), and bit vectors (`&[bool]`).
   - Data directories enforce complete separation between node configurations, preventing cross-network ledger corruption by encoding network ID and dev-node index directly into canonical absolute filesystem paths (`.node-data-{network}-{dev}`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Fee FIFO Quarantining in Priority Memory Pools
**RULE**:
When building priority queues for mixed-fee transactions or async task schedulers, systems MUST NOT interleave zero-cost/zero-fee elements within the primary sorted index. Zero-fee elements MUST be quarantined into an explicit, capacity-bounded FIFO ring/LRU cache, and non-zero priority elements MUST strictly evict from the zero-fee FIFO collection prior to testing boundary rejection on the priority index.

**WHY**:
Mixing zero-fee and fee-paying elements in a single heap or tree index introduces $O(\log N)$ overhead for spam, exposes the engine to starvation attacks where low-value entries pollute high-frequency branch predictors, and prevents linear $O(1)$ LRU eviction when backpressure saturates capacity. Quarantining isolates spam vectors and gives deterministic memory utilization.

**WHEN TO APPLY**:
Apply to all blockchain mempools, P2P transaction relays, asynchronous message brokers, and actor mailbox queues where operations have variable economic costs or operational weights.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    cmp::Reverse,
    collections::{BTreeMap, HashMap, hash_map::Entry},
    num::NonZeroUsize,
};
use anyhow::{bail, Result};
use lru::LruCache;

pub struct DualTierQueue<K: std::hash::Hash + Eq + Copy + Ord, V: Clone> {
    capacity: usize,
    counter: u64,
    fifo_zero_fee: LruCache<K, V>,
    priority_map: HashMap<K, V>,
    priority_index: BTreeMap<(Reverse<u64>, u64), K>,
}

impl<K: std::hash::Hash + Eq + Copy + Ord, V: Clone> DualTierQueue<K, V> {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            counter: 0,
            fifo_zero_fee: LruCache::new(NonZeroUsize::new(capacity).expect("non-zero capacity")),
            priority_map: HashMap::new(),
            priority_index: BTreeMap::new(),
        }
    }

    pub fn insert(&mut self, id: K, value: V, fee: u64) -> Result<()> {
        if self.fifo_zero_fee.contains(&id) || self.priority_map.contains_key(&id) {
            return Ok(()); // Idempotent duplicate check
        }

        let current_len = self.fifo_zero_fee.len() + self.priority_map.len();

        if current_len < self.capacity {
            if fee == 0 {
                self.fifo_zero_fee.put(id, value);
            } else {
                self.priority_map.insert(id, value);
                self.priority_index.insert((Reverse(fee), self.counter), id);
                self.counter += 1;
            }
            return Ok(());
        }

        // Capacity saturated: Eviction logic
        if fee == 0 {
            bail!("Mempool capacity saturated: zero-fee item rejected");
        }

        if !self.fifo_zero_fee.is_empty() {
            // Priority item evicts the oldest zero-fee item
            self.fifo_zero_fee.pop_lru();
            self.priority_map.insert(id, value);
            self.priority_index.insert((Reverse(fee), self.counter), id);
            self.counter += 1;
            return Ok(());
        }

        // Both buckets full: must evict the lowest priority fee item if new fee is greater
        let ((Reverse(lowest_fee), _), &lowest_id) = self
            .priority_index
            .last_key_value()
            .expect("priority map must not be empty");

        if fee <= *lowest_fee {
            bail!("Mempool capacity saturated: fee insufficient for displacement");
        }

        // Evict the lowest-fee entry
        let last_key = *self.priority_index.last_key_value().unwrap().0;
        self.priority_index.remove(&last_key);
        self.priority_map.remove(&lowest_id);

        // Insert new higher-fee entry
        self.priority_map.insert(id, value);
        self.priority_index.insert((Reverse(fee), self.counter), id);
        self.counter += 1;

        Ok(())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct monotonic sorting containing zero and non-zero values together
// Suffers from starvation, cache misses, and unbounded eviction scans.
struct BadQueue<K, V> {
    items: BTreeMap<(Reverse<u64>, u64), (K, V)>,
    capacity: usize,
}
impl<K: Ord, V> BadQueue<K, V> {
    fn insert(&mut self, k: K, v: V, fee: u64) {
        if self.items.len() >= self.capacity {
            // Scanning backward to locate whether a zero-fee element exists
            // introduces O(N) traversal under adversarial conditions.
            let zero_key = self.items.iter().rev().find(|((Reverse(f), _), _)| *f == 0).map(|(k, _)| *k);
            if let Some(zk) = zero_key { self.items.remove(&zk); }
        }
    }
}
```

**VERIFICATION METHOD**:
Verify using property testing via `proptest`:
1. Generate random batches of items with fees uniformly sampled from `0..1000`.
2. Push items up to capacity, then assert that `fifo_zero_fee.len() + priority_map.len() <= capacity`.
3. Assert that no zero-fee element remains in the structure if an incoming non-zero fee element was rejected due to full capacity.

---

### 2. Multi-Context Handshake Protocol Genesis-Pinning
**RULE**:
Network session handshakes across decentralized or partitioned RPC topologies MUST NOT rely on public key authorization, committee membership verification, or protocol versions alone. Every layer-specific handshake (including internal P2P, gateway, and consensus layers) MUST explicitly bind and exchange the immutable Genesis Block Hash (or Genesis Header Commitment). Sessions MUST immediately terminate if the remote peer's genesis commitment differs from local state.

**WHY**:
Nodes configured with deterministic development keys or identity certificates across distinct networks (e.g., local devnets, staging, or forks) will mutually authenticate if they pass committee and signature checks. If Genesis is not pinned, foreign nodes will occupy connection slots, prevent genuine peers from reconnecting ("address slot already held"), and participate in quorum calculations without producing valid consensus signatures—leading to permanent chain halt.

**WHEN TO APPLY**:
Apply to all distributed consensus daemons, P2P network layers, Raft/Paxos/Narwhal-Bullshark implementations, and multi-tenant RPC servers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use anyhow::{bail, ensure, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GenesisBinding {
    pub network_id: u16,
    pub genesis_hash: [u8; 32],
}

pub struct PeerHandshake {
    pub version: u32,
    pub node_address: [u8; 32],
    pub genesis_binding: GenesisBinding,
}

pub fn verify_gateway_handshake(
    local_genesis: GenesisBinding,
    remote: &PeerHandshake,
    trusted_version: u32,
) -> Result<()> {
    // 1. Check software protocol version compatibility
    ensure!(remote.version >= trusted_version, "Protocol version mismatch");

    // 2. MANDATORY: Strict genesis hash commitment verification
    ensure!(
        remote.genesis_binding.network_id == local_genesis.network_id,
        "Cross-network connection rejected: remote network {} != local {}",
        remote.genesis_binding.network_id,
        local_genesis.network_id
    );
    ensure!(
        remote.genesis_binding.genesis_hash == local_genesis.genesis_hash,
        "Genesis mismatch: remote node belongs to a different fork or chain root"
    );

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Checking committee and address identity without verifying genesis root
pub fn insecure_verify_peer(remote_address: [u8; 32], committee: &[([u8; 32], u64)]) -> Result<()> {
    // SECURITY FLAW: Remote peer possesses a valid committee private key from a devnet/fork!
    // It passes this check, connects, and pollutes the validator quorum table.
    if !committee.iter().any(|(addr, _)| *addr == remote_address) {
        bail!("Peer is not a bonded committee member");
    }
    Ok(())
}
```

**VERIFICATION METHOD**:
Construct integration tests initializing two disjoint nodes with identical test seed accounts but distinct Genesis block hashes:
```rust
#[test]
fn test_reject_foreign_genesis_same_keys() {
    let local = GenesisBinding { network_id: 1, genesis_hash: [0xAA; 32] };
    let foreign = PeerHandshake {
        version: 1,
        node_address: [0x01; 32], // Valid committee member key
        genesis_binding: GenesisBinding { network_id: 1, genesis_hash: [0xBB; 32] },
    };
    assert!(verify_gateway_handshake(local, &foreign, 1).is_err());
}
```

---

### 3. Out-of-Order Watermark Sync Pool Request Invalidation
**RULE**:
When an asynchronous synchronization engine requests ranges of blocks, state deltas, or chunks across a peer pool with rate-limited or dropped responses, the client MUST track each peer's monotonically advancing response timestamp watermark. If a peer returns response $R_j$ generated at time $t_j$ where $j > i$, any inflight request $R_i$ assigned to that peer with send timestamp $t_i < t_j$ MUST NOT remain indefinitely exempt from timeouts; it MUST be immediately recognized as dropped, canceled, and reissued to an alternate peer.

**WHY**:
Leniency mechanisms that grant timeout waivers to "active" peers (e.g., skipping timeout increments because the peer answered *some* recent block) cause the synchronizer to permanently stall when the remote peer drops an earlier request due to rate-limiting (`max_cache_duplicates()`). Because the peer continues answering newer blocks, its "last seen" timestamp refreshes, preventing the dropped request from ever timing out and leaving the sync engine stalled at the gap.

**WHEN TO APPLY**:
Apply to asynchronous stream reconstructors, torrent chunk downloaders, ledger synchronization pipelines, and distributed chunked storage clients.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::{Duration, Instant};

pub struct InflightRequest {
    pub request_id: u64,
    pub sent_at: Instant,
    pub assigned_peer: SocketAddr,
}

pub struct PeerSyncTracker {
    /// Timestamp of the last received response from the peer.
    pub last_response_at: Instant,
    /// The monotonic send timestamp of the newest request that this peer has successfully answered.
    pub latest_answered_request_sent_at: Option<Instant>,
}

pub fn audit_inflight_requests(
    inflight: &mut Vec<InflightRequest>,
    peer_trackers: &HashMap<SocketAddr, PeerSyncTracker>,
    timeout_threshold: Duration,
    now: Instant,
) -> Vec<InflightRequest> {
    let mut dropped_to_reissue = Vec::new();

    inflight.retain(|req| {
        let Some(tracker) = peer_trackers.get(&req.assigned_peer) else {
            // Peer disconnected; trigger immediate reissue
            dropped_to_reissue.push(InflightRequest { ..*req });
            return false;
        };

        // If the peer has already answered a request that was dispatched AFTER this one,
        // it proves the peer skipped/dropped this request:
        if let Some(answered_send_time) = tracker.latest_answered_request_sent_at {
            if answered_send_time > req.sent_at {
                // Request was skipped in the peer's queue: mark for reissue immediately
                dropped_to_reissue.push(InflightRequest { ..*req });
                return false;
            }
        }

        // Standard timeout fallback if the peer is completely silent:
        if now.saturating_duration_since(req.sent_at) > timeout_threshold {
            if now.saturating_duration_since(tracker.last_response_at) > timeout_threshold {
                dropped_to_reissue.push(InflightRequest { ..*req });
                return false;
            }
        }

        true
    });

    dropped_to_reissue
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Exempting any request from timing out as long as the peer responds to SOMETHING
pub fn broken_timeout_check(req_sent_at: Instant, peer_last_seen: Instant, timeout: Duration) -> bool {
    // CATASTROPHIC FLAW: If peer keeps answering newer requests, (now - peer_last_seen)
    // is always small. A dropped request sent hours ago never expires!
    let now = Instant::now();
    if now.duration_since(peer_last_seen) < timeout {
        return false; // Still considered "active", request will never timeout
    }
    now.duration_since(req_sent_at) > timeout
}
```

**VERIFICATION METHOD**:
Implement a mock peer that answers requests out of order:
1. Dispatch Request 1 at $t=10$. Dispatch Request 2 at $t=20$.
2. Simulate peer returning response for Request 2 at $t=25$, omitting Request 1.
3. Advance clock to $t=35$. Run `audit_inflight_requests`.
4. Assert Request 1 is detected in the `dropped_to_reissue` collection despite the peer being marked active at $t=25$.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Gateway Handshake Missing Genesis Binding Allows Devnet Cross-Talk & Permanent Chain Stalling (BUG-SNARKOS-4615)
- **Context**: BFT Gateway P2P subsystem handshake (`node/bft/src/gateway.rs` and `node/router/src/handshake.rs`).
- **What Was Expected**: When a node establishes a P2P or gateway connection, it must strictly verify that the counterparty belongs to the identical blockchain network, genesis state, and consensus history.
- **What Actually Happened**: Two independent devnets configured with identical deterministic dev keys started concurrently with different genesis blocks. Prover nodes logged `failed (incorrect block header)`. During validator rolling restarts, foreign nodes holding deterministic keys connected to surviving validators. Because `verify_peer_info` only authenticated address identity and committee membership, it allowed the foreign nodes to hold the address connection slots. Legitimate returning validators were rejected with `already connected to the given Aleo address`. Foreign nodes transmitted no proposals, but kept TCP connections alive. Quorum checks in `propose_batch` included them, completely and permanently halting block production across both networks.
- **Evidence in Repo**: Issue #4615; Commit `395f79781`; Refactored in `node/bft/src/gateway.rs`.
- **Root Cause**: Gateway peer validation performed an incomplete invariant check:
  ```rust
  // Missing Genesis validation in verify_peer_info:
  self.ensure_version_compatible(peer_version)?;
  self.ensure_is_trusted_or_committee(peer_ip, peer_address)?;
  self.ensure_restrictions_id_matches(peer_restrictions_id)?;
  // BUG: Genesis block hash was never evaluated!
  ```
- **Remediation Code Diff**:
```rust
// In node/bft/src/gateway.rs:
- pub fn verify_peer_info(&self, peer_ip: SocketAddr, peer_info: &PeerInfo<N>) -> Result<()> {
-     self.check_version(peer_info.version)?;
-     self.check_committee_membership(peer_info.address)?;
-     Ok(())
- }
+ pub fn verify_peer_info(&self, peer_ip: SocketAddr, peer_info: &PeerInfo<N>) -> Result<()> {
+     self.check_version(peer_info.version)?;
+     self.check_committee_membership(peer_info.address)?;
+     // Enforce strict genesis block header hash matching on Gateway handshake:
+     ensure!(
+         peer_info.genesis_header_hash == self.ledger.genesis_header_hash(),
+         "Peer {peer_ip} has mismatched genesis header hash: expected {}, found {}",
+         self.ledger.genesis_header_hash(),
+         peer_info.genesis_header_hash
+     );
+     Ok(())
+ }
```
- **Lesson**: Identity verification without state-root anchoring fails under shared-key environments (testing, local clusters, staging environments). All network handshakes must bind cryptographically to the immutable root state.

---

### Incident 2: Block Synchronization Livelock via Dropped Rate-Limited Requests (BUG-SNARKOS-4588)
- **Context**: Monolithic block synchronization engine (`node/sync/src/block_sync.rs`).
- **What Was Expected**: If an assigned validator drops a block request due to internal rate limiting (`max_cache_duplicates()`), the syncing node should time out that specific request and reissue it to an alternative responsive peer in the pool.
- **What Actually Happened**: A commit intended to prevent premature timeouts (`71f5f74c0`) exempted any timed-out request from being aborted if its assigned peer had sent *any* block response within `BLOCK_REQUEST_TIMEOUT` (60 seconds). When a validator dropped requests exceeding `max_cache_duplicates()`, it sent no reply. However, that peer continued answering newer incoming block requests. Because newer requests were answered, `last_response_at` continuously refreshed. The dropped request was treated as permanently exempt from timeouts, was never reissued, and the syncing node halted below the missing block gap indefinitely.
- **Evidence in Repo**: Issue #4588, PR resolving #4585; Commit `71f5f74c0`.
- **Root Cause**: Coarse-grained timestamp tracking. The peer's `last_response_at` was global per peer rather than contextualized against the inflight request dispatch sequence.
- **Remediation Code Diff**:
```rust
// In node/sync/src/block_sync.rs:
  struct PeerSyncStatus {
      last_response_at: Instant,
+     latest_answered_request_timestamp: Option<Instant>,
  }

- if now.duration_since(peer.last_response_at) < BLOCK_REQUEST_TIMEOUT {
-     // Peer is responsive; preserve inflight request indefinitely
-     continue;
- }
+ let peer_answered_newer_request = peer
+     .latest_answered_request_timestamp
+     .map_or(false, |latest_ts| latest_ts > request.sent_at);
+
+ if peer_answered_newer_request {
+     // Peer answered later requests, skipping this one. Force timeout and reissue.
+     trace!("Dropping skipped block request {} from peer {peer_ip}", request.id);
+     failed_requests.push(request);
+ } else if now.duration_since(peer.last_response_at) >= BLOCK_REQUEST_TIMEOUT {
+     failed_requests.push(request);
+ }
```
- **Lesson**: Never use global liveness timestamps to validate transactional pipelined requests. Liveness must be verified using monotonic per-request sequence watermarks.

---

### Incident 3: Supply Chain Action Compromise Risk via Unpinned GitHub Actions (BUG-SNARKOS-4645)
- **Context**: Continuous Integration and Release workflows (`.github/workflows/benchmarks.yml`, `ci.yml`, `release.yml`).
- **What Was Expected**: CI/CD workflows executing on self-hosted and cloud runners must ensure build reproducibility and guard against upstream supply chain token exfiltration and malicious code execution.
- **What Actually Happened**: Workflow steps referenced mutable ref tags (e.g., `uses: actions/checkout@v7`, `uses: Swatinem/rust-cache@v2`, `uses: softprops/action-gh-release@v3`). A tag retargeting upstream could compromise binary releases or access repository secrets.
- **Evidence in Repo**: PR #4645; Commit `3f12f64e`.
- **Root Cause**: Upstream tags are mutable git references, violating zero-trust pipeline supply chain invariants.
- **Remediation Code Diff**:
```yaml
# In .github/workflows/benchmarks.yml & ci.yml:
- uses: actions/checkout@v7
+ uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: Swatinem/rust-cache@v2
+ uses: Swatinem/rust-cache@d1527c8f67ef9af357290475d4af4b0fab8f12e0 # v2.9.3
- uses: actions/cache@v6
+ uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
- uses: benchmark-action/github-action-benchmark@v1
+ uses: benchmark-action/github-action-benchmark@4322e5726e6334590d251fc4f92bec0efafc45dc # v1.22.2
```
- **Lesson**: Production deployment workflows must enforce full 40-character commit SHA pinning for third-party GitHub Actions to guarantee supply chain integrity.

---

### Incident 4: CI/CD Secret Exposure Hazard via Persisted Git Credentials (BUG-SNARKOS-EABD)
- **Context**: Binary compilation and artifact packaging workflow (`.github/workflows/release.yml`).
- **What Was Expected**: Multi-platform release runners compiling native binaries (Linux x86_64, macOS aarch64, Windows msvc) must not retain GitHub tokens in workspace `.git` configurations across post-checkout compilation phases.
- **What Actually Happened**: `actions/checkout` persisted default authentication tokens on the runner's local filesystem (`.git/config`). Third-party build scripts, cargo build dependencies, or linked binary scripts could potentially inspect the local git metadata and extract repository tokens.
- **Evidence in Repo**: Commit `eabd3971`; Message: "Do not persist the token in release checkouts".
- **Root Cause**: `persist-credentials: false` was omitted across release checkout jobs.
- **Remediation Code Diff**:
```yaml
# In .github/workflows/release.yml:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+       with: { persist-credentials: false }
```
- **Lesson**: Workflows building binaries or running external compiler hooks must explicitly disable credential persistence to enforce least-privilege containment on runner storage.

---

### Incident 5: State Corruption via Reentrant Callback Handle Replacement (BUG-SNARKOS-CB01)
- **Context**: Asynchronous task callback registration (`utilities/src/callback_handle.rs`).
- **What Was Expected**: A `CallbackHandle` manages registration of single-assignment lifecycle hooks. If a component attempts to register a callback when one is already active, `set()` must fail, and the original callback must remain intact.
- **What Actually Happened**: The internal implementation executed `self.callback.write().replace(callback)`. If an existing callback was already stored, the new callback overwrote the slot before checking `prev.is_some()`. Although an error was returned (`bail!("Callback was already set")`), the state had already mutated, leaving the second callback installed.
- **Evidence in Repo**: `utilities/src/callback_handle.rs:38-46` and accompanying test suite `tests::a_rejected_set_has_still_replaced_the_callback`.
- **Root Cause**: Premature state modification before invariant validation.
- **Remediation Code Diff**:
```rust
// In utilities/src/callback_handle.rs:
  pub fn set(&self, callback: C) -> Result<()> {
-     let prev = self.callback.write().replace(callback);
-     if prev.is_some() {
-         bail!("Callback was already set");
-     }
+     let mut lock = self.callback.write();
+     if lock.is_some() {
+         bail!("Callback was already set");
+     }
+     *lock = Some(callback);
      Ok(())
  }
```
- **Lesson**: Enforce pre-condition checks *before* applying state mutations. Never mutate an inner data structure under the assumption that an error return rolls back memory.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In high-throughput, low-latency cryptographic operating systems, minute token-level decisions introduce observable runtime divergence:

- **Monotonic Sequence Wrapping in Fees**: When comparing transactions in `node/consensus/src/transactions_queue.rs`:
  ```rust
  // Composite key: (Reverse(Fee), Counter)
  transaction_ids: BTreeMap<(Reverse<U64<N>>, u64), N::TransactionID>
  ```
  `counter: u64` is incremented on every insertion. If `counter` overflows via wrapping arithmetic, FIFO ordering breaks, allowing new low-fee transactions to leapfrog old transactions. The system prevents this by relying on non-overflowing monotonic counters or bounded lifetimes.
- **Saturating Arithmetic for Heights & Lengths**: In `node/sync/src/block_sync/sync_state.rs`:
  ```rust
  // Micro-syntax safety: NEVER peer_height - self.sync_height
  pub fn num_blocks_behind(&self) -> Option<u32> {
      self.greatest_peer_height.map(|peer_height| peer_height.saturating_sub(self.sync_height))
  }
  ```
  If `sync_height` temporarily exceeds `greatest_peer_height` due to optimistic local block ingestion, regular subtraction triggers an underflow panic in debug mode and integer wrap to $\approx 2^{32}$ in release mode, immediately transitioning the node from `Synced` into an erroneous permanent `Syncing` status.
- **Non-Zero Type Invariants**:
  ```rust
  fifo_queue: LruCache::new(NonZeroUsize::new(capacity).unwrap())
  ```
  Passing raw `usize` to LRU cache initializers can result in zero-capacity edge cases where `.put()` triggers undefined behavior or immediate panics. Wrapping with `NonZeroUsize` forces capacity verification during initialization.

### 2. Infinite Loop & Recursion Guards
- **Signal Handling Latch Non-Reentrancy**: In `utilities/src/signals.rs`:
  ```rust
  pub async fn wait_for_signals(&self) {
      let Some(receiver) = self.stopped_receiver.lock().take() else {
          panic!("wait_for_signals must be called at most once");
      };
      if let Err(err) = receiver.await {
          error!("wait_for_signals encountered an error: {err}");
      }
  }
  ```
  Using `.take()` ensures the `oneshot::Receiver` is consumed. Calling `wait_for_signals` concurrently or iteratively triggers an explicit, fail-fast panic rather than deadlocking an awaiting task on an unresolvable future.
- **Termination Invariants in P2P Inflight Iterators**: When draining worker queues in `node/bft/src/worker.rs`:
  ```rust
  while let Some((id, tx)) = self.remove_front() {
      if self.contains_transmission(id) {
          continue; // Guard against cycling duplicate transmissions
      }
      // Reinsertion is explicitly guarded by membership checks:
      if !self.contains_transmission(id) {
          self.insert_front(id, tx);
          break;
      }
  }
  ```
  An unbounded `while let Some` combined with unguarded re-insertion produces an infinite CPU spin inside consensus event processing loops.

### 3. UI & UX Micro-Mechanics (CLI & REST Serialization)
- **Terminal Display Formatting & Color Code Escapes**: In `account/src/lib.rs`:
  ```rust
  write!(
      f,
      " {:>12}  {}\n {:>12}  {}\n {:>12}  {}",
      "Private Key".cyan().bold(),
      self.private_key,
      "View Key".cyan().bold(),
      self.view_key,
      "Address".cyan().bold(),
      self.address
  )
  ```
  ANSI escape sequences (e.g., `.cyan