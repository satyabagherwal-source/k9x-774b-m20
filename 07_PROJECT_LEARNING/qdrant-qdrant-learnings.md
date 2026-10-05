# Forensic Learning Record (Deep Inspection): qdrant/qdrant

> **Canonical Artifact**: `07_PROJECT_LEARNING/qdrant-qdrant-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/qdrant/qdrant](https://github.com/qdrant/qdrant))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:20:59.406Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `qdrant/qdrant`
- **Description**: Qdrant - High-performance, massive-scale Vector Database and Vector Search Engine for the next generation of AI. Also available in the cloud https://cloud.qdrant.io/
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 34937 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/collection/src/collection/state_management.rs`
```
use std::collections::HashSet;

use ahash::AHashMap;
use common::counter::hardware_accumulator::HwMeasurementAcc;
use futures::StreamExt as _;
use futures::stream::FuturesUnordered;

use crate::collection::Collection;
use crate::collection::payload_index_schema::PayloadIndexSchema;
use crate::collection_state::{ShardInfo, State};
use crate::config::{CollectionConfigInternal, CollectionParams};
use crate::operations::types::{CollectionError, CollectionResult};
use crate::shards::replica_set::ShardReplicaSet;
use crate::shards::resharding::ReshardState;
use crate::shards::shard::{PeerId, ShardId};
use crate::shards::shard_holder::ShardTransferChange;
use crate::shards::shard_holder::shard_mapping::ShardKeyMapping;
use crate::shards::transfer::ShardTransfer;

impl Collection {
    pub async fn check_config_compatible(
        &self,
        config: &CollectionConfigInternal,
    ) -> CollectionResult<()> {
        self.collection_config
            .read()
            .await
            .params
            .check_compatible(&config.params)
    }

    pub async fn apply_state(
        &self,
        state: State,
        this_peer_id: PeerId,
        abort_transfer: impl FnMut(ShardTransfer),
    ) -> CollectionResult<()> {
        let State {
            config,
            shards,
            resharding,
            transfers,
            shards_key_mapping,
            payload_index_schema,
        } = state;

        // Used to detect which named vectors have changed after applying new config
        let old_collection_config = self.collection_config.read().await.params.clone();

        // Apply config first — this updates the collection-level vector definitions
        let new_config = config.clone();
        self.apply_config(config).await?;
        self.apply_shard_transfers(transfers, this_peer_id, abort_transfer)
            .await?;
        self.apply_reshard_state(resharding).await?;
        self.apply_shard_info(shards, shards_key_mapping).await?;
        self.apply_payload_index_schema(payload_index_schema)
            .await?;
        // Reconcile named vectors at the segment level to match the new config.
        // This ensures segments have the correct vector storages after a Raft snapshot.
        self.apply_vector_name_schema(old_collection_config, &new_config)
            .await?;
        Ok(())
    }

    async fn apply_shard_transfers(
        &self,
        shard_transfers: HashSet<ShardTransfer>,
        this_peer_id: PeerId,
        mut abort_transfer: impl FnMut(ShardTransfer),
    ) -> CollectionResult<()> {
        let old_transfers = self
            .shards_holder
            .read()
            .await
            .shard_transfers
            .read()
            .clone();
        for transfer in old_transfers.difference(&shard_transfers) {
            // This transfer finished or was aborted in consensus while this peer was too far
            // behind to receive the corresponding log entries, so the regular finish/abort
            // handlers never ran here. Clean up leftover transfer state explicitly. Otherwise, if
            // this peer is the transfer source, its local shard stays proxified forever and keeps
            // forwarding updates to a peer that may not have the shard anymore — which fails
            // snapshot application itself (on payload index updates) and prevents this peer from
            // ever catching up with consensus.
            log::debug!("Cleaning up stale shard transfer: {transfer:?}");

            self.transfer_tasks
                .lock()
                .await
                .stop_task(&transfer.key())
                .await;

            if transfer.from == this_peer_id {
                let shard_holder = self.shards_holder.read().await;
                if let Some(replica_set) = shard_holder.get_shard(transfer.shard_id) {
                    // Discard proxy state instead of flushing it to the remote: replica states in
                    // the same snapshot already reflect the transfer outcome, and the target may
                    // not have the shard anymore
                    replica_set.discard_proxy_local().await;
                }
            }

            // Notify any tasks waiting for this transfer to end
            let _ = self
                .shards_holder
                .read()
                .await
                .shard_transfer_changes
                .send(ShardTransferChange::Abort(transfer.key()));
        }
        for transfer in shard_transfers.difference(&old_transfers) {
            if transfer.from == this_peer_id {
                // Abort transfer as sender should not learn about the transfer from snapshot
                // If this happens it mean the sender is probably outdated and it is safer to abort
                abort_transfer(transfer.clone());
                // Since we remove the transfer from our list below, we don't invoke regular abort logic on this node
                // Do it here explicitly so we don't miss a silent abort change
                let _ = self
                    .shards_holder
                    .read()
                    .await
                    .shard_transfer_changes
                    .send(ShardTransferChange::Abort(transfer.key()));
            }
        }
        self.shards_holder
            .write()
            .await
            .shard_transfers
            .write(|transfers| *transfers = shard_transfers)?;
        Ok(())
    }

    async fn apply_reshard_state(&self, resharding: Option<ReshardState>) -> CollectionResult<()> {
        // We don't have to explicitly abort resharding or bump shard replica states, because:
        // - peers are not driving resharding themselves
        // - ongoing (resharding) shard transfers are explicitly updated
        // - shard replica set states are explicitly updated
        self.shards_holder
            .write()
            .await
            .resharding_state
            .write(|state| *state = resharding)?;
        Ok(())
    }

    async fn apply_config(&self, new_config: CollectionConfigInternal) -> CollectionResult<()> {
        let recreate_optimizers;

        {
            let mut config = self.collection_config.write().await;

            if config.uuid != new_config.uuid {
                return Err(CollectionError::service_error(format!(
                    "collection {} UUID mismatch: \
                     UUID of existing collection is different from UUID of collection in Raft snapshot: \
                     existing collection UUID: {:?}, Raft snapshot collection UUID: {:?}",
                    self.id, config.uuid, new_config.uuid,
                )));
            }

            if let Err(err) = config.params.check_compatible(&new_config.params) {
                // Stop consensus with a service error, if new config is incompatible with current one.
                //
                // We expect that `apply_config` is only called when configs are compatible, otherwise
                // collection have to be *recreated*.
                return Err(CollectionError::service_error(err.to_string()));
            }

            // Destructure `new_config`, to ensure we compare all config fields. Compiler would
            // complain, if new field is added to `CollectionConfig` struct, but not destructured
            // explicitly. We have to explicitly compare config fields, because we want to compare
            // `wal_config` and `strict_mode_config` independently of other fields.
            let CollectionConfigInternal {
                params,
                hnsw_config,
                optimizer_config,
                wal_config,
                quantization_config,
                strict_mode_config,
                uuid: _,
                metadata,
            } = &new_config;

            let is_core_config_updated = params != &config.params
                || hnsw_config != &config.hnsw_config
                || optimizer_config != &config.optimizer_config
                || quantization_config != &config.quantization_config;

            let is_metadata_updated = metadata != &config.metadata;

            let is_wal_config_updated = wal_config != &config.wal_config;
            let is_strict_mode_config_updated = strict_mode_config != &config.strict_mode_config;

            let is_config_updated = is_core_config_updated
                || is_wal_config_updated
                || is_strict_mode_config_updated
                || is_metadata_updated;

            if !is_config_updated {
                return Ok(());
            }

            if is_wal_config_updated {
                log::warn!(
                    "WAL config of collection {} updated when applying Raft snapshot, \
                     but updated WAL config will only be applied on Qdrant restart",
                    self.id,
                );
            }

            *config = new_config;

            // We need to recreate optimizers, if "core" config was updated
            recreate_optimizers = is_core_config_updated;
        }

        self.collection_config.read().await.save(&self.path)?;

        self.print_warnings().await;

        // Recreate optimizers in the background: this path is reached from consensus (Raft snapshot
        // application), and stopping the existing optimizers can take a long time, which would
        // otherwise stall the consensus loop.
        if recreate_optimizers {
            self.recreate_optimizers_background();
        }

        Ok(())
    }

    async fn apply_shard_info(
        &self,
        shards: AHashMap<ShardId, ShardInfo>,
        shards_key_mapping: ShardKeyMapping,
    ) -> CollectionResult<()> {
        let mut extra_shards: AHashMap<ShardId, ShardReplicaSet> = AHashMap::new();

        let shard_ids = shards.keys().copied().collect::<HashSet<_>>();

        // There are two components, where shard-related info is stored:
        // Shard objects th
```

### Core Architecture Module: `lib/collection/src/collection_state.rs`
```
use std::collections::{HashMap, HashSet};

use ahash::AHashMap;
use serde::{Deserialize, Serialize};

use crate::collection::payload_index_schema::PayloadIndexSchema;
use crate::config::CollectionConfigInternal;
use crate::shards::replica_set::replica_set_state::ReplicaState;
use crate::shards::resharding::ReshardState;
use crate::shards::shard::{PeerId, ShardId};
use crate::shards::shard_holder::shard_mapping::ShardKeyMapping;
use crate::shards::transfer::ShardTransfer;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ShardInfo {
    pub replicas: HashMap<PeerId, ReplicaState>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct State {
    pub config: CollectionConfigInternal,
    pub shards: AHashMap<ShardId, ShardInfo>,
    pub resharding: Option<ReshardState>,
    #[serde(default)]
    pub transfers: HashSet<ShardTransfer>,
    #[serde(default)]
    pub shards_key_mapping: ShardKeyMapping,
    #[serde(default)]
    pub payload_index_schema: PayloadIndexSchema,
}

```

### Core Architecture Module: `lib/collection/src/common/file_utils.rs`
```
use std::path::{Path, PathBuf};

use fs_err::tokio as tokio_fs;
use fs_extra::dir::CopyOptions;

use crate::operations::types::{CollectionError, CollectionResult};

/// Move directory from one location to another
///
/// Handles the case when the source and destination are on different filesystems.
/// If destination directory exists, the contents of the source directory are moved
/// into the destination directory, preserving existing files in the destination.
///
/// # Cancel safety
///
/// This function is cancel safe.
///
/// If the future is dropped, moving the directory will either fully complete or not start at all.
/// With the exception of file IO errors in which case data may be partially moved.
pub async fn move_dir(from: impl Into<PathBuf>, to: impl Into<PathBuf>) -> CollectionResult<()> {
    let from = from.into();
    let to = to.into();

    log::trace!("Renaming directory {} to {}", from.display(), to.display());

    let Err(err) = tokio_fs::rename(&from, &to).await else {
        return Ok(());
    };

    log::trace!(
        "Failed to rename directory {} to {}: {err}",
        from.display(),
        to.display(),
    );

    // TODO: Only retry to move directory, if error kind is `CrossesDevices` or `AlreadyExists`?
    //
    // match err.kind() {
    //     io::ErrorKind::AlreadyExists | io::ErrorKind::CrossesDevices => (),
    //     _ => {
    //         return Err(CollectionError::service_error(format!(
    //             "failed to rename directory {} to {}: {err}",
    //             from.display(),
    //             to.display(),
    //         )));
    //     }
    // }

    tokio::task::spawn_blocking(move || {
        if !to.exists() {
            log::trace!("Creating destination directory {}", to.display());

            fs_err::create_dir(&to).map_err(|err| {
                CollectionError::service_error(format!(
                    "failed to move directory {} to {}: \
                    failed to create destination directory: \
                    {err}",
                    from.display(),
                    to.display(),
                ))
            })?;
        }

        log::trace!("Moving directory {} to {}", from.display(), to.display());

        let opts = CopyOptions::new().content_only(true).overwrite(true);

        fs_extra::dir::move_dir(&from, &to, &opts).map_err(|err| {
            CollectionError::service_error(format!(
                "failed to move directory {} to {}: {err}",
                from.display(),
                to.display(),
            ))
        })
    })
    .await??;

    Ok(())
}

/// Move file from one location to another.
/// Handles the case when the source and destination are on different filesystems.
pub async fn move_file(from: impl AsRef<Path>, to: impl AsRef<Path>) -> CollectionResult<()> {
    let from = from.as_ref();
    let to = to.as_ref();

    // Try to rename first and fallback to copy to prevent TOCTOU.
    if let Ok(()) = tokio_fs::rename(from, to).await {
        return Ok(());
    }

    // If rename failed, try to copy.
    // It is possible that the source and destination are on different filesystems.
    if let Err(err) = tokio_fs::copy(from, to).await {
        cleanup_file(to).await;
        return Err(CollectionError::service_error(format!(
            "Can't move file from {} to {} due to {}",
            from.display(),
            to.display(),
            err
        )));
    }

    if let Err(err) = tokio_fs::remove_file(from).await {
        cleanup_file(to).await;
        return Err(CollectionError::service_error(format!(
            "Can't remove file {} due to {}",
            from.display(),
            err
        )));
    }

    Ok(())
}

/// Remove the file if it exists. Print a warning if the file can't be removed.
async fn cleanup_file(path: &Path) {
    if let Err(err) = tokio_fs::remove_file(path).await
        && err.kind() != std::io::ErrorKind::NotFound
    {
        log::warn!("Failed to remove file {}: {err}", path.display());
    }
}

```

### Core Architecture Module: `lib/collection/src/shards/local_shard/formula_rescore.rs`
```
use std::sync::Arc;
use std::time::Duration;

use common::counter::hardware_accumulator::HwMeasurementAcc;
use common::types::ScoreType;
use segment::data_types::query_context::FormulaContext;
use segment::index::query_optimization::rescore_formula::parsed_formula::ParsedFormula;
use segment::types::ScoredPoint;
use shard::common::stopping_guard::StoppingGuard;

use super::LocalShard;
use crate::collection_manager::segments_searcher::SegmentsSearcher;
use crate::operations::types::{CollectionError, CollectionResult};

impl LocalShard {
    pub async fn rescore_with_formula(
        &self,
        formula: ParsedFormula,
        prefetches_results: Vec<Vec<ScoredPoint>>,
        limit: usize,
        score_threshold: Option<ScoreType>,
        timeout: Duration,
        hw_measurement_acc: HwMeasurementAcc,
    ) -> CollectionResult<Vec<ScoredPoint>> {
        let stopping_guard = StoppingGuard::new();

        let ctx = FormulaContext {
            formula,
            prefetches_results,
            score_threshold,
            limit,
            is_stopped: stopping_guard.get_is_stopped(),
        };

        let arc_ctx = Arc::new(ctx);

        let future = SegmentsSearcher::rescore_with_formula(
            self.segments.clone(),
            arc_ctx,
            &self.search_runtime,
            hw_measurement_acc,
            timeout,
        );

        let res = tokio::time::timeout(timeout, future)
            .await
            .map_err(|_elapsed| CollectionError::timeout(timeout, "rescore_with_formula"))??;

        Ok(res)
    }
}

```

### Core Architecture Module: `lib/collection/src/shards/queue_proxy_shard.rs`
```
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use api::grpc::UpdateBatchInternal;
use async_trait::async_trait;
use common::counter::hardware_accumulator::HwMeasurementAcc;
use common::tar_ext;
use common::types::{DeferredBehavior, TelemetryDetail};
use parking_lot::Mutex as ParkingMutex;
use segment::data_types::facets::{FacetParams, FacetResponse};
use segment::index::field_index::CardinalityEstimation;
use segment::types::{
    ExtendedPointId, Filter, ScoredPoint, SizeStats, SnapshotFormat, StrictModeConfig, WithPayload,
    WithPayloadInterface, WithVector,
};
use shard::count::CountRequestInternal;
use shard::retrieve::record_internal::RecordInternal;
use shard::scroll::ScrollRequestInternal;
use shard::search::CoreSearchRequestBatch;
use shard::snapshots::snapshot_manifest::SnapshotManifest;
use tokio::sync::Mutex;
use tokio_util::task::AbortOnDropHandle;

use super::remote_shard::RemoteShard;
use super::transfer::driver::MAX_RETRY_COUNT;
use super::transfer::transfer_tasks_pool::TransferTaskProgress;
use super::update_tracker::UpdateTracker;
use crate::collection_manager::optimizers::TrackerLog;
use crate::common::adaptive_handle::AdaptiveSearchHandle;
use crate::common::memory_reporter::CollectionMemoryReport;
use crate::operations::OperationWithClockTag;
use crate::operations::point_ops::WriteOrdering;
use crate::operations::types::{
    CollectionError, CollectionInfo, CollectionResult, CountResult, OptimizersStatus,
    PointRequestInternal, UpdateResult,
};
use crate::operations::universal_query::shard_query::{ShardQueryRequest, ShardQueryResponse};
use crate::shards::local_shard::LocalShard;
use crate::shards::shard_trait::{ShardOperation, WaitUntil};
use crate::shards::telemetry::LocalShardTelemetry;
use crate::wal_ack_pin::{WalAckPinGuard, WalAckPins};

/// Maximum total serialized byte size of a single transfer batch.
/// Each WAL operation can vary widely in size (a delete vs an upsert of many high-dimensional
/// vectors), so we use a byte budget rather than a fixed operation count.
const MAX_BATCH_BYTES: usize = 32 * 1024 * 1024; // 32 MiB

/// Maximum number of operations in a single transfer batch.
/// Caps memory usage and WAL lock duration when operations are small.
const MAX_BATCH_OPS: usize = 10_000;

/// Number of times to retry transferring updates batch
const BATCH_RETRIES: usize = MAX_RETRY_COUNT;

/// QueueProxyShard shard
///
/// QueueProxyShard is a wrapper type for a LocalShard.
///
/// It can be used to provide all read and write operations while the wrapped shard is being
/// snapshotted and transferred to another node. It keeps track of all collection updates since its
/// creation, and allows to transfer these updates to a remote shard at a given time to assure
/// consistency.
///
/// This keeps track of all updates through the WAL of the wrapped shard. It therefore doesn't have
/// any memory overhead while updates are accumulated. This type is called 'queue' even though it
/// doesn't use a real queue, just so it is easy to understand its purpose.
pub struct QueueProxyShard {
    /// Inner queue proxy shard.
    ///
    /// This is always `Some` until `finalize()` is called. This architecture is used to allow
    /// taking out the queue proxy shard for destructing when finalizing. Destructing the current
    /// type directly is not possible because it implements `Drop`.
    inner: Option<Inner>,
}

impl QueueProxyShard {
    /// Queue proxy the given local shard and point to the remote shard.
    ///
    /// This starts queueing all new updates on the local shard at the point of creation.
    pub async fn new(
        wrapped_shard: LocalShard,
        remote_shard: RemoteShard,
        wal_ack_pins: &WalAckPins,
        progress: Arc<ParkingMutex<TransferTaskProgress>>,
    ) -> Self {
        Self {
            inner: Some(Inner::new(wrapped_shard, remote_shard, wal_ack_pins, progress).await),
        }
    }

    /// Queue proxy the given local shard and point to the remote shard, from a specific WAL version.
    ///
    /// This queues all (existing) updates from a specific WAL `version` and onwards. In other
    /// words, this will ensure we transfer updates we already have and all new updates from a
    /// specific point in our WAL. The `version` may be in the past, but must always be within
    /// range of the current WAL.
    ///
    /// # Errors
    ///
    /// This fails if the given `version` is not in bounds of our current WAL. If the given
    /// `version` is too old or too new, queue proxy creation is rejected.
    #[allow(clippy::result_large_err)]
    pub async fn new_from_version(
        wrapped_shard: LocalShard,
        remote_shard: RemoteShard,
        wal_ack_pins: &WalAckPins,
        version: u64,
        progress: Arc<ParkingMutex<TransferTaskProgress>>,
    ) -> Result<Self, (LocalShard, CollectionError)> {
        // Lock WAL until we've successfully created the queue proxy shard
        let wal = wrapped_shard.wal.wal.clone();
        let wal_lock = wal.lock().await;

        // If start version is not in current WAL bounds [first_idx, last_idx + 1], we cannot reliably transfer WAL
        // Allow it to be one higher than the last index to only send new updates
        let (first_idx, last_idx) = (wal_lock.first_closed_index(), wal_lock.last_index());
        if !(first_idx..=last_idx + 1).contains(&version) {
            return Err((
                wrapped_shard,
                CollectionError::service_error(format!(
                    "Cannot create queue proxy shard from version {version} because it is out of WAL bounds ({first_idx}..={last_idx})",
                )),
            ));
        }

        Ok(Self {
            inner: Some(Inner::new_from_version(
                wrapped_shard,
                remote_shard,
                wal_ack_pins,
                version,
                progress,
            )),
        })
    }

    /// Get the wrapped local shard
    pub(super) fn wrapped_shard(&self) -> Option<&LocalShard> {
        self.inner.as_ref().map(|inner| &inner.wrapped_shard)
    }

    /// Get inner queue proxy shard. Will panic if the queue proxy has been finalized.
    fn inner_unchecked(&self) -> &Inner {
        self.inner.as_ref().expect("Queue proxy has been finalized")
    }

    fn inner_mut_unchecked(&mut self) -> &mut Inner {
        self.inner.as_mut().expect("Queue proxy has been finalized")
    }

    pub async fn get_snapshot_creator(
        &self,
        temp_path: &Path,
        tar: &tar_ext::BuilderExt,
        format: SnapshotFormat,
        manifest: Option<SnapshotManifest>,
        save_wal: bool,
    ) -> CollectionResult<impl Future<Output = CollectionResult<()>> + use<>> {
        self.inner_unchecked()
            .wrapped_shard
            .get_snapshot_creator(temp_path, tar, format, manifest, save_wal)
            .await
    }

    pub async fn snapshot_manifest(&self) -> CollectionResult<SnapshotManifest> {
        self.inner_unchecked()
            .wrapped_shard
            .snapshot_manifest()
            .await
    }

    /// Transfer all updates that the remote missed from WAL
    ///
    /// # Cancel safety
    ///
    /// This method is cancel safe.
    ///
    /// If cancelled - none, some or all operations may be transmitted to the remote.
    ///
    /// The internal field keeping track of the last transfer and maximum acknowledged WAL version
    /// likely won't be updated. In the worst case this might cause double sending operations.
    /// This should be fine as operations are idempotent.
    pub async fn transfer_all_missed_updates(&self) -> CollectionResult<()> {
        self.inner_unchecked().transfer_all_missed_updates().await
    }

    pub async fn on_optimizer_config_update(&self) -> CollectionResult<()> {
        self.inner_unchecked()
            .wrapped_shard
            .on_optimizer_config_update()
            .await
    }

    pub fn on_strict_mode_config_update(&mut self, new_strict_mode: &StrictModeConfig) {
        self.inner_mut_unchecked()
            .wrapped_shard
            .on_strict_mode_config_update(new_strict_mode)
    }

    pub fn trigger_optimizers(&self) {
        self.inner_unchecked().wrapped_shard.trigger_optimizers();
    }

    pub async fn get_telemetry_data(
        &self,
        detail: TelemetryDetail,
        timeout: Duration,
    ) -> CollectionResult<LocalShardTelemetry> {
        self.inner_unchecked()
            .wrapped_shard
            .get_telemetry_data(detail, timeout)
            .await
    }

    pub async fn get_optimization_status(
        &self,
        timeout: Duration,
    ) -> CollectionResult<OptimizersStatus> {
        self.inner_unchecked()
            .wrapped_shard
            .get_optimization_status(timeout)
            .await
    }

    pub async fn get_size_stats(&self, timeout: Duration) -> CollectionResult<SizeStats> {
        self.inner_unchecked()
            .wrapped_shard
            .get_size_stats(timeout)
            .await
    }

    pub fn update_tracker(&self) -> &UpdateTracker {
        self.inner_unchecked().wrapped_shard.update_tracker()
    }

    pub fn optimizers_log(&self) -> Arc<ParkingMutex<TrackerLog>> {
        self.inner_unchecked().wrapped_shard.optimizers_log()
    }

    /// Check if the queue proxy shard is already finalized
    #[cfg(debug_assertions)]
    fn is_finalized(&self) -> bool {
        self.inner.is_none()
    }

    /// Forget all updates and finalize.
    ///
    /// Forget all missed updates since creation of this queue proxy shard and finalize. This
    /// unwraps the inner wrapped and remote shard.
    ///
    /// It also releases our WAL acknowledge pin.
    ///
    /// # Warning
    ///
    /// This intentionally forgets and drops updates pending to be transferred to the remote shard.
    /// The remote shard is therefore left in an inconsistent state, which should be resolved
   
```

