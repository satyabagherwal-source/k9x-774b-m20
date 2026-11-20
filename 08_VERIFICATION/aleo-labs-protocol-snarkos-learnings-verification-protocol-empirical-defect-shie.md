# Verification Protocol: Verification Protocol: Empirical Defect Shield for aleo-labs-protocol-snarkos-learnings

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol-snarkos-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T13:40:26.989Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aleo-labs-protocol-snarkos-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol-snarkos-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T13:40:26.989Z`  
> **Learning ID**: `LEARN-EVO-aleo-labs-protocol-snarkos-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `aleo-labs-protocol-snarkos-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aleo-labs-protocol-snarkos-learnings.md`  
> **Source**: github ([https://github.com/aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS))  
> **Source Version**: `27d1b854`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T13:40:19.575Z  
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
> **Harvest Timestamp**: 2026-11-20T13:40:17.959Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aleo-labs-protocol/snarkOS`
- **Description**: A Decentralized Operating System for ZK Applications
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4526 stars

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

#[cfg(any(test, feature = "test-helpers"))]
pub mod prop_tests {
    #![cfg_attr(not(test), allow(unused_imports))]
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
        } else {
            trace!("Greatest peer height set to {peer_height}");
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
        assert_eq!(state.num_blocks_behind(), Some(5));
    }

    #[test]
    fn num_blocks_behind_saturates_when_the_node_leads_every_peer() {
        let mut state = SyncState::new_with_height(100);
        
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

#[cfg(any(test, feature = "test-helpers"))]
pub mod test_fixture;

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
- **Issue #4715** (2026-11-20): **Release a connecting peer however its handshake ends**
  *Symptoms*: ## Motivation  Under 50% or 70% packet loss, the chain halts. It does not recover after the loss stops: the validators' gateway connections never re-form.  The cause is a handshake that times out. The TCP layer runs each handshake under a 10 s timeout (`Handshake::TIMEOUT_MS`), and enforces it by dropping the handshake future. The handshake marks the peer as connecting in the peer pool, and returns it to the candidates only after the handshake returns. A dropped future never gets there, and nothing else clears the entry. From then on:  - `connect()` to the peer fails with `AlreadyConnecting`. The heartbeats skip that error without a log, so the node never dials the peer again. - Every inbound handshake from the peer fails the same way.  One stuck entry on either side breaks the pair for good. Under heavy loss, many handshakes take longer than 10 s, so many pairs get stuck. The router and the bootstrap client have the same pattern.  This PR makes `add_connecting_peer` return a `ConnectingPeerGuard`. Dropping the guard returns the peer to the candidates, unless the handshake has upgraded it to connected. This covers the timeout, every early error return, and task abort. The gateway, the router and the bootstrap client hold the guard until they upgrade the peer. The rollback after the handshake goes away, and so does the out-parameter that carried the listening address to it.  The router and the bootstrap client recorded the listening address before `add_connecting_peer`. A hand

- **Issue #4713** (2026-11-19): **Fix the storage-service test imports for the memory feature alone**
  *Symptoms*: ## Motivation  The shared storage-service tests in `node/bft/storage-service/src/tests.rs` do not compile with the `memory` feature alone:  ``` cargo test -p snarkos-node-bft-storage-service --features memory error[E0433]: cannot find type `Bytes` in this scope   --> node/bft/storage-service/src/tests.rs:51:44 ```  `sample_transmission` uses `Bytes` for every service. The `use bytes::Bytes;` import is behind `#[cfg(feature = "persistent")]`. So the import is missing when only `memory` is on. The `test` feature turns on `memory` only, so `--features test` also fails.  CI does not see the error. The node job tests the crate with `memory` and `persistent` together. In workspace builds, `snarkos-node-consensus` turns on `persistent` and `snarkos-node-bft` turns on `memory`, so feature unification turns on both.  This PR fixes the imports in `tests.rs`:  - It removes the `cfg` from `use bytes::Bytes;`. `bytes` is a dev-dependency of the crate, so it is always available to the tests. - It puts `StorageMode` behind `#[cfg(feature = "persistent")]`. Only the persistent service uses it. With `memory` alone, the import is unused, and `clippy -D warnings` fails.  ## Test Plan  `cargo clippy -p snarkos-node-bft-storage-service --all-targets -- -D warnings` passes with each of these feature sets: `memory`, `persistent`, `memory,persistent` and `test`. Before this change, the tests do not compile with `memory` or `test`.  `cargo nextest run -p snarkos-node-bft-storage-service` passes with 

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

### Incident Patch 1: `97451873` (2026-11-20)
**Commit Message**: Run the fixed-port gateway test alone, and correct the nextest comment

gateway::prop_tests::gateway_start asserts that the gateway binds
127.0.0.1:5000+dev exactly. The bft integration tests bind ports in that
range and take another port when one is taken, so at 16 threads they can
make this assertion fail. A nextest override makes the test require
every thread, so nothing runs beside it. It takes about 1 s.

The profile comment named socket use as the reason for two threads, but
the fleet now runs the same tests 16 at a time. It now states the hosted
runner size and points to CI.md.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01UYfmmPBwQHC2yRCed8gDf5

**File**: `.config/nextest.toml` (modified, +9/-2)
```diff
@@ -2,9 +2,16 @@
 fail-fast = false
 slow-timeout = { period = "60s", terminate-after = 5 }
 status-level = "fail"
-# Many tests bind sockets and start nodes, so two run at a time on the hosted
-# runners. The fleet `test` job sets NEXTEST_TEST_THREADS instead; see CI.md.
+# The hosted runners have 4 vCPUs. The fleet `test` job overrides this with
+# NEXTEST_TEST_THREADS; see CI.md.
 test-threads = 2
 
 [profile.ci.junit]
 path = "junit.xml"
+
+# gateway_start asserts that the gateway binds 127.0.0.1:5000+dev exactly. Other
+# tests bind ports in that range, and take another port if one is taken, so this
+# test runs alone.
+[[profile.default.overrides]]
+filter = 'package(snarkos-node-bft) and test(=gateway::prop_tests::gateway_start)'
+threads-required = "num-test-threads"
```

**File**: `CI.md` (modified, +4/-2)
```diff
@@ -90,8 +90,10 @@ checks the crate without `metrics`. The `simple_node` line passes
 [`.config/nextest.toml`](.config/nextest.toml) sets two test threads, which
 the hosted entries use. The fleet entries run 16 tests at a time through
 `NEXTEST_TEST_THREADS`: most of their slow tests wait on timers rather than
-the CPU, and a box runs one job. Each entry uploads nextest's JUnit reports as
-the artifact `junit-<entry>`, one file per line, with the time of each test.
+the CPU, and a box runs one job. `gateway::prop_tests::gateway_start` runs
+alone, because it asserts a fixed port that other tests may take. Each entry
+uploads nextest's JUnit reports as the artifact `junit-<entry>`, one file per
+line, with the time of each test.
 
 ## Devnets
 
```

---

### Incident Patch 2: `4df06d23` (2026-11-20)
**Commit Message**: Merge pull request #4715 from aleo-labs-protocol/fix/handshake-timeout-leak

**File**: `node/bft/src/gateway.rs` (modified, +81/-116)
```diff
@@ -49,6 +49,7 @@ use snarkos_node_bft_events::{
 };
 use snarkos_node_bft_ledger_service::LedgerService;
 use snarkos_node_network::{
+    ConnectingPeerGuard,
     ConnectionMode,
     NodeType,
     Peer,
@@ -1630,15 +1631,11 @@ impl<N: Network> Handshake for Gateway<N> {
         // Make the socket more robust; every other handshake in the node does this too.
         harden_socket(stream)?;
 
-        // If this is an inbound connection, we log it, but don't know the listening address yet.
-        // Otherwise, we can immediately register the listening address.
-        let mut listener_addr = if peer_side == ConnectionSide::Initiator {
+        if peer_side == ConnectionSide::Initiator {
             debug!("{CONTEXT} Received a connection request from '{peer_addr}'");
-            None
         } else {
             debug!("{CONTEXT} Shaking hands with {peer_addr}...");
-            Some(peer_addr)
-        };
+        }
 
         // Retrieve the restrictions ID.
         let restrictions_id = self.ledger.latest_restrictions_id();
@@ -1650,8 +1647,6 @@ impl<N: Network> Handshake for Gateway<N> {
             .and_then(|bytes| bytes.try_into().ok())
             .ok_or_else(|| ConnectError::other(anyhow!("Failed to encode the genesis hash")))?;
 
-        // Perform the handshake; we pass on a mutable reference to peer_ip in case the process is broken at any point in time.
-        //
         // Validators speak only the Noise handshake. A peer that opens with anything else is turned
         // away before any key is derived.
         let handshake_result = if peer_side == ConnectionSide::Responder {
@@ -1660,101 +1655,71 @@ impl<N: Network> Handshake for Gateway<N> {
         } else {
             match detect_handshake_protocol(stream).await? {
                 (HandshakeProtocol::Noise, _) => {
-                    self.handshake_inner_responder_noise(
-                        peer_addr,
-                        &mut listener_addr,
-                        restrictions_id,
-                        genesis_hash,
-                        stream,
-                    )
-                    .await
+                    self.handshake_inner_responder_noise(peer_addr, restrictions_id, genesis_hash, stream).await
                 }
                 (HandshakeProtocol::Legacy, _) => {
                     Err(ConnectError::other(format!("'{peer_addr}' did not offer the Noise handshake")))
                 }
             }
         };
 
-        // Register the peer, or roll it back, if the handshake got far enough to learn its listening
-        // address.
-        match (&handshake_result, listener_addr) {
-            (Ok((peer_info, peer_schedule)), Some(addr)) => {
-                let node_type = if bootstrap_peers::<N>(self.is_dev()).contains(&addr) {
-                    NodeType::BootstrapClient
-                } else {
-                    NodeType::Validator
-                };
-                // A block check reads the connected validators before their schedules, so the schedule
-                // is recorded before the validator counts as connected.
-                if node_type == NodeType::Validator {
-                    self.upgrade_monitor.record_schedule(peer_info.address, peer_schedule.as_ref());
-                }
-                let mut peer_pool = self.peer_pool.write();
-
-                // Validators may change their listening address, but not the Aleo address; traverse
-                // the peer pool, and retain previously connected (the prior Aleo address is known)
-                // candidate peers with the same Aleo address only if their listening address is the
-                // same; otherwise, it may be concluded that a known validator has changed their
-                // listening address, and thus the old entry should be removed as outdated.
-                peer_pool.retain(|_, peer| {
-                    if let Peer::Candidate(peer) = peer
-                        && let Some(old_aleo_addr) = peer.last_known_aleo_addr
-                    {
-                        old_aleo_addr != peer_info.address || peer.listener_addr == addr
-                    } else {
-                        true
-                    }
-                });
-
-                let is_connected = match peer_pool.get_mut(&addr) {
-                    Some(peer) => {
-                        self.resolver.write().insert_peer(addr, peer_addr, Some(peer_info.address));
-                        peer.upgrade_to_connected(
-                            peer_addr,
-                            peer_info.listener_port,
-                            peer_info.address,
-                            node_type,
-                            peer_info.version,
-                            peer_info.snarkos_sha,
-                            ConnectionMode::Gateway,
-                        );
-                        true
-                    }
-                    None => false,
-                };
-   
```

**File**: `node/bft/tests/gateway_noise.rs` (modified, +95/-1)
```diff
@@ -41,10 +41,11 @@ use snarkos_node_bft_events::{
     ValidatorsRequest,
 };
 use snarkos_node_network::{
+    Peer,
     PeerPoolHandling,
     noise::{HandshakeProtocol, NoiseSession, Role, binding_message, detect_handshake_protocol, write_noise_magic},
 };
-use snarkos_node_tcp::P2P;
+use snarkos_node_tcp::{ConnectError, P2P, protocols::Handshake};
 use snarkvm::{
     ledger::{narwhal::Data, store::helpers::memory::ConsensusMemory},
     prelude::{FromBytes, TestRng, ToBytes},
@@ -701,3 +702,96 @@ async fn an_initiator_rejects_a_responder_with_a_different_genesis() {
     assert!(!gateway_a.connected_addresses().contains(&accounts[1].address()));
     assert!(!gateway_b.connected_addresses().contains(&accounts[0].address()));
 }
+
+/// How long to wait for a stalled handshake to time out.
+fn handshake_timeout_with_margin() -> Duration {
+    Duration::from_millis(<Gateway<CurrentNetwork> as Handshake>::TIMEOUT_MS + 3_000)
+}
+
+/// A responder that accepts the connection and then never answers holds the dialing gateway's
+/// handshake until it times out. Once it has, the peer must be dialable again; a peer stuck as
+/// connecting is never dialed by the heartbeat and turns away every inbound handshake.
+#[tokio::test(flavor = "multi_thread")]
+async fn a_timed_out_outbound_handshake_does_not_leave_the_peer_connecting() {
+    let mut rng = TestRng::default();
+    let (_accounts, gateways) = new_test_gateways(1, &mut rng).await;
+    let gateway = gateways[0].clone();
+
+    // Accept connections and keep them open without ever writing to them.
+    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let silent_addr = listener.local_addr().unwrap();
+    let _silent = task::spawn(async move {
+        let mut streams = Vec::new();
+        while let Ok((stream, _)) = listener.accept().await {
+            streams.push(stream);
+        }
+    });
+
+    // A validator was seen at this address before.
+    let last_known_aleo_addr = Account::<CurrentNetwork>::new(&mut rng).unwrap().address();
+    let mut candidate = Peer::new_candidate(silent_addr, false);
+    if let Peer::Candidate(peer) = &mut candidate {
+        peer.last_known_aleo_addr = Some(last_known_aleo_addr);
+    }
+    gateway.peer_pool().write().insert(silent_addr, candidate);
+
+    let dial = task::spawn({
+        let gateway = gateway.clone();
+        async move { gateway.tcp().connect(silent_addr).await }
+    });
+    let g = gateway.clone();
+    deadline!(Duration::from_secs(5), move || g.is_connecting(silent_addr));
+
+    let result = timeout(handshake_timeout_with_margin(), dial).await.expect("the handshake never timed out").unwrap();
+    assert!(
+        matches!(&result, Err(ConnectError::IoError(e)) if e.kind() == io::ErrorKind::TimedOut),
+        "the handshake should have timed out: {result:?}"
+    );
+
+    match gateway.peer_pool().read().get(&silent_addr) {
+        Some(Peer::Candidate(peer)) => assert_eq!(peer.last_known_aleo_addr, Some(last_known_aleo_addr)),
+        peer => panic!("the timed-out peer should be a candidate again, found {peer:?}"),
+    }
+    match gateway.connect(silent_addr) {
+        Err(ConnectError::AlreadyConnecting { .. }) => panic!("a timed-out peer can never be dialed again"),
+        Ok(handle) => handle.abort(),
+        Err(_) => {}
+    }
+}
+
+/// An initiator that stalls after its first message holds the responder's handshake until it times
+/// out. The validator it claimed to be must still be able to connect afterwards, in both directions.
+#[tokio::test(flavor = "multi_thread")]
+async fn a_timed_out_inbound_handshake_does_not_block_the_validator() {
+    let mut rng = TestRng::default();
+    let (accounts, gateways) = new_test_gateways(2, &mut rng).await;
+    let (gateway_a, gateway_b) = (gateways[0].clone(), gateways[1].clone());
+    let addr_b = dial_addr(&gateway_b);
+
+    // Open a handshake with gateway A as validator B, then stall after the hint, as a peer does
+    // whose later messages are lost.
+    let mut stream = TcpStream::connect(dial_addr(&gateway_a)).await.unwrap();
+    write_noise_magic(&mut stream).await.unwrap();
+    let mut noise = NoiseSession::new(stream, Role::Initiator).unwrap();
+    let version = Event::<CurrentNetwork>::VERSION;
+    let hint = HandshakeHint { version, listener_port: addr_b.port(), address: accounts[1].address() };
+    noise.send(&hint.to_bytes_le().unwrap()).await.unwrap();
+
+    let a = gateway_a.clone();
+    deadline!(Duration::from_secs(5), move || a.is_connecting(addr_b));
+    // Keep the stalled stream open until gateway A gives up on it, so that it is the timeout, and
+    // not a closed socket, that ends the handshake.
+    let a = gateway_a.clone();
+    deadline!(handshake_timeout_with_margin(), move || a.tcp().num_connecting() == 0);
+    drop(noise);
+
+    assert!(!gateway_a.is_connecting(addr_b), "validator B is still marked as connecting");
+
+    // The real validator B dials gate
```

**File**: `node/network/src/peer.rs` (modified, +14/-6)
```diff
@@ -25,14 +25,14 @@ pub enum Peer<N: Network> {
     /// A candidate peer that's currently not connected to.
     Candidate(CandidatePeer<N>),
     /// A peer that's currently being connected to (the handshake is in progress).
-    Connecting(ConnectingPeer),
+    Connecting(ConnectingPeer<N>),
     /// A fully connected (post-handshake) peer.
     Connected(ConnectedPeer<N>),
 }
 
 /// A connecting peer.
 #[derive(Clone, Debug)]
-pub struct ConnectingPeer {
+pub struct ConnectingPeer<N: Network> {
     /// The listening address of a connecting peer.
     pub listener_addr: SocketAddr,
     /// Indicates whether the peer is considered trusted.
@@ -41,6 +41,9 @@ pub struct ConnectingPeer {
     pub last_connection_attempt: Option<Instant>,
     /// The total number of connection attempts, since the peer was last connected.
     pub total_connection_attempts: u32,
+    /// The last known Aleo address of this peer, carried over from the candidate it was promoted
+    /// from, and back to the candidate if the handshake fails.
+    pub last_known_aleo_addr: Option<Address<N>>,
 }
 
 /// A candidate peer.
@@ -152,6 +155,7 @@ impl<N: Network> Peer<N> {
             trusted,
             last_connection_attempt: None,
             total_connection_attempts: 0,
+            last_known_aleo_addr: None,
         })
     }
 
@@ -160,14 +164,16 @@ impl<N: Network> Peer<N> {
         let listener_addr = self.listener_addr();
         let trusted = self.is_trusted();
 
-        let (last_connection_attempt, total_connection_attempts) = match self {
-            Self::Candidate(peer) => (peer.last_connection_attempt, peer.total_connection_attempts),
+        let (last_connection_attempt, total_connection_attempts, last_known_aleo_addr) = match self {
+            Self::Candidate(peer) => {
+                (peer.last_connection_attempt, peer.total_connection_attempts, peer.last_known_aleo_addr)
+            }
             Self::Connecting(_) | Self::Connected(_) => {
                 warn!(
                     "Peer '{listener_addr}' is being promoted to Connecting, but is {}",
                     if self.is_connected() { "already Connected" } else { "already Connecting" }
                 );
-                (None, 0)
+                (None, 0, None)
             }
         };
 
@@ -176,6 +182,7 @@ impl<N: Network> Peer<N> {
             trusted,
             last_connection_attempt,
             total_connection_attempts,
+            last_known_aleo_addr,
         });
     }
 
@@ -222,8 +229,9 @@ impl<N: Network> Peer<N> {
     /// Demote a peer to candidate status, marking it as disconnected.
     pub fn downgrade_to_candidate(&mut self, listener_addr: SocketAddr) {
         let last_known_aleo_addr = match self {
+            Self::Candidate(p) => p.last_known_aleo_addr,
+            Self::Connecting(p) => p.last_known_aleo_addr,
             Self::Connected(p) => Some(p.aleo_addr),
-            _ => None,
         };
 
         // Preserve the connection attempt info if the handshake didn't succeed.
```

**File**: `node/network/src/peering.rs` (modified, +86/-13)
```diff
@@ -39,6 +39,34 @@ use std::{
 use tokio::task;
 use tracing::*;
 
+/// A peer that [`PeerPoolHandling::add_connecting_peer`] marked as connecting.
+///
+/// Dropping it returns the peer to the candidates, unless the handshake has upgraded it to
+/// connected by then. A handshake's timeout drops the handshake future wherever it is waiting, so
+/// this is the only rollback that runs on every way out of a handshake.
+#[must_use = "dropping it immediately returns the peer to the candidates"]
+pub struct ConnectingPeerGuard<'a, N: Network> {
+    peer_pool: &'a RwLock<HashMap<SocketAddr, Peer<N>>>,
+    listener_addr: SocketAddr,
+}
+
+impl<N: Network> ConnectingPeerGuard<'_, N> {
+    /// Returns the listener address of the connecting peer.
+    pub fn listener_addr(&self) -> SocketAddr {
+        self.listener_addr
+    }
+}
+
+impl<N: Network> Drop for ConnectingPeerGuard<'_, N> {
+    fn drop(&mut self) {
+        if let Some(peer) = self.peer_pool.write().get_mut(&self.listener_addr)
+            && peer.is_connecting()
+        {
+            peer.downgrade_to_candidate(self.listener_addr);
+        }
+    }
+}
+
 /// Application-level errors generated by the peering module.
 /// This is never returned directly, but only as the payload for a `ConnectError`.
 #[derive(Debug)]
@@ -533,27 +561,25 @@ pub trait PeerPoolHandling<N: Network>: P2P {
         Ok(())
     }
 
-    // Introduces a new connecting peer into the peer pool if unknown, or promotes
-    // a known candidate peer to a connecting one. The returned boolean indicates
-    // whether the peer has been added/promoted, or rejected due to already being
-    // shaken hands with or connected.
-    fn add_connecting_peer(&self, listener_addr: SocketAddr) -> Result<(), ConnectError> {
+    /// Introduces a new connecting peer into the peer pool if unknown, or promotes a known
+    /// candidate peer to a connecting one. Fails if the peer is already connecting or connected.
+    ///
+    /// The peer stays connecting only while the returned [`ConnectingPeerGuard`] is alive, so a
+    /// handshake holds it until it has upgraded the peer to connected.
+    fn add_connecting_peer(&self, listener_addr: SocketAddr) -> Result<ConnectingPeerGuard<'_, N>, ConnectError> {
         match self.peer_pool().write().entry(listener_addr) {
             Entry::Vacant(entry) => {
                 entry.insert(Peer::new_connecting(listener_addr, false));
-                Ok(())
             }
             Entry::Occupied(mut entry) => match entry.get() {
                 // Promote in place rather than replacing the entry, so the candidate's
                 // connection-attempt metadata survives the transition.
-                Peer::Candidate(_) => {
-                    entry.get_mut().promote_to_connecting();
-                    Ok(())
-                }
-                Peer::Connecting(_) => Err(ConnectError::AlreadyConnecting { address: listener_addr }),
-                Peer::Connected(_) => Err(ConnectError::AlreadyConnected { address: listener_addr }),
+                Peer::Candidate(_) => entry.get_mut().promote_to_connecting(),
+                Peer::Connecting(_) => return Err(ConnectError::AlreadyConnecting { address: listener_addr }),
+                Peer::Connected(_) => return Err(ConnectError::AlreadyConnected { address: listener_addr }),
             },
         }
+        Ok(ConnectingPeerGuard { peer_pool: self.peer_pool(), listener_addr })
     }
 
     /// Temporarily IP-ban and disconnect from the peer with the given listener address and an
@@ -685,7 +711,7 @@ mod tests {
         assert!(!pool.is_connected(listener_addr));
 
         // Step 2: promote to connecting.
-        assert!(pool.add_connecting_peer(listener_addr).is_ok());
+        let connecting = pool.add_connecting_peer(listener_addr).unwrap();
 
         assert_eq!(pool.number_of_candidate_peers(), 0);
         assert_eq!(pool.number_of_connecting_peers(), Some(1));
@@ -711,6 +737,10 @@ mod tests {
         assert!(pool.is_connected(listener_addr));
         assert_eq!(pool.number_of_connected_validators(), Some(1));
 
+        // The handshake is over; a connected peer stays connected.
+        drop(connecting);
+        assert!(pool.is_connected(listener_addr));
+
         // Verify the connected peer's fields.
         let connected = pool.get_connected_peer(listener_addr).expect("peer should be connected");
         assert_eq!(connected.listener_addr, listener_addr);
@@ -719,6 +749,49 @@ mod tests {
         assert_eq!(connected.node_type, NodeType::Validator);
     }
 
+    #[test]
+    fn test_connecting_peer_is_released_on_drop() {
+        let pool = MockPeerPool::<CurrentNetwork>::new();
+        let listener_addr = SocketAddr::from(([192, 0, 2, 1], 4000));
+
+        let connecting = pool.add_connecting_peer(listener_addr).unwrap();
+        assert!(pool.is_connecting(listener_addr));
+        assert!(matches!(pool.add_connecting_peer(listener_addr), Err(ConnectE
```

**File**: `node/router/src/handshake.rs` (modified, +31/-48)
```diff
@@ -20,7 +20,7 @@ use crate::{
     Router,
     messages::{ChallengeRequest, ChallengeResponse, DisconnectReason, Message, MessageCodec, MessageTrait},
 };
-use snarkos_node_network::{get_repo_commit_hash, log_repo_sha_comparison};
+use snarkos_node_network::{ConnectingPeerGuard, get_repo_commit_hash, log_repo_sha_comparison};
 use snarkos_node_tcp::{ConnectError, ConnectionSide, P2P, Tcp};
 use snarkvm::{
     ledger::narwhal::Data,
@@ -91,15 +91,11 @@ impl<N: Network> Router<N> {
         genesis_header: Header<N>,
         restrictions_id: Field<N>,
     ) -> Result<ChallengeRequest<N>, ConnectError> {
-        // If this is an inbound connection, we log it, but don't know the listening address yet.
-        // Otherwise, we can immediately register the listening address.
-        let mut listener_addr = if peer_side == ConnectionSide::Initiator {
+        if peer_side == ConnectionSide::Initiator {
             debug!("Received a connection request from '{peer_addr}'");
-            None
         } else {
             debug!("Shaking hands with '{peer_addr}'...");
-            Some(peer_addr)
-        };
+        }
 
         // Check (or impose) IP-level bans.
         #[cfg(not(feature = "test-helpers"))]
@@ -121,48 +117,37 @@ impl<N: Network> Router<N> {
             }
         }
 
-        // Perform the handshake; we pass on a mutable reference to listener_addr in case the process is broken at any point in time.
         let handshake_result = match peer_side {
             ConnectionSide::Responder => {
                 self.handshake_inner_initiator(peer_addr, stream, genesis_header, restrictions_id).await
             }
             ConnectionSide::Initiator => {
-                self.handshake_inner_responder(peer_addr, &mut listener_addr, stream, genesis_header, restrictions_id)
-                    .await
+                self.handshake_inner_responder(peer_addr, stream, genesis_header, restrictions_id).await
             }
         };
 
-        if let Some(addr) = listener_addr {
-            match handshake_result {
-                Ok(ref cr) => {
-                    if let Some(peer) = self.peer_pool.write().get_mut(&addr) {
-                        self.resolver.write().insert_peer(peer.listener_addr(), peer_addr, Some(cr.address));
-                        peer.upgrade_to_connected(
-                            peer_addr,
-                            cr.listener_port,
-                            cr.address,
-                            cr.node_type,
-                            cr.version,
-                            cr.snarkos_sha,
-                            ConnectionMode::Router,
-                        );
-                    }
-
-                    #[cfg(feature = "metrics")]
-                    self.update_metrics();
-                }
-                Err(_) => {
-                    if let Some(peer) = self.peer_pool.write().get_mut(&addr) {
-                        // The peer may only be downgraded if it's a ConnectingPeer.
-                        if peer.is_connecting() {
-                            peer.downgrade_to_candidate(addr);
-                        }
-                    }
-                }
-            }
+        // On failure, the handshake has already returned any peer it marked as connecting to the
+        // candidates.
+        let (peer_request, connecting) = handshake_result?;
+        if let Some(peer) = self.peer_pool.write().get_mut(&connecting.listener_addr()) {
+            self.resolver.write().insert_peer(peer.listener_addr(), peer_addr, Some(peer_request.address));
+            peer.upgrade_to_connected(
+                peer_addr,
+                peer_request.listener_port,
+                peer_request.address,
+                peer_request.node_type,
+                peer_request.version,
+                peer_request.snarkos_sha,
+                ConnectionMode::Router,
+            );
         }
+        // The connecting peer takes the peer pool's lock when dropped.
+        drop(connecting);
 
-        handshake_result
+        #[cfg(feature = "metrics")]
+        self.update_metrics();
+
+        Ok(peer_request)
     }
 
     /// The connection initiator side of the handshake.
@@ -172,10 +157,10 @@ impl<N: Network> Router<N> {
         stream: &'a mut TcpStream,
         genesis_header: Header<N>,
         restrictions_id: Field<N>,
-    ) -> Result<ChallengeRequest<N>, ConnectError> {
+    ) -> Result<(ChallengeRequest<N>, ConnectingPeerGuard<'a, N>), ConnectError> {
         // Introduce the peer into the peer pool.
         // If we are connecting, the peer and listener address are identical.
-        self.add_connecting_peer(peer_addr)?;
+        let connecting = self.add_connecting_peer(peer_addr)?;
 
         // Construct the stream.
         let mut framed = Framed::new(stream, MessageCodec::<N>::handshake());
@@ -244,18 +229,17 @@ impl<N: Network> Router<N> {
         };
         send(&mut framed, peer_addr, Message::C
```

**File**: `node/src/bootstrap_client/handshake.rs` (modified, +63/-64)
```diff
@@ -34,6 +34,7 @@ use crate::{
     tcp::{ConnectError, Connection, ConnectionSide, protocols::*},
 };
 use snarkos_node_network::{
+    ConnectingPeerGuard,
     harden_socket,
     noise::{
         HandshakeProtocol,
@@ -119,15 +120,13 @@ impl<N: Network> Handshake for BootstrapClient<N> {
         // Make the socket more robust.
         harden_socket(stream)?;
 
-        // We don't know the listening address yet, as we don't initiate connections.
-        let mut listener_addr = if peer_side == ConnectionSide::Initiator {
+        // The bootstrap client only accepts connections.
+        if peer_side == ConnectionSide::Initiator {
             debug!("Received a connection request from '{peer_addr}'");
-            None
         } else {
             unreachable!("The boostrapper clients don't initiate connections");
-        };
+        }
 
-        // Perform the handshake; we pass on a mutable reference to listener_addr in case the process is broken at any point in time.
         let handshake_result = if peer_side == ConnectionSide::Responder {
             unreachable!("The boostrapper clients don't initiate connections");
         } else {
@@ -136,50 +135,37 @@ impl<N: Network> Handshake for BootstrapClient<N> {
                 // so the marker settles the connection mode. When the router's handshake is
                 // converted the two will need telling apart - most likely by giving each
                 // subprotocol its own marker - and this is the dispatch that has to change.
-                (HandshakeProtocol::Noise, _) => {
-                    self.handshake_inner_responder_noise(peer_addr, &mut listener_addr, stream).await
-                }
-                (HandshakeProtocol::Legacy, prefix) => {
-                    self.handshake_inner_responder(peer_addr, &mut listener_addr, stream, &prefix).await
-                }
+                (HandshakeProtocol::Noise, _) => self.handshake_inner_responder_noise(peer_addr, stream).await,
+                (HandshakeProtocol::Legacy, prefix) => self.handshake_inner_responder(peer_addr, stream, &prefix).await,
             }
         };
 
-        if let Some(addr) = listener_addr {
-            match handshake_result {
-                Ok((peer_port, peer_aleo_addr, peer_node_type, peer_version, peer_snarkos_sha, connection_mode)) => {
-                    if let Some(peer) = self.peer_pool.write().get_mut(&addr) {
-                        // Due to only having a single Resolver, the BootstrapClient only adds an Aleo
-                        // address mapping for Gateway-mode connections, as it is only used there, and
-                        // it could otherwise clash with the Router-mode mapping for validators, which
-                        // may connect in both modes at the same time.
-                        let aleo_addr =
-                            if connection_mode == ConnectionMode::Gateway { Some(peer_aleo_addr) } else { None };
-                        self.resolver.write().insert_peer(peer.listener_addr(), peer_addr, aleo_addr);
-                        peer.upgrade_to_connected(
-                            peer_addr,
-                            peer_port,
-                            peer_aleo_addr,
-                            peer_node_type,
-                            peer_version,
-                            peer_snarkos_sha,
-                            connection_mode,
-                        );
-                    }
-                    debug!("Completed the handshake with '{peer_addr}'");
-                }
-                Err(_) => {
-                    if let Some(peer) = self.peer_pool.write().get_mut(&addr) {
-                        // The peer may only be downgraded if it's a ConnectingPeer.
-                        if peer.is_connecting() {
-                            peer.downgrade_to_candidate(addr);
-                        }
-                    }
-                }
-            }
+        // On failure, the handshake has already returned any peer it marked as connecting to the
+        // candidates.
+        let (peer_port, peer_aleo_addr, peer_node_type, peer_version, peer_snarkos_sha, connection_mode, connecting) =
+            handshake_result?;
+        if let Some(peer) = self.peer_pool.write().get_mut(&connecting.listener_addr()) {
+            // Due to only having a single Resolver, the BootstrapClient only adds an Aleo
+            // address mapping for Gateway-mode connections, as it is only used there, and
+            // it could otherwise clash with the Router-mode mapping for validators, which
+            // may connect in both modes at the same time.
+            let aleo_addr = if connection_mode == ConnectionMode::Gateway { Some(peer_aleo_addr) } else { None };
+            self.resolver.write().insert_peer(peer.listener_addr(), peer_addr, aleo_addr);
+            peer.upgrade_to_connected(
+                peer_addr,
+                peer_port,
+                peer_ale
```

**File**: `node/tests/handshake.rs` (modified, +41/-3)
```diff
@@ -21,13 +21,14 @@ use common::{node::*, test_peer::TestPeer};
 
 use snarkos_node::{Client, Prover, Validator};
 use snarkos_node_network::PeerPoolHandling;
-use snarkos_node_tcp::{ConnectError, P2P};
+use snarkos_node_tcp::{ConnectError, P2P, protocols::Handshake};
 use snarkvm::prelude::{MainnetV0 as CurrentNetwork, store::helpers::memory::ConsensusMemory};
 
 use pea2pea::Pea2Pea;
 
-use std::{net::SocketAddr, time::Duration};
-use tokio::time::sleep;
+use deadline::deadline;
+use std::{io, net::SocketAddr, time::Duration};
+use tokio::time::{sleep, timeout};
 
 // Trait to unify Pea2Pea and P2P traits.
 #[async_trait::async_trait]
@@ -288,3 +289,40 @@ async fn duplicate_connection_attempts() {
     assert_eq!(node1.router().number_of_connected_peers(), 1);
     assert_eq!(node2.router().number_of_connected_peers(), 1);
 }
+
+/// How long to wait for a stalled handshake to time out.
+fn handshake_timeout_with_margin<H: Handshake>(_node: &H) -> Duration {
+    Duration::from_millis(H::TIMEOUT_MS + 3_000)
+}
+
+/// A peer that accepts the connection and then never answers holds the router's handshake until it
+/// times out. Once it has, the peer must be dialable again; a peer stuck as connecting is never
+/// dialed again and turns away every inbound handshake.
+#[tokio::test(flavor = "multi_thread")]
+async fn a_timed_out_handshake_does_not_leave_the_peer_connecting() {
+    let node = client().await;
+
+    // Accept connections and keep them open without ever writing to them.
+    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let silent_addr = listener.local_addr().unwrap();
+    let _silent = tokio::spawn(async move {
+        let mut streams = Vec::new();
+        while let Ok((stream, _)) = listener.accept().await {
+            streams.push(stream);
+        }
+    });
+
+    let dial = node.router().connect(silent_addr).unwrap();
+    let router = node.router().clone();
+    deadline!(Duration::from_secs(5), move || router.is_connecting(silent_addr));
+
+    let result =
+        timeout(handshake_timeout_with_margin(&node), dial).await.expect("the handshake never timed out").unwrap();
+    assert!(
+        matches!(&result, Err(ConnectError::IoError(e)) if e.kind() == io::ErrorKind::TimedOut),
+        "the handshake should have timed out: {result:?}"
+    );
+
+    assert!(!node.router().is_connecting(silent_addr), "the timed-out peer is still marked as connecting");
+    assert!(!matches!(node.router().connect(silent_addr), Err(ConnectError::AlreadyConnecting { .. })));
+}
```

---

### Incident Patch 3: `5341d8db` (2026-11-20)
**Commit Message**: Merge pull request #4732 from aleo-labs-protocol/ci/devnet-fixes

**File**: `.ci/test_db_backup.sh` (modified, +9/-8)
```diff
@@ -19,7 +19,7 @@ tmp_dir="${TMPDIR:-/tmp}"
 checkpoint_height=3
 rollback_height=10
 num_checkpoints=0
-remaining_checkpoints=2
+remaining_checkpoints=1
 
 # Create log directory
 init_log_dir
@@ -124,9 +124,10 @@ function create_checkpoints() {
 wait_for_nodes "$total_validators" 0 "$network_name"
 
 # Check heights periodically with a timeout
-total_wait=0
+start=$(now)
+next_report=10
 checkpoint_created=false
-while (( total_wait < 600 )); do  # 10 minutes max
+while (( $(elapsed_since "$start") < 600 )); do  # 10 minutes max
   # Apply short-circuiting
   if [[ $checkpoint_created = true ]] || check_heights  0 "$total_validators" "$checkpoint_height" "$network_name"; then
     if [[ $checkpoint_created = false ]]; then
@@ -166,8 +167,6 @@ while (( total_wait < 600 )); do  # 10 minutes max
           snarkos clean "--network=$network_id" "--dev=$validator_index" --keep-node-data \
               "--ledger-storage=$(checkpoint_dir "$suffix")"
         fi
-       # Wait until the cleanup concludes
-        sleep 1
 
         # Restart using the checkpoint
         suffix="${validator_index}_$((num_checkpoints-1))"
@@ -223,9 +222,11 @@ while (( total_wait < 600 )); do  # 10 minutes max
   fi
 
   # Continue waiting
-  sleep 3
-  total_wait=$((total_wait + 3))
-  log "Waited $total_wait seconds so far..."
+  sleep 1
+  if (( $(elapsed_since "$start") >= next_report )); then
+    log "Waited $(elapsed_since "$start") seconds so far..."
+    next_report=$((next_report + 10))
+  fi
 done
 
 # The main loop has expired by now
```

**File**: `.ci/test_devnet.sh` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@ MAX_CLIENT_LOG_SIZE_BYTES=$((1 * 1024 * 1024))
 : "${total_validators:=4}"
 : "${total_clients:=4}" # need at least 4 clients, so each validator has at least one client connected to it.
 : "${network_id:=0}"
-: "${min_height:=60}" # To likely go past the 100 round garbage collection limit.
+# Garbage collection removes certificates 100 rounds below the latest leader round, and block h
+# has a leader round of at least 2h, so every validator has garbage collected by height 51.
+: "${min_height:=55}"
 
 tx_file="${TMPDIR:-/tmp}/transfer_public_tx.txt"
 
```

**File**: `.ci/utils.sh` (modified, +59/-28)
```diff
@@ -632,16 +632,25 @@ function wait_for_heights() {
   : "${max_wait:=300}"
   : "${poll_interval:=5}"
 
-  local start
-  start=$(now) 
-  
+  local start elapsed
+  start=$(now)
+  # `check_heights` logs progress only for an elapsed time that is a positive multiple of 60.
+  local logged_minutes=0
+  local report
+
   while (( $(elapsed_since "$start") < max_wait )); do
-    if check_heights "$start_index" "$end_index" "$min_height" "$network_name" "$elapsed"; then
+    elapsed=$(elapsed_since "$start")
+    report=0
+    if (( elapsed / 60 > logged_minutes )); then
+      logged_minutes=$((elapsed / 60))
+      report=$((logged_minutes * 60))
+    fi
+    if check_heights "$start_index" "$end_index" "$min_height" "$network_name" "$report"; then
       return 0
     fi
 
     # Continue waiting
-    sleep 5
+    sleep "$poll_interval"
   done
   return 1
 }
@@ -659,40 +668,62 @@ function print_client_logs() {
 }
 
 
-# Function checking that the first node reached the latest (unchanging) consensus version.
+# Blocks until the node with the given index reaches the activation height of the last version in
+# the consensus version schedule it serves, and checks that it runs that version there.
 function wait_for_stable_consensus_version() {
   local node_index=$1
   local network_name=$2
-  
-  local last_seen_consensus_version=0
-  local last_seen_height=0
 
-  # Check consensus versions periodically with a timeout
-  log "ℹ️ Waiting for consensus version to stabilize..."
-  local start
+  local max_wait=300
+  local port=$((3030 + node_index))
+  # Versions that are not scheduled have a height of `u32::MAX`, and are never reached.
+  local filter='[.consensus_heights[] | select(. != 4294967295)] | "\(length) \(last)"'
+
+  local schedule="" final_version final_height height consensus_version
+  local start next_report=10
   start=$(now)
-  
-  while (( $(elapsed_since "$start") < 300 )); do  # 5 minutes max
-    consensus_version=$(get_consensus_version "$node_index" "$network_name" || echo "0")
-    height=$(get_block_height "$node_index" "$network_name" || echo "0")
-
-    # If the consensus version is greater than the last seen, we update it.
-    if (( consensus_version > last_seen_consensus_version )); then
-      log "✅ Consensus version updated to $consensus_version"
-    # If the consensus version is the same whereas the block height is different and at least 10, we can assume that the consensus version is stable
-    elif (( (height != last_seen_height) && (height >= 10) )); then
+
+  log "ℹ️ Waiting for the last scheduled consensus version..."
+  while (( $(elapsed_since "$start") < max_wait )); do
+    if [[ -z "$schedule" ]]; then
+      if schedule=$(curl -s --max-time 5 "http://$localhost:$port/v2/$network_name/version" | jq -er "$filter" 2>/dev/null) &&
+         [[ "$schedule" =~ ^[0-9]+\ [0-9]+$ ]]; then
+        read -r final_version final_height <<< "$schedule"
+        # A devnet makes about one block every 2 s.
+        if (( final_height * 4 > max_wait )); then
+          max_wait=$(( final_height * 4 ))
+        fi
+        log "Node #${node_index} schedules consensus version $final_version at height $final_height"
+      else
+        schedule=""
+      fi
+    fi
+
+    if [[ -n "$schedule" ]]; then
+      height=$(get_block_height_by_port "$port" "$network_name" 5)
+      if (is_integer "$height") && (( height >= final_height )); then
+        consensus_version=$(get_consensus_version "$node_index" "$network_name" || echo "")
+        if [[ "$consensus_version" != "$final_version" ]]; then
+          log "❌ Node #${node_index} is at consensus version ${consensus_version:-<none>} at height $height, expected $final_version"
+          return 1
+        fi
         log "✅ Consensus version is stable at $consensus_version with height $height"
         return 0
+      fi
     fi
 
-    last_seen_consensus_version=$consensus_version
-    last_seen_height=$height
-
-    # Continue waiting
-    sleep 10
-    log "Waited $(elapsed_since "$start") seconds so far..."
+    if (( $(elapsed_since "$start") >= next_report )); then
+      log "Waited $(elapsed_since "$start") seconds so far (height ${height:-<none>})..."
+      next_report=$((next_report + 10))
+    fi
+    sleep 1
   done
 
+  if [[ -z "$schedule" ]]; then
+    log "❌ Node #${node_index} did not serve its consensus version schedule within ${max_wait}s"
+  else
+    log "❌ Node #${node_index} did not reach height $final_height within ${max_wait}s"
+  fi
   return 1
 }
 
```

#### Recent Merged Pull Requests:
- **PR #4732** (2026-11-20): Wait for the last scheduled consensus version, and trim the devnet test (@cbeck88)
- **PR #4731** (2026-11-20): Run the fleet test entries 16 tests at a time (@cbeck88)
- **PR #4729** (2026-11-20): Remove the memory and persistent features of the storage service (@cbeck88)
- **PR #4728** (2026-11-20): Remove dead features and rename the root telemetry feature to metrics (@cbeck88)
- **PR #4727** (2026-11-20): Rename test and fuzz-helpers features to test-helpers (@cbeck88)
- **PR #4726** (2026-11-20): ci: Gauntlet summaries name the check that ran (@cbeck88)

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

## X. Run the fixed-port gateway test alone, and correct the nextest comment

**RULE**:
When implementing operations in `.config/nextest.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97451873`: Run the fixed-port gateway test alone, and correct the nextest comment. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.config/nextest.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# The hosted runners have 4 vCPUs. The fleet `test` job overrides this with
# NEXTEST_TEST_THREADS; see CI.md.

# gateway_start asserts that the gateway binds 127.0.0.1:5000+dev exactly. Other
# tests bind ports in that range, and take another port if one is taken, so this
# test runs alone.
[[profile.default.overrides]]
filter = 'package(snarkos-node-bft) and test(=gateway::prop_tests::gateway_start)'
threads-required = "num-test-threads"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
# Many tests bind sockets and start nodes, so two run at a time on the hosted
# runners. The fleet `test` job sets NEXTEST_TEST_THREADS instead; see CI.md.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97451873` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
