# Forensic Learning Record (Deep Inspection): ProvableHQ/snarkOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/provablehq-snarkos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ProvableHQ/snarkOS](https://github.com/ProvableHQ/snarkOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:34:23.702Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ProvableHQ/snarkOS`
- **Description**: A Decentralized Operating System for ZK Applications
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4527 stars

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
use colored::{ColoredString, Colorize};
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
    fn format_transmission_id(&self, transmission_id: TransmissionID<N>) -> ColoredString {
        if let Some(checksum) = transmission_id.checksum() {
            // fmt_id will suffix with `..`, so we should not use `.`  as a separator.
            format!("{}:{}", fmt_id(transmission_id), fmt_id(checksum))
        } else {
            fmt_id(transmission_id)
        }
        .dimmed()
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
        if !self.contains_trans
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
    ) -> Result<()> {
        let result = if transaction.is_execute() {
            self.executions.insert(transaction_id, transaction, priority_fee)
        } else {
            self.deployments.insert(transaction_id, transaction, priority_fee)
        };

        #[cfg(feature = "metrics")]
        {
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
    ) -> Result<()> {
        // Duplicates are a no-op: they must not evict anything or refresh recency.
        // Note: the transaction ID is the root of the transaction tree, which includes a leaf for the fee
        // transition. A transaction with the same ID therefore always has the same priority fee, and a
        // resubmission with a higher fee has a different ID, so there is nothing to replace here.
        if self.contains(&transaction_id) {
            return Ok(());
        }

        // If the queue is not full, insert in the appropriate queue.
        if self.len() < self.capacity {
            if priority_fee.is_zero() {
                self.fifo_queue.put(transaction_id, transaction);
            } else {
                self.priority_queue.insert(transaction_id, transaction, priority_fee);
            }

            debug_assert!(self.len() <= self.capacity, "The mempool exceeded its capacity");
            return Ok(());
        }

        match (self.priority_queue.len() < self.capacity, *priority_fee) {
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
                if self.fifo_queue.pop_lru().is_some() {
                    #[cfg(feature = "metrics")]
                    metrics::increment_counter(metrics::consensus::DROPPED_TRANSACTIONS);
                }

                self.priority_queue.insert(transaction_id, transaction, priority_fee)
            }
            // Invariant: if the queue is at capacity but the priority queue is
            // equal to the capacity, the low-priority queue must be empty.
            (false, _fee) => {
                debug_assert!(
                    self.fifo_queue.is_empty(),
                    "The low-priority queue must be empty when the priority queue is full"
                );

                self.priority_queue.compare_insert(transaction_id, transaction, priority_fee)?
            }
        }

        debug_assert!(self.len() <= self.capacity, "The mempool exceeded its capacity");
        Ok(())
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

            bail!("The memory pool is full");
        }

        // Otherwise, remove the current value and insert the new.
        //
        // SAFETY: the empty check guarantees an item will be returned
        let (_, id) = self.transaction_ids.pop_last().expect("item must be present");
        self.transactions.remove(&id);

        #[cfg(feature = "metrics")]
        metrics::increment_counter(metrics::consensus::DROPPED_TRANSACTIONS);

        self.insert(transaction_id, transaction, fee);
        Ok(())
    }

    fn pop(&mut self) -> Option<(N::TransactionID, Transaction<N>)> {
        let (_, transaction_id) = self.transaction_ids.pop_first()?;
        self.transactions.remove(&transaction_id).map(|transaction| (transaction_id, transaction))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use snarkvm::{
        ledger::test_helpers::{sample_deployment_transaction, sample_execution_transaction_with_fee},
        prelude::{MainnetV0, TestRng},
    };

    type CurrentNetwork = MainnetV0;

    
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

### Core Architecture Module: `cli/src/commands/account.rs`
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

use crate::helpers::args::{network_id_parser, parse_private_key};

mod sign;
use sign::Sign;

use snarkvm::console::{
    account::{Address, PrivateKey, Signature},
    network::{CanaryV0, MainnetV0, Network, TestnetV0},
    prelude::{Environment, Uniform},
    program::{ToFields, Value},
    types::Field,
};

use anyhow::{Result, anyhow, bail};
use clap::Parser;
use colored::Colorize;
use core::str::FromStr;
use crossterm::ExecutableCommand;
use rand::SeedableRng;
use rand_chacha::ChaChaRng;
use rayon::prelude::*;
use std::{
    fs::File,
    io::{Read, Write},
};

use zeroize::Zeroize;

/// Commands to manage Aleo accounts.
#[derive(Debug, Parser, Zeroize)]
#[command(
    // Use kebab-case for all arguments (e.g., use the `private-key` flag for the `private_key` field).
    // This is already the default, but we specify it in case clap's default changes in the future.
    rename_all = "kebab-case",
)]
pub enum Account {
    /// Generates a new Aleo account
    New {
        /// Specify the network to create an execution for.
        /// [options: 0 = mainnet, 1 = testnet, 2 = canary]
        #[clap(long, default_value_t=MainnetV0::ID, long, value_parser = network_id_parser())]
        network: u16,
        /// Seed the RNG with a numeric value
        #[clap(short = 's', long)]
        seed: Option<String>,
        /// Try until an address with the vanity string is found
        #[clap(short = 'v', long, conflicts_with_all = &["seed", "save_to_file"])]
        vanity: Option<String>,
        /// Print sensitive information (such as the private key) discreetly in an alternate screen
        #[clap(long)]
        discreet: bool,
        /// Specify the path to a file where to save the account in addition to printing it
        #[clap(long, conflicts_with = "discreet")]
        save_to_file: Option<String>,
    },
    /// Derive an Aleo account from a private key
    Import {
        /// Account private key
        private_key: Option<String>,
        /// Specify the network to create an execution for.
        /// [options: 0 = mainnet, 1 = testnet, 2 = canary]
        #[clap(long, default_value_t=MainnetV0::ID, long, value_parser = network_id_parser())]
        network: u16,
        /// Print sensitive information (such as the private key) discreetly in an alternate screen
        #[clap(long)]
        discreet: bool,
        /// Specify the path to a file where to save the account in addition to printing it
        #[clap(long, conflicts_with = "discreet")]
        save_to_file: Option<String>,
    },
    Sign(Sign),
    Verify {
        /// Specify the network to create an execution for.
        /// [options: 0 = mainnet, 1 = testnet, 2 = canary]
        #[clap(long, default_value_t=MainnetV0::ID, long, value_parser = network_id_parser())]
        network: u16,
        /// Address to use for verification
        #[clap(short = 'a', long)]
        address: String,
        /// Signature to verify
        #[clap(short = 's', long)]
        signature: String,
        /// Message (Aleo value) to verify the signature against
        #[clap(short = 'm', long)]
        message: String,
        /// When enabled, parses the message as bytes instead of Aleo literals
        #[clap(short = 'r', long)]
        raw: bool,
    },
}