### Core Architecture Module: `lib/collection/src/shards/replica_set/replica_set_state.rs`
```
use std::collections::HashMap;
use std::sync::LazyLock;

use schemars::JsonSchema;
use segment::common::anonymize::Anonymize;
use semver::Version;
use serde::{Deserialize, Serialize};

use crate::shards::shard::PeerId;

/// Service version, starting from which `ManualRecovery` state is supported.
pub static MANUAL_RECOVERY_SHARD_STATE_VERSION: LazyLock<Version> =
    LazyLock::new(|| Version::parse("1.16.4-dev").expect("valid version string"));

/// Represents a replica set state
#[derive(Debug, Deserialize, Serialize, Default, PartialEq, Eq, Clone)]
pub struct ReplicaSetState {
    pub is_local: bool,
    pub this_peer_id: PeerId,
    peers: HashMap<PeerId, ReplicaState>,
}

impl ReplicaSetState {
    pub fn get_peer_state(&self, peer_id: PeerId) -> Option<ReplicaState> {
        self.peers.get(&peer_id).copied()
    }

    /// Returns previous state if any
    pub fn set_peer_state(&mut self, peer_id: PeerId, state: ReplicaState) -> Option<ReplicaState> {
        self.peers.insert(peer_id, state)
    }

    pub fn remove_peer_state(&mut self, peer_id: PeerId) -> Option<ReplicaState> {
        self.peers.remove(&peer_id)
    }

    pub fn peers(&self) -> &HashMap<PeerId, ReplicaState> {
        &self.peers
    }

    pub fn check_peers_state_all<F>(&self, check: F) -> bool
    where
        F: Fn(ReplicaState) -> bool,
    {
        self.peers.values().all(|state| check(*state))
    }

    pub fn active_peers(&self) -> Vec<PeerId> {
        self.peers
            .iter()
            .filter_map(|(peer_id, state)| {
                // We consider `ReshardingScaleDown` to be `Active`!
                state.is_active().then_some(*peer_id)
            })
            .collect()
    }

    pub fn readable_peers(&self) -> Vec<PeerId> {
        self.peers
            .iter()
            .filter_map(|(peer_id, state)| state.is_readable().then_some(*peer_id))
            .collect()
    }

    pub fn active_or_resharding_peers(&self) -> impl Iterator<Item = PeerId> + '_ {
        self.peers.iter().filter_map(|(peer_id, state)| {
            matches!(
                state,
                ReplicaState::Active | ReplicaState::Resharding | ReplicaState::ReshardingScaleDown
            )
            .then_some(*peer_id)
        })
    }

    pub fn set_peers(&mut self, peers: HashMap<PeerId, ReplicaState>) {
        self.peers = peers;
    }

    /// Change current `this_peer_id` to a new one.
    pub fn switch_peer_id(&mut self, new_peer_id: PeerId) {
        let old_peer_id = self.this_peer_id;
        self.this_peer_id = new_peer_id;

        self.peers
            .remove(&old_peer_id)
            .and_then(|replica_state| self.peers.insert(new_peer_id, replica_state));
    }

    /// Remove all remote peers from the replica set state and activate local peer.
    pub fn force_local_active(&mut self) {
        self.peers.clear();
        self.peers.insert(self.this_peer_id, ReplicaState::Active);
    }
}

/// State of the single shard within a replica set.
#[derive(
    Debug, Deserialize, Serialize, JsonSchema, Default, PartialEq, Eq, Hash, Clone, Copy, Anonymize,
)]
pub enum ReplicaState {
    // Active and sound
    #[default]
    Active,
    // Failed for some reason
    Dead,
    // The shard is partially loaded and is currently receiving data from other shards
    Partial,
    // Collection is being created
    Initializing,
    // A shard which receives data, but is not used for search
    // Useful for backup shards
    Listener,
    // Deprecated since Qdrant 1.9.0, used in Qdrant 1.7.0 and 1.8.0
    //
    // Snapshot shard transfer is in progress, updates aren't sent to the shard
    // Normally rejects updates. Since 1.8 it allows updates if force is true.
    PartialSnapshot,
    // Shard is undergoing recovery by an external node
    // Normally rejects updates, accepts updates if force is true
    Recovery,
    // Points are being migrated to this shard as part of resharding up
    Resharding,
    // Points are being migrated to this shard as part of resharding down
    ReshardingScaleDown,
    // Active for readers, Partial for writers
    ActiveRead,
    // State for manually creation/recovery of a shard.
    // Usually when snapshot is uploaded.
    // This state is equivalent to `Partial`, except:
    // - it can't receive updates
    // - it is not treated as broken on startup
    ManualRecovery,
}

impl ReplicaState {
    /// Check if replica state is active
    /// Used to define if this replica can be used as a source of truth.
    pub fn is_active(self) -> bool {
        match self {
            ReplicaState::Active => true,
            ReplicaState::ReshardingScaleDown => true,

            ReplicaState::Dead
            | ReplicaState::Partial
            | ReplicaState::ManualRecovery
            | ReplicaState::Initializing
            | ReplicaState::Listener
            | ReplicaState::PartialSnapshot
            | ReplicaState::Recovery
            | ReplicaState::Resharding
            | ReplicaState::ActiveRead => false,
        }
    }

    /// Check that replica has full dataset, so it can be used for read operations.
    pub fn is_readable(self) -> bool {
        match self {
            ReplicaState::Active => true,
            ReplicaState::ReshardingScaleDown => true,
            ReplicaState::ActiveRead => true,
            // False from here on
            ReplicaState::Dead => false,
            ReplicaState::Partial => false,
            ReplicaState::ManualRecovery => false,
            ReplicaState::Initializing => false,
            ReplicaState::Listener => false,
            ReplicaState::PartialSnapshot => false,
            ReplicaState::Recovery => false,
            ReplicaState::Resharding => false,
        }
    }

    pub fn is_updatable(self) -> bool {
        match self {
            ReplicaState::Active => true,
            ReplicaState::Partial => true,
            ReplicaState::Initializing => true,
            ReplicaState::Listener => true,
            ReplicaState::Recovery | ReplicaState::PartialSnapshot => false,
            ReplicaState::Resharding | ReplicaState::ReshardingScaleDown => true,
            ReplicaState::Dead => false,
            ReplicaState::ActiveRead => true,
            ReplicaState::ManualRecovery => false,
        }
    }

    /// Check if this peer can be used as a source of truth within a shard_id.
    /// For instance:
    /// - It can be the only receiver of updates
    /// - It can be a primary replica for ordered writes
    pub fn can_be_source_of_truth(self) -> bool {
        match self {
            ReplicaState::Active => true,
            ReplicaState::ActiveRead => true, // Can be only one replica per shard_id
            ReplicaState::Resharding => true, // Can be only one replica per shard_id
            ReplicaState::ReshardingScaleDown => true, // Acts like Active, until resharding is committed
            // false from here on
            ReplicaState::Partial => false,
            ReplicaState::ManualRecovery => false,
            ReplicaState::Initializing => false,
            ReplicaState::Listener => false,
            ReplicaState::PartialSnapshot => false,
            ReplicaState::Recovery => false,
            ReplicaState::Dead => false,
        }
    }

    /// Check whether the replica state is active or listener or resharding.
    /// Healthy state means that replica does not require **automatic** recovery.
    pub fn is_healthy(self) -> bool {
        match self {
            ReplicaState::Active
            | ReplicaState::Listener
            | ReplicaState::Resharding
            | ReplicaState::ManualRecovery
            | ReplicaState::ReshardingScaleDown => true,

            ReplicaState::Dead
            | ReplicaState::Initializing
            | ReplicaState::Partial
            | ReplicaState::PartialSnapshot
            | ReplicaState::Recovery
            | ReplicaState::ActiveRead => false,
        }
    }

    /// Check if the replica state requires automatic recovery to be scheduled.
    pub fn requires_recovery(self) -> bool {
        match self {
            ReplicaState::Dead => true,
            ReplicaState::Active
            | ReplicaState::Partial
            | ReplicaState::Initializing
            | ReplicaState::Listener
            | ReplicaState::PartialSnapshot
            | ReplicaState::Recovery
            | ReplicaState::ManualRecovery
            | ReplicaState::Resharding
            | ReplicaState::ReshardingScaleDown
            | ReplicaState::ActiveRead => false,
        }
    }

    /// Check whether the replica state is partial or partial-like.
    ///
    /// In other words: is the state related to shard transfers?
    //
    // TODO(resharding): What's the best way to handle `ReshardingScaleDown` properly!?
    pub fn is_partial_or_recovery(self) -> bool {
        match self {
            ReplicaState::Partial
            | ReplicaState::ManualRecovery
            | ReplicaState::PartialSnapshot
            | ReplicaState::Recovery
            | ReplicaState::Resharding
            | ReplicaState::ReshardingScaleDown
            | ReplicaState::ActiveRead => true,

            ReplicaState::Active
            | ReplicaState::Dead
            | ReplicaState::Initializing
            | ReplicaState::Listener => false,
        }
    }

    /// Returns `true` if the replica state is resharding, either up or down.
    pub fn is_resharding(&self) -> bool {
        match self {
            ReplicaState::Resharding | ReplicaState::ReshardingScaleDown => true,

            ReplicaState::Partial
            | ReplicaState::ManualRecovery
            | ReplicaState::PartialSnapshot
            | ReplicaState::Recovery
            | ReplicaState::Active
            | ReplicaState::Dead
            | ReplicaState::Initializing
            | ReplicaState::Listener
            | ReplicaState::ActiveRead => false,
        }
    }

    pub fn is_listener(self) -> bool {
       
```

### Core Architecture Module: `lib/collection/src/update_workers/applied_seq.rs`
```
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(test)]
use common::fs::read_json;
use common::save_on_disk::SaveOnDisk;
use fs_err as fs;
use serde::{Deserialize, Serialize};
use shard::files::APPLIED_SEQ_FILE;

use crate::operations::types::CollectionResult;

/// How often the `applied_seq` is persisted
pub const APPLIED_SEQ_SAVE_INTERVAL: u64 = 64;

/// Data structure, used for (de)serialization of the `applied_seq` file
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
struct AppliedSeq {
    pub op_num: u64,
}

impl AppliedSeq {
    fn new(op_num: u64) -> Self {
        Self { op_num }
    }
}

#[derive(Debug)]
pub struct AppliedSeqHandler {
    /// the AppliedSeq atomic file
    file: Option<SaveOnDisk<AppliedSeq>>,
    /// path of the underlying persisted file
    path: PathBuf,
    /// precise in-memory op_num (can be larger than value persisted in `file`)
    op_num: AtomicU64,
    /// tracking update for interval based persistence
    update_count: AtomicU64,
}

impl AppliedSeqHandler {
    /// Get the current in-memory op_num for the last_applied_seq.
    /// The value is likely larger than what is persisted in `file`.
    ///
    ///
    /// Returns None if the handler is not active.
    pub fn op_num(&self) -> Option<u64> {
        if self.file.is_some() {
            Some(self.op_num.load(Ordering::Relaxed))
        } else {
            None
        }
    }

    /// The last operation the update worker finished applying.
    ///
    /// Unlike [`AppliedSeqHandler::op_num`] this does not disappear for a handler running
    /// without its file: the in-memory value is maintained either way, and a flush needs the
    /// bound in both cases (see `StorageSegmentEntry::flusher`).
    ///
    /// Monotonic, and never ahead of the applied work: the update worker is serial and stores
    /// this after an operation is applied, so the value can lag by the moment between the two.
    /// Lagging only costs a re-flush on a later pass.
    pub fn applied_op_num(&self) -> u64 {
        self.op_num.load(Ordering::Relaxed)
    }

    /// Get the op_num upper bound for the last_applied_seq adjusted to the persistence interval
    ///
    /// Returns None if the handler is not active.
    pub fn op_num_upper_bound(&self) -> Option<u64> {
        if self.file.is_some() {
            let adjusted = self.op_num.load(Ordering::Relaxed) + APPLIED_SEQ_SAVE_INTERVAL + 1;
            Some(adjusted)
        } else {
            None
        }
    }

    /// Path for the applied_seq json file
    pub fn path(&self) -> &Path {
        self.path.as_path()
    }

    #[cfg(test)]
    fn persisted_op_num(&self) -> u64 {
        let persisted = read_json::<AppliedSeq>(&self.path).unwrap().op_num;
        debug_assert!(persisted <= self.op_num.load(Ordering::Relaxed));
        persisted
    }

    /// Test helper: force set the op_num and immediately persist to disk.
    /// This bypasses the interval-based persistence.
    #[cfg(test)]
    pub fn force_set_and_persist(&self, op_num: u64) -> CollectionResult<()> {
        self.op_num.store(op_num, Ordering::Relaxed);
        self.save(op_num)
    }

    /// Load or create the underlying applied seq file.
    pub fn load_or_init(shard_path: &Path, wal_last_index: u64) -> Self {
        let update_count = AtomicU64::new(0);
        let path = shard_path.join(APPLIED_SEQ_FILE);
        let file_was_already_present = path.exists();

        let loaded_file: Result<SaveOnDisk<AppliedSeq>, _> =
            SaveOnDisk::load_or_init(&path, || AppliedSeq::new(wal_last_index));
        match loaded_file {
            Ok(file) => {
                let persisted_applied_seq = file.read().op_num;
                debug_assert!(
                    persisted_applied_seq <= wal_last_index,
                    "last_applied_seq:{persisted_applied_seq} cannot be larger than last_wal_index:{wal_last_index}"
                );
                Self {
                    file: Some(file),
                    path,
                    op_num: AtomicU64::new(persisted_applied_seq),
                    update_count,
                }
            }
            Err(err) => {
                if file_was_already_present {
                    log::error!("Error while loading existing applied_seq at {path:?} {err}");
                    // delete file as it is malformed
                    if let Err(err) = fs::remove_file(&path) {
                        log::error!("Could not delete malformed applied_seq file {path:?} {err}");
                        Self {
                            file: None,
                            path,
                            op_num: AtomicU64::new(wal_last_index),
                            update_count,
                        }
                    } else {
                        // try again to create the file from scratch
                        Self::load_or_init(shard_path, wal_last_index)
                    }
                } else {
                    log::error!("Error while creating new applied_seq at {path:?} {err}");
                    Self {
                        file: None,
                        path,
                        op_num: AtomicU64::new(wal_last_index),
                        update_count,
                    }
                }
            }
        }
    }

    fn save(&self, op_num: u64) -> CollectionResult<()> {
        if let Some(file) = self.file.as_ref() {
            file.write(|current| current.op_num = op_num)?;
        }
        Ok(())
    }

    /// Update the underlying file every `APPLIED_SEQ_SAVE_INTERVAL` updates.
    /// Always update memory representation
    pub fn update(&self, op_num: u64) -> CollectionResult<()> {
        // update in-memory
        self.op_num.store(op_num, Ordering::Relaxed);
        let prev_count = self.update_count.fetch_add(1, Ordering::Relaxed);
        if prev_count == 0 {
            return Ok(());
        }
        // update on disk according to interval to amortize fsync
        if prev_count.is_multiple_of(APPLIED_SEQ_SAVE_INTERVAL) {
            self.save(op_num)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use tempfile::TempDir;

    use crate::update_workers::applied_seq::{APPLIED_SEQ_SAVE_INTERVAL, AppliedSeqHandler};

    #[test]
    fn nothing_persisted_on_init() {
        let dir = TempDir::with_prefix("applied_seq").unwrap();
        let handler = AppliedSeqHandler::load_or_init(dir.path(), 10);
        assert_eq!(handler.op_num(), Some(10));
        // nothing persisted yet because no updates observed
        assert!(!handler.path().exists());
    }

    #[test]
    fn persists_at_interval() {
        let dir = TempDir::with_prefix("applied_seq").unwrap();
        let handler = AppliedSeqHandler::load_or_init(dir.path(), 1);
        for i in 0..APPLIED_SEQ_SAVE_INTERVAL {
            handler.update(i).unwrap();
            assert_eq!(handler.op_num(), Some(i));
            // nothing persisted yet because less updates than interval
            assert!(!handler.path().exists(), "exists too early at {i}");
        }

        // one more update to reach APPLIED_SEQ_SAVE_INTERVAL
        let op_num = 12345;
        handler.update(op_num).unwrap();
        assert_eq!(handler.op_num(), Some(op_num));
        assert!(handler.path().exists());
        // ensure written to disk
        assert_eq!(handler.persisted_op_num(), op_num);
    }

    #[test]
    fn read_existing_value_on_init() {
        let dir = TempDir::with_prefix("applied_seq").unwrap();
        let handler = AppliedSeqHandler::load_or_init(dir.path(), 1);
        for i in 0..APPLIED_SEQ_SAVE_INTERVAL * 10 {
            handler.update(i).unwrap();
            assert_eq!(handler.op_num(), Some(i));
        }

        let op_num = 640;
        assert_eq!(APPLIED_SEQ_SAVE_INTERVAL * 10, op_num);

        handler.update(op_num).unwrap();
        assert_eq!(handler.op_num(), Some(op_num));
        assert!(handler.path().exists());
        // ensure written to disk
        assert_eq!(handler.persisted_op_num(), op_num);

        // drop and reload
        drop(handler);
        let handler = AppliedSeqHandler::load_or_init(dir.path(), 1000);
        assert_eq!(handler.op_num(), Some(op_num));
    }

    #[test]
    fn handles_file_corruption() {
        let dir = TempDir::with_prefix("applied_seq").unwrap();
        let handler = AppliedSeqHandler::load_or_init(dir.path(), 1);
        let path = handler.path.clone();

        for i in 0..APPLIED_SEQ_SAVE_INTERVAL * 10 {
            handler.update(i).unwrap();
            assert_eq!(handler.op_num(), Some(i));
        }

        let op_num = 640;
        assert_eq!(APPLIED_SEQ_SAVE_INTERVAL * 10, op_num);
        handler.update(op_num).unwrap();
        assert_eq!(handler.op_num(), Some(op_num));
        assert!(handler.path().exists());
        // ensure written to disk
        assert_eq!(handler.persisted_op_num(), op_num);

        // drop and reload
        drop(handler);

        // open in append mode
        let mut file = fs_err::OpenOptions::new()
            .read(true)
            .append(true)
            .open(path)
            .unwrap();

        // corrupt data on disk by appending random bytes
        file.write_all(&[0, 1, 0, 1, 0, 1]).unwrap();
        drop(file);

        // reopen handler without crashing
        let handler = AppliedSeqHandler::load_or_init(dir.path(), 650);

        // regenerate new file with correct WAL op_num
        assert!(handler.file.is_some());
        assert_eq!(handler.op_num(), Some(650));
    }
}

```

