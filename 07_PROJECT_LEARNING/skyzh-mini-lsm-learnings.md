# Forensic Learning Record (Deep Inspection): skyzh/mini-lsm

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyzh-mini-lsm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyzh/mini-lsm](https://github.com/skyzh/mini-lsm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:26.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyzh/mini-lsm`
- **Description**: learn database internals by building a storage engine in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4173 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mini-lsm-mvcc/src/bin/compaction-simulator.rs`
```
../../../mini-lsm-starter/src/bin/compaction-simulator.rs
```

### Core Architecture Module: `mini-lsm-mvcc/src/bin/mini-lsm-cli.rs`
```
../../../mini-lsm-starter/src/bin/mini-lsm-cli.rs
```

### Core Architecture Module: `mini-lsm-mvcc/src/bin/wrapper.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pub mod mini_lsm_wrapper {
    pub use mini_lsm_mvcc::*;
}

#[allow(dead_code)]
fn main() {}

```

### Core Architecture Module: `mini-lsm-mvcc/src/block.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

mod builder;
mod iterator;

use anyhow::{Context, Result, ensure};
pub use builder::BlockBuilder;
use bytes::{BufMut, Bytes};
pub use iterator::BlockIterator;

pub(crate) const SIZEOF_U16: usize = std::mem::size_of::<u16>();

/// A block is the smallest unit of read and caching in LSM tree. It is a collection of sorted
/// key-value pairs.
pub struct Block {
    pub(crate) data: Vec<u8>,
    pub(crate) offsets: Vec<u16>,
}

impl Block {
    pub fn encode(&self) -> Bytes {
        let mut buf = self.data.clone();
        let offsets_len = self.offsets.len();
        for offset in &self.offsets {
            buf.put_u16(*offset);
        }
        // Adds number of elements at the end of the block
        buf.put_u16(offsets_len as u16);
        buf.into()
    }

    pub fn decode(data: &[u8]) -> Self {
        Self::decode_checked(data).expect("invalid block encoding")
    }

    pub(crate) fn decode_checked(data: &[u8]) -> Result<Self> {
        // get number of elements in the block
        ensure!(data.len() >= SIZEOF_U16, "block footer is truncated");
        let entry_offsets_len =
            u16::from_be_bytes([data[data.len() - 2], data[data.len() - 1]]) as usize;
        ensure!(entry_offsets_len > 0, "block has no entries");
        let offsets_size = entry_offsets_len
            .checked_mul(SIZEOF_U16)
            .context("block offset table is too large")?;
        let footer_size = offsets_size
            .checked_add(SIZEOF_U16)
            .context("block footer is too large")?;
        ensure!(footer_size <= data.len(), "block offset table is truncated");
        let data_end = data.len() - footer_size;
        let offsets_raw = &data[data_end..data.len() - SIZEOF_U16];
        // get offset array
        let offsets: Vec<u16> = offsets_raw
            .chunks(SIZEOF_U16)
            .map(|x| u16::from_be_bytes([x[0], x[1]]))
            .collect();
        ensure!(
            offsets[0] == 0,
            "first block entry must start at offset zero"
        );
        ensure!(
            offsets.windows(2).all(|pair| pair[0] < pair[1]),
            "block entry offsets are not strictly increasing"
        );
        ensure!(
            offsets.iter().all(|offset| usize::from(*offset) < data_end),
            "block entry offset is outside the data section"
        );

        let mut first_key_len = None;
        for (idx, offset) in offsets.iter().enumerate() {
            let entry_start = usize::from(*offset);
            let entry_end = offsets
                .get(idx + 1)
                .map_or(data_end, |offset| usize::from(*offset));
            let entry = &data[entry_start..entry_end];
            ensure!(entry.len() >= 14, "block entry header is truncated");
            let overlap = u16::from_be_bytes([entry[0], entry[1]]) as usize;
            let key_len = u16::from_be_bytes([entry[2], entry[3]]) as usize;
            if idx == 0 {
                ensure!(overlap == 0, "first block key has a nonzero overlap");
                first_key_len = Some(key_len);
            } else {
                ensure!(
                    overlap <= first_key_len.context("block is missing its first key")?,
                    "block key overlap exceeds the first key"
                );
            }
            let key_end = 4usize
                .checked_add(key_len)
                .context("block key length overflow")?;
            let value_len_offset = key_end
                .checked_add(std::mem::size_of::<u64>())
                .context("block timestamp offset overflow")?;
            let value_len_end = value_len_offset
                .checked_add(SIZEOF_U16)
                .context("block value header overflow")?;
            ensure!(
                value_len_end <= entry.len(),
                "block key, timestamp, or value length is truncated"
            );
            let value_len =
                u16::from_be_bytes([entry[value_len_offset], entry[value_len_offset + 1]]) as usize;
            let entry_len = value_len_end
                .checked_add(value_len)
                .context("block value length overflow")?;
            ensure!(entry_len == entry.len(), "block value length is invalid");
        }
        // retrieve data
        let data = data[0..data_end].to_vec();
        Ok(Self { data, offsets })
    }
}

```

### Core Architecture Module: `mini-lsm-mvcc/src/block/iterator.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::sync::Arc;

use bytes::Buf;

use crate::{
    block::SIZEOF_U16,
    key::{KeySlice, KeyVec},
};

use super::Block;

/// Iterates on a block.
pub struct BlockIterator {
    /// reference to the block
    block: Arc<Block>,
    /// the current key at the iterator position
    key: KeyVec,
    /// the current value range in the block.data, corresponds to the current key
    value_range: (usize, usize),
    /// the current index at the iterator position
    idx: usize,
    /// the first key in the block
    first_key: KeyVec,
}

impl Block {
    fn get_first_key(&self) -> KeyVec {
        let mut buf = &self.data[..];
        buf.get_u16();
        let key_len = buf.get_u16() as usize;
        let key = &buf[..key_len];
        buf.advance(key_len);
        KeyVec::from_vec_with_ts(key.to_vec(), buf.get_u64())
    }
}

impl BlockIterator {
    fn new(block: Arc<Block>) -> Self {
        Self {
            first_key: block.get_first_key(),
            block,
            key: KeyVec::new(),
            value_range: (0, 0),
            idx: 0,
        }
    }

    /// Creates a block iterator and seek to the first entry.
    pub fn create_and_seek_to_first(block: Arc<Block>) -> Self {
        let mut iter = Self::new(block);
        iter.seek_to_first();
        iter
    }

    /// Creates a block iterator and seek to the first key that >= `key`.
    pub fn create_and_seek_to_key(block: Arc<Block>, key: KeySlice) -> Self {
        let mut iter = Self::new(block);
        iter.seek_to_key(key);
        iter
    }

    /// Returns the key of the current entry.
    pub fn key(&self) -> KeySlice<'_> {
        debug_assert!(!self.key.is_empty(), "invalid iterator");
        self.key.as_key_slice()
    }

    /// Returns the value of the current entry.
    pub fn value(&self) -> &[u8] {
        debug_assert!(!self.key.is_empty(), "invalid iterator");
        &self.block.data[self.value_range.0..self.value_range.1]
    }

    /// Returns true if the iterator is valid.
    pub fn is_valid(&self) -> bool {
        !self.key.is_empty()
    }

    /// Seeks to the first key in the block.
    pub fn seek_to_first(&mut self) {
        self.seek_to(0);
    }

    /// Seeks to the idx-th key in the block.
    fn seek_to(&mut self, idx: usize) {
        if idx >= self.block.offsets.len() {
            self.key.clear();
            self.value_range = (0, 0);
            return;
        }
        let offset = self.block.offsets[idx] as usize;
        self.seek_to_offset(offset);
        self.idx = idx;
    }

    /// Move to the next key in the block.
    pub fn next(&mut self) {
        self.idx += 1;
        self.seek_to(self.idx);
    }

    /// Seek to the specified position and update the current `key` and `value`
    /// Index update will be handled by caller
    fn seek_to_offset(&mut self, offset: usize) {
        let mut entry = &self.block.data[offset..];
        // Since `get_u16()` will automatically move the ptr 2 bytes ahead here,
        // we don't need to manually advance it
        let overlap_len = entry.get_u16() as usize;
        let key_len = entry.get_u16() as usize;
        let key = &entry[..key_len];
        self.key.clear();
        self.key.append(&self.first_key.key_ref()[..overlap_len]);
        self.key.append(key);
        entry.advance(key_len);
        let ts = entry.get_u64();
        self.key.set_ts(ts);
        let value_len = entry.get_u16() as usize;
        // REMEMBER TO CHANGE THIS every time you change the encoding!
        let value_offset_begin =
            offset + SIZEOF_U16 + SIZEOF_U16 + std::mem::size_of::<u64>() + key_len + SIZEOF_U16;
        let value_offset_end = value_offset_begin + value_len;
        self.value_range = (value_offset_begin, value_offset_end);
        entry.advance(value_len);
    }

    /// Seek to the first key that is >= `key`.
    pub fn seek_to_key(&mut self, key: KeySlice) {
        let mut low = 0;
        let mut high = self.block.offsets.len();
        while low < high {
            let mid = low + (high - low) / 2;
            self.seek_to(mid);
            assert!(self.is_valid());
            match self.key().cmp(&key) {
                std::cmp::Ordering::Less => low = mid + 1,
                std::cmp::Ordering::Greater => high = mid,
                std::cmp::Ordering::Equal => return,
            }
        }
        self.seek_to(low);
    }
}

```

### Core Architecture Module: `mini-lsm-mvcc/src/compact.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

mod leveled;
mod simple_leveled;
mod tiered;

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
pub use leveled::{LeveledCompactionController, LeveledCompactionOptions, LeveledCompactionTask};
use serde::{Deserialize, Serialize};
pub use simple_leveled::{
    SimpleLeveledCompactionController, SimpleLeveledCompactionOptions, SimpleLeveledCompactionTask,
};
pub use tiered::{TieredCompactionController, TieredCompactionOptions, TieredCompactionTask};

use crate::iterators::StorageIterator;
use crate::iterators::concat_iterator::SstConcatIterator;
use crate::iterators::merge_iterator::MergeIterator;
use crate::iterators::two_merge_iterator::TwoMergeIterator;
use crate::key::KeySlice;
use crate::lsm_storage::{CompactionFilter, LsmStorageInner, LsmStorageState};
use crate::manifest::ManifestRecord;
use crate::table::{SsTable, SsTableBuilder, SsTableIterator};

#[derive(Debug, Serialize, Deserialize)]
pub enum CompactionTask {
    Leveled(LeveledCompactionTask),
    Tiered(TieredCompactionTask),
    Simple(SimpleLeveledCompactionTask),
    ForceFullCompaction {
        l0_sstables: Vec<usize>,
        l1_sstables: Vec<usize>,
    },
}

impl CompactionTask {
    fn compact_to_bottom_level(&self) -> bool {
        match self {
            CompactionTask::ForceFullCompaction { .. } => true,
            CompactionTask::Leveled(task) => task.is_lower_level_bottom_level,
            CompactionTask::Simple(task) => task.is_lower_level_bottom_level,
            CompactionTask::Tiered(task) => task.bottom_tier_included,
        }
    }
}

pub(crate) enum CompactionController {
    Leveled(LeveledCompactionController),
    Tiered(TieredCompactionController),
    Simple(SimpleLeveledCompactionController),
    NoCompaction,
}

impl CompactionController {
    pub fn generate_compaction_task(&self, snapshot: &LsmStorageState) -> Option<CompactionTask> {
        match self {
            CompactionController::Leveled(ctrl) => ctrl
                .generate_compaction_task(snapshot)
                .map(CompactionTask::Leveled),
            CompactionController::Simple(ctrl) => ctrl
                .generate_compaction_task(snapshot)
                .map(CompactionTask::Simple),
            CompactionController::Tiered(ctrl) => ctrl
                .generate_compaction_task(snapshot)
                .map(CompactionTask::Tiered),
            CompactionController::NoCompaction => unreachable!(),
        }
    }

    pub fn apply_compaction_result(
        &self,
        snapshot: &LsmStorageState,
        task: &CompactionTask,
        output: &[usize],
        in_recovery: bool,
    ) -> (LsmStorageState, Vec<usize>) {
        match (self, task) {
            (CompactionController::Leveled(ctrl), CompactionTask::Leveled(task)) => {
                ctrl.apply_compaction_result(snapshot, task, output, in_recovery)
            }
            (CompactionController::Simple(ctrl), CompactionTask::Simple(task)) => {
                ctrl.apply_compaction_result(snapshot, task, output)
            }
            (CompactionController::Tiered(ctrl), CompactionTask::Tiered(task)) => {
                ctrl.apply_compaction_result(snapshot, task, output)
            }
            _ => unreachable!(),
        }
    }
}

impl CompactionController {
    pub fn flush_to_l0(&self) -> bool {
        matches!(
            self,
            Self::Leveled(_) | Self::Simple(_) | Self::NoCompaction
        )
    }
}

#[derive(Debug, Clone)]
pub enum CompactionOptions {
    /// Leveled compaction with partial compaction + dynamic level support (= RocksDB's Leveled
    /// Compaction)
    Leveled(LeveledCompactionOptions),
    /// Tiered compaction (= RocksDB's universal compaction)
    Tiered(TieredCompactionOptions),
    /// Simple leveled compaction
    Simple(SimpleLeveledCompactionOptions),
    /// In no compaction mode (week 1), always flush to L0
    NoCompaction,
}