/// Parse a raw Aleo input into fields
fn aleo_literal_to_fields<N: Network>(input: &str) -> Result<Vec<Field<N>>> {
    Value::<N>::from_str(input)?.to_fields()
}

impl Account {
    /// Run a account command
    pub fn parse(self) -> Result<String> {
        match self {
            Self::New { network, seed, vanity, discreet, save_to_file } => {
                match vanity {
                    // Generate a vanity account for the specified network.
                    Some(vanity) => match network {
                        MainnetV0::ID => Self::new_vanity::<MainnetV0>(vanity.as_str(), discreet),
                        TestnetV0::ID => Self::new_vanity::<TestnetV0>(vanity.as_str(), discreet),
                        CanaryV0::ID => Self::new_vanity::<CanaryV0>(vanity.as_str(), discreet),
                        unknown_id => bail!("Unknown network ID ({unknown_id})"),
                    },
                    // Generate a seeded account for the specified network.
                    None => match network {
                        MainnetV0::ID => Self::new_seeded::<MainnetV0>(seed, discreet, save_to_file),
                        TestnetV0::ID => Self::new_seeded::<TestnetV0>(seed, discreet, save_to_file),
                        CanaryV0::ID => Self::new_seeded::<CanaryV0>(seed, discreet, save_to_file),
                        unknown_id => bail!("Unknown network ID ({unknown_id})"),
                    },
                }
            }
            Self::Import { private_key, network, discreet, save_to_file } => {
                // Import the account for the specified network.
                match network {
                    MainnetV0::ID => Self::import::<MainnetV0>(private_key, discreet, save_to_file),
                    TestnetV0::ID => Self::import::<TestnetV0>(private_key, discreet, save_to_file),
                    CanaryV0::ID => Self::import::<CanaryV0>(private_key, discreet, save_to_file),
                    unknown_id => bail!("Unknown network ID ({unknown_id})"),
                }
            }
            Self::Sign(sign) => sign.execute(),
            Self::Verify { network, address, signature, message, raw } => {
                // Verify the signature for the specified network.
                match network {
                    MainnetV0::ID => Self::verify::<MainnetV0>(address, signature, message, raw),
                    TestnetV0::ID => Self::verify::<TestnetV0>(address, signature, message, raw),
                    CanaryV0::ID => Self::verify::<CanaryV0>(address, signature, message, raw),
                    unknown_id => bail!("Unknown network ID ({unknown_id})"),
                }
            }
        }
    }

    /// Generates a new Aleo account with the given vanity string.
    fn new_vanity<N: Network>(vanity: &str, discreet: bool) -> Result<String> {
        // A closure to generate a new Aleo account.
        let sample_account = || snarkos_account::Account::<N>::new(&mut rand::rng());

        const ITERATIONS: u128 = u16::MAX as u128;
        const ITERATIONS_STR: &str = "65,535";

        // Ensure the vanity string is valid.
        if !crate::helpers::is_in_bech32m_charset(vanity) {
            bail!(
                "The vanity string '{vanity}' contains invalid bech32m characters. Try using characters from the bech32m character set: {}",
                crate::helpers::BECH32M_CHARSET
            );
        }

        // Output a message if the character set is more than 4 characters.
        if vanity.len() > 4 {
            let message =
                format!(" The vanity string '{vanity}' contains 5 or more characters and will take a while to find.\n");
            println!("{}", message.yellow());
        }

        loop {
            // Initialize a timer.
            let timer = std::time::Instant::now();

            // Generates bech32m addresses in parallel until one is found that
            // includes the desired vanity string at the start or end of the address.
            let account = (0..ITERATIONS).into_par_iter().find_map_any(|_| {
                // Initialize the result.
                let mut account = None;
                // Sample a random account.
                if let Ok(candidate) = sample_account() {
                    // Encode the address as a bech32m string.
                    let address = candidate.address().to_string();
                    // Set the candidate if the address includes the desired vanity string
                    // at the start or end of the address.
                    if crate::helpers::has_vanity_string(&address, vanity) {
                        account = Some(candidate);
                    }
                }
                // Return the result.
                account
            });

            // Return the result if a candidate was found.
            if let Some(account) = account {
                println!(); // Add a newline for formatting.
                if !discreet {
                    return Ok(account.to_string());
                }
                display_string_discreetly(
                    &format!("{:>12}  {}", "Private Key".cyan().bold(), account.private_key()),
                    "### Do not share or lose this private key! Press any key to complete. ###",
                )
                .unwrap();
                let account_info = format!(
                    " {:>12}  {}\n {:>12}  {}",
                    "View Key".cyan().bold(),
                    account.view_key(),
                    "Address".cyan().bold(),
                    account.address()
                );
                return Ok(account_info);
            } else {
                let rate = ITERATIONS / timer.elapsed().as_millis();
                let rate = format!("[{rate} a/ms]");
                println!(" {} Sampled {ITERATIONS_STR} accounts, searching...", rate.dimmed());
            }
        }
    }

