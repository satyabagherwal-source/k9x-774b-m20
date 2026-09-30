# Forensic Learning Record (Deep Inspection): zama-ai/tfhe-rs

> **Canonical Artifact**: `07_PROJECT_LEARNING/zama-ai-tfhe-rs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:04:56.599Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zama-ai/tfhe-rs`
- **Description**: TFHE-rs: A Pure Rust implementation of the TFHE Scheme for Boolean and Integer Arithmetics Over Encrypted Data.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 1666 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/princev2/benches/princev2.rs`
```
//! Benchmarks for homomorphic PRINCEv2 encryption and decryption
//!
//! Times one full call of `encrypt` and one of `decrypt`, i.e., transciphering one block of
//! 64 bits in either direction.

use criterion::{Criterion, criterion_group, criterion_main};

use tfhe::shortint::parameters::PARAM_MESSAGE_2_CARRY_2_KS_PBS_GAUSSIAN_2M128;

use tfhe_princev2::encryption::{decrypt_u2l_as_u64, encrypt_u64_as_u2l};
use tfhe_princev2::{decrypt, encrypt};

criterion_group!(benches, bench_transciphering);
criterion_main!(benches);

// KAT structure for the Prince v2 cipher
struct Kat {
    name: &'static str,
    ptxt: u64,
    k0: u64,
    k1: u64,
    ctxt: u64,
}

static KAT_LN2: Kat = Kat {
    // ptxt, k0, k1 are the first three u64 words of ln(2) fractional part.
    // ctxt was computed with the Sagemaths reference implementation and cross-checked here.
    name: "PRINCEv2 KAT from ln(2)",
    ptxt: 0xb17217f7d1cf79ab,
    k0: 0xc9e3b39803f2f6af,
    k1: 0x40f343267298b62d,
    ctxt: 0x40ac916b4598216d,
};

/// Run benches for PRINCEv2 transciphering.
fn bench_transciphering(c: &mut Criterion) {
    let (client_key, server_key) =
        tfhe::shortint::gen_keys(PARAM_MESSAGE_2_CARRY_2_KS_PBS_GAUSSIAN_2M128);

    let ct_k0 = encrypt_u64_as_u2l(&client_key, KAT_LN2.k0);
    let ct_k1 = encrypt_u64_as_u2l(&client_key, KAT_LN2.k1);
    let ct_m = encrypt_u64_as_u2l(&client_key, KAT_LN2.ptxt);
    let ct_c = encrypt_u64_as_u2l(&client_key, KAT_LN2.ctxt);

    let ct_enc = encrypt(&server_key, &ct_m, &ct_k0, &ct_k1);
    let pt_enc = decrypt_u2l_as_u64(&client_key, &ct_enc);
    assert_eq!(
        pt_enc, KAT_LN2.ctxt,
        "{} failed: ptxt={:#018x}, k0={:#018x}, k1={:#018x}, expected={:#018x}, got={:#018x}",
        KAT_LN2.name, KAT_LN2.ptxt, KAT_LN2.k0, KAT_LN2.k1, KAT_LN2.ctxt, pt_enc
    );

    let ct_dec = decrypt(&server_key, &ct_c, &ct_k0, &ct_k1);
    let pt_dec = decrypt_u2l_as_u64(&client_key, &ct_dec);
    assert_eq!(
        pt_dec, KAT_LN2.ptxt,
        "{} failed: ctxt={:#018x}, k0={:#018x}, k1={:#018x}, expected={:#018x}, got={:#018x}",
        KAT_LN2.name, KAT_LN2.ctxt, KAT_LN2.k0, KAT_LN2.k1, KAT_LN2.ptxt, pt_dec
    );

    let mut group = c.benchmark_group("princev2");
    group.sample_size(10);
    group.bench_function("PRINCEv2 Encryption of one message block", |b| {
        b.iter(|| encrypt(&server_key, &ct_m, &ct_k0, &ct_k1));
    });
    group.bench_function("PRINCEv2 Decryption of one message block", |b| {
        b.iter(|| decrypt(&server_key, &ct_c, &ct_k0, &ct_k1));
    });
    group.finish();
}

```

### Core Architecture Module: `apps/princev2/src/boxed_array.rs`
```
/*
 * Construction of the Box<[Ciphertext; N]> buffers carrying the cipher state
 * ----------------------------------------------------------------------------------------------- */

use rayon::prelude::*;
use tfhe::shortint::prelude::*;

/// Builds a buffer of `N` ciphertexts.
///
/// Collecting into a `Box<[T]>` and converting to `Box<[T; N]>` keeps the buffer on the heap from
/// the start, the conversion being a pointer reinterpretation. Collecting into `[T; N]` would
/// instead move every element into a stack array, and `Box::new(array)` would build that array
/// before copying it back out.
pub(crate) fn boxed_array_from_fn<const N: usize>(
    f: impl FnMut(usize) -> Ciphertext,
) -> Box<[Ciphertext; N]> {
    (0..N).map(f).collect::<Box<[_]>>().try_into().unwrap()
}

/// Rayon counterpart of [`boxed_array_from_fn`].
pub(crate) fn par_boxed_array_from_fn<const N: usize>(
    f: impl Fn(usize) -> Ciphertext + Send + Sync,
) -> Box<[Ciphertext; N]> {
    (0..N)
        .into_par_iter()
        .map(f)
        .collect::<Box<[_]>>()
        .try_into()
        .unwrap()
}

```

### Core Architecture Module: `apps/princev2/src/cipher.rs`
```
use tfhe::shortint::prelude::*;
use tfhe::shortint::server_key::LookupTableOwned;

use crate::boxed_array::{boxed_array_from_fn, par_boxed_array_from_fn};
use crate::{BLOCK_NB_BITS, BLOCK_NB_U2, BLOCK_NB_U4, tables};

/* Macro to monitor individual functions timings (feature related: "verbose-timings").
 * Evaluates to the return value of the monitored call. */
#[cfg(feature = "verbose-timings")]
macro_rules! monitor {
    ($fn:ident($( $a:expr ), *)) => {{
        let t0 = std::time::Instant::now();
        let res = $fn($( $a), *);
        eprintln!("{}:\t{:.4?}", stringify!($fn), t0.elapsed());
        res
    }}
}
#[cfg(not(feature = "verbose-timings"))]
macro_rules! monitor {
    ($fn:ident($( $a:expr ), *)) => { $fn($( $a), *) }
}

/* Nibble formats carried by the Box<[Ciphertext; N]> buffers
 * ---------------------------------------------------------------------------------
 *   u4   (BLOCK_NB_U4)   - one full 4-bit nibble per ciphertext
 *   u2h  (BLOCK_NB_U2)   - 2 bits per ciphertext, packed on the high bits (u2h = u2 << 2)
 *   u2l  (BLOCK_NB_U2)   - 2 bits per ciphertext, on the low bits: the crate's input/output
 *                          and key encoding
 *   bits (BLOCK_NB_BITS) - a single bit per ciphertext, exact shifted position varies
 */

/// Every lookup table here spans the whole 4-bit plaintext space, and the nibble formats above use
/// the carry bits to hold state, so the crate is tied to a 2-bit message / 2-bit carry parameter
/// set: any other splitting would truncate the S-box outputs or drop drifted bits.
fn assert_2_2_parameters(server_key: &ServerKey) {
    assert_eq!(
        (server_key.message_modulus, server_key.carry_modulus),
        (MessageModulus(4), CarryModulus(4)),
        "PRINCEv2 requires a 2-bit message / 2-bit carry parameter set, \
         e.g. PARAM_MESSAGE_2_CARRY_2_KS_PBS_GAUSSIAN_2M128"
    );
}

fn build_lut(server_key: &ServerKey, table: &[u8; 16]) -> LookupTableOwned {
    server_key.generate_lookup_table(|x| table[x as usize] as u64)
}

fn sum_adjacent_pairs<const N: usize>(
    server_key: &ServerKey,
    in_ct: &[Ciphertext],
) -> Box<[Ciphertext; N]> {
    assert_eq!(in_ct.len(), 2 * N);
    boxed_array_from_fn(|i| server_key.unchecked_add(&in_ct[2 * i], &in_ct[2 * i + 1]))
}

/// Sums the four ciphertexts of `in_ct` whose indexes are in `src_idx`.
fn sum_4_at(server_key: &ServerKey, in_ct: &[Ciphertext], src_idx: [usize; 4]) -> Ciphertext {
    let mut ct_sum = server_key.unchecked_add(&in_ct[src_idx[0]], &in_ct[src_idx[1]]);
    server_key.unchecked_add_assign(&mut ct_sum, &in_ct[src_idx[2]]);
    server_key.unchecked_add_assign(&mut ct_sum, &in_ct[src_idx[3]]);
    ct_sum
}

fn sum_with_key(
    server_key: &ServerKey,
    in_u2h: &[Ciphertext; BLOCK_NB_U2],
    ct_k: &[Ciphertext; BLOCK_NB_U2],
) -> Box<[Ciphertext; BLOCK_NB_U2]> {
    boxed_array_from_fn(|out_u2| server_key.unchecked_add(&in_u2h[out_u2], &ct_k[out_u2]))
}

fn sbox_to_u2h(
    server_key: &ServerKey,
    in_u4: &[Ciphertext; BLOCK_NB_U4],
    lut_sbox: &[[u8; 16]; BLOCK_NB_U4],
) -> Box<[Ciphertext; BLOCK_NB_U2]> {
    par_boxed_array_from_fn(|out_u2| {
        let nibble = out_u2 >> 1;

        let extract_input_upper_half = out_u2 % 2 == 0;

        let in_shift = if extract_input_upper_half { 2 } else { 0 };

        let lut = server_key.generate_lookup_table(|x| {
            let sbox_out = lut_sbox[nibble][x as usize];
            let u2 = (sbox_out >> in_shift) & 0x3;
            (u2 << 2) as u64
        });
        server_key.apply_lookup_table(&in_u4[nibble], &lut)
    })
}

/// S-Boxes, 4-bit nibbles (16) --> single bits (64)
/// . each 4-bit nibble requires 4 applications of (same LUT + Bit extraction)
// [Parallel:64]
fn sbox_to_bits(
    server_key: &ServerKey,
    in_u4: &[Ciphertext; BLOCK_NB_U4],
    lut_sbox: &[[u8; 16]; BLOCK_NB_U4],
) -> Box<[Ciphertext; BLOCK_NB_BITS]> {
    par_boxed_array_from_fn(|out_bit| {
        let nibble = out_bit >> 2;

        let out_bit_index_in_nibble = 3 - (out_bit & 0x3);

        let sbox_out_bit_to_extract = out_bit_index_in_nibble;

        let out_shift = 3 - (nibble % 4);

        let lut = server_key.generate_lookup_table(|x| {
            let sbox_out = lut_sbox[nibble][x as usize];
            let bit = (sbox_out >> sbox_out_bit_to_extract) & 0x1;
            (bit << out_shift) as u64
        });
        server_key.apply_lookup_table(&in_u4[nibble], &lut)
    })
}

/// M-layer: apply the e-xor matrices, then the FHE permutation `perm`.
/// `perm` is in gather form: `out[idx]` is the e-xor output of `in[perm[idx]]`
/// It carries the P-Layer on top of the M-Layer bit reordering when it is `FHE_MP_PERM_FW`.
// [Parallel:64]
fn m_layer(
    server_key: &ServerKey,
    in_u4: &[Ciphertext; BLOCK_NB_U4],
    lut_exor: &[&[[u8; 16]; 4]],
    perm: &[usize; BLOCK_NB_BITS],
) -> Box<[Ciphertext; BLOCK_NB_BITS]> {
    par_boxed_array_from_fn(|out_bit| {
        let src_bit = perm[out_bit];

        let src_nibble = src_bit >> 2;

        let src_bit_idx_in_nibble = src_bit & 0x3;
        let exor_matrix = lut_exor[out_bit % lut_exor.len()];
        let lut = build_lut(server_key, &exor_matrix[src_bit_idx_in_nibble]);
        server_key.apply_lookup_table(&in_u4[src_nibble], &lut)
    })
}

/// Works independently on all groups of 4 nibbles
/// For each nibble in a group of 4, packs each of its bits with corresponding bits from the 3 other
/// nibbles
///
/// Bits are expected to already be shifted as to not collide
fn pack_bit_lanes_to_u4(
    server_key: &ServerKey,
    in_bits: &[Ciphertext; BLOCK_NB_BITS],
) -> Box<[Ciphertext; BLOCK_NB_U4]> {
    boxed_array_from_fn(|out_nibble| {
        let group = out_nibble >> 2;

        let out_nibble_idx_in_group = out_nibble & 0x3;

        let in_bit_idx = std::array::from_fn(|in_nibble_idx_in_group| {
            let in_nibble = 4 * group + in_nibble_idx_in_group;

            let in_bit_idx_in_nibble = out_nibble_idx_in_group;

            4 * in_nibble + in_bit_idx_in_nibble
        });

        sum_4_at(server_key, in_bits, in_bit_idx)
    })
}
/// Backward variant of [`pack_bit_lanes_to_u4`], with the  preceding nibble permutation folded into
/// the indices.
fn pack_bit_lanes_to_u4_inv_p(
    server_key: &ServerKey,
    in_bits: &[Ciphertext; BLOCK_NB_BITS],
) -> Box<[Ciphertext; BLOCK_NB_U4]> {
    boxed_array_from_fn(|out_nibble| {
        let group = out_nibble >> 2;

        let out_nibble_idx_in_group = out_nibble & 0x3;

        let in_bit_idx = std::array::from_fn(|middle_nibble_idx_in_group| {
            // middle is the state after the permutation and before the bit lane packing
            let middle_nibble = 4 * group + middle_nibble_idx_in_group;

            let in_nibble = tables::INV_P_PERM[middle_nibble];

            let in_bit_idx_in_nibble = out_nibble_idx_in_group;

            4 * in_nibble + in_bit_idx_in_nibble
        });
        sum_4_at(server_key, in_bits, in_bit_idx)
    })
}

