# Forensic Learning Record (Deep Inspection): mimblewimble/grin

> **Canonical Artifact**: `07_PROJECT_LEARNING/mimblewimble-grin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mimblewimble/grin](https://github.com/mimblewimble/grin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:32:08.314Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mimblewimble/grin`
- **Description**: Minimal implementation of the Mimblewimble protocol.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5101 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/src/handlers/utils.rs`
```
// Copyright 2021 The Grin Developers
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

use crate::chain;
use crate::chain::types::CommitPos;
use crate::core::core::OutputIdentifier;
use crate::rest::*;
use crate::types::*;
use crate::util;
use crate::util::secp::pedersen::Commitment;
use std::sync::{Arc, Weak};

// All handlers use `Weak` references instead of `Arc` to avoid cycles that
// can never be destroyed. These 2 functions are simple helpers to reduce the
// boilerplate of dealing with `Weak`.
pub fn w<T>(weak: &Weak<T>) -> Result<Arc<T>, Error> {
	weak.upgrade()
		.ok_or_else(|| Error::Internal("failed to upgrade weak reference".to_owned()))
}

/// Internal function to retrieves an output by a given commitment
fn get_unspent(
	chain: &Arc<chain::Chain>,
	id: &str,
) -> Result<Option<(OutputIdentifier, CommitPos)>, Error> {
	let c = util::from_hex(id)
		.map_err(|_| Error::Argument(format!("Not a valid commitment: {}", id)))?;
	let commit = Commitment::from_vec(c);
	let res = chain.get_unspent(commit)?;
	Ok(res)
}

/// Retrieves an output from the chain given a commitment.
pub fn get_output(
	chain: &Weak<chain::Chain>,
	id: &str,
) -> Result<Option<(Output, OutputIdentifier)>, Error> {
	let chain = w(chain)?;
	let (out, pos) = match get_unspent(&chain, id)? {
		Some(x) => x,
		None => return Ok(None),
	};

	Ok(Some((
		Output::new(&out.commitment(), pos.height, pos.pos),
		out,
	)))
}

/// Retrieves an output from the chain given a commit id (a tiny bit iteratively)
pub fn get_output_v2(
	chain: &Weak<chain::Chain>,
	id: &str,
	include_proof: bool,
	include_merkle_proof: bool,
) -> Result<Option<(OutputPrintable, OutputIdentifier)>, Error> {
	let chain = w(chain)?;
	let (out, pos) = match get_unspent(&chain, id)? {
		Some(x) => x,
		None => return Ok(None),
	};

	let output = chain.get_unspent_output_at(pos.pos - 1)?;
	let header = if include_merkle_proof && output.is_coinbase() {
		chain.get_header_by_height(pos.height).ok()
	} else {
		None
	};

	let output_printable = OutputPrintable::from_output(
		&output,
		&chain,
		header.as_ref(),
		include_proof,
		include_merkle_proof,
	)?;

	Ok(Some((output_printable, out)))
}

```

### Core Architecture Module: `core/fuzz/fuzz_targets/block_read_v1.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

extern crate grin_core;

use grin_core::core::UntrustedBlock;
use grin_core::global;
use grin_core::ser::{self, DeserializationMode};

fuzz_target!(|data: &[u8]| {
	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
	let mut d = data.clone();
	let _t: Result<UntrustedBlock, ser::Error> =
		ser::deserialize(&mut d, ser::ProtocolVersion(1), DeserializationMode::Full);
});

```

### Core Architecture Module: `core/fuzz/fuzz_targets/block_read_v2.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

extern crate grin_core;

use grin_core::core::UntrustedBlock;
use grin_core::global;
use grin_core::ser::{self, DeserializationMode};

fuzz_target!(|data: &[u8]| {
	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
	let mut d = data.clone();
	let _t: Result<UntrustedBlock, ser::Error> =
		ser::deserialize(&mut d, ser::ProtocolVersion(2), DeserializationMode::Full);
});

```

### Core Architecture Module: `core/fuzz/fuzz_targets/compact_block_read_v1.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

extern crate grin_core;

use grin_core::core::UntrustedCompactBlock;
use grin_core::global;
use grin_core::ser::{self, DeserializationMode};

fuzz_target!(|data: &[u8]| {
	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
	let mut d = data.clone();
	let _t: Result<UntrustedCompactBlock, ser::Error> =
		ser::deserialize(&mut d, ser::ProtocolVersion(1), DeserializationMode::Full);
});

```

### Core Architecture Module: `core/fuzz/fuzz_targets/compact_block_read_v2.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

extern crate grin_core;

use grin_core::core::UntrustedCompactBlock;
use grin_core::global;
use grin_core::ser::{self, DeserializationMode};

fuzz_target!(|data: &[u8]| {
	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
	let mut d = data.clone();
	let _t: Result<UntrustedCompactBlock, ser::Error> =
		ser::deserialize(&mut d, ser::ProtocolVersion(2), DeserializationMode::Full);
});

```

### Core Architecture Module: `core/fuzz/fuzz_targets/transaction_read_v1.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

extern crate grin_core;

use grin_core::core::Transaction;
use grin_core::global;
use grin_core::ser::{self, DeserializationMode};

fuzz_target!(|data: &[u8]| {
	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
	let mut d = data.clone();
	let _t: Result<Transaction, ser::Error> =
		ser::deserialize(&mut d, ser::ProtocolVersion(1), DeserializationMode::Full);
});

```

### Core Architecture Module: `core/fuzz/fuzz_targets/transaction_read_v2.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

extern crate grin_core;

use grin_core::core::Transaction;
use grin_core::global;
use grin_core::ser::{self, DeserializationMode};

fuzz_target!(|data: &[u8]| {
	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
	let mut d = data.clone();
	let _t: Result<Transaction, ser::Error> =
		ser::deserialize(&mut d, ser::ProtocolVersion(2), DeserializationMode::Full);
});

```

### Core Architecture Module: `core/fuzz/src/main.rs`
```
extern crate grin_core;
extern crate grin_keychain;

use grin_core::core::{Block, CompactBlock, Transaction};
use grin_core::ser;
use std::fs::{self, File};
use std::path::Path;

fn main() {
	generate(
		"transaction_read_v1",
		ser::ProtocolVersion(1),
		Transaction::default(),
	)
	.unwrap();
	generate("block_read_v1", ser::ProtocolVersion(1), Block::default()).unwrap();
	generate(
		"compact_block_read_v1",
		ser::ProtocolVersion(1),
		CompactBlock::from(Block::default()),
	)
	.unwrap();
	generate(
		"transaction_read_v2",
		ser::ProtocolVersion(2),
		Transaction::default(),
	)
	.unwrap();
	generate("block_read_v2", ser::ProtocolVersion(2), Block::default()).unwrap();
	generate(
		"compact_block_read_v2",
		ser::ProtocolVersion(2),
		CompactBlock::from(Block::default()),
	)
	.unwrap();
}

fn generate<W: ser::Writeable>(
	target: &str,
	version: ser::ProtocolVersion,
	obj: W,
) -> Result<(), ser::Error> {
	let dir_path = Path::new("corpus").join(target);
	if !dir_path.is_dir() {
		fs::create_dir_all(&dir_path).map_err(|e| {
			println!("fail: {}", e);
			ser::Error::IOErr("can't create corpus directory".to_owned(), e.kind())
		})?;
	}

	let pattern_path = dir_path.join("pattern");
	if !pattern_path.exists() {
		let mut file = File::create(&pattern_path)
			.map_err(|e| ser::Error::IOErr("can't create a pattern file".to_owned(), e.kind()))?;
		ser::serialize(&mut file, version, &obj)
	} else {
		Ok(())
	}
}

```

### Core Architecture Module: `core/src/consensus.rs`
```
// Copyright 2021 The Grin Developers
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

//! All the rules required for a cryptocurrency to have reach consensus across
//! the whole network are complex and hard to completely isolate. Some can be
//! simple parameters (like block reward), others complex algorithms (like
//! Merkle sum trees or reorg rules). However, as long as they're simple
//! enough, consensus-relevant constants and short functions should be kept
//! here.

use crate::core::block::HeaderVersion;
use crate::core::hash::Hash;
use crate::global;
use crate::pow::Difficulty;
use std::cmp::{max, min};

/// A grin is divisible to 10^9, following the SI prefixes
pub const GRIN_BASE: u64 = 1_000_000_000;
/// Milligrin, a thousand of a grin
pub const MILLI_GRIN: u64 = GRIN_BASE / 1_000;
/// Microgrin, a thousand of a milligrin
pub const MICRO_GRIN: u64 = MILLI_GRIN / 1_000;
/// Nanogrin, smallest unit, takes a billion to make a grin
pub const NANO_GRIN: u64 = 1;

/// Block interval, in seconds, the network will tune its next_target for. Note
/// that we may reduce this value in the future as we get more data on mining
/// with Cuckoo Cycle, networks improve and block propagation is optimized
/// (adjusting the reward accordingly).
pub const BLOCK_TIME_SEC: u64 = 60;

/// The block subsidy amount, one grin per second on average
pub const REWARD: u64 = BLOCK_TIME_SEC * GRIN_BASE;

/// Actual block reward for a given total fee amount
pub fn reward(fee: u64) -> u64 {
	REWARD.saturating_add(fee)
}

/// an hour in seconds
pub const HOUR_SEC: u64 = 60 * 60;

/// Nominal height for standard time intervals, hour is 60 blocks
pub const HOUR_HEIGHT: u64 = HOUR_SEC / BLOCK_TIME_SEC;
/// A day is 1440 blocks
pub const DAY_HEIGHT: u64 = 24 * HOUR_HEIGHT;
/// A week is 10_080 blocks
pub const WEEK_HEIGHT: u64 = 7 * DAY_HEIGHT;
/// A year is 524_160 blocks
pub const YEAR_HEIGHT: u64 = 52 * WEEK_HEIGHT;

/// Number of blocks before a coinbase matures and can be spent
pub const COINBASE_MATURITY: u64 = DAY_HEIGHT;

/// Target ratio of secondary proof of work to primary proof of work,
/// as a function of block height (time). Starts at 90% losing a percent
/// approximately every week. Represented as an integer between 0 and 100.
pub fn secondary_pow_ratio(height: u64) -> u64 {
	90u64.saturating_sub(height / (2 * YEAR_HEIGHT / 90))
}

/// Cuckoo-cycle proof size (cycle length)
pub const PROOFSIZE: usize = 42;

/// Default Cuckatoo Cycle edge_bits, used for mining and validating.
pub const DEFAULT_MIN_EDGE_BITS: u8 = 31;

/// Cuckaroo* proof-of-work edge_bits, meant to be ASIC resistant.
pub const SECOND_POW_EDGE_BITS: u8 = 29;

/// Original reference edge_bits to compute difficulty factors for higher
/// Cuckoo graph sizes, changing this would hard fork
pub const BASE_EDGE_BITS: u8 = 24;

/// Default number of blocks in the past when cross-block cut-through will start
/// happening. Needs to be long enough to not overlap with a long reorg.
/// Rational
/// behind the value is the longest bitcoin fork was about 30 blocks, so 5h. We
/// add an order of magnitude to be safe and round to 7x24h of blocks to make it
/// easier to reason about.
pub const CUT_THROUGH_HORIZON: u32 = WEEK_HEIGHT as u32;

/// Default number of blocks in the past to determine the height where we request
/// a txhashset (and full blocks from). Needs to be long enough to not overlap with
/// a long reorg.
/// Rational behind the value is the longest bitcoin fork was about 30 blocks, so 5h.
/// We add an order of magnitude to be safe and round to 2x24h of blocks to make it
/// easier to reason about.
pub const STATE_SYNC_THRESHOLD: u32 = 2 * DAY_HEIGHT as u32;

/// Weight of an input when counted against the max block weight capacity
pub const INPUT_WEIGHT: u64 = 1;

/// Weight of an output when counted against the max block weight capacity
pub const OUTPUT_WEIGHT: u64 = 21;

/// Weight of a kernel when counted against the max block weight capacity
pub const KERNEL_WEIGHT: u64 = 3;

/// Total maximum block weight. At current sizes, this means a maximum
/// theoretical size of:
/// * `(674 + 33 + 1) * (40_000 / 21) = 1_348_571` for a block with only outputs
/// * `(1 + 8 + 8 + 33 + 64) * (40_000 / 3) = 1_520_000` for a block with only kernels
/// * `(1 + 33) * 40_000 = 1_360_000` for a block with only inputs
///
/// Regardless of the relative numbers of inputs/outputs/kernels in a block the maximum
/// block size is around 1.5MB
/// For a block full of "average" txs (2 inputs, 2 outputs, 1 kernel) we have -
/// `(1 * 2) + (21 * 2) + (3 * 1) = 47` (weight per tx)
/// `40_000 / 47 = 851` (txs per block)
///
pub const MAX_BLOCK_WEIGHT: u64 = 40_000;

/// Fork every 6 months.
pub const HARD_FORK_INTERVAL: u64 = YEAR_HEIGHT / 2;

/// Testnet first hard fork height, set to happen around 2019-06-20
pub const TESTNET_FIRST_HARD_FORK: u64 = 185_040;

/// Testnet second hard fork height, set to happen around 2019-12-19
pub const TESTNET_SECOND_HARD_FORK: u64 = 298_080;

/// Testnet second hard fork height, set to happen around 2020-06-20
pub const TESTNET_THIRD_HARD_FORK: u64 = 552_960;

/// Testnet second hard fork height, set to happen around 2020-12-8
pub const TESTNET_FOURTH_HARD_FORK: u64 = 642_240;

/// Fork every 3 blocks
pub const TESTING_HARD_FORK_INTERVAL: u64 = 3;

/// Compute possible block version at a given height, implements
/// 6 months interval scheduled hard forks for the first 2 years.
pub fn header_version(height: u64) -> HeaderVersion {
	let hf_interval = (1 + height / HARD_FORK_INTERVAL) as u16;
	match global::get_chain_type() {
		global::ChainTypes::Mainnet => HeaderVersion(min(5, hf_interval)),
		global::ChainTypes::AutomatedTesting | global::ChainTypes::UserTesting => {
			let testing_hf_interval = (1 + height / TESTING_HARD_FORK_INTERVAL) as u16;
			HeaderVersion(min(5, testing_hf_interval))
		}
		global::ChainTypes::Testnet => {
			if height < TESTNET_FIRST_HARD_FORK {
				HeaderVersion(1)
			} else if height < TESTNET_SECOND_HARD_FORK {
				HeaderVersion(2)
			} else if height < TESTNET_THIRD_HARD_FORK {
				HeaderVersion(3)
			} else if height < TESTNET_FOURTH_HARD_FORK {
				HeaderVersion(4)
			} else {
				HeaderVersion(5)
			}
		}
	}
}

/// Check whether the block version is valid at a given height, implements
/// 6 months interval scheduled hard forks for the first 2 years.
pub fn valid_header_version(height: u64, version: HeaderVersion) -> bool {
	version == header_version(height)
}

/// Number of blocks used to calculate difficulty adjustment by Damped Moving Average
pub const DMA_WINDOW: u64 = HOUR_HEIGHT;

/// Difficulty adjustment half life (actually, 60s * number of 0s-blocks to raise diff by factor e) is 4 hours
pub const WTEMA_HALF_LIFE: u64 = 4 * HOUR_SEC;

/// Average time span of the DMA difficulty adjustment window
pub const BLOCK_TIME_WINDOW: u64 = DMA_WINDOW * BLOCK_TIME_SEC;

/// Clamp factor to use for DMA difficulty adjustment
/// Limit value to within this factor of goal
pub const CLAMP_FACTOR: u64 = 2;

/// Dampening factor to use for DMA difficulty adjustment
pub const DMA_DAMP_FACTOR: u64 = 3;

/// Dampening factor to use for AR scale calculation.
pub const AR_SCALE_DAMP_FACTOR: u64 = 13;

/// Compute weight of a graph as number of siphash bits defining the graph
/// The height dependence allows a 30-week linear transition from C31+ to C32+ starting after 1 year
pub fn graph_weight(height: u64, edge_bits: u8) -> u64 {
	let mut xpr_edge_bits = edge_bits as u64;

	let expiry_height = YEAR_HEIGHT;
	if edge_bits == 31 && height >= expiry_height {
		xpr_edge_bits = xpr_edge_bits.saturating_sub(1 + (height - expiry_height) / WEEK_HEIGHT);
	}
	// For C31 xpr_edge_bits reaches 0 at height YEAR_HEIGHT + 30 * WEEK_HEIGHT
	// 30 weeks after Jan 15, 2020 would be Aug 12, 2020

	(2u64 << (edge_bits - global::base_edge_bits()) as u64) * xpr_edge_bits
}

/// minimum solution difficulty after HardFork4 when PoW becomes primary only Cuckatoo32+
pub const C32_GRAPH_WEIGHT: u64 = (2u64 << (32 - BASE_EDGE_BITS) as u64) * 32; // 16384

/// Minimum difficulty, enforced in Damped Moving Average diff retargetting
/// avoids getting stuck when trying to increase difficulty subject to dampening
pub const MIN_DMA_DIFFICULTY: u64 = DMA_DAMP_FACTOR;

/// Minimum scaling factor for AR pow, enforced in diff retargetting
/// avoids getting stuck when trying to increase ar_scale subject to dampening
pub const MIN_AR_SCALE: u64 = AR_SCALE_DAMP_FACTOR;

/// unit difficulty, equal to graph_weight(SECOND_POW_EDGE_BITS)
pub const UNIT_DIFFICULTY: u64 =
	((2 as u64) << (SECOND_POW_EDGE_BITS - BASE_EDGE_BITS)) * (SECOND_POW_EDGE_BITS as u64);

/// The initial difficulty at launch. This should be over-estimated
/// and difficulty should come down at launch rather than up
/// Currently grossly over-estimated at 10% of current
/// ethereum GPUs (assuming 1GPU can solve a block at diff 1 in one block interval)
pub const INITIAL_DIFFICULTY: u64 = 1_000_000 * UNIT_DIFFICULTY;