impl LsmStorageInner {
    fn compact_generate_sst_from_iter(
        &self,
        mut iter: impl for<'a> StorageIterator<KeyType<'a> = KeySlice<'a>>,
        compact_to_bottom_level: bool,
    ) -> Result<Vec<Arc<SsTable>>> {
        let mut builder = None;
        let mut entries_in_builder: usize = 0;
        let mut new_sst = Vec::new();
        let watermark = self.mvcc().watermark();
        let mut last_key = Vec::<u8>::new();
        let mut first_key_below_watermark = false;
        let compaction_filters = self.compaction_filters.lock().clone();
        'outer: while iter.is_valid() {
            if builder.is_none() {
                builder = Some(SsTableBuilder::new(self.options.block_size));
            }

            let same_as_last_key = iter.key().key_ref() == last_key;
            if !same_as_last_key {
                first_key_below_watermark = true;
            }

            if compact_to_bottom_level
                && !same_as_last_key
                && iter.key().ts() <= watermark
                && iter.value().is_empty()
            {
                last_key.clear();
                last_key.extend(iter.key().key_ref());
                iter.next()?;
                first_key_below_watermark = false;
                continue;
            }

            if iter.key().ts() <= watermark {
                if !first_key_below_watermark {
                    iter.next()?;
                    continue;
                }

                first_key_below_watermark = false;

                if !compaction_filters.is_empty() {
                    for filter in &compaction_filters {
                        match filter {
                            CompactionFilter::Prefix(x) => {
                                if iter.key().key_ref().starts_with(x) {
                                    iter.next()?;
                                    continue 'outer;
                                }
                            }
                        }
                    }
                }
            }

            let builder_inner = builder.as_mut().unwrap();

            if builder_inner.estimated_size() >= self.options.target_sst_size
                && !same_as_last_key
                && entries_in_builder > 0
            {
                let sst_id = self.next_sst_id();
                let old_builder = builder.take().unwrap();
                let sst = Arc::new(old_builder.build(
                    sst_id,
                    Some(self.block_cache.clone()),
                    self.path_of_sst(sst_id),
                )?);
                new_sst.push(sst);
                builder = Some(SsTableBuilder::new(self.options.block_size));
                entries_in_builder = 0;
            }

            let builder_inner = builder.as_mut().unwrap();
            builder_inner.add(iter.key(), iter.value());
            entries_in_builder += 1;

            if !same_as_last_key {
                last_key.clear();
                last_key.extend(iter.key().key_ref());
            }

            iter.next()?;
        }
        if let Some(builder) = builder
            && entries_in_builder > 0
        {
            let sst_id = self.next_sst_id(); // lock dropped here
            let sst = Arc::new(builder.build(
                sst_id,
                Some(self.block_cache.clone()),
                self.path_of_sst(sst_id),
            )?);
            new_sst.push(sst);
        }
        Ok(new_sst)
    }

    fn compact(&self, task: &CompactionTask) -> Result<Vec<Arc<SsTable>>> {
        let snapshot = {
            let state = self.state.read();
            state.clone()
        };
        match task {
            CompactionTask::ForceFullCompaction {
                l0_sstables,
                l1_sstables,
            } => {
                let mut l0_iters = Vec::with_capacity(l0_sstables.len());
                for id in l0_sstables.iter() {
                    l0_iters.push(Box::new(SsTableIterator::create_and_seek_to_first(
                        snapshot.sstables.get(id).unwrap().clone(),
                    )?));
                }
                let mut l1_iters = Vec::with_capacity(l1_sstables.len());
                for id in l1_sstables.iter() {
                    l1_iters.push(snapshot.sstables.get(id).unwrap().clone());
                }
                let iter = TwoMergeIterator::create(
                    MergeIterator::create(l0_iters),
                    SstConcatIterator::create_and_seek_to_first(l1_iters)?,
                )?;
                self.compact_generate_sst_from_iter(iter, task.compact_to_bottom_level())
            }
            CompactionTask::Simple(SimpleLeveledCompactionTask {
                upper_level,
                upper_level_sst_ids,
                lower_level: _,
                lower_level_sst_ids,
                ..
            })
            | CompactionTask::Leveled(LeveledCompactionTask {
                upper_level,
                upper_level_sst_ids,
                lower_level: _,
                lower_level_sst_ids,
                ..
            }) => match upper_level {
                Some(_) => {
                    let mut upper_ssts = Vec::with_capacity(upper_level_sst_ids.len());
                    for id in upper_level_sst_ids.iter() {
                        upper_ssts.push(snapshot.sstables.get(id).unwrap().clone());
                    }
                    let upper_ite
```

### Core Architecture Module: `mini-lsm-mvcc/src/compact/leveled.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::lsm_storage::LsmStorageState;

#[derive(Debug, Serialize, Deserialize)]
pub struct LeveledCompactionTask {
    // if upper_level is `None`, then it is L0 compaction
    pub upper_level: Option<usize>,
    pub upper_level_sst_ids: Vec<usize>,
    pub lower_level: usize,
    pub lower_level_sst_ids: Vec<usize>,
    pub is_lower_level_bottom_level: bool,
}

#[derive(Debug, Clone)]
pub struct LeveledCompactionOptions {
    pub level_size_multiplier: usize,
    pub level0_file_num_compaction_trigger: usize,
    pub max_levels: usize,
    pub base_level_size_mb: usize,
}

pub struct LeveledCompactionController {
    options: LeveledCompactionOptions,
}

impl LeveledCompactionController {
    pub fn new(options: LeveledCompactionOptions) -> Self {
        Self { options }
    }

    fn find_overlapping_ssts(
        &self,
        snapshot: &LsmStorageState,
        sst_ids: &[usize],
        in_level: usize,
    ) -> Vec<usize> {
        let begin_key = sst_ids
            .iter()
            .map(|id| snapshot.sstables[id].first_key())
            .min()
            .cloned()
            .unwrap();
        let end_key = sst_ids
            .iter()
            .map(|id| snapshot.sstables[id].last_key())
            .max()
            .cloned()
            .unwrap();
        let mut overlap_ssts = Vec::new();
        for sst_id in &snapshot.levels[in_level - 1].1 {
            let sst = &snapshot.sstables[sst_id];
            let first_key = sst.first_key();
            let last_key = sst.last_key();
            if !(last_key < &begin_key || first_key > &end_key) {
                overlap_ssts.push(*sst_id);
            }
        }
        overlap_ssts
    }

    pub fn generate_compaction_task(
        &self,
        snapshot: &LsmStorageState,
    ) -> Option<LeveledCompactionTask> {
        // step 1: compute target level size
        let mut target_level_size = (0..self.options.max_levels).map(|_| 0).collect::<Vec<_>>(); // exclude level 0
        let mut real_level_size = Vec::with_capacity(self.options.max_levels);
        let mut base_level = self.options.max_levels;
        for i in 0..self.options.max_levels {
            real_level_size.push(
                snapshot.levels[i]
                    .1
                    .iter()
                    .map(|x| snapshot.sstables.get(x).unwrap().table_size())
                    .sum::<u64>() as usize,
            );
        }
        let base_level_size_bytes = self.options.base_level_size_mb * 1024 * 1024;

        // select base level and compute target level size
        target_level_size[self.options.max_levels - 1] =
            real_level_size[self.options.max_levels - 1].max(base_level_size_bytes);
        for i in (0..(self.options.max_levels - 1)).rev() {
            let next_level_size = target_level_size[i + 1];
            let this_level_size = next_level_size / self.options.level_size_multiplier;
            if next_level_size > base_level_size_bytes {
                target_level_size[i] = this_level_size;
            }
            if target_level_size[i] > 0 {
                base_level = i + 1;
            }
        }

        // Flush L0 SST is the top priority
        if snapshot.l0_sstables.len() >= self.options.level0_file_num_compaction_trigger {
            println!("flush L0 SST to base level {}", base_level);
            return Some(LeveledCompactionTask {
                upper_level: None,
                upper_level_sst_ids: snapshot.l0_sstables.clone(),
                lower_level: base_level,
                lower_level_sst_ids: self.find_overlapping_ssts(
                    snapshot,
                    &snapshot.l0_sstables,
                    base_level,
                ),
                is_lower_level_bottom_level: base_level == self.options.max_levels,
            });
        }

        let mut priorities = Vec::with_capacity(self.options.max_levels);
        for level in 0..self.options.max_levels {
            let prio = real_level_size[level] as f64 / target_level_size[level] as f64;
            if prio > 1.0 {
                priorities.push((prio, level + 1));
            }
        }
        priorities.sort_by(|a, b| a.partial_cmp(b).unwrap().reverse());

        let priority = priorities.first();
        if let Some((_, level)) = priority {
            println!(
                "target level sizes: {:?}, real level sizes: {:?}, base_level: {}",
                target_level_size
                    .iter()
                    .map(|x| format!("{:.3}MB", *x as f64 / 1024.0 / 1024.0))
                    .collect::<Vec<_>>(),
                real_level_size
                    .iter()
                    .map(|x| format!("{:.3}MB", *x as f64 / 1024.0 / 1024.0))
                    .collect::<Vec<_>>(),
                base_level,
            );

            let level = *level;
            let selected_sst = snapshot.levels[level - 1].1.iter().min().copied().unwrap(); // select the oldest sst to compact
            println!(
                "compaction triggered by priority: {level} out of {:?}, select {selected_sst} for compaction",
                priorities
            );
            return Some(LeveledCompactionTask {
                upper_level: Some(level),
                upper_level_sst_ids: vec![selected_sst],
                lower_level: level + 1,
                lower_level_sst_ids: self.find_overlapping_ssts(
                    snapshot,
                    &[selected_sst],
                    level + 1,
                ),
                is_lower_level_bottom_level: level + 1 == self.options.max_levels,
            });
        }
        None
    }

    pub fn apply_compaction_result(
        &self,
        snapshot: &LsmStorageState,
        task: &LeveledCompactionTask,
        output: &[usize],
        in_recovery: bool,
    ) -> (LsmStorageState, Vec<usize>) {
        let mut snapshot = snapshot.clone();
        let mut files_to_remove = Vec::new();
        let mut upper_level_sst_ids_set = task
            .upper_level_sst_ids
            .iter()
            .copied()
            .collect::<HashSet<_>>();
        let mut lower_level_sst_ids_set = task
            .lower_level_sst_ids
            .iter()
            .copied()
            .collect::<HashSet<_>>();
        if let Some(upper_level) = task.upper_level {
            let new_upper_level_ssts = snapshot.levels[upper_level - 1]
                .1
                .iter()
                .filter_map(|x| {
                    if upper_level_sst_ids_set.remove(x) {
                        return None;
                    }
                    Some(*x)
                })
                .collect::<Vec<_>>();
            assert!(upper_level_sst_ids_set.is_empty());
            snapshot.levels[upper_level - 1].1 = new_upper_level_ssts;
        } else {
            let new_l0_ssts = snapshot
                .l0_sstables
                .iter()
                .filter_map(|x| {
                    if upper_level_sst_ids_set.remove(x) {
                        return None;
                    }
                    Some(*x)
                })
                .collect::<Vec<_>>();
            assert!(upper_level_sst_ids_set.is_empty());
            snapshot.l0_sstables = new_l0_ssts;
        }

        files_to_remove.extend(&task.upper_level_sst_ids);
        files_to_remove.extend(&task.lower_level_sst_ids);

        let mut new_lower_level_ssts = snapshot.levels[task.lower_level - 1]
            .1
            .iter()
            .filter_map(|x| {
                if lower_level_sst_ids_set.remove(x) {
                    return None;
                }
                Some(*x)
            })
            .collect::<Vec<_>>();
        assert!(lower_level_sst_ids_set.is_empty());
        new_lower_level_ssts.extend(output);
        // Don't sort the SST IDs during recovery because actual SSTs are not loaded at that point
        if !in_recovery {
            new_lower_level_ssts.sort_by(|x, y| {
                snapshot
                    .sstables
                    .get(x)
                    .unwrap()
                    .first_key()
                    .cmp(snapshot.sstables.get(y).unwrap().first_key())
            });
        }
        snapshot.levels[task.lower_level - 1].1 = new_lower_level_ssts;
        (snapshot, files_to_remove)
    }
}

```

### Core Architecture Module: `mini-lsm-mvcc/src/compact/simple_leveled.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::lsm_storage::LsmStorageState;

#[derive(Debug, Clone)]
pub struct SimpleLeveledCompactionOptions {
    pub size_ratio_percent: usize,
    pub level0_file_num_compaction_trigger: usize,
    pub max_levels: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimpleLeveledCompactionTask {
    // if upper_level is `None`, then it is L0 compaction
    pub upper_level: Option<usize>,
    pub upper_level_sst_ids: Vec<usize>,
    pub lower_level: usize,
    pub lower_level_sst_ids: Vec<usize>,
    pub is_lower_level_bottom_level: bool,
}

pub struct SimpleLeveledCompactionController {
    options: SimpleLeveledCompactionOptions,
}

impl SimpleLeveledCompactionController {
    pub fn new(options: SimpleLeveledCompactionOptions) -> Self {
        Self { options }
    }

    /// Generates a compaction task.
    ///
    /// Returns `None` if no compaction needs to be scheduled. The order of SSTs in the compaction task id vector matters.
    pub fn generate_compaction_task(
        &self,
        snapshot: &LsmStorageState,
    ) -> Option<SimpleLeveledCompactionTask> {
        let mut level_sizes = Vec::new();
        level_sizes.push(snapshot.l0_sstables.len());
        for (_, files) in &snapshot.levels {
            level_sizes.push(files.len());
        }

        // check level0_file_num_compaction_trigger for compaction of L0 to L1
        if snapshot.l0_sstables.len() >= self.options.level0_file_num_compaction_trigger {
            println!(
                "compaction triggered at level 0 because L0 has {} SSTs >= {}",
                snapshot.l0_sstables.len(),
                self.options.level0_file_num_compaction_trigger
            );
            return Some(SimpleLeveledCompactionTask {
                upper_level: None,
                upper_level_sst_ids: snapshot.l0_sstables.clone(),
                lower_level: 1,
                lower_level_sst_ids: snapshot.levels[0].1.clone(),
                is_lower_level_bottom_level: false,
            });
        }

        for i in 0..self.options.max_levels {
            if i == 0
                && snapshot.l0_sstables.len() < self.options.level0_file_num_compaction_trigger
            {
                continue;
            }

            let lower_level = i + 1;
            let size_ratio = level_sizes[lower_level] as f64 / level_sizes[i] as f64;
            if size_ratio < self.options.size_ratio_percent as f64 / 100.0 {
                println!(
                    "compaction triggered at level {} and {} with size ratio {}",
                    i, lower_level, size_ratio
                );
                return Some(SimpleLeveledCompactionTask {
                    upper_level: if i == 0 { None } else { Some(i) },
                    upper_level_sst_ids: if i == 0 {
                        snapshot.l0_sstables.clone()
                    } else {
                        snapshot.levels[i - 1].1.clone()
                    },
                    lower_level,
                    lower_level_sst_ids: snapshot.levels[lower_level - 1].1.clone(),
                    is_lower_level_bottom_level: lower_level == self.options.max_levels,
                });
            }
        }
        None
    }

    /// Apply the compaction result.
    ///
    /// The compactor will call this function with the compaction task and the list of SST ids generated. This function applies the
    /// result and generates a new LSM state. The functions should only change `l0_sstables` and `levels` without changing memtables
    /// and `sstables` hash map. Though there should only be one thread running compaction jobs, you should think about the case
    /// where an L0 SST gets flushed while the compactor generates new SSTs, and with that in mind, you should do some sanity checks
    /// in your implementation.
    pub fn apply_compaction_result(
        &self,
        snapshot: &LsmStorageState,
        task: &SimpleLeveledCompactionTask,
        output: &[usize],
    ) -> (LsmStorageState, Vec<usize>) {
        let mut snapshot = snapshot.clone();
        let mut files_to_remove = Vec::new();
        if let Some(upper_level) = task.upper_level {
            assert_eq!(
                task.upper_level_sst_ids,
                snapshot.levels[upper_level - 1].1,
                "sst mismatched"
            );
            files_to_remove.extend(&snapshot.levels[upper_level - 1].1);
            snapshot.levels[upper_level - 1].1.clear();
        } else {
            files_to_remove.extend(&task.upper_level_sst_ids);
            let mut l0_ssts_compacted = task
                .upper_level_sst_ids
                .iter()
                .copied()
                .collect::<HashSet<_>>();
            let new_l0_sstables = snapshot
                .l0_sstables
                .iter()
                .copied()
                .filter(|x| !l0_ssts_compacted.remove(x))
                .collect::<Vec<_>>();
            assert!(l0_ssts_compacted.is_empty());
            snapshot.l0_sstables = new_l0_sstables;
        }
        assert_eq!(
            task.lower_level_sst_ids,
            snapshot.levels[task.lower_level - 1].1,
            "sst mismatched"
        );
        files_to_remove.extend(&snapshot.levels[task.lower_level - 1].1);
        snapshot.levels[task.lower_level - 1].1 = output.to_vec();
        (snapshot, files_to_remove)
    }
}

```

### Core Architecture Module: `mini-lsm-mvcc/src/compact/tiered.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::lsm_storage::LsmStorageState;

#[derive(Debug, Serialize, Deserialize)]
pub struct TieredCompactionTask {
    pub tiers: Vec<(usize, Vec<usize>)>,
    pub bottom_tier_included: bool,
}

#[derive(Debug, Clone)]
pub struct TieredCompactionOptions {
    pub num_tiers: usize,
    pub max_size_amplification_percent: usize,
    pub size_ratio: usize,
    pub min_merge_width: usize,
    pub max_merge_width: Option<usize>,
}

pub struct TieredCompactionController {
    options: TieredCompactionOptions,
}

impl TieredCompactionController {
    pub fn new(options: TieredCompactionOptions) -> Self {
        Self { options }
    }

    pub fn generate_compaction_task(
        &self,
        snapshot: &LsmStorageState,
    ) -> Option<TieredCompactionTask> {
        assert!(
            snapshot.l0_sstables.is_empty(),
            "should not add l0 ssts in tiered compaction"
        );
        if snapshot.levels.len() < self.options.num_tiers {
            return None;
        }
        // compaction triggered by space amplification ratio
        let mut size = 0;
        for id in 0..(snapshot.levels.len() - 1) {
            size += snapshot.levels[id].1.len();
        }
        let space_amp_ratio =
            (size as f64) / (snapshot.levels.last().unwrap().1.len() as f64) * 100.0;
        if space_amp_ratio >= self.options.max_size_amplification_percent as f64 {
            println!(
                "compaction triggered by space amplification ratio: {}",
                space_amp_ratio
            );
            return Some(TieredCompactionTask {
                tiers: snapshot.levels.clone(),
                bottom_tier_included: true,
            });
        }
        let size_ratio_trigger = (100.0 + self.options.size_ratio as f64) / 100.0;
        // compaction triggered by size ratio
        let mut size = 0;
        for id in 0..(snapshot.levels.len() - 1) {
            size += snapshot.levels[id].1.len();
            let next_level_size = snapshot.levels[id + 1].1.len();
            let current_size_ratio = next_level_size as f64 / size as f64;
            if current_size_ratio > size_ratio_trigger && id + 1 >= self.options.min_merge_width {
                println!(
                    "compaction triggered by size ratio: {} > {}",
                    current_size_ratio * 100.0,
                    size_ratio_trigger * 100.0
                );
                return Some(TieredCompactionTask {
                    tiers: snapshot
                        .levels
                        .iter()
                        .take(id + 1)
                        .cloned()
                        .collect::<Vec<_>>(),
                    // Size ratio trigger will never include the bottom level
                    bottom_tier_included: false,
                });
            }
        }
        // trying to reduce sorted runs without respecting size ratio
        let num_tiers_to_take = snapshot
            .levels
            .len()
            .min(self.options.max_merge_width.unwrap_or(usize::MAX));
        println!("compaction triggered by reducing sorted runs");
        Some(TieredCompactionTask {
            tiers: snapshot
                .levels
                .iter()
                .take(num_tiers_to_take)
                .cloned()
                .collect::<Vec<_>>(),
            bottom_tier_included: snapshot.levels.len() == num_tiers_to_take,
        })
    }

    pub fn apply_compaction_result(
        &self,
        snapshot: &LsmStorageState,
        task: &TieredCompactionTask,
        output: &[usize],
    ) -> (LsmStorageState, Vec<usize>) {
        assert!(
            snapshot.l0_sstables.is_empty(),
            "should not add l0 ssts in tiered compaction"
        );
        let mut snapshot = snapshot.clone();
        let mut tier_to_remove = task
            .tiers
            .iter()
            .map(|(x, y)| (*x, y))
            .collect::<HashMap<_, _>>();
        let mut levels = Vec::new();
        let mut new_tier_added = false;
        let mut files_to_remove = Vec::new();
        for (tier_id, files) in &snapshot.levels {
            if let Some(ffiles) = tier_to_remove.remove(tier_id) {
                // the tier should be removed
                assert_eq!(ffiles, files, "file changed after issuing compaction task");
                files_to_remove.extend(ffiles.iter().copied());
            } else {
                // retain the tier
                levels.push((*tier_id, files.clone()));
            }
            if tier_to_remove.is_empty() && !new_tier_added && !output.is_empty() {
                // add the compacted tier to the LSM tree
                new_tier_added = true;
                levels.push((output[0], output.to_vec()));
            }
        }
        if !tier_to_remove.is_empty() {
            unreachable!("some tiers not found??");
        }
        snapshot.levels = levels;
        (snapshot, files_to_remove)
    }
}

```

### Core Architecture Module: `mini-lsm-mvcc/src/debug.rs`
```
../../mini-lsm-starter/src/debug.rs
```

### Core Architecture Module: `mini-lsm-mvcc/src/iterators.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pub mod concat_iterator;
pub mod merge_iterator;
pub mod two_merge_iterator;

pub trait StorageIterator {
    type KeyType<'a>: PartialEq + Eq + PartialOrd + Ord
    where
        Self: 'a;

    /// Get the current value.
    fn value(&self) -> &[u8];

    /// Get the current key.
    fn key(&self) -> Self::KeyType<'_>;

    /// Check if the current iterator is valid.
    fn is_valid(&self) -> bool;

    /// Move to the next position.
    fn next(&mut self) -> anyhow::Result<()>;

    /// Number of underlying active iterators for this iterator.
    fn num_active_iterators(&self) -> usize {
        1
    }
}

```

### Core Architecture Module: `mini-lsm-mvcc/src/iterators/concat_iterator.rs`
```
// Copyright (c) 2022-2026 Alex Chi Z
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::sync::Arc;

use anyhow::Result;

use crate::{
    key::KeySlice,
    table::{SsTable, SsTableIterator},
};

use super::StorageIterator;

/// Concat multiple iterators ordered in key order and their key ranges do not overlap. We do not want to create the
/// iterators when initializing this iterator to reduce the overhead of seeking.
pub struct SstConcatIterator {
    current: Option<SsTableIterator>,
    next_sst_idx: usize,
    sstables: Vec<Arc<SsTable>>,
}

impl SstConcatIterator {
    fn check_sst_valid(sstables: &[Arc<SsTable>]) {
        for sst in sstables {
            assert!(sst.first_key() <= sst.last_key());
        }
        if !sstables.is_empty() {
            for i in 0..(sstables.len() - 1) {
                assert!(sstables[i].last_key() < sstables[i + 1].first_key());
            }
        }
    }

    pub fn create_and_seek_to_first(sstables: Vec<Arc<SsTable>>) -> Result<Self> {
        Self::check_sst_valid(&sstables);
        if sstables.is_empty() {
            return Ok(Self {
                current: None,
                next_sst_idx: 0,
                sstables,
            });
        }
        let mut iter = Self {
            current: Some(SsTableIterator::create_and_seek_to_first(
                sstables[0].clone(),
            )?),
            next_sst_idx: 1,
            sstables,
        };
        iter.move_until_valid()?;
        Ok(iter)
    }

    pub fn create_and_seek_to_key(sstables: Vec<Arc<SsTable>>, key: KeySlice) -> Result<Self> {
        Self::check_sst_valid(&sstables);
        let idx: usize = sstables
            .partition_point(|table| table.first_key().as_key_slice() <= key)
            .saturating_sub(1);
        if idx >= sstables.len() {
            return Ok(Self {
                current: None,
                next_sst_idx: sstables.len(),
                sstables,
            });
        }
        let mut iter = Self {
            current: Some(SsTableIterator::create_and_seek_to_key(
                sstables[idx].clone(),
                key,
            )?),
            next_sst_idx: idx + 1,
            sstables,
        };
        iter.move_until_valid()?;
        Ok(iter)
    }

    fn move_until_valid(&mut self) -> Result<()> {
        while let Some(iter) = self.current.as_mut() {
            if iter.is_valid() {
                break;
            }
            if self.next_sst_idx >= self.sstables.len() {
                self.current = None;
            } else {
                self.current = Some(SsTableIterator::create_and_seek_to_first(
                    self.sstables[self.next_sst_idx].clone(),
                )?);
                self.next_sst_idx += 1;
            }
        }
        Ok(())
    }
}

impl StorageIterator for SstConcatIterator {
    type KeyType<'a> = KeySlice<'a>;

    fn key(&self) -> KeySlice<'_> {
        self.current.as_ref().unwrap().key()
    }

    fn value(&self) -> &[u8] {
        self.current.as_ref().unwrap().value()
    }

    fn is_valid(&self) -> bool {
        if let Some(current) = &self.current {
            assert!(current.is_valid());
            true
        } else {
            false
        }
    }

    fn next(&mut self) -> Result<()> {
        self.current.as_mut().unwrap().next()?;
        self.move_until_valid()?;
        Ok(())
    }

    fn num_active_iterators(&self) -> usize {
        1
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #234** (2026-09-23): **Move memtable freeze question to Week 1 Day 6**
  *Symptoms*: ## Summary  Move the stale-snapshot memtable question from Week 1 Day 1 to Day 6. The Day 6 version asks learners to inspect the state read-lock scope in `put` and reason about the cached-`Arc` failure case after they have completed the Week 1 write path.  This is a book-only, two-line change: one question removed and one question added. No code, starter, test, or navigation file changes.  ## Validation  - The mdBook build passed with output directed to a temporary directory, and the rendered Day 1 and Day 6 placements were checked. - Independent factual/concurrency review: GO on commit `a0a3418b28315949ebb1658a70ab83fd44c53484`. - Independent learner review: WALKABLE on the same commit.  AI-Assisted: GPT-6 Sol + Sentinel 

- **Issue #232** (2026-09-11): **fix: repair two broken links and a malformed solutions entry**
  *Symptoms*: Three small, independent documentation repairs found while link-checking the book and repo docs. All three are user-visible on the published site.  ### 1. `mini-lsm-book/src/00-preface.md` — the CMU 15-445 link does not resolve  The href is missing its `.edu` top-level domain:  - before: `https://15445.courses.cs.cmu` - after: `https://15445.courses.cs.cmu.edu/`  The same sentence already links two working `https://15445.courses.cs.cmu.edu/...` pages, so this is a truncation rather than an intentional short link. The truncated host does not resolve at all, and the broken href is live on <https://skyzh.github.io/mini-lsm/00-preface.html>.  ### 2. `mini-lsm-book/src/week3-06-serializable.md` — the BadgerDB citation is a 404  `https://dgraph.io/blog/post/badger-txn/` now returns 404; the entire `/blog/` path is gone, so there is no live replacement for that specific post. I pointed the link at the project repository instead, which matches how the other links in the same paragraph reference projects ([RisingLight](https://github.com/risinglightdb/risinglight), [type-exercise-in-rust](https://github.com/skyzh/type-exercise-in-rust), [write-you-a-vector-db](https://github.com/skyzh/write-you-a-vector-db)). Happy to use an archived copy of the original post instead if you would rather preserve the exact citation.  ### 3. `SOLUTIONS.md` — malformed list entry  The `tiny-lsm` entry added in #176 has a duplicated leading `* ` and a stray `)`, so it renders as `* mehrdad3301/tiny-lsm): 

- **Issue #231** (2026-09-11): **Clarify Week 1 Day 1 memtable ownership**
  *Symptoms*: ## Why  Week 1 Day 1 asks learners to use the memtable before clearly assigning its plain constructor, while later WAL examples can look like work required for the same day.  ## Change  - Assign `MemTable::create` alongside `get` and `put` in the Day 1 chapter. - Mark the WAL-backed constructors and operations as future Week 2 Day 6 work. - Add concise course-day ownership comments to the directly related starter APIs.  ## Review note  This changes prose and doc comments only. Signatures, implementations, TODOs, tests, and commands are unchanged. The Day 1 learner command still selects the same six WAL-disabled tests and reaches the intended starter TODO boundary.  AI-Assisted: GPT-5.6 Sol + Forge 

- **Issue #230** (2026-09-05): **chore: advance course crates after 0.3 publication**
  *Symptoms*: ## Summary  - publish the real `mini-lsm` and `mini-lsm-mvcc` packages at 0.3.0 - publish the reserved `mini-lsm-starter` placeholder at 0.3.0 because the learner crate remains intentionally non-publishable - advance the workspace and starter package metadata to 0.4.0-alpha.1 - refresh only the four workspace package versions in `Cargo.lock`  ## Why  The three public crate names now have live, unyanked 0.3.0 releases. Keeping the repository at 0.4.0-alpha.1 distinguishes the continuing course source from the registry release while accurately marking the next line as prerelease work.  The workspace currently has no local directory dependencies, so there are no `path` dependencies that need an accompanying `version` requirement.  ## Verification  - `cargo publish --dry-run --allow-dirty -p mini-lsm` - `cargo publish --dry-run --allow-dirty -p mini-lsm-mvcc` - `cargo publish --dry-run --allow-dirty --manifest-path mini-lsm-starter-placeholder-03/Cargo.toml` - `cargo check --workspace --all-targets` - `git diff --check`  This PR does not create a Git tag or GitHub release, merge itself, or deploy the course. 

- **Issue #229** (2026-08-09): **Add agent-track link to Mini-LSM sponsor page**
  *Symptoms*: ## Why  The sponsor page should provide useful links to the project and both course tracks.  ## What changed  - Added “Start the agent track” at the true coding-agent entry point. - Preserved the existing sponsor page, GitHub link, and course-start link unchanged.  AI-Assisted: GPT-5.6 Sol + Forge 

- **Issue #228** (2026-08-08): **Add CTA links to the Sponsor page**
  *Symptoms*: ## Why  The sponsor page should provide useful links to the project and course.  ## What changed  Added two calls to action at the bottom of the sponsor page: "View on GitHub" and "Start the course from the beginning →". Responsive CSS with flex layout.  AI-Assisted: DeepSeek V4 Pro + Sentinel

- **Issue #227** (2026-08-08): **Align README with published Week 4 closing chapter**
  *Symptoms*: ## Why  PR #226 replaced the empty Week 4 TBD table with a full closing chapter, but the README still says "open-ended collection of future optimizations" and "Optional optimizations (TBD)".  ## What changed  Two-line README-only fix: replaced stale descriptions with wording that matches the published closing chapter.  AI-Assisted: DeepSeek V4 Pro + Sentinel

- **Issue #226** (2026-08-08): **Turn Week 4 into the Mini-LSM closing chapter**
  *Symptoms*: ## Why  The Week 4 overview still reads like an unavailable-content placeholder and ends with an empty planning table. Learners who finish the course need a real conclusion that recognizes what they built and helps them choose a meaningful next project.  ## What changed  Replaced the table with a narrative recap of Weeks 1–3, a congratulations and systems-engineering takeaway, and grouped expansion paths covering measurement, physical formats, compaction and I/O, data-model extensions, and database layers. Updated the book navigation to remove the TBD marker while preserving the original “The Rest of Your Life” title.  ## Review note  `mdbook build` succeeds. `mdbook test` still fails across existing chapters because many shell, path, pseudocode, and partial Rust fences are treated as Rust doctests; the new closing chapter itself reports no doctest failure.  AI-Assisted: GPT-5.6 Sol + Cindy Reviewed-by: DeepSeek V4 Pro + Sentinel (editorial) Reviewed-by: DeepSeek V4 Flash + Scholar (learner) 

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

### Incident Patch 1: `aba65da9` (2026-09-11)
**Commit Message**: fix: repair two broken links and a malformed solutions entry (#232)

Three small, independent documentation repairs found while link-checking
the book and repo docs. All three are user-visible on the published
site.

### 1. `mini-lsm-book/src/00-preface.md` — the CMU 15-445 link does not
resolve

The href is missing its `.edu` top-level domain:

- before: `https://15445.courses.cs.cmu`
- after: `https://15445.courses.cs.cmu.edu/`

The same sentence already links two working
`https://15445.courses.cs.cmu.edu/...` pages, so this is a truncation
rather than an intentional short link. The truncated host does not
resolve at all, and the broken href is live on
<https://skyzh.github.io/mini-lsm/00-preface.html>.

### 2. `mini-lsm-book/src/week3-06-serializable.md` — the BadgerDB
citation is a 404

`https://dgraph.io/blog/post/badger-txn/` now returns 404; the entire
`/blog/` path is gone, so there is no live replacement for that specific
post. I pointed the link at the project repository instead, which
matches how the other links in the same paragraph reference projects
([RisingLight](https://github.com/risinglightdb/risinglight),
[type-exercise-in-rust](https://github.com/skyzh/type-exer

**File**: `SOLUTIONS.md` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ You can add your solution to this page once you finish any full week of the cour
 * [skyzh/mini-lsm-solution-checkpoint](https://github.com/skyzh/mini-lsm-solution-checkpoint): The author's solution of Mini-LSM.
 * [fh/solution](https://github.com/Foreverhighness/mini-lsm/tree/solution): A solution which makes it easy to change the mvcc version, implementing in rust idiom way.
 * [Duckulus/mini-lsm-solution](https://github.com/Duckulus/mini-lsm-solution): Full implementation of mini-lsm with a commit for each day of the course
-* * [mehrdad3301/tiny-lsm](https://github.com/mehrdad3301/tiny-lsm)): Implementation of mini-lsm with day-by-day commit history + benchmarking and async refactor on top of week-3. 
+* [mehrdad3301/tiny-lsm](https://github.com/mehrdad3301/tiny-lsm): Implementation of mini-lsm with day-by-day commit history + benchmarking and async refactor on top of week-3.
```

**File**: `mini-lsm-book/src/00-preface.md` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ Next, read the [Mini-LSM Course Overview](./00-overview.md) for an introduction
 
 ## About the Author
 
-At the time of writing in early 2024, Chi held a master's degree in computer science from Carnegie Mellon University and a bachelor's degree from Shanghai Jiao Tong University. He had worked on several database systems, including [TiKV][db1], [AgateDB][db2], [TerarkDB][db3], [RisingWave][db4], and [Neon][db5]. Beginning in 2022, he served for three semesters as a teaching assistant for [CMU's Database Systems course](https://15445.courses.cs.cmu), working on the BusTub educational system. There, he added new features and challenges to the course, including the redesigned [query execution](https://15445.courses.cs.cmu.edu/fall2022/project3/) project and the demanding [multi-version concurrency control](https://15445.courses.cs.cmu.edu/fall2023/project4/) project. He also maintains the [RisingLight](https://github.com/risinglightdb/risinglight) educational database system. Chi is interested in exploring Rust's role in the database world. If you share that interest, see his earlier courses on building a vectorized expression framework, [type-exercise-in-rust](https://github.com/skyzh/type-exercise-in-rust), and a vector database, [write-you-a-vector-db](https://github.com/skyzh/write-you-a-vector-db).
+At the time of writing in early 2024, Chi held a master's degree in computer science from Carnegie Mellon University and a bachelor's degree from Shanghai Jiao Tong University. He had worked on several database systems, including [TiKV][db1], [AgateDB][db2], [TerarkDB][db3], [RisingWave][db4], and [Neon][db5]. Beginning in 2022, he served for three semesters as a teaching assistant for [CMU's Database Systems course](https://15445.courses.cs.cmu.edu/), working on the BusTub educational system. There, he added new features and challenges to the course, including the redesigned [query execution](https://15445.courses.cs.cmu.edu/fall2022/project3/) project and the demanding [multi-version concurrency control](https://15445.courses.cs.cmu.edu/fall2023/project4/) project. He also maintains the [RisingLight](https://github.com/risinglightdb/risinglight) educational database system. Chi is interested in exploring Rust's role in the database world. If you share that interest, see his earlier courses on building a vectorized expression framework, [type-exercise-in-rust](https://github.com/skyzh/type-exercise-in-rust), and a vector database, [write-you-a-vector-db](https://github.com/skyzh/write-you-a-vector-db).
 
 [db1]: https://github.com/tikv/tikv
 [db2]: https://github.com/tikv/agatedb
```

**File**: `mini-lsm-book/src/week3-06-serializable.md` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ Verify these cases explicitly:
 
 * If you have some experience with building a relational database, you may think about the following question: assume that we build a database based on Mini-LSM where we store each row in the relation table as a key-value pair (key: primary key, value: serialized row) and enable serializable verification, does the database system directly gain ANSI serializable isolation level capability? Why or why not?
 * The point-key rule is related to write snapshot isolation (see [A critique of snapshot isolation](https://dl.acm.org/doi/abs/10.1145/2168836.2168853)): it aborts on any relevant read-after-snapshot write conflict instead of detecting only cycles. Construct a serializable execution that this conservative rule still rejects.
-* There are databases that claim they have serializable snapshot isolation support by only tracking the keys accessed in gets and scans (instead of key range). Do they really prevent write skews caused by phantoms? (Okay... Actually, I'm talking about [BadgerDB](https://dgraph.io/blog/post/badger-txn/).)
+* There are databases that claim they have serializable snapshot isolation support by only tracking the keys accessed in gets and scans (instead of key range). Do they really prevent write skews caused by phantoms? (Okay... Actually, I'm talking about [BadgerDB](https://github.com/dgraph-io/badger).)
 * Why must `commit_lock` cover both validation and publication? Construct an interleaving that fails if the lock is released between them.
 * Why does a `get` miss belong in the read set?
 * Why can two transactions that only write the same key both commit without violating serializability?
```

---

### Incident Patch 2: `6478cca9` (2026-08-08)
**Commit Message**: Make leveled simulator traces reproducible (#217)

## Why

The dynamic-leveled compaction simulator generated mock SST key ranges
from an unseeded RNG. Identical learner/reference commands could
therefore select different overlap sets and report different write/space
amplification, while an archived walkthrough presented one unseeded run
as exact evidence.

## What changed

- add an explicit `--seed <u64>` to the leveled simulator (default
`42`), seed one shared RNG per run, and print the seed in the trace;
- document that learner/reference comparisons must use the same source
revision, `Cargo.lock`, options, and explicit seed;
- mark the archived unseeded dynamic-leveled metrics as historical
illustrations rather than reproducible evidence;
- keep simple and tiered simulator behavior unchanged.

Validation:

- `cargo x ci`: format/check/clippy, 159/159 standard+MVCC+xtask tests,
and mdBook build passed;
- `mini-lsm-book/sitemap.sh --check`: passed;
- two 50-iteration standard reference runs at seed 42 were
byte-identical (`f862b233…`), and the MVCC reference produced the same
trace;
- seed 43 produced a different trace (`f5fcd3ad…`), proving the workload
is seed-controlled;
- stan

**File**: `mini-lsm-book/src/week2-04-leveled.md` (modified, +12/-4)
```diff
@@ -53,11 +53,17 @@ In this chapter, you will implement a more realistic leveled compaction strategy
 src/compact/leveled.rs
 ```
 
-To run the compaction simulator,
+To run the compaction simulator with a recorded workload seed,
 
+```shell
+cargo run --locked --bin compaction-simulator -- leveled --seed 42
 ```
-cargo run --bin compaction-simulator leveled
-```
+
+The seed controls the mock SST key ranges. When you compare learner and
+reference output, run both binaries from the same checkout and `Cargo.lock`
+with the same explicit seed. Changing the seed changes the workload. The
+default is `42`, but include `--seed` in saved evidence so another person can
+replay it.
 
 ### Task 1.1: Compute Target Sizes
 
@@ -148,7 +154,9 @@ After choosing the upper SST, find every lower-level SST whose key range overlap
 
 When compaction completes, remove the selected files and insert the outputs in the correct lower-level position. In every level except L0, keep SST IDs ordered by first key.
 
-Running the compaction simulator, you should see:
+Running the compaction simulator, you should see the same structural behavior.
+The IDs and key ranges in this excerpt are illustrative; compare exact values
+only when the source revision, lockfile, options, and seed are the same:
 
 ```
 --- After Compaction ---
```

**File**: `mini-lsm-book/src/week2-fast-forward.md` (modified, +6/-1)
```diff
@@ -158,9 +158,14 @@ Use these simulator commands without consulting the reference implementation:
 ```shell
 cargo run --bin compaction-simulator simple
 cargo run --bin compaction-simulator tiered
-cargo run --bin compaction-simulator leveled
+cargo run --locked --bin compaction-simulator -- leveled --seed 42
 ```
 
+The leveled simulator's seed controls its mock SST key ranges. Record the seed
+with the trace, and use the same source checkout, `Cargo.lock`, options, and
+seed for any authorized learner/reference comparison. A different seed is a
+different workload.
+
 For at least one trace per policy, annotate the selected inputs, the reason the task fired, whether it reaches the bottom, the source that wins equal keys, and the files that remain afterward. Change one threshold and predict the next task before rerunning the simulator.
 
 ## Checkpoint 3: Recover the Live State
```

**File**: `mini-lsm-mvcc/agent-walkthroughs/week2.md` (modified, +16/-0)
```diff
@@ -1,5 +1,13 @@
 # Week 2 Student–Apprentice Walkthrough
 
+> **Archive reproducibility note:** The dynamic-leveled simulator commands and
+> exact amplification/space figures captured below predate the simulator's
+> `--seed` option. Treat those numbers as historical observations, not
+> reproducible evidence. To reproduce a current trace, run learner and
+> reference binaries from the same source revision and `Cargo.lock` with the
+> same explicit `--seed` and options. The simple and tiered traces do not
+> generate random key ranges and are unaffected.
+
 ## Setup
 
 ### Student
@@ -1861,6 +1869,10 @@ Trace annotation (`max_levels=4`, `base_level_size_mb=128`, multiplier 2, 32 MiB
 - The L0 tasks select every L4 SST overlapping the combined L0 key envelope. The observed broad envelopes select zero, two, and then four lower SSTs, respectively; outputs are restored in first-key order.
 - Final level counts are `L0=0, L1=0, L2=0, L3=0, L4=6`; the trace reports 3.000x write amplification, 2.000x maximum space usage, and 1x read amplification.
 
+> **Archive note:** This run did not record a workload seed. Its exact
+> amplification and space figures are illustrative and must not be used as
+> reproducible comparison evidence.
+
 Important expression (`src/compact/leveled.rs:68`):
 
 ```rust
@@ -3591,6 +3603,10 @@ Observed outcome: exit status 0 for the combined command.
 - Tiered accumulated eight single-SST tiers through iteration 7, then compacted all eight into eight output SSTs; its final level counts were `0 8`, with 2.000x write amplification, 2.000x maximum space amplification, and 1x read amplification.
 - Leveled triggered L0-to-L4 compactions at iterations 1, 3, and 5; its final level counts were `0 0 0 0 6`, with 2.667x write amplification, 1.667x maximum space amplification, and 1x read amplification.
 
+> **Archive note:** The leveled command above did not record a workload seed.
+> Its exact amplification and space figures are illustrative; reproduce the
+> workload with the current explicit-seed command before making a comparison.
+
 ### 78. Re-run the six focused Checkpoint 4 tests after restoring the fault
 
 ```shell
```

**File**: `mini-lsm-starter/src/bin/compaction-simulator.rs` (modified, +15/-8)
```diff
@@ -28,6 +28,8 @@ use mini_lsm_wrapper::key::KeyBytes;
 use mini_lsm_wrapper::lsm_storage::LsmStorageState;
 use mini_lsm_wrapper::mem_table::MemTable;
 use mini_lsm_wrapper::table::SsTable;
+use rand::rngs::StdRng;
+use rand::{Rng, RngExt, SeedableRng};
 
 #[derive(Parser, Debug)]
 #[command(author, version, about, long_about = None)]
@@ -102,6 +104,10 @@ enum Args {
         iterations: usize,
         #[clap(long, default_value = "32")]
         sst_size_mb: usize,
+        /// Seed for the mock SST key ranges. Use the same seed when comparing
+        /// learner and reference output.
+        #[clap(long, default_value = "42")]
+        seed: u64,
     },
 }
 
@@ -236,15 +242,13 @@ impl MockStorage {
     }
 }
 
-fn generate_random_key_range() -> (KeyBytes, KeyBytes) {
-    use rand::RngExt;
-    let mut rng = rand::rng();
-    let begin: usize = rng.random_range(0..(1 << 31));
-    let end: usize = begin + rng.random_range((1 << 10)..(1 << 31));
+fn generate_random_key_range<R: Rng + ?Sized>(rng: &mut R) -> (KeyBytes, KeyBytes) {
+    let begin: u64 = rng.random_range(0..(1 << 31));
+    let end: u64 = begin + rng.random_range((1 << 10)..(1 << 31));
     let mut begin_bytes = BytesMut::new();
     let mut end_bytes = BytesMut::new();
-    begin_bytes.put_u64(begin as u64);
-    end_bytes.put_u64(end as u64);
+    begin_bytes.put_u64(begin);
+    end_bytes.put_u64(end);
     (
         KeyBytes::for_testing_from_bytes_no_ts(begin_bytes.freeze()),
         KeyBytes::for_testing_from_bytes_no_ts(end_bytes.freeze()),
@@ -499,6 +503,7 @@ fn main() {
             base_level_size_mb,
             iterations,
             sst_size_mb,
+            seed,
         } => {
             let controller = LeveledCompactionController::new(LeveledCompactionOptions {
                 level0_file_num_compaction_trigger,
@@ -508,14 +513,16 @@ fn main() {
             });
 
             let mut storage = MockStorage::new();
+            let mut rng = StdRng::seed_from_u64(seed);
+            println!("Seed: {seed}");
             for i in 0..max_levels {
                 storage.snapshot.levels.push((i + 1, Vec::new()));
             }
             let mut max_space = 0;
             for i in 0..iterations {
                 println!("=== Iteration {i} ===");
                 let id = storage.flush_sst_to_l0();
-                let (first_key, last_key) = generate_random_key_range();
+                let (first_key, last_key) = generate_random_key_range(&mut rng);
                 storage.snapshot.sstables.insert(
                     id,
                     Arc::new(SsTable::create_meta_only(
```

---

### Incident Patch 3: `6875d0d1` (2026-07-26)
**Commit Message**: fix typo reference to `LsmIterator` to avoid slight confusion (#203)

* fix typo reference to LsmIterator

* typo

**File**: `mini-lsm-book/src/week2-01-compaction.md` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ src/compact.rs
 
 Now update the two-level read path to use the concat iterator for L1.
 
-Change the inner iterator type of `LsmStorageIterator`. Merge the memtable and L0 iterators first, then use `TwoMergeIterator` to combine that newer stream with the L1 concat iterator.
+Change the inner iterator type of `LsmIterator`. Merge the memtable and L0 iterators first, then use `TwoMergeIterator` to combine that newer stream with the L1 concat iterator.
 
 You can also change your compaction implementation to leverage the concat iterator.
 
```

**File**: `mini-lsm-book/src/week2-02-simple.md` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ src/lsm_iterator.rs
 src/lsm_storage.rs
 ```
 
-Extend both `get` and `scan` across every level below L1. Change the inner type of `LsmStorageIterator` so that it merges one `SstConcatIterator` per level.
+Extend both `get` and `scan` across every level below L1. Change the inner type of `LsmIterator` so that it merges one `SstConcatIterator` per level.
 
 To test your implementation interactively,
 
```

---

### Incident Patch 4: `2efead93` (2026-07-26)
**Commit Message**: fix: tolerate a concurrently drained flush queue (#198)

Assisted-by: Codex

**File**: `mini-lsm-book/src/week1-06-write-path.md` (modified, +6/-1)
```diff
@@ -56,6 +56,8 @@ We have not yet discussed level 0 (L0). It contains SST files produced directly
 
 Creating an SST is computationally expensive and involves I/O. Do not hold the `state` read-write lock throughout this work: doing so could block other operations and cause large latency spikes. The `state_lock` mutex serializes operations that modify the LSM-tree state. Use both locks carefully to prevent races while keeping critical sections short.
 
+A caller can observe a non-empty immutable-memtable list before acquiring `state_lock`, then find that another flush drained the list first. Recheck the list while holding `state_lock` and return successfully when it is already empty.
+
 The test suite does not exercise all concurrent cases, so reason carefully about synchronization. The last memtable in `imm_memtables` is the oldest and therefore the one to flush.
 
 <details>
@@ -68,7 +70,10 @@ fn force_flush_next_imm_memtable(&self) -> Result<()> {
 
     let memtable_to_flush = {
         let guard = self.state.read();
-        guard.imm_memtables.last().unwrap().clone()
+        let Some(memtable) = guard.imm_memtables.last() else {
+            return Ok(());
+        };
+        memtable.clone()
     };
 
     let sst_id = memtable_to_flush.id();
```

**File**: `mini-lsm-mvcc/src/lsm_storage.rs` (modified, +6/-9)
```diff
@@ -731,16 +731,13 @@ impl LsmStorageInner {
     pub fn force_flush_next_imm_memtable(&self) -> Result<()> {
         let state_lock = self.state_lock.lock();
 
-        let flush_memtable;
-
-        {
+        let flush_memtable = {
             let guard = self.state.read();
-            flush_memtable = guard
-                .imm_memtables
-                .last()
-                .expect("no imm memtables!")
-                .clone();
-        }
+            let Some(flush_memtable) = guard.imm_memtables.last() else {
+                return Ok(());
+            };
+            flush_memtable.clone()
+        };
 
         let mut builder = SsTableBuilder::new(self.options.block_size);
         flush_memtable.flush(&mut builder)?;
```

**File**: `mini-lsm-mvcc/src/tests/week3_day4.rs` (modified, +13/-0)
```diff
@@ -27,6 +27,19 @@ use super::harness::{
     check_iter_result_by_key, construct_merge_iterator_over_storage, dump_files_in_dir,
 };
 
+#[test]
+fn test_force_flush_empty_imm_memtable() {
+    let dir = tempdir().unwrap();
+    let options = LsmStorageOptions::default_for_week2_test(CompactionOptions::NoCompaction);
+    let storage = MiniLsm::open(&dir, options).unwrap();
+
+    storage.inner.force_flush_next_imm_memtable().unwrap();
+
+    let state = storage.inner.state.read();
+    assert!(state.imm_memtables.is_empty());
+    assert!(state.l0_sstables.is_empty());
+}
+
 #[test]
 fn test_task3_compaction_keeps_versions_together() {
     let dir = tempdir().unwrap();
```

**File**: `mini-lsm/src/lsm_storage.rs` (modified, +6/-9)
```diff
@@ -673,16 +673,13 @@ impl LsmStorageInner {
     pub fn force_flush_next_imm_memtable(&self) -> Result<()> {
         let state_lock = self.state_lock.lock();
 
-        let flush_memtable;
-
-        {
+        let flush_memtable = {
             let guard = self.state.read();
-            flush_memtable = guard
-                .imm_memtables
-                .last()
-                .expect("no imm memtables!")
-                .clone();
-        }
+            let Some(flush_memtable) = guard.imm_memtables.last() else {
+                return Ok(());
+            };
+            flush_memtable.clone()
+        };
 
         let mut builder = SsTableBuilder::new(self.options.block_size);
         flush_memtable.flush(&mut builder)?;
```

**File**: `mini-lsm/src/tests/week1_day6.rs` (modified, +13/-0)
```diff
@@ -25,6 +25,19 @@ use crate::{
     lsm_storage::{LsmStorageInner, LsmStorageOptions, MiniLsm},
 };
 
+#[test]
+fn test_force_flush_empty_imm_memtable() {
+    let dir = tempdir().unwrap();
+    let storage =
+        Arc::new(LsmStorageInner::open(&dir, LsmStorageOptions::default_for_week1_test()).unwrap());
+
+    storage.force_flush_next_imm_memtable().unwrap();
+
+    let state = storage.state.read();
+    assert!(state.imm_memtables.is_empty());
+    assert!(state.l0_sstables.is_empty());
+}
+
 #[test]
 fn test_task1_storage_scan() {
     let dir = tempdir().unwrap();
```

---

### Incident Patch 5: `a0bcb71c` (2026-07-23)
**Commit Message**: refine fast-forward agent learning loop (#194)

Assisted-by: Codex

**File**: `mini-lsm-book/src/agent-fast-forward-overview.md` (modified, +44/-27)
```diff
@@ -4,9 +4,9 @@
 
 # Agent Fast Forward in 3 Days (WIP)
 
-This is an alternative course track for students who intend to use a coding agent. Instead of following seven chapters for each course phase, you will use one focused day to specify, generate, review, and challenge a complete system.
+This is an alternative course track for students who intend to use a coding agent. The agent will write much of the code, but it must not silently design the system for you. Each day is a dialogue in which you make the consequential decisions, the agent turns a few accepted decisions into a small code change, and tests challenge the shared model.
 
-The agent may write most of the code. Your job is to define what correct means, constrain the work, inspect the result, and leave with a mental model you can use without the agent.
+Fast forward means compressing implementation time, not compressing the design into one generated answer.
 
 | Fast-forward day | Original course material | Outcome |
 | --- | --- | --- |
@@ -44,54 +44,71 @@ pwd
 # Start your coding agent here using the command for your tool.
 ```
 
-The final component of `pwd` should be `mini-lsm-starter`. This matters for two reasons:
+The final component of `pwd` should be `mini-lsm-starter`. This matters because repository-aware agents discover the `AGENTS.md` in this directory and begin with the starter as their working scope.
 
-1. repository-aware agents discover the `AGENTS.md` in this directory and apply its learning constraints; and
-2. the agent begins with the starter as its working scope instead of treating the neighboring reference implementation as ordinary project context.
+Starting there is not a security sandbox: an agent can still traverse to a parent directory if instructed. The local `AGENTS.md` therefore prohibits reading, searching, diffing, or copying `../mini-lsm`, including attempts to reconstruct the solution through Git history or an online copy.
 
-Starting in this directory is not a security sandbox: an agent can still traverse to a parent directory if instructed. The local `AGENTS.md` therefore explicitly prohibits reading, searching, diffing, or copying `../mini-lsm/`, including attempts to reconstruct the solution through Git history or an online copy.
-
-Do not open the whole repository as the agent's workspace if your tool lets you choose a directory. Open `mini-lsm-starter`. The agent may consult the copied tests, starter interfaces, Rust documentation, and course chapters under `../mini-lsm-book/src/`.
+Do not open the whole repository as the agent's workspace if your tool lets you choose a directory. The agent may consult copied tests, starter interfaces, Rust documentation, and course chapters under `../mini-lsm-book/src/`.
 
 ### 3. Verify the Instructions Before Coding
 
 Do not assume the tool discovered `AGENTS.md`. Make the first prompt a handshake that performs no implementation:
 
-> Before editing anything, confirm that your working directory is `mini-lsm-starter` and read `./AGENTS.md`. Summarize its hard boundaries and working agreement. You must never inspect or copy the reference solution in `../mini-lsm`, directly or indirectly. Tell me which local sources you are allowed to use, then stop without changing files.
+> Before editing anything, confirm that your working directory is `mini-lsm-starter` and read `./AGENTS.md`. Summarize its reference-solution boundary, test protections, and student-owned design protocol. Explain which choices require a stop and which mechanical coding choices do not. Tell me which local sources you may use, then stop without changing files.
+
+If the response omits the reference-solution boundary, test protection, or one-decision-at-a-time stop, correct the agent before continuing. If the tool cannot load repository instructions automatically, paste `AGENTS.md` into its persistent project instructions.
+
+## The Design-and-Test Loop
+
+Begin a checkpoint with an ordinary capability request:
+
+> Implement block format.
+
+That prompt authorizes the learning process, not a one-shot patch. The agent should inspect allowed context and ask its first design question. It should not return a complete design, edit code, or run ahead to a passing suite.
+
+Repeat this loop:
 
-If the response omits the reference-solution boundary, test protection, or checkpoint stops, correct the agent before continuing. If the tool cannot load repository instructions automatically, paste the contents of `AGENTS.md` into its persistent project instructions.
+1. **Agent asks one decision.** It labels the question as a fixed contract to derive or an open design choice, gives the invariant or concrete case, explains real alternatives when they exist, and asks you to choose or predict.
+2. **Student reasons.** State a choice and why. A prediction is useful even when you are uncertain.
+3. **Agent checks the reasoning.** It connects the answer to interfaces, prose, or tests. If the answer violates a constraint, i
```

**File**: `mini-lsm-book/src/week1-fast-forward.md` (modified, +101/-51)
```diff
@@ -11,7 +11,7 @@ put/delete -> mutable memtable -> immutable memtables -> L0 SSTs
                      \____________ read + merge ____________/
 ```
 
-Use the existing Mini-LSM chapters as a reference library when you need a deeper explanation. You do not need to follow them one chapter at a time.
+You decide consequential behavior; the agent handles mechanical implementation. A short request begins a design interview; it must not produce a complete implementation in one turn.
 
 ## The Completion Contract
 
@@ -23,98 +23,147 @@ At the end of this path:
 - the complete supplied test suite passes; and
 - you can trace a key through the engine, explain why the newest value wins, and design a test for a plausible bug.
 
-The tests are evidence, not the specification. Generated code remains untrusted until you can connect it to an invariant and try to falsify it.
+The tests are evidence, not the specification. Generated code remains untrusted until you can connect it to a decision and an invariant and try to falsify it.
 
 ## Copy the Complete Test Suite
 
-Complete the repository and agent preparation in the [track overview](./agent-fast-forward-overview.md#prepare-the-repository-and-the-agent). Leave the agent at the instruction-handshake stop, then run these commands from the repository root. The original course reveals tests one chapter at a time; Day 1 starts with the complete acceptance suite:
+Complete the repository and agent preparation in the [track overview](./agent-fast-forward-overview.md#prepare-the-repository-and-the-agent). Leave the agent at the instruction-handshake stop, then run these commands from the repository root:
 
 ```shell
 cargo x copy-test --week 1
 cargo x scheck
 ```
 
-The initial check should fail because the starter contains unfinished code. Record the first failure; it gives you a reproducible baseline. Do not ask the agent to make this failure disappear by changing the tests.
+The initial check should fail because the starter contains unfinished code. Record the first failure as a reproducible baseline. Do not ask the agent to make it disappear by changing the tests.
 
 ## Start Day 1
 
-With the agent running from `mini-lsm-starter`, the instruction handshake complete, and the test suite copied, send this kickoff prompt:
+With the agent running from `mini-lsm-starter`, the instruction handshake complete, and the tests copied, send:
 
-> We are completing Mini-LSM in this starter directory. Use the starter interfaces, copied acceptance tests, and Mini-LSM book chapters, but never access `../mini-lsm`. Do not edit yet.
->
-> Return:
->
-> 1. a map of the write, read, and flush paths;
-> 2. the ordering, ownership, and file-format invariants that connect their components;
-> 3. an implementation plan divided into the three checkpoints on this page; and
-> 4. any ambiguity you found between the prose, interfaces, and tests.
->
-> Ask me to predict one important boundary case, then stop.
+> Implement the Mini-LSM write, read, and flush paths. Follow the student-owned design protocol in `AGENTS.md`. Ask one design decision at a time, record my accepted choices, and do not edit until those choices specify one coherent slice. Never access `../mini-lsm`.
 
-Answer the prediction before asking the agent to evaluate it. This turns the first exchange into a check of your current model rather than a generated summary to skim.
+The first useful response is a question, not an architecture essay or a patch. It will usually ask you to choose the first checkpoint. Select one of the three below and explain why it is a useful boundary.
 
-When its plan matches the three checkpoints below, choose the first checkpoint and use the overview's implementation and challenge prompts. Begin each later checkpoint only when you explicitly ask the agent to do so.
+For each checkpoint, the tables below are an audit guide for you. Do not paste a whole table back as a ready-made specification. Make the agent elicit one topic at a time, label it as a fixed contract or an open choice, and use the table afterward to check whether the dialogue covered the important ground.
 
 ## Checkpoint 1: Ordered State
 
-Have the agent implement the memtable and iterator layers. Use the [Memtable](./week1-01-memtable.md) and [Merge Iterator](./week1-02-merge-iterator.md) chapters when the code or tests do not explain a decision.
+Ask:
+
+> Implement ordered in-memory state.
 
-The resulting implementation must preserve these properties:
+This checkpoint covers the memtable and iterator layers. Use the [Memtable](./week1-01-memtable.md) and [Merge Iterator](./week1-02-merge-iterator.md) chapters when a question needs more context.
 
-| Invariant | How to challenge it |
+The agent should stop on at least these contract topics and ask you to derive the required behavior:
+
+| Decision | Case that exposes it |
 | --- | --- |
-| A memtable exposes keys in bytewise sorted order. | Insert keys out of order, then scan them. |
-|
```

**File**: `mini-lsm-starter/AGENTS.md` (modified, +54/-21)
```diff
@@ -2,9 +2,9 @@
 
 ## Purpose
 
-This directory is a learning workspace. You may write implementation code, but optimize for the student's understanding and ability to review the system, not for finishing the repository with the fewest interactions.
+This directory is a learning workspace. You may write implementation code, but optimize for the student's understanding and ability to make the system's design decisions, not for finishing the repository with the fewest interactions.
 
-The student owns the specification and the proof of correctness. Treat your code as an untrusted contribution that must be explained, tested, and challenged.
+The student owns the explicit design decisions permitted by the course contract and must be able to defend the resulting specification and proof of correctness. Treat your code as an untrusted contribution that must be explained, tested, and challenged.
 
 ## Hard Boundaries
 
@@ -19,34 +19,66 @@ The student owns the specification and the proof of correctness. Treat your code
 
 You may consult the Mini-LSM chapters in `../mini-lsm-book/src/`, Rust and dependency documentation, and the starter code's existing interfaces. External documentation is for understanding APIs and concepts, not for locating another Mini-LSM solution.
 
-## Working Agreement
+## Student-Owned Design Protocol
 
-Before editing code:
+A request such as “implement block format” starts a design dialogue. It does not authorize you to silently choose the representation, boundary behavior, algorithm, or failure semantics and return a finished patch.
+
+Before editing:
 
 1. Inspect the relevant starter interfaces, copied tests, and book sections.
-2. Describe the data flow affected by the task.
-3. State the correctness invariants that the implementation must preserve.
-4. Propose a small implementation and validation plan.
-5. Ask the student to predict one important boundary case before revealing its result.
+2. Identify the checkpoint boundary and the decisions required to specify it.
+3. Ask about one consequential design decision, then stop.
+4. After the student answers, evaluate the answer against the interfaces, tests, and invariants. Correct a misunderstanding with evidence; do not quietly replace the student's choice.
+5. Record the accepted choice in a short decision ledger, then ask the next question.
+6. When the decisions needed for the next coherent code slice are settled, summarize that slice and its expected test, then wait for the student to authorize the edit.
+
+A consequential decision changes observable behavior, correctness, compatibility, or the student's mental model. Examples include data layout, ordering and duplicate precedence, size accounting, ownership, seek semantics, boundary conditions, error handling, synchronization, and which layer owns an optimization. Mechanical choices such as local variable names, import ordering, formatting, and an obvious compiler-directed type correction do not require a stop.
+
+Stop eliciting decisions when the public contract, supplied tests, and selected adversarial cases determine the next slice. Internal bookkeeping that follows an accepted invariant is mechanical. Do not invent hypothetical policy choices merely to prolong the interview.
+
+Ask questions that require reasoning. A decision question should contain:
+
+- the invariant or concrete case that makes the choice matter;
+- two or more viable choices and their tradeoffs, when alternatives really exist; and
+- one focused question asking the student to choose, predict, or explain.
+
+Do not dump the entire interview as a questionnaire. Ask one decision at a time so the next question can use the student's previous answer. Do not reveal the expected answer before the student attempts it. If only one choice is compatible with a provided interface or format, ask the student to derive it from that evidence and record it as a constraint, not a preference.
+
+Maintain a compact decision ledger during the checkpoint:
+
+```text
+Decision | Student's choice | Invariant/evidence | Consequence
+```
+
+The ledger is not a substitute for the dialogue. Maintain it without reprinting the full table after every answer. Show the consolidated ledger at slice authorization and in the checkpoint handoff.
+
+The student may explicitly delegate a decision. In that case, state your choice and reasoning and record that it was delegated. Do not interpret “use your judgment” for one decision as permission to choose the rest.
+
+## Checkpoints and Implementation
 
 The course material, not this file, defines the checkpoints and their system-specific invariants. The student directs their sequence. Do not choose or begin a checkpoint merely because the preceding checkpoint passed.
 
-A request that names one checkpoint authorizes work only on that checkpoint. Before editing, restate its scope and invariants and list the files you expect to change. If a request spans multiple checkpoints, present the plan and wa
```

---

### Incident Patch 6: `6ff1b6e5` (2026-07-20)
**Commit Message**: Track how many entries were actually added to the current builder and skip building an empty one (#182)

**File**: `mini-lsm-mvcc/src/compact.rs` (modified, +16/-8)
```diff
@@ -133,6 +133,7 @@ impl LsmStorageInner {
         compact_to_bottom_level: bool,
     ) -> Result<Vec<Arc<SsTable>>> {
         let mut builder = None;
+        let mut entries_in_builder: usize = 0;
         let mut new_sst = Vec::new();
         let watermark = self.mvcc().watermark();
         let mut last_key = Vec::<u8>::new();
@@ -184,7 +185,10 @@ impl LsmStorageInner {
 
             let builder_inner = builder.as_mut().unwrap();
 
-            if builder_inner.estimated_size() >= self.options.target_sst_size && !same_as_last_key {
+            if builder_inner.estimated_size() >= self.options.target_sst_size
+                && !same_as_last_key
+                && entries_in_builder > 0
+            {
                 let sst_id = self.next_sst_id();
                 let old_builder = builder.take().unwrap();
                 let sst = Arc::new(old_builder.build(
@@ -194,10 +198,12 @@ impl LsmStorageInner {
                 )?);
                 new_sst.push(sst);
                 builder = Some(SsTableBuilder::new(self.options.block_size));
+                entries_in_builder = 0;
             }
 
             let builder_inner = builder.as_mut().unwrap();
             builder_inner.add(iter.key(), iter.value());
+            entries_in_builder += 1;
 
             if !same_as_last_key {
                 last_key.clear();
@@ -207,13 +213,15 @@ impl LsmStorageInner {
             iter.next()?;
         }
         if let Some(builder) = builder {
-            let sst_id = self.next_sst_id(); // lock dropped here
-            let sst = Arc::new(builder.build(
-                sst_id,
-                Some(self.block_cache.clone()),
-                self.path_of_sst(sst_id),
-            )?);
-            new_sst.push(sst);
+            if entries_in_builder > 0 {
+                let sst_id = self.next_sst_id(); // lock dropped here
+                let sst = Arc::new(builder.build(
+                    sst_id,
+                    Some(self.block_cache.clone()),
+                    self.path_of_sst(sst_id),
+                )?);
+                new_sst.push(sst);
+            }
         }
         Ok(new_sst)
     }
```

**File**: `mini-lsm/src/compact.rs` (modified, +16/-8)
```diff
@@ -133,6 +133,7 @@ impl LsmStorageInner {
         compact_to_bottom_level: bool,
     ) -> Result<Vec<Arc<SsTable>>> {
         let mut builder = None;
+        let mut entries_in_builder: usize = 0;
         let mut new_sst = Vec::new();
 
         while iter.is_valid() {
@@ -143,13 +144,17 @@ impl LsmStorageInner {
             if compact_to_bottom_level {
                 if !iter.value().is_empty() {
                     builder_inner.add(iter.key(), iter.value());
+                    entries_in_builder += 1;
                 }
             } else {
                 builder_inner.add(iter.key(), iter.value());
+                entries_in_builder += 1;
             }
             iter.next()?;
 
-            if builder_inner.estimated_size() >= self.options.target_sst_size {
+            if builder_inner.estimated_size() >= self.options.target_sst_size
+                && entries_in_builder > 0
+            {
                 let sst_id = self.next_sst_id();
                 let builder = builder.take().unwrap();
                 let sst = Arc::new(builder.build(
@@ -158,16 +163,19 @@ impl LsmStorageInner {
                     self.path_of_sst(sst_id),
                 )?);
                 new_sst.push(sst);
+                entries_in_builder = 0;
             }
         }
         if let Some(builder) = builder {
-            let sst_id = self.next_sst_id(); // lock dropped here
-            let sst = Arc::new(builder.build(
-                sst_id,
-                Some(self.block_cache.clone()),
-                self.path_of_sst(sst_id),
-            )?);
-            new_sst.push(sst);
+            if entries_in_builder > 0 {
+                let sst_id = self.next_sst_id(); // lock dropped here
+                let sst = Arc::new(builder.build(
+                    sst_id,
+                    Some(self.block_cache.clone()),
+                    self.path_of_sst(sst_id),
+                )?);
+                new_sst.push(sst);
+            }
         }
         Ok(new_sst)
     }
```

---

### Incident Patch 7: `9a13f3a5` (2026-07-20)
**Commit Message**: Fix: scan upper bound leak (#183)

* Add check_end_bound function to prevent key return beyong upper bound

* Add test case for scan bounds

**File**: `mini-lsm-mvcc/src/lsm_iterator.rs` (modified, +13/-5)
```diff
@@ -51,21 +51,29 @@ impl LsmIterator {
             read_ts,
             prev_key: Vec::new(),
         };
+        iter.check_end_bound();
         iter.move_to_key()?;
         Ok(iter)
     }
 
-    fn next_inner(&mut self) -> Result<()> {
-        self.inner.next()?;
-        if !self.inner.is_valid() {
-            self.is_valid = false;
-            return Ok(());
+    fn check_end_bound(&mut self) {
+        if !self.is_valid {
+            return;
         }
         match self.end_bound.as_ref() {
             Bound::Unbounded => {}
             Bound::Included(key) => self.is_valid = self.inner.key().key_ref() <= key.as_ref(),
             Bound::Excluded(key) => self.is_valid = self.inner.key().key_ref() < key.as_ref(),
         }
+    }
+
+    fn next_inner(&mut self) -> Result<()> {
+        self.inner.next()?;
+        if !self.inner.is_valid() {
+            self.is_valid = false;
+            return Ok(());
+        }
+        self.check_end_bound();
         Ok(())
     }
 
```

**File**: `mini-lsm/src/lsm_iterator.rs` (modified, +13/-5)
```diff
@@ -43,21 +43,29 @@ impl LsmIterator {
             inner: iter,
             end_bound,
         };
+        iter.check_end_bound();
         iter.move_to_non_delete()?;
         Ok(iter)
     }
 
-    fn next_inner(&mut self) -> Result<()> {
-        self.inner.next()?;
-        if !self.inner.is_valid() {
-            self.is_valid = false;
-            return Ok(());
+    fn check_end_bound(&mut self) {
+        if !self.is_valid {
+            return;
         }
         match self.end_bound.as_ref() {
             Bound::Unbounded => {}
             Bound::Included(key) => self.is_valid = self.inner.key().raw_ref() <= key.as_ref(),
             Bound::Excluded(key) => self.is_valid = self.inner.key().raw_ref() < key.as_ref(),
         }
+    }
+
+    fn next_inner(&mut self) -> Result<()> {
+        self.inner.next()?;
+        if !self.inner.is_valid() {
+            self.is_valid = false;
+            return Ok(());
+        }
+        self.check_end_bound();
         Ok(())
     }
 
```

**File**: `mini-lsm/src/tests/week1_day5.rs` (modified, +41/-0)
```diff
@@ -218,6 +218,47 @@ fn test_task2_storage_scan() {
     );
 }
 
+#[test]
+fn test_task2_storage_scan_end_bound_at_seek_position() {
+    let dir = tempdir().unwrap();
+    let storage =
+        Arc::new(LsmStorageInner::open(&dir, LsmStorageOptions::default_for_week1_test()).unwrap());
+    let sst1 = generate_sst(
+        10,
+        dir.path().join("10.sst"),
+        vec![
+            (Bytes::from_static(b"key00"), Bytes::from_static(b"233")),
+            (Bytes::from_static(b"key11"), Bytes::from_static(b"2333")),
+        ],
+        Some(storage.block_cache.clone()),
+    );
+    {
+        let mut state = storage.state.write();
+        let mut snapshot = state.as_ref().clone();
+        snapshot.l0_sstables.push(sst1.sst_id());
+        snapshot.sstables.insert(sst1.sst_id(), sst1.into());
+        *state = snapshot.into();
+    }
+    check_lsm_iter_result_by_key(
+        &mut storage
+            .scan(Bound::Included(b"key01"), Bound::Included(b"key01"))
+            .unwrap(),
+        vec![],
+    );
+    check_lsm_iter_result_by_key(
+        &mut storage
+            .scan(Bound::Included(b"key01"), Bound::Excluded(b"key11"))
+            .unwrap(),
+        vec![],
+    );
+    check_lsm_iter_result_by_key(
+        &mut storage
+            .scan(Bound::Included(b"key01"), Bound::Included(b"key11"))
+            .unwrap(),
+        vec![(Bytes::from("key11"), Bytes::from("2333"))],
+    );
+}
+
 #[test]
 fn test_task3_storage_get() {
     let dir = tempdir().unwrap();
```

---

### Incident Patch 8: `a07e8331` (2026-03-25)
**Commit Message**: docs: fix slateDB link error (#171)

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ We have 3 weeks + 1 extra week (in progress) for this course.
 
 mini-lsm inspired several projects used in production.
 
-* [SlateDB](https://slatedb.io/docs/architecture/) is an LSM engine over the object storage system.
+* [SlateDB](https://slatedb.io/docs/design/overview/) is an LSM engine over the object storage system.
 * [Tonbo](https://tonbo.io/about) stores parquet files directly on the object storage and organizes them in an LSM tree structure.
 
 ## License
```

---

### Incident Patch 9: `88543a02` (2026-03-15)
**Commit Message**: chore: fix many clippy warnings (#166)

* chore: fix many clippy warnings

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

* chore: fix format error

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

* chore: remove multilingual configuration

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

* fix: install mdbook-toc on CI

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

---------

Signed-off-by: StandingMan <[REDACTED_EMAIL]>

**File**: `.github/workflows/main.yml` (modified, +9/-2)
```diff
@@ -15,8 +15,15 @@ jobs:
       - uses: actions/checkout@v2
       - name: setup rust toolchain
         run: rustup update && rustup toolchain install
-      - uses: taiki-e/install-action@nextest
-      - uses: taiki-e/install-action@mdbook
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: nextest
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: mdbook
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: mdbook-toc
       - name: patch for gh-pages build
         run: mv mini-lsm-book/theme/head.hbs._ mini-lsm-book/theme/head.hbs
       - name: check and build
```

**File**: `.github/workflows/pr.yml` (modified, +9/-2)
```diff
@@ -15,7 +15,14 @@ jobs:
       - uses: actions/checkout@v2
       - name: setup rust toolchain
         run: rustup update && rustup toolchain install
-      - uses: taiki-e/install-action@nextest
-      - uses: taiki-e/install-action@mdbook
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: nextest
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: mdbook
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: mdbook-toc
       - name: check and build
         run: cargo x ci
```

**File**: `mini-lsm-book/book.toml` (modified, +0/-1)
```diff
@@ -1,7 +1,6 @@
 [book]
 authors = ["Alex Chi Z"]
 language = "en"
-multilingual = false
 src = "src"
 title = "LSM in a Week"
 
```

**File**: `mini-lsm-mvcc/src/block/iterator.rs` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ impl BlockIterator {
     }
 
     /// Returns the key of the current entry.
-    pub fn key(&self) -> KeySlice {
+    pub fn key(&self) -> KeySlice<'_> {
         debug_assert!(!self.key.is_empty(), "invalid iterator");
         self.key.as_key_slice()
     }
```

**File**: `mini-lsm-mvcc/src/iterators/concat_iterator.rs` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ impl SstConcatIterator {
 impl StorageIterator for SstConcatIterator {
     type KeyType<'a> = KeySlice<'a>;
 
-    fn key(&self) -> KeySlice {
+    fn key(&self) -> KeySlice<'_> {
         self.current.as_ref().unwrap().key()
     }
 
```

**File**: `mini-lsm-mvcc/src/iterators/merge_iterator.rs` (modified, +5/-5)
```diff
@@ -94,7 +94,7 @@ impl<I: 'static + for<'a> StorageIterator<KeyType<'a> = KeySlice<'a>>> StorageIt
 {
     type KeyType<'a> = KeySlice<'a>;
 
-    fn key(&self) -> KeySlice {
+    fn key(&self) -> KeySlice<'_> {
         self.current.as_ref().unwrap().1.key()
     }
 
@@ -144,10 +144,10 @@ impl<I: 'static + for<'a> StorageIterator<KeyType<'a> = KeySlice<'a>>> StorageIt
         }
 
         // Otherwise, compare with heap top and swap if necessary.
-        if let Some(mut inner_iter) = self.iters.peek_mut() {
-            if *current < *inner_iter {
-                std::mem::swap(&mut *inner_iter, current);
-            }
+        if let Some(mut inner_iter) = self.iters.peek_mut()
+            && *current < *inner_iter
+        {
+            std::mem::swap(&mut *inner_iter, current);
         }
 
         Ok(())
```

**File**: `mini-lsm-mvcc/src/key.rs` (modified, +2/-2)
```diff
@@ -86,7 +86,7 @@ impl Key<Vec<u8>> {
         self.1 = key_slice.1;
     }
 
-    pub fn as_key_slice(&self) -> KeySlice {
+    pub fn as_key_slice(&self) -> KeySlice<'_> {
         Key(self.0.as_slice(), self.1)
     }
 
@@ -116,7 +116,7 @@ impl Key<Bytes> {
         Self(Bytes::new(), TS_DEFAULT)
     }
 
-    pub fn as_key_slice(&self) -> KeySlice {
+    pub fn as_key_slice(&self) -> KeySlice<'_> {
         Key(&self.0, self.1)
     }
 
```

**File**: `mini-lsm-mvcc/src/lsm_iterator.rs` (modified, +5/-5)
```diff
@@ -171,11 +171,11 @@ impl<I: StorageIterator> StorageIterator for FusedIterator<I> {
         if self.has_errored {
             bail!("the iterator is tainted");
         }
-        if self.iter.is_valid() {
-            if let Err(e) = self.iter.next() {
-                self.has_errored = true;
-                return Err(e);
-            }
+        if self.iter.is_valid()
+            && let Err(e) = self.iter.next()
+        {
+            self.has_errored = true;
+            return Err(e);
         }
         Ok(())
     }
```

---

### Incident Patch 10: `fc4765b9` (2025-05-31)
**Commit Message**: Fix wrong input type of put_batch (#146)

* Fix wrong input type of put_batch

Update wal.rs

* fix

Signed-off-by: Alex Chi <[REDACTED_EMAIL]>

---------

Signed-off-by: Alex Chi <[REDACTED_EMAIL]>
Co-authored-by: Alex Chi <[REDACTED_EMAIL]>

**File**: `mini-lsm-starter/src/mem_table.rs` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ impl MemTable {
         unimplemented!()
     }
 
-    /// Implement this in week 3, day 5.
+    /// Implement this in week 3, day 5; if you want to implement this earlier, use `&[u8]` as the key type.
     pub fn put_batch(&self, _data: &[(KeySlice, &[u8])]) -> Result<()> {
         unimplemented!()
     }
```

**File**: `mini-lsm-starter/src/wal.rs` (modified, +7/-6)
```diff
@@ -15,15 +15,16 @@
 #![allow(unused_variables)] // TODO(you): remove this lint after implementing this mod
 #![allow(dead_code)] // TODO(you): remove this lint after implementing this mod
 
+use anyhow::Result;
+use bytes::Bytes;
+use crossbeam_skiplist::SkipMap;
+use parking_lot::Mutex;
 use std::fs::File;
 use std::io::BufWriter;
 use std::path::Path;
 use std::sync::Arc;
 
-use anyhow::Result;
-use bytes::Bytes;
-use crossbeam_skiplist::SkipMap;
-use parking_lot::Mutex;
+use crate::key::KeySlice;
 
 pub struct Wal {
     file: Arc<Mutex<BufWriter<File>>>,
@@ -42,8 +43,8 @@ impl Wal {
         unimplemented!()
     }
 
-    /// Implement this in week 3, day 5.
-    pub fn put_batch(&self, _data: &[(&[u8], &[u8])]) -> Result<()> {
+    /// Implement this in week 3, day 5; if you want to implement this earlier, use `&[u8]` as the key type.
+    pub fn put_batch(&self, _data: &[(KeySlice, &[u8])]) -> Result<()> {
         unimplemented!()
     }
 
```

**File**: `mini-lsm/src/mem_table.rs` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ impl MemTable {
         Ok(())
     }
 
-    /// Implement this in week 3, day 5.
+    /// Implement this in week 3, day 5; if you want to implement this earlier, use `&[u8]` as the key type.
     pub fn put_batch(&self, _data: &[(KeySlice, &[u8])]) -> Result<()> {
         unimplemented!()
     }
```

**File**: `mini-lsm/src/wal.rs` (modified, +4/-2)
```diff
@@ -23,6 +23,8 @@ use bytes::{Buf, BufMut, Bytes};
 use crossbeam_skiplist::SkipMap;
 use parking_lot::Mutex;
 
+use crate::key::KeySlice;
+
 pub struct Wal {
     file: Arc<Mutex<BufWriter<File>>>,
 }
@@ -93,8 +95,8 @@ impl Wal {
         Ok(())
     }
 
-    /// Implement this in week 3, day 5.
-    pub fn put_batch(&self, _data: &[(&[u8], &[u8])]) -> Result<()> {
+    /// Implement this in week 3, day 5; if you want to implement this earlier, use `&[u8]` as the key type.
+    pub fn put_batch(&self, _data: &[(KeySlice, &[u8])]) -> Result<()> {
         unimplemented!()
     }
 
```

---

### Incident Patch 11: `6fba57ac` (2025-05-05)
**Commit Message**: fix: handle the exclude boundary logic of the memory table (#140)

* fix: handle the exclude boundary logic of the memory table

* add comments

Signed-off-by: Alex Chi <[REDACTED_EMAIL]>

---------

Signed-off-by: Alex Chi <[REDACTED_EMAIL]>
Co-authored-by: Alex Chi <[REDACTED_EMAIL]>

**File**: `mini-lsm-mvcc/src/lsm_storage.rs` (modified, +5/-8)
```diff
@@ -805,15 +805,10 @@ impl LsmStorageInner {
         }; // drop global lock here
 
         let mut memtable_iters = Vec::with_capacity(snapshot.imm_memtables.len() + 1);
-        memtable_iters.push(Box::new(snapshot.memtable.scan(
-            map_key_bound_plus_ts(lower, key::TS_RANGE_BEGIN),
-            map_key_bound_plus_ts(upper, key::TS_RANGE_END),
-        )));
+        let (begin, end) = map_key_bound_plus_ts(lower, upper, read_ts);
+        memtable_iters.push(Box::new(snapshot.memtable.scan(begin, end)));
         for memtable in snapshot.imm_memtables.iter() {
-            memtable_iters.push(Box::new(memtable.scan(
-                map_key_bound_plus_ts(lower, key::TS_RANGE_BEGIN),
-                map_key_bound_plus_ts(upper, key::TS_RANGE_END),
-            )));
+            memtable_iters.push(Box::new(memtable.scan(begin, end)));
         }
         let memtable_iter = MergeIterator::create(memtable_iters);
 
@@ -836,6 +831,8 @@ impl LsmStorageInner {
                             table,
                             KeySlice::from_slice(key, key::TS_RANGE_BEGIN),
                         )?;
+                        // TODO: we can implement `key.next()` so that we can directly seek to the
+                        // right place in the previous line.
                         while iter.is_valid() && iter.key().key_ref() == key {
                             iter.next()?;
                         }
```

**File**: `mini-lsm-mvcc/src/mem_table.rs` (modified, +26/-10)
```diff
@@ -24,7 +24,7 @@ use crossbeam_skiplist::map::Entry;
 use ouroboros::self_referencing;
 
 use crate::iterators::StorageIterator;
-use crate::key::{KeyBytes, KeySlice, TS_DEFAULT};
+use crate::key::{KeyBytes, KeySlice, TS_DEFAULT, TS_RANGE_BEGIN, TS_RANGE_END};
 use crate::table::SsTableBuilder;
 use crate::wal::Wal;
 
@@ -63,13 +63,29 @@ pub(crate) fn map_key_bound(bound: Bound<KeySlice>) -> Bound<KeyBytes> {
     }
 }
 
-/// Create a bound of `Bytes` from a bound of `KeySlice`.
-pub(crate) fn map_key_bound_plus_ts(bound: Bound<&[u8]>, ts: u64) -> Bound<KeySlice> {
-    match bound {
-        Bound::Included(x) => Bound::Included(KeySlice::from_slice(x, ts)),
-        Bound::Excluded(x) => Bound::Excluded(KeySlice::from_slice(x, ts)),
-        Bound::Unbounded => Bound::Unbounded,
-    }
+/// Create a bound of `KeySlice` from a bound of `&[u8]`.
+pub(crate) fn map_key_bound_plus_ts<'a>(
+    lower: Bound<&'a [u8]>,
+    upper: Bound<&'a [u8]>,
+    ts: u64,
+) -> (Bound<KeySlice<'a>>, Bound<KeySlice<'a>>) {
+    (
+        match lower {
+            Bound::Included(x) => Bound::Included(KeySlice::from_slice(x, ts)),
+            Bound::Excluded(x) => Bound::Excluded(KeySlice::from_slice(x, TS_RANGE_END)),
+            Bound::Unbounded => Bound::Unbounded,
+        },
+        match upper {
+            Bound::Included(x) => {
+                // Note that we order the ts descending, but for a MVCC scan, we need all the history
+                // so that we can access the latest key in case it is not updated in the current ts.
+                // Therefore, we need to scan all the way to ts 0.
+                Bound::Included(KeySlice::from_slice(x, TS_RANGE_END))
+            }
+            Bound::Excluded(x) => Bound::Excluded(KeySlice::from_slice(x, TS_RANGE_BEGIN)),
+            Bound::Unbounded => Bound::Unbounded,
+        },
+    )
 }
 
 impl MemTable {
@@ -127,8 +143,8 @@ impl MemTable {
         upper: Bound<&[u8]>,
     ) -> MemTableIterator {
         self.scan(
-            map_key_bound_plus_ts(lower, TS_DEFAULT),
-            map_key_bound_plus_ts(upper, TS_DEFAULT),
+            lower.map(|x| KeySlice::from_slice(x, TS_DEFAULT)),
+            upper.map(|x| KeySlice::from_slice(x, TS_DEFAULT)),
         )
     }
 
```

**File**: `mini-lsm-mvcc/src/tests/week3_day3.rs` (modified, +54/-0)
```diff
@@ -49,6 +49,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("b"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot1
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"b"))
+            .unwrap(),
+        vec![],
+    );
     assert_eq!(snapshot2.get(b"a").unwrap(), Some(Bytes::from_static(b"2")));
     assert_eq!(snapshot2.get(b"b").unwrap(), Some(Bytes::from_static(b"1")));
     assert_eq!(snapshot2.get(b"c").unwrap(), None);
@@ -59,6 +65,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("b"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot2
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"b"))
+            .unwrap(),
+        vec![],
+    );
     assert_eq!(snapshot3.get(b"a").unwrap(), Some(Bytes::from_static(b"2")));
     assert_eq!(snapshot3.get(b"b").unwrap(), None);
     assert_eq!(snapshot3.get(b"c").unwrap(), Some(Bytes::from_static(b"1")));
@@ -69,6 +81,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("c"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot3
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"c"))
+            .unwrap(),
+        vec![],
+    );
     storage
         .inner
         .force_freeze_memtable(&storage.inner.state_lock.lock())
@@ -91,6 +109,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("b"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot1
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"b"))
+            .unwrap(),
+        vec![],
+    );
     assert_eq!(snapshot2.get(b"a").unwrap(), Some(Bytes::from_static(b"2")));
     assert_eq!(snapshot2.get(b"b").unwrap(), Some(Bytes::from_static(b"1")));
     assert_eq!(snapshot2.get(b"c").unwrap(), None);
@@ -101,6 +125,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("b"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot2
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"b"))
+            .unwrap(),
+        vec![],
+    );
     assert_eq!(snapshot3.get(b"a").unwrap(), Some(Bytes::from_static(b"2")));
     assert_eq!(snapshot3.get(b"b").unwrap(), None);
     assert_eq!(snapshot3.get(b"c").unwrap(), Some(Bytes::from_static(b"1")));
@@ -111,6 +141,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("c"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot3
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"c"))
+            .unwrap(),
+        vec![],
+    );
     assert_eq!(snapshot4.get(b"a").unwrap(), Some(Bytes::from_static(b"3")));
     assert_eq!(snapshot4.get(b"b").unwrap(), Some(Bytes::from_static(b"3")));
     assert_eq!(snapshot4.get(b"c").unwrap(), Some(Bytes::from_static(b"1")));
@@ -122,6 +158,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("c"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot4
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"c"))
+            .unwrap(),
+        vec![(Bytes::from("b"), Bytes::from("3"))],
+    );
     assert_eq!(snapshot5.get(b"a").unwrap(), Some(Bytes::from_static(b"4")));
     assert_eq!(snapshot5.get(b"b").unwrap(), Some(Bytes::from_static(b"3")));
     assert_eq!(snapshot5.get(b"c").unwrap(), Some(Bytes::from_static(b"1")));
@@ -133,6 +175,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("c"), Bytes::from("1")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot5
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"c"))
+            .unwrap(),
+        vec![(Bytes::from("b"), Bytes::from("3"))],
+    );
     assert_eq!(snapshot6.get(b"a").unwrap(), Some(Bytes::from_static(b"4")));
     assert_eq!(snapshot6.get(b"b").unwrap(), None);
     assert_eq!(snapshot6.get(b"c").unwrap(), Some(Bytes::from_static(b"5")));
@@ -143,6 +191,12 @@ fn test_task2_memtable_mvcc() {
             (Bytes::from("c"), Bytes::from("5")),
         ],
     );
+    check_lsm_iter_result_by_key(
+        &mut snapshot6
+            .scan(Bound::Excluded(b"a"), Bound::Excluded(b"c"))
+            .unwrap(),
+        vec![],
+    );
 }
 
 #[test]
```

**File**: `mini-lsm-starter/src/mem_table.rs` (modified, +3/-0)
```diff
@@ -79,6 +79,9 @@ impl MemTable {
         lower: Bound<&[u8]>,
         upper: Bound<&[u8]>,
     ) -> MemTableIterator {
+        // This function is only used in week 1 tests, so during the week 3 key-ts refactor, you do
+        // not need to consider the bound exclude/include logic. Simply provide `DEFAULT_TS` as the
+        // timestamp for the key-ts pair.
         self.scan(lower, upper)
     }
 
```

**File**: `mini-lsm/src/mem_table.rs` (modified, +3/-0)
```diff
@@ -93,6 +93,9 @@ impl MemTable {
         lower: Bound<&[u8]>,
         upper: Bound<&[u8]>,
     ) -> MemTableIterator {
+        // This function is only used in week 1 tests, so during the week 3 key-ts refactor, you do
+        // not need to consider the bound exclude/include logic. Simply provide `DEFAULT_TS` as the
+        // timestamp for the key-ts pair.
         self.scan(lower, upper)
     }
 
```

**File**: `mini-lsm/src/tests/harness.rs` (modified, +4/-1)
```diff
@@ -127,7 +127,10 @@ where
         );
         iter.next().unwrap();
     }
-    assert!(!iter.is_valid());
+    assert!(
+        !iter.is_valid(),
+        "iterator should not be valid at the end of the check"
+    );
 }
 
 pub fn check_iter_result_by_key_and_ts<I>(iter: &mut I, expected: Vec<((Bytes, u64), Bytes)>)
```

---

### Incident Patch 12: `0fbb32ec` (2025-05-05)
**Commit Message**: fix clippy warnings

Signed-off-by: Alex Chi <[REDACTED_EMAIL]>

**File**: `mini-lsm-starter/src/mvcc/watermark.rs` (modified, +6/-0)
```diff
@@ -21,6 +21,12 @@ pub struct Watermark {
     readers: BTreeMap<u64, usize>,
 }
 
+impl Default for Watermark {
+    fn default() -> Self {
+        Self::new()
+    }
+}
+
 impl Watermark {
     pub fn new() -> Self {
         Self {
```

---

### Incident Patch 13: `d48cbd48` (2025-04-20)
**Commit Message**: docs: make it clear that w3d1 doesn't require all tests to pass.

**File**: `mini-lsm-book/src/week3-01-ts-key-refactor.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ cargo x copy-test --week 3 --day 1
 cargo x scheck
 ```
 
-**Note: We do not have full unit tests for this chapter. All you need to do is to make your code compile.**
+**Note: The MVCC subsystem is not fully tested until week 3 day 2. You only need to pass week 3 day 1 tests and all week 1 tests at the end of this day. Week 2 tests won't work because of compaction.**
 
 ## Task 0: Use MVCC Key Encoding
 
```

---

### Incident Patch 14: `9ad00a81` (2025-03-09)
**Commit Message**: docs: fix tiered compaction examples

Signed-off-by: Alex Chi <[REDACTED_EMAIL]>

**File**: `mini-lsm-book/src/week2-03-tiered.md` (modified, +6/-5)
```diff
@@ -153,7 +153,7 @@ The current trigger only reduces space amplification. We will need to add new tr
 
 The next trigger is the size ratio trigger. The trigger maintains the size ratio between the tiers. From the first tier, we compute the size of `this tier / sum of all previous tiers`. For the first encountered tier where this value `> (100 + size_ratio) * 1%`, we will compact all previous tiers excluding the current tier. We only do this compaction with there are more than `min_merge_width` tiers to be merged.
 
-For example, given the following LSM state, and assume size_ratio = 1, we should compact when the ratio value > 101%:
+For example, given the following LSM state, and assume size_ratio = 1, and min_merge_width = 2. We should compact when the ratio value > 101%:
 
 ```
 Tier 3: 1
@@ -166,19 +166,20 @@ Example 2:
 ```
 Tier 3: 1
 Tier 2: 1 ; 1 / 1 = 1
-Tier 1: 3 ; 3 / (1 + 1) = 1.5, compact tier 1+2+3
+Tier 1: 3 ; 3 / (1 + 1) = 1.5, compact tier 2+3
 ```
 
 ```
-Tier 4: 5
+Tier 4: 2
+Tier 1: 3
 ```
 
 Example 3:
 
 ```
 Tier 3: 1
-Tier 2: 2 ; 2 / 1 = 2, compact tier 2+3
-Tier 1: 4
+Tier 2: 2 ; 2 / 1 = 2, however, it does not make sense to compact only one tier; also note that min_merge_width=2
+Tier 1: 4 ; 4 / 3 = 1.33, compact tier 2+3
 ```
 
 ```
```

---

### Incident Patch 15: `169c8a50` (2025-03-02)
**Commit Message**: Fix a typo in Week2 Day3 (#129)

**File**: `mini-lsm-book/src/week2-03-tiered.md` (modified, +3/-3)
```diff
@@ -48,15 +48,15 @@ The first trigger of universal compaction is by space amplification ratio. As we
 
 The reason why we compute the space amplification ratio like this is because we model the engine in a way that it stores a fixed amount of user data (i.e., assume it's 100GB), and the user keeps updating the values by writing to the engine. Therefore, eventually, all keys get pushed down to the bottom-most tier, the bottom-most tier size should be equivalent to the amount of data (100GB), the upper tiers contain updates to the data that are not yet compacted to the bottom-most tier.
 
-When `all levels except last level size / last level size` >= `max_size_amplification_percent * 100%`, we will need to trigger a full compaction. For example, if we have a LSM state like:
+When `all levels except last level size / last level size` >= `max_size_amplification_percent * 1%`, we will need to trigger a full compaction. For example, if we have a LSM state like:
 
 ```
 Tier 3: 1
 Tier 2: 1 ; all levels except last level size = 2
 Tier 1: 1 ; last level size = 1, 2/1=2
 ```
 
-Assume `max_size_amplification_percent` = 200%, we should trigger a full compaction now.
+Assume `max_size_amplification_percent` = 200, we should trigger a full compaction now.
 
 After you implement this trigger, you can run the compaction simulator. You will see:
 
@@ -151,7 +151,7 @@ The current trigger only reduces space amplification. We will need to add new tr
 
 ### Task 1.2: Triggered by Size Ratio
 
-The next trigger is the size ratio trigger. The trigger maintains the size ratio between the tiers. From the first tier, we compute the size of `this tier / sum of all previous tiers`. For the first encountered tier where this value `> (100 + size_ratio) * 100%`, we will compact all previous tiers excluding the current tier. We only do this compaction with there are more than `min_merge_width` tiers to be merged.
+The next trigger is the size ratio trigger. The trigger maintains the size ratio between the tiers. From the first tier, we compute the size of `this tier / sum of all previous tiers`. For the first encountered tier where this value `> (100 + size_ratio) * 1%`, we will compact all previous tiers excluding the current tier. We only do this compaction with there are more than `min_merge_width` tiers to be merged.
 
 For example, given the following LSM state, and assume size_ratio = 1, we should compact when the ratio value > 101%:
 
```

#### Recent Merged Pull Requests:
- **PR #234** (2026-09-23): Move memtable freeze question to Week 1 Day 6 (@skyzh)
- **PR #232** (2026-09-11): fix: repair two broken links and a malformed solutions entry (@dajiaohuang)
- **PR #231** (2026-09-11): Clarify Week 1 Day 1 memtable ownership (@skyzh)
- **PR #230** (2026-09-05): chore: advance course crates after 0.3 publication (@skyzh)
- **PR #229** (2026-08-09): Add agent-track link to Mini-LSM sponsor page (@skyzh)
- **PR #228** (2026-08-08): Add CTA links to the Sponsor page (@skyzh)
- **PR #227** (2026-08-08): Align README with published Week 4 closing chapter (@skyzh)
- **PR #226** (2026-08-08): Turn Week 4 into the Mini-LSM closing chapter (@skyzh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
