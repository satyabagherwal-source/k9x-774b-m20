# Forensic Learning Record (Deep Inspection): RustCrypto/hashes

> **Canonical Artifact**: `07_PROJECT_LEARNING/rustcrypto-hashes-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RustCrypto/hashes](https://github.com/RustCrypto/hashes))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:41:08.000Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RustCrypto/hashes`
- **Description**: Collection of cryptographic hash functions written in pure Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2270 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `kupyna/src/utils.rs`
```
use core::array;

#[inline(always)]
pub(crate) fn xor<const N: usize>(a: [u64; N], b: [u64; N]) -> [u64; N] {
    let mut result = [0u64; N];
    for i in 0..N {
        result[i] = a[i] ^ b[i];
    }
    result
}

#[inline(always)]
pub(crate) fn read_u64_le<const N: usize, const M: usize>(src: &[u8; N]) -> [u64; M] {
    assert_eq!(N, 8 * M);
    let mut res = [0; M];
    for (src, dst) in src.chunks_exact(8).zip(res.iter_mut()) {
        *dst = u64::from_le_bytes(src.try_into().unwrap());
    }
    res
}

#[inline(always)]
pub(crate) fn write_u64_le(src: &[u64], dst: &mut [u8]) {
    assert_eq!(8 * src.len(), dst.len());
    for (src, dst) in src.iter().zip(dst.chunks_exact_mut(8)) {
        dst.copy_from_slice(&src.to_le_bytes())
    }
}

#[inline(always)]
pub(crate) fn write_u64_be(src: &[u64], dst: &mut [u8]) {
    assert_eq!(8 * src.len(), dst.len());
    for (src, dst) in src.iter().zip(dst.chunks_exact_mut(8)) {
        dst.copy_from_slice(&src.to_be_bytes())
    }
}

#[inline(always)]
pub(crate) fn read_u64s_be<const N: usize, const M: usize>(block: &[u8; N]) -> [u64; M] {
    array::from_fn(|i| {
        let chunk = block[8 * i..][..8].try_into().unwrap();
        u64::from_be_bytes(chunk)
    })
}

```

### Core Architecture Module: `sha3/src/utils.rs`
```
use keccak::State1600;
use sponge_cursor::SpongeCursor;

#[inline(always)]
pub(crate) fn pad<const PAD: u8, const RATE: usize>(
    state: &mut State1600,
    cursor: &SpongeCursor<RATE>,
) {
    let pos = cursor.pos();
    let word_offset = pos / 8;
    let byte_offset = pos % 8;

    let pad = u64::from(PAD) << (8 * byte_offset);
    state[word_offset] ^= pad;
    state[RATE / 8 - 1] ^= 1 << 63;
}

#[inline(always)]
pub(crate) fn read_state(state: &State1600, dst: &mut [u8]) {
    assert!(size_of_val(dst) <= size_of_val(state));

    let chunks = dst.chunks_mut(size_of::<u64>());
    for (src, dst) in state.iter().zip(chunks) {
        dst.copy_from_slice(&src.to_le_bytes()[..dst.len()]);
    }
}

#[inline(always)]
pub(crate) fn serialize<const RATE: usize>(
    state: &State1600,
    cursor: &SpongeCursor<RATE>,
) -> [u8; 201] {
    let mut ser_state = [0u8; 201];
    // TODO(MSRV-1.88): use `ser_state.as_chunks_mut()`
    let [state_dst @ .., cursor_dst] = &mut ser_state;

    let state_dst_chunks = state_dst.chunks_exact_mut(size_of::<u64>());
    for (src, dst) in state.iter().zip(state_dst_chunks) {
        dst.copy_from_slice(&src.to_le_bytes());
    }

    *cursor_dst = cursor.raw_pos();
    ser_state
}

#[inline(always)]
pub(crate) fn deserialize<const RATE: usize>(
    ser_state: &[u8; 201],
) -> Option<(State1600, SpongeCursor<RATE>)> {
    // TODO(MSRV-1.88): use `ser_state.as_chunks()`
    let [state_src @ .., cursor_src] = ser_state;

    let n = size_of::<u64>();
    let state = core::array::from_fn(|i| {
        let chunk = state_src[n * i..][..n]
            .try_into()
            .expect("chunk has correct length");
        u64::from_le_bytes(chunk)
    });

    let cursor = SpongeCursor::new(*cursor_src)?;
    Some((state, cursor))
}

```

### Core Architecture Module: `ascon-hash256/benches/mod.rs`
```
#![feature(test)]
extern crate test;

use digest::bench_update;
use test::Bencher;

bench_update!(
    ascon_hash256::AsconHash256::default();
    ascon_hash256_10 10;
    ascon_hash256_100 100;
    ascon_hash256_1000 1000;
    ascon_hash256_10000 10000;
);

```

### Core Architecture Module: `ascon-hash256/src/block_api.rs`
```
use ascon::State;
use digest::{
    HashMarker, Output, OutputSizeUser, Reset,
    block_api::{
        AlgorithmName, Block, BlockSizeUser, Buffer, BufferKindUser, Eager, FixedOutputCore,
        UpdateCore,
    },
    common::hazmat::{DeserializeStateError, SerializableState, SerializedState},
    consts::{U8, U32, U40},
};

const IV: u64 = 0x0000_0801_00CC_0002;

/// Initial state of Ascon-Hash256
const INIT_STATE: State = {
    let mut state = [IV, 0, 0, 0, 0];
    ascon::permute12(&mut state);
    state
};

/// Ascon-Hash256 block-level hasher
#[derive(Clone, Debug)]
pub struct AsconHash256Core {
    state: State,
}

impl Default for AsconHash256Core {
    #[inline]
    fn default() -> Self {
        Self { state: INIT_STATE }
    }
}

impl HashMarker for AsconHash256Core {}

impl BlockSizeUser for AsconHash256Core {
    type BlockSize = U8;
}

impl BufferKindUser for AsconHash256Core {
    type BufferKind = Eager;
}

impl OutputSizeUser for AsconHash256Core {
    type OutputSize = U32;
}

impl UpdateCore for AsconHash256Core {
    #[inline]
    fn update_blocks(&mut self, blocks: &[Block<Self>]) {
        for block in blocks {
            self.state[0] ^= u64::from_le_bytes(block.0);
            ascon::permute12(&mut self.state);
        }
    }
}

impl FixedOutputCore for AsconHash256Core {
    #[inline]
    fn finalize_fixed_core(&mut self, buffer: &mut Buffer<Self>, out: &mut Output<Self>) {
        let len = buffer.get_pos();
        let last_block = buffer.pad_with_zeros();
        let pad = 1u64 << (8 * len);
        self.state[0] ^= u64::from_le_bytes(last_block.0) ^ pad;

        ascon::permute12(&mut self.state);

        let mut chunks = out.chunks_exact_mut(size_of::<u64>());
        for chunk in &mut chunks {
            chunk.copy_from_slice(&self.state[0].to_le_bytes());
            ascon::permute12(&mut self.state);
        }
        assert!(chunks.into_remainder().is_empty());
    }
}

impl Reset for AsconHash256Core {
    #[inline]
    fn reset(&mut self) {
        self.state = INIT_STATE;
    }
}

impl AlgorithmName for AsconHash256Core {
    #[inline]
    fn write_alg_name(f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("Ascon-Hash256")
    }
}

impl SerializableState for AsconHash256Core {
    type SerializedStateSize = U40;

    #[inline]
    fn serialize(&self) -> SerializedState<Self> {
        let mut res = SerializedState::<Self>::default();
        let mut chunks = res.chunks_exact_mut(size_of::<u64>());
        for (src, dst) in self.state.iter().zip(&mut chunks) {
            dst.copy_from_slice(&src.to_le_bytes());
        }
        assert!(chunks.into_remainder().is_empty());
        res
    }

    #[inline]
    fn deserialize(
        serialized_state: &SerializedState<Self>,
    ) -> Result<Self, DeserializeStateError> {
        let state = core::array::from_fn(|i| {
            let n = size_of::<u64>();
            let chunk = &serialized_state[n * i..][..n];
            u64::from_le_bytes(chunk.try_into().expect("chunk has correct length"))
        });
        Ok(Self { state })
    }
}

impl Drop for AsconHash256Core {
    #[inline]
    fn drop(&mut self) {
        #[cfg(feature = "zeroize")]
        {
            use digest::zeroize::Zeroize;
            self.state.zeroize()
        }
    }
}

#[cfg(feature = "zeroize")]
impl digest::zeroize::ZeroizeOnDrop for AsconHash256Core {}

```