    /// Generates a new Aleo account with an optional seed.
    fn new_seeded<N: Network>(seed: Option<String>, discreet: bool, save_to_file: Option<String
```

### Core Architecture Module: `cli/src/commands/account/sign.rs`
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

use clap::builder::NonEmptyStringValueParser;

#[derive(Debug, Zeroize, Parser)]
#[command(
    group(clap::ArgGroup::new("key").required(true).multiple(false))
)]
pub struct Sign {
    /// Specify the network to create an execution for.
    /// [options: 0 = mainnet, 1 = testnet, 2 = canary]
    #[clap(long, default_value_t=MainnetV0::ID, long, value_parser = network_id_parser())]
    pub(super) network: u16,

    /// Specify the account private key of the node
    #[clap(long, group = "key", value_parser=NonEmptyStringValueParser::default())]
    pub(super) private_key: Option<String>,

    /// Specify the path to a file containing the account private key of the node
    #[clap(long, group = "key", value_parser=NonEmptyStringValueParser::default())]
    pub(super) private_key_file: Option<String>,

    /// Use a developer validator key to generate the deployment.
    #[clap(long, group = "key")]
    pub(super) dev_key: Option<u16>,

    /// Message (Aleo value) to sign
    #[clap(short = 'm', long)]
    pub(super) message: String,

    /// When enabled, parses the message as bytes instead of Aleo literals
    #[clap(short = 'r', long)]
    pub(super) raw: bool,
}

impl Sign {
    pub fn execute(self) -> Result<String> {
        // Sign the message for the specified network.
        match self.network {
            MainnetV0::ID => self.sign::<MainnetV0>(),
            TestnetV0::ID => self.sign::<TestnetV0>(),
            CanaryV0::ID => self.sign::<CanaryV0>(),
            unknown_id => bail!("Unknown network ID ({unknown_id})"),
        }
    }

    // Sign a message with an Aleo private key
    fn sign<N: Network>(self) -> Result<String> {
        // Sample a random field element.
        let mut rng = ChaChaRng::from_rng(&mut rand::rng());

        // Parse the private key
        let private_key = parse_private_key(self.private_key.clone(), self.private_key_file.clone(), self.dev_key)?;

        // Sign the message
        let signature = if self.raw {
            private_key.sign_bytes(self.message.as_bytes(), &mut rng)
        } else {
            let fields = aleo_literal_to_fields::<N>(&self.message)
                .map_err(|_| anyhow!("Failed to parse a valid Aleo literal"))?;
            private_key.sign(&fields, &mut rng)
        }
        .map_err(|_| anyhow!("Failed to sign the message"))?
        .to_string();
        // Return the signature as a string
        Ok(signature)
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

- **Issue #4386** (2026-08-11): **[Bug] snarkvm-ledger-puzzle-epoch CI failures**
  *Symptoms*: I'm suspecting an OOM.
  **Post-Mortem & Fix Analysis**:
  > The snarkVM-side fix [appears to work](https://github.com/ProvableHQ/snarkOS/pull/4390).

- **Issue #4373** (2026-08-06): **[Bug] devnet-test fails due to error log**
  *Symptoms*: ## 🐛 Bug Report  CC @cbeck88 this was as a result of https://github.com/ProvableHQ/snarkOS/pull/4371   In the corresponding test we fail if we encounter any error in the logs - lo and behold duplicate insertions are happening: ``` [ci-runner] 2026-08-06T10:56:52Z ❌ Test failed! Validator #1 logs contain errors. 2026-08-06T10:55:01.339249Z ERROR snarkos_node_bft::helpers::dag: A certificate for round 12 by author aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px already existed in the DAG - replaced 2155308936950688.. with 2155308936950688.. 2026-08-06T10:55:01.339281Z ERROR snarkos_node_bft::helpers::dag: A certificate for round 12 by author aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px already existed in the DAG - replaced 2155308936950688.. with 2155308936950688.. 2026-08-06T10:55:01.347440Z ERROR snarkos_node_bft::helpers::dag: A certificate for round 13 by author aleo12ux3gdauck0v60westgcpqj7v8rrcr3v346e4jtq04q7kkt22czsh808v2 already existed in the DAG - replaced 2669450907627232.. with 2669450907627232.. 2026-08-06T10:55:01.347537Z ERROR snarkos_node_bft::helpers::dag: A certificate for round 13 by author aleo1ashyu96tjwe63u0gtnnv8z5lhapdu4l5pjsl2kha7fv7hvz2eqxs5dz0rg already existed in the DAG - replaced 3139907712014786.. with 3139907712014786.. 2026-08-06T10:55:46.536182Z ERROR snarkos_node_bft::helpers::dag: A certificate for round 15 by author aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px already existed in the DAG 
  **Post-Mortem & Fix Analysis**:
  > https://github.com/ProvableHQ/snarkOS/pull/4354#issuecomment-5204200789
  > Seems like we just need to add ``` Some(previous) if previous.id() == certificate_id => {     trace!("Re-inserted the certificate for round {round} by author {author} into the DAG"); } ``` before the `ERROR` branch, no? Re-inserting the same cert isn't an issue, it's expected when syncing.  edit: beat me to it with the fix before I even commented on this 😁

- **Issue #4357** (2026-07-31): **[Bug] live task remaining error**
  *Symptoms*: ## 🐛 Bug Report  Link: https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4058/workflows/e9cfa791-c1f7-4b7b-b5db-3e2fe0d058a9/jobs/84824  Does that branch already include https://github.com/ProvableHQ/snarkOS/pull/4346 ?
  **Post-Mortem & Fix Analysis**:
  > The associated `ERROR` log indicates it already includes the aforementioned PR. I'll look into it.
  > Can't reproduce locally right now, will return to this later.
  > I spoke too soon, I found the issue 💪.

- **Issue #4356** (2026-08-04): **[Bug] upgrade-test failed**
  *Symptoms*: ## 🐛 Bug Report  Link: https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4058/workflows/e9cfa791-c1f7-4b7b-b5db-3e2fe0d058a9/jobs/84822  Did not have time to parse the logs yet

- **Issue #4355** (2026-07-31): **[Bug] chaotic-majority-reset-test failed**
  *Symptoms*: ## 🐛 Bug Report  Link: https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4058/workflows/e9cfa791-c1f7-4b7b-b5db-3e2fe0d058a9/jobs/84823  Some assorted logs, you can see that during the **second** set of restarts the network stalls:  ``` [ci-runner] 2026-07-28T12:50:59Z ✅ SUCCESS: All nodes reached minimum height of 60 [ci-runner] 2026-07-28T12:50:59Z All nodes reached the next reset height. 🚨 Stopping 5 selected node(s)...  [validator-6] 2026-07-28T12:47:09.314704Z  INFO snarkos_cli::commands::start: Development mode enabled with index=6 and num_validators=7. [validator-2] 2026-07-28T12:47:10.317533Z  INFO snarkos_cli::commands::start: Development mode enabled with index=2 and num_validators=7. [validator-1] 2026-07-28T12:47:11.320607Z  INFO snarkos_cli::commands::start: Development mode enabled with index=1 and num_validators=7. [validator-5] 2026-07-28T12:47:12.324988Z  INFO snarkos_cli::commands::start: Development mode enabled with index=5 and num_validators=7. [validator-4] 2026-07-28T12:47:13.332061Z  INFO snarkos_cli::commands::start: Development mode enabled with index=4 and num_validators=7.  [validator-4] 2026-07-28T12:51:00.149811Z  WARN snarkos_node_bft::primary: Cannot store a signature for batch '1913632375797241..' from '127.0.0.1:5005' — Malicious peer - batch signature is from a different validator (aleo1l4z0j5cn5s6u6tpuqcj6anh30uaxkdfzatt9seap0atjcqk6nq9qnm9eqf)  [validator-3] 2026-07-28T12:51:34.832837Z  INFO snarkos_cli::commands::start: Developme

- **Issue #4342** (2026-07-08): **[Bug] chaotic-{minority, majority}-reset-test are failing**
  *Symptoms*: ## 🐛 Bug Report  Example links [[1]](https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4028/workflows/f9463645-bf2b-4b02-a357-1493e3a78e1b/jobs/84123?utm_campaign=workflowcompleted_failed&utm_medium=notification&utm_content=link&utm_source=email) [[2]](https://app.circleci.com/pipelines/gh/ProvableHQ/snarkOS/4028/workflows/f9463645-bf2b-4b02-a357-1493e3a78e1b/jobs/84124?utm_campaign=workflowcompleted_failed&utm_medium=notification&utm_content=link&utm_source=email)  The logs seem to contain lots of errors:  ``` [ci-runner] 2026-07-06T10:14:18Z Node #3 (port=3033) only reached height 153, expected at least 250 ```  But we can't actually reach the end of the logs because of the high verbosity: ``` ******************************************************************************************************** This step produced more than the 50 MB limit of output, additional output will not be recorded. If you need this amount of output, we suggest writing it to a file and using store_artifacts to save it. ******************************************************************************************************** ```  Which matches that they first started to fail after: https://github.com/provableHQ/snarkOS/pull/4305

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

### Incident Patch 1: `64535ff4` (2026-10-05)
**Commit Message**: deps: require toml 1 in build-dependencies to match the lock

The lock pins toml 1.1.6 while the manifest allowed only 0.9.x, so
`cargo metadata --locked` failed. build.rs uses `toml::Value` and
`toml::from_str`, which are unchanged in toml 1.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -396,7 +396,7 @@ version = "0.11.2"
 workspace = true
 
 [build-dependencies.toml]
-version = "0.9"
+version = "1"
 
 [build-dependencies.walkdir]
 version = "2"
```

---

### Incident Patch 2: `1bb7606c` (2026-10-05)
**Commit Message**: Merge pull request #4511 from ProvableHQ/fix/message-version

Ignore unscheduled consensus upgrades when selecting the latest message version

**File**: `node/router/messages/src/lib.rs` (modified, +29/-2)
```diff
@@ -145,9 +145,16 @@ impl<N: Network> Message<N> {
         (ConsensusVersion::V22, 33),
     ];
 
-    /// Returns the latest message version.
+    /// Returns the latest message version whose consensus upgrade has a scheduled block height.
     pub fn latest_message_version() -> u32 {
-        Self::VERSIONS.last().map(|(_, version)| *version).unwrap_or(0)
+        Self::VERSIONS
+            .iter()
+            .rev()
+            .find(|(consensus_version, _)| {
+                N::CONSENSUS_HEIGHT(*consensus_version).is_ok_and(|height| height != u32::MAX)
+            })
+            .map(|(_, version)| *version)
+            .unwrap_or(0)
     }
 
     /// Returns the lowest acceptable message version for the given block height.
@@ -333,6 +340,26 @@ mod tests {
         }
     }
 
+    fn latest_message_version_has_scheduled_height<N: Network>() {
+        let latest_message_version = Message::<N>::latest_message_version();
+        let (consensus_version, _) =
+            Message::<N>::VERSIONS.iter().find(|(_, version)| *version == latest_message_version).unwrap();
+        assert_ne!(N::CONSENSUS_HEIGHT(*consensus_version).unwrap(), u32::MAX);
+
+        for (consensus_version, message_version) in Message::<N>::VERSIONS {
+            if message_version > latest_message_version {
+                assert_eq!(N::CONSENSUS_HEIGHT(consensus_version).unwrap(), u32::MAX);
+            }
+        }
+    }
+
+    #[test]
+    fn test_latest_message_version_has_scheduled_height() {
+        latest_message_version_has_scheduled_height::<MainnetV0>();
+        latest_message_version_has_scheduled_height::<TestnetV0>();
+        latest_message_version_has_scheduled_height::<CanaryV0>();
+    }
+
     #[test]
     #[allow(clippy::assertions_on_constants)]
     fn test_consensus_constants() {
```

---

### Incident Patch 3: `fe98d5af` (2026-10-02)
**Commit Message**: Fix message versions for unscheduled consensus upgrades

**File**: `node/router/messages/src/lib.rs` (modified, +29/-2)
```diff
@@ -144,9 +144,16 @@ impl<N: Network> Message<N> {
         (ConsensusVersion::V21, 32),
     ];
 
-    /// Returns the latest message version.
+    /// Returns the latest message version whose consensus upgrade has a scheduled block height.
     pub fn latest_message_version() -> u32 {
-        Self::VERSIONS.last().map(|(_, version)| *version).unwrap_or(0)
+        Self::VERSIONS
+            .iter()
+            .rev()
+            .find(|(consensus_version, _)| {
+                N::CONSENSUS_HEIGHT(*consensus_version).is_ok_and(|height| height != u32::MAX)
+            })
+            .map(|(_, version)| *version)
+            .unwrap_or(0)
     }
 
     /// Returns the lowest acceptable message version for the given block height.
@@ -332,6 +339,26 @@ mod tests {
         }
     }
 
+    fn latest_message_version_has_scheduled_height<N: Network>() {
+        let latest_message_version = Message::<N>::latest_message_version();
+        let (consensus_version, _) =
+            Message::<N>::VERSIONS.iter().find(|(_, version)| *version == latest_message_version).unwrap();
+        assert_ne!(N::CONSENSUS_HEIGHT(*consensus_version).unwrap(), u32::MAX);
+
+        for (consensus_version, message_version) in Message::<N>::VERSIONS {
+            if message_version > latest_message_version {
+                assert_eq!(N::CONSENSUS_HEIGHT(consensus_version).unwrap(), u32::MAX);
+            }
+        }
+    }
+
+    #[test]
+    fn test_latest_message_version_has_scheduled_height() {
+        latest_message_version_has_scheduled_height::<MainnetV0>();
+        latest_message_version_has_scheduled_height::<TestnetV0>();
+        latest_message_version_has_scheduled_height::<CanaryV0>();
+    }
+
     #[test]
     #[allow(clippy::assertions_on_constants)]
     fn test_consensus_constants() {
```

---

### Incident Patch 4: `343cceeb` (2026-09-30)
**Commit Message**: changed eviction trace log to a metric

**File**: `node/consensus/src/transactions_queue.rs` (modified, +3/-6)
```diff
@@ -139,12 +139,9 @@ impl<N: Network> TransactionsQueueInner<N> {
                 );
 
                 // Remove an entry from the low-priority queue to make room for the high-priority transaction.
-                if let Some((evicted_id, _)) = self.fifo_queue.pop_lru() {
-                    trace!(
-                        "Evicting zero-fee transaction '{}' from the mempool to make room for transaction '{}'",
-                        fmt_id(evicted_id),
-                        fmt_id(transaction_id)
-                    );
+                if self.fifo_queue.pop_lru().is_some() {
+                    #[cfg(feature = "metrics")]
+                    metrics::increment_counter(metrics::consensus::EVICTED_ZERO_FEE_TRANSACTIONS);
                 }
 
                 self.priority_queue.insert(transaction_id, transaction, priority_fee)
```

**File**: `node/metrics/src/names.rs` (modified, +7/-2)
```diff
@@ -13,8 +13,12 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-pub(super) const COUNTER_NAMES: [&str; 3] =
-    [bft::LEADERS_ELECTED, consensus::STALE_UNCONFIRMED_TRANSACTIONS, consensus::STALE_UNCONFIRMED_SOLUTIONS];
+pub(super) const COUNTER_NAMES: [&str; 4] = [
+    bft::LEADERS_ELECTED,
+    consensus::STALE_UNCONFIRMED_TRANSACTIONS,
+    consensus::STALE_UNCONFIRMED_SOLUTIONS,
+    consensus::EVICTED_ZERO_FEE_TRANSACTIONS,
+];
 
 pub(super) const GAUGE_NAMES: [&str; 29] = [
     bft::CONNECTED,
@@ -122,6 +126,7 @@ pub mod consensus {
     pub const TRANSMISSION_LATENCY: &str = "snarkos_consensus_transmission_latency";
     pub const STALE_UNCONFIRMED_TRANSACTIONS: &str = "snarkos_consensus_stale_unconfirmed_transactions";
     pub const STALE_UNCONFIRMED_SOLUTIONS: &str = "snarkos_consensus_stale_unconfirmed_solutions";
+    pub const EVICTED_ZERO_FEE_TRANSACTIONS: &str = "snarkos_consensus_evicted_zero_fee_transactions";
     pub const VALIDATOR_CERTIFICATE_PARTICIPATION: &str = "snarkos_consensus_validator_certificate_participation";
     pub const VALIDATOR_SIGNATURE_PARTICIPATION: &str = "snarkos_consensus_validator_signature_participation";
     /// The garbage collection round the published participation scores were computed at.
```

---

### Incident Patch 5: `c16357ad` (2026-10-01)
**Commit Message**: Merge pull request #4485 from vicsn/fix/rest-block-cache

Stop REST block lookup from filling the block cache

**File**: `node/rest/src/routes.rs` (modified, +0/-2)
```diff
@@ -350,8 +350,6 @@ impl<N: Network, C: ConsensusStorage<N>, R: Routing<N>> Rest<N, C, R> {
             Err(e) => Err(RestError::internal_server_error(anyhow!("tokio error: {e}"))),
         }?;
 
-        rest.block_cache.lock().put(hash, json_block.clone());
-
         Ok(json_block)
     }
 
```

---

### Incident Patch 6: `6026e116` (2026-09-30)
**Commit Message**: Bump tikv-jemallocator requirement to 0.7

Dependabot's bump (#4493) updated Cargo.lock to tikv-jemallocator 0.7.0
but left the root manifest at "0.6", so cargo re-resolves the lock back
to 0.6.1 on every build and `--locked` fails.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -371,7 +371,7 @@ workspace = true
 workspace = true
 
 [target.'cfg(all(target_os = "linux", target_arch = "x86_64"))'.dependencies]
-tikv-jemallocator = "0.6"
+tikv-jemallocator = "0.7"
 
 [dependencies.tracing]
 workspace = true
```

---

### Incident Patch 7: `e4950bff` (2026-09-29)
**Commit Message**: require succinct, DRY pull request descriptions

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ do or how language constructs work are unhelpful.
 ## Pull requests
 - Follow `.github/PULL_REQUEST_TEMPLATE.md`.
 - Write the PR README in Simplified Technical English. Use short sentences, the active voice, and one idea per sentence.
+- Keep the pull request description succinct and DRY.
 - Explain each commit in one line.
 
 ## Modifying BFT Code
```

---

### Incident Patch 8: `edce5716` (2026-09-24)
**Commit Message**: Converted several untracked tokio tasks to tracked ones. This is from a pre-existing issue. There were several tokio tasks and were spawned and never had any way of being shutdown. The current method of handling this is that we have some Vec<JoinHandle>s that we then use to shutdown all tasks when we shutdown the node. There's also a check that waits for 1s (arbitrary value) after the shutdown signal and then just checks for the number of live tasks, if it's more than 1 it errors. The problem is that these untracked tasks would stay alive (since they never got any shutdown signal) for a little longer than 1s and cause the error. Given that there exist JoinSets and CancellationTokens, this is a weird way of handling shutdowns, but it's way outside the scope of this PR to fix this.

**File**: `node/bft/src/gateway.rs` (modified, +7/-7)
```diff
@@ -746,7 +746,7 @@ impl<N: Network> Gateway<N> {
                 };
 
                 let self_ = self.clone();
-                tokio::spawn(async move {
+                self.spawn(async move {
                     // Send the `BlockResponse` message to the peer.
                     let event =
                         Event::BlockResponse(BlockResponse::new(block_request, blocks, latest_consensus_version));
@@ -901,7 +901,7 @@ impl<N: Network> Gateway<N> {
                 connected_peers.shuffle(&mut rand::rng());
 
                 let self_ = self.clone();
-                tokio::spawn(async move {
+                self.spawn(async move {
                     // Initialize the validators.
                     let mut validators = IndexMap::with_capacity(MAX_VALIDATORS_TO_SEND);
                     // Iterate over the validators.
@@ -1248,7 +1248,7 @@ impl<N: Network> Gateway<N> {
     /// This function attempts to disconnect any validators that are not in the current committee.
     fn handle_unauthorized_validators(&self) {
         let self_ = self.clone();
-        tokio::spawn(async move {
+        self.spawn(async move {
             // Retrieve the connected validators.
             let validators = self_.get_connected_peers();
             // Iterate over the validator IPs.
@@ -1324,7 +1324,7 @@ impl<N: Network> Gateway<N> {
             // Select a random validator IP.
             if let Some(validator_ip) = validators.into_iter().choose(&mut rand::rng()) {
                 let self_ = self.clone();
-                tokio::spawn(async move {
+                self.spawn(async move {
                     // Increment the number of outbound validators requests for this validator.
                     self_.cache.increment_outbound_validators_requests(validator_ip);
                     // Send a `ValidatorsRequest` to the validator.
@@ -1342,7 +1342,7 @@ impl<N: Network> Gateway<N> {
         {
             warn!("{CONTEXT} Disconnecting from '{peer_ip}' - {error}");
             let self_ = self.clone();
-            tokio::spawn(async move {
+            self.spawn(async move {
                 Transport::send(&self_, peer_ip, DisconnectReason::ProtocolViolation.into()).await;
                 // Disconnect from this peer.
                 self_.disconnect(peer_ip);
@@ -1436,7 +1436,7 @@ impl<N: Network> Transport<N> for Gateway<N> {
         if self.number_of_connected_peers() > 0 {
             let self_ = self.clone();
             let connected_peers = self.connected_peers();
-            tokio::spawn(async move {
+            self.spawn(async move {
                 // Serialize the event's payload once, rather than once per recipient; every
                 // recipient then shares the resulting buffer. `Transport::send` would otherwise do
                 // this separately for each peer below.
@@ -1488,7 +1488,7 @@ impl<N: Network> Reading for Gateway<N> {
             let self_ = self.clone();
             // Handle BlockRequest and BlockResponse messages in a separate task to not block the
             // inbound queue.
-            tokio::spawn(async move {
+            self.spawn(async move {
                 self_.process_message_inner(peer_addr, message).await;
             });
         } else {
```

**File**: `node/bft/src/primary.rs` (modified, +18/-18)
```diff
@@ -513,7 +513,7 @@ impl<N: Network> proposal_task::BatchPropose for Primary<N> {
                         // Resend the batch proposal to the validator for signing.
                         Some(peer_ip) => {
                             let (gateway, event_, round) = (self.gateway.clone(), event.clone(), proposal.round());
-                            tokio::spawn(async move {
+                            self.spawn(async move {
                                 debug!("Resending batch proposal for round {round} to peer '{peer_ip}'");
                                 // Resend the batch proposal to the peer.
                                 if gateway.send(peer_ip, event_).await.is_none() {
@@ -899,7 +899,7 @@ impl<N: Network> Primary<N> {
             // Instead, rebroadcast the cached signature to the peer.
             if signed_round == batch_header.round() && signed_batch_id == batch_header.batch_id() {
                 let gateway = self.gateway.clone();
-                tokio::spawn(async move {
+                self.spawn(async move {
                     debug!("Resending a signature for a batch in round {batch_round} from '{peer_ip}'");
                     let event = Event::BatchSignature(BatchSignature::new(batch_header.batch_id(), signature));
                     // Resend the batch signature to the peer.
@@ -996,7 +996,7 @@ impl<N: Network> Primary<N> {
 
         // Broadcast the signature back to the validator.
         let self_ = self.clone();
-        tokio::spawn(async move {
+        self.spawn(async move {
             let event = Event::BatchSignature(BatchSignature::new(batch_id, signature));
             // Send the batch signature to the peer.
             if self_.gateway.send(peer_ip, event).await.is_some() {
@@ -1397,8 +1397,8 @@ impl<N: Network> Primary<N> {
 
                 // Spawn a task to process the primary certificate.
                 {
-                    let self_ = self_.clone();
-                    tokio::spawn(async move {
+                    let self__ = self_.clone();
+                    self_.spawn(async move {
                         // Deserialize the primary certificate in the primary ping.
                         let Ok(primary_certificate) = spawn_blocking!(primary_certificate.deserialize_blocking())
                         else {
@@ -1408,7 +1408,7 @@ impl<N: Network> Primary<N> {
                         // Process the primary certificate.
                         let id = fmt_id(primary_certificate.id());
                         let round = primary_certificate.round();
-                        if let Err(e) = self_.process_batch_certificate_from_peer(peer_ip, primary_certificate).await {
+                        if let Err(e) = self__.process_batch_certificate_from_peer(peer_ip, primary_certificate).await {
                             debug!("Cannot process a primary certificate '{id}' at round {round} in a 'PrimaryPing' from '{peer_ip}' - {e}");
                         }
                     });
@@ -1439,11 +1439,11 @@ impl<N: Network> Primary<N> {
         self.spawn(async move {
             while let Some((peer_ip, batch_propose)) = rx_batch_propose.recv().await {
                 // Spawn a task to process the proposed batch.
-                let self_ = self_.clone();
-                tokio::spawn(async move {
+                let self__ = self_.clone();
+                self_.spawn(async move {
                     // Process the batch proposal.
                     let round = batch_propose.round;
-                    if let Err(err) = self_.process_batch_propose_from_peer(peer_ip, batch_propose).await {
+                    if let Err(err) = self__.process_batch_propose_from_peer(peer_ip, batch_propose).await {
                         let err = err.context(format!("Cannot sign a batch at round {round} from '{peer_ip}'"));
                         warn!("{}", flatten_error(err));
                     }
@@ -1473,8 +1473,8 @@ impl<N: Network> Primary<N> {
         self.spawn(async move {
             while let Some((peer_ip, batch_certificate)) = rx_batch_certified.recv().await {
                 // Spawn a task to process the batch certificate.
-                let self_ = self_.clone();
-                tokio::spawn(async move {
+                let self__ = self_.clone();
+                self_.spawn(async move {
                     // Deserialize the batch certificate.
                     let Ok(batch_certificate) = spawn_blocking!(batch_certificate.deserialize_blocking()) else {
                         warn!("Failed to deserialize the batch certificate from '{peer_ip}'");
@@ -1483,7 +1483,7 @@ impl<N: Network> Primary<N> {
                     // Process the batch certificate.
                     let id = fmt_id(batch_certificate.id());
                     let round = batch_certificate.round();
-                    if let Err(err) = self_.process_batch_certificate_from_peer(peer_ip, batch_certificate).await {
+            
```

---

### Incident Patch 9: `67810a9f` (2026-09-24)
**Commit Message**: fix gc round update race. Not an actual bug, but would cause unnecessary error logging.

**File**: `node/bft/src/helpers/storage.rs` (modified, +71/-17)
```diff
@@ -280,23 +280,20 @@ impl<N: Network> Storage<N> {
     }
 
     /// Update the storage by performing garbage collection based on the next round.
+    ///
+    /// This is called concurrently from two independent paths: the BFT commit path
+    /// (`commit_leader_certificate`) and the sync-bootup path (`sync_storage_with_ledger_at_bootup`).
+    /// `fetch_max` ensures `gc_round` only ever advances, regardless of interleaving, instead of a
+    /// compare-exchange erroring out when a stale/losing caller observes a smaller target round.
     pub(crate) fn garbage_collect_certificates(&self, next_round: u64) -> Result<()> {
-        // Fetch the current GC round.
-        let current_gc_round = self.gc_round();
         // Compute the next GC round.
         let next_gc_round = next_round.saturating_sub(self.max_gc_rounds);
-        // Check if storage needs to be garbage collected.
-        if next_gc_round > current_gc_round {
-            if self
-                .gc_round
-                .compare_exchange(current_gc_round, next_gc_round, Ordering::SeqCst, Ordering::SeqCst)
-                .is_err()
-            {
-                bail!("Concurrent updates to GC round detected.");
-            }
-
+        // Advance the GC round, recording the previous value.
+        let previous_gc_round = self.gc_round.fetch_max(next_gc_round, Ordering::SeqCst);
+        // Only the call that actually advanced the GC round performs the removal sweep.
+        if next_gc_round > previous_gc_round {
             // Remove the GC round(s) from storage.
-            for gc_round in current_gc_round..=next_gc_round {
+            for gc_round in previous_gc_round..=next_gc_round {
                 // Iterate over the certificates for the GC round.
                 for id in self.get_certificate_ids_for_round(gc_round).into_iter() {
                     trace!(
@@ -305,10 +302,6 @@ impl<N: Network> Storage<N> {
                     self.remove_certificate(id);
                 }
             }
-            // Update the GC round.
-            self.gc_round.store(next_gc_round, Ordering::SeqCst);
-        } else if next_gc_round < current_gc_round {
-            bail!("Attempted to decrease GC round from {current_gc_round} to {next_gc_round}");
         }
 
         Ok(())
@@ -1868,6 +1861,67 @@ pub(crate) mod tests {
         assert_eq!(storage.current_round(), start_round + ITERATIONS);
         assert_eq!(storage.current_height(), start_height.max(ITERATIONS as u32 - 1));
     }
+
+    #[test]
+    fn test_concurrent_gc_round_updates_never_regress() {
+        let rng = &mut TestRng::default();
+
+        // Sample a committee.
+        let committee = snarkvm::ledger::committee::test_helpers::sample_committee(rng);
+        // Initialize the ledger.
+        let ledger = Arc::new(MockLedgerService::new(committee));
+        // Initialize the storage with a small GC window so the GC round actually advances
+        // as rounds are garbage collected.
+        let storage = Storage::<CurrentNetwork>::new(ledger, Arc::new(BFTMemoryService::new()), 10).unwrap();
+
+        let start_round = storage.current_round();
+        const ITERATIONS: u64 = 2_000;
+
+        let barrier = Arc::new(std::sync::Barrier::new(3));
+
+        // Thread A mimics the BFT commit path, garbage collecting an increasing sequence of rounds.
+        let storage_a = storage.clone();
+        let barrier_a = barrier.clone();
+        let commit_handle = std::thread::spawn(move || {
+            for round in start_round..start_round + ITERATIONS {
+                barrier_a.wait();
+                storage_a.garbage_collect_certificates(round).expect("garbage_collect_certificates should not fail");
+            }
+        });
+
+        // Thread B mimics the sync-bootup path racing against it with an out-of-order sequence.
+        let storage_b = storage.clone();
+        let barrier_b = barrier.clone();
+        let sync_handle = std::thread::spawn(move || {
+            for i in (0..ITERATIONS).rev() {
+                barrier_b.wait();
+                storage_b
+                    .garbage_collect_certificates(start_round + i)
+                    .expect("garbage_collect_certificates should not fail");
+            }
+        });
+
+        // Thread C repeatedly samples the GC round and asserts it never goes backwards.
+        let storage_c = storage.clone();
+        let barrier_c = barrier.clone();
+        let observer_handle = std::thread::spawn(move || {
+            let mut last_gc_round = storage_c.gc_round();
+            for _ in 0..ITERATIONS {
+                barrier_c.wait();
+                let gc_round = storage_c.gc_round();
+                assert!(gc_round >= last_gc_round, "gc_round regressed: {gc_round} < {last_gc_round}");
+                last_gc_round = gc_round;
+            }
+        });
+
+        commit_handle.join().unwrap();
+        sync_handle.join().unwrap();
+        observer_handle.join().unwrap();
+

```

---

### Incident Patch 10: `a743a2be` (2026-09-23)
**Commit Message**: fix storage logging

**File**: `node/bft/src/helpers/storage.rs` (modified, +3/-3)
```diff
@@ -237,9 +237,6 @@ impl<N: Network> Storage<N> {
         // Update the storage to the next round.
         self.update_current_round(next_round);
 
-        #[cfg(feature = "metrics")]
-        metrics::gauge(metrics::bft::LAST_STORED_ROUND, next_round as f64);
-
         // Retrieve the storage round.
         let storage_round = self.current_round();
         // Retrieve the GC round.
@@ -258,6 +255,9 @@ impl<N: Network> Storage<N> {
             "The next round {next_round} is behind the current GC round {gc_round}, likely because a concurrent sync advanced past it"
         );
 
+        #[cfg(feature = "metrics")]
+        metrics::gauge(metrics::bft::LAST_STORED_ROUND, storage_round as f64);
+
         // Storage may already be ahead of `next_round` if a concurrent sync-applied round update
         // landed in between; return the true storage round rather than the stale `next_round`.
         if storage_round > next_round {
```

---

### Incident Patch 11: `a7155e5c` (2026-09-23)
**Commit Message**: fix wrong logging at bft.rs

**File**: `node/bft/src/bft.rs` (modified, +14/-5)
```diff
@@ -758,6 +758,8 @@ impl<N: Network> BFT<N> {
                 "BFT failed to commit - the subdag anchor round {anchor_round} does not match the leader round {leader_round}",
             );
 
+            let mut ledger_already_advanced = false;
+
             // Trigger consensus (skipped if the round was already committed by a prior call).
             if !skip_consensus && let Some(consensus_sender) = self.consensus_sender.get() {
                 // Initialize a callback sender and receiver.
@@ -768,7 +770,8 @@ impl<N: Network> BFT<N> {
 
                 // Await the callback to continue.
                 match callback_receiver.await {
-                    Ok(Ok(_)) => (),
+                    Ok(Ok(true)) => (),
+                    Ok(Ok(false)) => ledger_already_advanced = true,
                     Ok(Err(err)) => {
                         let err = err.context(format!("BFT failed to advance the subdag for round {anchor_round}"));
                         error!("{}", &flatten_error(err));
@@ -802,11 +805,17 @@ impl<N: Network> BFT<N> {
                 }
             }
 
-            info!(
-                "Committing a subDAG with anchor round {anchor_round} and {num_transmissions} transmissions: {subdag_metadata:?}",
-            );
+            if ledger_already_advanced {
+                debug!(
+                    "Committing a subDAG with anchor round {anchor_round} to the DAG only, as the ledger already contains it",
+                );
+            } else {
+                info!(
+                    "Committing a subDAG with anchor round {anchor_round} and {num_transmissions} transmissions: {subdag_metadata:?}",
+                );
+            }
 
-            // Update the DAG, as the subdag was successfully included into a block.
+            // Update the DAG, as the ledger contains a block for this subdag.
             {
                 let mut dag_write = self.dag.write();
                 let mut count = 0;
```

---

### Incident Patch 12: `a679de76` (2026-09-23)
**Commit Message**: fix backoff

**File**: `node/bft/src/primary/proposal_task.rs` (modified, +5/-1)
```diff
@@ -157,6 +157,7 @@ impl<N: Network> ProposalTask<N> {
     async fn propose<P: BatchPropose>(primary: &P, round: u64) -> bool {
         let mut attempt = 1u32;
         let mut backoff = CREATE_BATCH_INTERVAL;
+
         loop {
             // The round advances both when this primary certifies a batch and when block sync
             // applies a block (`Storage::sync_round_with_block`), so this doubles as the local
@@ -173,11 +174,14 @@ impl<N: Network> ProposalTask<N> {
                 // the committee lookback from the ledger.
                 sleep(backoff).await;
                 backoff = (backoff.saturating_mul(2)).min(MAX_BATCH_DELAY);
-                debug!("Retrying batch proposal for round {round} (attempt #{attempt})");
+                if primary.current_round() != round {
+                    return false;
+                }
             }
 
             // Note: Do NOT spawn a task around this function call.  Proposing a batch is a
             // critical path, and only one batch needs to be proposed at a time.
+            debug!("Trying batch proposal for round {round} (attempt #{attempt})");
             match primary.propose_batch().await {
                 Ok(true) => return true, // batch submitted; proceed to Stage 3
                 Ok(false) => {}          // not ready yet; retry
```

---

### Incident Patch 13: `8ec26205` (2026-09-18)
**Commit Message**: Fix overzealous error logging. It would make the merge devnet workflow fail, even though all nodes were successful (test requires no error logs). This is a reasonable solution since what was happenning was not a real error, we have the exact same pattern a few lines below.

**File**: `node/consensus/src/lib.rs` (modified, +12/-0)
```diff
@@ -609,6 +609,18 @@ impl<N: Network> Consensus<N> {
         let prepare_instant = std::time::Instant::now();
         let block = match ledger_update.prepare_advance_to_next_quorum_block(subdag, transmissions) {
             Ok(block) => block,
+            Err(CheckBlockError::BlockAlreadyExists { .. }) => {
+                debug!("The given block hash already exists in the ledger");
+                return Ok(false);
+            }
+            Err(CheckBlockError::InvalidHeight { .. }) => {
+                debug!("The ledger advanced while we were constructing the next block");
+                return Ok(false);
+            }
+            Err(CheckBlockError::InvalidRound { new, previous }) => {
+                debug!("The subDAG round is too low. Expected >{previous}, got {new}");
+                return Ok(false);
+            }
             Err(err) => return Err(err.into_anyhow()),
         };
         let prepare_elapsed = prepare_instant.elapsed();
```

---

### Incident Patch 14: `fddedaea` (2026-09-18)
**Commit Message**: fixed concurrent updates test. it was not sound.

**File**: `node/bft/src/helpers/storage.rs` (modified, +24/-6)
```diff
@@ -1816,11 +1816,14 @@ pub(crate) mod tests {
     /// `current_round`/`current_height` are written concurrently by two independent paths: the
     /// BFT round-certification path (`increment_to_next_round`) and the sync-applied-block path
     /// (`sync_round_with_block`/`sync_height_with_block`). A third, observing thread continuously
-    /// samples both values while the writers race; neither value may ever be seen to regress.
+    /// samples both values while the writers race; neither value may ever be seen to regress, and
+    /// the final values must converge to the max of what each writer proposed.
     ///
     /// The sync writer deliberately syncs in descending order, so a "stale" (lower) write can
     /// land after a fresher (higher) one — exactly the interleaving the old check-then-act code
-    /// (load, compare, then a separate `store`) could get wrong.
+    /// (load, compare, then a separate `store`) could get wrong. A shared barrier keeps all three
+    /// threads in lockstep, one round per iteration, so the observer is reading concurrently with
+    /// the writers on every iteration instead of racing ahead and finishing before they do.
     #[test]
     fn test_concurrent_round_and_height_updates_never_regress() {
         let rng = &mut TestRng::default();
@@ -1833,31 +1836,42 @@ pub(crate) mod tests {
         let storage = Storage::<CurrentNetwork>::new(ledger, Arc::new(BFTMemoryService::new()), 10_000).unwrap();
 
         let start_round = storage.current_round();
+        let start_height = storage.current_height();
         const ITERATIONS: u64 = 2_000;
 
-        // Thread A mimics the normal BFT path, incrementing one round at a time.
+        let barrier = Arc::new(std::sync::Barrier::new(3));
+
+        // Thread A mimics the normal BFT path, incrementing one round at a time, from a fixed,
+        // known sequence of rounds (rather than re-reading live storage) so its maximum proposed
+        // round is known ahead of time.
         let storage_a = storage.clone();
+        let barrier_a = barrier.clone();
         let increment_handle = std::thread::spawn(move || {
-            for _ in 0..ITERATIONS {
-                let _ = storage_a.increment_to_next_round(storage_a.current_round());
+            for round in start_round..start_round + ITERATIONS {
+                barrier_a.wait();
+                storage_a.increment_to_next_round(round).expect("increment_to_next_round should not fail");
             }
         });
 
         // Thread B mimics a sync-applied block, syncing rounds/heights in descending order.
         let storage_b = storage.clone();
+        let barrier_b = barrier.clone();
         let sync_handle = std::thread::spawn(move || {
             for i in (0..ITERATIONS).rev() {
+                barrier_b.wait();
                 storage_b.sync_round_with_block(start_round + i);
                 storage_b.sync_height_with_block(i as u32);
             }
         });
 
         // Thread C repeatedly samples both values and asserts they never go backwards.
         let storage_c = storage.clone();
+        let barrier_c = barrier.clone();
         let observer_handle = std::thread::spawn(move || {
             let mut last_round = storage_c.current_round();
             let mut last_height = storage_c.current_height();
-            for _ in 0..(ITERATIONS * 10) {
+            for _ in 0..ITERATIONS {
+                barrier_c.wait();
                 let round = storage_c.current_round();
                 let height = storage_c.current_height();
                 assert!(round >= last_round, "current_round regressed: {round} < {last_round}");
@@ -1870,6 +1884,10 @@ pub(crate) mod tests {
         increment_handle.join().unwrap();
         sync_handle.join().unwrap();
         observer_handle.join().unwrap();
+
+        // The final values must converge to the max of what each writer ever proposed.
+        assert_eq!(storage.current_round(), start_round + ITERATIONS);
+        assert_eq!(storage.current_height(), start_height.max(ITERATIONS as u32 - 1));
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #4520** (closed): Bump snarkVM to ProvableHQ/snarkVM@8fab0f156 (@github-actions[bot])
- **PR #4519** (2026-10-05): Bump toml from 0.9.12+spec-1.1.0 to 1.1.6+spec-1.1.0 (@dependabot[bot])
- **PR #4518** (2026-10-05): Bump peak_alloc from 0.2.1 to 0.3.0 (@dependabot[bot])
- **PR #4516** (closed): Bump bincode from 1.3.3 to 3.0.0 (@dependabot[bot])
- **PR #4515** (2026-10-05): Bump the cargo-minor group across 1 directory with 3 updates (@dependabot[bot])
- **PR #4514** (2026-10-05): Merge mainnet into staging (@snarkworld)
- **PR #4511** (2026-10-05): Ignore unscheduled consensus upgrades when selecting the latest message version (@raychu86)
- **PR #4510** (2026-10-02): rest: add allow_partial to clamp block range routes to the tip (@cbeck88)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