fn xor_to_u4(
    server_key: &ServerKey,
    in_u2h: &[Ciphertext; BLOCK_NB_U2],
    ct_k: &[Ciphertext; BLOCK_NB_U2],
) -> Box<[Ciphertext; BLOCK_NB_U4]> {
    // xor alternatively to pairs of high/low bits
    let lut_xor_fw: [LookupTableOwned; 2] =
        std::array::from_fn(|i| build_lut(server_key, &tables::LUT_XOR_FW[i]));

    let ct_key_sum = sum_with_key(server_key, in_u2h, ct_k);
    // [Parallel:32] Apply xor LUT to high or low bit
    let ct_xor_halves: Box<[Ciphertext; BLOCK_NB_U2]> = par_boxed_array_from_fn(|out_u2| {
        let idx_odd = out_u2 & 0x1;

        server_key.apply_lookup_table(&ct_key_sum[out_u2], &lut_xor_fw[idx_odd])
    });
    // [Parallel:16] Sum by pairs
    sum_adjacent_pairs(server_key, ct_xor_halves.as_slice())
}

/* returns (in_u2h xor ct_k) as vec of bits
 * [Parallel:(32)/64] -> drifted bits */
fn xor_to_bits(
    server_key: &ServerKey,
    in_u2h: &[Ciphertext; BLOCK_NB_U2],
    ct_k: &[Ciphertext; BLOCK_NB_U2],
) -> Box<[Ciphertext; BLOCK_NB_BITS]> {
    let luts_xor_
```

### Core Architecture Module: `apps/princev2/src/encryption.rs`
```
/*
 * Client-side (de-)encryption of the crate's input / output format
 * ----------------------------------------------------------------------------------------------- */

use tfhe::shortint::prelude::*;

use crate::BLOCK_NB_U2;
use crate::boxed_array::boxed_array_from_fn;
use crate::u64_conv::{u64_to_vec_u2, vec_u2_to_u64};

/// Encrypts a u64 as `BLOCK_NB_U2` ciphertexts, each holding a 2-bit nibble in the low bits of the
/// FHE message space (the `u2l` format expected by [`crate::encrypt`] / [`crate::decrypt`]). The
/// most significant bits of the input are at index 0 in the output.
pub fn encrypt_u64_as_u2l(client_key: &ClientKey, x: u64) -> Box<[Ciphertext; BLOCK_NB_U2]> {
    let u2l = u64_to_vec_u2(x);

    boxed_array_from_fn(|n| client_key.encrypt(u2l[n] as u64))
}

/// Reverse of [`encrypt_u64_as_u2l`].
pub fn decrypt_u2l_as_u64(client_key: &ClientKey, ct: &[Ciphertext; BLOCK_NB_U2]) -> u64 {
    vec_u2_to_u64(std::array::from_fn(|n| client_key.decrypt(&ct[n]) as u8))
}

```

### Core Architecture Module: `apps/princev2/src/lib.rs`
```
// Pure Rust Helpers
mod u64_conv;
pub use u64_conv::{u64_to_vec_u2, vec_u2_to_u64};
pub mod encryption;

mod boxed_array;
mod cipher;
mod tables;
pub use cipher::{decrypt, encrypt};

/// PRINCEv2 operates on 64-bit blocks. The state is split into elements of 1, 2 or 4 bits
/// depending on the layer, one element per ciphertext (see the nibble formats in `cipher`).
pub const BLOCK_NB_BITS: usize = 64;
pub const BLOCK_NB_U2: usize = BLOCK_NB_BITS / 2;
pub const BLOCK_NB_U4: usize = BLOCK_NB_BITS / 4;

```

### Core Architecture Module: `apps/princev2/src/tables.rs`
```
/*
 * Prince v2 constant definitions and Look-up tables for FHE
 * --------------------------------------------------------------------------------- */
use crate::{BLOCK_NB_BITS, BLOCK_NB_U4, u64_conv};

/* Permutations -------------------------------------------------------------------- */
static P_PERM: [usize; BLOCK_NB_U4] = [
    // Prince permutation layer on nibbles
    0x0, 0x5, 0xa, 0xf, 0x4, 0x9, 0xe, 0x3, 0x8, 0xd, 0x2, 0x7, 0xc, 0x1, 0x6, 0xb,
];
pub static INV_P_PERM: [usize; BLOCK_NB_U4] = [
    // Prince inverse permutation on nibbles
    0x0, 0xd, 0xa, 0x7, 0x4, 0x1, 0xe, 0xb, 0x8, 0x5, 0x2, 0xf, 0xc, 0x9, 0x6, 0x3,
];

// Permutation to apply on 16-bits nibbles after M0 if computed as exor( 0123 )
// ---> bits 0c84,51d9,a62e,fb73
// (u16 bits) 0123...def (as an array of bits from msb to lsb)
static FHE_M0_PERM: [usize; 16] = [
    0x0, 0x5, 0xa, 0xf, 0x3, 0x4, 0x9, 0xe, 0x2, 0x7, 0x8, 0xd, 0x1, 0x6, 0xb, 0xc,
];

// Permutation to apply on 16-bits nibbles after M1 if computed as exor( 0123 )
// --> bits c840,1d95,62ea,b73f
static FHE_M1_PERM: [usize; 16] = [
    0x3, 0x4, 0x9, 0xe, 0x2, 0x7, 0x8, 0xd, 0x1, 0x6, 0xb, 0xc, 0x0, 0x5, 0xa, 0xf,
];

// Combined overall bits permutation: (p0 | p1 | p1 | p0) with indexes 0..63
// FHE_M_PERM  = sum(( [_c + _n*16 for _c in _perm] for _n,_perm
//                     in enumerate([FHE_M0_PERM,FHE_M1_PERM,FHE_M1_PERM,FHE_M0_PERM]) ), []);
pub static FHE_M_PERM: [usize; BLOCK_NB_BITS] = {
    let mut word = 0;
    let mut m_perm = [0; BLOCK_NB_BITS];

    while word < 4 {
        let word_base = word * 16;

        let mut bit = 0;
        while bit < 16 {
            // M0 permutes the outer 16-bit words, M1 the inner ones
            let permuted_bit = match word {
                0 | 3 => FHE_M0_PERM[bit],
                1 | 2 => FHE_M1_PERM[bit],
                _ => unreachable!(),
            };

            m_perm[word_base + bit] = word_base + permuted_bit;
            bit += 1;
        }
        word += 1;
    }
    m_perm
};

// Combined with Permutation layer (fw)
// = [ fhe_M_Perm[ 4*Perm[_i >> 2] + (_i & 0x3) ] for _i in range(64) ]
pub static FHE_MP_PERM_FW: [usize; BLOCK_NB_BITS] = {
    let mut b = 0;
    let mut mp_perm = [0; BLOCK_NB_BITS];

    while b < BLOCK_NB_BITS {
        // Unnatural, but just to see the same structure as above
        let bit_index_in_nibble = b & 0x3;
        let dst_nibble_index = b >> 2;
        let src_nibble_index = P_PERM[dst_nibble_index];
        let src_bit_index = 4 * src_nibble_index + bit_index_in_nibble;

        mp_perm[b] = FHE_M_PERM[src_bit_index];

        b += 1;
    }
    mp_perm
};

/* Round constants ----------------------------------------------------------------- */
const PRINCE_NB_ROUNDS: usize = 12; // Number of rounds (more precisely, nb of round constants / non-linear layers)

#[rustfmt::skip]
static RC_V2: [u64; PRINCE_NB_ROUNDS] = [
    0x0000000000000000, 0x13198a2e03707344, 0xa4093822299f31d0, 0x082efa98ec4e6c89,
    0x452821e638d01377, 0xbe5466cf34e90c6c, 0x7ef84f78fd955cb1, 0x7aacf4538d971a60,
    0xc882d32f25323c54, 0x9b8ded979cd838c7, 0xd3b5a399ca0c2399, 0x3f84d5b5b5470917,
];
#[rustfmt::skip]
static RC_V2_INV_P_INV_M: [u64; PRINCE_NB_ROUNDS] = [ // iM . iP (RC)
    0x0000000000000000, 0x90ecdeb7cb7fc1ce, 0x81b2cb20a82a2928, 0x480cdfa91d749037,
    0xcb1a13467044d772, 0x9e8995b07a988c08, 0xe70338c395311a6a, 0x60dc22bf6e681c08,
    0x318672daf2dd0655, 0x2a74fad9b606e252, 0xe96673c424d657ac, 0xabc631f91e2ccb7a,
];
static RC_BETA_INV_M: u64 = 0x42f93b79daa0eea5; // iM (RC_BETA)

// Decomposed versions
static RC_V2_U4: [[u8; BLOCK_NB_U4]; PRINCE_NB_ROUNDS] = array_u64_to_vec_u4(RC_V2);
static RC_V2_INV_P_INV_M_U4: [[u8; BLOCK_NB_U4]; PRINCE_NB_ROUNDS] =
    array_u64_to_vec_u4(RC_V2_INV_P_INV_M);
static RC_BETA_INV_M_U4: [u8; BLOCK_NB_U4] = u64_conv::u64_to_vec_u4(RC_BETA_INV_M);

// Emulating map on const for u64_to_vec_u4
pub const fn array_u64_to_vec_u4<const N: usize>(tab: [u64; N]) -> [[u8; BLOCK_NB_U4]; N] {
    let mut i = 0;
    let mut out = [[0; BLOCK_NB_U4]; N];

    while i < N {
        // for loop not allowed in const fn
        out[i] = u64_conv::u64_to_vec_u4(tab[i]);
        i += 1;
    }
    out
}

/* (inv)SBox and derivatives ------------------------------------------------------- */
static SBOX: [u8; 16] = [
    // Forward SBox
    0xb, 0xf, 0x3, 0x2, 0xa, 0xc, 0x9, 0x1, 0x6, 0x7, 0x8, 0x0, 0xe, 0x5, 0xd, 0x4,
];
static INV_SBOX: [u8; 16] = [
    // Backward SBox
    0xb, 0x7, 0x3, 0x2, 0xf, 0xd, 0x8, 0x9, 0xa, 0x6, 0x4, 0x0, 0x5, 0xe, 0xc, 0x1,
];

// Combined RC+Sboxes for Encryption
// Named LUT_<in>_(INV_)SBOX_<out>: the round constants xored before / after the (inverse) S-box,
// where a hex digit is an index into RC_V2 and MID is the middle-round constant iM(RC_BETA)
pub static LUT_0_SBOX_0: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, [0_u8; BLOCK_NB_U4], [0_u8; BLOCK_NB_U4]); // Not ideal
pub static LUT_1_SBOX_2: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, RC_V2_U4[1], RC_V2_INV_P_INV_M_U4[2]);
pub static LUT_3_SBOX_4: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, RC_V2_U4[3], RC_V2_INV_P_INV_M_U4[4]);
pub static LUT_5_SBOX_MID: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, RC_V2_U4[5], RC_BETA_INV_M_U4);
pub static LUT_0_INV_SBOX_0: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, [0_u8; BLOCK_NB_U4], [0_u8; BLOCK_NB_U4]); // Not ideal
pub static LUT_6_INV_SBOX_7: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, RC_V2_INV_P_INV_M_U4[6], RC_V2_U4[7]);
pub static LUT_8_INV_SBOX_9: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, RC_V2_INV_P_INV_M_U4[8], RC_V2_U4[9]);
pub static LUT_A_INV_SBOX_B: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, RC_V2_INV_P_INV_M_U4[10], RC_V2_U4[11]);

// Additional RC+Sboxes for Decryption
pub static LUT_B_SBOX_A: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, RC_V2_U4[11], RC_V2_INV_P_INV_M_U4[10]);
pub static LUT_9_SBOX_8: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, RC_V2_U4[9], RC_V2_INV_P_INV_M_U4[8]);
pub static LUT_7_SBOX_6: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(SBOX, RC_V2_U4[7], RC_V2_INV_P_INV_M_U4[6]);
pub static LUT_MID_INV_SBOX_5: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, RC_BETA_INV_M_U4, RC_V2_U4[5]);
pub static LUT_4_INV_SBOX_3: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, RC_V2_INV_P_INV_M_U4[4], RC_V2_U4[3]);
pub static LUT_2_INV_SBOX_1: [[u8; 16]; BLOCK_NB_U4] =
    build_lut_xor_sbox_xor(INV_SBOX, RC_V2_INV_P_INV_M_U4[2], RC_V2_U4[1]);

// Build special LUTs: SBox( x ^ inner ) ^ outer, depending on nibble index
const fn build_lut_xor_sbox_xor(
    sbox: [u8; 16],
    xor_inner: [u8; BLOCK_NB_U4],
    xor_outer: [u8; BLOCK_NB_U4],
) -> [[u8; 16]; BLOCK_NB_U4] {
    let mut lut_xor_sbox_xor = [[0; 16]; BLOCK_NB_U4];
    let mut nibble = 0;
    while nibble < BLOCK_NB_U4 {
        // for loop not allowed in const fn
        let mut x = 0;
        while x < 16 {
            let sbox_in = (x as u8) ^ xor_inner[nibble];
            let sbox_out = sbox[sbox_in as usize];

            lut_xor_sbox_xor[nibble][x] = sbox_out ^ xor_outer[nibble];
            x += 1;
        }
        nibble += 1;
    }
    lut_xor_sbox_xor
}