### Core Architecture Module: `ascon-hash256/src/lib.rs`
```
#![no_std]
#![doc = include_str!("../README.md")]
#![doc(
    html_logo_url = "https://raw.githubusercontent.com/RustCrypto/meta/master/logo.svg",
    html_favicon_url = "https://raw.githubusercontent.com/RustCrypto/meta/master/logo.svg"
)]
#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(missing_docs, unreachable_pub)]
#![forbid(unsafe_code)]

pub use digest::{self, Digest};

/// Block-level types
pub mod block_api;

digest::buffer_fixed!(
    /// Ascon-Hash256 hasher
    pub struct AsconHash256(block_api::AsconHash256Core);
    impl: FixedHashTraits;
);

```

### Core Architecture Module: `bash-hash/benches/mod.rs`
```
#![feature(test)]
extern crate test;

use bash_hash::{BashHash256, BashHash384, BashHash512};
use digest::bench_update;
use test::Bencher;

bench_update!(
    BashHash256::default();
    bash_hash256_10 10;
    bash_hash256_100 100;
    bash_hash256_1000 1000;
    bash_hash256_10000 10000;
);

bench_update!(
    BashHash384::default();
    bash_hash384_10 10;
    bash_hash384_100 100;
    bash_hash384_1000 1000;
    bash_hash384_10000 10000;
);

bench_update!(
    BashHash512::default();
    bash_hash512_10 10;
    bash_hash512_100 100;
    bash_hash512_1000 1000;
    bash_hash512_10000 10000;
);

```

### Core Architecture Module: `bash-hash/src/block_api.rs`
```
use core::{fmt, marker::PhantomData};
use digest::{
    HashMarker, Output,
    block_api::{
        AlgorithmName, Block, BlockSizeUser, Buffer, BufferKindUser, Eager, FixedOutputCore,
        OutputSizeUser, Reset, UpdateCore,
    },
    common::hazmat::{DeserializeStateError, SerializableState, SerializedState},
    typenum::U192,
};

use crate::OutputSize;
use bash_f::{STATE_WORDS, bash_f};

/// Core `bash-hash` hasher generic over output size.
///
/// Specified in Section 7 of STB 34.101.77-2020.
pub struct BashHashCore<OS: OutputSize> {
    state: [u64; STATE_WORDS],
    _pd: PhantomData<OS>,
}

impl<OS: OutputSize> Clone for BashHashCore<OS> {
    #[inline]
    fn clone(&self) -> Self {
        Self {
            state: self.state,
            _pd: PhantomData,
        }
    }
}

impl<OS: OutputSize> BashHashCore<OS> {
    /// Compress one data block
    fn compress_block(&mut self, block: &Block<Self>) {
        // 4.1: S[...1536 - 4ℓ) ← Xi
        // TODO: use `as_chunks` after MSRV is bumped to 1.88+
        for (dst, chunk) in self.state.iter_mut().zip(block.chunks_exact(8)) {
            // `chunk` is guaranteed to be 8 bytes long due to `r_bytes` being a multiple of 8
            *dst = u64::from_le_bytes(chunk.try_into().unwrap());
        }

        // 4.2: S ← bash-f(S)
        bash_f(&mut self.state);
    }
}

impl<OS: OutputSize> HashMarker for BashHashCore<OS> {}

impl<OS: OutputSize> BlockSizeUser for BashHashCore<OS> {
    type BlockSize = OS::BlockSize;
}

impl<OS: OutputSize> BufferKindUser for BashHashCore<OS> {
    type BufferKind = Eager;
}

impl<OS: OutputSize> OutputSizeUser for BashHashCore<OS> {
    type OutputSize = OS;
}

impl<OS: OutputSize> UpdateCore for BashHashCore<OS> {
    #[inline]
    fn update_blocks(&mut self, blocks: &[Block<Self>]) {
        for block in blocks {
            self.compress_block(block);
        }
    }
}

impl<OS: OutputSize> FixedOutputCore for BashHashCore<OS> {
    fn finalize_fixed_core(&mut self, buffer: &mut Buffer<Self>, out: &mut Output<Self>) {
        // 1. Split(X || 01, r) - split message with appended 01
        // 2: Xn ← Xn || 0^(1536-4ℓ-|Xn|) - pad last block with zeros
        let pos = buffer.get_pos();
        let mut block = buffer.pad_with_zeros();
        block[pos] = 0x40;

        // 4. for i = 1, 2, ..., n, do:
        self.compress_block(&block);

        // 5. Y ← S[...2ℓ)
        // TODO: use `as_chunks` after MSRV is bumped to 1.88+
        for (src, dst) in self.state.iter().zip(out.chunks_exact_mut(8)) {
            dst.copy_from_slice(&src.to_le_bytes());
        }
    }
}

impl<OS: OutputSize> Default for BashHashCore<OS> {
    #[inline]
    fn default() -> Self {
        let mut state = [0u64; STATE_WORDS];

        // 3. ℓ ← OutSize * 8 / 2
        let level = OS::USIZE * 4;
        // 3. S ← 0^1472 || ⟨ℓ/4⟩_64
        state[23] = (level / 4) as u64;

        Self {
            state,
            _pd: PhantomData,
        }
    }
}

impl<OS: OutputSize> Reset for BashHashCore<OS> {
    #[inline]
    fn reset(&mut self) {
        *self = Default::default();
    }
}

impl<OS: OutputSize> AlgorithmName for BashHashCore<OS> {
    fn write_alg_name(f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "BashHash{}", OS::USIZE * 8)
    }
}

impl<OS: OutputSize> fmt::Debug for BashHashCore<OS> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("BashHashCore { ... }")
    }
}

impl<OS: OutputSize> Drop for BashHashCore<OS> {
    fn drop(&mut self) {
        #[cfg(feature = "zeroize")]
        {
            use digest::zeroize::Zeroize;
            self.state.zeroize();
        }
    }
}

#[cfg(feature = "zeroize")]
impl<OS: OutputSize> digest::zeroize::ZeroizeOnDrop for BashHashCore<OS> {}

impl<OS: OutputSize> SerializableState for BashHashCore<OS> {
    type SerializedStateSize = U192;

    fn serialize(&self) -> SerializedState<Self> {
        let mut res = SerializedState::<Self>::default();
        // TODO: use `as_chunks` after MSRV is bumped to 1.88+
        for (src, dst) in self.state.iter().zip(res.chunks_exact_mut(8)) {
            dst.copy_from_slice(&src.to_le_bytes());
        }
        res
    }

    fn deserialize(
        serialized_state: &SerializedState<Self>,
    ) -> Result<Self, DeserializeStateError> {
        let mut state = [0u64; STATE_WORDS];
        // TODO: use `as_chunks` after MSRV is bumped to 1.88+
        for (src, dst) in serialized_state.chunks_exact(8).zip(state.iter_mut()) {
            *dst = u64::from_le_bytes(src.try_into().unwrap());
        }
        Ok(Self {
            state,
            _pd: PhantomData,
        })
    }
}

```