/// Minimal header information required for the Difficulty calculation to
/// take place. Used to iterate through a number of blocks. Note that an instance
/// of this is unable to calculate its own hash, due to an optimization that prevents
/// the header's PoW proof nonces from being deserialized on read
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HeaderDifficultyInfo {
	/// Hash of this block
	pub hash: Option<Hash>,
	/// Timestamp of the header, 1 when not used (returned info
```

### Core Architecture Module: `core/src/core.rs`
```
// Copyright 2021 The Grin Developers
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

//! Core types

pub mod block;
pub mod block_sums;
pub mod committed;
pub mod compact_block;
pub mod hash;
pub mod id;
pub mod merkle_proof;
pub mod pmmr;
pub mod transaction;

use crate::consensus::GRIN_BASE;
use util::secp::pedersen::Commitment;

pub use self::block::*;
pub use self::block_sums::*;
pub use self::committed::Committed;
pub use self::compact_block::*;
pub use self::id::ShortId;
pub use self::pmmr::segment::*;
pub use self::transaction::*;

/// Common errors
#[derive(thiserror::Error, Debug)]
pub enum Error {
	/// Human readable represenation of amount is invalid
	#[error("Amount string was invalid")]
	InvalidAmountString,
}

/// Common method for parsing an amount from human-readable, and converting
/// to internally-compatible u64

pub fn amount_from_hr_string(amount: &str) -> Result<u64, Error> {
	// no i18n yet, make sure we use '.' as the separator
	if amount.find(',').is_some() {
		return Err(Error::InvalidAmountString);
	}
	let (grins, ngrins) = match amount.find('.') {
		None => (parse_grins(amount)?, 0),
		Some(pos) => {
			let (gs, tail) = amount.split_at(pos);
			(parse_grins(gs)?, parse_ngrins(&tail[1..])?)
		}
	};
	Ok(grins * GRIN_BASE + ngrins)
}

fn parse_grins(amount: &str) -> Result<u64, Error> {
	if amount == "" {
		Ok(0)
	} else {
		amount
			.parse::<u64>()
			.map_err(|_| Error::InvalidAmountString)
	}
}

lazy_static! {
	static ref WIDTH: usize = (GRIN_BASE as f64).log(10.0) as usize + 1;
}

fn parse_ngrins(amount: &str) -> Result<u64, Error> {
	let amount = if amount.len() > *WIDTH {
		&amount[..*WIDTH]
	} else {
		amount
	};
	format!("{:0<width$}", amount, width = WIDTH)
		.parse::<u64>()
		.map_err(|_| Error::InvalidAmountString)
}

/// Common method for converting an amount to a human-readable string

pub fn amount_to_hr_string(amount: u64, truncate: bool) -> String {
	let amount = (amount as f64 / GRIN_BASE as f64) as f64;
	let hr = format!("{:.*}", WIDTH, amount);
	if truncate {
		let nzeros = hr.chars().rev().take_while(|x| x == &'0').count();
		if nzeros < *WIDTH {
			return hr.trim_end_matches('0').to_string();
		} else {
			return format!("{}0", hr.trim_end_matches('0'));
		}
	}
	hr
}

#[cfg(test)]
mod test {
	use super::*;

	#[test]
	pub fn test_amount_from_hr() {
		assert!(50123456789 == amount_from_hr_string("50.123456789").unwrap());
		assert!(50123456789 == amount_from_hr_string("50.1234567899").unwrap());
		assert!(50 == amount_from_hr_string(".000000050").unwrap());
		assert!(1 == amount_from_hr_string(".000000001").unwrap());
		assert!(0 == amount_from_hr_string(".0000000009").unwrap());
		assert!(500_000_000_000 == amount_from_hr_string("500").unwrap());
		assert!(
			5_000_000_000_000_000_000 == amount_from_hr_string("5000000000.00000000000").unwrap()
		);
		assert!(66_600_000_000 == amount_from_hr_string("66.6").unwrap());
		assert!(66_000_000_000 == amount_from_hr_string("66.").unwrap());
	}

	#[test]
	pub fn test_amount_to_hr() {
		assert!("50.123456789" == amount_to_hr_string(50123456789, false));
		assert!("50.123456789" == amount_to_hr_string(50123456789, true));
		assert!("0.000000050" == amount_to_hr_string(50, false));
		assert!("0.00000005" == amount_to_hr_string(50, true));
		assert!("0.000000001" == amount_to_hr_string(1, false));
		assert!("0.000000001" == amount_to_hr_string(1, true));
		assert!("500.000000000" == amount_to_hr_string(500_000_000_000, false));
		assert!("500.0" == amount_to_hr_string(500_000_000_000, true));
		assert!("5000000000.000000000" == amount_to_hr_string(5_000_000_000_000_000_000, false));
		assert!("5000000000.0" == amount_to_hr_string(5_000_000_000_000_000_000, true));
		assert!("66.6" == amount_to_hr_string(66600000000, true));
	}
}

```

### Core Architecture Module: `core/src/core/block.rs`
```
// Copyright 2021 The Grin Developers
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

//! Blocks and blockheaders

use crate::consensus::{self, reward, REWARD};
use crate::core::committed::{self, Committed};
use crate::core::compact_block::CompactBlock;
use crate::core::hash::{DefaultHashable, Hash, Hashed, ZERO_HASH};
use crate::core::{
	pmmr, transaction, Commitment, Inputs, KernelFeatures, Output, Transaction, TransactionBody,
	TxKernel, Weighting,
};
use crate::global;
use crate::pow::{verify_size, Difficulty, Proof, ProofOfWork};
use crate::ser::{
	self, deserialize_default, serialize_default, PMMRable, Readable, Reader, Writeable, Writer,
};
use chrono::prelude::{DateTime, Utc};
use chrono::Duration;
use keychain::{self, BlindingFactor};
use std::convert::TryInto;
use std::fmt;
use util::from_hex;
use util::{secp, static_secp_instance};

/// Errors thrown by Block validation
#[derive(Debug, Clone, Eq, PartialEq, thiserror::Error)]
pub enum Error {
	/// The sum of output minus input commitments does not
	/// match the sum of kernel commitments
	KernelSumMismatch,
	/// The total kernel sum on the block header is wrong
	InvalidTotalKernelSum,
	/// Same as above but for the coinbase part of a block, including reward
	CoinbaseSumMismatch,
	/// Restrict block total weight.
	TooHeavy,
	/// Block version is invalid for a given block height
	InvalidBlockVersion(HeaderVersion),
	/// Block time is invalid
	InvalidBlockTime,
	/// Invalid POW
	InvalidPow,
	/// Kernel not valid due to lock_height exceeding block header height
	KernelLockHeight(u64),
	/// NRD kernels are not valid prior to HF3.
	NRDKernelPreHF3,
	/// NRD kernels are not valid if disabled locally via "feature flag".
	NRDKernelNotEnabled,
	/// Underlying tx related error
	Transaction(transaction::Error),
	/// Underlying Secp256k1 error (signature validation or invalid public key
	/// typically)
	Secp(secp::Error),
	/// Underlying keychain related error
	Keychain(keychain::Error),
	/// Underlying Merkle proof error
	MerkleProof,
	/// Error when verifying kernel sums via committed trait.
	Committed(committed::Error),
	/// Validation error relating to cut-through.
	/// Specifically the tx is spending its own output, which is not valid.
	CutThrough,
	/// Underlying serialization error.
	Serialization(ser::Error),
	/// Other unspecified error condition
	Other(String),
}

impl From<committed::Error> for Error {
	fn from(e: committed::Error) -> Error {
		Error::Committed(e)
	}
}

impl From<transaction::Error> for Error {
	fn from(e: transaction::Error) -> Error {
		Error::Transaction(e)
	}
}

impl From<ser::Error> for Error {
	fn from(e: ser::Error) -> Error {
		Error::Serialization(e)
	}
}

impl From<secp::Error> for Error {
	fn from(e: secp::Error) -> Error {
		Error::Secp(e)
	}
}

impl From<keychain::Error> for Error {
	fn from(e: keychain::Error) -> Error {
		Error::Keychain(e)
	}
}

impl fmt::Display for Error {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "Block Error (display needs implementation")
	}
}

/// Header entry for storing in the header MMR.
/// Note: we hash the block header itself and maintain the hash in the entry.
/// This allows us to lookup the original header from the db as necessary.
#[derive(Debug)]
pub struct HeaderEntry {
	hash: Hash,
	timestamp: u64,
	total_difficulty: Difficulty,
	secondary_scaling: u32,
	is_secondary: bool,
}

impl Readable for HeaderEntry {
	fn read<R: Reader>(reader: &mut R) -> Result<HeaderEntry, ser::Error> {
		let hash = Hash::read(reader)?;
		let timestamp = reader.read_u64()?;
		let total_difficulty = Difficulty::read(reader)?;
		let secondary_scaling = reader.read_u32()?;

		// Using a full byte to represent the bool for now.
		let is_secondary = reader.read_u8()? != 0;

		Ok(HeaderEntry {
			hash,
			timestamp,
			total_difficulty,
			secondary_scaling,
			is_secondary,
		})
	}
}

impl Writeable for HeaderEntry {
	fn write<W: Writer>(&self, writer: &mut W) -> Result<(), ser::Error> {
		self.hash.write(writer)?;
		writer.write_u64(self.timestamp)?;
		self.total_difficulty.write(writer)?;
		writer.write_u32(self.secondary_scaling)?;

		// Using a full byte to represent the bool for now.
		if self.is_secondary {
			writer.write_u8(1)?;
		} else {
			writer.write_u8(0)?;
		}
		Ok(())
	}
}

impl Hashed for HeaderEntry {
	/// The hash of the underlying block.
	fn hash(&self) -> Hash {
		self.hash
	}
}

/// Some type safety around header versioning.
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Serialize)]
pub struct HeaderVersion(pub u16);

impl From<HeaderVersion> for u16 {
	fn from(v: HeaderVersion) -> u16 {
		v.0
	}
}

impl Writeable for HeaderVersion {
	fn write<W: Writer>(&self, writer: &mut W) -> Result<(), ser::Error> {
		writer.write_u16(self.0)
	}
}

impl Readable for HeaderVersion {
	fn read<R: Reader>(reader: &mut R) -> Result<HeaderVersion, ser::Error> {
		let version = reader.read_u16()?;
		Ok(HeaderVersion(version))
	}
}

/// Block header, fairly standard compared to other blockchains.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct BlockHeader {
	/// Version of the block
	pub version: HeaderVersion,
	/// Height of this block since the genesis block (height 0)
	pub height: u64,
	/// Hash of the block previous to this in the chain.
	pub prev_hash: Hash,
	/// Root hash of the header MMR at the previous header.
	pub prev_root: Hash,
	/// Timestamp at which the block was built.
	pub timestamp: DateTime<Utc>,
	/// Merklish root of all the commitments in the TxHashSet
	pub output_root: Hash,
	/// Merklish root of all range proofs in the TxHashSet
	pub range_proof_root: Hash,
	/// Merklish root of all transaction kernels in the TxHashSet
	pub kernel_root: Hash,
	/// Total accumulated sum of kernel offsets since genesis block.
	/// We can derive the kernel offset sum for *this* block from
	/// the total kernel offset of the previous block header.
	pub total_kernel_offset: BlindingFactor,
	/// Total size of the output MMR after applying this block
	pub output_mmr_size: u64,
	/// Total size of the kernel MMR after applying this block
	pub kernel_mmr_size: u64,
	/// Proof of work and related
	pub pow: ProofOfWork,
}
impl DefaultHashable for BlockHeader {}

impl Default for BlockHeader {
	fn default() -> BlockHeader {
		BlockHeader {
			version: HeaderVersion(1),
			height: 0,
			timestamp: DateTime::from_naive_utc_and_offset(
				DateTime::<Utc>::from_timestamp(0, 0).unwrap().naive_utc(),
				Utc,
			),
			prev_hash: ZERO_HASH,
			prev_root: ZERO_HASH,
			output_root: ZERO_HASH,
			range_proof_root: ZERO_HASH,
			kernel_root: ZERO_HASH,
			total_kernel_offset: BlindingFactor::zero(),
			output_mmr_size: 0,
			kernel_mmr_size: 0,
			pow: ProofOfWork::default(),
		}
	}
}

impl PMMRable for BlockHeader {
	type E = HeaderEntry;

	fn as_elmt(&self) -> Self::E {
		HeaderEntry {
			hash: self.hash(),
			timestamp: self.timestamp.timestamp() as u64,
			total_difficulty: self.total_difficulty(),
			secondary_scaling: self.pow.secondary_scaling,
			is_secondary: self.pow.is_secondary(),
		}
	}

	// Size is hash + u64 + difficulty + u32 + u8.
	fn elmt_size() -> Option<u16> {
		const LEN: usize = Hash::LEN + 8 + Difficulty::LEN + 4 + 1;
		Some(LEN.try_into().unwrap())
	}
}

/// Serialization of a block header
impl Writeable for BlockHeader {
	fn write<W: Writer>(&self, writer: &mut W) -> Result<(), ser::Error> {
		if !writer.serialization_mode().is_hash_mode() {
			self.write_pre_pow(writer)?;
		}
		self.pow.write(writer)?;
		Ok(())
	}
}

fn read_block_header<R: Reader>(reader: &mut R) -> Result<BlockHeader, ser::Error> {
	let version = HeaderVersion::read(reader)?;
	let (height, timestamp) = ser_multiread!(reader, read_u64, read_i64);
	let prev_hash = Hash::read(reader)?;
	let prev_root = Hash::read(reader)?;
	let output_root = Hash::read(reader)?;
	let range_proof_root = Hash::read(reader)?;
	let kernel_root = Hash::read(reader)?;
	let total_kernel_offset = BlindingFactor::read(reader)?;
	let (output_mmr_size, kernel_mmr_size) = ser_multiread!(reader, read_u64, read_u64);
	let pow = ProofOfWork::read(reader)?;

	if timestamp
		> chrono::NaiveDate::MAX
			.and_hms_opt(0, 0, 0)
			.unwrap()
			.and_utc()
			.timestamp()
		|| timestamp
			< chrono::NaiveDate::MIN
				.and_hms_opt(0, 0, 0)
				.unwrap()
				.and_utc()
				.timestamp()
	{
		return Err(ser::Error::CorruptedData);
	}

	let ts = DateTime::<Utc>::from_timestamp(timestamp, 0);
	if ts.is_none() {
		return Err(ser::Error::CorruptedData);
	}

	Ok(BlockHeader {
		version,
		height,
		timestamp: DateTime::from_naive_utc_and_offset(ts.unwrap().naive_utc(), Utc),
		prev_hash,
		prev_root,
		output_root,
		range_proof_root,
		kernel_root,
		total_kernel_offset,
		output_mmr_size,
		kernel_mmr_size,
		pow,
	})
}

/// Deserialization of a block header
impl Readable for BlockHeader {
	fn read<R: Reader>(reader: &mut R) -> Result<BlockHeader, ser::Error> {
		read_block_header(reader)
	}
}