### Core Architecture Module: `lib/collection/src/update_workers/flush_workers.rs`
```
use std::cmp::min;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use common::panic;
use segment::common::operation_error::OperationResult;
use segment::types::SeqNumberType;
use shard::segment_holder::FlushMode;
use shard::segment_holder::locked::LockedSegmentHolder;
use shard::wal::WalError;
use tokio::sync::oneshot;

use crate::shards::local_shard::LocalShardClocks;
use crate::update_workers::UpdateWorkers;
use crate::update_workers::applied_seq::AppliedSeqHandler;
use crate::wal_ack_pin::WalAckPins;
use crate::wal_delta::LockedWal;

/// The version to acknowledge in the WAL after a flush pass confirmed `confirmed_version` durable.
///
/// Never at or past the lowest live WAL acknowledge pin: those entries are still needed by
/// whoever holds the pin, such as a snapshot in progress that has not captured the WAL yet, or the
/// queue proxy shard replaying operations to a remote. Without pins everything confirmed is
/// acknowledged.
///
/// `None` means nothing may be acknowledged at all, because the very first entry is pinned.
pub(crate) fn wal_ack_version(
    confirmed_version: SeqNumberType,
    wal_ack_pins: &WalAckPins,
) -> Option<SeqNumberType> {
    match wal_ack_pins.lowest() {
        // If the very first message is pinned, we cannot acknowledge anything at all
        Some(0) => None,
        Some(lowest_pin) => Some(confirmed_version.min(lowest_pin - 1)),
        None => Some(confirmed_version),
    }
}

impl UpdateWorkers {
    /// Returns confirmed version after flush of all segments
    ///
    /// `applied_up_to` is the last operation the update worker finished applying. This pass runs
    /// concurrently with the update worker and can start between the phases of one operation, so
    /// no segment may claim a version past it. See [`StorageSegmentEntry::flusher`].
    ///
    /// # Errors
    /// Returns an error on flush failure
    fn flush_segments(
        segments: LockedSegmentHolder,
        applied_up_to: Option<SeqNumberType>,
    ) -> OperationResult<SeqNumberType> {
        let read_segments = segments.read();
        let flushed_version =
            read_segments.flush_all_up_to(FlushMode::Background, false, applied_up_to)?;
        Ok(match read_segments.failed_operation.iter().cloned().min() {
            None => flushed_version,
            Some(failed_operation) => min(failed_operation, flushed_version),
        })
    }

    pub(crate) fn flush_worker_internal(
        segments: LockedSegmentHolder,
        wal: LockedWal,
        wal_ack_pins: Arc<WalAckPins>,
        clocks: LocalShardClocks,
        shard_path: PathBuf,
        applied_seq_handler: Arc<AppliedSeqHandler>,
    ) {
        log::trace!("Attempting flushing");
        let wal_flush_job = wal.blocking_lock().flush_async();

        let wal_flush_res = match wal_flush_job.join() {
            Ok(Ok(())) => Ok(()),

            Ok(Err(err)) => Err(WalError::WriteWalError(format!(
                "failed to flush WAL: {err}"
            ))),

            Err(panic) => {
                let message = panic::downcast_str(&panic).unwrap_or("");
                let separator = if !message.is_empty() { ": " } else { "" };
                Err(WalError::WriteWalError(format!(
                    "failed to flush WAL: flush task panicked{separator}{message}"
                )))
            }
        };

        if let Err(err) = wal_flush_res {
            log::error!("{err}");
            segments.write().report_optimizer_error(err);
            return;
        }

        // Read before capturing anything: an operation that finishes during the flush must not
        // raise the cap for segments this pass already captured half of.
        let applied_up_to = applied_seq_handler.applied_op_num();

        let confirmed_version = Self::flush_segments(segments.clone(), Some(applied_up_to));
        let confirmed_version = match confirmed_version {
            Ok(version) => version,
            Err(err) => {
                // Since Self::flush_segments is flushing asynchronously, we can get the error
                // from the previous flush cycle, not necessarily this one.
                log::error!("Failed to flush: {err}");
                segments.write().report_optimizer_error(err);
                return;
            }
        };

        // Persist the clock maps before acknowledging, so the WAL is never truncated past clocks
        // that are still only in memory. A pin holds back the acknowledge, not this: the clocks
        // are durable state of their own, and a pin at the very first entry would otherwise
        // suppress persisting them for as long as it is held.
        if let Err(err) = clocks.store_if_changed(&shard_path) {
            log::warn!("Failed to store clock maps to disk: {err}");
            segments.write().report_optimizer_error(err);
        }

        let Some(ack) = wal_ack_version(confirmed_version, &wal_ack_pins) else {
            return;
        };

        if let Err(err) = wal.blocking_lock().ack(ack) {
            log::warn!("Failed to acknowledge WAL version: {err}");
            segments.write().report_optimizer_error(err);
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn flush_worker_fn(
        segments: LockedSegmentHolder,
        wal: LockedWal,
        wal_ack_pins: Arc<WalAckPins>,
        clocks: LocalShardClocks,
        flush_interval_sec: u64,
        mut stop_receiver: oneshot::Receiver<()>,
        shard_path: PathBuf,
        applied_seq_handler: Arc<AppliedSeqHandler>,
    ) {
        loop {
            tokio::select! {
                biased;
                // Stop flush worker on signal or if sender was dropped
                _ = &mut stop_receiver => {
                    log::debug!("Stopping flush worker for shard {}", shard_path.display());
                    return;
                },
                // Flush at the configured flush interval
                _ = tokio::time::sleep(Duration::from_secs(flush_interval_sec)) => {},
            }

            let segments_clone = segments.clone();
            let wal_clone = wal.clone();
            let wal_ack_pins_clone = wal_ack_pins.clone();
            let clocks_clone = clocks.clone();
            let shard_path_clone = shard_path.clone();
            let applied_seq_handler_clone = applied_seq_handler.clone();

            tokio::task::spawn_blocking(move || {
                Self::flush_worker_internal(
                    segments_clone,
                    wal_clone,
                    wal_ack_pins_clone,
                    clocks_clone,
                    shard_path_clone,
                    applied_seq_handler_clone,
                )
            })
            .await
            .unwrap_or_else(|error| {
                log::error!("Flush worker failed: {error}",);
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Without pins everything a flush pass confirmed durable is acknowledged.
    #[test]
    fn test_acknowledges_everything_confirmed_without_pins() {
        let pins = WalAckPins::default();
        assert_eq!(wal_ack_version(100, &pins), Some(100));
    }

    /// A pin holds the acknowledge below itself, so its entries stay in the WAL. This is what a
    /// snapshot that includes the WAL relies on: it pins before copying the segment files and
    /// holds until the WAL is archived, so operations applied meanwhile stay replayable.
    #[test]
    fn test_pin_holds_acknowledge_below_itself() {
        let pins = WalAckPins::default();

        let pin = pins.pin(50);
        assert_eq!(
            wal_ack_version(100, &pins),
            Some(49),
            "a pin must hold the acknowledge below itself, even when more is durable",
        );

        // Confirmed below the pin is not raised to it
        assert_eq!(wal_ack_version(10, &pins), Some(10));

        drop(pin);
        assert_eq!(
            wal_ack_version(100, &pins),
            Some(100),
            "releasing the last pin lifts the hold",
        );
    }

    /// The lowest pin wins, and the hold lasts until the last one is released, in any order.
    #[test]
    fn test_lowest_pin_holds_the_acknowledge() {
        let pins = WalAckPins::default();

        let low = pins.pin(20);
        let high = pins.pin(80);
        assert_eq!(wal_ack_version(100, &pins), Some(19));

        drop(low);
        assert_eq!(wal_ack_version(100, &pins), Some(79));

        drop(high);
        assert_eq!(wal_ack_version(100, &pins), Some(100));
    }

    /// Pinning the very first entry means nothing may be acknowledged at all. A snapshot of a
    /// shard whose WAL was never acknowledged pins at index 0 and must not truncate anything.
    #[test]
    fn test_pinning_the_first_entry_acknowledges_nothing() {
        let pins = WalAckPins::default();
        let _pin = pins.pin(0);
        assert_eq!(wal_ack_version(100, &pins), None);
    }
}

```

### Core Architecture Module: `lib/collection/src/update_workers/internal_update_result.rs`
```
use segment::types::SeqNumberType;

use crate::operations::types::UpdateStatus;

/// Structure used to talk between update worker and update API handler
#[derive(Debug, Clone, Copy)]
pub struct InternalUpdateResult {
    pub op_num: SeqNumberType,
    pub status: UpdateStatus,
}

```

### Core Architecture Module: `lib/collection/src/update_workers/mod.rs`
```
pub mod applied_seq;
pub mod flush_workers;
pub mod internal_update_result;
mod optimization_worker;
mod update_worker;

pub struct UpdateWorkers {}

```

### Core Architecture Module: `lib/collection/src/update_workers/optimization_worker.rs`
```
use std::panic::AssertUnwindSafe;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use common::budget::ResourceBudget;
use common::counter::hardware_counter::HardwareCounterCell;
use common::panic;
use common::save_on_disk::SaveOnDisk;
use itertools::Itertools;
use parking_lot::Mutex;
use segment::common::operation_error::{OperationError, OperationResult};
use shard::operations::optimization::OptimizerThresholds;
use shard::optimizers::config::SegmentOptimizerConfig;
use shard::payload_index_schema::PayloadIndexSchema;
use shard::segment_holder::locked::LockedSegmentHolder;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{Mutex as TokioMutex, watch};
use tokio::task;
use tokio::task::JoinHandle;
use tokio::time::error::Elapsed;
use tokio::time::timeout;
use uuid::Uuid;

use crate::collection_manager::collection_updater::CollectionUpdater;
use crate::collection_manager::optimizers::segment_optimizer::plan_optimizations;
use crate::collection_manager::optimizers::{
    Tracker, TrackerLog, TrackerSegmentInfo, TrackerStatus,
};
use crate::common::stoppable_task::{StoppableTaskHandle, spawn_stoppable};
use crate::operations::types::{CollectionError, CollectionResult};
use crate::shards::update_tracker::UpdateTracker;
use crate::update_handler::{Optimizer, OptimizerSignal};
use crate::update_workers::UpdateWorkers;
use crate::wal_delta::LockedWal;

/// Interval at which the optimizer worker cleans up old optimization handles
///
/// The longer the duration, the longer it takes for panicked tasks to be reported.
const OPTIMIZER_CLEANUP_INTERVAL: Duration = Duration::from_secs(5);

impl UpdateWorkers {
    #[allow(clippy::too_many_arguments)]
    pub async fn optimization_worker_fn(
        optimizers: Arc<Vec<Arc<Optimizer>>>,
        sender: Sender<OptimizerSignal>,
        mut receiver: Receiver<OptimizerSignal>,
        segments: LockedSegmentHolder,
        wal: LockedWal,
        optimization_handles: Arc<TokioMutex<Vec<StoppableTaskHandle<bool>>>>,
        optimizers_log: Arc<Mutex<TrackerLog>>,
        total_optimized_points: Arc<AtomicUsize>,
        optimizer_resource_budget: ResourceBudget,
        max_handles: Option<usize>,
        has_triggered_optimizers: Arc<AtomicBool>,
        payload_index_schema: Arc<SaveOnDisk<PayloadIndexSchema>>,
        update_operation_lock: Arc<tokio::sync::RwLock<()>>,
        update_tracker: UpdateTracker,
        optimization_finished_sender: watch::Sender<()>,
    ) {
        let Some(some_optimizer) = optimizers.first() else {
            debug_assert!(false, "No optimizers configured");
            log::error!("No optimizers configured, optimization worker will not run");
            return;
        };

        let max_handles = max_handles.unwrap_or(usize::MAX);
        let num_indexing_threads = some_optimizer.num_indexing_threads();

        // Asynchronous task to trigger optimizers once CPU budget is available again
        let mut resource_available_trigger: Option<JoinHandle<()>> = None;

        loop {
            let result = timeout(OPTIMIZER_CLEANUP_INTERVAL, receiver.recv()).await;

            let cleaned_any =
                Self::cleanup_optimization_handles(optimization_handles.clone()).await;

            // Either continue below here with the worker, or reloop/break
            // Decision logic doing one of three things:
            // 1. run optimizers
            // 2. reloop and wait for next signal
            // 3. break here and stop the optimization worker
            let ignore_max_handles = match result {
                // Regular optimizer signal: run optimizers: do 1
                Ok(Some(OptimizerSignal::Operation(_))) => false,
                // Optimizer signal ignoring max handles: do 1
                Ok(Some(OptimizerSignal::Nop)) => true,
                // Hit optimizer cleanup interval, did clean up a task: do 1
                Err(Elapsed { .. }) if cleaned_any => {
                    // This branch prevents a race condition where optimizers would get stuck
                    // If the optimizer cleanup interval was triggered and we did clean any task we
                    // must run optimizers now. If we don't there may not be any other ongoing
                    // tasks that'll trigger this for us. If we don't run optimizers here we might
                    // get stuck into yellow state until a new update operation is received.
                    // See: <https://github.com/qdrant/qdrant/pull/5111>
                    log::warn!(
                        "Cleaned an optimization handle after timeout, explicitly triggering optimizers",
                    );
                    true
                }
                // Hit optimizer cleanup interval, did not clean up a task: do 2
                Err(Elapsed { .. }) => continue,
                // Channel closed or received stop signal: do 3
                Ok(None | Some(OptimizerSignal::Stop)) => break,
            };

            has_triggered_optimizers.store(true, Ordering::Relaxed);

            // Ensure we have at least one appendable segment with enough capacity
            // Source required parameters from first optimizer
            let result = Self::ensure_appendable_segment_with_capacity(
                &segments,
                some_optimizer.segments_path(),
                some_optimizer.segment_optimizer_config(),
                some_optimizer.threshold_config(),
                payload_index_schema.clone(),
            );
            if let Err(err) = result {
                log::error!("Failed to ensure there are appendable segments with capacity: {err}");
                panic!("Failed to ensure there are appendable segments with capacity: {err}");
            }

            // Backstop: reconcile the segment manifest with the live segment set. Registration
            // normally happens at each publication site via the `NewSegmentToken`; this wake-up is
            // the recovery path that picks up any registration that was skipped (e.g. an ignored
            // token). No-op if already in sync.Manifest write uses fsync — keep it off the
            // async worker.
            let segments_for_sync = segments.clone();
            if let Err(err) = tokio::task::spawn_blocking(move || {
                segments_for_sync.read().sync_segment_manifest(None)
            })
            .await
            .unwrap_or_else(|err| {
                Err(OperationError::service_error(format!(
                    "sync_segment_manifest task panicked: {err}"
                )))
            }) {
                log::error!("Failed to write segment manifest: {err}");
            }

            // If not forcing, wait on next signal if we have too many handles
            if !ignore_max_handles && optimization_handles.lock().await.len() >= max_handles {
                continue;
            }

            if Self::try_recover(
                segments.clone(),
                wal.clone(),
                update_operation_lock.clone(),
                update_tracker.clone(),
                some_optimizer.threshold_config().max_segment_size_bytes(),
            )
            .await
            .is_err()
            {
                let _ = optimization_finished_sender.send(());
                continue;
            }

            // Continue if we have enough resource budget available to start an optimization
            // Otherwise skip now and start a task to trigger the optimizer again once resource
            // budget becomes available
            let desired_cpus = 0;
            let desired_io = num_indexing_threads;
            if !optimizer_resource_budget.has_budget(desired_cpus, desired_io) {
                let trigger_active = resource_available_trigger
                    .as_ref()
                    .is_some_and(|t| !t.is_finished());
                if !trigger_active {
                    resource_available_trigger.replace(
                        Self::trigger_optimizers_on_resource_budget(
                            optimizer_resource_budget.clone(),
                            desired_cpus,
                            desired_io,
                            sender.clone(),
                        ),
                    );
                }
                let _ = optimization_finished_sender.send(());
                continue;
            }

            // Determine optimization handle limit based on max handles we allow
            // Not related to the CPU budget, but a different limit for the maximum number
            // of concurrent concrete optimizations per shard as configured by the user in
            // the Qdrant configuration.
            // Skip if we reached limit, an ongoing optimization that finishes will trigger this loop again
            let limit = max_handles.saturating_sub(optimization_handles.lock().await.len());
            if limit == 0 {
                log::trace!("Skipping optimization check, we reached optimization thread limit");
                continue;
            }

            let mut new_handles = Self::process_optimization(
                optimizers.clone(),
                segments.clone(),
                optimizers_log.clone(),
                total_optimized_points.clone(),
                optimizer_resource_budget.clone(),
                sender.clone(),
                optimization_finished_sender.clone(),
                limit,
            )
            .await;
            let mut handles = optimization_handles.lock().await;
            handles.append(&mut new_handles);
        }
    }

    /// Cleanup finalized optimization task handles
    ///
    /// This finds and removes completed tasks from our list of optimization handles.
    /// It also propagates any panics (and unknown errors) so we properly handle them if desired.
    ///
    /// It is essential to call this every once in a while for h
```

### Core Architecture Module: `lib/collection/src/update_workers/update_worker.rs`
```
use std::num::NonZeroUsize;
use std::sync::Arc;
use std::time::Instant;

use cancel::CancellationToken;
use common::counter::hardware_accumulator::HwMeasurementAcc;
use common::save_on_disk::SaveOnDisk;
use segment::types::SeqNumberType;
use shard::operations::CollectionUpdateOperations;
use shard::payload_index_schema::PayloadIndexSchema;
use shard::segment_holder::locked::LockedSegmentHolder;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{oneshot, watch};
use tokio_util::task::AbortOnDropHandle;

use crate::collection_manager::collection_updater::CollectionUpdater;
use crate::operations::generalizer::Generalizer;
use crate::operations::types::{CollectionError, CollectionResult, UpdateStatus};
use crate::profiling::interface::log_request_to_collector;
use crate::shards::CollectionId;
use crate::shards::update_tracker::UpdateTracker;
use crate::update_handler::{OperationData, Optimizer, OptimizerSignal, UpdateSignal};
use crate::update_workers::UpdateWorkers;
use crate::update_workers::applied_seq::AppliedSeqHandler;
use crate::update_workers::internal_update_result::InternalUpdateResult;
use crate::wal_delta::LockedWal;

/// Sends the operation result through the feedback channel if present.
/// Logs a debug message if the receiver is no longer waiting.
fn send_feedback(
    sender: Option<oneshot::Sender<CollectionResult<InternalUpdateResult>>>,
    result: CollectionResult<InternalUpdateResult>,
    op_num: SeqNumberType,
) {
    if let Some(feedback) = sender {
        feedback.send(result).unwrap_or_else(|_| {
            log::debug!("Can't report operation {op_num} result. Assume already not required");
        });
    }
}

impl UpdateWorkers {
    /// Main loop of the update worker.
    ///
    /// Returns the receiver when the worker is stopped.
    #[allow(clippy::too_many_arguments)]
    pub async fn update_worker_fn(
        collection_name: CollectionId,
        mut receiver: Receiver<UpdateSignal>,
        optimize_sender: Sender<OptimizerSignal>,
        wal: LockedWal,
        segments: LockedSegmentHolder,
        update_operation_lock: Arc<tokio::sync::RwLock<()>>,
        update_tracker: UpdateTracker,
        prevent_unoptimized: bool,
        optimizers: Arc<Vec<Arc<Optimizer>>>,
        payload_index_schema: Arc<SaveOnDisk<PayloadIndexSchema>>,
        optimization_finished_receiver: watch::Receiver<()>,
        applied_seq_handler: Arc<AppliedSeqHandler>,
        cancel: CancellationToken,
    ) -> Receiver<UpdateSignal> {
        // Take thresholds from the first optimizer, like the optimization worker does.
        // Resolved once, a config update restarts the workers.
        let capacity_optimizer = optimizers.first().cloned();
        let max_segment_size_bytes = capacity_optimizer
            .as_ref()
            .and_then(|optimizer| optimizer.threshold_config().max_segment_size_bytes());

        let receiver = loop {
            let signal = tokio::select! {
                biased; // biased to check cancellation first
                _ = cancel.cancelled() => {
                    break receiver;
                }
                signal = receiver.recv() => match signal {
                    Some(signal) => signal,
                    None => break receiver,
                }
            };

            match signal {
                UpdateSignal::Operation(OperationData {
                    op_num,
                    operation,
                    sender,
                    wait_for_deferred,
                    hw_measurements,
                }) => {
                    let collection_name_clone = collection_name.clone();
                    let wal_clone = wal.clone();
                    let update_operation_lock_clone = update_operation_lock.clone();
                    let update_tracker_clone = update_tracker.clone();

                    let operation = if let Some(operation) = operation {
                        *operation
                    } else {
                        let wal_clone = wal.clone();
                        let record = match tokio::task::spawn_blocking(move || {
                            wal_clone.blocking_lock().read_raw_record(op_num)
                        })
                        .await
                        {
                            Ok(record) => record,
                            Err(err) => {
                                log::error!("Can't read operation {op_num} from WAL - {err}");
                                send_feedback(sender, Err(CollectionError::from(err)), op_num);
                                continue;
                            }
                        };

                        match record {
                            Some(serialized_record) => match serialized_record.deserialize() {
                                Ok(deserialized) => deserialized.operation,
                                Err(err) => {
                                    log::error!("Can't read operation {op_num} from WAL - {err}");
                                    send_feedback(sender, Err(CollectionError::from(err)), op_num);
                                    continue;
                                }
                            },
                            None => {
                                send_feedback(
                                    sender,
                                    Err(CollectionError::service_error(format!(
                                        "Operation {op_num} not found in WAL"
                                    ))),
                                    op_num,
                                );
                                continue;
                            }
                        }
                    };

                    let wait = sender.is_some();
                    let segments_clone = segments.clone();
                    let capacity_optimizer_clone = capacity_optimizer.clone();
                    let payload_index_schema_clone = payload_index_schema.clone();
                    let operation_result = tokio::task::spawn_blocking(move || {
                        // Make sure a destination below the size cap exists before applying.
                        // Best effort, a failure here must not fail the write itself.
                        if let Some(optimizer) = capacity_optimizer_clone
                            && let Err(err) = Self::ensure_appendable_segment_with_capacity(
                                &segments_clone,
                                optimizer.segments_path(),
                                optimizer.segment_optimizer_config(),
                                optimizer.threshold_config(),
                                payload_index_schema_clone,
                            )
                        {
                            log::error!(
                                "Failed to provision appendable capacity, applying anyway: {err}"
                            );
                        }

                        Self::update_worker_internal(
                            collection_name_clone,
                            operation,
                            op_num,
                            wait,
                            wal_clone,
                            segments_clone,
                            update_operation_lock_clone,
                            update_tracker_clone,
                            max_segment_size_bytes,
                            hw_measurements,
                        )
                    })
                    .await;

                    let res = match operation_result {
                        Ok(Ok(update_res)) => optimize_sender
                            .send(OptimizerSignal::Operation(op_num))
                            .await
                            .and(Ok(update_res))
                            .map_err(|send_err| send_err.into()),
                        Ok(Err(err)) => Err(err),
                        Err(err) => Err(CollectionError::from(err)),
                    };

                    // Early return if operation failed
                    let _res = match res {
                        Ok(res) => res,
                        Err(update_err) => {
                            send_feedback(sender, Err(update_err), op_num);
                            continue;
                        }
                    };

                    // `AppliedSeqHandler::update` may fsync every APPLIED_SEQ_SAVE_INTERVAL ops.
                    let applied_seq_handler = applied_seq_handler.clone();
                    if let Err(err) =
                        tokio::task::spawn_blocking(move || applied_seq_handler.update(op_num))
                            .await
                            .unwrap_or_else(|join_err| {
                                Err(CollectionError::service_error(format!(
                                    "applied_seq update task panicked: {join_err}"
                                )))
                            })
                    {
                        log::error!("Can't update last applied_seq {err}")
                    }

                    if wait_for_deferred && prevent_unoptimized {
                        if let Some(mut feedback) = sender {
                            // Detach the deferred-points wait so only the originating
                            // client waits — the update queue keeps draining.
                            let segments = segments.clone();
                            let optimize_sender = optimize_sender.clone();
                            let mut optimization_finished_receiver =
                                optimization_finished_receiver.clone();
                            let cancel = cancel.clone();
                            tokio::spawn(async move {
                                let status = match Self::wait_for_deferred_points_ready(
                                    &segments,
                    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10832** (2026-09-29): **Scroll with order_by silently excludes points whose order_by payload field is missing (1.19.1)**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above -->  ## Current Behavior When scrolling with `order_by` on an indexed integer payload field, points whose payload does NOT contain the field are silently excluded from the result — they are not returned on any page, and nothing in the response indicates that points were dropped.  Collection with 5 points, `rank` payload values `[5, 1, 3, 5, <missing>]`, integer payload index on `rank`:  ``` POST /collections/<c>/points/scroll  {"order_by": "rank", "limit": 10} -> ids [2, 3, 4, 1]        -- id 5 (no rank) is absent ```  The un-ordered scroll of the same collection returns all 5 points. Ordering therefore acts as an undocumented filter.  ## Steps to Reproduce 1. Run a Qdrant server at `http://127.0.0.1:6333`. 2. `python reproduce.py --url http://127.0.0.1:6333 --output observed.json` (Python 3 standard library only, direct HTTP — no SDK). It creates a uniquely named collection, upserts the 5 points with `wait=true`, creates the integer index, scrolls with `order_by`, prints the returned ids, deletes only its own collection, and exits non-zero unless all 5 points are returned. Deterministic; `observed.json` is from an actual run, executed twice with identical results.  <!--- Please make sure to include the data which could be used to reproduce the problem -->   ## Expected Behavior Points missing the order_by field should either be returned (in a defined position, e.g. after all valued points) or excluded **by a doc
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We won't be changing this: `order_by` walks the payload range index, so only points that have a value for the key are returned (the same design that returns a multi-valued point once per value, see #9192). To get the remaining points, run a second scroll with an `is_empty` filter on that key. Closing as not planned.