### Core Architecture Module: `bash-hash/src/lib.rs`
```
#![no_std]
#![doc = include_str!("../README.md")]
#![doc(
    html_logo_url = "https://raw.githubusercontent.com/RustCrypto/media/6ee8e381/logo.svg",
    html_favicon_url = "https://raw.githubusercontent.com/RustCrypto/media/6ee8e381/logo.svg"
)]
#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(missing_docs, unreachable_pub)]
#![forbid(unsafe_code)]

use digest::typenum::{U32, U48, U64};
pub use digest::{self, Digest};

/// Block-level types
pub mod block_api;
#[cfg(feature = "oid")]
mod oids;
mod serialize;
mod variants;

pub use variants::OutputSize;

digest::buffer_fixed!(
    /// `bash-hash` hasher state generic over output size.
    pub struct BashHash<OS: OutputSize>(block_api::BashHashCore<OS>);
    // note: `SerializableState` is implemented in the `serialize` module
    // to work around issues with complex trait bounds
    impl: BaseFixedTraits AlgorithmName Default Clone HashMarker
        Reset FixedOutputReset ZeroizeOnDrop;
);

/// `bash-hash-256` hasher state.
pub type BashHash256 = BashHash<U32>;
/// `bash-hash-384` hasher state.
pub type BashHash384 = BashHash<U48>;
/// `bash-hash-512` hasher state.
pub type BashHash512 = BashHash<U64>;

```

### Core Architecture Module: `bash-hash/src/oids.rs`
```
use digest::const_oid::{AssociatedOid, ObjectIdentifier};

impl AssociatedOid for super::BashHash256 {
    const OID: ObjectIdentifier = ObjectIdentifier::new_unwrap("1.2.112.0.2.0.34.101.77.11");
}

impl AssociatedOid for super::BashHash384 {
    const OID: ObjectIdentifier = ObjectIdentifier::new_unwrap("1.2.112.0.2.0.34.101.77.12");
}

impl AssociatedOid for super::BashHash512 {
    const OID: ObjectIdentifier = ObjectIdentifier::new_unwrap("1.2.112.0.2.0.34.101.77.13");
}

```

### Core Architecture Module: `bash-hash/src/serialize.rs`
```
use crate::{BashHash, OutputSize};
use core::ops::Add;
use digest::{
    array::ArraySize,
    block_buffer::BlockBuffer,
    common::hazmat::{DeserializeStateError, SerializableState, SerializedState},
    typenum::{Sum, U0, U192},
};

impl<OS: OutputSize> SerializableState for BashHash<OS>
where
    U192: Add<OS::BlockSize>,
    OS::BlockSize: Add<U0>,
    Sum<U192, OS::BlockSize>: ArraySize,
    Sum<OS::BlockSize, U0>: ArraySize,
{
    type SerializedStateSize = Sum<U192, OS::BlockSize>;

    #[inline]
    fn serialize(&self) -> SerializedState<Self> {
        let mut res = SerializedState::<Self>::default();
        let (core_dst, buf_dst) = res.split_at_mut(192);
        core_dst.copy_from_slice(&self.core.serialize());
        buf_dst.copy_from_slice(&self.buffer.serialize());
        res
    }

    #[inline]
    fn deserialize(
        serialized_state: &SerializedState<Self>,
    ) -> Result<Self, DeserializeStateError> {
        let (serialized_core, serialized_buf) = serialized_state.split_at(192);

        let core = SerializableState::deserialize(serialized_core.try_into().unwrap())?;
        let buffer = BlockBuffer::deserialize(serialized_buf.try_into().unwrap())
            .map_err(|_| DeserializeStateError)?;

        Ok(Self { core, buffer })
    }
}

```

### Core Architecture Module: `bash-hash/src/variants.rs`
```
use digest::{array::ArraySize, block_buffer::BlockSizes, typenum};

/// Sealed trait to prevent external implementations.
pub trait Sealed {}

/// Trait implemented for output sizes supported by `bash-hash`.
///
/// Supported output sizes form the following list: U4, U8, ..., U60, U64.
pub trait OutputSize: ArraySize + Sealed {
    /// Block size in bytes computed as `192 - 2 * OutputSize`.
    type BlockSize: BlockSizes;
}

macro_rules! impl_sizes {
    ($($variant:ident, $block_size:ident;)*) => {
        $(
            impl Sealed for typenum::$variant {}

            impl OutputSize for typenum::$variant {
                type BlockSize = typenum::$block_size;
            }
        )*
    };
}

impl_sizes!(
    U4,  U184;
    U8,  U176;
    U12, U168;
    U16, U160;
    U20, U152;
    U24, U144;
    U28, U136;
    U32, U128;
    U36, U120;
    U40, U112;
    U44, U104;
    U48, U96;
    U52, U88;
    U56, U80;
    U60, U72;
    U64, U64;
);

```