impl BlockHeader {
	/// Write the pre-hash portion of the header
	pub fn write_pre_pow<W: Writer>(&self, writer: &mut W) -> Result<(), ser::Error> {
		self.version.write(writer)?;
		ser_multiwrite!(
			writer,
			[write_u64, self.height],
			[write_i64, self.timestamp.timestamp()],
			[write_fixed_bytes, &self.prev_hash],
			[write_fixed_bytes, &self.prev_root],
			[write_fixed_bytes, &self.output_root],
			[write_fixed_bytes, &self.range_proof_root],
			[write_fixed_bytes, &self.kernel_root],
			[write_fixed_bytes, &self.total_kernel_offse
```

### Core Architecture Module: `core/src/core/block_sums.rs`
```
// Copyright 2021 The Grin Developers
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

//! BlockSums per-block running totals for utxo_sum and kernel_sum.
//! Allows fast "full" verification of kernel sums at a given block height.

use crate::core::committed::Committed;
use crate::ser::{self, Readable, Reader, Writeable, Writer};
use util::secp::pedersen::Commitment;
use util::secp_static;

/// The output_sum and kernel_sum for a given block.
/// This is used to validate the next block being processed by applying
/// the inputs, outputs, kernels and kernel_offset from the new block
/// and checking everything sums correctly.
#[derive(Debug, Clone)]
pub struct BlockSums {
	/// The sum of the unspent outputs.
	pub utxo_sum: Commitment,
	/// The sum of all kernels.
	pub kernel_sum: Commitment,
}

impl Writeable for BlockSums {
	fn write<W: Writer>(&self, writer: &mut W) -> Result<(), ser::Error> {
		writer.write_fixed_bytes(&self.utxo_sum)?;
		writer.write_fixed_bytes(&self.kernel_sum)?;
		Ok(())
	}
}

impl Readable for BlockSums {
	fn read<R: Reader>(reader: &mut R) -> Result<BlockSums, ser::Error> {
		Ok(BlockSums {
			utxo_sum: Commitment::read(reader)?,
			kernel_sum: Commitment::read(reader)?,
		})
	}
}

impl Default for BlockSums {
	fn default() -> BlockSums {
		let zero_commit = secp_static::commit_to_zero_value();
		BlockSums {
			utxo_sum: zero_commit,
			kernel_sum: zero_commit,
		}
	}
}

/// It's a tuple but we can verify the "full" kernel sums on it.
/// This means we can take a previous block_sums, apply a new block to it
/// and verify the full kernel sums (full UTXO and kernel sets).
impl<'a> Committed for (BlockSums, &'a dyn Committed) {
	fn inputs_committed(&self) -> Vec<Commitment> {
		self.1.inputs_committed()
	}

	fn outputs_committed(&self) -> Vec<Commitment> {
		let mut outputs = vec![self.0.utxo_sum];
		outputs.extend(&self.1.outputs_committed());
		outputs
	}

	fn kernels_committed(&self) -> Vec<Commitment> {
		let mut kernels = vec![self.0.kernel_sum];
		kernels.extend(&self.1.kernels_committed());
		kernels
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3641** (2021-06-10): **Grin node 5.1.0 won't launch on Linux**
  *Symptoms*: **Describe the bug** Grin node v5.1.0 will not launch on Debian Buster, returning "Illegal instruction" to stdout.  **To Reproduce** ``` $ grin Illegal instruction $ echo $? 132 $ ps aux |grep -E '[g]rin' $  ```   **Relevant Information** ``` 20210506 16:53:04.446 INFO grin_util::logger - log4rs is initialized, file level: Debug, stdout level: Warn, min. level: Debug                                                                                       20210506 16:53:04.447 INFO grin - Using configuration file at /home/$USER/.grin/main/grin-server.toml 20210506 16:53:04.447 INFO grin - This is Grin version 5.1.0 (git v5.1.0), built for x86_64-unknown-linux-gnu by rustc 1.51.0 (2fd73fabe 2021-03-23).                                                                20210506 16:53:04.448 DEBUG grin - Built with profile "release", features "". 20210506 16:53:04.448 INFO grin - Chain: Mainnet 20210506 16:53:04.448 INFO grin - Accept Fee Base: 500000 20210506 16:53:04.449 INFO grin - Future Time Limit: 300 20210506 16:53:04.449 INFO grin - Feature: NRD kernel enabled: false 20210506 16:53:04.449 WARN grin::cmd::server - Starting GRIN in UI mode... 20210506 16:53:04.450 INFO grin_servers::grin::server - Starting server, genesis block: 40adad0aec27 20210506 16:53:04.451 DEBUG grin_store::lmdb - DB Mapsize for /home/$USER/.grin/main/chain_data/lmdb is 549755813888 ```  **Desktop (please complete the following information):** ``` $ cat /etc/os-release PRETT
  **Post-Mortem & Fix Analysis**:
  > I just tried compiling from source on a Void Linux machine.  Still unable to run the node - here's a sanitized verbose stacktrace (the compilation steps are truncated for brevity's sake):  ``` ~/b/g/grin (master)> git checkout -b 5.1.0 v5.1.0 ~/b/g/grin (5.1.0)> cargo build --release ...    Compiling grin_core v5.1.0 (/opt/$USER/bench/gitrepos/grin/core)    Compiling grin_store v5.1.0 (/opt/$USER/bench/gitrepos/grin/store)    Compiling grin_pool v5.1.0 (/opt/$USER/bench/gitrepos/grin/pool)    Compiling grin_chain v5.1.0 (/opt/$USER/bench/gitrepos/grin/chain)    Compiling grin_p2p v5.1.0 (/opt/$USER/bench/gitrepos/grin/p2p)    Compiling grin_api v5.1.0 (/opt/$USER/bench/gitrepos/grin/api)    Compiling grin_servers v5.1.0 (/opt/$USER/bench/gitrepos/grin/servers)    Compiling grin_config v5.1.0 (/opt/$USER/bench/gitrepos/grin/config)     Finished release [optimized] target(s) in 5m 18s ~/b/g/grin (5.1.0)> set -x RUST_BACKTRACE full ~/b/g/grin (5.1.0)> ./target/release/grin
  > The failing assert while constructing a new GlobalConfig is from here:  https://github.com/mimblewimble/grin/blob/9e27e6f9d3e960466b75f666057143c06e2f5cfc/config/src/config.rs#L345-L348  and related to the rewritten grin-server.toml configuration file.
  > >To Reproduce >$ grin >Illegal instruction >$ echo $? >132 >$ ps aux |grep -E '[g]rin' >$   Did you setup the GRIN server using   ``` ./grin server config ```  and started it as shown in `grin --help` ?   ``` _$ grin server -c grin-server.toml run  ```      

- **Issue #3555** (2021-02-09): **fix for missing block under certain startup conditions**
  *Symptoms*: This PR fixes a "cannot find block" error that can occur during node startup. We have some code that runs during node initialization that exercises the PIBD segmenter as we wanted to keep this code "in use". There is an edge case during startup that we did not account for - if the node is shutdown while it is in the process of syncing then on next startup the chain can find itself in a state where traversing back to the "archive header" (our 720 block archival period) can fail as we do not have the full set of blocks for this time period yet. This PR simply ensures the code that touches the segmenter does not fail in this situation (during startup).  This is related to a jump from one 720 block archive period to the next due to chain height, during sync. It is possible for the jump to result in "missing" blocks as we are still syncing. This is not a problem with data integrity or missing data - its just that we were making a bad assumption during node initialization without accounting for this scenario.  Resolves https://github.com/mimblewimble/grin/issues/3516  
  **Post-Mortem & Fix Analysis**:
  > Going to merge this. Its a small change to node init code, making it more failure tolerant.

- **Issue #3518** (2020-12-15): **no peers available, disabling sync (finally explained, inbound vs outbound inconsistency)**
  *Symptoms*: Thanks to @bladedoyle I think we tracked down one scenario where we see the following regularly in the logs -   ``` 20201211 16:04:08.807 WARN grin_servers::grin::sync::syncer - sync: no peers available, disabling sync ```  When syncing we find "max diff" from _all_ our peers (inbound _and_ outbound) then we randomly select an _outbound_ peer with that diff to sync from. But we can be in a situation where "max diff" is from an inbound peer without any outbound peers currently being at that diff (say a new block was very recently found) and our peers had not yet updated local diff via ping/pong (every 5-10secs).  ----  We only want to sync from peers we know we reached out to.  Need to think through how best we can approach this.     
  **Post-Mortem & Fix Analysis**:
  > This affects all stages of sync -   * header sync * state sync (txhashset.zip) * body sync (full blocks)  Behavior here _did_ change recently to make this consistent throughout the sync process.  We were originally inconsistent with how we handled the peer filtering/selection throughout the sync process https://github.com/mimblewimble/grin/pull/3458  

- **Issue #3511** (2020-12-08): **Block migration check during node init unacceptably slow for full archive node**
  *Symptoms*: Block migration (v2 -> v3) results in really slow startup for full archive nodes. This is due to our naive handling of "do we need to migrate this block, or not" for _every_ block in the db (and this is a lot of blocks for a full archive node). We iterate over the full set of blocks in the db and check each one individually. This happens every time the node starts/restarts.  Thanks to @bladedoyle for investigating and discovering this -   ``` 20201204 17:22:06.772 INFO grin - This is Grin version 5.0.0-beta.2 (git v5.0.0-beta.2), built for x86_64-unknown-linux-gnu by rustc 1.48.0 (7eac88abb 2020-11-16). 20201204 17:22:06.772 DEBUG grin - Built with profile "debug", features "". 20201204 17:22:06.772 INFO grin - Chain: Mainnet 20201204 17:22:06.773 INFO grin - Accept Fee Base: 1000000 20201204 17:22:06.773 INFO grin - Future Time Limit: 300 20201204 17:22:06.773 INFO grin - Feature: NRD kernel enabled: false 20201204 17:22:06.773 WARN grin::cmd::server - Starting GRIN in UI mode... 20201204 17:22:06.775 INFO grin_servers::grin::server - Starting server, genesis block: 40adad0aec27 20201204 17:22:06.775 DEBUG grin_store::lmdb - DB Mapsize for /home/grin/.grin/main/chain_data/lmdb is 549755813888 20201204 17:54:37.242 DEBUG grin_chain::chain - migrate_db_v2_v3: 0 blocks to migrate ```  Related #3450  In #3450 we reworked the migration process to migrate blocks in smaller batches. But we still check _every_ block, every time.  Proposed solution: Introduce a 
  **Post-Mortem & Fix Analysis**:
  > Tested, Verified, Looks good, thanks @antiochp 

- **Issue #3485** (2020-11-09): **on_block_accepted hooks should fire regardless of sync**
  *Symptoms*: If we successfully process and accept a new block we call `block_accepted` on the adapter. This call to `block_accepted` performs several operations -   * triggers all registered `on_block_accepted` hooks (webhooks and logging) * broadcast the new block (header first) to our peers * reconcile the mempool * reconcile the mempool related "reorg cache"  The first two operations are suppressed if we are processing blocks in "sync" mode. We do not want to broadcast blocks to our peers if we are syncing.  I believe the logic here is incorrect for the first operation. I think we _do_ want to log (and fire webhooks) for all blocks accepted, regardless of sync/broadcast.  Note the "gap" here between blocks at height `949737` and `949748` -  ``` 20201108 02:47:03.845 DEBUG grin_servers::common::hooks - block_accepted (head+): 0002385f0a23 at 949735 (prev: 000004f47538 at 949734) 20201108 02:47:15.616 DEBUG grin_servers::common::hooks - block_accepted (head+): 00011eb0abc8 at 949736 (prev: 0002385f0a23 at 949735) 20201108 02:48:03.850 DEBUG grin_servers::common::hooks - block_accepted (head+): 0001a30458c9 at 949737 (prev: 00011eb0abc8 at 949736) 20201108 02:49:46.899 DEBUG grin_servers::common::hooks - block_accepted (head+): 0001aa69e5bd at 949748 (prev: 000064b9880a at 949747) 20201108 02:50:22.396 DEBUG grin_servers::common::hooks - block_accepted (head+): 0001c69874d5 at 949749 (prev: 0001aa69e5bd at 949748) 20201108 02:51:05.126 DEBUG grin_servers::common::ho
  **Post-Mortem & Fix Analysis**:
  > These are the recent events where we transitioned into sync due to being several blocks behind the currently advertised most work chain head -   ``` zcat grin-server.log.* | grep "NoSync -> HeaderSync" | sort 20201102 03:07:48.315 DEBUG grin_chain::types - sync_state: sync_status: NoSync -> HeaderSync { current_height: 941129, highest_height: 941134 } 20201107 23:36:04.339 DEBUG grin_chain::types - sync_state: sync_status: NoSync -> HeaderSync { current_height: 949510, highest_height: 949540 } 20201108 02:05:49.602 DEBUG grin_chain::types - sync_state: sync_status: NoSync -> HeaderSync { current_height: 949678, highest_height: 949709 } 20201108 02:48:05.958 DEBUG grin_chain::types - sync_state: sync_status: NoSync -> HeaderSync { current_height: 949737, highest_height: 949747 } ```  The most recent 3 are I believe the 3 confirmed reorgs experienced over the weekend. There are no corresponding "REORG!" log msgs due to the logging being suppressed.  It would be interesting t

- **Issue #3465** (2020-10-08): **fix v2 conversion to ensure we provide blocks in correct format**
  *Symptoms*: Testing on `testnet` (was `floonet`) uncovered an issue in our protocol version handling when providing blocks to v2 peers.  I think we see this on `testnet` because there are relatively few nodes in sync. This does not appear to be happening on `mainnet` but I suspect this is simply masked by the fact we have better connectivity and more peers available.  The following error occurs when attempting to provide a full block to a v2 peer -  ``` 20201007 14:54:15.459 DEBUG grin_p2p::conn - try_break: exit the loop: Serialization(UnsupportedProtocolVersion) ```  This is because we store v3 `CommitOnly` blocks in the local db and the bug resulted in us not converting the block into v2 compatible format prior to the serialization attempt. We do not have "input features" and cannot serialize successfully.  * We need to do the conversion _if_ the peer is `v2`.  * For `v3` peers and above we do _not_ need to convert.  The bug had this logic flipped.  ----  This would most obviously manifest itself if a `4.0.0` node attempted to sync against a number of `4.1.0` nodes. Given `4.1.0` is the latest binary this is unlikely to occur. I think this is why we did not see this on `mainnet` and we are only seeing it on `testnet`. 
  **Post-Mortem & Fix Analysis**:
  > > Given `4.1.0` is the latest binary this is unlikely to occur.  It will occur for new Grin++ and Niffler nodes though, because Niffler is still 4.0.0 IIRC, and Grin++ won't be v3 for a few more months. So it would be nice to include this if we have a patch release going out soon.
  > > > Given `4.1.0` is the latest binary this is unlikely to occur. >  > It will occur for new Grin++ and Niffler nodes though, because Niffler is still 4.0.0 IIRC, and Grin++ won't be v3 for a few more months. So it would be nice to include this if we have a patch release going out soon.  Yes. Planning to get a patch release out today to include this. 

- **Issue #3448** (2020-10-07): **MDB_MAP_FULL: Environment mapsize limit reached (4.0.1 -> 4.1.0)**
  *Symptoms*: Tried to upgrade node from 4.0.1 to 4.1.0 (linux release binaries) and got error:  ``` 20200919 15:28:35.797 ERROR grin_util::logger - thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: Chain(Error { inner: LmdbErr(Error::Code(-30792, 'MDB_MAP_FULL: Environment mapsize limit reached'))  Store Error: LmdbErr(Error::Code(-30792, 'MDB_MAP_FULL: Environment mapsize limit reached')), reason: LMDB error: MDB_MAP_FULL: Environment mapsize limit reached  })': src/bin/cmd/server.rs:78   0: grin_util::logger::send_panic_to_log::{{closure}}    1: std::panicking::rust_panic_with_hook              at /rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libstd/panicking.rs:530    2: rust_begin_unwind              at /rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libstd/panicking.rs:437    3: core::panicking::panic_fmt              at /rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libcore/panicking.rs:85    4: core::option::expect_none_failed              at /rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libcore/option.rs:1269    5: grin::cmd::server::start_server_tui    6: grin::cmd::server::server_command    7: grin::real_main    8: grin::main    9: std::rt::lang_start::{{closure}}   10: std::rt::lang_start_internal::{{closure}}              at /rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libstd/rt.rs:52       std::panicking::try::do_call              at /rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libstd/panicking.rs
  **Post-Mortem & Fix Analysis**:
  > +1 I have the same trouble
  > Is this only happening on `4.1.0` or does this continue to happen if you revert to `4.0.1`. We have some logic in there around resizing the lmdb database files but I don't think anything changed in `4.1.0`.  Let me dig around a bit - maybe there is a code path that uses lmdb without checking if it need to be resized somewhere.
  > Just re-acquainting myself with #3099 and yes it does look like this is (still) the likely culprit. :+1:  

- **Issue #3424** (2020-08-18): **verify_cut_through and test coverage**
  *Symptoms*: This PR makes the "cut-through" logic consistent across block validation "in isolation", aligning it with the _implicit_ "cut-through" rules applied later in the block processing pipeline. This is related to a consensus rule but we have confirmed it does not impact existing consensus rules (see below).  This is a relatively large PR but vast majority of additional LOC is in new test coverage and greater flexibility in test setup. The code changes themselves are minimal and limited to early block and transaction validation in `verify_cut_through()`.  ----  In the block processing pipeline we `apply_block()` by iterating over the block outputs calling `apply_output()`  https://github.com/mimblewimble/grin/blob/01a300e68bd7efdccf513a813864e42bd4c9786f/chain/src/txhashset/txhashset.rs#L1125-L1127  Note that we compare the output _commitment_ and we do not allow duplicates by commitment. We process block outputs _before_ block inputs - adding new outputs to the UTXO set before removing spent outputs. So a block is not valid if it attempts to add an output to the UTXO set if an unspent output with that commitment already exists.  Rule 1: It is invalid to spend `C` to produce a new output `C'` if they share the same _commitment_.  When a node initially receives a block we validate it "in isolation". This happens outside of the context of the UTXO. The block is validated to ensure it is internally consistent. As part of this we verify the block is fully "cut-through
  **Post-Mortem & Fix Analysis**:
  > I'd like @tromp to give this a good look over before we merge this one. @j01tz also.
  > So currently a block orders inputs and outputs by hash. Would it make more sense to order them by commitment instead? This would be a consensus breaking change, that would simplify the code: 1) it would no longer need to compute hashes to check the order. 2) it would not need to sort again to check uniqueness. Actually, that's not true. The block has inputs sorted and separately outputs sorted. But that means a simple merge suffices to get all sorted.
  > > So currently a block orders inputs and outputs by hash. Would it make more sense to order them by commitment instead? This would be a consensus breaking change, that would simplify the code: >  > 1. it would no longer need to compute hashes to check the order. > 2. it would not need to sort again to check uniqueness. >    Actually, that's not true. The block has inputs sorted and separately outputs sorted. >    But that means a simple merge suffices to get all sorted.  If inputs and outputs were sorted consistently (by commitment as you suggest) we could use the existing "zero allocation, peekable iterator" approach (a merge that fails early).  I think it is something to definitely consider.  The consensus breaking change aspect of this makes me hesitate, particularly as it affects both consensus via the MMR insertion order _and_ the p2p network message format simultaneously.  We should investigate this and explore further as a separate issue/PR. If we decide to do this t

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

### Incident Patch 1: `3aa9d6c0` (2026-08-09)
**Commit Message**: build: update lock file

**File**: `Cargo.lock` (modified, +121/-141)
```diff
@@ -118,6 +118,12 @@ dependencies = [
  "syn 2.0.118",
 ]
 
+[[package]]
+name = "atomic-waker"
+version = "1.1.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
+
 [[package]]
 name = "atty"
 version = "0.2.14"
@@ -368,9 +374,9 @@ checksum = "245097e9a4535ee1e3e3931fcfcd55a796a44c643e8596ff6566d68f09b87bbc"
 
 [[package]]
 name = "core-foundation"
-version = "0.9.4"
+version = "0.10.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "91e195e091a93c46f7102ec7818a2aa394e1e1771c3ab4825963fa03e45afb8f"
+checksum = "b2a6cd9ae233e7f62ba4e9353e81a88df7fc8a5987b8d445b4d90c879bd156f6"
 dependencies = [
  "core-foundation-sys",
  "libc",
@@ -470,9 +476,9 @@ dependencies = [
 
 [[package]]
 name = "crypto-mac"
-version = "0.11.1"
+version = "0.11.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b1d1a86f49236c215f271d40892d5fc950490551400b02ef360692c29815c714"
+checksum = "25fab6889090c8133f3deb8f73ba3c65a7f456f66436fc012a1b1e272b1e103e"
 dependencies = [
  "generic-array",
  "subtle",
@@ -1014,21 +1020,18 @@ dependencies = [
 
 [[package]]
 name = "grin"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
- "blake2-rfc",
  "built",
  "chrono",
  "clap",
  "ctrlc",
  "cursive",
  "cursive_table_view",
- "futures 0.3.32",
  "grin_api",
  "grin_chain",
  "grin_config",
  "grin_core",
- "grin_keychain",
  "grin_p2p",
  "grin_servers",
  "grin_store",
@@ -1040,35 +1043,35 @@ dependencies = [
  "serde_json",
  "term",
  "thiserror 1.0.69",
+ "tokio",
 ]
 
 [[package]]
 name = "grin_api"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
- "async-stream",
  "bytes 1.12.0",
  "easy-jsonrpc-mw",
  "futures 0.3.32",
  "grin_chain",
  "grin_core",
  "grin_p2p",
  "grin_pool",
- "grin_store",
  "grin_util",
- "http",
+ "http-body-util",
  "hyper",
  "hyper-rustls",
  "hyper-timeout",
+ "hyper-util",
  "lazy_static",
  "log",
  "regex",
- "ring 0.16.20",
  "rustls",
  "rustls-pemfile",
  "serde",
  "serde_derive",
  "serde_json",
+ "subtle",
  "thiserror 1.0.69",
  "tokio",
  "tokio-rustls",
@@ -1077,7 +1080,7 @@ dependencies = [
 
 [[package]]
 name = "grin_chain"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "bit-vec",
  "bitflags 1.3.2",
@@ -1101,7 +1104,7 @@ dependencies = [
 
 [[package]]
 name = "grin_config"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "dirs",
  "grin_core",
@@ -1117,7 +1120,7 @@ dependencies = [
 
 [[package]]
 name = "grin_core"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "blake2-rfc",
  "byteorder",
@@ -1143,7 +1146,7 @@ dependencies = [
 
 [[package]]
 name = "grin_keychain"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "blake2-rfc",
  "byteorder",
@@ -1164,7 +1167,7 @@ dependencies = [
 
 [[package]]
 name = "grin_p2p"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "bitflags 1.3.2",
  "built",
@@ -1187,7 +1190,7 @@ dependencies = [
 
 [[package]]
 name = "grin_pool"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "blake2-rfc",
  "chrono",
@@ -1219,7 +1222,7 @@ dependencies = [
 
 [[package]]
 name = "grin_servers"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "async-stream",
  "chrono",
@@ -1233,12 +1236,12 @@ dependencies = [
  "grin_pool",
  "grin_store",
  "grin_util",
- "http",
+ "http-body-util",
  "hyper",
  "hyper-rustls",
+ "hyper-util",
  "log",
  "rand 0.6.5",
- "rustls",
  "serde",
  "serde_derive",
  "serde_json",
@@ -1249,7 +1252,7 @@ dependencies = [
 
 [[package]]
 name = "grin_store"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "byteorder",
  "chrono",
@@ -1271,7 +1274,7 @@ dependencies = [
 
 [[package]]
 name = "grin_util"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "anyhow",
  "backtrace",
@@ -1291,15 +1294,15 @@ dependencies = [
 
 [[package]]
 name = "h2"
-version = "0.3.27"
+version = "0.4.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0beca50380b1fc32983fc1cb4587bfa4bb9e78fc259aad4a0032d2080309222d"
+checksum = "6cb093c84e8bd9b188d4c4a8cb6579fc016968d14c99882163cd3ff402a4f155"
 dependencies = [
+ "atomic-waker",
  "bytes 1.12.0",
  "fnv",
  "futures-core",
  "futures-sink",
- "futures-util",
  "http",
  "indexmap",
  "slab",
@@ -1382,23 +1385,34 @@ dependencies = [
 
 [[package]]
 name = "http"
-version = "0.2.12"
+version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "601cbb57e577e2f5ef5be8e7b83f0f63994f25aa94d673e54a92d5c516d101f1"
+checksum = "918d3568bebf352712bc2ef3d46a8bcf1a75b373be6539de198e9105cbbf9ce0"
 dependencies = [
  "bytes 1.12.0",
- "fnv",
  "itoa",
 ]
 
 [[package]]
 name = "http-body"
-version = "0.4.6"
+version = "1.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ca2a8f2913ee65f60facd6a
```

---

### Incident Patch 2: `3c7cf86b` (2026-06-23)
**Commit Message**: Switch TUI to crossterm backend (#3877)

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ grin_store = { path = "./store", version = "5.5.1" }
 [dependencies.cursive]
 version = "0.21"
 default-features = false
-features = ["pancurses-backend"]
+features = ["crossterm-backend"]
 
 [build-dependencies]
 built = { version = "0.8.0", features = ["git2"]}
```

**File**: `config/src/comments.rs` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ fn comments() -> HashMap<String, String> {
 	retval.insert(
 		"run_tui".to_string(),
 		"
-#whether to run the ncurses TUI (Ncurses must be installed)
+#whether to run the terminal TUI
 "
 		.to_string(),
 	);
```

**File**: `src/bin/tui/ui.rs` (modified, +2/-2)
```diff
@@ -72,7 +72,7 @@ impl UI {
 		let (ui_tx, ui_rx) = mpsc::channel::<UIMessage>();
 
 		let mut grin_ui = UI {
-			cursive: cursive::default().into_runner(),
+			cursive: cursive::crossterm().into_runner(),
 			ui_tx,
 			ui_rx,
 			controller_tx,
@@ -269,8 +269,8 @@ impl Controller {
 				return match message {
 					ControllerMessage::Shutdown => {
 						warn!("Shutdown in progress, please wait");
-						self.ui.stop();
 						self.stop_server();
+						self.ui.stop();
 						exit_code
 					}
 				};
```

---

### Incident Patch 3: `1c991fe5` (2026-07-01)
**Commit Message**: Fuzz build fix (#3884)

* build: update dependencies, set global chain type before run

* build: update fuzz pool dependencies

* build: fix warning with unused code

* build: update parking_lot, remove unused byteorder dep from grin_utils

**File**: `Cargo.lock` (modified, +207/-221)
```diff
@@ -118,12 +118,6 @@ dependencies = [
  "syn 2.0.118",
 ]
 
-[[package]]
-name = "atomic-waker"
-version = "1.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
-
 [[package]]
 name = "atty"
 version = "0.2.14"
@@ -374,9 +368,9 @@ checksum = "245097e9a4535ee1e3e3931fcfcd55a796a44c643e8596ff6566d68f09b87bbc"
 
 [[package]]
 name = "core-foundation"
-version = "0.10.1"
+version = "0.9.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b2a6cd9ae233e7f62ba4e9353e81a88df7fc8a5987b8d445b4d90c879bd156f6"
+checksum = "91e195e091a93c46f7102ec7818a2aa394e1e1771c3ab4825963fa03e45afb8f"
 dependencies = [
  "core-foundation-sys",
  "libc",
@@ -449,11 +443,36 @@ version = "0.8.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d0a5c400df2834b80a4c3327b3aad3a4c4cd4de0629063962b03235697506a28"
 
+[[package]]
+name = "crossterm"
+version = "0.28.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "829d955a0bb380ef178a640b91779e3987da38c9aea133b20614cfed8cdea9c6"
+dependencies = [
+ "bitflags 2.13.0",
+ "crossterm_winapi",
+ "mio",
+ "parking_lot",
+ "rustix 0.38.44",
+ "signal-hook",
+ "signal-hook-mio",
+ "winapi",
+]
+
+[[package]]
+name = "crossterm_winapi"
+version = "0.9.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "acdd7c62a3665c7f6830a51635d9ac9b23ed385797f70a83bb8bafe9c572ab2b"
+dependencies = [
+ "winapi",
+]
+
 [[package]]
 name = "crypto-mac"
-version = "0.11.0"
+version = "0.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "25fab6889090c8133f3deb8f73ba3c65a7f456f66436fc012a1b1e272b1e103e"
+checksum = "b1d1a86f49236c215f271d40892d5fc950490551400b02ef360692c29815c714"
 dependencies = [
  "generic-array",
  "subtle",
@@ -489,12 +508,11 @@ dependencies = [
  "ahash",
  "cfg-if 1.0.4",
  "crossbeam-channel",
+ "crossterm",
  "cursive_core",
  "lazy_static",
  "libc",
  "log",
- "maplit",
- "pancurses",
  "signal-hook",
  "unicode-segmentation",
  "unicode-width 0.1.14",
@@ -525,7 +543,7 @@ dependencies = [
  "lazy_static",
  "log",
  "num 0.4.3",
- "parking_lot 0.12.5",
+ "parking_lot",
  "serde_json",
  "unicode-segmentation",
  "unicode-width 0.2.2",
@@ -996,18 +1014,21 @@ dependencies = [
 
 [[package]]
 name = "grin"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
+ "blake2-rfc",
  "built",
  "chrono",
  "clap",
  "ctrlc",
  "cursive",
  "cursive_table_view",
+ "futures 0.3.32",
  "grin_api",
  "grin_chain",
  "grin_config",
  "grin_core",
+ "grin_keychain",
  "grin_p2p",
  "grin_servers",
  "grin_store",
@@ -1019,35 +1040,35 @@ dependencies = [
  "serde_json",
  "term",
  "thiserror 1.0.69",
- "tokio",
 ]
 
 [[package]]
 name = "grin_api"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
+ "async-stream",
  "bytes 1.12.0",
  "easy-jsonrpc-mw",
  "futures 0.3.32",
  "grin_chain",
  "grin_core",
  "grin_p2p",
  "grin_pool",
+ "grin_store",
  "grin_util",
- "http-body-util",
+ "http",
  "hyper",
  "hyper-rustls",
  "hyper-timeout",
- "hyper-util",
  "lazy_static",
  "log",
  "regex",
+ "ring 0.16.20",
  "rustls",
  "rustls-pemfile",
  "serde",
  "serde_derive",
  "serde_json",
- "subtle",
  "thiserror 1.0.69",
  "tokio",
  "tokio-rustls",
@@ -1056,7 +1077,7 @@ dependencies = [
 
 [[package]]
 name = "grin_chain"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "bit-vec",
  "bitflags 1.3.2",
@@ -1080,7 +1101,7 @@ dependencies = [
 
 [[package]]
 name = "grin_config"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "dirs",
  "grin_core",
@@ -1096,7 +1117,7 @@ dependencies = [
 
 [[package]]
 name = "grin_core"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "blake2-rfc",
  "byteorder",
@@ -1122,7 +1143,7 @@ dependencies = [
 
 [[package]]
 name = "grin_keychain"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "blake2-rfc",
  "byteorder",
@@ -1143,7 +1164,7 @@ dependencies = [
 
 [[package]]
 name = "grin_p2p"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "bitflags 1.3.2",
  "built",
@@ -1166,7 +1187,7 @@ dependencies = [
 
 [[package]]
 name = "grin_pool"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "blake2-rfc",
  "chrono",
@@ -1198,7 +1219,7 @@ dependencies = [
 
 [[package]]
 name = "grin_servers"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "async-stream",
  "chrono",
@@ -1212,12 +1233,12 @@ dependencies = [
  "grin_pool",
  "grin_store",
  "grin_util",
- "http-body-util",
+ "http",
  "hyper",
  "hyper-rustls",
- "hyper-util",
  "log",
  "rand 0.6.5",
+ "rustls",
  "serde",
  "serde_derive",
  "serde_json",
@@ -1228,7 +1249,7 @@ dependencies = [
 
 [[package]]
 name = "grin_store"
-version = "5.5.1"
+version = "5.5.1-alpha.0"
 dependencies = [
  "byteorder",
  "chrono",
@@ -1250,17 +1271,16 @@ dep
```

**File**: `core/fuzz/Cargo.lock` (modified, +586/-432)
```diff
@@ -1,60 +1,50 @@
 # This file is automatically @generated by Cargo.
 # It is not intended for manual editing.
-version = 3
+version = 4
 
 [[package]]
 name = "addr2line"
-version = "0.17.0"
+version = "0.25.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b9ecd88a8c8378ca913a680cd98f0f13ac67383d35993f86c90a70e3f137816b"
+checksum = "1b5d307320b3181d6d7954e663bd7c774a838b8220fe0593c86d9fb09f498b4b"
 dependencies = [
  "gimli",
 ]
 
 [[package]]
-name = "adler"
-version = "1.0.2"
+name = "adler2"
+version = "2.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f26201604c87b1e01bd3d98f8d5d9a8fcbb815e8cedb41ffccbeb4bf593a35fe"
+checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
 
 [[package]]
-name = "aho-corasick"
-version = "0.7.18"
+name = "android_system_properties"
+version = "0.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e37cfd5e7657ada45f742d6e99ca5788580b5c529dc78faf11ece6dc702656f"
+checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
 dependencies = [
- "memchr",
+ "libc",
 ]
 
 [[package]]
-name = "ansi_term"
-version = "0.12.1"
+name = "anyhow"
+version = "1.0.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d52a9bb7ec0cf484c551830a7ce27bd20d67eac647e1befb56b0be4ee39a55d2"
-dependencies = [
- "winapi",
-]
+checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "arbitrary"
-version = "1.1.3"
+version = "1.4.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5a7924531f38b1970ff630f03eb20a2fde69db5c590c93b0f3482e95dcc5fd60"
+checksum = "c3d036a3c4ab069c7b410a2ce876bd74808d2d0888a82667669f8e783a898bf1"
 
 [[package]]
 name = "arc-swap"
-version = "0.4.8"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dabe5a181f83789739c194cbe5a897dde195078fac08568d09221fd6137a7ba8"
-
-[[package]]
-name = "arrayvec"
-version = "0.3.25"
+version = "1.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "06f59fe10306bb78facd90d28c2038ad23ffaaefa85bac43c8a434cde383334f"
+checksum = "c049c0be4daef0b145cb3555416b3b8ef5b7888a38aea1a3a155801fe7b0810b"
 dependencies = [
- "nodrop",
- "odds",
+ "rustversion",
 ]
 
 [[package]]
@@ -67,44 +57,39 @@ dependencies = [
 ]
 
 [[package]]
-name = "atty"
-version = "0.2.14"
+name = "arrayvec"
+version = "0.7.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d9b39be18770d11421cdb1b9947a45dd3f37e93092cbf377614828a319d5fee8"
-dependencies = [
- "hermit-abi",
- "libc",
- "winapi",
-]
+checksum = "f02882884d3e1bc524fb12c79f107f6ad0e1cfd498c536ffb494301740995dfe"
 
 [[package]]
 name = "autocfg"
 version = "0.1.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0dde43e75fd43e8a1bf86103336bc699aa8d17ad1be60c76c0bdfd4828e19b78"
 dependencies = [
- "autocfg 1.1.0",
+ "autocfg 1.5.1",
 ]
 
 [[package]]
 name = "autocfg"
-version = "1.1.0"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d468802bab17cbc0cc575e9b053f41e72aa36bfa6b7f55e3529ffa43161b97fa"
+checksum = "f2032f911046de80f0a198e0901378627c33f59ea0ac00e363d481118bd70a53"
 
 [[package]]
 name = "backtrace"
-version = "0.3.65"
+version = "0.3.76"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "11a17d453482a265fd5f8479f2a3f405566e6ca627837aaddb85af8b1ab8ef61"
+checksum = "bb531853791a215d7c62a30daf0dde835f381ab5de4589cfe7c649d2cbe92bd6"
 dependencies = [
  "addr2line",
- "cc",
- "cfg-if 1.0.0",
+ "cfg-if",
  "libc",
  "miniz_oxide",
  "object",
  "rustc-demangle",
+ "windows-link",
 ]
 
 [[package]]
@@ -115,38 +100,21 @@ checksum = "3441f0f7b02788e948e47f457ca01f1d7e6d92c693bc132c22b087d3141c03ff"
 
 [[package]]
 name = "base64ct"
-version = "1.5.1"
+version = "1.8.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3bdca834647821e0b13d9539a8634eb62d3501b6b6c2cec1722786ee6671b851"
+checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
 
 [[package]]
-name = "bindgen"
-version = "0.56.0"
+name = "bitflags"
+version = "1.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2da379dbebc0b76ef63ca68d8fc6e71c0f13e59432e0987e508c1820e6ab5239"
-dependencies = [
- "bitflags",
- "cexpr",
- "clang-sys",
- "clap",
- "env_logger",
- "lazy_static",
- "lazycell",
- "log",
- "peeking_take_while",
- "proc-macro2",
- "quote",
- "regex",
- "rustc-hash",
- "shlex",
- "which",
-]
+checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
 [[package]]
 name = "bitflags"
-version = "1.3.2"
+version = "2.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
+checksum = "b4388bee8683e3d04af747c73422
```

**File**: `core/fuzz/Cargo.toml` (modified, +3/-0)
```diff
@@ -41,3 +41,6 @@ path = "fuzz_targets/compact_block_read_v1.rs"
 [[bin]]
 name = "compact_block_read_v2"
 path = "fuzz_targets/compact_block_read_v2.rs"
+
+[package.metadata]
+cargo-fuzz = true
\ No newline at end of file
```

**File**: `core/fuzz/fuzz_targets/block_read_v1.rs` (modified, +2/-0)
```diff
@@ -4,9 +4,11 @@ use libfuzzer_sys::fuzz_target;
 extern crate grin_core;
 
 use grin_core::core::UntrustedBlock;
+use grin_core::global;
 use grin_core::ser::{self, DeserializationMode};
 
 fuzz_target!(|data: &[u8]| {
+	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
 	let mut d = data.clone();
 	let _t: Result<UntrustedBlock, ser::Error> =
 		ser::deserialize(&mut d, ser::ProtocolVersion(1), DeserializationMode::Full);
```

**File**: `core/fuzz/fuzz_targets/block_read_v2.rs` (modified, +2/-0)
```diff
@@ -4,9 +4,11 @@ use libfuzzer_sys::fuzz_target;
 extern crate grin_core;
 
 use grin_core::core::UntrustedBlock;
+use grin_core::global;
 use grin_core::ser::{self, DeserializationMode};
 
 fuzz_target!(|data: &[u8]| {
+	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
 	let mut d = data.clone();
 	let _t: Result<UntrustedBlock, ser::Error> =
 		ser::deserialize(&mut d, ser::ProtocolVersion(2), DeserializationMode::Full);
```

**File**: `core/fuzz/fuzz_targets/compact_block_read_v1.rs` (modified, +2/-0)
```diff
@@ -4,9 +4,11 @@ use libfuzzer_sys::fuzz_target;
 extern crate grin_core;
 
 use grin_core::core::UntrustedCompactBlock;
+use grin_core::global;
 use grin_core::ser::{self, DeserializationMode};
 
 fuzz_target!(|data: &[u8]| {
+	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
 	let mut d = data.clone();
 	let _t: Result<UntrustedCompactBlock, ser::Error> =
 		ser::deserialize(&mut d, ser::ProtocolVersion(1), DeserializationMode::Full);
```

**File**: `core/fuzz/fuzz_targets/compact_block_read_v2.rs` (modified, +2/-0)
```diff
@@ -4,9 +4,11 @@ use libfuzzer_sys::fuzz_target;
 extern crate grin_core;
 
 use grin_core::core::UntrustedCompactBlock;
+use grin_core::global;
 use grin_core::ser::{self, DeserializationMode};
 
 fuzz_target!(|data: &[u8]| {
+	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
 	let mut d = data.clone();
 	let _t: Result<UntrustedCompactBlock, ser::Error> =
 		ser::deserialize(&mut d, ser::ProtocolVersion(2), DeserializationMode::Full);
```

**File**: `core/fuzz/fuzz_targets/transaction_read_v1.rs` (modified, +2/-0)
```diff
@@ -4,9 +4,11 @@ use libfuzzer_sys::fuzz_target;
 extern crate grin_core;
 
 use grin_core::core::Transaction;
+use grin_core::global;
 use grin_core::ser::{self, DeserializationMode};
 
 fuzz_target!(|data: &[u8]| {
+	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
 	let mut d = data.clone();
 	let _t: Result<Transaction, ser::Error> =
 		ser::deserialize(&mut d, ser::ProtocolVersion(1), DeserializationMode::Full);
```

---

### Incident Patch 4: `b8d0dcc8` (2026-08-08)
**Commit Message**: build: update version to 5.5.1

**File**: `Cargo.lock` (modified, +11/-11)
```diff
@@ -996,7 +996,7 @@ dependencies = [
 
 [[package]]
 name = "grin"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "built",
  "chrono",
@@ -1024,7 +1024,7 @@ dependencies = [
 
 [[package]]
 name = "grin_api"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "bytes 1.12.0",
  "easy-jsonrpc-mw",
@@ -1056,7 +1056,7 @@ dependencies = [
 
 [[package]]
 name = "grin_chain"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "bit-vec",
  "bitflags 1.3.2",
@@ -1080,7 +1080,7 @@ dependencies = [
 
 [[package]]
 name = "grin_config"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "dirs",
  "grin_core",
@@ -1096,7 +1096,7 @@ dependencies = [
 
 [[package]]
 name = "grin_core"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "blake2-rfc",
  "byteorder",
@@ -1122,7 +1122,7 @@ dependencies = [
 
 [[package]]
 name = "grin_keychain"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "blake2-rfc",
  "byteorder",
@@ -1143,7 +1143,7 @@ dependencies = [
 
 [[package]]
 name = "grin_p2p"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "bitflags 1.3.2",
  "built",
@@ -1166,7 +1166,7 @@ dependencies = [
 
 [[package]]
 name = "grin_pool"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "blake2-rfc",
  "chrono",
@@ -1198,7 +1198,7 @@ dependencies = [
 
 [[package]]
 name = "grin_servers"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "async-stream",
  "chrono",
@@ -1228,7 +1228,7 @@ dependencies = [
 
 [[package]]
 name = "grin_store"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "byteorder",
  "chrono",
@@ -1250,7 +1250,7 @@ dependencies = [
 
 [[package]]
 name = "grin_util"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 dependencies = [
  "anyhow",
  "backtrace",
```

**File**: `Cargo.toml` (modified, +11/-11)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "Simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -33,14 +33,14 @@ log = "0.4"
 term = "0.6"
 tokio = { version = "1", features = ["sync"] }
 
-grin_api = { path = "./api", version = "5.5.1-alpha.0" }
-grin_config = { path = "./config", version = "5.5.1-alpha.0" }
-grin_chain = { path = "./chain", version = "5.5.1-alpha.0" }
-grin_core = { path = "./core", version = "5.5.1-alpha.0" }
-grin_p2p = { path = "./p2p", version = "5.5.1-alpha.0" }
-grin_servers = { path = "./servers", version = "5.5.1-alpha.0" }
-grin_util = { path = "./util", version = "5.5.1-alpha.0" }
-grin_store = { path = "./store", version = "5.5.1-alpha.0" }
+grin_api = { path = "./api", version = "5.5.1" }
+grin_config = { path = "./config", version = "5.5.1" }
+grin_chain = { path = "./chain", version = "5.5.1" }
+grin_core = { path = "./core", version = "5.5.1" }
+grin_p2p = { path = "./p2p", version = "5.5.1" }
+grin_servers = { path = "./servers", version = "5.5.1" }
+grin_util = { path = "./util", version = "5.5.1" }
+grin_store = { path = "./store", version = "5.5.1" }
 
 [dependencies.cursive]
 version = "0.21"
@@ -51,5 +51,5 @@ features = ["pancurses-backend"]
 built = { version = "0.8.0", features = ["git2"]}
 
 [dev-dependencies]
-grin_chain = { path = "./chain", version = "5.5.1-alpha.0" }
-grin_store = { path = "./store", version = "5.5.1-alpha.0" }
+grin_chain = { path = "./chain", version = "5.5.1" }
+grin_store = { path = "./store", version = "5.5.1" }
```

**File**: `api/Cargo.toml` (modified, +6/-6)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin_api"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "APIs for grin, a simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -31,8 +31,8 @@ hyper-util = { version = "0.1.20", features = ["client-legacy", "server-graceful
 http-body-util = "0.1.3"
 subtle = "2.6.1"
 
-grin_core = { path = "../core", version = "5.5.1-alpha.0" }
-grin_chain = { path = "../chain", version = "5.5.1-alpha.0" }
-grin_p2p = { path = "../p2p", version = "5.5.1-alpha.0" }
-grin_pool = { path = "../pool", version = "5.5.1-alpha.0" }
-grin_util = { path = "../util", version = "5.5.1-alpha.0" }
+grin_core = { path = "../core", version = "5.5.1" }
+grin_chain = { path = "../chain", version = "5.5.1" }
+grin_p2p = { path = "../p2p", version = "5.5.1" }
+grin_pool = { path = "../pool", version = "5.5.1" }
+grin_util = { path = "../util", version = "5.5.1" }
```

**File**: `chain/Cargo.toml` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin_chain"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "Chain implementation for grin, a simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -22,10 +22,10 @@ chrono = "0.4.11"
 lru-cache = "0.1"
 lazy_static = "1"
 
-grin_core = { path = "../core", version = "5.5.1-alpha.0" }
-grin_keychain = { path = "../keychain", version = "5.5.1-alpha.0" }
-grin_store = { path = "../store", version = "5.5.1-alpha.0" }
-grin_util = { path = "../util", version = "5.5.1-alpha.0" }
+grin_core = { path = "../core", version = "5.5.1" }
+grin_keychain = { path = "../keychain", version = "5.5.1" }
+grin_store = { path = "../store", version = "5.5.1" }
+grin_util = { path = "../util", version = "5.5.1" }
 
 [dev-dependencies]
 env_logger = "0.7"
```

**File**: `config/Cargo.toml` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin_config"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "Configuration for grin, a simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -15,10 +15,10 @@ serde_derive = "1"
 toml = "0.5"
 dirs = "2.0"
 
-grin_core = { path = "../core", version = "5.5.1-alpha.0" }
-grin_servers = { path = "../servers", version = "5.5.1-alpha.0" }
-grin_p2p = { path = "../p2p", version = "5.5.1-alpha.0" }
-grin_util = { path = "../util", version = "5.5.1-alpha.0" }
+grin_core = { path = "../core", version = "5.5.1" }
+grin_servers = { path = "../servers", version = "5.5.1" }
+grin_p2p = { path = "../p2p", version = "5.5.1" }
+grin_util = { path = "../util", version = "5.5.1" }
 
 [dev-dependencies]
 pretty_assertions = "0.6.1"
```

**File**: `core/Cargo.toml` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin_core"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "Chain implementation for grin, a simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -27,8 +27,8 @@ chrono = { version = "0.4.11", features = ["serde"] }
 zeroize = { version = "1.1", features =["zeroize_derive"] }
 bytes = "0.5"
 
-keychain = { package = "grin_keychain", path = "../keychain", version = "5.5.1-alpha.0" }
-util = { package = "grin_util", path = "../util", version = "5.5.1-alpha.0" }
+keychain = { package = "grin_keychain", path = "../keychain", version = "5.5.1" }
+util = { package = "grin_util", path = "../util", version = "5.5.1" }
 
 [dev-dependencies]
 serde_json = "1"
```

**File**: `keychain/Cargo.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin_keychain"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "Chain implementation for grin, a simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -25,4 +25,4 @@ ripemd160 = "0.9"
 sha2 = "0.9"
 pbkdf2 = "0.8"
 
-grin_util = { path = "../util", version = "5.5.1-alpha.0" }
+grin_util = { path = "../util", version = "5.5.1" }
```

**File**: `p2p/Cargo.toml` (modified, +6/-6)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grin_p2p"
-version = "5.5.1-alpha.0"
+version = "5.5.1"
 authors = ["Grin Developers <mimblewimble@lists.launchpad.net>"]
 description = "Chain implementation for grin, a simple, private and scalable cryptocurrency implementation based on the Mimblewimble chain format."
 license = "Apache-2.0"
@@ -22,13 +22,13 @@ log = "0.4"
 chrono = { version = "0.4.11", features = ["serde"] }
 bytes = "0.5"
 
-grin_core = { path = "../core", version = "5.5.1-alpha.0" }
-grin_store = { path = "../store", version = "5.5.1-alpha.0" }
-grin_util = { path = "../util", version = "5.5.1-alpha.0" }
-grin_chain = { path = "../chain", version = "5.5.1-alpha.0" }
+grin_core = { path = "../core", version = "5.5.1" }
+grin_store = { path = "../store", version = "5.5.1" }
+grin_util = { path = "../util", version = "5.5.1" }
+grin_chain = { path = "../chain", version = "5.5.1" }
 
 [dev-dependencies]
-grin_pool = { path = "../pool", version = "5.5.1-alpha.0" }
+grin_pool = { path = "../pool", version = "5.5.1" }
 
 [build-dependencies]
 built = { version = "0.8.0", features = ["git2"]}
```

---

### Incident Patch 5: `6b150aa8` (2026-07-07)
**Commit Message**: Fix tests using rustls (#3885)

* fix: init default rustls provider

* fix: do not crash on provider install

**File**: `api/src/router.rs` (modified, +1/-0)
```diff
@@ -347,6 +347,7 @@ mod tests {
 
 	#[test]
 	fn test_get() {
+		let _ = rustls::crypto::ring::default_provider().install_default();
 		util::init_test_logger();
 		let mut routes = Router::new();
 		routes
```

**File**: `api/tests/rest.rs` (modified, +2/-0)
```diff
@@ -87,6 +87,7 @@ fn open_port(host: &str) -> u16 {
 
 #[test]
 fn test_start_api() {
+	let _ = rustls::crypto::ring::default_provider().install_default();
 	util::init_test_logger();
 	let mut server = ApiServer::new();
 	let mut router = build_router();
@@ -132,6 +133,7 @@ fn test_start_api_address_in_use() {
 #[ignore]
 #[test]
 fn test_start_api_tls() {
+	let _ = rustls::crypto::ring::default_provider().install_default();
 	util::init_test_logger();
 	let tls_conf = TLSConfig::new(
 		"tests/fullchain.pem".to_string(),
```

---

### Incident Patch 6: `7a0c592a` (2026-07-24)
**Commit Message**: REST address bind fix (#3917)

* rest: check if address is free before server start

* rest: convert std listener to tokio, check after existing service

* rest: move listener conversion in tokio context

* rest: make listener non blocking

* rest: set shutdown sender after successful api server creation

* rest: set shutdown sender if thread not failed

* rest: fix error check on start

* add address in use test

---------

Co-authored-by: wiesche <[REDACTED_EMAIL]>

**File**: `api/src/rest.rs` (modified, +99/-132)
```diff
@@ -20,7 +20,6 @@
 
 use crate::router::{Handler, HandlerObj, ResponseFuture, Router, RouterError};
 use crate::web::response;
-use futures::channel::oneshot;
 use hyper::body::Incoming;
 use hyper::server::conn::http1;
 use hyper::{Request, StatusCode};
@@ -34,6 +33,7 @@ use std::sync::Arc;
 use std::{io, thread};
 use tokio::net::TcpListener;
 use tokio::runtime::Runtime;
+use tokio::sync::mpsc;
 use tokio::time::{sleep, timeout, Duration};
 use tokio_rustls::TlsAcceptor;
 
@@ -123,7 +123,7 @@ impl TLSConfig {
 
 /// HTTP server allowing the registration of ApiEndpoint implementations.
 pub struct ApiServer {
-	shutdown_sender: Option<oneshot::Sender<()>>,
+	shutdown_sender: Option<mpsc::Sender<()>>,
 }
 
 impl ApiServer {
@@ -141,78 +141,45 @@ impl ApiServer {
 		addr: SocketAddr,
 		router: Router,
 		conf: Option<TLSConfig>,
-		api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
-	) -> Result<thread::JoinHandle<()>, Error> {
-		let _ = rustls::crypto::ring::default_provider().install_default();
-		match conf {
-			Some(conf) => self.start_tls(addr, router, conf, api_chan),
-			None => self.start_no_tls(addr, router, api_chan),
-		}
-	}
-
-	/// Starts the ApiServer at the provided address.
-	fn start_no_tls(
-		&mut self,
-		addr: SocketAddr,
-		router: Router,
-		api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
+		api_chan: (mpsc::Sender<()>, mpsc::Receiver<()>),
 	) -> Result<thread::JoinHandle<()>, Error> {
 		if self.shutdown_sender.is_some() {
 			return Err(Error::Internal(
-				"Can't start HTTP API server, it's running already".to_string(),
+				"Can't start API server, it's running already".to_string(),
 			));
 		}
-		let rx = &mut api_chan.1;
-		let tx = &mut api_chan.0;
-
-		// Jones's trick to update memory
-		let m = oneshot::channel::<()>();
-		let tx = std::mem::replace(tx, m.0);
-		self.shutdown_sender = Some(tx);
-
-		thread::Builder::new()
-			.name("apis".to_string())
-			.spawn(move || start_server(addr, router, rx, None))
-			.map_err(|_| Error::Internal("failed to spawn API thread".to_string()))
-	}
 
-	/// Starts the TLS ApiServer at the provided address.
-	fn start_tls(
-		&mut self,
-		addr: SocketAddr,
-		router: Router,
-		conf: TLSConfig,
-		api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
-	) -> Result<thread::JoinHandle<()>, Error> {
-		if self.shutdown_sender.is_some() {
-			return Err(Error::Internal(
-				"Can't start HTTPS API server, it's running already".to_string(),
-			));
-		}
-
-		let rx = &mut api_chan.1;
-		let tx = &mut api_chan.0;
-
-		// Jones's trick to update memory
-		let m = oneshot::channel::<()>();
-		let tx = std::mem::replace(tx, m.0);
-		self.shutdown_sender = Some(tx);
+		let _ = rustls::crypto::ring::default_provider().install_default();
 
-		let tls_acceptor = TlsAcceptor::from(conf.build_server_config()?);
+		// Check if provided address is free.
+		let listener = match std::net::TcpListener::bind(addr) {
+			Ok(l) => {
+				l.set_nonblocking(true)
+					.map_err(|e| Error::Internal(format!("API listener binding error: {}", e)))?;
+				l
+			}
+			Err(e) => {
+				error!("API listener binding error: {}", e);
+				return Err(Error::Internal(e.to_string()));
+			}
+		};
 
-		thread::Builder::new()
+		let tls = match conf {
+			Some(conf) => Some(TlsAcceptor::from(conf.build_server_config()?)),
+			None => None,
+		};
+		let res = thread::Builder::new()
 			.name("apis".to_string())
-			.spawn(move || start_server(addr, router, rx, Some(tls_acceptor)))
-			.map_err(|_| Error::Internal("failed to spawn API thread".to_string()))
+			.spawn(move || start_server(listener, router, api_chan.1, tls))
+			.map_err(|_| Error::Internal("failed to spawn API thread".to_string()))?;
+		self.shutdown_sender = Some(api_chan.0);
+		Ok(res)
 	}
 
 	/// Stops the API server.
 	pub fn stop(&mut self) -> bool {
-		if self.shutdown_sender.is_some() {
-			let tx = self.shutdown_sender.as_mut().unwrap();
-			let m = oneshot::channel::<()>();
-			let tx = std::mem::replace(tx, m.0);
-			match tx.send(()) {
+		if let Some(tx) = self.shutdown_sender.take() {
+			match tx.try_send(()) {
 				Ok(_) => {
 					info!("API server has been stopped");
 					true
@@ -223,95 +190,95 @@ impl ApiServer {
 				}
 			}
 		} else {
-			error!("Can't stop API server, it's not running or doesn't support stop operation");
+			error!("Can't stop API server, it's not running or already stopped");
 			false
 		}
 	}
 }
 
 /// Start API server with optional TLS support.
 fn start_server(
-	addr: SocketAddr,
+	l: std::net::TcpListener,
 	router: Router,
-	rx: &mut oneshot::Receiver<()>,
+	rx: mpsc::Receiver<()>,
 	tls: Option<TlsAcceptor>,
 ) {
 	let server = async move {
 		let graceful = hyper_util::server::graceful::GracefulShutdown::new();
 		// When this signal completes, start shutdown.
 		let mut signal = std::pin::pin!(shutdown_signal(rx));
 
-		// Start server loop.
-		match TcpListener::bind(addr).await {
-			Ok(l) => {
-				loop
```

**File**: `api/tests/rest.rs` (modified, +18/-0)
```diff
@@ -107,6 +107,24 @@ fn test_start_api() {
 	thread::sleep(time::Duration::from_millis(1_000));
 }
 
+#[test]
+fn test_start_api_address_in_use() {
+	let listener = TcpListener::bind("127.0.0.1:0").unwrap();
+	let addr = listener.local_addr().unwrap();
+	let mut server = ApiServer::new();
+
+	assert!(server
+		.start(addr, build_router(), None, mpsc::channel::<()>(1))
+		.is_err());
+
+	drop(listener);
+	let handle = server
+		.start(addr, build_router(), None, mpsc::channel::<()>(1))
+		.unwrap();
+	assert!(server.stop());
+	handle.join().unwrap();
+}
+
 // To enable this test you need a trusted PKCS12 (p12) certificate bundle
 // Hyper-tls client doesn't accept self-signed certificates. The easiest way is to use mkcert
 // https://github.com/FiloSottile/mkcert to install CA and generate a certificate on your local machine.
```

---

### Incident Patch 7: `d2305401` (2026-06-20)
**Commit Message**: build: do not user workspace for submodules to allow usage of them at external workspace (#3851)

**File**: `api/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "APIs for grin, a simple, private and scalable cryptocurrency impl
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = ".."
 edition = "2021"
 
 [dependencies]
```

**File**: `chain/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Chain implementation for grin, a simple, private and scalable cry
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = ".."
 edition = "2021"
 
 [dependencies]
```

**File**: `config/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Configuration for grin, a simple, private and scalable cryptocurr
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = ".."
 edition = "2021"
 
 [dependencies]
```

**File**: `core/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Chain implementation for grin, a simple, private and scalable cry
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = ".."
 edition = "2021"
 
 [dependencies]
```

**File**: `keychain/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Chain implementation for grin, a simple, private and scalable cry
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = '..'
 edition = "2021"
 
 [dependencies]
```

**File**: `p2p/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Chain implementation for grin, a simple, private and scalable cry
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = ".."
 edition = "2021"
 build = "src/build/build.rs"
 
```

**File**: `pool/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Chain implementation for grin, a simple, private and scalable cry
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = '..'
 edition = "2021"
 
 [dependencies]
```

**File**: `servers/Cargo.toml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ description = "Simple, private and scalable cryptocurrency implementation based
 license = "Apache-2.0"
 repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
-workspace = ".."
 edition = "2021"
 
 [dependencies]
```

---

### Incident Patch 8: `cc0b5895` (2026-06-16)
**Commit Message**: Fix TUI server startup shutdown handling (#3868)

* Fix TUI server startup shutdown handling

* small defensive cleanup to eliminate unwraps on ui_tx.send

**File**: `servers/src/grin/server.rs` (modified, +2/-3)
```diff
@@ -79,9 +79,8 @@ pub struct Server {
 }
 
 impl Server {
-	/// Instantiates and starts a new server. Optionally takes a callback
-	/// for the server to send an ARC copy of itself, to allow another process
-	/// to poll info about the server status
+	/// Instantiates and starts a new server, optionally sending initialization
+	/// status updates through the provided channel.
 	pub fn start(
 		config: ServerConfig,
 		stop_state: Option<Arc<StopState>>,
```

**File**: `src/bin/cmd/server.rs` (modified, +5/-1)
```diff
@@ -50,7 +50,7 @@ pub fn start_server(
 		let serv_tx_clone = serv_tx.clone();
 		let stop_state = Arc::new(StopState::new());
 		let stop_state_clone = stop_state.clone();
-		thread::spawn(move || {
+		let server_thread = thread::spawn(move || {
 			match Server::start(
 				config,
 				Some(stop_state_clone.clone()),
@@ -71,6 +71,10 @@ pub fn start_server(
 		});
 		let exit_code = controller.run();
 		stop_state.stop();
+		if let Err(e) = server_thread.join() {
+			error!("Failed to join server startup thread: {:?}", e);
+		}
+		controller.stop_server();
 		exit_code
 	} else {
 		warn!("Starting GRIN w/o UI...");
```

**File**: `src/bin/tui/ui.rs` (modified, +25/-8)
```diff
@@ -209,7 +209,7 @@ impl Controller {
 	/// Server initialization status.
 	pub fn init_status(&mut self, text: &str, pop: bool) {
 		if pop {
-			self.ui.cursive.pop_layer();
+			self.pop_dialog();
 		}
 		let content = StyledString::styled(text, Color::Light(BaseColor::Green));
 		self.ui
@@ -220,6 +220,7 @@ impl Controller {
 
 	/// Server initialization error.
 	pub fn init_error(&mut self, e: Error) {
+		self.pop_dialog();
 		let content = StyledString::styled(format!("{:?}", e), Color::Light(BaseColor::Red));
 		self.ui.cursive.add_layer(
 			CircularFocus::new(Dialog::around(TextView::new(content)).button("Exit", |s| {
@@ -230,10 +231,28 @@ impl Controller {
 		self.ui.show_dialog.store(true, Ordering::Relaxed);
 	}
 
+	fn pop_dialog(&mut self) {
+		if self.ui.show_dialog.swap(false, Ordering::Relaxed) {
+			self.ui.cursive.pop_layer();
+		}
+	}
+
+	/// Stop a fully initialized server, including one queued by the startup thread.
+	pub fn stop_server(&mut self) {
+		if let Some(s) = self.server.take() {
+			s.stop();
+		}
+		while let Ok(message) = self.serv_rx.try_recv() {
+			if let ServerInitStatus::FinishedLoading(s) = message {
+				s.stop();
+			}
+		}
+	}
+
 	/// Server UI after initialization.
 	pub fn server(&mut self, server: &Server) {
 		if let Ok(stats) = server.get_server_stats() {
-			self.ui.ui_tx.send(UIMessage::UpdateStatus(stats)).unwrap();
+			let _ = self.ui.ui_tx.send(UIMessage::UpdateStatus(stats));
 		}
 	}
 
@@ -251,9 +270,7 @@ impl Controller {
 					ControllerMessage::Shutdown => {
 						warn!("Shutdown in progress, please wait");
 						self.ui.stop();
-						if let Some(s) = self.server.take() {
-							s.stop();
-						}
+						self.stop_server();
 						exit_code
 					}
 				};
@@ -265,8 +282,7 @@ impl Controller {
 					ServerInitStatus::StartSync => self.init_status("Start syncing...", true),
 					ServerInitStatus::StartAPI => self.init_status("Starting API...", true),
 					ServerInitStatus::FinishedLoading(s) => {
-						self.ui.cursive.pop_layer();
-						self.ui.show_dialog.store(false, Ordering::Relaxed);
+						self.pop_dialog();
 						self.server = Some(s)
 					}
 					ServerInitStatus::ErrorLoading(e) => {
@@ -284,12 +300,13 @@ impl Controller {
 				next_stat_update = Utc::now().timestamp() + stat_update_interval;
 				if let Some(server) = &self.server {
 					if let Ok(stats) = server.get_server_stats() {
-						self.ui.ui_tx.send(UIMessage::UpdateStatus(stats)).unwrap();
+						let _ = self.ui.ui_tx.send(UIMessage::UpdateStatus(stats));
 					}
 				}
 			}
 			thread::sleep(delay);
 		}
+		self.stop_server();
 		exit_code
 	}
 }
```

---

### Incident Patch 9: `3882bb97` (2026-06-13)
**Commit Message**: LMDB resize fixes (#3860)

* lmdb: do not resize on env creation, resize only target db on migration

* lmdb: optimize txs counting to resize

* fix: give a name to enter tx var

* lmdb: waiting for resize at separate thread to avoid lock at batch when there are opened txs at same lifetime

* track nested txs per thread

* fix mac test

---------

Co-authored-by: Joerg <[REDACTED_EMAIL]>

**File**: `store/src/lmdb.rs` (modified, +157/-159)
```diff
@@ -16,8 +16,11 @@
 
 use heed::types::Bytes;
 use heed::{Database, Env, EnvOpenOptions, RoTxn, RwTxn, WithoutTls};
+use std::cell::RefCell;
 use std::collections::HashMap;
+use std::marker::PhantomData;
 use std::path::Path;
+use std::rc::Rc;
 use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
 use std::sync::{mpsc, Arc, OnceLock};
 use std::time::Duration;
@@ -95,6 +98,10 @@ pub const PREFIX_KEY_SEPARATOR: u8 = b':';
 /// Mapping of database path to environment state.
 static ENV_MAP: OnceLock<RwLock<HashMap<String, EnvState>>> = OnceLock::new();
 
+thread_local! {
+	static THREAD_TX_COUNTS: RefCell<HashMap<String, u32>> = RefCell::new(HashMap::new());
+}
+
 /// State of active database environment.
 struct EnvState {
 	env: Env<WithoutTls>,
@@ -189,18 +196,12 @@ impl Store {
 		if !has_env {
 			let env = unsafe {
 				let mut options = EnvOpenOptions::new().read_txn_without_tls();
-				let mut env_options = options.map_size(alloc_chunk_size).max_dbs(24);
+				let mut env_options = options.max_dbs(24);
 				if let Some(max_readers) = max_readers {
 					env_options = env_options.max_readers(max_readers);
 				}
 				env_options.open(&full_path)?
 			};
-			let (resize, new_size) = needs_resize(&env, alloc_chunk_size);
-			if resize {
-				unsafe {
-					env.resize(new_size)?;
-				};
-			}
 			debug!("DB Mapsize is {}", env.info().map_size);
 			let mut w_env_map = env_map.write();
 			w_env_map.insert(
@@ -328,15 +329,20 @@ impl Store {
 
 		let from_env = unsafe {
 			let mut options = EnvOpenOptions::new().read_txn_without_tls();
-			let env_options = options.map_size(self.alloc_chunk_size).max_dbs(24);
+			let env_options = options.max_dbs(24);
 			env_options.open(from_path)?
 		};
-		let (resize, new_size) = needs_resize(&from_env, self.alloc_chunk_size);
-		if resize {
-			// We are sure there are no active txs, cause migration is called on database creation.
+		let from_used = env_size(&from_env);
+		let to_used = env_size(&self.env);
+		let to_map_size = self.env.info().map_size;
+
+		// Leave headroom so the migrated env is not immediately above the resize threshold.
+		let required = ((to_used + from_used) as f32 / RESIZE_MIN_TARGET_PERCENT) as usize;
+		let required = round_size_to_chunk(required, self.alloc_chunk_size);
+
+		if required > to_map_size {
 			unsafe {
-				from_env.resize(new_size)?;
-				self.env.resize(new_size)?;
+				self.env.resize(required)?;
 			}
 		}
 		let db_from = {
@@ -396,122 +402,104 @@ impl Store {
 			.load(Ordering::Relaxed)
 	}
 
-	/// Check if requirement for environment resize is checking.
-	fn resize_checking(&self) -> bool {
+	/// Try to acquire the resize check guard.
+	fn start_resize_checking(&self) -> bool {
 		ENV_MAP
 			.get()
 			.unwrap()
 			.read()
 			.get(&self.env_path)
 			.unwrap()
 			.resize_checking
-			.load(Ordering::Relaxed)
+			.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
+			.is_ok()
 	}
 
-	/// Set flag if requirement for environment resize is checking.
-	fn set_resize_checking(&self, resize_checking: bool) {
+	/// Release the resize check guard.
+	fn finish_resize_checking(&self) {
 		ENV_MAP
 			.get()
 			.unwrap()
-			.write()
-			.get_mut(&self.env_path)
+			.read()
+			.get(&self.env_path)
 			.unwrap()
 			.resize_checking
-			.store(resize_checking, Ordering::Relaxed);
+			.store(false, Ordering::Release);
 	}
 
-	/// Wait while database is resizing.
-	fn wait_for_resize(&self) {
-		loop {
-			if ENV_MAP
-				.get()
-				.unwrap()
-				.read()
-				.get(&self.env_path)
-				.unwrap()
-				.resizing
-				.load(Ordering::Relaxed)
-				&& self.open_txs_count() == 0
-			{
-				debug!("Wait on resizing DB {}", self.env_path);
-				thread::sleep(Duration::from_millis(100));
-				continue;
-			}
-			break;
-		}
+	/// Set flag if environment is waiting for resize.
+	fn set_resizing(&self, resizing: bool) {
+		ENV_MAP
+			.get()
+			.unwrap()
+			.read()
+			.get(&self.env_path)
+			.unwrap()
+			.resizing
+			.store(resizing, Ordering::Release);
 	}
 
 	/// Resize database environment if needed.
 	fn maybe_resize(&self) {
-		self.wait_for_resize();
-
-		// Check only one resize requirement per time to avoid multiple resizes.
-		if self.resize_checking() {
+		if !self.start_resize_checking() {
 			return;
-		} else {
-			self.set_resize_checking(true);
 		}
 
 		let (resize, new_size) = needs_resize(&self.env, self.alloc_chunk_size);
-		if resize {
-			let env_path = self.env_path.clone();
-			let env = self.env.clone();
-
-			{
-				let mut w_env_map = ENV_MAP.get().unwrap().write();
-				let env_state = w_env_map.get_mut(&env_path).unwrap();
-				env_state.resizing.store(true, Ordering::Relaxed);
-			}
-
-			// Resize immediately or at another thread to not interrupt current
-			// transaction waiting all open transactions to be closed.
-			if self.open_txs_count() != 0 {
-				debug!("Waiting txs to be closed before DB {} resize", env_path);
-				thread::spawn(move || {
-					loop {
-						let txs_co
```

**File**: `store/tests/lmdb.rs` (modified, +58/-0)
```diff
@@ -27,6 +27,9 @@ use heed::types::Bytes;
 use heed::{Database, Env, EnvOpenOptions, WithoutTls};
 use std::fs;
 use std::path::Path;
+use std::sync::{mpsc, Arc};
+use std::thread;
+use std::time::Duration;
 
 const WRITE_CHUNK_SIZE: usize = 20;
 const TEST_ALLOC_SIZE: usize = store::lmdb::ALLOC_CHUNK_SIZE_DEFAULT / 8 / WRITE_CHUNK_SIZE;
@@ -309,3 +312,58 @@ fn test_migration() -> Result<(), store::Error> {
 	clean_output_dir(test_dir);
 	Ok(())
 }
+
+#[test]
+fn resize_batch_waits_for_open_read_iterator() -> Result<(), store::Error> {
+	let test_dir = "target/open_read_iterator_resize";
+	global::set_local_chain_type(global::ChainTypes::AutomatedTesting);
+	util::init_test_logger();
+	clean_output_dir(test_dir);
+
+	let prefix = b'P';
+	let store = Arc::new(Store::new(
+		test_dir,
+		Some("test1"),
+		None,
+		vec![prefix],
+		None,
+		None,
+	)?);
+	let value = vec![1u8; 32 * 1024];
+	let mut saw_waiting_resize = false;
+
+	for i in 0..80u32 {
+		let mut batch = store.batch()?;
+		batch.put(Some(prefix), &i.to_be_bytes(), &value)?;
+		batch.commit()?;
+
+		let held_iter = store.iter(Some(prefix), |_, v| Ok(v.to_vec()))?;
+		let (tx, rx) = mpsc::channel();
+		let writer_store = store.clone();
+		let writer = thread::spawn(move || {
+			let res = writer_store.batch().map(|_| ());
+			tx.send(res).unwrap();
+		});
+
+		match rx.recv_timeout(Duration::from_millis(100)) {
+			Ok(writer_res) => writer_res?,
+			Err(mpsc::RecvTimeoutError::Timeout) => {
+				saw_waiting_resize = true;
+				drop(held_iter);
+				let writer_res = rx
+					.recv_timeout(Duration::from_secs(2))
+					.expect("batch did not continue after the read iterator was closed");
+				writer_res?;
+				writer.join().unwrap();
+				continue;
+			}
+			Err(e) => panic!("batch thread disconnected: {:?}", e),
+		}
+		drop(held_iter);
+		writer.join().unwrap();
+	}
+
+	assert!(saw_waiting_resize);
+	clean_output_dir(test_dir);
+	Ok(())
+}
```

---

### Incident Patch 10: `c1455296` (2026-06-01)
**Commit Message**: tui: show server initialization status and error (#3836)

* tui: show server initialization status and error

* fix: compilation issues

* fix: add documenting to status, remove unused imports

* fix: do not empty server value

* fix: server ref

* tui: do not quit on q when another dialog is showing (progress or error)

* fix: server stop on tui shutdown

* fix: stop server if tui was stopped after start

* server: panic on error at non-tui mode like before with unwrap

* fix: pop dialog

* fix: do not return result on tx after server start

* tui: close current dialog before quit

* tui: pass stop state to server creation after tui quit

* tui: exit code 1 after error, also for non-tui

* tui: better exit code

**File**: `servers/src/common/types.rs` (modified, +15/-1)
```diff
@@ -19,7 +19,6 @@ use std::sync::Arc;
 use chrono::prelude::Utc;
 use rand::prelude::*;
 
-use crate::api;
 use crate::chain;
 use crate::core::global::{ChainTypes, DEFAULT_FUTURE_TIME_LIMIT};
 use crate::core::{core, libtx, pow};
@@ -28,6 +27,7 @@ use crate::p2p;
 use crate::pool;
 use crate::pool::types::DandelionConfig;
 use crate::store;
+use crate::{api, Server};
 
 /// Error type wrapping underlying module errors.
 #[derive(Debug)]
@@ -405,3 +405,17 @@ impl DandelionEpoch {
 		self.relay_peer.clone()
 	}
 }
+
+/// Server initialization status.
+pub enum ServerInitStatus {
+	/// Database loading.
+	LoadDatabase,
+	/// P2P server initialization.
+	StartSync,
+	/// API server initialization.
+	StartAPI,
+	/// Server instance after successful initialization.
+	FinishedLoading(Server),
+	/// Error on initialization.
+	ErrorLoading(Error),
+}
```

**File**: `servers/src/grin/server.rs` (modified, +19/-12)
```diff
@@ -39,7 +39,7 @@ use crate::common::hooks::{init_chain_hooks, init_net_hooks};
 use crate::common::stats::{
 	ChainStats, DiffBlock, DiffStats, PeerStats, ServerStateInfo, ServerStats, TxStats,
 };
-use crate::common::types::{Error, ServerConfig, StratumServerConfig};
+use crate::common::types::{Error, ServerConfig, ServerInitStatus, StratumServerConfig};
 use crate::core::core::hash::{Hashed, ZERO_HASH};
 use crate::core::ser::ProtocolVersion;
 use crate::core::{consensus, genesis, global, pow};
@@ -52,7 +52,6 @@ use crate::pool;
 use crate::util::file::get_first_line;
 use crate::util::{RwLock, StopState};
 use futures::channel::oneshot;
-use grin_util::logger::LogEntry;
 
 /// Arcified  thread-safe TransactionPool with type parameters used by server components
 pub type ServerTxPool = Arc<RwLock<pool::TransactionPool<PoolToChainAdapter, PoolToNetAdapter>>>;
@@ -84,20 +83,16 @@ impl Server {
 	/// Instantiates and starts a new server. Optionally takes a callback
 	/// for the server to send an ARC copy of itself, to allow another process
 	/// to poll info about the server status
-	pub fn start<F>(
+	pub fn start(
 		config: ServerConfig,
-		logs_rx: Option<mpsc::Receiver<LogEntry>>,
-		mut info_callback: F,
 		stop_state: Option<Arc<StopState>>,
+		server_tx: Option<mpsc::Sender<ServerInitStatus>>,
 		api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
-	) -> Result<(), Error>
-	where
-		F: FnMut(Server, Option<mpsc::Receiver<LogEntry>>),
-	{
+	) -> Result<Server, Error> {
 		let mining_config = config.stratum_mining_config.clone();
 		let enable_test_miner = config.run_test_miner;
 		let test_miner_wallet_url = config.test_miner_wallet_url.clone();
-		let serv = Server::new(config, stop_state, api_chan)?;
+		let serv = Server::new(config, stop_state, server_tx, api_chan)?;
 
 		if let Some(c) = mining_config {
 			let enable_stratum_server = c.enable_stratum_server;
@@ -118,8 +113,7 @@ impl Server {
 			}
 		}
 
-		info_callback(serv, logs_rx);
-		Ok(())
+		Ok(serv)
 	}
 
 	// Exclusive (advisory) lock_file to ensure we do not run multiple
@@ -151,6 +145,7 @@ impl Server {
 	pub fn new(
 		config: ServerConfig,
 		stop_state: Option<Arc<StopState>>,
+		server_tx: Option<mpsc::Sender<ServerInitStatus>>,
 		api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
 	) -> Result<Server, Error> {
 		// Obtain our lock_file or fail immediately with an error.
@@ -193,6 +188,10 @@ impl Server {
 
 		info!("Starting server, genesis block: {}", genesis.hash());
 
+		if let Some(ref server_tx) = server_tx {
+			let _ = server_tx.send(ServerInitStatus::LoadDatabase);
+		}
+
 		let shared_chain = Arc::new(chain::Chain::init(
 			config.db_root.clone(),
 			chain_adapter.clone(),
@@ -220,6 +219,10 @@ impl Server {
 		};
 		debug!("Capabilities: {:?}", capabilities);
 
+		if let Some(ref server_tx) = server_tx {
+			let _ = server_tx.send(ServerInitStatus::StartSync);
+		}
+
 		let p2p_server = Arc::new(p2p::Server::new(
 			&config.db_root,
 			capabilities,
@@ -265,6 +268,10 @@ impl Server {
 				}
 			})?;
 
+		if let Some(ref server_tx) = server_tx {
+			let _ = server_tx.send(ServerInitStatus::StartAPI);
+		}
+
 		info!("Starting rest apis at: {}", &config.api_http_addr);
 		let api_secret = get_first_line(config.api_secret_path.clone());
 		let foreign_api_secret = get_first_line(config.foreign_api_secret_path.clone());
```

**File**: `src/bin/cmd/server.rs` (modified, +45/-28)
```diff
@@ -28,7 +28,10 @@ use crate::tui::ui;
 use futures::channel::oneshot;
 use grin_p2p::msg::PeerAddrs;
 use grin_p2p::PeerAddr;
+use grin_servers::common::types::ServerInitStatus;
+use grin_servers::Server;
 use grin_util::logger::LogEntry;
+use grin_util::StopState;
 use std::sync::mpsc;
 
 /// wrap below to allow UI to clean up on stop
@@ -37,38 +40,50 @@ pub fn start_server(
 	logs_rx: Option<mpsc::Receiver<LogEntry>>,
 	api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
 ) {
-	start_server_tui(config, logs_rx, api_chan);
-	exit(0);
+	exit(start_server_tui(config, logs_rx, api_chan));
 }
 
 fn start_server_tui(
 	config: servers::ServerConfig,
 	logs_rx: Option<mpsc::Receiver<LogEntry>>,
 	api_chan: &'static mut (oneshot::Sender<()>, oneshot::Receiver<()>),
-) {
-	// Run the UI controller.. here for now for simplicity to access
-	// everything it might need
+) -> i32 {
 	if config.run_tui.unwrap_or(false) {
 		warn!("Starting GRIN in UI mode...");
-		servers::Server::start(
-			config,
-			logs_rx,
-			|serv: servers::Server, logs_rx: Option<mpsc::Receiver<LogEntry>>| {
-				let mut controller = ui::Controller::new(logs_rx.unwrap()).unwrap_or_else(|e| {
-					panic!("Error loading UI controller: {}", e);
-				});
-				controller.run(serv);
-			},
-			None,
-			api_chan,
-		)
-		.unwrap();
+		// Run the UI controller.
+		let (serv_tx, serv_rx) = mpsc::channel::<ServerInitStatus>();
+		let mut controller = ui::Controller::new(logs_rx, serv_rx).unwrap_or_else(|e| {
+			panic!("Error loading UI controller: {}", e);
+		});
+		let serv_tx_clone = serv_tx.clone();
+		let stop_state = Arc::new(StopState::new());
+		let stop_state_clone = stop_state.clone();
+		thread::spawn(move || {
+			match Server::start(
+				config,
+				Some(stop_state_clone.clone()),
+				Some(serv_tx_clone.clone()),
+				api_chan,
+			) {
+				Ok(s) => {
+					if stop_state_clone.is_stopped() {
+						s.stop();
+						return;
+					}
+					let _ = serv_tx_clone.send(ServerInitStatus::FinishedLoading(s));
+				}
+				Err(e) => {
+					let _ = serv_tx_clone.send(ServerInitStatus::ErrorLoading(e));
+				}
+			}
+		});
+		let exit_code = controller.run();
+		stop_state.stop();
+		exit_code
 	} else {
 		warn!("Starting GRIN w/o UI...");
-		servers::Server::start(
-			config,
-			logs_rx,
-			|serv: servers::Server, _: Option<mpsc::Receiver<LogEntry>>| {
+		match Server::start(config, None, None, api_chan) {
+			Ok(s) => {
 				let running = Arc::new(AtomicBool::new(true));
 				let r = running.clone();
 				ctrlc::set_handler(move || {
@@ -79,12 +94,14 @@ fn start_server_tui(
 					thread::sleep(Duration::from_secs(1));
 				}
 				warn!("Received SIGINT (Ctrl+C) or SIGTERM (kill).");
-				serv.stop();
-			},
-			None,
-			api_chan,
-		)
-		.unwrap();
+				s.stop();
+				0
+			}
+			Err(e) => {
+				error!("Error starting GRIN: {:?}", e);
+				1
+			}
+		}
 	}
 }
 
```

**File**: `src/bin/tui/ui.rs` (modified, +95/-24)
```diff
@@ -15,6 +15,12 @@
 //! Basic TUI to better output the overall system status and status
 //! of various subsystems
 
+use super::constants::MAIN_MENU;
+use crate::built_info;
+use crate::servers::Server;
+use crate::tui::constants::{ROOT_STACK, VIEW_BASIC_STATUS, VIEW_MINING, VIEW_PEER_SYNC};
+use crate::tui::types::{TUIStatusListener, UIMessage};
+use crate::tui::{logs, menu, mining, peers, status, version};
 use chrono::prelude::Utc;
 use cursive::direction::Orientation;
 use cursive::theme::BaseColor::{Black, Blue, Cyan, White};
@@ -29,24 +35,20 @@ use cursive::views::{
 	CircularFocus, Dialog, LinearLayout, Panel, SelectView, StackView, TextView, ViewRef,
 };
 use cursive::{CursiveRunnable, CursiveRunner};
-use std::sync::mpsc;
-use std::{thread, time};
-
-use super::constants::MAIN_MENU;
-use crate::built_info;
-use crate::servers::Server;
-use crate::tui::constants::{ROOT_STACK, VIEW_BASIC_STATUS, VIEW_MINING, VIEW_PEER_SYNC};
-use crate::tui::types::{TUIStatusListener, UIMessage};
-use crate::tui::{logs, menu, mining, peers, status, version};
 use grin_core::global;
+use grin_servers::common::types::{Error, ServerInitStatus};
 use grin_util::logger::LogEntry;
+use std::sync::atomic::{AtomicBool, Ordering};
+use std::sync::{mpsc, Arc};
+use std::{thread, time};
 
 pub struct UI {
 	cursive: CursiveRunner<CursiveRunnable>,
 	ui_rx: mpsc::Receiver<UIMessage>,
 	ui_tx: mpsc::Sender<UIMessage>,
 	controller_tx: mpsc::Sender<ControllerMessage>,
-	logs_rx: mpsc::Receiver<LogEntry>,
+	logs_rx: Option<mpsc::Receiver<LogEntry>>,
+	show_dialog: Arc<AtomicBool>,
 }
 
 fn modify_theme(theme: &mut Theme) {
@@ -65,7 +67,7 @@ impl UI {
 	/// Create a new UI
 	pub fn new(
 		controller_tx: mpsc::Sender<ControllerMessage>,
-		logs_rx: mpsc::Receiver<LogEntry>,
+		logs_rx: Option<mpsc::Receiver<LogEntry>>,
 	) -> UI {
 		let (ui_tx, ui_rx) = mpsc::channel::<UIMessage>();
 
@@ -75,6 +77,7 @@ impl UI {
 			ui_rx,
 			controller_tx,
 			logs_rx,
+			show_dialog: Arc::new(AtomicBool::new(false)),
 		};
 
 		// Create UI objects, etc
@@ -102,7 +105,7 @@ impl UI {
 				built_info::PKG_VERSION,
 				global::get_chain_type()
 			),
-			Color::Dark(BaseColor::Green),
+			Dark(BaseColor::Green),
 		));
 
 		let main_layer = LinearLayout::new(Orientation::Vertical)
@@ -117,17 +120,21 @@ impl UI {
 		let mut theme = grin_ui.cursive.current_theme().clone();
 		modify_theme(&mut theme);
 		grin_ui.cursive.set_theme(theme);
+
 		grin_ui.cursive.add_fullscreen_layer(main_layer);
 
 		// Configure a callback (shutdown, for the first test)
 		let controller_tx_clone = grin_ui.controller_tx.clone();
+		let show_dialog_clone = grin_ui.show_dialog.clone();
 		grin_ui.cursive.add_global_callback('q', move |c| {
+			if show_dialog_clone.load(Ordering::Relaxed) {
+				c.pop_layer();
+			}
 			let content = StyledString::styled("Shutting down...", Color::Light(BaseColor::Yellow));
 			c.add_layer(CircularFocus::new(Dialog::around(TextView::new(content))).wrap_tab());
-			controller_tx_clone
-				.send(ControllerMessage::Shutdown)
-				.unwrap();
+			let _ = controller_tx_clone.send(ControllerMessage::Shutdown);
 		});
+
 		grin_ui.cursive.set_fps(3);
 		grin_ui
 	}
@@ -139,8 +146,10 @@ impl UI {
 			return false;
 		}
 
-		while let Some(message) = self.logs_rx.try_iter().next() {
-			logs::TUILogsView::update(&mut self.cursive, message);
+		if let Some(logs_rx) = &self.logs_rx {
+			while let Some(message) = logs_rx.try_iter().next() {
+				logs::TUILogsView::update(&mut self.cursive, message);
+			}
 		}
 
 		// Process any pending UI messages
@@ -174,6 +183,8 @@ impl UI {
 pub struct Controller {
 	rx: mpsc::Receiver<ControllerMessage>,
 	ui: UI,
+	serv_rx: mpsc::Receiver<ServerInitStatus>,
+	server: Option<Server>,
 }
 
 pub enum ControllerMessage {
@@ -182,39 +193,99 @@ pub enum ControllerMessage {
 
 impl Controller {
 	/// Create a new controller
-	pub fn new(logs_rx: mpsc::Receiver<LogEntry>) -> Result<Controller, String> {
+	pub fn new(
+		logs_rx: Option<mpsc::Receiver<LogEntry>>,
+		serv_rx: mpsc::Receiver<ServerInitStatus>,
+	) -> Result<Controller, String> {
 		let (tx, rx) = mpsc::channel::<ControllerMessage>();
 		Ok(Controller {
 			rx,
 			ui: UI::new(tx, logs_rx),
+			serv_rx,
+			server: None,
 		})
 	}
 
+	/// Server initialization status.
+	pub fn init_status(&mut self, text: &str, pop: bool) {
+		if pop {
+			self.ui.cursive.pop_layer();
+		}
+		let content = StyledString::styled(text, Color::Light(BaseColor::Green));
+		self.ui
+			.cursive
+			.add_layer(CircularFocus::new(Dialog::around(TextView::new(content))).wrap_tab());
+		self.ui.show_dialog.store(true, Ordering::Relaxed);
+	}
+
+	/// Server initialization error.
+	pub fn init_error(&mut self, e: Error) {
+		let content = StyledString::styled(format!("{:?}", e), Color::Light(BaseColor::Red));
+		self.ui.cursive.add_layer(
+			CircularFocus::new(Dialog::around(TextView::new(content)).button("Exit", |s| {
+				s.quit();
+			}))
+			.wrap_tab(),
+		);
+		self.ui.show
```

---

### Incident Patch 11: `a94864ec` (2026-05-13)
**Commit Message**: Include git info into docker build, show git ref at version (#3829)

* ci: include .git directory into build

* p2p: include git ref into version for user agent, show git commit hash instead of last tag into log

* p2p: do not show anything after version if git commit hash is empty

* fix: user agent typo

**File**: `.github/workflows/publish-ghcr.yaml.yml` (modified, +2/-3)
```diff
@@ -41,13 +41,12 @@ jobs:
       - name: Set up Docker Buildx
         uses: docker/setup-buildx-action@v3
 
-      - name: Checkout code
-        uses: actions/checkout@v6
-
       - name: Build and push by digest
         id: build
         uses: docker/build-push-action@v6
         with:
+          build-args: |
+            BUILDKIT_CONTEXT_KEEP_GIT_DIR=1
           provenance: false # Disable provenance to avoid unknown/unknown
           sbom: false       # Disable sbom to avoid unknown/unknown
           platforms: ${{ matrix.platform }}
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1085,6 +1085,7 @@ name = "grin_p2p"
 version = "5.4.1"
 dependencies = [
  "bitflags 1.3.2",
+ "built",
  "bytes 0.5.6",
  "chrono",
  "enum_primitive",
```

**File**: `api/src/types.rs` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ impl Status {
 		Status {
 			chain: global::get_chain_type().shortname(),
 			protocol_version: ser::ProtocolVersion::local().into(),
-			user_agent: p2p::msg::USER_AGENT.to_string(),
+			user_agent: p2p::msg::user_agent().to_string(),
 			connections: connections,
 			tip: Tip::from_tip(current_tip),
 			sync_status,
```

**File**: `p2p/Cargo.toml` (modified, +4/-0)
```diff
@@ -8,6 +8,7 @@ repository = "https://github.com/mimblewimble/grin"
 keywords = [ "crypto", "grin", "mimblewimble" ]
 workspace = ".."
 edition = "2018"
+build = "src/build/build.rs"
 
 [dependencies]
 bitflags = "1"
@@ -29,3 +30,6 @@ grin_chain = { path = "../chain", version = "5.4.1" }
 
 [dev-dependencies]
 grin_pool = { path = "../pool", version = "5.4.1" }
+
+[build-dependencies]
+built = { version = "0.8.0", features = ["git2"]}
```

**File**: `p2p/src/build/build.rs` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+// Copyright 2026 The Grin Developers
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+//! Build hooks to spit out version info
+
+use std::env;
+use std::path::Path;
+
+fn main() {
+	// build and versioning information
+	let out_dir_path = format!("{}{}", env::var("OUT_DIR").unwrap(), "/built.rs");
+	// don't fail the build if something's missing, may just be cargo release
+	let _ = built::write_built_file_with_opts(
+		Some(Path::new(env!("CARGO_MANIFEST_DIR"))),
+		Path::new(&out_dir_path),
+	);
+}
```

**File**: `p2p/src/handshake.rs` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ use crate::conn::Tracker;
 use crate::core::core::hash::Hash;
 use crate::core::pow::Difficulty;
 use crate::core::ser::ProtocolVersion;
-use crate::msg::{read_message, write_message, Hand, Msg, Shake, Type, USER_AGENT};
+use crate::msg::{read_message, user_agent, write_message, Hand, Msg, Shake, Type};
 use crate::peer::Peer;
 use crate::types::{Capabilities, Direction, Error, P2PConfig, PeerAddr, PeerInfo, PeerLiveInfo};
 use crate::util::RwLock;
@@ -120,7 +120,7 @@ impl Handshake {
 			total_difficulty,
 			sender_addr: self_addr,
 			receiver_addr: peer_addr,
-			user_agent: USER_AGENT.to_string(),
+			user_agent: user_agent().to_string(),
 		};
 
 		// write and read the handshake response
@@ -225,7 +225,7 @@ impl Handshake {
 			capabilities: capab,
 			genesis: self.genesis,
 			total_difficulty: total_difficulty,
-			user_agent: USER_AGENT.to_string(),
+			user_agent: user_agent().to_string(),
 		};
 
 		let msg = Msg::new(Type::Shake, shake, negotiated_version)?;
```

**File**: `p2p/src/msg.rs` (modified, +12/-1)
```diff
@@ -40,8 +40,19 @@ use std::io::{Read, Write};
 use std::sync::Arc;
 use std::{fmt, thread, time::Duration};
 
+// include build information
+pub mod built_info {
+	include!(concat!(env!("OUT_DIR"), "/built.rs"));
+}
+
 /// Grin's user agent with current version
-pub const USER_AGENT: &str = concat!("MW/Grin ", env!("CARGO_PKG_VERSION"));
+pub fn user_agent() -> String {
+	format!(
+		"MW/Grin {}{}",
+		env!("CARGO_PKG_VERSION"),
+		built_info::GIT_COMMIT_HASH_SHORT.map_or_else(|| "".to_owned(), |v| ".".to_owned() + v)
+	)
+}
 
 /// Magic numbers expected in the header of every message
 const OTHER_MAGIC: [u8; 2] = [73, 43];
```

**File**: `p2p/tests/peer_handshake.rs` (modified, +7/-1)
```diff
@@ -25,6 +25,7 @@ use std::{thread, time};
 use crate::core::core::hash::Hash;
 use crate::core::global;
 use crate::core::pow::Difficulty;
+use crate::p2p::msg::built_info;
 use crate::p2p::types::PeerAddr;
 use crate::p2p::Peer;
 
@@ -88,7 +89,12 @@ fn peer_handshake() {
 	)
 	.unwrap();
 
-	assert!(peer.info.user_agent.ends_with(env!("CARGO_PKG_VERSION")));
+	let git_hash =
+		built_info::GIT_COMMIT_HASH_SHORT.map_or_else(|| "".to_owned(), |v| ".".to_owned() + v);
+	assert!(peer
+		.info
+		.user_agent
+		.ends_with(format!("{}{}", env!("CARGO_PKG_VERSION"), git_hash).as_str()));
 
 	thread::sleep(time::Duration::from_secs(1));
 
```

---

### Incident Patch 12: `2e0d8271` (2026-06-11)
**Commit Message**: PIBD peers fix (#3823)

* pibd: choose peers based on minimal height, temporary block peers for stale segments disconnecting only outbound, force request for output and rangeproof segments to avoid stuck at this case

* fix: add missing method clear_pibd_requests to commit

* peer: block only non-blocked to not increase times for several requests

* p2p: ignore last connection attempt when there is not enough outbound peers

* pibd: do not check for max cached segments on selecting next desired segment for request

* pibd: check if segment not exists at request when selecting next required

* fix: add segment to request if not exists

* fix: peers iterator to unblock blocked

* peers: keep blocked list into memory till restart or pibd finish

* sync: blocked filter

* lmdb: do not include blocked peers in selection of peer, count also blocked peers to use fallback .zip download

* pibd: increase timeout for .zip fallback

**File**: `chain/src/pibd_params.rs` (modified, +4/-1)
```diff
@@ -43,6 +43,9 @@ pub const SEGMENT_REQUEST_TIMEOUT_SECS: i64 = 20;
 /// will always be requested first)
 pub const SEGMENT_REQUEST_COUNT: usize = 15;
 
+/// How many blocks behind the tip a PIBD peer may be and still be considered usable.
+pub const PIBD_PEER_HEIGHT_SLACK_BLOCKS: u64 = 2;
+
 /// If the syncer hasn't seen a max work peer that supports PIBD in this number of seconds
 /// give up and revert back to the txhashset.zip download method
-pub const TXHASHSET_ZIP_FALLBACK_TIME_SECS: i64 = 60;
+pub const TXHASHSET_ZIP_FALLBACK_TIME_SECS: i64 = 660;
```

**File**: `chain/src/txhashset/desegmenter.rs` (modified, +113/-94)
```diff
@@ -497,102 +497,126 @@ impl Desegmenter {
 					}
 				}
 			}
-		} else {
-			// We have all required bitmap segments and have recreated our local
-			// bitmap, now continue with other segments, evenly spreading requests
-			// among MMRs
-			let local_output_mmr_size;
-			let local_kernel_mmr_size;
-			let local_rangeproof_mmr_size;
-			{
-				let txhashset = self.txhashset.read();
-				local_output_mmr_size = txhashset.output_mmr_size();
-				local_kernel_mmr_size = txhashset.kernel_mmr_size();
-				local_rangeproof_mmr_size = txhashset.rangeproof_mmr_size();
+			// Bitmap is not finished yet, continue at next iteration when it will be ready.
+			return return_vec;
+		}
+
+		// We have all required bitmap segments and have recreated our local
+		// bitmap, now continue with other segments, evenly spreading requests
+		// among MMRs
+		let local_output_mmr_size;
+		let local_kernel_mmr_size;
+		let local_rangeproof_mmr_size;
+		{
+			let txhashset = self.txhashset.read();
+			local_output_mmr_size = txhashset.output_mmr_size();
+			local_kernel_mmr_size = txhashset.kernel_mmr_size();
+			local_rangeproof_mmr_size = txhashset.rangeproof_mmr_size();
+		}
+		let total_output_segments = SegmentIdentifier::count_segments_required(
+			self.archive_header.output_mmr_size,
+			self.default_output_segment_height,
+		);
+		let mut elems_added = 0;
+		if let Some(mut next_output_idx) = self.next_required_output_segment_index() {
+			while (next_output_idx as usize) < total_output_segments {
+				if elems_added == max_elements / 3 {
+					break;
+				}
+				let output_id = SegmentIdentifier {
+					height: self.default_output_segment_height,
+					idx: next_output_idx,
+				};
+				let (_first, last) =
+					output_id.segment_pos_range(self.archive_header.output_mmr_size);
+				if last > local_output_mmr_size && !self.has_output_segment_with_id(output_id) {
+					return_vec.push(SegmentTypeIdentifier::new(SegmentType::Output, output_id));
+					elems_added += 1;
+				}
+				next_output_idx += 1;
 			}
-			let total_output_segments = SegmentIdentifier::count_segments_required(
-				self.archive_header.output_mmr_size,
-				self.default_output_segment_height,
-			);
-			let mut elems_added = 0;
-			if let Some(mut next_output_idx) = self.next_required_output_segment_index() {
-				while (next_output_idx as usize) < total_output_segments {
-					if self.output_segment_cache.len() >= self.max_cached_segments {
-						break;
-					}
-					if elems_added == max_elements / 3 {
-						break;
-					}
-					let output_id = SegmentIdentifier {
-						height: self.default_output_segment_height,
-						idx: next_output_idx,
-					};
-					let (_first, last) =
-						output_id.segment_pos_range(self.archive_header.output_mmr_size);
-					if last > local_output_mmr_size && !self.has_output_segment_with_id(output_id) {
-						return_vec.push(SegmentTypeIdentifier::new(SegmentType::Output, output_id));
-						elems_added += 1;
-					}
-					next_output_idx += 1;
+		}
+
+		let total_rangeproof_segments = SegmentIdentifier::count_segments_required(
+			self.archive_header.output_mmr_size,
+			self.default_rangeproof_segment_height,
+		);
+		elems_added = 0;
+		if let Some(mut next_rp_idx) = self.next_required_rangeproof_segment_index() {
+			while (next_rp_idx as usize) < total_rangeproof_segments {
+				if elems_added == max_elements / 3 {
+					break;
 				}
+				let rp_id = SegmentIdentifier {
+					height: self.default_rangeproof_segment_height,
+					idx: next_rp_idx,
+				};
+				let (_first, last) = rp_id.segment_pos_range(self.archive_header.output_mmr_size);
+				if last > local_rangeproof_mmr_size && !self.has_rangeproof_segment_with_id(rp_id) {
+					return_vec.push(SegmentTypeIdentifier::new(SegmentType::RangeProof, rp_id));
+					elems_added += 1;
+				}
+				next_rp_idx += 1;
 			}
+		}
 
-			let total_rangeproof_segments = SegmentIdentifier::count_segments_required(
-				self.archive_header.output_mmr_size,
-				self.default_rangeproof_segment_height,
-			);
-			elems_added = 0;
-			if let Some(mut next_rp_idx) = self.next_required_rangeproof_segment_index() {
-				while (next_rp_idx as usize) < total_rangeproof_segments {
-					if self.rangeproof_segment_cache.len() >= self.max_cached_segments {
-						break;
-					}
-					if elems_added == max_elements / 3 {
-						break;
-					}
-					let rp_id = SegmentIdentifier {
-						height: self.default_rangeproof_segment_height,
-						idx: next_rp_idx,
-					};
-					let (_first, last) =
-						rp_id.segment_pos_range(self.archive_header.output_mmr_size);
-					if last > local_rangeproof_mmr_size
-						&& !self.has_rangeproof_segment_with_id(rp_id)
-					{
-						return_vec.push(SegmentTypeIdentifier::new(SegmentType::RangeProof, rp_id));
-						elems_added += 1;
-					}
-					next_rp_idx += 1;
+		let total_kernel_segments = SegmentIdentifier::count_segments_required(
+			self.archive_header.kernel_mmr_size,
+			self.default_kernel_segment_height,
+		);
+		elems_added = 0
```

**File**: `chain/src/types.rs` (modified, +10/-0)
```diff
@@ -316,6 +316,16 @@ impl SyncState {
 		removed_segments
 	}
 
+	/// Drop all tracked PIBD requests, returning how many entries were removed.
+	pub fn clear_pibd_requests(&self) -> usize {
+		let mut requests = self.requested_pibd_segments.write();
+		let cleared = requests.len();
+		if cleared > 0 {
+			requests.clear();
+		}
+		cleared
+	}
+
 	/// Check whether segment is in request list
 	pub fn contains_pibd_segment(&self, id: &SegmentTypeIdentifier) -> bool {
 		self.requested_pibd_segments
```

**File**: `p2p/src/peer.rs` (modified, +1/-2)
```diff
@@ -13,15 +13,14 @@
 // limitations under the License.
 
 use crate::util::{Mutex, RwLock};
+use lru_cache::LruCache;
 use std::fmt;
 use std::fs::File;
 use std::net::{Shutdown, TcpStream};
 use std::path::PathBuf;
 use std::sync::atomic::{AtomicBool, Ordering};
 use std::sync::Arc;
 
-use lru_cache::LruCache;
-
 use crate::chain;
 use crate::chain::txhashset::BitmapChunk;
 use crate::conn;
```

**File**: `p2p/src/peers.rs` (modified, +80/-0)
```diff
@@ -45,6 +45,7 @@ pub struct Peers {
 	pub adapter: Arc<dyn ChainAdapter>,
 	store: PeerStore,
 	peers: RwLock<HashMap<PeerAddr, Arc<Peer>>>,
+	blocked: RwLock<HashMap<PeerAddr, (DateTime<Utc>, u32)>>,
 	config: P2PConfig,
 }
 
@@ -55,6 +56,7 @@ impl Peers {
 			store,
 			config,
 			peers: RwLock::new(HashMap::new()),
+			blocked: RwLock::new(HashMap::new()),
 		}
 	}
 
@@ -434,6 +436,74 @@ impl Peers {
 		}
 	}
 
+	/// Disconnect a peer without banning it.
+	pub fn disconnect_peer(&self, peer_addr: PeerAddr, reason: &str) -> Result<(), Error> {
+		let mut peers = self.peers.try_write_for(LOCK_TIMEOUT).ok_or_else(|| {
+			error!("disconnect_peer: failed to get peers lock");
+			Error::PeerException
+		})?;
+		match peers.remove(&peer_addr) {
+			Some(peer) => {
+				warn!("disconnecting peer {} ({})", peer_addr, reason);
+				peer.stop();
+				Ok(())
+			}
+			None => Err(Error::PeerNotFound),
+		}
+	}
+
+	/// Whether this peer has been blocked.
+	pub fn is_blocked(&self, peer_addr: PeerAddr) -> bool {
+		match self.blocked.try_read_for(LOCK_TIMEOUT) {
+			Some(peers) => match peers.get(&peer_addr) {
+				None => false,
+				Some((expiry, _)) => expiry > &Utc::now(),
+			},
+			None => {
+				error!("is_blocked: failed to get peers lock");
+				false
+			}
+		}
+	}
+
+	/// Temporary block a peer without banning it.
+	pub fn block_peer(&self, peer_addr: PeerAddr, reason: &str) -> Result<(), Error> {
+		let mut blocked = self.blocked.try_write_for(LOCK_TIMEOUT).ok_or_else(|| {
+			error!("block_peer: failed to get blocked lock");
+			Error::PeerException
+		})?;
+
+		let times = {
+			match blocked.get(&peer_addr) {
+				Some((_, times)) => times + 1,
+				None => 1,
+			}
+		};
+		let duration = match times {
+			1 => 60,  // 1m
+			2 => 180, // 3m
+			_ => 600, // 10m
+		};
+		let expiry = Utc::now() + Duration::seconds(duration);
+		blocked.insert(peer_addr, (expiry, times));
+
+		warn!(
+			"state_sync: block peer {} ({}) for {} times: {}",
+			peer_addr, reason, duration, times
+		);
+		Ok(())
+	}
+
+	/// Unblock all blocked peers.
+	pub fn unblock_peers(&self) -> Result<(), Error> {
+		let mut blocked = self.blocked.try_write_for(LOCK_TIMEOUT).ok_or_else(|| {
+			error!("unblock_peers: failed to get blocked lock");
+			Error::PeerException
+		})?;
+		blocked.clear();
+		Ok(())
+	}
+
 	/// We have enough outbound connected peers
 	pub fn enough_outbound_peers(&self) -> bool {
 		self.iter().outbound().connected().count()
@@ -819,6 +889,16 @@ impl<I: Iterator<Item = Arc<Peer>>> PeersIter<I> {
 		}
 	}
 
+	/// Custom filter.
+	pub fn with_filter(
+		self,
+		f: impl Fn(&Arc<Peer>) -> bool,
+	) -> PeersIter<impl Iterator<Item = Arc<Peer>>> {
+		PeersIter {
+			iter: self.iter.filter(move |p| f(p)),
+		}
+	}
+
 	pub fn by_addr(&mut self, addr: PeerAddr) -> Option<Arc<Peer>> {
 		self.iter.find(|p| p.info.addr == addr)
 	}
```

**File**: `servers/src/grin/seed.rs` (modified, +7/-3)
```diff
@@ -194,7 +194,8 @@ fn monitor_peers(peers: Arc<p2p::Peers>, config: p2p::P2PConfig, tx: mpsc::Sende
 		return;
 	}
 
-	if !peers.enough_outbound_peers() {
+	let enough_outbound = peers.enough_outbound_peers();
+	if !enough_outbound {
 		// loop over connected peers that can provide peer lists
 		// ask them for their list of peers
 		let mut connected_peers: Vec<PeerAddr> = vec![];
@@ -239,7 +240,8 @@ fn monitor_peers(peers: Arc<p2p::Peers>, config: p2p::P2PConfig, tx: mpsc::Sende
 		.iter()
 		.filter(|p| {
 			peers.get_connected_peer(p.addr).is_none()
-				&& Utc::now().timestamp() - p.last_attempt >= max_attempt_delay
+				&& (!enough_outbound
+					|| Utc::now().timestamp() - p.last_attempt >= max_attempt_delay)
 		})
 		.choose_multiple(&mut thread_rng(), max_peer_attempts / 2)
 	{
@@ -268,7 +270,9 @@ fn monitor_peers(peers: Arc<p2p::Peers>, config: p2p::P2PConfig, tx: mpsc::Sende
 	// check min 32 (max 128, if there are no healthy and unknown) random defunct peers no more often than 1 hour per peer.
 	for dp in defuncts
 		.iter()
-		.filter(|p| Utc::now().timestamp() - p.last_attempt >= max_attempt_delay)
+		.filter(|p| {
+			!enough_outbound || Utc::now().timestamp() - p.last_attempt >= max_attempt_delay
+		})
 		.choose_multiple(&mut thread_rng(), max_peer_attempts - new_peers.len())
 	{
 		new_peers.push(&dp.addr);
```

**File**: `servers/src/grin/sync/state_sync.rs` (modified, +118/-42)
```diff
@@ -14,6 +14,7 @@
 
 use chrono::prelude::{DateTime, Utc};
 use chrono::Duration;
+use grin_p2p::PeerAddr;
 use std::sync::Arc;
 
 use crate::chain::{self, pibd_params, SyncState, SyncStatus};
@@ -256,6 +257,46 @@ impl StateSync {
 			.sync_state
 			.remove_stale_pibd_requests(pibd_params::SEGMENT_REQUEST_TIMEOUT_SECS);
 
+		if !stale_segments.is_empty() {
+			for (seg_id, peer_addr) in stale_segments.iter() {
+				if let Some(peer_addr) = peer_addr {
+					let _ = self
+						.peers
+						.block_peer(PeerAddr(*peer_addr), "PIBD segment timeout");
+					debug!(
+						"state_sync: peer {} moved to PIBD retry exclusion list for segment {:?}",
+						peer_addr, seg_id
+					);
+					let is_outbound = {
+						self.peers
+							.iter()
+							.outbound()
+							.by_addr(PeerAddr(peer_addr.clone()))
+							.is_some()
+					};
+					if is_outbound {
+						debug!("state_sync: disconnecting peer {}", peer_addr);
+						if let Err(e) = self
+							.peers
+							.disconnect_peer(PeerAddr(*peer_addr), "PIBD segment timeout")
+						{
+							debug!(
+								"state_sync: failed to disconnect timed-out peer {}: {:?}",
+								peer_addr, e
+							);
+						}
+					} else {
+						debug!("state_sync: peer {} is not outbound or not connected, do not disconnect", peer_addr);
+					}
+				} else {
+					debug!(
+						"state_sync: PIBD request {:?} timed out without a recorded peer",
+						seg_id
+					);
+				}
+			}
+		}
+
 		// Apply segments... TODO: figure out how this should be called, might
 		// need to be a separate thread.
 		if let Some(mut de) = desegmenter.try_write() {
@@ -318,11 +359,28 @@ impl StateSync {
 					.connected()
 			};
 
+			// Get peers with reasonable height for pibd.
+			let height_slack = pibd_params::PIBD_PEER_HEIGHT_SLACK_BLOCKS;
+			let max_pibd_height = peers_iter_pibd()
+				.into_iter()
+				.map(|p| p.info.height())
+				.max()
+				.unwrap_or(0);
+
+			let available_pibd_peers = || {
+				peers_iter_pibd().with_filter(|p| {
+					p.info.height().saturating_add(height_slack) >= max_pibd_height
+				})
+			};
+
 			// If there are no suitable PIBD-Enabled peers, AND there hasn't been one for a minute,
 			// abort PIBD and fall back to txhashset download
 			// Waiting a minute helps ensures that the cancellation isn't simply due to a single non-PIBD enabled
 			// peer having the max difficulty
-			if peers_iter_pibd().count() == 0 {
+			if available_pibd_peers()
+				.with_filter(|p| !peers.is_blocked(p.info.addr))
+				.count() == 0
+			{
 				if let None = self.earliest_zero_pibd_peer_time {
 					self.set_earliest_zero_pibd_peer_time(Some(Utc::now()));
 				}
@@ -339,72 +397,89 @@ impl StateSync {
 					self.set_pibd_aborted();
 					return false;
 				}
-			} else {
-				self.set_earliest_zero_pibd_peer_time(None)
+				let cleared = self.sync_state.clear_pibd_requests();
+				if cleared > 0 {
+					warn!(
+						"state_sync: cleared {} pending PIBD requests because no PIBD-enabled peers are currently available",
+						cleared
+					);
+				}
+				continue;
 			}
 
+			self.set_earliest_zero_pibd_peer_time(None);
+
 			// Choose a random "most work" peer, excluding peer from stale segment and preferring outbound if at all possible.
 			let excluded_peer = stale_segments
 				.iter()
 				.find(|(stale_id, _)| stale_id == seg_id)
 				.and_then(|(_, addr)| *addr);
-			let peer = peers_iter_pibd()
+			let peer = available_pibd_peers()
 				.outbound()
+				.with_filter(|p| !peers.is_blocked(p.info.addr))
 				.exclude(excluded_peer)
 				.choose_random()
 				.or_else(|| {
-					peers_iter_pibd()
+					available_pibd_peers()
 						.inbound()
+						.with_filter(|p| !peers.is_blocked(p.info.addr))
 						.exclude(excluded_peer)
 						.choose_random()
 				});
 			trace!("Chosen peer is {:?}", peer);
 
-			if let Some(p) = peer {
-				// add to list of segments that are being tracked
-				self.sync_state.add_pibd_segment(seg_id, p.info.addr.0);
-				let res = match seg_id.segment_type {
-					SegmentType::Bitmap => p.send_bitmap_segment_request(
-						archive_header.hash(),
-						seg_id.identifier.clone(),
-					),
-					SegmentType::Output => p.send_output_segment_request(
-						archive_header.hash(),
-						seg_id.identifier.clone(),
-					),
-					SegmentType::RangeProof => p.send_rangeproof_segment_request(
-						archive_header.hash(),
-						seg_id.identifier.clone(),
-					),
-					SegmentType::Kernel => p.send_kernel_segment_request(
-						archive_header.hash(),
-						seg_id.identifier.clone(),
-					),
-				};
-				if let Err(e) = res {
+			let p = match peer {
+				Some(p) => p,
+				None => {
+					debug!(
+						"state_sync: no eligible PIBD peers available for request {:?}",
+						seg_id
+					);
+					continue;
+				}
+			};
+
+			// add to list of segments that are being tracked
+			self.sync_state.add_pibd_segment(seg_id, p.info.addr.0);
+
+			let res = match seg_id.segment_type {
+				SegmentType::Bitmap => {
+					p.send_bitmap_segment_request(ar
```

---

### Incident Patch 13: `ee4390e4` (2026-05-26)
**Commit Message**: Clarifies the blinding factor range proof explanation and includes the remaining typo fixes (#3840)

**File**: `api/src/foreign.rs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ use crate::{rest::*, BlockListing};
 use std::sync::Weak;
 
 /// Main interface into all node API functions.
-/// Node APIs are split into two seperate blocks of functionality
+/// Node APIs are split into two separate blocks of functionality
 /// called the ['Owner'](struct.Owner.html) and ['Foreign'](struct.Foreign.html) APIs
 ///
 /// Methods in this API are intended to be 'single use'.
```

**File**: `api/src/owner.rs` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ use std::net::SocketAddr;
 use std::sync::Weak;
 
 /// Main interface into all node API functions.
-/// Node APIs are split into two seperate blocks of functionality
+/// Node APIs are split into two separate blocks of functionality
 /// called the ['Owner'](struct.Owner.html) and ['Foreign'](struct.Foreign.html) APIs
 ///
 /// Methods in this API are intended to be 'single use'.
```

**File**: `doc/intro.md` (modified, +3/-1)
```diff
@@ -252,7 +252,9 @@ which can be signed by the attacker because Carol's blinding factor cancels out
 
 This output (`(113 + 99)*G + 2*H`) requires that both the numbers 113 and 99 are known in order to be spent; the attacker
 would thus have successfully locked Carol's UTXO. The requirement for a range proof for the blinding factor prevents this
-because the attacker doesn't know the number 113 and thus neither (113 + 99). A more detailed description of range proofs is further detailed in the [range proof paper](https://eprint.iacr.org/2017/1066.pdf).
+because the attacker doesn't know the number 113 and thus neither (113 + 99). In other words, without knowing the private
+key (blinding factor), the attacker would not know the value in the output and would not be able to produce a valid range proof for it.
+A more detailed description of range proofs is further detailed in the [range proof paper](https://eprint.iacr.org/2017/1066.pdf).
 
 #### Putting It All Together
 
```

**File**: `doc/pow/pow.md` (modified, +2/-2)
```diff
@@ -113,10 +113,10 @@ Now, (hopefully) armed with a basic understanding of what the Cuckoo Cycle algor
 
 ## Mining in Grin
 
-The Cuckoo Cycle outlined above forms the basis of Grin's mining process, however Grin uses two variantion of Cuckoo Cycle in tandem with several other systems to create a Proof-of-Work.
+The Cuckoo Cycle outlined above forms the basis of Grin's mining process, however Grin uses two variations of Cuckoo Cycle in tandem with several other systems to create a Proof-of-Work.
 
 1. for GPUs: Cuckaroo on 2^29 edges
-    * Tweaked every 6 months to maitain ASIC resistance.
+    * Tweaked every 6 months to maintain ASIC resistance.
     * 90% of rewards at launch, linearly decreasing to 0% in 2 years.
     * Variant of Cuckoo that enforces so-called ``mean'' mining.
     * Takes 5.5GB of memory (perhaps 4GB with slowdown).
```

---

### Incident Patch 14: `af0c1dca` (2026-03-25)
**Commit Message**: pibd: fix check for next required kernel segment (#3822)

**File**: `chain/src/txhashset/desegmenter.rs` (modified, +14/-7)
```diff
@@ -1069,17 +1069,24 @@ impl Desegmenter {
 			)
 		};
 
-		// When resuming, we need to ensure we're getting the previous segment if needed
-		let theoretical_pmmr_size =
-			SegmentIdentifier::pmmr_size(cur_segment_count, self.default_kernel_segment_height);
-		if local_kernel_mmr_size < theoretical_pmmr_size {
-			cur_segment_count -= 1;
-		}
-
 		let total_segment_count = SegmentIdentifier::count_segments_required(
 			self.archive_header.kernel_mmr_size,
 			self.default_kernel_segment_height,
 		);
+
+		// When resuming, we need to ensure we're getting the previous segment if needed
+		if total_segment_count != cur_segment_count {
+			let theoretical_pmmr_size =
+				SegmentIdentifier::pmmr_size(cur_segment_count, self.default_kernel_segment_height);
+			if local_kernel_mmr_size < theoretical_pmmr_size {
+				debug!(
+					"theoretical_pmmr_size {} is bigger than the current mmr size {}",
+					theoretical_pmmr_size, local_kernel_mmr_size
+				);
+				cur_segment_count -= 1;
+			}
+		}
+
 		trace!(
 			"Next required kernel segment is {} of {}",
 			cur_segment_count,
```

---

### Incident Patch 15: `41e50cda` (2026-03-08)
**Commit Message**: Fix macOS x86 release workflow

**File**: `.github/workflows/cd.yaml` (modified, +5/-5)
```diff
@@ -29,7 +29,7 @@ jobs:
 
     macos-release-x86:
         name: macOS Release - x86_64
-        runs-on: macos-latest
+        runs-on: macos-15-intel
         steps:
           - name: Install Rust Target
             run: rustup target add x86_64-apple-darwin
@@ -38,17 +38,17 @@ jobs:
           - name: Build
             run: cargo build --release --target x86_64-apple-darwin
           - name: Archive
-            working-directory: target/release
+            working-directory: target/x86_64-apple-darwin/release
             run: tar -czvf grin-${{  github.ref_name }}-macos-x86_64.tar.gz grin
           - name: Create Checksum
-            working-directory: target/release
+            working-directory: target/x86_64-apple-darwin/release
             run: openssl sha256 grin-${{  github.ref_name }}-macos-x86_64.tar.gz > grin-${{  github.ref_name }}-macos-x86_64-sha256sum.txt
           - name: Release
             uses: softprops/action-gh-release@v1
             with:
                 files: |
-                    target/release/grin-${{  github.ref_name }}-macos-x86_64.tar.gz
-                    target/release/grin-${{  github.ref_name }}-macos-x86_64-sha256sum.txt
+                    target/x86_64-apple-darwin/release/grin-${{  github.ref_name }}-macos-x86_64.tar.gz
+                    target/x86_64-apple-darwin/release/grin-${{  github.ref_name }}-macos-x86_64-sha256sum.txt
 
     macos-release-arm64:
         name: macOS Release - arm64
```

#### Recent Merged Pull Requests:
- **PR #3937** (2026-09-16): Merge master to staging (@ardocrat)
- **PR #3936** (closed): Update staging branch from master (@ardocrat)
- **PR #3935** (2026-09-15): Make tx-related constants public (@ardocrat)
- **PR #3932** (2026-09-24): Fix PIBD resume stall with newer archive target (@wiesche89)
- **PR #3924** (2026-08-11): Release v5.5.1 (@ardocrat)
- **PR #3923** (closed): Release 5.5.1 (@ardocrat)
- **PR #3922** (2026-07-30): Get read limit from reader (@ardocrat)
- **PR #3921** (closed): Deserialize without limits (@ardocrat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