/* LUTs for M-layer (exors) -------------------------------------------------------- */
// Bits (msb) 0123 (lsb) in u4
static LUT_EXOR_TO_0: [[u8; 16]; 4] = build_lut_exor(0);
static LUT_EXOR_TO_1: [[u8; 16]; 4] = build_lut_exor(1);
static LUT_EXOR_TO_2: [[u8; 16]; 4] = build_lut_exor(2);
static LUT_EXOR_TO_3: [[u8; 16]; 4] = build_lut_exor(3);
#[rustfmt::skip]
pub static LUT_EXOR_FW: [&[[u8; 16]; 4]; 2] = [
    &LUT_EXOR_TO_3, &LUT_EXOR_TO_2,
];
#[rustfmt::skip]
pub static LUT_EXOR_BW: [&[[u8; 16]; 4]; 4] = [
    &LUT_EXOR_TO_3, &LUT_EXOR_TO_2, &LUT_EXOR_TO_1, &LUT_EXOR_TO_0,
];

// e-xor(b) = xor of all bits except b. [Ex: e-xor(1010,0) = 0
```

### Core Architecture Module: `apps/princev2/src/u64_conv.rs`
```
/*
 * Some bit manipulation converting u64 to vectors of 2/4-bit nibbles
 * ----------------------------------------------------------------------------------------------- */

use crate::{BLOCK_NB_U2, BLOCK_NB_U4};

// u64 -> [u4; 16], res[0] = 4 MSB bits of u64
pub const fn u64_to_vec_u4(u: u64) -> [u8; BLOCK_NB_U4] {
    let mut i = 0;
    let mut v = [0; BLOCK_NB_U4];

    // "for" loop is unusable inside const
    while i < BLOCK_NB_U4 {
        v[BLOCK_NB_U4 - i - 1] = ((u >> (4 * i)) & 0xf) as u8;
        i += 1;
    }
    v
}

#[allow(dead_code)] // kept for symmetry with u64_to_vec_u4(); might be useful to convert back decomposed constants
pub const fn vec_u4_to_u64(v: [u8; BLOCK_NB_U4]) -> u64 {
    let mut i = 0;
    let mut u = 0;

    // "for" loop is unusable inside const
    while i < BLOCK_NB_U4 {
        u += (v[i] as u64) << (60 - 4 * i);
        i += 1;
    }
    u
}

// u64 -> [u2; 32], res[0] = 2 MSB bits of u64
pub const fn u64_to_vec_u2(u: u64) -> [u8; BLOCK_NB_U2] {
    let mut i = 0;
    let mut v = [0; BLOCK_NB_U2];

    while i < BLOCK_NB_U2 {
        // for loop unusable inside const
        v[BLOCK_NB_U2 - i - 1] = ((u >> (2 * i)) & 0x3) as u8;
        i += 1;
    }
    v
}

pub const fn vec_u2_to_u64(v: [u8; BLOCK_NB_U2]) -> u64 {
    let mut i = 0;
    let mut u = 0;

    while i < BLOCK_NB_U2 {
        // for loop unusable inside const
        u += (v[i] as u64) << (62 - 2 * i);
        i += 1;
    }
    u
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_u64_conv_vec_u4() {
        let u = 0x3f84d5b5b5470917;
        let u_dec = [
            0x3, 0xf, 0x8, 0x4, 0xd, 0x5, 0xb, 0x5, 0xb, 0x5, 0x4, 0x7, 0x0, 0x9, 0x1, 0x7,
        ];
        assert_eq!(u_dec, u64_to_vec_u4(u));
        assert_eq!(u, vec_u4_to_u64(u_dec));

        let u = 0x0ac6f9cd6e6f275d;
        let u_dec = [
            0x0, 0xa, 0xc, 0x6, 0xf, 0x9, 0xc, 0xd, 0x6, 0xe, 0x6, 0xf, 0x2, 0x7, 0x5, 0xd,
        ];
        assert_eq!(u_dec, u64_to_vec_u4(u));
        assert_eq!(u, vec_u4_to_u64(u_dec));
    }

    #[test]
    fn test_u64_conv_vec_u2() {
        let u = 0x603cd95fa72a8704;
        #[rustfmt::skip]
        let u_dec = [
            0x1, 0x2, 0x0, 0x0, 0x0, 0x3, 0x3, 0x0, 0x3, 0x1, 0x2, 0x1, 0x1, 0x1, 0x3, 0x3,
            0x2, 0x2, 0x1, 0x3, 0x0, 0x2, 0x2, 0x2, 0x2, 0x0, 0x1, 0x3, 0x0, 0x0, 0x1, 0x0];
        assert_eq!(u_dec, u64_to_vec_u2(u));
        assert_eq!(u, vec_u2_to_u64(u_dec));

        let u = 0xee873b2ec447944d;
        #[rustfmt::skip]
        let u_dec = [
            0x3, 0x2, 0x3, 0x2, 0x2, 0x0, 0x1, 0x3, 0x0, 0x3, 0x2, 0x3, 0x0, 0x2, 0x3, 0x2,
            0x3, 0x0, 0x1, 0x0, 0x1, 0x0, 0x1, 0x3, 0x2, 0x1, 0x1, 0x0, 0x1, 0x0, 0x3, 0x1];
        assert_eq!(u_dec, u64_to_vec_u2(u));
        assert_eq!(u, vec_u2_to_u64(u_dec));
    }
}

```

### Core Architecture Module: `apps/trivium/benches/kreyvium_bool.rs`
```
use criterion::Criterion;
use tfhe::prelude::*;
use tfhe::{generate_keys, ConfigBuilder, FheBool};
use tfhe_trivium::KreyviumStream;

pub fn kreyvium_bool_gen(c: &mut Criterion) {
    let config = ConfigBuilder::default().build();
    let (client_key, server_key) = generate_keys(config);

    let key_string = "0053A6F94C9FF24598EB000000000000".to_string();
    let mut key = [false; 128];

    for i in (0..key_string.len()).step_by(2) {
        let mut val: u8 = u8::from_str_radix(&key_string[i..i + 2], 16).unwrap();
        for j in 0..8 {
            key[8 * (i >> 1) + j] = val % 2 == 1;
            val >>= 1;
        }
    }

    let iv_string = "0D74DB42A91077DE45AC000000000000".to_string();
    let mut iv = [false; 128];

    for i in (0..iv_string.len()).step_by(2) {
        let mut val: u8 = u8::from_str_radix(&iv_string[i..i + 2], 16).unwrap();
        for j in 0..8 {
            iv[8 * (i >> 1) + j] = val % 2 == 1;
            val >>= 1;
        }
    }

    let cipher_key = key.map(|x| FheBool::encrypt(x, &client_key));

    let mut kreyvium = KreyviumStream::<FheBool>::new(cipher_key, iv, &server_key);

    c.bench_function("kreyvium bool generate 64 bits", |b| {
        b.iter(|| kreyvium.next_64())
    });
}

