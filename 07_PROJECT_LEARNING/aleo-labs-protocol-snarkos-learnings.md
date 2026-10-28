> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aleo-labs-protocol-snarkos-learnings.md`  
> **Source**: github ([https://github.com/aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS))  
> **Source Version**: `1f4eee02`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T19:46:52.647Z  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): aleo-labs-protocol/snarkOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/aleo-labs-protocol-snarkos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T19:46:52.639Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aleo-labs-protocol/snarkOS`
- **Description**: A Decentralized Operating System for ZK Applications
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4530 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `node/bft/events/src/worker_ping.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use super::*;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkerPing<N: Network> {
    pub transmission_ids: IndexSet<TransmissionID<N>>,
}

impl<N: Network> WorkerPing<N> {
    /// Initializes a new ping event.
    pub fn new(transmission_ids: IndexSet<TransmissionID<N>>) -> Self {
        Self { transmission_ids }
    }
}

impl<N: Network> From<IndexSet<TransmissionID<N>>> for WorkerPing<N> {
    /// Initializes a new ping event.
    fn from(transmission_ids: IndexSet<TransmissionID<N>>) -> Self {
        Self::new(transmission_ids)
    }
}

impl<N: Network> EventTrait for WorkerPing<N> {
    /// Returns the event name.
    #[inline]
    fn name(&self) -> Cow<'static, str> {
        "WorkerPing".into()
    }
}

impl<N: Network> ToBytes for WorkerPing<N> {
    fn write_le<W: Write>(&self, mut writer: W) -> IoResult<()> {
        u16::try_from(self.transmission_ids.len()).map_err(error)?.write_le(&mut writer)?;
        for transmission_id in &self.transmission_ids {
            transmission_id.write_le(&mut writer)?;
        }
        Ok(())
    }
}

impl<N: Network> FromBytes for WorkerPing<N> {
    fn read_le<R: Read>(mut reader: R) -> IoResult<Self> {
        let num_transmissions = u16::read_le(&mut reader)?;
        let mut transmission_ids = IndexSet::new();
        for _ in 0..num_transmissions {
            transmission_ids.insert(TransmissionID::read_le(&mut reader)?);
        }
        Ok(Self { transmission_ids })
    }
}

#[cfg(test)]
pub mod prop_tests {
    use crate::{WorkerPing, prop_tests::any_transmission_id};
    use snarkvm::console::prelude::{FromBytes, ToBytes};

    use bytes::{Buf, BufMut, BytesMut};
    use proptest::{
        collection::hash_set,
        prelude::{BoxedStrategy, Strategy},
    };
    use test_strategy::proptest;

    type CurrentNetwork = snarkvm::prelude::MainnetV0;

    pub fn any_worker_ping() -> BoxedStrategy<WorkerPing<CurrentNetwork>> {
        hash_set(any_transmission_id(), 1..16).prop_map(|ids| WorkerPing::new(ids.into_iter().collect())).boxed()
    }

    #[proptest]
    fn serialize_deserialize(#[strategy(any_worker_ping())] original: WorkerPing<CurrentNetwork>) {
        let mut buf = BytesMut::default().writer();
        WorkerPing::write_le(&original, &mut buf).unwrap();

        let deserialized = WorkerPing::read_le(buf.into_inner().reader()).unwrap();
        assert_eq!(original, deserialized);
    }
}

```

### Core Architecture Module: `node/bft/src/worker.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#[cfg(not(test))]
use crate::Gateway;
use crate::{
    MAX_FETCH_TIMEOUT,
    MAX_WORKERS,
    ProposedBatch,
    ProposedBatchState,
    Transport,
    events::{Event, TransmissionRequest, TransmissionResponse},
    helpers::{Pending, Ready, Storage, WorkerReceiver, fmt_id, max_redundant_requests},
    spawn_blocking,
};
use snarkos_node_bft_ledger_service::{LedgerService, deserialize_transaction_strict};
use snarkvm::{
    console::prelude::*,
    ledger::{
        Transaction,
        narwhal::{BatchHeader, Data, Transmission, TransmissionID},
        puzzle::{Solution, SolutionID},
    },
};

use anyhow::Context;
use indexmap::{IndexMap, IndexSet};
#[cfg(feature = "locktick")]
use locktick::parking_lot::{Mutex, RwLock};
#[cfg(not(feature = "locktick"))]
use parking_lot::{Mutex, RwLock};
use rand::seq::IteratorRandom;

use std::{future::Future, net::SocketAddr, sync::Arc};
use tokio::{sync::oneshot, task::JoinHandle, time::timeout};

/// A worker's main role is maintaining a queue of verified ("ready") transmissions,
/// which will eventually be fetched by the primary when the primary generates a new batch.
#[derive(Clone)]
pub struct Worker<N: Network> {
    /// The worker ID.
    id: u8,
    /// The gateway.
    #[cfg(not(test))]
    gateway: Arc<Gateway<N>>,
    #[cfg(test)]
    gateway: Arc<dyn Transport<N>>,
    /// The storage.
    storage: Storage<N>,
    /// The ledger service.
    ledger: Arc<dyn LedgerService<N>>,
    /// The proposed batch.
    proposed_batch: Arc<ProposedBatch<N>>,
    /// The ready queue.
    ready: Arc<RwLock<Ready<N>>>,
    /// The pending transmissions queue.
    pending: Arc<Pending<TransmissionID<N>, Transmission<N>>>,
    /// The spawned handles.
    handles: Arc<Mutex<Vec<JoinHandle<()>>>>,
}

impl<N: Network> Worker<N> {
    /// Initializes a new worker instance.
    pub fn new(
        id: u8,
        #[cfg(not(test))] gateway: Arc<Gateway<N>>,
        #[cfg(test)] gateway: Arc<dyn Transport<N>>,
        storage: Storage<N>,
        ledger: Arc<dyn LedgerService<N>>,
        proposed_batch: Arc<ProposedBatch<N>>,
    ) -> Result<Self> {
        // Ensure the worker ID is valid.
        ensure!(id < MAX_WORKERS, "Invalid worker ID '{id}'");
        // Return the worker.
        Ok(Self {
            id,
            gateway,
            storage,
            ledger,
            proposed_batch,
            ready: Default::default(),
            pending: Default::default(),
            handles: Default::default(),
        })
    }

    /// Run the worker instance.
    pub fn run(&self, receiver: WorkerReceiver<N>) {
        info!("Starting worker instance {} of the memory pool...", self.id);
        // Start the worker handlers.
        self.start_handlers(receiver);
    }

    /// Returns the worker ID.
    pub const fn id(&self) -> u8 {
        self.id
    }

    /// Returns a reference to the pending transmissions queue.
    pub fn pending(&self) -> &Arc<Pending<TransmissionID<N>, Transmission<N>>> {
        &self.pending
    }
}

impl<N: Network> Worker<N> {
    /// The maximum number of transmissions allowed in a worker.
    pub const MAX_TRANSMISSIONS_PER_WORKER: usize =
        BatchHeader::<N>::MAX_TRANSMISSIONS_PER_BATCH / MAX_WORKERS as usize;
    /// The maximum number of transmissions allowed in a worker ping.
    pub const MAX_TRANSMISSIONS_PER_WORKER_PING: usize = BatchHeader::<N>::MAX_TRANSMISSIONS_PER_BATCH / 10;

    /// Returns the number of transmissions in the ready queue.
    pub fn num_transmissions(&self) -> usize {
        self.ready.read().num_transmissions()
    }

    /// Returns the number of ratifications in the ready queue.
    pub fn num_ratifications(&self) -> usize {
        self.ready.read().num_ratifications()
    }

    /// Returns the number of solutions in the ready queue.
    pub fn num_solutions(&self) -> usize {
        self.ready.read().num_solutions()
    }

    /// Returns the number of transactions in the ready queue.
    pub fn num_transactions(&self) -> usize {
        self.ready.read().num_transactions()
    }
}

impl<N: Network> Worker<N> {
    /// Returns the transmission IDs in the ready queue.
    pub fn transmission_ids(&self) -> IndexSet<TransmissionID<N>> {
        self.ready.read().transmission_ids()
    }

    /// Returns the transmissions in the ready queue.
    pub fn transmissions(&self) -> IndexMap<TransmissionID<N>, Transmission<N>> {
        self.ready.read().transmissions()
    }

    /// Returns the solutions in the ready queue.
    pub fn solutions(&self) -> impl '_ + Iterator<Item = (SolutionID<N>, Data<Solution<N>>)> {
        self.ready.read().solutions().into_iter()
    }

    /// Returns the transactions in the ready queue.
    pub fn transactions(&self) -> impl '_ + Iterator<Item = (N::TransactionID, Data<Transaction<N>>)> {
        self.ready.read().transactions().into_iter()
    }
}

impl<N: Network> Worker<N> {
    /// Clears the solutions from the ready queue.
    pub(super) fn clear_solutions(&self) {
        self.ready.write().clear_solutions()
    }
}

impl<N: Network> Worker<N> {
    // Helper to print the transmission ID and checksum (if any).
    fn format_transmission_id(&self, transmission_id: TransmissionID<N>) -> String {
        if let Some(checksum) = transmission_id.checksum() {
            // fmt_id will suffix with `..`, so we should not use `.`  as a separator.
            format!("{}:{}", fmt_id(transmission_id), fmt_id(checksum))
        } else {
            fmt_id(transmission_id)
        }
    }

    /// Returns `true` if the transmission ID exists in the ready queue, proposed batch, storage, or ledger.
    ///
    /// Note that the storage check is the retrievable one: an ID that BFT storage knows only as
    /// aborted holds no payload, so the worker still wants the bytes - to retain what a fetch just
    /// produced, and to serve them to peers. The ledger check is deliberately the wider one, since
    /// an ID the ledger knows - confirmed, rejected, or aborted - must not re-enter the queue.
    pub fn contains_transmission(&self, transmission_id: impl Into<TransmissionID<N>>) -> bool {
        let transmission_id = transmission_id.into();
        // Check if the transmission ID exists in the ready queue, proposed batch, storage, or ledger.
        self.ready.read().contains(transmission_id)
            || matches!(&*self.proposed_batch.read(), ProposedBatchState::Certifying(p) if p.contains_transmission(transmission_id))
            || self.storage.contains_retrievable_transmission(transmission_id)
            || self.ledger.contains_transmission(&transmission_id).unwrap_or(false)
    }

    /// Returns the transmission if it exists in the ready queue, proposed batch, storage.
    ///
    /// Note: We explicitly forbid retrieving a transmission from the ledger, as transmissions
    /// in the ledger are not guaranteed to be invalid for the current batch.
    pub fn get_transmission(&self, transmission_id: TransmissionID<N>) -> Option<Transmission<N>> {
        // Check if the transmission ID exists in the ready queue.
        if let Some(transmission) = self.ready.read().get(transmission_id) {
            return Some(transmission);
        }
        // Check if the transmission ID exists in storage.
        if let Some(transmission) = self.storage.get_transmission(transmission_id) {
            return Some(transmission);
        }
        // Check if the transmission ID exists in the proposed batch.
        if let Some(transmission) = match &*self.proposed_batch.read() {
            ProposedBatchState::Certifying(p) => p.get_transmission(transmission_id),
            _ => None,
        } {
            return Some(transmission.clone());
        }
        None
    }

