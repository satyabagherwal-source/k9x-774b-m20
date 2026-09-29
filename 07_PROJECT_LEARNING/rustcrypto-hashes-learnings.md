# Forensic Learning Record (Deep Inspection): RustCrypto/hashes

> **Canonical Artifact**: `07_PROJECT_LEARNING/rustcrypto-hashes-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RustCrypto/hashes](https://github.com/RustCrypto/hashes))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-29T21:27:32.161Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RustCrypto/hashes`
- **Description**: Collection of cryptographic hash functions written in pure Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2267 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
        let mut chunks = res.chunks_exact_mut(size_of::<
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #681** (2025-05-26): **Skein256/224 and Skein512/224 are invalid**
  *Symptoms*: ```rust use skein::{consts::U28, Digest, Skein256, Skein512}; fn main() {     println!("{:x}", Skein256::<U28>::digest(""));     println!("{:x}", Skein512::<U28>::digest(""));      // Output:     // 0fadf1fa39e3837a95b3660b4184d9c2f3cfc94b55d8e7a000000000     // 1541ae9fc3ebe24eb758ccb1fd60c2c31a9ebfe65b22008600000000 } ``` Note the trailing zeros.
  **Post-Mortem & Fix Analysis**:
  > You are right. The problem is with [these lines](https://github.com/RustCrypto/hashes/blob/0b22f1004e7840c32c52305a2fb9cf8cbd486573/skein/src/lib.rs#L128-L130). We should either use `chunks_mut` there instead of `chunks_mut_exact`, or should properly handle the remainder.  We probably will fix it in the next breakin release and will yank the older versions after that.
  > Skein1024/224 is affected as well if anyone uses it.

- **Issue #356** (2022-02-18): **blake2b gives a wrong value on powerpc-unknown-linux-gnu**
  *Symptoms*: In [xmpp-rs](https://xmpp.rs), we have [a test](https://gitlab.com/xmpp-rs/xmpp-rs/-/blob/main/parsers/src/ecaps2.rs#L469) which started to fail on this platform [after bumping the RustCrypto crates to 0.10](https://gitlab.com/xmpp-rs/xmpp-rs/-/commit/1a03588bdbac685d4e0c0ecf17f6fd8888569d41):  ```rust ---- ecaps2::tests::test_blake2b_512 stdout ---- thread 'main' panicked at 'assertion failed: `(left == right)`   left: `[107, 235, 164, 173, 234, 235, 170, 225, 55, 10, 138, 151, 244, 209, 149, 32, 75, 79, 184, 110, 158, 195, 195, 113, 25, 50, 170, 193, 54, 212, 114, 249, 126, 45, 33, 153,
  **Post-Mortem & Fix Analysis**:
  > It seems we don't `cross`-test `blake2b` like we do other crates like `sha2` and `sha3`, so it seems possible there might be an endianness-related (or other) bug
  > I tested on armv7-unknown-linux-gnueabihf as well, as an architecture which is 32-bit, it returns the correct result, so the issue really seems to be big endian.

- **Issue #54** (2018-05-15): **Link error in SHA2 with asm on macOS**
  *Symptoms*: When I compile `sha2` version 0.7.1 with the `asm` feature enabled, I get the following link error:  ```   = note: Undefined symbols for architecture x86_64:             "_sha512_compress", referenced from:                 sha2_asm::compress512::h2714fa0e6f190002 in libsha2-128ed50e2e0d1cae.rlib(sha2-128ed50e2e0d1cae.sha214.rcgu.o)           ld: symbol(s) not found for architecture x86_64           clang: error: linker command failed with exit code 1 (use -v to see invocation) ```  This is on macOS 10.13.4 with Rust 1.26.  To reproduce, run `cargo new --bin test_sha2` and then edit
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this!  It seems there is a problem with [`sha2-asm`](https://github.com/RustCrypto/asm-hashes/tree/master/sha2) build script. Unfortunately I currently don't have macOS to work on it, so I hope someone will help with it.
  > Please see https://github.com/RustCrypto/asm-hashes/pull/4 for a fix.

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
+        "6e21a345db74c83faa042ef4f996cf5e8478dcd
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
+| [TurboSHAKE] |
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

#### Recent Merged Pull Requests:
- **PR #916** (closed): build(deps): bump the all-deps group with 3 updates (@dependabot[bot])
- **PR #915** (closed): sha2: use inline assembly instead of unstable intrinsics for riscv-zknh backend (@TechnoPorg)
- **PR #913** (2026-09-01): ci: bump the all-deps group across 1 directory with 9 updates (@dependabot[bot])
- **PR #911** (2026-08-26): blake2 v0.11.0 (@tarcieri)
- **PR #910** (closed): sha1-checked: implement hardware acceleration on arm64 and x86_64 (@srijs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