pub fn kreyvium_bool_warmup(c: &mut Criterion) {
    let config = ConfigBuilder::default().build();
    let (client_key, server_key) = generate_keys(config);

    let key_string = "0053A6F94C9FF24598EB000000000000".to_string();
    let mut key = [false; 128];

    for i in (0..key_string.len()).step_by(2) {
        let mut val: u8 = u8::from_str_radix(&key_string[i..i + 2], 16).unwrap();
        for j in 0..8 {
            key[8 * (i >> 1) + j] = val % 2 == 1;
            val >>= 1;
        }
    }

    let iv_string = "0D74DB42A91077DE45AC000000000000".to_string();
    let mut iv = [false; 128];

    for i in (0..iv_string.len()).step_by(2) {
        let mut val: u8 = u8::from_str_radix(&iv_string[i..i + 2], 16).unwrap();
        for j in 0..8 {
            iv[8 * (i >> 1) + j] = val % 2 == 1;
            val >>= 1;
        }
    }

    c.bench_function("kreyvium bool warmup", |b| {
        b.iter(|| {
            let cipher_key = key.map(|x| FheBool::encrypt(x, &client_key));
            let _kreyvium = KreyviumStream::<FheBool>::new(cipher_key, iv, &server_key);
        })
    });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2083** (2025-02-22): **Signed Division Support on CUDA**
  *Symptoms*: **Describe the bug** In the [GPU acceleration](https://docs.zama.ai/tfhe-rs/guides/run_on_gpu) tutorial, the list of supported operations indicates that signed division is available.  However, when executing a signed division operation on a CUDA device, the operation results in a panic with the message "Division '/' is not yet supported by Cuda devices" in `tfhe/src/high_level_api/integers/signed/ops.rs`.   **To Reproduce** Since I used the C API when working with TFHE-rs, I reproduced this issue through the C API. You can reproduce it with the following code. ```c++     Config* config = nullptr;     ConfigBuilder* config_builder = nullptr;      config_builder_default(&config_builder);     config_builder_build(config_builder, &config);     ClientKey* client_key = nullptr;     client_key_generate(config, &client_key);     CompressedServerKey* compressed_server_key = nullptr;     compressed_server_key_new(client_key, &compressed_server_key);     CudaServerKey* cuda_server_key = nullptr;     compressed_server_key_decompress_to_gpu(compressed_server_key, &cuda_server_key);     set_cuda_server_key(cuda_server_key);     PublicKey* public_key;     public_key_new(client_key, &public_key);      FheInt32* a = nullptr;     FheInt32* b = nullptr;     fhe_int32_try_encrypt_with_public_key_i32(10, public_key, &a);     fhe_int32_try_encrypt_with_public_key_i32(2, public_key, &b);     FheInt32* result = nullptr;     fhe_int32_div(a, b, &result);     fhe_int32_destroy(a);     fhe_int32_destro
  **Post-Mortem & Fix Analysis**:
  > hello @duhaode520 thanks for reporting it, it might be a problem in the C API only missing some binding, we'll check.  Thanks a lot for the repro code!
  > So looks like we do have the Signed Division for CUDA, but it may not have been plugged in the so called "High Level API", we should be able to remedy to this fairly soon
  > @IceTDrinker  , thanks for timely reply.  I've found a solution to bypass this problem. I set  `server_key` and `cuda_server_key` simultaneously, and the division works correctly. I'm wondering whether the CUDA is enabled in this case, or if all operations bypass the CUDA and the CPU is used for the computations instead.

- **Issue #2037** (2025-09-18): **Range of Barrett intermediate result**
  *Symptoms*: I have found that the implementation of Barrett reduction can give incorrect results in some cases. Here is an example:  ```rust use concrete_ntt::prime32::Plan;  fn main() {     let p: u32 = 0x7fe0_1001;     let polynomial_size = 1024;     let plan = Plan::try_new(polynomial_size, p).unwrap();      let value = 0x6e63593a;     let mut acc = [0u32; 8];     let input = [value, 0, 0, 0, 0, 0, 0, 0];      plan.mul_accumulate(&mut acc, &input, &input);      let expected = (u64::from(value) * u64::from(value) % u64::from(p)) as u32;     println!("acc[0] = {}", acc[0]);     assert_eq!(acc[0], expected); } ```  The output is: ``` acc[0] = 360086499 thread 'main' panicked at examples/reduction.rs:16:5: assertion `left == right` failed   left: 360086499  right: 364272609 ```  Note that 364272609 - 360086499 = 4186110 = 2 * (0x8000_0000 - 0x7fe0_1001). Performing two conditional subtractions at the conclusion of the algorithm, rather than one, would have given the correct result. (Unfortunately, there are not enough bits in the intermediate result to see that two conditional subtractions are necessary.)  The possible need for two conditional subtractions was noted in Barrett's paper ("Our calculations show that the result x so obtained will always be in the range 0 to 3M - 1") and is also captured in https://eprint.iacr.org/2015/785 ("approximates the result $c = d \bmod n$ by a quasi-reduced number $c + \epsilon n$ where $0 \le \epsilon \le 2$"), but is omitted by the presentation in h
  **Post-Mortem & Fix Analysis**:
  > transferring to the repo where this will be maintained
  > thanks for the report
  > I'm guessing the problem is likely also present for ~64 bits primes ?

- **Issue #1687** (2025-01-22): **Panic at program execution end with `tfhe::generate_keys` before rust 1.83**
  *Symptoms*: **Describe the bug**  Followed docs. When calling `tfhe::generate_keys`, I get a panic at the end of the program execution (not during the function call). The panic is:  ``` thread '<unnamed>' panicked at library/core/src/panicking.rs:220:5: unsafe precondition(s) violated: ptr::replace requires that the pointer argument is aligned and non-null note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace thread caused non-unwinding panic. aborting. [1]    26769 abort      cargo run ```  **To Reproduce**  Add the correct tfhe-rs version:  ```toml tfhe = { version = "0.8.3", features = [     "boolean",     "shortint",     "integer",     "aarch64-unix", ] } ```  Then in `src/main.rs`:  ```rust use tfhe::{generate_keys, ConfigBuilder};  fn main() {     let config = ConfigBuilder::default().build();     let _ = generate_keys(config);      println!("Done."); } ```  **Expected behaviour**  No error.  **Actual behavior**  The program ends, the keys are generated, but there's a panic at the end, _after_ the call to generate_keys. See that the "Done." line is correctly printed.  ``` ➜  tfhe-rs-panic git:(main) ✗ cargo run    Compiling tfhe-rs-panic v0.1.0 (/Users/amaury/Workspace/inco/tfhe-rs-panic)     Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.37s      Running `target/debug/tfhe-rs-panic` Done. thread '<unnamed>' panicked at library/core/src/panicking.rs:220:5: unsafe precondition(s) violated: 
  **Post-Mortem & Fix Analysis**:
  > That is very very weird to say the least.  do you have any non standard configuration ?  which hardware/OS (model and version) are you using ?  could you try updating your rust version with rustup update ?  also cargo clean and cargo update if you have the chance and try again
  > Also if you have a full backtrace, it’s not clear what code is triggering the panic
  > I think there may have been a faulty linker packaged with xcode tools on Apple mac at some point, could be worth to check if there is a way to update the dev tools coming from Apple

- **Issue #1010** (2024-03-25): **Performing WoPBS with ciphertext a trivial encryption of zero fails**
  *Symptoms*: **Describe the bug** Trying to perform pbs with ciphertext being a trivial encryption of zero panics.  **To Reproduce** Steps to reproduce the behaviour: 1. Using the `integer` API, create a `WopbsKey`, then call `generate_lut_radix()` with that key, 2. Apply the `WopbsKey::wopbs()` method with the lut and a trivial encryption of zero as ciphertext,  **Expected behaviour** The `wopbs()` method returns (an encryption of) the lookup table at index zero.  **Evidence** Here's a minimal example: ```rust use tfhe::{     integer::{gen_keys_radix, wopbs::WopbsKey, RadixCiphertext, RadixClientKey, ServerKey},     shortint::{         parameters::parameters_wopbs_message_carry::WOPBS_PARAM_MESSAGE_2_CARRY_2_KS_PBS,         prelude::PARAM_MESSAGE_2_CARRY_2_KS_PBS,     }, };  fn generate_keys() -> (RadixClientKey, ServerKey, WopbsKey) {     let (ck, sk) = gen_keys_radix(PARAM_MESSAGE_2_CARRY_2_KS_PBS, 16);     let wopbs_key = WopbsKey::new_wopbs_key(&ck, &sk, &WOPBS_PARAM_MESSAGE_2_CARRY_2_KS_PBS);     (ck, sk, wopbs_key) }  fn main() {     let (ck, sk, wopbs_key) = generate_keys();     let ct_max_arg: RadixCiphertext = sk.create_trivial_radix(8u64, 4);     let f = |x: u64| -> u64 { 5 + x };     let lut = wopbs_key.generate_lut_radix(&ct_max_arg, f);     let apply_lut = |encrypted_id: &RadixCiphertext| -> RadixCiphertext {         let ct = wopbs_key.keyswitch_to_wopbs_params(&sk, encrypted_id);         let ct_res = wopbs_key.wopbs(&ct, &lut);         wo
  **Post-Mortem & Fix Analysis**:
  > thanks for following up here
  > @Juul-Mc-Goa you are hitting a debug assert try running with --release and tell me if it works, if so the debug assert is not necessary and we'll remove it
  > @IceTDrinker just runned with `--release` and indeed, it works.

- **Issue #702** (2023-11-22): **About the simple example code in the readme**
  *Symptoms*: **Describe the bug** The simple example code won't run on my OS(windows x86_64)  **To Reproduce** Steps to reproduce the behaviour 1. Copy the example code in the README to IDE 2. cargo run --release on terminal  3. bug report  **Evidence** ![image](https://github.com/zama-ai/tfhe-rs/assets/142082125/7c563e30-bbe7-4487-9ccc-f84ee7740f62) ![image](https://github.com/zama-ai/tfhe-rs/assets/142082125/ec94f4d4-c0b6-4693-bc79-a2d06e731436) ![image](https://github.com/zama-ai/tfhe-rs/assets/142082125/b660bb1f-f7d1-4c02-83c7-d612bdf0aba3)  **Configuration(please complete the following information):**  - OS: Microsoft windows 11  
  **Post-Mortem & Fix Analysis**:
  > hello @chinchihwork it’s not a bug it’s just that our main branch has evolved and it has breaking changes compared to 0.4 which was the last version published. Can you try with the code from main ?  Otherwise the function call change you did is the correct one to get it working again.  If you check https://github.com/zama-ai/tfhe-rs/tree/release/0.4.x you will see the readme has the function call you expect. Keeping this issue open for now as we will want to see how to handle this
  > hello @IceTDrinker, thanks for replying.  I cloned the code from main branch to my .cargo/registry today but the code on README still couldn't run at first. Then I realised I didn't change the dependency setting in my cargo.toml.   After I change the dependency setting to:  ```toml [dependencies] tfhe = { git = "https://github.com/zama-ai/tfhe-rs.git", version = "0.5.0" , features = ["boolean", "shortint", "integer", "x86_64"] } ``` It works fine. Thanks for answering!  Also, since I am a beginner learning rust, I was wondering if I config the dependency to github repository, I won't download anything from remote to my local .cargo/registry right? Because  I don't see any change in my .cargo/registry after I change the dependency.  Thanks for helping out!
  > Looks like cargo clones repositories in ls ~/.cargo/git, not quite sure how it is organized in there ! One thing to be wary of is that if we push new stuff to main it will only update the github repository when you do a cargo update.  If we have answered your questions feel free to close the issue 🙂 

- **Issue #460** (2023-07-26): **Radix Integers: Possible Overflow When Propagating Carries **
  *Symptoms*: **Describe the bug** The `full_propagate` operation employed in `smart` arithmetic operations for radix integers sometimes seem to overflow when adding carries, leading to incorrect calculations. The incorrect calculation seems to occur only when employing a `ServerKey` generated from a `CompressedServerKey`, which might be the expected flow when a compact representation of a `ServerKey` needs to be shared with a third party.  **To Reproduce** I wrote a simple test to reproduce the incorrect calculation, employing version `0.3.0-beta.0` ```rust         let client_key = RadixClientKey::new(PARAM_MESSAGE_2_CARRY_2, 14);         let compressed_eval_key = CompressedServerKey::new(client_key.as_ref());         let evaluation_key = ServerKey::from(compressed_eval_key);         let modulus = (client_key.parameters().message_modulus().0 as u128).pow(client_key.num_blocks() as u32)             as u128;          let mut ct = client_key.encrypt(modulus-1);         let mut res_ct = ct.clone();         for _ in 0..5 {             res_ct = evaluation_key.smart_add_parallelized(&mut res_ct, &mut ct);         }         let res = client_key.decrypt::<u128>(&res_ct);         assert_eq!(modulus-6, res);  ``` In the last addition, an overflow when propagating carries seem to happen leading to an incorrect result.  **Expected behaviour** The last addition in the code reported above should compute the correct result  **Evidence** I found out that if I generate the `Serve
  **Post-Mortem & Fix Analysis**:
  > Thanks, this looks to be right, the degree is not properly set when creating the Compressed Key at the integer level, thanks a lot for the bug report, will fix this ASAP
  > Thanks a lot for the very detailed and thorough bug report @nicholas-mainardi PR #461 is open and will be merged as soon as it's approved and passing tests!  Cheers

- **Issue #410** (2023-07-09): **The `r` resulted from integer `division` when multiplied together always return `0`.**
  *Symptoms*: **Describe the bug** The `remainer` or `r` resulted from integer `division` when multiplied together always return `0`.  **To Reproduce** Steps to reproduce the behaviour  1. Install latest `tfhe`  ```toml tfhe = { git = "https://github.com/zama-ai/tfhe-rs", features = [ "boolean", "shortint", "integer", "internal-keycache"] } ```  2. Encrypt some number with integer radix key 3. Do two division that results in `q` and `r`, In this case `ServerKey::div_rem_parallelized`. 4. Multiply `r` from those division together. 5. The result from that multiplication will always be **zero**.  ```rust fn main() {     let (client_key, server_key) = IntegerKeyCache.get_from_params(PARAM_MESSAGE_2_CARRY_2);     const NUM_BLOCK: usize = 4;     let a: u128 = 248;     let b: u128 = 249;     let c: u128 = 250;     let d: u128 = 251;     let enc_a = client_key.encrypt_radix(a, NUM_BLOCK);     let enc_b = client_key.encrypt_radix(b, NUM_BLOCK);     let enc_c = client_key.encrypt_radix(c, NUM_BLOCK);     let enc_d = client_key.encrypt_radix(d, NUM_BLOCK);      let (mut q1, mut r1) = server_key.div_rem_parallelized(&enc_b, &enc_a);     let (mut q2, mut r2) = server_key.div_rem_parallelized(&enc_d, &enc_c);      println!("r1: {:?}", client_key.decrypt_radix::<u8>(&r1));     println!("r2: {:?}", client_key.decrypt_radix::<u8>(&r2));     println!("q1: {:?}", client_key.decrypt_radix::<u8>(&q1));     println!("q2: {:?}", client_key.decrypt_radix::<u8>(&q2));      let
  **Post-Mortem & Fix Analysis**:
  > What happens if you replace the first smart mul by just mul_parallelized ?
  > > What happens if you replace the first smart mul by just mul_parallelized ?  Still output the same value ``` r1: 1 r2: 1 q1: 1 q2: 1 r1r2: 0 q1q2: 1 r1r2_retry: 1 ```
  > Can you try calling full_propagate_parallelized on r1r2 ? Or rather on r1 and r2 before multiplying 

- **Issue #117** (2023-02-28): **key_id hashing error**
  *Symptoms*: **Describe the bug** The `buffer_for_keys` method returns the same buffer for different keys. This leads to a buffer created for one key, being provided for another key in methods such as `keyswitch_programmable_bootstrap_assign`. The buffer's LWE dimension mismatches the LWE dimension of the second key leading to a panic.   **To Reproduce** Steps to reproduce the behaviour 1. Generate the first key pair with the first parameter set (e.g. `PARAM_MESSAGE_5_CARRY_1`) 2. Create an accumulator and evaluate a `keyswitch_programmable_bootstrap_assign` with the first key pair. 3. Generate the second key pair with the second parameter set (e.g. `PARAM_MESSAGE_4_CARRY_2`) 4. Create an accumulator and evaluate a `keyswitch_programmable_bootstrap_assign` with the second key pair.  **Expected behaviour** Both PBS steps should succeed independently from each other.  **Evidence** Minimal example: ``` use tfhe::shortint::gen_keys; use tfhe::shortint::parameters::*;  fn main() {     let params1 = PARAM_MESSAGE_5_CARRY_1;     let (ck1, sk1) = gen_keys(params1);     let acc1 = sk1.generate_accumulator(|a| a);     let mut idx1 = ck1.encrypt(0);     sk1.keyswitch_programmable_bootstrap_assign(&mut idx1, &acc1);     let res1 = ck1.decrypt(&idx1);      let params2 = PARAM_MESSAGE_4_CARRY_2;     let (ck2, sk2) = gen_keys(params2);     let acc2 = sk2.generate_accumulator(|a| a);     let mut idx2 = ck2.encrypt(0);     sk2.keyswitch_programmable_bootstrap_assign(&mut idx

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

### Incident Patch 1: `446305f7` (2026-09-30)
**Commit Message**: chore: fix fft bench hardware

**File**: `.github/workflows/benchmark_tfhe_fft.yml` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ jobs:
         run: |
           python3 ./ci/fft_benchmark_parser.py target/criterion "${RESULTS_FILENAME}" \
           --database concrete_fft \
-          --hardware "hpc7a.96xlarge" \
+          --hardware "hpc8a.96xlarge" \
           --project-version "${COMMIT_HASH}" \
           --branch "${REF_NAME}" \
           --commit-date "${COMMIT_DATE}" \
```

**File**: `.github/workflows/benchmark_tfhe_ntt.yml` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ jobs:
         run: |
           python3 ./ci/ntt_benchmark_parser.py target/criterion "${RESULTS_FILENAME}" \
           --database concrete_ntt \
-          --hardware "hpc7a.96xlarge" \
+          --hardware "hpc8a.96xlarge" \
           --project-version "${COMMIT_HASH}" \
           --branch "${REF_NAME}" \
           --commit-date "${COMMIT_DATE}" \
```

---

### Incident Patch 2: `26808e3b` (2026-09-29)
**Commit Message**: fix(integer): boolean flip and add its missing test

The behavior was inverted (it flipped on false),
bugged because it was not tested

**File**: `tfhe/src/integer/server_key/radix_parallel/cmux.rs` (modified, +14/-11)
```diff
@@ -467,21 +467,21 @@ impl ServerKeyDefaultCMux<&BooleanBlock, &BooleanBlock> for ServerKey {
         true_ct: &BooleanBlock,
         false_ct: &BooleanBlock,
     ) -> (Self::Output, Self::Output) {
-        let flip_if_false_fn = |packed| {
+        let zero_out_if_false_fn = |packed| {
             let condition = (packed / 2) & 1;
             let value = packed % 2;
             value * condition
         };
 
-        let flip_if_true_fn = |packed| {
+        let zero_out_if_true_fn = |packed| {
             let condition = (packed / 2) & 1;
             let value = packed % 2;
             (1 - condition) * value
         };
 
         let lut = self
             .key
-            .generate_many_lookup_table(&[&flip_if_false_fn, &flip_if_true_fn]);
+            .generate_many_lookup_table(&[&zero_out_if_false_fn, &zero_out_if_true_fn]);
 
         let scaled_condition = self.key.unchecked_scalar_mul(&condition.0, 2);
 
@@ -496,29 +496,32 @@ impl ServerKeyDefaultCMux<&BooleanBlock, &BooleanBlock> for ServerKey {
             },
         );
 
-        let [mut a_if_cond, mut a_if_not_cond] = vec_a.try_into().unwrap();
-        let [b_if_cond, b_if_not_cond] = vec_b.try_into().unwrap();
+        let [mut a_if_true_0_if_false, mut a_if_false_0_if_true] = vec_a.try_into().unwrap();
+        let [b_if_true_0_if_false, b_if_false_0_if_true] = vec_b.try_into().unwrap();
 
         self.key
-            .unchecked_add_assign(&mut a_if_cond, &b_if_not_cond);
+            .unchecked_add_assign(&mut a_if_false_0_if_true, &b_if_true_0_if_false);
         self.key
-            .unchecked_add_assign(&mut a_if_not_cond, &b_if_cond);
+            .unchecked_add_assign(&mut a_if_true_0_if_false, &b_if_false_0_if_true);
+
+        let mut a_if_false_b_if_true = a_if_false_0_if_true;
+        let mut a_if_true_b_if_false = a_if_true_0_if_false;
 
         let clean_lut = self.key.generate_lookup_table(|x| x % 2);
         rayon::join(
             || {
                 self.key
-                    .apply_lookup_table_assign(&mut a_if_cond, &clean_lut)
+                    .apply_lookup_table_assign(&mut a_if_false_b_if_true, &clean_lut)
             },
             || {
                 self.key
-                    .apply_lookup_table_assign(&mut a_if_not_cond, &clean_lut)
+                    .apply_lookup_table_assign(&mut a_if_true_b_if_false, &clean_lut)
             },
         );
 
         (
-            BooleanBlock::new_unchecked(a_if_cond),
-            BooleanBlock::new_unchecked(a_if_not_cond),
+            BooleanBlock::new_unchecked(a_if_false_b_if_true),
+            BooleanBlock::new_unchecked(a_if_true_b_if_false),
         )
     }
 }
```

**File**: `tfhe/src/integer/server_key/radix_parallel/mod.rs` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ mod slice;
 #[cfg(test)]
 pub(crate) mod test_harness;
 #[cfg(test)]
+pub(crate) mod tests_boolean;
+#[cfg(test)]
 pub(crate) mod tests_cases_unsigned;
 #[cfg(test)]
 pub(crate) mod tests_long_run;
```

**File**: `tfhe/src/integer/server_key/radix_parallel/test_harness.rs` (modified, +41/-0)
```diff
@@ -160,6 +160,11 @@ where
         }
     }
 
+    pub(crate) fn block_counts(&mut self, block_counts: Vec<u32>) -> &mut Self {
+        self.block_counts = block_counts;
+        self
+    }
+
     /// Number of random cases per block count (run with clean inputs).
     pub(crate) fn n_random(&mut self, n: u32) -> &mut Self {
         self.n_random = n;
@@ -535,6 +540,7 @@ macro_rules! impl_input_state_for_tuple {
 
 impl_input_state_for_tuple!(A);
 impl_input_state_for_tuple!(A, B);
+impl_input_state_for_tuple!(A, B, C);
 
 /// Trait for types representing clear inputs of a test
 pub(crate) trait TestClearInput: Copy + std::fmt::Debug {
@@ -648,6 +654,14 @@ impl TestClearInput for Uint {
     }
 }
 
+impl TestClearInput for bool {
+    type Input = BooleanBlock;
+
+    fn generate_random(rng: &mut dyn RngCore, _n_blocks: u32, _ctx: &TestContext) -> Self {
+        rng.gen_bool(0.5)
+    }
+}
+
 impl TestInput for RadixCiphertext {
     type Clear = Uint;
 
@@ -691,6 +705,31 @@ impl TestInput for RadixCiphertext {
     }
 }
 
+impl TestInput for BooleanBlock {
+    type Clear = bool;
+
+    type Ref<'a>
+        = &'a Self
+    where
+        Self: 'a;
+
+    type State = ();
+
+    fn prepare(
+        clear: Self::Clear,
+        _state: Self::State,
+        _rng: &mut dyn RngCore,
+        ctx: &TestContext,
+    ) -> (Self, Self::Clear) {
+        let encrypted = ctx.cks.encrypt_bool(clear);
+        (encrypted, clear)
+    }
+
+    fn as_ref(&self) -> Self::Ref<'_> {
+        self
+    }
+}
+
 /// Rust scalar types accepted by the `scalar_*` operations, as seen by the harness.
 pub(crate) trait ScalarType: Copy + std::fmt::Debug + 'static {
     const BITS: u32;
@@ -909,6 +948,7 @@ macro_rules! impl_test_input_for_tuple {
 
 impl_test_input_for_tuple!(A.0);
 impl_test_input_for_tuple!(A.0, B.1);
+impl_test_input_for_tuple!(A.0, B.1, C.2);
 
 /// Trait for outputs of a FHE function that is tested
 ///
@@ -1023,3 +1063,4 @@ macro_rules! impl_execute_on_for_tuple {
 
 impl_execute_on_for_tuple!(A.0);
 impl_execute_on_for_tuple!(A.0, B.1);
+impl_execute_on_for_tuple!(A.0, B.1, C.2);
```

**File**: `tfhe/src/integer/server_key/radix_parallel/tests_boolean/mod.rs` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+use crate::integer::prelude::*;
+use crate::integer::server_key::radix_parallel::test_harness::{
+    ExecuteOn, TestBuilder, TestContext,
+};
+use crate::integer::server_key::radix_parallel::tests_unsigned::CpuFunctionExecutor;
+use crate::integer::tests::create_parameterized_test;
+use crate::integer::{BooleanBlock, ServerKey};
+use crate::shortint::parameters::test_params::*;
+use crate::shortint::parameters::{TestParameters, *};
+
+#[cfg(tarpaulin)]
+use crate::shortint::parameters::coverage_parameters::*;
+
+pub(crate) fn test_boolean_flip_test_case<E>(ctxt: &TestContext, executor: E)
+where
+    E: ExecuteOn<(BooleanBlock, BooleanBlock, BooleanBlock), (BooleanBlock, BooleanBlock)>,
+{
+    let bits_per_block = ctxt.bits_per_block();
+    TestBuilder::new(ctxt)
+        .block_counts(vec![1])
+        // Only fixed_cases because we test the whole truth table
+        .fixed_cases(move |bit_count| {
+            assert_eq!(
+                bit_count, bits_per_block,
+                "BooleanBlock tests should only be 1-block"
+            );
+            vec![
+                (false, false, false),
+                (false, false, true),
+                (false, true, false),
+                (false, true, true),
+                (true, false, false),
+                (true, false, true),
+                (true, true, false),
+                (true, true, true),
+            ]
+        })
+        .execute(
+            executor,
+            |(condition, lhs, rhs)| {
+                if condition {
+                    (rhs, lhs)
+                } else {
+                    (lhs, rhs)
+                }
+            },
+        );
+}
+
+fn test_boolean_flip(params: impl Into<TestParameters>) {
+    let ctx = TestContext::from_env(params);
+    // Help the compiler
+    let func = |sks: &ServerKey,
+                c: &BooleanBlock,
+                l: &BooleanBlock,
+                r: &BooleanBlock|
+     -> (BooleanBlock, BooleanBlock) { sks.flip_parallelized(c, l, r) };
+    let mut executor = CpuFunctionExecutor::new(func);
+    executor.setup_with_server_key(ctx.server_key());
+    test_boolean_flip_test_case(&ctx, executor);
+}
+
+create_parameterized_test!(test_boolean_flip);
```

---

### Incident Patch 3: `83b7f451` (2026-09-25)
**Commit Message**: fix(hpu): update python trace interpreter according to new HW trace JSON syntax

Now dumping LUT name in HW trace PBS (instead of LUT id)

**File**: `backends/tfhe-hpu-backend/python/lib/isctrace/fmt.py` (modified, +27/-26)
```diff
@@ -20,83 +20,84 @@ def __str__(self):
         return f'{self.name} {self.args()}'
 
 class PBS(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
+        self.asm = asm
 
     def args(self):
-        return f'R{self.dst_rid} R{self.src_rid} @{self.gid}'
+        return f'{self.asm.partition(" ")[2]}'
 
 class LD(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
         try:
-            return f'R{self.rid} @{hex(self.slot["Addr"])}'
+            return f'R{self.dst["addr"]} @{hex(self.src["Io"]["addr"])}'
         except:
             # It can happen that an IOP is not translated by the FW
-            return f'R{self.rid} @{self.slot}'
+            return f'R{self.dst} @{self.src}'
 
 class ST(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
         try:
-            return f'@{hex(self.slot["Addr"])} R{self.rid}'
+            return f'@{hex(self.dst["Io"]["addr"])} R{self.src["addr"]}'
         except:
             # It can happen that an IOP is not translated by the FW
-            return f'@{self.slot} R{self.rid}'
+            return f'@{self.dst} R{self.src}'
 
 class MAC(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f'R{self.dst_rid} R{self.src0_rid} ' +\
-               f'R{self.src1_rid} X{self.mul_factor} '
+        return f'R{self.dst["addr"]} R{self.src1["addr"]} ' +\
+               f'R{self.src2["addr"]} x{self.cst["Const"]["val"]} '
 
 class ADD(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f'R{self.dst_rid} R{self.src0_rid} R{self.src1_rid}'
+        return f'R{self.dst["addr"]} R{self.src1["addr"]} R{self.src2["addr"]}'
 
 class ADDS(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f'R{self.dst_rid} R{self.src_rid} {self.msg_cst["Cst"]}'
+        return f'R{self.dst["addr"]} R{self.src["addr"]} {self.cst["Const"]["val"]}'
 
 class SUB(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f'R{self.dst_rid} R{self.src0_rid} R{self.src1_rid}'
+        return f'R{self.dst["addr"]} R{self.src1["addr"]} R{self.src2["addr"]}'
 
 class SSUB(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f'R{self.dst_rid} {self.msg_cst["Cst"]} R{self.src_rid}'
+        return f'R{self.dst["addr"]} {self.cst["Const"]["val"]} R{self.src["addr"]}'
 
 class SUBS(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f'R{self.dst_rid} R{self.src_rid} {self.msg_cst["Cst"]}'
+        return f'R{self.dst["addr"]} R{self.src["addr"]} {self.cst["Const"]["val"]}'
 
 class SYNC(BaseInstruction):
-    def __init__(self, d):
+    def __init__(self, d, asm):
         self.__dict__ = d
 
     def args(self):
-        return f"{self.iid}"
+        return f"{self.iid} {self.is_inner}"
 
 PBS_ML2   = PBS
 PBS_ML4   = PBS
@@ -109,10 +110,10 @@ def args(self):
 SUBS      = ADDS
 
 class Insn:
-    def __init__(self, insn):
+    def __init__(self, insn, asm):
         self.opcode, data = next(iter(insn.items()))
-        self.data = globals()[self.opcode](data) if self.opcode in globals() \
-                    else NamedInstruction(self.opcode, data)
+        self.data = globals()[self.opcode](data, asm) if self.opcode in globals() \
+                    else NamedInstruction(self.opcode, data, asm)
 
     def to_analysis(self):
         return analysis.Instruction(self.opcode,
```

**File**: `backends/tfhe-hpu-backend/python/lib/isctrace/hw.py` (modified, +4/-4)
```diff
@@ -15,9 +15,9 @@
 """
 class Event:
     EVENT_MAP = {
-        "Issue": lambda x: analysis.Issue(fmt.Insn(x.insn).to_analysis()),
-        "Retire": lambda x: analysis.Retire(fmt.Insn(x.insn).to_analysis()),
-        "RdUnlock": lambda x: analysis.RdUnlock(fmt.Insn(x.insn).to_analysis()),
+        "Issue": lambda x: analysis.Issue(fmt.Insn(x.insn, x.insn_asm).to_analysis()),
+        "Retire": lambda x: analysis.Retire(fmt.Insn(x.insn, x.insn_asm).to_analysis()),
+        "RdUnlock": lambda x: analysis.RdUnlock(fmt.Insn(x.insn, x.insn_asm).to_analysis()),
         "Refill": lambda x: analysis.Refill(None),
         "None": lambda x: analysis.Refill(None),
     }
@@ -66,7 +66,7 @@ def iops(self):
         for event in self:
             id_map[0].append(event)
             opcode = next(iter(event.insn.keys())) if event.insn is not None else None
-            is_inner = event.insn[opcode]["is_inner_sync"] if opcode == "SYNC" else None
+            is_inner = event.insn[opcode]["is_inner"] if opcode == "SYNC" else None
 
             if opcode == "SYNC" and event.cmd == "Issue" and is_inner == False:
                 yield Trace(id_map[0])
```

---

### Incident Patch 4: `cdf28659` (2026-09-23)
**Commit Message**: feat(hpu): Update isc_trace

Now trace take lut_map as context and generate back asm/dop struct
in the json

**File**: `backends/tfhe-hpu-backend/src/interface/cache/lut.rs` (modified, +9/-2)
```diff
@@ -16,7 +16,7 @@ use std::sync::Arc;
 use thiserror::Error;
 
 use super::{Pool, PoolError, SlotId};
-use zhc::crypto::integer_semantics::lut::{LutId, RawLut};
+use zhc::crypto::integer_semantics::lut::{LutDecoder, LutId, RawLut};
 
 /// Keep track of uploaded LUT and associated properties
 pub struct LutCache {
@@ -207,7 +207,7 @@ impl LutMap {
     }
 
     /// Retrieve the LUT sitting in a given slot
-    pub fn get(&self, id: LutId) -> Option<&RawLut> {
+    pub fn get(&self, id: &LutId) -> Option<&RawLut> {
         // Entries are sorted by id (c.f. `LutCache::lut_map`)
         self.0
             .binary_search_by_key(&id.0, |(entry_id, _lut)| entry_id.0)
@@ -224,6 +224,13 @@ impl std::ops::Deref for LutMap {
     }
 }
 
+impl LutDecoder for LutMap {
+    fn decode_lut_id(&self, lid: &LutId) -> &RawLut {
+        self.get(lid)
+            .unwrap_or_else(|| panic!("Failed to get lid {lid}"))
+    }
+}
+
 /// Cache Error type
 #[derive(Error, Clone, Debug)]
 pub enum LutError {
```

**File**: `backends/tfhe-hpu-backend/src/isc_trace.rs` (modified, +73/-308)
```diff
@@ -1,14 +1,17 @@
 //! Define bit-accurate layout of hw trace generated by the Instruction scheduler
 //! Rely on bitfield_struct that as a 128b limits
 use bitfield_struct::bitfield;
+use zhc::crypto::integer_semantics::lut::LutDecoder;
+use zhc::langs::doplang;
 
 // High-level view of the trace.
 #[derive(Debug, serde::Serialize, serde::Deserialize)]
 pub struct IscTrace {
     pub pe_reserved: u16,
     pub state: IscPoolState,
+    pub insn: Option<doplang::DopInstructionSet>,
     pub insn_hex: u32,
-    pub insn_asm: Option<String>,
+    pub insn_asm: String,
     pub timestamp: u32,
 }
 
@@ -68,7 +71,10 @@ impl IscTrace {
     pub fn bit_size() -> usize {
         128
     }
-    pub fn from_bytes(bytes: &[u8]) -> Result<Self, TraceParsingError> {
+    pub fn from_bytes_with_ctx(
+        bytes: &[u8],
+        lreg: &impl LutDecoder,
+    ) -> Result<Self, TraceParsingError> {
         let flit0 = if bytes.len() != Self::bytes_size() {
             return Err(TraceParsingError::EmptyStream);
         } else {
@@ -78,12 +84,13 @@ impl IscTrace {
         };
 
         let cmd = unsafe { std::mem::transmute::<u8, IscCommand>(flit0.cmd()) };
-        let asm = match cmd {
-            IscCommand::None => "Garbage".to_string(),
+        let (insn, asm) = match cmd {
+            IscCommand::None => (None, "Garbage".to_string()),
             _ => {
                 let dop = zhc::pipeline::passes::hpu_decode_dop_repr(flit0.insn(), None)
                     .map_err(|x| TraceParsingError::IncorrectValue(x.to_string()))?;
-                dop.to_string()
+                let asm = doplang::format_assembly(&dop, lreg);
+                (Some(dop), asm)
             }
         };
 
@@ -99,8 +106,9 @@ impl IscTrace {
                 sync_id: flit0.sync_id(),
             },
             pe_reserved: flit0.pe_reserved(),
+            insn,
             insn_hex: flit0.insn(),
-            insn_asm: Some(asm),
+            insn_asm: asm,
             timestamp: flit0.timestamp(),
         })
     }
@@ -129,11 +137,14 @@ impl IscTrace {
 pub struct IscTraceStream(Vec<IscTrace>);
 
 impl IscTraceStream {
-    pub fn from_bytes(bytes: &[u8]) -> Result<Self, TraceParsingError> {
+    pub fn from_bytes_with_ctx(
+        bytes: &[u8],
+        lreg: &impl LutDecoder,
+    ) -> Result<Self, TraceParsingError> {
         let mut trace_vec = Vec::new();
 
         for chunk in bytes.chunks(IscTrace::bytes_size()) {
-            match IscTrace::from_bytes(chunk) {
+            match IscTrace::from_bytes_with_ctx(chunk, lreg) {
                 Ok(value) => {
                     tracing::debug!("Decoded {value:x?}");
                     trace_vec.push(value);
@@ -163,308 +174,62 @@ mod test {
     #[test]
     fn isc_trace_parser() {
         let ref_data = vec![
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 128, 124, 146, 128, 41, 0, 0, 0, 124, 0, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 0, 128, 136, 146, 128, 41, 0, 0, 0,
-            124, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 64, 128, 20, 148,
-            146, 128, 41, 0, 0, 0, 124, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            3, 20, 0, 128, 160, 146, 128, 41, 0, 0, 0, 124, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 128, 172, 146, 128, 41, 0, 0, 0, 124, 0, 0, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 65, 1, 192, 184, 146, 128, 41, 0, 0, 0,
-            124, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 129, 1, 192, 196,
-            146, 128, 41, 0, 0, 0, 124, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            133, 1, 129, 20, 208, 146, 128, 41, 0, 0, 0, 124, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 137, 66, 1, 192, 220, 146, 128, 41, 0, 0, 0, 124, 1, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 138, 130, 1, 192, 232, 146, 128, 41, 0
```

**File**: `backends/tfhe-hpu-backend/src/utils/hputil.rs` (modified, +20/-5)
```diff
@@ -67,6 +67,9 @@ pub enum Commands {
     /// Hardware trace operation
     #[command(about = "Trace related operations")]
     TraceDump {
+        /// File containing lut_map for correct Pbs Lut decoding
+        #[arg(default_value = "hpu_lut_map.json")]
+        lut_map: String,
         /// Stop after a given size (Expressed in MiB)
         #[arg(long, short)]
         size_mib: Option<usize>,
@@ -423,13 +426,17 @@ fn main() {
             ResetAction::Hard => unimplemented!(),
             ResetAction::Flush => unimplemented!(),
         },
-        Commands::TraceDump { file, size_mib } => {
+        Commands::TraceDump {
+            file,
+            size_mib,
+            lut_map,
+        } => {
             // trace depth is expressed in MiB
             let size_b = std::cmp::min(config.board.trace_depth, size_mib.unwrap_or(usize::MAX))
                 * 1024
                 * 1024;
 
-            trace_dump(&mut hpu_hw, &regmap, size_b, file)
+            trace_dump(&mut hpu_hw, &regmap, lut_map, size_b, file)
         }
         Commands::PktTrace { action } => match action {
             PktTraceAction::Status => mhdma::pkt_trace_status(&mut hpu_hw, &regmap),
@@ -714,7 +721,13 @@ fn soft_reset(hw: &mut ffi::HpuHw, regmap: &FlatRegmap) {
     }
 }
 
-fn trace_dump(hw: &mut ffi::HpuHw, regmap: &FlatRegmap, size_b: usize, filename: &str) {
+fn trace_dump(
+    hw: &mut ffi::HpuHw,
+    regmap: &FlatRegmap,
+    lut_map_f: &str,
+    size_b: usize,
+    filename: &str,
+) {
     let offset = {
         let offset_reg: Vec<usize> = ["trc_pc0_lsb", "trc_pc0_msb"]
             .into_iter()
@@ -728,11 +741,13 @@ fn trace_dump(hw: &mut ffi::HpuHw, regmap: &FlatRegmap, size_b: usize, filename:
             .collect();
         offset_reg[0] as u64 + ((offset_reg[1] as u64) << 32)
     };
+    println!("Load LutMap context from file: {lut_map_f}");
+    let lut_map = LutMap::read_from(lut_map_f).expect("Issue with LutMap loading");
 
     println!("Dump {size_b} bytes of trace [@{offset:x}] inside {filename}");
     let raw_data = read_mem(hw, offset, size_b);
-    let trace_stream =
-        IscTraceStream::from_bytes(&raw_data).expect("Issue with during trace parsing");
+    let trace_stream = IscTraceStream::from_bytes_with_ctx(&raw_data, &lut_map)
+        .expect("Issue with during trace parsing");
 
     let file = File::create(filename).expect("Failed to create or open trace dump file");
     let buf_wr = std::io::BufWriter::new(file);
```

---

### Incident Patch 5: `b8d574c5` (2026-09-16)
**Commit Message**: fix(hpu): Update examples and test with new signature interfaces

Also fix gen_lut issue in integer/hl_api

**File**: `backends/tfhe-hpu-backend/src/interface/device.rs` (modified, +13/-0)
```diff
@@ -79,6 +79,19 @@ impl HpuDevice {
     pub fn config(&self) -> &HpuConfig {
         &self.config
     }
+
+    /// Look up the zhc `Signature`/required-node-count of a given IOp. Mainly useful for
+    /// tooling/benchmarks that need to introspect an IOp's expected src/dst/imm shape ahead of
+    /// building a matching `HpuCmd` (which does this same lookup internally and doesn't need it
+    /// specified explicitly).
+    pub fn get_signature(
+        &self,
+        fw_mode: crate::asm::FwMode,
+        opcode: crate::asm::IOpcode,
+        integer_w: u16,
+    ) -> crate::asm::IOpSig {
+        self.cluster.get_signature(fw_mode, opcode, integer_w)
+    }
 }
 
 /// Allocate new Hpu variable to hold ciphertext
```

**File**: `tfhe/examples/hpu/bench.rs` (modified, +28/-44)
```diff
@@ -24,7 +24,7 @@ use rand::{Rng, SeedableRng};
 /// Define CLI arguments
 pub use clap::Parser;
 pub use clap_num::maybe_hex;
-#[derive(clap::Parser, Debug, Clone, serde::Serialize)]
+#[derive(clap::Parser, Debug, Clone)]
 #[command(
     long_about = "HPU stimulus generation application: Start operation on HPU for RTL test purpose."
 )]
@@ -49,7 +49,7 @@ pub struct Args {
     /// Iop to expand and simulate
     /// If None default to All IOp
     #[arg(long)]
-    pub iop: Vec<hpu_asm::AsmIOpcode>,
+    pub iop: Vec<hpu_asm::StaticIOp>,
 
     /// Number of iteration for each IOp
     #[arg(long, default_value_t = 1)]
@@ -69,17 +69,6 @@ pub struct Args {
     #[arg(long, value_parser = maybe_hex::<u128>)]
     pub imm: Vec<u128>,
 
-    /// Fallback prototype
-    /// Only apply to IOp with unspecified prototype
-    /// Used for custom IOp testing when prototype isn't known
-    /// Syntax example: "<N B> <- <N N> <0>"
-    /// Each entry options are (case incensitive):
-    /// * N, Nat, Native -> Full size integer;
-    /// * H, Half -> Half size integer;
-    /// * B, Bool -> boolean value;
-    #[arg(long)]
-    pub user_proto: Option<hpu_asm::IOpProto>,
-
     /// Seed used for some rngs
     #[arg(long)]
     pub seed: Option<u128>,
@@ -93,10 +82,6 @@ pub struct Args {
     /// Use trivial encrypt ciphertext
     #[arg(long)]
     pub trivial: bool,
-
-    /// Override the firmware implementation used
-    #[arg(long)]
-    pub fw_impl: Option<String>,
 }
 
 #[derive(Debug)]
@@ -180,14 +165,14 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
         set_hpu_io_dump(dump_path);
     }
 
-    // Override some configuration settings
-    let mut hpu_config = HpuConfig::from_toml(args.config.expand().as_str());
-    if let Some(name) = args.fw_impl {
-        hpu_config.firmware.implementation = name;
-    }
+    let hpu_config = HpuConfig::from_toml(args.config.expand().as_str());
 
     // Instantiate HpuDevice --------------------------------------------------
-    let hpu_device = HpuDevice::new(hpu_config, args.force_reload)?;
+    let hpu_device = HpuDevice::new(
+        hpu_config,
+        args.force_reload,
+        &tfhe::core_crypto::hpu::create_hpu_lookuptable,
+    )?;
 
     // Force key seeder if seed specified by user
     if let Some(seed) = args.seed {
@@ -210,7 +195,7 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
     let bench_iop = if !args.iop.is_empty() {
         args.iop.clone()
     } else {
-        hpu_asm::IOP_LIST.to_vec()
+        hpu_asm::StaticIOp::ALL.to_vec()
     };
 
     let bench_w = if !args.integer_w.is_empty() {
@@ -229,17 +214,11 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
     // Execute based on required integer_w ------------------------------------
     let mut report = Vec::with_capacity(bench_w.len());
     for width in bench_w.iter() {
-        let num_block = width / hpu_device.params().pbs_params.message_width;
-
         let mut width_report = BenchReport::new();
         for iop in bench_iop.iter() {
-            let proto = if let Some(format) = iop.format() {
-                format.proto.clone()
-            } else {
-                args.user_proto.clone().expect(
-                    "Use of user defined IOp required a explicit prototype -> C.f. --user-proto",
-                )
-            };
+            let opcode = hpu_asm::IOpcode::from(*iop);
+            let (signature, _used_nodes) =
+                hpu_device.get_signature(hpu_asm::FwMode::Static, opcode, *width as u16);
 
             let hpu_nodes = if args.tput {
                 &hpu_device.config().fpga.node_id
@@ -251,16 +230,17 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
             let bench_inputs = hpu_nodes
                 .iter()
                 .map(|node| {
-                    let (srcs_clear, srcs_enc): (Vec<_>, Vec<_>) = proto
-                        .src
+            
```

**File**: `tfhe/examples/hpu/fw_dyn.rs` (modified, +26/-25)
```diff
@@ -7,15 +7,11 @@ use integer::hpu::ciphertext::HpuRadixCiphertext;
 use std::path::PathBuf;
 pub use std::time::{Duration, Instant};
 use tfhe::core_crypto::commons::generators::DeterministicSeeder;
-use tfhe::*;
-use tfhe_csprng::generators::DefaultRandomGenerator;
-
-use integer::hpu::ciphertext::HpuRadixCiphertext;
 use tfhe::integer::{ClientKey, CompressedServerKey, ServerKey};
-
 use tfhe::shortint::parameters::KeySwitch32PBSParameters;
+use tfhe::*;
+use tfhe_csprng::generators::DefaultRandomGenerator;
 
-use zhc::builder::CiphertextSpec;
 use zhc::config::multi_hpu::MultiHpuConfig;
 
 use rand::rngs::StdRng;
@@ -167,8 +163,12 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
     println!("\n A.0. Hpu backend default configuration");
     println!("   Open hardware with given configuration...");
     let hpu_config = HpuConfig::from_toml(args.config.expand().as_str());
-    let hpu_device =
-        HpuDevice::new(hpu_config.clone(), args.force_reload).expect("Hpu device init failed");
+    let hpu_device = HpuDevice::new(
+        hpu_config.clone(),
+        args.force_reload,
+        &tfhe::core_crypto::hpu::create_hpu_lookuptable,
+    )
+    .expect("Hpu device init failed");
 
     println!("   Generate client and server keys...");
     // Force key seeder if seed specified by user
@@ -230,26 +230,23 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
             }
 
             // Register fw on Hpu -----------------------------------------------------
-            let fw_entry = hpu_device.fw_dyn_init(
-                mh_pipeline,
-                &crate::core_crypto::hpu::glwe_lookuptable::create_hpu_lookuptable,
-            )?;
-            let proto = fw_entry.proto();
+            let fw_entry = hpu_device
+                .fw_dyn_init(mh_pipeline, &tfhe::core_crypto::hpu::create_hpu_lookuptable)?;
+            let (signature, _used_nodes) = fw_entry.sig();
 
             // Execution ROI ----------------------------------------------------------
-            let num_block = width / hpu_device.params().pbs_params.message_width;
-
             // Generate inputs
-            let (srcs_clear, srcs_enc): (Vec<_>, Vec<_>) = proto
-                .src
+            let (srcs_clear, srcs_enc): (Vec<_>, Vec<_>) = signature
+                .get_args()
                 .iter()
+                .filter_map(|ty| match ty {
+                    zhc::builder::Type::Ciphertext(spec) => Some(spec),
+                    zhc::builder::Type::Plaintext(_) => None,
+                })
                 .enumerate()
-                .map(|(pos, mode)| {
-                    let (bw, block) = match mode {
-                        hpu_asm::VarMode::Native => (width, num_block),
-                        hpu_asm::VarMode::Half => (width / 2, num_block / 2),
-                        hpu_asm::VarMode::Bool => (1, 1),
-                    };
+                .map(|(pos, spec)| {
+                    let bw = spec.int_size() as usize;
+                    let block = bw / hpu_device.params().pbs_params.message_width;
 
                     let clear = *args
                         .src
@@ -266,7 +263,12 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
                 })
                 .unzip();
 
-            let imms = (0..proto.imm)
+            let imm_count = signature
+                .get_args()
+                .iter()
+                .filter(|ty| matches!(ty, zhc::builder::Type::Plaintext(_)))
+                .count();
+            let imms = (0..imm_count)
                 .map(|pos| {
                     *args
                         .imm
@@ -281,7 +283,6 @@ pub fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
             let res_hpu = (0..args.iter)
                 .filter_map(|i| {
                     let res = HpuRadixCiphertext::exec(
-                        &proto,
                         hpu_asm::FwMode::Dynamic,
 
```

**File**: `tfhe/examples/hpu/hlapi.rs` (modified, +6/-2)
```diff
@@ -154,8 +154,12 @@ fn main() {
     };
 
     // Instantiate HpuDevice --------------------------------------------------
-    let hpu_device = HpuDevice::from_config(&args.config.expand(), args.force_reload)
-        .expect("Hpu device init failed");
+    let hpu_device = HpuDevice::from_config(
+        &args.config.expand(),
+        args.force_reload,
+        &tfhe::core_crypto::hpu::create_hpu_lookuptable,
+    )
+    .expect("Hpu device init failed");
 
     // Generate keys ----------------------------------------------------------
     let config = Config::from_hpu_device(&hpu_device);
```

**File**: `tfhe/examples/hpu/matmul.rs` (modified, +6/-2)
```diff
@@ -53,8 +53,12 @@ fn main() {
         pub p: usize,
     }
     let args = Args::parse();
-    let hpu_device = HpuDevice::from_config(&args.config.expand(), args.force_reload)
-        .expect("Hpu device init failed");
+    let hpu_device = HpuDevice::from_config(
+        &args.config.expand(),
+        args.force_reload,
+        &tfhe::core_crypto::hpu::create_hpu_lookuptable,
+    )
+    .expect("Hpu device init failed");
 
     println!("\n 1. Key generation");
     println!("   Generate client and server keys...");
```

---

### Incident Patch 6: `b2fb006c` (2026-09-23)
**Commit Message**: fix(integer): return an error if list size does not match metadata

**File**: `tfhe/src/high_level_api/compact_list.rs` (modified, +1/-1)
```diff
@@ -911,7 +911,7 @@ impl CiphertextList for CompactCiphertextListExpander {
         match &self.inner {
             InnerCompactCiphertextListExpander::Cpu(inner) => {
                 inner.get_kind_of(index).and_then(|data_kind| {
-                    crate::FheTypes::from_data_kind(data_kind, inner.message_modulus())
+                    crate::FheTypes::from_data_kind(data_kind, inner.message_modulus()?)
                 })
             }
             #[cfg(feature = "gpu")]
```

**File**: `tfhe/src/integer/ciphertext/compact_list.rs` (modified, +136/-20)
```diff
@@ -371,8 +371,11 @@ impl CompactCiphertextListExpander {
             .transpose()
     }
 
-    pub(crate) fn message_modulus(&self) -> MessageModulus {
-        self.expanded_blocks[0].message_modulus
+    /// Returns the message modulus of the blocks in the list, or None if the list holds no block
+    pub(crate) fn message_modulus(&self) -> Option<MessageModulus> {
+        self.expanded_blocks
+            .first()
+            .map(|block| block.message_modulus)
     }
 }
 
@@ -524,6 +527,15 @@ impl IntegerUnpackingToShortintCastingModeHelper {
         })
     }
 
+    /// Number of blocks described by the metadata of a list
+    fn block_count(&self, infos: &[DataKind]) -> crate::Result<usize> {
+        DataKind::total_block_count(infos, self.message_modulus).map_err(|()| {
+            crate::error!(
+                "Invalid compact ciphertext list: the block count of its metadata overflows"
+            )
+        })
+    }
+
     /// Generate functions to unpack message and carries and additionally sanitizes blocks
     ///
     /// * boolean blocks: make sure they encrypt a 0 or a 1
@@ -532,12 +544,15 @@ impl IntegerUnpackingToShortintCastingModeHelper {
     pub fn generate_unpack_and_sanitize_functions<'a>(
         &'a self,
         infos: &[DataKind],
+        expected_lwe_count: usize,
     ) -> crate::Result<ExpandFunctionsOwned<'a>> {
-        let block_count: usize = infos
-            .iter()
-            .map(|x| x.num_blocks(self.message_modulus))
-            .sum();
-        let packed_block_count = block_count.div_ceil(2);
+        let packed_block_count = self.block_count(infos)?.div_ceil(2);
+        if packed_block_count != expected_lwe_count {
+            return Err(crate::error!(
+                "Invalid compact ciphertext list: its metadata describes {packed_block_count} \
+                 packed ciphertexts, got {expected_lwe_count}"
+            ));
+        }
         let mut functions: ExpandFunctionsOwned<'a> =
             vec![Some(Vec::with_capacity(2)); packed_block_count];
         let mut overall_block_idx = 0;
@@ -606,11 +621,15 @@ impl IntegerUnpackingToShortintCastingModeHelper {
     pub fn generate_sanitize_without_unpacking_functions<'a>(
         &'a self,
         infos: &[DataKind],
+        expected_lwe_count: usize,
     ) -> crate::Result<ExpandFunctionsOwned<'a>> {
-        let total_block_count: usize = infos
-            .iter()
-            .map(|x| x.num_blocks(self.message_modulus))
-            .sum();
+        let total_block_count = self.block_count(infos)?;
+        if total_block_count != expected_lwe_count {
+            return Err(crate::error!(
+                "Invalid compact ciphertext list: its metadata describes {total_block_count} \
+                 ciphertexts, got {expected_lwe_count}"
+            ));
+        }
         let mut functions = Vec::with_capacity(total_block_count);
 
         let mut push_functions = |block_count: usize, func: &'a (dyn Fn(u64) -> u64 + Sync)| {
@@ -651,11 +670,12 @@ impl IntegerUnpackingToShortintCastingModeHelper {
         &'a self,
         infos: &[DataKind],
         is_packed: bool,
+        expected_lwe_count: usize,
     ) -> crate::Result<ExpandFunctionsOwned<'a>> {
         if is_packed {
-            self.generate_unpack_and_sanitize_functions(infos)
+            self.generate_unpack_and_sanitize_functions(infos, expected_lwe_count)
         } else {
-            self.generate_sanitize_without_unpacking_functions(infos)
+            self.generate_sanitize_without_unpacking_functions(infos, expected_lwe_count)
         }
     }
 
@@ -828,9 +848,17 @@ impl CompactCiphertextList {
         if self.is_empty() {
             return Ok(CompactCiphertextListExpander::new(vec![], vec![]));
         }
+        if self.ct_list.is_empty() {
+            return Err(crate::error!(
+                "Invalid compact ciphertext list: it holds no ciphertext but its metadata \
+                describes {} items",
+   
```

---

### Incident Patch 7: `ea588dfd` (2026-09-25)
**Commit Message**: fix(ci): fix zk-pok valgrind features and disable scheduled zk code validation

test_zk_pok_gpu_valgrind still exported SANITIZER_CARGO_FEATURES_CPU, which
check_memory_errors.sh stopped reading when it was renamed to
SANITIZER_CARGO_FEATURES_GPU_DEBUG. The script then used its default tfhe
feature list on tfhe-zk-pok, and cargo nextest list failed.

Remove the weekly cron trigger of gpu_zk_code_validation_tests; the
workflow can still be launched manually with workflow_dispatch.

**File**: `.github/workflows/gpu_zk_code_validation_tests.yml` (modified, +0/-3)
```diff
@@ -22,9 +22,6 @@ env:
 on:
   # Allows you to run this workflow manually from the Actions tab as an alternative.
   workflow_dispatch:
-  schedule:
-    # every friday noon
-    - cron: "0 12 * * 5"
 
 permissions:
   contents: read
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -1073,7 +1073,7 @@ test_zk_pok_gpu_valgrind: install_cargo_nextest
 	export RUSTFLAGS="-C target-cpu=x86-64" && \
 	export CARGO_PROFILE="$(CARGO_PROFILE)" && \
 	export SANITIZER_CARGO_PACKAGE=tfhe-zk-pok && \
-	export SANITIZER_CARGO_FEATURES_CPU=gpu && \
+	export SANITIZER_CARGO_FEATURES_GPU_DEBUG=gpu && \
 	export SANITIZER_TEST_FILTER_CPU='gpu::' && \
 	export SANITIZER_TEST_EXCLUDES_CPU='conversion_roundtrip|scalar_validation|long_run' && \
 	export SANITIZER_TEST_EXE_GLOB='tfhe_zk_pok-*' && \
```

---

### Incident Patch 8: `b10b64f3` (2026-09-23)
**Commit Message**: feat(bench): fix noise_squash file to avoid compilation error

**File**: `tfhe-benchmark/benches/high_level_api/noise_squash.rs` (modified, +15/-10)
```diff
@@ -1,3 +1,5 @@
+#![cfg_attr(feature = "hpu", allow(dead_code, unused_imports))]
+
 #[cfg(not(feature = "hpu"))]
 use benchmark::params_aliases::BENCH_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128;
 
@@ -69,7 +71,7 @@ fn bench_sns_only_fhe_type<FheType>(
     #[cfg(feature = "gpu")]
     set_server_key(compressed_sks.decompress_to_gpu());
 
-    #[cfg(all(not(feature = "hpu"), not(feature = "gpu")))]
+    #[cfg(not(feature = "gpu"))]
     {
         let decompressed_sks = compressed_sks.decompress();
         rayon::broadcast(|_| set_server_key(decompressed_sks.clone()));
@@ -118,7 +120,7 @@ fn bench_sns_only_fhe_type<FheType>(
 
                     throughput_num_threads(num_blocks, 4)
                 }
-                #[cfg(not(any(feature = "gpu", feature = "hpu")))]
+                #[cfg(not(feature = "gpu"))]
                 {
                     use benchmark::find_optimal_batch::find_optimal_batch;
 
@@ -177,7 +179,7 @@ fn bench_sns_only_fhe_type<FheType>(
                 });
             }
 
-            #[cfg(all(not(feature = "hpu"), not(feature = "gpu")))]
+            #[cfg(not(feature = "gpu"))]
             {
                 bench_group.throughput(Throughput::Elements(elements));
                 println!("elements: {elements}");
@@ -239,7 +241,7 @@ fn bench_decomp_sns_comp_fhe_type<FheType>(
     #[cfg(feature = "gpu")]
     set_server_key(compressed_sks.decompress_to_gpu());
 
-    #[cfg(all(not(feature = "hpu"), not(feature = "gpu")))]
+    #[cfg(not(feature = "gpu"))]
     {
         let decompressed_sks = compressed_sks.decompress();
         rayon::broadcast(|_| set_server_key(decompressed_sks.clone()));
@@ -296,7 +298,7 @@ fn bench_decomp_sns_comp_fhe_type<FheType>(
 
                     throughput_num_threads(num_blocks, 4)
                 }
-                #[cfg(not(any(feature = "gpu", feature = "hpu")))]
+                #[cfg(not(feature = "gpu"))]
                 {
                     use benchmark::find_optimal_batch::find_optimal_batch;
 
@@ -372,7 +374,7 @@ fn bench_decomp_sns_comp_fhe_type<FheType>(
                 });
             }
 
-            #[cfg(all(not(feature = "hpu"), not(feature = "gpu")))]
+            #[cfg(not(feature = "gpu"))]
             {
                 bench_group.throughput(Throughput::Elements(elements));
                 bench_group.bench_function(bench_id.as_str(), |b| {
@@ -452,19 +454,22 @@ bench_sns_only_type!(FheUint128);
 
 bench_decomp_sns_comp_type!(FheUint64);
 
+#[cfg(feature = "hpu")]
 fn main() {
-    let env_config = EnvConfig::new();
-
-    #[cfg(feature = "hpu")]
     panic!("Noise squashing is not supported on HPU");
+}
+
+#[cfg(not(feature = "hpu"))]
+fn main() {
+    let env_config = EnvConfig::new();
 
     let params: Vec<(
         PBSParameters,
         NoiseSquashingParameters,
         NoiseSquashingCompressionParameters,
         CompressionParameters,
     )> = {
-        #[cfg(all(not(feature = "hpu"), not(feature = "gpu")))]
+        #[cfg(not(feature = "gpu"))]
         {
             vec![(
                 BENCH_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
```

---

### Incident Patch 9: `c30730bf` (2026-09-17)
**Commit Message**: fix(gpu): use msg mod for carry_extract in compact list expand

**File**: `backends/tfhe-cuda-backend/cuda/include/zk/zk_utilities.h` (modified, +1/-1)
```diff
@@ -264,7 +264,7 @@ template <typename Torus> struct zk_expand_mem {
           return x % casting_params.message_modulus;
         };
         auto carry_extract_lut_f = [casting_params](Torus x) -> Torus {
-          return (x / casting_params.carry_modulus) %
+          return (x / casting_params.message_modulus) %
                  casting_params.message_modulus;
         };
         auto sanitize_bool_f = [](Torus x) -> Torus { return x == 0 ? 0 : 1; };
```

---

### Incident Patch 10: `fc2680ac` (2026-09-17)
**Commit Message**: fix(hlapi): fused_scalar_mul_scalar_div when scalar type is wider than fhe

The macro that declared the wide fhe type to be used in the
fused_scalar_mul_scalar_div was 'half' incorrect for non classical width
types, width for which the clear type allowed has a bigger width than the
FHE type. E.g for FheUint4 the wide fhe type was declared as FheUint8
and scalar type u8 (wide scalar type u16).
This is fine as long scalar value for the mul (encoded on a u8)
was actually in range [0, 2^4[, but when the value was in the range
[2^4, 2^8[, the internal computation the mul would not use
a type wide enough, losing precision, leading to incorrect result

The immediate fix is to align the wide FheType to have the same width as the wide
scalar type.

Another fix could have been not accepting values not in the same range
as the fhe type. Or possibly create wrapper scalar types to have our own
`u4`.

**File**: `tfhe/src/high_level_api/integers/signed/fused_ops.rs` (modified, +14/-14)
```diff
@@ -7,9 +7,9 @@ use crate::integer::bigint::{I1024, I2048, I256, I512};
 //
 // Types without at least double-width FheInt (FheInt2048) are not supported.
 impl_fused_mul_divs!(
-    (super::FheInt2, super::FheInt4, i8, i8),
-    (super::FheInt4, super::FheInt8, i8, i8),
-    (super::FheInt6, super::FheInt12, i8, i16),
+    (super::FheInt2, super::FheInt16, i8, i16),
+    (super::FheInt4, super::FheInt16, i8, i16),
+    (super::FheInt6, super::FheInt16, i8, i16),
     (super::FheInt8, super::FheInt16, i8, i16),
     (super::FheInt10, super::FheInt32, i16, i32),
     (super::FheInt12, super::FheInt32, i16, i32),
@@ -26,17 +26,17 @@ impl_fused_mul_divs!(
 
 #[cfg(feature = "extended-types")]
 impl_fused_mul_divs!(
-    (super::FheInt24, super::FheInt48, i32, i64),
-    (super::FheInt40, super::FheInt80, i64, i128),
-    (super::FheInt48, super::FheInt96, i64, i128),
-    (super::FheInt56, super::FheInt112, i64, i128),
-    (super::FheInt72, super::FheInt144, i128, I256),
-    (super::FheInt80, super::FheInt160, i128, I256),
-    (super::FheInt88, super::FheInt176, i128, I256),
-    (super::FheInt96, super::FheInt192, i128, I256),
-    (super::FheInt104, super::FheInt208, i128, I256),
-    (super::FheInt112, super::FheInt224, i128, I256),
-    (super::FheInt120, super::FheInt240, i128, I256),
+    (super::FheInt24, super::FheInt64, i32, i64),
+    (super::FheInt40, super::FheInt128, i64, i128),
+    (super::FheInt48, super::FheInt128, i64, i128),
+    (super::FheInt56, super::FheInt128, i64, i128),
+    (super::FheInt72, super::FheInt256, i128, I256),
+    (super::FheInt80, super::FheInt256, i128, I256),
+    (super::FheInt88, super::FheInt256, i128, I256),
+    (super::FheInt96, super::FheInt256, i128, I256),
+    (super::FheInt104, super::FheInt256, i128, I256),
+    (super::FheInt112, super::FheInt256, i128, I256),
+    (super::FheInt120, super::FheInt256, i128, I256),
     (super::FheInt136, super::FheInt512, I256, I512),
     (super::FheInt144, super::FheInt512, I256, I512),
     (super::FheInt152, super::FheInt512, I256, I512),
```

**File**: `tfhe/src/high_level_api/integers/signed/tests/cpu.rs` (modified, +1/-1)
```diff
@@ -257,5 +257,5 @@ fn test_safe_deserialize_conformant_compressed_fhe_int32() {
 #[test]
 fn test_int16_fused_mul_div() {
     let client_key = setup_default_cpu();
-    super::test_case_int16_fused_mul_div(&client_key);
+    super::test_case_fused_mul_div(&client_key);
 }
```

**File**: `tfhe/src/high_level_api/integers/signed/tests/gpu.rs` (modified, +1/-1)
```diff
@@ -378,7 +378,7 @@ fn test_gpu_get_div_size_on_gpu() {
 fn test_int16_fused_mul_div_gpu() {
     for setup_fn in crate::high_level_api::integers::unsigned::tests::gpu::GPU_SETUP_FN {
         let client_key = setup_fn();
-        super::test_case_int16_fused_mul_div(&client_key);
+        super::test_case_fused_mul_div(&client_key);
     }
 }
 
```

**File**: `tfhe/src/high_level_api/integers/signed/tests/mod.rs` (modified, +98/-2)
```diff
@@ -1,6 +1,11 @@
+use crate::core_crypto::prelude::SignedInteger;
 use crate::prelude::*;
-use crate::{ClientKey, FheBool, FheInt16, FheInt32, FheInt64, FheInt8, FheUint64, FheUint8};
+use crate::{
+    ClientKey, FheBool, FheInt10, FheInt16, FheInt32, FheInt4, FheInt6, FheInt64, FheInt8,
+    FheIntegerType, FheUint64, FheUint8, IntegerId,
+};
 use rand::prelude::*;
+use std::ops::{Div, Mul};
 
 mod cpu;
 #[cfg(feature = "gpu")]
@@ -520,7 +525,7 @@ fn test_case_min_max(cks: &ClientKey) {
     assert_eq!(decrypted_max, a_val.max(b_val));
 }
 
-fn test_case_int16_fused_mul_div(cks: &ClientKey) {
+fn test_case_fused_mul_div(cks: &ClientKey) {
     let mut rng = rand::thread_rng();
 
     // Widening prevents incorrect result with signed values:
@@ -586,4 +591,95 @@ fn test_case_int16_fused_mul_div(cks: &ClientKey) {
             assert_eq!(decrypted, expected);
         }
     }
+
+    // FheInt types which do not have a clear type with the same width
+    // we use the closest larger clear type, here we make sure the results
+    // are as expected
+    check_fused_mul_div::<FheInt4, i8, i16>(cks, 3, 127, 127);
+    check_fused_mul_div::<FheInt4, i8, i16>(cks, -8, 127, 127);
+    check_fused_mul_div::<FheInt4, i8, i16>(cks, 7, -128, -128);
+    check_fused_mul_div::<FheInt6, i8, i16>(cks, 31, 127, 127);
+    check_fused_mul_div::<FheInt6, i8, i16>(cks, -32, -128, -128);
+    for _ in 0..5 {
+        check_random_fused_mul_div::<FheInt4, i8, i16>(cks, &mut rng);
+        check_random_fused_mul_div::<FheInt10, i16, i32>(cks, &mut rng);
+    }
+}
+
+/// Sign truncates `value` to the `num_bits` low bits, the signed counterpart of masking
+/// with `(1 << num_bits) - 1`.
+fn sign_truncate<Clear: SignedInteger>(value: Clear, num_bits: usize) -> Clear {
+    let shift = Clear::BITS - num_bits;
+    (value << shift) >> shift
+}
+
+fn check_random_fused_mul_div<FheType, Clear, WideClear>(
+    cks: &ClientKey,
+    rng: &mut dyn rand::RngCore,
+) where
+    FheType: FheIntegerType
+        + FheTryEncrypt<Clear, ClientKey>
+        + FheDecrypt<Clear>
+        + FusedScalarMulScalarDiv<Clear, Output = FheType>,
+    for<'a> &'a FheType: FusedScalarMulScalarDiv<Clear, Output = FheType>,
+    Clear: SignedInteger,
+    rand::distributions::Standard: rand::distributions::Distribution<Clear>,
+    WideClear: From<Clear>
+        + CastInto<Clear>
+        + Mul<WideClear, Output = WideClear>
+        + Div<WideClear, Output = WideClear>,
+{
+    let num_bits = <FheType::Id as IntegerId>::num_bits();
+    let clear_a: Clear = sign_truncate(rng.gen(), num_bits);
+    let clear_b: Clear = rng.gen();
+    let clear_c: Clear = loop {
+        let v: Clear = rng.gen();
+        if v != Clear::ZERO {
+            break v;
+        }
+    };
+
+    check_fused_mul_div::<FheType, Clear, WideClear>(cks, clear_a, clear_b, clear_c);
+}
+
+fn check_fused_mul_div<FheType, Clear, WideClear>(
+    cks: &ClientKey,
+    clear_a: Clear,
+    clear_b: Clear,
+    clear_c: Clear,
+) where
+    FheType: FheIntegerType
+        + FheTryEncrypt<Clear, ClientKey>
+        + FheDecrypt<Clear>
+        + FusedScalarMulScalarDiv<Clear, Output = FheType>,
+    for<'a> &'a FheType: FusedScalarMulScalarDiv<Clear, Output = FheType>,
+    Clear: SignedInteger,
+    WideClear: From<Clear>
+        + CastInto<Clear>
+        + Mul<WideClear, Output = WideClear>
+        + Div<WideClear, Output = WideClear>,
+{
+    let num_bits = <FheType::Id as IntegerId>::num_bits();
+    assert!(num_bits < Clear::BITS);
+
+    let expected = sign_truncate(
+        ((WideClear::from(clear_a) * WideClear::from(clear_b)) / WideClear::from(clear_c))
+            .cast_into(),
+        num_bits,
+    );
+
+    let a = FheType::try_encrypt(clear_a, cks).unwrap();
+    // encrypted * scalar / scalar
+    {
+        let result = (&a).fused_scalar_mul_scalar_div(clear_b, clear_c);
+        let decrypted: Clear = result.decrypt(cks);
+        assert_eq!(decrypted, expected);
+    }
+
+    // Owne
```

**File**: `tfhe/src/high_level_api/integers/unsigned/fused_ops.rs` (modified, +14/-14)
```diff
@@ -139,9 +139,9 @@ pub(crate) use impl_fused_mul_divs;
 //
 // Types without at least double-width FheUint (FheUint2048) are not supported.
 impl_fused_mul_divs!(
-    (super::FheUint2, super::FheUint4, u8, u8),
-    (super::FheUint4, super::FheUint8, u8, u8),
-    (super::FheUint6, super::FheUint12, u8, u16),
+    (super::FheUint2, super::FheUint16, u8, u16),
+    (super::FheUint4, super::FheUint16, u8, u16),
+    (super::FheUint6, super::FheUint16, u8, u16),
     (super::FheUint8, super::FheUint16, u8, u16),
     (super::FheUint10, super::FheUint32, u16, u32),
     (super::FheUint12, super::FheUint32, u16, u32),
@@ -158,17 +158,17 @@ impl_fused_mul_divs!(
 
 #[cfg(feature = "extended-types")]
 impl_fused_mul_divs!(
-    (super::FheUint24, super::FheUint48, u32, u64),
-    (super::FheUint40, super::FheUint80, u64, u128),
-    (super::FheUint48, super::FheUint96, u64, u128),
-    (super::FheUint56, super::FheUint112, u64, u128),
-    (super::FheUint72, super::FheUint144, u128, U256),
-    (super::FheUint80, super::FheUint160, u128, U256),
-    (super::FheUint88, super::FheUint176, u128, U256),
-    (super::FheUint96, super::FheUint192, u128, U256),
-    (super::FheUint104, super::FheUint208, u128, U256),
-    (super::FheUint112, super::FheUint224, u128, U256),
-    (super::FheUint120, super::FheUint240, u128, U256),
+    (super::FheUint24, super::FheUint64, u32, u64),
+    (super::FheUint40, super::FheUint128, u64, u128),
+    (super::FheUint48, super::FheUint128, u64, u128),
+    (super::FheUint56, super::FheUint128, u64, u128),
+    (super::FheUint72, super::FheUint256, u128, U256),
+    (super::FheUint80, super::FheUint256, u128, U256),
+    (super::FheUint88, super::FheUint256, u128, U256),
+    (super::FheUint96, super::FheUint256, u128, U256),
+    (super::FheUint104, super::FheUint256, u128, U256),
+    (super::FheUint112, super::FheUint256, u128, U256),
+    (super::FheUint120, super::FheUint256, u128, U256),
     (super::FheUint136, super::FheUint512, U256, U512),
     (super::FheUint144, super::FheUint512, U256, U512),
     (super::FheUint152, super::FheUint512, U256, U512),
```

#### Recent Merged Pull Requests:
- **PR #3998** (2026-09-30): chore: fix fft bench hardware (@IceTDrinker)
- **PR #3996** (2026-09-30): chore: the batched PBS bench was not using the correct buffer size (@IceTDrinker)
- **PR #3993** (2026-09-30): refactor(integer): remove checked_ops (@tmontaigu)
- **PR #3992** (2026-09-30): chore: move fft/ntt benchmarks to hpc8 (@IceTDrinker)
- **PR #3990** (2026-09-30): chore(integer): test conformance of a list with an empty string (@nsarlin-zama)
- **PR #3989** (2026-09-29): Tm/remove checked (@tmontaigu)
- **PR #3988** (2026-09-30): fix(integer): boolean flip and add its missing test (@tmontaigu)
- **PR #3983** (2026-09-28): chore(deps): bump zgosalvez/github-actions-ensure-sha-pinned-actions from 5.0.8 to 5.0.9 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