- **Issue #10831** (2026-09-29): **Exact Euclid search omits points whose squared distance overflows float32 (limit=2 over 2 points returns 1)**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above -->  ## Current Behavior With `distance=Euclid` and `exact=true`, a point whose squared distance overflows the float32 range is silently *omitted* from results instead of being returned with a saturated/infinite score. `limit=2` over a 2-point collection returns 1 point.  Dataset `p1=[1,0]` (id 1), `p2=[0,1]` (id 2), query `q=[0.6,0.8]`. True squared distances are alpha²·0.8 (p1) and alpha²·0.4 (p2): p2 always ranks first and both points satisfy `limit=2`, for every finite alpha:  | alpha | returned | true squared distances (float64) | |---|---|---| | 1 | ids [2, 1], scores [0.632, 0.894] | 0.4, 0.8 | | 2.5e19 | **ids [2] — p1 missing** | 2.5e38 (intermediate), 5e38 (intermediate) |  Qdrant returns Euclidean distances: p2's returned score is 1.581e19 = sqrt(alpha²·0.4), finite in float32. The omitted p1 would have a final distance of 2.236e19 = sqrt(alpha²·0.8) — also representable in float32. Only the intermediate *squared* distance (5e38) exceeds the float32 range, and that intermediate overflow causes the row to disappear.  ## Steps to Reproduce 1. Run a Qdrant server at `http://127.0.0.1:6333`. 2. Run the attached `reproduce.py` (Python 3 standard library only, direct HTTP — no SDK):     ```sh    python reproduce.py --url http://127.0.0.1:6333 --output observed.json    ```     It creates a uniquely named 2-dim Euclid collection, upserts both points with `wait=true`, queries with `{"params": {"exact": true}, "
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We won't be changing this: vectors with components around 1e19 are far outside any embedding range, and at that scale the squared Euclidean distance overflows float32. We don't add per-value guards for such inputs (same as #9201). Closing as not planned.

- **Issue #10805** (2026-10-02): **MMR can drop better candidates when merging results from multiple shards**
  *Symptoms*: ## Current Behavior  The candidate set can change between identical MMR queries when the collection has multiple shards.  For example, with 2 shards and `candidates_limit=4`, one run returned a point with a score of `0.8192` while a point with a score of `1.0000` was missing.  I reproduced this through `qdrant-client` against the current `dev` build as well.  ## Steps to Reproduce  1. Create a collection with 2 shards using cosine distance. 2. Add 6 points to each shard with known vectors such that each shard has different nearest points. 3. Query with MMR using `candidates_limit=4`, `limit=4`, `diversity=0.0`, and exact search. 4. Run the same query repeatedly.  The expected top 4 across both shards have scores of `1.0000`, `0.9988`, `0.9950`, and `0.9889`.  However, repeated identical queries can return different sets of points. In one run, the `1.0000` point was missing while a `0.8192` point was returned.  ## Expected Behavior  The 4 best candidates across the shards should be passed to MMR.  ## Possible Solution  The shard results should be merged by the distance used for MMR before applying `candidates_limit`.  ## Context (Environment)  I came across this while looking into inconsistent results from a RAG application using MMR.  I reproduced it locally with Qdrant built from the current `dev` branch and `qdrant-client` 1.19.1.  Is this expected behavior?  If not, I can take a look at a fix.

- **Issue #10692** (2026-09-28): **Cosine scores depend on magnitude for small nonzero vectors (1.19.1)**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above -->  ## Current Behavior <!--- Tell us what happens instead of the expected behavior --> An exact query against a `Cosine` collection returns magnitude-dependent scores for finite, nonzero, collinear vectors. With a single 2D point, I get:  | Inserted vector | Query vector | Expected cosine | Actual score | |---|---|---:|---:| | `[1, 0]` | `[1, 0]` | 1 | 1 | | `[1, 0]` | `[1e-6, 0]` | 1 | 1e-6 | | `[1e-6, 0]` | `[1, 0]` | 1 | 1e-6 | | `[1e-6, 0]` | `[1e-6, 0]` | 1 | 1e-12 |  The returned stored vector is also `[1e-6, 0]` after uploading that vector. The tiny vector remains unnormalized. Testing the point and query separately shows that either can cause the score difference.  ## Steps to Reproduce 1. Run a Qdrant server reachable at `http://127.0.0.1:6333`. The observed server reports version `1.19.1`, commit `6ab21cac18ebb6f4ae29102c7f8f5cc11affd5de`. 2. Save and run the attached `reproduce.py` with Python 3. It uses only the standard library and direct HTTP; no SDK, NumPy, test framework, or external dataset is needed:     ```sh    python reproduce.py --url http://127.0.0.1:6333 --output observed.json    ```  3. The script creates a uniquely named collection with `{"vectors":{"size":2,"distance":"Cosine"}}`, upserts point ID `1` with `wait=true`, and queries it with `"params":{"exact":true}`. It uses the four vector/query pairs listed above. There are no filters, quantization settings, or explicit index builds. 
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to work on this issue. I'll investigate the cosine normalization behavior for small non-zero vectors and the related scalar/SIMD implementations, and add regression tests for the fix.  Please let me know if anyone is already working on this or if there are any implementation considerations I should be aware of. Thanks! 
  > Thanks — this is already tracked in #10465. Closing this one so the discussion stays in one place; please add anything new there.

- **Issue #10667** (2026-09-21): **Nightly model testing failure**
  *Symptoms*: ## Last failure  The nightly model testing job failed.  - Seed: `459304395571759164` (reproduce with `--seed 459304395571759164`) - Date: 18.09.2026 03:18 - Failed: async scorer only (no io_uring passed the same seed) - [Failed run](https://github.com/qdrant/qdrant/actions/runs/35298600982) - [Commit](https://github.com/qdrant/qdrant/tree/20229f99ba4b3be13c479b9448ccb5df889799fe) (the `dev` commit under test)  Note: this issue is reused for every nightly failure, so the details above describe the **latest** one only. Consecutive failures are often unrelated bugs; check the linked run. 
  **Post-Mortem & Fix Analysis**:
  > fixed by https://github.com/qdrant/qdrant/pull/10349

- **Issue #10612** (2026-09-28): **Context Search returns negative loss scores inconsistent with the documented formula**
  *Symptoms*: ## Summary  Qdrant 1.19.0 applies an additional nonlinear compression to negative Context Search losses, causing the returned scores to differ from the formula documented by Qdrant.  The documented formula is:  ```text sum(min(positive_similarity - negative_similarity, 0.0)) ```  However, when the raw loss is `-1.6`, Qdrant returns approximately `-0.61538464`. When the raw loss is `-0.4`, it returns approximately `-0.28571436`.  These values correspond to an additional transformation:  ```text x / (1 + abs(x)) ```  rather than the documented raw loss.  ## Environment  * Qdrant: `qdrant/qdrant:v1.19.0` * Distance: `Cosine` * Vector dimension: 2 * API: `POST /collections/{collection_name}/points/query` * Query type: Context Search * Search mode: `exact=true` * Filter: none * Quantization: disabled * Python dependency: `requests==2.34.2`  ## Steps to Reproduce  Start Qdrant:  ```bash docker run --rm --name qdrant-context-score-repro \   -p 127.0.0.1:16354:6333 \   qdrant/qdrant:v1.19.0 ```  Install the dependency:  ```bash pip install requests==2.34.2 ```  Run this standalone Python script:  ```python import json import math import uuid import requests  BASE = "http://127.0.0.1:16354" COLLECTION = "context_score_" + uuid.uuid4().hex[:8]  POSITIVE = [1.0, 0.0] NEGATIVE = [-1.0, 0.0]  SEED = {     0: [0.8, 0.6],     1: [0.0, 1.0],     2: [-0.8, 0.6],     3: [-0.2, 0.9797958971],     4: [0.3, -0.9539392014], }  MUTANT = [-0.5, 0.8660254038]   def call(method, path, body=None):     
  **Post-Mortem & Fix Analysis**:
  > Hi @leemeii,  I investigated this issue. The nonlinear compression comes from `ContextPair::loss_by` applying `fast_sigmoid(ScoreType::min(difference, 0.0))`, where `fast_sigmoid(x) = x / (1.0 + |x|)`.  This squashing was originally added in PR #2820 during the initial discovery scorer implementation, but it contradicts the documented raw triplet loss formula `sum(min(positive_similarity - negative_similarity, 0.0))` and also causes the Manhattan distance scale-invariance issue reported in #9154.  I have a patch ready that removes `fast_sigmoid` from `loss_by`, updates the property tests, and adds regression tests covering the exact reproduction in this issue.  I will open a PR against `dev` and link it here.
  > Looked into this — the compression is intentional, the documentation is what's off.  In `lib/segment/src/vector_storage/query/context_query.rs`:  - `ContextPair::loss_by` returns `fast_sigmoid(min(positive − negative − ε, 0.0))`, where `fast_sigmoid(x) = x / (1 + |x|)` (`lib/common/common/src/math.rs`) — the same helper the recommend strategies use - `ContextQuery::score_by` sums those per-pair values  So scores are bounded in `(-1.0, 0.0]` by design, and the ranking is unchanged because the transform is strictly increasing — only the reported magnitude differs from the documented raw loss. Reproduced on 1.19.0 (Cosine, `exact=true`): raw pair loss `-0.4` → `-0.285714`, `-1.6` → `-0.615385`, matching the issue's numbers.  I've opened a docs fix that states the formula as implemented, including the per-pair `ε` margin and the example values: qdrant/landing_page#2753. Happy to adjust the wording if you'd rather the docs keep the raw-loss framing and note the compression separately.
  > Thanks for the clarification @engmohamedsalah! Makes total sense that the per-pair compression to `(-1.0, 0.0]` is intentional by design.  I've closed PR #10638 in favor of your docs PR https://github.com/qdrant/landing_page/pull/2753.

- **Issue #10552** (2026-09-09): **Local mode: re-upserting an identical cosine vector changes its stored value**
  *Symptoms*: In a local mode (`QdrantClient(":memory:")` or a path), upserting the **same point with the same vector** twice into a `Distance.COSINE` collection stores two slightly different vectors. The second write differs from the first in the last bits of some components.  Not applicable to real server, re-upserting an identical vector produces equal results.  ## Current Behavior See above  ## Steps to Reproduce Assuming a qdrant server is listening on localhost:6333.  ```python import uuid from qdrant_client import QdrantClient, models  V = [0.1234567901234, -0.98765432109, 0.5555555555, 0.333333333333] PID = str(uuid.UUID(hex="ab" * 16))  def probe(client: QdrantClient, name: str) -> tuple[list[float], list[float]]:     if client.collection_exists(name):         client.delete_collection(name)     client.create_collection(         name,         vectors_config={"dense": models.VectorParams(size=4, distance=models.Distance.COSINE)},     )     point = models.PointStruct(id=PID, vector={"dense": V}, payload={})      client.upsert(name, points=[point], wait=True)     first = client.retrieve(name, ids=[PID], with_vectors=True)[0].vector["dense"]      client.upsert(name, points=[point], wait=True)   # identical write     second = client.retrieve(name, ids=[PID], with_vectors=True)[0].vector["dense"]      client.delete_collection(name)     return first, second  for label, client in [     ("local", QdrantClient(":memory:")),     ("server", QdrantClient(url="http://localhost:6333")), ]:     fi
  **Post-Mortem & Fix Analysis**:
  > This is tracked in the client repo — please file specifics in qdrant/qdrant-client. Closing here.

- **Issue #10549** (2026-09-09): **Stale row tail survives named-vector delete/recreate/delete after reload**
  *Symptoms*: ## Current Behavior  Qdrant accepts the complete workload and live retrieval returns the final multivector value correctly.  After graceful shutdown and a fresh process reload, point `42` returns a stale extra row:  * Expected final value: 3 rows * Actual value after reload: 4 rows * The fourth row is left over from an earlier 4-row value   ## Steps to Reproduce  Use a fresh persistent storage directory for every trial.  Start Qdrant:  ```bash docker run -d --name qdrant-mv-repro \   -p 6333:6333 \   -v "$PWD/qdrant-repro-storage:/qdrant/storage" \   qdrant/qdrant:v1.19.1 ```  Install the only Python dependency:  ```bash pip install requests ```  Save the following as `repro.py`:  ```python #!/usr/bin/env python3 import argparse import os import time  import requests   BASE = os.getenv("QDRANT_URL", "http://127.0.0.1:6333") COLLECTION = "mv_tail_reload_repro" DIM = 4 FINAL_TAG = 9001   def api(method, path, **kwargs):     response = requests.request(         method, BASE + path, timeout=60, **kwargs     )     if not response.ok:         raise RuntimeError(             f"{method} {path}: {response.status_code} {response.text}"         )     return response.json() if response.content else None   def wait_ready():     for _ in range(120):         try:             if requests.get(f"{BASE}/readyz", timeout=1).ok:                 return         except requests.RequestException:             pass         time.sleep(0.25)     raise RuntimeError("Qdrant did not become ready")   def mat
  **Post-Mortem & Fix Analysis**:
  > We could not reproduce this on v1.19.1 with the steps given. The attached script prepends `BASE` twice at collection creation, so it does not run as posted; with that fixed, its expected values exceed f32's exact-integer range, so its own live assert fails before any restart. With f32-safe values the lifecycle case returned 3 rows after every reload (5 of 5 runs, plus the control). To look into this we need a reproduction script that runs as posted and fails, or the trace-based reproducer the report mentions. Could you add that? We'll pick it up once it's here.
  > Thanks for checking. I corrected both issues in the reproducer:    1. The collection creation call was passing an absolute URL to a helper that already   prepended BASE.   2. The generated values exceeded the exact-integer range of float32.    I then reran the corrected lifecycle reproducer against the latest Qdrant v1.19.1 using fresh persistent storage:    - write the final 3-row multivector;   - verify the live value;   - gracefully stop Qdrant;   - restart Qdrant;   - retrieve the point again.    The result was:        live row count: 3       reloaded row count: 3       reload value is correct    The reloaded value was identical to the final upserted value. I therefore cannot reproduce the stale fourth row on v1.19.1 with the corrected script.    I agree that the current report does not establish a reproducible bug. I will update the issue accordingly unless a trace-based reproducer or additional triggering conditions become available.

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

### Incident Patch 1: `23fd1972` (2026-10-05)
**Commit Message**: Build qdrant once and shard consensus tests across 3 runners (#10861)

* Build qdrant once and shard consensus tests across 3 runners

* Load data in batches

**File**: `.github/workflows/integration-tests.yml` (modified, +70/-25)
```diff
@@ -19,53 +19,80 @@ env:
   UV_VERSION: 0.9.17
 
 jobs:
-  integration-tests:
+  # Builds the debug binary once; the integration and consensus test jobs download it.
+  build-qdrant:
 
     runs-on: ubuntu-latest
 
     steps:
       - name: Install minimal stable
         uses: dtolnay/rust-toolchain@631a55b12751854ce901bb631d5902ceb48146f7 # stable
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
       - name: Install Protoc
         uses: ./.github/actions/setup-protoc
       - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2
         with:
           shared-key: integration-tests
           # Only save the cache on dev; feature-branch caches would just get evicted under the 10 GB budget
           save-if: ${{ github.ref == 'refs/heads/dev' }}
+      - name: Install dependencies
+        run: sudo apt-get install clang
+      - name: Build
+        run: cargo build --features "service_debug data-consistency-check staging" --locked
+      - name: Upload qdrant binary
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        with:
+          name: qdrant-debug
+          path: target/debug/qdrant
+          retention-days: 1
+
+  integration-tests:
+    needs: build-qdrant
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        mode: [single, distributed]
+
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
       - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
         with:
           python-version: '3.13'
-      - name: Install dependencies
+      - name: Install uv and Python dependencies
         run: |
-          sudo apt-get install clang
           curl -LsSf https://astral.sh/uv/$UV_VERSION/install.sh | sh
           echo "$HOME/.local/bin" >> $GITHUB_PATH
           uv --project tests lock --check
           uv --project tests sync
-      - name: Build
-        run: cargo build --features "service_debug data-consistency-check staging" --locked
+      - name: Download qdrant binary
+        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
+        with:
+          name: qdrant-debug
+          path: target/debug
+      - name: Make qdrant binary executable
+        # Artifacts don't keep file permissions
+        run: chmod +x target/debug/qdrant
       - name: Run integration tests
-        run: uv --project tests run bash ./tests/integration-tests.sh
+        run: uv --project tests run bash ./tests/integration-tests.sh ${{ matrix.mode == 'distributed' && 'distributed' || '' }}
         shell: bash
 
   integration-tests-consensus:
-
+    needs: build-qdrant
     runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        shard: [1, 2, 3]
+
     steps:
-      - name: Install minimal stable
-        uses: dtolnay/rust-toolchain@631a55b12751854ce901bb631d5902ceb48146f7 # stable
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-      - name: Install Protoc
-        uses: ./.github/actions/setup-protoc
-      - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2
         with:
-          shared-key: integration-tests
-          # integration-tests is the broadest build in this group and owns saving the cache
-          save-if: "false"
-      - name: Install dependencies
-        run: sudo apt-get install clang
+          persist-credentials: false
       - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
         with:
           python-version: '3.13'
@@ -75,20 +102,38 @@ jobs:
           echo "$HOME/.local/bin" >> $GITHUB_PATH
           uv --project tests lock --check
           uv --project tests sync
-      - name: Build
-        run: cargo build --features "service_debug data-consistency-check staging" --locked
-      - name: Run integration tests - 1 peer
-        run: uv --project tests run bash ./tests/integration-tests.sh distributed
-        shell: bash
-      - name: Run integration tests - multiple peers - pytest
-        run: uv --project tests run pytest -n auto --dist=loadfile -v tests/consensus_tests --durations=10
+      - name: Download qdrant binary
+        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
+        with:
+          name: qdrant-debug
+          path: target/debug
+      - name: Make qdrant binary executable
+        run: chmod +x target/debug/qdrant
+      - name: Run integration tests - multiple peers - pytest (shard ${{ matrix.shard }}/3)
+        # pytest-split balances shards with tests/consensus_tests/.test_durations; contiguous chunks keep
+        # each test file (and its module-scoped cluster) in one shard. Each shard uploads the durations of
+        # its own tests; to refr
```

**File**: `tests/consensus_tests/.test_durations` (added, +395/-0)
```diff
@@ -0,0 +1,395 @@
+{
+    "consensus_tests/auth_tests/test_audit_telemetry.py::test_telemetry_access_checks_still_apply_without_audit_log": 30.0,
+    "consensus_tests/auth_tests/test_audit_telemetry.py::test_telemetry_scrapes_are_not_added_to_audit_log": 30.0,
+    "consensus_tests/auth_tests/test_dashboard_whitelist_bypass.py::test_dashboard_path_traversal_requires_api_key": 30.0,
+    "consensus_tests/auth_tests/test_dashboard_whitelist_bypass.py::test_dashboard_prefix_is_whitelisted": 30.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_cluster_forms_with_internal_auth_enforced": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_accepts_read_write_keys[alt-api-key]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_accepts_read_write_keys[api-key-bearer]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_accepts_read_write_keys[api-key]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_rejects_non_read_write_credentials[jwt-manage]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_rejects_non_read_write_credentials[jwt-read]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_rejects_non_read_write_credentials[no-key]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_rejects_non_read_write_credentials[read-only-bearer]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_rejects_non_read_write_credentials[read-only-key]": 6.0,
+    "consensus_tests/auth_tests/test_internal_auth.py::test_internal_api_rejects_non_read_write_credentials[wrong-key]": 6.0,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_abort_shard_transfer_operation": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_all_actions_have_tests": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_all_grpc_endpoints_are_covered": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_all_rest_endpoints_are_covered": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_clear_issues": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_clear_payload": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_cluster_telemetry": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_collection_exists": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_count_points": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_alias": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_collection": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_collection_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_custom_shard_key": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_custom_shard_key_operation": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_default_shard_key": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_default_shard_key_operation": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_full_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_index": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_shard_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_create_vector_name": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_alias": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_collection": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_collection_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_full_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_index": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_payload": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_peer": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_points": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_shard_key": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_shard_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_vector_name": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_delete_vectors": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_discover_points": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_discover_points_batch": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_download_collection_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_download_full_snapshot": 0.606,
+    "consensus_tests/auth_tests/test_jwt_access.py::test_download_shard_snapshot": 0.606,
+    "consensus_tests/aut
```

**File**: `tests/consensus_tests/test_partial_snapshot.py` (modified, +12/-10)
```diff
@@ -118,7 +118,8 @@ def test_partial_snapshot(
 def test_partial_snapshot_recovery_lock(tmp_path: pathlib.Path, wait: bool):
     assert_project_root()
 
-    write_peer, read_peer = bootstrap_peers(tmp_path, bootstrap_points = 100_000)
+    # 100k points make recovery slow enough to observe the lock; big batches keep loading them fast
+    write_peer, read_peer = bootstrap_peers(tmp_path, bootstrap_points = 100_000, bootstrap_batch_size = 1_000)
 
     executor = concurrent.futures.ThreadPoolExecutor(max_workers = 3)
     futures = [executor.submit(try_recover_partial_snapshot_from, read_peer, write_peer, wait = wait) for _ in range(3)]
@@ -130,7 +131,8 @@ def test_partial_snapshot_recovery_lock(tmp_path: pathlib.Path, wait: bool):
 def test_partial_snapshot_read_lock(tmp_path: pathlib.Path):
     assert_project_root()
 
-    write_peer, read_peer = bootstrap_peers(tmp_path, bootstrap_points = 100_000)
+    # 100k points make recovery slow enough to observe the lock; big batches keep loading them fast
+    write_peer, read_peer = bootstrap_peers(tmp_path, bootstrap_points = 100_000, bootstrap_batch_size = 1_000)
 
     executor = concurrent.futures.ThreadPoolExecutor(max_workers = 1)
     recover_future = executor.submit(recover_partial_snapshot_from, read_peer, write_peer)
@@ -234,14 +236,14 @@ def test_partial_snapshot_recreate_payload_field_index(tmp_path: pathlib.Path):
     assert_http_ok(resp)
 
 
-def bootstrap_peers(tmp: pathlib.Path, shards = 1, bootstrap_points = 0, recover_read = False, wait_for_green = False):
-    write_peer = bootstrap_write_peer(tmp, shards, bootstrap_points, wait_for_green=wait_for_green)
+def bootstrap_peers(tmp: pathlib.Path, shards = 1, bootstrap_points = 0, recover_read = False, wait_for_green = False, bootstrap_batch_size = 10):
+    write_peer = bootstrap_write_peer(tmp, shards, bootstrap_points, wait_for_green=wait_for_green, batch_size=bootstrap_batch_size)
     read_peer = bootstrap_read_peer(tmp, shards, write_peer if recover_read else None)
     return write_peer, read_peer
 
-def bootstrap_write_peer(tmp: pathlib.Path, shards = 1, bootstrap_points = 0, wait_for_green = False):
+def bootstrap_write_peer(tmp: pathlib.Path, shards = 1, bootstrap_points = 0, wait_for_green = False, batch_size = 10):
     write_peer = bootstrap_peer(tmp / "write", 6331, "write_")
-    bootstrap_collection(write_peer, shards, bootstrap_points)
+    bootstrap_collection(write_peer, shards, bootstrap_points, batch_size)
     if wait_for_green:
         wait_collection_green(write_peer, collection_name=COLLECTION)
     return write_peer
@@ -267,7 +269,7 @@ def bootstrap_peer(path: pathlib.Path, port: int, log_file_prefix = ""):
 
     return uris[0]
 
-def bootstrap_collection(peer_url, shards = 1, bootstrap_points = 0):
+def bootstrap_collection(peer_url, shards = 1, bootstrap_points = 0, batch_size = 10):
     create_collection(
         peer_url,
         shard_number = shards,
@@ -280,7 +282,7 @@ def bootstrap_collection(peer_url, shards = 1, bootstrap_points = 0):
     wait_collection_exists_and_active_on_all_peers(COLLECTION, [peer_url])
 
     if bootstrap_points > 0:
-        upsert(peer_url, bootstrap_points)
+        upsert(peer_url, bootstrap_points, batch_size = batch_size)
 
 def recover_collection(peer_url: str, recover_from_url: str):
     snapshot_url = create_collection_snapshot(recover_from_url)
@@ -375,8 +377,8 @@ def scroll_points(peer_url: str):
     return points
 
 
-def upsert(peer_url: str, points: int, offset = 0):
-    upsert_random_points(peer_url, points, offset = offset, batch_size = 10, with_sparse_vector = False)
+def upsert(peer_url: str, points: int, offset = 0, batch_size = 10):
+    upsert_random_points(peer_url, points, offset = offset, batch_size = batch_size, with_sparse_vector = False)
 
 def delete(peer_url: str, until_id: int, from_id = 0):
     resp = requests.post(f"{peer_url}/collections/{COLLECTION}/points/delete?wait=true", json = {
```

**File**: `tests/pyproject.toml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ dependencies = [
     "qdrant-client>=1.19.0,<2",
     "tqdm>=4.67.1,<5",
     "filelock>=3.20,<4",
+    "pytest-split>=0.10,<1",
 ]
 
 [tool.uv]
```

**File**: `tests/uv.lock` (modified, +15/-1)
```diff
@@ -377,7 +377,7 @@ name = "exceptiongroup"
 version = "1.3.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "typing-extensions" },
+    { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/50/79/66800aadf48771f6b62f7eb014e352e5d06856655206165d775e675a02c9/exceptiongroup-1.3.1.tar.gz", hash = "sha256:8b412432c6055b0b7d14c310000ae93352ed6754f70fa8f7c34141f91c4e3219", size = 30371, upload-time = "2025-11-21T23:01:54.787Z" }
 wheels = [
@@ -1595,6 +1595,18 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/61/f2/7a29fb0571562034b05c38dceabba48dcc622be5d6c5448db80779e55de7/pytest_cases-3.10.1-py2.py3-none-any.whl", hash = "sha256:0deb8a85b6132e44adbc1cfc57897c6a624ec23f48ab445a43c7d56a6b9315a4", size = 108870, upload-time = "2026-03-02T23:05:32.663Z" },
 ]
 
+[[package]]
+name = "pytest-split"
+version = "0.11.0"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "pytest" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/2f/16/8af4c5f2ceb3640bb1f78dfdf5c184556b10dfe9369feaaad7ff1c13f329/pytest_split-0.11.0.tar.gz", hash = "sha256:8ebdb29cc72cc962e8eb1ec07db1eeb98ab25e215ed8e3216f6b9fc7ce0ec2b5", size = 13421, upload-time = "2026-02-03T09:14:31.469Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/ae/a1/d4423657caaa8be9b31e491592b49cebdcfd434d3e74512ce71f6ec39905/pytest_split-0.11.0-py3-none-any.whl", hash = "sha256:899d7c0f5730da91e2daf283860eb73b503259cb416851a65599368849c7f382", size = 11911, upload-time = "2026-02-03T09:14:33.708Z" },
+]
+
 [[package]]
 name = "pytest-subtests"
 version = "0.14.2"
@@ -1765,6 +1777,7 @@ dependencies = [
     { name = "pyjwt" },
     { name = "pytest" },
     { name = "pytest-cases" },
+    { name = "pytest-split" },
     { name = "pytest-subtests" },
     { name = "pytest-timeout" },
     { name = "pytest-xdist" },
@@ -1787,6 +1800,7 @@ requires-dist = [
     { name = "pyjwt", specifier = ">=2.15.0,<3" },
     { name = "pytest", specifier = ">=8.4,<9" },
     { name = "pytest-cases", specifier = ">=3.9.1,<4" },
+    { name = "pytest-split", specifier = ">=0.10,<1" },
     { name = "pytest-subtests", specifier = ">=0.14.1,<0.15" },
     { name = "pytest-timeout", specifier = ">=2.4,<3" },
     { name = "pytest-xdist", specifier = ">=3.8.0,<4" },
```

---

### Incident Patch 2: `466766ef` (2026-10-03)
**Commit Message**: 🤖 Fix `group_by` on paths with an array index (#10897)

Group candidates are fetched with `with_payload: [group_by]`, and the include
matcher never selects `[n]`, so `group_by: "arr[0].x"` saw `{"arr": []}` and
returned no groups. Fetch with `[n]` widened to `[]` instead: it keeps array
elements in place, so the aggregator reads the same values as from the full
payload.

**File**: `lib/segment/src/json_path/mod.rs` (modified, +33/-9)
```diff
@@ -101,15 +101,16 @@ impl JsonPath {
         new_map
     }
 
-    /// Remove the wildcard suffix from the path, if it exists.
-    /// E.g. `a.b[]` -> `a.b`.
-    pub fn strip_wildcard_suffix(&self) -> Self {
-        match self.rest.split_last() {
-            Some((JsonPathItem::WildcardIndex, rest)) => JsonPath {
-                first_key: self.first_key.clone(),
-                rest: rest.to_vec(),
-            },
-            _ => self.clone(),
+    /// Replace every index with a wildcard index.
+    /// E.g. `a[0].b[1]` -> `a[].b[]`.
+    pub fn wildcard_indices(&self) -> Self {
+        let rest = self.rest.iter().map(|item| match item {
+            JsonPathItem::Index(_) => JsonPathItem::WildcardIndex,
+            JsonPathItem::Key(_) | JsonPathItem::WildcardIndex => item.clone(),
+        });
+        JsonPath {
+            first_key: self.first_key.clone(),
+            rest: rest.collect(),
         }
     }
 
@@ -1011,6 +1012,29 @@ mod tests {
         assert!(JsonPath::new("a").check_include_pattern(&JsonPath::new("a.d")));
     }
 
+    #[test]
+    fn test_wildcard_indices_include_pattern() {
+        let map = json(
+            r#"{"arr": [7, {"y": 0}, {"x": [5, 6], "y": 1}, [{"x": 9}]], "m": [[1, 2], [3, 4]], "obj": {"k": 1}}"#,
+        );
+        for path in [
+            "arr",
+            "arr[]",
+            "arr[2].x",
+            "arr[].x",
+            "arr[3][0].x",
+            "m[1][0]",
+            "m[][1]",
+            "obj[0]",
+            "arr.x",
+        ] {
+            let path = JsonPath::new(path);
+            let pattern = path.wildcard_indices();
+            let projected = JsonPath::value_filter(&map, |p, _| pattern.check_include_pattern(p));
+            assert_eq!(path.value_get(&projected), path.value_get(&map), "{path}");
+        }
+    }
+
     #[test]
     fn test_check_exclude_pattern() {
         assert!(JsonPath::new("a.b.c").check_exclude_pattern(&JsonPath::new("a.b.c")));
```

**File**: `lib/shard/src/grouping/driver.rs` (modified, +34/-1)
```diff
@@ -216,7 +216,7 @@ mod tests {
     use common::types::ScoreType;
     use segment::data_types::groups::GroupId;
     use segment::payload_json;
-    use segment::types::{WithPayloadInterface, WithVector};
+    use segment::types::{WithPayload, WithPayloadInterface, WithVector};
 
     use super::*;
 
@@ -359,4 +359,37 @@ mod tests {
             assert!(driver.distill().is_empty());
         }
     }
+
+    #[test]
+    fn groups_by_array_index() {
+        let mut driver = GroupByDriver::new(
+            base_query(),
+            "arr[1].x".parse().unwrap(),
+            GROUPS,
+            1,
+            Some(Order::LargeBetter),
+            RequestBudget {
+                collect: 1,
+                fill: 0,
+            },
+        );
+        let request = driver.next_request().unwrap();
+
+        // project the payload as a shard would
+        let selector = WithPayload::from(request.with_payload)
+            .payload_selector
+            .unwrap();
+        let point = |id, score, x0, x1| ScoredPoint {
+            payload: Some(selector.process(payload_json! { "arr": [{ "x": x0 }, { "x": x1 }] })),
+            ..point(id, score, "")
+        };
+        driver.add_points(&[point(1, 2.0, "a", "b"), point(2, 1.0, "c", "d")]);
+
+        let keys: Vec<_> = driver
+            .distill()
+            .into_iter()
+            .map(|group| group.key)
+            .collect();
+        assert_eq!(keys, [GroupId::from("b"), GroupId::from("d")]);
+    }
 }
```

**File**: `lib/shard/src/grouping/mod.rs` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ impl Group {
 
 /// Make `group_by` field selector work with as `with_payload`.
 fn group_by_to_payload_selector(group_by: &JsonPath) -> WithPayloadInterface {
-    WithPayloadInterface::Fields(vec![group_by.strip_wildcard_suffix()])
+    WithPayloadInterface::Fields(vec![group_by.wildcard_indices()])
 }
 
 /// Merge an extra filter into an optional existing one.
```

---

### Incident Patch 3: `268576f4` (2026-10-02)
**Commit Message**: build(deps): bump urllib3 and pyjwt in /tests (#10912)

* build(deps): bump urllib3 from 2.7.0 to 2.8.0 in /tests

Bumps [urllib3](https://github.com/urllib3/urllib3) from 2.7.0 to 2.8.0.
- [Release notes](https://github.com/urllib3/urllib3/releases)
- [Changelog](https://github.com/urllib3/urllib3/blob/main/CHANGES.rst)
- [Commits](https://github.com/urllib3/urllib3/compare/2.7.0...2.8.0)

---
updated-dependencies:
- dependency-name: urllib3
  dependency-version: 2.8.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* build(deps): bump pyjwt from 2.13.0 to 2.15.0 in /tests

Bumps [pyjwt](https://github.com/jpadilla/pyjwt) from 2.13.0 to 2.15.0.
- [Release notes](https://github.com/jpadilla/pyjwt/releases)
- [Changelog](https://github.com/jpadilla/pyjwt/blob/master/CHANGELOG.rst)
- [Commits](https://github.com/jpadilla/pyjwt/compare/2.13.0...2.15.0)

---
updated-dependencies:
- dependency-name: pyjwt
  dependency-version: 2.15.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.nor

**File**: `tests/pyproject.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ dependencies = [
     "grpc-requests>=0.1,<0.2",
     "grpcio>=1.80,<2",
     "more-itertools>=10.8,<11",
-    "pyjwt>=2.13.0,<3",
+    "pyjwt>=2.15.0,<3",
     "jsons>=1.6.3,<2",
     "pytest>=8.4,<9",
     "pytest-timeout>=2.4,<3",
```

**File**: `tests/uv.lock` (modified, +7/-7)
```diff
@@ -1543,14 +1543,14 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.15.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423", size = 107515, upload-time = "2026-05-21T19:54:36.618Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/02/a5/5197bfd06417837ac079921c66fa6393f1dea3557272a263cebfef69e432/pyjwt-2.15.0.tar.gz", hash = "sha256:b11c5f9791d7bf51c2b39a81ed669f6b2dbbd669df2942f6c60167e9e3d1abe4", size = 120513, upload-time = "2026-09-23T16:56:00.689Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728", size = 31274, upload-time = "2026-05-21T19:54:35.362Z" },
+    { url = "https://files.pythonhosted.org/packages/e8/55/40e45bf052ee8ee12a4dfd785519660f8effa7b065442b91646ec6828619/pyjwt-2.15.0-py3-none-any.whl", hash = "sha256:7a3742debf6b879e912dbb9819ceec1594be812452b78c5f2e2dfc56564954f8", size = 33680, upload-time = "2026-09-23T16:55:59.241Z" },
 ]
 
 [[package]]
@@ -1784,7 +1784,7 @@ requires-dist = [
     { name = "grpcio", specifier = ">=1.80,<2" },
     { name = "jsons", specifier = ">=1.6.3,<2" },
     { name = "more-itertools", specifier = ">=10.8,<11" },
-    { name = "pyjwt", specifier = ">=2.13.0,<3" },
+    { name = "pyjwt", specifier = ">=2.15.0,<3" },
     { name = "pytest", specifier = ">=8.4,<9" },
     { name = "pytest-cases", specifier = ">=3.9.1,<4" },
     { name = "pytest-subtests", specifier = ">=0.14.1,<0.15" },
@@ -2182,11 +2182,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 4: `6c037938` (2026-10-01)
**Commit Message**: Fix merge and search with an empty multivector placeholder (#10870)

* Support empty multivector placeholder in merge and search

A named multivector added to an existing segment is backed by an
EmptyDense placeholder that carries a multivector config. Merging it
into a multi-dense target failed with "source is not a f32 multi-dense
storage", and a multivector query against it failed with a multi/regular
conversion error.

Read it as one zero inner vector per deleted slot when merging, and
score multivector queries through a multi-dense view of the placeholder.

Fixes #10857

* Cover uint8 and float16 placeholders in merge, tidy multivector view

Read an EmptyDense placeholder as zeros in the dense uint8/float16 and
multi uint8/float16 merge readers too, not only float32. Turbo readers
are left out: their record size comes from the target's quantizer.

Make the multivector view expect a multivector config instead of
inventing MaxSim, score the placeholder in the raw scorer test, and
move test imports to module level.

* Support empty Turbo4 placeholder in merge

A named Turbo4 vector added to an existing segment is backed by an
EmptyDense placeholder. Merging it into a turbo target

**File**: `lib/segment/src/segment_constructor/batched_reader.rs` (modified, +113/-5)
```diff
@@ -11,8 +11,11 @@ use sparse::common::sparse_vector::SparseVector;
 
 use crate::common::operation_error::{OperationError, OperationResult};
 use crate::data_types::named_vectors::CowMultiVector;
-use crate::data_types::vectors::{VectorElementType, VectorElementTypeByte, VectorElementTypeHalf};
+use crate::data_types::vectors::{
+    TypedMultiDenseVector, VectorElementType, VectorElementTypeByte, VectorElementTypeHalf,
+};
 use crate::types::CompactExtendedPointId;
+use crate::vector_storage::turbo::shared::quantized_vector_size;
 use crate::vector_storage::{
     DenseTQVectorStorage, DenseTQVectorStorageRead, DenseVectorStorage, DenseVectorStorageRead,
     MultiTQVectorStorage, MultiTQVectorStorageRead, MultiVectorStorage, MultiVectorStorageRead,
@@ -414,6 +417,11 @@ fn read_dense_byte(
         #[cfg(target_os = "linux")]
         VectorStorageEnum::DenseUringByte(v) => v.get_dense::<Sequential>(key),
         VectorStorageEnum::DenseAppendableMemmapByte(v) => v.get_dense::<Sequential>(key),
+        // Placeholder for a vector added to an existing segment: every slot is
+        // deleted, but the destination still needs one zero vector per slot.
+        VectorStorageEnum::EmptyDense(v) => {
+            Cow::Owned(vec![0; DenseVectorStorageRead::vector_dim(v)])
+        }
         VectorStorageEnum::DenseVolatile(_)
         | VectorStorageEnum::DenseMemmap(_)
         | VectorStorageEnum::DenseGraphInline(_)
@@ -430,7 +438,6 @@ fn read_dense_byte(
         | VectorStorageEnum::DenseTurboMemmap(_)
         | VectorStorageEnum::DenseTurboGraphInline(_)
         | VectorStorageEnum::DenseTurboAppendableMemmap(_)
-        | VectorStorageEnum::EmptyDense(_)
         | VectorStorageEnum::MultiDenseTurbo(_)
         | VectorStorageEnum::EmptySparse(_) => {
             return Err(OperationError::service_error(
@@ -470,6 +477,12 @@ fn read_dense_half(
         #[cfg(target_os = "linux")]
         VectorStorageEnum::DenseUringHalf(v) => v.get_dense::<Sequential>(key),
         VectorStorageEnum::DenseAppendableMemmapHalf(v) => v.get_dense::<Sequential>(key),
+        // Placeholder for a vector added to an existing segment: every slot is
+        // deleted, but the destination still needs one zero vector per slot.
+        VectorStorageEnum::EmptyDense(v) => Cow::Owned(vec![
+            VectorElementTypeHalf::ZERO;
+            DenseVectorStorageRead::vector_dim(v)
+        ]),
         VectorStorageEnum::DenseVolatile(_)
         | VectorStorageEnum::DenseMemmap(_)
         | VectorStorageEnum::DenseGraphInline(_)
@@ -486,7 +499,6 @@ fn read_dense_half(
         | VectorStorageEnum::DenseTurboMemmap(_)
         | VectorStorageEnum::DenseTurboGraphInline(_)
         | VectorStorageEnum::DenseTurboAppendableMemmap(_)
-        | VectorStorageEnum::EmptyDense(_)
         | VectorStorageEnum::MultiDenseTurbo(_)
         | VectorStorageEnum::EmptySparse(_) => {
             return Err(OperationError::service_error(
@@ -524,6 +536,14 @@ fn read_dense_tq(
         #[cfg(target_os = "linux")]
         VectorStorageEnum::DenseTurboUring(v) => v.get_dense_tq::<Sequential>(key),
         VectorStorageEnum::DenseTurboAppendableMemmap(v) => v.get_dense_tq::<Sequential>(key),
+        // Placeholder for a vector added to an existing segment: every slot is
+        // deleted, but the destination still needs one zero record per slot.
+        // The record size depends only on dim and distance, which the
+        // placeholder shares with the destination.
+        VectorStorageEnum::EmptyDense(v) => {
+            let size = quantized_vector_size(DenseVectorStorageRead::vector_dim(v), v.distance());
+            Cow::Owned(vec![0; size])
+        }
         VectorStorageEnum::DenseVolatile(_)
         | VectorStorageEnum::DenseMemmap(_)
         | VectorStorageEnum::DenseMemmapByte(_)
@@ -540,7 +560,6 @@ fn read_dense_tq(
         | VectorStorageEnum::MultiDenseAppendableMemmap(_)
         | VectorStorageEnum::MultiDenseAppendableMemmapByte(_)
         | VectorStorageEnum::MultiDenseAppendableMemmapHalf(_)
-        | VectorStorageEnum::EmptyDense(_)
         | VectorStorageEnum::MultiDenseTurbo(_)
         | VectorStorageEnum::EmptySparse(_) => {
             return Err(OperationError::service_error(
@@ -575,6 +594,12 @@ fn read_multi_tq(
     let deleted = source.is_deleted_vector(key);
     let vector = match source {
         VectorStorageEnum::MultiDenseTurbo(v) => v.get_multi_tq::<Sequential>(key),
+        // Named multivector added to an existing segment: all slots are deleted,
+        // but the destination still needs one zero inner record per slot.
+        VectorStorageEnum::EmptyDense(v) if v.multi_vector_config().is_some() => {
+            let size = quantized_vector_size(DenseVectorStorageRead::vector_dim(v), v.distance());
+            Cow::Owned(vec![0; size])
+        }
         VectorStorageEnum::DenseVolatile(_)
         | VectorStorageEnum::DenseMemmap(_)
         | VectorStorageEnum::DenseMemma
```

**File**: `lib/segment/src/vector_storage/dense/empty_dense_vector_storage.rs` (modified, +85/-5)
```diff
@@ -11,12 +11,15 @@ use common::universal_io::UserData;
 
 use crate::common::Flusher;
 use crate::common::operation_error::{OperationError, OperationResult};
-use crate::data_types::named_vectors::CowVector;
-use crate::data_types::vectors::{VectorElementType, VectorRef};
+use crate::data_types::named_vectors::{CowMultiVector, CowVector};
+use crate::data_types::vectors::{
+    TypedMultiDenseVector, TypedMultiDenseVectorRef, VectorElementType, VectorRef,
+};
 use crate::types::{Distance, MultiVectorConfig, VectorStorageDatatype};
 use crate::vector_storage::{
-    DenseVectorStorage, DenseVectorStorageRead, VectorStorage, VectorStorageEnum,
-    VectorStorageRead, default_for_each_in_dense_batch, default_read_vector_bytes_impl,
+    DenseVectorStorage, DenseVectorStorageRead, MultiVectorStorageRead, VectorStorage,
+    VectorStorageEnum, VectorStorageRead, default_for_each_in_dense_batch,
+    default_read_vector_bytes_impl,
 };
 
 /// Placeholder vector storage that contains no data.
@@ -120,6 +123,52 @@ impl DenseVectorStorage<VectorElementType> for EmptyDenseVectorStorage {
     }
 }
 
+/// Multivector view of the placeholder, used when it was created with a
+/// multivector config. Every slot is deleted and holds one zero inner vector,
+/// so scoring stays well-defined and the results are discarded as deleted.
+impl MultiVectorStorageRead<VectorElementType> for EmptyDenseVectorStorage {
+    fn vector_dim(&self) -> usize {
+        self.dim
+    }
+
+    fn get_multi<P: AccessPattern>(
+        &self,
+        _key: PointOffsetType,
+    ) -> CowMultiVector<'_, VectorElementType> {
+        CowMultiVector::Owned(TypedMultiDenseVector::placeholder(self.dim))
+    }
+
+    fn get_multi_opt<P: AccessPattern>(
+        &self,
+        key: PointOffsetType,
+    ) -> Option<CowMultiVector<'_, VectorElementType>> {
+        ((key as usize) < self.num_points).then(|| self.get_multi::<P>(key))
+    }
+
+    fn for_each_in_batch_multi<F>(&self, keys: &[PointOffsetType], mut callback: F)
+    where
+        F: FnMut(usize, TypedMultiDenseVectorRef<'_, VectorElementType>),
+    {
+        let zeros = vec![0.0; self.dim];
+        for idx in 0..keys.len() {
+            callback(idx, TypedMultiDenseVectorRef::new(&zeros, self.dim));
+        }
+    }
+
+    fn iterate_inner_vectors(
+        &self,
+    ) -> impl Iterator<Item = Cow<'_, [VectorElementType]>> + Clone + Send {
+        // All vectors are deleted, so there are no inner vectors to report.
+        std::iter::empty()
+    }
+
+    fn multi_vector_config(&self) -> &MultiVectorConfig {
+        self.multi_vector_config
+            .as_ref()
+            .expect("multivector view requires the placeholder to have a multivector config")
+    }
+}
+
 impl VectorStorageRead for EmptyDenseVectorStorage {
     fn size_of_available_vectors_in_bytes(&self) -> usize {
         // All vectors are deleted, so there are no available vectors.
@@ -202,6 +251,9 @@ mod tests {
     use common::generic_consts::Random;
 
     use super::*;
+    use crate::data_types::vectors::{MultiDenseVectorInternal, QueryVector, VectorInternal};
+    use crate::types::MultiVectorComparator;
+    use crate::vector_storage::raw_scorer::new_raw_scorer;
 
     #[test]
     fn test_empty_dense_basic_contract() {
@@ -223,7 +275,7 @@ mod tests {
         assert_eq!(storage.deleted_vector_bitslice().len(), 1000);
         assert!(storage.is_deleted_vector(0));
         assert!(storage.is_deleted_vector(999));
-        assert_eq!(storage.vector_dim(), 128);
+        assert_eq!(DenseVectorStorageRead::vector_dim(&storage), 128);
         assert!(storage.files().is_empty());
         assert!(storage.multi_vector_config().is_none());
 
@@ -322,4 +374,32 @@ mod tests {
         // delete_vector returns false because it was already deleted
         assert!(!storage.delete_vector(0).unwrap());
     }
+
+    /// Searching a multivector added to an already-indexed segment (backed by this
+    /// placeholder) must not fail with a multi/regular conversion error.
+    #[test]
+    fn test_empty_dense_multi_vector_raw_scorer() {
+        let multi_cfg = MultiVectorConfig {
+            comparator: MultiVectorComparator::MaxSim,
+        };
+        let storage = new_empty_dense_vector_storage(
+            4,
+            Distance::Cosine,
+            VectorStorageDatatype::Float32,
+            false,
+            Some(multi_cfg),
+            3,
+        );
+        let query = QueryVector::Nearest(VectorInternal::MultiDense(
+            MultiDenseVectorInternal::new(vec![1.0; 8], 4),
+        ));
+
+        let scorer = new_raw_scorer(query, &storage, HardwareCounterCell::disposable())
+            .expect("multivector query on an empty placeholder must not fail");
+
+        // Slots are deleted zero placeholders: scoring them must not panic.
+        let mut scores = [0.0; 3];
+        scorer.score_points(&[0, 1, 2], &mut scores);
+        assert!(scores.iter().all(|score| score.is_finite()));
+ 
```

**File**: `lib/segment/src/vector_storage/raw_scorer.rs` (modified, +8/-2)
```diff
@@ -19,7 +19,7 @@ use super::{
 use crate::common::operation_error::{OperationError, OperationResult};
 use crate::data_types::primitive::PrimitiveVectorElement;
 use crate::data_types::vectors::{
-    DenseVector, MultiDenseVectorInternal, QueryVector, VectorInternal,
+    DenseVector, MultiDenseVectorInternal, QueryVector, VectorElementType, VectorInternal,
 };
 use crate::spaces::metric::Metric;
 use crate::spaces::simple::{CosineMetric, DotProductMetric, EuclidMetric, ManhattanMetric};
@@ -114,7 +114,13 @@ pub fn new_raw_scorer<'a>(
         VectorStorageEnum::MultiDenseTurbo(vs) => {
             raw_turbo_multi_scorer_impl(query, vs.as_ref(), hc)
         }
-        VectorStorageEnum::EmptyDense(vs) => raw_scorer_impl(query, vs, hc),
+        VectorStorageEnum::EmptyDense(vs) => {
+            if vs.multi_vector_config().is_some() {
+                raw_multi_scorer_impl::<VectorElementType, _>(query, vs, hc)
+            } else {
+                raw_scorer_impl(query, vs, hc)
+            }
+        }
         VectorStorageEnum::EmptySparse(vs) => raw_sparse_scorer_impl(query, vs, hc),
     }
 }
```

**File**: `lib/segment/src/vector_storage/turbo/shared.rs` (modified, +44/-0)
```diff
@@ -44,6 +44,24 @@ pub(super) fn build_quantizer(dim: usize, distance: Distance) -> TurboQuantizer
     )
 }
 
+/// Size in bytes of one encoded vector of a dense `Turbo4` storage, or of one
+/// inner vector of a multivector one. Equal to
+/// `build_quantizer(dim, distance).quantized_size()`, without building the
+/// rotation tables, so it is cheap enough to call per point.
+pub(crate) fn quantized_vector_size(dim: usize, distance: Distance) -> usize {
+    let vector_parameters = quantization::VectorParameters {
+        dim,
+        distance_type: quantization::DistanceType::from(distance),
+        invert: false,
+        deprecated_count: None,
+    };
+    quantization::encoded_vectors_tq::get_quantized_vector_size(
+        &vector_parameters,
+        TQDT_BITS,
+        TQDT_MODE,
+    )
+}
+
 /// Quantize then dequantize `vector` exactly as a dense TQ storage with this
 /// `distance` does across `insert_vector` + `get_vector`. Pure function of its inputs:
 /// the quantizer is fully determined by `(dim, distance)` (the rotation derives from
@@ -197,3 +215,29 @@ pub(super) fn dequantize_for_requantization(
             .collect()
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    /// The cheap size helper must match the record size of the quantizer every
+    /// TQ storage builds, or merged placeholders would misalign records.
+    #[test]
+    fn quantized_vector_size_matches_quantizer() {
+        let distances = [
+            Distance::Cosine,
+            Distance::Euclid,
+            Distance::Dot,
+            Distance::Manhattan,
+        ];
+        for distance in distances {
+            for dim in [1, 4, 5, 127, 256, 1023] {
+                assert_eq!(
+                    quantized_vector_size(dim, distance),
+                    build_quantizer(dim, distance).quantized_size(),
+                    "dim {dim}, distance {distance:?}",
+                );
+            }
+        }
+    }
+}
```

**File**: `lib/segment/src/vector_storage/vector_storage_base.rs` (modified, +3/-1)
```diff
@@ -843,7 +843,9 @@ impl VectorStorageEnum {
             VectorStorageEnum::MultiDenseTurbo(v) => {
                 VectorInternal::from(MultiDenseVectorInternal::placeholder(v.vector_dim()))
             }
-            VectorStorageEnum::EmptyDense(v) => VectorInternal::from(vec![1.0; v.vector_dim()]),
+            VectorStorageEnum::EmptyDense(v) => {
+                VectorInternal::from(vec![1.0; DenseVectorStorageRead::vector_dim(v)])
+            }
             VectorStorageEnum::EmptySparse(_) => VectorInternal::from(SparseVector::default()),
         }
     }
```

---

### Incident Patch 5: `41913338` (2026-10-01)
**Commit Message**: ci: fix windows linker placement (#10882)

**File**: `.github/workflows/rust.yml` (modified, +9/-8)
```diff
@@ -65,14 +65,7 @@ jobs:
     - name: Install minimal stable
       uses: dtolnay/rust-toolchain@631a55b12751854ce901bb631d5902ceb48146f7 # stable
     - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-    - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2
-      with:
-        # Only save the cache on dev; feature-branch caches would just get evicted under the 10 GB budget
-        save-if: ${{ github.ref == 'refs/heads/dev' }}
-    - name: Install Protoc
-      uses: ./.github/actions/setup-protoc
-    - name: Install mold
-      uses: rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621 # v1
+    # Before rust-cache, so the linker config and CARGO_PROFILE_DEV_DEBUG are part of the cache key
     - name: Configure linker (mold on Linux, rust-lld on Windows)
       run: |
         if [[ "${{ matrix.os }}" == "ubuntu-latest" ]]; then
@@ -89,6 +82,14 @@ jobs:
           echo "CARGO_PROFILE_DEV_DEBUG=0" >> "$GITHUB_ENV"
         fi
       shell: bash
+    - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2
+      with:
+        # Only save the cache on dev; feature-branch caches would just get evicted under the 10 GB budget
+        save-if: ${{ github.ref == 'refs/heads/dev' }}
+    - name: Install Protoc
+      uses: ./.github/actions/setup-protoc
+    - name: Install mold
+      uses: rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621 # v1
     - name: Install nextest
       uses: taiki-e/install-action@3a0adc33ab45d7b9b9da91822dd2b3c0151704be # nextest
     - name: Build
```

---

### Incident Patch 6: `39f9d227` (2026-10-01)
**Commit Message**: Fix clippy lints for Rust 1.99 and beta (#10883)

* Bump pyo3 to 0.29.3 to fix beta clippy clone_on_copy

Clippy beta (1.100) reports clone_on_copy inside the code pyo3 0.29.2
generates for `#[pyclass(from_py_object)]` on Copy types, failing
`cargo +beta clippy --all-features -D warnings` with 30 errors in
qdrant-edge-py. pyo3 0.29.3 no longer emits the clone.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Iterate links_layers directly in test_add_points

Clippy beta (1.100) flags needless_range_loop on the index loop over
links_layers in test_add_points. Iterate with enumerate() instead; the
index is still needed to read the original graph's links.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Pass convert closure by value in edge ffi filter conversion

Clippy 1.99 flags needless_borrows_for_generic_args on `.map(&convert)`.
The closure only captures `depth`, so it is Copy and can be passed by
value to each Option::map call.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +14/-14)
```diff
@@ -5748,7 +5748,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "22505a5c94da8e3b7c2996394d1c933236c4d743e81a410bcca4e6989fc066a4"
 dependencies = [
  "bytes",
- "heck 0.5.0",
+ "heck 0.4.1",
  "itertools 0.12.1",
  "log",
  "multimap",
@@ -5768,7 +5768,7 @@ version = "0.14.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "03da047801ff44bb6a4d407d4860c05fd70bb81714e6b2f3812603d5b145b042"
 dependencies = [
- "heck 0.5.0",
+ "heck 0.4.1",
  "itertools 0.14.0",
  "log",
  "multimap",
@@ -5870,7 +5870,7 @@ version = "0.7.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "cb5cd191fad9142d096efc97c64715db73db4adb60c38ebdf22f5b54cd6ea712"
 dependencies = [
- "heck 0.5.0",
+ "heck 0.4.1",
  "prost 0.14.4",
  "prost-build 0.14.4",
  "prost-types 0.14.4",
@@ -5954,9 +5954,9 @@ dependencies = [
 
 [[package]]
 name = "pyo3"
-version = "0.29.2"
+version = "0.29.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4688ddedf473e32662b9b067670129a8afb8c18e351482c70d62ba4a88171e8b"
+checksum = "700d18fa267b73b9b521fd7e13580e2f446916f176cacee1ab63fcc8191f1655"
 dependencies = [
  "libc",
  "once_cell",
@@ -5969,28 +5969,28 @@ dependencies = [
 
 [[package]]
 name = "pyo3-build-config"
-version = "0.29.2"
+version = "0.29.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f41027e41b4bd03f6e60f9f417fe24a6341a6bb744edd62b6f709f2a52ea30e9"
+checksum = "7b3fc0c4d08f6bb10e71fe39dfb9e2f59c6eb6854e22ec8092f50c69a4499adb"
 dependencies = [
  "target-lexicon",
 ]
 
 [[package]]
 name = "pyo3-ffi"
-version = "0.29.2"
+version = "0.29.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e591a95526fead067432c3b3a33fc74770b87b1e04e73671090d9c2055a2b327"
+checksum = "dfc0b8e19df29aad7086cf977bb0c2a2f143e30567eb113e9cf72b62ca698330"
 dependencies = [
  "libc",
  "pyo3-build-config",
 ]
 
 [[package]]
 name = "pyo3-macros"
-version = "0.29.2"
+version = "0.29.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "73225868fc1cd84eef2c3c230ddb91273bf1de46aeb8a4248da76d32a0924a1c"
+checksum = "6100e8a4b5eba53afaa5ed078364851a0b2499c553a44c31026b929049b49dc6"
 dependencies = [
  "proc-macro2",
  "pyo3-macros-backend",
@@ -6000,9 +6000,9 @@ dependencies = [
 
 [[package]]
 name = "pyo3-macros-backend"
-version = "0.29.2"
+version = "0.29.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "571575aa3749fa6216757dd47d2a3e7ef360f329a40f0666a9fbd14889024952"
+checksum = "6143877a16e82b5a727b7127ff4cd86858a24a28d745d72f43e6f227c7b1bdb3"
 dependencies = [
  "heck 0.5.0",
  "proc-macro2",
@@ -8060,7 +8060,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd"
 dependencies = [
  "fastrand",
- "getrandom 0.4.2",
+ "getrandom 0.3.4",
  "once_cell",
  "rustix 1.1.5",
  "windows-sys 0.61.2",
```

**File**: `lib/edge/ffi/src/filter.rs` (modified, +3/-3)
```diff
@@ -719,9 +719,9 @@ fn filter_to_segment(f: Filter, depth: u32) -> Result<SegmentFilter, crate::erro
             .collect::<Result<Vec<_>, _>>()
     };
     Ok(SegmentFilter {
-        must: must.map(&convert).transpose()?,
-        should: should.map(&convert).transpose()?,
-        must_not: must_not.map(&convert).transpose()?,
+        must: must.map(convert).transpose()?,
+        should: should.map(convert).transpose()?,
+        must_not: must_not.map(convert).transpose()?,
         min_should: min_should
             .map(
                 |MinShould {
```

**File**: `lib/segment/src/index/hnsw_index/graph_layers_builder.rs` (modified, +2/-2)
```diff
@@ -852,12 +852,12 @@ mod tests {
 
         assert_eq!(orig_len, builder_len);
 
-        for idx in 0..builder_len {
+        for (idx, layers) in graph_layers_builder.links_layers.iter().enumerate() {
             let links_orig = &graph_layers_orig
                 .links
                 .links(idx as PointOffsetType, 0)
                 .collect_vec();
-            let links_builder = graph_layers_builder.links_layers[idx][0].read();
+            let links_builder = layers[0].read();
             let link_container_from_builder = links_builder.links().to_vec();
             let m = match format {
                 GraphLinksFormat::Plain => 0,
```

---

### Incident Patch 7: `4ea96658` (2026-10-01)
**Commit Message**: Fix stale open_mmap doc link in ReadOnlyEdgeShard

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `lib/edge/src/read_only/mod.rs` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ use crate::read_only::holder::ReadOnlySegmentHolder;
 ///
 /// Generic over the read backend `S` (e.g. `MmapFile` for local memory-mapped files; the same
 /// abstraction `ReadOnlySegment` uses, so blob/S3 backends are possible). Use
-/// [`open_mmap`](ReadOnlyEdgeShard::open_mmap) for the common local case.
+/// [`open`](ReadOnlyEdgeShard::open) for the common local case.
 pub struct ReadOnlyEdgeShard<S: UniversalReadExt + 'static> {
     path: PathBuf,
     /// Read backend handle; passed to segment `open` and `live_reload`.
```

---

### Incident Patch 8: `12b7f54d` (2026-10-01)
**Commit Message**: Fix loading mutable payload index on torn write (#10812)

* Add test to simulate torn write on Gridstore mapping

* Assume pointers with length zero don't exist

* Fix existing tests using 0-length pointers

* Add two more tests

* Check at runtime whether pages exist

* Propagate Gridstore deserialization errors

* Mutable indices can error, propagate such error and allow index rebuild

* Add test asserting corrupt mutable payload index is rebuilt

* Apply batched suggestions from code review

Co-authored-by: Roman Titov <[REDACTED_EMAIL]>

* Add missing import

* On page range not found error, show range in error message

---------

Co-authored-by: Roman Titov <[REDACTED_EMAIL]>

**File**: `lib/blobstore/src/blob.rs` (modified, +35/-21)
```diff
@@ -1,18 +1,24 @@
 use zerocopy::{FromBytes, Immutable, IntoBytes};
 
-pub trait Blob {
+use crate::Result;
+use crate::error::BlobstoreError;
+
+pub trait Blob: Sized {
     fn to_bytes(&self) -> Vec<u8>;
 
-    fn from_bytes(bytes: &[u8]) -> Self;
+    /// Decode a value from its bytes.
+    ///
+    /// Stored bytes may be corrupt, so this must return an error rather than panic.
+    fn from_bytes(bytes: &[u8]) -> Result<Self>;
 }
 
 impl Blob for Vec<u8> {
     fn to_bytes(&self) -> Vec<u8> {
         self.clone()
     }
 
-    fn from_bytes(bytes: &[u8]) -> Self {
-        bytes.to_vec()
+    fn from_bytes(bytes: &[u8]) -> Result<Self> {
+        Ok(bytes.to_vec())
     }
 }
 
@@ -21,8 +27,12 @@ impl Blob for Vec<ecow::EcoString> {
         serde_cbor::to_vec(self).expect("Failed to serialize Vec<ecow::EcoString>")
     }
 
-    fn from_bytes(bytes: &[u8]) -> Self {
-        serde_cbor::from_slice(bytes).expect("Failed to deserialize Vec<ecow::EcoString>")
+    fn from_bytes(bytes: &[u8]) -> Result<Self> {
+        serde_cbor::from_slice(bytes).map_err(|err| {
+            BlobstoreError::decode_error(format!(
+                "Failed to deserialize Vec<ecow::EcoString>: {err}"
+            ))
+        })
     }
 }
 
@@ -33,12 +43,14 @@ impl Blob for Vec<(f64, f64)> {
             .collect()
     }
 
-    fn from_bytes(bytes: &[u8]) -> Self {
-        assert!(
-            bytes.len().is_multiple_of(size_of::<f64>() * 2),
-            "unexpected number of bytes for Vec<(f64, f64)>",
-        );
-        bytes
+    fn from_bytes(bytes: &[u8]) -> Result<Self> {
+        if !bytes.len().is_multiple_of(size_of::<f64>() * 2) {
+            return Err(BlobstoreError::decode_error(format!(
+                "unexpected number of bytes for Vec<(f64, f64)>: {}",
+                bytes.len(),
+            )));
+        }
+        Ok(bytes
             .chunks(size_of::<f64>() * 2)
             .map(|v| {
                 let (a, b) = v.split_at(size_of::<f64>());
@@ -47,7 +59,7 @@ impl Blob for Vec<(f64, f64)> {
                     f64::read_from_bytes(b).expect("invalid number of bytes for type f64"),
                 )
             })
-            .collect()
+            .collect())
     }
 }
 
@@ -64,16 +76,18 @@ macro_rules! impl_blob_vec_zerocopy {
                     .collect()
             }
 
-            fn from_bytes(bytes: &[u8]) -> Self {
-                assert!(
-                    bytes.len().is_multiple_of(size_of::<$type>()),
-                    "unexpected number of bytes for Vec<{}>",
-                    stringify!($type),
-                );
-                bytes
+            fn from_bytes(bytes: &[u8]) -> Result<Self> {
+                if !bytes.len().is_multiple_of(size_of::<$type>()) {
+                    return Err(BlobstoreError::decode_error(format!(
+                        "unexpected number of bytes for Vec<{}>: {}",
+                        stringify!($type),
+                        bytes.len(),
+                    )));
+                }
+                Ok(bytes
                     .chunks(size_of::<$type>())
                     .map(|v| <$type>::read_from_bytes(v).expect("invalid chunk size for type T"))
-                    .collect()
+                    .collect())
             }
         }
     };
```

**File**: `lib/blobstore/src/blobstore/gridstore/mod.rs` (modified, +2/-2)
```diff
@@ -386,8 +386,8 @@ where
 
         self.with_view(|view| {
             let raw = view.read_from_pages::<Random>(pointer)?;
-            let decompressed = view.decompress(raw);
-            let value = V::from_bytes(&decompressed);
+            let decompressed = view.decompress(raw)?;
+            let value = V::from_bytes(&decompressed)?;
             Ok(Some(value))
         })
     }
```

**File**: `lib/blobstore/src/blobstore/gridstore/pages.rs` (modified, +31/-4)
```diff
@@ -1,5 +1,6 @@
 use std::borrow::Cow;
 use std::cell::RefCell;
+use std::cmp;
 use std::mem::MaybeUninit;
 use std::path::{Path, PathBuf};
 
@@ -246,11 +247,32 @@ impl<S: UniversalRead> Pages<S> {
         pages as usize
     }
 
+    /// Check that the value at `pointer` does not reach past the last page.
+    ///
+    /// A corrupt pointer, for example with a bit flip in its length, may span pages that don't
+    /// exist. Reading it must return an error rather than index out of bounds.
+    fn check_pages_exist(&self, pointer: ValuePointer, config: &GridstoreConfig) -> Result<()> {
+        // A pointer always covers its first page, even with a zero length
+        let need_pages = cmp::max(Self::value_len_pages(pointer, config), 1) as u64;
+        let available_pages = self.pages.len();
+
+        if u64::from(pointer.page_id).saturating_add(need_pages) > available_pages as u64 {
+            return Err(BlobstoreError::PageRangeNotFound {
+                page_ids: pointer.page_id..pointer.page_id + need_pages as u32,
+                available_pages,
+            });
+        }
+
+        Ok(())
+    }
+
     pub fn read_from_pages<P: AccessPattern>(
         &self,
         pointer: ValuePointer,
         config: &GridstoreConfig,
     ) -> Result<Cow<'_, [u8]>> {
+        self.check_pages_exist(pointer, config)?;
+
         let mut reads = Self::get_page_value_ranges(pointer, config)
             .map(|(buf_offset, page, range)| (buf_offset, &self.pages[page as usize], range));
 
@@ -326,6 +348,10 @@ impl<S: UniversalRead> Pages<S> {
         let mut reads = pointers
             .enumerate()
             .flat_map(|(value_idx, (user_data, pointer))| {
+                if let Err(err) = self.check_pages_exist(pointer, config) {
+                    return Either::Left(std::iter::once(Err(err)));
+                }
+
                 let ranges = Self::get_page_value_ranges(pointer, config);
 
                 let bytes_len = pointer.length as usize;
@@ -347,16 +373,16 @@ impl<S: UniversalRead> Pages<S> {
                     None
                 };
 
-                ranges.map(move |(buffer_offset, page_idx, range)| {
+                Either::Right(ranges.map(move |(buffer_offset, page_idx, range)| {
                     let meta = ReadMeta {
                         value_idx,
                         buffer_offset,
                         user_data: user_data.take(),
                     };
 
                     let page = &self.pages[page_idx as usize];
-                    (meta, page, range)
-                })
+                    Ok((meta, page, range))
+                }))
             });
 
         // Drive the read pipeline directly: refill it from `reads` whenever it can
@@ -367,8 +393,9 @@ impl<S: UniversalRead> Pages<S> {
 
         loop {
             while pipeline.can_schedule()
-                && let Some((meta, page, range)) = reads.next()
+                && let Some(read) = reads.next()
             {
+                let (meta, page, range) = read?;
                 let range = range.into_byte_range::<u8>();
                 pipeline
                     .schedule::<P>(meta, page, range, align_of::<u8>())
```

**File**: `lib/blobstore/src/blobstore/gridstore/view.rs` (modified, +6/-5)
```diff
@@ -67,7 +67,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> GridstoreView<'a, V, S, T> {
         self.config.compression.compress(value)
     }
 
-    pub(super) fn decompress<'val>(&self, value: Cow<'val, [u8]>) -> Cow<'val, [u8]> {
+    pub(super) fn decompress<'val>(&self, value: Cow<'val, [u8]>) -> Result<Cow<'val, [u8]>> {
         self.config.compression.decompress(value)
     }
 
@@ -78,7 +78,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> GridstoreView<'a, V, S, T> {
         hw_counter: &HardwareCounterCell,
     ) -> Result<Option<V>> {
         let bytes = self.get_value_bytes::<P>(point_offset, hw_counter)?;
-        Ok(bytes.map(|bytes| V::from_bytes(&bytes)))
+        bytes.map(|bytes| V::from_bytes(&bytes)).transpose()
     }
 
     /// Get the serialized value for a given point offset.
@@ -96,7 +96,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> GridstoreView<'a, V, S, T> {
         let raw = self.read_from_pages::<P>(pointer)?;
         hw_counter.payload_io_read_counter().incr_delta(raw.len());
 
-        Ok(Some(self.decompress(raw)))
+        Ok(Some(self.decompress(raw)?))
     }
 
     pub fn read_values<P, U, E>(
@@ -113,7 +113,8 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> GridstoreView<'a, V, S, T> {
         self.read_values_bytes::<P, _, _>(
             point_offsets,
             |user_data, point_offset, bytes| {
-                callback(user_data, point_offset, bytes.map(V::from_bytes))
+                let value = bytes.map(V::from_bytes).transpose()?;
+                callback(user_data, point_offset, value)
             },
             hw_counter_cell,
         )
@@ -157,7 +158,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> GridstoreView<'a, V, S, T> {
             |(user_data, point_offset), bytes| {
                 hw_counter_cell.incr_delta(bytes.len());
 
-                let decompressed = self.decompress(bytes);
+                let decompressed = self.decompress(bytes)?;
                 callback(user_data, point_offset, Some(&decompressed))
             },
         )
```

**File**: `lib/blobstore/src/blobstore/logstore/view.rs` (modified, +7/-6)
```diff
@@ -67,7 +67,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> LogstoreView<'a, V, S, T> {
         hw_counter: &HardwareCounterCell,
     ) -> Result<Option<V>> {
         let bytes = self.get_value_bytes::<P>(point_offset, hw_counter)?;
-        Ok(bytes.map(|bytes| V::from_bytes(&bytes)))
+        bytes.map(|bytes| V::from_bytes(&bytes)).transpose()
     }
 
     /// Get the serialized value for a given point offset.
@@ -85,7 +85,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> LogstoreView<'a, V, S, T> {
         let raw = self.read_from_pages::<P>(pointer)?;
         hw_counter.payload_io_read_counter().incr_delta(raw.len());
 
-        Ok(Some(self.config.compression.decompress(raw)))
+        Ok(Some(self.config.compression.decompress(raw)?))
     }
 
     /// Iterate over all given values and execute callback for each one.
@@ -109,7 +109,8 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> LogstoreView<'a, V, S, T> {
         self.read_values_bytes::<P, _, _>(
             point_offsets,
             |user_data, point_offset, bytes| {
-                callback(user_data, point_offset, bytes.map(V::from_bytes))
+                let value = bytes.map(V::from_bytes).transpose()?;
+                callback(user_data, point_offset, value)
             },
             hw_counter_cell,
         )
@@ -152,7 +153,7 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> LogstoreView<'a, V, S, T> {
             |(user_data, point_offset), bytes| {
                 hw_counter_cell.incr_delta(bytes.len());
 
-                let decompressed = self.config.compression.decompress(bytes);
+                let decompressed = self.config.compression.decompress(bytes)?;
                 callback(user_data, point_offset, Some(&decompressed))
             },
         )
@@ -196,8 +197,8 @@ impl<'a, V: Blob, S: UniversalRead, T: TrackerRead> LogstoreView<'a, V, S, T> {
             .read_batch_values::<Sequential, _, _>(pointers, |point_offset, bytes| {
                 hw_counter.incr_delta(bytes.len());
 
-                let decompressed = self.config.compression.decompress(bytes);
-                let value = V::from_bytes(&decompressed);
+                let decompressed = self.config.compression.decompress(bytes)?;
+                let value = V::from_bytes(&decompressed)?;
 
                 callback(point_offset, value)
             })
```

**File**: `lib/blobstore/src/blobstore/tests.rs` (modified, +185/-3)
```diff
@@ -14,7 +14,7 @@ use rand::prelude::Distribution;
 use rand::seq::SliceRandom;
 use rand::{Rng, RngExt};
 use rstest::rstest;
-use tempfile::Builder;
+use tempfile::{Builder, TempDir};
 
 use super::*;
 use crate::blob::Blob;
@@ -1069,8 +1069,8 @@ fn test_payload_compression() {
     let payload = random_payload(&mut rand::make_rng::<rand::rngs::SmallRng>(), 2);
     let payload_bytes = payload.to_bytes();
     let compressed = compress_lz4(&payload_bytes);
-    let decompressed = decompress_lz4(&compressed);
-    let decompressed_payload = <Payload as Blob>::from_bytes(&decompressed);
+    let decompressed = decompress_lz4(&compressed).unwrap();
+    let decompressed_payload = <Payload as Blob>::from_bytes(&decompressed).unwrap();
     assert_eq!(payload, decompressed_payload);
 }
 
@@ -2181,3 +2181,185 @@ fn test_open_repairs_gaps_length_mismatch() {
     let gaps_bytes = fs::read(dir.path().join("gaps.dat")).unwrap();
     assert_eq!(gaps_bytes.len(), 2 * 6, "one 6-byte entry per region");
 }
+
+/// Tracker file layout: a 4-byte header, then one 16-byte record per point offset holding
+/// `[discriminant][page_id][block_offset][length]` as little-endian `u32`s.
+const TRACKER_HEADER_BYTES: usize = 4;
+const TRACKER_RECORD_BYTES: usize = 16;
+const TRACKER_BLOCK_OFFSET_FIELD: usize = 8;
+const TRACKER_LENGTH_FIELD: usize = 12;
+
+/// Page size of the corrupt pointer tests: 1 MiB, exactly one region per page
+const CORRUPT_POINTER_PAGE_SIZE: usize = DEFAULT_BLOCK_SIZE_BYTES * DEFAULT_REGION_SIZE_BLOCKS;
+
+/// Store three small payloads at point offsets 0, 1 and 2, flush and close the storage
+fn stored_small_payloads(compression: Compression) -> (TempDir, Vec<Payload>) {
+    let (dir, mut storage) = empty_storage_sized(CORRUPT_POINTER_PAGE_SIZE, compression);
+
+    let hw_cell = HardwareCounterCell::new();
+    let hw_counter = hw_cell.ref_payload_io_write_counter();
+
+    let payloads: Vec<Payload> = (0..3)
+        .map(|i| {
+            let mut map = serde_json::Map::new();
+            map.insert("category".to_string(), format!("cat_{i}").into());
+            Payload(map)
+        })
+        .collect();
+    for (offset, payload) in payloads.iter().enumerate() {
+        storage
+            .put_value(offset as PointOffset, payload, hw_counter)
+            .unwrap();
+    }
+
+    storage.flusher()().unwrap();
+    (dir, payloads)
+}
+
+/// Overwrite one field of the tracker record at `point_offset` on disk, returning its old value
+///
+/// The record must hold a `Some` pointer.
+fn overwrite_tracker_field(dir: &TempDir, point_offset: usize, field: usize, value: u32) -> u32 {
+    let tracker_path = dir.path().join("tracker.dat");
+    let mut tracker_bytes = fs::read(&tracker_path).unwrap();
+
+    let record_start = TRACKER_HEADER_BYTES + point_offset * TRACKER_RECORD_BYTES;
+    let read_field = |bytes: &[u8], field: usize| {
+        let start = record_start + field;
+        u32::from_le_bytes(bytes[start..start + 4].try_into().unwrap())
+    };
+    assert_eq!(
+        read_field(&tracker_bytes, 0),
+        1,
+        "record must hold a Some pointer"
+    );
+
+    let old_value = read_field(&tracker_bytes, field);
+    let start = record_start + field;
+    tracker_bytes[start..start + 4].copy_from_slice(&value.to_le_bytes());
+    fs::write(&tracker_path, &tracker_bytes).unwrap();
+
+    old_value
+}
+
+/// Reading the corrupt pointer at `corrupt_offset` must return an error, the other values must be
+/// unaffected. Iterating, as payload indices do when they are loaded, must return an error too.
+fn assert_corrupt_pointer_errors(
+    storage: &Blobstore<Payload>,
+    payloads: &[Payload],
+    corrupt_offset: usize,
+) {
+    let hw_cell = HardwareCounterCell::new();
+
+    for (offset, payload) in payloads.iter().enumerate() {
+        let stored = storage.get_value::<Random>(offset as PointOffset, &hw_cell);
+        if offset == corrupt_offset {
+            assert!(
+                stored.is_err(),
+                "value {offset} must fail to read, got {stored:?}"
+            );
+        } else {
+            assert_eq!(stored.unwrap().as_ref(), Some(payload), "value {offset}");
+        }
+    }
+
+    let iterated =
+        storage.iter::<_, BlobstoreError>(|_, _| Ok(true), hw_cell.ref_payload_io_write_counter());
+    assert!(iterated.is_err(), "iterating must fail");
+}
+
+/// Reproduces a torn write of a pointer in the tracker, as left by a hard crash (power loss /
+/// kernel crash) during a flush.
+///
+/// If the crash persists the first 12 bytes of a new pointer but not its length, a slot that was
+/// empty before reads back as a `Some` pointer with a length of zero. No real write produces a
+/// zero length, so such a pointer must read as no value. WAL replay rewrites the slot afterwards.
+///
+/// This used to panic when deserializing the empty value, which blocks loading the segment.
+///
+/// See: <github.com/qdrant/qdrant/issues/9857>
+#[test]
+fn test_t
```

**File**: `lib/blobstore/src/config.rs` (modified, +10/-5)
```diff
@@ -4,6 +4,9 @@ use lz4_flex::compress_prepend_size;
 use serde::{Deserialize, Serialize};
 use strum::EnumIter;
 
+use crate::Result;
+use crate::error::BlobstoreError;
+
 /// Expect JSON values to have roughly 3–5 fields with mostly small values.
 /// For 1M values, this would require 128MB of memory.
 pub const DEFAULT_BLOCK_SIZE_BYTES: usize = 128;
@@ -29,10 +32,10 @@ impl Compression {
         }
     }
 
-    pub(crate) fn decompress(self, value: Cow<'_, [u8]>) -> Cow<'_, [u8]> {
+    pub(crate) fn decompress(self, value: Cow<'_, [u8]>) -> Result<Cow<'_, [u8]>> {
         match self {
-            Compression::None => value,
-            Compression::LZ4 => decompress_lz4(&value).into(),
+            Compression::None => Ok(value),
+            Compression::LZ4 => decompress_lz4(&value).map(Cow::Owned),
         }
     }
 }
@@ -43,8 +46,10 @@ pub(crate) fn compress_lz4(value: &[u8]) -> Vec<u8> {
 }
 
 #[inline]
-pub(crate) fn decompress_lz4(value: &[u8]) -> Vec<u8> {
-    lz4_flex::decompress_size_prepended(value).unwrap()
+pub(crate) fn decompress_lz4(value: &[u8]) -> Result<Vec<u8>> {
+    lz4_flex::decompress_size_prepended(value).map_err(|err| {
+        BlobstoreError::decode_error(format!("Failed to decompress LZ4 value: {err}"))
+    })
 }
 
 /// Mode-neutral options a storage can be created with.
```

**File**: `lib/blobstore/src/error.rs` (modified, +19/-1)
```diff
@@ -1,3 +1,5 @@
+use std::ops::Range;
+
 use common::mmap;
 use common::universal_io::{IsNotFound, UniversalIoError};
 
@@ -23,8 +25,16 @@ pub enum BlobstoreError {
     UnsupportedOperation { operation: String },
     #[error("Page {page_id} not found")]
     PageNotFound { page_id: PageId },
+    #[error("Requested pages {page_ids:?}, but we only have {available_pages} pages")]
+    PageRangeNotFound {
+        page_ids: Range<PageId>,
+        available_pages: usize,
+    },
     #[error("value {point_offset} not found")]
     ValueNotFound { point_offset: PointOffset },
+    /// Stored bytes don't decode into a value, the storage is corrupt
+    #[error("Failed to decode value: {description}")]
+    DecodeError { description: String },
 }
 
 impl BlobstoreError {
@@ -45,6 +55,12 @@ impl BlobstoreError {
             operation: operation.into(),
         }
     }
+
+    pub fn decode_error(description: impl Into<String>) -> Self {
+        BlobstoreError::DecodeError {
+            description: description.into(),
+        }
+    }
 }
 
 impl IsNotFound for BlobstoreError {
@@ -59,7 +75,9 @@ impl IsNotFound for BlobstoreError {
             | BlobstoreError::ValidationError { .. }
             | BlobstoreError::UnsupportedOperation { .. }
             | BlobstoreError::PageNotFound { .. }
-            | BlobstoreError::ValueNotFound { .. } => false,
+            | BlobstoreError::PageRangeNotFound { .. }
+            | BlobstoreError::ValueNotFound { .. }
+            | BlobstoreError::DecodeError { .. } => false,
         }
     }
 }
```

---

### Incident Patch 9: `97074633` (2026-10-01)
**Commit Message**: Faster Windows Rust builds (#10869)

* Faster Windows Rust builds

* Keep target dir in the workspace

**File**: `.github/workflows/rust.yml` (modified, +23/-1)
```diff
@@ -47,6 +47,21 @@ jobs:
         os: [ ubuntu-latest, windows-latest, macos-latest ]
 
     steps:
+    # The windows-latest image has only the slow C: drive. A ReFS Dev Drive holds the temp files the
+    # tests write. The target directory stays in the workspace, where rust-cache can cache it.
+    - name: Set up Dev Drive
+      if: matrix.os == 'windows-latest'
+      uses: samypr100/setup-dev-drive@562171fe8df7401fdf582d766cd3b6ab80d5b1a0 # v4.1.0
+      with:
+        drive-size: 50GB
+        trusted-dev-drive: true
+        env-mapping: |
+          TMP,{{ DEV_DRIVE }}/tmp
+          TEMP,{{ DEV_DRIVE }}/tmp
+    - name: Create temp directory on Dev Drive
+      if: matrix.os == 'windows-latest'
+      run: mkdir -p "$TMP"
+      shell: bash
     - name: Install minimal stable
       uses: dtolnay/rust-toolchain@631a55b12751854ce901bb631d5902ceb48146f7 # stable
     - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -58,13 +73,20 @@ jobs:
       uses: ./.github/actions/setup-protoc
     - name: Install mold
       uses: rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621 # v1
-    - name: Enable mold on Linux
+    - name: Configure linker (mold on Linux, rust-lld on Windows)
       run: |
         if [[ "${{ matrix.os }}" == "ubuntu-latest" ]]; then
           mkdir .cargo
           echo "[target.x86_64-unknown-linux-gnu]" >> .cargo/config.toml
           echo "linker = \"clang\"" >> .cargo/config.toml
           echo "rustflags = [\"-C\", \"link-arg=-fuse-ld=/usr/local/bin/mold\"]" >> .cargo/config.toml
+        elif [[ "${{ matrix.os }}" == "windows-latest" ]]; then
+          mkdir .cargo
+          echo "[target.x86_64-pc-windows-msvc]" >> .cargo/config.toml
+          echo "linker = \"rust-lld.exe\"" >> .cargo/config.toml
+          # No debug info: MSVC writes a PDB per test binary, which slows linking. Panic messages
+          # keep their file:line; only backtraces lose line numbers.
+          echo "CARGO_PROFILE_DEV_DEBUG=0" >> "$GITHUB_ENV"
         fi
       shell: bash
     - name: Install nextest
```

---

### Incident Patch 10: `67f3b0c3` (2026-10-01)
**Commit Message**: fix(query): order MMR shard candidates by vector distance before merging (#10878)

* fix(query): order MMR shard candidates by vector distance before merging

When querying a multi-shard collection with MMR, intermediate shard-level
candidate retrieval uses query_result_order to merge candidate lists
across shards. Previously, query_result_order returned None for
ScoringQuery::Mmr, causing candidates from multiple shards to be merged
with non-deterministic random sampling order rather than by relevance distance.
This could drop top nearest-neighbor candidates from one shard in favor
of lower-scoring candidates from another shard when truncating to candidates_limit.

- In query_result_order, resolve distance_order() for ScoringQuery::Mmr
  using the target vector's distance metric (LargeBetter for Cosine/Dot,
  SmallBetter for Euclidean/Manhattan).

Fixes #10805

Signed-off-by: sundeep8967 <[REDACTED_EMAIL]>

* fmt

---------

Signed-off-by: sundeep8967 <[REDACTED_EMAIL]>
Co-authored-by: Luis Cossío <[REDACTED_EMAIL]>

**File**: `lib/shard/src/query/mod.rs` (modified, +2/-2)
```diff
@@ -178,8 +178,8 @@ pub fn query_result_order<E>(
             ScoringQuery::OrderBy(order_by) => Some(Order::from(order_by.direction())),
             // Random sample does not require ordering
             ScoringQuery::Sample(SampleInternal::Random) => None,
-            // MMR cannot be reordered
-            ScoringQuery::Mmr(_) => None,
+            // MMR candidates are ordered by vector distance at shard level
+            ScoringQuery::Mmr(mmr) => Some(get_distance(&mmr.using)?.distance_order()),
         },
         None => {
             // Order by ID
```

---

### Incident Patch 11: `b9e0d3ae` (2026-09-30)
**Commit Message**: feat(edge): expose unified `memory` placement on all collection components (#10863)

* feat(edge): expose unified `memory` placement on all collection components

Bring Edge (Rust config, UniFFI, and Python) to parity with the server's
`memory: cold|cached|pinned` API so dense/sparse vectors, payload storage,
and the id tracker can be configured without the deprecated on_disk flags.

* style(edge): rustfmt after memory placement changes

* fix(edge): keep memory placement changes backward compatible

- Merge `on_disk_payload` and `payload_memory` as one setting when filling
  unspecified config, so a legacy `on_disk_payload` passed on reload is no
  longer overridden by a persisted or segment-derived `payload_memory`.
- Append new `memory` arguments at the end of Python constructors and UniFFI
  records so existing positional callers keep working.
- Add `memory_placement()` / `requested_payload_memory()` helpers and reuse
  them in the FFI config read-back.
- Complete the `.pyi` stubs for `memory`, `payload_memory` and
  `id_tracker_memory`; drop the nonexistent TurboQuant `plus` argument.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(edge): use `memory` placement par

**File**: `lib/edge/ffi/src/config.rs` (modified, +68/-21)
```diff
@@ -753,22 +753,31 @@ pub struct VectorDataConfig {
     /// recall/memory/speed trade-off. Built by [`crate::EdgeShard::optimize`].
     #[uniffi(default = None)]
     pub hnsw_config: Option<HnswIndexConfig>,
+    /// Memory placement of the original vector storage. `None`/`null` defaults
+    /// to `Cached`. `Pinned` is not supported for dense vector storage
+    /// (defensively mapped to `Cached`).
+    #[uniffi(default = None)]
+    pub memory: Option<Memory>,
 }
 
 impl From<VectorDataConfig> for SegmentVectorDataConfig {
     fn from(c: VectorDataConfig) -> Self {
         let VectorDataConfig {
             size,
             distance,
+            memory,
             quantization_config,
             multivector_config,
             datatype,
             hnsw_config,
         } = c;
+        let memory = memory
+            .map(SegmentMemory::from)
+            .unwrap_or(SegmentMemory::Cached);
         SegmentVectorDataConfig {
             size: crate::error::clamp_usize(size),
             distance: SegmentDistance::from(distance),
-            storage_type: VectorStorageType::InRamChunkedMmap,
+            storage_type: VectorStorageType::appendable_from_memory(memory),
             // The index travels via the `index` field: emit `Hnsw` when the host
             // supplied HNSW params (so `edge::EdgeConfig::from_segment_config`
             // picks them up and the optimizer builds an HNSW index), else `Plain`.
@@ -788,9 +797,7 @@ impl From<SegmentVectorDataConfig> for VectorDataConfig {
         let SegmentVectorDataConfig {
             size,
             distance,
-            // The FFI storage type is fixed at `InRamChunkedMmap` on the write
-            // path and not surfaced back.
-            storage_type: _,
+            storage_type,
             index,
             quantization_config,
             multivector_config,
@@ -799,6 +806,7 @@ impl From<SegmentVectorDataConfig> for VectorDataConfig {
         VectorDataConfig {
             size: size as u64,
             distance: Distance::from(distance),
+            memory: storage_type.memory().map(Memory::from),
             quantization_config: quantization_config.and_then(|q| q.try_into().ok()),
             multivector_config: multivector_config.map(MultiVectorConfig::from),
             datatype: datatype.map(VectorStorageDatatype::from),
@@ -889,21 +897,35 @@ pub struct SparseVectorDataConfig {
     /// Optional score modifier (e.g. IDF weighting).
     #[uniffi(default = None)]
     pub modifier: Option<Modifier>,
+    /// Memory placement of the sparse index. `None`/`null` defaults to
+    /// `Pinned` (in-RAM mutable index). Use `Cold` or `Cached` for an
+    /// mmap-backed index.
+    #[uniffi(default = None)]
+    pub memory: Option<Memory>,
 }
 
 impl From<SparseVectorDataConfig> for SegmentSparseVectorDataConfig {
     fn from(c: SparseVectorDataConfig) -> Self {
         let SparseVectorDataConfig {
             full_scan_threshold,
+            memory,
             datatype,
             modifier,
         } = c;
+        let memory = memory.map(SegmentMemory::from);
+        // Structural index type follows the legacy on_disk mapping: heap
+        // placements stay MutableRam; cold/cached use Mmap. Persist only the
+        // explicit `memory` so cold vs cached is recoverable.
+        let index_type = match memory {
+            Some(SegmentMemory::Cold) | Some(SegmentMemory::Cached) => SegmentSparseIndexType::Mmap,
+            Some(SegmentMemory::Pinned) | None => SegmentSparseIndexType::MutableRam,
+        };
         SegmentSparseVectorDataConfig {
             index: SparseIndexConfig {
-                index_type: SegmentSparseIndexType::MutableRam,
+                index_type,
                 full_scan_threshold: full_scan_threshold.map(crate::error::clamp_usize),
                 datatype: datatype.map(SegmentVectorStorageDatatype::from),
-                memory: None,
+                memory,
             },
             storage_type: SparseVectorStorageType::Mmap,
             modifier: modifier.map(SegmentModifier::from),
@@ -916,18 +938,19 @@ impl From<SegmentSparseVectorDataConfig> for SparseVectorDataConfig {
         let SegmentSparseVectorDataConfig {
             index:
                 SparseIndexConfig {
-                    // Fixed on the write path (`MutableRam`) and not surfaced
-                    // back; placement of the sparse index is not an FFI knob.
                     index_type: _,
                     full_scan_threshold,
                     datatype,
-                    memory: _,
+                    memory,
                 },
             storage_type: _,
             modifier,
         } = c;
         SparseVectorDataConfig {
             full_scan_threshold: full_scan_threshold.map(|v| v as u64),
+            // Prefer the explicit stored memory; otherwise leave unset so a
+            // MutableRam-only config does not invent a `Pinned` knob.
+            me
```

**File**: `lib/edge/ffi/tests/conversions.rs` (modified, +3/-0)
```diff
@@ -365,13 +365,16 @@ fn closed_shard_returns_shard_closed() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: None,
                 multivector_config: None,
                 datatype: None,
                 hnsw_config: None,
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
 
     let shard: Arc<EdgeShard> =
```

**File**: `lib/edge/ffi/tests/integration.rs` (modified, +33/-0)
```diff
@@ -26,13 +26,16 @@ fn make_config() -> EdgeConfig {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: None,
                 multivector_config: None,
                 datatype: None,
                 hnsw_config: None,
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     }
 }
 
@@ -360,6 +363,7 @@ fn scalar_quantization_accepted_at_load() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: Some(QuantizationConfig::Scalar {
                     config: ScalarQuantizationParams {
                         r#type: ScalarType::Int8,
@@ -373,6 +377,8 @@ fn scalar_quantization_accepted_at_load() {
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
 
     let shard = EdgeShard::load(path, Some(config)).expect("Scalar quantization must be accepted");
@@ -628,6 +634,7 @@ fn product_quantization_accepted_at_load() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: Some(QuantizationConfig::Product {
                     config: ProductQuantizationParams {
                         compression: CompressionRatio::X16,
@@ -640,6 +647,8 @@ fn product_quantization_accepted_at_load() {
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
 
     let shard = EdgeShard::load(path, Some(config));
@@ -670,6 +679,7 @@ fn turbo_quantization_accepted_at_load() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: Some(QuantizationConfig::Turbo {
                     config: TurboQuantizationParams {
                         memory: Some(Memory::Pinned),
@@ -682,6 +692,8 @@ fn turbo_quantization_accepted_at_load() {
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
 
     let shard = EdgeShard::load(path, Some(config));
@@ -710,6 +722,7 @@ fn binary_quantization_accepted_at_load() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: Some(QuantizationConfig::Binary {
                     config: BinaryQuantizationParams {
                         memory: Some(Memory::Pinned),
@@ -723,6 +736,8 @@ fn binary_quantization_accepted_at_load() {
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
 
     let shard = EdgeShard::load(path, Some(config)).expect("Binary quantization must be accepted");
@@ -854,6 +869,7 @@ fn hnsw_config_optimize_and_search() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: None,
                 multivector_config: None,
                 datatype: None,
@@ -868,6 +884,8 @@ fn hnsw_config_optimize_and_search() {
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
 
     let shard: Arc<EdgeShard> =
@@ -941,13 +959,16 @@ fn oversized_hnsw_params_rejected_not_allocated() {
             VectorDataConfig {
                 size: 4,
                 distance: Distance::Dot,
+                memory: None,
                 quantization_config: None,
                 multivector_config: None,
                 datatype: None,
                 hnsw_config: Some(hnsw),
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     };
     let sane = HnswIndexConfig {
         m: 16,
@@ -1099,13 +1120,16 @@ fn config_with_distance(distance: Distance) -> EdgeConfig {
             VectorDataConfig {
                 size: 4,
                 distance,
+                memory: None,
                 quantization_config: None,
                 multivector_config: None,
                 datatype: None,
                 hnsw_config: None,
             },
         )]),
         sparse_vector_data: HashMap::new(),
+        payload_memory: None,
+        id_tracker_memory: None,
     }
 }
 
@@ -1115,6 +1139,7 @@ fn two_field_config() -> EdgeConfig {
     let field = || VectorDataConfig {
         size: 4,
         distance: Distance::Dot,
+        memory: None,
         quantization_config:
```

**File**: `lib/edge/publish/examples/src/bin/bm25-search.rs` (modified, +5/-3)
```diff
@@ -11,9 +11,9 @@ use examples::TMP_DIR;
 use qdrant_edge::bm25_embed::{EdgeBm25, EdgeBm25Config};
 use qdrant_edge::external::serde_json::json;
 use qdrant_edge::{
-    EdgeConfig, EdgeShard, EdgeSparseVectorParams, Modifier, NamedQuery, PointInsertOperations,
-    PointOperations, PointStruct, QueryEnum, QueryRequestBuilder, ScoringQuery, UpdateOperation,
-    VectorInternal, Vectors, WithPayloadInterface,
+    EdgeConfig, EdgeShard, EdgeSparseVectorParams, Memory, Modifier, NamedQuery,
+    PointInsertOperations, PointOperations, PointStruct, QueryEnum, QueryRequestBuilder,
+    ScoringQuery, UpdateOperation, VectorInternal, Vectors, WithPayloadInterface,
 };
 
 const SPARSE_VECTOR_NAME: &str = "text";
@@ -30,6 +30,8 @@ fn main() -> Result<(), Box<dyn Error>> {
             SPARSE_VECTOR_NAME.to_string(),
             EdgeSparseVectorParams {
                 modifier: Some(Modifier::Idf),
+                // Keep the sparse index on the heap for fast lookups.
+                memory: Some(Memory::Pinned),
                 ..Default::default()
             },
         )]),
```

**File**: `lib/edge/publish/examples/src/lib.rs` (modified, +9/-4)
```diff
@@ -6,8 +6,8 @@ use std::path::Path;
 
 use qdrant_edge::external::serde_json::json;
 use qdrant_edge::{
-    DEFAULT_VECTOR_NAME, Distance, EdgeConfig, EdgeShard, EdgeVectorParams, PointInsertOperations,
-    PointOperations, PointStruct, UpdateOperation,
+    DEFAULT_VECTOR_NAME, Distance, EdgeConfig, EdgeShard, EdgeVectorParams, Memory,
+    PointInsertOperations, PointOperations, PointStruct, UpdateOperation,
 };
 
 pub const DATA_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../data");
@@ -23,11 +23,16 @@ pub fn load_new_shard() -> Result<EdgeShard, Box<dyn Error>> {
 
     fs_err::create_dir_all(TMP_DIR)?;
 
+    // `memory` controls how each component is held in RAM; data is always persisted on disk.
+    // `Cold` pages data in on demand, `Cached` preloads it into the page cache, `Pinned` keeps
+    // it on the heap.
     let config = EdgeConfig::builder()
-        .on_disk_payload(false)
+        .payload_memory(Memory::Cached)
         .vector(
             DEFAULT_VECTOR_NAME,
-            EdgeVectorParams::builder(4, Distance::Dot).build(),
+            EdgeVectorParams::builder(4, Distance::Dot)
+                .memory(Memory::Cached)
+                .build(),
         )
         .build();
 
```

**File**: `lib/edge/python/examples/bm25-search.py` (modified, +3/-2)
```diff
@@ -6,7 +6,7 @@
 from pathlib import Path
 
 from qdrant_edge import (
-    EdgeShard, EdgeConfig, EdgeSparseVectorParams, Modifier,
+    EdgeShard, EdgeConfig, EdgeSparseVectorParams, Memory, Modifier,
     Bm25, Bm25Config,
     Point, Query, QueryRequest, UpdateOperation,
 )
@@ -20,7 +20,8 @@
 os.makedirs(path)
 
 config = EdgeConfig(
-    sparse_vectors={"text": EdgeSparseVectorParams(modifier=Modifier.Idf)},
+    # Keep the sparse index on the heap for fast lookups.
+    sparse_vectors={"text": EdgeSparseVectorParams(modifier=Modifier.Idf, memory=Memory.Pinned)},
 )
 shard = EdgeShard.create(str(path), config)
 
```

**File**: `lib/edge/python/examples/common.py` (modified, +6/-1)
```diff
@@ -11,6 +11,7 @@
     EdgeConfig,
     EdgeShard,
     EdgeVectorParams,
+    Memory,
     Point,
     UpdateOperation,
 )
@@ -29,8 +30,12 @@ def load_new_shard() -> EdgeShard:
 
     os.makedirs(TMP_DIR)
 
+    # `memory` controls how each component is held in RAM; data is always persisted on disk.
+    # `Cold` pages data in on demand, `Cached` preloads it into the page cache, `Pinned` keeps
+    # it on the heap.
     config = EdgeConfig(
-        vectors=EdgeVectorParams(size=4, distance=Distance.Dot),
+        vectors=EdgeVectorParams(size=4, distance=Distance.Dot, memory=Memory.Cached),
+        payload_memory=Memory.Cached,
     )
 
     return EdgeShard.create(TMP_DIR, config)
```

**File**: `lib/edge/python/examples/repr.py` (modified, +5/-0)
```diff
@@ -5,6 +5,7 @@
     EdgeConfig,
     EdgeSparseVectorParams,
     EdgeVectorParams,
+    Memory,
     Modifier,
     VectorStorageDatatype,
 )
@@ -13,14 +14,18 @@
     vectors=EdgeVectorParams(
         size=128,
         distance=Distance.Cosine,
+        memory=Memory.Cold,
     ),
     sparse_vectors={
         "sparse": EdgeSparseVectorParams(
             full_scan_threshold=1024,
             datatype=VectorStorageDatatype.Float32,
             modifier=Modifier.Idf,
+            memory=Memory.Pinned,
         ),
     },
+    payload_memory=Memory.Cold,
+    id_tracker_memory=Memory.Pinned,
 )
 
 print(config)
```

---

### Incident Patch 12: `343a91f3` (2026-09-29)
**Commit Message**: fix: normalize cosine vectors when appending points (#10840)

**File**: `lib/edge/src/update_only/apply.rs` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ impl<Fs: UniversalAppendFs> UpdateOnlyEdgeShard<Fs> {
                         "Write target {uuid} was opened as delete-only, it cannot store points",
                     ))
                 })?
-                .store_points(&self.pool, &to_store, &hw_counter)?;
+                .store_points(&self.pool, &mut to_store, &hw_counter)?;
             log::trace!(target: LOG_TARGET, "store_points took: {:?}", instant.elapsed());
 
             // The write target's retirements happen after the store, since
```

**File**: `lib/edge/src/update_only/tests.rs` (modified, +85/-3)
```diff
@@ -193,22 +193,25 @@ fn delete_batch_tombstones_points_in_immutable_segments() {
 /// preallocation nor mmap exists.
 #[cfg(not(windows))]
 mod store {
+    use std::collections::HashMap;
     use std::path::Path;
 
     use common::universal_io::{MmapFile, MmapFs};
+    use segment::data_types::vectors::{VectorInternal, VectorStructInternal};
     use segment::payload_json;
     use segment::payload_storage::update_only::UpdateOnlyPayloadStorage;
-    use segment::types::{Filter, Payload, WithPayloadInterface, WithVector};
+    use segment::types::{Distance, Filter, Payload, WithPayloadInterface, WithVector};
     use shard::files::SEGMENTS_PATH;
     use shard::operations::point_ops::PointInsertOperationsInternal::PointsList;
     use shard::operations::point_ops::PointOperations::{UpsertPoints, UpsertPointsConditional};
     use shard::operations::point_ops::{
-        ConditionalInsertOperationInternal, PointStructPersisted, UpdateMode,
+        ConditionalInsertOperationInternal, PointStructPersisted, UpdateMode, VectorStructPersisted,
     };
 
     use super::*;
     use crate::RetrieveRequestBuilder;
-    use crate::read_only::tests::{assert_follower_vectors, point};
+    use crate::read_only::ReadOnlyEdgeShard;
+    use crate::read_only::tests::{VECTOR_NAME, assert_follower_vectors, point};
     use crate::read_view::EdgeShardRead as _;
 
     /// The leader writes its payload storage in mutable (Gridstore) mode, which an
@@ -561,6 +564,85 @@ mod store {
             Some(payload_json! { "kind": "updated" })
         );
     }
+
+    /// The writer appends through its own path, which has to normalize cosine
+    /// vectors just as the classic one does.
+    #[test]
+    fn appended_cosine_vectors_are_normalized() {
+        // [3, 4] has length 5, so a normalizing store holds [0.6, 0.8].
+        const RAW: [f32; 2] = [3.0, 4.0];
+        const UNIT: [f32; 2] = [0.6, 0.8];
+
+        let dir = cosine_leader("edge-update-cosine");
+        recreate_payload_storages_append_only(dir.path());
+
+        let writer = UpdateOnlyEdgeShard::<MmapFs>::open_mmap(dir.path()).unwrap();
+        let (_writer, outcome) = writer
+            .apply_batch(store_batch(100, vec![cosine_point(2, RAW)]))
+            .unwrap();
+        assert_eq!(outcome.stored, 1);
+
+        let follower = open_follower(dir.path());
+        // Point 1 went in through the classic path: that is the bar.
+        assert_unit_vector(&follower, 1, UNIT);
+        assert_unit_vector(&follower, 2, UNIT);
+    }
+
+    fn cosine_leader(prefix: &str) -> TempDir {
+        let dir = tempfile::Builder::new().prefix(prefix).tempdir().unwrap();
+
+        let mut config = test_config();
+        let params = config.vectors.get_mut(VECTOR_NAME).unwrap();
+        params.size = 2;
+        params.distance = Distance::Cosine;
+
+        let leader = EdgeShard::new(dir.path(), config).unwrap();
+        leader
+            .update(PointOperation(UpsertPoints(PointsList(vec![
+                cosine_point(1, [3.0, 4.0]),
+            ]))))
+            .unwrap();
+        leader.flush().unwrap();
+
+        dir
+    }
+
+    fn cosine_point(id: u64, vector: [f32; 2]) -> PointStructPersisted {
+        PointStructPersisted {
+            id: ExtendedPointId::NumId(id),
+            vector: VectorStructPersisted::from(VectorStructInternal::Named(HashMap::from([(
+                VECTOR_NAME.to_string(),
+                VectorInternal::from(vector.to_vec()),
+            )]))),
+            payload: None,
+        }
+    }
+
+    fn assert_unit_vector(follower: &ReadOnlyEdgeShard<MmapFile>, id: u64, expected: [f32; 2]) {
+        let results = follower
+            .retrieve(
+                RetrieveRequestBuilder::new(vec![ExtendedPointId::NumId(id)])
+                    .with_payload(WithPayloadInterface::Bool(false))
+                    .with_vector(WithVector::Bool(true))
+                    .build(),
+            )
+            .unwrap();
+        let vector = results[0].vector.as_ref().expect("vector present");
+        let VectorStructInternal::Named(vectors) = vector else {
+            panic!("expected Named vectors, got {vector:?}");
+        };
+        let named = vectors.get(VECTOR_NAME).expect("vector name exists");
+        let VectorInternal::Dense(stored) = named else {
+            panic!("expected Dense vector, got {named:?}");
+        };
+        assert_eq!(stored.len(), expected.len(), "point {id}: {stored:?}");
+        for (got, want) in stored.iter().zip(&expected) {
+            assert!(
+                (got - want).abs() < 1e-6,
+                "point {id}: stored {stored:?}, expected the unit vector {expected:?}",
+            );
+        }
+    }
 }
 
 /// A claimed target opens non-writable; a created appendable takes the writes.
```

**File**: `lib/segment/src/segment/update_only/appendable/mod.rs` (modified, +16/-1)
```diff
@@ -13,6 +13,7 @@ use rayon::iter::{
 };
 
 use super::AppendableIdTrackerState;
+use crate::common::check_named_vectors;
 use crate::common::operation_error::OperationResult;
 use crate::data_types::fully_qualified_point::FullyQualifiedPoint;
 use crate::id_tracker::mutable_id_tracker::update_only::{
@@ -240,13 +241,27 @@ impl<Fs: UniversalAppendFs> AppendableSegment<Fs> {
     pub fn store_points(
         &mut self,
         pool: &ThreadPool,
-        points: &[FullyQualifiedPoint],
+        points: &mut [FullyQualifiedPoint],
         hw_counter: &HardwareCounterCell,
     ) -> OperationResult<()> {
         if points.is_empty() {
             return Ok(());
         }
 
+        // Cosine scores with a plain dot product, so a stored vector has to be
+        // unit length. `stored_vectors` are storage-native bytes, preprocessed
+        // on their way in already.
+        for point in points.iter_mut() {
+            check_named_vectors(&point.updated_vectors, &self.config)?;
+            point.updated_vectors.preprocess(|name| {
+                self.config
+                    .vector_data
+                    .get(name)
+                    .expect("name checked above")
+            });
+        }
+        let points = &*points;
+
         // Ensure fresh new view of the files
         self.fs.cache_file_info()?;
 
```

---

### Incident Patch 13: `e661fd4c` (2026-09-29)
**Commit Message**: build(deps): bump smallvec from 1.16.1 to 1.16.2 (#10817)

Bumps [smallvec](https://github.com/servo/rust-smallvec) from 1.16.1 to 1.16.2.
- [Release notes](https://github.com/servo/rust-smallvec/releases)
- [Commits](https://github.com/servo/rust-smallvec/compare/v1.16.1...v1.16.2)

---
updated-dependencies:
- dependency-name: smallvec
  dependency-version: 1.16.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -7675,9 +7675,9 @@ checksum = "88414a5ca1f85d82cc34471e975f0f74f6aa54c40f062efa42c0080e7f763f81"
 
 [[package]]
 name = "smallvec"
-version = "1.16.1"
+version = "1.16.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ba467056f1b547ed52077911161fc86985becbc60e8e1857c8a144dab0def891"
+checksum = "f9395f0f0eee849a9b707b2f06bb92a6a422090e2123bb2ef8e87a0e61892a8e"
 
 [[package]]
 name = "smawk"
```

---

### Incident Patch 14: `90eab164` (2026-09-29)
**Commit Message**: build(deps): bump count-min-sketch from 0.1.8 to 0.2.0 (#10816)

Bumps [count-min-sketch](https://github.com/jedisct1/rust-count-min-sketch) from 0.1.8 to 0.2.0.
- [Commits](https://github.com/jedisct1/rust-count-min-sketch/compare/0.1.8...0.2.0)

---
updated-dependencies:
- dependency-name: count-min-sketch
  dependency-version: 0.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -1608,11 +1608,11 @@ dependencies = [
 
 [[package]]
 name = "count-min-sketch"
-version = "0.1.8"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3fef0a447ef2e9e6bd57e379f88702c58c4a4253ba82fb175bd7db012192311a"
+checksum = "1d215d2074777c29211d17a671daba8c6f223dc103a8ad739a5310e2375c4d76"
 dependencies = [
- "rand 0.8.5",
+ "getrandom 0.3.4",
  "siphasher 1.0.4",
 ]
 
@@ -8060,7 +8060,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd"
 dependencies = [
  "fastrand",
- "getrandom 0.3.4",
+ "getrandom 0.4.2",
  "once_cell",
  "rustix 1.1.5",
  "windows-sys 0.61.2",
```

**File**: `lib/collection/Cargo.toml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ hashring = "0.3.6"
 tinyvec = { workspace = true }
 siphasher = "1.0.3"
 smallvec = { workspace = true }
-count-min-sketch = "0.1.8"
+count-min-sketch = "0.2.0"
 
 tokio = { workspace = true }
 tokio-util = { workspace = true }
```

---

### Incident Patch 15: `457bda7c` (2026-09-29)
**Commit Message**: build(deps): bump astral-sh/setup-uv from 10.1.0 to 10.2.0 (#10818)

Bumps [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) from 10.1.0 to 10.2.0.
- [Release notes](https://github.com/astral-sh/setup-uv/releases)
- [Commits](https://github.com/astral-sh/setup-uv/compare/bec219d24cd3e171d82865faccec33120bb574f4...c18668ad3cf93ea998bef934396af7bb5c839dc7)

---
updated-dependencies:
- dependency-name: astral-sh/setup-uv
  dependency-version: 10.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/edge-py-release.yml` (modified, +1/-1)
```diff
@@ -260,7 +260,7 @@ jobs:
         uses: ./.github/actions/setup-just
 
       - name: Install uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
 
       - name: Install Python
         uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
```

**File**: `.github/workflows/edge-rust-release.yml` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ jobs:
         uses: ./.github/actions/setup-just
 
       - name: Install uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
 
       - name: Install ast-grep
         run: uv tool install ast-grep-cli
@@ -91,7 +91,7 @@ jobs:
         uses: dtolnay/rust-toolchain@631a55b12751854ce901bb631d5902ceb48146f7 # stable
 
       - name: Install uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
 
       - name: Install ast-grep
         run: uv tool install ast-grep-cli
```

**File**: `.github/workflows/edge-test.yml` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ jobs:
         uses: ./.github/actions/setup-just
 
       - name: Install uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
 
       - name: Install tools
         run: |
```

**File**: `.github/workflows/rust-lint.yml` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ jobs:
     steps:
     - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
     - name: Install uv
-      uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+      uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
     - name: Install ast-grep
       run: uv tool install ast-grep-cli==0.44.1
     - name: Test ast-grep rules (tools/ast-grep/rule-tests)
```

#### Recent Merged Pull Requests:
- **PR #10947** (2026-10-05): Bump dev version to 1.19.3-dev (@timvisee)
- **PR #10946** (2026-10-05): Bump version to 1.19.2 (@timvisee)
- **PR #10939** (2026-10-05): Add 8-bit TurboQuant quantization (@generall)
- **PR #10928** (closed): Fix Euclidean BQ score ordering without rescoring (@adogfm)
- **PR #10927** (2026-10-05): [AppendableIdTracker] ensure live-reload consistency vs CachedFs LIST (@coszio)
- **PR #10926** (2026-10-03): Refactor DiskCache live_preload fallback and unbounded tail fetch (@coszio)
- **PR #10924** (2026-10-03): [UniversalReadAsync] Add `from` parameter to `read_whole_into_async` (@coszio)
- **PR #10923** (2026-10-03): [AsyncRead] Unify `read_whole` and `read_whole_single` into `read_from` (@coszio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