### Core Architecture Module: `belt-hash/benches/mod.rs`
```
#![feature(test)]
extern crate test;

use belt_hash::BeltHash;
use digest::bench_update;
use test::Bencher;

bench_update!(
    BeltHash::default();
    belt_hash_10 10;
    belt_hash_100 100;
    belt_hash_1000 1000;
    belt_hash_10000 10000;
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #681** (2025-05-26): **Skein256/224 and Skein512/224 are invalid**
  *Symptoms*: ```rust use skein::{consts::U28, Digest, Skein256, Skein512}; fn main() {     println!("{:x}", Skein256::<U28>::digest(""));     println!("{:x}", Skein512::<U28>::digest(""));      // Output:     // 0fadf1fa39e3837a95b3660b4184d9c2f3cfc94b55d8e7a000000000     // 1541ae9fc3ebe24eb758ccb1fd60c2c31a9ebfe65b22008600000000 } ``` Note the trailing zeros.
  **Post-Mortem & Fix Analysis**:
  > You are right. The problem is with [these lines](https://github.com/RustCrypto/hashes/blob/0b22f1004e7840c32c52305a2fb9cf8cbd486573/skein/src/lib.rs#L128-L130). We should either use `chunks_mut` there instead of `chunks_mut_exact`, or should properly handle the remainder.  We probably will fix it in the next breakin release and will yank the older versions after that.
  > Skein1024/224 is affected as well if anyone uses it.
  > I have released skein v0.1.1 with the fix and yanked v0.1.0. I will leave this issue open for now since we also need to forward port the fix to the master branch.

- **Issue #356** (2022-02-18): **blake2b gives a wrong value on powerpc-unknown-linux-gnu**
  *Symptoms*: In [xmpp-rs](https://xmpp.rs), we have [a test](https://gitlab.com/xmpp-rs/xmpp-rs/-/blob/main/parsers/src/ecaps2.rs#L469) which started to fail on this platform [after bumping the RustCrypto crates to 0.10](https://gitlab.com/xmpp-rs/xmpp-rs/-/commit/1a03588bdbac685d4e0c0ecf17f6fd8888569d41):  ```rust ---- ecaps2::tests::test_blake2b_512 stdout ---- thread 'main' panicked at 'assertion failed: `(left == right)`   left: `[107, 235, 164, 173, 234, 235, 170, 225, 55, 10, 138, 151, 244, 209, 149, 32, 75, 79, 184, 110, 158, 195, 195, 113, 25, 50, 170, 193, 54, 212, 114, 249, 126, 45, 33, 153, 72, 91, 165, 232, 190, 247, 148, 234, 206, 56, 34, 151, 206, 131, 216, 50, 100, 195, 84, 131, 143, 218, 125, 57, 112, 138, 100, 98]`,  right: `[186, 128, 165, 63, 152, 28, 77, 13, 106, 39, 151, 182, 159, 18, 246, 233, 76, 33, 47, 20, 104, 90, 196, 183, 75, 18, 187, 111, 219, 255, 162, 209, 125, 135, 197, 57, 42, 171, 121, 45, 194, 82, 213, 222, 69, 51, 204, 149, 24, 211, 138, 168, 219, 241, 146, 90, 185, 35, 134, 237, 212, 0, 153, 35]`', parsers/src/ecaps2.rs:479:9 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace ```  The same test runs fine on amd64, as can be seen in our CI.
  **Post-Mortem & Fix Analysis**:
  > It seems we don't `cross`-test `blake2b` like we do other crates like `sha2` and `sha3`, so it seems possible there might be an endianness-related (or other) bug
  > I tested on armv7-unknown-linux-gnueabihf as well, as an architecture which is 32-bit, it returns the correct result, so the issue really seems to be big endian.
  > Have you tried implementation from the `blake2b_simd`/`blake2s_simd` crates? We plan to eventually [migrate](https://github.com/RustCrypto/hashes/pull/228) the current implementation of `blake2` to one based on them.

- **Issue #54** (2018-05-15): **Link error in SHA2 with asm on macOS**
  *Symptoms*: When I compile `sha2` version 0.7.1 with the `asm` feature enabled, I get the following link error:  ```   = note: Undefined symbols for architecture x86_64:             "_sha512_compress", referenced from:                 sha2_asm::compress512::h2714fa0e6f190002 in libsha2-128ed50e2e0d1cae.rlib(sha2-128ed50e2e0d1cae.sha214.rcgu.o)           ld: symbol(s) not found for architecture x86_64           clang: error: linker command failed with exit code 1 (use -v to see invocation) ```  This is on macOS 10.13.4 with Rust 1.26.  To reproduce, run `cargo new --bin test_sha2` and then edit the following files:  `Cargo.toml`:  ``` [package] name = "test_sha2" version = "0.1.0"  [dependencies] sha2 = { version = "0.7", features = ["asm"] } ```  `src/main.rs`:  ``` extern crate sha2;  use sha2::{Sha512Trunc256, Digest};  fn main() {     let mut hasher = Sha512Trunc256::new();     let data = b"Hello world!";     hasher.input(data);     // `input` can be called repeatedly     hasher.input("String data".as_bytes());     // Note that calling `result()` consumes hasher     let hash = hasher.result();     println!("Result: {:x}", hash); } ```
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this!  It seems there is a problem with [`sha2-asm`](https://github.com/RustCrypto/asm-hashes/tree/master/sha2) build script. Unfortunately I currently don't have macOS to work on it, so I hope someone will help with it.
  > Please see https://github.com/RustCrypto/asm-hashes/pull/4 for a fix.
  > I've published updates to crates.io, so `cargo update` should solve the problem.

- **Issue #42** (2017-11-17): **Using XofReader**
  *Symptoms*: Hi, Am I using the `XofReader` (`Sha3XofReader`) incorrectly? I was assuming that each call to `XofReader::read(...)` would extend the previous values.  For example, the following:  ```rust extern crate digest; extern crate sha3;  use digest::{Input, ExtendableOutput ,XofReader}; use sha3::Shake256;  fn main() {     let mut hasher = Shake256::default();     hasher.process(b"some nice randomness here");     let mut xof = hasher.xof_result();      let mut buf = [0; 4];      for _ in 0..5 {         xof.read(&mut buf);         println!("{:?}", buf);     } } ``` Repeatedly returns the same values. ``` [27, 145, 10, 182] [27, 145, 10, 182] [27, 145, 10, 182] [27, 145, 10, 182] [27, 145, 10, 182] ```  (Sorry if this is better placed in https://github.com/RustCrypto/traits, I figured it's probably an implementation bug, unless I've done something stupid.)
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this!  It looks like a bug in `Sha3XofReader` implementation. I'll try to fix it today or tomorrow.
  > This bug should be fixed in the sha3 v0.7.1.
  > Awesome, works perfectly. Thanks!

- **Issue #41** (2017-11-02): **Groestl works incorrectly on big-endian architecture**
  *Symptoms*: [See](https://travis-ci.org/RustCrypto/hashes/builds/295647490) results of CI testing.

- **Issue #36** (2017-08-13): **Libraries which use `constant_time_eq` are not `no_std`**
  *Symptoms*: Hi,  Any library which uses the `constant_time_eq` crate is not `no_std`. The [source](https://github.com/cesarb/constant_time_eq/blob/master/src/lib.rs) does not have a `#![no_std]` annotation.
  **Post-Mortem & Fix Analysis**:
  > Thank you for noticing this!  Quite unfortunately Rust does not [automatically detect](https://github.com/rust-lang/rust/issues/38509) such kind of oversights. If @cesarb will not accept your PR in the following days, I'll make a change to `crypto-mac` crate. For now you could try to use [`[replace]`](http://doc.crates.io/manifest.html#the-replace-section) section in your `Cargo.toml` to override `constant_time_eq` to your modified version.
  > I agree, figuring out which dependency is pulling in `std` is currently a rather cumbersome process. Hopefully @cesarb will accept the PR quickly!  In the meanwhile, I use [this `serde` test](https://github.com/serde-rs/serde/tree/master/test_suite/no_std) for checking if a crate is truly `no_std`. Perhaps you can add this to your test suite and/or CI?  EDIT: I notice you mentioned changing `crypto-mac`, but `blake2` also uses `constant_time_eq`. It's what I was using.
  > `blake2` [does not use](https://github.com/RustCrypto/hashes/blob/master/blake2/Cargo.toml) `constant_time_eq` directly, but through [`crypto-mac`](https://github.com/RustCrypto/traits/blob/master/crypto-mac/Cargo.toml) crate.  As for tests, as I understand `serde` test works only on nightly, so to add this test we'll need to use a bit more complex `.travis.yml` than we have now. For now I will create an issue for that.

- **Issue #33** (2017-07-24): **digest_reader incorrect behaviour on short read **
  *Symptoms*: in digest/src/digest.rs line 72      if bytes_read != buffer.len() {  that will terminate on short read, which breaks with asynchronous Read, which may not have the full buffer at the current time, but will have more later. it should terminate when bytes_read == 0 instead (EOF)  see https://doc.rust-lang.org/std/io/trait.Read.html#tymethod.read
  **Post-Mortem & Fix Analysis**:
  > Thank you for noticing this! I will publish update immediately.

- **Issue #28** (2017-11-15): **VariableOutput implementation is incorrect for BLAKE2**
  *Symptoms*: As was [noticed](https://github.com/RustCrypto/hashes/pull/17#issuecomment-308660800) by @Ralith `VariableOutput` is currently incorrectly implemented for BLAKE2, as output size must be included in the parameters block.
  **Post-Mortem & Fix Analysis**:
  > Any updates? This is a severe bug that produces incorrect hash values, and presumably also requires breaking changes to the API.
  > `blake2` code needs a bit of cleanup and `digest` traits will need a small rework. Unfortunately last month I couldn't allocate enough time to work on it. For now I think I will simply remove `VariableOutput` implementation for `blake2` and will yank `v0.6.0`.
  > I've fixed `VariableOutput` implementation in v0.7. Now it produces the same results as pre-rework implementation.

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

### Incident Patch 1: `7c32a0da` (2026-07-10)
**Commit Message**: jh: add long-input regression tests (#894)

**File**: `jh/tests/mod.rs` (modified, +47/-1)
```diff
@@ -1,4 +1,9 @@
-use digest::{dev::fixed_test, hash_serialization_test, new_test};
+use digest::{
+    Digest,
+    dev::{feed_rand_16mib, fixed_test},
+    hash_serialization_test, new_test,
+};
+use hex_literal::hex;
 
 new_test!(jh224_long_kat, jh::Jh224, fixed_test);
 new_test!(jh256_long_kat, jh::Jh256, fixed_test);
@@ -14,3 +19,44 @@ hash_serialization_test!(jh224_serialization, jh::Jh224);
 hash_serialization_test!(jh256_serialization, jh::Jh256);
 hash_serialization_test!(jh384_serialization, jh::Jh384);
 hash_serialization_test!(jh512_serialization, jh::Jh512);
+
+macro_rules! test_jh_rand {
+    ($name:ident, $hasher:ty, $expected:expr) => {
+        #[test]
+        fn $name() {
+            let mut h = <$hasher>::new();
+            feed_rand_16mib(&mut h);
+            assert_eq!(&h.finalize()[..], &$expected[..]);
+        }
+    };
+}
+
+test_jh_rand!(
+    jh224_rand,
+    jh::Jh224,
+    hex!("7a4e35b939ccbf71d7bc8243e87871d0891a845d09197ac4a0bc3af1")
+);
+
+test_jh_rand!(
+    jh256_rand,
+    jh::Jh256,
+    hex!("553d2d32bea1224d56e59df45d07f8b464535154e702119d90a23510d7489f5e")
+);
+
+test_jh_rand!(
+    jh384_rand,
+    jh::Jh384,
+    hex!(
+        "ba049c6c00f8ef651861db921588b41d8d6ce3faf94c2ffb1bdbf91cefcac6d2"
+        "f5d5510cb1b3e94ba529fb6a9e29a8e5"
+    )
+);
+
+test_jh_rand!(
+    jh512_rand,
+    jh::Jh512,
+    hex!(
+        "692b44c9fa2c3982060c85cbcdfde6015ade526ef6aad5218ed8d1cdcb42f389"
+        "6e21a345db74c83faa042ef4f996cf5e8478dcd3f03b87025bd3edc78beab126"
+    )
+);
```

---

### Incident Patch 2: `947dfc52` (2026-06-24)
**Commit Message**: bash-hash: fix package metadata and README links (#886)

**File**: `bash-hash/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -5,6 +5,12 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## 0.1.1 (UNRELEASED)
+### Fixed
+- Package metadata and README links ([#886])
+
+[#886]: https://github.com/RustCrypto/hashes/pull/886
+
 ## 0.1.0 (2026-03-27)
 - Initial release ([#745])
 
```

**File**: `bash-hash/Cargo.toml` (modified, +2/-2)
```diff
@@ -4,11 +4,11 @@ version = "0.1.0"
 authors = ["RustCrypto Developers"]
 edition = "2024"
 rust-version = "1.85"
-documentation = "https://docs.rs/belt-hash"
+documentation = "https://docs.rs/bash-hash"
 readme = "README.md"
 repository = "https://github.com/RustCrypto/hashes"
 license = "MIT OR Apache-2.0"
-keywords = ["belt", "stb", "hash", "digest"]
+keywords = ["stb", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 description = "bash hash function (STB 34.101.77-2020)"
 
```

**File**: `bash-hash/README.md` (modified, +6/-6)
```diff
@@ -40,16 +40,16 @@ dual licensed as above, without any additional terms or conditions.
 
 [//]: # (badges)
 
-[crate-image]: https://img.shields.io/crates/v/belt-hash.svg
-[crate-link]: https://crates.io/crates/belt-hash
-[docs-image]: https://docs.rs/belt-hash/badge.svg
-[docs-link]: https://docs.rs/belt-hash
+[crate-image]: https://img.shields.io/crates/v/bash-hash.svg
+[crate-link]: https://crates.io/crates/bash-hash
+[docs-image]: https://docs.rs/bash-hash/badge.svg
+[docs-link]: https://docs.rs/bash-hash
 [license-image]: https://img.shields.io/badge/license-Apache2.0/MIT-blue.svg
 [rustc-image]: https://img.shields.io/badge/rustc-1.85+-blue.svg
 [chat-image]: https://img.shields.io/badge/zulip-join_chat-blue.svg
 [chat-link]: https://rustcrypto.zulipchat.com/#narrow/stream/260041-hashes
-[build-image]: https://github.com/RustCrypto/hashes/actions/workflows/belt-hash.yml/badge.svg?branch=master
-[build-link]: https://github.com/RustCrypto/hashes/actions/workflows/belt-hash.yml?query=branch:master
+[build-image]: https://github.com/RustCrypto/hashes/actions/workflows/bash-hash.yml/badge.svg?branch=master
+[build-link]: https://github.com/RustCrypto/hashes/actions/workflows/bash-hash.yml?query=branch:master
 
 [//]: # (general links)
 
```

---

### Incident Patch 3: `5d6d720b` (2026-05-13)
**Commit Message**: cshake: fix `documentation` and `keywords` fields in Cargo.toml (#870)

**File**: `cshake/Cargo.toml` (modified, +2/-2)
```diff
@@ -4,11 +4,11 @@ version = "0.2.0"
 authors = ["RustCrypto Developers"]
 edition = "2024"
 rust-version = "1.85"
-documentation = "https://docs.rs/sha3"
+documentation = "https://docs.rs/cshake"
 readme = "README.md"
 repository = "https://github.com/RustCrypto/hashes"
 license = "MIT OR Apache-2.0"
-keywords = ["sha3", "keccak", "hash", "xof", "digest"]
+keywords = ["keccak", "hash", "xof", "digest"]
 categories = ["cryptography", "no-std"]
 description = "Implementation of the cSHAKE family of extendable-output functions (XOFs)"
 
```

---

### Incident Patch 4: `ca9d1184` (2026-05-12)
**Commit Message**: Fix security level emojis

**File**: `README.md` (modified, +2/-2)
```diff
@@ -42,8 +42,8 @@ easily used for bare-metal or WebAssembly programming by disabling default crate
 | [Skein] | [`skein`] | [![crates.io](https://img.shields.io/crates/v/skein.svg)](https://crates.io/crates/skein) | [![Documentation](https://docs.rs/skein/badge.svg)](https://docs.rs/skein) | 1.85 | :green_heart: |
 | [SM3] (OSCCA GM/T 0004-2012) | [`sm3`] | [![crates.io](https://img.shields.io/crates/v/sm3.svg)](https://crates.io/crates/sm3) | [![Documentation](https://docs.rs/sm3/badge.svg)](https://docs.rs/sm3) | 1.85 | :green_heart: |
 | [Streebog] (GOST R 34.11-2012) | [`streebog`] | [![crates.io](https://img.shields.io/crates/v/streebog.svg)](https://crates.io/crates/streebog) | [![Documentation](https://docs.rs/streebog/badge.svg)](https://docs.rs/streebog) | 1.85 | :yellow_heart: |
-| [Tiger] | [`tiger`] | [![crates.io](https://img.shields.io/crates/v/tiger.svg)](https://crates.io/crates/tiger) | [![Documentation](https://docs.rs/tiger/badge.svg)](https://docs.rs/tiger) | 1.85 | :green_heart: |
-| [TurboSHAKE] | [`turboshake`] | [![crates.io](https://img.shields.io/crates/v/turboshake.svg)](https://crates.io/crates/turboshake) | [![Documentation](https://docs.rs/turboshake/badge.svg)](https://docs.rs/turboshake) | 1.85 | :yellow_heart: |
+| [Tiger] | [`tiger`] | [![crates.io](https://img.shields.io/crates/v/tiger.svg)](https://crates.io/crates/tiger) | [![Documentation](https://docs.rs/tiger/badge.svg)](https://docs.rs/tiger) | 1.85 | :yellow_heart: |
+| [TurboSHAKE] | [`turboshake`] | [![crates.io](https://img.shields.io/crates/v/turboshake.svg)](https://crates.io/crates/turboshake) | [![Documentation](https://docs.rs/turboshake/badge.svg)](https://docs.rs/turboshake) | 1.85 | :green_heart: |
 | [Whirlpool] | [`whirlpool`] | [![crates.io](https://img.shields.io/crates/v/whirlpool.svg)](https://crates.io/crates/whirlpool) | [![Documentation](https://docs.rs/whirlpool/badge.svg)](https://docs.rs/whirlpool) | 1.85 | :green_heart: |
 
 NOTE: the [`blake3`] crate implements the `digest` traits used by the rest of the hashes in this repository, but is maintained by the BLAKE3 team.
```

---

### Incident Patch 5: `e8fa2eea` (2026-05-12)
**Commit Message**: bash-prg-hash: fix minimal versions (#861)

The crate depends on `TryCustomizedInit` which was introduced in
`digest` v0.11.3.

The minimal versions job was broken (see
https://github.com/RustCrypto/actions/pull/59), so it missed the
incorrect dependency specification.

**File**: `bash-prg-hash/CHANGELOG.md` (modified, +5/-0)
```diff
@@ -5,6 +5,11 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## 0.1.1 (UNRELEASED)
+### Fixed
+- Use correct minimal version of `digest` dependency ([#861])
+
+[#861]: https://github.com/RustCrypto/hashes/pull/861
 
 ## 0.1.0 (2026-05-12)
 - Initial release ([#751])
```

**File**: `bash-prg-hash/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,12 +13,12 @@ keywords = ["belt", "stb", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = { version = "0.11", default-features = false }
+digest = { version = "0.11.3", default-features = false }
 bash-f = "0.1"
 sponge-cursor = "0.1"
 
 [dev-dependencies]
-digest = { version = "0.11", features = ["dev"] }
+digest = { version = "0.11.3", default-features = false, features = ["dev"] }
 hex-literal = "1"
 
 [features]
```

---

### Incident Patch 6: `4543dcbf` (2026-05-12)
**Commit Message**: bash-prg-hash: fix typo in docs

**File**: `bash-prg-hash/src/variants.rs` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ pub type BashPrgHash1921 = BashPrgHash<144, 1>;
 pub type BashPrgHash1922 = BashPrgHash<96, 2>;
 /// `bash-prg-hash` with ℓ = 256 and d = 1
 pub type BashPrgHash2561 = BashPrgHash<128, 1>;
-/// `bash-prg-hash`` with ℓ = 256 and d = 2
+/// `bash-prg-hash` with ℓ = 256 and d = 2
 pub type BashPrgHash2562 = BashPrgHash<64, 2>;
 
 impl CollisionResistance for BashPrgHash1281 {
```

---

### Incident Patch 7: `e6e19c40` (2026-04-19)
**Commit Message**: cshake: fix zero padding when data already aligns to block boundary (#834)

When the buffer already aligns with the block boundary, the existing
implementation adds an additional block of zeros to the input. This
occurs when the total length of the function name and customization
string is a multiple of the block size.

This isn't compliant with the "bytepad" algorithm in section 2.3.3 of
[SP 800-185]. If the buffer already aligns with the block boundary,
skip the padding.

[SP 800-185]: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf

**File**: `cshake/src/lib.rs` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ use digest::{
     CollisionResistance, CustomizedInit, ExtendableOutput, HashMarker, Update, XofReader,
     array::Array,
     block_api::{AlgorithmName, BlockSizeUser},
-    block_buffer::{BlockSizes, EagerBuffer, ReadBuffer},
+    block_buffer::{BlockSizes, EagerBuffer, LazyBuffer, ReadBuffer},
     consts::{U16, U32, U136, U168},
 };
 use keccak::{Keccak, State1600};
@@ -79,7 +79,7 @@ impl<Rate: BlockSizes> CShake<Rate> {
         }
 
         keccak.with_f1600(|f1600| {
-            let mut buffer: EagerBuffer<Rate> = Default::default();
+            let mut buffer: LazyBuffer<Rate> = Default::default();
             let state = &mut state;
             let mut b = [0u8; 9];
 
```

**File**: `cshake/tests/cshake.rs` (modified, +5/-0)
```diff
@@ -71,3 +71,8 @@ macro_rules! new_cshake_test {
 
 new_cshake_test!(cshake128, cshake::CShake128);
 new_cshake_test!(cshake256, cshake::CShake256);
+
+// When bytepad output aligns exactly to the block boundary,
+// no extra zero block should be appended (SP 800-185 2.3.3).
+new_cshake_test!(cshake128_bytepad_block_aligned, cshake::CShake128);
+new_cshake_test!(cshake256_bytepad_block_aligned, cshake::CShake256);
```

---

### Incident Patch 8: `d63dfe11` (2026-04-14)
**Commit Message**: turbo-shake: fix badges in readme (#831)

Also slightly tweaks the crate description.

**File**: `turbo-shake/README.md` (modified, +7/-7)
```diff
@@ -7,7 +7,7 @@
 [![Project Chat][chat-image]][chat-link]
 [![Build Status][build-image]][build-link]
 
-Implementation of the [TurboSHAKE] family of fast and secure extendable-output functions (XOFs).
+Implementation of the [TurboSHAKE] family of extendable-output functions (XOFs).
 
 ## Examples
 
@@ -66,16 +66,16 @@ dual licensed as above, without any additional terms or conditions.
 
 [//]: # (badges)
 
-[crate-image]: https://img.shields.io/crates/v/sha3.svg
-[crate-link]: https://crates.io/crates/sha3
-[docs-image]: https://docs.rs/sha3/badge.svg
-[docs-link]: https://docs.rs/sha3/
+[crate-image]: https://img.shields.io/crates/v/turbo-shake.svg
+[crate-link]: https://crates.io/crates/turbo-shake
+[docs-image]: https://docs.rs/turbo-shake/badge.svg
+[docs-link]: https://docs.rs/turbo-shake
 [license-image]: https://img.shields.io/badge/license-Apache2.0/MIT-blue.svg
 [rustc-image]: https://img.shields.io/badge/rustc-1.85+-blue.svg
 [chat-image]: https://img.shields.io/badge/zulip-join_chat-blue.svg
 [chat-link]: https://rustcrypto.zulipchat.com/#narrow/stream/260041-hashes
-[build-image]: https://github.com/RustCrypto/hashes/actions/workflows/sha3.yml/badge.svg?branch=master
-[build-link]: https://github.com/RustCrypto/hashes/actions/workflows/sha3.yml?query=branch:master
+[build-image]: https://github.com/RustCrypto/hashes/actions/workflows/turbo-shake.yml/badge.svg?branch=master
+[build-link]: https://github.com/RustCrypto/hashes/actions/workflows/turbo-shake.yml?query=branch:master
 
 [//]: # (general links)
 
```

---

### Incident Patch 9: `cbad89d6` (2026-04-14)
**Commit Message**: cshake: fix badges in readme (#830)

**File**: `cshake/README.md` (modified, +6/-6)
```diff
@@ -59,16 +59,16 @@ dual licensed as above, without any additional terms or conditions.
 
 [//]: # (badges)
 
-[crate-image]: https://img.shields.io/crates/v/sha3.svg
-[crate-link]: https://crates.io/crates/sha3
-[docs-image]: https://docs.rs/sha3/badge.svg
-[docs-link]: https://docs.rs/sha3/
+[crate-image]: https://img.shields.io/crates/v/cshake.svg
+[crate-link]: https://crates.io/crates/cshake
+[docs-image]: https://docs.rs/cshake/badge.svg
+[docs-link]: https://docs.rs/cshake
 [license-image]: https://img.shields.io/badge/license-Apache2.0/MIT-blue.svg
 [rustc-image]: https://img.shields.io/badge/rustc-1.85+-blue.svg
 [chat-image]: https://img.shields.io/badge/zulip-join_chat-blue.svg
 [chat-link]: https://rustcrypto.zulipchat.com/#narrow/stream/260041-hashes
-[build-image]: https://github.com/RustCrypto/hashes/actions/workflows/sha3.yml/badge.svg?branch=master
-[build-link]: https://github.com/RustCrypto/hashes/actions/workflows/sha3.yml?query=branch:master
+[build-image]: https://github.com/RustCrypto/hashes/actions/workflows/cshake.yml/badge.svg?branch=master
+[build-link]: https://github.com/RustCrypto/hashes/actions/workflows/cshake.yml?query=branch:master
 
 [//]: # (general links)
 
```

---

### Incident Patch 10: `297cc76e` (2026-04-13)
**Commit Message**: Fix release year in changelogs (#822)

**File**: `bash-hash/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.1.0 (2023-03-27)
+## 0.1.0 (2026-03-27)
 - Initial release ([#745])
 
 [#745]: https://github.com/RustCrypto/hashes/pull/745
```

**File**: `belt-hash/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 [#821]: https://github.com/RustCrypto/hashes/pull/821
 
-## 0.2.0 (2023-03-27)
+## 0.2.0 (2026-03-27)
 ### Added
 - `alloc` crate feature ([#678])
 
```

**File**: `fsb/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.2.0 (2023-03-27)
+## 0.2.0 (2026-03-27)
 ### Added
 - `alloc` crate feature ([#678])
 
```

**File**: `gost94/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.11.0 (2023-03-27)
+## 0.11.0 (2026-03-27)
 ### Added
 - `alloc` crate feature ([#678])
 
```

**File**: `groestl/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.11.0 (2023-03-27)
+## 0.11.0 (2026-03-27)
 ### Added
 - `alloc` crate feature ([#678])
 
```

**File**: `jh/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.2.0 (2023-03-27)
+## 0.2.0 (2026-03-27)
 ### Added
 - `alloc` crate feature ([#678])
 
```

**File**: `kupyna/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.1.0 (2023-03-27)
+## 0.1.0 (2026-03-27)
 - Initial release ([#621])
 
 [#621]: https://github.com/RustCrypto/hashes/pull/621
```

**File**: `md2/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## 0.11.0 (2023-03-27)
+## 0.11.0 (2026-03-27)
 ### Added
 - `alloc` crate feature ([#678])
 
```

---

### Incident Patch 11: `7c7cb76e` (2026-03-27)
**Commit Message**: Fix md5 project link in README (#809)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ See the [Security] page on Wikipedia for more information.
 ### Crate Names
 
 Whenever possible crates are published under the same name as the crate folder.
-Owners of `md5` [declined](https://github.com/stainless-steel/md5/pull/) to participate in this project.
+Owners of `md5` [declined](https://github.com/stainless-steel/md5/pull/2) to participate in this project.
 This crate does not implement the [`digest`] traits, so it is not interoperable with the RustCrypto ecosystem.
 This is why we publish our MD5 implementation as `md-5` and mark it with the :exclamation: mark.
 Note that the library itself is named as `md5`, i.e. inside `use` statements you should use `md5`, not `md_5`.
```

---

### Incident Patch 12: `aba1a593` (2026-02-05)
**Commit Message**: build(deps): bump cpufeatures from 0.2.17 to 0.3.0 (#782)

**File**: `Cargo.lock` (modified, +12/-3)
```diff
@@ -107,6 +107,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "cpufeatures"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8b2a41393f66f16b0823bb79094d54ac5fbd34ab292ddafb9a0456ac9f87d201"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "crypto-common"
 version = "0.2.0-rc.15"
@@ -204,7 +213,7 @@ version = "0.2.0-rc.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5a412fe37705d515cba9dbf1448291a717e187e2351df908cfc0137cbec3d480"
 dependencies = [
- "cpufeatures",
+ "cpufeatures 0.2.17",
 ]
 
 [[package]]
@@ -292,7 +301,7 @@ version = "0.11.0-rc.5"
 dependencies = [
  "base16ct",
  "cfg-if",
- "cpufeatures",
+ "cpufeatures 0.3.0",
  "digest",
  "hex-literal",
 ]
@@ -314,7 +323,7 @@ version = "0.11.0-rc.5"
 dependencies = [
  "base16ct",
  "cfg-if",
- "cpufeatures",
+ "cpufeatures 0.3.0",
  "digest",
  "hex-literal",
 ]
```

**File**: `sha1/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ digest = "0.11.0-rc.11"
 cfg-if = "1.0"
 
 [target.'cfg(any(target_arch = "aarch64", target_arch = "x86", target_arch = "x86_64"))'.dependencies]
-cpufeatures = "0.2"
+cpufeatures = "0.3"
 
 [dev-dependencies]
 digest = { version = "0.11.0-rc.11", features = ["dev"] }
```

**File**: `sha2/Cargo.toml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ digest = "0.11.0-rc.11"
 cfg-if = "1"
 
 [target.'cfg(any(target_arch = "aarch64", target_arch = "x86_64", target_arch = "x86"))'.dependencies]
-cpufeatures = "0.2"
+cpufeatures = "0.3"
 
 [dev-dependencies]
 digest = { version = "0.11.0-rc.11", features = ["dev"] }
```

---

### Incident Patch 13: `a478ace0` (2026-01-26)
**Commit Message**: build(deps): bump digest from 0.11.0-rc.8 to 0.11.0-rc.9 (#777)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -118,9 +118,9 @@ dependencies = [
 
 [[package]]
 name = "digest"
-version = "0.11.0-rc.8"
+version = "0.11.0-rc.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2fc1408b7a9f59a7b933faff3e9e7fc15a05a524effd3b3d1601156944c8077f"
+checksum = "bff8de092798697546237a3a701e4174fe021579faec9b854379af9bf1e31962"
 dependencies = [
  "blobby",
  "block-buffer",
```

**File**: `ascon-hash256/Cargo.toml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ keywords = ["hash", "ascon"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = "0.11.0-rc.8"
+digest = "0.11.0-rc.9"
 ascon = { version = "0.5.0-rc.0", default-features = false }
 
 [dev-dependencies]
```

**File**: `bash-hash/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ keywords = ["belt", "stb", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = "0.11.0-rc.8"
+digest = "0.11.0-rc.9"
 bash-f = "0.1"
 
 [dev-dependencies]
-digest = { version = "0.11.0-rc.8", features = ["dev"] }
+digest = { version = "0.11.0-rc.9", features = ["dev"] }
 hex-literal = "1"
 base16ct = { version = "1", features = ["alloc"] }
 
```

**File**: `belt-hash/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ keywords = ["belt", "stb", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = "0.11.0-rc.8"
+digest = "0.11.0-rc.9"
 belt-block = { version = "0.1.1", default-features = false }
 
 [dev-dependencies]
-digest = { version = "0.11.0-rc.8", features = ["dev"] }
+digest = { version = "0.11.0-rc.9", features = ["dev"] }
 hex-literal = "1"
 base16ct = { version = "1", features = ["alloc"] }
 
```

**File**: `blake2/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,10 +13,10 @@ keywords = ["blake2", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = { version = "0.11.0-rc.8", features = ["mac"] }
+digest = { version = "0.11.0-rc.9", features = ["mac"] }
 
 [dev-dependencies]
-digest = { version = "0.11.0-rc.8", features = ["dev"] }
+digest = { version = "0.11.0-rc.9", features = ["dev"] }
 hex-literal = "1"
 base16ct = { version = "1", features = ["alloc"] }
 
```

**File**: `fsb/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ keywords = ["fsb", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = "0.11.0-rc.8"
+digest = "0.11.0-rc.9"
 whirlpool = { version = "0.11.0-rc.3", default-features = false }
 
 [dev-dependencies]
-digest = { version = "0.11.0-rc.8", features = ["dev"] }
+digest = { version = "0.11.0-rc.9", features = ["dev"] }
 hex-literal = "1"
 base16ct = { version = "1", features = ["alloc"] }
 
```

**File**: `gost94/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,10 +13,10 @@ keywords = ["gost94", "gost", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = "0.11.0-rc.8"
+digest = "0.11.0-rc.9"
 
 [dev-dependencies]
-digest = { version = "0.11.0-rc.8", features = ["dev"] }
+digest = { version = "0.11.0-rc.9", features = ["dev"] }
 hex-literal = "1"
 base16ct = { version = "1", features = ["alloc"] }
 
```

**File**: `groestl/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,10 +13,10 @@ keywords = ["groestl", "grostl", "hash", "digest"]
 categories = ["cryptography", "no-std"]
 
 [dependencies]
-digest = "0.11.0-rc.8"
+digest = "0.11.0-rc.9"
 
 [dev-dependencies]
-digest = { version = "0.11.0-rc.8", features = ["dev"] }
+digest = { version = "0.11.0-rc.9", features = ["dev"] }
 hex-literal = "1"
 base16ct = { version = "1", features = ["alloc"] }
 
```

---

### Incident Patch 14: `ed39540a` (2026-01-23)
**Commit Message**: build(deps): bump keccak from 0.2.0-rc.0 to 0.2.0-rc.1 (#774)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -200,9 +200,9 @@ dependencies = [
 
 [[package]]
 name = "keccak"
-version = "0.2.0-rc.0"
+version = "0.2.0-rc.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3d546793a04a1d3049bd192856f804cfe96356e2cf36b54b4e575155babe9f41"
+checksum = "5a412fe37705d515cba9dbf1448291a717e187e2351df908cfc0137cbec3d480"
 dependencies = [
  "cpufeatures",
 ]
```

**File**: `sha3/Cargo.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ categories = ["cryptography", "no-std"]
 
 [dependencies]
 digest = "0.11.0-rc.7"
-keccak = "0.2.0-rc.0"
+keccak = "0.2.0-rc.1"
 
 [dev-dependencies]
 digest = { version = "0.11.0-rc.7", features = ["dev"] }
```

---

### Incident Patch 15: `92a7ee59` (2026-01-21)
**Commit Message**: readme: fix ascon-hash256 link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -235,7 +235,7 @@ Unless you explicitly state otherwise, any contribution intentionally submitted
 
 [//]: # (crates)
 
-[`ascon‑hash`]: ./ascon-hash256
+[`ascon‑hash256`]: ./ascon-hash256
 [`bash‑hash`]: ./bash-hash
 [`belt‑hash`]: ./belt-hash
 [`blake2`]: ./blake2
```

#### Recent Merged Pull Requests:
- **PR #916** (closed): build(deps): bump the all-deps group with 3 updates (@dependabot[bot])
- **PR #915** (closed): sha2: use inline assembly instead of unstable intrinsics for riscv-zknh backend (@TechnoPorg)
- **PR #913** (2026-09-01): ci: bump the all-deps group across 1 directory with 9 updates (@dependabot[bot])
- **PR #911** (2026-08-26): blake2 v0.11.0 (@tarcieri)
- **PR #910** (closed): sha1-checked: implement hardware acceleration on arm64 and x86_64 (@srijs)
- **PR #905** (closed): ci: bump the all-deps group across 1 directory with 8 updates (@dependabot[bot])
- **PR #904** (closed): ci: bump the all-deps group across 1 directory with 7 updates (@dependabot[bot])
- **PR #903** (closed): ci: bump crate-ci/typos from 1 to 1.48.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