    /// Returns the transmissions if it exists in the worker, or requests it from the specified peer.
    pub async fn get_or_fetch_transmission(
        &self,
        peer_ip: SocketAddr,
        transmission_id: TransmissionID<N>,
    ) -> Result<(TransmissionID<N>, Transmission<N>)> {
        // Attempt to get the transmission from the worker.
        if let Some(transmission) = self.get_transmission(transmission_id) {
            return Ok((transmission_id, transmission));
        }
        // Send a transmission request to the peer.
        let (candidate_id, transmission) = self.send_transmission_request(peer_ip, transmission_id).await?;
        // Ensure the transmission ID matches.
        ensure!(candidate_id == transmission_id, "Invalid transmission ID");
        // Return the transmission.
        Ok((transmission_id, transmission))
    }

    /// Inserts the transmission at the front of the ready queue.
    pub(crate) fn insert_front(&self, key: TransmissionID<N>, value: Transmission<N>) {
        self.ready.write().insert_front(key, value);
    }

    /// Removes and returns the transmission at the front of the ready queue.
    pub(crate) fn remove_front(&self) -> Option<(TransmissionID<N>, Transmission<N>)> {
        self.ready.write().remove_front()
    }

    /// Reinserts the specified transmission into the ready queue.
    pub(crate) fn reinsert(&self, transmission_id: TransmissionID<N>, transmission: Transmission<N>) -> bool {
        // Check if the transmission ID exists.
        if !self.contains_transmission(transmission_id) {
            // Insert the transmission
```

### Core Architecture Module: `node/consensus/src/transactions_queue.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::{
    cmp::Reverse,
    collections::{BTreeMap, HashMap, hash_map::Entry},
    num::NonZeroUsize,
};

use anyhow::{Result, bail};
use lru::LruCache;
use snarkvm::{ledger::Transaction, prelude::*};

use crate::{CAPACITY_FOR_DEPLOYMENTS, CAPACITY_FOR_EXECUTIONS};

/// The result of a successful insertion into the transactions queue.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QueueInsertion {
    /// The transaction was added to the queue.
    Inserted,
    /// The transaction was added to the queue, and a lower-priority transaction was evicted.
    InsertedWithEviction,
    /// The transaction was already in the queue; nothing changed.
    Duplicate,
}

pub struct TransactionsQueue<N: Network> {
    pub deployments: TransactionsQueueInner<N>,
    pub executions: TransactionsQueueInner<N>,
}

impl<N: Network> Default for TransactionsQueue<N> {
    fn default() -> Self {
        Self {
            deployments: TransactionsQueueInner::new(CAPACITY_FOR_DEPLOYMENTS),
            executions: TransactionsQueueInner::new(CAPACITY_FOR_EXECUTIONS),
        }
    }
}

impl<N: Network> TransactionsQueue<N> {
    pub fn contains(&self, transaction_id: &N::TransactionID) -> bool {
        self.executions.contains(transaction_id) || self.deployments.contains(transaction_id)
    }

    pub fn insert(
        &mut self,
        transaction_id: N::TransactionID,
        transaction: Transaction<N>,
        priority_fee: U64<N>,
    ) -> Result<QueueInsertion> {
        let is_execute = transaction.is_execute();
        let result = if is_execute {
            self.executions.insert(transaction_id, transaction, priority_fee)
        } else {
            self.deployments.insert(transaction_id, transaction, priority_fee)
        };

        #[cfg(feature = "metrics")]
        {
            if let Ok(QueueInsertion::InsertedWithEviction) = result {
                let kind = if is_execute { "execute" } else { "deploy" };
                metrics::increment_counter_1(metrics::consensus::MEMPOOL_EVICTED, "kind", kind);
            }
            metrics::gauge(metrics::consensus::DEPLOYMENTS_PRIORITY_QUEUE_SIZE, self.deployments.priority_len() as f64);
            metrics::gauge(metrics::consensus::DEPLOYMENTS_ZERO_FEE_QUEUE_SIZE, self.deployments.zero_fee_len() as f64);
            metrics::gauge(metrics::consensus::EXECUTIONS_PRIORITY_QUEUE_SIZE, self.executions.priority_len() as f64);
            metrics::gauge(metrics::consensus::EXECUTIONS_ZERO_FEE_QUEUE_SIZE, self.executions.zero_fee_len() as f64);
        }

        result
    }

    pub fn transactions(&self) -> impl Iterator<Item = (N::TransactionID, Transaction<N>)> + use<N> {
        self.deployments
            .priority_queue
            .transactions
            .clone()
            .into_iter()
            .chain(self.deployments.fifo_queue.clone())
            .chain(self.executions.priority_queue.transactions.clone())
            .chain(self.executions.fifo_queue.clone())
    }
}

pub struct TransactionsQueueInner<N: Network> {
    capacity: usize,
    fifo_queue: LruCache<N::TransactionID, Transaction<N>>,
    priority_queue: PriorityQueue<N>,
}

impl<N: Network> TransactionsQueueInner<N> {
    fn new(capacity: usize) -> Self {
        Self {
            capacity,
            fifo_queue: LruCache::new(NonZeroUsize::new(capacity).unwrap()),
            priority_queue: Default::default(),
        }
    }

    pub fn len(&self) -> usize {
        self.fifo_queue.len().saturating_add(self.priority_queue.len())
    }

    /// The number of transactions in the priority queue.
    #[cfg(feature = "metrics")]
    pub fn priority_len(&self) -> usize {
        self.priority_queue.len()
    }

    /// The number of transactions in the zero-fee queue.
    #[cfg(feature = "metrics")]
    pub fn zero_fee_len(&self) -> usize {
        self.fifo_queue.len()
    }

    fn contains(&self, transaction_id: &N::TransactionID) -> bool {
        self.fifo_queue.contains(transaction_id) || self.priority_queue.transactions.contains_key(transaction_id)
    }

    fn insert(
        &mut self,
        transaction_id: N::TransactionID,
        transaction: Transaction<N>,
        priority_fee: U64<N>,
    ) -> Result<QueueInsertion> {
        // Duplicates are a no-op: they must not evict anything or refresh recency.
        // Note: the transaction ID is the root of the transaction tree, which includes a leaf for the fee
        // transition. A transaction with the same ID therefore always has the same priority fee, and a
        // resubmission with a higher fee has a different ID, so there is nothing to replace here.
        if self.contains(&transaction_id) {
            return Ok(QueueInsertion::Duplicate);
        }

        // If the queue is not full, insert in the appropriate queue.
        if self.len() < self.capacity {
            if priority_fee.is_zero() {
                self.fifo_queue.put(transaction_id, transaction);
            } else {
                self.priority_queue.insert(transaction_id, transaction, priority_fee);
            }

            debug_assert!(self.len() <= self.capacity, "The mempool exceeded its capacity");
            return Ok(QueueInsertion::Inserted);
        }

        let insertion = match (self.priority_queue.len() < self.capacity, *priority_fee) {
            (_, 0) => {
                #[cfg(feature = "metrics")]
                metrics::increment_counter(metrics::consensus::DROPPED_TRANSACTIONS);

                bail!("The memory pool is full")
            }
            // Invariant: if the queue is at capacity but the priority queue
            // isn't equal to the capacity, the low-priority queue must be non-empty.
            (true, _fee) => {
                debug_assert!(
                    !self.fifo_queue.is_empty(),
                    "The low-priority queue must be non-empty when the mempool is full"
                );

                // Remove an entry from the low-priority queue to make room for the high-priority transaction.
                let evicted = self.fifo_queue.pop_lru().is_some();
                if evicted {
                    #[cfg(feature = "metrics")]
                    metrics::increment_counter(metrics::consensus::DROPPED_TRANSACTIONS);
                }

                self.priority_queue.insert(transaction_id, transaction, priority_fee);
                if evicted { QueueInsertion::InsertedWithEviction } else { QueueInsertion::Inserted }
            }
            // Invariant: if the queue is at capacity but the priority queue is
            // equal to the capacity, the low-priority queue must be empty.
            (false, _fee) => {
                debug_assert!(
                    self.fifo_queue.is_empty(),
                    "The low-priority queue must be empty when the priority queue is full"
                );

                self.priority_queue.compare_insert(transaction_id, transaction, priority_fee)?;
                QueueInsertion::InsertedWithEviction
            }
        };

        debug_assert!(self.len() <= self.capacity, "The mempool exceeded its capacity");
        Ok(insertion)
    }

    pub fn pop(&mut self) -> Option<(N::TransactionID, Transaction<N>)> {
        self.priority_queue.pop().or_else(|| self.fifo_queue.pop_lru())
    }
}

struct PriorityQueue<N: Network> {
    /// A counter to ensure fifo ordering for transmissions with the same fee.
    counter: u64,
    /// A map of transmissions ordered by fee and by fifo sequence.
    transaction_ids: BTreeMap<(Reverse<U64<N>>, u64), N::TransactionID>,
    /// A map of transmission IDs to transmissions.
    transactions: HashMap<N::TransactionID, Transaction<N>>,
}

impl<N: Network> Default for PriorityQueue<N> {
    /// Initializes a new instance of the priority queue.
    fn default() -> Self {
        Self { counter: Default::default(), transaction_ids: Default::default(), transactions: Default::default() }
    }
}

impl<N: Network> PriorityQueue<N> {
    fn len(&self) -> usize {
        self.transactions.len()
    }

    fn insert(&mut self, transaction_id: N::TransactionID, transaction: Transaction<N>, fee: U64<N>) {
        if let Entry::Vacant(entry) = self.transactions.entry(transaction_id) {
            // Insert the transaction into the map.
            entry.insert(transaction);
            // Sort by fee (highest first) and counter (fifo).
            self.transaction_ids.insert((Reverse(fee), self.counter), transaction_id);
            // Increment the counter.
            self.counter += 1;
        }
    }

    fn compare_insert(
        &mut self,
        transaction_id: N::TransactionID,
        transaction: Transaction<N>,
        fee: U64<N>,
    ) -> Result<()> {
        // Make sure the collection isn't empty.
        if self.transaction_ids.is_empty() {
            return Ok(());
        }

        // If the lowest fee in the collection is higher than the new fee, reject the new transaction.
        //
        // SAFETY: the empty check guarantees an item will be returned
        let ((Reverse(lowest_fee), _), _) = self.transaction_ids.last_key_value().expect("item must be present");
        if lowest_fee > &fee {
            #[cfg(feature = "metrics")]
            metrics::increment_counter(metrics::consensus::DROPPED_TRANSACTIONS);

            bail!("The memory pool 
```

### Core Architecture Module: `node/sync/src/block_sync/sync_state.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use super::MAX_BLOCKS_BEHIND;

use std::{cmp::Ordering, time::Instant};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SyncStatus {
    Unsynced, // Never synced or no peers
    Syncing,  // In progress
    Synced,   // Fully synced with peers
}

/// Whether the BFT layer is using fast-sync (outside the GC range) or DAG sync (within GC range).
///
/// This is `None` for nodes without a BFT layer (clients, provers).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BftSyncMode {
    /// Block-based synchronization when outside the GC range.
    /// Certificates are not inserted into the DAG.
    Fast,
    /// DAG-based synchronization when within the GC range.
    /// Certificates are inserted into the DAG and consensus runs normally.
    Dag,
}

#[derive(Clone)]
pub(super) struct SyncState {
    /// The height we synced to already
    /// Note: This can be greater than the current ledger height,
    ///       if blocks are not fully committed yet
    sync_height: u32,
    /// The largest height of a peer's block locator.
    /// Is `None` if we never received a peer locator.
    greatest_peer_height: Option<u32>,
    /// Are we synced?
    /// Allows keeping track of when the sync state changes.
    status: SyncStatus,
    /// Last time the sync state changed
    last_change: Instant,
    /// The BFT sync mode (fast or DAG), set by the BFT layer.
    /// `None` for nodes without a BFT layer (clients, provers).
    bft_sync_mode: Option<BftSyncMode>,
}

impl Default for SyncState {
    fn default() -> Self {
        // `status` is set to `Synced` by default to ensure validators of a newly created chain generate blocks.
        Self {
            sync_height: 0,
            greatest_peer_height: None,
            status: SyncStatus::Synced,
            last_change: Instant::now(),
            bft_sync_mode: None,
        }
    }
}

impl SyncState {
    /// Initialize the sync state at the given height.
    /// Useful, when starting a node that already has blocks in its local storage.
    pub fn new_with_height(height: u32) -> Self {
        Self { sync_height: height, ..Default::default() }
    }

    /// Did we catch up with the greatest known peer height?
    /// This will return false if we never synced from a peer.
    pub fn is_block_synced(&self) -> bool {
        self.status == SyncStatus::Synced
    }

    /// Returns `true` if there a blocks to sync from other nodes.
    /// Returns `false` if the node has fully caught up with the rest of the network.
    pub fn can_issue_new_block_requests(&self) -> bool {
        // Return true if sync state is false even if we there are no known blocks to fetch,
        // because otherwise nodes will never  switch to synced at startup.
        if let Some(num_behind) = self.num_blocks_behind() {
            num_behind > 0
        } else {
            debug!("Cannot block sync: the node has not received block locators yet");
            false
        }
    }

    /// Returns the sync height (this is always greater or equal than the ledger height).
    pub fn get_sync_height(&self) -> u32 {
        self.sync_height
    }

    // Compute the number of blocks that we are behind by.
    // Returns None, if there is no known peer height.
    pub fn num_blocks_behind(&self) -> Option<u32> {
        self.greatest_peer_height.map(|peer_height| peer_height.saturating_sub(self.sync_height))
    }

    /// Returns the greatest block height of any connected peer.
    pub fn get_greatest_peer_height(&self) -> Option<u32> {
        self.greatest_peer_height
    }

    /// Returns the BFT sync mode, or `None` if no BFT layer is attached.
    pub fn get_bft_sync_mode(&self) -> Option<BftSyncMode> {
        self.bft_sync_mode
    }

    /// Sets the BFT sync mode.
    ///
    /// # Returns
    /// The previous BFT sync mode (if any).
    pub fn set_bft_sync_mode(&mut self, mode: BftSyncMode) -> Option<BftSyncMode> {
        let prev = self.bft_sync_mode;
        self.bft_sync_mode = Some(mode);
        prev
    }

    /// Update the height we are synced to.
    /// If the value is lower than the current height, the sync height remains unchanged.
    pub fn set_sync_height(&mut self, sync_height: u32) {
        if sync_height <= self.sync_height {
            return;
        }

        trace!("Sync height increased from {old_height} to {sync_height}", old_height = self.sync_height);
        self.sync_height = sync_height;
        self.update_is_block_synced();
    }

    /// Update the greatest known height of a connected peer.
    pub fn set_greatest_peer_height(&mut self, peer_height: u32) {
        if let Some(old_height) = self.greatest_peer_height {
            match old_height.cmp(&peer_height) {
                Ordering::Equal => return,
                Ordering::Greater => warn!("Greatest peer height reduced from {old_height} to {peer_height}"),
                Ordering::Less => trace!("Greatest peer height increased from {old_height} to {peer_height}"),
            }
        }

        self.greatest_peer_height = Some(peer_height);
        self.update_is_block_synced();
    }

    /// Remove the greatest peer height (used when all peers disconnect).
    pub fn clear_greatest_peer_height(&mut self) {
        // No-op if there is no change.
        if self.greatest_peer_height.is_none() {
            return;
        }

        self.greatest_peer_height = None;
        self.update_is_block_synced();
    }

    /// Updates the state of `is_block_synced` for the sync module.
    fn update_is_block_synced(&mut self) {
        trace!(
            "Updating is_block_synced: greatest_peer_height={greatest_peer:?}, current_height={current}, status={status:?}",
            greatest_peer = self.greatest_peer_height,
            current = self.sync_height,
            status = self.status,
        );

        let num_blocks_behind = self.num_blocks_behind();
        let old_status = self.status;

        // If there are no block locators, we consider ourselves synced.
        // Otherwise, validators will never propose certificates.
        let new_status = match num_blocks_behind {
            Some(num) if num <= MAX_BLOCKS_BEHIND => SyncStatus::Synced,
            Some(_) => SyncStatus::Syncing,
            None => SyncStatus::Unsynced,
        };

        // Return early if the state is unchanged
        if new_status == old_status {
            return;
        }

        // Measure how long sync took.
        let now = Instant::now();
        let elapsed = now.saturating_duration_since(self.last_change).as_secs();

        self.status = new_status;
        self.last_change = now;

        match self.status {
            SyncStatus::Synced => {
                if old_status == SyncStatus::Syncing {
                    let elapsed =
                        if elapsed < 60 { format!("{elapsed} seconds") } else { format!("{} minutes", elapsed / 60) };

                    debug!("Block sync state changed to \"synced\". It took {elapsed} to catch up with the network.");
                } else {
                    // If we move directly from unsynced to synced, it means we connected to a peer with a lower height.
                    // In this case it does not make sense to print how long sync took.
                    debug!("Block sync state changed to \"synced\".");
                }
            }
            SyncStatus::Syncing => {
                // num_blocks_behind should never be None at this point,
                // but we still use `unwrap_or` just in case.
                let behind_msg = num_blocks_behind.map(|n| n.to_string()).unwrap_or("unknown".to_string());

                debug!("Block sync state changed to \"syncing\". We are {behind_msg} blocks behind.");
            }
            SyncStatus::Unsynced => {
                debug!("Block sync state changed to \"unsynced\". Connect more peers to resume block sync.");
            }
        }

        // Update the `IS_SYNCED` metric.
        #[cfg(feature = "metrics")]
        metrics::gauge(metrics::bft::IS_SYNCED, self.status == SyncStatus::Synced);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A peer height that is far enough ahead to put the node out of sync.
    const WAY_AHEAD: u32 = 1_000;

    #[test]
    fn a_fresh_state_is_synced_so_a_new_chain_can_produce_blocks() {
        let state = SyncState::default();

        // This default is load-bearing: a validator on a newly created chain has no peer locators,
        // and would never propose a certificate if it started out unsynced.
        assert_eq!(state.status, SyncStatus::Synced);
        assert!(state.is_block_synced());
        assert_eq!(state.get_sync_height(), 0);
        assert_eq!(state.get_greatest_peer_height(), None);
        assert_eq!(state.get_bft_sync_mode(), None);
    }

    #[test]
    fn new_with_height_starts_synced_at_the_given_height() {
        let state = SyncState::new_with_height(42);

        assert_eq!(state.get_sync_height(), 42);
        assert!(state.is_block_synced());
        assert_eq!(state.get_greatest_peer_height(), None);
    }

    #[test]
    fn num_blocks_behind_is_unknown_until_a_peer_locator_arrives() {
        let mut state = SyncState::new_with_height(10);
        assert_eq!(state.num_blocks_behind(), None);

        state.set_greatest_peer_height(15);
        as
```

### Core Architecture Module: `utilities/src/callback_handle.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use anyhow::{Result, bail};
#[cfg(feature = "locktick")]
use locktick::{LockGuard, parking_lot::RwLock};
#[cfg(not(feature = "locktick"))]
use parking_lot::RwLock;
use parking_lot::RwLockReadGuard;

/// Helper struct to hold a reference to a callback struct.
pub struct CallbackHandle<C: Clone + Send + Sync> {
    callback: RwLock<Option<C>>,
}

impl<C: Send + Sync + Clone> Default for CallbackHandle<C> {
    /// By default, the handle holds no callback.
    fn default() -> Self {
        Self { callback: RwLock::new(None) }
    }
}

impl<C: Send + Sync + Clone> CallbackHandle<C> {
    /// Set a callback. Returns an error if a callback was already set.
    pub fn set(&self, callback: C) -> Result<()> {
        let prev = self.callback.write().replace(callback);

        if prev.is_some() {
            bail!("Callback was already set");
        }

        Ok(())
    }

    /// Get a cloned copy of the callback.
    /// Useful when the callback will be used across await-boundaries.
    #[inline]
    pub fn get(&self) -> Option<C> {
        self.callback.read().clone()
    }

    /// Get reference to the callback.
    /// Cannot be shared across await-boundaries.
    #[cfg(feature = "locktick")]
    #[inline]
    pub fn get_ref(&self) -> LockGuard<RwLockReadGuard<'_, Option<C>>> {
        self.callback.read()
    }

    /// Get reference to the callback.
    /// Cannot be shared across await-boundaries.
    #[cfg(not(feature = "locktick"))]
    #[inline]
    pub fn get_ref(&self) -> RwLockReadGuard<'_, Option<C>> {
        self.callback.read()
    }

    /// Remove the callback.
    /// Used during shutdown to resolve circular dependencies between types.
    pub fn clear(&self) {
        let _ = self.callback.write().take();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fresh_handle_holds_no_callback() {
        let handle = CallbackHandle::<u8>::default();

        assert!(handle.get().is_none());
        assert!(handle.get_ref().is_none());
    }

    #[test]
    fn a_callback_can_be_set_once_and_read_back() {
        let handle = CallbackHandle::default();

        assert!(handle.set("callback".to_string()).is_ok());

        assert_eq!(handle.get(), Some("callback".to_string()));
        assert_eq!(handle.get_ref().as_deref(), Some("callback"));
    }

    #[test]
    fn setting_a_second_callback_is_an_error() {
        let handle = CallbackHandle::default();
        handle.set("first".to_string()).unwrap();

        assert!(handle.set("second".to_string()).is_err());
    }

    #[test]
    fn a_rejected_set_has_still_replaced_the_callback() {
        let handle = CallbackHandle::default();
        handle.set("first".to_string()).unwrap();

        let _ = handle.set("second".to_string());

        // `set` swaps the new callback in before deciding to report an error, so the rejection is
        // advisory: the handle holds the callback whose installation "failed". A caller that
        // ignores the error gets a silently swapped callback, not a no-op.
        assert_eq!(handle.get(), Some("second".to_string()));
    }

    #[test]
    fn clearing_makes_the_handle_settable_again() {
        let handle = CallbackHandle::default();
        handle.set("first".to_string()).unwrap();

        handle.clear();
        assert!(handle.get().is_none());

        // This is what lets shutdown break the circular references and then rebuild them.
        assert!(handle.set("second".to_string()).is_ok());
        assert_eq!(handle.get(), Some("second".to_string()));
    }

    #[test]
    fn clearing_an_empty_handle_is_a_no_op() {
        let handle = CallbackHandle::<u8>::default();

        handle.clear();
        handle.clear();

        assert!(handle.get().is_none());
    }
}

```

### Core Architecture Module: `utilities/src/lib.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/// Utilities for signal and shutdown handling.
pub mod signals;

pub use signals::*;

pub mod node_data;
pub use node_data::*;

mod callback_handle;
pub use callback_handle::CallbackHandle;

/// Seed used for deterministic RNG in development mode.
pub const DEVELOPMENT_MODE_RNG_SEED: u64 = 1234567890u64;

/// Configuration for the deterministic dev committee hotswap (`--dev-on-prod`).
#[derive(Clone, Copy, Debug)]
pub struct DevHotswapConfig {
    /// Number of validators in the dev committee.
    pub dev_num_validators: u16,
}

```

### Core Architecture Module: `utilities/src/node_data.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::path::{Path, PathBuf};

/// The filename of the gateway peer cache.
pub const GATEWAY_PEER_CACHE_FILE: &str = "gateway-peer-cache";
/// The old filename of the gateway peer cache.
pub const LEGACY_GATEWAY_PEER_CACHE_FILE: &str = "cached_gateway_peers";

/// The filename of the router peer cache.
pub const ROUTER_PEER_CACHE_FILE: &str = "router-peer-cache";
/// The old filename of the router peer cache.
pub const LEGACY_ROUTER_PEER_CACHE_FILE: &str = "cached_router_peers";

/// The filename of the proposal cache.
pub const CURRENT_PROPOSAL_CACHE_FILE: &str = "current-proposal-cache";

/// The filename of the consensus upgrade that validators require of this node.
pub const REQUIRED_CONSENSUS_UPGRADE_FILE: &str = "required-consensus-upgrade";

/// The filename used to persist the hotswapped dev committee's starting round.
#[cfg(feature = "test_network")]
pub const DEV_COMMITTEE_STATE_FILE: &str = "dev-committee-state";

/// The filename of the JWT secret for a given address.
pub fn jwt_secret_file<D: std::fmt::Display>(address: &D) -> PathBuf {
    PathBuf::from(format!("jwt_secret_{address}.txt"))
}

/// The old filename of the current proposal cache.
pub fn legacy_current_proposal_cache_file(network: u16, dev: Option<u16>) -> PathBuf {
    if let Some(dev) = dev {
        PathBuf::from(format!(".current-proposal-cache-{network}-{dev}"))
    } else {
        PathBuf::from(format!("current-proposal-cache-{network}"))
    }
}

/// Tracks information about where the node-specfic configuration files are stored.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NodeDataDir {
    path: PathBuf,
}

impl NodeDataDir {
    /// Initializes the node data directory the given path.
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Initializes the node data directory to a location suitable for unit/integration tests.
    pub fn new_test(dev: Option<u16>) -> Self {
        if let Some(dev) = dev {
            Self { path: PathBuf::from(format!(".node-data-test-{dev}")) }
        } else {
            Self { path: PathBuf::from(".node-data-test") }
        }
    }

    /// Initializes the node data directory path to the development path for the specified network and node index.
    pub fn new_development(network: u16, dev: u16) -> Self {
        // Use the current directory as the base path, and fall back to the
        // cargo manifest directory if the current directory is not available.
        let path = std::env::current_dir()
            .unwrap_or(PathBuf::from(env!("CARGO_MANIFEST_DIR")))
            .join(format!(".node-data-{network}-{dev}"));

        Self::new(path)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// The location to store the previous peer cache.
    pub fn router_peer_cache_path(&self) -> PathBuf {
        self.path.join(ROUTER_PEER_CACHE_FILE)
    }

    pub fn gateway_peer_cache_path(&self) -> PathBuf {
        self.path.join(GATEWAY_PEER_CACHE_FILE)
    }

    /// The location to store the current proposal cache.
    pub fn current_proposal_cache_path(&self) -> PathBuf {
        self.path.join(CURRENT_PROPOSAL_CACHE_FILE)
    }

    /// The location to record the consensus upgrade that validators require of this node.
    pub fn required_consensus_upgrade_path(&self) -> PathBuf {
        self.path.join(REQUIRED_CONSENSUS_UPGRADE_FILE)
    }

    /// The location used to persist the hotswapped dev committee's starting round.
    #[cfg(feature = "test_network")]
    pub fn dev_committee_state_path(&self) -> PathBuf {
        self.path.join(DEV_COMMITTEE_STATE_FILE)
    }

    /// The location to store the JWT secret for a given address.
    pub fn jwt_secret_path<D: std::fmt::Display>(&self, address: &D) -> PathBuf {
        self.path.join(jwt_secret_file(address))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_cache_filenames_are_pinned() {
        // These are on-disk names. Renaming one does not fail anything at compile time; it just
        // orphans the file a running node already wrote, so the change should be deliberate.
        assert_eq!(ROUTER_PEER_CACHE_FILE, "router-peer-cache");
        assert_eq!(GATEWAY_PEER_CACHE_FILE, "gateway-peer-cache");
        assert_eq!(CURRENT_PROPOSAL_CACHE_FILE, "current-proposal-cache");
        assert_eq!(LEGACY_ROUTER_PEER_CACHE_FILE, "cached_router_peers");
        assert_eq!(LEGACY_GATEWAY_PEER_CACHE_FILE, "cached_gateway_peers");
    }

    #[test]
    fn the_legacy_filenames_are_distinct_from_the_current_ones() {
        assert_ne!(ROUTER_PEER_CACHE_FILE, LEGACY_ROUTER_PEER_CACHE_FILE);
        assert_ne!(GATEWAY_PEER_CACHE_FILE, LEGACY_GATEWAY_PEER_CACHE_FILE);
        assert_ne!(ROUTER_PEER_CACHE_FILE, GATEWAY_PEER_CACHE_FILE);
    }

    #[test]
    fn every_path_is_rooted_at_the_data_dir() {
        let dir = NodeDataDir::new(PathBuf::from("/var/lib/snarkos"));

        for path in [dir.router_peer_cache_path(), dir.gateway_peer_cache_path(), dir.current_proposal_cache_path()] {
            assert!(path.starts_with(dir.path()), "{path:?} escaped the data dir");
            assert_eq!(path.parent().unwrap(), dir.path());
        }
    }

    #[test]
    fn each_cache_path_is_a_distinct_file() {
        let dir = NodeDataDir::new(PathBuf::from("/var/lib/snarkos"));

        // The router and gateway caches hold different peer sets; sharing a filename would have
        // one silently overwrite the other.
        assert_ne!(dir.router_peer_cache_path(), dir.gateway_peer_cache_path());
        assert_ne!(dir.router_peer_cache_path(), dir.current_proposal_cache_path());
        assert_ne!(dir.gateway_peer_cache_path(), dir.current_proposal_cache_path());
    }

    #[test]
    fn the_jwt_secret_path_agrees_with_the_bare_filename_helper() {
        let dir = NodeDataDir::new(PathBuf::from("/var/lib/snarkos"));
        let address = "aleo1example";

        // `cli::commands::start` builds this path itself out of `path()` and `jwt_secret_file`
        // rather than calling `jwt_secret_path`, so the two constructions have to stay in step or
        // the node writes its JWT secret where the reader will not look.
        assert_eq!(dir.jwt_secret_path(&address), dir.path().join(jwt_secret_file(&address)));
    }

    #[test]
    fn the_jwt_secret_filename_is_scoped_to_the_address() {
        assert_eq!(jwt_secret_file(&"aleo1abc"), PathBuf::from("jwt_secret_aleo1abc.txt"));
        assert_ne!(jwt_secret_file(&"aleo1abc"), jwt_secret_file(&"aleo1def"));
    }

    #[test]
    fn the_legacy_proposal_cache_filename_switches_on_dev() {
        // note: the dev form is a hidden file and the non-dev form is not.
        assert_eq!(legacy_current_proposal_cache_file(1, Some(3)), PathBuf::from(".current-proposal-cache-1-3"));
        assert_eq!(legacy_current_proposal_cache_file(1, None), PathBuf::from("current-proposal-cache-1"));

        // Distinct dev indices must not collide.
        assert_ne!(legacy_current_proposal_cache_file(1, Some(0)), legacy_current_proposal_cache_file(1, Some(1)));
        // Neither must distinct networks.
        assert_ne!(legacy_current_proposal_cache_file(0, None), legacy_current_proposal_cache_file(1, None));
    }

    #[test]
    fn test_data_dirs_are_separated_by_dev_index() {
        assert_eq!(NodeDataDir::new_test(None).path(), Path::new(".node-data-test"));
        assert_eq!(NodeDataDir::new_test(Some(2)).path(), Path::new(".node-data-test-2"));

        // Two dev nodes running side by side must not share a data dir.
        assert_ne!(NodeDataDir::new_test(Some(0)), NodeDataDir::new_test(Some(1)));
        assert_ne!(NodeDataDir::new_test(None), NodeDataDir::new_test(Some(0)));
    }

    #[test]
    fn development_data_dirs_are_absolute_and_separated_by_network_and_index() {
        let first = NodeDataDir::new_development(1, 0);
        let second = NodeDataDir::new_development(1, 1);
        let other_network = NodeDataDir::new_development(2, 0);

        // The path is anchored at the current directory, so it must not be a bare relative name.
        assert!(first.path().is_absolute());
        assert_eq!(first.path().file_name().unwrap(), ".node-data-1-0");

        assert_ne!(first, second);
        assert_ne!(first, other_network);
    }
}

```

### Core Architecture Module: `utilities/src/signals.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#[cfg(feature = "locktick")]
use locktick::parking_lot::{Mutex, RwLock};
#[cfg(not(feature = "locktick"))]
use parking_lot::{Mutex, RwLock};

use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use tokio::{runtime::Handle, sync::oneshot};

use tracing::{debug, error, trace};

/// Generic trait that can be queried for whether current process should be stopped.
/// This is implemented by `SignalHandler` and `SimpleStoppable`.
pub trait Stoppable: Send + Sync {
    /// Initiates shutdown of the node.
    fn stop(&self);

    /// Returns `true` if the node is (in the process of being) stopped.
    fn is_stopped(&self) -> bool;
}

/// Wrapper around `AtomicBool` that implements the `Stoppable` trait.
///
/// This is useful when no signal or complex shutdown handling is necessary (e.g., in a test environment).
pub struct SimpleStoppable {
    state: AtomicBool,
}

impl SimpleStoppable {
    pub fn new() -> Arc<Self> {
        Arc::new(Self { state: AtomicBool::new(false) })
    }
}

impl Stoppable for SimpleStoppable {
    fn stop(&self) {
        self.state.store(true, Ordering::SeqCst);
    }

    fn is_stopped(&self) -> bool {
        self.state.load(Ordering::SeqCst)
    }
}

/// Helper for signal handling that implements the `Stoppable` trait.
///
/// This struct will set itself to "stopped" as soon as the process receives Ctrl+C.
/// It can also be manually stopped (e.g., when the node encounters a fatal error)
pub struct SignalHandler {
    /// This sender is used to notify a waiting task that the node has been stopped.
    /// If this is `None`, the node is in the process of shutting down.
    stopped_sender: RwLock<Option<oneshot::Sender<()>>>,

    /// This receiver is used to wait for the node to be stopped.
    stopped_receiver: Mutex<Option<oneshot::Receiver<()>>>,

    /// The reason the node was stopped with, if the process should exit with an error.
    error: Mutex<Option<String>>,

    /// An optional tokio runtime handle.
    pub handle: Option<Handle>,
}

impl SignalHandler {
    /// Spawns a background tasks that listens for Ctrl+C and returns `Self`.
    pub fn new(handle: Option<Handle>) -> Arc<Self> {
        let (stopped_sender, stopped_receiver) = oneshot::channel();
        let obj = Arc::new(Self {
            stopped_sender: RwLock::new(Some(stopped_sender)),
            stopped_receiver: Mutex::new(Some(stopped_receiver)),
            error: Default::default(),
            handle,
        });

        {
            let obj = obj.clone();
            tokio::spawn(async move {
                obj.handle_signals().await;
            });
        }

        obj
    }

    /// Logic for the background task that waits for a signal.
    async fn handle_signals(&self) {
        #[cfg(target_family = "unix")]
        let signal_listener = async move {
            use tokio::signal::unix::{SignalKind, signal};

            // Handle SIGINT, SIGTERM, SIGQUIT, and SIGHUP.
            let mut s_int = signal(SignalKind::interrupt())?;
            let mut s_term = signal(SignalKind::terminate())?;
            let mut s_quit = signal(SignalKind::quit())?;
            let mut s_hup = signal(SignalKind::hangup())?;

            tokio::select!(
                _ = s_int.recv() => trace!("Received SIGINT"),
                _ = s_term.recv() => trace!("Received SIGTERM"),
                _ = s_quit.recv() => trace!("Received SIGQUIT"),
                _ = s_hup.recv() => trace!("Received SIGHUP"),
            );

            std::io::Result::<()>::Ok(())
        };

        #[cfg(not(target_family = "unix"))]
        let signal_listener = async move {
            tokio::signal::ctrl_c().await?;
            std::io::Result::<()>::Ok(())
        };

        // Block until we receive a signal.
        match signal_listener.await {
            Ok(()) => debug!("Received signal, shutting down..."),
            Err(error) => error!("tokio::signal encountered an error: {error}"),
        }

        self.stop();
    }

    /// Stops the node, and records `error` as the reason for the process to exit with an error.
    ///
    /// Only the first error is kept.
    pub fn stop_with_error(&self, error: String) {
        self.error.lock().get_or_insert(error);
        self.stop();
    }

    /// Returns the error the node was stopped with, if any.
    pub fn error(&self) -> Option<String> {
        self.error.lock().clone()
    }

    /// Waits until the signal handler was invoked or the stopped flag was set some other way.
    ///
    /// Note: This can only be called once, and must not be called concurrently.
    pub async fn wait_for_signals(&self) {
        let Some(receiver) = self.stopped_receiver.lock().take() else {
            panic!("wait_for_signals must be called at most once");
        };

        if let Err(err) = receiver.await {
            error!("wait_for_signals encountered an error: {err}");
        }
    }
}

impl Stoppable for SignalHandler {
    fn stop(&self) {
        if let Some(stopped_sender) = self.stopped_sender.write().take() {
            let _ = stopped_sender.send(());
        }
    }

    fn is_stopped(&self) -> bool {
        self.stopped_sender.read().is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_simple_stoppable_starts_running_and_latches_when_stopped() {
        let stoppable = SimpleStoppable::new();
        assert!(!stoppable.is_stopped());

        stoppable.stop();
        assert!(stoppable.is_stopped());

        // Stopping is idempotent; a second fatal error during shutdown must not misbehave.
        stoppable.stop();
        assert!(stoppable.is_stopped());
    }

    #[tokio::test]
    async fn a_signal_handler_can_be_stopped_without_a_signal() {
        let handler = SignalHandler::new(None);
        assert!(!handler.is_stopped());

        // The manual path, used when the node hits a fatal error rather than a Ctrl+C.
        handler.stop();
        assert!(handler.is_stopped());
    }

    #[tokio::test]
    async fn a_signal_handler_keeps_the_first_error_it_was_stopped_with() {
        let handler = SignalHandler::new(None);
        assert_eq!(handler.error(), None);

        handler.stop_with_error("first".to_string());
        handler.stop_with_error("second".to_string());

        assert!(handler.is_stopped());
        assert_eq!(handler.error().as_deref(), Some("first"));
    }

    #[tokio::test]
    async fn stopping_a_signal_handler_twice_is_harmless() {
        let handler = SignalHandler::new(None);

        handler.stop();
        handler.stop();

        assert!(handler.is_stopped());
    }

    #[tokio::test]
    async fn waiting_returns_once_the_handler_is_stopped() {
        let handler = SignalHandler::new(None);

        let waiter = handler.clone();
        let task = tokio::spawn(async move { waiter.wait_for_signals().await });

        handler.stop();

        // The wait must resolve off the manual stop, not only off a real signal.
        tokio::time::timeout(std::time::Duration::from_secs(10), task)
            .await
            .expect("wait_for_signals did not return after stop")
            .unwrap();
    }

    #[tokio::test]
    async fn waiting_returns_immediately_if_already_stopped() {
        let handler = SignalHandler::new(None);
        handler.stop();

        tokio::time::timeout(std::time::Duration::from_secs(10), handler.wait_for_signals())
            .await
            .expect("wait_for_signals did not return for an already-stopped handler");
    }
}

```

### Core Architecture Module: `.ci/rest_api_helper.py`
```
#!/usr/bin/env python3

import asyncio
import aiohttp
import random
import time
import sys

from sys import argv

BLOCK_HEIGHT_URL = "http://localhost:3030/v2/testnet/block/height/latest"
GET_BLOCK_BASE_URL = "http://localhost:3030/v2/testnet/block"
MIN_BLOCK = 1
MAX_BLOCK = 250
NUM_WORKERS = 8

# Statistics
stats = {
    'successful_requests': 0,
    'failed_requests': 0,
}


def write_results(mode, total_wait, endpoint):
    num_ops = stats['successful_requests']
    throughput = num_ops / total_wait

    print(f'🎉 REST benchmark "{mode}" done! It took {total_wait} seconds'
          f' for {num_ops} ops. Throughput was {throughput} ops/s.')

    with open('info.txt', 'r') as f:
        snapshot_info = f.read().replace('\n', '')

    with open("results.json", "a") as f:
        f.write(f'{{ "name": "rest-{mode}", "unit": "ops/s", '
                f'"value": {throughput}, "extra": "num_ops={num_ops}, '
                f'total_wait={total_wait}, endpoint={endpoint}, '
                f'{snapshot_info}" }},\n')


async def make_request(session, worker_id, mode):
    """Make a single async request to the block endpoint"""

    if mode == "get-block":
        # Checks that any block can be retrieved in a reasonable time.
        block_id = random.randint(MIN_BLOCK, MAX_BLOCK)
        url = f"{GET_BLOCK_BASE_URL}/{block_id}"
    elif mode == "get-latest-block":
        # Tests that the most recent block(s) are cached and can be retrieved even quicker.
        url = f"{GET_BLOCK_BASE_URL}/{MAX_BLOCK}"
    elif mode == "block-height":
        # Fetches the current block height as a basline for the REST API speed.
        url = BLOCK_HEIGHT_URL
    else:
        raise RuntimeError(f'Unknown REST mode "{mode}"')

    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=100)) as response:
            content = await response.read()

            if response.status == 200:
                stats['successful_requests'] += 1
                return True
            else:
                print(f"Request failed: {content}")
                stats['failed_requests'] += 1
                return False

    except asyncio.TimeoutError:
        print("ERROR: Request timed out!")
        stats['failed_requests'] += 1
        return False

    except Exception as err:
        print(f"ERROR: Got exception: {err}")
        stats['failed_requests'] += 1
        return False


async def worker(session, worker_id, mode, reqs_per_worker):
    """Worker coroutine that makes multiple requests"""
    print(f"Worker {worker_id} starting...")
    worker_successful = 0
    worker_failed = 0

    for i in range(reqs_per_worker):
        success = await make_request(session, worker_id, mode)

        if success:
            worker_successful += 1
            if (i+1) % 10 == 0:  # Log every 10th request
                print(f'Worker {worker_id}: Finished {i+1} of '
                      f'{reqs_per_worker} requests')
        else:
            worker_failed += 1
            break

    return worker_successful, worker_failed


async def main(mode, num_workers, reqs_per_worker):
    """Main async function to coordinate the workers"""

    if mode in ["get-block", "get-latest-block"]:
        base_url = GET_BLOCK_BASE_URL
    elif mode == "block-height":
        base_url = BLOCK_HEIGHT_URL
    else:
        raise RuntimeError(f'Unknown REST mode "{mode}"')

    print(f'Starting {num_workers} async workers for "{mode}", '
          f' each making {reqs_per_worker} requests...')
    print(f"Target endpoint: {base_url}")
    print("")

    start_time = time.time()

    # Create HTTP session with connection pooling
    connector = aiohttp.TCPConnector(
        limit=100,  # Total connection pool size
        limit_per_host=50,  # Max connections per host
        keepalive_timeout=30,
        enable_cleanup_closed=True
    )

    async with aiohttp.ClientSession(connector=connector) as session:
        # Create and run all workers concurrently
        tasks = [worker(session, i+1, mode, reqs_per_worker) for i in range(num_workers)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Worker {i+1} failed with exception: {result}")
            else:
                worker_successful, worker_failed = result

    end_time = time.time()
    duration = end_time - start_time

    if stats['failed_requests'] > 0:
        print(f'REST benchmark "{mode}" failed')
        sys.exit(1)
    else:
        write_results(mode, duration, base_url)
        sys.exit(0)

if __name__ == "__main__":
    # what type of benchmark to run?
    mode = argv[1]
    # how many client tasks?
    num_workers = int(argv[2])
    # how many requests per client task?
    reqs_per_worker = int(argv[3])

    # Run the async main function
    asyncio.run(main(mode, num_workers, reqs_per_worker))

```

### Core Architecture Module: `account/src/lib.rs`
```
// Copyright (c) 2019-2026 Provable Inc.
// This file is part of the snarkOS library.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#![forbid(unsafe_code)]

use snarkvm::{
    console::{network::prelude::*, types::Field},
    prelude::*,
};

use colored::*;
use core::fmt;

/// A helper struct for an Aleo account.
#[derive(Clone, Debug)]
pub struct Account<N: Network> {
    /// The account private key.
    private_key: PrivateKey<N>,
    /// The account view key.
    view_key: ViewKey<N>,
    /// The account address.
    address: Address<N>,
}

impl<N: Network> Account<N> {
    /// Samples a new account.
    pub fn new<R: Rng + CryptoRng>(rng: &mut R) -> Result<Self> {
        Self::try_from(PrivateKey::new(rng)?)
    }

    /// Returns the account private key.
    pub const fn private_key(&self) -> &PrivateKey<N> {
        &self.private_key
    }

    /// Returns the account view key.
    pub const fn view_key(&self) -> &ViewKey<N> {
        &self.view_key
    }

    /// Returns the account address.
    pub const fn address(&self) -> Address<N> {
        self.address
    }
}

impl<N: Network> Account<N> {
    /// Returns a signature for the given message (as field elements), using the account private key.
    pub fn sign<R: Rng + CryptoRng>(&self, message: &[Field<N>], rng: &mut R) -> Result<Signature<N>> {
        Signature::sign(&self.private_key, message, rng)
    }

    /// Returns a signature for the given message (as bytes), using the account private key.
    pub fn sign_bytes<R: Rng + CryptoRng>(&self, message: &[u8], rng: &mut R) -> Result<Signature<N>> {
        Signature::sign_bytes(&self.private_key, message, rng)
    }

    /// Returns a signature for the given message (as bits), using the account private key.
    pub fn sign_bits<R: Rng + CryptoRng>(&self, message: &[bool], rng: &mut R) -> Result<Signature<N>> {
        Signature::sign_bits(&self.private_key, message, rng)
    }

    /// Verifies a signature for the given message (as fields), using the account address.
    pub fn verify(&self, message: &[Field<N>], signature: &Signature<N>) -> bool {
        signature.verify(&self.address, message)
    }

    /// Verifies a signature for the given message (as bytes), using the account address.
    pub fn verify_bytes(&self, message: &[u8], signature: &Signature<N>) -> bool {
        signature.verify_bytes(&self.address, message)
    }

    /// Verifies a signature for the given message (as bits), using the account address.
    pub fn verify_bits(&self, message: &[bool], signature: &Signature<N>) -> bool {
        signature.verify_bits(&self.address, message)
    }
}

impl<N: Network> TryFrom<PrivateKey<N>> for Account<N> {
    type Error = Error;

    /// Initializes a new account from a private key.
    fn try_from(private_key: PrivateKey<N>) -> Result<Self, Self::Error> {
        Self::try_from(&private_key)
    }
}

impl<N: Network> TryFrom<&PrivateKey<N>> for Account<N> {
    type Error = Error;

    /// Initializes a new account from a private key.
    fn try_from(private_key: &PrivateKey<N>) -> Result<Self, Self::Error> {
        let view_key = ViewKey::try_from(private_key)?;
        let address = view_key.to_address();
        Ok(Self { private_key: *private_key, view_key, address })
    }
}

impl<N: Network> TryFrom<String> for Account<N> {
    type Error = Error;

    /// Initializes a new account from a private key string.
    fn try_from(private_key: String) -> Result<Self, Self::Error> {
        Self::try_from(&private_key)
    }
}

impl<N: Network> TryFrom<&String> for Account<N> {
    type Error = Error;

    /// Initializes a new account from a private key string.
    fn try_from(private_key: &String) -> Result<Self, Self::Error> {
        Self::from_str(private_key.as_str())
    }
}

impl<N: Network> TryFrom<&str> for Account<N> {
    type Error = Error;

    /// Initializes a new account from a private key string.
    fn try_from(private_key: &str) -> Result<Self, Self::Error> {
        Self::from_str(private_key)
    }
}

impl<N: Network> FromStr for Account<N> {
    type Err = Error;

    /// Initializes a new account from a private key string.
    fn from_str(private_key: &str) -> Result<Self, Self::Err> {
        Self::try_from(PrivateKey::from_str(private_key)?)
    }
}

impl<N: Network> Display for Account<N> {
    /// Renders the account as a string.
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use snarkvm::prelude::MainnetV0;

    type CurrentNetwork = MainnetV0;

    #[test]
    fn test_sign() {
        // Initialize the RNG.
        let mut rng = TestRng::default();
        // Prepare the account and message.
        let account = Account::<CurrentNetwork>::new(&mut rng).unwrap();
        let message = vec![Field::rand(&mut rng); 10];
        // Sign and verify.
        let signature = account.sign(&message, &mut rng).unwrap();
        assert!(account.verify(&message, &signature));
    }

    #[test]
    fn test_sign_bytes() {
        // Initialize the RNG.
        let mut rng = TestRng::default();
        // Prepare the account and message.
        let account = Account::<CurrentNetwork>::new(&mut rng).unwrap();

        // TODO(kaimast): remove once we upgrade the rand crate
        let message = (0..10).map(|_| rng.random::<u8>()).collect::<Vec<u8>>();
        // Sign and verify.
        let signature = account.sign_bytes(&message, &mut rng).unwrap();
        assert!(account.verify_bytes(&message, &signature));
    }

    #[test]
    fn test_sign_bits() {
        // Initialize the RNG.
        let mut rng = TestRng::default();
        // Prepare the account and message.
        let account = Account::<CurrentNetwork>::new(&mut rng).unwrap();
        let message = (0..10).map(|_| rng.random::<bool>()).collect::<Vec<bool>>();
        // Sign and verify.
        let signature = account.sign_bits(&message, &mut rng).unwrap();
        assert!(account.verify_bits(&message, &signature));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4466** (2026-09-29): **[Bug] Spurious ERROR log: Attempted to decrease GC round from 36 to 34**
  *Symptoms*: ## 🐛 Bug Report  Link to testrun: https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4270/workflows/6fe7a02c-9a65-48f9-86f1-b2438b7f6616/jobs/90558?utm_campaign=vcs-integration-link&utm_medium=referral&utm_source=github-checks-link  [ci-runner] 2026-09-17T17:42:01Z ❌ Test failed! Validator #1 logs contain errors. 2026-09-17T17:41:13.258841Z ERROR Block synchronization failed — Failed to garbage collect certificates — Attempted to decrease GC round from 36 to 34 
  **Post-Mortem & Fix Analysis**:
  > Likely already solved by 67810a9.

- **Issue #4407** (2026-09-02): **[Bug] There are 1 surplus live tasks**
  *Symptoms*: ## 🐛 Bug Report  Our good old friend has returned.  Example failure: https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4133/workflows/4789b13b-832a-46b2-a997-5109a89c889a/jobs/86849 
  **Post-Mortem & Fix Analysis**:
  > From what I can tell, this is fixed in `staging,` and it's the nature of this specific test script that caused (and will keep causing until the next release) the failure, as it involves a node upgrade, and the version being upgraded doesn't have the fix just yet.
  > Closing per @ljedrz's diagnosis above: this is fixed in `staging`, and the remaining CI failures are an artifact of the test script upgrading from a release that predates the fix.

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

### Incident Patch 1: `1f4eee02` (2026-10-28)
**Commit Message**: Merge pull request #4534 from aleo-labs-protocol/feat/upgrade-schedule-handshake

Exchange consensus schedules in the gateway handshake, and stop before an unsupported version activates

**File**: `.ci/test_upgrade_required.sh` (added, +230/-0)
```diff
@@ -0,0 +1,230 @@
+#!/bin/bash
+
+####################################################
+# Runs a devnet in which one validator lacks the next consensus version.
+# Checks that the outdated validator warns as soon as it connects, keeps building blocks up to 100
+# blocks before the activation height, and then exits with an error and without forking. Checks the
+# same exit on every restart, with or without its record of the required upgrade. Then checks that
+# it rejoins the network once upgraded, and that it discards a record no validator confirms.
+####################################################
+
+set -eo pipefail
+
+network_id=0
+total_validators=4
+activation_height=150
+# The outdated validator builds no block from REQUIRED_UPGRADE_SAFETY_MARGIN blocks before the activation.
+safety_margin=100
+stop_height=$((activation_height - safety_margin))
+target_height=180
+# The outdated validator is the last one, so that the upgraded ones form a contiguous range.
+outdated_validator=$((total_validators-1))
+NODE_VERBOSITY=2
+
+# shellcheck source=SCRIPTDIR/utils.sh
+. ./.ci/utils.sh
+
+network_name=$(get_network_name "$network_id")
+
+# Logs a failure and exits.
+function fail() {
+  log "⛔️ $*"
+  exit 1
+}
+init_log_dir
+
+trap stop_nodes EXIT
+
+# The heights of V1..V21 match the test defaults; only V22 differs.
+base_heights="0,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24"
+upgraded_heights="$base_heights,$activation_height"
+outdated_heights="$base_heights,4294967295"
+
+common_flags=(
+  --nodisplay --nobanner --noupdater "--network=$network_id" "--verbosity=$NODE_VERBOSITY"
+  "--dev-num-validators=$total_validators" "--dev-num-clients=0"
+)
+
+upgraded_port=3030
+outdated_port=$((3030+outdated_validator))
+outdated_metrics_port=9000
+record_file=".node-data-$network_id-$outdated_validator/required-consensus-upgrade"
+# The activation height and ConsensusVersion::V22, in the little-endian encoding of the record.
+expected_record="$(printf '%08x' "$activation_height" | sed -E 's/(..)(..)(..)(..)/\4\3\2\1/')1600"
+
+# Starts validator $1 with the consensus version heights $2, logging to $3.
+function start_validator() {
+  local index=$1
+  local heights=$2
+  local log_file=$3
+  local metrics_flags=()
+  if (( index == outdated_validator )); then
+    metrics_flags=(--metrics "--metrics-ip=$localhost:$outdated_metrics_port")
+  fi
+  CONSENSUS_VERSION_HEIGHTS=$heights run_with_prefix "validator-$index" snarkos start "${common_flags[@]}" \
+    "--dev=$index" --validator "--logfile=$log_file" "--rest=$localhost:$((3030+index))" --no-dev-txs \
+    "${metrics_flags[@]}"
+  PIDS[index]=$!
+}
+
+# Prints the hash of the block at height $2 on the node with the REST port $1, or nothing.
+function block_hash() {
+  curl -s --max-time 5 "http://$localhost:$1/v2/$network_name/block/$2" | jq -r '.block_hash // empty' 2>/dev/null || true
+}
+
+# Fails unless the upgraded validators hold the block with hash $2 at height $1.
+function check_no_fork() {
+  local height=$1
+  local outdated_hash=$2
+  local upgraded_hash
+  upgraded_hash=$(block_hash "$upgraded_port" "$height")
+  if [[ -z "$outdated_hash" || "$outdated_hash" != "$upgraded_hash" ]]; then
+    fail "At height $height, the outdated validator holds '$outdated_hash' and the upgraded ones '$upgraded_hash'"
+  fi
+}
+
+# Waits for the outdated validator to exit, and checks that it exited with an error, recorded the
+# required upgrade, and holds no block the upgraded validators lack. $1 names the run, $2 is its log
+# file, and $3, if set, is the lowest height it must have reached; it must not exceed the activation
+# height. Sets `warned_height` to its height when it first warned of the upgrade, if it did, and
+# `reported_upgrade` if its metrics reported that it needs an upgrade.
+function expect_outdated_exit() {
+  local run=$1
+  local log_file=$2
+  local min_height=$3
+  local pid=${PIDS[outdated_validator]}
+  local height last_height="" last_hash="" hash start
+  warned_height=""
+  reported_upgrade=""
+  start=$(now)
+
+  while kill -0 "$pid" 2>/dev/null; do
+    if (( $(elapsed_since "$start") > 600 )); then
+      fail "The outdated validator did not exit ($run)"
+    fi
+    height=$(get_block_height_by_port "$outdated_port" "$network_name" 5)
+    if [[ -n "$height" ]]; then
+      hash=$(block_hash "$outdated_port" "$height")
+      if [[ -n "$hash" ]]; then
+        last_height=$height
+        last_hash=$hash
+      fi
+      if [[ -z "$warned_height" ]] && grep -q "This node stops before building block" "$log_file"; then
+        warned_height=$height
+      fi
+      if [[ -n "$warned_height" && -z "$reported_upgrade" ]]; then
+        # Read the metrics first: with `pipefail`, `grep -q` exiting early would fail `curl`.
+        metrics=$(curl -s --max-time 5 "http://$localhost:$outdated_metrics_port/metrics" || true)
+        if grep -q "^snarkos_consensus_needs_upgrade 1$" <<< "$metrics"; then
+          reported_upgrade
```

**File**: `README.md` (modified, +21/-0)
```diff
@@ -216,6 +216,27 @@ cargo install --locked --path .
 
 Telemetry is included by default when running `./scripts/run-validator.sh`.
 
+### 3.2.2 Required Consensus Upgrades
+
+During the handshake, each validator shares the consensus version schedule of its build. Your validator needs an upgrade when validators that hold at least a third of the stake schedule a consensus version that your build does not run at that height. Your validator learns this as soon as those validators connect, which is usually long before the activation height.
+
+When an upgrade is required, your validator:
+
+1. Exports the metric `snarkos_consensus_needs_upgrade` with the value `1`. The metrics `snarkos_consensus_required_upgrade_height` and `snarkos_consensus_required_upgrade_version` give the activation height and the version.
+2. Logs an error every 10 minutes, with the version and the activation height.
+3. Keeps building blocks until 100 blocks before the activation height. There it stops and exits with an error, instead of forking.
+
+If you run a validator, start it with `--metrics`, and alert when `snarkos_consensus_needs_upgrade` is greater than `0`. Then upgrade snarkOS at least 100 blocks before the height in `snarkos_consensus_required_upgrade_height`. For example, as a Prometheus alerting rule:
+
+```yaml
+- alert: SnarkOSNeedsUpgrade
+  expr: snarkos_consensus_needs_upgrade > 0
+  annotations:
+    summary: "{{ $labels.instance }} must be upgraded 100 blocks before the height in snarkos_consensus_required_upgrade_height"
+```
+
+A validator that exits with this error needs an upgrade, not a restart. It writes the requirement to `required-consensus-upgrade` in its node data directory, and a restart with the same build exits again. An upgraded build removes the file.
+
 ## 3.3 Run an Aleo Prover
 
 Start by following the instructions in the [Build Guide](#2-build-guide).
```

**File**: `cli/src/commands/start.rs` (modified, +5/-0)
```diff
@@ -1013,6 +1013,11 @@ impl Start {
         }
 
         node.wait_for_signals(&signal_handler).await;
+
+        // Exit with an error, so that the node is not mistaken for one that was stopped on purpose.
+        if let Some(error) = signal_handler.error() {
+            bail!(error);
+        }
         Ok(())
     }
 
```

**File**: `node/bft/events/src/helpers/handshake.rs` (modified, +264/-4)
```diff
@@ -21,7 +21,7 @@
 //! The four messages are:
 //!
 //! 1. `->` [`HandshakeHint`] - cleartext, so the responder can bail out before doing any work.
-//! 2. `<-` [`PeerInfo`] - the responder's metadata, deliberately without a signature.
+//! 2. `<-` [`ResponderInfo`] - the responder's metadata, deliberately without a signature.
 //! 3. `->` [`InitiatorInfo`] - the initiator's metadata *and* the proof of its identity.
 //! 4. `<-` [`ResponderProof`] - the responder's verdict, and its own proof if the initiator checked
 //!    out. This is the first transport message, the pattern having ended with the third.
@@ -43,6 +43,14 @@
 //! it earlier. What must not change is that anything the responder acts on ends up covered by one of
 //! the two: metadata reaching it unencrypted *after* message 2 would be bound by neither.
 //!
+//! # Fields after the original layout
+//!
+//! Peers that predate a field ignore whatever follows the fields they know, as handshake payloads
+//! are decoded without a check for leftover bytes. Fields added since are therefore appended to the
+//! end of messages 2 and 3, behind a length prefix, as the [`HandshakeTrailer`]. A field must not go
+//! into [`PeerInfo`] itself: in message 3 it is followed by the signature, which an older peer would
+//! then misread.
+//!
 //! The separate reason the responder re-checks the hint against [`InitiatorInfo`] is a
 //! self-inconsistent initiator, not tampering. Nothing stops a peer from claiming one value in the
 //! hint, having the responder run its early checks against it, and then authenticating a different
@@ -58,6 +66,8 @@ use snarkvm::{
     prelude::{Address, Field, Signature},
 };
 
+use tracing::warn;
+
 use std::{io::Result as IoResult, net::SocketAddr};
 
 /// The domain separator for the signatures binding an Aleo address to a gateway Noise session.
@@ -181,6 +191,141 @@ impl<N: Network> FromBytes for PeerInfo<N> {
     }
 }
 
+/// The activation height of each consensus version that a build schedules, in version order,
+/// starting with `ConsensusVersion::V1`. A version that is not scheduled has the height `u32::MAX`.
+///
+/// Versions are positions rather than `ConsensusVersion`s, so that a schedule that names a version
+/// this build does not define still decodes.
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub struct ConsensusSchedule {
+    heights: Vec<u32>,
+}
+
+impl ConsensusSchedule {
+    /// Initializes a schedule from the activation heights of versions 1, 2, and so on.
+    ///
+    /// The number of versions is encoded as a `u8`. In practice, the 1024-byte limit on handshake
+    /// messages caps a schedule at about 150 versions.
+    pub fn new(heights: Vec<u32>) -> IoResult<Self> {
+        u8::try_from(heights.len()).map_err(io_error)?;
+        Ok(Self { heights })
+    }
+
+    /// Returns the schedule of this build.
+    pub fn of<N: Network>() -> Self {
+        // `N::CONSENSUS_HEIGHT` indexes the table by version, so it is in version order.
+        Self { heights: N::CONSENSUS_VERSION_HEIGHTS().iter().map(|(_, height)| *height).collect() }
+    }
+
+    /// Returns the activation heights of versions 1, 2, and so on.
+    pub fn heights(&self) -> &[u32] {
+        &self.heights
+    }
+}
+
+impl ToBytes for ConsensusSchedule {
+    fn write_le<W: Write>(&self, mut writer: W) -> IoResult<()> {
+        let num_versions = u8::try_from(self.heights.len()).map_err(io_error)?;
+        num_versions.write_le(&mut writer)?;
+        self.heights.iter().try_for_each(|height| height.write_le(&mut writer))
+    }
+}
+
+impl FromBytes for ConsensusSchedule {
+    fn read_le<R: Read>(mut reader: R) -> IoResult<Self> {
+        let num_versions = u8::read_le(&mut reader)?;
+        let heights = (0..num_versions).map(|_| u32::read_le(&mut reader)).collect::<IoResult<_>>()?;
+        Ok(Self { heights })
+    }
+}
+
+/// The fields appended to messages 2 and 3 after their original layout.
+///
+/// It is written as a `u16` length followed by the fields, so that fields added later are skipped by
+/// peers that only know the earlier ones. A missing or malformed trailer decodes as one without
+/// fields. That is only acceptable from a peer below [`Self::FIRST_VERSION`]; the gateway rejects a
+/// peer at or above it that sends no schedule.
+///
+/// The responder's trailer, in message 2, is covered by the responder's signature. The initiator's
+/// trailer, in message 3, is not covered by the initiator's signature, which is made before that
+/// message; the AEAD of the Noise session binds it, like the rest of message 3.
+#[derive(Clone, Debug, Default, PartialEq, Eq)]
+pub struct HandshakeTrailer {
+    /// The consensus schedule of the sender's build.
+    pub schedule: Option<ConsensusSchedule>,
+}
+
+impl HandshakeTrailer {
+    /// The first event version whose handshake messages 2 and 3 must carry a trailer with a schedule.
+    pub const FIRST_VERSION: u32 = 11;
+
+    /// Returns the trailer that this build sends.
+
```

**File**: `node/bft/events/src/lib.rs` (modified, +5/-2)
```diff
@@ -171,8 +171,11 @@ macro_rules! with_data_payload {
 }
 
 impl<N: Network> Event<N> {
-    /// The version of the event protocol; it can be incremented in order to force users to update.
-    pub const VERSION: u32 = 10;
+    /// The oldest event protocol version this node accepts from a peer; it can be incremented in
+    /// order to force users to update.
+    pub const MINIMUM_VERSION: u32 = 10;
+    /// The version of the event protocol this node speaks.
+    pub const VERSION: u32 = 11;
 
     /// Serializes the event's [`Data`] payload, if it holds one that is not already serialized.
     ///
```

**File**: `node/bft/src/bft.rs` (modified, +8/-2)
```diff
@@ -15,7 +15,7 @@
 
 use crate::{
     MAX_LEADER_CERTIFICATE_DELAY,
-    helpers::{ConsensusSender, DAG, PrimaryReceiver, PrimarySender, Storage, fmt_id, now},
+    helpers::{BlockHeldBack, ConsensusSender, DAG, PrimaryReceiver, PrimarySender, Storage, fmt_id, now},
     primary::{Primary, PrimaryCallback},
     sync::SyncCallback,
 };
@@ -774,8 +774,14 @@ impl<N: Network> BFT<N> {
                     Ok(Ok(true)) => (),
                     Ok(Ok(false)) => ledger_already_advanced = true,
                     Ok(Err(err)) => {
+                        // A held-back block is retried with the next commit, as the subdag stays uncommitted.
+                        let is_held_back = err.downcast_ref::<BlockHeldBack>().is_some();
                         let err = err.context(format!("BFT failed to advance the subdag for round {anchor_round}"));
-                        error!("{}", &flatten_error(err));
+                        if is_held_back {
+                            warn!("{}", &flatten_error(err));
+                        } else {
+                            error!("{}", &flatten_error(err));
+                        }
                         return Ok(());
                     }
                     Err(err) => {
```

**File**: `node/bft/src/gateway.rs` (modified, +120/-27)
```diff
@@ -22,7 +22,7 @@ use crate::{
     MEMORY_POOL_PORT,
     Worker,
     events::{DisconnectReason, EventCodec, PrimaryPing},
-    helpers::{Cache, PrimarySender, Storage, SyncSender, WorkerSender, assign_to_worker},
+    helpers::{Cache, PrimarySender, Storage, SyncSender, UpgradeMonitor, WorkerSender, assign_to_worker},
     spawn_blocking,
 };
 use smol_str::SmolStr;
@@ -32,12 +32,15 @@ use snarkos_node_bft_events::{
     BlockResponse,
     CertificateRequest,
     CertificateResponse,
+    ConsensusSchedule,
     DataBlocks,
     Event,
     HANDSHAKE_DOMAIN,
     HandshakeHint,
+    HandshakeTrailer,
     InitiatorInfo,
     PeerInfo,
+    ResponderInfo,
     ResponderProof,
     TransmissionRequest,
     TransmissionResponse,
@@ -210,6 +213,8 @@ pub struct InnerGateway<N: Network> {
     worker_senders: OnceCell<IndexMap<u8, WorkerSender<N>>>,
     /// The sync sender.
     sync_sender: OnceCell<SyncSender<N>>,
+    /// Tracks the consensus schedules of validators, and whether this build may build a block.
+    upgrade_monitor: UpgradeMonitor<N>,
     /// The spawned handles.
     handles: Mutex<Vec<JoinHandle<()>>>,
     /// The storage mode.
@@ -293,6 +298,8 @@ impl<N: Network> Gateway<N> {
         #[cfg(feature = "metrics")]
         let (validator_telemetry, telemetry_worker) = Telemetry::new();
 
+        let upgrade_monitor = UpgradeMonitor::new(account.address(), node_data_dir.required_consensus_upgrade_path());
+
         // Return the gateway.
         Ok(Self(Arc::new(InnerGateway {
             account,
@@ -309,6 +316,7 @@ impl<N: Network> Gateway<N> {
             primary_sender: Default::default(),
             worker_senders: Default::default(),
             sync_sender: Default::default(),
+            upgrade_monitor,
             handles: Default::default(),
             node_data_dir,
             trusted_peers_only,
@@ -445,6 +453,40 @@ impl<N: Network> Gateway<N> {
         &self.resolver
     }
 
+    /// Returns the upgrade monitor.
+    pub fn upgrade_monitor(&self) -> &UpgradeMonitor<N> {
+        &self.upgrade_monitor
+    }
+
+    /// Returns the committee and the addresses of the connected validators, as the upgrade monitor
+    /// weighs them.
+    ///
+    /// The committee is the lookback committee for the current round, which certifies the blocks
+    /// this validator builds next.
+    fn upgrade_evidence(&self) -> Result<(Committee<N>, HashSet<Address<N>>)> {
+        let committee = self.ledger.get_committee_lookback_for_round(self.storage.current_round())?;
+        Ok((committee, self.connected_addresses()))
+    }
+
+    /// Re-evaluates the upgrade status for the next block.
+    fn update_upgrade_status(&self) {
+        let (committee, connected) = match self.upgrade_evidence() {
+            Ok(evidence) => evidence,
+            Err(error) => {
+                warn!("{CONTEXT} Unable to retrieve the committee to evaluate consensus schedules - {error}");
+                return;
+            }
+        };
+        let next_height = self.ledger.latest_block_height().saturating_add(1);
+        self.upgrade_monitor.update(&committee, &connected, next_height);
+    }
+
+    /// Returns an error unless this build may build the block at `height`.
+    pub fn ensure_block_may_be_built(&self, height: u32) -> Result<()> {
+        let (committee, connected) = self.upgrade_evidence()?;
+        self.upgrade_monitor.ensure_block_may_be_built(&committee, &connected, height)
+    }
+
     /// Returns the listener IP address from the (ambiguous) peer address.
     pub fn resolve_to_listener(&self, connected_addr: &SocketAddr) -> Option<SocketAddr> {
         self.resolver.read().get_listener(*connected_addr)
@@ -810,7 +852,7 @@ impl<N: Network> Gateway<N> {
                 let PrimaryPing { version, block_locators, primary_certificate } = ping;
 
                 // Ensure the event version is not outdated.
-                if version < Event::<N>::VERSION {
+                if version < Event::<N>::MINIMUM_VERSION {
                     bail!("Dropping '{peer_ip}' on event version {version} (outdated)");
                 }
 
@@ -979,6 +1021,8 @@ impl<N: Network> Gateway<N> {
     async fn heartbeat(&self) {
         // Log the connected validators.
         self.log_connected_validators();
+        // Re-evaluate whether validators run a consensus version this build lacks.
+        self.update_upgrade_status();
         // Log the validator participation scores.
         #[cfg(feature = "metrics")]
         self.log_participation_scores();
@@ -1619,13 +1663,17 @@ impl<N: Network> Handshake for Gateway<N> {
         // Register the peer, or roll it back, if the handshake got far enough to learn its listening
         // address.
         match (&handshake_result, listener_addr) {
-            (Ok(peer_info), Some(addr)) => {
+            (Ok((peer_info, peer_schedule)), Some(addr)) => {
                 let node_type = if bootstrap_peers::<N>(self.is_dev()).contains(&a
```

**File**: `node/bft/src/helpers/mod.rs` (modified, +3/-0)
```diff
@@ -51,6 +51,9 @@ pub use telemetry::*;
 pub mod timestamp;
 pub use timestamp::*;
 
+pub mod upgrade_monitor;
+pub use upgrade_monitor::*;
+
 /// Formats an ID into a truncated identifier (for logging purposes).
 pub fn fmt_id(id: impl ToString) -> String {
     let id = id.to_string();
```

---

### Incident Patch 2: `e19d9479` (2026-10-28)
**Commit Message**: Refute an unreadable record only with a quorum not ahead at any height

An unreadable record stood for an upgrade at height 0, where every build
runs V1, so any connected quorum refuted it within seconds, whatever it
schedules later. The record now holds back every block until this
validator and the connected validators that are ahead of this build at
no height hold a quorum.

The comment on the per-member check now says that a faulty member holds
back one height, not one block per handshake, and only while this
validator is connected to less than a quorum that is not ahead there.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01UYfmmMf4knQyc7bmfeSuZ7

**File**: `node/bft/src/helpers/upgrade_monitor.rs` (modified, +57/-23)
```diff
@@ -193,6 +193,10 @@ fn metric_values(status: UpgradeStatus, recorded: Option<RequiredUpgrade>) -> (u
     }
 }
 
+/// The record that stands in for one that cannot be read. It holds back every block until a quorum
+/// that is not ahead of this build at any height refutes it.
+const UNREADABLE_RECORD: RequiredUpgrade = RequiredUpgrade { height: 0, consensus_version: u16::MAX };
+
 /// The evidence the monitor keeps.
 struct State<N: Network> {
     /// The steps of the schedule each validator disclosed in its latest handshake.
@@ -228,13 +232,11 @@ pub struct UpgradeMonitor<N: Network> {
 impl<N: Network> UpgradeMonitor<N> {
     /// Initializes the monitor of the validator at `address` from the record at `record_path`.
     ///
-    /// A record of an upgrade that this build schedules is removed. Any other record, including one
-    /// that cannot be read, holds back the blocks from its stop height until connected validators
-    /// refute it.
+    /// A record of an upgrade that this build schedules is removed. Any other record holds back the
+    /// blocks from its stop height until connected validators refute it, and one that cannot be
+    /// read holds back every block.
     pub fn new(address: Address<N>, record_path: PathBuf) -> Self {
         let own = Steps::new(&ConsensusSchedule::of::<N>());
-        // A record that cannot be read holds back every block.
-        let unreadable = RequiredUpgrade { height: 0, consensus_version: u16::MAX };
         let recorded = match read_record(&record_path) {
             Ok(None) => None,
             Ok(Some(recorded)) if own.version_at(recorded.height) >= recorded.consensus_version => {
@@ -258,7 +260,7 @@ impl<N: Network> UpgradeMonitor<N> {
             }
             Err(error) => {
                 warn!("Unable to read the required upgrade at {} - {error}", record_path.display());
-                Some(unreadable)
+                Some(UNREADABLE_RECORD)
             }
         };
         let state = State { schedules: Default::default(), recorded, warned_at: None, metrics: (0, 0, 0) };
@@ -296,15 +298,22 @@ impl<N: Network> UpgradeMonitor<N> {
             return UpgradeStatus::Required(required);
         }
 
-        if let Some(recorded) = state.recorded
-            && self.is_refuted(state, committee, connected, recorded.height)
-        {
-            info!(
-                "Connected validators holding a quorum of stake do not run ConsensusVersion::V{} at height {}",
-                recorded.consensus_version, recorded.height
-            );
-            remove_record(&self.record_path);
-            state.recorded = None;
+        if let Some(recorded) = state.recorded {
+            let refuted_height = (recorded != UNREADABLE_RECORD).then_some(recorded.height);
+            if self.is_refuted(state, committee, connected, refuted_height) {
+                match refuted_height {
+                    Some(height) => info!(
+                        "Connected validators holding a quorum of stake do not run ConsensusVersion::V{} at height {height}",
+                        recorded.consensus_version
+                    ),
+                    None => info!(
+                        "Connected validators holding a quorum of stake are not ahead of this build at any height, so \
+                         the unreadable record of a required upgrade is removed"
+                    ),
+                }
+                remove_record(&self.record_path);
+                state.recorded = None;
+            }
         }
 
         let status = match self.required_upgrade(state, committee) {
@@ -342,8 +351,10 @@ impl<N: Network> UpgradeMonitor<N> {
     ///   that height hold the quorum threshold of stake.
     ///
     /// Connected validators that disclosed no schedule count as not ahead. A member's schedule
-    /// counts at one height only, so that a faulty member holds back at most one block per
-    /// handshake; any other height would let it list many activations and hold back as many blocks.
+    /// counts only at the first height where it is ahead of this build; any other height would let
+    /// it list many activations and hold back as many blocks. So a faulty member can hold back only
+    /// that height, and only while this validator is connected to less than a quorum of stake that
+    /// is not ahead there. Block sync still advances the ledger past it.
     ///
     /// The error is a [`BlockHeldBack`].
     pub fn ensure_block_may_be_built(
@@ -372,7 +383,7 @@ impl<N: Network> UpgradeMonitor<N> {
         let is_claimed = state.schedules.iter().any(|(address, steps)| {
             committee.get_stake(*address) > 0 && steps.first_ahead_of(&self.own) == Some(height)
         });
-        if is_claimed && !self.is_refuted(&state, committee, connected, height) {
+        if is_claimed && !self.is_refuted(&state, committee, connected, Some(height)) {
             return Err(BlockHeldBack(format!(
                 "Validato
```

#### Recent Merged Pull Requests:
- **PR #4584** (2026-10-28): client: drop solutions from provers at their solution limit (@cbeck88)
- **PR #4582** (2026-10-27): metrics: count transaction verification, memory-pool admission and gossip per call site (@cbeck88)
- **PR #4581** (closed): Verify unconfirmed transactions before gossiping them (@cbeck88)
- **PR #4579** (2026-10-26): chore(deps): bump ureq from 3.4.0 to 3.5.0 in the cargo-minor group (@dependabot[bot])
- **PR #4578** (2026-10-26): chore(deps): bump lru from 0.18.2 to 0.19.0 (@dependabot[bot])
- **PR #4577** (2026-10-26): fix(devnet.sh): run the build command without eval (@cbeck88)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Merge pull request #4534 from aleo-labs-protocol/feat/upgrade-schedule-handshake

**RULE**:
When implementing operations in `.ci/test_upgrade_required.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1f4eee02`: Merge pull request #4534 from aleo-labs-protocol/feat/upgrade-schedule-handshake. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.ci/test_upgrade_required.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#!/bin/bash

####################################################
# Runs a devnet in which one validator lacks the next consensus version.
# Checks that the outdated validator warns as soon as it connects, keeps building blocks up to 100
# blocks before the activation height, and then exits with an error and without forking. Checks the
# same exit on every restart, with or without its record of the required upgrade. Then checks that
# it rejoins the network once upgraded, and that it discards a record no validator confirms.
####################################################

set -eo pipefail

network_id=0
total_validators=4
activation_height=150
# The outdated validator builds no block from REQUIRED_UPGRADE_SAFETY_MARGIN blocks before the activation.
safety_margin=100
stop_height=$((activation_height - safety_margin))
target_height=180
# The outdated validator is the last one, so that the upgraded ones form a contiguous range.
outdated_validator=$((total_validators-1))
NODE_VERBOSITY=2

# shellcheck source=SCRIPTDIR/utils.sh
. ./.ci/utils.sh

network_name=$(get_network_name "$network_id")

# Logs a failure and exits.
function fail() {
  log "⛔️ $*"
  exit 1
}
init_log_dir

trap s
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1f4eee02` are properly handled with clean fallback behavior.
